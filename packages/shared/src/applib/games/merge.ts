/**
 * MERGE (the sliding-tiles-that-join genre). Options the board reads from GameConfig.options:
 *   size:   number (3 to 6, default 4)
 *   target: number (the tile that wins, a power of two, default 2048; play can go on after)
 * Each swipe slides every tile as far as it goes; two equal tiles that meet join once per swipe and add their sum
 * to the score. A new tile (a 2, or a 4 one time in ten) lands on an empty cell after each swipe that moved.
 */
import { type Rng } from './rng';

export type Dir = 'up' | 'down' | 'left' | 'right';
export interface MergeBoard {
  size: number;
  cells: number[];
}

export const empty = (size: number): MergeBoard => ({ size, cells: Array(size * size).fill(0) });

/** Slide one line toward its start: the new line and the points gained. */
export function slideLine(line: readonly number[]): { line: number[]; gained: number } {
  const vals = line.filter((v) => v);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < vals.length; i++) {
    if (vals[i] === vals[i + 1]) {
      out.push(vals[i]! * 2);
      gained += vals[i]! * 2;
      i++;
    } else out.push(vals[i]!);
  }
  while (out.length < line.length) out.push(0);
  return { line: out, gained };
}

function lineIdx(size: number, dir: Dir, k: number): number[] {
  return [...Array(size).keys()].map((j) => {
    if (dir === 'left') return k * size + j;
    if (dir === 'right') return k * size + (size - 1 - j);
    if (dir === 'up') return j * size + k;
    return (size - 1 - j) * size + k;
  });
}

export function move(b: MergeBoard, dir: Dir): { board: MergeBoard; gained: number; moved: boolean } {
  const cells = b.cells.slice();
  let gained = 0;
  for (let k = 0; k < b.size; k++) {
    const idx = lineIdx(b.size, dir, k);
    const res = slideLine(idx.map((i) => b.cells[i]!));
    gained += res.gained;
    idx.forEach((i, j) => (cells[i] = res.line[j]!));
  }
  return { board: { size: b.size, cells }, gained, moved: cells.some((v, i) => v !== b.cells[i]) };
}

/** Put a new tile on an empty cell (a 2, or a 4 one time in ten). Returns its cell, or -1 when full. */
export function spawn(b: MergeBoard, r: Rng): number {
  const free = b.cells.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  if (!free.length) return -1;
  const at = free[Math.floor(r() * free.length)]!;
  b.cells[at] = r() < 0.1 ? 4 : 2;
  return at;
}

export function start(size: number, r: Rng): MergeBoard {
  const b = empty(size);
  spawn(b, r);
  spawn(b, r);
  return b;
}

export const canMove = (b: MergeBoard): boolean => (['up', 'down', 'left', 'right'] as Dir[]).some((d) => move(b, d).moved);
export const best = (b: MergeBoard): number => Math.max(...b.cells);
export const reached = (b: MergeBoard, target: number): boolean => best(b) >= target;
