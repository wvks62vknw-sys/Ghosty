/**
 * GO 9×9 (area scoring, komi 7, simple ko, suicide illegal). Ghosty plays with a tree search (PUCT) whose
 * move choices are led by a learned sense of shape: a value for each 3×3 and 5×5 pattern around a point
 * (all rotations and mirror images alike, colours seen from the side to move), plus a few tactical signs
 * (it captures, it saves a group in atari, it puts a group in atari, it is self-atari), the line from the
 * edge and the distance from the last move. Positions are judged by quick play-outs.
 *
 * How he learns (expert iteration): he plays himself, and at every move searches with his own sense of
 * shape (a quarter of it replaced by "every move alike", so he keeps looking at moves he would not play);
 * then his sense of shape is nudged towards the moves the search preferred. A better sense of shape makes
 * the search better, which teaches a better sense of shape: his play keeps improving for hundreds of games
 * (measured, see the tests and MAP.md).
 *
 * Ground truth: a fixed ladder of reference engines — plain Monte Carlo tree search (UCT) with the same
 * kind of play-outs, which first answer the last move (capture a group it left in atari, save one's own)
 * and otherwise play at random, never filling their own eyes — at more and more play-outs a move (RUNGS).
 * He plays by instinct (his sense of shape alone, or a very small search). Mastery = his share of the
 * points from fixed openings played both ways. No rating is shown: only what the matches measured. Second
 * measure: capture puzzles on small boards (Black to play and capture the marked stones, whatever White
 * does), each answer proved by exhaustive search.
 *
 * Play-outs run on a separate fast board (gofast.ts: groups with pseudo-liberties, no flood fills), about
 * thirty times quicker than the plain board, which is what makes this affordable on a phone.
 */
import { finalLine, type Env, type Frame, type Game, type Learner, lvl, mentions, type Problem, rng, savedFor, type Verdict } from './core';
import { area, copyGo, type Go, goFrame, goFrom, goState, goText, inner, isEye, KOMI, legalAt, margin, newGo, outer, over, pass, playAt, ptName } from './goboard';
import { Fast, fastPlayout } from './gofast';
import { GO_PUZZLES } from './gosets';
import { Match, type MatchResult, record, share, sliceMs, type Stepper, trainMs } from './match';
import { GO } from './meta';

const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export * from './goboard';
export { setSlice } from './match';

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

const FB = new Fast();
/** A play-out to the end on the fast board (heavy: answer the last move's atari first); Black's margin, after komi. */
export function playout(g: Go, r: () => number, heavy = true): number {
  return fastPlayout(FB.load(g), r, heavy, g.n >= 9 ? KOMI : 0);
}

// ---- his sense of shape ------------------------------------------------------------------------------------------

/** Offsets of the 5×5 window (centre left out), and the eight symmetries of the square as index maps. */
const OFF: [number, number][] = [];
for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) if (dr || dc) OFF.push([dr, dc]);
const SYM: number[][] = [];
for (let s = 0; s < 8; s++)
  SYM.push(
    OFF.map(([r, c]) => {
      let [a, b] = [r, c];
      if (s & 1) [a, b] = [b, a];
      if (s & 2) a = -a;
      if (s & 4) b = -b;
      return OFF.findIndex(([x, y]) => x === a && y === b);
    }),
  );
