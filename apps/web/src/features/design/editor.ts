/**
 * DESIGN (THE APPS ROUND, lane SITES): one free canvas for posters, invitations, cards, menus, stories, posts and thumbnails.
 * Every part moves by hand: drag to move (snapping to the page and to the other parts, with guides), corners to resize, the top
 * handle to rotate, the layers list to order, hide and lock. Designed templates at every size, magic resize into any other size,
 * a brand kit (his colours and two faces, starting from his look), his own photos (made smaller here, never uploaded), undo and
 * redo for every change, saving as he goes, his designs and a Recently deleted bin, all kept on this phone. Exports are made here
 * on his tap: a PNG, an SVG, a print PDF with bleed, or a page on his sites, which goes up only after his APPROVE in the chat.
 * The model is packages/shared/src/design/model.ts (the brain's tests check it); the state sits on window.__ghosty.design.
 */
import { alignLayers, BLEED_MM, contrastOf, creditsOf, DEFAULT_BRAND, type Design, FONTS, type FontId, fromTemplate, type Guide, inkOn, isFont, type Layer, magicResize, type Measure, newId, OCCASIONS, pdfOf, printSize, PT_PER_MM, readBrand, readDesign, reorder, SIZES, sizeOf, type SizeId, sitePageOf, snapBox, TEMPLATES, toSvg, wordsOf, wrapText, type AlignHow, type Brand } from '../../../../../packages/shared/src/design/model';
import { clear, h } from '../../core/dom';
import { button } from '../../ui/components';
import { loadFont, pngOf, saveFile } from '../creative/draw';
import { putOnSites } from '../../sites/handover';
import { sayError } from '../../ui/hisWords';

const KEY = { index: 'ghosty-design:index', doc: 'ghosty-design:d:', bin: 'ghosty-design:bin', brand: 'ghosty-design:brand', current: 'ghosty-design:current' };
const MAX_DESIGNS = 40;
const MAX_HISTORY = 120;

export const designState = { open: '', name: '', size: '', w: 0, h: 0, layers: 0, selected: '', kind: '', undo: 0, redo: 0, saved: 0, kept: 0, bin: 0, guides: 0, exported: '', bytes: 0, said: '', panel: '' };

// ---------------------------------------------------------------- the phone's own storage (never required: a design lives on for this visit)

const store = {
  get<T>(k: string): T | null {
    try {
      const v = localStorage.getItem(k);
      return v ? (JSON.parse(v) as T) : null;
    } catch {
      return null;
    }
  },
  put(k: string, v: unknown): boolean {
    try {
      localStorage.setItem(k, JSON.stringify(v));
      return true;
    } catch {
      return false;
    }
  },
  drop(k: string): void {
    try {
      localStorage.removeItem(k);
    } catch {
      /* nothing kept to drop */
    }
  },
};
interface Entry { id: string; name: string; size: SizeId; at: number }
interface Binned extends Entry { gone: number }
const indexOf = (): Entry[] => (store.get<Entry[]>(KEY.index) ?? []).filter((e) => e && typeof e.id === 'string');
const binOf = (): Binned[] => (store.get<Binned[]>(KEY.bin) ?? []).filter((e) => e && typeof e.id === 'string' && Date.now() - e.gone < 30 * 86400_000);
const loadDoc = (id: string): Design | null => readDesign(store.get(KEY.doc + id));

