/**
 * MIND: Home's centrepiece (the owner's pick, 23 Oct). A hologram of Ghosty's mind: a sphere of
 * light holding a slowly turning constellation of his library. Each cluster is one field of the library, from the
 * brain's study summary. Each node stands for about 20 passages of the library (the total from brain.library()),
 * shared out across the fields by their topics. A node is lit when its share of that field has been read.
 * Light pulses run along the links (a few always, many while a reply is being worked out).
 * Ported from docs/build-plan/mockups/hero/mind/scene.js, the mock-up the owner chose.
 *
 * Light on the battery: three.js loads only when Home is first shown, the way the 3D STUDIO loads it
 * (studio/three.ts: the vendored module, never bundled, nothing from the network). There is one WebGL context.
 * It draws at 30 fps when idle and 60 fps for a second after a change, and not at all while the tab is hidden or the
 * hero is scrolled out of view. The pixel ratio is capped at 2. With "reduce motion", and while a paper is sat on the
 * phone's brain (heavy mode, core/heavy.ts), it draws one still frame for each change and runs no loop. reactor.ts keeps
 * today's 2-D reactor whenever this cannot run.
 *
 * Its light is the theme's accent (state/theme.ts writes it as --c, and a pale tint of it as --c2): the sphere's rim,
 * the lit nodes, their links and the pulses running along them all take it, and change with the theme at once.
 */
import { brain } from '../../api/brain';
import { heavy } from '../../core/heavy';
import type { VoiceState } from '../../state/app';
import { ui } from '../../state/app';
import { loadThree } from '../../studio/three';
import { gymState } from '../gym/index';
import { themeEvents } from '../../state/theme';

/* eslint-disable @typescript-eslint/no-explicit-any */
// three.js is typed by hand for the studio (studio/three.ts) and only for what the studio calls; the hero uses a few
// more classes (points, sprites, line segments, a shader), so it reaches them loosely through this alias.
type Any = any;

/** One field of the library: its topics, and how many of them Ghosty has read. */
export interface MindField {
  name: string;
  topics: number;
  read: number;
}
/** What the constellation is drawn from: the library's passage count and its fields. */
export interface MindData {
  passages: number;
  fields: MindField[];
}
/** The hero's states: the voice states, plus studying or training (busy) and no connection (offline). */
export type MindState = VoiceState | 'busy' | 'offline';

/** How many passages one node stands for, and the most nodes drawn (beyond that each node stands for more). */
export const PER_NODE = 20;
export const MAX_NODES = 600;

/** What the hero is doing, readable by a test (and the console) at window.__ghosty.hero. */
export const heroState = {
  mode: 'off' as 'off' | 'loading' | 'mind' | '2d',
  /** Why the 2-D reactor is showing instead (no WebGL, three.js failed). */
  reason: '',
  state: 'idle' as MindState,
  passages: 0,
  perNode: PER_NODE,
  nodes: 0,
  lit: 0,
  fields: 0,
  frames: 0,
  /** Whether a frame loop runs (false with reduce motion: one still frame per change). */
  loop: false,
  /** Average time to draw one frame, in milliseconds. */
  frameMs: 0,
  /** The accent it is drawn in: the theme's --c (state/theme.ts). */
  accent: '',
};

/** Share out the nodes: about one per 20 passages, split across the fields by their topics, lit by what is read. */
export function plan(d: MindData): { fields: { name: string; nodes: number; lit: number }[]; nodes: number; lit: number; perNode: number } {
  const want = Math.round(Math.max(0, d.passages) / PER_NODE);
  const total = Math.min(MAX_NODES, want);
  const perNode = total && want > MAX_NODES ? Math.ceil(d.passages / MAX_NODES) : PER_NODE;
  const fields = d.fields.filter((f) => f.topics > 0).sort((a, b) => b.topics - a.topics);
  const out: { name: string; nodes: number; lit: number }[] = [];
  if (!total) return { fields: [], nodes: 0, lit: 0, perNode };
  if (!fields.length) {
    // No study summary (offline, or an older brain): one cluster, nothing claimed as read.
    out.push({ name: 'Library', nodes: total, lit: 0 });
  } else {
    const all = fields.reduce((n, f) => n + f.topics, 0);
    let left = total;
    for (const [i, f] of fields.entries()) {
      if (left <= 0) break;
      const share = i === fields.length - 1 ? left : Math.max(1, Math.round((total * f.topics) / all));
      const n = Math.min(left, share);
      left -= n;
      out.push({ name: f.name, nodes: n, lit: Math.min(n, Math.round((n * Math.min(f.read, f.topics)) / f.topics)) });
    }
  }
  return { fields: out, nodes: out.reduce((n, f) => n + f.nodes, 0), lit: out.reduce((n, f) => n + f.lit, 0), perNode };
}

