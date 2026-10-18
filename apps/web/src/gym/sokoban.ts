/**
 * SOKOBAN: push every box onto a goal (boxes can only be pushed, never pulled, one at a time). Puzzles are
 * made by playing backwards — boxes start on their goals and are PULLED around at random — so every one
 * can be solved. Ground truth: an exact breadth-first solver over pushes, which finds the fewest pushes
 * (stored for a fixed held-out set per level, so the phone never waits on it).
 *
 * Learner: a best-first search over pushes with a node budget, guided by two things he learns from his
 * own practice puzzles (never the held-out ones): a guess of how many pushes are still needed (a weighted
 * mix of distances, fitted to the pushes that were really left on routes he found and on the backward
 * play that made the puzzle), and which squares are dead ends for a box — local wall shapes in which,
 * in all his practice puzzles, a box could never again reach a goal. Untrained he searches blindly and
 * runs out of budget. Mastery = average over the held-out puzzles of (fewest pushes ÷ his pushes), 0 for
 * one he does not solve within the budget. Levels add boxes and room.
 */
import { SOKO_SETS } from './sokosets';
import { finalLine, readMoves, type Cell, type Env, type Frame, type Game, type Learner, lvl, type Problem, rng, savedFor, type Verdict } from './core';
import { SOKOBAN } from './meta';

/** A puzzle: width, height, walls, goals, boxes (cell indices), the player's cell. */
export interface Soko {
  w: number;
  h: number;
  wall: Uint8Array;
  goals: number[];
  boxes: number[];
  player: number;
}

export interface LevelSpec {
  w: number;
  h: number;
  boxes: number;
  pulls: number;
  minPush: number;
  /** Positions his search may open per puzzle in the test, per push of its shortest solution. */
  budget: number;
}
export function spec(level: number): LevelSpec {
  const L = lvl(level);
  return [
    { w: 7, h: 7, boxes: 1, pulls: 30, minPush: 7, budget: 1.5 },
    { w: 7, h: 7, boxes: 2, pulls: 40, minPush: 10, budget: 4 },
    { w: 8, h: 7, boxes: 2, pulls: 50, minPush: 14, budget: 5 },
    { w: 8, h: 8, boxes: 3, pulls: 60, minPush: 16, budget: 6 },
    { w: 9, h: 8, boxes: 3, pulls: 70, minPush: 19, budget: 7 },
    { w: 9, h: 9, boxes: 3, pulls: 80, minPush: 22, budget: 8 },
    { w: 9, h: 9, boxes: 4, pulls: 80, minPush: 22, budget: 9 },
    { w: 10, h: 9, boxes: 4, pulls: 90, minPush: 25, budget: 10 },
    { w: 10, h: 10, boxes: 4, pulls: 100, minPush: 28, budget: 11 },
    { w: 10, h: 10, boxes: 4, pulls: 110, minPush: 30, budget: 12 },
][L - 1]!;
}

/** His node budget for a puzzle whose shortest solution has `opt` pushes. */
export const budgetFor = (level: number, opt: number) => Math.ceil(spec(level).budget * opt);

const DIRS = (w: number) => [-w, w, -1, 1];
const LETTERS = 'UDLR';

// ---- making puzzles (backwards play) -----------------------------------------------------------------------------

/** The cells the player can walk to without pushing anything. */
export function reach(p: Soko, boxes: Set<number> | number[], from: number): Uint8Array {
  const bx = boxes instanceof Set ? boxes : new Set(boxes);
  const seen = new Uint8Array(p.w * p.h);
  const q = [from];
  seen[from] = 1;
  const D = DIRS(p.w);
  while (q.length) {
    const c = q.pop()!;
    for (const d of D) {
      const n = c + d;
      if (!seen[n] && !p.wall[n] && !bx.has(n)) (seen[n] = 1), q.push(n);
    }
  }
  return seen;
}

