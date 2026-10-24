/**
 * Ghosty's whole library on this device (IndexedDB): every book, PDF, note, paper, study
 * session and the built-in starter library, mirrored from the brain a little at a time
 * (mirrorLibrary), plus documents added here that the brain doesn't have yet. It is searched —
 * by the Library tab, by Ghosty in chat, and to answer with no connection at all — whenever the
 * brain's database is paused or unreachable; documents added meanwhile are sent to the brain
 * afterwards (syncLocalDocs). Search is the keyword match the brain uses when its database is
 * unavailable — and, once SEARCH BY MEANING is on this phone (library/meaning.ts, offline/embed.ts), by meaning:
 * every passage gets a meaning vector, kept here beside it ("vec", int8 with a scale: 388 bytes a passage), and
 * a question's vector ranks them (packages/shared/src/meaning.ts), blended with the keyword score. The vectors
 * are worked out on this phone and never leave it.
 */
import type { LibraryDoc, LibraryHit } from '../../../../packages/shared/src/protocol';
import { cosine, exactTitle, prunePool, quantise, rank, spreadOf, wordMatcher, type SearchHow, type Signals } from '../../../../packages/shared/src/meaning';

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
  /** Copied from the brain: the brain's row id of the last passage here, so a notebook that grew is read on from there. */
  lastRid?: number;
  builtin?: boolean;
}
interface StoredPassage extends LocalPassage {
  doc: string;
  n: number;
}

// ---------------------------------------------------------------------------------------
// Storage: IndexedDB in the browser — document details in "docs" (kept in memory, small),
// passages in "pass" keyed [doc, n] (read in batches, never all held at once), their meaning
// vectors in "vec" under the same keys ({ q: Int8Array, s }). Plain maps where there is no
// IndexedDB (tests, old browsers).
// ---------------------------------------------------------------------------------------

const DB = 'ghosty-library';
let cache: Map<string, LocalDoc> | null = null;
let memPass = new Map<string, LocalPassage[]>();
/** A passage's meaning vector, as kept: int8 numbers and their scale. */
export interface KeptVector {
  q: Int8Array;
  s: number;
}
interface StoredVector extends KeptVector {
  doc: string;
  n: number;
}
let memVec = new Map<string, KeptVector>();
const vk = (doc: string, n: number) => `${doc}\u0000${n}`;
const dropMemVec = (doc: string, from = 0) => {
  for (const k of [...memVec.keys()]) {
    const [d, n] = k.split('\u0000');
    if (d === doc && Number(n) >= from) memVec.delete(k);
  }
};
/** Told whenever documents are added, changed or removed here (the meaning index catches up). */
const watchers = new Set<() => void>();
export function onLibraryChange(fn: () => void): () => void {
  watchers.add(fn);
  return () => watchers.delete(fn);
}
const changed = () => watchers.forEach((fn) => fn());
let opening: Promise<IDBDatabase | null> | null = null;

