/**
 * THE REVIEW LINK (BRIEF-REST-B part 3): `/demo` serves the app against a DEMO BRAIN, so another person (or another AI) can look
 * at Ghosty and say what they think, with none of his data anywhere near it.
 *
 * HOW IT IS KEPT APART (each of these is a test in apps/edge/test/restb.test.mjs):
 *  - a separate Durable Object, with the fixed name `demo` (DEMO_NAME). The owner's is named `owner`. The Worker's demo door
 *    (`demoRoute`) only ever asks for the one named `demo`; nothing in it can name the other;
 *  - the demo door takes NO sign-in and NO owner key: it throws away every credential header (the owner key, a Cloudflare
 *    Access token, cookies) before the request goes in, and the demo's brain refuses a request that still carries one;
 *  - a request marked as the demo's (the `x-ghosty-demo` header, set by the door) is refused by the owner's brain, and a
 *    request without the mark is refused by the demo's: a call made straight at either object, by the wrong side, gets a 403;
 *  - the demo's brain is built with an ENVIRONMENT WITH NOTHING IN IT (`sandboxEnv`): none of the owner's secrets or key
 *    copies, no KV (his published pages, backups and vault mirror), no AI binding, no model endpoints. It could not use a key
 *    if it tried;
 *  - what it will do is an ALLOW-LIST of reads (`demoPolicy`): his own sample data and public feeds. Every other request —
 *    anything that would send, post, pay, call, build, remember, forget, or change a key — is refused with "this is the demo";
 *  - its chat is answered by code (`demoReply`), never a model, so it costs nothing and cannot be talked into anything;
 *  - it is capped (150 requests a minute for the whole demo) so a crowd cannot spend the account's free allowance, and the owner
 *    can close the door at any moment by setting the variable DEMO_OFF to 1 (no deploy);
 *  - its data is sample data of our own (a made-up owner, Sam; seed.ts) that is wiped and put back every 20 minutes.
 * The phone side is /demo/boot.js (tour.ts): in-memory storage for the visitor's browser (so nothing of the real app, if the
 * owner opens the link on his own phone, is read or written) and a header on every /api call that marks it as the demo's.
 */
import type { Env } from '../env';
import { loadEvents } from '../schedule';
import { seedDemo } from './seed';
import { bootScript, tourPage, tourScript, DEMO_BANNER } from './tour';

export const DEMO_NAME = 'demo';
export const DEMO_HEADER = 'x-ghosty-demo';
export const DEMO_RESET_MS = 20 * 60_000;
export const DEMO_PER_MINUTE = 150;
export const SEEDED_KEY = 'demo:seededAt';

export const THIS_IS_THE_DEMO = 'This is the demo of Ghosty, with sample data. Nothing here sends, posts, pays, calls, builds or changes a key; on a real Ghosty I would ask first and then do it.';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

// ---------------------------------------------------------------------------------------------------------- what it allows

export type Policy = { ok: true } | { ok: false; why: string };

/** The reads the demo serves (the route as the brain sees it, after /api): his sample data and public feeds, nothing that acts. */
const READS: RegExp[] = [
  /^\/(status|history|memory|mind|today|why|abilities|speak|agenda|inbox|lessons|roadmap|widgets|school|foresight|guardian|cars|library|ships|transit|journey)$/,
  /^\/(keys\/public|library\/study|library\/search|highways\/events)$/,
  /^\/profile(\/[\w-]+)*$/,
  /^\/(abilities|aim)\/[\w-]+$/,
  /^\/traffic\/[\w/.-]+$/,
];

export function demoPolicy(method: string, route: string): Policy {
  const path = route.replace(/\/+$/, '') || '/';
  const m = method.toUpperCase();
  if ((m === 'GET' || m === 'HEAD') && READS.some((r) => r.test(path))) return { ok: true };
  if (m === 'POST' && (path === '/chat' || path === '/stop')) return { ok: true };
  if (m === 'GET' || m === 'HEAD') return { ok: false, why: `That is not part of the demo. ${THIS_IS_THE_DEMO}` };
  const acts = /^\/(keys|vault|telegram|email|spotify|push|backup|approve|kernel|models|changes|versions|sites|m3d|lens|stt|tts|library|agenda|jobs|feeds|projects|packs|learn|school|train|training|reverse|guardian|foresight|cars|widgets)/.test(path) ? ` (${path.split('/')[1]})` : '';
  return { ok: false, why: `${THIS_IS_THE_DEMO}${acts ? ` That request${acts} was not run.` : ''}` };
}

