/** A route (directions from Ghosty) drawn on the globe, with a marker at each end. */
import type { CamState } from '../camera';
import { GEO } from '../geo';
import { gfx, LineSet, PointSet, type DrawOpts } from '../gfx';
import type { GlobeLayer, Pickable } from '../globe';
import type { Mat4, Vec3 } from '../math';

export interface RouteInfo {
  path: [number, number][];
  from: string;
  to: string;
  mode: string;
  distance_m: number;
  duration_s: number;
}

export class RouteLayer implements GlobeLayer {
  id = 'route' as const;
  info: RouteInfo | null = null;
  private line = new LineSet(1300);
  private pts = new PointSet(8);
  private ends: Vec3[] = [];

  set(r: RouteInfo | null): void {
    this.info = r;
    this.line.clear();
    this.ends = [];
    if (!r || r.path.length < 2) return;
    const a = gfx.theme.a;
    let prev: Vec3 | null = null;
    for (const [lat, lon] of r.path) {
      const q = GEO.ecef(lat, lon, 0.05);
      if (prev) {
        this.line.add(prev, q, [a[0], a[1], a[2], 0.95], 3.2);
        this.line.add(prev, q, [1, 1, 1, 0.5], 1.2);
      }
      prev = q;
    }
    const [s, e] = [r.path[0]!, r.path[r.path.length - 1]!];
    this.ends = [GEO.ecef(s[0], s[1], 0.08), GEO.ecef(e[0], e[1], 0.08)];
  }

  draw(_cs: CamState, rel: Mat4, oc: DrawOpts, sizeMul: number): void {
    if (!this.info) return;
    this.line.draw(rel, { ...oc, px: 1 });
    const P = this.pts.clear();
    const t = performance.now() / 1000;
    const ph = (t * 0.7) % 1;
    this.ends.forEach((w, i) => {
      const c = i === 0 ? [0.4, 1, 0.75] : [1, 0.45, 0.4];
      P.add(w, [c[0]!, c[1]!, c[2]!, 1], 12 * sizeMul, 2);
      P.add(w, [c[0]!, c[1]!, c[2]!, (1 - ph) * 0.7], (14 + ph * 34) * sizeMul, 1);
    });
    P.draw(rel, { ...oc, px: 1 });
  }

  *pickables(): Iterable<Pickable> {
    if (!this.info) return;
    yield { kind: 'route', ref: { name: this.info.from, end: 'start', route: this.info }, w: this.ends[0]! };
    yield { kind: 'route', ref: { name: this.info.to, end: 'end', route: this.info }, w: this.ends[1]! };
  }
}

export const routeLayer = new RouteLayer();