const NEAR = OFF.map(([r, c]) => Math.max(Math.abs(r), Math.abs(c)) <= 1);
const Z = (() => {
  const r = rng(4242);
  const z = new Uint32Array(24 * 4 * 2);
  for (let k = 0; k < z.length; k++) z[k] = Math.floor(r() * 2 ** 32) >>> 0;
  return z;
})();
/** Pattern values are kept in two hashed tables of 2^15 entries each (3×3, then 5×5). */
const PBITS = 15;
const PSIZE = 1 << PBITS;
const PMASK = PSIZE - 1;
/** The flags after the two pattern tables: captures, saves, ataris, self-atari, line 0–4, distance to the last move 1–6 (or none). */
const FLAG = 2 * PSIZE;
export const NWEIGHTS = FLAG + 24;
const VALS = new Uint8Array(24);
/** Hashes of the 3×3 and 5×5 pattern around i as seen by the side to move — the same for all 8 symmetries. */
function patterns(f: Fast, i: number): [number, number] {
  const W = f.W;
  const me = f.side;
  const r0 = Math.floor(i / W);
  const c0 = i % W;
  for (let k = 0; k < 24; k++) {
    const r = r0 + OFF[k]![0];
    const c = c0 + OFF[k]![1];
    let v = 3;
    if (r >= 0 && r < W && c >= 0 && c < W) {
      const x = f.col[r * W + c]!;
      v = x === 0 ? 0 : x === 3 ? 3 : x === me ? 1 : 2;
    }
    VALS[k] = v;
  }
  let h3 = 0xffffffff;
  let h5 = 0xffffffff;
  for (let s = 0; s < 8; s++) {
    const sm = SYM[s]!;
    let a = 0;
    let b = 0;
    for (let k = 0; k < 24; k++) {
      const v = VALS[sm[k]!]!;
      b ^= Z[k * 4 + v]!;
      if (NEAR[k]) a ^= Z[96 + k * 4 + v]!;
    }
    a >>>= 0;
    b >>>= 0;
    if (a < h3) h3 = a;
    if (b < h5) h5 = b;
  }
  return [h3 & PMASK, h5 & PMASK];
}
/** The weights a move at i lights up for the side to move on fast board `f0`; `last` is the last move (−1 none). */
function features(f0: Fast, i: number, last: number): number[] {
  const W = f0.W;
  const n = f0.n;
  const [p3, p5] = patterns(f0, i);
  const f = [p3, PSIZE + p5];
  const me = f0.side;
  let cap = 0;
  let save = 0;
  let atari = 0;
  let emptyN = 0;
  let safe = 0;
  for (const j of [i - 1, i + 1, i - W, i + W]) {
    const x = f0.col[j]!;
    if (x === 0) emptyN++;
    if (x !== 1 && x !== 2) continue;
    const h = f0.head[j]!;
    const lib = f0.atariLib(h);
    if (x !== me && lib === i) cap = 1;
    if (x === me && lib === i) save = 1;
    if (x === me && lib !== i) safe = 1;
    if (x !== me && lib < 0 && f0.pl[h]! <= 3) atari = 1;
  }
  if (cap) f.push(FLAG);
  if (save) f.push(FLAG + 1);
  if (atari) f.push(FLAG + 2);
  if (!safe && emptyN + cap <= 1) f.push(FLAG + 3);
  const r = Math.floor(i / W) - 1;
  const c = (i % W) - 1;
  f.push(FLAG + 5 + Math.min(4, r, c, n - 1 - r, n - 1 - c));
  if (last >= 0) f.push(FLAG + 10 + Math.min(5, Math.abs(Math.floor(last / W) - Math.floor(i / W)) + Math.abs((last % W) - (i % W))));
  else f.push(FLAG + 16);
  return f;
}
/** His instinct for each candidate move on fast board `f`: the softmax of its weights' sum (mixed with `mix` of "all alike"); also the features used. */
function instinct(w: Float32Array | null, f: Fast, moves: number[], last: number, mix = 0): { prior: Float32Array; feats: number[][] | null } {
  const prior = new Float32Array(moves.length);
  if (!w || moves[0]! < 0) return { prior: prior.fill(1 / moves.length), feats: null };
  const feats = moves.map((m) => features(f, m, last));
  const lg = feats.map((ft) => ft.reduce((s, k) => s + w[k]!, 0));
  let mx = -Infinity;
  for (const v of lg) if (v > mx) mx = v;
  let sum = 0;
  lg.forEach((v, k) => (sum += prior[k] = Math.exp(v - mx)));
  const keep = (1 - mix) / sum;
  const even = mix / prior.length;
  for (let k = 0; k < prior.length; k++) prior[k] = prior[k]! * keep + even;
  return { prior, feats };
}

// ---- search ------------------------------------------------------------------------------------------------------

interface Node {
  moves: number[];
  prior: Float32Array;
  feats: number[][] | null;
  n: Int32Array;
  w: Float64Array;
  kids: (Node | null)[];
  total: number;
}
/** How strongly his search follows his instinct (PUCT's constant); the reference uses plain UCT instead. */
const CPUCT = 0.5;
const SIM = new Fast();