function room(r: () => number, w: number, h: number): Uint8Array {
  for (;;) {
    const wall = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!x || !y || x === w - 1 || y === h - 1) wall[y * w + x] = 1;
    // A few blocks of wall inside.
    const blobs = Math.floor((w * h) / 12);
    for (let i = 0; i < blobs; i++) {
      const x = 1 + Math.floor(r() * (w - 2));
      const y = 1 + Math.floor(r() * (h - 2));
      wall[y * w + x] = 1;
      if (r() < 0.4 && x + 1 < w - 1) wall[y * w + x + 1] = 1;
      if (r() < 0.3 && y + 1 < h - 1) wall[(y + 1) * w + x] = 1;
    }
    // Keep the largest open area; the rest becomes wall.
    const floor = [...wall.keys()].filter((c) => !wall[c]);
    if (floor.length < (w - 2) * (h - 2) * 0.55) continue;
    let best: Uint8Array | null = null;
    let bestN = 0;
    const done = new Uint8Array(w * h);
    for (const c of floor) {
      if (done[c]) continue;
      const seen = reach({ w, h, wall, goals: [], boxes: [], player: c }, [], c);
      let n = 0;
      for (let i = 0; i < seen.length; i++) if (seen[i]) (n++, (done[i] = 1));
      if (n > bestN) (bestN = n), (best = seen);
    }
    for (let i = 0; i < wall.length; i++) if (!best![i]) wall[i] = 1;
    return wall;
  }
}

/**
 * A puzzle made by backwards play: boxes start on the goals, the player pulls them around (a pull: the
 * player steps back from a box and drags it along). Undoing the pulls as pushes solves it, so every puzzle
 * can be solved; `pulls` is that route's length in pushes (at most — the fewest can be less).
 */
export function makePuzzle(level: number, r: () => number, S = spec(level)): { p: Soko; route: number[][] } | null {
  const wall = room(r, S.w, S.h);
  const floor = [...wall.keys()].filter((c) => !wall[c]);
  if (floor.length < S.boxes * 4 + 6) return null;
  const goals: number[] = [];
  while (goals.length < S.boxes) {
    const c = floor[Math.floor(r() * floor.length)]!;
    if (!goals.includes(c)) goals.push(c);
  }
  const p: Soko = { w: S.w, h: S.h, wall, goals: goals.slice().sort((a, b) => a - b), boxes: [], player: 0 };
  const boxes = new Set(goals);
  let player = floor.find((c) => !boxes.has(c))!;
  const D = DIRS(S.w);
  const route: number[][] = [[...boxes].sort((a, b) => a - b)];
  let lastD = 0;
  for (let i = 0; i < S.pulls; i++) {
    const can = reach(p, boxes, player);
    const opts: [number, number][] = [];
    for (const c of floor) {
      if (!can[c]) continue;
      for (const d of D) {
        // Player at c, box at c + d, room behind the player at c − d.
        if (boxes.has(c + d) && !wall[c - d] && !boxes.has(c - d)) opts.push([c, d]);
      }
    }
    if (!opts.length) break;
    // Mostly keep pulling the same box the same way (long moves make harder puzzles than jiggling).
    const same = opts.filter(([c, d]) => c === player && d === lastD);
    const [c, d] = same.length && r() < 0.7 ? same[0]! : opts[Math.floor(r() * opts.length)]!;
    lastD = d;
    boxes.delete(c + d);
    boxes.add(c);
    player = c - d;
    route.push([...boxes].sort((a, b) => a - b));
  }
  // The player ends anywhere it can walk to.
  const can = reach(p, boxes, player);
  const spots = floor.filter((c) => can[c]);
  p.player = spots[Math.floor(r() * spots.length)]!;
  p.boxes = [...boxes].sort((a, b) => a - b);
  if (p.boxes.every((b) => p.goals.includes(b))) return null;
  return { p, route: route.reverse() };
}

// ---- the exact solver (ground truth) --------------------------------------------------------------------------------

/** Squares from which a box can still reach some goal (pulled backwards from the goals). Exact. */
export function liveSquares(p: Soko): Uint8Array {
  const live = new Uint8Array(p.w * p.h);
  const D = DIRS(p.w);
  const q = p.goals.slice();
  for (const g of q) live[g] = 1;
  while (q.length) {
    const c = q.pop()!;
    for (const d of D) {
      // A box at c can be pulled to c + d if the player can stand at c + d and step back to c + 2d.
      const n = c + d;
      if (!p.wall[n] && !p.wall[n + d] && !live[n]) (live[n] = 1), q.push(n);
    }
  }
  return live;
}

