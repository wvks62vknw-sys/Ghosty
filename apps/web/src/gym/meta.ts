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
  /** One sentence on what he is learning, in his own words (first person). */
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
  learns: 'I learn which way to step from every cell to reach the gold for the least cost.',
  unit: 'runs',
  bar: () => 0.95,
};
export const CODEBREAKER: GameMeta = {
  id: 'codebreaker',
  title: 'CODE BREAKER',
  blurb: 'Mastermind · fewest guesses',
  learns: 'I learn which guess narrows down a hidden code fastest, measured against Knuth’s minimax method.',
  unit: 'games',
  bar: () => 0.95,
  play: 'secret',
};
export const COLONY: GameMeta = {
  id: 'colony',
  title: 'COLONY',
  blurb: 'mine · build · rest',
  learns: 'I learn when to mine, when to build panels and when to rest, so the colony makes the most energy without going dark.',
  unit: 'runs',
  bar: () => 0.95,
};
export const TRUST: GameMeta = {
  id: 'trust',
  title: 'TRUST TOURNAMENT',
  blurb: 'cooperate or defect · evolution',
  learns: 'A population of strategies evolves by playing each other; I learn which kind of trust pays off.',
  unit: 'generations',
  bar: () => 0.75,
};
export const TICTACTOE: GameMeta = {
  id: 'tictactoe',
  title: 'TIC-TAC-TOE',
  blurb: 'self-play · perfect play',
  learns: 'I play myself and learn how good every position is, until my move is perfect in all of them. Against you, every move is perfect already.',
  unit: 'games',
  bar: per([0.85, 0.88, 0.9, 0.92, 0.94, 0.96, 0.97, 0.98, 0.99, 1]),
  play: 'board',
};
export const CONNECT4: GameMeta = {
  id: 'connect4',
  title: 'CONNECT 4',
  blurb: 'search + learned instinct',
  learns: 'I play myself to learn which lines of four matter. Against you I bring everything: an exact solver, a search ahead, that instinct, and what your games taught me.',
  unit: 'games',
  bar: per([0.3, 0.32, 0.34, 0.3, 0.36, 0.38, 0.4, 0.42, 0.42, 0.45]),
  play: 'board',
};
export const TILES: GameMeta = {
  id: 'tiles',
  title: 'SLIDING TILES',
  blurb: '8-puzzle → 15-puzzle',
  learns: 'I learn to guess how many moves a scrambled puzzle needs, and use that guess to search for short solutions.',
  unit: 'puzzles',
  bar: per([0.9, 0.9, 0.9, 0.85, 0.8, 0.8, 0.8, 0.6, 0.5, 0.4]),
};
export const SUDOKU: GameMeta = {
  id: 'sudoku',
  title: 'SUDOKU',
  blurb: 'deduction rules · logic grids',
  learns: 'I learn which deduction to try first and where to guess, so I solve in fewer steps.',
  unit: 'puzzles',
  bar: per([0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.8, 0.8, 0.8]),
};
export const COUNTDOWN: GameMeta = {
  id: 'countdown',
  title: 'COUNTDOWN',
  blurb: '24 game · numbers round',
  learns: 'I learn which sums to try first, so I reach the target in fewer tries.',
  unit: 'problems',
  bar: () => 0.35,
};
export const WORDS: GameMeta = {
  id: 'words',
  title: 'WORD GUESS',
  blurb: 'five letters · fewest guesses',
  learns: 'I learn which word to try so the colours tell me the most, measured against an information-gain guesser.',
  unit: 'games',
  bar: () => 0.95,
  play: 'secret',
};

