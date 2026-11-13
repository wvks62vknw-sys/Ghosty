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
// the same eight directions as flat tables, so the hot paths (every playout of the search) allocate nothing
const DR = Int8Array.from(DIRS.map((d) => d[0]));
const DC = Int8Array.from(DIRS.map((d) => d[1]));

export function start(): OthelloState {
  const b = new Int8Array(64);
  b[27] = 2;
  b[28] = 1;
  b[35] = 1;
  b[36] = 2;
  return { b, side: 1, pass: 0 };
}
/** How many discs a move at `cell` would flip in direction `d` for `side` (0: none that way). */
function runIn(b: Int8Array, r0: number, c0: number, d: number, side: Side): number {
  const dr = DR[d]!;
  const dc = DC[d]!;
  const opp = 3 - side;
  let r = r0 + dr;
  let c = c0 + dc;
  let n = 0;
  while (r >= 0 && r < 8 && c >= 0 && c < 8 && b[r * 8 + c] === opp) {
    n++;
    r += dr;
    c += dc;
  }
  return n && r >= 0 && r < 8 && c >= 0 && c < 8 && b[r * 8 + c] === side ? n : 0;
}
/** Whether `side` may play `cell` (it flips something); stops at the first line that does. */
function canPlay(b: Int8Array, cell: number, side: Side): boolean {
  if (b[cell]) return false;
  const r0 = cell >> 3;
  const c0 = cell & 7;
  for (let d = 0; d < 8; d++) if (runIn(b, r0, c0, d, side)) return true;
  return false;
}
/** Put `side`'s disc on `cell` and turn what it closes in, in place. */
function place(b: Int8Array, cell: number, side: Side): void {
  const r0 = cell >> 3;
  const c0 = cell & 7;
  for (let d = 0; d < 8; d++) {
    const n = runIn(b, r0, c0, d, side);
    for (let k = 1; k <= n; k++) b[(r0 + DR[d]! * k) * 8 + c0 + DC[d]! * k] = side;
  }
  b[cell] = side;
}
/** The discs a move at `cell` would flip for `side` (empty: not a legal move). */
export function flips(b: Int8Array, cell: number, side: Side): number[] {
  if (b[cell]) return [];
  const r0 = cell >> 3;
  const c0 = cell & 7;
  const out: number[] = [];
  for (let d = 0; d < 8; d++) {
    const n = runIn(b, r0, c0, d, side);
    for (let k = 1; k <= n; k++) out.push((r0 + DR[d]! * k) * 8 + c0 + DC[d]! * k);
  }
  return out;
}
const cellsFor = (b: Int8Array, side: Side): number[] => {
  const out: number[] = [];
  for (let i = 0; i < 64; i++) if (canPlay(b, i, side)) out.push(i);
  return out;
};
const countFor = (b: Int8Array, side: Side): number => {
  let n = 0;
  for (let i = 0; i < 64; i++) if (canPlay(b, i, side)) n++;
  return n;
};
export const legalCells = (s: OthelloState): number[] => cellsFor(s.b, s.side);
export const count = (b: Int8Array, side: Side): number => {
  let n = 0;
  for (let i = 0; i < 64; i++) if (b[i] === side) n++;
  return n;
};

const IS_CORNER = new Uint8Array(64);
for (const c of [0, 7, 56, 63]) IS_CORNER[c] = 1;
/** For a square beside an empty-corner gift: which corner it gives (or -1). */
const XCORNER = new Int8Array(64).fill(-1);
for (const [k, v] of Object.entries({ 1: 0, 8: 0, 9: 0, 6: 7, 15: 7, 14: 7, 48: 56, 49: 56, 57: 56, 54: 63, 55: 63, 62: 63 })) XCORNER[Number(k)] = v;

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
    if (IS_CORNER[i]) corners += sg;
    const xc = XCORNER[i]!;
    if (xc >= 0 && !b[xc]) x += sg;
    const r = i >> 3;
    const c = i & 7;
    if (r === 0 || r === 7 || c === 0 || c === 7) edges += sg;
    // a disc beside an empty square is on the frontier
    for (let d = 0; d < 8; d++) {
      const rr = r + DR[d]!;
      const cc = c + DC[d]!;
      if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && !b[rr * 8 + cc]) {
        frontier += sg;
        break;
      }
    }
  }
  const mine = countFor(b, side);
  const theirs = countFor(b, opp);
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
    place(b, m, s.side);
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
