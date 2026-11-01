/**
 * DISCORD (BRIEF-SOCIAL item 5): his own bot in his own server, over Discord's REST API and an Interactions endpoint — no
 * gateway (a Worker cannot hold one open). LINKS → DISCORD takes the bot's token, the application's id and public key, and
 * the one server and channel he picks; linking checks each against Discord and registers one command there, /ask.
 *
 *  - TALKING TO IT: /ask in his server reaches the brain through POST /api/discord/interactions, which checks Discord's
 *    Ed25519 signature before it reads anything (WebCrypto, no library); only the application's owner — him — gets an
 *    answer, and only he sees it; anyone else gets one polite line. (Without a gateway Discord does not tell a bot about
 *    @mentions: /ask is how it is spoken to.)
 *  - POSTING to his channel only through the queue, on his APPROVE (its nonce is the draft's, so never twice), with no
 *    one pinged by it;
 *  - READING the channel's last messages, if the bot may (and their words only with the Message Content intent).
 *  Never a direct message: no DM channel is ever opened.
 */
import { notLinked, type Draft, type FeedPost } from '../../../../packages/shared/src/social';
import type { AccountApi, SocialDeps } from './index';

export const DISCORD_API = 'https://discord.com/api/v10';
const VAULT = 'discord';
const SNOWFLAKE = /^\d{17,21}$/;

interface Saved {
  token: string;
  app: string;
  key: string;
  guild: string;
  channel: string;
  channelName: string;
  /** The application's owner on Discord: the only one /ask answers. */
  owner: string;
}

async function load(d: SocialDeps): Promise<Saved | null> {
  const raw = await d.vault.get(VAULT).catch(() => null);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Saved;
    return s && typeof s.token === 'string' && typeof s.owner === 'string' ? s : null;
  } catch {
    return null;
  }
}

class DiscordError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** One REST call as the bot. A 429 says how long to wait; every error is in plain words. */
async function call(d: SocialDeps, token: string, method: string, path: string, body?: unknown): Promise<Record<string, unknown>> {
  let r: Response;
  try {
    r = await d.fetch(`${DISCORD_API}${path}`, { method, headers: { authorization: `Bot ${token}`, accept: 'application/json', ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(12_000) });
  } catch {
    throw new DiscordError("I couldn't reach Discord just now. Try again in a minute.", 0);
  }
  const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (r.status === 429) throw new DiscordError(`Discord says slow down: try again in ${Math.ceil(Number(j.retry_after) || 5)} seconds.`, 429);
  if (!r.ok) {
    const said = String(j.message ?? '').slice(0, 160);
    throw new DiscordError(
      r.status === 401 ? 'Discord turned the bot token down: reset it in the Developer Portal (Bot → Reset Token) and link it again.' :
      r.status === 403 ? 'My bot may not do that there: it needs View Channels, Send Messages and Read Message History in that channel.' :
      r.status === 404 ? 'Discord cannot find that: check the server and channel ids (Developer Mode → Copy ID).' :
      `Discord answered ${r.status}${said ? `: ${said}` : ''}.`,
      r.status,
    );
  }
  return j;
}

const hex = (s: string): Uint8Array<ArrayBuffer> => new Uint8Array((s.match(/../g) ?? []).map((b) => parseInt(b, 16)));

/** Discord's signature on an interaction: Ed25519 over the timestamp and the raw body, by the application's public key. */
export async function verifyDiscord(publicKeyHex: string, signatureHex: string, timestamp: string, body: string): Promise<boolean> {
  if (!/^[0-9a-f]{64}$/i.test(publicKeyHex) || !/^[0-9a-f]{128}$/i.test(signatureHex) || !timestamp) return false;
  try {
    const key = await crypto.subtle.importKey('raw', hex(publicKeyHex), { name: 'Ed25519' }, false, ['verify']);
    return await crypto.subtle.verify({ name: 'Ed25519' }, key, hex(signatureHex), new TextEncoder().encode(timestamp + body));
  } catch {
    return false;
  }
}

/** The one command registered in his server. */
export const ASK_COMMAND = { name: 'ask', description: 'Ask me anything (only you get the answer)', type: 1, options: [{ type: 3, name: 'words', description: 'What to ask', required: true }] };
/** What anyone but him gets: one polite line, seen only by them. */
export const NOT_YOU = 'I only answer the person who made me. Sorry!';

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json' } });

/**
 * POST /api/discord/interactions (public: Discord calls it). The signature is checked first; nothing is read before it.
 * PING → PONG; /ask from him → "thinking" (only he sees it), then the brain's answer put in its place; from anyone else →
 * one polite line only they see. `turn`: one brain turn with his words, its reply as plain text.
 */
export async function discordInteraction(req: Request, d: SocialDeps, turn: (words: string) => Promise<string>, waitUntil: (p: Promise<unknown>) => void): Promise<Response> {
  const sig = req.headers.get('x-signature-ed25519') ?? '';
  const ts = req.headers.get('x-signature-timestamp') ?? '';
  const raw = await req.text();
  const s = await load(d);
  if (!s || !(await verifyDiscord(s.key, sig, ts, raw))) return new Response('invalid request signature', { status: 401 });
  let i: { type?: number; application_id?: string; guild_id?: string; token?: string; data?: { name?: string; options?: { name?: string; value?: unknown }[] }; member?: { user?: { id?: string } }; user?: { id?: string } };
  try {
    i = JSON.parse(raw) as typeof i;
  } catch {
    return new Response('bad request', { status: 400 });
  }
  if (i.type === 1) return json({ type: 1 });
  if (i.application_id && i.application_id !== s.app) return new Response('not this application', { status: 401 });
  const who = i.member?.user?.id ?? i.user?.id;
  if (who !== s.owner || (i.guild_id && i.guild_id !== s.guild)) return json({ type: 4, data: { content: NOT_YOU, flags: 64, allowed_mentions: { parse: [] } } });
  if (i.type !== 2 || i.data?.name !== ASK_COMMAND.name) return json({ type: 4, data: { content: 'Ask me with /ask.', flags: 64 } });
  const words = String(i.data.options?.find((o) => o.name === 'words')?.value ?? '').trim().slice(0, 2000);
  if (!words || !i.token) return json({ type: 4, data: { content: 'Ask me something with /ask.', flags: 64 } });
  const token = i.token;
  waitUntil(
    (async () => {
      const said = await turn(words).catch((e) => `That did not work: ${String((e as Error)?.message ?? e).slice(0, 200)}`);
      await d.fetch(`${DISCORD_API}/webhooks/${s.app}/${token}/messages/@original`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: said.slice(0, 2000) || 'Done.', allowed_mentions: { parse: [] } }) }).catch(() => undefined);
    })(),
  );
  // "thinking…", then the answer in its place — ephemeral: only he sees what I say in his server
  return json({ type: 5, data: { flags: 64 } });
}

