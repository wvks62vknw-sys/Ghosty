/**
 * GO 9×9 (area scoring, komi 7, simple ko, suicide illegal). Ghosty searches with Monte Carlo tree search
 * guided by two small learned pattern tables instead of random play-outs: one says, from the 3×3 shape
 * around a point (and how many liberties its stones have), who will own that point at the end — summed
 * over the board, that is his estimate of the score; the other says which moves look promising from the
 * shape around them (and whether they capture or save stones). Both are learned in self-play: after
 * each game every position learns who really ended up owning each point, and which moves his search
 * liked. Shapes are counted once for all their rotations and mirror images.
 *
 * Ground truth: a fixed ladder of reference engines — plain Monte Carlo tree search with random
 * play-outs (UCT, never filling its own eyes) — at 8 … 500 play-outs a move. At each level he plays a
 * match with the SAME number of searches per move (each of his is a look-up instead of a play-out),
 * from fixed openings played both ways; mastery = his share of the points. Second measure: capture
 * puzzles on small boards (Black to play and capture the marked stones, whatever White does), each
 * answer proved by exhaustive search.
 */
import { finalLine, type Env, type Frame, type Game, type Learner, lvl, mentions, type Problem, rng, savedFor, type Verdict } from './core';
import { area, copyGo, type Go, goFrame, goFrom, goState, goText, group, inner, isEye, KOMI, legalAt, margin, newGo, outer, over, pass, playAt, ptName } from './goboard';
import { GO_PUZZLES } from './gosets';
import { Match, type MatchResult, record, share, sliceMs, type Stepper } from './match';

const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
import { GO } from './meta';

export * from './goboard';
export { setSlice } from './match';


// ---- shapes ---------------------------------------------------------------------------------------------------

/** The 3×3 shape code around a point: its eight neighbours, each 0 empty, 1 Black, 2 White, 3 off the board. */
function code(g: Go, i: number): number {
  const W = g.n + 2;
  const b = g.b;
  return b[i - W - 1]! | (b[i - W]! << 2) | (b[i - W + 1]! << 4) | (b[i - 1]! << 6) | (b[i + 1]! << 8) | (b[i + W - 1]! << 10) | (b[i + W]! << 12) | (b[i + W + 1]! << 14);
}
/** The same shape with the colours swapped. */
const SWAP = (() => {
  const t = new Uint16Array(65536);
  for (let c = 0; c < 65536; c++) {
    let x = 0;
    for (let k = 0; k < 8; k++) {
      const v = (c >> (2 * k)) & 3;
      x |= (v === 1 ? 2 : v === 2 ? 1 : v) << (2 * k);
    }
    t[c] = x;
  }
  return t;
})();
/** One class for a shape and all its rotations and mirror images. */
const CANON = (() => {
  // Neighbour k at (dr, dc); the eight symmetries of the square map positions to positions.
  const pos = [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ];
  const syms: number[][] = [];
  for (let s = 0; s < 8; s++) {
    syms.push(
      pos.map(([r, c]) => {
        let [a, b] = [r!, c!];
        if (s & 1) [a, b] = [b, a];
        if (s & 2) a = -a;
        if (s & 4) b = -b;
        return pos.findIndex(([x, y]) => x === a && y === b);
      }),
    );
  }
  const cls = new Int32Array(65536).fill(-1);
  let n = 0;
  for (let c = 0; c < 65536; c++) {
    if (cls[c]! >= 0) continue;
    for (const sm of syms) {
      let x = 0;
      for (let k = 0; k < 8; k++) x |= ((c >> (2 * k)) & 3) << (2 * sm[k]!);
      if (cls[x]! < 0) cls[x] = n;
    }
    n++;
  }
  return { cls, n };
})();
export const SHAPES = CANON.n;

/** Liberties of every stone's group (1–4, 4 meaning four or more). */
function libsAll(g: Go): Uint8Array {
  const out = new Uint8Array(g.b.length);
  const seen = new Uint8Array(g.b.length);
  for (let i = 0; i < g.b.length; i++) {
    const x = g.b[i]!;
    if ((x !== 1 && x !== 2) || seen[i]) continue;
    const gr = group(g, i, seen);
    const l = Math.min(4, gr.libs);
    for (const s of gr.stones) out[s] = l;
  }
  return out;
}

/** How far a point is from the edge (0 = on it, capped at 4). */
const lineOf = (g: Go, i: number) => {
  const W = g.n + 2;
  const r = Math.floor(i / W) - 1;
  const c = (i % W) - 1;
  return Math.min(4, r, c, g.n - 1 - r, g.n - 1 - c);
};

