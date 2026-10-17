/**
 * Telegram: the owner talks to Ghosty from the Telegram app — text, voice notes, photos — and
 * Ghosty's notifications (reminders, task results) reach them there too.
 *
 * One bot, made by the owner with @BotFather; its token is the `telegram` key in the vault and
 * never leaves it (not in this record, not in a log, not in an error). Saving the key connects
 * the bot: Ghosty registers a webhook at <its address>/api/telegram/hook with a secret that
 * Telegram sends back in a header, so nobody else can post updates. Exactly one chat is
 * answered — the owner's, proved once by sending a 6-digit pairing code shown in the LINKS tab;
 * every other chat is turned away (once an hour, then ignored: no turn is run, no file is
 * downloaded).
 *
 * The link record (bot name, webhook secret, pairing code, paired chat) is kept in the database
 * AND the SITES KV namespace (kv.ts), so Telegram keeps working while the database is paused.
 * A message from the paired chat runs the same turn as the interface's chat (the same tools,
 * the same history), with the streamed events turned into Telegram messages: the reply as
 * text (split under Telegram's limit), a picture link as a photo, an approval as APPROVE /
 * DECLINE buttons answered through a callback.
 */
import type { ChatEvent, TelegramStatus } from '../../../packages/shared/src/protocol';
import type { Env } from './env';
import type { Vault } from './kernel/vault';
import { durableDelete, durableGet, durablePut, storageError } from './kv';
import { MAX_IMAGE_BYTES, sniffImage } from './lens';
import type { ClientContext } from './prompt';
import { MAX_AUDIO_BYTES, SpeechError, toBase64, transcribe } from './speech';

export const LINK_KEY = 'telegram:link';
/** One line for the prompt (second person), for the integrator to place: what Telegram means for the model. */
export const TELEGRAM_ABOUT = 'the owner may also talk to you from Telegram (text, voice notes, photos; your notifications reach them there): reply in plain text, and screen actions only work in the Ghosty app.';
/** A pairing code is good for this long. */
export const CODE_TTL_MS = 15 * 60_000;
/** Telegram takes 4,096 characters a message; replies are cut a little under that, at a paragraph or a sentence. */
export const CHUNK = 4000;
/** A caption's limit: a short reply travels with its picture, a long one goes first on its own. */
const CAPTION = 1024;
/** How long a Telegram message waits for a turn the interface started before saying the brain is busy. */
const WAIT_FOR_TURN_MS = 60_000;
const API = 'https://api.telegram.org';

export interface TelegramLink {
  /**
   * SHA-256 (hex) of what Telegram sends back in X-Telegram-Bot-Api-Secret-Token. The secret
   * itself is kept nowhere but at Telegram: this record is mirrored to KV, which previews of
   * unreviewed changes can read, and a hash lets nobody forge a webhook call.
   */
  secretHash: string;
  /** The bot's username, without the @. */
  bot: string;
  /** The pairing code, while it is valid. */
  code?: string;
  codeUntil?: number;
  /** The one chat Ghosty answers: the owner's. */
  chatId?: number;
  /** The owner's first name on Telegram. */
  name?: string;
}

/** What the brain lends Telegram: the turn, approval and status paths the interface uses, and no other way in. */
export interface TelegramHost {
  env: Env;
  storage: DurableObjectStorage;
  vault: Pick<Vault, 'get'>;
  /** Ghosty's public address (https://…), for picture links. */
  origin: string;
  waitUntil(p: Promise<unknown>): void;
  /** The context the interface sends with a message (name, place, time zone), saying the owner is on Telegram. */
  client(): Promise<ClientContext>;
  /** The turn slot: waits up to `waitMs` for a turn the interface started rather than cutting it short; null when it stayed busy. */
  claimTurn(waitMs: number): Promise<{ signal: AbortSignal; done: () => void } | null>;
  /** A normal brain turn — the interface's chat path, same tools, same history — with its events going to `emit`. */
  runTurn(text: string, images: string[], client: ClientContext, emit: (ev: ChatEvent) => void, signal: AbortSignal): Promise<void>;
  /** The owner's answer to an approval, carried on with `run`; or why nothing was waiting. */
  takeApproval(id: string, allow: boolean): Promise<{ error: string } | { run: (emit: (ev: ChatEvent) => void, signal: AbortSignal) => Promise<void> }>;
  /** One line for /status: models ready, keys set — never a secret. */
  statusLine(): Promise<string>;
  /** Stop the turn under way (/stop). */
  stop(): void;
}

