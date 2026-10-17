/**
 * AIM (the Lens mode that labels what the phone points at): the places and landmarks around the
 * owner, the space station, and a few lines about a place. Keyless public sources, fetched here
 * so the phone's security policy stays shut:
 *   - Wikipedia geosearch: articles with a position within 10 km (the API's own limit).
 *   - OpenStreetMap through Overpass (a list of public mirrors, the first that answers): named
 *     hilltops, towers and masts, stadiums and cathedrals within 15 km, with height where mapped.
 *   - wheretheiss.at: where the International Space Station is now.
 * Planes, ships and buses come from the routes the globe already uses (/api/proxy to adsb.lol,
 * /api/ships, /api/transit). Answers are cached in memory (places 10 minutes per ~1 km square,
 * the station 5 seconds), so walking about does not hammer anyone. What comes back is data for a
 * label; it never goes into a prompt from here.
 */

const UA = 'Ghosty/2.0 (personal assistant; single user)';
const TIMEOUT_MS = 12_000;
const PLACES_TTL_MS = 10 * 60_000;
const ISS_TTL_MS = 5_000;
const MAX_PLACES = 60;
/** Overpass mirrors, tried in turn (busy ones reset the connection, answer 500, or time out inside a 200). */
export const OVERPASS_MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.openstreetmap.fr/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
export const PLACES_CREDIT = 'Places: Wikipedia, OpenStreetMap';

export type PlaceKind = 'peak' | 'tower' | 'stadium' | 'cathedral' | 'landmark';

export interface AimPlace {
  id: string;
  name: string;
  kind: PlaceKind;
  lat: number;
  lon: number;
  /** Metres above sea level of the top, when the map says (a hilltop's height, a tower's base plus its height is not known: its height alone is in `height`). */
  ele?: number;
  /** Metres tall (towers, masts). */
  height?: number;
  /** The Wikipedia article's title, for "tell me more". */
  wiki?: string;
  /** Metres from the asked point. */
  dist: number;
}

export interface PlacesAnswer {
  places: AimPlace[];
  credit: string;
  /** Which sources answered, in plain words, when one did not. */
  note?: string;
}

export interface IssAnswer {
  lat: number;
  lon: number;
  /** Kilometres above sea level. */
  altKm: number;
  speedKmh: number;
  /** 'daylight' or 'eclipsed' (in the Earth's shadow). */
  visibility: string;
  at: number;
}

interface CacheEntry<T> {
  at: number;
  value?: T;
  pending?: Promise<T>;
}
const cache = new Map<string, CacheEntry<unknown>>();

function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key) as CacheEntry<T> | undefined;
  if (hit?.pending) return hit.pending;
  if (hit && hit.value !== undefined && Date.now() - hit.at < ttlMs) return Promise.resolve(hit.value);
  const pending = load().then(
    (value) => {
      cache.set(key, { at: Date.now(), value });
      if (cache.size > 60) cache.delete(cache.keys().next().value as string);
      return value;
    },
    (e) => {
      if (cache.get(key)?.pending === pending) cache.delete(key);
      throw e;
    },
  );
  cache.set(key, { at: Date.now(), pending });
  return pending;
}

const RAD = Math.PI / 180;
function meters(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = (b.lat - a.lat) * RAD;
  const dLon = (b.lon - a.lon) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(h)));
}

