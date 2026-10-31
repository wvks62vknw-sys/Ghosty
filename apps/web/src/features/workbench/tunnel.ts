/**
 * THE WIND TUNNEL section of the Workbench (OWNER-ISSUES 61b, "the wind tunnel on his phone"): a 2-D flow round a shape,
 * live. The lattice runs in the shared worker (features/workbench/tunnelwork.ts, the `gym`/`site` pattern) at 192 × 96, as
 * many steps a frame as keep about 30 fps; its frames arrive as transferable buffers and this page only draws them — speed
 * or swirl in a palette that reads in both themes, dye streaks from the inlet, the shape in pale grey.
 *
 * The shape: a NACA aerofoil (its camber and thickness, so its code, and the angle of attack as sliders), a circle, a square,
 * a flat plate, a car, or DRAW (each touch on the tunnel adds a point; three make a shape). The wind speed slider; SPEED /
 * SWIRL; PAUSE / RESUME; RESET. The live card: Cl, Cd, the Reynolds number the lattice stands for, lift and drag in newtons
 * for a stated chord, span, wind and air (the lattice's coefficients scaled, and said as scaled), and the standing label
 * FIRST ESTIMATE · NOT CERTIFIED — a 2-D, low-Reynolds lattice flow; a real wing is 3-D and turbulent.
 *
 * While it runs the phone is in heavy mode (core/heavy.ts: the GYM and Mind step aside); leaving the section or the tab ends
 * the worker. Its state is on window.__ghosty.tunnel for the specs.
 */
import { caveatFor, fromSI, num, parseQuantity, show, type ShapeKind, type ShapeSpec, type UnitSystem } from '../../../../../packages/shared/src/workbench';
import { clear, h } from '../../core/dom';
import { heavy } from '../../core/heavy';
import { settings } from '../../state/app';
import { button, panel } from '../../ui/components';
import { labelRow } from './card';
import type { TunnelIn, TunnelOut, TunnelView } from './tunnelwork';

export const NX = 192;
export const NY = 96;
const KEY = 'ghosty.workbench.tunnel';
const WHY = 'the wind tunnel';
const TAU = 0.56;

/** What the tunnel is doing, for the specs (window.__ghosty.tunnel) and describe(). */
export const tunnelState = {
  /** Numbers on the card (the first frame with a finite Cd arrived). */
  ready: false,
  running: false,
  paused: false,
  steps: 0,
  cd: NaN,
  cl: NaN,
  re: 0,
  shape: 'naca' as ShapeKind,
  shapeName: '',
  /** Bumped by every new shape the worker has taken. */
  shapeSeq: 0,
  cells: 0,
  /** Messages from the worker since the page loaded. */
  messages: 0,
  /** From starting to the first numbers, ms. */
  firstMs: 0,
  perFrame: 0,
  fps: 0,
  view: 'speed' as TunnelView,
  drawing: false,
  points: 0,
  /** A number that was not finite reached the card. */
  nan: false,
  note: '',
  /** The tunnel holds the phone's heavy mode (the GYM and Mind step aside). */
  heavy: false,
};

interface Kept {
  kind: ShapeKind;
  /** NACA camber (% of the chord) and thickness (%). */
  camber: number;
  thick: number;
  /** Angle of attack, degrees. */
  alpha: number;
  /** 0–1: the inlet from 0.02 to 0.1 lattice units. */
  speed: number;
  view: TunnelView;
  /** The scale for the newtons: chord and span m, wind m/s, air kg/m³. */
  chord: number;
  span: number;
  wind: number;
  rho: number;
}
const DEFAULTS: Kept = { kind: 'naca', camber: 2, thick: 12, alpha: 6, speed: 0.75, view: 'speed', chord: 1, span: 1, wind: 20, rho: 1.225 };

function loadKept(): Kept {
  try {
    const k = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Kept>;
    const out = { ...DEFAULTS };
    for (const key of Object.keys(DEFAULTS) as (keyof Kept)[]) if (typeof k[key] === typeof DEFAULTS[key]) (out as Record<string, unknown>)[key] = k[key];
    return out;
  } catch {
    return { ...DEFAULTS };
  }
}
const saveKept = (k: Kept) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(k));
  } catch {
    /* kept for this visit only */
  }
};

