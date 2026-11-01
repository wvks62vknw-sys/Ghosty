/**
 * THE OUTSIDE PACK (BRIEF-PACKS-3; OWNER-ISSUES 92 ④): ONE tool, `outside`, its abilities an `action` enum — described in full
 * only when his words turn the group on, named "outside pack" otherwise (tools/index.ts). A day out and about, from his own
 * notes and free public sources: which carriage (only what he told it), car parks, toilets, cash machines and drinking water
 * (Overpass), what is open now (opening_hours read in code), a walk scored against street crime (OSRM + data.police.uk, said as
 * "fewer reports"), the last train or bus home (Transitous), the rain plan, a fare split, a midpoint by travel time, a bag,
 * where he parked, "I'm lost", a queue from his own notes. The brain NEVER gets live GPS: a place is a saved one, a name he
 * gives, or the phone's one-time position with his tap (lat and lon from the sheet, used once, not kept — except "I parked
 * here", which keeps the spot he asked it to). Overpass and OSRM are shared public servers: one question per ask, the answer
 * kept for the day, and the plain line when they refuse — nothing made up. The pure parts: packages/shared/src/outside.ts.
 */
import { card } from '../../../../packages/shared/src/cards';
import { MONTHS_SHORT, shortId } from '../../../../packages/shared/src/packs';
import {
  agoWords,
  bagFor,
  cashItems,
  compass,
  crimeMonths,
  fmtM,
  isDodgy,
  kindsText,
  metresBetween,
  midpointByTime,
  nearbyQuery,
  openItems,
  parkingItems,
  parseCrimes,
  parseNote,
  parseOverpass,
  parseParked,
  parseSplit,
  parseWait,
  polyAround,
  queueEstimate,
  rainPlan,
  refillItems,
  samePlace,
  scoreRoute,
  splitFare,
  splitWords,
  thin,
  toiletItems,
  viaOptions,
  walkMins,
  type Crime,
  type Found,
  type Hourly,
  type Item,
  type NearKind,
  type Pt,
  type RouteScore,
  type Wait,
} from '../../../../packages/shared/src/outside';
import { OVERPASS_MIRRORS } from '../integrations/aim';
import { CREDIT, format as journeyText, hhmm as journeyClock, JourneyError, KINDS, plan, resolvePlace } from '../integrations/transitous';
import { loadPlaces, notSavedYet, savedPlace } from '../places';
import { addJob, removeJob } from '../schedule';
import { fromZoned, zoned } from '../time';
import { load, packTool, save, todayOf, UA, wordsOf, type ActionFn, type PackDeps } from '../packs/base';
import { geocode } from './travel';
import { arg, type Tool } from './types';

export const OUTSIDE_KEYS = { notes: 'outside:notes', parked: 'outside:parked', waits: 'outside:waits' } as const;
const CACHE = 'outside:cache';

/** When the group is described in full: his words about a day out and about. */
export const OUTSIDE_WHEN = new RegExp(
  "\\b(carriages?|car ?parks?|parking|(?:i(?:'ve| have)? )?parked (?:here|on|at|outside|the car)|where(?:'s| is| did i (?:park|leave)) (?:the |my )?car|safer (?:walk|route)|dodgy (?:bit|area|street|stretch)|last (?:train|bus|tram)|toilets?|public loos?|cash ?(?:machine|point)s?|atms?|water refill|drinking (?:water|fountain)|what(?:'s| is) open|open (?:now|late)|i(?:'m| am) lost|take a (?:coat|brolly|umbrella)|rain plan|will it rain|split (?:the |this )?(?:fare|taxi|cab|uber)|meet (?:me )?halfway|halfway (?:between|point)|pack (?:my|a) bag|what (?:should|shall|do) i (?:pack|bring)|(?:the )?queue (?:at|for|is)|how long(?:'s| is| will)? the (?:queue|wait))\\b",
  'i',
);
export const OUTSIDE_ABOUT =
  'You can help him out and about (outside: note, carriage, parking, safewalk, lasthome, open, toilets, cash, refill, rain, split, halfway, pack, parked, lost, queue): saved places or names, never live GPS; estimates said.';

// ---------------------------------------------------------------- places, without tracking

interface Spot extends Pt {
  name: string;
}
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const round4 = (n: number) => Math.round(n * 1e4) / 1e4;
const NEED = 'I don’t track where you are. Tell me a place (a street, a station, or one you saved like home or work), or open the OUTSIDE sheet and tap USE WHERE I AM NOW, once.';
const MAP_DOWN = 'I can’t reach the map right now (the free OpenStreetMap servers are busy or refusing me). Nothing made up: try again in a few minutes.';
const POLICE_DOWN = 'The police data (data.police.uk) isn’t answering, so I can’t count reports along the way. Nothing made up: try again in a few minutes.';
const sheet = (what: string) => ({ name: 'open_outside', args: { what } });
const nobody = (s: string) => !s || /^(?:me|here|near me|my location|where i am|current location|nearby)$/i.test(s);

/** The phone's one-time position, sent by the sheet with his tap (never by the model, never kept here). */
function tapped(a: Record<string, unknown>): Spot | null {
  const lat = Number(a.lat);
  const lon = Number(a.lon);
  if (a.lat === undefined || a.lon === undefined || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { name: 'where you are now', lat: round4(lat), lon: round4(lon) };
}
/** A place he saved, or a name he gives (looked up on the free map); plain words when it cannot be done. */
async function placeOf(text: string, d: PackDeps): Promise<Spot | string> {
  const t = clean(text);
  if (nobody(t)) return NEED;
  const mine = await savedPlace(d.storage, t);
  if (mine) return { name: mine.label, lat: round4(mine.lat), lon: round4(mine.lon) };
  const unsaved = notSavedYet(t);
  if (unsaved) return unsaved;
  try {
    const home = await savedPlace(d.storage, 'home');
    const g = await geocode(t, home ? { name: home.label, lat: home.lat, lon: home.lon } : null);
    return g ? { name: g.name, lat: round4(g.lat), lon: round4(g.lon) } : `I couldn’t find “${t}” on the map. Try the street and the town.`;
  } catch {
    return MAP_DOWN;
  }
}

// ---------------------------------------------------------------- the shared servers: one question, kept for the day

const fnv = (s: string): string => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
};
/**
 * The answer to this question from today, else ask once and keep it till tomorrow (a failure is not kept). `keep` false: the
 * question came from the spot he tapped, so nothing about it is kept at all.
 */
