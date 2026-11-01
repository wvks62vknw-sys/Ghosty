/**
 * The offline brain's models (offline/brain.ts), each pinned to one Hugging Face commit: the
 * weights, tokenizer and chat settings the phone downloads are exactly the ones this app was built
 * against (the compiled model code in public/vendor/webllm/libs), never whatever the repository's
 * main branch holds that day. Pure, so apps/edge/test/offline-brain.test.mjs can check the pins.
 * A new revision means a new download for the owner: change `rev` together with the libs.
 */

import { EXAM_SYSTEM } from '../../../../packages/shared/src/school';
import { baseById, DEFAULT_BASE, weightsBase, type BaseId } from '../../../../packages/shared/src/selftrain';
import { estimateTokens, type OfflineMsg } from './prompt';

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
  /**
   * The biggest single piece of its weights (bytes, from its tensor-cache.json): it must sit in the graphics chip in one
   * buffer, so a phone whose WebGPU hands out smaller buffers cannot run it at all (limitsProblem).
   */
  largest?: number;
  /**
   * WebLLM's memory figure without the cache (MB of 1,048,576 bytes): the weights plus the compiled library's largest
   * working space (its `memory_usage` metadata). `vram` is this plus the cache for 4,096 tokens (memAt).
   */
  work?: number;
  /** Not trained by the weekly training (its own picker slot; choosing it leaves the training's base as it was). */
  alone?: true;
}

/**
 * The Qwen3 model first; the smaller Qwen2.5 one when a phone can't hold it; and the floor, SmolLM2 360M, when neither
 * can (1 Nov: the 0.6B loaded on his 18 Pro Max and closed Ghosty at its first answer). Qwen Apache-2.0, SmolLM2 Apache-2.0.
 * The floor exactly as WebLLM 0.2.85's own list names it (model id, compiled library from binary-mlc-llm-libs
 * `web-llm-models/v0_2_84/base`, 376.06 MB needed at 4,096 tokens), pinned to its repo's last commit (3a622fd, Sept 2025,
 * which only added tensor-cache.json, the list this WebLLM reads; the weights are unchanged since Nov 2024). `mb` is all
 * GET fetches, as for the two above: seven shards, the list, the tokenizer, the config and the 5.7 MB library (211,553,449
 * bytes). Its weights (194 MB) and its library's largest working space (21.9 MB: a vocabulary of 49,152, against the Qwens'
 * 151,936) make `work`; the cache is 40 KB a token, so it runs in about 296 MB at the phone's 2,048 tokens.
 */
