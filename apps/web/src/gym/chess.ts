/**
 * CHESS. Ghosty's evaluator is learned: a value for each kind of piece on each square (piece-square
 * tables, 6 × 64 numbers, mirrored for Black; what a piece is worth is part of it), all starting at zero
 * and tuned Texel-style from the results of his own self-play games — after each game every position he
 * saw is nudged so that it predicts how that game ended. Self-play games that run long are scored by
 * material (pawn 1, knight and bishop 3, rook 5, queen 9; three points ahead wins), the usual way engine
 * testers cut long games short; that is the only chess knowledge he is given. He plays with an alpha-beta
 * search plus a capture search at the end (so he never stops in the middle of an exchange).
 *
 * Ground truth: a fixed ladder of reference engines — the SAME search at depths 1–4 with a hand-written
 * evaluator (material and the well-known "simplified evaluation" piece-square tables). At each level he
 * plays a match against the reference at the same depth, from fixed openings played both ways; mastery
 * = his share of the points. He is rated on Ghosty's own scale for this ladder (the depth-1 engine =
 * 1000) — NOT against Stockfish, which is not part of Ghosty (it is GPL and megabytes to download).
 * A second measure: a set of positions with a forced mate in 1, 2 or 3 (each checked by exhaustive
 * search), and how many he finds with his search.
 */
import {
  B,
  chessFrame,
  copyPos,
  fromFen,
  inCheck,
  K,
  legal,
  make,
  mFlags,
  mFrom,
  mPromo,
  mTo,
  N,
  P,
  pageMove,
  type Pos,
  posFrom,
  posState,
  posText,
  Q,
  R,
  repeats,
  san,
  sq64,
  sqName,
  START,
  status,
  STATUS_WORDS,
  toFen,
  uci,
  unmake,
  cellOf,
} from './chessboard';
import { CHESS_TACTICS } from './chesssets';
import { finalLine, type Env, type Frame, type Game, type Learner, lvl, type Problem, rng, savedFor, type Verdict } from './core';
import { Match, type MatchResult, perfRating, record, share, type Stepper } from './match';
import { CHESS } from './meta';

export * from './chessboard';
export { setSlice } from './match';

const MATE = 100_000;
export const depthFor = (level: number) => [1, 1, 2, 2, 3, 3, 4, 4, 4, 4][lvl(level) - 1]!;

// ---- evaluators -------------------------------------------------------------------------------------------------

/** An evaluator: centipawns for the side to move. */
export type ChessEval = (p: Pos) => number;

// The "simplified evaluation function" tables (Tomasz Michniewski), rank 8 first, from White's side.
// prettier-ignore
const PST: number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
];
const VALUE = [0, 100, 320, 330, 500, 900, 0];
/** Reference table: [piece 1–6][square 0–63, a1 = 0] for White. */
const REF = Array.from({ length: 7 }, (_, t) => Array.from({ length: 64 }, (_, i) => (t ? VALUE[t]! + PST[t - 1]![(7 - (i >> 3)) * 8 + (i & 7)]! : 0)));

export const referenceEval: ChessEval = (p) => {
  let s = 0;
  for (let i = 0; i < 64; i++) {
    const x = p.b[((i >> 3) << 4) | (i & 7)]!;
    if (x > 0) s += REF[x]![i]!;
    else if (x < 0) s -= REF[-x]![i ^ 56]!;
  }
  return s * p.side;
};

/**
 * 390 learned numbers: what each kind of piece is worth (6), then a bonus for each kind on each square
 * (6 × 64, a1 = 0, from the owner's side: Black's squares mirrored). Index of a piece's two numbers:
 */
export const NW = 6 + 6 * 64;
const sqIndex = (t: number, i: number) => 6 + (t - 1) * 64 + i;
export function learnedWhite(w: Float32Array, p: Pos): number {
  let s = 0;
  for (let i = 0; i < 64; i++) {
    const x = p.b[((i >> 3) << 4) | (i & 7)]!;
    if (x > 0) s += w[x - 1]! + w[sqIndex(x, i)]!;
    else if (x < 0) s -= w[-x - 1]! + w[sqIndex(-x, i ^ 56)]!;
  }
  return s;
}
export const learnedEval = (w: Float32Array): ChessEval => (p) => learnedWhite(w, p) * p.side;

