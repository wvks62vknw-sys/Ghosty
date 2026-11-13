/**
 * MY SLIDES (BRIEF-EDITOR-PRESENTATIONS): the decks he made, opened or imported, kept on this phone with their dates, never sent
 * anywhere (a picture in one is in the phone's own picture database, docs/images.ts, shared with his documents). The newest
 * first; forty at most and about three megabytes of words, the oldest let go first. A phone whose storage is blocked still edits;
 * it just keeps nothing (said by the screen). Where he was (the deck and the slide) is kept too, so the screen reopens there.
 */
import type { Deck } from './model';

const KEY = 'ghosty.slides';
const WHERE = 'ghosty.slides.where';
const MAX = 40;
const BYTES = 3_000_000;

export function listDecks(): Deck[] {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Deck[];
    return Array.isArray(all) ? all.filter((d) => d && typeof d.id === 'string' && Array.isArray(d.slides)).sort((a, b) => b.at - a.at) : [];
  } catch {
    return [];
  }
}
export const getDeck = (id: string): Deck | null => listDecks().find((d) => d.id === id) ?? null;

/** Kept (or kept again): true when it was saved, false when this phone keeps nothing. */
export function saveDeck(d: Deck): boolean {
  try {
    let all = [{ ...d, at: d.at || Date.now() }, ...listDecks().filter((x) => x.id !== d.id)].slice(0, MAX);
    let text = JSON.stringify(all);
    while (text.length > BYTES && all.length > 1) {
      all = all.slice(0, -1);
      text = JSON.stringify(all);
    }
    localStorage.setItem(KEY, text);
    return true;
  } catch {
    return false;
  }
}
export function removeDeck(id: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(listDecks().filter((d) => d.id !== id)));
    if (where()?.deck === id) localStorage.removeItem(WHERE);
  } catch {
    /* nothing kept to remove */
  }
}
/** The pictures the kept decks hold (so the documents' tidy-up never lets one go). */
export const deckImageIds = (): Set<string> => new Set(listDecks().flatMap((d) => d.slides.flatMap((s) => (s.media?.k === 'img' ? [s.media.img] : []))));

export function where(): { deck: string; slide: string } | null {
  try {
    const w = JSON.parse(localStorage.getItem(WHERE) ?? 'null') as { deck?: string; slide?: string } | null;
    return w && typeof w.deck === 'string' ? { deck: w.deck, slide: typeof w.slide === 'string' ? w.slide : '' } : null;
  } catch {
    return null;
  }
}
export function keepWhere(deck: string, slide: string): void {
  try {
    if (deck) localStorage.setItem(WHERE, JSON.stringify({ deck, slide }));
    else localStorage.removeItem(WHERE);
  } catch {
    /* not kept */
  }
}
export const whenWords = (ms: number): string => new Date(ms).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
