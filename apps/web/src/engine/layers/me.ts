/** The owner's own position on the globe (ROAD AHEAD): a pulsing marker pointing the way they are going, with a short trail. */
import { roadAhead } from '../../data/roadahead';
import type { CamState } from '../camera';
import { GEO } from '../geo';
import { gfx, LineSet, PointSet, type DrawOpts } from '../gfx';
import type { GlobeLayer, Pickable } from '../globe';
import { RAD, type Mat4, type Vec3 } from '../math';

export class MeLayer implements GlobeLayer {
  id = 'me' as const;
  private pts = new PointSet(8);
  private line = new LineSet(300);
  private trailN = -1;
  world(): Vec3 | null {
    const m = roadAhead.me;
    return m ? GEO.ecef(m.lat, m.lon, 0.04) : null;
  }
  draw(_cs: CamState, rel: Mat4, oc: DrawOpts, sizeMul: number): void {
    const m = roadAhead.me;
    const w = this.world();
    if (!m || !w) return;
    const a = gfx.theme.a;
    if (this.trailN !== roadAhead.trail.length) {
      this.line.clear();
      let prev: Vec3 | null = null;
      for (const [lat, lon] of roadAhead.trail) {
        const q = GEO.ecef(lat, lon, 0.035);
        if (prev) this.line.add(prev, q, [a[0], a[1], a[2], 0.55], 2);
        prev = q;
      }
      this.trailN = roadAhead.trail.length;
    }
    this.line.draw(rel, oc);
    const P = this.pts.clear();
    const ph = ((performance.now() / 1000) * 0.7) % 1;
    const moving = m.heading != null && (m.speed ?? 0) > 0.5;
    if (moving) P.add(w, [1, 1, 1, 1], 16 * sizeMul, 5, m.heading! * RAD);
    else P.add(w, [1, 1, 1, 1], 8 * sizeMul, 0);
    P.add(w, [a[0], a[1], a[2], 1], 13 * sizeMul, 1);
    P.add(w, [a[0], a[1], a[2], (1 - ph) * 0.7], (18 + ph * 44) * sizeMul, 1);
    P.draw(rel, { ...oc, px: 1 });
  }
  *pickables(): Iterable<Pickable> {
    const w = this.world();
    if (w && roadAhead.me) yield { kind: 'me', ref: roadAhead.me, w };
  }
}

export const meLayer = new MeLayer();