// ---- the learned tables ------------------------------------------------------------------------------------------

/** Ownership table: [centre 0–2][liberties 0–4][shape class], then [centre][line 0–4]. Policy table: [shape class seen by the mover], then 2 tactical bonuses. */
export interface Tables {
  own: Float32Array;
  line: Float32Array;
  pol: Float32Array;
}
export const newTables = (): Tables => ({ own: new Float32Array(3 * 5 * SHAPES), line: new Float32Array(15), pol: new Float32Array(SHAPES + 2) });
const swapC = (x: number) => (x === 1 ? 2 : x === 2 ? 1 : 0);

/** Who he thinks will own point i at the end: −1 White … +1 Black (the raw sum before the squash). */
function ownRaw(t: Tables, g: Go, i: number, libs: Uint8Array): number {
  const x = g.b[i]!;
  const l = libs[i]!;
  const c = code(g, i);
  const a = t.own[(x * 5 + l) * SHAPES + CANON.cls[c]!]!;
  const b = t.own[(swapC(x) * 5 + l) * SHAPES + CANON.cls[SWAP[c]!]!]!;
  const ln = lineOf(g, i);
  return a - b + t.line[x * 5 + ln]! - t.line[swapC(x) * 5 + ln]!;
}

/** His estimate of Black's final score (area, minus komi). */
export function scoreEstimate(t: Tables, g: Go): number {
  const libs = libsAll(g);
  const W = g.n + 2;
  let s = 0;
  for (let r = 1; r <= g.n; r++) for (let c = 1; c <= g.n; c++) s += Math.tanh(ownRaw(t, g, r * W + c, libs));
  return s - (g.n >= 9 ? KOMI : 0);
}
/** …as a chance of winning for the side to move. */
const winChance = (t: Tables, g: Go) => {
  const s = scoreEstimate(t, g);
  const pb = 1 / (1 + Math.exp(-s / 2));
  return g.side === 1 ? pb : 1 - pb;
};

/** The policy features of a move at i for the side to move: its shape (seen as the mover), and whether it captures or saves stones in atari. */
function polFeatures(g: Go, i: number, libs: Uint8Array): [number, number, number] {
  let c = code(g, i);
  if (g.side === 2) c = SWAP[c]!;
  const W = g.n + 2;
  let capture = 0;
  let save = 0;
  for (const j of [i - 1, i + 1, i - W, i + W]) {
    const x = g.b[j]!;
    if (x === 3 - g.side && libs[j] === 1) capture = 1;
    if (x === g.side && libs[j] === 1) save = 1;
  }
  return [CANON.cls[c]!, capture, save];
}

// ---- moves both engines consider -----------------------------------------------------------------------------------

/** Legal points that do not fill one's own eye; a pass only when there are none. */
export function candidates(g: Go): number[] {
  const out: number[] = [];
  const W = g.n + 2;
  for (let r = 1; r <= g.n; r++)
    for (let c = 1; c <= g.n; c++) {
      const i = r * W + c;
      if (g.b[i] === 0 && !isEye(g, i, g.side) && legalAt(g, i)) out.push(i);
    }
  return out.length ? out : [-1];
}
const doMove = (g: Go, i: number) => (i < 0 ? (pass(g), true) : playAt(g, i));

/** A random play-out to the end (no eye filling); the area result for Black (positive = Black wins, after komi). */
/** The liberty of a group in atari (one liberty), or −1. */
function lastLiberty(g: Go, i: number): number {
  const W = g.n + 2;
  const c = g.b[i]!;
  const seen = new Uint8Array(g.b.length);
  const stones = [i];
  seen[i] = 1;
  let lib = -1;
  for (let k = 0; k < stones.length; k++) {
    for (const j of [stones[k]! - 1, stones[k]! + 1, stones[k]! - W, stones[k]! + W]) {
      const x = g.b[j]!;
      if (x === 0) {
        if (lib >= 0 && lib !== j) return -1;
        lib = j;
      } else if (x === c && !seen[j]) (seen[j] = 1), stones.push(j);
    }
  }
  return lib;
}

/**
 * A play-out to the end (no eye filling); the area result for Black (positive = Black wins, after komi).
 * Light: random moves. Heavy (the stronger reference engines): first answer the last move — capture a
 * group it left in atari, or save one's own group it put in atari — and only then play at random.
 */
