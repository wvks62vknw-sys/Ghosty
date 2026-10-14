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
}

export const PROVIDERS: Provider[] = [
  {
    id: 'gemini',
    name: 'Gemini',
    base: 'https://generativelanguage.googleapis.com/v1beta/openai',
    key: 'gemini',
    seed: ['gemini-2.5-flash', 'gemini-2.5-flash-lite'],
    accept: (id) => /gemini/.test(id) && !/(tts|image|embed|live|audio|vision-only)/.test(id),
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
    seed: ['mistral-medium-latest', 'mistral-small-latest'],
  },
];

/** Model ids that are never chat models. */
export const NOT_CHAT =
  /(audio|tts|whisper|orpheus|guard|embed|image|imagen|veo|moderation|ocr|transcribe|rerank|dall|flux|sdxl|robotic|computer-use|native-audio)/i;

/** Rough quality score so stronger discovered models are tried first. */
export function modelScore(id: string): number {
  let s = 0;
  if (/(pro|large|120b|235b|405b|70b|medium|qwen3|deepseek|kimi|glm|gpt-oss)/i.test(id)) s += 2;
  if (/(lite|8b|nano|mini\b|small|1b|3b|tiny)/i.test(id)) s -= 1.5;
  if (/(preview|exp|beta)/i.test(id)) s -= 0.5;
  return s;
}
