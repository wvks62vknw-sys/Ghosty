/**
 * SAVED PLACES: home, work, school, the gym, his parents' and any place the owner names, kept in the brain's
 * memory like his other facts (storage key `places`) and nowhere else. An address or a postcode is looked up on
 * the free map (Nominatim, as directions do; a bare UK postcode on postcodes.io) and the answer is shown for a
 * yes before it is kept (`findPlace` → `keepPlace`; in a chat, `remember_place` keeps the found one as pending
 * until he says yes). Journeys and directions read them ("take me home": `savedPlace`), the Brief shows the
 * commute when home and work are both set, God's Eye shows them as pins to fly to, Memory → ME lists them with
 * EDIT and FORGET. Routes under /profile/places (profile.ts sends them here).
 */
import { isNamedPlace, matchPlace, placeLabel, type PlaceCandidate, type SavedPlace } from '../../../packages/shared/src/places';

export const PLACES_KEY = 'places';
const PENDING_KEY = 'places:pending';
const MAX_PLACES = 30;
/** A place found in a chat waits this long for his yes. */
const PENDING_MS = 30 * 60_000;
const UA = { 'User-Agent': 'Ghosty/2.0 (personal assistant; single user)', Accept: 'application/json', 'Accept-Language': 'en-GB,en' };

export type { PlaceCandidate, SavedPlace };

export async function loadPlaces(storage: DurableObjectStorage): Promise<SavedPlace[]> {
  return ((await storage.get<SavedPlace[]>(PLACES_KEY).catch(() => undefined)) ?? []).filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lon));
}

/** The saved place these words mean ("home", "the office", "Nan's"), or null. Never throws: a paused database means no saved places. */
export async function savedPlace(storage: Pick<DurableObjectStorage, 'get'>, words: string): Promise<SavedPlace | null> {
  if (!words.trim()) return null;
  const list = (await storage.get<SavedPlace[]>(PLACES_KEY).catch(() => undefined)) ?? [];
  return matchPlace(words, list);
}

/** When the words are "home", "work"… but that place is not saved yet: the plain sentence that says how to save it. */
export function notSavedYet(words: string): string | null {
  if (!isNamedPlace(words)) return null;
  const l = placeLabel(words)!;
  return `I don't know where ${l.id === 'parents' ? "your parents' is" : l.id === 'home' ? 'home is' : `${l.label.toLowerCase()} is`} yet: tell me ("remember ${l.id === 'parents' ? "my parents' house" : l.id} is …" with the address or postcode) or add it in Memory → ME → PLACES.`;
}

