/**
 * MAZE: a grid with walls (#), mud (~) and gold (G). Every step costs 1, walking into a wall costs 10 and
 * goes nowhere, stepping into mud costs 2 more, reaching the gold pays 100. Ghosty learns by tabular
 * Q-learning (a value for every cell and direction, optimistic at the start so he explores). Ground truth:
 * the cheapest route from every start cell (breadth-first search with mud counted as 3 steps, i.e.
 * Dijkstra); mastery = the share of start cells where his greedy route costs exactly that.
 * Levels grow the grid (5×5 → 14×14) and the walls and mud.
 */
import { argmax, type Cell, type Env, type Frame, type Game, type Learner, lvl, type Problem, rng, savedFor, type Verdict } from './core';

export const WALL = 1;
export const MUD = 2;
export const GOLD = 3;
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];
const DIRS = 'NESW';
const ARROWS = ['↑', '→', '↓', '←'];

export interface Maze {
  w: number;
  h: number;
  /** 0 floor, 1 wall, 2 mud, 3 gold. */
  cells: Uint8Array;
  gold: number;
}

export const mazeSize = (level: number) => 4 + lvl(level);

/** A maze for a level: every floor cell can reach the gold (cut-off pockets become wall). */
export function makeMaze(level: number, seed: number): Maze {
  const L = lvl(level);
  const n = mazeSize(L);
  const r = rng(seed * 7919 + L);
  for (;;) {
    const cells = new Uint8Array(n * n);
    for (let i = 0; i < n * n; i++) {
      const x = r();
      cells[i] = x < 0.14 + 0.014 * L ? WALL : x < 0.2 + 0.024 * L ? MUD : 0;
    }
    const gold = Math.floor(r() * n * n);
    cells[gold] = GOLD;
    const seen = new Uint8Array(n * n);
    const q = [gold];
    seen[gold] = 1;
    while (q.length) {
      const c = q.pop()!;
      for (let d = 0; d < 4; d++) {
        const nb = move(n, n, c, d);
        if (nb >= 0 && !seen[nb] && cells[nb] !== WALL) (seen[nb] = 1), q.push(nb);
      }
    }
    let open = 0;
    for (let i = 0; i < n * n; i++) {
      if (!seen[i]) cells[i] = WALL;
      else open++;
    }
    if (open >= n * n * 0.45) return { w: n, h: n, cells, gold };
  }
}

/** The cell one step in direction d, or -1 off the grid. */
function move(w: number, h: number, c: number, d: number): number {
  const x = (c % w) + DX[d]!;
  const y = Math.floor(c / w) + DY[d]!;
  return x < 0 || y < 0 || x >= w || y >= h ? -1 : y * w + x;
}

/** Reward and next cell for stepping from c in direction d. */
export function stepMaze(m: Maze, c: number, d: number): { to: number; reward: number; done: boolean; bump: boolean } {
  const nb = move(m.w, m.h, c, d);
  if (nb < 0 || m.cells[nb] === WALL) return { to: c, reward: -10, done: false, bump: true };
  const k = m.cells[nb];
  if (k === GOLD) return { to: nb, reward: 99, done: true, bump: false };
  return { to: nb, reward: k === MUD ? -3 : -1, done: false, bump: false };
}

/** Ground truth: the cheapest cost from every cell to the gold (Dijkstra; 1 a step, 3 into mud, 1 into gold). */
export function cheapest(m: Maze): Int32Array {
  const N = m.w * m.h;
  const dist = new Int32Array(N).fill(-1);
  // Costs are 1 or 3, so a bucket queue is exact and simple.
  const buckets: number[][] = [[m.gold]];
  const best = new Int32Array(N).fill(1 << 30);
  best[m.gold] = 0;
  for (let cost = 0; cost < buckets.length; cost++) {
    for (const c of buckets[cost] ?? []) {
      if (dist[c]! >= 0) continue;
      dist[c] = cost;
      // Reverse edge: from nb into c costs what entering c costs.
      const enter = m.cells[c] === MUD ? 3 : 1;
      for (let d = 0; d < 4; d++) {
        const nb = move(m.w, m.h, c, d);
        if (nb < 0 || m.cells[nb] === WALL || dist[nb]! >= 0) continue;
        const nc = cost + enter;
        if (nc < best[nb]!) {
          best[nb] = nc;
          (buckets[nc] ??= []).push(nb);
        }
      }
    }
  }
  return dist;
}