/** Material for the 200-move cut-off (and self-play): pawn 1, knight/bishop 3, rook 5, queen 9; White minus Black. */
export function material(p: Pos): number {
  let s = 0;
  for (let i = 0; i < 128; i++) {
    if (i & 0x88) continue;
    const x = p.b[i]!;
    if (x) s += (x > 0 ? 1 : -1) * [0, 1, 3, 3, 5, 9, 0][Math.abs(x)]!;
  }
  return s;
}

// ---- the search -------------------------------------------------------------------------------------------------

const MVV = [0, 1, 3, 3, 5, 9, 20];
function order(p: Pos, moves: number[]): number[] {
  const score = (m: number) => {
    let s = 0;
    if (mFlags(m) & 1) s += 100 * MVV[Math.abs(p.b[mTo(m)]!) || 1]! - MVV[Math.abs(p.b[mFrom(m)]!)]!;
    if (mPromo(m)) s += 50 * mPromo(m);
    return s;
  };
  return moves.map((m) => [score(m), m] as const).sort((a, b) => b[0] - a[0]).map((x) => x[1]);
}

let nodes = 0;
let nodeCap = Infinity;
/** Captures (and promotions) only, until the position is quiet; the side to move may also stand pat. */
function quiesce(p: Pos, alpha: number, beta: number, ev: ChessEval, qd: number): number {
  nodes++;
  const stand = ev(p);
  if (stand >= beta) return stand;
  if (stand > alpha) alpha = stand;
  if (qd > 8) return stand;
  for (const m of order(p, legal(p, true))) {
    make(p, m);
    const v = -quiesce(p, -beta, -alpha, ev, qd + 1);
    unmake(p);
    if (v >= beta) return v;
    if (v > alpha) alpha = v;
  }
  return alpha;
}

