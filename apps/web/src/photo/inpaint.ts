/**
 * THE ERASE (BRIEF-EDITOR-PHOTO-2; PHOTO · ERASE): the erase model (offline/eyes.ts EYES_ERASE, kept on the phone on his tap) run in a worker
 * over a crop around the hole at the model's size (512 × 512; tiled where the hole is bigger, each tile seeing what the ones before it made;
 * photo/tiles.ts), the result feathered back and kept as a heal layer in the recipe (a `patches` entry and its picture, photo/patch.ts), so
 * it is undoable, never touches the original, and exports at full size through the tiled path. The hole is a brush's picture or the SUBJECT
 * mask. The model fills what is painted: it never looks for a face and names nothing; the photo never leaves the phone.
 */
import { alphaAt, type Alpha } from './alpha';
import { ModelWorker, type ModelCfg } from './model';
import { putPatch } from './patch';
import type { Patch } from './recipe';
import { coreWeight, dilate, FEATHER, GROW, holeBounds, MODEL_SIDE, planErase, soften, waitSeconds } from './tiles';
import { ERASE } from '../offline/eyesfiles';

const PARTS = ERASE.filter(([u]) => u.includes('.part'));
export const ERASE_CFG: ModelCfg = {
  name: 'the erase model',
  worker: '/vendor/erase/worker.mjs',
  parts: PARTS.map(([u]) => u),
  bytes: PARTS.reduce((n, [, b]) => n + b, 0),
};
export const eraseModel = new ModelWorker(ERASE_CFG);

const MS_KEY = 'ghosty.photo.erase.ms';
/** How long one run took the last time on this phone (a first guess until it has run once). */
export function lastRunMs(): number {
  try {
    const v = Number(localStorage.getItem(MS_KEY));
    return v > 500 ? v : 25000;
  } catch {
    return 25000;
  }
}
function rememberRun(ms: number): void {
  try {
    localStorage.setItem(MS_KEY, String(Math.round(ms)));
  } catch {
    /* the guess stays a guess */
  }
}

/** What the wait says before it starts: how many runs and about how long ("Erasing… about 25 s"). */
export function erasePlanWords(hole: Alpha, w: number, h: number): { tiles: number; seconds: number; line: string } | null {
  const hb = holeBounds(hole.data, hole.w, hole.h, 40);
  if (!hb) return null;
  const sx = w / hole.w;
  const sy = h / hole.h;
  const plan = planErase({ x: Math.floor(hb.x * sx), y: Math.floor(hb.y * sy), w: Math.ceil(hb.w * sx) + 1, h: Math.ceil(hb.h * sy) + 1 }, w, h);
  const seconds = waitSeconds(plan.tiles.length, lastRunMs());
  return { tiles: plan.tiles.length, seconds, line: `Erasing… about ${seconds} s${plan.tiles.length > 1 ? ` (${plan.tiles.length} parts)` : ''}` };
}

const canvas2d = (w: number, h: number, read = false): [HTMLCanvasElement, CanvasRenderingContext2D] => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return [c, c.getContext('2d', { willReadFrequently: read })!];
};

export interface Erased {
  /** The recipe's entry for it (its picture is in the bank under `patch.id`). */
  patch: Patch;
  ms: number;
  tiles: number;
}

/**
 * Fill the hole in a photo (`src`, the working picture at its full size, patches already in it): the patch to add to the recipe.
 * `step` says each wait and how far along it is.
 */
