/**
 * THE PHOTO MATHS (BRIEF-EDITOR-PHOTO), pure: the matrices, the curves, the colour bands, the tone functions and the geometry that the
 * WebGL pipeline (photo/gpu.ts) and the slow CPU path (photo/cpu.ts) both draw from. gpu.ts's shader is these functions written again in
 * GLSL, line for line, so a picture drawn either way is the same within one unit per channel; the spec and the brain test hold that.
 *
 * Colour: a photo's values are sRGB-encoded, 0..1. Exposure and white balance work in linear light; the tones, the curves and the colour
 * work on the encoded values, as the sliders of a photo editor feel.
 */
import type { CurvePts, Curves, Crop, Hsl, MaskGrade, Pt } from './recipe';
import { NEUTRAL_K } from './recipe';

export type RGB = [number, number, number];

export const clamp = (x: number, a = 0, b = 1): number => (x < a ? a : x > b ? b : x);
export const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const luma = (c: RGB): number => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

// ------------------------------------------------------------------ light

export const srgbToLin = (c: number): number => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
export const linToSrgb = (c: number): number => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

/** The gain an exposure of `stops` stops puts on linear light: each stop doubles it. */
export const exposureGain = (stops: number): number => Math.pow(2, stops);

// ------------------------------------------------------------------ white balance

/** The colour of a light of `kelvin` (an approximation of a black body, as sRGB 0..255), after Tanner Helland's fit. */
export function illuminant(kelvin: number): RGB {
  const t = clamp(kelvin, 1000, 40000) / 100;
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255)];
}

/**
 * The colour cast a scene lit at `temp` K (with `tint`) carries, relative to the neutral 6,500 K: (1, 1, 1) at neutral. Softened (the
 * power 0.35) so a JPEG, which has no more to give, is not asked for a 250-fold blue gain at 2,500 K.
 */
export function castOf(temp: number, tint: number): RGB {
  const a = illuminant(temp).map((v) => srgbToLin(v / 255));
  const n = illuminant(NEUTRAL_K).map((v) => srgbToLin(v / 255));
  const k = 0.35;
  const cast: RGB = [Math.pow(a[0]! / n[0]!, k), Math.pow(a[1]! / n[1]!, k), Math.pow(a[2]! / n[2]!, k)];
  // + tint is towards magenta: less green in the gain, so more green in the cast it undoes
  cast[1] *= Math.pow(2, (tint / 100) * 0.3);
  return cast;
}

/** The white-balance matrix (3 × 3, row-major, diagonal) that removes `castOf(temp, tint)`, scaled so the brightness holds. */
export function wbMatrix(temp: number, tint: number): number[] {
  const c = castOf(temp, tint);
  const g: RGB = [1 / c[0], 1 / c[1], 1 / c[2]];
  const k = 1 / (0.2126 * g[0] + 0.7152 * g[1] + 0.0722 * g[2]);
  return [g[0] * k, 0, 0, 0, g[1] * k, 0, 0, 0, g[2] * k];
}
export const wbGains = (temp: number, tint: number): RGB => {
  const m = wbMatrix(temp, tint);
  return [m[0]!, m[4]!, m[8]!];
};

// ------------------------------------------------------------------ curves (monotone cubic)

/** The tangents of a monotone cubic through the points (Fritsch and Carlson): the curve never overshoots, so it never goes back down. */
export function curveSlopes(pts: CurvePts): number[] {
  const n = pts.length;
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((pts[i + 1]![1] - pts[i]![1]) / Math.max(1e-6, pts[i + 1]![0] - pts[i]![0]));
  const m: number[] = new Array(n).fill(0);
  if (n < 2) return m;
  m[0] = d[0]!;
  m[n - 1] = d[n - 2]!;
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1]! * d[i]! <= 0 ? 0 : (d[i - 1]! + d[i]!) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i]! / d[i]!;
    const b = m[i + 1]! / d[i]!;
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i]!;
      m[i + 1] = t * b * d[i]!;
    }
  }
  return m;
}

