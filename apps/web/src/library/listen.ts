/**
 * LISTEN: I READ A BOOK TO HIM (BRIEF-LIBRARY-READER 3, under BRIEF-TALK-1A's talking rules; no screen here — the reader draws
 * this, features/library/reader.ts).
 *  - From his place, sentence by sentence (library/book.ts), the next handed to the voice before the one before it ends
 *    (assistant/voice.ts readAloud): no gap, at the voice's own pace, never cut short to "the rest is on screen".
 *  - THE VOICE FOR A BOOK (OWNER-ISSUES 131): the phone's own by default (a book is hours of speech; my free voice has a daily
 *    share); HIS VOICE FOR BOOKS gives my own voice for about an hour a day within that share, and when it runs out mid-read the
 *    phone's voice says "My own voice from here." and reads on.
 *  - The place moves as each sentence is said (library/place.ts keeps it); the screen lights the passage being read.
 *  - Talked over (or tapped), I stop at once and the place stays at the sentence he was in; "go on" reads on from there after
 *    "Back to <the book>." — never from the top; a question in between is answered, then "go on" goes back to the book.
 *  - "stop", "that's all", the microphone let go: I stop and say where we are ("Page 48. I'll carry on from here.").
 *  - A chapter's end: the next chapter's name, and on, unless he said "just this chapter" (then I stop there and say so).
 */
import { brain } from '../api/brain';
import { createStore } from '../core/store';
import type { LibraryDoc } from '../../../../packages/shared/src/protocol';
import { onCutOff, readAloud, speak, stopSpeaking, type BookEngine, type SwitchWhy } from '../assistant/voice';
import { buildBook, chapterName, clampPlace, piecesFrom, placeInfo, said, type Book, type Piece } from './book';
import { passagesHere } from './local';
import { readingPrefs, setPlace } from './place';

export type ReadState = 'idle' | 'reading' | 'cut' | 'stopped' | 'ended';
export interface Reading {
  doc: string;
  title: string;
  state: ReadState;
  /** The place being read (the sentence's passage and where it starts). */
  n: number;
  off: number;
  /** The passage lit on the screen (-1: none). */
  lit: number;
  engine: BookEngine | '';
  /** My own voice ran out for books (and why): the phone's reads on. */
  switched: SwitchWhy | '';
  /** "Just this chapter". */
  only: boolean;
  /** The book was read to its end. */
  finished: boolean;
  /** When it last stopped (a cut, a stop): "go on" carries on within ten minutes of it. */
  stoppedAt: number;
}
export const reading = createStore<Reading>({ doc: '', title: '', state: 'idle', n: 0, off: 0, lit: -1, engine: '', switched: '', only: false, finished: false, stoppedAt: 0 });

/** What the checks read (window.__ghosty.reader.listen): every piece as it began to be heard, cuts, resumes, first words. */
export const listenLog = {
  pieces: [] as { i: number; n: number; off: number; text: string; line: boolean; engine: BookEngine; at: number }[],
  cuts: 0,
  resumes: 0,
  ends: [] as string[],
  firstWordMs: [] as number[],
  switches: [] as string[],
};

/** "Go on" carries the book on for this long after it stopped (as a reply's carry-on: assistant/session.ts CARRY_MS). */
export const CARRY_MS = 10 * 60_000;
/** About an hour a day of my own voice for books: the rest of its share stays for answering him. */
export const BOOK_VOICE_SECS = 3600;
export const SWITCH_LINE = 'My own voice from here.';

let book: Book | null = null;
/** The book in hand (the reader's, the one being read). */
export const bookNow = (): Book | null => book;
export function setBook(b: Book | null): void {
  if (book && b && book.id !== b.id && reading.get().state !== 'idle') stopQuietly();
  book = b;
}

const cache = new Map<string, { sig: string; book: Book }>();
/**
 * A document's book: this phone's copy when it holds all of it (at once, and with no signal), else the brain's, 300 passages at
 * a time (the brain hands over the phone's copy itself when it cannot be reached: api/brain.ts).
 */
export async function loadBook(doc: LibraryDoc): Promise<Book> {
  const sig = `${doc.passages}:${doc.chars}`;
  const hit = cache.get(doc.id);
  if (hit && hit.sig === sig) return hit.book;
  const here = await passagesHere(doc.id).catch(() => null);
  let raw: { text: string; heading?: string | null; page?: number | null }[];
  if (here && here.length && (here.length >= doc.passages || (typeof navigator !== 'undefined' && navigator.onLine === false))) raw = here;
  else {
    raw = [];
    let after = 0;
    for (let i = 0; i < 200; i++) {
      const r = await brain.libraryPassages(doc.id, after);
      raw.push(...r.passages);
      if (r.next === null || !r.passages.length) break;
      after = r.next;
    }
  }
  if (!raw.length) throw new Error('it has no words to read');
  const b = buildBook(doc, raw);
  cache.set(doc.id, { sig, book: b });
  return b;
}

