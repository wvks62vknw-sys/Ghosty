/**
 * Satellites from real orbital elements (CelesTrak; baked snapshot as fallback), propagated
 * with two-body + J2 secular terms. Positions are recomputed 5 times a second, not every
 * frame — satellites barely move on screen in 200 ms.
 */
import { fetchJson } from '../../api/feed';
import type { CamState } from '../camera';
import { GEO } from '../geo';
import { LineSet, PointSet, type DrawOpts } from '../gfx';
import type { GlobeLayer, Pickable } from '../globe';
import { RAD, TAU, V3, type Mat4, type Vec3 } from '../math';
import { World, type TleRow } from '../world';

export interface Satellite {
  name: string;
  id: number;
  group: string;
  epoch: number;
  inc: number;
  raan: number;
  argp: number;
  M0: number;
  e: number;
  n: number;
  a: number;
  raanDot: number;
  argpDot: number;
  Mdot: number;
  period: number;
  alt: number;
  col: [number, number, number];
  w: Vec3;
}

const GROUP_COLORS: Record<string, [number, number, number]> = {
  stations: [1, 0.85, 0.4],
  visual: [0.45, 0.9, 1],
  'gps-ops': [0.45, 1, 0.65],
  weather: [0.5, 0.7, 1],
  geo: [0.7, 0.55, 1],
  science: [1, 0.65, 0.4],
};
const GROUPS = Object.keys(GROUP_COLORS);
const MU = 398600.4418;
const J2 = 1.08263e-3;
const RE = 6378.137;

export class SatLayer implements GlobeLayer {
  id = 'sats' as const;
  list: Satellite[] = [];
  source = '';
  selected: Satellite | null = null;
  showOrbit = true;
  /** How bright the dots are drawn (the Machine view dims them to 0.4: the city comes first). */
  dim = 1;
  private lastProp = 0;
  private pts = new PointSet(1500);
  private orbit = new LineSet(200);

  load(groups: Record<string, TleRow[]>, source: string): void {
    const seen = new Set<number>();
    const out: Satellite[] = [];
    for (const g in groups) {
      for (const r of groups[g] ?? []) {
        if (seen.has(r[1])) continue;
        seen.add(r[1]);
        const n = (r[3] * TAU) / 86400;
        const a = Math.cbrt(MU / (n * n));
        const inc = r[5] * RAD;
        const e = r[4];
        const p = a * (1 - e * e);
        const k = 1.5 * J2 * Math.pow(RE / p, 2) * n;
        out.push({
          name: r[0],
          id: r[1],
          group: g,
          epoch: Date.parse(/Z$/.test(r[2]) ? r[2] : `${r[2]}Z`),
          inc,
          raan: r[6] * RAD,
          argp: r[7] * RAD,
          M0: r[8] * RAD,
          e,
          n,
          a,
          raanDot: -k * Math.cos(inc),
          argpDot: k * (2 - 2.5 * Math.sin(inc) ** 2),
          Mdot: n * (1 + 1.5 * J2 * Math.pow(RE / p, 2) * Math.sqrt(1 - e * e) * (1 - 1.5 * Math.sin(inc) ** 2)),
          period: TAU / n,
          alt: a - RE,
          col: GROUP_COLORS[g] ?? [0.6, 0.9, 1],
          w: [0, 0, 0],
        });
      }
    }
    this.list = out;
    this.source = source;
    this.lastProp = 0;
  }

  init(): void {
    this.load(World.tle, `snapshot ${World.built}`);
  }

  async refresh(): Promise<void> {
    const out: Record<string, TleRow[]> = {};
    let got = 0;
    await Promise.allSettled(
      GROUPS.map(async (g) => {
        const j = await fetchJson<{ OBJECT_NAME: string; NORAD_CAT_ID: number; EPOCH: string; MEAN_MOTION: number; ECCENTRICITY: number; INCLINATION: number; RA_OF_ASC_NODE: number; ARG_OF_PERICENTER: number; MEAN_ANOMALY: number }[]>(
          `https://celestrak.org/NORAD/elements/gp.php?GROUP=${g}&FORMAT=json`,
          3600,
          18000,
        );
        out[g] = j.map((s) => [s.OBJECT_NAME, s.NORAD_CAT_ID, s.EPOCH, s.MEAN_MOTION, s.ECCENTRICITY, s.INCLINATION, s.RA_OF_ASC_NODE, s.ARG_OF_PERICENTER, s.MEAN_ANOMALY]);
        got += j.length;
      }),
    );
    if (got > 20) this.load({ ...World.tle, ...out }, 'CelesTrak live');
  }

