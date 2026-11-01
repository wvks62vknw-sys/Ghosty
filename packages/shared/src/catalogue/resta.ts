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
};
