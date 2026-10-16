/**
 * The HUD around the arc reactor: a few thin rings, one slow segmented arc, a faint radar
 * sweep, a handful of orbiting motes, state-reactive waves, a power-up sequence on boot, and
 * live call-outs (AI link, library, conditions, threat, power, uplink) joined to the rings by
 * leader lines. Quiet when idle; it brightens and speeds up as Ghosty listens, thinks and
 * speaks. Drawn on one canvas behind the controls; call-outs are DOM text.
 */
import { h } from '../../core/dom';
import { gfx } from '../../engine/gfx';
import type { VoiceState } from '../../state/app';

const TAU = Math.PI * 2;
const rgba = (c: ArrayLike<number>, a: number) => `rgba(${Math.round(c[0]! * 255)},${Math.round(c[1]! * 255)},${Math.round(c[2]! * 255)},${Math.max(0, Math.min(1, a))})`;
const GREEN = [0.35, 1, 0.75];

export interface Callout {
  id: string;
  label: string;
  value: string;
  tone?: 'ok' | 'warn' | 'bad';
}

/** Where each call-out sits around the reactor (degrees, 0 = right, clockwise) and which side it reads from. */
/** d = how far out the leader line ends (× ring radius). Top and bottom reach further; sides stay close. */
const SLOTS = [
  { a: 245, side: 'l', d: 1.47 },
  { a: 295, side: 'r', d: 1.47 },
  { a: 165, side: 'l', d: 1.16 },
  { a: 15, side: 'r', d: 1.16 },
  { a: 118, side: 'l', d: 1.42 },
  { a: 62, side: 'r', d: 1.42 },
] as const;


export class StarkHud {
  readonly el: HTMLElement;
  private cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private notes = new Map<string, { box: HTMLElement; label: HTMLElement; value: HTMLElement; slot: number; shown: string; target: string }>();
  private t = 0;
  private energy = 0;
  private lv = 0;
  /** 0 → 1 during the power-up sequence. */
  boot = 0;
  private w = 0;
  private hgt = 0;
  private dpr = 1;
  private particles = Array.from({ length: 14 }, (_, i) => ({ a: (i / 14) * TAU, r: 1.08 + (i % 4) * 0.035, s: 0.25 + (i % 5) * 0.08 }));

  /** What the tool at work is doing right now, on the ring band under the reactor. */
  private taskEl: HTMLElement;
  private taskShown = '';
  private taskTarget = '';

  constructor() {
    this.cv = h('canvas.starkhud', { 'aria-hidden': 'true' });
    this.ctx = this.cv.getContext('2d')!;
    this.taskEl = h('div.hudtask', { hidden: true, role: 'status' });
    this.el = h('div.hudlayer', this.cv, this.taskEl);
  }

  /** Show what a tool is doing right now ("crt.sh… 3 of 7"); null clears it. Text types itself in, like the call-outs. */
  task(text: string | null): void {
    this.taskTarget = (text ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!this.taskTarget) {
      this.taskEl.hidden = true;
      this.taskEl.textContent = this.taskShown = '';
    }
  }

  /** Add or update a call-out. Text types itself in when it changes. */
  set(c: Callout): void {
    let n = this.notes.get(c.id);
    if (!n) {
      const slot = this.notes.size % SLOTS.length;
      const label = h('small');
      const value = h('b');
      const box = h(`div.callout.${SLOTS[slot]!.side}` as 'div', label, value);
      this.el.append(box);
      n = { box, label, value, slot, shown: '', target: '' };
      this.notes.set(c.id, n);
    }
    n.label.textContent = c.label;
    n.target = c.value;
    n.box.className = `callout ${SLOTS[n.slot]!.side}${c.tone ? ` ${c.tone}` : ''}`;
  }

