/**
 * Ghosty's move at a board, from one place: the Worker runs it off the page, the hint runs it for you, and the node test
 * runs it with a count of iterations instead of a clock. Monte-Carlo tree search with the hand-written value for every game;
 * Connect 4 also deepens a game-tree search with the same value (so a trap that wins against the GYM's gentle one no longer
 * does). Weights from the GYM's free-GPU job go in through `weights`; there are none by default ("search alone until trained").
 */
import type { BoardId } from '../shelf5';
import { backgammon } from './backgammon';
import { connect4, type C4State, deepen } from './connect4';
import { draughts } from './draughts';
import { type BoardGame, Search, thinkMs } from './kit';
import { othello } from './othello';

export const GAME: Record<BoardId, BoardGame<any, any>> = { draughts, othello, backgammon, connect4 };

export interface Decision {
  move: unknown;
  iters: number;
  /** How sure the search is, 0…1 (the best move's average result). */
  value: number;
  /** Connect 4's game-tree depth, when it ran. */
  depth: number;
}
export interface AskMsg {
  id: number;
  game: BoardId;
  state: unknown;
  level: number;
  seed: number;
  ms: number;
  iters?: number;
  weights?: number[] | null;
}

/** One decision, thinking for `ms` (and at most `iters` iterations when given). */
export function decide(m: Omit<AskMsg, 'id'>): Decision {
  const g = GAME[m.game];
  const tactical = m.game !== 'backgammon';
  if (m.game === 'connect4' && m.level >= 3 && m.iters === undefined) {
    const t0 = Date.now();
    const a = deepen(m.state as C4State, m.ms * 0.55, m.weights);
    const se = new Search(g, m.state, { seed: m.seed, level: m.level, weights: m.weights, tactical });
    se.step(Math.max(20, m.ms - (Date.now() - t0)));
    const mc = se.best();
    // the tree search's answer unless it has seen the game lost and the other has not
    const take = a && a.score > -5;
    return { move: take ? a.move : mc.move, iters: mc.iters, value: take ? (a.score + 1) / 2 : mc.value, depth: a?.depth ?? 0 };
  }
  const se = new Search(g, m.state, { seed: m.seed, level: m.level, weights: m.weights, tactical });
  se.step(m.ms, m.iters);
  const p = se.best();
  return { move: p.move, iters: p.iters, value: p.value, depth: 0 };
}
export { thinkMs };
