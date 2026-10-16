/** Live road incidents (data/incidents.ts): a ring at the junction, coloured and sized by how bad it is. */
import { incidents, INCIDENT_COLORS, severity, type Incident } from '../../data/incidents';
import type { CamState } from '../camera';
import { GEO } from '../geo';
import { PointSet, type DrawOpts } from '../gfx';
import type { GlobeLayer, Pickable } from '../globe';
import type { Mat4 } from '../math';

export class IncidentLayer implements GlobeLayer {
  id = 'incidents' as const;
  selected: Incident | null = null;
  private pts = new PointSet(600);
  private dirty = true;
  private n = -1;
  constructor() {
    incidents.events.on('change', () => (this.dirty = true));
  }
  draw(_cs: CamState, rel: Mat4, oc: DrawOpts, sizeMul: number): void {
    if (!incidents.list.size) return;
    if (this.dirty || this.n !== incidents.list.size || this.selected) {
      const P = this.pts.clear();
      const ph = (performance.now() / 1000) % 1;
      for (const i of incidents.list.values()) {
        const s = severity(i);
        const c = INCIDENT_COLORS[s]!;
        const w = GEO.ecef(i.lat, i.lon, 0.05);
        P.add(w, [c[0], c[1], c[2], 1], 10 + s * 3, 1);
        P.add(w, [c[0], c[1], c[2], 0.9], 5, 0);
        if (s >= 2) P.add(w, [c[0], c[1], c[2], (1 - ph) * 0.6], 14 + ph * 30, 1);
        if (i === this.selected) P.add(w, [1, 1, 1, (1 - ph) * 0.9], 18 + ph * 34, 1);
      }
      this.n = incidents.list.size;
      this.dirty = false;
    }
    this.pts.draw(rel, { ...oc, px: 1, size: sizeMul });
  }
  *pickables(): Iterable<Pickable> {
    for (const i of incidents.list.values()) yield { kind: 'incident', ref: i, w: GEO.ecef(i.lat, i.lon, 0.05) };
  }
}

export const incidentLayer = new IncidentLayer();
