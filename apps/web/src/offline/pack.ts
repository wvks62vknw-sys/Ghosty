/**
 * THE PACK RULE (BRIEF-OFFLINE-1): the one way a pack of files comes to this phone, for the map of his area and for the Lens's eyes,
 * and for any pack after them. It is the rule WIKIPEDIA, OFFLINE set (wiki/store.ts) and the offline brain's pieces (offline/fill.ts):
 * a pack is offered with its size said, fetched only on his tap, on Wi-Fi (where the browser says it is on mobile data it waits;
 * Safari never says, so the words ask for Wi-Fi), after checking the space the phone gives Ghosty can hold it, file by file into the
 * Cache API (a cache whose name the service worker never clears: it clears only `ghosty-shell-` and `ghosty-vendor-` ones), each file
 * checked, a log in localStorage before each file so a close loses at most the files in flight and GET again carries on from the
 * files that are missing, STOP at any moment, DELETE in one tap (the panel gives it UNDO). The words are the Wikipedia pack's.
 *
 * A pack's files may be many and small (the map's tiles) or few and large (the Lens's models): both go the same way, a few at a time.
 * The files are only ever fetched from a public address with no key (the map's source, or this site's own /vendor): nothing here
 * carries his position, his pictures or anything of his to anywhere, and the brain never reads a byte of a pack.
 */
import { checkStorage } from '../features/system/storage';
import { progressLine, offMobileData, onMobileData } from '../wiki/store';
import { sizeWords } from '../wiki/files';

export { onMobileData, offMobileData, sizeWords };

/** One file of a pack: where it comes from, and what it is called in the cache (its address when not said). */
export interface PackFile {
  url: string;
  key?: string;
  /** Its exact size in bytes, when it is known before the fetch (a model); a wrong size stops the download. */
  bytes?: number;
  /** A file the source may not have (a tile in the sea): a 404 is kept as an empty entry rather than stopping the download. */
  mayBeMissing?: true;
}

export interface PackDef {
  /** Steady, for the phone's own records. */
  id: string;
  /** The Cache API cache its files are kept in. */
  cache: string;
  /** How he knows it. */
  name: string;
  /** One line: what is in it. */
  what: string;
  /** The licence, said in the row. */
  licence: string;
  /** The month of its data (the date its files were fetched replaces it once they are here). */
  month: string;
  /** The size said before the tap, in bytes: exact for a fixed file set, an estimate (`about`) where the server decides. */
  bytes: number;
  about?: true;
  /** A few at a time (the map's many small tiles take more at once than a model of 20 MB does). */
  parallel?: number;
  /** Its cache is shared with other packs that may hold some of the same files (the Lens's): DELETE keeps what another still needs. */
  shared?: true;
  /** What it fetches: the list of files, made when GET starts (it may read a sheet that names the rest). */
  plan(signal?: AbortSignal): Promise<PackFile[]>;
  /** One line said under the size when it matters (what it cannot do). */
  note?: string;
}

/** Tests only (window.__ghostyPackTest): a smaller map (the highest zoom it fetches) and another number of files at once. */
interface TestHook {
  maxZoom?: number;
  parallel?: number;
}
export const packHook = (): TestHook => (globalThis as { __ghostyPackTest?: TestHook }).__ghostyPackTest ?? {};

const KEPT_KEY = 'ghosty.pack.kept';
const LOG_KEY = 'ghosty.pack.getting';

