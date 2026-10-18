/**
 * The AI providers Ghosty can use. All of them speak the OpenAI chat-completions
 * format, including tool calling. Add a provider by adding an entry here and a key
 * entry in KEYS (apps/edge/src/keys.ts) — unless it is keyless.
 *
 * `seed` lists models to try before live discovery has run. Discovery (GET /models)
 * then adds whatever else the key can reach.
 *
 * Keyless providers (no account at all): Cloudflare Workers AI through the Worker's own
 * binding, and Pollinations' free text API (one model, one reply every 30 s per address,
 * best effort). They come after the owner's own keys for chat, and first for Ghosty's
 * own study drills (the cheap tier), so the owner's allowances are kept for the owner.
 */
/**
 * A free allowance (quota.ts counts against it). Every field is optional: what a provider does not
 * limit is left out. The numbers are conservative copies of each provider's published free tier
 * (source on each); rate-limit headers and 429s lower them further at run time, never raise them.
 */
export interface Limits {
  /** Requests a minute. */
  rpm?: number;
  /** Tokens a minute (in + out). */
  tpm?: number;
  /** Requests a day (since its reset, or a rolling 24 hours). */
  rpd?: number;
  /** Tokens a day. */
  tpd?: number;
  /** At least this long between two requests (an open endpoint's pacing). */
  gapMs?: number;
  /** Requests at once. */
  conc?: number;
}

export interface Provider {
  id: string;
  name: string;
  base: string;
  /** Vault key name holding this provider's API key ('' for a keyless provider). */
  key: string;
  seed: string[];
  /** Optional filter for discovered model ids. */
  accept?: (id: string) => boolean;
  /** Reply length (tokens) to allow when writing code; providers with small free rate limits keep it lower. */
  maxOut?: number;
  /** Largest request (input tokens) the free tier accepts; bigger requests are slimmed down first. */
  maxIn?: number;
  /** Only used for coding turns (small free daily allowance, strongest models). */
  codeOnly?: boolean;
  /** 'workers-ai' = Cloudflare's built-in AI binding (no key); otherwise an OpenAI-style HTTP API. */
  transport?: 'openai' | 'workers-ai';
  /** Skip GET /models discovery. */
  noDiscovery?: boolean;
  /** Needs no key (an open endpoint). Tried after keyed providers for chat. */
  keyless?: boolean;
  /** Order for chat when nothing else decides: 0 the owner's keys, 1 Workers AI, 2 open endpoints. */
  tier?: number;
  /** How long to wait for an answer (default 60 s; open endpoints that queue get less). */
  timeoutMs?: number;
  /** When this provider's daily allowance resets, for remembering an exhausted provider until then. */
  reset?: 'utc-midnight' | 'pt-midnight' | 'rolling';
  /** How good a fit for Ghosty's own small jobs (study digests and drills): higher first. */
  cheap?: number;
  /** The allowance of the whole key (every model together). */
  limits?: Limits;
  /** The allowance of each model on its own (on top of `limits`). */
  modelLimits?: (model: string) => Limits;
  /** Vault key used when `key` is empty (Google Gemma: the Gemini key). */
  keyFallback?: string;
  /** Only for the small tier (short internal steps), never the owner's main chat. */
  smallOnly?: boolean;
  /** No tool calling: only for requests without tools. */
  noTools?: boolean;
  /** No system message: it is put in front of the first user message instead. */
  noSystem?: boolean;
}

