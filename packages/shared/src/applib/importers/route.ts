/**
 * A run or a ride from any of the activity files (GPX, TCX, FIT), worked out on the phone: distance, time, pace,
 * climb, kilometre splits and the route's shape. The shape is drawn from the points scaled into a 100 by 100 box, so it
 * keeps no place, no scale and no coordinates: the route stays a picture on his phone, and no location goes anywhere.
 */
import { localDay, localTime, round, type Rec } from './input';

export interface Pt { lat?: number; lon?: number; ele?: number; /** ms since 1970 */ t?: number; hr?: number; /** metres so far, from the device */ d?: number }
export interface Activity {
  start?: number;
  sport: string;
  name?: string;
  pts: Pt[];
  /** Totals the file states (they win over what the points add up to). */
  distance?: number;
  moving?: number;
  ascent?: number;
  kcal?: number;
  hrAvg?: number;
}

export const SPORTS = ['Run', 'Ride', 'Walk', 'Hike', 'Swim', 'Other'] as const;
/** Any file's sport word ("running", "Biking", "cycling", "hiking", "1") → one of SPORTS. */
export function sportOf(s: string | number | undefined): string {
  const t = String(s ?? '').toLowerCase();
  if (/run|jog/.test(t)) return 'Run';
  if (/bik|cycl|ride|mtb/.test(t)) return 'Ride';
  if (/hik/.test(t)) return 'Hike';
  if (/walk/.test(t)) return 'Walk';
  if (/swim/.test(t)) return 'Swim';
  return 'Other';
}

/** The distance between two points in metres (haversine, on a sphere of radius 6,371 km). */
export function metres(a: Pt, b: Pt): number {
  const R = 6371008.8;
  const r = Math.PI / 180;
  const dLat = (b.lat! - a.lat!) * r;
  const dLon = (b.lon! - a.lon!) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat! * r) * Math.cos(b.lat! * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Minutes and seconds ("5:07"). */
export const mmss = (secs: number): string => {
  const s = Math.round(secs);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Each point's distance so far in metres: the device's own where it gives one, otherwise added up from the positions. */
export function cumulative(pts: Pt[]): number[] {
  const out: number[] = [];
  let d = 0;
  const device = pts.some((p) => p.d != null);
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    if (device) d = p.d ?? d;
    else if (i && p.lat != null && pts[i - 1]!.lat != null) d += metres(pts[i - 1]!, p);
    out.push(d);
  }
  return out;
}

/** The time of each whole kilometre, in seconds, from the points' times and distances (interpolated at the line). */
export function splits(pts: Pt[], dist: number[], every = 1000): number[] {
  const out: number[] = [];
  let next = every;
  let lastT = pts.find((p) => p.t != null)?.t;
  if (lastT == null) return out;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!;
    const d0 = dist[i - 1]!, d1 = dist[i]!;
    if (a.t == null || b.t == null) continue;
    while (d1 >= next && d1 > d0) {
      const f = (next - d0) / (d1 - d0);
      const t = a.t + f * (b.t - a.t);
      out.push((t - lastT) / 1000);
      lastT = t;
      next += every;
      if (out.length >= 200) return out;
    }
  }
  return out;
}

/** Height climbed in metres, counting only rises of 3 m or more so that a noisy altimeter does not add up. */
export function climb(pts: Pt[]): number {
  let up = 0;
  let base: number | undefined;
  for (const p of pts) {
    if (p.ele == null || !Number.isFinite(p.ele)) continue;
    if (base == null) { base = p.ele; continue; }
    if (p.ele - base >= 3) { up += p.ele - base; base = p.ele; }
    else if (p.ele < base) base = p.ele;
  }
  return up;
}

/** The route's shape as an SVG path in a 100 by 100 box (north up), with at most `max` points; '' without positions. */
export function routePath(pts: Pt[], max = 300): string {
  const geo = pts.filter((p) => p.lat != null && p.lon != null && Number.isFinite(p.lat) && Number.isFinite(p.lon));
  if (geo.length < 2) return '';
  const step = Math.max(1, Math.ceil(geo.length / max));
  const keep = geo.filter((_, i) => i % step === 0 || i === geo.length - 1);
  const lat0 = (keep.reduce((s, p) => s + p.lat!, 0) / keep.length) * (Math.PI / 180);
  const xy = keep.map((p): [number, number] => [p.lon! * Math.cos(lat0), -p.lat!]);
  const xs = xy.map((p) => p[0]), ys = xy.map((p) => p[1]);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const span = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY) || 1;
  const offX = (100 - ((Math.max(...xs) - minX) / span) * 92) / 2;
  const offY = (100 - ((Math.max(...ys) - minY) / span) * 92) / 2;
  return xy.map(([x, y], i) => `${i ? 'L' : 'M'}${round(offX + ((x - minX) / span) * 92, 1)} ${round(offY + ((y - minY) / span) * 92, 1)}`).join(' ');
}

/** One activity as a record of the Runs and Rides app (fields date, time, sport, name, km, mins, pace, kmh, climb, hr, splits). */
export function activityRecord(a: Activity): Rec | null {
  const pts = a.pts;
  const dist = cumulative(pts);
  const metresTotal = a.distance ?? dist[dist.length - 1] ?? 0;
  const times = pts.filter((p) => p.t != null).map((p) => p.t!);
  const start = a.start ?? times[0];
  const secs = a.moving ?? (times.length > 1 ? (times[times.length - 1]! - times[0]!) / 1000 : 0);
  if (start == null || (!metresTotal && !secs)) return null;
  const d = new Date(start);
  const km = (metresTotal ?? 0) / 1000;
  const sport = SPORTS.includes(a.sport as (typeof SPORTS)[number]) ? a.sport : sportOf(a.sport);
  const r: Rec = {
    _key: `${new Date(start).toISOString()}|${sport}`,
    date: localDay(d),
    time: localTime(d),
    sport,
    name: a.name?.trim() || `${sport} ${localDay(d)}`,
    km: round(km, 2),
    mins: Math.round(secs / 60),
  };
  if (km > 0.05 && secs > 0) {
    r.pace = `${mmss(secs / km)} /km`;
    r.kmh = round(km / (secs / 3600), 1);
  }
  const up = a.ascent ?? climb(pts);
  if (up) r.climb = Math.round(up);
  const hrs = pts.filter((p) => p.hr).map((p) => p.hr!);
  const hr = a.hrAvg ?? (hrs.length ? hrs.reduce((s, x) => s + x, 0) / hrs.length : 0);
  if (hr) r.hr = Math.round(hr);
  if (a.kcal) r.kcal = Math.round(a.kcal);
  const sp = splits(pts, dist, sport === 'Ride' ? 5000 : 1000);
  if (sp.length) r.splits = sp.map(mmss).join(', ');
  const path = routePath(pts);
  if (path) r._route = path;
  return r;
}
