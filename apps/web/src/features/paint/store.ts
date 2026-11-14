/**
 * PAINT's gallery on this phone (IndexedDB `ghosty-paint`): every painting's layers as PNG pictures, its recorded steps (for the
 * time-lapse), a small cover, its last few versions, and the Recently deleted bin (kept 30 days). Nothing here leaves the phone.
 * With no IndexedDB (a private window) the gallery lasts for this visit only, and says so.
 */
import type { LayerProp, Op } from './engine';

export interface SavedLayer {
  id: string;
  name: string;
  png: Blob;
  mask?: Blob;
  blend: string;
  opacity: number;
  visible: boolean;
  alphaLock: boolean;
  reference: boolean;
  clip?: boolean;
}
export interface Art {
  id: string;
  title: string;
  w: number;
  h: number;
  paper: string;
  created: number;
  edited: number;
  /** strokes made, said on the card */
  strokes: number;
  /** seconds spent drawing */
  secs: number;
  thumb?: Blob;
  /** set when he deleted it: it waits in Recently deleted */
  deleted?: number;
  /** where it was made from: a blank canvas, a colouring page, his photo, a comic panel */
  from?: string;
}
export interface Body { layers: SavedLayer[]; cur: number; log: Op[] }
export interface Version { at: number; layers: SavedLayer[]; thumb?: Blob }
export type { LayerProp };

const DB = 'ghosty-paint';
const mem = { art: new Map<string, unknown>(), body: new Map<string, unknown>(), versions: new Map<string, unknown>() };
type StoreName = keyof typeof mem;
let opening: Promise<IDBDatabase | null> | null = null;
export const galleryInfo = { lasting: true };
export const BIN_DAYS = 30;
export const MAX_VERSIONS = 8;

function idb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') { galleryInfo.lasting = false; return Promise.resolve(null); }
  opening ??= new Promise((resolve) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => { for (const s of Object.keys(mem)) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s); };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => { galleryInfo.lasting = false; resolve(null); };
      r.onblocked = () => resolve(null);
    } catch { galleryInfo.lasting = false; resolve(null); }
  });
  return opening;
}
async function put(store: StoreName, key: string, v: unknown): Promise<void> {
  const db = await idb();
  if (!db) { mem[store].set(key, v); return; }
  await new Promise<void>((res, rej) => {
    const t = db.transaction(store, 'readwrite');
    t.objectStore(store).put(v, key);
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error ?? new Error('could not save'));
  }).catch(() => { galleryInfo.lasting = false; mem[store].set(key, v); });
}
async function get<T>(store: StoreName, key: string): Promise<T | undefined> {
  const db = await idb();
  if (!db) return mem[store].get(key) as T | undefined;
  return new Promise((res) => {
    const r = db.transaction(store).objectStore(store).get(key);
    r.onsuccess = () => res((r.result as T | undefined) ?? (mem[store].get(key) as T | undefined));
    r.onerror = () => res(mem[store].get(key) as T | undefined);
  });
}
async function del(store: StoreName, key: string): Promise<void> {
  mem[store].delete(key);
  const db = await idb();
  if (!db) return;
  await new Promise<void>((res) => { const t = db.transaction(store, 'readwrite'); t.objectStore(store).delete(key); t.oncomplete = () => res(); t.onerror = () => res(); });
}
async function all<T>(store: StoreName): Promise<T[]> {
  const db = await idb();
  if (!db) return [...mem[store].values()] as T[];
  return new Promise((res) => {
    const r = db.transaction(store).objectStore(store).getAll();
    r.onsuccess = () => res([...((r.result as T[]) ?? []), ...([...mem[store].values()] as T[])]);
    r.onerror = () => res([...mem[store].values()] as T[]);
  });
}

/** Every painting not in the bin, newest first; the bin's own list; and anything past its 30 days is let go. */
export async function gallery(): Promise<{ live: Art[]; bin: Art[] }> {
  const list = await all<Art>('art');
  const now = Date.now();
  const bin: Art[] = [], live: Art[] = [];
  for (const a of list) {
    if (a.deleted && now - a.deleted > BIN_DAYS * 86_400_000) { void forget(a.id); continue; }
    (a.deleted ? bin : live).push(a);
  }
  live.sort((x, y) => y.edited - x.edited);
  bin.sort((x, y) => (y.deleted ?? 0) - (x.deleted ?? 0));
  return { live, bin };
}
export const artOf = (id: string): Promise<Art | undefined> => get<Art>('art', id);
export const bodyOf = (id: string): Promise<Body | undefined> => get<Body>('body', id);
export async function keep(a: Art, b: Body): Promise<void> { await put('body', a.id, b); await put('art', a.id, a); }
export const keepArt = (a: Art): Promise<void> => put('art', a.id, a);
export async function toBin(id: string): Promise<void> { const a = await artOf(id); if (a) await put('art', id, { ...a, deleted: Date.now() }); }
export async function restore(id: string): Promise<void> { const a = await artOf(id); if (a) { const { deleted: _d, ...rest } = a; void _d; await put('art', id, rest); } }
export async function forget(id: string): Promise<void> { await del('art', id); await del('body', id); await del('versions', id); }
export const versionsOf = async (id: string): Promise<Version[]> => (await get<Version[]>('versions', id)) ?? [];
export async function keepVersion(id: string, v: Version): Promise<void> {
  const list = [v, ...(await versionsOf(id))].slice(0, MAX_VERSIONS);
  await put('versions', id, list);
}