async function cached<T>(d: PackDeps, key: string, ask: () => Promise<T>, keep = true): Promise<T> {
  if (!keep) return ask();
  const day = todayOf(d);
  const idx = await load<{ day: string; keys: string[] }>(d, CACHE, { day, keys: [] });
  if (idx.day !== day) {
    await d.storage.delete(idx.keys).catch(() => undefined);
    idx.day = day;
    idx.keys = [];
  }
  const k = `outside:c:${fnv(key)}`;
  if (idx.keys.includes(k)) {
    const hit = await d.storage.get<T>(k).catch(() => undefined);
    if (hit !== undefined) return hit;
  }
  const v = await ask();
  idx.keys = [...idx.keys.filter((x) => x !== k), k];
  while (idx.keys.length > 60) await d.storage.delete(idx.keys.shift()!).catch(() => undefined);
  await d.storage.put(k, v).catch(() => undefined);
  await save(d, CACHE, idx);
  return v;
}
async function overpass(d: PackDeps, q: string): Promise<unknown> {
  for (const m of OVERPASS_MIRRORS) {
    try {
      const r = await d.fetch(`${m}?data=${encodeURIComponent(q)}`, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(14_000) });
      if (!r.ok) continue;
      const j = (await r.json()) as { remark?: unknown };
      if (typeof j?.remark === 'string' && /error|timed out/i.test(j.remark)) continue;
      return j;
    } catch {
      /* the next mirror */
    }
  }
  throw new Error(MAP_DOWN);
}
/** What is near a point of one kind, nearest first (kept for the day). */
async function near(d: PackDeps, kind: NearKind, p: Pt, what = '', keep = true): Promise<Found[]> {
  const q = nearbyQuery(kind, p, { what });
  return cached(d, q, async () => parseOverpass(await overpass(d, q), p).slice(0, 40), keep);
}

interface Leg {
  distance: number;
  name: string;
  maneuver: { type: string; modifier?: string };
}
interface Way {
  distance: number;
  duration: number;
  /** [lat, lon] pairs. */
  path: [number, number][];
  seconds?: number[];
  steps: Leg[];
}
type Profile = 'routed-foot' | 'routed-car' | 'routed-bike';
async function osrm(d: PackDeps, profile: Profile, pts: Pt[], o: { alternatives?: boolean; annotations?: boolean; steps?: boolean } = {}): Promise<Way[]> {
  const coords = pts.map((p) => `${p.lon},${p.lat}`).join(';');
  const q = `overview=full&geometries=geojson${o.alternatives ? '&alternatives=true' : ''}${o.annotations ? '&annotations=duration' : ''}${o.steps ? '&steps=true' : ''}`;
  let j: { code?: string; routes?: Record<string, unknown>[] };
  try {
    const r = await d.fetch(`https://routing.openstreetmap.de/${profile}/route/v1/driving/${coords}?${q}`, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(14_000) });
    if (!r.ok) throw new Error('down');
    j = (await r.json()) as typeof j;
  } catch {
    throw new Error(MAP_DOWN);
  }
  if (j.code !== 'Ok' || !Array.isArray(j.routes) || !j.routes.length) throw new Error('The map found no way between those two places on foot or by road.');
  return j.routes.slice(0, 3).map((rt) => {
    const geom = (rt.geometry as { coordinates?: [number, number][] } | undefined)?.coordinates ?? [];
    const legs = (rt.legs as { annotation?: { duration?: number[] }; steps?: Leg[] }[] | undefined) ?? [];
    const seconds = legs.flatMap((l) => l.annotation?.duration ?? []);
    return { distance: Number(rt.distance) || 0, duration: Number(rt.duration) || 0, path: geom.map(([lo, la]) => [la, lo] as [number, number]), ...(seconds.length ? { seconds } : {}), steps: legs.flatMap((l) => l.steps ?? []) };
  });
}
async function forecast(d: PackDeps, p: Pt): Promise<Hourly | null> {
  const u = `https://api.open-meteo.com/v1/forecast?latitude=${p.lat.toFixed(3)}&longitude=${p.lon.toFixed(3)}&hourly=temperature_2m,precipitation_probability,precipitation&forecast_days=2&timezone=${encodeURIComponent(d.tz || 'UTC')}&timeformat=unixtime`;
  try {
    const r = await d.fetch(u, { headers: { accept: 'application/json', 'user-agent': UA }, signal: AbortSignal.timeout(9000) });
    if (!r.ok) return null;
    const j = (await r.json()) as { hourly?: { time?: number[]; temperature_2m?: (number | null)[]; precipitation_probability?: (number | null)[]; precipitation?: (number | null)[] } };
    const t = j.hourly?.time;
    if (!Array.isArray(t)) return null;
    return { time: t.map((x) => x * 1000), prob: t.map((_, i) => j.hourly?.precipitation_probability?.[i] ?? null), mm: t.map((_, i) => j.hourly?.precipitation?.[i] ?? null), temp: t.map((_, i) => j.hourly?.temperature_2m?.[i] ?? null) };
  } catch {
    return null;
  }
}
const clockAt = (d: PackDeps) => (ms: number) => {
  const z = zoned(ms, d.tz);
  return `${String(z.h).padStart(2, '0')}:${String(z.mi).padStart(2, '0')}`;
};
const nowClock = (d: PackDeps) => {
  const z = zoned(d.now(), d.tz);
  return { wd: z.wd, minute: z.h * 60 + z.mi, hour: z.h };
};

// ---------------------------------------------------------------- his notes: carriage, parking

interface Note {
  id: string;
  place: string;
  kind: 'carriage' | 'parking' | 'other';
  text: string;
  at: number;
}
const loadNotes = (d: PackDeps) => load<Note[]>(d, OUTSIDE_KEYS.notes, []);

