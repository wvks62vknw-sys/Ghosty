/**
 * Box maths for the Lens (pure, no DOM): how the camera frame maps onto the viewfinder, hit
 * tests for a tap, crop rectangles clamped to the frame, drag/resize of a crop, label counts
 * and the scene line. Frame coordinates are camera pixels; view coordinates are CSS pixels.
 */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Size {
  w: number;
  h: number;
}
/** One thing the detector found, box in frame pixels. */
export interface Detection {
  label: string;
  score: number;
  box: Box;
}
export interface Category {
  label: string;
  score: number;
}
export interface Transform {
  scale: number;
  dx: number;
  dy: number;
}

/** How a frame fills the viewfinder the way CSS `object-fit: cover` does: one scale, centred, edges cropped. */
export function coverTransform(frame: Size, view: Size): Transform {
  if (!(frame.w > 0) || !(frame.h > 0) || !(view.w > 0) || !(view.h > 0)) return { scale: 1, dx: 0, dy: 0 };
  const scale = Math.max(view.w / frame.w, view.h / frame.h);
  return { scale, dx: (view.w - frame.w * scale) / 2, dy: (view.h - frame.h * scale) / 2 };
}

/** A frame box in view pixels. */
export function toView(b: Box, t: Transform): Box {
  return { x: t.dx + b.x * t.scale, y: t.dy + b.y * t.scale, w: b.w * t.scale, h: b.h * t.scale };
}

/** A view point back in frame pixels (a tap on the viewfinder). */
export function toFrame(px: number, py: number, t: Transform): { x: number; y: number } {
  return { x: (px - t.dx) / t.scale, y: (py - t.dy) / t.scale };
}

export const inside = (b: Box, x: number, y: number): boolean => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

/** Which detection a tap at (x, y) in frame pixels picked: the smallest box under it, or -1. */
export function hitBox(dets: Detection[], x: number, y: number): number {
  let best = -1;
  let area = Infinity;
  dets.forEach((d, i) => {
    const a = d.box.w * d.box.h;
    if (inside(d.box, x, y) && a < area) {
      area = a;
      best = i;
    }
  });
  return best;
}

/** A box kept inside the frame, at least `min` pixels each way. */
export function clampBox(b: Box, frame: Size, min = 8): Box {
  const w = Math.max(0, Math.min(frame.w, b.w));
  const h = Math.max(0, Math.min(frame.h, b.h));
  const x = Math.max(0, Math.min(frame.w - w, b.x));
  const y = Math.max(0, Math.min(frame.h - h, b.y));
  const out = { x, y, w, h };
  if (out.w < min) out.w = Math.min(min, frame.w);
  if (out.h < min) out.h = Math.min(min, frame.h);
  out.x = Math.max(0, Math.min(frame.w - out.w, out.x));
  out.y = Math.max(0, Math.min(frame.h - out.h, out.y));
  return out;
}

/** The crop around a detection: a little air around it (`pad` of its size), clamped to the frame, whole pixels. */
export function cropRect(b: Box, frame: Size, pad = 0.08): Box {
  const px = b.w * pad;
  const py = b.h * pad;
  const c = clampBox({ x: b.x - px, y: b.y - py, w: b.w + 2 * px, h: b.h + 2 * py }, frame, 16);
  return { x: Math.floor(c.x), y: Math.floor(c.y), w: Math.max(1, Math.round(c.w)), h: Math.max(1, Math.round(c.h)) };
}

export const wholeFrame = (frame: Size): Box => ({ x: 0, y: 0, w: frame.w, h: frame.h });

/** The rectangle between two drag points, whichever way the finger went. */
export function normalizeRect(ax: number, ay: number, bx: number, by: number): Box {
  return { x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.abs(bx - ax), h: Math.abs(by - ay) };
}

export type Handle = 'nw' | 'ne' | 'sw' | 'se';
export const HANDLES: readonly Handle[] = ['nw', 'ne', 'sw', 'se'];

/** Where each corner handle of a rectangle sits. */
export function handlePoints(r: Box): Record<Handle, { x: number; y: number }> {
  return { nw: { x: r.x, y: r.y }, ne: { x: r.x + r.w, y: r.y }, sw: { x: r.x, y: r.y + r.h }, se: { x: r.x + r.w, y: r.y + r.h } };
}

/** What a press at (x, y) grabs: a corner handle (within `size` of it), the inside of the rectangle, or nothing. */
export function handleAt(r: Box, x: number, y: number, size = 22): Handle | 'inside' | null {
  const pts = handlePoints(r);
  for (const hd of HANDLES) {
    const p = pts[hd];
    if (Math.abs(p.x - x) <= size && Math.abs(p.y - y) <= size) return hd;
  }
  return inside(r, x, y) ? 'inside' : null;
}

