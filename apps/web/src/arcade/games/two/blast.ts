/**
 * BLAST, as an Engine: Block Blast mechanics (blast-sim.ts holds the rules). Three pieces wait under the grid: drag one
 * onto it (the piece rides above your finger so the thumb never hides it; a pale copy shows where it will land and the
 * rows and columns it would clear light up) and let go; let go anywhere else and it goes back. A pad or a keyboard: the
 * d-pad or arrows move a cursor, B or X picks the next piece, A places it. Your level sets the junk the grid starts with,
 * how awkward the pieces are and how much the dealer helps; there is no top one.
 */
import { clamp } from '../kit';
import { type Evt, makeEngine, type Pointer, type Rules, STEP, type View } from './shell';
import { BLAST_GHOSTY_ID, BLAST_ID, GAMES4 } from './shelf4';
import { blastActions, blastLearnable, type BlastObs, botStep, fits, N, newRun, place, prefillOf, type Run, SIGMA, SHAPES, THETA0, targetOf, tick } from './blast-sim';
import { playHeadless, NOINPUT } from './shell';

const COLOURS = ['#000000', '#4fd8e6', '#f2d24b', '#b278e6', '#6fcf6f', '#ec6a6a', '#5b86e6', '#f09a4a'];
const pts = (n: number) => `${Math.round(n).toLocaleString('en-GB')} points`;

interface Layout {
  c: number;
  gx: number;
  gy: number;
  tc: number;
  trayTop: number;
  slotW: number;
}
const layoutOf = (w: number, h: number): Layout => {
  const c = Math.floor(Math.max(16, Math.min((w - 24) / N, (h - 110 - 230) / N)));
  const gx = Math.round((w - c * N) / 2);
  const gy = 112;
  const trayTop = gy + c * N + 28;
  const slotW = w / 3;
  const tc = Math.floor(Math.min(c * 0.7, (slotW - 16) / 5, (h - trayTop - 24) / 5));
  return { c, gx, gy, tc, trayTop, slotW };
};
let drag: { i: number; x: number; y: number } | null = null;
let cur = { x: 3, y: 3, i: 0, on: false };
let lay: Layout = layoutOf(390, 844);

/** Where a dragged piece (its top-left) lands on the grid. */
const target = (r: Run, i: number, x: number, y: number): { cx: number; cy: number; ok: boolean } => {
  const s = r.tray[i]!;
  const cx = Math.round((x - (s.w * lay.c) / 2 - lay.gx) / lay.c);
  const cy = Math.round((y - lay.c * (s.rows.length + 1.2) - lay.gy) / lay.c);
  return { cx, cy, ok: fits(r.grid, s, cx, cy) };
};

function block(g: CanvasRenderingContext2D, x: number, y: number, s: number, colour: number, a = 1): void {
  g.globalAlpha = a;
  g.fillStyle = COLOURS[colour] ?? COLOURS[1]!;
  g.fillRect(x + 1, y + 1, s - 2, s - 2);
  g.fillStyle = 'rgba(255,255,255,.26)';
  g.fillRect(x + 1, y + 1, s - 2, Math.max(2, s * 0.16));
  g.fillStyle = 'rgba(0,0,0,.2)';
  g.fillRect(x + 1, y + s - 1 - Math.max(2, s * 0.16), s - 2, Math.max(2, s * 0.16));
  g.globalAlpha = 1;
}

