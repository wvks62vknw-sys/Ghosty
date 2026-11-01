/**
 * SPEAKING FIRST (BRIEF-SIDEWAYS items 2c, 3, 5; OWNER-ISSUES 91b, 93b): the day's pieces as BRIEF cards at their minute —
 * the morning greeting with the rain at Home and his diary, the month a car he named falls due its MOT or tax — under
 * the cadence (packages/shared/src/cadence.ts): four a day at most on SOME, never two within two hours, nothing at night,
 * silent for the rest of the day after a stop word. A piece goes through notify (agent.ts), so the inbox, his phone and
 * his Telegram carry the same card (as text: title · line · the deep link). A warning about one of his places is never
 * held and never counted, but it is recorded, as everything unprompted is, so WHY and "what did you do today" list it
 * with its reason. Nothing here asks a model; nothing about a person is predicted.
 *
 *   GET /speak → { dial, cap, stopped, today } · POST /speak { dial } · POST /speak/stop · DELETE /speak/stop
 */
import { CADENCE_KEY, DIALS, alreadySaid, atNight, capOf, linesToday, localDay, localHour, maySpeak, readCadence, record, setDial, silence, unsilence, type Cadence, type Dial, type Spoken } from '../../../packages/shared/src/cadence';
import { card, carName, type Card } from '../../../packages/shared/src/cards';
import type { Vault } from './kernel/vault';
import { listCars } from './cars';
import { readHourly } from './foresight';
import { zoneOf } from './guardstate';
import { mindSnapshot } from './mind';
import { packPieces } from './packs'; // [packs]
import { loadPlaces } from './places';
import { addJob, loadJobs, removeJob } from './schedule';
import { fromZoned, zoned } from './time';

const MIN = 60_000;
/** The morning piece's minute (on his clock), and how late it is still news. */
const MORNING = 7.5;
const MORNING_UNTIL = 11;

export interface SpeakDeps {
  storage: DurableObjectStorage;
  vault: Pick<Vault, 'get'>;
  /** agent.ts notify: the inbox, his phone and his Telegram, with the card. */
  notify(item: { kind: 'task'; title: string; text: string; card: Card }): Promise<unknown>;
  now?: () => number;
  /** For the tests: the hourly rain at a place, instead of Open-Meteo. */
  rain?: (lat: number, lon: number, tz: string) => Promise<{ time: number[]; prob: (number | null)[] } | null>;
}

const nowOf = (d: Pick<SpeakDeps, 'now'>) => (d.now ? d.now() : Date.now());

export async function loadCadence(storage: DurableObjectStorage): Promise<Cadence> {
  return readCadence(await storage.get<Cadence>(CADENCE_KEY).catch(() => undefined));
}
const saveCadence = (storage: DurableObjectStorage, c: Cadence) => storage.put(CADENCE_KEY, c);

/**
 * Bring one card up unasked, if the cadence allows: said (recorded, with its reason, and sent through notify) or held
 * back (recorded with why). `danger` always goes.
 */
export async function speakFirst(d: SpeakDeps, c: Card, why: string, danger = false): Promise<{ said: boolean; held?: string }> {
  const now = nowOf(d);
  const tz = await zoneOf(d.storage);
  const cad = await loadCadence(d.storage);
  const may = maySpeak(cad, { danger, now, tz });
  const line: Spoken = { at: now, id: c.id, title: c.title, line: c.line, why, ...(danger ? { danger: true } : {}), ...(may.ok ? {} : { held: may.why }) };
  await saveCadence(d.storage, record(cad, line, tz));
  if (!may.ok) return { said: false, held: may.why };
  await d.notify({ kind: 'task', title: c.title, text: c.line, card: { ...c, at: now, why } });
  return { said: true };
}

