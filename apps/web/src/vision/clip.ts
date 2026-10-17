/**
 * The namer: MobileCLIP-S0's picture encoder (Apple's small CLIP, half-float ONNX) run on the
 * phone with ONNX Runtime Web (WebAssembly, one thread: iOS gives a page no shared memory), and
 * banks of names whose numbers were made beforehand with the same model's text side ("a photo of
 * a {name}."). Everything is served from this site (/vendor/clip) and kept by the service worker
 * after the first use, so the second time costs nothing; nothing leaves the phone.
 *
 * Loaded on the first use of NAME and freed when the Lens leaves that mode (release()): the
 * runtime's memory goes, the label banks go, and the next use reads the files again from the
 * cache. The arithmetic lives in clipmath.ts (pure, tested in Node).
 */
import { bankFromF16, bankFromI8, CLIP_DIM, CLIP_SIZE, centreSquare, nameTop, normalize, rgbaToChw, type LabelBank, type NameGuess } from './clipmath';
import { simdSupported, type Progress } from './models';

const BASE = '/vendor/clip';
export const CLIP_FILES = {
  runtime: `${BASE}/ort.wasm.min.mjs`,
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

// The few parts of ONNX Runtime Web this file uses (the module is loaded at run time from /vendor).
interface OrtTensor {
  data: Float32Array | ArrayLike<number>;
  dims: readonly number[];
}
interface OrtSession {
  inputNames: readonly string[];
  outputNames: readonly string[];
  run(feeds: Record<string, unknown>): Promise<Record<string, OrtTensor>>;
  release(): Promise<void>;
}
interface OrtNS {
  env: { wasm: { numThreads?: number; wasmPaths?: string; proxy?: boolean } };
  InferenceSession: { create(model: Uint8Array, options?: Record<string, unknown>): Promise<OrtSession> };
  Tensor: new (type: 'float32', data: Float32Array, dims: number[]) => unknown;
}

/** Can this phone run the namer? A plain reason when not. */
export function namerSupport(): { ok: true } | { ok: false; why: string } {
  if (typeof WebAssembly !== 'object') return { ok: false, why: 'This browser has no WebAssembly, so the namer cannot run here' };
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

let ortModule: Promise<OrtNS> | null = null;
function loadOrt(): Promise<OrtNS> {
  ortModule ??= (async () => {
    // a plain string so neither the bundler nor the type checker follows it (as models.ts does)
    const url: string = CLIP_FILES.runtime;
    const ort = (await import(url)) as Partial<OrtNS>;
    if (!ort.InferenceSession || !ort.Tensor || !ort.env) throw new Error('The namer runtime did not load');
    // one thread, in this page: iOS has no shared memory for a page that is not cross-origin isolated
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    ort.env.wasm.wasmPaths = `${BASE}/`;
    return ort as OrtNS;
  })().catch((e: unknown) => {
    ortModule = null;
    throw e;
  });
  return ortModule;
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
  private session: OrtSession | null = null;
  private ort: OrtNS | null = null;
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
    return !!this.session && !!this.core;
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
      const ort = await loadOrt();
      const [labels, vecs, model] = await Promise.all([
        fetchJson<string[]>(CLIP_FILES.coreLabels, 'names'),
        fetchBytes(CLIP_FILES.coreVecs, () => undefined, 'names'),
        fetchBytes(CLIP_FILES.model, progress, `namer (${NAMER_SIZE}, once)`),
      ]);
      progress('starting the namer…');
      const session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
      if (gen !== this.gen) {
        void session.release().catch(() => undefined);
        throw new Error('The namer was put away while it loaded');
      }
      this.ort = ort;
      this.session = session;
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
    const session = this.session;
    const ort = this.ort;
    const core = this.core;
    if (!session || !ort || !core || this.busy) return null;
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
      const input = new ort.Tensor('float32', rgbaToChw(pixels, CLIP_SIZE, CLIP_SIZE), [1, 3, CLIP_SIZE, CLIP_SIZE]);
      const t0 = performance.now();
      const out = await session.run({ [session.inputNames[0] ?? 'pixel_values']: input });
      const ms = performance.now() - t0;
      const emb = out[session.outputNames[0] ?? 'image_embeds'];
      if (!emb || emb.data.length < CLIP_DIM) throw new Error('The namer gave no answer');
      const v = normalize(Array.from(emb.data).slice(0, CLIP_DIM));
      const names = nameTop(v, this.ext ? [core, this.ext] : core, k);
      return { names, ms };
    } finally {
      this.busy = false;
    }
  }

  /** Free everything (leaving NAME): the session's memory, the banks, the scratch canvas. */
  release(): void {
    this.gen++;
    const s = this.session;
    this.session = null;
    this.ort = null;
    this.core = null;
    this.ext = null;
    this.loading = null;
    this.extLoading = null;
    this.canvas = null;
    this.busy = false;
    if (s) void s.release().catch(() => undefined);
  }
}

/** The one namer the Lens uses. */
export const namer = new Namer();
