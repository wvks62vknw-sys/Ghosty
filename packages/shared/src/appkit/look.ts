/**
 * The mini-apps' look, in route C's language: a graphite-black canvas, one accent per app (the colours
 * Apple uses for system tints, each with a lighter "ink" for text), and a glyph drawn from a few simple
 * shapes. The same glyph is written as SVG for the page and its tab icon, and drawn as pixels for the
 * Home Screen icon (png.ts) — so the app is recognisably itself everywhere.
 */
import { contrast } from '../sitekit/tokens';

export const BG = '#050607';
/** The glass card as it really looks over the canvas (used for contrast checks). */
export const CARD = '#17181b';
export const INK = '#f4f6f8';
/** Secondary text: rgba(235, 240, 245, .64) over the canvas. */
export const INK2 = '#999b9e';

export const ACCENTS = {
  cyan: { acc: '#64d2ff', ink: '#9fe4ff' },
  blue: { acc: '#0a84ff', ink: '#7dbcff' },
  teal: { acc: '#40c8e0', ink: '#8de3f0' },
  mint: { acc: '#63e6e2', ink: '#a5f2ef' },
  green: { acc: '#30d158', ink: '#7ee59a' },
  yellow: { acc: '#ffd60a', ink: '#ffe56b' },
  orange: { acc: '#ff9f0a', ink: '#ffc56b' },
  red: { acc: '#ff453a', ink: '#ff8a82' },
  pink: { acc: '#ff375f', ink: '#ff8ba3' },
  purple: { acc: '#bf5af2', ink: '#dca2f8' },
  indigo: { acc: '#5e5ce6', ink: '#a9a8f5' },
} as const;
export type AccentId = keyof typeof ACCENTS;
export const ACCENT_IDS = Object.keys(ACCENTS) as AccentId[];

/** The colours one app uses: its accent, the ink for accent text, and whichever of black or white reads on the accent. */
export function colours(id: AccentId): { acc: string; ink: string; on: string } {
  const a = ACCENTS[id] ?? ACCENTS.cyan;
  const on = contrast(BG, a.acc) >= contrast('#ffffff', a.acc) ? BG : '#ffffff';
  return { acc: a.acc, ink: a.ink, on };
}

// ── glyphs ──────────────────────────────────────────────────────────────────────────

/** One shape of a glyph on a 24 × 24 grid; `cut` takes it away from what is drawn before it. */
export type Prim =
  | { k: 'c'; x: number; y: number; r: number; cut?: true }
  | { k: 'o'; x: number; y: number; r: number; w: number; cut?: true }
  | { k: 'r'; x: number; y: number; w: number; h: number; r: number; cut?: true }
  | { k: 'l'; x1: number; y1: number; x2: number; y2: number; w: number; cut?: true }
  | { k: 'p'; pts: number[]; cut?: true };

const c = (x: number, y: number, r: number, cut?: true): Prim => ({ k: 'c', x, y, r, ...(cut ? { cut } : {}) });
const o = (x: number, y: number, r: number, w: number): Prim => ({ k: 'o', x, y, r, w });
const r = (x: number, y: number, w: number, h: number, rr: number, cut?: true): Prim => ({ k: 'r', x, y, w, h, r: rr, ...(cut ? { cut } : {}) });
const l = (x1: number, y1: number, x2: number, y2: number, w: number, cut?: true): Prim => ({ k: 'l', x1, y1, x2, y2, w, ...(cut ? { cut } : {}) });
const p = (...pts: number[]): Prim => ({ k: 'p', pts });

const star = (): number[] => {
  const out: number[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? 3.9 : 9.2;
    out.push(Math.round((12 + rad * Math.cos(a)) * 100) / 100, Math.round((12.8 + rad * Math.sin(a)) * 100) / 100);
  }
  return out;
};

