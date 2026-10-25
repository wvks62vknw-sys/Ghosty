/**
 * CONNECT 4 at full strength, for PLAY HIM and for studying the owner's games: an exact solver on bitboards
 * (negamax with alpha–beta, a transposition table, columns centre-out and by the threats they make, the
 * score narrowed by null windows) and, for what it cannot settle in time, a search a fixed number of moves
 * ahead whose leaves are judged by threat parity (who the end of the game favours) and the learned network.
 *
 * The board is two 32-bit words per bitboard (JavaScript's bit operations are 32-bit): columns 0–3 in `lo`
 * (7 bits a column: six squares and a spare bit on top), columns 4–6 in `hi`. A position is the stones of the
 * side to move (`p`) and every stone (`m`). Scores are the solver's (Pascal Pons's convention): 0 a draw,
 * positive a win for the side to move — the sooner, the larger: (43 − stones when the winning stone lands) / 2.
 *
 * Worker only (the page never imports this file). The table is ~21 MB, made once and kept between moves and
 * between positions (what it holds stays true), so idle solving in slices builds on itself.
 */
import { COLS, ROWS } from './c4board';

const M28 = 0x0fffffff;
const M21 = 0x1fffff;
/** The playable squares (not the spare bit on top of each column). */
const BOARD_LO = 0x3f | (0x3f << 7) | (0x3f << 14) | (0x3f << 21);
const BOARD_HI = 0x3f | (0x3f << 7) | (0x3f << 14);
const BOTTOM_LO = 1 | (1 << 7) | (1 << 14) | (1 << 21);
const BOTTOM_HI = 1 | (1 << 7) | (1 << 14);
const N = COLS * ROWS;
export const ORDER = [3, 2, 4, 1, 5, 0, 6];
/** One column's squares in its word. */
const colMask = (c: number) => (0x3f << ((c < 4 ? c : c - 4) * 7)) >>> 0;

const pop = (x: number) => {
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
};

// ---- shifts of a two-word board (the result in SL / SH) -------------------------------------------------------------
let SL = 0;
let SH = 0;
const shl = (lo: number, hi: number, s: number) => {
  SL = (lo << s) & M28;
  SH = ((hi << s) | (lo >>> (28 - s))) & M21;
};
const shr = (lo: number, hi: number, s: number) => {
  SL = ((lo >>> s) | (hi << (28 - s))) & M28;
  SH = hi >>> s;
};

/** The empty squares that would complete a four for the stones (pl, ph): result in WL / WH. */
let WL = 0;
let WH = 0;
function winning(pl: number, ph: number, ml: number, mh: number): void {
  // vertical (no carry between the words matters: the spare bit on top is never a stone)
  let rl = (pl << 1) & (pl << 2) & (pl << 3);
  let rh = (ph << 1) & (ph << 2) & (ph << 3);
  for (let k = 0; k < 3; k++) {
    const d = k === 0 ? 7 : k === 1 ? 6 : 8;
    shl(pl, ph, d);
    const al = SL, ah = SH;
    shl(pl, ph, 2 * d);
    let ql = al & SL, qh = ah & SH;
    shl(pl, ph, 3 * d);
    rl |= ql & SL;
    rh |= qh & SH;
    shr(pl, ph, d);
    const bl = SL, bh = SH;
    rl |= ql & bl;
    rh |= qh & bh;
    shr(pl, ph, 2 * d);
    ql = bl & SL;
    qh = bh & SH;
    rl |= ql & al;
    rh |= qh & ah;
    shr(pl, ph, 3 * d);
    rl |= ql & SL;
    rh |= qh & SH;
  }
  WL = rl & (BOARD_LO ^ ml);
  WH = rh & (BOARD_HI ^ mh);
}

// ---- the position as the engine sees it ----------------------------------------------------------------------------

/** A position as bitboards: the side to move's stones, all stones, how many. */
export interface Bits {
  pl: number;
  ph: number;
  ml: number;
  mh: number;
  n: number;
}

