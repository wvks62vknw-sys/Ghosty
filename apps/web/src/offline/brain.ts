/**
 * The offline brain: a small language model that runs on the phone itself (WebLLM on WebGPU),
 * so Ghosty can still talk when the brain can't be reached, when every free model is busy, or
 * whenever the owner switches it to "always". Free and private: nothing leaves the phone.
 *
 * Nothing is downloaded until the owner presses DOWNLOAD or GET (SETTINGS → OFFLINE BRAIN): a chat
 * message never starts the ~352 MB download (it may be on mobile data). The runtime and the model
 * live in a Web Worker (public/vendor/webllm/worker.mjs), so the page never parses the 6 MB
 * runtime; the weights come from Hugging Face once, at the commit pinned in offline/models.ts, and
 * stay in the browser's Cache API; the model's compiled code is served from this site
 * (vendor/webllm/libs). Phone memory is tight: the model leaves memory (the worker ends) two minutes
 * after it last answered; the download stays.
 *
 * Downloading and loading are two steps (24 Oct, after the Qwen3.5 2B closed Ghosty on the owner's 18 Pro Max): GET and
 * DOWNLOAD only put the files into WebLLM's cache, one piece at a time, with nothing in graphics memory (offline/fill.ts);
 * a brain goes into graphics memory only when it is used (USE, TEST, a reply). Before a bigger brain loads, the phone's
 * WebGPU limits are checked against it (models.ts limitsProblem), the brain and the meaning model leave memory, and
 * `{ loading, at }` goes to localStorage; if iOS closes Ghosty during the load, the next open finds it, marks that brain
 * "closed Ghosty on this phone", goes back to the 0.6B, and never loads it again without the owner's yes (USE asks).
 *
 * Tests (no WebGPU in CI) set `window.__ghostyOfflineEngine = { chat(messages, onToken) }`, with
 * optional `load()` (stands in for loading the model), `unload()`, `idleMs` and `files` (true: GET and DOWNLOAD
 * really fill the Cache API, from the spec's stand-in files).
 */
import { agendaWithOutbox, factsWithOutbox, offline } from '../api/offline';
import { createStore } from '../core/store';
import { searchLocalHow } from '../library/local';
import { embedState, freeEmbedder, isEmbedFile } from './embed';
import { clearLog, fill, filled, markStored, PARTS_STORE, pieceLine, presence, readLog, readStored, STORED_KEY, storedId, writeLog } from './fill';
import { settings } from '../state/app';
import { checkStorage, storageState } from '../features/system/storage';
import { DEFAULT_BASE, type BaseId } from '../../../../packages/shared/src/selftrain';
import { BIGGER, brainModels, brainOf, downloadFailure, goneLine, isBigger, limitsProblem, MODELS, modelBase, PART_BYTES, PICKER, roomProblem, sizeText, slotOf, stockOf, WORKER_REV, type GpuLimits, type Held, type Kept, type ModelDef, type TrainedModel } from './models';
import { modelJob, withModel } from './lock';
import { buildOfflinePrompt, cleanReply, cleanTranslation, translatePrompt, type OfflineMsg } from './prompt';

export type { OfflineMsg } from './prompt';
export { modelJob, withModel, type ModelJob } from './lock';

const VENDOR = '/vendor/webllm';
/** WebLLM's own Cache API stores (weights + tokenizer, chat config, compiled model code). */
const WEBLLM_CACHES = ['webllm/model', 'webllm/config', 'webllm/wasm'];
const IDLE_UNLOAD_MS = 2 * 60_000;

/**
 * What the settings panel shows. `model` and `downloaded` are kept on this device, and so are `trained` (the
 * models the weekly self-training published, from the brain) and `active` (the one the brain recommends), so
 * a trained model still loads with no connection. `have`: the brains whose download finished here (the picker's
 * ON THIS PHONE; each is checked against the cache before it is trusted); `fellBack`: what to tell the owner when a
 * bigger brain could not get the memory it needed and the 0.6B took over; `trainBase`: the base the weekly training
 * last said it follows, and `pendingBase` one chosen here that has not reached the brain yet (offline/trained.ts).
 */
export const offlineBrain = createStore(
  {
    model: MODELS[0]!.id,
    downloaded: false,
    loaded: false,
    busy: '' as '' | 'download' | 'load' | 'reply',
    progress: 0,
    text: '',
    trained: [] as TrainedModel[],
    active: null as string | null,
    weights: null as string | null,
    thinkSecs: 55,
    have: [] as string[],
    fellBack: '',
    trainBase: DEFAULT_BASE as BaseId,
    pendingBase: null as BaseId | null,
    /** What happened when each brain was loaded on this phone (models.ts Held, by picker row): the "can hold" line. */
    held: {} as Record<string, Held>,
    /** The brain whose files GET is fetching now ('' when none). */
    getting: '',
    /** The legacy check below has run once on this phone. */
    guarded: false,
  },
  { persist: 'ghosty.offlinebrain', keys: ['model', 'downloaded', 'trained', 'active', 'weights', 'thinkSecs', 'have', 'fellBack', 'trainBase', 'pendingBase', 'held', 'guarded'] },
);

