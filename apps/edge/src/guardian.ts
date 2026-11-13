/**
 * THE GUARDIAN'S WATCH (OWNER-ISSUES 55, 58): threats near his places, kept running while the phone sleeps.
 *
 * Every hour (a 'guard' job), the public flood and weather warnings and the month's street crime around each saved place
 * (integrations/warnings.ts). A NEW warning that touches a place → one notification (the inbox, his phone, one Telegram
 * line), a line in the day log (mind.ts observe) and in the one mind's `doing` (guardstate.ts guardianMind); never the
 * same warning twice; the all-clear said once when it lifts; a warning's end honoured; a feed that could not be read is
 * never an all-clear. Crime is shown, never announced: a month's count is not a warning, and nothing is extrapolated
 * from it. (The walk home, the named person and the panic phrase are walk.ts.)
 *
 * Routes (owner only):
 *   GET    /guardian          → GuardianInfo (THREATS → NEAR HOME, the Me sheet, Settings → GUARDIAN)
 *   POST   /guardian/check    → a look now (NEAR HOME's CHECK NOW)
 */
import { clockIn, FEED_NAMES, type FeedId, type GuardianInfo, type GuardWarning, type PersonInfo, type WalkInfo } from '../../../packages/shared/src/guardian';
import { crimeMonth, floods, metWarnings, placeArea, touches, type MetWarning } from './integrations/warnings';
import { observe } from './mind';
import { loadPlaces } from './places';
import { addJob, loadJobs, removeJob } from './schedule';
import { loadLink } from './telegram';
import { levelWord, loadConfig, loadWalk, loadWatch, nowOf, personRoute, WATCH_KEY, zoneOf, type GuardDeps } from './guardstate';

export { CONFIG_KEY, guardianMind, loadConfig, loadWalk, loadWatch, WALK_KEY, WATCH_KEY } from './guardstate';
export type { GuardConfig, GuardDeps, Person, PlaceState, Told, WatchState, WalkState } from './guardstate';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
/** Crime is looked at once a day (police.uk publishes monthly); a place's area once a month. */
const CRIME_EVERY = DAY;
const AREA_EVERY = 30 * DAY;
/** A warning already told is remembered this long, so it is never told twice. */
const TOLD_KEEP = 30 * DAY;

// ---------------------------------------------------------------- the watch

/** Exactly one hourly 'guard' job (checked once per brain, like the other standing jobs). */
export async function ensureGuardJob(storage: DurableObjectStorage, now = Date.now()): Promise<void> {
  const jobs = (await loadJobs(storage)).filter((j) => j.kind === 'guard');
  for (const j of jobs.slice(1)) await removeJob(storage, j.id);
  if (!jobs.length) await addJob(storage, { kind: 'guard', title: 'Watching your places', text: 'Flood and weather warnings and street crime near your saved places.', next: now + 3 * MIN, repeat: 'hourly', tz: 'UTC' });
}

const keyOf = (placeId: string, w: GuardWarning) => `${placeId}|${w.id}@${w.level}`;
const worse = (a: GuardWarning, b: GuardWarning) => a.level - b.level || b.since - a.since;

/** One warning, as he hears of it: "Flood alert near Home: River Cole at Kings Heath (Environment Agency, since 14:05)". */
export function warningLine(w: GuardWarning, place: string, zone: string, now = Date.now()): string {
  const src = FEED_NAMES[w.feed].source;
  const when = w.since > now ? `from ${clockIn(w.since, zone)}` : w.since ? `since ${clockIn(w.since, zone)}` : '';
  const until = w.until ? `, until ${clockIn(w.until, zone)}` : '';
  const what = w.feed === 'flood' ? w.title.replace(/^([^:]+):\s*/, `$1 near ${place}: `) : `${w.title} near ${place}`;
  return `${what} (${src}${when ? `, ${when}` : ''}${until})`;
}

/**
 * One look at every saved place: the feeds read, what is active kept per place, and the news worked out — a warning
 * never told before (told now, once), and one that has gone (its all-clear, once). A feed that could not be read changes
 * nothing for its warnings: a failed look is never an all-clear. `quiet`: the look only (the tool's CHECK).
 */