/**
 * One engine's search for a move, run a slice at a time, on the fast board. `w` = his weights (PUCT led by
 * his instinct, `mix` of it replaced by "all alike"); null = the reference (UCT: every move tried once,
 * then the usual bound). Both judge a new position by one play-out.
 */
export class Searcher {
  root: Node | null = null;
  only = -1;
  done = 0;
  private f0: Fast;
  private komi: number;
  constructor(
    g0: Go,
    private w: Float32Array | null,
    private r: () => number,
    last = -1,
    private mix = 0,
  ) {
    this.f0 = new Fast().load(g0);
    this.komi = g0.n >= 9 ? KOMI : 0;
    const moves = this.f0.candidates();
    if (moves.length === 1) this.only = moves[0]!;
    else this.root = this.open(this.f0, moves, last);
  }
  private open(f: Fast, moves: number[], last: number): Node {
    const { prior, feats } = instinct(this.w, f, moves, last, this.mix);
    return { moves, prior, feats, n: new Int32Array(moves.length), w: new Float64Array(moves.length), kids: new Array(moves.length).fill(null), total: 0 };
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
  run(sims: number): void {
    const root = this.root;
    if (!root) return;
    const { w, r } = this;
    const f = SIM;
    const cap = this.f0.n * this.f0.n * 3;
    for (let s = 0; s < sims; s++) {
      this.done++;
      f.copyFrom(this.f0);
      const path: [Node, number][] = [];
      let node = root;
      let value: number;
      for (;;) {
        let best = 0;
        let bv = -Infinity;
        const sq = Math.sqrt(node.total + 1);
        const ln = Math.log(node.total + 1);
        for (let k = 0; k < node.moves.length; k++) {
          const n = node.n[k]!;
          const u = w ? (n ? node.w[k]! / n : 0.45) + (CPUCT * node.prior[k]! * sq) / (1 + n) : n ? node.w[k]! / n + Math.sqrt((2 * ln) / n) : 1e9 + r();
          if (u > bv) (bv = u), (best = k);
        }
        const mover = f.side;
        const mv = node.moves[best]!;
        f.move(mv);
        path.push([node, best]);
        if (f.passes >= 2 || f.moves > cap) {
          const m = f.score() - this.komi;
          value = m === 0 ? 0.5 : (m > 0) === (mover === 1) ? 1 : 0;
          break;
        }
        const kid = node.kids[best];
        if (!kid) {
          node.kids[best] = this.open(f, f.candidates(), mv);
          const m = fastPlayout(f, r, true, this.komi);
          value = m === 0 ? 0.5 : (m > 0) === (mover === 1) ? 1 : 0;
          break;
        }
        node = kid;
      }
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
const FF = new Fast();
/** His move by instinct alone: the candidate his sense of shape likes best (with a little random noise if asked). */
export function instinctMove(w: Float32Array, g: Go, last: number, noise = 0, r: () => number = Math.random): number {
  FF.load(g);
  const moves = FF.candidates();
  if (moves.length === 1) return moves[0]!;
  const { prior } = instinct(w, FF, moves, last);
  let best = 0;
  let bv = -Infinity;
  for (let k = 0; k < moves.length; k++) {
    const v = prior[k]! * (noise ? 1 + noise * r() : 1);
    if (v > bv) (bv = v), (best = k);
  }
  return moves[best]!;
}
/** A whole search at once: `sims` simulations (his when `w` is given), then the most visited move. */
export function search(g0: Go, sims: number, w: Float32Array | null, r: () => number, last = -1): number {
  if (w && sims <= 1) return instinctMove(w, g0, last);
  const s = new Searcher(g0, w, r, last);
  s.run(sims);
  return s.best();
}

// ---- matches -----------------------------------------------------------------------------------------------------

/** Fixed openings: the first two stones (one each) in the middle of the board, the same list every time. */
export const OPENINGS: [number, number][] = (() => {
  const r = rng(9090);
  const out: [number, number][] = [];
  while (out.length < 64) {
    const a = (2 + Math.floor(r() * 5)) * 9 + 2 + Math.floor(r() * 5);
    const b = (2 + Math.floor(r() * 5)) * 9 + 2 + Math.floor(r() * 5);
    if (a !== b && !out.some(([x, y]) => x === a && y === b)) out.push([a, b]);
  }
  return out;
})();
/** A rung of the ladder: his searches a move (1 = by instinct alone), the reference's play-outs a move, and points added to his score (negative: he gives them). */
export interface Rung {
  me: number;
  ref: number;
  bonus: number;
  /** Handicap stones the reference gets after the opening (he gives them). */
  stones?: number;
}
/** Where handicap stones go (outer points, in order): the 3-3 points, then the centre. */
const HANDICAP = [20, 60, 24, 56, 40];
export const RUNGS: Rung[] = [
  { me: 1, ref: 32, bonus: 0 },
  { me: 1, ref: 128, bonus: 0 },
  { me: 1, ref: 256, bonus: 0 },
  // Then he gives the 256-play-out engine a free stone, or two, and must win more and more often.
  { me: 1, ref: 256, bonus: 0, stones: 1 },
  { me: 1, ref: 256, bonus: 0, stones: 1 },
  { me: 1, ref: 256, bonus: 0, stones: 2 },
  { me: 1, ref: 256, bonus: 0, stones: 1 },
  { me: 1, ref: 256, bonus: 0, stones: 2 },
  { me: 1, ref: 256, bonus: 0, stones: 1 },
  { me: 1, ref: 256, bonus: 0, stones: 2 },
];
export const rungFor = (level: number) => RUNGS[lvl(level) - 1]!;
/** Games a match (half of them each way): 64 at first, 128 from Level 4, where the steps between levels are smaller. */
export const gamesFor = (level: number) => (lvl(level) <= 3 ? 64 : 128);
const rungWords = (r: Rung) =>
  `the reference engine (tree search with ${r.ref} play-outs a move)${r.stones ? `, starting with ${r.stones} extra stone${r.stones > 1 ? 's' : ''}` : ''}${r.bonus > 0 ? `, giving him ${r.bonus} points` : r.bonus < 0 ? `, with him giving ${-r.bonus} points` : ''}; he plays ${r.me <= 1 ? 'by instinct (his sense of shape alone, no search)' : `with ${r.me} searches a move`}`;

/** One game against the reference of a rung: he is Black when he moves "first". */
export function duel(opening: number, first: boolean, rung: Rung, mine: Float32Array, seed: number): Stepper & { g: Go; me: number } {
  const g = newGo(9);
  const [a, b] = OPENINGS[opening % OPENINGS.length]!;
  playAt(g, inner(g, a));
  playAt(g, inner(g, b));
  const me = first ? 1 : 2;
  // His handicap: the reference's free stones.
  for (let k = 0, left = rung.stones ?? 0; left > 0 && k < HANDICAP.length; k++) {
    const i = inner(g, HANDICAP[k]!);
    if (g.b[i] === 0) (g.b[i] = 3 - me), left--;
  }
  const r = rng(seed * 2 + (first ? 1 : 0));
  let last = inner(g, b);
  let cur: Searcher | null = null;
  return {
    g,
    me,
    // One step = a slice of one move's search (about 30 ms at most), so the worker is never held up for long.
    step() {
      if (over(g) || g.moves > 200) {
        const m = (me === 1 ? margin(g) : -margin(g)) + rung.bonus;
        return m === 0 ? 0.5 : m > 0 ? 1 : 0;
      }
      if (g.side === me && rung.me <= 1) {
        last = instinctMove(mine, g, last);
        doMove(g, last);
        return null;
      }
      const sims = g.side === me ? rung.me : rung.ref;
      cur ??= new Searcher(g, g.side === me ? mine : null, r, last);
      cur.runFor(sims - cur.done, 30);
      if (cur.done >= sims || !cur.root) {
        last = cur.best();
        doMove(g, last);
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

/** Self-play: searches a move (doubled after 300 games), with a quarter of "every move alike" mixed into his instinct; his step size. */
const TEACHER_SIMS = 32;
const TMIX = 0.25;
const RATE = 0.005;

/** What is kept: every weight, rounded to 1/2048 (16 bits each, 128 KB). */
interface GoSave {
  game: 'go';
  q: Int16Array;
  games: number;
  rand: number;
}
export const packWeights = (w: Float32Array) => Int16Array.from(w, (x) => Math.max(-32767, Math.min(32767, Math.round(x * 2048))));
export const unpackWeights = (q: Int16Array) => Float32Array.from(q, (x) => x / 2048);

/** Black's margin expected from `n` play-outs from here (who owns what, as the play-outs finish it). */
export function expectedMargin(g: Go, n: number, r: () => number): number {
  let s = 0;
  for (let k = 0; k < n; k++) s += playout(g, r);
  return s / n;
}
/** How often each point ends up Black's (+1) or White's (−1) over `n` play-outs. */
export function ownership(g: Go, n: number, r: () => number): Float32Array {
  const out = new Float32Array(g.b.length);
  for (let k = 0; k < n; k++) {
    playout(g, r);
    const f = FB;
    for (let i = 0; i < g.b.length; i++) {
      let x = f.col[i]!;
      if (x === 0) {
        // At the end of a play-out an empty point is an eye: it belongs to its neighbours' colour.
        for (const d of f.dirs) {
          const y = f.col[i + d]!;
          if (y === 1 || y === 2) x = y;
        }
      }
      out[i]! += x === 1 ? 1 / n : x === 2 ? -1 / n : 0;
    }
  }
  return out;
}

class GoLearner implements Learner {
  w: Float32Array;
  games: number;
  rand: number;
  r: () => number;
  match: Match | null = null;
  last: MatchResult | null = null;
  /** The capture-puzzle test after each match (a slice at a time), and the last finished one. */
  puzzling: { i: number; found: number; w: Float32Array } | null = null;
  puz: { found: number; of: number } | null = null;
  constructor(
    private level: number,
    seed: number,
    saved?: unknown,
  ) {
    // What he learned carries over between levels.
    const s = savedFor<GoSave>(saved, 'go');
    this.w = s?.q?.length === NWEIGHTS ? unpackWeights(s.q) : new Float32Array(NWEIGHTS);
    this.games = s?.games ?? 0;
    this.rand = s?.rand ?? seed;
    this.r = rng(this.rand);
  }
  /** Nudge his instinct at a searched position towards the share of the search's visits each move got. */
  private learn(root: { feats: number[][] | null; moves: number[]; n: Int32Array; total: number }) {
    if (!root.feats || root.total < 2) return;
    const w = this.w;
    const lg = root.feats.map((f) => f.reduce((s, k) => s + w[k]!, 0));
    let mx = -Infinity;
    for (const v of lg) if (v > mx) mx = v;
    const ex = lg.map((v) => Math.exp(v - mx));
    const sum = ex.reduce((a, b) => a + b, 0);
    root.feats.forEach((f, k) => {
      const gr = RATE * (root.n[k]! / root.total - ex[k]! / sum);
      for (const j of f) w[j]! += gr;
    });
  }
  /** The self-play game under way (played a few moves per call, so the worker is never held up). */
  private cur: { g: Go; last: number } | null = null;
  /** Play on in the current self-play game for up to the training slice; true when it finished. */
  private play(): boolean {
    this.cur ??= { g: newGo(9), last: -1 };
    const c = this.cur;
    const g = c.g;
    const t0 = clock();
    for (let i = 0; !over(g) && g.moves < 200 && (i === 0 || clock() - t0 < trainMs()); i++) {
      let m: number;
      if (g.moves < 2) {
        const cand = candidates(g);
        m = cand[Math.floor(this.r() * cand.length)]!;
      } else {
        // At first his instinct is worth nothing, so the search starts out treating every move alike (he learns
        // what a plain search prefers); his own instinct takes over over the first 60 games.
        const s = new Searcher(g, this.w, this.r, c.last, Math.max(TMIX, 1 - this.games / 60));
        // Once his instinct is good (300 games), he searches twice as hard in practice: a sharper teacher.
        s.run(this.games < 300 ? TEACHER_SIMS : 2 * TEACHER_SIMS);
        m = s.best();
        const root = s.root;
        if (root) {
          this.learn(root);
          // Early on, follow the search's visits loosely (more variety).
          if (g.moves < 10) {
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
      c.last = m;
    }
    if (!over(g) && g.moves < 200) return false;
    this.cur = null;
    return true;
  }
  /** A unit is a whole self-play game; one call plays a slice of it (0 until a game is finished). */
  train(_n: number) {
    if (!this.play()) return 0;
    this.games++;
    this.rand = (this.rand + 2654435761) >>> 0;
    return 1;
  }
  /** Capture puzzles, a slice at a time: his move (a small search led by his instinct) is one that captures by force. */
  private puzzleSlice(t0: number): boolean {
    const set = puzzles();
    const c = (this.puzzling ??= { i: 0, found: 0, w: this.w.slice() });
    const r = rng(77);
    while (c.i < set.length) {
      const p = set[c.i++]!;
      const m = search(p.g, 60, c.w, r);
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
      const frozen = this.w.slice();
      this.match = new Match(n, (o, first) => duel(o, first, rung, frozen, 1000 + o));
    }
    if (this.match && this.match.run()) {
      this.last = this.match.res;
      this.match = null;
      this.puzzling = { i: 0, found: 0, w: this.w.slice() };
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
    return { game: 'go', q: packWeights(this.w), games: this.games, rand: this.rand };
  }
  view(): Frame {
    // A position from a quick game by instinct: who the play-outs say owns each point.
    const g = newGo(9);
    const r = rng(5);
    let last = -1;
    for (let k = 0; k < 24 && !over(g); k++) {
      last = instinctMove(this.w, g, last, 0.5, r);
      doMove(g, last);
    }
    const own = ownership(g, 24, r);
    const marks: Record<number, string> = {};
    for (let pt = 0; pt < 81; pt++) {
      const v = own[inner(g, pt)]!;
      if (g.b[inner(g, pt)] === 0 && Math.abs(v) > 0.5) marks[pt] = v > 0 ? 'ownb' : 'ownw';
    }
    return goFrame(g, `A game of his by instinct, 24 moves in: the small squares show who quick play-outs say will own each empty point (Black expects ${expectedMargin(g, 24, r).toFixed(1)}, after komi). His instinct comes from ${this.games.toLocaleString('en')} practice games.`, marks);
  }
  /** He plays himself by instinct — his learned sense of shape, no search — so the game is ready at once. */
  watch(seed: number): Frame[] {
    const g = newGo(9);
    const r = rng(seed);
    const [a, b] = OPENINGS[seed % OPENINGS.length]!;
    playAt(g, inner(g, a));
    playAt(g, inner(g, b));
    let last = inner(g, b);
    const frames: Frame[] = [{ ...goFrame(g, 'He plays himself by instinct (his learned sense of shape, no search).'), every: 0.3 }];
    while (!over(g) && g.moves < 160) {
      const m = instinctMove(this.w, g, last, 0.3, r);
      const mover = g.side;
      doMove(g, m);
      last = m;
      frames.push({ ...goFrame(g, `${mover === 1 ? 'Black' : 'White'} ${m >= 0 ? `plays ${ptName(g, outer(g, m))}` : 'passes'}.`, m >= 0 ? { [outer(g, m)]: 'new' } : {}), every: 0.3 });
    }
    const mg = margin(g);
    frames.push({ ...goFrame(g, `${mg > 0 ? 'Black' : mg < 0 ? 'White' : 'Nobody'} wins${mg ? ` by ${Math.abs(mg)}` : ''} (area, komi ${KOMI}).`), every: 0.3 });
    return frames;
  }
  /**
   * PLAY HIM. When the owner has just passed, he passes too unless he is behind — by the count as the
   * board stands or by quick play-outs from here — so a settled game can end instead of him filling the
   * owner's territory.
   */
  move(state: number[]) {
    const g = goFrom(state);
    if (over(g)) return -2;
    // (Both the count as the board stands and quick play-outs from here must say he is not behind.)
    const mine = g.side === 1 ? 1 : -1;
    if (g.passes >= 1 && margin(g) * mine >= 0 && expectedMargin(g, 32, this.r) * mine >= 0) return -1;
    const m = search(g, 64, this.w, this.r);
    return m < 0 ? -1 : outer(g, m);
  }
}

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

