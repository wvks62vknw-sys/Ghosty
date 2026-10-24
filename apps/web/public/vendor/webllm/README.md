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
| `libs/snowflake-arctic-embed-s-q0f32-ctx512_cs512_batch4-webgpu.wasm` | the compiled code for SEARCH BY MEANING's model, snowflake-arctic-embed-s (q0f32, at most 4 texts a step, 512 word-pieces each) | binary-mlc-llm-libs `web-llm-models/v0_2_84/base` (the version 0.2.85's prebuilt config names), fetched 2026-10-24, sha256 `d5aa59dd…9907df5` | Apache-2.0 | 3.7 MB |

Weights (not vendored): `mlc-ai/Qwen3-0.6B-q4f16_1-MLC` (≈352 MB) and `mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC`
(≈290 MB) on Hugging Face, Apache-2.0 (Qwen). Each is pinned to one commit in `src/offline/models.ts`, so the
weights, tokenizer and chat settings (`mlc-chat-config.json`) are always the files these libs were checked
with, never whatever the repository's main branch holds that day:

| Model | Hugging Face commit (checked 2026-10-17) |
| --- | --- |
| `mlc-ai/Qwen3-0.6B-q4f16_1-MLC` | `8c14ce481d4c692769976ad52afea453a102df19` |
| `mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC` | `32ff081fe7e4dfe4ffb167b94c66fdf11e02b8ad` |
| `mlc-ai/snowflake-arctic-embed-s-q0f32-MLC` (search by meaning, 67 MB: two 33 MB shards, tokenizer, config; checked 2026-10-24) | `1b36afd513686bb633823b39a73fd685cebe4b0c` |

The page passes `https://huggingface.co/<repo>/resolve/<commit>/` as the model's address; WebLLM's
`cleanModelUrl` keeps an address that names a revision (it adds `resolve/main/` only to a bare one).
Moving to a new commit means a new download for the owner (older files are removed after it): change
`rev` together with the libs above and re-run TEST on a phone.

One change to the upstream file: the last line of `lib/index.js` (`//# sourceMappingURL=index.js.map`) is
removed, since the 7 MB source map is not shipped. Every file is far under Cloudflare's 25 MiB limit.

Needs WebGPU with 16-bit shaders (`shader-f16`): on iPhone, iOS 26 or newer. Elsewhere the panel says why
it can't run, and Ghosty answers as before (the cloud brain, then the library copy on the phone).

Trained weeks (`src/offline/models.ts` `trainedModels`): the weekly self-training (apps/edge/src/selftrain,
training/kaggle) publishes Qwen3-0.6B fine-tuned for the owner as q4f16_1 weights in exactly the stock files'
layout (every tensor's name, shape and type from the stock `tensor-cache.json`; the writer reproduces mlc-ai's
own shards bit for bit from the base weights), with the stock `mlc-chat-config.json` and tokenizer files, to the
owner's own PRIVATE Hugging Face model repo. So `libs/Qwen3-0.6B-q4f16_1_cs1k-webgpu.wasm` runs them unchanged
and no new compiled code is vendored. Because the repo is private (the brain learned from the owner's library
and chats), the phone never fetches it directly: WebLLM is given `https://<ghosty>/api/w/<capability>/resolve/<commit>/`
(same origin: `connect-src 'self'`), the brain fetches each file with the owner's token, streams the small ones
and answers the large ones with Hugging Face's short-lived signed CDN address (`*.hf.co`, already in
`connect-src`). No new host in the security policy. `pruneOtherRevisions` treats `/api/w/…` files like
huggingface.co ones, and only after a download has finished; an interrupted download keeps every file.

SEARCH BY MEANING (`src/offline/embed.ts`, `src/library/meaning.ts`): the same runtime runs a small embedding model,
snowflake-arctic-embed-s (Apache-2.0, English-first, 384 numbers a text), in a second worker of its own (`worker.mjs`
`embed`: WebLLM's own `engine.embeddings.create`, in this 0.2.85 build). Its maths is 32-bit, so it needs WebGPU
but not `shader-f16`. Downloaded only when the owner presses ADD in SETTINGS → OFFLINE BRAIN (about 70 MB, on Wi-Fi),
kept in the same `webllm/*` stores; the brain's own clean-ups (`pruneOtherRevisions`, DELETE, the too-big fallback)
leave its files alone, and REMOVE there removes only its files.
