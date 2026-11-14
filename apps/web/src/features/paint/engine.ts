/**
 * PAINT's engine (APPS ROUND, lane COMIC): one painting is a stack of layers, each its own canvas the browser keeps on the
 * phone's graphics chip, with a blend mode, opacity, visibility, alpha lock, a mask and a reference flag. Every change is one
 * recorded step (a stroke with its points, a fill, a layer change), so:
 *  - UNDO and REDO restore exactly the pixels a step touched (only the box it changed is kept);
 *  - the TIME-LAPSE replays the recorded steps on a fresh painting, stroke by stroke, and can be saved as a video;
 *  - the same engine is the Comic maker's freehand inking.
 */
import { brushOf, dabOf, seeded, type Brush, type TipKind } from './brushes';
import { dabsAlong, mirrored, taperAt, type Pt, type Symmetry } from './stroke';
import { floodMask, traceOutline } from './pixels';
import { simplify } from './stroke';

export const BLENDS: { id: GlobalCompositeOperation; name: string }[] = [
  { id: 'source-over', name: 'Normal' }, { id: 'multiply', name: 'Multiply' }, { id: 'screen', name: 'Screen' }, { id: 'overlay', name: 'Overlay' },
  { id: 'darken', name: 'Darken' }, { id: 'lighten', name: 'Lighten' }, { id: 'color-dodge', name: 'Colour dodge' }, { id: 'color-burn', name: 'Colour burn' },
  { id: 'hard-light', name: 'Hard light' }, { id: 'soft-light', name: 'Soft light' }, { id: 'difference', name: 'Difference' }, { id: 'exclusion', name: 'Exclusion' },
  { id: 'hue', name: 'Hue' }, { id: 'saturation', name: 'Saturation' }, { id: 'color', name: 'Colour' }, { id: 'luminosity', name: 'Luminosity' },
];
export const blendName = (id: string): string => BLENDS.find((b) => b.id === id)?.name ?? 'Normal';
export const MAX_LAYERS = 12;
/** TEXT's type faces, from the phone's own fonts. */
export const FONTS: Record<string, string> = { lettering: 'ui-rounded, "SF Pro Rounded", system-ui, sans-serif', serif: 'Georgia, "Times New Roman", serif', hand: '"Bradley Hand", "Segoe Print", "Comic Sans MS", cursive', typewriter: 'ui-monospace, Menlo, Consolas, monospace' };
export const FONT_NAMES: Record<string, string> = { lettering: 'Lettering', serif: 'Book', hand: 'Handwriting', typewriter: 'Typewriter' };

export interface Layer {
  id: string;
  name: string;
  c: HTMLCanvasElement;
  blend: GlobalCompositeOperation;
  opacity: number;
  visible: boolean;
  alphaLock: boolean;
  reference: boolean;
  mask: HTMLCanvasElement | null;
}
export type Sel = { pts: number[]; inv: boolean } | null;
export type LayerProp = 'name' | 'blend' | 'opacity' | 'visible' | 'alphaLock' | 'reference';

/** One recorded step. Points are packed five to a point: x, y, pressure, altitude, azimuth. */
export type Op =
  | { k: 'stroke'; L: string; tool: 'brush' | 'erase' | 'liquify'; b: Brush; col: string; sym: Symmetry; cx: number; cy: number; seed: number; pts: Float32Array; onMask: boolean; sel: Sel }
  | { k: 'fill'; L: string; x: number; y: number; col: string; tol: number; ref: boolean; sel: Sel }
  | { k: 'clear'; L: string; sel?: Sel }
  | { k: 'add'; id: string; name: string; at: number }
  | { k: 'del'; L: string }
  | { k: 'move'; L: string; to: number }
  | { k: 'prop'; L: string; key: LayerProp; v: string | number | boolean }
  | { k: 'dup'; L: string; id: string }
  | { k: 'merge'; L: string }
  | { k: 'mask'; L: string; on: boolean }
  | { k: 'xform'; L: string; m: number[]; sel: Sel }
  | { k: 'pixels'; L: string; png: Blob; x: number; y: number; w: number; h: number }
  | { k: 'paper'; v: string }
  | { k: 'text'; L: string; x: number; y: number; text: string; font: string; size: number; col: string; sel: Sel }
  | { k: 'undo' }
  | { k: 'redo' };

type Step = { undo(): void; redo(): void; what: string };

export const mk = (w: number, h: number): HTMLCanvasElement => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
const ctx2 = (c: HTMLCanvasElement): CanvasRenderingContext2D => c.getContext('2d', { willReadFrequently: false })!;
let idSeq = 0;
export const layerId = (): string => `l${Date.now().toString(36)}${(idSeq++).toString(36)}`;