/** From the board's squares (column × 6 + row, 0 empty, 1 first player, 2 second). */
export function bitsOf(board: ArrayLike<number>): Bits {
  let n = 0;
  for (let s = 0; s < N; s++) if (board[s]) n++;
  const me = n % 2 === 0 ? 1 : 2;
  let pl = 0, ph = 0, ml = 0, mh = 0;
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r < ROWS; r++) {
      const x = board[c * ROWS + r];
      if (!x) break;
      const bit = (1 << ((c < 4 ? c : c - 4) * 7 + r)) >>> 0;
      if (c < 4) {
        ml |= bit;
        if (x === me) pl |= bit;
      } else {
        mh |= bit;
        if (x === me) ph |= bit;
      }
    }
  return { pl, ph, ml, mh, n };
}

const canPlayB = (b: Bits, c: number) => (c < 4 ? (b.ml & (1 << (c * 7 + 5))) === 0 : (b.mh & (1 << ((c - 4) * 7 + 5))) === 0);
/** Play column c (it must have room): the side to move changes. */
export function playB(b: Bits, c: number): Bits {
  const pl = b.pl ^ b.ml, ph = b.ph ^ b.mh;
  let ml = b.ml, mh = b.mh;
  if (c < 4) ml = (ml | (ml + (1 << (c * 7)))) & BOARD_LO;
  else mh = (mh | (mh + (1 << ((c - 4) * 7)))) & BOARD_HI;
  return { pl, ph, ml, mh, n: b.n + 1 };
}
/** Would the side to move make four by playing column c? */
export function winsB(b: Bits, c: number): boolean {
  if (!canPlayB(b, c)) return false;
  winning(b.pl, b.ph, b.ml, b.mh);
  const pl = (b.ml + BOTTOM_LO) & BOARD_LO, ph = (b.mh + BOTTOM_HI) & BOARD_HI;
  return c < 4 ? (WL & pl & colMask(c)) !== 0 : (WH & ph & colMask(c)) !== 0;
}

// ---- the transposition table (kept for the worker's life) ----------------------------------------------------------

/** A prime a little under 2^22: with 32 bits of the key kept, the 49-bit key is exact (Chinese remainder theorem). */
const SIZE = 4194301;
let keys: Uint32Array | null = null;
let vals: Uint8Array | null = null;
const table = () => {
  if (!keys) {
    keys = new Uint32Array(SIZE);
    vals = new Uint8Array(SIZE);
  }
};
/** Bytes the tables take (the solver's and the search's). */
export const TABLE_BYTES = SIZE * 5 + (1 << 20) * 12;

const MIN_SCORE = -18;
const MAX_SCORE = 18;

// ---- the exact solver ------------------------------------------------------------------------------------------------

/** Nodes searched since the worker started (for the measured speed). */
export let nodesTotal = 0;
let nodes = 0;
let nodeCap = Infinity;
let deadline = Infinity;
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
class Budget extends Error {}
const BUDGET = new Budget('budget');

/** Move lists by depth (no allocation while searching). */
const mvCol = new Int32Array(64 * 8);
const mvScore = new Int32Array(64 * 8);

/** The moves that do not lose at once (blocking a threat if there is one, never under the other side's four): NL / NH; 0 = all lose. */
let NL = 0;
let NH = 0;
function nonLosing(pl: number, ph: number, ml: number, mh: number): void {
  let posL = (ml + BOTTOM_LO) & BOARD_LO;
  let posH = (mh + BOTTOM_HI) & BOARD_HI;
  winning(pl ^ ml, ph ^ mh, ml, mh);
  const ol = WL, oh = WH;
  const fl = posL & ol, fh = posH & oh;
  if (fl | fh) {
    if (pop(fl) + pop(fh) > 1) {
      NL = 0;
      NH = 0;
      return;
    }
    posL = fl;
    posH = fh;
  }
  NL = posL & ~(ol >>> 1);
  NH = posH & ~(oh >>> 1);
}
/** Can the side to move win at once? */
function canWinNext(pl: number, ph: number, ml: number, mh: number): boolean {
  winning(pl, ph, ml, mh);
  return ((WL & ((ml + BOTTOM_LO) & BOARD_LO)) | (WH & ((mh + BOTTOM_HI) & BOARD_HI))) !== 0;
}