/** Can this browser draw WebGL at all? (Checked once, on a throwaway canvas.) */
export function webglWorks(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
/** A small seeded random number generator, so the constellation keeps its shape from one visit to the next. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The numbers each state sets: how open, how bright the rim and the nodes, how fast, how many pulses. */
const TARGET: Record<MindState, { open: number; rim: number; bright: number; spin: number; pulses: number; pace: number; busy: number; grey: number }> = {
  idle: { open: 0, rim: 1, bright: 1, spin: 0.09, pulses: 4, pace: 0.22, busy: 0, grey: 0 },
  listening: { open: 1, rim: 1.6, bright: 1.25, spin: 0.12, pulses: 6, pace: 0.3, busy: 0, grey: 0 },
  thinking: { open: 0.3, rim: 1.25, bright: 1.15, spin: 0.2, pulses: 36, pace: 1.5, busy: 0, grey: 0 },
  speaking: { open: 0.45, rim: 1.35, bright: 1.2, spin: 0.12, pulses: 10, pace: 0.5, busy: 0, grey: 0 },
  busy: { open: 0.15, rim: 1.1, bright: 1.05, spin: 0.1, pulses: 8, pace: 0.35, busy: 1, grey: 0 },
  offline: { open: 0, rim: 0.6, bright: 0.55, spin: 0.04, pulses: 0, pace: 0.2, busy: 0, grey: 1 },
};
type Params = (typeof TARGET)['idle'];

/**
 * What the boot cinematic (shell/boot.ts) asks of the scene in one frame, each 0..1 unless said: MIND waking up.
 * The cinematic borrows this one Mind before Home exists and hands it to Home's hero after (never a copy).
 */
export interface BootLook {
  /** the particles drifting out of the point of light and settling into the constellation */
  gather: number;
  /** the links between them, lit as they settle */
  links: number;
  /** the sphere resolving round them: its latitudes and the tilted ring (and, scaled by the three below, the rest) */
  sphere: number;
  /** the inside out: the faint haze within the sphere first */
  haze: number;
  /** then the meridians, catching the light one after another (0: none yet; 1: all lit and settled) */
  mer: number;
  /** and the rim (its two Fresnel shells) last */
  rim: number;
  /** how much of the equator scale is lit, round from the front */
  scale: number;
  /** the nucleus and its light */
  core: number;
  /** extra turn of the constellation, in radians (ends at 0, so Home carries on from the same angle) */
  turn: number;
  /** the camera's distance as a multiple of Home's (1 = Home's framing) */
  push: number;
  /** the thin sweep of light passing down through it: its height in sphere radii, NaN when there is none */
  sweep: number;
  /** the faint trails the gathering particles leave (0: none) */
  trails: number;
  /** the sweep refracting as it crosses the equator: a flare along it, and a second, bent ring below (0: none) */
  refract: number;
}
/** The whole of Mind, as Home draws it. */
export const BOOT_DONE: BootLook = { gather: 1, links: 1, sphere: 1, haze: 1, mer: 1, rim: 1, scale: 1, core: 1, turn: 0, push: 1, sweep: NaN, trails: 0, refract: 0 };
/** Meridians round the sphere (each its own material, so the boot can light them one after another). */
const MERIDIANS = 6;
/** How much of the gathering a trail spans (in the gather's own 0..1). */
const TRAIL = 0.07;

/** The constellation he saw last (saved on this phone), so the boot draws what he knows before the brain answers. */
const DATA_KEY = 'ghosty.mind.data';
function savedData(): MindData | null {
  try {
    const d = JSON.parse(localStorage.getItem(DATA_KEY) ?? 'null') as MindData | null;
    return d && Number.isFinite(d.passages) && Array.isArray(d.fields) ? d : null;
  } catch {
    return null;
  }
}
/** Before anything was ever saved (the very first open): one quiet cluster, nothing claimed as read. */
const FIRST_LIGHT: MindData = { passages: 2400, fields: [] };

/** A fixed pseudo-random number from a position, so a node's drift is the same in each of its layers. */
const hash3 = (x: number, y: number, z: number) => {
  const v = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return v - Math.floor(v);
};
const ease = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : 1 - Math.pow(1 - k, 3));
/** Where a node whose home is (x, y, z) is at gather `g`, written into `a` at `i`: each node leaves the point of light a
 *  little later the further out it lives, and swirls on its way. */
function gathered(a: Float32Array, i: number, x: number, y: number, z: number, g: number): void {
  const r = hash3(x, y, z);
  const k = ease((g - 0.35 * r) / 0.65);
  const sw = (1 - k) * (1.4 + r * 1.6);
  const c = Math.cos(sw);
  const s = Math.sin(sw);
  a[i] = (x * c - z * s) * k;
  a[i + 1] = y * k + (1 - k) * (r - 0.5) * 0.12 * Math.sin(k * Math.PI);
  a[i + 2] = (x * s + z * c) * k;
}

/** The one Mind on this phone. The boot cinematic may make it before Home exists; Home's hero adopts it. */
let theMind: Mind | null = null;
export const currentMind = (): Mind | null => theMind;
/** The Mind, made once: `anchor` is the hero's 2-D canvas it lies over (null while the boot holds it). */
export function mindFor(anchor: HTMLCanvasElement | null): Mind {
  theMind ??= new Mind(anchor);
  if (anchor) theMind.adopt(anchor);
  return theMind;
}

/** Reactor's cyan and its pale tint: what Mind is drawn in until the theme's tokens are read. */
const CYAN = 0x64d2ff;
const PALE = 0xbff0ff;
const GREY = 0x8a949a;

/** The theme's accent and its pale tint, from the page's tokens (--c, --c2). */
export function accentTokens(): { c: string; pale: string } {
  const cs = getComputedStyle(document.documentElement);
  return { c: cs.getPropertyValue('--c').trim() || '#64d2ff', pale: cs.getPropertyValue('--c2').trim() || '#bff0ff' };
}

export class Mind {
  /** The WebGL canvas, laid exactly over the 2-D reactor's canvas (which stays in the layout, hidden). */
  readonly canvas = document.createElement('canvas');
  private T: Any = null;
  private renderer: Any = null;
  private scene: Any = null;
  private camera: Any = null;
  private root: Any = null;
  private spin: Any = null;
  private stars: Any = null;
  private glowTex: Any = null;
  private parts: Record<string, Any> = {};
  private pulses: { s: Any; link: [Any, Any]; off: number; sp: number }[] = [];
  private links: [Any, Any, boolean][] = [];
  private p: Params = { ...TARGET.idle };
  private t = 0;
  private acc = 0;
  private changedAt = -10;
  private st: MindState = 'idle';
  private level = 0;
  private dirty = true;
  private inView = true;
  private io: IntersectionObserver | null = null;
  private w = 0;
  private h = 0;
  private dataKey = '';
  private fetchedAt = 0;
  private kick = 0;
  private studyBusy = false;
  private starting: Promise<boolean> | null = null;
  /** Home's camera distance for this box (place / size), before the boot's push-in. */
  private camZ = 5;
  /** While the boot cinematic holds the scene: what it asks for this frame (null: Home draws it). */
  private boot: BootLook | null = null;
  /** Library numbers that arrived during the boot, drawn once it lands (the constellation never jumps mid-flight). */
  private pending: MindData | null = null;
  /** The warm return's breath: how fast the kick fades (per second). */
  private kickRate = 1.5;
  /** The accent and the tints made from it (see colours()). */
  private col: Record<'c' | 'pale' | 'soft' | 'dimLink' | 'dimNode', Any> = {} as never;
  active = false;