// ---- brush tips: a white picture with the tip's shape in its alpha, made once per kind and hardness
const TIP = 128;
const tipCache = new Map<string, HTMLCanvasElement>();
function tipOf(kind: TipKind, hardness: number): HTMLCanvasElement {
  const key = `${kind}:${hardness.toFixed(2)}`;
  const hit = tipCache.get(key);
  if (hit) return hit;
  const c = mk(TIP, TIP), g = ctx2(c), r = TIP / 2;
  const rnd = seeded(kind.length * 977 + Math.round(hardness * 100));
  if (kind === 'bristle') {
    // thick paint: a body of colour, with the bristles' streaks through it
    const body = g.createRadialGradient(r, r, 0, r, r, r * 0.95);
    body.addColorStop(0, 'rgba(255,255,255,0.6)'); body.addColorStop(0.8, 'rgba(255,255,255,0.5)'); body.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = body; g.beginPath(); g.arc(r, r, r, 0, Math.PI * 2); g.fill();
  }
  if (kind === 'grain' || kind === 'spray' || kind === 'bristle') {
    const dots = kind === 'grain' ? 900 : kind === 'spray' ? 1400 : 70;
    g.fillStyle = '#fff';
    for (let i = 0; i < dots; i++) {
      const a = rnd() * Math.PI * 2;
      const d = kind === 'spray' ? Math.sqrt(-2 * Math.log(rnd() + 1e-6)) * r * 0.32 : Math.sqrt(rnd()) * r * 0.92;
      if (d > r) continue;
      const s = kind === 'bristle' ? r * (0.08 + rnd() * 0.1) : kind === 'grain' ? 1.6 + rnd() * 2.2 : 1 + rnd() * 1.4;
      g.globalAlpha = kind === 'bristle' ? 0.7 + rnd() * 0.3 : 0.35 + rnd() * 0.65;
      g.beginPath(); g.arc(r + Math.cos(a) * d, r + Math.sin(a) * d, s, 0, Math.PI * 2); g.fill();
    }
  } else {
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    const hard = Math.max(0, Math.min(0.98, hardness));
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(hard, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    if (kind === 'flat') { g.fillRect(r * 0.08, r * 0.08, TIP - r * 0.16, TIP - r * 0.16); g.globalCompositeOperation = 'destination-in'; g.fillRect(0, 0, TIP, TIP); }
    else { g.beginPath(); g.arc(r, r, r, 0, Math.PI * 2); g.fill(); }
  }
  tipCache.set(key, c);
  return c;
}
const colourTips = new Map<string, HTMLCanvasElement>();
function colourTip(kind: TipKind, hardness: number, col: string): HTMLCanvasElement {
  const key = `${kind}:${hardness.toFixed(2)}:${col}`;
  const hit = colourTips.get(key);
  if (hit) return hit;
  if (colourTips.size > 48) colourTips.clear();
  const c = mk(TIP, TIP), g = ctx2(c);
  g.drawImage(tipOf(kind, hardness), 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = col;
  g.fillRect(0, 0, TIP, TIP);
  colourTips.set(key, c);
  return c;
}

export const unpack = (pts: Float32Array): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i + 4 < pts.length; i += 5) out.push({ x: pts[i]!, y: pts[i + 1]!, p: pts[i + 2]!, alt: pts[i + 3]!, az: pts[i + 4]!, t: i });
  return out;
};
export const pack = (pts: Pt[]): Float32Array => {
  const f = new Float32Array(pts.length * 5);
  pts.forEach((p, i) => { f[i * 5] = p.x; f[i * 5 + 1] = p.y; f[i * 5 + 2] = p.p; f[i * 5 + 3] = p.alt; f[i * 5 + 4] = p.az; });
  return f;
};

const selPath = (sel: Sel, w: number, h: number): Path2D | null => {
  if (!sel || sel.pts.length < 6) return null;
  const p = new Path2D();
  if (sel.inv) p.rect(0, 0, w, h);
  p.moveTo(sel.pts[0]!, sel.pts[1]!);
  for (let i = 2; i < sel.pts.length; i += 2) p.lineTo(sel.pts[i]!, sel.pts[i + 1]!);
  p.closePath();
  return p;
};

/** The box a stroke can touch, padded by the brush. */
function boxOf(pts: Pt[], pad: number, sym: Symmetry, cx: number, cy: number, w: number, h: number): { x: number; y: number; w: number; h: number } {
  if (sym !== 'off') return { x: 0, y: 0, w, h };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  void cx; void cy;
  const x = Math.max(0, Math.floor(x0 - pad)), y = Math.max(0, Math.floor(y0 - pad));
  return { x, y, w: Math.max(1, Math.min(w, Math.ceil(x1 + pad)) - x), h: Math.max(1, Math.min(h, Math.ceil(y1 + pad)) - y) };
}

export class Painting {
  w: number;
  h: number;
  layers: Layer[] = [];
  cur = 0;
  paper = '#ffffff';
  log: Op[] = [];
  recording = true;
  private past: Step[] = [];
  private future: Step[] = [];
  /** the wet stroke, drawn on its own sheet and laid on the layer when the stroke ends */
  wet: HTMLCanvasElement;
  private scratch: HTMLCanvasElement;
  private scratch2: HTMLCanvasElement;
  private patch: HTMLCanvasElement;
  /** what the target looked like before this stroke, for UNDO */
  private before: HTMLCanvasElement;
  flat: HTMLCanvasElement;
  live: { L: string; tool: 'brush' | 'erase' | 'liquify'; b: Brush; onMask: boolean; sel: Sel } | null = null;
  preview: { L: string; c: HTMLCanvasElement } | null = null;
  changed = 0;
  onChange: (() => void) | null = null;

  constructor(w: number, h: number) {
    this.w = w; this.h = h;
    this.wet = mk(w, h); this.scratch = mk(w, h); this.scratch2 = mk(w, h); this.before = mk(w, h); this.flat = mk(w, h);
    this.patch = mk(TIP * 4, TIP * 4);
  }

  get layer(): Layer { return this.layers[this.cur]!; }
  byId(id: string): Layer | undefined { return this.layers.find((l) => l.id === id); }
  indexOf(id: string): number { return this.layers.findIndex((l) => l.id === id); }
  canUndo(): boolean { return this.past.length > 0; }
  canRedo(): boolean { return this.future.length > 0; }
  undoWhat(): string { return this.past[this.past.length - 1]?.what ?? ''; }
  steps(): { undo: number; redo: number } { return { undo: this.past.length, redo: this.future.length }; }