  /** Earth-centred inertial position (km). */
  eci(s: Satellite, ms: number): Vec3 {
    const dt = (ms - s.epoch) / 1000;
    const M = s.M0 + s.Mdot * dt;
    const raan = s.raan + s.raanDot * dt;
    const argp = s.argp + s.argpDot * dt;
    let E = M;
    for (let i = 0; i < 6; i++) E -= (E - s.e * Math.sin(E) - M) / (1 - s.e * Math.cos(E));
    const cE = Math.cos(E);
    const r = s.a * (1 - s.e * cE);
    const nu = Math.atan2(Math.sqrt(1 - s.e * s.e) * Math.sin(E), cE - s.e);
    const u = argp + nu;
    const cu = Math.cos(u);
    const su = Math.sin(u);
    const cO = Math.cos(raan);
    const sO = Math.sin(raan);
    const ci = Math.cos(s.inc);
    const si = Math.sin(s.inc);
    return [r * (cO * cu - sO * su * ci), r * (sO * cu + cO * su * ci), r * su * si];
  }

  /** Earth-fixed position (km). */
  ecef(s: Satellite, ms: number, gmstDeg = GEO.gmst(ms)): Vec3 {
    const p = this.eci(s, ms);
    const th = gmstDeg * RAD;
    const c = Math.cos(th);
    const sn = Math.sin(th);
    return [p[0] * c + p[1] * sn, -p[0] * sn + p[1] * c, p[2]];
  }

  /** Next pass over an observer above 5° elevation within 24 h (30 s steps). */
  nextPass(s: Satellite, lat: number, lon: number): { rise: number; max: number } | null {
    const now = Date.now();
    const ob = GEO.ecef(lat, lon, 0);
    const up = V3.norm(ob);
    let start = 0;
    let maxEl = -90;
    for (let t = 0; t <= 86400; t += 30) {
      const ms = now + t * 1000;
      const rel = V3.sub(this.ecef(s, ms), ob);
      const el = (Math.asin(V3.dot(rel, up) / V3.len(rel)) * 180) / Math.PI;
      if (el > 5) {
        if (!start) start = ms;
        maxEl = Math.max(maxEl, el);
      } else if (start) return { rise: start, max: maxEl };
    }
    return start ? { rise: start, max: maxEl } : null;
  }

  update(): void {
    const now = Date.now();
    if (now - this.lastProp < 200) return;
    this.lastProp = now;
    const gm = GEO.gmst(now);
    for (const s of this.list) s.w = this.ecef(s, now, gm);
  }

  draw(_cs: CamState, rel: Mat4, oc: DrawOpts, sizeMul: number, now: number): void {
    const P = this.pts.clear();
    for (const s of this.list) P.add(s.w, [s.col[0], s.col[1], s.col[2], (s.group === 'geo' ? 0.55 : 0.95) * this.dim], (s.group === 'stations' ? 11 : s.group === 'geo' ? 5 : 6) * sizeMul, 4);
    P.draw(rel, { ...oc, px: 1 });
    const sel = this.selected;
    if (sel && this.showOrbit) {
      const L = this.orbit.clear();
      const gm = GEO.gmst(now);
      let prev: Vec3 | null = null;
      for (let i = 0; i <= 160; i++) {
        const q = this.ecef(sel, now + (i / 160) * sel.period * 1000, gm);
        if (prev) L.add(prev, q, [1, 0.85, 0.4, i < 80 ? 0.9 : 0.55], 1.6);
        prev = q;
      }
      L.draw(rel, { ...oc, px: 1 });
    }
  }

  *pickables(): Iterable<Pickable> {
    for (const s of this.list) yield { kind: 'sat', ref: s, w: s.w };
  }
}

export const sats = new SatLayer();
