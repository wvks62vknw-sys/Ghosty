/**
 * The voices this phone knows (BRIEF-VOICE-KNOWN 2, 5; OWNER-ISSUES 131 (7)): his own, enrolled by himself, and the people he
 * introduced with them present — each a name and a few hundred numbers (voiceprint.ts: never a recording), in IndexedDB
 * `ghosty-voices` on this phone and nowhere else. Nothing here talks to the network, nothing is in localStorage, BACKUP &
 * RESTORE leaves this database out (features/system/backup.ts takes only its own list), and each voice goes in one tap
 * (Settings → Voice & home → MY VOICE, PEOPLE I'VE INTRODUCED) with UNDO from memory for a few seconds after. A plain map where
 * there is no IndexedDB (a private window). The shape follows vision/facestore.ts.
 */
import { isPrint, type Known, type Print } from './voiceprint';

export const VOICE_DB = 'ghosty-voices';
const STORE = 'voices';
/** At most this many people besides him: a household and its visitors, not a roll of strangers (and ten profiles are a few kilobytes to compare). */
export const MAX_VOICES = 10;
const mem = new Map<string, Stored>();
let opening: Promise<IDBDatabase | null> | null = null;

export interface Stored extends Known {
  at: number;
}

function idb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  opening ??= new Promise((resolve) => {
    try {
      const r = indexedDB.open(VOICE_DB, 1);
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

/** Everyone this phone knows by voice: him first, then the people he introduced, oldest first. A hurt record is left out. */
export async function knownVoices(): Promise<Stored[]> {
  const all = await tx<Stored[]>('readonly', (s) => s.getAll() as IDBRequest<Stored[]>, () => [...mem.values()]);
  return all.filter((p) => p && isPrint(p.print)).sort((a, b) => Number(b.me) - Number(a.me) || a.at - b.at);
}

async function put(p: Stored): Promise<Stored> {
  mem.set(p.id, p);
  await tx<IDBValidKey>('readwrite', (s) => s.put(p), () => p.id);
  return p;
}

/** His own voice (enrolled again: the new one replaces the old). */
export function saveMine(print: Print, now = Date.now()): Promise<Stored> {
  return put({ id: 'me', name: 'You', me: true, print, at: now });
}

/** Someone he introduced, with them present. */
export async function addVoice(name: string, print: Print, now = Date.now()): Promise<Stored> {
  const others = (await knownVoices()).filter((p) => !p.me);
  if (others.length >= MAX_VOICES) throw new Error(`I already know ${MAX_VOICES} people's voices: forget someone first (Settings → Voice & home → PEOPLE I'VE INTRODUCED)`);
  const id = `v${Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, '0')).join('')}`;
  return put({ id, name: name.trim().slice(0, 24), me: false, print, at: now });
}

/** One voice gone, at once (the record is handed back for UNDO, kept only in memory). */
export async function forgetVoice(id: string): Promise<Stored | null> {
  const was = (await knownVoices()).find((p) => p.id === id) ?? null;
  mem.delete(id);
  await tx<undefined>('readwrite', (s) => s.delete(id), () => undefined);
  return was;
}

/** UNDO: put a voice back as it was. */
export function putBack(p: Stored): Promise<Stored> {
  return put(p);
}
