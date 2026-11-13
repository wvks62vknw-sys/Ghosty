/**
 * HOUSE'S WORDS (BRIEF-QUALITY-MAKE): the lines the house screen says in his voice, in one place and with no DOM, so the spec reads the
 * very words the page is built from. Locks, alarms, gates and garage doors still ask his confirm on every tap; that is not touched.
 */

/** Linked, and nothing in it yet: the one next thing. */
export const HOUSE_NONE = { head: 'Nothing in your house yet.', line: 'Add your lights and heating in Home Assistant, then tap REFRESH.' };

/** Not linked yet: what that means, before the steps. */
export const NOT_LINKED_HEAD = 'Your Home Assistant isn’t linked yet. Five steps, all free, and your lights, heating and the rest are here:';

/** The house being read. */
export const READING = 'Reading your house…';

/** My brain out of reach (the house is reached through it). */
export const BRAIN_OUT = 'I can’t reach my brain right now, so I can’t reach your house.';

/** My brain out of reach with a house already read: what is shown is what I last saw. */
export const BRAIN_STALE = 'I can’t reach my brain right now, so this is your house as I last saw it.';

/** His box out of reach with a house already read: the last read stays up, said as that. */
export const BOX_STALE = 'This is your house as I last saw it.';

/** Under the scenes: what a tap does, and what still asks. */
export const SCENES_NOTE = 'Your own scenes and scripts from Home Assistant: a tap runs one. A scene that sets a lock, the alarm or a garage door asks your confirm first.';

/** Where his pinned things are kept (on this phone, his own). */
export const PINS_KEY = 'ghosty.house.pins';

/** The chat phrases that work for the house, listed in one line. */
export const PHRASES = ['the house', 'how’s the house', 'which lights are on?', 'turn everything off in the kitchen', 'what’s the temperature inside?', 'is anything open?'];
