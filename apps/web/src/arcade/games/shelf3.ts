/**
 * The three games that followed the block world and the runner (BRIEF-GAMES-3), as shelf entries merged into
 * arcade/shelf.ts SHELF at merge time beside GAMES2: no data to fetch (`data: null`, `madeByUs: true`), so each card
 * says PLAY at once. Our own look and names only: "the kart racer", "the hopper" and "the arena".
 */
import type { Control, ShelfEntry } from '../shelf';
import type { Game3Id } from './kit';

/** A shelf entry for a game made here: no data, its own engine. */
export interface MadeByUs3Entry extends Omit<ShelfEntry, 'engine' | 'data'> {
  engine: Game3Id;
  data: null;
  madeByUs: true;
}

export const KART_ID = 'kart-racer';
export const HOPPER_ID = 'hopper';
export const ARENA_ID = 'arena';
/** Ghosty's own bests, through scores.ts: the hopper's rows (his line across the road) and the arena's mass (his ring). */
export const HOPPER_GHOSTY_ID = 'hopper.ghosty';
export const ARENA_GHOSTY_ID = 'arena.ghosty';
/** The kart racer's lap records live in scores.ts per track, his and Ghosty's (kart/records.ts). */
export const KART_LAP_PREFIX = 'kart-racer.lap.';
export const KART_GHOSTY_LAP_PREFIX = 'kart-racer.ghosty.';

export const GAMES3: MadeByUs3Entry[] = [
  {
    id: KART_ID,
    title: 'THE KART RACER',
    line: 'Karts against Ghosty and two of his bots: a seaside loop, a mountain pass, a city at night.',
    engine: 'kart',
    data: null,
    madeByUs: true,
    controls: ['move', 'fire', 'jump'] satisfies Control[],
    saves: false,
    since: '2026-11-01',
    ghosty: 'Hold a drift through the bend and let go for a boost. I take the inside line, so watch your mirrors.',
    done: 'Race over. Your lap records are kept for each track.',
  },
  {
    id: HOPPER_ID,
    title: 'THE HOPPER',
    line: 'Hop across roads, rivers and railways, one row at a time, ahead of the fog.',
    engine: 'hopper',
    data: null,
    madeByUs: true,
    controls: ['move', 'jump'] satisfies Control[],
    saves: true,
    since: '2026-11-01',
    ghosty: 'Tap to hop, swipe to sidestep. Ride the logs, never the water, and do not stand still: the fog is coming.',
    done: 'Squashed? Again. Your coins and hoppers are kept.',
  },
  {
    id: ARENA_ID,
    title: 'THE ARENA',
    line: 'Eat or be eaten: steer a glowing cell, grow, split and outsmart twelve of Ghosty\'s bots.',
    engine: 'arena',
    data: null,
    madeByUs: true,
    controls: ['move', 'fire', 'use'] satisfies Control[],
    saves: false,
    since: '2026-11-01',
    ghosty: 'Eat what is smaller, run from what is bigger, and stay away from the spiky ones once you are big.',
    done: 'Round over. Three minutes, one arena, and my bots are learning.',
  },
];