const FORGET = /^(?:forget|clear|delete|remove|reset)\b/i;
/** “forget my notes about New Street” → New Street; “forget all my notes” → '' (all of them). */
const forgetKey = (words: string) => clean(words.replace(FORGET, '').replace(/\b(?:all|my|the|notes?|queues?|queue notes?|about|for|at|of)\b/gi, ''));
const note: ActionFn = async (a, d) => {
  if (FORGET.test(wordsOf(a))) {
    const key = forgetKey(wordsOf(a));
    const all = await loadNotes(d);
    const left = key ? all.filter((n) => !samePlace(n.place, key)) : [];
    if (!all.length) return { text: 'You haven’t told me any notes about places.' };
    if (left.length === all.length) return { text: `I have no note about ${key}. Say “forget all my notes” to clear them all.` };
    await save(d, OUTSIDE_KEYS.notes, left);
    return { text: `Forgot ${all.length - left.length} note${all.length - left.length === 1 ? '' : 's'}${key ? ` about ${key}` : ''}.` };
  }
  const p = parseNote(wordsOf(a), arg.str(a, 'place', false));
  if (!p) return { text: 'Which place, and what should I remember? Say it like “at New Street the front carriages are nearest the exit I use” or “Cannon Hill car park: card only, free after 6”.' };
  const notes = await loadNotes(d);
  if (!notes.some((n) => samePlace(n.place, p.place) && n.text.toLowerCase() === p.text.toLowerCase())) notes.push({ id: shortId(), ...p, at: d.now() });
  await save(d, OUTSIDE_KEYS.notes, notes.slice(-80));
  return { text: `Kept for ${p.place}: “${p.text}”. I’ll say it whenever you ask${p.kind === 'carriage' ? ' which carriage' : p.kind === 'parking' ? ' about parking there' : ''}. It’s only in your brain.` };
};

const carriage: ActionFn = async (a, d) => {
  const p = clean(arg.str(a, 'place', false) || wordsOf(a).replace(/^.*?\b(?:at|for|from|to)\s+/i, '').replace(/[?.!]+$/, ''));
  const notes = (await loadNotes(d)).filter((n) => n.kind === 'carriage');
  const honest = 'I can’t see today’s train: National Rail’s formation data (how long it is, where the carriages stop) needs a registered feed I don’t have, so I never guess a carriage or a length.';
  if (!p || nobody(p)) {
    return { text: notes.length ? `Your carriage notes:\n${notes.map((n) => `- ${n.place}: ${n.text}`).join('\n')}\n${honest}` : `You haven’t told me any yet. Say it once, like “at New Street the front carriages are nearest the exit I use”, and I’ll say it every time. ${honest}` };
  }
  const mine = notes.filter((n) => samePlace(n.place, p));
  if (!mine.length) return { text: `You haven’t told me which carriage suits ${p}. Say it once, like “at ${p} the front carriages are nearest the exit I use”, and I’ll say it every time. ${honest}` };
  return { text: `At ${mine[0]!.place}: ${mine.map((n) => n.text).join('; ')} (your note${mine.length > 1 ? 's' : ''}). ${honest}` };
};

// ---------------------------------------------------------------- what is near a place

function listText(items: Item[], n = 6): string {
  return items.slice(0, n).map((x, i) => `${i + 1}. ${x.name} — ${x.line}`).join('\n');
}
const nearCard = (kind: string, title: string, first: Item | undefined, where: string, at: number) =>
  card({ id: `outside:near:${kind}`, kind: 'brief', at, title, line: first ? `${first.name}, ${fmtM(first.m)} from ${where}` : `Nothing found near ${where}`, brief: { icon: 'diary' }, acts: [{ label: 'OPEN', run: sheet(kind === 'parking' ? 'parking' : kind) }] });

/** One kind of place near a saved place, a name he gives, or the spot he tapped. */
async function nearby(kind: NearKind, a: Record<string, unknown>, dd: PackDeps): Promise<{ from: Spot; found: Found[] } | { text: string; open?: { name: string; args: Record<string, unknown> } }> {
  const from = tapped(a) ?? (await placeOf(arg.str(a, 'near', false) || arg.str(a, 'place', false), dd));
  if (typeof from === 'string') return from === NEED ? { text: NEED, open: sheet(kind) } : { text: from };
  try {
    return { from, found: await near(dd, kind, from, arg.str(a, 'what', false) || wordsOf(a), !tapped(a)) };
  } catch (e) {
    return { text: (e as Error).message };
  }
}

const parking: ActionFn = async (a, d) => {
  const r = await nearby('parking', a, d);
  if (!('found' in r)) return r;
  const { items, hidden } = parkingItems(r.found);
  const mine = (await loadNotes(d)).filter((n) => n.kind === 'parking' && (samePlace(n.place, r.from.name) || items.some((i) => samePlace(i.name, n.place))));
  if (!items.length) return { text: `No public car park on the map within ${fmtM(700)} of ${r.from.name}${hidden ? ` (${hidden} private or permit-only ones left out)` : ''}.${mine.length ? ` Your notes: ${mine.map((n) => `${n.place}: ${n.text}`).join('; ')}.` : ''}` };
  return {
    text: `Car parks near ${r.from.name}, free and cheap first:\n${listText(items)}${hidden ? `\n(${hidden} private or permit-only ones left out.)` : ''}${mine.length ? `\nYour notes: ${mine.map((n) => `${n.place}: ${n.text}`).join('; ')}.` : ''}\nPrices and rules are the sign’s, not ours: the map’s fee and stay tags are volunteers’ and may be out of date.`,
    cards: [nearCard('parking', 'Car parks nearby', items[0], r.from.name, d.now())],
    data: { near: r.from.name, items: items.slice(0, 8) },
  };
};
const toilets: ActionFn = async (a, d) => {
  const r = await nearby('toilets', a, d);
  if (!('found' in r)) return r;
  const n = nowClock(d);
  const items = toiletItems(r.found, n.wd, n.minute);
  if (!items.length) return { text: `No public toilets on the map within a kilometre of ${r.from.name}. A café or a big shop is the usual answer; the map can’t say which will let you in.` };
  return { text: `Toilets near ${r.from.name}:\n${listText(items, 5)}\nThe map is volunteers’ notes: hours and fees can be out of date.`, cards: [nearCard('toilets', 'Toilets nearby', items[0], r.from.name, d.now())], data: { near: r.from.name, items: items.slice(0, 8) } };
};
const cash: ActionFn = async (a, d) => {
  const r = await nearby('cash', a, d);
  if (!('found' in r)) return r;
  const items = cashItems(r.found);
  if (!items.length) return { text: `No cash machine on the map within 600 m of ${r.from.name}. A supermarket often gives cash back with a card payment.` };
  return { text: `Cash machines near ${r.from.name}:\n${listText(items, 5)}\nWhether a machine charges is the bank’s call; the map’s tag is a volunteer’s.`, cards: [nearCard('cash', 'Cash machines nearby', items[0], r.from.name, d.now())], data: { near: r.from.name, items: items.slice(0, 8) } };
};
const refill: ActionFn = async (a, d) => {
  const r = await nearby('refill', a, d);
  if (!('found' in r)) return r;
  const items = refillItems(r.found);
  if (!items.length) return { text: `No drinking-water point on the map within 1.5 km of ${r.from.name}. Many cafés will fill a bottle if you ask; the Refill app lists them, and I can’t see it.` };
  return { text: `Free drinking water near ${r.from.name}:\n${listText(items, 5)}\nSome are switched off in winter; the map can’t say if today is one of those days.`, cards: [nearCard('refill', 'Free water nearby', items[0], r.from.name, d.now())], data: { near: r.from.name, items: items.slice(0, 8) } };
};
const open: ActionFn = async (a, d) => {
  const r = await nearby('open', a, d);
  if (!('found' in r)) return r;
  const n = nowClock(d);
  const { items, unread, closed } = openItems(r.found, n.wd, n.minute);
  const tail = `${unread ? `${unread} more have hours I can’t read. ` : ''}${closed ? `${closed} are closed now. ` : ''}Hours come from the map (volunteers’ notes); bank holidays can differ.`;
  if (!items.length) return { text: `Nothing I can read as open within 450 m of ${r.from.name} right now. ${tail}` };
  return { text: `Open now near ${r.from.name}:\n${listText(items, 8)}\n${tail}`, cards: [nearCard('open', 'Open now nearby', items[0], r.from.name, d.now())], data: { near: r.from.name, items: items.slice(0, 10) } };
};

