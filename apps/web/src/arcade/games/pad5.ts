/**
 * The pass-5 games' buttons on a standard pad, read by input.ts PAD_BUTTONS (the d-pad and the left stick always move).
 * THE PLATFORMER: A jumps, X or B runs. THE CAVE: A jumps, X fires, B uses a lantern or speaks, Y opens the map. The board
 * games: the d-pad moves the cursor, A picks and places, B takes a move back, X asks for a hint. START pauses all.
 */
import { type Action, BTN } from '../input';
import type { Game5Id } from './shelf5';

const board: Partial<Record<number, Action>> = { [BTN.A]: 'jump', [BTN.B]: 'use', [BTN.X]: 'fire', [BTN.START]: 'pause' };
export const GAMES5_PAD: Record<Game5Id, Partial<Record<number, Action>>> = {
  platform: { [BTN.A]: 'jump', [BTN.B]: 'run', [BTN.X]: 'run', [BTN.START]: 'pause' },
  cave: { [BTN.A]: 'jump', [BTN.X]: 'fire', [BTN.B]: 'use', [BTN.Y]: 'map', [BTN.START]: 'pause' },
  draughts: board,
  othello: board,
  backgammon: board,
  connect4: board,
};
