/**
 * BLOCKS (the falling-four-square-pieces genre). Options the board reads from GameConfig.options:
 *   cols:  number (8 to 12, default 10)
 *   rows:  number (16 to 24, default 20)
 *   level: number (the starting level, 1 to 10, default 1)
 * Pieces come from a shuffled bag of all seven shapes (so no long droughts). A full row clears; 1 to 4 rows at once
 * score 100, 300, 500 or 800 times the level, and every ten rows cleared is a level up (faster falling).
 */
import { type Rng, shuffle } from './rng';

export type Shape = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
export const SHAPES: Shape[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
const CELLS: Record<Shape, [number, number][]> = {
  I: [[0, 1], [1, 1], [2, 1], [3, 1]],
  O: [[1, 0], [2, 0], [1, 1], [2, 1]],
  T: [[1, 0], [0, 1], [1, 1], [2, 1]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
  J: [[0, 0], [0, 1], [1, 1], [2, 1]],
  L: [[2, 0], [0, 1], [1, 1], [2, 1]],
};

export interface Piece {
  shape: Shape;
  rot: number;
  x: number;
  y: number;
}
export interface Blocks {
  cols: number;
  rows: number;
  /** 0 empty, otherwise 1 + the shape's index. */
  grid: number[];
  piece: Piece;
  bag: Shape[];
  next: Shape;
  score: number;
  lines: number;
  level: number;
  over: boolean;
}

/** The piece's cells at a rotation (turning about the 4×4 box; the square never turns). */
export function cells(p: Piece): [number, number][] {
  const base = CELLS[p.shape];
  const size = p.shape === 'I' ? 4 : 3;
  return base.map(([cx, cy]) => {
    let x = cx;
    let y = cy;
    if (p.shape !== 'O') for (let k = 0; k < ((p.rot % 4) + 4) % 4; k++) [x, y] = [size - 1 - y, x];
    return [p.x + x, p.y + y] as [number, number];
  });
}

export function fits(b: Blocks, p: Piece): boolean {
  return cells(p).every(([x, y]) => x >= 0 && x < b.cols && y < b.rows && (y < 0 || !b.grid[y * b.cols + x]));
}

function draw(b: Blocks, r: Rng): Shape {
  if (!b.bag.length) b.bag = shuffle(r, SHAPES);
  return b.bag.shift()!;
}

function spawnPiece(b: Blocks, shape: Shape): void {
  b.piece = { shape, rot: 0, x: Math.floor((b.cols - (shape === 'I' ? 4 : 3)) / 2), y: shape === 'I' ? -1 : 0 };
  if (!fits(b, b.piece)) b.over = true;
}

export function start(cols: number, rows: number, level: number, r: Rng): Blocks {
  const b: Blocks = { cols, rows, grid: Array(cols * rows).fill(0), piece: { shape: 'T', rot: 0, x: 0, y: 0 }, bag: [], next: 'T', score: 0, lines: 0, level, over: false };
  const first = draw(b, r);
  b.next = draw(b, r);
  spawnPiece(b, first);
  return b;
}

export function shift(b: Blocks, dx: number): boolean {
  const p = { ...b.piece, x: b.piece.x + dx };
  if (b.over || !fits(b, p)) return false;
  b.piece = p;
  return true;
}

/** Turn clockwise (dir 1) or back (-1), nudging off a wall or the floor if needed. */
export function rotate(b: Blocks, dir = 1): boolean {
  if (b.over) return false;
  for (const [kx, ky] of [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1]] as [number, number][]) {
    const p = { ...b.piece, rot: b.piece.rot + dir, x: b.piece.x + kx, y: b.piece.y + ky };
    if (fits(b, p)) {
      b.piece = p;
      return true;
    }
  }
  return false;
}

/** Where the piece would land (its shadow). */
export function ghostY(b: Blocks): number {
  let y = b.piece.y;
  while (fits(b, { ...b.piece, y: y + 1 })) y++;
  return y;
}

export const LINE_POINTS = [0, 100, 300, 500, 800];

function lock(b: Blocks, r: Rng): number {
  const id = SHAPES.indexOf(b.piece.shape) + 1;
  for (const [x, y] of cells(b.piece)) {
    if (y < 0) {
      b.over = true;
      return 0;
    }
    b.grid[y * b.cols + x] = id;
  }
  let cleared = 0;
  for (let y = b.rows - 1; y >= 0; y--) {
    const row = b.grid.slice(y * b.cols, (y + 1) * b.cols);
    if (row.every(Boolean)) {
      b.grid.splice(y * b.cols, b.cols);
      b.grid.unshift(...Array(b.cols).fill(0));
      cleared++;
      y++;
    }
  }
  if (cleared) {
    b.score += LINE_POINTS[cleared]! * b.level;
    b.lines += cleared;
    b.level = Math.max(b.level, 1 + Math.floor(b.lines / 10));
  }
  spawnPiece(b, b.next);
  b.next = draw(b, r);
  return cleared;
}

/** Fall one row; lands and locks when it cannot. Returns rows cleared on a lock, or -1 if it just fell. */
export function tick(b: Blocks, r: Rng): number {
  if (b.over) return 0;
  const p = { ...b.piece, y: b.piece.y + 1 };
  if (fits(b, p)) {
    b.piece = p;
    return -1;
  }
  return lock(b, r);
}

/** Drop straight down (two points a row) and lock. Returns rows cleared. */
export function hardDrop(b: Blocks, r: Rng): number {
  if (b.over) return 0;
  const y = ghostY(b);
  b.score += (y - b.piece.y) * 2;
  b.piece = { ...b.piece, y };
  return lock(b, r);
}

/** Milliseconds per row at a level. */
export const fallMs = (level: number): number => Math.max(80, Math.round(800 * Math.pow(0.85, level - 1)));