/** A warning about one of his places went out (agent.ts notify, never held): recorded, so WHY and his day list it. */
export async function noteDanger(storage: DurableObjectStorage, c: Card, now = Date.now()): Promise<void> {
  const tz = await zoneOf(storage);
  const cad = await loadCadence(storage);
  await saveCadence(storage, record(cad, { at: now, id: c.id, title: c.title, line: c.line, why: 'a warning about one of your places (never held)', danger: true }, tz));
}

/** A stop word: nothing more unasked today (the phone's /stop and Telegram's). */
export async function stopSpeaking(storage: DurableObjectStorage, now = Date.now()): Promise<void> {
  const tz = await zoneOf(storage);
  await saveCadence(storage, silence(await loadCadence(storage), now, tz));
}

/** "Rain likely from 15:00" / "Dry for the rest of today", from the hourly chances (50 % or more is likely). */
export function rainWords(h: { time: number[]; prob: (number | null)[] }, now: number, tz: string): { line: string; wet: boolean } | null {
  const day = localDay(now, tz);
  const rest = h.time.map((t, i) => ({ t, p: h.prob[i] })).filter((x) => x.t + 3_600_000 > now && localDay(x.t, tz) === day && typeof x.p === 'number') as { t: number; p: number }[];
  if (!rest.length) return null;
  const hhmm = (t: number) => `${String(zoned(t, tz).h).padStart(2, '0')}:00`;
  const wet = rest.find((x) => x.p >= 50);
  if (!wet) return { line: 'dry for the rest of today', wet: false };
  return { line: wet.t <= now ? 'rain likely now' : `rain likely from ${hhmm(wet.t)}`, wet: true };
}

/** "2 things today, first Dentist at 09:30", the phone's own words for the diary (features/brief/day.ts). */
function diaryWords(items: { when: string; title: string }[]): string {
  if (!items.length) return 'nothing in your diary today';
  const first = items[0]!;
  const at = first.when === 'All day' ? ' (all day)' : first.when === 'Now' ? ' (on now)' : ` at ${first.when}`;
  return items.length === 1 ? `one thing today: ${first.title}${at}` : `${items.length} things today, first ${first.title}${at}`;
}
const cap1 = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** The morning piece: the rain at Home and his diary, once a day between 07:30 and 11:00. */
async function morning(d: SpeakDeps, now: number, tz: string): Promise<Card | null> {
  const [m, places] = await Promise.all([mindSnapshot(d.storage, { client: { tz }, now, waitMs: 1500 }).catch(() => null), loadPlaces(d.storage).catch(() => [])]);
  const home = places.find((p) => p.id === 'home');
  let rain: { line: string; wet: boolean } | null = null;
  if (home) {
    const h = d.rain ? await d.rain(home.lat, home.lon, tz).catch(() => null) : await readHourly(home.lat, home.lon, tz, AbortSignal.timeout(8000)).catch(() => null);
    if (h) rain = rainWords(h, now, tz);
  }
  const diary = diaryWords((m?.today.items ?? []).filter((x) => x.allDay || (x.end ?? x.at) > now));
  return card({
    id: `brief:morning:${localDay(now, tz)}`, kind: 'brief', at: now, title: 'Good morning',
    line: cap1([rain?.line, diary].filter(Boolean).join(' · ')),
    brief: { icon: rain?.wet ? 'rain' : 'morning' }, acts: [{ label: 'OPEN BRIEF', open: { tab: 'brief' } }],
  });
}

