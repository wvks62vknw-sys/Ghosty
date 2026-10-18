/**
 * The offline brain: a small language model that runs on the phone itself (WebLLM on WebGPU),
 * so Ghosty can still talk when the brain can't be reached, when every free model is busy, or
 * whenever the owner switches it to "always". Free and private: nothing leaves the phone.
 *
 * Nothing is downloaded until the owner presses DOWNLOAD (SETTINGS → OFFLINE BRAIN): a chat
 * message never starts the ~352 MB download (it may be on mobile data). The runtime and the model
 * live in a Web Worker (public/vendor/webllm/worker.mjs), so the page never parses the 6 MB
 * runtime; the weights come from Hugging Face once, at the commit pinned in offline/models.ts, and
 * stay in the browser's Cache API; the model's compiled code is served from this site
 * (vendor/webllm/libs). Phone memory is tight: the model leaves memory (the worker ends) as soon as
 * a download finishes and two minutes after it last answered; the download stays.
 *
 * Tests (no WebGPU in CI) set `window.__ghostyOfflineEngine = { chat(messages, onToken) }`, with
 * optional `load()` (stands in for loading the model), `unload()` and `idleMs`.
 */
import { agendaWithOutbox, factsWithOutbox, offline } from '../api/offline';
import { createStore } from '../core/store';
import { searchLocal } from '../library/local';
import { settings } from '../state/app';
import { MODELS, modelBase, type ModelDef } from './models';
import { buildOfflinePrompt, cleanReply, type OfflineMsg } from './prompt';

export type { OfflineMsg } from './prompt';

const VENDOR = '/vendor/webllm';
/** WebLLM's own Cache API stores (weights + tokenizer, chat config, compiled model code). */
const WEBLLM_CACHES = ['webllm/model', 'webllm/config', 'webllm/wasm'];
const IDLE_UNLOAD_MS = 2 * 60_000;

/** What the settings panel shows. `model` and `downloaded` are kept on this device. */
export const offlineBrain = createStore(
  { model: MODELS[0]!.id, downloaded: false, loaded: false, busy: '' as '' | 'download' | 'load' | 'reply', progress: 0, text: '', thinkSecs: 55 },
  { persist: 'ghosty.offlinebrain', keys: ['model', 'downloaded', 'thinkSecs'] },
);

/** The test engine, when a browser test put one there. */
interface TestEngine {
  ready?: boolean;
  /** Stands in for loading the model into memory (a reply waits for it). */
  load?(): Promise<unknown> | unknown;
  /** Told when the model leaves memory. */
  unload?(): void;
  /** How long after the last use the model leaves memory (instead of two minutes). */
  idleMs?: number;
  /** `opts`: THINK HARDER's temperature and length for this reply (absent: the chat's own). */
  chat(messages: OfflineMsg[], onToken: (t: string) => void, signal?: AbortSignal, opts?: ReplyOpts): Promise<unknown> | unknown;
}
const testEngine = (): TestEngine | null => {
  const e = (globalThis as { __ghostyOfflineEngine?: TestEngine }).__ghostyOfflineEngine;
  return e && typeof e.chat === 'function' ? e : null;
};

export const currentModel = (): ModelDef => MODELS.find((m) => m.id === offlineBrain.get().model) ?? MODELS[0]!;

// ---------------------------------------------------------------------------------------
// Can this phone run it?
// ---------------------------------------------------------------------------------------

type GpuAdapter = { features: { has(f: string): boolean } };
type Gpu = { requestAdapter(o?: { powerPreference?: string }): Promise<GpuAdapter | null> };

let support: Promise<{ ok: boolean; reason: string }> | null = null;
/** Whether this device can run the offline brain, and if not, why in plain words. */
export function offlineSupport(): Promise<{ ok: boolean; reason: string }> {
  if (testEngine()) return Promise.resolve({ ok: true, reason: 'test engine' });
  support ??= (async () => {
    const gpu = (navigator as unknown as { gpu?: Gpu }).gpu;
    if (!gpu) return { ok: false, reason: 'This browser has no WebGPU. On iPhone the offline brain needs iOS 26 or newer.' };
    if (typeof caches === 'undefined' || typeof Worker === 'undefined') return { ok: false, reason: 'This browser cannot keep a download (no Cache storage or workers).' };
    const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' }).catch(() => null);
    if (!adapter) return { ok: false, reason: "WebGPU is here but this device's graphics chip isn't available to it." };
    if (!adapter.features.has('shader-f16')) return { ok: false, reason: "This device's graphics chip lacks the 16-bit maths (shader-f16) the small model needs." };
    return { ok: true, reason: 'WebGPU ready' };
  })();
  return support;
}