  private record(op: Op): void { if (this.recording) this.log.push(op); }
  private push(s: Step): void {
    this.past.push(s);
    if (this.past.length > 60) this.past.shift();
    this.future = [];
    this.touch();
  }
  touch(): void { this.changed++; this.onChange?.(); }

  undo(): boolean {
    const s = this.past.pop();
    if (!s) return false;
    s.undo(); this.future.push(s); this.record({ k: 'undo' }); this.touch();
    return true;
  }
  redo(): boolean {
    const s = this.future.pop();
    if (!s) return false;
    s.redo(); this.past.push(s); this.record({ k: 'redo' }); this.touch();
    return true;
  }

  /** Pixels of a box before and after, kept as one step. */
  private pixelStep(what: string, target: () => HTMLCanvasElement | null, box: { x: number; y: number; w: number; h: number }, beforeData: ImageData): void {
    const t = target();
    if (!t) return;
    const after = ctx2(t).getImageData(box.x, box.y, box.w, box.h);
    this.push({
      what,
      undo: () => { const c = target(); if (c) ctx2(c).putImageData(beforeData, box.x, box.y); },
      redo: () => { const c = target(); if (c) ctx2(c).putImageData(after, box.x, box.y); },
    });
  }
  private targetOf(id: string, onMask: boolean): () => HTMLCanvasElement | null {
    return () => { const L = this.byId(id); return L ? (onMask ? L.mask : L.c) : null; };
  }

  // ---- layers
  apply(op: Op): void {
    switch (op.k) {
      case 'add': return this.addLayer(op.name, op.at, op.id);
      case 'del': return this.deleteLayer(op.L);
      case 'move': return this.moveLayer(op.L, op.to);
      case 'prop': return this.setProp(op.L, op.key, op.v);
      case 'dup': return this.duplicate(op.L, op.id);
      case 'merge': return this.mergeDown(op.L);
      case 'mask': return this.setMask(op.L, op.on);
      case 'clear': return this.clearLayer(op.L, op.sel ?? null);
      case 'fill': return void this.fill(op.L, op.x, op.y, op.col, op.tol, op.ref, op.sel);
      case 'stroke': return this.strokeOp(op);
      case 'xform': return this.transform(op.L, op.m, op.sel);
      case 'paper': return this.setPaper(op.v);
      case 'text': return this.addText(op.L, op.x, op.y, op.text, op.font, op.size, op.col, op.sel);
      case 'undo': return void this.undo();
      case 'redo': return void this.redo();
      case 'pixels': return; // pictures are drawn by placeAsync
    }
  }