/** Every model this phone can use: the trained ones, the stock Qwen3 and Qwen2.5, and the bigger brains (offline/models.ts). */
export const offlineModels = (): ModelDef[] => brainModels(offlineBrain.get().trained ?? [], globalThis.location?.origin ?? '', offlineBrain.get().weights ?? null);

/**
 * The brain's list of trained brains, the recommended one (`active`) and this phone's weight address. Nothing is
 * downloaded here. When this phone uses a trained brain and the brain's choice changed (a ROLLBACK, or the one in
 * use was dropped), the phone follows: to the new choice, or back to the stock Qwen3 — and says so (the returned
 * line, for a toast; '' when nothing changed). A phone on the stock model is only offered a new week (SETTINGS).
 */
export function setTrainedModels(trained: TrainedModel[], active: string | null, weights: string | null = offlineBrain.get().weights, base?: BaseId): string {
  const was = offlineBrain.get();
  offlineBrain.set({ trained: trained.map(({ week, label, repo, commit, base: b }) => ({ week, label, repo, commit, ...(b ? { base: b } : {}) })), active, weights, ...(base ? { trainBase: base } : {}) });
  const list = offlineModels();
  const usingTrained = !PICKER.concat(MODELS).some((m) => m.id === was.model);
  if (!usingTrained) return '';
  const stillThere = list.some((m) => m.id === was.model);
  if (stillThere && was.active === active) return '';
  // (the brain's choice, or the stock build of the base it trains: a ROLLBACK past a base switch goes back to the old one)
  const to = (active && list.find((m) => m.rev === active)) || stockOf(base ?? brainOf(currentModel()));
  if (to.id === was.model) return '';
  offlineBrain.set({ model: to.id, downloaded: false, loaded: false });
  checkedAt = 0;
  return `Ghosty changed the offline brain to ${to.label}${active ? '' : ' (the stock one)'}: press DOWNLOAD in SETTINGS → OFFLINE BRAIN, on Wi-Fi.`;
}

/** The test engine, when a browser test put one there. */
interface TestEngine {
  ready?: boolean;
  /** Stands in for loading the model into memory (a reply waits for it); told which model (a throw like the phone's "out of memory" tests the fallback). */
  load?(model?: string): Promise<unknown> | unknown;
  /** Told when the model leaves memory. */
  unload?(): void;
  /** How long after the last use the model leaves memory (instead of two minutes). */
  idleMs?: number;
  /** GET and DOWNLOAD really fill the Cache API (the spec serves stand-in files); else they only pretend. */
  files?: boolean;
  /** The size of a part when a piece is fetched in parts (instead of about 32 MB), so a spec's small pieces have parts. */
  part?: number;
  /** `opts`: THINK HARDER's temperature and length for this reply (absent: the chat's own). */
  chat(messages: OfflineMsg[], onToken: (t: string) => void, signal?: AbortSignal, opts?: ReplyOpts): Promise<unknown> | unknown;
}
const testEngine = (): TestEngine | null => {
  const e = (globalThis as { __ghostyOfflineEngine?: TestEngine }).__ghostyOfflineEngine;
  return e && typeof e.chat === 'function' ? e : null;
};

/** The brain a SCHOOL paper is being sat on when it is not the one in use (sitOn): never saved, so a close keeps his choice. */
let sitWith: string | null = null;
export const currentModel = (): ModelDef => (sitWith ? offlineModels().find((m) => m.id === sitWith) : undefined) ?? offlineModels().find((m) => m.id === offlineBrain.get().model) ?? MODELS[0]!;

/**
 * A SCHOOL paper is sat on this brain instead of the one in use (null: back to his). The model in memory leaves, so the
 * next load is the right one (school/sit.ts; SMALL-GAPS family G).
 */
export function sitOn(id: string | null): void {
  if (id === sitWith) return;
  freeModel();
  sitWith = id;
  checkedAt = 0;
}

/** The model leaves memory now, so the next use loads it afresh (a sitting whose brain failed mid-paper: school/sit.ts). */
export const unloadOffline = (): void => freeModel();

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

type GpuAdapterL = GpuAdapter & { limits?: Partial<Record<keyof GpuLimits, number>> };
let limitsAsked: Promise<{ limits: GpuLimits; f16: boolean } | null> | null = null;
/**
 * The phone's WebGPU limits, read from its adapter (no device is asked for, so nothing is allocated): null when there is
 * no WebGPU. What a page may use of the graphics memory itself is not among them: only loading tells.
 */
export function gpuLimits(): Promise<{ limits: GpuLimits; f16: boolean } | null> {
  limitsAsked ??= (async () => {
    const gpu = (navigator as unknown as { gpu?: { requestAdapter(o?: { powerPreference?: string }): Promise<GpuAdapterL | null> } }).gpu;
    const a = gpu ? await gpu.requestAdapter({ powerPreference: 'high-performance' }).catch(() => null) : null;
    if (!a?.limits) return null;
    const n = (k: keyof GpuLimits) => Number(a.limits?.[k] ?? 0);
    return {
      limits: { maxBufferSize: n('maxBufferSize'), maxStorageBufferBindingSize: n('maxStorageBufferBindingSize'), maxComputeWorkgroupStorageSize: n('maxComputeWorkgroupStorageSize'), maxStorageBuffersPerShaderStage: n('maxStorageBuffersPerShaderStage'), maxComputeInvocationsPerWorkgroup: n('maxComputeInvocationsPerWorkgroup') },
      f16: a.features.has('shader-f16'),
    };
  })();
  return limitsAsked;
}

