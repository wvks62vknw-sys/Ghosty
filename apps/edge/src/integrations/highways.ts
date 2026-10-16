/**
 * National Highways live incidents (England's motorways and main A roads) and the usual speed at
 * this time of day on West Midlands stretches.
 *
 * Live incidents come from the keyless JSON behind nationalhighways.co.uk's live-updates page.
 * It is an undocumented site API, so every field is treated as optional, the last good answer is
 * kept for three minutes and it is never polled faster than that. When it fails, the public
 * travel-alerts RSS (breaking news: major incidents only) stands in. Events carry no coordinates:
 * West Midlands ones are placed at their junctions (apps/web/src/data/wm/junctions.ts), the rest
 * stay unplaced. The site's information is Crown copyright under the Open Government Licence
 * v3.0, so HIGHWAYS_CREDIT travels with every answer.
 *
 * Typical speeds are the phone's static /data/wm-typical.json: averages by weekday and
 * quarter-hour from past traffic counts — a picture of a normal day, never live.
 */
import { WM_JUNCTIONS } from '../../../web/src/data/wm/junctions';
import { km } from './traffic';

export const HIGHWAYS_CREDIT = 'Contains public sector information licensed under the Open Government Licence v3.0 (National Highways)';
const API = 'https://nationalhighways.co.uk/trafficsearchapi/events';
const RSS = 'https://nationalhighways.co.uk/travel-alerts-rss';
/** Never ask National Highways for the same list more often than this. */
export const CACHE_MS = 3 * 60_000;
/** The typical-speeds file changes rarely: keep it for a day. */
export const TYPICAL_MS = 24 * 3600_000;
const UA = { 'User-Agent': 'Ghosty/2.0 (personal assistant; single user)' };

/** Roughly the West Midlands: Stoke to Worcester, Telford to Rugby. */
export const WM_BOX = { s: 52.2, n: 52.8, w: -2.5, e: -1.2 };
export const inWestMidlands = (lat: number, lon: number): boolean => lat >= WM_BOX.s && lat <= WM_BOX.n && lon >= WM_BOX.w && lon <= WM_BOX.e;

export interface RoadEvent {
  id: string;
  road: string;
  direction: string;
  title: string;
  location: string;
  reason: string;
  type: string;
  /** Delay in seconds (0 when not given). */
  delayS: number;
  lanesClosed: string;
  /** Junction refs from the title, like 'J6' and 'J5' ('' when none). */
  from: string;
  to: string;
  lat: number | null;
  lon: number | null;
  start: number | null;
  updated: number | null;
  /** When it should clear, as the site words it (or HH:MM UK time), '' when unknown. */
  normalBy: string;
  status: string;
}

export type Junctions = Record<string, Record<string, [number, number, string]>>;

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
};
const when = (v: unknown): number | null => {
  const s = str(v);
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
};
const pad = (n: number) => String(n).padStart(2, '0');

