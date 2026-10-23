/**
 * The GYM's memory on this phone: one record per game (level, mastery, the graph's points and what the
 * learner knows — Q-tables and network weights as typed arrays) in IndexedDB `ghosty-gym`, so training
 * carries on next time; and the GYM's settings (CONTINUE BY HIMSELF, KEEP AWAKE, how far TRAIN ALL got).
 * A plain map where there is no IndexedDB (a private window that refuses it).
 */
import type { AllRun, GymRecord } from '../../gym/session';

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

/** The settings sit beside the games in the same store, under an id no game has. */
const PREFS = '~prefs';
const games = (m: Map<string, GymRecord>) => new Map([...m].filter(([id]) => id !== PREFS));

/** Every game's record. */
export async function loadAll(): Promise<Map<string, GymRecord>> {
  const db = await idb();
  if (!db) return games(mem);
  return new Promise((resolve) => {
    try {
      const req = db.transaction('games').objectStore('games').getAll();
      req.onsuccess = () => {
        const out = new Map<string, GymRecord>();
        for (const r of req.result as GymRecord[]) out.set(r.id, r);
        resolve(games(out));
      };
      req.onerror = () => resolve(games(mem));
    } catch {
      resolve(games(mem));
    }
  });
}

/** The GYM's settings: CONTINUE BY HIMSELF (on unless turned off), KEEP AWAKE (off), how far TRAIN ALL has got. */
export interface GymPrefs {
  carry: boolean;
  awake: boolean;
  all: AllRun | null;
}

const kept = (r: unknown): GymPrefs => {
  const p = (r ?? {}) as Partial<GymPrefs>;
  return { carry: p.carry ?? true, awake: p.awake ?? false, all: p.all ?? null };
};

export async function loadPrefs(): Promise<GymPrefs> {
  const db = await idb();
  if (!db) return kept(mem.get(PREFS));
  return new Promise((resolve) => {
    try {
      const req = db.transaction('games').objectStore('games').get(PREFS);
      req.onsuccess = () => resolve(kept(req.result));
      req.onerror = () => resolve(kept(mem.get(PREFS)));
    } catch {
      resolve(kept(mem.get(PREFS)));
    }
  });
}

export function putPrefs(p: GymPrefs): Promise<void> {
  return put({ ...p, id: PREFS } as unknown as GymRecord);
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