export const GLYPHS = {
  drop: [c(12, 14.5, 5.5), p(12, 3.2, 7.196, 11.823, 12, 14.5, 16.804, 11.823)],
  list: [c(5, 7, 1.5), c(5, 12, 1.5), c(5, 17, 1.5), l(9, 7, 19, 7, 2.2), l(9, 12, 19, 12, 2.2), l(9, 17, 16, 17, 2.2)],
  clock: [o(12, 13.2, 7.4, 2.1), l(12, 13.2, 12, 9.2, 2.1), l(12, 13.2, 14.8, 15, 2.1), r(10, 2.4, 4, 2.4, 1)],
  calc: [r(5, 2.8, 14, 18.4, 3.2), r(7.4, 5.2, 9.2, 4.2, 1.2, true), c(8.9, 12.6, 1.2, true), c(12, 12.6, 1.2, true), c(15.1, 12.6, 1.2, true), c(8.9, 16.6, 1.2, true), c(12, 16.6, 1.2, true), c(15.1, 16.6, 1.2, true)],
  plus: [o(12, 12, 8.6, 2.1), l(12, 8, 12, 16, 2.3), l(8, 12, 16, 12, 2.3)],
  calendar: [r(3.5, 4.6, 17, 16, 3.2), r(5.6, 9, 12.8, 9.6, 1.6, true), l(8.6, 13.8, 10.9, 16.1, 1.9), l(10.9, 16.1, 15.4, 11.5, 1.9), l(8, 2.6, 8, 6.2, 1.9), l(16, 2.6, 16, 6.2, 1.9)],
  note: [r(5, 2.8, 14, 18.4, 3), l(8.6, 8.4, 15.4, 8.4, 1.7, true), l(8.6, 12, 15.4, 12, 1.7, true), l(8.6, 15.6, 12.8, 15.6, 1.7, true)],
  cards: [r(9.2, 2.8, 11.2, 15, 2.2), r(3.4, 6.2, 13.6, 17.4, 3.2, true), r(4.4, 7.2, 11.6, 15.4, 2.2)],
  die: [r(4, 4, 16, 16, 4), c(8.6, 8.6, 1.6, true), c(15.4, 8.6, 1.6, true), c(12, 12, 1.6, true), c(8.6, 15.4, 1.6, true), c(15.4, 15.4, 1.6, true)],
  moon: [c(12, 12, 8.2), c(16.4, 8.6, 6.6, true)],
  heart: [c(8.6, 9.4, 4.4), c(15.4, 9.4, 4.4), p(4.45, 11.0, 12, 19.8, 19.55, 11.0, 12, 8)],
  star: [p(...star())],
  bolt: [p(13.6, 2.4, 5.4, 13.6, 11.2, 13.6, 10, 21.6, 18.6, 10, 12.7, 10)],
  coins: [o(9.4, 9.6, 5.6, 2.1), o(14.6, 14.4, 5.6, 2.1)],
  cup: [r(4.4, 6.4, 11.6, 13.4, 3), r(6.6, 8.4, 7.2, 4.4, 1.2, true), o(17.4, 11.6, 2.8, 1.9)],
  dumbbell: [l(6, 12, 18, 12, 2.2), r(2.6, 8.4, 3.2, 7.2, 1.2), r(18.2, 8.4, 3.2, 7.2, 1.2), r(5.6, 6.2, 3, 11.6, 1.3), r(15.4, 6.2, 3, 11.6, 1.3)],
  smile: [o(12, 12, 8.6, 2.1), c(9.1, 10, 1.35), c(14.9, 10, 1.35), l(8.6, 14.2, 10.6, 15.9, 1.9), l(10.6, 15.9, 13.4, 15.9, 1.9), l(13.4, 15.9, 15.4, 14.2, 1.9)],
  cart: [l(2.8, 4.6, 5.8, 4.6, 2), l(5.8, 4.6, 8, 15, 2), l(8, 15, 18.2, 15, 2), l(7, 8, 20, 8, 2), l(20, 8, 18.2, 15, 2), c(9.2, 19.2, 1.7), c(16.8, 19.2, 1.7)],
  case: [r(3, 7, 18, 13, 2.8), r(8.6, 3.4, 6.8, 5.2, 1.6), r(10.4, 5, 3.2, 2.2, 0.6, true), l(3, 12.4, 21, 12.4, 1.4, true)],
} satisfies Record<string, Prim[]>;
export type GlyphId = keyof typeof GLYPHS;
export const GLYPH_IDS = Object.keys(GLYPHS) as GlyphId[];

const n = (v: number) => String(Math.round(v * 100) / 100);

/** The glyph as SVG, coloured by `fill` (default currentColor), with shapes cut away through a mask. */
export function glyphSvg(id: GlyphId, o2: { fill?: string; size?: number; mask?: string; label?: string } = {}): string {
  const prims = GLYPHS[id] ?? GLYPHS.star;
  const mid = o2.mask ?? 'gm';
  const col = (p2: Prim) => (p2.cut ? '#000' : '#fff');
  const parts = prims.map((q) => {
    switch (q.k) {
      case 'c':
        return `<circle cx="${n(q.x)}" cy="${n(q.y)}" r="${n(q.r)}" fill="${col(q)}"/>`;
      case 'o':
        return `<circle cx="${n(q.x)}" cy="${n(q.y)}" r="${n(q.r)}" fill="none" stroke="${col(q)}" stroke-width="${n(q.w)}"/>`;
      case 'r':
        return `<rect x="${n(q.x)}" y="${n(q.y)}" width="${n(q.w)}" height="${n(q.h)}" rx="${n(q.r)}" fill="${col(q)}"/>`;
      case 'l':
        return `<line x1="${n(q.x1)}" y1="${n(q.y1)}" x2="${n(q.x2)}" y2="${n(q.y2)}" stroke="${col(q)}" stroke-width="${n(q.w)}" stroke-linecap="round"/>`;
      default:
        return `<polygon points="${q.pts.map(n).join(' ')}" fill="${col(q)}" stroke="${col(q)}" stroke-width=".6" stroke-linejoin="round"/>`;
    }
  });
  const size = o2.size ? ` width="${o2.size}" height="${o2.size}"` : '';
  const a11y = o2.label ? ` role="img" aria-label="${o2.label.replace(/[<>&"']/g, '')}"` : ' aria-hidden="true"';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"${size}${a11y}><defs><mask id="${mid}"><rect width="24" height="24" fill="#000"/>${parts.join('')}</mask></defs><rect width="24" height="24" fill="${o2.fill ?? 'currentColor'}" mask="url(#${mid})"/></svg>`;
}

