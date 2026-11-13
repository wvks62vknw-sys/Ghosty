/**
 * THE PLATFORMER, as an Engine: a run-and-jump through eight worlds of our own, drawn flat in the voxel world's own colours
 * (sim.ts holds the rules, levels.ts the worlds). ◀ ▶ under the left thumb, RUN and JUMP under the right; a pad: the d-pad,
 * A jumps, X or B runs; a keyboard: arrows, space, X or C. Each level has a tune of its own and a dotted ghost: Ghosty's best
 * run of it, kept when his practice beats it. The level of the measure picks the world and the lap (faster, more crowded).
 */
import { h } from '../../../core/dom';
import { clamp } from '../kit';
import { type ControlApi, type Evt, makeEngine, type Rules, type View } from '../two/shell';
import { levelOf } from '../two/skill';
import { GAMES5, PLATFORM_GHOSTY_ID, PLATFORM_ID } from '../shelf5';
import { TS } from './core';
import { LEVELS, ROWS, THEMES, type Theme } from './levels';
import { botStep, type Cmd, headless, idxOf, isOver, newRun, platformLearnable, type PlatEvent, type Run, score, SIGMA, step, targetOf, THETA0, VIEW_W } from './sim';

const pts = (n: number) => `${Math.round(n).toLocaleString('en-GB')} point${Math.round(n) === 1 ? '' : 's'}`;
const reduced = (): boolean => {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

// ---------------------------------------------------------------- Ghosty's best run of each level, the dotted ghost
const GHOST_KEY = 'ghosty.arcade.platform.ghost';
interface Ghost {
  t: number;
  p: number[];
}
let ghosts: Record<string, Ghost> | null = null;
const store = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};
export function allGhosts(): Record<string, Ghost> {
  if (ghosts) return ghosts;
  try {
    const raw = JSON.parse(store()?.getItem(GHOST_KEY) ?? '{}') as Record<string, Ghost>;
    ghosts = {};
    for (const [k, v] of Object.entries(raw ?? {})) if (v && Number.isFinite(v.t) && Array.isArray(v.p) && v.p.every(Number.isFinite)) ghosts[k] = v;
  } catch {
    ghosts = {};
  }
  return ghosts;
}
/** Keep this run as the level's ghost when it was faster than the one kept (a first lap only: the same crowd every time). */
export function keepGhost(idx: number, seconds: number, path: number[]): boolean {
  const all = allGhosts();
  const prev = all[String(idx)];
  if (prev && prev.t <= seconds) return false;
  all[String(idx)] = { t: Math.round(seconds * 10) / 10, p: path };
  try {
    store()?.setItem(GHOST_KEY, JSON.stringify(all));
  } catch {
    /* full or blocked: the ghost lives for this visit */
  }
  return true;
}
export const ghostOf = (idx: number): Ghost | null => allGhosts()[String(idx)] ?? null;
/** Where the ghost is `t` seconds in: [x, y, face] (null past its end). */
export function ghostAt(g: Ghost, t: number): [number, number, number] | null {
  const n = g.p.length / 3;
  const f = t * 6;
  const i = Math.floor(f);
  if (i >= n - 1) return null;
  const k = f - i;
  return [g.p[i * 3]! + (g.p[i * 3 + 3]! - g.p[i * 3]!) * k, g.p[i * 3 + 1]! + (g.p[i * 3 + 4]! - g.p[i * 3 + 1]!) * k, g.p[i * 3 + 2]!];
}

const NO: Cmd = { left: false, right: false, jump: false, jumpPressed: false, run: false };
const cmdOf = (held: ReadonlySet<string>, pressed: ReadonlySet<string>): Cmd => ({
  left: held.has('left'),
  right: held.has('right'),
  jump: held.has('a') || held.has('up'),
  jumpPressed: pressed.has('a') || pressed.has('up'),
  run: held.has('c') || held.has('x') || held.has('b'),
});

