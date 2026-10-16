/**
 * Maps and places, all free and keyless: the flat map on God's Eye (show_map — OpenStreetMap
 * light and dark, OpenTopoMap, CyclOSM and Esri tiles, with rail, sea-mark, rain-radar and camera
 * overlays; Mapbox's maps with live traffic colours when the owner has set that free token),
 * what is at a spot (what_is_here — OpenStreetMap address, Wikipedia landmarks, UK postcode),
 * the height of a place (elevation — Open-Meteo / Copernicus DEM), UK postcodes (uk_postcode —
 * postcodes.io) and straight-line distances (measure_distance).
 */
import { asData } from '../kernel/permissions';
import { knownPlace } from '../integrations/traffic';
import { geocode, ownerPlace } from './travel';
import { arg, clip, type Tool, type ToolContext } from './types';

const UA = { 'User-Agent': 'Ghosty/2.0 (personal assistant; single user)', Accept: 'application/json', 'Accept-Language': 'en' };

interface Spot {
  name: string;
  lat: number;
  lon: number;
}

/** A place from `place`, `lat`+`lon`, or (with nothing given) the owner's location. */
async function where(a: Record<string, unknown>, ctx: ToolContext, key = 'place'): Promise<Spot> {
  const lat = a.lat;
  const lon = a.lon;
  if (typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon)) return { name: arg.str(a, key, false) || `${lat.toFixed(4)}, ${lon.toFixed(4)}`, lat, lon };
  const place = arg.str(a, key, false).trim();
  if (!place) {
    const home = await ownerPlace(ctx);
    if (home) return home;
    throw new Error('say which place');
  }
  const m = place.match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
  if (m) return { name: place, lat: Number(m[1]), lon: Number(m[2]) };
  const known = knownPlace(place);
  if (known) return { ...known, name: /[A-Z]/.test(place) && place.length <= 40 ? place : known.name };
  const g = await geocode(place, await ownerPlace(ctx).catch(() => null)).catch(() => null);
  if (!g) throw new Error(`I couldn't find "${place}" on the map`);
  return g;
}

const R = 6371.0088;
const rad = (d: number) => (d * Math.PI) / 180;
/** Great-circle distance in km. */
export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
/** Initial compass bearing from a to b, in degrees. */
export function bearingDeg(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
export const compass = (deg: number) => ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round(deg / 22.5) % 16]!;
const inUK = (lat: number, lon: number) => lat > 49.8 && lat < 60.9 && lon > -8.7 && lon < 1.8;
const fmtKm = (k: number) => (k < 1 ? `${Math.round(k * 1000)} m` : k < 10 ? `${k.toFixed(2)} km` : `${Math.round(k)} km`);

const STYLES = ['dark', 'streets', 'topo', 'cycle', 'satellite', 'traffic', 'mapbox', 'night'];
/** The 3D view's own styles (OpenFreeMap vector maps); the flat names above map across too. */
const STYLES_3D = ['liberty', 'bright', 'positron', 'fiord'];
const OVERLAYS = ['rail', 'sea', 'rain', 'cctv', 'cameras'];

interface Postcode {
  postcode: string;
  latitude: number;
  longitude: number;
  admin_district?: string;
  admin_ward?: string;
  parliamentary_constituency?: string;
  region?: string;
  country?: string;
  distance?: number;
}

async function postcodeAt(lat: number, lon: number): Promise<Postcode | null> {
  const r = await fetch(`https://api.postcodes.io/postcodes?lon=${lon.toFixed(6)}&lat=${lat.toFixed(6)}&limit=1&radius=1000`, { headers: UA });
  if (!r.ok) return null;
  const j = (await r.json()) as { result?: Postcode[] | null };
  return j.result?.[0] ?? null;
}

