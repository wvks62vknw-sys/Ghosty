/**
 * Street crime on the globe (data/crime.ts): one small point per reported crime in the latest
 * published month, coloured by family — against people (red), property (gold), order
 * (violet), other (grey-blue). Shows only when zoomed in to town level over the UK.
 */
import { crime, CRIME_COLORS, crimeFamily, type Crime } from '../../data/crime';
import type { CamState } from '../camera';
import { GEO } from '../geo';
import { PointSet, type DrawOpts } from '../gfx';
import type { GlobeLayer, Pickable } from '../globe';
import type { Mat4 } from '../math';

export class CrimeLayer implements GlobeLayer {
  id = 'crime' as const;
  selected: Crime | null = null;
  private pts = new PointSet(12000);
  private n = -1;
  private dirty = true;
  constructor() {
    crime.events.on('change', () => (this.dirty = true));
  }
  draw(cs: CamState, rel: Mat4, oc: DrawOpts, sizeMul: number): void {
    if (cs.alt > 60 || (!crime.list.size && !this.selected)) return;
    if (this.dirty || this.n !== crime.list.size || this.selected) {
      const P = this.pts.clear();
      for (const c of crime.list.values()) {
        const col = CRIME_COLORS[crimeFamily(c.category)];
        const person = crimeFamily(c.category) === 'person';
        P.add(GEO.ecef(c.lat, c.lon, 0.02), [col[0], col[1], col[2], person ? 0.95 : 0.7], person ? 7 : 5, 0);
      }
      if (this.selected) {
        const ph = (performance.now() / 1000) % 1;
        P.add(GEO.ecef(this.selected.lat, this.selected.lon, 0.02), [1, 1, 1, (1 - ph) * 0.9], 12 + ph * 30, 1);
      }
      this.n = crime.list.size;
      this.dirty = false;
    }
    this.pts.draw(rel, { ...oc, px: 1, size: sizeMul });
  }
  *pickables(): Iterable<Pickable> {
    for (const c of crime.list.values()) yield { kind: 'crime', ref: c, w: GEO.ecef(c.lat, c.lon, 0.02) };
  }
}

export const crimeLayer = new CrimeLayer();
