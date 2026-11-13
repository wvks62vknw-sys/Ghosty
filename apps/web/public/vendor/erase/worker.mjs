// Ghosty's the erase model (an inpainting model): ONNX Runtime Web (the same copy the namer and the depth model use, from ../clip) runs it here, in its own
// thread, so that putting it away can end this worker and give the runtime's WebAssembly memory back. The page talks to it
// with two plain messages (src/photo/model.ts):
//   { id, op: 'load', parts: ArrayBuffer[] }      the model file, in its parts (moved here, joined here)
//   { id, op: 'run', feeds: { name: { data: Float32Array, dims } } }   one run -> { data, dims } (the model's first output)
// Every answer carries the request's id: { id, t: 'done', ... } or { id, t: 'error', message }.
import * as ort from '../clip/ort.wasm.min.mjs';

// one thread: iOS has no shared memory for a page that is not cross-origin isolated
ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;
ort.env.wasm.wasmPaths = new URL('../clip/', import.meta.url).href;

let session = null;

const post = (m, transfer) => self.postMessage(m, transfer || []);

self.onmessage = async (ev) => {
  const m = ev.data || {};
  try {
    if (m.op === 'load') {
      if (!session) {
        const parts = (m.parts || []).map((b) => new Uint8Array(b));
        const total = parts.reduce((s, p) => s + p.byteLength, 0);
        const bytes = new Uint8Array(total);
        let at = 0;
        for (const p of parts) {
          bytes.set(p, at);
          at += p.byteLength;
        }
        session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
      }
      post({ id: m.id, t: 'done', inputs: session.inputNames });
    } else if (m.op === 'run') {
      if (!session) throw new Error('the model is not loaded');
      const feeds = {};
      for (const [k, v] of Object.entries(m.feeds || {})) feeds[k] = new ort.Tensor('float32', v.data, v.dims);
      const out = await session.run(feeds);
      const d = out[session.outputNames[0]];
      if (!d) throw new Error('The model gave no answer');
      const data = Float32Array.from(d.data);
      post({ id: m.id, t: 'done', data, dims: d.dims }, [data.buffer]);
    }
  } catch (e) {
    post({ id: m.id, t: 'error', message: String((e && e.message) || e).slice(0, 400) });
  }
};
