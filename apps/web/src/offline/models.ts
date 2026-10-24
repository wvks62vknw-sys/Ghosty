/**
 * The offline brain's models (offline/brain.ts), each pinned to one Hugging Face commit: the
 * weights, tokenizer and chat settings the phone downloads are exactly the ones this app was built
 * against (the compiled model code in public/vendor/webllm/libs), never whatever the repository's
 * main branch holds that day. Pure, so apps/edge/test/offline-brain.test.mjs can check the pins.
 * A new revision means a new download for the owner: change `rev` together with the libs.
 */

import { baseById, DEFAULT_BASE, weightsBase, type BaseId } from '../../../../packages/shared/src/selftrain';

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
  /** Which base model it is (packages/shared/src/selftrain.ts BRAIN_BASES; absent: Qwen3 0.6B or its stand-in). */
  brain?: BaseId;
  /** The context window the phone gives it (tokens; 2,048 when absent) and WebLLM's max_history_size, for the Qwen3.5 builds. */
  ctx?: number;
  history?: number;
}

/** The Qwen3 model first; the smaller Qwen2.5 one when a phone can't hold it. Both Apache-2.0. */
export const MODELS: ModelDef[] = [
  { id: 'Qwen3-0.6B-q4f16_1-MLC', label: 'Qwen3 0.6B', repo: 'mlc-ai/Qwen3-0.6B-q4f16_1-MLC', rev: '8c14ce481d4c692769976ad52afea453a102df19', lib: 'Qwen3-0.6B-q4f16_1_cs1k-webgpu.wasm', mb: 352, vram: 1403.34 },
  { id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', label: 'Qwen2.5 0.5B', repo: 'mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC', rev: '32ff081fe7e4dfe4ffb167b94c66fdf11e02b8ad', lib: 'Qwen2-0.5B-Instruct-q4f16_1_cs1k-webgpu.wasm', mb: 290, vram: 944.62 },
];

/**
 * The bigger brains he can try (SETTINGS → OFFLINE BRAIN): Qwen3.5 2B and 4B (Apache-2.0), exactly as WebLLM 0.2.85's
 * own list names them (model id, compiled library from binary-mlc-llm-libs `web-llm-models/v0_2_84/base`, memory
 * needed, and its overrides for these models: a 4,096-token context and `max_history_size` 1, since three layers in
 * four keep a running state rather than a cache), each pinned to the one commit their repos have had since they were
 * uploaded (checked 24 Oct 2026). `mb` is what the phone fetches: every weight shard, the tokenizer and the config
 * (1,082,390,739 and 2,390,258,276 bytes); `vram` is WebLLM's own figure for the memory it needs when running.
 */
export const BIGGER: ModelDef[] = [
  { id: 'Qwen3.5-2B-q4f16_1-MLC', label: 'Qwen3.5 2B', repo: 'mlc-ai/Qwen3.5-2B-q4f16_1-MLC', rev: 'dd74e9c8a20c4546df85c844103bff87b6dcacad', lib: 'Qwen3.5-2B-q4f16_1_cs1k-webgpu.wasm', mb: 1082, vram: 2245.44, brain: 'qwen3.5-2b', ctx: 4096, history: 1 },
  { id: 'Qwen3.5-4B-q4f16_1-MLC', label: 'Qwen3.5 4B', repo: 'mlc-ai/Qwen3.5-4B-q4f16_1-MLC', rev: '44b42469f9e192814bfd90440e3b377d89ba7a13', lib: 'Qwen3.5-4B-q4f16_1_cs1k-webgpu.wasm', mb: 2390, vram: 3867.82, brain: 'qwen3.5-4b', ctx: 4096, history: 1 },
];

/** The brains the picker offers, smallest first: today's Qwen3 0.6B (also the fallback), then the bigger ones. */
export const PICKER: ModelDef[] = [MODELS[0]!, ...BIGGER];

/** Which base a model is (a stock one, a bigger one, or a trained week of either); the Qwen2.5 stand-in counts as the 0.6B. */
export const brainOf = (m: Pick<ModelDef, 'brain'>): BaseId => m.brain ?? DEFAULT_BASE;

/** The stock phone build of a base (Qwen3 0.6B for an unknown one). */
export const stockOf = (id: BaseId | undefined): ModelDef => PICKER.find((m) => brainOf(m) === id) ?? MODELS[0]!;

/** The owner's phone: an iPhone 18 Pro Max, 12 GB. Safari does not say how much memory a phone has; Chrome does (at most 8). */
export const PHONE_GB = 12;

/**
 * Whether a brain fits, from the memory it needs when running (`vram`, MB) and the device's memory (GB): "yes" up to a
 * quarter of it, "tight" up to 40 %, else "no". A rule of thumb, not a measurement: iOS gives a web page's graphics
 * work well under the phone's whole memory (the system, Safari and the other apps keep theirs), and closes the page
 * when it asks for too much — so the real test is loading it on the phone (TEST).
 */
export function fitOf(vramMB: number, ramGB: number): 'yes' | 'tight' | 'no' {
  if (!(ramGB > 0) || !(vramMB > 0)) return 'no';
  const share = vramMB / (ramGB * 1024);
  return share <= 0.25 + 1e-9 ? 'yes' : share <= 0.4 + 1e-9 ? 'tight' : 'no';
}

/** "fits an 18 Pro Max: yes" (the phone's known 12 GB), or "fits this device (8 GB): tight" when the browser says how much it has. */
export function fitLine(m: Pick<ModelDef, 'vram'>, deviceGB?: number | null): string {
  const known = typeof deviceGB === 'number' && deviceGB > 0;
  const fit = fitOf(m.vram, known ? deviceGB : PHONE_GB);
  return known ? `fits this device (${deviceGB} GB): ${fit}` : `fits an 18 Pro Max: ${fit}`;
}

/** A size for the owner: "352 MB" under a gigabyte, else "1.1 GB" (MB as the files are counted: 1,000,000 bytes). */
export const sizeText = (mb: number): string => (mb < 1000 ? `${Math.round(mb)} MB` : `${(mb / 1000).toFixed(1)} GB`);
/** Memory when running, from WebLLM's MB (1,048,576 bytes): "1.4 GB". */
export const memText = (vramMB: number): string => `${(vramMB / 1024).toFixed(1)} GB`;

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
  /** The base it was trained on (absent: Qwen3 0.6B). */
  base?: BaseId;
}

