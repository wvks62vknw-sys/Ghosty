/**
 * HIS PLACE IN EACH BOOK (BRIEF-LIBRARY-READER 2), and how he likes to read (SETTINGS → READING).
 *
 * The place is a passage and how far into it (library/book.ts), with its page, how far through and whether he finished. It
 * is kept on this phone at once (the store saves 200 ms after a change: core/store.ts) and sent to the brain a moment later
 * (/library/place), so his other devices open the book where he left it; the brain keeps the newer of two places, and a
 * phone that finds the brain's newer moves there. A book only on this phone (not yet sent to the brain) keeps its place here
 * only. When Ghosty is put away (the app hidden, the page closed) whatever is waiting is saved and sent at once.
 */
import { brain, unreachable } from '../api/brain';
import { createStore } from '../core/store';
import type { BookPlace } from '../../../../packages/shared/src/protocol';

export type Place = Omit<BookPlace, 'doc'>;

/** Every book's place on this phone, by the book's id as the Shelf knows it. */
export const places = createStore<{ map: Record<string, Place> }>({ map: {} }, { persist: 'ghosty.places' });

/** What the checks read (window.__ghosty.reader.places): places set, sent, and taken from the brain. */
export const placeStats = { set: 0, sent: 0, adopted: 0, failed: 0, lastSent: null as BookPlace | null, sentAt: 0, failedAt: 0 };

const isLocal = (doc: string) => doc.startsWith('local-');
const SEND_MS = 1500;

export function placeOf(doc: string): Place | null {
  const p = places.get().map[doc];
  return p && Number.isFinite(p.n) ? p : null;
}

const waiting = new Set<string>();
let sendTimer = 0;

/** The place he is at now in `doc`: kept here at once (saved 200 ms later), sent to the brain a moment after the last change. */
export function setPlace(doc: string, p: Omit<Place, 'at' | 'done'> & { done?: boolean }, opts: { at?: number } = {}): void {
  if (!doc) return;
  const prev = placeOf(doc);
  const next: Place = { n: p.n, off: p.off, page: p.page ?? null, pct: Math.round(Math.max(0, Math.min(1, p.pct)) * 1000) / 1000, done: p.done ?? (prev?.done && prev.n === p.n ? true : false), at: opts.at ?? Date.now() };
  places.set((s) => ({ map: { ...s.map, [doc]: next } }));
  placeStats.set++;
  if (isLocal(doc)) return;
  waiting.add(doc);
  clearTimeout(sendTimer);
  sendTimer = window.setTimeout(() => void sendPlaces(), SEND_MS);
}

/** A book's place forgotten (it left the library). */
export function forgetPlace(doc: string): void {
  if (!placeOf(doc)) return;
  places.set((s) => {
    const map = { ...s.map };
    delete map[doc];
    return { map };
  });
}

/** The newer place the brain had (another device moved on): taken here, never sent back. */
function adopt(doc: string, p: BookPlace): void {
  const mine = placeOf(doc);
  if (mine && mine.at >= p.at) return;
  places.set((s) => ({ map: { ...s.map, [doc]: { n: p.n, off: p.off, page: p.page, pct: p.pct, done: p.done, at: p.at } } }));
  placeStats.adopted++;
}

/** Send every place waiting (a book whose send fails waits for the next change, or the next time Ghosty is put away). */
export async function sendPlaces(): Promise<void> {
  clearTimeout(sendTimer);
  const docs = [...waiting];
  waiting.clear();
  await Promise.all(docs.map(async (doc) => {
    const p = placeOf(doc);
    if (!p) return;
    const body: BookPlace = { doc, ...p };
    try {
      const r = await brain.placePut(body);
      placeStats.sent++;
      placeStats.lastSent = body;
      placeStats.sentAt = Date.now();
      if (r.newer) adopt(doc, r.place);
    } catch (e) {
      placeStats.failed++;
      placeStats.failedAt = Date.now();
      // no signal, or the brain's database resting: kept here, and sent with the next change
      if (unreachable(e)) waiting.add(doc);
    }
  }));
}

/**
 * The brain's place for one book (another device may have moved on): the newer of the two is kept. Resolves with the place
 * to open at; at most `ms` is waited for the brain (the book opens on this phone's place meanwhile).
 */
export async function syncPlace(doc: string, ms = 1200): Promise<Place | null> {
  if (isLocal(doc)) return placeOf(doc);
  try {
    const r = await Promise.race([brain.placeGet(doc), new Promise<null>((res) => setTimeout(() => res(null), ms))]);
    if (r?.place) adopt(doc, r.place);
  } catch {
    /* no signal: this phone's own place */
  }
  return placeOf(doc);
}

/** Every book's place from the brain (the Shelf's progress after reading on another device). */
export async function syncPlaces(): Promise<void> {
  try {
    const r = await brain.placesGet();
    for (const [doc, p] of Object.entries(r.places ?? {})) adopt(doc, p);
  } catch {
    /* no signal: this phone's places */
  }
}

// put away (another app, the lock screen) or closed: what is waiting goes now
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => document.hidden && waiting.size && void sendPlaces());
  addEventListener('pagehide', () => waiting.size && void sendPlaces());
}

// ---------------------------------------------------------------------------------------------------------------- reading

/** Text sizes he can pick, in points: never under 12, 17 to start (the readability floor: OWNER-ISSUES 139). */
export const SIZES = [12, 14, 15, 17, 19, 21, 24, 28] as const;
export const DEFAULT_SIZE = 17;

export interface ReadingPrefs {
  /** Scroll down the page, or turn it a screen at a time. */
  mode: 'scroll' | 'pages';
  /** The book's words in points. */
  size: number;
  /** HIS VOICE FOR BOOKS: my own voice from the brain reads a book (about an hour a day), the phone's voice after it. */
  bookVoice: boolean;
}

/** SETTINGS → READING (and the reader's own TEXT key): kept on this phone. */
export const readingPrefs = createStore<ReadingPrefs>({ mode: 'scroll', size: DEFAULT_SIZE, bookVoice: false }, { persist: 'ghosty.reading' });

/** The size kept within the floor and the list. */
export const sizeNow = (): number => {
  const s = Number(readingPrefs.get().size);
  return SIZES.includes(s as (typeof SIZES)[number]) ? s : DEFAULT_SIZE;
};

/** A line's height for a size, on the 4-point grid (17 → 28, 12 → 20, 28 → 44). */
export const lineFor = (size: number): number => Math.ceil((size * 1.5) / 4) * 4;

/** "yesterday", "today", "3 days ago", "on 2 Nov": when he was last in a book, as he says it. */
export function whenWords(at: number, now = Date.now()): string {
  if (!at) return '';
  const day = (t: number) => new Date(new Date(t).getFullYear(), new Date(t).getMonth(), new Date(t).getDate()).getTime();
  const days = Math.round((day(now) - day(at)) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return `on ${new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}