const hz = (semi: number) => 440 * Math.pow(2, semi / 12);
/** Each world's tune: its chords, its scale, its pace. */
const TUNES = [
  { chords: [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [-5, -1, 2]], scale: [0, 2, 4, 7, 9, 12], root: -9, bpm: [104, 132] as [number, number], kick: true, hats: true, bass: [0, 6, 8, 12], bassWave: 'triangle' as OscillatorType, arpWave: 'square' as OscillatorType, leadWave: 'triangle' as OscillatorType },
  { chords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -2, 2]], scale: [0, 3, 5, 7, 10, 12], root: -12, bpm: [88, 112] as [number, number], hats: true, bass: [0, 8], bassWave: 'sine' as OscillatorType, arpWave: 'triangle' as OscillatorType, leadWave: 'sine' as OscillatorType },
  { chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [3, 7, 10]], scale: [0, 2, 4, 7, 9, 12], root: -7, bpm: [110, 138] as [number, number], kick: true, clap: true, hats: true, bass: [0, 3, 6, 10], bassWave: 'square' as OscillatorType, arpWave: 'square' as OscillatorType, leadWave: 'triangle' as OscillatorType },
  { chords: [[0, 3, 7], [0, 3, 6], [-2, 2, 5], [-4, 0, 3]], scale: [0, 3, 5, 6, 7, 10], root: -14, bpm: [100, 128] as [number, number], kick: true, clap: true, bass: [0, 4, 8, 12], bassWave: 'square' as OscillatorType, arpWave: 'square' as OscillatorType, leadWave: 'square' as OscillatorType },
  { chords: [[0, 4, 7, 11], [5, 9, 12], [2, 5, 9], [7, 11, 14]], scale: [0, 2, 4, 7, 9, 11, 12], root: -5, bpm: [84, 106] as [number, number], hats: true, bass: [0, 8], bassWave: 'sine' as OscillatorType, arpWave: 'triangle' as OscillatorType, leadWave: 'sine' as OscillatorType },
  { chords: [[0, 3, 7], [-5, -2, 2], [-2, 2, 5], [-7, -4, 0]], scale: [0, 3, 5, 7, 10], root: -10, bpm: [80, 100] as [number, number], hats: true, bass: [0, 6, 12], bassWave: 'sine' as OscillatorType, arpWave: 'sine' as OscillatorType, leadWave: 'triangle' as OscillatorType },
  { chords: [[0, 4, 7], [-1, 4, 7], [-3, 0, 4], [-5, -1, 2]], scale: [0, 2, 4, 7, 9, 12, 14], root: -8, bpm: [92, 118] as [number, number], kick: true, hats: true, bass: [0, 8, 10], bassWave: 'triangle' as OscillatorType, arpWave: 'triangle' as OscillatorType, leadWave: 'sine' as OscillatorType },
  { chords: [[0, 3, 7], [3, 7, 10], [-2, 2, 5], [5, 8, 12]], scale: [0, 3, 5, 7, 8, 10, 12], root: -12, bpm: [108, 140] as [number, number], kick: true, clap: true, hats: true, bass: [0, 3, 6, 9, 12], bassWave: 'square' as OscillatorType, arpWave: 'square' as OscillatorType, leadWave: 'triangle' as OscillatorType },
];