const POSTCODE = /^\s*([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\s*$/i;

/**
 * An address, a place name or a UK postcode → what the free map finds there, for the owner to say yes to.
 * Throws in plain words when nothing is found.
 */
export async function findPlace(labelWords: string, query: string, near?: { lat: number; lon: number } | null): Promise<PlaceCandidate> {
  const l = placeLabel(labelWords);
  const q = query.trim().slice(0, 200);
  if (!l) throw new Error('say what to call the place: home, work, school, gym, parents or a name of your own');
  if (!q) throw new Error(`say the address or postcode for ${l.label.toLowerCase()}`);
  const pc = q.match(POSTCODE);
  if (pc) {
    const r = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent((pc[1]! + pc[2]!).toUpperCase())}`, { headers: UA });
    if (r.status === 404) throw new Error(`${q.toUpperCase()} is not a UK postcode I can find`);
    if (!r.ok) throw new Error(`the postcode service answered ${r.status}`);
    const p = ((await r.json()) as { result?: { postcode: string; latitude: number; longitude: number; admin_ward?: string; admin_district?: string } }).result;
    if (!p) throw new Error(`${q.toUpperCase()} is not a UK postcode I can find`);
    return { id: l.id, label: l.label, query: q, address: [p.postcode, p.admin_ward, p.admin_district].filter(Boolean).join(', '), lat: p.latitude, lon: p.longitude };
  }
  const u = new URL('https://nominatim.openstreetmap.org/search');
  u.searchParams.set('format', 'jsonv2');
  u.searchParams.set('limit', '1');
  u.searchParams.set('q', q);
  if (near) u.searchParams.set('viewbox', `${near.lon - 1.5},${near.lat + 1.5},${near.lon + 1.5},${near.lat - 1.5}`);
  const r = await fetch(u.toString(), { headers: UA });
  if (!r.ok) throw new Error(`the map search answered ${r.status}`);
  const g = ((await r.json()) as { lat: string; lon: string; display_name: string }[])[0];
  if (!g) throw new Error(`I couldn't find "${q}" on the map: try the street and the postcode`);
  // The address as the map has it: the first four parts and the postcode, without the county and country tail.
  const parts = g.display_name.split(',').map((s) => s.trim()).filter((s) => s && !/^(United Kingdom|England|Scotland|Wales|Northern Ireland)$/.test(s));
  const postcode = parts.find((s) => POSTCODE.test(s));
  const address = [...parts.filter((s) => s !== postcode).slice(0, 4), ...(postcode ? [postcode] : [])].join(', ');
  return { id: l.id, label: l.label, query: q, address, lat: +g.lat, lon: +g.lon };
}

const okCandidate = (c: Partial<PlaceCandidate> | null | undefined): c is PlaceCandidate =>
  !!c && typeof c.id === 'string' && !!c.id && typeof c.address === 'string' && Number.isFinite(c.lat) && Number.isFinite(c.lon) && Math.abs(c.lat!) <= 90 && Math.abs(c.lon!) <= 180;

/** Keep a place he said yes to (one per name: a new home replaces the old). */
export async function keepPlace(storage: DurableObjectStorage, c: PlaceCandidate): Promise<SavedPlace[]> {
  if (!okCandidate(c)) throw new Error('that place has no position on the map');
  const l = placeLabel(c.label || c.id)!;
  const place: SavedPlace = { id: l.id, label: l.label, query: String(c.query ?? '').slice(0, 200), address: c.address.slice(0, 200), lat: Math.round(c.lat * 1e6) / 1e6, lon: Math.round(c.lon * 1e6) / 1e6, at: Date.now() };
  const list = (await loadPlaces(storage)).filter((p) => p.id !== place.id);
  list.push(place);
  if (list.length > MAX_PLACES) throw new Error(`that's ${MAX_PLACES} places already: forget one first`);
  await storage.put(PLACES_KEY, list);
  await storage.delete(PENDING_KEY);
  return list;
}

export async function forgetPlace(storage: DurableObjectStorage, words: string): Promise<SavedPlace | null> {
  const list = await loadPlaces(storage);
  const gone = matchPlace(words, list) ?? list.find((p) => p.id === words.trim().toLowerCase()) ?? null;
  if (!gone) return null;
  await storage.put(PLACES_KEY, list.filter((p) => p !== gone));
  return gone;
}

/** A chat's find, kept until he says yes (or for half an hour). */
export async function proposePlace(storage: DurableObjectStorage, c: PlaceCandidate): Promise<void> {
  await storage.put(PENDING_KEY, { ...c, at: Date.now() });
}
export async function pendingPlace(storage: DurableObjectStorage, now = Date.now()): Promise<PlaceCandidate | null> {
  const p = await storage.get<PlaceCandidate & { at: number }>(PENDING_KEY);
  return p && now - p.at < PENDING_MS ? p : null;
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

/**
 * Memory → ME → PLACES: GET /profile/places → { places }; POST /profile/places/find { label, query } → { found }
 * (nothing kept yet); POST /profile/places { found } → { places } (kept: his yes); DELETE /profile/places?id= → { places }.
 */
export async function placesRoute(req: Request, path: string, method: string, url: URL, storage: DurableObjectStorage): Promise<Response> {
  if (path === '/profile/places' && method === 'GET') return json({ places: await loadPlaces(storage) });
  if (path === '/profile/places/find' && method === 'POST') {
    const b = (await req.json().catch(() => ({}))) as { label?: unknown; query?: unknown };
    const near = ((await storage.get<{ location?: { lat: number; lon: number } }>('owner:ctx').catch(() => undefined)) ?? {}).location ?? (await loadPlaces(storage))[0] ?? null;
    try {
      return json({ found: await findPlace(String(b.label ?? ''), String(b.query ?? ''), near) });
    } catch (e) {
      return json({ error: (e as Error).message }, 400);
    }
  }
  if (path === '/profile/places' && method === 'POST') {
    const b = (await req.json().catch(() => ({}))) as { found?: PlaceCandidate };
    if (!okCandidate(b.found)) return json({ error: 'find the place on the map first' }, 400);
    try {
      return json({ places: await keepPlace(storage, b.found) });
    } catch (e) {
      return json({ error: (e as Error).message }, 400);
    }
  }
  if (path === '/profile/places' && method === 'DELETE') {
    const gone = await forgetPlace(storage, url.searchParams.get('id') ?? '');
    return json({ places: await loadPlaces(storage), removed: !!gone });
  }
  return json({ error: 'not found' }, 404);
}