function playout(g: Go, r: () => number, heavy = false): number {
  const W = g.n + 2;
  const cap = g.n * g.n * 3;
  const empties: number[] = [];
  for (let k = 0; k < g.b.length; k++) if (g.b[k] === 0) empties.push(k);
  let last = -1;
  while (!over(g) && g.moves < cap) {
    if (heavy && last >= 0) {
      let urgent = -1;
      for (const j of [last - 1, last + 1, last - W, last + W, last]) {
        const x = g.b[j]!;
        if (x !== 1 && x !== 2) continue;
        const lib = lastLiberty(g, j);
        if (lib >= 0 && !isEye(g, lib, g.side)) {
          urgent = lib;
          if (x !== g.side) break; // a capture first
        }
      }
      if (urgent >= 0 && playAt(g, urgent)) {
        last = urgent;
        continue;
      }
    }
    // Try empty points in random order until one is legal and not an own eye.
    let moved = false;
    let n = empties.length;
    while (n > 0) {
      const k = Math.floor(r() * n);
      const i = empties[k]!;
      if (g.b[i] === 0 && !isEye(g, i, g.side) && playAt(g, i)) {
        moved = true;
        last = i;
        break;
      }
      empties[k] = empties[n - 1]!;
      empties[n - 1] = i;
      n--;
    }
    if (!moved) (pass(g), (last = -1));
    else if (g.moves % 8 === 0) {
      // Captures free points: refresh the list now and then.
      empties.length = 0;
      for (let k = W; k < g.b.length - W; k++) if (g.b[k] === 0) empties.push(k);
    }
  }
  return margin(g);
}

interface Node {
  moves: number[];
  prior: Float32Array;
  n: Int32Array;
  w: Float64Array;
  kids: (Node | null)[];
  total: number;
}

/**
 * One engine's search for a move, run a slice at a time (so a long search never holds up the worker).
 * `t` = his tables (PUCT, values from the tables); null = the reference (UCT with random play-outs).
 */
export class Searcher {
  root: Node | null = null;
  only = -1;
  done = 0;
  constructor(
    private g0: Go,
    private t: Tables | null,
    private r: () => number,
    private heavy = false,
  ) {
    const rootMoves = candidates(g0);
    if (rootMoves.length === 1) this.only = rootMoves[0]!;
    else this.root = this.open(g0, rootMoves);
  }
  private open(g: Go, moves: number[]): Node {
    const t = this.t;
    const prior = new Float32Array(moves.length);
    if (t) {
      const libs = libsAll(g);
      let sum = 0;
      moves.forEach((m, k) => {
        if (m < 0) return;
        const [cl, cap, save] = polFeatures(g, m, libs);
        prior[k] = Math.exp(Math.max(-20, Math.min(20, t.pol[cl]! + cap * t.pol[SHAPES]! + save * t.pol[SHAPES + 1]!)));
        sum += prior[k]!;
      });
      for (let k = 0; k < moves.length; k++) prior[k] = sum > 0 ? prior[k]! / sum : 1 / moves.length;
    } else prior.fill(1 / moves.length);
    return { moves, prior, n: new Int32Array(moves.length), w: new Float64Array(moves.length), kids: new Array(moves.length).fill(null), total: 0 };
  }
  /** Run up to `sims` more simulations, stopping early after `ms` milliseconds. */
  runFor(sims: number, ms: number): void {
    const t0 = clock();
    let left = sims;
    while (left > 0 && this.root) {
      const k = Math.min(left, 4);
      this.run(k);
      left -= k;
      if (clock() - t0 > ms) break;
    }
  }
  /** Run `sims` more simulations. */
  run(sims: number): void {
    const root = this.root;
    if (!root) return;
    const { t, r, g0 } = this;
    for (let s = 0; s < sims; s++) {
      this.done++;
      const g = copyGo(g0);
      const path: [Node, number][] = [];
      let node = root;
      let value: number;
      for (;;) {
        // Pick a child: PUCT (his) or UCT with every move tried once first (the reference).
        let best = 0;
        let bv = -Infinity;
        const sq = Math.sqrt(node.total + 1);
        const ln = Math.log(node.total + 1);
        for (let k = 0; k < node.moves.length; k++) {
          const n = node.n[k]!;
          let u: number;
          if (t) u = (n ? node.w[k]! / n : 0.5) + (1.2 * node.prior[k]! * sq) / (1 + n);
          else u = n ? node.w[k]! / n + Math.sqrt((2 * ln) / n) : 1e9 + r();
          if (u > bv) (bv = u), (best = k);
        }
        const mover = g.side;
        doMove(g, node.moves[best]!);
        path.push([node, best]);
        if (over(g) || g.moves > g.n * g.n * 3) {
          const m = margin(g);
          value = m === 0 ? 0.5 : (m > 0) === (mover === 1) ? 1 : 0;
          break;
        }
        const kid = node.kids[best];
        if (!kid) {
          node.kids[best] = this.open(g, candidates(g));
          // The new position's value for the side that just moved.
          if (t) value = 1 - winChance(t, g);
          else {
            const m = playout(g, r, this.heavy);
            value = m === 0 ? 0.5 : (m > 0) === (mover === 1) ? 1 : 0;
          }
          break;
        }
        node = kid;
      }
      // Back up: value is for the player who made the last move on the path.
      for (let k = path.length - 1; k >= 0; k--) {
        const [nd, c] = path[k]!;
        nd.n[c]!++;
        nd.w[c]! += value;
        nd.total++;
        value = 1 - value;
      }
    }
  }
  /** The most visited move (inner index, −1 = pass). */
  best(): number {
    const root = this.root;
    if (!root) return this.only;
    let best = 0;
    for (let k = 1; k < root.moves.length; k++) if (root.n[k]! > root.n[best]!) best = k;
    return root.moves[best]!;
  }
}

