/**
 * The depth model, on the phone: Depth Anything V2 Metric Indoor Small (Apache-2.0; ONNX with
 * int8 weights made from depth-anything/Depth-Anything-V2-Metric-Indoor-Small-hf, see
 * public/vendor/depth/README.md) under ONNX Runtime Web (WebAssembly, one thread), in its own
 * worker (public/vendor/depth/worker.mjs). For every pixel of a photo it says how far away it
 * is in metres; depth3d.ts turns that into sizes.
 *
 * Loaded on the first AUTO measurement and ended when the Lens leaves MEASURE (release()),
 * which is the only way to give the runtime's WebAssembly memory back. The model file is two
 * parts (Cloudflare serves files up to 25 MiB); the service worker keeps them after the first
 * use, so the second time costs nothing. Nothing leaves the phone.
 */
import { simdSupported, type Progress } from '../vision/models';
import { inputSize, toInput } from './depth3d';

const BASE = '/vendor/depth';
export const DEPTH_FILES = {
  worker: `${BASE}/worker.mjs`,
  parts: [`${BASE}/dav2-metric-indoor-small.int8.onnx.part1`, `${BASE}/dav2-metric-indoor-small.int8.onnx.part2`],
} as const;
/** What the first load costs, in words (the model 36 MB; the runtime 14 MB is shared with NAME). */
export const DEPTH_SIZE = '50 MB';
/** The model's bytes, for the progress line. */
const MODEL_BYTES = 35_576_338;

type Reply = { id: number; t: 'done' | 'error'; message?: string; data?: Float32Array; dims?: number[] };

/** Can this phone run the depth model? A plain reason when not. */
export function depthSupport(): { ok: true } | { ok: false; why: string } {
  if (typeof WebAssembly !== 'object' || typeof Worker === 'undefined') return { ok: false, why: 'This browser cannot run the depth model (no WebAssembly or workers)' };
  if (!simdSupported()) return { ok: false, why: 'This phone cannot run the depth model: it needs iOS 16.4 or newer' };
  return { ok: true };
}

async function fetchPart(url: string, onBytes: (n: number) => void): Promise<ArrayBuffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not load the depth model (HTTP ${r.status})`);
  if (!r.body) {
    const b = await r.arrayBuffer();
    onBytes(b.byteLength);
    return b;
  }
  const reader = r.body.getReader();
  const chunks: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.byteLength;
    onBytes(value.byteLength);
  }
  const out = new Uint8Array(got);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out.buffer;
}

/** One depth map: metres as the model thinks (depth3d.metricDepth corrects them), `w` × `h`. */
export interface RawDepth {
  data: Float32Array;
  w: number;
  h: number;
  ms: number;
}

export class DepthModel {
  private w: Worker | null = null;
  private seq = 0;
  private calls = new Map<number, { resolve: (r: Reply) => void; reject: (e: Error) => void }>();
  private loading: Promise<void> | null = null;
  private gen = 0;
  busy = false;

  get ready(): boolean {
    return !!this.w && !this.loading;
  }

  private call(op: string, payload: Record<string, unknown>, transfer: Transferable[] = []): Promise<Reply> {
    const w = this.w;
    if (!w) return Promise.reject(new Error('The depth model was put away'));
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.calls.set(id, { resolve, reject });
      w.postMessage({ id, op, ...payload }, transfer);
    });
  }

  private fail(e: Error): void {
    for (const c of this.calls.values()) c.reject(e);
    this.calls.clear();
  }

  load(progress: Progress): Promise<void> {
    if (this.w && !this.loading) return Promise.resolve();
    this.loading ??= (async () => {
      const s = depthSupport();
      if (!s.ok) throw new Error(s.why);
      const gen = this.gen;
      let got = 0;
      let said = 0;
      const total = MODEL_BYTES;
      progress(`loading the depth model (${DEPTH_SIZE}, once)…`, 0);
      const parts = await Promise.all(
        DEPTH_FILES.parts.map((u) =>
          fetchPart(u, (n) => {
            got += n;
            if (got - said > 512 * 1024) {
              said = got;
              progress(`loading the depth model ${Math.min(99, Math.round((got / total) * 100))}% (once)`, Math.min(1, got / total));
            }
          }),
        ),
      );
      if (gen !== this.gen) throw new Error('The depth model was put away while it loaded');
      progress('starting the depth model…');
      const w = new Worker(DEPTH_FILES.worker, { type: 'module' });
      w.onmessage = (ev: MessageEvent<Reply>) => {
        const c = this.calls.get(ev.data.id);
        if (!c) return;
        this.calls.delete(ev.data.id);
        if (ev.data.t === 'error') c.reject(new Error(ev.data.message ?? 'the depth model failed'));
        else c.resolve(ev.data);
      };
      w.onerror = (ev) => {
        ev.preventDefault();
        this.fail(new Error(ev.message || 'The depth model did not start'));
      };
      this.w = w;
      try {
        await this.call('load', { parts }, parts);
      } catch (e) {
        this.release();
        throw e;
      }
      if (gen !== this.gen) throw new Error('The depth model was put away while it loaded');
    })().finally(() => {
      this.loading = null;
    });
    return this.loading;
  }

  /** The depth of a picture (any size: it is scaled to the model's 518-px short side here). */
  async run(src: CanvasImageSource, size: { w: number; h: number }): Promise<RawDepth> {
    if (!this.w) throw new Error('The depth model is not loaded');
    if (this.busy) throw new Error('Still working out the last picture');
    this.busy = true;
    try {
      const inp = inputSize(size.w, size.h);
      const c = document.createElement('canvas');
      c.width = inp.w;
      c.height = inp.h;
      const g = c.getContext('2d', { willReadFrequently: true });
      if (!g) throw new Error('No canvas here');
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.drawImage(src, 0, 0, size.w, size.h, 0, 0, inp.w, inp.h);
      const input = toInput(g.getImageData(0, 0, inp.w, inp.h).data, inp.w, inp.h);
      const t0 = performance.now();
      const out = await this.call('run', { input, dims: [1, 3, inp.h, inp.w] }, [input.buffer]);
      if (!out.data) throw new Error('The depth model gave no answer');
      const dims = out.dims ?? [1, inp.h, inp.w];
      return { data: out.data, h: dims[dims.length - 2]!, w: dims[dims.length - 1]!, ms: performance.now() - t0 };
    } finally {
      this.busy = false;
    }
  }

  /** Free everything (leaving MEASURE): the worker, the runtime's memory, the model. */
  release(): void {
    this.gen++;
    const w = this.w;
    this.w = null;
    this.loading = null;
    this.busy = false;
    w?.terminate();
    this.fail(new Error('The depth model was put away'));
  }
}

/** The one depth model the Lens and the planner use. */
export const depthModel = new DepthModel();
