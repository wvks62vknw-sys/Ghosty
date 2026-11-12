/**
 * THE PICTURES OF A DOCUMENT (BRIEF-EDITOR-DOCUMENTS): a photo he adds is shrunk here (1,280 px at most, a JPEG: flattened on
 * white, so a PDF and a Word file take it as it is) and kept in the phone's own database, never sent anywhere. A document's
 * block holds only the picture's id; the words stay light in the documents' list. The pictures in use are held in memory too,
 * so an export reads them at once. A picture no document holds any more is let go.
 */
const DB = 'ghosty-doc-images';
const MAX = 1280;
const cache = new Map<string, string>();
let opening: Promise<IDBDatabase | null> | null = null;

function idb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  opening ??= new Promise((resolve) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('img', { keyPath: 'id' });
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(null);
      r.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return opening;
}
const done = <T>(r: IDBRequest<T>): Promise<T | undefined> => new Promise((ok) => ((r.onsuccess = () => ok(r.result)), (r.onerror = () => ok(undefined))));

/** The picture as a data address, when it is in memory (an export, the editor's page). */
export const imageNow = (id: string): string | null => cache.get(id) ?? null;

/** The bytes of a picture held as a data address. */
export function imageBytes(id: string): Uint8Array | null {
  const src = cache.get(id);
  const m = src ? /^data:[^;,]+;base64,(.*)$/.exec(src) : null;
  if (!m) return null;
  const bin = atob(m[1]!);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** The pictures a document needs, read from the phone's database into memory (what is not there stays missing, and is said). */
export async function loadImages(ids: string[]): Promise<string[]> {
  const missing: string[] = [];
  const db = await idb();
  for (const id of ids) {
    if (cache.has(id)) continue;
    const row = db ? ((await done(db.transaction('img').objectStore('img').get(id))) as { id: string; src: string } | undefined) : undefined;
    if (row?.src) cache.set(id, row.src);
    else missing.push(id);
  }
  return missing;
}

const idOf = (src: string): string => {
  let h1 = 5381;
  let h2 = 52711;
  for (let i = 0; i < src.length; i += Math.max(1, src.length >> 12)) {
    h1 = ((h1 << 5) + h1 + src.charCodeAt(i)) | 0;
    h2 = ((h2 << 5) ^ h2 ^ src.charCodeAt(i)) | 0;
  }
  return `i${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}${src.length.toString(36)}`;
};

/** Keep a picture (a JPEG's data address): its id. */
export async function putImage(src: string): Promise<string> {
  const id = idOf(src);
  cache.set(id, src);
  const db = await idb();
  if (db) await done(db.transaction('img', 'readwrite').objectStore('img').put({ id, src }));
  return id;
}

/** Let go of every picture the given ids do not name. */
export async function keepOnly(ids: Set<string>): Promise<void> {
  const db = await idb();
  if (!db) return;
  const keys = ((await done(db.transaction('img').objectStore('img').getAllKeys())) ?? []) as string[];
  for (const k of keys) {
    if (ids.has(k)) continue;
    cache.delete(k);
    await done(db.transaction('img', 'readwrite').objectStore('img').delete(k));
  }
}

/** A photo (a file he chose) as a kept picture: shrunk to 1,280 px, a JPEG flattened on white. */
export async function addPhoto(file: Blob): Promise<{ id: string; iw: number; ih: number }> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions).catch(() => null);
  if (!bmp) throw new Error('this phone could not open that picture');
  const k = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
  const iw = Math.max(1, Math.round(bmp.width * k));
  const ih = Math.max(1, Math.round(bmp.height * k));
  const c = document.createElement('canvas');
  c.width = iw;
  c.height = ih;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, iw, ih);
  g.drawImage(bmp, 0, 0, iw, ih);
  bmp.close?.();
  return { id: await putImage(c.toDataURL('image/jpeg', 0.82)), iw, ih };
}

/** A data address for bytes of a picture (a Word file's media): shrunk the same way when it is a PNG, GIF or a big JPEG. */
export async function addImageBytes(bytes: Uint8Array, mime: string): Promise<{ id: string; iw: number; ih: number } | null> {
  try {
    return await addPhoto(new Blob([bytes as BlobPart], { type: mime }));
  } catch {
    return null;
  }
}
