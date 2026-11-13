/**
 * STEADY's maths (BRIEF-EDITOR-VIDEO-2), pure and the app's own: the motion between two grey frames by block matching (a coarse
 * search at half size, then the full-size refinement and a sub-pixel step), the translation, turn and scale solved from the
 * blocks' votes with the outliers thrown out, the camera path's windowed average, the correction that brings each frame back
 * onto the smoothed path, and the crop that keeps every corrected frame covering the picture. Nothing here reads a face or a
 * person: it moves rectangles of grey.
 *
 * Coordinates: pixels of the analysis frame (about 160 wide), the origin at its centre, y down, a turn in degrees clockwise on the
 * screen (the same way gpu.ts turns a layer). A motion `(rot, tx, ty)` takes a point p of the earlier frame to R(rot) p + t.
 */
import type { Clip, Key } from './model';
import { playTime } from './ramp';

export const ANALYSIS_W = 160;
export const BLOCK = 16;
/** The search's reach at full size, in pixels (the coarse search covers ±REACH at half size, so ±2 × REACH / 2 here). */
export const REACH = 16;

/** Grey (0..255) from RGBA pixels. */
export function toGrey(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): Uint8Array {
  const g = new Uint8Array(w * h);
  for (let i = 0, j = 0; j < g.length; i += 4, j++) g[j] = (rgba[i]! * 77 + rgba[i + 1]! * 150 + rgba[i + 2]! * 29) >> 8;
  return g;
}
/** Half size by averaging 2 × 2. */
export function halve(g: Uint8Array, w: number, h: number): { g: Uint8Array; w: number; h: number } {
  const nw = w >> 1;
  const nh = h >> 1;
  const o = new Uint8Array(nw * nh);
  for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) o[y * nw + x] = (g[2 * y * w + 2 * x]! + g[2 * y * w + 2 * x + 1]! + g[(2 * y + 1) * w + 2 * x]! + g[(2 * y + 1) * w + 2 * x + 1]!) >> 2;
  return { g: o, w: nw, h: nh };
}

export interface Vote {
  /** The block's centre (relative to the picture's centre) and how far it moved. */
  cx: number;
  cy: number;
  dx: number;
  dy: number;
  /** Its best match's cost, and the share of the search reach the move uses (1 = at the limit). */
  cost: number;
  edge: boolean;
}

const sad = (a: Uint8Array, b: Uint8Array, w: number, ax: number, ay: number, bx: number, by: number, n: number): number => {
  let s = 0;
  for (let y = 0; y < n; y++) {
    const ia = (ay + y) * w + ax;
    const ib = (by + y) * w + bx;
    for (let x = 0; x < n; x++) s += Math.abs(a[ia + x]! - b[ib + x]!);
  }
  return s;
};
const variance = (g: Uint8Array, w: number, x0: number, y0: number, n: number): number => {
  let s = 0;
  let q = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const v = g[(y0 + y) * w + x0 + x]!;
    s += v;
    q += v * v;
  }
  const m = s / (n * n);
  return q / (n * n) - m * m;
};

/**
 * Each textured block of `a` found in `b`: a full search of ±REACH/2 at half size, then ±2 at full size around twice that, then a
 * parabola through the three costs either side for the fraction. Flat blocks (nothing to follow) cast no vote.
 */