/** A whole search at once: `sims` simulations, then the most visited move. */
export function search(g0: Go, sims: number, t: Tables | null, r: () => number): number {
  const s = new Searcher(g0, t, r);
  s.run(sims);
  lastRoot = s.root;
  return s.best();
}
let lastRoot: Node | null = null;

// ---- matches -----------------------------------------------------------------------------------------------------

/** Fixed openings: the first two stones (one each) in the middle of the board, the same list every time. */
export const OPENINGS: [number, number][] = (() => {
  const r = rng(9090);
  const out: [number, number][] = [];
  while (out.length < 8) {
    const a = (2 + Math.floor(r() * 5)) * 9 + 2 + Math.floor(r() * 5);
    const b = (2 + Math.floor(r() * 5)) * 9 + 2 + Math.floor(r() * 5);
    if (a !== b && !out.some(([x, y]) => x === a && y === b)) out.push([a, b]);
  }
  return out;
})();
/** A rung of the ladder: his searches a move, and the reference engine (its play-outs a move, light or heavy, and how often it plays a random move instead). */
export interface Rung {
  me: number;
  ref: number;
  heavy: boolean;
  rand: number;
  /** Points added to his score at the end (on top of the usual komi): the odds the reference gives him. */
  bonus: number;
}
export const RUNGS: Rung[] = [
  { me: 24, ref: 16, heavy: false, rand: 0.3, bonus: 0 },
  { me: 24, ref: 48, heavy: false, rand: 0, bonus: 0 },
  { me: 24, ref: 16, heavy: true, rand: 0, bonus: 0 },
  { me: 24, ref: 48, heavy: true, rand: 0, bonus: 0 },
  { me: 24, ref: 100, heavy: true, rand: 0, bonus: 0 },
  { me: 24, ref: 150, heavy: true, rand: 0, bonus: 0 },
  { me: 24, ref: 150, heavy: true, rand: 0, bonus: -10 },
  { me: 24, ref: 150, heavy: true, rand: 0, bonus: -20 },
  { me: 24, ref: 150, heavy: true, rand: 0, bonus: -30 },
  { me: 24, ref: 150, heavy: true, rand: 0, bonus: -40 },
];
export const rungFor = (level: number) => RUNGS[lvl(level) - 1]!;
export const gamesFor = (_level: number) => 10;
const rungWords = (r: Rung) => `the reference engine (tree search with ${r.ref} ${r.heavy ? 'smarter' : 'random'} play-outs a move${r.rand ? `, ${Math.round(r.rand * 100)}% of its moves random` : ''})${r.bonus > 0 ? `, giving him ${r.bonus} points` : r.bonus < 0 ? `, with him giving ${-r.bonus} points` : ''}; he searches ${r.me} times a move`;

export function duel(opening: number, first: boolean, rung: Rung, mine: Tables, seed: number): Stepper & { g: Go; me: number } {
  const g = newGo(9);
  const [a, b] = OPENINGS[opening % OPENINGS.length]!;
  playAt(g, inner(g, a));
  playAt(g, inner(g, b));
  // He is Black when he moves "first".
  const me = first ? 1 : 2;
  const r = rng(seed * 2 + (first ? 1 : 0));
  let cur: Searcher | null = null;
  return {
    g,
    me,
    // One step = a slice of one move's search (about 30 ms at most), so the worker is never held up for long.
    step() {
      if (over(g) || g.moves > 200) {
        // His margin (after the usual komi), plus the points the rung gives him.
        const m = (me === 1 ? margin(g) : -margin(g)) + rung.bonus;
        return m === 0 ? 0.5 : m > 0 ? 1 : 0;
      }
      if (!cur && g.side !== me && rung.rand && r() < rung.rand) {
        const c = candidates(g);
        doMove(g, c[Math.floor(r() * c.length)]!);
        return null;
      }
      const sims = g.side === me ? rung.me : rung.ref;
      cur ??= new Searcher(g, g.side === me ? mine : null, r, rung.heavy);
      cur.runFor(sims - cur.done, 30);
      if (cur.done >= sims || !cur.root) {
        doMove(g, cur.best());
        cur = null;
      }
      return null;
    },
  };
}