function ab(p: Pos, depth: number, alpha: number, beta: number, ev: ChessEval, ply: number): number {
  nodes++;
  if (ply && (p.half >= 100 || repeats(p) >= 1)) return 0;
  if (depth <= 0) {
    if (!inCheck(p)) return quiesce(p, alpha, beta, ev, 0);
    depth = 1; // never stop while in check
  }
  const moves = legal(p);
  if (!moves.length) return inCheck(p) ? -MATE + ply : 0;
  if (nodes > nodeCap) return ev(p);
  let best = -Infinity;
  for (const m of order(p, moves)) {
    make(p, m);
    const v = -ab(p, depth - 1, -beta, -alpha, ev, ply + 1);
    unmake(p);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

/** The best move at `depth` (then the capture search) with evaluator `ev`; the first of equals in move order. */
export function bestMove(p0: Pos, depth: number, ev: ChessEval, moves = legal(p0), cap = 2_000_000): { move: number; value: number } {
  const p = copyPos(p0);
  p.hist = p0.hist.slice();
  nodes = 0;
  nodeCap = cap;
  let best = moves[0]!;
  let alpha = -Infinity;
  for (const m of order(p, moves)) {
    make(p, m);
    const v = -ab(p, depth - 1, -Infinity, -alpha, ev, 1);
    unmake(p);
    if (v > alpha) (alpha = v), (best = m);
  }
  nodeCap = Infinity;
  return { move: best, value: alpha };
}
export const nodeCount = () => nodes;

// ---- games and matches ----------------------------------------------------------------------------------------------

/** Fixed openings (two moves each way, well-known lines), each played both ways in a match. */
export const OPENINGS = ['e2e4 e7e5', 'd2d4 d7d5', 'e2e4 c7c5', 'd2d4 g8f6', 'c2c4 e7e5', 'g1f3 d7d5', 'e2e4 e7e6', 'e2e4 c7c6'];
export function applyUci(p: Pos, line: string): void {
  for (const u of line.split(' ').filter(Boolean)) {
    const m = legal(p).find((x) => uci(x) === u);
    if (m == null) throw new Error(`bad move ${u}`);
    make(p, m);
  }
}
export const gamesFor = (level: number) => (depthFor(level) <= 2 ? 16 : 12);
const MAX_PLIES = 200;

/** A finished game's result for White: 1, 0.5, 0 — or null while it goes on (after `plies`, scored by material: 3 points ahead wins). */
export function resultFor(p: Pos, plies: number, moves = legal(p)): number | null {
  const st = status(p, moves);
  if (st === 'mate') return p.side > 0 ? 0 : 1;
  if (st) return 0.5;
  if (plies >= MAX_PLIES) {
    const m = material(p);
    return m >= 3 ? 1 : m <= -3 ? 0 : 0.5;
  }
  return null;
}

/** One match game: him against the reference engine, both at `depth`. */
export function duel(opening: number, first: boolean, depth: number, mine: ChessEval): Stepper & { p: Pos; me: number } {
  const p = fromFen(START);
  applyUci(p, OPENINGS[opening % OPENINGS.length]!);
  // He plays White when he moves "first" (the openings hand the move back to White).
  const me = first ? 1 : -1;
  let plies = 4;
  return {
    p,
    me,
    step() {
      const moves = legal(p);
      const r = resultFor(p, plies, moves);
      if (r != null) return me > 0 ? r : 1 - r;
      make(p, bestMove(p, depth, p.side === me ? mine : referenceEval, moves).move);
      plies++;
      return null;
    },
  };
}

/** Ratings of the reference engines on Ghosty's own scale (depth 1 = 1000; each next depth by a match between neighbours). */
export const LADDER = [1000, 1330, 1590, 1800];
export const ladderRating = (depth: number) => LADDER[Math.max(1, Math.min(4, depth)) - 1]!;

// ---- tactics: forced mates (exact) ------------------------------------------------------------------------------------

/** Does the side to move force mate within n moves? Every move and every reply is tried. */
export function matesIn(p: Pos, n: number): boolean {
  for (const m of legal(p)) {
    make(p, m);
    const replies = legal(p);
    let ok: boolean;
    if (!replies.length) ok = inCheck(p);
    else if (n <= 1) ok = false;
    else {
      ok = true;
      for (const r of replies) {
        make(p, r);
        const w = matesIn(p, n - 1);
        unmake(p);
        if (!w) {
          ok = false;
          break;
        }
      }
    }
    unmake(p);
    if (ok) return true;
  }
  return false;
}
/** Every first move that forces mate within n. */
export function matingMoves(p: Pos, n: number): number[] {
  return legal(p).filter((m) => {
    make(p, m);
    const replies = legal(p);
    let ok = !replies.length && inCheck(p);
    if (!ok && replies.length && n > 1) {
      ok = true;
      for (const r of replies) {
        make(p, r);
        const w = matesIn(p, n - 1);
        unmake(p);
        if (!w) {
          ok = false;
          break;
        }
      }
    }
    unmake(p);
    return ok;
  });
}

export interface Tactic {
  fen: string;
  n: number;
  /** The first moves (UCI) that force mate in n. */
  best: string[];
}
export const tactics = (): Tactic[] =>
  CHESS_TACTICS.map((line) => {
    const [fen, n, best] = line.split('|') as [string, string, string];
    return { fen, n: Number(n), best: best.split(',') };
  });

// ---- the learner ------------------------------------------------------------------------------------------------------

/** Step size (centipawns per unit of error) and how far back the result reaches (TD(λ)). */
const RATE = 1;
const LAMBDA = 0.85;
const PST_RATE = 0.2;

interface ChessSave {
  game: 'chess';
  w: Float32Array;
  games: number;
  rand: number;
}

class ChessLearner implements Learner {
  w: Float32Array;
  games: number;
  rand: number;
  r: () => number;
  match: Match | null = null;
  last: MatchResult | null = null;
  tact: { found: number; of: number; by: number[] } | null = null;
  constructor(
    private level: number,
    seed: number,
    saved?: unknown,
  ) {
    // The evaluator carries over between levels.
    const s = savedFor<ChessSave>(saved, 'chess');
    this.w = s?.w?.length === NW ? s.w : new Float32Array(NW);
    this.games = s?.games ?? 0;
    this.rand = s?.rand ?? seed;
    this.r = rng(this.rand);
  }
  /** One self-play game (a quick search with his evaluator, now and then a random move), then Texel-style tuning on its positions. */
  private game() {
    const p = fromFen(START);
    const seen: Int8Array[] = [];
    const ev = learnedEval(this.w);
    let plies = 0;
    let result: number | null = null;
    let opening = 2 + Math.floor(this.r() * 6);
    for (;;) {
      const moves = legal(p);
      result = resultFor(p, plies, moves);
      if (result != null) break;
      let m: number;
      if (opening-- > 0 || this.r() < 0.06) m = moves[Math.floor(this.r() * moves.length)]!;
      else m = bestMove(p, 1, ev, moves, 4000).move;
      make(p, m);
      plies++;
      if (plies > 6 && !inCheck(p)) seen.push(p.b.slice());
    }
    // Every position he saw learns how the game ended (White's view), TD(λ)-style: its target is a blend of
    // what he thought of the positions after it and, more and more towards the end, the result itself —
    // 1 / 0 for a mate, otherwise how far ahead on material each side finished, as a share (4 points up is
    // nearly a sure win, even is ½). Logistic regression on the evaluation.
    const fin = material(p);
    const z = status(p) === 'mate' ? result : 1 / (1 + Math.exp(-fin / 1.5));
    const prob = (b: Int8Array) => {
      let v = 0;
      for (let i = 0; i < 64; i++) {
        const x = b[((i >> 3) << 4) | (i & 7)]!;
        if (x > 0) v += this.w[x - 1]! + this.w[sqIndex(x, i)]!;
        else if (x < 0) v -= this.w[-x - 1]! + this.w[sqIndex(-x, i ^ 56)]!;
      }
      return 1 / (1 + Math.pow(10, -v / 400));
    };
    const probs = seen.map(prob);
    let G = z;
    for (let k = seen.length - 1; k >= 0; k--) {
      const b = seen[k]!;
      const g = RATE * (G - probs[k]!);
      for (let i = 0; i < 64; i++) {
        const x = b[((i >> 3) << 4) | (i & 7)]!;
        if (x > 0) (this.w[x - 1]! += g), (this.w[sqIndex(x, i)]! += g * PST_RATE);
        else if (x < 0) (this.w[-x - 1]! -= g), (this.w[sqIndex(-x, i ^ 56)]! -= g * PST_RATE);
      }
      G = LAMBDA * G + (1 - LAMBDA) * probs[k]!;
    }
  }
  train(n: number) {
    const k = Math.max(1, Math.min(n, 2));
    for (let i = 0; i < k; i++) this.game();
    this.games += k;
    this.rand = (this.rand + k * 2654435761) >>> 0;
    return k;
  }
  /** Tactics: how many forced mates his search finds (his move is one that keeps a forced mate). */
  tactics(w = this.w) {
    const set = tactics();
    const by = [0, 0, 0];
    let found = 0;
    const d = depthFor(this.level);
    for (const t of set) {
      const p = fromFen(t.fen);
      const m = bestMove(p, d, learnedEval(w), legal(p), 20_000).move;
      if (t.best.includes(uci(m))) (found++, by[t.n - 1]!++);
    }
    return { found, of: set.length, by };
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
      this.tact = this.tactics();
    }
    if (!this.last) {
      const played = this.match?.res.games ?? 0;
      return { mastery: 0, detail: `His first match against the depth-${d} reference engine is under way (${played} of ${n} games played).` };
    }
    const s = share(this.last);
    const t = this.tact!;
    return {
      mastery: s,
      detail: `Against Ghosty's fixed reference engine that also searches ${d} move${d > 1 ? 's' : ''} ahead (hand-written evaluator; not Stockfish): ${record(this.last)} — ${Math.round(s * 100)}% of the points; estimated rating ${perfRating(s, ladderRating(d))} on Ghosty's own scale (depth-1 engine = 1000, depth-${d} = ${ladderRating(d)}). Tactics: he finds ${t.found} of ${t.of} forced mates (in 1: ${t.by[0]}, in 2: ${t.by[1]}, in 3: ${t.by[2]}; each proved by exhaustive search).`,
    };
  }
  save(): ChessSave {
    return { game: 'chess', w: this.w, games: this.games, rand: this.rand };
  }
  view(): Frame {
    // What each kind of piece is worth to him on average (in pawns), and where he likes his knights.
    const avg = (t: number) => this.w[t - 1]! + this.w.slice(sqIndex(t, 0), sqIndex(t, 64)).reduce((a, b) => a + b, 0) / 64;
    const pawn = Math.max(1e-6, avg(P));
    const bars: [string, number, string][] = [
      ['knight', 0, ''],
      ['bishop', 0, ''],
      ['rook', 0, ''],
      ['queen', 0, ''],
    ].map(([nm], k) => {
      const v = avg(k + 2) / pawn;
      return [`${nm} (in pawns)`, Math.max(0, Math.min(1, v / 10)), avg(P) > 0 ? v.toFixed(1) : '—'] as [string, number, string];
    });
    return { bars, caption: `What each piece is worth to him, learned from ${this.games.toLocaleString('en-GB')} games against himself (the textbook values are about 3, 3, 5 and 9 pawns).` };
  }
  watch(seed: number): Frame[] {
    const d = Math.min(2, depthFor(this.level));
    const g = duel(seed % OPENINGS.length, seed % 2 === 0, d, learnedEval(this.w));
    const who = g.me > 0 ? 'White' : 'Black';
    const frames: Frame[] = [{ ...chessFrame(g.p, `He is ${who}, against the depth-${d} reference engine.`), every: 0.6 }];
    for (let i = 0; i < 160; i++) {
      const moving = g.p.side;
      const before = copyPos(g.p);
      const r = g.step();
      if (r != null) {
        const st = status(g.p);
        frames.push({ ...chessFrame(g.p, `${r === 1 ? 'He wins' : r === 0 ? 'The reference engine wins' : 'A draw'}${st ? ` (${STATUS_WORDS[st]})` : ' (on material after 100 moves)'}.`), every: 0.6 });
        break;
      }
      const u = g.p.undo[g.p.undo.length - 1]!;
      const m = u[0]!;
      frames.push({ ...chessFrame(g.p, `${moving === g.me ? 'He' : 'Reference'}: ${san(before, m)}`, { [cellOf(sq64(mFrom(m)))]: 'new', [cellOf(sq64(mTo(m)))]: 'new' }), every: 0.6 });
    }
    return frames;
  }
  move(state: number[]) {
    const p = posFrom(state);
    const moves = legal(p);
    if (status(p, moves)) return -1;
    return pageMove(bestMove(p, Math.min(3, depthFor(this.level) + 1), learnedEval(this.w), moves, 150_000).move);
  }
}

// ---- problems: mate in N (exact) ------------------------------------------------------------------------------------

export const mateFor = (level: number) => (lvl(level) <= 3 ? 1 : lvl(level) <= 7 ? 2 : 3);

function generate(level: number, seed: number): Problem {
  const L = lvl(level);
  const n = mateFor(L);
  const pool = tactics().filter((t) => t.n === n);
  const t = pool[Math.floor(rng(seed * 15485863 + L)() * pool.length)]!;
  const p = fromFen(t.fen);
  const text = `${posText(p)}\n${p.side > 0 ? 'White' : 'Black'} to move and mate in ${n}, whatever the defence. Give the first move (e.g. "Qh5" or "e2e4").`;
  return { game: 'chess', level: L, seed, text, data: { fen: t.fen, n, best: t.best, san: t.best.map((u) => san(p, legal(p).find((m) => uci(m) === u)!)) } };
}

/** Read a move from an answer: standard notation (Qxf7#, Nf3, O-O), or from-to squares (e2e4, e2-e4, e7e8=Q). */
export function readMove(p: Pos, answer: string): number {
  const line = finalLine(answer).replace(/0-0-0/g, 'O-O-O').replace(/0-0/g, 'O-O');
  const moves = legal(p);
  const tokens = line.match(/O-O-O|O-O|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](=?[QRBNqrbn])?|[a-h][1-8][-x]?[a-h][1-8]=?[qrbnQRBN]?/g) ?? [];
  for (let i = tokens.length - 1; i >= 0; i--) {
    const tok = tokens[i]!;
    const plain = tok.replace(/[-x=+#]/g, '').toLowerCase();
    for (const m of moves) {
      if (uci(m) === plain) return m;
      if (san(p, m).replace(/[+#]/g, '') === tok.replace(/[+#]/g, '')) return m;
    }
  }
  return -1;
}

function check(pr: Problem, answer: string): Verdict {
  const d = pr.data as { fen: string; best: string[]; san: string[] };
  const p = fromFen(d.fen);
  const m = readMove(p, answer);
  const ok = m >= 0 && d.best.includes(uci(m));
  return { correct: ok, score: ok ? 1 : 0, why: ok ? 'It mates by force.' : `A move that forces mate: ${d.san.join(' or ')}.` };
}

/** Actions are indices into the legal moves (in generation order); reward +1 to the side that mates. */
class ChessEnv implements Env {
  p = fromFen(START);
  plies = 0;
  reset() {
    this.p = fromFen(START);
    this.plies = 0;
  }
  actions() {
    const ms = legal(this.p);
    return resultFor(this.p, this.plies, ms) != null ? [] : ms.map((_, i) => i);
  }
  step(a: number) {
    const ms = legal(this.p);
    const m = ms[a];
    if (m == null) return { reward: -1, done: true };
    make(this.p, m);
    this.plies++;
    const r = resultFor(this.p, this.plies);
    return { reward: r === 1 || r === 0 ? 1 : 0, done: r != null };
  }
  describe() {
    return `${posText(this.p)}\nLegal moves: ${legal(this.p).map((m) => san(this.p, m)).join(' ')}.`;
  }
}

export const chess: Game = {
  ...CHESS,
  env: () => new ChessEnv(),
  generate,
  check,
  learner: (level, seed, saved) => new ChessLearner(level, seed, saved),
};