/** The curve's value at x: flat before the first point and after the last, a cubic Hermite between. */
export function curveEval(pts: CurvePts, m: number[], x: number): number {
  const n = pts.length;
  if (x <= pts[0]![0]) return pts[0]![1];
  if (x >= pts[n - 1]![0]) return pts[n - 1]![1];
  let i = 0;
  while (i < n - 2 && x > pts[i + 1]![0]) i++;
  const x0 = pts[i]![0];
  const x1 = pts[i + 1]![0];
  const h = x1 - x0;
  const t = (x - x0) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * pts[i]![1] + (t3 - 2 * t2 + t) * h * m[i]! + (-2 * t3 + 3 * t2) * pts[i + 1]![1] + (t3 - t2) * h * m[i + 1]!;
}

/** A curve made ready to evaluate (the points, their tangents). */
export interface CurveP {
  pts: CurvePts;
  m: number[];
}
export const curveReady = (pts: CurvePts): CurveP | null => (pts.length === 2 && pts[0]![0] === 0 && pts[0]![1] === 0 && pts[1]![0] === 1 && pts[1]![1] === 1 ? null : { pts, m: curveSlopes(pts) });
export const curveAt = (c: CurveP | null, x: number): number => (c ? clamp(curveEval(c.pts, c.m, x)) : x);

/** A curve's points kept in order and in range: at most six, the ends at x = 0 and x = 1, no two closer than 2 %. */
export function tidyCurve(pts: CurvePts, max = 6): CurvePts {
  const inner = pts
    .filter((p) => p[0] > 0.02 && p[0] < 0.98)
    .map((p): [number, number] => [clamp(p[0]), clamp(p[1])])
    .sort((a, b) => a[0] - b[0]);
  const keep: CurvePts = [];
  for (const p of inner) if (!keep.length || p[0] - keep[keep.length - 1]![0] >= 0.02) keep.push(p);
  const first = pts.reduce((a, p) => (p[0] < a[0] ? p : a), pts[0] ?? [0, 0]);
  const last = pts.reduce((a, p) => (p[0] > a[0] ? p : a), pts[pts.length - 1] ?? [1, 1]);
  const out: CurvePts = [[0, clamp(first[1])], ...keep.slice(0, max - 2), [1, clamp(last[1])]];
  return out;
}

// ------------------------------------------------------------------ colour: HSL and the eight bands

