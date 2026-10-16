/**
 * ROAD AHEAD: where the owner is right now (the phone's own GPS, only while this mode is on
 * and only on this device — the position never goes to the brain), which way they are going,
 * and what lies ahead: the road reports, safety cameras and public cameras in the cone in
 * front of them. Pure helpers here (testable); the globe marker is engine/layers/me.ts and the
 * panel is features/eye/roadahead.ts.
 */
import { Emitter } from '../core/store';

export interface Me {
  lat: number;
  lon: number;
  /** Degrees from north, or null when standing still / unknown. */
  heading: number | null;
  /** m/s, or null. */
  speed: number | null;
  /** Metres. */
  accuracy: number;
  t: number;
}

export class RoadAhead {
  me: Me | null = null;
  on = false;
  error = '';
  /** The last few minutes of positions, oldest first (for the trail and for a heading when the GPS gives none). */
  trail: [number, number, number][] = [];
  readonly events = new Emitter<{ change: void }>();
  private watch = 0;

  start(): boolean {
    if (this.on) return true;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.error = 'This device has no location service.';
      this.events.emit('change', undefined);
      return false;
    }
    this.on = true;
    this.error = '';
    this.watch = navigator.geolocation.watchPosition(
      (p) => this.update(p.coords.latitude, p.coords.longitude, p.coords.heading, p.coords.speed, p.coords.accuracy, p.timestamp || Date.now()),
      (e) => {
        this.error = e.code === 1 ? 'Location permission was refused: allow it for this site in Settings → Safari → Location.' : e.code === 2 ? 'No GPS fix yet.' : 'Location timed out.';
        this.events.emit('change', undefined);
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    );
    this.events.emit('change', undefined);
    return true;
  }

  stop(): void {
    if (this.watch && typeof navigator !== 'undefined' && navigator.geolocation) navigator.geolocation.clearWatch(this.watch);
    this.watch = 0;
    this.on = false;
    this.events.emit('change', undefined);
  }

  /** A position fix (also used by tests): heading comes from the fix, else from the last few metres moved. */
  update(lat: number, lon: number, heading: number | null | undefined, speed: number | null | undefined, accuracy = 20, t = Date.now()): void {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    let hd = typeof heading === 'number' && Number.isFinite(heading) && heading >= 0 ? heading : null;
    const sp = typeof speed === 'number' && Number.isFinite(speed) && speed >= 0 ? speed : null;
    const last = this.trail[this.trail.length - 1];
    if (last && (hd == null || (sp != null && sp < 0.5))) {
      const km = haversine(last[0], last[1], lat, lon);
      if (km > 0.015) hd = bearing(last[0], last[1], lat, lon);
      else if (sp != null && sp < 0.5) hd = this.me?.heading ?? null;
    }
    this.trail.push([lat, lon, t]);
    const cut = t - 10 * 60_000;
    while (this.trail.length > 240 || (this.trail.length && this.trail[0]![2] < cut)) this.trail.shift();
    this.me = { lat, lon, heading: hd, speed: sp, accuracy, t };
    this.events.emit('change', undefined);
  }

  /** Items in the cone ahead (within `km`, within ±`cone`° of the heading; all around when standing still), nearest first. */
  ahead<T extends { lat: number; lon: number }>(items: Iterable<T>, km: number, cone = 60): (T & { km: number; bearing: number })[] {
    const m = this.me;
    if (!m) return [];
    const out: (T & { km: number; bearing: number })[] = [];
    for (const it of items) {
      const d = haversine(m.lat, m.lon, it.lat, it.lon);
      if (d > km) continue;
      const b = bearing(m.lat, m.lon, it.lat, it.lon);
      if (m.heading != null && d > 0.08) {
        const diff = Math.abs((((b - m.heading + 540) % 360) + 360) % 360 - 180);
        if (diff > cone) continue;
      }
      out.push({ ...it, km: d, bearing: b });
    }
    return out.sort((a, b) => a.km - b.km);
  }
}

export function haversine(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLon = (bLon - aLon) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function bearing(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = Math.PI / 180;
  const y = Math.sin((bLon - aLon) * rad) * Math.cos(bLat * rad);
  const x = Math.cos(aLat * rad) * Math.sin(bLat * rad) - Math.sin(aLat * rad) * Math.cos(bLat * rad) * Math.cos((bLon - aLon) * rad);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export const mph = (ms: number | null | undefined): string => (ms == null ? '—' : `${Math.round(ms * 2.23694)} mph`);
export const cardinal = (deg: number): string => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(((deg % 360) + 360) % 360 / 45) % 8]!;

export const roadAhead = new RoadAhead();
