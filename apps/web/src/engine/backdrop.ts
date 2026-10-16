/**
 * The 3D volume behind every non-globe tab — a quiet workshop:
 *
 *   floor     a faint grid with a soft pulse once a second (wall-clock time, not frame time)
 *   gyro      two gyroscopic rings turning slowly on different axes, driven by the clock
 *   dust      a few motes drifting upward through the volume
 *   stars     the far field
 *
 * The camera steers from engine/space.ts (pointer on a computer, phone tilt on a phone), so
 * the panes in front (CSS, --px/--py) and this scene move as one volume.
 */
import { gfx, LineSet, PointSet } from './gfx';
import { M4, RAD, rng, type Vec3 } from './math';
import { view } from './space';

const FLOOR_Y = -3.4;

export class Backdrop {
  private stars = new PointSet(900);
  private floor = new LineSet(400);
    private rings = new LineSet(800);
  private dust = new PointSet(110);
  private motes: { x: number; y: number; z: number; s: number; p: number }[] = [];
  private built = '';
  private t = 0;

  private build(): void {
    const c = gfx.theme.c;
    this.built = c.join();
    const r = rng(11);
    this.stars.clear();
    for (let i = 0; i < 900; i++) {
      const u = r() * 2 - 1;
      const t = r() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const d = 70 * (0.6 + r() * 0.4);
      const tn = r();
      this.stars.add([d * s * Math.cos(t), d * u, d * s * Math.sin(t)], [0.6 + tn * 0.4, 0.8 + tn * 0.2, 1, (0.15 + r() * 0.5) * 0.7], 1 + r() * r() * 2.4, 0);
    }
    // Dust motes.
    this.motes = [];
    const rr = rng(23);
    for (let i = 0; i < 110; i++) this.motes.push({ x: (rr() - 0.5) * 16, y: FLOOR_Y + rr() * 9, z: (rr() - 0.5) * 12, s: 0.6 + rr() * 2.2, p: rr() * 100 });
  }

  /** The two rings are rebuilt each frame (they turn), as plain circles with tick marks. */
  private buildRings(now: number): void {
    const c = gfx.theme.c;
    const L = this.rings.clear();
    const sec = now / 1000;
    const specs: { r: number; rot: Float32Array; col: [number, number, number, number]; ticks: number }[] = [
      { r: 4.6, rot: M4.mul(M4.rotY(sec * 0.05), M4.rotX(72 * RAD)), col: [c[0], c[1], c[2], 0.22], ticks: 72 },
      { r: 3.4, rot: M4.mul(M4.rotZ(sec * 0.08), M4.rotY(sec * 0.04 + 1.2)), col: [c[0], c[1], c[2], 0.28], ticks: 60 },
    ];
    const tr = (m: Float32Array, x: number, y: number, z: number): [number, number, number] => [
      m[0]! * x + m[4]! * y + m[8]! * z,
      m[1]! * x + m[5]! * y + m[9]! * z,
      m[2]! * x + m[6]! * y + m[10]! * z,
    ];
    for (const s of specs) {
      const segs = 120;
      for (let i = 0; i < segs; i++) {
        const t0 = (i / segs) * Math.PI * 2;
        const t1 = ((i + 1) / segs) * Math.PI * 2;
        // one bright arc sweeps round each ring once a minute
        const sweep = ((sec / 60) % 1) * Math.PI * 2;
        let d = Math.abs(((t0 - sweep + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        d = Math.max(0, 1 - d / 0.9);
        const al = s.col[3] * (0.5 + 0.5 * d) + d * 0.18;
        L.add(tr(s.rot, Math.cos(t0) * s.r, 0, Math.sin(t0) * s.r), tr(s.rot, Math.cos(t1) * s.r, 0, Math.sin(t1) * s.r), [s.col[0], s.col[1], s.col[2], al], 1.2);
      }
      for (let i = 0; i < s.ticks; i++) {
        const th = (i / s.ticks) * Math.PI * 2;
        const len = i % 6 === 0 ? 0.18 : 0.07;
        L.add(tr(s.rot, Math.cos(th) * s.r, 0, Math.sin(th) * s.r), tr(s.rot, Math.cos(th) * (s.r + len), 0, Math.sin(th) * (s.r + len)), [s.col[0], s.col[1], s.col[2], s.col[3] * 1.2], 1);
      }
    }
  }

  private buildFloor(now: number): void {
    const c = gfx.theme.c;
    const L = this.floor.clear();
    const size = 30;
    const div = 30;
    const h = size / 2;
    // the pulse: a ring that expands from the centre once a second, on the real clock
    const ph = (now % 1000) / 1000;
    const pr = ph * 9;
    for (let i = 0; i <= div; i++) {
      const t = -h + (size * i) / div;
      const base = (1 - Math.abs(t) / h) * 0.14;
      const near = Math.max(0, 1 - Math.abs(Math.abs(t) - pr) / 1.6) * (1 - ph) * 0.22;
      L.add([t, FLOOR_Y, -h], [t, FLOOR_Y, h], [c[0], c[1], c[2], base], 1);
      L.add([-h, FLOOR_Y, t], [h, FLOOR_Y, t], [c[0], c[1], c[2], base], 1);
      if (near > 0.02) {
        L.add([t, FLOOR_Y + 0.01, -pr], [t, FLOOR_Y + 0.01, pr], [c[0], c[1], c[2], near * 0.3], 1);
        L.add([-pr, FLOOR_Y + 0.01, t], [pr, FLOOR_Y + 0.01, t], [c[0], c[1], c[2], near * 0.3], 1);
      }
    }
  }

  update(dt: number): void {
    this.t += dt;
  }

  draw(): void {
    if (this.built !== gfx.theme.c.join()) this.build();
    const now = Date.now();
    const g = gfx;
    const c = g.theme.c;
    const ry = view.sx * 0.3;
    const rx = -view.sy * 0.2;
    const wide = innerWidth >= 900;
    const dist = wide ? 10.6 : 15;
    const eye: [number, number, number] = [Math.sin(ry) * dist, 0.4 + Math.sin(rx) * dist * 0.5, Math.cos(ry) * dist];
    g.begin(g.theme.bg.map((v) => v * 0.55) as Vec3);
    g.cam(M4.look(eye, [0, 0.2, 0], [0, 1, 0]), M4.persp(46 * RAD, g.w / g.h, 0.05, 200), 0.05, eye);
    g.additive();
    this.stars.draw(M4.mul(M4.rotY(this.t * 0.01), M4.rotX(this.t * 0.006)));
    this.buildFloor(now);
    this.floor.draw(M4.rotY(this.t * 0.02), { px: 1 });
    this.buildRings(now);
    this.rings.draw(M4.id(), { px: 1 });
    const P = this.dust.clear();
    for (const m of this.motes) {
      const y = FLOOR_Y + (((m.y - FLOOR_Y) + this.t * 0.12 * m.s) % 9);
      const x = m.x + Math.sin(this.t * 0.3 + m.p) * 0.25;
      const z = m.z + Math.cos(this.t * 0.22 + m.p) * 0.25;
      const tw = 0.5 + 0.5 * Math.sin(this.t * 1.7 + m.p * 3);
      P.add([x, y, z], [c[0], c[1], c[2], 0.14 + tw * 0.3], 1.8 + m.s * 1.2, 0);
    }
    P.draw(M4.id(), { px: 1 });
    g.post.mode = 0;
    g.post.bloom = 0.55;
    g.post.scan = 0.05;
    g.present();
  }
}

export const backdrop = new Backdrop();
