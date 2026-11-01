/**
 * THE WHEELS (BRIEF-CAR items 1–2): each corner's tyre — a lathed section with its sidewall bulge, the tread's grooves and
 * the 1.6 mm wear bars as a bump map — on a wheel styled for the car (five double spokes, six for an SUV, ten for a coupé,
 * a steel wheel with a trim for a van). One wheel group per corner, its outer face on local +z; the scene turns the
 * nearside ones round.
 */
import { merge, mesh, tag, type Mats } from './kit';
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
