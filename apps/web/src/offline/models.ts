/**
 * The offline brain's models (offline/brain.ts), each pinned to one Hugging Face commit: the
 * weights, tokenizer and chat settings the phone downloads are exactly the ones this app was built
 * against (the compiled model code in public/vendor/webllm/libs), never whatever the repository's
 * main branch holds that day. Pure, so apps/edge/test/offline-brain.test.mjs can check the pins.
 * A new revision means a new download for the owner: change `rev` together with the libs.
 */

import { weightsBase } from '../../../../packages/shared/src/selftrain';

export interface ModelDef {
  id: string;
  label: string;
  /** The Hugging Face repository ("mlc-ai/…"). */
  repo: string;
  /** The commit the files come from (40 hex characters). */
  rev: string;
  lib: string;
  mb: number;
  vram: number;
  /** Where its files are, when not on huggingface.co (a trained week: through Ghosty; see modelBase). */
  base?: string;
}

/** The Qwen3 model first; the smaller Qwen2.5 one when a phone can't hold it. Both Apache-2.0. */
export const MODELS: ModelDef[] = [
  { id: 'Qwen3-0.6B-q4f16_1-MLC', label: 'Qwen3 0.6B', repo: 'mlc-ai/Qwen3-0.6B-q4f16_1-MLC', rev: '8c14ce481d4c692769976ad52afea453a102df19', lib: 'Qwen3-0.6B-q4f16_1_cs1k-webgpu.wasm', mb: 352, vram: 1403.34 },
  { id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', label: 'Qwen2.5 0.5B', repo: 'mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC', rev: '32ff081fe7e4dfe4ffb167b94c66fdf11e02b8ad', lib: 'Qwen2-0.5B-Instruct-q4f16_1_cs1k-webgpu.wasm', mb: 290, vram: 944.62 },
];

/**
 * SEARCH BY MEANING (offline/embed.ts, library/meaning.ts): a small model that turns a passage or a question into a
 * list of 384 numbers, so passages that mean the same thing sit close together even when their words differ.
 * snowflake-arctic-embed-s (Apache-2.0, English-first), the "-b4" build from WebLLM 0.2.85's own list (four texts
 * at a time, the least memory: about 240 MB of graphics memory). 32-bit maths, so it needs WebGPU but not the
 * 16-bit shaders the brain needs. Its files: 67 MB of weights and tokenizer from Hugging Face at this commit, plus
 * its 3.7 MB compiled code served from this site; "about 70 MB" to the owner.
 */
export const EMBED_MODEL: ModelDef = { id: 'snowflake-arctic-embed-s-q0f32-MLC-b4', label: 'Search by meaning', repo: 'mlc-ai/snowflake-arctic-embed-s-q0f32-MLC', rev: '1b36afd513686bb633823b39a73fd685cebe4b0c', lib: 'snowflake-arctic-embed-s-q0f32-ctx512_cs512_batch4-webgpu.wasm', mb: 70, vram: 238.71 };
/** How long its vectors are. */
export const EMBED_DIMS = 384;
/**
 * The arctic-embed models are trained with this before a question (never before a passage): without it a question
 * lands nearer to other questions than to the passages that answer it.
 */
export const QUERY_PREFIX = 'Represent this sentence for searching relevant passages: ';

/**
 * Where a model's files are, at its pinned commit, ending in "/". WebLLM keeps a URL that already
 * names `/resolve/<x>/` as it is (it adds `resolve/main/` only to a bare repository URL), and it
 * stores each file in its cache under this base, so the check that the download is whole uses it too.
 * A trained week has its own `base`: Ghosty's weight address (`/api/w/<cap>/resolve/<commit>/`), since its
 * Hugging Face repo is private and only the brain may fetch it.
 */
export const modelBase = (m: Pick<ModelDef, 'repo' | 'rev'> & { base?: string }): string => m.base ?? `https://huggingface.co/${m.repo}/resolve/${m.rev}/`;

/** A model the weekly self-training kept (apps/edge/src/selftrain): the brain's list, as the phone keeps it. */
export interface TrainedModel {
  week: number;
  label: string;
  repo: string;
  commit: string;
}

/**
 * The trained models as model definitions: each is Qwen3-0.6B fine-tuned and quantised to q4f16_1 in exactly
 * the stock build's layout (the notebook checks every tensor's name, shape and type against it), so it runs on
 * the same compiled model library and needs the same memory. Its files come through Ghosty: `origin` + `weights`
 * (`/api/w/<capability>/` from the brain) + `resolve/<commit>/`. A bad entry (not a full commit), or no weight
 * address, leaves it out.
 */
export function trainedModels(list: TrainedModel[], origin = '', weights: string | null = null): ModelDef[] {
  const stock = MODELS[0]!;
  if (!weights || !/^\/api\/w\/[0-9a-f]{48}\/$/.test(weights)) return [];
  return list
    .filter((m) => /^[\w.-]+\/[\w.-]+$/.test(m.repo) && /^[0-9a-f]{40}$/.test(m.commit) && Number.isInteger(m.week))
    .map((m) => ({ id: `Ghosty-week-${m.week}-${m.commit.slice(0, 7)}`, label: `Ghosty (week ${m.week})`, repo: m.repo, rev: m.commit, base: weightsBase(origin, weights, m.commit), lib: stock.lib, mb: stock.mb, vram: stock.vram }));
}

/**
 * What a failed DOWNLOAD was: `network` (the connection dropped, a time-out, a server blip — what was fetched stays
 * in the cache and DOWNLOAD carries on from there), `too-big` (the phone's memory or graphics gave out: try the
 * smaller model), or `broken` (the files themselves are wrong or gone: only then is that model's download removed).
 */
export function downloadFailure(e: unknown): 'network' | 'too-big' | 'broken' {
  const msg = String((e as Error)?.message ?? e);
  if (/memory|device (?:was )?lost|allocat|exceed|out of|OOM|buffer size/i.test(msg)) return 'too-big';
  if (e instanceof TypeError || /network|failed to fetch|load failed|fetch failed|connection|offline|timed? ?out|timeout|aborted|interrupted|\b50[0234]\b|ERR_/i.test(msg)) return 'network';
  return 'broken';
}

/** Every model the phone can use: the trained ones first (newest first), then the stock models as the fallback. */
export const allModels = (trained: TrainedModel[], origin = '', weights: string | null = null): ModelDef[] => [...trainedModels(trained, origin, weights), ...MODELS];

/**
 * The revision of our own worker (public/vendor/webllm/worker.mjs, whose first line says the same): part of
 * its address, so a phone whose service worker kept an older copy fetches the new one. Bump both together.
 */
export const WORKER_REV = '3';