/** His brand kit: kept, or first made from his look (its main colour and its ground). */
function brandNow(): Brand {
  const kept = store.get<Brand>(KEY.brand);
  if (kept) return readBrand(kept);
  const css = getComputedStyle(document.documentElement);
  const hex = (v: string) => {
    const s = v.trim();
    if (/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase();
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(s);
    return m ? `#${[m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, '0')).join('')}` : '';
  };
  const main = hex(css.getPropertyValue('--c'));
  const ground = hex(css.getPropertyValue('--bg'));
  return readBrand({ ...DEFAULT_BRAND, colours: [main || DEFAULT_BRAND.colours[0], ground && contrastOf(ground, '#ffffff') > 3 ? ground : DEFAULT_BRAND.colours[1], '#ffffff', DEFAULT_BRAND.colours[3]] });
}

// ---------------------------------------------------------------- measuring and drawing (the same wrap on screen and in every export)

const measurer = (): Measure => {
  const ctx = document.createElement('canvas').getContext('2d')!;
  return (text, l) => {
    ctx.font = `${l.weight ?? 400} ${l.size ?? 40}px ${FONTS[l.font ?? 'sans'].css}`;
    return ctx.measureText(text).width + (l.ls ?? 0) * Math.max(0, text.length - 1);
  };
};

const pics = new Map<string, HTMLImageElement>();
function picOf(src: string): Promise<HTMLImageElement> {
  const had = pics.get(src);
  if (had?.complete && had.naturalWidth) return Promise.resolve(had);
  return new Promise((ok, no) => {
    const img = had ?? new Image();
    pics.set(src, img);
    img.onload = () => ok(img);
    img.onerror = () => no(Object.assign(new Error('One of the pictures could not be drawn.'), { said: true }));
    if (!had) img.src = src;
  });
}

/** The design drawn on a canvas at `scale`, with `bleed` px of page around it (the ground and edge-touching parts run into it). */
export async function renderDesign(d: Design, scale = 1, bleed = 0): Promise<HTMLCanvasElement> {
  const c = document.createElement('canvas');
  c.width = Math.round((d.w + bleed * 2) * scale);
  c.height = Math.round((d.h + bleed * 2) * scale);
  const g = c.getContext('2d')!;
  g.scale(scale, scale);
  g.fillStyle = d.bg;
  g.fillRect(0, 0, d.w + bleed * 2, d.h + bleed * 2);
  g.translate(bleed, bleed);
  const measure = measurer();
  for (const l0 of d.layers) {
    if (l0.hidden) continue;
    const l = { ...l0 };
    if (bleed && (l.kind === 'rect' || l.kind === 'image') && !l.rot) {
      if (l.x <= 0) (l.w += l.x + bleed), (l.x = -bleed);
      if (l.y <= 0) (l.h += l.y + bleed), (l.y = -bleed);
      if (l.x + l.w >= d.w) l.w = d.w + bleed - l.x;
      if (l.y + l.h >= d.h) l.h = d.h + bleed - l.y;
    }
    g.save();
    g.globalAlpha = l.opacity;
    g.translate(l.x + l.w / 2, l.y + l.h / 2);
    if (l.rot) g.rotate((l.rot * Math.PI) / 180);
    g.translate(-l.w / 2, -l.h / 2);
    g.fillStyle = l.fill;
    if (l.kind === 'rect' || l.kind === 'ellipse') {
      g.beginPath();
      if (l.kind === 'ellipse') g.ellipse(l.w / 2, l.h / 2, l.w / 2, l.h / 2, 0, 0, Math.PI * 2);
      else if (l.radius && g.roundRect) g.roundRect(0, 0, l.w, l.h, l.radius);
      else g.rect(0, 0, l.w, l.h);
      if (l.fill !== 'none' && l.fill !== 'transparent') g.fill();
      if (l.stroke && l.sw) {
        g.strokeStyle = l.stroke;
        g.lineWidth = l.sw;
        g.stroke();
      }
    } else if (l.kind === 'line') {
      g.beginPath();
      g.moveTo(0, l.h / 2);
      g.lineTo(l.w, l.h / 2);
      g.strokeStyle = l.fill;
      g.lineWidth = Math.max(1, l.h);
      g.lineCap = 'round';
      g.stroke();
    } else if (l.kind === 'image' && l.src) {
      const img = await picOf(l.src).catch(() => null);
      if (img) {
        // cover: the picture fills its frame, cut evenly
        const k = Math.max(l.w / img.naturalWidth, l.h / img.naturalHeight);
        const sw = l.w / k;
        const sh = l.h / k;
        g.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 0, 0, l.w, l.h);
      }
    } else if (l.kind === 'text') {
      const size = l.size ?? 40;
      g.font = `${l.weight ?? 400} ${size}px ${FONTS[l.font ?? 'sans'].css}`;
      g.textBaseline = 'middle';
      g.textAlign = l.align === 'left' ? 'left' : l.align === 'right' ? 'right' : 'center';
      const gl = g as CanvasRenderingContext2D & { letterSpacing?: string };
      if (l.ls && 'letterSpacing' in gl) gl.letterSpacing = `${l.ls}px`;
      const lines = wrapText(l, measure);
      const lh = size * (l.lh ?? 1.2);
      const top = (l.h - lh * lines.length) / 2 + lh / 2;
      const ax = l.align === 'left' ? 0 : l.align === 'right' ? l.w : l.w / 2;
      lines.forEach((s, i) => g.fillText(s, ax, top + i * lh));
    }
    g.restore();
  }
  return c;
}

// ---------------------------------------------------------------- the page as DOM (the editor and the template cards)

/** A part drawn at `k` screen px to a design px (the line breaks are worked out at full size, so they match every export). */
function layerEl(l: Layer, measure: Measure, k = 1): HTMLElement {
  const el = h('div.dzl', { dataset: { id: l.id, kind: l.kind }, 'aria-label': `${l.name}${l.locked ? ', locked' : ''}` });
  const s = el.style;
  s.left = `${l.x * k}px`;
  s.top = `${l.y * k}px`;
  s.width = `${l.w * k}px`;
  s.height = `${l.h * k}px`;
  s.opacity = String(l.opacity);
  if (l.rot) s.transform = `rotate(${l.rot}deg)`;
  if (l.hidden) s.display = 'none';
  if (l.kind === 'rect' || l.kind === 'ellipse') {
    s.background = l.fill;
    if (l.kind === 'ellipse') s.borderRadius = '50%';
    else if (l.radius) s.borderRadius = `${l.radius * k}px`;
    if (l.stroke && l.sw) s.boxShadow = `inset 0 0 0 ${l.sw * k}px ${l.stroke}`;
  } else if (l.kind === 'line') {
    el.append(h('i.dzline'));
    (el.firstChild as HTMLElement).style.cssText = `height:${Math.max(1, l.h * k)}px;background:${l.fill};border-radius:${l.h * k}px`;
  } else if (l.kind === 'image' && l.src) {
    const img = h('img', { src: l.src, alt: l.name, draggable: 'false' });
    el.append(img);
  } else if (l.kind === 'text') {
    s.color = l.fill;
    s.font = `${l.weight ?? 400} ${(l.size ?? 40) * k}px/${l.lh ?? 1.2} ${FONTS[l.font ?? 'sans'].css}`;
    s.textAlign = l.align ?? 'center';
    s.justifyContent = l.align === 'left' ? 'flex-start' : l.align === 'right' ? 'flex-end' : 'center';
    if (l.ls) s.letterSpacing = `${l.ls * k}px`;
    el.append(h('span', wrapText(l, measure).join('\n')));
  }
  return el;
}
function pageEl(d: Design, measure: Measure, k = 1): HTMLElement {
  const p = h('div.dzpage', { role: 'img', 'aria-label': `${d.name}: ${wordsOf(d).slice(0, 200) || 'a blank page'}` });
  p.style.width = `${d.w * k}px`;
  p.style.height = `${d.h * k}px`;
  p.style.background = d.bg;
  for (const l of d.layers) p.append(layerEl(l, measure, k));
  return p;
}

// ---------------------------------------------------------------- the editor

type PanelId = 'templates' | 'edit' | 'layers' | 'resize' | 'brand' | 'export' | 'designs';
const PANELS: [PanelId, string][] = [['templates', 'Templates'], ['edit', 'Edit'], ['layers', 'Layers'], ['resize', 'Resize'], ['brand', 'Brand'], ['export', 'Export'], ['designs', 'My designs']];

