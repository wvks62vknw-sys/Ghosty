/** The 3D backdrop behind non-globe tabs: drifting stars and a holographic floor grid. */
import { gfx, LineSet, PointSet } from './gfx';
import { M4, RAD, rng } from './math';

const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
addEventListener('pointermove', (e) => {
  pointer.x = (e.clientX / innerWidth) * 2 - 1;
  pointer.y = (e.clientY / innerHeight) * 2 - 1;
}, { passive: true });

export class Backdrop {
  private stars = new PointSet(1800);
  private floor = new LineSet(200);
  private built = '';
  private t = 0;

  private build(): void {
    const c = gfx.theme.c;
    this.built = c.join();
    const r = rng(11);
    this.stars.clear();
    for (let i = 0; i < 1800; i++) {
      const u = r() * 2 - 1;
      const t = r() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const d = 70 * (0.6 + r() * 0.4);
      const tn = r();
      this.stars.add([d * s * Math.cos(t), d * u, d * s * Math.sin(t)], [0.6 + tn * 0.4, 0.8 + tn * 0.2, 1, (0.25 + r() * 0.75) * 0.8], 1 + r() * r() * 3.2, 0);
    }
    this.floor.clear();
    const size = 30;
    const div = 30;
    const h = size / 2;
    for (let i = 0; i <= div; i++) {
      const t = -h + (size * i) / div;
      const a = (1 - Math.abs(t) / h) * 0.22;
      this.floor.add([t, -3.4, -h], [t, -3.4, h], [c[0], c[1], c[2], a], 1);
      this.floor.add([-h, -3.4, t], [h, -3.4, t], [c[0], c[1], c[2], a], 1);
    }
  }

  update(dt: number): void {
    this.t += dt;
    const k = Math.min(1, dt * 3);
    pointer.sx += (pointer.x - pointer.sx) * k;
    pointer.sy += (pointer.y - pointer.sy) * k;
  }

  draw(): void {
    if (this.built !== gfx.theme.c.join()) this.build();
    const g = gfx;
    const ry = pointer.sx * 0.28;
    const rx = -pointer.sy * 0.18;
    const dist = innerWidth >= 900 ? 10.6 : 15;
    const eye: [number, number, number] = [Math.sin(ry) * dist, Math.sin(rx) * dist * 0.6, Math.cos(ry) * dist];
    g.begin([0.003, 0.008, 0.018]);
    g.cam(M4.look(eye, [0, 0, 0], [0, 1, 0]), M4.persp(46 * RAD, g.w / g.h, 0.05, 200), 0.05);
    g.additive();
    this.stars.draw(M4.mul(M4.rotY(this.t * 0.01), M4.rotX(this.t * 0.006)));
    this.floor.draw(M4.rotY(this.t * 0.02), { px: 1 });
    g.post.mode = 0;
    g.post.bloom = 0.6;
    g.post.scan = 0.15;
    g.present();
  }
}

export const backdrop = new Backdrop();
