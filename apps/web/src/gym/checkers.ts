/**
 * CHECKERS (English draughts). Ghosty's evaluator is small and learned: a value for a man and for a king on
 * each of the 32 squares (seen from the owner's side of the board), trained by temporal-difference learning
 * in self-play — each position's value is nudged towards the value of the position after his move, and
 * the last one towards the result. He plays with an alpha-beta search (captures searched to the end) and
 * that evaluator.
 *
 * Ground truth: a fixed ladder of reference engines — the SAME alpha-beta search at depths 1–8 with a
 * hand-written material + position evaluator (a man 100, a king 160, plus a little for advancing, the
 * centre and guarding the back row). At Level L he plays a match against the reference engine at the
 * same depth (Levels 9–10: depth 8 again, with a higher bar), so the only difference is what he has
 * learned about positions. Mastery = his match score (a win 1, a draw ½), from fixed openings played
 * both ways. His estimated rating is on Ghosty's own scale for this ladder (the depth-1 engine = 1000,
 * each step up measured by matches between the reference engines themselves).
 */
import { type Ck, type CkMove, ckFrame, ckFrom, ckState, ckText, copyCk, legalCk, moveText, NB, playCk, resultCk, rowOf, colOf, startCk } from './ckboard';
import { finalLine, type Env, type Frame, type Game, type Learner, lvl, type Problem, rng, savedFor, type Verdict } from './core';
import { Match, type MatchResult, perfRating, record, share, type Stepper } from './match';
import { CHECKERS } from './meta';

export * from './ckboard';
export { setSlice } from './match';

const WIN = 100_000;
export const depthFor = (level: number) => Math.min(8, lvl(level));

// ---- the search -------------------------------------------------------------------------------------------------

/** An evaluator: the position's value for the side to move (any scale; bigger is better). */
export type CkEval = (p: Ck) => number;

interface Undo {
  pc: number;
  capsV: number[];
  q: number;
}
function make(p: Ck, m: CkMove): Undo {
  const u = { pc: p.b[m.path[0]!]!, capsV: m.caps.map((c) => p.b[c]!), q: p.quiet };
  playCk(p, m);
  return u;
}
function unmake(p: Ck, m: CkMove, u: Undo): void {
  p.b[m.path[m.path.length - 1]!] = 0;
  p.b[m.path[0]!] = u.pc;
  m.caps.forEach((c, i) => (p.b[c] = u.capsV[i]!));
  p.quiet = u.q;
  p.side = -p.side;
}

let lastNodes = 0;
/**
 * Negamax alpha-beta; at depth 0 a position with a capture to make is searched on (up to 8 plies more), so
 * no exchange is cut in half. A generator that pauses every 2,048 positions, so a deep search can run a
 * slice at a time.
 */