const rules: Rules<Run> = {
  id: PLATFORM_ID,
  engine: 'platform',
  title: 'The Platformer',
  line: 'Run and jump to the flag.',
  how: [
    'Run right to the flag at the end of each world. ◀ ▶ move, RUN makes you faster, JUMP jumps: hold it for a high jump, tap it for a hop. You can still jump for a moment after you leave a ledge, and a jump pressed a moment early is not lost.',
    'Land on a walker, a hopper or a flyer to stomp it. Land on a shell to stop it, touch a stopped shell to kick it along. Coins count, crates give a coin from below, a glow fruit makes you bigger and a bigger you breaks crates. One hit makes you small again; a hit when small costs a life.',
    'Three lives, a flag in the middle where you start again, and a timer. The dotted ghost is Ghosty\'s best run of this world: keep up with it. After the eighth world they come round again, faster, with more walkers and less time.',
  ],
  ghostyId: PLATFORM_GHOSTY_ID,
  words: pts,
  target: targetOf,
  reserve: 118,
  start: (o) => {
    const r = newRun(o.seed, o.level);
    r.calm = !!o.args?.includes('calm');
    return r;
  },
  step: (r, dt, inp) => step(r, dt, r.bot ? NO : cmdOf(inp.held, inp.pressed)),
  drain: (r) => r.events.splice(0) as unknown as Evt[],
  score,
  over: isOver,
  passed: (r) => r.won,
  ends: (r) => (r.won ? { title: 'Flag', tip: r.lap ? 'Round again and still standing.' : 'On to the next world.' } : { title: r.timeLeft <= 0 ? 'Out of time' : 'Out of lives', tip: 'Land on the walkers instead of running into them, and take the checkpoint flag.' }),
  bot: (r, th) => botStep(r, th),
  practice: {
    id: PLATFORM_ID,
    theta0: THETA0,
    sigma: SIGMA,
    play: (theta, level, seed) => {
      const t = targetOf(level);
      const res = headless(theta, level, seed);
      if (res.run.won && res.run.lap === 0) keepGhost(res.run.idx, res.run.t, res.run.path);
      return { score: res.score, target: t, passed: res.passed };
    },
  },
  controls: (api: ControlApi) => [
    h('div.g4grp.left', api.button({ label: '◀', aria: 'Move left', name: 'left', hold: true, cls: 'g4pm' }), api.button({ label: '▶', aria: 'Move right', name: 'right', hold: true, cls: 'g4pm' })),
    h('div.g4grp.right', api.button({ label: 'RUN', aria: 'Run, hold to go faster', name: 'c', hold: true, cls: 'g4act g4small' }), api.button({ label: 'JUMP', aria: 'Jump, hold for a higher jump', name: 'a', hold: true, cls: 'g4act g4small g4wide' })),
  ],
  sound: (s, e) => {
    const ev = e as unknown as PlatEvent;
    const t = ev.type;
    if (t === 'jump') s.tone({ f: 300, to: 560, dur: 0.1, type: 'square', vol: 0.05 });
    else if (t === 'coin') [988, 1319].forEach((f, i) => s.tone({ f, dur: 0.07, type: 'square', vol: 0.06, at: i * 0.05 }));
    else if (t === 'stomp') (s.tone({ f: 220, to: 90, dur: 0.12, type: 'square', vol: 0.09 }), s.noise({ dur: 0.05, f: 900, q: 0.8, vol: 0.08 }));
    else if (t === 'kick') s.tone({ f: 160, to: 420, dur: 0.14, type: 'sawtooth', vol: 0.07 });
    else if (t === 'kill') s.tone({ f: 400, to: 120, dur: 0.15, type: 'square', vol: 0.06 });
    else if (t === 'hurt') (s.tone({ f: 330, to: 110, dur: 0.3, type: 'sawtooth', vol: 0.1 }), s.noise({ dur: 0.12, f: 500, q: 0.6, vol: 0.12 }));
    else if (t === 'die') [440, 330, 247, 165].forEach((f, i) => s.tone({ f, dur: 0.16, type: 'triangle', vol: 0.12, at: i * 0.12 }));
    else if (t === 'power') [523, 659, 784, 1047].forEach((f, i) => s.tone({ f, dur: 0.09, type: 'triangle', vol: 0.1, at: i * 0.06 }));
    else if (t === 'spring') s.tone({ f: 200, to: 900, dur: 0.22, type: 'triangle', vol: 0.1 });
    else if (t === 'checkpoint') [659, 880, 1175].forEach((f, i) => s.tone({ f, dur: 0.12, type: 'triangle', vol: 0.1, at: i * 0.08 }));
    else if (t === 'flag') [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => s.tone({ f, dur: 0.14, type: 'triangle', vol: 0.11, at: i * 0.09 }));
    else if (t === 'land') s.noise({ dur: 0.05, f: 240, q: 0.5, vol: 0.06 });
    else if (t === 'crate') s.noise({ dur: 0.08, f: ev.kind === 'break' ? 1100 : 420, q: 0.7, vol: 0.12 });
    else if (t === 'rumble') s.noise({ dur: 0.2, f: 160, q: 0.6, vol: 0.07 });
    else if (t === 'time') s.tone({ f: 120, dur: 0.4, type: 'sawtooth', vol: 0.1 });
  },
  haptic: (e) => {
    const t = (e as unknown as PlatEvent).type;
    return t === 'hurt' || t === 'die' ? 'hit' : t === 'land' || t === 'stomp' || t === 'kick' ? 'tick' : null;
  },
  say: (e, r) => {
    const ev = e as unknown as PlatEvent;
    if (ev.type === 'checkpoint') return 'Halfway. If you fall, you start from the flag.';
    if (ev.type === 'power') return 'Bigger. Hit a crate from below and it breaks.';
    if (ev.type === 'flag') return `Flag, with ${ev.n} seconds to spare.`;
    if (ev.type === 'respawn') return r.checked ? 'Back at the flag.' : 'Again from the start.';
    if (ev.type === 'time') return 'Out of time. That cost a life.';
    return null;
  },
  music: { spec: TUNES[0]!, specFor: (r: Run) => ({ ...TUNES[r.idx]!, level: 0.14, seed: 40 + r.idx }), pace: (r) => clamp(0.15 + r.lap * 0.1 + (r.maxX / (r.W * TS)) * 0.6, 0, 1) },
  peek: (r) => ({
    x: r.p.x,
    y: r.p.y,
    vx: r.p.vx,
    vy: r.p.vy,
    onGround: r.p.onGround,
    big: r.p.big,
    sq: r.p.sq,
    coins: r.coins,
    stomps: r.stomps,
    lives: r.lives,
    checked: r.checked,
    won: r.won,
    dead: r.p.dead,
    t: r.t,
    timeLeft: r.timeLeft,
    idx: r.idx,
    lap: r.lap,
    theme: r.theme.id,
    camX: r.camX,
    parallax: reduced() ? 0 : r.camX * 0.25,
    reduced: reduced(),
    ghost: !!ghostOf(r.idx),
    enemies: r.enemies.filter((e) => e.alive).length,
    flagX: r.flagX,
    W: r.W,
    jumped: r.t,
  }),
  draw: (g, r, v) => draw(g, r, v),
};