// ---- capture puzzles (exact) ---------------------------------------------------------------------------------------

export interface Puzzle {
  g: Go;
  /** A stone of the group to capture (outer point). */
  target: number;
  n: number;
  /** The first moves (outer points) that capture it within n moves, whatever White does. */
  best: number[];
}

/** Can Black (to move) capture the group at `target` within k Black moves, whatever White does (White may also pass)? Exhaustive. */
export function captures(g: Go, target: number, k: number): boolean {
  for (const i of legalMoves(g)) {
    const c = copyGo(g);
    playAt(c, i);
    if (c.b[target] !== 2) return true;
    if (k <= 1) continue;
    let all = true;
    for (const j of [...legalMoves(c), -1]) {
      const d = copyGo(c);
      if (j < 0) pass(d);
      else playAt(d, j);
      if (!captures(d, target, k - 1)) {
        all = false;
        break;
      }
    }
    if (all) return true;
  }
  return false;
}
function legalMoves(g: Go): number[] {
  const out: number[] = [];
  for (let i = 0; i < g.b.length; i++) if (g.b[i] === 0 && legalAt(g, i)) out.push(i);
  return out;
}
/** Every first move that captures the group within k. */
export function capturingMoves(g: Go, target: number, k: number): number[] {
  return legalMoves(g)
    .filter((i) => {
      const c = copyGo(g);
      playAt(c, i);
      if (c.b[target] !== 2) return true;
      if (k <= 1) return false;
      return [...legalMoves(c), -1].every((j) => {
        const d = copyGo(c);
        if (j < 0) pass(d);
        else playAt(d, j);
        return captures(d, target, k - 1);
      });
    })
    .map((i) => outer(g, i));
}

export function puzzles(): Puzzle[] {
  return GO_PUZZLES.map((line) => {
    const [n, cells, target, k, best] = line.split('|') as [string, string, string, string, string];
    const g = newGo(Number(n));
    for (let pt = 0; pt < g.n * g.n; pt++) g.b[inner(g, pt)] = '.XO'.indexOf(cells[pt]!);
    return { g, target: inner(g, Number(target)), n: Number(k), best: best.split(',').map(Number) };
  });
}

// ---- the learner -----------------------------------------------------------------------------------------------------

/**
 * What is kept: the two big tables are mostly zeros (only shapes he has met are filled in), so only the
 * filled entries are stored — indices into ownership-then-policy, and their values — a few tens of KB
 * instead of half a megabyte.
 */
interface GoSave {
  game: 'go';
  idx: Uint32Array;
  val: Float32Array;
  line: Float32Array;
  games: number;
  rand: number;
}
export function packTables(t: Tables): { idx: Uint32Array; val: Float32Array } {
  const n = t.own.length;
  const idx: number[] = [];
  const val: number[] = [];
  for (let i = 0; i < n; i++) if (t.own[i]) (idx.push(i), val.push(t.own[i]!));
  for (let i = 0; i < t.pol.length; i++) if (t.pol[i]) (idx.push(n + i), val.push(t.pol[i]!));
  return { idx: Uint32Array.from(idx), val: Float32Array.from(val) };
}
export function unpackTables(idx: Uint32Array, val: Float32Array, line: Float32Array): Tables {
  const t = newTables();
  const n = t.own.length;
  for (let k = 0; k < idx.length; k++) {
    const i = idx[k]!;
    if (i < n) t.own[i] = val[k]!;
    else if (i - n < t.pol.length) t.pol[i - n] = val[k]!;
  }
  if (line.length === t.line.length) t.line.set(line);
  return t;
}

const TRAIN_SIMS = 16;