/** A pack whose download finished here: how many files, how many bytes, when, and the month its data is from. */
export interface Kept {
  files: number;
  bytes: number;
  at: number;
  date?: string;
}
export function keptAll(): Record<string, Kept> {
  try {
    const v = JSON.parse(localStorage.getItem(KEPT_KEY) ?? '{}') as Record<string, Kept>;
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}
function setKept(id: string, v: Kept | null): void {
  try {
    const all = keptAll();
    if (v) all[id] = v;
    else delete all[id];
    localStorage.setItem(KEPT_KEY, JSON.stringify(all));
  } catch {
    /* storage blocked: the files are still in the cache */
  }
}

export const keyOf = (f: PackFile): string => f.key ?? f.url;

/** The cache entry for an empty answer (a tile the source does not have): kept so GET never asks for it twice. */
export const EMPTY = 'x-ghosty-empty';

/** The files each pack here fetches last time it was planned (for DELETE to know which entries are whose, and what another pack still needs). */
const PLANS_KEY = 'ghosty.pack.plans';
function setPlan(id: string, keys: string[] | null): void {
  try {
    const all = JSON.parse(localStorage.getItem(PLANS_KEY) ?? '{}') as Record<string, string[]>;
    if (keys) all[id] = keys;
    else delete all[id];
    localStorage.setItem(PLANS_KEY, JSON.stringify(all));
  } catch {
    /* blocked */
  }
}
function planOf(id: string): string[] | null {
  try {
    const v = (JSON.parse(localStorage.getItem(PLANS_KEY) ?? '{}') as Record<string, string[]>)[id];
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

/** How many of a pack's files are in its cache now. */
export async function filesIn(p: PackDef): Promise<number> {
  if (typeof caches === 'undefined') return 0;
  try {
    if (!(await caches.has(p.cache))) return 0;
    const keys = planOf(p.id);
    const have = (await (await caches.open(p.cache)).keys()).map((r) => r.url);
    if (!keys) return have.length;
    const set = new Set(have);
    return keys.filter((k) => set.has(absolute(k))).length;
  } catch {
    return 0;
  }
}
/** A cache key as the cache reports it (a path becomes an address). */
const absolute = (k: string): string => {
  try {
    return new URL(k, location.href).href;
  } catch {
    return k;
  }
};

/** Packs that were whole here and lost files since (iPhone clears space when it runs low): said by name in the panel. */
export const goneFiles = new Set<string>();

/** Whether a pack's download finished here and all its files are still here (a phone that cleared some loses the mark). */
export async function isHere(p: PackDef): Promise<boolean> {
  const k = keptAll()[p.id];
  if (!k) return false;
  if ((await filesIn(p)) >= k.files) return true;
  setKept(p.id, null);
  goneFiles.add(p.id);
  return false;
}

// ---------------------------------------------------------------- GET

/** A GET this phone's space cannot hold, in plain words, before a byte is fetched ('' when it fits or the browser will not say). */
export async function roomFor(p: PackDef): Promise<string> {
  const est = await (navigator.storage?.estimate?.() ?? Promise.resolve(null)).catch(() => null);
  if (!est || !(Number(est.quota) > 0)) return '';
  const free = Math.max(0, Number(est.quota) - (Number(est.usage) || 0));
  if (p.bytes <= free) return '';
  return `This phone gives Ghosty ${sizeWords(Number(est.quota))} of space (${sizeWords(free)} of it free); ${p.name} needs ${p.about ? 'about ' : ''}${sizeWords(p.bytes)} more. Nothing was downloaded: free some space on the phone.`;
}

export interface GetProgress {
  /** Files kept so far (the one being fetched counts when it lands). */
  piece: number;
  of: number;
  got: number;
  total: number;
}

let askedKeep = false;

const stopped = () => Object.assign(new Error('stopped'), { name: 'AbortError' });

/** The size as said on the button and in every line: "about 69 MB" for an estimate. */
export const sizeSaid = (p: Pick<PackDef, 'bytes' | 'about'>): string => `${p.about ? 'about ' : ''}${sizeWords(p.bytes)}`;

/** The words for a pack kept here: "<name>, <month>, <size> on your phone". */
export const keptWords = (p: Pick<PackDef, 'name' | 'month' | 'id'>, k: Kept): string => `${p.name}, ${k.date ?? p.month}, ${sizeWords(k.bytes)} on your phone`;

/**
 * GET: the pack's missing files, a few at a time (his tap, already on Wi-Fi: the panel waits for it). Throws plain words when it
 * cannot go on; what is stored so far stays, and GET again carries on.
 */
export async function getPack(p: PackDef, onProgress?: (g: GetProgress) => void, signal?: AbortSignal): Promise<void> {
  if (typeof caches === 'undefined') throw new Error(`This browser cannot keep a download, so ${p.name} cannot be kept on it.`);
  goneFiles.delete(p.id);
  if (!askedKeep) {
    askedKeep = true;
    await checkStorage(true);
  }
  const room = await roomFor(p);
  if (room) throw new Error(room);
  let files: PackFile[];
  try {
    files = await p.plan(signal);
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e;
    throw new Error(`I could not read what ${p.name} holds (the connection dropped, or its source is not answering). Tap GET again on Wi-Fi.`);
  }
  if (p.shared) setPlan(p.id, files.map(keyOf));
  const cache = await caches.open(p.cache);
  const have = new Set((await cache.keys()).map((r) => r.url));
  const total = p.bytes;
  const resumed = readLog()?.id === p.id ? readLog()!.bytes : 0;
  const held = files.filter((f) => have.has(absolute(keyOf(f))));
  let done = held.length;
  // the bytes already here: a model's are known; a tile's are what the log said when the last GET stopped
  let got = held.reduce((n, f) => n + (f.bytes ?? 0), 0) + (held.some((f) => f.bytes == null) ? resumed : 0);
  const todo = files.filter((f) => !have.has(absolute(keyOf(f))));
  const say = () => onProgress?.({ piece: done, of: files.length, got: Math.min(got, total), total });
  say();
  let failure: Error | null = null;
  let next = 0;
  const worker = async (): Promise<void> => {
    while (!failure) {
      if (signal?.aborted) throw stopped();
      const f = todo[next++];
      if (!f) return;
      writeLog({ id: p.id, piece: done + 1, of: files.length, bytes: got, at: Date.now() });
      let res: Response;
      try {
        res = await fetch(f.url, { cache: 'no-store', credentials: 'omit', signal, ...(f.url.startsWith('/') ? { headers: { 'x-ghosty-pack': '1' } } : {}) });
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') throw e;
        throw new Error(`The download stopped at piece ${done + 1} of ${files.length} (the connection dropped?). Tap GET again on Wi-Fi: it carries on from there.`);
      }
      let buf: ArrayBuffer;
      if (res.status === 404 && f.mayBeMissing) buf = new ArrayBuffer(0);
      else if (!res.ok) throw new Error(`The download stopped at piece ${done + 1} (the server said ${res.status}). Tap GET again on Wi-Fi: it carries on from there.`);
      else buf = await res.arrayBuffer();
      if (f.bytes != null && buf.byteLength !== f.bytes) throw new Error(`Piece ${done + 1} came back the wrong size. Tap GET again on Wi-Fi: it fetches that piece again.`);
      if (!buf.byteLength && !f.mayBeMissing) throw new Error(`Piece ${done + 1} came back empty. Tap GET again on Wi-Fi: it fetches that piece again.`);
      try {
        await cache.put(
          keyOf(f),
          new Response(buf, { headers: { 'content-type': res.headers.get('content-type') ?? 'application/octet-stream', 'content-length': String(buf.byteLength), ...(buf.byteLength ? {} : { [EMPTY]: '1' }) } }),
        );
      } catch (e) {
        if ((e as Error)?.name === 'QuotaExceededError') throw new Error(`This phone has no room left for ${p.name}: free some space, then tap GET again. What is stored so far stays.`);
        throw e;
      }
      got += buf.byteLength;
      done++;
      say();
    }
  };
  const n = Math.max(1, packHook().parallel ?? p.parallel ?? 3);
  await Promise.all(
    Array.from({ length: Math.min(n, Math.max(1, todo.length)) }, () =>
      worker().catch((e: unknown) => {
        failure ??= e as Error;
      }),
    ),
  );
  if (failure) throw failure;
  setKept(p.id, { files: files.length, bytes: got, at: Date.now(), date: dateWords(new Date()) });
  clearLog();
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** "November 2026": the month a pack was fetched (its data is as old as that). */
export const dateWords = (d: Date): string => `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

/** A GET that had not finished when Ghosty closed (the log written before each file). */
export function readLog(): { id: string; piece: number; of: number; bytes: number; at: number } | null {
  try {
    const v = JSON.parse(localStorage.getItem(LOG_KEY) ?? 'null') as { id: string; piece: number; of: number; bytes: number; at: number } | null;
    return v && typeof v.id === 'string' ? { ...v, bytes: Number(v.bytes) || 0 } : null;
  } catch {
    return null;
  }
}
function writeLog(v: { id: string; piece: number; of: number; bytes: number; at: number }): void {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(v));
  } catch {
    /* blocked: the download still runs */
  }
}
function clearLog(): void {
  try {
    localStorage.removeItem(LOG_KEY);
  } catch {
    /* blocked */
  }
}

/**
 * DELETE: the pack's files gone from this phone (and the half of one that was on its way), except any another pack kept here still
 * needs (the Lens's runtime is shared). Returns the bytes freed.
 */
export async function deletePack(p: PackDef): Promise<number> {
  const kept = keptAll()[p.id];
  setKept(p.id, null);
  if (readLog()?.id === p.id) clearLog();
  const mine = planOf(p.id);
  setPlan(p.id, null);
  if (typeof caches === 'undefined' || !(await caches.has(p.cache))) return 0;
  const cache = await caches.open(p.cache);
  const needed = new Set<string>();
  for (const [id, k] of Object.entries(keptAll())) if (id !== p.id && k) for (const key of planOf(id) ?? []) needed.add(absolute(key));
  const mineSet = mine ? new Set(mine.map(absolute)) : null;
  const gone = (await cache.keys()).filter((r) => (mineSet ? mineSet.has(r.url) : true) && !needed.has(r.url));
  await Promise.all(gone.map((r) => cache.delete(r)));
  if (!(await cache.keys()).length) await caches.delete(p.cache).catch(() => false);
  return kept?.bytes ?? 0;
}

/** The mobile-data words, as the Wikipedia pack says them. */
export const mobileWords = (p: PackDef): string => `You are on mobile data, and ${p.name} is ${sizeSaid(p)}: it waits for Wi-Fi. Join Wi-Fi and it starts by itself.`;
/** "On Wi-Fi: getting <name> (<size>)…". */
export const gettingWords = (p: PackDef): string => `On Wi-Fi: getting ${p.name} (${sizeSaid(p)})…`;
export { progressLine };

/** A pack in a cache by its address, for whoever draws from it (the map's protocol, the Lens's loader). */
export async function fromPack(cacheName: string, url: string): Promise<Response | undefined> {
  if (typeof caches === 'undefined') return undefined;
  try {
    if (!(await caches.has(cacheName))) return undefined;
    return await (await caches.open(cacheName)).match(url);
  } catch {
    return undefined;
  }
}

/** Whether the phone says it has no signal (Safari says it too, when it is truly off). */
export const offline = (): boolean => typeof navigator !== 'undefined' && navigator.onLine === false;
