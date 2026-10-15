/**
 * Live road traffic (TomTom, free key "tomtom" in the vault) and where God's Eye has public
 * cameras. The interface never sees the key: flow tiles come through /api/traffic/tile/z/x/y,
 * and the traffic tools ask TomTom from here.
 *
 * Cameras: only official, public feeds (see apps/web/src/data/cameras.ts). Many councils —
 * Birmingham, and National Highways' motorway cameras — do not publish theirs, so a place can
 * have live traffic speeds and incidents but no camera picture.
 */
import type { Vault } from '../kernel/vault';

/** Areas with public cameras in God's Eye (centre + rough radius, km). Keep in sync with data/cameras.ts. */
export const CAMERA_AREAS: { name: string; lat: number; lon: number; km: number }[] = [
  { name: 'London (TfL JamCams)', lat: 51.507, lon: -0.128, km: 30 },
  { name: 'County Durham (Durham County Council)', lat: 54.73, lon: -1.6, km: 30 },
  { name: 'New York City (NYC DOT)', lat: 40.73, lon: -73.95, km: 30 },
  { name: 'Los Angeles (Caltrans)', lat: 34.05, lon: -118.25, km: 80 },
  { name: 'San Francisco Bay Area (Caltrans)', lat: 37.7, lon: -122.2, km: 80 },
  { name: 'San Diego (Caltrans)', lat: 32.8, lon: -117.1, km: 50 },
  { name: 'Sacramento (Caltrans)', lat: 38.58, lon: -121.5, km: 60 },
  { name: 'Finland (Fintraffic)', lat: 62.5, lon: 25.5, km: 450 },
  { name: 'Ontario (511ON)', lat: 43.8, lon: -79.5, km: 200 },
  { name: 'British Columbia (DriveBC)', lat: 49.4, lon: -122.5, km: 250 },
  { name: 'Sydney / NSW (Live Traffic NSW)', lat: -33.87, lon: 151.1, km: 120 },
  { name: 'Calgary (City of Calgary)', lat: 51.05, lon: -114.07, km: 25 },
];

const toRad = Math.PI / 180;
export function km(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = (bLat - aLat) * toRad;
  const dLon = (bLon - aLon) * toRad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * toRad) * Math.cos(bLat * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** The camera area that covers (or is nearest to) a point; `away` = km outside its edge (0 = inside). */
export function cameraCoverage(lat: number, lon: number): { area: string; away: number } {
  let best = { area: CAMERA_AREAS[0]!.name, away: Infinity };
  for (const a of CAMERA_AREAS) {
    const away = Math.max(0, km(lat, lon, a.lat, a.lon) - a.km);
    if (away < best.away) best = { area: a.name, away };
  }
  return best;
}

export interface Flow {
  road: string;
  currentKmh: number;
  freeKmh: number;
  delaySec: number;
  closed: boolean;
  confidence: number;
}

const TT = 'https://api.tomtom.com';

export class TrafficError extends Error {}

async function tt<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (r.status === 401 || r.status === 403) throw new TrafficError('TomTom did not accept the traffic key. Check it in the System tab (TomTom traffic).');
  if (r.status === 429) throw new TrafficError('TomTom traffic limit reached for today; it resets tomorrow.');
  if (!r.ok) throw new TrafficError(`TomTom traffic answered ${r.status}`);
  return (await r.json()) as T;
}

/** Speed on the road nearest to a point, now vs free-flowing. */
export async function flowAt(key: string, lat: number, lon: number): Promise<Flow | null> {
  type Seg = { flowSegmentData?: { frc?: string; currentSpeed: number; freeFlowSpeed: number; currentTravelTime: number; freeFlowTravelTime: number; confidence: number; roadClosure: boolean } };
  const j: Seg = await tt<Seg>(
    `${TT}/traffic/services/4/flowSegmentData/absolute/12/json?point=${lat.toFixed(5)},${lon.toFixed(5)}&unit=KMPH&key=${encodeURIComponent(key)}`,
  ).catch((e) => {
    if (e instanceof TrafficError && /answered 400/.test(e.message)) return {} as Seg;
    throw e;
  });
  const f = j.flowSegmentData;
  if (!f) return null;
  return { road: f.frc ?? '', currentKmh: f.currentSpeed, freeKmh: f.freeFlowSpeed, delaySec: Math.max(0, f.currentTravelTime - f.freeFlowTravelTime), closed: f.roadClosure, confidence: f.confidence };
}