// ---- Telegram's own shapes (the parts Ghosty reads) ----
interface TgUser {
  id: number;
  first_name?: string;
  username?: string;
}
interface TgChat {
  id: number;
  type?: string;
  first_name?: string;
}
interface TgPhotoSize {
  file_id: string;
  width: number;
  height: number;
  file_size?: number;
}
interface TgFile {
  file_id: string;
  mime_type?: string;
  file_size?: number;
}
interface TgMessage {
  message_id: number;
  chat: TgChat;
  from?: TgUser;
  text?: string;
  caption?: string;
  photo?: TgPhotoSize[];
  voice?: TgFile;
  audio?: TgFile;
}
export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  callback_query?: { id: string; from: TgUser; message?: TgMessage; data?: string };
}

const HELP = [
  "I'm Ghosty, your own AI. Here you can:",
  '• ask me anything, by text or a voice note',
  '• send a photo with a question',
  '• get my reminders and the results of tasks I ran for you',
  '',
  '/status — what is ready · /stop — stop what I am doing · /unpair — forget this chat',
  'Things on screen (the globe, maps, the camera, widgets) only work in the Ghosty app on your phone.',
].join('\n');

/** Anything that could carry the token (an address, an error) with the token blanked out. */
export function scrub(text: string, token: string): string {
  return token ? text.split(token).join('…') : text;
}

/** Equal without leaking, through timing, how much of a wrong secret was right. */
export async function sha256Hex(text: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

const TOKEN_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function randomToken(n: number): string {
  let s = '';
  for (const x of crypto.getRandomValues(new Uint8Array(n))) s += TOKEN_CHARS[x & 63];
  return s;
}
export function pairingCode(): string {
  return String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0]! % 900000));
}

/** Telegram's Bot API, one method at a time; a 429 is retried once after the wait it names. */
async function api<T = unknown>(token: string, method: string, body: Record<string, unknown>): Promise<T> {
  const url = `${API}/bot${token}/${method}`;
  for (let attempt = 0; ; attempt++) {
    let r: Response;
    try {
      r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    } catch (e) {
      throw new Error(`Telegram ${method}: ${scrub(String((e as Error)?.message ?? e), token).slice(0, 160)}`);
    }
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string; parameters?: { retry_after?: number } };
    if (j.ok) return j.result as T;
    const wait = r.status === 429 ? Math.min(30, Number(j.parameters?.retry_after) || 1) : 0;
    if (wait && attempt === 0) {
      await new Promise((ok) => setTimeout(ok, wait * 1000));
      continue;
    }
    throw new Error(`Telegram ${method} answered ${r.status}: ${scrub(String(j.description ?? ''), token).slice(0, 200)}`);
  }
}

/** A reply cut into messages Telegram accepts: at a paragraph break, else a sentence end, else a space. */
export function splitMessage(text: string, max = CHUNK): string[] {
  const out: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    const slice = rest.slice(0, max);
    let cut = slice.lastIndexOf('\n\n');
    if (cut < max / 3) cut = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '), slice.lastIndexOf('\n')) + 1;
    if (cut < max / 3) cut = slice.lastIndexOf(' ');
    if (cut < max / 3) cut = max;
    out.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest) out.push(rest);
  return out;
}

/** Plain text to a chat (no parse mode: Telegram shows links as links), in as many messages as it takes. */
export async function tgSend(token: string, chatId: number, text: string): Promise<void> {
  for (const part of splitMessage(text)) await api(token, 'sendMessage', { chat_id: chatId, text: part });
}