export const mapTools: Tool[] = [
  {
    name: 'show_map',
    description:
      "Open a map on God's Eye at a place (free, no key). view 'flat' (default): styles dark (OpenStreetMap in Ghosty's dark look), streets (OpenStreetMap), topo (contours), cycle, satellite — and, if the owner's Mapbox token is set, traffic (live traffic colours, like Google Maps), mapbox (satellite with streets) and night. Overlays: rail (railway lines and stations), sea (sea marks, buoys, lights), rain (live radar), cctv (public live cameras), cameras (ANPR / speed / red-light cameras). Tapping the map gives the address, Street View, a route, the elevation and nearby landmarks. Use for \"show me a map of X\", \"where is X\", \"map the railway near X\". view '3d': a vector map (MapLibre + OpenFreeMap) with the buildings in 3D, rotate and tilt — styles dark, liberty, bright, positron, fiord (and with the Mapbox token: traffic, mapbox, night); pitch 0–70 tilts it; buildings false flattens it. Use '3d' for \"3D map of X\", \"show me X in 3D\", \"the buildings in X\".",
    parameters: {
      type: 'object',
      properties: {
        place: { type: 'string' },
        lat: { type: 'number' },
        lon: { type: 'number' },
        view: { type: 'string', enum: ['flat', '3d'], description: "flat (default) or 3d (buildings in 3D, rotate and tilt)" },
        style: { type: 'string', enum: [...STYLES, ...STYLES_3D] },
        overlays: { type: 'array', items: { type: 'string', enum: OVERLAYS } },
        zoom: { type: 'number', description: '2 (world) to 19 (a street); default fits the place' },
        pitch: { type: 'number', description: '3d only: tilt in degrees, 0 (flat) to 70' },
        buildings: { type: 'boolean', description: '3d only: buildings in 3D (default true)' },
        points: { type: 'array', description: 'extra pins to mark', items: { type: 'object', properties: { lat: { type: 'number' }, lon: { type: 'number' }, label: { type: 'string' } }, required: ['lat', 'lon'] } },
        line: { type: 'boolean', description: 'join the points with a line' },
      },
    },
    risk: 'auto',
    async run(a, ctx) {
      const p = await where(a, ctx);
      const view = a.view === '3d' ? '3d' : 'flat';
      const style = (view === '3d' ? [...STYLES, ...STYLES_3D] : STYLES).includes(String(a.style)) ? String(a.style) : undefined;
      const pitch = view === '3d' && typeof a.pitch === 'number' && Number.isFinite(a.pitch) ? Math.max(0, Math.min(70, Math.round(a.pitch))) : undefined;
      const overlays = Array.isArray(a.overlays) ? a.overlays.map(String).filter((o) => OVERLAYS.includes(o)) : [];
      const points = Array.isArray(a.points) ? a.points.filter((x): x is { lat: number; lon: number; label?: string } => !!x && typeof x === 'object' && Number.isFinite((x as { lat: unknown }).lat) && Number.isFinite((x as { lon: unknown }).lon)).slice(0, 50).map((x) => ({ lat: Number(x.lat), lon: Number(x.lon), ...(x.label ? { label: String(x.label).slice(0, 60) } : {}) })) : [];
      const zoom = typeof a.zoom === 'number' && Number.isFinite(a.zoom) ? Math.max(2, Math.min(19, Math.round(a.zoom))) : undefined;
      ctx.emit({ t: 'client', name: 'show_map', args: { place: p.name, lat: p.lat, lon: p.lon, ...(view === '3d' ? { view, ...(pitch != null ? { pitch } : {}), ...(a.buildings === false ? { buildings: false } : {}) } : {}), ...(style ? { style } : {}), ...(overlays.length ? { overlays } : {}), ...(points.length ? { points } : {}), ...(a.line ? { line: true } : {}), ...(zoom ? { zoom } : {}) } });
      return `The ${view === '3d' ? '3D map' : 'map'} of ${p.name} is open on God's Eye${style ? ` (${style})` : ''}${overlays.length ? ` with ${overlays.join(', ')}` : ''}${points.length ? `, ${points.length} pin${points.length === 1 ? '' : 's'} marked` : ''}. The owner can tap anywhere on it for the address, Street View, a route, the elevation and nearby landmarks.`;
    },
  },
  {
    name: 'what_is_here',
    description:
      'What is at a spot: the address and what the place is (OpenStreetMap), the UK postcode and council area, and landmarks within 800 m with a line from Wikipedia. Use for "what\'s this place", "what\'s near X", "tell me about where I am". Also opens the map there with the landmarks pinned.',
    parameters: { type: 'object', properties: { place: { type: 'string' }, lat: { type: 'number' }, lon: { type: 'number' } } },
    risk: 'auto',
    async run(a, ctx) {
      const p = await where(a, ctx);
      const [rev, wiki, pc] = await Promise.allSettled([
        fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&accept-language=en&lat=${p.lat.toFixed(6)}&lon=${p.lon.toFixed(6)}`, { headers: UA }).then((r) => (r.ok ? (r.json() as Promise<{ name?: string; display_name?: string; type?: string; category?: string; address?: Record<string, string> }>) : null)),
        fetch(`https://en.wikipedia.org/w/api.php?action=query&format=json&generator=geosearch&ggscoord=${p.lat.toFixed(5)}|${p.lon.toFixed(5)}&ggsradius=800&ggslimit=6&prop=extracts|coordinates&exintro=1&explaintext=1&exsentences=2&exlimit=6`, { headers: UA }).then((r) => (r.ok ? (r.json() as Promise<{ query?: { pages?: Record<string, { title: string; extract?: string; coordinates?: { lat: number; lon: number }[] }> } }>) : null)),
        inUK(p.lat, p.lon) ? postcodeAt(p.lat, p.lon) : Promise.resolve(null),
      ]);
      const r = rev.status === 'fulfilled' ? rev.value : null;
      const pages = wiki.status === 'fulfilled' ? Object.values(wiki.value?.query?.pages ?? {}) : [];
      const post = pc.status === 'fulfilled' ? pc.value : null;
      const lines: string[] = [];
      lines.push(`WHERE: ${r?.display_name ?? p.name} (${p.lat.toFixed(5)}, ${p.lon.toFixed(5)})`);
      if (r?.name || r?.type) lines.push(`WHAT: ${[r.name, r.type?.replace(/_/g, ' ')].filter(Boolean).join(' — ')}`);
      if (post) lines.push(`POSTCODE: ${post.postcode}${post.admin_district ? ` · ${post.admin_district}` : ''}${post.admin_ward ? ` · ${post.admin_ward} ward` : ''}${post.parliamentary_constituency ? ` · ${post.parliamentary_constituency} constituency` : ''}`);
      const landmarks = pages
        .map((w) => ({ title: w.title, text: w.extract?.trim() ?? '', c: w.coordinates?.[0], km: w.coordinates?.[0] ? haversineKm(p, w.coordinates[0]) : 99 }))
        .sort((x, y) => x.km - y.km);
      if (landmarks.length) {
        lines.push('NEARBY (Wikipedia, within 800 m):');
        for (const l of landmarks) lines.push(`- ${l.title}${l.c ? ` (${fmtKm(l.km)})` : ''}${l.text ? `: ${l.text.slice(0, 240)}` : ''}`);
      } else lines.push(wiki.status === 'fulfilled' ? 'NEARBY: nothing on Wikipedia within 800 m.' : 'NEARBY: Wikipedia was not reachable.');
      ctx.emit({ t: 'client', name: 'show_map', args: { place: r?.name || p.name, lat: p.lat, lon: p.lon, style: 'streets', zoom: 17, points: [{ lat: p.lat, lon: p.lon, label: r?.name || p.name }, ...landmarks.filter((l) => l.c).slice(0, 8).map((l) => ({ lat: l.c!.lat, lon: l.c!.lon, label: l.title }))] } });
      return clip(asData('OpenStreetMap, Wikipedia and postcodes.io', lines.join('\n')), 5000);
    },
  },
  {
    name: 'elevation',
    description: 'How high a place is above sea level, in metres and feet (Open-Meteo, Copernicus DEM — free, no key). Use for "how high is X", "what\'s the altitude here", "elevation of X".',
    parameters: { type: 'object', properties: { place: { type: 'string' }, lat: { type: 'number' }, lon: { type: 'number' } } },
    risk: 'auto',
    async run(a, ctx) {
      const p = await where(a, ctx);
      const r = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${p.lat.toFixed(5)}&longitude=${p.lon.toFixed(5)}`, { headers: UA });
      if (!r.ok) throw new Error(`the elevation service answered ${r.status}`);
      const j = (await r.json()) as { elevation?: number[] };
      const m = j.elevation?.[0];
      if (m == null || !Number.isFinite(m)) throw new Error('no elevation data there');
      return `${p.name} is about ${Math.round(m)} m (${Math.round(m * 3.28084)} ft) above sea level (${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}; Copernicus DEM, 90 m grid).`;
    },
  },
  {
    name: 'uk_postcode',
    description: 'Look up a UK postcode (postcodes.io — free, no key): where it is, its council, ward, constituency and region; or the nearest postcode to a place. Use for "where is B1 1AA", "what\'s the postcode of X", "which council is X in".',
    parameters: { type: 'object', properties: { postcode: { type: 'string' }, place: { type: 'string', description: 'to find the nearest postcode to a place instead' }, lat: { type: 'number' }, lon: { type: 'number' } } },
    risk: 'auto',
    async run(a, ctx) {
      const pc = arg.str(a, 'postcode', false).trim().toUpperCase().replace(/\s+/g, '');
      let post: Postcode | null = null;
      let from = '';
      if (pc) {
        const r = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`, { headers: UA });
        if (r.status === 404) throw new Error(`${arg.str(a, 'postcode')} is not a UK postcode I can find`);
        if (!r.ok) throw new Error(`the postcode service answered ${r.status}`);
        post = ((await r.json()) as { result?: Postcode }).result ?? null;
      } else {
        const p = await where(a, ctx);
        if (!inUK(p.lat, p.lon)) throw new Error(`${p.name} is not in the UK, so it has no UK postcode`);
        post = await postcodeAt(p.lat, p.lon);
        from = p.name;
      }
      if (!post) throw new Error('no postcode found there');
      const pretty = post.postcode;
      ctx.emit({ t: 'client', name: 'show_map', args: { place: pretty, lat: post.latitude, lon: post.longitude, style: 'streets', zoom: 16, points: [{ lat: post.latitude, lon: post.longitude, label: pretty }] } });
      const parts = [post.admin_district, post.admin_ward ? `${post.admin_ward} ward` : '', post.parliamentary_constituency ? `${post.parliamentary_constituency} constituency` : '', post.region, post.country].filter(Boolean);
      return `${from ? `Nearest postcode to ${from}: ` : ''}${pretty} — ${parts.join(' · ')} (${post.latitude.toFixed(5)}, ${post.longitude.toFixed(5)})${post.distance != null ? `, ${Math.round(post.distance)} m away` : ''}. Shown on the map.`;
    },
  },
  {
    name: 'measure_distance',
    description: 'Straight-line ("as the crow flies") distance and compass bearing between two places, drawn on the map. For road distance and time use get_directions. "from" defaults to the owner\'s location.',
    parameters: { type: 'object', properties: { to: { type: 'string' }, from: { type: 'string' } }, required: ['to'] },
    risk: 'auto',
    async run(a, ctx) {
      const from = await where({ place: arg.str(a, 'from', false) }, ctx);
      const to = await where({ place: arg.str(a, 'to') }, ctx);
      const d = haversineKm(from, to);
      const b = bearingDeg(from, to);
      ctx.emit({ t: 'client', name: 'show_map', args: { place: `${from.name} → ${to.name}`, lat: (from.lat + to.lat) / 2, lon: (from.lon + to.lon) / 2, style: 'dark', line: true, points: [{ lat: from.lat, lon: from.lon, label: from.name }, { lat: to.lat, lon: to.lon, label: to.name }] } });
      return `${from.name} to ${to.name}: ${fmtKm(d)} (${(d * 0.621371).toFixed(d < 10 ? 2 : 0)} miles) in a straight line, bearing ${Math.round(b)}° (${compass(b)}). About ${Math.round((d / 850) * 60)} min by airliner. Drawn on the map; for the road route ask for directions.`;
    },
  },
];
