/**
 * THE BOOT'S WORDS (BRIEF-QUALITY-BOOT-ORB 4): every line the boot cinematic shows that is not a fact read from the phone, as pure
 * functions with no screen in them, so shell/boot.ts and tests/bootpass.spec.mjs share one source. Each is one sentence, in his voice.
 */

/** The app could not start (shell/boot.ts bootFault): what happened and the next thing, and a tap anywhere on it does it. */
export const FAULT_WORDS = 'I couldn’t start this time. Tap to try again.';

/** The part of the day a greeting names: before 5 am it is still the night, as Home's own line says. */
export const dayPart = (hr: number): string => (hr < 5 ? 'Good night' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening');

/**
 * His greeting: "Good evening, Tony." with the name he saved, "Good evening." with none. "Boss" is the name the app starts with, not one he
 * chose, so it is never said as if it were his.
 */
export function greetingFor(name: string, hr: number): string {
  const n = name.trim();
  return n && n.toLowerCase() !== 'boss' ? `${dayPart(hr)}, ${n}.` : `${dayPart(hr)}.`;
}

/** What the open is waiting for when the landing is held: no signal, the brain not answered yet, or only the app. One sentence. */
export function holdWords(f: { online: boolean; brain: boolean | null }): string {
  if (!f.online) return 'Still starting, waiting for a signal.';
  if (f.brain === null) return 'Still starting, waiting for my brain.';
  return 'Still starting, a moment more.';
}

/** The hold's line shows once the landing has been held this long, ms (the feel of a stall is a second and a half). */
export const HOLD_AFTER = 1000;

/**
 * The stamp's feeds word, settled: while the guardian has not answered the line says CHECKING FEEDS, but only until the recognition (the
 * storyboard's time for it); after that an unanswered guardian is "No feeds yet", which is true, and the line stops holding.
 */
export function settledFeeds<T extends { watching: number | null; offline?: boolean }>(f: T, pastRecognition: boolean): T {
  return f.watching === null && !f.offline && pastRecognition ? { ...f, watching: 0 } : f;
}
