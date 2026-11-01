/**
 * HIS OWN ACCOUNTS (BRIEF-SOCIAL items 2–6): the accounts he made himself and linked in LINKS — Bluesky (bluesky.ts),
 * Mastodon (mastodon.ts), a bot in his own Discord server (discord.ts) and his own Telegram channel (channel.ts) — behind
 * the one approval queue (queue.ts). Every post, follow and unfollow is a draft until he presses APPROVE; reading is his own
 * timelines and public posts only; never a direct message, never anything that bills; the keys live in the vault.
 *
 *   GET    /social                     → { accounts, drafts, sent }  (what is linked, what waits, what went out today)
 *   POST   /social/link   { account, … } → { who, info }             (the key checked by signing in, then kept in the vault)
 *   DELETE /social/link?account=…       → unlinked
 *   POST   /social/draft  { account, text, image?, alt? } → { draft, card }  (the phone's POST THAT?: a draft, never a post)
 *   POST   /social/approve { id }       → { draft, said } | { error }       (his APPROVE: sent once)
 *   POST   /social/edit   { id, text?, alt? } → { draft, card }
 *   POST   /social/no     { id }        → { draft }
 */
import { localDay } from '../../../../packages/shared/src/cadence';
import { accountName, ACCOUNT_IDS, draftCard, notLinked, postLines, postProblem, type Account, type Draft, type FeedPost } from '../../../../packages/shared/src/social';
import type { Card } from '../../../../packages/shared/src/cards';
import type { Vault } from '../kernel/vault';
import type { ImageKv } from '../lens';
import { addDraft, approveDraft, editDraft, findDraft, loadDrafts, refuseDraft, sentSince, type Sent } from './queue';
import { BLUESKY, blueskyDigest } from './bluesky';
import { MASTODON } from './mastodon';

export interface SocialDeps {
  storage: DurableObjectStorage;
  vault: Pick<Vault, 'get' | 'set'>;
  fetch: typeof fetch;
  now: () => number;
  /** His time zone (the phone's, kept by the brain). */
  tz: string;
  /** His pictures (/i/<id>: made by Ghosty or shared from the Lens), the only pictures a post may carry. */
  images?: ImageKv | null;
}

/** What one account can do: who is linked, link and unlink, and the calls behind the queue. */
export interface AccountApi {
  /** Who is linked ("@sam.bsky.social"), or null. Never throws. */
  who(d: SocialDeps): Promise<string | null>;
  /** Check the key by signing in, then keep it: who it is, and a line about it. Throws in plain words. */
  link(d: SocialDeps, body: Record<string, unknown>): Promise<{ who: string; info: string }>;
  unlink(d: SocialDeps): Promise<void>;
  post?(d: SocialDeps, draft: Draft): Promise<{ link?: string }>;
  follow?(d: SocialDeps, draft: Draft): Promise<{ link?: string }>;
  read?(d: SocialDeps, n?: number): Promise<FeedPost[]>;
  search?(d: SocialDeps, q: string, n?: number): Promise<FeedPost[]>;
  /** Its own longest post, when the server says (Mastodon's can be more than 500). */
  max?(d: SocialDeps): Promise<number | null>;
}

/** The accounts this brain can use. */
export const APIS: Partial<Record<Account, AccountApi>> = { bluesky: BLUESKY, mastodon: MASTODON };

/** The morning digest's passages from his accounts (library/digest.ts `more`): Bluesky's timeline and search, as LEADs. */
export async function socialDigest(d: SocialDeps): Promise<{ source: string; tier: 'lead'; text: string }[]> {
  return blueskyDigest(d).catch(() => []);
}

/** The last read of an account's timeline or a search, kept for "what's on Bluesky?" when it cannot be read again now. */
export const lastKey = (a: Account, what = 'home') => `social:last:${a}:${what}`;
export interface LastRead {
  at: number;
  posts: FeedPost[];
}
/** A read younger than this is answered again from what was read (the accounts' rate limits are kept). */
const FRESH_MS = 90_000;

