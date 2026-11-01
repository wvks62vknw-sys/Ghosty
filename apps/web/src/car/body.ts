/**
 * THE BODY (BRIEF-CAR item 1): the car's shell from its CarSpec, as one smooth lofted surface — cross-sections along the
 * car (the floor, the rounded sill, the side swelling to the shoulder line, the crease, the glass leaning in to the roof,
 * the roof's crown), the wheel arches cut into the sill line where the wheels are, the corners rounded in plan. The glass,
 * the pillars and the scuttle are regions of that one surface, so they sit exactly on it; the bonnet is its own panel on a
 * hinge (car/scene.ts opens it). Then what makes it read as that car at a glance: headlamps and daytime lights wrapped round
 * the front corners, tail lamps, the grille, both plates, the mirrors, handles, wipers, arch liners, the panel gaps drawn
 * into the paint. Every outside part a tap can name carries its id (car/parts.ts BODY_IDS).
 *
 * The car stands with its middle at the origin: x along it (the front +x), y up from the ground, z across (+z the
 * driver's side of a UK car, the offside; −z the nearside, the kerb side).
 */
import { gapsTex, mesh, merge, tag, type Mats } from './kit';
import type { BodyId } from './parts';
import { topAt, type CarSpec } from './spec';
import type { CarLib, TBufferGeometry, TMaterial, TMesh, TObject3D } from './three';

/** Ring points per side: j = 0 (the floor's middle) … 21 (the top's middle). */
const NJ = 21;
/** Points round a whole section: the right side up, the left side down, the floor's middle again (for the paint's seam). */
const RING = 2 * NJ + 1;

export interface Wheel {
  x: number;
  z: number;
  front: boolean;
  /** +1 offside (driver's), −1 nearside. */
  side: 1 | -1;
}

