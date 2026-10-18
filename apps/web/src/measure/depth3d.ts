/**
 * MEASURE with no settings: sizes from one photo's depth map (pure, unit-tested in
 * apps/edge/test/measure.test.mjs). The phone runs Depth Anything V2 Metric Indoor Small
 * (measure/depth.ts) and gets, for every pixel, how far away it is in metres; with the camera's
 * focal length (measure/exif.ts) each tapped pixel becomes a point in 3-D, and a size is the
 * distance between points.
 *
 * Three corrections make the model's metres real ones:
 * - FOCAL: the model learnt on Hypersim pictures (886.81 px focal over 768 px: a 60° view across
 *   1024). It judges distance from how big things look, so a camera with a longer or shorter lens
 *   than that is put right by depth × (this camera's focal / Hypersim's), both over the short side.
 * - REAL PHOTOS: on real photos (NYU Depth v2's Kinect pictures) lengths still come out about 19 %
 *   too long after that; `REAL_FACTOR` was fitted on half of 60 NYU photos and checked on the other
 *   half (see `DEPTH_STATS`).
 * - CUES: things of known size seen in the picture (cues.ts) pull the scale toward the truth.
 *
 * How sure a size is comes from the same check: the log-scale spread of lengths from the depth
 * alone (`DEPTH_STATS.logSd`), narrowed by the cues, plus the shape error that remains even with
 * the right scale and the tap's own few pixels.
 */
import type { Intrinsics } from './exif';

export type P2 = { x: number; y: number };
export type P3 = [number, number, number];

/** A depth map in metres, `w` × `h` (the model's own size), covering the whole picture. */
export interface DepthMap {
  w: number;
  h: number;
  z: Float32Array;
}

/**
 * The model's input: its short side, and the largest long side it is given (patches of 14 px).
 * 392 rather than the model card's 518: on the NYU check below it measured as well once its own
 * real-photo factor was fitted (median length error 12.3 % against 12.4 %), and it runs in about
 * half the time (10 s against 20–29 s a photo in desktop Chromium's one-thread WebAssembly).
 */
export const MODEL_SHORT = 392;
export const MODEL_LONG_MAX = 784;
/** Hypersim's focal length over its short side (886.81 px / 768 px). */
export const HYPERSIM_F_SHORT = 886.81 / 768;
/** The colour normalisation the model was trained with (ImageNet's). */
export const MODEL_MEAN = [0.485, 0.456, 0.406] as const;
export const MODEL_STD = [0.229, 0.224, 0.225] as const;

/**
 * What the check on real photos found (NYU Depth v2 validation, 60 photos, 40 random pairs of
 * points 20 cm or more apart in each, true lengths from the Kinect's depth; the model run exactly
 * as the phone runs it, ONNX Runtime Web in a worker, 392 px on the short side): `realFactor`
 * takes the focal-corrected lengths to the truth (0.837 fitted on the even photos; on the odd
 * ones the median length error is then 12.3 %, 90 % within 38 %); `logSd` is how much the scale
 * wanders from photo to photo (0.14 measured, 0.15 used); `shapeLogSd` is the error left when the
 * scale is exactly right (median about 8 %, a robust log spread of about 0.12). With those, 70 %
 * of the held-out lengths fell inside the range MEASURE shows (one sigma: 68 % expected).
 */
export const DEPTH_STATS = { realFactor: 0.84, logSd: 0.15, shapeLogSd: 0.12 } as const;
export const REAL_FACTOR = DEPTH_STATS.realFactor;

/** The model's input size for a picture: short side 392, the long side to match (multiples of 14). */
export function inputSize(w: number, h: number): { w: number; h: number } {
  const s = MODEL_SHORT / Math.min(w, h);
  const r14 = (v: number) => Math.max(14, Math.round(v / 14) * 14);
  const long = Math.min(MODEL_LONG_MAX, r14(Math.max(w, h) * s));
  return w >= h ? { w: long, h: MODEL_SHORT } : { w: MODEL_SHORT, h: long };
}

/** RGBA pixels (already at the input size) → the model's input, CHW float32, normalised. */
export function toInput(rgba: ArrayLike<number>, w: number, h: number): Float32Array {
  const n = w * h;
  const out = new Float32Array(3 * n);
  const inv = MODEL_STD.map((s) => 1 / s);
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) out[c * n + i] = (rgba[i * 4 + c]! * (1 / 255) - MODEL_MEAN[c]!) * inv[c]!;
  }
  return out;
}

/** The focal correction: this camera's focal over Hypersim's, both per pixel of the short side. */
export function focalFactor(K: Pick<Intrinsics, 'f'>, frame: { w: number; h: number }): number {
  return K.f / Math.min(frame.w, frame.h) / HYPERSIM_F_SHORT;
}

