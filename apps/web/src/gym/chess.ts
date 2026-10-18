/**
 * CHESS. Ghosty's evaluator is learned: a value for each kind of piece on each square (piece-square
 * tables, 6 × 64 numbers, mirrored for Black; what a piece is worth is part of it), all starting at zero
 * and tuned Texel-style from the results of his own self-play games — after each game every position he
 * saw is nudged so that it predicts how that game ended. Self-play games that run long are scored by
 * material (pawn 1, knight and bishop 3, rook 5, queen 9; three points ahead wins), the usual way engine
 * testers cut long games short; that is the only chess knowledge he is given. He plays with an alpha-beta
 * search plus a capture search at the end (so he never stops in the middle of an exchange).
 *
 * Ground truth: a fixed ladder of Ghosty's own reference engines — the SAME search with a hand-written
 * evaluator (material and the well-known "simplified evaluation" piece-square tables) — NOT Stockfish,
 * which is not part of Ghosty (it is GPL and megabytes to download). Each level is one rung (RUNGS): he
 * searches 2 moves ahead; Levels 1–6 face the 1-move reference giving odds (it starts without its queen,
 * a rook, a knight, two pawns, one pawn, then nothing), Levels 7–10 the 2-move reference giving a rook,
 * a knight, two pawns, then one pawn. Mastery = his share of the points from fixed openings played both
 * ways. No rating is shown: only what the matches measured.
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
import { finalLine, type Env, type Frame, type Game, type Learner, lvl, mentions, type Problem, rng, savedFor, type Verdict } from './core';
import { Match, type MatchResult, record, share, type Stepper } from './match';
import { CHESS } from './meta';

export * from './chessboard';
export { setSlice } from './match';
import { sliceMs } from './match';

const MATE = 100_000;
const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

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

/** One search's node count and cap (each search has its own, so a paused match search and a quick reply never mix). */
interface Ctx {
  nodes: number;
  cap: number;
  /** The node count at the last pause (the capture search counts too, so pauses go by distance, not multiples). */
  paused: number;
}
let lastNodes = 0;

/** Captures (and promotions) only, until the position is quiet; the side to move may also stand pat. */
function quiesce(p: Pos, alpha: number, beta: number, ev: ChessEval, qd: number, c: Ctx): number {
  c.nodes++;
  const stand = ev(p);
  if (stand >= beta) return stand;
  if (stand > alpha) alpha = stand;
  if (qd > 8) return stand;
  for (const m of order(p, legal(p, true))) {
    make(p, m);
    const v = -quiesce(p, -beta, -alpha, ev, qd + 1, c);
    unmake(p);
    if (v >= beta) return v;
    if (v > alpha) alpha = v;
  }
  return alpha;
}

