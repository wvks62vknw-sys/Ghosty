/**
 * The API keys and tokens Ghosty knows how to use. They are stored encrypted in the
 * vault and set from the System tab, which shows the `steps` to anyone who has never
 * made an API key before. Add an entry here when a new tool needs a key.
 */
import { MailError, parseEmailKey, testLogin } from './integrations/mail';
import { parseTfwmKey } from './integrations/transit';
import { dropTokens, motToken, parseMotKey, VES_API, VehicleError } from './integrations/vehicle';
import { hfWhoami, kaggleWorks, parseKaggleKey, RemoteError } from './selftrain/remote'; // [selftrain]

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
  /** Pasted as several lines: the System tab shows a box this many lines tall (a one-line box would run them together). */
  lines?: number;
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
      // (It no longer brings free GPT-4.1: GitHub retired GitHub Models on 30 July 2026.)
      why: 'Lets Ghosty change its own code when you ask (new panels, features, fixes).',
      steps: [
        'Open the link (sign in to GitHub if asked). The name, permissions and a 1-year expiry are already filled in.',
        `Under "Repository access" choose "Only select repositories" and pick ${repo ?? 'your Ghosty repository'}.`,
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
      name: 'telegram',
      label: 'Telegram bot',
      hint: 'numbers, a colon, then letters (from @BotFather)',
      link: 'https://t.me/BotFather',
      need: 'recommended',
      why: 'Talk to Ghosty from Telegram — text, voice notes and photos — and get its notifications there. Free.',
      steps: [
        'Open the link (it opens @BotFather in Telegram) and send /newbot: give the bot a name, then a username ending in "bot". Already have one? Send /mybots → your bot → API Token.',
        'Copy the token BotFather shows (numbers, a colon, then letters).',
        'Paste it below and press SAVE. Ghosty connects itself and shows a 6-digit pairing code here (and in LINKS → TELEGRAM).',
        'Open your bot in Telegram, press START and send it the code. From then on only you can talk to it.',
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
      name: 'nvidia',
      label: 'NVIDIA NIM',
      hint: 'starts with nvapi-…',
      link: 'https://build.nvidia.com/settings/api-keys',
      need: 'optional',
      why: 'Free: big open models (Kimi K2, DeepSeek, Llama 3.3, Qwen3 Coder) at about 40 requests a minute. Asks for a phone number once.',
      steps: [
        'Open the link and sign in, or create a free NVIDIA account (it asks you to confirm a phone number once).',
        'Press "Generate API Key", give it any name (e.g. Ghosty) and generate it.',
        'Copy the key (it starts with nvapi-), paste it below and press SAVE.',
      ],
    },
    {
      name: 'sambanova',
      label: 'SambaNova',
      hint: 'a long letters-and-numbers key',
      link: 'https://cloud.sambanova.ai/apis',
      need: 'optional',
      why: 'Free: very fast DeepSeek and Llama models (about 20 requests a day per model).',
      steps: [
        'Open the link and sign up for the free SambaNova Cloud account (Google sign-in works).',
        'Open "APIs" in the left menu and press "Generate New API Key".',
        'Copy the key, paste it below and press SAVE.',
      ],
    },
    {
      name: 'cohere',
      label: 'Cohere',
      hint: 'a long letters-and-numbers key',
      link: 'https://dashboard.cohere.com/api-keys',
      need: 'optional',
      why: 'Free trial key: Command A and Command R models, 1,000 calls a month.',
      steps: [
        'Open the link and sign up (Google or GitHub sign-in works).',
        'On the API keys page, copy the Trial key shown there (or press "New Trial key" and copy that).',
        'Paste it below and press SAVE.',
      ],
    },
    {
      name: 'gemma',
      label: 'Google Gemma',
      hint: 'starts with AIza… (leave empty to use the Gemini key)',
      link: 'https://aistudio.google.com/apikey',
      need: 'optional',
      why: "Not needed: Ghosty already uses Google's free Gemma models through your Gemini key for small jobs; a key from a second Google project here gives them their own allowance.",
      steps: [
        'Open the link and sign in with your Google account.',
        'Press "Create API key" and choose "Create new project" (a separate project has its own free allowance).',
        'Copy the key (it starts with AIza), paste it below and press SAVE.',
      ],
    },
    {
      name: 'aisstream',
      label: 'AISstream (ships)',
      hint: 'a long letters-and-numbers key',
      link: 'https://aisstream.io/apikeys',
      need: 'optional',
      why: "Live ships anywhere in the world on the God's Eye globe (free). Without it you still see ships around the Baltic.",
      steps: [
        'Open the link and press "Sign in with GitHub" (use your normal GitHub account).',
        'Press "Create New API Key", then copy the key it shows.',
        'Paste it below and press SAVE. Ships appear on the globe within a minute when you zoom in on any coast.',
      ],
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
    {
      name: 'tomtom',
      label: 'TomTom traffic',
      hint: 'a 32-character key',
      link: 'https://developer.tomtom.com/user/register',
      need: 'optional',
      why: "Live road traffic anywhere (e.g. Birmingham city centre): speeds on every road drawn on God's Eye, and crashes, closures and queues when you ask. Free: 50,000 map tiles and 2,500 lookups a day, no card.",
      steps: [
        'Open the link and create a free TomTom Developer account (confirm the email they send).',
        'Open the Dashboard → "Keys". A key called "My first API key" is already there — press copy.',
        'Paste it below and press SAVE. Then ask Ghosty "how\'s the traffic in Birmingham city centre?"',
      ],
    },
    {
      name: 'tfwm',
      label: 'TfWM transport (West Midlands buses & trams)',
      hint: 'app id, a space, then the app key',
      link: 'https://api-portal.tfwm.org.uk/signup',
      need: 'optional',
      why: "Live National Express West Midlands buses and Metro trams on God's Eye, and \"what buses are running near X\" when you ask. Free, 10,000 hits a day.",
      steps: [
        'Open the link and register (free, about two minutes; confirm the email they send).',
        'Open your application on the portal to see its Application ID and Key.',
        'Paste them here as "id key" — the Application ID, a space, then the Key — and press SAVE.',
      ],
    },
    {
      name: 'bods',
      label: 'Bus Open Data (all England buses)',
      hint: 'a long letters-and-numbers key',
      link: 'https://data.bus-data.dft.gov.uk/account/signup/',
      need: 'optional',
      why: "Live buses anywhere in England on God's Eye, every 10 seconds (the Department for Transport's Bus Open Data Service). Free, no trams.",
      steps: [
        'Open the link and create the free account (confirm the email they send).',
        'Sign in, open Account Settings and copy the API key shown there.',
        'Paste it here and press SAVE.',
      ],
    },
    {
      name: 'mapbox',
      label: 'Mapbox token',
      hint: 'starts with pk.…',
      link: 'https://account.mapbox.com/access-tokens/',
      need: 'optional',
      why: "Live traffic colours on the flat map — jams in red, like Google Maps — plus Mapbox's satellite-with-streets and night navigation maps. The map itself works without it. Free tier (50,000 map loads a month).",
      steps: [
        'Open the link and create a free Mapbox account.',
        'On the Access tokens page, copy the "Default public token" (it starts with pk.). That is all Ghosty needs.',
        'Paste it here. It is a public token by design (it travels in map tile addresses); on the same page you can restrict it to your Ghosty address.',
      ],
    },
    {
      name: 'dvsa_mot',
      label: 'DVSA MOT history (vehicle check)',
      hint: 'the five lines from DVSA\'s email: client ID, client secret, API key, token URL, scope',
      link: 'https://documentation.history.mot.api.gov.uk/mot-history-api/register/',
      need: 'optional',
      lines: 5,
      why: "Check one car you photograph or type in: make, model, colour, MOT valid until, every MOT test with its mileage and advisories, and a warning if the mileage ever went down. Free from DVSA. Looked up once, never saved.",
      steps: [
        'Open the link and press "Register for MOT history API". Choose to register as an individual and fill in your name, email and postal address (it is free).',
        'For what you will use it for, write something like: "Personal use: checking the MOT history of a car before buying it."',
        'Wait for DVSA\'s email (up to 5 working days). It gives you five things: a client ID, a client secret, an API key, a token URL (it starts with https://login.microsoftonline.com/) and a scope (https://tapi.dvsa.gov.uk/.default).',
        'Copy those five lines from the email and paste them all into the box below, one per line, in any order (the words in front, like "Client ID:", can stay). Press SAVE. Ghosty signs in once to check them; no car is looked up.',
        'Use it at least once every 90 days or DVSA cancels the key. The client secret runs out after 2 years: DVSA emails you before then.',
        'What is never stored: the plate and the record are shown once and not kept — not in the chat history, memory, library or anywhere else. Ghosty never looks up who owns a car.',
      ],
    },
    {
      name: 'dvla_ves',
      label: 'DVLA vehicle enquiry (tax status)',
      hint: 'a long letters-and-numbers key (for when DVLA reopens registrations)',
      link: 'https://developer-portal.driver-vehicle-licensing.api.gov.uk/apis/vehicle-enquiry-service/vehicle-enquiry-service-description.html',
      need: 'optional',
      why: 'Adds tax status and due date, CO2, engine size and year to a vehicle check. DVLA has paused new registrations: keep this for when they reopen. Not needed for MOT history.',
      steps: [
        'DVLA is not taking new registrations at the moment (the link says "Registration closed"). When they reopen, register there (free).',
        'DVLA emails you an API key. Copy it, paste it below and press SAVE.',
        'Meanwhile the free check at vehicleenquiry.service.gov.uk shows the same tax details in any browser.',
      ],
    },
    {
      name: 'email',
      label: 'Email (app password)',
      hint: 'you@gmail.com then a space, then the app password',
      link: 'https://myaccount.google.com/apppasswords',
      need: 'optional',
      why: 'Lets Ghosty check, search and read your email, and send email as you (every email it sends waits for your OK).',
      steps: [
        'Gmail: 2-Step Verification must be on (myaccount.google.com/security). Then open the link, type any name (e.g. Ghosty) and press Create.',
        'Google shows a 16-letter app password. Copy it. (It is not your normal password, and you can delete it any time to cut Ghosty off.)',
        'In the box below type your address, a space, then the app password, e.g.: you@gmail.com abcd efgh ijkl mnop — then press SAVE. Ghosty signs in once to check it.',
        'iCloud (account.apple.com → Sign-In and Security → App-Specific Passwords), Yahoo, AOL and Fastmail work the same way: your address, a space, the app password.',
        'Any other provider (or Google Workspace on your own domain): address, password, IMAP server, SMTP server, e.g.: you@domain.com password imap.domain.com smtp.domain.com (add :port if not 993 / 465).',
        'Outlook.com / Hotmail / Live addresses cannot be linked: Microsoft no longer allows app passwords for mail.',
      ],
    },
    {
      name: 'huggingface',
      label: 'Hugging Face (3-D models)',
      hint: 'starts with hf_…',
      link: 'https://huggingface.co/settings/tokens/new?tokenType=read',
      need: 'optional',
      why: "Gives the 3D STUDIO's picture-to-3-D maker your own free daily GPU allowance (about 5 minutes a day) instead of the small one shared by everyone without an account. Free, no card.",
      steps: [
        'Open the link and create a free Hugging Face account (confirm the email they send), then open the link again.',
        'The token type is already "Read". Type any name (e.g. Ghosty) and press "Create token".',
        'Copy the token (it starts with hf_), paste it below and press SAVE.',
      ],
    },
    // [selftrain] The two keys the offline brain's weekly self-training needs (selftrain/cycle.ts).
    {
      name: 'kaggle',
      label: 'Kaggle (free GPUs for training)',
      hint: 'the API token (starts with KGAT_) — or the whole kaggle.json text',
      link: 'https://www.kaggle.com/settings',
      need: 'optional',
      why: "Lets Ghosty train its offline brain (the small AI on your phone) once a week on Kaggle's free GPUs (about 30 hours a week, no card). With the Hugging Face token below, it runs on its own.",
      steps: [
        'Open the link and sign up or sign in to Kaggle (Google sign-in works).',
        'Kaggle only lends GPUs to confirmed accounts: on the same Settings page, under "Phone verification", confirm your phone number (once).',
        'Still on Settings, find "API Tokens" and press "Generate New Token". Give it any name (e.g. Ghosty) and copy the token it shows (it starts with KGAT_). Kaggle shows it only once.',
        'Paste it below and press SAVE. Ghosty asks Kaggle once whose token it is; nothing runs until both training keys are saved.',
        'An older kaggle.json file (from "Create Legacy API Key") works too: paste its whole text.',
      ],
    },
    {
      name: 'hf_write',
      label: 'Hugging Face token (training)',
      hint: 'starts with hf_… (fine-grained, write access to your two Ghosty repos)',
      link: 'https://huggingface.co/new-dataset',
      need: 'optional',
      why: 'Where the trained offline brain is kept: two PRIVATE spaces on your free Hugging Face account, one for the training lessons and one for the brain itself. Only Ghosty reaches them, with this token, which never leaves your brain; your phone gets the new brain through Ghosty.',
      steps: [
        'Make a free Hugging Face account at huggingface.co (confirm the email they send), then open the link.',
        'Name the dataset ghosty-training, choose Private, and press "Create dataset".',
        'Open huggingface.co/new, name the model ghosty-offline-brain, choose Private, and press "Create model".',
        'Open huggingface.co/settings/tokens/new, choose "Fine-grained", type a name (e.g. Ghosty training). Under "Repositories permissions" search for ghosty-training and ghosty-offline-brain, add both, and tick "Write access to contents/settings of selected repos". Leave everything else off.',
        'Press "Create token", copy it (it starts with hf_), paste it below and press SAVE. Ghosty checks it can write to both, and that both are private.',
      ],
    },
    // [lens] Pl@ntNet names plants for the Lens's NAME IT (tools/lens.ts identify_plant): free, 500 a day, optional.
    {
      name: 'plantnet',
      label: 'Pl@ntNet (plants)',
      hint: 'your private API key from my.plantnet.org',
      link: 'https://my.plantnet.org/',
      need: 'optional',
      why: "Lets the Lens's NAME IT name plants from a photo with Pl@ntNet. Free: 500 plants a day, no card.",
      steps: [
        'Open the link and sign up (free, no card); confirm the email Pl@ntNet sends, then sign in.',
        'Open your account page and copy your API key.',
        'Paste it below and press SAVE. The Lens uses it only when you press LIVING THING → PLANT.',
      ],
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
      case 'gemma':
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
      case 'nvidia':
        status = await check('https://integrate.api.nvidia.com/v1/models', { headers: bearer });
        break;
      case 'sambanova':
        status = await check('https://api.sambanova.ai/v1/models', { headers: bearer });
        break;
      case 'cohere':
        status = await check('https://api.cohere.ai/compatibility/v1/models', { headers: bearer });
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
        return { ok: true, info: `works · can edit ${repo}` };
      }
      case 'tomtom':
        status = await check(`https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/12/json?point=51.5074,-0.1278&key=${encodeURIComponent(value)}`, {});
        break;
      case 'tfwm': {
        // A gentle check: one request for the live feed. The documented host has a bad certificate,
        // so the mirror with a valid one is tried first (see integrations/transit.ts).
        const k = parseTfwmKey(value);
        if (!k) return { ok: false, info: 'type the Application ID, a space, then the Key (both from your application on the TfWM portal)' };
        const q = `?app_id=${encodeURIComponent(k.id)}&app_key=${encodeURIComponent(k.key)}`;
        status = await check(`https://api-realtime-odp.tfwm.itoworld.com/gtfs/vehicle_positions${q}`).catch(() => check(`http://api.tfwm.org.uk/gtfs/vehicle_positions${q}`));
        break;
      }
      case 'bods':
        status = await check(`https://data.bus-data.dft.gov.uk/api/v1/gtfsrtdatafeed/?boundingBox=-1.95,52.45,-1.85,52.52&api_key=${encodeURIComponent(value.trim())}`);
        break;
      case 'email': {
        // The value holds a password: only owner-friendly messages come back, never the value itself.
        try {
          const cfg = parseEmailKey(value);
          await testLogin(cfg);
          return { ok: true, info: `works ✓ · Ghosty can read and send email as ${cfg.address}` };
        } catch (e) {
          if (e instanceof MailError && e.kind === 'network') return { ok: false, info: `could not reach the mail server: ${e.message.slice(0, 200)}` };
          return { ok: false, info: e instanceof MailError ? e.message.slice(0, 400) : 'could not check the email account; try again in a minute' };
        }
      }
      case 'dvsa_mot': {
        // A token only: no vehicle is looked up. The secret goes nowhere but Microsoft's sign-in address.
        let k;
        try {
          k = parseMotKey(value);
        } catch (e) {
          return { ok: false, info: (e as Error).message };
        }
        try {
          dropTokens();
          await motToken(k);
          return { ok: true, info: 'works ✓ · DVSA signed Ghosty in (no vehicle was looked up)' };
        } catch (e) {
          return { ok: false, info: e instanceof VehicleError ? e.message : `could not reach DVSA's sign-in (${String((e as Error)?.message ?? e).slice(0, 80)})` };
        }
      }
      case 'dvla_ves':
        // "0" is no plate: a valid key gets "bad request" back, a wrong one "forbidden" — no vehicle is looked up.
        status = await check(VES_API, { method: 'POST', headers: { 'x-api-key': value.trim(), 'content-type': 'application/json' }, body: JSON.stringify({ registrationNumber: '0' }) });
        if (status === 400 || status === 404) status = 200;
        break;
      case 'huggingface':
        status = await check('https://huggingface.co/api/whoami-v2', { headers: bearer });
        break;
      // [selftrain]
      case 'kaggle': {
        const c = parseKaggleKey(value);
        if (!c) return { ok: false, info: 'paste the API token (it starts with KGAT_), or the whole kaggle.json text' };
        try {
          return { ok: true, info: `works ✓ · Kaggle account ${await kaggleWorks(fetch, c)}` };
        } catch (e) {
          return { ok: false, info: e instanceof RemoteError ? e.message : `could not reach Kaggle (${String((e as Error)?.message ?? e).slice(0, 80)})` };
        }
      }
      case 'hf_write': {
        try {
          const me = await hfWhoami(fetch, value.trim());
          const both = [`${me.name}/ghosty-training`, `${me.name}/ghosty-offline-brain`];
          if (me.role === 'read') return { ok: false, info: 'this token can only read: make a fine-grained token with write access to your two Ghosty repos' };
          const missing = both.filter((r) => !me.canWrite(r));
          if (missing.length) return { ok: false, info: `saved, but this token may not write to ${missing.join(' and ')}: add ${missing.length > 1 ? 'them' : 'it'} under "Repositories permissions" with write access` };
          return { ok: true, info: `works ✓ · can write to your two Ghosty repos as ${me.name}${me.role === 'write' ? ' (a full write token: a fine-grained one limited to those two repos is safer)' : ''}` };
        } catch (e) {
          return { ok: false, info: e instanceof RemoteError ? e.message : `could not reach Hugging Face (${String((e as Error)?.message ?? e).slice(0, 80)})` };
        }
      }
      case 'plantnet': // [lens]
        status = await check(`https://my-api.plantnet.org/v2/quota/daily?api-key=${encodeURIComponent(value)}`);
        break;
      case 'mapbox':
        if (!value.startsWith('pk.')) return { ok: false, info: 'use the public token (it starts with pk.), never a secret sk. token' };
        status = await check(`https://api.mapbox.com/tokens/v2?access_token=${encodeURIComponent(value)}`);
        break;
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
