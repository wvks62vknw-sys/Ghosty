/**
 * The arc reactor on the Core tab (Mark I style: brushed housing, ten copper coils,
 * domed core). Static metalwork is drawn once into a cached canvas; each frame only adds
 * the light, rotating instruments and the voice spectrum.
 */
import { gfx } from '../../engine/gfx';
import type { VoiceState } from '../../state/app';

const TAU = Math.PI * 2;
type C2D = CanvasRenderingContext2D;
const rgba = (c: number[], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const to255 = (v: ArrayLike<number>) => [Math.round(v[0]! * 255), Math.round(v[1]! * 255), Math.round(v[2]! * 255)];

export class Reactor {
  readonly el: HTMLCanvasElement;
  state: VoiceState = 'idle';
  /** 0..1 loudness (mic or voice output). */
  level = 0;
  /** Optional frequency data (0..255) driving the spectrum ring. */
  spectrum: Uint8Array | null = null;
  private ctx: C2D;
  private staticCv = document.createElement('canvas');
  private key = '';
  private t = 0;
  private energy = 0;
  private lv = 0;
  private spec = new Float32Array(96);
  private size = 0;
  private dpr = 1;

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
    this.key = '';
  }

  /** Draw the metal housing and coils once per size/theme. */
  private buildStatic(): void {
    const S = Math.round(this.size * this.dpr);
    const cv = this.staticCv;
    cv.width = cv.height = S;
    const x = cv.getContext('2d')!;
    const th = to255(gfx.theme.c);
    x.setTransform(S / 2 / 1.45, 0, 0, S / 2 / 1.45, S / 2, S / 2);
    const arc = (r: number, a0 = 0, a1 = TAU, ccw = false) => x.arc(0, 0, r, a0, a1, ccw);
    let g = x.createRadialGradient(0, 0, 0.95, 0, 0, 1.18);
    g.addColorStop(0, 'rgba(0,0,0,.65)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.beginPath();
    arc(1.18);
    x.fill();
    // brushed face
    const metal = (off: number) => {
      const stops: [number, string][] = [[0, '#59636c'], [0.12, '#aab5bf'], [0.25, '#2b3238'], [0.38, '#7d8993'], [0.5, '#1d2328'], [0.62, '#9aa6b0'], [0.75, '#2f363c'], [0.88, '#b9c4cd'], [1, '#59636c']];
      const ctx = x as CanvasRenderingContext2D;
      if (typeof (ctx as { createConicGradient?: unknown }).createConicGradient === 'function') {
        const cg = ctx.createConicGradient(off, 0, 0);
        stops.forEach(([p, c]) => cg.addColorStop(p, c));
        return cg;
      }
      const lg = ctx.createLinearGradient(-1, -1, 1, 1);
      stops.forEach(([p, c]) => lg.addColorStop(p, c));
      return lg;
    };
    x.beginPath();
    arc(1);
    arc(0.8, 0, TAU, true);
    x.fillStyle = metal(-2.4);
    x.fill();
    for (let i = 0; i < 90; i++) {
      x.strokeStyle = `rgba(255,255,255,${0.015 + Math.random() * 0.05})`;
      x.lineWidth = 0.0016;
      x.beginPath();
      arc(0.8 + Math.random() * 0.2);
      x.stroke();
    }
    // engraved scale
    for (let i = 0; i < 120; i++) {
      const t = (i / 120) * TAU;
      const big = i % 10 === 0;
      const r0 = 0.845;
      const r1 = r0 + (big ? 0.06 : i % 5 === 0 ? 0.04 : 0.025);
      x.strokeStyle = rgba(th, big ? 0.95 : 0.55);
      x.lineWidth = big ? 0.006 : 0.0035;
      x.beginPath();
      x.moveTo(Math.cos(t) * r0, Math.sin(t) * r0);
      x.lineTo(Math.cos(t) * r1, Math.sin(t) * r1);
      x.stroke();
    }
    // bolts
    for (let i = 0; i < 10; i++) {
      const t = ((i + 0.5) / 10) * TAU;
      const bx = Math.cos(t) * 0.93;
      const by = Math.sin(t) * 0.93;
      g = x.createRadialGradient(bx - 0.01, by - 0.012, 0.002, bx, by, 0.036);
      g.addColorStop(0, '#e4ebf1');
      g.addColorStop(0.6, '#7b8791');
      g.addColorStop(1, '#1b2126');
      x.fillStyle = g;
      x.beginPath();
      x.arc(bx, by, 0.034, 0, TAU);
      x.fill();
    }
    // recessed well
    g = x.createRadialGradient(0, 0, 0, 0, 0, 0.8);
    g.addColorStop(0, '#020509');
    g.addColorStop(1, '#07111a');
    x.fillStyle = g;
    x.beginPath();
    arc(0.8);
    x.fill();
    // copper coils
    const r0 = 0.5;
    const r1 = 0.76;
    const gap = 0.1;
    for (let i = 0; i < 10; i++) {
      const a0 = (i / 10) * TAU + gap / 2;
      const a1 = ((i + 1) / 10) * TAU - gap / 2;
      const am = (a0 + a1) / 2;
      x.beginPath();
      arc(r1, a0, a1);
      arc(r0, a1, a0, true);
      x.closePath();
      g = x.createLinearGradient(Math.cos(am) * r0, Math.sin(am) * r0, Math.cos(am) * r1, Math.sin(am) * r1);
      [[0, '#4d210e'], [0.2, '#a85a28'], [0.5, '#e9a35e'], [0.8, '#a2531f'], [1, '#3f1a0a']].forEach(([p, c]) => g.addColorStop(p as number, c as string));
      x.fillStyle = g;
      x.fill();
      x.save();
      x.clip();
      for (let k = 0; k <= 22; k++) {
        const a = a0 + ((a1 - a0) * k) / 22;
        x.strokeStyle = 'rgba(35,12,4,.6)';
        x.lineWidth = 0.004;
        x.beginPath();
        x.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
        x.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
        x.stroke();
      }
      const lg = x.createLinearGradient(-0.8, -0.8, 0.8, 0.8);
      lg.addColorStop(0, 'rgba(255,240,220,.28)');
      lg.addColorStop(0.5, 'rgba(0,0,0,0)');
      lg.addColorStop(1, 'rgba(0,0,0,.55)');
      x.fillStyle = lg;
      x.fillRect(-1, -1, 2, 2);
      x.restore();
      x.strokeStyle = '#150a04';
      x.lineWidth = 0.009;
      x.beginPath();
      arc(r1, a0, a1);
      arc(r0, a1, a0, true);
      x.closePath();
      x.stroke();
    }
    // inner machined ring
    x.beginPath();
    arc(0.47);
    arc(0.3, 0, TAU, true);
    x.fillStyle = metal(-1.2);
    x.fill();
    x.fillStyle = '#0a1218';
    x.beginPath();
    arc(0.3);
    x.fill();
    this.key = `${S}|${th.join()}`;
  }

  frame(dt: number): void {
    if (!this.el.isConnected) return;
    this.resize();
    const th0 = to255(gfx.theme.c);
    if (this.key !== `${Math.round(this.size * this.dpr)}|${th0.join()}`) this.buildStatic();
    this.t += dt;
    const t = this.t;
    const st = this.state;
    const target = st === 'speaking' ? 0.75 : st === 'listening' ? 0.35 : st === 'thinking' ? 0.2 : 0.05;
    this.energy += (target - this.energy) * Math.min(1, dt * 3);
    this.lv += (this.level - this.lv) * Math.min(1, dt * 14);
    const f = this.spectrum;
    for (let i = 0; i < 96; i++) {
      const v = f ? f[Math.floor((i / 96) * f.length * 0.6)]! / 255 : st === 'speaking' ? Math.max(0, 0.55 + 0.45 * Math.sin(t * 9 + i * 0.7) * Math.sin(t * 3.3 + i * 0.21)) * 0.9 : st === 'listening' ? 0.15 + 0.1 * Math.sin(t * 5 + i * 0.4) : 0.04 + 0.03 * Math.sin(t * 1.2 + i * 0.3);
      this.spec[i]! += (v - this.spec[i]!) * Math.min(1, dt * 18);
    }
    const x = this.ctx;
    const W = this.el.width;
    const H = this.el.height;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, W, H);
    const S = this.staticCv.width;
    const u = S / 2 / 1.45;
    x.setTransform(u, 0, 0, u, W / 2, H / 2);
    const th = to255(st === 'thinking' ? gfx.theme.a : st === 'listening' ? [0.35, 1, 0.8] : gfx.theme.c);
    const ac = to255(gfx.theme.a);
    const pul = 0.82 + 0.18 * Math.sin(t * (2 + this.energy * 3)) + this.lv * 0.6;
    const arc = (r: number, a0 = 0, a1 = TAU) => x.arc(0, 0, r, a0, a1);
    // back glow
    x.globalCompositeOperation = 'lighter';
    let g = x.createRadialGradient(0, 0, 0.2, 0, 0, 1.45);
    g.addColorStop(0, rgba(th, 0.34 * pul));
    g.addColorStop(0.45, rgba(th, 0.1 * pul));
    g.addColorStop(1, rgba(th, 0));
    x.fillStyle = g;
    x.fillRect(-1.5, -1.5, 3, 3);
    for (let j = 0; j < 3; j++) {
      const fr = (t * (0.14 + this.energy * 0.3) + j / 3) % 1;
      x.strokeStyle = rgba(th, Math.pow(1 - fr, 1.8) * (0.12 + this.lv * 0.7 + this.energy * 0.25));
      x.lineWidth = 0.012;
      x.beginPath();
      arc(1.02 + fr * 0.4);
      x.stroke();
    }
    // metal
    x.globalCompositeOperation = 'source-over';
    x.drawImage(this.staticCv, -1.45, -1.45, 2.9, 2.9);
    // light through the coil gaps
    x.globalCompositeOperation = 'lighter';
    x.lineCap = 'butt';
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      const chase = st === 'thinking' ? Math.max(0, Math.cos(t * 4 - i * 0.628)) * 0.8 : 0;
      const al = Math.min(1, 0.28 + chase + this.lv * 0.5 + this.energy * 0.2) * pul;
      for (const [w, k] of [[0.075, 0.16], [0.03, 0.5], [0.012, 1]] as const) {
        x.strokeStyle = rgba(w < 0.02 ? [255, 255, 255] : th, al * k);
        x.lineWidth = w;
        x.beginPath();
        x.moveTo(Math.cos(a) * 0.495, Math.sin(a) * 0.495);
        x.lineTo(Math.cos(a) * 0.765, Math.sin(a) * 0.765);
        x.stroke();
      }
    }
    // spectrum on the inner ring
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * TAU;
      const v = this.spec[i]!;
      x.strokeStyle = rgba(th, 0.3 + v * 0.7);
      x.lineWidth = 0.0085;
      x.beginPath();
      x.moveTo(Math.cos(a) * 0.31, Math.sin(a) * 0.31);
      x.lineTo(Math.cos(a) * (0.325 + v * 0.085), Math.sin(a) * (0.325 + v * 0.085));
      x.stroke();
    }
    // light ring + domed core
    for (const [w, k, c] of [[0.12, 0.1, th], [0.07, 0.28, th], [0.03, 0.95, [255, 255, 255]], [0.012, 1, [255, 255, 255]]] as const) {
      x.strokeStyle = rgba(c as number[], k * Math.min(1, pul));
      x.lineWidth = w;
      x.beginPath();
      arc(0.485);
      x.stroke();
    }
    g = x.createRadialGradient(-0.04, -0.05, 0.01, 0, 0, 0.3);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,.85)');
    g.addColorStop(0.62, rgba(th, 0.8 * pul));
    g.addColorStop(1, rgba(th, 0.1));
    x.fillStyle = g;
    x.beginPath();
    arc(0.3);
    x.fill();
    x.globalCompositeOperation = 'source-over';
    const spd = st === 'thinking' ? 2.2 : st === 'speaking' ? 0.9 : 0.25;
    const tri = (r: number, a: number, c: number[], w: number, al: number) => {
      x.strokeStyle = rgba(c, al);
      x.lineWidth = w;
      x.beginPath();
      for (let k = 0; k < 3; k++) {
        const q = a + (k * TAU) / 3;
        if (k) x.lineTo(Math.cos(q) * r, Math.sin(q) * r);
        else x.moveTo(Math.cos(q) * r, Math.sin(q) * r);
      }
      x.closePath();
      x.stroke();
    };
    tri(0.2, t * spd, [255, 255, 255], 0.008, 0.85);
    tri(0.15, -t * spd * 1.3 + 1, ac, 0.006, 0.8);
    // outer instruments: ticks + clock tracks
    x.globalCompositeOperation = 'lighter';
    x.save();
    x.rotate(-t * 0.02);
    for (let i = 0; i < 180; i++) {
      const a = (i / 180) * TAU;
      const big = i % 15 === 0;
      const r0 = 1.09;
      x.strokeStyle = i % 45 === 0 ? rgba(ac, 0.95) : rgba(th, big ? 0.7 : 0.32);
      x.lineWidth = big ? 0.005 : 0.003;
      x.beginPath();
      x.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      x.lineTo(Math.cos(a) * (r0 + (big ? 0.05 : i % 5 === 0 ? 0.03 : 0.016)), Math.sin(a) * (r0 + (big ? 0.05 : i % 5 === 0 ? 0.03 : 0.016)));
      x.stroke();
    }
    x.restore();
    const d = new Date();
    const sec = (d.getSeconds() + d.getMilliseconds() / 1000) / 60;
    const mn = (d.getMinutes() + sec) / 60;
    const hr = ((d.getHours() % 12) + mn) / 12;
    const track = (r: number, v: number, c: number[], w: number) => {
      x.strokeStyle = rgba(c, 0.12);
      x.lineWidth = w;
      x.beginPath();
      arc(r);
      x.stroke();
      x.strokeStyle = rgba(c, 0.95);
      x.beginPath();
      arc(r, -Math.PI / 2, -Math.PI / 2 + v * TAU);
      x.stroke();
    };
    track(1.15, sec, ac, 0.009);
    track(1.19, mn, th, 0.009);
    track(1.23, hr, [255, 255, 255], 0.007);
    x.globalCompositeOperation = 'source-over';
  }
}
