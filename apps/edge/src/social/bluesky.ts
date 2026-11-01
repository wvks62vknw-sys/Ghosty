/**
 * BLUESKY (BRIEF-SOCIAL item 3): his own account over the AT Protocol, plain fetch, no library. LINKS → BLUESKY takes his
 * handle and an APP PASSWORD (xxxx-xxxx-xxxx-xxxx) — never his main password: anything else is refused before it is sent
 * anywhere, and a session that says it was made with a main password is thrown away — kept in the vault with the session.
 * The session is refreshed when it runs out, and made again from the app password when the refresh has gone too.
 *
 *  - POST (only through the queue, on his APPROVE): the words with their links made clickable, one picture of his own with
 *    its words (alt text is required), under a record key chosen when it was drafted, so it can never post twice;
 *  - READ his home timeline and a search: authors and times, into the morning digest as a LEAD (where claims are found,
 *    never what proves them);
 *  - FOLLOW and UNFOLLOW, each a draft first;
 *  - rate limits honoured (a 429 says when to try again, in his words); every error in plain words. No DMs: chat is
 *    never called.
 */
import { notLinked, postLines, type Draft, type FeedPost } from '../../../../packages/shared/src/social';
import { digestHeading, dayOf } from '../library/digest';
import { imageBytes } from '../lens';
import type { AccountApi, SocialDeps } from './index';

export const ENTRY = 'https://bsky.social';
const VAULT = 'bluesky';
/** An app password, as Bluesky makes them. A main password never looks like this, so it is never sent. */
export const APP_PASSWORD = /^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/i;
/** Bluesky's limit for one picture's bytes. */
const MAX_PICTURE = 1_000_000;

/** What the vault keeps (as JSON): who, where his account lives, the session, the app password, a search for the morning. */
interface Saved {
  handle: string;
  did: string;
  service: string;
  access: string;
  refresh: string;
  password: string;
  search?: string;
}

class BlueskyError extends Error {
  constructor(message: string, readonly status: number, readonly code = '') {
    super(message);
  }
}

async function load(d: SocialDeps): Promise<Saved | null> {
  const raw = await d.vault.get(VAULT).catch(() => null);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Saved;
    return s && typeof s.did === 'string' && typeof s.refresh === 'string' ? s : null;
  } catch {
    return null;
  }
}
const save = (d: SocialDeps, s: Saved) => d.vault.set(VAULT, JSON.stringify(s));

/** A handle as he might paste it: "@sam.bsky.social", a profile link, "sam" (→ sam.bsky.social). */
export function handleOf(v: unknown): string {
  let h = String(v ?? '').trim().replace(/^https?:\/\/bsky\.app\/profile\//i, '').replace(/[/?#].*$/, '').replace(/^@/, '').toLowerCase();
  if (h && !h.includes('.') && !h.startsWith('did:')) h = `${h}.bsky.social`;
  return h;
}

/** A JSON Web Token's claims (the middle part), or {}. */
function claims(jwt: string): { scope?: string; exp?: number } {
  try {
    const b = jwt.split('.')[1] ?? '';
    return JSON.parse(atob(b.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(b.length / 4) * 4, '='))) as { scope?: string; exp?: number };
  } catch {
    return {};
  }
}

/** His posts' links, clickable (Bluesky's facets: byte offsets into the UTF-8 words). */
export function linkFacets(text: string): unknown[] {
  const enc = new TextEncoder();
  const out: unknown[] = [];
  for (const m of text.matchAll(/https?:\/\/[^\s<>"]*[^\s<>".,;:!?)\]'’”]/g)) {
    const start = enc.encode(text.slice(0, m.index)).length;
    out.push({ index: { byteStart: start, byteEnd: start + enc.encode(m[0]).length }, features: [{ $type: 'app.bsky.richtext.facet#link', uri: m[0] }] });
  }
  return out;
}

/** A post's address on bsky.app, from its at:// record. */
export const postLink = (handle: string, uri: string): string => `https://bsky.app/profile/${handle}/post/${uri.split('/').pop()}`;

