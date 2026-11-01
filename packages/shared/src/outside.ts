/**
 * THE OUTSIDE PACK, the pure parts (BRIEF-PACKS-3; OWNER-ISSUES 92 ④): a day out and about, from his own notes and free public
 * sources. Nothing here fetches or stores — the brain (apps/edge/src/tools/outside.ts) and the phone (features/outside) share it.
 *  - Overpass questions and answers (car parks, toilets, cash machines, drinking water, what is open), and the opening_hours
 *    text read in code (a subset; anything else is said to be unreadable, never guessed);
 *  - a walking route scored against street crime from data.police.uk: reports within 100 m of the path over the latest three
 *    months, the busiest 150 m, a point to steer round it. Said as "fewer reports", never "safe";
 *  - the midpoint of a route by time, a plain fare split with who owes whom, a bag by the plan and the weather, a queue
 *    estimate from his own notes only, and the words he uses for a note, a car park and a ticket.
 * Every estimate says what it assumed.
 */
import { kmBetween, pounds } from './packs';

export type Pt = { lat: number; lon: number };
export const metresBetween = (a: Pt, b: Pt): number => kmBetween(a, b) * 1000;
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const pad2 = (n: number) => String(n).padStart(2, '0');
/** "90 m", "1.4 km". */
export const fmtM = (m: number): string => (m < 1000 ? `${Math.round(m / 10) * 10 || Math.round(m)} m` : `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`);
/** Minutes on foot at 4.8 km/h (a steady walk), rounded up to a whole minute. */
export const walkMins = (m: number): number => Math.max(1, Math.round(m / 80));
export const hhmm = (min: number): string => (min === 1440 ? '24:00' : `${pad2(Math.floor((min % 1440) / 60))}:${pad2(Math.round(min % 60))}`);
const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
/** Which way `to` lies from `from`, in words. */
export function compass(from: Pt, to: Pt): string {
  const y = to.lat - from.lat;
  const x = (to.lon - from.lon) * Math.cos((from.lat * Math.PI) / 180);
  const deg = (Math.atan2(x, y) * 180) / Math.PI;
  return COMPASS[Math.round(((deg + 360) % 360) / 45) % 8]!;
}

// ---------------------------------------------------------------- Overpass: what to ask and what comes back

export type NearKind = 'parking' | 'toilets' | 'cash' | 'refill' | 'open';
export const NEAR_KINDS: readonly NearKind[] = ['parking', 'toilets', 'cash', 'refill', 'open'];
/** Metres around the place that each question looks. */
export const NEAR_RADIUS: Record<NearKind, number> = { parking: 700, toilets: 1000, cash: 600, refill: 1500, open: 450 };
const FILTERS: Record<Exclude<NearKind, 'open'>, string> = { parking: '["amenity"="parking"]', toilets: '["amenity"="toilets"]', cash: '["amenity"="atm"]', refill: '["amenity"="drinking_water"]' };
/** What kinds of place "what's open" looks for, by his word for it. */
export function openFilter(what: string): string {
  const w = what.toLowerCase();
  if (/pharm|chemist/.test(w)) return '["amenity"="pharmacy"]';
  if (/coffee|caf[eé]/.test(w)) return '["amenity"="cafe"]';
  if (/pub|bar\b/.test(w)) return '["amenity"~"^(pub|bar)$"]';
  if (/food|eat|restaurant|takeaway|lunch|dinner|chippy/.test(w)) return '["amenity"~"^(restaurant|fast_food|cafe)$"]';
  if (/shop|supermarket|grocer|milk|corner/.test(w)) return '["shop"~"^(supermarket|convenience)$"]';
  if (/petrol|fuel/.test(w)) return '["amenity"="fuel"]';
  return '["amenity"~"^(cafe|pub|restaurant|fast_food|pharmacy|bar)$"]';
}
/** The one Overpass question for a kind of place around a point. */
export function nearbyQuery(kind: NearKind, p: Pt, o: { radius?: number; what?: string } = {}): string {
  const f = kind === 'open' ? `${openFilter(o.what ?? '')}["opening_hours"]` : FILTERS[kind];
  return `[out:json][timeout:20];(nwr${f}(around:${Math.round(o.radius ?? NEAR_RADIUS[kind])},${p.lat.toFixed(5)},${p.lon.toFixed(5)}););out center tags 60;`;
}