// ---- part 2: reasoning games (their problems will train the offline language model) ----
export const LOGIC: GameMeta = {
  id: 'logic',
  title: 'LOGIC SANDBOX',
  blurb: 'claims · proofs · truth tables',
  learns: 'I learn which steps to try first when proving a claim; every claim is checked by machine, and a false one “proved” counts as a failure.',
  unit: 'proofs',
  bar: per([0.8, 0.8, 0.8, 0.75, 0.75, 0.8, 0.75, 0.7, 0.65, 0.65]),
};
export const BRAIN: GameMeta = {
  id: 'brain',
  title: 'MINI-BRAIN LAB',
  blurb: 'tiny networks · shape search',
  learns: 'I learn which shape of tiny network (layers, size, learning speed) learns a kind of pattern best, tested on data it never saw.',
  unit: 'networks',
  bar: () => 0.8,
};
export const BUGHUNT: GameMeta = {
  id: 'bughunt',
  title: 'BUG HUNT',
  blurb: 'one bug · find it · fix it',
  learns: 'I learn which lines and which kinds of slip to suspect first, so I find and fix the bug in fewer tries.',
  unit: 'programs',
  bar: () => 0.7,
};
export const ESCAPE: GameMeta = {
  id: 'escape',
  title: 'TEXT ESCAPE ROOMS',
  blurb: 'keys · locks · codes · clues',
  learns: 'I learn which commands to try first, so I escape in nearly as few steps as the shortest way out.',
  unit: 'rooms',
  // (He cannot see inside a box until he opens it; the shortest way is worked out knowing everything.)
  bar: per([0.8, 0.8, 0.8, 0.75, 0.75, 0.75, 0.75, 0.7, 0.7, 0.7]),
};
export const FACTCHECK: GameMeta = {
  id: 'factcheck',
  title: 'FACT-CHECK DUEL',
  blurb: 'true · false · can’t tell',
  learns: 'I learn which facts to look up and how to combine them — and to say “can’t tell” when the facts do not settle it.',
  unit: 'claims',
  bar: () => 0.9,
};
export const DEBATE: GameMeta = {
  id: 'debate',
  title: 'DEBATE ARENA',
  blurb: 'cite the facts · the judge checks',
  learns: 'I learn which facts to cite so a strict judge agrees — winning from the true side and never from the false one.',
  unit: 'debates',
  bar: () => 0.85,
};


// ---- part 2: board games against fixed reference engines, poker, puzzles and control ----
export const CHECKERS: GameMeta = {
  id: 'checkers',
  title: 'CHECKERS',
  blurb: 'draughts · vs reference engines',
  learns: 'I play myself to learn what a checkers position is worth — tens of thousands of small shapes — then search with it against fixed reference engines: first ones that start men down, then even games, then ones that look further ahead than I do.',
  unit: 'games',
  bar: per([0.75, 0.88, 0.85, 0.72, 0.52, 0.65, 0.77, 0.64, 0.76, 0.67]),
  play: 'board',
};
export const CHESS: GameMeta = {
  id: 'chess',
  title: 'CHESS',
  blurb: 'learned eval · vs reference engines',
  learns: 'I play myself and tune what each piece is worth on each square, then search ahead with it against my own fixed reference engines (not Stockfish).',
  unit: 'games',
  bar: per([0.6, 0.6, 0.6, 0.6, 0.55, 0.7, 0.6, 0.55, 0.5, 0.56]),
  play: 'board',
};
export const GO: GameMeta = {
  id: 'go',
  title: 'GO 9×9',
  blurb: 'learned instinct · vs tree search',
  learns: 'I play myself, searching every move, and learn from my own searches which shapes are good moves — an instinct that keeps sharpening — then play by that instinct against fixed tree-search engines.',
  unit: 'games',
  bar: per([0.75, 0.85, 0.65, 0.5, 0.6, 0.5, 0.72, 0.58, 0.8, 0.64]),
  play: 'board',
};
export const POKER: GameMeta = {
  id: 'poker',
  title: 'SIMPLE POKER',
  blurb: "Kuhn → Leduc hold'em",
  learns: 'I play every deal against myself and learn from regret how often to bet, call, fold and bluff, until no opponent can beat me — in a bigger poker game at each level.',
  unit: 'rounds',
  // 0.9 = exploitability down to the level's limit (every level is a different game; see poker.ts).
  bar: () => 0.9,
};
export const SOKOBAN: GameMeta = {
  id: 'sokoban',
  title: 'SOKOBAN',
  blurb: 'push boxes · dead ends',
  learns: 'I learn which squares are dead ends for a box and how far a position is from solved, so my search finds short solutions within a budget.',
  unit: 'puzzles',
  bar: per([0.8, 0.8, 0.8, 0.8, 0.75, 0.65, 0.6, 0.5, 0.5, 0.5]),
};
export const BALANCE: GameMeta = {
  id: 'balance',
  title: 'BALANCE & LANDER',
  blurb: 'pole on a cart → moon lander',
  learns: 'I try many small variations of my controller and keep the best, until I balance the pole — and later land softly on the pad — from starts I have never seen.',
  unit: 'trials',
  bar: per([0.95, 0.95, 0.95, 0.95, 0.95, 0.9, 0.9, 0.9, 0.6, 0.45]),
};

/** In card order (the same order as GAMES in index.ts). */
export const META: GameMeta[] = [MAZE, CODEBREAKER, COLONY, TRUST, TICTACTOE, CONNECT4, TILES, SUDOKU, COUNTDOWN, WORDS, LOGIC, BRAIN, BUGHUNT, ESCAPE, FACTCHECK, DEBATE, CHECKERS, CHESS, GO, POKER, SOKOBAN, BALANCE];
export const metaById = (id: string): GameMeta | undefined => META.find((g) => g.id === id);