const hhmm = (ms: number, tz: string) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(ms);

/** One XRPC call. 429 and every error come back in plain words. */
async function call(d: SocialDeps, nsid: string, o: { base: string; method?: 'GET' | 'POST'; query?: Record<string, string | number>; body?: unknown; bytes?: ArrayBuffer; type?: string; token?: string }): Promise<Record<string, unknown>> {
  const q = o.query ? `?${new URLSearchParams(Object.entries(o.query).map(([k, v]) => [k, String(v)])).toString()}` : '';
  const headers: Record<string, string> = { accept: 'application/json' };
  if (o.token) headers.authorization = `Bearer ${o.token}`;
  if (o.bytes) headers['content-type'] = o.type ?? 'application/octet-stream';
  else if (o.body !== undefined) headers['content-type'] = 'application/json';
  let r: Response;
  try {
    r = await d.fetch(`${o.base}/xrpc/${nsid}${q}`, { method: o.method ?? 'GET', headers, ...(o.bytes ? { body: o.bytes } : o.body !== undefined ? { body: JSON.stringify(o.body) } : {}), signal: AbortSignal.timeout(12_000) });
  } catch {
    throw new BlueskyError("I couldn't reach Bluesky just now. Try again in a minute.", 0);
  }
  const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (r.status === 429) {
    const reset = Number(r.headers.get('ratelimit-reset'));
    throw new BlueskyError(`Bluesky says slow down: try again ${Number.isFinite(reset) && reset > 0 ? `after ${hhmm(reset * 1000, d.tz)}` : 'in a few minutes'}.`, 429, 'RateLimitExceeded');
  }
  if (!r.ok) {
    const code = String(j.error ?? '');
    const said = String(j.message ?? code ?? '').slice(0, 160);
    const words =
      r.status === 401 && nsid === 'com.atproto.server.createSession' ? 'Bluesky turned that sign-in down: check the handle and the app password (make a new one if in doubt).' :
      code === 'AccountTakedown' || code === 'AccountDeactivated' ? 'Bluesky says the account is not active.' :
      `Bluesky answered ${r.status}${said ? `: ${said}` : ''}.`;
    throw new BlueskyError(words, r.status, code);
  }
  return j;
}

