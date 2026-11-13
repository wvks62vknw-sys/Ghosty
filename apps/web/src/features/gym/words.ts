/**
 * THE GYM'S WORDS (BRIEF-QUALITY-LEARN): the lines the GYM says when training starts, stops or fails, when a game ends, and what a chess
 * rating is called, in his voice and with no DOM, so the spec reads the very words the page is built from. The training workers and
 * the ratings' maths are not touched: these are words and drawn states only.
 */

/** TRAIN tapped: said until the first results come back from the training. */
export const TRAIN_WAIT = 'Starting to train… my first results come in a moment.';

/** Training that stopped, said in words and never as a worker's own message. */
export const TRAIN_STOPPED = 'Training stopped on this phone. Tap TRAIN and I’ll start again.';
export const TRAIN_FAILED = 'Training stopped by itself. Tap TRAIN and I’ll try again.';
export const TRAIN_CANNOT = 'I can’t train on this phone just now. Close other apps, then tap TRAIN.';

/** A move I could not work out (the board is kept; the one way on). */
export const MOVE_FAILED = 'I couldn’t work out my move. Tap NEW GAME to start over.';

/** How a finished game is said: as that, and the key that follows it. */
export const overWords = (over: string): string => over.replace(/\bYou win\.$/, 'You beat me.').replace(/\bI win\.$/, 'I won this one.');
export const AGAIN = 'PLAY AGAIN';
export const NEW_GAME = 'NEW GAME';

/** A chess rating's word: what a number of that size is (the engine's own Elo labels are approximate, so the words are too). */
export function strengthWord(r: number): string {
  return r < 700 ? 'just starting' : r < 1000 ? 'a beginner' : r < 1300 ? 'a casual player' : r < 1700 ? 'club level' : r < 2000 ? 'strong club level' : r < 2300 ? 'a county-level player' : 'a master';
}

/** One side's rating with its word: "about 1,350 (club level)". */
export const sideWords = (r: number): string => `about ${r.toLocaleString('en-GB')} (${strengthWord(r)})`;

/** The chess card's line: both sides with their words, and how unsure it is, said plainly. */
export function chessLine(you: number | null, me: number | null, rd: number): string {
  const bits: string[] = [];
  if (you != null) bits.push(`You: ${sideWords(you)}`);
  if (me != null) bits.push(`Me: ${sideWords(me)}`);
  return bits.length ? `${bits.join(' · ')} · give or take ${rd}` : 'Not rated yet';
}

/** The chat phrase that opens the chess rating on the phone (the one local ask the GYM has), listed in one line. */
export const PHRASES = ['my chess rating'];
