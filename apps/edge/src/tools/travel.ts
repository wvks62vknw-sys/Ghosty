/**
 * Getting around: directions (OpenStreetMap routing) and finding places nearby.
 * Free services, no keys. Routes are also drawn on the globe (client command show_route).
 */
import { asData } from '../kernel/permissions';
import { arg, type Tool, type ToolContext } from './types';

const UA = { 'User-Agent': 'Ghosty/2.0 (personal assistant; single user)', Accept: 'application/json', 'Accept-Language': 'en' };

interface Spot {
  name: string;
  lat: number;
  lon: number;
}

export async function ownerPlace(ctx: Pick<ToolContext, 'storage'>): Promise<Spot | null> {
  const c = await ctx.storage.get<{ location?: { name: string; lat: number; lon: number } }>('owner:ctx');
  return c?.location ? { name: c.location.name || 'your location', lat: c.location.lat, lon: c.location.lon } : null;
}

export async function geocode(q: string, near?: Spot | null): Promise<Spot | null> {
  const coords = q.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (coords) return { name: q.trim(), lat: +coords[1]!, lon: +coords[2]! };
  const u = new URL('https://nominatim.openstreetmap.org/search');
  u.searchParams.set('format', 'jsonv2');
  u.searchParams.set('limit', '1');
  u.searchParams.set('q', q);
  if (near) {
    // Prefer results near the owner (still allows far-away places).
    const d = 1.5;
    u.searchParams.set('viewbox', `${near.lon - d},${near.lat + d},${near.lon + d},${near.lat - d}`);
  }
  const r = await fetch(u.toString(), { headers: UA });
  if (!r.ok) throw new Error(`place search answered ${r.status}`);
  const j = (await r.json()) as { lat: string; lon: string; display_name: string; name?: string }[];
  const g = j[0];
  return g ? { name: g.name || g.display_name.split(',').slice(0, 2).join(','), lat: +g.lat, lon: +g.lon } : null;
}

