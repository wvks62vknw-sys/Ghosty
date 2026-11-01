/**
 * MASTODON (BRIEF-SOCIAL item 4): his own account on a server he picked, over its REST API with an access token from his
 * own application there (Preferences → Development → New application; the steps are shown in LINKS → MASTODON). The same
 * shape as Bluesky: every post, follow and unfollow is a draft until his APPROVE; every post is PUBLIC (never "direct":
 * no DMs); his home timeline and a search read with authors and times; the server's own rate limits said in plain words;
 * an APPROVE sent twice can never post twice (Mastodon keeps the draft's id as its Idempotency-Key).
 */
import { notLinked, type Draft, type FeedPost } from '../../../../packages/shared/src/social';
import { imageBytes } from '../lens';
import type { AccountApi, SocialDeps } from './index';

const VAULT = 'mastodon';

interface Saved {
  server: string;
  token: string;
  /** "@me@mastodon.social" */
  acct: string;
  id: string;
  /** The server's longest post (500 on most). */
  max: number;
}

async function load(d: SocialDeps): Promise<Saved | null> {
  const raw = await d.vault.get(VAULT).catch(() => null);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Saved;
    return s && typeof s.server === 'string' && typeof s.token === 'string' ? s : null;
  } catch {
    return null;
  }
}

