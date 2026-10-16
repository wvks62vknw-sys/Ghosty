/**
 * Live buses and trams for God's Eye and the transit_now tool, from the best source there is
 * a key for:
 *   - TfWM (Transport for West Midlands; free key "tfwm" in the vault as "APP_ID APP_KEY"):
 *     National Express West Midlands buses AND West Midlands Metro trams, GTFS-realtime,
 *     10,000 hits a day.
 *   - BODS (the DfT Bus Open Data Service; free key "bods"): every bus in England, GTFS-realtime,
 *     Open Government Licence v3. No trams.
 *   - bustimes.org (community, keyless, no published terms): a courtesy fallback used only when
 *     neither key is set, polled no more than once a minute per box.
 * National Rail trains are in none of these feeds. The interface never sees a key: the globe
 * asks /api/transit?bbox=… and the brain fetches from here (cached per box).
 */
import type { Vault } from '../kernel/vault';
import { decodeFeed, type TripUpdate, type VehiclePosition } from './gtfsrt';

export interface Vehicle {
  id: string;
  kind: 'bus' | 'tram' | 'other';
  line: string;
  dest: string;
  operator: string;
  lat: number;
  lon: number;
  bearing: number | null;
  speedMs: number | null;
  /** When the position was reported, ms since the epoch. */
  t: number;
  /** Seconds late (negative = early), when the feed says. */
  delayS: number | null;
  src: 'TfWM' | 'BODS' | 'bustimes.org';
}

/** minLon, minLat, maxLon, maxLat */
export type Bbox = [number, number, number, number];

export interface VehicleAnswer {
  vehicles: Vehicle[];
  src: Vehicle['src'] | null;
  credit: string;
  note: string;
}

export const CREDIT: Record<Vehicle['src'], string> = {
  TfWM: 'Powered by TfWM part of West Midlands Combined Authority Open Data',
  BODS: 'Bus Open Data Service (Department for Transport), Open Government Licence v3.0',
  'bustimes.org': 'bustimes.org (community data from the Bus Open Data Service)',
};

/** Vehicles reported longer ago than this are dropped. */
const STALE_MS = 10 * 60_000;

export class TransitError extends Error {}

/** The vault holds the TfWM key as "APP_ID APP_KEY" (a space or a colon between). */
export function parseTfwmKey(v: string): { id: string; key: string } | null {
  const parts = String(v ?? '')
    .trim()
    .split(/[\s:]+/)
    .map((p) => p.replace(/^(app_?id|app_?key)=/i, ''))
    .filter(Boolean);
  if (parts.length !== 2) return null;
  const [id, key] = parts as [string, string];
  if (!/^[\w.-]{2,}$/.test(id) || !/^[\w.-]{8,}$/.test(key)) return null;
  return { id, key };
}

/** The West Midlands, roughly: where TfWM's feed covers. */
const WM = { minLat: 52.2, maxLat: 52.8, minLon: -2.5, maxLon: -1.2 };
export const inWestMidlands = (bbox: Bbox): boolean => {
  const lat = (bbox[1] + bbox[3]) / 2;
  const lon = (bbox[0] + bbox[2]) / 2;
  return lat >= WM.minLat && lat <= WM.maxLat && lon >= WM.minLon && lon <= WM.maxLon;
};

const inBox = (bbox: Bbox, lat: number, lon: number) => lon >= bbox[0] && lon <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];

/** Tram or bus, from what the feed calls the route, the line or the vehicle. */
export function kindOf(routeId: string, line: string, label: string): Vehicle['kind'] {
  const s = `${routeId} ${line}`;
  if (/MM\d*\b/.test(s) || /metro/i.test(s) || /\btram\b/i.test(`${s} ${label}`)) return 'tram';
  return 'bus';
}

const GTFS_HEADERS = { Accept: 'application/x-protobuf, application/octet-stream;q=0.9, */*;q=0.1', 'User-Agent': 'Ghosty/2.0 (personal assistant; single user)' };

