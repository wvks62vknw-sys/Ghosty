/** Every game in the GYM, in card order. A later part adds games by appending here. */
import { balance } from './balance';
import { checkers } from './checkers';
import { chess } from './chess';
import { codebreaker } from './codebreaker';
import { colony } from './colony';
import { connect4 } from './connect4';
import type { Game } from './core';
import { countdown } from './countdown';
import { go } from './go';
import { maze } from './maze';
import { poker } from './poker';
import { sokoban } from './sokoban';
import { sudoku } from './sudoku';
import { tictactoe } from './tictactoe';
import { tiles } from './tiles';
import { trust } from './trust';
import { words } from './words';

export const GAMES: Game[] = [maze, codebreaker, colony, trust, tictactoe, connect4, tiles, sudoku, countdown, words, checkers, chess, go, poker, sokoban, balance];

export const gameById = (id: string): Game | undefined => GAMES.find((g) => g.id === id);