interface Message {
  id?: string;
  content?: string;
  timestamp?: string;
  author?: { username?: string; global_name?: string | null; bot?: boolean };
}

export const DISCORD: AccountApi = {
  async who(d) {
    const s = await load(d);
    return s ? `#${s.channelName} in your server` : null;
  },
  async link(d, body) {
    const token = String(body.token ?? '').trim();
    const app = String(body.app ?? '').trim();
    const key = String(body.key ?? '').trim().toLowerCase();
    const guild = String(body.guild ?? '').trim();
    const channel = String(body.channel ?? '').trim();
    if (!/^[\w-]{20,}\.[\w-]{4,}\.[\w-]{20,}$/.test(token)) throw new DiscordError('That does not look like a bot token: Developer Portal → your application → Bot → Reset Token, then copy it.', 400);
    if (!SNOWFLAKE.test(app)) throw new DiscordError('The Application ID is a long number: General Information → Application ID.', 400);
    if (!/^[0-9a-f]{64}$/.test(key)) throw new DiscordError('The Public Key is 64 letters and digits: General Information → Public Key.', 400);
    if (!SNOWFLAKE.test(guild) || !SNOWFLAKE.test(channel)) throw new DiscordError('The server and channel ids are long numbers: turn on Developer Mode, then right-click → Copy Server ID / Copy Channel ID.', 400);
    const me = await call(d, token, 'GET', '/users/@me');
    const appInfo = await call(d, token, 'GET', '/applications/@me');
    if (String(appInfo.id) !== app || String(me.id) !== app) throw new DiscordError('That token belongs to another application than that Application ID.', 400);
    if (String(appInfo.verify_key ?? '').toLowerCase() !== key) throw new DiscordError('That Public Key is not this application’s (General Information → Public Key).', 400);
    const team = appInfo.team as { owner_user_id?: string } | null | undefined;
    const owner = String(team?.owner_user_id ?? (appInfo.owner as { id?: string } | undefined)?.id ?? '');
    if (!SNOWFLAKE.test(owner)) throw new DiscordError('Discord did not say who owns the application, so I would not know who to answer.', 400);
    const ch = await call(d, token, 'GET', `/channels/${channel}`);
    if (String(ch.guild_id) !== guild) throw new DiscordError('That channel is not in that server.', 400);
    if (![0, 5].includes(Number(ch.type))) throw new DiscordError('Pick a text channel (not a voice channel, a thread or a category).', 400);
    await call(d, token, 'PUT', `/applications/${app}/guilds/${guild}/commands`, [ASK_COMMAND]);
    const s: Saved = { token, app, key, guild, channel, channelName: String(ch.name ?? 'your channel').slice(0, 60), owner };
    await d.vault.set(VAULT, JSON.stringify(s));
    return { who: `#${s.channelName} in your server`, info: 'Linked. Last step: Developer Portal → General Information → Interactions Endpoint URL: paste the address shown here. Then /ask in your server talks to me.' };
  },
  async unlink(d) {
    await d.vault.set(VAULT, '');
  },
  async post(d, draft: Draft) {
    const s = await load(d);
    if (!s) throw new DiscordError(notLinked('discord'), 0);
    // nobody pinged by it; the nonce is the draft's, so an APPROVE sent twice posts once
    const m = await call(d, s.token, 'POST', `/channels/${s.channel}/messages`, { content: draft.text, allowed_mentions: { parse: [] }, nonce: draft.id, enforce_nonce: true });
    return { link: `https://discord.com/channels/${s.guild}/${s.channel}/${String(m.id ?? '')}` };
  },
  async read(d, n = 20) {
    const s = await load(d);
    if (!s) throw new DiscordError(notLinked('discord'), 0);
    const list = (await call(d, s.token, 'GET', `/channels/${s.channel}/messages?limit=${n}`)) as unknown as Message[];
    const posts = (Array.isArray(list) ? list : []).map((m): FeedPost => {
      const at = Date.parse(m.timestamp ?? '');
      return { author: m.author?.username ?? 'someone', ...(m.author?.global_name ? { name: m.author.global_name.slice(0, 60) } : {}), at: Number.isFinite(at) ? at : 0, text: m.content?.trim() ? m.content.slice(0, 600) : '(its words are hidden from bots unless the Message Content intent is on: Developer Portal → Bot)', ...(m.id ? { link: `https://discord.com/channels/${s.guild}/${s.channel}/${m.id}` } : {}) };
    });
    return posts;
  },
  async max() {
    return 2000;
  },
};