/** Picture links in a reply: Ghosty's own /i/<id> pictures (made or shared), which Telegram can fetch. */
export function pictureLinks(text: string, origin: string): string[] {
  if (!origin) return [];
  const esc = origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...new Set([...text.matchAll(new RegExp(`${esc}/i/[A-Za-z0-9_-]{16}`, 'g'))].map((m) => m[0]))].slice(0, 4);
}

/** A reply: its pictures as photos (a short reply as the first one's caption), the rest as text. */
export async function tgReply(token: string, chatId: number, text: string, origin: string): Promise<void> {
  const pics = pictureLinks(text, origin);
  if (!pics.length) return tgSend(token, chatId, text);
  const caption = text.length <= CAPTION;
  if (!caption) await tgSend(token, chatId, text);
  for (let i = 0; i < pics.length; i++) {
    try {
      await api(token, 'sendPhoto', { chat_id: chatId, photo: pics[i], ...(caption && i === 0 ? { caption: text } : {}) });
    } catch {
      // Telegram could not fetch the picture (gone, or an address it cannot reach): the link still goes.
      if (caption && i === 0) await tgSend(token, chatId, text);
    }
  }
}

async function tgApproval(token: string, chatId: number, reason: string, id: string): Promise<void> {
  await api(token, 'sendMessage', {
    chat_id: chatId,
    text: `Needs your approval: ${reason}`,
    reply_markup: { inline_keyboard: [[{ text: 'APPROVE', callback_data: `ap:${id}:1` }, { text: 'DECLINE', callback_data: `ap:${id}:0` }]] },
  });
}

