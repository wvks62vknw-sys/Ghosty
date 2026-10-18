/**
 * A room's size from photos of the room itself (pure, unit-tested in apps/edge/test/measure.test.mjs).
 * Each photo's depth map (measure/depth3d.ts) becomes points in 3-D; the floor is found (the
 * biggest flat surface facing up in the lower part of the picture), the walls are the upright
 * surfaces, and seen from above they line up square (rooms are built with square corners: the
 * walls' directions, the picture's vanishing points, give the turn). Then:
 * - ACROSS: the two side walls both in view give the room's width directly;
 * - ALONG: the far wall's distance, plus where the owner stood: the instructions say "back to the
 *   wall", so the phone is about 25 cm in front of the wall behind (give or take 15 cm).
 * Two photos, the second turned a quarter, each give both sizes once more; they are joined
 * whichever way round agrees best (a second photo taken the same way just adds to the first).
 *
 * The phone's height above the found floor is a weak scale cue of its own (held at chest height,
 * about 1.3 m) for rooms with nothing of known size in them.
 */
import { unproject, type DepthMap, type P3 } from '../measure/depth3d';
import type { Intrinsics } from '../measure/exif';

/** Where the phone is held, the instructions' way: back to a wall (m in front of it), at chest height (m). */
export const STANCE = { back: 0.25, backSd: 0.15, height: 1.3, heightSigma: 0.12 } as const;

const dot = (a: P3, b: P3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: P3, b: P3): P3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: P3, b: P3): P3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: P3): P3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** A seeded random number generator (the floor search must give the same answer every time). */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

export interface Cloud {
  p: P3[];
  n: P3[];
  /** Picture row of each point, 0 (top) – 1 (bottom). */
  row: number[];
}

/** Points and their surface normals from a depth map, every `step` pixels (`K` in the depth map's own pixels). */
export function cloudOf(D: DepthMap, K: Pick<Intrinsics, 'f' | 'cx' | 'cy'>, step = 4): Cloud {
  const P = (u: number, v: number) => unproject(K, { x: u + 0.5, y: v + 0.5 }, D.z[v * D.w + u]!);
  const out: Cloud = { p: [], n: [], row: [] };
  for (let v = step; v < D.h - step; v += step) {
    for (let u = step; u < D.w - step; u += step) {
      const c = P(u, v);
      const dx = sub(P(u + step, v), P(u - step, v));
      const dy = sub(P(u, v + step), P(u, v - step));
      // a jump in depth (an edge) gives no trustworthy normal
      const z = c[2];
      if (Math.abs(dx[2]) > 0.25 * z || Math.abs(dy[2]) > 0.25 * z) continue;
      let n = norm(cross(dx, dy));
      if (dot(n, c) > 0) n = [-n[0], -n[1], -n[2]];
      out.p.push(c);
      out.n.push(n);
      out.row.push(v / D.h);
    }
  }
  return out;
}

export interface Floor {
  /** Unit normal, pointing up (toward the camera's side). */
  up: P3;
  /** The phone's height above it, metres. */
  height: number;
  /** Share of the candidate points that lie on it. */
  support: number;
}

/**
 * The floor: a plane through points in the lower 60 % of the picture whose surfaces face up
 * (normal within 40° of the picture's up), found by trying planes through three of them (RANSAC)
 * and keeping the one most points lie on (within 3 cm + 2 % of their distance). Null when there
 * is no such surface.
 */