// ---------------------------------------------------------------- the drawing

const rr = (g: CanvasRenderingContext2D, x: number, y: number, w: number, hh: number, rad: number) => {
  g.beginPath();
  g.moveTo(x + rad, y);
  g.arcTo(x + w, y, x + w, y + hh, rad);
  g.arcTo(x + w, y + hh, x, y + hh, rad);
  g.arcTo(x, y + hh, x, y, rad);
  g.arcTo(x, y, x + w, y, rad);
  g.closePath();
};

/** One parallax layer: shapes that repeat every `period` pixels, moved by `off`. */
function layer(g: CanvasRenderingContext2D, th: Theme, far: boolean, off: number, baseY: number, k: number, w: number, color: string, t: number, still: boolean): void {
  const period = (far ? 260 : 190) * k;
  const first = Math.floor(off / period) - 1;
  g.fillStyle = color;
  for (let i = first; i < first + Math.ceil(w / period) + 3; i++) {
    const x0 = i * period - off;
    const seed = ((i % 7) + 7) % 7;
    const ph = (far ? 60 : 40) * k * (0.6 + seed * 0.11);
    switch (th.shapes) {
      case 'hills':
        g.beginPath();
        g.moveTo(x0, baseY);
        g.quadraticCurveTo(x0 + period * 0.5, baseY - ph * (far ? 2.4 : 1.6), x0 + period, baseY);
        g.fill();
        break;
      case 'caves':
        for (let j = 0; j < 3; j++) {
          const bx = x0 + j * period * 0.33 + seed * 6 * k;
          g.beginPath();
          g.moveTo(bx, 0);
          g.lineTo(bx + 24 * k, 0);
          g.lineTo(bx + 12 * k, ph * (0.8 + (j % 2) * 0.7) * (far ? 1.4 : 1.8));
          g.fill();
          g.beginPath();
          g.moveTo(bx + 30 * k, baseY);
          g.lineTo(bx + 52 * k, baseY);
          g.lineTo(bx + 41 * k, baseY - ph * (0.6 + (j % 2) * 0.5));
          g.fill();
        }
        break;
      case 'roofs':
        for (let j = 0; j < 3; j++) {
          const bw = (far ? 50 : 40) * k;
          const bh = ph * (1.4 + ((seed + j * 2) % 4) * 0.5);
          g.fillRect(x0 + j * bw * 1.2, baseY - bh, bw, bh);
          if (!far) {
            g.save();
            g.fillStyle = 'rgba(255,230,160,.5)';
            for (let wy = 0; wy < 3; wy++) g.fillRect(x0 + j * bw * 1.2 + 8 * k, baseY - bh + 10 * k + wy * 18 * k, 6 * k, 8 * k);
            g.restore();
          }
        }
        break;
      case 'factory':
        g.fillRect(x0, baseY - ph * 1.6, 44 * k, ph * 1.6);
        g.fillRect(x0 + 70 * k, baseY - ph * 2.4, 14 * k, ph * 2.4);
        g.beginPath();
        g.arc(x0 + 130 * k, baseY - ph * 0.8, 22 * k, 0, 6.3);
        g.fill();
        if (!far) {
          g.save();
          g.strokeStyle = 'rgba(255,255,255,.15)';
          g.lineWidth = 3 * k;
          const a = still ? 0 : t * 0.6;
          g.beginPath();
          for (let q = 0; q < 4; q++) {
            g.moveTo(x0 + 130 * k, baseY - ph * 0.8);
            g.lineTo(x0 + 130 * k + Math.cos(a + q * 1.57) * 22 * k, baseY - ph * 0.8 + Math.sin(a + q * 1.57) * 22 * k);
          }
          g.stroke();
          g.restore();
        }
        break;
      case 'clouds':
        for (let j = 0; j < 2; j++) {
          const cx = x0 + j * period * 0.5 + seed * 8 * k;
          const cy = baseY - (far ? 150 : 90) * k - j * 24 * k;
          g.beginPath();
          g.arc(cx, cy, 16 * k, 0, 6.3);
          g.arc(cx + 18 * k, cy - 6 * k, 20 * k, 0, 6.3);
          g.arc(cx + 38 * k, cy, 15 * k, 0, 6.3);
          g.fill();
        }
        break;
      case 'ship':
        g.fillRect(x0 + 30 * k, baseY - ph * 2.2, 5 * k, ph * 2.2);
        g.beginPath();
        g.moveTo(x0 + 35 * k, baseY - ph * 2.1);
        g.lineTo(x0 + 70 * k, baseY - ph * 1.5);
        g.lineTo(x0 + 35 * k, baseY - ph * 1);
        g.fill();
        g.fillRect(x0, baseY - ph * 0.5, 120 * k, ph * 0.5);
        break;
      case 'snow':
        for (let j = 0; j < 3; j++) {
          const bx = x0 + j * period * 0.33;
          g.beginPath();
          g.moveTo(bx, baseY);
          g.lineTo(bx + 20 * k, baseY - ph * (1.2 + (j % 2) * 0.5));
          g.lineTo(bx + 40 * k, baseY);
          g.fill();
        }
        break;
      case 'tower':
        g.fillRect(x0, baseY - ph * 2.6, 16 * k, ph * 2.6);
        g.fillRect(x0 + 60 * k, baseY - ph * 2.6, 16 * k, ph * 2.6);
        g.beginPath();
        g.arc(x0 + 38 * k, baseY - ph * 2.6, 38 * k, Math.PI, 0);
        g.fill();
        break;
    }
  }
}

