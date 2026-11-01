/**
 * HIS OWN TELEGRAM CHANNEL (BRIEF-SOCIAL item 6): the bot he already paired (LINKS → TELEGRAM, its token in the vault) posts
 * to a channel he names, after he adds it there as an admin — only through the queue, on his APPROVE. Linking checks with
 * Telegram that it is a channel and that the bot may post in it. The channel's name is not a secret: it is kept in the
 * brain's storage. A bot cannot read a channel's history, so there is no reading here; and never a message to a person.
 */
import { notLinked, type Draft } from '../../../../packages/shared/src/social';
import type { AccountApi, SocialDeps } from './index';

export const CHANNEL_KEY = 'social:channel';

interface Saved {
  /** The channel's id (-100…), as Telegram gave it. */
  chat: number;
  title: string;
  /** A public channel's @name (its posts get t.me links), without the @. */
  username?: string;
}

class ChannelError extends Error {}

/** "@name" from "@name", "name", "https://t.me/name"; a private channel's "-100…" id as it is; '' when neither. */
export function channelOf(v: unknown): string {
  const s = String(v ?? '').trim();
  if (/^-100\d{5,}$/.test(s)) return s;
  const name = s.replace(/^https?:\/\/t\.me\//i, '').replace(/^@/, '').replace(/[/?#].*$/, '');
  return /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(name) ? `@${name}` : '';
}

/** One Bot API call with the paired bot's token. Telegram's own words come back in plain words. */
async function bot(d: SocialDeps, token: string, method: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  let r: Response;
  try {
    r = await d.fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(12_000) });
  } catch {
    throw new ChannelError("I couldn't reach Telegram just now. Try again in a minute.");
  }
  const j = (await r.json().catch(() => ({}))) as { ok?: boolean; result?: Record<string, unknown>; description?: string; error_code?: number; parameters?: { retry_after?: number } };
  if (j.ok) return j.result ?? {};
  if (j.error_code === 429) throw new ChannelError(`Telegram says slow down: try again in ${j.parameters?.retry_after ?? 30} seconds.`);
  const said = String(j.description ?? `HTTP ${r.status}`).replace(token, '…').slice(0, 160);
  throw new ChannelError(/chat not found/i.test(said) ? 'Telegram cannot find that channel: check its @name (and that my bot is in it).' : `Telegram said: ${said}.`);
}

async function load(d: SocialDeps): Promise<Saved | null> {
  const s = await d.storage.get<Saved>(CHANNEL_KEY).catch(() => undefined);
  return s && typeof s.chat === 'number' ? s : null;
}

async function tokenOf(d: SocialDeps): Promise<string> {
  const t = await d.vault.get('telegram').catch(() => null);
  if (!t) throw new ChannelError('Pair my Telegram bot first: LINKS → TELEGRAM.');
  return t;
}

export const CHANNEL: AccountApi = {
  async who(d) {
    const s = await load(d);
    return s ? (s.username ? `@${s.username}` : s.title) : null;
  },
  async link(d, body) {
    const chat = channelOf(body.channel);
    if (!chat) throw new ChannelError('Type the channel’s @name (or its t.me link); a private channel’s id starts -100.');
    const token = await tokenOf(d);
    const me = await bot(d, token, 'getMe', {});
    const c = await bot(d, token, 'getChat', { chat_id: chat });
    if (c.type !== 'channel') throw new ChannelError('That is not a channel (a group or a person is never posted to from here).');
    const m = await bot(d, token, 'getChatMember', { chat_id: c.id, user_id: me.id });
    if (m.status !== 'administrator' || m.can_post_messages === false) throw new ChannelError('Add my bot to the channel as an admin with “Post messages” on (Channel → Administrators → Add Admin), then link it again.');
    const s: Saved = { chat: Number(c.id), title: String(c.title ?? 'your channel').slice(0, 80), ...(c.username ? { username: String(c.username) } : {}) };
    await d.storage.put(CHANNEL_KEY, s);
    return { who: s.username ? `@${s.username}` : s.title, info: 'Linked. My bot posts there only what you APPROVE.' };
  },
  async unlink(d) {
    await d.storage.delete(CHANNEL_KEY);
  },
  async post(d, draft: Draft) {
    const s = await load(d);
    if (!s) throw new ChannelError(notLinked('channel'));
    const sent = await bot(d, await tokenOf(d), 'sendMessage', { chat_id: s.chat, text: draft.text });
    return { link: s.username ? `https://t.me/${s.username}/${String(sent.message_id ?? '')}` : undefined };
  },
  async max() {
    return 4096;
  },
};
