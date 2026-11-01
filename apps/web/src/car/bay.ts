/**
 * THE ENGINE BAY, BONNET UP (BRIEF-CAR item 2): a detailed stand-in laid out as on most front-engined cars — the engine
 * across the bay under its cover (oil cap on top, the yellow dipstick at the front, the plugs and coils beneath), the belt
 * and its pulleys at one end with the alternator, the aircon pump and the water pump, the exhaust manifold and turbo on
 * its face; the radiator, the aircon condenser and the fan behind the grille; the battery with its red and black terminals
 * and the fuse box at one front corner, the air box behind them; the coolant tank with its cap, the washer bottle's blue
 * cap, the brake fluid pot on the servo at the driver's side of the bulkhead, the strut tops, the hoses, the horn, the
 * wiper motor under the scuttle. Every part carries its id (car/parts.ts BAY_IDS: this file builds each one, the type
 * says so). An electric car has a motor under the cover and none of the engine's own parts.
 */
import { merge, mesh, tag, type Mats } from './kit';
import { PARTS, type BayId } from './parts';
import type { CarSpec } from './spec';
import type { Body } from './body';
import type { CarLib, TBufferGeometry, TMaterial, TObject3D } from './three';

type V3 = [number, number, number];

export function buildBay(L: CarLib, spec: CarSpec, M: Mats, body: Body): TObject3D {
  const T = L.T;
  const b = body.bay;
  const len = b.front - b.rear;
  const hw = b.halfW;
  const hgt = b.top - b.floor;
  /** A place in the bay: fx along it (0 the bulkhead, 1 the front), fz across (−1 nearside … +1 driver's side), fy up (0 the floor, 1 under the bonnet). */
  const P = (fx: number, fz: number, fy: number): V3 => [b.rear + fx * len, b.floor + fy * hgt, fz * hw];
  const group = new T.Group();
  group.name = 'bay';

  const box = (w: number, h: number, d: number, m: TMaterial, at: V3, part = '') => mesh(L, new T.BoxGeometry(w, h, d), m, part, at);
  const cyl = (r: number, h: number, m: TMaterial, at: V3, axis: 'x' | 'y' | 'z', part = '', seg = 20) => {
    const c = mesh(L, new T.CylinderGeometry(r, r, h, seg), m, part, at);
    if (axis === 'x') c.rotation.z = Math.PI / 2;
    if (axis === 'z') c.rotation.x = Math.PI / 2;
    return c;
  };
  const tubeG = (pts: V3[], r: number): TBufferGeometry => new T.TubeGeometry(new T.CatmullRomCurve3(pts.map((p) => new T.Vector3(p[0], p[1], p[2]))), 24, r, 8, false);

  // ---- the bay itself: inner wings, bulkhead, the slam panel across the front (painted like the body)
  const shell = new T.Group();
  shell.add(box(len, hgt * 0.9, 0.02, M.paint, [b.rear + len / 2, b.floor + hgt * 0.45, hw + 0.012], 'bodywork'));
  shell.add(box(len, hgt * 0.9, 0.02, M.paint, [b.rear + len / 2, b.floor + hgt * 0.45, -hw - 0.012], 'bodywork'));
  shell.add(box(0.02, hgt * 0.95, hw * 2, M.trim, [b.rear - 0.01, b.floor + hgt * 0.47, 0], 'bodywork'));
  shell.add(box(0.06, 0.05, hw * 1.7, M.paint, [b.front - 0.01, b.top - 0.04, 0], 'bodywork'));
  group.add(shell);

  const ev = spec.electric;
  // the engine block, across the bay
  const ex = 0.47;
  const ez = -0.08;
  const bl = { sx: Math.min(0.42, len * 0.36), sy: Math.max(0.24, Math.min(0.46, hgt - 0.17)), sz: Math.min(0.62, hw * 0.88) };
  const [bx, , bz] = P(ex, ez, 0);
  const by0 = b.floor + 0.06;
  const byTop = by0 + bl.sy;
  const bxFront = bx + bl.sx / 2;
  const bzR = bz + bl.sz / 2;
  const bzL = bz - bl.sz / 2;
  group.add(box(bl.sx, bl.sy, bl.sz, ev ? M.alu : M.block, [bx, by0 + bl.sy / 2, bz], 'engine_cover'));

  const BUILD: Record<BayId, () => TObject3D | null> = {
    engine_cover: () => {
      const g = new T.Group();
      const cover = mesh(L, new T.BoxGeometry(bl.sx * 0.9, 0.055, bl.sz * 0.92), ev ? M.plastic : M.trim);
      cover.position.set(bx, byTop + 0.03, bz);
      const badge = mesh(L, new T.CylinderGeometry(0.035, 0.035, 0.006, 24), M.chrome);
      badge.position.set(bx + 0.02, byTop + 0.06, bz + bl.sz * 0.15);
      g.add(cover, badge);
      if (ev) {
        // the motor's orange high-voltage cables
        g.add(mesh(L, tubeG([[bx - 0.1, byTop - 0.02, bzR], [bx - 0.18, byTop - 0.08, bzR + 0.08], [b.rear + 0.04, byTop - 0.15, bzR + 0.1]], 0.016), M.orange));
      }
      g.userData.cover = true;
      return g;
    },
    oil_cap: () => {
      if (ev) return null;
      const g = new T.Group();
      g.add(cyl(0.032, 0.012, M.yellow, [bx - 0.04, byTop + 0.064, bz - bl.sz * 0.22], 'y'), cyl(0.026, 0.024, M.trim, [bx - 0.04, byTop + 0.08, bz - bl.sz * 0.22], 'y'));
      return g;
    },
    dipstick: () => {
      if (ev) return null;
      const g = new T.Group();
      const ring = mesh(L, new T.TorusGeometry(0.024, 0.0065, 8, 20), M.yellow);
      ring.position.set(bxFront + 0.015, byTop + 0.04, bz + bl.sz * 0.12);
      g.add(ring, cyl(0.004, 0.2, M.yellow, [bxFront + 0.015, byTop - 0.07, bz + bl.sz * 0.12], 'y'));
      return g;
    },
    coils: () => {
      if (ev) return null;
      const parts = [0, 1, 2, 3].map((k) => ({ g: new T.BoxGeometry(0.05, 0.05, 0.045), at: [bx, byTop + 0.012, bzL + bl.sz * (0.2 + 0.2 * k)] as V3 }));
      return mesh(L, merge(L, parts), M.hose);
    },
    exhaust_manifold: () => {
      if (ev) return null;
      return box(0.035, bl.sy * 0.45, bl.sz * 0.78, M.alu, [bxFront + 0.02, by0 + bl.sy * 0.62, bz]);
    },
    turbo: () => {
      if (ev) return null;
      const g = new T.Group();
      const snail = mesh(L, new T.TorusGeometry(0.06, 0.035, 10, 24), M.alu);
      snail.position.set(bxFront + 0.08, by0 + bl.sy * 0.55, bzL + 0.1);
      snail.rotation.y = Math.PI / 2;
      g.add(snail, cyl(0.045, 0.08, M.alu, [bxFront + 0.08, by0 + bl.sy * 0.55, bzL + 0.16], 'z'));
      return g;
    },
    drive_belt: () => {
      if (ev) return null;
      const z = bzR + 0.03;
      const pul = belt(bx, by0, bl, z);
      const g = new T.Group();
      g.add(mesh(L, merge(L, pul.map((p) => ({ g: new T.CylinderGeometry(p.r, p.r, 0.03, 24), at: [p.x, p.y, z] as V3, rot: [Math.PI / 2, 0, 0] as V3 }))), M.alu));
      // the belt round the outside of the pulleys
      const loop: V3[] = [];
      const cx = pul.reduce((s, p) => s + p.x, 0) / pul.length;
      const cy = pul.reduce((s, p) => s + p.y, 0) / pul.length;
      const order = [...pul].sort((a, c) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(c.y - cy, c.x - cx));
      for (const p of order) {
        const a = Math.atan2(p.y - cy, p.x - cx);
        for (const da of [-0.6, 0, 0.6]) loop.push([p.x + Math.cos(a + da) * (p.r + 0.006), p.y + Math.sin(a + da) * (p.r + 0.006), z]);
      }
      g.add(mesh(L, new T.TubeGeometry(new T.CatmullRomCurve3(loop.map((p) => new T.Vector3(p[0], p[1], p[2])), true), 96, 0.006, 6, true), M.hose));
      return g;
    },
    alternator: () => {
      if (ev) return null;
      const p = belt(bx, by0, bl, 0)[1]!;
      return cyl(0.068, 0.13, M.alu, [p.x, p.y, bzR - 0.05], 'z');
    },
    aircon_compressor: () => {
      const p = belt(bx, by0, bl, 0)[2]!;
      return cyl(0.062, 0.14, M.steel, [p.x, p.y, bzR - 0.06], 'z');
    },
    water_pump: () => {
      if (ev) return null;
      const p = belt(bx, by0, bl, 0)[3]!;
      return cyl(0.05, 0.05, M.alu, [p.x, p.y, bzR - 0.01], 'z');
    },
    thermostat: () => {
      if (ev) return null;
      return box(0.06, 0.05, 0.06, M.alu, [bxFront - 0.03, byTop - 0.02, bzR - 0.04]);
    },
    engine_mount: () => box(0.1, 0.08, 0.13, M.rubber, [bx, byTop - 0.05, bzR + 0.09]),
    top_hose: () => mesh(L, tubeG([[b.front - 0.06, b.floor + hgt * 0.78, hw * 0.55], [bxFront + 0.12, byTop + 0.02, hw * 0.45], [bxFront - 0.03, byTop - 0.01, bzR - 0.04]], 0.022), M.hose),
    heater_hoses: () => {
      if (ev) return null;
      const g = new T.Group();
      for (const dz of [0.05, 0.12]) g.add(mesh(L, tubeG([[bx - bl.sx / 2, by0 + bl.sy * 0.7, bz + dz], [b.rear + 0.12, by0 + bl.sy * 0.85, bz + dz + 0.05], [b.rear + 0.01, by0 + bl.sy * 0.8, bz + dz + 0.08]], 0.012), M.hose));
      return g;
    },
    radiator: () => box(0.035, hgt * 0.72, hw * 1.55, M.block, [b.front - 0.06, b.floor + hgt * 0.45, 0]),
    condenser: () => box(0.016, hgt * 0.66, hw * 1.5, M.alu, [b.front - 0.025, b.floor + hgt * 0.44, 0]),
    fan: () => {
      const r = Math.min(0.17, hgt * 0.32);
      const at: V3 = [b.front - 0.11, b.floor + hgt * 0.45, -hw * 0.3];
      const blades = Array.from({ length: 7 }, (_, k) => ({ g: new T.BoxGeometry(0.008, r * 0.85, 0.06), at: [at[0], at[1] + Math.cos((k / 7) * Math.PI * 2) * r * 0.5, at[2] + Math.sin((k / 7) * Math.PI * 2) * r * 0.5] as V3, rot: [(k / 7) * Math.PI * 2, 0.35, 0] as V3 }));
      const g = new T.Group();
      g.add(mesh(L, merge(L, [...blades, { g: new T.CylinderGeometry(0.04, 0.04, 0.04, 16), at, rot: [0, 0, Math.PI / 2] }]), M.plastic));
      const shroud = mesh(L, new T.TorusGeometry(r, 0.012, 6, 32), M.plastic);
      shroud.position.set(...at);
      shroud.rotation.y = Math.PI / 2;
      g.add(shroud);
      return g;
    },
    horn: () => {
      const h = cyl(0.045, 0.03, M.trim, P(1, -0.55, 0.3), 'x');
      h.position.x = b.front + 0.02;
      return h;
    },
    battery: () => box(0.17, Math.min(0.18, hgt * 0.4), 0.26, M.trim, [...P(0.76, -0.66, 0)].map((v, i) => (i === 1 ? b.top - 0.03 - Math.min(0.18, hgt * 0.4) / 2 - 0.035 : v)) as V3),
    battery_terminals: () => {
      const [x, , z] = P(0.76, -0.66, 0);
      const y = b.top - 0.03 - 0.03;
      const g = new T.Group();
      g.add(box(0.05, 0.03, 0.05, M.red, [x + 0.04, y, z + 0.09]), box(0.04, 0.025, 0.04, M.trim, [x + 0.04, y, z - 0.09]));
      g.add(cyl(0.01, 0.02, M.alu, [x + 0.04, y - 0.02, z + 0.09], 'y'), cyl(0.01, 0.02, M.alu, [x + 0.04, y - 0.02, z - 0.09], 'y'));
      return g;
    },
    fuse_box: () => {
      const g = new T.Group();
      const [x, , z] = P(0.5, -0.82, 0);
      const y = b.top - 0.1;
      g.add(box(0.15, 0.09, 0.12, M.plastic, [x, y, z]), box(0.155, 0.012, 0.125, M.trim, [x, y + 0.05, z]));
      return g;
    },
    air_box: () => {
      if (ev) return null;
      const g = new T.Group();
      const [x, , z] = P(0.27, -0.6, 0);
      const y = b.top - 0.12;
      g.add(box(0.24, 0.12, 0.26, M.plastic, [x, y, z]), box(0.245, 0.01, 0.265, M.trim, [x, y + 0.035, z]));
      g.add(mesh(L, tubeG([[x + 0.12, y, z + 0.05], [bx, byTop + 0.05, bzL + 0.08], [bx - 0.05, byTop + 0.02, bz]], 0.035), M.plastic));
      return g;
    },
    strut_top: () => {
      const fx = (b.axle - b.rear) / len;
      const g = new T.Group();
      for (const s of [1, -1]) {
        const [x, , z] = P(fx, s * 0.9, 0);
        const dome = mesh(L, new T.SphereGeometry(0.075, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.paint);
        dome.position.set(x, b.top - 0.1, z);
        dome.scale.y = 0.45;
        g.add(dome, cyl(0.016, 0.03, M.alu, [x, b.top - 0.07, z], 'y'));
      }
      return g;
    },
    brake_fluid: () => {
      const g = new T.Group();
      const [x, , z] = P(0.08, 0.55, 0);
      const y = b.floor + hgt * 0.6;
      g.add(cyl(0.11, 0.1, M.trim, [x, y, z], 'x', '', 28));
      g.add(cyl(0.025, 0.14, M.alu, [x + 0.12, y, z], 'x'));
      g.add(box(0.08, 0.07, 0.07, M.pot, [x + 0.12, y + 0.07, z]));
      g.add(cyl(0.024, 0.022, M.yellow, [x + 0.12, y + 0.115, z], 'y'));
      return g;
    },
    coolant_tank: () => {
      const g = new T.Group();
      const [x, , z] = P(0.6, 0.78, 0);
      const y = b.top - 0.12;
      g.add(box(0.13, 0.11, 0.15, M.pot, [x, y, z]));
      g.add(box(0.12, 0.06, 0.14, M.pink, [x, y - 0.02, z]));
      // the MIN and MAX marks
      g.add(box(0.132, 0.004, 0.02, M.trim, [x, y - 0.03, z - hw * 0.0 - 0.066]), box(0.132, 0.004, 0.02, M.trim, [x, y + 0.025, z - 0.066]));
      return g;
    },
    coolant_cap: () => {
      const [x, , z] = P(0.6, 0.78, 0);
      return cyl(0.032, 0.026, M.trim, [x, b.top - 0.05, z], 'y');
    },
    washer_bottle: () => {
      const g = new T.Group();
      const [x, , z] = P(0.9, 0.82, 0);
      g.add(cyl(0.022, 0.07, M.pot, [x, b.top - 0.1, z], 'y'), cyl(0.03, 0.02, M.blue, [x, b.top - 0.055, z], 'y'));
      return g;
    },
    wiper_motor: () => cyl(0.04, 0.1, M.steel, P(0.03, 0.4, 0.9), 'x'),
    scuttle_drain: () => {
      const g = new T.Group();
      g.add(box(0.09, 0.012, hw * 2, M.plastic, [b.rear - 0.045, b.top + 0.005, 0]));
      for (const s of [1, -1]) g.add(cyl(0.012, 0.014, M.trim, [b.rear - 0.04, b.top + 0.008, s * hw * 0.85], 'y'));
      return g;
    },
  };

  for (const id of Object.keys(BUILD) as BayId[]) {
    if (ev && PARTS[id].ice) continue;
    const o = BUILD[id]();
    if (!o) continue;
    tag(o, id);
    group.add(o);
  }
  return group;
}

/** The pulleys at the belt end of the engine: crank, alternator, aircon pump, water pump, tensioner. */
function belt(bx: number, by0: number, bl: { sx: number; sy: number }, z: number): { x: number; y: number; r: number; z: number }[] {
  const f = bx + bl.sx / 2;
  return [
    { x: bx + 0.02, y: by0 + 0.08, r: 0.075, z },
    { x: f + 0.02, y: by0 + bl.sy * 0.82, r: 0.034, z },
    { x: f + 0.03, y: by0 + bl.sy * 0.35, r: 0.055, z },
    { x: bx - 0.05, y: by0 + bl.sy * 0.75, r: 0.05, z },
    { x: bx + 0.07, y: by0 + bl.sy * 0.55, r: 0.03, z },
  ];
}
