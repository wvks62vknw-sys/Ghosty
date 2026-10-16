/**
 * Live buses and trams for God's Eye. The brain answers /api/transit?bbox=… from the best
 * source it has a key for — Transport for West Midlands (buses and Metro trams; free key),
 * the Bus Open Data Service (every bus in England; free key) — or, with no key at all,
 * bustimes.org's community feed, polled gently. Positions are dead-reckoned between polls
 * from the vehicle's bearing and speed when the feed gives them. The credit line the feed
 * requires is shown with the layer. National Rail trains are not in any of these feeds.
 */
import { headers } from '../api/brain';
import { Emitter } from '../core/store';

export interface Vehicle {
  id: string;
  kind: 'bus' | 'tram' | 'other';
  line: string;
  dest: string;
  operator: string;
  lat: number;
  lon: number;
  bearing: number | null;
  speedMs: number | null;
  /** When the position was reported (ms). */
  t: number;
  delayS: number | null;
  src: 'TfWM' | 'BODS' | 'bustimes.org';
}

export const TRANSIT_COLORS: Record<Vehicle['kind'], [number, number, number]> = {
  bus: [1, 0.72, 0.2],
  tram: [0.35, 0.9, 1],
  other: [0.8, 0.8, 0.85],
};

export class TransitFeed {
  list = new Map<string, Vehicle>();
  status: 'IDLE' | 'SYNC' | 'LIVE' | 'STALE' | 'NO FEED' = 'IDLE';
  src: Vehicle['src'] | null = null;
  credit = '';
  note = '';
  at = 0;
  readonly events = new Emitter<{ change: void }>();
  private busy = false;
  private lastBox = '';
  private lastAt = 0;

  /** Vehicles around the view (only when zoomed in to a town); a box is not asked again within 20 s. */
  async refresh(lat: number, lon: number, rangeKm: number): Promise<void> {
    if (this.busy || rangeKm > 120) return;
    const d = Math.min(0.6, Math.max(0.03, rangeKm / 111));
    // the brain answers boxes up to 1.5 degrees across: at Birmingham's latitude the longitude span is capped, not refused
    const dl = Math.min(0.74, d / Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
    const box = [lon - dl, lat - d, lon + dl, lat + d].map((x) => x.toFixed(3)).join(',');
    if (box === this.lastBox && Date.now() - this.lastAt < 20_000) return;
    this.busy = true;
    if (!this.list.size) this.status = 'SYNC';
    this.events.emit('change', undefined);
    try {
      const r = await fetch(`/api/transit?bbox=${box}`, { headers: headers() });
      if (!r.ok) throw new Error(`transit ${r.status}`);
      const j = (await r.json()) as { vehicles?: Vehicle[]; src?: Vehicle['src'] | null; credit?: string; note?: string; at?: number; error?: string };
      if (j.error) throw new Error(j.error);
      const seen = new Set<string>();
      for (const v of j.vehicles ?? []) {
        if (!Number.isFinite(v.lat) || !Number.isFinite(v.lon)) continue;
        this.list.set(v.id, v);
        seen.add(v.id);
      }
      // Vehicles that left the box (or the feed) fade out after a few minutes.
      const cut = Date.now() - 6 * 60_000;
      for (const [k, v] of this.list) if (!seen.has(k) && v.t < cut) this.list.delete(k);
      this.src = j.src ?? null;
      this.credit = j.credit ?? '';
      this.note = j.note ?? '';
      this.at = j.at ?? Date.now();
      this.lastBox = box;
      this.lastAt = Date.now();
      this.status = seen.size ? 'LIVE' : this.list.size ? 'STALE' : 'NO FEED';
    } catch {
      this.status = this.list.size ? 'STALE' : 'NO FEED';
    } finally {
      this.busy = false;
      this.events.emit('change', undefined);
    }
  }

  /** Dead-reckoned position: along the bearing at the reported speed, for at most a minute. */
  pos(v: Vehicle, now = Date.now()): { lat: number; lon: number } {
    if (v.bearing == null || !v.speedMs || v.speedMs < 0.5 || v.speedMs > 40) return v;
    const dt = Math.min(60, Math.max(0, (now - v.t) / 1000));
    const d = (v.speedMs * dt) / 6371000;
    const b = (v.bearing * Math.PI) / 180;
    const la = (v.lat * Math.PI) / 180;
    const lo = (v.lon * Math.PI) / 180;
    const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
    const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
    return { lat: (la2 * 180) / Math.PI, lon: (lo2 * 180) / Math.PI };
  }

  counts(): { bus: number; tram: number; lines: number } {
    let bus = 0;
    let tram = 0;
    const lines = new Set<string>();
    for (const v of this.list.values()) {
      if (v.kind === 'tram') tram++;
      else bus++;
      if (v.line) lines.add(v.line);
    }
    return { bus, tram, lines: lines.size };
  }

  /** Vehicles within `km` of a point, nearest first. */
  near(lat: number, lon: number, km: number, now = Date.now()): (Vehicle & { km: number })[] {
    const rad = Math.PI / 180;
    const out: (Vehicle & { km: number })[] = [];
    for (const v of this.list.values()) {
      const p = this.pos(v, now);
      const dLat = (p.lat - lat) * rad;
      const dLon = (p.lon - lon) * rad;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * rad) * Math.cos(p.lat * rad) * Math.sin(dLon / 2) ** 2;
      const d = 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
      if (d <= km) out.push({ ...v, km: d });
    }
    return out.sort((a, b) => a.km - b.km);
  }

  find(q: string): Vehicle | null {
    const s = q.trim().toLowerCase();
    if (!s) return null;
    for (const v of this.list.values()) if (v.line.toLowerCase() === s || v.id.toLowerCase() === s) return v;
    return null;
  }
}

export const transit = new TransitFeed();

/** Delay in plain words. */
export const delayText = (s: number | null | undefined): string => (s == null ? '' : Math.abs(s) < 60 ? 'on time' : s > 0 ? `${Math.round(s / 60)} min late` : `${Math.round(-s / 60)} min early`);
