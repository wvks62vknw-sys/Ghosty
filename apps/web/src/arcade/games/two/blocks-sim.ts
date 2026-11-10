/**
 * BLOCKS' rules, with no drawing in them: Tetris mechanics against Ghosty. A 10 × 20 well (two hidden rows above it),
 * seven pieces dealt from a shuffled bag so each comes once in seven, rotation with a few wall kicks, a hold that swaps
 * once a piece, a ghost of where it will land, soft and hard drop, a lock delay, gravity that rises with the level.
 * Ghosty plays a second well beside yours: a bot that picks where each piece goes by weighing the stack's height, the
 * lines it would clear, its holes and its bumpiness with four weights he tunes in practice. A double, triple or four-line
 * clear sends rows of garbage (each with one hole) to the other well, first cancelling any that are on their way to you.
 * Whoever tops out first loses; the duel is to `target` lines. The engine draws it; the node test plays it; the GYM can
 * learn it through `blocksLearnable` (observe, act, score).
 */
import type { Learnable } from '../../learnable';
import { fall, rise } from './skill';

export const W = 10;
/** Rows, two of them hidden above the visible twenty. */
export const H = 22;
export const HIDDEN = 2;
export const KINDS = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] as const;
const SHAPES: string[][] = [
  ['....', 'XXXX', '....', '....'],
  ['XX', 'XX'],
  ['.X.', 'XXX', '...'],
  ['.XX', 'XX.', '...'],
  ['XX.', '.XX', '...'],
  ['X..', 'XXX', '...'],
  ['..X', 'XXX', '...'],
];
/** The cells of each piece in each of its four turns, as [x, y] inside its box. */
export const CELLS: [number, number][][][] = SHAPES.map((rows) => {
  const n = rows.length;
  let cur: [number, number][] = [];
  rows.forEach((r, y) => [...r].forEach((c, x) => c === 'X' && cur.push([x, y])));
  const out: [number, number][][] = [];
  for (let i = 0; i < 4; i++) {
    out.push(cur);
    cur = cur.map(([x, y]) => [n - 1 - y, x]);
  }
  return out;
});
const BOX = SHAPES.map((r) => r.length);
const KICKS: [number, number][] = [[0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0], [-1, -1], [1, -1]];
export const GARBAGE = 8;

export interface Piece {
  k: number;
  rot: number;
  x: number;
  y: number;
}
export interface Well {
  cells: Uint8Array;
  piece: Piece | null;
  hold: number;
  canHold: boolean;
  bag: number[];
  queue: number[];
  lines: number;
  pieces: number;
  combo: number;
  /** Rows of garbage on their way to this well. */
  incoming: number;
  grav: number;
  lock: number;
  resets: number;
  dead: boolean;
  /** The clear that last happened (rows) and when (seconds), for the drawing. */
  flash: { rows: number[]; t: number } | null;
  rnd: () => number;
  /** The hole column garbage uses, and how many rows have used it. */
  hole: number;
  /** Seconds a held key has been held (for auto-repeat). */
  das: number;
  dasDir: number;
  dasT: number;
}
export type DuelEvent =
  | { type: 'move' | 'rotate' | 'hold' | 'land' | 'lock'; who: number }
  | { type: 'clear'; who: number; n: number; rows: number[]; sent: number }
  | { type: 'garbage'; who: number; n: number }
  | { type: 'dead'; who: number }
  | { type: 'perfect'; who: number };

export interface Duel {
  seed: number;
  level: number;
  /** Lines to reach for the win. */
  target: number;
  t: number;
  a: Well;
  b: Well;
  /** 0 while it goes on; 1 you; 2 Ghosty. */
  winner: 0 | 1 | 2;
  events: DuelEvent[];
  theta: readonly number[];
  botA: number;
  botB: number;
  /** For a bot playing the first well too (the attract mode, auto, practice). */
  mistakeRnd: () => number;
  /** Seconds to the next row of pressure that the level adds on its own. */
  pressure: number;
  /** A spec's switch: your piece does not fall by itself (it still drops when told). */
  calm: boolean;
}

