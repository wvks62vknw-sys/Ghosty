/**
 * GET and DOWNLOAD: a brain's files into WebLLM's own cache, and nothing else (24 Oct, after the Qwen3.5 2B closed
 * Ghosty on the owner's 18 Pro Max). WebLLM's `reload` downloads AND loads in one go: four weight shards at a time (up to
 * 254 MB each for the 2B), then every weight into graphics memory straight after, which is where iOS closed the page.
 * Here the files go into the very stores and keys `reload` looks for (web-llm.mjs ArtifactCache: `webllm/config` holds
 * mlc-chat-config.json, `webllm/model` the tensor-cache.json, every shard and the tokenizer, `webllm/wasm` the compiled
 * library, each keyed by its full URL), so a later load finds everything (`hasAllKeys` → cache only) and downloads
 * nothing. One piece at a time: each response is handed to the Cache API as it comes (never read into JavaScript), so at
 * most one piece is in flight. No graphics device is asked for.
 *
 * Crash-safe: before each piece, `{ model, piece, of, bytes, at }` goes to localStorage (synchronously, so it is there
 * even if iOS closes the page a moment later); a finished download clears it. A piece already in the cache is skipped,
 * so GET after an interruption carries on from where it stopped (the Cache API stores a piece whole or not at all).
 */
import { modelBase, type ModelDef } from './models';

/** The progress log of a download that has not finished (localStorage, written before each piece). */
export interface GetLog {
  model: string;
  piece: number;
  of: number;
  bytes: number;
  at: number;
}
export const LOG_KEY = 'ghosty.offlinebrain.getting';

export function readLog(): GetLog | null {
  try {
    const v = JSON.parse(localStorage.getItem(LOG_KEY) ?? 'null') as GetLog | null;
    return v && typeof v.model === 'string' && Number.isFinite(v.piece) ? v : null;
  } catch {
    return null;
  }
}
export function writeLog(l: GetLog): void {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(l));
  } catch {
    /* storage full or blocked: the download still runs */
  }
}
export function clearLog(model?: string): void {
  try {
    if (!model || readLog()?.model === model) localStorage.removeItem(LOG_KEY);
  } catch {
    /* blocked */
  }
}

/** One file of a brain: which of WebLLM's stores it goes into, its address (the key) and its size when known. */
export interface Piece {
  store: 'webllm/model' | 'webllm/config' | 'webllm/wasm';
  url: string;
  bytes: number;
}

/** "piece 37 of 120 · 412 MB of 1,082 MB" (MB as files are counted: 1,000,000 bytes). */
export function pieceLine(piece: number, of: number, bytes: number, total: number): string {
  const mb = (b: number) => Math.round(b / 1e6).toLocaleString('en-GB');
  return `piece ${piece} of ${of} · ${mb(bytes)} MB of ${mb(total)} MB`;
}

/** What `fill` reports as it goes: the piece it is getting now and the bytes stored before it (`done` at the end). */
export interface FillProgress {
  piece: number;
  of: number;
  bytes: number;
  total: number;
  done: boolean;
}

/** The model's compiled code, as brain.ts gives it to WebLLM (`model_lib`): the key WebLLM's `webllm/wasm` store uses. */
export const libUrl = (m: Pick<ModelDef, 'lib'>, origin: string): string => new URL(`/vendor/webllm/libs/${m.lib}`, origin).href;

/** A piece that came back wrong: no retry would help (the files are gone or not what was pinned). */
const httpError = (url: string, status: number) => new Error(`HTTP ${status} for ${url.split('/').pop()}`);

/**
 * Fetch one piece into its store, unless it is there already. The response goes straight to `cache.put` (the
 * browser writes it as it arrives; JavaScript never holds it), so memory holds at most this one piece.
 */
async function store(p: Piece, have: Map<string, Set<string>>, signal?: AbortSignal): Promise<boolean> {
  let keys = have.get(p.store);
  if (!keys) {
    const c = await caches.open(p.store);
    keys = new Set((await c.keys()).map((r) => r.url));
    have.set(p.store, keys);
  }
  if (keys.has(p.url)) return false;
  const res = await fetch(p.url, { signal, cache: 'no-store' });
  if (!res.ok) throw httpError(p.url, res.status);
  await (await caches.open(p.store)).put(new Request(p.url), res);
  keys.add(p.url);
  return true;
}

