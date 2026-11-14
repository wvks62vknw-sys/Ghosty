/**
 * PHOTOS, the library's store (THE APPS ROUND, lane LENS): his photos and videos in this phone's own database (IndexedDB
 * 'ghosty-photos'), each kept exactly as it came, with a small thumbnail, its own data (when, and where when the camera wrote it),
 * a fingerprint for duplicates and the names the Lens's namer gave it. Nothing here is sent anywhere: where a photo was taken is
 * shown to him and never leaves the phone.
 *
 * A phone that keeps nothing (a private window) still shows the library for the visit, and `libState.persistent` says so.
 */
import { loadImageFile } from '../vision/camera';
import { BIN_DAYS, DAY, bin, dHash, readExif, sharpness, type Item, type Kind } from './pure';

export interface Album {
  id: string;
  name: string;
  created: number;
}

const DB = 'ghosty-photos';
let dbp: Promise<IDBDatabase | null> | null = null;
const mem = { items: new Map<string, Item>(), blobs: new Map<string, Blob>(), thumbs: new Map<string, Blob>(), albums: new Map<string, Album>() };
export const libState = { persistent: true, importing: 0, imported: 0, naming: 0, named: 0 };

function db(): Promise<IDBDatabase | null> {
  dbp ??= new Promise((ok) => {
    try {
      if (typeof indexedDB === 'undefined') throw new Error('no database');
      const rq = indexedDB.open(DB, 1);
      rq.onupgradeneeded = () => {
        const d = rq.result;
        for (const s of ['items', 'blobs', 'thumbs', 'albums']) d.createObjectStore(s);
      };
      rq.onsuccess = () => ok(rq.result);
      rq.onerror = () => {
        libState.persistent = false;
        ok(null);
      };
      rq.onblocked = () => {
        libState.persistent = false;
        ok(null);
      };
    } catch {
      libState.persistent = false;
      ok(null);
    }
  });
  return dbp;
}

type StoreName = 'items' | 'blobs' | 'thumbs' | 'albums';
const memOf = (s: StoreName): Map<string, unknown> => mem[s] as Map<string, unknown>;

async function tx<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const d = await db();
  if (!d) return undefined;
  return new Promise((ok) => {
    try {
      const t = d.transaction(store, mode);
      const r = fn(t.objectStore(store));
      t.oncomplete = () => ok(r ? (r.result as T) : undefined);
      t.onerror = () => ok(undefined);
      t.onabort = () => ok(undefined);
    } catch {
      ok(undefined);
    }
  });
}
async function put(store: StoreName, key: string, value: unknown): Promise<void> {
  memOf(store).set(key, value);
  await tx(store, 'readwrite', (s) => void s.put(value, key));
}
async function get<T>(store: StoreName, key: string): Promise<T | null> {
  const m = memOf(store).get(key);
  if (m !== undefined) return m as T;
  const v = await tx<T>(store, 'readonly', (s) => s.get(key));
  return v ?? null;
}
async function del(store: StoreName, key: string): Promise<void> {
  memOf(store).delete(key);
  await tx(store, 'readwrite', (s) => void s.delete(key));
}
async function all<T>(store: StoreName): Promise<T[]> {
  const v = await tx<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>);
  if (v) {
    const keys = (await tx<IDBValidKey[]>(store, 'readonly', (s) => s.getAllKeys())) ?? [];
    keys.forEach((k, i) => memOf(store).set(String(k), v[i]));
  }
  return [...memOf(store).values()] as T[];
}

// ---------------------------------------------------------------- reading

let cache: Item[] | null = null;
const listeners = new Set<() => void>();
/** Something in the library changed: every view draws again. */
export function onChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const changed = () => {
  cache = null;
  listeners.forEach((f) => f());
};