/** HH:MM in UK local time (Europe/London), '' when the time is unknown. */
export function ukTime(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return '';
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${pad(+get('hour') % 24)}:${get('minute')}`;
}

/** 'A38M' → 'A38(M)', 'M6 Toll' → 'M6 TOLL', 'm42' → 'M42'; anything else upper-cased as given. */
export function roadName(s: string): string {
  const u = s.trim().toUpperCase().replace(/\s+/g, ' ');
  const m = u.match(/^([AM])\s?(\d{1,4})(\s?\(?M\)?)?(\s?TOLL)?$/);
  if (!m) return u;
  const base = `${m[1]}${m[2]}`;
  if (m[1] === 'A' && m[3]) return `${base}(M)`;
  if (m[4]) return `${base} TOLL`;
  return base;
}

/** The road's name for the site API (it spells A38(M) as A38M). */
const apiRoad = (road: string) => road.replace(/\((M)\)$/, '$1').replace(/ TOLL$/, ' Toll');

/** The first road named in a text ('M6', 'M6 TOLL', 'A38(M)'), or ''. */
export function roadFrom(text: string): string {
  const m = text.match(/\b(M\d{1,3}(?:\s?toll\b)?|A\d{1,4}(?:\(M\)|M\b)?)/i);
  return m ? roadName(m[1]!) : '';
}

const DIRS: Record<string, string> = {
  N: 'northbound', S: 'southbound', E: 'eastbound', W: 'westbound', CW: 'clockwise', ACW: 'anticlockwise',
  NB: 'northbound', SB: 'southbound', EB: 'eastbound', WB: 'westbound', BOTH: 'both directions',
};

/** A direction code (N, S, CW…) or the direction worded in a text, as plain words. */
export function direction(code: string, text = ''): string {
  const c = code.trim().toUpperCase();
  if (DIRS[c]) return DIRS[c]!;
  const m = `${code} ${text}`.match(/\b((?:north|south|east|west)bound|anti-?clockwise|clockwise|both directions)\b/i);
  return m ? m[1]!.toLowerCase().replace('anti-clockwise', 'anticlockwise') : code.trim().toLowerCase();
}

/** Junction refs in order of appearance: "between J6 and J5" → ['6', '5']; "junctions J20A and J18" → ['20A', '18']; "T3" → ['T3']. */
export function junctionRefs(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\bJ\s?(\d{1,2}[A-Z]?)\b|\bjunctions?\s+(\d{1,2}[A-Z]?)\b|\b(T\d{1,2})\b/gi)) {
    const ref = (m[1] ?? m[2] ?? m[3] ?? '').toUpperCase();
    if (ref && !out.includes(ref)) out.push(ref);
  }
  return out;
}

/** One event from the site API, every field optional. Null for things that are not events at all. */
function parseEvent(raw: unknown): RoadEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const title = str(r.title);
  const location = str(r.location);
  const road = roadName(str(r.road)) || roadFrom(title) || roadFrom(location);
  if (!title && !road) return null;
  const normalAt = when(r.returnToNormal);
  return {
    id: str(r.id) || `${road} ${title}`.trim().slice(0, 80),
    road,
    direction: direction(str(r.direction), `${title} ${location}`),
    title,
    location,
    reason: str(r.reason),
    type: str(r.type),
    delayS: Math.max(0, Math.round(num(r.delay))),
    lanesClosed: str(r.lanesClosedText) || str(r.lanesClosed),
    from: '',
    to: '',
    lat: null,
    lon: null,
    start: when(r.overallStartTime) ?? when(r.createdDate),
    updated: when(r.updatedDate),
    normalBy: str(r.returnToNormalText) || (normalAt !== null ? ukTime(normalAt) : ''),
    status: str(r.status) || (r.isActive === false ? 'ended' : 'active'),
  };
}

/** Events from the site API's answer ({ data: [...] } or a bare list), mapped defensively; events marked inactive are left out. */
export function parseEvents(json: unknown): RoadEvent[] {
  const list: unknown[] = Array.isArray(json) ? json : json && typeof json === 'object' && Array.isArray((json as { data?: unknown }).data) ? ((json as { data: unknown[] }).data) : [];
  const out: RoadEvent[] = [];
  for (const raw of list) {
    if (raw && typeof raw === 'object' && (raw as { isActive?: unknown }).isActive === false) continue;
    const e = parseEvent(raw);
    if (e) out.push(e);
  }
  return out;
}

/**
 * Pin an event to the map: the junctions named in its title ("between J6 and J5", "at J6",
 * "J4A to J5", "between junctions J20A and J18"; the location text when the title names none)
 * looked up on its road, lat/lon at the midpoint of the two (or the one). Null when the road or
 * its junctions are not in the table.
 */
export function placeEvent(e: RoadEvent, junctions: Junctions = WM_JUNCTIONS): RoadEvent {
  const road = roadName(e.road) || roadFrom(e.title) || roadFrom(e.location);
  const refs = junctionRefs(e.title).length ? junctionRefs(e.title) : junctionRefs(e.location);
  const from = refs[0] ?? '';
  const to = refs[1] ?? '';
  const table = junctions[road];
  const pts = [from, to].filter(Boolean).map((ref) => table?.[ref]).filter((p): p is [number, number, string] => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
  const r5 = (n: number) => Math.round(n * 1e5) / 1e5;
  const lat = pts.length ? r5(pts.reduce((s, p) => s + p[0], 0) / pts.length) : null;
  const lon = pts.length ? r5(pts.reduce((s, p) => s + p[1], 0) / pts.length) : null;
  return { ...e, road, from: from ? `J${from}`.replace(/^JT/, 'T') : '', to: to ? `J${to}`.replace(/^JT/, 'T') : '', lat, lon };
}

const ENTITY: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
/** Plain text from a feed field: CDATA unwrapped, tags dropped, entities decoded, spaces squashed. */
function plain(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<br\s*\/?>|<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, code: string) => {
      const c = code.toLowerCase();
      if (c.startsWith('#x')) return String.fromCodePoint(parseInt(c.slice(2), 16) || 32);
      if (c.startsWith('#')) return String.fromCodePoint(parseInt(c.slice(1), 10) || 32);
      return ENTITY[c] ?? all;
    })
    .replace(/\s+/g, ' ')
    .trim();
}
const tag = (block: string, name: string): string => {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}\\s*>`, 'i'));
  return m ? plain(m[1]!) : '';
};