function negamax(pl: number, ph: number, ml: number, mh: number, n: number, alpha: number, beta: number): number {
  if ((++nodes & 4095) === 0 && (nodes > nodeCap || now() > deadline)) throw BUDGET;
  nonLosing(pl, ph, ml, mh);
  const nl = NL, nh = NH;
  if (!(nl | nh)) return -((N - n) >> 1);
  if (n >= N - 2) return 0;
  let min = -((N - 2 - n) >> 1);
  if (alpha < min) {
    alpha = min;
    if (alpha >= beta) return alpha;
  }
  let max = (N - 1 - n) >> 1;
  if (beta > max) {
    beta = max;
    if (alpha >= beta) return beta;
  }
  const klo = pl + ml, khi = ph + mh;
  const key = klo + khi * 268435456;
  const idx = key % SIZE;
  const chk = (klo | (khi << 28)) >>> 0;
  if (keys![idx] === chk) {
    const v = vals![idx]!;
    if (v) {
      if (v > MAX_SCORE - MIN_SCORE + 1) {
        min = v + 2 * MIN_SCORE - MAX_SCORE - 2;
        if (alpha < min) {
          alpha = min;
          if (alpha >= beta) return alpha;
        }
      } else {
        max = v + MIN_SCORE - 1;
        if (beta > max) {
          beta = max;
          if (alpha >= beta) return beta;
        }
      }
    }
  }
  // Columns centre-out, then by how many fours the move would leave him threatening.
  const base = n * 8;
  let k = 0;
  for (let i = 0; i < 7; i++) {
    const c = ORDER[i]!;
    let sl = 0, sh = 0;
    if (c < 4) {
      sl = nl & colMask(c);
      if (!sl) continue;
    } else {
      sh = nh & colMask(c);
      if (!sh) continue;
    }
    winning(pl | sl, ph | sh, ml, mh);
    const sc = pop(WL) + pop(WH);
    let j = k++;
    while (j > 0 && mvScore[base + j - 1]! < sc) {
      mvScore[base + j] = mvScore[base + j - 1]!;
      mvCol[base + j] = mvCol[base + j - 1]!;
      j--;
    }
    mvScore[base + j] = sc;
    mvCol[base + j] = c;
  }
  for (let i = 0; i < k; i++) {
    const c = mvCol[base + i]!;
    let nml = ml, nmh = mh;
    if (c < 4) nml = (ml | (ml + (1 << (c * 7)))) & BOARD_LO;
    else nmh = (mh | (mh + (1 << ((c - 4) * 7)))) & BOARD_HI;
    const score = -negamax(pl ^ ml, ph ^ mh, nml, nmh, n + 1, -beta, -alpha);
    if (score >= beta) {
      keys![idx] = chk;
      vals![idx] = score + MAX_SCORE - 2 * MIN_SCORE + 2;
      return score;
    }
    if (score > alpha) alpha = score;
  }
  keys![idx] = chk;
  vals![idx] = alpha - MIN_SCORE + 1;
  return alpha;
}

export interface Limit {
  /** Stop after this many positions… */
  nodes?: number;
  /** …or at this time (performance.now()). */
  until?: number;
}

/**
 * The exact score for the side to move (`weak`: only win 1 / draw 0 / loss −1), or null when the budget ran
 * out first. The table keeps what was proved, so asking again with more budget goes on from there.
 */
