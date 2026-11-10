/**
 * BLAST's rules, with no drawing in them: Block Blast mechanics. An 8 × 8 grid and three pieces offered at a time; a piece
 * is placed where it fits (no turning), a full row or column clears, clearing rows and columns together and clearing on
 * back-to-back placements raise the score, and the run ends when none of the pieces left in the tray fits anywhere. The
 * level sets how much junk the grid starts with, how awkward the pieces are, and how much help the dealer gives (at the
 * first levels it makes sure one piece fits; from level 9 it does not). Ghosty plays it with a placement heuristic whose
 * four weights he tunes. The engine draws it; the node test plays it; the GYM can learn it through `blastLearnable`.
 */
import type { Learnable } from '../../learnable';
import { rise } from './skill';

export const N = 8;
/** A shape: its rows as bit masks (bit x set = filled), its width, and how many cells. */
export interface Shape {
  id: number;
  rows: number[];
  w: number;
  cells: number;
}
const parse = (rows: string[]): number[] => rows.map((r) => [...r].reduce((m, c, x) => (c === 'X' ? m | (1 << x) : m), 0));
const SRC: string[][] = [
  ['X'], ['XX'], ['X', 'X'],
  ['XXX'], ['X', 'X', 'X'], ['XX', 'X.'], ['XX', '.X'], ['X.', 'XX'], ['.X', 'XX'],
  ['XX', 'XX'], ['XXXX'], ['X', 'X', 'X', 'X'], ['XXX', 'X..'], ['XXX', '..X'], ['X..', 'XXX'], ['..X', 'XXX'], ['XXX', '.X.'], ['.X.', 'XXX'], ['.XX', 'XX.'], ['XX.', '.XX'], ['X.', 'XX', 'X.'], ['.X', 'XX', '.X'],
  ['XXX', 'XXX', 'XXX'], ['XXXXX'], ['X', 'X', 'X', 'X', 'X'], ['XXX', 'X..', 'X..'], ['XXX', '..X', '..X'], ['X..', 'X..', 'XXX'], ['..X', '..X', 'XXX'], ['XXX', 'XXX'], ['XX', 'XX', 'XX'],
];
export const SHAPES: Shape[] = SRC.map((s, id) => ({ id, rows: parse(s), w: Math.max(...s.map((r) => r.length)), cells: s.join('').replace(/[^X]/g, '').length }));

export interface Cell {
  /** 0 empty, else a colour 1…7. */
  c: number;
}
export type BlastEvent = { type: 'place' | 'deal' } | { type: 'clear'; n: number; rows: number[]; cols: number[]; points: number; streak: number } | { type: 'perfect' } | { type: 'over' } | { type: 'bad' };
export interface Pop {
  text: string;
  x: number;
  y: number;
  t: number;
}
export interface Run {
  seed: number;
  level: number;
  rnd: () => number;
  /** Row bit masks and colours (0 empty). */
  grid: Uint8Array;
  col: Uint8Array;
  tray: (Shape | null)[];
  trayCol: number[];
  score: number;
  streak: number;
  since: number;
  moves: number;
  lines: number;
  over: boolean;
  events: BlastEvent[];
  pops: Pop[];
  /** Cells that just cleared, with the time, for the drawing. */
  flash: { cells: number[]; t: number } | null;
  botClock: number;
  t: number;
}

/** What a level asks (rising without end). */
export const targetOf = (level: number): number => Math.round(rise(level, 300, 300, 4));
export const prefillOf = (level: number): number => Math.min(16, Math.max(0, Math.round(level * 1.1) - 1));
export const tiltOf = (level: number): number => 0.1 * Math.log1p(Math.max(0, level - 1));
export const helpOf = (level: number): number => Math.max(0, 1 - 0.12 * (level - 1));