export function findFloor(c: Cloud, tries = 300): Floor | null {
  const cand: number[] = [];
  for (let i = 0; i < c.p.length; i++) if (c.row[i]! > 0.4 && -c.n[i]![1] > Math.cos((40 * Math.PI) / 180)) cand.push(i);
  if (cand.length < 30) return null;
  const rand = rng(7);
  // every plane tried is kept: a sofa's seat or a table top is flat and faces up too
  const planes: { n: P3; d: number; inl: number }[] = [];
  for (let t = 0; t < tries; t++) {
    const a = c.p[cand[Math.floor(rand() * cand.length)]!]!;
    const b = c.p[cand[Math.floor(rand() * cand.length)]!]!;
    const d0 = c.p[cand[Math.floor(rand() * cand.length)]!]!;
    let n = cross(sub(b, a), sub(d0, a));
    if (Math.hypot(...n) < 1e-6) continue;
    n = norm(n);
    if (n[1] > 0) n = [-n[0], -n[1], -n[2]];
    if (-n[1] < Math.cos((40 * Math.PI) / 180)) continue;
    const d = -dot(n, a);
    let inl = 0;
    for (const i of cand) {
      const p = c.p[i]!;
      if (Math.abs(dot(n, p) + d) < 0.03 + 0.02 * p[2]) inl++;
    }
    planes.push({ n, d, inl });
  }
  const top = planes.reduce<{ n: P3; d: number; inl: number } | null>((m, q) => (!m || q.inl > m.inl ? q : m), null);
  if (!top) return null;
  // floor, seats and table tops are level, so parallel to the best-supported plane (within 6°); the floor
  // is the one with (almost) nothing under it — under a sofa's seat there is floor — and, of those, the best supported
  const level = Math.cos((6 * Math.PI) / 180);
  const below = (q: { n: P3; d: number }) => {
    let n = 0;
    for (const p of c.p) if (dot(q.n, p) + q.d < -(0.06 + 0.02 * p[2])) n++;
    return n / c.p.length;
  };
  const best = planes
    .filter((q) => q.inl >= Math.max(20, 0.1 * top.inl) && dot(q.n, top.n) >= level)
    .sort((q1, q2) => q2.inl - q1.inl)
    .slice(0, 40)
    .find((q) => below(q) < 0.05) ?? null;
  if (!best) return null;
  // refine twice: a least-squares plane (camera y = a·x + b·z + c) through the points near it, the band narrowing
  let n = best.n;
  let d = best.d;
  let ins: P3[] = [];
  for (const tol of [[0.03, 0.02], [0.015, 0.01]] as const) {
    ins = cand.map((i) => c.p[i]!).filter((p) => Math.abs(dot(n, p) + d) < tol[0] + tol[1] * p[2]);
    if (ins.length < 10) break;
    // normal equations for [a, b, c]
    let sxx = 0, sxz = 0, sx = 0, szz = 0, sz = 0, sxy = 0, szy = 0, sy = 0;
    for (const p of ins) {
      sxx += p[0] * p[0];
      sxz += p[0] * p[2];
      sx += p[0];
      szz += p[2] * p[2];
      sz += p[2];
      sxy += p[0] * p[1];
      szy += p[2] * p[1];
      sy += p[1];
    }
    const N = ins.length;
    const A = [[sxx, sxz, sx], [sxz, szz, sz], [sx, sz, N]];
    const r = [sxy, szy, sy];
    const det = (m: number[][]) => m[0]![0]! * (m[1]![1]! * m[2]![2]! - m[1]![2]! * m[2]![1]!) - m[0]![1]! * (m[1]![0]! * m[2]![2]! - m[1]![2]! * m[2]![0]!) + m[0]![2]! * (m[1]![0]! * m[2]![1]! - m[1]![1]! * m[2]![0]!);
    const D0 = det(A);
    if (Math.abs(D0) < 1e-9) break;
    const col = (k: number) => A.map((row, i) => row.map((v, j) => (j === k ? r[i]! : v)));
    const [pa, pb, pc] = [det(col(0)) / D0, det(col(1)) / D0, det(col(2)) / D0];
    // y − a·x − b·z − c = 0 → normal (−a, 1, −b), turned to point up (camera y is down)
    const len = Math.hypot(pa, 1, pb);
    n = [pa / len, -1 / len, pb / len];
    d = pc / len;
  }
  // up points toward the camera's side; the camera is d above the plane
  return { up: n, height: Math.abs(d), support: ins.length / cand.length };
}

export interface Seen {
  /** The width between the two side walls, metres (null when one side wall is not in view). */
  across: number | null;
  acrossSd: number;
  /** At least this wide: how much of the far wall is in view (metres; 0 when none). */
  acrossMin: number;
  /** The far wall's distance plus where the phone was (`STANCE.back`), metres. */
  along: number | null;
  alongSd: number;
  /** The phone's height above the floor (metres, by this depth map). */
  height: number;
  notes: string[];
}

/** A peak in weighted 1-D values (bins of `bin` m), the farthest one in `dir` that is at least `share` of the biggest. */
function farPeak(vals: number[], dir: 1 | -1, bin = 0.04, share = 0.2): { at: number; weight: number } | null {
  if (vals.length < 15) return null;
  const hist = new Map<number, number>();
  for (const v of vals) {
    const k = Math.round(v / bin);
    hist.set(k, (hist.get(k) ?? 0) + 1);
  }
  const smooth = (k: number) => (hist.get(k - 1) ?? 0) * 0.5 + (hist.get(k) ?? 0) + (hist.get(k + 1) ?? 0) * 0.5;
  const keys = [...hist.keys()];
  const max = Math.max(...keys.map(smooth));
  if (max < 8) return null;
  const peaks = keys.filter((k) => smooth(k) >= share * max && smooth(k) >= smooth(k - 1) && smooth(k) >= smooth(k + 1));
  if (!peaks.length) return null;
  const k = dir > 0 ? Math.max(...peaks) : Math.min(...peaks);
  // the peak's centre: the weighted mean of the values near it
  const near = vals.filter((v) => Math.abs(v / bin - k) <= 1.5);
  return { at: near.reduce((a, b) => a + b, 0) / near.length, weight: smooth(k) / max };
}

