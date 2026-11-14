/**
 * ANAGRAM (the unscramble-the-letters genre, against the clock). Options the board reads from GameConfig.options:
 *   words: string[] (the words to draw from; default the built-in five-letter list)
 *   secs:  number (seconds a round lasts, 30 to 300, default 90)
 * The letters are shuffled so they never spell the word itself. Each word solved is worth 10 points a letter; SKIP costs 5.
 */
import { type Rng, shuffle } from './rng';

export function scramble(word: string, r: Rng): string {
  const w = word.toLowerCase();
  if (new Set(w).size < 2) return w;
  for (let k = 0; k < 20; k++) {
    const s = shuffle(r, [...w]).join('');
    if (s !== w) return s;
  }
  return [...w].reverse().join('');
}

/** Any arrangement of the same letters that is in the word list counts (two words can share letters). */
export function accepts(guess: string, word: string, words: readonly string[]): boolean {
  const g = guess.toLowerCase().trim();
  const sorted = (x: string) => [...x].sort().join('');
  return g === word.toLowerCase() || (sorted(g) === sorted(word.toLowerCase()) && words.includes(g));
}

export const points = (word: string): number => word.length * 10;
export const SKIP_COST = 5;