  /**
   * Draw one frame. `center` and `radius` describe the reactor (CSS pixels, relative to
   * this layer). `level` 0..1 is voice loudness.
   */
  frame(dt: number, state: VoiceState, level: number, center: { x: number; y: number }, radius: number): void {
    const r = this.el.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1) * (gfx.scale < 0.8 ? 0.75 : 1);
    if (Math.round(r.width * dpr) !== this.cv.width || Math.round(r.height * dpr) !== this.cv.height) {
      this.cv.width = Math.round(r.width * dpr);
      this.cv.height = Math.round(r.height * dpr);
    }
    this.w = r.width;
    this.hgt = r.height;
    this.dpr = dpr;
    this.t += dt;
    this.boot = Math.min(1, this.boot + dt / 2.4);
    const target = state === 'speaking' ? 1 : state === 'thinking' ? 0.7 : state === 'listening' ? 0.45 : 0.1;
    this.energy += (target - this.energy) * Math.min(1, dt * 2.5);
    this.lv += (level - this.lv) * Math.min(1, dt * 12);
    this.draw(state, center, radius);
    this.place(center, radius);
  }

  private draw(state: VoiceState, c: { x: number; y: number }, R: number): void {
    const x = this.ctx;
    const t = this.t;
    const th = state === 'thinking' ? gfx.theme.a : state === 'listening' ? GREEN : gfx.theme.c;
    const ac = gfx.theme.a;
    const boot = easeOut(this.boot);
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, this.cv.width, this.cv.height);
    x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    x.translate(c.x, c.y);
    x.globalCompositeOperation = 'lighter';
    x.lineCap = 'butt';
    const ring = (rad: number, a0: number, a1: number, col: ArrayLike<number>, al: number, w: number) => {
      x.strokeStyle = rgba(col, al);
      x.lineWidth = w;
      x.beginPath();
      x.arc(0, 0, rad, a0, a1);
      x.stroke();
    };
    const spin = 1 + this.energy * 2.5;

    // 1. thin full circles (drawn in by the boot sweep)
    for (const [k, al] of [[1.04, 0.28], [1.32, 0.1], [1.45, 0.07]] as const) ring(R * k, -Math.PI / 2, -Math.PI / 2 + TAU * boot, th, al + this.energy * 0.12, 1);

    // 2. segmented arcs, counter-rotating
    const segs = (rad: number, n: number, gap: number, speed: number, al: number, w: number, col: ArrayLike<number>) => {
      const off = t * speed * spin;
      for (let i = 0; i < n; i++) {
        const a0 = off + (i / n) * TAU;
        ring(rad, a0, a0 + (TAU / n) * (1 - gap) * boot, col, al, w);
      }
    };
    segs(R * 1.1, 3, 0.35, 0.12, 0.3 + this.energy * 0.4, 2, th);
    segs(R * 1.38, 5, 0.7, 0.05, 0.18 + this.energy * 0.3, 1.5, th);

    // 3. degree scale with numbers
    x.save();
    x.rotate(-t * 0.03 * spin);
    const ticks = Math.round(120 * boot);
    for (let i = 0; i < ticks; i++) {
      const a = (i / 120) * TAU;
      const big = i % 10 === 0;
      const r0 = R * 1.22;
      x.strokeStyle = rgba(th, big ? 0.5 : 0.18);
      x.lineWidth = 1;
      x.beginPath();
      x.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      x.lineTo(Math.cos(a) * (r0 + (big ? R * 0.04 : R * 0.018)), Math.sin(a) * (r0 + (big ? R * 0.04 : R * 0.018)));
      x.stroke();
    }
    x.restore();

    // 5. radar sweep
    const sweepA = t * (0.8 + this.energy * 1.6);
    const g = x.createConicGradient?.(sweepA, 0, 0);
    if (g) {
      g.addColorStop(0, rgba(th, 0.0));
      g.addColorStop(0.9, rgba(th, 0.0));
      g.addColorStop(1, rgba(th, (0.06 + this.energy * 0.1) * boot));
      x.fillStyle = g;
      x.beginPath();
      x.arc(0, 0, R * 1.45, 0, TAU);
      x.arc(0, 0, R * 1.04, 0, TAU, true);
      x.fill();
    }

    // 6. orbiting particles (fast while thinking)
    for (const p of this.particles) {
      p.a += p.s * (0.02 + this.energy * 0.05);
      const pr = R * p.r;
      x.fillStyle = rgba(state === 'thinking' ? ac : th, (0.18 + this.energy * 0.6) * boot);
      x.beginPath();
      x.arc(Math.cos(p.a) * pr, Math.sin(p.a) * pr, 1.2 + this.energy * 1.4, 0, TAU);
      x.fill();
    }

    // 7. voice: waveform ring while listening, expanding pulses while speaking
    if (state === 'listening' || this.lv > 0.02) {
      x.strokeStyle = rgba(GREEN, 0.75);
      x.lineWidth = 1.5;
      x.beginPath();
      for (let i = 0; i <= 180; i++) {
        const a = (i / 180) * TAU;
        const amp = R * (0.015 + this.lv * 0.09) * Math.sin(i * 0.9 + t * 14) * Math.sin(i * 0.23 - t * 3);
        const rr = R * 1.07 + amp;
        if (i) x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else x.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      x.stroke();
    }
    if (state === 'speaking') {
      for (let j = 0; j < 3; j++) {
        const fr = (t * 0.7 + j / 3) % 1;
        ring(R * (1.05 + fr * 0.45), 0, TAU, th, (1 - fr) * 0.4, 2);
      }
    }

    // 8. leader lines to the call-outs
    for (const n of this.notes.values()) {
      if (n.box.hidden) continue;
      const s = SLOTS[n.slot]!;
      const a = (s.a * Math.PI) / 180;
      const p0 = { x: Math.cos(a) * R * 1.05, y: Math.sin(a) * R * 1.05 };
      const p1 = { x: Math.cos(a) * R * s.d, y: Math.sin(a) * R * s.d };
      const p2 = { x: p1.x + (s.side === 'l' ? -R * 0.1 : R * 0.1), y: p1.y };
      x.strokeStyle = rgba(th, 0.4 * boot);
      x.lineWidth = 1;
      x.beginPath();
      x.moveTo(p0.x, p0.y);
      x.lineTo(p1.x, p1.y);
      x.lineTo(p2.x, p2.y);
      x.stroke();
      x.fillStyle = rgba(th, 0.9 * boot);
      x.fillRect(p0.x - 1.5, p0.y - 1.5, 3, 3);
    }
    x.globalCompositeOperation = 'source-over';
  }

  /** Position the call-outs at the end of their leader lines; type text in; hide what doesn't fit. */
  private place(c: { x: number; y: number }, R: number): void {
    // The task line sits on the ring band just under the reactor (inside its box, so it never covers the readings below).
    if (this.taskTarget) {
      this.taskEl.hidden = this.boot < 0.35;
      this.taskEl.style.left = `${c.x}px`;
      this.taskEl.style.top = `${c.y + R * 1.13}px`;
      if (this.taskShown !== this.taskTarget) {
        const keep = commonPrefix(this.taskShown, this.taskTarget);
        this.taskShown = this.taskShown.length > keep ? this.taskShown.slice(0, -1) : this.taskTarget.slice(0, this.taskShown.length + 2);
        this.taskEl.textContent = this.taskShown;
      }
    }
    const roomy = this.w > 560 && R > 130;
    for (const n of this.notes.values()) {
      const s = SLOTS[n.slot]!;
      const a = (s.a * Math.PI) / 180;
      const px = c.x + Math.cos(a) * R * s.d + (s.side === 'l' ? -R * 0.1 : R * 0.1);
      const py = c.y + Math.sin(a) * R * s.d;
      const room = s.side === 'l' ? px : this.w - px; // space for the text box on its side
      const fits = roomy && room > 120 && py > 16 && py < this.hgt - 16 && this.boot > 0.35;
      n.box.hidden = !fits;
      if (!fits) continue;
      n.box.style.left = `${px}px`;
      n.box.style.top = `${py}px`;
      if (n.shown !== n.target) {
        // typewriter: grow towards the target text
        const keep = commonPrefix(n.shown, n.target);
        n.shown = n.shown.length > keep ? n.shown.slice(0, -1) : n.target.slice(0, n.shown.length + 2);
        n.value.textContent = n.shown;
      }
    }
  }
}

function commonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

const easeOut = (v: number) => 1 - Math.pow(1 - v, 3);
