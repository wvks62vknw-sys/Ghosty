/**
 * THE SLOW WAY (BRIEF-EDITOR-PHOTO): the same maths as the WebGL pipeline (photo/math.ts is shared), run over pixels in plain code. It is
 * what draws the picture when WebGL2 is missing or lost ("Drawing this the slow way…"), and the reference the spec holds the GPU to: the
 * two agree within one unit per channel. Pure over arrays: no DOM, so the brain test draws a tiny picture with it and checks the pixels
 * against ones worked out by hand.
 *
 * Passes, as the shader's: the sample (the geometry, then the heals), the global grade, each mask's grade, the layer; then the
 * edge-keeping denoise and the unsharp mask over a halo of pixels; then the effects.
 */
import { alphaAt, getAlpha } from './alpha';
import {
  BLEND_ID, blend, blurTaps, clamp, denoiseRange, effects as fx, gradeOfLight, gradeOfMask, grade, grainCells, isIdentityGrade, maskShape, mapOut, mix, perspective, unsharp, unsharpSigma,
  type Geo, type RGB,
} from './math';
import type { Mask, Recipe } from './recipe';

export interface Src {
  w: number;
  h: number;
  /** RGBA, 8 bits. */
  data: ArrayLike<number>;
}

export interface CpuJob {
  src: Src;
  recipe: Recipe;
  layer?: Src | null;
  /** The drawn picture's size (the whole of it, whatever part is asked for). */
  outW: number;
  outH: number;
  /** The width the picture would have at export: the detail's radius scales by outW / fullW. Default outW. */
  fullW?: number;
  /** The part to draw (default all): x, y, w, h in the drawn picture's pixels. */
  region?: { x: number; y: number; w: number; h: number };
}

export const HALO = 8;

const fetchPx = (s: Src, x: number, y: number): RGB => {
  const i = (Math.min(s.h - 1, Math.max(0, y)) * s.w + Math.min(s.w - 1, Math.max(0, x))) * 4;
  return [s.data[i]! / 255, s.data[i + 1]! / 255, s.data[i + 2]! / 255];
};
/** A bilinear sample at (u, v) in 0..1, between the texel centres, the edge held: the shader's own texelFetch blend. */
export function bilinear(s: Src, u: number, v: number): RGB {
  const x = u * s.w - 0.5;
  const y = v * s.h - 0.5;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx0 = x - x0;
  const fy0 = y - y0;
  const a = fetchPx(s, x0, y0);
  const b = fetchPx(s, x0 + 1, y0);
  const c = fetchPx(s, x0, y0 + 1);
  const d = fetchPx(s, x0 + 1, y0 + 1);
  const o: RGB = [0, 0, 0];
  for (let i = 0; i < 3; i++) o[i] = mix(mix(a[i]!, b[i]!, fx0), mix(c[i]!, d[i]!, fx0), fy0);
  return o;
}

/** The geometry a recipe asks for, over an original of w × h. */
export const geoOf = (r: Recipe, w: number, h: number): Geo => ({ crop: r.crop, h: perspective(r.persp), k1: r.lens / 100, w, hh: h });

/** A mask's value at a point of the original (the shapes from their maths, a brush's and the subject's from their alpha picture). */
export function maskAt(m: Mask, px: number, py: number, w: number, h: number): number {
  if (m.kind === 'brush' || m.kind === 'subject') {
    const a = m.alpha ? getAlpha(m.alpha) : null;
    const v = a ? alphaAt(a, px, py) : 0;
    return m.invert ? 1 - v : v;
  }
  return maskShape(m.kind, m, { x: px, y: py }, w, h);
}

