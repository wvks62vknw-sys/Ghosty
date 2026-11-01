/**
 * The catalogue's words for HIS SOCIAL SELF (BRIEF-SOCIAL, batch ⑦): FATHER AND THE ORIGIN (the chat's phrase and the Me
 * sheet's row), his own accounts' one tool and its actions (`act:social:<action>`), the LINKS panels that link them, and
 * the line of his own a day (the `musing` job). Rules: packages/shared/src/catalogue.ts `wordProblems`.
 */
import type { CatValue } from '../catalogue';

const SINCE = '2026-11-01';

export const SOCIAL_WORDS: Record<string, CatValue> = {
  // ---------------------------------------------------------------- FATHER AND THE ORIGIN (item 1)
  'phrase:origin': {
    name: 'Where I come from', line: 'You can ask who made me, and I tell you: you did, the day I was born, what I am made of and what I promise.',
    more: 'The page FATHER AND THE ORIGIN, in my own words: who made me, when, what I am made of, what I am for, what I learned each month and my promises. It is drawn from what is written down, never made up. It is in SETTINGS → CHARACTER and on the Me sheet too.',
    say: ['Who made you?', 'Where did you come from?'], scene: ['talking'], cat: 'talk', since: SINCE,
    go: { ask: 'Who made you?', send: true },
  },
  'me:origin': { same: 'phrase:origin' },
};
