/**
 * Extra GOD'S EYE intelligence feeds — all free and keyless (ships worldwide optionally
 * use a free AISstream key held by the brain). Every request goes through the brain's
 * caching proxy, so one upstream fetch serves every device.
 *
 *   cameras   parsers for the extra public camera networks (Ontario 511, DriveBC,
 *             Live Traffic NSW, Calgary) used by data/cameras.ts
 *   ships     AIS vessels: Fintraffic Digitraffic (Baltic, keyless) + AISstream (anywhere,
 *             free key) around the camera
 *   alerts    US National Weather Service warnings (polygons)
 *   disasters GDACS global disaster alerts (cyclones, floods, quakes, volcanoes, fires)
 *   buoys     NOAA NDBC buoys and marine stations (waves, wind, water temperature)
 *   aurora    NOAA SWPC OVATION aurora probability
 *   cables    TeleGeography submarine cable map
 *   dispatch  Seattle Fire Department real-time 911 calls
 *   radar     RainViewer global precipitation radar frames
 *
 * The parse* functions are pure so they can be tested without a network.
 */
import { headers } from '../api/brain';
import { Feed, fetchJson, fetchText } from '../api/feed';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Cam {
  id: string;
  name: string;
  src: string;
  lat: number;
  lon: number;
  img: string;
  video?: string;
}

export interface Ship {
  mmsi: number;
  name: string;
  lat: number;
  lon: number;
  sog: number;
  cog: number;
  hdg: number;
  type: number;
  dest: string;
  nav: number;
  t: number;
  src: string;
}

export interface Alert {
  id: string;
  event: string;
  severity: string;
  headline: string;
  area: string;
  expires: number;
  lat: number;
  lon: number;
  rings: [number, number][][];
}

export interface Disaster {
  id: string;
  kind: string;
  code: string;
  name: string;
  level: string;
  country: string;
  lat: number;
  lon: number;
  from: number;
  url: string;
  severity: string;
}

export interface Buoy {
  id: string;
  lat: number;
  lon: number;
  t: number;
  wvht?: number;
  dpd?: number;
  wspd?: number;
  gst?: number;
  wdir?: number;
  pres?: number;
  atmp?: number;
  wtmp?: number;
}

export interface Cable {
  id: string;
  name: string;
  color: string;
  lines: [number, number][][];
}

export interface Dispatch {
  id: string;
  type: string;
  addr: string;
  t: number;
  lat: number;
  lon: number;
}

export interface AuroraGrid {
  at: string;
  /** [lat, lon, probability %] for every cell with a visible chance. */
  cells: [number, number, number][];
}

const num = (v: unknown): number => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
const okLL = (lat: number, lon: number) => Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0);

// ---------------------------------------------------------------------------
// Cameras
// ---------------------------------------------------------------------------

export function parseOntario(rows: unknown): Cam[] {
  const out: Cam[] = [];
  for (const r of (Array.isArray(rows) ? rows : []) as Record<string, unknown>[]) {
    const lat = num(r.Latitude ?? r.latitude);
    const lon = num(r.Longitude ?? r.longitude);
    if (!okLL(lat, lon)) continue;
    const views = ((r.Views ?? r.views) as { Url?: string; Status?: string; Description?: string }[] | undefined) ?? [];
    const v = views.find((x) => String(x.Status).toLowerCase() === 'enabled' && /^https:\/\/511on\.ca\/map\/Cctv\/[\w.-]+$/.test(String(x.Url)));
    if (!v) continue;
    const name = [r.Roadway, r.Location ?? r.Name].filter(Boolean).join(' · ') || 'Ontario 511 camera';
    out.push({ id: `on-${r.Id ?? r.id}`, name: String(name), src: 'Ontario 511', lat, lon, img: String(v.Url) });
  }
  return out;
}

export function parseDriveBc(rows: unknown): Cam[] {
  const out: Cam[] = [];
  for (const r of (Array.isArray(rows) ? rows : []) as { id?: number; name?: string; is_on?: boolean; should_appear?: boolean; location?: { coordinates?: number[] } }[]) {
    if (r.is_on !== true || r.should_appear !== true || !Number.isSafeInteger(r.id)) continue;
    const [lon, lat] = r.location?.coordinates ?? [];
    if (!okLL(num(lat), num(lon))) continue;
    out.push({ id: `bc-${r.id}`, name: r.name ?? `DriveBC ${r.id}`, src: 'DriveBC', lat: num(lat), lon: num(lon), img: `https://www.drivebc.ca/images/${r.id}.jpg` });
  }
  return out;
}

