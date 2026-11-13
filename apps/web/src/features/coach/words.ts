/**
 * THE COACH'S WORDS (BRIEF-QUALITY-LEARN): the tuner's one-line helper, its note with the cents and the word, the microphone refused (as the
 * camera and the GPS say it: Settings, Ghosty, Microphone) and the words-of-the-day line, in his voice and with no DOM, so the spec reads the
 * very words the page is built from. The microphone's rule, the timers, the voices and the pitch code are not touched: words and states only.
 */

/** The tuner's helper: one sentence (the rest of what it says is under "How it listens"). */
export const TUNER_LINE = 'I hear one note at a time, on this phone only: nothing is recorded or sent.';
export const TUNER_MORE = 'The note and how far off it is, to the nearest cent. It works with no signal. A chord, or two strings at once, will not read.';
export const TUNER_MORE_KEY = 'How it listens';

/** The microphone refused: the one way to allow it, as the Lens says it. */
export const MIC_REFUSED = 'The phone would not give me the microphone. Settings, Ghosty, Microphone, then press START.';

/** How far off a note is, with its unit and its word: "12 cents, a little flat". Inside 5 cents it is in tune. */
export function centsWords(off: number, inTune: boolean): string {
  if (inTune) return 'in tune';
  const n = Math.round(Math.abs(off));
  const size = n < 15 ? 'a little ' : n >= 35 ? 'a lot ' : '';
  return `${n} cent${n === 1 ? '' : 's'}, ${size}${off > 0 ? 'sharp' : 'flat'}`;
}

/** The words of the day: a table written in, said in one plain line (the rest is under "How it works"). */
export const WORDS_LINE = 'A starter set, typed in by hand, ten words a day: not a dictionary yet.';
export const WORDS_MORE = 'Forty words in each of four languages, round again every four days.';
export const MORE_KEY = 'How it works';

/** The chat phrases that open the tuner on the phone (coachAsked answers them), listed in one line. */
export const PHRASES = ['tune my guitar', 'am I in tune', 'typing test'];