export const PROVIDERS: Provider[] = [
  {
    id: 'gemini',
    name: 'Gemini',
    base: 'https://generativelanguage.googleapis.com/v1beta/openai',
    key: 'gemini',
    // The free tier moves on: discovery keeps the ones the key can reach, newest first.
    seed: ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'],
    accept: (id) => /gemini/.test(id) && !/(tts|image|embed|live|audio|vision-only)/.test(id),
    maxOut: 16384,
    reset: 'pt-midnight',
    cheap: 6,
    // Free tier per model per project (ai.google.dev/gemini-api/docs/rate-limits; AI Studio → Rate limits):
    // Pro 5 RPM / 250K TPM / 100 RPD, Flash 10 / 250K / 250, Flash-Lite 15 / 250K / 1,000.
    modelLimits: (m) => (/pro/.test(m) ? { rpm: 5, tpm: 250_000, rpd: 100 } : /lite/.test(m) ? { rpm: 15, tpm: 250_000, rpd: 1000 } : { rpm: 10, tpm: 250_000, rpd: 250 }),
  },
  {
    id: 'groq',
    name: 'Groq',
    base: 'https://api.groq.com/openai/v1',
    key: 'groq',
    // Free plan (2026): the gpt-oss models and Qwen; Llama 3.x moved to enterprise plans.
    seed: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'],
    reset: 'rolling',
    cheap: 6,
    // Per model (console.groq.com/docs/rate-limits, 2026): gpt-oss-120b, gpt-oss-20b and qwen3.8-27b are
    // each 30 RPM / 8K TPM / 1K RPD / 200K TPD; an unlisted model gets the same.
    modelLimits: () => ({ rpm: 30, tpm: 8000, rpd: 1000, tpd: 200_000 }),
  },
  {
    id: 'cerebras',
    name: 'Cerebras',
    base: 'https://api.cerebras.ai/v1',
    key: 'cerebras',
    seed: ['gpt-oss-120b', 'qwen-3.8-27b', 'llama-3.3-70b'],
    reset: 'rolling',
    cheap: 4,
    // Free tier per model (inference-docs.cerebras.ai/support/rate-limits): 30 RPM, 60K TPM, 14.4K RPD, 1M TPD.
    modelLimits: () => ({ rpm: 30, tpm: 60_000, rpd: 14_400, tpd: 1_000_000 }),
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    base: 'https://openrouter.ai/api/v1',
    key: 'openrouter',
    seed: ['openrouter/free'],
    accept: (id) => id.endsWith(':free') || id === 'openrouter/free',
    reset: 'utc-midnight',
    cheap: 5,
    // ':free' models, the whole key (openrouter.ai/docs/api-reference/limits): 20 RPM, 50 a day without credits bought.
    limits: { rpm: 20, rpd: 50 },
  },
  {
    id: 'mistral',
    name: 'Mistral',
    base: 'https://api.mistral.ai/v1',
    key: 'mistral',
    seed: ['mistral-medium-latest', 'devstral-medium-latest', 'mistral-small-latest'],
    maxOut: 16384,
    reset: 'rolling',
    cheap: 5,
    // Free "Experiment" plan, the whole key (docs.mistral.ai/deployment/laplateforme/tier): 1 request a second,
    // 500K tokens a minute, 1B tokens a month (about 33M a day; 30M kept).
    limits: { rpm: 60, gapMs: 1000, tpm: 500_000, tpd: 30_000_000 },
  },
  {
    // NVIDIA's free tier: big open models at about 40 requests a minute, a rolling window.
    id: 'nvidia',
    name: 'NVIDIA NIM',
    base: 'https://integrate.api.nvidia.com/v1',
    key: 'nvidia',
    seed: ['moonshotai/kimi-k2-instruct', 'deepseek-ai/deepseek-v3.1', 'qwen/qwen3-coder-480b-a35b-instruct', 'meta/llama-3.3-70b-instruct', 'nvidia/llama-3.3-nemotron-super-49b-v1.5'],
    // A huge mixed catalogue: embedders, rerankers, guard models, vision-only and science models are not chat (NOT_CHAT catches the rest).
    accept: (id) => !/(embed|retriev|rerank|reward|guard|safety|vision|neva|paligemma|florence|deplot|kosmos|clip|cosmos|parakeet|riva|canary|fastpitch|maxine|ocdr|cuopt|evo-?2|genmol|molmim|diffdock|esm|alphafold|proteinmpnn|-vl-|vila)/i.test(id),
    maxOut: 8192,
    reset: 'rolling',
    cheap: 3,
    // Free API key on build.nvidia.com (docs.api.nvidia.com, "40 requests per minute" for trial keys): no daily cap.
    limits: { rpm: 40 },
  },
  {
    // SambaNova's free tier: very fast DeepSeek and Llama, about 20 requests a day per model.
    id: 'sambanova',
    name: 'SambaNova',
    base: 'https://api.sambanova.ai/v1',
    key: 'sambanova',
    seed: ['DeepSeek-V3.1', 'Meta-Llama-3.3-70B-Instruct', 'Llama-4-Maverick-17B-128E-Instruct', 'Qwen3-32B'],
    // Its list also carries an embedder and Whisper.
    accept: (id) => !/(e5-|embed|whisper)/i.test(id),
    reset: 'utc-midnight',
    cheap: 2,
    // Free tier per model (docs.sambanova.ai/cloud/docs/get-started/rate-limits): about 20 requests a day, 10–20 a minute (10 kept).
    modelLimits: () => ({ rpm: 10, rpd: 20 }),
  },
  {
    // Cohere's trial key: the Command models, 1,000 calls a month, through its OpenAI-compatible endpoint (fixed list).
    id: 'cohere',
    name: 'Cohere',
    base: 'https://api.cohere.ai/compatibility/v1',
    key: 'cohere',
    seed: ['command-a-03-2025', 'command-r-plus-08-2024', 'command-r7b-12-2024'],
    accept: (id) => /command/.test(id),
    noDiscovery: true,
    reset: 'rolling',
    cheap: 3,
    // Trial key (docs.cohere.com/docs/rate-limits): Chat 20 a minute, 1,000 calls a month (about 33 a day).
    limits: { rpm: 20, rpd: 33 },
  },
  {
    // Google's open Gemma 3 models through the Gemini API: a separate, much bigger daily allowance than
    // Gemini (14,400 requests a day per model), but no tool calling and no system instructions — so only
    // for Ghosty's small internal steps (summaries, titles, checks). Its own key slot, or the Gemini key.
    id: 'gemma',
    name: 'Google Gemma',
    base: 'https://generativelanguage.googleapis.com/v1beta/openai',
    key: 'gemma',
    keyFallback: 'gemini',
    seed: ['gemma-3-27b-it', 'gemma-3-12b-it', 'gemma-3n-e4b-it'],
    maxOut: 4096,
    noDiscovery: true,
    smallOnly: true,
    noTools: true,
    noSystem: true,
    reset: 'pt-midnight',
    cheap: 7,
    // Free tier per model (ai.google.dev/gemini-api/docs/rate-limits, Gemma 3 and 3n): 30 RPM, 15K TPM, 14,400 RPD.
    modelLimits: () => ({ rpm: 30, tpm: 15_000, rpd: 14_400 }),
  },
  {
    // Cloudflare Workers AI through the Worker's own AI binding: no key at all, a free
    // daily allowance (10,000 neurons, reset midnight UTC), and always there.
    id: 'workersai',
    name: 'Workers AI',
    base: '',
    key: '',
    transport: 'workers-ai',
    seed: ['@cf/zai-org/glm-4.7-flash', '@cf/openai/gpt-oss-20b', '@cf/openai/gpt-oss-120b', '@cf/meta/llama-4-scout-17b-16e-instruct', '@cf/meta/llama-3.3-70b-instruct-fp8-fast'],
    maxOut: 8192,
    noDiscovery: true,
    keyless: true,
    tier: 1,
    reset: 'utc-midnight',
    cheap: 9,
    // developers.cloudflare.com/workers-ai/platform/limits (text generation: 300 requests a minute) and
    // /platform/pricing (10,000 neurons a day free, about 300K tokens on these models; 1,000 requests kept as a day cap).
    limits: { rpm: 300, rpd: 1000, tpd: 300_000 },
  },
  {
    // Pollinations' free text API: no account, no key. One model (gpt-oss-20b, tool calling
    // works), one reply every 30 seconds per address, best effort, and identical requests may
    // get a shared cached answer — fine as a last resort for chat and for study drills, never
    // for anything secret. Over the limit it answers 402 with Retry-After, which the router
    // honours; requests that queue are cut off after 25 s.
    id: 'pollinations',
    name: 'Pollinations',
    base: 'https://text.pollinations.ai/v1',
    key: '',
    seed: ['openai'],
    maxOut: 4096,
    noDiscovery: true,
    keyless: true,
    tier: 2,
    timeoutMs: 25_000,
    reset: 'rolling',
    cheap: 8,
    // Anonymous tier (github.com/pollinations/pollinations APIDOCS.md: one request every 15–30 s per address; 30 s kept).
    limits: { rpm: 2, gapMs: 30_000, conc: 1 },
  },
];

