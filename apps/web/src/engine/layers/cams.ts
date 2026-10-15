/** Public live cameras on the globe (God's Eye CCTV layer). Data: data/cameras.ts. */
import { CAM_COLORS, cams, type Camera } from '../../data/cameras';
import type { CamState } from '../camera';
import { GEO } from '../geo';
import { PointSet, type DrawOpts } from '../gfx';
import { globe, type GlobeLayer, type Pickable } from '../globe';
import type { Mat4 } from '../math';

export class CamLayer implements GlobeLayer {
  id = 'cams' as const;
  selected: Camera | null = null;
  private pts = new PointSet(8000);
  private cache = new Map<string, [number, number, number]>();

  private w(c: Camera): [number, number, number] {
    let v = this.cache.get(c.id);
    if (!v) {
      v = GEO.ecef(c.lat, c.lon, 0.08) as [number, number, number];
      this.cache.set(c.id, v);
    }
    return v;
  }

  draw(_cs: CamState, rel: Mat4, oc: DrawOpts, sizeMul: number): void {
    if (!cams.list.length) return;
    const P = this.pts.clear();
    const t = performance.now() / 1000;
    const near = globe.cam.range < 800; // bigger markers when zoomed in on a city
    for (const c of cams.list) {
      const col = CAM_COLORS[c.src];
      P.add(this.w(c), [col[0], col[1], col[2], 0.95], (near ? 9 : 4.5) * sizeMul, 2);
    }
    if (this.selected) {
      const ph = (t * 0.8) % 1;
      const w = this.w(this.selected);
      P.add(w, [1, 1, 1, 1], 12 * sizeMul, 2);
      P.add(w, [1, 1, 1, (1 - ph) * 0.8], (14 + ph * 40) * sizeMul, 1);
    }
    P.draw(rel, { ...oc, px: 1 });
  }

  *pickables(): Iterable<Pickable> {
    for (const c of cams.list) yield { kind: 'cam', ref: c, w: this.w(c) };
  }
}

export const camLayer = new CamLayer();