export const MODELS: ModelDef[] = [
  { id: 'Qwen3-0.6B-q4f16_1-MLC', label: 'Qwen3 0.6B', repo: 'mlc-ai/Qwen3-0.6B-q4f16_1-MLC', rev: '8c14ce481d4c692769976ad52afea453a102df19', lib: 'Qwen3-0.6B-q4f16_1_cs1k-webgpu.wasm', mb: 352, vram: 1403.34, largest: 77_791_232, work: 955.34 },
  { id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', label: 'Qwen2.5 0.5B', repo: 'mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC', rev: '32ff081fe7e4dfe4ffb167b94c66fdf11e02b8ad', lib: 'Qwen2-0.5B-Instruct-q4f16_1_cs1k-webgpu.wasm', mb: 290, vram: 944.62, largest: 68_067_328 },
  { id: 'SmolLM2-360M-Instruct-q4f16_1-MLC', label: 'SmolLM2 360M', repo: 'mlc-ai/SmolLM2-360M-Instruct-q4f16_1-MLC', rev: '3a622fd89e0216e8bb10c410c007c786baa8a033', lib: 'SmolLM2-360M-Instruct-q4f16_1_cs1k-webgpu.wasm', mb: 212, vram: 376.06, largest: 23_592_960, work: 216.06 },
];
/** The stand-ins for the 0.6B, smaller each: the Qwen2.5 0.5B, then the floor. */
export const STAND_INS: ModelDef[] = [MODELS[1]!, MODELS[2]!];
/** The floor: the smallest brain WebLLM 0.2.85 ships prebuilt (SmolLM2 360M). */
export const FLOOR: ModelDef = MODELS[2]!;
const isStandIn = (m: Pick<ModelDef, 'id'>): boolean => STAND_INS.some((x) => x.id === m.id);

/**
 * The bigger brains he can try (SETTINGS → OFFLINE BRAIN): Qwen3.5 0.8B, 2B and 4B (Apache-2.0), exactly as WebLLM
 * 0.2.85's own list names them (model id, compiled library from binary-mlc-llm-libs `web-llm-models/v0_2_84/base`,
 * memory needed, and its overrides for these models: a 4,096-token context and `max_history_size` 1, since three layers
 * in four keep a running state rather than a cache), each pinned to the one commit their repos have had since they were
 * uploaded (checked 24 Oct 2026). `mb` is what the phone fetches: every weight shard, the tokenizer and the config
 * (447,008,243, 1,082,390,739 and 2,390,258,276 bytes); `vram` is WebLLM's own figure for the memory it needs when
 * running. The 0.8B is the step between the 0.6B and the 2B (24 Oct, after the 2B closed Ghosty on the 18 Pro Max):
 * WebLLM's list has no Qwen3 1.7B under 1,800 MB (it needs 2,036.66), so it is the smallest Qwen above the 0.6B, at
 * 1,629.49 MB. The weekly training does not train it (`alone`).
 */
export const BIGGER: ModelDef[] = [
  { id: 'Qwen3.5-0.8B-q4f16_1-MLC', label: 'Qwen3.5 0.8B', repo: 'mlc-ai/Qwen3.5-0.8B-q4f16_1-MLC', rev: '0ec138972555613c1d7812a821778ad0398c8790', lib: 'Qwen3.5-0.8B-q4f16_1_cs1k-webgpu.wasm', mb: 447, vram: 1629.49, ctx: 4096, history: 1, largest: 127_139_840, work: 1437.49, alone: true },
  { id: 'Qwen3.5-2B-q4f16_1-MLC', label: 'Qwen3.5 2B', repo: 'mlc-ai/Qwen3.5-2B-q4f16_1-MLC', rev: 'dd74e9c8a20c4546df85c844103bff87b6dcacad', lib: 'Qwen3.5-2B-q4f16_1_cs1k-webgpu.wasm', mb: 1082, vram: 2245.44, brain: 'qwen3.5-2b', ctx: 4096, history: 1, largest: 254_279_680, work: 2053.44 },
  { id: 'Qwen3.5-4B-q4f16_1-MLC', label: 'Qwen3.5 4B', repo: 'mlc-ai/Qwen3.5-4B-q4f16_1-MLC', rev: '44b42469f9e192814bfd90440e3b377d89ba7a13', lib: 'Qwen3.5-4B-q4f16_1_cs1k-webgpu.wasm', mb: 2390, vram: 3867.82, brain: 'qwen3.5-4b', ctx: 4096, history: 1, largest: 317_849_600, work: 3355.82 },
];

/** The brains the picker offers, smallest first: today's Qwen3 0.6B (also the fallback), then the bigger ones. */
export const PICKER: ModelDef[] = [MODELS[0]!, ...BIGGER];

/** Which base a model is (a stock one, a bigger one, or a trained week of either); the two stand-ins count as the 0.6B. */
export const brainOf = (m: Pick<ModelDef, 'brain'>): BaseId => m.brain ?? DEFAULT_BASE;
/** Its row in the picker: its base, or its own id for a brain the training does not follow (the 0.8B). */
export const slotOf = (m: Pick<ModelDef, 'brain' | 'alone' | 'id'>): string => (m.alone ? m.id : brainOf(m));
/** A brain bigger than the 0.6B (or its stand-ins): one that may be too big for the phone's graphics memory. */
export const isBigger = (m: Pick<ModelDef, 'brain' | 'alone' | 'id'>): boolean => slotOf(m) !== DEFAULT_BASE;
/**
 * The key a brain's record on this phone is kept under (`Held`): its picker row (`slotOf`), except the stand-ins (the
 * Qwen2.5 0.5B and the floor), which have their own, so a smaller brain closing Ghosty is never mistaken for the 0.6B
 * doing so (31 Oct: the 0.6B closed Ghosty on the first answer of a SCHOOL paper; the stand-ins are the smaller ones to try).
 */
export const heldKey = (m: Pick<ModelDef, 'brain' | 'alone' | 'id'>): string => (isStandIn(m) ? m.id : slotOf(m));
/** "2B": the short name the owner reads in a warning ("Qwen3.5 2B" → "2B"). */
export const shortName = (m: Pick<ModelDef, 'label'>): string => m.label.split(' ').at(-1) ?? m.label;

/**
 * SCHOOL's chain (1 Nov: "press SIT and it works"): the 0.6B, then the Qwen2.5 0.5B, then the floor. A paper is sat on
 * the largest of them that is on this phone and has not closed Ghosty here; after a close, the next one down is one tap
 * away (GET it and sit); never on a cloud model: School is his own brain or nothing.
 */
export const CHAIN: ModelDef[] = MODELS;
/** The rung a brain is on (by its record: a week trained from the 0.6B is on the 0.6B's); -1 for a bigger brain. */
export const rungOf = (m: Pick<ModelDef, 'brain' | 'alone' | 'id'>): number => CHAIN.findIndex((r) => heldKey(r) === heldKey(m));
/** The truth when the floor has closed Ghosty too: no cloud sitting, and no pretending. */
export const NO_BRAIN = "No brain runs in this phone's browser yet. I keep my schooling for when one does.";

/**
 * The chain's pick, from the brains on this phone (`here`) and whether each may be loaded (`usable`: it has not closed
 * Ghosty here, or he said yes since): `sit`, the largest rung here and usable; else, once a rung has closed Ghosty,
 * `get`, the largest usable rung below the lowest one that closed (`after`), to GET and sit in one tap; `none` when the
 * floor has closed too and nothing here may sit. Nothing closed and nothing here (a new phone): neither, and DOWNLOAD in
 * SETTINGS is the way, as it always was.
 */
export function chainPick(here: Pick<ModelDef, 'id'>[], usable: (m: ModelDef) => boolean): { sit: ModelDef | null; get: ModelDef | null; after: ModelDef | null; none: boolean } {
  const on = new Set(here.map((m) => m.id));
  const sit = CHAIN.find((m) => on.has(m.id) && usable(m)) ?? null;
  const closed = CHAIN.map((m) => !usable(m));
  const lowest = closed.lastIndexOf(true);
  const after = lowest < 0 ? null : CHAIN[lowest]!;
  const get = sit || !after ? null : (CHAIN.slice(lowest + 1).find((m) => usable(m) && !on.has(m.id)) ?? null);
  return { sit, get, after, none: !sit && !get && closed.at(-1) === true };
}

/**
 * SIT and CARRY ON when no brain School may sit on is here: ONE button, "GET <brain> (<size>) and sit", which on Wi-Fi
 * gets it, loads it and sits (`go`); on mobile data it says so and waits, the button staying. No brain left (`m` null):
 * no button, and the words say the truth.
 */
export function sitOffer(m: Pick<ModelDef, 'label' | 'mb'> | null, mobile: boolean): { button: string; line: string; go: boolean } {
  if (!m) return { button: '', line: NO_BRAIN, go: false };
  const button = `GET ${m.label} (${sizeText(m.mb)}) and sit`;
  return mobile ? { button, line: `You are on mobile data, and ${m.label} is ${sizeText(m.mb)}: it waits for Wi-Fi. Join Wi-Fi, then tap it again.`, go: false } : { button, line: '', go: true };
}
/**
 * After a close, the one line said when Ghosty is open again (once per record): "<brain> closed Ghosty while
 * <loading|answering>. Next time SIT uses <brain>." — or, with no brain left to try, the truth.
 */
export const closeLine = (m: Pick<ModelDef, 'label'>, phase: 'loading' | 'answering', next: Pick<ModelDef, 'label'> | null): string =>
  `${m.label} closed Ghosty while ${phase}. ${next ? `Next time SIT uses ${next.label}.` : NO_BRAIN}`;
/** Why the one button is there, in one line: the brain that closed Ghosty and the smaller one to try. */
export const sitOfferWhy = (after: Pick<ModelDef, 'label'> | null, m: Pick<ModelDef, 'label' | 'mb'>): string =>
  `${after ? `${after.label} closed Ghosty on this phone. ` : ''}The smaller ${m.label} may fit: one tap gets it (${sizeText(m.mb)}, on Wi-Fi) and I sit on it.`;

/**
 * The most a SCHOOL question's prompt may take on a small brain (1 Nov: the 0.6B closed Ghosty at its first answer):
 * tokens by offline/prompt.ts estimateTokens, counted as the chat's budget counts them (4 more a message).
 */
export const SIT_BUDGET = 600;
/** A brain's sitting budget: 600 on a small one (the 0.6B, its weeks, the stand-ins); 0 on a bigger one, which keeps the shared exam prompt. */
export const sitBudget = (m: Pick<ModelDef, 'brain' | 'alone' | 'id'>): number => (isBigger(m) ? 0 : SIT_BUDGET);
/** The instruction every brain sits with, the shared exam's own system line (the marking reads what follows "Answer:"). */
export const SIT_ASK = EXAM_SYSTEM;
/** …and for a piece of writing. */
export const SIT_WRITE = `${EXAM_SYSTEM}. For a piece of writing, write the whole piece, then finish with 'Answer: done'.`;
const tokensOf = (msgs: OfflineMsg[]): number => msgs.reduce((n, x) => n + estimateTokens(x.content) + 4, 0);
/** The first `n` characters, ended at a word and marked as cut. */
const cutTo = (s: string, n: number): string => (s.length <= n ? s : n < 2 ? '' : `${s.slice(0, n - 1).replace(/\s+\S*$/, '')}…`);

/**
 * SCHOOL's prompt on a small brain: the question and the instruction only, in at most `budget` tokens. The framing goes
 * ("Read this:" before a passage, the marks in brackets); what the answer needs stays: the passage (its title and its
 * start, cut to fit), the question, the choices A–D and every instruction the marking reads (the exam's system line,
 * "Answer with the letter.", "Explain briefly.", "Answer: done"). Over budget, the passage is cut first, then the
 * question; never the choices or the instructions. A bigger brain keeps school/sit.ts examPrompt, the shared one.
 */
export function sitMessages(item: { q: string; type: string; marks: number; options?: string[] }, passage?: { title: string; text: string }, budget: number = SIT_BUDGET): OfflineMsg[] {
  const system = item.type === 'extended' ? SIT_WRITE : SIT_ASK;
  const tail: string[] = [];
  if (item.type === 'mcq' && item.options) tail.push(`${item.options.map((o, i) => `${'ABCD'[i] ?? i + 1}) ${o}`).join('\n')}\nAnswer with the letter.`);
  if (item.type === 'short') tail.push('Explain briefly.');
  if (item.type === 'extended') tail.push('Write it out in full.');
  const build = (p: string, q: string): OfflineMsg[] => [
    { role: 'system', content: system },
    { role: 'user', content: [p, q, ...tail].filter(Boolean).join('\n\n') },
  ];
  let p = passage ? `"${passage.title}"\n${passage.text.trim()}` : '';
  let q = item.q.trim();
  let msgs = build(p, q);
  // (each step takes off what is over, in characters as the estimate counts them, and a little for the cut mark)
  for (let i = 0; i < 40 && tokensOf(msgs) > budget; i++) {
    const over = Math.ceil((tokensOf(msgs) - budget) * 3.5) + 4;
    if (p) p = p.length - over >= 80 ? cutTo(p, p.length - over) : '';
    else if (q.length > 40) q = cutTo(q, Math.max(40, q.length - over));
    else break;
    msgs = build(p, q);
  }
  return msgs;
}

