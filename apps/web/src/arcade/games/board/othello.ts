/**
 * OTHELLO (8 × 8, black first): a move must flip at least one line of the other side's discs by closing them in; with no such
 * move a side passes; when neither can move the game ends and the more discs wins. Ghosty's hand-written value: the corners,
 * the squares beside an empty corner (a gift), how many moves each side has, the edges, the frontier and, late, the discs.
 */
import type { BoardGame, Result, Side } from './kit';
import { other } from './kit';

export interface OthelloState {
  b: Int8Array;
  side: Side;
  /** Passes in a row (two ends the game). */
  pass: number;
}
/** A cell 0…63 (row × 8 + column), or -1 for a pass. */
export type OthelloMove = number;

const DIRS: [number, number][] = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

export function start(): OthelloState {
  const b = new Int8Array(64);
  b[27] = 2;
  b[28] = 1;
  b[35] = 1;
  b[36] = 2;
  return { b, side: 1, pass: 0 };
}
/** The discs a move at `cell` would flip for `side` (empty: not a legal move). */
export function flips(b: Int8Array, cell: number, side: Side): number[] {
  if (b[cell]) return [];
  const r0 = cell >> 3;
  const c0 = cell & 7;
  const out: number[] = [];
  for (const [dr, dc] of DIRS) {
    const line: number[] = [];
    let r = r0 + dr;
    let c = c0 + dc;
    while (r >= 0 && r < 8 && c >= 0 && c < 8 && b[r * 8 + c] === other(side)) {
      line.push(r * 8 + c);
      r += dr;
      c += dc;
    }
    if (line.length && r >= 0 && r < 8 && c >= 0 && c < 8 && b[r * 8 + c] === side) out.push(...line);
  }
  return out;
}
const cellsFor = (b: Int8Array, side: Side): number[] => {
  const out: number[] = [];
  for (let i = 0; i < 64; i++) if (!b[i] && flips(b, i, side).length) out.push(i);
  return out;
};
export const legalCells = (s: OthelloState): number[] => cellsFor(s.b, s.side);
export const count = (b: Int8Array, side: Side): number => {
  let n = 0;
  for (let i = 0; i < 64; i++) if (b[i] === side) n++;
  return n;
};

const CORNERS = [0, 7, 56, 63];
const XSQ: Record<number, number> = { 1: 0, 8: 0, 9: 0, 6: 7, 15: 7, 14: 7, 48: 56, 49: 56, 57: 56, 54: 63, 55: 63, 62: 63 };

function features(s: OthelloState, side: Side): number[] {
  const b = s.b;
  const opp = other(side);
  let corners = 0;
  let x = 0;
  let edges = 0;
  let frontier = 0;
  let discs = 0;
  let empty = 0;
  for (let i = 0; i < 64; i++) {
    const v = b[i]!;
    if (!v) {
      empty++;
      continue;
    }
    const sg = v === side ? 1 : -1;
    discs += sg;
    if (CORNERS.includes(i)) corners += sg;
    const xc = XSQ[i];
    if (xc !== undefined && !b[xc]) x += sg;
    const r = i >> 3;
    const c = i & 7;
    if (r === 0 || r === 7 || c === 0 || c === 7) edges += sg;
    // a disc beside an empty square is on the frontier
    let front = false;
    for (const [dr, dc] of DIRS) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && !b[rr * 8 + cc]) {
        front = true;
        break;
      }
    }
    if (front) frontier += sg;
  }
  const mine = cellsFor(b, side).length;
  const theirs = cellsFor(b, opp).length;
  const mobility = (mine - theirs) / (mine + theirs + 1);
  const late = 1 - empty / 60;
  return [corners / 4, x / 4, mobility, (discs / 64) * late * 2, edges / 14, frontier / 20];
}

export const othello: BoardGame<OthelloState, OthelloMove> = {
  id: 'othello',
  name: 'Othello',
  start: () => start(),
  side: (s) => s.side,
  legal: (s) => {
    const cells = legalCells(s);
    return cells.length ? cells : [-1];
  },
  apply: (s, m) => {
    if (m < 0) return { b: s.b, side: other(s.side), pass: s.pass + 1 };
    const b = s.b.slice();
    for (const f of flips(b, m, s.side)) b[f] = s.side;
    b[m] = s.side;
    return { b, side: other(s.side), pass: 0 };
  },
  result: (s): Result => {
    let empty = false;
    for (let i = 0; i < 64; i++) if (!s.b[i]) (empty = true), (i = 64);
    if (s.pass >= 2 || !empty) {
      const a = count(s.b, 1);
      const c = count(s.b, 2);
      return a > c ? 1 : c > a ? 2 : 3;
    }
    return 0;
  },
  features,
  hand: [2.2, -1.1, 1.5, 0.9, 0.6, -0.6],
  key: (m) => String(m),
  from: () => -1,
  to: (m) => m,
  words: { first: 'Black', second: 'White' },
};
