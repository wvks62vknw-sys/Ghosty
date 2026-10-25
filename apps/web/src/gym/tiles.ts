/**
 * SLIDING TILES: the 8-puzzle (Levels 1–7), then the 15-puzzle (Levels 8–10). Ghosty searches (A*: the
 * moves so far plus his guess of the moves still needed) with a node budget, and learns the guess — a
 * weighted mix of the Manhattan distance, linear conflicts and misplaced tiles — from his own scrambles:
 * a state k random moves from solved is at most k moves away, and the states on a route he found are at
 * most the rest of that route away; he fits the weights to those numbers. Ground truth: A* (IDA* on the
 * 15-puzzle) with the admissible Manhattan + linear-conflict heuristic, which finds the shortest solution;
 * mastery = average (shortest length ÷ his length) over a fixed set of puzzles, 0 for one he can't solve
 * within the budget. Levels scramble deeper, then move to the 15-puzzle.
 */
import { TILE_SETS } from './tilesets';
import { type Cell, finalLine, readMoves, type Env, type Frame, type Game, type Learner, lvl, type Problem, rng, savedFor, type Verdict } from './core';
import { TILES } from './meta';

export const sizeFor = (level: number) => (lvl(level) <= 7 ? 3 : 4);
/** Random moves used to scramble a puzzle at each level. */
export const depthFor = (level: number) => [6, 10, 14, 18, 24, 32, 60, 24, 32, 40][lvl(level) - 1]!;
/** Positions he may look at per puzzle in the test: a few for every move of the scramble, so blind search runs out. */
export const budgetFor = (level: number) => depthFor(level) * (sizeFor(level) === 3 ? 12 : 30);
/** Practice searches may look further (that is how he finds routes to learn from at first). */
const PRACTICE = (n: number) => (n === 3 ? 3000 : 12000);
const MOVES = 'UDLR';
const DR = [-1, 1, 0, 0];
const DC = [0, 0, -1, 1];
const OPP = [1, 0, 3, 2];

export type Board = number[];

export const solved = (n: number): Board => [...Array(n * n).keys()].map((i) => (i + 1) % (n * n));
const keyOf = (b: Board) => b.join(',');

/** Move the blank in direction d (0 up, 1 down, 2 left, 3 right); null if it would leave the board. */
export function slide(b: Board, n: number, d: number): Board | null {
  const z = b.indexOf(0);
  const r = Math.floor(z / n) + DR[d]!;
  const c = (z % n) + DC[d]!;
  if (r < 0 || c < 0 || r >= n || c >= n) return null;
  const nb = b.slice();
  nb[z] = nb[r * n + c]!;
  nb[r * n + c] = 0;
  return nb;
}

export function scramble(n: number, moves: number, r: () => number): Board {
  let b = solved(n);
  let last = -1;
  for (let i = 0; i < moves; i++) {
    const ds = [0, 1, 2, 3].filter((d) => d !== OPP[last] && slide(b, n, d));
    const d = ds[Math.floor(r() * ds.length)]!;
    b = slide(b, n, d)!;
    last = d;
  }
  return b;
}

export function manhattan(b: Board, n: number): number {
  let s = 0;
  for (let i = 0; i < b.length; i++) {
    const t = b[i]!;
    if (!t) continue;
    s += Math.abs(Math.floor(i / n) - Math.floor((t - 1) / n)) + Math.abs((i % n) - ((t - 1) % n));
  }
  return s;
}

/** Linear conflicts: two tiles in their goal row (or column) in the wrong order; each costs 2 moves more (admissible). */
export function linearConflict(b: Board, n: number): number {
  let c = 0;
  for (let line = 0; line < n; line++) {
    for (const row of [true, false]) {
      const tiles: number[] = [];
      for (let k = 0; k < n; k++) {
        const i = row ? line * n + k : k * n + line;
        const t = b[i]!;
        if (!t) continue;
        const gr = Math.floor((t - 1) / n);
        const gc = (t - 1) % n;
        if (row ? gr === line : gc === line) tiles.push(row ? gc : gr);
      }
      // Count the fewest tiles to remove so the rest are in order (n ≤ 4: a small longest-increasing run).
      const lis = new Array(tiles.length).fill(1);
      for (let i = 0; i < tiles.length; i++) for (let j = 0; j < i; j++) if (tiles[j]! < tiles[i]!) lis[i] = Math.max(lis[i], lis[j] + 1);
      c += tiles.length - (tiles.length ? Math.max(...lis) : 0);
    }
  }
  return 2 * c;
}