/** A small JSON file already stored (the list of shards, the chat settings). */
async function stored<T>(storeName: string, url: string): Promise<T> {
  const r = await (await caches.open(storeName)).match(new Request(url));
  if (!r) throw new Error(`${url.split('/').pop()} is missing from the cache`);
  return (await r.json()) as T;
}

/**
 * Every file WebLLM's `reload` reads for this model, in its stores, one at a time; `onProgress` and the log before each
 * piece (and `onProgress` once more at the end). Resolves when all are stored (the log is then cleared).
 */
export async function fill(m: ModelDef, origin: string, onProgress?: (p: FillProgress) => void, signal?: AbortSignal): Promise<void> {
  if (typeof caches === 'undefined') throw new Error('This browser cannot keep a download (no Cache storage).');
  const base = modelBase(m);
  const have = new Map<string, Set<string>>();
  const config: Piece = { store: 'webllm/config', url: new URL('mlc-chat-config.json', base).href, bytes: 0 };
  const list: Piece = { store: 'webllm/model', url: new URL('tensor-cache.json', base).href, bytes: 0 };
  // The two small files first (the list of pieces is in the second); they count as pieces 1 and 2.
  const before = readLog();
  const resumed = before?.model === m.id ? before : null;
  writeLog({ model: m.id, piece: 1, of: resumed?.of ?? 0, bytes: resumed?.bytes ?? 0, at: Date.now() });
  await store(config, have, signal);
  writeLog({ model: m.id, piece: 2, of: resumed?.of ?? 0, bytes: resumed?.bytes ?? 0, at: Date.now() });
  await store(list, have, signal);
  const records = (await stored<{ records?: { dataPath: string; nbytes: number }[] }>('webllm/model', list.url)).records ?? [];
  if (!records.length) throw new Error('the list of pieces is empty');
  const chat = await stored<{ tokenizer_files?: string[] }>('webllm/config', config.url);
  // WebLLM reads tokenizer.json when the model lists it, else tokenizer.model (asyncLoadTokenizer).
  const tok = (chat.tokenizer_files ?? []).includes('tokenizer.json') ? 'tokenizer.json' : (chat.tokenizer_files ?? []).includes('tokenizer.model') ? 'tokenizer.model' : '';
  const pieces: Piece[] = [
    config,
    list,
    ...(tok ? [{ store: 'webllm/model' as const, url: new URL(tok, base).href, bytes: 0 }] : []),
    ...records.map((r) => ({ store: 'webllm/model' as const, url: new URL(r.dataPath, base).href, bytes: r.nbytes })),
    // its compiled code too, so a load with no signal needs nothing from the network
    { store: 'webllm/wasm', url: libUrl(m, origin), bytes: 0 },
  ];
  const total = records.reduce((a, r) => a + r.nbytes, 0);
  let bytes = 0;
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i]!;
    if (signal?.aborted) throw Object.assign(new Error('stopped'), { name: 'AbortError' });
    // Written before the piece: if iOS closes Ghosty now, the next open knows where it was.
    if (i >= 2) writeLog({ model: m.id, piece: i + 1, of: pieces.length, bytes, at: Date.now() });
    onProgress?.({ piece: i + 1, of: pieces.length, bytes, total, done: false });
    if (i >= 2) await store(p, have, signal);
    bytes += p.bytes;
  }
  onProgress?.({ piece: pieces.length, of: pieces.length, bytes, total, done: true });
  clearLog(m.id);
}

/** Every piece of this model is in WebLLM's stores (the same check WebLLM's `hasModelInCache` makes, plus the config). */
export async function filled(m: ModelDef): Promise<boolean> {
  if (typeof caches === 'undefined') return false;
  try {
    const base = modelBase(m);
    const model = await caches.open('webllm/model');
    const r = await model.match(new Request(new URL('tensor-cache.json', base).href));
    if (!r) return false;
    const records = ((await r.json()) as { records?: { dataPath: string }[] }).records ?? [];
    const keys = new Set((await model.keys()).map((k) => k.url));
    const cfg = await (await caches.open('webllm/config')).match(new Request(new URL('mlc-chat-config.json', base).href));
    return !!cfg && records.length > 0 && records.every((x) => keys.has(new URL(x.dataPath, base).href));
  } catch {
    return false;
  }
}
