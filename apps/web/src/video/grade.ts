/**
 * THE GRADE (BRIEF-EDITOR-VIDEO): the picture's light, white balance, curve and colour as pure functions the layer shader repeats
 * line for line, so the brain test proves the numbers and the screen agrees with them. These six are the PHOTO editor's
 * maths (photo/math.ts, builder/photoedit: exposure, white balance, tone, the monotone curve, saturation, vibrance), copied
 * here with their names so that the PHOTO landing can replace this file's six by one import and delete the copies.
 */
import type { Grade } from './model';

export type RGB = [number, number, number];
const GAMMA = 2.2;
const LUMA: RGB = [0.2126, 0.7152, 0.0722];
const c01 = (x: number) => Math.min(1, Math.max(0, x));
export const luma = (c: RGB): number => c[0] * LUMA[0] + c[1] * LUMA[1] + c[2] * LUMA[2];

/** 1. Exposure: a stop doubles the light (in linear light, so the shadows do not clip first). */
export const exposureGain = (stops: number): number => Math.pow(2, stops);

/** 2. White balance as three multipliers: warmer lifts red and drops blue; tint moves green against magenta. */
export const whiteBalance = (temp: number, tint: number): RGB => [1 + 0.3 * temp, 1 - 0.2 * tint, 1 - 0.3 * temp];

/** 3. Tone: contrast about the middle, highlights and shadows by how bright the pixel is, then white and black points. */
export function tone(c: RGB, g: Pick<Grade, 'contrast' | 'highlights' | 'shadows' | 'whites' | 'blacks'>): RGB {
  const l = luma(c);
  const lo = -0.1 * g.blacks;
  const hi = 1 - 0.1 * g.whites;
  const lift = 0.25 * (g.shadows * (1 - l) * (1 - l) + g.highlights * l * l);
  return c.map((v) => {
    let x = (v - 0.5) * (1 + g.contrast) + 0.5 + lift;
    x = (x - lo) / (hi - lo);
    return x;
  }) as RGB;
}

/** 4. A curve through its points, monotone (no overshoot between them): 256 samples from 0 to 1. */
export function monotoneCurve(points: [number, number][], n = 256): Float32Array {
  const p = [...points].sort((a, b) => a[0] - b[0]);
  const out = new Float32Array(n);
  if (p.length < 2) {
    for (let i = 0; i < n; i++) out[i] = i / (n - 1);
    return out;
  }
  const xs = p.map((q) => q[0]);
  const ys = p.map((q) => q[1]);
  const m = xs.length - 1;
  const d: number[] = [];
  for (let i = 0; i < m; i++) d.push((ys[i + 1]! - ys[i]!) / Math.max(1e-6, xs[i + 1]! - xs[i]!));
  const t: number[] = [d[0]!];
  for (let i = 1; i < m; i++) t.push(d[i - 1]! * d[i]! <= 0 ? 0 : (d[i - 1]! + d[i]!) / 2);
  t.push(d[m - 1]!);
  for (let i = 0; i < m; i++) {
    if (d[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i]! / d[i]!;
    const b = t[i + 1]! / d[i]!;
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      t[i] = k * a * d[i]!;
      t[i + 1] = k * b * d[i]!;
    }
  }
  for (let j = 0; j < n; j++) {
    const x = j / (n - 1);
    if (x <= xs[0]!) {
      out[j] = ys[0]!;
      continue;
    }
    if (x >= xs[m]!) {
      out[j] = ys[m]!;
      continue;
    }
    let i = 0;
    while (i < m - 1 && x > xs[i + 1]!) i++;
    const h = xs[i + 1]! - xs[i]!;
    const u = (x - xs[i]!) / h;
    const h00 = 2 * u * u * u - 3 * u * u + 1;
    const h10 = u * u * u - 2 * u * u + u;
    const h01 = -2 * u * u * u + 3 * u * u;
    const h11 = u * u * u - u * u;
    out[j] = c01(h00 * ys[i]! + h10 * h * t[i]! + h01 * ys[i + 1]! + h11 * h * t[i + 1]!);
  }
  return out;
}
const curveAt = (tab: Float32Array, x: number): number => {
  const f = c01(x) * (tab.length - 1);
  const i = Math.floor(f);
  const j = Math.min(tab.length - 1, i + 1);
  return tab[i]! + (tab[j]! - tab[i]!) * (f - i);
};

/** 5. Saturation: each channel moved away from (or toward) the pixel's grey. */
export function saturation(c: RGB, s: number): RGB {
  const l = luma(c);
  return c.map((v) => l + (v - l) * (1 + s)) as RGB;
}
/** 6. Vibrance: saturation that leaves the already vivid colours alone. */
export function vibrance(c: RGB, v: number): RGB {
  const l = luma(c);
  const sat = Math.max(...c) - Math.min(...c);
  return c.map((x) => l + (x - l) * (1 + v * (1 - sat))) as RGB;
}

/** One pixel through the whole grade, in the order the layer shader does it (the curve table is made once per grade). */
export function gradePixel(c: RGB, g: Grade, tab?: Float32Array): RGB {
  const wb = whiteBalance(g.temp, g.tint);
  const k = exposureGain(g.exposure);
  let x = c.map((v, i) => Math.pow(c01(Math.pow(c01(v), GAMMA) * k * wb[i]!), 1 / GAMMA)) as RGB;
  x = tone(x, g).map(c01) as RGB;
  const t = tab ?? monotoneCurve(g.curve);
  x = x.map((v) => curveAt(t, v)) as RGB;
  x = saturation(x, g.saturation).map(c01) as RGB;
  x = vibrance(x, g.vibrance).map(c01) as RGB;
  return x;
}