const rules: Rules<Run> = {
  id: BLAST_ID,
  engine: 'blast',
  title: 'Blast',
  line: 'Fit the pieces. Clear the lines.',
  how: [
    'Drag a piece from the tray onto the grid. It rides above your finger, a pale copy shows where it will land, and any row or column it would complete lights up.',
    'A full row or column clears. Clear several at once, or clear on one placement after another, and the points multiply. Pieces do not turn.',
    'The run ends when none of the pieces in the tray fits. Each level starts with more junk on the grid and awkward pieces; at the first levels the dealer makes sure something fits.',
  ],
  ghostyId: BLAST_GHOSTY_ID,
  words: pts,
  target: targetOf,
  start: (o) => {
    drag = null;
    return newRun(o.seed, o.level);
  },
  step: (r, dt, inp) => {
    tick(r, dt);
    if (r.over) return;
    const p = inp.pressed;
    if (p.size) cur.on = true;
    if (p.has('left')) cur.x = clamp(cur.x - 1, 0, N - 1);
    if (p.has('right')) cur.x = clamp(cur.x + 1, 0, N - 1);
    if (p.has('up')) cur.y = clamp(cur.y - 1, 0, N - 1);
    if (p.has('down')) cur.y = clamp(cur.y + 1, 0, N - 1);
    if (p.has('b') || p.has('x')) for (let k = 1; k <= 3; k++) if (r.tray[(cur.i + k) % 3]) { cur.i = (cur.i + k) % 3; break; }
    if (p.has('a')) {
      if (!r.tray[cur.i]) for (let k = 1; k <= 3; k++) if (r.tray[(cur.i + k) % 3]) { cur.i = (cur.i + k) % 3; break; }
      place(r, cur.i, cur.x, cur.y);
    }
  },
  drain: (r) => {
    const out = r.events.splice(0);
    for (const e of out) if (e.type === 'clear') r.pops.push({ text: `+${e.points}${e.streak > 1 ? `  x${e.streak}` : ''}`, x: 0.5, y: 0.35, t: 0 });
    return out as unknown as Evt[];
  },
  score: (r) => r.score,
  over: (r) => r.over,
  ends: (r) => ({ title: 'No room', tip: r.lines > 6 ? 'Lots of lines. Keep one corner open for the big pieces.' : 'Clear lines early: a half-full row is a row you cannot use.' }),
  bot: (r, th, dt) => botStep(r, th, dt),
  practice: {
    id: BLAST_ID,
    theta0: THETA0,
    sigma: SIGMA,
    play: (theta, level, seed) => {
      const t = targetOf(level);
      const r = playHeadless({ ...rules, start: (o) => newRun(o.seed, o.level) }, theta, level, seed, t);
      return { score: r.score, target: t, passed: r.passed };
    },
  },
  pointer: (r, p: Pointer) => {
    if (p.kind === 'down') {
      if (!r || r.over) return;
      cur.on = false;
      const i = Math.floor(p.x / lay.slotW);
      if (p.y > lay.trayTop - 12 && i >= 0 && i < 3 && r.tray[i]) drag = { i, x: p.x, y: p.y };
    } else if (p.kind === 'move') {
      if (drag) (drag.x = p.x), (drag.y = p.y);
    } else if (drag) {
      const d = drag;
      drag = null;
      if (r && r.tray[d.i]) {
        const t = target(r, d.i, p.x, p.y);
        if (t.ok) place(r, d.i, t.cx, t.cy);
      }
    }
  },
  sound: (s, e) => {
    const ev = e as unknown as { type: string; n?: number; streak?: number };
    if (ev.type === 'place') s.tone({ f: 300, to: 220, dur: 0.07, type: 'triangle', vol: 0.12 });
    else if (ev.type === 'bad') s.tone({ f: 140, to: 100, dur: 0.1, type: 'square', vol: 0.06 });
    else if (ev.type === 'deal') s.tone({ f: 620, to: 780, dur: 0.06, type: 'sine', vol: 0.05 });
    else if (ev.type === 'clear') {
      const n = Math.min(6, ev.n ?? 1) + Math.min(4, (ev.streak ?? 1) - 1);
      [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568].slice(0, 2 + n).forEach((f, i) => s.tone({ f, dur: 0.12, type: 'triangle', vol: 0.09, at: i * 0.045 }));
    } else if (ev.type === 'perfect') [784, 988, 1175, 1568, 1976].forEach((f, i) => s.tone({ f, dur: 0.16, type: 'triangle', vol: 0.1, at: i * 0.07 }));
    else if (ev.type === 'over') s.tone({ f: 330, to: 90, dur: 0.8, type: 'sawtooth', vol: 0.1 });
  },
  haptic: (e) => {
    const t = (e as unknown as { type: string; n?: number }).type;
    return t === 'clear' ? 'tick' : t === 'over' ? 'hit' : null;
  },
  say: (e) => {
    const ev = e as unknown as { type: string; n?: number; streak?: number };
    if (ev.type === 'clear' && (ev.streak ?? 0) >= 3) return `Streak of ${ev.streak}!`;
    if (ev.type === 'clear' && (ev.n ?? 0) >= 3) return `${ev.n} lines at once.`;
    if (ev.type === 'perfect') return 'A clean grid: +100.';
    return null;
  },
  music: { spec: { chords: [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [7, 11, 14]], scale: [0, 2, 4, 7, 9, 12], root: -9, bpm: [84, 104], hats: true, bass: [0, 8], bassWave: 'sine', arpWave: 'triangle', leadWave: 'sine', level: 0.16, seed: 17 }, pace: (r) => clamp(r.streak / 6, 0, 1) },
  peek: (r) => ({ rows: Array.from(r.grid), tray: r.tray.map((s) => (s ? s.id : null)), shapes: r.tray.map((s) => (s ? { w: s.w, h: s.rows.length } : null)), streak: r.streak, lines: r.lines, moves: r.moves, over: r.over, prefill: prefillOf(r.level), filled: r.grid.reduce((n, m) => { let c = 0; for (let v = m; v; v >>= 1) c += v & 1; return n + c; }, 0), trayTop: lay.trayTop, slotW: lay.slotW, gx: lay.gx, gy: lay.gy, cell: lay.c }),
  draw: (g, r, v: View) => {
    lay = layoutOf(v.w, v.h);
    const { c, gx, gy, tc, trayTop, slotW } = lay;
    const bg = g.createLinearGradient(0, 0, 0, v.h);
    bg.addColorStop(0, '#10142a');
    bg.addColorStop(1, '#070912');
    g.fillStyle = bg;
    g.fillRect(0, 0, v.w, v.h);
    g.fillStyle = 'rgba(14,20,36,.9)';
    g.fillRect(gx - 4, gy - 4, c * N + 8, c * N + 8);
    // what the dragged piece would clear
    let hl: { rows: Set<number>; cols: Set<number> } | null = null;
    let tg: { cx: number; cy: number; ok: boolean } | null = null;
    if (drag && r.tray[drag.i]) {
      tg = target(r, drag.i, drag.x, drag.y);
      if (tg.ok) {
        const s = r.tray[drag.i]!;
        const g2 = r.grid.slice();
        for (let i = 0; i < s.rows.length; i++) g2[tg.cy + i]! |= s.rows[i]! << tg.cx;
        hl = { rows: new Set(), cols: new Set() };
        for (let k = 0; k < N; k++) if (g2[k] === 255) hl.rows.add(k);
        for (let b = 0; b < N; b++) if (g2.every((m) => m & (1 << b))) hl.cols.add(b);
      }
    }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const px = gx + x * c, py = gy + y * c;
      g.fillStyle = (x + y) % 2 ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.08)';
      g.fillRect(px + 1, py + 1, c - 2, c - 2);
      const col = r.col[y * N + x]!;
      if (col) block(g, px, py, c, col);
      if (hl && (hl.rows.has(y) || hl.cols.has(x))) (g.fillStyle = 'rgba(255,255,255,.35)'), g.fillRect(px + 1, py + 1, c - 2, c - 2);
    }
    if (r.flash && r.flash.t < 0.3) {
      g.fillStyle = `rgba(255,255,255,${0.8 * (1 - r.flash.t / 0.3)})`;
      for (const k of r.flash.cells) g.fillRect(gx + (k % N) * c + 1, gy + Math.floor(k / N) * c + 1, c - 2, c - 2);
    }
    if (tg?.ok && drag) {
      const s = r.tray[drag.i]!;
      for (let i = 0; i < s.rows.length; i++) for (let b = 0; b < s.w; b++) if (s.rows[i]! & (1 << b)) block(g, gx + (tg.cx + b) * c, gy + (tg.cy + i) * c, c, r.trayCol[drag.i]!, 0.45);
    }
    // the tray
    g.fillStyle = 'rgba(255,255,255,.06)';
    g.fillRect(0, trayTop - 14, v.w, v.h - trayTop + 14);
    r.tray.forEach((s, i) => {
      if (!s || (drag && drag.i === i)) return;
      const ox = i * slotW + (slotW - s.w * tc) / 2;
      const oy = trayTop + (5 * tc - s.rows.length * tc) / 2;
      const fitsAny = true;
      for (let k = 0; k < s.rows.length; k++) for (let b = 0; b < s.w; b++) if (s.rows[k]! & (1 << b)) block(g, ox + b * tc, oy + k * tc, tc, r.trayCol[i]!, fitsAny ? 1 : 0.4);
      if (cur.on && cur.i === i) (g.strokeStyle = v.accent), (g.lineWidth = 2), g.strokeRect(i * slotW + 6, trayTop - 6, slotW - 12, 5 * tc + 12);
    });
    if (drag && r.tray[drag.i]) {
      const s = r.tray[drag.i]!;
      const ox = drag.x - (s.w * c) / 2, oy = drag.y - c * (s.rows.length + 1.2);
      for (let k = 0; k < s.rows.length; k++) for (let b = 0; b < s.w; b++) if (s.rows[k]! & (1 << b)) block(g, ox + b * c, oy + k * c, c, r.trayCol[drag.i]!, 0.92);
    }
    if (cur.on && !drag) {
      g.strokeStyle = v.accent;
      g.lineWidth = 3;
      g.strokeRect(gx + cur.x * c + 1, gy + cur.y * c + 1, c - 2, c - 2);
    }
    // the streak and the pops
    g.textAlign = 'center';
    g.font = '700 13px system-ui, sans-serif';
    g.fillStyle = r.streak > 1 ? '#f2d24b' : 'rgba(255,255,255,.5)';
    g.textBaseline = 'alphabetic';
    g.fillText(r.streak > 1 ? `STREAK x${r.streak}` : r.over ? 'NO ROOM' : v.demo ? 'GHOSTY PLAYING' : 'FIT THE PIECES', v.w / 2, gy - 12);
    for (const p of r.pops) {
      g.globalAlpha = 1 - p.t;
      g.fillStyle = '#fff';
      g.font = '800 30px system-ui, sans-serif';
      g.fillText(p.text, v.w * p.x, gy + c * N * p.y - p.t * 40);
    }
    g.globalAlpha = 1;
    g.textAlign = 'left';
  },
};
void NOINPUT;
void STEP;
void SHAPES;
void blastActions;

export const blastEngine = makeEngine(rules, GAMES4.find((g) => g.id === BLAST_ID)!);
export { rules as blastRules, blastLearnable };
export type { BlastObs };