const keyOf = (boxes: number[], norm: number) => `${boxes.join(',')}|${norm}`;
const normOf = (seen: Uint8Array) => seen.indexOf(1);

/** One push: from boxes and a player that can walk to `at`, push the box at at + d. */
interface Push {
  at: number;
  d: number;
  boxes: number[];
}

/** Every push possible now (not onto a wall, a box, or a square in `dead`). */
export function pushes(p: Soko, boxes: number[], player: number, dead: Uint8Array | null): { seen: Uint8Array; list: Push[] } {
  const bx = new Set(boxes);
  const seen = reach(p, bx, player);
  const D = DIRS(p.w);
  const list: Push[] = [];
  for (let k = 0; k < boxes.length; k++) {
    const b = boxes[k]!;
    for (const d of D) {
      const to = b + d;
      if (!seen[b - d] || p.wall[to] || bx.has(to) || (dead && dead[to])) continue;
      const nb = boxes.slice();
      nb[k] = to;
      nb.sort((x, y) => x - y);
      list.push({ at: b - d, d, boxes: nb });
    }
  }
  return { seen, list };
}

const solvedBy = (p: Soko, boxes: number[]) => boxes.every((b) => p.goals.includes(b));

/** For each goal: the fewest pushes that bring a lone box from each square to it (pulling backwards from the goal). */
export function pushDistances(p: Soko): Int16Array[] {
  const D = DIRS(p.w);
  return p.goals.map((g) => {
    const d = new Int16Array(p.w * p.h).fill(999);
    d[g] = 0;
    const q = [g];
    for (let i = 0; i < q.length; i++) {
      const c = q[i]!;
      for (const s of D) {
        const n = c + s;
        if (!p.wall[n] && !p.wall[n + s] && d[n]! > d[c]! + 1) (d[n] = d[c]! + 1), q.push(n);
      }
    }
    return d;
  });
}

/**
 * The fewest pushes: A* over pushes with a lower bound (each box's own fewest pushes to its nearest goal,
 * as if alone — never more than the truth, so the first solution found is a shortest one). Dead squares
 * are pruned, which never loses a solution. null if none within `cap` positions.
 */
export function optimal(p: Soko, cap = 3_000_000): { pushes: number; route: Push[] } | null {
  const dead = liveSquares(p).map((x, i) => (x || p.wall[i] ? 0 : 1));
  const pd = pushDistances(p);
  const lower = (boxes: number[]) => {
    let h = 0;
    for (const b of boxes) {
      let m = 999;
      for (const d of pd) if (d[b]! < m) m = d[b]!;
      h += m;
    }
    return h;
  };
  if (solvedBy(p, p.boxes)) return { pushes: 0, route: [] };
  const nodes: { boxes: number[]; player: number; g: number; parent: number; push: Push | null; key: string }[] = [];
  const best = new Map<string, number>();
  const heap = new MinHeap();
  const add = (boxes: number[], player: number, g: number, parent: number, push: Push | null) => {
    const k = keyOf(boxes, normOf(reach(p, boxes, player)));
    const old = best.get(k);
    if (old != null && old <= g) return;
    best.set(k, g);
    nodes.push({ boxes, player, g, parent, push, key: k });
    // Ties go to the deeper position (fewer pushes left to find).
    heap.push((g + lower(boxes)) * 1000 - g, nodes.length - 1);
  };
  add(p.boxes.slice(), p.player, 0, -1, null);
  while (heap.size) {
    const i = heap.pop();
    const n = nodes[i]!;
    if (best.get(n.key)! < n.g) continue;
    if (solvedBy(p, n.boxes)) {
      const route: Push[] = [];
      for (let at = i; at >= 0; at = nodes[at]!.parent) if (nodes[at]!.push) route.push(nodes[at]!.push!);
      return { pushes: n.g, route: route.reverse() };
    }
    if (nodes.length > cap) return null;
    for (const m of pushes(p, n.boxes, n.player, dead).list) add(m.boxes, m.at + m.d, n.g + 1, i, m);
  }
  return null;
}

