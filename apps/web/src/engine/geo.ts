/** Earth geometry: lat/lon ↔ 3D (Earth-centred, km), distances, bearings, sun position. */
import { DEG, RAD, type Vec3 } from './math';

export const R_EARTH = 6371;

export const GEO = {
  ecef(lat: number, lon: number, alt = 0): Vec3 {
    const la = lat * RAD;
    const lo = lon * RAD;
    const r = R_EARTH + alt;
    const c = Math.cos(la);
    return [r * c * Math.cos(lo), r * c * Math.sin(lo), r * Math.sin(la)];
  },
  /** East / North / Up unit vectors at a point. */
  enu(lat: number, lon: number): { e: Vec3; n: Vec3; u: Vec3 } {
    const la = lat * RAD;
    const lo = lon * RAD;
    const sl = Math.sin(la);
    const cl = Math.cos(la);
    const so = Math.sin(lo);
    const co = Math.cos(lo);
    return { e: [-so, co, 0], n: [-sl * co, -sl * so, cl], u: [cl * co, cl * so, sl] };
  },
  ll(p: Vec3): { lat: number; lon: number; alt: number } {
    const r = Math.hypot(p[0], p[1], p[2]);
    return { lat: Math.asin(p[2] / r) * DEG, lon: Math.atan2(p[1], p[0]) * DEG, alt: r - R_EARTH };
  },
  /** Great-circle distance in km. */
  hav(a: number, b: number, c: number, d: number): number {
    const p = (c - a) * RAD;
    const q = (d - b) * RAD;
    const x = Math.sin(p / 2) ** 2 + Math.cos(a * RAD) * Math.cos(c * RAD) * Math.sin(q / 2) ** 2;
    return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(x)));
  },
  bearing(a: number, b: number, c: number, d: number): number {
    const y = Math.sin((d - b) * RAD) * Math.cos(c * RAD);
    const x = Math.cos(a * RAD) * Math.sin(c * RAD) - Math.sin(a * RAD) * Math.cos(c * RAD) * Math.cos((d - b) * RAD);
    return (Math.atan2(y, x) * DEG + 360) % 360;
  },
  /** Point reached travelling `dist` km on bearing `brg` degrees. */
  dest(lat: number, lon: number, brg: number, dist: number): { lat: number; lon: number } {
    const d = dist / R_EARTH;
    const b = brg * RAD;
    const la = lat * RAD;
    const lo = lon * RAD;
    const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
    return { lat: la2 * DEG, lon: (lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2))) * DEG };
  },
  card: (b: number) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(b / 45) % 8]!,
  /** Sub-solar point (where the sun is overhead). */
  sun(t: number): { lat: number; lon: number } {
    const n = (t - 946728000000) / 864e5;
    const L = (280.46 + 0.9856474 * n) % 360;
    const g = ((357.528 + 0.9856003 * n) % 360) * RAD;
    const lam = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
    const e = 23.439 * RAD;
    const dec = Math.asin(Math.sin(e) * Math.sin(lam));
    const ra = Math.atan2(Math.cos(e) * Math.sin(lam), Math.cos(lam));
    const gm = ((280.46061837 + 360.98564736629 * n) % 360) * RAD;
    return { lat: dec * DEG, lon: ((((ra - gm) * DEG + 540) % 360) + 360) % 360 - 180 };
  },
  /** Greenwich mean sidereal time in degrees. */
  gmst(t: number): number {
    const n = (t - 946728000000) / 864e5;
    return (((280.46061837 + 360.98564736629 * n) % 360) + 360) % 360;
  },
};
