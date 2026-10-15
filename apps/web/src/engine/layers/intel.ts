/**
 * GOD'S EYE intelligence layers: ships, weather alerts, disasters,
 * buoys, aurora, undersea cables and 911 dispatch. Data comes from data/intel.ts.
 * Static geometry (cables, alert outlines, aurora, buoys) is rebuilt only when its
 * feed changes; moving things (ships) are dead-reckoned every frame.
 */
import { ALERT_COLORS, alerts, aurora, buoys, cables, disasters, dispatch, shipKind, ships, SHIP_COLORS, type Ship } from '../../data/intel';
import type { CamState } from '../camera';
import { GEO } from '../geo';
import { LineSet, PointSet, type DrawOpts } from '../gfx';
import type { GlobeLayer, Pickable } from '../globe';
import { RAD, type Mat4, type Vec3 } from '../math';

/** Great-circle polyline lifted `alt` km, split so no chord dips under the surface. */
function arc(L: LineSet, pts: [number, number][], alt: number, c: ArrayLike<number>, w: number): void {
  let prev: Vec3 | null = null;
  let prevLL: [number, number] | null = null;
  for (const p of pts) {
    if (prevLL) {
      const km = GEO.hav(prevLL[0], prevLL[1], p[0], p[1]);
      const steps = Math.min(64, Math.max(1, Math.ceil(km / 150)));
      const brg = GEO.bearing(prevLL[0], prevLL[1], p[0], p[1]);
      for (let i = 1; i <= steps; i++) {
        const q = i === steps ? { lat: p[0], lon: p[1] } : GEO.dest(prevLL[0], prevLL[1], brg, (km * i) / steps);
        const w2 = GEO.ecef(q.lat, q.lon, alt);
        L.add(prev!, w2, c, w);
        prev = w2;
      }
    } else prev = GEO.ecef(p[0], p[1], alt);
    prevLL = p;
  }
}

