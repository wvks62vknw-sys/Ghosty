/**
 * Public-transport journeys: Transitous (transitous.org), a community-run MOTIS router over the
 * open timetables operators publish (GTFS, with live GTFS-realtime where there is one). Free, no
 * key, no account. From here: a geocoder that knows stops and stations as well as places, a
 * door-to-door planner (walking plus bus, tram, train, metro, coach, ferry) with live times where
 * the operator gives them, and the next departures from a stop. The phone never calls Transitous
 * itself: the GO panel asks /api/journey (journeyRoute below) and the chat tools in
 * tools/journey.ts ask from here, so the interface's security policy stays as it is.
 *
 * Calls per turn stay small: a journey is at most two geocodes and one plan; departures are one
 * geocode and one stop-times call. Geocoder answers are kept for ten minutes.
 */
import type { Journey, JourneyAnswer, JourneyLeg, JourneyMode, JourneyPlace } from '../../../../packages/shared/src/protocol';
import { fromZoned, parseWhen, safeTz, zoned } from '../time';
import { ownerPlace } from '../tools/travel';
import type { ToolContext } from '../tools/types';

const BASE = 'https://api.transitous.org/api/v1';
const HEADERS = { Accept: 'application/json', 'User-Agent': 'Ghosty/2.0 (personal assistant; single user)' };
export const CREDIT = 'Powered by Transitous (transitous.org) and the open timetables operators publish.';
/** A leg's shape longer than this (an encoded polyline) is left out; the phone draws stop to stop instead. */
const MAX_POINTS = 24_000;
/** Most intermediate stops kept per leg. */
const MAX_STOPS = 80;
/** A walk all the way is offered as an option only up to this long. */
const MAX_DIRECT_WALK_S = 45 * 60;

/** A problem the owner can read as it is (place not found, time not understood, planner down). */
export class JourneyError extends Error {}

export interface Place extends JourneyPlace {
  type: 'STOP' | 'PLACE' | 'ADDRESS';
  /** The town or area the geocoder files it under ("Birmingham"). */
  area: string;
}

// ---- What the router answers (the fields read here; everything else is ignored).
interface RawPlace {
  name?: string;
  stopId?: string;
  lat?: number;
  lon?: number;
  departure?: string;
  scheduledDeparture?: string;
  arrival?: string;
  scheduledArrival?: string;
  track?: string;
  scheduledTrack?: string;
}
interface RawLeg {
  mode?: string;
  from?: RawPlace;
  to?: RawPlace;
  duration?: number;
  distance?: number;
  startTime?: string;
  endTime?: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  realTime?: boolean;
  cancelled?: boolean;
  routeShortName?: string;
  routeColor?: string;
  headsign?: string;
  agencyName?: string;
  intermediateStops?: RawPlace[];
  legGeometry?: { points?: string; precision?: number; length?: number };
}
interface RawItinerary {
  duration?: number;
  startTime?: string;
  endTime?: string;
  transfers?: number;
  legs?: RawLeg[];
}
interface RawPlan {
  itineraries?: RawItinerary[];
  direct?: RawItinerary[];
}
interface RawGeocode {
  type?: string;
  name?: string;
  id?: string;
  lat?: number;
  lon?: number;
  areas?: { name?: string; default?: boolean; matched?: boolean }[];
}
interface RawStopTime {
  place?: RawPlace;
  mode?: string;
  realTime?: boolean;
  headsign?: string;
  routeShortName?: string;
  routeColor?: string;
  agencyName?: string;
  cancelled?: boolean;
  tripCancelled?: boolean;
}
interface RawStopTimes {
  stopTimes?: RawStopTime[];
  place?: RawPlace;
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const pad = (n: number) => String(n).padStart(2, '0');
const toRad = Math.PI / 180;
const km = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const x = Math.sin(((b.lat - a.lat) * toRad) / 2) ** 2 + Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(((b.lon - a.lon) * toRad) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(x)));
};

