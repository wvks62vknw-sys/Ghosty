/**
 * THE LIBRARY'S WORDS (BRIEF-QUALITY-LEARN): the shelf's empty line, a file I cannot read, a search with no hit, the shelf's wait and a book
 * the reader cannot open, in his voice and with no DOM, so the spec reads the very words the page is built from. The reader's drawing of
 * a file and READ TO ME's voice path are not touched: these are words and drawn states only.
 */

/** His shelf with nothing of his on it: what it is for, in one line (the key beside it is ADD A BOOK). */
export const SHELF_NONE = { head: 'No books of yours yet', line: 'Add a PDF, e-book, Word file or photos of pages, and I keep it here to read or read aloud.' };

/** The shelf being opened (said when it takes more than a moment). */
export const SHELF_WAIT = 'Opening your shelf…';

/** What works, said whenever a file will not (the order is the one he is most likely to have). */
export const WHAT_WORKS = 'PDFs, Word files, e-books, text and photos of pages all work.';

/** A file I cannot read: said as I, with the one thing that works instead. */
export function unreadable(name: string, scan: boolean): string {
  return scan
    ? `I can’t read “${name}”: it looks like pictures of pages. Photos of the pages work: choose them in Add.`
    : `I can’t read “${name}”. ${WHAT_WORKS}`;
}

/** A search with no hit: names what he typed and what to try. */
export const noHit = (t: string): string => `I can’t find “${t}”. Try one plainer word, or fewer words.`;
/** …and, when search by meaning is off, the one more thing that finds ideas as well as words. */
export const MEANING_TIP = 'Search by meaning, in Settings under Offline brain, finds ideas as well as words.';

/** A book the reader cannot open: the one way on. */
export const openFailed = (title: string): string => `I couldn’t open “${title}”. Tap TRY AGAIN; if it still won’t open, pick another book from your shelf.`;
export const TRY_AGAIN = 'TRY AGAIN';

/** The chat phrases that open the reader's reading on the phone (readingIntent answers them), listed in one line. */
export const PHRASES = ['carry on reading', 'where were we'];