  constructor(private anchor: HTMLCanvasElement | null) {
    this.canvas.className = 'mindhero';
    this.canvas.setAttribute('aria-hidden', 'true');
  }

  /** Home's hero takes this Mind: from now on it lies over that canvas (once the boot lets go of it). */
  adopt(anchor: HTMLCanvasElement): void {
    if (anchor === this.anchor) return;
    this.anchor = anchor;
    this.w = this.h = 0;
    this.io?.disconnect();
    this.io?.observe(anchor);
    this.dirty = true;
  }

  /** Load three.js and build the scene, once (the boot and Home ask for the same one). False when it cannot run here. */
  start(): Promise<boolean> {
    this.starting ??= this.begin();
    return this.starting;
  }

  private async begin(): Promise<boolean> {
    heroState.mode = 'loading';
    // Automated checks (Playwright) draw WebGL in software at a few frames a second, which would starve every other
    // check that passes through Home: there the 2-D reactor stands in unless a check asks for Mind (tests/hero.spec.mjs).
    if (navigator.webdriver && !(globalThis as { __ghostyHero?: boolean }).__ghostyHero) return this.fail('automation: the 2-D reactor stands in');
    if (!webglWorks()) return this.fail('no WebGL');
    let lib: Awaited<ReturnType<typeof loadThree>>;
    try {
      lib = await loadThree();
    } catch {
      return this.fail('three.js did not load');
    }
    try {
      this.build(lib.THREE as Any);
    } catch (e) {
      return this.fail(`WebGL refused: ${String((e as Error)?.message ?? e).slice(0, 80)}`);
    }
    this.io = new IntersectionObserver((es) => {
      this.inView = es.some((e) => e.isIntersecting);
      if (this.inView) this.dirty = true;
    });
    if (this.anchor) this.io.observe(this.anchor);
    // a new theme recolours the light at once (one still frame with reduce motion)
    themeEvents.on('change', () => {
      if (!this.T) return;
      this.colours();
      this.dirty = true;
    });
    this.active = true;
    heroState.mode = 'mind';
    heroState.reason = '';
    heroState.loop = !reduced();
    // what he saw last, at once; the brain's numbers replace it when they come
    const saved = savedData();
    if (saved) this.setData(saved);
    void this.refresh();
    return true;
  }

  private fail(why: string): false {
    heroState.mode = '2d';
    heroState.reason = why;
    this.dispose();
    return false;
  }

  /** The library's numbers, from the brain (and this phone's copy): refreshed every five minutes while Home shows. */
  async refresh(): Promise<void> {
    this.fetchedAt = performance.now();
    const [lib, study] = await Promise.all([brain.library().catch(() => null), brain.studyStatus().catch(() => null)]);
    if (study) {
      const last = study.last?.at ?? 0;
      this.studyBusy = !!study.on && Date.now() - last < 15 * 60_000;
    }
    if (!lib) return;
    this.setData({ passages: lib.stats.passages, fields: (study?.summary?.domains ?? []).map((d) => ({ name: d.name, topics: d.topics, read: d.read })) });
  }

  /** Draw the constellation for these numbers (rebuilt only when they change). */
  setData(d: MindData): void {
    if (this.boot && this.dataKey) {
      this.pending = d;
      return;
    }
    const pl = plan(d);
    const key = `${d.passages}|${pl.fields.map((f) => `${f.name}:${f.nodes}:${f.lit}`).join(',')}`;
    if (key === this.dataKey || !this.T) return;
    this.dataKey = key;
    if (d !== FIRST_LIGHT)
      try {
        localStorage.setItem(DATA_KEY, JSON.stringify(d));
      } catch {
        /* storage full or blocked: the boot draws the first light instead */
      }
    Object.assign(heroState, { passages: d.passages, perNode: pl.perNode, nodes: pl.nodes, lit: pl.lit, fields: pl.fields.length });
    this.buildStars(pl.fields);
    this.dirty = true;
  }

  /** The owner touched it: a quick brightening. */
  poke(): void {
    this.kick = 1;
    this.kickRate = 1.5;
    this.dirty = true;
  }

  /** The warm return: its light breathes out once, over `sec` (400 ms; 150 ms with reduce motion, as one bright still frame). */
  breathe(sec: number): void {
    if (!this.active || this.boot) return;
    this.kick = 1;
    this.kickRate = 1 / sec;
    this.dirty = true;
    if (reduced())
      setTimeout(() => {
        this.kick = 0;
        this.dirty = true;
      }, sec * 1000);
  }

  // ---------------------------------------------------------------- the boot cinematic (shell/boot.ts)
  /** The boot takes the scene: the canvas leaves the hero for the cinematic's layer, drawn at `w` × `h`. */
  bootBegin(host: HTMLElement, w: number, h: number): void {
    if (!this.active) return;
    this.boot = { ...BOOT_DONE };
    if (!this.dataKey) this.setData(savedData() ?? FIRST_LIGHT);
    host.append(this.canvas);
    this.canvas.style.display = '';
    this.size(w, h);
    // the cinematic's own pieces (the trails, the refraction) are hidden until their moment: their shaders are made now,
    // while the point of light still breathes, so their first frame does not stall mid-flight
    const P = this.parts;
    const extras = ['trails', 'sweep', 'sweep2', 'flare'].map((k) => P[k]).filter(Boolean);
    for (const o of extras) o.visible = true;
    try {
      this.renderer.compile(this.scene, this.camera);
    } catch {
      /* made on first use instead */
    }
    for (const o of extras) o.visible = false;
  }

