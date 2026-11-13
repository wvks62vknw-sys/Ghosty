/**
 * THE ERASE'S TILING (BRIEF-EDITOR-PHOTO-2), pure: the erase model works on a 512 × 512 picture, so a hole is filled on a crop around it at
 * the model's size and, where the hole is bigger than the model sees in one go, in tiles that are filled one after another (each tile
 * sees what the ones before it made) and feathered back. Everything here is numbers: which windows, which cores, how heavily a core counts at
 * a pixel, a dilated mask. The pictures are drawn by photo/inpaint.ts.
 */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The model's own side, in pixels. */
export const MODEL_SIDE = 512;
/** How much of a window one tile fills (the rest is context), in model pixels. */
export const CORE_SIDE = 384;
/** How far a tile's fill fades into its neighbours, and how far the hole is grown before the model sees it, in model pixels. */
export const FEATHER = 24;
export const GROW = 4;
/** A hole bigger than this many tiles across is filled at a smaller scale (so there are at most four by four). */
export const MAX_TILES_ACROSS = 4;

export interface Tile {
  /** The window the model sees, in the original's pixels (smaller than MODEL_SIDE / k only where the photo is). */
  win: Box;
  /** The part of the hole this tile owns, in the original's pixels. */
  core: Box;
}
export interface ErasePlan {
  /** Model pixels per original pixel: 1 for a hole of an ordinary size, less for a huge one. */
  k: number;
  /** The hole's own box, in the original's pixels. */
  box: Box;
  /** The box with the feather and the growth added, held inside the photo: where the patch picture lies. */
  patch: Box;
  tiles: Tile[];
}

const clamp = (x: number, a: number, b: number): number => (x < a ? a : x > b ? b : x);

/** The box of the pixels a picture holds above `thr` (0..255), or null where there are none. */
export function holeBounds(data: Uint8Array, w: number, h: number, thr = 40): Box | null {
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (data[y * w + x]! > thr) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** The tiles that fill a hole whose box (in the original's pixels) is `box` in a photo of imgW × imgH. */
export function planErase(box: Box, imgW: number, imgH: number): ErasePlan {
  const big = Math.max(box.w, box.h);
  const k = Math.min(1, (MAX_TILES_ACROSS * CORE_SIDE) / big);
  const win = MODEL_SIDE / k;
  const core = CORE_SIDE / k;
  const margin = Math.ceil((FEATHER + GROW) / k);
  const nx = Math.max(1, Math.ceil(box.w / core));
  const ny = Math.max(1, Math.ceil(box.h / core));
  const tiles: Tile[] = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const cx0 = box.x + Math.round((i * box.w) / nx);
      const cx1 = box.x + Math.round(((i + 1) * box.w) / nx);
      const cy0 = box.y + Math.round((j * box.h) / ny);
      const cy1 = box.y + Math.round(((j + 1) * box.h) / ny);
      const c: Box = { x: cx0, y: cy0, w: cx1 - cx0, h: cy1 - cy0 };
      const ww = Math.min(win, imgW);
      const wh = Math.min(win, imgH);
      const wx = Math.round(clamp(c.x + c.w / 2 - ww / 2, 0, imgW - ww));
      const wy = Math.round(clamp(c.y + c.h / 2 - wh / 2, 0, imgH - wh));
      tiles.push({ win: { x: wx, y: wy, w: Math.round(ww), h: Math.round(wh) }, core: c });
    }
  }
  const px = Math.max(0, box.x - margin);
  const py = Math.max(0, box.y - margin);
  return { k, box, patch: { x: px, y: py, w: Math.min(imgW, box.x + box.w + margin) - px, h: Math.min(imgH, box.y + box.h + margin) - py }, tiles };
}

/** How heavily a tile's core counts at the original's pixel (x, y): 1 inside it, falling to 0 over `feather` original pixels beyond. */
export function coreWeight(core: Box, x: number, y: number, feather: number): number {
  const dx = Math.max(core.x - x, 0, x - (core.x + core.w - 1));
  const dy = Math.max(core.y - y, 0, y - (core.y + core.h - 1));
  const d = Math.hypot(dx, dy);
  return d <= 0 ? 1 : d >= feather ? 0 : 1 - d / feather;
}

/** A mask (0 or 1 a pixel, side × side) grown by `r` pixels (a square window, two passes). */
export function dilate(m: Uint8Array, w: number, h: number, r: number): Uint8Array {
  if (r <= 0) return m.slice();
  const t = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let last = -1e9;
    // the nearest set pixel to the left and to the right, within r
    const left = new Int32Array(w);
    for (let x = 0; x < w; x++) {
      if (m[y * w + x]) last = x;
      left[x] = last;
    }
    last = 1e9;
    for (let x = w - 1; x >= 0; x--) {
      if (m[y * w + x]) last = x;
      t[y * w + x] = x - left[x]! <= r || last - x <= r ? 1 : 0;
    }
  }
  for (let x = 0; x < w; x++) {
    let last = -1e9;
    const up = new Int32Array(h);
    for (let y = 0; y < h; y++) {
      if (t[y * w + x]) last = y;
      up[y] = last;
    }
    last = 1e9;
    for (let y = h - 1; y >= 0; y--) {
      if (t[y * w + x]) last = y;
      out[y * w + x] = y - up[y]! <= r || last - y <= r ? 1 : 0;
    }
  }
  return out;
}

/** A 0/1 mask as soft 0..1 values: a box blur of radius r (so the edge fades over about 2r pixels). */
export function soften(m: Uint8Array, w: number, h: number, r: number): Float32Array {
  const out = new Float32Array(w * h);
  const k = 2 * r + 1;
  const t = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    let s = 0;
    for (let i = -r; i <= r; i++) s += m[y * w + clamp(i, 0, w - 1)]!;
    for (let x = 0; x < w; x++) {
      t[y * w + x] = s / k;
      s += m[y * w + clamp(x + r + 1, 0, w - 1)]! - m[y * w + clamp(x - r, 0, w - 1)]!;
    }
  }
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let i = -r; i <= r; i++) s += t[clamp(i, 0, h - 1) * w + x]!;
    for (let y = 0; y < h; y++) {
      out[y * w + x] = s / k;
      s += t[clamp(y + r + 1, 0, h - 1) * w + x]! - t[clamp(y - r, 0, h - 1) * w + x]!;
    }
  }
  return out;
}

/** The time said as the wait: "about 25 s" for `tiles` runs of `perRunMs`, rounded up to five seconds. */
export function waitSeconds(tiles: number, perRunMs: number): number {
  return Math.max(5, Math.ceil((tiles * perRunMs) / 5000) * 5);
}