export function blockVotes(a: Uint8Array, b: Uint8Array, w: number, h: number): Vote[] {
  const A = halve(a, w, h);
  const B = halve(b, w, h);
  const half = REACH >> 1;
  const bs = BLOCK >> 1;
  const out: Vote[] = [];
  const m = REACH + 2;
  for (let by = m; by + BLOCK + m <= h; by += BLOCK) for (let bx = m; bx + BLOCK + m <= w; bx += BLOCK) {
    if (variance(a, w, bx, by, BLOCK) < 30) continue;
    // coarse
    const hx = bx >> 1;
    const hy = by >> 1;
    let best = Infinity;
    let cdx = 0;
    let cdy = 0;
    for (let dy = -half; dy <= half; dy++) for (let dx = -half; dx <= half; dx++) {
      const x1 = hx + dx;
      const y1 = hy + dy;
      if (x1 < 0 || y1 < 0 || x1 + bs > B.w || y1 + bs > B.h) continue;
      const c = sad(A.g, B.g, A.w, hx, hy, x1, y1, bs) + (Math.abs(dx) + Math.abs(dy)) * 0.5;
      if (c < best) {
        best = c;
        cdx = dx;
        cdy = dy;
      }
    }
    // fine
    const cost = new Map<number, number>();
    let fb = Infinity;
    let fdx = 0;
    let fdy = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const ddx = cdx * 2 + dx;
      const ddy = cdy * 2 + dy;
      const x1 = bx + ddx;
      const y1 = by + ddy;
      if (x1 < 0 || y1 < 0 || x1 + BLOCK > w || y1 + BLOCK > h) continue;
      const c = sad(a, b, w, bx, by, x1, y1, BLOCK);
      cost.set(ddy * 1000 + ddx, c);
      if (c < fb) {
        fb = c;
        fdx = ddx;
        fdy = ddy;
      }
    }
    if (!isFinite(fb)) continue;
    const para = (l: number | undefined, c: number, r: number | undefined): number => {
      if (l === undefined || r === undefined) return 0;
      const d = l - 2 * c + r;
      return d <= 1e-9 ? 0 : Math.max(-0.5, Math.min(0.5, (l - r) / (2 * d)));
    };
    const sx = para(cost.get(fdy * 1000 + fdx - 1), fb, cost.get(fdy * 1000 + fdx + 1));
    const sy = para(cost.get((fdy - 1) * 1000 + fdx), fb, cost.get((fdy + 1) * 1000 + fdx));
    out.push({ cx: bx + BLOCK / 2 - w / 2, cy: by + BLOCK / 2 - h / 2, dx: fdx + sx, dy: fdy + sy, cost: fb / (BLOCK * BLOCK), edge: Math.abs(cdx) >= half || Math.abs(cdy) >= half });
  }
  return out;
}

export interface Motion {
  /** Degrees, and the picture's pixels. */
  rot: number;
  tx: number;
  ty: number;
  /** The scale found (1 = none); the path does not use it. */
  s: number;
  /** The blocks that agreed, the textured blocks that voted, and the share of votes at the search's limit. */
  used: number;
  of: number;
  edge: number;
  ok: boolean;
}

/** Solve d = (a, -b; b, a) c + t from the votes by least squares, three times, each time dropping votes far from the fit. */
export function solveMotion(votes: Vote[]): Motion {
  const none: Motion = { rot: 0, tx: 0, ty: 0, s: 1, used: 0, of: votes.length, edge: 0, ok: false };
  if (votes.length < 6) return none;
  const edge = votes.filter((v) => v.edge).length / votes.length;
  let keep = votes;
  let sol = [0, 0, 0, 0];
  for (let it = 0; it < 4; it++) {
    // normal equations for (a, b, tx, ty)
    const M = [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0]] as number[][];
    for (const v of keep) {
      const rows: [number[], number][] = [[[v.cx, -v.cy, 1, 0], v.dx], [[v.cy, v.cx, 0, 1], v.dy]];
      for (const [r, y] of rows) for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) M[i]![j]! += r[i]! * r[j]!;
        M[i]![4]! += r[i]! * y;
      }
    }
    for (let i = 0; i < 4; i++) {
      let p = i;
      for (let r = i + 1; r < 4; r++) if (Math.abs(M[r]![i]!) > Math.abs(M[p]![i]!)) p = r;
      if (Math.abs(M[p]![i]!) < 1e-9) return { ...none, edge, of: votes.length };
      [M[i], M[p]] = [M[p]!, M[i]!];
      for (let r = 0; r < 4; r++) if (r !== i) {
        const f = M[r]![i]! / M[i]![i]!;
        for (let c = i; c < 5; c++) M[r]![c]! -= f * M[i]![c]!;
      }
    }
    sol = [0, 1, 2, 3].map((i) => M[i]![4]! / M[i]![i]!);
    const [a, b, tx, ty] = sol as [number, number, number, number];
    const res = votes.map((v) => Math.hypot(a * v.cx - b * v.cy + tx - v.dx, b * v.cx + a * v.cy + ty - v.dy));
    const sortedRes = [...res].sort((x, y) => x - y);
    const lim = Math.max(0.75, 2.5 * sortedRes[Math.floor(sortedRes.length / 2)]!);
    const next = votes.filter((_, i) => res[i]! <= lim);
    if (next.length < 6) break;
    keep = next;
  }
  const [a, b, tx, ty] = sol as [number, number, number, number];
  const used = keep.length;
  const ok = used >= 6 && used / votes.length >= 0.5 && edge <= 0.4;
  return { rot: (Math.atan2(b, 1 + a) * 180) / Math.PI, tx, ty, s: Math.hypot(1 + a, b), used, of: votes.length, edge, ok };
}

/** The motion from frame `a` to frame `b` (grey, w × h). */
export const motionBetween = (a: Uint8Array, b: Uint8Array, w: number, h: number): Motion => solveMotion(blockVotes(a, b, w, h));

