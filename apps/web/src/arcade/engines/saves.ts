/**
 * A game's saved files on this phone, in IndexedDB (database `ghosty-arcade-saves`): what an engine keeps between
 * visits (the DOS engine: the files the game itself changed, its saved games and set-up, as one bundle). One store per
 * game; get/put/list/remove and nothing more. Where IndexedDB cannot be opened (a private window), the saves live in
 * memory for this visit only, and the game still plays.
 */

export interface SaveStore {
  /** One saved file's bytes (null: none yet). */
  get(name: string): Promise<Uint8Array | null>;
  put(name: string, data: Uint8Array): Promise<void>;
  /** The names of this game's saved files. */
  list(): Promise<string[]>;
  remove(name: string): Promise<void>;
}

export const SAVES_DB = 'ghosty-arcade-saves';
const STORE = 'saves';

let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no IndexedDB'));
    const r = indexedDB.open(SAVES_DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('IndexedDB would not open'));
    r.onblocked = () => reject(new Error('IndexedDB is blocked'));
  });
  dbp.catch(() => (dbp = null));
  return dbp;
}

const req = <T>(r: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error ?? new Error('IndexedDB request failed'));
});

/** In memory only (the fallback, and the node tests). */
export function memorySaves(): SaveStore {
  const m = new Map<string, Uint8Array>();
  return {
    get: async (n) => (m.has(n) ? m.get(n)!.slice() : null),
    put: async (n, d) => void m.set(n, d.slice()),
    list: async () => [...m.keys()].sort(),
    remove: async (n) => void m.delete(n),
  };
}

/** The saves of one game (keys are [game, name]). */
export function saveStore(game: string): SaveStore {
  const mem = memorySaves();
  const tx = async (mode: IDBTransactionMode) => (await db()).transaction(STORE, mode).objectStore(STORE);
  return {
    async get(name) {
      try {
        const v = await req((await tx('readonly')).get([game, name]));
        return v instanceof Uint8Array ? v : v instanceof ArrayBuffer ? new Uint8Array(v) : await mem.get(name);
      } catch {
        return mem.get(name);
      }
    },
    async put(name, data) {
      await mem.put(name, data);
      try {
        await req((await tx('readwrite')).put(data.slice(), [game, name]));
      } catch {
        /* kept in memory for this visit */
      }
    },
    async list() {
      try {
        const keys = (await req((await tx('readonly')).getAllKeys(IDBKeyRange.bound([game, ''], [game, '￿'])))) as [string, string][];
        return [...new Set([...keys.map((k) => k[1]), ...(await mem.list())])].sort();
      } catch {
        return mem.list();
      }
    },
    async remove(name) {
      await mem.remove(name);
      try {
        await req((await tx('readwrite')).delete([game, name]));
      } catch {
        /* nothing kept */
      }
    },
  };
}
