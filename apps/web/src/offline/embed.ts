/**
 * SEARCH BY MEANING's model on the phone: snowflake-arctic-embed-s (offline/models.ts EMBED_MODEL, about 70 MB),
 * run by the same vendored WebLLM as the offline brain but in a worker of its own (public/vendor/webllm/worker.mjs,
 * 'embed'), so the two never get in each other's way. It turns a passage or a question into 384 numbers; the
 * library copy on the phone keeps one list per passage (library/local.ts) and ranks passages by them
 * (library/meaning.ts). Free and private: the texts and their numbers never leave the phone.
 *
 * Like the brain, nothing is downloaded until the owner asks (SETTINGS → OFFLINE BRAIN → Search by meaning), with
 * its size said and on Wi-Fi; the files stay in the browser's cache (WebLLM's `webllm/*` stores). It leaves memory
 * a minute after it was last used (the camera, the namer and the brain need the room).
 *
 * Tests (no WebGPU in CI) set `window.__ghostyEmbedder = { embed(texts, kind) }` returning one list of numbers per
 * text, with optional `ready` (false: not downloaded yet), `load()`, `unload()` and `idleMs`.
 */
import { createStore } from '../core/store';
import { normalise } from '../../../../packages/shared/src/meaning';
import { EMBED_MODEL, QUERY_PREFIX, WORKER_REV, modelBase } from './models';

const VENDOR = '/vendor/webllm';
const IDLE_UNLOAD_MS = 60_000;
/** Longest text read (the model reads at most 512 word-pieces: about 2,000 letters of English, fewer of code). */
const MAX_CHARS = 1600;

/** What the settings line shows. `downloaded` is kept on this phone. */
export const embedState = createStore(
  { downloaded: false, loaded: false, busy: '' as '' | 'download' | 'load', progress: 0, text: '' },
  { persist: 'ghosty.meaning', keys: ['downloaded'] },
);

interface TestEmbedder {
  ready?: boolean;
  load?(): Promise<unknown> | unknown;
  unload?(): void;
  idleMs?: number;
  embed(texts: string[], kind: 'query' | 'passage'): ArrayLike<number>[] | Promise<ArrayLike<number>[]>;
}
const testEmbedder = (): TestEmbedder | null => {
  const e = (globalThis as { __ghostyEmbedder?: TestEmbedder }).__ghostyEmbedder;
  return e && typeof e.embed === 'function' ? e : null;
};

/** The model's files: its weights and settings (Hugging Face, pinned) and its compiled code (this site). */
export const embedBase = (): string => modelBase(EMBED_MODEL);
const libUrl = () => new URL(`${VENDOR}/libs/${EMBED_MODEL.lib}`, globalThis.location?.origin ?? 'https://ghosty.invalid').href;
/** A cached file that belongs to the meaning model (the brain's clean-ups leave these alone). */
export const isEmbedFile = (url: string): boolean => url.startsWith(embedBase()) || url === libUrl();

type GpuAdapter = { features: { has(f: string): boolean } };
type Gpu = { requestAdapter(o?: { powerPreference?: string }): Promise<GpuAdapter | null> };
let support: Promise<{ ok: boolean; reason: string }> | null = null;
/** Whether this phone can run it, and if not, why in plain words (it needs WebGPU, but not the 16-bit maths). */
export function embedSupport(): Promise<{ ok: boolean; reason: string }> {
  if (testEmbedder()) return Promise.resolve({ ok: true, reason: 'test embedder' });
  support ??= (async () => {
    const gpu = (navigator as unknown as { gpu?: Gpu }).gpu;
    if (!gpu) return { ok: false, reason: 'Search by meaning needs WebGPU: on iPhone, iOS 26 or newer. Searches use keywords.' };
    if (typeof caches === 'undefined' || typeof Worker === 'undefined') return { ok: false, reason: 'This browser cannot keep the download (no Cache storage or workers). Searches use keywords.' };
    const adapter = await gpu.requestAdapter().catch(() => null);
    if (!adapter) return { ok: false, reason: "WebGPU is here but this device's graphics chip isn't available to it. Searches use keywords." };
    return { ok: true, reason: 'WebGPU ready' };
  })();
  return support;
}