const num = (s: unknown): number | undefined => {
  const m = String(s ?? '').replace(',', '.').match(/-?\d+(\.\d+)?/);
  const n = m ? Number(m[0]) : NaN;
  return Number.isFinite(n) ? n : undefined;
};
const clean = (s: unknown, max = 120): string => String(s ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

async function getJson(url: string, init: RequestInit = {}): Promise<unknown> {
  const r = await fetch(url, { ...init, headers: { 'User-Agent': UA, Accept: 'application/json', ...(init.headers as Record<string, string> | undefined) }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.json();
}

// ---- Wikipedia

interface GeoHit {
  pageid?: number;
  title?: string;
  lat?: number;
  lon?: number;
  dist?: number;
}

/** Articles with a position within `radiusM` (≤ 10 km) of the point. */
export async function wikipediaNear(lat: number, lon: number, radiusM = 10_000): Promise<AimPlace[]> {
  const u = new URL('https://en.wikipedia.org/w/api.php');
  u.search = new URLSearchParams({ action: 'query', list: 'geosearch', gscoord: `${lat.toFixed(5)}|${lon.toFixed(5)}`, gsradius: String(Math.max(10, Math.min(10_000, Math.round(radiusM)))), gslimit: '50', format: 'json' }).toString();
  const j = (await getJson(u.toString())) as { query?: { geosearch?: GeoHit[] } };
  const out: AimPlace[] = [];
  for (const g of j.query?.geosearch ?? []) {
    const name = clean(g.title);
    if (!name || !Number.isFinite(g.lat) || !Number.isFinite(g.lon)) continue;
    out.push({ id: `w${g.pageid ?? name}`, name, kind: 'landmark', lat: g.lat!, lon: g.lon!, wiki: name, dist: Number.isFinite(g.dist) ? g.dist! : meters({ lat, lon }, { lat: g.lat!, lon: g.lon! }) });
  }
  return out;
}

// ---- OpenStreetMap (Overpass)

/**
 * The Overpass query: named hilltops, towers and masts, stadiums and cathedrals in a square
 * `radiusM` either side (a box is far cheaper for the public servers than a circle: the circle
 * version timed out on every mirror tried). Each kind has its own cap, so a hilly area cannot
 * crowd out the stadiums.
 */
export function landmarksQuery(lat: number, lon: number, radiusM = 15_000): string {
  const dLat = radiusM / 111_320;
  const dLon = radiusM / (111_320 * Math.max(0.2, Math.cos(lat * RAD)));
  const bbox = [lat - dLat, lon - dLon, lat + dLat, lon + dLon].map((v) => v.toFixed(3)).join(',');
  return `[out:json][timeout:25][bbox:${bbox}];node["natural"="peak"]["name"];out 40;nw["man_made"~"^(tower|communications_tower)$"]["name"]["tower:type"!="lighting"];out center 30;nw["leisure"="stadium"]["name"];out center 20;nw["building"="cathedral"]["name"];out center 10;`;
}

interface OsmElement {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}

/** A phone mast named by its site number ("Beacon 3- Unwind 26274"): not a landmark anyone would point at. */
const SITE_MAST = /\d{4,}|^(o2|ee|vodafone|three|railway comms)\b/i;

/**
 * Overpass elements as places (ways by their centre) within `radiusM`: unnamed-in-practice phone
 * masts dropped, and one place per name within 500 m (the tallest).
 */
export function parseLandmarks(j: unknown, from: { lat: number; lon: number }, radiusM = 15_000): AimPlace[] {
  const out: AimPlace[] = [];
  for (const e of ((j as { elements?: OsmElement[] })?.elements ?? []).slice(0, 200)) {
    const t = e.tags ?? {};
    const name = clean(t['name:en'] || t.name);
    const lat = e.lat ?? e.center?.lat;
    const lon = e.lon ?? e.center?.lon;
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const kind: PlaceKind = t.natural === 'peak' ? 'peak' : t.leisure === 'stadium' ? 'stadium' : t.building === 'cathedral' ? 'cathedral' : 'tower';
    const wikiTag = t.wikipedia ?? '';
    if (kind === 'tower' && t['tower:type'] === 'communication' && !wikiTag && SITE_MAST.test(name)) continue;
    const wiki = /^en:/.test(wikiTag) ? clean(wikiTag.slice(3)) : undefined;
    const p: AimPlace = { id: `o${(e.type ?? 'n')[0]}${e.id ?? name}`, name, kind, lat: lat!, lon: lon!, dist: meters(from, { lat: lat!, lon: lon! }) };
    const ele = num(t.ele);
    const height = num(t.height);
    if (ele != null) p.ele = ele;
    if (height != null) p.height = height;
    if (wiki) p.wiki = wiki;
    if (p.dist > radiusM) continue;
    const twin = out.find((q) => q.name === p.name && meters(q, p) < 500);
    if (twin) {
      if ((p.height ?? 0) > (twin.height ?? 0)) Object.assign(twin, p, { id: twin.id });
      continue;
    }
    out.push(p);
  }
  return out;
}

/** The landmarks from the first Overpass mirror that answers in full (a busy one says "runtime error" in a 200). */
export async function landmarksNear(lat: number, lon: number, radiusM = 15_000): Promise<AimPlace[]> {
  const q = landmarksQuery(lat, lon, radiusM);
  let last = '';
  for (const m of OVERPASS_MIRRORS) {
    try {
      const j = (await getJson(`${m}?data=${encodeURIComponent(q)}`)) as { remark?: string };
      if (typeof j?.remark === 'string' && /error|timed out/i.test(j.remark)) throw new Error('busy');
      return parseLandmarks(j, { lat, lon }, radiusM);
    } catch (e) {
      last = String((e as Error)?.message ?? e);
    }
  }
  throw new Error(`OpenStreetMap did not answer (${last})`);
}

/**
 * The two lists merged: a map landmark and the article about it are one place (same article
 * title, or the same name within 400 m) keeping the map's kind and height and the article's
 * title. Up to 40 landmarks, then the nearest articles, at most MAX_PLACES, nearest first.
 */
export function mergePlaces(osm: AimPlace[], wiki: AimPlace[], max = MAX_PLACES): AimPlace[] {
  // the ones with an article, the stadiums and cathedrals first (a hilly area has dozens of named hillocks), then the nearest
  const rank = (p: AimPlace) => (p.wiki || p.kind === 'stadium' || p.kind === 'cathedral' ? 0 : 1);
  const out = [...osm]
    .sort((a, b) => rank(a) - rank(b) || a.dist - b.dist)
    .slice(0, 40)
    .map((p) => ({ ...p }));
  const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  for (const w of [...wiki].sort((a, b) => a.dist - b.dist)) {
    const same = out.find((p) => (p.wiki && key(p.wiki) === key(w.name)) || (key(p.name) === key(w.name) && meters(p, w) < 400));
    if (same) {
      same.wiki ??= w.wiki;
      continue;
    }
    if (out.length >= max) continue;
    out.push(w);
  }
  return out.sort((a, b) => a.dist - b.dist).slice(0, max);
}

export async function placesNear(lat: number, lon: number, radiusM = 15_000): Promise<PlacesAnswer> {
  const k = `places:${lat.toFixed(2)},${lon.toFixed(2)},${Math.round(radiusM / 1000)}`;
  return cached(k, PLACES_TTL_MS, async () => {
    const [w, o] = await Promise.allSettled([wikipediaNear(lat, lon, Math.min(10_000, radiusM)), landmarksNear(lat, lon, radiusM)]);
    const notes: string[] = [];
    if (w.status === 'rejected') notes.push(`Wikipedia did not answer (${String((w.reason as Error)?.message ?? w.reason)}).`);
    if (o.status === 'rejected') notes.push(`${String((o.reason as Error)?.message ?? o.reason)}.`);
    if (w.status === 'rejected' && o.status === 'rejected') throw new Error(notes.join(' '));
    const places = mergePlaces(o.status === 'fulfilled' ? o.value : [], w.status === 'fulfilled' ? w.value : []);
    return { places, credit: PLACES_CREDIT, ...(notes.length ? { note: notes.join(' ') } : {}) };
  });
}

// ---- The space station

export async function iss(): Promise<IssAnswer> {
  return cached('iss', ISS_TTL_MS, async () => {
    const j = (await getJson('https://api.wheretheiss.at/v1/satellites/25544')) as { latitude?: number; longitude?: number; altitude?: number; velocity?: number; visibility?: string; timestamp?: number; units?: string };
    if (!Number.isFinite(j.latitude) || !Number.isFinite(j.longitude) || !Number.isFinite(j.altitude)) throw new Error('no position in the answer');
    const miles = j.units === 'miles';
    return {
      lat: j.latitude!,
      lon: j.longitude!,
      altKm: miles ? j.altitude! * 1.609344 : j.altitude!,
      speedKmh: Math.round((miles ? (j.velocity ?? 0) * 1.609344 : (j.velocity ?? 0))),
      visibility: clean(j.visibility, 20),
      at: (j.timestamp ?? Date.now() / 1000) * 1000,
    };
  });
}

// ---- A few lines about a place

export async function about(title: string): Promise<{ title: string; extract: string; url: string }> {
  const t = clean(title, 200);
  if (!t) throw new Error('Say which place.');
  return cached(`about:${t}`, PLACES_TTL_MS, async () => {
    const u = new URL('https://en.wikipedia.org/w/api.php');
    u.search = new URLSearchParams({ action: 'query', prop: 'extracts', exintro: '1', explaintext: '1', exsentences: '4', redirects: '1', titles: t, format: 'json', formatversion: '2' }).toString();
    const j = (await getJson(u.toString())) as { query?: { pages?: { title?: string; extract?: string; missing?: boolean }[] } };
    const p = j.query?.pages?.[0];
    if (!p || p.missing) return { title: t, extract: '', url: '' };
    const name = clean(p.title, 200) || t;
    return { title: name, extract: clean(p.extract, 1200), url: `https://en.wikipedia.org/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}` };
  });
}

// ---- The routes: /api/aim/places?lat&lon&r, /api/aim/iss, /api/aim/about?title=

const json = (data: unknown, status = 200) => Response.json(data, { status });

export async function aimRoute(path: string, url: URL): Promise<Response> {
  try {
    if (path === '/aim/places') {
      const lat = Number(url.searchParams.get('lat'));
      const lon = Number(url.searchParams.get('lon'));
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return json({ error: 'lat and lon are needed' }, 400);
      const r = Math.max(1000, Math.min(15_000, Number(url.searchParams.get('r')) || 15_000));
      return json(await placesNear(lat, lon, r));
    }
    if (path === '/aim/iss') return json(await iss());
    if (path === '/aim/about') return json(await about(url.searchParams.get('title') ?? ''));
    return json({ error: 'not found' }, 404);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e).slice(0, 300) }, 502);
  }
}

export const _testing = { resetCache: () => cache.clear() };
