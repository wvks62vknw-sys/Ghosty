/**
 * WIKIPEDIA, OFFLINE's files on this phone (the pattern of offline/brain.ts and offline/fill.ts): GET fetches one only on
 * his tap, on Wi-Fi (where the browser says it is on mobile data, it waits; Safari never says, so the words ask for Wi-Fi),
 * after checking the space the phone gives Ghosty can hold it, in pieces of 8 MB with Range requests, each piece kept in
 * the Cache API as its own entry (`ghosty-wiki-v1`, which the service worker never clears) and its size checked; the
 * first piece must start like a ZIM file. A log in localStorage before each piece means a close mid-download loses at
 * most one piece: GET again carries on from where it stopped. DELETE takes every piece away.
 *
 * The bytes come through the Worker (`/api/zim/<file>`, apps/edge/src/zim.ts): download.kiwix.org sends its files from
 * mirrors that answer no other site's page (no CORS), so the Worker passes the owner's Range requests on and streams the
 * answer back, keeping nothing. The brain itself never reads a byte of them.
 *
 * Reading: `pieceFiles` hands Kiwix's reader the pieces as one file in parts (its split-ZIM support), each slice read from
 * its piece, the last six pieces read kept at hand.
 */
import { headers } from '../api/brain';
import { checkStorage } from '../features/system/storage';
import { sizeWords, WIKI_FILES, type WikiFile } from './files';
import { openArchive, type Archive, type PieceFile } from './zim';

export const WIKI_CACHE = 'ghosty-wiki-v1';
/** About 8 MB a piece: small enough that a slice read stays cheap, big enough that 1.1 GB is 131 requests. */
export const PIECE_BYTES = 8 * 1024 * 1024;
const KEPT_KEY = 'ghosty.wiki.kept';
const LOG_KEY = 'ghosty.wiki.getting';
const READING_KEY = 'ghosty.wiki.reading';

/** Tests only (window.__ghostyWikiTest): smaller pieces, and another size for a file (the spec's fixture stands in for it). */
interface TestHook {
  piece?: number;
  bytes?: Record<string, number>;
}
const hook = (): TestHook => (globalThis as { __ghostyWikiTest?: TestHook }).__ghostyWikiTest ?? {};
export const pieceBytes = (): number => hook().piece ?? PIECE_BYTES;
/** The file's size as GET checks it. */
export const bytesOf = (f: WikiFile): number => hook().bytes?.[f.id] ?? f.bytes;

/** The address a piece is kept under (made up: nothing is ever fetched from it). */
export const keyOf = (f: Pick<WikiFile, 'file'>, i: number): string => `https://wiki.ghosty.invalid/${encodeURIComponent(f.file)}/${i}`;

/** The [first, last] byte of each piece of a file of `bytes` (a Range header's numbers). */
export function pieceRanges(bytes: number, piece: number = PIECE_BYTES): [number, number][] {
  if (!(bytes > 0) || !(piece > 0)) return [];
  const out: [number, number][] = [];
  for (let a = 0; a < bytes; a += piece) out.push([a, Math.min(bytes, a + piece) - 1]);
  return out;
}

/** "piece 3 of 131 · 24 MB of 1.1 GB". */
export const progressLine = (piece: number, of: number, got: number, total: number): string => `piece ${piece} of ${of} · ${sizeWords(got)} of ${sizeWords(total)}`;

/** On mobile data, as far as the browser can tell (Safari cannot: the words ask for Wi-Fi). */
export function onMobileData(): boolean {
  const c = (globalThis.navigator as unknown as { connection?: { type?: string; saveData?: boolean } } | undefined)?.connection;
  return c?.type === 'cellular' || c?.saveData === true;
}
/** Resolves once the phone is off mobile data (at once when it is not on it; never when the signal aborts first). */
export function offMobileData(signal?: AbortSignal): Promise<void> {
  if (!onMobileData()) return Promise.resolve();
  const c = (globalThis.navigator as unknown as { connection?: EventTarget }).connection;
  return new Promise((resolve) => {
    const check = () => {
      if (onMobileData()) return;
      c?.removeEventListener('change', check);
      resolve();
    };
    c?.addEventListener('change', check);
    signal?.addEventListener('abort', () => c?.removeEventListener('change', check), { once: true });
  });
}

// ---------------------------------------------------------------- what is here

/** A file whose download finished here: its bytes, its pieces and their size, when, and its own date once read. */
export interface Kept {
  bytes: number;
  pieces: number;
  piece: number;
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
    /* storage blocked: the pieces are still counted in the cache */
  }
}
export function noteDate(id: string, date: string): void {
  const k = keptAll()[id];
  if (k && date && k.date !== date) setKept(id, { ...k, date });
}

