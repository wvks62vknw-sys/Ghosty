/**
 * DOTS (the join-the-dots-and-close-boxes genre, against the phone). Options the board reads from GameConfig.options:
 *   size: number (boxes a side, 2 to 6, default 4)
 *   cpu:  string ('easy' | 'fair', default 'fair')
 * Closing a box scores it and gives another turn. The phone takes any box it can, and when 'fair' avoids giving one away.
 */
import { type Rng } from './rng';

export interface Dots {
  size: number;
  /** Edges: the first size×(size+1) are across, the rest down. 0 not drawn, 1 him, 2 the phone. */
  edges: number[];
  /** Boxes: 0 open, 1 his, 2 the phone's. */
  boxes: number[];
  turn: 1 | 2;
}

export const start = (size: number): Dots => ({ size, edges: Array(2 * size * (size + 1)).fill(0), boxes: Array(size * size).fill(0), turn: 1 });

/** The four edges of box (r, c): top, bottom, left, right. */
export function boxEdges(size: number, b: number): [number, number, number, number] {
  const r = Math.floor(b / size);
  const c = b % size;
  const across = size * (size + 1);
  return [r * size + c, (r + 1) * size + c, across + r * (size + 1) + c, across + r * (size + 1) + c + 1];
}

const sides = (d: Dots, b: number) => boxEdges(d.size, b).filter((e) => d.edges[e]).length;
const boxesOf = (d: Dots, e: number) => [...d.boxes.keys()].filter((b) => boxEdges(d.size, b).includes(e));

/** Draw an edge for whoever's turn it is. Returns boxes closed (-1 if not allowed); no box closed passes the turn. */
export function draw(d: Dots, e: number): number {
  if (e < 0 || e >= d.edges.length || d.edges[e]) return -1;
  d.edges[e] = d.turn;
  let closed = 0;
  for (const b of boxesOf(d, e))
    if (!d.boxes[b] && sides(d, b) === 4) {
      d.boxes[b] = d.turn;
      closed++;
    }
  if (!closed) d.turn = d.turn === 1 ? 2 : 1;
  return closed;
}

/** The phone's edge: one that closes a box; else ('fair') one that gives none away; else any. */
export function cpuEdge(d: Dots, r: Rng, level: 'easy' | 'fair' = 'fair'): number {
  const free = [...d.edges.keys()].filter((e) => !d.edges[e]);
  if (!free.length) return -1;
  const closes = free.filter((e) => boxesOf(d, e).some((b) => sides(d, b) === 3));
  if (closes.length && (level === 'fair' || r() < 0.6)) return closes[Math.floor(r() * closes.length)]!;
  if (level === 'fair') {
    const safe = free.filter((e) => boxesOf(d, e).every((b) => sides(d, b) < 2));
    if (safe.length) return safe[Math.floor(r() * safe.length)]!;
    // give away the fewest: the edge whose boxes have the fewest sides
    let best = free[0]!;
    let bestN = 9;
    for (const e of free) {
      const n = boxesOf(d, e).filter((b) => sides(d, b) === 2).length;
      if (n < bestN) {
        bestN = n;
        best = e;
      }
    }
    return best;
  }
  return free[Math.floor(r() * free.length)]!;
}

export const over = (d: Dots): boolean => d.boxes.every(Boolean);
export const tally = (d: Dots): { me: number; cpu: number } => ({ me: d.boxes.filter((b) => b === 1).length, cpu: d.boxes.filter((b) => b === 2).length });