  addLayer(name: string, at = this.cur + 1, id = layerId()): void {
    if (this.layers.length >= MAX_LAYERS) return;
    const L: Layer = { id, name, c: mk(this.w, this.h), blend: 'source-over', opacity: 1, visible: true, alphaLock: false, reference: false, mask: null };
    const i = Math.max(0, Math.min(this.layers.length, at));
    const prevCur = this.cur;
    this.layers.splice(i, 0, L);
    this.cur = i;
    this.record({ k: 'add', id, name, at: i });
    this.push({
      what: 'new layer',
      undo: () => { const j = this.indexOf(id); if (j >= 0) this.layers.splice(j, 1); this.cur = Math.min(prevCur, this.layers.length - 1); },
      redo: () => { this.layers.splice(i, 0, L); this.cur = i; },
    });
  }
  deleteLayer(id: string): void {
    const i = this.indexOf(id);
    if (i < 0 || this.layers.length <= 1) return;
    const L = this.layers[i]!;
    this.layers.splice(i, 1);
    this.cur = Math.max(0, Math.min(this.cur, this.layers.length - 1));
    this.record({ k: 'del', L: id });
    this.push({ what: 'delete layer', undo: () => { this.layers.splice(i, 0, L); this.cur = i; }, redo: () => { const j = this.indexOf(id); if (j >= 0) this.layers.splice(j, 1); this.cur = Math.max(0, Math.min(this.cur, this.layers.length - 1)); } });
  }
  moveLayer(id: string, to: number): void {
    const i = this.indexOf(id);
    const j = Math.max(0, Math.min(this.layers.length - 1, to));
    if (i < 0 || i === j) return;
    const swap = (a: number, b: number): void => { const [L] = this.layers.splice(a, 1); this.layers.splice(b, 0, L!); this.cur = b; };
    swap(i, j);
    this.record({ k: 'move', L: id, to: j });
    this.push({ what: 'move layer', undo: () => swap(j, i), redo: () => swap(i, j) });
  }
  setProp(id: string, key: LayerProp, v: string | number | boolean): void {
    const L = this.byId(id);
    if (!L) return;
    const old = L[key];
    if (old === v) return;
    const set = (x: unknown): void => { (L as unknown as Record<string, unknown>)[key] = x; };
    set(v);
    this.record({ k: 'prop', L: id, key, v });
    // only one reference layer at a time
    const others = key === 'reference' && v ? this.layers.filter((o) => o !== L && o.reference) : [];
    for (const o of others) o.reference = false;
    this.push({ what: key === 'visible' ? (v ? 'show layer' : 'hide layer') : `layer ${key}`, undo: () => { set(old); for (const o of others) o.reference = true; }, redo: () => { set(v); for (const o of others) o.reference = false; } });
  }
  duplicate(id: string, newId = layerId()): void {
    const i = this.indexOf(id);
    if (i < 0 || this.layers.length >= MAX_LAYERS) return;
    const src = this.layers[i]!;
    const c = mk(this.w, this.h);
    ctx2(c).drawImage(src.c, 0, 0);
    let mask: HTMLCanvasElement | null = null;
    if (src.mask) { mask = mk(this.w, this.h); ctx2(mask).drawImage(src.mask, 0, 0); }
    const L: Layer = { ...src, id: newId, name: `${src.name} copy`, c, mask, reference: false };
    this.layers.splice(i + 1, 0, L);
    this.cur = i + 1;
    this.record({ k: 'dup', L: id, id: newId });
    this.push({ what: 'duplicate layer', undo: () => { const j = this.indexOf(newId); if (j >= 0) this.layers.splice(j, 1); this.cur = i; }, redo: () => { this.layers.splice(i + 1, 0, L); this.cur = i + 1; } });
  }
  mergeDown(id: string): void {
    const i = this.indexOf(id);
    if (i <= 0) return;
    const top = this.layers[i]!, below = this.layers[i - 1]!;
    const beforeData = ctx2(below.c).getImageData(0, 0, this.w, this.h);
    const g = ctx2(below.c);
    g.save(); g.globalAlpha = top.visible ? top.opacity : 0; g.globalCompositeOperation = top.blend;
    g.drawImage(this.masked(top, top.c), 0, 0); g.restore();
    const afterData = g.getImageData(0, 0, this.w, this.h);
    this.layers.splice(i, 1);
    this.cur = i - 1;
    this.record({ k: 'merge', L: id });
    this.push({
      what: 'merge down',
      undo: () => { ctx2(below.c).putImageData(beforeData, 0, 0); this.layers.splice(i, 0, top); this.cur = i; },
      redo: () => { ctx2(below.c).putImageData(afterData, 0, 0); const j = this.indexOf(top.id); if (j >= 0) this.layers.splice(j, 1); this.cur = i - 1; },
    });
  }
  setMask(id: string, on: boolean): void {
    const L = this.byId(id);
    if (!L || !!L.mask === on) return;
    const old = L.mask;
    let made: HTMLCanvasElement | null = null;
    if (on) { made = mk(this.w, this.h); const g = ctx2(made); g.fillStyle = '#fff'; g.fillRect(0, 0, this.w, this.h); }
    L.mask = made;
    this.record({ k: 'mask', L: id, on });
    this.push({ what: on ? 'add mask' : 'remove mask', undo: () => { L.mask = old; }, redo: () => { L.mask = made; } });
  }
  /** Clear a layer, or only the part inside the selection. */
  clearLayer(id: string, sel: Sel = null): void {
    const L = this.byId(id);
    if (!L) return;
    const g = ctx2(L.c);
    const beforeData = g.getImageData(0, 0, this.w, this.h);
    const path = selPath(sel, this.w, this.h);
    if (path) { g.save(); g.globalCompositeOperation = 'destination-out'; g.fill(path, 'evenodd'); g.restore(); }
    else g.clearRect(0, 0, this.w, this.h);
    this.record(sel ? { k: 'clear', L: id, sel } : { k: 'clear', L: id });
    this.pixelStep('clear layer', this.targetOf(id, false), { x: 0, y: 0, w: this.w, h: this.h }, beforeData);
  }
  setPaper(v: string): void {
    const old = this.paper;
    if (old === v) return;
    this.paper = v;
    this.record({ k: 'paper', v });
    this.push({ what: 'paper', undo: () => { this.paper = old; }, redo: () => { this.paper = v; } });
  }

  /** Words on a layer, centred on (x, y), a line at a time, in one of the type faces TEXT offers. */
  addText(id: string, x: number, y: number, text: string, font: string, size: number, col: string, sel: Sel): void {
    const L = this.byId(id);
    if (!L || !text.trim()) return;
    const g = ctx2(L.c);
    const lines = text.split('\n').slice(0, 12);
    g.save();
    g.font = `700 ${size}px ${FONTS[font] ?? FONTS.lettering}`;
    const wMax = Math.max(...lines.map((l) => g.measureText(l).width));
    const lh = size * 1.2, hAll = lh * lines.length;
    const box = { x: Math.max(0, Math.floor(x - wMax / 2 - size)), y: Math.max(0, Math.floor(y - hAll / 2 - size)), w: 0, h: 0 };
    box.w = Math.max(1, Math.min(this.w - box.x, Math.ceil(wMax + size * 2))); box.h = Math.max(1, Math.min(this.h - box.y, Math.ceil(hAll + size * 2)));
    const beforeData = g.getImageData(box.x, box.y, box.w, box.h);
    const path = selPath(sel, this.w, this.h);
    if (path) g.clip(path, 'evenodd');
    if (L.alphaLock) g.globalCompositeOperation = 'source-atop';
    g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((l, i) => g.fillText(l, x, y - hAll / 2 + lh * (i + 0.5)));
    g.restore();
    this.record({ k: 'text', L: id, x, y, text, font, size, col, sel });
    this.pixelStep('text', this.targetOf(id, false), box, beforeData);
  }

