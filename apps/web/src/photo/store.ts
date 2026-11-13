/**
 * THE PHOTO STORE (BRIEF-EDITOR-PHOTO): the original bytes of every photo he edits kept UNTOUCHED in this phone's own database
 * (IndexedDB, the documents' pictures' shape), the recipe beside it, a small thumbnail for the shelf, and his own looks. Ten originals at
 * most and about 150 megabytes; the oldest is let go first and `room()` (photo/room.ts) says who, before it goes. A phone that keeps
 * nothing (a private window) still edits: the store falls back to this visit's memory and `persistent` says so.
 *
 * Nothing here is sent anywhere.
 */
import { forgetAlphas, getAlpha, putAlpha, type Alpha } from './alpha';
import { cloneRecipe, newRecipe, type Preset, type Recipe } from './recipe';
import { room, type Kept, type Room } from './room';

export interface PhotoMeta extends Kept {
  type: string;
  w: number;
  h: number;
  /** True once any edit was saved. */
  edited: boolean;
  thumb: Blob | null;
  /** The tool and the view he left it in. */
  tool?: string;
}
interface Row extends PhotoMeta {
  original: Blob;
  recipe: Recipe;
  alphas: Record<string, { w: number; h: number; data: Uint8Array }>;
}
interface LayerRow {
  id: string;
  parent: string;
  blob: Blob;
  bytes: number;
  at: number;
}

const DB = 'ghosty-photo';
let dbp: Promise<IDBDatabase | null> | null = null;
const mem = { photos: new Map<string, Row>(), layers: new Map<string, LayerRow>(), presets: new Map<string, Preset>() };
export const storeState = { persistent: true };

function db(): Promise<IDBDatabase | null> {
  dbp ??= new Promise((ok) => {
    try {
      if (typeof indexedDB === 'undefined') throw new Error('no database');
      const rq = indexedDB.open(DB, 1);
      rq.onupgradeneeded = () => {
        const d = rq.result;
        d.createObjectStore('photos', { keyPath: 'id' });
        d.createObjectStore('layers', { keyPath: 'id' });
        d.createObjectStore('presets', { keyPath: 'name' });
      };
      rq.onsuccess = () => ok(rq.result);
      rq.onerror = () => {
        storeState.persistent = false;
        ok(null);
      };
      rq.onblocked = () => ok(null);
    } catch {
      storeState.persistent = false;
      ok(null);
    }
  });
  return dbp;
}

const req = <T>(r: IDBRequest<T>): Promise<T> => new Promise((ok, bad) => ((r.onsuccess = () => ok(r.result)), (r.onerror = () => bad(r.error))));
async function all<T>(store: string, m: Map<string, T>): Promise<T[]> {
  const d = await db();
  if (!d) return [...m.values()];
  try {
    return await req<T[]>(d.transaction(store, 'readonly').objectStore(store).getAll());
  } catch {
    storeState.persistent = false;
    return [...m.values()];
  }
}
async function put<T>(store: string, row: T, m: Map<string, T>, key: string): Promise<void> {
  m.set(key, row);
  const d = await db();
  if (!d) return;
  try {
    await req(d.transaction(store, 'readwrite').objectStore(store).put(row));
  } catch {
    storeState.persistent = false;
  }
}
async function del(store: string, key: string, m: Map<string, unknown>): Promise<void> {
  m.delete(key);
  const d = await db();
  if (!d) return;
  try {
    await req(d.transaction(store, 'readwrite').objectStore(store).delete(key));
  } catch {
    /* nothing kept to remove */
  }
}

const meta = (r: Row): PhotoMeta => ({ id: r.id, name: r.name, at: r.at, bytes: r.bytes, type: r.type, w: r.w, h: r.h, edited: r.edited, thumb: r.thumb, tool: r.tool });

/** His photos, newest first. */
export async function listPhotos(): Promise<PhotoMeta[]> {
  return (await all<Row>('photos', mem.photos)).map(meta).sort((a, b) => b.at - a.at);
}
export async function layerBytes(): Promise<number> {
  return (await all<LayerRow>('layers', mem.layers)).reduce((n, l) => n + l.bytes, 0);
}

/** What keeping one more photo of `bytes` would take (the layers' bytes count against the room too). */
export async function roomFor(bytes: number): Promise<Room> {
  const kept = await listPhotos();
  const extra = await layerBytes();
  const r = room(kept, bytes + extra);
  return r;
}

/** Keep a photo: its bytes untouched, a fresh recipe. The oldest that would not fit are let go (named in `dropped`). */
export async function keepPhoto(original: Blob, name: string, size: { w: number; h: number }): Promise<{ meta: PhotoMeta; dropped: Kept[]; room: Room }> {
  const r = await roomFor(original.size);
  if (r.tooBig) throw new Error(r.words);
  for (const d of r.drop) await removePhoto(d.id);
  const id = `p${Date.now().toString(36)}${Math.floor(Math.random() * 1e5).toString(36)}`;
  const row: Row = { id, name, at: Date.now(), bytes: original.size, type: original.type || 'image/jpeg', w: size.w, h: size.h, edited: false, thumb: null, original, recipe: newRecipe(), alphas: {} };
  await put('photos', row, mem.photos, id);
  return { meta: meta(row), dropped: r.drop, room: r };
}

