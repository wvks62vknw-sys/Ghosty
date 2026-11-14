/**
 * LIGHTS (the press-to-toggle-a-cross genre: turn every light off). Options the board reads from GameConfig.options:
 *   size:  number (3 to 7, default 5)
 *   moves: number (presses used to scramble, 3 to 25, default 10)
 * A board is scrambled by pressing random cells from all-off, so every board can be cleared in at most that many presses.
 */
import { rng } from './rng';

export interface Lights {
  size: number;
  on: boolean[];
  par: number;
}

export function press(l: Lights, i: number): void {
  const n = l.size;
  const r = Math.floor(i / n);
  const c = i % n;
  for (const [dr, dc] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
    const rr = r + dr;
    const cc = c + dc;
    if (rr >= 0 && rr < n && cc >= 0 && cc < n) l.on[rr * n + cc] = !l.on[rr * n + cc];
  }
}

export function scramble(size: number, moves: number, seed: number): Lights & { presses: number[] } {
  const r = rng(seed);
  const l: Lights = { size, on: Array(size * size).fill(false), par: 0 };
  const chosen = new Set<number>();
  while (chosen.size < Math.min(moves, size * size)) chosen.add(Math.floor(r() * size * size));
  for (const i of chosen) press(l, i);
  if (l.on.every((v) => !v)) press(l, 0), chosen.add(0);
  l.par = chosen.size;
  return { ...l, presses: [...chosen] };
}

export const cleared = (l: Lights): boolean => l.on.every((v) => !v);
export const score = (l: Lights, presses: number): number => Math.max(10, l.size * l.size * 20 - Math.max(0, presses - l.par) * 15);