  /** A picture (his photo, line art, an import) drawn onto a layer, recorded with its pixels so the time-lapse shows it. */
  async placeAsync(id: string, png: Blob, x = 0, y = 0, w = this.w, h = this.h): Promise<void> {
    const L = this.byId(id);
    if (!L) return;
    const bmp = await createImageBitmap(png);
    const g = ctx2(L.c);
    const box = { x: Math.max(0, Math.floor(x)), y: Math.max(0, Math.floor(y)), w: Math.min(this.w, Math.ceil(w)), h: Math.min(this.h, Math.ceil(h)) };
    box.w = Math.max(1, Math.min(this.w - box.x, box.w)); box.h = Math.max(1, Math.min(this.h - box.y, box.h));
    const beforeData = g.getImageData(box.x, box.y, box.w, box.h);
    g.drawImage(bmp, x, y, w, h);
    bmp.close?.();
    this.record({ k: 'pixels', L: id, png, x, y, w, h });
    this.pixelStep('place picture', this.targetOf(id, false), box, beforeData);
  }

  // ---- strokes
  /** Start a stroke: the target's pixels are kept for UNDO, and the wet sheet is cleared. */
  begin(tool: 'brush' | 'erase' | 'liquify', b: Brush, onMask: boolean, sel: Sel): void {
    const L = this.layer;
    const t = onMask && L.mask ? L.mask : L.c;
    const g = ctx2(this.before);
    g.clearRect(0, 0, this.w, this.h); g.drawImage(t, 0, 0);
    ctx2(this.wet).clearRect(0, 0, this.w, this.h);
    this.live = { L: L.id, tool, b, onMask: onMask && !!L.mask, sel };
  }

  /** Dabs for a run of points: mirrored, scattered, tapered, sized and coloured. Draws onto the wet sheet (or the layer for
   * liquify). `full` is set on the final pass, when the whole length is known for the end taper. */
  dabs(pts: Pt[], b: Brush, col: string, sym: Symmetry, cx: number, cy: number, seed: number, carry: { at: number; dist: number; prev: Pt | null; rnd: () => number }, full = 0): void {
    if (!this.live) return;
    const tool = this.live.tool;
    const target = tool === 'liquify' ? (this.live.onMask ? this.byId(this.live.L)?.mask : this.byId(this.live.L)?.c) : this.wet;
    if (!target) return;
    const g = ctx2(target);
    const tipC = tool === 'erase' ? colourTip(b.tip, b.hardness, '#000') : colourTip(b.tip, b.hardness, this.live.onMask ? (tool === 'brush' ? '#000' : '#fff') : col);
    void seed;
    for (const p of pts) {
      if (!carry.prev) { carry.prev = p; this.dab(g, p, p, b, tipC, sym, cx, cy, carry, full, tool); continue; }
      const step = Math.max(0.6, b.size * (b.pSize ? 0.5 + 0.5 * p.p : 1) * b.spacing);
      const { dabs, carry: left } = dabsAlong(carry.prev, p, step, carry.at);
      for (const d of dabs) { this.dab(g, carry.prev, d, b, tipC, sym, cx, cy, carry, full, tool); carry.dist += step; }
      carry.at = left;
      carry.prev = p;
    }
  }

