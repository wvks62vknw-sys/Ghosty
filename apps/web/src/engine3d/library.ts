/**
 * THE PRODUCT LIBRARY'S FREE MODELS SHELF (BRIEF-ENGINE-3D-1): the free, licence-clear models the app already lists (the Objaverse
 * index it ships, public/data/models3d.json: Sketchfab models released CC0 or CC BY 4.0, furniture and home things, each with its size in
 * kB; the credit line that CC BY asks for travels with the object, the saved scene and the exported file), each row saying
 * what it is, how big the download is, its licence and its author. Listing the shelf downloads no model. A model's file is fetched
 * ONLY on his tap, and not on mobile data (the browser says cellular or save-data: the tap then says it waits for Wi-Fi and fetches
 * nothing); once fetched it is kept on this phone (its own IndexedDB, `ghosty-engine3d`) so a saved scene reopens without a second
 * download, and it can be removed.
 */
import { creditLine, objaverseItems, searchCatalog, type CatalogItem } from '../../../../packages/shared/src/models3d';
import { fetchModel } from '../features/studio/catalog';
import { bytesWords } from './scene';

export const SHELF_GROUPS = ['Furniture', 'Home & decor', 'Kitchen & dining', 'Bathroom & cleaning', 'Electronics', 'Office & school'];
export const SHELF_LIMIT = 60;

export interface FreeModel {
  id: string;
  name: string;
  kb: number;
  licence: string;
  author: string;
  credit: string;
  page: string;
  group: string;
  item: CatalogItem;
}

const toFree = (it: CatalogItem): FreeModel => ({ id: it.id, name: it.name, kb: it.kb, licence: it.licence, author: it.author, credit: creditLine(it), page: it.page, group: it.group, item: it });

let listing: Promise<CatalogItem[]> | null = null;
/** The free furniture and home models of the shipped index (CC0 or CC BY 4.0: one small file, read once a visit). No model is downloaded here. */
export function loadFree(): Promise<CatalogItem[]> {
  listing ??= fetch('/data/models3d.json')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((j) => objaverseItems(j).filter((i) => (i.licence === 'CC0' || i.licence === 'CC BY 4.0') && i.kb > 0 && SHELF_GROUPS.includes(i.group)))
    .catch(() => {
      listing = null;
      return [] as CatalogItem[];
    });
  return listing;
}

/** The shelf for a search: the lightest first when there are no words. */
export async function freeShelf(query = ''): Promise<FreeModel[]> {
  const all = await loadFree();
  if (!query.trim()) return [...all].sort((a, b) => a.kb - b.kb).slice(0, SHELF_LIMIT).map(toFree);
  return searchCatalog(all, query, { limit: SHELF_LIMIT }).map((h) => toFree(h.item));
}

/** On mobile data, as far as the browser can tell (Safari cannot: the words ask for Wi-Fi). */
export function onMobileData(): boolean {
  const c = (globalThis.navigator as unknown as { connection?: { type?: string; saveData?: boolean } } | undefined)?.connection;
  return c?.type === 'cellular' || c?.saveData === true;
}

export const getWords = (m: Pick<FreeModel, 'kb'>) => `GET ${bytesWords(m.kb)}`;
export const waitWords = (m: Pick<FreeModel, 'name' | 'kb'>) => `You are on mobile data, and ${m.name} is ${bytesWords(m.kb)}: it waits for Wi-Fi. Join Wi-Fi and tap GET again.`;

// ---------------------------------------------------------------- the files kept on this phone

const mem = new Map<string, ArrayBuffer>();
let opening: Promise<IDBDatabase | null> | null = null;
function idb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  opening ??= new Promise((resolve) => {
    try {
      const r = indexedDB.open('ghosty-engine3d', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('files');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(null);
      r.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return opening;
}
const finish = (tx: IDBTransaction) =>
  new Promise<void>((ok) => {
    tx.oncomplete = () => ok();
    tx.onerror = () => ok();
    tx.onabort = () => ok();
  });

export async function keepFile(id: string, glb: ArrayBuffer): Promise<void> {
  mem.set(id, glb);
  const db = await idb();
  if (!db) return;
  try {
    const tx = db.transaction('files', 'readwrite');
    tx.objectStore('files').put(glb, id);
    await finish(tx);
  } catch {
    // a full phone: it stands in this visit and is fetched again on his tap next time
  }
}

export async function keptFile(id: string): Promise<ArrayBuffer | null> {
  const hit = mem.get(id);
  if (hit) return hit;
  const db = await idb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction('files').objectStore('files').get(id);
      req.onsuccess = () => resolve((req.result as ArrayBuffer | undefined) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function keptIds(): Promise<string[]> {
  const db = await idb();
  if (!db) return [...mem.keys()];
  return new Promise((resolve) => {
    try {
      const req = db.transaction('files').objectStore('files').getAllKeys();
      req.onsuccess = () => resolve((req.result as IDBValidKey[]).map(String));
      req.onerror = () => resolve([...mem.keys()]);
    } catch {
      resolve([...mem.keys()]);
    }
  });
}

export async function forgetFile(id: string): Promise<void> {
  mem.delete(id);
  const db = await idb();
  if (!db) return;
  try {
    const tx = db.transaction('files', 'readwrite');
    tx.objectStore('files').delete(id);
    await finish(tx);
  } catch {
    // nothing to remove
  }
}

/** A model's file: the phone's own copy if it has one, else fetched (his tap has been made; Wi-Fi is checked by the caller). */
export async function modelFile(m: FreeModel, progress: (pct: number | null) => void = () => undefined): Promise<ArrayBuffer> {
  const have = await keptFile(m.id);
  if (have) return have;
  const glb = await fetchModel(m.item, progress);
  await keepFile(m.id, glb);
  return glb;
}
