/**
 * PHOTOS KEPT ON THIS PHONE (THE NEXT ROUND, the money lane): a photo of a warranty's receipt (money.s1, keyed by the warranty's
 * id) and his own photo of someone he introduced on PEOPLE (money.u9, keyed `person:<name>`; never sent, never used to identify
 * anyone), each in this phone's own IndexedDB store. It is made smaller on the phone first (at most 1200 pixels, a JPEG), never sent to
 * the brain or anywhere else. Every call fails softly: no storage means no photo, said where it shows.
 */
const DB = 'ghosty-receipts';
const STORE = 'photos';

function db(): Promise<IDBDatabase> {
  return new Promise((ok, no) => {
    if (typeof indexedDB === 'undefined') return no(new Error('no storage on this phone'));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => no(r.error ?? new Error('storage refused'));
  });
}
async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((ok, no) => {
    const t = d.transaction(STORE, mode);
    const r = run(t.objectStore(STORE));
    t.oncomplete = () => (ok(r.result), d.close());
    t.onerror = () => (no(t.error ?? new Error('storage refused')), d.close());
  });
}

/** The photo made smaller on the phone (at most 1200 pixels on its long side), as a JPEG blob. */
export async function shrink(file: Blob, max = 1200): Promise<Blob> {
  if (typeof createImageBitmap !== 'function') return file;
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * k));
  c.height = Math.max(1, Math.round(bmp.height * k));
  c.getContext('2d')?.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return new Promise((ok) => c.toBlob((b) => ok(b ?? file), 'image/jpeg', 0.82));
}

/** Keep a receipt's photo for a warranty, made smaller first. */
export async function keepReceipt(id: string, file: Blob): Promise<void> {
  const small = await shrink(file).catch(() => file);
  await tx('readwrite', (s) => s.put(small, id));
}
export const receiptOf = (id: string): Promise<Blob | undefined> => tx<Blob | undefined>('readonly', (s) => s.get(id) as IDBRequest<Blob | undefined>).catch(() => undefined);
export const forgetReceipt = (id: string): Promise<void> => tx('readwrite', (s) => s.delete(id)).then(() => undefined, () => undefined);
export const receiptIds = (): Promise<string[]> => tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys()).then((k) => k.map(String), () => []);
