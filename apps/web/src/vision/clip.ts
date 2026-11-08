/**
 * The namer: MobileCLIP-S0's picture encoder (Apple's small CLIP, half-float ONNX) run on the
 * phone with ONNX Runtime Web (WebAssembly, one thread: iOS gives a page no shared memory), and
 * banks of names whose numbers were made beforehand with the same model's text side ("a photo of
 * a {name}."). Everything is served from this site (/vendor/clip) and kept by the service worker
 * after the first use, so the second time costs nothing; nothing leaves the phone.
 *
 * The runtime and the encoder run in their own worker (public/vendor/clip/worker.mjs), loaded on
 * the first use of NAME and ended when the Lens leaves that mode (release()): ending the worker is
 * the only way to give back the runtime's WebAssembly memory (it never shrinks, and a module the
 * page imported stays loaded for the page's life). The label banks go too, and the next use reads
 * the files again from the cache. The arithmetic lives in clipmath.ts (pure, tested in Node).
 */
import { bankFromF16, bankFromI8, CLIP_DIM, CLIP_SIZE, centreSquare, nameTop, normalize, rgbaToChw, type LabelBank, type NameGuess } from './clipmath';
import { simdSupported, type Progress } from './models';

const BASE = '/vendor/clip';
export const CLIP_FILES = {
  runtime: `${BASE}/ort.wasm.min.mjs`,
  worker: `${BASE}/worker.mjs`,
  model: `${BASE}/mobileclip_s0_vision_fp16.onnx`,
  coreLabels: `${BASE}/core.labels.json`,
  coreVecs: `${BASE}/core.f16.bin`,
  extLabels: `${BASE}/extended.labels.json`,
  extVecs: `${BASE}/extended.i8.bin`,
} as const;

/** What the first load costs, in words for the status line (runtime 14 MB + encoder 23 MB + names 5 MB). */
export const NAMER_SIZE = '42 MB';
/** The extra names (28,223 of them) as an int8 bank. */
export const EXTENDED_SIZE = '15 MB';

/** What the namer's worker answers (see public/vendor/clip/worker.mjs). */
type WorkerReply = { id: number; t: 'done' | 'error'; message?: string; data?: Float32Array };

/** The namer's worker: one session, plain request/answer messages; terminate() frees everything it held. */
class NamerWorker {
  private w: Worker;
  private seq = 0;
  private calls = new Map<number, { resolve: (r: WorkerReply) => void; reject: (e: Error) => void }>();

  constructor() {
    this.w = new Worker(CLIP_FILES.worker, { type: 'module' });
    this.w.onmessage = (ev: MessageEvent<WorkerReply>) => {
      const c = this.calls.get(ev.data.id);
      if (!c) return;
      this.calls.delete(ev.data.id);
      if (ev.data.t === 'error') c.reject(new Error(ev.data.message ?? 'the namer failed'));
      else c.resolve(ev.data);
    };
    this.w.onerror = (ev) => {
      ev.preventDefault();
      this.fail(new Error(ev.message || 'The namer runtime did not load'));
    };
  }

  call(op: string, payload: Record<string, unknown>, transfer: Transferable[] = []): Promise<WorkerReply> {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.calls.set(id, { resolve, reject });
      this.w.postMessage({ id, op, ...payload }, transfer);
    });
  }

  private fail(e: Error): void {
    for (const c of this.calls.values()) c.reject(e);
    this.calls.clear();
  }

  terminate(): void {
    this.w.terminate();
    this.fail(new Error('The namer was put away'));
  }
}

/** Can this phone run the namer? A plain reason when not. */
export function namerSupport(): { ok: true } | { ok: false; why: string } {
  if (typeof WebAssembly !== 'object') return { ok: false, why: 'This browser has no WebAssembly, so the namer cannot run here' };
  if (typeof Worker === 'undefined') return { ok: false, why: 'This browser cannot run the namer in the background (no workers)' };
  if (!simdSupported()) return { ok: false, why: 'This phone cannot run the namer: it needs iOS 16.4 or newer (or a current Chrome or Firefox)' };
  return { ok: true };
}

/**
 * A file from /vendor/clip with real progress. Unlike models.ts's fetchModel the bytes are not
 * kept in memory afterwards: the session copies what it needs, and the service worker keeps the
 * file for the next visit.
 */
async function fetchBytes(url: string, progress: Progress, label: string): Promise<Uint8Array> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not load the ${label} (HTTP ${r.status})`);
  const total = Number(r.headers.get('content-length')) || 0;
  if (!r.body) return new Uint8Array(await r.arrayBuffer());
  const reader = r.body.getReader();
  const chunks: Uint8Array[] = [];
  let got = 0;
  let said = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.byteLength;
    if (got - said > 256 * 1024) {
      said = got;
      progress(`loading the ${label}${total ? ` ${Math.round((got / total) * 100)}%` : ` ${(got / 1e6).toFixed(1)} MB`}`, total ? got / total : undefined);
    }
  }
  const out = new Uint8Array(got);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

async function fetchJson<T>(url: string, label: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not load the ${label} (HTTP ${r.status})`);
  return (await r.json()) as T;
}

export interface NamerReady {
  /** Names in the banks now loaded (4,624, or 32,000-odd with the extended bank). */
  names: number;
  extended: boolean;
}

/** One picture named: the top guesses and how long the encoder took. */
export interface Named {
  names: NameGuess[];
  ms: number;
}

