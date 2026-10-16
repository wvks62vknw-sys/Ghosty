/**
 * Ghosty's whole library on this device (IndexedDB): every book, PDF, note, paper, study
 * session and the built-in starter library, mirrored from the brain a little at a time
 * (mirrorLibrary), plus documents added here that the brain doesn't have yet. It is searched —
 * by the Library tab, by Ghosty in chat, and to answer with no connection at all — whenever the
 * brain's database is paused or unreachable; documents added meanwhile are sent to the brain
 * afterwards (syncLocalDocs). Search is the same keyword match the brain uses when its database
 * is unavailable; no AI.
 */
import type { LibraryDoc, LibraryHit } from '../../../../packages/shared/src/protocol';

export interface LocalPassage {
  text: string;
  heading?: string;
  page?: number;
}
/** A document's details (its passages are stored separately, and only read when searched). */
export interface LocalDoc {
  /** This device's id ("local-…", or "m-…" for a copy of the brain's). */
  id: string;
  /** The brain's id once it has the document. */
  brainId?: string;
  title: string;
  source: string;
  kind: string;
  pages: number;
  /** How many passages, and their total length. */
  count: number;
  chars: number;
  at: number;
  /** Removed here while the brain couldn't be told: remove it there later. */
  removed?: boolean;
  /** Copied from the brain: its passage count and size when copied (re-copied when they change). */
  sig?: string;
  builtin?: boolean;
}
interface StoredPassage extends LocalPassage {
  doc: string;
  n: number;
}

// ---------------------------------------------------------------------------------------
// Storage: IndexedDB in the browser — document details in "docs" (kept in memory, small),
// passages in "pass" keyed [doc, n] (read in batches, never all held at once). Plain maps
// where there is no IndexedDB (tests, old browsers).
// ---------------------------------------------------------------------------------------

const DB = 'ghosty-library';
let cache: Map<string, LocalDoc> | null = null;
let memPass = new Map<string, LocalPassage[]>();
let opening: Promise<IDBDatabase | null> | null = null;