  private dab(g: CanvasRenderingContext2D, from: Pt, p: Pt, b: Brush, tipC: HTMLCanvasElement, sym: Symmetry, cx: number, cy: number, carry: { dist: number; rnd: () => number }, full: number, tool: string): void {
    const pr = Math.max(0.05, p.p);
    const { r: r0, a: a0, stretch } = dabOf(b, b.size, 1, pr, p.alt);
    const tap = b.taper ? Math.min(taperAt(carry.dist, full || Infinity, b.taper), 1) : 1;
    const r = Math.max(0.5, r0 * tap);
    // within one stroke the dabs add up to the pressure's opacity, not past it (except a brush that builds up)
    const a = b.buildUp ? b.flow * a0 : 1 - Math.pow(1 - Math.min(0.995, a0 * (0.5 + 0.5 * b.flow)), Math.min(1, b.spacing * 1.5));
    const ang = b.tip === 'round' && b.roundness === 1 ? 0 : b.tip === 'grain' || b.tip === 'spray' ? carry.rnd() * Math.PI * 2 : p.az + Math.PI / 4;
    const sc = b.scatter;
    for (const m of mirrored(p.x, p.y, sym, cx, cy)) {
      let x = m.x, y = m.y;
      if (sc) { x += (carry.rnd() - 0.5) * sc * r * 2; y += (carry.rnd() - 0.5) * sc * r * 2; }
      if (tool === 'liquify') { if (!b.lq || b.lq === 'push') this.push_(g, from, p, m, cx, cy, sym, r, b.flow * a0); else this.warp(g, m.x, m.y, r, b.lq, b.flow * a0 * (m.flip && b.lq === 'twirl' ? -1 : 1)); continue; }
      if (b.mix > 0 && this.live && !this.live.onMask) this.mixDab(g, from, p, m, cx, cy, sym, r, b.mix);
      const rot = ang + m.rot + (m.flip ? Math.PI / 2 : 0);
      const cos = Math.cos(rot), sin = Math.sin(rot);
      g.setTransform(cos * stretch, sin * stretch, -sin * b.roundness, cos * b.roundness, x, y);
      g.globalAlpha = Math.max(0, Math.min(1, a));
      g.drawImage(tipC, -r, -r, r * 2, r * 2);
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
  }

  /** Oils: the colour under the brush is pulled along with the paint. */
  private mixDab(g: CanvasRenderingContext2D, from: Pt, p: Pt, m: { x: number; y: number }, cx: number, cy: number, sym: Symmetry, r: number, mix: number): void {
    const L = this.live ? this.byId(this.live.L) : null;
    if (!L) return;
    const src = mirrored(from.x, from.y, sym, cx, cy).sort((u, v) => Math.hypot(u.x - m.x, u.y - m.y) - Math.hypot(v.x - m.x, v.y - m.y))[0]!;
    const s = Math.ceil(r * 2);
    if (s < 2 || s > this.patch.width) return;
    const pg = ctx2(this.patch);
    pg.setTransform(1, 0, 0, 1, 0, 0);
    pg.globalCompositeOperation = 'copy';
    pg.drawImage(L.c, src.x - r, src.y - r, s, s, 0, 0, s, s);
    pg.globalCompositeOperation = 'destination-in';
    pg.drawImage(tipOf('soft', 0.4), 0, 0, s, s);
    pg.globalCompositeOperation = 'source-over';
    g.globalAlpha = mix;
    g.drawImage(this.patch, 0, 0, s, s, m.x - r, m.y - r, s, s);
    void p;
  }

  /** Liquify's twirl, pinch and expand: each pixel under the brush is taken from a point turned round, or drawn in or out from,
   * the brush's centre, most at the middle and fading to nothing at its edge. */
  private warp(g: CanvasRenderingContext2D, x: number, y: number, r: number, kind: 'twirl' | 'pinch' | 'expand', strength: number): void {
    const x0 = Math.max(0, Math.floor(x - r)), y0 = Math.max(0, Math.floor(y - r));
    const x1 = Math.min(this.w, Math.ceil(x + r)), y1 = Math.min(this.h, Math.ceil(y + r));
    const w = x1 - x0, h = y1 - y0;
    if (w < 2 || h < 2) return;
    const src = g.getImageData(x0, y0, w, h);
    const out = new ImageData(new Uint8ClampedArray(src.data), w, h);
    const k = Math.max(-1, Math.min(1, strength)) * 0.35;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const dx = x0 + i + 0.5 - x, dy = y0 + j + 0.5 - y;
      const d = Math.hypot(dx, dy);
      if (d >= r) continue;
      const f = (1 - d / r) ** 2;
      let sx: number, sy: number;
      if (kind === 'twirl') { const a = k * f * 1.2, c = Math.cos(a), s = Math.sin(a); sx = x + dx * c - dy * s; sy = y + dx * s + dy * c; }
      else { const sc = 1 + (kind === 'pinch' ? 1 : -1) * k * f; sx = x + dx * sc; sy = y + dy * sc; }
      const u = Math.max(0, Math.min(w - 1, Math.round(sx - x0 - 0.5))), v = Math.max(0, Math.min(h - 1, Math.round(sy - y0 - 0.5)));
      const a = (j * w + i) * 4, b = (v * w + u) * 4;
      out.data[a] = src.data[b]!; out.data[a + 1] = src.data[b + 1]!; out.data[a + 2] = src.data[b + 2]!; out.data[a + 3] = src.data[b + 3]!;
    }
    g.putImageData(out, x0, y0);
  }

  /** Liquify: the pixels under the brush are pushed along the stroke. */
  private push_(g: CanvasRenderingContext2D, from: Pt, p: Pt, m: { x: number; y: number }, cx: number, cy: number, sym: Symmetry, r: number, strength: number): void {
    const src = mirrored(from.x, from.y, sym, cx, cy).sort((u, v) => Math.hypot(u.x - m.x, u.y - m.y) - Math.hypot(v.x - m.x, v.y - m.y))[0]!;
    const s = Math.ceil(r * 2);
    if (s < 2 || s > this.patch.width) return;
    const pg = ctx2(this.patch);
    pg.setTransform(1, 0, 0, 1, 0, 0);
    pg.globalCompositeOperation = 'copy';
    pg.drawImage(g.canvas, src.x - r, src.y - r, s, s, 0, 0, s, s);
    pg.globalCompositeOperation = 'destination-in';
    pg.drawImage(tipOf('soft', 0.3), 0, 0, s, s);
    pg.globalCompositeOperation = 'source-over';
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = Math.min(1, strength);
    g.drawImage(this.patch, 0, 0, s, s, m.x - r, m.y - r, s, s);
    g.globalAlpha = 1;
    void p;
  }

  /** Lay the wet sheet on a canvas the way the brush lands (a stroke's opacity, multiply, erase, alpha lock, the selection). */
  private lay(g: CanvasRenderingContext2D, b: Brush, tool: string, onMask: boolean, lock: boolean, sel: Sel): void {
    g.save();
    const path = selPath(sel, this.w, this.h);
    if (path) g.clip(path, 'evenodd');
    if (b.wetEdge > 0 && tool === 'brush' && !onMask && 'filter' in g) {
      // the rim where watercolour dries: the stroke minus a blurred copy of itself
      const s2 = ctx2(this.scratch2);
      s2.setTransform(1, 0, 0, 1, 0, 0);
      s2.globalCompositeOperation = 'copy'; s2.globalAlpha = 1; s2.drawImage(this.wet, 0, 0);
      s2.globalCompositeOperation = 'destination-out'; s2.filter = 'blur(5px)'; s2.drawImage(this.wet, 0, 0); s2.filter = 'none';
      s2.globalCompositeOperation = 'source-over';
      g.globalAlpha = b.opacity * 0.8; g.globalCompositeOperation = lock ? 'source-atop' : b.mode === 'multiply' ? 'multiply' : 'source-over';
      g.drawImage(this.wet, 0, 0);
      g.globalAlpha = b.wetEdge;
      g.drawImage(this.scratch2, 0, 0);
      g.drawImage(this.scratch2, 0, 0);
    } else {
      g.globalAlpha = tool === 'brush' ? b.opacity : Math.max(0.05, b.opacity);
      g.globalCompositeOperation = onMask ? (tool === 'brush' ? 'destination-out' : 'source-over') : tool === 'erase' ? 'destination-out' : lock ? 'source-atop' : b.mode === 'multiply' ? 'multiply' : 'source-over';
      g.drawImage(this.wet, 0, 0);
    }
    g.restore();
  }