/**
 * WebLLM's own memory figure at another context window: the weights and the library's largest working space are fixed,
 * the cache grows with the context (112 KB a token for Qwen3 0.6B, 48 KB for Qwen3.5 as WebLLM counts it). So a shorter
 * context barely helps the 2B: 2,245 MB at 4,096 tokens, 2,149 at 2,048, 2,101 at 1,024 (its weights are 1,010 and the
 * working space 1,043 of it).
 */
export function memAt(m: Pick<ModelDef, 'vram' | 'work'>, ctx: number): number {
  if (!m.work || !(ctx > 0)) return m.vram;
  return Math.round((m.work + ((m.vram - m.work) * ctx) / 4096) * 100) / 100;
}

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

/**
 * What WebGPU gives a web page, from the adapter (SETTINGS checks before loading a brain: limitsProblem). Safari's
 * defaults are 256 MB buffers and 128 MB bindings; the phone's real ones are read from its adapter.
 */
export interface GpuLimits {
  maxBufferSize: number;
  maxStorageBufferBindingSize: number;
  maxComputeWorkgroupStorageSize: number;
  maxStorageBuffersPerShaderStage: number;
  maxComputeInvocationsPerWorkgroup: number;
}
const MiB = 1 << 20;
/**
 * What the vendored WebLLM 0.2.85 asks the adapter for (detectGPUDevice, web-llm.mjs): buffers and bindings of 1 GB when
 * the chip allows them, else 256 MB buffers and 128 MB bindings; 32 KB of workgroup memory, 10 storage buffers per
 * shader stage and 256 or more invocations per workgroup, or it will not start. `why` says which one the chip lacks.
 */
