/**
 * THE COMIC's shelf on this phone (FINAL ROUND, lane COMIC): the comics he imported and the ones he downloaded from the public
 * domain (their pages as pictures, in IndexedDB), the comics he made (their scripts, which draw again), and where he stopped
 * reading each one. Nothing here leaves the phone. When the phone gives no IndexedDB (a private window) the shelf lives for
 * this visit only, and says so.
 */

export interface Book {
  id: string;
  title: string;
  /** a file of his, a public-domain download, or one he made here */
  from: 'file' | 'library' | 'made';
  pages: number;
  bytes: number;
  added: number;
  /** what it was, said: "a CBZ file", "a PDF" */
  kind: string;
  /** for a download: where it came from and its licence, said */
  credit?: string;
  /** a small cover, as a data address */
  thumb?: string;
  /** panel boxes found on each page (fractions), for the guided view */
  panels?: Record<number, [number, number, number, number][]>;
}
export interface Place {
  page: number;
  panel: number;
  at: number;
  /** read right to left (manga) */
  rtl?: boolean;
}

const DB = 'ghosty-comics';
const mem = { books: new Map<string, unknown>(), pages: new Map<string, unknown>(), made: new Map<string, unknown>(), pos: new Map<string, unknown>() };
type StoreName = keyof typeof mem;
let opening: Promise<IDBDatabase | null> | null = null;
export const shelfInfo = { lasting: true };

function idb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    shelfInfo.lasting = false;
    return Promise.resolve(null);
  }
  opening ??= new Promise((resolve) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => {
        for (const s of Object.keys(mem)) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s);
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => {
        shelfInfo.lasting = false;
        resolve(null);
      };
      r.onblocked = () => resolve(null);
    } catch {
      shelfInfo.lasting = false;
      resolve(null);
    }
  });
  return opening;
}
function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((ok, no) => {
    r.onsuccess = () => ok(r.result);
    r.onerror = () => no(r.error);
  });
}
async function put(store: StoreName, key: string, v: unknown): Promise<void> {
  const db = await idb();
  if (!db) return void mem[store].set(key, v);
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).put(v, key);
  await new Promise<void>((ok, no) => {
    tx.oncomplete = () => ok();
    tx.onerror = () => no(tx.error);
    tx.onabort = () => no(tx.error ?? new Error('the phone ran out of room for this comic'));
  });
}
async function get<T>(store: StoreName, key: string): Promise<T | undefined> {
  const db = await idb();
  if (!db) return mem[store].get(key) as T | undefined;
  return (await req(db.transaction(store).objectStore(store).get(key))) as T | undefined;
}
async function all<T>(store: StoreName): Promise<T[]> {
  const db = await idb();
  if (!db) return [...mem[store].values()] as T[];
  return (await req(db.transaction(store).objectStore(store).getAll())) as T[];
}
async function del(store: StoreName, keys: string[]): Promise<void> {
  const db = await idb();
  if (!db) return void keys.forEach((k) => mem[store].delete(k));
  const tx = db.transaction(store, 'readwrite');
  for (const k of keys) tx.objectStore(store).delete(k);
  await new Promise<void>((ok) => {
    tx.oncomplete = () => ok();
    tx.onerror = () => ok();
  });
}

export const pageKey = (id: string, n: number) => `${id}/${n}`;
export async function keepBook(b: Book, pages: Blob[]): Promise<void> {
  let i = 0;
  try {
    for (; i < pages.length; i++) await put('pages', pageKey(b.id, i), pages[i]);
    await put('books', b.id, b);
  } catch (e) {
    // (what was written of it goes, so a half-kept comic never holds room on the phone)
    await del('pages', Array.from({ length: i + 1 }, (_, k) => pageKey(b.id, k))).catch(() => undefined);
    throw e;
  }
}
export const updateBook = (b: Book): Promise<void> => put('books', b.id, b);
export const bookOf = (id: string): Promise<Book | undefined> => get<Book>('books', id);
export const pageOf = (id: string, n: number): Promise<Blob | undefined> => get<Blob>('pages', pageKey(id, n));
export async function books(): Promise<Book[]> {
  return (await all<Book>('books')).filter((b) => b && typeof b.id === 'string').sort((a, b) => b.added - a.added);
}
export async function dropBook(id: string): Promise<void> {
  const b = await bookOf(id);
  await del('pages', Array.from({ length: b?.pages ?? 0 }, (_, i) => pageKey(id, i)));
  await del('books', [id]);
  await del('pos', [id]);
  await del('made', [id]);
}
export const keepMade = (id: string, c: unknown): Promise<void> => put('made', id, c);
export const madeOf = (id: string): Promise<unknown> => get('made', id);
export const allMade = (): Promise<unknown[]> => all('made');
export const placeOf = async (id: string): Promise<Place | undefined> => {
  const p = await get<Place>('pos', id);
  return p && Number.isFinite(p.page) ? p : undefined;
};
export const keepPlace = (id: string, p: Place): Promise<void> => put('pos', id, p);
