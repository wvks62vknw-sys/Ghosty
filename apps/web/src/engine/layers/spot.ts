/**
 * The spot the owner tapped on God's Eye: a dropped pin (a pulsing marker) that stays until
 * it is cleared, and can be picked again. It is what the target card, Street View, the maps
 * and the live traffic map all open on.
 */
import type { CamState } from '../camera';
import { GEO } from '../geo';
import { gfx, PointSet, type DrawOpts } from '../gfx';
import type { GlobeLayer, Pickable } from '../globe';
import type { Mat4, Vec3 } from '../math';

export interface Spot {
  lat: number;
  lon: number;
  /** The nearest named place, when one is close. */
  name?: string;
  /** The address, once looked up. */
  address?: string;
}

export class SpotLayer implements GlobeLayer {
  id = 'spot' as const;
  spot: Spot | null = null;
  private pts = new PointSet(8);
  private w: Vec3 | null = null;

  set(s: Spot | null): void {
    this.spot = s;
    this.w = s ? GEO.ecef(s.lat, s.lon, 0.06) : null;
  }

  draw(_cs: CamState, rel: Mat4, oc: DrawOpts, sizeMul: number): void {
    if (!this.w) return;
    const P = this.pts.clear();
    const a = gfx.theme.a;
    const ph = ((performance.now() / 1000) * 0.8) % 1;
    P.add(this.w, [1, 1, 1, 1], 7 * sizeMul, 2);
    P.add(this.w, [a[0], a[1], a[2], 1], 13 * sizeMul, 2);
    P.add(this.w, [a[0], a[1], a[2], (1 - ph) * 0.8], (16 + ph * 40) * sizeMul, 1);
    P.draw(rel, { ...oc, px: 1 });
  }

  *pickables(): Iterable<Pickable> {
    if (this.w && this.spot) yield { kind: 'spot', ref: this.spot, w: this.w };
  }
}

export const spotLayer = new SpotLayer();