export function parseNsw(payload: unknown): Cam[] {
  const out: Cam[] = [];
  for (const f of ((payload as { features?: unknown[] })?.features ?? []) as { id?: string; geometry?: { coordinates?: number[] }; properties?: { href?: string; title?: string; view?: string } }[]) {
    const [lon, lat] = f.geometry?.coordinates ?? [];
    const href = String(f.properties?.href ?? '');
    if (!okLL(num(lat), num(lon)) || !href.startsWith('https://webcams.transport.nsw.gov.au/')) continue;
    out.push({ id: `nsw-${f.id}`, name: f.properties?.title ?? f.properties?.view ?? 'NSW camera', src: 'Live Traffic NSW', lat: num(lat), lon: num(lon), img: href });
  }
  return out;
}

export function parseCalgary(rows: unknown): Cam[] {
  const out: Cam[] = [];
  for (const r of (Array.isArray(rows) ? rows : []) as { camera_url?: { url?: string; description?: string }; point?: { coordinates?: number[] }; camera_location?: string }[]) {
    const [lon, lat] = r.point?.coordinates ?? [];
    const img = String(r.camera_url?.url ?? '').replace(/^http:/, 'https:');
    if (!okLL(num(lat), num(lon)) || !img.startsWith('https://trafficcam.calgary.ca/')) continue;
    out.push({ id: `yyc-${img.split('/').pop()}`, name: r.camera_location ?? r.camera_url?.description ?? 'Calgary camera', src: 'City of Calgary', lat: num(lat), lon: num(lon), img });
  }
  return out;
}

