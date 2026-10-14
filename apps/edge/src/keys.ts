/**
 * The API keys and tokens Ghosty knows how to use. They are stored encrypted in the
 * vault and set from the System tab. Add an entry here when a new tool needs a key.
 */
export interface KeyDef {
  name: string;
  label: string;
  hint: string;
  link: string;
}

export const KEYS: KeyDef[] = [
  { name: 'gemini', label: 'Gemini (best free coder)', hint: 'AIza…', link: 'https://aistudio.google.com/apikey' },
  { name: 'groq', label: 'Groq (fast chat + Whisper ears)', hint: 'gsk_…', link: 'https://console.groq.com/keys' },
  { name: 'cerebras', label: 'Cerebras', hint: 'csk-…', link: 'https://cloud.cerebras.ai/' },
  { name: 'openrouter', label: 'OpenRouter (free models)', hint: 'sk-or-…', link: 'https://openrouter.ai/keys' },
  { name: 'mistral', label: 'Mistral', hint: 'key…', link: 'https://console.mistral.ai/api-keys' },
  {
    name: 'github',
    label: 'GitHub token (lets Ghosty edit itself)',
    hint: 'github_pat_…',
    link: 'https://github.com/settings/personal-access-tokens/new',
  },
  { name: 'brave', label: 'Brave Search (web search)', hint: 'BSA…', link: 'https://api-dashboard.search.brave.com/' },
  { name: 'tavily', label: 'Tavily (web search, alternative)', hint: 'tvly-…', link: 'https://app.tavily.com/' },
];
