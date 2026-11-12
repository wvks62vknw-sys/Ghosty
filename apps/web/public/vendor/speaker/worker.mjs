// Ghosty's voice model (SETTINGS → MY VOICE, assistant/speakermodel.ts): ONNX Runtime Web (the namer's runtime, ../clip/) and the
// voice model run here, in their own thread, so that ending this worker ends the runtime's WebAssembly memory. It takes the
// numbers the page made from a capture of the phone's microphone (frames of 80 filterbank values) and gives back 256 numbers that
// tell voices apart; it has no network of its own and nothing here is kept. The page talks to it with two plain messages:
//   { id, op: 'load', parts: ArrayBuffer[] }               start a session on the model (its parts, joined here as the depth worker joins its own)
//   { id, op: 'run', input: Float32Array, frames: number } frames x 80 filterbank values -> { data: Float32Array(256) }
// Every answer carries the request's id: { id, t: 'done', ... } or { id, t: 'error', message }.
import * as ort from '../clip/ort.wasm.min.mjs';

// The runtime's memory cap (64 KB pages) is passed in this worker's address (?maxPages=), as the face worker's is: 1 GB first,
// 256 MB on one retry, because an iPhone refuses the stock 4 GB shared reservation once another runtime holds memory.
globalThis.GHOSTY_WASM_MAX_PAGES = Number(new URL(self.location.href).searchParams.get('maxPages')) || 16384;

// one thread: iOS has no shared memory for a page that is not cross-origin isolated
ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;
const CLIP = new URL('../clip/', import.meta.url).href;
ort.env.wasm.wasmPaths = { mjs: `${CLIP}ort-wasm-simd-threaded.mjs?v=2`, wasm: `${CLIP}ort-wasm-simd-threaded.wasm` };
ort.env.logLevel = 'error';

let session = null;

const post = (m, transfer) => self.postMessage(m, transfer || []);

self.onmessage = async (ev) => {
  const m = ev.data || {};
  try {
    if (m.op === 'load') {
      if (!session) {
        const parts = (m.parts || []).map((b) => new Uint8Array(b));
        const bytes = new Uint8Array(parts.reduce((s, p) => s + p.byteLength, 0));
        let at = 0;
        for (const p of parts) {
          bytes.set(p, at);
          at += p.byteLength;
        }
        session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all', logSeverityLevel: 3 });
      }
      post({ id: m.id, t: 'done' });
    } else if (m.op === 'run') {
      if (!session) throw new Error('the voice model is not loaded');
      const input = new ort.Tensor('float32', m.input, [1, m.frames, 80]);
      const out = await session.run({ [session.inputNames[0] || 'feats']: input });
      const emb = out[session.outputNames[0] || 'embs'];
      if (!emb) throw new Error('The voice model gave no answer');
      const data = Float32Array.from(emb.data);
      post({ id: m.id, t: 'done', data }, [data.buffer]);
    }
  } catch (e) {
    post({ id: m.id, t: 'error', message: String((e && e.message) || e).slice(0, 400) });
  }
};