const fmtDist = (m: number) => `${m >= 1000 ? `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} km` : `${Math.round(m)} m`} (${(m / 1609.34).toFixed(m >= 16093 ? 0 : 1)} mi)`;
const fmtDur = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min`;
};

interface OsrmStep {
  distance: number;
  name: string;
  maneuver: { type: string; modifier?: string; exit?: number };
}

function stepText(s: OsrmStep): string {
  const road = s.name ? ` onto ${s.name}` : '';
  const mod = s.maneuver.modifier ? ` ${s.maneuver.modifier}` : '';
  switch (s.maneuver.type) {
    case 'depart':
      return `Head off${s.name ? ` along ${s.name}` : ''}`;
    case 'arrive':
      return 'Arrive';
    case 'roundabout':
    case 'rotary':
      return `At the roundabout take exit ${s.maneuver.exit ?? ''}${road}`.replace('  ', ' ');
    case 'turn':
    case 'end of road':
      return `Turn${mod}${road}`;
    case 'merge':
    case 'on ramp':
    case 'off ramp':
    case 'fork':
      return `${s.maneuver.type[0]!.toUpperCase()}${s.maneuver.type.slice(1)}${mod}${road}`;
    default:
      return `Continue${mod}${road}`;
  }
}

/** Keep at most `max` points, evenly spaced, always including both ends. */
function thin(coords: [number, number][], max: number): [number, number][] {
  if (coords.length <= max) return coords;
  const out: [number, number][] = [];
  const step = (coords.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(coords[Math.round(i * step)]!);
  return out;
}

export const travelTools: Tool[] = [
  {
    name: 'get_directions',
    description:
      'Directions between two places by car, on foot or by bike (OpenStreetMap; no public transport). Gives distance, travel time and the main turns, and draws the route on the globe. "from" defaults to the owner\'s location.',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Destination: address, place name or "lat,lon".' },
        from: { type: 'string', description: 'Start (optional; default: owner\'s location).' },
        mode: { type: 'string', enum: ['driving', 'walking', 'cycling'] },
      },
      required: ['to'],
    },
    risk: 'auto',
    async run(a, ctx) {
      const home = await ownerPlace(ctx);
      const fromQ = arg.str(a, 'from', false);
      const from = fromQ ? await geocode(fromQ, home) : home;
      if (!from) throw new Error('I need a starting point: the owner\'s location is not known yet, so give "from".');
      const to = await geocode(arg.str(a, 'to'), from);
      if (!to) throw new Error(`I could not find "${a.to}"`);
      const mode = String(a.mode ?? 'driving');
      const profile = mode === 'walking' ? 'routed-foot' : mode === 'cycling' ? 'routed-bike' : 'routed-car';
      const u = `https://routing.openstreetmap.de/${profile}/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson&steps=true`;
      const r = await fetch(u, { headers: UA });
      if (!r.ok) throw new Error(`routing service answered ${r.status}`);
      const j = (await r.json()) as { code: string; routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] }; legs: { steps: OsrmStep[] }[] }[] };
      const route = j.routes?.[0];
      if (j.code !== 'Ok' || !route) throw new Error('no route found between those places');
      const steps = route.legs.flatMap((l) => l.steps).filter((s) => s.maneuver.type !== 'new name' && (s.distance > 150 || s.maneuver.type === 'arrive' || s.maneuver.type === 'depart'));
      const lines = steps.slice(0, 14).map((s, i) => `${i + 1}. ${stepText(s)}${s.maneuver.type !== 'arrive' ? ` — ${fmtDist(s.distance)}` : ''}`);
      if (steps.length > 14) lines.push(`… ${steps.length - 14} more steps`);
      const path = thin(route.geometry.coordinates, 600).map(([lon, lat]) => [Math.round(lat * 1e5) / 1e5, Math.round(lon * 1e5) / 1e5]);
      ctx.emit({ t: 'client', name: 'show_route', args: { path, from: from.name, to: to.name, mode, distance_m: route.distance, duration_s: route.duration } });
      return `${mode === 'walking' ? 'Walking' : mode === 'cycling' ? 'Cycling' : 'Driving'} from ${from.name} to ${to.name}: ${fmtDist(route.distance)}, about ${fmtDur(route.duration)}${mode === 'driving' ? ' without traffic' : ''}. Shown on the globe.\n${lines.join('\n')}`;
    },
  },
  {
    name: 'find_nearby',
    description: 'Find places of a kind near the owner or near a named place, e.g. "pharmacy", "petrol station", "coffee", "hospital". Results come from OpenStreetMap.',
    parameters: { type: 'object', properties: { what: { type: 'string' }, near: { type: 'string', description: 'Optional place; default the owner\'s location.' } }, required: ['what'] },
    risk: 'auto',
    async run(a, ctx) {
      const home = await ownerPlace(ctx);
      const nearQ = arg.str(a, 'near', false);
      const near = nearQ ? await geocode(nearQ, home) : home;
      if (!near) throw new Error('I need a place to search near: give "near".');
      const d = 0.06;
      const u = new URL('https://nominatim.openstreetmap.org/search');
      u.searchParams.set('format', 'jsonv2');
      u.searchParams.set('limit', '8');
      u.searchParams.set('q', arg.str(a, 'what'));
      u.searchParams.set('viewbox', `${near.lon - d * 1.6},${near.lat + d},${near.lon + d * 1.6},${near.lat - d}`);
      u.searchParams.set('bounded', '1');
      const r = await fetch(u.toString(), { headers: UA });
      if (!r.ok) throw new Error(`place search answered ${r.status}`);
      const j = (await r.json()) as { lat: string; lon: string; display_name: string; name?: string; type?: string }[];
      if (!j.length) return `Nothing found for "${a.what}" within about 7 km of ${near.name}.`;
      const km = (la: number, lo: number) => {
        const R = 6371;
        const dLa = ((la - near.lat) * Math.PI) / 180;
        const dLo = ((lo - near.lon) * Math.PI) / 180;
        const x = Math.sin(dLa / 2) ** 2 + Math.cos((near.lat * Math.PI) / 180) * Math.cos((la * Math.PI) / 180) * Math.sin(dLo / 2) ** 2;
        return 2 * R * Math.asin(Math.sqrt(x));
      };
      const list = j
        .map((p) => ({ p, k: km(+p.lat, +p.lon) }))
        .sort((x, y) => x.k - y.k)
        .map(({ p, k }) => `${p.name || p.type || 'place'} — ${k.toFixed(1)} km — ${p.display_name.split(',').slice(1, 4).join(',').trim()} (${(+p.lat).toFixed(5)},${(+p.lon).toFixed(5)})`);
      return asData('OpenStreetMap', `Near ${near.name}:\n${list.join('\n')}`);
    },
  },
];