/** The walk (letters) from `from` to `to` without pushing. */
function walk(p: Soko, boxes: number[], from: number, to: number): string {
  if (from === to) return '';
  const D = DIRS(p.w);
  const prev = new Map<number, number>([[from, -1]]);
  const q = [from];
  const bx = new Set(boxes);
  for (let i = 0; i < q.length; i++) {
    const c = q[i]!;
    for (let k = 0; k < 4; k++) {
      const n = c + D[k]!;
      if (p.wall[n] || bx.has(n) || prev.has(n)) continue;
      prev.set(n, c);
      if (n === to) {
        let s = '';
        let at = n;
        while (at !== from) {
          const pr = prev.get(at)!;
          s = LETTERS[D.indexOf(at - pr)]! + s;
          at = pr;
        }
        return s;
      }
      q.push(n);
    }
  }
  return '';
}

/** A route of pushes written out as moves (U D L R), walking included. */
export function spell(p: Soko, route: Push[]): string {
  let boxes = p.boxes.slice();
  let player = p.player;
  let out = '';
  for (const m of route) {
    out += walk(p, boxes, player, m.at) + LETTERS[DIRS(p.w).indexOf(m.d)]!;
    player = m.at + m.d;
    boxes = m.boxes;
  }
  return out;
}

/** Play moves: the end state, pushes made, and whether every move was legal. */
export function playMoves(p: Soko, moves: number[]): { boxes: number[]; pushes: number; ok: boolean } {
  const D = DIRS(p.w);
  const bx = new Set(p.boxes);
  let pl = p.player;
  let n = 0;
  for (const k of moves) {
    const d = D[k]!;
    const to = pl + d;
    if (p.wall[to]) return { boxes: [...bx], pushes: n, ok: false };
    if (bx.has(to)) {
      if (p.wall[to + d] || bx.has(to + d)) return { boxes: [...bx], pushes: n, ok: false };
      bx.delete(to);
      bx.add(to + d);
      n++;
    }
    pl = to;
  }
  return { boxes: [...bx].sort((a, b) => a - b), pushes: n, ok: true };
}

// ---- the held-out set -------------------------------------------------------------------------------------------------

export const SET_SIZE = 16;
const sets = new Map<number, { p: Soko; opt: number }[]>();
/** One stored line: w,h,walls+goals+boxes as a map string, the player's cell, the fewest pushes. */
export function encode(p: Soko, opt: number): string {
  let s = '';
  for (let i = 0; i < p.w * p.h; i++) s += p.wall[i] ? '#' : p.goals.includes(i) ? (p.boxes.includes(i) ? '*' : '.') : p.boxes.includes(i) ? '$' : '-';
  return `${p.w}:${s}:${p.player}:${opt}`;
}
export function decode(line: string): { p: Soko; opt: number } {
  const [w, s, pl, opt] = line.split(':') as [string, string, string, string];
  const W = Number(w);
  const wall = new Uint8Array(s.length);
  const goals: number[] = [];
  const boxes: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '#') wall[i] = 1;
    if (ch === '.' || ch === '*') goals.push(i);
    if (ch === '$' || ch === '*') boxes.push(i);
  }
  return { p: { w: W, h: s.length / W, wall, goals, boxes, player: Number(pl) }, opt: Number(opt) };
}

/** The fixed held-out puzzles for a level (seeds the learner never practises on), with their fewest pushes. */
export function testSet(level: number, fresh = false): { p: Soko; opt: number }[] {
  const L = lvl(level);
  const key = L + (fresh ? 100 : 0);
  const hit = sets.get(key);
  if (hit) return hit;
  let out: { p: Soko; opt: number }[];
  const stored = SOKO_SETS[L - 1];
  if (!fresh && stored?.length === SET_SIZE) out = stored.map(decode);
  else {
    out = [];
    const r = rng(5_550_000 + L * 7);
    while (out.length < SET_SIZE) {
      const m = makePuzzle(L, r);
      if (!m) continue;
      const o = optimal(m.p);
      if (!o || o.pushes < spec(L).minPush) continue;
      out.push({ p: m.p, opt: o.pushes });
    }
  }
  sets.set(key, out);
  return out;
}