/** How many of a file's pieces are in the cache now. */
export async function piecesHere(f: WikiFile): Promise<number> {
  if (typeof caches === 'undefined') return 0;
  try {
    const prefix = keyOf(f, 0).replace(/0$/, '');
    return (await (await caches.open(WIKI_CACHE)).keys()).filter((r) => r.url.startsWith(prefix)).length;
  } catch {
    return 0;
  }
}

/** The files whose download finished and whose pieces are all still here (a phone that cleared them loses the mark). */
export async function filesHere(): Promise<WikiFile[]> {
  const kept = keptAll();
  const out: WikiFile[] = [];
  for (const f of WIKI_FILES) {
    const k = kept[f.id];
    if (!k) continue;
    if ((await piecesHere(f)) >= k.pieces) out.push(f);
    else setKept(f.id, null);
  }
  return out;
}

/** The file he reads now: the one he chose last, else the biggest here. */
export async function readingFile(): Promise<WikiFile | null> {
  const here = await filesHere();
  let id = '';
  try {
    id = localStorage.getItem(READING_KEY) ?? '';
  } catch {
    /* blocked */
  }
  return here.find((f) => f.id === id) ?? [...here].sort((a, b) => b.bytes - a.bytes)[0] ?? null;
}
export function chooseReading(f: WikiFile): void {
  try {
    localStorage.setItem(READING_KEY, f.id);
  } catch {
    /* blocked */
  }
}

// ---------------------------------------------------------------- GET

/** A GET this phone's space cannot hold, in plain words, before a byte is fetched ('' when it fits or the browser will not say). */
export async function roomFor(f: WikiFile): Promise<string> {
  const est = await (navigator.storage?.estimate?.() ?? Promise.resolve(null)).catch(() => null);
  if (!est || !(Number(est.quota) > 0)) return '';
  const have = (await piecesHere(f)) * pieceBytes();
  const need = Math.max(0, bytesOf(f) - have);
  const free = Math.max(0, Number(est.quota) - (Number(est.usage) || 0));
  if (need <= free) return '';
  return `This phone gives Ghosty ${sizeWords(Number(est.quota))} of space (${sizeWords(free)} of it free); ${f.name} needs ${sizeWords(need)} more. Nothing was downloaded: free some space on the phone, or get the smaller one.`;
}

export interface GetProgress {
  piece: number;
  of: number;
  got: number;
  total: number;
}

const ZIM_MAGIC = [0x5a, 0x49, 0x4d, 0x04];
let askedKeep = false;

/**
 * GET: the file's missing pieces, one at a time (his tap, already on Wi-Fi: the panel waits for it). Throws plain words
 * when it cannot go on; what is stored so far stays, and GET again carries on.
 */
export async function getWiki(f: WikiFile, onProgress?: (p: GetProgress) => void, signal?: AbortSignal): Promise<void> {
  if (typeof caches === 'undefined') throw new Error('This browser cannot keep a download, so Wikipedia cannot be kept on it.');
  if (!askedKeep) {
    askedKeep = true;
    await checkStorage(true);
  }
  const room = await roomFor(f);
  if (room) throw new Error(room);
  const total = bytesOf(f);
  const piece = pieceBytes();
  const ranges = pieceRanges(total, piece);
  const cache = await caches.open(WIKI_CACHE);
  const have = new Set((await cache.keys()).map((r) => r.url));
  let got = ranges.filter((_, i) => have.has(keyOf(f, i))).reduce((s, [a, b]) => s + (b - a + 1), 0);
  for (let i = 0; i < ranges.length; i++) {
    if (signal?.aborted) throw Object.assign(new Error('stopped'), { name: 'AbortError' });
    const [a, b] = ranges[i]!;
    if (have.has(keyOf(f, i))) continue;
    writeLog({ id: f.id, piece: i + 1, of: ranges.length, at: Date.now() });
    onProgress?.({ piece: i + 1, of: ranges.length, got, total });
    let res: Response;
    try {
      res = await fetch(`/api/zim/${encodeURIComponent(f.file)}`, { headers: headers({ range: `bytes=${a}-${b}` }), credentials: 'same-origin', cache: 'no-store', signal });
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') throw e;
      throw new Error(`The download stopped at piece ${i + 1} of ${ranges.length} (the connection dropped?). Tap GET again on Wi-Fi: it carries on from there.`);
    }
    if (res.status === 401 || res.status === 403) throw new Error('Wikipedia comes through your own brain, which did not let this phone in: sign in again, then tap GET.');
    if (res.status === 404) throw new Error(`Kiwix no longer has ${f.file}: a newer month replaces it in the next update of Ghosty.`);
    if (res.status !== 206 && !(res.status === 200 && a === 0 && b === total - 1)) throw new Error(`The download stopped at piece ${i + 1} (the server said ${res.status}). Tap GET again on Wi-Fi: it carries on from there.`);
    const range = /bytes (\d+)-(\d+)\/(\d+)/.exec(res.headers.get('content-range') ?? '');
    if (range && Number(range[3]) !== total) throw new Error(`${f.name} on Kiwix is not the file Ghosty expects (it is ${sizeWords(Number(range[3]))}, not ${sizeWords(total)}): nothing more was downloaded.`);
    const buf = await res.arrayBuffer();
    if (buf.byteLength !== b - a + 1 || (range && (Number(range[1]) !== a || Number(range[2]) !== b))) throw new Error(`Piece ${i + 1} came back the wrong size. Tap GET again on Wi-Fi: it fetches that piece again.`);
    if (i === 0 && !ZIM_MAGIC.every((x, k) => new Uint8Array(buf, 0, 4)[k] === x)) throw new Error(`What came back is not a Wikipedia file: nothing was kept.`);
    try {
      await cache.put(keyOf(f, i), new Response(buf, { headers: { 'content-type': 'application/octet-stream', 'content-length': String(buf.byteLength) } }));
    } catch (e) {
      if ((e as Error)?.name === 'QuotaExceededError') throw new Error(`This phone has no room left for ${f.name}: free some space, then tap GET again. What is stored so far stays.`);
      throw e;
    }
    got += buf.byteLength;
    onProgress?.({ piece: i + 1, of: ranges.length, got, total });
  }
  setKept(f.id, { bytes: total, pieces: ranges.length, piece, at: Date.now() });
  clearLog();
}

