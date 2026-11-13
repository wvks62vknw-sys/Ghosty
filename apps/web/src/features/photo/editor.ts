/**
 * THE PHOTO EDITOR (BRIEF-EDITOR-PHOTO; MAKE → PHOTO): the stage (the photo filling the width, pinch to zoom, two fingers to pan, a
 * press and hold anywhere on it for the original), the tools as pills along the foot in groups, a tray of sliders above them (trays.ts),
 * UNDO / REDO / HISTORY, EXPORT, and the autosave. The picture is drawn by the app's own WebGL2 pipeline (photo/gpu.ts); where WebGL2 is
 * missing or lost it is drawn the slow way (photo/cpu.ts) and says so. The original's bytes are never touched (photo/store.ts).
 * State for specs at window.__ghosty.photoedit.
 */
import { clear, h } from '../../core/dom';
import { sayError } from '../../ui/hisWords';
import { button, modal, toast } from '../../ui/components';
import { ui } from '../../state/app';
import { geoOf, maskAt, renderCpu, type Src } from '../../photo/cpu';
import { compare, exportCanvas, PhotoGL, srcOf, type View } from '../../photo/gpu';
import { mapIn, mapOut } from '../../photo/math';
import { cloneRecipe, frameSize, newMask, newRecipe, outputSize, RecipeHistory, type Mask, type Recipe } from '../../photo/recipe';
import { getDecoded, getLayer, getMeta, getOriginal, getRecipe, listMyLooks, rememberLast, saveRecipe, storeState } from '../../photo/store';
import { applyPatches, forgetPatches, getPatch, patchKey } from '../../photo/patch';
import { coverage, type Alpha } from '../../photo/alpha';
import { packOffer } from './packui';
import { packSize } from '../../photo/packget';
import { openPhoto } from '../../photo/load';
import { stroke as alphaStroke, getAlpha, putAlpha, alphaSizeFor, blankAlpha } from '../../photo/alpha';
import { buildTray, TOOLS, type Tool } from './trays';
import { openExport } from './exportsheet';

/** What the editor shows, for the specs (window.__ghosty.photoedit). */
export const peState = {
  /** True while a change is waiting to be drawn (a spec waits for it to clear, never for a clock). */
  pending: false,
  /** True once the photo is decoded, drawn and its tool is up (a spec waits on this, never on a clock). */
  ready: false,
  /** Spec hooks: a point of the original (0..1) as the screen draws it now, and the colour drawn there. */
  project: null as null | ((fx: number, fy: number) => { x: number; y: number }),
  sample: null as null | ((fx: number, fy: number) => number[] | null),
  sampleAt: null as null | ((u: number, v: number) => number[] | null),
  /** Spec hook: the GPU's picture against the slow path's on a 64 × 64 test picture, the largest difference in any channel (units of 1/255). */
  /** Spec hook: a copy of the recipe now. */
  recipe: null as null | (() => Recipe),
  compare64: null as null | (() => { max: number; mean: number } | { error: string }),
  open: false,
  id: '',
  name: '',
  tool: 'light' as Tool,
  gl: 'none' as 'webgl2' | 'slow' | 'none',
  slowLine: '',
  renderer: '',
  maxTexture: 0,
  tile: 0,
  floatTargets: '',
  scaled: false,
  size: { w: 0, h: 0 },
  drawn: { w: 0, h: 0 },
  zoom: 1,
  frameMs: 0,
  draws: 0,
  held: false,
  holdHint: '',
  saved: '',
  saves: 0,
  steps: 1,
  at: 0,
  canUndo: false,
  canRedo: false,
  mask: '',
  showMask: false,
  cropMode: false,
  status: '',
  persistent: true,
  looks: [] as string[],
  offline: false,
  /** Which cut SUBJECT made last ("model" or "depth"), how long the model took (ms), and the reason the model did not run, when it did not. */
  cutFrom: '' as '' | 'model' | 'depth',
  cutMs: 0,
  cutFail: '',
  /** Which erase ran last ("phone" or "brain"), how long it took (ms), true while it runs, and the reason the model did not run. */
  erasedBy: '' as '' | 'phone' | 'brain',
  eraseMs: 0,
  erasing: false,
  eraseFail: '',
  erases: 0,
  /** Spec hook: what each erase fill holds now (its rectangle in the original's frame, its size, how much of it is opaque and its mean colour). */
  patches: null as null | (() => { x: number; y: number; w: number; h: number; pw: number; ph: number; opaque: number; mean: number[] }[]),
  /** The RAW opened on this screen: what the reader said (empty for any other photo). */
  raw: '',
  rawMs: 0,
};

export interface Ed {
  /** The live recipe. */
  r: Recipe;
  srcSize: { w: number; h: number };
  orig: HTMLCanvasElement | null;
  gl: PhotoGL | null;
  /** Change the recipe and draw it (not yet a step). */
  live(fn: (r: Recipe) => void): void;
  /** The change is done: one history step with this name. */
  keep(label: string): void;
  draw(): void;
  refreshTray(): void;
  overlay(): void;
  say(words: string): void;
  tool(): Tool;
  setTool(t: Tool): void;
  /** The selected mask (a mask's or the layer's) and how a finger works on the stage. */
  sel: { mask: string; brush: boolean; erase: boolean; size: number; healSel: number; healSize: number; showMask: boolean; layerMask: boolean };
  /** The geometry the drawn picture has now (crop mode draws the whole frame). */
  geo(): ReturnType<typeof geoOf>;
  /** A point of the picture as it is drawn (0..1 across and down) to the original's frame. */
  screenToSrc(u: number, v: number): { x: number; y: number };
  snapshot(maxSide: number): Promise<HTMLCanvasElement>;
  layerCanvas: HTMLCanvasElement | null;
  setLayer(c: HTMLCanvasElement | null): void;
  proxy(): Src;
  photoId(): string;
  /** Rendering a small picture of the whole recipe (a look's thumbnail), as a canvas. */
  thumb(r: Recipe, w: number): HTMLCanvasElement;
  maskOf(): Mask | null;
  holdOriginal(on: boolean): void;
  cropFrame(): { w: number; h: number };
  /** ERASE (BRIEF-EDITOR-PHOTO-2): how much of the picture the hole covers (0..1), whether the model is running, the run, and the hole's own helpers. */
  holeCoverage(): number;
  erasing(): boolean;
  erase(): Promise<void>;
  useSubjectAsHole(m: Mask): void;
  clearHole(): void;
}

export interface PhotoEditor {
  el: HTMLElement;
  load(id: string, startTool?: Tool): Promise<void>;
  unload(): void;
  isOpen(): boolean;
  /** The Lens's or the chat's wish: the tool he is to land on. */
  tool(t: Tool): void;
}

const DPR = () => Math.min(2, window.devicePixelRatio || 1);
const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
const SVG = 'http://www.w3.org/2000/svg';
const svgEl = <K extends keyof SVGElementTagNameMap>(tag: K, a: Record<string, string | number> = {}): SVGElementTagNameMap[K] => {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(a)) e.setAttribute(k, String(v));
  return e;
};
const HOLD_SAID = 'ghosty.photo.holdsaid';
/** The photos a RAW was said for on this visit (said once). */
const rawSaid = new Set<string>();

