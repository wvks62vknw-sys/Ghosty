/**
 * The checkers board on its own (English draughts: 8×8, men move one square diagonally forward, captures
 * are compulsory, a capturing piece must keep jumping while it can, a man reaching the far row is crowned
 * — which ends the move — and kings move and jump both ways). No engine here: this is what the GYM's page
 * needs to let the owner play, and what the engine (checkers.ts) builds on.
 *
 * The 32 dark squares are numbered 1–32 in the text (index 0–31 here), row by row from the top; Black's
 * men start on 1–12 and move down the board, White's on 21–32 and move up. Black moves first.
 * Pieces: 1 Black man, 2 Black king, −1 White man, −2 White king.
 */
import type { Cell, Frame } from './core';

export interface Ck {
  b: Int8Array;
  /** 1 Black to move, −1 White. */
  side: number;
  /** Moves in a row with no capture and no man moved (40 each, 80 in all = a draw). */
  quiet: number;
}
export interface CkMove {
  path: number[];
  caps: number[];
}

export const rowOf = (i: number) => i >> 2;
export const colOf = (i: number) => ((i >> 2) % 2 === 0 ? 2 * (i & 3) + 1 : 2 * (i & 3));
export const sqAt = (r: number, c: number) => (r < 0 || r > 7 || c < 0 || c > 7 || (r + c) % 2 === 0 ? -1 : r * 4 + (c >> 1));
/** Neighbour in each diagonal direction: 0 up-left, 1 up-right, 2 down-left, 3 down-right (−1 off the board). */
export const NB: number[][] = Array.from({ length: 32 }, (_, i) => [
  sqAt(rowOf(i) - 1, colOf(i) - 1),
  sqAt(rowOf(i) - 1, colOf(i) + 1),
  sqAt(rowOf(i) + 1, colOf(i) - 1),
  sqAt(rowOf(i) + 1, colOf(i) + 1),
]);

export function startCk(): Ck {
  const b = new Int8Array(32);
  for (let i = 0; i < 12; i++) b[i] = 1;
  for (let i = 20; i < 32; i++) b[i] = -1;
  return { b, side: 1, quiet: 0 };
}
export const copyCk = (p: Ck): Ck => ({ b: p.b.slice(), side: p.side, quiet: p.quiet });

const dirsFor = (piece: number) => (piece === 1 ? [2, 3] : piece === -1 ? [0, 1] : [0, 1, 2, 3]);
const crownRow = (piece: number) => (piece > 0 ? 7 : 0);

/** Every legal move for the side to move (captures only, if there are any; every jump of a capture, to the end). */
export function legalCk(p: Ck): CkMove[] {
  const caps: CkMove[] = [];
  const quiet: CkMove[] = [];
  const b = p.b;
  for (let i = 0; i < 32; i++) {
    const pc = b[i]!;
    if (!pc || Math.sign(pc) !== p.side) continue;
    // Jumps, depth first: the piece leaves its square while it jumps.
    const jump = (at: number, path: number[], taken: number[]) => {
      let more = false;
      if (!(Math.abs(pc) === 1 && path.length > 1 && rowOf(at) === crownRow(pc))) {
        for (const d of dirsFor(pc)) {
          const over = NB[at]![d]!;
          if (over < 0) continue;
          const land = NB[over]![d]!;
          if (land < 0 || taken.includes(over)) continue;
          const o = b[over]!;
          if (!o || Math.sign(o) === p.side) continue;
          if (b[land] && land !== i) continue;
          more = true;
          jump(land, [...path, land], [...taken, over]);
        }
      }
      if (!more && taken.length) caps.push({ path, caps: taken });
    };
    jump(i, [i], []);
    if (caps.length) continue;
    for (const d of dirsFor(pc)) {
      const to = NB[i]![d]!;
      if (to >= 0 && !b[to]) quiet.push({ path: [i, to], caps: [] });
    }
  }
  return caps.length ? caps : quiet;
}

export function playCk(p: Ck, m: CkMove): void {
  const from = m.path[0]!;
  const to = m.path[m.path.length - 1]!;
  let pc = p.b[from]!;
  p.b[from] = 0;
  for (const c of m.caps) p.b[c] = 0;
  const man = Math.abs(pc) === 1;
  if (man && rowOf(to) === crownRow(pc)) pc *= 2;
  p.b[to] = pc;
  p.quiet = m.caps.length || man ? 0 : p.quiet + 1;
  p.side = -p.side;
}

/** 1 Black has won, −1 White has won, 0.5 a draw, 0 still playing. A side with no move left loses. */
export function resultCk(p: Ck, moves = legalCk(p)): number {
  if (!moves.length) return -p.side;
  return p.quiet >= 80 ? 0.5 : 0;
}

export const moveText = (m: CkMove) => m.path.map((s) => s + 1).join(m.caps.length ? 'x' : '-');

/** The board for the page: 32 squares, then the side, then the quiet count. */
export const ckState = (p: Ck): number[] => [...p.b, p.side, p.quiet];
export const ckFrom = (s: number[]): Ck => ({ b: Int8Array.from(s.slice(0, 32)), side: s[32] ?? 1, quiet: s[33] ?? 0 });

export function ckText(p: Ck): string {
  const rows: string[] = [];
  for (let r = 0; r < 8; r++) {
    let s = '';
    for (let c = 0; c < 8; c++) {
      const i = sqAt(r, c);
      s += i < 0 ? ' ' : { 1: 'b', 2: 'B', [-1]: 'w', [-2]: 'W', 0: '.' }[p.b[i]!];
    }
    rows.push(s);
  }
  return `Checkers (English draughts). Dark squares are numbered 1–32 row by row from the top. b = Black man, B = Black king, w = White man, W = White king, . = empty. Black moves down the board, White up; captures are compulsory and must be completed.\n${rows.join('\n')}\n${p.side === 1 ? 'Black' : 'White'} to move.`;
}

/** The board as a picture (8×8). `marks`: squares to highlight (sel = the picked piece, tgt = where it can go, new = the last move). */
export function ckFrame(p: Ck, caption: string, marks: Record<number, string> = {}): Frame {
  const cells: Cell[] = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const i = sqAt(r, c);
      if (i < 0) {
        cells.push({ c: 'lt' });
        continue;
      }
      const x = p.b[i]!;
      const cls = ['dk', x > 0 ? 'x' : x < 0 ? 'o' : '', marks[i] ?? ''].filter(Boolean).join(' ');
      cells.push({ t: x ? (Math.abs(x) === 2 ? '♛︎' : '●') : '', c: cls });
    }
  return { grid: { w: 8, h: 8, cells }, caption };
}

/** The board cell (0–63) of a square, and back. */
export const cellOfSq = (i: number) => rowOf(i) * 8 + colOf(i);
export const sqOfCell = (cell: number) => sqAt(cell >> 3, cell & 7);