function idb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  opening ??= new Promise((resolve) => {
    try {
      const r = indexedDB.open(DB, 2);
      r.onupgradeneeded = (ev) => {
        const db = r.result;
        if (!db.objectStoreNames.contains('docs')) db.createObjectStore('docs', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('pass')) db.createObjectStore('pass', { keyPath: ['doc', 'n'] });
        // Version 1 kept each document's passages inside it: move them out.
        if (ev.oldVersion === 1) {
          const tx = r.transaction!;
          const docs = tx.objectStore('docs');
          const pass = tx.objectStore('pass');
          docs.openCursor().onsuccess = (e) => {
            const c = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
            if (!c) return;
            const old = c.value as LocalDoc & { passages?: LocalPassage[] };
            const list = old.passages ?? [];
            list.forEach((p, n) => pass.put({ ...p, doc: old.id, n }));
            delete old.passages;
            c.update({ ...old, count: list.length, chars: list.reduce((x, p) => x + p.text.length, 0) });
            c.continue();
          };
        }
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return opening;
}

const docRange = (id: string) => IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER]);
const done = (tx: IDBTransaction) => new Promise<void>((ok) => {
  tx.oncomplete = () => ok();
  tx.onerror = () => ok(); // full or blocked: the in-memory details still serve this session
  tx.onabort = () => ok();
});

/** Every document's details (small; kept in memory). */
async function all(): Promise<Map<string, LocalDoc>> {
  if (cache) return cache;
  const out = new Map<string, LocalDoc>();
  const db = await idb();
  if (db) {
    await new Promise<void>((resolve) => {
      const r = db.transaction('docs', 'readonly').objectStore('docs').getAll();
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

/** Save a document's details, and (when given) replace its passages. */
async function put(d: LocalDoc, passages?: LocalPassage[]): Promise<void> {
  const docs = await all();
  const meta = passages ? { ...d, count: passages.length, chars: passages.reduce((n, p) => n + p.text.length, 0) } : d;
  docs.set(d.id, meta);
  const db = await idb();
  if (!db) {
    if (passages) memPass.set(d.id, passages);
    return;
  }
  const tx = db.transaction(['docs', 'pass'], 'readwrite');
  tx.objectStore('docs').put(meta);
  if (passages) {
    const pass = tx.objectStore('pass');
    pass.delete(docRange(d.id));
    passages.forEach((p, n) => pass.put({ ...p, doc: d.id, n }));
  }
  await done(tx);
}

async function drop(id: string): Promise<void> {
  (await all()).delete(id);
  const db = await idb();
  if (!db) {
    memPass.delete(id);
    return;
  }
  const tx = db.transaction(['docs', 'pass'], 'readwrite');
  tx.objectStore('docs').delete(id);
  tx.objectStore('pass').delete(docRange(id));
  await done(tx);
}

/** One document's passages, in order. */
export async function passagesOf(id: string): Promise<LocalPassage[]> {
  const db = await idb();
  if (!db) return memPass.get(id) ?? [];
  return new Promise((resolve) => {
    const r = db.transaction('pass', 'readonly').objectStore('pass').getAll(docRange(id));
    r.onsuccess = () => resolve((r.result as StoredPassage[]).map(({ text, heading, page }) => ({ text, ...(heading ? { heading } : {}), ...(page ? { page } : {}) })));
    r.onerror = () => resolve([]);
  });
}

/** Every passage, a batch at a time (pausing between batches so the screen never freezes). */
async function eachBatch(fn: (batch: StoredPassage[]) => void): Promise<void> {
  const db = await idb();
  if (!db) {
    for (const [doc, list] of memPass) fn(list.map((p, n) => ({ ...p, doc, n })));
    return;
  }
  let after: IDBValidKey | null = null;
  for (;;) {
    const batch = await new Promise<StoredPassage[]>((resolve) => {
      const r = db.transaction('pass', 'readonly').objectStore('pass').getAll(after === null ? undefined : IDBKeyRange.lowerBound(after, true), 1500);
      r.onsuccess = () => resolve(r.result as StoredPassage[]);
      r.onerror = () => resolve([]);
    });
    if (!batch.length) return;
    fn(batch);
    const last = batch[batch.length - 1]!;
    after = [last.doc, last.n];
    await new Promise((ok) => setTimeout(ok, 0));
  }
}

// ---------------------------------------------------------------------------------------

/** Keep a document here; returns this device's copy. */
export async function keepDoc(meta: { title: string; source: string; kind: string; pages: number }, passages: LocalPassage[]): Promise<LocalDoc> {
  const d: LocalDoc = { id: `local-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, ...meta, count: 0, chars: 0, at: Date.now() };
  await put(d, passages);
  return (await all()).get(d.id)!;
}

export async function markSynced(id: string, brainId: string): Promise<void> {
  const d = (await all()).get(id);
  if (d) await put({ ...d, brainId });
}

/** Documents here the brain doesn't have yet, shown on the shelf as "on this device". */
export async function pendingDocs(): Promise<LibraryDoc[]> {
  return [...(await all()).values()]
    .filter((d) => !d.brainId && !d.removed)
    .map((d) => ({ id: d.id, title: d.title, source: `${d.source} · on this device, saved to Ghosty when memory is back`, kind: d.kind, pages: d.pages, passages: d.count, chars: d.chars, status: 'ready', builtin: false, at: d.at }));
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
    await put(d ? { ...d, removed: true } : { id: `local-rm-${id}`, brainId: id, title: '', source: '', kind: '', pages: 0, count: 0, chars: 0, at: Date.now(), removed: true });
  } else if (d) await drop(d.id);
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

/**
 * Search documents kept here, reading passages from storage a batch at a time (only the best
 * few are kept). `onlyPending`: just the ones the brain doesn't have yet.
 */
export async function searchLocal(q: string, k = 8, onlyPending = false): Promise<LibraryHit[]> {
  const f = score(q);
  if (!f) return [];
  const docs = await all();
  let out: LibraryHit[] = [];
  await eachBatch((batch) => {
    for (const p of batch) {
      const d = docs.get(p.doc);
      if (!d || d.removed || (onlyPending && d.brainId)) continue;
      const s = f(`${d.title} ${p.heading ?? ''} ${p.text}`.toLowerCase());
      if (s) out.push({ doc: d.brainId ?? d.id, title: d.title, heading: p.heading ?? '', page: p.page ?? null, text: p.text, score: s, relevant: true });
    }
    if (out.length > k * 4) out = out.sort((a, b) => b.score - a.score).slice(0, k);
  });
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
let syncing = false;
/** Documents being sent to the brain right now by the Library tab: the sync leaves them alone. */
export const uploading = new Set<string>();
export async function syncLocalDocs(api: { upload: (d: LocalDoc, passages: LocalPassage[]) => Promise<LibraryDoc>; remove: (brainId: string) => Promise<unknown> }): Promise<number> {
  if (syncing) return 0;
  syncing = true;
  let n = 0;
  try {
    for (const d of [...(await all()).values()]) {
      if (uploading.has(d.id)) continue;
      try {
        if (d.removed) {
          if (d.brainId) await api.remove(d.brainId);
          await drop(d.id);
        } else if (!d.brainId) {
          const doc = await api.upload(d, await passagesOf(d.id));
          await markSynced(d.id, doc.id);
          n++;
        }
      } catch {
        break;
      }
    }
  } finally {
    syncing = false;
  }
  return n;
}

// ---------------------------------------------------------------------------------------
// The mirror: the brain's whole library, copied here document by document
// ---------------------------------------------------------------------------------------

export interface MirrorApi {
  docs(): Promise<LibraryDoc[]>;
  passages(id: string, after: number): Promise<{ passages: { rid: number; text: string; heading: string; page: number | null }[]; next: number | null }>;
}

let mirroring = false;
/**
 * Bring this device's copy of the library up to date: copy documents that are new or changed,
 * drop ones the brain no longer has. At most `budget` passages per run (the next run carries
 * on), so it never hogs the connection or the brain's daily database allowance. Returns what
 * it did, and how many documents are still to copy.
 */
export async function mirrorLibrary(api: MirrorApi, budget = 6000): Promise<{ copied: number; dropped: number; left: number }> {
  if (mirroring) return { copied: 0, dropped: 0, left: 0 };
  mirroring = true;
  try {
    const docs = (await api.docs()).filter((d) => d.status === 'ready' && !d.id.startsWith('local-'));
    const have = new Map([...(await all()).values()].filter((d) => d.brainId).map((d) => [d.brainId!, d]));
    const live = new Set(docs.map((d) => d.id));
    let dropped = 0;
    for (const [brainId, d] of have) {
      if (live.has(brainId) || d.removed) continue;
      await drop(d.id);
      dropped++;
    }
    const todo = docs.filter((d) => have.get(d.id)?.sig !== `${d.passages}:${d.chars}`);
    let copied = 0;
    let spent = 0;
    for (const d of todo) {
      if (spent >= budget) break;
      const passages: LocalPassage[] = [];
      let after = 0;
      for (let guard = 0; guard < 200; guard++) {
        const page = await api.passages(d.id, after);
        for (const p of page.passages) passages.push({ text: p.text, ...(p.heading ? { heading: p.heading } : {}), ...(p.page ? { page: p.page } : {}) });
        if (page.next === null || !page.passages.length) break;
        after = page.next;
      }
      const prev = have.get(d.id);
      await put({ id: prev?.id ?? `m-${d.id}`, brainId: d.id, title: d.title, source: d.source, kind: d.kind, pages: d.pages, count: 0, chars: 0, at: d.at, sig: `${d.passages}:${d.chars}`, ...(d.builtin ? { builtin: true } : {}) }, passages);
      spent += passages.length;
      copied++;
    }
    return { copied, dropped, left: todo.length - copied };
  } finally {
    mirroring = false;
  }
}

/** The shelf from this device's copy (used when the brain can't be reached). */
export async function shelf(): Promise<{ docs: LibraryDoc[]; stats: { docs: number; passages: number; chars: number; bytes: number; vectors: number } }> {
  const docs = [...(await all()).values()]
    .filter((d) => !d.removed && d.title)
    .map((d): LibraryDoc => ({ id: d.brainId ?? d.id, title: d.title, source: d.brainId ? d.source : `${d.source} · on this device, saved to Ghosty when memory is back`, kind: d.kind, pages: d.pages, passages: d.count, chars: d.chars, status: 'ready', builtin: !!d.builtin, at: d.at }))
    .sort((a, b) => Number(a.builtin) - Number(b.builtin) || b.at - a.at);
  const passages = docs.reduce((n, d) => n + d.passages, 0);
  const chars = docs.reduce((n, d) => n + d.chars, 0);
  return { docs, stats: { docs: docs.length, passages, chars, bytes: chars, vectors: 0 } };
}

/**
 * An answer from the library alone, for when Ghosty can't be reached at all (no connection):
 * the best passages for the question, or null if nothing matches.
 */
export async function offlineAnswer(q: string): Promise<string | null> {
  const hits = await searchLocal(q, 3);
  if (!hits.length) return null;
  const parts = hits.map((h) => {
    const where = [h.title, h.heading && h.heading !== h.title ? h.heading : '', h.page ? `p. ${h.page}` : ''].filter(Boolean).join(' · ');
    const t = h.text.length > 700 ? `${h.text.slice(0, 700).replace(/\s+\S*$/, '')}…` : h.text;
    return `From "${where}":\n${t}`;
  });
  return `I can't reach my brain right now (no connection), so here is what my library on this device says:\n\n${parts.join('\n\n')}`;
}

/** Ask the browser not to clear the library copy when space runs low. */
export function keepForever(): void {
  try {
    void navigator.storage?.persist?.();
  } catch {
    /* not supported */
  }
}

/** Tests only: forget the in-memory copy. */
export function _reset(): void {
  cache = null;
  memPass = new Map();
}