  /** One frame of the cinematic, `t` seconds into it. */
  bootFrame(t: number, look: BootLook): void {
    if (!this.active || !this.boot) return;
    this.boot = look;
    this.t = t;
    this.draw(reduced() ? 12.5 : t);
  }

  /** The cinematic has landed on Home's hero: the canvas goes back over it, drawn at once at the hero's size. */
  bootEnd(): void {
    if (!this.boot) return;
    this.boot = null;
    this.gatherAt(1);
    const P = this.parts;
    P.tickGeo?.setDrawRange(0, Infinity);
    for (const k of ['sweep', 'sweep2', 'flare', 'trails']) if (P[k]) P[k].visible = false;
    for (const k of ['position', 'left', 'top', 'width', 'height', 'transform', 'transformOrigin', 'opacity', 'zIndex'] as const) this.canvas.style[k] = '';
    this.w = this.h = 0;
    if (this.pending) {
      const d = this.pending;
      this.pending = null;
      this.setData(d);
    }
    // the first ask may have gone before this phone was signed in: ask again now
    void this.refresh();
    if (this.anchor?.isConnected) {
      this.place();
      this.draw(reduced() ? 12.5 : this.t);
    }
    this.dirty = true;
  }

  /** Home's hero canvas this Mind lies over, once Home has taken it (null before). */
  get hero(): HTMLCanvasElement | null {
    return this.anchor;
  }

  /** Whether the boot is holding the scene. */
  get booting(): boolean {
    return !!this.boot;
  }

  /** Every node's place between the point of light (0) and its home in the constellation (1). */
  private gatherAt(g: number): void {
    for (const key of ['dim', 'halo', 'lit', 'litCore']) {
      const o = this.parts[key];
      const pos = o?.geometry?.attributes?.position;
      const home = o?.userData?.home as Float32Array | undefined;
      if (!pos || !home) continue;
      if (g >= 1 && o.userData.at === 1) continue;
      o.userData.at = g >= 1 ? 1 : g;
      const a = pos.array as Float32Array;
      for (let i = 0; i < a.length; i += 3) gathered(a, i, home[i]!, home[i + 1]!, home[i + 2]!, g);
      pos.needsUpdate = true;
    }
    // the trails: each node where it was a moment ago, a little before, and now
    const tr = this.parts.trails;
    const tpos = tr?.geometry?.attributes?.position;
    const th = tr?.userData?.home as Float32Array | undefined;
    if (!tpos || !th) return;
    tr.visible = !!this.boot && this.boot.trails > 0 && g > 0 && g < 1;
    if (!tr.visible) return;
    const a = tpos.array as Float32Array;
    for (let j = 0, n = th.length / 3; j < n; j++) {
      const x = th[j * 3]!;
      const y = th[j * 3 + 1]!;
      const z = th[j * 3 + 2]!;
      const o = j * 12;
      gathered(a, o, x, y, z, g - TRAIL);
      gathered(a, o + 3, x, y, z, g - TRAIL / 2);
      a.copyWithin(o + 6, o + 3, o + 6);
      gathered(a, o + 9, x, y, z, g);
    }
    tpos.needsUpdate = true;
  }

  /** How bright the core is (0..1.5): Home tints its glass with it (--glow). */
  light(): number {
    return (0.55 + 0.35 * this.p.bright + 0.3 * this.kick) * (1 - 0.4 * this.p.grey);
  }

  /**
   * One tick from Home's frame loop. Draws when a frame is due: 30 fps idle, 60 fps for a second after a change,
   * nothing while hidden or scrolled away, and only on a change with reduce motion.
   */
  frame(dt: number, voice: VoiceState, level: number): void {
    if (!this.active) return;
    if (this.boot) {
      // the cinematic draws it (shell/boot.ts); the hero's 2-D canvas stays clear underneath
      this.anchor?.classList.add('mindon');
      return;
    }
    this.place();
    const st: MindState = ui.get().connected === false ? 'offline' : voice === 'idle' && (this.studyBusy || !!gymState.training) ? 'busy' : voice;
    if (st !== this.st) {
      this.st = st;
      heroState.state = st;
      this.changedAt = this.t;
      this.dirty = true;
    }
    this.level += (level - this.level) * Math.min(1, dt * 12);
    this.t += dt;
    if (performance.now() - this.fetchedAt > 300_000) void this.refresh();
    if (document.hidden || !this.inView) return;
    // (heavy mode, core/heavy.ts: a paper being sat on the phone's brain gets the graphics; one still frame per change)
    const still = reduced() || heavy.get().on;
    heroState.loop = !still;
    if (still) {
      if (!this.dirty) return;
      this.p = { ...TARGET[this.st] };
    } else {
      const fps = this.t - this.changedAt < 1 || this.kick > 0.01 ? 60 : 30;
      this.acc += dt;
      if (this.acc < 1 / fps - 0.002 && !this.dirty) return;
      const k = Math.min(1, this.acc * 3);
      const tg = TARGET[this.st];
      for (const key of Object.keys(tg) as (keyof Params)[]) this.p[key] += (tg[key] - this.p[key]) * k;
      this.kick = Math.max(0, this.kick - this.acc * this.kickRate);
      this.acc = 0;
    }
    this.dirty = false;
    this.draw(still ? 12.5 : this.t);
  }

  /** Keep the WebGL canvas exactly over the 2-D one (Home lays out and sizes that one). */
  private place(): void {
    const a = this.anchor;
    if (!a?.isConnected || this.boot) return;
    if (this.canvas.parentElement !== a.parentElement) a.after(this.canvas);
    this.canvas.style.display = '';
    a.classList.add('mindon');
    const w = a.offsetWidth;
    const h = a.offsetHeight;
    this.canvas.style.left = `${a.offsetLeft}px`;
    this.canvas.style.top = `${a.offsetTop}px`;
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.size(w, h);
  }