/** Alpha-beta; a generator that pauses about every 1,024 positions, so a long search can be run a slice at a time. */
function* ab(p: Pos, depth: number, alpha: number, beta: number, ev: ChessEval, ply: number, c: Ctx): Generator<void, number, void> {
  if (++c.nodes - c.paused >= 1024) {
    c.paused = c.nodes;
    yield;
  }
  if (ply && (p.half >= 100 || repeats(p) >= 1)) return 0;
  if (depth <= 0) {
    if (!inCheck(p)) return quiesce(p, alpha, beta, ev, 0, c);
    depth = 1; // never stop while in check
  }
  const moves = legal(p);
  if (!moves.length) return inCheck(p) ? -MATE + ply : 0;
  if (c.nodes > c.cap) return ev(p);
  let best = -Infinity;
  for (const m of order(p, moves)) {
    make(p, m);
    const v = -(yield* ab(p, depth - 1, -beta, -alpha, ev, ply + 1, c));
    unmake(p);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

/** The best move at `depth` (then the capture search) with evaluator `ev`, as a search that can be paused. */
export function* searchGen(p0: Pos, depth: number, ev: ChessEval, moves = legal(p0), cap = 2_000_000): Generator<void, { move: number; value: number }, void> {
  const p = copyPos(p0);
  p.hist = p0.hist.slice();
  const c: Ctx = { nodes: 0, cap, paused: 0 };
  let best = moves[0]!;
  let alpha = -Infinity;
  for (const m of order(p, moves)) {
    make(p, m);
    const v = -(yield* ab(p, depth - 1, -Infinity, -alpha, ev, 1, c));
    unmake(p);
    if (v > alpha) (alpha = v), (best = m);
  }
  lastNodes = c.nodes;
  return { move: best, value: alpha };
}
/** …run to the end at once (the first of equals in move order). */
export function bestMove(p0: Pos, depth: number, ev: ChessEval, moves = legal(p0), cap = 2_000_000): { move: number; value: number } {
  const it = searchGen(p0, depth, ev, moves, cap);
  for (;;) {
    const r = it.next();
    if (r.done) return r.value;
  }
}
export const nodeCount = () => lastNodes;


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
/**
 * A rung of the ladder: how far he searches, the reference engine he plays (its depth, how often it plays a
 * random move instead), and the odds it gives him — pieces it starts without (q queen, r rook, n knight, p
 * a pawn each). Odds are the old way to set strength levels apart: each rung up gives less.
 */
export interface Rung {
  me: number;
  ref: number;
  rand: number;
  odds: string;
}
export const RUNGS: Rung[] = [
  { me: 2, ref: 1, rand: 0, odds: 'q' },
  { me: 2, ref: 1, rand: 0, odds: 'r' },
  { me: 2, ref: 1, rand: 0, odds: 'n' },
  { me: 2, ref: 1, rand: 0, odds: 'pp' },
  { me: 2, ref: 1, rand: 0, odds: 'p' },
  { me: 2, ref: 1, rand: 0, odds: '' },
  { me: 2, ref: 2, rand: 0, odds: 'r' },
  { me: 2, ref: 2, rand: 0, odds: 'n' },
  { me: 2, ref: 2, rand: 0, odds: 'pp' },
  { me: 2, ref: 2, rand: 0, odds: 'p' },
];
export const rungFor = (level: number) => RUNGS[lvl(level) - 1]!;
export const gamesFor = (_level: number) => 16;
const ODDS: Record<string, string> = { q: 'queen', r: 'rook', n: 'knight', p: 'pawn' };
const oddsWords = (o: string) => {
  if (!o) return '';
  const pawns = [...o].filter((c) => c === 'p').length;
  const rest = [...o].filter((c) => c !== 'p').map((c) => `a ${ODDS[c]}`);
  if (pawns) rest.push(pawns === 1 ? 'a pawn' : `${pawns} pawns`);
  return `, giving him ${rest.join(' and ')}`;
};
const rungWords = (r: Rung) => `Ghosty's own reference engine (not Stockfish) searching ${r.ref} move${r.ref > 1 ? 's' : ''} ahead${oddsWords(r.odds)}${r.rand ? `, ${Math.round(r.rand * 100)}% of its moves random` : ''}; he searches ${r.me} ahead`;
const MAX_PLIES = 160;

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

/** The start position with pieces taken off one side (`white`): the queen, the queenside rook (and castling that way), the queenside knight, and pawns from the f- and h-files. */
export function oddsFen(white: boolean, odds: string): string {
  const back = 'rnbqkbnr'.split('');
  const pawns = 'pppppppp'.split('');
  let castle = 'KQ';
  const pawnFiles = [5, 7, 6, 0];
  for (const o of odds) {
    if (o === 'q') back[3] = '';
    else if (o === 'r') (back[0] = ''), (castle = 'K');
    else if (o === 'n') back[1] = '';
    else if (o === 'p') pawns[pawnFiles.shift()!] = '';
  }
  const row = (cells: string[], up: boolean) => {
    let s = '';
    let gap = 0;
    for (const c of cells) {
      if (!c) {
        gap++;
        continue;
      }
      if (gap) (s += gap), (gap = 0);
      s += up ? c.toUpperCase() : c;
    }
    return gap ? s + gap : s;
  };
  const full = (cells: string[], up: boolean) => row(cells.map((c) => c), up);
  const wb = white ? full(back, true) : 'RNBQKBNR';
  const wp = white ? full(pawns, true) : 'PPPPPPPP';
  const bb = white ? 'rnbqkbnr' : full(back, false);
  const bp = white ? 'pppppppp' : full(pawns, false);
  const rights = (white ? castle : 'KQ') + (white ? 'kq' : castle.toLowerCase());
  return `${bb}/${bp}/8/8/8/8/${wp}/${wb} w ${rights} - 0 1`;
}

/** One match game: him (evaluator `mine`) against the reference engine of a rung. */
export function duel(opening: number, first: boolean, rung: Rung, mine: ChessEval, seed = opening): Stepper & { p: Pos; me: number } {
  // He plays White when he moves "first"; the reference starts without its odds.
  const p = fromFen(rung.odds ? oddsFen(!first, rung.odds) : START);
  applyUci(p, OPENINGS[opening % OPENINGS.length]!);
  const me = first ? 1 : -1;
  const rr = rng(104729 * (seed + 1) + (first ? 1 : 2));
  let plies = 4;
  let cur: Generator<void, { move: number; value: number }, void> | null = null;
  return {
    p,
    me,
    // One step = a slice of one move's search (about a thousand positions), so the worker is never held up for long.
    step() {
      if (!cur) {
        const moves = legal(p);
        const r = resultFor(p, plies, moves);
        if (r != null) return me > 0 ? r : 1 - r;
        if (p.side !== me && rung.rand && rr() < rung.rand) {
          make(p, moves[Math.floor(rr() * moves.length)]!);
          plies++;
          return null;
        }
        cur = p.side === me ? searchGen(p, rung.me, mine, moves) : searchGen(p, rung.ref, referenceEval, moves);
      }
      const x = cur.next();
      if (x.done) {
        make(p, x.value.move);
        plies++;
        cur = null;
      }
      return null;
    },
  };
}

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
  /** The tactics test after each match, also run a slice at a time; and the last finished one. */
  tacting: { i: number; found: number; by: number[]; w: Float32Array } | null = null;
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
  /** The self-play game under way (a few moves per call, so the worker is never held up). */
  private cur: { p: Pos; seen: Int8Array[]; plies: number; opening: number } | null = null;
  /** Play up to `k` moves of the current self-play game (a quick search with his evaluator, now and then a random move); when it ends, tune on it. True when a game finished. */
  private play(k: number): boolean {
    this.cur ??= { p: fromFen(START), seen: [], plies: 0, opening: 2 + Math.floor(this.r() * 6) };
    const c = this.cur;
    const ev = learnedEval(this.w);
    let result: number | null = null;
    const t0 = clock();
    for (let i = 0; i < k && (i === 0 || clock() - t0 < 30); i++) {
      const moves = legal(c.p);
      result = resultFor(c.p, c.plies, moves);
      if (result != null) break;
      let m: number;
      if (c.opening-- > 0 || this.r() < 0.06) m = moves[Math.floor(this.r() * moves.length)]!;
      else m = bestMove(c.p, 1, ev, moves, 4000).move;
      make(c.p, m);
      c.plies++;
      if (c.plies > 6 && !inCheck(c.p)) c.seen.push(c.p.b.slice());
    }
    if (result == null) return false;
    this.cur = null;
    this.tune(c.p, c.seen, result);
    return true;
  }
  /** Texel-style tuning on one finished game. */
  private tune(p: Pos, seen: Int8Array[], result: number) {
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
    // Big steps at first, smaller as he settles (otherwise the last few games' luck swings his values about).
    const rate = RATE * Math.max(0.25, 1 / Math.sqrt(1 + this.games / 2000));
    let G = z;
    for (let k = seen.length - 1; k >= 0; k--) {
      const b = seen[k]!;
      const g = rate * (G - probs[k]!);
      for (let i = 0; i < 64; i++) {
        const x = b[((i >> 3) << 4) | (i & 7)]!;
        if (x > 0) (this.w[x - 1]! += g), (this.w[sqIndex(x, i)]! += g * PST_RATE);
        else if (x < 0) (this.w[-x - 1]! -= g), (this.w[sqIndex(-x, i ^ 56)]! -= g * PST_RATE);
      }
      G = LAMBDA * G + (1 - LAMBDA) * probs[k]!;
    }
  }
  /** A unit is a whole self-play game; one call plays a slice of it (0 until a game is finished). */
  train(_n: number) {
    if (!this.play(24)) return 0;
    this.games++;
    this.rand = (this.rand + 2654435761) >>> 0;
    return 1;
  }
  /** Tactics, a slice at a time: how many forced mates his search finds (his move is one that keeps a forced mate). */
  private tacticsSlice(t0: number): boolean {
    const set = tactics();
    const c = (this.tacting ??= { i: 0, found: 0, by: [0, 0, 0], w: this.w.slice() });
    while (c.i < set.length) {
      const t = set[c.i++]!;
      const p = fromFen(t.fen);
      const m = bestMove(p, rungFor(this.level).me, learnedEval(c.w), legal(p), 20_000).move;
      if (t.best.includes(uci(m))) (c.found++, c.by[t.n - 1]!++);
      if (clock() - t0 > sliceMs()) break;
    }
    if (c.i < set.length) return false;
    this.tact = { found: c.found, of: set.length, by: c.by };
    this.tacting = null;
    return true;
  }
  /** The whole tactics test at once (tests). */
  tactics() {
    this.tacting = null;
    while (!this.tacticsSlice(-Infinity));
    return this.tact!;
  }
  measure() {
    const t0 = clock();
    const rung = rungFor(this.level);
    const n = gamesFor(this.level);
    // A match against the reference (in slices), then the tactics test (in slices).
    if (!this.match && !this.tacting) {
      const frozen = this.w.slice();
      this.match = new Match(n, (o, first) => duel(o, first, rung, learnedEval(frozen)));
    }
    if (this.match && this.match.run()) {
      this.last = this.match.res;
      this.match = null;
      this.tacting = { i: 0, found: 0, by: [0, 0, 0], w: this.w.slice() };
    }
    if (!this.match && this.tacting) this.tacticsSlice(t0);
    const pending = !!this.match || !!this.tacting;
    if (!this.last) {
      const played = this.match?.res.games ?? n;
      return { mastery: 0, pending, detail: `His first match against ${rungWords(rung)} is under way (${played} of ${n} games played).` };
    }
    const s = share(this.last);
    const t = this.tact;
    return {
      mastery: s,
      pending,
      detail: `Against ${rungWords(rung)} (hand-written evaluator; games still going after 80 moves are scored by material): ${record(this.last)} — ${Math.round(s * 100)}% of the points.${t ? ` Tactics: he finds ${t.found} of ${t.of} forced mates (in 1: ${t.by[0]}, in 2: ${t.by[1]}, in 3: ${t.by[2]}; each proved by exhaustive search).` : ''}`,
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
    // (Both search one move ahead here, so the game is quick to show.)
    const rung = { ...rungFor(this.level), me: 1, ref: 1 };
    const g = duel(seed % OPENINGS.length, seed % 2 === 0, rung, learnedEval(this.w), seed);
    const who = g.me > 0 ? 'White' : 'Black';
    const frames: Frame[] = [{ ...chessFrame(g.p, `He is ${who}, against ${rungWords(rung)}.`), every: 0.6 }];
    for (let i = 0; i < 120; i++) {
      const moving = g.p.side;
      const before = copyPos(g.p);
      // A step is a slice of a search: step until the move is made (or the game ends).
      let r: number | null = null;
      for (const n0 = g.p.undo.length; r == null && g.p.undo.length === n0; ) r = g.step();
      if (r != null) {
        const st = status(g.p);
        frames.push({ ...chessFrame(g.p, `${r === 1 ? 'He wins' : r === 0 ? 'The reference engine wins' : 'A draw'}${st ? ` (${STATUS_WORDS[st]})` : ' (on material after 80 moves)'}.`), every: 0.6 });
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
    return pageMove(bestMove(p, rungFor(this.level).me, learnedEval(this.w), moves, 60_000).move);
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
  const sans = moves.map((m) => san(p, m).replace(/[+#]/g, ''));
  const named = new Set<number>();
  const re = /O-O-O|O-O|[a-h][1-8][-x]?[a-h][1-8](?:=?[qrbnQRBN])?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=?[QRBN])?/g;
  for (const { m, negated } of mentions(line, re)) {
    if (negated) continue;
    const tok = m[0];
    // A bare square after "on", "at", "to"… is a place, not a move ("mate on h7").
    if (/^[a-h][1-8]$/.test(tok) && /\b(on|at|to|towards|from|square|of)\s*$/i.test(line.slice(0, m.index))) continue;
    const plain = tok.replace(/[-x=+#]/g, '').toLowerCase();
    const k = moves.findIndex((x, i) => uci(x) === plain || sans[i] === tok.replace(/[+#]/g, ''));
    if (k >= 0) named.add(moves[k]!);
  }
  // Two different moves named is not an answer.
  return named.size === 1 ? [...named][0]! : -1;
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

