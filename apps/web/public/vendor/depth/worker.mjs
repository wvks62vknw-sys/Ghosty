// Ghosty's depth model (MEASURE's AUTO scale, src/measure/depth.ts): ONNX Runtime Web — the same
// copy the namer uses, from ../clip — and Depth Anything V2 Metric Indoor Small run here, in their
// own thread, so that leaving MEASURE can end this worker and give the runtime's WebAssembly memory
// back (it never shrinks otherwise). The page talks to it with a few plain messages:
//   { id, op: 'load', parts: ArrayBuffer[] }       the model file, in its parts (moved here, joined here)
//   { id, op: 'run', input: Float32Array, dims }   one picture (1×3×H×W, normalised) -> { data, dims } (metres as the model thinks)
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
      post({ id: m.id, t: 'done' });
    } else if (m.op === 'run') {
      if (!session) throw new Error('the depth model is not loaded');
      const input = new ort.Tensor('float32', m.input, m.dims);
      const out = await session.run({ [session.inputNames[0] || 'pixel_values']: input });
      const d = out[session.outputNames[0] || 'predicted_depth'];
      if (!d) throw new Error('The depth model gave no answer');
      const data = Float32Array.from(d.data);
      post({ id: m.id, t: 'done', data, dims: d.dims }, [data.buffer]);
    }
  } catch (e) {
    post({ id: m.id, t: 'error', message: String((e && e.message) || e).slice(0, 400) });
  }
};