/** Every item (deleted ones too: the views decide), and what waited 30 days in Recently deleted goes for good first. */
export async function items(): Promise<Item[]> {
  if (cache) return cache;
  const list = await all<Item>('items');
  const { expired } = bin(list, Date.now());
  for (const e of expired) await removeForGood(e.id, false);
  cache = list.filter((i) => !expired.some((e) => e.id === i.id));
  return cache;
}
export const albums = async (): Promise<Album[]> => (await all<Album>('albums')).sort((a, b) => a.created - b.created);
export const thumbOf = (id: string): Promise<Blob | null> => get<Blob>('thumbs', id);
export const blobOf = (id: string): Promise<Blob | null> => get<Blob>('blobs', id);

// ---------------------------------------------------------------- bringing photos in

const id = (): string => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** A 9 × 8 grey copy and a 64 × 64 one of a picture: its fingerprint and how sharp it is. */
function measure(src: CanvasImageSource, w: number, h: number): { hash: string; sharp: number } {
  const grey = (cw: number, ch: number): number[] => {
    const c = document.createElement('canvas');
    c.width = cw;
    c.height = ch;
    const x = c.getContext('2d', { willReadFrequently: true });
    if (!x || !w || !h) return [];
    x.drawImage(src, 0, 0, cw, ch);
    const d = x.getImageData(0, 0, cw, ch).data;
    const out: number[] = [];
    for (let i = 0; i < d.length; i += 4) out.push(0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!);
    return out;
  };
  const small = grey(9, 8);
  return { hash: small.length === 72 ? dHash(small) : '', sharp: sharpness(grey(64, 64), 64, 64) };
}

const toBlob = (c: HTMLCanvasElement, q = 0.82): Promise<Blob | null> => new Promise((ok) => c.toBlob((b) => ok(b), 'image/jpeg', q));

/** A video's first look (a frame a little way in), its size and its length; null when this phone cannot play it. */
function videoLook(file: Blob): Promise<{ canvas: HTMLCanvasElement; w: number; h: number; secs: number } | null> {
  return new Promise((ok) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    const done = (r: Awaited<ReturnType<typeof videoLook>>) => {
      URL.revokeObjectURL(url);
      ok(r);
    };
    const timer = setTimeout(() => done(null), 8000);
    v.onloadedmetadata = () => {
      v.currentTime = Math.min(0.5, (v.duration || 1) / 3);
    };
    v.onseeked = () => {
      clearTimeout(timer);
      const w = v.videoWidth, h = v.videoHeight;
      const k = Math.min(1, 512 / Math.max(w, h, 1));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w * k));
      c.height = Math.max(1, Math.round(h * k));
      c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height);
      done({ canvas: c, w, h, secs: Number.isFinite(v.duration) ? v.duration : 0 });
    };
    v.onerror = () => {
      clearTimeout(timer);
      done(null);
    };
    v.src = url;
  });
}

/** One file brought in: kept as it came, with its thumbnail and its own data. Null when this phone cannot read it. */
export async function bringIn(file: File, extra: Partial<Item> = {}): Promise<Item | null> {
  const isVideo = /^video\//.test(file.type) || /\.(mov|mp4|m4v|webm)$/i.test(file.name);
  let look: { canvas: HTMLCanvasElement; w: number; h: number; secs?: number } | null = null;
  let taken: number | null = null;
  let place: Item['place'];
  if (isVideo) look = await videoLook(file);
  else {
    try {
      const head = await file.slice(0, 256 * 1024).arrayBuffer();
      const ex = readExif(head);
      taken = ex.taken;
      if (ex.place) place = ex.place;
    } catch {
      /* no EXIF: the file's own date stands */
    }
    try {
      const full = await loadImageFile(file, 512);
      look = { canvas: full, w: full.width, h: full.height };
      // the real size, not the thumbnail's
      if (typeof createImageBitmap === 'function') {
        const bmp = await createImageBitmap(file).catch(() => null);
        if (bmp) {
          look.w = bmp.width;
          look.h = bmp.height;
          bmp.close();
        }
      }
    } catch {
      look = null;
    }
  }
  if (!look) return null;
  const thumb = await toBlob(look.canvas, 0.8);
  const m = measure(look.canvas, look.canvas.width, look.canvas.height);
  const it: Item = {
    id: id(),
    kind: (isVideo ? 'video' : 'photo') as Kind,
    name: file.name || (isVideo ? 'video.mp4' : 'photo.jpg'),
    type: file.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
    w: look.w,
    h: look.h,
    taken: taken ?? (file.lastModified || Date.now()),
    added: Date.now(),
    bytes: file.size,
    fav: false,
    hidden: false,
    deletedAt: 0,
    albums: [],
    ...(place ? { place } : {}),
    hash: m.hash,
    sharp: m.sharp,
    labels: [],
    text: '',
    ...(look.secs ? { secs: look.secs } : {}),
    ...extra,
  };
  await put('blobs', it.id, file);
  if (thumb) await put('thumbs', it.id, thumb);
  await put('items', it.id, it);
  return it;
}