export const startCells = (m: Maze) => [...m.cells.keys()].filter((i) => m.cells[i] !== WALL && m.cells[i] !== GOLD);

function rows(m: Maze, at = -1): string[] {
  const out: string[] = [];
  for (let y = 0; y < m.h; y++) {
    let s = '';
    for (let x = 0; x < m.w; x++) {
      const i = y * m.w + x;
      s += i === at ? 'S' : '.#~G'[m.cells[i]!];
    }
    out.push(s);
  }
  return out;
}

const LEGEND = '# wall, ~ mud, G gold, S you, . floor; N is up';

class MazeEnv implements Env {
  m: Maze;
  at = 0;
  steps = 0;
  constructor(private level: number) {
    this.m = makeMaze(level, 1);
  }
  reset(seed: number) {
    this.m = makeMaze(this.level, seed);
    const s = startCells(this.m);
    this.at = s[Math.floor(rng(seed)() * s.length)]!;
    this.steps = 0;
  }
  actions() {
    return [0, 1, 2, 3];
  }
  step(a: number) {
    const s = stepMaze(this.m, this.at, a);
    this.at = s.to;
    this.steps++;
    return { reward: s.reward, done: s.done || this.steps >= this.m.w * this.m.h * 4 };
  }
  describe() {
    return `Maze ${this.m.w}×${this.m.h} (${LEGEND}):\n${rows(this.m, this.at).join('\n')}`;
  }
}

/** Follow the greedy policy from `start`: the route's cost, or -1 if it bumps a wall, loops or never arrives. */
function greedyCost(m: Maze, q: Float32Array, start: number): { cost: number; path: number[] } {
  let c = start;
  let cost = 0;
  const path = [c];
  for (let n = 0; n < m.w * m.h; n++) {
    const d = argmax(q, c * 4, 4);
    const s = stepMaze(m, c, d);
    if (s.bump) return { cost: -1, path };
    cost += m.cells[s.to] === MUD ? 3 : 1;
    c = s.to;
    path.push(c);
    if (s.done) return { cost, path };
  }
  return { cost: -1, path };
}

interface MazeSave {
  game: 'maze';
  level: number;
  seed: number;
  q: Float32Array;
  episodes: number;
}