/**
 * How good a model is at agentic coding (higher first) — used to order models for coding
 * turns across every provider. Unknown models fall back to the general score.
 */
export function codeScore(id: string): number {
  const m = id.toLowerCase();
  if (/kimi-k2/.test(m)) return 10;
  if (/(gpt-5(?!-nano)|gpt-4\.1(?!-nano|-mini)|gemini-[3-9][\w.-]*pro|gemini-2\.5-pro|claude)/.test(m)) return 9;
  if (/(qwen3?-coder|qwen-3-coder|deepseek-(v3|r1|chat)|glm-(4\.[5-9]|5)(?!.*flash)|devstral|codestral)/.test(m)) return 8;
  if (/(gpt-oss-120b|llama-4-maverick|qwen3-235b|qwen-3-235b|mistral-medium|gpt-4\.1-mini|gemini-[\d.]+-flash(?!-lite))/.test(m)) return 7;
  if (/(glm-4\.7-flash|llama-4-scout|llama-3\.3-70b|gpt-oss-20b|qwen3-32b|qwen3?\.8-27b)/.test(m)) return 5;
  return 4 + modelScore(m);
}

/**
 * How good a model is for Ghosty's own small, unattended jobs (study digests, drills): the
 * small, fast, generously rationed ones first, so the strong models keep their allowance
 * for the owner. Higher first.
 */
