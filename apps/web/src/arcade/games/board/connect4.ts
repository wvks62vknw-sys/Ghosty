/**
 * CONNECT 4 (seven columns, six rows, stones drop to the bottom; four in a row wins). The rules come from the GYM's own light
 * board file (gym/c4board.ts), moved into the arcade's frame and made strong: Ghosty searches every column with a hand-written
 * value (lines of two and three that nobody has blocked, the middle columns) and, from the third level, deepens a game-tree
 * search with that value on top of the Monte-Carlo tree, so a plain trap that wins against the GYM's gentle opponent no longer does.
 */
import { LINES, COLS, ROWS, copyPos, play, wonAt, canPlay, turn, type Pos } from '../../../gym/c4board';
import type { BoardGame, Result, Side } from './kit';

export interface C4State extends Pos {
  /** 0 playing, 1 or 2 the winner, 3 a full board. */
  w: Result;
}
export type C4Move = number;

export function start(): C4State {
  return { b: new Int8Array(42), h: new Int8Array(COLS), n: 0, w: 0 };
}
const sideOf = (s: C4State): Side => turn(s) as Side;
export const legalCols = (s: C4State): number[] => [3, 2, 4, 1, 5, 0, 6].filter((c) => canPlay(s, c));

export function drop(s: C4State, c: number): C4State {
  const p = copyPos(s) as C4State;
  const who = turn(s) as Side;
  const sq = play(p, c);
  p.w = wonAt(p, sq) ? who : p.n === 42 ? 3 : 0;
  return p;
}

function features(s: C4State, side: Side): number[] {
  const opp = side === 1 ? 2 : 1;
  let my2 = 0;
  let my3 = 0;
  let op2 = 0;
  let op3 = 0;
  for (const l of LINES) {
    let m = 0;
    let o = 0;
    for (const q of l) {
      const v = s.b[q]!;
      if (v === side) m++;
      else if (v === opp) o++;
    }
    if (o === 0) (m === 3 ? my3++ : m === 2 ? my2++ : 0);
    else if (m === 0) (o === 3 ? op3++ : o === 2 ? op2++ : 0);
  }
  let centre = 0;
  let near = 0;
  for (let r = 0; r < ROWS; r++) {
    const a = s.b[3 * ROWS + r]!;
    if (a) centre += a === side ? 1 : -1;
    for (const c of [2, 4]) {
      const v = s.b[c * ROWS + r]!;
      if (v) near += v === side ? 1 : -1;
    }
  }
  return [(my2 - op2) / 10, (my3 - op3) / 4, centre / 6, near / 8];
}

export const connect4: BoardGame<C4State, C4Move> = {
  id: 'connect4',
  name: 'Connect 4',
  start,
  side: sideOf,
  legal: legalCols,
  apply: (s, m) => drop(s, m),
  result: (s) => s.w,
  features,
  hand: [0.9, 2.6, 1.2, 0.6],
  key: (m) => String(m),
  from: () => -1,
  to: (m) => m,
  words: { first: 'Red', second: 'Yellow' },
};

// ---------------------------------------------------------------- the game-tree search that makes it strong

/**
 * Iterative deepening alpha-beta from the side to move, for `ms` milliseconds: wins and losses are exact, anything deeper is the
 * hand-written value. Returns the best column and the depth reached, or null if there is no move.
 */
export function deepen(s: C4State, ms: number, weights?: readonly number[] | null): { move: number; depth: number; score: number } | null {
  const cols = legalCols(s);
  if (!cols.length) return null;
  const end = Date.now() + ms;
  const me = sideOf(s);
  const w = weights && weights.length === connect4.hand.length ? weights : connect4.hand;
  const leaf = (p: C4State): number => {
    const f = features(p, me);
    return Math.tanh(f[0]! * w[0]! + f[1]! * w[1]! + f[2]! * w[2]! + f[3]! * w[3]!);
  };
  let nodes = 0;
  let timeUp = false;
  const ab = (p: C4State, depth: number, alpha: number, beta: number, ply: number): number => {
    if (p.w) return p.w === 3 ? 0 : p.w === me ? 10 - ply * 0.01 : -10 + ply * 0.01;
    if (depth === 0) return leaf(p);
    if (++nodes % 512 === 0 && Date.now() > end) timeUp = true;
    if (timeUp) return 0;
    const maxing = sideOf(p) === me;
    let best = maxing ? -Infinity : Infinity;
    for (const c of legalCols(p)) {
      const v = ab(drop(p, c), depth - 1, alpha, beta, ply + 1);
      if (maxing) {
        if (v > best) best = v;
        if (best > alpha) alpha = best;
      } else {
        if (v < best) best = v;
        if (best < beta) beta = best;
      }
      if (alpha >= beta || timeUp) break;
    }
    return best;
  };
  let best = { move: cols[0]!, depth: 0, score: -Infinity };
  for (let depth = 1; depth <= 42 - s.n; depth++) {
    let bm = cols[0]!;
    let bs = -Infinity;
    for (const c of cols) {
      const v = ab(drop(s, c), depth - 1, -Infinity, Infinity, 1);
      if (timeUp) break;
      if (v > bs) ((bs = v), (bm = c));
    }
    if (timeUp) break;
    best = { move: bm, depth, score: bs };
    if (Math.abs(bs) > 5) break;
  }
  return best;
}