const misplaced = (b: Board) => b.reduce((s, t, i) => s + (t && t !== i + 1 ? 1 : 0), 0);
export const features = (b: Board, n: number) => [manhattan(b, n), linearConflict(b, n), misplaced(b)];

/** A small binary heap of [priority, tie, item]. */
class Heap<T> {
  a: [number, number, T][] = [];
  push(p: number, t: number, x: T) {
    const a = this.a;
    a.push([p, t, x]);
    let i = a.length - 1;
    while (i > 0) {
      const j = (i - 1) >> 1;
      if (a[j]![0] < p || (a[j]![0] === p && a[j]![1] <= t)) break;
      [a[i], a[j]] = [a[j]!, a[i]!];
      i = j;
    }
  }
  pop(): T | undefined {
    const a = this.a;
    if (!a.length) return undefined;
    const top = a[0]!;
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        const lt = (x: number, y: number) => a[x]![0] < a[y]![0] || (a[x]![0] === a[y]![0] && a[x]![1] < a[y]![1]);
        if (l < a.length && lt(l, m)) m = l;
        if (r < a.length && lt(r, m)) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m]!, a[i]!];
        i = m;
      }
    }
    return top[2];
  }
  get size() {
    return this.a.length;
  }
}

/** A* with a heuristic and a node budget: the moves (blank directions), or null if the budget ran out. */
export function astar(start: Board, n: number, h: (b: Board) => number, budget: number): { moves: number[]; nodes: number } | null {
  const goal = keyOf(solved(n));
  const g = new Map<string, number>([[keyOf(start), 0]]);
  const from = new Map<string, [string, number]>();
  const heap = new Heap<Board>();
  heap.push(h(start), 0, start);
  let nodes = 0;
  while (heap.size) {
    const b = heap.pop()!;
    const k = keyOf(b);
    if (k === goal) {
      const moves: number[] = [];
      let cur = k;
      while (from.has(cur)) {
        const [prev, d] = from.get(cur)!;
        moves.unshift(d);
        cur = prev;
      }
      return { moves, nodes };
    }
    if (++nodes > budget) return null;
    const gb = g.get(k)!;
    for (let d = 0; d < 4; d++) {
      const nb = slide(b, n, d);
      if (!nb) continue;
      const nk = keyOf(nb);
      const ng = gb + 1;
      if (ng >= (g.get(nk) ?? Infinity)) continue;
      g.set(nk, ng);
      from.set(nk, [k, d]);
      const hv = h(nb);
      heap.push(ng + hv, hv, nb);
    }
  }
  return null;
}

/** IDA* with Manhattan + linear conflict: the shortest solution length (ground truth for the 15-puzzle). */
export function idaStar(start: Board, n: number): number {
  const b = start.slice();
  const hOf = (x: Board) => manhattan(x, n) + linearConflict(x, n);
  let bound = hOf(b);
  const goalH = (x: Board) => hOf(x) === 0;
  for (;;) {
    let next = Infinity;
    const dfs = (gc: number, last: number): boolean => {
      const f = gc + hOf(b);
      if (f > bound) {
        next = Math.min(next, f);
        return false;
      }
      if (goalH(b)) return true;
      const z = b.indexOf(0);
      for (let d = 0; d < 4; d++) {
        if (d === OPP[last]) continue;
        const r = Math.floor(z / n) + DR[d]!;
        const c = (z % n) + DC[d]!;
        if (r < 0 || c < 0 || r >= n || c >= n) continue;
        const t = r * n + c;
        b[z] = b[t]!;
        b[t] = 0;
        const found = dfs(gc + 1, d);
        b[t] = b[z]!;
        b[z] = 0;
        if (found) return true;
      }
      return false;
    };
    if (dfs(0, -1)) return bound;
    bound = next;
  }
}

/** The shortest solution length: A* on the 8-puzzle, IDA* on the 15-puzzle (both with Manhattan + linear conflict). */
export function optimal(b: Board, n: number): number {
  if (n === 3) return astar(b, n, (x) => manhattan(x, n) + linearConflict(x, n), 1e9)!.moves.length;
  return idaStar(b, n);
}

