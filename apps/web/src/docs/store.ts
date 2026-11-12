/**
 * MY DOCUMENTS (BRIEF-REST-E part 2): the documents he wrote, read or translated, kept on this phone with their dates —
 * never sent anywhere (a picture in one is kept in the phone's own database, docs/images.ts). The newest first; a hundred at most and about four megabytes of words, the oldest let go first (said by
 * `room()`). A phone whose storage is blocked still edits; it just keeps nothing.
 */
import { keepOnly } from './images';
import type { Doc } from './model';

const KEY = 'ghosty.docs';
const MAX = 100;
const BYTES = 4_000_000;

export function listDocs(): Doc[] {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Doc[];
    return Array.isArray(all) ? all.filter((d) => d && typeof d.id === 'string' && Array.isArray(d.blocks)).sort((a, b) => b.at - a.at) : [];
  } catch {
    return [];
  }
}

export const getDoc = (id: string): Doc | null => listDocs().find((d) => d.id === id) ?? null;

/** Kept (or kept again): true when it was saved, false when this phone keeps nothing. */
export function saveDoc(d: Doc): boolean {
  try {
    let all = [{ ...d, at: d.at || Date.now() }, ...listDocs().filter((x) => x.id !== d.id)].slice(0, MAX);
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

export function removeDoc(id: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(listDocs().filter((d) => d.id !== id)));
    tidyImages();
  } catch {
    /* nothing kept to remove */
  }
}

/** "1 Nov 2026, 14:32": when a document was last changed. */
export const whenWords = (ms: number): string => new Date(ms).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Today as a letter has it: "1 November 2026". */
export const letterDate = (d = new Date()): string => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/** The pictures the kept documents hold. */
export const imagesInUse = (): Set<string> => new Set(listDocs().flatMap((d) => d.blocks.flatMap((b) => (b.img ? [b.img] : []))));

/** Let go of the pictures no kept document holds any more (after one is removed, and when the list is shown). */
export const tidyImages = (): void => void keepOnly(imagesInUse()).catch(() => undefined);