export function rgbToHsl(c: RGB): RGB {
  const r = c[0];
  const g = c[1];
  const b = c[2];
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  const d = mx - mn;
  if (d < 1e-9) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return [h, clamp(s), l];
}
export function hslToRgb(c: RGB): RGB {
  const h = ((c[0] % 360) + 360) % 360;
  const s = c[1];
  const l = c[2];
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

/** The eight bands' centres in degrees: red, orange, yellow, green, aqua, blue, purple, magenta. */
export const BAND_HUES = [0, 30, 60, 120, 180, 240, 270, 300];

/** How much each band holds a hue: two neighbours share it, and the eight always add up to one. */
export function hslWeights(hue: number): number[] {
  const h = ((hue % 360) + 360) % 360;
  const w = new Array(8).fill(0) as number[];
  for (let i = 0; i < 8; i++) {
    const a = BAND_HUES[i]!;
    const b = i === 7 ? 360 : BAND_HUES[i + 1]!;
    if (h >= a && h < b) {
      const t = (h - a) / (b - a);
      w[i] = 1 - t;
      w[(i + 1) % 8] = t;
      break;
    }
  }
  return w;
}

// ------------------------------------------------------------------ the grade (one function, global and every mask)

export interface GradeP {
  /** The linear gain from exposure. */
  gain: number;
  /** The white-balance gains. */
  wb: RGB;
  contrast: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  vibrance: number;
  saturation: number;
  /** The eight bands as hue, saturation, luminance triples, -1..1 each (null: none moved). */
  hsl: number[] | null;
  curves: { l: CurveP | null; r: CurveP | null; g: CurveP | null; b: CurveP | null } | null;
}

export function gradeOfLight(light: { exposure: number; contrast: number; highlights: number; shadows: number; whites: number; blacks: number }, wb: { temp: number; tint: number }, color: { vibrance: number; saturation: number; hsl: Hsl[] }, curves: Curves): GradeP {
  const moved = color.hsl.some((b) => b.h || b.s || b.l);
  const cv = { l: curveReady(curves.l), r: curveReady(curves.r), g: curveReady(curves.g), b: curveReady(curves.b) };
  return {
    gain: exposureGain(light.exposure),
    wb: wbGains(wb.temp, wb.tint),
    contrast: light.contrast / 100,
    highlights: light.highlights / 100,
    shadows: light.shadows / 100,
    whites: light.whites / 100,
    blacks: light.blacks / 100,
    vibrance: color.vibrance / 100,
    saturation: color.saturation / 100,
    hsl: moved ? color.hsl.flatMap((b) => [b.h / 100, b.s / 100, b.l / 100]) : null,
    curves: cv.l || cv.r || cv.g || cv.b ? cv : null,
  };
}

/** A mask's own grade: its light and colour, with no curves and no colour bands. Exposure ±100 is ±2 stops, temperature ±100 about ±3,000 K. */
export function gradeOfMask(a: MaskGrade): GradeP {
  return {
    gain: exposureGain((a.exposure / 100) * 2),
    wb: wbGains(NEUTRAL_K + a.temp * 30, a.tint),
    contrast: a.contrast / 100,
    highlights: a.highlights / 100,
    shadows: a.shadows / 100,
    whites: 0,
    blacks: 0,
    vibrance: a.vibrance / 100,
    saturation: a.saturation / 100,
    hsl: null,
    curves: null,
  };
}

export const isIdentityGrade = (p: GradeP): boolean =>
  p.gain === 1 && p.wb[0] === 1 && p.wb[1] === 1 && p.wb[2] === 1 && !p.contrast && !p.highlights && !p.shadows && !p.whites && !p.blacks && !p.vibrance && !p.saturation && !p.hsl && !p.curves;

/** The tones: shadows and highlights lift or pull by how dark or light the pixel is, whites and blacks move the two ends, contrast turns about the middle. */
export function tones(g: RGB, p: GradeP): RGB {
  const L = luma(g);
  const ws = 1 - smoothstep(0.05, 0.65, L);
  const wh = smoothstep(0.35, 0.95, L);
  const gain = Math.pow(2, p.shadows * 0.9 * ws + p.highlights * 0.9 * wh);
  const white = 1 + p.whites * 0.25 * smoothstep(0.55, 1, L);
  const black = p.blacks * 0.15 * (1 - smoothstep(0, 0.35, L));
  const cf = 1 + p.contrast * 0.8;
  const out: RGB = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    let v = g[i]! * gain * white + black;
    v = (v - 0.5) * cf + 0.5;
    out[i] = v;
  }
  return out;
}

/** The colour: the eight bands (hue, colour, light), then vibrance (the dull colours more than the strong) and colour. */
export function colour(g: RGB, p: GradeP): RGB {
  if (!p.hsl && !p.vibrance && !p.saturation) return g;
  let [h, s, l] = rgbToHsl(g) as RGB;
  if (p.hsl) {
    const w = hslWeights(h);
    let dh = 0;
    let ds = 0;
    let dl = 0;
    for (let i = 0; i < 8; i++) {
      dh += w[i]! * p.hsl[i * 3]!;
      ds += w[i]! * p.hsl[i * 3 + 1]!;
      dl += w[i]! * p.hsl[i * 3 + 2]!;
    }
    h += dh * 30;
    s = clamp(s * (1 + ds));
    l = clamp(l + dl * 0.25 * Math.min(1, s * 2));
  }
  if (p.vibrance) s = clamp(p.vibrance > 0 ? s + p.vibrance * (1 - s) * (1 - s) : s * (1 + p.vibrance));
  if (p.saturation) s = clamp(s * (1 + p.saturation));
  return hslToRgb([h, s, l]);
}