/** The things that drift in the air, for a world that has them (still when the phone asks for less motion). */
function air(g: CanvasRenderingContext2D, th: Theme, w: number, top: number, bottom: number, t: number, still: boolean, k: number): void {
  if (th.air === 'none') return;
  g.save();
  const n = 26;
  for (let i = 0; i < n; i++) {
    const sx = ((i * 97) % 1000) / 1000;
    const sy = ((i * 53) % 1000) / 1000;
    const sp = 0.3 + (i % 5) * 0.15;
    const tt = still ? 0 : t;
    let x = (sx * w + tt * (th.air === 'flakes' ? -14 : th.air === 'embers' ? 6 : 4) * sp * 6) % w;
    if (x < 0) x += w;
    const range = bottom - top;
    let y = top + (sy * range + tt * (th.air === 'flakes' ? 26 : th.air === 'bubbles' ? -22 : th.air === 'embers' ? -18 : 5) * sp * k * 1.4) % range;
    if (y < top) y += range;
    g.globalAlpha = 0.5;
    g.fillStyle = th.air === 'embers' ? '#ffb35a' : '#ffffff';
    const s = (th.air === 'bubbles' ? 2.6 : 1.8) * k * (0.6 + sp);
    if (th.air === 'bubbles') {
      g.strokeStyle = 'rgba(255,255,255,.55)';
      g.lineWidth = 1;
      g.beginPath();
      g.arc(x, y, s, 0, 6.3);
      g.stroke();
    } else g.fillRect(x, y, s, s);
  }
  g.restore();
}

