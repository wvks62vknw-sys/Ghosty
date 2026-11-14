/**
 * NONOGRAM (the picture-from-number-clues genre). Options the board reads from GameConfig.options:
 *   size:    number (5 to 15 cells a side, default 10)
 *   density: number (percent of cells filled, 35 to 70, default 55)
 *   daily:   boolean (one picture for the whole day, default false)
 * Every puzzle is made so it can be solved by line logic alone (no guessing): a picture is drawn at random and kept
 * only if the line solver finishes it with one answer.
 */
import { rng } from './rng';

export interface Nonogram {
  size: number;
  /** true where the picture is filled. */
  solution: boolean[];
  rows: number[][];
  cols: number[][];
}

/** A line's clue: the lengths of its runs of filled cells ([0] for none). */
export function clue(line: readonly boolean[]): number[] {
  const out: number[] = [];
  let run = 0;
  for (const v of line) {
    if (v) run++;
    else if (run) {
      out.push(run);
      run = 0;
    }
  }
  if (run) out.push(run);
  return out.length ? out : [0];
}

const rowOf = (g: readonly boolean[], n: number, r: number) => g.slice(r * n, r * n + n);
const colOf = (g: readonly boolean[], n: number, c: number) => [...Array(n).keys()].map((r) => g[r * n + c]!);

/** One line by logic: 1 filled, 0 empty, -1 unknown, given its clue. Null when the line cannot fit. */
export function solveLine(cl: readonly number[], known: readonly number[]): number[] | null {
  const n = known.length;
  const runs = cl[0] === 0 ? [] : cl.slice();
  const fill = Array(n).fill(0);
  const blank = Array(n).fill(0);
  let count = 0;
  const cur: number[] = Array(n).fill(0);
  const place = (k: number, from: number): void => {
    if (k === runs.length) {
      for (let i = from; i < n; i++) if (known[i] === 1) return;
      for (let i = from; i < n; i++) cur[i] = 0;
      count++;
      for (let i = 0; i < n; i++) (cur[i] ? fill : blank)[i]++;
      return;
    }
    const len = runs[k]!;
    const rest = runs.slice(k + 1).reduce((a, b) => a + b + 1, 0);
    for (let s = from; s + len + rest <= n; s++) {
      let ok = true;
      for (let i = from; i < s; i++) if (known[i] === 1) ok = false;
      for (let i = s; i < s + len && ok; i++) if (known[i] === 0) ok = false;
      if (s + len < n && known[s + len] === 1) ok = false;
      if (!ok) {
        if (known[s] === 1) break;
        continue;
      }
      for (let i = from; i < s; i++) cur[i] = 0;
      for (let i = s; i < s + len; i++) cur[i] = 1;
      if (s + len < n) cur[s + len] = 0;
      place(k + 1, s + len + 1);
      if (known[s] === 1) break;
    }
  };
  place(0, 0);
  if (!count) return null;
  return known.map((v, i) => (fill[i] === count ? 1 : blank[i] === count ? 0 : v));
}

/** Solve by line logic only: the grid (1, 0 or -1 where logic could not decide), or null when it contradicts. */
export function logicSolve(size: number, rows: number[][], cols: number[][]): number[] | null {
  const g = Array(size * size).fill(-1);
  let changed = true;
  while (changed) {
    changed = false;
    for (let r = 0; r < size; r++) {
      const line = solveLine(rows[r]!, g.slice(r * size, r * size + size));
      if (!line) return null;
      line.forEach((v, c) => {
        if (g[r * size + c] !== v) {
          g[r * size + c] = v;
          changed = true;
        }
      });
    }
    for (let c = 0; c < size; c++) {
      const line = solveLine(cols[c]!, [...Array(size).keys()].map((r) => g[r * size + c]));
      if (!line) return null;
      line.forEach((v, r) => {
        if (g[r * size + c] !== v) {
          g[r * size + c] = v;
          changed = true;
        }
      });
    }
  }
  return g;
}

export function cluesOf(size: number, solution: readonly boolean[]): { rows: number[][]; cols: number[][] } {
  return {
    rows: [...Array(size).keys()].map((r) => clue(rowOf(solution, size, r))),
    cols: [...Array(size).keys()].map((c) => clue(colOf(solution, size, c))),
  };
}

export function generate(seed: number, size = 10, density = 55): Nonogram {
  const r = rng(seed);
  for (let tries = 0; tries < 400; tries++) {
    const solution = Array.from({ length: size * size }, () => r() * 100 < density);
    const { rows, cols } = cluesOf(size, solution);
    const solved = logicSolve(size, rows, cols);
    if (solved && solved.every((v) => v !== -1)) return { size, solution, rows, cols };
  }
  // (a full grid always solves by logic)
  const solution = Array(size * size).fill(true);
  return { size, solution, ...cluesOf(size, solution) };
}

/** Solved when every row and column's clue matches what he filled (another picture with the same clues counts too). */
export function isSolved(n: Nonogram, filled: readonly boolean[]): boolean {
  const c = cluesOf(n.size, filled);
  return c.rows.every((x, i) => x.join() === n.rows[i]!.join()) && c.cols.every((x, i) => x.join() === n.cols[i]!.join());
}

/** Whether a line's clue is already met (to grey it out). */
export const lineDone = (cl: readonly number[], line: readonly boolean[]): boolean => clue(line).join() === cl.join();

export const score = (size: number, secs: number, mistakes: number): number => Math.max(50, Math.round(size * size * 12 - secs - mistakes * 40));
