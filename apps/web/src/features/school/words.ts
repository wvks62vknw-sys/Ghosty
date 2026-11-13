/**
 * SCHOOL'S WORDS (BRIEF-QUALITY-LEARN): the ladder's line, a paper's progress with the time left, a failed paper's "what to read", and
 * the offline brain not kept (with its size), in his voice and with no DOM, so the spec reads the very words the page is built from.
 * Papers and their marking are the offline brain's, and are not touched: these are words and drawn states only.
 */

/** What unlocks the next stage, in one line. */
export const LADDER_LINE = 'The next stage opens when every subject here has top grades.';
/** The rest of what the ladder says, kept behind "How the ladder works" (nothing lost). */
export const LADDER_MORE = 'Strictly in order: a stage opens only when the one below is passed with top grades in every subject. A placement test can skip ahead.';
export const LADDER_KEY = 'How the ladder works';

/**
 * The time left on a paper being sat: from how long the questions already answered took. Said as "about 4 min left", and not at all until
 * two questions are done (one is not enough to know). `n` is the question being answered now, `n0` the first one seen this sitting.
 */
export function timeLeft(n: number, n0: number, of: number, elapsedMs: number): string {
  const done = n - n0;
  if (done < 2 || !of || n > of || elapsedMs <= 0) return '';
  const sec = Math.round(((elapsedMs / done) * (of - n + 1)) / 1000);
  return sec < 45 ? 'under a minute left' : `about ${Math.max(1, Math.round(sec / 60))} min left`;
}

/** A paper not passed: what to read, from the topics that lost him the most marks (nothing when no topic lost any). */
export function whatToRead(topics: Record<string, { got: number; max: number }>): string {
  const worst = Object.entries(topics)
    .filter(([, t]) => t.max > 0 && t.got < t.max)
    .sort((a, b) => (a[1].got / a[1].max) - (b[1].got / b[1].max) || b[1].max - a[1].max)
    .slice(0, 2)
    .map(([k]) => k);
  return worst.length ? `Not top grades yet. Read up on ${worst.join(' and ')} next.` : '';
}

/** The offline brain not on this phone: what to do, with its size, said before the tap (the download rule is the Settings page's). */
export const notKept = (size: string): string => `With no signal I sit papers on the offline brain, and it isn’t on this phone yet. Get it in Settings, Offline brain: ${size}, on Wi-Fi.`;

/** The chat words that open this screen, answered on the phone with no model (assistant/screenasks.ts). */
export const PHRASES = ['open school'];