const mk = (seed: number): (() => number) => {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

export const THETA0: readonly number[] = [3, -0.35, -2, -0.25];
export const SIGMA: readonly number[] = [0.6, 0.15, 0.5, 0.1];

export function newRun(seed: number, level: number): Run {
  const r: Run = { seed, level, rnd: mk(seed), grid: new Uint8Array(N), col: new Uint8Array(N * N), tray: [null, null, null], trayCol: [1, 2, 3], score: 0, streak: 0, since: 0, moves: 0, lines: 0, over: false, events: [], pops: [], flash: null, botClock: 0, t: 0 };
  let n = prefillOf(level);
  while (n > 0) {
    const x = Math.floor(r.rnd() * N), y = Math.floor(r.rnd() * N);
    if (r.grid[y]! & (1 << x) || popcount(r.grid[y]!) >= 5) continue;
    r.grid[y]! |= 1 << x;
    r.col[y * N + x] = 1 + Math.floor(r.rnd() * 7);
    n--;
  }
  deal(r);
  r.events.length = 0;
  return r;
}
export const popcount = (v: number): number => {
  let c = 0;
  while (v) (c += v & 1), (v >>= 1);
  return c;
};
export function fits(grid: Uint8Array, s: Shape, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x + s.w > N || y + s.rows.length > N) return false;
  for (let i = 0; i < s.rows.length; i++) if ((s.rows[i]! << x) & grid[y + i]!) return false;
  return true;
}
export function anyFit(grid: Uint8Array, s: Shape): boolean {
  for (let y = 0; y <= N - s.rows.length; y++) for (let x = 0; x <= N - s.w; x++) if (fits(grid, s, x, y)) return true;
  return false;
}
function pickShape(r: Run): Shape {
  const t = tiltOf(r.level);
  const base = (s: Shape) => (s.cells <= 2 ? 3 : s.cells <= 3 ? 3 : s.cells <= 5 ? 2.5 : 1.5) * Math.exp(t * (s.cells - 4));
  let total = 0;
  for (const s of SHAPES) total += base(s);
  let v = r.rnd() * total;
  for (const s of SHAPES) {
    v -= base(s);
    if (v <= 0) return s;
  }
  return SHAPES[0]!;
}
/** Three new pieces. At the low levels the dealer re-rolls until at least one of them fits. */
export function deal(r: Run): void {
  for (let attempt = 0; attempt < 12; attempt++) {
    const set = [pickShape(r), pickShape(r), pickShape(r)];
    r.tray = set;
    r.trayCol = set.map(() => 1 + Math.floor(r.rnd() * 7));
    if (r.rnd() >= helpOf(r.level) || set.some((s) => anyFit(r.grid, s))) break;
  }
  r.events.push({ type: 'deal' });
  if (!r.tray.some((s) => s && anyFit(r.grid, s))) end(r);
}
function end(r: Run): void {
  if (!r.over) (r.over = true), r.events.push({ type: 'over' });
}
/** Place tray piece `i` with its top-left at (x, y). Says whether it went. */
export function place(r: Run, i: number, x: number, y: number): boolean {
  const s = r.tray[i];
  if (!s || r.over || !fits(r.grid, s, x, y)) {
    if (s && !r.over) r.events.push({ type: 'bad' });
    return false;
  }
  for (let k = 0; k < s.rows.length; k++)
    for (let b = 0; b < s.w; b++)
      if (s.rows[k]! & (1 << b)) {
        r.grid[y + k]! |= 1 << (x + b);
        r.col[(y + k) * N + x + b] = r.trayCol[i]!;
      }
  r.tray[i] = null;
  r.moves++;
  r.score += s.cells;
  r.events.push({ type: 'place' });
  const rows: number[] = [], cols: number[] = [];
  for (let k = 0; k < N; k++) if (r.grid[k] === 255) rows.push(k);
  for (let b = 0; b < N; b++) if (r.grid.every((m) => m & (1 << b))) cols.push(b);
  const n = rows.length + cols.length;
  if (n) {
    const flash: number[] = [];
    for (const k of rows) for (let b = 0; b < N; b++) flash.push(k * N + b);
    for (const b of cols) for (let k = 0; k < N; k++) flash.push(k * N + b);
    for (const k of rows) r.grid[k] = 0;
    for (const b of cols) for (let k = 0; k < N; k++) r.grid[k]! &= ~(1 << b);
    for (const c of flash) r.col[c] = 0;
    r.streak++;
    r.since = 0;
    r.lines += n;
    const points = Math.floor(n * n * 10 * (1 + 0.5 * (r.streak - 1)));
    r.score += points;
    r.flash = { cells: flash, t: 0 };
    r.events.push({ type: 'clear', n, rows, cols, points, streak: r.streak });
    if (r.grid.every((m) => !m)) (r.score += 100), r.events.push({ type: 'perfect' });
  } else if (++r.since >= 3) r.streak = 0;
  if (r.tray.every((t) => !t)) deal(r);
  else if (!r.tray.some((t) => t && anyFit(r.grid, t))) end(r);
  return true;
}

// ---------------------------------------------------------------- the bot

