/**
 * THE EYE'S WORDS (BRIEF-EYE-HUD-2): the lines the eye says that no other world says, in one place the spec imports. One sentence each, in his voice,
 * pure (no document, no state). The other worlds' words are not here; "show me the eye" belongs to God's Eye (the first pass's decision, kept).
 */

/** The kick row of a room's wall: `Looking at Learn · 8 feeds` (the plural by the count). */
export const looking = (room: string, n: number): string => `Looking at ${room.charAt(0)}${room.slice(1).toLowerCase()} · ${n} ${n === 1 ? 'feed' : 'feeds'}`;

/** The stamp's own small line while the ground starts on a software GL (a phone's GPU is tens of ms and never shows it). */
export const LIGHTING = 'Lighting the ground…';

/** An ability on the wall, in his voice: the registry's own line already says it ("I can …", "I see through your camera …"); a line the brain wrote as "You can …" is his now. */
export const iCan = (line: string): string => line.replace(/\s+/g, ' ').trim().replace(/^You can /, 'I can ');

/** Home's ABILITIES feed's line on the wall ([planlane:home] whole words: a line that ends in "…" reads as a word cut short). */
export const ABILITIES_LINE = 'What I can do';

/** The abilities wall's kick row: `Looking at what I can do in Learn · 6 feeds`. */
export const lookingAbilities = (room: string, n: number): string => `Looking at what I can do${room ? ` in ${room.charAt(0)}${room.slice(1).toLowerCase()}` : ''} · ${n} ${n === 1 ? 'feed' : 'feeds'}`;

/** Offline, a feed that needs the signal says its last reading and how old it is, in one line; with none kept it says so. */
export const oldBy = (ms: number): string => {
  const m = Math.max(0, Math.round(ms / 60_000));
  return m < 1 ? 'a moment old' : m < 60 ? `${m} min old` : m < 1440 ? `${Math.round(m / 60)} h old` : `${Math.round(m / 1440)} d old`;
};
export const lastReading = (line: string, ms: number): string => `${line} · ${oldBy(ms)}`;
export const NO_READING = 'No reading yet. Needs a signal.';

/** The sharp feed's tag on a room's wall: why the eye is on it. */
export const WHY = { recent: 'Last used', starred: 'Starred', first: 'Start here', asked: 'Asked last' } as const;
