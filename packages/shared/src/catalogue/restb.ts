/**
 * The catalogue's words for BATCH 8 PART B (BRIEF-REST-B): chess with a real rating, the instrument and skills coach, and
 * the review link. Each key is a registry item the code runs on (the phone's phrases in assistant/phrases.ts LOCAL_ASKS,
 * `phrase:<id>`); rules: packages/shared/src/catalogue.ts `wordProblems`.
 */
import type { CatValue } from '../catalogue';

const SINCE = '2026-11-01';

export const RESTB_WORDS: Record<string, CatValue> = {
  'phrase:chessrating': {
    name: 'Your chess rating and mine', line: 'You can ask me your chess rating and mine, from real games against a chess engine that runs on this phone.',
    more: 'In the GYM, CHESS has RATED GAME: you play a real engine at a level of known strength, and a rating follows from the results, with how unsure it is. RATE ME makes me play the same levels, so I have one too. After a game I can show where you lost ground, in plain words. The engine\'s strengths are approximate, so the ratings are too.',
    say: ['What\'s my chess rating?', 'Rated chess'], scene: ['playing'], cat: 'play', since: SINCE,
    go: { ask: 'What\'s my chess rating?', send: true }, tryText: 'Tells you both ratings',
  },
};