const benches = new Map<string, { board: Board; opt: number }[]>();
/**
 * The fixed benchmark for a level: 12 puzzles with their shortest solutions. They come from the stored list
 * (tilesets.ts) so the phone never waits on IDA* (the 15-puzzle levels take a second or more); `fresh` makes
 * them again with the solvers — how the list was made, and the tests check the two agree.
 */
export function bench(level: number, fresh = false): { board: Board; opt: number }[] {
  const L = lvl(level);
  const key = `${L}${fresh ? 'f' : ''}`;
  const hit = benches.get(key);
  if (hit) return hit;
  let out: { board: Board; opt: number }[] = [];
  const stored = TILE_SETS[L - 1];
  if (!fresh && stored?.length === 12) {
    out = stored.map((line) => {
      const [b, opt] = line.split(':');
      return { board: b!.split(',').map(Number), opt: Number(opt) };
    });
  } else {
    const n = sizeFor(L);
    const r = rng(5150 + L);
    while (out.length < 12) {
      const b = scramble(n, depthFor(L), r);
      const opt = optimal(b, n);
      if (opt > 0) out.push({ board: b, opt });
    }
  }
  benches.set(key, out);
  return out;
}

const rowsText = (b: Board, n: number) => [...Array(n).keys()].map((r) => b.slice(r * n, r * n + n).map((t) => (t ? String(t).padStart(2) : ' _')).join(' ')).join('\n');

class TilesEnv implements Env {
  n: number;
  b: Board;
  constructor(private level: number) {
    this.n = sizeFor(level);
    this.b = solved(this.n);
  }
  reset(seed: number) {
    this.b = scramble(this.n, depthFor(this.level), rng(seed));
  }
  actions() {
    return [0, 1, 2, 3].filter((d) => slide(this.b, this.n, d));
  }
  step(d: number) {
    const nb = slide(this.b, this.n, d);
    if (!nb) return { reward: -1, done: false };
    this.b = nb;
    return { reward: -1, done: keyOf(nb) === keyOf(solved(this.n)) };
  }
  describe() {
    return `${this.n * this.n - 1}-puzzle (_ is the gap; goal: 1 2 3 … in order, gap last):\n${rowsText(this.b, this.n)}`;
  }
}

interface TilesSave {
  game: 'tiles';
  w: number[];
  puzzles: number;
  rand: number;
}