// ---------------------------------------------------------------- a walk, scored against street crime

interface WalkRoute {
  label: string;
  km: number;
  min: number;
  reports: number;
  perKm: number;
  weighted: number;
  kinds: string;
  path: [number, number][];
  worst: { lat: number; lon: number; from: number; reports: number; streets: string[] } | null;
}
interface Walk {
  from: string;
  to: string;
  months: string[];
  routes: WalkRoute[];
  best: number;
}
async function crimesAlong(d: PackDeps, paths: [number, number][][]): Promise<{ crimes: Crime[]; months: string[] }> {
  let updated = '';
  try {
    const r = await d.fetch('https://data.police.uk/api/crime-last-updated', { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(10_000) });
    if (!r.ok) throw new Error('down');
    updated = String(((await r.json()) as { date?: unknown }).date ?? '');
  } catch {
    throw new Error(POLICE_DOWN);
  }
  const months = crimeMonths(updated);
  if (!months.length) throw new Error(POLICE_DOWN);
  const poly = polyAround(paths);
  const crimes: Crime[] = [];
  for (const m of months) {
    try {
      const r = await d.fetch(`https://data.police.uk/api/crimes-street/all-crime?poly=${poly}&date=${m}`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20_000) });
      if (r.status === 503) throw new Error('There are too many reports in that area for the police data to hand over in one go: try a shorter walk.');
      if (!r.ok) throw new Error(POLICE_DOWN);
      crimes.push(...parseCrimes(await r.json()));
    } catch (e) {
      throw new Error(/too many/.test((e as Error).message) ? (e as Error).message : POLICE_DOWN);
    }
  }
  return { crimes, months };
}
async function walkScore(d: PackDeps, from: Spot, to: Spot): Promise<Walk> {
  const crow = metresBetween(from, to);
  if (crow > 5500) throw new Error(`That is ${fmtM(crow)} as the crow flies — further than I score on foot (about 5 km). Try a nearer start, or a part of the way.`);
  const ways = await osrm(d, 'routed-foot', [from, to], { alternatives: true });
  const { crimes, months } = await crimesAlong(d, ways.map((w) => w.path));
  const rows = ways.map((w, i) => ({ w, s: scoreRoute(w.path, crimes), label: i === 0 ? 'The usual way' : 'Another way' }));
  const usual = rows[0]!;
  const lowest = rows.reduce((b, r) => (r.s.weighted < b.s.weighted ? r : b), usual);
  // the busiest stretch still dodgy on the best of them: ask the router once for a way round it
  if (isDodgy(lowest.s)) {
    try {
      const via = viaOptions(lowest.w.path, lowest.s, crimes)[0];
      if (via) {
        const round = (await osrm(d, 'routed-foot', [from, via, to]))[0]!;
        const s = scoreRoute(round.path, crimes);
        if (s.weighted < lowest.s.weighted * 0.9 && round.distance <= usual.w.distance * 1.35 + 200) rows.push({ w: round, s, label: 'Round the busiest stretch' });
      }
    } catch {
      /* no way round: the others stand */
    }
  }
  const lowestNow = rows.reduce((b, r) => (r.s.weighted < b.s.weighted ? r : b), usual);
  const best = lowestNow !== usual && lowestNow.s.weighted < usual.s.weighted * 0.95 ? rows.indexOf(lowestNow) : 0;
  const mk = (r: { w: Way; s: RouteScore; label: string }): WalkRoute => ({
    label: r.label,
    km: Math.round(r.w.distance / 100) / 10,
    min: Math.max(1, Math.round(r.w.duration / 60)),
    reports: r.s.reports,
    perKm: Math.round(r.s.perKm),
    weighted: Math.round(r.s.weighted * 10) / 10,
    kinds: kindsText(r.s.top),
    path: thin(r.w.path, 70).map(([la, lo]) => [Math.round(la * 1e5) / 1e5, Math.round(lo * 1e5) / 1e5] as [number, number]),
    worst: r.s.worst ? { lat: r.s.worst.at.lat, lon: r.s.worst.at.lon, from: Math.round(r.s.worst.from), reports: r.s.worst.reports, streets: r.s.worst.streets } : null,
  });
  return { from: from.name, to: to.name, months, routes: rows.map(mk), best };
}
const monthsText = (m: string[]) => `${MONTHS_SHORT[+m[m.length - 1]!.slice(5, 7) - 1]}–${MONTHS_SHORT[+m[0]!.slice(5, 7) - 1]} ${m[0]!.slice(0, 4)}`;

