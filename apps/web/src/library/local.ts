/**
 * The owner's library on this device. Every document added here is also kept in the browser
 * (IndexedDB), so it can be searched — by the Library tab and by Ghosty in chat — while the
 * brain's database is paused, and documents added while it is paused are kept here and sent to
 * the brain afterwards (syncLocalDocs). Search is the same keyword match the brain uses when its
 * database is unavailable; no AI.
 */
import type { LibraryDoc, LibraryHit } from '../../../../packages/shared/src/protocol';

export interface LocalPassage {
  text: string;
  heading?: string;
  page?: number;
}
export interface LocalDoc {
  /** This device's id ("local-…"). */
  id: string;
  /** The brain's id once it has the document. */
  brainId?: string;
  title: string;
  source: string;
  kind: string;
  pages: number;
  passages: LocalPassage[];
  at: number;
  /** Removed here while the brain couldn't be told: remove it there later. */
  removed?: boolean;
}

// ---------------------------------------------------------------------------------------
// Storage: IndexedDB in the browser; a plain map where there is none (tests, old browsers).
// ---------------------------------------------------------------------------------------

const DB = 'ghosty-library';
const STORE = 'docs';
let cache: Map<string, LocalDoc> | null = null;

function idb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function all(): Promise<Map<string, LocalDoc>> {
  if (cache) return cache;
  const out = new Map<string, LocalDoc>();
  const db = await idb();
  if (db) {
    await new Promise<void>((resolve) => {
      const r = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      r.onsuccess = () => {
        for (const d of r.result as LocalDoc[]) out.set(d.id, d);
        resolve();
      };
      r.onerror = () => resolve();
    });
  }
  cache = out;
  return out;
}

async function write(d: LocalDoc | { id: string; delete: true }): Promise<void> {
  const docs = await all();
  if ('delete' in d) docs.delete(d.id);
  else docs.set(d.id, d);
  const db = await idb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    const s = tx.objectStore(STORE);
    if ('delete' in d) s.delete(d.id);
    else s.put(d);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve(); // full or blocked: the in-memory copy still serves this session
  });
}

// ---------------------------------------------------------------------------------------

/** Keep a document here; returns this device's copy. */
export async function keepDoc(meta: { title: string; source: string; kind: string; pages: number }, passages: LocalPassage[]): Promise<LocalDoc> {
  const d: LocalDoc = { id: `local-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, ...meta, passages, at: Date.now() };
  await write(d);
  return d;
}

export async function markSynced(id: string, brainId: string): Promise<void> {
  const d = (await all()).get(id);
  if (d) await write({ ...d, brainId });
}

/** Documents here the brain doesn't have yet, shown on the shelf as "on this device". */
export async function pendingDocs(): Promise<LibraryDoc[]> {
  return [...(await all()).values()]
    .filter((d) => !d.brainId && !d.removed)
    .map((d) => ({ id: d.id, title: d.title, source: `${d.source} · on this device, saved to Ghosty when memory is back`, kind: d.kind, pages: d.pages, passages: d.passages.length, chars: d.passages.reduce((n, p) => n + p.text.length, 0), status: 'ready', builtin: false, at: d.at }));
}

/** Brain ids removed here that the brain still has to remove (hidden from the shelf meanwhile). */
export async function removedHere(): Promise<Set<string>> {
  return new Set([...(await all()).values()].filter((d) => d.removed && d.brainId).map((d) => d.brainId!));
}

/** Remove a document (by either id). `brainLater`: the brain couldn't be told, so tell it later. */
export async function removeDoc(id: string, brainLater = false): Promise<void> {
  const docs = await all();
  const d = docs.get(id) ?? [...docs.values()].find((x) => x.brainId === id);
  if (brainLater) {
    await write(d ? { ...d, removed: true } : { id: `local-rm-${id}`, brainId: id, title: '', source: '', kind: '', pages: 0, passages: [], at: Date.now(), removed: true });
  } else if (d) await write({ id: d.id, delete: true });
}

function score(q: string): ((low: string) => number) | null {
  const terms = [...new Set((q.toLowerCase().match(/[a-z0-9][a-z0-9_+#.-]*[a-z0-9+#]|[a-z0-9]/g) ?? []).filter((t) => t.length > 2 && !STOP.has(t)))].slice(0, 12);
  if (!terms.length) return null;
  const stems = terms.map((t) => t.slice(0, Math.max(3, Math.min(t.length, 5))));
  const need = terms.length >= 3 ? 0.5 : 0.99;
  return (low) => {
    const s = stems.filter((x) => low.includes(x)).length / stems.length;
    return s >= need ? s : 0;
  };
}
const STOP = new Set('the and are for from has have how its not our that their them then there these they this was were what when where which who why will with would you your about also any just like more most only other some such very use using want need make get show tell give please ghosty does did can could'.split(' '));

/** Search documents kept here. `onlyPending`: just the ones the brain doesn't have yet. */
export async function searchLocal(q: string, k = 8, onlyPending = false): Promise<LibraryHit[]> {
  const f = score(q);
  if (!f) return [];
  const out: LibraryHit[] = [];
  for (const d of (await all()).values()) {
    if (d.removed || (onlyPending && d.brainId)) continue;
    for (const p of d.passages) {
      const s = f(`${d.title} ${p.heading ?? ''} ${p.text}`.toLowerCase());
      if (s) out.push({ doc: d.brainId ?? d.id, title: d.title, heading: p.heading ?? '', page: p.page ?? null, text: p.text, score: s, relevant: true });
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, k);
}

/** Passages for Ghosty in chat while its database is paused (small: they go with the message). */
export async function passagesFor(q: string): Promise<{ title: string; heading: string; page: number | null; text: string }[]> {
  return (await searchLocal(q, 6)).map((h) => ({ title: h.title, heading: h.heading, page: h.page, text: h.text.slice(0, 1500) }));
}

/**
 * Bring the brain up to date: remove what was removed here, then upload documents it doesn't
 * have. Stops at the first failure (still paused) and tries again next time. Returns how many
 * were uploaded.
 */
export async function syncLocalDocs(api: { upload: (d: LocalDoc) => Promise<LibraryDoc>; remove: (brainId: string) => Promise<unknown> }): Promise<number> {
  let n = 0;
  for (const d of [...(await all()).values()]) {
    try {
      if (d.removed) {
        if (d.brainId) await api.remove(d.brainId);
        await write({ id: d.id, delete: true });
      } else if (!d.brainId) {
        const doc = await api.upload(d);
        await markSynced(d.id, doc.id);
        n++;
      }
    } catch {
      break;
    }
  }
  return n;
}

/** Tests only: forget the in-memory copy. */
export function _reset(): void {
  cache = null;
}
