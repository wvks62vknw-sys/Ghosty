/**
 * SUDOKU (the number-place genre). Options the board reads from GameConfig.options:
 *   difficulty: 'easy' | 'medium' | 'hard'  (default 'medium'; 38, 31 and 26 clues kept)
 *   mistakes:   number  (wrong entries allowed before the game is lost; 0 means unlimited; default 3)
 *   daily:      boolean (the same puzzle all day; default false)
 * A puzzle is made by filling a grid at random and taking clues out one at a time, keeping a removal only if the puzzle
 * still has exactly one solution, so every puzzle is solvable and has one answer.
 */
import { type Rng, rng, shuffle } from './rng';

export type Difficulty = 'easy' | 'medium' | 'hard';
export const CLUES: Record<Difficulty, number> = { easy: 38, medium: 31, hard: 26 };

const UNITS: number[][] = (() => {
  const u: number[][] = [];
  for (let i = 0; i < 9; i++) {
    u.push([...Array(9).keys()].map((k) => i * 9 + k));
    u.push([...Array(9).keys()].map((k) => k * 9 + i));
    const br = Math.floor(i / 3) * 3;
    const bc = (i % 3) * 3;
    u.push([...Array(9).keys()].map((k) => (br + Math.floor(k / 3)) * 9 + bc + (k % 3)));
  }
  return u;
})();
export const PEERS: number[][] = Array.from({ length: 81 }, (_, c) => [...new Set(UNITS.filter((u) => u.includes(c)).flat())].filter((x) => x !== c));

const canPlace = (g: number[], c: number, v: number) => PEERS[c]!.every((p) => g[p] !== v);

/** How many solutions the grid has, counting up to `limit` (0 in a cell means empty). */
export function countSolutions(grid: readonly number[], limit = 2): number {
  const g = grid.slice();
  let n = 0;
  const go = (): boolean => {
    let best = -1;
    let bestOpts: number[] = [];
    for (let c = 0; c < 81; c++) {
      if (g[c]) continue;
      const opts: number[] = [];
      for (let v = 1; v <= 9; v++) if (canPlace(g, c, v)) opts.push(v);
      if (!opts.length) return false;
      if (best < 0 || opts.length < bestOpts.length) {
        best = c;
        bestOpts = opts;
        if (opts.length === 1) break;
      }
    }
    if (best < 0) {
      n++;
      return n >= limit;
    }
    for (const v of bestOpts) {
      g[best] = v;
      if (go()) return true;
    }
    g[best] = 0;
    return false;
  };
  go();
  return n;
}

/** A solution of the grid, or null. */
export function solve(grid: readonly number[], r?: Rng): number[] | null {
  const g = grid.slice();
  const go = (): boolean => {
    const c = g.indexOf(0);
    if (c < 0) return true;
    const vals = r ? shuffle(r, [1, 2, 3, 4, 5, 6, 7, 8, 9]) : [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (const v of vals) {
      if (!canPlace(g, c, v)) continue;
      g[c] = v;
      if (go()) return true;
    }
    g[c] = 0;
    return false;
  };
  return go() ? g : null;
}

export interface SudokuPuzzle {
  puzzle: number[];
  solution: number[];
  clues: number;
}

export function generate(seed: number, difficulty: Difficulty = 'medium'): SudokuPuzzle {
  const r = rng(seed);
  const solution = solve(Array(81).fill(0), r)!;
  const puzzle = solution.slice();
  let clues = 81;
  const target = CLUES[difficulty];
  for (const c of shuffle(r, [...Array(81).keys()])) {
    if (clues <= target) break;
    const keep = puzzle[c]!;
    puzzle[c] = 0;
    if (countSolutions(puzzle, 2) === 1) clues--;
    else puzzle[c] = keep;
  }
  return { puzzle, solution, clues };
}

/** The cells that clash with another in their row, column or box. */
export function conflicts(grid: readonly number[]): Set<number> {
  const out = new Set<number>();
  for (let c = 0; c < 81; c++) if (grid[c] && PEERS[c]!.some((p) => grid[p] === grid[c])) out.add(c);
  return out;
}

export const isSolved = (grid: readonly number[], solution: readonly number[]): boolean => grid.every((v, i) => v === solution[i]);

/** An empty cell to fill as a hint (the one with fewest candidates), or -1. */
export function hintCell(grid: readonly number[]): number {
  let best = -1;
  let fewest = 10;
  for (let c = 0; c < 81; c++) {
    if (grid[c]) continue;
    let n = 0;
    for (let v = 1; v <= 9; v++) if (canPlace(grid as number[], c, v)) n++;
    if (n < fewest) {
      fewest = n;
      best = c;
    }
  }
  return best;
}

/** The score for a solved puzzle: harder and faster is more, each mistake and hint costs. Never below 100. */
export function score(difficulty: Difficulty, secs: number, mistakes: number, hints: number): number {
  const base = { easy: 1000, medium: 2000, hard: 3500 }[difficulty];
  return Math.max(100, Math.round(base - secs * 1.5 - mistakes * 150 - hints * 200));
}
