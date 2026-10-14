/** Earthquakes, natural events and rocket launch pads drawn on the globe. */
import { events, EVENT_COLORS, launches, quakes } from '../../data/hazards';
import type { CamState } from '../camera';
import { GEO } from '../geo';
import { LineSet, PointSet, type DrawOpts } from '../gfx';
import type { GlobeLayer, Pickable } from '../globe';
import type { Mat4 } from '../math';

export class QuakeLayer implements GlobeLayer {
  id = 'quakes' as const;
  private pts = new PointSet(600);
  private stems = new LineSet(600);
  draw(_cs: CamState, rel: Mat4, oc: DrawOpts, sizeMul: number, now: number): void {
    const list = quakes.data;
    if (!list?.length) return;
    const P = this.pts.clear();
    const L = this.stems.clear();
    const t = performance.now() / 1000;
    for (const q of list) {
      const w = GEO.ecef(q.lat, q.lon, 0.5);
      const ageH = (now - q.t) / 3.6e6;
      const fresh = ageH < 2 ? 1 : ageH < 12 ? 0.7 : 0.45;
      const col = q.mag >= 6 ? [1, 0.2, 0.25] : q.mag >= 5 ? [1, 0.5, 0.2] : q.mag >= 4 ? [1, 0.8, 0.3] : [0.6, 0.9, 1];
      const ph = (t * 0.5 + q.lat * 0.1) % 1;
      P.add(w, [col[0]!, col[1]!, col[2]!, fresh], (8 + q.mag * 4) * sizeMul, 1);
      P.add(w, [col[0]!, col[1]!, col[2]!, (1 - ph) * fresh * 0.8], (6 + q.mag * 4 + ph * (30 + q.mag * 12)) * sizeMul, 1);
      L.add(w, GEO.ecef(q.lat, q.lon, 0.5 + q.mag * q.mag * 5), [col[0]!, col[1]!, col[2]!, 0.8 * fresh], 1.5);
    }
    P.draw(rel, { ...oc, px: 1 });
    L.draw(rel, { ...oc, px: 1 });
  }
  *pickables(): Iterable<Pickable> {
    for (const q of quakes.data ?? []) yield { kind: 'quake', ref: q, w: GEO.ecef(q.lat, q.lon, 0.5) };
  }
}

export class EventLayer implements GlobeLayer {
  id = 'events' as const;
  private pts = new PointSet(400);
  draw(_cs: CamState, rel: Mat4, oc: DrawOpts, sizeMul: number): void {
    const P = this.pts.clear();
    const t = performance.now() / 1000;
    for (const e of events.data ?? []) {
      const c = EVENT_COLORS[e.cat] ?? [0.9, 0.9, 0.9];
      const w = GEO.ecef(e.lat, e.lon, 0.6);
      P.add(w, [c[0], c[1], c[2], 0.95], 11 * sizeMul, 2);
      P.add(w, [c[0], c[1], c[2], 0.35 + 0.3 * Math.sin(t * 3 + e.lat)], 26 * sizeMul, 1);
    }
    for (const l of launches.data ?? []) P.add(GEO.ecef(l.lat, l.lon, 0.8), [1, 0.85, 0.3, 0.9], 12 * sizeMul, 2);
    P.draw(rel, { ...oc, px: 1 });
  }
  *pickables(): Iterable<Pickable> {
    for (const e of events.data ?? []) yield { kind: 'event', ref: e, w: GEO.ecef(e.lat, e.lon, 0.6) };
    for (const l of launches.data ?? []) yield { kind: 'launch', ref: l, w: GEO.ecef(l.lat, l.lon, 0.8) };
  }
}

export const quakeLayer = new QuakeLayer();
export const eventLayer = new EventLayer();