class GoLearner implements Learner {
  t: Tables;
  games: number;
  rand: number;
  r: () => number;
  match: Match | null = null;
  last: MatchResult | null = null;
  /** The capture-puzzle test after each match (a slice at a time), and the last finished one. */
  puzzling: { i: number; found: number; t: Tables } | null = null;
  puz: { found: number; of: number } | null = null;
  constructor(
    private level: number,
    seed: number,
    saved?: unknown,
  ) {
    // What he learned carries over between levels.
    const s = savedFor<GoSave>(saved, 'go');
    this.t = s?.idx && s.val && s.line ? unpackTables(s.idx, s.val, s.line) : newTables();
    this.games = s?.games ?? 0;
    this.rand = s?.rand ?? seed;
    this.r = rng(this.rand);
  }
  /** One self-play game with a quick search, then every position learns who owned each point at the end, and which moves the search liked. */
  /** The self-play game under way (played a few moves per call, so the worker is never held up). */
  private cur: { g: Go; seen: { g: Go; moves: number[]; visits: number[] }[] } | null = null;
  /** Play up to `k` moves of the current self-play game; when it ends, learn from it. True when a game finished. */
  private play(k: number): boolean {
    this.cur ??= { g: newGo(9), seen: [] };
    const { g, seen } = this.cur;
    const t0 = clock();
    for (let i = 0; i < k && !over(g) && g.moves < 200 && (i === 0 || clock() - t0 < 30); i++) {
      let m: number;
      const cand = candidates(g);
      if (g.moves < 4 || this.r() < 0.05) m = cand[Math.floor(this.r() * cand.length)]!;
      else {
        m = search(g, TRAIN_SIMS, this.t, this.r);
        const root = lastRoot;
        if (root) {
          seen.push({ g: copyGo(g), moves: root.moves.slice(), visits: Array.from(root.n) });
          // Early on, follow the search's visits loosely (more variety).
          if (g.moves < 12) {
            let x = this.r() * root.total;
            for (let j = 0; j < root.moves.length; j++)
              if ((x -= root.n[j]!) < 0) {
                m = root.moves[j]!;
                break;
              }
          }
        }
      }
      doMove(g, m);
    }
    if (!over(g) && g.moves < 200) return false;
    this.cur = null;
    this.learn(g, seen);
    return true;
  }
  private learn(g: Go, seen: { g: Go; moves: number[]; visits: number[] }[]) {
    const owner = area(g).owner;
    const t = this.t;
    for (const s of seen) {
      const p = s.g;
      const libs = libsAll(p);
      const W = p.n + 2;
      // Ownership: each point towards who owned it at the end.
      for (let rr = 1; rr <= p.n; rr++)
        for (let c = 1; c <= p.n; c++) {
          const i = rr * W + c;
          const target = owner[i] === 1 ? 1 : owner[i] === 2 ? -1 : 0;
          const y = Math.tanh(ownRaw(t, p, i, libs));
          const gr = 0.02 * (target - y) * (1 - y * y);
          const x = p.b[i]!;
          const l = libs[i]!;
          const cd = code(p, i);
          const ln = lineOf(p, i);
          t.own[(x * 5 + l) * SHAPES + CANON.cls[cd]!]! += gr;
          t.own[(swapC(x) * 5 + l) * SHAPES + CANON.cls[SWAP[cd]!]!]! -= gr;
          t.line[x * 5 + ln]! += gr;
          t.line[swapC(x) * 5 + ln]! -= gr;
        }
      // Policy: towards the share of the search's visits each move got.
      if (s.moves[0]! < 0) continue;
      const feats = s.moves.map((m) => polFeatures(p, m, libs));
      const logits = feats.map(([cl, cap, save]) => t.pol[cl]! + cap * t.pol[SHAPES]! + save * t.pol[SHAPES + 1]!);
      const mx = Math.max(...logits);
      const ex = logits.map((v) => Math.exp(v - mx));
      const sum = ex.reduce((a, b) => a + b, 0);
      const tot = s.visits.reduce((a, b) => a + b, 0) || 1;
      feats.forEach(([cl, cap, save], k) => {
        const gr = 0.05 * (s.visits[k]! / tot - ex[k]! / sum);
        t.pol[cl]! += gr;
        if (cap) t.pol[SHAPES]! += gr;
        if (save) t.pol[SHAPES + 1]! += gr;
      });
    }
  }
  /** A unit is a whole self-play game; one call plays a slice of it (0 until a game is finished). */
  train(_n: number) {
    if (!this.play(12)) return 0;
    this.games++;
    this.rand = (this.rand + 2654435761) >>> 0;
    return 1;
  }
  /** Capture puzzles, a slice at a time: his move (his search on the small board) is one that captures the stones by force. */
  private puzzleSlice(t0: number): boolean {
    const set = puzzles();
    const c = (this.puzzling ??= { i: 0, found: 0, t: copyTables(this.t) });
    const r = rng(77);
    while (c.i < set.length) {
      const p = set[c.i++]!;
      const m = search(p.g, 60, c.t, r);
      if (m >= 0 && p.best.includes(outer(p.g, m))) c.found++;
      if (clock() - t0 > sliceMs()) break;
    }
    if (c.i < set.length) return false;
    this.puz = { found: c.found, of: set.length };
    this.puzzling = null;
    return true;
  }
  /** The whole puzzle test at once (tests). */
  puzzles() {
    this.puzzling = null;
    while (!this.puzzleSlice(-Infinity));
    return this.puz!;
  }
  measure() {
    const t0 = clock();
    const rung = rungFor(this.level);
    const n = gamesFor(this.level);
    // A match against the reference (in slices), then the capture puzzles (in slices).
    if (!this.match && !this.puzzling) {
      const frozen = copyTables(this.t);
      this.match = new Match(n, (o, first) => duel(o, first, rung, frozen, 1000 + o));
    }
    if (this.match && this.match.run()) {
      this.last = this.match.res;
      this.match = null;
      this.puzzling = { i: 0, found: 0, t: copyTables(this.t) };
    }
    if (!this.match && this.puzzling) this.puzzleSlice(t0);
    const pending = !!this.match || !!this.puzzling;
    if (!this.last) {
      const played = this.match?.res.games ?? n;
      return { mastery: 0, pending, detail: `His first match against ${rungWords(rung)} is under way (${played} of ${n} games played).` };
    }
    const s = share(this.last);
    return {
      mastery: s,
      pending,
      detail: `Against ${rungWords(rung)}: ${record(this.last)} — ${Math.round(s * 100)}% of the points.${this.puz ? ` Capture puzzles: ${this.puz.found} of ${this.puz.of} solved (each answer proved by exhaustive search).` : ''}`,
    };
  }
  save(): GoSave {
    return { game: 'go', ...packTables(this.t), line: this.t.line.slice(), games: this.games, rand: this.rand };
  }
  view(): Frame {
    // A position from his last practice: who he thinks owns each point.
    const g = newGo(9);
    const r = rng(5);
    for (let k = 0; k < 30; k++) {
      const c = candidates(g);
      doMove(g, c[Math.floor(r() * c.length)]!);
    }
    const libs = libsAll(g);
    const marks: Record<number, string> = {};
    for (let pt = 0; pt < 81; pt++) {
      const v = Math.tanh(ownRaw(this.t, g, inner(g, pt), libs));
      if (g.b[inner(g, pt)] === 0 && Math.abs(v) > 0.3) marks[pt] = v > 0 ? 'ownb' : 'ownw';
    }
    return goFrame(g, `A random position: the small squares show who he expects to own each empty point (score estimate ${scoreEstimate(this.t, g).toFixed(1)} for Black, after komi).`, marks);
  }
  /** He plays himself by instinct — his learned move patterns, no search — so the game is ready at once. */
  watch(seed: number): Frame[] {
    const g = newGo(9);
    const r = rng(seed);
    const [a, b] = OPENINGS[seed % OPENINGS.length]!;
    playAt(g, inner(g, a));
    playAt(g, inner(g, b));
    const frames: Frame[] = [{ ...goFrame(g, 'He plays himself by instinct (his learned move patterns, no search).'), every: 0.3 }];
    while (!over(g) && g.moves < 160) {
      const moves = candidates(g);
      let m = moves[0]!;
      if (m >= 0 && moves.length > 1) {
        const libs = libsAll(g);
        let best = -Infinity;
        for (const c of moves) {
          const [cl, cap, save] = polFeatures(g, c, libs);
          // His instinct, with a little noise so games differ.
          const v = this.t.pol[cl]! + cap * this.t.pol[SHAPES]! + save * this.t.pol[SHAPES + 1]! + r() * 0.3;
          if (v > best) (best = v), (m = c);
        }
      }
      const mover = g.side;
      doMove(g, m);
      frames.push({ ...goFrame(g, `${mover === 1 ? 'Black' : 'White'} ${m >= 0 ? `plays ${ptName(g, outer(g, m))}` : 'passes'}.`, m >= 0 ? { [outer(g, m)]: 'new' } : {}), every: 0.3 });
    }
    const mg = margin(g);
    frames.push({ ...goFrame(g, `${mg > 0 ? 'Black' : mg < 0 ? 'White' : 'Nobody'} wins${mg ? ` by ${Math.abs(mg)}` : ''} (area, komi ${KOMI}).`), every: 0.3 });
    return frames;
  }
  /**
   * PLAY HIM. When the owner has just passed, he passes too unless he is behind — counting stones he
   * expects to die (by his own ownership estimate) for the other side — so a settled game can end
   * instead of him filling the owner's territory.
   */
  move(state: number[]) {
    const g = goFrom(state);
    if (over(g)) return -2;
    if (g.passes >= 1 && settledMargin(this.t, g) * (g.side === 1 ? 1 : -1) >= 0) return -1;
    const m = search(g, rungFor(this.level).me * 2, this.t, this.r);
    return m < 0 ? -1 : outer(g, m);
  }
}