/** One pixel through a grade: encoded in, encoded out. */
export function grade(c: RGB, p: GradeP): RGB {
  let r = srgbToLin(c[0]) * p.gain * p.wb[0];
  let g = srgbToLin(c[1]) * p.gain * p.wb[1];
  let b = srgbToLin(c[2]) * p.gain * p.wb[2];
  r = linToSrgb(Math.max(0, r));
  g = linToSrgb(Math.max(0, g));
  b = linToSrgb(Math.max(0, b));
  let v: RGB = tones([r, g, b], p);
  v = [clamp(v[0]), clamp(v[1]), clamp(v[2])];
  if (p.curves) {
    const k = p.curves;
    v = [curveAt(k.r, curveAt(k.l, v[0])), curveAt(k.g, curveAt(k.l, v[1])), curveAt(k.b, curveAt(k.l, v[2]))];
  }
  v = colour(v, p);
  return [clamp(v[0]), clamp(v[1]), clamp(v[2])];
}

// ------------------------------------------------------------------ blends, detail, effects

export type BlendId = 0 | 1 | 2 | 3 | 4;
export const BLEND_ID: Record<string, BlendId> = { normal: 0, multiply: 1, screen: 2, overlay: 3, softlight: 4 };

/** A layer's colour over the base (both encoded 0..1), by blend. */
export function blend(b: number, s: number, mode: number): number {
  switch (mode) {
    case 1:
      return b * s;
    case 2:
      return 1 - (1 - b) * (1 - s);
    case 3:
      return b < 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s);
    case 4:
      return (1 - 2 * s) * b * b + 2 * s * b;
    default:
      return s;
  }
}

/** The weights of a Gaussian blur of `sigma` px: its half width and the taps from the middle out, adding to one. */
export function blurTaps(sigma: number): { n: number; w: number[] } {
  const s = Math.max(0.3, sigma);
  const n = Math.min(6, Math.max(1, Math.ceil(s * 2)));
  const w: number[] = [];
  let sum = 0;
  for (let i = 0; i <= n; i++) {
    const v = Math.exp(-(i * i) / (2 * s * s));
    w.push(v);
    sum += i === 0 ? v : 2 * v;
  }
  return { n, w: w.map((v) => v / sum) };
}

/** The sigma of the unsharp mask's blur and of the edge-keeping denoise, for the slider's radius, at the picture's drawn scale (1 = the file's own pixels). */
export const unsharpSigma = (radius: number, scale: number): number => Math.max(0.6, radius * scale);
export const denoiseRange = (strength: number): number => 0.02 + 0.22 * strength;

/** Unsharp: the picture plus its difference from its blur, only where that difference is past the threshold. */
export function unsharp(c: RGB, blurred: RGB, amount: number, threshold: number): RGB {
  const d: RGB = [c[0] - blurred[0], c[1] - blurred[1], c[2] - blurred[2]];
  const dl = Math.abs(luma(d));
  const t = threshold / 255;
  const m = t > 0 ? clamp((dl - t) / (t * 0.5 + 1e-4)) : 1;
  const k = amount * 2 * m;
  return [clamp(c[0] + d[0] * k), clamp(c[1] + d[1] * k), clamp(c[2] + d[2] * k)];
}

/** The integer hash the grain and the specs share: the same on the GPU (uint) and here (Math.imul). Returns 0..1. */
export function hash01(x: number, y: number, seed: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967295;
}