/**
 * What one photo shows of the room: the floor, the walls seen from above squared up, then the
 * width between the side walls and the distance to the far wall.
 */
export function roomFromCloud(c: Cloud): Seen | { error: string } {
  const floor = findFloor(c);
  if (!floor) return { error: 'No floor in view: take the photo with a strip of floor showing at the bottom' };
  const up = floor.up;
  // a level frame on the floor: x across (the camera's right, made level), y away from the camera
  const ex = norm(sub([1, 0, 0], [up[0] * up[0], up[0] * up[1], up[0] * up[2]]));
  const ey = norm(cross(up, ex));
  const fwd = dot([0, 0, 1], ey) < 0 ? -1 : 1;
  const walls: { x: number; y: number; nx: number; ny: number }[] = [];
  for (let i = 0; i < c.p.length; i++) {
    const p = c.p[i]!;
    const n = c.n[i]!;
    const hgt = dot(up, p) + floor.height;
    // above the furniture (most stands under 1 m) and below the ceiling: walls, doors, windows
    if (Math.abs(dot(up, n)) > 0.3 || hgt < 1.0 || hgt > 2.2) continue;
    const nx = dot(n, ex);
    const ny = dot(n, ey) * fwd;
    const l = Math.hypot(nx, ny) || 1;
    walls.push({ x: dot(p, ex), y: dot(p, ey) * fwd, nx: nx / l, ny: ny / l });
  }
  if (walls.length < 30) return { error: 'No walls in view: stand back so the far wall and the side walls show' };
  // the square turn: the walls' facing directions, folded into a quarter turn
  const hist = new Array<number>(90).fill(0);
  for (const w of walls) {
    let a = (Math.atan2(w.ny, w.nx) * 180) / Math.PI;
    a = ((a % 90) + 90) % 90;
    hist[Math.floor(a) % 90]!++;
  }
  let best = 0;
  let turn = 0;
  for (let a = 0; a < 90; a++) {
    let s = 0;
    for (let k = -3; k <= 3; k++) s += hist[(a + k + 90) % 90]! * (1 - Math.abs(k) / 4);
    if (s > best) {
      best = s;
      turn = a + 0.5;
    }
  }
  // the turn closest to "facing straight ahead": within ±45°
  if (turn > 45) turn -= 90;
  const t = (-turn * Math.PI) / 180;
  const ct = Math.cos(t);
  const st = Math.sin(t);
  const rot = walls.map((w) => ({ x: w.x * ct - w.y * st, y: w.x * st + w.y * ct, nx: w.nx * ct - w.ny * st, ny: w.nx * st + w.ny * ct }));
  // side walls face across (left wall's surface faces right, +x), the far wall faces back (−y)
  // a side wall runs along the view: its points must stretch at least 35 cm away from the camera (a window's
  // reveal or a cupboard's side faces across too, but is short)
  const sideWall = (pts: { x: number; y: number }[], dir: 1 | -1) => {
    const pk = farPeak(pts.map((w) => w.x), dir);
    if (!pk) return null;
    const ys = pts.filter((w) => Math.abs(w.x - pk.at) < 0.08).map((w) => w.y).sort((a, b) => a - b);
    return ys.length > 10 && ys[Math.floor(ys.length * 0.9)]! - ys[Math.floor(ys.length * 0.1)]! >= 0.35 ? pk : null;
  };
  const left = sideWall(rot.filter((w) => w.nx > 0.85 && w.x < 0), -1);
  const right = sideWall(rot.filter((w) => w.nx < -0.85 && w.x > 0), 1);
  const far = farPeak(rot.filter((w) => w.ny < -0.85 && w.y > 0).map((w) => w.y), 1);
  const notes: string[] = [];
  if (Math.abs(turn) > 20) notes.push(`the room was at ${Math.round(Math.abs(turn))}° to the camera: squarer to the far wall is more accurate`);
  const across = left && right ? right.at - left.at : null;
  if (!left || !right) notes.push(!left && !right ? 'neither side wall was in view (the 0.5× lens sees more)' : `the ${left ? 'right' : 'left'} side wall was not in view`);
  // the far wall's own width in view: the room is at least that wide
  const farXs = far ? rot.filter((w) => w.ny < -0.85 && Math.abs(w.y - far.at) < 0.15).map((w) => w.x).sort((a, b) => a - b) : [];
  const acrossMin = farXs.length > 10 ? farXs[Math.floor(farXs.length * 0.98)]! - farXs[Math.floor(farXs.length * 0.02)]! : 0;
  const along = far ? far.at + STANCE.back : null;
  if (!far) notes.push('the far wall was not in view');
  return {
    across,
    // a wall's position from the depth: ±3 % of its distance, both walls' errors added
    acrossSd: across != null ? 0.03 * Math.hypot(left!.at, right!.at) + 0.02 : Infinity,
    acrossMin,
    along,
    alongSd: along != null ? Math.hypot(0.03 * far!.at, STANCE.backSd) : Infinity,
    height: floor.height,
    notes,
  };
}