const code = (k: Kept) => `${Math.round(k.camber)}4${String(Math.round(k.thick)).padStart(2, '0')}`;
const inletOf = (k: Kept) => 0.02 + 0.08 * Math.max(0, Math.min(1, k.speed));
const specOf = (k: Kept, points: [number, number][]): ShapeSpec => (k.kind === 'free' ? { kind: 'free', points } : { kind: k.kind, code: code(k), alpha: k.alpha });

/** The palettes (both themes are dark): speed from deep navy through teal and cyan to pale, the fastest amber; swirl from amber (clockwise) through dark to cyan. */
function ramp(stops: [number, [number, number, number]][]): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let j = 0;
    while (j < stops.length - 2 && t > stops[j + 1]![0]) j++;
    const [t0, a] = stops[j]!;
    const [t1, b] = stops[j + 1]!;
    const u = Math.max(0, Math.min(1, (t - t0) / (t1 - t0 || 1)));
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = a[c]! + (b[c]! - a[c]!) * u;
  }
  return lut;
}
const SPEED = ramp([[0, [6, 14, 26]], [0.3, [22, 74, 104]], [0.55, [52, 170, 214]], [0.75, [168, 236, 255]], [0.9, [240, 250, 255]], [1, [255, 179, 64]]]);
const SWIRL = ramp([[0, [255, 179, 64]], [0.35, [92, 52, 20]], [0.5, [8, 16, 26]], [0.65, [20, 70, 96]], [1, [92, 225, 255]]]);
const SOLID: [number, number, number] = [214, 222, 230];

export interface Tunnel {
  el: HTMLElement;
  /** Start the flow (a new worker), if it is not running. */
  start(): void;
  /** End it (the worker goes; heavy mode off). */
  stop(): void;
  /** Re-show the card in his units. */
  units(): void;
}