// ---------------------------------------------------------------------------------------------------------- the environment

/** The name a Durable Object was made with, when the runtime gives it (the owner's is `owner`, the demo's `demo`). */
export const nameOf = (state: unknown): string | undefined => (state as { id?: { name?: string } } | null | undefined)?.id?.name;
/** Is this Durable Object the demo's, by its name? */
export const isDemoState = (state: unknown): boolean => nameOf(state) === DEMO_NAME;

/** What the demo's brain is given instead of the real environment: no secrets, no key copies, no KV, no AI, no other brain. */
export function sandboxEnv(env: Env): Env {
  const none = (what: string) => () => {
    throw new Error(`${what} is not available in the demo`);
  };
  return {
    AGENT: { idFromName: none('another brain'), get: none('another brain'), idFromString: none('another brain'), newUniqueId: none('another brain') } as unknown as DurableObjectNamespace,
    ...(env.PUBLIC_ORIGIN ? { PUBLIC_ORIGIN: env.PUBLIC_ORIGIN } : {}),
    KEYLESS_MODELS: '0',
    IS_DEMO: '1',
  } as Env;
}

/** The environment a brain is built with: the sandbox for the demo's, the real one for any other. */
export const envFor = (state: unknown, env: Env): Env => (isDemoState(state) ? sandboxEnv(env) : env);

// ---------------------------------------------------------------------------------------------------------- the Worker's door

export interface DoorIo {
  /** The Worker's public-feed proxy (index.ts: an allow-list of public hosts, nothing else). */
  proxy(req: Request, ctx: ExecutionContext): Promise<Response>;
}

/** Headers that carry who someone is: none of them goes into the demo. */
const CREDENTIALS = ['x-ghosty-key', 'x-ghosty-vault', 'cf-access-jwt-assertion', 'cf-access-client-id', 'cf-access-client-secret', 'authorization', 'cookie'];

/**
 * The demo's door in the Worker (called first by index.ts): the demo's pages (`/demo`, `/demo/tour`, `/demo/boot.js`) and the
 * `/api` calls the demo page makes (marked with the demo header). Returns null for anything else, which goes on as ever.
 */
export async function demoRoute(req: Request, env: Env, ctx: ExecutionContext, io: DoorIo): Promise<Response | null> {
  // the owner's switch: a variable DEMO_OFF=1 (Cloudflare dashboard, Settings, Variables) closes the door at once, with no deploy
  if ((env as unknown as Record<string, string | undefined>).DEMO_OFF === '1') return null;
  const url = new URL(req.url);
  const p = url.pathname;
  if (p.startsWith('/api/') && req.headers.get(DEMO_HEADER) !== null) return demoApi(req, env, ctx, io, url);
  if (p === '/demo' || p.startsWith('/demo/')) return demoPage(req, env, url);
  return null;
}

