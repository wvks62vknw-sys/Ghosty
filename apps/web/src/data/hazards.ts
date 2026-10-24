/** Live hazards: earthquakes (USGS), natural events (NASA EONET), launches (LL2), space weather (NOAA). */
import { Feed, fetchJson } from '../api/feed';

export interface Quake {
  id: string;
  mag: number;
  place: string;
  t: number;
  lat: number;
  lon: number;
  depth: number;
  url: string;
  tsunami: number;
  alert: string | null;
}
export interface NaturalEvent {
  id: string;
  title: string;
  cat: string;
  catName: string;
  lat: number;
  lon: number;
  t: number;
  url: string;
}
export interface Launch {
  id: string;
  name: string;
  net: number;
  status: string;
  pad: string;
  provider: string;
  lat: number;
  lon: number;
}

export const quakes = new Feed<Quake[]>(
  'quakes',
  async () => {
    const j = await fetchJson<{ features: { id: string; properties: { mag: number; place: string; time: number; url: string; tsunami: number; alert: string | null }; geometry: { coordinates: number[] } }[] }>(
      'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',
      300,
    );
    return j.features
      .map((f) => ({ id: f.id, mag: f.properties.mag ?? 0, place: f.properties.place ?? '', t: f.properties.time, lat: f.geometry.coordinates[1]!, lon: f.geometry.coordinates[0]!, depth: f.geometry.coordinates[2] ?? 0, url: f.properties.url, tsunami: f.properties.tsunami, alert: f.properties.alert }))
      .sort((a, b) => b.mag - a.mag);
  },
  300_000,
);

export const EVENT_COLORS: Record<string, [number, number, number]> = {
  wildfires: [1, 0.5, 0.15],
  severeStorms: [0.5, 0.75, 1],
  volcanoes: [1, 0.25, 0.2],
  seaLakeIce: [0.85, 0.95, 1],
  floods: [0.3, 0.6, 1],
  drought: [0.9, 0.75, 0.4],
  dustHaze: [0.8, 0.65, 0.4],
  landslides: [0.7, 0.5, 0.3],
  tempExtremes: [1, 0.4, 0.4],
};

export const events = new Feed<NaturalEvent[]>(
  'events',
  async () => {
    const j = await fetchJson<{ events: { id: string; title: string; link: string; categories: { id: string; title: string }[]; sources?: { url: string }[]; geometry: { type: string; date: string; coordinates: number[] }[] }[] }>(
      'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=150',
      900,
    );
    return j.events
      .map((e) => {
        const g = e.geometry[e.geometry.length - 1];
        if (!g || g.type !== 'Point') return null;
        return { id: e.id, title: e.title, cat: e.categories[0]?.id ?? '', catName: e.categories[0]?.title ?? '', lon: g.coordinates[0]!, lat: g.coordinates[1]!, t: Date.parse(g.date), url: e.sources?.[0]?.url ?? e.link };
      })
      .filter((x): x is NaturalEvent => !!x);
  },
  900_000,
);

export const launches = new Feed<Launch[]>(
  'launches',
  async () => {
    const j = await fetchJson<{ results: { id: string; name: string; net: string; status?: { abbrev: string }; pad?: { name: string; latitude: string; longitude: string }; launch_service_provider?: { name: string } }[] }>(
      // (the full answer, about 37 KB for 8: the lighter mode=list has no pad coordinates, and every launch was dropped)
      'https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=8',
      1800,
    );
    return j.results
      .map((l) => ({ id: l.id, name: l.name, net: Date.parse(l.net), status: l.status?.abbrev ?? '', pad: l.pad?.name ?? '', provider: l.launch_service_provider?.name ?? '', lat: parseFloat(l.pad?.latitude ?? ''), lon: parseFloat(l.pad?.longitude ?? '') }))
      .filter((l) => Number.isFinite(l.lat));
  },
  1_800_000,
);