let checkedAt = 0;
/** The model is on this phone: every file it needs is in the browser's cache. */
export async function embedReady(): Promise<boolean> {
  const t = testEmbedder();
  if (t) return t.ready !== false;
  if (!embedState.get().downloaded || typeof caches === 'undefined') return false;
  if (Date.now() - checkedAt < 10 * 60_000) return true;
  try {
    const base = embedBase();
    const cache = await caches.open('webllm/model');
    const list = await cache.match(new Request(`${base}tensor-cache.json`));
    if (!list) return false;
    const records = ((await list.json()) as { records?: { dataPath: string }[] }).records ?? [];
    const keys = new Set((await cache.keys()).map((r) => r.url));
    const ok = records.length > 0 && records.every((r) => keys.has(new URL(r.dataPath, base).href));
    if (!ok) embedState.set({ downloaded: false });
    checkedAt = ok ? Date.now() : 0;
    return ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------------------
// The worker (its own: the brain's worker holds the brain)
// ---------------------------------------------------------------------------------------

type WorkerEvent = { id: number; t: 'progress' | 'done' | 'error'; progress?: number; text?: string; message?: string; vectors?: number[][] };
let worker: Worker | null = null;
let seq = 0;
const calls = new Map<number, { on?: (e: WorkerEvent) => void; resolve: (e: WorkerEvent) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(`${VENDOR}/worker.mjs?v=${WORKER_REV}`, { type: 'module' });
  w.onmessage = (ev: MessageEvent<WorkerEvent>) => {
    const m = ev.data;
    const c = calls.get(m.id);
    if (!c) return;
    if (m.t === 'done') {
      calls.delete(m.id);
      c.resolve(m);
    } else if (m.t === 'error') {
      calls.delete(m.id);
      c.reject(new Error(m.message ?? 'search by meaning failed'));
    } else c.on?.(m);
  };
  w.onerror = (ev) => {
    ev.preventDefault();
    for (const c of calls.values()) c.reject(new Error(ev.message || 'search by meaning stopped'));
    calls.clear();
    dropWorker();
  };
  worker = w;
  return w;
}

function call(op: string, payload: Record<string, unknown> = {}, on?: (e: WorkerEvent) => void): Promise<WorkerEvent> {
  const id = ++seq;
  const w = getWorker();
  return new Promise((resolve, reject) => {
    calls.set(id, { on, resolve, reject });
    w.postMessage({ id, op, ...payload });
  });
}

function dropWorker(): void {
  worker?.terminate();
  worker = null;
  loading = null;
  embedState.set({ loaded: false });
}

const appConfig = () => ({
  model_list: [
    {
      model: modelBase(EMBED_MODEL),
      model_id: EMBED_MODEL.id,
      model_lib: libUrl(),
      vram_required_MB: EMBED_MODEL.vram,
      low_resource_required: true,
      // WebLLM's ModelType.embedding
      model_type: 1,
    },
  ],
});

let loading: Promise<void> | null = null;
/** Into memory; only `download` may fetch it from the internet (otherwise every file must already be here). */
function load(onProgress?: (frac: number, text: string) => void, download = false): Promise<void> {
  if (embedState.get().loaded && worker) return Promise.resolve();
  loading ??= (async () => {
    if (!download && !(await embedReady())) throw new Error("Search by meaning isn't on this phone: Settings → Offline brain → ADD (on Wi-Fi).");
    embedState.set({ busy: embedState.get().downloaded ? 'load' : 'download', progress: 0, text: '' });
    try {
      await call('load', { model: EMBED_MODEL.id, appConfig: appConfig() }, (e) => {
        const frac = Math.max(0, Math.min(1, e.progress ?? 0));
        embedState.set({ progress: frac, text: e.text ?? '' });
        onProgress?.(frac, e.text ?? '');
      });
      embedState.set({ downloaded: true, loaded: true });
    } catch (e) {
      dropWorker();
      throw e;
    } finally {
      embedState.set({ busy: '' });
      loading = null;
    }
  })();
  return loading;
}

let idle: ReturnType<typeof setTimeout> | undefined;
function armIdle(): void {
  clearTimeout(idle);
  const t = testEmbedder();
  idle = setTimeout(() => freeEmbedder(), t?.idleMs ?? IDLE_UNLOAD_MS);
}

/** Out of memory now (the download stays). */
export function freeEmbedder(): void {
  clearTimeout(idle);
  const t = testEmbedder();
  if (t) {
    if (embedState.get().loaded) t.unload?.();
    embedState.set({ loaded: false });
    return;
  }
  dropWorker();
}

/** It is in memory right now (so a question's vector costs nothing to wait for). */
export const embedderWarm = (): boolean => embedState.get().loaded;

/** The phone is on mobile data (only where the browser says so: Safari does not, so the words ask for Wi-Fi). */
const onMobileData = (): boolean => {
  const c = (navigator as unknown as { connection?: { type?: string; saveData?: boolean } }).connection;
  return c?.type === 'cellular' || c?.saveData === true;
};

/** Download it (about 70 MB, once, on Wi-Fi), when the owner asks. It stays in memory for the index to start. */
export async function downloadEmbedder(onProgress?: (frac: number, text: string) => void): Promise<void> {
  if (onMobileData()) throw new Error('This phone is on mobile data: Search by meaning downloads on Wi-Fi only (about 70 MB).');
  const t = testEmbedder();
  if (t) {
    t.ready = true;
    await t.load?.();
    embedState.set({ downloaded: true, loaded: true });
    onProgress?.(1, 'done');
    armIdle();
    return;
  }
  const s = await embedSupport();
  if (!s.ok) throw new Error(s.reason);
  try {
    await load(onProgress, true);
  } catch (e) {
    throw new Error(`The download stopped (${String((e as Error)?.message ?? e).slice(0, 120)}). ADD again on Wi-Fi carries on from where it stopped.`);
  }
  armIdle();
}

/** Remove it from this phone (its files only: the brain's stay). */
export async function deleteEmbedder(): Promise<void> {
  checkedAt = 0;
  const t = testEmbedder();
  if (t) t.ready = false;
  freeEmbedder();
  if (typeof caches !== 'undefined') {
    for (const name of ['webllm/model', 'webllm/config', 'webllm/wasm']) {
      try {
        const c = await caches.open(name);
        for (const r of await c.keys()) if (isEmbedFile(r.url)) await c.delete(r);
      } catch {
        /* no cache storage */
      }
    }
  }
  embedState.set({ downloaded: false, loaded: false, progress: 0, text: '' });
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);

/**
 * The vectors (length 1) for some texts: `query` for a question (the model's own prefix goes first), `passage` for
 * the library's text. Loads the model if it is here and not in memory; never downloads it. A text too long for the
 * model is read again shorter.
 */
export async function embedTexts(texts: string[], kind: 'query' | 'passage'): Promise<Float32Array[]> {
  if (!texts.length) return [];
  const input = texts.map((x) => clip(`${kind === 'query' ? QUERY_PREFIX : ''}${x.replace(/\s+/g, ' ').trim() || '.'}`, MAX_CHARS));
  const t = testEmbedder();
  if (t) {
    if (t.ready === false) throw new Error("Search by meaning isn't on this phone.");
    if (!embedState.get().loaded) {
      await t.load?.();
      embedState.set({ loaded: true });
    }
    try {
      return (await t.embed(input, kind)).map((v) => normalise(v));
    } finally {
      armIdle();
    }
  }
  await load();
  clearTimeout(idle);
  try {
    try {
      return ((await call('embed', { input })).vectors ?? []).map((v) => normalise(v));
    } catch (e) {
      if (!/context window|exceed/i.test(String((e as Error)?.message ?? e))) throw e;
      // One of them is longer than the model reads (dense code, long numbers): each on its own, shorter until it fits.
      const out: Float32Array[] = [];
      for (const one of input) {
        let s = one;
        for (let tries = 0; ; tries++) {
          try {
            out.push(normalise(((await call('embed', { input: [s] })).vectors ?? [])[0] ?? []));
            break;
          } catch (err) {
            if (tries >= 3 || !/context window|exceed/i.test(String((err as Error)?.message ?? err))) throw err;
            s = s.slice(0, Math.floor(s.length / 2));
          }
        }
      }
      return out;
    }
  } finally {
    armIdle();
  }
}