  /** Draw at `w` × `h` CSS pixels (the hero's box, or the boot's larger one of the same shape). */
  private size(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    if (!w || !h) return;
    this.renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    this.renderer.setSize(w, h, false);
    // The sphere fills about as much of the box as the 2-D reactor's housing did.
    const aspect = w / h;
    const fill = 0.74;
    this.camera.aspect = aspect;
    this.camZ = 1 / (Math.tan((15 * Math.PI) / 180) * fill * Math.min(1, aspect));
    this.camera.position.set(0, 0, this.camZ);
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  /** The accent from the theme's tokens, and its tints: pale (the crisp rim, the listening ring), soft (the
   *  equator and its ticks), and the near-white the unlit nodes and links are drawn in, faintly tinted. */
  private colours(): void {
    const T = this.T;
    const a = accentTokens();
    const c = new T.Color(a.c);
    const pale = new T.Color(a.pale);
    heroState.accent = a.c;
    this.col = { c, pale, soft: c.clone().lerp(pale, 0.55), dimLink: c.clone().lerp(new T.Color(0xd2dbe1), 0.6), dimNode: c.clone().lerp(new T.Color(0xe8ecef), 0.85) };
  }

  // ---------------------------------------------------------------- the scene
  private build(T: Any): void {
    this.T = T;
    this.colours();
    const r = new T.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: 'low-power' });
    r.setClearColor(0x000000, 0);
    r.toneMapping = T.NeutralToneMapping ?? T.ACESFilmicToneMapping;
    r.outputColorSpace = T.SRGBColorSpace;
    this.renderer = r;
    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(30, 1, 0.1, 50);
    this.camera.position.set(0, 0, 5);
    this.root = new T.Group();
    this.spin = new T.Group();
    this.root.add(this.spin);
    this.scene.add(this.root);
    this.root.scale.setScalar(0.9);
    const P = this.parts;