export function solveBits(b: Bits, lim: Limit = {}, weak = false): number | null {
  table();
  if (canWinNext(b.pl, b.ph, b.ml, b.mh)) return weak ? 1 : (N + 1 - b.n) >> 1;
  if (b.n >= N) return 0;
  let min = -((N - b.n) >> 1);
  let max = (N + 1 - b.n) >> 1;
  if (weak) {
    min = -1;
    max = 1;
  }
  nodes = 0;
  nodeCap = lim.nodes ?? Infinity;
  deadline = lim.until ?? Infinity;
  try {
    while (min < max) {
      let med = min + ((max - min) >> 1);
      if (med <= 0 && Math.trunc(min / 2) < med) med = Math.trunc(min / 2);
      else if (med >= 0 && Math.trunc(max / 2) > med) med = Math.trunc(max / 2);
      const r = negamax(b.pl, b.ph, b.ml, b.mh, b.n, med, med + 1);
      if (r <= med) max = r;
      else min = r;
    }
  } catch (e) {
    if (e !== BUDGET) throw e;
    return null;
  } finally {
    nodesTotal += nodes;
  }
  // (never −0: a draw is 0)
  return (weak ? Math.sign(min) : min) || 0;
}
export const lastNodes = () => nodes;

/** Win / draw / loss as −1 / 0 / 1 from a score. */
export const wdl = (score: number) => Math.sign(score);

/**
 * Every column's exact score for the side to move (null: illegal, or not solved within the limit). A column
 * that wins at once scores the most; the rest are solved one after the other, the best-ordered first.
 */
export function scoreMoves(b: Bits, lim: Limit = {}, weak = false): (number | null)[] {
  const out: (number | null)[] = new Array(COLS).fill(null);
  const open: number[] = [];
  for (const c of ORDER) {
    if (!canPlayB(b, c)) continue;
    if (winsB(b, c)) out[c] = weak ? 1 : (N + 1 - b.n) >> 1;
    else open.push(c);
  }
  // In rounds, each column a growing share (the table keeps what a round proved, so a retry starts from there):
  // the quick proofs — a column that loses or wins soon — come first for every column.
  let total = lim.nodes ?? Infinity;
  for (let cap = 20_000; open.length; cap *= 3) {
    for (let i = 0; i < open.length; ) {
      const c = open[i]!;
      const roundCap = Math.min(cap, total);
      const s = solveBits(playB(b, c), { nodes: roundCap, until: lim.until }, weak);
      total -= nodes;
      if (s != null) {
        out[c] = -s || 0;
        open.splice(i, 1);
      } else i++;
      if (total <= 0 || (lim.until != null && now() > lim.until)) return out;
    }
  }
  return out;
}

// ---- threats in words and in numbers --------------------------------------------------------------------------------

/** The squares where `who` (1 first player, 2 second) would make four, as column × 6 + row. */
export function threatSquares(board: ArrayLike<number>, who: number): number[] {
  const b = bitsOf(board);
  const mine = (b.n % 2 === 0 ? 1 : 2) === who;
  winning(mine ? b.pl : b.pl ^ b.ml, mine ? b.ph : b.ph ^ b.mh, b.ml, b.mh);
  const out: number[] = [];
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r < ROWS; r++) {
      const bit = (1 << ((c < 4 ? c : c - 4) * 7 + r)) >>> 0;
      if (((c < 4 ? WL : WH) & bit) !== 0) out.push(c * ROWS + r);
    }
  return out;
}

// ---- the search a fixed number of moves ahead (for what the solver cannot settle in time) ----------------------------

/** Scores beyond these are proved wins / losses (the solver's score + WIN); heuristic judgements stay inside ±HMAX. */
export const WIN = 10000;
const HMAX = 9000;
/** The search's own table: key check, depth, bound flag and value, best column. */
const HSIZE = 1 << 20;
let hkeys: Uint32Array | null = null;
let hkeys2: Uint32Array | null = null;
let hinfo: Int32Array | null = null;
const htable = () => {
  if (!hkeys) {
    hkeys = new Uint32Array(HSIZE);
    hkeys2 = new Uint32Array(HSIZE);
    hinfo = new Int32Array(HSIZE);
  }
};

