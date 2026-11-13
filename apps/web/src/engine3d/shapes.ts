/**
 * WHAT AN OBJECT IS MADE OF (BRIEF-ENGINE-3D-1): an object's primitives in metres, in its own frame (the middle of its footprint
 * at the origin, standing on y = 0), their triangles, and the move from that frame into the scene's. The page draws these
 * triangles and the glTF exporter writes the same ones, so what he sees is what he gets. Pure.
 */
import { partBoxes, PARTS, type PartKind } from '../show/parts';
import { engineModel, poseOf, type EngineModel } from '../car/engine';
import type { Obj } from './scene';

export interface Prim {
  t: 'box' | 'cyl' | 'sph';
  /** The middle, metres. */
  c: [number, number, number];
  /** Width, height, depth, metres (a cylinder and a sphere: the diameters and the height). */
  s: [number, number, number];
  /** A turn about its own middle (x, y, z; three's XYZ order), radians: the working engine's cylinders lie along the crank. */
  r?: [number, number, number];
}

/** The tray's engine: a typical petrol four, standing still at the top of cylinder one's power stroke (the same model the bay turns). */
let trayModel: EngineModel | null = null;
const tray = () => (trayModel ??= engineModel({ make: '', model: '', silhouette: 'hatchback', size: 'M', fuel: 'petrol', year: 2012, engineCc: null }));

/** The engine's parts as named groups of primitives, fitted to an object's w × d × h in cm: scaled evenly to the limiting side, centred on the footprint, base on the ground. */
export function engineParts(o: Pick<Obj, 'w' | 'd' | 'h'>): { name: string; prims: Prim[] }[] {
  const m = tray();
  const box = m.box;
  const nat = [box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]];
  const k = Math.min(o.w / 100 / nat[0]!, o.h / 100 / nat[1]!, o.d / 100 / nat[2]!);
  const cx = (box.min[0] + box.max[0]) / 2;
  const cz = (box.min[2] + box.max[2]) / 2;
  const out: { name: string; prims: Prim[] }[] = [];
  for (const p of m.pieces) {
    if (p.passage) continue;
    const pose = poseOf(m, p, 0);
    const c = Math.cos(pose.rx);
    const sn = Math.sin(pose.rx);
    const prims: Prim[] = p.prims.map((q) => {
      const y = q.c[1] * c - q.c[2] * sn + pose.pos[1];
      const z = q.c[1] * sn + q.c[2] * c + pose.pos[2];
      const x = q.c[0] + pose.pos[0];
      const r: [number, number, number] = [(q.r?.[0] ?? 0) + pose.rx, q.r?.[1] ?? 0, q.r?.[2] ?? 0];
      return { t: q.t, c: [(x - cx) * k, (y - box.min[1]) * k, (z - cz) * k], s: [q.s[0] * k, q.s[1] * k, q.s[2] * k], ...(r[0] || r[1] || r[2] ? { r } : {}) };
    });
    out.push({ name: p.inst, prims });
  }
  return out;
}

const PART_KINDS = new Set<string>(PARTS.map((p) => p.kind));

/** The primitives of an object, from its size: a part is composed from its width, depth and height. */
export function primsOf(o: Pick<Obj, 'kind' | 'w' | 'd' | 'h'>): Prim[] {
  const w = o.w / 100;
  const d = o.d / 100;
  const h = o.h / 100;
  switch (o.kind) {
    case 'cylinder':
      return [{ t: 'cyl', c: [0, h / 2, 0], s: [w, h, d] }];
    case 'sphere':
      return [{ t: 'sph', c: [0, h / 2, 0], s: [w, h, d] }];
    case 'box':
    case 'plane':
    case 'model':
      return [{ t: 'box', c: [0, h / 2, 0], s: [w, h, d] }];
    case 'engine':
      return engineParts(o).flatMap((p) => p.prims);
    default:
      if (PART_KINDS.has(o.kind)) return partBoxes(o.kind as PartKind, { w: o.w, d: o.d, h: o.h }).map((b) => ({ t: 'box' as const, c: b.pos, s: b.size }));
      return [{ t: 'box', c: [0, h / 2, 0], s: [w, h, d] }];
  }
}

