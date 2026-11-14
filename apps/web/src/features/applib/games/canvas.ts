/**
 * A crisp canvas for the real-time kinds (snake, blocks): sized to the stage's width at the phone's pixel ratio,
 * redrawn on requestAnimationFrame (so it runs at the screen's own rate, 60 or 120 a second), and stopped cleanly.
 */
import { h } from '../../../core/dom';

export interface Canvas {
  el: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  /** Start the frame loop: fn(now, dt in ms). Returns stop. */
  loop(fn: (now: number, dt: number) => void): () => void;
}

export function canvas(stage: HTMLElement, aspect: number, maxH = 0.62): Canvas {
  const el = h('canvas.al-gcanvas', { role: 'img' }) as HTMLCanvasElement;
  stage.append(el);
  const ctx = el.getContext('2d')!;
  const c: Canvas = { el, ctx, w: 0, h: 0, loop: () => () => {} };
  const fit = () => {
    const avail = stage.clientWidth || 320;
    const tall = Math.max(200, window.innerHeight * maxH);
    let w = avail;
    let hh = w * aspect;
    if (hh > tall) {
      hh = tall;
      w = hh / aspect;
    }
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    el.style.width = `${Math.floor(w)}px`;
    el.style.height = `${Math.floor(hh)}px`;
    el.width = Math.floor(w * dpr);
    el.height = Math.floor(hh * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.w = Math.floor(w);
    c.h = Math.floor(hh);
  };
  fit();
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
  ro?.observe(stage);
  c.loop = (fn) => {
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      fn(now, dt);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  };
  return c;
}

/** Rounded rectangle fill. */
export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, hh: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, hh, r);
  ctx.fill();
}