export async function eraseHole(src: HTMLCanvasElement, hole: Alpha, step: (words: string, frac?: number) => void): Promise<Erased> {
  const W = src.width;
  const H = src.height;
  const hb = holeBounds(hole.data, hole.w, hole.h, 40);
  if (!hb) throw new Error('Paint over what to take away first.');
  const sx = W / hole.w;
  const sy = H / hole.h;
  const bx = Math.max(0, Math.floor(hb.x * sx));
  const by = Math.max(0, Math.floor(hb.y * sy));
  const plan = planErase({ x: bx, y: by, w: Math.min(W - bx, Math.ceil(hb.w * sx) + 1), h: Math.min(H - by, Math.ceil(hb.h * sy) + 1) }, W, H);
  const k = plan.k;
  const pb = plan.patch;
  const pw = Math.max(1, Math.ceil(pb.w * k));
  const ph = Math.max(1, Math.ceil(pb.h * k));
  const rgb = new Float32Array(pw * ph * 3);
  const cover = new Float32Array(pw * ph);
  const [patchCanvas, pg] = canvas2d(pw, ph);
  const t0 = performance.now();
  const n = plan.tiles.length;
  let runMs = 0;
  try {
    await eraseModel.load(step);
    for (let t = 0; t < n; t++) {
      const tile = plan.tiles[t]!;
      const win = tile.win;
      const dw = Math.min(MODEL_SIDE, Math.round(win.w * k));
      const dh = Math.min(MODEL_SIDE, Math.round(win.h * k));
      step(`${lastWords(t, n)}`, t / n);
      // the window as the model sees it: the photo with what the earlier tiles made laid over it
      const [wc, g] = canvas2d(MODEL_SIDE, MODEL_SIDE, true);
      g.imageSmoothingQuality = 'high';
      g.drawImage(src, win.x, win.y, win.w, win.h, 0, 0, MODEL_SIDE, MODEL_SIDE);
      g.drawImage(src, win.x, win.y, win.w, win.h, 0, 0, dw, dh);
      if (t > 0) g.drawImage(patchCanvas, (pb.x - win.x) * k, (pb.y - win.y) * k, pb.w * k, pb.h * k);
      const px = g.getImageData(0, 0, MODEL_SIDE, MODEL_SIDE).data;
      const poffX = Math.round((win.x - pb.x) * k);
      const poffY = Math.round((win.y - pb.y) * k);
      // the hole in the window: what is painted, less what an earlier tile has made already
      const m = new Uint8Array(MODEL_SIDE * MODEL_SIDE);
      for (let j = 0; j < dh; j++)
        for (let i = 0; i < dw; i++) {
          const ox = win.x + (i + 0.5) / k;
          const oy = win.y + (j + 0.5) / k;
          if (alphaAt(hole, ox / W, oy / H) <= 0.25) continue;
          const pi = i + poffX;
          const pj = j + poffY;
          if (pi >= 0 && pi < pw && pj >= 0 && pj < ph && cover[pj * pw + pi]! >= 0.99) continue;
          m[j * MODEL_SIDE + i] = 1;
        }
      const grown = dilate(m, MODEL_SIDE, MODEL_SIDE, GROW);
      const soft = soften(grown, MODEL_SIDE, MODEL_SIDE, 2);
      const img = new Float32Array(3 * MODEL_SIDE * MODEL_SIDE);
      const msk = new Float32Array(MODEL_SIDE * MODEL_SIDE);
      for (let i = 0; i < MODEL_SIDE * MODEL_SIDE; i++) {
        img[i] = px[i * 4]! / 255;
        img[MODEL_SIDE * MODEL_SIDE + i] = px[i * 4 + 1]! / 255;
        img[2 * MODEL_SIDE * MODEL_SIDE + i] = px[i * 4 + 2]! / 255;
        msk[i] = grown[i]!;
      }
      const res = await eraseModel.run({
        image: { data: img, dims: [1, 3, MODEL_SIDE, MODEL_SIDE] },
        mask: { data: msk, dims: [1, 1, MODEL_SIDE, MODEL_SIDE] },
      });
      runMs = Math.max(runMs, res.ms);
      const o = res.data;
      const plane = MODEL_SIDE * MODEL_SIDE;
      for (let j = 0; j < dh; j++)
        for (let i = 0; i < dw; i++) {
          const s = soft[j * MODEL_SIDE + i]!;
          if (s <= 0.004) continue;
          const ox = win.x + (i + 0.5) / k;
          const oy = win.y + (j + 0.5) / k;
          const wt = coreWeight(tile.core, ox, oy, FEATHER / k);
          if (wt <= 0) continue;
          const pi = i + poffX;
          const pj = j + poffY;
          if (pi < 0 || pi >= pw || pj < 0 || pj >= ph) continue;
          const a = s * wt;
          const at = pj * pw + pi;
          const c0 = cover[at]!;
          const c1 = c0 + (1 - c0) * a;
          for (let c = 0; c < 3; c++) {
            const v = Math.min(255, Math.max(0, o[c * plane + j * MODEL_SIDE + i]!));
            rgb[at * 3 + c] = (rgb[at * 3 + c]! * c0 * (1 - a) + v * a) / c1;
          }
          cover[at] = c1;
        }
      // what this tile made, for the next tile to see
      pg.putImageData(new ImageData(toRgba(rgb, cover, pw, ph) as unknown as Uint8ClampedArray<ArrayBuffer>, pw, ph), 0, 0);
    }
  } finally {
    eraseModel.release();
  }
  if (runMs) rememberRun(runMs);
  const id = putPatch({ w: pw, h: ph, data: toRgba(rgb, cover, pw, ph) });
  return { patch: { id, x: pb.x / W, y: pb.y / H, w: pb.w / W, h: pb.h / H }, ms: performance.now() - t0, tiles: n };
}

const lastWords = (t: number, n: number): string => (n > 1 ? `Erasing… part ${t + 1} of ${n}` : 'Erasing…');

function toRgba(rgb: Float32Array, cover: Float32Array, w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    out[i * 4] = rgb[i * 3]!;
    out[i * 4 + 1] = rgb[i * 3 + 1]!;
    out[i * 4 + 2] = rgb[i * 3 + 2]!;
    out[i * 4 + 3] = Math.round(cover[i]! * 255);
  }
  return out;
}
