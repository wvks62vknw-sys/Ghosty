/**
 * SNAKE (the growing-line genre). Options the board reads from GameConfig.options:
 *   size:  number (10 to 30 cells a side, default 16)
 *   speed: number (steps a second at the start, 4 to 15, default 7; it quickens as he eats)
 *   wrap:  boolean (going off one edge comes back on the other, default false)
 * Each food is 10 points times the current speed level; running into the walls (when not wrapping) or itself ends it.
 */
import { type Rng } from './rng';

export type Dir = 'up' | 'down' | 'left' | 'right';
export interface Snake {
  size: number;
  body: number[]; // head first, cell indexes
  dir: Dir;
  queued: Dir[];
  food: number;
  wrap: boolean;
  score: number;
  eaten: number;
  alive: boolean;
}

const OPP: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

export function start(size: number, wrap: boolean, r: Rng): Snake {
  const mid = Math.floor(size / 2) * size + Math.floor(size / 2);
  const s: Snake = { size, body: [mid, mid - 1, mid - 2], dir: 'right', queued: [], food: -1, wrap, score: 0, eaten: 0, alive: true };
  placeFood(s, r);
  return s;
}

export function placeFood(s: Snake, r: Rng): void {
  const taken = new Set(s.body);
  const free = [...Array(s.size * s.size).keys()].filter((i) => !taken.has(i));
  s.food = free.length ? free[Math.floor(r() * free.length)]! : -1;
}

/** Ask for a turn; at most two waiting, never straight back on itself. */
export function turn(s: Snake, d: Dir): void {
  const last = s.queued[s.queued.length - 1] ?? s.dir;
  if (d !== last && d !== OPP[last] && s.queued.length < 2) s.queued.push(d);
}

/** One step. Returns 'ate', 'died' or 'moved'. */
export function step(s: Snake, r: Rng): 'ate' | 'died' | 'moved' {
  if (!s.alive) return 'died';
  s.dir = s.queued.shift() ?? s.dir;
  const n = s.size;
  const head = s.body[0]!;
  let row = Math.floor(head / n);
  let col = head % n;
  if (s.dir === 'up') row--;
  if (s.dir === 'down') row++;
  if (s.dir === 'left') col--;
  if (s.dir === 'right') col++;
  if (s.wrap) {
    row = (row + n) % n;
    col = (col + n) % n;
  } else if (row < 0 || row >= n || col < 0 || col >= n) {
    s.alive = false;
    return 'died';
  }
  const next = row * n + col;
  const eats = next === s.food;
  const bodyCheck = eats ? s.body : s.body.slice(0, -1);
  if (bodyCheck.includes(next)) {
    s.alive = false;
    return 'died';
  }
  s.body.unshift(next);
  if (eats) {
    s.eaten++;
    s.score += 10 * level(s);
    placeFood(s, r);
    if (s.food < 0) s.alive = false; // the board is full: a perfect game
    return 'ate';
  }
  s.body.pop();
  return 'moved';
}

/** The speed level: one more every five foods. */
export const level = (s: Snake): number => 1 + Math.floor(s.eaten / 5);
/** Milliseconds per step for a starting speed. */
export const stepMs = (s: Snake, speed: number): number => Math.max(50, Math.round(1000 / (speed + (level(s) - 1) * 0.8)));