function idb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  opening ??= new Promise((resolve) => {
    try {
      // Version 3 adds the meaning vectors ("vec").
      const r = indexedDB.open(DB, 3);
      r.onupgradeneeded = (ev) => {
        const db = r.result;
        if (!db.objectStoreNames.contains('docs')) db.createObjectStore('docs', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('pass')) db.createObjectStore('pass', { keyPath: ['doc', 'n'] });
        if (!db.objectStoreNames.contains('vec')) db.createObjectStore('vec', { keyPath: ['doc', 'n'] });
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
      r.onsuccess = () => {
        const db = r.result;
        // A newer version of Ghosty in another tab needs to upgrade: step aside.
        db.onversionchange = () => {
          db.close();
          opening = null;
          cache = null;
        };
        // (after a block, this arrives once the older tab closes: use storage from then on)
        opening = Promise.resolve(db);
        cache = null;
        resolve(db);
      };
      r.onerror = () => {
        opening = null;
        resolve(null);
      };
      // An older tab still has the previous version open: do without storage until it closes.
      // (Not retried meanwhile: a second open would only queue behind this one.)
      r.onblocked = () => resolve(null);
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
    if (passages) {
      memPass.set(d.id, passages);
      dropMemVec(d.id);
    }
    changed();
    return;
  }
  const tx = db.transaction(['docs', 'pass', 'vec'], 'readwrite');
  tx.objectStore('docs').put(meta);
  if (passages) {
    const pass = tx.objectStore('pass');
    pass.delete(docRange(d.id));
    // New text: its old vectors go with it, in the same step (the index works the new ones out).
    tx.objectStore('vec').delete(docRange(d.id));
    passages.forEach((p, n) => pass.put({ ...p, doc: d.id, n }));
  }
  await done(tx);
  changed();
}

/** Add passages to the end of a document already here (a notebook that grew): its details are updated. */
async function append(d: LocalDoc, from: number, passages: LocalPassage[]): Promise<void> {
  const docs = await all();
  const meta = { ...d, count: from + passages.length, chars: d.chars + passages.reduce((n, p) => n + p.text.length, 0) };
  docs.set(d.id, meta);
  const db = await idb();
  if (!db) {
    memPass.set(d.id, [...(memPass.get(d.id) ?? []).slice(0, from), ...passages]);
    dropMemVec(d.id, from);
    changed();
    return;
  }
  const tx = db.transaction(['docs', 'pass', 'vec'], 'readwrite');
  tx.objectStore('docs').put(meta);
  const pass = tx.objectStore('pass');
  tx.objectStore('vec').delete(IDBKeyRange.bound([d.id, from], [d.id, Number.MAX_SAFE_INTEGER]));
  passages.forEach((p, i) => pass.put({ ...p, doc: d.id, n: from + i }));
  await done(tx);
  changed();
}

async function drop(id: string): Promise<void> {
  (await all()).delete(id);
  const db = await idb();
  if (!db) {
    memPass.delete(id);
    dropMemVec(id);
    changed();
    return;
  }
  const tx = db.transaction(['docs', 'pass', 'vec'], 'readwrite');
  tx.objectStore('docs').delete(id);
  tx.objectStore('pass').delete(docRange(id));
  tx.objectStore('vec').delete(docRange(id));
  await done(tx);
  changed();
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

/**
 * Every passage, a batch at a time (pausing between batches so the screen never freezes); with `vectors`, each
 * with its meaning vector when it has one (read from "vec" over the same keys, in the same step).
 */
async function eachBatch(fn: (batch: (StoredPassage & { v?: KeptVector })[]) => void, vectors = false): Promise<void> {
  const db = await idb();
  if (!db) {
    for (const [doc, list] of memPass) fn(list.map((p, n) => ({ ...p, doc, n, ...(vectors && memVec.has(vk(doc, n)) ? { v: memVec.get(vk(doc, n)) } : {}) })));
    return;
  }
  let after: IDBValidKey | null = null;
  for (;;) {
    const batch = await new Promise<(StoredPassage & { v?: KeptVector })[]>((resolve) => {
      const tx = db.transaction(vectors ? ['pass', 'vec'] : ['pass'], 'readonly');
      const r = tx.objectStore('pass').getAll(after === null ? undefined : IDBKeyRange.lowerBound(after, true), 1500);
      r.onerror = () => resolve([]);
      r.onsuccess = () => {
        const list = r.result as (StoredPassage & { v?: KeptVector })[];
        if (!vectors || !list.length) return resolve(list);
        const first = list[0]!;
        const last = list[list.length - 1]!;
        const rv = tx.objectStore('vec').getAll(IDBKeyRange.bound([first.doc, first.n], [last.doc, last.n]));
        rv.onerror = () => resolve(list);
        rv.onsuccess = () => {
          const byKey = new Map((rv.result as StoredVector[]).map((x) => [vk(x.doc, x.n), x]));
          for (const p of list) {
            const v = byKey.get(vk(p.doc, p.n));
            if (v) p.v = v;
          }
          resolve(list);
        };
      };
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

/**
 * For the phone's backup (features/system/backup.ts): what only this device has — documents the
 * brain doesn't have yet, with their passages, and removals the brain still has to hear about.
 * Copies of the brain's own documents are left out: the brain has them.
 */
export async function deviceOnlyDocs(): Promise<{ doc: LocalDoc; passages: LocalPassage[] }[]> {
  const out: { doc: LocalDoc; passages: LocalPassage[] }[] = [];
  for (const d of (await all()).values()) {
    if (d.removed && d.brainId) out.push({ doc: d, passages: [] });
    else if (!d.brainId && !d.removed && !d.builtin) out.push({ doc: d, passages: await passagesOf(d.id) });
  }
  return out;
}

/** From a backup: put back a document this device no longer has (same id). False when it is already here. */
export async function restoreDoc(doc: LocalDoc, passages: LocalPassage[]): Promise<boolean> {
  const docs = await all();
  if (!doc?.id || docs.has(doc.id) || (doc.brainId && [...docs.values()].some((x) => x.brainId === doc.brainId))) return false;
  await put(doc, doc.removed ? undefined : passages);
  return true;
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

/**
 * Asked for a question's meaning vector (library/meaning.ts sets it once SEARCH BY MEANING is on this phone):
 * null when there is none — the model is not here, or not in memory and `load` is false. `ready` says whether a
 * search by meaning could run at all (the model is here and every passage has its vector), cheaply, without it.
 */
type QueryEmbedder = { vector(q: string, load: boolean): Promise<ArrayLike<number> | null>; ready(): boolean };
let embedder: QueryEmbedder | null = null;
export function setQueryEmbedder(e: QueryEmbedder | null): void {
  embedder = e;
}
/** A search by meaning could run now (the model is on this phone and every passage has its vector). */
export const meaningPossible = (): boolean => !!embedder?.ready();

export interface LocalSearch {
  hits: LibraryHit[];
  /** How they were ranked: by meaning only when the question had a vector and every passage searched had one. */
  how: SearchHow;
}

/**
 * Search documents kept here, reading passages from storage a batch at a time (only the best few are kept).
 * `onlyPending`: just the ones the brain doesn't have yet. With a vector for the question (`load`: the model
 * may be brought into memory for it), every passage is scored by meaning blended with its wording; if any
 * passage searched has no vector yet, the ranking is by keywords alone, as it always was, and says so.
 */
export async function searchLocalHow(q: string, k = 8, onlyPending = false, opts: { load?: boolean } = {}): Promise<LocalSearch> {
  const words = wordMatcher(q);
  const qv = embedder ? await embedder.vector(q, opts.load ?? true).catch(() => null) : null;
  if (!words && !qv) return { hits: [], how: 'keywords' };
  const docs = await all();
  type Cand = LibraryHit & Signals;
  let byWords: Cand[] = [];
  // By meaning: a pool of candidates (the nearest, the best worded, the exactly named), ranked at the end against
  // how this question's cosines spread over every passage (gathered as it reads).
  let pool: Cand[] = [];
  const POOL = Math.max(40, k * 4);
  let missing = 0;
  let seen = 0;
  let n = 0;
  let sum = 0;
  let sumSq = 0;
  const consider = (d: LocalDoc, p: LocalPassage & { v?: KeptVector }, doc: string) => {
    seen++;
    const w = words ? words(`${d.title} ${p.heading ?? ''} ${p.text}`.toLowerCase()) : { words: 0, matched: false };
    let cos: number | null = null;
    if (qv) {
      if (p.v) {
        cos = cosine(qv, p.v.q);
        n++;
        sum += cos;
        sumSq += cos * cos;
      } else missing++;
    }
    const exact = exactTitle(q, d.title, p.heading ?? '');
    const c: Cand = { doc, title: d.title, heading: p.heading ?? '', page: p.page ?? null, text: p.text, score: 0, relevant: true, ...w, exact, cos };
    if (w.matched) byWords.push(c);
    if (qv && !missing) pool.push(c);
  };
  const prune = () => {
    if (byWords.length > k * 4) byWords = rank(byWords, k, 'keywords');
    pool = missing ? [] : prunePool(pool, POOL);
  };
  if (onlyPending) {
    // Just the few documents the brain doesn't have yet: read those, not the whole copy.
    for (const d of docs.values()) {
      if (d.brainId || d.removed) continue;
      const vs = qv ? await vectorsOf(d.id) : new Map<number, KeptVector>();
      (await passagesOf(d.id)).forEach((p, n) => consider(d, { ...p, v: vs.get(n) }, d.id));
      prune();
    }
  } else {
    await eachBatch((batch) => {
      for (const p of batch) {
        const d = docs.get(p.doc);
        if (!d || d.removed) continue;
        consider(d, p, d.brainId ?? d.id);
      }
      prune();
    }, !!qv);
  }
  const how: SearchHow = qv && !missing && seen > 0 ? 'meaning' : 'keywords';
  const ranked = how === 'meaning' ? rank(pool, k, how, spreadOf(n, sum, sumSq)) : rank(byWords, k, how);
  const hits = ranked.map(({ words: _w, matched: _m, exact: _e, cos: _c, ...h }) => h as LibraryHit);
  return { hits, how };
}

/** The best passages kept here for a question (searchLocalHow without the how). */
export async function searchLocal(q: string, k = 8, onlyPending = false, opts: { load?: boolean } = {}): Promise<LibraryHit[]> {
  return (await searchLocalHow(q, k, onlyPending, opts)).hits;
}

/**
 * Passages for Ghosty in chat while its database is paused (small: they go with the message). By meaning when
 * the model is already in memory; it is not loaded for this (every message asks, and the reply must not wait).
 */
export async function passagesFor(q: string, opts: { load?: boolean } = {}): Promise<{ title: string; heading: string; page: number | null; text: string }[]> {
  return (await searchLocal(q, 6, false, { load: opts.load ?? false })).map((h) => ({ title: h.title, heading: h.heading, page: h.page, text: h.text.slice(0, 1500) }));
}

// ---------------------------------------------------------------------------------------
// The meaning index: one vector per passage, worked out on this phone (library/meaning.ts)
// ---------------------------------------------------------------------------------------

/** One document's vectors, by passage number. */
async function vectorsOf(id: string): Promise<Map<number, KeptVector>> {
  const out = new Map<number, KeptVector>();
  const db = await idb();
  if (!db) {
    (memPass.get(id) ?? []).forEach((_, n) => memVec.has(vk(id, n)) && out.set(n, memVec.get(vk(id, n))!));
    return out;
  }
  return new Promise((resolve) => {
    const r = db.transaction('vec', 'readonly').objectStore('vec').getAll(docRange(id));
    r.onsuccess = () => {
      for (const v of r.result as StoredVector[]) out.set(v.n, { q: v.q, s: v.s });
      resolve(out);
    };
    r.onerror = () => resolve(out);
  });
}

export type PassageKey = [string, number];
/** A passage still to be given a vector: its key, and the text the model reads (title and heading first). */
export interface ToIndex {
  key: PassageKey;
  text: string;
  /** The passage's own text, to check it did not change before its vector is kept. */
  raw: string;
}
const indexText = (d: LocalDoc, p: LocalPassage) => `${d.title}${p.heading && p.heading !== d.title ? ` — ${p.heading}` : ''}\n${p.text}`;
const before = (a: PassageKey, b: PassageKey) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]);

/**
 * Up to `n` passages with no vector yet, in storage order after `after` (null: from the start), and the last key
 * looked at. Only the keys are read to find them; a passage's text is read only when it needs a vector.
 */
export async function unindexed(after: PassageKey | null, n: number): Promise<{ items: ToIndex[]; last: PassageKey | null }> {
  const docs = await all();
  const live = (doc: string) => {
    const d = docs.get(doc);
    return d && !d.removed ? d : null;
  };
  const db = await idb();
  if (!db) {
    const keys = [...memPass].flatMap(([doc, list]) => list.map((_, i): PassageKey => [doc, i])).sort(before).filter((x) => !after || before(x, after) > 0);
    const items: ToIndex[] = [];
    let last: PassageKey | null = after;
    for (const key of keys) {
      if (items.length >= n) break;
      last = key;
      const d = live(key[0]);
      if (!d || memVec.has(vk(key[0], key[1]))) continue;
      const p = memPass.get(key[0])![key[1]]!;
      items.push({ key, text: indexText(d, p), raw: p.text });
    }
    return { items, last };
  }
  const items: ToIndex[] = [];
  let last: PassageKey | null = after;
  for (let guard = 0; guard < 400 && items.length < n; guard++) {
    const step = await new Promise<{ keys: PassageKey[]; got: (StoredPassage | undefined)[] } | null>((resolve) => {
      const tx = db.transaction(['pass', 'vec'], 'readonly');
      const range = last ? IDBKeyRange.lowerBound(last, true) : undefined;
      const rk = tx.objectStore('pass').getAllKeys(range, 400);
      rk.onerror = () => resolve(null);
      rk.onsuccess = () => {
        const keys = rk.result as PassageKey[];
        if (!keys.length) return resolve({ keys, got: [] });
        const rv = tx.objectStore('vec').getAllKeys(IDBKeyRange.bound(keys[0]!, keys[keys.length - 1]!));
        rv.onerror = () => resolve(null);
        rv.onsuccess = () => {
          const have = new Set((rv.result as PassageKey[]).map((x) => vk(x[0], x[1])));
          // Take passages with no vector until there are enough; the keys looked at end there (the next call carries on).
          const want: PassageKey[] = [];
          let upTo = -1;
          for (let i = 0; i < keys.length && want.length < n - items.length; i++) {
            upTo = i;
            if (!have.has(vk(keys[i]![0], keys[i]![1])) && live(keys[i]![0])) want.push(keys[i]!);
          }
          const got: (StoredPassage | undefined)[] = [];
          if (!want.length) return resolve({ keys: keys.slice(0, upTo + 1), got });
          const pass = tx.objectStore('pass');
          want.forEach((key, i) => {
            const r = pass.get(key);
            r.onsuccess = () => {
              got[i] = r.result as StoredPassage | undefined;
              if (i === want.length - 1) resolve({ keys: keys.slice(0, upTo + 1), got });
            };
            r.onerror = () => i === want.length - 1 && resolve({ keys: keys.slice(0, upTo + 1), got });
          });
        };
      };
    });
    if (!step || !step.keys.length) break;
    last = step.keys[step.keys.length - 1]!;
    for (const p of step.got) {
      const d = p && live(p.doc);
      if (p && d) items.push({ key: [p.doc, p.n], text: indexText(d, p), raw: p.text });
    }
  }
  return { items, last };
}

/**
 * Keep passages' vectors (each scaled to length 1, then int8). A passage whose text changed or went away since it
 * was read is skipped, checked in the same step as the write, so a vector never sits beside the wrong text.
 * Returns how many were kept.
 */
export async function saveVectors(items: ToIndex[], vectors: ArrayLike<number>[]): Promise<number> {
  const docs = await all();
  const rows = items.map((it, i) => ({ it, v: vectors[i] })).filter((x) => x.v && x.v.length);
  const db = await idb();
  if (!db) {
    let kept = 0;
    for (const { it, v } of rows) {
      const [doc, n] = it.key;
      if (!docs.get(doc) || docs.get(doc)!.removed) continue;
      if (memPass.get(doc)?.[n]?.text !== it.raw) continue;
      memVec.set(vk(doc, n), quantise(v!));
      kept++;
    }
    return kept;
  }
  let kept = 0;
  const tx = db.transaction(['pass', 'vec'], 'readwrite');
  const pass = tx.objectStore('pass');
  const vec = tx.objectStore('vec');
  for (const { it, v } of rows) {
    const [doc, n] = it.key;
    if (!docs.get(doc) || docs.get(doc)!.removed) continue;
    const r = pass.get([doc, n]);
    r.onsuccess = () => {
      if ((r.result as StoredPassage | undefined)?.text !== it.raw) return;
      vec.put({ doc, n, ...quantise(v!) } satisfies StoredVector);
      kept++;
    };
  }
  await done(tx);
  return kept;
}

/** How many passages here have their vector, of how many (documents removed here not counted). */
export async function indexCounts(): Promise<{ indexed: number; total: number }> {
  const docs = await all();
  const live = new Set([...docs.values()].filter((d) => !d.removed).map((d) => d.id));
  const total = [...docs.values()].filter((d) => !d.removed).reduce((n, d) => n + d.count, 0);
  const db = await idb();
  if (!db) return { indexed: [...memVec.keys()].filter((k) => live.has(k.split('\u0000')[0]!)).length, total };
  const keys = await new Promise<PassageKey[]>((resolve) => {
    const r = db.transaction('vec', 'readonly').objectStore('vec').getAllKeys();
    r.onsuccess = () => resolve(r.result as PassageKey[]);
    r.onerror = () => resolve([]);
  });
  return { indexed: keys.filter((x) => live.has(x[0])).length, total };
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
  // Storage unavailable right now (e.g. an older tab blocks it): don't copy the library into memory.
  if (typeof indexedDB !== 'undefined' && !(await idb())) return { copied: 0, dropped: 0, left: 0 };
  mirroring = true;
  try {
    // Not mirrored: Ghosty's reading notebooks (kind 'study' — the raw texts it studied, tens of
    // thousands of characters a topic). They stay in the brain and on github.com (the library
    // branch); its own study notes (kind 'digest') are small and come along.
    const docs = (await api.docs()).filter((d) => d.status === 'ready' && !d.id.startsWith('local-') && d.kind !== 'study');
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
      const prev = have.get(d.id);
      // A notebook that only grew (Ghosty's study log, its notes): copy the new passages, not the
      // whole document again. The brain pages by its own row ids (shared by every document), so
      // the copy carries on from the last row id it has, never from a count.
      const grown = !!prev && prev.count > 0 && !!prev.lastRid && d.passages > prev.count && d.chars >= prev.chars && prev.sig?.startsWith(`${prev.count}:`);
      const passages: LocalPassage[] = [];
      let after = grown ? prev.lastRid! : 0;
      let lastRid = after;
      for (let guard = 0; guard < 200; guard++) {
        const page = await api.passages(d.id, after);
        for (const p of page.passages) {
          passages.push({ text: p.text, ...(p.heading ? { heading: p.heading } : {}), ...(p.page ? { page: p.page } : {}) });
          lastRid = Math.max(lastRid, p.rid);
        }
        if (page.next === null || !page.passages.length) break;
        after = page.next;
      }
      const meta: LocalDoc = { id: prev?.id ?? `m-${d.id}`, brainId: d.id, title: d.title, source: d.source, kind: d.kind, pages: d.pages, count: prev?.count ?? 0, chars: prev?.chars ?? 0, at: d.at, sig: `${d.passages}:${d.chars}`, lastRid, ...(d.builtin ? { builtin: true } : {}) };
      if (grown) await append(meta, prev.count, passages);
      else await put({ ...meta, count: 0, chars: 0 }, passages);
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

/**
 * Ask the browser not to clear the library copy when space runs low — only when it is not kept
 * already and `quietly` (asking makes no pop-up: features/system/storage.ts persistAsksQuietly).
 */
export function keepForever(quietly: boolean): void {
  try {
    const s = navigator.storage;
    if (quietly && s?.persist) void s.persisted?.().then((on) => on || s.persist()).catch(() => undefined);
  } catch {
    /* not supported */
  }
}

/** Tests only: forget the in-memory copy. */
export function _reset(): void {
  cache = null;
  memPass = new Map();
  memVec = new Map();
  embedder = null;
  watchers.clear();
}