const safewalk: ActionFn = async (a, d) => {
  const fromT = arg.str(a, 'from', false);
  const from = tapped(a) ?? (await placeOf(fromT, d));
  if (typeof from === 'string') return { text: from === NEED ? `Where are you setting off from? ${NEED}` : from, ...(from === NEED ? { open: sheet('safewalk') } : {}) };
  const to = await placeOf(arg.str(a, 'to', false) || 'home', d);
  if (typeof to === 'string') return { text: to };
  let w: Walk;
  try {
    w = await cached(d, `walk|${from.lat},${from.lon}|${to.lat},${to.lon}`, () => walkScore(d, from, to), !tapped(a));
  } catch (e) {
    return { text: (e as Error).message };
  }
  const usual = w.routes[0]!;
  const lines = w.routes.map((r, i) => `${i + 1}. ${r.label}: ${r.km} km, about ${r.min} min · ${r.reports} reports (${r.perKm} a km)${r.kinds ? `, mostly ${r.kinds}` : ''}.${r.worst && r.worst.reports >= 4 ? ` Busiest stretch: ${r.worst.streets.length ? `near ${r.worst.streets.join(' / ')}` : 'one part of it'}, about ${fmtM(r.worst.from)} in (${r.worst.reports} reports).` : ''}`);
  const b = w.routes[w.best]!;
  const verdict =
    w.best === 0
      ? 'I couldn’t find a way with clearly fewer reports than the usual one.'
      : `Way ${w.best + 1} has ${Math.round((1 - b.weighted / usual.weighted) * 100)}% fewer reports (weighted by kind) than the usual way, and is ${b.min - usual.min >= 0 ? `${b.min - usual.min} min longer` : `${usual.min - b.min} min shorter`}.`;
  return {
    text: `Walking ${w.from} to ${w.to}. Reports to the police within 100 m of each way, ${monthsText(w.months)} (data.police.uk):\n${lines.join('\n')}\n${verdict}\nFewer reports is not “safe”, and more is not “dangerous”: it counts what was reported, placed on the nearest street, two months or so behind. At night keep to lit, busy streets and tell someone; WALK ME HOME will watch your walk.`,
    cards: [card({ id: `outside:walk:${fnv(`${from.lat}${to.lat}`)}`, kind: 'brief', at: d.now(), title: 'Walk: fewer reports', line: w.best === 0 ? `Usual way: ${usual.reports} reports` : `Way ${w.best + 1}: ${b.reports} vs ${usual.reports} reports`, brief: { icon: 'diary' }, acts: [{ label: 'OPEN', run: { name: 'open_outside', args: { what: 'safewalk', from: from.name, to: to.name } } }] })],
    data: w,
  };
};

// ---------------------------------------------------------------- the last way home

const lasthome: ActionFn = async (a, d) => {
  const tap = tapped(a);
  const fromT = arg.str(a, 'from', false);
  if (!tap && nobody(fromT)) return { text: `Where are you setting off from? ${NEED}`, open: sheet('safewalk') };
  let from: Pt & { name: string; stopId?: string };
  let to: Pt & { name: string; stopId?: string };
  try {
    from = tap ?? (await resolvePlace(fromT, d, null));
    to = await resolvePlace(arg.str(a, 'to', false) || 'home', d, from);
  } catch (e) {
    return { text: (e as Error).message };
  }
  const modes = KINDS[arg.str(a, 'mode', false).toLowerCase()] ?? [];
  const z = zoned(d.now(), d.tz);
  const end = fromZoned(z.y, z.m, z.d + (z.h < 4 ? 0 : 1), 4, 0, d.tz);
  const targets = [end, end - 2 * 3_600_000, end - 3.5 * 3_600_000, end - 4.5 * 3_600_000, end - 5.5 * 3_600_000, end - 6.5 * 3_600_000].filter((t) => t > d.now() + 10 * 60_000);
  let best: Awaited<ReturnType<typeof plan>>[number] | null = null;
  let walk: number | null = null;
  for (const t of targets) {
    try {
      const js = await plan({ from, to, time: t, arriveBy: true, modes, maxTransfers: 3 });
      const rides = js.filter((j) => !j.direct && Date.parse(j.start) > d.now());
      const direct = js.find((j) => j.direct);
      if (direct) walk = Math.round(direct.duration / 60);
      if (rides.length) {
        best = rides.sort((x, y) => Date.parse(y.start) - Date.parse(x.start))[0]!;
        break;
      }
    } catch (e) {
      if (e instanceof JourneyError) return { text: e.message };
      return { text: 'The journey planner (Transitous) isn’t answering, so I can’t find the last service. Nothing made up: try again in a few minutes, or ask the operator.' };
    }
  }
  if (!best) return { text: `I can’t find a bus, tram or train from ${from.name} to ${to.name} for the rest of tonight.${walk ? ` It’s about a ${walk}-minute walk.` : ''} (Services can be missing from the open timetables: check the operator.)` };
  return {
    text: `The last way I can find from ${from.name} to ${to.name}: leave ${journeyClock(best.start, d.tz)}, home by ${journeyClock(best.end, d.tz)}.\n${journeyText([best], d.tz)}\nThat is the timetable plus the operators’ live feed, as the open journey planner has it: strikes, works and late changes can beat it, so look at the operator’s own app before you rely on it. ${CREDIT}`,
    cards: [card({ id: 'outside:lasthome', kind: 'brief', at: d.now(), title: 'Last way home', line: `Leave ${journeyClock(best.start, d.tz)} · home ${journeyClock(best.end, d.tz)}`, brief: { icon: 'reminder' } })],
    data: { start: best.start, end: best.end },
  };
};

// ---------------------------------------------------------------- the rain plan, a bag

