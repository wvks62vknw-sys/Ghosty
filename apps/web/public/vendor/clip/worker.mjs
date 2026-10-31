// Ghosty's namer (Lens NAME, src/vision/clip.ts): ONNX Runtime Web and MobileCLIP-S0's picture
// encoder run here, in their own thread, so that leaving NAME can end this worker and with it the
// runtime's WebAssembly memory (a WebAssembly memory never shrinks, and a module imported by the
// page stays loaded for the page's whole life). The page talks to it with a few plain messages:
//   { id, op: 'load', model: ArrayBuffer }        start a session on the encoder (the bytes are moved here)
//   { id, op: 'run', input: Float32Array, dims }   one picture (CHW, 0-1) -> { data: Float32Array } (the vector)
// Every answer carries the request's id: { id, t: 'done', ... } or { id, t: 'error', message }.
import * as ort from './ort.wasm.min.mjs';

// The shared memory's maximum: 1 GB, not the stock 4 GB, which WebKit must reserve up front and refuses on an iPhone when
// another runtime holds memory too ("no available backend found … RangeError: Out of memory"); the encoder needs well
// under 1 GB. ./ort-wasm-simd-threaded.mjs reads this (our one-line change there, see README.md).
globalThis.GHOSTY_WASM_MAX_PAGES = 16384;

// one thread: iOS has no shared memory for a page that is not cross-origin isolated
ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;
// The glue is asked for by a fresh address (?v=2): the service worker keeps vendored files cache-first, and a phone that
// already held the stock glue would otherwise go on using it. The 14 MB .wasm is unchanged and keeps its address and cache.
const HERE = new URL('./', import.meta.url).href;
ort.env.wasm.wasmPaths = { mjs: `${HERE}ort-wasm-simd-threaded.mjs?v=2`, wasm: `${HERE}ort-wasm-simd-threaded.wasm` };

let session = null;

const post = (m, transfer) => self.postMessage(m, transfer || []);

self.onmessage = async (ev) => {
  const m = ev.data || {};
  try {
    if (m.op === 'load') {
      if (!session) session = await ort.InferenceSession.create(new Uint8Array(m.model), { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
      post({ id: m.id, t: 'done' });
    } else if (m.op === 'run') {
      if (!session) throw new Error('the namer is not loaded');
      const input = new ort.Tensor('float32', m.input, m.dims);
      const out = await session.run({ [session.inputNames[0] || 'pixel_values']: input });
      const emb = out[session.outputNames[0] || 'image_embeds'];
      if (!emb) throw new Error('The namer gave no answer');
      const data = Float32Array.from(emb.data);
      post({ id: m.id, t: 'done', data }, [data.buffer]);
    }
  } catch (e) {
    post({ id: m.id, t: 'error', message: String((e && e.message) || e).slice(0, 400) });
  }
};