async function ask<T>(path: string, params: Record<string, string | number | boolean | undefined>): Promise<T> {
  const u = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') u.searchParams.set(k, String(v));
  let r: Response;
  try {
    r = await fetch(u.toString(), { headers: HEADERS });
  } catch {
    throw new JourneyError("The journey planner (Transitous) isn't reachable right now; try again in a minute.");
  }
  if (r.status === 429) throw new JourneyError('The journey planner (Transitous) asked us to slow down; try again in a minute.');
  if (!r.ok) {
    const why = (await r.text().catch(() => '')).match(/"error"\s*:\s*"([^"]{1,120})"/);
    throw new JourneyError(`The journey planner (Transitous) answered ${r.status}${why ? ` (${why[1]})` : ''}; try again in a minute.`);
  }
  return (await r.json()) as T;
}

// ---- Places.

const geoCache = new Map<string, { at: number; list: Place[] }>();
const GEO_TTL = 10 * 60_000;

/**
 * Stops, stations, addresses and places matching `text`, best first; anything within 150 km of
 * `near` comes before namesakes elsewhere (the geocoder's own bias is mild: "Moseley Village"
 * also finds one in Massachusetts). `type: 'STOP'` asks for stops only.
 */
export async function geocode(text: string, near?: { lat: number; lon: number } | null, type?: 'STOP'): Promise<Place[]> {
  const q = text.trim().replace(/\s+/g, ' ');
  const key = `${type ?? ''}|${q.toLowerCase()}|${near ? `${near.lat.toFixed(2)},${near.lon.toFixed(2)}` : ''}`;
  const hit = geoCache.get(key);
  if (hit && Date.now() - hit.at < GEO_TTL) return hit.list;
  const raw = await ask<RawGeocode[]>('geocode', { text: q, language: 'en', type, place: near ? `${near.lat.toFixed(5)},${near.lon.toFixed(5)}` : undefined });
  const list: Place[] = [];
  for (const m of Array.isArray(raw) ? raw : []) {
    if (!m || typeof m !== 'object' || !str(m.name) || typeof m.lat !== 'number' || typeof m.lon !== 'number' || !Number.isFinite(m.lat) || !Number.isFinite(m.lon)) continue;
    const t: Place['type'] = m.type === 'STOP' || m.type === 'ADDRESS' ? m.type : 'PLACE';
    const areas = Array.isArray(m.areas) ? m.areas : [];
    const area = str(areas.find((a) => a?.default)?.name) || str(areas.find((a) => a?.matched)?.name);
    list.push({ type: t, name: str(m.name), area, lat: m.lat, lon: m.lon, ...(t === 'STOP' && str(m.id) ? { stopId: str(m.id) } : {}) });
  }
  if (near) list.sort((a, b) => Number(km(near, b) < 150) - Number(km(near, a) < 150));
  const kept = list.slice(0, 6);
  geoCache.set(key, { at: Date.now(), list: kept });
  if (geoCache.size > 60) geoCache.delete(geoCache.keys().next().value!);
  return kept;
}

export const _testing = { resetCache: () => geoCache.clear() };

const HERE = /^(here|my (?:location|position|place)|where i am|current location|home|my home)$/i;
const COORDS = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;

/**
 * The owner's words for a place → one place: "here" (or nothing) is where they are, "lat,lon"
 * is that point, anything else is looked up (nearest the owner, or `near`, first). Plain words
 * when it cannot be done.
 */