async function weatherAt(a: Record<string, unknown>, d: PackDeps): Promise<{ at: Spot; hourly: Hourly | null } | string> {
  const at = tapped(a) ?? (await placeOf(arg.str(a, 'near', false) || arg.str(a, 'place', false) || 'home', d));
  if (typeof at === 'string') return at === NEED ? `${NEED} (Or save your home: I use it when you don’t say.)` : at;
  return { at, hourly: await forecast(d, at) };
}
const rain: ActionFn = async (a, d) => {
  const w = await weatherAt(a, d);
  if (typeof w === 'string') return { text: w, open: w.includes('OUTSIDE sheet') ? sheet('rain') : undefined };
  const p = w.hourly ? rainPlan(w.hourly, d.now(), clockAt(d)) : null;
  if (!p) return { text: `I couldn’t get the forecast for ${w.at.name} just now (Open-Meteo isn’t answering). I won’t guess the weather.` };
  return {
    text: `${w.at.name}: ${p.line}${p.temp !== null ? ` About ${Math.round(p.temp)}°C over those hours.` : ''}`,
    cards: [card({ id: 'outside:rain', kind: 'brief', at: d.now(), title: p.coat ? 'Take a coat' : 'No coat needed', line: p.coat ? `Rain from ${p.from}, up to ${p.peak}% about ${p.peakAt}` : `Dry for now (top chance ${p.peak}%)`, brief: { icon: 'rain' } })],
    data: { coat: p.coat, from: p.from, to: p.to, peak: p.peak },
  };
};
const pack: ActionFn = async (a, d) => {
  const plan = clean(arg.str(a, 'plan', false) || wordsOf(a));
  if (!plan) return { text: 'What is the day? Say it like “pack my bag for the gym and then work” or “a day at the beach”.' };
  const w = await weatherAt(a, d);
  const hourly = typeof w === 'string' ? null : w.hourly;
  const p = hourly ? rainPlan(hourly, d.now(), clockAt(d)) : null;
  const bag = bagFor(plan, { rain: p?.peak ?? null, ...(p?.coat ? { at: p.peakAt } : {}), temp: p?.temp ?? null });
  return { text: `For “${plan}”:\n${bag.items.map((x) => `- ${x}`).join('\n')}\n${bag.why.length ? `Weather I used: ${bag.why.join(', ')}.` : 'I didn’t check the weather (no place saved, or the forecast didn’t answer), so add a coat if in doubt.'} A starting list: add your own.`, data: { items: bag.items } };
};

// ---------------------------------------------------------------- a fare split, halfway, lost

const split: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const s = parseSplit(words);
  if (Array.isArray(a.people) && (a.people as unknown[]).length) s.people = (a.people as unknown[]).map(String);
  const total = arg.num(a, 'total', NaN);
  if (Number.isFinite(total) && total > 0) s.total = total;
  const out = splitFare(s);
  if (!out) return { text: 'I need the total and who shares it. Say it like “taxi £48, I paid, between me, Sam and Jo” or “I paid £30, Sam paid £12, split 3 ways”.' };
  return { text: splitWords(out), data: out, cards: [card({ id: 'outside:split', kind: 'brief', at: d.now(), title: 'Fare split', line: out.owes.length ? out.owes.map((x) => `${x.from} → ${x.to} £${x.amount.toFixed(2)}`).join(' · ') : `£${out.each.toFixed(2)} each`, brief: { icon: 'diary' } })] };
};

const halfway: ActionFn = async (a, d) => {
  const A = tapped(a) ?? (await placeOf(arg.str(a, 'from', false) || arg.str(a, 'place', false), d));
  if (typeof A === 'string') return { text: A === NEED ? `Which two places? Name them, or use two you saved. ${NEED}` : A };
  const B = await placeOf(arg.str(a, 'with', false) || arg.str(a, 'to', false), d);
  if (typeof B === 'string') return { text: B === NEED ? 'Which two places? Say “meet halfway between home and Sam’s”.' : B };
  const mode = /walk|foot/i.test(arg.str(a, 'mode', false) || wordsOf(a)) ? 'walking' : /cycl|bike/i.test(arg.str(a, 'mode', false) || wordsOf(a)) ? 'cycling' : 'driving';
  let way: Way;
  try {
    way = (await osrm(d, mode === 'walking' ? 'routed-foot' : mode === 'cycling' ? 'routed-bike' : 'routed-car', [A, B], { annotations: true }))[0]!;
  } catch (e) {
    return { text: (e as Error).message };
  }
  const mid = midpointByTime(way.path, way.seconds);
  const mins = Math.round(way.duration / 60);
  let spots = '';
  try {
    const q = `[out:json][timeout:20];(nwr["amenity"~"^(cafe|pub|restaurant)$"](around:500,${mid.at.lat.toFixed(4)},${mid.at.lon.toFixed(4)}););out center tags 30;`;
    const found = await cached(d, q, async () => parseOverpass(await overpass(d, q), mid.at).filter((f) => f.name).slice(0, 12), !tapped(a));
    if (found.length) spots = `\nPlaces to meet within 500 m of the middle: ${found.slice(0, 4).map((f) => `${f.name} (${f.tags.amenity}, ${fmtM(f.m)})`).join('; ')}.`;
  } catch {
    spots = '\n(I couldn’t get the places near the middle: the map’s servers are busy.)';
  }
  return {
    text: `Halfway by ${mode === 'driving' ? 'driving' : mode} time between ${A.name} and ${B.name}: about ${Math.round(mins / 2)} min from each (${(way.distance / 1000).toFixed(1)} km, ${mins} min door to door${mode === 'driving' ? ', without traffic' : ''}). The middle is ${fmtM(mid.fromA)} along the usual route from ${A.name}, ${compass(A, mid.at)} of it.${spots}\nAn estimate: it takes the route's own timings, and traffic or a different road would move it.`,
    open: { name: 'show_route', args: { path: thin(way.path, 600).map(([la, lo]) => [Math.round(la * 1e5) / 1e5, Math.round(lo * 1e5) / 1e5]), from: A.name, to: B.name, mode, distance_m: way.distance, duration_s: way.duration } },
    data: { mid: mid.at, minutes: mins },
  };
};