export function webllmAsks(l: GpuLimits): { buffer: number; binding: number; why: string } {
  const buffer = l.maxBufferSize >= 1 << 30 ? 1 << 30 : 1 << 28;
  const binding = l.maxStorageBufferBindingSize >= 1 << 30 ? 1 << 30 : 1 << 27;
  const why =
    l.maxBufferSize < buffer ? `buffers of ${Math.round(buffer / MiB)} MB (it gives ${Math.floor(l.maxBufferSize / MiB)} MB)`
    : l.maxStorageBufferBindingSize < binding ? `bindings of ${Math.round(binding / MiB)} MB (it gives ${Math.floor(l.maxStorageBufferBindingSize / MiB)} MB)`
    : l.maxComputeWorkgroupStorageSize < 32 << 10 ? `32 KB of workgroup memory (it gives ${Math.floor(l.maxComputeWorkgroupStorageSize / 1024)} KB)`
    : l.maxStorageBuffersPerShaderStage < 10 ? `10 storage buffers per shader (it gives ${l.maxStorageBuffersPerShaderStage})`
    : l.maxComputeInvocationsPerWorkgroup < 256 ? `256 threads per workgroup (it gives ${l.maxComputeInvocationsPerWorkgroup})`
    : '';
  return { buffer, binding, why };
}

