/**
 * What the creative sheets share (BRIEF-PACKS-2): the poster's face (Oswald, vendored under public/vendor/oswald), drawing a
 * list of shapes (packages/shared/src/creativeart.ts `Prim`) on a canvas, and saving what was made — a PNG, an SVG, a WAV, a
 * MIDI file — to his own downloads on his tap. Nothing here is uploaded anywhere.
 */
import type { Measure, Prim } from '../../../../../packages/shared/src/creativeart';
import { h } from '../../core/dom';

const FACE = { display: "'Oswald', Impact, 'Arial Narrow', sans-serif", body: "system-ui, -apple-system, 'Segoe UI', sans-serif" };

let fontTried: Promise<boolean> | null = null;
/** The poster's face, loaded once and never waited on for long (false: the fallback face is used). */
export function loadFont(): Promise<boolean> {
  fontTried ??= Promise.race([
    document.fonts.load("700 100px 'Oswald'").then((f) => f.length > 0, () => false),
    new Promise<boolean>((r) => setTimeout(() => r(false), 2500)),
  ]).catch(() => false);
  return fontTried;
}

export const measureOn = (ctx: CanvasRenderingContext2D): Measure => (text, size, weight = 400) => {
  ctx.font = `${weight} ${size}px ${FACE.display}`;
  return ctx.measureText(text).width;
};
/** A measure for the body face (comic captions, a card's message). */
export const measureBody = (ctx: CanvasRenderingContext2D): Measure => (text, size, weight = 400) => {
  ctx.font = `${weight} ${size}px ${FACE.body}`;
  return ctx.measureText(text).width;
};

/** A canvas that shows at its own shape, as wide as the sheet allows and no taller than most of the screen. */
export function canvasOf(w: number, h2: number, label: string): HTMLCanvasElement {
  const c = h('canvas.pkcanvas', { width: w, height: h2, role: 'img', 'aria-label': label }) as HTMLCanvasElement;
  return c;
}

/** The shapes on the canvas, over a flat background. */
export function drawPrims(ctx: CanvasRenderingContext2D, prims: Prim[], w: number, hh: number, bg: string): void {
  ctx.save();
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, hh);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const p of prims) {
    ctx.beginPath();
    switch (p.t) {
      case 'rect':
        if (p.r && ctx.roundRect) ctx.roundRect(p.x, p.y, p.w, p.h, p.r);
        else ctx.rect(p.x, p.y, p.w, p.h);
        break;
      case 'circle':
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        break;
      case 'line':
        ctx.moveTo(p.x1, p.y1);
        ctx.lineTo(p.x2, p.y2);
        ctx.strokeStyle = p.stroke;
        ctx.lineWidth = p.sw;
        ctx.stroke();
        continue;
      case 'poly':
        p.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.closePath();
        break;
      case 'arc':
        ctx.arc(p.x, p.y, p.r, p.a0, p.a1);
        ctx.strokeStyle = p.stroke;
        ctx.lineWidth = p.sw;
        ctx.stroke();
        continue;
      case 'text':
        ctx.font = `${p.weight ?? 400} ${p.size}px ${p.font === 'display' ? FACE.display : FACE.body}`;
        ctx.textAlign = p.align ?? 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = p.fill;
        ctx.fillText(p.text, p.x, p.y);
        continue;
    }
    if (p.fill) {
      ctx.fillStyle = p.fill;
      ctx.fill();
    }
    if (p.stroke) {
      ctx.strokeStyle = p.stroke;
      ctx.lineWidth = p.sw ?? 2;
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** What was saved last, for the specs (window.__ghosty.creative.saved). */
export const saved = { kind: '', name: '', bytes: 0, head: '' };

/** Put a file in his downloads on his tap (an anchor with a download name; nothing is uploaded). */
export function saveFile(data: Blob | Uint8Array, name: string, mime: string): void {
  const blob = data instanceof Blob ? data : new Blob([data as BlobPart], { type: mime });
  saved.kind = name.split('.').pop() ?? '';
  saved.name = name;
  saved.bytes = blob.size;
  void blob.slice(0, 12).arrayBuffer().then((b) => (saved.head = Array.from(new Uint8Array(b)).map((x) => (x >= 32 && x < 127 ? String.fromCharCode(x) : '.')).join('')));
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name, style: 'display:none' });
  document.body.append(a);
  a.click();
  setTimeout(() => (a.remove(), URL.revokeObjectURL(url)), 4000);
}
export const pngOf = (c: HTMLCanvasElement): Promise<Blob> => new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('the picture could not be made'))), 'image/png'));
