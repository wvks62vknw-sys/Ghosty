/**
 * The two games made by us, as shelf entries (merged into arcade/shelf.ts SHELF at merge time). They have no data
 * files to fetch (`data: null`, `madeByUs: true`): their engines are their games, so the card says PLAY at once, with
 * no GET, no size and nothing to delete. Our own look and names only: "the block world" and "the runner".
 */
import { BTN, type Action } from '../input';
import type { Control, ShelfEntry } from '../shelf';
import type { GameId } from './kit';

/** A shelf entry for a game made here: no data, its own engine. */
export interface MadeByUsEntry extends Omit<ShelfEntry, 'engine' | 'data'> {
  engine: GameId;
  data: null;
  madeByUs: true;
}

export const BLOCK_WORLD_ID = 'block-world';
export const RUNNER_ID = 'runner';
/** Where the GYM will keep Ghosty's own best run (metres), through scores.ts: the runner shows it as a marker. */
export const RUNNER_GHOSTY_ID = 'runner.ghosty';

export const GAMES2: MadeByUsEntry[] = [
  {
    id: BLOCK_WORLD_ID,
    title: 'THE BLOCK WORLD',
    line: 'A world of blocks to dig, build and wander, day into night.',
    engine: 'voxel',
    data: null,
    madeByUs: true,
    controls: ['move', 'look', 'jump', 'fire', 'use'] satisfies Control[],
    saves: true,
    since: '2026-11-01',
    ghosty: 'Hills, caves and lakes from a seed. Tell me "a big stone castle" and I will build it beside you.',
    done: 'Saved. Every block you changed is kept for next time.',
  },
  {
    id: RUNNER_ID,
    title: 'THE RUNNER',
    line: 'Three lanes through a city at dawn, a shadow at your heels.',
    engine: 'runner',
    data: null,
    madeByUs: true,
    controls: ['move', 'jump'] satisfies Control[],
    saves: false,
    since: '2026-11-01',
    ghosty: 'Swipe to dodge, jump and roll. The shadow catches you on the second stumble, so make the first one count.',
    done: 'Caught. Again?',
  },
];

/**
 * Each game's buttons on a standard pad, for input.ts PAD_BUTTONS (the d-pad and left stick always move: the
 * runner turns them into lane changes, a jump and a roll). The block world: A jumps (and flies up), RT digs, LT
 * places, the bumpers pick the block, Y opens BUILD. The runner: A jumps, B rolls.
 */
export const GAMES2_PAD: Record<GameId, Partial<Record<number, Action>>> = {
  voxel: { [BTN.A]: 'jump', [BTN.RT]: 'fire', [BTN.LT]: 'use', [BTN.X]: 'use', [BTN.RB]: 'weapon', [BTN.LB]: 'weaponPrev', [BTN.Y]: 'map', [BTN.START]: 'pause' },
  runner: { [BTN.A]: 'jump', [BTN.B]: 'use', [BTN.X]: 'use', [BTN.START]: 'pause' },
};