/** The rectangle after dragging one corner by (dx, dy); it never turns inside out or gets smaller than `min`. */
export function resizeRect(r: Box, hd: Handle, dx: number, dy: number, frame: Size, min = 24): Box {
  let x0 = r.x;
  let y0 = r.y;
  let x1 = r.x + r.w;
  let y1 = r.y + r.h;
  if (hd === 'nw' || hd === 'sw') x0 = Math.max(0, Math.min(x1 - min, x0 + dx));
  else x1 = Math.min(frame.w, Math.max(x0 + min, x1 + dx));
  if (hd === 'nw' || hd === 'ne') y0 = Math.max(0, Math.min(y1 - min, y0 + dy));
  else y1 = Math.min(frame.h, Math.max(y0 + min, y1 + dy));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** The rectangle moved by (dx, dy), kept inside the frame. */
export function moveRect(r: Box, dx: number, dy: number, frame: Size): Box {
  return { x: Math.max(0, Math.min(frame.w - r.w, r.x + dx)), y: Math.max(0, Math.min(frame.h - r.h, r.y + dy)), w: r.w, h: r.h };
}

/** Intersection over union of two boxes (0 when apart). */
export function iou(a: Box, b: Box): number {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.w, b.x + b.w);
  const y1 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
}

const IRREGULAR: Record<string, string> = { person: 'people', knife: 'knives', mouse: 'mice', sheep: 'sheep', bus: 'buses', 'wine glass': 'wine glasses', 'hair drier': 'hair driers', toothbrush: 'toothbrushes', sandwich: 'sandwiches', bench: 'benches', couch: 'couches', 'potted plant': 'potted plants', 'tennis racket': 'tennis rackets' };

export function plural(label: string, n: number): string {
  if (n === 1) return label;
  const l = label.toLowerCase();
  if (IRREGULAR[l]) return IRREGULAR[l]!;
  if (/(s|x|z|ch|sh)$/.test(l)) return `${l}es`;
  if (/[^aeiou]y$/.test(l)) return `${l.slice(0, -1)}ies`;
  return `${l}s`;
}

/** How many of each label, most first (ties alphabetical). */
export function countLabels(dets: Detection[]): { label: string; n: number }[] {
  const m = new Map<string, number>();
  for (const d of dets) m.set(d.label, (m.get(d.label) ?? 0) + 1);
  return [...m].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
}

/** "2 cars · 1 person" ('' when nothing is in view). */
export function countLine(dets: Detection[], max = 4): string {
  const c = countLabels(dets);
  const shown = c.slice(0, max).map((x) => `${x.n} ${plural(x.label, x.n)}`);
  const rest = c.length - max;
  return shown.join(' · ') + (rest > 0 ? ` · +${rest} more` : '');
}

export const pct = (score: number): string => `${Math.round(Math.max(0, Math.min(1, score)) * 100)}%`;

/** The classifier's top guesses as one line: "laptop 62% · desk 20% · monitor 9%". */
export function sceneLine(cats: Category[], max = 3): string {
  return [...cats]
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((c) => `${c.label} ${pct(c.score)}`)
    .join(' · ');
}

/**
 * What the phone itself saw, in plain words ("labels car, person; scene street 60%; text "STOP"");
 * '' when nothing. Sent to the brain as its own `seen` field, which the brain marks as data about
 * the picture — never inside the owner's words.
 */
export function onDeviceSeen(dets: Detection[], scene: Category[], text = ''): string {
  const parts: string[] = [];
  const counts = countLabels(dets);
  if (counts.length) parts.push(`labels ${counts.map((c) => (c.n > 1 ? `${c.label} ×${c.n}` : c.label)).join(', ')}`);
  if (scene.length) parts.push(`scene ${sceneLine(scene, 3)}`);
  const t = text.replace(/\s+/g, ' ').trim();
  if (t) parts.push(`text "${t.slice(0, 600)}${t.length > 600 ? '…' : ''}"`);
  return parts.join('; ');
}

/** The same as a bracketed note ("[on-device: labels …; scene …]"). */
export function onDeviceSummary(dets: Detection[], scene: Category[], text = ''): string {
  const seen = onDeviceSeen(dets, scene, text);
  return seen ? `[on-device: ${seen}]` : '';
}

/** Detections from MediaPipe's result shape, cleaned up: a label, a score and a box each. */
export function fromMediaPipe(result: { detections?: { boundingBox?: { originX: number; originY: number; width: number; height: number }; categories?: { categoryName?: string; displayName?: string; score?: number }[] }[] } | null | undefined): Detection[] {
  const out: Detection[] = [];
  for (const d of result?.detections ?? []) {
    const c = d.categories?.[0];
    const b = d.boundingBox;
    if (!c || !b || !(b.width > 0) || !(b.height > 0)) continue;
    const label = String(c.displayName || c.categoryName || '').trim();
    if (!label) continue;
    out.push({ label, score: Number(c.score) || 0, box: { x: b.originX, y: b.originY, w: b.width, h: b.height } });
  }
  return out;
}

/** The classifier's top categories from MediaPipe's result shape. */
export function fromClassifier(result: { classifications?: { categories?: { categoryName?: string; displayName?: string; score?: number }[] }[] } | null | undefined, max = 3): Category[] {
  const cats = result?.classifications?.[0]?.categories ?? [];
  return cats
    .map((c) => ({ label: String(c.displayName || c.categoryName || '').replace(/_/g, ' ').trim(), score: Number(c.score) || 0 }))
    .filter((c) => c.label)
    .sort((a, b) => b.score - a.score)
    .slice(0, max);
}