export async function resolvePlace(text: string, ctx: Pick<ToolContext, 'storage'>, near?: { lat: number; lon: number } | null): Promise<Place> {
  const q = text.trim();
  if (!q || HERE.test(q)) {
    const me = await ownerPlace(ctx);
    if (!me) throw new JourneyError("I don't know where you are yet: open God's Eye once so I know where you are, or name the place.");
    return { type: 'PLACE', area: '', name: me.name, lat: me.lat, lon: me.lon };
  }
  const c = q.match(COORDS);
  if (c) {
    const lat = Number(c[1]);
    const lon = Number(c[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { type: 'PLACE', area: '', name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, lat, lon };
  }
  const bias = near ?? (await ownerPlace(ctx).catch(() => null));
  const list = await geocode(q, bias);
  const best = list[0];
  if (!best) throw new JourneyError(`I couldn't find "${q}": try the name of a stop, a station, a street or a town.`);
  return best;
}

// ---- When.

const CLOCK = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/;

/**
 * The owner's words for a time → when to leave (or, with "arrive by…", when to arrive), UTC ms:
 * "now", "08:30", "5pm", "arrive by 09:00", "tomorrow 07:45", "in 20 minutes", "2026-10-17T08:30"
 * (local to `tz`). A clock time that has passed today means tomorrow.
 */
export function whenToTime(when: string, tz: string, arriveBy = false, now = Date.now()): { time: number; arriveBy: boolean } {
  let s = when.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s || /^(now|asap|right now|as soon as possible|next)$/.test(s)) return { time: now, arriveBy };
  // The longer forms first: "arrive by" must not be read as "arrive" with a time of "by 09:00".
  let m = s.match(/^(?:arriv(?:e|ing)(?: by| at)?|get there by|be there by|there by|by)\s+(.+)$/);
  if (m) {
    arriveBy = true;
    s = m[1]!;
  } else if ((m = s.match(/^(?:leav(?:e|ing)(?: at)?|depart(?:ing)?(?: at)?|at|from)\s+(.+)$/))) s = m[1]!;
  if ((m = s.match(/^in (\d{1,3}) ?(min|mins|minutes?|h|hr|hrs|hours?)$/))) return { time: now + Number(m[1]) * (/^h/.test(m[2]!) ? 3600_000 : 60_000), arriveBy };
  let days = 0;
  if ((m = s.match(/^(today|tomorrow|tonight)\b\s*(?:at\s+)?(.*)$/))) {
    days = m[1] === 'tomorrow' ? 1 : 0;
    s = m[2]!.trim() || (m[1] === 'tonight' ? '19:00' : '08:00');
  }
  if ((m = s.match(CLOCK))) {
    let h = Number(m[1]);
    const mi = Number(m[2] ?? 0);
    if (m[3] === 'pm' && h < 12) h += 12;
    if (m[3] === 'am' && h === 12) h = 0;
    if (h > 23 || mi > 59) throw new JourneyError(`"${when.trim()}" is not a time of day: try "08:30" or "5pm".`);
    const z = zoned(now, tz);
    let t = fromZoned(z.y, z.m, z.d + days, h, mi, tz);
    if (t <= now) t = fromZoned(z.y, z.m, z.d + days + 1, h, mi, tz);
    return { time: t, arriveBy };
  }
  const t = parseWhen(s, tz, now);
  if (t !== null) return { time: t + days * 86_400_000, arriveBy };
  throw new JourneyError(`I didn't understand the time "${when.trim()}": try "now", "08:30", "arrive by 09:00", "tomorrow 07:45" or "in 20 minutes".`);
}

// ---- Journeys.

const MODES: Record<string, JourneyMode> = {
  WALK: 'walk',
  BUS: 'bus',
  COACH: 'bus',
  TRAM: 'tram',
  SUBWAY: 'subway',
  METRO: 'subway',
  FERRY: 'ferry',
  RAIL: 'rail',
  HIGHSPEED_RAIL: 'rail',
  LONG_DISTANCE: 'rail',
  NIGHT_RAIL: 'rail',
  REGIONAL_FAST_RAIL: 'rail',
  REGIONAL_RAIL: 'rail',
  SUBURBAN: 'rail',
};

/** The kinds the owner can ask for, as the router's mode words. */
export const KINDS: Record<string, string[]> = {
  bus: ['BUS', 'COACH'],
  coach: ['COACH'],
  tram: ['TRAM'],
  train: ['RAIL'],
  rail: ['RAIL'],
  metro: ['SUBWAY'],
  subway: ['SUBWAY'],
  underground: ['SUBWAY'],
  tube: ['SUBWAY'],
  ferry: ['FERRY'],
};

const colour = (v: unknown): string => (typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test(v.trim()) ? `#${v.trim().replace('#', '').toLowerCase()}` : '');

function place(p: RawPlace | undefined): JourneyPlace {
  const id = str(p?.stopId);
  return { name: str(p?.name), lat: num(p?.lat), lon: num(p?.lon), ...(id ? { stopId: id } : {}) };
}

function leg(l: RawLeg): JourneyLeg {
  const kind = str(l.mode).toUpperCase() || 'OTHER';
  const g = l.legGeometry;
  const points = typeof g?.points === 'string' && g.points.length <= MAX_POINTS ? g.points : '';
  const start = str(l.startTime);
  const end = str(l.endTime);
  return {
    mode: MODES[kind] ?? 'other',
    kind,
    line: str(l.routeShortName),
    color: colour(l.routeColor),
    headsign: str(l.headsign),
    agency: str(l.agencyName),
    from: place(l.from),
    to: place(l.to),
    start,
    end,
    scheduledStart: str(l.scheduledStartTime) || start,
    scheduledEnd: str(l.scheduledEndTime) || end,
    realTime: l.realTime === true,
    cancelled: l.cancelled === true,
    duration: Math.round(num(l.duration)),
    distance: Math.round(num(l.distance)),
    track: str(l.from?.track) || str(l.from?.scheduledTrack),
    stops: (Array.isArray(l.intermediateStops) ? l.intermediateStops : []).slice(0, MAX_STOPS).map(place),
    points,
    precision: typeof g?.precision === 'number' && g.precision >= 4 && g.precision <= 9 ? g.precision : 7,
  };
}

/** One of the router's itineraries in the compact shape; the owner's own words replace its "START" and "END". */
export function compactItinerary(it: RawItinerary, id: string, from: JourneyPlace, to: JourneyPlace): Journey {
  const legs = (Array.isArray(it.legs) ? it.legs : []).slice(0, 14).map(leg);
  const first = legs[0];
  const last = legs[legs.length - 1];
  if (first && (!first.from.name || /^START$/i.test(first.from.name))) first.from.name = from.name;
  if (last && (!last.to.name || /^END$/i.test(last.to.name))) last.to.name = to.name;
  return { id, start: str(it.startTime) || first?.start || '', end: str(it.endTime) || last?.end || '', duration: Math.round(num(it.duration)), transfers: Math.round(num(it.transfers)), legs };
}

export interface PlanRequest {
  from: JourneyPlace;
  to: JourneyPlace;
  /** UTC ms: when to leave, or (arriveBy) when to be there. */
  time: number;
  arriveBy?: boolean;
  maxTransfers?: number;
  /** The router's mode words to allow (BUS, TRAM, RAIL, SUBWAY, FERRY, COACH); default: all. */
  modes?: string[];
}

const iso = (ms: number) => new Date(Math.floor(ms / 1000) * 1000).toISOString().replace('.000Z', 'Z');

/** Up to five journeys, soonest first — plus a walk all the way when the router found one that is short enough (first when it beats every ride). */
export async function plan(req: PlanRequest): Promise<Journey[]> {
  const at = (p: JourneyPlace) => p.stopId || `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;
  const raw = await ask<RawPlan>('plan', {
    fromPlace: at(req.from),
    toPlace: at(req.to),
    time: iso(req.time),
    arriveBy: req.arriveBy ? 'true' : undefined,
    numItineraries: 5,
    maxTransfers: typeof req.maxTransfers === 'number' && req.maxTransfers >= 0 ? Math.min(6, Math.round(req.maxTransfers)) : undefined,
    transitModes: req.modes?.length ? [...new Set(req.modes)].join(',') : undefined,
  });
  const out = (Array.isArray(raw.itineraries) ? raw.itineraries : [])
    .filter((it) => it && typeof it === 'object')
    .slice(0, 5)
    .map((it, i) => compactItinerary(it, String(i + 1), req.from, req.to))
    .filter((j) => j.legs.length > 0);
  const walk = (Array.isArray(raw.direct) ? raw.direct : [])
    .filter((it) => it && typeof it === 'object')
    .map((it) => compactItinerary(it, 'walk', req.from, req.to))
    .find((j) => j.legs.length > 0 && j.legs.every((l) => l.mode === 'walk') && j.duration > 0 && j.duration <= MAX_DIRECT_WALK_S);
  if (walk) {
    walk.direct = true;
    if (!out.length || walk.duration <= Math.min(...out.map((j) => j.duration))) out.unshift(walk);
    else out.push(walk);
  }
  return out.slice(0, 6).map((j, i) => ({ ...j, id: String(i + 1) }));
}

// ---- Words.

/** "08:12" in the owner's zone. */
export function hhmm(isoTime: string, tz: string): string {
  const t = Date.parse(isoTime);
  if (!Number.isFinite(t)) return '--:--';
  const z = zoned(t, tz);
  return `${pad(z.h)}:${pad(z.mi)}`;
}

export const minutes = (s: number): string => {
  const m = Math.max(0, Math.round(s / 60));
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
};

const metres = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);

/** Seconds late (negative: early) for a live leg, from its live and timetabled departure; 0 when not live. */
export function delaySeconds(l: Pick<JourneyLeg, 'realTime' | 'start' | 'scheduledStart'>): number {
  if (!l.realTime) return 0;
  const a = Date.parse(l.start);
  const b = Date.parse(l.scheduledStart);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((a - b) / 1000) : 0;
}

export function delayWords(s: number): string {
  if (Math.abs(s) < 60) return 'on time';
  const m = Math.round(Math.abs(s) / 60);
  return `${m} min ${s > 0 ? 'late' : 'early'}`;
}

const WORDS: Record<JourneyMode, string> = { walk: 'walk', bus: 'bus', tram: 'tram', rail: 'train', subway: 'metro', ferry: 'ferry', other: 'ride' };

/** "bus", "train", "coach"… for a leg. */
export function modeWord(l: Pick<JourneyLeg, 'mode' | 'kind'>): string {
  if (l.kind === 'COACH') return 'coach';
  if (l.mode === 'other') return l.kind.toLowerCase().replace(/_/g, ' ') || 'ride';
  return WORDS[l.mode];
}

const liveNote = (l: JourneyLeg): string => {
  if (l.cancelled) return ' — CANCELLED';
  if (!l.realTime) return '';
  const d = delaySeconds(l);
  return Math.abs(d) < 60 ? ' (live)' : ` (live: ${delayWords(d)})`;
};

const changes = (j: Journey): string => (j.direct ? 'walk all the way' : j.transfers === 0 ? 'no changes' : j.transfers === 1 ? '1 change' : `${j.transfers} changes`);

/** What the boarding point is called: a platform for a train, a stop for the rest. */
export const standWord = (l: Pick<JourneyLeg, 'mode'>): string => (l.mode === 'rail' || l.mode === 'subway' ? 'platform' : 'stop');

/**
 * The journeys as numbered lines the owner (and the model) can read:
 *   1. 08:12 → 08:51 · 39 min · 1 change: walk 4 min to Corporation St (stop CS3) → bus 50 towards
 *   Druids Heath at 08:16 (live: 2 min late), 12 stops, get off at Moseley Village 08:40 → walk 3 min
 */
export function format(list: Journey[], tz: string): string {
  return list
    .map((j, n) => {
      const head = `${n + 1}. ${hhmm(j.start, tz)} → ${hhmm(j.end, tz)} · ${minutes(j.duration)} · ${changes(j)}`;
      if (j.direct) return `${head}${j.legs[0]?.distance ? ` (${metres(j.legs.reduce((s, l) => s + l.distance, 0))})` : ''}`;
      const steps = j.legs.map((l, i) => {
        const next = j.legs[i + 1];
        const prev = j.legs[i - 1];
        if (l.mode === 'walk') {
          const last = i === j.legs.length - 1;
          const stand = next?.track ? ` (${standWord(next)} ${next.track})` : '';
          return `walk ${minutes(l.duration)}${last ? '' : ` to ${l.to.name}${stand}`}`;
        }
        const rode = l.stops.length + 1;
        const from = !prev || prev.to.name !== l.from.name ? ` from ${l.from.name}${l.track ? ` (${standWord(l)} ${l.track})` : ''}` : '';
        const towards = l.headsign ? ` towards ${l.headsign}` : '';
        return `${modeWord(l)} ${l.line || l.agency}${towards}${from} at ${hhmm(l.start, tz)}${liveNote(l)}, ${rode} stop${rode === 1 ? '' : 's'}, get off at ${l.to.name} ${hhmm(l.end, tz)}`;
      });
      return `${head}: ${steps.join(' → ')}`;
    })
    .join('\n');
}

// ---- Departures.

export interface Departure {
  line: string;
  mode: JourneyMode;
  kind: string;
  color: string;
  headsign: string;
  agency: string;
  stop: JourneyPlace;
  track: string;
  /** Live when `realTime`, else the timetable; ISO 8601. */
  time: string;
  scheduled: string;
  realTime: boolean;
  cancelled: boolean;
}

/** Next departures from a stop (by id), or from every stop within `radiusM` of a point. */
export async function departures(at: { stopId?: string; lat?: number; lon?: number }, n = 10, opts: { time?: number; radiusM?: number } = {}): Promise<{ place: JourneyPlace; list: Departure[] }> {
  const byPoint = !at.stopId && typeof at.lat === 'number' && typeof at.lon === 'number';
  const raw = await ask<RawStopTimes>('stoptimes', {
    stopId: at.stopId || undefined,
    center: byPoint ? `${at.lat!.toFixed(5)},${at.lon!.toFixed(5)}` : undefined,
    radius: byPoint ? Math.round(opts.radiusM ?? 400) : undefined,
    n: Math.max(1, Math.min(30, Math.round(n))),
    time: opts.time ? iso(opts.time) : undefined,
  });
  const list: Departure[] = [];
  for (const s of Array.isArray(raw.stopTimes) ? raw.stopTimes : []) {
    if (!s || typeof s !== 'object') continue;
    const kind = str(s.mode).toUpperCase() || 'OTHER';
    const p = s.place;
    const scheduled = str(p?.scheduledDeparture) || str(p?.departure);
    list.push({
      line: str(s.routeShortName),
      mode: MODES[kind] ?? 'other',
      kind,
      color: colour(s.routeColor),
      headsign: str(s.headsign),
      agency: str(s.agencyName),
      stop: place(p),
      track: str(p?.track) || str(p?.scheduledTrack),
      time: str(p?.departure) || scheduled,
      scheduled,
      realTime: s.realTime === true,
      cancelled: s.cancelled === true || s.tripCancelled === true,
    });
  }
  list.sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  return { place: place(raw.place), list: list.slice(0, n) };
}

/** "live", "live: 3 min late", "CANCELLED" or '' for a departure. */
function liveWords(d: Departure): string {
  if (d.cancelled) return 'CANCELLED';
  if (!d.realTime) return '';
  const s = delaySeconds({ realTime: true, start: d.time, scheduledStart: d.scheduled });
  return Math.abs(s) < 60 ? 'live' : `live: ${delayWords(s)}`;
}

/** Departures as lines: "- 08:16 bus 50 towards Druids Heath, from Corporation St (stop CS3), live: 2 min late". */
export function formatDepartures(list: Departure[], tz: string): string {
  return list
    .map((d) => {
      const live = liveWords(d);
      return `- ${hhmm(d.time, tz)} ${modeWord(d)} ${d.line || d.agency}${d.headsign ? ` towards ${d.headsign}` : ''}, from ${d.stop.name}${d.track ? ` (${standWord(d)} ${d.track})` : ''}${live ? `, ${live}` : ''}`;
    })
    .join('\n');
}

// ---- The phone's route.

const plain = (p: Place): JourneyPlace => ({ name: p.name, lat: p.lat, lon: p.lon, ...(p.stopId ? { stopId: p.stopId } : {}) });

/**
 * GET /journey?from=&to=&time=&arriveBy=&tz= — what the GO panel asks. `from` and `to` are the
 * owner's words ("here", "lat,lon", a name); `time` is "now", a local YYYY-MM-DDTHH:MM or any form
 * whenToTime takes; `tz` is the phone's zone. Problems come back as plain words with status 400.
 */
export async function journeyRoute(url: URL, ctx: Pick<ToolContext, 'storage'>): Promise<Response> {
  const q = (k: string) => (url.searchParams.get(k) ?? '').trim().slice(0, 200);
  const tz = safeTz(q('tz') || (await ctx.storage.get<{ tz?: string }>('owner:ctx').catch(() => undefined))?.tz);
  try {
    if (!q('to')) return Response.json({ error: 'Say where to go.' }, { status: 400 });
    const when = whenToTime(q('time'), tz, q('arriveBy') === 'true');
    const from = await resolvePlace(q('from'), ctx);
    const to = await resolvePlace(q('to'), ctx, from);
    const itineraries = await plan({ from, to, time: when.time, arriveBy: when.arriveBy });
    const answer: JourneyAnswer = { from: plain(from), to: plain(to), tz, time: iso(when.time), arriveBy: when.arriveBy, itineraries };
    if (!itineraries.length) answer.note = `No journeys found between ${from.name} and ${to.name} at that time: try another time, or a different place name.`;
    return Response.json(answer);
  } catch (e) {
    if (e instanceof JourneyError) return Response.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
