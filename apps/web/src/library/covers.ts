/**
 * COVERS ON THE SHELF (STARS 169; BRIEF-LIBRARY-READER 7): the first page's picture where the file has one — an e-book's own
 * cover, a PDF's first big picture, a Word file's first picture, the first of photos of pages — made small (at most 240 × 360,
 * a JPEG of a few kilobytes) and kept on this phone (its own IndexedDB, 'ghosty-covers'), by the book's id. A book with no
 * picture of its own gets a cover drawn from its title (features/library/reader.ts drawnCover: the tag and the plate in the
 * theme's accent). Read on this phone with no library and no AI; nothing is sent anywhere.
 */
import { unzip } from './extract';

const DB = 'ghosty-covers';
const W = 240;
const H = 360;
let opening: Promise<IDBDatabase | null> | null = null;
/** Covers looked up so far (null: looked up, none). */
const mem = new Map<string, string | null>();
const watchers = new Set<(doc: string) => void>();

function idb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  opening ??= new Promise((resolve) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('c');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(null);
      r.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return opening;
}

/** Told when a book's cover arrives (the Shelf and the reader swap the drawn one for it). */
export function onCover(fn: (doc: string) => void): () => void {
  watchers.add(fn);
  return () => watchers.delete(fn);
}

/** A book's cover as it is known now: a picture's address, null (none), or undefined (not looked up yet). */
export const coverNow = (doc: string): string | null | undefined => mem.get(doc);

/** A book's cover, looked up on this phone. */
export async function coverOf(doc: string): Promise<string | null> {
  if (mem.has(doc)) return mem.get(doc)!;
  const db = await idb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const q = db.transaction('c', 'readonly').objectStore('c').get(doc);
      q.onsuccess = () => {
        const v = typeof q.result === 'string' ? q.result : null;
        mem.set(doc, v);
        resolve(v);
      };
      q.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** Keep a cover for a book (a picture's data address). */
export async function keepCover(doc: string, url: string): Promise<void> {
  mem.set(doc, url);
  watchers.forEach((fn) => fn(doc));
  const db = await idb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction('c', 'readwrite');
      tx.objectStore('c').put(url, doc);
      tx.oncomplete = tx.onerror = tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** A book's cover let go (the book left the library). */
export async function dropCover(doc: string): Promise<void> {
  mem.delete(doc);
  const db = await idb();
  if (!db) return;
  try {
    db.transaction('c', 'readwrite').objectStore('c').delete(doc);
  } catch {
    /* gone already */
  }
}

/** A picture made small: at most W × H, a JPEG. null when the browser cannot read it. */
async function small(blob: Blob): Promise<string | null> {
  try {
    const bmp = await createImageBitmap(blob);
    if (bmp.width < 40 || bmp.height < 40) return null;
    const k = Math.min(1, W / bmp.width, H / bmp.height);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bmp.width * k));
    c.height = Math.max(1, Math.round(bmp.height * k));
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close?.();
    return c.toDataURL('image/jpeg', 0.82);
  } catch {
    return null;
  }
}

const TYPE: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };
const typeOf = (name: string) => TYPE[name.toLowerCase().split('.').pop() ?? ''] ?? '';