/** The pieces due now, best first, each with why it is said. */
export async function piecesNow(d: SpeakDeps, now: number, tz: string, cad: Cadence): Promise<{ card: Card; why: string }[]> {
  const out: { card: Card; why: string }[] = [];
  const h = localHour(now, tz);
  if (h >= MORNING && h < MORNING_UNTIL && !alreadySaid(cad, `brief:morning:${localDay(now, tz)}`)) {
    const c = await morning(d, now, tz);
    if (c) out.push({ card: c, why: 'the morning piece: your diary and the rain at Home' });
  }
  // a car he named falls due its MOT or tax this month (the months kept from its card): once a month each
  const month = localDay(now, tz).slice(0, 7);
  const monthName = MONTHS[Number(month.slice(5)) - 1]!;
  for (const c of await listCars(d.storage).catch(() => [])) {
    for (const what of ['mot', 'tax'] as const) {
      if (c[what] !== month) continue;
      const id = `brief:${what}:${c.plate.replace(/\s/g, '')}:${month}`;
      if (alreadySaid(cad, id)) continue;
      const word = what === 'mot' ? 'MOT' : 'Tax';
      out.push({
        card: card({ id, kind: 'brief', at: now, title: `${word} due this month`, line: `${carName(c)} (${c.plate}): its ${what === 'mot' ? 'MOT' : 'tax'} falls due in ${monthName}`, brief: { icon: 'car' }, acts: [{ label: 'SHOW THE CAR', car: c.plate }] }),
        why: `a car you named: its ${what === 'mot' ? 'MOT' : 'tax'} falls due in ${monthName}`,
      });
    }
  }
  // [packs] the body pack's water and stand-up nudges, when he turned them on (BRIEF-PACKS-1): under the same cadence
  out.push(...(await packPieces({ storage: d.storage, now: () => now }, cad).catch(() => [])));
  return out;
}

/** When to look again: his 07:30 if it is earlier or night, else in half an hour. */
export function nextLook(now: number, tz: string): number {
  const z = zoned(now, tz);
  const h = localHour(now, tz);
  if (h < MORNING) return fromZoned(z.y, z.m, z.d, 7, 30, tz);
  if (atNight(now, tz)) return fromZoned(z.y, z.m, z.d + 1, 7, 30, tz);
  return now + 30 * MIN;
}

/** The job's tick: every piece due now, through the cadence (one may go, the rest wait for the next look). Says when to come back. */
export async function speakTick(d: SpeakDeps): Promise<number> {
  const now = nowOf(d);
  const tz = await zoneOf(d.storage);
  const cad = await loadCadence(d.storage);
  if (!atNight(now, tz)) {
    for (const p of await piecesNow(d, now, tz, cad)) await speakFirst(d, p.card, p.why);
  }
  return nextLook(now, tz);
}

/** One speak job, created with the others (agent.ts), at his next 07:30 or in half an hour. */
export async function ensureSpeakJob(storage: DurableObjectStorage, now = Date.now()): Promise<void> {
  const jobs = (await loadJobs(storage)).filter((j) => j.kind === 'speak');
  for (const j of jobs.slice(1)) await removeJob(storage, j.id);
  if (jobs.length) return;
  const tz = await zoneOf(storage);
  await addJob(storage, { kind: 'speak', title: 'Speaking first', text: 'The pieces of your day at their minute — the morning, a car’s MOT month — under the speak-first dial (Settings → Character).', next: nextLook(now, tz), repeat: 'hourly', tz: 'UTC' }, now);
}

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export async function speakRoute(req: Request, path: string, method: string, d: SpeakDeps): Promise<Response> {
  const now = nowOf(d);
  const tz = await zoneOf(d.storage);
  const view = (c: Cadence) => ({ dial: c.dial, cap: capOf(c.dial), dials: DIALS, stopped: !!c.stopped && c.stopped === localDay(now, tz), today: linesToday(c, now, tz) });
  if (path === '/speak' && method === 'GET') return json(view(await loadCadence(d.storage)));
  if (path === '/speak' && method === 'POST') {
    const b = (await req.json().catch(() => ({}))) as { dial?: unknown };
    const next = setDial(await loadCadence(d.storage), String(b.dial ?? '') as Dial);
    await saveCadence(d.storage, next);
    return json(view(next));
  }
  if (path === '/speak/stop' && (method === 'POST' || method === 'DELETE')) {
    const cad = await loadCadence(d.storage);
    const next = method === 'POST' ? silence(cad, now, tz) : unsilence(cad);
    await saveCadence(d.storage, next);
    return json(view(next));
  }
  return json({ error: 'not found' }, 404);
}