/** Black's score (area, minus komi) if the game ended now, with stones he expects to die counted for the other side. */
export function settledMargin(t: Tables, g: Go): number {
  const libs = libsAll(g);
  const { owner } = area(g);
  const W = g.n + 2;
  let s = 0;
  for (let r = 1; r <= g.n; r++)
    for (let c = 1; c <= g.n; c++) {
      const i = r * W + c;
      const x = g.b[i]!;
      const v = Math.tanh(ownRaw(t, g, i, libs));
      let o = owner[i]!;
      // A stone he is sure will die belongs to the other side.
      if ((x === 1 && v < -0.5) || (x === 2 && v > 0.5)) o = 3 - x;
      // An empty point surrounded by stones that die goes the same way.
      if (x === 0 && !o && Math.abs(v) > 0.5) o = v > 0 ? 1 : 2;
      s += o === 1 ? 1 : o === 2 ? -1 : 0;
    }
  return s - (g.n >= 9 ? KOMI : 0);
}
const copyTables = (t: Tables): Tables => ({ own: t.own.slice(), line: t.line.slice(), pol: t.pol.slice() });

// ---- problems --------------------------------------------------------------------------------------------------------

function generate(level: number, seed: number): Problem {
  const L = lvl(level);
  const set = puzzles();
  const k = L <= 3 ? 1 : L <= 7 ? 2 : 3;
  const pool = set.filter((p) => p.n === k);
  const p = (pool.length ? pool : set)[Math.floor(rng(seed * 7727 + L)() * (pool.length || set.length))]!;
  const text = `${goText(p.g)}\nBlack to play and capture the White group that includes ${ptName(p.g, outer(p.g, p.target))} within ${p.n} Black move${p.n > 1 ? 's' : ''}, whatever White does. Which point should Black play first (e.g. "C3")?`;
  return { game: 'go', level: L, seed, text, data: { n: p.g.n, best: p.best, names: p.best.map((x) => ptName(p.g, x)) } };
}

