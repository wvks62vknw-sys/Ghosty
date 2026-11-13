/**
 * MY SPREADSHEETS (BRIEF-EDITOR-SPREADSHEETS): the workbooks he made, read or was given, kept on this phone as he works (never sent anywhere), the
 * newest first, twenty at most and about four megabytes, the oldest let go first. A phone whose storage is blocked still edits; it keeps nothing,
 * and the screen says so.
 */
import type { Book } from './model';

const KEY = 'ghosty.sheets';
const MAX = 20;
const BYTES = 4_000_000;

export function listBooks(): Book[] {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Book[];
    return Array.isArray(all) ? all.filter((b) => b && typeof b.id === 'string' && Array.isArray(b.sheets) && b.sheets.length).sort((a, b) => b.at - a.at) : [];
  } catch {
    return [];
  }
}
export const getBook = (id: string): Book | null => listBooks().find((b) => b.id === id) ?? null;

/** Kept (or kept again): true when it was saved, false when this phone keeps nothing. */
export function saveBook(b: Book): boolean {
  try {
    let all = [{ ...b, at: b.at || Date.now() }, ...listBooks().filter((x) => x.id !== b.id)].slice(0, MAX);
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
export function removeBook(id: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(listBooks().filter((b) => b.id !== id)));
  } catch {
    /* nothing kept to remove */
  }
}
/** "1 Nov 2026, 14:32": when a workbook was last changed. */
export const whenWords = (ms: number): string => new Date(ms).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