/** The model's raw output (metres as it thinks) → metres, with the focal and real-photo corrections. */
export function metricDepth(raw: ArrayLike<number>, w: number, h: number, K: Pick<Intrinsics, 'f'>, frame: { w: number; h: number }, scale = 1): DepthMap {
  const k = focalFactor(K, frame) * REAL_FACTOR * scale;
  const z = new Float32Array(w * h);
  for (let i = 0; i < z.length; i++) z[i] = Math.max(0.05, Number(raw[i]) * k);
  return { w, h, z };
}

/** The same map with every depth times `s` (a cue's correction). */
export function rescaleDepth(D: DepthMap, s: number): DepthMap {
  const z = new Float32Array(D.z.length);
  for (let i = 0; i < z.length; i++) z[i] = D.z[i]! * s;
  return { w: D.w, h: D.h, z };
}

/** A picture point → the depth map's pixel. */
const toMap = (D: DepthMap, frame: { w: number; h: number }, p: P2) => ({
  u: Math.max(0, Math.min(D.w - 1, Math.round((p.x / frame.w) * D.w - 0.5))),
  v: Math.max(0, Math.min(D.h - 1, Math.round((p.y / frame.h) * D.h - 0.5))),
});

/** The depth at a picture point: the median of a small square round it (a tap is never pixel-exact). */
export function depthAt(D: DepthMap, frame: { w: number; h: number }, p: P2, r = 2): number {
  const { u, v } = toMap(D, frame, p);
  const vals: number[] = [];
  for (let y = Math.max(0, v - r); y <= Math.min(D.h - 1, v + r); y++) for (let x = Math.max(0, u - r); x <= Math.min(D.w - 1, u + r); x++) vals.push(D.z[y * D.w + x]!);
  vals.sort((a, b) => a - b);
  return vals[vals.length >> 1] ?? 0;
}

/** A picture point at depth z → camera space, metres (x right, y down, z forward). */
export function unproject(K: Pick<Intrinsics, 'f' | 'cx' | 'cy'>, p: P2, z: number): P3 {
  return [((p.x - K.cx) * z) / K.f, ((p.y - K.cy) * z) / K.f, z];
}

export const dist3 = (a: P3, b: P3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** The point a tap lands on, in 3-D. */
export function pointAt(D: DepthMap, K: Intrinsics, frame: { w: number; h: number }, p: P2): P3 {
  return unproject(K, p, depthAt(D, frame, p));
}

/** The 3-D length between two picture points, millimetres. */
export function lengthFromDepth(D: DepthMap, K: Intrinsics, frame: { w: number; h: number }, a: P2, b: P2): number {
  return dist3(pointAt(D, K, frame, a), pointAt(D, K, frame, b)) * 1000;
}

/** A rectangle's width (mean of top and bottom) and height (mean of the sides) in 3-D, from corners ordered TL, TR, BR, BL. */
export function rectFromDepth(D: DepthMap, K: Intrinsics, frame: { w: number; h: number }, q: [P2, P2, P2, P2]): { w: number; h: number } {
  const P = q.map((p) => pointAt(D, K, frame, p));
  return { w: ((dist3(P[0]!, P[1]!) + dist3(P[3]!, P[2]!)) / 2) * 1000, h: ((dist3(P[0]!, P[3]!) + dist3(P[1]!, P[2]!)) / 2) * 1000 };
}

// ---------------------------------------------------------------- the thing that was tapped

export interface Region {
  /** Depth-map pixels in the region (indices). */
  idx: Int32Array;
  /** Its box in picture pixels. */
  box: { x: number; y: number; w: number; h: number };
}

/**
 * The thing under a tap: depth-map pixels joined to the tap point while the surface stays
 * continuous (each step less than `step` of the depth apart) and within `spread` of the tap's
 * depth, inside `within` (a detector box, picture pixels) when given. A floor running under a
 * chair is continuous too, so with the picture's colours (`rgb`, RGBA at the depth map's size) a
 * step must also stay close in colour (under `edge` from its neighbour, under `far` from the
 * colour round the tap): a grey cabinet against a cream wall stops at its edge. A box, or the
 * cap of `maxShare` of the picture, keeps it in check either way.
 */
export function regionAt(D: DepthMap, frame: { w: number; h: number }, seed: P2, opts: { within?: { x: number; y: number; w: number; h: number }; step?: number; spread?: number; maxShare?: number; rgb?: ArrayLike<number>; edge?: number; far?: number } = {}): Region {
  const step = opts.step ?? 0.035;
  const spread = opts.spread ?? 0.35;
  const maxN = Math.round(D.w * D.h * (opts.maxShare ?? 0.45));
  const b = opts.within;
  const u0 = b ? Math.max(0, Math.floor((b.x / frame.w) * D.w)) : 0;
  const v0 = b ? Math.max(0, Math.floor((b.y / frame.h) * D.h)) : 0;
  const u1 = b ? Math.min(D.w - 1, Math.ceil(((b.x + b.w) / frame.w) * D.w)) : D.w - 1;
  const v1 = b ? Math.min(D.h - 1, Math.ceil(((b.y + b.h) / frame.h) * D.h)) : D.h - 1;
  const s = toMap(D, frame, seed);
  const su = Math.max(u0, Math.min(u1, s.u));
  const sv = Math.max(v0, Math.min(v1, s.v));
  const z0 = depthAt(D, frame, seed);
  const rgb = opts.rgb && opts.rgb.length >= D.w * D.h * 4 ? opts.rgb : null;
  const edge = opts.edge ?? 40;
  const far = opts.far ?? 90;
  const cdist = (i: number, r: number, g: number, b: number) => Math.hypot(rgb![i * 4]! - r, rgb![i * 4 + 1]! - g, rgb![i * 4 + 2]! - b);
  // the colour round the tap: the mean of a 5 × 5 square
  let c0: [number, number, number] = [0, 0, 0];
  if (rgb) {
    let n = 0;
    for (let y = Math.max(0, sv - 2); y <= Math.min(D.h - 1, sv + 2); y++)
      for (let x = Math.max(0, su - 2); x <= Math.min(D.w - 1, su + 2); x++) {
        const k = (y * D.w + x) * 4;
        c0 = [c0[0] + rgb[k]!, c0[1] + rgb[k + 1]!, c0[2] + rgb[k + 2]!];
        n++;
      }
    c0 = [c0[0] / n, c0[1] / n, c0[2] / n];
  }
  const seen = new Uint8Array(D.w * D.h);
  const stack = [sv * D.w + su];
  seen[stack[0]!] = 1;
  const out: number[] = [];
  let minU = su, maxU = su, minV = sv, maxV = sv;
  while (stack.length && out.length < maxN) {
    const i = stack.pop()!;
    out.push(i);
    const u = i % D.w;
    const v = (i - u) / D.w;
    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
    const zi = D.z[i]!;
    for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nu = u + du;
      const nv = v + dv;
      if (nu < u0 || nu > u1 || nv < v0 || nv > v1) continue;
      const j = nv * D.w + nu;
      if (seen[j]) continue;
      const zj = D.z[j]!;
      if (Math.abs(zj - zi) > step * zi || Math.abs(zj - z0) > spread * z0) continue;
      if (rgb && (cdist(j, rgb[i * 4]!, rgb[i * 4 + 1]!, rgb[i * 4 + 2]!) > edge || cdist(j, c0[0], c0[1], c0[2]) > far)) continue;
      seen[j] = 1;
      stack.push(j);
    }
  }
  const sx = frame.w / D.w;
  const sy = frame.h / D.h;
  return { idx: Int32Array.from(out), box: { x: minU * sx, y: minV * sy, w: (maxU - minU + 1) * sx, h: (maxV - minV + 1) * sy } };
}

