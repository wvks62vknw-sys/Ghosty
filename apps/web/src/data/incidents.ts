/**
 * Live road incidents (National Highways: crashes, queues, closures, roadworks on the motorways
 * and main roads, with delays in minutes and when they should clear), placed at the motorway
 * junctions they name. The brain reads National Highways' live list (free, Open Government
 * Licence) and places each report with its junction table; the interface polls
 * /api/highways/events every three minutes while the layer is on, and the motorway_now tool
 * also pushes what it found straight here (show_incidents).
 */
import { headers } from '../api/brain';
import { Emitter } from '../core/store';

export interface Incident {
  id: string;
  road: string;
  direction: string;
  title: string;
  reason: string;
  delayS: number;
  lanesClosed: string;
  lat: number;
  lon: number;
  normalBy: string;
  /** When the report was last updated (ms), when known. */
  updated?: number | null;
}

export const INCIDENT_CREDIT = 'Contains public sector information licensed under the Open Government Licence v3.0 (National Highways)';

/** How bad: 0 minor, 1 delays, 2 serious (long delay or lanes closed), 3 closed. */
const LANE_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, all: 4 };

/** How many lanes an event's lane text closes: "2 lanes closed", "two lanes closed" or the raw "2|0|3" form. */
export function lanesClosedCount(s: string): number {
  const words = s.match(/\b(\d+|one|two|three|four|all)\s+lanes?\b/i);
  if (words) return LANE_WORDS[(words[1] ?? '').toLowerCase()] ?? Number(words[1]);
  const first = s.match(/^\s*(\d+)\s*\|/);
  if (first) return Number(first[1]);
  const digits = s.match(/\d+/);
  return digits ? Number(digits[0]) : 0;
}

export function severity(i: Incident): 0 | 1 | 2 | 3 {
  const closed = /closed|closure/i.test(i.reason) && !/lane/i.test(i.reason);
  if (closed) return 3;
  const lanes = lanesClosedCount(i.lanesClosed);
  if (i.delayS >= 20 * 60 || lanes >= 2) return 2;
  if (i.delayS >= 5 * 60 || lanes === 1) return 1;
  return 0;
}

export const INCIDENT_COLORS: [number, number, number][] = [
  [1, 0.85, 0.3],
  [1, 0.6, 0.2],
  [1, 0.35, 0.2],
  [1, 0.15, 0.3],
];

const num = (v: unknown): number => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);

/** The incidents in a brain answer (either route) that carry coordinates. */
export function parseIncidents(raw: unknown): Incident[] {
  const list = Array.isArray(raw) ? raw : Array.isArray((raw as { events?: unknown[] })?.events) ? (raw as { events: unknown[] }).events : [];
  const out: Incident[] = [];
  for (const e of list as Record<string, unknown>[]) {
    if (!e || typeof e !== 'object') continue;
    const lat = num(e.lat);
    const lon = num(e.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    out.push({
      id: String(e.id ?? `${e.road ?? ''}-${e.title ?? ''}`).slice(0, 80),
      road: String(e.road ?? ''),
      direction: String(e.direction ?? ''),
      title: String(e.title ?? '').slice(0, 200),
      reason: String(e.reason ?? ''),
      delayS: Math.max(0, num(e.delayS) || 0),
      lanesClosed: String(e.lanesClosed ?? ''),
      lat,
      lon,
      normalBy: String(e.normalBy ?? ''),
      updated: typeof e.updated === 'number' ? e.updated : null,
    });
  }
  return out;
}

export class IncidentFeed {
  list = new Map<string, Incident>();
  status: 'IDLE' | 'SYNC' | 'LIVE' | 'STALE' | 'NO FEED' = 'IDLE';
  at = 0;
  readonly events = new Emitter<{ change: void }>();
  private busy = false;
  private lastAt = 0;

  /** What the brain found (the motorway_now tool): shown at once. */
  seed(raw: unknown): number {
    const items = parseIncidents(raw);
    for (const i of items) this.list.set(i.id, i);
    if (items.length) {
      this.status = 'LIVE';
      this.at = Date.now();
    }
    this.events.emit('change', undefined);
    return items.length;
  }

  /** Refresh from the brain (no more than every 3 minutes). `region` is a National Highways region name. */
  async refresh(region = 'West Midlands', force = false): Promise<void> {
    if (this.busy || (!force && Date.now() - this.lastAt < 3 * 60_000)) return;
    this.busy = true;
    if (!this.list.size) this.status = 'SYNC';
    this.events.emit('change', undefined);
    try {
      const r = await fetch(`/api/highways/events?region=${encodeURIComponent(region)}`, { headers: headers() });
      if (!r.ok) throw new Error(`incidents ${r.status}`);
      const items = parseIncidents(await r.json());
      const seen = new Set(items.map((i) => i.id));
      for (const i of items) this.list.set(i.id, i);
      for (const k of [...this.list.keys()]) if (!seen.has(k)) this.list.delete(k); // cleared reports go
      this.lastAt = Date.now();
      this.at = Date.now();
      this.status = 'LIVE';
    } catch {
      this.status = this.list.size ? 'STALE' : 'NO FEED';
    } finally {
      this.busy = false;
      this.events.emit('change', undefined);
    }
  }

  /** Worst first. */
  worst(n = 12): Incident[] {
    return [...this.list.values()].sort((a, b) => severity(b) - severity(a) || b.delayS - a.delayS).slice(0, n);
  }

  near(lat: number, lon: number, km: number): (Incident & { km: number })[] {
    const rad = Math.PI / 180;
    const out: (Incident & { km: number })[] = [];
    for (const i of this.list.values()) {
      const dLat = (i.lat - lat) * rad;
      const dLon = (i.lon - lon) * rad;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * rad) * Math.cos(i.lat * rad) * Math.sin(dLon / 2) ** 2;
      const d = 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
      if (d <= km) out.push({ ...i, km: d });
    }
    return out.sort((a, b) => a.km - b.km);
  }
}

export const incidents = new IncidentFeed();

export const delayWords = (s: number): string => (s >= 3600 ? `${Math.round(s / 360) / 10} h` : s >= 60 ? `${Math.round(s / 60)} min` : s > 0 ? `${s} s` : 'no delay');
