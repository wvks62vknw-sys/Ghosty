// Ghosty's face embedder (Lens PEOPLE, src/vision/faces.ts): ONNX Runtime Web (the NAME mode's runtime, ../clip/) and
// SFace (a MobileFaceNet, int8) run here, in their own thread, so that leaving PEOPLE can end this worker and with it the
// runtime's WebAssembly memory. It takes pixels the page drew from the live camera and gives back 128 numbers; it has no
// network of its own and nothing here is kept. The page talks to it with two plain messages:
//   { id, op: 'load', model: ArrayBuffer }   start a session on the model (the bytes are moved here)
//   { id, op: 'run', input: Float32Array }   one aligned face, 1×3×112×112 (RGB, 0–255) -> { data: Float32Array(128) }
// Every answer carries the request's id: { id, t: 'done', ... } or { id, t: 'error', message }.
import * as ort from '../clip/ort.wasm.min.mjs';

// The runtime's WebAssembly memory is shared (the build is the threaded one, run on one thread), and WebKit reserves its
// whole maximum up front: the stock 4 GB fails on an iPhone with "no available backend found … RangeError: Out of memory"
// once another runtime (the vision models', in the page) holds memory too. The page passes the cap in this worker's
// address (?maxPages=, 64 KB pages: 16384 = 1 GB first, 4096 = 256 MB on the retry; SFace needs about 50 MB);
// ../clip/ort-wasm-simd-threaded.mjs reads GHOSTY_WASM_MAX_PAGES (our one-line change there, see ../clip/README.md).
globalThis.GHOSTY_WASM_MAX_PAGES = Number(new URL(self.location.href).searchParams.get('maxPages')) || 16384;

// one thread: iOS has no shared memory for a page that is not cross-origin isolated
ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;
// The glue is asked for by a fresh address (?v=2): the service worker keeps vendored files cache-first, and a phone that
// already held the stock glue would otherwise go on using it. The 14 MB .wasm is unchanged and keeps its address and cache.
const CLIP = new URL('../clip/', import.meta.url).href;
ort.env.wasm.wasmPaths = { mjs: `${CLIP}ort-wasm-simd-threaded.mjs?v=2`, wasm: `${CLIP}ort-wasm-simd-threaded.wasm` };
// (the model keeps its batch-norm numbers as graph inputs: the runtime says so at every load, which is not a problem)
ort.env.logLevel = 'error';

let session = null;

const post = (m, transfer) => self.postMessage(m, transfer || []);

self.onmessage = async (ev) => {
  const m = ev.data || {};
  try {
    if (m.op === 'load') {
      if (!session) session = await ort.InferenceSession.create(new Uint8Array(m.model), { executionProviders: ['wasm'], graphOptimizationLevel: 'all', logSeverityLevel: 3 });
      post({ id: m.id, t: 'done' });
    } else if (m.op === 'run') {
      if (!session) throw new Error('the face model is not loaded');
      const input = new ort.Tensor('float32', m.input, [1, 3, 112, 112]);
      const out = await session.run({ [session.inputNames[0] || 'data']: input });
      const emb = out[session.outputNames[0] || 'fc1'];
      if (!emb) throw new Error('The face model gave no answer');
      const data = Float32Array.from(emb.data);
      post({ id: m.id, t: 'done', data }, [data.buffer]);
    }
  } catch (e) {
    post({ id: m.id, t: 'error', message: String((e && e.message) || e).slice(0, 400) });
  }
};
