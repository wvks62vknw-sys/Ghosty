/**
 * PAINT's studio: the full-screen canvas. One finger or the Apple Pencil draws; two fingers pinch to zoom, turn and move the
 * canvas; a two-finger tap undoes and a three-finger tap redoes. When an Apple Pencil has touched the glass, a resting palm or
 * finger no longer draws. Holding still at the end of a stroke snaps it to a clean line, circle, oval or box (QuickShape).
 * The tools sit at the bottom, in thumb reach; panels (brushes, colour, layers, more) open over them and close with a tap.
 */
import { h, clear } from '../../core/dom';
import { button } from '../../ui/components';
import { sayError, trail } from '../../ui/hisWords';
import { BRUSHES, brushOf, curveOf, ERASER, forgetTweak, keepTweak, LIQUIFY_NAMES, PALETTES, seeded, SMUDGE, tweaks, type Brush, type Curve, type Liquify } from './brushes';
import { BLENDS, blendName, MAX_LAYERS, mk, pack, Painting, type Sel } from './engine';
import { fingerPressure, quickShape, smoother, SYMMETRY_NAMES, type Pt, type Symmetry } from './stroke';
import { jpegOf, oraBlob, playInto, pngOf, psdBlob, videoType, framesIn } from './io';
import { paintState } from './state';

export type Tool = typeof paintState.tool;
export interface Prefs { curve: Curve; smooth: number; lazy: number; pencilOnly: boolean; quick: boolean; taps: boolean; cue: boolean }
export const PREF_DEFAULTS: Prefs = { curve: 'even', smooth: 0.35, lazy: 0, pencilOnly: true, quick: true, taps: true, cue: true };
export const prefs = (): Prefs => {
  try { return { ...PREF_DEFAULTS, ...(JSON.parse(localStorage.getItem('ghosty.paint.prefs') ?? '{}') as Partial<Prefs>) }; } catch { return { ...PREF_DEFAULTS }; }
};
export const setPrefs = (p: Partial<Prefs>): void => { try { localStorage.setItem('ghosty.paint.prefs', JSON.stringify({ ...prefs(), ...p })); } catch { /* kept for this visit only */ } };

const key = (label: string, fn: () => void, aria?: string, cls = ''): HTMLButtonElement => {
  const b = button(label, () => fn(), `g-key pxkey${cls ? ` ${cls}` : ''}`);
  b.dataset.g = 'key';
  b.dataset.case = 'keep';
  delete b.dataset.label;
  if (aria) b.setAttribute('aria-label', aria);
  return b;
};
const fileName = (t: string): string => t.replace(/[^\p{L}\p{N} _-]+/gu, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'painting';

/** A soft click where other apps would buzz (Safari ignores vibration). */
let ac: AudioContext | null = null;
function tick(on: boolean): void {
  if (!on) return;
  try {
    ac ??= new AudioContext();
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = 880; g.gain.value = 0.04;
    o.connect(g); g.connect(ac.destination);
    o.start(); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.06); o.stop(ac.currentTime + 0.07);
  } catch { /* no sound on this phone */ }
}

