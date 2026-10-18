/**
 * The GYM's memory on this phone: one record per game (level, mastery, the graph's points and what the
 * learner knows — Q-tables and network weights as typed arrays) in IndexedDB `ghosty-gym`, so training
 * carries on next time. A plain map where there is no IndexedDB (a private window that refuses it).
 */
import type { GymRecord } from '../../gym/session';

const DB = 'ghosty-gym';
const mem = new Map<string, GymRecord>();
let opening: Promise<IDBDatabase | null> | null = null;

function idb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  opening ??= new Promise((resolve) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => {
        if (!r.result.objectStoreNames.contains('games')) r.result.createObjectStore('games', { keyPath: 'id' });
      };
      r.onsuccess = () => {
        const db = r.result;
        db.onversionchange = () => {
          db.close();
          opening = null;
        };
        resolve(db);
      };
      r.onerror = () => resolve(null);
      r.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return opening;
}

/** Every game's record. */
export async function loadAll(): Promise<Map<string, GymRecord>> {
  const db = await idb();
  if (!db) return new Map(mem);
  return new Promise((resolve) => {
    try {
      const req = db.transaction('games').objectStore('games').getAll();
      req.onsuccess = () => {
        const out = new Map<string, GymRecord>();
        for (const r of req.result as GymRecord[]) out.set(r.id, r);
        resolve(out);
      };
      req.onerror = () => resolve(new Map(mem));
    } catch {
      resolve(new Map(mem));
    }
  });
}

export async function put(rec: GymRecord): Promise<void> {
  mem.set(rec.id, rec);
  const db = await idb();
  if (!db) return;
  await new Promise<void>((ok) => {
    try {
      const tx = db.transaction('games', 'readwrite');
      tx.objectStore('games').put(rec);
      tx.oncomplete = () => ok();
      tx.onerror = () => ok();
      tx.onabort = () => ok();
    } catch {
      ok();
    }
  });
}

export async function remove(id: string): Promise<void> {
  mem.delete(id);
  const db = await idb();
  if (!db) return;
  await new Promise<void>((ok) => {
    try {
      const tx = db.transaction('games', 'readwrite');
      tx.objectStore('games').delete(id);
      tx.oncomplete = () => ok();
      tx.onerror = () => ok();
      tx.onabort = () => ok();
    } catch {
      ok();
    }
  });
}
