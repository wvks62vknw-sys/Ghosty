/**
 * The API keys and tokens Ghosty knows how to use. They are stored encrypted in the
 * vault and set from the System tab, which shows the `steps` to anyone who has never
 * made an API key before. Add an entry here when a new tool needs a key.
 */
export interface KeyDef {
  name: string;
  label: string;
  hint: string;
  /** Page where the key is made (pre-filled where the site allows it). */
  link: string;
  need: 'needed' | 'recommended' | 'optional';
  /** One line: what this key gives you. */
  why: string;
  /** Plain-English steps, shown when the owner opens "how do I get this?". */
  steps: string[];
}

export function keyDefs(repo?: string): KeyDef[] {
  const owner = repo?.split('/')[0];
  const ghLink =
    'https://github.com/settings/personal-access-tokens/new?' +
    new URLSearchParams({
      name: 'Ghosty',
      description: 'Lets Ghosty propose, preview and ship changes to its own code',
      expires_in: '366',
      ...(owner ? { target_name: owner } : {}),
      contents: 'write',
      pull_requests: 'write',
      statuses: 'read',
      actions: 'read',
      models: 'read',
    }).toString();
  return [
    {
      name: 'gemini',
      label: 'Gemini',
      hint: 'starts with AIza…',
      link: 'https://aistudio.google.com/apikey',
      need: 'needed',
      why: "Ghosty's main brain. Free, and the best free model for building things.",
      steps: [
        'Open the link and sign in with any Google account.',
        'Press "Create API key". If it asks for a project, pick the suggested one or "Create new project".',
        'Press the copy button next to the new key (it starts with AIza).',
        'Paste it in the box below and press SAVE.',
      ],
    },
    {
      name: 'github',
      label: 'GitHub token',
      hint: 'starts with github_pat_…',
      link: ghLink,
      need: 'needed',
      why: 'Lets Ghosty change its own code when you ask (new panels, features, fixes) — and gives it free GPT-4.1 for writing that code (GitHub Models).',
      steps: [
        'Open the link (sign in to GitHub if asked). The name, permissions and a 1-year expiry are already filled in.',
        `Under "Repository access" choose "Only select repositories" and pick ${repo ?? 'your Ghosty repository'}.`,
        'Under "Account permissions", check "Models" is "Read-only" (free GPT-4.1 for coding). Already have a token? Edit it on GitHub and add this permission.',
        'Scroll to the bottom and press "Generate token", then confirm.',
        'Copy the token (it starts with github_pat_). GitHub only shows it once.',
        'Paste it below and press SAVE.',
      ],
    },
    {
      name: 'groq',
      label: 'Groq',
      hint: 'starts with gsk_…',
      link: 'https://console.groq.com/keys',
      need: 'recommended',
      why: 'Very fast backup brain, and it lets Ghosty understand your voice (speech to text).',
      steps: [
        'Open the link and sign in (Google sign-in works).',
        'Press "Create API Key", type any name (e.g. Ghosty) and press Submit.',
        'Copy the key (it starts with gsk_). It is only shown once.',
        'Paste it below and press SAVE.',
      ],
    },
    {
      name: 'tavily',
      label: 'Tavily search',
      hint: 'starts with tvly-…',
      link: 'https://app.tavily.com/',
      need: 'recommended',
      why: 'Better web search results (1,000 free searches a month, no card). Without it Ghosty uses DuckDuckGo.',
      steps: [
        'Open the link and sign up (Google sign-in works).',
        'Your key is shown on the home page under "API Keys". Press the copy button.',
        'Paste it below and press SAVE.',
      ],
    },
    {
      name: 'cerebras',
      label: 'Cerebras',
      hint: 'starts with csk-…',
      link: 'https://cloud.cerebras.ai/',
      need: 'optional',
      why: 'Extra backup brain for when the others hit their free limits.',
      steps: ['Open the link and sign up.', 'Go to "API Keys" in the left menu and create a key.', 'Copy it, paste it below and press SAVE.'],
    },
    {
      name: 'openrouter',
      label: 'OpenRouter',
      hint: 'starts with sk-or-…',
      link: 'https://openrouter.ai/settings/keys',
      need: 'optional',
      why: 'Access to many free models as extra backups.',
      steps: ['Open the link and sign in.', 'Press "Create API Key", give it any name and create it.', 'Copy it, paste it below and press SAVE.'],
    },
    {
      name: 'mistral',
      label: 'Mistral',
      hint: 'a long letters-and-numbers key',
      link: 'https://console.mistral.ai/api-keys',
      need: 'optional',
      why: 'Another backup brain (free "Experiment" plan; asks for a phone number).',
      steps: ['Open the link and sign in.', 'Choose the free Experiment plan if asked.', 'Press "Create new key", copy it, paste it below and press SAVE.'],
    },
    {
      name: 'brave',
      label: 'Brave Search',
      hint: 'starts with BSA…',
      link: 'https://api-dashboard.search.brave.com/',
      need: 'optional',
      why: 'Alternative web search. Not needed if you have Tavily (Brave may ask for a card even on the free plan).',
      steps: ['Open the link and sign up.', 'Subscribe to the free plan, then open "API Keys" and copy your key.', 'Paste it below and press SAVE.'],
    },
  ];
}