export async function linkedAs(d: SocialDeps, a: Account): Promise<string | null> {
  const api = APIS[a];
  return api ? api.who(d).catch(() => null) : null;
}

/** The accounts he has linked, in order. */
export async function linkedAccounts(d: SocialDeps): Promise<Account[]> {
  const out: Account[] = [];
  for (const a of ACCOUNT_IDS) if (await linkedAs(d, a)) out.push(a);
  return out;
}

/** The send behind APPROVE: the account's own call for a post, a follow or an unfollow. */
export async function sendDraft(d: SocialDeps, draft: Draft): Promise<{ link?: string }> {
  const api = APIS[draft.account];
  if (!api || !(await linkedAs(d, draft.account))) throw new Error(notLinked(draft.account));
  if (draft.kind === 'post') {
    if (!api.post) throw new Error(`I can't post on ${accountName(draft.account)} yet.`);
    return api.post(d, draft);
  }
  if (!api.follow) throw new Error(`I can't follow anyone on ${accountName(draft.account)}: it has no follows.`);
  return api.follow(d, draft);
}

/** His timeline (or a search), read now — or from the last read when that is under a minute and a half old, or now fails. */
export async function readAccount(d: SocialDeps, a: Account, query = ''): Promise<{ posts: FeedPost[]; at: number; stale?: string }> {
  const api = APIS[a];
  if (!api || !(await linkedAs(d, a))) throw new Error(notLinked(a));
  const fn = query ? api.search : api.read;
  if (!fn) throw new Error(query ? `I can't search ${accountName(a)}.` : `I can't read ${accountName(a)}.`);
  const key = lastKey(a, query ? `search:${query.toLowerCase().slice(0, 60)}` : 'home');
  const last = await d.storage.get<LastRead>(key).catch(() => undefined);
  if (last && d.now() - last.at < FRESH_MS) return last;
  try {
    const posts = query ? await api.search!(d, query) : await api.read!(d);
    const got = { at: d.now(), posts: posts.slice(0, 20) };
    await d.storage.put(key, got).catch(() => undefined);
    return got;
  } catch (e) {
    if (last) return { ...last, stale: String((e as Error)?.message ?? e).slice(0, 160) };
    throw e;
  }
}

/** A read in words, with its authors and times: "From Bluesky (your home timeline), read 14:05: …". */
export function readWords(a: Account, r: { posts: FeedPost[]; at: number; stale?: string }, tz: string, query = ''): string {
  const when = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(r.at);
  const what = query ? `a search for “${query}”` : a === 'discord' ? 'your channel' : 'your home timeline';
  const head = `From ${accountName(a)} (${what}), read at ${when}${r.stale ? ` — it didn't answer just now (${r.stale}), so this is the last read` : ''}:`;
  if (!r.posts.length) return `${head} nothing there.`;
  return [head, ...postLines(r.posts, tz), `(Posts on ${accountName(a)} are leads, never proof: where a claim is found, not what proves it.)`].join('\n');
}

/** Words and a picture checked, then a draft and its card. */
export async function makeDraft(
  d: SocialDeps,
  b: { account: Account; text: string; image?: string; alt?: string; from: Draft['from']; kind?: Draft['kind']; who?: string },
): Promise<{ draft: Draft; card: Card } | { error: string }> {
  const kind = b.kind ?? 'post';
  if (kind === 'post') {
    const image = b.image ? { id: b.image, alt: b.alt ?? '' } : null;
    if (image && !/^[A-Za-z0-9_-]{16}$/.test(image.id)) return { error: 'A picture has to be one of yours here (one I made or one you shared from the Lens): its link ends /i/ and sixteen letters.' };
    const max = (await APIS[b.account]?.max?.(d).catch(() => null)) ?? undefined;
    const problem = postProblem(b.account, b.text, image, max);
    if (problem) return { error: problem };
  } else if (!String(b.who ?? '').trim()) return { error: 'Who to follow? A handle like @sam.bsky.social, or their profile link.' };
  const draft = await addDraft(d.storage, { account: b.account, kind, text: b.text, from: b.from, ...(b.who ? { who: b.who.trim() } : {}), ...(b.image ? { image: { id: b.image, alt: (b.alt ?? '').trim() } } : {}), ...(b.account === 'bluesky' && kind === 'post' ? { rkey: tidNow(d.now()) } : {}) }, d.now());
  return { draft, card: draftCard(draft, d.now()) };
}