/** "delays of up to 40 minutes" / "a delay of 1 hour" worded in a text, in seconds (0 when none). */
function delayIn(text: string): number {
  const m = text.match(/delays?\s+(?:of\s+)?(?:up\s+to\s+|around\s+|about\s+|approximately\s+)?(\d+)\s*(min|hour|hr)/i);
  if (!m) return 0;
  return +m[1]! * (m[2]!.toLowerCase().startsWith('min') ? 60 : 3600);
}

/**
 * Events from the travel-alerts RSS (breaking news: major incidents only). The title is the
 * headline (road, direction, junctions); the description stands in for location and reason.
 * No coordinates, no delay figure unless the text words one.
 */
export function parseAlertsRss(xml: string): RoadEvent[] {
  const out: RoadEvent[] = [];
  for (const m of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item\s*>/gi)) {
    const block = m[1]!;
    const title = tag(block, 'title');
    const description = tag(block, 'description');
    if (!title && !description) continue;
    const road = roadFrom(title) || roadFrom(description);
    const reason = description.split(/(?<=[.!?])\s+/)[0]?.slice(0, 200) ?? '';
    const clear = description.match(/(?:normal|clear(?:ed)?|reopen(?:ed)?)\b[^.]{0,40}?\b(?:by|at|around|between)\s+(\d{1,2}[:.]\d{2}(?:\s*(?:and|to|-)\s*\d{1,2}[:.]\d{2})?)/i);
    out.push({
      id: tag(block, 'guid') || tag(block, 'link') || `${road} ${title}`.trim().slice(0, 80),
      road,
      direction: direction('', `${title} ${description}`),
      title,
      location: description,
      reason,
      type: 'alert',
      delayS: delayIn(description) || delayIn(title),
      lanesClosed: (description.match(/\b(\d+|one|two|three|four|all)\s+lanes?\s+(?:are\s+|is\s+)?closed\b/i)?.[0] ?? '').toLowerCase(),
      from: '',
      to: '',
      lat: null,
      lon: null,
      start: when(tag(block, 'pubDate')),
      updated: null,
      normalBy: clear ? clear[1]!.replace(/\./g, ':') : '',
      status: 'active',
    });
  }
  return out;
}

export interface LiveEvents {
  events: RoadEvent[];
  /** When this answer was fetched (ms); older than CACHE_MS means both sources are failing and this is the last good one. */
  at: number;
  src: 'api' | 'rss';
  credit: string;
}

const cache = new Map<string, { at: number; events: RoadEvent[]; src: 'api' | 'rss' }>();

async function fromApi(region: string, road: string): Promise<RoadEvent[]> {
  const out: RoadEvent[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= 3; page++) {
    const u = new URL(API);
    if (region) u.searchParams.set('region', region);
    if (road) u.searchParams.set('road', apiRoad(road));
    u.searchParams.set('limit', '100');
    u.searchParams.set('page', String(page));
    const r = await fetch(u.toString(), { headers: { ...UA, Accept: 'application/json' } });
    if (!r.ok) throw new Error(`live incident list answered ${r.status}`);
    const j: unknown = await r.json();
    for (const e of parseEvents(j)) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      out.push(placeEvent(e));
    }
    const pages = (j as { pagination?: { totalPages?: unknown } } | null)?.pagination?.totalPages;
    if (!(typeof pages === 'number' && pages > page)) break;
  }
  return road ? out.filter((e) => e.road === road) : out;
}

/** The RSS has no region: for the West Midlands keep what we placed at its junctions, plus West Midlands roads with no junction named. */
const inRegion = (e: RoadEvent, region: string): boolean =>
  region.toLowerCase() !== 'west midlands' ? true : e.lat !== null ? true : e.road in WM_JUNCTIONS && junctionRefs(`${e.title} ${e.location}`).length === 0;

async function fromRss(region: string, road: string): Promise<RoadEvent[]> {
  const r = await fetch(RSS, { headers: { ...UA, Accept: 'application/rss+xml, application/xml, text/xml' } });
  if (!r.ok) throw new Error(`travel-alerts feed answered ${r.status}`);
  return parseAlertsRss(await r.text())
    .map((e) => placeEvent(e))
    .filter((e) => (!road || e.road === road) && (!region || inRegion(e, region)));
}

/**
 * Live events for a region and/or road, placed at West Midlands junctions where they can be.
 * Cached three minutes per region+road; the RSS stands in when the API fails, and the last good
 * answer is returned (with its old `at`) when both fail.
 */
