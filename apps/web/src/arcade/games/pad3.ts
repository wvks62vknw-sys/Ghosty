/**
 * The three games' buttons on a standard pad, spread into input.ts PAD_BUTTONS at merge time (the d-pad and the left
 * stick always move: the kart steers with them and brakes when pulled back, the hopper hops with them, the arena's cell
 * heads where they point).
 *
 * THE KART RACER: A or RT accelerates (when he chose to hold a button for it), B or LT brakes, RB or X drifts, LB or Y
 * uses the item. THE HOPPER: A hops forward, B hops back. THE ARENA: A or RT splits, B or LT ejects. START pauses all.
 */
import { type Action, BTN } from '../input';
import type { Game3Id } from './kit';

export const GAMES3_PAD: Record<Game3Id, Partial<Record<number, Action>>> = {
  kart: { [BTN.A]: 'run', [BTN.RT]: 'run', [BTN.B]: 'use', [BTN.LT]: 'use', [BTN.RB]: 'jump', [BTN.X]: 'jump', [BTN.LB]: 'fire', [BTN.Y]: 'fire', [BTN.START]: 'pause' },
  hopper: { [BTN.A]: 'jump', [BTN.B]: 'use', [BTN.START]: 'pause' },
  arena: { [BTN.A]: 'fire', [BTN.RT]: 'fire', [BTN.B]: 'use', [BTN.LT]: 'use', [BTN.START]: 'pause' },
};