// ---- his search ---------------------------------------------------------------------------------------------------------

/** What his guess is made of, for a position: each box's pushes to its nearest goal if it were alone (and to a goal of its own), boxes off goals, boxes against a wall, and the walk to the nearest loose box. */
function features(p: Soko, dist: Int16Array[], boxes: number[], player: number): number[] {
  let near = 0;
  let off = 0;
  let edge = 0;
  const used = new Set<number>();
  let greedy = 0;
  for (const b of boxes) {
    let m = 99;
    let mg = -1;
    let gm = 99;
    p.goals.forEach((g, gi) => {
      const d = Math.min(30, dist[gi]![b]!);
      if (d < m) m = d;
      if (!used.has(gi) && d < gm) (gm = d), (mg = gi);
    });
    near += m;
    if (mg >= 0) used.add(mg);
    greedy += gm;
    if (!p.goals.includes(b)) {
      off++;
      const wallsBy = [p.wall[b - 1], p.wall[b + 1], p.wall[b - p.w], p.wall[b + p.w]].filter(Boolean).length;
      if (wallsBy) edge++;
    }
  }
  let walkTo = 99;
  const pr = Math.floor(player / p.w);
  const pc = player % p.w;
  for (const b of boxes) if (!p.goals.includes(b)) walkTo = Math.min(walkTo, Math.abs(Math.floor(b / p.w) - pr) + Math.abs((b % p.w) - pc));
  return [near, greedy, off, edge, off ? walkTo / 4 : 0];
}
export const NF = 5;

/** The 3×3 shape around a square: which of the eight neighbours are wall, and whether it is a goal (512 shapes). */
export function shapeAt(p: Soko, c: number): number {
  const w = p.w;
  const nb = [c - w - 1, c - w, c - w + 1, c - 1, c + 1, c + w - 1, c + w, c + w + 1];
  let k = 0;
  nb.forEach((n, i) => {
    const out = n < 0 || n >= p.w * p.h || Math.abs((n % w) - (c % w)) > 1;
    if (out || p.wall[n]) k |= 1 << i;
  });
  return p.goals.includes(c) ? k | 256 : k;
}

class MinHeap {
  a: [number, number][] = [];
  push(f: number, i: number) {
    const a = this.a;
    a.push([f, i]);
    let k = a.length - 1;
    while (k > 0) {
      const j = (k - 1) >> 1;
      if (a[j]![0] <= f) break;
      [a[k], a[j]] = [a[j]!, a[k]!];
      k = j;
    }
  }
  pop(): number {
    const a = this.a;
    const top = a[0]!;
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        let m = k;
        if (l < a.length && a[l]![0] < a[m]![0]) m = l;
        if (l + 1 < a.length && a[l + 1]![0] < a[m]![0]) m = l + 1;
        if (m === k) break;
        [a[k], a[m]] = [a[m]!, a[k]!];
        k = m;
      }
    }
    return top[1];
  }
  get size() {
    return this.a.length;
  }
}

export interface Brain {
  /** Weights of the guess (one per feature, then a constant). */
  w: Float64Array;
  /** Per wall shape: how often a box there could still reach a goal (live) or not (dead), in his practice. */
  live: Uint32Array;
  dead: Uint32Array;
}
export const newBrain = (): Brain => ({ w: new Float64Array(NF + 1), live: new Uint32Array(512), dead: new Uint32Array(512) });

/** The squares he believes are dead ends: a shape seen often in practice and never with a way out. */
export function believedDead(b: Brain, p: Soko): Uint8Array {
  const out = new Uint8Array(p.w * p.h);
  for (let c = 0; c < out.length; c++) {
    if (p.wall[c]) continue;
    const s = shapeAt(p, c);
    if (b.dead[s]! >= 4 && b.live[s] === 0) out[c] = 1;
  }
  return out;
}

const guess = (b: Brain, f: number[]) => {
  let x = b.w[NF]!;
  for (let i = 0; i < NF; i++) x += b.w[i]! * f[i]!;
  return Math.max(0, x);
};

