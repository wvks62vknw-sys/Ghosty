/**
 * FORESIGHT on the brain (OWNER-ISSUES 61a, 74(3), 75(b); the pure parts: packages/shared/src/foresight.ts). A ledger of
 * predictions about public things, made and scored on the brain's own clock by one standing hourly `foresee` job:
 *
 *  - each morning at six in his zone (once a day): RAIN at his saved home 12:00–18:00 from Open-Meteo's hourly probability;
 *    on weekdays with Home, Work and the free TomTom key, the COMMUTE at 08:00 from its own past live times; and the
 *    DEPARTURE of the first train, tram or bus of the 08:00 journey Home → Work (Transitous) — each only when its inputs
 *    exist, and said plainly when one is missing (`notes`);
 *  - each scored when its time comes, only against a public feed's later value: the hour's analysed rain (Open-Meteo's
 *    past day), the stop's live departures, TomTom's live drive. What the feeds say is kept as samples (counts about
 *    public services), never anything about anyone. A feed that cannot be read leaves a prediction open for a day, then
 *    it is kept as "could not be told" and never counted;
 *  - his own questions ("will it rain Saturday?") put on record by the `foresee` tool (tools/foresight.ts), scored only by
 *    his word (the Brief, the Report card, "you were right" in the chat or on Telegram);
 *  - the first time one comes true, one notification, once ever.
 * At most 8 reads a tick, each with a 10 s limit; the tick steps aside while the day's database allowance is low.
 *
 * Routes (owner only):
 *   GET    /foresight           → ForesightInfo (the Brief's FORESIGHT, the Report card, the chat with no model)
 *   POST   /foresight/resolve   {id, right: true | false | null} → his word on one of his questions
 */
import {
  addSample, ANSWER_DAYS, calibration, clampConfidence, dayOf, expectLines, expectOf, expectPhrase, FORE_KINDS, FORESIGHT_KEY, firstTrueText, foresightAsked, foresightWords, hhmm, notedWords, NOT_PEOPLE, ownerOutcome, personProblem, predictCommute,
  predictDeparture, predictRain, prune, readLedger, rightSaid, scoreCommute, scoreDeparture, scoreLine, scoreRain, subjectOf, todayOpen, yesterdayLine,
  type ForeKind, type ForeLedger, type ForesightInfo, type Hourly, type Outcome, type Prediction,
} from '../../../packages/shared/src/foresight';
import type { Journey, JourneyLeg } from '../../../packages/shared/src/protocol';
import { zoneOf } from './guardstate';
import { commute, type Commute } from './integrations/traffic';
import { departures as readDepartures, plan as readPlan, type Departure } from './integrations/transitous';
import type { Vault } from './kernel/vault';
import { observe } from './mind';
import { loadPlaces } from './places';
import { addJob, loadJobs, removeJob } from './schedule';
import { fromZoned, zoned } from './time';

export { FORESIGHT_KEY };
export type { ForeLedger, Prediction };

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
/** Reads a tick, and how long each may take. */
const FETCHES = 8;
const LIMIT_MS = 10_000;
/** The commute is read at 08:00 (and 17:30 for the samples) while it is still that time: within this long. */
const SAMPLE_WINDOW = 45 * MIN;
const UA = 'Ghosty/2.0 (personal assistant; single user)';

/** The public feeds the job reads (the tests stand them in). */
export interface ForeFeeds {
  hourly(lat: number, lon: number, tz: string, signal: AbortSignal): Promise<Hourly>;
  plan(from: { lat: number; lon: number }, to: { lat: number; lon: number }, time: number, signal: AbortSignal): Promise<Journey[]>;
  departures(stopId: string, time: number, signal: AbortSignal): Promise<Departure[]>;
  commute(key: string, from: { lat: number; lon: number }, to: { lat: number; lon: number }, signal: AbortSignal): Promise<Commute>;
}

export interface ForeDeps {
  storage: DurableObjectStorage;
  vault: Pick<Vault, 'get'>;
  /** The owner's notification: the inbox, his phone and his Telegram (agent.ts notify). */
  notify(item: { kind: 'reminder' | 'task' | 'error'; title: string; text: string }): Promise<unknown>;
  now?: () => number;
  feeds?: Partial<ForeFeeds>;
  /** The day's database allowance has room (meter.ts spare); false: the tick steps aside until the next hour. */
  spare?: boolean;
}

const nowOf = (d: Pick<ForeDeps, 'now'>) => (d.now ? d.now() : Date.now());

