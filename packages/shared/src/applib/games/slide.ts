/**
 * SLIDE (the sliding-number-tiles genre). Options the board reads from GameConfig.options:
 *   size: number (3 to 6, default 4)
 * The board is shuffled by making random legal moves from the solved board, so every shuffle can be solved. 0 is the gap.
 */
import { rng } from './rng';

export interface SlideBoard {
  size: number;
  cells: number[];
}

export const solved = (size: number): SlideBoard => ({ size, cells: [...Array(size * size).keys()].map((i) => (i + 1) % (size * size)) });
export const isSolved = (b: SlideBoard): boolean => b.cells.every((v, i) => v === (i + 1) % (b.size * b.size));

/** The tiles next to the gap (the ones that can move). */
export function movable(b: SlideBoard): number[] {
  const g = b.cells.indexOf(0);
  const r = Math.floor(g / b.size);
  const c = g % b.size;
  const out: number[] = [];
  if (r > 0) out.push(g - b.size);
  if (r < b.size - 1) out.push(g + b.size);
  if (c > 0) out.push(g - 1);
  if (c < b.size - 1) out.push(g + 1);
  return out;
}

/** Tap a tile in the gap's row or column: it and those between slide toward the gap. Returns tiles moved (0 if none). */
export function tap(b: SlideBoard, i: number): number {
  const g = b.cells.indexOf(0);
  const s = b.size;
  const sameRow = Math.floor(g / s) === Math.floor(i / s);
  const sameCol = g % s === i % s;
  if (i === g || (!sameRow && !sameCol)) return 0;
  const step = sameRow ? (i > g ? 1 : -1) : i > g ? s : -s;
  let gap = g;
  let n = 0;
  while (gap !== i) {
    b.cells[gap] = b.cells[gap + step]!;
    gap += step;
    b.cells[gap] = 0;
    n++;
  }
  return n;
}

export function shuffled(size: number, seed: number): SlideBoard {
  const r = rng(seed);
  const b = solved(size);
  let prev = -1;
  const moves = size * size * size * 12;
  for (let k = 0; k < moves; k++) {
    const opts = movable(b).filter((i) => i !== prev);
    const pickI = opts[Math.floor(r() * opts.length)]!;
    prev = b.cells.indexOf(0);
    tap(b, pickI);
  }
  if (isSolved(b)) tap(b, movable(b)[0]!);
  return b;
}

/** Whether a layout can be solved at all (the inversion-parity rule). */
export function solvable(b: SlideBoard): boolean {
  const t = b.cells.filter((v) => v);
  let inv = 0;
  for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) if (t[i]! > t[j]!) inv++;
  if (b.size % 2) return inv % 2 === 0;
  const gapRowFromBottom = b.size - Math.floor(b.cells.indexOf(0) / b.size);
  return (inv + gapRowFromBottom) % 2 === 1;
}

export const score = (size: number, moves: number, secs: number): number => Math.max(10, Math.round(size * size * 120 - moves * 2 - secs));
