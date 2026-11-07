/**
 * A BOOK AS HE READS IT (BRIEF-LIBRARY-READER 1–3; pure: no screen, no storage, no voice). The library keeps a document as
 * passages of about 1,200 characters, each carrying the last ~150 of the one before it so a search hit keeps its context
 * (packages/shared/src/chunk.ts). Read in a row as they are, every passage would start by repeating the end of the last one —
 * the old pop-up reader did exactly that — so here each passage loses the words it carried over and the book reads once,
 * end to end. A PDF's lines join where the page's edge broke them. Then:
 *  - paragraphs, and the headings inside the text as chapter heads;
 *  - CHAPTERS from the headings; a book with none gets its page ranges (a PDF, photos of pages), an e-book's parts, or tenths;
 *  - a place is a passage and how far into it (`n`, `off`), the same on every device; what it is in his words ("PAGE 42 OF
 *    300", or "34%" for a book with no pages of its own) and how far through (`pct`);
 *  - the pieces LISTEN says: sentence by sentence (never inside a number or after a short form: assistant/spoken.ts), each with
 *    where it starts, so the place moves as each is said and "go on" starts at the sentence he was in;
 *  - SEARCH inside the book: every passage that holds his words, where, and the words around them.
 */
import { unoverlap } from '../../../../packages/shared/src/chunk';
import type { LibraryDoc } from '../../../../packages/shared/src/protocol';
import { clean, quickFirst, SHORT } from '../assistant/spoken';

export interface RawPassage {
  text: string;
  heading?: string | null;
  page?: number | null;
}
/** A paragraph of a passage: a chapter head or running text, and where it starts in the passage's text. */
export interface Para {
  head: boolean;
  text: string;
  at: number;
}
export interface BookPassage {
  /** Its place in the book, from 0. */
  n: number;
  /** Its text as it reads (the words carried from the last passage gone, a PDF's lines joined). */
  text: string;
  heading: string;
  /** The book's own page (a PDF's, a photo's), or null. */
  page: number | null;
  /** Which of CHAPTERS it is in. */
  chapter: number;
  /** Characters of the book before it. */
  at: number;
  paras: Para[];
}
export interface Chapter {
  i: number;
  title: string;
  /** Its first passage. */
  n: number;
  page: number | null;
  /** How far into the book it starts, 0 to 1. */
  pct: number;
}
export interface Book {
  id: string;
  title: string;
  author: string;
  kind: string;
  /** Its own pages (0: it has none: a text, an e-book, a Word file). */
  pages: number;
  hasPages: boolean;
  /** Code, shown as it is written. */
  code: boolean;
  passages: BookPassage[];
  chapters: Chapter[];
  /** The chapters are its own headings (else page ranges, parts or tenths). */
  byHeadings: boolean;
  chars: number;
}
/** What LISTEN says next: a sentence (or a chapter's head), the passage it is in and where it starts there. */
export interface Piece {
  n: number;
  off: number;
  text: string;
  head: boolean;
}
export interface PlaceInfo {
  n: number;
  off: number;
  page: number | null;
  pct: number;
  chapter: number;
  /** At the very end of the book. */
  end: boolean;
  /** "PAGE 3 OF 9", or "34%" for a book with no pages of its own. */
  words: string;
}

