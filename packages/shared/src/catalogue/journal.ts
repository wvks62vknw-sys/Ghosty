/**
 * The catalogue's words for JOURNAL (APPS ROUND, lane MEMORY): Memory → Journal, his own writing kept on the phone, its panels and
 * the things he can say. Joined into APP_WORDS in app.ts.
 */
import type { CatValue } from '../catalogue';

const SINCE = '2026-11-14';

export const JOURNAL_WORDS: Record<string, CatValue> = {
  'screen:journal': {
    name: 'Your own private journal',
    line: 'You can keep a journal here, with photos, a voice note, a mood and a place on each entry, locked with Face ID if you like.',
    more: 'Memory → Journal. Several journals with their own colours, a calendar, On this day, your places, a streak, prompts for a blank page and a gentle daily nudge. Entries stay on this phone and in your encrypted backup unless you ask me about one.',
    say: ['New journal entry', 'Open my journal', 'Add to my journal: a good walk today'], scene: ['behind'], cat: 'do', since: SINCE,
  },
  'panel:journal:ENTRIES': {
    name: 'Your entries, newest first',
    line: 'You can write an entry, take a prompt when the page is blank, and search what you wrote by your words or by meaning.',
    more: 'Each entry can have photos (made smaller on the phone, their location left out), a voice note, a mood, a place and a day. It saves as you type; DELETE has UNDO and a 30-day Recently deleted.',
    say: ['Write in my journal', 'Dear diary, today was long'], scene: ['behind'], cat: 'do', since: SINCE,
  },
  'panel:journal:CALENDAR': {
    name: 'Calendar of days written',
    line: 'You can see a month with a dot on each day you wrote, and tap a day for its entries.',
    more: 'Memory → Journal → Calendar. The arrows move a month at a time; the count says how many days that month have an entry.',
    say: ['When did I write in my journal?'], scene: ['behind'], cat: 'do', since: SINCE,
  },
  'panel:journal:ON THIS DAY': {
    name: 'On this day',
    line: 'You can read what you wrote a week ago, a month ago and on this day in earlier years.',
    more: 'Memory → Journal → On this day. Only your own entries, read on the phone.',
    say: ['What did I write on this day?'], scene: ['behind'], cat: 'do', since: SINCE,
  },
  'panel:journal:PLACES': {
    name: 'Your entries by place',
    line: 'You can see your entries grouped by the place you gave: a saved place or your own words, never your live position.',
    more: 'Memory → Journal → Places. The places offered when you write are the ones you saved in Memory; a photo’s own location is never read or kept.',
    say: ['Where have I written from?'], scene: ['behind'], cat: 'do', since: SINCE,
  },
  'panel:journal:JOURNAL SETTINGS': {
    name: 'Journals, lock and nudge',
    line: 'You can make more journals with their own colours, lock it with Face ID, set a daily nudge and print this year as a book.',
    more: 'The lock is a passkey made on this phone. The nudge sends only the time to my reminders, never your words. The book opens a clean page of the year, ready for Print → Save as PDF.',
    say: ['Lock my journal', 'Remind me to journal'], scene: ['behind'], cat: 'do', since: SINCE,
  },
  'section:journal:entries': { same: 'panel:journal:ENTRIES' },
  'section:journal:calendar': { same: 'panel:journal:CALENDAR' },
  'section:journal:otd': { same: 'panel:journal:ON THIS DAY' },
  'section:journal:places': { same: 'panel:journal:PLACES' },
  'section:journal:settings': { same: 'panel:journal:JOURNAL SETTINGS' },
  // Memory's row that opens it
  'panel:memory:JOURNAL': { same: 'screen:journal' },
  'phrase:journal': { same: 'screen:journal' },
};