/** Where we are, said once he stops me: "Page 48." for a book with pages; else the chapter and how far in. */
export function placeLine(b: Book, n: number, off: number): string {
  const p = placeInfo(b, n, off);
  if (p.page) return `Page ${p.page}.`;
  const ch = b.byHeadings ? b.chapters[p.chapter]?.title : '';
  return `${ch ? `${ch}, ` : ''}${Math.max(1, Math.round(p.pct * 100))}% of the way in.`.replace(/^./, (c) => c.toUpperCase());
}

/** A title as it is said in a sentence: no subtitle after a colon, at most eight words. */
export const shortTitle = (t: string): string => t.split(/\s*[:—–]\s+/)[0]!.split(/\s+/).slice(0, 8).join(' ');

function keep(b: Book, n: number, off: number, done = false): void {
  const p = placeInfo(b, n, off);
  setPlace(b.id, { n: p.n, off: p.off, page: p.page, pct: done ? 1 : p.pct, done });
}

// ---------------------------------------------------------------------------------------------------- reading aloud

const voiceDay = createStore({ day: '', secs: 0 }, { persist: 'ghosty.bookvoice' });
const today = () => new Date().toISOString().slice(0, 10);
/** Seconds of my own voice left for books today. */
export const bookVoiceLeft = (): number => BOOK_VOICE_SECS - (voiceDay.get().day === today() ? voiceDay.get().secs : 0);
const spend = (s: number) => voiceDay.set((v) => (v.day === today() ? { secs: v.secs + s } : { day: today(), secs: s }));

/** What each piece handed to the voice is: a sentence of the book (with its place), or a line of mine (a lead, a chapter's name). */
let meta: { n: number; off: number; line: boolean; text: string }[] = [];
/** The reading going now: a later one (or a stop) makes the callbacks of an earlier one do nothing. */
let run = 0;
/** "Just this chapter", for the reading going now (he may say it while I read). */
let onlyThis = false;
/** The chapter "just this chapter" means: the one he was hearing when he said it (or the one a reading started in). */
let onlyChapter = -1;

/**
 * Read `b` aloud from a place. `lead`: a line of mine first ("Back to The Hobbit.", "The Hobbit, page 3."); `only`: just this
 * chapter; `t0`: when he asked (the first word is timed from it).
 */
export function startReading(b: Book, from: { n: number; off: number }, opts: { lead?: string; only?: boolean; t0?: number } = {}): void {
  book = b;
  const me = ++run;
  const at = clampPlace(b, from.n, from.off);
  const gen = piecesFrom(b, at.n, at.off);
  meta = [];
  onlyThis = !!opts.only;
  const lines: string[] = opts.lead ? [opts.lead] : [];
  let held: Piece | null = null;
  let chapter = b.passages[at.n]?.chapter ?? 0;
  onlyChapter = chapter;
  let endAt: { n: number; chapter: number } | null = null;
  let last = { n: at.n, off: at.off };
  const next = (): { text: string } | null => {
    if (lines.length) {
      const t = lines.shift()!;
      meta.push({ n: last.n, off: last.off, line: true, text: t });
      return { text: t };
    }
    let p = held;
    held = null;
    if (!p) {
      const r = gen.next();
      if (r.done) return null;
      p = r.value;
    }
    const c = b.passages[p.n]!.chapter;
    if (c !== chapter || (onlyThis && c !== onlyChapter)) {
      // the chapter is over: there, if he asked for just this one; else on, the next one named first (its own head names it)
      if (onlyThis) {
        endAt = { n: p.n, chapter: onlyChapter };
        return null;
      }
      chapter = c;
      if (!p.head && b.chapters[c]) {
        held = p;
        last = { n: p.n, off: p.off };
        const t = `Next, ${b.chapters[c]!.title}.`;
        meta.push({ n: p.n, off: p.off, line: true, text: t });
        return { text: t };
      }
    }
    last = { n: p.n, off: p.off };
    const text = said(p);
    meta.push({ n: p.n, off: p.off, line: false, text });
    return { text };
  };
  reading.set({ doc: b.id, title: b.title, state: 'reading', n: at.n, off: at.off, lit: at.n, engine: '', switched: '', only: onlyThis, finished: false });
  const t0 = opts.t0 ?? performance.now();
  let first = true;
  readAloud({
    next,
    owner: `book:${b.id}`,
    ghosty: readingPrefs.get().bookVoice,
    ghostyLeft: bookVoiceLeft,
    spent: spend,
    switchLine: SWITCH_LINE,
    onPiece: (i, engine) => {
      if (me !== run) return;
      const m = meta[i];
      if (!m) return;
      // "just this chapter" said once the next chapter's first words were already handed to the voice (it is given a few
      // pieces ahead): the reading ends here, at the chapter's end, before any of the next one is heard
      if (onlyThis && (b.passages[m.n]?.chapter ?? onlyChapter) !== onlyChapter) {
        run++;
        stopSpeaking();
        chapterEnd(b, m.n, onlyChapter);
        return;
      }
      if (first) {
        first = false;
        listenLog.firstWordMs.push(Math.round(performance.now() - t0));
      }
      listenLog.pieces.push({ i, n: m.n, off: m.off, text: m.text, line: m.line, engine, at: performance.now() });
      if (!m.line) keep(b, m.n, m.off);
      reading.set({ n: m.n, off: m.off, lit: m.n, engine });
    },
    onSwitch: (why) => {
      if (me !== run) return;
      listenLog.switches.push(why);
      reading.set({ switched: why });
    },
    onEnd: (how) => {
      if (me !== run) return;
      if (how === 'stopped') {
        if (reading.get().state === 'reading') reading.set({ state: 'stopped', stoppedAt: Date.now() });
        return;
      }
      // read to its end: the chapter he asked for (the place moves to the next one), or the whole book (marked finished)
      run++;
      if (endAt) chapterEnd(b, endAt.n, endAt.chapter);
      else {
        const lastN = b.passages.length - 1;
        keep(b, lastN, Math.max(0, b.passages[lastN]!.text.length - 1), true);
        reading.set({ state: 'ended', lit: -1, finished: true, stoppedAt: Date.now() });
        listenLog.ends.push('book');
        void closing(`That's the end of ${shortTitle(b.title)}. I've marked it finished.`);
      }
    },
  });
}