async function row(id: string): Promise<Row | null> {
  const d = await db();
  if (!d) return mem.photos.get(id) ?? null;
  try {
    return ((await req(d.transaction('photos', 'readonly').objectStore('photos').get(id))) as Row | undefined) ?? mem.photos.get(id) ?? null;
  } catch {
    return mem.photos.get(id) ?? null;
  }
}
export async function getOriginal(id: string): Promise<Blob | null> {
  return (await row(id))?.original ?? null;
}
export async function getMeta(id: string): Promise<PhotoMeta | null> {
  const r = await row(id);
  return r ? meta(r) : null;
}

/** The recipe he left, with its brush pictures put back where the pipeline finds them. */
export async function getRecipe(id: string): Promise<Recipe | null> {
  const r = await row(id);
  if (!r) return null;
  for (const [k, a] of Object.entries(r.alphas ?? {})) putAlpha({ w: a.w, h: a.h, data: a.data }, k);
  return { ...newRecipe(), ...r.recipe };
}

/** The recipe saved (and the brush pictures it names), the thumbnail when there is a new one. Said once by the screen as "Saved". */
export async function saveRecipe(id: string, recipe: Recipe, opts: { thumb?: Blob | null; tool?: string } = {}): Promise<boolean> {
  const r = await row(id);
  if (!r) return false;
  const names = new Set<string>();
  for (const m of recipe.masks) if (m.alpha) names.add(m.alpha);
  if (recipe.layer?.mask?.alpha) names.add(recipe.layer.mask.alpha);
  const alphas: Row['alphas'] = {};
  for (const n of names) {
    const a: Alpha | null = getAlpha(n);
    if (a) alphas[n] = { w: a.w, h: a.h, data: a.data };
  }
  const edited = JSON.stringify(recipe) !== JSON.stringify(newRecipe());
  await put('photos', { ...r, recipe: cloneRecipe(recipe), alphas, edited, at: Date.now(), thumb: opts.thumb ?? r.thumb, tool: opts.tool ?? r.tool }, mem.photos, id);
  forgetAlphas(names);
  return true;
}

export async function removePhoto(id: string): Promise<void> {
  await del('photos', id, mem.photos);
  for (const l of await all<LayerRow>('layers', mem.layers)) if (l.parent === id) await del('layers', l.id, mem.layers);
}

/** A second photo kept for a layer (it belongs to the photo it is a layer of). */
export async function keepLayer(parent: string, blob: Blob): Promise<string> {
  const id = `l${Date.now().toString(36)}${Math.floor(Math.random() * 1e5).toString(36)}`;
  await put('layers', { id, parent, blob, bytes: blob.size, at: Date.now() }, mem.layers, id);
  return id;
}
export async function getLayer(id: string): Promise<Blob | null> {
  const d = await db();
  if (!d) return mem.layers.get(id)?.blob ?? null;
  try {
    return ((await req(d.transaction('layers', 'readonly').objectStore('layers').get(id))) as LayerRow | undefined)?.blob ?? mem.layers.get(id)?.blob ?? null;
  } catch {
    return mem.layers.get(id)?.blob ?? null;
  }
}
export const removeLayer = (id: string): Promise<void> => del('layers', id, mem.layers);

// ------------------------------------------------------------------ his own looks
export async function listMyLooks(): Promise<Preset[]> {
  return (await all<Preset>('presets', mem.presets)).sort((a, b) => a.name.localeCompare(b.name));
}
export const saveMyLook = (p: Preset): Promise<void> => put('presets', p, mem.presets, p.name);
export const removeMyLook = (name: string): Promise<void> => del('presets', name, mem.presets);

/** Where he was (the photo and the tool), kept on this phone for the next time. */
const LAST = 'ghosty.photo.last';
export function rememberLast(id: string, tool: string): void {
  try {
    localStorage.setItem(LAST, JSON.stringify({ id, tool }));
  } catch {
    /* kept for this visit only */
  }
}
export function lastOpen(): { id: string; tool: string } | null {
  try {
    const v = JSON.parse(localStorage.getItem(LAST) ?? 'null') as { id?: unknown; tool?: unknown } | null;
    return v && typeof v.id === 'string' ? { id: v.id, tool: typeof v.tool === 'string' ? v.tool : 'light' } : null;
  } catch {
    return null;
  }
}
export function forgetLast(): void {
  try {
    localStorage.removeItem(LAST);
  } catch {
    /* nothing to forget */
  }
}