/** "typing…" in the chat while a turn runs (Telegram shows it for five seconds at a time). */
function typing(token: string, chatId: number): { stop: () => void } {
  const tick = () => void api(token, 'sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => undefined);
  tick();
  const t = setInterval(tick, 5000);
  return { stop: () => clearInterval(t) };
}

/** Screen actions worth a line in Telegram (they only happen in the Ghosty app on the phone). */
const SCREEN_ACTIONS = new Set(['open_tab', 'fly_to', 'show_map', 'show_route', 'show_cameras', 'street_view', 'traffic_map', 'show_traffic', 'show_crime', 'show_transit', 'show_incidents', 'open_lens', 'open_widget', 'play_radio', 'road_ahead', 'show_link', 'set_layer']);

/**
 * The turn's events as Telegram messages, sent in order: the reply (with a heard voice note
 * echoed first), an approval with its buttons, a screen action as a note, an error as it is.
 */
function collector(token: string, chatId: number, origin: string, prefix = ''): { emit: (ev: ChatEvent) => void; flush: () => Promise<void> } {
  let chain: Promise<void> = Promise.resolve();
  const queue = (fn: () => Promise<void>) => void (chain = chain.then(fn).catch(() => undefined));
  let first = true;
  return {
    emit(ev) {
      if (ev.t === 'text') {
        const text = `${first ? prefix : ''}${ev.text}`;
        first = false;
        queue(() => tgReply(token, chatId, text, origin));
      } else if (ev.t === 'approval') queue(() => tgApproval(token, chatId, ev.reason, ev.id));
      else if (ev.t === 'client' && SCREEN_ACTIONS.has(ev.name)) queue(() => tgSend(token, chatId, `(a screen action — ${ev.name.replace(/_/g, ' ')} — which only shows in the Ghosty app on your phone)`));
      else if (ev.t === 'error') queue(() => tgSend(token, chatId, ev.message));
    },
    flush: () => chain,
  };
}

// ---- the link record ----

export const loadLink = (env: Env, storage: DurableObjectStorage): Promise<TelegramLink | undefined> => durableGet<TelegramLink>(env, storage, LINK_KEY);

const validCode = (link: TelegramLink, now = Date.now()): boolean => !!link.code && (link.codeUntil ?? 0) > now;

function withNewCode(link: TelegramLink): TelegramLink {
  return { ...link, code: pairingCode(), codeUntil: Date.now() + CODE_TTL_MS };
}

export function statusOf(link: TelegramLink | undefined, token: boolean | null): TelegramStatus {
  const st: TelegramStatus = { linked: !!link, bot: link?.bot ?? null, paired: !!link?.chatId, name: link?.name ?? null, token: token === null ? undefined : token };
  if (link && !link.chatId && validCode(link)) {
    st.code = link.code;
    st.codeUntil = link.codeUntil;
  }
  return st;
}

/**
 * Saving the bot token: find the bot, point its webhook here with a fresh secret, make a
 * pairing code. The same bot saved again keeps its paired chat (a new token for it, say);
 * a different bot starts over. Returns what the System tab shows under the key.
 */
export async function telegramConnect(env: Env, storage: DurableObjectStorage, token: string, origin: string): Promise<{ ok: boolean; info: string }> {
  if (!/^\d{5,}:[\w-]{20,}$/.test(token)) return { ok: false, info: 'that does not look like a bot token (numbers, a colon, then letters — from @BotFather)' };
  if (!/^https:\/\//.test(origin)) return { ok: false, info: 'saved, but Ghosty does not know its own https address (PUBLIC_ORIGIN in wrangler.jsonc), so the bot could not be connected' };
  try {
    const me = await api<TgUser>(token, 'getMe', {});
    const bot = me.username || String(me.id);
    const secret = randomToken(32);
    await api(token, 'setWebhook', { url: `${origin}/api/telegram/hook`, secret_token: secret, allowed_updates: ['message', 'callback_query'], drop_pending_updates: true });
    const prev = await loadLink(env, storage).catch(() => undefined);
    const same = prev && prev.bot === bot && prev.chatId;
    // The same bot, still paired: no pairing code (a code is only ever shown to the owner, while unpaired).
    const base = { secretHash: await sha256Hex(secret), bot };
    const link: TelegramLink = same ? { ...base, chatId: prev.chatId, name: prev.name } : withNewCode(base);
    await durablePut(env, storage, LINK_KEY, link);
    return {
      ok: true,
      info: same ? `connected to @${bot} · still paired with ${prev.name ?? 'you'} on Telegram` : `connected to @${bot} · pairing code ${link.code} (valid 15 min): open the bot in Telegram, press START and send it the code`,
    };
  } catch (e) {
    return { ok: false, info: `saved, but the bot could not be connected: ${scrub(String((e as Error)?.message ?? e), token).slice(0, 220)}` };
  }
}

/** Removing the token: the webhook goes (best effort — the token may already be dead) and the link is forgotten. */
export async function telegramDisconnect(env: Env, storage: DurableObjectStorage, token: string | null): Promise<{ ok: boolean; info: string }> {
  if (token) await api(token, 'deleteWebhook', { drop_pending_updates: true }).catch(() => undefined);
  await durableDelete(env, storage, LINK_KEY).catch(() => undefined);
  return { ok: true, info: 'removed · the bot is disconnected' };
}

/** POST /keys for the `telegram` key: `value` is the new token ('' removes it), `was` the one before. */
export async function telegramKey(host: Pick<TelegramHost, 'env' | 'storage' | 'origin'>, value: string, was: string | null): Promise<{ ok: boolean; info: string }> {
  return value ? telegramConnect(host.env, host.storage, value, host.origin) : telegramDisconnect(host.env, host.storage, was);
}

/** The owner-facing routes (behind the owner's sign-in): status, a new code, unpair, a test message. */
export async function telegramRoute(host: TelegramHost, path: string, method: string): Promise<Response> {
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
  const token = await host.vault.get('telegram').catch(() => null);
  let link: TelegramLink | undefined;
  try {
    link = await loadLink(host.env, host.storage);
  } catch (e) {
    if (!storageError(e)) throw e;
    // Database paused and no KV copy: not "unlinked", just not known right now.
    return json({ linked: false, bot: null, paired: false, name: null, unknown: true, token: !!token } satisfies TelegramStatus);
  }
  if (path === '/telegram/status' && method === 'GET') return json(statusOf(link, !!token));
  if (path === '/telegram/code' && method === 'POST') {
    if (!link) return json({ error: 'not connected: paste the bot token in SYSTEM → KEYS first' }, 400);
    // While paired there is no code to give out: a code the owner cannot see would only let a stranger take the chat over.
    if (link.chatId) return json({ error: 'already paired: press UNPAIR first to pair another chat' }, 400);
    link = withNewCode(link);
    await durablePut(host.env, host.storage, LINK_KEY, link);
    return json(statusOf(link, !!token));
  }
  if (path === '/telegram/unpair' && method === 'POST') {
    if (!link) return json({ error: 'not connected' }, 400);
    const { chatId: _c, name: _n, ...rest } = link;
    link = withNewCode(rest);
    await durablePut(host.env, host.storage, LINK_KEY, link);
    return json(statusOf(link, !!token));
  }
  if (path === '/telegram/test' && method === 'POST') {
    if (!link?.chatId) return json({ sent: false, error: 'no chat is paired yet' }, 400);
    if (!token) return json({ sent: false, error: 'the bot token is not saved' }, 400);
    try {
      await tgSend(token, link.chatId, 'Ghosty here. I can reach you on Telegram now.');
      return json({ sent: true });
    } catch (e) {
      return json({ sent: false, error: String((e as Error)?.message ?? e).slice(0, 200) }, 502);
    }
  }
  return json({ error: 'not found' }, 404);
}

/** A notification (reminder, task result, error) to the paired chat, if there is one. */
export async function telegramNotify(host: Pick<TelegramHost, 'env' | 'storage' | 'vault' | 'origin'>, item: { kind: string; title: string; text: string }): Promise<boolean> {
  const link = await loadLink(host.env, host.storage).catch(() => undefined);
  if (!link?.chatId) return false;
  const token = await host.vault.get('telegram').catch(() => null);
  if (!token) return false;
  const head = item.kind === 'reminder' ? '⏰ Reminder' : item.kind === 'task' ? `✦ ${item.title}` : `⚠ ${item.title}`;
  await tgReply(token, link.chatId, `${head}\n${item.text}`, host.origin);
  return true;
}

// ---- the webhook ----

/** Chats turned away in the last hour (once an hour each). In memory only: nothing about strangers is stored. */
const refused = new Map<number, number>();
/** Wrong pairing codes per chat: after five, that chat is ignored until a new code is made. */
const wrongCodes = new Map<number, { code: string; n: number }>();
const MAX_WRONG_CODES = 5;

/**
 * POST /api/telegram/hook, which Telegram calls for every update. The secret header must
 * match the one set with the webhook (wrong or missing: 403, no detail); the update is
 * acknowledged at once — Telegram resends anything not answered quickly — and handled after.
 */
export async function telegramHook(host: TelegramHost, req: Request): Promise<Response> {
  const link = await loadLink(host.env, host.storage).catch(() => undefined);
  const given = req.headers.get('x-telegram-bot-api-secret-token') ?? '';
  if (!link || !given || !sameSecret(await sha256Hex(given), link.secretHash)) return new Response(null, { status: 403 });
  const update = (await req.json().catch(() => null)) as TgUpdate | null;
  if (update && typeof update === 'object') host.waitUntil(handleUpdate(host, link, update).catch(() => undefined));
  return new Response('ok', { status: 200 });
}

async function handleUpdate(host: TelegramHost, link: TelegramLink, u: TgUpdate): Promise<void> {
  const token = await host.vault.get('telegram').catch(() => null);
  if (!token) return;
  if (u.callback_query) return handleCallback(host, link, token, u.callback_query);
  const m = u.message;
  if (!m?.chat || typeof m.chat.id !== 'number') return;
  const chatId = m.chat.id;
  let text = (m.text ?? m.caption ?? '').trim();
  if (link.chatId !== chatId) {
    // Not the owner's chat. The pairing code, while it is valid, makes it the owner's; anything else is turned away, once an hour, and never acted on.
    const guess = text.replace(/\s+/g, '');
    const wrong = wrongCodes.get(chatId);
    // Five wrong guesses at this code and the chat is locked out of pairing until a new code is made — the right guess included.
    const lockedOut = validCode(link) && !!wrong && wrong.code === link.code && wrong.n >= MAX_WRONG_CODES;
    if (validCode(link) && !lockedOut && guess === link.code) {
      // Only a private chat can be the owner's: in a group every member would have the owner's authority.
      if (m.chat.type !== 'private' || (m.from && m.from.id !== chatId)) {
        await tgSend(token, chatId, 'Pair me in a private chat with you, not in a group.').catch(() => undefined);
        return;
      }
      const { code: _c, codeUntil: _u, ...rest } = link;
      wrongCodes.delete(chatId);
      await durablePut(host.env, host.storage, LINK_KEY, { ...rest, chatId, name: (m.from?.first_name || m.chat.first_name || 'you').slice(0, 60) });
      await tgSend(token, chatId, "Paired. I'm Ghosty — talk to me here any time.");
      return;
    }
    if (validCode(link) && /^\d{6}$/.test(guess)) {
      // A six-digit guess that did not pair: counted per chat; from the fifth on the chat is silent until the code changes.
      const n = wrong && wrong.code === link.code ? wrong.n + 1 : 1;
      wrongCodes.set(chatId, { code: link.code!, n });
      if (wrongCodes.size > 500) wrongCodes.delete(wrongCodes.keys().next().value!);
      if (n >= MAX_WRONG_CODES) return;
    }
    const last = refused.get(chatId) ?? 0;
    if (Date.now() - last < 3600_000) return;
    refused.set(chatId, Date.now());
    if (refused.size > 500) refused.delete(refused.keys().next().value!);
    await tgSend(token, chatId, 'This bot answers only to its owner.').catch(() => undefined);
    return;
  }
  const cmd = /^\/(start|status|stop|unpair)(?:@\w+)?(?:\s|$)/i.exec(text)?.[1]?.toLowerCase();
  if (cmd === 'start') return tgSend(token, chatId, HELP);
  if (cmd === 'status') return tgSend(token, chatId, await host.statusLine());
  if (cmd === 'stop') {
    host.stop();
    return tgSend(token, chatId, 'Stopped.');
  }
  if (cmd === 'unpair') {
    const { chatId: _c, name: _n, ...rest } = link;
    await durablePut(host.env, host.storage, LINK_KEY, withNewCode(rest));
    return tgSend(token, chatId, 'Unpaired: I will not answer this chat any more. To pair again, open LINKS → TELEGRAM in Ghosty and send me the new code.');
  }
  // A turn: text, a photo with its caption, or a voice note.
  const images: string[] = [];
  let heard = '';
  if (m.photo?.length) {
    try {
      images.push(await photoDataUrl(token, m.photo));
    } catch (e) {
      return tgSend(token, chatId, `I couldn't get that photo: ${scrub(String((e as Error)?.message ?? e), token).slice(0, 160)}`);
    }
    if (!text) text = 'What is in this picture?';
  } else if (m.voice || m.audio) {
    const f = (m.voice ?? m.audio)!;
    if ((f.file_size ?? 0) > MAX_AUDIO_BYTES) return tgSend(token, chatId, `I couldn't hear that: the recording is too big (${(MAX_AUDIO_BYTES / 1e6).toFixed(0)} MB at most).`);
    try {
      const bytes = await download(token, f.file_id, MAX_AUDIO_BYTES);
      heard = await transcribe(host.env, host.vault, bytes, f.mime_type || 'audio/ogg');
    } catch (e) {
      if (e instanceof SpeechError && e.status === 400) return tgSend(token, chatId, "I couldn't hear that: voice notes need Workers AI (always there on Cloudflare) or a Groq key.");
      return tgSend(token, chatId, `I couldn't hear that: ${scrub(String((e as Error)?.message ?? e), token).slice(0, 160)}`);
    }
    if (!heard) return tgSend(token, chatId, "I couldn't make out any words in that voice note.");
    text = heard;
  }
  if (!text) return tgSend(token, chatId, 'Send me text, a voice note or a photo.');
  const slot = await host.claimTurn(WAIT_FOR_TURN_MS);
  if (!slot) return tgSend(token, chatId, "I'm still busy with something from your phone. Send /stop to stop it, or try again in a minute.");
  const busy = typing(token, chatId);
  const out = collector(token, chatId, host.origin, heard ? `🎤 ${heard}\n\n` : '');
  try {
    await host.runTurn(text, images, await host.client(), out.emit, slot.signal);
  } catch (e) {
    out.emit({ t: 'error', message: storageError(e) ?? scrub(String((e as Error)?.message ?? e), token).slice(0, 300) });
  } finally {
    busy.stop();
    slot.done();
    await out.flush();
  }
}

/** APPROVE / DECLINE pressed under a question: the same answer POST /approve gives. */
async function handleCallback(host: TelegramHost, link: TelegramLink, token: string, q: NonNullable<TgUpdate['callback_query']>): Promise<void> {
  const chatId = q.message?.chat.id;
  const m = /^ap:([\w-]+):([01])$/.exec(q.data ?? '');
  // The owner's chat, pressed by the owner (the chat id alone would let anyone in a group answer).
  const ours = !!m && chatId !== undefined && chatId === link.chatId && q.from?.id === link.chatId;
  await api(token, 'answerCallbackQuery', { callback_query_id: q.id, ...(ours ? { text: m![2] === '1' ? 'Approved' : 'Declined' } : {}) }).catch(() => undefined);
  if (!ours || !m || chatId === undefined) return;
  const allow = m[2] === '1';
  const slot = await host.claimTurn(WAIT_FOR_TURN_MS);
  // The buttons stay while the brain is busy, so the answer can be given again later.
  if (!slot) return tgSend(token, chatId, "I'm still busy with something from your phone. Send /stop to stop it, then press the button again.");
  // The buttons come off the question, so it cannot be answered twice.
  if (q.message) await api(token, 'editMessageReplyMarkup', { chat_id: chatId, message_id: q.message.message_id, reply_markup: { inline_keyboard: [] } }).catch(() => undefined);
  const out = collector(token, chatId, host.origin);
  const busy = typing(token, chatId);
  try {
    const a = await host.takeApproval(m[1]!, allow);
    if ('error' in a) out.emit({ t: 'error', message: a.error });
    else await a.run(out.emit, slot.signal);
  } catch (e) {
    out.emit({ t: 'error', message: storageError(e) ?? scrub(String((e as Error)?.message ?? e), token).slice(0, 300) });
  } finally {
    busy.stop();
    slot.done();
    await out.flush();
  }
}

// ---- files from Telegram ----

/** A file's bytes (getFile → the file server), at most `max` bytes. */
async function download(token: string, fileId: string, max: number): Promise<ArrayBuffer> {
  const f = await api<{ file_path?: string; file_size?: number }>(token, 'getFile', { file_id: fileId });
  if (!f.file_path) throw new Error('Telegram did not say where the file is');
  if (f.file_size && f.file_size > max) throw new Error(`the file is too big (${(f.file_size / 1e6).toFixed(1)} MB; ${(max / 1e6).toFixed(1)} MB at most)`);
  let r: Response;
  try {
    r = await fetch(`${API}/file/bot${token}/${f.file_path}`);
  } catch (e) {
    throw new Error(`could not download it: ${scrub(String((e as Error)?.message ?? e), token).slice(0, 120)}`);
  }
  if (!r.ok) throw new Error(`could not download it (${r.status})`);
  const bytes = await r.arrayBuffer();
  if (bytes.byteLength > max) throw new Error('the file is too big');
  return bytes;
}

/** The largest size of a photo that is within the picture limit, as the data URL a chat message carries. */
async function photoDataUrl(token: string, sizes: TgPhotoSize[]): Promise<string> {
  const pick = sizes.filter((s) => !s.file_size || s.file_size <= MAX_IMAGE_BYTES).sort((a, b) => b.width * b.height - a.width * a.height)[0];
  if (!pick) throw new Error('every size of that photo is over 1.5 MB');
  const bytes = await download(token, pick.file_id, MAX_IMAGE_BYTES);
  const type = sniffImage(bytes);
  if (!type) throw new Error('that is not a JPEG, PNG or WebP picture');
  return `data:${type};base64,${toBase64(bytes)}`;
}