export function cheapScore(id: string, p?: Provider): number {
  const m = id.toLowerCase();
  let s = p?.cheap ?? 4;
  // The big ones first (Gemini Pro, the 70b+ models), so a Pro model never counts as cheap; then the
  // small ones ("mini" only as a word of its own: "gemini" is not it).
  if (/(pro|120b|235b|405b|70b|medium|large|kimi|deepseek)/.test(m) && !/flash/.test(m)) s -= 2;
  else if (/(flash-lite|gpt-oss-20b|glm-4\.7-flash|(^|[-/])mini\b|small|nano|8b|27b)/.test(m)) s += 2;
  return s;
}

/** Model ids that are never chat models. */
export const NOT_CHAT =
  /(audio|tts|whisper|orpheus|guard|embed|image|imagen|veo|moderation|ocr|transcribe|rerank|dall|flux|sdxl|robotic|computer-use|native-audio)/i;

/**
 * Models that can look at a picture (an image part in the owner's message): Gemini, Llama 4,
 * Pixtral and Mistral Small/Medium 3 (their "latest" aliases point at those), Gemma 3, the
 * Qwen VL models, GPT-4o/4.1/5, Claude, LLaVA, anything calling itself vision — and
 * Pollinations' `openai` (a GPT-4o class model behind an open endpoint; the router still never
 * sends a picture to an open endpoint, so this only says what the model could do).
 */
export const VISION = /(gemini|llama-4|pixtral|mistral-small-3|mistral-medium-3|mistral-(small|medium)-latest|gemma-3|qwen[\w.-]*vl|gpt-4o|gpt-4\.1|gpt-5|^openai$|claude|llava|vision)/i;

/** 1 for a model that can see pictures, else 0: a message with a picture is routed only to these. */
export function visionScore(id: string): number {
  return VISION.test(id) && !NOT_CHAT.test(id) ? 1 : 0;
}

/** Rough quality score so stronger discovered models are tried first. */
export function modelScore(id: string): number {
  let s = 0;
  if (/(pro|large|120b|235b|405b|70b|medium|qwen3|deepseek|kimi|glm|gpt-oss|coder|codestral|devstral)/i.test(id)) s += 2;
  if (/(lite|8b|nano|mini\b|small|1b|3b|tiny)/i.test(id)) s -= 1.5;
  if (/(preview|exp|beta)/i.test(id)) s -= 0.5;
  return s;
}

/** Ms until a provider's allowance resets (its stated reset time), or null when it is a rolling window. */
export function resetDelay(p: Pick<Provider, 'reset'>, now = Date.now()): number | null {
  if (p.reset === 'utc-midnight') return Math.floor(now / 86_400_000) * 86_400_000 + 86_400_000 - now;
  if (p.reset === 'pt-midnight') {
    // Midnight in California is 07:00 or 08:00 UTC; the later one is the safe choice.
    const day = Math.floor(now / 86_400_000) * 86_400_000;
    const at = day + 8 * 3600_000;
    return (at > now ? at : at + 86_400_000) - now;
  }
  return null;
}