/** His search: best-first on (pushes so far + his guess of pushes left), opening at most `budget` positions. */
export function search(b: Brain, p: Soko, budget: number): { route: Push[]; nodes: number; states: { f: number[]; g: number }[] } | null {
  const dead = believedDead(b, p);
  const dist = pushDistances(p);
  const nodes: { boxes: number[]; player: number; g: number; parent: number; push: Push | null }[] = [];
  const heap = new MinHeap();
  const seen = new Map<string, number>();
  const add = (boxes: number[], player: number, g: number, parent: number, push: Push | null) => {
    const r = reach(p, boxes, player);
    const k = keyOf(boxes, normOf(r));
    const old = seen.get(k);
    if (old != null && old <= g) return;
    seen.set(k, g);
    nodes.push({ boxes, player, g, parent, push });
    heap.push(g + guess(b, features(p, dist, boxes, player)) + nodes.length * 1e-7, nodes.length - 1);
  };
  add(p.boxes.slice(), p.player, 0, -1, null);
  let opened = 0;
  while (heap.size && opened < budget) {
    const i = heap.pop();
    const n = nodes[i]!;
    opened++;
    if (solvedBy(p, n.boxes)) {
      const route: Push[] = [];
      const states: { f: number[]; g: number }[] = [];
      for (let at = i; at >= 0; at = nodes[at]!.parent) {
        const x = nodes[at]!;
        states.push({ f: features(p, dist, x.boxes, x.player), g: n.g - x.g });
        if (x.push) route.push(x.push);
      }
      return { route: route.reverse(), nodes: opened, states };
    }
    for (const m of pushes(p, n.boxes, n.player, dead).list) add(m.boxes, m.at + m.d, n.g + 1, i, m);
  }
  return null;
}

// ---- the learner ---------------------------------------------------------------------------------------------------------

interface SokoSave {
  game: 'sokoban';
  w: Float64Array;
  live: Uint32Array;
  dead: Uint32Array;
  puzzles: number;
  rand: number;
}