/** Why this phone cannot run this brain, in plain words ('' when its graphics chip gives what it needs, or cannot be asked). */
export async function precheck(m: ModelDef): Promise<string> {
  const g = await gpuLimits();
  return g ? limitsProblem(m, g.limits, g.f16) : '';
}

/** When the cache was last seen whole: every chat message asks, and reading the weight list each time is waste. */
let checkedAt = 0;
/** The model is on this phone (all of its files are in the browser's cache). */
export async function offlineReady(): Promise<boolean> {
  const t = testEngine();
  // (a test engine with real files is ready when they are, as on the phone)
  if (t && !t.files) return t.ready !== false;
  if (!offlineBrain.get().downloaded || typeof caches === 'undefined') return false;
  if (Date.now() - checkedAt < 10 * 60_000) return true;
  const m = currentModel();
  const ok = await cachedWhole(m);
  if (!ok) offlineBrain.set({ downloaded: false });
  // (a brain downloaded before the picker existed counts as on this phone too, so a bigger download never prunes it)
  else if (!(offlineBrain.get().have ?? []).includes(m.id)) offlineBrain.set({ have: [...(offlineBrain.get().have ?? []), m.id] });
  checkedAt = ok ? Date.now() : 0;
  return ok;
}

/** Every file of this model is in the browser's cache: WebLLM's own check, done here without loading WebLLM (the weight list and every shard it names). */
async function cachedWhole(m: ModelDef): Promise<boolean> {
  const t = testEngine();
  if (t && !t.files) return true;
  if (typeof caches === 'undefined') return false;
  try {
    const base = modelBase(m);
    const cache = await caches.open('webllm/model');
    const list = await cache.match(new Request(`${base}tensor-cache.json`));
    if (!list) return false;
    const records = ((await list.json()) as { records?: { dataPath: string }[] }).records ?? [];
    const keys = new Set((await cache.keys()).map((r) => r.url));
    return records.length > 0 && records.every((r) => keys.has(new URL(r.dataPath, base).href));
  } catch {
    return false;
  }
}

/**
 * The picker's brains on this phone (their download finished, and their files are still all in the cache). With the
 * test engine, the ones DOWNLOAD finished for. A brain whose files went (the phone cleared them) is dropped from `have`.
 */
export async function brainsHere(): Promise<string[]> {
  const have = offlineBrain.get().have ?? [];
  const t = testEngine();
  if (t && !t.files) return have;
  const here: string[] = [];
  for (const id of have) {
    const m = offlineModels().find((x) => x.id === id);
    if (m && (await cachedWhole(m))) here.push(id);
  }
  if (here.length !== have.length) offlineBrain.set({ have: here });
  return here;
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
  // The revision in the address: the service worker keeps vendored files cache-first, so a changed worker
  // gets a new address (models.ts WORKER_REV, also written at the top of worker.mjs) and phones fetch it.
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
  model_list: offlineModels().map((m) => ({
    // Pinned to one commit (offline/models.ts): WebLLM keeps a URL that names its revision.
    model: modelBase(m),
    model_id: m.id,
    // The model's compiled code comes from this site, not GitHub: same version, no third party.
    model_lib: new URL(`${VENDOR}/libs/${m.lib}`, location.origin).href,
    vram_required_MB: m.vram,
    low_resource_required: true,
    required_features: ['shader-f16'],
    // A shorter memory than the model allows: our prompts are short and a phone's memory is tight. The Qwen3.5 brains
    // as WebLLM's own list runs them (offline/models.ts BIGGER): 4,096 tokens and one running state.
    overrides: { context_window_size: m.ctx ?? 2048, ...(m.history ? { max_history_size: m.history } : {}) },
  })),
});

const notHere = () => new Error("The offline brain isn't on this phone yet: Settings → Offline brain → DOWNLOAD (on Wi-Fi).");
const stopped = () => Object.assign(new Error('stopped'), { name: 'AbortError' });

let loading: Promise<void> | null = null;
/**
 * Load the model into memory (every file must already be on this phone: GET and DOWNLOAD fetch them); `onProgress`
 * gets 0–1 and WebLLM's own words. A bigger brain first passes `mayLoad` and is loaded under the crash record
 * (`guarded`). When it fails for memory, the 0.6B becomes the brain in use (fallBack); `retry` then loads the 0.6B
 * for the reply that asked, else the failure is thrown in plain words (USE).
 */