const turn = (s: Leg): string => {
  const mod = s.maneuver.modifier ? ` ${s.maneuver.modifier}` : '';
  if (s.maneuver.type === 'depart') return `Head off${s.name ? ` along ${s.name}` : ''}`;
  if (s.maneuver.type === 'roundabout' || s.maneuver.type === 'rotary') return `At the roundabout${s.name ? ` take ${s.name}` : ''}`;
  return `Turn${mod}${s.name ? ` onto ${s.name}` : ''}`;
};
const lost: ActionFn = async (a, d) => {
  const me = tapped(a) ?? (arg.str(a, 'near', false) ? await placeOf(arg.str(a, 'near', false), d) : NEED);
  if (typeof me === 'string') return { text: me === NEED ? `${NEED} I never see where you are on my own.` : me, ...(me === NEED ? { open: sheet('lost') } : {}) };
  const saved = (await loadPlaces(d.storage)).map((p) => ({ name: p.label, lat: p.lat, lon: p.lon, m: metresBetween(me, p) })).sort((x, y) => x.m - y.m)[0];
  let station: Found | undefined;
  let down = '';
  try {
    const q = `[out:json][timeout:20];(nwr["railway"~"^(station|halt)$"](around:3000,${me.lat.toFixed(4)},${me.lon.toFixed(4)});nwr["public_transport"="station"](around:3000,${me.lat.toFixed(4)},${me.lon.toFixed(4)}););out center tags 20;`;
    station = (await cached(d, q, async () => parseOverpass(await overpass(d, q), me).filter((f) => f.name).slice(0, 8), !tapped(a)))[0];
  } catch {
    down = MAP_DOWN;
  }
  const target = saved && saved.m <= 6000 ? saved : station ? { name: station.name, lat: station.lat, lon: station.lon, m: station.m } : null;
  const bits: string[] = [];
  if (saved) bits.push(`Nearest place you saved: ${saved.name}, ${fmtM(saved.m)} ${compass(me, saved)} (about ${walkMins(saved.m)} min on foot in a straight line).`);
  if (station) bits.push(`Nearest station: ${station.name}, ${fmtM(station.m)} ${compass(me, station)}.`);
  let route: Way | null = null;
  if (target) {
    try {
      route = (await osrm(d, 'routed-foot', [me, target], { steps: true }))[0]!;
      const steps = route.steps.filter((s) => s.distance > 40 || s.maneuver.type === 'depart').slice(0, 7).map((s, i) => `${i + 1}. ${turn(s)} (${fmtM(s.distance)})`);
      bits.push(`The way to ${target.name} on foot: ${(route.distance / 1000).toFixed(1)} km, about ${Math.round(route.duration / 60)} min.\n${steps.join('\n')}`);
    } catch (e) {
      down = (e as Error).message;
    }
  }
  if (!bits.length) return { text: down || 'I can’t find a saved place or a station near that spot. Ask someone nearby, or open your phone’s own maps.' };
  return {
    text: `${bits.join('\n')}${down ? `\n${down}` : ''}\nI only know the spot you gave me once; I’m not tracking you. If you feel unsafe, call 999.`,
    ...(route ? { open: { name: 'show_route', args: { path: thin(route.path, 400).map(([la, lo]) => [Math.round(la * 1e5) / 1e5, Math.round(lo * 1e5) / 1e5]), from: 'where you are', to: target!.name, mode: 'walking', distance_m: route.distance, duration_s: route.duration } } } : {}),
  };
};

// ---------------------------------------------------------------- where I parked, a queue

interface Parked {
  label: string;
  lat?: number;
  lon?: number;
  at: number;
  note?: string;
  until?: number;
  job?: string;
}
const untilText = (p: Parked, d: PackDeps) => (p.until ? ` Paid until ${clockAt(d)(p.until)}.` : '');
const parked: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const kept = await load<Parked | null>(d, OUTSIDE_KEYS.parked, null);
  const tap = tapped(a);
  const placeArg = arg.str(a, 'place', false);
  if (/^(?:clear|forget|delete|reset|cancel)\b/i.test(words)) {
    if (kept?.job) await removeJob(d.storage, kept.job).catch(() => undefined);
    await d.storage.delete(OUTSIDE_KEYS.parked);
    return { text: 'Forgot where the car is.' };
  }
  // asking ("where did I park?", or the sheet's ask with the spot he is at) is not telling ("I parked on …", or the sheet's I PARKED HERE)
  const asking = a.ask === true || a.ask === 'true' || (!placeArg && (/\?\s*$/.test(words) || /^(?:where|which|when|how long)\b/i.test(words)));
  const telling = !asking && (!!placeArg || !!tap || /\b(?:parked|left (?:it|the car)|car (?:is|was) (?:on|at|in|outside))\b/i.test(words));
  const p = telling ? parseParked(words) : { place: '', note: '', ticket: {} as { hm?: string; forMinutes?: number } };
  const label = telling ? placeArg || p.place : '';
  if (telling && !label && !tap) return { text: 'Where? Tell me the street or the car park, like “I parked on Cannon Street until 3pm”, or tap I PARKED HERE in the OUTSIDE sheet and I’ll keep the spot once.', open: sheet('car') };
  if (!telling) {
    if (!kept) return { text: 'I don’t know where the car is: tell me when you park, like “I parked on Cannon Street until 3pm”, or tap I PARKED HERE in the OUTSIDE sheet.', open: sheet('car') };
    const far = tap && kept.lat !== undefined ? ` From the spot you gave me it is about ${fmtM(metresBetween(tap, { lat: kept.lat, lon: kept.lon! }))} ${compass(tap, { lat: kept.lat, lon: kept.lon! })}.` : '';
    return { text: `The car: ${kept.label}, parked ${agoWords(d.now() - kept.at)}.${kept.note ? ` Your note: ${kept.note}.` : ''}${untilText(kept, d)}${far}`, data: { parked: kept } };
  }
  const saved = label ? await savedPlace(d.storage, label) : null;
  const here = tap ?? (saved ? { lat: round4(saved.lat), lon: round4(saved.lon) } : null);
  const rec: Parked = { label: label || 'where you tapped', ...(here ? { lat: here.lat, lon: here.lon } : {}), at: d.now(), ...((arg.str(a, 'note', false) || p.note) ? { note: (arg.str(a, 'note', false) || p.note).slice(0, 160) } : {}) };
  const z = zoned(d.now(), d.tz);
  const hm = /^(\d{1,2}):(\d{2})$/.exec(arg.str(a, 'until', false)) ? arg.str(a, 'until', false) : p.ticket.hm;
  if (hm) {
    let t = fromZoned(z.y, z.m, z.d, +hm.slice(0, 2), +hm.slice(3, 5), d.tz);
    if (t <= d.now()) t += 86_400_000;
    rec.until = t;
  } else if (p.ticket.forMinutes) rec.until = d.now() + p.ticket.forMinutes * 60_000;
  if (kept?.job) await removeJob(d.storage, kept.job).catch(() => undefined);
  let line = '';
  if (rec.until && rec.until - 15 * 60_000 > d.now() + 60_000) {
    try {
      const j = await addJob(d.storage, { kind: 'reminder', title: 'Parking runs out', text: `Your parking at ${rec.label} runs out at ${clockAt(d)(rec.until)}.`, next: rec.until - 15 * 60_000, tz: d.tz }, d.now());
      rec.job = j.id;
      line = ` I’ll remind you 15 minutes before (it’s in your Agenda).`;
    } catch {
      line = '';
    }
  }
  await save(d, OUTSIDE_KEYS.parked, rec);
  return {
    text: `Kept: the car is at ${rec.label}, parked ${clockAt(d)(rec.at)}.${rec.note ? ` Note: ${rec.note}.` : ''}${untilText(rec, d)}${line} Ask “where did I park?” any time. Only the spot you gave me is kept; I’m not tracking you.`,
    cards: [card({ id: 'outside:car', kind: 'brief', at: d.now(), title: 'Where I parked', line: `${rec.label} · ${clockAt(d)(rec.at)}${rec.until ? ` · until ${clockAt(d)(rec.until)}` : ''}`, brief: { icon: 'car' }, acts: [{ label: 'WHERE?', ask: 'Where did I park?' }] })],
    data: { parked: rec },
  };
};

