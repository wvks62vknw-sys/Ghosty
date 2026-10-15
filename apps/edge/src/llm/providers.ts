/**
 * The AI providers Ghosty can use. All of them speak the OpenAI chat-completions
 * format, including tool calling. Add a provider by adding an entry here and a key
 * entry in KEYS (apps/edge/src/keys.ts).
 *
 * `seed` lists models to try before live discovery has run. Discovery (GET /models)
 * then adds whatever else the key can reach.
 */
export interface Provider {
  id: string;
  name: string;
  base: string;
  /** Vault key name holding this provider's API key. */
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
}

export const PROVIDERS: Provider[] = [
  {
    id: 'gemini',
    name: 'Gemini',
    base: 'https://generativelanguage.googleapis.com/v1beta/openai',
    key: 'gemini',
    seed: ['gemini-2.5-flash', 'gemini-2.5-flash-lite'],
    accept: (id) => /gemini/.test(id) && !/(tts|image|embed|live|audio|vision-only)/.test(id),
    maxOut: 16384,
  },
  {
    id: 'groq',
    name: 'Groq',
    base: 'https://api.groq.com/openai/v1',
    key: 'groq',
    seed: ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'openai/gpt-oss-20b'],
  },
  {
    id: 'cerebras',
    name: 'Cerebras',
    base: 'https://api.cerebras.ai/v1',
    key: 'cerebras',
    seed: ['gpt-oss-120b', 'llama-3.3-70b'],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    base: 'https://openrouter.ai/api/v1',
    key: 'openrouter',
    seed: ['openrouter/free'],
    accept: (id) => id.endsWith(':free') || id === 'openrouter/free',
  },
  {
    id: 'mistral',
    name: 'Mistral',
    base: 'https://api.mistral.ai/v1',
    key: 'mistral',
    seed: ['mistral-medium-latest', 'devstral-medium-latest', 'mistral-small-latest'],
    maxOut: 16384,
  },
  {
    // GitHub Models: GPT-4.1 / DeepSeek-V3 for free with the same GitHub token Ghosty
    // already uses (the token needs the "Models: read" permission). Small daily allowance
    // and 8k-token requests, so it is kept for coding turns only.
    id: 'ghmodels',
    name: 'GitHub Models',
    base: 'https://models.github.ai/inference',
    key: 'github',
    seed: ['openai/gpt-4.1', 'deepseek/DeepSeek-V3-0324', 'openai/gpt-4.1-mini'],
    maxIn: 7600,
    maxOut: 4000,
    codeOnly: true,
    noDiscovery: true,
  },
  {
    // Cloudflare Workers AI through the Worker's own AI binding: no key at all, a free
    // daily allowance, and always there as the last resort.
    id: 'workersai',
    name: 'Workers AI',
    base: '',
    key: '',
    transport: 'workers-ai',
    seed: ['@cf/zai-org/glm-4.7-flash', '@cf/openai/gpt-oss-120b', '@cf/meta/llama-4-scout-17b-16e-instruct', '@cf/meta/llama-3.3-70b-instruct-fp8-fast'],
    maxOut: 8192,
    noDiscovery: true,
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
  if (/(glm-4\.7-flash|llama-4-scout|llama-3\.3-70b|gpt-oss-20b|qwen3-32b)/.test(m)) return 5;
  return 4 + modelScore(m);
}

/** Model ids that are never chat models. */
export const NOT_CHAT =
  /(audio|tts|whisper|orpheus|guard|embed|image|imagen|veo|moderation|ocr|transcribe|rerank|dall|flux|sdxl|robotic|computer-use|native-audio)/i;

/** Rough quality score so stronger discovered models are tried first. */
export function modelScore(id: string): number {
  let s = 0;
  if (/(pro|large|120b|235b|405b|70b|medium|qwen3|deepseek|kimi|glm|gpt-oss|coder|codestral|devstral)/i.test(id)) s += 2;
  if (/(lite|8b|nano|mini\b|small|1b|3b|tiny)/i.test(id)) s -= 1.5;
  if (/(preview|exp|beta)/i.test(id)) s -= 0.5;
  return s;
}
