/**
 * WHAT FILES KEEPS OF ITS OWN (THE APPS ROUND, lane BOOT): on this phone only.
 *  - Its notes about everything it lists (localStorage `ghosty.files`): tags, the star, the folder, a name he gave it, when he last opened it.
 *  - The files he imported from the phone (IndexedDB `ghosty-files`, store `own`): the bytes untouched, with their name, type and size.
 *  - Recently deleted (store `bin`): what was deleted, whole, kept 30 days so RESTORE puts it back exactly.
 * Where the phone gives no database (a private window) the files and the bin live for this visit only, and `filesStore.lasting` says so.
 */
import { BIN_DAYS } from './words';

export interface Note { tags?: string[]; fav?: boolean; folder?: string; name?: string; opened?: number }
interface Notes { items: Record<string, Note>; folders: string[] }
const KEY = 'ghosty.files';

export function notes(): Notes {
  try {
    const n = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Notes | null;
    if (n && typeof n.items === 'object' && Array.isArray(n.folders)) return n;
  } catch {
    /* none kept */
  }
  return { items: {}, folders: [] };
}
export function saveNotes(n: Notes): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(n));
    return true;
  } catch {
    return false;
  }
}
export const noteOf = (key: string): Note => notes().items[key] ?? {};
export function setNote(key: string, patch: Partial<Note>): void {
  const n = notes();
  const cur = { ...(n.items[key] ?? {}), ...patch };
  for (const k of Object.keys(cur) as (keyof Note)[]) if (cur[k] === undefined || cur[k] === '' || (Array.isArray(cur[k]) && !(cur[k] as unknown[]).length) || cur[k] === false) delete cur[k];
  if (Object.keys(cur).length) n.items[key] = cur;
  else delete n.items[key];
  if (patch.folder && !n.folders.includes(patch.folder)) n.folders.push(patch.folder);
  saveNotes(n);
}
export function addFolder(name: string): void {
  const n = notes();
  if (name && !n.folders.includes(name)) n.folders.push(name);
  saveNotes(n);
}
export function dropFolder(name: string): void {
  const n = notes();
  n.folders = n.folders.filter((f) => f !== name);
  for (const k of Object.keys(n.items)) if (n.items[k]!.folder === name) delete n.items[k]!.folder;
  saveNotes(n);
}

// ---------------------------------------------------------------- the database: his imported files and the bin
export interface OwnFile { id: string; name: string; type: string; size: number; at: number; blob: Blob }
export interface Binned { key: string; src: string; id: string; name: string; kind: string; size: number; deletedAt: number; data?: string; own?: OwnFile; note?: Note }

export const filesStore = { lasting: true };
const mem = { own: new Map<string, OwnFile>(), bin: new Map<string, Binned>() };
let dbp: Promise<IDBDatabase | null> | null = null;
function db(): Promise<IDBDatabase | null> {
  dbp ??= new Promise((res) => {
    try {
      const r = indexedDB.open('ghosty-files', 1);
      r.onupgradeneeded = () => {
        r.result.createObjectStore('own', { keyPath: 'id' });
        r.result.createObjectStore('bin', { keyPath: 'key' });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => {
        filesStore.lasting = false;
        res(null);
      };
    } catch {
      filesStore.lasting = false;
      res(null);
    }
  });
  return dbp;
}
const req = <T>(r: IDBRequest<T>): Promise<T> => new Promise((ok, no) => {
  r.onsuccess = () => ok(r.result);
  r.onerror = () => no(r.error);
});
async function all<T>(store: 'own' | 'bin'): Promise<T[]> {
  const d = await db();
  if (!d) return [...(mem[store] as Map<string, T>).values()];
  return req(d.transaction(store, 'readonly').objectStore(store).getAll() as IDBRequest<T[]>);
}
async function put(store: 'own' | 'bin', v: OwnFile | Binned): Promise<void> {
  const d = await db();
  if (!d) return void (mem[store] as Map<string, unknown>).set(store === 'own' ? (v as OwnFile).id : (v as Binned).key, v);
  await req(d.transaction(store, 'readwrite').objectStore(store).put(v));
}
async function del(store: 'own' | 'bin', k: string): Promise<void> {
  const d = await db();
  if (!d) return void mem[store].delete(k);
  await req(d.transaction(store, 'readwrite').objectStore(store).delete(k));
}

export const ownFiles = (): Promise<OwnFile[]> => all<OwnFile>('own');
export const keepOwn = (f: OwnFile): Promise<void> => put('own', f);
export const dropOwn = (id: string): Promise<void> => del('own', id);

/** Recently deleted, newest first; what has waited past BIN_DAYS is let go here. */
export async function binned(now = Date.now()): Promise<Binned[]> {
  const l = await all<Binned>('bin');
  const keep: Binned[] = [];
  for (const b of l) {
    if (now - b.deletedAt > BIN_DAYS * 86_400_000) await del('bin', b.key);
    else keep.push(b);
  }
  return keep.sort((a, b) => b.deletedAt - a.deletedAt);
}
export const toBin = (b: Binned): Promise<void> => put('bin', b);
export const outOfBin = (key: string): Promise<void> => del('bin', key);