/** Signed in with his handle and app password: the session, where his account lives. Refuses a main password's session. */
async function signIn(d: SocialDeps, handle: string, password: string): Promise<Saved> {
  const j = await call(d, 'com.atproto.server.createSession', { base: ENTRY, method: 'POST', body: { identifier: handle, password } });
  const access = String(j.accessJwt ?? '');
  // a session made with the main password says so ("com.atproto.access"): never kept, never used
  if (claims(access).scope === 'com.atproto.access') throw new BlueskyError('That is your main password, not an app password. Make an app password (Settings → Privacy and security → App passwords) and paste that instead.', 400);
  const doc = j.didDoc as { service?: { id?: string; type?: string; serviceEndpoint?: string }[] } | undefined;
  const pds = doc?.service?.find((s) => s.type === 'AtprotoPersonalDataServer' || s.id === '#atproto_pds')?.serviceEndpoint;
  return { handle: String(j.handle ?? handle), did: String(j.did ?? ''), service: /^https:\/\//.test(pds ?? '') ? pds!.replace(/\/+$/, '') : ENTRY, access, refresh: String(j.refreshJwt ?? ''), password };
}

/** The session made fresh: refreshed, or signed in again with the app password when the refresh has gone too. */
async function renew(d: SocialDeps, s: Saved): Promise<Saved> {
  let next: Saved;
  try {
    const j = await call(d, 'com.atproto.server.refreshSession', { base: s.service, method: 'POST', token: s.refresh });
    next = { ...s, access: String(j.accessJwt ?? ''), refresh: String(j.refreshJwt ?? s.refresh) };
  } catch (e) {
    if ((e as BlueskyError).status === 429) throw e;
    next = { ...(await signIn(d, s.handle, s.password)), ...(s.search ? { search: s.search } : {}) };
  }
  await save(d, next);
  return next;
}

/** A call with his session: refreshed first when it is about to run out, and once more if Bluesky says it expired. */
async function authed(d: SocialDeps, nsid: string, o: Omit<Parameters<typeof call>[2], 'base' | 'token'>): Promise<{ j: Record<string, unknown>; s: Saved }> {
  let s = await load(d);
  if (!s) throw new BlueskyError(notLinked('bluesky'), 0);
  const exp = claims(s.access).exp;
  if (exp && exp * 1000 < d.now() + 60_000) s = await renew(d, s);
  try {
    return { j: await call(d, nsid, { ...o, base: s.service, token: s.access }), s };
  } catch (e) {
    const err = e as BlueskyError;
    if (!(err.code === 'ExpiredToken' || err.code === 'InvalidToken' || err.status === 401)) throw e;
    s = await renew(d, s);
    return { j: await call(d, nsid, { ...o, base: s.service, token: s.access }), s };
  }
}

interface BskyPost {
  uri?: string;
  author?: { handle?: string; displayName?: string };
  record?: { text?: string; createdAt?: string };
  indexedAt?: string;
}
const toPost = (p: BskyPost): FeedPost | null => {
  const handle = p.author?.handle;
  if (!handle || !p.uri) return null;
  const at = Date.parse(p.record?.createdAt ?? p.indexedAt ?? '');
  return { author: handle, ...(p.author?.displayName ? { name: p.author.displayName.slice(0, 60) } : {}), at: Number.isFinite(at) ? at : 0, text: String(p.record?.text ?? '').slice(0, 600), link: postLink(handle, p.uri) };
};

/** The profile he means: its id, and the follow record when he already follows it. */
async function profile(d: SocialDeps, who: string): Promise<{ did: string; handle: string; following?: string }> {
  const { j } = await authed(d, 'app.bsky.actor.getProfile', { query: { actor: handleOf(who) } });
  const viewer = j.viewer as { following?: string } | undefined;
  return { did: String(j.did ?? ''), handle: String(j.handle ?? handleOf(who)), ...(viewer?.following ? { following: viewer.following } : {}) };
}

export const BLUESKY: AccountApi = {
  async who(d) {
    const s = await load(d);
    return s ? `@${s.handle}` : null;
  },
  async link(d, body) {
    const handle = handleOf(body.handle);
    const password = String(body.password ?? '').trim();
    if (!handle) throw new BlueskyError('Type the handle (like you.bsky.social).', 400);
    if (!APP_PASSWORD.test(password)) throw new BlueskyError('That is not an app password (four groups of four, like abcd-efgh-ijkl-mnop). Never your main password: make one in Bluesky → Settings → Privacy and security → App passwords.', 400);
    const s = await signIn(d, handle, password);
    const search = String(body.search ?? '').trim().slice(0, 80);
    await save(d, { ...s, ...(search ? { search } : {}) });
    return { who: `@${s.handle}`, info: 'Linked. Every post waits for your APPROVE; I read your home timeline when you ask, and each morning for the digest.' };
  },
  async unlink(d) {
    await d.vault.set(VAULT, '');
  },
  async post(d, draft: Draft) {
    const s0 = await load(d);
    if (!s0) throw new BlueskyError(notLinked('bluesky'), 0);
    let embed: unknown;
    if (draft.image) {
      const pic = d.images ? await imageBytes(d.images, draft.image.id) : null;
      if (!pic) throw new BlueskyError('That picture is no longer kept (pictures last a day): make or share it again.', 0);
      if (pic.bytes.byteLength > MAX_PICTURE) throw new BlueskyError(`Bluesky takes pictures up to 1 MB; this one is ${(pic.bytes.byteLength / 1e6).toFixed(1)} MB.`, 0);
      const { j } = await authed(d, 'com.atproto.repo.uploadBlob', { method: 'POST', bytes: pic.bytes, type: pic.type });
      embed = { $type: 'app.bsky.embed.images', images: [{ alt: draft.image.alt, image: j.blob }] };
    }
    const facets = linkFacets(draft.text);
    const record = { $type: 'app.bsky.feed.post', text: draft.text, createdAt: new Date(d.now()).toISOString(), langs: ['en'], ...(facets.length ? { facets } : {}), ...(embed ? { embed } : {}) };
    try {
      const { j, s } = await authed(d, 'com.atproto.repo.createRecord', { method: 'POST', body: { repo: s0.did, collection: 'app.bsky.feed.post', ...(draft.rkey ? { rkey: draft.rkey } : {}), record } });
      return { link: postLink(s.handle, String(j.uri ?? '')) };
    } catch (e) {
      // the same draft approved again after a lost answer: its record key is already there, so it went the first time
      if (draft.rkey && /already exists/i.test(String((e as Error).message))) return { link: postLink(s0.handle, draft.rkey) };
      throw e;
    }
  },
  async follow(d, draft: Draft) {
    const s = await load(d);
    if (!s) throw new BlueskyError(notLinked('bluesky'), 0);
    const p = await profile(d, draft.who ?? '');
    if (!p.did) throw new BlueskyError(`I can't find ${draft.who} on Bluesky.`, 404);
    const link = `https://bsky.app/profile/${p.handle}`;
    if (draft.kind === 'follow') {
      if (p.following) return { link };
      await authed(d, 'com.atproto.repo.createRecord', { method: 'POST', body: { repo: s.did, collection: 'app.bsky.graph.follow', record: { $type: 'app.bsky.graph.follow', subject: p.did, createdAt: new Date(d.now()).toISOString() } } });
      return { link };
    }
    if (p.following) await authed(d, 'com.atproto.repo.deleteRecord', { method: 'POST', body: { repo: s.did, collection: 'app.bsky.graph.follow', rkey: p.following.split('/').pop() } });
    return { link };
  },
  async read(d, n = 20) {
    const { j } = await authed(d, 'app.bsky.feed.getTimeline', { query: { limit: n } });
    return ((j.feed as { post?: BskyPost }[] | undefined) ?? []).map((f) => (f.post ? toPost(f.post) : null)).filter((p): p is FeedPost => !!p);
  },
  async search(d, q, n = 15) {
    const { j } = await authed(d, 'app.bsky.feed.searchPosts', { query: { q, limit: n, sort: 'latest' } });
    return ((j.posts as BskyPost[] | undefined) ?? []).map(toPost).filter((p): p is FeedPost => !!p);
  },
  async max() {
    return 300;
  },
};

/**
 * The morning digest's Bluesky (library/digest.ts `more`): his home timeline and his one search, each one passage in the
 * LEAD tier — where claims are found, never what proves them. At most three requests; nothing when Bluesky isn't linked.
 */
export async function blueskyDigest(d: SocialDeps): Promise<{ source: string; tier: 'lead'; text: string }[]> {
  const s = await load(d);
  if (!s) return [];
  const day = dayOf(d.now());
  const out: { source: string; tier: 'lead'; text: string }[] = [];
  const home = await BLUESKY.read!(d, 20).catch(() => null);
  if (home?.length) out.push({ source: 'Bluesky', tier: 'lead', text: `Fresh knowledge ${day} — Bluesky, your home timeline (bsky.app; leads, never proof):\n${postLines(home, d.tz, 15).join('\n')}` });
  if (s.search) {
    const found = await BLUESKY.search!(d, s.search, 10).catch(() => null);
    if (found?.length) out.push({ source: `Bluesky search ${s.search.replace(/[·\n]/g, ' ').slice(0, 40)}`, tier: 'lead', text: `Fresh knowledge ${day} — Bluesky, a search for “${s.search}” (bsky.app; leads, never proof):\n${postLines(found, d.tz, 10).join('\n')}` });
  }
  return out;
}

/** The heading a Bluesky passage is filed under (the tests read it). */
export const blueskyHeading = (day: string) => digestHeading(day, 'Bluesky', 'lead');