/** Read a point like "C3" (columns skip I) from the last line. */
export function readPoint(n: number, answer: string): number {
  const named = new Set<number>();
  for (const { m, negated } of mentions(finalLine(answer), /\b([A-HJ-Ta-hj-t])-?(\d{1,2})\b/g)) {
    if (negated) continue;
    const col = 'ABCDEFGHJKLMNOPQRST'.indexOf(m[1]!.toUpperCase());
    const row = Number(m[2]);
    if (col < 0 || col >= n || row < 1 || row > n) continue;
    named.add((n - row) * n + col);
  }
  // Two different points named is not an answer.
  return named.size === 1 ? [...named][0]! : -1;
}

function check(pr: Problem, answer: string): Verdict {
  const d = pr.data as { n: number; best: number[]; names: string[] };
  const pt = readPoint(d.n, answer);
  const ok = d.best.includes(pt);
  return { correct: ok, score: ok ? 1 : 0, why: ok ? 'It captures by force.' : `A move that captures by force: ${d.names.join(' or ')}.` };
}

/** Actions: points 0–80, 81 = pass. Reward at the end: +1 to the winner. */
class GoEnv implements Env {
  g = newGo(9);
  reset() {
    this.g = newGo(9);
  }
  actions() {
    if (over(this.g)) return [];
    return [...candidates(this.g).filter((i) => i >= 0).map((i) => outer(this.g, i)), 81];
  }
  step(a: number) {
    const mover = this.g.side;
    if (a === 81) pass(this.g);
    else if (!playAt(this.g, inner(this.g, a))) return { reward: -1, done: false };
    if (over(this.g)) {
      const m = margin(this.g);
      return { reward: m === 0 ? 0 : (m > 0) === (mover === 1) ? 1 : -1, done: true };
    }
    return { reward: 0, done: false };
  }
  describe() {
    return goText(this.g);
  }
}

export const go: Game = {
  ...GO,
  env: () => new GoEnv(),
  generate,
  check,
  learner: (level, seed, saved) => new GoLearner(level, seed, saved),
};