/** When the cache was last seen whole: every chat message asks, and reading the weight list each time is waste. */
let checkedAt = 0;
/** The model is on this phone (all of its files are in the browser's cache). */
export async function offlineReady(): Promise<boolean> {
  const t = testEngine();
  if (t) return t.ready !== false;
  if (!offlineBrain.get().downloaded || typeof caches === 'undefined') return false;
  if (Date.now() - checkedAt < 10 * 60_000) return true;
  try {
    // WebLLM's own check, done here without loading WebLLM: the weight list and every shard it names.
    const base = modelBase(currentModel());
    const cache = await caches.open('webllm/model');
    const list = await cache.match(new Request(`${base}tensor-cache.json`));
    if (!list) return false;
    const records = ((await list.json()) as { records?: { dataPath: string }[] }).records ?? [];
    const keys = new Set((await cache.keys()).map((r) => r.url));
    const ok = records.length > 0 && records.every((r) => keys.has(new URL(r.dataPath, base).href));
    if (!ok) offlineBrain.set({ downloaded: false });
    checkedAt = ok ? Date.now() : 0;
    return ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------------------
// The worker
// ---------------------------------------------------------------------------------------

type WorkerEvent = { id: number; t: 'progress' | 'token' | 'done' | 'error'; progress?: number; text?: string; message?: string; usage?: { tokens?: number; perSecond?: number } | null };
let worker: Worker | null = null;
let seq = 0;
const calls = new Map<number, { on?: (e: WorkerEvent) => void; resolve: (e: WorkerEvent) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(`${VENDOR}/worker.mjs`, { type: 'module' });
  w.onmessage = (ev: MessageEvent<WorkerEvent>) => {
    const m = ev.data;
    const c = calls.get(m.id);
    if (!c) return;
    if (m.t === 'done') {
      calls.delete(m.id);
      c.resolve(m);
    } else if (m.t === 'error') {
      calls.delete(m.id);
      c.reject(new Error(m.message ?? 'the offline brain failed'));
    } else c.on?.(m);
  };
  w.onerror = (ev) => {
    ev.preventDefault();
    for (const c of calls.values()) c.reject(new Error(ev.message || 'the offline brain stopped'));
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
  offlineBrain.set({ loaded: false });
}

const appConfig = () => ({
  model_list: MODELS.map((m) => ({
    // Pinned to one commit (offline/models.ts): WebLLM keeps a URL that names its revision.
    model: modelBase(m),
    model_id: m.id,
    // The model's compiled code comes from this site, not GitHub: same version, no third party.
    model_lib: new URL(`${VENDOR}/libs/${m.lib}`, location.origin).href,
    vram_required_MB: m.vram,
    low_resource_required: true,
    required_features: ['shader-f16'],
    // A shorter memory than the model allows: our prompts are short and a phone's memory is tight.
    overrides: { context_window_size: 2048 },
  })),
});

const notHere = () => new Error("The offline brain isn't on this phone yet: Settings → Offline brain → DOWNLOAD (on Wi-Fi).");
const stopped = () => Object.assign(new Error('stopped'), { name: 'AbortError' });

let loading: Promise<void> | null = null;
/**
 * Load the model into memory; `onProgress` gets 0–1 and WebLLM's own words. Only DOWNLOAD
 * (`download` true) may fetch it from the internet: otherwise every file must already be here.
 */
function load(onProgress?: (frac: number, text: string) => void, download = false): Promise<void> {
  if (offlineBrain.get().loaded && worker) return Promise.resolve();
  loading ??= (async () => {
    if (!download && !(await offlineReady())) throw notHere();
    const model = currentModel();
    offlineBrain.set({ busy: offlineBrain.get().downloaded ? 'load' : 'download', progress: 0, text: '' });
    try {
      await call('load', { model: model.id, appConfig: appConfig() }, (e) => {
        const frac = Math.max(0, Math.min(1, e.progress ?? 0));
        offlineBrain.set({ progress: frac, text: e.text ?? '' });
        onProgress?.(frac, e.text ?? '');
      });
      offlineBrain.set({ downloaded: true, loaded: true });
      armIdle();
    } catch (e) {
      dropWorker(); // a worker that could not load holds nothing worth keeping
      throw e;
    } finally {
      offlineBrain.set({ busy: '' });
      loading = null;
    }
  })();
  return loading;
}

/** The phone ran out of memory or lost its graphics device: worth trying the smaller model. */
const tooBig = (e: unknown) => /memory|device (?:was )?lost|allocat|exceed|out of|OOM|buffer size/i.test(String((e as Error)?.message ?? e));

/** Download the model for use with no connection (≈352 MB, once). Falls back to the smaller model if the phone can't hold the first. */
export async function downloadOffline(onProgress?: (frac: number, text: string) => void): Promise<void> {
  const t = testEngine();
  if (t) {
    t.ready = true;
    offlineBrain.set({ downloaded: true, loaded: true });
    onProgress?.(1, 'done');
    freeModel();
    return;
  }
  const s = await offlineSupport();
  if (!s.ok) throw new Error(s.reason);
  try {
    await load(onProgress, true);
  } catch (e) {
    if (currentModel().id !== MODELS[1]!.id && tooBig(e)) {
      dropWorker();
      await clearCaches();
      offlineBrain.set({ model: MODELS[1]!.id, downloaded: false });
      onProgress?.(0, 'Too big for this phone: getting the smaller model instead');
      await load(onProgress, true);
    } else throw e;
  }
  // Downloaded is all that was asked: the model leaves memory until it is needed (the camera, the
  // namer and the reader need the room), and files from an older pinned revision go.
  freeModel();
  await pruneOtherRevisions();
}

/** Remove cached model files that are not the current model's pinned revision (an older download). */
async function pruneOtherRevisions(): Promise<void> {
  if (typeof caches === 'undefined') return;
  const keep = modelBase(currentModel());
  for (const name of ['webllm/model', 'webllm/config']) {
    try {
      const c = await caches.open(name);
      for (const r of await c.keys()) if (r.url.startsWith('https://huggingface.co/') && !r.url.startsWith(keep)) await c.delete(r);
    } catch {
      /* no cache storage */
    }
  }
}

/** Free the model's memory now (the download stays). */
function freeModel(): void {
  clearTimeout(idle);
  testEngine()?.unload?.();
  dropWorker();
}

let idle: ReturnType<typeof setTimeout> | undefined;
/** The model leaves memory a while after it was last used (sooner than the phone would kill the page for it). */
function armIdle(): void {
  clearTimeout(idle);
  const t = testEngine();
  if (!worker && !t) return;
  idle = setTimeout(() => (offlineBrain.get().busy ? armIdle() : freeModel()), t?.idleMs ?? IDLE_UNLOAD_MS);
}

async function clearCaches(): Promise<void> {
  if (typeof caches === 'undefined') return;
  await Promise.all(WEBLLM_CACHES.map((c) => caches.delete(c).catch(() => false)));
}

/** Remove the model from this phone (and the runtime's copy kept by the app's own cache). */
export async function deleteOffline(): Promise<void> {
  checkedAt = 0;
  const t = testEngine();
  if (t) t.ready = false;
  dropWorker();
  await clearCaches();
  try {
    // The service worker keeps vendored files; WebLLM's ~16 MB is only worth keeping with a model.
    const c = await caches.open('ghosty-vendor-v1');
    for (const r of await c.keys()) if (new URL(r.url).pathname.startsWith(`${VENDOR}/`)) await c.delete(r);
  } catch {
    /* no cache storage */
  }
  offlineBrain.set({ downloaded: false, loaded: false, model: MODELS[0]!.id, progress: 0, text: '' });
}

/** How one reply is written: how adventurous (temperature, 0–1.5) and how long at most (tokens). */
export interface ReplyOpts {
  temperature?: number;
  max?: number;
}

let replying: AbortController | null = null;
/**
 * Stream a reply from the model on this phone. `onToken` gets each piece as it comes (raw;
 * the result's `text` is cleaned). Resolves with the speed the model managed. `opts`: THINK
 * HARDER's own temperature and length (offline/think.ts); the chat leaves them out.
 */
export async function offlineReply(messages: OfflineMsg[], onToken: (t: string) => void, signal?: AbortSignal, opts: ReplyOpts = {}): Promise<{ text: string; tokens: number; perSecond: number }> {
  const started = performance.now();
  let raw = '';
  let count = 0;
  const on = (t: string) => {
    raw += t;
    count++;
    onToken(t);
  };
  const t = testEngine();
  if (t) {
    if (t.ready === false) throw notHere();
    await t.load?.();
  } else await load();
  // A "stop" while the model was loading: an abort that already happened never fires again for a
  // listener added now, so it is checked here, and no reply is written at all.
  if (signal?.aborted) throw stopped();
  try {
    if (t) {
      const r = await t.chat(messages, on, signal, opts);
      if (signal?.aborted) throw stopped();
      if (!raw && typeof r === 'string') raw = r;
      const secs = (performance.now() - started) / 1000;
      return { text: cleanReply(raw).trim(), tokens: count, perSecond: secs > 0 ? count / secs : 0 };
    }
    offlineBrain.set({ busy: 'reply' });
    const stop = () => void call('stop').catch(() => undefined);
    signal?.addEventListener('abort', stop, { once: true });
    try {
      const done = await call('chat', { messages, max: Math.max(8, Math.min(800, Math.round(opts.max ?? 400))), ...(typeof opts.temperature === 'number' ? { temperature: Math.max(0, Math.min(1.5, opts.temperature)) } : {}) }, (e) => {
        if (e.t === 'token' && e.text) on(e.text);
      });
      if (signal?.aborted) throw stopped();
      const secs = (performance.now() - started) / 1000;
      const tokens = done.usage?.tokens ?? count;
      return { text: cleanReply(raw).trim(), tokens, perSecond: done.usage?.perSecond ?? (secs > 0 ? tokens / secs : 0) };
    } finally {
      signal?.removeEventListener('abort', stop);
      offlineBrain.set({ busy: '' });
    }
  } finally {
    armIdle();
  }
}

/** Stop the reply being written on the phone (the owner said "stop"). */
export function stopOffline(): void {
  replying?.abort();
  replying = null;
}

// ---------------------------------------------------------------------------------------
// A chat turn answered here
// ---------------------------------------------------------------------------------------

const hm = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** Today's and tomorrow's agenda from the copy on this phone, one short line each. */
function agendaLines(now = Date.now()): string[] {
  const a = offline.get().agenda;
  if (!a) return [];
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  const today = day.getTime();
  const end = today + 2 * 86_400_000;
  const when = (t: number) => `${t < today + 86_400_000 ? 'today' : 'tomorrow'} ${hm(t)}`;
  const { events, jobs } = agendaWithOutbox(a);
  return [
    ...events.filter((e) => (e.end ?? e.start) >= now - 3600_000 && e.start < end).map((e) => `${e.allDay ? (e.start < today + 86_400_000 ? 'today' : 'tomorrow') : when(e.start)}: ${e.title}${e.location ? ` at ${e.location}` : ''}`),
    ...jobs.filter((j) => j.kind === 'reminder' && j.next >= now && j.next < end).map((j) => `${when(j.next)}: reminder "${j.text}"`),
  ];
}

/** Answer one message on this phone: the prompt (persona, memory, agenda, library, recent turns) and the streamed reply. */
export async function answerOffline(question: string, recent: { role: 'user' | 'assistant'; text: string }[], onToken: (t: string) => void): Promise<{ text: string; tokens: number; perSecond: number }> {
  // Made before the first wait, so a "stop" while the library is searched counts too.
  const ctl = new AbortController();
  replying = ctl;
  try {
    return await answerWith(ctl.signal, question, recent, onToken);
  } finally {
    if (replying === ctl) replying = null;
  }
}

async function answerWith(signal: AbortSignal, question: string, recent: { role: 'user' | 'assistant'; text: string }[], onToken: (t: string) => void): Promise<{ text: string; tokens: number; perSecond: number }> {
  const hits = await searchLocal(question, 3).catch(() => []);
  if (signal.aborted) throw stopped();
  const now = new Date().toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const messages = buildOfflinePrompt({
    name: settings.get().name,
    now,
    facts: factsWithOutbox(offline.get().memory ?? []).map((f) => f.text),
    agenda: agendaLines(),
    passages: hits.map((h) => ({ title: h.title, text: h.text })),
    recent,
    question,
    persona: settings.get().persona,
  });
  return offlineReply(messages, onToken, signal);
}

/** The size of the model being used, for the settings panel. */
export const offlineSize = (): number => currentModel().mb;