/** Many files brought in, one at a time (a phone's memory is kept small); `onEach` says how far it has got. */
export async function bringInAll(files: File[], onEach?: (done: number, of: number) => void): Promise<{ added: Item[]; failed: string[] }> {
  const added: Item[] = [];
  const failed: string[] = [];
  libState.importing = files.length;
  libState.imported = 0;
  for (const f of files) {
    const it = await bringIn(f).catch(() => null);
    if (it) added.push(it);
    else failed.push(f.name);
    libState.imported += 1;
    onEach?.(libState.imported, files.length);
  }
  libState.importing = 0;
  changed();
  return { added, failed };
}

// ---------------------------------------------------------------- changes (each one undoable by the view)

/** Change one or more items' kept facts (favourite, hidden, albums, deleted). */
export async function update(ids: string[], fn: (it: Item) => Item): Promise<void> {
  for (const i of ids) {
    const it = await get<Item>('items', i);
    if (it) await put('items', i, fn({ ...it, albums: [...it.albums] }));
  }
  changed();
}
export const setFav = (ids: string[], fav: boolean) => update(ids, (it) => ({ ...it, fav }));
export const setHidden = (ids: string[], hidden: boolean) => update(ids, (it) => ({ ...it, hidden }));
/** Into Recently deleted (30 days), or back out of it. */
export const setDeleted = (ids: string[], deleted: boolean) => update(ids, (it) => ({ ...it, deletedAt: deleted ? Date.now() : 0 }));
export const addToAlbum = (ids: string[], album: string) => update(ids, (it) => ({ ...it, albums: it.albums.includes(album) ? it.albums : [...it.albums, album] }));
export const removeFromAlbum = (ids: string[], album: string) => update(ids, (it) => ({ ...it, albums: it.albums.filter((a) => a !== album) }));

export async function newAlbum(name: string): Promise<Album> {
  const a: Album = { id: `a${Date.now().toString(36)}`, name: name.trim().slice(0, 60) || 'New album', created: Date.now() };
  await put('albums', a.id, a);
  changed();
  return a;
}
export async function renameAlbum(albumId: string, name: string): Promise<void> {
  const a = await get<Album>('albums', albumId);
  if (a) await put('albums', albumId, { ...a, name: name.trim().slice(0, 60) || a.name });
  changed();
}
export async function deleteAlbum(albumId: string): Promise<void> {
  await del('albums', albumId);
  await update((await items()).filter((i) => i.albums.includes(albumId)).map((i) => i.id), (it) => ({ ...it, albums: it.albums.filter((a) => a !== albumId) }));
}

/** Gone for good (from Recently deleted, or after its 30 days): the bytes, the thumbnail and the row. */
export async function removeForGood(itemId: string, tell = true): Promise<void> {
  await del('blobs', itemId);
  await del('thumbs', itemId);
  await del('items', itemId);
  if (tell) changed();
}