const S32 = '234567abcdefghijklmnopqrstuvwxyz';
/** An AT Protocol record key from a time (a TID): 13 letters, sortable; chosen once per draft so APPROVE can never post twice. */
export function tidNow(ms: number, clock = Math.floor(Math.random() * 1024)): string {
  let n = ((BigInt(Math.floor(ms)) * 1000n) << 10n) | BigInt(clock & 1023);
  let out = '';
  for (let i = 0; i < 13; i++) {
    out = S32[Number(n & 31n)]! + out;
    n >>= 5n;
  }
  return out;
}

/** What is linked, what waits for him, and what went out today (his day starts at midnight on his clock). */
export async function socialStatus(d: SocialDeps): Promise<{ accounts: { id: Account; name: string; who: string | null }[]; drafts: Draft[]; sent: Sent[] }> {
  const accounts = await Promise.all(ACCOUNT_IDS.map(async (id) => ({ id, name: accountName(id), who: await linkedAs(d, id) })));
  const drafts = (await loadDrafts(d.storage, d.now())).slice(-12);
  const today = localDay(d.now(), d.tz);
  return { accounts, drafts, sent: (await sentSince(d.storage, d.now() - 36 * 3_600_000)).filter((x) => localDay(x.at, d.tz) === today) };
}

/** The status in words, for the tool: linked accounts, drafts waiting, what went out today. */
export async function statusWords(d: SocialDeps): Promise<string> {
  const s = await socialStatus(d);
  const linked = s.accounts.filter((a) => a.who);
  const waiting = s.drafts.filter((x) => x.state === 'waiting' || x.state === 'failed');
  const today = s.sent;
  return [
    linked.length ? `Linked: ${linked.map((a) => `${a.name} as ${a.who}`).join('; ')}.` : 'No account is linked yet: LINKS → BLUESKY, MASTODON, DISCORD or TELEGRAM CHANNEL.',
    waiting.length ? `Waiting for his APPROVE: ${waiting.map((x) => `${accountName(x.account)} “${(x.kind === 'post' ? x.text : `${x.kind} ${x.who}`).slice(0, 60)}”`).join('; ')}.` : 'Nothing is waiting for his APPROVE.',
    today.length ? `Sent today with his APPROVE: ${today.length}.` : 'Nothing was sent today.',
  ].join(' ');
}

// ---------------------------------------------------------------- Telegram's buttons (telegram.ts)

export const EDITING_KEY = 'social:editing';
const EDIT_MS = 10 * 60_000;

/** What his Telegram chat may do with a draft: APPROVE, NO, EDIT (his next message is the new words). */
export interface SocialTelegram {
  approve(id: string): Promise<string>;
  refuse(id: string): Promise<string>;
  editAsk(id: string): Promise<string>;
  /** His message as the new words of the draft he pressed EDIT on (null: no edit is waiting, so it is a normal message). */
  editWith(text: string): Promise<{ draft: Draft } | { error: string } | null>;
}