export function photoEditor(onShelf: () => void): PhotoEditor {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  /** (the page's own handle for specs may come after this screen is built: it is put there again whenever a photo opens) */
  const expose = () => {
    if (w.__ghosty) w.__ghosty.photoedit = peState;
  };
  expose();

  // ---------------------------------------------------------------- the frame
  const glCanvas = h('canvas.pecanvas', { 'aria-label': 'The photo' });
  const cpuCanvas = h('canvas.pecanvas.pecpu', { 'aria-label': 'The photo' });
  cpuCanvas.hidden = true;
  const red = h('canvas.pered', { 'aria-hidden': 'true' });
  red.hidden = true;
  const over = svgEl('svg', { class: 'peover' });
  const hint = h('p.g-truth.pehint', { 'aria-live': 'polite', hidden: true });
  const slow = h('p.g-truth.peslow', { role: 'status', hidden: true });
  const busy = h('p.g-truth.pebusy', { role: 'status', 'aria-live': 'polite', hidden: true });
  const beforeTag = h('span.pebefore', { hidden: true, 'aria-hidden': 'true' }, 'ORIGINAL');
  const stage = h('div.pestage', glCanvas, cpuCanvas, red, over, beforeTag, hint, slow, busy);
  const saved = h('span.g-truth.pesaved', { 'aria-live': 'polite' });
  const title = h('b.petitle', 'Photo');
  const back = button('‹ PHOTOS', () => {
    flush();
    onShelf();
  }, 'peback');
  back.setAttribute('aria-label', 'Back to my photos');
  const head = h('header.pehead', back, h('div.pename', title, saved));
  const undoB = button('UNDO', () => undo(), 'peact');
  const redoB = button('REDO', () => redo(), 'peact');
  const histB = button('HISTORY', () => showHistory(), 'peact');
  const exportB = button('EXPORT', () => exportNow(), 'peact.on');
  const acts = h('div.peacts', { role: 'toolbar', 'aria-label': 'Undo, redo, history and export' }, undoB, redoB, histB, exportB);
  const tray = h('div.petray', { role: 'region', 'aria-label': 'Tool' });
  const pills = h('nav.pepills', { role: 'tablist', 'aria-label': 'Tools' });
  const pillBtns = new Map<Tool, HTMLButtonElement>();
  for (const [id, label] of TOOLS) {
    const b = button(label, () => setTool(id), 'pepill');
    b.setAttribute('role', 'tab');
    b.dataset.tool = id;
    pillBtns.set(id, b);
    pills.append(b);
  }
  const el = h('div.pe', { dataset: { view: 'edit' } }, head, stage, acts, tray, pills);
  el.hidden = true;

  // ---------------------------------------------------------------- the state
  let gl: PhotoGL | null = null;
  let useGl = false;
  let orig: HTMLCanvasElement | null = null;
  /** The photo as it was opened, untouched; `orig` is this with the erase model's patches laid over it (the same canvas when there are none). */
  let base: HTMLCanvasElement | null = null;
  let appliedKey = '';
  /** The part painted to be erased: a brush picture of its own, never in the recipe. */
  const holeMask: Mask = newMask('brush', 0);
  let holeKeep: Alpha | null = null;
  let erasingNow = false;
  let layerCanvas: HTMLCanvasElement | null = null;
  let srcSize = { w: 1, h: 1 };
  let recipe: Recipe = newRecipe();
  let hist = new RecipeHistory(recipe);
  let id = '';
  let tool: Tool = 'light';
  let view = { zoom: 1, cx: 0.5, cy: 0.5 };
  let holding = false;
  let dirty = false;
  let raf = 0;
  let saveTimer = 0;
  let savedOnce = false;
  let cpuProxy: { src: Src; scale: number } | null = null;
  let cpuFull: Src | null = null;
  let layerSrc: Src | null = null;
  let map = { drawW: 1, drawH: 1, rx: 0, ry: 0, rw: 1, rh: 1, dpr: 1, left: 0, top: 0 };
  let slowTimer = 0;
  let generation = 0;

  const sel: Ed['sel'] = { mask: '', brush: false, erase: false, size: 0.04, healSel: -1, healSize: 0.02, showMask: false, layerMask: false };

  const geomRecipe = (): Recipe => {
    if (holding) return { ...newRecipe(), crop: recipe.crop, persp: recipe.persp, lens: recipe.lens };
    if (tool === 'crop') return { ...recipe, crop: { ...recipe.crop, x: 0, y: 0, w: 1, h: 1 } };
    return recipe;
  };
  const geo = () => geoOf(geomRecipe(), srcSize.w, srcSize.h);

  function slowSrc(): Src {
    if (!cpuProxy) {
      const L = Math.max(srcSize.w, srcSize.h);
      if (L <= 2400) {
        cpuFull ??= srcOf(orig!);
        cpuProxy = { src: cpuFull, scale: 1 };
      } else {
        const k = 1600 / L;
        const c = document.createElement('canvas');
        c.width = Math.round(srcSize.w * k);
        c.height = Math.round(srcSize.h * k);
        c.getContext('2d', { willReadFrequently: true })!.drawImage(orig!, 0, 0, c.width, c.height);
        cpuProxy = { src: srcOf(c), scale: k };
      }
    }
    return cpuProxy.src;
  }
  const fullSrc = (): Src => (cpuFull ??= srcOf(orig!));
  const layerData = (): Src | null => (layerCanvas ? (layerSrc ??= srcOf(layerCanvas)) : null);

  // ---------------------------------------------------------------- drawing
  function draw(): void {
    dirty = true;
    peState.pending = true;
    if (!raf) raf = requestAnimationFrame(render);
  }
  function render(): void {
    raf = 0;
    if (!dirty || !orig || el.hidden) {
      peState.pending = false;
      return;
    }
    dirty = false;
    const rec = geomRecipe();
    const out = outputSize(rec, srcSize.w, srcSize.h);
    const fullW = outputSize(recipe, srcSize.w, srcSize.h).w;
    const sw = Math.max(40, stage.clientWidth);
    const sh = Math.max(40, stage.clientHeight);
    const dpr = useGl ? DPR() : 1;
    const fit = Math.min(sw / out.w, sh / out.h);
    const drawW = Math.max(2, Math.round(out.w * fit * dpr * view.zoom));
    const drawH = Math.max(2, Math.round(out.h * fit * dpr * view.zoom));
    const rw = Math.min(drawW, Math.round(sw * dpr));
    const rh = Math.min(drawH, Math.round(sh * dpr));
    const rx = clamp(Math.round(view.cx * drawW - rw / 2), 0, drawW - rw);
    const ry = clamp(Math.round(view.cy * drawH - rh / 2), 0, drawH - rh);
    view.cx = (rx + rw / 2) / drawW;
    view.cy = (ry + rh / 2) / drawH;
    const t0 = performance.now();
    const v: View = { outW: drawW, outH: drawH, region: { x: rx, y: ry, w: rw, h: rh }, fullW };
    const target = useGl ? glCanvas : cpuCanvas;
    try {
      if (useGl && gl && !gl.lost) {
        gl.renderToCanvas(rec, v);
        gl.gl.finish();
        const ms = performance.now() - t0;
        peState.frameMs = peState.frameMs ? Math.round((peState.frameMs * 0.7 + ms * 0.3) * 10) / 10 : Math.round(ms * 10) / 10;
      } else {
        // the slow way: at the screen's own pixels, from a picture no larger than 1,600 px when the original is large
        const px = slowSrc();
        const k = cpuProxy!.scale;
        void k;
        const data = renderCpu({ src: px, recipe: rec, layer: layerData(), outW: drawW, outH: drawH, fullW, region: { x: rx, y: ry, w: rw, h: rh } });
        cpuCanvas.width = rw;
        cpuCanvas.height = rh;
        cpuCanvas.getContext('2d')!.putImageData(new ImageData(data as unknown as Uint8ClampedArray<ArrayBuffer>, rw, rh), 0, 0);
        peState.frameMs = Math.round(performance.now() - t0);
      }
    } catch (e) {
      say(sayError(e, 'draw this'));
      return;
    }
    peState.draws++;
    peState.pending = dirty;
    const left = Math.max(0, (sw - rw / dpr) / 2);
    const top = Math.max(0, (sh - rh / dpr) / 2);
    for (const c of [glCanvas, cpuCanvas, red, over as unknown as HTMLElement]) {
      c.style.left = `${left}px`;
      c.style.top = `${top}px`;
      c.style.width = `${rw / dpr}px`;
      c.style.height = `${rh / dpr}px`;
    }
    over.setAttribute('viewBox', `0 0 ${rw / dpr} ${rh / dpr}`);
    map = { drawW, drawH, rx, ry, rw, rh, dpr, left, top };
    target.hidden = false;
    (useGl ? cpuCanvas : glCanvas).hidden = true;
    peState.drawn = { w: drawW, h: drawH };
    peState.zoom = Math.round(view.zoom * 100) / 100;
    overlayNow();
  }

  const uvToCss = (u: number, vv: number) => ({ x: (u * map.drawW - map.rx) / map.dpr, y: (vv * map.drawH - map.ry) / map.dpr });
  const cssToUv = (clientX: number, clientY: number) => {
    const r = (useGl ? glCanvas : cpuCanvas).getBoundingClientRect();
    return { u: ((clientX - r.left) * map.dpr + map.rx) / map.drawW, v: ((clientY - r.top) * map.dpr + map.ry) / map.drawH };
  };
  /** A point of the drawn picture to the original's frame, and back. */
  const toSrc = (u: number, vv: number) => mapOut(u, vv, geo());
  const toUv = (p: { x: number; y: number }) => mapIn(p, geo());

  // ---------------------------------------------------------------- the editing helpers
  function live(fn: (r: Recipe) => void): void {
    fn(recipe);
    draw();
  }
  function keep(label: string): void {
    if (hist.push(label, recipe)) {
      syncHistoryUi();
      scheduleSave();
    }
  }
  function syncHistoryUi(): void {
    undoB.disabled = !hist.canUndo;
    redoB.disabled = !hist.canRedo;
    peState.canUndo = hist.canUndo;
    peState.canRedo = hist.canRedo;
    peState.steps = hist.steps.length;
    peState.at = hist.at;
  }
  function restore(r: Recipe | null, words: string): void {
    if (!r) return;
    recipe = r;
    syncLayer();
    syncPatches();
    refreshTray();
    syncHistoryUi();
    draw();
    scheduleSave();
    say(words);
  }
  function undo(): void {
    const label = hist.steps[hist.at]?.label ?? '';
    restore(hist.undo(), label && label !== 'Opened' ? `Undone: ${label}.` : 'Undone.');
  }
  function redo(): void {
    restore(hist.redo(), `Done again: ${hist.steps[hist.at]?.label ?? ''}.`);
  }
  function say(words: string): void {
    peState.status = words;
    busy.textContent = words;
    busy.hidden = !words;
    clearTimeout(sayTimer);
    if (words) sayTimer = window.setTimeout(() => ((busy.hidden = true), (busy.textContent = '')), 4200);
  }
  let sayTimer = 0;

  // ---------------------------------------------------------------- the layer
  // ---------------------------------------------------------------- the erase model's fills (BRIEF-EDITOR-PHOTO-2)
  /** The working picture is the original with the recipe's patches laid over it: made again when the patches change (an erase, an undo, a redo). */
  function syncPatches(): void {
    const key = patchKey(recipe.patches);
    if (key === appliedKey || !base) return;
    appliedKey = key;
    rebuildSource();
  }
  function rebuildSource(): void {
    if (!base) return;
    orig = applyPatches(base, recipe.patches);
    cpuProxy = null;
    cpuFull = null;
    proxyCache = null;
    if (gl && useGl) {
      const info = gl.setSource(holding ? base : orig);
      peState.scaled = info.scaled;
    }
  }
  const holeAlpha = (): Alpha | null => (holeMask.alpha ? getAlpha(holeMask.alpha) : null);
  function keepHole(): void {
    const a = holeAlpha();
    holeKeep = a ? { w: a.w, h: a.h, data: a.data.slice() } : null;
  }
  function useSubjectAsHole(m: Mask): void {
    const a = m.alpha ? getAlpha(m.alpha) : null;
    if (!a) return;
    holeMask.alpha = putAlpha({ w: a.w, h: a.h, data: a.data.slice() });
    keepHole();
    sel.showMask = true;
    sel.brush = true;
    overlayNow();
    refreshTray();
    draw();
  }
  function clearHole(): void {
    holeMask.alpha = '';
    holeKeep = null;
    overlayNow();
    refreshTray();
    draw();
  }
  /** A wait that stays until it is over (say() lets go of its words after a few seconds; a long wait must not). */
  function waitLine(words: string): void {
    clearTimeout(sayTimer);
    peState.status = words;
    busy.textContent = words;
    busy.hidden = !words;
  }
  async function erase(): Promise<void> {
    if (erasingNow || !orig || !base) return;
    const hole = holeAlpha();
    if (!hole || coverage(hole) <= 0) return say('Paint over what to take away first.');
    if ((recipe.patches?.length ?? 0) >= 12) return say('That is as many erases as I keep on one photo: twelve. Export it and start again from the result.');
    erasingNow = true;
    peState.erasing = true;
    peState.eraseFail = '';
    refreshTray();
    try {
      const { eraseHole, erasePlanWords } = await import('../../photo/inpaint');
      const plan = erasePlanWords(hole, srcSize.w, srcSize.h);
      waitLine(plan?.line ?? 'Erasing…');
      // (the model's opening says its step after the estimate, so "Erasing… about N s" stays up from the tap: the opening is
      // said in the same task as the plan line, which would otherwise never be drawn)
      const res = await eraseHole(orig, hole, (w) => waitLine(w.startsWith('Erasing') ? `${w}${plan ? ` · about ${plan.seconds} s` : ''}` : plan ? `${plan.line} · ${w}` : w.charAt(0).toUpperCase() + w.slice(1)));
      live((r) => {
        (r.patches ??= []).push(res.patch);
      });
      keep('Erased on this phone');
      syncPatches();
      holeMask.alpha = '';
      holeKeep = null;
      peState.erasedBy = 'phone';
      peState.eraseMs = Math.round(res.ms);
      peState.erases++;
      say(`Erased on this phone in ${(res.ms / 1000).toFixed(1)} s. UNDO takes it back.`);
    } catch (e) {
      // never a silent fallback: its line, and what is still there to use
      const why = sayError(e, 'run the erase model');
      peState.eraseFail = why;
      say(`${why} Nothing changed. BRAIN ERASE is the other way, and it asks for your tap.`);
    } finally {
      erasingNow = false;
      peState.erasing = false;
      refreshTray();
      overlayNow();
      draw();
    }
  }

  function syncLayer(): void {
    // the layer picture follows the recipe (an undo may have taken it away)
    if (!recipe.layer && layerCanvas) {
      layerCanvas = null;
      layerSrc = null;
      gl?.setLayer(null);
    }
  }
  function setLayer(c: HTMLCanvasElement | null): void {
    layerCanvas = c;
    layerSrc = null;
    gl?.setLayer(c);
  }

  // ---------------------------------------------------------------- the original: while the finger is held
  function holdOriginal(on: boolean): void {
    if (holding === on) return;
    holding = on;
    // with erase fills in the picture the original is the one without them
    if (gl && useGl && base && orig && base !== orig) gl.setSource(on ? base : orig);
    peState.held = on;
    beforeTag.hidden = !on;
    el.classList.toggle('held', on);
    draw();
  }

  // ---------------------------------------------------------------- overlays: the handles, the crop, the red mask
  function overlayNow(): void {
    clear(over);
    red.hidden = true;
    const m = currentMask();
    if (sel.showMask && m && tool !== 'crop') paintRed(m);
    if (holding) return;
    if (tool === 'crop') cropOverlay();
    else if ((tool === 'masks' || tool === 'layer') && m && !sel.brush && (m.kind === 'linear' || m.kind === 'radial')) maskHandles(m);
    else if (tool === 'heal') healHandles();
  }
  const handle = (x: number, y: number, label: string, on: (e: PointerEvent) => void, done: () => void, cls = ''): SVGGElement => {
    const g = svgEl('g', { class: `pehandle ${cls}`, tabindex: '0', role: 'slider', 'aria-label': label });
    g.append(svgEl('circle', { cx: x, cy: y, r: 22, class: 'hit' }), svgEl('circle', { cx: x, cy: y, r: 9, class: 'dot' }));
    g.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      try {
        g.setPointerCapture(e.pointerId);
      } catch {
        /* a pointer the phone no longer has */
      }
      g.classList.add('drag');
      const mv = (ev: PointerEvent) => on(ev);
      const up = () => {
        g.classList.remove('drag');
        g.removeEventListener('pointermove', mv);
        g.removeEventListener('pointerup', up);
        g.removeEventListener('pointercancel', up);
        done();
      };
      g.addEventListener('pointermove', mv);
      g.addEventListener('pointerup', up);
      g.addEventListener('pointercancel', up);
    });
    over.append(g);
    return g;
  };
  const line = (a: { x: number; y: number }, b: { x: number; y: number }, cls = 'pel') => over.append(svgEl('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: cls }));

  function currentMask(): Mask | null {
    if (tool === 'erase') return holeMask;
    if (tool === 'layer') return recipe.layer?.mask ?? null;
    return recipe.masks.find((m) => m.id === sel.mask) ?? null;
  }
  const maskPx = (e: PointerEvent) => {
    const { u, v } = cssToUv(e.clientX, e.clientY);
    return toSrc(clamp(u, 0, 1), clamp(v, 0, 1));
  };
  function maskHandles(m: Mask): void {
    if (m.kind === 'linear') {
      const a = uvToCss(...(Object.values(toUv(m.a)) as [number, number]));
      const b = uvToCss(...(Object.values(toUv(m.b)) as [number, number]));
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const L = Math.hypot(dx, dy) || 1;
      const nx = (-dy / L) * 400;
      const ny = (dx / L) * 400;
      line({ x: a.x - nx, y: a.y - ny }, { x: a.x + nx, y: a.y + ny }, 'pel full');
      line({ x: b.x - nx, y: b.y - ny }, { x: b.x + nx, y: b.y + ny }, 'pel gone');
      line(a, b, 'pel');
      handle(a.x, a.y, 'Where the mask is strongest', (e) => ((m.a = maskPx(e)), draw()), () => keep('Mask moved'), 'full');
      handle(b.x, b.y, 'Where the mask is gone', (e) => ((m.b = maskPx(e)), draw()), () => keep('Mask moved'), 'gone');
    } else if (m.kind === 'radial') {
      const uv = toUv(m.c);
      const c = uvToCss(uv.x, uv.y);
      // the radius, as drawn: a point on the circle's right (before the turn) mapped to the screen
      const L = Math.max(srcSize.w, srcSize.h);
      const ang = (m.angle * Math.PI) / 180;
      const ex = m.c.x + (Math.cos(ang) * m.rx * L) / srcSize.w;
      const ey = m.c.y + (Math.sin(ang) * m.rx * L) / srcSize.h;
      const e = uvToCss(...(Object.values(toUv({ x: ex, y: ey })) as [number, number]));
      const rpx = Math.hypot(e.x - c.x, e.y - c.y);
      const ell = svgEl('ellipse', { cx: c.x, cy: c.y, rx: rpx, ry: rpx * (m.ry / m.rx), class: 'pel ring', transform: `rotate(${Math.atan2(e.y - c.y, e.x - c.x) * (180 / Math.PI)} ${c.x} ${c.y})` });
      over.append(ell);
      handle(c.x, c.y, 'Move the circle', (ev) => ((m.c = maskPx(ev)), draw()), () => keep('Mask moved'), 'full');
      handle(e.x, e.y, 'Make the circle bigger or smaller', (ev) => {
        const p = maskPx(ev);
        const nr = Math.hypot((p.x - m.c.x) * srcSize.w, (p.y - m.c.y) * srcSize.h) / L;
        const k = m.ry / m.rx;
        m.rx = clamp(nr, 0.02, 1.2);
        m.ry = m.rx * k;
        m.angle = (Math.atan2((p.y - m.c.y) * srcSize.h, (p.x - m.c.x) * srcSize.w) * 180) / Math.PI;
        draw();
      }, () => keep('Circle resized'), 'gone');
    }
  }
  function healHandles(): void {
    recipe.heals.forEach((hl, i) => {
      const c = uvToCss(...(Object.values(toUv({ x: hl.x, y: hl.y })) as [number, number]));
      const s = uvToCss(...(Object.values(toUv({ x: hl.x + hl.dx, y: hl.y + hl.dy })) as [number, number]));
      const L = Math.max(srcSize.w, srcSize.h);
      const edge = uvToCss(...(Object.values(toUv({ x: hl.x + (hl.r * L) / srcSize.w, y: hl.y })) as [number, number]));
      const rpx = Math.max(8, Math.hypot(edge.x - c.x, edge.y - c.y));
      const on = i === sel.healSel;
      over.append(svgEl('circle', { cx: c.x, cy: c.y, r: rpx, class: `pel ring${on ? ' on' : ''}` }), svgEl('circle', { cx: s.x, cy: s.y, r: rpx, class: `pel ring src${on ? ' on' : ''}` }));
      line(c, s, `pel src${on ? ' on' : ''}`);
      if (on) {
        handle(s.x, s.y, 'Move where the clean part is taken from', (e) => {
          const p = maskPx(e);
          hl.dx = p.x - hl.x;
          hl.dy = p.y - hl.y;
          draw();
        }, () => keep('Heal source moved'), 'full');
      } else {
        const g = svgEl('g', { class: 'pehandle', tabindex: '0', role: 'button', 'aria-label': `Pick heal ${i + 1}` });
        g.append(svgEl('circle', { cx: c.x, cy: c.y, r: 22, class: 'hit' }), svgEl('circle', { cx: c.x, cy: c.y, r: 5, class: 'dot' }));
        g.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          e.preventDefault();
          sel.healSel = i;
          sel.healSize = hl.r;
          refreshTray();
          overlayNow();
        });
        over.append(g);
      }
    });
  }
  function paintRed(m: Mask): void {
    const k = 3;
    const cw = Math.max(2, Math.ceil(map.rw / map.dpr / k));
    const ch = Math.max(2, Math.ceil(map.rh / map.dpr / k));
    red.width = cw;
    red.height = ch;
    const g = red.getContext('2d')!;
    const id = g.createImageData(cw, ch);
    const gg = geo();
    for (let y = 0; y < ch; y++)
      for (let x = 0; x < cw; x++) {
        const px = (x + 0.5) * k * map.dpr + map.rx;
        const py = (y + 0.5) * k * map.dpr + map.ry;
        const p = mapOut(px / map.drawW, py / map.drawH, gg);
        const v = maskAt(m, p.x, p.y, srcSize.w, srcSize.h);
        const i = (y * cw + x) * 4;
        id.data[i] = 255;
        id.data[i + 1] = 40;
        id.data[i + 2] = 50;
        id.data[i + 3] = Math.round(clamp(v, 0, 1) * 150);
      }
    g.putImageData(id, 0, 0);
    red.hidden = false;
  }

  // the crop: the rectangle with its handles, the straighten grid
  const cropFrame = () => frameSize(srcSize.w, srcSize.h, recipe.crop.quarter);
  const rectValid = (x: number, y: number, ww: number, hh: number): boolean => {
    if (ww < 0.04 || hh < 0.04 || x < -1e-6 || y < -1e-6 || x + ww > 1 + 1e-6 || y + hh > 1 + 1e-6) return false;
    const f = cropFrame();
    const a = (recipe.crop.angle * Math.PI) / 180;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    for (const [cx, cy] of [[x, y], [x + ww, y], [x, y + hh], [x + ww, y + hh]] as [number, number][]) {
      const px = (cx - 0.5) * f.w;
      const py = (cy - 0.5) * f.h;
      const rx = px * ca - py * sa;
      const ry = px * sa + py * ca;
      if (Math.abs(rx) > f.w / 2 + 0.5 || Math.abs(ry) > f.h / 2 + 0.5) return false;
    }
    return true;
  };
  function cropOverlay(): void {
    const c = recipe.crop;
    const p0 = uvToCss(c.x, c.y);
    const p1 = uvToCss(c.x + c.w, c.y + c.h);
    const W = map.rw / map.dpr;
    const H = map.rh / map.dpr;
    // the dimmed outside
    over.append(svgEl('path', { class: 'pedim', 'fill-rule': 'evenodd', d: `M0 0H${W}V${H}H0Z M${p0.x} ${p0.y}H${p1.x}V${p1.y}H${p0.x}Z` }));
    over.append(svgEl('rect', { x: p0.x, y: p0.y, width: p1.x - p0.x, height: p1.y - p0.y, class: 'pecrop' }));
    for (let i = 1; i < 3; i++) {
      line({ x: p0.x + ((p1.x - p0.x) * i) / 3, y: p0.y }, { x: p0.x + ((p1.x - p0.x) * i) / 3, y: p1.y }, 'pel thirds');
      line({ x: p0.x, y: p0.y + ((p1.y - p0.y) * i) / 3 }, { x: p1.x, y: p0.y + ((p1.y - p0.y) * i) / 3 }, 'pel thirds');
    }
    if (cropGrid) for (let i = 1; i < 12; i++) {
      line({ x: p0.x + ((p1.x - p0.x) * i) / 12, y: p0.y }, { x: p0.x + ((p1.x - p0.x) * i) / 12, y: p1.y }, 'pel level');
      line({ x: p0.x, y: p0.y + ((p1.y - p0.y) * i) / 12 }, { x: p1.x, y: p0.y + ((p1.y - p0.y) * i) / 12 }, 'pel level');
    }
    // a move area, then four corners
    const body = svgEl('rect', { x: p0.x + 14, y: p0.y + 14, width: Math.max(0, p1.x - p0.x - 28), height: Math.max(0, p1.y - p0.y - 28), class: 'pecropmove', 'aria-label': 'Move the crop' });
    over.append(body);
    let start: { x: number; y: number; c: typeof c } | null = null;
    body.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      try {
        body.setPointerCapture(e.pointerId);
      } catch {
        /* a pointer the phone no longer has */
      }
      start = { x: e.clientX, y: e.clientY, c: { ...c } };
    });
    body.addEventListener('pointermove', (e) => {
      if (!start) return;
      const f = (useGl ? glCanvas : cpuCanvas).getBoundingClientRect();
      const nx = clamp(start.c.x + (e.clientX - start.x) / f.width, 0, 1 - c.w);
      const ny = clamp(start.c.y + (e.clientY - start.y) / f.height, 0, 1 - c.h);
      if (rectValid(nx, ny, c.w, c.h)) {
        c.x = nx;
        c.y = ny;
        draw();
      }
    });
    const end = () => {
      if (start) keep('Crop moved');
      start = null;
    };
    body.addEventListener('pointerup', end);
    body.addEventListener('pointercancel', end);
    const corners: [string, number, number, number, number][] = [['top left', p0.x, p0.y, -1, -1], ['top right', p1.x, p0.y, 1, -1], ['bottom left', p0.x, p1.y, -1, 1], ['bottom right', p1.x, p1.y, 1, 1]];
    for (const [name, x, y, sx, sy] of corners) {
      handle(x, y, `Crop: drag the ${name} corner`, (e) => {
        const f = (useGl ? glCanvas : cpuCanvas).getBoundingClientRect();
        const u = clamp((e.clientX - f.left) / f.width, 0, 1);
        const v = clamp((e.clientY - f.top) / f.height, 0, 1);
        // the opposite corner stays; the dragged one follows the finger (and the ratio, when one is held)
        const ox = sx < 0 ? c.x + c.w : c.x;
        const oy = sy < 0 ? c.y + c.h : c.y;
        let nw = Math.abs(u - ox);
        let nh = Math.abs(v - oy);
        const fr = cropFrame();
        const R = ratioNow();
        if (R > 0) {
          nh = (nw * fr.w) / R / fr.h;
          if (oy + sy * nh < 0 || oy + sy * nh > 1) nh = sy < 0 ? oy : 1 - oy;
          nw = (nh * fr.h * R) / fr.w;
        }
        const nx = sx < 0 ? ox - nw : ox;
        const ny = sy < 0 ? oy - nh : oy;
        if (rectValid(nx, ny, nw, nh)) {
          c.x = nx;
          c.y = ny;
          c.w = nw;
          c.h = nh;
          draw();
        }
      }, () => keep('Crop changed'), 'corner');
    }
  }
  let cropGrid = false;
  const ratioNow = (): number => {
    const m = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(recipe.crop.ratio);
    return m ? Number(m[1]) / Number(m[2]) : 0;
  };

  // ---------------------------------------------------------------- the stage's fingers
  const pointers = new Map<number, { x: number; y: number; sx: number; sy: number; t: number }>();
  let pinch: { d: number; zoom: number; mx: number; my: number; cx: number; cy: number } | null = null;
  let holdTimer = 0;
  let moved = false;
  let painting: { id: string; last: { x: number; y: number }; work: ReturnType<typeof blankAlpha>; mask: Mask } | null = null;
  let lastTap = 0;
  let lastTapAt = { x: 0, y: 0 };

  stage.addEventListener('pointerdown', (e) => {
    if (!orig) return;
    try {
      stage.setPointerCapture(e.pointerId);
    } catch {
      /* a pointer the phone no longer has */
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: e.timeStamp });
    clearTimeout(holdTimer);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()] as unknown as [{ x: number; y: number }, { x: number; y: number }];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: view.zoom, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, cx: view.cx, cy: view.cy };
      holdOriginal(false);
      abortPaint();
      return;
    }
    moved = false;
    holdTimer = window.setTimeout(() => {
      if (!moved && pointers.size === 1 && !painting) {
        holdOriginal(true);
        sayHoldOnce();
      }
    }, 300);
  });
  stage.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX;
    p.y = e.clientY;
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()] as unknown as [{ x: number; y: number }, { x: number; y: number }];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      view.zoom = clamp(pinch.zoom * (d / pinch.d), 1, 8);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const drawW = map.drawW * (view.zoom / (peState.zoom || 1));
      const drawH = map.drawH * (view.zoom / (peState.zoom || 1));
      view.cx = view.zoom === 1 ? 0.5 : pinch.cx - ((mx - pinch.mx) * map.dpr) / drawW;
      view.cy = view.zoom === 1 ? 0.5 : pinch.cy - ((my - pinch.my) * map.dpr) / drawH;
      draw();
      return;
    }
    if (pointers.size !== 1) return;
    if (!moved && Math.hypot(p.x - p.sx, p.y - p.sy) > 8) {
      moved = true;
      clearTimeout(holdTimer);
      if (holding) holdOriginal(false);
    }
    if (moved && paintingActive()) paintMove(e);
  });
  const lift = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    clearTimeout(holdTimer);
    if (pointers.size < 2) pinch = null;
    if (!p) return;
    if (holding) {
      holdOriginal(false);
      return;
    }
    if (painting) return void endPaint();
    if (!moved && pointers.size === 0 && e.timeStamp - p.t < 300 && e.type === 'pointerup') {
      // a tap: a dab of the brush, a heal, or (twice, quickly) the zoom
      // (a second tap close by, in a tool where a tap does nothing else, zooms; a heal or a dab is never taken for it)
      const plainTool = tool !== 'heal' && !paintingActive();
      if (plainTool && e.timeStamp - lastTap < 320 && Math.hypot(e.clientX - lastTapAt.x, e.clientY - lastTapAt.y) < 40) {
        lastTap = 0;
        view = view.zoom > 1.2 ? { zoom: 1, cx: 0.5, cy: 0.5 } : { ...view, zoom: 2.5 };
        draw();
        return;
      }
      lastTap = e.timeStamp;
      lastTapAt = { x: e.clientX, y: e.clientY };
      if (paintingActive()) {
        paintStart(e);
        endPaint();
      } else if (tool === 'heal') healAt(e);
    }
  };
  stage.addEventListener('pointerup', lift);
  stage.addEventListener('pointercancel', lift);
  stage.addEventListener('contextmenu', (e) => e.preventDefault());

  function sayHoldOnce(): void {
    let said = false;
    try {
      said = localStorage.getItem(HOLD_SAID) === '1';
    } catch {
      said = false;
    }
    if (said) return;
    try {
      localStorage.setItem(HOLD_SAID, '1');
    } catch {
      /* said again next time */
    }
  }
  function sayHoldIntro(): void {
    let said = false;
    try {
      said = localStorage.getItem(HOLD_SAID) === '1';
    } catch {
      said = false;
    }
    if (said) return;
    hint.textContent = 'Hold the photo to see the original';
    peState.holdHint = hint.textContent;
    hint.hidden = false;
    try {
      localStorage.setItem(HOLD_SAID, '1');
    } catch {
      /* said again next time */
    }
    window.setTimeout(() => (hint.hidden = true), 5200);
  }

  // ---------------------------------------------------------------- the brush
  const paintingActive = (): boolean => (tool === 'masks' || tool === 'layer' || tool === 'erase') && sel.brush && !!currentMask() && ['brush', 'subject'].includes(currentMask()!.kind) && !holding;
  function paintStart(e: PointerEvent): void {
    const m = currentMask();
    if (!m) return;
    const sz = alphaSizeFor(srcSize.w, srcSize.h);
    const base = m.alpha ? getAlpha(m.alpha) : null;
    const work = base ? { w: base.w, h: base.h, data: base.data.slice() } : blankAlpha(sz.w, sz.h);
    const tmp = putAlpha(work);
    m.alpha = tmp;
    const p = maskPx(e);
    painting = { id: tmp, last: p, work, mask: m };
    alphaStroke(work, p, p, sel.size, sel.erase, srcSize.w, srcSize.h, true);
    putAlpha(work, tmp);
    draw();
  }
  function paintMove(e: PointerEvent): void {
    if (!painting) {
      if (!paintingActive()) return;
      paintStart(e);
    }
    const p = maskPx(e);
    alphaStroke(painting!.work, painting!.last, p, sel.size, sel.erase, srcSize.w, srcSize.h, true);
    painting!.last = p;
    putAlpha(painting!.work, painting!.id);
    draw();
  }
  function endPaint(): void {
    if (!painting) return;
    const { work, mask } = painting;
    // the picture is kept under a name of its own, so UNDO has the one before
    mask.alpha = putAlpha({ w: work.w, h: work.h, data: work.data.slice() });
    if (mask === holeMask) keepHole();
    painting = null;
    keep(sel.erase ? 'Brush erased' : 'Brush painted');
    if (sel.showMask) overlayNow();
    refreshTray();
  }
  function abortPaint(): void {
    if (!painting) return;
    painting = null;
    draw();
  }

  // ---------------------------------------------------------------- the heals
  let proxyCache: Src | null = null;
  function proxy(): Src {
    if (!proxyCache) {
      const L = Math.max(srcSize.w, srcSize.h);
      const k = Math.min(1, 900 / L);
      const c = document.createElement('canvas');
      c.width = Math.max(2, Math.round(srcSize.w * k));
      c.height = Math.max(2, Math.round(srcSize.h * k));
      c.getContext('2d', { willReadFrequently: true })!.drawImage(orig!, 0, 0, c.width, c.height);
      proxyCache = srcOf(c);
    }
    return proxyCache;
  }
  function healAt(e: PointerEvent): void {
    if (recipe.heals.length >= 16) return say('That is as many heals as I keep on one photo: sixteen. Take one away, or export and start again from the result.');
    const { u, v } = cssToUv(e.clientX, e.clientY);
    if (u < 0 || u > 1 || v < 0 || v > 1) return;
    const p = toSrc(u, v);
    if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) return;
    const off = bestSource(p.x, p.y, sel.healSize);
    recipe.heals.push({ x: p.x, y: p.y, r: sel.healSize, dx: off.dx, dy: off.dy, feather: 0.5 });
    sel.healSel = recipe.heals.length - 1;
    keep('Healed a spot');
    refreshTray();
    draw();
  }
  /** The clean part nearest the blemish that looks most like its surroundings: eight directions at two distances, the ring round the spot against the ring round each. */
  function bestSource(x: number, y: number, r: number): { dx: number; dy: number } {
    const s = proxy();
    const L = Math.max(srcSize.w, srcSize.h);
    const at = (px: number, py: number): number[] => {
      const ix = clamp(Math.round(px * s.w - 0.5), 0, s.w - 1);
      const iy = clamp(Math.round(py * s.h - 0.5), 0, s.h - 1);
      const i = (iy * s.w + ix) * 4;
      return [s.data[i]!, s.data[i + 1]!, s.data[i + 2]!];
    };
    const ring: [number, number][] = [];
    for (let i = 0; i < 16; i++) ring.push([Math.cos((i / 16) * Math.PI * 2) * 1.35 * r * L / srcSize.w, Math.sin((i / 16) * Math.PI * 2) * 1.35 * r * L / srcSize.h]);
    let best = { dx: (3 * r * L) / srcSize.w, dy: 0, cost: Infinity };
    for (const dist of [2.8, 4.2]) {
      for (let a = 0; a < 8; a++) {
        const dx = (Math.cos((a / 8) * Math.PI * 2 + 0.3) * dist * r * L) / srcSize.w;
        const dy = (Math.sin((a / 8) * Math.PI * 2 + 0.3) * dist * r * L) / srcSize.h;
        const sx = x + dx;
        const sy = y + dy;
        if (sx < r || sx > 1 - r || sy < r || sy > 1 - r) continue;
        let cost = 0;
        for (const [rx, ry] of ring) {
          const a1 = at(x + rx, y + ry);
          const a2 = at(sx + rx, sy + ry);
          cost += Math.abs(a1[0]! - a2[0]!) + Math.abs(a1[1]! - a2[1]!) + Math.abs(a1[2]! - a2[2]!);
        }
        // a source that is itself very different from the middle of the spot's ring is a worse one
        if (cost < best.cost) best = { dx, dy, cost };
      }
    }
    return { dx: best.dx, dy: best.dy };
  }

  // ---------------------------------------------------------------- tools and trays
  function setTool(t: Tool): void {
    tool = t;
    peState.tool = t;
    peState.cropMode = t === 'crop';
    for (const [id2, b] of pillBtns) {
      b.classList.toggle('on', id2 === t);
      b.setAttribute('aria-selected', String(id2 === t));
    }
    if (t === 'erase') {
      sel.brush = true;
      sel.showMask = true;
      sel.erase = false;
    } else if (t !== 'masks' && t !== 'layer') {
      sel.brush = false;
      sel.showMask = false;
    }
    sel.layerMask = t === 'layer';
    cropGrid = false;
    if (id) rememberLast(id, t);
    refreshTray();
    draw();
    const b = pillBtns.get(t);
    b?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  }
  function refreshTray(): void {
    peState.mask = sel.mask;
    peState.showMask = sel.showMask;
    clear(tray, buildTray(tool, ed));
  }

  // ---------------------------------------------------------------- the save
  function scheduleSave(): void {
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => void save(), 200);
  }
  async function save(): Promise<void> {
    clearTimeout(saveTimer);
    if (!id || !orig) return;
    let thumb: Blob | null = null;
    try {
      const c = thumbOf(recipe, 360);
      thumb = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/jpeg', 0.8));
    } catch {
      thumb = null;
    }
    const ok = await saveRecipe(id, recipe, { thumb, tool });
    if (holeKeep && holeMask.alpha && !getAlpha(holeMask.alpha)) putAlpha(holeKeep, holeMask.alpha);
    peState.persistent = storeState.persistent;
    if (!ok) return;
    peState.saves++;
    if (!savedOnce) {
      savedOnce = true;
      // "Saved", once, fading in the truth style
      saved.textContent = storeState.persistent ? 'SAVED' : 'KEPT FOR THIS VISIT ONLY';
      peState.saved = saved.textContent;
      saved.classList.add('show');
      window.setTimeout(() => saved.classList.remove('show'), 2600);
    }
  }
  function flush(): void {
    if (saveTimer) void save();
  }

  function thumbOf(r: Recipe, wpx: number): HTMLCanvasElement {
    const size = outputSize(r, srcSize.w, srcSize.h);
    const k = wpx / Math.max(size.w, size.h);
    const tw = Math.max(2, Math.round(size.w * k));
    const th = Math.max(2, Math.round(size.h * k));
    const c = document.createElement('canvas');
    c.width = tw;
    c.height = th;
    const fullW = size.w;
    let data: Uint8ClampedArray;
    if (useGl && gl && !gl.lost) data = new Uint8ClampedArray(gl.renderPixels(r, { outW: tw, outH: th, region: { x: 0, y: 0, w: tw, h: th }, fullW }).buffer as ArrayBuffer);
    else data = renderCpu({ src: slowSrc(), recipe: r, layer: layerData(), outW: tw, outH: th, fullW });
    c.getContext('2d')!.putImageData(new ImageData(data as unknown as Uint8ClampedArray<ArrayBuffer>, tw, th), 0, 0);
    return c;
  }

  async function snapshot(maxSide: number): Promise<HTMLCanvasElement> {
    return thumbOf(recipe, maxSide);
  }

  // ---------------------------------------------------------------- history sheet, export
  function showHistory(): void {
    const list = h('ol.pehist', { 'aria-label': 'Steps' });
    hist.steps.forEach((s, i) => {
      const when = Math.max(0, Math.round((Date.now() - s.at) / 1000));
      const b = button(h('span', h('b', s.label), h('em', when < 60 ? 'just now' : `${Math.round(when / 60)} min ago`)), () => {
        m.close();
        restore(hist.jump(i), i === hist.at ? '' : `Back to: ${s.label}.`);
      }, 'pestep');
      b.classList.toggle('on', i === hist.at);
      b.setAttribute('aria-current', i === hist.at ? 'step' : 'false');
      list.append(h('li', b));
    });
    const m = modal('HISTORY', h('div.pehistbox', h('p.g-truth', `${hist.steps.length - 1} step${hist.steps.length === 2 ? '' : 's'} kept (sixty at most). Tap one to go back to it.`), list));
    list.querySelector<HTMLElement>('.on')?.scrollIntoView({ block: 'center' });
  }
  async function exportNow(): Promise<void> {
    if (!orig || !id) return;
    flush();
    const meta = await getMeta(id);
    const original = await getOriginal(id);
    if (!meta || !original) return say('I could not find the original any more.');
    openExport({
      name: meta.name,
      original,
      recipe: () => recipe,
      srcSize,
      run: (onTile: (done: number, of: number) => void) => exportCanvas(useGl && gl && !gl.lost ? gl : null, fullSrc, recipe, srcSize, layerData as () => Src, onTile),
      caps: gl ? { tile: gl.tile, maxTexture: gl.caps.maxTexture, frameMs: peState.frameMs, renderer: gl.caps.renderer, slow: !useGl } : { tile: 512, maxTexture: 0, frameMs: peState.frameMs, renderer: 'none', slow: true },
    });
  }

  // ---------------------------------------------------------------- GL, the slow way, lost
  function ensureGl(): void {
    if (gl || peState.gl === 'slow') return;
    gl = PhotoGL.make(glCanvas);
    if (!gl) {
      useSlow('This phone gave me no WebGL2 here.');
      return;
    }
    useGl = true;
    peState.gl = 'webgl2';
    peState.renderer = gl.caps.renderer;
    peState.maxTexture = gl.caps.maxTexture;
    peState.tile = gl.tile;
    peState.floatTargets = gl.caps.float;
    gl.onLost = () => {
      useSlow('The picture memory was taken back by the phone.');
      draw();
    };
    gl.onRestored = () => {
      if (!gl || !orig) return;
      useGl = true;
      peState.gl = 'webgl2';
      slow.hidden = true;
      peState.slowLine = '';
      gl.setSource(orig);
      gl.setLayer(layerCanvas);
      draw();
    };
  }
  function useSlow(why: string): void {
    useGl = false;
    peState.gl = 'slow';
    peState.slowLine = 'Drawing this the slow way…';
    slow.textContent = `Drawing this the slow way… ${why} A change takes a moment, and an export takes longer; it comes out the same.`;
    slow.hidden = false;
    void slowTimer;
  }

  // ---------------------------------------------------------------- the editor's own surface
  const ed: Ed = {
    get r() {
      return recipe;
    },
    srcSize: { w: 1, h: 1 },
    orig: null,
    get gl() {
      return gl;
    },
    live,
    keep,
    draw,
    refreshTray,
    overlay: overlayNow,
    say,
    tool: () => tool,
    setTool,
    sel,
    geo,
    screenToSrc: toSrc,
    snapshot,
    get layerCanvas() {
      return layerCanvas;
    },
    setLayer,
    proxy,
    photoId: () => id,
    thumb: thumbOf,
    maskOf: currentMask,
    holdOriginal,
    cropFrame,
    holeCoverage: () => {
      const a = holeAlpha();
      return a ? coverage(a) : 0;
    },
    erasing: () => erasingNow,
    erase,
    useSubjectAsHole,
    clearHole,
  };
  Object.defineProperty(ed, 'srcSize', { get: () => srcSize });
  Object.defineProperty(ed, 'orig', { get: () => orig });
  const setCropGrid = (on: boolean) => {
    cropGrid = on;
    overlayNow();
  };
  (ed as Ed & { cropGrid: (on: boolean) => void }).cropGrid = setCropGrid;
  (ed as Ed & { resetView: () => void }).resetView = () => {
    view = { zoom: 1, cx: 0.5, cy: 0.5 };
    draw();
  };

  peState.patches = () =>
    (recipe.patches ?? []).map((p) => {
      const pic = getPatch(p.id);
      let a = 0;
      const m = [0, 0, 0];
      if (pic) for (let i = 0; i < pic.w * pic.h; i++) {
        a += pic.data[i * 4 + 3]! / 255;
        for (let c = 0; c < 3; c++) m[c] = m[c]! + pic.data[i * 4 + c]! * (pic.data[i * 4 + 3]! / 255);
      }
      const n = Math.max(1e-6, a);
      return { x: p.x, y: p.y, w: p.w, h: p.h, pw: pic?.w ?? 0, ph: pic?.h ?? 0, opaque: pic ? Math.round((a / (pic.w * pic.h)) * 1000) / 1000 : 0, mean: m.map((v) => Math.round(v / n)) };
    });

  // spec hooks (documented in peState): where a point of the original is on the screen now, and the colour drawn there
  const shown = (): HTMLCanvasElement => (useGl ? glCanvas : cpuCanvas);
  peState.project = (fx, fy) => {
    const uv = toUv({ x: fx, y: fy });
    const c = uvToCss(uv.x, uv.y);
    const r = shown().getBoundingClientRect();
    return { x: r.left + c.x, y: r.top + c.y };
  };
  const readAt = (cx: number, cy: number): number[] | null => {
    const c = shown();
    const r = c.getBoundingClientRect();
    const t = document.createElement('canvas');
    t.width = c.width;
    t.height = c.height;
    const g = t.getContext('2d', { willReadFrequently: true });
    if (!g) return null;
    g.drawImage(c, 0, 0);
    const px = clamp(Math.round(((cx - r.left) / r.width) * c.width), 1, c.width - 2);
    const py = clamp(Math.round(((cy - r.top) / r.height) * c.height), 1, c.height - 2);
    const d = g.getImageData(px - 1, py - 1, 3, 3).data;
    const o = [0, 0, 0];
    for (let i = 0; i < 9; i++) for (let k = 0; k < 3; k++) o[k]! += d[i * 4 + k]! / 9;
    return o.map((v) => Math.round(v * 10) / 10);
  };
  peState.sample = (fx, fy) => {
    const p = peState.project!(fx, fy);
    return readAt(p.x, p.y);
  };
  peState.sampleAt = (u, v) => {
    const r = shown().getBoundingClientRect();
    return readAt(r.left + u * r.width, r.top + v * r.height);
  };

  peState.recipe = () => cloneRecipe(recipe);
  peState.compare64 = () => {
    const g = PhotoGL.make(document.createElement('canvas'));
    if (!g) return { error: 'no WebGL2 here' };
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const x = c.getContext('2d')!;
    const img = x.createImageData(64, 64);
    for (let j = 0; j < 64; j++)
      for (let i = 0; i < 64; i++) {
        const k = (j * 64 + i) * 4;
        img.data[k] = 255 * (i / 63);
        img.data[k + 1] = 40 + 180 * (1 - j / 63) * (0.6 + 0.4 * Math.sin(i / 7));
        img.data[k + 2] = 90 + 120 * Math.cos(j / 9);
        img.data[k + 3] = 255;
      }
    x.putImageData(img, 0, 0);
    const r = newRecipe();
    r.crop = { x: 0.08, y: 0.06, w: 0.84, h: 0.88, angle: 4, quarter: 0, flip: false, ratio: 'free' };
    r.light = { exposure: 0.5, contrast: 20, highlights: -25, shadows: 30, whites: 10, blacks: -8 };
    r.wb = { temp: 7600, tint: 8 };
    r.curves.l = [[0, 0], [0.45, 0.58], [1, 1]];
    r.color = { vibrance: 30, saturation: -8, hsl: r.color.hsl.map((_b, i) => ({ h: i * 6 - 20, s: 12 - i * 3, l: i * 3 - 8 })) };
    const m = newMask('linear', 1);
    m.adj.exposure = -45;
    r.masks = [m];
    r.heals = [{ x: 0.5, y: 0.4, r: 0.1, dx: 0.18, dy: 0.05, feather: 0.5 }];
    r.effects = { vignette: 0.4, grain: 0.3, grainSize: 30, seed: 3, fade: 0.1 };
    return compare(g, c, r, null, { w: 64, h: 64 });
  };

  const ro = new ResizeObserver(() => draw());
  ro.observe(stage);
  // the brain's three keys say so when the signal goes and when it comes back
  ui.subscribe(() => {
    const off = ui.get().connected === false;
    if (off === peState.offline) return;
    peState.offline = off;
    if (!el.hidden && tool === 'brain') refreshTray();
  });

  const editorApi: PhotoEditor = {
    el,
    isOpen: () => !el.hidden,
    tool: (t) => {
      if (!el.hidden) setTool(t);
      else tool = t;
    },
    async load(photo, wanted) {
      const gen = ++generation;
      expose();
      el.hidden = false;
      id = photo;
      peState.open = true;
      peState.ready = false;
      peState.id = photo;
      peState.persistent = storeState.persistent;
      busy.hidden = false;
      busy.textContent = 'Opening the photo…';
      for (const c of [glCanvas, cpuCanvas]) c.style.visibility = 'hidden';
      try {
        const meta = await getMeta(photo);
        const blob = await getOriginal(photo);
        if (!meta || !blob) throw new Error('I can’t find that photo any more.');
        const kept = await getDecoded(photo);
        const opened = await openPhoto(blob, meta.name, { decoded: kept?.blob ?? null, say: (w) => ((busy.hidden = false), (busy.textContent = w)) });
        if (gen !== generation) return;
        forgetPatches(new Set());
        stage.querySelector('.perawoffer')?.remove();
        if (opened.raw && kept?.info) Object.assign(opened.raw, { make: kept.info.make, model: kept.info.model, half: kept.info.half });
        Object.assign(peState, { cutFrom: '', cutMs: 0, cutFail: '', erasedBy: '', eraseMs: 0, erasing: false, eraseFail: '' });
        base = opened.canvas;
        orig = base;
        holeMask.alpha = '';
        holeKeep = null;
        srcSize = { w: opened.w, h: opened.h };
        cpuProxy = null;
        cpuFull = null;
        proxyCache = null;
        layerSrc = null;
        recipe = (await getRecipe(photo)) ?? newRecipe();
        appliedKey = patchKey(recipe.patches);
        orig = applyPatches(base, recipe.patches);
        layerCanvas = null;
        if (recipe.layer) {
          const lb = await getLayer(recipe.layer.photo);
          if (lb) layerCanvas = (await openPhoto(lb, 'layer')).canvas;
          else recipe.layer = null;
        }
        hist = new RecipeHistory(recipe);
        savedOnce = false;
        saved.textContent = '';
        peState.saved = '';
        peState.name = meta.name;
        peState.size = srcSize;
        title.textContent = meta.name;
        sel.mask = recipe.masks[0]?.id ?? '';
        sel.healSel = recipe.heals.length - 1;
        sel.brush = false;
        sel.showMask = false;
        view = { zoom: 1, cx: 0.5, cy: 0.5 };
        ensureGl();
        if (gl && useGl) {
          const info = gl.setSource(orig);
          peState.scaled = info.scaled;
          gl.setLayer(layerCanvas);
        }
        for (const c of [glCanvas, cpuCanvas]) c.style.visibility = '';
        busy.hidden = true;
        syncHistoryUi();
        const last = (await import('../../photo/store')).lastOpen();
        const startTool = wanted ?? (last && last.id === photo && TOOLS.some(([t]) => t === last.tool) ? (last.tool as Tool) : tool);
        setTool(startTool);
        peState.looks = (await listMyLooks()).map((l) => l.name);
        peState.raw = opened.raw ? `${[opened.raw.make, opened.raw.model].filter(Boolean).join(' ') || 'a camera'} · ${(opened.w * opened.h / 1e6).toFixed(1)} megapixels${opened.raw.half ? ' · half size' : ''}` : '';
        peState.rawMs = Math.round(opened.raw?.ms ?? 0);
        if (opened.raw && !rawSaid.has(photo)) {
          rawSaid.add(photo);
          say(`This is a RAW from ${peState.raw}. I read it with the camera’s own white balance${opened.raw.ms ? ` in ${(opened.raw.ms / 1000).toFixed(1)} s` : ''}; the RAW file stays as it is and EXPORT ORIGINAL gives it back.`);
        } else if (peState.scaled) say(`This photo is bigger than this phone can hold as one picture (${gl!.caps.maxTexture} px a side), so I edit it a little smaller; the original stays as it was.`);
        else if (!storeState.persistent) say('This phone is keeping nothing for me (a private window?), so your edits last until you leave.');
        sayHoldIntro();
        void import('../../photo/store').then((s) => s.rememberLast(photo, tool));
        peState.offline = ui.get().connected === false;
        draw();
        peState.ready = true;
      } catch (e) {
        busy.hidden = false;
        busy.textContent = sayError(e, 'open the photo');
        peState.status = busy.textContent;
        if ((e as Error)?.name === 'RawNeedsReader') {
          // a RAW and no reader kept: the size and GET, here, on the stage; the photo opens when it is here
          stage.querySelector('.perawoffer')?.remove();
          stage.append(h('div.perawoffer', packOffer('raw', () => void editorApi.load(photo, wanted))));
          peState.status = `This is a RAW. To open it I need the RAW reader (${packSize('raw')}): GET`;
          busy.textContent = peState.status;
        } else toast(busy.textContent, 'bad');
      }
    },
    unload() {
      flush();
      el.hidden = true;
      peState.open = false;
      generation++;
      holdOriginal(false);
      forgetPatches(new Set());
      base = null;
      orig = null;
      layerCanvas = null;
      cpuFull = null;
      cpuProxy = null;
      proxyCache = null;
      layerSrc = null;
    },
  };
  return editorApi;
}

export { cloneRecipe };