const queue: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const waits = await load<Wait[]>(d, OUTSIDE_KEYS.waits, []);
  if (FORGET.test(words)) {
    const key = forgetKey(words);
    const left = key ? waits.filter((w) => !samePlace(w.place, key)) : [];
    if (!waits.length) return { text: 'I have no queue notes to forget.' };
    if (left.length === waits.length) return { text: `I have no queue notes for ${key}. Say “forget all my queue notes” to clear them all.` };
    await save(d, OUTSIDE_KEYS.waits, left);
    return { text: `Forgot ${waits.length - left.length} queue note${waits.length - left.length === 1 ? '' : 's'}${key ? ` for ${key}` : ''}.` };
  }
  const n = nowClock(d);
  const mins = arg.num(a, 'minutes', NaN);
  const parsed = parseWait(words);
  const place = clean(arg.str(a, 'place', false) || parsed?.place || /\b(?:at|for|in)\s+(?:the\s+)?(.+?)(?:\?|$)/i.exec(words)?.[1] || '').replace(/\s+(?:worth it|bad|long|busy|short|too long|right now|now|today)$/i, '');
  const minutes = Number.isFinite(mins) && mins > 0 ? mins : parsed?.minutes;
  if (place && minutes) {
    waits.push({ place, minutes: Math.round(minutes), at: d.now(), wd: n.wd, hour: n.hour });
    await save(d, OUTSIDE_KEYS.waits, waits.slice(-200));
    const have = waits.filter((w) => samePlace(w.place, place)).length;
    return { text: `Kept: the queue at ${place} was ${Math.round(minutes)} minutes (${have} note${have === 1 ? '' : 's'} for it now). I only ever use your own notes.` };
  }
  if (!place) {
    const names = [...new Set(waits.map((w) => w.place))];
    return { text: names.length ? `You’ve told me about queues at: ${names.join(', ')}. Ask “is the queue at ${names[0]} worth it?” or tell me a new one.` : 'I have no queue notes yet. After you’ve queued, say “the queue at the post office was 20 minutes”, and I’ll use your notes to say whether to go. I can’t see anyone else’s queue.' };
  }
  const e = queueEstimate(waits, place, n.wd, n.hour);
  if (!e) return { text: `I have no notes about the queue at ${place}, so I won’t guess. After you go, say “the queue at ${place} was 20 minutes” and I’ll keep it.` };
  return { text: `From your ${e.n} note${e.n === 1 ? '' : 's'} about ${place}${e.basis === 'around this time' ? ' at about this time of day' : ''}: ${e.low === e.high ? `${e.low} minutes` : `${e.low}–${e.high} minutes, middle ${e.median}`}. ${e.median <= 10 ? 'Usually short: go.' : `Go if you can spare about ${e.high}.`} An estimate from your own notes only; I can’t see today’s queue.` };
};

export const OUTSIDE: Record<string, ActionFn> = { note, carriage, parking, safewalk, lasthome, open, toilets, cash, refill, rain, split, halfway, pack, parked, lost, queue };
export const OUTSIDE_ACTIONS = Object.keys(OUTSIDE);

export const outsideTools: Tool[] = [
  packTool({
    name: 'outside',
    description:
      'His outside pack, for a day out and about: never live GPS (a saved place, a name he gives, or the phone\'s one-time spot from the sheet); prices, hours and rules are volunteers\' notes or the sign\'s, said so. note: keep a note about a place (place, words). carriage: which carriage (place), his notes only. parking: car parks near a place (near). safewalk: a walk scored against police reports, said as "fewer reports", never "safe" (from, to). lasthome: the last train or bus (from, to, mode). open: what is open now (near, what). toilets, cash, refill: near a place. rain: the rain plan and a coat (near). split: a fare split, who owes whom (words). halfway: a midpoint by travel time (from, with, mode). pack: a bag by the day and the weather (plan, near). parked: keep where he parked, or say where the car is (words, place, note, until). lost: nearest saved place and station (near). queue: keep or use his own queue notes (place, minutes).',
    actions: OUTSIDE,
    properties: {
      words: { type: 'string', description: 'his words for it, as he said them' },
      place: { type: 'string', description: 'a place or station by name: note, carriage, parked, queue' },
      near: { type: 'string', description: 'a saved place ("home", "work") or a place he named; never his live position' },
      from: { type: 'string', description: 'safewalk, lasthome, halfway: where from' },
      to: { type: 'string', description: 'safewalk, lasthome: where to (default home)' },
      with: { type: 'string', description: 'halfway: the other place' },
      what: { type: 'string', description: 'open: pharmacy, coffee, pub, food, shop, petrol' },
      mode: { type: 'string', enum: ['train', 'bus', 'tram', 'driving', 'walking', 'cycling'], description: 'lasthome, halfway' },
      plan: { type: 'string', description: 'pack: what the day is' },
      note: { type: 'string', description: 'parked: a rule he adds ("free after 6")' },
      until: { type: 'string', description: 'parked: HH:MM the ticket runs to' },
      minutes: { type: 'number', description: 'queue: how long the wait was' },
      total: { type: 'number', description: 'split: the total in pounds' },
      people: { type: 'array', items: { type: 'string' }, description: 'split: who shares it' },
    },
    reads: ['carriage', 'parking', 'safewalk', 'lasthome', 'open', 'toilets', 'cash', 'refill', 'rain', 'split', 'halfway', 'pack', 'lost'],
  }),
];

/** The Brief's outside line (mind.ts): a parking ticket that runs out within two hours. */
export async function outsideLines(d: PackDeps): Promise<string[]> {
  const kept = await load<Parked | null>(d, OUTSIDE_KEYS.parked, null);
  if (!kept?.until || kept.until < d.now() || kept.until > d.now() + 2 * 3_600_000) return [];
  return [`Parking at ${kept.label} runs out at ${clockAt(d)(kept.until)}`];
}
