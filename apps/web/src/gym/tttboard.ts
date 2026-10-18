/** The tic-tac-toe board on its own (no solver, no learner): what the GYM's page needs to let the owner play. */
import type { Frame } from './core';

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

/** 1 X won, 2 O won, 3 draw, 0 still playing. */
export function winner(b: ArrayLike<number>): number {
  for (const [a, c, d] of LINES) if (b[a!] && b[a!] === b[c!] && b[a!] === b[d!]) return b[a!]!;
  for (let i = 0; i < 9; i++) if (!b[i]) return 0;
  return 3;
}

export const keyOf = (b: ArrayLike<number>) => {
  let k = 0;
  for (let i = 0; i < 9; i++) k = k * 3 + b[i]!;
  return k;
};
export const toMove = (b: ArrayLike<number>) => {
  let n = 0;
  for (let i = 0; i < 9; i++) if (b[i]) n++;
  return n % 2 === 0 ? 1 : 2;
};
export function boardText(b: ArrayLike<number>): string {
  const rows = [0, 1, 2].map((r) => [0, 1, 2].map((c) => '.XO'[b[r * 3 + c]!]).join(' '));
  const w = winner(b);
  const state = w === 1 ? 'X has won.' : w === 2 ? 'O has won.' : w === 3 ? 'Draw.' : `${toMove(b) === 1 ? 'X' : 'O'} to move.`;
  return `Tic-tac-toe (squares 1–9, left to right, top to bottom):\n${rows.join('\n')}\n${state}`;
}

export function frameOf(b: ArrayLike<number>, caption: string): Frame {
  return { grid: { w: 3, h: 3, cells: [...Array(9)].map((_, i) => (b[i] === 1 ? { t: 'X', c: 'x' } : b[i] === 2 ? { t: 'O', c: 'o' } : {})) }, caption };
}