export async function watchTick(d: GuardDeps, opts: { quiet?: boolean } = {}): Promise<{ news: string[]; clear: string[] }> {
  const now = nowOf(d);
  const places = await loadPlaces(d.storage);
  const st = await loadWatch(d.storage);
  const zone = await zoneOf(d.storage);
  const news: string[] = [];
  const clear: string[] = [];
  const ok: Record<FeedId, boolean> = { flood: true, weather: true, crime: true };
  const fail = (f: FeedId, e: unknown) => {
    ok[f] = false;
    st.failed[f] = String((e as Error)?.message ?? e).slice(0, 120) || 'no answer';
  };
  // the places' areas (once a month each), then each Met Office region once
  for (const p of places) {
    const ps = (st.places[p.id] ??= { active: [] });
    if (ps.area === undefined || !ps.areaAt || now - ps.areaAt > AREA_EVERY) {
      try {
        ps.area = await placeArea(p.lat, p.lon);
        ps.areaAt = now;
      } catch {
        /* kept as it was: tried again next hour */
      }
    }
  }
  const regions = new Map<string, MetWarning[] | null>();
  for (const p of places) {
    const code = st.places[p.id]?.area?.code;
    if (!code || regions.has(code)) continue;
    try {
      regions.set(code, await metWarnings(code, now));
    } catch (e) {
      regions.set(code, null);
      fail('weather', e);
    }
  }
  for (const p of places) {
    const ps = st.places[p.id]!;
    let fl: GuardWarning[] | null = null;
    try {
      fl = await floods(p.lat, p.lon);
    } catch (e) {
      fail('flood', e);
    }
    const code = ps.area?.code ?? '';
    const met = code ? regions.get(code) : [];
    const keep = (feed: 'flood' | 'weather') => ps.active.filter((w) => w.feed === feed && !(w.until && w.until <= now));
    ps.active = [
      ...(fl ?? keep('flood')),
      ...(met ? met.filter((w) => ps.area && touches(w, ps.area)).map(({ areas: _a, ...w }) => w) : keep('weather')),
    ].sort(worse);
    if (!ps.crimeAt || now - ps.crimeAt > CRIME_EVERY) {
      try {
        const c = await crimeMonth(p.lat, p.lon);
        if (c) ps.crime = c;
        ps.crimeAt = now;
      } catch (e) {
        fail('crime', e);
      }
    }
  }
  for (const f of Object.keys(ok) as FeedId[]) {
    if (ok[f]) {
      st.checked[f] = now;
      delete st.failed[f];
    }
  }
  // places he removed are no longer watched
  for (const id of Object.keys(st.places)) if (!places.some((p) => p.id === id)) delete st.places[id];
  if (!opts.quiet) {
    for (const p of places) {
      for (const w of st.places[p.id]!.active) {
        const k = keyOf(p.id, w);
        if (st.told[k]) continue;
        // a worse level of a warning already told replaces it (its all-clear is this one's)
        for (const [ok2, t] of Object.entries(st.told)) if (!t.clear && ok2.startsWith(`${p.id}|${w.id}@`)) t.clear = now;
        st.told[k] = { at: now, place: p.label, feed: w.feed, what: levelWord(w), ...(w.until ? { until: w.until } : {}) };
        news.push(warningLine(w, p.label, zone, now));
      }
    }
    // gone: told, not active now at that place, and its feed was read fine this time (or its own end has passed)
    for (const [k, t] of Object.entries(st.told)) {
      if (t.clear) continue;
      const [placeId, rest] = [k.slice(0, k.indexOf('|')), k.slice(k.indexOf('|') + 1)];
      const id = rest.slice(0, rest.lastIndexOf('@'));
      // a place he removed: forgotten quietly, with no all-clear about a place he no longer has
      if (!places.some((p) => p.id === placeId)) {
        t.clear = now;
        continue;
      }
      const ended = !!t.until && t.until <= now;
      const still = !ended && (st.places[placeId]?.active ?? []).some((x) => x.id === id);
      if (still || !(ok[t.feed] || ended)) continue;
      t.clear = now;
      clear.push(`The ${t.what} near ${t.place} has ${ended ? 'ended' : 'lifted'} (${FEED_NAMES[t.feed].source}).`);
    }
    for (const [k, t] of Object.entries(st.told)) if (now - t.at > TOLD_KEEP) delete st.told[k];
  }
  await d.storage.put(WATCH_KEY, st);
  if (news.length) {
    await d.notify({ kind: 'error', title: news.length === 1 ? 'Warning near your places' : `${news.length} warnings near your places`, text: news.join('\n'), danger: true });
    for (const n of news) await observe(d.storage, { kind: 'place', text: n, via: 'guardian' }, now).catch(() => null);
  }
  if (clear.length) {
    await d.notify({ kind: 'task', title: 'All clear', text: clear.join('\n') });
    for (const c of clear) await observe(d.storage, { kind: 'place', text: c, via: 'guardian' }, now).catch(() => null);
  }
  return { news, clear };
}

// ---------------------------------------------------------------- what the phone shows

export async function guardianInfo(d: GuardDeps): Promise<GuardianInfo> {
  const [places, st, c, w, zone] = await Promise.all([loadPlaces(d.storage), loadWatch(d.storage), loadConfig(d.storage), loadWalk(d.storage), zoneOf(d.storage)]);
  const now = nowOf(d);
  let person: PersonInfo | null = null;
  if (c.person) {
    const link = await loadLink(d.env, d.storage).catch(() => undefined);
    const via = await personRoute(d, c.person);
    const invite = c.person.invite && !c.person.chatId && link?.bot ? `https://t.me/${link.bot}?start=g${c.person.invite.code}` : undefined;
    person = { name: c.person.name, telegram: c.person.telegram ?? '', email: c.person.email ?? '', linked: !!c.person.chatId, via, sharePos: c.person.sharePos, ...(invite ? { invite } : {}) };
  }
  const walk: WalkInfo | null = w ? (({ pos: _p, via: _v, tries: _t, safeSent: _s, alertVia: _a, askedAt: _q, asked2At: _q2, ...rest }) => rest)(w) : null;
  return {
    places: places.map((p) => {
      const ps = st.places[p.id];
      return { id: p.id, label: p.label, lat: p.lat, lon: p.lon, active: (ps?.active ?? []).filter((x) => !(x.until && x.until <= now)), ...(ps?.crime ? { crime: ps.crime } : {}), region: ps?.area?.region ?? '' };
    }),
    checked: st.checked,
    failed: st.failed,
    person,
    panic: c.panic ?? null,
    walk: walk && walk.stage === 'done' && walk.endedAt && now - walk.endedAt > DAY ? null : walk,
    tz: zone,
  };
}

export const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export async function guardianRoute(req: Request, path: string, method: string, d: GuardDeps): Promise<Response> {
  if (path === '/guardian' && method === 'GET') return json(await guardianInfo(d));
  if (path === '/guardian/check' && method === 'POST') {
    const r = await watchTick(d);
    return json({ ...(await guardianInfo(d)), news: r.news, clear: r.clear });
  }
  return json({ error: 'not found' }, 404);
}
