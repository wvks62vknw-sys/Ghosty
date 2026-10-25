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
| `libs/Qwen3.5-0.8B-q4f16_1_cs1k-webgpu.wasm` | the same for Qwen3.5-0.8B (q4f16_1), the step between the 0.6B and the 2B | binary-mlc-llm-libs `web-llm-models/v0_2_84/base`, fetched 2026-10-24, sha256 `3dd8cff0…1348ae29` | Apache-2.0 | 6.2 MB |
| `libs/Qwen3.5-2B-q4f16_1_cs1k-webgpu.wasm` | the compiled model code for Qwen3.5-2B (q4f16_1), a bigger brain he can choose | binary-mlc-llm-libs `web-llm-models/v0_2_84/base` (the version 0.2.85's prebuilt config names), fetched 2026-10-24, sha256 `b0f951d4…98df912` | Apache-2.0 | 6.2 MB |
| `libs/Qwen3.5-4B-q4f16_1_cs1k-webgpu.wasm` | the same for Qwen3.5-4B (q4f16_1) | binary-mlc-llm-libs `web-llm-models/v0_2_84/base`, fetched 2026-10-24, sha256 `7e8f9895…0bdc904712` | Apache-2.0 | 6.5 MB |
| `libs/snowflake-arctic-embed-s-q0f32-ctx512_cs512_batch4-webgpu.wasm` | the compiled code for SEARCH BY MEANING's model, snowflake-arctic-embed-s (q0f32, at most 4 texts a step, 512 word-pieces each) | binary-mlc-llm-libs `web-llm-models/v0_2_84/base` (the version 0.2.85's prebuilt config names), fetched 2026-10-24, sha256 `d5aa59dd…9907df5` | Apache-2.0 | 3.7 MB |

Weights (not vendored): `mlc-ai/Qwen3-0.6B-q4f16_1-MLC` (≈352 MB) and `mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC`
(≈290 MB) on Hugging Face, Apache-2.0 (Qwen). Each is pinned to one commit in `src/offline/models.ts`, so the
weights, tokenizer and chat settings (`mlc-chat-config.json`) are always the files these libs were checked
with, never whatever the repository's main branch holds that day:

| Model | Hugging Face commit (checked 2026-10-17) |
| --- | --- |
| `mlc-ai/Qwen3-0.6B-q4f16_1-MLC` | `8c14ce481d4c692769976ad52afea453a102df19` |
| `mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC` | `32ff081fe7e4dfe4ffb167b94c66fdf11e02b8ad` |
| `mlc-ai/Qwen3.5-0.8B-q4f16_1-MLC` (447 MB fetched: 11 shards, tokenizer, config; the repo's only upload, checked 2026-10-24) | `0ec138972555613c1d7812a821778ad0398c8790` |
| `mlc-ai/Qwen3.5-2B-q4f16_1-MLC` (1,082 MB fetched: 31 shards, tokenizer, config; the repo's only upload, checked 2026-10-24) | `dd74e9c8a20c4546df85c844103bff87b6dcacad` |
| `mlc-ai/Qwen3.5-4B-q4f16_1-MLC` (2,390 MB fetched: 78 shards, tokenizer, config; the repo's only upload, checked 2026-10-24) | `44b42469f9e192814bfd90440e3b377d89ba7a13` |
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

BIGGER BRAINS (`src/offline/models.ts` `BIGGER`, SETTINGS → OFFLINE BRAIN's picker): Qwen3.5-2B and Qwen3.5-4B, exactly as
WebLLM 0.2.85's own prebuilt list has them (checked in this vendored `web-llm.mjs`, which is byte for byte npm's
`@mlc-ai/web-llm@0.2.85` `lib/index.js` without its source-map line, integrity `sha512-CwUiSAvD…L9rw==`): model ids
`Qwen3.5-2B-q4f16_1-MLC` / `Qwen3.5-4B-q4f16_1-MLC`, `vram_required_MB` 2245.44 / 3867.82, and its overrides
`context_window_size: 4096, max_history_size: 1` (Qwen3.5 keeps a running state in three layers of four). Both
libraries above were fetched from the address that list names (`raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/
web-llm-models/v0_2_84/base/`); the Qwen3-0.6B one fetched the same way on the same day is identical to the one vendored
here (sha256 `4db800b2…498df912`). Each picker brain is downloaded only when the owner asks (with its size, on Wi-Fi)
and stays in the `webllm/*` stores, so he can switch back without a new download; the 0.6B stays as the fallback when
a bigger one cannot get the memory it needs. The full hashes: Qwen3.5-2B
`b0f951d411e4fd59fe2af76be9328905ae30549e570a192a841c958b293ecd53`, Qwen3.5-4B
`7e8f9895daa710a83952efac4d5c6f36e9f89dc684b25022746d881bdc904712`.

THE MIDDLE BRAIN (24 Oct, after the 2B closed Ghosty on the 18 Pro Max while loading): Qwen3.5-0.8B, as the same list has
it (`vram_required_MB` 1629.49, the same overrides), library fetched from the same address, sha256
`3dd8cff049bf4599bfbb505880aea11ba95f85f3924b7e171f967d1f1348ae29`. The list's Qwen3-1.7B needs 2036.66 MB, so it was not
the step. Each library carries its memory plan (`memory_usage` in its metadata): the largest working space is 1,043 MB for
the 2B, 1,033 MB for the 0.8B and 635 MB for the 0.6B, which is why WebLLM's figure for the 2B (2,245 MB) is mostly weights
(1,010 MB) and working space, and a shorter context barely lowers it (`src/offline/models.ts` `memAt`).

GET fills these stores itself, one piece at a time, without loading anything (`src/offline/fill.ts`): the same store
names and keys WebLLM's `ArtifactCache` uses (`webllm/config` for `mlc-chat-config.json`, `webllm/model` for
`tensor-cache.json`, every shard and the tokenizer, `webllm/wasm` for the library, each keyed by its full URL), so a later
`reload` finds them all (`fetchTensorCacheInternal`'s `hasAllKeys` → cache only) and fetches nothing. That relies on
WebLLM 0.2.85's cache layout, not on any function it exports; a new WebLLM version means checking it again.