/** What waits in Recently deleted, gone for good at once (EMPTY on its page, after he says yes). */
export async function emptyBin(): Promise<number> {
  const gone = (await items()).filter((i) => i.deletedAt);
  for (const g of gone) await removeForGood(g.id, false);
  changed();
  return gone.length;
}
export { BIN_DAYS, DAY };

/** How much the library keeps, and what the browser says it may keep. */
export async function room(): Promise<{ used: number; quota: number | null }> {
  const used = (await items()).reduce((s, i) => s + i.bytes, 0);
  try {
    const est = await navigator.storage?.estimate?.();
    return { used, quota: est?.quota ?? null };
  } catch {
    return { used, quota: null };
  }
}

// ---------------------------------------------------------------- what is in each photo, named on the phone

/**
 * Name every photo not yet named with the Lens's namer (MobileCLIP, on this phone): its top names, kept with it, so search finds
 * "dog on a beach". The namer's files must already be here or come on his tap (the caller checks Wi-Fi and says the size).
 */
export async function nameAll(onEach?: (done: number, of: number) => void): Promise<{ named: number; failed: number }> {
  const { namer } = await import('../vision/clip');
  await namer.load(() => undefined);
  const todo = (await items()).filter((i) => i.kind === 'photo' && !i.deletedAt && !i.labels.length);
  libState.naming = todo.length;
  libState.named = 0;
  let failed = 0;
  for (const it of todo) {
    const t = await thumbOf(it.id);
    let names: string[] = [];
    if (t) {
      const bmp = await createImageBitmap(t).catch(() => null);
      if (bmp) {
        const r = await namer.name(bmp, { w: bmp.width, h: bmp.height }, undefined, 6).catch(() => null);
        bmp.close();
        names = (r?.names ?? []).filter((n, i) => i < 2 || n.p >= 0.04).map((n) => n.label.toLowerCase());
      }
    }
    if (names.length) await put('items', it.id, { ...it, labels: names });
    else failed += 1;
    libState.named += 1;
    onEach?.(libState.named, todo.length);
  }
  libState.naming = 0;
  changed();
  return { named: todo.length - failed, failed };
}

// ---------------------------------------------------------------- the first run: sample photos, drawn here, said to be samples

