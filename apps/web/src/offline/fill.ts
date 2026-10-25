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
 *
 * In parts (25 Oct, after the 4B's download still closed Ghosty): a piece bigger than PART_BYTES (about 32 MB; the 2B's
 * are up to 254 MB) is fetched in Range-request parts, one at a time, each kept as its own entry in `ghosty-brain-parts`
 * with the log (`part`, `parts`) written before it; when all its parts are here, the whole piece is built from them as a
 * stream (one part read at a time) and stored in WebLLM's store as ONE entry under the piece's own address, exactly what
 * WebLLM matches, and the parts go. A close mid-piece loses at most the part on its way: CONTINUE fetches from the next
 * part. (WebKit may still gather a piece's body in memory before writing it: what the Cache API does with a stream is the
 * browser's, not Ghosty's.)
 *
 * What GET finished is remembered per brain (`ghosty.offlinebrain.stored`: how many pieces, when), so a later open that
 * finds fewer can say so by name (models.ts goneLine) instead of offering a silent new download.
 */
import { PART_BYTES, modelBase, partRanges, type ModelDef } from './models';

/** The progress log of a download that has not finished (localStorage, written before each piece). */
export interface GetLog {
  model: string;
  piece: number;
  of: number;
  bytes: number;
  at: number;
  /** The part of that piece on its way, and how many it has (a piece fetched in parts). */
  part?: number;
  parts?: number;
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

/** "piece 37 of 120 · 412 MB of 1,082 MB", with "· part 3 of 8" for a piece fetched in parts (MB as files are counted: 1,000,000 bytes). */
export function pieceLine(piece: number, of: number, bytes: number, total: number, part?: number, parts?: number): string {
  const mb = (b: number) => Math.round(b / 1e6).toLocaleString('en-GB');
  return `piece ${piece} of ${of}${parts && parts > 1 && part ? ` · part ${part} of ${parts}` : ''} · ${mb(bytes)} MB of ${mb(total)} MB`;
}

/** What `fill` reports as it goes: the piece (and part) it is getting now and the bytes stored before it (`done` at the end). */
export interface FillProgress {
  piece: number;
  of: number;
  bytes: number;
  total: number;
  done: boolean;
  part?: number;
  parts?: number;
}

/** The parts of pieces still being put together (never WebLLM's: only fill reads them). */
export const PARTS_STORE = 'ghosty-brain-parts';
/** A part's own key in PARTS_STORE: the piece's address and which part it is. */
export const partKey = (url: string, i: number, n: number): string => `${url}?ghosty-part=${i + 1}-of-${n}`;

/** What GET finished per brain: how many pieces it stored, and when (localStorage). */
export const STORED_KEY = 'ghosty.offlinebrain.stored';
export function readStored(): Record<string, { of: number; at: number }> {
  try {
    const v = JSON.parse(localStorage.getItem(STORED_KEY) ?? '{}') as Record<string, { of: number; at: number }> | null;
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}
/** A brain's entry in STORED_KEY: its id at its pinned commit (a new commit is a new download, not a loss). */
export const storedId = (m: Pick<ModelDef, 'id' | 'rev'>): string => `${m.id}@${m.rev}`;
/** Remember (or, with `of` 0, forget) that a brain's download finished here. */
export function markStored(model: string, of: number, at = Date.now()): void {
  try {
    const v = readStored();
    if (of > 0) v[model] = { of, at };
    else delete v[model];
    localStorage.setItem(STORED_KEY, JSON.stringify(v));
  } catch {
    /* blocked storage */
  }
}

/** The model's compiled code, as brain.ts gives it to WebLLM (`model_lib`): the key WebLLM's `webllm/wasm` store uses. */
export const libUrl = (m: Pick<ModelDef, 'lib'>, origin: string): string => new URL(`/vendor/webllm/libs/${m.lib}`, origin).href;

/** A piece that came back wrong: no retry would help (the files are gone or not what was pinned). */
const httpError = (url: string, status: number) => new Error(`HTTP ${status} for ${url.split('/').pop()}`);

/** How a piece's parts are reported: before each part (the log and the progress line), with the bytes of it already here. */
type OnPart = (part: number, parts: number, done: number) => void;

/**
 * Fetch one piece into its store, unless it is there already. A small piece: the response goes straight to `cache.put`
 * (the browser writes it as it arrives; JavaScript never holds it). A bigger one: in parts (storeParts). Either way
 * memory holds at most one piece's way in, and never two pieces at once.
 */
async function store(p: Piece, have: Map<string, Set<string>>, signal: AbortSignal | undefined, part: number, onPart?: OnPart): Promise<boolean> {
  let keys = have.get(p.store);
  if (!keys) {
    const c = await caches.open(p.store);
    keys = new Set((await c.keys()).map((r) => r.url));
    have.set(p.store, keys);
  }
  if (keys.has(p.url)) return false;
  if (partRanges(p.bytes, part).length > 1) await storeParts(p, part, signal, onPart);
  else {
    const res = await fetch(p.url, { signal, cache: 'no-store' });
    if (!res.ok) throw httpError(p.url, res.status);
    await (await caches.open(p.store)).put(new Request(p.url), res);
  }
  keys.add(p.url);
  return true;
}

const stop = () => Object.assign(new Error('stopped'), { name: 'AbortError' });

/**
 * A big piece in Range-request parts: each part not yet kept is fetched (one at a time) into PARTS_STORE under its own
 * key; then the piece is built from the parts as a stream, one part read at a time, checked for its length, and stored
 * as one entry under its own address in WebLLM's store; the parts go. A server that ignores the Range (a 200 for the
 * first part) gives the whole piece, which is stored as it comes.
 */
async function storeParts(p: Piece, part: number, signal: AbortSignal | undefined, onPart?: OnPart): Promise<void> {
  const ranges = partRanges(p.bytes, part);
  const n = ranges.length;
  const name = p.url.split('/').pop() ?? p.url;
  const parts = await caches.open(PARTS_STORE);
  const kept = new Set((await parts.keys()).map((r) => r.url));
  const target = await caches.open(p.store);
  const dropParts = async () => {
    for (let i = 0; i < n; i++) await parts.delete(new Request(partKey(p.url, i, n))).catch(() => false);
  };
  for (let i = 0; i < n; i++) {
    const [a, b] = ranges[i]!;
    if (kept.has(partKey(p.url, i, n))) continue;
    if (signal?.aborted) throw stop();
    // Written before the part: if iOS closes Ghosty now, CONTINUE starts again at this part, not at the piece's start.
    onPart?.(i + 1, n, a);
    const res = await fetch(p.url, { signal, cache: 'no-store', headers: { range: `bytes=${a}-${b}` } });
    if (res.status === 200 && i === 0) {
      // (no parts from this server: the whole piece, stored as it comes, as before)
      await target.put(new Request(p.url), res);
      await dropParts();
      return;
    }
    if (res.status !== 206) {
      await res.body?.cancel().catch(() => undefined);
      throw res.ok ? new Error(`the server would not send part ${i + 1} of ${name} on its own`) : httpError(p.url, res.status);
    }
    const len = Number(res.headers.get('content-length'));
    if (res.headers.has('content-length') && len !== b - a + 1) {
      await res.body?.cancel().catch(() => undefined);
      throw new Error(`part ${i + 1} of ${name} came back the wrong size (${len} bytes, not ${b - a + 1})`);
    }
    // (the Cache API refuses a 206: the part's own bytes are kept as a whole response of their own, still as a stream)
    await parts.put(new Request(partKey(p.url, i, n)), new Response(res.body, { headers: { 'content-type': 'application/octet-stream', 'content-length': String(b - a + 1) } }));
  }
  // Every part is here: the whole piece, built from them as a stream (one part read at a time) into one entry.
  let i = 0;
  let got = 0;
  let broken = '';
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  const body = new ReadableStream<Uint8Array>({
    async pull(ctl) {
      for (;;) {
        if (!reader) {
          if (i >= n) {
            if (got !== p.bytes) throw new Error((broken = `${name} came to ${got} bytes from its parts, not ${p.bytes}`));
            ctl.close();
            return;
          }
          const r = await parts.match(new Request(partKey(p.url, i, n)));
          if (!r?.body) throw new Error((broken = `part ${i + 1} of ${name} went missing`));
          reader = r.body.getReader();
          i++;
        }
        const { done, value } = await reader.read();
        if (done) {
          reader = null;
          continue;
        }
        got += value.byteLength;
        ctl.enqueue(value);
        return;
      }
    },
    cancel() {
      void reader?.cancel().catch(() => undefined);
    },
  });
  try {
    await target.put(new Request(p.url), new Response(body, { headers: { 'content-type': 'application/octet-stream', 'content-length': String(p.bytes) } }));
  } catch (e) {
    // parts that do not add up are no use to a later CONTINUE: they go, and the piece is fetched again
    if (broken) {
      await dropParts();
      throw new Error(broken);
    }
    throw e;
  }
  await dropParts();
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
export async function fill(m: ModelDef, origin: string, onProgress?: (p: FillProgress) => void, signal?: AbortSignal, part: number = PART_BYTES): Promise<void> {
  if (typeof caches === 'undefined') throw new Error('This browser cannot keep a download (no Cache storage).');
  const base = modelBase(m);
  const have = new Map<string, Set<string>>();
  const config: Piece = { store: 'webllm/config', url: new URL('mlc-chat-config.json', base).href, bytes: 0 };
  const list: Piece = { store: 'webllm/model', url: new URL('tensor-cache.json', base).href, bytes: 0 };
  // The two small files first (the list of pieces is in the second); they count as pieces 1 and 2.
  const before = readLog();
  const resumed = before?.model === m.id ? before : null;
  writeLog({ model: m.id, piece: 1, of: resumed?.of ?? 0, bytes: resumed?.bytes ?? 0, at: Date.now() });
  await store(config, have, signal, part);
  writeLog({ model: m.id, piece: 2, of: resumed?.of ?? 0, bytes: resumed?.bytes ?? 0, at: Date.now() });
  await store(list, have, signal, part);
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
    if (i >= 2)
      await store(p, have, signal, part, (k, parts, done) => {
        writeLog({ model: m.id, piece: i + 1, of: pieces.length, bytes: bytes + done, at: Date.now(), part: k, parts });
        onProgress?.({ piece: i + 1, of: pieces.length, bytes: bytes + done, total, done: false, part: k, parts });
      });
    bytes += p.bytes;
  }
  onProgress?.({ piece: pieces.length, of: pieces.length, bytes, total, done: true });
  markStored(storedId(m), pieces.length);
  clearLog(m.id);
}

/**
 * What each brain has on this phone right now, counted in WebLLM's stores (the pieces `fill` would store: the config,
 * the list of pieces, the tokenizer, every shard and the compiled code): `have` of `of` (`of` 0 when its list of pieces
 * is not here), and the bytes of the shards here. Read once for all of them; nothing is fetched.
 */
export async function presence(models: ModelDef[], origin: string): Promise<Map<string, { have: number; of: number; bytes: number }>> {
  const out = new Map<string, { have: number; of: number; bytes: number }>();
  if (typeof caches === 'undefined') return out;
  try {
    const model = await caches.open('webllm/model');
    const config = await caches.open('webllm/config');
    const keys = new Set([...(await model.keys()), ...(await config.keys()), ...(await (await caches.open('webllm/wasm')).keys())].map((r) => r.url));
    for (const m of models) {
      const base = modelBase(m);
      const listUrl = new URL('tensor-cache.json', base).href;
      const cfgUrl = new URL('mlc-chat-config.json', base).href;
      const list = keys.has(listUrl) ? await model.match(new Request(listUrl)) : undefined;
      const records = list ? (((await list.json().catch(() => ({}))) as { records?: { dataPath: string; nbytes: number }[] }).records ?? []) : [];
      const cfg = keys.has(cfgUrl) ? await config.match(new Request(cfgUrl)) : undefined;
      const files = cfg ? (((await cfg.json().catch(() => ({}))) as { tokenizer_files?: string[] }).tokenizer_files ?? []) : null;
      const tok = files ? (files.includes('tokenizer.json') ? ['tokenizer.json'] : files.includes('tokenizer.model') ? ['tokenizer.model'] : []) : ['tokenizer.json', 'tokenizer.model'];
      const shards = records.map((r) => ({ url: new URL(r.dataPath, base).href, nbytes: r.nbytes }));
      const tokHere = tok.filter((t) => keys.has(new URL(t, base).href)).length;
      const have = (cfg ? 1 : 0) + (list ? 1 : 0) + tokHere + shards.filter((x) => keys.has(x.url)).length + (keys.has(libUrl(m, origin)) ? 1 : 0);
      // (with no list here, the pieces under its address are all that can be counted)
      const loose = list ? 0 : [...keys].filter((k) => k.startsWith(base) && k !== cfgUrl && !tok.some((t) => k === new URL(t, base).href)).length;
      const of = list ? 2 + (files ? tok.length : 1) + shards.length + 1 : 0;
      out.set(m.id, { have: have + loose, of, bytes: shards.filter((x) => keys.has(x.url)).reduce((a, x) => a + x.nbytes, 0) });
    }
  } catch {
    /* the cache could not be read: nothing counted */
  }
  return out;
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
