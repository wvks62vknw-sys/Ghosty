/**
 * TYPING (the type-the-passage-for-speed genre). Options the board reads from GameConfig.options:
 *   passages: string[] (the lines to type; default a built-in set of plain sentences)
 *   secs:     number (a timed run, 15 to 300 seconds, default 60)
 * Speed is in words a minute, counted the standard way (five characters a word, correct characters only), and
 * accuracy is the share of characters typed right.
 */
import { pick, rng } from './rng';

export const PASSAGES = [
  'The kettle clicked off just as the rain began to drum on the kitchen window.',
  'A quiet path ran along the river, past the old mill and the field of tall grass.',
  'She packed a map, a flask of tea and a warm jumper before setting off for the hills.',
  'Every morning the baker opened the shutters and the smell of fresh bread filled the street.',
  'The train slowed as it crossed the bridge, and the whole valley opened out below.',
  'He planted a row of beans by the fence and watered them each evening after work.',
  'Bright kites danced over the beach while the tide crept slowly up the sand.',
  'The library was warm and still, with only the soft turn of pages to be heard.',
];

export const passage = (list: readonly string[], seed: number): string => pick(rng(seed), list.length ? list : PASSAGES);

export interface TypingResult {
  correct: number;
  typed: number;
  wpm: number;
  accuracy: number;
}

/** Compare what he typed with the target, over the seconds taken. */
export function result(target: string, typed: string, secs: number): TypingResult {
  let correct = 0;
  for (let i = 0; i < typed.length; i++) if (typed[i] === target[i]) correct++;
  const mins = Math.max(secs, 1) / 60;
  return { correct, typed: typed.length, wpm: Math.round(correct / 5 / mins), accuracy: typed.length ? Math.round((correct / typed.length) * 100) : 100 };
}
