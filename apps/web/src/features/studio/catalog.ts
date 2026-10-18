/**
 * The 3D STUDIO's catalogue and shelf on the phone (the search itself is shared with the brain:
 * packages/shared/src/models3d.ts).
 *  - `loadCatalog`: the Objaverse index (/data/models3d.json, a static file fetched only when the
 *    catalogue is first opened) and Poly Haven's list from the brain (/api/m3d/catalog), merged.
 *  - `thumbUrl`: a catalogue thumbnail through the brain (/api/m3d/thumb), as a blob: picture the
 *    app's security policy shows; at most a few at a time, remembered for the visit.
 *  - `fetchModel`: a model's GLB, only when opened — an Objaverse one straight from Hugging Face
 *    (connect-src allows huggingface.co and its *.hf.co download hosts), a Poly Haven one packed by
 *    the brain (/api/m3d/ph/<id>). Too-heavy files are refused before they fill the phone's memory.
 *  - the shelf: models made for the owner kept on this phone in IndexedDB `ghosty-studio` (the brain
 *    keeps them only 24 hours), the list apart from the files so listing never loads every model.
 */
import { headers } from '../../api/brain';
import { objaverseGlb, objaverseItems, type CatalogItem } from '../../../../../packages/shared/src/models3d';

/** The largest model file opened on a phone. */
export const MAX_OPEN_BYTES = 25_000_000;

let loading: Promise<{ items: CatalogItem[]; note: string }> | null = null;

/** Every catalogue model (both sources), loaded once a visit; a source that fails is said, not fatal. */
export function loadCatalog(): Promise<{ items: CatalogItem[]; note: string }> {
  loading ??= (async () => {
    const notes: string[] = [];
    const [ov, ph] = await Promise.all([
      fetch('/data/models3d.json')
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
        .then((j) => objaverseItems(j))
        .catch(() => {
          notes.push('the main catalogue could not be read (offline?)');
          return [] as CatalogItem[];
        }),
      fetch('/api/m3d/catalog', { headers: headers(), credentials: 'same-origin' })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
        .then((j: { items?: CatalogItem[]; stale?: boolean }) => {
          if (j.stale) notes.push("Poly Haven's list is a few days old");
          return Array.isArray(j.items) ? j.items.filter((i) => i && typeof i.id === 'string' && i.id.startsWith('ph:')) : [];
        })
        .catch(() => {
          notes.push("Poly Haven's models could not be listed just now");
          return [] as CatalogItem[];
        }),
    ]);
    const items = [...ph, ...ov];
    // A failed load is tried again next time the catalogue is searched.
    if (!items.length) loading = null;
    return { items, note: notes.join('; ') };
  })();
  return loading;
}

// ---------------------------------------------------------------- thumbnails

const thumbs = new Map<string, Promise<string | null>>();
let active = 0;
const waiting: (() => void)[] = [];
const slot = async () => {
  if (active >= 4) await new Promise<void>((r) => waiting.push(r));
  active++;
};
const free = () => {
  active--;
  waiting.shift()?.();
};

/** A thumbnail as a blob: address, or null when it cannot be had (a model taken down at its source). */
export function thumbUrl(src: string): Promise<string | null> {
  let p = thumbs.get(src);
  if (!p) {
    p = (async () => {
      await slot();
      try {
        const r = await fetch(`/api/m3d/thumb?u=${encodeURIComponent(src)}`, { headers: headers(), credentials: 'same-origin' });
        if (!r.ok) return null;
        return URL.createObjectURL(await r.blob());
      } catch {
        return null;
      } finally {
        free();
      }
    })();
    thumbs.set(src, p);
    // Remember a few hundred at most (each a small picture in memory).
    if (thumbs.size > 300) {
      const [old, op] = thumbs.entries().next().value as [string, Promise<string | null>];
      thumbs.delete(old);
      void op.then((u) => u && URL.revokeObjectURL(u));
    }
  }
  return p;
}

// ---------------------------------------------------------------- opening a model

/** A response's body, with the share read so far told on the way; refused past MAX_OPEN_BYTES. */
async function readAll(r: Response, progress: (pct: number | null) => void): Promise<ArrayBuffer> {
  const total = Number(r.headers.get('content-length')) || 0;
  if (total > MAX_OPEN_BYTES) throw new Error(`it is too big for the phone (${(total / 1e6).toFixed(0)} MB)`);
  if (!r.body) return r.arrayBuffer();
  const reader = r.body.getReader();
  const chunks: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.byteLength;
    if (got > MAX_OPEN_BYTES) {
      void reader.cancel();
      throw new Error('it is too big for the phone (over 25 MB)');
    }
    progress(total ? Math.round((got / total) * 100) : null);
  }
  const out = new Uint8Array(got);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.byteLength;
  }
  return out.buffer;
}

