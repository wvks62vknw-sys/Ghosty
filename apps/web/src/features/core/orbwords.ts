/**
 * THE ORB'S WORDS (BRIEF-QUALITY-BOOT-ORB 4): what is said once under the orb, as pure words with no screen in them, so features/core/orbsay.ts
 * and tests/bootpass.spec.mjs share one source (and the chat's talk bar says the same states in the same words). One sentence each.
 */

/** The states the orb says in words (idle says nothing: the breath is the word). */
export type OrbSaid = 'listening' | 'attending' | 'thinking' | 'speaking' | 'busy';

/** Said once, the first time he sees each state (saved on the phone). */
export const STATE_WORDS: Record<OrbSaid, string> = {
  listening: 'I’m listening.',
  attending: 'I’m looking at that.',
  thinking: 'I’m thinking.',
  speaking: 'I’m answering.',
  busy: 'I’m busy with something you started.',
};

/** The brain cannot be reached: the orb goes low, and says why (no signal, or the brain itself not answering). One sentence. */
export const offlineWords = (online: boolean): string => (online ? 'I can’t reach my brain, so I’m resting.' : 'There’s no signal, so I’m resting.');

/** Every model is cooling down: the pulses slow, and the time the first is back is said. */
export const coolingWords = (at: string): string => `My models are cooling down; the first is back at ${at}.`;

/** The first press on the orb, once: the other way to every room. */
export const PRESS_HINT = 'The house line below reaches every room.';

/** Heavy mode (a paper being sat on the phone's brain): the orb holds one still frame, and says why once. */
export const HEAVY_WORDS = 'I’m holding still while I work on your paper.';

/** How long a word under the orb stays, ms. */
export const SAY_MS = 6000;