/** Durham County Council traffic cameras (ArcGIS layer; pictures on dcc.ussgroup.co.uk). */
export function parseDurham(j: unknown): Cam[] {
  const out: Cam[] = [];
  const feats = ((j as { features?: unknown[] } | null)?.features ?? []) as { attributes?: { Camera_Nam?: string; Camera_Vie?: string; Status?: string; USS_Camera_Number?: string }; geometry?: { x?: number; y?: number } }[];
  for (const f of feats) {
    const a = f.attributes ?? {};
    const id = String(a.USS_Camera_Number ?? '').toLowerCase();
    const lat = num(f.geometry?.y);
    const lon = num(f.geometry?.x);
    if (!/^[a-z0-9_]+$/.test(id) || !okLL(lat, lon) || (a.Status && !/live/i.test(a.Status))) continue;
    out.push({ id: `dur-${id}`, name: `${a.Camera_Nam ?? 'Durham camera'}${a.Camera_Vie ? ` · ${a.Camera_Vie}` : ''}`, src: 'Durham County Council', lat, lon, img: `https://dcc.ussgroup.co.uk/images/${id}.jpg` });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Ships
// ---------------------------------------------------------------------------

export function parseDigitrafficShips(locations: unknown, vessels: unknown, now = Date.now()): Ship[] {
  const meta = new Map<number, { name?: string; shipType?: number; destination?: string }>();
  for (const v of (Array.isArray(vessels) ? vessels : []) as { mmsi: number; name?: string; shipType?: number; destination?: string }[]) meta.set(v.mmsi, v);
  const out: Ship[] = [];
  for (const f of ((locations as { features?: unknown[] })?.features ?? []) as { mmsi?: number; geometry?: { coordinates?: number[] }; properties?: { mmsi?: number; sog?: number; cog?: number; heading?: number; navStat?: number; timestampExternal?: number } }[]) {
    const p = f.properties ?? {};
    const mmsi = p.mmsi ?? f.mmsi;
    const [lon, lat] = f.geometry?.coordinates ?? [];
    if (!mmsi || !okLL(num(lat), num(lon))) continue;
    const t = p.timestampExternal ?? now;
    if (now - t > 30 * 60_000) continue; // stale positions
    const m = meta.get(mmsi);
    out.push({ mmsi, name: (m?.name ?? '').trim(), lat: num(lat), lon: num(lon), sog: p.sog ?? 0, cog: p.cog ?? 0, hdg: p.heading != null && p.heading < 360 ? p.heading : p.cog ?? 0, type: m?.shipType ?? 0, dest: (m?.destination ?? '').trim(), nav: p.navStat ?? 15, t, src: 'Digitraffic' });
  }
  return out;
}

export function shipKind(type: number): string {
  if (type === 30) return 'FISHING';
  if (type === 31 || type === 32 || type === 52) return 'TUG';
  if (type === 35) return 'MILITARY';
  if (type === 36 || type === 37) return 'LEISURE';
  if (type >= 40 && type < 50) return 'HIGH-SPEED';
  if (type === 50 || type === 51 || type === 55 || type === 58) return 'SERVICE';
  if (type >= 60 && type < 70) return 'PASSENGER';
  if (type >= 70 && type < 80) return 'CARGO';
  if (type >= 80 && type < 90) return 'TANKER';
  return 'VESSEL';
}

export const SHIP_COLORS: Record<string, [number, number, number]> = {
  CARGO: [0.35, 0.85, 0.45],
  TANKER: [1, 0.45, 0.35],
  PASSENGER: [0.35, 0.65, 1],
  FISHING: [1, 0.8, 0.3],
  TUG: [0.8, 0.6, 1],
  MILITARY: [1, 0.25, 0.25],
  LEISURE: [0.95, 0.5, 0.85],
  'HIGH-SPEED': [0.3, 1, 1],
  SERVICE: [1, 1, 0.5],
  VESSEL: [0.75, 0.8, 0.85],
};

export const NAV_STATUS = ['under way (engine)', 'at anchor', 'not under command', 'restricted manoeuvrability', 'constrained by draught', 'moored', 'aground', 'fishing', 'under way (sailing)'];

const BALTIC: [number, number, number, number] = [9, 53, 31, 66.5];

/** Ships near the camera. Digitraffic covers the Baltic without a key; the brain adds AISstream anywhere when a free key is saved. */
export class ShipFeed {
  list = new Map<number, Ship>();
  status: 'IDLE' | 'LIVE' | 'STALE' | 'NO FEED' = 'IDLE';
  note = '';
  private busy = false;
  private balticAt = 0;
  private vessels: unknown = null;

  async refresh(lat: number, lon: number, rangeKm: number): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    let ok = false;
    try {
      const near = (b: [number, number, number, number]) => lon > b[0] - 15 && lon < b[2] + 15 && lat > b[1] - 10 && lat < b[3] + 6;
      const jobs: Promise<void>[] = [];
      if (near(BALTIC) && Date.now() - this.balticAt > 55_000) {
        jobs.push(
          (async () => {
            const [loc, ves] = await Promise.all([
              fetchJson('https://meri.digitraffic.fi/api/ais/v1/locations', 60, 30000),
              this.vessels ? Promise.resolve(this.vessels) : fetchJson('https://meri.digitraffic.fi/api/ais/v1/vessels', 21600, 30000),
            ]);
            this.vessels = ves;
            for (const s of parseDigitrafficShips(loc, ves)) this.list.set(s.mmsi, s);
            this.balticAt = Date.now();
            ok = true;
          })(),
        );
      }
      if (rangeKm < 3000) {
        jobs.push(
          (async () => {
            const d = Math.min(8, Math.max(0.3, rangeKm / 111));
            const box = [lon - d / Math.max(0.2, Math.cos((lat * Math.PI) / 180)), lat - d, lon + d / Math.max(0.2, Math.cos((lat * Math.PI) / 180)), lat + d].map((x) => x.toFixed(3)).join(',');
            const r = await fetch(`/api/ships?bbox=${box}`, { headers: headers() });
            const j = (await r.json()) as { ships?: Ship[]; note?: string };
            this.note = j.note ?? '';
            for (const s of j.ships ?? []) {
              const old = this.list.get(s.mmsi);
              this.list.set(s.mmsi, { ...s, name: s.name || old?.name || '', type: s.type || old?.type || 0, dest: s.dest || old?.dest || '' });
            }
            if (j.ships?.length) ok = true;
          })(),
        );
      }
      await Promise.allSettled(jobs);
      const cut = Date.now() - 40 * 60_000;
      for (const [k, s] of this.list) if (s.t < cut) this.list.delete(k);
      this.status = ok ? 'LIVE' : this.list.size ? 'STALE' : jobs.length ? 'NO FEED' : 'IDLE';
    } finally {
      this.busy = false;
    }
  }

  /** Dead-reckoned position (speed over ground in knots). */
  pos(s: Ship, now = Date.now()): { lat: number; lon: number } {
    const dt = Math.min(600, Math.max(0, (now - s.t) / 1000));
    if (s.sog < 0.5 || s.sog > 60) return s;
    const d = (s.sog * 0.000514444 * dt) / 6371;
    const b = (s.cog * Math.PI) / 180;
    const la = (s.lat * Math.PI) / 180;
    const lo = (s.lon * Math.PI) / 180;
    const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
    const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
    return { lat: (la2 * 180) / Math.PI, lon: (lo2 * 180) / Math.PI };
  }

  find(q: string): Ship | null {
    const s = q.toLowerCase().trim();
    if (!s) return null;
    for (const v of this.list.values()) if (String(v.mmsi) === s || v.name.toLowerCase() === s) return v;
    for (const v of this.list.values()) if (v.name.toLowerCase().startsWith(s)) return v;
    return null;
  }
}

export const ships = new ShipFeed();

// ---------------------------------------------------------------------------
// Weather alerts, disasters, buoys, aurora, cables, dispatch, radar
// ---------------------------------------------------------------------------

export function parseNws(payload: unknown, now = Date.now()): Alert[] {
  const out: Alert[] = [];
  for (const f of ((payload as { features?: unknown[] })?.features ?? []) as { id?: string; geometry?: { type: string; coordinates: number[][][] | number[][][][] } | null; properties?: Record<string, string> }[]) {
    const g = f.geometry;
    if (!g) continue;
    const polys = (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []) as number[][][][];
    const rings = polys.map((p) => (p[0] ?? []).map(([x, y]) => [y!, x!] as [number, number])).filter((r) => r.length > 2);
    if (!rings.length) continue;
    const p = f.properties ?? {};
    const expires = Date.parse(p.ends || p.expires || '') || now + 3.6e6;
    if (expires < now) continue;
    let la = 0;
    let lo = 0;
    for (const [a, b] of rings[0]!) {
      la += a;
      lo += b;
    }
    out.push({ id: p.id ?? f.id ?? String(out.length), event: p.event ?? 'Alert', severity: p.severity ?? 'Unknown', headline: p.headline ?? '', area: p.areaDesc ?? '', expires, lat: la / rings[0]!.length, lon: lo / rings[0]!.length, rings });
  }
  return out;
}

export const ALERT_COLORS: Record<string, [number, number, number]> = {
  Extreme: [1, 0.15, 0.3],
  Severe: [1, 0.45, 0.15],
  Moderate: [1, 0.8, 0.2],
  Minor: [0.4, 0.8, 1],
  Unknown: [0.7, 0.7, 0.8],
};

export const alerts = new Feed<Alert[]>('alerts', async () => parseNws(await fetchJson('https://api.weather.gov/alerts/active?status=actual&message_type=alert', 300, 30000)), 300_000);

const GDACS_KIND: Record<string, string> = { EQ: 'EARTHQUAKE', TC: 'CYCLONE', FL: 'FLOOD', VO: 'VOLCANO', DR: 'DROUGHT', WF: 'WILDFIRE', TS: 'TSUNAMI' };

export function parseGdacs(payload: unknown): Disaster[] {
  const seen = new Set<string>();
  const out: Disaster[] = [];
  for (const f of ((payload as { features?: unknown[] })?.features ?? []) as { geometry?: { type?: string; coordinates?: number[] }; properties?: Record<string, unknown> }[]) {
    if (f.geometry?.type !== 'Point') continue;
    const p = f.properties ?? {};
    const id = `${p.eventtype}-${p.eventid}`;
    if (seen.has(id)) continue;
    const [lon, lat] = f.geometry.coordinates ?? [];
    if (!okLL(num(lat), num(lon))) continue;
    seen.add(id);
    out.push({
      id,
      code: String(p.eventtype ?? ''),
      kind: GDACS_KIND[String(p.eventtype)] ?? String(p.eventtype ?? 'EVENT'),
      name: String(p.name ?? p.eventname ?? ''),
      level: String(p.alertlevel ?? 'Green'),
      country: String(p.country ?? ''),
      lat: num(lat),
      lon: num(lon),
      from: Date.parse(String(p.fromdate ?? '')) || 0,
      url: String((p.url as { report?: string } | undefined)?.report ?? ''),
      severity: String((p.severitydata as { severitytext?: string } | undefined)?.severitytext ?? ''),
    });
  }
  return out;
}

export const disasters = new Feed<Disaster[]>('disasters', async () => parseGdacs(await fetchJson('https://www.gdacs.org/gdacsapi/api/events/geteventlist/EVENTS4APP', 900, 30000)), 900_000);

/** NDBC latest_obs.txt: whitespace columns, "MM" = missing. */
export function parseNdbc(text: string): Buoy[] {
  const lines = text.split('\n');
  const head = lines.find((l) => l.startsWith('#STN') || l.startsWith('#'))?.replace(/^#/, '').trim().split(/\s+/) ?? [];
  const at = (name: string) => head.indexOf(name);
  const out: Buoy[] = [];
  for (const l of lines) {
    if (!l.trim() || l.startsWith('#')) continue;
    const c = l.trim().split(/\s+/);
    const v = (name: string) => {
      const i = at(name);
      const x = i >= 0 ? c[i] : undefined;
      return x && x !== 'MM' ? Number(x) : undefined;
    };
    const lat = v('LAT');
    const lon = v('LON');
    if (lat === undefined || lon === undefined || !okLL(lat, lon)) continue;
    const t = Date.UTC(v('YYYY') ?? 1970, (v('MM') ?? 1) - 1, v('DD') ?? 1, v('hh') ?? 0, v('mm') ?? 0);
    out.push({ id: c[at('STN')] ?? c[0]!, lat, lon, t, wvht: v('WVHT'), dpd: v('DPD'), wspd: v('WSPD'), gst: v('GST'), wdir: v('WDIR'), pres: v('PRES'), atmp: v('ATMP'), wtmp: v('WTMP') });
  }
  return out;
}

export const buoys = new Feed<Buoy[]>('buoys', async () => parseNdbc(await fetchText('https://www.ndbc.noaa.gov/data/latest_obs/latest_obs.txt', 900, 30000)), 1_800_000);

export function parseAurora(payload: unknown, min = 8): AuroraGrid {
  const p = payload as { 'Forecast Time'?: string; coordinates?: number[][] };
  const cells: [number, number, number][] = [];
  for (const c of p.coordinates ?? []) {
    const [lon, lat, v] = c as [number, number, number];
    if (v >= min) cells.push([lat, lon > 180 ? lon - 360 : lon, v]);
  }
  return { at: p['Forecast Time'] ?? '', cells };
}

export const aurora = new Feed<AuroraGrid>('aurora', async () => parseAurora(await fetchJson('https://services.swpc.noaa.gov/json/ovation_aurora_latest.json', 600, 30000)), 900_000);

export function parseCables(payload: unknown): Cable[] {
  const out: Cable[] = [];
  for (const f of ((payload as { features?: unknown[] })?.features ?? []) as { geometry?: { type: string; coordinates: number[][] | number[][][] }; properties?: { id?: string; name?: string; color?: string } }[]) {
    const g = f.geometry;
    if (!g) continue;
    const parts = (g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : []) as number[][][];
    const lines = parts.map((l) => l.map(([x, y]) => [y!, x!] as [number, number])).filter((l) => l.length > 1);
    if (lines.length) out.push({ id: f.properties?.id ?? String(out.length), name: f.properties?.name ?? 'Cable', color: f.properties?.color ?? '#3ad', lines });
  }
  return out;
}

export const cables = new Feed<Cable[]>('cables', async () => parseCables(await fetchJson('https://www.submarinecablemap.com/api/v3/cable/cable-geo.json', 86400, 45000)), 86_400_000);

export function parseDispatch(rows: unknown, now = Date.now()): Dispatch[] {
  const out: Dispatch[] = [];
  for (const r of (Array.isArray(rows) ? rows : []) as { incident_number?: string; type?: string; address?: string; datetime?: string; latitude?: string; longitude?: string }[]) {
    const lat = num(r.latitude);
    const lon = num(r.longitude);
    // Socrata gives Seattle local time without a zone; treat as Pacific (UTC-7/-8 ≈ -7.5h tolerance).
    const t = Date.parse(`${r.datetime ?? ''}Z`) + 7.5 * 3.6e6;
    if (!okLL(lat, lon) || now - t > 24 * 3.6e6) continue;
    out.push({ id: r.incident_number ?? String(out.length), type: r.type ?? 'Call', addr: r.address ?? '', t, lat, lon });
  }
  return out;
}

export const dispatch = new Feed<Dispatch[]>('dispatch', async () => parseDispatch(await fetchJson('https://data.seattle.gov/resource/kzjm-xkqj.json?$order=datetime%20DESC&$limit=400', 120, 30000)), 180_000);

export const radarFrames = new Feed<{ host: string; path: string; time: number }>(
  'radar',
  async () => {
    const j = await fetchJson<{ host: string; radar: { past: { time: number; path: string }[] } }>('https://api.rainviewer.com/public/weather-maps.json', 300, 15000);
    const f = j.radar.past[j.radar.past.length - 1];
    if (!f) throw new Error('no radar frame');
    return { host: j.host, path: f.path, time: f.time * 1000 };
  },
  600_000,
);