/** The chapter he asked for is read ("just this chapter"): the place moves to the next one's start, and I say so. */
function chapterEnd(b: Book, n: number, chapter: number): void {
  keep(b, n, 0);
  reading.set({ state: 'ended', n, off: 0, lit: -1, stoppedAt: Date.now() });
  listenLog.ends.push('chapter');
  void closing(`That's the end of ${chapterName(b, chapter)}. ${placeLine(b, n, 0)} I'll carry on from here.`);
}

/** A line of mine at the end, in the voice the book was read in (the phone's, unless HIS VOICE FOR BOOKS has mine). */
function closing(line: string): Promise<void> {
  return speak(line, { here: !readingPrefs.get().bookVoice || reading.get().switched !== '' });
}

/** "Just this chapter" while I read: I stop at the end of the chapter I am in. */
export function onlyThisChapter(): void {
  onlyThis = true;
  // (the chapter of the sentence he is hearing, not of the pieces already handed to the voice ahead of it)
  const s = reading.get();
  if (book && book.id === s.doc) onlyChapter = book.passages[s.n]?.chapter ?? onlyChapter;
  reading.set({ only: true });
}

/** It can carry on: cut or stopped (not finished), the book in hand, within ten minutes. */
export function canResume(): boolean {
  const s = reading.get();
  return !!book && book.id === s.doc && (s.state === 'cut' || s.state === 'stopped' || (s.state === 'ended' && !s.finished)) && Date.now() - s.stoppedAt < CARRY_MS;
}

/** "Go on": from the sentence he was in, after "Back to <the book>." (never from the top). False when there is nothing to carry on. */
export function resumeReading(t0?: number): boolean {
  if (!canResume() || !book) return false;
  const s = reading.get();
  listenLog.resumes++;
  startReading(book, { n: s.n, off: s.off }, { lead: `Back to ${shortTitle(book.title)}.`, only: s.only, t0 });
  return true;
}

/**
 * I stop reading (STOP, "stop", "that's all", the microphone let go) and, with `say`, say where we are: "Page 48. I'll carry on
 * from here." Resolves with that line ('' when nothing was being read).
 */
export async function stopReading(say = true): Promise<string> {
  const s = reading.get();
  if (!book || s.state === 'idle' || (s.state === 'ended' && Date.now() - s.stoppedAt > CARRY_MS)) return '';
  run++;
  if (s.state === 'reading') stopSpeaking();
  keep(book, s.n, s.off);
  const line = `${placeLine(book, s.n, s.off)} I'll carry on from here.`;
  reading.set({ state: 'ended', lit: -1, stoppedAt: Date.now() });
  listenLog.ends.push('stopped');
  if (say) await closing(line);
  return line;
}

/** Stopped with nothing said (another book opened, a harsh stop): the place stays where it was. */
export function stopQuietly(): void {
  const s = reading.get();
  if (s.state !== 'reading') return;
  run++;
  stopSpeaking();
  if (book) keep(book, s.n, s.off);
  reading.set({ state: 'stopped', lit: -1, stoppedAt: Date.now() });
}

// Talked over, or tapped: I stop at once (voice.ts), and the place stays at the sentence he was in.
onCutOff((c) => {
  if (!c.owner?.startsWith('book:') || !book || c.owner !== `book:${book.id}`) return;
  const m = meta[c.at];
  listenLog.cuts++;
  if (m) keep(book, m.n, m.off);
  reading.set({ state: 'cut', ...(m ? { n: m.n, off: m.off } : {}), lit: m ? m.n : reading.get().lit, stoppedAt: Date.now() });
});