class SokoLearner implements Learner {
  brain: Brain;
  puzzles: number;
  rand: number;
  r: () => number;
  constructor(
    private level: number,
    seed: number,
    saved?: unknown,
  ) {
    // What he learned carries over between levels (the shapes and the guess are the same kind of thing).
    const s = savedFor<SokoSave>(saved, 'sokoban');
    this.brain = s?.w?.length === NF + 1 ? { w: s.w, live: s.live, dead: s.dead } : newBrain();
    this.puzzles = s?.puzzles ?? 0;
    this.rand = s?.rand ?? seed;
    this.r = rng(this.rand);
  }
  /** Fit the guess a little towards the pushes really left (least squares, small steps). */
  private fit(samples: { f: number[]; g: number }[]) {
    const w = this.brain.w;
    for (const s of samples) {
      const x = [...s.f, 1];
      let y = 0;
      for (let i = 0; i <= NF; i++) y += w[i]! * x[i]!;
      // Normalised steps (each one moves the guess a tenth of the way to the right number): stable whatever the scale.
      const err = s.g - y;
      const norm = x.reduce((t, v) => t + v * v, 0);
      for (let i = 0; i <= NF; i++) w[i]! += (0.1 * err * x[i]!) / norm;
    }
  }
  train(n: number) {
    const k = Math.max(1, Math.min(n, 3));
    for (let t = 0; t < k; t++) {
      // A practice puzzle from his own random numbers, at this level or below.
      const L = 1 + Math.floor(this.r() * this.level);
      const m = makePuzzle(L, this.r);
      if (!m) continue;
      const p = m.p;
      // Dead ends: where, in this puzzle, a box could never be pulled from a goal (worked out by playing backwards).
      const live = liveSquares(p);
      for (let c = 0; c < live.length; c++) {
        if (p.wall[c]) continue;
        const s = shapeAt(p, c);
        if (live[c]) this.brain.live[s]!++;
        else this.brain.dead[s]!++;
      }
      // The backward play is a route: its positions are at most the rest of it away from solved.
      const dist = pushDistances(p);
      const samples = m.route.map((bx, i) => ({ f: features(p, dist, bx, p.player), g: m.route.length - 1 - i }));
      // His own search, with room to spare: the positions on the route he finds teach the guess too.
      const found = search(this.brain, p, budgetFor(L, m.route.length) * 3);
      if (found) samples.push(...found.states);
      for (let rep = 0; rep < 3; rep++) this.fit(samples);
    }
    this.puzzles += k;
    this.rand = (this.rand + k * 2654435761) >>> 0;
    return k;
  }
  measure() {
    const set = testSet(this.level);
    let budget = 0;
    let score = 0;
    let solved = 0;
    let his = 0;
    let best = 0;
    for (const t of set) {
      budget += budgetFor(this.level, t.opt);
      const s = search(this.brain, t.p, budgetFor(this.level, t.opt));
      if (!s) continue;
      solved++;
      his += s.route.length;
      best += t.opt;
      score += t.opt / Math.max(1, s.route.length);
    }
    return {
      mastery: score / set.length,
      detail: `He solves ${solved} of ${set.length} puzzles he has never practised on, opening at most ${Math.round(budget / set.length)} positions each on average (${spec(this.level).budget}× the fewest pushes)${solved ? `, in ${his} pushes where the fewest possible is ${best} (exact solver)` : ''}.`,
    };
  }
  save(): SokoSave {
    return { game: 'sokoban', w: this.brain.w, live: this.brain.live, dead: this.brain.dead, puzzles: this.puzzles, rand: this.rand };
  }
  view(): Frame {
    // The first held-out puzzle, with the squares he believes are dead ends shaded.
    const t = testSet(this.level)[0]!;
    const dead = believedDead(this.brain, t.p);
    return { ...board(t.p, t.p.boxes, t.p.player, dead), caption: 'Dark red: squares he has learned are dead ends for a box (it could never reach a goal from there).' };
  }
  watch(seed: number): Frame[] {
    const set = testSet(this.level);
    const t = set[seed % set.length]!;
    const s = search(this.brain, t.p, budgetFor(this.level, t.opt) * 3);
    if (!s) return [{ ...board(t.p, t.p.boxes, t.p.player, null), caption: 'He could not find a solution to this one yet.' }];
    const moves = spell(t.p, s.route);
    const frames: Frame[] = [{ ...board(t.p, t.p.boxes, t.p.player, null), caption: `A puzzle he has never practised on: ${t.opt} pushes at best.` }];
    const D = DIRS(t.p.w);
    let pl = t.p.player;
    const bx = new Set(t.p.boxes);
    let pushesN = 0;
    for (const ch of moves) {
      const d = D[LETTERS.indexOf(ch)]!;
      if (bx.has(pl + d)) {
        bx.delete(pl + d);
        bx.add(pl + 2 * d);
        pushesN++;
      }
      pl += d;
      frames.push({ ...board(t.p, [...bx], pl, null), caption: `Push ${pushesN}${pushesN === s.route.length ? ` — solved in ${pushesN} pushes (fewest: ${t.opt}).` : ''}`, every: 0.25 });
    }
    return frames;
  }
}

/** A picture of a puzzle. */
export function board(p: Soko, boxes: number[], player: number, dead: Uint8Array | null): Frame {
  const cells: Cell[] = [];
  const bx = new Set(boxes);
  for (let i = 0; i < p.w * p.h; i++) {
    const goal = p.goals.includes(i);
    if (p.wall[i]) cells.push({ c: 'wall' });
    else if (bx.has(i)) cells.push({ t: '■', c: goal ? 'gold hit' : 'gold' });
    else if (i === player) cells.push({ t: '●', c: 'me' });
    else if (goal) cells.push({ t: '○', c: 'path' });
    else if (dead?.[i]) cells.push({ c: 'miss' });
    else cells.push({});
  }
  return { grid: { w: p.w, h: p.h, cells }, caption: '' };
}

export function mapText(p: Soko, boxes = p.boxes, player = p.player): string {
  const rows: string[] = [];
  for (let y = 0; y < p.h; y++) {
    let s = '';
    for (let x = 0; x < p.w; x++) {
      const i = y * p.w + x;
      const g = p.goals.includes(i);
      s += p.wall[i] ? '#' : boxes.includes(i) ? (g ? '*' : '$') : i === player ? (g ? '+' : '@') : g ? '.' : ' ';
    }
    rows.push(s.replace(/ +$/, ''));
  }
  return rows.join('\n');
}