export function giveFile(blob: Blob, name: string): void {
  Object.assign(paintState.saved, { kind: name.split('.').pop() ?? '', name, bytes: blob.size });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name, style: 'display:none' });
  document.body.append(a);
  a.click();
  setTimeout(() => (a.remove(), URL.revokeObjectURL(url)), 4000);
}
async function share(blob: Blob, name: string, title: string): Promise<boolean> {
  const file = new File([blob], name, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (!nav.share || !nav.canShare?.({ files: [file] })) return false;
  await nav.share({ files: [file], title }).catch(() => undefined);
  return true;
}

export interface StudioOpts {
  p: Painting;
  title: string;
  /** called after each change settles, to keep it */
  save: (why: string) => Promise<void>;
  /** called when he leaves the studio */
  close: () => void;
  /** versions he can go back to */
  versions?: () => Promise<{ at: number; thumb?: Blob }[]>;
  restoreVersion?: (i: number) => Promise<void>;
  /** the Comic's inking: a word for the done key, and no gallery words */
  doneWord?: string;
  ask?: (mood: string) => Promise<string[]>;
}

export function openStudio(host: HTMLElement, o: StudioOpts): { el: HTMLElement; stop(): void; repaint(): void } {
  const p = o.p;
  const pf = prefs();
  let tool: Tool = 'brush';
  let brush: Brush = { ...brushOf(paintState.brush || 'ink'), ...(tweaks()[paintState.brush || 'ink'] ?? {}) };
  const sizes: Record<string, number> = {};
  const opac: Record<string, number> = {};
  let colour = paintState.colour || '#111111';
  const recent: string[] = [];
  let sym: Symmetry = 'off';
  let sel: Sel = null;
  let pencilSeen = false;
  let onMask = false;
  let strokes = 0;
  let started = Date.now();
  let stopped = false;
  const view = { s: 1, rot: 0, tx: 0, ty: 0, flip: false };
  /** the canvas still sits as FIT left it (he has not zoomed or moved it), so a resize fits it again */
  let fitted = true;

  // ---- the frame
  const stage = h('div.pxstage', { tabIndex: 0, role: 'img', 'aria-label': `The canvas of ${o.title}. Draw with a finger or an Apple Pencil; pinch with two fingers to zoom and turn.` });
  const cv = h('canvas.pxcanvas') as HTMLCanvasElement;
  stage.append(cv);
  const note = h('p.pxnote', { role: 'status', 'aria-live': 'polite' });
  const say = (w: string): void => { note.textContent = w; paintState.note = w; };
  const titleEl = h('span.pxtitle', o.title);
  const undoK = key('UNDO', () => doUndo(), 'Undo the last change');
  const redoK = key('REDO', () => doRedo(), 'Redo');
  const top = h('div.pxtop', key(o.doneWord ?? 'GALLERY', () => leave(), o.doneWord ? o.doneWord : 'Back to the gallery (it is kept as you go)'), titleEl, undoK, redoK);
  const sizeIn = h('input', { type: 'range', min: '1', max: '200', step: '1', 'aria-label': 'Brush size' }) as HTMLInputElement;
  const opIn = h('input', { type: 'range', min: '5', max: '100', step: '1', 'aria-label': 'Brush opacity' }) as HTMLInputElement;
  const sizeV = h('span.pxval'), opV = h('span.pxval');
  const sliders = h('div.pxsliders', h('label.pxslide', h('span.pxlab', 'Size'), sizeIn, sizeV), h('label.pxslide', h('span.pxlab', 'Opacity'), opIn, opV));
  const sheet = h('div.pxsheet', { hidden: true, role: 'dialog', 'aria-label': 'Paint panel' });
  const toolKeys: Record<string, HTMLButtonElement> = {};
  const swatch = h('span.pxswatch');
  const toolKey = (t: Tool | 'colour' | 'layers' | 'more', label: string, aria: string): HTMLButtonElement => {
    const b = key(label, () => pickTool(t), aria, 'pxtool');
    toolKeys[t] = b;
    return b;
  };
  const colourKey = toolKey('colour', 'COLOUR', 'Colour');
  colourKey.prepend(swatch);
  const bar = h('div.pxbar', { role: 'toolbar', 'aria-label': 'Paint tools' },
    toolKey('brush', 'BRUSH', 'Brush: pick a brush'), toolKey('erase', 'ERASE', 'Eraser'), toolKey('liquify', 'LIQUIFY', 'Liquify: push the picture'),
    toolKey('fill', 'FILL', 'Fill: tap an area to fill it'), toolKey('select', 'SELECT', 'Select: draw round a part'), toolKey('move', 'MOVE', 'Move, scale and turn'),
    colourKey, toolKey('layers', 'LAYERS', 'Layers'), toolKey('more', 'MORE', 'More: symmetry, time-lapse, export'));
  const el = h('div.pxstudio', { role: 'application', 'aria-label': `Paint: ${o.title}` }, top, stage, note, sliders, sheet, bar);
  host.append(el);

  // ---- drawing on screen
  const dpr = (): number => Math.min(2, window.devicePixelRatio || 1);
  let dirty = true, raf = 0;
  const backdrop = (): string => getComputedStyle(el).getPropertyValue('--g-canvas').trim() || '#202020';
  let back = backdrop();
  const fit = (): void => {
    const r = stage.getBoundingClientRect();
    const s = Math.min(r.width / p.w, r.height / p.h) * 0.94;
    view.s = s; view.rot = 0; view.tx = (r.width - p.w * s) / 2; view.ty = (r.height - p.h * s) / 2;
    fitted = true;
    dirty = true;
  };
  const size = (): void => {
    const r = stage.getBoundingClientRect();
    cv.width = Math.max(1, Math.round(r.width * dpr())); cv.height = Math.max(1, Math.round(r.height * dpr()));
    cv.style.width = `${r.width}px`; cv.style.height = `${r.height}px`;
    dirty = true;
  };
  const mat = (): DOMMatrix => {
    let m = new DOMMatrix().translate(view.tx, view.ty).rotate((view.rot * 180) / Math.PI).scale(view.s);
    if (view.flip) m = m.translate(p.w, 0).scale(-1, 1);
    return m;
  };
  const toDoc = (cx: number, cy: number): { x: number; y: number } => {
    const r = stage.getBoundingClientRect();
    const q = mat().inverse().transformPoint(new DOMPoint(cx - r.left, cy - r.top));
    return { x: q.x, y: q.y };
  };
  const paint = (): void => {
    raf = 0;
    if (!dirty || stopped) return;
    dirty = false;
    const g = cv.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = back;
    g.fillRect(0, 0, cv.width, cv.height);
    const m = new DOMMatrix().scale(dpr()).multiply(mat());
    g.setTransform(m);
    if (p.paper === 'none') {
      // a clear canvas shows a soft check
      const t = 24;
      for (let y = 0; y < p.h; y += t) for (let x = 0; x < p.w; x += t) { g.fillStyle = ((x + y) / t) % 2 ? '#d8d8d8' : '#f2f2f2'; g.fillRect(x, y, t, t); }
    }
    g.imageSmoothingQuality = 'high';
    g.drawImage(p.composite(), 0, 0);
    if (sym !== 'off') {
      g.save(); g.strokeStyle = '#0a84ff'; g.globalAlpha = 0.7; g.lineWidth = 1.5 / view.s; g.setLineDash([8 / view.s, 6 / view.s]);
      g.beginPath();
      if (sym === 'vertical' || sym === 'quadrant') { g.moveTo(p.w / 2, 0); g.lineTo(p.w / 2, p.h); }
      if (sym === 'horizontal' || sym === 'quadrant') { g.moveTo(0, p.h / 2); g.lineTo(p.w, p.h / 2); }
      if (sym === 'radial') for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; g.moveTo(p.w / 2, p.h / 2); g.lineTo(p.w / 2 + Math.cos(a) * p.w, p.h / 2 + Math.sin(a) * p.w); }
      g.stroke(); g.restore();
    }
    const ring = lasso.length ? lasso : sel?.pts ?? [];
    if (ring.length >= 4) {
      g.save(); g.lineWidth = 1.5 / view.s;
      for (const [c, off] of [['#000', 0], ['#fff', 6]] as const) {
        g.strokeStyle = c; g.setLineDash([6 / view.s, 6 / view.s]); g.lineDashOffset = off / view.s;
        g.beginPath(); g.moveTo(ring[0]!, ring[1]!); for (let i = 2; i < ring.length; i += 2) g.lineTo(ring[i]!, ring[i + 1]!); if (!lasso.length) g.closePath(); g.stroke();
      }
      g.restore();
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
  };
  const ask = (): void => { dirty = true; if (!raf) raf = requestAnimationFrame(paint); };

  // ---- the state the specs and the screen read
  const sync = (): void => {
    const st = p.steps();
    Object.assign(paintState, {
      open: true, title: o.title, tool, brush: brush.id, colour, size: brush.size, opacity: brush.opacity, sym,
      layers: p.layers.map((L) => ({ id: L.id, name: L.name, blend: L.blend, opacity: L.opacity, visible: L.visible, alphaLock: L.alphaLock, reference: L.reference, mask: !!L.mask })),
      cur: p.cur, undo: st.undo, redo: st.redo, strokes, selection: !!sel,
      view: { zoom: Math.round((view.s / Math.max(1e-6, fitScale())) * 100) / 100, rot: view.rot, flip: view.flip },
    });
    undoK.disabled = !p.canUndo(); redoK.disabled = !p.canRedo();
    undoK.setAttribute('aria-label', p.canUndo() ? `Undo ${p.undoWhat()}` : 'Nothing to undo');
    for (const [t, b] of Object.entries(toolKeys)) b.setAttribute('aria-pressed', String(t === tool || (t === sheetFor && !sheet.hidden)));
    swatch.style.background = colour;
    sizeIn.value = String(Math.round(brush.size)); sizeV.textContent = `${Math.round(brush.size)} px`;
    opIn.value = String(Math.round(brush.opacity * 100)); opV.textContent = `${Math.round(brush.opacity * 100)}%`;
  };
  const fitScale = (): number => { const r = stage.getBoundingClientRect(); return Math.min(r.width / p.w, r.height / p.h) * 0.94 || 1; };

  let saving: ReturnType<typeof setTimeout> | null = null;
  const changed = (why: string): void => {
    sync(); ask();
    if (saving) clearTimeout(saving);
    saving = setTimeout(() => { saving = null; void o.save(why).catch((e) => trail(e, 'paint save')); }, 1500);
    if (sheetFor === 'layers' && !sheet.hidden) layersPanel();
  };
  p.onChange = () => ask();

  const doUndo = (): void => { if (p.undo()) { tick(pf.cue); say(`Undone. ${p.canRedo() ? 'REDO puts it back.' : ''}`.trim()); changed('undo'); } else say('Nothing to undo.'); };
  const doRedo = (): void => { if (p.redo()) { tick(pf.cue); say('Put back.'); changed('redo'); } else say('Nothing to redo.'); };

  // ---- brushes and tools
  const brushFor = (): Brush => (tool === 'erase' ? ERASER : tool === 'liquify' ? SMUDGE : brush);
  const loadBrush = (b: Brush): void => {
    const keep = { size: sizes[b.id] ?? b.size, opacity: opac[b.id] ?? b.opacity };
    if (tool === 'erase') Object.assign(ERASER, keep); else if (tool === 'liquify') Object.assign(SMUDGE, keep); else brush = { ...b, ...(tweaks()[b.id] ?? {}), ...keep };
    paintState.brush = brush.id;
  };
  sizeIn.addEventListener('input', () => { const b = brushFor(); b.size = Number(sizeIn.value); sizes[b.id] = b.size; sizeV.textContent = `${b.size} px`; paintState.size = b.size; });
  opIn.addEventListener('input', () => { const b = brushFor(); b.opacity = Number(opIn.value) / 100; opac[b.id] = b.opacity; opV.textContent = `${opIn.value}%`; paintState.opacity = b.opacity; });
  const showSliders = (): void => {
    const b = brushFor();
    sliders.hidden = !(tool === 'brush' || tool === 'erase' || tool === 'liquify');
    sizeIn.value = String(Math.round(b.size)); sizeV.textContent = `${Math.round(b.size)} px`;
    opIn.value = String(Math.round(b.opacity * 100)); opV.textContent = `${Math.round(b.opacity * 100)}%`;
  };
  let sheetFor = '';
  const closeSheet = (): void => { sheet.hidden = true; sheetFor = ''; paintState.panel = ''; sync(); };
  const openSheet = (which: string, head: string, ...kids: (Node | string)[]): void => {
    clear(sheet);
    sheet.append(h('div.pxsheethead', h('p.pxsheettitle', head), key('CLOSE', () => closeSheet(), `Close ${head}`)), h('div.pxsheetbody', ...kids));
    sheet.hidden = false; sheetFor = which; paintState.panel = which; sync();
  };
  const pickTool = (t: Tool | 'colour' | 'layers' | 'more'): void => {
    if (t === 'colour') return sheetFor === 'colour' && !sheet.hidden ? closeSheet() : colourPanel();
    if (t === 'layers') return sheetFor === 'layers' && !sheet.hidden ? closeSheet() : layersPanel();
    if (t === 'more') return sheetFor === 'more' && !sheet.hidden ? closeSheet() : morePanel();
    if (t === 'brush' && tool === 'brush') { if (sheetFor === 'brush' && !sheet.hidden) closeSheet(); else brushPanel(); return; }
    if (t === 'liquify' && tool === 'liquify') { if (sheetFor === 'liquify' && !sheet.hidden) closeSheet(); else liquifyPanel(); return; }
    if (t === 'select' && tool === 'select' && sel) { if (sheetFor === 'select' && !sheet.hidden) closeSheet(); else selectPanel(); return; }
    if (t === 'move' && tool !== 'move') startMove();
    if (t !== 'move' && tool === 'move') endMove(true);
    tool = t; paintState.tool = t;
    if (t === 'select') say(sel ? 'Draw round another part, or tap once to clear the selection.' : 'Draw round the part to work on. Brushes and fills then stay inside it.');
    else if (t === 'fill') say(p.layers.some((L) => L.reference) ? 'Tap an area: it fills up to the lines of your reference layer.' : 'Tap an area to fill it with your colour.');
    else if (t === 'liquify') say('Push the picture with your finger, like wet paint.');
    else if (t === 'erase') say('Rubbing out on this layer.');
    else if (t === 'brush') say(`${brush.name}. Tap BRUSH again for the others.`);
    closeSheet(); showSliders(); sync();
  };

  // ---- panels
  const brushPanel = (): void => {
    const list = h('div.pxlist', ...BRUSHES.map((b) => {
      const row = key(`${b.name}`, () => { loadBrush(b); tool = 'brush'; paintState.tool = 'brush'; say(`${b.name}: ${b.says}`); closeSheet(); showSliders(); sync(); }, `${b.name}: ${b.says}`, `pxrow${b.id === brush.id ? ' on' : ''}`);
      row.append(h('span.pxrowsay', b.says));
      return row;
    }));
    // this brush's own settings, kept on this phone
    const slider = (label: string, k: 'smooth' | 'pSize' | 'pAlpha' | 'taper', max: number, words: (v: number) => string): HTMLElement => {
      const v = Number(brush[k] ?? 0);
      const inp = h('input', { type: 'range', min: '0', max: String(max * 100), value: String(Math.round(v * 100)), 'aria-label': `${brush.name}: ${label}` }) as HTMLInputElement;
      const val = h('span.pxval', words(v));
      inp.addEventListener('input', () => { const x = Number(inp.value) / 100; (brush as unknown as Record<string, number>)[k] = x; val.textContent = words(x); keepTweak(brush.id, { [k]: x }); });
      return h('label.pxslide', h('span.pxlab', label), inp, val);
    };
    const pct = (v: number): string => `${Math.round(v * 100)}%`;
    const tune = h('div.pxlopts',
      h('p.pxsheetsub', `${brush.name} settings`),
      slider('Streamline', 'smooth', 0.95, pct),
      slider('Size from pressure', 'pSize', 1, pct),
      slider('Opacity from pressure', 'pAlpha', 1, pct),
      slider('Taper', 'taper', 0.6, (v) => `${Math.round(v * 100)} px`),
      key('PUT THIS BRUSH BACK', () => { forgetTweak(brush.id); const keepSize = { size: brush.size, opacity: brush.opacity }; brush = { ...brushOf(brush.id), ...keepSize }; say(`${brush.name} is as it came.`); brushPanel(); }, `Put ${brush.name}'s settings back`));
    openSheet('brush', 'Brushes', list, tune);
  };
  const liquifyPanel = (): void => {
    const keys = (Object.keys(LIQUIFY_NAMES) as Liquify[]).map((m) => { const b = key(LIQUIFY_NAMES[m].toUpperCase(), () => { SMUDGE.lq = m; say(`Liquify: ${LIQUIFY_NAMES[m].toLowerCase()}.`); closeSheet(); }, `Liquify: ${LIQUIFY_NAMES[m]}`); b.setAttribute('aria-pressed', String((SMUDGE.lq ?? 'push') === m)); return b; });
    openSheet('liquify', 'Liquify', h('div.pxrow', ...keys), h('p.pxsmall', 'Push moves the picture along your stroke. Twirl turns it round, pinch draws it in, expand swells it out.'));
  };
  const selectPanel = (): void => {
    openSheet('select', 'Selection', h('div.pxrow',
      key('INVERT', () => { if (sel) { sel = { ...sel, inv: !sel.inv }; say(sel.inv ? 'Everything but the part you drew round is selected.' : 'The part you drew round is selected.'); ask(); sync(); } }, 'Invert the selection'),
      key('CLEAR INSIDE', () => { if (!sel) return; p.clearLayer(p.layer.id, sel); say('Cleared inside the selection. UNDO brings it back.'); changed('clear'); }, 'Clear the part of this layer inside the selection'),
      key('DESELECT', () => { sel = null; say('Selection cleared.'); closeSheet(); ask(); sync(); }, 'Clear the selection')));
  };

  const hsv = (hex: string): [number, number, number] => {
    const n = parseInt(hex.slice(1), 16), r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    const hh = d === 0 ? 0 : mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [((hh * 60) + 360) % 360, mx ? d / mx : 0, mx];
  };
  const hexOf = (hh: number, s: number, v: number): string => {
    const c = v * s, x = c * (1 - Math.abs(((hh / 60) % 2) - 1)), m = v - c;
    const [r, g, b] = hh < 60 ? [c, x, 0] : hh < 120 ? [x, c, 0] : hh < 180 ? [0, c, x] : hh < 240 ? [0, x, c] : hh < 300 ? [x, 0, c] : [c, 0, x];
    return `#${[r, g, b].map((q) => Math.round((q + m) * 255).toString(16).padStart(2, '0')).join('')}`;
  };
  const setColour = (c: string, why = ''): void => {
    colour = c.toLowerCase(); paintState.colour = colour;
    const i = recent.indexOf(colour); if (i >= 0) recent.splice(i, 1); recent.unshift(colour); recent.length = Math.min(recent.length, 10);
    if (why) say(why);
    sync();
  };
  const colourPanel = (): void => {
    let [hh, s, v] = hsv(colour);
    const sv = h('canvas.pxsv', { width: 240, height: 150, 'aria-label': 'Saturation and brightness: drag to pick' }) as HTMLCanvasElement;
    const hue = h('input', { type: 'range', min: '0', max: '359', value: String(Math.round(hh)), 'aria-label': 'Hue' }) as HTMLInputElement;
    const hexIn = h('input', { type: 'text', value: colour, 'aria-label': 'Colour as a hex code', maxLength: 7, spellcheck: false }) as HTMLInputElement;
    const drawSv = (): void => {
      const g = sv.getContext('2d')!;
      const gx = g.createLinearGradient(0, 0, sv.width, 0); gx.addColorStop(0, '#fff'); gx.addColorStop(1, hexOf(hh, 1, 1));
      g.fillStyle = gx; g.fillRect(0, 0, sv.width, sv.height);
      const gy = g.createLinearGradient(0, 0, 0, sv.height); gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(1, '#000');
      g.fillStyle = gy; g.fillRect(0, 0, sv.width, sv.height);
      g.strokeStyle = v > 0.5 ? '#000' : '#fff'; g.lineWidth = 2;
      g.beginPath(); g.arc(s * sv.width, (1 - v) * sv.height, 8, 0, Math.PI * 2); g.stroke();
    };
    const fromSv = (e: PointerEvent): void => {
      const r = sv.getBoundingClientRect();
      s = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); v = Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height));
      setColour(hexOf(hh, s, v)); hexIn.value = colour; drawSv();
    };
    sv.addEventListener('pointerdown', (e) => { try { sv.setPointerCapture(e.pointerId); } catch { /* gone already */ } fromSv(e); });
    sv.addEventListener('pointermove', (e) => { if (e.buttons) fromSv(e); });
    hue.addEventListener('input', () => { hh = Number(hue.value); setColour(hexOf(hh, s, v)); hexIn.value = colour; drawSv(); });
    hexIn.addEventListener('change', () => { const m = /^#?([0-9a-f]{6})$/i.exec(hexIn.value.trim()); if (m) { setColour(`#${m[1]}`); [hh, s, v] = hsv(colour); hue.value = String(Math.round(hh)); drawSv(); } else say('A colour code is # and six letters or numbers, like #1d6fd8.'); });
    const dot = (c: string, label: string): HTMLButtonElement => { const b = key('', () => { setColour(c, `Colour ${c}.`); [hh, s, v] = hsv(colour); hue.value = String(Math.round(hh)); hexIn.value = colour; drawSv(); }, `${label} ${c}`, 'pxdot'); b.style.background = c; return b; };
    const pals = h('div.pxpals', ...PALETTES.map((pl) => h('div.pxpal', h('span.pxlab', pl.name), h('div.pxdots', ...pl.colours.map((c) => dot(c, pl.name))))));
    const rec = recent.length ? h('div.pxpal', h('span.pxlab', 'Recent'), h('div.pxdots', ...recent.map((c) => dot(c, 'Recent')))) : '';
    const pick = key('PICK FROM THE PICTURE', () => { tool = 'pick'; paintState.tool = 'pick'; closeSheet(); say('Tap the picture to take its colour.'); }, 'Eyedropper: tap the picture to take its colour');
    const askRow = o.ask ? (() => {
      const mood = h('input', { type: 'text', placeholder: 'a stormy sea, a cosy kitchen…', 'aria-label': 'A mood for Ghosty’s palette' }) as HTMLInputElement;
      const out = h('div.pxdots');
      const go = key('ASK GHOSTY FOR A PALETTE', async () => {
        const m = mood.value.trim() || 'a calm evening';
        paintState.ask.state = 'loading'; clear(out); out.append(h('span.pxsmall', 'Asking…'));
        try {
          const cols = await o.ask!(m);
          paintState.ask = { state: cols.length ? 'done' : 'empty', colours: cols };
          clear(out);
          if (!cols.length) { out.append(h('span.pxsmall', 'No colours came back. Try other words.')); return; }
          out.append(...cols.map((c) => dot(c, 'Suggested')), key('KEEP THESE', () => { for (const c of cols.slice().reverse()) setColour(c); say(`Kept ${cols.length} colours in Recent.`); colourPanel(); }, 'Keep the suggested colours'), key('NO THANKS', () => { clear(out); paintState.ask.state = 'declined'; }, 'Leave the suggestion'));
        } catch (e) { paintState.ask.state = 'error'; clear(out); out.append(h('span.pxsmall', sayError(e, 'ask for a palette'))); }
      }, 'Ask Ghosty for a palette that fits a mood');
      return h('div.pxpal', h('span.pxlab', 'Ghosty suggests'), mood, go, out);
    })() : '';
    openSheet('colour', 'Colour', h('div.pxcolour', sv, h('label.pxslide', h('span.pxlab', 'Hue'), hue), h('label.pxslide', h('span.pxlab', 'Code'), hexIn)), pick, rec, pals, askRow);
    drawSv();
  };

  const pickPic = h('input', { type: 'file', accept: 'image/*', hidden: true }) as HTMLInputElement;
  pickPic.addEventListener('change', async () => {
    const f = pickPic.files?.[0];
    pickPic.value = '';
    if (!f) return;
    if (p.layers.length >= MAX_LAYERS) { say(`A painting holds up to ${MAX_LAYERS} layers. Merge two to make room.`); return; }
    try {
      const bmp = await createImageBitmap(f);
      const k = Math.min(p.w / bmp.width, p.h / bmp.height);
      const w = bmp.width * k, hh = bmp.height * k;
      bmp.close?.();
      p.addLayer(f.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'Picture');
      await p.placeAsync(p.layer.id, f, (p.w - w) / 2, (p.h - hh) / 2, w, hh);
      onMask = false;
      say('Your picture is a new layer. Lower its opacity to trace over it, or MOVE it into place.');
      changed('picture');
    } catch (e) { say(sayError(e, 'add that picture')); }
  });
  el.append(pickPic);
  const layersPanel = (): void => {
    const rows = p.layers.map((L, i) => ({ L, i })).reverse().map(({ L, i }) => {
      const on = i === p.cur;
      const thumb = mk(48, 64);
      const tg = thumb.getContext('2d')!;
      tg.fillStyle = '#fff'; tg.fillRect(0, 0, 48, 64);
      const s = Math.min(48 / p.w, 64 / p.h);
      tg.drawImage(L.c, (48 - p.w * s) / 2, (64 - p.h * s) / 2, p.w * s, p.h * s);
      thumb.className = 'pxthumb';
      const pickK = key(L.name, () => { p.cur = i; onMask = false; say(`Drawing on ${L.name}.`); sync(); layersPanel(); }, `Draw on ${L.name}${on ? ' (chosen)' : ''}`, `pxlname${on ? ' on' : ''}`);
      const eye = key(L.visible ? 'SHOWN' : 'HIDDEN', () => { p.setProp(L.id, 'visible', !L.visible); changed('visible'); }, `${L.visible ? 'Hide' : 'Show'} ${L.name}`);
      const row = h('div.pxlayer', { dataset: { on: String(on), id: L.id } }, thumb, h('div.pxlwords', pickK, h('span.pxsmall', `${blendName(L.blend)} · ${Math.round(L.opacity * 100)}%${L.alphaLock ? ' · alpha locked' : ''}${L.reference ? ' · reference' : ''}${L.mask ? ' · mask' : ''}`)), eye);
      return row;
    });
    const L = p.layer;
    const blend = h('select', { 'aria-label': 'Blend mode' }, ...BLENDS.map((b) => h('option', { value: b.id, selected: b.id === L.blend }, b.name))) as HTMLSelectElement;
    blend.addEventListener('change', () => { p.setProp(L.id, 'blend', blend.value); changed('blend'); });
    const op = h('input', { type: 'range', min: '0', max: '100', value: String(Math.round(L.opacity * 100)), 'aria-label': 'Layer opacity' }) as HTMLInputElement;
    op.addEventListener('change', () => { p.setProp(L.id, 'opacity', Number(op.value) / 100); changed('opacity'); });
    const toggle = (label: string, on: boolean, fn: () => void, aria: string): HTMLButtonElement => { const b = key(label, fn, aria); b.setAttribute('aria-pressed', String(on)); return b; };
    const opts = h('div.pxlopts',
      h('label.pxslide', h('span.pxlab', 'Blend'), blend),
      h('label.pxslide', h('span.pxlab', 'Opacity'), op),
      h('div.pxrow',
        toggle('ALPHA LOCK', L.alphaLock, () => { p.setProp(L.id, 'alphaLock', !L.alphaLock); say(L.alphaLock ? 'Alpha lock on: paint only lands where this layer already has paint.' : 'Alpha lock off.'); changed('lock'); }, 'Alpha lock: paint only where this layer has paint'),
        toggle('REFERENCE', L.reference, () => { p.setProp(L.id, 'reference', !L.reference); say(L.reference ? `${L.name} is the reference: fills on any layer stop at its lines.` : 'No reference layer.'); changed('ref'); }, 'Reference: fills stop at this layer’s lines'),
        toggle(L.mask ? (onMask ? 'DRAWING ON MASK' : 'MASK') : 'ADD MASK', !!L.mask && onMask, () => {
          if (!L.mask) { p.setMask(L.id, true); onMask = true; say('Mask added. Brush hides this layer, eraser brings it back.'); }
          else if (!onMask) { onMask = true; say('Drawing on the mask: brush hides, eraser brings back.'); }
          else { onMask = false; say('Drawing on the layer again.'); }
          changed('mask');
        }, 'Layer mask: brush hides, eraser brings back'),
        L.mask ? key('REMOVE MASK', () => { p.setMask(L.id, false); onMask = false; changed('mask'); }, 'Remove the mask') : ''),
      h('div.pxrow',
        key('NEW LAYER', () => { if (p.layers.length >= MAX_LAYERS) return say(`A painting holds up to ${MAX_LAYERS} layers. Merge two to make room.`); p.addLayer(`Layer ${p.layers.length + 1}`); onMask = false; say('A new layer, on top of the one you were on.'); changed('add'); }, 'Add a new layer'),
        key('DUPLICATE', () => { if (p.layers.length >= MAX_LAYERS) return say(`A painting holds up to ${MAX_LAYERS} layers.`); p.duplicate(L.id); changed('dup'); }, 'Duplicate this layer'),
        key('UP', () => { p.moveLayer(L.id, p.cur + 1); changed('move'); }, 'Move this layer up'),
        key('DOWN', () => { p.moveLayer(L.id, p.cur - 1); changed('move'); }, 'Move this layer down'),
        key('MERGE DOWN', () => { if (p.cur === 0) return say('This is the bottom layer: nothing under it to merge into.'); p.mergeDown(L.id); changed('merge'); }, 'Merge into the layer below'),
        key('CLEAR', () => { p.clearLayer(L.id); say('Layer cleared. UNDO brings it back.'); changed('clear'); }, 'Clear this layer'),
        key('DELETE', () => { if (p.layers.length <= 1) return say('A painting keeps at least one layer.'); p.deleteLayer(L.id); say('Layer deleted. UNDO brings it back.'); changed('del'); }, 'Delete this layer'),
        key('RENAME', () => { const n = prompt('Layer name', L.name); if (n && n.trim()) { p.setProp(L.id, 'name', n.trim().slice(0, 40)); changed('name'); } }, 'Rename this layer'),
        key('ADD A PICTURE', () => pickPic.click(), 'Add one of my pictures as a new layer, to trace or paint over')));
    openSheet('layers', `Layers (${p.layers.length} of ${MAX_LAYERS})`, h('div.pxlayers', ...rows), opts);
  };

  const morePanel = (): void => {
    const symSel = h('select', { 'aria-label': 'Symmetry guide' }, ...(Object.keys(SYMMETRY_NAMES) as Symmetry[]).map((k) => h('option', { value: k, selected: k === sym }, SYMMETRY_NAMES[k]))) as HTMLSelectElement;
    symSel.addEventListener('change', () => { sym = symSel.value as Symmetry; say(sym === 'off' ? 'Symmetry off.' : `Symmetry: ${SYMMETRY_NAMES[sym].toLowerCase()}.`); sync(); ask(); });
    const paperSel = h('select', { 'aria-label': 'Paper' }, ...[['#ffffff', 'White'], ['#f4f1ea', 'Cream'], ['#1b1b1b', 'Black'], ['none', 'Clear (see-through)']].map(([v, n]) => h('option', { value: v, selected: v === p.paper }, n))) as HTMLSelectElement;
    paperSel.addEventListener('change', () => { p.setPaper(paperSel.value); changed('paper'); });
    const quick = h('label.pxcheck', h('input', { type: 'checkbox', checked: pf.quick, onchange: (e: Event) => { pf.quick = (e.target as HTMLInputElement).checked; setPrefs({ quick: pf.quick }); } }), 'QuickShape: hold still at the end of a stroke to snap it');
    const tl = h('canvas.pxtl', { width: 360, height: 480, hidden: true, 'aria-label': 'The time-lapse' }) as HTMLCanvasElement;
    const tlNote = h('p.pxsmall', `${framesIn(p.log)} steps recorded.`);
    let stopTl = false;
    const play = async (record: boolean): Promise<void> => {
      if (paintState.timelapse.playing) { stopTl = true; return; }
      if (!framesIn(p.log)) { tlNote.textContent = 'Nothing drawn yet: the time-lapse starts with your first stroke.'; return; }
      if (record && !videoType()) { tlNote.textContent = 'This browser cannot record a video of the canvas. PLAY still shows the time-lapse here.'; return; }
      stopTl = false;
      const r = p.w / p.h;
      tl.width = r >= 1 ? 720 : Math.round(720 * r); tl.height = r >= 1 ? Math.round(720 / r) : 720;
      tl.hidden = false;
      Object.assign(paintState.timelapse, { frames: framesIn(p.log), shown: 0, playing: true });
      tlNote.textContent = record ? 'Recording the time-lapse… 0%' : 'Playing… tap PLAY again to stop.';
      try {
        const vid = await playInto(tl, p.log, p.w, p.h, p.paper, { record, stop: () => stopTl || stopped, progress: (f) => { paintState.timelapse.shown = Math.round(f * paintState.timelapse.frames); if (record) tlNote.textContent = `Recording the time-lapse… ${Math.round(f * 100)}%`; } });
        if (vid) {
          const ext = vid.type.includes('mp4') ? 'mp4' : 'webm';
          Object.assign(paintState.timelapse, { video: ext, bytes: vid.size });
          const name = `${fileName(o.title)}-time-lapse.${ext}`;
          if (!(await share(vid, name, o.title))) giveFile(vid, name);
          tlNote.textContent = `Saved the time-lapse as a video (${ext.toUpperCase()}, ${(vid.size / 1048576).toFixed(1)} MB).`;
        } else tlNote.textContent = stopTl ? 'Stopped.' : 'That was the whole painting, stroke by stroke.';
      } catch (e) { tlNote.textContent = sayError(e, 'play the time-lapse'); } finally { paintState.timelapse.playing = false; }
    };
    const exp = async (kind: 'png' | 'jpg' | 'psd' | 'ora'): Promise<void> => {
      try {
        say('Making the file…');
        const blob = kind === 'png' ? await pngOf(p) : kind === 'jpg' ? await jpegOf(p) : kind === 'psd' ? psdBlob(p) : await oraBlob(p, o.title);
        const name = `${fileName(o.title)}.${kind}`;
        giveFile(blob, name);
        say(`Saved ${name} (${blob.size > 1048576 ? `${(blob.size / 1048576).toFixed(1)} MB` : `${Math.ceil(blob.size / 1024)} KB`}).${kind === 'psd' ? ' Photoshop, Procreate, Affinity and Photopea open it with every layer apart.' : kind === 'ora' ? ' Krita and GIMP open it with every layer apart.' : ''}`);
      } catch (e) { say(sayError(e, 'save the file')); }
    };
    const shareK = key('SHARE', async () => { try { const b = await pngOf(p); if (!(await share(b, `${fileName(o.title)}.png`, o.title))) { giveFile(b, `${fileName(o.title)}.png`); say('This browser has no Share sheet, so the PNG was saved instead.'); } } catch (e) { say(sayError(e, 'share it')); } }, 'Share the picture through the Share sheet');
    const vers = h('div.pxvers');
    const loadVers = async (): Promise<void> => {
      if (!o.versions) return;
      const list = await o.versions();
      paintState.versions = list.length;
      clear(vers);
      if (!list.length) { vers.append(h('p.pxsmall', 'A version is kept each time you leave a painting you changed. None yet.')); return; }
      list.forEach((v, i) => vers.append(key(`GO BACK TO ${new Date(v.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`, async () => { await o.restoreVersion?.(i); }, `Go back to the version from ${new Date(v.at).toLocaleString('en-GB')}`)));
    };
    void loadVers();
    openSheet('more', 'More',
      h('label.pxslide', h('span.pxlab', 'Symmetry'), symSel),
      quick,
      h('label.pxslide', h('span.pxlab', 'Paper'), paperSel),
      h('div.pxrow', key('FLIP THE VIEW', () => { view.flip = !view.flip; say(view.flip ? 'The view is flipped (your painting is not): fresh eyes on its balance.' : 'The view is back.'); sync(); ask(); }, 'Flip the view left to right'), key('FIT', () => { fit(); sync(); }, 'Fit the canvas to the screen')),
      h('p.pxsheetsub', 'Time-lapse'),
      h('div.pxrow', key('PLAY', () => void play(false), 'Play the time-lapse'), key('SAVE AS VIDEO', () => void play(true), 'Save the time-lapse as a video')),
      tlNote, tl,
      h('p.pxsheetsub', 'Save and share'),
      h('div.pxrow', key('PNG', () => void exp('png'), 'Save as PNG'), key('JPEG', () => void exp('jpg'), 'Save as JPEG'), key('PSD WITH LAYERS', () => void exp('psd'), 'Save as a layered PSD'), key('ORA WITH LAYERS', () => void exp('ora'), 'Save as a layered OpenRaster file'), shareK),
      o.versions ? h('p.pxsheetsub', 'Versions') : '', vers,
      h('p.pxsheetsub', 'Help'),
      h('p.pxsmall', 'Two fingers pinch to zoom and turn. A two-finger tap undoes, three fingers redo. With an Apple Pencil, your palm never draws. Keys: B brush, E eraser, F fill, S select, V move, Z or ⌘Z undo, ⇧⌘Z redo, [ and ] size.'));
  };

  // ---- move and transform
  let moving: { m: DOMMatrix; base: DOMMatrix } | null = null;
  const startMove = (): void => {
    moving = { m: new DOMMatrix(), base: new DOMMatrix() };
    p.preview = { L: p.layer.id, c: p.transformed(p.layer.id, [1, 0, 0, 1, 0, 0], sel)! };
    say(`Moving ${sel ? 'the selection' : p.layer.name}: drag to move, two fingers to scale and turn. Tap another tool to finish.`);
    const flips = h('div.pxrow.pxmovekeys',
      key('FLIP ↔', () => applyM(new DOMMatrix().translate(cxOf(), 0).scale(-1, 1).translate(-cxOf(), 0)), 'Flip left to right'),
      key('FLIP ↕', () => applyM(new DOMMatrix().translate(0, cyOf()).scale(1, -1).translate(0, -cyOf())), 'Flip top to bottom'),
      key('TURN 90°', () => applyM(new DOMMatrix().translate(cxOf(), cyOf()).rotate(90).translate(-cxOf(), -cyOf())), 'Turn a quarter'),
      key('DONE', () => pickTool('brush'), 'Finish moving'),
      key('CANCEL', () => { endMove(false); tool = 'brush'; paintState.tool = 'brush'; say('Left where it was.'); sync(); }, 'Cancel the move'));
    clear(sheet); sheet.append(flips); sheet.hidden = false; sheetFor = 'move';
  };
  const cxOf = (): number => { if (!sel) return p.w / 2; const xs = sel.pts.filter((_, i) => i % 2 === 0); return (Math.min(...xs) + Math.max(...xs)) / 2; };
  const cyOf = (): number => { if (!sel) return p.h / 2; const ys = sel.pts.filter((_, i) => i % 2 === 1); return (Math.min(...ys) + Math.max(...ys)) / 2; };
  const applyM = (d: DOMMatrix): void => {
    if (!moving) return;
    moving.m = d.multiply(moving.m);
    const m = moving.m;
    p.preview = { L: p.layer.id, c: p.transformed(p.layer.id, [m.a, m.b, m.c, m.d, m.e, m.f], sel)! };
    ask();
  };
  const endMove = (commit: boolean): void => {
    if (!moving) return;
    const m = moving.m;
    moving = null;
    p.preview = null;
    sheet.hidden = true; sheetFor = '';
    if (commit && !m.isIdentity) {
      p.transform(p.layer.id, [m.a, m.b, m.c, m.d, m.e, m.f], sel);
      if (sel) { const pts: number[] = []; for (let i = 0; i < sel.pts.length; i += 2) { const q = m.transformPoint(new DOMPoint(sel.pts[i], sel.pts[i + 1])); pts.push(q.x, q.y); } sel = { ...sel, pts }; }
      changed('move');
    }
    ask();
  };

  // ---- pointers: drawing, the bucket, the lasso, gestures
  const pointers = new Map<number, { x: number; y: number; t: number; type: string }>();
  let stroke: { id: number; raw: Pt[]; sm: (q: Pt) => Pt | null; carry: { at: number; dist: number; prev: Pt | null; rnd: () => number }; seed: number; last: Pt | null; still: number; snapped: boolean; b: Brush; t0: number; moved: number } | null = null;
  let gesture: { start: Map<number, { x: number; y: number }>; view: typeof view; t: number; moved: number; n: number } | null = null;
  let lasso: number[] = [];
  let snapTimer: ReturnType<typeof setTimeout> | null = null;

  const ptOf = (e: PointerEvent, prev: Pt | null): Pt => {
    const d = toDoc(e.clientX, e.clientY);
    const pen = e.pointerType === 'pen';
    const raw = pen ? (e.pressure || 0.5) : e.pointerType === 'mouse' ? 0.7 : fingerPressure(prev, d.x, d.y, e.timeStamp);
    const pp = pen ? curveOf(raw, pf.curve) : raw;
    const ex = e as PointerEvent & { altitudeAngle?: number; azimuthAngle?: number };
    let alt = Math.PI / 2, az = 0;
    if (pen) {
      if (typeof ex.altitudeAngle === 'number') { alt = ex.altitudeAngle; az = ex.azimuthAngle ?? 0; }
      else if (e.tiltX || e.tiltY) { const tx = Math.tan((e.tiltX * Math.PI) / 180), ty = Math.tan((e.tiltY * Math.PI) / 180); alt = Math.atan(1 / Math.max(1e-6, Math.hypot(tx, ty))); az = Math.atan2(ty, tx); }
    }
    paintState.pressure = { last: Math.round(pp * 100) / 100, kind: e.pointerType };
    return { x: d.x, y: d.y, p: pp, alt, az, t: e.timeStamp };
  };

  const beginStroke = (e: PointerEvent): void => {
    const b = { ...brushFor() };
    const L = p.layer;
    if (!L.visible) { say(`${L.name} is hidden. Show it in LAYERS to draw on it.`); return; }
    const finger = e.pointerType !== 'pen';
    const amount = Math.max(b.smooth, finger ? pf.smooth : b.smooth * 0.6);
    p.begin(tool === 'erase' ? 'erase' : tool === 'liquify' ? 'liquify' : 'brush', b, onMask && !!L.mask, sel);
    const seed = (Math.random() * 2 ** 31) | 0;
    stroke = { id: e.pointerId, raw: [], sm: smoother(amount, finger ? pf.lazy : 0), carry: { at: 0, dist: 0, prev: null, rnd: seeded(seed) }, seed, last: null, still: 0, snapped: false, b, t0: e.timeStamp, moved: 0 };
    addPoint(e);
  };
  const addPoint = (e: PointerEvent): void => {
    if (!stroke || stroke.snapped) return;
    const evs = (e.getCoalescedEvents?.() ?? []).length ? e.getCoalescedEvents() : [e];
    const out: Pt[] = [];
    for (const ce of evs) {
      const q = ptOf(ce, stroke.last);
      if (stroke.last) stroke.moved += Math.hypot(q.x - stroke.last.x, q.y - stroke.last.y);
      stroke.last = q;
      const s = stroke.sm(q);
      if (s) { stroke.raw.push(s); out.push(s); }
    }
    if (out.length) { p.dabs(out, stroke.b, colour, sym, p.w / 2, p.h / 2, stroke.seed, stroke.carry); ask(); }
    if (pf.quick && tool === 'brush') {
      if (snapTimer) clearTimeout(snapTimer);
      snapTimer = setTimeout(() => trySnap(), 550);
    }
  };
  const trySnap = (): void => {
    if (!stroke || stroke.snapped || stroke.raw.length < 6) return;
    const shape = quickShape(stroke.raw);
    if (!shape) return;
    stroke.snapped = true;
    stroke.raw = shape.pts;
    p.begin('brush', stroke.b, onMask && !!p.layer.mask, sel);
    p.dabs(shape.pts, stroke.b, colour, sym, p.w / 2, p.h / 2, stroke.seed, { at: 0, dist: 0, prev: null, rnd: seeded(stroke.seed) });
    paintState.quick = shape.kind;
    say(`Snapped to a clean ${shape.kind}. Lift to keep it.`);
    tick(pf.cue);
    ask();
  };
  const finishStroke = (): void => {
    if (snapTimer) { clearTimeout(snapTimer); snapTimer = null; }
    if (!stroke) return;
    const s = stroke;
    stroke = null;
    if (!s.raw.length) { p.cancel(); return; }
    p.end({ k: 'stroke', L: p.layer.id, tool: tool === 'erase' ? 'erase' : tool === 'liquify' ? 'liquify' : 'brush', b: s.b, col: colour, sym, cx: p.w / 2, cy: p.h / 2, seed: s.seed, pts: pack(s.raw), onMask: onMask && !!p.layer.mask, sel });
    strokes++;
    if (!s.snapped) paintState.quick = '';
    changed('stroke');
  };

  const onDown = (e: PointerEvent): void => {
    if (e.pointerType === 'pen') pencilSeen = true;
    try { stage.setPointerCapture?.(e.pointerId); } catch { /* a pointer the browser no longer knows */ }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, t: e.timeStamp, type: e.pointerType });
    const touches = [...pointers.values()].filter((q) => q.type === 'touch');
    // a second finger: it was a pinch (or a two-finger tap), not a stroke
    if (touches.length >= 2 && e.pointerType === 'touch') {
      if (stroke && stroke.moved < 30) { p.cancel(); stroke = null; }
      if (lasso.length < 8) lasso = [];
      gesture = { start: new Map([...pointers].filter(([, q]) => q.type === 'touch').map(([id, q]) => [id, { x: q.x, y: q.y }])), view: { ...view }, t: e.timeStamp, moved: 0, n: Math.max(gesture?.n ?? 0, touches.length) };
      if (moving) gesture.view = { ...view };
      return;
    }
    if (e.pointerType === 'touch' && pencilSeen && pf.pencilOnly) return;
    if (e.button > 0) return;
    if (tool === 'brush' || tool === 'erase' || tool === 'liquify') beginStroke(e);
    else if (tool === 'select') { const d = toDoc(e.clientX, e.clientY); lasso = [d.x, d.y]; }
    else if (tool === 'move') { /* the drag moves it */ }
  };
  const onMove = (e: PointerEvent): void => {
    const was = pointers.get(e.pointerId);
    if (!was) return;
    const prevPos = { x: was.x, y: was.y };
    pointers.set(e.pointerId, { ...was, x: e.clientX, y: e.clientY });
    if (gesture) {
      const ids = [...gesture.start.keys()].filter((id) => pointers.has(id)).slice(0, 2);
      if (ids.length < 2) return;
      const a0 = gesture.start.get(ids[0]!)!, b0 = gesture.start.get(ids[1]!)!, a1 = pointers.get(ids[0]!)!, b1 = pointers.get(ids[1]!)!;
      const d0 = Math.hypot(b0.x - a0.x, b0.y - a0.y) || 1, d1 = Math.hypot(b1.x - a1.x, b1.y - a1.y) || 1;
      const ang = Math.atan2(b1.y - a1.y, b1.x - a1.x) - Math.atan2(b0.y - a0.y, b0.x - a0.x);
      const m0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 }, m1 = { x: (a1.x + b1.x) / 2, y: (a1.y + b1.y) / 2 };
      gesture.moved = Math.max(gesture.moved, Math.hypot(m1.x - m0.x, m1.y - m0.y), Math.abs(d1 - d0));
      const r = stage.getBoundingClientRect();
      if (moving) {
        // two fingers in MOVE scale and turn the layer or selection about the fingers' middle
        const c0 = toDoc(m0.x, m0.y), c1 = toDoc(m1.x, m1.y);
        const k = d1 / d0;
        const step = new DOMMatrix().translate(c1.x, c1.y).rotate((ang * 180) / Math.PI).scale(k).translate(-c0.x, -c0.y);
        moving.m = step.multiply(moving.base);
        const m = moving.m;
        p.preview = { L: p.layer.id, c: p.transformed(p.layer.id, [m.a, m.b, m.c, m.d, m.e, m.f], sel)! };
        ask();
        return;
      }
      const v0 = gesture.view;
      const k = Math.max(0.1, Math.min(20, (v0.s * d1) / d0)) / v0.s;
      const rot = Math.abs(ang) < 0.08 && Math.abs(v0.rot) < 0.01 ? 0 : ang;
      // keep the point under the fingers' middle under it
      const px = m0.x - r.left - v0.tx, py = m0.y - r.top - v0.ty;
      const cos = Math.cos(rot), sin = Math.sin(rot);
      view.s = v0.s * k; view.rot = v0.rot + rot; fitted = false;
      view.tx = m1.x - r.left - (px * cos - py * sin) * k;
      view.ty = m1.y - r.top - (px * sin + py * cos) * k;
      ask();
      return;
    }
    if (stroke && e.pointerId === stroke.id) addPoint(e);
    else if (tool === 'select' && lasso.length && e.buttons) { const d = toDoc(e.clientX, e.clientY); lasso.push(d.x, d.y); ask(); }
    else if (tool === 'move' && moving && e.buttons) {
      const a = toDoc(prevPos.x, prevPos.y), b = toDoc(e.clientX, e.clientY);
      applyM(new DOMMatrix().translate(b.x - a.x, b.y - a.y));
      moving.base = moving.m;
    }
  };
  const onUp = (e: PointerEvent): void => {
    const was = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (!was) return;
    if (gesture) {
      if (pointers.size === 0) {
        const tap = e.timeStamp - gesture.t < 300 && gesture.moved < 12;
        if (tap && pf.taps && !moving) { if (gesture.n >= 3) doRedo(); else if (gesture.n === 2) doUndo(); }
        if (moving) moving.base = moving.m;
        gesture = null;
        sync();
      }
      return;
    }
    if (stroke && e.pointerId === stroke.id) { finishStroke(); return; }
    const d = toDoc(e.clientX, e.clientY);
    if (tool === 'fill') {
      if (d.x < 0 || d.y < 0 || d.x >= p.w || d.y >= p.h) return;
      const L = p.layer;
      const ok = p.fill(L.id, d.x, d.y, colour, 24, p.layers.some((q) => q.reference), sel);
      say(ok ? 'Filled.' : 'Nothing to fill there.');
      if (ok) { strokes++; tick(pf.cue); changed('fill'); }
    } else if (tool === 'pick') {
      setColour(p.colourAt(d.x, d.y), '');
      say(`Took ${colour} from the picture.`);
      tool = 'brush'; paintState.tool = 'brush'; showSliders(); sync();
    } else if (tool === 'select') {
      if (lasso.length >= 12) { sel = { pts: lasso.slice(), inv: false }; say('Selected. Brushes and fills stay inside it; MOVE moves just this part. Tap SELECT for invert and clear.'); }
      else { sel = null; say('Selection cleared.'); }
      lasso = [];
      sync(); ask();
    }
  };
  const onCancel = (e: PointerEvent): void => { pointers.delete(e.pointerId); if (stroke && stroke.id === e.pointerId) { p.cancel(); stroke = null; ask(); } if (!pointers.size) gesture = null; };
  stage.addEventListener('pointerdown', onDown);
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerup', onUp);
  stage.addEventListener('pointercancel', onCancel);
  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = stage.getBoundingClientRect();
    const k = Math.exp(-e.deltaY * 0.0015);
    const px = e.clientX - r.left, py = e.clientY - r.top;
    view.tx = px - (px - view.tx) * k; view.ty = py - (py - view.ty) * k; view.s *= k; fitted = false;
    sync(); ask();
  }, { passive: false });
  // the iPhone's own pinch-zoom of the page must not fight the canvas
  const noGesture = (e: Event): void => e.preventDefault();
  stage.addEventListener('gesturestart', noGesture);
  stage.addEventListener('touchmove', noGesture, { passive: false });

  const onKey = (e: KeyboardEvent): void => {
    if (stopped || (e.target as HTMLElement)?.closest?.('input, textarea, select')) return;
    const k = e.key.toLowerCase();
    if ((e.metaKey || e.ctrlKey) && k === 'z') { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (k === 'b') pickTool('brush'); else if (k === 'e') pickTool('erase'); else if (k === 'f') pickTool('fill'); else if (k === 's') pickTool('select'); else if (k === 'v') pickTool('move');
    else if (k === 'z') doUndo(); else if (k === 'l') pickTool('layers');
    else if (k === '[' || k === ']') { const b = brushFor(); b.size = Math.max(1, Math.min(200, Math.round(b.size * (k === ']' ? 1.2 : 1 / 1.2)))); sizes[b.id] = b.size; showSliders(); sync(); }
    else if (k === 'escape') closeSheet();
  };
  document.addEventListener('keydown', onKey);

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { size(); if (fitted) fit(); back = backdrop(); ask(); }) : null;
  ro?.observe(stage);
  requestAnimationFrame(() => { size(); fit(); back = backdrop(); sync(); ask(); });
  showSliders();
  say(o.doneWord ? 'Ink straight onto the panel. Your lines sit on their own layer over the art.' : `${brush.name} on ${p.layer.name}. Pinch to zoom; a two-finger tap undoes.`);

  // (for the specs: the paint at a point of a layer, and how much of each layer has paint)
  const gw = window as unknown as { __ghosty?: Record<string, unknown> };
  if (gw.__ghosty) {
    gw.__ghosty.paint = paintState;
    gw.__ghosty.paintAt = (x: number, y: number, i = p.cur): number => { const L = p.layers[i]; return L ? L.c.getContext('2d')!.getImageData(Math.floor(x), Math.floor(y), 1, 1).data[3]! : 0; };
    gw.__ghosty.paintInked = (): number[] => p.layers.map((L) => p.inked(L.id));
    gw.__ghosty.paintDoc = (): { w: number; h: number; log: number; s: number; tx: number; ty: number } => ({ w: p.w, h: p.h, log: p.log.length, s: view.s, tx: view.tx, ty: view.ty });
  }
  const leave = (): void => { endMove(true); o.close(); };
  started = Date.now();
  return {
    el,
    repaint: () => { sync(); ask(); },
    stop: () => {
      stopped = true;
      if (saving) { clearTimeout(saving); saving = null; }
      if (snapTimer) clearTimeout(snapTimer);
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      ro?.disconnect();
      paintState.open = false;
      paintState.timelapse.playing = false;
      void started;
      el.remove();
    },
  };
}