const hex = (s: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec(s);
  if (!m) return [0.3, 0.8, 1];
  const n = parseInt(m[1]!, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

// ---------------------------------------------------------------------------

export class ShipLayer implements GlobeLayer {
  id = 'ships' as const;
  selected: Ship | null = null;
  private pts = new PointSet(20000);
  world(s: Ship, now: number): Vec3 {
    const p = ships.pos(s, now);
    return GEO.ecef(p.lat, p.lon, 0.02);
  }
  color(s: Ship): [number, number, number, number] {
    const c = SHIP_COLORS[shipKind(s.type)] ?? [0.8, 0.8, 0.8];
    return [c[0], c[1], c[2], s.sog < 0.5 ? 0.6 : 1];
  }
  draw(_cs: CamState, rel: Mat4, oc: DrawOpts, sizeMul: number, now: number): void {
    if (!ships.list.size) return;
    const P = this.pts.clear();
    for (const s of ships.list.values()) {
      const w = this.world(s, now);
      if (s.sog < 0.5) P.add(w, this.color(s), 7 * sizeMul, 0);
      else P.add(w, this.color(s), 12 * sizeMul, 5, s.hdg * RAD);
    }
    if (this.selected) P.add(this.world(this.selected, now), [1, 1, 1, 0.9], 30 * sizeMul, 1);
    P.draw(rel, { ...oc, px: 1 });
  }
  *pickables(now: number): Iterable<Pickable> {
    for (const s of ships.list.values()) yield { kind: 'ship', ref: s, w: this.world(s, now) };
  }
}

export class AlertLayer implements GlobeLayer {
  id = 'alerts' as const;
  private lines = new LineSet(20000);
  private pts = new PointSet(800);
  private builtAt = -1;
  draw(_cs: CamState, rel: Mat4, oc: DrawOpts, sizeMul: number): void {
    const list = alerts.data;
    if (!list?.length) return;
    if (this.builtAt !== alerts.at) {
      const L = this.lines.clear();
      const P = this.pts.clear();
      for (const a of list) {
        const c = ALERT_COLORS[a.severity] ?? ALERT_COLORS.Unknown!;
        for (const r of a.rings) arc(L, r, 0.6, [c[0], c[1], c[2], 0.85], 1.6);
        P.add(GEO.ecef(a.lat, a.lon, 0.8), [c[0], c[1], c[2], 0.9], 10, 2);
      }
      this.builtAt = alerts.at;
    }
    this.lines.draw(rel, { ...oc, px: 1 });
    this.pts.draw(rel, { ...oc, px: 1, size: sizeMul });
  }
  *pickables(): Iterable<Pickable> {
    for (const a of alerts.data ?? []) yield { kind: 'alert', ref: a, w: GEO.ecef(a.lat, a.lon, 0.8) };
  }
}

const LEVEL: Record<string, [number, number, number]> = { Red: [1, 0.15, 0.2], Orange: [1, 0.55, 0.1], Green: [0.4, 0.95, 0.5] };

export class DisasterLayer implements GlobeLayer {
  id = 'disasters' as const;
  private pts = new PointSet(600);
  draw(_cs: CamState, rel: Mat4, oc: DrawOpts, sizeMul: number): void {
    const list = disasters.data;
    if (!list?.length) return;
    const P = this.pts.clear();
    const t = performance.now() / 1000;
    for (const d of list) {
      const c = LEVEL[d.level] ?? LEVEL.Green!;
      const w = GEO.ecef(d.lat, d.lon, 1);
      const big = d.level === 'Red' ? 1.6 : d.level === 'Orange' ? 1.25 : 1;
      P.add(w, [c[0], c[1], c[2], 1], 13 * big * sizeMul, 1);
      P.add(w, [c[0], c[1], c[2], 0.9], 6 * big * sizeMul, 0);
      if (d.level !== 'Green') {
        const ph = (t * 0.6 + d.lat * 0.05) % 1;
        P.add(w, [c[0], c[1], c[2], (1 - ph) * 0.7], (14 + ph * 46) * big * sizeMul, 1);
      }
    }
    P.draw(rel, { ...oc, px: 1 });
  }
  *pickables(): Iterable<Pickable> {
    for (const d of disasters.data ?? []) yield { kind: 'disaster', ref: d, w: GEO.ecef(d.lat, d.lon, 1) };
  }
}

export class BuoyLayer implements GlobeLayer {
  id = 'buoys' as const;
  private pts = new PointSet(1500);
  private builtAt = -1;
  draw(_cs: CamState, rel: Mat4, oc: DrawOpts, sizeMul: number): void {
    const list = buoys.data;
    if (!list?.length) return;
    if (this.builtAt !== buoys.at) {
      const P = this.pts.clear();
      for (const b of list) {
        const h = b.wvht ?? 0;
        const c: [number, number, number, number] = h >= 6 ? [1, 0.3, 0.3, 1] : h >= 3 ? [1, 0.75, 0.3, 1] : [0.5, 0.8, 1, 0.95];
        P.add(GEO.ecef(b.lat, b.lon, 0.03), c, 8, 1);
      }
      this.builtAt = buoys.at;
    }
    this.pts.draw(rel, { ...oc, px: 1, size: sizeMul });
  }
  *pickables(): Iterable<Pickable> {
    for (const b of buoys.data ?? []) yield { kind: 'buoy', ref: b, w: GEO.ecef(b.lat, b.lon, 0.03) };
  }
}

export class AuroraLayer implements GlobeLayer {
  id = 'aurora' as const;
  private pts = new PointSet(12000);
  private builtAt = -1;
  draw(_cs: CamState, rel: Mat4, oc: DrawOpts, sizeMul: number): void {
    const g = aurora.data;
    if (!g?.cells.length) return;
    if (this.builtAt !== aurora.at) {
      const P = this.pts.clear();
      for (const [lat, lon, v] of g.cells) {
        const k = Math.min(1, v / 60);
        P.add(GEO.ecef(lat, lon, 110), [0.25 + k * 0.4, 1, 0.45 + k * 0.2, 0.12 + k * 0.4], 22 + k * 20, 0);
      }
      this.builtAt = aurora.at;
    }
    this.pts.draw(rel, { ...oc, px: 1, size: sizeMul });
  }
}

export class CableLayer implements GlobeLayer {
  id = 'cables' as const;
  private lines = new LineSet(120000);
  private builtAt = -1;
  draw(_cs: CamState, rel: Mat4, oc: DrawOpts): void {
    const list = cables.data;
    if (!list?.length) return;
    if (this.builtAt !== cables.at) {
      const L = this.lines.clear();
      for (const c of list) {
        const col = hex(c.color);
        for (const l of c.lines) arc(L, l, 0.3, [col[0], col[1], col[2], 0.75], 1.2);
      }
      this.builtAt = cables.at;
    }
    this.lines.draw(rel, { ...oc, px: 1 });
  }
  *pickables(): Iterable<Pickable> {
    for (const c of cables.data ?? []) {
      const l = c.lines[0];
      const m = l?.[Math.floor(l.length / 2)];
      if (m) yield { kind: 'cable', ref: c, w: GEO.ecef(m[0], m[1], 0.3) };
    }
  }
}

export class DispatchLayer implements GlobeLayer {
  id = 'dispatch' as const;
  private pts = new PointSet(500);
  draw(_cs: CamState, rel: Mat4, oc: DrawOpts, sizeMul: number, now: number): void {
    const list = dispatch.data;
    if (!list?.length) return;
    const P = this.pts.clear();
    const t = performance.now() / 1000;
    for (const d of list) {
      const ageH = (now - d.t) / 3.6e6;
      const fresh = ageH < 1 ? 1 : ageH < 4 ? 0.7 : 0.4;
      const fire = /fire|smoke|explosion|hazmat/i.test(d.type);
      const c = fire ? [1, 0.35, 0.2] : /aid|medic|medical/i.test(d.type) ? [0.4, 0.8, 1] : [1, 0.85, 0.3];
      const w = GEO.ecef(d.lat, d.lon, 0.05);
      P.add(w, [c[0]!, c[1]!, c[2]!, fresh], 9 * sizeMul, 2);
      if (ageH < 1) P.add(w, [c[0]!, c[1]!, c[2]!, 0.4 + 0.3 * Math.sin(t * 4 + d.lat * 50)], 22 * sizeMul, 1);
    }
    P.draw(rel, { ...oc, px: 1 });
  }
  *pickables(): Iterable<Pickable> {
    for (const d of dispatch.data ?? []) yield { kind: 'dispatch', ref: d, w: GEO.ecef(d.lat, d.lon, 0.05) };
  }
}

export const shipLayer = new ShipLayer();
export const alertLayer = new AlertLayer();
export const disasterLayer = new DisasterLayer();
export const buoyLayer = new BuoyLayer();
export const auroraLayer = new AuroraLayer();
export const cableLayer = new CableLayer();
export const dispatchLayer = new DispatchLayer();
export const INTEL_LAYERS: GlobeLayer[] = [cableLayer, auroraLayer, alertLayer, buoyLayer, dispatchLayer, disasterLayer, shipLayer];
