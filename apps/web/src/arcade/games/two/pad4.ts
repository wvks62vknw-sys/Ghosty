/**
 * The pass-4 games' buttons on a standard pad, read by input.ts PAD_BUTTONS (the d-pad and the left stick always move).
 * BLOCKS: A drops, B turns back, X or d-pad up turns, a bumper holds. BLAST: A picks and places the piece under the
 * cursor. THE FLAP: A or RT flaps. THE CLIMB: the stick steers, A is the jet. THE BEAT: A jumps, B ducks, X dashes.
 * START pauses all.
 */
import { type Action, BTN } from '../../input';
import type { Game4Id } from './shelf4';

export const GAMES4_PAD: Record<Game4Id, Partial<Record<number, Action>>> = {
  blocks: { [BTN.A]: 'jump', [BTN.B]: 'use', [BTN.X]: 'fire', [BTN.RB]: 'run', [BTN.LB]: 'run', [BTN.START]: 'pause' },
  blast: { [BTN.A]: 'jump', [BTN.B]: 'use', [BTN.X]: 'fire', [BTN.START]: 'pause' },
  flap: { [BTN.A]: 'jump', [BTN.RT]: 'jump', [BTN.B]: 'jump', [BTN.START]: 'pause' },
  climb: { [BTN.A]: 'jump', [BTN.RT]: 'jump', [BTN.START]: 'pause' },
  beat: { [BTN.A]: 'jump', [BTN.B]: 'use', [BTN.X]: 'fire', [BTN.START]: 'pause' },
};
