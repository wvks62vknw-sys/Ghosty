/**
 * The power core on the Core tab — Ghosty's heart. An original design built to feel alive:
 *
 *   plasma     a white-hot centre with turbulent filaments that never repeat, and energy
 *              arcs that crawl between the inner ring and the core and flicker out
 *   heartbeat  a lub-dub pulse whose rate rises with Ghosty's state (idle → thinking →
 *              speaking) and whose strength follows your voice
 *   cells      ten glowing segments around the core, charged in turn, light spilling out
 *   gyros      two rings turning in depth around the housing (pseudo-3D ellipses)
 *   sparks     motes thrown off the core when energy spikes
 *   housing    dark gunmetal with a machined bevel and the clock tracks, drawn once
 *
 * Public shape is unchanged: el, state, level, spectrum, frame(dt).
 *
 * It is drawn as a real object: a brushed, chamfered housing lit from above with a contact shadow,
 * coils wound over the glowing cells, a polished collar, a glass dome over the core, a softer bloom, and the clock as two Activity-style
 * rings (hour, minute) instead of the instrument scale. Housing, coils and glass are painted once
 * per size and theme; a frame is a few dozen fills and strokes, cheap on an iPhone 13.
 */
import { gfx } from '../../engine/gfx';
import type { VoiceState } from '../../state/app';
import { exposeHero, heroState, mindFor, type Mind } from './mind';
import { drawFlatMind } from '../../tv/flatmind'; // [restc] MIND drawn flat where it cannot run, not the old arc reactor

