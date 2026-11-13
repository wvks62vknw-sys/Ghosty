/**
 * A MODEL IN ITS OWN WORKER (BRIEF-EDITOR-PHOTO-2): the cut-out model and the erase model run through the ONNX runtime already
 * vendored under public/vendor/clip, each in a worker of its own (public/vendor/cutout/worker.mjs, public/vendor/erase/worker.mjs) so that
 * putting the model away ends the worker, which is the only way to give the runtime's WebAssembly memory back. The model's file comes
 * from the phone's own pack when he has kept it (offline/eyes.ts), else from this site; it is fetched in its parts and joined in the worker.
 * Nothing here talks to anywhere but this site, and what goes in (a copy of his photo) never leaves the phone.
 */
import { kept } from '../offline/eyes';
import { simdSupported } from '../vision/models';

export interface ModelCfg {
  /** How the lines say it: "the cut-out model". */
  name: string;
  worker: string;
  parts: string[];
  /** The model's bytes, for the progress line. */
  bytes: number;
}

type Reply = { id: number; t: 'done' | 'error'; message?: string; data?: Float32Array; dims?: number[] };
export interface Feed {
  data: Float32Array;
  dims: number[];
}

async function fetchPart(url: string, onBytes: (n: number) => void, signal: AbortSignal, name: string): Promise<ArrayBuffer> {
  const own = await kept(url);
  const r = own ?? (await fetch(url, { signal }));
  if (!r.ok) throw new Error(`I could not load ${name} (the server said ${r.status}).`);
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

export class ModelWorker {
  private w: Worker | null = null;
  private seq = 0;
  private calls = new Map<number, { resolve: (r: Reply) => void; reject: (e: Error) => void }>();
  private loading: Promise<void> | null = null;
  private abort: AbortController | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private gen = 0;
  constructor(readonly cfg: ModelCfg) {}

  get ready(): boolean {
    return !!this.w && !this.loading;
  }

  private call(op: string, payload: Record<string, unknown>, transfer: Transferable[] = []): Promise<Reply> {
    const w = this.w;
    if (!w) return Promise.reject(new Error(`${this.cfg.name} was put away`));
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

  /** Load it (once): `say` hears "getting the cut-out model 40%" and then "starting the cut-out model". */
  load(say: (words: string, frac?: number) => void): Promise<void> {
    if (this.w && !this.loading) return Promise.resolve();
    if (this.loading) return this.loading;
    const ac = new AbortController();
    this.abort = ac;
    const p: Promise<void> = (async () => {
      if (typeof WebAssembly !== 'object' || typeof Worker === 'undefined' || !simdSupported()) throw new Error(`This phone cannot run ${this.cfg.name} (it needs WebAssembly with SIMD: iOS 16.4 or newer).`);
      const gen = this.gen;
      let got = 0;
      let said = 0;
      say(`opening ${this.cfg.name}…`, 0);
      const parts = await Promise.all(
        this.cfg.parts.map((u) =>
          fetchPart(
            u,
            (n) => {
              got += n;
              if (got - said > 512 * 1024) {
                said = got;
                say(`opening ${this.cfg.name} ${Math.min(99, Math.round((got / this.cfg.bytes) * 100))}%`, Math.min(1, got / this.cfg.bytes));
              }
            },
            ac.signal,
            this.cfg.name,
          ),
        ),
      );
      if (gen !== this.gen) throw new Error(`${this.cfg.name} was put away while it opened`);
      say(`starting ${this.cfg.name}…`);
      const w = new Worker(this.cfg.worker, { type: 'module' });
      w.onmessage = (ev: MessageEvent<Reply>) => {
        const c = this.calls.get(ev.data.id);
        if (!c) return;
        this.calls.delete(ev.data.id);
        if (ev.data.t === 'error') c.reject(new Error(ev.data.message ?? `${this.cfg.name} failed`));
        else c.resolve(ev.data);
      };
      w.onerror = (ev) => {
        ev.preventDefault();
        this.fail(new Error(ev.message || `${this.cfg.name} did not start`));
      };
      this.w = w;
      try {
        await this.call('load', { parts }, parts);
      } catch (e) {
        this.release();
        throw e;
      }
      if (gen !== this.gen) throw new Error(`${this.cfg.name} was put away while it opened`);
    })().finally(() => {
      if (this.loading === p) this.loading = null;
      if (this.abort === ac) this.abort = null;
    });
    this.loading = p;
    return p;
  }

  /** One run; a second waits for the first. Returns the model's first output. */
  run(feeds: Record<string, Feed>): Promise<{ data: Float32Array; dims: number[]; ms: number }> {
    const next = this.queue.then(
      () => this.runNow(feeds),
      () => this.runNow(feeds),
    );
    this.queue = next.catch(() => undefined);
    return next;
  }
  private async runNow(feeds: Record<string, Feed>): Promise<{ data: Float32Array; dims: number[]; ms: number }> {
    if (!this.w) throw new Error(`${this.cfg.name} is not loaded`);
    const t0 = performance.now();
    const r = await this.call('run', { feeds });
    if (!r.data || !r.dims) throw new Error(`${this.cfg.name} gave no answer`);
    return { data: r.data, dims: r.dims, ms: performance.now() - t0 };
  }

  /** Put it away: ends the worker, which gives the runtime's memory back. */
  release(): void {
    this.gen++;
    this.abort?.abort();
    this.abort = null;
    this.loading = null;
    this.fail(new Error(`${this.cfg.name} was put away`));
    this.w?.terminate();
    this.w = null;
  }
}
