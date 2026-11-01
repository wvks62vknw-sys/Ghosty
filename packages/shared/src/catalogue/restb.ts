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
  'phrase:tuner': {
    name: 'Tune a string by microphone', line: 'You can tune a guitar, bass, ukulele or violin: I hear the note and show how many cents off it is.',
    more: 'Press START and pluck a string: a needle shows how sharp or flat it is, to the nearest cent, from this phone\'s microphone. It also reads any single note, so you can ask "am I in tune?" of a voice. It works with no signal, hears one note at a time, and keeps no recording.',
    say: ['Tune my guitar', 'Am I in tune?'], scene: ['playing', 'phone'], cat: 'play', needs: ['mic'], since: SINCE,
    go: { ask: 'Tune my guitar', send: true }, tryText: 'Opens the tuner',
  },
  'phrase:coach': {
    name: 'Lessons for guitar, piano, voice', line: 'You can learn the first steps of guitar, piano or singing with me: I listen and say what came in right.',
    more: 'Ten lessons of our own for each: chords one note at a time, scales, a riff, a strum, a held note. A click keeps time and the microphone hears whether the right notes came in order and on the beat. It cannot see your fingers or tell an up-strum from a down-strum. Your streak and what to practise next stay on this phone.',
    say: ['Teach me guitar', 'Coach me'], scene: ['school', 'playing'], cat: 'learn', needs: ['mic'], since: SINCE,
    go: { ask: 'Teach me guitar', send: true }, tryText: 'Opens the lessons',
  },
  'phrase:skill': {
    name: 'Typing, drawing and words practice', line: 'You can practise typing, get a drawing prompt, or hear and say ten words a day in Spanish, French, German or Italian.',
    more: 'Typing counts your words a minute and your accuracy and names the keys you miss. The drawing prompt changes daily and your picture goes beside it; I do not mark drawings. The ten words are read by this phone\'s voice and I check what I hear you say back. Juggling and tricks by camera are not in, and I say so.',
    say: ['Typing test', 'What should I draw?', 'Spanish word of the day'], scene: ['school', 'phone'], cat: 'learn', since: SINCE,
    go: { ask: 'Typing test', send: true }, tryText: 'Opens the typing test',
  },
};