const TAU = Math.PI * 2;
/** The canvas spans ±PX housing radii. */
const PX = 1.24;
type C2D = CanvasRenderingContext2D;
const rgba = (c: number[], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a))})`;
const to255 = (v: ArrayLike<number>) => [Math.round(v[0]! * 255), Math.round(v[1]! * 255), Math.round(v[2]! * 255)];
const mix = (a: number[], b: number[], k: number) => a.map((v, i) => Math.round(v + (b[i]! - v) * k));

interface Spark {
  a: number;
  r: number;
  v: number;
  life: number;
  max: number;
  s: number;
}
interface Arc {
  a0: number;
  a1: number;
  life: number;
  max: number;
  seed: number;
}

export class Reactor {
  readonly el: HTMLCanvasElement;
  state: VoiceState = 'idle';
  /** 0..1 loudness (mic or voice output). */
  level = 0;
  /** Optional frequency data (0..255) driving the spectrum ring. */
  spectrum: Uint8Array | null = null;
  private ctx: C2D;
  private t = 0;
  private energy = 0;
  private lv = 0;
  private beat = 0;
  private beatPhase = 0;
  private spec = new Float32Array(96);
  private sparks: Spark[] = [];
  private arcs: Arc[] = [];
  private size = 0;
  private dpr = 1;
  private seed = Math.random() * 1000;
  /** The layers, painted once per size/theme: housing under the cells, coils + collar over them, glass on top. */
  private proUnder = document.createElement('canvas');
  private proOver = document.createElement('canvas');
  private proGlass = document.createElement('canvas');
  private proKey = '';
  /** A touch: 1 at the tap, fading (a tap is answered with a pulse and a ripple). */
  private kick = 0;
  private lastGlow = 0.5;
  /** Home's centrepiece (mind.ts): a 3-D hologram of his mind over this canvas once three.js is in. */
  private mind: Mind | null = null;
  private mindTried = false;

  /** Half the drawing's span in housing radii (the HUD rings around it scale by this). */
  extent(): number {
    return PX;
  }

  /** How bright the core is right now, 0..1.5 (tints the glass around it). */
  light(): number {
    return this.lastGlow;
  }

  /** The owner touched the reactor: a pulse, a ripple and a few motes. */
  poke(_e?: PointerEvent): void {
    this.mind?.poke();
    this.kick = 1;
    for (let i = 0; i < 14; i++) this.sparks.push({ a: Math.random() * TAU, r: 0.32, v: 0.4 + Math.random() * 0.5, life: 0, max: 0.6 + Math.random() * 0.6, s: 0.006 + Math.random() * 0.008 });
  }

  constructor() {
    this.el = document.createElement('canvas');
    this.el.className = 'reactor';
    this.ctx = this.el.getContext('2d')!;
  }

  private resize(): void {
    const r = this.el.getBoundingClientRect();
    const size = Math.max(120, Math.min(r.width, r.height));
    this.dpr = Math.min(2, devicePixelRatio || 1) * (gfx.scale < 0.8 ? 0.75 : 1);
    if (Math.abs(size - this.size) < 1 && this.el.width === Math.round(r.width * this.dpr)) return;
    this.size = size;
    this.el.width = Math.round(r.width * this.dpr);
    this.el.height = Math.round(r.height * this.dpr);
    this.proKey = '';
  }

  private noise(a: number, b: number): number {
    const s = this.seed;
    return 0.5 + 0.5 * (Math.sin(a * 1.7 + b * 0.9 + s) * 0.5 + Math.sin(a * 3.1 - b * 1.3 + s * 2) * 0.3 + Math.sin(a * 5.3 + b * 2.1 - s) * 0.2);
  }

  frame(dt: number): void {
    if (!this.el.isConnected) return;
    // MIND draws instead (the first frame on Home loads it, or takes the one the boot cinematic woke: shell/boot.ts);
    // if it cannot run, this reactor stays.
    if (!this.mindTried) {
      this.mindTried = true;
      exposeHero();
      const m = mindFor(this.el);
      this.mind = m;
      void m.start().then((ok) => {
        if (!ok && this.mind === m) this.mind = null;
      });
    }
    if (this.mind?.active) {
      this.mind.frame(dt, this.state, this.level);
      this.lastGlow = this.mind.light();
      return;
    }
    // [restc] MIND said why it could not run here (no WebGL, three.js refused: the PS5's browser): its flat self, not the
    // old arc reactor (tv/flatmind.ts). A check passing through Home keeps the stand-in below (its reason says automation).
    if (heroState.mode === '2d' && heroState.reason && !heroState.reason.startsWith('automation')) {
      this.t += dt;
      drawFlatMind(this.el, this.ctx, this.t, this.state, this.level);
      this.lastGlow = 0.6;
      return;
    }
    this.resize();
    this.t += dt;
    const t = this.t;
    const st = this.state;
    const target = st === 'speaking' ? 0.8 : st === 'listening' ? 0.4 : st === 'thinking' ? 0.55 : 0.08;
    this.energy += (target - this.energy) * Math.min(1, dt * 3);
    this.lv += (this.level - this.lv) * Math.min(1, dt * 14);
    const E = this.energy;
    // heartbeat: lub-dub, 54 bpm idle rising to ~120 when speaking
    const bpm = 54 + E * 70;
    this.beatPhase = (this.beatPhase + (dt * bpm) / 60) % 1;
    const p = this.beatPhase;
    const lub = Math.exp(-Math.pow((p - 0.05) / 0.06, 2));
    const dub = 0.6 * Math.exp(-Math.pow((p - 0.28) / 0.07, 2));
    this.beat = lub + dub;
    const glow = 0.55 + 0.45 * this.beat + this.lv * 0.8 + E * 0.25;
    const f = this.spectrum;
    for (let i = 0; i < 96; i++) {
      const v = f ? f[Math.floor((i / 96) * f.length * 0.6)]! / 255 : st === 'speaking' ? Math.max(0, 0.55 + 0.45 * Math.sin(t * 9 + i * 0.7) * Math.sin(t * 3.3 + i * 0.21)) * 0.9 : st === 'listening' ? 0.15 + 0.1 * Math.sin(t * 5 + i * 0.4) : 0.05 + 0.04 * Math.sin(t * 1.2 + i * 0.3);
      this.spec[i]! += (v - this.spec[i]!) * Math.min(1, dt * 18);
    }
    // sparks: thrown off on each beat, more with energy
    if (lub > 0.9 && this.sparks.length < 90) {
      const n = 2 + Math.round(E * 10 + this.lv * 8);
      for (let i = 0; i < n; i++) this.sparks.push({ a: Math.random() * TAU, r: 0.3, v: 0.25 + Math.random() * 0.45, life: 0, max: 0.7 + Math.random() * 0.9, s: 0.004 + Math.random() * 0.01 });
    }
    for (const s of this.sparks) {
      s.life += dt;
      s.r += s.v * dt * (0.4 + E);
      s.a += dt * 0.6;
    }
    this.sparks = this.sparks.filter((s) => s.life < s.max && s.r < 1.4);
    // energy arcs: short-lived filaments between the collar and the core
    if (Math.random() < dt * (1.5 + E * 9) && this.arcs.length < 7) {
      const a0 = Math.random() * TAU;
      this.arcs.push({ a0, a1: a0 + (Math.random() - 0.5) * 1.4, life: 0, max: 0.12 + Math.random() * 0.25, seed: Math.random() * 100 });
    }
    for (const a of this.arcs) a.life += dt;
    this.arcs = this.arcs.filter((a) => a.life < a.max);
    this.drawPro(glow, lub, dt);
  }
  /** Paint the static layers (housing radius 1, canvas ±PX). */
  private buildPro(): void {
    const S = Math.round(this.size * this.dpr);
    const th = to255(gfx.theme.c);
    const metal = ['#24282d', '#8b949d', '#15181b', '#59616a', '#0d0f11', '#a9b2ba', '#1d2125'];
    const wire = [58, 66, 76];
    const prep = (cv: HTMLCanvasElement) => {
      cv.width = cv.height = S;
      const x = cv.getContext('2d')!;
      x.setTransform(S / 2 / PX, 0, 0, S / 2 / PX, S / 2, S / 2);
      return x;
    };
    const conic = (x: C2D, off: number, cols: string[]) => {
      const c = x as C2D & { createConicGradient?: (a: number, cx: number, cy: number) => CanvasGradient };
      const g = c.createConicGradient ? c.createConicGradient(off, 0, 0) : x.createLinearGradient(-1, -1, 1, 1);
      cols.forEach((col, i) => g.addColorStop(i / cols.length, col));
      g.addColorStop(1, cols[0]!);
      return g;
    };
    const ring = (x: C2D, r0: number, r1: number) => {
      x.beginPath();
      x.arc(0, 0, r1, 0, TAU);
      x.arc(0, 0, r0, 0, TAU, true);
    };
    /** A rim lit from above: bright at the top, gone at the bottom (or the reverse for an inner edge). */
    const rim = (x: C2D, r: number, w: number, a: number, fromTop = true) => {
      const g = x.createLinearGradient(0, -r, 0, r);
      g.addColorStop(0, `rgba(255,255,255,${fromTop ? a : 0})`);
      g.addColorStop(0.5, `rgba(255,255,255,${a * 0.15})`);
      g.addColorStop(1, `rgba(255,255,255,${fromTop ? 0 : a})`);
      x.strokeStyle = g;
      x.lineWidth = w;
      x.beginPath();
      x.arc(0, 0, r, 0, TAU);
      x.stroke();
    };

    // ---- under: contact shadow, housing, the well
    let x = prep(this.proUnder);
    let g = x.createRadialGradient(0, 0.07, 0.75, 0, 0.07, 1.32);
    g.addColorStop(0, 'rgba(0,0,0,.65)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(-PX, -PX, 2 * PX, 2 * PX);
    ring(x, 0.84, 1);
    x.fillStyle = conic(x, -1.9, metal);
    x.fill();
    // brushed: fine concentric grain
    const rnd = (i: number) => (Math.sin(i * 12.9898 + 4.1) * 43758.5453) % 1;
    for (let i = 0; i < 46; i++) {
      const r = 0.845 + (i / 46) * 0.15;
      x.strokeStyle = rnd(i) > 0 ? `rgba(255,255,255,${0.015 + Math.abs(rnd(i)) * 0.04})` : `rgba(0,0,0,${0.05 + Math.abs(rnd(i)) * 0.08})`;
      x.lineWidth = 0.002;
      x.beginPath();
      x.arc(0, 0, r, 0, TAU);
      x.stroke();
    }
    // a soft top-light falloff over the whole ring
    g = x.createLinearGradient(0, -1, 0, 1);
    g.addColorStop(0, 'rgba(255,255,255,.10)');
    g.addColorStop(0.55, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,.28)');
    ring(x, 0.84, 1);
    x.fillStyle = g;
    x.fill();
    // a machined groove, then the chamfered edges
    x.strokeStyle = 'rgba(0,0,0,.55)';
    x.lineWidth = 0.008;
    x.beginPath();
    x.arc(0, 0, 0.925, 0, TAU);
    x.stroke();
    rim(x, 0.93, 0.004, 0.22, false);
    rim(x, 0.996, 0.008, 0.55);
    rim(x, 0.845, 0.008, 0.4, false);
    // six bolts, lit from above
    for (let i = 0; i < 6; i++) {
      const a = ((i + 0.5) / 6) * TAU;
      const bx = Math.cos(a) * 0.962;
      const by = Math.sin(a) * 0.962;
      g = x.createRadialGradient(bx, by - 0.01, 0.002, bx, by, 0.022);
      g.addColorStop(0, '#e4eaf0');
      g.addColorStop(0.6, '#5d6770');
      g.addColorStop(1, '#0b0c0d');
      x.fillStyle = g;
      x.beginPath();
      x.arc(bx, by, 0.02, 0, TAU);
      x.fill();
    }
    // the well behind the cells: deep, with an inner shadow under the housing's lip
    g = x.createRadialGradient(0, 0, 0.44, 0, 0, 0.84);
    g.addColorStop(0, '#04070a');
    g.addColorStop(0.85, '#080b0e');
    g.addColorStop(1, '#000');
    x.fillStyle = g;
    x.beginPath();
    x.arc(0, 0, 0.84, 0, TAU);
    x.fill();

    // ---- over: coils wound over each cell, the struts between them, the collar
    x = prep(this.proOver);
    for (let i = 0; i < 10; i++) {
      const c0 = (i / 10) * TAU + 0.075;
      const c1 = ((i + 1) / 10) * TAU - 0.075;
      const lit = 0.5 + 0.5 * Math.cos((c0 + c1) / 2 + Math.PI / 2); // cells at the top catch more light
      for (let r = 0.505; r < 0.79; r += 0.0105) {
        x.strokeStyle = rgba(wire, 0.62 + lit * 0.12);
        x.lineWidth = 0.0058;
        x.beginPath();
        x.arc(0, 0, r, c0, c1);
        x.stroke();
        // each turn of wire catches the cell's light along its top edge
        x.strokeStyle = rgba(mix(wire, [255, 255, 255], 0.55), 0.16 + lit * 0.14);
        x.lineWidth = 0.0018;
        x.beginPath();
        x.arc(0, 0, r - 0.0018, c0 + 0.01, c1 - 0.01);
        x.stroke();
      }
    }
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      const cs = Math.cos(a);
      const sn = Math.sin(a);
      x.strokeStyle = metal[6]!;
      x.lineWidth = 0.05;
      x.beginPath();
      x.moveTo(cs * 0.47, sn * 0.47);
      x.lineTo(cs * 0.83, sn * 0.83);
      x.stroke();
      // the strut's lit edge
      const off = 0.022;
      x.strokeStyle = `rgba(255,255,255,${0.1 + 0.18 * Math.max(0, -Math.sin(a + 0.6))})`;
      x.lineWidth = 0.004;
      x.beginPath();
      x.moveTo(cs * 0.47 - sn * off, sn * 0.47 + cs * off);
      x.lineTo(cs * 0.83 - sn * off, sn * 0.83 + cs * off);
      x.stroke();
    }
    ring(x, 0.355, 0.47);
    x.fillStyle = conic(x, -0.6, [metal[5]!, metal[2]!, metal[3]!, metal[4]!, metal[1]!, metal[2]!]);
    x.fill();
    g = x.createLinearGradient(0, -0.47, 0, 0.47);
    g.addColorStop(0, 'rgba(255,255,255,.12)');
    g.addColorStop(1, 'rgba(0,0,0,.35)');
    ring(x, 0.355, 0.47);
    x.fillStyle = g;
    x.fill();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      x.strokeStyle = i % 6 === 0 ? rgba(th, 0.75) : 'rgba(0,0,0,.45)';
      x.lineWidth = i % 6 === 0 ? 0.008 : 0.004;
      x.beginPath();
      x.moveTo(Math.cos(a) * 0.395, Math.sin(a) * 0.395);
      x.lineTo(Math.cos(a) * 0.43, Math.sin(a) * 0.43);
      x.stroke();
    }
    rim(x, 0.468, 0.006, 0.6);
    rim(x, 0.358, 0.006, 0.45, false);

    // ---- glass: a dome over the core and a faint sheen across the whole face
    x = prep(this.proGlass);
    x.save();
    x.beginPath();
    x.arc(0, 0, 0.35, 0, TAU);
    x.clip();
    g = x.createRadialGradient(-0.1, -0.2, 0.01, -0.06, -0.12, 0.3);
    g.addColorStop(0, 'rgba(255,255,255,.45)');
    g.addColorStop(0.4, 'rgba(255,255,255,.1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.beginPath();
    x.ellipse(-0.06, -0.15, 0.24, 0.15, -0.35, 0, TAU);
    x.fill();
    x.restore();
    rim(x, 0.352, 0.01, 0.35);
    x.save();
    x.beginPath();
    x.arc(0, 0, 1, 0, TAU);
    x.clip();
    g = x.createLinearGradient(-0.9, -1, 0.5, 0.6);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.42, 'rgba(255,255,255,.07)');
    g.addColorStop(0.5, 'rgba(255,255,255,.015)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(-1, -1, 2, 2);
    x.restore();
    this.proKey = `${S}|${th.join()}`;
  }

  /** One frame. */
  private drawPro(glow: number, lub: number, dt: number): void {
    const S0 = Math.round(this.size * this.dpr);
    if (this.proKey !== `${S0}|${to255(gfx.theme.c).join()}`) this.buildPro();
    const t = this.t;
    const st = this.state;
    const E = this.energy;
    const x = this.ctx;
    const W = this.el.width;
    const H = this.el.height;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, W, H);
    const S = this.proUnder.width;
    // States, as breathing: idle breathes slowly; listening follows the voice; thinking sends a light round
    // the collar; speaking pulses with the words (the whole reactor swells a little on each).
    let env = 0;
    for (let i = 0; i < 40; i++) env += this.spec[i]!;
    env /= 40;
    const breath = 0.5 + 0.5 * Math.sin((t * TAU) / 5.2);
    const swell = st === 'speaking' ? env * 0.03 : st === 'idle' ? breath * 0.006 : this.lv * 0.02;
    const sc = (S / 2 / PX) * (1 + swell);
    x.setTransform(sc, 0, 0, sc, W / 2, H / 2);
    if (st === 'idle') glow = 0.78 + 0.22 * breath + this.lv * 0.8;
    else if (st === 'speaking') glow = 0.8 + env * 0.9;
    const base = to255(gfx.theme.c);
    const th = st === 'thinking' ? to255(gfx.theme.a) : st === 'listening' ? mix(base, [120, 255, 200], 0.6) : base;
    const hot = mix(th, [255, 255, 255], 0.72);
    const ac = to255(gfx.theme.a);
    this.kick = Math.max(0, this.kick - dt * 1.6);
    const gl = Math.min(1.6, glow * 0.85 + 0.15) + this.kick * 0.7;
    this.lastGlow = gl;

    // ---- soft bloom into the room (wide, gentle falloffs instead of shockwave rings)
    x.globalCompositeOperation = 'lighter';
    let g = x.createRadialGradient(0, 0, 0.2, 0, 0, 1.45);
    g.addColorStop(0, rgba(th, 0.32 * gl));
    g.addColorStop(0.35, rgba(th, 0.11 * gl));
    g.addColorStop(0.7, rgba(th, 0.025 * gl));
    g.addColorStop(1, rgba(th, 0));
    x.fillStyle = g;
    x.fillRect(-1.45, -1.45, 2.9, 2.9);

    // ---- a touch's ripple, leaving the housing
    if (this.kick > 0.01) {
      const k = 1 - this.kick;
      x.strokeStyle = rgba(hot, this.kick * 0.5);
      x.lineWidth = 0.02 * this.kick + 0.003;
      x.beginPath();
      x.arc(0, 0, 1.0 + k * 0.26, 0, TAU);
      x.stroke();
    }

    // ---- housing
    x.globalCompositeOperation = 'source-over';
    x.drawImage(this.proUnder, -PX, -PX, 2 * PX, 2 * PX);

    // ---- cells: one gradient, each segment its own brightness as the charge goes round
    x.globalCompositeOperation = 'lighter';
    g = x.createRadialGradient(0, 0, 0.47, 0, 0, 0.82);
    g.addColorStop(0, rgba(hot, 0.95));
    g.addColorStop(0.2, rgba(th, 0.85));
    g.addColorStop(0.75, rgba(th, 0.38));
    g.addColorStop(1, rgba(th, 0.12));
    x.fillStyle = g;
    const charge = t * (0.22 + E * 1.4);
    for (let i = 0; i < 10; i++) {
      const a0 = (i / 10) * TAU + 0.03;
      const a1 = ((i + 1) / 10) * TAU - 0.03;
      const ph = (((charge - i / 10) % 1) + 1) % 1;
      const lit = 0.55 + 0.45 * Math.pow(0.5 + 0.5 * Math.cos(ph * TAU), 3);
      x.globalAlpha = Math.min(1, (0.42 + lit * 0.5) * gl);
      x.beginPath();
      x.arc(0, 0, 0.82, a0, a1);
      x.arc(0, 0, 0.47, a1, a0, true);
      x.closePath();
      x.fill();
    }
    x.globalAlpha = 1;

    // ---- coils, struts and collar over the light
    x.globalCompositeOperation = 'source-over';
    x.drawImage(this.proOver, -PX, -PX, 2 * PX, 2 * PX);
    x.globalCompositeOperation = 'lighter';
    // the cells' light glowing through and over the windings
    g = x.createRadialGradient(0, 0, 0.47, 0, 0, 0.84);
    g.addColorStop(0, rgba(hot, 0.5 * gl));
    g.addColorStop(0.3, rgba(th, 0.32 * gl));
    g.addColorStop(1, rgba(th, 0.04 * gl));
    x.fillStyle = g;
    x.beginPath();
    x.arc(0, 0, 0.83, 0, TAU);
    x.arc(0, 0, 0.47, 0, TAU, true);
    x.fill();
    // and spilling onto the collar
    g = x.createRadialGradient(0, 0, 0.44, 0, 0, 0.6);
    g.addColorStop(0, rgba(th, 0));
    g.addColorStop(0.3, rgba(th, 0.16 * gl));
    g.addColorStop(1, rgba(th, 0));
    x.fillStyle = g;
    x.beginPath();
    x.arc(0, 0, 0.6, 0, TAU);
    x.fill();

    // ---- spectrum: a fine crown inside the collar, bright only when there is a voice
    x.lineCap = 'round';
    const loud = st === 'listening' || st === 'speaking' || this.lv > 0.02;
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * TAU - t * 0.06;
      const v = this.spec[Math.floor((i / 72) * 96)]!;
      x.strokeStyle = rgba(hot, (loud ? 0.3 : 0.05) + v * (loud ? 0.6 : 0.3));
      x.lineWidth = 0.006;
      x.beginPath();
      x.moveTo(Math.cos(a) * 0.335, Math.sin(a) * 0.335);
      x.lineTo(Math.cos(a) * (0.345 + v * 0.05), Math.sin(a) * (0.345 + v * 0.05));
      x.stroke();
    }

    // ---- energy arcs (faint), only while he thinks or speaks
    for (const a of st === 'thinking' || st === 'speaking' ? this.arcs : []) {
      const k = 1 - a.life / a.max;
      const pts: [number, number][] = [];
      for (let i = 0; i <= 6; i++) {
        const q = i / 6;
        const ang = a.a0 + (a.a1 - a.a0) * q;
        const r = 0.33 - 0.16 * q + (this.noise(a.seed + i * 1.3, t * 9) - 0.5) * 0.05 * (i && i < 6 ? 1 : 0);
        pts.push([Math.cos(ang) * r, Math.sin(ang) * r]);
      }
      for (const [w, al] of [[0.02, 0.14], [0.006, 0.55]] as const) {
        x.strokeStyle = rgba(w > 0.01 ? th : hot, al * k);
        x.lineWidth = w;
        x.beginPath();
        pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
        x.stroke();
      }
    }

    // ---- thinking: a light running round the collar
    if (st === 'thinking') {
      const a0 = t * 2.4;
      for (let k = 0; k < 14; k++) {
        const q = k / 14;
        x.strokeStyle = rgba(k > 11 ? hot : th, (1 - q) * 0.5);
        x.lineWidth = 0.022 * (1 - q * 0.6);
        x.beginPath();
        x.arc(0, 0, 0.412, a0 - q * 1.3 - 0.09, a0 - q * 1.3);
        x.stroke();
      }
    }
    // ---- speaking: each word sends a soft ring out of the housing
    if (st === 'speaking' && env > 0.05) {
      x.strokeStyle = rgba(th, Math.min(0.35, env * 0.45));
      x.lineWidth = 0.012;
      x.beginPath();
      x.arc(0, 0, 1.02 + env * 0.1, 0, TAU);
      x.stroke();
    }

    // ---- the plasma core
    const R = 0.33 + this.beat * 0.008 + this.lv * 0.015;
    x.save();
    x.beginPath();
    x.arc(0, 0, R, 0, TAU);
    x.clip();
    g = x.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, rgba(hot, 0.95));
    g.addColorStop(0.5, rgba(th, 0.7 * gl));
    g.addColorStop(1, rgba(th, 0.16));
    x.fillStyle = g;
    x.fillRect(-R, -R, R * 2, R * 2);
    for (let k = 0; k < 6; k++) {
      const rr = 0.06 + (k / 6) * 0.22;
      x.strokeStyle = rgba(k % 2 ? hot : [255, 255, 255], (0.09 + 0.06 * Math.sin(t * 1.4 + k)) * gl);
      x.lineWidth = 0.012 - k * 0.0012;
      x.beginPath();
      for (let i = 0; i <= 36; i++) {
        const ang = (i / 36) * TAU + t * (k % 2 ? 0.28 : -0.2) * (1 + E);
        const rad = rr + (this.noise(ang * 2 + k * 7, t * (0.5 + E * 1.5)) - 0.5) * 0.07;
        if (i) x.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
        else x.moveTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
      }
      x.stroke();
    }
    const hx = Math.sin(t * 0.5) * 0.03;
    const hy = Math.cos(t * 0.6) * 0.03;
    g = x.createRadialGradient(hx, hy, 0, 0, 0, 0.2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, `rgba(255,255,255,${Math.min(1, 0.6 * gl)})`);
    g.addColorStop(1, rgba(hot, 0));
    x.fillStyle = g;
    x.fillRect(-R, -R, R * 2, R * 2);
    x.restore();

    // ---- motes only when touched (the reactor stays the one quiet light on the screen)
    if (this.kick > 0.05)
      for (const s of this.sparks) {
        const k = 1 - s.life / s.max;
        if (s.r > 1.1) continue;
        x.fillStyle = rgba(hot, k * 0.5 * this.kick);
        x.beginPath();
        x.arc(Math.cos(s.a) * s.r, Math.sin(s.a) * s.r, s.s * 0.6 * (0.5 + k), 0, TAU);
        x.fill();
      }

    // ---- glass over the core and the face
    x.globalCompositeOperation = 'source-over';
    x.drawImage(this.proGlass, -PX, -PX, 2 * PX, 2 * PX);
    void lub;
  }
}
