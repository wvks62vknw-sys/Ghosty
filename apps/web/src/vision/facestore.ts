/**
 * The faces this phone knows (OWNER-ISSUES 55, 56): the owner's, enrolled by himself, and the people he introduced in
 * person — each a name and a few looks (128 numbers each, never a picture), in IndexedDB `ghosty-faces` on this phone
 * and nowhere else. Nothing here talks to the network: the brain never receives a face, BACKUP & RESTORE leaves this
 * database out (features/system/backup.ts takes only its own list), and each face goes in one tap (Settings → PRIVACY →
 * FACES), with UNDO from memory for a few seconds after. A plain map where there is no IndexedDB (a private window).
 */
import { packLook, type KnownFace } from './facemath';

export const FACE_DB = 'ghosty-faces';
const STORE = 'people';
/** At most this many people besides him (a phone's worth of faces he met, not a database of strangers). */
export const MAX_PEOPLE = 50;
const mem = new Map<string, KnownFace>();
let opening: Promise<IDBDatabase | null> | null = null;

function idb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  opening ??= new Promise((resolve) => {
    try {
      const r = indexedDB.open(FACE_DB, 1);
      r.onupgradeneeded = () => {
        if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE, { keyPath: 'id' });
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

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T> | null, fallback: () => T): Promise<T> {
  return idb().then(
    (db) =>
      new Promise<T>((resolve) => {
        if (!db) return resolve(fallback());
        try {
          const t = db.transaction(STORE, mode);
          const req = run(t.objectStore(STORE));
          t.oncomplete = () => resolve(req ? req.result : fallback());
          t.onerror = () => resolve(fallback());
          t.onabort = () => resolve(fallback());
        } catch {
          resolve(fallback());
        }
      }),
  );
}

/** Everyone this phone knows: him first, then the people he introduced, oldest first. */
export async function knownFaces(): Promise<KnownFace[]> {
  const all = await tx<KnownFace[]>('readonly', (s) => s.getAll() as IDBRequest<KnownFace[]>, () => [...mem.values()]);
  return all.filter((p) => p && Array.isArray(p.looks) && p.looks.length).sort((a, b) => Number(b.me) - Number(a.me) || a.at - b.at);
}

async function put(p: KnownFace): Promise<KnownFace> {
  mem.set(p.id, p);
  await tx<IDBValidKey>('readwrite', (s) => s.put(p), () => p.id);
  return p;
}

/** His own face (enrolled again: the new looks replace the old). */
export function saveMe(looks: ArrayLike<number>[], now = Date.now()): Promise<KnownFace> {
  return put({ id: 'me', name: 'You', me: true, looks: looks.map(packLook), at: now });
}

/** Someone he introduced in person. */
export async function addPerson(name: string, looks: ArrayLike<number>[], now = Date.now()): Promise<KnownFace> {
  const others = (await knownFaces()).filter((p) => !p.me);
  if (others.length >= MAX_PEOPLE) throw new Error(`I already know ${MAX_PEOPLE} people's faces: forget someone first (Settings → PRIVACY → FACES)`);
  const id = `p${Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, '0')).join('')}`;
  return put({ id, name: name.trim().slice(0, 40), me: false, looks: looks.map(packLook), at: now });
}

/** One face gone, at once (the record is handed back for UNDO, kept only in memory). */
export async function forgetFace(id: string): Promise<KnownFace | null> {
  const was = (await knownFaces()).find((p) => p.id === id) ?? null;
  mem.delete(id);
  await tx<undefined>('readwrite', (s) => s.delete(id), () => undefined);
  return was;
}

/** UNDO: put a face back as it was. */
export function putBack(p: KnownFace): Promise<KnownFace> {
  return put(p);
}