function draw(g: CanvasRenderingContext2D, r: Run, v: View): void {
  const th = r.theme;
  const still = reduced();
  const top0 = 110;
  const k = Math.min(v.w / (VIEW_W * TS), (v.h - top0 - v.reserve) / (ROWS * TS));
  const bandH = ROWS * TS * k;
  const ox = (v.w - VIEW_W * TS * k) / 2;
  const oy = v.h - v.reserve - bandH - 14;
  const cam = Math.round(r.camX * k) / k;
  // sky
  const sky = g.createLinearGradient(0, 0, 0, oy + bandH);
  sky.addColorStop(0, th.sky[0]);
  sky.addColorStop(1, th.sky[1]);
  g.fillStyle = sky;
  g.fillRect(0, 0, v.w, v.h);
  const dark = th.id === 'caves' || th.id === 'tower' || th.id === 'factory';
  if (dark) {
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 30; i++) {
      g.globalAlpha = 0.2 + 0.25 * (still ? 0.5 : 0.5 + 0.5 * Math.sin(v.t * 1.6 + i));
      g.fillRect(((i * 61) % 100) * v.w / 100, ((i * 37) % 70) * oy / 100, 1.6 * k, 1.6 * k);
    }
    g.globalAlpha = 1;
  }
  const baseY = oy + GROUNDY(k);
  layer(g, th, true, still ? 0 : r.camX * 0.25 * k, baseY, k, v.w, th.far, v.t, still);
  layer(g, th, false, still ? 0 : r.camX * 0.5 * k, baseY, k, v.w, th.near, v.t, still);
  air(g, th, v.w, 0, oy + bandH, v.t, still, k);
  // the ground below the band
  g.fillStyle = th.ground;
  g.fillRect(0, oy + bandH, v.w, v.h - oy - bandH);
  g.save();
  g.beginPath();
  g.rect(0, 0, v.w, oy + bandH);
  g.clip();
  g.translate(ox - cam * k, oy);
  g.scale(k, k);
  const tx0 = Math.max(0, Math.floor(cam / TS) - 1);
  const tx1 = Math.min(r.W - 1, tx0 + VIEW_W + 2);
  // the flags
  flag(g, r.checkX, th, r.checked, false, v.t, still);
  flag(g, r.flagX, th, r.won, true, v.t, still);
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const c = r.tiles[ty]![tx]!;
      if (c === '.') continue;
      const x = tx * TS;
      const y = ty * TS;
      if (c === '#') {
        g.fillStyle = th.ground;
        g.fillRect(x, y, TS, TS);
        const open = ty === 0 || r.tiles[ty - 1]![tx] === '.' || r.tiles[ty - 1]![tx] === 'o';
        if (open) {
          g.fillStyle = th.top;
          g.fillRect(x, y, TS, 4);
          g.fillStyle = 'rgba(255,255,255,.22)';
          g.fillRect(x, y, TS, 1);
        }
        g.fillStyle = 'rgba(0,0,0,.12)';
        g.fillRect(x, y + TS - 2, TS, 2);
        if (tx < r.W - 1 && r.tiles[ty]![tx + 1] === '.') g.fillRect(x + TS - 2, y, 2, TS);
      } else if (c === 'p') {
        g.fillStyle = th.ledge;
        rr(g, x + 0.5, y + 1, TS - 1, TS - 2, 3);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,.25)';
        g.fillRect(x + 2, y + 2, TS - 4, 2);
      } else if (c === 'B' || c === 'P' || c === 'U') {
        const used = c === 'U';
        g.fillStyle = used ? '#6d6560' : '#d9a24e';
        rr(g, x + 0.5, y + 0.5, TS - 1, TS - 1, 2);
        g.fill();
        g.strokeStyle = used ? '#4e4843' : '#8a5a1c';
        g.lineWidth = 1.2;
        g.stroke();
        if (c === 'B') {
          g.beginPath();
          g.moveTo(x + 3, y + 3);
          g.lineTo(x + TS - 3, y + TS - 3);
          g.moveTo(x + TS - 3, y + 3);
          g.lineTo(x + 3, y + TS - 3);
          g.stroke();
        } else if (c === 'P') {
          g.fillStyle = '#fff';
          g.font = '700 11px system-ui, sans-serif';
          g.textAlign = 'center';
          g.fillText('?', x + TS / 2, y + 12);
          g.textAlign = 'left';
        }
      } else if (c === 'o') {
        const sx = still ? 1 : Math.abs(Math.cos(v.t * 3 + tx));
        g.fillStyle = '#ffd34d';
        g.beginPath();
        g.ellipse(x + 8, y + 8, 4.5 * Math.max(0.25, sx), 5, 0, 0, 6.3);
        g.fill();
        g.fillStyle = '#fff3b0';
        g.fillRect(x + 7, y + 5, 1.5, 4);
      } else if (c === '^') {
        const sq = r.p.springCool > 0 ? 0.5 : 1;
        g.fillStyle = '#e4e4ea';
        g.fillRect(x + 2, y + 15 - 2, 12, 2);
        g.strokeStyle = '#ff6a6a';
        g.lineWidth = 2;
        g.beginPath();
        const hgt = 10 * sq;
        g.moveTo(x + 4, y + 14);
        for (let z = 0; z < 4; z++) g.lineTo(x + (z % 2 ? 4 : 12), y + 14 - hgt * ((z + 1) / 4));
        g.stroke();
        g.fillStyle = '#e4e4ea';
        g.fillRect(x + 2, y + 14 - hgt - 2, 12, 2);
      }
    }
  }
  for (const m of r.movers) {
    g.fillStyle = th.ledge;
    rr(g, m.x, m.y, m.w, m.h, 3);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.3)';
    g.fillRect(m.x + 2, m.y + 1, m.w - 4, 2);
    g.fillStyle = 'rgba(0,0,0,.35)';
    for (let i = 0; i < 3; i++) g.fillRect(m.x + 7 + i * 16, m.y + 5, 2, 2);
  }
  for (const d of r.drops) {
    if (d.y > ROWS * TS + 20) continue;
    const sh = d.state === 1 && !still ? Math.sin(v.t * 60) * 0.9 : 0;
    g.fillStyle = th.ledge;
    rr(g, d.x + sh, d.y, d.w, d.h, 2);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,.35)';
    g.beginPath();
    g.moveTo(d.x + 3 + sh, d.y + 3);
    g.lineTo(d.x + 8 + sh, d.y + 9);
    g.lineTo(d.x + 5 + sh, d.y + 14);
    g.stroke();
  }
  for (const f of r.fruits) {
    if (!f.alive) continue;
    g.fillStyle = '#7dffb0';
    g.beginPath();
    g.arc(f.x + 6, f.y + 6, 6, 0, 6.3);
    g.fill();
    g.fillStyle = '#ffffff';
    g.fillRect(f.x + 4, f.y + 2, 2, 3);
  }
  for (const e of r.enemies) enemy(g, e, v.t, still);
  // the ghost: Ghosty's best run of this world, dotted
  const gh = !v.demo ? ghostOf(r.idx) : null;
  const gp = gh && r.lap === 0 && !r.won ? ghostAt(gh, r.t) : null;
  if (gp) {
    g.save();
    g.globalAlpha = 0.6;
    g.setLineDash([2, 2]);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 1.2;
    rr(g, gp[0], gp[1], 10, 14, 3);
    g.stroke();
    g.restore();
  }
  player(g, r, v);
  g.restore();
  // the HUD under the shell's own: lives, coins, time, the world's name
  const hy = oy - 12;
  g.font = '600 13px system-ui, sans-serif';
  g.textBaseline = 'alphabetic';
  g.fillStyle = 'rgba(255,255,255,.92)';
  g.shadowColor = 'rgba(0,0,0,.4)';
  g.shadowBlur = 3;
  g.textAlign = 'left';
  g.fillText(`${LEVELS[r.idx]!.name}${r.lap ? ` · lap ${r.lap + 1}` : ''}`, ox, hy);
  g.textAlign = 'right';
  const hearts = '♥'.repeat(Math.max(0, r.lives));
  g.fillText(`${hearts}   ● ${r.coins}   ${Math.max(0, Math.ceil(r.timeLeft))} s`, v.w - ox, hy);
  if (gh && !v.demo && r.lap === 0) {
    g.textAlign = 'left';
    g.globalAlpha = 0.8;
    g.fillText(`Ghosty's best ${gh.t.toFixed(0)} s`, ox, hy - 16);
    g.globalAlpha = 1;
  }
  g.shadowBlur = 0;
  g.textAlign = 'left';
  if (r.t < 1.6 && !v.demo && r.p.vx === 0) {
    g.fillStyle = '#fff';
    g.font = '700 20px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText('Get to the flag', v.w / 2, oy + bandH * 0.3);
    g.textAlign = 'left';
  }
  if (v.demo) {
    g.fillStyle = '#fff';
    g.font = '700 14px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText('Ghosty playing', v.w / 2, oy + bandH + 28);
    g.textAlign = 'left';
  }
}
const GROUNDY = (k: number) => 10 * TS * k;