/** Open-Meteo's hourly rain chance and amount, yesterday to tomorrow, in his zone's days (keyless). */
export async function readHourly(lat: number, lon: number, tz: string, signal: AbortSignal): Promise<Hourly> {
  const u = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&hourly=precipitation_probability,precipitation&past_days=1&forecast_days=2&timezone=${encodeURIComponent(tz || 'UTC')}&timeformat=unixtime`;
  const r = await fetch(u, { headers: { Accept: 'application/json', 'User-Agent': UA }, signal });
  if (!r.ok) throw new Error(`Open-Meteo answered ${r.status}`);
  const j = (await r.json()) as { hourly?: { time?: number[]; precipitation_probability?: (number | null)[]; precipitation?: (number | null)[] } };
  const t = Array.isArray(j.hourly?.time) ? j.hourly!.time! : [];
  const at = (a: (number | null)[] | undefined, i: number) => (typeof a?.[i] === 'number' ? (a[i] as number) : NaN);
  return { time: t.map((x) => x * 1000), prob: t.map((_, i) => at(j.hourly?.precipitation_probability, i)), mm: t.map((_, i) => at(j.hourly?.precipitation, i)) };
}

const FEEDS: ForeFeeds = {
  hourly: readHourly,
  plan: (from, to, time, signal) => readPlan({ from: { name: 'Home', lat: from.lat, lon: from.lon }, to: { name: 'Work', lat: to.lat, lon: to.lon }, time, signal }),
  departures: async (stopId, time, signal) => (await readDepartures({ stopId }, 30, { time, signal })).list,
  commute: (key, from, to, signal) => commute(key, from, to, signal),
};

/** The feeds for one tick: at most 8 reads, each stopped after 10 s; the hourly answer read once and shared. */
function reader(d: ForeDeps, tz: string) {
  const f: ForeFeeds = { ...FEEDS, ...(d.feeds ?? {}) };
  let left = FETCHES;
  let hourly: Promise<Hourly> | null = null;
  const go = <T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> => {
    if (left <= 0) return Promise.reject(new Error('no reads left this hour'));
    left--;
    return fn(AbortSignal.timeout(LIMIT_MS));
  };
  return {
    hourly: (lat: number, lon: number) => (hourly ??= go((s) => f.hourly(lat, lon, tz, s))),
    plan: (from: { lat: number; lon: number }, to: { lat: number; lon: number }, time: number) => go((s) => f.plan(from, to, time, s)),
    departures: (stopId: string, time: number) => go((s) => f.departures(stopId, time, s)),
    commute: (key: string, from: { lat: number; lon: number }, to: { lat: number; lon: number }) => go((s) => f.commute(key, from, to, s)),
  };
}

export async function loadForesight(storage: DurableObjectStorage): Promise<ForeLedger> {
  return readLedger(await storage.get<ForeLedger>(FORESIGHT_KEY).catch(() => undefined));
}

async function saveForesight(storage: DurableObjectStorage, L: ForeLedger): Promise<void> {
  await storage.put(FORESIGHT_KEY, { ...L, items: prune(L.items) });
}

/** Exactly one hourly 'foresee' job (checked once per brain, like the other standing jobs); the first look 5 minutes on. */
export async function ensureForeseeJob(storage: DurableObjectStorage, now = Date.now()): Promise<void> {
  const jobs = (await loadJobs(storage)).filter((j) => j.kind === 'foresee');
  for (const j of jobs.slice(1)) await removeJob(storage, j.id);
  if (!jobs.length) await addJob(storage, { kind: 'foresee', title: 'Foresight', text: "The day's predictions about the weather at home and the commute, each checked against the public feeds.", next: now + 5 * MIN, repeat: 'hourly', tz: 'UTC' });
}

const newId = () => `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const isWeekday = (t: number, tz: string) => {
  const wd = zoned(t, tz).wd;
  return wd >= 1 && wd <= 5;
};
const MODE_WORD: Record<string, string> = { rail: 'train', tram: 'tram', bus: 'bus', subway: 'metro', ferry: 'ferry' };
const commuteKey = (from: string, to: string, at: string) => `${from}|${to}|${at}`;

/** The first train, tram or bus of a journey (null: it is a walk, or nothing but walking). */
export function firstRide(j: Journey | undefined): JourneyLeg | null {
  return j?.legs.find((l) => l.mode !== 'walk' && l.mode !== 'other' && !!l.from.stopId) ?? null;
}

/** "the 08:12 train from Birmingham New Street (West Midlands Trains)", "the 08:16 bus 50 from Corporation St (…)". */
export function departureSubject(l: JourneyLeg, tz: string): string {
  const at = hhmm(Date.parse(l.scheduledStart), tz);
  const what = MODE_WORD[l.mode] ?? 'service';
  const line = l.mode !== 'rail' && l.line ? ` ${l.line}` : '';
  return subjectOf(`the ${at} ${what}${line} from ${l.from.name || 'the stop'}${l.agency ? ` (${l.agency})` : ''}`);
}

/** One departure in the stop's list: the same line at the same timetabled minute. */
export function matchDeparture(list: Departure[], line: string, scheduled: number): { delay: number; cancelled: boolean } | null {
  const d = list.find((x) => (!line || x.line === line) && Math.abs(Date.parse(x.scheduled) - scheduled) < 60_000);
  if (!d) return null;
  if (d.cancelled) return { delay: 0, cancelled: true };
  // a departure with no live time says nothing about how it went
  if (!d.realTime) return null;
  return { delay: Math.round((Date.parse(d.time) - scheduled) / 1000), cancelled: false };
}

/**
 * One hour of foresight: what is due is scored, the commute sampled at 08:00 and 17:30 on weekdays, the morning's
 * predictions made once after six, the first one to come true told once. Returns when to come back (the next hour, or
 * sooner for a departure, the commute's minute or six o'clock).
 */
export async function foreseeTick(d: ForeDeps): Promise<number> {
  const now = nowOf(d);
  if (d.spare === false) return now + HOUR;
  const [L, zone, places] = await Promise.all([loadForesight(d.storage), zoneOf(d.storage), loadPlaces(d.storage)]);
  const home = places.find((p) => p.id === 'home');
  const work = places.find((p) => p.id === 'work');
  const key = String((await d.vault.get('tomtom').catch(() => null)) ?? '').trim();
  const io = reader(d, zone);
  const scored: Prediction[] = [];
  const today = dayOf(now, zone);
  const z = zoned(now, zone);
  const at = (h: number, mi: number, plusDays = 0) => fromZoned(z.y, z.m, z.d + plusDays, h, mi, zone);

  // 1. what is due, scored (his own questions wait for his word; the commute is scored with its 08:00 sample below)
  for (const p of L.items) {
    if (p.outcome || p.kind === 'answer' || p.by > now) continue;
    if (p.kind === 'commute') {
      if (now > p.by + SAMPLE_WINDOW) p.outcome = { at: now, actual: 'I missed the time to check it', right: null, how: 'feed' };
      continue;
    }
    let o: Outcome | null = null;
    try {
      if (p.kind === 'rain' && p.ref?.lat !== undefined && p.ref.lon !== undefined) o = scoreRain(p, await io.hourly(p.ref.lat, p.ref.lon), now);
      if (p.kind === 'departure' && p.ref?.stopId && p.ref.scheduled) o = scoreDeparture(p, matchDeparture(await io.departures(p.ref.stopId, p.ref.scheduled - 2 * MIN), p.ref.line ?? '', p.ref.scheduled), now);
    } catch {
      o = null;
    }
    if (o) {
      p.outcome = o;
      if (p.kind === 'departure' && o.right !== null) addSample(L.samples.dep, p.ref?.key ?? '', o.actual === 'cancelled' ? 3600 : o.value ?? 0);
      if (o.right !== null) scored.push(p);
    } else if (now > p.by + DAY) p.outcome = { at: now, actual: 'the feed could not be read', right: null, how: 'feed' };
  }

  // 2. the commute's live time on weekdays: 08:00 Home → Work (it scores the morning's prediction) and 17:30 back
  const slots = [
    { id: 'am', from: home, to: work, t: at(8, 0), key: commuteKey('home', 'work', '08:00') },
    { id: 'pm', from: work, to: home, t: at(17, 30), key: commuteKey('work', 'home', '17:30') },
  ];
  L.sampled ??= {};
  if (key && home && work && isWeekday(now, zone)) {
    for (const s of slots) {
      if (L.sampled[s.id] === today || now < s.t || now >= s.t + SAMPLE_WINDOW) continue;
      try {
        const c = await io.commute(key, s.from!, s.to!);
        if (!c.live) continue;
        addSample(L.samples.com, s.key, c.minutes);
        L.sampled[s.id] = today;
        if (s.id === 'am') {
          for (const p of L.items.filter((x) => x.kind === 'commute' && !x.outcome && dayOf(x.by, zone) === today)) {
            p.outcome = scoreCommute(p, c.minutes, now);
            if (p.outcome.right !== null) scored.push(p);
          }
        }
      } catch {
        /* tried again next tick while it is still that time */
      }
    }
  }

  // 3. the morning's predictions, once a day after six, each only when its inputs exist and its time is still ahead
  if (z.h >= 6) {
    if (L.made.day !== today) L.made = { day: today, done: [], notes: [] };
    const done = new Set<ForeKind>(L.made.done ?? []);
    const notes = new Set(L.made.notes ?? []);
    const add = (p: Omit<Prediction, 'id' | 'at'>) => void L.items.push({ id: newId(), at: now, ...p, confidence: clampConfidence(p.confidence), subject: subjectOf(p.subject), expect: expectOf(p.expect) });
    if (!done.has('rain')) {
      const win: [number, number] = [at(12, 0), at(18, 0)];
      if (!home || now >= win[0]) done.add('rain');
      else {
        try {
          const r = predictRain(await io.hourly(home.lat, home.lon), win, zone);
          if (r) add({ kind: 'rain', subject: `rain at ${home.label} 12:00–18:00`, expect: r.expect, confidence: r.confidence, by: at(18, 30), ref: { lat: home.lat, lon: home.lon, win } });
          done.add('rain');
        } catch {
          /* the forecast could not be read: tried again next tick */
        }
      }
    }
    if (!done.has('commute')) {
      const t = at(8, 0);
      if (key && home && work && isWeekday(now, zone) && now < t) {
        const c = predictCommute(L.samples.com[commuteKey('home', 'work', '08:00')] ?? []);
        if (c) add({ kind: 'commute', subject: `the commute ${home.label} → ${work.label} at 08:00`, expect: c.expect, confidence: c.confidence, by: t, ref: { minutes: c.minutes, key: commuteKey('home', 'work', '08:00') } });
      }
      done.add('commute');
    }
    if (!done.has('departure')) {
      const t = at(8, 0);
      if (!home || !work || now >= t - 10 * MIN) done.add('departure');
      else {
        try {
          const ride = firstRide((await io.plan(home, work, t))[0]);
          if (!ride) notes.add('Your way to work has no train, tram or bus, so there is no departure to predict.');
          else {
            const scheduled = Date.parse(ride.scheduledStart);
            if (Number.isFinite(scheduled) && scheduled > now + 10 * MIN) {
              const k = `${ride.line}|${ride.from.stopId}|${hhmm(scheduled, zone)}|${isWeekday(scheduled, zone) ? 'wd' : 'we'}`;
              const g = predictDeparture(L.samples.dep[k] ?? []);
              add({ kind: 'departure', subject: departureSubject(ride, zone), expect: g.expect, confidence: g.confidence, by: scheduled + 3 * MIN, ref: { stopId: ride.from.stopId, line: ride.line, scheduled, key: k } });
            }
          }
          done.add('departure');
        } catch {
          /* the journey planner could not be read: tried again next tick */
        }
      }
    }
    const wasDone = (L.made.done ?? []).length;
    L.made = { day: today, done: [...done], notes: [...notes] };
    // one line in the day log, once the day's predictions are all made
    if (wasDone < 3 && done.size >= 3) {
      const mine = L.items.filter((p) => p.kind !== 'answer' && dayOf(p.at, zone) === today);
      if (mine.length) await observe(d.storage, { kind: 'tool', text: `foresaw ${mine.length} thing${mine.length === 1 ? '' : 's'} for today: ${todayOpen(mine, now, zone).map(expectPhrase).join('; ')}`, via: 'foresight' }, now).catch(() => null);
    }
  }

  // 4. the first one to come true: told once, ever
  await firstTrue(d, L, scored, now);
  await saveForesight(d.storage, L);

  // when to come back: the next hour, a departure due to be scored, the commute's minutes, six o'clock
  const wakes = [now + HOUR];
  for (const p of L.items) if (!p.outcome && (p.kind === 'rain' || p.kind === 'departure') && p.by > now) wakes.push(p.by);
  if (key && home && work && isWeekday(now, zone)) for (const s of slots) if (L.sampled[s.id] !== today && s.t > now) wakes.push(s.t);
  const six = L.made.day === today ? at(6, 0, 1) : at(6, 0);
  if (six > now) wakes.push(six);
  return Math.max(now + MIN, Math.min(...wakes));
}

/** The first prediction to come true (a feed's or his word): one notification, once ever. */
async function firstTrue(d: ForeDeps, L: ForeLedger, scored: Prediction[], now: number): Promise<void> {
  if (L.firstTrue) return;
  const p = scored.find((x) => x.outcome?.right === true);
  if (!p) return;
  L.firstTrue = now;
  p.told = true;
  await d.notify({ kind: 'task', title: 'A prediction came true', text: firstTrueText(p) }).catch(() => undefined);
}

/** His word on one of his questions (an open 'answer' prediction): right, wrong, or it cannot be told. A feed's score is never changed. */
export async function resolvePrediction(d: ForeDeps, id: string, right: boolean | null): Promise<Prediction> {
  const L = await loadForesight(d.storage);
  const p = L.items.find((x) => x.id === id);
  if (!p) throw new Error('there is no such prediction');
  if (p.kind !== 'answer') throw new Error('only my answers to your questions are scored by your word; the rest are scored by the feeds');
  if (p.outcome) throw new Error('that one is already scored');
  const now = nowOf(d);
  p.outcome = ownerOutcome(right, now);
  await firstTrue(d, L, right ? [p] : [], now);
  await saveForesight(d.storage, L);
  return p;
}

/** One of his questions put on record (the `foresee` tool): refused, recording nothing, when it is about a person. */
export async function recordExpectation(d: ForeDeps, a: { subject: string; expect: string; by: number; confidence: number; said?: string }): Promise<{ refused: string } | { p: Prediction }> {
  const places = await loadPlaces(d.storage);
  if (personProblem(`${a.subject} ${a.expect}`, places.map((p) => p.label))) return { refused: NOT_PEOPLE };
  const L = await loadForesight(d.storage);
  const now = nowOf(d);
  const p: Prediction = { id: newId(), at: now, kind: 'answer', subject: subjectOf(a.subject), expect: expectOf(a.expect), confidence: clampConfidence(a.confidence), by: a.by, ...(a.said ? { said: a.said.slice(0, 200) } : {}) };
  L.items.push(p);
  await saveForesight(d.storage, L);
  return { p };
}

/** What the phone shows: the last 60, today's expectations, yesterday, the record per kind, and what is missing. */
export async function foresightInfo(d: Pick<ForeDeps, 'storage' | 'vault' | 'now'>): Promise<ForesightInfo> {
  const [L, zone, places] = await Promise.all([loadForesight(d.storage), zoneOf(d.storage), loadPlaces(d.storage)]);
  const now = nowOf(d);
  const has = (id: string) => places.some((p) => p.id === id);
  const key = String((await d.vault.get('tomtom').catch(() => null)) ?? '').trim();
  const notes: string[] = [];
  if (!has('home')) notes.push("Save Home in Memory → ME → PLACES and I'll predict the rain there every morning.");
  else if (!has('work')) notes.push("Save Work too and I'll predict your commute and its first train or bus.");
  else if (!key) notes.push('The commute needs the free TomTom key, SYSTEM → KEYS.');
  if (L.made.day === dayOf(now, zone)) notes.push(...(L.made.notes ?? []));
  const cal = Object.fromEntries([...FORE_KINDS, 'all' as const].map((k) => [k, calibration(L.items, k, now)])) as ForesightInfo['calibration'];
  return {
    items: [...L.items].sort((a, b) => b.at - a.at).slice(0, 60),
    expect: expectLines(L.items, now, zone),
    yesterday: yesterdayLine(L.items, now, zone),
    calibration: cal,
    score: scoreLine(L.items, now),
    notes,
    tz: zone,
  };
}

/**
 * His words about foresight, answered with no model (Telegram; the phone does the same from GET /api/foresight):
 * "what do you expect today?", "how often are you right?", "were you right?", and "you were right" / "you were wrong"
 * on the latest open question of his under seven days old. null: not about foresight.
 */
export async function foresightReply(d: ForeDeps, text: string): Promise<string | null> {
  const asked = foresightAsked(text);
  if (asked) return foresightWords(asked, await foresightInfo(d));
  const verdict = rightSaid(text);
  if (!verdict) return null;
  const now = nowOf(d);
  const L = await loadForesight(d.storage);
  const open = L.items.filter((p) => p.kind === 'answer' && !p.outcome && now - p.at < ANSWER_DAYS * DAY).sort((a, b) => b.at - a.at)[0];
  if (!open) return null;
  await resolvePrediction(d, open.id, verdict.right);
  return notedWords(verdict.right);
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export async function foresightRoute(req: Request, path: string, method: string, d: ForeDeps): Promise<Response> {
  if (path === '/foresight' && method === 'GET') return json(await foresightInfo(d));
  if (path === '/foresight/resolve' && method === 'POST') {
    const b = (await req.json().catch(() => ({}))) as { id?: unknown; right?: unknown };
    const right = b.right === true ? true : b.right === false ? false : null;
    try {
      const p = await resolvePrediction(d, String(b.id ?? ''), right);
      return json({ ...(await foresightInfo(d)), resolved: p.id, said: notedWords(right) });
    } catch (e) {
      return json({ error: String((e as Error)?.message ?? e).slice(0, 200) }, 400);
    }
  }
  return json({ error: 'not found' }, 404);
}
