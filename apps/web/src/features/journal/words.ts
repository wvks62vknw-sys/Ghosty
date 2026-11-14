/**
 * JOURNAL's words in his voice (features/journal), pure: the spec imports this file. One sentence a line where it stands alone.
 * The prompts are classic journalling questions, written here in plain words (public, free to use).
 */
export const J = {
  TITLE: 'JOURNAL',
  SUB: 'Your own words, kept on this phone.',
  NEW: 'NEW ENTRY',
  WRITE_HINT: 'What’s on your mind?',
  PROMPT_KEY: 'GIVE ME A PROMPT',
  SAVE: 'SAVE',
  SAVED: 'Saved on this phone.',
  NO_ROOM: 'This phone has no room left to keep it: free some space, then SAVE again.',
  DELETE: 'DELETE',
  DELETED: 'Moved to Recently deleted.',
  RESTORED: 'Back in your journal.',
  EMPTY_HEAD: 'Nothing written yet',
  EMPTY_NEXT: 'Tap NEW ENTRY, or ask for a prompt when the page is blank.',
  NO_HIT: (q: string) => `Nothing you wrote matches “${q.slice(0, 40)}”.`,
  SAMPLES: 'These three are examples, so you can see how it looks.',
  CLEAR_SAMPLES: 'CLEAR SAMPLES',
  TOUR: ['Write, add a photo or a voice note, and pick a mood.', 'Look back on the calendar and On this day.', 'Lock it with Face ID in Settings below.'],
  TOUR_OK: 'GOT IT',
  STREAK: (n: number) => (n ? `${n} day${n === 1 ? '' : 's'} in a row` : 'Write today to start a streak'),
  OTD_EMPTY: 'Nothing from this day in earlier weeks, months or years yet.',
  PLACES_EMPTY: 'Add a place to an entry and it gathers here.',
  CAL_EMPTY: 'No entries this month.',
  BIN_EMPTY: 'Recently deleted is empty.',
  LOCKED_HEAD: 'Your journal is locked',
  LOCKED_NEXT: 'Unlock it with Face ID or Touch ID.',
  UNLOCK: 'UNLOCK',
  UNLOCK_FAIL: 'It didn’t open. Try again, or use your passcode when your phone asks.',
  LOCK_ON: 'LOCK WITH FACE ID',
  LOCK_OFF: 'TURN THE LOCK OFF',
  LOCK_NONE: 'This phone can’t make a passkey here, so the journal can’t be locked on it.',
  LOCK_SET: 'Locked: Face ID or Touch ID opens your journal from now on.',
  LOCK_CLEARED: 'The lock is off.',
  REMIND_LINE: (t: string) => (t ? `A gentle nudge at ${t} each day, through my brain (the words never leave your phone).` : 'No daily nudge.'),
  REMIND_OFFLINE: 'I can’t reach my brain to set the nudge; try again when you’re online.',
  EXPORT: 'EXPORT THIS YEAR AS A BOOK',
  EXPORT_NONE: 'Nothing written this year yet.',
  VOICE_REC: 'RECORD A VOICE NOTE',
  VOICE_STOP: 'STOP',
  VOICE_NONE: 'This phone won’t let me use the microphone here.',
  PHOTO: 'ADD PHOTOS',
  PHOTO_FAIL: 'That photo couldn’t be read.',
  PLACE_HINT: 'Where were you? (a saved place or your words)',
  MOODS: ['Awful', 'Low', 'Okay', 'Good', 'Great'] as const,
  BIN: 'RECENTLY DELETED',
  RESTORE: 'RESTORE',
  NEW_JOURNAL: 'NEW JOURNAL',
  JOURNAL_NAME: 'A name for it, like Travel or Kids',
  PLACE_FROM_PHOTO: (p: string) => `Place from the photo: ${p} (only the name of your saved place is kept).`,
  TALK: 'SAY IT',
  TALK_ON: 'LISTENING…',
  ASK_ME: 'ASK GHOSTY ABOUT IT',
  ASK_NOTE: 'Your entries stay on this phone. ASK GHOSTY ABOUT IT sends this one entry to me in the chat, and nothing else.',
  VERSIONS: (n: number) => `Earlier wordings (${n})`,
  PUT_BACK: 'PUT BACK',
  PUT_BACK_DONE: 'The earlier wording is back; the one it replaced is kept too.',
  ASK_OPEN: 'Your journal is open.',
  ASK_NEW: 'A new page is open in your journal.',
  ASK_ADDED: 'It is in a new journal entry, kept on this phone: add a photo or a mood if you like.',
};

/** Prompts for a blank page: the classic journalling questions. */
export const PROMPTS = [
  'What made you smile today?',
  'Three good things today',
  'What is on your mind right now?',
  'What did you learn this week?',
  'Who are you grateful for, and why?',
  'What would make tomorrow a good day?',
  'Describe where you are, as if to a stranger.',
  'What are you looking forward to?',
  'What drained you today, and what gave you energy?',
  'A small win worth remembering',
  'What would you tell yourself a year ago?',
  'What is one thing you want to remember about today?',
  'What did you do today that you are proud of?',
  'What is something you are putting off, and why?',
  'Write about a meal you enjoyed recently.',
  'What made this morning good?',
  'Where did you feel most at ease this week?',
  'What is a worry you can put down tonight?',
  'Who did you talk to today, and what stayed with you?',
  'What do you want more of next week?',
];

/** "open my journal", "new journal entry", "write in my journal", "add to my journal: …". */
export function journalAsked(text: string): { open: true; write?: boolean; words?: string } | null {
  const t = text.replace(/\s+/g, ' ').trim();
  const add = /^(?:add to|put in|write in|note in) (?:my )?(?:journal|diary)[:,]?\s+(.{3,})$/i.exec(t) ?? /^(?:dear diary|journal)[,:]\s*(.{3,})$/i.exec(t);
  if (add) return { open: true, write: true, words: add[1]!.trim() };
  if (/^(?:(?:hey )?ghosty[, ]+)?(?:new (?:journal|diary) entry|write in my (?:journal|diary)|start a (?:journal|diary) entry|i want to journal|journal (?:time|now))[.!]?$/i.test(t)) return { open: true, write: true };
  if (/^(?:(?:hey )?ghosty[, ]+)?(?:open |show (?:me )?)?(?:my )?journal[.!]?$/i.test(t)) return { open: true };
  return null;
}
