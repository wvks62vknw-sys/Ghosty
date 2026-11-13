/**
 * The catalogue's words for the two games of pass 6 in the ARCADE (BRIEF-GAMES-6), keyed as the arcade's registry items,
 * `arcade:<shelf id>`: poker (in chips only) and a word game of our own, each against a Ghosty he can lose to.
 */
import type { CatValue } from '../catalogue';

const base = { scene: ['playing' as const], cat: 'play' as const, go: { open: 'arcade' }, since: '2026-11-12' };

export const GAMES6_WORDS: Record<string, CatValue> = {
  'arcade:poker': {
    name: 'Play poker against me',
    line: 'You can play heads-up poker against me, twenty hands or a bust, in chips and never anything else.',
    more: 'I guess your hand from how you bet, work out my chances by dealing out the rest of the cards, and bluff a little more at every level. Ask for a hint and I say your chance as an estimate. Every hand is kept to read afterwards, and we each have a rating.',
    say: ['Play poker', 'Poker against you'],
    ...base,
  },
  'arcade:words': {
    name: 'Play a word game against me',
    line: 'You can play a word game of our own against me: tiles on a board, every word checked against my list.',
    more: 'Drag the tiles to squares and the score says its bonuses. A made-up word is refused at once. My word list is a one-off download on Wi-Fi, and I tell you its size first. We each have a rating, and I play short words at level 1.',
    say: ['A word game', 'Play a word game'],
    ...base,
  },
};