/** The vignette's multiplier at distance d from the middle (0 at the centre, 1 at a corner): 0 at the centre, so the middle is never touched. */
export const vignetteAmount = (d: number): number => smoothstep(0.35, 1, d);
export function vignette(c: RGB, d: number, amount: number): RGB {
  const s = vignetteAmount(d);
  return amount >= 0 ? [c[0] * (1 - amount * s), c[1] * (1 - amount * s), c[2] * (1 - amount * s)] : [c[0] + (1 - c[0]) * -amount * s, c[1] + (1 - c[1]) * -amount * s, c[2] + (1 - c[2]) * -amount * s];
}

/** The effects, in order: the fade, the vignette, the grain. `d` is the distance from the picture's middle (0..1), (gx, gy) the grain's lattice cell. */
export function effects(c: RGB, e: { vignette: number; grain: number; fade: number; seed: number }, d: number, gx: number, gy: number): RGB {
  let v: RGB = c;
  if (e.fade) v = [v[0] * (1 - e.fade * 0.6) + e.fade * 0.14, v[1] * (1 - e.fade * 0.6) + e.fade * 0.14, v[2] * (1 - e.fade * 0.6) + e.fade * 0.14];
  if (e.vignette) v = vignette(v, d, e.vignette);
  if (e.grain) {
    const n = hash01(gx, gy, e.seed) - 0.5;
    const L = luma(v);
    const k = n * e.grain * 0.3 * (1 - 0.5 * Math.abs(2 * L - 1));
    v = [v[0] + k, v[1] + k, v[2] + k];
  }
  return [clamp(v[0]), clamp(v[1]), clamp(v[2])];
}

/** The grain lattice's cells across the long side: size 1..100 is fine to coarse. */
export const grainCells = (size: number, longSide: number): number => Math.max(64, Math.round(Math.min(longSide, 2400) / (0.6 + size / 25)));

// ------------------------------------------------------------------ the geometry: output picture → the original

export interface Geo {
  crop: Crop;
  /** The perspective as a 3 × 3 homography (row-major) taking the frame's unit square to the pulled quad, or null. */
  h: number[] | null;
  /** The lens's barrel, -1..1. */
  k1: number;
  /** The original's size. */
  w: number;
  hh: number;
}

/** The homography taking the unit square to the quad (x_i + dx_i, y_i + dy_i) (Heckbert's square-to-quad). */
export function squareToQuad(q: [number, number][]): number[] {
  const [p0, p1, p2, p3] = q as [[number, number], [number, number], [number, number], [number, number]];
  const dx1 = p1[0] - p2[0];
  const dx2 = p3[0] - p2[0];
  const sx = p0[0] - p1[0] + p2[0] - p3[0];
  const dy1 = p1[1] - p2[1];
  const dy2 = p3[1] - p2[1];
  const sy = p0[1] - p1[1] + p2[1] - p3[1];
  const den = dx1 * dy2 - dx2 * dy1;
  const g = den === 0 ? 0 : (sx * dy2 - dx2 * sy) / den;
  const hh = den === 0 ? 0 : (dx1 * sy - sx * dy1) / den;
  return [p1[0] - p0[0] + g * p1[0], p3[0] - p0[0] + hh * p3[0], p0[0], p1[1] - p0[1] + g * p1[1], p3[1] - p0[1] + hh * p3[1], p0[1], g, hh, 1];
}

/** The perspective's homography for four pulled corners (each a [dx, dy] in the frame's fraction), or null when nothing is pulled. */
export function perspective(pull: [number, number][]): number[] | null {
  if (pull.every((p) => !p[0] && !p[1])) return null;
  const base: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
  return squareToQuad(base.map((b, i) => [b[0] + pull[i]![0], b[1] + pull[i]![1]] as [number, number]));
}

/**
 * A point of the output picture (u, v in 0..1) to the original's frame (0..1 across and down). The chain, as the shader runs it: the flip,
 * the crop into the quarter-turned frame, the straighten about its middle, the perspective, the lens, then the quarter turn back.
 */
