/**
 * HANGMAN (the guess-the-letters-before-the-misses-run-out genre; drawn as a fading lamp, not a gallows).
 * Options the board reads from GameConfig.options:
 *   words:  string[] (the words to draw from; letters and spaces; default a built-in list of common words)
 *   misses: number (wrong letters allowed, 4 to 10, default 7)
 */
import { pick, rng } from './rng';
import { WORDS5 } from './wordguess';

export const WORDS_LONG = (
  'adventure backpack balcony bicycle blanket butterfly calendar campfire caravan castle ceiling chimney compass ' +
  'cupboard daffodil dolphin elephant envelope festival fireworks fountain gardener giraffe glacier harbour ' +
  'hedgehog horizon island jigsaw kangaroo kettle lantern library lighthouse marmalade meadow mountain notebook ' +
  'octopus orchard paintbrush pancake parachute penguin pineapple postcard pyramid rainbow sandcastle seashell ' +
  'snowflake spaceship squirrel staircase strawberry sunflower telescope thunder treasure umbrella valley ' +
  'volcano waterfall whistle windmill woodland'
).split(' ');

export interface Hangman {
  word: string;
  guessed: string[];
  misses: number;
  max: number;
}

export function start(words: readonly string[], max: number, seed: number): Hangman {
  const pool = words.length ? words : [...WORDS_LONG, ...WORDS5.slice(0, 80)];
  return { word: pick(rng(seed), pool).toLowerCase(), guessed: [], misses: 0, max };
}

/** Guess a letter: 'hit', 'miss' or '' (already tried or not a letter). */
export function guess(h: Hangman, ch: string): '' | 'hit' | 'miss' {
  const c = ch.toLowerCase();
  if (!/^[a-z]$/.test(c) || h.guessed.includes(c) || state(h) !== 'play') return '';
  h.guessed.push(c);
  if (h.word.includes(c)) return 'hit';
  h.misses++;
  return 'miss';
}

/** The word as shown: found letters, an underscore for each hidden one, spaces kept. */
export const shown = (h: Hangman): string => [...h.word].map((c) => (c === ' ' || h.guessed.includes(c) ? c : '_')).join('');
export const state = (h: Hangman): 'play' | 'won' | 'lost' =>
  h.misses >= h.max ? 'lost' : [...h.word].every((c) => c === ' ' || h.guessed.includes(c)) ? 'won' : 'play';
export const score = (h: Hangman): number => (state(h) === 'won' ? (h.max - h.misses) * 50 + new Set(h.word.replace(/ /g, '')).size * 10 : 0);
