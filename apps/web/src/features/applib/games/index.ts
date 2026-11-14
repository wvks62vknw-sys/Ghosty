/**
 * THE GAME RENDERER (PLAY & MAKE lane): the 'game' archetype's renderer. It reads AppDef.game (kind and options),
 * draws the game frame (frame.ts) inside the kit app's one scroll area and starts that kind's board. Each board reads
 * GameConfig.options as documented at the top of its file (and of its logic in packages/shared/src/applib/games/).
 */
import type { AppDef, GameKind } from '../../../../../../packages/shared/src/applib/types';
import type { KitApp } from '../../../ui/appkit';
import { stateCard } from '../../../ui/appkit';
import { clear } from '../../../core/dom';
import { type Board, frame } from './frame';
import { sudoku } from './sudoku';
import { mines } from './mines';
import { merge } from './merge';
import { solitaire } from './solitaire';
import { wordguess } from './wordguess';
import { nonogram } from './nonogram';
import { pairs } from './pairs';
import { blocks } from './blocks';
import { snake } from './snake';
import { slide } from './slide';
import { lights } from './lights';
import { simon } from './simon';
import { reaction } from './reaction';
import { hangman } from './hangman';
import { anagram } from './anagram';
import { typing } from './typing';
import { sprint } from './sprint';
import { dots } from './dots';
import { quiz } from './quiz';
import { wordgrid } from './wordgrid';

export const BOARDS: Record<GameKind, Board> = { sudoku, mines, merge, solitaire, wordguess, nonogram, pairs, blocks, snake, slide, lights, simon, reaction, hangman, anagram, typing, sprint, dots, quiz, wordgrid };

/** Draw a game app. Returns the clean-up (timers, frame loops and listeners stopped). */
export function gameRenderer(_root: HTMLElement, def: AppDef, k: KitApp): () => void {
  const g = def.game;
  const board = g && BOARDS[g.kind];
  if (!g || !board) {
    clear(k.body, stateCard('error', 'This game could not be set up. Try another from the Library.'));
    return () => {};
  }
  return frame(k, def.id, g.kind, g.options ?? {}, board);
}
