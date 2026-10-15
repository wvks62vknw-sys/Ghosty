/**
 * Public live cameras for God's Eye — official traffic and road-weather cameras that their
 * operators publish openly (no keys):
 *   London  — Transport for London JamCams (stills every few minutes + 10 s video clips)
 *   New York City — NYC DOT traffic cameras (stills, refreshed every few seconds)
 *   California — Caltrans CCTV (stills; many also stream live video)
 *   Finland — Fintraffic road weather cameras (stills)
 *   Ontario — Ontario 511 highway cameras; British Columbia — DriveBC; Sydney/NSW — Live
 *   Traffic NSW; Calgary — City of Calgary traffic cameras; County Durham — Durham County
 *   Council traffic cameras (stills; parsers in data/intel.ts)
 * Not available: Birmingham / West Midlands and National Highways motorway cameras — their
 * operators don't publish them (God's Eye shows live TomTom traffic there instead).
 * Only public, official feeds are used — never private or unsecured cameras.
 */
import { fetchJson, fetchText } from '../api/feed';
import { Emitter } from '../core/store';
import { parseCalgary, parseDriveBc, parseDurham, parseNsw, parseOntario, type Cam } from './intel';

export interface Camera {
  id: string;
  name: string;
  lat: number;
  lon: number;
  src: 'London' | 'New York' | 'California' | 'Finland' | 'Ontario' | 'British Columbia' | 'New South Wales' | 'Calgary' | 'Durham';
  image: string;
  /** Short clip (mp4) the browser can play directly. */
  video?: string;
  /** Live stream (HLS). Played where the browser supports it (Safari, recent Chrome). */
  hls?: string;
  view?: string;
}

export const camEvents = new Emitter<{ change: void }>();
export const cams = { list: [] as Camera[], status: 'IDLE' as 'IDLE' | 'SYNC' | 'LIVE' | 'NO FEED', sources: new Set<string>() };

const add = (list: Camera[]) => {
  const seen = new Set(cams.list.map((c) => c.id));
  cams.list.push(...list.filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lon) && !seen.has(c.id)));
  camEvents.emit('change', undefined);
};

async function london(): Promise<Camera[]> {
  const j = await fetchJson<{ id: string; commonName: string; lat: number; lon: number; additionalProperties?: { key: string; value: string }[] }[]>('https://api.tfl.gov.uk/Place/Type/JamCam', 1800, 30000);
  return j.map((c) => {
    const p = Object.fromEntries((c.additionalProperties ?? []).map((x) => [x.key, x.value]));
    return { id: `tfl:${c.id}`, name: c.commonName, lat: c.lat, lon: c.lon, src: 'London' as const, image: p.imageUrl ?? '', video: p.videoUrl, view: p.view };
  }).filter((c) => c.image);
}

async function newYork(): Promise<Camera[]> {
  const j = await fetchJson<{ id: string; name: string; latitude: number; longitude: number; isOnline?: string; imageUrl: string; area?: string }[]>('https://webcams.nyctmc.org/api/cameras', 1800, 30000);
  return j.filter((c) => c.isOnline !== 'false').map((c) => ({ id: `nyc:${c.id}`, name: `${c.name}${c.area ? ` · ${c.area}` : ''}`, lat: c.latitude, lon: c.longitude, src: 'New York' as const, image: c.imageUrl }));
}

async function finland(): Promise<Camera[]> {
  const j = await fetchJson<{ features: { id: string; geometry: { coordinates: number[] }; properties: { name: string; collectionStatus?: string; presets?: { id: string; inCollection?: boolean }[] } }[] }>('https://tie.digitraffic.fi/api/weathercam/v1/stations', 1800, 30000);
  return j.features
    .filter((f) => f.properties.collectionStatus !== 'REMOVED_PERMANENTLY')
    .map((f) => {
      const preset = (f.properties.presets ?? []).find((p) => p.inCollection !== false);
      return { id: `fi:${f.id}`, name: f.properties.name.replace(/^[a-z]+\d+_/i, '').replace(/_/g, ' '), lat: f.geometry.coordinates[1]!, lon: f.geometry.coordinates[0]!, src: 'Finland' as const, image: preset ? `https://weathercam.digitraffic.fi/${preset.id}.jpg` : '' };
    })
    .filter((c) => c.image);
}

interface CaltransRow {
  cctv: {
    index: string;
    inService?: string;
    location: { locationName: string; latitude: string; longitude: string; route?: string; direction?: string; district: string };
    imageData?: { streamingVideoURL?: string; static?: { currentImageURL?: string } };
  };
}