    // the sphere: a crisp rim, a softer one, a faint inner haze, faint meridians, the equator scale, a tilted ring
    P.rimSoft = new T.Mesh(new T.SphereGeometry(1, 96, 64), this.fresnel(CYAN, 2.4, 0.5, T.DoubleSide));
    P.rimCrisp = new T.Mesh(new T.SphereGeometry(1.002, 96, 64), this.fresnel(PALE, 7, 0.95, T.FrontSide));
    P.haze = new T.Mesh(new T.SphereGeometry(0.96, 48, 32), this.haze());
    this.root.add(P.haze, P.rimSoft, P.rimCrisp);
    const lineMat = (P.lineMat = new T.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.05, blending: T.AdditiveBlending, depthWrite: false }));
    const circle = (rad: number, n = 128) => new T.BufferGeometry().setFromPoints(Array.from({ length: n + 1 }, (_, i) => new T.Vector3(Math.cos((i / n) * Math.PI * 2) * rad, Math.sin((i / n) * Math.PI * 2) * rad, 0)));
    // the meridians: one material each (the same look as the latitudes' on Home), so the boot can light them in turn
    P.merMats = [];
    for (let i = 0; i < MERIDIANS; i++) {
      const mat = lineMat.clone();
      P.merMats.push(mat);
      const m = new T.Line(circle(1), mat);
      m.rotation.y = (i / MERIDIANS) * Math.PI;
      this.spin.add(m);
    }
    for (const lat of [-0.62, -0.31, 0.31, 0.62]) {
      const m = new T.Line(circle(Math.cos(lat)), lineMat);
      m.rotation.x = Math.PI / 2;
      m.position.y = Math.sin(lat);
      this.spin.add(m);
    }
    P.lineMat = lineMat;
    const eq = new T.Group();
    P.eqMat = new T.MeshBasicMaterial({ color: 0x9fe4ff, transparent: true, opacity: 0.7, blending: T.AdditiveBlending, depthWrite: false });
    eq.add(new T.Mesh(new T.TorusGeometry(1.06, 0.004, 6, 200), P.eqMat));
    const tp: Any[] = [];
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * Math.PI * 2;
      const l = i % 10 === 0 ? 0.06 : 0.025;
      tp.push(new T.Vector3(Math.cos(a) * 1.06, Math.sin(a) * 1.06, 0), new T.Vector3(Math.cos(a) * (1.06 + l), Math.sin(a) * (1.06 + l), 0));
    }
    P.tickMat = new T.LineBasicMaterial({ color: 0x9fe4ff, transparent: true, opacity: 0.5, blending: T.AdditiveBlending, depthWrite: false });
    // the ticks in order round the ring from the front, so the boot can light them in turn (setDrawRange)
    P.tickGeo = new T.BufferGeometry().setFromPoints(tp);
    eq.add(new T.LineSegments(P.tickGeo, P.tickMat));
    eq.rotation.x = Math.PI / 2 - 0.42;
    this.root.add(eq);
    P.eq = eq;
    P.tilt = new T.Mesh(new T.TorusGeometry(1.13, 0.0025, 6, 200), new T.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.32, blending: T.AdditiveBlending, depthWrite: false }));
    P.tilt.rotation.set(1.15, 0.5, 0);
    this.root.add(P.tilt);
    // listening: a soft ring that grows with his voice
    P.ear = new T.Mesh(new T.TorusGeometry(1.0, 0.006, 8, 200), new T.MeshBasicMaterial({ color: PALE, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
    this.root.add(P.ear);
    // the boot's thin sweep of light, passing once down through the constellation (hidden otherwise)
    P.sweep = new T.Mesh(new T.TorusGeometry(1, 0.005, 6, 160), new T.MeshBasicMaterial({ color: PALE, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
    P.sweep.rotation.x = Math.PI / 2;
    P.sweep.visible = false;
    this.spin.add(P.sweep);
    // its refraction at the equator: a second ring, bent a few degrees, that parts from it below; and a flare along the
    // equator as it crosses (a glow stretched thin)
    P.sweep2 = new T.Mesh(new T.TorusGeometry(1, 0.004, 6, 160), new T.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
    P.sweep2.rotation.set(Math.PI / 2 + 0.16, 0, 0.05);
    P.sweep2.visible = false;
    this.spin.add(P.sweep2);
    P.flare = this.glow(PALE, 1, 0);
    P.flare.scale.set(2.5, 0.07, 1);
    P.flare.visible = false;
    this.root.add(P.flare);

    // the nucleus and its light
    P.nucleus = new T.Mesh(new T.SphereGeometry(0.06, 32, 16), new T.MeshBasicMaterial({ color: 0xffffff }));
    this.spin.add(P.nucleus);
    P.h1 = this.glow(0xffffff, 0.3, 0.85);
    P.h2 = this.glow(CYAN, 0.95, 0.45);
    P.h3 = this.glow(CYAN, 2.8, 0.12);
    this.root.add(P.h3, P.h2, P.h1);
  }

  private glowTexture(): Any {
    if (this.glowTex) return this.glowTex;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.18, 'rgba(255,255,255,0.75)');
    grd.addColorStop(0.42, 'rgba(255,255,255,0.22)');
    grd.addColorStop(0.7, 'rgba(255,255,255,0.05)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    this.glowTex = new this.T.CanvasTexture(c);
    this.glowTex.colorSpace = this.T.SRGBColorSpace;
    return this.glowTex;
  }

  private glow(color: number, size: number, opacity: number): Any {
    const T = this.T;
    const s = new T.Sprite(new T.SpriteMaterial({ map: this.glowTexture(), color, transparent: true, opacity, blending: T.AdditiveBlending, depthWrite: false, depthTest: false }));
    s.scale.setScalar(size);
    return s;
  }

  /** A view-dependent rim light (Fresnel): what makes the shell read as a solid volume of light. */
  private fresnel(color: number, power: number, strength: number, side: number): Any {
    const T = this.T;
    return new T.ShaderMaterial({
      uniforms: { uColor: { value: new T.Color(color) }, uPower: { value: power }, uStrength: { value: strength } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 uColor; uniform float uPower; uniform float uStrength; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPower); float a = clamp(f * uStrength, 0.0, 1.0); gl_FragColor = vec4(uColor * a, a); }',
      transparent: true,
      blending: T.AdditiveBlending,
      depthWrite: false,
      side,
    });
  }

  /** The faint haze inside the sphere: brightest towards the middle, gone at the rim. */
  private haze(): Any {
    const T = this.T;
    return new T.ShaderMaterial({
      uniforms: { uColor: { value: new T.Color(CYAN) }, uStrength: { value: 0.07 } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 uColor; uniform float uStrength; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 2.0); float a = f * uStrength; gl_FragColor = vec4(uColor * a, a); }',
      transparent: true,
      blending: T.AdditiveBlending,
      depthWrite: false,
      side: T.BackSide,
    });
  }

  /** The constellation: one cluster per field round a shell inside the sphere, nodes and their links and pulses. */
  private buildStars(fields: { name: string; nodes: number; lit: number }[]): void {
    const T = this.T;
    if (this.stars) {
      this.spin.remove(this.stars);
      this.stars.traverse((o: Any) => {
        o.geometry?.dispose?.();
        o.material?.dispose?.();
      });
    }
    const g = new T.Group();
    this.stars = g;
    this.spin.add(g);
    this.pulses = [];
    this.links = [];
    const n = fields.length;
    if (!n) return;
    const rand = rng(42 + n);
    const gauss = () => {
      let u = 0;
      let v = 0;
      while (!u) u = rand();
      while (!v) v = rand();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    // field hubs, evenly round a shell (a Fibonacci sphere); one field sits at the middle
    const shell = n === 1 ? 0 : n < 6 ? 0.56 : 0.64;
    const hubs = fields.map((_, i) => {
      if (n === 1) return new T.Vector3(0, 0, 0);
      const y = 1 - ((i + 0.5) * 2) / n;
      const rr = Math.sqrt(1 - y * y);
      const th = i * Math.PI * (3 - Math.sqrt(5));
      return new T.Vector3(Math.cos(th) * rr, y, Math.sin(th) * rr).multiplyScalar(shell);
    });
    const nodes: { p: Any; f: number; lit: boolean }[] = [];
    fields.forEach((f, i) => {
      const sigma = n === 1 ? 0.3 : Math.min(0.1, 0.03 + 0.012 * Math.sqrt(f.nodes));
      for (let j = 0; j < f.nodes; j++) {
        const p = hubs[i].clone().add(new T.Vector3(gauss(), gauss(), gauss()).multiplyScalar(sigma));
        if (p.length() > 0.9) p.multiplyScalar(0.9 / p.length());
        nodes.push({ p, f: i, lit: j < f.lit });
      }
    });
    // each field's soft glow, so the constellation reads as organised
    fields.forEach((f, i) => {
      const s = this.glow(f.lit ? CYAN : 0xcfe3ec, 0.22 + 0.06 * Math.sqrt(f.nodes), f.lit ? 0.24 : 0.09);
      s.position.copy(hubs[i]);
      s.userData.base = s.material.opacity;
      s.userData.lit = !!f.lit;
      g.add(s);
    });
    const pts = (list: { p: Any }[], size: number, color: number, opacity: number) => {
      const m = new T.PointsMaterial({ map: this.glowTexture(), color, size, sizeAttenuation: true, transparent: true, opacity, blending: T.AdditiveBlending, depthWrite: false });
      const o = new T.Points(new T.BufferGeometry().setFromPoints(list.map((x) => x.p)), m);
      // where each node lives, kept for the boot's drift in from the point of light
      o.userData.home = Float32Array.from(o.geometry.attributes.position.array as Float32Array);
      o.userData.at = 1;
      g.add(o);
      return o;
    };
    const lit = nodes.filter((x) => x.lit);
    const dim = nodes.filter((x) => !x.lit);
    this.parts.dim = pts(dim, 0.085, 0xcfe3ec, 0.5);
    this.parts.halo = pts(lit, 0.3, CYAN, 0.16);
    this.parts.lit = pts(lit, 0.15, CYAN, 0.95);
    this.parts.litCore = pts(lit, 0.05, 0xffffff, 1);
    // the boot's trails: two short segments behind each node as it gathers (tail dark, head bright: with additive light,
    // a streak that fades), drawn only while the boot gathers them
    {
      const all = [...lit, ...dim];
      const home = Float32Array.from(all.flatMap((x) => [x.p.x, x.p.y, x.p.z]));
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.BufferAttribute(new Float32Array(all.length * 12), 3));
      const col = new Float32Array(all.length * 12);
      all.forEach((x, j) => {
        const v = x.lit ? 1 : 0.45;
        // tail, mid | mid, head
        [0, 0.35 * v, 0.35 * v, v].forEach((c, q) => col.set([c, c, c], j * 12 + q * 3));
      });
      geo.setAttribute('color', new T.BufferAttribute(col, 3));
      const m = new T.LineBasicMaterial({ color: CYAN, vertexColors: true, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false });
      const tr = new T.LineSegments(geo, m);
      tr.userData.home = home;
      tr.visible = false;
      tr.frustumCulled = false;
      g.add(tr);
      this.parts.trails = tr;
    }
    // links: each node to its two nearest in its field; each field to its two nearest fields and to the nucleus
    const near = (a: Any, list: Any[], k: number) => list.filter((b) => b !== a).sort((x, y) => x.distanceTo(a) - y.distanceTo(a)).slice(0, k);
    const segDim: Any[] = [];
    const segLit: Any[] = [];
    fields.forEach((_, i) => {
      const mine = nodes.filter((x) => x.f === i);
      for (const a of mine)
        for (const bp of near(a.p, mine.map((x) => x.p), 2)) {
          const b = mine.find((x) => x.p === bp)!;
          const bright = a.lit || b.lit;
          (bright ? segLit : segDim).push(a.p, b.p);
          this.links.push([a.p, b.p, bright]);
        }
      if (n > 1) {
        for (const hb of near(hubs[i], hubs, 2)) {
          segDim.push(hubs[i], hb);
          this.links.push([hubs[i], hb, false]);
        }
        const z = new T.Vector3();
        (fields[i]!.lit ? segLit : segDim).push(z, hubs[i]);
        this.links.push([z, hubs[i], !!fields[i]!.lit]);
      }
    });
    const lm = (color: number, opacity: number, list: Any[]) => {
      const m = new T.LineBasicMaterial({ color, transparent: true, opacity, blending: T.AdditiveBlending, depthWrite: false });
      g.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(list), m));
      return m;
    };
    this.parts.linkDim = lm(0x9fd8ee, 0.12, segDim);
    this.parts.linkLit = lm(CYAN, 0.38, segLit);
    // pulses: a pool; how many travel, and how fast, depends on the state
    const pool = this.links.filter((l) => l[2]).length ? this.links.filter((l) => l[2]) : this.links;
    for (let i = 0; i < 36 && pool.length; i++) {
      const s = this.glow(0xffffff, 0.08, 0);
      const l = pool[Math.floor(rand() * pool.length)]!;
      this.pulses.push({ s, link: [l[0], l[1]], off: rand(), sp: 0.6 + rand() * 0.8 });
      g.add(s);
    }
  }

  private draw(t: number): void {
    const T = this.T;
    const P = this.parts;
    const p = this.p;
    const breath = 1 + 0.06 * Math.sin(t * 1.6) + 0.25 * this.kick;
    // the boot cinematic's look for this frame (Home's whole Mind otherwise)
    const b = this.boot ?? BOOT_DONE;
    if (this.boot) this.gatherAt(b.gather);
    this.camera.position.z = this.camZ * b.push;
    // offline: everything drifts to grey
    const C = this.col;
    const tint = (c: Any) => (typeof c === 'number' ? new T.Color(c) : c.clone()).lerp(new T.Color(GREY), p.grey);
    this.spin.rotation.y = t * p.spin + b.turn;
    this.spin.rotation.x = 0.28;
    this.root.rotation.z = 0.08;
    P.eq.rotation.z = -t * 0.04;
    P.tilt.rotation.z = t * 0.03;
    this.spin.scale.setScalar(1 + 0.08 * p.open);
    P.rimSoft.material.uniforms.uStrength.value = 0.5 * p.rim * breath * b.sphere * b.rim;
    P.rimSoft.material.uniforms.uColor.value.copy(tint(C.c));
    P.rimCrisp.material.uniforms.uStrength.value = 0.9 * Math.min(1.4, p.rim) * b.sphere * b.rim;
    P.haze.material.uniforms.uStrength.value = 0.07 * b.sphere * b.haze;
    P.lineMat.opacity = 0.05 * b.sphere;
    // the meridians light one after another, each catching the light as it comes (Home: all at the latitudes' 0.05)
    P.merMats.forEach((m: Any, i: number) => {
      const x = b.mer * (MERIDIANS + 1) - i;
      const lit = x <= 0 ? 0 : x >= 1 ? 1 : x;
      const caught = x > 0 && x < 1.6 ? Math.sin((Math.PI * x) / 1.6) : 0;
      m.opacity = 0.05 * b.sphere * lit + 0.34 * caught;
      m.color.copy(tint(C.c)).lerp(tint(C.pale), Math.min(1, caught));
    });
    P.tilt.material.opacity = 0.32 * b.sphere;
    // the equator scale lights round from the front; its ring follows the first ticks
    P.eqMat.opacity = 0.7 * Math.min(1, b.scale * 2);
    if (this.boot) P.tickGeo.setDrawRange(0, 2 * Math.round(120 * b.scale));
    // the sweep: a thin ring of light at its height through the sphere
    P.sweep.visible = Number.isFinite(b.sweep) && Math.abs(b.sweep) < 1;
    if (P.sweep.visible) {
      P.sweep.position.y = b.sweep;
      // as wide as the constellation it passes through (it has not settled yet), brightest through the middle
      P.sweep.scale.setScalar(Math.sqrt(1 - b.sweep * b.sweep) * (0.45 + 0.4 * b.gather));
      P.sweep.material.opacity = 0.7 * (1 - Math.abs(b.sweep));
      P.sweep.material.color.copy(tint(C.pale));
    }
    // its refraction at the equator: a flare along it as it crosses, then a second ring, bent, parting from it below
    const flare = Number.isFinite(b.sweep) ? b.refract * Math.max(0, 1 - Math.abs(b.sweep) / 0.16) : 0;
    P.flare.visible = flare > 0.01;
    if (P.flare.visible) {
      P.flare.material.opacity = 0.85 * flare;
      P.flare.material.color.copy(tint(C.pale));
      P.sweep.material.opacity *= 1 + 0.9 * flare;
    }
    const y2 = Number.isFinite(b.sweep) && b.sweep < 0 ? b.sweep * 1.22 : NaN;
    P.sweep2.visible = b.refract > 0 && Number.isFinite(y2) && y2 > -1;
    if (P.sweep2.visible) {
      P.sweep2.position.y = y2;
      P.sweep2.scale.setScalar(Math.sqrt(1 - y2 * y2) * (0.45 + 0.4 * b.gather));
      P.sweep2.material.opacity = b.refract * 0.42 * (1 - Math.abs(y2)) * Math.min(1, -b.sweep / 0.12);
      P.sweep2.material.color.copy(tint(C.c));
    }
    if (P.trails?.visible) {
      P.trails.material.opacity = 0.5 * b.trails;
      P.trails.material.color.copy(tint(C.c));
    }
    P.rimCrisp.material.uniforms.uColor.value.copy(tint(C.pale));
    P.haze.material.uniforms.uColor.value.copy(tint(C.c));
    P.eqMat.color.copy(tint(C.soft));
    P.tickMat.color.copy(tint(C.soft));
    P.ear.material.color.copy(tint(C.pale));
    P.tilt.material.color.copy(tint(C.c));
    P.lineMat.color.copy(tint(C.c));
    // the listening ring grows with his voice
    const lv = this.st === 'listening' ? Math.min(1, this.level * 1.6) : 0;
    P.ear.scale.setScalar(1.02 + 0.22 * lv + 0.04 * p.open * Math.sin(t * 2.4));
    P.ear.material.opacity = 0.5 * p.open * (0.4 + 0.6 * lv);
    // the core: brighter with a soft halo and a slow breath
    P.h1.scale.setScalar(0.3 * (1 + 0.6 * p.open) * breath);
    P.h2.scale.setScalar(0.95 * (1 + 0.3 * p.open) * breath);
    P.h1.material.color.copy(tint(0xffffff));
    P.h2.material.color.copy(tint(C.c));
    P.h3.material.color.copy(tint(C.c));
    P.h1.material.opacity = 0.85 * b.core;
    P.h2.material.opacity = 0.45 * p.bright * b.core;
    P.h3.material.opacity = 0.12 * p.bright * Math.max(b.sphere, 0.4 * b.core);
    P.nucleus.visible = b.core > 0.02;
    P.nucleus.material.color.copy(tint(0xffffff));
    // nodes: lit ones brighter; studying or training, a steady slow pulse
    const beat = p.busy ? 1 + 0.35 * p.busy * Math.sin(t * 2.2) : 1;
    // the particles show from the moment they leave the point; the links as they settle
    const seen = Math.min(1, b.gather * 4);
    if (P.lit) {
      P.lit.material.size = 0.15 * (1 + 0.2 * p.open) * beat;
      P.lit.material.opacity = Math.min(1, 0.85 * p.bright) * seen;
      P.lit.material.color.copy(tint(C.c));
      P.litCore.material.opacity = seen;
      P.halo.material.opacity = 0.16 * p.bright * beat * seen;
      P.halo.material.color.copy(tint(C.c));
      P.linkLit.opacity = 0.34 * p.bright * b.links;
      P.linkLit.color.copy(tint(C.c));
      P.dim.material.opacity = 0.5 * (1 - 0.3 * p.grey) * seen;
      P.dim.material.color.copy(tint(C.dimNode));
      if (P.linkDim) {
        P.linkDim.color.copy(tint(C.dimLink));
        P.linkDim.opacity = 0.12 * b.links;
      }
    }
    for (const c of this.stars?.children ?? []) {
      if (c.isSprite && c.userData.base !== undefined) {
        c.material.opacity = c.userData.base * (c.userData.lit ? p.bright * beat : 1) * b.links;
        c.material.color.copy(tint(c.userData.lit ? C.c : C.dimNode));
      }
    }
    // pulses along the links: a few slow ones always, many fast ones while he thinks
    const shown = Math.round(p.pulses);
    this.pulses.forEach((q, i) => {
      const f = (q.off + t * q.sp * p.pace) % 1;
      q.s.position.copy(q.link[0]).lerp(q.link[1], f);
      q.s.material.opacity = i < shown ? Math.sin(f * Math.PI) * (1 - p.grey) * b.links : 0;
      q.s.material.color.copy(tint(C.pale));
    });
    const t0 = performance.now();
    this.renderer.render(this.scene, this.camera);
    const ms = performance.now() - t0;
    heroState.frames++;
    heroState.frameMs = heroState.frameMs ? heroState.frameMs * 0.9 + ms * 0.1 : ms;
  }

  dispose(): void {
    this.active = false;
    this.io?.disconnect();
    this.canvas.remove();
    this.anchor?.classList.remove('mindon');
    try {
      this.renderer?.dispose();
      this.renderer?.forceContextLoss?.();
    } catch {
      /* nothing to free */
    }
    this.renderer = null;
  }
}

/** The state object sits on the console/test handle (window.__ghosty.hero); main.ts makes __ghosty after the first tab opens, so this retries. */
export function exposeHero(): void {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  const attach = () => !!w.__ghosty && ((w.__ghosty.hero = heroState), true);
  if (attach()) return;
  let n = 0;
  const timer = window.setInterval(() => {
    if (attach() || ++n > 40) clearInterval(timer);
  }, 500);
}