/** "mastodon.social" from "https://mastodon.social/", "@me@mastodon.social" or "Mastodon.Social"; '' when it is not a host. */
export function serverOf(v: unknown): string {
  const s = String(v ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^@?[^@\s/]+@/, '').replace(/[/?#].*$/, '');
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s) ? s : '';
}

/** "sam@mastodon.social" from "@sam@mastodon.social" or "https://mastodon.social/@sam". */
export function acctOf(v: unknown): string {
  const s = String(v ?? '').trim();
  const link = /^https?:\/\/([^/]+)\/@([^/?#]+)/i.exec(s);
  if (link) return `${link[2]}@${link[1]!.toLowerCase()}`;
  return s.replace(/^@/, '');
}

/** A status's words from its HTML (paragraphs and line breaks kept as lines). */
export function plainOf(html: string): string {
  return String(html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .trim();
}

const hhmm = (ms: number, tz: string) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(ms);

class MastodonError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** One call to his server. A 429 says when to try again; every error is in plain words. */
async function call(d: SocialDeps, s: Pick<Saved, 'server' | 'token'>, method: string, path: string, o: { body?: unknown; form?: FormData; key?: string } = {}): Promise<Record<string, unknown> & { [k: number]: unknown }> {
  const headers: Record<string, string> = { authorization: `Bearer ${s.token}`, accept: 'application/json' };
  if (o.body !== undefined) headers['content-type'] = 'application/json';
  if (o.key) headers['idempotency-key'] = o.key;
  let r: Response;
  try {
    r = await d.fetch(`https://${s.server}${path}`, { method, headers, ...(o.form ? { body: o.form } : o.body !== undefined ? { body: JSON.stringify(o.body) } : {}), signal: AbortSignal.timeout(12_000) });
  } catch {
    throw new MastodonError(`I couldn't reach ${s.server} just now. Try again in a minute.`, 0);
  }
  const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (r.status === 429) {
    const reset = Date.parse(r.headers.get('x-ratelimit-reset') ?? '');
    throw new MastodonError(`Mastodon says slow down: try again ${Number.isFinite(reset) ? `after ${hhmm(reset, d.tz)}` : 'in a few minutes'}.`, 429);
  }
  if (!r.ok) {
    const said = String(j.error ?? '').slice(0, 160);
    throw new MastodonError(r.status === 401 ? `${s.server} turned the token down: make a new one in Preferences → Development and link it again.` : r.status === 403 ? `${s.server} says the token may not do that (it needs read and write).` : `${s.server} answered ${r.status}${said ? `: ${said}` : ''}.`, r.status);
  }
  return j;
}

async function saved(d: SocialDeps): Promise<Saved> {
  const s = await load(d);
  if (!s) throw new MastodonError(notLinked('mastodon'), 0);
  return s;
}

interface Status {
  url?: string;
  uri?: string;
  created_at?: string;
  content?: string;
  account?: { acct?: string; display_name?: string };
  reblog?: Status | null;
}
const toPost = (st: Status): FeedPost | null => {
  const s = st.reblog ?? st;
  const acct = s.account?.acct;
  if (!acct) return null;
  const at = Date.parse(s.created_at ?? '');
  return { author: acct, ...(s.account?.display_name ? { name: s.account.display_name.slice(0, 60) } : {}), at: Number.isFinite(at) ? at : 0, text: plainOf(s.content ?? '').slice(0, 600), ...(s.url || s.uri ? { link: s.url ?? s.uri } : {}) };
};

export const MASTODON: AccountApi = {
  async who(d) {
    return (await load(d))?.acct ?? null;
  },
  async link(d, body) {
    const server = serverOf(body.server);
    const token = String(body.token ?? '').trim();
    if (!server) throw new MastodonError('Type your server, like mastodon.social.', 400);
    if (!/^[A-Za-z0-9_-]{20,200}$/.test(token)) throw new MastodonError('That does not look like an access token: open your application in Preferences → Development and copy “Your access token”.', 400);
    const me = await call(d, { server, token }, 'GET', '/api/v1/accounts/verify_credentials');
    const inst = await call(d, { server, token }, 'GET', '/api/v2/instance').catch(() => ({}) as Record<string, unknown>);
    const max = Number((inst.configuration as { statuses?: { max_characters?: number } } | undefined)?.statuses?.max_characters) || 500;
    const acct = `@${String(me.acct ?? me.username ?? '')}@${server}`;
    await d.vault.set(VAULT, JSON.stringify({ server, token, acct, id: String(me.id ?? ''), max } satisfies Saved));
    return { who: acct, info: `Linked. Every post is public and waits for your APPROVE (up to ${max} characters on ${server}).` };
  },
  async unlink(d) {
    await d.vault.set(VAULT, '');
  },
  async post(d, draft: Draft) {
    const s = await saved(d);
    const media: string[] = [];
    if (draft.image) {
      const pic = d.images ? await imageBytes(d.images, draft.image.id) : null;
      if (!pic) throw new MastodonError('That picture is no longer kept (pictures last a day): make or share it again.', 0);
      const form = new FormData();
      form.append('file', new Blob([pic.bytes], { type: pic.type }), `picture.${pic.type.slice(6)}`);
      form.append('description', draft.image.alt);
      const m = await call(d, s, 'POST', '/api/v2/media', { form });
      media.push(String(m.id ?? ''));
    }
    // public, always: a "direct" status is a DM, and he never sends those through me
    const st = await call(d, s, 'POST', '/api/v1/statuses', { body: { status: draft.text, visibility: 'public', ...(media.length ? { media_ids: media } : {}) }, key: `ghosty-draft-${draft.id}` });
    return { link: String(st.url ?? st.uri ?? '') || undefined };
  },
  async follow(d, draft: Draft) {
    const s = await saved(d);
    const acct = acctOf(draft.who);
    const who = await call(d, s, 'GET', `/api/v1/accounts/lookup?acct=${encodeURIComponent(acct)}`).catch((e: MastodonError) => {
      throw e.status === 404 ? new MastodonError(`I can't find ${draft.who} from ${s.server}.`, 404) : e;
    });
    await call(d, s, 'POST', `/api/v1/accounts/${encodeURIComponent(String(who.id ?? ''))}/${draft.kind === 'unfollow' ? 'unfollow' : 'follow'}`);
    return { link: String(who.url ?? '') || undefined };
  },
  async read(d, n = 20) {
    const s = await saved(d);
    const list = (await call(d, s, 'GET', `/api/v1/timelines/home?limit=${n}`)) as unknown as Status[];
    return (Array.isArray(list) ? list : []).map(toPost).filter((p): p is FeedPost => !!p);
  },
  async search(d, q, n = 10) {
    const s = await saved(d);
    const j = await call(d, s, 'GET', `/api/v2/search?type=statuses&resolve=false&limit=${n}&q=${encodeURIComponent(q)}`);
    return ((j.statuses as Status[] | undefined) ?? []).map(toPost).filter((p): p is FeedPost => !!p);
  },
  async max(d) {
    return (await load(d))?.max ?? null;
  },
};
