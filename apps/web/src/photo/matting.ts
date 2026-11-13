/**
 * THE CUT-OUT (BRIEF-EDITOR-PHOTO-2; PHOTO · SUBJECT): the cut-out model (a small salient-object model, offline/eyes.ts EYES_CUTOUT, kept on
 * the phone on his tap) run in a worker over a 320 × 320 letterboxed copy of the photo; its soft mask is brought up to the photo's own
 * edges by the app's guided upsample (photo/alpha.ts) and written into the recipe's SUBJECT mask exactly as the first cut is (subject.ts),
 * so every tool that takes a mask takes it. No face is looked for, none is named: a cut-out is a shape. Nothing leaves the phone.
 */
import { alphaSizeFor, guidedUpsample, letterbox, planeToAlpha, unletterbox, type Alpha, type Plane } from './alpha';
import { smoothstep } from './math';
import { ModelWorker, type ModelCfg } from './model';
import { CUTOUT } from '../offline/eyesfiles';

export const CUTOUT_CFG: ModelCfg = {
  name: 'the cut-out model',
  worker: '/vendor/cutout/worker.mjs',
  parts: ['/vendor/cutout/cutout.v1.onnx'],
  bytes: CUTOUT.find(([u]) => u.endsWith('.onnx'))![1],
};
export const cutoutModel = new ModelWorker(CUTOUT_CFG);
/** The model's side, in pixels. */
export const CUT_SIDE = 320;

/** What the tray says it made. */
export const CUT_FROM_MODEL = 'From the cut-out model: paint to fix it.';
export const CUT_FROM_DEPTH = 'A first cut from depth: paint to fix it.';

/** The model's mean and spread per channel (the picture is first divided by its own largest value). */
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

/** The input tensor (1 × 3 × N × N) for N × N RGBA pixels. Pure. */
export function toInput(rgba: Uint8ClampedArray | Uint8Array, n: number): Float32Array {
  let max = 1e-6;
  for (let i = 0; i < n * n; i++) max = Math.max(max, rgba[i * 4] ?? 0, rgba[i * 4 + 1] ?? 0, rgba[i * 4 + 2] ?? 0);
  const inv = 1 / max;
  const out = new Float32Array(3 * n * n);
  for (let c = 0; c < 3; c++) {
    const mean = MEAN[c] ?? 0;
    const spread = 1 / (STD[c] ?? 1);
    for (let i = 0; i < n * n; i++) out[c * n * n + i] = ((rgba[i * 4 + c] ?? 0) * inv - mean) * spread;
  }
  return out;
}

/** The model's map stretched to 0..1 (its smallest to its largest), then a little crisper in the middle. Pure. */
export function toPlane(out: Float32Array, n: number): Plane {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < n * n; i++) {
    lo = Math.min(lo, out[i]!);
    hi = Math.max(hi, out[i]!);
  }
  const span = Math.max(1e-6, hi - lo);
  const data = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) data[i] = (out[i]! - lo) / span;
  return { w: n, h: n, data };
}

/** The photo's brightness at a given size (0..1), the guide for the upsample. */
export function lumaPlane(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): Plane {
  const data = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) data[i] = (0.2126 * rgba[i * 4]! + 0.7152 * rgba[i * 4 + 1]! + 0.0722 * rgba[i * 4 + 2]!) / 255;
  return { w, h, data };
}

/** The model's map for a photo of picW × picH, brought up to the brush picture's size along the photo's own edges. Pure. */
export function maskFromModel(out: Float32Array, picW: number, picH: number, guide: Plane): Alpha {
  const sq = toPlane(out, CUT_SIDE);
  const r = letterbox(picW, picH, CUT_SIDE);
  const low = unletterbox(sq, picW, picH, r.w, r.h);
  const up = guidedUpsample(low, guide);
  for (let i = 0; i < up.data.length; i++) up.data[i] = smoothstep(0.12, 0.88, up.data[i]!);
  return planeToAlpha(up);
}

/** The cut of a photo (a canvas at its full size): the brush picture in the original's frame. `step` says each wait. */
export async function cutWithModel(canvas: HTMLCanvasElement, step: (words: string, frac?: number) => void): Promise<{ alpha: Alpha; ms: number }> {
  const t0 = performance.now();
  try {
    await cutoutModel.load(step);
    const { w, h } = alphaSizeFor(canvas.width, canvas.height);
    const sq = document.createElement('canvas');
    sq.width = CUT_SIDE;
    sq.height = CUT_SIDE;
    const g = sq.getContext('2d', { willReadFrequently: true })!;
    g.fillStyle = '#7f7f7f';
    g.fillRect(0, 0, CUT_SIDE, CUT_SIDE);
    const r = letterbox(canvas.width, canvas.height, CUT_SIDE);
    g.imageSmoothingQuality = 'high';
    g.drawImage(canvas, r.x, r.y, r.w, r.h);
    const px = g.getImageData(0, 0, CUT_SIDE, CUT_SIDE).data;
    step('Cutting it out…');
    const res = await cutoutModel.run({ 'input.1': { data: toInput(px, CUT_SIDE), dims: [1, 3, CUT_SIDE, CUT_SIDE] } });
    const small = document.createElement('canvas');
    small.width = w;
    small.height = h;
    const sg = small.getContext('2d', { willReadFrequently: true })!;
    sg.imageSmoothingQuality = 'high';
    sg.drawImage(canvas, 0, 0, w, h);
    const guide = lumaPlane(sg.getImageData(0, 0, w, h).data, w, h);
    return { alpha: maskFromModel(res.data, canvas.width, canvas.height, guide), ms: performance.now() - t0 };
  } finally {
    cutoutModel.release();
  }
}
