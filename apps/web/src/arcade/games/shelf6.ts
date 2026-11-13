/**
 * The two games of pass 6 (BRIEF-GAMES-6) as shelf entries, merged into arcade/shelf.ts SHELF after CONNECT 4: POKER (heads-up
 * hold'em against Ghosty, in CHIPS ONLY) and WORDS (a word game of our own). No data to fetch (`data: null`, `madeByUs: true`),
 * so each card says PLAY at once; WORDS asks for its word list on his tap, on Wi-Fi, inside the game, with the size said first.
 * Each card ends in the two ratings, kept like the board games' (games/board/rating.ts).
 */
import type { Control, ShelfEntry } from '../shelf';
import { BOARD_IDS } from './shelf5';

export type Game6Id = 'poker' | 'words';
/** Every game that keeps a rating for you and one for Ghosty: the four board games and these two (the GYM's Report card lists all six). */
export const RATED_IDS = [...BOARD_IDS, 'poker', 'words'] as const;
export type RatedId = (typeof RATED_IDS)[number];

export interface MadeByUs6Entry extends Omit<ShelfEntry, 'engine' | 'data'> {
  engine: Game6Id;
  data: null;
  madeByUs: true;
}

export const GAMES6: MadeByUs6Entry[] = [
  {
    id: 'poker',
    title: 'POKER',
    line: 'Heads-up poker against Ghosty: twenty hands or a bust. Chips, never money.',
    engine: 'poker',
    data: null,
    madeByUs: true,
    controls: ['move', 'jump'] satisfies Control[],
    saves: true,
    since: '2026-11-12',
    ghosty: 'I work out my chances by dealing out the rest of the cards, and I guess your hand from how you bet. I bluff more at each level. Chips, never money.',
    done: 'Session over. Your rating and mine are kept, and so are the hands.',
  },
  {
    id: 'words',
    title: 'WORDS',
    line: 'A word game of our own: a 15 by 15 board, seven tiles, and every word checked against my list.',
    engine: 'words',
    data: null,
    madeByUs: true,
    controls: ['move', 'jump'] satisfies Control[],
    saves: true,
    since: '2026-11-12',
    ghosty: 'Drag tiles to squares, or tap a square and then a tile. A made-up word is refused at once. My list is a one-off download on Wi-Fi, and I say its size first.',
    done: 'Game over. Your rating and mine are kept.',
  },
];