function flag(g: CanvasRenderingContext2D, x: number, th: Theme, up: boolean, end: boolean, t: number, still: boolean): void {
  const y = 10 * TS;
  const hgt = end ? 76 : 44;
  g.fillStyle = '#e8e8f0';
  g.fillRect(x - 1, y - hgt, 2.4, hgt);
  const wave = still ? 0 : Math.sin(t * 5) * 1.5;
  g.fillStyle = end ? '#ff5c7a' : up ? th.top : '#9aa0aa';
  const fy = up ? y - hgt : y - hgt + 14;
  g.beginPath();
  g.moveTo(x + 1.4, fy);
  g.lineTo(x + 22, fy + 6 + wave);
  g.lineTo(x + 1.4, fy + 12);
  g.fill();
  if (end) {
    g.fillStyle = '#ffd34d';
    g.beginPath();
    g.arc(x, y - hgt - 2, 3, 0, 6.3);
    g.fill();
  }
}

function enemy(g: CanvasRenderingContext2D, e: import('./sim').Enemy, t: number, still: boolean): void {
  if (!e.alive) {
    if (e.die > 0.35) return;
    g.save();
    g.globalAlpha = 1 - e.die / 0.35;
    g.fillStyle = e.kind === 'shell' ? '#2f9a6a' : '#7a3a4a';
    g.fillRect(e.x - 1, e.y + e.h - 3, e.w + 2, 3);
    g.restore();
    return;
  }
  const x = e.x;
  const y = e.y;
  const fl = e.dir > 0 ? 1 : -1;
  const step = still ? 0 : Math.sin(t * 12 + x);
  g.save();
  if (e.kind === 'walker') {
    g.fillStyle = '#8a3a52';
    g.beginPath();
    g.ellipse(x + 6, y + 6, 6.5, 6, 0, 0, 6.3);
    g.fill();
    g.fillStyle = '#5a2236';
    g.fillRect(x + 1 + step, y + 10, 4, 2.5);
    g.fillRect(x + 7 - step, y + 10, 4, 2.5);
    g.fillStyle = '#fff';
    g.fillRect(x + 6 + fl * 1.5 - 3, y + 3, 2.6, 3);
    g.fillRect(x + 6 + fl * 1.5 + 1, y + 3, 2.6, 3);
    g.fillStyle = '#1a1020';
    g.fillRect(x + 6 + fl * 2.2 - 2.6, y + 4.4, 1.3, 1.6);
    g.fillRect(x + 6 + fl * 2.2 + 1.4, y + 4.4, 1.3, 1.6);
  } else if (e.kind === 'hopper') {
    g.fillStyle = e.onGround ? '#4aa86a' : '#5ad07e';
    const sq = e.onGround ? 0.85 : 1.15;
    rr(g, x, y + 12 - 12 * sq, 12, 12 * sq, 4);
    g.fill();
    g.fillStyle = '#fff';
    g.fillRect(x + 1.5, y + 12 - 12 * sq - 1, 3.4, 3.4);
    g.fillRect(x + 7.1, y + 12 - 12 * sq - 1, 3.4, 3.4);
    g.fillStyle = '#10301e';
    g.fillRect(x + 2.7 + fl * 0.6, y + 12 - 12 * sq + 0.4, 1.5, 1.8);
    g.fillRect(x + 8.3 + fl * 0.6, y + 12 - 12 * sq + 0.4, 1.5, 1.8);
  } else if (e.kind === 'flyer') {
    const fl2 = still ? 0 : Math.sin(t * 18 + x);
    g.fillStyle = '#6a5ad0';
    g.beginPath();
    g.ellipse(x + 7, y + 6, 5, 4, 0, 0, 6.3);
    g.fill();
    g.fillStyle = '#9a8cff';
    g.beginPath();
    g.moveTo(x + 3, y + 5);
    g.lineTo(x - 4, y + 1 + fl2 * 4);
    g.lineTo(x + 3, y + 8);
    g.moveTo(x + 11, y + 5);
    g.lineTo(x + 18, y + 1 + fl2 * 4);
    g.lineTo(x + 11, y + 8);
    g.fill();
    g.fillStyle = '#fff';
    g.fillRect(x + 5, y + 4, 1.8, 2);
    g.fillRect(x + 8, y + 4, 1.8, 2);
  } else {
    const retracted = e.state === 'still';
    const kicked = e.state === 'kicked';
    g.fillStyle = '#2f9a6a';
    rr(g, x, y + 3, 12, 9, 5);
    g.fill();
    g.fillStyle = '#7ad8a6';
    g.fillRect(x + 3, y + 5, 6, 2);
    if (!retracted) {
      g.fillStyle = '#e8c48a';
      g.fillRect(x + (fl > 0 ? 8 : -1), y + 5, 5, 5);
      g.fillStyle = '#10101a';
      g.fillRect(x + (fl > 0 ? 10.5 : 0.5), y + 6.5, 1.4, 1.6);
    }
    if (kicked && !still) {
      g.strokeStyle = 'rgba(255,255,255,.7)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x + 6 - fl * 10, y + 5);
      g.lineTo(x + 6 - fl * 15, y + 5);
      g.moveTo(x + 6 - fl * 9, y + 9);
      g.lineTo(x + 6 - fl * 14, y + 9);
      g.stroke();
    }
  }
  g.restore();
}