// ── the same glyph as pixels (signed distances, so every edge is smooth with one sample a pixel) ──

const len = (x: number, y: number) => Math.hypot(x, y);
function dist(q: Prim, x: number, y: number): number {
  switch (q.k) {
    case 'c':
      return len(x - q.x, y - q.y) - q.r;
    case 'o':
      return Math.abs(len(x - q.x, y - q.y) - q.r) - q.w / 2;
    case 'r': {
      const hx = q.w / 2 - q.r;
      const hy = q.h / 2 - q.r;
      const dx = Math.abs(x - (q.x + q.w / 2)) - hx;
      const dy = Math.abs(y - (q.y + q.h / 2)) - hy;
      return len(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - q.r;
    }
    case 'l': {
      const pax = x - q.x1;
      const pay = y - q.y1;
      const bax = q.x2 - q.x1;
      const bay = q.y2 - q.y1;
      const t = Math.max(0, Math.min(1, (pax * bax + pay * bay) / (bax * bax + bay * bay || 1)));
      return len(pax - bax * t, pay - bay * t) - q.w / 2;
    }
    default: {
      // Inigo Quilez's exact polygon distance: the nearest edge, signed by the winding.
      const v = q.pts;
      const m = v.length / 2;
      let d = (x - v[0]!) ** 2 + (y - v[1]!) ** 2;
      let s = 1;
      for (let i = 0, j = m - 1; i < m; j = i, i++) {
        const ix = v[i * 2]!;
        const iy = v[i * 2 + 1]!;
        const jx = v[j * 2]!;
        const jy = v[j * 2 + 1]!;
        const ex = jx - ix;
        const ey = jy - iy;
        const wx = x - ix;
        const wy = y - iy;
        const t = Math.max(0, Math.min(1, (wx * ex + wy * ey) / (ex * ex + ey * ey || 1)));
        d = Math.min(d, (wx - ex * t) ** 2 + (wy - ey * t) ** 2);
        const c1 = y >= iy;
        const c2 = y < jy;
        const c3 = ex * wy > ey * wx;
        if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
      }
      return s * Math.sqrt(d) - 0.3; // the SVG's .6 stroke rounds the corners the same way
    }
  }
}

/** Signed distance to the whole glyph at (x, y) on its 24-unit grid (negative inside). */
export function glyphDistance(id: GlyphId, x: number, y: number): number {
  let d = Infinity;
  for (const q of GLYPHS[id] ?? GLYPHS.star) {
    const e = dist(q, x, y);
    d = q.cut ? Math.max(d, -e) : Math.min(d, e);
  }
  return d;
}

/**
 * The Home Screen icon as RGB pixels: a graphite square with a soft glow of the accent behind the
 * glyph. The glyph sits in the middle half, inside the safe zone Android crops "maskable" icons to,
 * and iOS rounds the corners itself.
 */
export function iconPixels(id: GlyphId, accent: AccentId, size = 512): Uint8Array {
  const { acc } = colours(accent);
  const [ar, ag, ab] = [1, 3, 5].map((i) => parseInt(acc.slice(i, i + 2), 16)) as [number, number, number];
  const out = new Uint8Array(size * size * 3);
  const unit = size / 2 / 24; // pixels per glyph unit
  const off = size / 4;
  for (let yy = 0; yy < size; yy++) {
    const ty = yy / (size - 1);
    // graphite, a touch lighter at the top
    const base = [21 - 14 * ty, 24 - 16 * ty, 28 - 18 * ty];
    for (let xx = 0; xx < size; xx++) {
      const dx = (xx + 0.5) / size - 0.5;
      const dy = (yy + 0.5) / size - 0.52;
      const glow = Math.max(0, 1 - Math.hypot(dx, dy) / 0.5) ** 2 * 0.34;
      let R = base[0]! + (ar - base[0]!) * glow;
      let G = base[1]! + (ag - base[1]!) * glow;
      let B = base[2]! + (ab - base[2]!) * glow;
      const gx = (xx + 0.5 - off) / unit;
      const gy = (yy + 0.5 - off) / unit;
      if (gx > -2 && gx < 26 && gy > -2 && gy < 26) {
        const cov = Math.max(0, Math.min(1, 0.5 - glyphDistance(id, gx, gy) * unit));
        if (cov > 0) {
          R += (ar - R) * cov;
          G += (ag - G) * cov;
          B += (ab - B) * cov;
        }
      }
      const i = (yy * size + xx) * 3;
      out[i] = Math.round(R);
      out[i + 1] = Math.round(G);
      out[i + 2] = Math.round(B);
    }
  }
  return out;
}