/** Actions 0–3: walk (or push) up, down, left, right. Reward −1 a move, +10 a box onto a goal, +100 when all are. */
class SokoEnv implements Env {
  p!: Soko;
  boxes: number[] = [];
  player = 0;
  constructor(private level: number) {}
  reset(seed: number) {
    const r = rng(seed);
    let m = makePuzzle(this.level, r);
    while (!m) m = makePuzzle(this.level, r);
    this.p = m.p;
    this.boxes = m.p.boxes.slice();
    this.player = m.p.player;
  }
  actions() {
    const D = DIRS(this.p.w);
    return [0, 1, 2, 3].filter((k) => {
      const to = this.player + D[k]!;
      if (this.p.wall[to]) return false;
      if (this.boxes.includes(to)) return !this.p.wall[to + D[k]!] && !this.boxes.includes(to + D[k]!);
      return true;
    });
  }
  step(k: number) {
    if (!this.actions().includes(k)) return { reward: -5, done: false };
    const d = DIRS(this.p.w)[k]!;
    const to = this.player + d;
    let reward = -1;
    const bi = this.boxes.indexOf(to);
    if (bi >= 0) {
      this.boxes[bi] = to + d;
      if (this.p.goals.includes(to + d)) reward += 10;
    }
    this.player = to;
    const done = solvedBy(this.p, this.boxes);
    return { reward: done ? reward + 100 : reward, done };
  }
  describe() {
    return `Sokoban (# wall, $ box, . goal, * box on goal, @ you, + you on a goal). Push every box onto a goal; boxes can only be pushed.\n${mapText(this.p, this.boxes, this.player)}`;
  }
}

/** Problems are smaller than the ladder's puzzles (a reader works them out by hand), growing with the level. */
export function problemSpec(level: number): LevelSpec {
  const L = lvl(level);
  const boxes = [1, 1, 1, 2, 2, 2, 2, 3, 3, 3][L - 1]!;
  return { w: 6 + Math.floor(L / 4), h: 6 + Math.floor(L / 5), boxes, pulls: 16 + 4 * L, minPush: 3 + L, budget: 0 };
}

function generate(level: number, seed: number): Problem {
  const L = lvl(level);
  const r = rng(seed * 6007 + L * 13);
  const S = problemSpec(L);
  for (;;) {
    const m = makePuzzle(L, r, S);
    if (!m) continue;
    const o = optimal(m.p, 150_000);
    if (!o || o.pushes < S.minPush) continue;
    const text = `Sokoban. Map (# wall, $ box, . goal, * box already on a goal, @ you, + you standing on a goal, rows top to bottom):\n${mapText(m.p)}\nYou walk up, down, left or right; walking into a box pushes it one square if the square beyond is free. Boxes cannot be pulled. Get every box onto a goal using as few pushes as you can. Answer with your moves as letters U D L R (walking included), e.g. "LLUR".`;
    return { game: 'sokoban', level: L, seed, text, data: { map: encode(m.p, o.pushes), opt: o.pushes, moves: spell(m.p, o.route) } };
  }
}

function check(pr: Problem, answer: string): Verdict {
  const d = pr.data as { map: string; opt: number };
  const { p } = decode(d.map);
  const moves = readMoves(finalLine(answer), LETTERS, ['UP', 'DOWN', 'LEFT', 'RIGHT']);
  const res = playMoves(p, moves);
  if (!res.ok) return { correct: false, score: 0, why: 'A move walks into a wall or pushes a box into something.' };
  if (!solvedBy(p, res.boxes)) return { correct: false, score: 0, why: 'Not every box is on a goal at the end.' };
  const best = res.pushes <= d.opt;
  return { correct: true, score: best ? 1 : d.opt / res.pushes, why: best ? `Solved in the fewest pushes (${d.opt}).` : `Solved in ${res.pushes} pushes; the fewest is ${d.opt}.` };
}

export const sokoban: Game = {
  ...SOKOBAN,
  env: (level) => new SokoEnv(level),
  generate,
  check,
  learner: (level, seed, saved) => new SokoLearner(level, seed, saved),
};