/** A leaf's judge: the side to move's view, inside ±HMAX. */
export type Leaf = (pl: number, ph: number, ml: number, mh: number, n: number) => number;

/**
 * Threat parity, the heart of Connect 4 strategy: when the board fills up, the first player gets the odd rows
 * and the second the even rows of whatever column is left, so a threat (a square that would make four) on the
 * right row for its owner tends to win in the end, unless the other side has a threat lower in that column.
 * Each column's lowest threats count (two stacked threats of one side win outright), plus a little for the
 * centre. The side to move's view.
 */
export function parity(pl: number, ph: number, ml: number, mh: number, n: number): number {
  const ol = pl ^ ml, oh = ph ^ mh;
  winning(pl, ph, ml, mh);
  const myL = WL, myH = WH;
  winning(ol, oh, ml, mh);
  const opL = WL, opH = WH;
  const meFirst = n % 2 === 0;
  let s = 0;
  for (let c = 0; c < COLS; c++) {
    const sh = (c < 4 ? c : c - 4) * 7;
    const my = (((c < 4 ? myL : myH) >>> sh) & 0x3f);
    const op = (((c < 4 ? opL : opH) >>> sh) & 0x3f);
    if (!my && !op) continue;
    const myLow = my ? 31 - Math.clz32(my & -my) : 9;
    const opLow = op ? 31 - Math.clz32(op & -op) : 9;
    // Rows from 0: an "odd" row (1st, 3rd, 5th) is r even.
    if (myLow < opLow) {
      const good = (myLow % 2 === 0) === meFirst;
      s += good ? 90 : 30;
      if (my & (1 << (myLow + 1))) s += 400; // two of his own stacked: the lower is a sure four once reached
    } else if (opLow < myLow) {
      const good = (opLow % 2 === 0) !== meFirst;
      s -= good ? 90 : 30;
      if (op & (1 << (opLow + 1))) s -= 400;
    }
    s += 8 * (pop(my) - pop(op));
  }
  // The centre column's stones.
  const cm = colMask(3);
  s += 6 * (pop(pl & cm) - pop(ol & cm));
  return s;
}

