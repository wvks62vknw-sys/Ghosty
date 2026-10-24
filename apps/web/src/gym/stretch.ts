/**
 * He invents his own harder puzzles (GYM ideas, part 2): practice at the edge of what he can do. For the
 * games with exact checkers (the maze, Sokoban, Sudoku) the worker now and then makes him a puzzle at a
 * difficulty `x` at or above his level (7.5 = halfway from Level 7's puzzles to Level 8's), he tries
 * it, the game's own checker says whether he solved it, and he practises on it. `x` follows his results so
 * that he solves about half (40–60 % of his last 20 tries): harder after a run of successes, easier after a
 * run of failures — where learning is fastest. The ladder's levels stay the exam: none of this moves him up.
 *
 * Pure and light (the page shows the line; the worker keeps the state in the game's record).
 */
import { lvl } from './core';

/** The tries the rate is measured over. */
export const EDGE_WINDOW = 20;
/** The band he should solve at the edge. */
export const EDGE_LOW = 0.4;
export const EDGE_HIGH = 0.6;
/** How far one try moves the difficulty (in levels): half a step up for a success, down for a failure. */
export const EDGE_STEP = 0.1;
/** Once the last tries are out of the band, the steps double until they are back. */
const MIN_TRIES = 10;

export interface EdgeState {
  /** The difficulty now, as a level: 7.5 = puzzles halfway from Level 7's to Level 8's (his level ≤ x < his level + span). */
  x: number;
  /** The level it was set for (a level-up starts it again at the new level's start). */
  level: number;
  /** His last tries, newest last: 1 solved (the checker passed it), 0 not. */
  tries: number[];
  /** Tries and solves in all. */
  n: number;
  solved: number;
  /** How far above his level it may go (EDGE_SPAN). */
  span?: number;
}

export const newEdge = (level: number): EdgeState => ({ x: lvl(level), level: lvl(level), tries: [], n: 0, solved: 0 });

/** The share of his last tries he solved (0 with none). */
export const edgeRate = (e: EdgeState): number => (e.tries.length ? e.tries.reduce((a, b) => a + b, 0) / e.tries.length : 0);

/**
 * After one try at the edge: the try is counted and the difficulty moves — up by half a step for a success,
 * down by half a step for a failure (so it settles where he solves half), twice as far while his last tries
 * are outside the 40–60 % band. It stays between his level and just under `span` levels above it. Pure.
 */
export function edgeNext(e: EdgeState, solved: boolean, level: number, span = 1): EdgeState {
  const L = lvl(level);
  const base = e.level === L ? e : { ...newEdge(L), n: e.n, solved: e.solved };
  const tries = [...base.tries, solved ? 1 : 0].slice(-EDGE_WINDOW);
  const next = { ...base, tries, n: base.n + 1, solved: base.solved + (solved ? 1 : 0), span };
  const rate = edgeRate(next);
  const out = tries.length >= MIN_TRIES && (rate < EDGE_LOW || rate > EDGE_HIGH);
  const x = base.x + (out ? 2 : 1) * EDGE_STEP * ((solved ? 1 : 0) - 0.5);
  next.x = Math.max(L, Math.min(L + span - 0.01, x));
  return next;
}

/** "7½", "7¼", "8": the difficulty to the nearest quarter level. */
export function edgeLabel(x: number): string {
  // (never rounded up into the next level: 7.94 is still "7¾")
  const whole = Math.floor(x);
  const q = Math.min(whole + 0.75, Math.round(x * 4) / 4);
  return `${whole}${['', '¼', '½', '¾'][Math.round((q - whole) * 4)]}`;
}

/**
 * The games that make puzzles at his edge, and how far above his level they go (in levels): the maze's are his own
 * maze from starts ever farther from the gold (one level: his level's starts to the farthest); Sokoban's and
 * Sudoku's are made as for a harder level, up to three above his.
 */
export const EDGE_SPAN: Record<string, number> = { maze: 1, sokoban: 3, sudoku: 3 };
export const EDGE_GAMES = Object.keys(EDGE_SPAN);

/** "Level 7½: puzzles he only just fails · solved 11 of his last 20" ('' before a try). */
export function edgeLine(e: EdgeState | null | undefined): string {
  if (!e?.tries.length) return '';
  const k = e.tries.reduce((a, b) => a + b, 0);
  const at = `Level ${edgeLabel(e.x)}`;
  const rate = edgeRate(e);
  const top = e.x >= e.level + (e.span ?? 1) - 0.02;
  const what =
    e.tries.length < MIN_TRIES
      ? 'finding the puzzles he only just fails'
      : rate > EDGE_HIGH
        ? top
          ? 'he solves most even at the hardest he makes'
          : 'he solves most: they are getting harder'
        : rate < EDGE_LOW
          ? e.x <= e.level
            ? 'his own level’s puzzles are still hard for him'
            : 'he fails most: they are getting easier'
          : 'puzzles he only just fails';
  return `${at}: ${what} · solved ${k} of his last ${e.tries.length}`;
}

/**
 * A number for a fractional level: part of the way from Level ⌊x⌋'s to the next level's; past Level 10 it goes on
 * the way it was going (Level 10's step again for each level beyond).
 */
export function between(x: number, at: (level: number) => number): number {
  if (x >= 10) return at(10) + (at(10) - at(9)) * (x - 10);
  const L = Math.max(1, Math.floor(x));
  return at(L) + (at(L + 1) - at(L)) * Math.max(0, x - L);
}
