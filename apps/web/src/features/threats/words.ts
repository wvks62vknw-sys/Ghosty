/**
 * THREATS' WORDS (BRIEF-QUALITY-SEE): when a row is from and which feed said so, the empty and the offline lines, in his voice.
 * Pure, with no DOM, so the spec reads the very words the page is built from.
 */

/** A moment as people say it: "just now", "12 minutes ago", "1 hour ago", "3 days ago". */
export function agoWords(at: number, now = Date.now()): string {
  const m = Math.max(0, Math.floor((now - at) / 60_000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} ${m === 1 ? 'minute' : 'minutes'} ago`;
  const h = Math.round(m / 60);
  if (m < 1440) return `${h} ${h === 1 ? 'hour' : 'hours'} ago`;
  const d = Math.round(m / 1440);
  return `${d} ${d === 1 ? 'day' : 'days'} ago`;
}

/** Which public feed a signal came from, said as a source word. */
export const feedOf = (kind: string): string => (kind === 'QUAKE' ? 'the USGS feed' : 'NASA’s feed');

/** One row's when: "12 minutes ago, from the USGS feed". */
export const whenWords = (kind: string, at: number, now = Date.now()): string => `${agoWords(at, now)}, from ${feedOf(kind)}`;

/** The list is empty and the feeds answered: nothing to worry about, said as that. */
export const NOTHING = { head: 'Nothing serious anywhere right now.', line: 'I look again by myself every few minutes.' };

/** No signal: the list is what the phone kept, and when that was ("09:40"). */
export const offlineWords = (at: number): string => `No signal; this is from ${at ? new Date(at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'before the phone lost it'}.`;

/** NEAR HOME with no saved places: the one next thing. */
export const NO_PLACES = 'I’m not watching any place yet. Save your home in Memory, then PLACES, and I’ll look there every hour.';
