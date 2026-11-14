/**
 * PAINT's colouring pages: open line art drawn here (a mandala, a flower garden, a starry night, a fish bowl, all made by this
 * code, so they are free for anyone) and his own photo turned into outlines. Each becomes a locked reference layer of black
 * lines, so the bucket fills between them and his paint goes on the layer under them.
 */
import { seeded } from './brushes';
import { mk } from './engine';
import { outlinesOf } from './pixels';

export type PageKind = 'mandala' | 'garden' | 'night' | 'fishbowl';
export const PAGES: { id: PageKind; name: string; says: string }[] = [
  { id: 'mandala', name: 'Mandala', says: 'Rings of petals round a centre. Turn on six-way symmetry to paint it.' },
  { id: 'garden', name: 'Flower garden', says: 'Flowers, leaves and a sun over a fence.' },
  { id: 'night', name: 'Starry night', says: 'A moon, stars and hills with a little house.' },
  { id: 'fishbowl', name: 'Fish bowl', says: 'A round bowl with fish, weed and bubbles.' },
];

const ring = (g: CanvasRenderingContext2D, cx: number, cy: number, r: number): void => { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); };

function petal(g: CanvasRenderingContext2D, cx: number, cy: number, a: number, r0: number, r1: number, wide: number): void {
  const x0 = cx + Math.cos(a) * r0, y0 = cy + Math.sin(a) * r0, x1 = cx + Math.cos(a) * r1, y1 = cy + Math.sin(a) * r1;
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, nx = -Math.sin(a) * wide, ny = Math.cos(a) * wide;
  g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(mx + nx, my + ny, x1, y1); g.quadraticCurveTo(mx - nx, my - ny, x0, y0); g.stroke();
}

function flower(g: CanvasRenderingContext2D, x: number, y: number, r: number, n: number, stem: number): void {
  g.beginPath(); g.moveTo(x, y + r * 0.4); g.quadraticCurveTo(x + r * 0.5, y + stem * 0.5, x, y + stem); g.stroke();
  petal(g, x, y + stem * 0.6, 0.4, 0, r * 1.2, r * 0.45);
  for (let i = 0; i < n; i++) petal(g, x, y, (i / n) * Math.PI * 2, r * 0.3, r, r * 0.42);
  ring(g, x, y, r * 0.3);
}

