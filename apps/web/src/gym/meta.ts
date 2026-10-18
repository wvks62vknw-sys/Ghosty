/**
 * What the GYM's page needs to know about each game — name, words, unit, mastery bar per level, whether
 * you can play him — without the engines. The page imports only this (and the two small board files), so
 * the solvers and learners live only in the worker's bundle. Each engine spreads its entry into its Game.
 */
import { lvl } from './core';

export interface GameMeta {
  id: string;
  title: string;
  /** A few words under the name on the card. */
  blurb: string;
  /** One sentence on what he is learning. */
  learns: string;
  /** What one training unit is called in the status line ("games", "puzzles", "runs"). */
  unit: string;
  /** Mastery needed to move up from `level` (1–10). An untrained learner is below it at every level (tested). */
  bar(level: number): number;
  /** PLAY HIM: 'board' (take turns on the board), 'secret' (you pick what he must find), or none. */
  play?: 'board' | 'secret';
}

const per = (bars: number[]) => (level: number) => bars[lvl(level) - 1]!;

export const MAZE: GameMeta = {
  id: 'maze',
  title: 'MAZE',
  blurb: 'walls · mud · gold',
  learns: 'He learns which way to step from every cell to reach the gold for the least cost.',
  unit: 'runs',
  bar: () => 0.95,
};
export const CODEBREAKER: GameMeta = {
  id: 'codebreaker',
  title: 'CODE BREAKER',
  blurb: 'Mastermind · fewest guesses',
  learns: 'He learns which guess narrows down a hidden code fastest, measured against Knuth’s minimax method.',
  unit: 'games',
  bar: () => 0.95,
  play: 'secret',
};
export const COLONY: GameMeta = {
  id: 'colony',
  title: 'COLONY',
  blurb: 'mine · build · rest',
  learns: 'He learns when to mine, when to build panels and when to rest so the colony makes the most energy without going dark.',
  unit: 'runs',
  bar: () => 0.95,
};
export const TRUST: GameMeta = {
  id: 'trust',
  title: 'TRUST TOURNAMENT',
  blurb: 'cooperate or defect · evolution',
  learns: 'A population of strategies evolves by playing each other; he learns which kind of trust pays off.',
  unit: 'generations',
  bar: () => 0.8,
};
export const TICTACTOE: GameMeta = {
  id: 'tictactoe',
  title: 'TIC-TAC-TOE',
  blurb: 'self-play · perfect play',
  learns: 'He plays himself and learns how good every position is, until his move is perfect in all of them.',
  unit: 'games',
  bar: per([0.85, 0.88, 0.9, 0.92, 0.94, 0.96, 0.97, 0.98, 0.99, 1]),
  play: 'board',
};
export const CONNECT4: GameMeta = {
  id: 'connect4',
  title: 'CONNECT 4',
  blurb: 'search + learned instinct',
  learns: 'He plays himself to learn which lines of four matter, then searches ahead with that instinct.',
  unit: 'games',
  bar: () => 0.25,
  play: 'board',
};
export const TILES: GameMeta = {
  id: 'tiles',
  title: 'SLIDING TILES',
  blurb: '8-puzzle → 15-puzzle',
  learns: 'He learns to guess how many moves a scrambled puzzle needs, and uses that guess to search for short solutions.',
  unit: 'puzzles',
  bar: per([0.9, 0.9, 0.9, 0.85, 0.8, 0.8, 0.8, 0.6, 0.5, 0.4]),
};
export const SUDOKU: GameMeta = {
  id: 'sudoku',
  title: 'SUDOKU',
  blurb: 'deduction rules · logic grids',
  learns: 'He learns which deduction to try first and where to guess, so he solves in fewer steps.',
  unit: 'puzzles',
  bar: per([0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.8, 0.8, 0.8]),
};
export const COUNTDOWN: GameMeta = {
  id: 'countdown',
  title: 'COUNTDOWN',
  blurb: '24 game · numbers round',
  learns: 'He learns which sums to try first, so he reaches the target in fewer tries.',
  unit: 'problems',
  bar: () => 0.5,
};
export const WORDS: GameMeta = {
  id: 'words',
  title: 'WORD GUESS',
  blurb: 'five letters · fewest guesses',
  learns: 'He learns which word to try so the colours tell him the most, measured against an information-gain guesser.',
  unit: 'games',
  bar: () => 0.95,
  play: 'secret',
};

/** In card order (the same order as GAMES in index.ts). */
export const META: GameMeta[] = [MAZE, CODEBREAKER, COLONY, TRUST, TICTACTOE, CONNECT4, TILES, SUDOKU, COUNTDOWN, WORDS];
export const metaById = (id: string): GameMeta | undefined => META.find((g) => g.id === id);
