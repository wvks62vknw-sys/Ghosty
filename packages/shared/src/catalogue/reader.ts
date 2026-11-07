/**
 * The catalogue's words for the Library as a library (BRIEF-LIBRARY-READER): THE READER and its four sections, reading a book
 * by words, Settings → Reading, and the Library's deck lines that lead to them. Joined into APP_WORDS in app.ts.
 */
import type { CatValue } from '../catalogue';

const SINCE = '2026-11-07';

export const READER_WORDS: Record<string, CatValue> = {
  'screen:reader': {
    name: 'The reader: your books',
    line: 'You can read any book on your shelf here, from where you left off, or have me read it to you.',
    more: 'Learn → Library → the book. Its own words on the page, its pages and chapters, your place kept on this phone and on my brain. LISTEN reads it aloud; talk over me and I stop; say “go on” and I carry on.',
    say: ['Read me The Hobbit', 'Where were we?'], scene: ['school', 'talking'], cat: 'learn', since: SINCE,
  },
  'panel:reader:READ': {
    name: 'Read it, or hear it',
    line: 'You can read a book on the page, scrolling or a page at a time, or tap LISTEN and I read it to you from your place.',
    more: 'The passage I am reading is held in a box and the page follows my voice. Talk over me and I stop at once; “go on” carries on from the sentence you stopped me in. The phone’s own voice reads by default.',
    say: ['(tap LISTEN)', 'Carry on reading'], scene: ['school', 'talking'], cat: 'learn', since: SINCE,
  },
  'panel:reader:CHAPTERS': {
    name: 'Jump to a chapter',
    line: 'You can see every chapter of a book, the one you are in marked, and jump to any of them.',
    more: 'A book with no chapter headings of its own shows its pages, or its parts. Say “read chapter 3” and I start reading it to you.',
    say: ['Read chapter 3'], scene: ['school'], cat: 'learn', since: SINCE,
  },
  'panel:reader:SEARCH': {
    name: 'Find words in a book',
    line: 'You can find any words inside the book you are reading, and jump to the passage with them marked.',
    more: 'Every word you type, in any order, in this book only. For the whole library, Ask the library on the Library screen.',
    say: ['(type in Find in this book)'], scene: ['school'], cat: 'learn', since: SINCE,
  },
  'panel:reader:ABOUT': {
    name: 'What the book is',
    line: 'You can see what a book is, where it came from and its size, keep it on this phone, or take it out of the library.',
    more: 'Keep on this phone fetches the whole book on Wi-Fi, its size said first, so it reads with no signal. Remove has UNDO. It also says which voice reads it, and what happens when the screen locks.',
    say: ['(tap About in the reader)'], scene: ['school', 'phone'], cat: 'learn', since: SINCE,
  },
  'section:reader:read': { same: 'panel:reader:READ' },
  'section:reader:chapters': { same: 'panel:reader:CHAPTERS' },
  'section:reader:search': { same: 'panel:reader:SEARCH' },
  'section:reader:about': { same: 'panel:reader:ABOUT' },
  'phrase:reading': {
    name: 'Read me a book',
    line: 'You can say “read me” and a book on your shelf, and I read it to you from your place, without a tap.',
    more: 'Also “carry on reading”, “where were we”, “read chapter 3”, “read from page 40”, “just this chapter” and “stop reading”. Answered on the phone with no AI. A book you have not got, I say so, with a button to add it.',
    say: ['Read me The Hobbit', 'Where were we?', 'Read chapter 3', 'Stop reading'], scene: ['talking', 'school'], cat: 'talk', since: SINCE,
  },
  'panel:settings:READING': {
    name: 'How you like to read',
    line: 'You can choose how a book is shown, a page at a time or scrolling, its size, and whether my own voice reads it.',
    more: 'Text from 12 to 28 points, 17 to start. My own voice reads books for about an hour a day within its free share; then the phone’s voice carries on, and I say so when it does.',
    say: ['(Settings › Reading)'], scene: ['school', 'talking'], cat: 'talk', since: SINCE,
  },
  // ---- the Library's deck card, saying what it is now
  'deck:library:open-a-book-where-you-left': { same: 'panel:library:SHELF' },
  'deck:library:where-were-we-and-he-reads': { same: 'phrase:reading' },
};