export async function liveEvents(opts: { region?: string; road?: string; now?: number } = {}): Promise<LiveEvents> {
  const now = opts.now ?? Date.now();
  const region = (opts.region ?? '').trim();
  const road = opts.road ? roadName(opts.road) : '';
  const key = `${region}|${road}`;
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_MS) return { ...hit, credit: HIGHWAYS_CREDIT };
  let got: { events: RoadEvent[]; src: 'api' | 'rss' };
  const why = (e: unknown) => (e instanceof Error ? e.message : String(e));
  try {
    got = { events: await fromApi(region, road), src: 'api' };
  } catch (apiErr) {
    try {
      got = { events: await fromRss(region, road), src: 'rss' };
    } catch (rssErr) {
      if (hit) return { ...hit, credit: HIGHWAYS_CREDIT };
      throw new Error(`National Highways is not answering right now (${why(apiErr)}; ${why(rssErr)}). Try again in a few minutes.`);
    }
  }
  cache.set(key, { at: now, ...got });
  return { ...got, at: now, credit: HIGHWAYS_CREDIT };
}

/* ---------- typical speeds (past traffic counts, by weekday and quarter-hour) ---------- */

export interface TypicalSite {
  id: string;
  name: string;
  road: string;
  dir: string;
  lat: number;
  lon: number;
  /** [weekday 0 = Sunday][quarter-hour 0..95], 0 = no data. */
  mph: number[][];
  vol: number[][];
}

export interface TypicalData {
  sites: TypicalSite[];
  /** The months the averages cover, as worded in the file ('' when it does not say). */
  period: string;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** The weekday (0 = Sunday) and quarter-hour slot (0..95) of a moment in UK local time, with a label like "Tuesday 08:15". */
export function ukSlot(when: Date = new Date()): { day: number; slot: number; label: string } {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(when);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const day = Math.max(0, DAYS.indexOf(get('weekday')));
  const h = (+get('hour') || 0) % 24;
  const q = Math.floor((+get('minute') || 0) / 15);
  return { day, slot: h * 4 + q, label: `${DAYS[day]} ${pad(h)}:${pad(q * 15)}` };
}

/** The typical-speeds file, mapped defensively (sites without a position or speeds are dropped). */
export function parseTypical(json: unknown): TypicalData | null {
  if (!json || typeof json !== 'object') return null;
  const j = json as Record<string, unknown>;
  const list = Array.isArray(j.sites) ? j.sites : [];
  const sites: TypicalSite[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const s = raw as Record<string, unknown>;
    const lat = num(s.lat);
    const lon = num(s.lon);
    if (!lat || !lon || !Array.isArray(s.mph)) continue;
    sites.push({ id: str(s.id), name: str(s.name), road: str(s.road), dir: str(s.dir), lat, lon, mph: s.mph as number[][], vol: Array.isArray(s.vol) ? (s.vol as number[][]) : [] });
  }
  const period = str(j.period) || (str(j.from) && str(j.to) ? `${str(j.from)} to ${str(j.to)}` : '');
  return { sites, period };
}

/** The three nearest sites' usual speed and count for the weekday and quarter-hour of `when` (UK time); sites with no figure then are skipped. */
export function typicalAt(sites: TypicalSite[], lat: number, lon: number, when: Date = new Date()): { name: string; road: string; dir: string; mph: number; vol: number; km: number }[] {
  const { day, slot } = ukSlot(when);
  return sites
    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon))
    .map((s) => ({ s, d: km(lat, lon, s.lat, s.lon) }))
    .sort((a, b) => a.d - b.d)
    .map(({ s, d }) => ({ name: s.name ?? '', road: s.road ?? '', dir: s.dir ?? '', mph: Math.round(num(s.mph?.[day]?.[slot])), vol: Math.round(num(s.vol?.[day]?.[slot])), km: Math.round(d * 10) / 10 }))
    .filter((t) => t.mph > 0)
    .slice(0, 3);
}

let typicalCache: { at: number; origin: string; data: TypicalData | null } | null = null;

/**
 * The phone's /data/wm-typical.json from Ghosty's own address (origin), kept in memory for a
 * day (a miss is retried after five minutes). `fetcher` lets the Worker read it through its
 * ASSETS binding instead of the open internet. Null when the file is not there.
 */
export async function typicalSites(origin: string, fetcher: (url: string) => Promise<Response> = (u) => fetch(u), now = Date.now()): Promise<TypicalData | null> {
  const base = origin.trim().replace(/\/+$/, '');
  if (!base) return null;
  if (typicalCache && typicalCache.origin === base && now - typicalCache.at < (typicalCache.data ? TYPICAL_MS : 5 * 60_000)) return typicalCache.data;
  let data: TypicalData | null = null;
  try {
    const r = await fetcher(`${base}/data/wm-typical.json`);
    if (r.ok) data = parseTypical(await r.json());
  } catch {
    data = null;
  }
  typicalCache = { at: now, origin: base, data };
  return data;
}