export function designScreen(): { el: HTMLElement; stop(): void } {
  const win = window as unknown as { __ghosty?: Record<string, unknown> };
  if (win.__ghosty) win.__ghosty.design = designState;
  const measure = measurer();
  let brand = brandNow();
  // the design he had open last, or the first template (never an empty grey page)
  let doc: Design = (() => {
    const cur = store.get<string>(KEY.current);
    return (cur && loadDoc(cur)) || fromTemplate(TEMPLATES[0]!, TEMPLATES[0]!.size, brand);
  })();
  let sel = '';
  let past: string[] = [];
  let future: string[] = [];
  let panel: PanelId = 'templates';
  let saveTimer = 0;
  let scale = 1;

  const said = h('p.dzsaid', { 'aria-live': 'polite' });
  const say = (t: string) => {
    said.textContent = t;
    designState.said = t;
  };
  const nameIn = h('input.dzname', { type: 'text', 'aria-label': 'Design name', maxlength: '80', value: doc.name }) as HTMLInputElement;
  const undoKey = button('Undo', () => undo(), 'dzkey');
  const redoKey = button('Redo', () => redo(), 'dzkey');
  undoKey.setAttribute('aria-label', 'Undo');
  redoKey.setAttribute('aria-label', 'Redo');
  const stage = h('div.dzstage', { tabindex: '0', 'aria-label': 'The canvas: drag a part to move it' });
  const tabs = h('div.dztabs', { role: 'tablist' });
  const body = h('div.dzbody');
  const el = h('div.dz', h('div.dzhead', nameIn, h('div.dzkeys', undoKey, redoKey)), stage, said, tabs, body);

  // ---- history and saving
  const snapshot = () => JSON.stringify(doc);
  const sync = () => {
    if (win.__ghosty) win.__ghosty.design = designState;
    Object.assign(designState, { open: doc.id, name: doc.name, size: doc.size, w: doc.w, h: doc.h, layers: doc.layers.length, selected: sel, kind: doc.layers.find((l) => l.id === sel)?.kind ?? '', undo: past.length, redo: future.length, kept: indexOf().length, bin: binOf().length, panel });
    undoKey.disabled = !past.length;
    redoKey.disabled = !future.length;
  };
  const saveNow = () => {
    clearTimeout(saveTimer);
    doc.at = Date.now();
    const ok = store.put(KEY.doc + doc.id, doc);
    const idx = indexOf().filter((e) => e.id !== doc.id);
    idx.unshift({ id: doc.id, name: doc.name, size: doc.size, at: doc.at });
    for (const old of idx.splice(MAX_DESIGNS)) store.drop(KEY.doc + old.id);
    store.put(KEY.index, idx);
    store.put(KEY.current, doc.id);
    designState.saved = ok ? doc.at : 0;
    if (!ok) say('This phone’s storage is full, so this design is kept only while it is open. Take a picture out, or export it.');
    sync();
  };
  /** Every change goes through here: it can be undone, and it is saved. */
  const change = (next: Design, keepSel = true) => {
    past.push(snapshot());
    if (past.length > MAX_HISTORY) past.shift();
    future = [];
    doc = next;
    if (!keepSel || !doc.layers.some((l) => l.id === sel)) sel = '';
    paint();
    saveNow();
  };
  const undo = () => {
    const prev = past.pop();
    if (!prev) return;
    future.push(snapshot());
    doc = readDesign(JSON.parse(prev)) ?? doc;
    if (!doc.layers.some((l) => l.id === sel)) sel = '';
    paint();
    saveNow();
    say('Undone.');
  };
  const redo = () => {
    const next = future.pop();
    if (!next) return;
    past.push(snapshot());
    doc = readDesign(JSON.parse(next)) ?? doc;
    paint();
    saveNow();
    say('Redone.');
  };
  const open = (d: Design, words: string) => {
    saveNow();
    doc = d;
    sel = '';
    past = [];
    future = [];
    nameIn.value = doc.name;
    paint();
    saveNow();
    say(words);
    // the new page in view (a template is often picked from further down)
    stage.scrollIntoView?.({ block: 'nearest' });
  };
  const edit = (id: string, patch: Partial<Layer>) => change({ ...doc, layers: doc.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
  const selected = () => doc.layers.find((l) => l.id === sel);

  // ---- the stage
  let pageNode: HTMLElement | null = null;
  const selBox = h('div.dzsel', { hidden: true }, ...(['nw', 'ne', 'sw', 'se', 'e', 'rot'] as const).map((k) => h('i.dzh', { dataset: { h: k }, 'aria-hidden': 'true' })));
  const guideLayer = h('div.dzguides');
  const scaleNow = () => {
    const r = stage.getBoundingClientRect();
    return Math.min(Math.max(120, r.width - 24) / doc.w, Math.max(160, r.height - 24) / doc.h);
  };
  /** The stage resized (a turn of the phone): drawn again at the new size. */
  const fit = () => {
    if (drag || !pageNode) return;
    if (Math.abs(scaleNow() - scale) > 0.0005) paintStage();
  };
  const placeSel = () => {
    const l = selected();
    if (!l || !pageNode || l.hidden) {
      selBox.hidden = true;
      return;
    }
    selBox.hidden = false;
    const s = selBox.style;
    s.left = `${l.x * scale}px`;
    s.top = `${l.y * scale}px`;
    s.width = `${l.w * scale}px`;
    s.height = `${l.h * scale}px`;
    s.transform = l.rot ? `rotate(${l.rot}deg)` : '';
    selBox.dataset.locked = l.locked ? '1' : '';
  };
  const showGuides = (gs: Guide[]) => {
    clear(guideLayer, ...gs.map((g) => {
      const i = h('i.dzguide', { dataset: { axis: g.axis } });
      if (g.axis === 'x') i.style.left = `${g.at * scale}px`;
      else i.style.top = `${g.at * scale}px`;
      return i;
    }));
    designState.guides = gs.length;
  };
  const paintStage = () => {
    scale = scaleNow();
    pageNode = pageEl(doc, measure, scale);
    pageNode.append(guideLayer, selBox);
    clear(stage, pageNode);
    placeSel();
  };

  // dragging: a part moves (snapping), a corner resizes from the opposite corner, the top handle rotates
  let drag: null | { mode: string; id: string; px: number; py: number; start: Layer; before: string; moved: boolean } = null;
  const toPage = (e: PointerEvent) => {
    const r = pageNode!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  };
  stage.addEventListener('pointerdown', (e) => {
    if (!pageNode) return;
    const t = e.target as HTMLElement;
    const handle = t.closest<HTMLElement>('.dzh')?.dataset.h;
    const hit = t.closest<HTMLElement>('.dzl');
    if (!handle && !hit) {
      if (sel) {
        sel = '';
        paint();
      }
      return;
    }
    const id = handle ? sel : hit!.dataset.id!;
    const l = doc.layers.find((x) => x.id === id);
    if (!l) return;
    if (sel !== id) {
      sel = id;
      if (panel !== 'layers') panel = 'edit';
      paint();
    }
    if (l.locked) {
      say(`${l.name} is locked: unlock it in Layers to move it.`);
      return;
    }
    const p = toPage(e);
    drag = { mode: handle ?? 'move', id, px: p.x, py: p.y, start: { ...l }, before: snapshot(), moved: false };
    stage.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag || !pageNode) return;
    const p = toPage(e);
    const dx = p.x - drag.px;
    const dy = p.y - drag.py;
    if (!drag.moved && Math.hypot(dx, dy) * scale < 3) return;
    drag.moved = true;
    const s = drag.start;
    let n: Layer = { ...s };
    let guides: Guide[] = [];
    if (drag.mode === 'move') {
      const snapped = snapBox(doc, s.id, { x: s.x + dx, y: s.y + dy, w: s.w, h: s.h }, 10 / scale);
      n = { ...s, x: Math.round(snapped.x), y: Math.round(snapped.y) };
      guides = snapped.guides;
    } else if (drag.mode === 'rot') {
      const cx = s.x + s.w / 2;
      const cy = s.y + s.h / 2;
      let a = (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI + 90;
      a = ((a % 360) + 360) % 360;
      const near = Math.round(a / 15) * 15;
      if (Math.abs(a - near) < 4) a = near % 360;
      n = { ...s, rot: Math.round(a) };
    } else {
      // resize in the part's own frame, so a turned part resizes along its own sides
      const rad = (s.rot * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const lx = dx * cos + dy * sin;
      const ly = -dx * sin + dy * cos;
      const sx = drag.mode.includes('w') ? -1 : 1;
      const sy = drag.mode.includes('n') ? -1 : 1;
      let w = drag.mode === 'e' ? s.w + lx : s.w + sx * lx;
      let hh = drag.mode === 'e' ? s.h : s.h + sy * ly;
      const keep = s.kind === 'text' || s.kind === 'image';
      if (keep && drag.mode !== 'e') {
        const k = Math.max(w / s.w, hh / s.h);
        w = s.w * k;
        hh = s.h * k;
      }
      w = Math.max(16, w);
      hh = Math.max(s.kind === 'line' ? 2 : 16, hh);
      // the opposite corner (or, for the side handle, the left side) stays where it was
      const R = (a: number, b: number) => [a * cos - b * sin, a * sin + b * cos] as const;
      const side = drag.mode === 'e';
      const [ox, oy] = R(side ? -s.w / 2 : (-sx * s.w) / 2, side ? 0 : (-sy * s.h) / 2);
      const [nx, ny] = R(side ? w / 2 : (sx * w) / 2, side ? 0 : (sy * hh) / 2);
      const cx = s.x + s.w / 2 + ox + nx;
      const cy = s.y + s.h / 2 + oy + ny;
      n = { ...s, w: Math.round(w), h: Math.round(hh), x: Math.round(cx - w / 2), y: Math.round(cy - hh / 2) };
      if (s.kind === 'text' && drag.mode !== 'e' && s.size) n.size = Math.max(8, Math.round((s.size * w) / s.w));
      if (s.kind === 'text' && drag.mode === 'e') n.h = Math.max(s.h, Math.round(wrapText(n, measure).length * (s.size ?? 40) * (s.lh ?? 1.2)));
    }
    doc = { ...doc, layers: doc.layers.map((l) => (l.id === s.id ? n : l)) };
    const node = pageNode.querySelector<HTMLElement>(`.dzl[data-id="${s.id}"]`);
    if (node) node.replaceWith(layerEl(n, measure, scale));
    placeSel();
    showGuides(guides);
  });
  const endDrag = () => {
    if (!drag) return;
    const d = drag;
    drag = null;
    showGuides([]);
    if (!d.moved) return;
    past.push(d.before);
    if (past.length > MAX_HISTORY) past.shift();
    future = [];
    paint();
    saveNow();
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  stage.addEventListener('dblclick', (e) => {
    const hit = (e.target as HTMLElement).closest<HTMLElement>('.dzl');
    if (hit?.dataset.kind === 'text') {
      panel = 'edit';
      paint();
      body.querySelector<HTMLTextAreaElement>('textarea')?.focus();
    }
  });
  const onKey = (e: KeyboardEvent) => {
    if (!el.isConnected) return;
    const typing = (e.target as HTMLElement)?.closest?.('input, textarea, select');
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z' && !typing) {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
      return;
    }
    const l = selected();
    if (typing || !l) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      remove(l.id);
    } else if (mod && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      duplicate(l.id);
    } else if (e.key.startsWith('Arrow') && !l.locked) {
      e.preventDefault();
      const st = e.shiftKey ? 10 : 1;
      edit(l.id, { x: l.x + (e.key === 'ArrowLeft' ? -st : e.key === 'ArrowRight' ? st : 0), y: l.y + (e.key === 'ArrowUp' ? -st : e.key === 'ArrowDown' ? st : 0) });
    }
  };
  document.addEventListener('keydown', onKey);
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => fit()) : null;
  ro?.observe(stage);

  // ---- adding, removing
  const short = () => Math.min(doc.w, doc.h);
  const add = (l: Omit<Layer, 'id'>) => {
    const n: Layer = { ...l, id: newId() };
    sel = n.id;
    panel = 'edit';
    change({ ...doc, layers: [...doc.layers, n] });
    say(`${n.name} added. Drag it where you want it.`);
  };
  const addText = (heading: boolean) => {
    const size = Math.round(short() * (heading ? 0.11 : 0.05));
    const w = Math.round(doc.w * 0.7);
    add({ kind: 'text', name: heading ? 'Heading' : 'Text', text: heading ? 'Your heading' : 'Your words here', x: Math.round((doc.w - w) / 2), y: Math.round(doc.h * 0.4), w, h: Math.round(size * 1.3), rot: 0, fill: inkOn(doc.bg), opacity: 1, font: heading ? brand.head : brand.body, size, weight: heading ? 700 : 400, align: 'center', lh: 1.2 });
  };
  const addShape = (kind: 'rect' | 'ellipse' | 'line') => {
    const s = Math.round(short() * 0.3);
    add({ kind, name: kind === 'rect' ? 'Rectangle' : kind === 'ellipse' ? 'Circle' : 'Line', x: Math.round((doc.w - s) / 2), y: Math.round((doc.h - (kind === 'line' ? 8 : s)) / 2), w: s, h: kind === 'line' ? Math.max(4, Math.round(short() * 0.008)) : s, rot: 0, fill: brand.colours[0] ?? '#64d2ff', opacity: 1, ...(kind === 'rect' ? { radius: Math.round(s * 0.08) } : {}) });
  };
  const photoIn = h('input', { type: 'file', accept: 'image/*', hidden: true, 'aria-label': 'Choose a photo' }) as HTMLInputElement;
  photoIn.addEventListener('change', async () => {
    const f = photoIn.files?.[0];
    photoIn.value = '';
    if (!f) return;
    say('Making your photo smaller, here on the phone…');
    try {
      const src = await shrink(f, 1600);
      const img = await picOf(src);
      const w = Math.round(doc.w * 0.6);
      const hh = Math.round((w * img.naturalHeight) / img.naturalWidth);
      add({ kind: 'image', name: 'Photo', src, x: Math.round((doc.w - w) / 2), y: Math.round((doc.h - hh) / 2), w, h: hh, rot: 0, fill: 'transparent', opacity: 1 });
    } catch (e) {
      say(sayError(e, 'add that photo'));
    }
  });
  el.append(photoIn);
  const remove = (id: string) => {
    const l = doc.layers.find((x) => x.id === id);
    if (!l) return;
    change({ ...doc, layers: doc.layers.filter((x) => x.id !== id) }, false);
    say(`${l.name} deleted. Undo puts it back.`);
  };
  const duplicate = (id: string) => {
    const l = doc.layers.find((x) => x.id === id);
    if (!l) return;
    const n = { ...l, id: newId(), x: l.x + Math.round(short() * 0.03), y: l.y + Math.round(short() * 0.03), locked: false };
    const i = doc.layers.indexOf(l);
    sel = n.id;
    change({ ...doc, layers: [...doc.layers.slice(0, i + 1), n, ...doc.layers.slice(i + 1)] });
    say(`${l.name} duplicated.`);
  };

  // ---- the panels
  const key = (label: string, fn: () => void, aria?: string, cls = 'dzkey') => {
    const b = button(label, fn, cls);
    if (aria) b.setAttribute('aria-label', aria);
    return b;
  };
  const row = (...kids: (Node | null)[]) => h('div.dzrow', ...kids.filter(Boolean));
  const label = (t: string) => h('h4.dzlab', t);
  const swatches = (cur: string, set: (c: string) => void) => {
    const list = [...new Set([...brand.colours, '#ffffff', '#111111'])];
    const wrap = h('div.dzsw');
    for (const c of list) {
      const b = h('button.dzswatch', { type: 'button', 'aria-label': `Colour ${c}`, 'aria-pressed': String(c.toLowerCase() === cur.toLowerCase()) });
      b.style.background = c;
      b.addEventListener('click', () => set(c));
      wrap.append(b);
    }
    const pick = h('input.dzpick', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(cur) ? cur : '#000000', 'aria-label': 'Any colour' }) as HTMLInputElement;
    pick.addEventListener('change', () => set(pick.value));
    wrap.append(pick);
    return wrap;
  };

  const paintTemplates = () => {
    const filt = h('div.dzchips');
    let showing = 'All';
    const grid = h('div.dzgrid');
    const fill = () => {
      clear(grid);
      for (const t of TEMPLATES.filter((x) => showing === 'All' || x.for === showing)) {
        const d = fromTemplate(t, t.size, brand);
        const card = h('button.dzcard', { type: 'button', 'aria-label': `Start from ${t.name}, ${sizeOf(t.size).name}` });
        // a small picture drawn the way the exports are (a full-size page shrunk in place is too heavy for a phone to draw ten of)
        const pic = h('img', { alt: '', width: '140', height: '160' }) as HTMLImageElement;
        const thumb = h('span.dzthumb', pic);
        void renderDesign(d, Math.min(280 / d.w, 320 / d.h)).then((c) => (pic.src = c.toDataURL('image/png')), () => undefined);
        card.append(thumb, h('b', t.name), h('small', sizeOf(t.size).name));
        card.addEventListener('click', () => open(fromTemplate(t, t.size, brand), `${t.name}: yours to change. Tap any part to edit it.`));
        grid.append(card);
      }
    };
    for (const o of ['All', ...OCCASIONS]) {
      const c = h('button.dzchip', { type: 'button', 'aria-pressed': String(o === showing) }, o);
      c.addEventListener('click', () => {
        showing = o;
        for (const b of filt.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.textContent === o));
        fill();
      });
      filt.append(c);
    }
    fill();
    body.append(h('p.dznote', 'Every template is laid out to fit any size, in your brand’s colours and faces.'), filt, grid);
  };

  const paintEdit = () => {
    const l = selected();
    body.append(label('Add'), row(key('Heading', () => addText(true), 'Add a heading'), key('Text', () => addText(false), 'Add text'), key('Rectangle', () => addShape('rect'), 'Add a rectangle'), key('Circle', () => addShape('ellipse'), 'Add a circle'), key('Line', () => addShape('line'), 'Add a line'), key('Photo', () => photoIn.click(), 'Add a photo from this phone')));
    if (!l) {
      body.append(label('Page colour'), swatches(doc.bg, (c) => change({ ...doc, bg: c })), h('p.dznote', 'Tap a part on the canvas to change it. Drag to move, pull a corner to resize, the top handle turns it.'));
      return;
    }
    body.append(label(l.name));
    if (l.kind === 'text') {
      const ta = h('textarea.dztext', { rows: 3, 'aria-label': 'Text' }) as HTMLTextAreaElement;
      ta.value = l.text ?? '';
      let typed = 0;
      ta.addEventListener('input', () => {
        clearTimeout(typed);
        typed = window.setTimeout(() => {
          const lines = wrapText({ ...l, text: ta.value }, measure).length;
          edit(l.id, { text: ta.value, h: Math.max(l.h, Math.round(lines * (l.size ?? 40) * (l.lh ?? 1.2))) });
          ta.focus();
        }, 350);
      });
      const font = h('select.dzsel1', { 'aria-label': 'Font' }) as HTMLSelectElement;
      for (const [id, f] of Object.entries(FONTS)) font.append(h('option', { value: id, selected: id === l.font }, f.name));
      font.addEventListener('change', () => isFont(font.value) && edit(l.id, { font: font.value as FontId }));
      const sz = l.size ?? 40;
      body.append(ta, row(font, key('A−', () => edit(l.id, { size: Math.max(8, Math.round(sz / 1.12)) }), 'Smaller text'), key('A+', () => edit(l.id, { size: Math.round(sz * 1.12), h: Math.max(l.h, Math.round(sz * 1.12 * (l.lh ?? 1.2))) }), 'Bigger text')),
        row(key((l.weight ?? 400) >= 700 ? 'Bold: on' : 'Bold', () => edit(l.id, { weight: (l.weight ?? 400) >= 700 ? 400 : 700 }), 'Bold'), key(l.upper ? 'Caps: on' : 'Caps', () => edit(l.id, { upper: !l.upper }), 'Capitals'), key('Left', () => edit(l.id, { align: 'left' }), 'Align text left'), key('Centre', () => edit(l.id, { align: 'center' }), 'Centre the text'), key('Right', () => edit(l.id, { align: 'right' }), 'Align text right')));
      const cr = contrastOf(l.fill, doc.bg);
      if (cr < 3) body.append(h('p.dznote.dzwarn', `This text is hard to read on the page colour (contrast ${cr.toFixed(1)} to 1). Try ${inkOn(doc.bg) === '#ffffff' ? 'white' : 'black'}.`));
    }
    if (l.kind !== 'image') body.append(label(l.kind === 'text' ? 'Text colour' : 'Colour'), swatches(l.fill, (c) => edit(l.id, { fill: c })));
    if (l.kind === 'rect') body.append(row(key('Rounder', () => edit(l.id, { radius: Math.round((l.radius ?? 0) + short() * 0.02) }), 'Rounder corners'), key('Squarer', () => edit(l.id, { radius: Math.max(0, Math.round((l.radius ?? 0) - short() * 0.02)) }), 'Squarer corners'), key(l.stroke ? 'Outline: on' : 'Outline', () => edit(l.id, l.stroke ? { stroke: undefined, sw: undefined } : { stroke: inkOn(l.fill), sw: Math.max(2, Math.round(short() * 0.006)) }), 'Outline')));
    if (l.kind === 'image') body.append(row(key('Frame: circle', () => change({ ...doc, layers: doc.layers.map((x) => (x.id === l.id ? { ...x, w: Math.min(x.w, x.h), h: Math.min(x.w, x.h) } : x)) }), 'Square the frame')), ...(l.credit ? [h('p.dznote', `Credit: ${l.credit}`)] : []));
    const op = h('input.dzrange', { type: 'range', min: '10', max: '100', value: String(Math.round(l.opacity * 100)), 'aria-label': 'See-through' }) as HTMLInputElement;
    op.addEventListener('change', () => edit(l.id, { opacity: Number(op.value) / 100 }));
    body.append(label('See-through'), op, label('Line up on the page'),
      row(...(['left', 'center', 'right', 'top', 'middle', 'bottom'] as AlignHow[]).map((a) => key({ left: 'Left', center: 'Centre', right: 'Right', top: 'Top', middle: 'Middle', bottom: 'Bottom' }[a], () => change(alignLayers(doc, [l.id], a)), `Line it up ${a === 'center' ? 'in the centre' : a === 'middle' ? 'in the middle' : `at the ${a}`}`))),
      label('This part'),
      row(key('Forward', () => change(reorder(doc, l.id, 'up')), 'Bring forward'), key('Back', () => change(reorder(doc, l.id, 'down')), 'Send back'), key('Duplicate', () => duplicate(l.id)), key(l.locked ? 'Unlock' : 'Lock', () => edit(l.id, { locked: !l.locked })), key('Delete', () => remove(l.id), `Delete ${l.name}`, 'dzkey dzbad')));
  };

  const paintLayers = () => {
    if (!doc.layers.length) {
      body.append(h('div.dzempty', { dataset: { state: 'empty' } }, h('b', 'Nothing on the page yet'), h('span', 'Add a heading, a shape or a photo from Edit, or start from a template.')));
      return;
    }
    const list = h('ol.dzlayers', { 'aria-label': 'Layers, top first' });
    for (const l of [...doc.layers].reverse()) {
      const name = h('button.dzlname', { type: 'button', 'aria-pressed': String(l.id === sel) }, h('b', l.name), h('small', l.kind === 'text' ? (l.text ?? '').slice(0, 28) : l.kind));
      name.addEventListener('click', () => {
        sel = l.id;
        paint();
      });
      list.append(h('li.dzlayer', { dataset: { id: l.id } }, name,
        key('↑', () => change(reorder(doc, l.id, 'up')), `Bring ${l.name} forward`, 'dzkey dzicon'),
        key('↓', () => change(reorder(doc, l.id, 'down')), `Send ${l.name} back`, 'dzkey dzicon'),
        key(l.hidden ? 'Show' : 'Hide', () => edit(l.id, { hidden: !l.hidden }), `${l.hidden ? 'Show' : 'Hide'} ${l.name}`),
        key(l.locked ? 'Unlock' : 'Lock', () => edit(l.id, { locked: !l.locked }), `${l.locked ? 'Unlock' : 'Lock'} ${l.name}`)));
    }
    body.append(list);
  };

  const paintResize = () => {
    body.append(h('p.dznote', 'Magic resize makes a copy at another size, every part kept in its place and in proportion. This one stays as it is.'));
    const grid = h('div.dzsizes');
    for (const s of SIZES) {
      const b = h('button.dzsize', { type: 'button', 'aria-pressed': String(s.id === doc.size), 'aria-label': `${s.name}, ${s.w} by ${s.h}` }, h('b', s.name), h('small', s.mm ? `${s.mm[0]} × ${s.mm[1]} mm` : `${s.w} × ${s.h}`));
      b.addEventListener('click', () => {
        if (s.id === doc.size) return say(`It is already ${s.name}.`);
        open(magicResize(doc, s.id), `A ${s.name} copy, made from “${doc.name}”. The first one is in My designs.`);
      });
      grid.append(b);
    }
    body.append(grid);
  };

  const paintBrand = () => {
    const keep = () => store.put(KEY.brand, brand);
    const cols = h('div.dzsw');
    for (const c of brand.colours) {
      const b = h('button.dzswatch', { type: 'button', 'aria-label': `Take ${c} out of your brand` });
      b.style.background = c;
      b.addEventListener('click', () => {
        if (brand.colours.length <= 1) return say('Your brand keeps at least one colour.');
        brand = { ...brand, colours: brand.colours.filter((x) => x !== c) };
        keep();
        paint();
      });
      cols.append(b);
    }
    const pick = h('input.dzpick', { type: 'color', value: brand.colours[0] ?? '#64d2ff', 'aria-label': 'Add a colour to your brand' }) as HTMLInputElement;
    pick.addEventListener('change', () => {
      brand = { ...brand, colours: [...new Set([...brand.colours, pick.value.toLowerCase()])].slice(0, 8) };
      keep();
      paint();
    });
    cols.append(pick);
    const face = (which: 'head' | 'body') => {
      const s = h('select.dzsel1', { 'aria-label': which === 'head' ? 'Heading font' : 'Body font' }) as HTMLSelectElement;
      for (const [id, f] of Object.entries(FONTS)) s.append(h('option', { value: id, selected: id === brand[which] }, f.name));
      s.addEventListener('change', () => {
        if (!isFont(s.value)) return;
        brand = { ...brand, [which]: s.value };
        keep();
        paint();
      });
      return s;
    };
    const apply = () => {
      const texts = doc.layers.filter((l) => l.kind === 'text');
      const big = Math.max(...texts.map((l) => l.size ?? 0), 0);
      change({ ...doc, layers: doc.layers.map((l) => (l.kind === 'text' ? { ...l, font: (l.size ?? 0) >= big * 0.6 ? brand.head : brand.body } : l)) });
      say('Your brand’s faces are on this design. Undo takes them off.');
    };
    body.append(h('p.dznote', 'Your colours and faces, started from your look. Every template and every new part uses them.'), label('Colours (tap one to take it out)'), cols, label('Heading font'), face('head'), label('Body font'), face('body'), row(key('Use my brand on this design', apply)));
  };

  const busy = (b: HTMLButtonElement, fn: () => Promise<void>) => async () => {
    if (b.disabled) return;
    b.disabled = true;
    try {
      await fn();
    } catch (e) {
      say(sayError(e, 'make that'));
    } finally {
      b.disabled = false;
    }
  };
  const fileName = (ext: string) => `${(doc.name || 'design').replace(/[^\w -]/g, '').trim().slice(0, 40) || 'design'}.${ext}`;
  const paintExport = () => {
    const credits = creditsOf(doc);
    const png = key('PNG picture', () => undefined, 'Save as a PNG picture');
    png.onclick = busy(png, async () => {
      await loadFont();
      const c = await renderDesign(doc, Math.min(1, 4096 / Math.max(doc.w, doc.h)));
      const blob = await pngOf(c);
      saveFile(blob, fileName('png'), 'image/png');
      designState.exported = 'png';
      designState.bytes = blob.size;
      say(`Saved ${fileName('png')} (${Math.round(blob.size / 1024)} KB) to your downloads.`);
    });
    const svg = key('Vector file', () => undefined, 'Save as an SVG vector file');
    svg.onclick = busy(svg, async () => {
      const text = toSvg(doc, measure);
      saveFile(new Blob([text], { type: 'image/svg+xml' }), fileName('svg'), 'image/svg+xml');
      designState.exported = 'svg';
      designState.bytes = text.length;
      say(`Saved ${fileName('svg')} to your downloads.`);
    });
    const pdf = key('Print PDF with bleed', () => undefined, 'Save a print PDF with 3 mm bleed');
    pdf.onclick = busy(pdf, async () => {
      await loadFont();
      const trim = printSize(doc);
      const bleedPt = BLEED_MM * PT_PER_MM;
      const pxPerPt = doc.w / trim.w;
      const bleedPx = Math.round(bleedPt * pxPerPt);
      const k = Math.min(1, 4200 / Math.max(doc.w, doc.h));
      const c = await renderDesign(doc, k, bleedPx);
      const jpeg = await new Promise<Blob>((ok, no) => c.toBlob((b) => (b ? ok(b) : no(Object.assign(new Error('I could not make the page.'), { said: true }))), 'image/jpeg', 0.92));
      const bytes = pdfOf(new Uint8Array(await jpeg.arrayBuffer()), c.width, c.height, trim, bleedPt, doc.name);
      saveFile(bytes, fileName('pdf'), 'application/pdf');
      designState.exported = 'pdf';
      designState.bytes = bytes.length;
      say(`Saved ${fileName('pdf')}: ${Math.round(trim.w / PT_PER_MM)} × ${Math.round(trim.h / PT_PER_MM)} mm with ${BLEED_MM} mm bleed (${Math.round(bytes.length / 1024)} KB).`);
    });
    const site = key('On my sites', () => undefined, 'Put it on my sites (asks your APPROVE first)');
    site.onclick = busy(site, async () => {
      await loadFont();
      let q = 0.86;
      let k = Math.min(1, 1080 / doc.w);
      let html = '';
      for (let i = 0; i < 6; i++) {
        const c = await renderDesign(doc, k);
        const url = c.toDataURL('image/jpeg', q);
        html = sitePageOf(doc, url, wordsOf(doc));
        if (html.length < 380_000) break;
        q = Math.max(0.5, q - 0.1);
        k *= 0.85;
      }
      saveNow();
      const r = await putOnSites(doc.name || 'My design', html, 'document');
      designState.exported = r.ok ? 'site' : '';
      say(r.said);
    });
    body.append(h('p.dznote', 'Made here on your phone when you tap. Nothing leaves it unless you put it on your sites, and that waits for your APPROVE in the chat.'), row(png, svg, pdf, site), ...(credits.length ? [h('p.dznote', `Credits printed with it: ${credits.join('; ')}`)] : []));
  };

  const paintDesigns = () => {
    saveNow();
    const idx = indexOf();
    const list = h('ul.dzlist', { 'aria-label': 'My designs' });
    for (const e of idx) {
      const openKey = h('button.dzlname', { type: 'button', 'aria-pressed': String(e.id === doc.id) }, h('b', e.name), h('small', `${sizeOf(e.size).name} · ${new Date(e.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`));
      openKey.addEventListener('click', () => {
        const d = loadDoc(e.id);
        if (d) open(d, `“${d.name}” is open.`);
        else say('That design could not be read from this phone.');
      });
      list.append(h('li.dzlayer', openKey,
        key('Copy', () => {
          const d = loadDoc(e.id);
          if (d) open({ ...d, id: newId('d'), name: `${d.name} (copy)` }, `A copy of “${d.name}”.`);
        }, `Make a copy of ${e.name}`),
        key('Delete', () => {
          store.put(KEY.bin, [{ ...e, gone: Date.now() }, ...binOf().filter((b) => b.id !== e.id)].slice(0, 40));
          store.put(KEY.index, indexOf().filter((x) => x.id !== e.id));
          if (e.id === doc.id) {
            const next = indexOf()[0];
            doc = (next && loadDoc(next.id)) || fromTemplate(TEMPLATES.find((t) => t.id === 'blank')!, doc.size, brand);
            past = [];
            future = [];
            nameIn.value = doc.name;
          }
          say(`“${e.name}” is in Recently deleted for 30 days.`);
          paint();
        }, `Delete ${e.name}`, 'dzkey dzbad')));
    }
    body.append(row(key('New blank design', () => open(fromTemplate(TEMPLATES.find((t) => t.id === 'blank')!, doc.size, brand, 'Untitled design'), 'A blank page. Add a heading, a shape or a photo from Edit.'))), list);
    const bin = binOf();
    if (bin.length) {
      const binList = h('ul.dzlist', { 'aria-label': 'Recently deleted' });
      for (const b of bin) {
        binList.append(h('li.dzlayer', h('span.dzlname', h('b', b.name), h('small', `deleted ${new Date(b.gone).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`)),
          key('Put back', () => {
            store.put(KEY.bin, binOf().filter((x) => x.id !== b.id));
            store.put(KEY.index, [{ id: b.id, name: b.name, size: b.size, at: b.at }, ...indexOf()]);
            say(`“${b.name}” is back in My designs.`);
            paint();
          }, `Put back ${b.name}`)));
      }
      body.append(label('Recently deleted'), binList);
    }
  };

  const paintPanel = () => {
    clear(tabs);
    for (const [id, t] of PANELS) {
      const b = h('button.dztab', { type: 'button', role: 'tab', 'aria-selected': String(id === panel), dataset: { panel: id } }, t);
      b.addEventListener('click', () => {
        panel = id;
        paint();
      });
      tabs.append(b);
    }
    clear(body);
    body.dataset.panel = panel;
    ({ templates: paintTemplates, edit: paintEdit, layers: paintLayers, resize: paintResize, brand: paintBrand, export: paintExport, designs: paintDesigns })[panel]();
  };

  const paint = () => {
    paintStage();
    paintPanel();
    sync();
  };

  nameIn.addEventListener('change', () => {
    const v = nameIn.value.trim().slice(0, 80) || 'Untitled design';
    if (v !== doc.name) change({ ...doc, name: v });
  });

  paint();
  // the boot replaces window.__ghosty once it is done: the state is hung on it again after (for the specs and the ASK button)
  for (const ms of [400, 1500, 4000]) setTimeout(() => win.__ghosty && (win.__ghosty.design = designState), ms);
  if (!store.get(KEY.current)) saveNow();
  say(past.length ? '' : `“${doc.name}” is open. Tap a part to change it, or pick a template.`);
  void loadFont().then(() => paintStage());
  return {
    el,
    stop() {
      saveNow();
      document.removeEventListener('keydown', onKey);
      ro?.disconnect();
    },
  };
}

/** His photo made smaller here (the longer side at most `max` px), as a JPEG; its hidden details go with the re-draw. */
function shrink(f: File, max: number): Promise<string> {
  return new Promise((ok, no) => {
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * k));
      c.height = Math.max(1, Math.round(img.naturalHeight * k));
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      ok(c.toDataURL('image/jpeg', 0.86));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      no(Object.assign(new Error('That file is not a picture this phone can open.'), { said: true }));
    };
    img.src = url;
  });
}
