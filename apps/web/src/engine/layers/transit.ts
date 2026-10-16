/** Live buses and trams (data/transit.ts), dead-reckoned every frame; a glyph pointing the way it is going. */
import { transit, TRANSIT_COLORS, type Vehicle } from '../../data/transit';
import type { CamState } from '../camera';
import { GEO } from '../geo';
import { PointSet, type DrawOpts } from '../gfx';
import type { GlobeLayer, Pickable } from '../globe';
import { RAD, type Mat4, type Vec3 } from '../math';

export class TransitLayer implements GlobeLayer {
  id = 'transit' as const;
  selected: Vehicle | null = null;
  private pts = new PointSet(6000);
  world(v: Vehicle, now: number): Vec3 {
    const p = transit.pos(v, now);
    return GEO.ecef(p.lat, p.lon, 0.025);
  }
  draw(_cs: CamState, rel: Mat4, oc: DrawOpts, sizeMul: number, now: number): void {
    if (!transit.list.size) return;
    const P = this.pts.clear();
    const stale = now - 4 * 60_000;
    for (const v of transit.list.values()) {
      const c = TRANSIT_COLORS[v.kind];
      const a = v.t < stale ? 0.45 : 1;
      const w = this.world(v, now);
      if (v.bearing == null || !v.speedMs || v.speedMs < 0.5) P.add(w, [c[0], c[1], c[2], a], (v.kind === 'tram' ? 9 : 7) * sizeMul, v.kind === 'tram' ? 2 : 0);
      else P.add(w, [c[0], c[1], c[2], a], (v.kind === 'tram' ? 13 : 11) * sizeMul, 5, v.bearing * RAD);
    }
    if (this.selected) P.add(this.world(this.selected, now), [1, 1, 1, 0.9], 28 * sizeMul, 1);
    P.draw(rel, { ...oc, px: 1 });
  }
  *pickables(now: number): Iterable<Pickable> {
    for (const v of transit.list.values()) yield { kind: 'transit', ref: v, w: this.world(v, now) };
  }
}

export const transitLayer = new TransitLayer();
