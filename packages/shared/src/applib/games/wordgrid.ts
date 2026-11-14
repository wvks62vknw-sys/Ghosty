/**
 * WORDGRID (the find-the-hidden-words genre). Options the board reads from GameConfig.options:
 *   words: string[] (the words to hide, 3 to 10 letters; default a themed set drawn from the built-in list)
 *   size:  number (letters a side, 8 to 14, default 10)
 *   count: number (words hidden, 4 to 12, default 8)
 *   diagonal: boolean (words may run diagonally, default true; never backwards)
 * Every word is placed before the grid is filled, so every word listed is there to be found. He drags (or taps the
 * first and last letters) along a straight line to mark a word.
 */
import { type Rng, rng, shuffle } from './rng';
import { WORDS5 } from './wordguess';

export interface WordGrid {
  size: number;
  letters: string[];
  words: { word: string; cells: number[] }[];
}

export function build(pool: readonly string[], size: number, count: number, diagonal: boolean, seed: number): WordGrid {
  const r: Rng = rng(seed);
  const dirs: [number, number][] = diagonal ? [[0, 1], [1, 0], [1, 1], [-1, 1]] : [[0, 1], [1, 0]];
  const clean = [...new Set(pool.map((w) => w.toLowerCase().replace(/[^a-z]/g, '')).filter((w) => w.length >= 3 && w.length <= size))];
  const cand = shuffle(r, clean.length >= 4 ? clean : WORDS5);
  const letters = Array<string>(size * size).fill('');
  const words: WordGrid['words'] = [];
  for (const w of cand) {
    if (words.length >= count) break;
    for (let tries = 0; tries < 80; tries++) {
      const [dr, dc] = dirs[Math.floor(r() * dirs.length)]!;
      const r0 = Math.floor(r() * size);
      const c0 = Math.floor(r() * size);
      const r1 = r0 + dr * (w.length - 1);
      const c1 = c0 + dc * (w.length - 1);
      if (r1 < 0 || r1 >= size || c1 < 0 || c1 >= size) continue;
      const cells = [...Array(w.length).keys()].map((k) => (r0 + dr * k) * size + c0 + dc * k);
      if (cells.some((c, k) => letters[c] && letters[c] !== w[k])) continue;
      cells.forEach((c, k) => (letters[c] = w[k]!));
      words.push({ word: w, cells });
      break;
    }
  }
  const abc = 'abcdefghijklmnopqrstuvwxyz';
  for (let i = 0; i < letters.length; i++) if (!letters[i]) letters[i] = abc[Math.floor(r() * 26)]!;
  return { size, letters, words };
}

/** The cells on the straight line from a to b (rows, columns or diagonals), or [] when not straight. */
export function line(size: number, a: number, b: number): number[] {
  const ar = Math.floor(a / size), ac = a % size, br = Math.floor(b / size), bc = b % size;
  const dr = Math.sign(br - ar), dc = Math.sign(bc - ac);
  const len = Math.max(Math.abs(br - ar), Math.abs(bc - ac));
  if (!(ar === br || ac === bc || Math.abs(br - ar) === Math.abs(bc - ac))) return [];
  return [...Array(len + 1).keys()].map((k) => (ar + dr * k) * size + ac + dc * k);
}

/** The listed word a line of cells marks (either way along it), or ''. */
export function found(g: WordGrid, cells: readonly number[]): string {
  const key = cells.join(',');
  const back = cells.slice().reverse().join(',');
  return g.words.find((w) => w.cells.join(',') === key || w.cells.join(',') === back)?.word ?? '';
}

export const score = (words: number, secs: number): number => Math.max(10, words * 100 - secs);