/** The namer, created on first use and released on leaving NAME. One picture at a time. */
export class Namer {
  private worker: NamerWorker | null = null;
  private core: LabelBank | null = null;
  private ext: LabelBank | null = null;
  private loading: Promise<NamerReady> | null = null;
  private extLoading: Promise<void> | null = null;
  private canvas: HTMLCanvasElement | null = null;
  /** Bumped by release(): a load in flight then belongs to the past and frees what it made. */
  private gen = 0;
  /** A run is in progress (the next waits rather than queueing up). */
  busy = false;

  get ready(): boolean {
    return !!this.worker && !!this.core;
  }

  get extended(): boolean {
    return !!this.ext;
  }

  /** Load the runtime, the encoder and the core names (and the extended names if asked). */
  load(progress: Progress, extended = false): Promise<NamerReady> {
    this.loading ??= (async () => {
      const support = namerSupport();
      if (!support.ok) throw new Error(support.why);
      const gen = this.gen;
      progress(`loading the namer (${NAMER_SIZE}, once)…`, 0);
      const [labels, vecs, model] = await Promise.all([
        fetchJson<string[]>(CLIP_FILES.coreLabels, 'names'),
        fetchBytes(CLIP_FILES.coreVecs, () => undefined, 'names'),
        fetchBytes(CLIP_FILES.model, progress, `namer (${NAMER_SIZE}, once)`),
      ]);
      if (gen !== this.gen) throw new Error('The namer was put away while it loaded');
      progress('starting the namer…');
      const worker = new NamerWorker();
      try {
        // the encoder's bytes move to the worker: none stay in this page
        await worker.call('load', { model: model.buffer }, [model.buffer]);
      } catch (e) {
        worker.terminate();
        throw e;
      }
      if (gen !== this.gen) {
        worker.terminate();
        throw new Error('The namer was put away while it loaded');
      }
      this.worker = worker;
      this.core = bankFromF16(labels, vecs);
      progress('namer ready', 1);
      return { names: this.core.labels.length, extended: false };
    })().catch((e: unknown) => {
      this.loading = null;
      throw e;
    });
    return this.loading.then(async (r) => {
      if (extended) await this.loadExtended(progress);
      return { ...r, names: (this.core?.labels.length ?? 0) + (this.ext?.labels.length ?? 0), extended: !!this.ext };
    });
  }

  /** The extended bank (28,223 more names, int8), loaded on request. */
  loadExtended(progress: Progress): Promise<void> {
    if (this.ext) return Promise.resolve();
    this.extLoading ??= (async () => {
      const gen = this.gen;
      const [labels, bytes] = await Promise.all([fetchJson<string[]>(CLIP_FILES.extLabels, 'extended names'), fetchBytes(CLIP_FILES.extVecs, progress, `extended names (${EXTENDED_SIZE}, once)`)]);
      if (gen !== this.gen) return;
      this.ext = bankFromI8(labels, bytes);
    })().finally(() => {
      this.extLoading = null;
    });
    return this.extLoading;
  }

  /** Stop using the extended names (frees their memory). */
  dropExtended(): void {
    this.ext = null;
  }

  /**
   * Name a picture (or the part `rect` of it, in its own pixels): the centre square, scaled to
   * 256 × 256, through the encoder; the top `k` names over the core bank (and the extended one,
   * merged). Null when the namer is not loaded or still busy with the last picture.
   */
  async name(src: CanvasImageSource, size: { w: number; h: number }, rect?: { x: number; y: number; w: number; h: number }, k = 5): Promise<Named | null> {
    const worker = this.worker;
    const core = this.core;
    if (!worker || !core || this.busy) return null;
    if (!(size.w > 0) || !(size.h > 0)) return null;
    this.busy = true;
    try {
      const r = rect ?? { x: 0, y: 0, w: size.w, h: size.h };
      const sq = centreSquare(r.w, r.h);
      const c = (this.canvas ??= document.createElement('canvas'));
      c.width = CLIP_SIZE;
      c.height = CLIP_SIZE;
      const g = c.getContext('2d', { willReadFrequently: true });
      if (!g) return null;
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.drawImage(src, r.x + sq.x, r.y + sq.y, sq.w, sq.h, 0, 0, CLIP_SIZE, CLIP_SIZE);
      const pixels = g.getImageData(0, 0, CLIP_SIZE, CLIP_SIZE).data;
      const input = rgbaToChw(pixels, CLIP_SIZE, CLIP_SIZE);
      const t0 = performance.now();
      const out = await worker.call('run', { input, dims: [1, 3, CLIP_SIZE, CLIP_SIZE] }, [input.buffer]);
      const ms = performance.now() - t0;
      const emb = out.data;
      if (!emb || emb.length < CLIP_DIM) throw new Error('The namer gave no answer');
      const v = normalize(Array.from(emb).slice(0, CLIP_DIM));
      const names = nameTop(v, this.ext ? [core, this.ext] : core, k);
      return { names, ms };
    } finally {
      this.busy = false;
    }
  }

  /** Free everything (leaving NAME): the worker (runtime, its memory, the encoder), the banks, the scratch canvas. */
  release(): void {
    this.gen++;
    const w = this.worker;
    this.worker = null;
    this.core = null;
    this.ext = null;
    this.loading = null;
    this.extLoading = null;
    this.canvas = null;
    this.busy = false;
    w?.terminate();
  }
}

/** The one namer the Lens uses. */
export const namer = new Namer();