// ---------------------------------------------------------------- the path
export interface Pose {
  /** Degrees, pixels. */
  rot: number;
  tx: number;
  ty: number;
}
const rad = (d: number): number => (d * Math.PI) / 180;
/** (r1, t1) after (r2, t2): R1 (R2 x + t2) + t1. */
export function compose(a: Pose, b: Pose): Pose {
  const c = Math.cos(rad(a.rot));
  const s = Math.sin(rad(a.rot));
  return { rot: a.rot + b.rot, tx: c * b.tx - s * b.ty + a.tx, ty: s * b.tx + c * b.ty + a.ty };
}
/** The camera's path: where frame i sits against frame 0, from the motions between neighbours (a failed pair is no motion). */
export function accumulate(motions: Motion[]): Pose[] {
  const out: Pose[] = [{ rot: 0, tx: 0, ty: 0 }];
  for (const m of motions) out.push(compose(m.ok ? { rot: m.rot, tx: m.tx, ty: m.ty } : { rot: 0, tx: 0, ty: 0 }, out[out.length - 1]!));
  return out;
}

/** The window (in frames, odd) for a strength 0 to 1 at `fps`: from about 0.4 s to 2.5 s of the path averaged. */
export function windowFor(strength: number, fps: number): number {
  const secs = 0.15 + 2.35 * Math.min(1, Math.max(0, strength));
  const n = Math.max(3, Math.round(secs * fps));
  return n % 2 ? n : n + 1;
}
export const windowWords = (w: number, fps: number): string => `${(w / fps).toFixed(1)} s`;

/** The path averaged over a centred window of `w` frames (the window narrows toward the ends so the first and last frames stay put). */
export function smoothPath(path: Pose[], w: number): Pose[] {
  const n = path.length;
  const h = (w - 1) >> 1;
  return path.map((_, i) => {
    const k = Math.min(h, i, n - 1 - i);
    let r = 0;
    let x = 0;
    let y = 0;
    for (let j = i - k; j <= i + k; j++) {
      r += path[j]!.rot;
      x += path[j]!.tx;
      y += path[j]!.ty;
    }
    const c = 2 * k + 1;
    return { rot: r / c, tx: x / c, ty: y / c };
  });
}

/** What each frame is moved by to sit on the smoothed path: S after C's inverse = (rot_S - rot_C, t_S - R(rot_S - rot_C) t_C). */
export function corrections(path: Pose[], smooth: Pose[]): Pose[] {
  return path.map((c, i) => {
    const s = smooth[i]!;
    const r = s.rot - c.rot;
    const cs = Math.cos(rad(r));
    const sn = Math.sin(rad(r));
    return { rot: r, tx: s.tx - (cs * c.tx - sn * c.ty), ty: s.ty - (sn * c.tx + cs * c.ty) };
  });
}

/**
 * The smallest zoom (1 or more) with which every corrected frame still covers the whole picture of w × h: the picture's corners,
 * taken back through each correction, must land inside the frame. The layer draws p -> s R p + t, so the corner q needs
 * |R(-rot)(q - t)| within (s w/2, s h/2).
 */
export function cropScale(corr: Pose[], w: number, h: number): number {
  const hw = w / 2;
  const hh = h / 2;
  let s = 1;
  for (const c of corr) {
    const cs = Math.cos(rad(c.rot));
    const sn = Math.sin(rad(c.rot));
    for (const [qx, qy] of [[hw, hh], [-hw, hh], [hw, -hh], [-hw, -hh]] as const) {
      const px = qx - c.tx;
      const py = qy - c.ty;
      const ux = cs * px + sn * py;
      const uy = -sn * px + cs * py;
      s = Math.max(s, Math.abs(ux) / hw, Math.abs(uy) / hh);
    }
  }
  return Math.ceil(s * 1005) / 1000;
}
/** "loses 8% at the edges": the share of the picture's width and height given up to the zoom. */
export const losesPercent = (scale: number): number => Math.round((1 - 1 / scale) * 100);

/** Whether every corrected corner is inside the frame at that zoom (the test's own check of the crop). */
export function covers(c: Pose, scale: number, w: number, h: number): boolean {
  const hw = w / 2;
  const hh = h / 2;
  const cs = Math.cos(rad(c.rot));
  const sn = Math.sin(rad(c.rot));
  for (const [qx, qy] of [[hw, hh], [-hw, hh], [hw, -hh], [-hw, -hh]] as const) {
    const px = qx - c.tx;
    const py = qy - c.ty;
    const ux = (cs * px + sn * py) / scale;
    const uy = (-sn * px + cs * py) / scale;
    if (Math.abs(ux) > hw + 1e-6 || Math.abs(uy) > hh + 1e-6) return false;
  }
  return true;
}