async function gtfsFetch(url: string, who: string, keyLabel: string): Promise<{ vehicles: VehiclePosition[]; trips: TripUpdate[]; headerTime: number | null }> {
  const r = await fetch(url, { headers: GTFS_HEADERS });
  if (r.status === 401 || r.status === 403) throw new TransitError(`${who} did not accept the key. Check it in the System tab (${keyLabel}).`);
  if (r.status === 429) throw new TransitError(`${who}'s free limit is used up for now; it resets later today.`);
  if (!r.ok) throw new TransitError(`${who} answered ${r.status}`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  if (!bytes.length) throw new TransitError(`${who} sent an empty feed`);
  return decodeFeed(bytes);
}

/** GTFS-realtime vehicles to the shared shape, inside the box and seen within the last 10 minutes. */
function fromGtfs(feed: { vehicles: VehiclePosition[]; trips: TripUpdate[] }, src: 'TfWM' | 'BODS', bbox: Bbox, now: number): Vehicle[] {
  // Some feeds bundle trip updates with the positions: use their delays when they match a vehicle.
  const delayByVehicle = new Map<string, number>();
  const delayByTrip = new Map<string, number>();
  for (const t of feed.trips) {
    const d = t.delay ?? t.stops.find((s) => s.delay !== null)?.delay ?? null;
    if (d === null) continue;
    if (t.vehicleId) delayByVehicle.set(t.vehicleId, d);
    if (t.tripId) delayByTrip.set(t.tripId, d);
  }
  const out: Vehicle[] = [];
  for (const v of feed.vehicles) {
    if (!inBox(bbox, v.lat, v.lon)) continue;
    const t = v.t || now;
    if (now - t > STALE_MS) continue;
    const line = v.routeId || v.label;
    out.push({
      id: `${src}:${v.id || v.tripId || `${v.lat.toFixed(5)},${v.lon.toFixed(5)}`}`,
      kind: kindOf(v.routeId, line, v.label),
      line,
      dest: '',
      operator: '',
      lat: v.lat,
      lon: v.lon,
      bearing: v.bearing,
      speedMs: v.speedMs,
      t,
      delayS: delayByVehicle.get(v.id) ?? delayByTrip.get(v.tripId) ?? null,
      src,
    });
  }
  return out;
}

const TFWM_HOSTS = [
  // The documented address is api.tfwm.org.uk, whose HTTPS certificate is wrong; this host serves
  // the same feed with a valid one. Try it first, then the documented one.
  'https://api-realtime-odp.tfwm.itoworld.com/gtfs/vehicle_positions',
  'http://api.tfwm.org.uk/gtfs/vehicle_positions',
];

export async function tfwmVehicles(key: { id: string; key: string }, bbox: Bbox, now: number): Promise<Vehicle[]> {
  let last: unknown = null;
  for (const base of TFWM_HOSTS) {
    const url = `${base}?app_id=${encodeURIComponent(key.id)}&app_key=${encodeURIComponent(key.key)}`;
    try {
      const feed = await gtfsFetch(url, 'TfWM', 'TfWM transport');
      return fromGtfs(feed, 'TfWM', bbox, now);
    } catch (e) {
      last = e;
      // A wrong key or a used-up limit is the same on both hosts; anything else (a certificate
      // or connection problem, a 5xx) is worth one more try on the other address.
      if (e instanceof TransitError && !/answered \d|empty feed/.test(e.message)) throw e;
    }
  }
  throw last instanceof Error ? last : new TransitError('TfWM did not answer');
}

const BODS = 'https://data.bus-data.dft.gov.uk/api/v1/gtfsrtdatafeed/';

export async function bodsVehicles(key: string, bbox: Bbox, now: number): Promise<Vehicle[]> {
  const box = bbox.map((v) => v.toFixed(4)).join(',');
  const feed = await gtfsFetch(`${BODS}?boundingBox=${box}&api_key=${encodeURIComponent(key.trim())}`, 'Bus Open Data', 'Bus Open Data');
  return fromGtfs(feed, 'BODS', bbox, now);
}

interface BustimesVehicle {
  id?: number | string;
  coordinates?: [number, number];
  heading?: number | string | null;
  datetime?: string;
  destination?: string;
  service?: { line_name?: string; operator?: string } | null;
  vehicle?: { name?: string; livery?: unknown; colour?: string; url?: string; operator?: string } | null;
  operator?: string | { name?: string } | null;
  delay?: number | null;
  progress?: unknown;
}

const BUSTIMES = 'https://bustimes.org/vehicles.json';
/** Most vehicles kept from one answer (a 1.5° box over London can hold thousands). */
const MAX_LIST = 5000;

export async function bustimesVehicles(bbox: Bbox, now: number): Promise<Vehicle[]> {
  const u = new URL(BUSTIMES);
  u.searchParams.set('ymin', bbox[1].toFixed(4));
  u.searchParams.set('ymax', bbox[3].toFixed(4));
  u.searchParams.set('xmin', bbox[0].toFixed(4));
  u.searchParams.set('xmax', bbox[2].toFixed(4));
  const r = await fetch(u.toString(), { headers: { Accept: 'application/json', 'User-Agent': 'Ghosty/2.0 (personal assistant; single user)' } });
  if (r.status === 429) throw new TransitError('bustimes.org asked us to slow down; try again in a minute.');
  if (!r.ok) throw new TransitError(`bustimes.org answered ${r.status}`);
  const j = (await r.json()) as unknown;
  if (!Array.isArray(j)) throw new TransitError('bustimes.org sent something that is not a vehicle list');
  const out: Vehicle[] = [];
  for (const raw of j.slice(0, MAX_LIST) as BustimesVehicle[]) {
    if (!raw || typeof raw !== 'object') continue;
    const c = raw.coordinates;
    if (!Array.isArray(c) || c.length < 2) continue;
    const lon = Number(c[0]);
    const lat = Number(c[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !inBox(bbox, lat, lon)) continue;
    const t = raw.datetime ? Date.parse(raw.datetime) : NaN;
    const seen = Number.isFinite(t) ? t : now;
    if (now - seen > STALE_MS) continue;
    const line = String(raw.service?.line_name ?? '').trim();
    const label = String(raw.vehicle?.name ?? '').trim();
    const op = typeof raw.operator === 'string' ? raw.operator : raw.operator?.name ?? raw.service?.operator ?? raw.vehicle?.operator ?? '';
    const heading = raw.heading === null || raw.heading === undefined || raw.heading === '' ? NaN : Number(raw.heading);
    const delay = typeof raw.delay === 'number' && Number.isFinite(raw.delay) ? Math.round(raw.delay) : null;
    out.push({
      id: `bustimes:${raw.id ?? `${lat.toFixed(5)},${lon.toFixed(5)}`}`,
      kind: kindOf('', line, `${label} ${raw.destination ?? ''}`),
      line,
      dest: String(raw.destination ?? '').trim(),
      operator: String(op ?? '').trim(),
      lat,
      lon,
      bearing: Number.isFinite(heading) ? heading : null,
      speedMs: null,
      t: seen,
      delayS: delay,
      src: 'bustimes.org',
    });
  }
  return out;
}

const why = (e: unknown) => String((e as Error)?.message ?? e).replace(/\s+/g, ' ').slice(0, 160);

const NO_KEY_NOTE =
  "No transport key yet: showing bustimes.org's community feed, updated about once a minute. For the official live feeds add a free key in System → Keys: \"TfWM transport\" for West Midlands buses and Metro trams, or \"Bus Open Data\" for buses anywhere in England.";

/**
 * Live vehicles in a box, from the best source the keys allow: TfWM when its key is set and the
 * box is in the West Midlands, else BODS when its key is set, else bustimes.org. When a keyed
 * feed fails the next source is tried and the note says so.
 */
export async function vehiclesIn(bbox: Bbox, keys: { tfwm?: string | null; bods?: string | null }, opts: { now?: number } = {}): Promise<VehicleAnswer> {
  const now = opts.now ?? Date.now();
  const notes: string[] = [];
  const tfwm = keys.tfwm ? parseTfwmKey(keys.tfwm) : null;
  if (keys.tfwm && !tfwm) notes.push('The TfWM key is not in the right shape: it should be the Application ID, a space, then the Key (System → Keys → TfWM transport).');
  if (tfwm && inWestMidlands(bbox)) {
    try {
      return { vehicles: await tfwmVehicles(tfwm, bbox, now), src: 'TfWM', credit: CREDIT.TfWM, note: notes.join(' ') };
    } catch (e) {
      notes.push(`TfWM's live feed did not answer (${why(e)}).`);
    }
  } else if (tfwm) notes.push("TfWM's feed only covers the West Midlands; this place is outside it.");
  if (keys.bods?.trim()) {
    try {
      return { vehicles: await bodsVehicles(keys.bods, bbox, now), src: 'BODS', credit: CREDIT.BODS, note: notes.join(' ') };
    } catch (e) {
      notes.push(`The Bus Open Data feed did not answer (${why(e)}).`);
    }
  }
  if (!tfwm && !keys.bods?.trim()) notes.push(NO_KEY_NOTE);
  else notes.push("Showing bustimes.org's community feed instead (updated about once a minute).");
  try {
    // Keyless community feed: never asked more than once a minute for the same box.
    const vehicles = await cachedVehicles(`bustimes:${bbox.map((v) => v.toFixed(3)).join(',')}`, 60_000, () => bustimesVehicles(bbox, now));
    return { vehicles: vehicles.filter((v) => now - v.t <= STALE_MS), src: 'bustimes.org', credit: CREDIT['bustimes.org'], note: notes.join(' ') };
  } catch (e) {
    notes.push(`bustimes.org did not answer either (${why(e)}). No live transport right now.`);
    return { vehicles: [], src: null, credit: '', note: notes.join(' ') };
  }
}

// ---- A small in-memory cache: one load in flight per box, a result kept for ttlMs, 40 boxes at most.

interface Entry {
  at: number;
  value?: unknown;
  pending?: Promise<unknown>;
}
const cache = new Map<string, Entry>();
const MAX_BOXES = 40;

export function cachedVehicles<R>(bboxKey: string, ttlMs: number, load: () => Promise<R>): Promise<R> {
  const now = Date.now();
  const hit = cache.get(bboxKey);
  if (hit?.pending) return hit.pending as Promise<R>;
  if (hit && hit.value !== undefined && now - hit.at < ttlMs) return Promise.resolve(hit.value as R);
  const pending = load().then(
    (value) => {
      cache.set(bboxKey, { at: Date.now(), value });
      return value;
    },
    (e) => {
      if (cache.get(bboxKey)?.pending === pending) cache.delete(bboxKey);
      throw e;
    },
  );
  // Re-insert so this box is the newest; the oldest boxes go when there are too many.
  cache.delete(bboxKey);
  cache.set(bboxKey, { at: now, pending });
  while (cache.size > MAX_BOXES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  return pending;
}

export const _testing = {
  resetCache: () => cache.clear(),
  cacheSize: () => cache.size,
};

/** GET /transit?bbox=minLon,minLat,maxLon,maxLat — what the globe's transit layer asks for. */
export async function transitRoute(url: URL, vault: Pick<Vault, 'get'>): Promise<(VehicleAnswer & { at: number }) | { error: string }> {
  const box = (url.searchParams.get('bbox') ?? '').split(',').map((s) => Number(s.trim()));
  if (box.length !== 4 || box.some((v) => !Number.isFinite(v))) return { error: 'bbox must be minLon,minLat,maxLon,maxLat' };
  const bbox = box as Bbox;
  if (bbox[0] >= bbox[2] || bbox[1] >= bbox[3] || Math.abs(bbox[1]) > 90 || Math.abs(bbox[3]) > 90) return { error: 'bbox must be minLon,minLat,maxLon,maxLat with min below max' };
  if (bbox[2] - bbox[0] > 1.5 || bbox[3] - bbox[1] > 1.5) return { error: 'zoom in closer: live transport is shown for areas up to 1.5 degrees (about 100 km) across' };
  const [tfwm, bods] = await Promise.all([vault.get('tfwm'), vault.get('bods')]);
  const keyed = !!(tfwm && parseTfwmKey(tfwm)) || !!bods?.trim();
  const key = `${keyed ? 'keyed' : 'community'}:${bbox.map((v) => v.toFixed(2)).join(',')}`;
  return cachedVehicles(key, keyed ? 30_000 : 60_000, async () => ({ ...(await vehiclesIn(bbox, { tfwm, bods })), at: Date.now() }));
}