export const KEYS = keyDefs();

/** Quick live check that a key works. Returns a short, owner-friendly result. */
export async function testKey(name: string, value: string, repo?: string): Promise<{ ok: boolean; info: string }> {
  const bearer = { Authorization: `Bearer ${value}` };
  const check = async (url: string, init: RequestInit = {}) => {
    const r = await fetch(url, init);
    return r.status;
  };
  try {
    let status: number;
    switch (name) {
      case 'gemini':
        status = await check('https://generativelanguage.googleapis.com/v1beta/openai/models', { headers: bearer });
        break;
      case 'groq':
        status = await check('https://api.groq.com/openai/v1/models', { headers: bearer });
        break;
      case 'cerebras':
        status = await check('https://api.cerebras.ai/v1/models', { headers: bearer });
        break;
      case 'openrouter':
        status = await check('https://openrouter.ai/api/v1/key', { headers: bearer });
        break;
      case 'mistral':
        status = await check('https://api.mistral.ai/v1/models', { headers: bearer });
        break;
      case 'tavily':
        status = await check('https://api.tavily.com/search', { method: 'POST', headers: { ...bearer, 'content-type': 'application/json' }, body: JSON.stringify({ query: 'test', max_results: 1 }) });
        break;
      case 'brave':
        status = await check('https://api.search.brave.com/res/v1/web/search?q=test&count=1', { headers: { 'X-Subscription-Token': value, Accept: 'application/json' } });
        break;
      case 'github': {
        if (!repo) return { ok: true, info: 'saved (no repository configured to check against)' };
        const r = await fetch(`https://api.github.com/repos/${repo}`, { headers: { ...bearer, 'User-Agent': 'Ghosty', Accept: 'application/vnd.github+json' } });
        if (r.status === 404) {
          // Say which repositories the token CAN see, so the fix is obvious.
          const list = await fetch('https://api.github.com/user/repos?per_page=100', { headers: { ...bearer, 'User-Agent': 'Ghosty', Accept: 'application/vnd.github+json' } }).catch(() => null);
          const names = list?.ok ? ((await list.json()) as { full_name: string }[]).map((x) => x.full_name) : [];
          const sees = names.length ? `It can only see: ${names.slice(0, 5).join(', ')}.` : 'It can\'t see any of your repositories.';
          return { ok: false, info: `this token doesn't have access to your Ghosty repository. ${sees} On GitHub, edit the token → "Repository access" → "Only select repositories" → tick ${repo.split('/')[1]} → Update. Then paste the token here again.` };
        }
        if (!r.ok) return { ok: false, info: r.status === 401 ? 'GitHub says this token is not valid. Copy it again.' : `GitHub answered ${r.status}` };
        const j = (await r.json()) as { permissions?: { push?: boolean } };
        if (j.permissions && !j.permissions.push) return { ok: false, info: 'the token can read but not write. It needs "Contents: Read and write".' };
        // Free GPT-4.1 for coding comes from GitHub Models with the same token.
        const m = await fetch('https://models.github.ai/inference/chat/completions', {
          method: 'POST',
          headers: { ...bearer, 'Content-Type': 'application/json', 'User-Agent': 'Ghosty' },
          body: JSON.stringify({ model: 'openai/gpt-4.1-mini', messages: [{ role: 'user', content: 'ok' }], max_tokens: 1 }),
        }).catch(() => null);
        const models = m?.ok || m?.status === 429 ? ' · free GPT-4.1 for coding: on' : ' · free GPT-4.1 for coding: off (edit the token on GitHub and set Account permissions → Models → Read to switch it on)';
        return { ok: true, info: `works · can edit ${repo}${models}` };
      }
      default:
        return { ok: true, info: 'saved' };
    }
    if (status >= 200 && status < 300) return { ok: true, info: 'works ✓' };
    if (status === 401 || status === 403) return { ok: false, info: 'the service says this key is not valid. Copy it again (no spaces).' };
    if (status === 429) return { ok: true, info: 'valid, but its free limit is used up for now' };
    return { ok: false, info: `the service answered ${status}; try again in a minute` };
  } catch (e) {
    return { ok: false, info: `could not reach the service (${String((e as Error)?.message ?? e).slice(0, 80)})` };
  }
}