/** An e-book's own cover: the manifest's cover-image (EPUB 3), the item its "cover" meta names (EPUB 2), else an image called cover. */
async function epubCover(bytes: Uint8Array): Promise<Blob | null> {
  const files = await unzip(bytes);
  const dec = new TextDecoder();
  const container = dec.decode(files.get('META-INF/container.xml') ?? new Uint8Array());
  const opfPath = container.match(/full-path="([^"]+)"/)?.[1] ?? [...files.keys()].find((k) => k.endsWith('.opf'));
  const opf = opfPath ? dec.decode(files.get(opfPath) ?? new Uint8Array()) : '';
  if (!opf) return null;
  const base = opfPath!.includes('/') ? opfPath!.slice(0, opfPath!.lastIndexOf('/') + 1) : '';
  const items = [...opf.matchAll(/<item\b[^>]*>/g)].map((m) => ({ id: m[0].match(/\bid="([^"]+)"/)?.[1] ?? '', href: decodeURIComponent(m[0].match(/\bhref="([^"]+)"/)?.[1] ?? ''), type: m[0].match(/\bmedia-type="([^"]+)"/)?.[1] ?? '', props: m[0].match(/\bproperties="([^"]+)"/)?.[1] ?? '' }));
  const named = opf.match(/<meta\b[^>]*name="cover"[^>]*content="([^"]+)"/)?.[1] ?? opf.match(/<meta\b[^>]*content="([^"]+)"[^>]*name="cover"/)?.[1];
  const pick = items.find((i) => /\bcover-image\b/.test(i.props)) ?? items.find((i) => named && i.id === named) ?? items.find((i) => /^image\//.test(i.type) && /cover/i.test(`${i.id} ${i.href}`));
  if (!pick) return null;
  const data = files.get(base + pick.href) ?? files.get(pick.href);
  const type = /^image\//.test(pick.type) ? pick.type : typeOf(pick.href);
  return data && type ? new Blob([data], { type }) : null;
}

/** A Word file's first picture (word/media/image1…). */
async function docxCover(bytes: Uint8Array): Promise<Blob | null> {
  const files = await unzip(bytes);
  const name = [...files.keys()].filter((k) => /^word\/media\/[^/]+\.(jpe?g|png|gif|webp)$/i.test(k)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))[0];
  return name ? new Blob([files.get(name)!], { type: typeOf(name) }) : null;
}

/**
 * A PDF's first big picture: the first JPEG image in the file at least 120 points each way (a cover or a frontispiece; a PDF
 * keeps its pictures in page order). Its bytes are a JPEG file as they are, so nothing is decoded here.
 */
function pdfCover(bytes: Uint8Array): Blob | null {
  let s = '';
  // the first 4 MB is plenty for a first page's picture
  const head = bytes.subarray(0, Math.min(bytes.length, 4_000_000));
  for (let i = 0; i < head.length; i += 8192) s += String.fromCharCode.apply(null, head.subarray(i, i + 8192) as unknown as number[]);
  // each JPEG-coded stream: its object's dictionary (from "obj" to "stream") says whether it is a picture, and how big
  for (let i = s.indexOf('/DCTDecode'); i >= 0; i = s.indexOf('/DCTDecode', i + 10)) {
    const obj = s.lastIndexOf(' obj', i);
    const st = s.indexOf('stream', i);
    if (obj < 0 || st < 0 || i - obj > 1200 || st - i > 1200) continue;
    const dict = s.slice(obj, st);
    if (!/\/Subtype\s*\/Image/.test(dict)) continue;
    const w = Number(dict.match(/\/Width\s+(\d+)/)?.[1] ?? 0);
    const hgt = Number(dict.match(/\/Height\s+(\d+)/)?.[1] ?? 0);
    if (w < 120 || hgt < 120) continue;
    let start = st + 6;
    if (s[start] === '\r') start++;
    if (s[start] === '\n') start++;
    const end = s.indexOf('endstream', start);
    if (end < 0) continue;
    return new Blob([head.slice(start, end)], { type: 'image/jpeg' });
  }
  return null;
}

/** A file's cover, made small: the first page's picture where it has one; null where it has none (a drawn cover then). */
export async function coverFromFile(file: File): Promise<string | null> {
  try {
    const name = file.name.toLowerCase();
    let blob: Blob | null = null;
    if (file.type.startsWith('image/') || /\.(jpe?g|png|gif|webp|heic|heif)$/.test(name)) blob = file;
    else if (name.endsWith('.epub')) blob = await epubCover(new Uint8Array(await file.arrayBuffer()));
    else if (name.endsWith('.docx')) blob = await docxCover(new Uint8Array(await file.arrayBuffer()));
    else if (name.endsWith('.pdf') || file.type === 'application/pdf') blob = pdfCover(new Uint8Array(await file.arrayBuffer()));
    return blob ? await small(blob) : null;
  } catch {
    return null;
  }
}