/** A launch's status in plain words (Launch Library's abbreviations: Go, TBD, TBC, Success, Hold…). */
export function launchStatus(abbrev: string): string {
  const m: Record<string, string> = { go: 'GO', tbd: 'DATE NOT SET', tbc: 'TO CONFIRM', success: 'LAUNCHED', failure: 'FAILED', 'partial failure': 'PART FAILED', hold: 'ON HOLD', 'in flight': 'IN FLIGHT' };
  return m[abbrev.trim().toLowerCase()] ?? (abbrev.trim().toUpperCase() || 'PLANNED');
}

export const kp = new Feed<{ v: number; t: string }>(
  'kp',
  async () => {
    // NOAA serves this file as objects now ({ time_tag, Kp }, newest last); it used to be rows of strings with a
    // header row (["time_tag", "Kp", …]). Read either; a reading that is not a number is no reading (NO FEED).
    const j = await fetchJson<(string[] | { time_tag?: string; Kp?: number | string })[]>('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json', 600);
    const r = j[j.length - 1];
    const v = Array.isArray(r) ? parseFloat(r[1] ?? '') : Number(r?.Kp);
    const t = Array.isArray(r) ? r[0] ?? '' : r?.time_tag ?? '';
    if (!Number.isFinite(v)) throw new Error('no Kp reading in NOAA’s file');
    return { v, t };
  },
  600_000,
);

export interface Signal {
  kind: string;
  sev: 0 | 1 | 2 | 3;
  text: string;
  lat: number;
  lon: number;
  at: number;
  tag: string;
}

/** One combined, severity-sorted list of everything that might matter. */
export function signals(extra: Signal[] = []): Signal[] {
  const out: Signal[] = [...extra];
  for (const q of quakes.data ?? []) {
    if (q.mag < 4.5) continue;
    out.push({ kind: 'QUAKE', sev: q.mag >= 7 ? 3 : q.mag >= 6 ? 2 : q.mag >= 5 ? 1 : 0, text: `M${q.mag.toFixed(1)} · ${q.place}`, lat: q.lat, lon: q.lon, at: q.t, tag: `M${q.mag.toFixed(1)}` });
  }
  const evSev: Record<string, 0 | 1 | 2> = { volcanoes: 2, severeStorms: 2, wildfires: 1, floods: 1, tempExtremes: 1, landslides: 1 };
  for (const e of events.data ?? []) out.push({ kind: (e.catName || 'EVENT').toUpperCase().slice(0, 12), sev: evSev[e.cat] ?? 0, text: e.title, lat: e.lat, lon: e.lon, at: e.t, tag: '' });
  return out.sort((a, b) => b.sev - a.sev || b.at - a.at);
}

/**
 * The level and why. With neither the quake nor the event feed in hand it is never CLEAR: an empty list then means
 * "not checked", so the label says CHECKING (still on its way) or CAN’T CHECK (both unreachable), `known` is false.
 */
export function threatLevel(list = signals()): { n: 0 | 1 | 2 | 3; label: string; why: string; known: boolean } {
  if (!quakes.data && !events.data) {
    const down = quakes.status === 'NO FEED' && events.status === 'NO FEED';
    return { n: 0, label: down ? 'CAN’T CHECK' : 'CHECKING', why: down ? 'can’t reach the quake and storm feeds right now, so this is not an all-clear.' : 'fetching quakes and storms…', known: false };
  }
  const n = list.reduce<number>((m, x) => Math.max(m, x.sev), 0) as 0 | 1 | 2 | 3;
  const major = list.filter((x) => x.sev >= 2).length;
  const gap = !quakes.data ? 'the quake feed' : !events.data ? 'the storm and fire feed' : '';
  return { n, label: ['CLEAR', 'WATCH', 'ELEVATED', 'SEVERE'][n]!, why: `${major ? `${major} major signals` : `${list.length} signals`}${gap ? ` · can’t reach ${gap}` : ''}`, known: true };
}