/** The biggest piece the phone's graphics chip takes from a web page, as WebLLM will ask for it (bytes). */
export const pieceLimit = (l: GpuLimits): number => {
  const a = webllmAsks(l);
  return Math.min(a.buffer, a.binding);
};

/**
 * Why this phone cannot run a brain, in plain words ('' when its graphics chip gives what the brain needs): the 16-bit
 * maths, what WebLLM asks for at start, and the brain's biggest piece against the biggest buffer it may bind.
 */
export function limitsProblem(m: Pick<ModelDef, 'label' | 'largest'>, l: GpuLimits, f16: boolean): string {
  if (!f16) return `This phone's graphics chip lacks the 16-bit maths (shader-f16) every brain needs, so ${m.label} cannot run here.`;
  const a = webllmAsks(l);
  if (a.why) return `This phone's graphics chip does not give a web page what the offline brain needs to start: ${a.why}. ${m.label} cannot run here.`;
  const most = Math.min(a.buffer, a.binding);
  if ((m.largest ?? 0) > most) return `${m.label} has one piece of ${Math.round((m.largest ?? 0) / MiB)} MB that must sit in the graphics chip in one go, and this phone gives a web page pieces of at most ${Math.round(most / MiB)} MB. It cannot run here, so Ghosty does not try.`;
  return '';
}

