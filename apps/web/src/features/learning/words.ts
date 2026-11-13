/**
 * LEARNING'S WORDS (BRIEF-QUALITY-LEARN): each pill's one-line helper (the rest behind "How it works", nothing lost), the streak lines and
 * the test of a typing passage, in his voice and with no DOM, so the spec reads the very words the page is built from. The packs' timers,
 * voices and pitch code are not touched: these are words and drawn states only.
 */

/** Each helper is one sentence that never repeats its pill's name; what was cut from it is under "How it works". */
export const WORDS_LINE = 'A starter set, typed in by hand, ten words a day: not a dictionary yet.';
export const WORDS_MORE = 'Sixty words in each of the eight languages, ten a day for six days, then round again.';
export const TYPING_LINE = 'Type the passage as fast as you can; only the right letters count.';
export const TYPING_MORE = 'The clock starts at your first key. Passages come from your own library when it has plain text.';
export const MATHS_LINE = 'A five-minute drill at your level.';
export const MATHS_MORE = 'Answer each sum and press ENTER; SKIP if you are stuck. It moves you up after two sets of 90%.';
export const FIRSTAID_LINE = 'Typed in from the NHS’s first-aid pages, not read live: in a real emergency call 999.';
export const MORE_KEY = 'How it works';

/** The passage being found (said when it takes more than a moment). */
export const PASSAGE_WAIT = 'Finding a passage for you…';

/** Nothing logged yet: the one next thing. */
export const NO_STREAK = 'Nothing logged yet. Finish a drill, or say “done typing 52”, and your first streak starts here.';

/** A run that ended, said without blame: what the best was, and the one way on. */
export function brokenRun(longest: number): string {
  return `Your run ended. Your best is ${longest} day${longest === 1 ? '' : 's'}: start a new one today.`;
}

/**
 * A passage fit to type: plain sentences. A line from a manual, a route list or notes (slashes, brackets, arrows, "=", a capitalised
 * word with a colon, a number glued to letters) is not, and the next one is tried; the built-in lines are the last resort.
 */
export function plainProse(s: string): boolean {
  const t = s.trim();
  if (t.split(/\s+/).length < 8) return false;
  if (/[\/\\{}\[\]()<>=→|_#@*&?;~^`]| - |\b[A-Z]{3,}\b:?|\b\w*\d\w*[a-z]\w*\b|\b[a-z]+\d+\b|:\s*[A-Z]/.test(t)) return false;
  return /^[A-Z]/.test(t) && /[.!?]$/.test(t);
}

/** The chat phrases that open LEARNING's pages on the phone (learningAsked answers them), listed in one line. */
export const PHRASES = ['ten Spanish words', 'first aid', 'typing test'];