export interface Found {
  name: string;
  lat: number;
  lon: number;
  /** Metres from the point asked about. */
  m: number;
  tags: Record<string, string>;
}
/** Overpass's elements as places (a way or a relation by its centre), nearest first, the same name on the same spot once. */
export function parseOverpass(j: unknown, from: Pt, fallback = ''): Found[] {
  const els = (j as { elements?: unknown })?.elements;
  if (!Array.isArray(els)) return [];
  const out: Found[] = [];
  const seen = new Set<string>();
  for (const e of els as Record<string, unknown>[]) {
    if (!e || typeof e !== 'object') continue;
    const c = (e.center as { lat?: unknown; lon?: unknown } | undefined) ?? e;
    const lat = Number(c.lat);
    const lon = Number(c.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const tags: Record<string, string> = {};
    for (const [k, v] of Object.entries((e.tags as Record<string, unknown> | undefined) ?? {})) if (typeof v === 'string') tags[k] = v.slice(0, 120);
    const name = clean(tags.name || tags.brand || tags.operator || fallback);
    const key = `${name.toLowerCase()}@${lat.toFixed(4)},${lon.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, lat, lon, m: metresBetween(from, { lat, lon }), tags });
  }
  return out.sort((a, b) => a.m - b.m);
}

// ---- opening_hours, the common subset

type Iv = [number, number];
const DAY_IDS = ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayIdx = (s: string) => DAY_IDS.indexOf(s.toLowerCase());
const clock = (s: string): number => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  return m ? +m[1]! * 60 + +m[2]! : NaN;
};
/** The week as a table of [from, to] minutes a day (a close past midnight runs over 1440), or null when the text is more than I read. */
export function hoursTable(spec: string): Iv[][] | null {
  const s = clean(spec);
  if (!s) return null;
  if (/^24\/7$/.test(s)) return Array.from({ length: 7 }, () => [[0, 1440]] as Iv[]);
  const t: Iv[][] = Array.from({ length: 7 }, () => []);
  let any = false;
  for (const rule of s.split(';').map((x) => x.trim()).filter(Boolean)) {
    const m = /^((?:(?:Mo|Tu|We|Th|Fr|Sa|Su|PH)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)(?:,\s*(?:Mo|Tu|We|Th|Fr|Sa|Su|PH)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)*)?\s*(.*)$/i.exec(rule);
    if (!m) return null;
    const days = new Set<number>();
    for (const part of (m[1] ?? '').split(',').map((x) => x.trim()).filter(Boolean)) {
      if (/^ph$/i.test(part)) continue;
      const [a, b] = part.split('-');
      const i = dayIdx(a!);
      if (i < 0) return null;
      if (!b) days.add(i);
      else for (let k = i, n = 0; n < 7; n++, k = (k + 1) % 7) { days.add(k); if (k === dayIdx(b)) break; }
    }
    const rest = (m[2] ?? '').trim();
    if (m[1] && !days.size) continue; // a public-holiday rule: not read, said so
    const target = m[1] ? [...days] : [0, 1, 2, 3, 4, 5, 6];
    if (/^(?:off|closed)$/i.test(rest)) {
      for (const d of target) t[d] = [];
      any = true;
      continue;
    }
    if (/^24\/7$/.test(rest)) {
      for (const d of target) t[d] = [[0, 1440]];
      any = true;
      continue;
    }
    const ivs: Iv[] = [];
    for (const span of rest.split(',').map((x) => x.trim())) {
      const r = /^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/.exec(span);
      if (!r) return null;
      const a = clock(r[1]!);
      let b = clock(r[2]!);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      if (b <= a) b += 1440;
      ivs.push([a, b]);
    }
    for (const d of target) t[d] = ivs;
    any = true;
  }
  return any ? t : null;
}
export interface OpenNow {
  open: boolean;
  /** Open until (HH:MM), or the next opening ("09:00", "Mon 09:00"). */
  at: string;
  /** Minutes until it closes, when it is open. */
  left?: number;
}
/** Open at this weekday (0 = Sunday) and minute of the day? null when the hours are more than I read. */
export function openNow(spec: string, weekday: number, minute: number): OpenNow | null {
  const t = hoursTable(spec);
  if (!t) return null;
  for (const [a, b] of t[weekday] ?? []) if (minute >= a && minute < b) return { open: true, at: hhmm(b), left: b - minute };
  for (const [, b] of t[(weekday + 6) % 7] ?? []) if (b > 1440 && minute < b - 1440) return { open: true, at: hhmm(b - 1440), left: b - 1440 - minute };
  const later = (t[weekday] ?? []).map(([a]) => a).filter((a) => a > minute).sort((x, y) => x - y)[0];
  if (later !== undefined) return { open: false, at: hhmm(later) };
  for (let n = 1; n <= 7; n++) {
    const d = (weekday + n) % 7;
    const first = (t[d] ?? []).map(([a]) => a).sort((x, y) => x - y)[0];
    if (first !== undefined) return { open: false, at: `${n === 1 ? 'tomorrow' : DAY_NAMES[d]} ${hhmm(first)}` };
  }
  return { open: false, at: 'not this week' };
}

// ---- the lists, one place a line

export interface Item {
  name: string;
  m: number;
  /** One plain line: what the map says about it. */
  line: string;
  lat: number;
  lon: number;
  /** 0 first: free, then unknown, then paid (car parks); open before closed (what is open). */
  rank: number;
}
const where = (f: Found) => `${fmtM(f.m)} · ${walkMins(f.m)} min on foot`;

/** Car parks: free and cheap first, the ones he cannot use left out and counted. Prices and rules are the sign's. */
export function parkingItems(found: Found[]): { items: Item[]; hidden: number } {
  let hidden = 0;
  const items: Item[] = [];
  for (const f of found) {
    const t = f.tags;
    if (/^(private|permit|customers|delivery|no|residents)$/i.test(t.access ?? '')) {
      hidden++;
      continue;
    }
    const fee = t.fee === 'no' ? 'free' : t.fee === 'yes' || t.charge ? 'paid' : 'unknown';
    const kind = /multi-?storey/.test(t.parking ?? '') ? 'multi-storey' : t.parking === 'underground' ? 'underground' : t.parking === 'surface' ? 'surface' : t.parking === 'street_side' || t.parking === 'lane' ? 'on the street' : '';
    const bits = [
      kind,
      t.capacity ? `${t.capacity} spaces` : '',
      fee === 'free' ? 'free on the map' : fee === 'paid' ? (t.charge ? `charge: ${t.charge}` : 'a fee on the map') : 'fee not on the map',
      t.maxstay ? `max stay ${t.maxstay}` : '',
      t['capacity:disabled'] ? `${t['capacity:disabled']} disabled bays` : '',
      t.opening_hours ? `hours ${t.opening_hours}` : '',
      t.operator && t.operator !== f.name ? t.operator : '',
    ].filter(Boolean);
    items.push({ name: f.name || (kind ? cap(`${kind} car park`) : 'Car park'), m: f.m, line: `${where(f)}${bits.length ? ` · ${bits.join(' · ')}` : ''}`, lat: f.lat, lon: f.lon, rank: fee === 'free' ? 0 : fee === 'unknown' ? 1 : 2 });
  }
  return { items: items.sort((a, b) => a.rank - b.rank || a.m - b.m), hidden };
}
export function toiletItems(found: Found[], weekday: number, minute: number): Item[] {
  return found
    .map((f): Item => {
      const t = f.tags;
      const hrs = t.opening_hours ? openNow(t.opening_hours, weekday, minute) : null;
      const bits = [
        t.fee === 'yes' ? (t.charge ? `fee ${t.charge}` : 'a fee') : t.fee === 'no' ? 'free' : '',
        t.wheelchair === 'yes' ? 'step-free' : t.wheelchair === 'no' ? 'not step-free' : '',
        /^(customers|private)$/.test(t.access ?? '') ? 'for customers' : '',
        hrs ? (hrs.open ? `open until ${hrs.at}` : `closed, opens ${hrs.at}`) : t.opening_hours ? `hours ${t.opening_hours}` : 'hours not on the map',
      ].filter(Boolean);
      return { name: f.name || 'Public toilets', m: f.m, line: `${where(f)} · ${bits.join(' · ')}`, lat: f.lat, lon: f.lon, rank: /^(customers|private)$/.test(t.access ?? '') ? 2 : hrs && !hrs.open ? 1 : 0 };
    })
    .sort((a, b) => a.rank - b.rank || a.m - b.m);
}
export function cashItems(found: Found[]): Item[] {
  return found.map((f): Item => {
    const t = f.tags;
    const bits = [t.operator && t.operator !== f.name ? t.operator : '', t.fee === 'yes' ? 'may charge a fee' : t.fee === 'no' ? 'free to use' : '', t.indoor === 'yes' ? 'inside a building: check its hours' : '', t.cash_in === 'yes' ? 'takes deposits' : '', t.opening_hours ? `hours ${t.opening_hours}` : ''].filter(Boolean);
    return { name: f.name || 'Cash machine', m: f.m, line: `${where(f)}${bits.length ? ` · ${bits.join(' · ')}` : ''}`, lat: f.lat, lon: f.lon, rank: 0 };
  });
}
export function refillItems(found: Found[]): Item[] {
  return found.map((f): Item => {
    const t = f.tags;
    const bits = [t.bottle === 'yes' ? 'fills a bottle' : t.bottle === 'no' ? 'a fountain, not for bottles' : '', t.seasonal === 'yes' || t.seasonal === 'summer' ? 'seasonal: may be off in winter' : '', t.access && !/^(yes|permissive)$/.test(t.access) ? `access: ${t.access}` : ''].filter(Boolean);
    return { name: f.name || 'Drinking water', m: f.m, line: `${where(f)}${bits.length ? ` · ${bits.join(' · ')}` : ''}`, lat: f.lat, lon: f.lon, rank: 0 };
  });
}
/** What is open now: places whose hours I can read, open ones first, with when they close; the rest counted. */
export function openItems(found: Found[], weekday: number, minute: number): { items: Item[]; unread: number; closed: number } {
  let unread = 0;
  let closed = 0;
  const items: Item[] = [];
  for (const f of found) {
    const s = f.tags.opening_hours ? openNow(f.tags.opening_hours, weekday, minute) : null;
    if (!s) {
      unread++;
      continue;
    }
    if (!s.open) {
      closed++;
      continue;
    }
    const kind = f.tags.amenity ?? f.tags.shop ?? '';
    items.push({ name: f.name || cap(kind.replace(/_/g, ' ')) || 'A place', m: f.m, line: `${where(f)} · ${kind.replace(/_/g, ' ')} · open until ${s.at}${(s.left ?? 999) <= 45 ? ` (closing in ${s.left} min)` : ''}`, lat: f.lat, lon: f.lon, rank: 0 });
  }
  return { items: items.sort((a, b) => a.m - b.m), unread, closed };
}

// ---------------------------------------------------------------- a walk scored against street crime

/** One report from data.police.uk's street-level file: a category and the street point it is placed on. */
export interface Crime {
  category: string;
  lat: number;
  lon: number;
  street: string;
}
export function parseCrimes(list: unknown): Crime[] {
  if (!Array.isArray(list)) return [];
  const out: Crime[] = [];
  for (const c of list as Record<string, unknown>[]) {
    const loc = c?.location as { latitude?: unknown; longitude?: unknown; street?: { name?: unknown } } | undefined;
    const lat = Number(loc?.latitude);
    const lon = Number(loc?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || typeof c.category !== 'string') continue;
    out.push({ category: c.category, lat, lon, street: typeof loc?.street?.name === 'string' ? loc.street.name.replace(/^On or near\s*/i, '').trim() : '' });
  }
  return out;
}
/** In the weight of an evening walk: a robbery counts more than a stolen bike. Counted and said as reports either way. */
export const CRIME_WEIGHT: Record<string, number> = {
  robbery: 1.5, 'violent-crime': 1, 'theft-from-the-person': 1, 'possession-of-weapons': 1, 'public-order': 0.8, 'anti-social-behaviour': 0.6,
  drugs: 0.4, 'criminal-damage-arson': 0.4, 'other-theft': 0.3, burglary: 0.2, 'other-crime': 0.2, 'vehicle-crime': 0.15, 'bicycle-theft': 0.15, shoplifting: 0.1,
};
export const CRIME_WORDS: Record<string, string> = {
  'violent-crime': 'violence and sexual offences', robbery: 'robbery', 'theft-from-the-person': 'theft from the person', 'possession-of-weapons': 'weapons', 'public-order': 'public order',
  'anti-social-behaviour': 'anti-social behaviour', drugs: 'drugs', 'criminal-damage-arson': 'criminal damage', 'other-theft': 'other theft', burglary: 'burglary', 'other-crime': 'other crime',
  'vehicle-crime': 'vehicle crime', 'bicycle-theft': 'bike theft', shoplifting: 'shoplifting',
};
const wOf = (c: string) => CRIME_WEIGHT[c] ?? 0.3;

const MLAT = 110_540;
const mlon = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180);
export interface Dense {
  pts: Pt[];
  /** Metres along the path at each point. */
  at: number[];
}
/** The path ([lat, lon] pairs) as points at most `step` metres apart, with how far along each one is. */
export function densify(path: [number, number][], step = 15): Dense {
  const pts: Pt[] = [];
  const at: number[] = [];
  let run = 0;
  for (let i = 0; i < path.length; i++) {
    const [la, lo] = path[i]!;
    if (i === 0) {
      pts.push({ lat: la, lon: lo });
      at.push(0);
      continue;
    }
    const a = pts[pts.length - 1]!;
    const b = { lat: la, lon: lo };
    const d = metresBetween(a, b);
    const n = Math.max(1, Math.ceil(d / step));
    for (let k = 1; k <= n; k++) {
      pts.push({ lat: a.lat + ((b.lat - a.lat) * k) / n, lon: a.lon + ((b.lon - a.lon) * k) / n });
      at.push(run + (d * k) / n);
    }
    run += d;
  }
  return { pts, at };
}
/** How near the path a point is (metres), and how far along that is. */
export function nearestOn(d: Dense, p: Pt): { m: number; at: number } {
  let best = Infinity;
  let along = 0;
  const kx = mlon(p.lat);
  for (let i = 0; i < d.pts.length; i++) {
    const q = d.pts[i]!;
    const dx = (q.lon - p.lon) * kx;
    const dy = (q.lat - p.lat) * MLAT;
    const s = dx * dx + dy * dy;
    if (s < best) {
      best = s;
      along = d.at[i]!;
    }
  }
  return { m: Math.sqrt(best), at: along };
}
/** The point `m` metres along the path. */
export function pointAlong(d: Dense, m: number): Pt {
  const i = d.at.findIndex((x) => x >= m);
  return d.pts[i < 0 ? d.pts.length - 1 : i]!;
}
export interface Stretch {
  /** Metres along the path. */
  from: number;
  to: number;
  reports: number;
  at: Pt;
  streets: string[];
}
export interface RouteScore {
  km: number;
  /** Reports within `within` metres of the path, all three months. */
  reports: number;
  perKm: number;
  /** The same reports weighted by kind (a robbery more than a stolen bike): what the choice between routes uses. */
  weighted: number;
  top: [string, number][];
  worst: Stretch | null;
}
export const WITHIN_M = 100;
const BIN_M = 50;
/** A route against the reports: those within 100 m of the path, by kind, and the busiest 150 m of it. */
export function scoreRoute(path: [number, number][], crimes: Crime[], within = WITHIN_M): RouteScore {
  const d = densify(path);
  const length = d.at[d.at.length - 1] ?? 0;
  const bins = new Array(Math.max(1, Math.ceil(length / BIN_M) + 1)).fill(0) as number[];
  const counts = new Array(bins.length).fill(0) as number[];
  const streets: Map<string, number>[] = bins.map(() => new Map());
  const kinds = new Map<string, number>();
  let reports = 0;
  let weighted = 0;
  for (const c of crimes) {
    const n = nearestOn(d, c);
    if (n.m > within) continue;
    reports++;
    weighted += wOf(c.category);
    kinds.set(c.category, (kinds.get(c.category) ?? 0) + 1);
    const b = Math.min(bins.length - 1, Math.floor(n.at / BIN_M));
    bins[b]! += wOf(c.category);
    counts[b]!++;
    if (c.street) streets[b]!.set(c.street, (streets[b]!.get(c.street) ?? 0) + 1);
  }
  let bestAt = -1;
  let bestW = 0;
  for (let k = 0; k < bins.length; k++) {
    const w = (bins[k] ?? 0) + (bins[k + 1] ?? 0) + (bins[k + 2] ?? 0);
    if (w > bestW) {
      bestW = w;
      bestAt = k;
    }
  }
  let worst: Stretch | null = null;
  if (bestAt >= 0) {
    const from = bestAt * BIN_M;
    const to = Math.min(length, from + 3 * BIN_M);
    const sm = new Map<string, number>();
    for (let k = bestAt; k < Math.min(bins.length, bestAt + 3); k++) for (const [s, n] of streets[k]!) sm.set(s, (sm.get(s) ?? 0) + n);
    worst = { from, to, reports: (counts[bestAt] ?? 0) + (counts[bestAt + 1] ?? 0) + (counts[bestAt + 2] ?? 0), at: pointAlong(d, (from + to) / 2), streets: [...sm].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([s]) => s) };
  }
  const km = length / 1000;
  return { km, reports, perKm: km > 0 ? reports / km : 0, weighted, top: [...kinds].sort((a, b) => b[1] - a[1]).slice(0, 3), worst };
}
/** A stretch is worth steering round when it holds well over its share of the route's weighted reports. */
export function isDodgy(s: RouteScore): boolean {
  if (!s.worst || s.worst.reports < 4 || s.km <= 0) return false;
  const share = (3 * BIN_M) / (s.km * 1000);
  return s.worst.reports >= Math.max(4, 2 * share * s.reports);
}
/**
 * Two points to steer a walk through, either side of its busiest stretch (230 m off the path, at right angles), the side with
 * fewer reports around it first. The brain asks the router for one of them.
 */
export function viaOptions(path: [number, number][], s: RouteScore, crimes: Crime[], offsetM = 230): Pt[] {
  if (!s.worst) return [];
  const d = densify(path);
  const mid = (s.worst.from + s.worst.to) / 2;
  const a = pointAlong(d, Math.max(0, mid - 75));
  const b = pointAlong(d, mid + 75);
  const kx = mlon(s.worst.at.lat);
  const dx = (b.lon - a.lon) * kx;
  const dy = (b.lat - a.lat) * MLAT;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const side = (sign: number): Pt => ({ lat: s.worst!.at.lat + (sign * py * offsetM) / MLAT, lon: s.worst!.at.lon + (sign * px * offsetM) / kx });
  const around = (p: Pt) => crimes.reduce((n, c) => (metresBetween(p, c) <= 160 ? n + wOf(c.category) : n), 0);
  return [side(1), side(-1)].sort((x, y) => around(x) - around(y));
}
export const kindsText = (top: [string, number][]): string => top.map(([c]) => CRIME_WORDS[c] ?? c.replace(/-/g, ' ')).join(', ');

/** The latest three months police.uk has, as YYYY-MM, from its "last updated" date (YYYY-MM-DD). */
export function crimeMonths(updated: string): string[] {
  const y = +updated.slice(0, 4);
  const m = +updated.slice(5, 7);
  if (!y || !m) return [];
  return [0, 1, 2].map((k) => {
    const t = y * 12 + (m - 1) - k;
    return `${Math.floor(t / 12)}-${pad2((t % 12) + 1)}`;
  });
}
/** The rectangle round some paths, `padM` wider all round, as police.uk's poly= text ("lat,lng:lat,lng:…"). */
export function polyAround(paths: [number, number][][], padM = 130): string {
  let la0 = 90, la1 = -90, lo0 = 180, lo1 = -180;
  for (const p of paths) for (const [la, lo] of p) { la0 = Math.min(la0, la); la1 = Math.max(la1, la); lo0 = Math.min(lo0, lo); lo1 = Math.max(lo1, lo); }
  const dla = padM / MLAT;
  const dlo = padM / mlon((la0 + la1) / 2);
  const f = (n: number) => n.toFixed(5);
  return [[la0 - dla, lo0 - dlo], [la0 - dla, lo1 + dlo], [la1 + dla, lo1 + dlo], [la1 + dla, lo0 - dlo]].map(([a, b]) => `${f(a!)},${f(b!)}`).join(':');
}
/** At most `n` points of a path, evenly picked, both ends kept. */
export function thin(path: [number, number][], n: number): [number, number][] {
  if (path.length <= n) return path;
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) out.push(path[Math.round((i * (path.length - 1)) / (n - 1))]!);
  return out;
}

// ---------------------------------------------------------------- halfway, by time

/** The point on a route [lat, lon][] where half the time has gone: from the router's per-segment seconds, else a steady pace by distance. */
export function midpointByTime(path: [number, number][], seconds?: number[]): { at: Pt; fromA: number; share: number } {
  const lens: number[] = [];
  for (let i = 1; i < path.length; i++) lens.push(metresBetween({ lat: path[i - 1]![0], lon: path[i - 1]![1] }, { lat: path[i]![0], lon: path[i]![1] }));
  const useTime = !!seconds && seconds.length === lens.length && seconds.some((s) => s > 0);
  const weights = useTime ? seconds! : lens;
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let run = 0;
  for (let i = 0; i < weights.length; i++) {
    if (run + weights[i]! >= total / 2) {
      const f = weights[i]! > 0 ? (total / 2 - run) / weights[i]! : 0;
      const [la0, lo0] = path[i]!;
      const [la1, lo1] = path[i + 1]!;
      return { at: { lat: la0 + (la1 - la0) * f, lon: lo0 + (lo1 - lo0) * f }, fromA: lens.slice(0, i).reduce((a, b) => a + b, 0) + lens[i]! * f, share: 0.5 };
    }
    run += weights[i]!;
  }
  const last = path[path.length - 1]!;
  return { at: { lat: last[0], lon: last[1] }, fromA: lens.reduce((a, b) => a + b, 0), share: 0.5 };
}

// ---------------------------------------------------------------- a fare split: who owes whom

export interface Split {
  total: number | null;
  payers: { name: string; paid: number | null }[];
  people: string[];
  ways: number | null;
}
const YOU = 'You';
const nameOf = (s: string): string => (/^(?:i|me|myself|we)$/i.test(s.trim()) ? YOU : cap(s.trim().toLowerCase()));
const NOT_NAMES = /^(?:the|a|an|and|with|between|among|split|each|ways?|paid|taxi|cab|uber|fare|bill|total|for|of|on|it|that|this|them|us|everyone|everybody|all)$/i;
const money = (s: string): number => Number(s.replace(/[£,\s]/g, ''));
/** "taxi £48, I paid, between me, Sam and Jo" / "I paid £30, Sam paid £12, split 3 ways" → who paid what, who shares it. */
export function parseSplit(words: string): Split {
  const w = clean(words);
  const amounts = [...w.matchAll(/£\s?(\d+(?:,\d{3})*(?:\.\d{1,2})?)|\b(\d+(?:\.\d{1,2})?)\s?(?:quid|pounds?)\b/gi)].map((m) => money(m[1] ?? m[2] ?? '0'));
  const payers: { name: string; paid: number | null }[] = [];
  for (const m of w.matchAll(/\b(I|me|we|[A-Z][a-z]+)\s+(?:paid|put in|covered|got it|bought)(?:\s+(?:£\s?(\d+(?:,\d{3})*(?:\.\d{1,2})?)|(\d+(?:\.\d{1,2})?)\s?(?:quid|pounds?)))?/g)) {
    const name = nameOf(m[1]!);
    if (!NOT_NAMES.test(m[1]!) && !payers.some((p) => p.name === name)) payers.push({ name, paid: m[2] || m[3] ? money(m[2] ?? m[3]!) : null });
  }
  const people: string[] = [];
  const add = (n: string) => {
    const nm = nameOf(n);
    if (nm && !NOT_NAMES.test(n) && !people.includes(nm)) people.push(nm);
  };
  const list = /\b(?:between|among|with|shared by|split by|for)\s+((?:me|I|myself|[A-Z][a-z]+)(?:\s*(?:,|and|&)\s*(?:me|I|myself|[A-Z][a-z]+))*)/i.exec(w);
  if (list) for (const n of list[1]!.split(/\s*(?:,|and|&)\s*/i)) add(n);
  for (const p of payers) if (!people.includes(p.name)) people.push(p.name);
  const waysM = /\b(?:split\s+)?(\d{1,2})\s+ways?\b|\bbetween\s+(\d{1,2})\b|\b(?:split|share)\s+(?:it\s+)?(?:by\s+)?(\d{1,2})\b/i.exec(w);
  const ways = waysM ? +(waysM[1] ?? waysM[2] ?? waysM[3]!) : null;
  const single = payers.length === 1 && payers[0]!.paid === null;
  const total = payers.some((p) => p.paid !== null) ? payers.reduce((s, p) => s + (p.paid ?? 0), 0) : (amounts[0] ?? null);
  if (single && total !== null) payers[0]!.paid = total;
  return { total, payers, people, ways };
}
export interface SplitOut {
  total: number;
  each: number;
  oddPenny: string;
  /** From → to, in pounds. */
  owes: { from: string; to: string; amount: number }[];
  names: string[];
}
/** Pence, to the penny: the odd pennies fall on the people who did not pay, said. */
export function splitFare(s: Split): SplitOut | null {
  if (s.total === null || s.total <= 0) return null;
  const n = Math.max(s.people.length, s.ways ?? 0, 1);
  if (n < 2) return null;
  const names = [...s.people];
  while (names.length < n) names.push(`Person ${names.length + 1}`);
  const total = Math.round(s.total * 100);
  const base = Math.floor(total / n);
  const extra = total - base * n;
  const payerNames = new Set(s.payers.map((p) => p.name));
  const order = [...names.filter((x) => !payerNames.has(x)), ...names.filter((x) => payerNames.has(x))];
  const share = new Map<string, number>(names.map((x) => [x, base]));
  for (let i = 0; i < extra; i++) share.set(order[i % order.length]!, (share.get(order[i % order.length]!) ?? 0) + 1);
  const paid = new Map<string, number>(names.map((x) => [x, 0]));
  for (const p of s.payers) paid.set(p.name, Math.round((p.paid ?? (s.payers.length === 1 ? s.total : 0)) * 100));
  const net = names.map((x) => ({ x, v: (paid.get(x) ?? 0) - (share.get(x) ?? 0) }));
  const cred = net.filter((y) => y.v > 0).sort((a, b) => b.v - a.v);
  const debt = net.filter((y) => y.v < 0).sort((a, b) => a.v - b.v);
  const owes: SplitOut['owes'] = [];
  for (const dbt of debt) {
    let left = -dbt.v;
    for (const c of cred) {
      if (left <= 0) break;
      const t = Math.min(left, c.v);
      if (t <= 0) continue;
      owes.push({ from: dbt.x, to: c.x, amount: t / 100 });
      c.v -= t;
      left -= t;
    }
  }
  return { total: total / 100, each: base / 100, oddPenny: extra ? `${extra}p over: put on ${order.slice(0, extra).join(' and ')}` : '', owes, names };
}
export function splitWords(o: SplitOut): string {
  const lines = o.owes.map((x) => `${x.from === YOU ? 'You owe' : `${x.from} owes`} ${x.to === YOU ? 'you' : x.to} ${pounds(x.amount)}`);
  return `${pounds(o.total)} between ${o.names.length}: ${pounds(o.each)} each${o.oddPenny ? ` (${o.oddPenny})` : ''}.${lines.length ? ` ${lines.join('; ')}.` : ' (No one said who paid, so no one owes anyone.)'}`;
}

// ---------------------------------------------------------------- a bag by the plan and the weather

const BAG_RULES: [RegExp, string[]][] = [
  [/\b(gym|workout|training|lift)\b/, ['trainers', 'gym kit', 'towel', 'water bottle']],
  [/\b(swim|pool|lido)\b/, ['swimming kit', 'towel', 'goggles', 'flip-flops', 'a bag for wet things']],
  [/\b(run|running|jog|parkrun)\b/, ['running shoes', 'a light top', 'water']],
  [/\b(football|rugby|cricket|match)\b/, ['boots', 'kit', 'shin pads', 'a towel']],
  [/\b(yoga|pilates)\b/, ['a mat', 'water bottle', 'a towel']],
  [/\b(hike|hiking|walk|ramble|trek|countryside)\b/, ['proper shoes', 'a snack', 'water', 'a charged phone', 'a paper map or the offline one']],
  [/\b(beach|seaside|coast)\b/, ['sun cream', 'a towel', 'sunglasses', 'a hat', 'water']],
  [/\b(picnic|park|bbq|barbecue)\b/, ['a blanket', 'drinks', 'a bin bag', 'wipes']],
  [/\b(work|office|meeting|interview|presentation)\b/, ['laptop and charger', 'work pass', 'lunch', 'headphones']],
  [/\b(college|school|lesson|lecture|class|study|exam)\b/, ['notebook and pen', 'laptop or books', 'lunch', 'charger']],
  [/\b(flight|airport|plane|fly|holiday abroad)\b/, ['passport', 'boarding pass', 'charger', 'headphones', 'liquids in a clear bag']],
  [/\b(overnight|stay|sleepover|weekend away|hotel)\b/, ['a change of clothes', 'toothbrush', 'pyjamas', 'chargers']],
  [/\b(night out|party|pub|club|gig|concert|festival)\b/, ['ID', 'cash and a card', 'a charged phone', 'a power bank', 'a lift or taxi plan home']],
  [/\b(date|dinner|restaurant)\b/, ['a charged phone', 'cash and a card', 'mints']],
  [/\b(baby|toddler|kids?|children|nursery)\b/, ['nappies and wipes', 'a spare outfit', 'snacks', 'a drink', 'a toy']],
  [/\b(dog|puppy)\b/, ['lead', 'poo bags', 'water for the dog', 'treats']],
  [/\b(shopping|shops|market|supermarket)\b/, ['bags for life', 'a list', 'a card']],
  [/\b(bike|cycle|cycling)\b/, ['helmet', 'lock', 'lights', 'a puncture kit']],
  [/\b(car|drive|driving|road trip)\b/, ['licence', 'phone mount', 'a charger']],
];
export interface Weather {
  /** Highest chance of rain over the day's remaining hours, 0–100, or null when not known. */
  rain: number | null;
  /** When the rain is likeliest ("15:00"). */
  at?: string;
  temp: number | null;
}
/** A checklist for a day: what he said he is doing, then the weather. Always the four everyone forgets. */
export function bagFor(plan: string, w: Weather): { items: string[]; why: string[] } {
  const p = plan.toLowerCase();
  const items: string[] = ['phone and charger', 'keys', 'wallet or card'];
  const why: string[] = [];
  for (const [re, add] of BAG_RULES) if (re.test(p)) for (const x of add) if (!items.includes(x)) items.push(x);
  if (w.rain !== null && w.rain >= 40) {
    items.push(w.rain >= 70 ? 'a waterproof coat' : 'a light waterproof', 'an umbrella');
    why.push(`${w.rain}% chance of rain${w.at ? `, likeliest about ${w.at}` : ''}`);
  } else if (w.rain !== null) why.push(`only ${w.rain}% chance of rain`);
  if (w.temp !== null) {
    if (w.temp <= 4) items.push('a hat', 'gloves', 'a scarf', 'a warm coat');
    else if (w.temp <= 11) items.push('a jumper or fleece');
    else if (w.temp >= 22) items.push('water', 'sun cream', 'sunglasses', 'a hat');
    if (w.temp >= 28) items.push('extra water');
    why.push(`about ${Math.round(w.temp)}°C`);
  }
  return { items: [...new Set(items)], why };
}

// ---------------------------------------------------------------- a queue, from his own notes only

export interface Wait {
  place: string;
  minutes: number;
  at: number;
  /** 0 = Sunday. */
  wd: number;
  /** Hour of the day, his time. */
  hour: number;
}
export const samePlace = (a: string, b: string) => {
  const x = a.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  const y = b.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
};
export interface QueueSay {
  n: number;
  median: number;
  low: number;
  high: number;
  basis: 'around this time' | 'any time';
}
/** The wait he can expect, from his own notes about the place: this kind of day (weekday or weekend) and hour first, else any time. */
export function queueEstimate(waits: Wait[], place: string, wd: number, hour: number): QueueSay | null {
  const here = waits.filter((w) => samePlace(w.place, place));
  if (!here.length) return null;
  const weekend = (d: number) => d === 0 || d === 6;
  const near = here.filter((w) => weekend(w.wd) === weekend(wd) && Math.abs(w.hour - hour) <= 2);
  const use = near.length >= 2 ? near : here;
  const mins = use.map((w) => w.minutes).sort((a, b) => a - b);
  const median = mins.length % 2 ? mins[(mins.length - 1) / 2]! : (mins[mins.length / 2 - 1]! + mins[mins.length / 2]!) / 2;
  return { n: use.length, median: Math.round(median), low: mins[0]!, high: mins[mins.length - 1]!, basis: use === near ? 'around this time' : 'any time' };
}
/** "queue at the post office was 20 minutes" → the place and the minutes. */
export function parseWait(words: string): { place: string; minutes: number } | null {
  const w = clean(words);
  const m = /(\d{1,3})\s*(?:min(?:ute)?s?|mins)\b/i.exec(w) ?? /\b(an|half an) hour\b/i.exec(w);
  if (!m) return null;
  const minutes = /^\d/.test(m[1]!) ? +m[1]! : /half/i.test(m[1]!) ? 30 : 60;
  const p = /\b(?:queue|line|wait)\s+(?:at|for|in)\s+(?:the\s+)?(.+?)(?:\s+(?:was|took|is|were)\b|[,.]|$)/i.exec(w) ?? /\b(?:at|in)\s+(?:the\s+)?([A-Za-z][\w' &-]{2,40}?)\s+(?:was|took|is)\b/i.exec(w);
  const place = clean(p?.[1] ?? '');
  return place && minutes > 0 && minutes < 600 ? { place, minutes } : null;
}

// ---------------------------------------------------------------- his notes, a car park, a ticket

export type NoteKind = 'carriage' | 'parking' | 'other';
export function noteKind(words: string): NoteKind {
  if (/\b(carriages?|coach(?:es)?|front of the train|back of the train|end of the train|platform|exit|stairs|lift)\b/i.test(words)) return 'carriage';
  if (/\b(car ?park|parking|park(?:ed)?|meter|ticket|pay and display|bays?|free after|max(?:imum)? stay|permit)\b/i.test(words)) return 'parking';
  return 'other';
}
/** "at New Street the front carriages are nearest the exit I use" → the place and what he said. */
export function parseNote(words: string, place = ''): { place: string; text: string; kind: NoteKind } | null {
  let w = clean(words).replace(/^(?:note|remember|keep|save|tell|that|fyi)\b[:,]?\s*(?:that\s+)?/i, '');
  let p = clean(place);
  if (!p) {
    const m = /^(?:at|in|for)\s+([A-Z][\w'’.& -]{1,40}?)(?:\s*[:,-]\s*|\s+(?=the |a |an |it |you |there |go |get |park |pay |stand |board |sit |use |free |front |back |rear |middle |card |cash |ticket |max ))(.+)$/.exec(w);
    if (m) {
      p = clean(m[1]!);
      w = clean(m[2]!);
    } else {
      const m2 = /^([A-Z][\w'’.& -]{1,40}?)\s*[:,-]\s*(.+)$/.exec(w);
      if (m2) {
        p = clean(m2[1]!);
        w = clean(m2[2]!);
      }
    }
  }
  if (!p || w.length < 4) return null;
  return { place: cap(p).slice(0, 60), text: w.replace(/[.]+$/, '').slice(0, 200), kind: noteKind(w) };
}
/** "…until 3pm", "for 2 hours", "till 15:30" → a clock time or minutes. */
export function parseTicket(words: string): { hm?: string; forMinutes?: number } {
  const w = words.toLowerCase();
  const f = /\bfor\s+(\d+(?:\.\d+)?|an?|half an?)\s*(hours?|hrs?|mins?|minutes?)\b/.exec(w);
  if (f) {
    const n = /^half/.test(f[1]!) ? 0.5 : /^an?$/.test(f[1]!) ? 1 : Number(f[1]);
    return { forMinutes: Math.round(/^h/.test(f[2]!) ? n * 60 : n) };
  }
  const u = /\b(?:until|till|til|by|expires?(?: at)?)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/.exec(w);
  if (!u) return {};
  let h = +u[1]!;
  const mi = u[2] ? +u[2] : 0;
  if (u[3] === 'pm' && h < 12) h += 12;
  if (u[3] === 'am' && h === 12) h = 0;
  if (!u[3] && h < 7) h += 12;
  return h < 24 && mi < 60 ? { hm: `${pad2(h)}:${pad2(mi)}` } : {};
}
/** Where he left the car, in his words: the street or place, and what else he said about the rules. */
export function parseParked(words: string): { place: string; note: string; ticket: { hm?: string; forMinutes?: number } } {
  const w = clean(words).replace(/^(?:i(?:'ve| have)?|we(?:'ve| have)?)\s+(?:just\s+)?parked\s*/i, '').replace(/^(?:the car\s+)?(?:is\s+)?(?:parked\s+)?/i, '');
  const ticket = parseTicket(w);
  const parts = w.split(/\s*[,;.]\s*|\s+(?=until\b|till\b|for \d)/i).map((x) => clean(x)).filter(Boolean);
  const place = (parts[0] ?? '').replace(/^(?:here\b[:,]?\s*)?(?:on|at|in|outside|near|by|opposite|behind)\s+/i, '').replace(/\s+(?:until|till)\b.*$/i, '');
  const note = parts.slice(1).filter((x) => !/^(?:until|till|for \d)/i.test(x)).join('; ');
  return { place: /^(?:here|it|the car)?$/i.test(place) ? '' : cap(place).slice(0, 80), note: note.slice(0, 160), ticket };
}
export const agoWords = (ms: number): string => {
  const m = Math.round(ms / 60_000);
  if (m < 2) return 'just now';
  if (m < 60) return `${m} minutes ago`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h} hour${h === 1 ? '' : 's'} ago`;
  return `${Math.round(h / 24)} days ago`;
};

// ---------------------------------------------------------------- the words he uses on the phone

export type OutsideView = 'safewalk' | 'parking' | 'toilets' | 'cash' | 'refill' | 'open' | 'car' | 'parkedhere' | 'lost' | 'split';
/** Phrases the phone answers by opening the right view, with no model (assistant/phrases.ts; the car one it answers itself). */
export function outsideAsked(text: string): OutsideView | null {
  const t = text.trim().replace(/[’‘]/g, "'").replace(/[?!.]+$/, '');
  if (/^(?:where(?:'s| is| did i (?:park|leave))\b.*\b(?:car|park(?:ed)?)\b|where did i park(?: the car)?|where(?:'s| is) (?:my|the) car)$/i.test(t)) return 'car';
  if (/^(?:i(?:'ve| have)? (?:just )?parked|i parked|we(?:'ve| have)? parked|parked here)\b/i.test(t)) return 'parkedhere';
  if (/^(?:help,? )?i(?:'m| am) (?:totally |completely )?lost$|^where am i$/i.test(t)) return 'lost';
  if (/\bnearest (?:public )?(?:toilets?|loos?)\b|\b(?:toilets?|loos?)\s+(?:near|nearby|close|round here|around here)/i.test(t)) return 'toilets';
  if (/\bnearest (?:cash ?(?:machine|point)|atm|cashpoint)\b|\b(?:cash ?(?:machine|point)|atm|cashpoint)\s+(?:near|nearby|close|round here|around here)/i.test(t)) return 'cash';
  if (/\b(?:water refill|refill (?:my |the )?(?:water )?bottle|drinking (?:water|fountain)|free water)\b/i.test(t)) return 'refill';
  if (/\bnearest car ?park\b|\b(?:car ?parks?|parking)\s+(?:near|nearby|close|round here|around here)|\bfind (?:me )?(?:a )?(?:free |cheap )?(?:car ?park|parking)\b/i.test(t)) return 'parking';
  if (/^what(?:'s| is) open(?: now| nearby| near me| round here| around here)?$/i.test(t)) return 'open';
  if (/\bsafer (?:walk|route)\b|\bwalk(?:ing)? (?:home )?(?:safely|safer) at night\b|\bavoid the dodgy\b/i.test(t)) return 'safewalk';
  return null;
}

// ---------------------------------------------------------------- the rain plan: a coat, with the hour

export interface Hourly {
  time: number[];
  prob: (number | null)[];
  mm?: (number | null)[];
  temp?: (number | null)[];
}
export interface RainPlan {
  line: string;
  /** Rain likely within the next eight hours. */
  coat: boolean;
  peak: number | null;
  peakAt: string;
  from: string;
  to: string;
  /** The mean temperature over the hours looked at, °C. */
  temp: number | null;
}
/** The next `ahead` hours of a forecast, said as a chance and an hour. A forecast is a chance, not a promise. */
export function rainPlan(h: Hourly, now: number, clockOf: (ms: number) => string, ahead = 14): RainPlan | null {
  const idx = h.time.map((_, i) => i).filter((i) => h.time[i]! >= now - 45 * 60_000 && h.time[i]! <= now + ahead * 3_600_000);
  if (!idx.length || idx.every((i) => h.prob[i] === null || h.prob[i] === undefined)) return null;
  const wet = (i: number) => (h.prob[i] ?? 0) >= 50 || (h.mm?.[i] ?? 0) >= 0.3;
  const first = idx.find(wet);
  const temps = idx.map((i) => h.temp?.[i]).filter((x): x is number => typeof x === 'number');
  const temp = temps.length ? Math.round((temps.reduce((a, b) => a + b, 0) / temps.length) * 10) / 10 : null;
  const top = idx.reduce((b, i) => ((h.prob[i] ?? 0) > (h.prob[b] ?? 0) ? i : b), idx[0]!);
  if (first === undefined) {
    return { line: `No rain likely for the next ${ahead} hours (the highest chance is ${h.prob[top] ?? 0}% about ${clockOf(h.time[top]!)}). A forecast, not a promise.`, coat: false, peak: h.prob[top] ?? 0, peakAt: clockOf(h.time[top]!), from: '', to: '', temp };
  }
  let last = first;
  for (let k = idx.indexOf(first); k < idx.length && wet(idx[k]!); k++) last = idx[k]!;
  const block = idx.filter((i) => h.time[i]! >= h.time[first]! && h.time[i]! <= h.time[last]!);
  const peakI = block.reduce((b, i) => ((h.prob[i] ?? 0) > (h.prob[b] ?? 0) ? i : b), block[0]!);
  const from = clockOf(h.time[first]!);
  const to = clockOf(h.time[last]! + 3_600_000);
  const nowWet = h.time[first]! <= now + 30 * 60_000;
  const coat = h.time[first]! <= now + 8 * 3_600_000;
  const peak = h.prob[peakI] ?? 0;
  return {
    line: `Rain is likely ${nowWet ? `now until about ${to}` : `from ${from} to about ${to}`} (up to ${peak}% about ${clockOf(h.time[peakI]!)}): take a coat${peak >= 70 ? ' and an umbrella' : ''}. A forecast, not a promise.`,
    coat,
    peak,
    peakAt: clockOf(h.time[peakI]!),
    from,
    to,
    temp,
  };
}