class MazeLearner implements Learner {
  m: Maze;
  q: Float32Array;
  r: () => number;
  episodes = 0;
  opt: Int32Array;
  starts: number[];
  constructor(
    private level: number,
    private seed: number,
    saved?: unknown,
  ) {
    const s = savedFor<MazeSave>(saved, 'maze', level);
    if (s && s.seed !== seed) this.seed = s.seed;
    this.m = makeMaze(level, this.seed);
    this.opt = cheapest(this.m);
    this.starts = startCells(this.m);
    this.q = s && s.q.length === this.m.cells.length * 4 ? s.q : new Float32Array(this.m.cells.length * 4).fill(100);
    this.episodes = s?.episodes ?? 0;
    this.r = rng(this.seed * 31 + this.episodes);
  }
  train(n: number) {
    const { m, q, r } = this;
    const cap = m.w * m.h * 4;
    for (let e = 0; e < n; e++) {
      let c = this.starts[Math.floor(r() * this.starts.length)]!;
      for (let t = 0; t < cap; t++) {
        const d = r() < 0.1 ? Math.floor(r() * 4) : argmax(q, c * 4, 4);
        const s = stepMaze(m, c, d);
        const target = s.done ? s.reward : s.reward + q[s.to * 4 + argmax(q, s.to * 4, 4)]!;
        q[c * 4 + d]! += 0.5 * (target - q[c * 4 + d]!);
        c = s.to;
        if (s.done) break;
      }
    }
    this.episodes += n;
    return n;
  }
  measure() {
    let good = 0;
    for (const s of this.starts) if (greedyCost(this.m, this.q, s).cost === this.opt[s]) good++;
    return { mastery: good / this.starts.length, detail: `His route is the cheapest from ${good} of ${this.starts.length} start cells (checked by breadth-first search).` };
  }
  save(): MazeSave {
    return { game: 'maze', level: this.level, seed: this.seed, q: this.q, episodes: this.episodes };
  }
  /** The value map: brighter = closer to the gold in his eyes, an arrow for his choice in each cell. */
  view(): Frame {
    const { m, q } = this;
    const vals = [...m.cells.keys()].map((i) => q[i * 4 + argmax(q, i * 4, 4)]!);
    const free = vals.filter((_, i) => m.cells[i] !== WALL && m.cells[i] !== GOLD);
    const lo = Math.min(...free);
    const hi = Math.max(...free);
    const cells: Cell[] = [...m.cells].map((k, i) => {
      if (k === WALL) return { c: 'wall' };
      if (k === GOLD) return { t: '★', c: 'gold' };
      const f = hi > lo ? (vals[i]! - lo) / (hi - lo) : 0;
      return { t: ARROWS[argmax(q, i * 4, 4)], c: k === MUD ? 'mud' : `hsl(${190 - 150 * f} 90% ${14 + 34 * f}%)` };
    });
    return { grid: { w: m.w, h: m.h, cells }, caption: 'His value map: brighter cells are closer to the gold; arrows are his choice.' };
  }
  watch(seed: number): Frame[] {
    const start = this.starts[Math.floor(rng(seed)() * this.starts.length)]!;
    const { path, cost } = greedyCost(this.m, this.q, start);
    const best = this.opt[start]!;
    return path.map((at, i) => {
      const cells: Cell[] = [...this.m.cells].map((k, j) => (j === at ? { t: '●', c: 'me' } : k === WALL ? { c: 'wall' } : k === GOLD ? { t: '★', c: 'gold' } : path.slice(0, i).includes(j) ? { c: 'path' } : k === MUD ? { c: 'mud' } : {}));
      const last = i === path.length - 1;
      const caption = !last ? `Step ${i} of his route` : cost < 0 ? 'He got stuck — still learning this part of the maze.' : cost === best ? `Gold in ${cost} (the cheapest route).` : `Gold in ${cost}; the cheapest is ${best}.`;
      return { grid: { w: this.m.w, h: this.m.h, cells }, caption };
    });
  }
}

function generate(level: number, seed: number): Problem {
  const m = makeMaze(level, seed);
  const s = startCells(m);
  const start = s[Math.floor(rng(seed + 1)() * s.length)]!;
  const opt = cheapest(m)[start]!;
  const text = `A maze (${LEGEND}). Each step costs 1, stepping into mud costs 3, walls cannot be crossed. Give the cheapest route from S to G as a string of the letters N, E, S, W.\n${rows(m, start).join('\n')}`;
  return { game: 'maze', level: lvl(level), seed, text, data: { level: lvl(level), seed, start, opt } };
}

function check(p: Problem, answer: string): Verdict {
  const d = p.data as { level: number; seed: number; start: number; opt: number };
  const m = makeMaze(d.level, d.seed);
  const moves = answer.toUpperCase().replace(/[^NESW]/g, '');
  let c = d.start;
  let cost = 0;
  for (const ch of moves) {
    const s = stepMaze(m, c, DIRS.indexOf(ch));
    if (s.bump) return { correct: false, score: 0, why: 'The route walks into a wall.' };
    cost += m.cells[s.to] === MUD ? 3 : 1;
    c = s.to;
    if (s.done) break;
  }
  if (c !== m.gold) return { correct: false, score: 0, why: 'The route does not reach the gold.' };
  return { correct: cost === d.opt, score: d.opt / cost, why: cost === d.opt ? `Cheapest: cost ${cost}.` : `Cost ${cost}; the cheapest is ${d.opt}.` };
}

export const maze: Game = {
  id: 'maze',
  title: 'MAZE',
  blurb: 'walls · mud · gold',
  learns: 'He learns which way to step from every cell to reach the gold for the least cost.',
  unit: 'runs',
  bar: () => 0.95,
  env: (level) => new MazeEnv(level),
  generate,
  check,
  learner: (level, seed, saved) => new MazeLearner(level, seed, saved),
};
