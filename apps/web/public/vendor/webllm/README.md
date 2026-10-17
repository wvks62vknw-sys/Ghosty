# The offline brain's runtime (vendored)

A small language model that runs on the phone itself (`src/offline/brain.ts`). Fixed versions, served
from this site: the interface's security policy allows scripts, workers and WebAssembly from here only.
The model's weights are not ours to vendor: they come from Hugging Face the first time the owner presses
DOWNLOAD (`huggingface.co`, which redirects to its `*.hf.co` download hosts — both in `connect-src`) and the
browser keeps them in WebLLM's Cache API stores (`webllm/model`, `webllm/config`, `webllm/wasm`).

| File | What | Version / source | Licence | Size |
| --- | --- | --- | --- | --- |
| `web-llm.mjs` | WebLLM runtime, ESM build (`lib/index.js`; tokenizers and TVM runtime inside) | @mlc-ai/web-llm 0.2.85 (npm, 2026-09-08) | Apache-2.0 (`LICENSE`) | 6.6 MB |
| `worker.mjs` | ours: the Web Worker that holds `MLCEngine` and speaks a few plain messages to the page | — | as Ghosty | 3 KB |
| `libs/Qwen3-0.6B-q4f16_1_cs1k-webgpu.wasm` | the compiled model code for Qwen3-0.6B (q4f16_1) | binary-mlc-llm-libs `web-llm-models/v0_2_84/base` (the version 0.2.85's prebuilt config names) | Apache-2.0 | 5.5 MB |
| `libs/Qwen2-0.5B-Instruct-q4f16_1_cs1k-webgpu.wasm` | the same for Qwen2.5-0.5B-Instruct (the fallback when a phone can't hold Qwen3) | binary-mlc-llm-libs `web-llm-models/v0_2_84/base` | Apache-2.0 | 4.9 MB |

Weights (not vendored): `mlc-ai/Qwen3-0.6B-q4f16_1-MLC` (≈352 MB) and `mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC`
(≈290 MB) on Hugging Face, Apache-2.0 (Qwen).

One change to the upstream file: the last line of `lib/index.js` (`//# sourceMappingURL=index.js.map`) is
removed, since the 7 MB source map is not shipped. Every file is far under Cloudflare's 25 MiB limit.

Needs WebGPU with 16-bit shaders (`shader-f16`): on iPhone, iOS 26 or newer. Elsewhere the panel says why
it can't run, and Ghosty answers as before (the cloud brain, then the library copy on the phone).
