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
  },
  {
    id: 'cerebras',
    name: 'Cerebras',
    base: 'https://api.cerebras.ai/v1',
    key: 'cerebras',
    seed: ['gpt-oss-120b', 'qwen-3.8-27b', 'llama-3.3-70b'],
    reset: 'rolling',
    cheap: 4,
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
