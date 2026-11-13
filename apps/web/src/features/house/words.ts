/**
 * HOUSE'S WORDS (BRIEF-QUALITY-MAKE): the lines the house screen says in his voice, in one place and with no DOM, so the spec reads the
 * very words the page is built from. Locks, alarms, gates and garage doors still ask his confirm on every tap; that is not touched.
 */

/** Linked, and nothing in it yet: the one next thing. */
export const HOUSE_NONE = { head: 'Nothing in your house yet.', line: 'Add your lights and heating in Home Assistant, then tap REFRESH.' };

/** The house being read. */
export const READING = 'Reading your house…';

/** My brain out of reach (the house is reached through it). */
export const BRAIN_OUT = 'I can’t reach my brain right now, so I can’t reach your house.';

/** My brain out of reach with a house already read: what is shown is what I last saw. */
export const BRAIN_STALE = 'I can’t reach my brain right now, so this is your house as I last saw it.';

/** The chat phrases that open the house on the phone, listed in one line. */
export const PHRASES = ['the house', 'how’s the house'];
