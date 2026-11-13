/**
 * SETTINGS' pages' words, pure (the spec imports this file): each switch says what it does and what changes when it is off, the faces
 * page with none says the rule, and the long paragraphs are cut to one sentence with their fact kept behind a "?".
 */
/** A switch's helper: what it does, then what changes when it is off, in his voice (one line). */
export const switchLine = (does: string, off: string): string => `${does.replace(/\.$/, ';')} off, ${off}`;

export const SWITCHES = {
  barge: switchLine('I stop when you talk over me.', 'only a tap stops me.'),
  live: switchLine('I ask for a blink or a head turn before I save a face.', 'I save it without.'),
  share: switchLine('My last known position goes with a walk’s message.', 'only the words go.'),
};

/** Faces with none: the people rule's own line. */
export const FACES_NONE = 'None yet: I only know you and people you introduce, and I never identify a stranger.';
export const FACES_ERROR = 'I can’t read the faces on this phone just now; close Ghosty and open it again.';

export const PRINCIPLES_EMPTY = 'Nothing here yet: add a line I should hold to, in your own words.';
export const PRINCIPLES_LOADING = 'Reading your lines…';
export const PRINCIPLES_ERROR = 'I can’t reach my brain, so these lines may be old, and they update when I can.';

/** A paragraph cut to one sentence, with the rest behind its "?". */
export interface Cut {
  short: string;
  more: string;
}
export const GUARDIAN: Record<'intro' | 'panic' | 'limits' | 'people', Cut> = {
  intro: { short: 'If you don’t answer on a walk home, or say your panic phrase, I message one person.', more: 'By Telegram once they’ve opened your bot with the invite, or from your own email. Never a text: those cost money.' },
  panic: { short: 'Say or type your phrase, here or on Telegram, and I message them at once.', more: 'With where you are when I have it. I keep only a scrambled copy, never the words.' },
  limits: { short: 'I only know where you are while I’m open, on a walk you started.', more: 'And only after you said yes once. The check-in runs on my brain, so “Home?” comes even if your phone is asleep.' },
  people: { short: 'Tell me in the chat, “my dad’s car is RX15 KNG”, and it goes under them here.', more: 'Only yours and the people you introduce. A plate gives the car’s public record, never anything about who keeps it.' },
};

/** The voice page's tip about the phone's own voices, in a line. */
export const IOS_TIP = 'An iPhone has free natural British voices. Settings, Accessibility, Spoken Content, Voices, English, then Serena (Premium) or Daniel (Enhanced).';
export const NO_LISTEN = 'This browser gives me no way to listen for a voice; open Ghosty from the Home Screen on your phone.';
