/**
 * THE WHEELS (BRIEF-CAR items 1–2): each corner's tyre — a lathed section with its sidewall bulge, the tread's grooves and
 * the 1.6 mm wear bars as a bump map — on a wheel styled for the car (five double spokes, six for an SUV, ten for a coupé,
 * a steel wheel with a trim for a van). One wheel group per corner, its outer face on local +z; the scene turns the
 * nearside ones round.
 */
import { merge, mesh, tag, type Mats } from './kit';
import type { WheelId } from './parts';
import type { CarSpec } from './spec';
import type { CarLib, TBufferGeometry, TObject3D } from './three';

/** The tyre and the wheel, as one group: what WHEEL OFF pulls away. Its axle is local z; its outer face +z. */
export function buildWheel(L: CarLib, spec: CarSpec, M: Mats): TObject3D {
  const T = L.T;
  const d = spec.dims;
  const R = d.tyreR;
  const rr = d.rimR;
  const hw = d.tyreW / 2;
  const sh = R - rr;
  const g = new T.Group();
  g.name = 'wheel';
  // the tyre's section, from the inner bead over the tread to the outer bead (a lathe turns it round its y axis)
  const prof: [number, number][] = [
    [rr + 0.005, -hw + 0.012], [rr + sh * 0.25, -hw - 0.004], [rr + sh * 0.55, -hw - 0.008], [rr + sh * 0.82, -hw - 0.004], [R - 0.012, -hw + 0.006], [R - 0.002, -hw + 0.02],
    [R, -hw + 0.035], [R, -hw / 2], [R, 0], [R, hw / 2], [R, hw - 0.035],
    [R - 0.002, hw - 0.02], [R - 0.012, hw - 0.006], [rr + sh * 0.82, hw + 0.004], [rr + sh * 0.55, hw + 0.008], [rr + sh * 0.25, hw + 0.004], [rr + 0.005, hw - 0.012],
  ];
  const tyre = mesh(L, new T.LatheGeometry(prof.map(([x, y]) => new T.Vector2(x, y)), 72), M.tyre, 'tyre');
  tyre.rotation.x = Math.PI / 2;
  g.add(tyre);
  tag(tyre, 'tyre');
  // the tread's band (its depth marks) and its inner edge (where a bad alignment wears it), each lit on its own
  const band = (y0: number, y1: number, id: string) => {
    const b = mesh(L, new T.LatheGeometry([new T.Vector2(R + 0.0015, y0), new T.Vector2(R + 0.0015, y1)], 72), M.tyre, id);
    b.rotation.x = Math.PI / 2;
    g.add(b);
  };
  band(-hw / 3, hw - 0.04, 'tread');
  band(-hw + 0.035, -hw / 3, 'tyre_wear');

  // the wheel: a dark inner barrel, then the face (spokes, lip, hub, bolts) as one polished piece
  const barrel = mesh(L, new T.CylinderGeometry(rr - 0.004, rr - 0.004, d.tyreW * 0.92, 40, 1, true), M.trim, 'rim');
  barrel.rotation.x = Math.PI / 2;
  g.add(barrel);
  const face: { g: TBufferGeometry; at?: [number, number, number]; rot?: [number, number, number]; scale?: [number, number, number] }[] = [];
  const zf = hw - 0.012;
  face.push({ g: new T.TorusGeometry(rr - 0.012, 0.011, 8, 56), at: [0, 0, zf] });
  if (spec.silhouette === 'van') {
    // a steel wheel under a plastic trim: a shallow dish with slots
    face.push({ g: new T.CylinderGeometry(rr - 0.02, rr - 0.03, 0.03, 40), at: [0, 0, zf - 0.01], rot: [Math.PI / 2, 0, 0] });
  } else {
    const n = spec.silhouette === 'coupe' ? 10 : spec.silhouette === 'suv' ? 6 : 5;
    const twin = n === 5;
    const len = rr - 0.075;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      for (const off of twin ? [-0.075, 0.075] : [0]) {
        const aa = a + off;
        const mid = 0.068 + len / 2;
        // spokes dish inward from the hub to the lip
        face.push({ g: new T.BoxGeometry(twin ? 0.026 : 0.034, len, 0.022), at: [Math.sin(aa) * mid, Math.cos(aa) * mid, zf - 0.012], rot: [0.12 * Math.cos(aa), -0.12 * Math.sin(aa), -aa] });
      }
    }
  }
  face.push({ g: new T.CylinderGeometry(0.075, 0.08, 0.035, 28), at: [0, 0, zf - 0.006], rot: [Math.PI / 2, 0, 0] });
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + 0.3;
    face.push({ g: new T.CylinderGeometry(0.009, 0.009, 0.02, 8), at: [Math.sin(a) * 0.05, Math.cos(a) * 0.05, zf + 0.012], rot: [Math.PI / 2, 0, 0] });
  }
  const rim = mesh(L, merge(L, face), M.alloy, 'rim');
  g.add(rim);
  const cap = mesh(L, new T.CircleGeometry(0.03, 24), M.trim, 'rim');
  cap.position.z = zf + 0.0125;
  g.add(cap);
  return g;
}