/** The drawn picture's pixels for a part of it (RGBA, 8 bits). */
export function renderCpu(job: CpuJob): Uint8ClampedArray {
  const { src, recipe: r, outW, outH } = job;
  const full = job.region ?? { x: 0, y: 0, w: outW, h: outH };
  const fullW = job.fullW ?? outW;
  const geo = geoOf(r, src.w, src.h);
  const gl = gradeOfLight(r.light, r.wb, r.color, r.curves);
  const masks = r.masks.map((m) => ({ m, g: gradeOfMask(m.adj) })).filter((x) => !isIdentityGrade(x.g));
  const lay = r.layer && job.layer ? r.layer : null;
  const detail = r.detail;
  const needBlur = detail.amount > 0 || detail.noise > 0;
  const halo = needBlur ? HALO : 0;
  const rx0 = Math.max(0, full.x - halo);
  const ry0 = Math.max(0, full.y - halo);
  const rx1 = Math.min(outW, full.x + full.w + halo);
  const ry1 = Math.min(outH, full.y + full.h + halo);
  const aw = rx1 - rx0;
  const ah = ry1 - ry0;
  const stage = new Float32Array(aw * ah * 3);
  const L = Math.max(src.w, src.h);
  const outAspect = outW / outH;
  const layAspect = job.layer ? job.layer.w / job.layer.h : 1;
  const lsx = layAspect > outAspect ? outAspect / layAspect : 1;
  const lsy = layAspect > outAspect ? 1 : layAspect / outAspect;

  for (let y = 0; y < ah; y++) {
    for (let x = 0; x < aw; x++) {
      const u = (rx0 + x + 0.5) / outW;
      const v = (ry0 + y + 0.5) / outH;
      const p = mapOut(u, v, geo);
      let c = bilinear(src, p.x, p.y);
      for (const h of r.heals) {
        const d = Math.hypot((p.x - h.x) * src.w, (p.y - h.y) * src.h) / Math.max(1e-6, h.r * L);
        if (d < 1) {
          const wgt = 1 - clamp((d - (1 - Math.max(0.02, h.feather))) / Math.max(0.02, h.feather));
          const wsm = wgt * wgt * (3 - 2 * wgt);
          const s2 = bilinear(src, p.x + h.dx, p.y + h.dy);
          c = [mix(c[0], s2[0], wsm), mix(c[1], s2[1], wsm), mix(c[2], s2[2], wsm)];
        }
      }
      let o = grade(c, gl);
      for (const { m, g } of masks) {
        const k = maskAt(m, p.x, p.y, src.w, src.h);
        if (k > 0) {
          const t = grade(o, g);
          o = [mix(o[0], t[0], k), mix(o[1], t[1], k), mix(o[2], t[2], k)];
        }
      }
      if (lay && job.layer) {
        const s2 = bilinear(job.layer, 0.5 + (u - 0.5) * lsx, 0.5 + (v - 0.5) * lsy);
        const mode = BLEND_ID[lay.blend] ?? 0;
        const k = (lay.opacity / 100) * (lay.mask ? maskAt(lay.mask, p.x, p.y, src.w, src.h) : 1);
        o = [mix(o[0], blend(o[0], s2[0], mode), k), mix(o[1], blend(o[1], s2[1], mode), k), mix(o[2], blend(o[2], s2[2], mode), k)];
      }
      const i = (y * aw + x) * 3;
      stage[i] = o[0];
      stage[i + 1] = o[1];
      stage[i + 2] = o[2];
    }
  }

  const at = (buf: Float32Array, x: number, y: number): RGB => {
    const i = (Math.min(ah - 1, Math.max(0, y)) * aw + Math.min(aw - 1, Math.max(0, x))) * 3;
    return [buf[i]!, buf[i + 1]!, buf[i + 2]!];
  };
  const scale = outW / fullW;
  let cur = stage;
  if (detail.noise > 0) {
    const sr = denoiseRange(detail.noise / 100);
    const out = new Float32Array(stage.length);
    for (let y = 0; y < ah; y++)
      for (let x = 0; x < aw; x++) {
        const c = at(stage, x, y);
        let sum: RGB = [0, 0, 0];
        let ws = 0;
        for (let j = -2; j <= 2; j++)
          for (let i = -2; i <= 2; i++) {
            const n = at(stage, x + i, y + j);
            const d2 = (n[0] - c[0]) ** 2 + (n[1] - c[1]) ** 2 + (n[2] - c[2]) ** 2;
            const w = Math.exp(-(i * i + j * j) / 2) * Math.exp(-d2 / (2 * sr * sr));
            sum = [sum[0] + n[0] * w, sum[1] + n[1] * w, sum[2] + n[2] * w];
            ws += w;
          }
        const k = (y * aw + x) * 3;
        out[k] = sum[0] / ws;
        out[k + 1] = sum[1] / ws;
        out[k + 2] = sum[2] / ws;
      }
    cur = out;
  }
  let blurred: Float32Array | null = null;
  if (detail.amount > 0) {
    const { n, w } = blurTaps(unsharpSigma(detail.radius, scale));
    const tmp = new Float32Array(cur.length);
    blurred = new Float32Array(cur.length);
    for (let y = 0; y < ah; y++)
      for (let x = 0; x < aw; x++) {
        const acc: RGB = [0, 0, 0];
        for (let i = -n; i <= n; i++) {
          const s = at(cur, x + i, y);
          const k = w[Math.abs(i)]!;
          acc[0] += s[0] * k;
          acc[1] += s[1] * k;
          acc[2] += s[2] * k;
        }
        const j = (y * aw + x) * 3;
        tmp[j] = acc[0];
        tmp[j + 1] = acc[1];
        tmp[j + 2] = acc[2];
      }
    for (let y = 0; y < ah; y++)
      for (let x = 0; x < aw; x++) {
        const acc: RGB = [0, 0, 0];
        for (let i = -n; i <= n; i++) {
          const s = at(tmp, x, y + i);
          const k = w[Math.abs(i)]!;
          acc[0] += s[0] * k;
          acc[1] += s[1] * k;
          acc[2] += s[2] * k;
        }
        const j = (y * aw + x) * 3;
        blurred[j] = acc[0];
        blurred[j + 1] = acc[1];
        blurred[j + 2] = acc[2];
      }
  }

  const out = new Uint8ClampedArray(full.w * full.h * 4);
  const e = r.effects;
  const cells = grainCells(e.grainSize, Math.max(outW, outH));
  const cellsY = cells * (outH / outW);
  const half = Math.hypot(outW, outH) / 2;
  for (let y = 0; y < full.h; y++) {
    for (let x = 0; x < full.w; x++) {
      const gx = full.x + x;
      const gy = full.y + y;
      let c = at(cur, gx - rx0, gy - ry0);
      if (blurred) c = unsharp(c, at(blurred, gx - rx0, gy - ry0), detail.amount / 100, detail.threshold);
      const u = (gx + 0.5) / outW;
      const v = (gy + 0.5) / outH;
      const d = Math.hypot(gx + 0.5 - outW / 2, gy + 0.5 - outH / 2) / half;
      c = fx(c, e, d, Math.floor(u * cells), Math.floor(v * cellsY));
      const i = (y * full.w + x) * 4;
      out[i] = Math.round(clamp(c[0]) * 255);
      out[i + 1] = Math.round(clamp(c[1]) * 255);
      out[i + 2] = Math.round(clamp(c[2]) * 255);
      out[i + 3] = 255;
    }
  }
  return out;
}