export interface TriMesh {
  positions: number[];
  normals: number[];
  indices: number[];
}

const FACES: { n: [number, number, number]; q: [number, number, number][] }[] = [
  { n: [1, 0, 0], q: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]] },
  { n: [-1, 0, 0], q: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
  { n: [0, 1, 0], q: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
  { n: [0, -1, 0], q: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] },
  { n: [0, 0, 1], q: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
  { n: [0, 0, -1], q: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
];

const SIDES = 24;
const RINGS = 10;

/** The triangles of some primitives, counter-clockwise outward, with flat or smooth normals as the shape wants. */
export function triangles(prims: Prim[]): TriMesh {
  const m: TriMesh = { positions: [], normals: [], indices: [] };
  const vert = (p: number[], n: number[]) => {
    m.positions.push(p[0]!, p[1]!, p[2]!);
    m.normals.push(n[0]!, n[1]!, n[2]!);
    return m.positions.length / 3 - 1;
  };
  for (const p of prims) {
    const [cx, cy, cz] = p.r ? [0, 0, 0] : p.c;
    const [sx, sy, sz] = p.s;
    const from = m.positions.length;
    if (p.t === 'box') {
      for (const f of FACES) {
        const b = f.q.map((q) => vert([cx + (q[0] * sx) / 2, cy + (q[1] * sy) / 2, cz + (q[2] * sz) / 2], f.n));
        m.indices.push(b[0]!, b[1]!, b[2]!, b[0]!, b[2]!, b[3]!);
      }
    } else if (p.t === 'cyl') {
      const rx = sx / 2;
      const rz = sz / 2;
      for (const [y, ny] of [[cy + sy / 2, 1], [cy - sy / 2, -1]] as [number, number][]) {
        const mid = vert([cx, y, cz], [0, ny, 0]);
        const ring: number[] = [];
        for (let i = 0; i < SIDES; i++) ring.push(vert([cx + rx * Math.cos((i / SIDES) * Math.PI * 2), y, cz + rz * Math.sin((i / SIDES) * Math.PI * 2)], [0, ny, 0]));
        for (let i = 0; i < SIDES; i++) {
          const a = ring[i]!;
          const b = ring[(i + 1) % SIDES]!;
          if (ny > 0) m.indices.push(mid, b, a);
          else m.indices.push(mid, a, b);
        }
      }
      const top: number[] = [];
      const bot: number[] = [];
      for (let i = 0; i <= SIDES; i++) {
        const a = (i / SIDES) * Math.PI * 2;
        const n = [Math.cos(a) / Math.max(rx, 1e-6), 0, Math.sin(a) / Math.max(rz, 1e-6)];
        const l = Math.hypot(n[0]!, n[2]!) || 1;
        const nn = [n[0]! / l, 0, n[2]! / l];
        top.push(vert([cx + rx * Math.cos(a), cy + sy / 2, cz + rz * Math.sin(a)], nn));
        bot.push(vert([cx + rx * Math.cos(a), cy - sy / 2, cz + rz * Math.sin(a)], nn));
      }
      for (let i = 0; i < SIDES; i++) m.indices.push(bot[i]!, top[i + 1]!, top[i]!, bot[i]!, bot[i + 1]!, top[i + 1]!);
    } else {
      const rx = sx / 2;
      const ry = sy / 2;
      const rz = sz / 2;
      const grid: number[][] = [];
      for (let j = 0; j <= RINGS; j++) {
        const v = (j / RINGS) * Math.PI;
        const row: number[] = [];
        for (let i = 0; i <= SIDES; i++) {
          const u = (i / SIDES) * Math.PI * 2;
          const nx = Math.sin(v) * Math.cos(u);
          const ny = Math.cos(v);
          const nz = Math.sin(v) * Math.sin(u);
          const nl = Math.hypot(nx / Math.max(rx, 1e-6), ny / Math.max(ry, 1e-6), nz / Math.max(rz, 1e-6)) || 1;
          row.push(vert([cx + rx * nx, cy + ry * ny, cz + rz * nz], [nx / Math.max(rx, 1e-6) / nl, ny / Math.max(ry, 1e-6) / nl, nz / Math.max(rz, 1e-6) / nl]));
        }
        grid.push(row);
      }
      for (let j = 0; j < RINGS; j++) {
        for (let i = 0; i < SIDES; i++) {
          const a = grid[j]![i]!;
          const b = grid[j]![i + 1]!;
          const c = grid[j + 1]![i]!;
          const d = grid[j + 1]![i + 1]!;
          if (j > 0) m.indices.push(a, b, c);
          if (j < RINGS - 1) m.indices.push(b, d, c);
        }
      }
    }
    // a turned primitive was built about its own middle: turn it (three's XYZ order: Rz first, then Ry, then Rx) and put it where it goes
    if (p.r) turnFrom(m, from, p.r, p.c);
  }
  return m;
}

function turnFrom(m: TriMesh, from: number, r: [number, number, number], at: [number, number, number]): void {
  const [rx, ry, rz] = r;
  const f = (v: number[], i: number) => {
    let x = v[i]!;
    let y = v[i + 1]!;
    let z = v[i + 2]!;
    [x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)];
    [x, z] = [x * Math.cos(ry) + z * Math.sin(ry), -x * Math.sin(ry) + z * Math.cos(ry)];
    [y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
    v[i] = x;
    v[i + 1] = y;
    v[i + 2] = z;
  };
  for (let i = from; i < m.positions.length; i += 3) {
    f(m.positions, i);
    f(m.normals, i);
    m.positions[i] = m.positions[i]! + at[0];
    m.positions[i + 1] = m.positions[i + 1]! + at[1];
    m.positions[i + 2] = m.positions[i + 2]! + at[2];
  }
}

/** The turn about the vertical an object's `rot` degrees mean, in radians (three's own sense about y). */
export const turnRad = (rotDeg: number) => (-rotDeg * Math.PI) / 180;

/** A point in the object's frame (metres) to the scene's (metres). */
export function place(p: [number, number, number], o: Pick<Obj, 'x' | 'y' | 'z' | 'rot'>): [number, number, number] {
  const t = turnRad(o.rot);
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [p[0] * c + p[2] * s + o.x / 100, p[1] + o.y / 100, -p[0] * s + p[2] * c + o.z / 100];
}

/** A point in the scene (metres) to the object's frame (metres). */
export function unplace(p: [number, number, number], o: Pick<Obj, 'x' | 'y' | 'z' | 'rot'>): [number, number, number] {
  const t = turnRad(o.rot);
  const c = Math.cos(t);
  const s = Math.sin(t);
  const x = p[0] - o.x / 100;
  const z = p[2] - o.z / 100;
  return [x * c - z * s, p[1] - o.y / 100, x * s + z * c];
}

export interface Ray {
  o: [number, number, number];
  d: [number, number, number];
}

/** How far along the ray an object's box is struck (the nearest), or null: the slab test in the object's own frame. */
export function rayHit(r: Ray, o: Obj): number | null {
  const lo = unplace(r.o, o);
  const t = turnRad(o.rot);
  const c = Math.cos(t);
  const s = Math.sin(t);
  const ld: [number, number, number] = [r.d[0] * c - r.d[2] * s, r.d[1], r.d[0] * s + r.d[2] * c];
  const half = [o.w / 200, o.h / 200, o.d / 200];
  const mid = [0, o.h / 200, 0];
  let t0 = 0;
  let t1 = Infinity;
  for (let i = 0; i < 3; i++) {
    const a = mid[i]! - half[i]!;
    const b = mid[i]! + half[i]!;
    if (Math.abs(ld[i]!) < 1e-9) {
      if (lo[i]! < a || lo[i]! > b) return null;
    } else {
      let n0 = (a - lo[i]!) / ld[i]!;
      let n1 = (b - lo[i]!) / ld[i]!;
      if (n0 > n1) [n0, n1] = [n1, n0];
      t0 = Math.max(t0, n0);
      t1 = Math.min(t1, n1);
      if (t0 > t1) return null;
    }
  }
  return t0;
}