/** The features of a grid after a placement: [lines cleared, edges between filled and empty, holes, cells filled]. */
export function features(grid: Uint8Array, s: Shape, x: number, y: number): { f: number[]; next: Uint8Array } {
  const g = grid.slice();
  for (let i = 0; i < s.rows.length; i++) g[y + i]! |= s.rows[i]! << x;
  let clearedRows = 0, colMask = 255;
  for (let k = 0; k < N; k++) if (g[k] === 255) clearedRows++;
  for (let k = 0; k < N; k++) colMask &= g[k]!;
  const lines = clearedRows + popcount(colMask);
  for (let k = 0; k < N; k++) g[k] = g[k] === 255 ? 0 : g[k]! & ~colMask;
  let edges = 0, holes = 0, filled = 0;
  for (let k = 0; k < N; k++) {
    const m = g[k]!;
    filled += popcount(m);
    edges += popcount((m ^ (m >> 1)) & 127) + (m & 1) * 0;
    if (k < N - 1) edges += popcount(m ^ g[k + 1]!);
    for (let b = 0; b < N; b++) {
      if (m & (1 << b)) continue;
      const l = b === 0 || m & (1 << (b - 1)), rr = b === N - 1 || m & (1 << (b + 1));
      const u = k === 0 || g[k - 1]! & (1 << b), d = k === N - 1 || g[k + 1]! & (1 << b);
      if (l && rr && u && d) holes++;
    }
  }
  return { f: [lines, edges, holes, filled], next: g };
}
const dot = (f: number[], th: readonly number[]) => f.reduce((s, v, i) => s + v * (th[i] ?? 0), 0);
export interface Move {
  i: number;
  x: number;
  y: number;
}
/** The best sequence for the pieces left (a beam over their orders), first move returned. */
export function bestMove(r: Run, th: readonly number[]): Move | null {
  const left = r.tray.map((s, i) => (s ? i : -1)).filter((i) => i >= 0);
  let best: { v: number; first: Move } | null = null;
  const search = (grid: Uint8Array, rest: number[], first: Move | null, acc: number): void => {
    if (!rest.length) {
      if (first && (!best || acc > best.v)) best = { v: acc, first };
      return;
    }
    for (const i of rest) {
      const s = r.tray[i]!;
      const opts: { v: number; x: number; y: number; next: Uint8Array }[] = [];
      for (let y = 0; y <= N - s.rows.length; y++) for (let x = 0; x <= N - s.w; x++) if (fits(grid, s, x, y)) {
        const { f, next } = features(grid, s, x, y);
        opts.push({ v: dot(f, th), x, y, next });
      }
      if (!opts.length) {
        if (first && (!best || acc - 50 > best.v)) best = { v: acc - 50, first };
        continue;
      }
      opts.sort((a, b) => b.v - a.v);
      for (const o of opts.slice(0, 3)) search(o.next, rest.filter((j) => j !== i), first ?? { i, x: o.x, y: o.y }, o.v);
    }
  };
  search(r.grid, left, null, 0);
  return (best as { first: Move } | null)?.first ?? null;
}
/** Ghosty's bot: one move every half second. */
export function botStep(r: Run, th: readonly number[], dt: number): void {
  if (r.over) return;
  r.botClock += dt;
  if (r.botClock < 0.5) return;
  r.botClock = 0;
  const m = bestMove(r, th);
  if (m) place(r, m.i, m.x, m.y);
  else end(r);
}
export function tick(r: Run, dt: number): void {
  r.t += dt;
  if (r.flash) r.flash.t += dt;
  for (const p of r.pops) p.t += dt;
  r.pops = r.pops.filter((p) => p.t < 1);
}

// ---------------------------------------------------------------- the GYM's way in

export interface BlastObs {
  rows: number[];
  tray: (number | null)[];
  score: number;
  streak: number;
}
export const blastActions = Array.from({ length: 3 * N * N }, (_, k) => `${Math.floor(k / (N * N))}:${k % N},${Math.floor((k % (N * N)) / N)}`);
export function blastLearnable(seed = 1, level = 1): Learnable<BlastObs, string> & { run: Run } {
  const run = newRun(seed, level);
  return {
    run,
    id: 'blast',
    actions: blastActions,
    observe: () => ({ rows: Array.from(run.grid), tray: run.tray.map((s) => (s ? s.id : null)), score: run.score, streak: run.streak }),
    act(a) {
      const [i, xy] = a.split(':');
      const [x, y] = xy!.split(',').map(Number);
      place(run, Number(i), x!, y!);
      run.events.length = 0;
    },
    score: () => run.score,
    done: () => run.over,
  };
}