interface Scene {
  name: string;
  labels: string[];
  daysAgo: number;
  draw(x: CanvasRenderingContext2D, w: number, h: number): void;
}
const sky = (x: CanvasRenderingContext2D, h: number, stops: [number, string][]) => {
  const g = x.createLinearGradient(0, 0, 0, h);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
};
const hills = (x: CanvasRenderingContext2D, w: number, h: number, base: number, amp: number, colour: string, seed: number) => {
  x.fillStyle = colour;
  x.beginPath();
  x.moveTo(0, h);
  for (let i = 0; i <= 40; i++) x.lineTo((i / 40) * w, base + Math.sin(i * 0.45 + seed) * amp + Math.sin(i * 1.3 + seed * 2) * amp * 0.35);
  x.lineTo(w, h);
  x.fill();
};
const sun = (x: CanvasRenderingContext2D, cx: number, cy: number, r: number, colour: string) => {
  x.fillStyle = colour;
  x.beginPath();
  x.arc(cx, cy, r, 0, Math.PI * 2);
  x.fill();
};
const SCENES: Scene[] = [
  { name: 'Sunset over the sea.jpg', labels: ['sunset', 'sea', 'beach', 'sky'], daysAgo: 2, draw: (x, w, h) => { x.fillStyle = sky(x, h, [[0, 'hsl(260 45% 30%)'], [0.45, 'hsl(18 85% 60%)'], [0.62, 'hsl(40 90% 70%)'], [0.63, 'hsl(205 45% 35%)'], [1, 'hsl(210 50% 18%)']]); x.fillRect(0, 0, w, h); sun(x, w * 0.5, h * 0.6, h * 0.09, 'hsl(45 100% 80%)'); x.fillStyle = 'hsl(40 60% 70% / 0.5)'; for (let i = 0; i < 9; i++) x.fillRect(w * 0.44 - i * 4, h * 0.65 + i * 14, w * 0.12 + i * 8, 3); } },
  { name: 'Mountains at dawn.jpg', labels: ['mountain', 'snow', 'sky', 'landscape'], daysAgo: 9, draw: (x, w, h) => { x.fillStyle = sky(x, h, [[0, 'hsl(215 60% 55%)'], [1, 'hsl(30 70% 85%)']]); x.fillRect(0, 0, w, h); x.fillStyle = 'hsl(220 20% 40%)'; x.beginPath(); x.moveTo(0, h * 0.75); x.lineTo(w * 0.3, h * 0.28); x.lineTo(w * 0.48, h * 0.55); x.lineTo(w * 0.68, h * 0.22); x.lineTo(w, h * 0.7); x.lineTo(w, h); x.lineTo(0, h); x.fill(); x.fillStyle = 'hsl(0 0% 97%)'; x.beginPath(); x.moveTo(w * 0.24, h * 0.36); x.lineTo(w * 0.3, h * 0.28); x.lineTo(w * 0.36, h * 0.37); x.fill(); x.beginPath(); x.moveTo(w * 0.62, h * 0.31); x.lineTo(w * 0.68, h * 0.22); x.lineTo(w * 0.75, h * 0.32); x.fill(); hills(x, w, h, h * 0.82, h * 0.03, 'hsl(140 30% 25%)', 1); } },
  { name: 'City lights.jpg', labels: ['city', 'night', 'building', 'skyline'], daysAgo: 21, draw: (x, w, h) => { x.fillStyle = sky(x, h, [[0, 'hsl(235 50% 10%)'], [1, 'hsl(260 40% 25%)']]); x.fillRect(0, 0, w, h); for (let i = 0; i < 14; i++) { const bw = w / 14, bh = h * (0.25 + ((i * 37) % 50) / 100); x.fillStyle = `hsl(230 20% ${10 + (i % 3) * 4}%)`; x.fillRect(i * bw, h - bh, bw - 3, bh); for (let y = h - bh + 8; y < h - 8; y += 14) for (let k = 4; k < bw - 8; k += 10) if ((i * 7 + y + k) % 3) { x.fillStyle = 'hsl(45 90% 70%)'; x.fillRect(i * bw + k, y, 4, 6); } } } },
  { name: 'Forest walk.jpg', labels: ['forest', 'tree', 'path', 'nature'], daysAgo: 40, draw: (x, w, h) => { x.fillStyle = sky(x, h, [[0, 'hsl(90 30% 75%)'], [1, 'hsl(110 35% 30%)']]); x.fillRect(0, 0, w, h); for (let i = 0; i < 16; i++) { const tx = ((i * 53) % 100) / 100 * w, th = h * (0.5 + (i % 4) * 0.1); x.fillStyle = `hsl(${120 + (i % 3) * 8} 40% ${18 + (i % 4) * 5}%)`; x.beginPath(); x.moveTo(tx, h - th); x.lineTo(tx - w * 0.07, h * 0.9); x.lineTo(tx + w * 0.07, h * 0.9); x.fill(); } x.fillStyle = 'hsl(35 35% 45%)'; x.beginPath(); x.moveTo(w * 0.45, h); x.lineTo(w * 0.5, h * 0.7); x.lineTo(w * 0.55, h); x.fill(); } },
  { name: 'Dog on the beach.jpg', labels: ['dog', 'beach', 'sea', 'sand'], daysAgo: 365, draw: (x, w, h) => { x.fillStyle = sky(x, h, [[0, 'hsl(200 75% 70%)'], [0.5, 'hsl(195 60% 85%)'], [0.51, 'hsl(195 60% 45%)'], [0.66, 'hsl(190 50% 55%)'], [0.67, 'hsl(42 55% 75%)'], [1, 'hsl(38 50% 65%)']]); x.fillRect(0, 0, w, h); x.fillStyle = 'hsl(25 45% 35%)'; x.beginPath(); x.ellipse(w * 0.5, h * 0.78, w * 0.12, h * 0.06, 0, 0, Math.PI * 2); x.fill(); x.beginPath(); x.ellipse(w * 0.63, h * 0.71, w * 0.05, h * 0.05, 0, 0, Math.PI * 2); x.fill(); x.fillRect(w * 0.41, h * 0.8, w * 0.025, h * 0.1); x.fillRect(w * 0.56, h * 0.8, w * 0.025, h * 0.1); } },
  { name: 'Snowy field.jpg', labels: ['snow', 'winter', 'field', 'sky'], daysAgo: 300, draw: (x, w, h) => { x.fillStyle = sky(x, h, [[0, 'hsl(210 30% 70%)'], [1, 'hsl(210 30% 90%)']]); x.fillRect(0, 0, w, h); hills(x, w, h, h * 0.6, h * 0.04, 'hsl(210 25% 96%)', 2); x.fillStyle = 'hsl(0 0% 100%)'; for (let i = 0; i < 70; i++) x.fillRect(((i * 61) % 97) / 97 * w, ((i * 29) % 89) / 89 * h * 0.6, 3, 3); } },
  { name: 'Lake reflection.jpg', labels: ['lake', 'water', 'reflection', 'mountain'], daysAgo: 120, draw: (x, w, h) => { x.fillStyle = sky(x, h, [[0, 'hsl(200 60% 65%)'], [0.5, 'hsl(190 40% 85%)'], [0.5, 'hsl(190 40% 60%)'], [1, 'hsl(200 50% 35%)']]); x.fillRect(0, 0, w, h); x.fillStyle = 'hsl(150 25% 30%)'; x.beginPath(); x.moveTo(0, h * 0.5); x.lineTo(w * 0.35, h * 0.25); x.lineTo(w * 0.7, h * 0.5); x.fill(); x.fillStyle = 'hsl(150 25% 30% / 0.45)'; x.beginPath(); x.moveTo(0, h * 0.5); x.lineTo(w * 0.35, h * 0.75); x.lineTo(w * 0.7, h * 0.5); x.fill(); } },
  { name: 'Desert dunes.jpg', labels: ['desert', 'sand', 'dune', 'sky'], daysAgo: 128, draw: (x, w, h) => { x.fillStyle = sky(x, h, [[0, 'hsl(205 70% 60%)'], [1, 'hsl(40 60% 85%)']]); x.fillRect(0, 0, w, h); hills(x, w, h, h * 0.55, h * 0.06, 'hsl(32 65% 60%)', 3); hills(x, w, h, h * 0.72, h * 0.05, 'hsl(28 60% 50%)', 5); } },
  { name: 'Desert camp.jpg', labels: ['desert', 'tent', 'camp', 'night'], daysAgo: 127, draw: (x, w, h) => { x.fillStyle = sky(x, h, [[0, 'hsl(240 50% 12%)'], [1, 'hsl(25 50% 35%)']]); x.fillRect(0, 0, w, h); hills(x, w, h, h * 0.7, h * 0.04, 'hsl(28 40% 25%)', 4); x.fillStyle = 'hsl(30 80% 60%)'; x.beginPath(); x.moveTo(w * 0.4, h * 0.8); x.lineTo(w * 0.5, h * 0.62); x.lineTo(w * 0.6, h * 0.8); x.fill(); x.fillStyle = 'hsl(0 0% 100%)'; for (let i = 0; i < 50; i++) x.fillRect(((i * 41) % 97) / 97 * w, ((i * 23) % 61) / 61 * h * 0.5, 2, 2); } },
  { name: 'Desert sunrise.jpg', labels: ['desert', 'sunrise', 'sky', 'dune'], daysAgo: 126, draw: (x, w, h) => { x.fillStyle = sky(x, h, [[0, 'hsl(20 70% 55%)'], [1, 'hsl(45 80% 80%)']]); x.fillRect(0, 0, w, h); sun(x, w * 0.3, h * 0.55, h * 0.08, 'hsl(48 100% 85%)'); hills(x, w, h, h * 0.62, h * 0.05, 'hsl(30 60% 50%)', 6); } },
  { name: 'Desert road.jpg', labels: ['desert', 'road', 'car', 'sky'], daysAgo: 125, draw: (x, w, h) => { x.fillStyle = sky(x, h, [[0, 'hsl(205 65% 62%)'], [1, 'hsl(40 55% 80%)']]); x.fillRect(0, 0, w, h); hills(x, w, h, h * 0.6, h * 0.02, 'hsl(33 55% 58%)', 7); x.fillStyle = 'hsl(0 0% 25%)'; x.beginPath(); x.moveTo(w * 0.47, h * 0.6); x.lineTo(w * 0.2, h); x.lineTo(w * 0.8, h); x.lineTo(w * 0.53, h * 0.6); x.fill(); } },
  { name: 'Flower field.jpg', labels: ['flower', 'field', 'garden', 'nature'], daysAgo: 180, draw: (x, w, h) => { x.fillStyle = sky(x, h, [[0, 'hsl(200 70% 75%)'], [0.45, 'hsl(200 50% 88%)'], [0.46, 'hsl(100 45% 45%)'], [1, 'hsl(110 40% 30%)']]); x.fillRect(0, 0, w, h); for (let i = 0; i < 120; i++) { x.fillStyle = `hsl(${[330, 50, 280, 10][i % 4]} 80% 65%)`; x.beginPath(); x.arc(((i * 47) % 101) / 101 * w, h * 0.5 + ((i * 31) % 53) / 53 * h * 0.5, 4 + (i % 3) * 2, 0, Math.PI * 2); x.fill(); } } },
];