/** A GET that had not finished when Ghosty closed (the log written before each piece). */
export function readLog(): { id: string; piece: number; of: number; at: number } | null {
  try {
    const v = JSON.parse(localStorage.getItem(LOG_KEY) ?? 'null') as { id: string; piece: number; of: number; at: number } | null;
    return v && typeof v.id === 'string' ? v : null;
  } catch {
    return null;
  }
}
function writeLog(v: { id: string; piece: number; of: number; at: number }): void {
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

/** DELETE: every piece of the file gone from this phone (and the half of one that was on its way). Returns the bytes freed. */
export async function deleteWiki(f: WikiFile): Promise<number> {
  open.delete(f.id);
  const kept = keptAll()[f.id];
  setKept(f.id, null);
  if (readLog()?.id === f.id) clearLog();
  if (typeof caches === 'undefined') return 0;
  const cache = await caches.open(WIKI_CACHE);
  const prefix = keyOf(f, 0).replace(/0$/, '');
  const keys = (await cache.keys()).filter((r) => r.url.startsWith(prefix));
  await Promise.all(keys.map((k) => cache.delete(k)));
  if (!(await cache.keys()).length) await caches.delete(WIKI_CACHE).catch(() => false);
  return kept?.bytes ?? Math.min(bytesOf(f), keys.length * pieceBytes());
}

// ---------------------------------------------------------------- reading

const MISSING = 'A piece of the Wikipedia file has gone from this phone (iPhone clears space when it runs low): GET it again on Wi-Fi.';

/** The file's pieces as Kiwix's reader takes them (a split ZIM): each slice read from its piece, six pieces kept at hand. */
export async function pieceFiles(f: WikiFile): Promise<PieceFile[]> {
  const k = keptAll()[f.id];
  const ranges = pieceRanges(k?.bytes ?? bytesOf(f), k?.piece ?? pieceBytes());
  const cache = await caches.open(WIKI_CACHE);
  const lru = new Map<number, Promise<Blob>>();
  const blobOf = (i: number): Promise<Blob> => {
    let p = lru.get(i);
    if (p) {
      lru.delete(i);
      lru.set(i, p);
      return p;
    }
    p = cache.match(keyOf(f, i)).then((r) => {
      if (!r) throw new Error(MISSING);
      return r.blob();
    });
    p.catch(() => lru.delete(i));
    lru.set(i, p);
    while (lru.size > 6) lru.delete(lru.keys().next().value!);
    return p;
  };
  return ranges.map(([a, b], i) => ({
    name: `${f.file}.p${String(i).padStart(5, '0')}`,
    size: b - a + 1,
    slice: (s: number, e: number) => ({ arrayBuffer: () => blobOf(i).then((bl) => bl.slice(s, e).arrayBuffer()) }),
  }));
}

const open = new Map<string, Promise<Archive>>();
/** The file opened for reading (once; kept open while Ghosty is). */
export function archiveOf(f: WikiFile): Promise<Archive> {
  let a = open.get(f.id);
  if (!a) {
    a = pieceFiles(f).then((files) => openArchive(files));
    a.then((x) => noteDate(f.id, x.meta.date)).catch(() => open.delete(f.id));
    open.set(f.id, a);
  }
  return a;
}