async function demoPage(req: Request, env: Env, url: URL): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('the demo pages are read-only', { status: 405, headers: { allow: 'GET, HEAD' } });
  const p = url.pathname.replace(/\/+$/, '');
  const quiet = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' };
  if (p === '/demo/boot.js') return new Response(bootScript(), { headers: { 'content-type': 'text/javascript; charset=utf-8', ...quiet } });
  if (p === '/demo/tour.js') return new Response(tourScript(), { headers: { 'content-type': 'text/javascript; charset=utf-8', ...quiet } });
  if (p === '/demo/tour') {
    return new Response(tourPage(url.origin), { headers: { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'", ...quiet } });
  }
  if (!env.ASSETS) return new Response('the demo needs the built interface, which is not here', { status: 503 });
  // the app itself: the same built page, with the demo's bootstrap first and its banner on top
  const res = await env.ASSETS.fetch(new Request(`${url.origin}/`, { headers: { accept: 'text/html' } }));
  if (!res.ok) return new Response('the interface could not be read', { status: 502 });
  const html = (await res.text())
    .replace('<head>', '<head>\n<script src="/demo/boot.js"></script>')
    .replace(/<title>[^<]*<\/title>/, '<title>Ghosty (demo)</title>')
    .replace(/<body>/, `<body class="demo">\n${DEMO_BANNER}`);
  const headers = new Headers(res.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.delete('content-length');
  headers.delete('etag');
  for (const [k, v] of Object.entries(quiet)) headers.set(k, v);
  return new Response(req.method === 'HEAD' ? null : html, { status: 200, headers });
}

async function demoApi(req: Request, env: Env, ctx: ExecutionContext, io: DoorIo, url: URL): Promise<Response> {
  const route = url.pathname.slice(4);
  if (route === '/health') return json({ ok: true, secured: true, access: false, preview: false, demo: true });
  // the same rules as the owner's door: only Ghosty's own page may call, and a change needs the page's own header
  const site = req.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return json({ error: 'cross-site request refused' }, 403);
  if (!['GET', 'HEAD'].includes(req.method) && req.headers.get('x-ghosty') !== '1') return json({ error: 'missing x-ghosty header' }, 403);
  // public feeds the phone reads through the Worker (index.ts's allow-list of public hosts)
  if (route === '/proxy' && req.method === 'GET') return io.proxy(req, ctx);
  const policy = demoPolicy(req.method, route);
  if (!policy.ok) return json({ error: policy.why, demo: true }, 403);
  const headers = new Headers({ 'x-ghosty': '1', [DEMO_HEADER]: '1', 'x-ghosty-owner': 'Sam' });
  for (const k of ['content-type', 'accept']) if (req.headers.has(k)) headers.set(k, req.headers.get(k)!);
  // (nothing of the caller's credentials is carried: the headers are made afresh above)
  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer();
  const stub = env.AGENT.get(env.AGENT.idFromName(DEMO_NAME));
  return stub.fetch(new Request(url.toString(), { method: req.method, headers, ...(body ? { body } : {}) }));
}

// ---------------------------------------------------------------------------------------------------------- inside the brain

let minute = { at: 0, n: 0 };

/**
 * What the gate decided: is this the demo's brain, and the answer to give instead of the brain's own (null: carry on as usual).
 * `demo` tells the brain to build itself from the empty environment if it has not yet.
 */
export interface Gate {
  demo: boolean;
  res: Response | null;
}

/**
 * Every brain calls this first. WHOSE BRAIN IS THIS? By its name when the runtime gives one; where it does not, by its storage:
 * a brain that holds the demo's mark is the demo's, one that is empty and is called by the demo's door is the demo's (it is
 * marked as it is first seeded), and any other — one with something in it and no mark — is the owner's and is never wiped,
 * emptied or answered as the demo. The owner's brain refuses a request marked as the demo's; the demo's answers only a marked
 * request with no credentials, within its cap and its allow-list, and has its own chat.
 */
export async function demoGate(state: unknown, req: Request, storage: DurableObjectStorage, now = Date.now()): Promise<Gate> {
  const marked = req.headers.get(DEMO_HEADER) !== null;
  const name = nameOf(state);
  let demo: boolean;
  if (name === DEMO_NAME) demo = true;
  else if (name !== undefined) demo = false;
  else if ((await storage.get(SEEDED_KEY)) != null) demo = true;
  else demo = marked && (await storage.list({ limit: 1 })).size === 0;
  if (!demo) return { demo: false, res: marked ? json({ error: 'a demo request never reaches this brain', demo: true }, 403) : null };
  // the demo's brain: only the demo's door may call it, and never with anyone's credentials
  if (!marked) return { demo: true, res: json({ error: 'the demo brain answers only the demo page', demo: true }, 403) };
  if (CREDENTIALS.some((k) => req.headers.has(k))) return { demo: true, res: json({ error: 'the demo takes no keys or sign-in', demo: true }, 400) };
  if (now - minute.at >= 60_000) minute = { at: now, n: 0 };
  if (++minute.n > DEMO_PER_MINUTE) return { demo: true, res: json({ error: 'The demo is busy: try again in a minute.', demo: true }, 429) };
  const url = new URL(req.url);
  const route = url.pathname.replace(/^\/api/, '');
  const policy = demoPolicy(req.method, route);
  if (!policy.ok) return { demo: true, res: json({ error: policy.why, demo: true }, 403) };
  await freshen(storage, now);
  if (req.method === 'POST' && route === '/chat') return { demo: true, res: await demoChat(req, storage, now) };
  if (req.method === 'POST' && route === '/stop') return { demo: true, res: json({ ok: true }) };
  return { demo: true, res: null };
}

const seeded = new WeakMap<object, number>();

/** Wipe and seed the demo's storage when it is empty or twenty minutes old. */
export async function freshen(storage: DurableObjectStorage, now = Date.now()): Promise<boolean> {
  const known = seeded.get(storage) ?? (await storage.get<number>(SEEDED_KEY));
  if (typeof known === 'number' && now - known < DEMO_RESET_MS && now >= known) {
    seeded.set(storage, known);
    return false;
  }
  const keys = [...(await storage.list()).keys()];
  for (let i = 0; i < keys.length; i += 100) await storage.delete(keys.slice(i, i + 100));
  await seedDemo(storage, now);
  await storage.put(SEEDED_KEY, now);
  seeded.set(storage, now);
  return true;
}

// ---------------------------------------------------------------------------------------------------------- the chat

/** What the demo says, by code (never a model). `next`: the next few things in Sam's sample agenda. */
export function demoReply(text: string, next: { title: string; start: number; location?: string }[], now = Date.now()): string {
  const t = text.toLowerCase();
  if (/\b(send|e-?mail|message|text|whatsapp|post|tweet|publish|pay|buy|purchase|transfer|book|order|call|ring|phone|build|deploy|ship|create (?:a |an )?(?:site|app|website)|change (?:my )?(?:key|password)|add (?:a |my )?key|set (?:a )?reminder|remind me|schedule|delete|forget|remember)\b/.test(t)) {
    return `${THIS_IS_THE_DEMO} Say what you would like and I would show you what I would do, but here nothing leaves this page.`;
  }
  if (/\b(agenda|what'?s on|my day|today|tomorrow|this week|diary|calendar|plans)\b/.test(t)) {
    if (!next.length) return 'Sam has nothing coming up in this demo. (The sample week is put back every twenty minutes.)';
    const when = (ms: number) => new Date(ms).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
    return `Sam's sample week, next up: ${next.slice(0, 4).map((e) => `${e.title} (${when(e.start)}${e.location ? `, ${e.location}` : ''})`).join('; ')}. It is made-up data, put back every twenty minutes.`;
  }
  if (/\b(who are you|what are you|what can you do|help|abilities|what do you do)\b/.test(t)) {
    return 'I am Ghosty: a personal assistant that lives in a phone and a small brain of its own. The Everything tab lists everything I can do, with a way to try each; the tour at /demo/tour says what is real here and what is not. In this demo my chat is a script, so ask me about the sample week, or try the screens: the GYM, the Coach (say "tune my guitar"), the Eye, the Lens.';
  }
  if (/\b(weather|news|traffic|train|bus|flight|stock|price|score)\b/.test(t)) {
    return 'Live information comes from public feeds through my brain, and this demo has no keys and no model, so I will not guess. Open the Eye (the globe) to see what the phone itself can read from public feeds.';
  }
  if (/\b(hello|hi|hey|good (?:morning|afternoon|evening)|thanks|thank you)\b/.test(t)) return `Hello. I am the demo of Ghosty, looking after Sam, who is made up. ${THIS_IS_THE_DEMO}`;
  void now;
  return `This is the demo, so I do not think about that here: a real Ghosty would answer with a model, and this one answers only a few things by script (Sam's sample week, what I can do). Look around instead: every screen works on sample data. The tour is at /demo/tour.`;
}

async function demoChat(req: Request, storage: DurableObjectStorage, now: number): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { message?: unknown };
  const text = String(body.message ?? '').trim().slice(0, 2000);
  if (!text) return json({ error: 'empty message' }, 400);
  const next = (await loadEvents(storage)).filter((e) => (e.end ?? e.start) >= now).sort((a, b) => a.start - b.start);
  const reply = demoReply(text, next, now);
  // the answer in the brain's own stream shape (one JSON event a line), and nothing kept: the demo never writes a conversation
  const lines = [{ t: 'text', text: reply }, { t: 'done', model: 'demo' }].map((e) => JSON.stringify(e)).join('\n');
  return new Response(`${lines}\n`, { headers: { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' } });
}