/**
 * The doubt the scale adds to what one photo showed: the depth's scale doubt (`sigma`, log) and
 * the shape error the depth model makes even at the right scale — 8 %, from rendered rooms of known
 * size (the B2 check: sides came out 7–10 % off at the median) — on top of where the walls were found.
 */
export const ROOM_SHAPE_SD = 0.08;
export function withScaleDoubt(s: Seen, sigma: number): Seen {
  const k = Math.hypot(sigma, ROOM_SHAPE_SD);
  return { ...s, acrossSd: s.across != null ? Math.hypot(s.acrossSd, s.across * k) : s.acrossSd, alongSd: s.along != null ? Math.hypot(s.alongSd, s.along * k) : s.alongSd };
}

export interface RoomSize {
  /** Width (left → right in the first photo) and depth (away from the camera in the first photo), cm. */
  w: number;
  d: number;
  wSd: number;
  dSd: number;
  /** True when the second photo was taken a quarter turn from the first. */
  turned: boolean;
  notes: string[];
}

/** Inverse-variance mean of the values that exist. */
function join(vals: { v: number | null; sd: number }[]): { v: number; sd: number } | null {
  const ok = vals.filter((x): x is { v: number; sd: number } => x.v != null && Number.isFinite(x.sd) && x.sd > 0);
  if (!ok.length) return null;
  const w = ok.reduce((s, x) => s + 1 / x.sd ** 2, 0);
  return { v: ok.reduce((s, x) => s + x.v / x.sd ** 2, 0) / w, sd: 1 / Math.sqrt(w) };
}

/**
 * The room's width and depth from what each photo showed. Photos after the first are matched
 * either way round (taken the same way, or a quarter turn) — whichever agrees better with the
 * first. Null when no photo gave a width or a depth.
 */
export function joinRoom(seen: Seen[]): RoomSize | null {
  if (!seen.length) return null;
  const first = seen[0]!;
  const W: { v: number | null; sd: number }[] = [{ v: first.across, sd: first.acrossSd }];
  const Dp: { v: number | null; sd: number }[] = [{ v: first.along, sd: first.alongSd }];
  let wMin = first.acrossMin;
  let dMin = 0;
  let turned = false;
  const notes = [...first.notes];
  for (const s of seen.slice(1)) {
    const chi = (a: number | null, as: number, b: number | null, bs: number) => (a != null && b != null ? (a - b) ** 2 / (as ** 2 + bs ** 2) : 0.5);
    const same = chi(first.across, first.acrossSd, s.across, s.acrossSd) + chi(first.along, first.alongSd, s.along, s.alongSd);
    const quarter = chi(first.across, first.acrossSd, s.along, s.alongSd) + chi(first.along, first.alongSd, s.across, s.acrossSd);
    if (quarter < same) {
      turned = true;
      W.push({ v: s.along, sd: s.alongSd });
      Dp.push({ v: s.across, sd: s.acrossSd });
      dMin = Math.max(dMin, s.acrossMin);
    } else {
      W.push({ v: s.across, sd: s.acrossSd });
      Dp.push({ v: s.along, sd: s.alongSd });
      wMin = Math.max(wMin, s.acrossMin);
    }
    notes.push(...s.notes);
  }
  let w = join(W);
  let d = join(Dp);
  // a far wall seen wider than the estimate: the room is at least that
  if (w && wMin > w.v) w = { v: wMin, sd: w.sd };
  if (!w && wMin > 0) {
    w = { v: wMin, sd: Math.max(0.3, wMin * 0.2) };
    notes.push(`the width is at least ${wMin.toFixed(1)} m (all of the far wall was not in view)`);
  }
  if (d && dMin > d.v) d = { v: dMin, sd: d.sd };
  if (!w && !d) return null;
  if (!w) notes.push('the width is a guess: no photo showed both side walls');
  if (!d) notes.push('the depth is a guess: no photo showed the far wall');
  return {
    w: Math.round((w?.v ?? (d?.v ?? 3)) * 100),
    d: Math.round((d?.v ?? (w?.v ?? 3)) * 100),
    wSd: w ? Math.round(w.sd * 100) : 100,
    dSd: d ? Math.round(d.sd * 100) : 100,
    turned,
    notes: [...new Set(notes)],
  };
}