/** `onFrame`: each frame's numbers, for the screen's hero while the tunnel's section is the one shown. */
export function tunnelPanel(onFrame?: (o: TunnelOut) => void): Tunnel {
  const k = loadKept();
  tunnelState.shape = k.kind;
  tunnelState.view = k.view;
  const pn = panel('WIND TUNNEL', { cls: 'wb.wb-tunnel', grow: false });
  const canvas = h('canvas.tuncanvas', { width: NX, height: NY, role: 'img', 'aria-label': 'The wind tunnel: the air flowing past the shape, drawn live' });
  const ctx = canvas.getContext('2d');
  const img = ctx ? ctx.createImageData(NX, NY) : null;
  const wrap = h('div.tunwrap', canvas);
  const drawNote = h('div.note.tundraw', { hidden: true }, 'Touch the tunnel to draw: every touch adds a point, three make a shape.');
  const ctl = h('div.wbform.tunctl');
  const viewRow = h('div.wbmodes', { role: 'tablist', 'aria-label': 'What the colours show' });
  const btnRow = h('div.tunbtns');
  const card = h('div.wbout', { 'aria-live': 'off' });
  pn.body.append(wrap, drawNote, ctl, viewRow, btnRow, card);

  let worker: Worker | null = null;
  let startedAt = 0;
  let mask: Uint8Array | null = null;
  let last: TunnelOut | null = null;
  let points: [number, number][] = [];
  const sys = (): UnitSystem => (settings.get().units === 'imperial' ? 'imperial' : 'metric');
  const send = (m: TunnelIn) => worker?.postMessage(m);

  // ---------- the controls
  const slider = (label: string, min: number, max: number, step: number, value: number, text: (v: number) => string, on: (v: number) => void, key: string) => {
    const id = `tun-${key}`;
    const input = h('input', { id, type: 'range', min: String(min), max: String(max), step: String(step), 'aria-label': label });
    input.value = String(value);
    const out = h('span.tunval', text(value));
    input.addEventListener('input', () => {
      const v = Number(input.value);
      out.textContent = text(v);
      on(v);
    });
    return h('div.wbf.rng', { dataset: { key } }, h('label', { htmlFor: id }, label), input, out);
  };
  const kinds: [ShapeKind, string][] = [['naca', 'Aerofoil'], ['circle', 'Circle'], ['square', 'Square'], ['plate', 'Flat plate'], ['car', 'Car'], ['free', 'Your own']];
  const reshape = () => {
    saveKept(k);
    tunnelState.shape = k.kind;
    send({ tunnel: 'shape', shape: specOf(k, points) });
  };
  let shapeT: ReturnType<typeof setTimeout> | null = null;
  const reshapeSoon = () => {
    if (shapeT) clearTimeout(shapeT);
    shapeT = setTimeout(reshape, 120);
  };
  const scaleField = (key: 'chord' | 'span' | 'wind' | 'rho', label: string) => {
    const s = sys();
    const unit = key === 'wind' ? (s === 'metric' ? 'km/h' : 'mph') : key === 'rho' ? 'kg/m³' : s === 'metric' ? 'm' : 'ft';
    const q = key === 'wind' ? 'speed' : key === 'rho' ? null : 'length';
    const id = `tun-${key}`;
    const box = h('input', { id, type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': `${label}, in ${unit}` });
    box.value = q ? num(fromSI(k[key], unit, q), 4).replace(/,/g, '') : num(k[key], 4);
    box.addEventListener('input', () => {
      const v = q ? parseQuantity(box.value, q, unit)?.si : Number(box.value.replace(/,/g, ''));
      const row = box.closest('.wbf');
      if (!(typeof v === 'number' && Number.isFinite(v) && v > 0)) return void row?.classList.add('bad');
      row?.classList.remove('bad');
      k[key] = v;
      saveKept(k);
      if (last) paintCard(last);
    });
    return h('div.wbf', { dataset: { key } }, h('label', { htmlFor: id }, label), box, h('span.wbu', { 'aria-hidden': 'true' }, unit));
  };

  const paintControls = () => {
    const sel = h('select', { id: 'tun-shape', 'aria-label': 'Shape' }, ...kinds.map(([v, l]) => h('option', { value: v }, l)));
    sel.value = k.kind;
    sel.addEventListener('change', () => {
      k.kind = sel.value as ShapeKind;
      if (k.kind === 'free') setDrawing(true);
      else setDrawing(false);
      paintControls();
      reshape();
    });
    const rows: HTMLElement[] = [h('div.wbf', { dataset: { key: 'shape' } }, h('label', { htmlFor: 'tun-shape' }, 'Shape'), sel, h('span.wbu'))];
    if (k.kind === 'naca') {
      rows.push(
        slider('Camber', 0, 6, 1, k.camber, (v) => `${v} %`, (v) => ((k.camber = v), reshapeSoon()), 'camber'),
        slider('Thickness', 6, 24, 1, k.thick, (v) => `${v} %`, (v) => ((k.thick = v), reshapeSoon()), 'thick'),
      );
    }
    if (k.kind !== 'circle' && k.kind !== 'free') rows.push(slider('Angle of attack', -10, 20, 1, k.alpha, (v) => `${v}°`, (v) => ((k.alpha = v), reshapeSoon()), 'alpha'));
    rows.push(slider('Wind speed', 0, 1, 0.05, k.speed, (v) => `${Math.round(v * 100)} %`, (v) => {
      k.speed = v;
      saveKept(k);
      if (shapeT) clearTimeout(shapeT);
      shapeT = setTimeout(() => send({ tunnel: 'speed', inlet: inletOf(k) }), 150);
    }, 'speed'));
    rows.push(scaleField('chord', 'Scale to: chord'), scaleField('span', 'Span'), scaleField('wind', 'Wind'), scaleField('rho', 'Air density'));
    clear(ctl, ...rows);
  };

  const paintView = () => {
    clear(viewRow, ...(['speed', 'swirl'] as TunnelView[]).map((v) => h(`button${k.view === v ? '.on' : ''}` as 'button', {
      type: 'button', role: 'tab', 'aria-selected': String(k.view === v), dataset: { view: v },
      onclick: () => {
        k.view = v;
        tunnelState.view = v;
        saveKept(k);
        send({ tunnel: 'view', view: v });
        paintView();
      },
    }, v === 'speed' ? 'Speed' : 'Swirl')));
  };

  const pauseBtn = button('PAUSE', () => {
    if (!worker) return;
    tunnelState.paused = !tunnelState.paused;
    send({ tunnel: tunnelState.paused ? 'pause' : 'resume' });
    pauseBtn.textContent = tunnelState.paused ? 'RESUME' : 'PAUSE';
    syncHeavy();
  }, 'tunpause');
  const resetBtn = button('RESET', () => send({ tunnel: 'reset' }), 'tunreset');
  const drawBtn = button('DRAW', () => {
    if (tunnelState.drawing) return setDrawing(false);
    points = [];
    tunnelState.points = 0;
    k.kind = 'free';
    setDrawing(true);
    paintControls();
  }, 'tundrawbtn');
  const clearBtn = button('CLEAR', () => {
    points = [];
    tunnelState.points = 0;
    draw();
  }, 'tunclear');
  clearBtn.hidden = true;
  btnRow.append(pauseBtn, resetBtn, drawBtn, clearBtn);

  function setDrawing(on: boolean): void {
    tunnelState.drawing = on;
    drawNote.hidden = !on;
    clearBtn.hidden = !on;
    drawBtn.textContent = on ? 'DONE' : 'DRAW';
    drawBtn.classList.toggle('on', on);
    canvas.classList.toggle('drawing', on);
  }

  // ---------- drawing a shape with his finger
  const toCell = (e: PointerEvent): [number, number] => {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / Math.max(1, r.width)) * NX, (1 - (e.clientY - r.top) / Math.max(1, r.height)) * NY];
  };
  let pressed = false;
  const addPoint = (p: [number, number]) => {
    const prev = points[points.length - 1];
    if (prev && Math.hypot(prev[0] - p[0], prev[1] - p[1]) < 1.5) return;
    points.push([Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]);
    tunnelState.points = points.length;
  };
  canvas.addEventListener('pointerdown', (e) => {
    if (!tunnelState.drawing) return;
    e.preventDefault();
    pressed = true;
    canvas.setPointerCapture?.(e.pointerId);
    addPoint(toCell(e));
    draw();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!tunnelState.drawing || !pressed) return;
    addPoint(toCell(e));
    draw();
  });
  const up = () => {
    if (!pressed) return;
    pressed = false;
    if (points.length >= 3) reshape();
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  // ---------- the picture
  function draw(): void {
    if (!ctx || !img) return;
    const d = img.data;
    const f = last?.field;
    const dye = last?.dye;
    const lut = (last?.view ?? k.view) === 'swirl' ? SWIRL : SPEED;
    const swirl = lut === SWIRL;
    for (let y = 0; y < NY; y++) {
      const row = NY - 1 - y;
      for (let x = 0; x < NX; x++) {
        const c = y * NX + x;
        const o = 4 * (row * NX + x);
        if (mask && mask[c]) {
          d[o] = SOLID[0];
          d[o + 1] = SOLID[1];
          d[o + 2] = SOLID[2];
          d[o + 3] = 255;
          continue;
        }
        const v = f ? f[c]! : 0;
        const t = swirl ? Math.max(0, Math.min(1, 0.5 + v / 12)) : Math.max(0, Math.min(1, v / 1.8));
        const i = (Math.round(t * 255) || 0) * 3;
        const a = dye ? (dye[c]! / 255) * 0.55 : 0;
        d[o] = lut[i]! * (1 - a) + 255 * a;
        d[o + 1] = lut[i + 1]! * (1 - a) + 255 * a;
        d[o + 2] = lut[i + 2]! * (1 - a) + 255 * a;
        d[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    if (tunnelState.drawing && points.length) {
      ctx.fillStyle = '#ffb340';
      ctx.strokeStyle = '#ffb340';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      points.forEach(([x, y], i) => (i ? ctx.lineTo(x, NY - y) : ctx.moveTo(x, NY - y)));
      ctx.stroke();
      for (const [x, y] of points) ctx.fillRect(x - 1, NY - y - 1, 2, 2);
    }
  }

  // ---------- the live card
  const realRe = () => (k.rho * k.wind * k.chord) / 1.81e-5;
  function paintCard(o: TunnelOut): void {
    const s = sys();
    const finite = Number.isFinite(o.cd) && Number.isFinite(o.cl);
    const q = 0.5 * k.rho * k.wind * k.wind * k.chord * k.span;
    const line = (label: string, value: string, note?: string) => h('div.wbline', h('span.k', h('span', label), note ? h('small.n', note) : null), h('span.v', value));
    clear(card, h('div.wbcard', { role: 'group', 'aria-label': 'Wind tunnel, first estimate, not certified' },
      labelRow(undefined, 'a 2-D, low-Reynolds lattice flow; a real wing is 3-D and turbulent'),
      h('div.wbtitle', `Wind tunnel: ${o.shapeName || 'starting'}`),
      h('div.wblines',
        line('Lift coefficient Cl', finite ? num(o.cl, 3) : '—'),
        line('Drag coefficient Cd', finite ? num(o.cd, 3) : '—'),
        line('Reynolds number', num(o.re, 3), `the lattice’s; real air at ${show(k.wind, 'speed', s)} on ${show(k.chord, 'length', s)} is ${num(realRe(), 2)}`),
        line('Lift, scaled', finite ? show(q * o.cl, 'force', s) : '—', `½ρv²·chord·span·Cl at ${show(k.wind, 'speed', s)}`),
        line('Drag, scaled', finite ? show(q * o.cd, 'force', s) : '—', 'the lattice’s Cd: real drag at a high Reynolds number is lower'),
        line('Steps', num(o.steps, 6), `${o.perFrame} a frame · ${o.fps} frames a second${o.paused ? ' · paused' : ''}`),
      ),
      ...(o.clamped.length || tunnelState.note ? [h('p.wbcaveat', [...o.clamped, tunnelState.note].filter(Boolean).join(' '))] : []),
      h('p.wbcaveat', caveatFor('tunnel')),
    ));
  }

  // ---------- the worker
  const syncHeavy = () => {
    const want = !!worker && !tunnelState.paused;
    if (want && !(heavy.get().on && heavy.get().why === WHY)) {
      if (!heavy.get().on) heavy.set({ on: true, why: WHY });
    } else if (!want && heavy.get().why === WHY) heavy.set({ on: false, why: '' });
    tunnelState.heavy = heavy.get().on && heavy.get().why === WHY;
  };
  const onMessage = (e: MessageEvent) => {
    const o = e.data as TunnelOut;
    if (!o || o.tunnel !== 'frame') return;
    tunnelState.messages++;
    if (o.mask) mask = o.mask;
    last = o;
    if (o.note) tunnelState.note = o.note;
    tunnelState.steps = o.steps;
    tunnelState.cd = o.cd;
    tunnelState.cl = o.cl;
    tunnelState.re = o.re;
    tunnelState.shapeName = o.shapeName;
    tunnelState.shapeSeq = o.shapeSeq;
    tunnelState.cells = o.cells;
    tunnelState.perFrame = o.perFrame;
    tunnelState.fps = o.fps;
    tunnelState.paused = o.paused;
    if (!Number.isFinite(o.cd) || !Number.isFinite(o.cl) || !Number.isFinite(o.re)) tunnelState.nan = true;
    draw();
    paintCard(o);
    onFrame?.(o);
    if (!tunnelState.ready && o.steps > 0 && Number.isFinite(o.cd)) {
      tunnelState.ready = true;
      tunnelState.firstMs = Date.now() - startedAt;
    }
    send({ tunnel: 'ack' });
  };

  const tunnel: Tunnel = {
    el: pn.el,
    start() {
      if (worker) return;
      startedAt = Date.now();
      tunnelState.ready = false;
      tunnelState.running = true;
      tunnelState.paused = false;
      tunnelState.nan = false;
      tunnelState.note = '';
      pauseBtn.textContent = 'PAUSE';
      try {
        worker = new Worker('/textures.worker.js');
      } catch {
        worker = null;
        tunnelState.running = false;
        clear(card, h('div.note', 'The wind tunnel could not start on this phone.'));
        return;
      }
      worker.onmessage = onMessage;
      worker.onerror = (e) => {
        e.preventDefault();
        tunnelState.note = 'The tunnel stopped by itself: RESET starts it again.';
        tunnel.stop();
      };
      send({ tunnel: 'start', nx: NX, ny: NY, shape: specOf(k, points), inlet: inletOf(k), tau: TAU, view: k.view });
      syncHeavy();
    },
    stop() {
      if (!worker) return;
      worker.terminate();
      worker = null;
      tunnelState.running = false;
      syncHeavy();
    },
    units() {
      paintControls();
      if (last) paintCard(last);
    },
  };
  resetBtn.addEventListener('click', () => {
    if (!worker) tunnel.start();
  });
  paintControls();
  paintView();
  setDrawing(false);
  draw();
  clear(card, h('div.wbcard', labelRow(undefined, 'a 2-D, low-Reynolds lattice flow; a real wing is 3-D and turbulent'), h('div.wbtitle', 'Wind tunnel: starting'), h('p.wbcaveat', caveatFor('tunnel'))));
  expose();
  return tunnel;
}

function expose(): void {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  const attach = () => {
    if (!w.__ghosty) return false;
    w.__ghosty.tunnel = tunnelState;
    return true;
  };
  if (attach()) return;
  let n = 0;
  const t = setInterval(() => {
    if (attach() || ++n > 60) clearInterval(t);
  }, 250);
}
