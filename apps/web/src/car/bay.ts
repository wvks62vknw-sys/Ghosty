/**
 * THE ENGINE BAY, BONNET UP (BRIEF-CAR item 2): a detailed stand-in laid out as on most front-engined cars — the engine
 * across the bay under its cover (oil cap on top, the yellow dipstick at the front, the plugs and coils beneath), the belt
 * and its pulleys at one end with the alternator, the aircon pump and the water pump, the exhaust manifold and turbo on
 * its face; the radiator, the aircon condenser and the fan behind the grille; the battery with its red and black terminals
 * and the fuse box at one front corner, the air box behind them; the coolant tank with its cap, the washer bottle's blue
 * cap, the brake fluid pot on the servo at the driver's side of the bulkhead, the strut tops, the hoses, the horn, the
 * wiper motor under the scuttle. Every part carries its id (car/parts.ts BAY_IDS: this file builds each one, the type
 * says so). An electric car has a motor under the cover and none of the engine's own parts.
 *
 * BRIEF-WORKING-ENGINE: the engine is no longer a block with a cover: car/engine.ts and car/enginemesh.ts make a working one
 * (every part named, the crank turning), fitted into this bay's box at the stand-in's place, and this file's build table takes
 * its parts by id (the engine's own ids come from it; the bay's other parts are built here and hang off its box).
 */
import { merge, mesh, tag, type Mats } from './kit';
import { WorkingEngine } from './enginemesh';
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
  // the working engine, in its place across the bay: its box is what the hoses, the mounts and the air pipe reach for
  const W = new WorkingEngine(L, spec, M, b);
  group.userData.engine = W;
  const pl = W.place;
  const bx = (pl.min[0] + pl.max[0]) / 2;
  const bz = (pl.min[2] + pl.max[2]) / 2;
  const byTop = pl.max[1] - 0.1;
  const bxFront = pl.max[0];
  const bzR = pl.max[2];
  const bzL = pl.min[2];
  const yLow = pl.min[1] + 0.13;

  const BUILD: Record<BayId, () => TObject3D | null> = {
    // the engine's own parts, from the working engine (an id it does not have, such as an electric car's plugs, is null)
    engine_cover: () => W.take('engine_cover'),
    oil_cap: () => W.take('oil_cap'),
    dipstick: () => W.take('dipstick'),
    coils: () => W.take('coils'),
    exhaust_manifold: () => W.take('exhaust_manifold'),
    turbo: () => W.take('turbo'),
    drive_belt: () => W.take('drive_belt'),
    alternator: () => W.take('alternator'),
    aircon_compressor: () => W.take('aircon_compressor'),
    water_pump: () => W.take('water_pump'),
    thermostat: () => W.take('thermostat'),
    block: () => W.take('block'),
    head: () => W.take('head'),
    head_gasket: () => W.take('head_gasket'),
    piston: () => W.take('piston'),
    piston_rings: () => W.take('piston_rings'),
    con_rod: () => W.take('con_rod'),
    crankshaft: () => W.take('crankshaft'),
    flywheel: () => W.take('flywheel'),
    camshaft: () => W.take('camshaft'),
    inlet_valve: () => W.take('inlet_valve'),
    exhaust_valve: () => W.take('exhaust_valve'),
    valve_spring: () => W.take('valve_spring'),
    timing_belt: () => W.take('timing_belt'),
    timing_tensioner: () => W.take('timing_tensioner'),
    inlet_manifold: () => W.take('inlet_manifold'),
    throttle_body: () => W.take('throttle_body'),
    intercooler_pipe: () => W.take('intercooler_pipe'),
    oil_filter: () => W.take('oil_filter'),
    oil_pump: () => W.take('oil_pump'),
    plugs: () => W.take('plugs'),
    injectors: () => W.take('injectors'),
    fuel_rail: () => W.take('fuel_rail'),
    oil_passages: () => W.take('oil_passages'),
    coolant_passages: () => W.take('coolant_passages'),
    motor: () => W.take('motor'),
    inverter: () => W.take('inverter'),
    charger: () => W.take('charger'),
    coolant_loop: () => W.take('coolant_loop'),
    engine_mount: () => box(0.1, 0.08, 0.13, M.rubber, [bx, yLow + 0.1, bzR + 0.07]),
    top_hose: () => {
      const t = W.anchor('thermostat') ?? W.anchor('coolant_loop') ?? [bxFront - 0.03, byTop - 0.01, bzR - 0.04];
      return mesh(L, tubeG([[b.front - 0.06, b.floor + hgt * 0.78, hw * 0.55], [bxFront + 0.12, byTop + 0.02, hw * 0.45], t], 0.022), M.hose);
    },
    heater_hoses: () => {
      if (ev) return null;
      const g = new T.Group();
      for (const dz of [0.05, 0.12]) g.add(mesh(L, tubeG([[pl.min[0], yLow + 0.2, bz + dz], [b.rear + 0.12, yLow + 0.3, bz + dz + 0.05], [b.rear + 0.01, yLow + 0.28, bz + dz + 0.08]], 0.012), M.hose));
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
      const t = W.anchor('throttle_body') ?? [bx - 0.05, byTop + 0.02, bz];
      g.add(mesh(L, tubeG([[x + 0.12, y, z + 0.05], [(x + t[0]) / 2, Math.max(y, t[1]) + 0.04, (z + t[2]) / 2], t], 0.035), M.plastic));
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
  // the sump and the starter are the underneath's ids (car/under.ts draws them there too); the working engine has its own in the bay
  for (const id of ['sump', 'starter'] as const) {
    const o = W.take(id);
    if (o) {
      tag(o, id);
      group.add(o);
    }
  }
  group.add(W.glowRoot);
  return group;
}