let hNodes = 0;
/** The search ahead (negamax, deepening): the side to move must not have a four to make at once (the caller checks). */
function hsearch(pl: number, ph: number, ml: number, mh: number, n: number, depth: number, alpha: number, beta: number, leaf: Leaf): number {
  if ((++hNodes & 2047) === 0 && (hNodes > nodeCap || now() > deadline)) throw BUDGET;
  nonLosing(pl, ph, ml, mh);
  const nl = NL, nh = NH;
  if (!(nl | nh)) return -WIN - ((N - n) >> 1);
  if (n >= N - 2) return 0;
  if (depth <= 0) return Math.max(-HMAX, Math.min(HMAX, leaf(pl, ph, ml, mh, n)));
  const klo = pl + ml, khi = ph + mh;
  const idx = (Math.imul(klo, 0x9e3779b1) ^ Math.imul(khi, 0x85ebca77)) >>> 12;
  const chk = klo >>> 0;
  let first = -1;
  if (hkeys![idx] === chk && hkeys2![idx] === khi) {
    const info = hinfo![idx]!;
    const d = info & 63;
    const flag = (info >> 6) & 3;
    const val = info >> 11;
    first = (info >> 8) & 7;
    if (d >= depth) {
      if (flag === 0) return val;
      if (flag === 1 && val >= beta) return val;
      if (flag === 2 && val <= alpha) return val;
    }
  }
  const base = n * 8;
  let k = 0;
  for (let i = 0; i < 7; i++) {
    const c = ORDER[i]!;
    let sl = 0, sh = 0;
    if (c < 4) {
      sl = nl & colMask(c);
      if (!sl) continue;
    } else {
      sh = nh & colMask(c);
      if (!sh) continue;
    }
    winning(pl | sl, ph | sh, ml, mh);
    const sc = (c === first ? 1000 : 0) + pop(WL) + pop(WH);
    let j = k++;
    while (j > 0 && mvScore[base + j - 1]! < sc) {
      mvScore[base + j] = mvScore[base + j - 1]!;
      mvCol[base + j] = mvCol[base + j - 1]!;
      j--;
    }
    mvScore[base + j] = sc;
    mvCol[base + j] = c;
  }
  const a0 = alpha;
  let best = -Infinity;
  let bestC = mvCol[base]!;
  for (let i = 0; i < k; i++) {
    const c = mvCol[base + i]!;
    let nml = ml, nmh = mh;
    if (c < 4) nml = (ml | (ml + (1 << (c * 7)))) & BOARD_LO;
    else nmh = (mh | (mh + (1 << ((c - 4) * 7)))) & BOARD_HI;
    const v = -hsearch(pl ^ ml, ph ^ mh, nml, nmh, n + 1, depth - 1, -beta, -alpha, leaf);
    if (v > best) {
      best = v;
      bestC = c;
    }
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  hkeys![idx] = chk;
  hkeys2![idx] = khi;
  hinfo![idx] = (best << 11) | (bestC << 8) | ((best <= a0 ? 2 : best >= beta ? 1 : 0) << 6) | Math.min(63, depth);
  return best;
}

/**
 * Each column's value searched `depth` moves ahead, deepening one move at a time until the limit: proved wins
 * and losses beyond ±WIN, judgements of the leaf in between. Columns more than `margin` below the best come
 * back as upper bounds only (still a proof when below −WIN). Returns the deepest finished values and depth.
 */
export function searchAhead(b: Bits, leaf: Leaf, lim: Limit, margin = 40, maxDepth = N - b.n): { values: (number | null)[]; depth: number; nodes: number } {
  htable();
  hNodes = 0;
  nodeCap = lim.nodes ?? Infinity;
  deadline = lim.until ?? Infinity;
  let done: (number | null)[] = new Array(COLS).fill(null);
  let depth = 0;
  try {
    for (let d = 1; d <= maxDepth; d++) {
      const vals: (number | null)[] = new Array(COLS).fill(null);
      // the best of the last round first: its value sets the window for the rest
      const order = ORDER.filter((c) => canPlayB(b, c)).sort((x, y) => (done[y] ?? -Infinity) - (done[x] ?? -Infinity));
      let best = -Infinity;
      for (const c of order) {
        if (winsB(b, c)) {
          vals[c] = WIN + ((N + 1 - b.n) >> 1);
          best = Math.max(best, vals[c]!);
          continue;
        }
        const q = playB(b, c);
        // (the search below a move assumes the side to move cannot make four at once — true under the moves it
        // chooses, not under every column at the root: a column that hands over a four is a loss, said here)
        if (canWinNext(q.pl, q.ph, q.ml, q.mh)) {
          vals[c] = -WIN - ((N - q.n) >> 1);
          best = Math.max(best, vals[c]!);
          continue;
        }
        const alpha = best === -Infinity ? -Infinity : best - margin - 1;
        vals[c] = -hsearch(q.pl, q.ph, q.ml, q.mh, q.n, d - 1, -Infinity, -alpha, leaf);
        best = Math.max(best, vals[c]!);
      }
      done = vals;
      depth = d;
      // Every column proved one way or the other: nothing deeper to learn.
      if (vals.every((v) => v == null || Math.abs(v) > WIN)) break;
    }
  } catch (e) {
    if (e !== BUDGET) throw e;
  } finally {
    nodesTotal += hNodes;
  }
  return { values: done, depth, nodes: hNodes };
}