  /** End the live stroke as one recorded step. */
  end(op: Extract<Op, { k: 'stroke' }>): void {
    if (!this.live) return;
    const L = this.byId(op.L);
    const t = L ? (op.onMask && L.mask ? L.mask : L.c) : null;
    if (!L || !t) { this.live = null; return; }
    const all = unpack(op.pts);
    const pad = op.b.size * 3 + 8;
    const box = boxOf(all, pad, op.sym, op.cx, op.cy, this.w, this.h);
    const beforeData = ctx2(this.before).getImageData(box.x, box.y, box.w, box.h);
    if (op.tool !== 'liquify') {
      // the final pass knows the stroke's whole length, so both ends taper
      ctx2(this.wet).clearRect(0, 0, this.w, this.h);
      const len = all.reduce((s, p, i) => (i ? s + Math.hypot(p.x - all[i - 1]!.x, p.y - all[i - 1]!.y) : 0), 0);
      this.dabs(all, op.b, op.col, op.sym, op.cx, op.cy, op.seed, { at: 0, dist: 0, prev: null, rnd: seeded(op.seed) }, Math.max(1, len));
      this.lay(ctx2(t), op.b, op.tool, op.onMask, L.alphaLock, op.sel);
      ctx2(this.wet).clearRect(0, 0, this.w, this.h);
    }
    this.live = null;
    this.record(op);
    this.pixelStep(op.tool === 'erase' ? 'erase' : op.tool === 'liquify' ? 'liquify' : op.b.name.toLowerCase(), this.targetOf(op.L, op.onMask), box, beforeData);
  }

  /** Cancel the live stroke (a second finger landed: it was a pinch, not a stroke). */
  cancel(): void {
    if (!this.live) return;
    const L = this.byId(this.live.L);
    const t = L ? (this.live.onMask && L.mask ? L.mask : L.c) : null;
    if (t && this.live.tool === 'liquify') { const g = ctx2(t); g.globalCompositeOperation = 'copy'; g.drawImage(this.before, 0, 0); g.globalCompositeOperation = 'source-over'; }
    ctx2(this.wet).clearRect(0, 0, this.w, this.h);
    this.live = null;
  }

  /** Replay a recorded stroke (the time-lapse, and redo of a stroke from the log). */
  strokeOp(op: Extract<Op, { k: 'stroke' }>): void {
    const i = this.indexOf(op.L);
    if (i < 0) return;
    const prev = this.cur;
    this.cur = i;
    this.begin(op.tool, op.b, op.onMask, op.sel);
    if (op.tool === 'liquify') this.dabs(unpack(op.pts), op.b, op.col, op.sym, op.cx, op.cy, op.seed, { at: 0, dist: 0, prev: null, rnd: seeded(op.seed) });
    this.end(op);
    this.cur = Math.min(prev, this.layers.length - 1);
  }

  // ---- fill, transform
  /** The bucket: fills the area under his tap, reading the reference layer's lines if one is set, or the whole picture. */
  fill(id: string, x: number, y: number, col: string, tol: number, ref: boolean, sel: Sel): boolean {
    const L = this.byId(id);
    if (!L) return false;
    const refL = ref ? this.layers.find((l) => l.reference) : undefined;
    // the reference layer's lines when one is set, else this layer's own paint (as the leaders' buckets do)
    const src = refL ? refL.c : L.c;
    const data = ctx2(src).getImageData(0, 0, this.w, this.h).data;
    const got = floodMask(data, this.w, this.h, x, y, tol, 2);
    if (!got || got.box.w * got.box.h <= 0) return false;
    const { mask, box } = got;
    const img = new ImageData(box.w, box.h);
    const n = parseInt(col.slice(1), 16);
    const r = (n >> 16) & 255, gg = (n >> 8) & 255, bb = n & 255;
    for (let yy = 0; yy < box.h; yy++) for (let xx = 0; xx < box.w; xx++) {
      if (!mask[(box.y + yy) * this.w + box.x + xx]) continue;
      const j = (yy * box.w + xx) * 4;
      img.data[j] = r; img.data[j + 1] = gg; img.data[j + 2] = bb; img.data[j + 3] = 255;
    }
    const pc = mk(box.w, box.h);
    ctx2(pc).putImageData(img, 0, 0);
    const g = ctx2(L.c);
    const beforeData = g.getImageData(box.x, box.y, box.w, box.h);
    g.save();
    const path = selPath(sel, this.w, this.h);
    if (path) g.clip(path, 'evenodd');
    if (L.alphaLock) g.globalCompositeOperation = 'source-atop';
    g.drawImage(pc, box.x, box.y);
    g.restore();
    this.record({ k: 'fill', L: id, x, y, col, tol, ref, sel });
    this.pixelStep('fill', this.targetOf(id, false), box, beforeData);
    return true;
  }