export function mapOut(u: number, v: number, g: Geo): Pt {
  const { crop } = g;
  const q = crop.quarter % 2;
  const fw = q ? g.hh : g.w;
  const fh = q ? g.w : g.hh;
  const uu = crop.flip ? 1 - u : u;
  // the crop, in the frame's pixels about its middle
  let x = (crop.x + uu * crop.w - 0.5) * fw;
  let y = (crop.y + v * crop.h - 0.5) * fh;
  // the straighten: the picture is turned by -angle to level it, so the sample is turned by +angle
  const a = (crop.angle * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  [x, y] = [x * ca - y * sa, x * sa + y * ca];
  let fx = x / fw + 0.5;
  let fy = y / fh + 0.5;
  if (g.h) {
    const h = g.h;
    const d = h[6]! * fx + h[7]! * fy + h[8]!;
    [fx, fy] = [(h[0]! * fx + h[1]! * fy + h[2]!) / d, (h[3]! * fx + h[4]! * fy + h[5]!) / d];
  }
  if (g.k1) {
    const dx = (fx - 0.5) * fw;
    const dy = (fy - 0.5) * fh;
    const r2 = (dx * dx + dy * dy) / ((fw * fw + fh * fh) / 4);
    const s = 1 + g.k1 * r2;
    fx = 0.5 + (dx * s) / fw;
    fy = 0.5 + (dy * s) / fh;
  }
  // the frame back to the original: a quarter turn clockwise puts the original's left edge on the frame's top
  switch (((crop.quarter % 4) + 4) % 4) {
    case 1:
      return { x: fy, y: 1 - fx };
    case 2:
      return { x: 1 - fx, y: 1 - fy };
    case 3:
      return { x: 1 - fy, y: fx };
    default:
      return { x: fx, y: fy };
  }
}

/** The original's point to the output picture, by search from the forward map (a handle drawn where a mask or a heal sits). */
export function mapIn(p: Pt, g: Geo): Pt {
  let u = 0.5;
  let v = 0.5;
  const e = 1e-3;
  for (let i = 0; i < 12; i++) {
    const m = mapOut(u, v, g);
    const mu = mapOut(u + e, v, g);
    const mv = mapOut(u, v + e, g);
    const a = (mu.x - m.x) / e;
    const b = (mv.x - m.x) / e;
    const c = (mu.y - m.y) / e;
    const d = (mv.y - m.y) / e;
    const det = a * d - b * c;
    if (Math.abs(det) < 1e-9) break;
    const rx = p.x - m.x;
    const ry = p.y - m.y;
    u += (d * rx - b * ry) / det;
    v += (-c * rx + a * ry) / det;
  }
  return { x: u, y: v };
}

// ------------------------------------------------------------------ masks (shape, in the original's frame)

/** The mask's value 0..1 at a point of the original, for the shapes (a brush's and the subject's come from their alpha picture). */
export function maskShape(kind: 'linear' | 'radial', m: { a: Pt; b: Pt; c: Pt; rx: number; ry: number; angle: number; feather: number; invert: boolean }, p: Pt, w: number, h: number): number {
  let v: number;
  if (kind === 'linear') {
    const ax = m.a.x * w;
    const ay = m.a.y * h;
    const bx = m.b.x * w - ax;
    const by = m.b.y * h - ay;
    const t = ((p.x * w - ax) * bx + (p.y * h - ay) * by) / Math.max(1e-6, bx * bx + by * by);
    v = 1 - smoothstep(0, 1, t);
  } else {
    const L = Math.max(w, h);
    const dx = p.x * w - m.c.x * w;
    const dy = p.y * h - m.c.y * h;
    const a = (m.angle * Math.PI) / 180;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const ux = (dx * ca + dy * sa) / Math.max(1e-6, m.rx * L);
    const uy = (-dx * sa + dy * ca) / Math.max(1e-6, m.ry * L);
    const d = Math.sqrt(ux * ux + uy * uy);
    v = 1 - smoothstep(1 - Math.max(0.02, m.feather), 1, d);
  }
  return m.invert ? 1 - v : v;
}
