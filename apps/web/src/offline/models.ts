/**
 * The offline brain's models (offline/brain.ts), each pinned to one Hugging Face commit: the
 * weights, tokenizer and chat settings the phone downloads are exactly the ones this app was built
 * against (the compiled model code in public/vendor/webllm/libs), never whatever the repository's
 * main branch holds that day. Pure, so apps/edge/test/offline-brain.test.mjs can check the pins.
 * A new revision means a new download for the owner: change `rev` together with the libs.
 */

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
}

/** The Qwen3 model first; the smaller Qwen2.5 one when a phone can't hold it. Both Apache-2.0. */
export const MODELS: ModelDef[] = [
  { id: 'Qwen3-0.6B-q4f16_1-MLC', label: 'Qwen3 0.6B', repo: 'mlc-ai/Qwen3-0.6B-q4f16_1-MLC', rev: '8c14ce481d4c692769976ad52afea453a102df19', lib: 'Qwen3-0.6B-q4f16_1_cs1k-webgpu.wasm', mb: 352, vram: 1403.34 },
  { id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', label: 'Qwen2.5 0.5B', repo: 'mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC', rev: '32ff081fe7e4dfe4ffb167b94c66fdf11e02b8ad', lib: 'Qwen2-0.5B-Instruct-q4f16_1_cs1k-webgpu.wasm', mb: 290, vram: 944.62 },
];

/**
 * Where a model's files are, at its pinned commit, ending in "/". WebLLM keeps a URL that already
 * names `/resolve/<x>/` as it is (it adds `resolve/main/` only to a bare repository URL), and it
 * stores each file in its cache under this base, so the check that the download is whole uses it too.
 */
export const modelBase = (m: Pick<ModelDef, 'repo' | 'rev'>): string => `https://huggingface.co/${m.repo}/resolve/${m.rev}/`;