/** What happened when a brain was loaded or answered on this phone (kept per `heldKey`: the picker row, or the stand-in's own). */
export interface Held {
  s: 'loaded' | 'closed' | 'failed' | 'refused';
  at: number;
  /** For `closed`: Ghosty closed while the brain was loading (the old record, when absent) or while it was answering. */
  phase?: 'loading' | 'answering';
}

const day = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
/**
 * "What this phone can hold", in plain words: the biggest piece its graphics chip takes (from the adapter, when known)
 * and what has loaded, closed Ghosty, run out of memory or been refused here before (remembered per brain).
 */
export function holdLine(limits: GpuLimits | null, held: Record<string, Held>, models: ModelDef[] = PICKER): string {
  const parts: string[] = [];
  if (limits) {
    const most = pieceLimit(limits);
    const fit = models.filter((m) => (m.largest ?? 0) <= most && !webllmAsks(limits).why).map(shortName);
    parts.push(`its graphics chip takes pieces of up to ${Math.round(most / MiB).toLocaleString('en-GB')} MB, enough for ${fit.length === models.length ? 'every brain here' : fit.length ? `the ${fit.join(', ')}` : 'none of the brains'}`);
  }
  const named = (s: Held['s'], phase?: NonNullable<Held['phase']>) =>
    models.filter((m) => held[heldKey(m)]?.s === s && (!phase || (held[heldKey(m)]!.phase ?? 'loading') === phase)).map((m) => `${m.label} (${day(held[heldKey(m)]!.at)})`);
  const ran = named('loaded');
  const closed = named('closed', 'loading');
  const closedAnswering = named('closed', 'answering');
  const short = named('failed');
  const refused = named('refused');
  if (ran.length) parts.push(`has run ${ran.join(', ')}`);
  if (closed.length) parts.push(`closed Ghosty loading ${closed.join(', ')}`);
  if (closedAnswering.length) parts.push(`closed Ghosty answering on ${closedAnswering.join(', ')}`);
  if (short.length) parts.push(`ran out of memory loading ${short.join(', ')}`);
  if (refused.length) parts.push(`could not start ${refused.join(', ')}`);
  const untried = models.filter((m) => !held[heldKey(m)]).map((m) => m.label);
  if (untried.length && untried.length < models.length) parts.push(`not tried yet: ${untried.join(', ')}`);
  return `What this phone can hold: ${parts.length ? parts.join('; ') : 'nothing tried yet'}. How much graphics memory a page may use is only known by trying: iOS closes a page that asks for too much.`;
}

/** A size for the owner: "352 MB" under a gigabyte, else "1.1 GB" (MB as the files are counted: 1,000,000 bytes). */
export const sizeText = (mb: number): string => (mb < 1000 ? `${Math.round(mb)} MB` : `${(mb / 1000).toFixed(1)} GB`);
/** Memory when running, from WebLLM's MB (1,048,576 bytes): "1.4 GB". */
export const memText = (vramMB: number): string => `${(vramMB / 1024).toFixed(1)} GB`;