/** Draw the sample photos (a trip of four in the desert, the same sunset twice for DUPLICATES, one a year ago today for ON THIS DAY). */
export async function addSamples(): Promise<number> {
  let n = 0;
  const now = Date.now();
  const scenes = [...SCENES, { ...SCENES[0]!, name: 'Sunset over the sea (2).jpg', daysAgo: 2 }];
  for (const [i, s] of scenes.entries()) {
    const c = document.createElement('canvas');
    c.width = 1200;
    c.height = 900;
    const x = c.getContext('2d');
    if (!x) continue;
    s.draw(x, c.width, c.height);
    // the duplicate is the same moment a hair later: a touch brighter, so it is near, not identical
    if (i === scenes.length - 1) {
      x.fillStyle = 'hsl(0 0% 100% / 0.04)';
      x.fillRect(0, 0, c.width, c.height);
    }
    const blob = await toBlob(c, 0.86);
    if (!blob) continue;
    const taken = now - s.daysAgo * DAY - i * 60_000;
    const file = new File([blob], s.name, { type: 'image/jpeg', lastModified: taken });
    const it = await bringIn(file, { sample: true, labels: s.labels, taken });
    if (it) n += 1;
  }
  changed();
  return n;
}

/** Every sample photo gone (his own stay). */
export async function removeSamples(): Promise<number> {
  const s = (await items()).filter((i) => i.sample);
  for (const it of s) await removeForGood(it.id, false);
  changed();
  return s.length;
}

const SAMPLES_KEY = 'ghosty.photos.samples';
/** Whether the first run's samples were ever put in (they come once; REMOVE SAMPLES is for good). */
export const samplesShown = (): boolean => {
  try {
    return localStorage.getItem(SAMPLES_KEY) === '1';
  } catch {
    return false;
  }
};
export const markSamplesShown = (): void => {
  try {
    localStorage.setItem(SAMPLES_KEY, '1');
  } catch {
    /* a private window: they may come again next visit */
  }
};
