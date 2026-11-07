/**
 * THE ONE LENS's cheap pass, off the main thread (features/lens/one.ts): the frame arrives as an ImageBitmap (made from the video
 * without stalling the page), its pixels are read here, the steadiness and the "text present" check run here, and the pixels of
 * the larger copy go back (transferred, not copied) for the barcode reader. The page's frames never wait for the graphics
 * process, which is what a pixel read costs on a busy phone and on the preview's software graphics.
 */
import { Steady, greyOf, textTiles, type TextBlock } from '../vision/tags';

const GREY_W = 160;
const steady = new Steady();
const ctxOf = (w: number, h: number): OffscreenCanvasRenderingContext2D => {
  const c = new OffscreenCanvas(w, h);
  return c.getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D;
};

export interface LensAsk {
  id: number;
  bitmap?: ImageBitmap;
  /** The time on the page's clock (the steadiness counts in it). */
  now: number;
  /** Send the bitmap's own pixels back (for the barcode reader). */
  pixels?: boolean;
  reset?: boolean;
}
export interface LensReply {
  id: number;
  ms: number;
  /** What the "text present" check alone cost, ms (the pixels were already read). */
  tiles: number;
  blocks: TextBlock[];
  steady: boolean;
  epoch: number;
  diff: number;
  /** The grey frame's size (the blocks are in it). */
  w: number;
  h: number;
  px?: ArrayBuffer;
  pw?: number;
  ph?: number;
  error?: string;
}

const scope = self as unknown as { onmessage: ((ev: MessageEvent<LensAsk>) => void) | null; postMessage(m: LensReply, t?: Transferable[]): void };
scope.onmessage = (ev) => {
  const a = ev.data;
  if (a.reset) {
    steady.reset();
    return;
  }
  const bm = a.bitmap;
  if (!bm) return;
  try {
    const t0 = performance.now();
    let px: ImageData | null = null;
    let small: ImageData;
    const gh = Math.max(24, Math.round((GREY_W * bm.height) / bm.width));
    if (a.pixels && bm.width > GREY_W) {
      const big = ctxOf(bm.width, bm.height);
      big.drawImage(bm, 0, 0);
      px = big.getImageData(0, 0, bm.width, bm.height);
      const s = ctxOf(GREY_W, gh);
      s.drawImage(big.canvas as unknown as CanvasImageSource, 0, 0, GREY_W, gh);
      small = s.getImageData(0, 0, GREY_W, gh);
    } else {
      const s = ctxOf(bm.width, bm.height);
      s.drawImage(bm, 0, 0);
      small = s.getImageData(0, 0, bm.width, bm.height);
    }
    bm.close();
    const g = greyOf(small.data, small.width, small.height);
    steady.push(g, a.now);
    const tt = performance.now();
    const blocks = textTiles(g);
    const tiles = performance.now() - tt;
    const reply: LensReply = { id: a.id, ms: performance.now() - t0, tiles, blocks, steady: steady.steady, epoch: steady.epoch, diff: steady.diff, w: g.w, h: g.h };
    if (px) {
      reply.px = px.data.buffer as ArrayBuffer;
      reply.pw = px.width;
      reply.ph = px.height;
      scope.postMessage(reply, [reply.px]);
    } else scope.postMessage(reply);
  } catch (e) {
    scope.postMessage({ id: a.id, ms: 0, tiles: 0, blocks: [], steady: false, epoch: 0, diff: 255, w: 0, h: 0, error: String((e as Error)?.message ?? e) });
  }
};