/** A catalogue model's GLB. */
export async function fetchModel(it: CatalogItem, progress: (pct: number | null) => void = () => undefined): Promise<ArrayBuffer> {
  if (it.id.startsWith('ph:')) {
    const r = await fetch(`/api/m3d/ph/${encodeURIComponent(it.id.slice(3))}`, { headers: headers(), credentials: 'same-origin' });
    if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? `the brain answered ${r.status}`);
    return readAll(r, progress);
  }
  const url = objaverseGlb(it);
  if (!url) throw new Error('that model has no download address');
  const r = await fetch(url);
  if (!r.ok) throw new Error(r.status === 404 ? 'Hugging Face no longer has that file' : `Hugging Face answered ${r.status}`);
  return readAll(r, progress);
}

// ---------------------------------------------------------------- the shelf on this phone (IndexedDB)

/** A model kept on this phone. */
export interface Kept {
  id: string;
  title: string;
  credit: string;
  at: number;
  bytes: number;
  metres: boolean;
}

const DB = 'ghosty-studio';
/** Kept on the phone at most (oldest go first). */
export const MAX_KEPT = 40;
const memMeta = new Map<string, Kept>();
const memFiles = new Map<string, ArrayBuffer>();
let opening: Promise<IDBDatabase | null> | null = null;

function idb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  opening ??= new Promise((resolve) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => {
        if (!r.result.objectStoreNames.contains('models')) r.result.createObjectStore('models', { keyPath: 'id' });
        if (!r.result.objectStoreNames.contains('files')) r.result.createObjectStore('files');
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

const done = (tx: IDBTransaction) =>
  new Promise<void>((ok) => {
    tx.oncomplete = () => ok();
    tx.onerror = () => ok();
    tx.onabort = () => ok();
  });

/** Every model kept on this phone, newest first. */
export async function listKept(): Promise<Kept[]> {
  const db = await idb();
  const all = !db
    ? [...memMeta.values()]
    : await new Promise<Kept[]>((resolve) => {
        try {
          const req = db.transaction('models').objectStore('models').getAll();
          req.onsuccess = () => resolve(req.result as Kept[]);
          req.onerror = () => resolve([...memMeta.values()]);
        } catch {
          resolve([...memMeta.values()]);
        }
      });
  return all.sort((a, b) => b.at - a.at);
}

/** Keep a model on this phone (the oldest go once there are MAX_KEPT). */
export async function keep(k: Kept, glb: ArrayBuffer): Promise<void> {
  memMeta.set(k.id, k);
  memFiles.set(k.id, glb);
  const db = await idb();
  if (!db) return;
  try {
    const tx = db.transaction(['models', 'files'], 'readwrite');
    tx.objectStore('models').put(k);
    tx.objectStore('files').put(glb, k.id);
    await done(tx);
  } catch {
    // a full phone: the model still shows now, it is just not kept
  }
  const all = await listKept();
  for (const old of all.slice(MAX_KEPT)) await forget(old.id);
}

/** A kept model's file, or null. */
export async function keptFile(id: string): Promise<ArrayBuffer | null> {
  const db = await idb();
  if (!db) return memFiles.get(id) ?? null;
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

export async function forget(id: string): Promise<void> {
  memMeta.delete(id);
  memFiles.delete(id);
  const db = await idb();
  if (!db) return;
  try {
    const tx = db.transaction(['models', 'files'], 'readwrite');
    tx.objectStore('models').delete(id);
    tx.objectStore('files').delete(id);
    await done(tx);
  } catch {
    // nothing to remove
  }
}

// ---------------------------------------------------------------- the brain's step-by-step answers

/** Read a JSON-lines answer (/api/m3d/generate, /api/m3d?stream=1), handing each line over as it comes. */
export async function readLines(r: Response, each: (line: Record<string, unknown>) => void): Promise<void> {
  if (!r.body) return;
  const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = '';
  for (;;) {
    const { value, done: end } = await reader.read();
    if (value) buf += value;
    let i: number;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      try {
        each(JSON.parse(line) as Record<string, unknown>);
      } catch {
        // a broken line: skip it
      }
    }
    if (end) break;
  }
  if (buf.trim()) {
    try {
      each(JSON.parse(buf) as Record<string, unknown>);
    } catch {
      // ignore
    }
  }
}
