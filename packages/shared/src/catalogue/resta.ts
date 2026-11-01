/**
 * The catalogue's words for batch ⑧ part A (BRIEF-REST-A): WIKIPEDIA, OFFLINE (the Library's panel, under its Ask pill)
 * and its chat words, SHORTCUTS in Settings (Siri Shortcuts from Ghosty's links), and the MORSE sheet (opened by its chat
 * words: the sheet is the phrase's). Joined into APP_WORDS in app.ts.
 */
import type { CatValue } from '../catalogue';

const SINCE = '2026-11-01';

export const RESTA_WORDS: Record<string, CatValue> = {
  'panel:library:WIKIPEDIA, OFFLINE': {
    name: 'Wikipedia with no signal',
    line: 'You can keep Wikipedia on your phone and search and read it with no signal at all.',
    more: 'Two files from the Kiwix library: a 53 MB physics taster, or every Simple English article without pictures (1.1 GB), each fetched on Wi-Fi when you tap GET and deleted in one tap. It is read on the phone: my brain never reads it. Never the whole English Wikipedia, which is 119 GB.',
    say: ['Get Wikipedia on my phone', 'Search Wikipedia offline'],
    scene: ['phone', 'school'],
    cat: 'learn',
    needs: ['wifi'],
    since: SINCE,
  },
  'phrase:wiki': {
    name: 'Look it up offline',
    line: 'You can say “offline wikipedia” and a thing, and I answer from Wikipedia on your phone, no AI.',
    more: 'The first paragraph of its article, with a card that opens the whole of it. “Look it up offline” looks up what you asked last. With no signal, a question like “what is a black hole?” gets the article too, if the file has one. My brain never reads the file.',
    say: ['Offline wikipedia black holes', 'Look it up offline', 'What does Wikipedia say about volcanoes (offline)?'],
    scene: ['phone', 'school'],
    cat: 'know',
    go: { ask: 'Offline wikipedia black holes' },
    since: SINCE,
  },
  'panel:settings:SHORTCUTS': {
    name: 'Siri shortcuts for me',
    line: 'You can say “Hey Siri, Ghosty timer” and I do it: twelve ready shortcuts, or your own, from my links.',
    more: 'Each shortcut is a link the Shortcuts app opens: a timer, the Lens on SCAN, walk me home, the arcade, your brief and more. Copy one, paste it into Open URLs, name it. Nothing is installed for you: iPhone allows no web page to add one. A link only works on your own signed-in phone.',
    say: ['Make a Siri shortcut', 'Hey Siri, Ghosty timer'],
    scene: ['phone', 'out'],
    cat: 'do',
    since: SINCE,
  },
  'phrase:morse': {
    name: 'Morse code, both ways',
    line: 'You can turn words into Morse and back, hear it, flash it on the screen, tap it out, and learn a letter a day.',
    more: 'Say “morse”, “SOS in morse” or “decode morse”. The sheet plays it at the speed you set and flashes the screen (a web page cannot use the torch), reads your taps on its pad, and has the chart and a five-letter quiz. All on the phone.',
    say: ['SOS in morse', 'Decode morse', 'Learn morse'],
    scene: ['playing', 'phone'],
    cat: 'play',
    go: { ask: 'SOS in morse' },
    since: SINCE,
  },
};
