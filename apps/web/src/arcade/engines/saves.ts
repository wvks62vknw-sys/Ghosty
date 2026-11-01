/**
 * Saved games on this phone: each engine writes its own save files (DOOM's doomsav0.dsg, Quake's s0.sav) and its
 * settings into the game's SaveStore as it writes them, and gets them back before its next start. They live in
 * IndexedDB ('ghosty-arcade-saves'), one shelf game's apart from another's, and never leave the phone.
 */

export interface SaveStore {
  /** One file's bytes (null when there is none). */
  get(name: string): Promise<Uint8Array | null>;
  put(name: string, data: Uint8Array): Promise<void>;
  /** Every file's name, sorted. */
  list(): Promise<string[]>;
}

export const SAVES_DB = 'ghosty-arcade-saves';
const STORE = 'files';

/** A game's saves in IndexedDB (in memory only where the browser has no IndexedDB, so the game still plays). */
export function saveStore(game: string, idb: IDBFactory | undefined = globalThis.indexedDB): SaveStore {
  if (!idb) return memorySaves();
  const prefix = `${game}/`;
  let opened: Promise<IDBDatabase> | null = null;
  const db = (): Promise<IDBDatabase> =>
    (opened ??= new Promise<IDBDatabase>((resolve, reject) => {
      const r = idb.open(SAVES_DB, 1);
      r.onupgradeneeded = () => {
        if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE);
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error ?? new Error('IndexedDB would not open'));
    }).catch((e) => {
      opened = null; // a later call tries again
      throw e;
    }));
  const run = async <T>(mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const d = await db();
    return new Promise<T>((resolve, reject) => {
      const t = d.transaction(STORE, mode);
      const req = op(t.objectStore(STORE));
      t.oncomplete = () => resolve(req.result);
      t.onerror = () => reject(t.error ?? req.error ?? new Error('IndexedDB failed'));
      t.onabort = () => reject(t.error ?? new Error('IndexedDB gave up'));
    });
  };
  return {
    async get(name) {
      const v: unknown = await run('readonly', (s) => s.get(prefix + name));
      if (v instanceof Uint8Array) return v;
      if (v instanceof ArrayBuffer) return new Uint8Array(v);
      return null;
    },
    async put(name, data) {
      await run('readwrite', (s) => s.put(new Uint8Array(data), prefix + name));
    },
    async list() {
      const keys = await run('readonly', (s) => s.getAllKeys());
      return keys.map(String).filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length)).sort();
    },
  };
}

/** Saves kept in memory (the tests, and a browser without IndexedDB). */
export function memorySaves(seed: Record<string, Uint8Array> = {}): SaveStore {
  const m = new Map(Object.entries(seed).map(([k, v]) => [k, new Uint8Array(v)]));
  return {
    get: async (name) => {
      const v = m.get(name);
      return v ? new Uint8Array(v) : null;
    },
    put: async (name, data) => {
      m.set(name, new Uint8Array(data));
    },
    list: async () => [...m.keys()].sort(),
  };
}