type V3 = [number, number, number];

/**
 * What stays when the wheel comes off (BRIEF-CAR item 2), in the corner's frame (the wheel's centre; +z outward, x along
 * the car): the brake disc and its hat, the caliper over its edge with the two pads either side of the disc, the hub with
 * its studs, the ABS sensor; above it the shock absorber inside its coil spring; the brake hose curling up into the arch,
 * the lower arm and the track rod going inboard, the drop link; at the front, the driveshaft's ribbed boot. Every corner
 * has its brakes (seen through the spokes); the parts are named on the nearside front, the one WHEEL OFF shows.
 */
export function buildCorner(L: CarLib, spec: CarSpec, M: Mats, front: boolean, named: boolean): TObject3D {
  const T = L.T;
  const d = spec.dims;
  const g = new T.Group();
  g.name = 'corner';
  const rd = d.rimR - 0.03;
  const zd = d.tyreW / 2 - 0.075;
  const part = (o: TObject3D, id: WheelId) => {
    // only the nearside front's parts are named (the others are its brakes and suspension, seen through the spokes)
    tag(o, named ? id : id === 'disc' || id === 'caliper' || id === 'pads' ? 'brakes' : 'suspension');
    g.add(o);
    return o;
  };
  const tubeG = (pts: V3[], r: number): TBufferGeometry => new T.TubeGeometry(new T.CatmullRomCurve3(pts.map((p) => new T.Vector3(p[0], p[1], p[2]))), 28, r, 8, false);

  // the disc: a steel disc with a darker hat in the middle
  const disc = new T.Group();
  const face = mesh(L, new T.CylinderGeometry(rd, rd, 0.026, 48), M.steel);
  face.rotation.x = Math.PI / 2;
  face.position.z = zd;
  const hat = mesh(L, new T.CylinderGeometry(0.085, 0.09, 0.04, 28), M.block);
  hat.rotation.x = Math.PI / 2;
  hat.position.z = zd + 0.022;
  disc.add(face, hat);
  part(disc, 'disc');
  // the caliper over the disc's back-top edge, and the pads either side of the disc inside it
  const ca = 2.35;
  // the caliper: a jaw either side of the disc and a bridge over its edge, open in the middle so the pads show
  const at = (r: number, z: number, o: TObject3D) => {
    o.position.set(Math.cos(ca) * r, Math.sin(ca) * r, z);
    o.rotation.z = ca - Math.PI / 2;
    return o;
  };
  const caliper = new T.Group();
  for (const s of [1, -1]) caliper.add(at(rd - 0.018, zd + s * 0.043, mesh(L, new T.BoxGeometry(0.05, 0.13, 0.022), M.caliper)));
  caliper.add(at(rd + 0.014, zd, mesh(L, new T.BoxGeometry(0.03, 0.12, 0.108), M.caliper)));
  part(caliper, 'caliper');
  const pads = new T.Group();
  for (const s of [1, -1]) pads.add(at(rd - 0.04, zd + s * 0.023, mesh(L, new T.BoxGeometry(0.06, 0.125, 0.016), M.rust)));
  part(pads, 'pads');
  // the hub with its five studs
  const hub = new T.Group();
  const hb = mesh(L, new T.CylinderGeometry(0.068, 0.075, 0.06, 24), M.steel);
  hb.rotation.x = Math.PI / 2;
  hb.position.z = zd + 0.05;
  hub.add(hb);
  hub.add(mesh(L, merge(L, Array.from({ length: 5 }, (_, k) => ({ g: new T.CylinderGeometry(0.0065, 0.0065, 0.05, 8), at: [Math.sin((k / 5) * Math.PI * 2) * 0.05, Math.cos((k / 5) * Math.PI * 2) * 0.05, zd + 0.09] as V3, rot: [Math.PI / 2, 0, 0] as V3 }))), M.chrome));
  part(hub, 'hub');
  part(mesh(L, new T.CylinderGeometry(0.012, 0.012, 0.05, 10), M.trim, '', [-0.06, -0.06, zd - 0.04]), 'abs_sensor');

  // the strut: the shock absorber inside its coil spring, from the hub up into the arch
  const sz = -0.11;
  const shock = new T.Group();
  shock.add(mesh(L, new T.CylinderGeometry(0.03, 0.03, 0.22, 16), M.block, '', [-0.02, 0.2, sz]), mesh(L, new T.CylinderGeometry(0.012, 0.012, 0.22, 10), M.chrome, '', [-0.02, 0.4, sz]));
  part(shock, 'shock');
  const helix: V3[] = [];
  for (let k = 0; k <= 64; k++) {
    const a = (k / 64) * Math.PI * 2 * 5;
    helix.push([-0.02 + Math.cos(a) * 0.065, 0.2 + (k / 64) * 0.27, sz + Math.sin(a) * 0.065]);
  }
  part(mesh(L, new T.TubeGeometry(new T.CatmullRomCurve3(helix.map((p) => new T.Vector3(p[0], p[1], p[2]))), 220, 0.009, 6, false), spec.silhouette === 'coupe' ? M.red : M.yellow), 'spring');
  // the brake hose, the arms, the link
  const cx = Math.cos(ca) * (rd - 0.018);
  const cy = Math.sin(ca) * (rd - 0.018);
  part(mesh(L, tubeG([[cx, cy + 0.04, zd - 0.05], [cx - 0.04, cy + 0.12, zd - 0.12], [-0.07, 0.36, -0.16]], 0.0075), M.hose), 'brake_hose');
  part(mesh(L, new T.BoxGeometry(0.07, 0.035, 0.34), M.block, '', [0.0, -0.13, -0.2]), 'lower_arm');
  const rod = mesh(L, new T.CylinderGeometry(0.011, 0.011, 0.36, 10), M.steel, '', [-0.12, -0.02, -0.21]);
  rod.rotation.x = Math.PI / 2;
  part(rod, 'track_rod');
  part(mesh(L, new T.CylinderGeometry(0.007, 0.007, 0.2, 8), M.steel, '', [0.06, 0.08, -0.17]), 'drop_link');
  if (front && !spec.electric) {
    const boot: [number, number][] = [];
    for (let k = 0; k <= 12; k++) boot.push([0.032 + (k % 2 ? 0.008 : 0) + (k / 12) * 0.018, -0.13 + (k / 12) * 0.11]);
    const cv = mesh(L, new T.LatheGeometry(boot.map(([x, y]) => new T.Vector2(x, y)), 18), M.rubber);
    cv.rotation.x = Math.PI / 2;
    cv.position.z = -0.05;
    part(cv, 'cv_boot');
  }
  return g;
}