/**
 * How much of one piece GET fetches at a time (offline/fill.ts): about 32 MB, asked for with a Range request and kept as a
 * part of its own until the piece is whole, so a phone that closes Ghosty mid-piece loses at most one part, and only
 * one part is ever on its way in. A piece no bigger than this comes in one go.
 */
export const PART_BYTES = 32 * 1024 * 1024;
/** The parts of a piece of `bytes`: [first, last] byte of each, as a Range header names them (one part when it is small). */
export function partRanges(bytes: number, part: number = PART_BYTES): [number, number][] {
  if (!(bytes > 0)) return [];
  const size = part > 0 ? Math.floor(part) : bytes;
  const out: [number, number][] = [];
  for (let a = 0; a < bytes; a += size) out.push([a, Math.min(bytes, a + size) - 1]);
  return out;
}

/** What one brain has on this phone right now, counted in the cache: pieces there of the pieces it needs (`of`, 0 when its list is not here), and their bytes. */
export interface Kept {
  label: string;
  mb: number;
  have: number;
  of: number;
}
/** "On this phone: Qwen3 0.6B whole (352 MB) · Qwen3.5 2B 37 of 120 pieces", from the pieces really in the cache. */
export function onPhoneLine(kept: Kept[]): string {
  const there = kept.filter((k) => k.have > 0);
  if (!there.length) return 'On this phone: no brain yet.';
  const one = (k: Kept) => (k.of > 0 && k.have >= k.of ? `${k.label} whole (${sizeText(k.mb)})` : k.of > 0 ? `${k.label} ${k.have} of ${k.of} pieces` : `${k.label} ${k.have} piece${k.have === 1 ? '' : 's'}`);
  return `On this phone: ${there.map(one).join(' · ')}.`;
}
/**
 * A brain whose download finished here earlier and whose pieces are not all here now (counted at opening): said by name,
 * so a new download is never silent. `was`: the pieces it had when GET finished, and when.
 */
export function goneLine(m: Pick<ModelDef, 'label'>, was: { of: number; at: number }, have: number): string {
  const gone = Math.max(0, was.of - have);
  const when = new Date(was.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${m.label} was whole on this phone on ${when} (${was.of} pieces); ${gone === was.of ? 'all of them have' : `${gone} of them have`} gone since, and Ghosty did not remove them. Getting it again fetches only what is missing.`;
}
/**
 * A GET the space this phone gives Ghosty cannot hold, in plain words before anything is downloaded ('' when it fits, or
 * when the browser does not say). `quota` and `usage` are navigator.storage.estimate()'s bytes; `have` the bytes of this
 * brain already here. A brain fetched in parts needs room for its biggest piece twice while that piece is put together.
 */
export function roomProblem(m: Pick<ModelDef, 'label' | 'mb' | 'largest'>, quota: number, usage: number, have = 0, part: number = PART_BYTES): string {
  if (!(quota > 0)) return '';
  const free = Math.max(0, quota - Math.max(0, usage));
  const files = Math.max(0, m.mb * 1e6 - Math.max(0, have));
  const extra = (m.largest ?? 0) > part ? (m.largest ?? 0) : 0;
  const need = files + extra;
  if (need <= free) return '';
  const gb = (b: number) => sizeText(b / 1e6);
  return `This phone gives Ghosty ${gb(quota)} of space (${gb(free)} of it free); the ${shortName(m)} needs ${gb(need)}${extra ? ` (its files and room to put its biggest piece together)` : ''}. Nothing was downloaded: free some space on the phone, or choose a smaller brain.`;
}

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
      const def: ModelDef = { id: `Ghosty-week-${m.week}-${m.commit.slice(0, 7)}`, label: `Ghosty (week ${m.week})`, repo: m.repo, rev: m.commit, base: weightsBase(origin, weights, m.commit), lib: stock.lib, mb: stock.mb, vram: stock.vram, ...(stock.largest ? { largest: stock.largest } : {}), ...(stock.work ? { work: stock.work } : {}) };
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
