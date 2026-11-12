/**
 * THE EYE'S GRAIN (BRIEF-EYE-HUD 2; the design is round one's W3: a feed that is not looked at is an ordered dither of its own picture,
 * dim: present, recognisable as a shape, not looked at). A feed's picture is a few strokes drawn from its name (a seeded plan: the same
 * picture every time for the same feed), then thrown to dots on a fixed pitch whose size follows the picture's light. One small canvas
 * per feed, drawn once when it is on screen and again only when its size or its ink changes: no per-frame work. The ink is the world's
 * own (`--g-bone-rgb`), never a colour of its own. Pure drawing: no state, no network.
 */

/** A seeded random number generator: the same feed gives the same picture. */
const seeded = (seed: number) => () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
const hash = (s: string): number => {
  let n = 2166136261;
  for (let i = 0; i < s.length; i++) n = Math.imul(n ^ s.charCodeAt(i), 16777619) >>> 0;
  return n;
};

/** The strokes of a feed's picture, in a 0 to 1 box: boxes, lines and one disc, chosen by the seed (a globe for God's eye). */
interface Plan {
  boxes: [number, number, number, number][];
  lines: [number, number, number, number][];
  disc: [number, number, number] | null;
  noise: number;
}
export function planOf(id: string): Plan {
  const r = seeded(hash(id));
  const boxes: Plan['boxes'] = [];
  const lines: Plan['lines'] = [];
  const n = 1 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) boxes.push([0.08 + r() * 0.4, 0.12 + r() * 0.4, 0.2 + r() * 0.4, 0.2 + r() * 0.4]);
  for (let i = 0; i < 2 + Math.floor(r() * 3); i++) lines.push([r(), r(), r(), r()]);
  const globe = /eye|globe|map|space|sky/.test(id);
  return { boxes, lines, disc: globe ? [0.5, 0.5, 0.34] : r() > 0.7 ? [0.3 + r() * 0.4, 0.3 + r() * 0.4, 0.14 + r() * 0.1] : null, noise: 0.08 + r() * 0.1 };
}

/** The picture's light at (x, y) in the 0 to 1 box: 0 dark, 1 bright. */
function light(p: Plan, x: number, y: number, r: () => number): number {
  let v = p.noise * 1.6 * r();
  const edge = 0.035;
  for (const [bx, by, bw, bh] of p.boxes) {
    const inside = x > bx && x < bx + bw && y > by && y < by + bh;
    const near = Math.min(Math.abs(x - bx), Math.abs(x - bx - bw), Math.abs(y - by), Math.abs(y - by - bh));
    if (inside && near < edge) v = Math.max(v, 0.95);
    else if (inside) v = Math.max(v, 0.28);
  }
  for (const [x1, y1, x2, y2] of p.lines) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len));
    const d = Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
    if (d < 0.025) v = Math.max(v, 0.7);
  }
  if (p.disc) {
    const [cx, cy, cr] = p.disc;
    const d = Math.hypot(x - cx, (y - cy) * 1.1);
    if (Math.abs(d - cr) < 0.03) v = Math.max(v, 0.9);
    else if (d < cr) v = Math.max(v, 0.22 + 0.2 * Math.sin((x + y) * 19));
  }
  return v;
}

/** The world's ink as `r g b`, read once from the page's tokens. */
export function inkOf(): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--g-bone-rgb').trim();
  return /^\d+\s*,\s*\d+\s*,\s*\d+$/.test(raw) ? raw.replace(/\s*,\s*/g, ' ') : '230 233 238';
}

/** Draw a feed's grain into a canvas at its size on screen; `pitch` is the distance between dots in CSS px. */
export function drawGrain(cv: HTMLCanvasElement, id: string, ink: string, pitch = 4): string {
  const w = Math.max(8, Math.round(cv.clientWidth));
  const h = Math.max(8, Math.round(cv.clientHeight));
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const sig = `${w}x${h}@${dpr}:${ink}:${id}`;
  if (cv.dataset.drawn === sig) return sig;
  cv.dataset.drawn = sig;
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  const g = cv.getContext('2d');
  if (!g) return sig;
  g.scale(dpr, dpr);
  const plan = planOf(id);
  const r = seeded(hash(`${id}:dots`));
  g.fillStyle = `rgb(${ink})`;
  for (let y = pitch / 2; y < h; y += pitch) {
    for (let x = pitch / 2; x < w; x += pitch) {
      const v = light(plan, x / w, y / h, r);
      // an ordered dither: the dot is there when the light beats its place in a four-by-four order, and its size follows the light
      const order = (((Math.floor(x / pitch) % 4) * 4 + (Math.floor(y / pitch) % 4)) * 7 % 16) / 16;
      if (v < 0.06 + order * 0.5) continue;
      const s = Math.min(pitch * 0.8, 1.2 + v * 1.9);
      g.globalAlpha = Math.min(1, 0.35 + v * 0.65);
      g.fillRect(x - s / 2, y - s / 2, s, s);
    }
  }
  return sig;
}
