/**
 * The 3D volume behind every non-globe tab — a quiet room:
 *
 *   dust      a few motes drifting upward through the volume, in the theme's accent
 *   stars     the far field
 *
 * The camera steers from engine/space.ts (pointer on a computer, phone tilt on a phone), so
 * the panes in front (CSS, --px/--py) and this scene move as one volume.
 */
import { gfx, PointSet } from './gfx';
import { M4, RAD, rng, type Vec3 } from './math';
import { view } from './space';

const FLOOR_Y = -3.4;

export class Backdrop {
  private stars = new PointSet(900);
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

  update(dt: number): void {
    this.t += dt;
  }

  draw(): void {
    if (this.built !== gfx.theme.c.join()) this.build();
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
    // Only the far stars and a little dust: no grid, no rings, no scanlines.
    this.stars.draw(M4.mul(M4.rotY(this.t * 0.01), M4.rotX(this.t * 0.006)));
    const P = this.dust.clear();
    for (const m of this.motes.slice(0, 40)) {
      const y = FLOOR_Y + (((m.y - FLOOR_Y) + this.t * 0.12 * m.s) % 9);
      const x = m.x + Math.sin(this.t * 0.3 + m.p) * 0.25;
      const z = m.z + Math.cos(this.t * 0.22 + m.p) * 0.25;
      const tw = 0.5 + 0.5 * Math.sin(this.t * 1.7 + m.p * 3);
      P.add([x, y, z], [c[0], c[1], c[2], 0.14 + tw * 0.3], 1.8 + m.s * 1.2, 0);
    }
    P.draw(M4.id(), { px: 1 });
    g.post.mode = 0;
    g.post.bloom = 0.35;
    g.post.scan = 0;
    g.present();
  }
}

export const backdrop = new Backdrop();