const quantile = (sorted: number[], q: number) => sorted[Math.max(0, Math.min(sorted.length - 1, Math.round(q * (sorted.length - 1))))] ?? 0;

/**
 * A region's size in 3-D, millimetres: across (camera x), up (camera y) and front-to-back (the
 * depth it spans, only the side the camera sees), from the 3rd to the 97th percentile of its
 * points so a few stray pixels at the edges do not stretch it.
 */
export function regionSize(D: DepthMap, K: Intrinsics, frame: { w: number; h: number }, r: Region): { w: number; h: number; d: number; z: number } {
  const xs: number[] = [];
  const ys: number[] = [];
  const zs: number[] = [];
  const sx = frame.w / D.w;
  const sy = frame.h / D.h;
  for (const i of r.idx) {
    const u = i % D.w;
    const v = (i - u) / D.w;
    const P = unproject(K, { x: (u + 0.5) * sx, y: (v + 0.5) * sy }, D.z[i]!);
    xs.push(P[0]);
    ys.push(P[1]);
    zs.push(P[2]);
  }
  for (const a of [xs, ys, zs]) a.sort((p, q) => p - q);
  const span = (a: number[]) => (quantile(a, 0.97) - quantile(a, 0.03)) * 1000;
  return { w: span(xs), h: span(ys), d: span(zs), z: quantile(zs, 0.5) };
}

/** How many depth-map pixels make a picture-pixel distance (for the tap's own error). */
export const mapScale = (D: DepthMap, frame: { w: number; h: number }) => D.w / frame.w;

// ---------------------------------------------------------------- how sure

export type Level = 'good' | 'fair' | 'rough';

/**
 * The likely range of a size: `sigma` is the log-scale spread (0.1 ≈ ±10 %); about two in three
 * real sizes fall inside lo–hi. The tap error is `tapPx` picture pixels at each end over a
 * length of `px` pixels.
 */
export function band(mm: number, scaleSigma: number, px: number, tapPx = 3): { lo: number; hi: number; sigma: number; level: Level } {
  const tap = px > 0 ? (Math.SQRT2 * tapPx) / px : 0;
  const sigma = Math.hypot(scaleSigma, DEPTH_STATS.shapeLogSd, tap);
  return { lo: mm * Math.exp(-sigma), hi: mm * Math.exp(sigma), sigma, level: levelOf(sigma) };
}

export const levelOf = (sigma: number): Level => (sigma <= 0.06 ? 'good' : sigma <= 0.16 ? 'fair' : 'rough');
