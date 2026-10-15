/**
 * Road enforcement and surveillance cameras from OpenStreetMap: ANPR (number-plate
 * readers), speed cameras, average-speed zones, red-light cameras and mapped CCTV.
 * These are locations volunteers have mapped in public — there are no images, and
 * nothing here identifies or follows people. Loaded for the area under the globe
 * camera when zoomed in (Overpass API, the same mirrors the 3D buildings use).
 */
import { Emitter } from '../core/store';

export type EnforceKind = 'anpr' | 'speed' | 'average' | 'redlight' | 'buslane' | 'cctv';

export interface EnforceCam {
  id: string;
  kind: EnforceKind;
  lat: number;
  lon: number;
  name: string;
  operator: string;
  maxspeed: string;
  direction: string;
  ref: string;
  tags: Record<string, string>;
}

export const ENFORCE_LABEL: Record<EnforceKind, string> = {
  anpr: 'ANPR · NUMBER-PLATE READER',
  speed: 'SPEED CAMERA',
  average: 'AVERAGE-SPEED CAMERA',
  redlight: 'RED-LIGHT CAMERA',
  buslane: 'BUS-LANE CAMERA',
  cctv: 'CCTV (MAPPED)',
};

export const ENFORCE_COLORS: Record<EnforceKind, [number, number, number]> = {
  anpr: [1, 0.2, 0.75],
  speed: [1, 0.85, 0.1],
  average: [1, 0.55, 0.1],
  redlight: [1, 0.2, 0.2],
  buslane: [0.3, 0.6, 1],
  cctv: [0.6, 0.85, 1],
};

/** Decide what an OSM element is from its tags (null = not a camera we show). */
export function classify(t: Record<string, string>): EnforceKind | null {
  const st = (t['surveillance:type'] ?? '').toLowerCase();
  const all = `${st} ${t['camera:type'] ?? ''} ${t.name ?? ''} ${t.description ?? ''} ${t.surveillance ?? ''}`.toLowerCase();
  if (st === 'alpr' || st === 'anpr' || /\b(anpr|alpr|lpr|number[- ]?plate|license[- ]?plate|licence[- ]?plate)\b/.test(all)) return 'anpr';
  const enf = (t.enforcement ?? '').toLowerCase();
  if (enf === 'average_speed') return 'average';
  if (enf === 'maxspeed' || t.highway === 'speed_camera') return 'speed';
  if (enf === 'traffic_signals' || /red[- ]?light/.test(all)) return 'redlight';
  if (/bus[- ]?lane|bus[- ]?gate/.test(all) || enf === 'bus_lane') return 'buslane';
  if (t.man_made === 'surveillance') return 'cctv';
  return null;
}

interface OsmEl {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export function parseOverpass(j: unknown): EnforceCam[] {
  const out: EnforceCam[] = [];
  for (const e of ((j as { elements?: OsmEl[] })?.elements ?? [])) {
    const t = e.tags ?? {};
    const kind = classify(t);
    const lat = e.lat ?? e.center?.lat;
    const lon = e.lon ?? e.center?.lon;
    if (!kind || lat == null || lon == null) continue;
    out.push({
      id: `${e.type}/${e.id}`,
      kind,
      lat,
      lon,
      name: t.name ?? '',
      operator: t.operator ?? '',
      maxspeed: t.maxspeed ?? '',
      direction: t['camera:direction'] ?? t.direction ?? '',
      ref: t.ref ?? '',
      tags: t,
    });
  }
  return out;
}

export function overpassQuery([s, w, n, e]: [number, number, number, number]): string {
  const b = `${s.toFixed(4)},${w.toFixed(4)},${n.toFixed(4)},${e.toFixed(4)}`;
  return `[out:json][timeout:25];(node["highway"="speed_camera"](${b});node["man_made"="surveillance"](${b});way["man_made"="surveillance"](${b});relation["type"="enforcement"](${b}););out center tags 4000;`;
}

const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

/** Cameras around the globe camera; areas already loaded are not fetched again. */
export class EnforceFeed {
  list = new Map<string, EnforceCam>();
  status: 'IDLE' | 'SYNC' | 'LIVE' | 'NO FEED' = 'IDLE';
  readonly events = new Emitter<{ change: void }>();
  private done = new Set<string>();
  private busy = false;

  counts(): Record<EnforceKind, number> {
    const c = { anpr: 0, speed: 0, average: 0, redlight: 0, buslane: 0, cctv: 0 };
    for (const x of this.list.values()) c[x.kind]++;
    return c;
  }

  /** Load the 0.5° cells covering the view (only when zoomed in to city/region level). */
  async refresh(lat: number, lon: number, rangeKm: number): Promise<void> {
    if (this.busy || rangeKm > 250) return;
    const span = Math.min(1, Math.max(0.25, rangeKm / 111));
    const cells: [number, number][] = [];
    for (let a = Math.floor((lat - span) * 2) / 2; a <= lat + span; a += 0.5)
      for (let b = Math.floor((lon - span * 1.6) * 2) / 2; b <= lon + span * 1.6; b += 0.5) if (!this.done.has(`${a},${b}`)) cells.push([a, b]);
    if (!cells.length) return;
    this.busy = true;
    this.status = 'SYNC';
    this.events.emit('change', undefined);
    try {
      const s = Math.min(...cells.map((c) => c[0]));
      const w = Math.min(...cells.map((c) => c[1]));
      const n = Math.max(...cells.map((c) => c[0])) + 0.5;
      const e = Math.max(...cells.map((c) => c[1])) + 0.5;
      const q = overpassQuery([s, w, n, e]);
      let data: unknown = null;
      for (const m of MIRRORS) {
        try {
          const r = await fetch(m, { method: 'POST', body: `data=${encodeURIComponent(q)}`, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
          if (r.ok) {
            data = await r.json();
            break;
          }
        } catch {
          /* next mirror */
        }
      }
      if (!data) throw new Error('Overpass did not answer');
      for (const c of parseOverpass(data)) this.list.set(c.id, c);
      for (const [a, b] of cells) this.done.add(`${a},${b}`);
      this.status = 'LIVE';
    } catch {
      this.status = this.list.size ? 'LIVE' : 'NO FEED';
    } finally {
      this.busy = false;
      this.events.emit('change', undefined);
    }
  }

  near(lat: number, lon: number, km: number): EnforceCam[] {
    const rad = Math.PI / 180;
    return [...this.list.values()].filter((c) => {
      const dLat = (c.lat - lat) * rad;
      const dLon = (c.lon - lon) * rad;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * rad) * Math.cos(c.lat * rad) * Math.sin(dLon / 2) ** 2;
      return 12742 * Math.asin(Math.min(1, Math.sqrt(a))) <= km;
    });
  }
}

export const enforce = new EnforceFeed();