/** A heading as the chunker marks one: "# Chapter One", or a short line in capitals ("CHAPTER ONE: THE LAMP"). */
const HEAD = /^#{1,6}\s+(.{2,120})$/;
const shouted = (p: string) => p.length < 90 && !/[.!?:,;]$/.test(p) && /^[A-Z0-9][A-Z0-9 \-–:'&/().]{3,}$/.test(p);

/**
 * A passage as running text: a PDF's lines (and a photo's) break where the page's edge was, so a line that does not end a
 * sentence joins the next when that one carries on in lower case ("worth\nreading twice" → "worth reading twice"), and a word
 * split by a hyphen at a line end is whole again. Headings, lists and paragraphs stay as they are.
 */
export function flowing(text: string): string {
  return text.replace(/(\p{L}{2,})-\n(?=\p{Ll})/gu, '$1').replace(/([^\n.!?:;])[ \t]*\n(?=[ \t]*\p{Ll})/gu, '$1 ');
}

/** A passage's paragraphs, each with where it starts in the text; a heading line is a chapter head (code: one block, as written). */
function parasOf(text: string, code: boolean): Para[] {
  if (code) return [{ head: false, text, at: 0 }];
  const out: Para[] = [];
  const re = /\n{2,}/g;
  let from = 0;
  const add = (a: number, b: number) => {
    const raw = text.slice(a, b);
    const lead = raw.length - raw.trimStart().length;
    const t = raw.trim();
    if (!t) return;
    const h = HEAD.exec(t);
    if (h && !t.includes('\n')) out.push({ head: true, text: h[1]!.trim(), at: a + lead });
    else if (!t.includes('\n') && shouted(t)) out.push({ head: true, text: t, at: a + lead });
    else out.push({ head: false, text: t, at: a + lead });
  };
  for (const m of text.matchAll(re)) {
    add(from, m.index!);
    from = m.index! + m[0].length;
  }
  add(from, text.length);
  return out;
}

/** The book from the library's passages for `doc`, in their order. */
export function buildBook(doc: Pick<LibraryDoc, 'id' | 'title' | 'kind' | 'pages'> & { author?: string }, raw: RawPassage[]): Book {
  const code = doc.kind === 'code';
  const passages: BookPassage[] = [];
  let at = 0;
  raw.forEach((r, n) => {
    const prev = raw[n - 1];
    const page = Number.isFinite(r.page) && (r.page ?? 0) > 0 ? Math.floor(r.page!) : null;
    // (the chunker carries words over only within a page: a new page starts afresh)
    const carried = prev && (Number.isFinite(prev.page) && (prev.page ?? 0) > 0 ? Math.floor(prev.page!) : null) === page;
    let text = carried ? unoverlap(prev!.text, r.text) : r.text;
    if (!code) text = flowing(text);
    passages.push({ n, text, heading: String(r.heading ?? '').trim(), page, chapter: 0, at, paras: parasOf(text, code) });
    at += text.length + 1;
  });
  const chars = Math.max(1, at - 1);
  const hasPages = doc.pages > 1 && doc.kind !== 'book' && passages.some((p) => p.page !== null);
  const chapters: Chapter[] = [];
  const heads = new Set(passages.map((p) => p.heading).filter((x) => x && x !== doc.title));
  const byHeadings = !code && heads.size >= 2;
  const pct = (n: number) => (passages[n] ? Math.min(1, passages[n]!.at / chars) : 0);
  if (byHeadings) {
    if (!passages[0]?.heading) chapters.push({ i: 0, title: 'The start', n: 0, page: passages[0]?.page ?? null, pct: 0 });
    passages.forEach((p, n) => {
      if (p.heading && (n === 0 || p.heading !== passages[n - 1]!.heading)) chapters.push({ i: chapters.length, title: p.heading, n, page: p.page, pct: pct(n) });
    });
  } else if (hasPages) {
    // page ranges: every page of a short book, else ranges of five or ten pages (never more than about twenty-four rows)
    const last = Math.max(...passages.map((p) => p.page ?? 0));
    const size = last <= 12 ? 1 : last <= 120 ? 5 : Math.ceil(last / 240) * 10;
    for (let a = 1; a <= last; a += size) {
      const b = Math.min(last, a + size - 1);
      const n = passages.findIndex((p) => (p.page ?? 0) >= a);
      if (n < 0 || (chapters.length && chapters[chapters.length - 1]!.n === n)) continue;
      chapters.push({ i: chapters.length, title: size === 1 ? `Page ${a}` : `Pages ${a}–${b}`, n, page: passages[n]!.page, pct: pct(n) });
    }
  } else if (doc.kind === 'book' && passages.some((p) => p.page !== null)) {
    // an e-book whose parts carry no headings: its parts, as its file orders them
    passages.forEach((p, n) => {
      if (n === 0 || p.page !== passages[n - 1]!.page) chapters.push({ i: chapters.length, title: `Part ${chapters.length + 1}`, n, page: null, pct: pct(n) });
    });
  } else {
    const parts = passages.length >= 20 ? 10 : passages.length >= 6 ? 5 : 1;
    for (let k = 0; k < parts; k++) {
      const n = Math.floor((k * passages.length) / parts);
      chapters.push({ i: k, title: parts === 1 ? 'The whole text' : `Part ${k + 1}`, n, page: null, pct: pct(n) });
    }
  }
  if (!chapters.length) chapters.push({ i: 0, title: 'The whole text', n: 0, page: null, pct: 0 });
  // each passage's chapter
  let c = 0;
  for (const p of passages) {
    while (c + 1 < chapters.length && chapters[c + 1]!.n <= p.n) c++;
    p.chapter = c;
  }
  return { id: doc.id, title: doc.title, author: doc.author ?? '', kind: doc.kind, pages: hasPages ? Math.max(doc.pages, ...passages.map((p) => p.page ?? 0)) : 0, hasPages, code, passages, chapters, byHeadings, chars };
}

/** A place kept within the book (a passage it has, an offset inside it). */
export function clampPlace(book: Book, n: number, off: number): { n: number; off: number } {
  if (!book.passages.length) return { n: 0, off: 0 };
  const nn = Math.max(0, Math.min(book.passages.length - 1, Math.floor(Number.isFinite(n) ? n : 0)));
  const p = book.passages[nn]!;
  return { n: nn, off: Math.max(0, Math.min(Math.max(0, p.text.length - 1), Math.floor(Number.isFinite(off) ? off : 0))) };
}

/** Where a place is, as he says it: the page (or how far through), the chapter, and whether it is the end. */
export function placeInfo(book: Book, n: number, off: number): PlaceInfo {
  const at = clampPlace(book, n, off);
  const p = book.passages[at.n];
  if (!p) return { n: 0, off: 0, page: null, pct: 0, chapter: 0, end: false, words: 'NOTHING TO READ' };
  const last = at.n === book.passages.length - 1;
  const end = last && at.off >= Math.max(0, p.text.length - 40);
  const pct = end ? 1 : Math.min(1, (p.at + at.off) / book.chars);
  const words = book.hasPages && p.page ? `PAGE ${p.page} OF ${book.pages}` : `${Math.floor(pct * 100)}%`;
  return { n: at.n, off: at.off, page: book.hasPages ? p.page : null, pct, chapter: p.chapter, end, words };
}

/** The first passage of a page (the page itself, or the next one the book has). */
export function pageStart(book: Book, page: number): number | null {
  if (!book.hasPages) return null;
  const n = book.passages.findIndex((p) => (p.page ?? 0) >= page);
  return n < 0 ? null : n;
}

/** "Chapter One: The Lamp" for a heading; the words a chapter is called by in a sentence ("Pages 1–10", "Part 2"). */
export const chapterName = (book: Book, i: number): string => book.chapters[i]?.title ?? '';

/**
 * Sentences of a paragraph with where each starts (the same cuts as assistant/spoken.ts `sentences`: never inside "£1.42" or
 * "8.30", never after "Dr." or "e.g."; a sentence longer than `max` is cut at a comma, else a space).
 */
export function spans(t: string, max = 300): { at: number; text: string }[] {
  const out: { at: number; text: string }[] = [];
  const push = (a: number, b: number) => {
    const raw = t.slice(a, b);
    let start = a + (raw.length - raw.trimStart().length);
    let s = raw.trim();
    while (s.length > max) {
      const slice = s.slice(0, max);
      let cut = Math.max(slice.lastIndexOf(', '), slice.lastIndexOf('; '), slice.lastIndexOf(': ')) + 1;
      if (cut < max / 3) cut = slice.lastIndexOf(' ');
      if (cut < max / 3) cut = max;
      out.push({ at: start, text: s.slice(0, cut).trim() });
      const rest = s.slice(cut);
      start += cut + (rest.length - rest.trimStart().length);
      s = rest.trim();
    }
    if (s) out.push({ at: start, text: s });
  };
  let from = 0;
  for (const m of t.matchAll(/[.!?]+["')\]’”]*(?=\s|$)/g)) {
    const end = m.index! + m[0].length;
    if (m[0].startsWith('.') && m[0].length === 1 && SHORT.test(t.slice(Math.max(from, m.index! - 8), m.index! + 1))) continue;
    push(from, end);
    from = end;
  }
  if (from < t.length) push(from, t.length);
  return out;
}

/** A piece as the voice is given it: one line, nothing a voice must not read. A chapter's head ends on a full stop. */
export function said(piece: Piece): string {
  const t = clean(piece.text.replace(/\s*\n\s*/g, ' '));
  return piece.head && !/[.!?]$/.test(t) ? `${t}.` : t;
}

/** Every piece of a passage, in order. */
export function piecesOfPassage(p: BookPassage): Piece[] {
  const out: Piece[] = [];
  for (const para of p.paras) {
    if (para.head) out.push({ n: p.n, off: para.at, text: para.text, head: true });
    else for (const s of spans(para.text)) out.push({ n: p.n, off: para.at + s.at, text: s.text, head: false });
  }
  return out.filter((x) => said(x));
}

/**
 * The pieces from a place on, a passage at a time (LISTEN pulls them as it goes, never the whole book at once): from the
 * sentence the place is in. The very first is short (its first clause when the sentence is long), so the voice starts at once
 * (BRIEF-TALK-1A 1), and the rest of that sentence follows as the next piece.
 */
export function* piecesFrom(book: Book, n: number, off: number): Generator<Piece> {
  const at = clampPlace(book, n, off);
  let first = true;
  for (let k = at.n; k < book.passages.length; k++) {
    const list = piecesOfPassage(book.passages[k]!);
    // the sentence the place is in: the last piece starting at or before the offset
    let i = 0;
    if (k === at.n) for (let j = 0; j < list.length; j++) if (list[j]!.off <= at.off) i = j;
    for (; i < list.length; i++) {
      const piece = list[i]!;
      if (first && !piece.head) {
        first = false;
        const [a, b] = quickFirst([piece.text]);
        if (b) {
          yield { ...piece, text: a! };
          yield { ...piece, off: piece.off + Math.max(0, piece.text.indexOf(b)), text: b };
          continue;
        }
      }
      first = false;
      yield piece;
    }
  }
}

/** A search's words as stems (the first five letters at most, three at least: "keepers" finds "keeper"). */
const stem = (w: string) => w.slice(0, Math.max(3, Math.min(w.length, 5)));
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export interface Found {
  n: number;
  /** Where the first of his words is in the passage. */
  off: number;
  page: number | null;
  chapter: number;
  /** About 160 characters around it, on one line. */
  around: string;
  /** The words matched (for marking). */
  terms: string[];
}

/** SEARCH inside the book: each passage that holds every word he typed (or the phrase), in the book's order. */
export function findIn(book: Book, words: string, max = 60): Found[] {
  const terms = words.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)?.filter((w) => w.length >= 2) ?? [];
  if (!terms.length) return [];
  const res = terms.map((w) => new RegExp(`(?<![\\p{L}\\p{N}])${escRe(stem(w))}`, 'iu'));
  const out: Found[] = [];
  for (const p of book.passages) {
    if (!res.every((re) => re.test(p.text))) continue;
    const off = Math.min(...res.map((re) => p.text.search(re)).filter((i) => i >= 0));
    let a = Math.max(0, off - 60);
    if (a > 0) a = p.text.indexOf(' ', a) + 1 || a;
    let b = Math.min(p.text.length, off + 120);
    if (b < p.text.length) b = Math.max(p.text.lastIndexOf(' ', b), off + 20);
    out.push({ n: p.n, off, page: p.page, chapter: p.chapter, around: `${a > 0 ? '…' : ''}${p.text.slice(a, b).replace(/\s+/g, ' ').trim()}${b < p.text.length ? '…' : ''}`, terms });
    if (out.length >= max) break;
  }
  return out;
}

/** The words his search typed, marked in `text` (text nodes only, never HTML): [plain, marked, plain, …]. */
export function markParts(text: string, terms: string[]): { text: string; mark: boolean }[] {
  if (!terms.length) return [{ text, mark: false }];
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${terms.map((w) => escRe(stem(w))).join('|')})[\\p{L}\\p{N}]*`, 'giu');
  const out: { text: string; mark: boolean }[] = [];
  let at = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > at) out.push({ text: text.slice(at, m.index), mark: false });
    out.push({ text: m[0], mark: true });
    at = m.index! + m[0].length;
  }
  if (at < text.length) out.push({ text: text.slice(at), mark: false });
  return out;
}