export interface Body {
  group: TObject3D;
  /** The bonnet's hinge: its rotation.z lifts the front of the bonnet. */
  bonnet: TObject3D;
  wheels: Wheel[];
  /** The engine bay's box, in the car's coordinates. */
  bay: { front: number; rear: number; halfW: number; floor: number; top: number; axle: number };
  /** The lamps' materials, which light at night. */
  lights: { head: TMaterial; tail: TMaterial; brake: TMaterial; plate: TMaterial };
  /** Each outside part's objects, by id. */
  parts: Map<BodyId, TObject3D[]>;
  /** The arch radius, the shell's floor height. */
  arch: number;
  floorY: number;
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const smooth = (a: number, b: number, t: number) => {
  const k = clamp((t - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
};

/** The shape maths, apart from three.js: a section at any u, a point on the skin at any (u, j, side). */
export function shell(spec: CarSpec) {
  const d = spec.dims;
  const p = spec.profile;
  const L = d.length;
  const W = d.width;
  const H = d.height;
  const xf = L / 2 - d.front;
  const xr = xf - d.wheelbase;
  const arch = d.tyreR + (spec.silhouette === 'suv' || spec.silhouette === 'pickup' ? 0.06 : 0.045);
  const tumble = spec.silhouette === 'van' ? 0.05 : spec.silhouette === 'coupe' ? 0.24 : spec.silhouette === 'suv' || spec.silhouette === 'mpv' ? 0.16 : 0.2;
  const xAt = (u: number) => L / 2 - u * L;
  const uAt = (x: number) => (L / 2 - x) / L;
  const bottom = (u: number) => {
    let y = d.clearance + 0.025 + 0.13 * smooth(0.09, 0, u) + 0.11 * smooth(0.9, 1, u);
    const x = xAt(u);
    for (const xw of [xf, xr]) {
      const dx = x - xw;
      if (Math.abs(dx) < arch) y = Math.max(y, d.tyreR + Math.sqrt(arch * arch - dx * dx) * 0.985);
    }
    return y;
  };
  const halfW = (u: number) => {
    let k = 1;
    if (u < 0.075) k = 0.8 + 0.2 * Math.sqrt(1 - ((0.075 - u) / 0.075) ** 2);
    else if (u > 0.94) k = 0.84 + 0.16 * Math.sqrt(Math.max(0, 1 - ((u - 0.94) / 0.06) ** 2));
    return (W / 2) * k;
  };
  const top = (u: number) => H * topAt(p, u);
  const belt = (u: number) => H * p.belt * (1 + 0.04 * u);
  const cache = new Map<number, { y: number[]; z: number[]; gh: number }>();
  /** The right half of the section at u: j = 0 … 21, z ≥ 0. */
  const section = (u: number) => {
    const key = Math.round(u * 1e6);
    const hit = cache.get(key);
    if (hit) return hit;
    const yb = bottom(u);
    const yt = top(u);
    const hw = halfW(u);
    const crownDrop = Math.min(0.07, (yt - yb) * 0.18);
    const ysh = Math.max(yb + 0.1, Math.min(belt(u), yt - 0.06));
    const gh = Math.max(0, yt - crownDrop - ysh - 0.02);
    const tg = tumble * Math.min(1, gh / 0.25);
    // the floor, a generous rounded sill, then the side swelling out to the shoulder (the widest point)
    const z: number[] = [0, hw * 0.55, hw * 0.86, hw * 0.935];
    const y: number[] = [yb, yb, yb + 0.006, yb + 0.04];
    for (let k = 0; k <= 5; k++) {
      const t = k / 5;
      y.push(yb + 0.085 + t * (ysh - yb - 0.085));
      z.push(hw * (0.955 + 0.045 * (1 - (1 - t) * (1 - t))));
    }
    // the shoulder's crease, a ledge, then the glass leaning in to the roof
    y.push(ysh + 0.01);
    z.push(hw * 0.975);
    const zr = hw * (0.93 - tg);
    const yre = ysh + 0.02 + gh;
    for (let k = 1; k <= 5; k++) {
      const t = k / 5;
      y.push(ysh + 0.014 + t * (yre - ysh - 0.014));
      z.push(hw * 0.945 + (zr - hw * 0.945) * t);
    }
    for (let k = 1; k <= 6; k++) {
      const th = (k / 6) * (Math.PI / 2);
      z.push(k === 6 ? 0 : zr * Math.pow(Math.cos(th), 2 / 2.4));
      y.push(yre + (yt - yre) * Math.pow(Math.sin(th), 2 / 2.4));
    }
    const out = { y, z, gh };
    cache.set(key, out);
    return out;
  };
  /** A point on the skin: j may be fractional (between ring points); side +1 right, −1 left. */
  const skin = (u: number, j: number, side: 1 | -1 = 1): [number, number, number] => {
    const s = section(clamp(u, 0, 1));
    const j0 = clamp(Math.floor(j), 0, NJ);
    const j1 = clamp(j0 + 1, 0, NJ);
    const k = clamp(j - j0, 0, 1);
    return [xAt(clamp(u, 0, 1)), s.y[j0]! + (s.y[j1]! - s.y[j0]!) * k, side * (s.z[j0]! + (s.z[j1]! - s.z[j0]!) * k)];
  };
  /** The fractional ring index j at height y on the side of the section at u (the first band that holds it). */
  const jAt = (u: number, yv: number): number => {
    const sec = section(clamp(u, 0, 1));
    for (let j = 0; j < NJ; j++) {
      const a = sec.y[j]!;
      const b = sec.y[j + 1]!;
      if (yv >= a && yv <= b) return j + (b > a ? (yv - a) / (b - a) : 0);
    }
    return yv < sec.y[0]! ? 0 : NJ;
  };
  /** The shoulder line's height at u. */
  const shoulder = (u: number) => section(clamp(u, 0, 1)).y[9]!;
  /** The outward normal there (numerically). */
  const normal = (u: number, j: number, side: 1 | -1 = 1): [number, number, number] => {
    const e = 0.002;
    const a = skin(u - e, j, side);
    const b = skin(u + e, j, side);
    const c = skin(u, Math.max(0, j - 0.05), side);
    const dd = skin(u, Math.min(NJ, j + 0.05), side);
    const tu = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const tj = [dd[0] - c[0], dd[1] - c[1], dd[2] - c[2]];
    // right side: ring direction × station direction points out; the left side's ring runs the other way
    let n = [tj[1]! * tu[2]! - tj[2]! * tu[1]!, tj[2]! * tu[0]! - tj[0]! * tu[2]!, tj[0]! * tu[1]! - tj[1]! * tu[0]!];
    if (side < 0) n = n.map((v) => -v);
    const l = Math.hypot(n[0]!, n[1]!, n[2]!) || 1;
    return [n[0]! / l, n[1]! / l, n[2]! / l];
  };
  return { L, W, H, xf, xr, arch, xAt, uAt, bottom, halfW, top, belt, section, skin, normal, jAt, shoulder };
}
export type Shell = ReturnType<typeof shell>;

type Region = 'paint' | 'glass' | 'trim' | 'plastic' | 'floor' | 'bonnet';

/** Which material a band of the skin is, between ring points b and b+1 at u. */
function region(spec: CarSpec, s: Shell, u: number, b: number): Region {
  const p = spec.profile;
  if (b <= 1) return 'floor';
  if (b <= 3 && (spec.silhouette === 'suv' || spec.silhouette === 'pickup')) return 'plastic';
  if (b >= 10 && b <= 14) {
    const t = (b - 10 + 0.5) / 5;
    const lean = spec.silhouette === 'saloon' || spec.silhouette === 'coupe' ? 0.06 : 0.02;
    const gh = s.section(u).gh;
    if (gh > 0.05 && u > p.a + 0.055 * t && u < p.c - lean * t) {
      if (p.b > 0 && Math.abs(u - p.b) < 0.011) return 'trim';
      return 'glass';
    }
    return 'paint';
  }
  if (b >= 15) {
    const edge = b === 15;
    if (u >= p.ws0 - 0.012 && u < p.ws0) return edge ? 'paint' : 'plastic';
    if (u >= 0.035 && u < p.ws0 - 0.012) return edge ? 'paint' : 'bonnet';
    if (u >= p.ws0 && u <= p.ws1 + 0.004) return edge ? 'paint' : 'glass';
    if (p.tail > p.r1 + 0.01 && u >= p.r1 && u <= p.tail) return edge ? 'paint' : 'glass';
  }
  return 'paint';
}

/** The stations along the car: evenly, plus a pair at each wheel arch's edge (so it is cut straight up) and at each region's edge. */
function stations(spec: CarSpec, s: Shell, n = 108): number[] {
  const us = new Set<number>();
  for (let i = 0; i <= n; i++) us.add(i / n);
  const p = spec.profile;
  for (const xw of [s.xf, s.xr]) for (const e of [xw - s.arch, xw + s.arch]) for (const k of [-1e-4, 1e-4]) us.add(clamp(s.uAt(e) + k, 0, 1));
  for (const u of [0.035, p.ws0 - 0.012, p.ws0, p.ws1 + 0.004, p.r1, p.tail, p.a, p.c, ...(p.b ? [p.b - 0.011, p.b + 0.011] : [])]) us.add(clamp(u, 0, 1));
  return [...us].sort((a, b) => a - b);
}

/** The door edges, the sill, the fuel flap: the panel gaps, drawn into the paint. v: right side 0–0.5, left 0.5–1. */
function gapLines(spec: CarSpec, s: Shell): { u0: number; u1: number; v0: number; v1: number }[] {
  const p = spec.profile;
  const vR = (j: number) => (0.5 * j) / NJ;
  const vL = (j: number) => 1 - (0.5 * j) / NJ;
  const out: { u0: number; u1: number; v0: number; v1: number }[] = [];
  const both = (u0: number, u1: number, j0: number, j1: number) => {
    out.push({ u0, u1, v0: vR(j0), v1: vR(j1) }, { u0, u1, v0: vL(j0), v1: vL(j1) });
  };
  const fa = s.uAt(s.xf - s.arch) + 0.012;
  const ra = s.uAt(s.xr + s.arch) - 0.006;
  // the front bumper meets the wing; the rear bumper the rear wing
  both(s.uAt(s.xf + s.arch) - 0.004, s.uAt(s.xf + s.arch) - 0.004, 2.5, 8.5);
  both(s.uAt(s.xr - s.arch) + 0.004, s.uAt(s.xr - s.arch) + 0.004, 2.5, 8.5);
  if (spec.silhouette === 'van') {
    both(fa, fa, 3.2, 10);
    both(p.c + 0.01, p.c + 0.01, 3.2, 10);
    out.push({ u0: p.c + 0.33, u1: p.c + 0.33, v0: vL(3.2), v1: vL(13) });
  } else if (p.b > 0) {
    both(fa, fa, 3.2, 10);
    both(p.b - 0.012, p.b - 0.012, 3.2, 10);
    both(p.b + 0.012, p.b + 0.012, 3.2, 10);
    both(ra, ra, 3.2, 10);
  } else {
    both(fa, fa, 3.2, 10);
    both(p.c - 0.02, p.c - 0.02, 3.2, 10);
  }
  // the sill line under the doors
  both(fa, ra, 3.6, 3.6);
  // the fuel flap, on the nearside rear wing
  const f = flap(s);
  out.push({ u0: f.u0, u1: f.u1, v0: vL(f.j0), v1: vL(f.j0) }, { u0: f.u0, u1: f.u1, v0: vL(f.j1), v1: vL(f.j1) });
  out.push({ u0: f.u0, u1: f.u0, v0: vL(f.j0), v1: vL(f.j1) }, { u0: f.u1, u1: f.u1, v0: vL(f.j0), v1: vL(f.j1) });
  // a tailgate's or boot lid's edge across the back
  if (spec.silhouette !== 'pickup') both(0.968, 0.968, 6.5, 9.6);
  return out;
}

/** Where the fuel flap is: above the rear wheel, behind the door, a hand's width under the shoulder. */
function flap(s: Shell): { u0: number; u1: number; j0: number; j1: number } {
  const u = s.uAt(s.xr) - 0.045;
  const y = s.shoulder(u);
  return { u0: u - 0.013, u1: u + 0.013, j0: s.jAt(u, y - 0.15), j1: s.jAt(u, y - 0.05) };
}

/** A piece of skin, lifted `off` metres along the normal: lamps, the fuel flap, a door's glass sit exactly on the body. */
type J = number | ((u: number) => number);
function patch(L: CarLib, s: Shell, u0: number, u1: number, j0: J, j1: J, side: 1 | -1, off: number, nu = 10, nj = 4): TBufferGeometry {
  const ja = typeof j0 === 'number' ? () => j0 : j0;
  const jb = typeof j1 === 'number' ? () => j1 : j1;
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  for (let a = 0; a <= nu; a++) {
    for (let b = 0; b <= nj; b++) {
      const u = u0 + ((u1 - u0) * a) / nu;
      const j = ja(u) + ((jb(u) - ja(u)) * b) / nj;
      const q = s.skin(u, j, side);
      const n = s.normal(u, j, side);
      pos.push(q[0] + n[0] * off, q[1] + n[1] * off, q[2] + n[2] * off);
      nor.push(n[0], n[1], n[2]);
      uv.push(a / nu, b / nj);
    }
  }
  const idx: number[] = [];
  const v = (a: number, b: number) => a * (nj + 1) + b;
  for (let a = 0; a < nu; a++) {
    for (let b = 0; b < nj; b++) {
      if (side > 0) idx.push(v(a, b), v(a, b + 1), v(a + 1, b), v(a, b + 1), v(a + 1, b + 1), v(a + 1, b));
      else idx.push(v(a, b), v(a + 1, b), v(a, b + 1), v(a, b + 1), v(a + 1, b), v(a + 1, b + 1));
    }
  }
  const g = new L.T.BufferGeometry();
  g.setAttribute('position', new L.T.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new L.T.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new L.T.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** A thin tube through points (a roof rail). */
function tube(L: CarLib, pts: [number, number, number][], r: number): TBufferGeometry {
  const T = L.T;
  return new T.TubeGeometry(new T.CatmullRomCurve3(pts.map((q) => new T.Vector3(q[0], q[1], q[2]))), Math.max(8, pts.length * 4), r, 6, false);
}

export function buildBody(L: CarLib, spec: CarSpec, M: Mats): Body {
  const T = L.T;
  const s = shell(spec);
  const p = spec.profile;
  const d = spec.dims;
  const group = new T.Group();
  group.name = 'body';
  const parts = new Map<BodyId, TObject3D[]>();
  const add = (id: BodyId, o: TObject3D) => {
    tag(o, id);
    parts.set(id, [...(parts.get(id) ?? []), o]);
    group.add(o);
    return o;
  };

  // ---- the loft
  const us = stations(spec, s);
  const pos: number[] = [];
  const uv: number[] = [];
  for (const u of us) {
    const sec = s.section(u);
    const x = s.xAt(u);
    for (let r = 0; r < RING; r++) {
      const right = r <= NJ;
      const j = right ? r : r === RING - 1 ? 0 : 2 * NJ - r;
      const z = sec.z[j]! * (right ? 1 : -1);
      pos.push(x, sec.y[j]!, z);
      uv.push(u, r === RING - 1 ? 1 : right ? (0.5 * j) / NJ : 1 - (0.5 * j) / NJ);
    }
  }
  const buckets: Record<Region, number[]> = { paint: [], glass: [], trim: [], plastic: [], floor: [], bonnet: [] };
  const all: number[] = [];
  for (let i = 0; i < us.length - 1; i++) {
    const um = (us[i]! + us[i + 1]!) / 2;
    for (let r = 0; r < RING - 1; r++) {
      const b = r < NJ ? r : 2 * NJ - 1 - r;
      const a = i * RING + r;
      const tri = [a, a + 1, a + RING, a + 1, a + RING + 1, a + RING];
      all.push(...tri);
      buckets[region(spec, s, um, b)].push(...tri);
    }
  }
  const skinG = new T.BufferGeometry();
  skinG.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  skinG.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  skinG.setIndex(all);
  skinG.computeVertexNormals();
  const geo = (idx: number[]) => {
    const g = new T.BufferGeometry();
    g.setAttribute('position', skinG.getAttribute('position')!);
    g.setAttribute('normal', skinG.getAttribute('normal')!);
    g.setAttribute('uv', skinG.getAttribute('uv')!);
    g.setIndex(idx);
    return g;
  };
  // the paint carries the panel gaps
  const gaps = gapsTex(L, gapLines(spec, s));
  const paint = M.paint as TMaterial & { map: unknown };
  paint.map = gaps;
  paint.needsUpdate = true;
  const shellMeshes: [Region, TMaterial][] = [['paint', M.paint], ['glass', M.glass], ['trim', M.trim], ['plastic', M.plastic], ['floor', M.floor]];
  for (const [r, m] of shellMeshes) {
    if (!buckets[r].length) continue;
    const x = mesh(L, geo(buckets[r]), m, r === 'glass' ? 'glass' : 'bodywork');
    x.name = r;
    group.add(x);
  }

  // ---- the ends: the front and back faces
  const cap = (i: number, front: boolean) => {
    const base = i * RING;
    let cy = 0;
    let cx = 0;
    for (let r = 0; r < RING - 1; r++) {
      cx += pos[(base + r) * 3]!;
      cy += pos[(base + r) * 3 + 1]!;
    }
    cx /= RING - 1;
    cy /= RING - 1;
    const cp: number[] = [cx, cy, 0];
    const idx: number[] = [];
    for (let r = 0; r < RING - 1; r++) {
      cp.push(pos[(base + r) * 3]!, pos[(base + r) * 3 + 1]!, pos[(base + r) * 3 + 2]!);
      const a = 1 + r;
      const b = 1 + ((r + 1) % (RING - 1));
      idx.push(...(front ? [0, b, a] : [0, a, b]));
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(cp, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(new Array((cp.length / 3) * 2).fill(0.5), 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return mesh(L, g, M.paint, 'bodywork');
  };
  group.add(cap(0, true), cap(us.length - 1, false));

  // ---- the bonnet, on its hinge at the scuttle
  const bu0 = 0.035;
  const bu1 = p.ws0 - 0.012;
  const hingeX = s.xAt(bu1);
  const hingeY = s.top(bu1) - 0.004;
  const bonnet = new T.Group();
  bonnet.position.set(hingeX, hingeY, 0);
  bonnet.name = 'bonnet';
  {
    const nb = 24;
    const bp: number[] = [];
    const bn: number[] = [];
    const buv: number[] = [];
    const cols = 2 * (NJ - 16) + 1; // j 16 … 21 … 16
    for (let a = 0; a <= nb; a++) {
      const u = bu0 + ((bu1 - bu0) * a) / nb;
      for (let c = 0; c < cols; c++) {
        const side: 1 | -1 = c <= NJ - 16 ? 1 : -1;
        const j = side > 0 ? 16 + c : NJ - (c - (NJ - 16));
        const q = s.skin(u, j, side);
        const n = s.normal(u, Math.min(j, NJ - 0.01), side);
        bp.push(q[0] - hingeX, q[1] - hingeY, q[2]);
        bn.push(n[0], n[1], n[2]);
        buv.push(u, side > 0 ? (0.5 * j) / NJ : 1 - (0.5 * j) / NJ);
      }
    }
    const bi: number[] = [];
    for (let a = 0; a < nb; a++) for (let c = 0; c < cols - 1; c++) {
      const v = a * cols + c;
      bi.push(v, v + 1, v + cols, v + 1, v + cols + 1, v + cols);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(bp, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(bn, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(buv, 2));
    g.setIndex(bi);
    // its underside: the sound-deadening pad, seen when it is up
    const padMat = M.plastic.clone();
    padMat.side = T.BackSide;
    const pad = mesh(L, g, padMat, 'bonnet');
    pad.position.y = -0.006;
    bonnet.add(mesh(L, g, M.bonnet, 'bonnet'), pad);
  }
  group.add(bonnet);

  // ---- the lamps
  const lamp = (id: BodyId, g: TBufferGeometry, m: TMaterial) => add(id, mesh(L, g, m));
  // the headlamps sweep back along the shoulder from the front corners, deeper at the front
  const hl0 = 0.006;
  const hl1 = 0.092;
  const hLo = (u: number) => s.shoulder(u) - 0.135 * (1 - (0.5 * (u - hl0)) / (hl1 - hl0));
  const hHi = (u: number) => s.shoulder(u) + 0.008;
  const brake = M.tail.clone();
  const plateLamp = new T.MeshStandardMaterial({ color: 0xf4f4f4, emissive: 0xfff4dc, emissiveIntensity: 0, roughness: 0.3 });
  for (const side of [1, -1] as const) {
    lamp('headlamp', patch(L, s, hl0, hl1, (u) => s.jAt(u, hLo(u)), (u) => s.jAt(u, hHi(u)), side, 0.003, 14, 5), M.head);
    group.add(mesh(L, patch(L, s, hl0 + 0.006, hl1 - 0.004, (u) => s.jAt(u, hLo(u) + 0.008), (u) => s.jAt(u, hLo(u) + 0.02), side, 0.0055, 14, 1), M.drl, 'headlamp'));
    lamp('indicator', patch(L, s, 0.01, 0.042, (u) => s.jAt(u, hLo(u) - 0.04), (u) => s.jAt(u, hLo(u) - 0.014), side, 0.003, 6, 1), M.amber);
    lamp('tail_lamp', patch(L, s, 0.925, 0.994, (u) => s.jAt(u, s.shoulder(u) - 0.14), (u) => s.jAt(u, s.shoulder(u) + 0.012), side, 0.003, 10, 5), M.tail);
  }
  // the high brake light, at the top of the rear glass (or the back of the roof)
  const bl = p.tail > p.r1 + 0.01 ? p.r1 + 0.006 : Math.min(0.99, p.r1 + 0.008);
  for (const side of [1, -1] as const) lamp('brake_lamp', patch(L, s, bl, bl + 0.01, 19.4, 21, side, 0.006, 2, 3), brake);

  // ---- the front: grille, lower intake, badge, plate; the back: plate, its lamp, diffuser, tailpipe
  const fx = s.L / 2;
  const f0 = s.section(0);
  const fBot = f0.y[0]!;
  const fTop = f0.y[NJ]!;
  const fW = f0.z[9]! * 2;
  const plane = (w: number, hgt: number) => new T.PlaneGeometry(w, hgt);
  const front = (o: TMesh, y: number, z = 0) => {
    o.position.set(fx + 0.004, y, z);
    o.rotation.y = Math.PI / 2;
    return o;
  };
  const grilleH = Math.max(0.09, (fTop - fBot) * 0.4);
  group.add(front(mesh(L, plane(fW * 0.56, grilleH), M.grille, 'grille'), fTop - grilleH / 2 - 0.03));
  group.add(front(mesh(L, plane(fW * 0.74, Math.max(0.06, (fTop - fBot) * 0.24)), M.grille, 'grille'), fBot + (fTop - fBot) * 0.19));
  // fog lamps either side of the lower intake
  for (const z of [fW * 0.43, -fW * 0.43]) group.add(front(mesh(L, new T.CircleGeometry(0.035, 20), M.head, 'headlamp'), fBot + (fTop - fBot) * 0.2, z));
  const badge = mesh(L, new T.CircleGeometry(0.035, 24), M.chrome, 'badge');
  badge.scale.set(1.45, 1, 1);
  group.add(front(badge, fTop - grilleH / 2 - 0.035));
  badge.position.x += 0.003;
  const pf = mesh(L, plane(0.52, 0.113), M.plateFront, 'plate');
  group.add(front(pf, fBot + (fTop - fBot) * 0.47));
  pf.position.x += 0.006;
  const r0 = s.section(1);
  const rx = -s.L / 2;
  const rBot = r0.y[0]!;
  const rTop = r0.y[NJ]!;
  const back = (o: TMesh, y: number, z = 0) => {
    o.position.set(rx - 0.006, y, z);
    o.rotation.y = -Math.PI / 2;
    return o;
  };
  const plateY = rBot + (rTop - rBot) * 0.52;
  group.add(back(mesh(L, plane(0.52, 0.113), M.plateRear, 'plate'), plateY));
  add('plate_lamp', back(mesh(L, new T.BoxGeometry(0.16, 0.014, 0.02), plateLamp), plateY + 0.075));
  group.add(back(mesh(L, plane(r0.z[6]! * 1.5, Math.max(0.05, (rTop - rBot) * 0.14)), M.plastic, 'bodywork'), rBot + 0.035));
  // where the bumper meets the tailgate or boot lid
  group.add(back(mesh(L, plane(r0.z[8]! * 1.92, 0.005), M.trim, 'bodywork'), rBot + (rTop - rBot) * 0.36));
  if (!spec.electric) {
    const pipe = mesh(L, new T.CylinderGeometry(0.035, 0.035, 0.12, 18, 1, true), M.chrome, 'exhaust');
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(rx + 0.03, d.clearance + 0.11, -s.W / 2 + 0.34);
    group.add(pipe);
  }

  // ---- the mirrors, the handles, the wipers
  for (const side of [1, -1] as const) {
    const u = p.a + 0.03;
    const q = s.skin(u, 10, side);
    const m = new T.Group();
    const cap = mesh(L, new T.SphereGeometry(1, 18, 12), M.paint);
    cap.scale.set(0.085, 0.06, 0.12);
    const glass = mesh(L, new T.CircleGeometry(1, 18), M.chrome);
    glass.scale.set(0.105, 0.05, 1);
    glass.rotation.y = -Math.PI / 2;
    glass.position.set(-0.03, 0, 0);
    const arm = mesh(L, new T.BoxGeometry(0.07, 0.03, 0.09), M.trim);
    arm.position.set(0.0, -0.01, -side * 0.07);
    const flash = mesh(L, new T.BoxGeometry(0.05, 0.012, 0.07), M.amber, 'indicator');
    flash.position.set(0.035, -0.035, side * 0.01);
    m.add(cap, glass, arm, flash);
    m.position.set(q[0] - 0.02, q[1] + 0.07, q[2] + side * 0.12);
    add('mirror', m);
    parts.set('indicator', [...(parts.get('indicator') ?? []), flash]);
    flash.userData.part = 'indicator';
  }
  {
    const handles: { g: TBufferGeometry; at: [number, number, number] }[] = [];
    const doorEnds = p.b > 0 ? [p.b - 0.05, Math.min(p.c, s.uAt(s.xr + s.arch)) - 0.05] : [p.c - 0.07];
    for (const side of [1, -1] as const) for (const u of doorEnds) {
      const q = s.skin(u, 8.2, side);
      handles.push({ g: new T.BoxGeometry(0.12, 0.022, 0.018), at: [q[0], q[1], q[2] + side * 0.006] });
    }
    group.add(mesh(L, merge(L, handles), spec.paint.metallic ? M.chrome : M.trim, 'handle'));
  }
  {
    const q = s.skin(p.ws0 + 0.01, 19, 1);
    const rake = Math.atan2(s.top(p.ws1) - s.top(p.ws0), (p.ws1 - p.ws0) * s.L);
    for (const z of [0.25, -0.38]) {
      const w = mesh(L, new T.BoxGeometry(0.58, 0.014, 0.022), M.trim);
      w.position.set(q[0] - 0.02, q[1] + 0.02, z);
      w.rotation.set(0, 0.12, rake * 0.6);
      add('wiper', w);
    }
  }

  // ---- the arch liners, the floor under the car, sills and roof rails
  const wheels: Wheel[] = [];
  const liners: { g: TBufferGeometry; at: [number, number, number]; rot: [number, number, number] }[] = [];
  for (const [x, front] of [[s.xf, true], [s.xr, false]] as const) {
    for (const side of [1, -1] as const) {
      const z = side * (s.W / 2 - d.tyreW / 2 - 0.03);
      wheels.push({ x, z, front, side });
      liners.push({ g: new T.CylinderGeometry(s.arch - 0.012, s.arch - 0.012, 0.36, 22, 1, true, Math.PI / 2, Math.PI), at: [x, d.tyreR, side * (s.W / 2 - 0.2)], rot: [Math.PI / 2, 0, 0] });
    }
  }
  const linerMat = M.plastic.clone();
  linerMat.side = T.DoubleSide;
  group.add(mesh(L, merge(L, liners), linerMat, 'bodywork'));
  const floor = mesh(L, new T.BoxGeometry(s.L - 0.55, 0.02, s.W - 0.2), M.floor, 'bodywork');
  floor.position.set(0, d.clearance + 0.012, 0);
  group.add(floor);
  if (spec.roofRails) {
    for (const side of [1, -1] as const) {
      const pts: [number, number, number][] = [];
      for (let k = 0; k <= 8; k++) {
        const u = p.ws1 + 0.04 + ((p.r1 - p.ws1 - 0.08) * k) / 8;
        const q = s.skin(u, 15.6, side);
        pts.push([q[0], q[1] + 0.035, q[2]]);
      }
      group.add(mesh(L, tube(L, pts, 0.013), M.trim, 'roof rail'));
    }
  }

  // ---- the parts a fault can light on the outside
  const fl = flap(s);
  add('fuel_cap', mesh(L, patch(L, s, fl.u0, fl.u1, fl.j0, fl.j1, -1, 0.0015, 3, 2), M.paint));
  add('door_window', mesh(L, patch(L, s, p.a + 0.075, (p.b || p.c) - 0.016, 10.25, 14.7, -1, 0.0025, 8, 4), M.glass));
  add('door_seal', mesh(L, patch(L, s, (p.b || p.c) - 0.0145, (p.b || p.c) - 0.0105, 3.4, 10, -1, 0.002, 1, 6), M.rubber));

  const bay = {
    front: s.L / 2 - 0.17,
    rear: s.xAt(p.ws0) + 0.03,
    halfW: s.halfW(0.2) - 0.11,
    floor: d.clearance + 0.08,
    top: Math.min(s.top(0.06), s.top(bu1)) - 0.03,
    axle: s.xf,
  };
  return {
    group,
    bonnet,
    wheels,
    bay,
    lights: { head: M.head, tail: M.tail, brake, plate: plateLamp },
    parts,
    arch: s.arch,
    floorY: d.clearance,
  };
}
