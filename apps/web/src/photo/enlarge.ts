/**
 * ENLARGE (NEXT ROUND, editors.u14, the version with no model): the finished picture made twice as wide and tall on the phone, for a
 * small photo that must print or crop bigger. Drawn up in halving steps with the phone's best smoothing (each step at most twice the
 * last, so edges stay clean), then an unsharp mask gives back the crispness the stretch softens, gentler where the picture is flat so its
 * noise is not sharpened. It invents no detail (a model would; none is offered, see the export sheet's words), and a picture never goes
 * past the 16.7 megapixels a phone's canvas holds. `sharpen` and `enlargedSize` are pure (the brain test proves them on numbers).
 */

/** The canvas limit a phone keeps to (iOS's): 16,777,216 pixels. */
export const MAX_PIXELS = 16_777_216;

/** The size a w × h picture enlarges to at `k` times, held under the canvas limit (the same shape); `capped` when it had to be. */
export function enlargedSize(w: number, h: number, k = 2): { w: number; h: number; capped: boolean } {
  let W = Math.round(w * k);
  let H = Math.round(h * k);
  const capped = W * H > MAX_PIXELS;
  if (capped) {
    const s = Math.sqrt(MAX_PIXELS / (W * H));
    W = Math.floor(W * s);
    H = Math.floor(H * s);
  }
  return { w: Math.max(1, W), h: Math.max(1, H), capped };
}

/** True when a w × h picture cannot get bigger on a phone (it is already at, or within 1% of, the canvas limit, as every 24 or 48 megapixel
 *  photo is once drawn): 2× BIGGER then leaves it as it is rather than redrawing it for a few pixels. */
export const cannotGrow = (w: number, h: number, k = 2): boolean => enlargedSize(w, h, k).w <= w * 1.01;

/**
 * An unsharp mask on RGBA pixels in place: each colour pulled away from its 3 × 3 blur by `amount`, where the local contrast is over
 * `threshold` (0..255) so flat areas and their noise are left alone. Alpha untouched.
 */
export function sharpen(px: Uint8ClampedArray, w: number, h: number, amount = 0.6, threshold = 4): void {
  const src = new Uint8ClampedArray(px);
  const row = w * 4;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * row + x * 4;
      for (let c = 0; c < 3; c++) {
        const k = i + c;
        const blur = (src[k - row - 4]! + src[k - row]! + src[k - row + 4]! + src[k - 4]! + src[k]! + src[k + 4]! + src[k + row - 4]! + src[k + row]! + src[k + row + 4]!) / 9;
        const d = src[k]! - blur;
        if (Math.abs(d) > threshold) px[k] = src[k]! + d * amount;
      }
    }
  }
}

/** The picture enlarged `k` times (2 by default): stepped up with the best smoothing, then sharpened. `say` hears the step. */
export async function enlarge(src: HTMLCanvasElement, k = 2, say?: (words: string) => void): Promise<{ canvas: HTMLCanvasElement; w: number; h: number; capped: boolean; already?: boolean }> {
  const want = enlargedSize(src.width, src.height, k);
  // (a picture already at the canvas limit, as every 24 or 48 megapixel phone photo is, cannot grow: it is handed back untouched, never
  // sharpened in place, so AS IT IS still exports the picture as drawn)
  if (cannotGrow(src.width, src.height, k)) return { canvas: src, w: src.width, h: src.height, capped: true, already: true };
  let cur: HTMLCanvasElement = src;
  while (cur.width < want.w) {
    const next = document.createElement('canvas');
    next.width = Math.min(want.w, cur.width * 2);
    next.height = next.width === want.w ? want.h : Math.round((cur.height * next.width) / cur.width);
    const g = next.getContext('2d');
    if (!g) throw new Error('This phone would not give me a picture to draw on.');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(cur, 0, 0, next.width, next.height);
    cur = next;
    await new Promise((r) => setTimeout(r, 0));
  }
  if (cur === src) {
    // (never sharpen the picture he is exporting AS IT IS: work on a copy)
    const copy = document.createElement('canvas');
    copy.width = src.width;
    copy.height = src.height;
    copy.getContext('2d')?.drawImage(src, 0, 0);
    cur = copy;
  }
  say?.('Sharpening the bigger picture…');
  await new Promise((r) => setTimeout(r, 0));
  const g = cur.getContext('2d', { willReadFrequently: true });
  if (!g) throw new Error('This phone would not give me a picture to draw on.');
  const img = g.getImageData(0, 0, cur.width, cur.height);
  sharpen(img.data, cur.width, cur.height);
  g.putImageData(img, 0, 0);
  return { canvas: cur, w: cur.width, h: cur.height, capped: want.capped, already: false };
}