class TilesLearner implements Learner {
  n: number;
  w: number[];
  puzzles: number;
  rand: number;
  r: () => number;
  constructor(
    private level: number,
    seed: number,
    saved?: unknown,
  ) {
    this.n = sizeFor(level);
    // His guess carries over between levels (it is about tiles, not about one puzzle).
    const s = savedFor<TilesSave>(saved, 'tiles');
    this.w = s?.w?.length === 3 ? s.w.slice() : [0, 0, 0];
    this.puzzles = s?.puzzles ?? 0;
    this.rand = s?.rand ?? seed;
    this.r = rng(this.rand);
  }
  h = (b: Board) => {
    const f = features(b, this.n);
    return Math.max(0, this.w[0]! * f[0]! + this.w[1]! * f[1]! + this.w[2]! * f[2]!);
  };
  /** One gradient step toward "this state is about `target` moves from solved". */
  fit(b: Board, target: number) {
    const f = features(b, this.n);
    const err = this.w[0]! * f[0]! + this.w[1]! * f[1]! + this.w[2]! * f[2]! - target;
    const norm = 1 + f[0]! * f[0]! + f[1]! * f[1]! + f[2]! * f[2]!;
    for (let i = 0; i < 3; i++) this.w[i]! -= (0.5 * err * f[i]!) / norm;
  }
  train(k: number) {
    const n = this.n;
    for (let j = 0; j < k; j++) {
      // A scramble of up to the level's depth; along the way each state is at most i moves from solved.
      const len = 1 + Math.floor(this.r() * depthFor(this.level));
      let b = solved(n);
      let last = -1;
      const seen = new Map<string, number>([[keyOf(b), 0]]);
      const walk: [Board, number][] = [];
      for (let i = 1; i <= len; i++) {
        const ds = [0, 1, 2, 3].filter((d) => d !== OPP[last] && slide(b, n, d));
        last = ds[Math.floor(this.r() * ds.length)]!;
        b = slide(b, n, last)!;
        const kk = keyOf(b);
        const best = Math.min(i, seen.get(kk) ?? Infinity);
        seen.set(kk, best);
        walk.push([b, best]);
      }
      // Try to solve it with what he knows; a route found tightens the targets.
      const sol = astar(b, n, this.h, PRACTICE(n));
      if (sol) {
        let cur = b;
        sol.moves.forEach((d, i) => {
          const kk = keyOf(cur);
          seen.set(kk, Math.min(seen.get(kk) ?? Infinity, sol.moves.length - i));
          cur = slide(cur, n, d)!;
        });
      }
      for (const [s] of walk) this.fit(s, seen.get(keyOf(s))!);
    }
    this.puzzles += k;
    this.rand = (this.rand + k * 2654435761) >>> 0;
    return k;
  }
  measure() {
    const set = bench(this.level);
    let sum = 0;
    let solvedN = 0;
    for (const t of set) {
      const s = astar(t.board, this.n, this.h, budgetFor(this.level));
      if (!s) continue;
      solvedN++;
      sum += t.opt / s.moves.length;
    }
    const name = `${this.n * this.n - 1}-puzzle`;
    return {
      mastery: sum / set.length,
      detail: `${name}, ${depthFor(this.level)}-move scrambles: I solve ${solvedN} of ${set.length} within ${budgetFor(this.level).toLocaleString('en-GB')} positions; my routes are ${Math.round((sum / Math.max(1, solvedN)) * 100)}% as short as the shortest (A* with Manhattan + linear conflict).`,
    };
  }
  save(): TilesSave {
    return { game: 'tiles', w: this.w.slice(), puzzles: this.puzzles, rand: this.rand };
  }
  view(): Frame {
    const names = ['Manhattan distance', 'linear conflicts', 'misplaced tiles'];
    const mx = Math.max(1, ...this.w.map(Math.abs));
    return { bars: names.map((nm, i) => [nm, Math.abs(this.w[i]!) / mx, this.w[i]!.toFixed(2)] as [string, number, string]), caption: 'His guess of the moves left = these clues × their weights.' };
  }
  watch(seed: number): Frame[] {
    const n = this.n;
    const b = scramble(n, depthFor(this.level), rng(seed));
    const s = astar(b, n, this.h, PRACTICE(n));
    const frame = (x: Board, caption: string): Frame => ({
      grid: { w: n, h: n, cells: x.map((t, i): Cell => (t ? { t: String(t), c: t === i + 1 ? 'hit' : '' } : { c: 'dim' })) },
      caption,
    });
    if (!s) return [frame(b, 'Too hard for him yet: he ran out of search.')];
    const frames = [frame(b, `Scrambled. He plans ${s.moves.length} moves (searched ${s.nodes.toLocaleString('en-GB')} positions).`)];
    let cur = b;
    s.moves.forEach((d, i) => {
      cur = slide(cur, n, d)!;
      frames.push(frame(cur, i === s.moves.length - 1 ? `Solved in ${s.moves.length} moves.` : `Move ${i + 1} of ${s.moves.length}`));
    });
    return frames;
  }
}

function generate(level: number, seed: number): Problem {
  const L = lvl(level);
  const n = sizeFor(L);
  const b = scramble(n, depthFor(L), rng(seed));
  const opt = optimal(b, n);
  const text = `Sliding puzzle (${n}×${n}; _ is the gap). Goal: the numbers in order left to right, top to bottom, gap last.\n${rowsText(b, n)}\nGive the shortest sequence of gap moves as letters: U (gap moves up), D, L, R.`;
  return { game: 'tiles', level: L, seed, text, data: { board: b, n, opt } };
}

function check(p: Problem, answer: string): Verdict {
  const d = p.data as { board: Board; n: number; opt: number };
  let b = d.board;
  const moves = readMoves(finalLine(answer), MOVES, ['UP', 'DOWN', 'LEFT', 'RIGHT']);
  for (const dir of moves) {
    const nb = slide(b, d.n, dir);
    if (!nb) return { correct: false, score: 0, why: 'A move pushes the gap off the board.' };
    b = nb;
  }
  if (keyOf(b) !== keyOf(solved(d.n))) return { correct: false, score: 0, why: 'The puzzle is not solved at the end.' };
  return { correct: moves.length === d.opt, score: d.opt / Math.max(1, moves.length), why: moves.length === d.opt ? `Shortest: ${d.opt} moves.` : `${moves.length} moves; the shortest is ${d.opt}.` };
}

export const tiles: Game = {
  ...TILES,
  env: (level) => new TilesEnv(level),
  generate,
  check,
  learner: (level, seed, saved) => new TilesLearner(level, seed, saved),
};