/** What a level asks. All strictly rising and without a ceiling. */
export const gravityOf = (level: number): number => rise(level, 0.9, 2.4, 3);
export const ppsOf = (level: number): number => rise(level, 0.55, 0.45, 5);
export const mistakeOf = (level: number): number => Math.max(0, 0.45 - 0.09 * Math.log1p((level - 1) / 2));
export const targetOf = (level: number): number => Math.round(rise(level, 12, 6, 4));
/** Seconds between the rows of pressure the level adds from level 4 on (never zero). */
export const pressureEvery = (level: number): number => (level < 4 ? Infinity : fall(level, 70, 9, 6, 6));

/** The weights a new Ghosty starts with: height, lines, holes, bumpiness. */
export const THETA0: readonly number[] = [-0.51, 0.76, -0.36, -0.18];
export const SIGMA: readonly number[] = [0.12, 0.12, 0.12, 0.06];

const mk = (seed: number): (() => number) => {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

export function newWell(seed: number): Well {
  const w: Well = { cells: new Uint8Array(W * H), piece: null, hold: -1, canHold: true, bag: [], queue: [], lines: 0, pieces: 0, combo: -1, incoming: 0, grav: 0, lock: 0, resets: 0, dead: false, flash: null, rnd: mk(seed), hole: 0, das: 0, dasDir: 0, dasT: 0 };
  w.hole = Math.floor(w.rnd() * W);
  while (w.queue.length < 5) w.queue.push(nextOf(w));
  spawn(w);
  return w;
}
function nextOf(w: Well): number {
  if (!w.bag.length) {
    w.bag = [0, 1, 2, 3, 4, 5, 6];
    for (let i = 6; i > 0; i--) {
      const j = Math.floor(w.rnd() * (i + 1));
      [w.bag[i], w.bag[j]] = [w.bag[j]!, w.bag[i]!];
    }
  }
  return w.bag.pop()!;
}
export function newDuel(seed: number, level: number, theta: readonly number[] | null): Duel {
  return { seed, level, target: targetOf(level), t: 0, a: newWell(seed * 2 + 1), b: newWell(seed * 2 + 2), winner: 0, events: [], theta: theta ?? THETA0, botA: 0, botB: 0, mistakeRnd: mk(seed + 99), pressure: pressureEvery(level), calm: false };
}

export const cellsOf = (p: Piece): [number, number][] => CELLS[p.k]![p.rot]!.map(([x, y]) => [p.x + x, p.y + y]);
export function fits(cells: Uint8Array, k: number, rot: number, x: number, y: number): boolean {
  for (const [cx, cy] of CELLS[k]![rot]!) {
    const px = x + cx, py = y + cy;
    if (px < 0 || px >= W || py >= H) return false;
    if (py >= 0 && cells[py * W + px]) return false;
  }
  return true;
}
function spawn(w: Well): void {
  const k = w.queue.shift()!;
  w.queue.push(nextOf(w));
  const p: Piece = { k, rot: 0, x: Math.floor((W - BOX[k]!) / 2), y: 0 };
  w.piece = p;
  w.canHold = true;
  w.grav = 0;
  w.lock = 0;
  w.resets = 0;
  if (!fits(w.cells, k, 0, p.x, p.y)) {
    w.dead = true;
    w.piece = null;
  }
}
const resetLock = (w: Well) => {
  if (w.resets < 12) {
    w.lock = 0;
    w.resets++;
  }
};
export function move(w: Well, dx: number): boolean {
  const p = w.piece;
  if (!p || w.dead || !fits(w.cells, p.k, p.rot, p.x + dx, p.y)) return false;
  p.x += dx;
  resetLock(w);
  return true;
}
export function rotate(w: Well, dir: 1 | -1): boolean {
  const p = w.piece;
  if (!p || w.dead || p.k === 1) return !!p && p.k === 1;
  const rot = (p.rot + dir + 4) % 4;
  for (const [kx, ky] of KICKS) {
    if (fits(w.cells, p.k, rot, p.x + kx, p.y + ky)) {
      p.rot = rot;
      p.x += kx;
      p.y += ky;
      resetLock(w);
      return true;
    }
  }
  return false;
}
/** The row the piece would stop at if dropped now. */
export function landingY(w: Well, p: Piece = w.piece!): number {
  let y = p.y;
  while (fits(w.cells, p.k, p.rot, p.x, y + 1)) y++;
  return y;
}
export function holdPiece(w: Well): boolean {
  const p = w.piece;
  if (!p || !w.canHold || w.dead) return false;
  const k = p.k;
  if (w.hold < 0) spawn(w);
  else {
    const nk = w.hold;
    w.piece = { k: nk, rot: 0, x: Math.floor((W - BOX[nk]!) / 2), y: 0 };
    w.grav = 0;
    w.lock = 0;
    w.resets = 0;
  }
  w.hold = k;
  w.canHold = false;
  return true;
}
const SEND = [0, 0, 1, 2, 4];
/** Lock the piece where it is, clear what is full, and say what was sent (garbage rows) and cleared. */
export function lockPiece(w: Well): { cleared: number[]; sent: number; perfect: boolean } {
  const p = w.piece!;
  for (const [x, y] of cellsOf(p)) if (y >= 0) w.cells[y * W + x] = p.k + 1;
  w.pieces++;
  const rows: number[] = [];
  for (let y = 0; y < H; y++) {
    let full = true;
    for (let x = 0; x < W; x++) if (!w.cells[y * W + x]) full = false;
    if (full) rows.push(y);
  }
  if (rows.length) {
    for (const y of rows) {
      w.cells.copyWithin(W, 0, y * W);
      w.cells.fill(0, 0, W);
    }
    w.lines += rows.length;
    w.combo++;
    w.flash = { rows, t: 0 };
  } else w.combo = -1;
  const perfect = rows.length > 0 && w.cells.every((c) => !c);
  const sent = rows.length ? SEND[Math.min(4, rows.length)]! + (w.combo >= 3 ? 1 : 0) + (perfect ? 6 : 0) : 0;
  w.piece = null;
  return { cleared: rows, sent, perfect };
}
/** Rise `n` rows of garbage from the bottom, each with one hole (the same column most of the time). */
export function addGarbage(w: Well, n: number): void {
  if (n <= 0) return;
  for (let i = 0; i < n; i++) {
    for (let x = 0; x < W; x++) if (w.cells[x]) w.dead = true;
    w.cells.copyWithin(0, W);
    if (w.rnd() > 0.8) w.hole = Math.floor(w.rnd() * W);
    for (let x = 0; x < W; x++) w.cells[(H - 1) * W + x] = x === w.hole ? 0 : GARBAGE;
  }
}

// ---------------------------------------------------------------- the bot

export interface Plan {
  rot: number;
  x: number;
  score: number;
}
function heights(cells: Uint8Array): number[] {
  const hs: number[] = [];
  for (let x = 0; x < W; x++) {
    let y = 0;
    while (y < H && !cells[y * W + x]) y++;
    hs.push(H - y);
  }
  return hs;
}
/** The four features of a board after a piece lands and full rows go: [aggregate height, lines cleared, holes, bumpiness]. */
export function features(cells: Uint8Array, k: number, rot: number, x: number): number[] | null {
  if (!fits(cells, k, rot, x, 0)) return null;
  let y = 0;
  while (fits(cells, k, rot, x, y + 1)) y++;
  const c = cells.slice();
  for (const [cx, cy] of CELLS[k]![rot]!) if (y + cy >= 0) c[(y + cy) * W + x + cx] = 1;
  let lines = 0;
  for (let r = H - 1; r >= 0; r--) {
    let full = true;
    for (let i = 0; i < W; i++) if (!c[r * W + i]) full = false;
    if (full) {
      lines++;
      c.copyWithin(W, 0, r * W);
      c.fill(0, 0, W);
      r++;
    }
  }
  const hs = heights(c);
  let holes = 0;
  for (let i = 0; i < W; i++) {
    let seen = false;
    for (let r = 0; r < H; r++) {
      if (c[r * W + i]) seen = true;
      else if (seen) holes++;
    }
  }
  let bump = 0;
  for (let i = 0; i < W - 1; i++) bump += Math.abs(hs[i]! - hs[i + 1]!);
  return [hs.reduce((a, b) => a + b, 0), lines, holes, bump];
}
/** All the places the current piece can go, best first by the weights. */
export function plans(w: Well, theta: readonly number[]): Plan[] {
  const p = w.piece;
  if (!p) return [];
  const out: Plan[] = [];
  for (let rot = 0; rot < (p.k === 1 ? 1 : 4); rot++)
    for (let x = -2; x < W; x++) {
      const f = features(w.cells, p.k, rot, x);
      if (!f) continue;
      out.push({ rot, x, score: f.reduce((s, v, i) => s + v * (theta[i] ?? 0), 0) });
    }
  return out.sort((a, b) => b.score - a.score);
}
/** Put the piece where the plan says and drop it (the bot places in one move: its speed is how often it does). */
function place(d: Duel, who: 1 | 2, plan: Plan): void {
  const w = who === 1 ? d.a : d.b;
  const p = w.piece!;
  p.rot = plan.rot;
  p.x = plan.x;
  p.y = landingY(w, { ...p, rot: plan.rot, x: plan.x });
  settle(d, who);
}
/** Lock a well's piece and deal with what follows: garbage sent, garbage taken, the next piece. */
function settle(d: Duel, who: 1 | 2): void {
  const w = who === 1 ? d.a : d.b;
  const o = who === 1 ? d.b : d.a;
  const r = lockPiece(w);
  d.events.push({ type: 'lock', who });
  if (r.cleared.length) {
    let sent = r.sent;
    const cancel = Math.min(sent, w.incoming);
    w.incoming -= cancel;
    sent -= cancel;
    o.incoming += sent;
    d.events.push({ type: 'clear', who, n: r.cleared.length, rows: r.cleared, sent });
    if (r.perfect) d.events.push({ type: 'perfect', who });
  } else if (w.incoming > 0) {
    const n = Math.min(w.incoming, 8);
    w.incoming -= n;
    addGarbage(w, n);
    d.events.push({ type: 'garbage', who, n });
  }
  if (w.dead) return;
  spawn(w);
}
/** The bot picks for a well: usually the best plan, sometimes (by `mistake`) one of the next best. */
function pick(d: Duel, w: Well, theta: readonly number[], mistake: number): Plan | null {
  const ps = plans(w, theta);
  if (!ps.length) return null;
  if (d.mistakeRnd() < mistake) return ps[Math.min(ps.length - 1, 1 + Math.floor(d.mistakeRnd() * Math.min(6, ps.length - 1)))]!;
  return ps[0]!;
}
/** Ghosty's bot on his own well, called every step: he places a piece every 1/pps seconds. */
export function botStep(d: Duel, who: 1 | 2, theta: readonly number[], dt: number, pps = ppsOf(d.level), mistake = mistakeOf(d.level)): void {
  const w = who === 1 ? d.a : d.b;
  if (w.dead || !w.piece || d.winner) return;
  if (who === 1) d.botA += dt;
  else d.botB += dt;
  const clock = who === 1 ? d.botA : d.botB;
  if (clock < 1 / pps) return;
  if (who === 1) d.botA = 0;
  else d.botB = 0;
  const plan = pick(d, w, theta, mistake);
  if (plan) place(d, who, plan);
  else w.dead = true;
}

// ---------------------------------------------------------------- the step

export interface Controls {
  held: ReadonlySet<string>;
  pressed: ReadonlySet<string>;
}
const DAS = 0.16;
const ARR = 0.045;
function control(d: Duel, c: Controls, dt: number): void {
  const w = d.a;
  if (w.dead || !w.piece) return;
  const dir = c.held.has('left') && !c.held.has('right') ? -1 : c.held.has('right') && !c.held.has('left') ? 1 : 0;
  if (dir !== w.dasDir) {
    w.dasDir = dir;
    w.das = 0;
    w.dasT = 0;
    if (dir && !c.pressed.has(dir < 0 ? 'left' : 'right') && move(w, dir)) d.events.push({ type: 'move', who: 1 });
  }
  if (c.pressed.has('left') && move(w, -1)) d.events.push({ type: 'move', who: 1 });
  if (c.pressed.has('right') && move(w, 1)) d.events.push({ type: 'move', who: 1 });
  if (dir) {
    w.das += dt;
    if (w.das >= DAS) {
      w.dasT += dt;
      while (w.dasT >= ARR) {
        w.dasT -= ARR;
        if (move(w, dir)) d.events.push({ type: 'move', who: 1 });
      }
    }
  }
  if ((c.pressed.has('up') || c.pressed.has('x')) && rotate(w, 1)) d.events.push({ type: 'rotate', who: 1 });
  if (c.pressed.has('b') && rotate(w, -1)) d.events.push({ type: 'rotate', who: 1 });
  if (c.pressed.has('c') && holdPiece(w)) d.events.push({ type: 'hold', who: 1 });
  if (c.pressed.has('a') && w.piece) {
    w.piece.y = landingY(w);
    d.events.push({ type: 'land', who: 1 });
    settle(d, 1);
  }
}
function gravity(d: Duel, dt: number): void {
  const w = d.a;
  if (w.dead || !w.piece || d.calm) return;
  const p = w.piece;
  const rate = gravityOf(d.level);
  w.grav += dt * rate;
  while (w.grav >= 1 && fits(w.cells, p.k, p.rot, p.x, p.y + 1)) {
    w.grav -= 1;
    p.y++;
  }
  const down = fits(w.cells, p.k, p.rot, p.x, p.y + 1);
  if (down) {
    w.lock = 0;
    if (w.grav >= 1) w.grav = 0;
  } else {
    w.grav = 0;
    w.lock += dt;
    if (w.lock >= 0.5) settle(d, 1);
  }
}
/** One fixed step: your keys, gravity on your well, the level's own pressure, the bots (Ghosty on his; yours too when `botA` is true). */
export function step(d: Duel, dt: number, c: Controls, botA: readonly number[] | null = null): void {
  if (d.winner) return;
  d.t += dt;
  if (d.a.flash) d.a.flash.t += dt;
  if (d.b.flash) d.b.flash.t += dt;
  if (d.a.piece && !botA) {
    control(d, c, dt);
    // soft drop: held down falls fast
    if (c.held.has('down') && d.a.piece && fits(d.a.cells, d.a.piece.k, d.a.piece.rot, d.a.piece.x, d.a.piece.y + 1)) d.a.grav += dt * 22;
    gravity(d, dt);
  } else if (botA) botStep(d, 1, botA, dt, ppsOf(d.level), 0);
  botStep(d, 2, d.theta, dt);
  d.pressure -= dt;
  if (d.pressure <= 0) {
    d.pressure = pressureEvery(d.level);
    d.a.incoming += 1;
    d.b.incoming += 1;
  }
  const side = (w: Well, who: 1 | 2) => {
    if (w.dead) d.events.push({ type: 'dead', who });
  };
  if (d.a.dead || d.b.dead) {
    side(d.a, 1);
    side(d.b, 2);
    d.winner = d.a.dead ? 2 : 1;
  } else if (d.a.lines >= d.target || d.b.lines >= d.target) d.winner = d.a.lines >= d.b.lines ? 1 : 2;
}

// ---------------------------------------------------------------- the GYM's way in

export const ACTIONS = ['none', 'left', 'right', 'rotate', 'down', 'drop', 'hold'] as const;
export type Action = (typeof ACTIONS)[number];
export interface BlocksObs {
  /** The visible rows, top first, ten numbers each (0 empty). */
  rows: number[][];
  piece: { k: number; rot: number; x: number; y: number } | null;
  next: number[];
  hold: number;
  incoming: number;
  theirLines: number;
  heights: number[];
}
export function blocksLearnable(seed = 1, level = 1): Learnable<BlocksObs, Action> & { duel: Duel } {
  const d = newDuel(seed, level, null);
  const none = new Set<string>();
  return {
    duel: d,
    id: 'blocks',
    actions: ACTIONS,
    observe() {
      const rows: number[][] = [];
      for (let y = HIDDEN; y < H; y++) rows.push(Array.from(d.a.cells.subarray(y * W, y * W + W)));
      return { rows, piece: d.a.piece ? { ...d.a.piece } : null, next: d.a.queue.slice(0, 3), hold: d.a.hold, incoming: d.a.incoming, theirLines: d.b.lines, heights: heights(d.a.cells) };
    },
    act(a) {
      const name = a === 'left' ? 'left' : a === 'right' ? 'right' : a === 'rotate' ? 'up' : a === 'drop' ? 'a' : a === 'hold' ? 'c' : '';
      step(d, 1 / 60, { held: a === 'down' ? new Set(['down']) : none, pressed: name ? new Set([name]) : none });
    },
    score: () => d.a.lines,
    done: () => d.winner !== 0,
  };
}
