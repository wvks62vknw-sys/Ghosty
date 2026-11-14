/**
 * MINES (the mine-sweeping genre). Options the board reads from GameConfig.options:
 *   rows:  number (6 to 24, default 12)
 *   cols:  number (6 to 16, default 9)
 *   mines: number (default about 15% of the cells; at most the cells less the first opening)
 * Fair first move: the mines are laid only after the first tap, never on that cell or its neighbours, so the first tap
 * always opens an area.
 */
import { rng, shuffle } from './rng';

export interface Mines {
  rows: number;
  cols: number;
  mines: number;
  /** -1 a mine, otherwise the number of mines around (empty until the first tap). */
  cells: number[];
  open: boolean[];
  flag: boolean[];
  laid: boolean;
  state: 'play' | 'won' | 'lost';
  boom: number;
}

export function create(rows: number, cols: number, mines: number): Mines {
  const n = rows * cols;
  const m = Math.max(1, Math.min(mines, n - 9));
  return { rows, cols, mines: m, cells: Array(n).fill(0), open: Array(n).fill(false), flag: Array(n).fill(false), laid: false, state: 'play', boom: -1 };
}

export function around(g: Pick<Mines, 'rows' | 'cols'>, i: number): number[] {
  const r = Math.floor(i / g.cols);
  const c = i % g.cols;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < g.rows && cc >= 0 && cc < g.cols) out.push(rr * g.cols + cc);
    }
  return out;
}

/** Lay the mines away from the first tap (and its neighbours). */
export function lay(g: Mines, first: number, seed: number): void {
  const safe = new Set([first, ...around(g, first)]);
  const spots = shuffle(rng(seed), [...g.cells.keys()].filter((i) => !safe.has(i))).slice(0, g.mines);
  g.cells.fill(0);
  for (const i of spots) g.cells[i] = -1;
  for (let i = 0; i < g.cells.length; i++) if (g.cells[i] !== -1) g.cells[i] = around(g, i).filter((j) => g.cells[j] === -1).length;
  g.laid = true;
}

/** Open a cell (laying mines on the first tap); an empty cell opens its neighbours. Returns the cells opened. */
export function reveal(g: Mines, i: number, seed: number): number[] {
  if (g.state !== 'play' || g.open[i] || g.flag[i]) return [];
  if (!g.laid) lay(g, i, seed);
  if (g.cells[i] === -1) {
    g.open[i] = true;
    g.state = 'lost';
    g.boom = i;
    return [i];
  }
  const opened: number[] = [];
  const stack = [i];
  while (stack.length) {
    const j = stack.pop()!;
    if (g.open[j] || g.flag[j]) continue;
    g.open[j] = true;
    opened.push(j);
    if (g.cells[j] === 0) for (const k of around(g, j)) if (!g.open[k]) stack.push(k);
  }
  checkWin(g);
  return opened;
}

/** Tap an open number whose flags are all placed: open the rest of its neighbours. */
export function chord(g: Mines, i: number, seed: number): number[] {
  if (g.state !== 'play' || !g.open[i] || g.cells[i]! <= 0) return [];
  const ns = around(g, i);
  if (ns.filter((j) => g.flag[j]).length !== g.cells[i]) return [];
  const out: number[] = [];
  for (const j of ns) if (!g.flag[j] && !g.open[j]) out.push(...reveal(g, j, seed));
  return out;
}

export function toggleFlag(g: Mines, i: number): void {
  if (g.state === 'play' && !g.open[i]) g.flag[i] = !g.flag[i];
}

export function checkWin(g: Mines): boolean {
  if (g.state === 'play' && g.laid && g.cells.every((v, i) => v === -1 || g.open[i])) {
    g.state = 'won';
    g.flag = g.cells.map((v) => v === -1);
  }
  return g.state === 'won';
}

export const flagsLeft = (g: Mines): number => g.mines - g.flag.filter(Boolean).length;

/** The score for a cleared board: more mines per cell and less time is more. */
export const score = (g: Mines, secs: number): number => Math.max(10, Math.round(g.mines * 100 * (1 + (4 * g.mines) / g.cells.length) - secs * 2));