function player(g: CanvasRenderingContext2D, r: Run, v: View): void {
  const p = r.p;
  if (p.inv > 0 && Math.floor(v.t * 20) % 2 === 0 && !p.dead) return;
  const sq = p.sq;
  const w = p.w * (1 + sq * 0.8);
  const hgt = p.h * (1 - sq * 0.7);
  const x = p.x + p.w / 2 - w / 2;
  const y = p.y + p.h - hgt;
  const run = Math.abs(p.vx) > 4 && p.onGround ? Math.sin(p.anim * 16) : 0;
  g.save();
  // a cube of our own, the accent for its body, a visor, two feet that step
  g.fillStyle = v.accent;
  rr(g, x, y, w, hgt - 3, 3);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,.28)';
  g.fillRect(x + 1.5, y + 1.5, w - 3, 2);
  g.fillStyle = '#0d1424';
  const vx = p.face > 0 ? x + w * 0.4 : x + 1.5;
  g.fillRect(vx, y + hgt * 0.22, w * 0.55, hgt * 0.2);
  g.fillStyle = '#fff';
  g.fillRect(vx + (p.face > 0 ? w * 0.3 : 1.2), y + hgt * 0.26, 2, 2);
  g.fillStyle = '#0d1424';
  g.fillRect(x + 1 + run * 1.5, y + hgt - 3, w * 0.4, 3);
  g.fillRect(x + w * 0.55 - run * 1.5, y + hgt - 3, w * 0.4, 3);
  if (p.big) {
    g.fillStyle = 'rgba(255,255,255,.5)';
    g.fillRect(x + 1.5, y + hgt * 0.6, w - 3, 1.5);
  }
  g.restore();
}

export const platformEngine = makeEngine(rules, GAMES5.find((e) => e.id === PLATFORM_ID)!);
export { rules as platformRules, platformLearnable, THEMES, idxOf, levelOf };
