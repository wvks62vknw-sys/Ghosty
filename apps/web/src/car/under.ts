/**
 * UNDERNEATH (BRIEF-CAR item 2), the car lifted: in the car's coordinates, just under its floor — the sump, the gearbox
 * with the clutch's bell housing and the starter, the driveshafts out to the front wheels, the subframe, the steering rack
 * with its gaiters; the exhaust from the engine through the catalytic converter along the tunnel under its heat shields,
 * hung on rubbers, to the silencer and the tailpipe; the fuel tank in front of the rear axle and its pipes. (The tyres'
 * wear pattern is on each tyre, car/wheel.ts.) An electric car has a flat battery pack instead of the exhaust, the tank
 * and the engine's own parts. Every part carries its id (car/parts.ts UNDER_IDS).
 */
import { merge, mesh, tag, type Mats } from './kit';
import type { UnderId } from './parts';
import type { Body } from './body';
import type { CarSpec } from './spec';
import type { CarLib, TBufferGeometry, TMaterial, TObject3D } from './three';

type V3 = [number, number, number];

export function buildUnder(L: CarLib, spec: CarSpec, M: Mats, body: Body): TObject3D {
  const T = L.T;
  const d = spec.dims;
  const g = new T.Group();
  g.name = 'under';
  const y0 = d.clearance;
  const xf = body.wheels.find((w) => w.front)!.x;
  const xr = body.wheels.find((w) => !w.front)!.x;
  const zt = d.width / 2 - d.tyreW - 0.07;
  const ex = (body.bay.front + body.bay.rear) / 2 - 0.02;
  const add = (o: TObject3D, id: UnderId | 'bodywork' | 'battery pack') => {
    tag(o, id);
    g.add(o);
    return o;
  };
  const box = (w: number, h: number, dd: number, m: TMaterial, at: V3) => mesh(L, new T.BoxGeometry(w, h, dd), m, '', at);
  const tubeG = (pts: V3[], r: number): TBufferGeometry => new T.TubeGeometry(new T.CatmullRomCurve3(pts.map((p) => new T.Vector3(p[0], p[1], p[2]))), 64, r, 8, false);
  const ev = spec.electric;

  // the frame under the engine, the rear axle's beam, the steering rack, the driveshafts, the gearbox
  add(mesh(L, merge(L, [{ g: new T.BoxGeometry(0.7, 0.05, 0.06), at: [ex, y0 + 0.07, 0.42] }, { g: new T.BoxGeometry(0.7, 0.05, 0.06), at: [ex, y0 + 0.07, -0.42] }, { g: new T.BoxGeometry(0.06, 0.05, 0.9), at: [ex - 0.33, y0 + 0.07, 0] }]), M.block), 'subframe');
  add(box(0.08, 0.08, d.width - 0.5, M.block, [xr, d.tyreR, 0]), 'bodywork');
  const rack = new T.Group();
  const ry = y0 + 0.12;
  rack.add(mesh(L, new T.CylinderGeometry(0.025, 0.025, 0.7, 12), M.alu, '', [xf - 0.14, ry, 0]));
  for (const s of [1, -1]) rack.add(mesh(L, new T.CylinderGeometry(0.032, 0.022, 0.12, 12), M.rubber, '', [xf - 0.14, ry, s * 0.41]));
  for (const c of rack.children) c.rotation.x = Math.PI / 2;
  add(rack, 'steering_rack');
  const shafts = new T.Group();
  for (const s of [1, -1]) {
    const len = zt - 0.12;
    const sh = mesh(L, new T.CylinderGeometry(0.018, 0.018, len, 10), M.steel, '', [xf, d.tyreR, s * (0.12 + len / 2)]);
    sh.rotation.x = Math.PI / 2;
    shafts.add(sh);
  }
  add(shafts, 'driveshaft');
  add(box(0.32, 0.26, 0.24, M.alu, [ex, y0 + 0.2, -0.38]), 'gearbox');

  if (ev) {
    add(box(xf - xr - 0.6, 0.12, d.width - 0.4, M.block, [(xf + xr) / 2, y0 + 0.07, 0]), 'battery pack');
    return g;
  }
  add(box(0.34, 0.09, 0.44, M.block, [ex, y0 + 0.06, -0.06]), 'sump');
  const bell = mesh(L, new T.CylinderGeometry(0.15, 0.12, 0.08, 24), M.alu, '', [ex, y0 + 0.24, -0.24]);
  bell.rotation.x = Math.PI / 2;
  add(bell, 'clutch');
  const st = mesh(L, new T.CylinderGeometry(0.04, 0.04, 0.16, 14), M.steel, '', [ex - 0.17, y0 + 0.1, -0.2]);
  st.rotation.x = Math.PI / 2;
  add(st, 'starter');
  // the exhaust: down from the engine's front, the converter, back along the tunnel to the silencer and the tailpipe
  const yp = y0 + 0.05;
  const tip: V3 = [-d.length / 2 + 0.08, y0 + 0.11, -d.width / 2 + 0.34];
  const box0 = xr - 0.25;
  const pts: V3[] = [[ex + 0.2, y0 + 0.25, 0.05], [ex + 0.14, yp + 0.02, 0.06], [ex - 0.25, yp, 0.06], [xf - 1.1, yp, 0.05], [box0 + 0.45, yp + 0.01, 0.04], [box0 + 0.2, yp + 0.03, 0.1]];
  add(mesh(L, merge(L, [{ g: tubeG(pts, 0.024) }, { g: new T.CylinderGeometry(0.11, 0.11, 0.55, 24), at: [box0, yp + 0.06, -0.12], rot: [Math.PI / 2, 0, 0] }, { g: tubeG([[box0 - 0.05, yp + 0.06, -0.38], [tip[0] + 0.2, tip[1], tip[2]], tip], 0.022) }]), M.steel), 'exhaust');
  const cat = mesh(L, new T.CylinderGeometry(0.06, 0.06, 0.3, 18), M.alu, '', [ex - 0.42, yp, 0.06]);
  cat.rotation.z = Math.PI / 2;
  add(cat, 'cat');
  add(mesh(L, merge(L, [{ g: new T.BoxGeometry(0.6, 0.004, 0.22), at: [xf - 0.95, yp + 0.045, 0.05] }, { g: new T.BoxGeometry(0.5, 0.004, 0.26), at: [box0 + 0.05, yp + 0.18, -0.12] }]), M.chrome), 'heat_shield');
  const hangers: [number, number][] = [[xf - 1.4, 0.05], [box0 + 0.35, 0.04], [box0 - 0.3, -0.2]];
  add(mesh(L, merge(L, hangers.map(([x, z]) => ({ g: new T.TorusGeometry(0.018, 0.006, 6, 12), at: [x, yp + 0.04, z] as V3, rot: [0, Math.PI / 2, 0] as V3 }))), M.rubber), 'exhaust_mount');
  add(box(0.42, 0.16, 0.85, M.plastic, [xr + 0.42, y0 + 0.1, 0.05]), 'fuel_tank');
  add(mesh(L, merge(L, [0, 0.025].map((dz) => ({ g: tubeG([[xr + 0.2, y0 + 0.06, 0.45 + dz], [xf - 0.4, y0 + 0.05, 0.45 + dz], [ex - 0.1, y0 + 0.2, 0.32 + dz]], 0.006) }))), M.steel), 'fuel_line');
  return g;
}
