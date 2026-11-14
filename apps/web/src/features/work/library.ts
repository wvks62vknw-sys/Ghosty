/**
 * YOUR DOCUMENTS LIBRARY (THE NEXT ROUND, the money lane; money.u15 and the Documents page's missing half): every CV, cover letter,
 * email, meeting summary and timesheet I write for him is kept here on this phone as it is shown, with its older versions, so work
 * done once is never lost. The WORK screen's DOCUMENT page lists them to reopen, copy or share, to open in DOCUMENTS (the editor) or
 * to forget. Nothing leaves the phone: the library lives in this phone's own storage, as DOCUMENTS' own list does.
 */
export interface LibVersion {
  at: number;
  text: string;
}
export interface LibDoc {
  id: string;
  title: string;
  kind: string;
  versions: LibVersion[];
}

const KEY = 'ghosty.work.library';
/** At most this many documents and this many versions of each (the oldest go first). */
export const MAX_DOCS = 80;
export const MAX_VERSIONS = 12;

export function listLibrary(): LibDoc[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]') as LibDoc[];
    return Array.isArray(v) ? v.filter((d) => d && typeof d.id === 'string' && Array.isArray(d.versions) && d.versions.length) : [];
  } catch {
    return [];
  }
}
function put(list: LibDoc[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}
const latest = (d: LibDoc): LibVersion => d.versions[d.versions.length - 1]!;
const idOf = () => `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * Keep a document as it is shown: the same title and kind adds a version (nothing new when the words are the same as the latest);
 * newest first in the list. Returns what was kept, or null when the phone's storage is full or the text is empty.
 */
export function keepInLibrary(title: string, kind: string, text: string, now = Date.now()): { doc: LibDoc; added: boolean } | null {
  const t = text.trim();
  if (!t) return null;
  const list = listLibrary();
  const name = title.trim().slice(0, 80) || 'Document';
  const k = (kind || 'document').slice(0, 20);
  let doc = list.find((d) => d.title.toLowerCase() === name.toLowerCase() && d.kind === k);
  let added = true;
  if (doc) {
    if (latest(doc).text === text) added = false;
    else doc.versions = [...doc.versions, { at: now, text }].slice(-MAX_VERSIONS);
  } else doc = { id: idOf(), title: name, kind: k, versions: [{ at: now, text }] };
  const rest = list.filter((d) => d.id !== doc!.id);
  const next = [doc, ...rest].slice(0, MAX_DOCS);
  return put(next) ? { doc, added } : null;
}

export function forgetFromLibrary(id: string): void {
  put(listLibrary().filter((d) => d.id !== id));
}

/** "CV", "Cover letter"…: a kind as he says it. */
export const KIND_WORDS: Record<string, string> = { cv: 'CV', cover: 'Cover letter', email: 'Email', meeting: 'Meeting summary', timesheet: 'Timesheet', letter: 'Letter', document: 'Document' };