export interface Incident {
  kind: string;
  what: string;
  from: string;
  to: string;
  roads: string;
  delaySec: number;
  severity: number;
  lat: number;
  lon: number;
}

const ICON: Record<number, string> = { 0: 'Unknown', 1: 'Accident', 2: 'Fog', 3: 'Dangerous conditions', 4: 'Rain', 5: 'Ice', 6: 'Queue', 7: 'Lane closed', 8: 'Road closed', 9: 'Roadworks', 10: 'Wind', 11: 'Flooding', 14: 'Broken-down vehicle' };

/** Incidents (crashes, closures, queues, roadworks) in a box around a point, worst first. */
export async function incidentsNear(key: string, lat: number, lon: number, radiusKm: number): Promise<Incident[]> {
  const dLat = radiusKm / 111;
  const dLon = radiusKm / (111 * Math.max(0.2, Math.cos(lat * toRad)));
  const bbox = [lon - dLon, lat - dLat, lon + dLon, lat + dLat].map((v) => v.toFixed(4)).join(',');
  const fields = '{incidents{geometry{type,coordinates},properties{iconCategory,magnitudeOfDelay,events{description},from,to,delay,roadNumbers}}}';
  const j = await tt<{ incidents?: { geometry: { type: string; coordinates: number[] | number[][] }; properties: { iconCategory: number; magnitudeOfDelay: number; events?: { description: string }[]; from?: string; to?: string; delay?: number; roadNumbers?: string[] } }[] }>(
    `${TT}/traffic/services/5/incidentDetails?bbox=${bbox}&fields=${encodeURIComponent(fields)}&language=en-GB&timeValidityFilter=present&key=${encodeURIComponent(key)}`,
  );
  return (j.incidents ?? [])
    .map((i) => {
      const c = i.geometry.type === 'Point' ? (i.geometry.coordinates as number[]) : ((i.geometry.coordinates as number[][])[0] ?? [lon, lat]);
      const p = i.properties;
      return {
        kind: ICON[p.iconCategory] ?? 'Incident',
        what: (p.events ?? []).map((e) => e.description).join('; '),
        from: p.from ?? '',
        to: p.to ?? '',
        roads: (p.roadNumbers ?? []).join('/'),
        delaySec: p.delay ?? 0,
        severity: p.magnitudeOfDelay,
        lat: c[1]!,
        lon: c[0]!,
      };
    })
    .sort((a, b) => b.severity - a.severity || b.delaySec - a.delaySec);
}

/** /traffic/status and /traffic/tile/z/x/y (TomTom flow tiles, key added here). */
export async function trafficRoute(path: string, method: string, vault: Vault): Promise<Response> {
  const key = await vault.get('tomtom');
  if (path === '/traffic/status' && method === 'GET') return Response.json({ ready: !!key });
  const m = path.match(/^\/traffic\/tile\/(\d{1,2})\/(\d{1,7})\/(\d{1,7})$/);
  if (m && method === 'GET') {
    if (!key) return new Response('no traffic key', { status: 404 });
    const [z, x, y] = [+m[1]!, +m[2]!, +m[3]!];
    if (z > 18 || x >= 2 ** z || y >= 2 ** z) return new Response('bad tile', { status: 400 });
    const r = await fetch(`${TT}/traffic/map/4/tile/flow/relative0-dark/${z}/${x}/${y}.png?tileSize=256&thickness=6&key=${encodeURIComponent(key)}`);
    if (!r.ok) return new Response(`traffic tile ${r.status}`, { status: r.status === 403 || r.status === 401 ? 502 : r.status });
    return new Response(r.body, { headers: { 'content-type': 'image/png', 'cache-control': 'private, max-age=120' } });
  }
  return Response.json({ error: 'not found' }, { status: 404 });
}