// ---------------------------------------------------------------- what a clip keeps
export interface SteadyRecord {
  /** 0 to 1, from "a little" to "as steady as it goes". */
  strength: number;
  /** The project's rate the samples were taken at, the source time (ms) of the first and the gap between samples. */
  fps: number;
  t0: number;
  step: number;
  /** The phone's player minus the app's reader, in ms, for the same picture (an edit list can hold it a frame or two back). */
  lag?: number;
  /** The analysis frame's size, and how much of the canvas the picture spans across and up and down (letterbox bars give less than 1). */
  w: number;
  h: number;
  fw: number;
  fh: number;
  /** The camera path, flat: rot, tx, ty for each sample (the picture's pixels, degrees). */
  path: number[];
  /** The clip's own position, turn and scale when it was steadied (the corrections are laid on top). */
  base: { x: number; y: number; rot: number; scale: number };
  /** The zoom and what it costs, said. */
  zoom: number;
  loses: number;
  window: number;
}

export const poseAt = (r: SteadyRecord, i: number): Pose => ({ rot: r.path[i * 3]!, tx: r.path[i * 3 + 1]!, ty: r.path[i * 3 + 2]! });

/** The corrections and the zoom a record gives at its strength. */
export function correct(r: Pick<SteadyRecord, 'path' | 'strength' | 'fps' | 'w' | 'h'>): { corr: Pose[]; zoom: number; window: number } {
  const n = r.path.length / 3;
  const path: Pose[] = Array.from({ length: n }, (_, i) => ({ rot: r.path[i * 3]!, tx: r.path[i * 3 + 1]!, ty: r.path[i * 3 + 2]! }));
  const window = windowFor(r.strength, r.fps);
  const corr = corrections(path, smoothPath(path, window));
  return { corr, zoom: cropScale(corr, r.w, r.h), window };
}

/** Write the STEADY keys into a clip from its record (again after a trim, split or speed change). Keeps the speed ramp's keys. */
export function rekey(c: Clip): void {
  const r = c.steady;
  if (!r) return;
  const { corr, zoom, window } = correct(r);
  r.zoom = zoom;
  r.window = window;
  r.loses = losesPercent(zoom);
  const span = c.out - c.in;
  const ramp = (c.tr.keys.speed ?? []) as { t: number; v: number }[];
  const keys: Record<'x' | 'y' | 'rot' | 'scale', Key[]> = { x: [], y: [], rot: [], scale: [] };
  const sp = Math.max(1, span);
  for (let i = 0; i < corr.length; i++) {
    const src = r.t0 + i * r.step + (r.lag ?? 0);
    if (src < c.in - r.step || src > c.out + r.step) continue;
    // how far into the picture, in the direction it plays, and then how long that takes at this clip's speed
    const u = Math.min(sp, Math.max(0, c.reverse ? c.out - src : src - c.in));
    const t = Math.round(playTime(ramp, u, sp) / c.speed);
    const k = corr[i]!;
    keys.x.push({ t, v: r.base.x + (k.tx / r.w) * r.fw });
    keys.y.push({ t, v: r.base.y + (k.ty / r.h) * r.fh });
    keys.rot.push({ t, v: r.base.rot + k.rot });
  }
  for (const ch of ['x', 'y', 'rot'] as const) keys[ch].sort((a, b) => a.t - b.t);
  const len = Math.round(playTime(ramp, sp, sp) / c.speed);
  keys.scale = [{ t: 0, v: r.base.scale * zoom }, { t: len, v: r.base.scale * zoom }];
  for (const ch of ['x', 'y', 'rot', 'scale'] as const) c.tr.keys[ch] = keys[ch];
}

/** The steadying taken off: the four channels' keys go and the clip's own position, turn and scale are as they were. */
export function unsteady(c: Clip): void {
  const r = c.steady;
  if (!r) return;
  for (const ch of ['x', 'y', 'rot', 'scale'] as const) delete c.tr.keys[ch];
  delete c.steady;
}

// ---------------------------------------------------------------- can it follow?
/** Why a clip is left alone, or '' when its motion can be followed: too dark, too flat, or too fast for the search's reach. */
export function cannotFollow(motions: Motion[], meanLight: number): string {
  if (meanLight < 22) return 'It is too dark for me to follow anything in it.';
  const n = motions.length;
  if (n < 3) return 'It is too short to steady.';
  const good = motions.filter((m) => m.ok).length;
  if (good / n < 0.6) {
    const edgy = motions.filter((m) => m.edge > 0.4).length;
    return edgy / n > 0.3 ? 'It moves faster than I can follow between frames, so I have left it as it was.' : 'There is too little in the picture for me to follow, so I have left it as it was.';
  }
  return '';
}