async function california(district: number): Promise<Camera[]> {
  const dd = String(district).padStart(2, '0');
  const j = JSON.parse(await fetchText(`https://cwwp2.dot.ca.gov/data/d${district}/cctv/cctvStatusD${dd}.json`, 3600, 40000)) as { data?: CaltransRow[] };
  return (j.data ?? [])
    .filter((r) => r.cctv.inService !== 'false' && r.cctv.imageData?.static?.currentImageURL)
    .map((r) => ({
      id: `ca:${district}:${r.cctv.index}`,
      name: r.cctv.location.locationName,
      lat: Number(r.cctv.location.latitude),
      lon: Number(r.cctv.location.longitude),
      src: 'California' as const,
      image: r.cctv.imageData!.static!.currentImageURL!,
      hls: r.cctv.imageData?.streamingVideoURL || undefined,
      view: r.cctv.location.direction,
    }));
}

/** The extra networks share one shape (data/intel.ts parsers). */
const extra = (src: Camera['src'], url: string, parse: (j: unknown) => Cam[]) => async (): Promise<Camera[]> =>
  parse(await fetchJson(url, 1800, 30000)).map((c) => ({ id: c.id, name: c.name, lat: c.lat, lon: c.lon, src, image: c.img }));

let started = false;
/** Load the camera networks (once). California loads when the view is over California. */
export function loadCameras(): void {
  if (started) return;
  started = true;
  cams.status = 'SYNC';
  camEvents.emit('change', undefined);
  const jobs: [string, () => Promise<Camera[]>][] = [
    ['London', london],
    ['New York', newYork],
    ['Finland', finland],
    ['Ontario', extra('Ontario', 'https://511on.ca/api/v2/get/cameras?format=json&lang=en', parseOntario)],
    ['British Columbia', extra('British Columbia', 'https://www.drivebc.ca/api/webcams/', parseDriveBc)],
    ['New South Wales', extra('New South Wales', 'https://data.livetraffic.com/cameras/traffic-cam.json', parseNsw)],
    ['Calgary', extra('Calgary', 'https://data.calgary.ca/resource/k7p9-kppz.json?$limit=500', parseCalgary)],
    ['Durham', extra('Durham', 'https://spatial.durham.gov.uk/arcgis/rest/services/External/VectorPoint/MapServer/30/query?where=1%3D1&outFields=*&outSR=4326&f=json', parseDurham)],
  ];
  let ok = 0;
  let done = 0;
  for (const [name, job] of jobs) {
    job()
      .then((list) => {
        ok++;
        cams.sources.add(name);
        add(list);
      })
      .catch(() => undefined)
      .finally(() => {
        done++;
        cams.status = ok ? 'LIVE' : done === jobs.length ? 'NO FEED' : 'SYNC';
        camEvents.emit('change', undefined);
      });
  }
}

let caStarted = false;
/** Caltrans publishes one large file per district; fetch them only when California is in view. */
export function loadCalifornia(): void {
  if (caStarted) return;
  caStarted = true;
  void (async () => {
    for (const d of [7, 4, 11, 12, 3, 8, 6, 5, 10, 2, 1, 9]) {
      try {
        add(await california(d));
        cams.sources.add('California');
      } catch {
        /* skip a district that doesn't answer */
      }
    }
  })();
}

export const inCalifornia = (lat: number, lon: number) => lat > 32 && lat < 42.2 && lon > -124.6 && lon < -114;

/** Cameras nearest to a point (great-circle distance), closest first. */
export function nearestCameras(lat: number, lon: number, n = 4, maxKm = 400): (Camera & { km: number })[] {
  const R = 6371;
  const rad = Math.PI / 180;
  const out: (Camera & { km: number })[] = [];
  for (const c of cams.list) {
    const dLat = (c.lat - lat) * rad;
    const dLon = (c.lon - lon) * rad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * rad) * Math.cos(c.lat * rad) * Math.sin(dLon / 2) ** 2;
    const km = 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
    if (km <= maxKm) out.push({ ...c, km });
  }
  return out.sort((a, b) => a.km - b.km).slice(0, n);
}

export const CAM_COLORS: Record<Camera['src'], [number, number, number]> = {
  London: [1, 0.25, 0.3],
  'New York': [1, 0.75, 0.2],
  California: [0.3, 0.85, 1],
  Finland: [0.55, 1, 0.6],
  Ontario: [0.85, 0.5, 1],
  'British Columbia': [0.35, 1, 0.85],
  'New South Wales': [1, 0.55, 0.85],
  Calgary: [1, 0.95, 0.45],
  Durham: [0.6, 0.75, 1],
};