export function socialTelegram(d: SocialDeps): SocialTelegram {
  return {
    async approve(id) {
      const r = await approveDraft(d.storage, id, (x) => sendDraft(d, x), { on: 'telegram', now: d.now });
      return 'error' in r ? r.error : r.said;
    },
    async refuse(id) {
      const r = await refuseDraft(d.storage, id, d.now());
      return 'error' in r ? r.error : 'Dropped: nothing went out.';
    },
    async editAsk(id) {
      const x = await findDraft(d.storage, id, d.now());
      if (!x || !(x.state === 'waiting' || x.state === 'failed') || d.now() > x.expires) return 'That draft can no longer be changed. Ask me again.';
      await d.storage.put(EDITING_KEY, { id, until: d.now() + EDIT_MS });
      return x.kind === 'post' ? 'Send me the new words for it in your next message (within 10 minutes). Nothing goes out until you press APPROVE.' : 'A follow has no words to change: press APPROVE or NO.';
    },
    async editWith(text) {
      const e = await d.storage.get<{ id: string; until: number }>(EDITING_KEY).catch(() => undefined);
      if (!e) return null;
      await d.storage.delete(EDITING_KEY);
      if (d.now() > e.until) return null;
      const x = await findDraft(d.storage, e.id, d.now());
      if (!x || x.kind !== 'post') return null;
      const max = (await APIS[x.account]?.max?.(d).catch(() => null)) ?? undefined;
      const problem = postProblem(x.account, text, x.image ?? null, max);
      if (problem) return { error: problem };
      const r = await editDraft(d.storage, e.id, { text }, d.now());
      return 'error' in r ? r : { draft: r };
    },
  };
}

// ---------------------------------------------------------------- the route

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const accountIn = (v: unknown): Account | null => (ACCOUNT_IDS.includes(String(v ?? '') as Account) ? (String(v) as Account) : null);

export async function socialRoute(req: Request, path: string, method: string, url: URL, d: SocialDeps): Promise<Response> {
  const body = method === 'POST' ? ((await req.json().catch(() => ({}))) as Record<string, unknown>) : {};
  if (path === '/social' && method === 'GET') return json(await socialStatus(d));
  if (path === '/social/link' && (method === 'POST' || method === 'DELETE')) {
    const a = accountIn(method === 'POST' ? body.account : url.searchParams.get('account'));
    const api = a ? APIS[a] : undefined;
    if (!a || !api) return json({ error: 'no such account' }, 400);
    if (method === 'DELETE') {
      await api.unlink(d);
      return json({ ok: true, who: null });
    }
    try {
      return json({ ok: true, ...(await api.link(d, body)) });
    } catch (e) {
      return json({ ok: false, error: String((e as Error)?.message ?? e).slice(0, 300) }, 400);
    }
  }
  if (path === '/social/draft' && method === 'POST') {
    const a = accountIn(body.account);
    if (!a) return json({ error: 'no such account' }, 400);
    if (!(await linkedAs(d, a))) return json({ error: notLinked(a) }, 400);
    const r = await makeDraft(d, { account: a, text: String(body.text ?? ''), ...(body.image ? { image: String(body.image), alt: String(body.alt ?? '') } : {}), from: body.from === 'musing' ? 'musing' : 'phone' });
    return json(r, 'error' in r ? 400 : 200);
  }
  const id = String(body.id ?? '');
  if (path === '/social/approve' && method === 'POST') {
    const r = await approveDraft(d.storage, id, (x) => sendDraft(d, x), { on: 'phone', now: d.now });
    return json({ ...r, ...(r.draft ? { card: draftCard(r.draft, d.now()) } : {}) }, 'error' in r && !r.draft ? 409 : 200);
  }
  if (path === '/social/edit' && method === 'POST') {
    const x = await findDraft(d.storage, id, d.now());
    if (x && body.text !== undefined && x.kind === 'post') {
      const max = (await APIS[x.account]?.max?.(d).catch(() => null)) ?? undefined;
      const problem = postProblem(x.account, String(body.text), x.image ? { ...x.image, ...(body.alt !== undefined ? { alt: String(body.alt) } : {}) } : null, max);
      if (problem) return json({ error: problem }, 400);
    }
    const r = await editDraft(d.storage, id, { ...(body.text !== undefined ? { text: String(body.text) } : {}), ...(body.alt !== undefined ? { alt: String(body.alt) } : {}) }, d.now());
    return 'error' in r ? json(r, 409) : json({ draft: r, card: draftCard(r, d.now()) });
  }
  if (path === '/social/no' && method === 'POST') {
    const r = await refuseDraft(d.storage, id, d.now());
    return 'error' in r ? json(r, 409) : json({ draft: r, card: draftCard(r, d.now()) });
  }
  return json({ error: 'not found' }, 404);
}