function* ab(p: Ck, depth: number, alpha: number, beta: number, ev: CkEval, ply: number, c: { nodes: number }): Generator<void, number, void> {
  if ((++c.nodes & 2047) === 0) yield;
  const moves = legalCk(p);
  if (!moves.length) return -WIN + ply;
  if (p.quiet >= 80) return 0;
  if (depth <= 0 && (!moves[0]!.caps.length || depth <= -8)) return ev(p);
  if (moves.length > 1 && moves[0]!.caps.length) moves.sort((a, b) => b.caps.length - a.caps.length);
  let best = -Infinity;
  for (const m of moves) {
    const u = make(p, m);
    const v = -(yield* ab(p, depth - 1, -beta, -alpha, ev, ply + 1, c));
    unmake(p, m, u);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

/** The best move at `depth` with evaluator `ev`, as a search that can be paused (the first of equals, in the order moves are listed). */
export function* searchGen(p0: Ck, depth: number, ev: CkEval, moves = legalCk(p0)): Generator<void, { move: CkMove; value: number }, void> {
  const p = copyCk(p0);
  if (moves.length === 1) return { move: moves[0]!, value: 0 };
  const c = { nodes: 0 };
  let best = moves[0]!;
  let alpha = -Infinity;
  for (const m of moves) {
    const u = make(p, m);
    const v = -(yield* ab(p, depth - 1, -Infinity, -alpha, ev, 1, c));
    unmake(p, m, u);
    if (v > alpha) (alpha = v), (best = m);
  }
  lastNodes = c.nodes;
  return { move: best, value: alpha };
}
/** …run to the end at once. */
export function bestMove(p0: Ck, depth: number, ev: CkEval, moves = legalCk(p0)): { move: CkMove; value: number } {
  const it = searchGen(p0, depth, ev, moves);
  for (;;) {
    const r = it.next();
    if (r.done) return r.value;
  }
}
export const nodeCount = () => lastNodes;

// ---- the reference evaluator (hand-written) -----------------------------------------------------------------------

/** Material and position, for the side to move: man 100, king 160; men gain 3 a row advanced and 8 on their own back row; 4 for the centre. */
export const referenceEval: CkEval = (p) => {
  let s = 0;
  for (let i = 0; i < 32; i++) {
    const x = p.b[i]!;
    if (!x) continue;
    const r = rowOf(i);
    const c = colOf(i);
    const centre = r >= 2 && r <= 5 && c >= 2 && c <= 5 ? 4 : 0;
    let v: number;
    if (Math.abs(x) === 2) v = 160 + centre;
    else {
      const adv = x > 0 ? r : 7 - r;
      v = 100 + 3 * adv + centre + (adv === 0 ? 8 : 0);
    }
    s += x > 0 ? v : -v;
  }
  return s * p.side;
};

// ---- the learned evaluator ----------------------------------------------------------------------------------------

/** 64 weights: a man on each square, then a king on each square, seen from the owner's side (White's squares mirrored). */
export const NW = 64;
const own = (i: number, x: number) => (x > 0 ? i : 31 - i) + (Math.abs(x) === 2 ? 32 : 0);

/** The raw learned value for the side to move. */
export function learnedRaw(w: Float32Array, p: Ck): number {
  let s = 0;
  for (let i = 0; i < 32; i++) {
    const x = p.b[i]!;
    if (!x) continue;
    const v = w[own(i, x)]!;
    s += Math.sign(x) === p.side ? v : -v;
  }
  return s;
}
export const learnedEval = (w: Float32Array): CkEval => (p) => learnedRaw(w, p);

function tdUpdate(w: Float32Array, p: Ck, target: number, rate: number): void {
  const v = Math.tanh(learnedRaw(w, p));
  const g = rate * (target - v) * (1 - v * v);
  for (let i = 0; i < 32; i++) {
    const x = p.b[i]!;
    if (!x) continue;
    w[own(i, x)]! += Math.sign(x) === p.side ? g : -g;
  }
}

// ---- matches against the reference ladder -----------------------------------------------------------------------

/** Fixed openings: four random moves from the start (the same list every time), each played both ways. */
export function openings(n: number): CkMove[][] {
  const out: CkMove[][] = [];
  const seen = new Set<string>();
  const r = rng(4242);
  while (out.length < n) {
    const p = startCk();
    const line: CkMove[] = [];
    for (let k = 0; k < 4; k++) {
      const ms = legalCk(p);
      const m = ms[Math.floor(r() * ms.length)]!;
      line.push(m);
      playCk(p, m);
    }
    const key = Array.from(p.b).join('');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}
const OPEN = openings(8);
export const gamesFor = (level: number) => (lvl(level) <= 5 ? 16 : 8);
const MAX_PLIES = 200;

/** One game: him (evaluator `mine`) against the reference, both at `depth`. */
export function duel(opening: number, first: boolean, depth: number, mine: CkEval): Stepper & { p: Ck } {
  const p = startCk();
  for (const m of OPEN[opening % OPEN.length]!) playCk(p, m);
  // "First" = he plays the side to move after the opening.
  const me = first ? p.side : -p.side;
  let plies = 0;
  let cur: Generator<void, { move: CkMove; value: number }, void> | null = null;
  return {
    p,
    // One step = a slice of one move's search (about two thousand positions), so the worker is never held up for long.
    step() {
      if (!cur) {
        const moves = legalCk(p);
        const res = resultCk(p, moves);
        if (res) return res === 0.5 ? 0.5 : res === me ? 1 : 0;
        if (plies++ >= MAX_PLIES) return 0.5;
        cur = searchGen(p, depth, p.side === me ? mine : referenceEval, moves);
      }
      const x = cur.next();
      if (x.done) {
        playCk(p, x.value.move);
        cur = null;
      }
      return null;
    },
  };
}

/**
 * Ratings of the reference engines on Ghosty's own scale: depth 1 = 1000, each next depth rated by a
 * 16-game match against the one before (fixed openings both ways). Deeper search helps less than one might
 * think here: most games between them are drawn.
 */
export const LADDER = [1000, 1044, 1110, 1153, 1219, 1241, 1285, 1306];
export const ladderRating = (depth: number) => LADDER[Math.max(1, Math.min(8, depth)) - 1]!;

// ---- the learner ---------------------------------------------------------------------------------------------------

/** TD step size. */
const RATE = 0.008;

interface CkSave {
  game: 'checkers';
  w: Float32Array;
  games: number;
  rand: number;
}

class CkLearner implements Learner {
  w: Float32Array;
  games: number;
  rand: number;
  r: () => number;
  match: Match | null = null;
  last: MatchResult | null = null;
  constructor(
    private level: number,
    seed: number,
    saved?: unknown,
  ) {
    // The evaluator carries over between levels.
    const s = savedFor<CkSave>(saved, 'checkers');
    this.w = s?.w?.length === NW ? s.w : new Float32Array(NW);
    this.games = s?.games ?? 0;
    this.rand = s?.rand ?? seed;
    this.r = rng(this.rand);
  }
  /** His move in self-play: the best position one move ahead by his evaluator, now and then a random one. */
  private pick(p: Ck, moves: CkMove[]): CkMove {
    if (moves.length === 1) return moves[0]!;
    if (this.r() < 0.08) return moves[Math.floor(this.r() * moves.length)]!;
    let best = moves[0]!;
    let bv = -Infinity;
    for (const m of moves) {
      const u = make(p, m);
      const v = legalCk(p).length ? -learnedRaw(this.w, p) : WIN;
      unmake(p, m, u);
      if (v > bv) (bv = v), (best = m);
    }
    return best;
  }
  train(n: number) {
    const k = Math.max(1, Math.min(n, 40));
    for (let g = 0; g < k; g++) {
      const p = startCk();
      // A few random moves first, so he meets all kinds of positions.
      let opening = Math.floor(this.r() * 6);
      for (let ply = 0; ply < MAX_PLIES; ply++) {
        const moves = legalCk(p);
        const res = resultCk(p, moves);
        if (res) {
          // Side to move has lost (no moves) or a draw.
          tdUpdate(this.w, p, res === 0.5 ? 0 : -1, RATE);
          break;
        }
        const m = opening-- > 0 ? moves[Math.floor(this.r() * moves.length)]! : this.pick(p, moves);
        const before = copyCk(p);
        playCk(p, m);
        const after = legalCk(p);
        const r2 = resultCk(p, after);
        // The value before the move should match minus the value after it (the other side to move then).
        const target = r2 ? (r2 === 0.5 ? 0 : 1) : -Math.tanh(learnedRaw(this.w, p));
        tdUpdate(this.w, before, target, RATE);
      }
    }
    this.games += k;
    this.rand = (this.rand + k * 2654435761) >>> 0;
    return k;
  }
  measure() {
    const d = depthFor(this.level);
    const n = gamesFor(this.level);
    if (!this.match) {
      const frozen = this.w.slice();
      this.match = new Match(n, (o, first) => duel(o, first, d, learnedEval(frozen)));
    }
    if (this.match.run()) {
      this.last = this.match.res;
      this.match = null;
    }
    if (!this.last) {
      const played = this.match?.res.games ?? 0;
      return { mastery: 0, detail: `His first match against the depth-${d} reference engine is under way (${played} of ${n} games played).` };
    }
    const s = share(this.last);
    return {
      mastery: s,
      detail: `Against the reference engine that also looks ${d} move${d > 1 ? 's' : ''} ahead (hand-written material + position evaluator): ${record(this.last)} — ${Math.round(s * 100)}% of the points. Estimated rating ${perfRating(s, ladderRating(d))} on Ghosty's ladder (depth-1 engine = 1000, depth-${d} = ${ladderRating(d)}).`,
    };
  }
  save(): CkSave {
    return { game: 'checkers', w: this.w, games: this.games, rand: this.rand };
  }
  view(): Frame {
    // What a man is worth on each square to him (Black's view), relative to his average man.
    const avg = this.w.slice(0, 32).reduce((a, b) => a + b, 0) / 32;
    const king = this.w.slice(32).reduce((a, b) => a + b, 0) / 32;
    const p: Ck = { b: new Int8Array(32), side: 1, quiet: 0 };
    const f = ckFrame(p, `What a man is worth to him on each square (brighter = more). A king is worth ${avg > 0 ? (king / avg).toFixed(2) : '?'} men to him.`);
    const mx = Math.max(1e-9, ...Array.from(this.w.slice(0, 32), (x) => Math.abs(x - avg)));
    for (let i = 0; i < 32; i++) {
      const cell = rowOf(i) * 8 + colOf(i);
      const x = (this.w[i]! - avg) / mx;
      f.grid!.cells[cell] = { c: `hsl(${x >= 0 ? 190 : 350} 85% ${14 + Math.abs(x) * 36}%)` };
    }
    return f;
  }
  watch(seed: number): Frame[] {
    // He plays the reference engine (a shallower search than the match, so it is quick to show).
    const d = Math.min(3, depthFor(this.level));
    const g = duel(seed % OPEN.length, seed % 2 === 0, d, learnedEval(this.w));
    const me = seed % 2 === 0 ? g.p.side : -g.p.side;
    const who = me === 1 ? 'Black (cyan)' : 'White (amber)';
    const frames: Frame[] = [{ ...ckFrame(g.p, `He is ${who}, against the depth-${d} reference engine.`), every: 0.35 }];
    for (let i = 0; i < 160; i++) {
      const before = Array.from(g.p.b);
      // A step is a slice of a search: step until the move is made (or the game ends).
      let r: number | null = null;
      for (const s0 = g.p.side; r == null && g.p.side === s0; ) r = g.step();
      if (r != null) {
        frames.push({ ...ckFrame(g.p, r === 1 ? 'He wins.' : r === 0 ? 'The reference engine wins.' : 'A draw.'), every: 0.35 });
        break;
      }
      const moved = before.map((x, k) => (x !== g.p.b[k] ? k : -1)).filter((k) => k >= 0 && g.p.b[k]);
      const marks: Record<number, string> = {};
      for (const k of moved) marks[k] = 'new';
      frames.push({ ...ckFrame(g.p, `${g.p.side === -me ? 'He' : 'Reference'} moved.`, marks), every: 0.35 });
    }
    return frames;
  }
  move(state: number[]) {
    const p = ckFrom(state);
    const moves = legalCk(p);
    if (resultCk(p, moves)) return -1;
    const m = bestMove(p, Math.min(6, depthFor(this.level) + 1), learnedEval(this.w), moves).move;
    return moves.indexOf(m);
  }
}

// ---- problems: forced wins in small endgames (exact) ----------------------------------------------------------------

/** Does the side to move force a win within `plies` (no moves left for the other side)? Exhaustive. */
function forced(p: Ck, plies: number, cap: { n: number }): boolean {
  if (--cap.n < 0) throw new Error('budget');
  const moves = legalCk(p);
  if (!moves.length) return false;
  if (plies <= 0) return false;
  for (const m of moves) {
    const u = make(p, m);
    const replies = legalCk(p);
    let win = !replies.length;
    if (!win && plies >= 3) {
      win = true;
      for (const r of replies) {
        const u2 = make(p, r);
        const ok = forced(p, plies - 2, cap);
        unmake(p, r, u2);
        if (!ok) {
          win = false;
          break;
        }
      }
    }
    unmake(p, m, u);
    if (win) return true;
  }
  return false;
}

export const winIn = (level: number) => [1, 1, 2, 2, 2, 3, 3, 3, 4, 4][lvl(level) - 1]!;

function generate(level: number, seed: number): Problem {
  const L = lvl(level);
  const N = winIn(L);
  const r = rng(seed * 92821 + L);
  for (;;) {
    const p: Ck = { b: new Int8Array(32), side: 1, quiet: 0 };
    const nb = 1 + Math.floor(r() * 3);
    const nw = 1 + Math.floor(r() * (N >= 3 ? 3 : 2));
    const put = (x: number) => {
      for (;;) {
        const i = Math.floor(r() * 32);
        if (p.b[i]) continue;
        // No man on its own crowning row.
        if (x === 1 && rowOf(i) === 7) continue;
        if (x === -1 && rowOf(i) === 0) continue;
        p.b[i] = x;
        return;
      }
    };
    for (let i = 0; i < nb; i++) put(r() < 0.5 ? 2 : 1);
    for (let i = 0; i < nw; i++) put(r() < 0.4 ? -2 : -1);
    const moves = legalCk(p);
    if (moves.length < 2 || !legalCk({ ...p, side: -1 }).length) continue;
    try {
      const cap = { n: 400_000 };
      // A win in exactly N of his moves, and only one first move that does it.
      if (N > 1 && forced(p, 2 * N - 3, cap)) continue;
      const winners = moves.filter((m) => {
        const q = copyCk(p);
        playCk(q, m);
        const rep = legalCk(q);
        if (!rep.length) return true;
        if (N === 1) return false;
        return rep.every((x) => {
          const q2 = copyCk(q);
          playCk(q2, x);
          return forced(q2, 2 * N - 3, cap);
        });
      });
      if (winners.length !== 1) continue;
      const m = winners[0]!;
      const text = `${ckText(p)}\nBlack to move and win in ${N} move${N > 1 ? 's' : ''} (White left with no pieces or no legal move), whatever White does. Give Black's first move, e.g. "9-14" or "9x18x27" for a capture.`;
      return { game: 'checkers', level: L, seed, text, data: { board: ckState(p), answer: moveText(m), path: m.path.map((s) => s + 1) } };
    } catch {
      continue;
    }
  }
}

function check(pr: Problem, answer: string): Verdict {
  const d = pr.data as { board: number[]; answer: string; path: number[] };
  const nums = (finalLine(answer).match(/\d+/g) ?? []).map(Number);
  const p = ckFrom(d.board);
  // The move named: its whole path, or just where it starts and ends (when that is unambiguous).
  const moves = legalCk(p).filter((m) => {
    const path = m.path.map((s) => s + 1);
    if (nums.length === path.length && nums.every((x, i) => x === path[i])) return true;
    return nums.length === 2 && nums[0] === path[0] && nums[1] === path[path.length - 1];
  });
  const ok = moves.length >= 1 && moves.every((m) => moveText(m) === d.answer) && nums.length >= 2;
  return { correct: ok, score: ok ? 1 : 0, why: ok ? 'The winning move.' : `The winning move is ${d.answer}.` };
}

/** Actions are indices into the list of legal moves; reward +1 / −1 to the mover at the end. */
class CkEnv implements Env {
  p = startCk();
  reset() {
    this.p = startCk();
  }
  actions() {
    return resultCk(this.p) ? [] : legalCk(this.p).map((_, i) => i);
  }
  step(a: number) {
    const moves = legalCk(this.p);
    const m = moves[a];
    if (!m || resultCk(this.p, moves)) return { reward: -1, done: true };
    playCk(this.p, m);
    const res = resultCk(this.p);
    return { reward: res && res !== 0.5 ? 1 : 0, done: !!res };
  }
  describe() {
    return `${ckText(this.p)}\nLegal moves: ${legalCk(this.p).map(moveText).join(', ')}.`;
  }
}

export const checkers: Game = {
  ...CHECKERS,
  env: () => new CkEnv(),
  generate,
  check,
  learner: (level, seed, saved) => new CkLearner(level, seed, saved),
};

/** For the tests: the first legal moves of the start position and a perft-style count of positions `depth` moves on. */
export function countCk(p0: Ck, depth: number): number {
  if (!depth) return 1;
  let n = 0;
  const p = copyCk(p0);
  for (const m of legalCk(p)) {
    const u = make(p, m);
    n += countCk(p, depth - 1);
    unmake(p, m, u);
  }
  return n;
}
export { NB };