  /** Move, scale, turn or flip a layer (or the part inside the selection) by a matrix [a, b, c, d, e, f]. */
  transformed(id: string, m: number[], sel: Sel): HTMLCanvasElement | null {
    const L = this.byId(id);
    if (!L) return null;
    const out = mk(this.w, this.h), g = ctx2(out);
    const path = selPath(sel, this.w, this.h);
    const lift = ctx2(this.scratch2);
    lift.setTransform(1, 0, 0, 1, 0, 0);
    lift.globalCompositeOperation = 'copy';
    lift.drawImage(L.c, 0, 0);
    lift.globalCompositeOperation = 'source-over';
    if (path) {
      lift.globalCompositeOperation = 'destination-in'; lift.fill(path, 'evenodd'); lift.globalCompositeOperation = 'source-over';
      g.drawImage(L.c, 0, 0);
      g.save(); g.globalCompositeOperation = 'destination-out'; g.fill(path, 'evenodd'); g.restore();
    }
    g.setTransform(m[0]!, m[1]!, m[2]!, m[3]!, m[4]!, m[5]!);
    g.drawImage(this.scratch2, 0, 0);
    g.setTransform(1, 0, 0, 1, 0, 0);
    return out;
  }
  transform(id: string, m: number[], sel: Sel): void {
    const L = this.byId(id);
    const out = this.transformed(id, m, sel);
    if (!L || !out) return;
    const g = ctx2(L.c);
    const beforeData = g.getImageData(0, 0, this.w, this.h);
    g.globalCompositeOperation = 'copy'; g.drawImage(out, 0, 0); g.globalCompositeOperation = 'source-over';
    this.record({ k: 'xform', L: id, m, sel });
    this.pixelStep('transform', this.targetOf(id, false), { x: 0, y: 0, w: this.w, h: this.h }, beforeData);
  }

  // ---- compositing
  private masked(L: Layer, src: HTMLCanvasElement): HTMLCanvasElement {
    if (!L.mask) return src;
    const g = ctx2(this.scratch2);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'copy'; g.globalAlpha = 1; g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'destination-in'; g.drawImage(L.mask, 0, 0);
    g.globalCompositeOperation = 'source-over';
    return this.scratch2;
  }

  /** The whole picture into `into`: paper, then every visible layer with its blend mode, opacity and mask, with the live stroke
   * or a transform's preview shown on its layer. */
  composite(into: HTMLCanvasElement = this.flat, o: { paper?: boolean; only?: string } = {}): HTMLCanvasElement {
    const g = ctx2(into);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, this.w, this.h);
    if (o.paper !== false && this.paper !== 'none') { g.fillStyle = this.paper; g.fillRect(0, 0, this.w, this.h); }
    for (const L of this.layers) {
      if (!L.visible || (o.only && L.id !== o.only)) continue;
      let src = L.c;
      if (this.preview && this.preview.L === L.id) src = this.preview.c;
      else if (this.live && this.live.L === L.id && this.live.tool !== 'liquify') {
        const s = ctx2(this.scratch);
        s.setTransform(1, 0, 0, 1, 0, 0);
        s.globalCompositeOperation = 'copy'; s.globalAlpha = 1;
        if (this.live.onMask) {
          s.drawImage(L.c, 0, 0);
        } else {
          s.drawImage(L.c, 0, 0);
          this.layQuick(s, L);
        }
        src = this.scratch;
      }
      g.globalAlpha = L.opacity;
      g.globalCompositeOperation = L.blend;
      g.drawImage(this.masked(L, src), 0, 0);
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    return into;
  }
  private layQuick(s: CanvasRenderingContext2D, L: Layer): void {
    if (!this.live) return;
    const { b, tool, sel } = this.live;
    s.save();
    const path = selPath(sel, this.w, this.h);
    if (path) s.clip(path, 'evenodd');
    s.globalAlpha = b.opacity;
    s.globalCompositeOperation = tool === 'erase' ? 'destination-out' : L.alphaLock ? 'source-atop' : b.mode === 'multiply' ? 'multiply' : 'source-over';
    s.drawImage(this.wet, 0, 0);
    s.restore();
  }

  /** The magic wand: the area of like colour round a point of what he sees, as a selection outline. */
  wand(x: number, y: number, tol = 28): Sel {
    const c = this.composite(this.scratch, {});
    const data = ctx2(c).getImageData(0, 0, this.w, this.h).data;
    const got = floodMask(data, this.w, this.h, x, y, tol, 1);
    if (!got) return null;
    const ring = traceOutline(got.mask, this.w, this.h);
    if (ring.length < 6) return null;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < ring.length; i += 2) pts.push({ x: ring[i]!, y: ring[i + 1]! });
    const s = simplify(pts, 1.2);
    return s.length >= 3 ? { pts: s.flatMap((q) => [q.x, q.y]), inv: false } : null;
  }

  /** The colour at a point of the whole picture (the eyedropper). */
  colourAt(x: number, y: number): string {
    const c = this.composite(this.scratch, {});
    const d = ctx2(c).getImageData(Math.max(0, Math.min(this.w - 1, Math.floor(x))), Math.max(0, Math.min(this.h - 1, Math.floor(y))), 1, 1).data;
    return `#${[d[0]!, d[1]!, d[2]!].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  }

  /** How many pixels of a layer have paint (for the specs and the empty-layer word). */
  inked(id: string): number {
    const L = this.byId(id);
    if (!L) return 0;
    const small = mk(Math.ceil(this.w / 8), Math.ceil(this.h / 8));
    const g = ctx2(small);
    g.drawImage(L.c, 0, 0, small.width, small.height);
    const d = g.getImageData(0, 0, small.width, small.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i]! > 8) n++;
    return n;
  }
}

export const blankBrush = (): Brush => ({ ...brushOf('ink') });