/** Draw a page's lines, black on clear, filling a w × h canvas. */
export function pageLines(kind: PageKind, w: number, h: number): HTMLCanvasElement {
  const c = mk(w, h), g = c.getContext('2d')!;
  const u = Math.min(w, h);
  g.strokeStyle = '#111'; g.lineWidth = Math.max(2, u / 260); g.lineCap = 'round'; g.lineJoin = 'round';
  const rnd = seeded(kind.length * 131);
  if (kind === 'mandala') {
    const cx = w / 2, cy = h / 2;
    ring(g, cx, cy, u * 0.05);
    for (const [r0, r1, n, wide] of [[u * 0.05, u * 0.14, 8, 0.05], [u * 0.12, u * 0.24, 12, 0.05], [u * 0.22, u * 0.34, 16, 0.045], [u * 0.33, u * 0.45, 24, 0.03]] as const) {
      for (let i = 0; i < n; i++) petal(g, cx, cy, (i / n) * Math.PI * 2 + (n % 16 ? 0 : Math.PI / n), r0, r1, u * wide);
    }
    for (const r of [u * 0.14, u * 0.24, u * 0.34, u * 0.46]) ring(g, cx, cy, r);
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; ring(g, cx + Math.cos(a) * u * 0.39, cy + Math.sin(a) * u * 0.39, u * 0.012); }
  } else if (kind === 'garden') {
    const ground = h * 0.78;
    g.beginPath(); g.moveTo(0, ground); g.lineTo(w, ground); g.stroke();
    for (let x = w * 0.04; x < w; x += w * 0.09) { g.strokeRect(x, ground - h * 0.16, w * 0.05, h * 0.16); g.beginPath(); g.moveTo(x, ground - h * 0.16); g.lineTo(x + w * 0.025, ground - h * 0.19); g.lineTo(x + w * 0.05, ground - h * 0.16); g.stroke(); }
    ring(g, w * 0.82, h * 0.14, u * 0.07);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.beginPath(); g.moveTo(w * 0.82 + Math.cos(a) * u * 0.09, h * 0.14 + Math.sin(a) * u * 0.09); g.lineTo(w * 0.82 + Math.cos(a) * u * 0.12, h * 0.14 + Math.sin(a) * u * 0.12); g.stroke(); }
    const spots = [[0.18, 0.42, 0.07, 8], [0.42, 0.36, 0.09, 10], [0.66, 0.46, 0.065, 6], [0.3, 0.6, 0.05, 7], [0.55, 0.62, 0.055, 9], [0.82, 0.58, 0.05, 5]] as const;
    for (const [fx, fy, fr, n] of spots) flower(g, w * fx, h * fy, u * fr, n, ground - h * fy);
    for (let i = 0; i < 26; i++) { const x = rnd() * w; g.beginPath(); g.moveTo(x, h); g.quadraticCurveTo(x + u * 0.01, h - u * 0.04, x + u * 0.02 * (rnd() - 0.5), h - u * 0.07); g.stroke(); }
  } else if (kind === 'night') {
    g.beginPath(); g.arc(w * 0.75, h * 0.18, u * 0.1, 0.6, Math.PI * 2 - 0.6); g.arc(w * 0.78, h * 0.16, u * 0.08, Math.PI * 2 - 0.9, 0.9, true); g.stroke();
    for (let i = 0; i < 18; i++) {
      const x = rnd() * w * 0.65 + w * 0.03, y = rnd() * h * 0.42 + h * 0.03, r = u * (0.012 + rnd() * 0.02);
      g.beginPath();
      for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2 - Math.PI / 2, rr = k % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      g.closePath(); g.stroke();
    }
    for (const [y0, amp] of [[0.62, 0.06], [0.72, 0.05], [0.84, 0.04]] as const) {
      g.beginPath(); g.moveTo(0, h * y0);
      for (let x = 0; x <= w; x += w / 40) g.lineTo(x, h * y0 - Math.sin((x / w) * Math.PI * 2 + y0 * 9) * h * amp);
      g.stroke();
    }
    const hx = w * 0.3, hy = h * 0.66, hw = u * 0.16;
    g.strokeRect(hx, hy, hw, hw * 0.8);
    g.beginPath(); g.moveTo(hx - hw * 0.1, hy); g.lineTo(hx + hw / 2, hy - hw * 0.5); g.lineTo(hx + hw * 1.1, hy); g.stroke();
    g.strokeRect(hx + hw * 0.4, hy + hw * 0.4, hw * 0.22, hw * 0.4);
    g.strokeRect(hx + hw * 0.1, hy + hw * 0.15, hw * 0.2, hw * 0.18);
  } else {
    const cx = w / 2, cy = h * 0.52, r = u * 0.4;
    g.beginPath(); g.arc(cx, cy, r, -Math.PI * 0.32, Math.PI * 1.32); g.stroke();
    g.beginPath(); g.ellipse(cx, cy - r * 0.86, r * 0.48, r * 0.09, 0, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(cx - r * 0.86, cy + r * 0.45); g.quadraticCurveTo(cx, cy + r * 0.62, cx + r * 0.86, cy + r * 0.45); g.stroke();
    const fish = (x: number, y: number, s: number, dir: number): void => {
      g.beginPath(); g.ellipse(x, y, s, s * 0.55, 0, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(x - dir * s, y); g.lineTo(x - dir * s * 1.6, y - s * 0.5); g.lineTo(x - dir * s * 1.6, y + s * 0.5); g.closePath(); g.stroke();
      ring(g, x + dir * s * 0.5, y - s * 0.12, s * 0.1);
      g.beginPath(); g.moveTo(x - dir * s * 0.1, y - s * 0.5); g.quadraticCurveTo(x - dir * s * 0.3, y - s * 0.95, x - dir * s * 0.6, y - s * 0.45); g.stroke();
    };
    fish(cx - r * 0.3, cy - r * 0.1, r * 0.2, 1);
    fish(cx + r * 0.35, cy + r * 0.2, r * 0.15, -1);
    for (const x of [-0.5, -0.2, 0.15, 0.5]) { g.beginPath(); g.moveTo(cx + r * x, cy + r * 0.56); g.bezierCurveTo(cx + r * (x - 0.1), cy + r * 0.3, cx + r * (x + 0.12), cy + r * 0.1, cx + r * (x + 0.02), cy - r * 0.1); g.stroke(); }
    for (let i = 0; i < 8; i++) ring(g, cx + r * (0.05 + rnd() * 0.2), cy - r * (0.1 + i * 0.09), u * (0.008 + rnd() * 0.012));
    g.beginPath(); g.moveTo(cx - r * 0.95, cy + r * 0.98); g.lineTo(cx + r * 0.95, cy + r * 0.98); g.stroke();
  }
  return c;
}

/** His photo, fitted to the canvas, as clean black outlines on clear. */
export async function photoLines(file: Blob, w: number, h: number, detail = 0.5): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(w / bmp.width, h / bmp.height);
  const dw = Math.round(bmp.width * s), dh = Math.round(bmp.height * s);
  const src = mk(w, h), g = src.getContext('2d')!;
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
  g.drawImage(bmp, (w - dw) / 2, (h - dh) / 2, dw, dh);
  bmp.close?.();
  const d = g.getImageData(0, 0, w, h);
  const lines = outlinesOf(d.data, w, h, detail);
  const out = mk(w, h);
  out.getContext('2d')!.putImageData(new ImageData(lines as Uint8ClampedArray<ArrayBuffer>, w, h), 0, 0);
  return out;
}

export const blobOf = (c: HTMLCanvasElement, type = 'image/png', q?: number): Promise<Blob> =>
  new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('the picture could not be made'))), type, q));