/**
 * The trained models as model definitions: each is its base (Qwen3-0.6B, or the bigger one chosen in SETTINGS)
 * fine-tuned and quantised to q4f16_1 in exactly that base's stock build's layout (the notebook checks every tensor's
 * name, shape and type against it), so it runs on the same compiled model library and needs the same memory. Its files come through Ghosty: `origin` + `weights`
 * (`/api/w/<capability>/` from the brain) + `resolve/<commit>/`. A bad entry (not a full commit), or no weight
 * address, leaves it out.
 */
export function trainedModels(list: TrainedModel[], origin = '', weights: string | null = null): ModelDef[] {
  if (!weights || !/^\/api\/w\/[0-9a-f]{48}\/$/.test(weights)) return [];
  return list
    .filter((m) => /^[\w.-]+\/[\w.-]+$/.test(m.repo) && /^[0-9a-f]{40}$/.test(m.commit) && Number.isInteger(m.week))
    .map((m) => {
      const stock = stockOf(m.base && baseById(m.base).id === m.base ? m.base : DEFAULT_BASE);
      const def: ModelDef = { id: `Ghosty-week-${m.week}-${m.commit.slice(0, 7)}`, label: `Ghosty (week ${m.week})`, repo: m.repo, rev: m.commit, base: weightsBase(origin, weights, m.commit), lib: stock.lib, mb: stock.mb, vram: stock.vram };
      // (a week of a bigger base runs on that base's library, context and history; one of the 0.6B is as it always was)
      return stock.brain ? { ...def, brain: stock.brain, ...(stock.ctx ? { ctx: stock.ctx } : {}), ...(stock.history ? { history: stock.history } : {}) } : def;
    });
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
/** …and the bigger brains the picker offers: every model the offline brain may load. */
export const brainModels = (trained: TrainedModel[], origin = '', weights: string | null = null): ModelDef[] => [...allModels(trained, origin, weights), ...BIGGER];

/**
 * The revision of our own worker (public/vendor/webllm/worker.mjs, whose first line says the same): part of
 * its address, so a phone whose service worker kept an older copy fetches the new one. Bump both together.
 */
export const WORKER_REV = '3';