function load(onProgress?: (frac: number, text: string) => void, retry = true): Promise<void> {
  if (offlineBrain.get().loaded && worker) return Promise.resolve();
  loading ??= (async () => {
    if (!(await offlineReady())) throw notHere();
    const model = currentModel();
    await mayLoad(model);
    offlineBrain.set({ busy: 'load', progress: 0, text: '' });
    try {
      // Never two models in graphics memory: the meaning model leaves, and a worker holding anything else ends.
      freeEmbedder();
      if (worker && isBigger(model)) dropWorker();
      await guarded(model, () =>
        call('load', { model: model.id, appConfig: appConfig() }, (e) => {
          const frac = Math.max(0, Math.min(1, e.progress ?? 0));
          offlineBrain.set({ progress: frac, text: e.text ?? '' });
          onProgress?.(frac, e.text ?? '');
        }),
      );
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
  // A bigger brain the phone could not give the memory to: the 0.6B takes over, at once when it is on this phone.
  return loading.catch(async (e) => {
    if (!(await fallBack(e))) throw e;
    if (!retry) throw new Error(offlineBrain.get().fellBack);
    return load(onProgress);
  });
}

/** The crash record: a bigger brain being loaded right now (localStorage, written synchronously before the load). */
const LOADING_KEY = 'ghosty.offlinebrain.loading';
const readLoading = (): { loading: string; at: number } | null => {
  try {
    const v = JSON.parse(localStorage.getItem(LOADING_KEY) ?? 'null') as { loading?: unknown; at?: unknown } | null;
    return v && typeof v.loading === 'string' ? { loading: v.loading, at: Number(v.at) || 0 } : null;
  } catch {
    return null;
  }
};
const setLoading = (v: { loading: string; at: number } | null) => {
  try {
    if (v) localStorage.setItem(LOADING_KEY, JSON.stringify(v));
    else localStorage.removeItem(LOADING_KEY);
  } catch {
    /* blocked storage: the load still runs */
  }
};

/** Remember what a load of this brain did on this phone (the picker's "can hold" line, and whether USE asks first). */
function setHeld(m: ModelDef, s: Held['s'], at = Date.now()): void {
  offlineBrain.set({ held: { ...(offlineBrain.get().held ?? {}), [slotOf(m)]: { s, at } } });
}
export const heldOf = (m: ModelDef): Held | undefined => (offlineBrain.get().held ?? {})[slotOf(m)];

/** The bigger brains the owner said yes to loading in this session (USE's question): only these may load after a close. */
const approved = new Set<string>();
/** The owner said yes to loading this brain (USE's or TEST's question). */
export const approveLoad = (m: ModelDef): void => void approved.add(slotOf(m));
/** Whether this phone can run it (models.ts limitsProblem), remembered as "could not start" when not: '' when fine. */
export async function checkBrain(m: ModelDef): Promise<string> {
  const why = await precheck(m);
  if (why && isBigger(m)) setHeld(m, 'refused');
  return why;
}

/** A failure that sends Ghosty back to the 0.6B, with its own plain words. */
const refusal = (msg: string) => Object.assign(new Error(msg), { refuse: true });

/**
 * May this brain go into graphics memory? A bigger one that closed Ghosty before needs the owner's yes again (USE asks),
 * and one whose pieces are bigger than this phone's WebGPU gives a page is never tried.
 */
async function mayLoad(m: ModelDef): Promise<void> {
  if (!isBigger(m)) return;
  if (heldOf(m)?.s === 'closed' && !approved.has(slotOf(m))) throw refusal(`${m.label} closed Ghosty the last time it loaded on this phone, so it is not loaded again until you say so (SETTINGS → OFFLINE BRAIN → USE).`);
  const why = await precheck(m);
  if (why) {
    setHeld(m, 'refused');
    throw refusal(why);
  }
}

/** Load a bigger brain under the crash record: set before, cleared after, and what happened remembered. */
async function guarded<T>(m: ModelDef, fn: () => Promise<T> | T): Promise<T> {
  if (!isBigger(m)) return fn();
  setLoading({ loading: m.id, at: Date.now() });
  try {
    const r = await fn();
    setHeld(m, 'loaded');
    return r;
  } catch (e) {
    if (tooBig(e)) setHeld(m, 'failed');
    throw e;
  } finally {
    setLoading(null);
  }
}

/**
 * After a failure: when the brain in use is a bigger one and the phone ran out of memory (or lost its graphics) loading
 * it, or it may not load here (mayLoad), the 0.6B becomes the brain in use and the owner is told in plain words
 * (`fellBack`, shown in SETTINGS). Its files stay: closing other apps and choosing it again may be enough. True when it
 * fell back.
 */
async function fallBack(e: unknown): Promise<boolean> {
  const m = currentModel();
  const refused = !!(e as { refuse?: boolean })?.refuse;
  if (!isBigger(m) || !(refused || tooBig(e))) return false;
  freeModel();
  const small = MODELS[0]!;
  const have = offlineBrain.get().have ?? [];
  const here = have.includes(small.id);
  // (its files stay, and count as on this phone when they are whole: REMOVE is then offered for them)
  const whole = await cachedWhole(m);
  const get = here ? '' : ' (press DOWNLOAD for it: about 352 MB, on Wi-Fi)';
  offlineBrain.set({
    have: whole ? [...new Set([...have, m.id])] : have,
    model: small.id,
    downloaded: here,
    loaded: false,
    fellBack: refused
      ? `${(e as Error).message} Ghosty is using ${small.label}${get}.`
      : `${m.label} needed more memory than this phone could give it just now, so Ghosty is using ${small.label} instead${get}. ${m.label} stays on this phone: close other apps and choose it again to try once more, or REMOVE it to free ${sizeText(m.mb)}.`,
  });
  checkedAt = 0;
  return true;
}

/** The test engine's load, told which model, with the same checks, crash record and fallback as the real one. */
async function testLoad(t: TestEngine, retry = true): Promise<void> {
  try {
    const m = currentModel();
    await mayLoad(m);
    freeEmbedder();
    await guarded(m, () => t.load?.(m.id));
  } catch (e) {
    if (!(await fallBack(e))) throw e;
    if (!retry) throw new Error(offlineBrain.get().fellBack);
    await t.load?.(currentModel().id);
  }
}

/** The phone ran out of memory or lost its graphics device: worth trying the smaller model. */
const tooBig = (e: unknown) => /memory|device (?:was )?lost|allocat|exceed|out of|OOM|buffer size/i.test(String((e as Error)?.message ?? e));

/** navigator.storage.persist() is asked at most once each time Ghosty opens (at the first GET or DOWNLOAD). */
let askedKeep = false;

/**
 * A GET this phone's space cannot hold, in plain words, before a byte is downloaded ('' when it fits or the browser
 * will not say): navigator.storage.estimate() against what this brain still needs (models.ts roomProblem).
 */
export async function noRoom(m: ModelDef): Promise<string> {
  const est = await (navigator.storage?.estimate?.() ?? Promise.resolve(null)).catch(() => null);
  if (!est || !(Number(est.quota) > 0)) return '';
  const here = (await presence([m], location.origin)).get(m.id);
  return roomProblem(m, Number(est.quota), Number(est.usage) || 0, here?.bytes ?? 0);
}

/**
 * What the picker says about storage (SETTINGS → OFFLINE BRAIN), all read from this phone at opening: each brain's pieces
 * really in the cache (models.ts onPhoneLine), a brain that was whole here and has lost pieces since (goneLine), whether
 * the phone keeps Ghosty's storage for good, and whether this browser can keep a download at all. `null` with a test
 * engine that only pretends to download.
 */
export async function keptHere(): Promise<{ kept: Kept[]; gone: string[]; persisted: boolean | null; cacheless: boolean } | null> {
  const t = testEngine();
  if (t && !t.files) return null;
  await checkStorage(false);
  const persisted = storageState.get().supported ? storageState.get().persisted : null;
  if (typeof caches === 'undefined') return { kept: [], gone: [], persisted, cacheless: true };
  const cur = currentModel();
  const models = PICKER.some((m) => m.id === cur.id) ? PICKER : [...PICKER, cur];
  const counts = await presence(models, location.origin);
  const was = readStored();
  const kept: Kept[] = [];
  const gone: string[] = [];
  for (const m of models) {
    const c = counts.get(m.id) ?? { have: 0, of: 0, bytes: 0 };
    kept.push({ label: m.label, mb: m.mb, have: c.have, of: c.of });
    const w = was[storedId(m)];
    if (w && c.have < w.of && readLog()?.model !== m.id) gone.push(goneLine(m, w, c.have));
  }
  return { kept, gone, persisted, cacheless: false };
}

/**
 * A brain's files into WebLLM's cache (GET and DOWNLOAD): the brain in use and the meaning model leave memory first, one
 * piece at a time, the progress line "piece 37 of 120 · 412 MB of 1,082 MB", and nothing loaded into graphics memory.
 */
async function getFiles(m: ModelDef, onProgress?: (frac: number, text: string) => void): Promise<void> {
  if (offlineBrain.get().busy || modelJob.get().job) throw new Error('The offline brain is busy right now: try again in a moment.');
  const t = testEngine();
  if (!t) {
    const s = await offlineSupport();
    if (!s.ok) throw new Error(s.reason);
  }
  // Before a byte comes: the phone keeps it for good if it will (asked once), and the space it gives Ghosty can hold it.
  if (!askedKeep) {
    askedKeep = true;
    await checkStorage(true);
  }
  const room = await noRoom(m);
  if (room) throw Object.assign(new Error(room), { room: true });
  freeModel();
  freeEmbedder();
  offlineBrain.set({ busy: 'download', getting: m.id, progress: 0, text: '' });
  try {
    if (t && !t.files) onProgress?.(1, 'done');
    else
      await fill(
        m,
        location.origin,
        (p) => {
          const frac = p.total ? Math.min(1, p.bytes / p.total) : 0;
          const text = pieceLine(p.piece, p.of, p.bytes, p.total, p.part, p.parts);
          offlineBrain.set({ progress: frac, text });
          onProgress?.(frac, text);
        },
        undefined,
        t?.part ?? PART_BYTES,
      );
  } catch (e) {
    const name = (e as Error)?.name ?? '';
    const kind = name === 'QuotaExceededError' ? 'full' : downloadFailure(e);
    if (kind === 'full') throw new Error(`This phone has no room left for ${m.label} (about ${sizeText(m.mb)}): free some space, then tap GET again. What is stored so far stays.`);
    if (kind === 'network' || kind === 'too-big') throw Object.assign(new Error(`Getting ${m.label} was interrupted (the connection dropped?). Tap GET again on Wi-Fi: it carries on from where it stopped.`), { network: true });
    throw e;
  } finally {
    offlineBrain.set({ busy: '', getting: '' });
  }
  offlineBrain.set({ have: [...new Set([...(offlineBrain.get().have ?? []), m.id])] });
  if (m.id === currentModel().id) offlineBrain.set({ downloaded: true });
  checkedAt = 0;
}

/**
 * Download the brain in use for use with no connection (≈352 MB, once): its files only, nothing loaded (TEST or the
 * first reply loads it). A trained brain whose files are gone or wrong goes back to its base's stock build.
 */
export async function downloadOffline(onProgress?: (frac: number, text: string) => void): Promise<void> {
  const m = currentModel();
  try {
    await getFiles(m, onProgress);
  } catch (e) {
    const trained = !PICKER.concat(MODELS).some((x) => x.id === m.id);
    if ((e as { room?: boolean }).room) throw e;
    if ((e as { network?: boolean }).network) throw new Error('The download was interrupted (the connection dropped?). Press DOWNLOAD again on Wi-Fi: it carries on from where it stopped.');
    if (trained && downloadFailure(e) === 'broken') {
      // A trained brain whose files are really wrong or gone: only ITS files go, and the phone goes back to its base's stock one.
      const stock = stockOf(brainOf(m));
      dropWorker();
      await removeFilesOf(modelBase(m));
      clearLog(m.id);
      markStored(storedId(m), 0);
      offlineBrain.set({ model: stock.id, downloaded: false });
      checkedAt = 0;
      throw new Error(`${m.label} would not download (${String((e as Error)?.message ?? e).slice(0, 120)}). Back to the stock ${stock.label}: press DOWNLOAD (if it is still on this phone, it is ready at once).`);
    }
    throw e;
  }
  const t = testEngine();
  if (t) t.ready = true;
  offlineBrain.set({ downloaded: true, fellBack: '' });
  // Files from an older pinned revision go.
  await pruneOtherRevisions();
}

/**
 * GET in the picker: one of its brains onto this phone (its files only). The brain in use stays the one in use, and
 * nothing goes into graphics memory: USE loads it, after the checks.
 */
export async function getBrain(id: string, onProgress?: (frac: number, text: string) => void): Promise<ModelDef> {
  const m = offlineModels().find((x) => x.id === id);
  if (!m) throw new Error('That brain is not offered here.');
  await getFiles(m, onProgress);
  await pruneOtherRevisions();
  return m;
}

/**
 * USE: make a brain on this phone the one in use and load it now, so a phone that cannot hold it finds out here (with
 * the owner watching, after USE's warning) and not in the middle of a reply. Asking for this is the owner's yes after a
 * close. When it fails, the 0.6B is the brain in use again and the error says so in plain words.
 */
export async function useBrain(id: string): Promise<ModelDef> {
  const m = offlineModels().find((x) => x.id === id);
  if (!m) throw new Error('That brain is not offered here.');
  if (modelJob.get().job) throw new Error('The offline brain is busy right now: try again in a moment.');
  if (isBigger(m)) approved.add(slotOf(m));
  if (!chooseBrain(id)) throw new Error('The offline brain is busy right now: try again in a moment.');
  const t = testEngine();
  if (t) await testLoad(t, false);
  else await load(undefined, false);
  return m;
}

/**
 * On opening: what happened while Ghosty was closed. A load still recorded means iOS closed Ghosty during it: that brain
 * is marked "closed Ghosty on this phone", its download stays, and the 0.6B is the brain in use again. A download log
 * left means GET did not finish (the picker offers CONTINUE; nothing restarts by itself). Once, for a phone that tried a
 * bigger brain before this check existed: one in use that never finished loading goes back to the 0.6B in the same way.
 */
let closedWhileGetting = false;
/** The download in the log was cut short by Ghosty closing (it was there when Ghosty opened). */
export const wasClosedWhileGetting = (): boolean => closedWhileGetting && !!readLog();

function closedWords(m: ModelDef, at: number | null, here: boolean): string {
  const when = at ? ` (${new Date(at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })})` : ' the last time it was tried';
  return `Loading ${m.label} closed Ghosty${when}: the phone could not hold it. Ghosty is back on ${MODELS[0]!.label}${here ? '' : ' (press DOWNLOAD for it: about 352 MB, on Wi-Fi)'}. ${m.label}'s download stays on this phone, and USE asks before it tries again.`;
}

function backToSmall(m: ModelDef, at: number | null): void {
  const have = offlineBrain.get().have ?? [];
  const small = MODELS[0]!;
  const here = have.includes(small.id);
  setHeld(m, 'closed', at || Date.now());
  offlineBrain.set({ have: [...new Set([...have, m.id])], ...(isBigger(currentModel()) ? { model: small.id, downloaded: here, loaded: false } : {}), fellBack: closedWords(m, at, here) });
  checkedAt = 0;
}

export function recoverFromClose(): void {
  if (typeof localStorage === 'undefined') return;
  const mark = readLoading();
  if (mark) {
    setLoading(null);
    const m = offlineModels().find((x) => x.id === mark.loading) ?? PICKER.find((x) => x.id === mark.loading);
    if (m) backToSmall(m, mark.at);
  }
  closedWhileGetting = !!readLog();
  if (offlineBrain.get().guarded) return;
  offlineBrain.set({ guarded: true });
  // Before this check, GET downloaded and loaded in one go, and a bigger brain stayed "in use" when iOS closed Ghosty.
  const cur = currentModel();
  if (mark || !BIGGER.some((x) => x.id === cur.id) || offlineBrain.get().downloaded || heldOf(cur)) return;
  void (async () => {
    const t = testEngine();
    const whole = t && !t.files ? (offlineBrain.get().have ?? []).includes(cur.id) : await filled(cur);
    if (whole) backToSmall(cur, null);
    else {
      const have = offlineBrain.get().have ?? [];
      offlineBrain.set({ model: MODELS[0]!.id, downloaded: have.includes(MODELS[0]!.id), loaded: false });
      if (!readLog()) writeLog({ model: cur.id, piece: 0, of: 0, bytes: 0, at: Date.now() });
    }
    checkedAt = 0;
  })();
}

/**
 * Make one of the picker's brains (or a kept week) the one in use. Nothing is downloaded here: a brain already on this
 * phone is ready at once, another one waits for DOWNLOAD (the picker asks first, with its size). The old one leaves memory.
 */
export function chooseBrain(id: string): ModelDef | null {
  const m = offlineModels().find((x) => x.id === id);
  if (!m || offlineBrain.get().busy) return null;
  freeModel();
  offlineBrain.set({ model: m.id, downloaded: (offlineBrain.get().have ?? []).includes(m.id), loaded: false, fellBack: '' });
  checkedAt = 0;
  return m;
}

/** Remove one brain's files from this phone (a bigger one he tried); the one in use goes back to the 0.6B. */
export async function removeBrain(id: string): Promise<void> {
  const m = offlineModels().find((x) => x.id === id);
  if (!m) return;
  if (currentModel().id === id) chooseBrain(MODELS[0]!.id);
  await removeFilesOf(modelBase(m));
  clearLog(id);
  markStored(storedId(m), 0);
  offlineBrain.set({ have: (offlineBrain.get().have ?? []).filter((x) => x !== id) });
}

/** A model's weights and config kept by WebLLM: from Hugging Face, or a trained week's from Ghosty's weight address. */
const isModelFile = (url: string) => url.startsWith('https://huggingface.co/') || new URL(url).pathname.startsWith('/api/w/');

/**
 * Remove cached model files that are not the current model's (an older download, another trained week) — only after a
 * download finished. The picker's stock brains that are on this phone stay (switching back needs no new download, and
 * the 0.6B is the fallback), and so does SEARCH BY MEANING's model (offline/embed.ts), which shares these stores.
 */
async function pruneOtherRevisions(): Promise<void> {
  if (typeof caches === 'undefined') return;
  const have = offlineBrain.get().have ?? [];
  const keep = [modelBase(currentModel()), ...PICKER.concat(MODELS).filter((m) => have.includes(m.id)).map(modelBase)];
  for (const name of ['webllm/model', 'webllm/config']) {
    try {
      const c = await caches.open(name);
      for (const r of await c.keys()) if (isModelFile(r.url) && !keep.some((k) => r.url.startsWith(k)) && !isEmbedFile(r.url)) await c.delete(r);
    } catch {
      /* no cache storage */
    }
  }
}

/** Remove one model's files only (everything else, the stock model's included, stays). */
async function removeFilesOf(base: string): Promise<void> {
  if (typeof caches === 'undefined') return;
  for (const name of ['webllm/model', 'webllm/config', PARTS_STORE]) {
    try {
      const c = await caches.open(name);
      for (const r of await c.keys()) if (r.url.startsWith(base)) await c.delete(r);
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

/** The brain's files out of WebLLM's stores; SEARCH BY MEANING's model, when it is here, stays (offline/embed.ts). */
async function clearCaches(): Promise<void> {
  if (typeof caches === 'undefined') return;
  await caches.delete(PARTS_STORE).catch(() => false);
  if (!embedState.get().downloaded) {
    await Promise.all(WEBLLM_CACHES.map((c) => caches.delete(c).catch(() => false)));
    return;
  }
  for (const name of WEBLLM_CACHES) {
    try {
      const c = await caches.open(name);
      for (const r of await c.keys()) if (!isEmbedFile(r.url)) await c.delete(r);
    } catch {
      /* no cache storage */
    }
  }
}

/** Remove the model from this phone (and the runtime's copy kept by the app's own cache). */
export async function deleteOffline(): Promise<void> {
  checkedAt = 0;
  const t = testEngine();
  if (t) t.ready = false;
  dropWorker();
  clearLog();
  try {
    localStorage.removeItem(STORED_KEY);
  } catch {
    /* blocked */
  }
  await clearCaches();
  try {
    // The service worker keeps vendored files; WebLLM's ~16 MB is only worth keeping with a model (search by
    // meaning runs on it too: then only the brain's own compiled code goes).
    const c = await caches.open('ghosty-vendor-v1');
    const keepRuntime = embedState.get().downloaded;
    for (const r of await c.keys()) {
      const path = new URL(r.url).pathname;
      if (path.startsWith(`${VENDOR}/`) && !(keepRuntime && (!path.startsWith(`${VENDOR}/libs/`) || isEmbedFile(r.url)))) await c.delete(r);
    }
  } catch {
    /* no cache storage */
  }
  offlineBrain.set({ downloaded: false, loaded: false, model: MODELS[0]!.id, progress: 0, text: '', have: [], fellBack: '' });
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
    if (!(await offlineReady())) throw notHere();
    await testLoad(t);
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

// ---------------------------------------------------------------------------------------
// One job on the model at a time
// ---------------------------------------------------------------------------------------

/** Load the model into memory now (a test engine's `load`), so a time budget starts once it is ready. */
export async function loadOffline(): Promise<void> {
  const t = testEngine();
  if (t) {
    if (!(await offlineReady())) throw notHere();
    await testLoad(t);
    return;
  }
  await load();
}

/** Answer one message on this phone: the prompt (persona, memory, agenda, library, recent turns) and the streamed reply. */
export async function answerOffline(question: string, recent: { role: 'user' | 'assistant'; text: string }[], onToken: (t: string) => void): Promise<{ text: string; tokens: number; perSecond: number }> {
  // Made before the first wait, so a "stop" while the library is searched (or the model is busy) counts too.
  const ctl = new AbortController();
  replying = ctl;
  try {
    return await withModel('chat', async () => {
      if (ctl.signal.aborted) throw stopped();
      return offlineReply(await offlinePrompt(question, recent), onToken, ctl.signal);
    });
  } finally {
    if (replying === ctl) replying = null;
  }
}

/**
 * Translate on this phone (no signal, or the offline brain set to "always"): the small model asked only to
 * translate `text` into language `to` (a code), cool and short. Rough — the words with it say so. `onToken` gets
 * the raw pieces; the result's `text` is the clean translation. "Stop" stops it like any offline reply.
 */
export async function translateOffline(text: string, to: string, onToken: (t: string) => void = () => undefined): Promise<{ text: string; tokens: number; perSecond: number }> {
  const ctl = new AbortController();
  replying = ctl;
  try {
    return await withModel('chat', async () => {
      if (ctl.signal.aborted) throw stopped();
      // About three tokens a word in most of these languages, with room for Arabic and Urdu script.
      // (cleaned from the raw pieces: an ordinary reply's polish is for Ghosty's own English, not a translation)
      let raw = '';
      const r = await offlineReply(translatePrompt(text, to), (t) => ((raw += t), onToken(t)), ctl.signal, { temperature: 0.2, max: Math.min(800, 40 + Math.ceil(text.length * 1.2)) });
      return { ...r, text: cleanTranslation(raw || r.text, to) };
    });
  } finally {
    if (replying === ctl) replying = null;
  }
}

/**
 * The prompt an ordinary offline answer gets (persona, memory, agenda, the library's best passages, recent
 * turns); THINK HARDER uses it too, with a smaller `budget` (its prompts are asked several times).
 */
export async function offlinePrompt(question: string, recent: { role: 'user' | 'assistant'; text: string }[], budget?: number): Promise<OfflineMsg[]> {
  // The library's best three by meaning when SEARCH BY MEANING is here and the index covers the library, else by keywords.
  // The meaning model leaves memory straight away: the brain is about to load, and a phone holds one comfortably.
  const found = await searchLocalHow(question, 3).catch(() => ({ hits: [], how: 'keywords' as const, unindexed: 0 }));
  freeEmbedder();
  const hits = found.hits;
  const now = new Date().toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const msgs = buildOfflinePrompt(
    {
      name: settings.get().name,
      now,
      facts: factsWithOutbox(offline.get().memory ?? []).map((f) => f.text),
      agenda: agendaLines(),
      passages: hits.map((h) => ({ title: h.title, text: h.text })),
      recent,
      question,
      persona: settings.get().persona,
    },
    budget,
  );
  // What the small model was given, for a test (window.__ghosty.meaning) and the console: it stays on this phone.
  lastPrompt.set({ how: found.how, titles: hits.map((h) => h.title), system: msgs[0]?.content ?? '' });
  return msgs;
}

/** The last prompt the offline brain was given: how its passages were found, their titles, the system message. */
export const lastPrompt = createStore({ how: '' as '' | 'meaning' | 'keywords', titles: [] as string[], system: '' });

/** The size of the model being used, for the settings panel. */
export const offlineSize = (): number => currentModel().mb;

// What happened while Ghosty was closed (a load iOS cut short, a download left half-way), as soon as the app opens.
recoverFromClose();
