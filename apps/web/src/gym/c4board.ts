/**
 * The Connect 4 board on its own (no solver, no learner): what the GYM's page needs to let the owner play
 * on it, and what the engine (connect4.ts) builds on. Squares are numbered column by column from the
 * bottom: square = column × 6 + row.
 */
import type { Cell, Frame } from './core';

export const COLS = 7;
export const ROWS = 6;
const N = COLS * ROWS;

/** Every line of four, as squares. */
export const LINES: number[][] = (() => {
  const out: number[][] = [];
  const sq = (c: number, r: number) => c * ROWS + r;
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r < ROWS; r++)
      for (const [dc, dr] of [
        [1, 0],
        [0, 1],
        [1, 1],
        [1, -1],
      ] as const) {
        const ec = c + 3 * dc;
        const er = r + 3 * dr;
        if (ec < 0 || ec >= COLS || er < 0 || er >= ROWS) continue;
        out.push([0, 1, 2, 3].map((k) => sq(c + k * dc, r + k * dr)));
      }
  return out;
})();
const THROUGH: number[][] = Array.from({ length: N }, (_, s) => LINES.map((l, i) => (l.includes(s) ? i : -1)).filter((i) => i >= 0));
const ORDER = [3, 2, 4, 1, 5, 0, 6];

/** A position: squares (0 empty, 1 first player, 2 second), the height of each column, and the number of stones. */
export interface Pos {
  b: Int8Array;
  h: Int8Array;
  n: number;
}

export const newPos = (): Pos => ({ b: new Int8Array(N), h: new Int8Array(COLS), n: 0 });
export const copyPos = (p: Pos): Pos => ({ b: p.b.slice(), h: p.h.slice(), n: p.n });
export const turn = (p: Pos) => (p.n % 2 === 0 ? 1 : 2);
export const canPlay = (p: Pos, c: number) => p.h[c]! < ROWS;
export const legal = (p: Pos) => ORDER.filter((c) => canPlay(p, c));

export function play(p: Pos, c: number): number {
  const s = c * ROWS + p.h[c]!;
  p.b[s] = turn(p);
  p.h[c]!++;
  p.n++;
  return s;
}
export function undo(p: Pos, c: number): void {
  p.h[c]!--;
  p.b[c * ROWS + p.h[c]!] = 0;
  p.n--;
}

/** Did the stone on square s make four in a row? */
export function wonAt(p: Pos, s: number): boolean {
  const me = p.b[s];
  for (const li of THROUGH[s]!) {
    const l = LINES[li]!;
    if (p.b[l[0]!] === me && p.b[l[1]!] === me && p.b[l[2]!] === me && p.b[l[3]!] === me) return true;
  }
  return false;
}

/** Would the side to move win at once by playing column c? */
export function winsNow(p: Pos, c: number): boolean {
  if (!canPlay(p, c)) return false;
  const s = play(p, c);
  const w = wonAt(p, s);
  undo(p, c);
  return w;
}

export function posFromBoard(board: ArrayLike<number>): Pos {
  const p = newPos();
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r < ROWS; r++) {
      const x = board[c * ROWS + r]!;
      if (!x) break;
      p.b[c * ROWS + r] = x;
      p.h[c]!++;
      p.n++;
    }
  return p;
}

/** 1 or 2 if someone has four in a row, 3 for a full board, 0 otherwise. */
export function winnerOf(p: Pos): number {
  for (const l of LINES) {
    const x = p.b[l[0]!];
    if (x && x === p.b[l[1]!] && x === p.b[l[2]!] && x === p.b[l[3]!]) return x;
  }
  return p.n === N ? 3 : 0;
}

export function boardText(p: Pos): string {
  const rows: string[] = [];
  for (let r = ROWS - 1; r >= 0; r--) rows.push([...Array(COLS).keys()].map((c) => '.XO'[p.b[c * ROWS + r]!]).join(' '));
  const w = winnerOf(p);
  const st = w === 1 ? 'X has won.' : w === 2 ? 'O has won.' : w === 3 ? 'Draw.' : `${turn(p) === 1 ? 'X' : 'O'} to move.`;
  return `Connect 4 (columns 1–7, stones drop to the bottom row):\n${rows.join('\n')}\n1 2 3 4 5 6 7\n${st}`;
}

export function frameOf(p: Pos, caption: string, mark = -1): Frame {
  const cells: Cell[] = [];
  for (let r = ROWS - 1; r >= 0; r--)
    for (let c = 0; c < COLS; c++) {
      const s = c * ROWS + r;
      const x = p.b[s];
      cells.push(x === 1 ? { t: '●', c: s === mark ? 'x new' : 'x' } : x === 2 ? { t: '●', c: s === mark ? 'o new' : 'o' } : {});
    }
  return { grid: { w: COLS, h: ROWS, cells }, caption };
}

