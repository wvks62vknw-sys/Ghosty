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
 * NOT NOW buttons answered through a callback. A voice note is answered in text AND in Ghosty's
 * own voice (MeloTTS gives MP3, which sendVoice takes as it is; sendAudio if a chat refuses
 * voice messages). A photo (or a picture sent as a file) goes the Lens's way: the picture itself
 * to a model that can see, the caption as the question. A video, a video note or a GIF (OWNER-ISSUES
 * 79: one was dropped, and the words left over answered blind) goes the same way as Telegram's one
 * still frame of it, and the owner and the model are both told plainly that it could not be watched
 * or heard; a TikTok link brings its public title, author and cover (oEmbed) the same way.
 *
 * Buttons carry signed, expiring data (an HMAC keyed by the bot token, which never leaves the
 * vault): a press is acted on only from the owner's chat, by the owner, within a day, with a
 * signature only Ghosty can make. An approval asked in the app reaches Telegram too when the
 * owner has walked away (the app asks POST /telegram/ask/<id>), and an answer given here is
 * recorded for the app (GET /telegram/answer/<id>). New upgrade ideas come with BUILD IT /
 * NOT NOW: BUILD IT starts the same chat the Workshop's BUILD does.
 */
import type { ChatEvent, TelegramStatus } from '../../../packages/shared/src/protocol';
import type { Env } from './env';
import type { Vault } from './kernel/vault';
import { durableDelete, durableGet, durablePut, storageError } from './kv';
import { MAX_IMAGE_BYTES, sniffImage } from './lens';
import { unreadNote, type ClientContext } from './prompt';
import { MAX_AUDIO_BYTES, MAX_TTS_CHARS, SpeechError, speakable, synthesize, toBase64, transcribe } from './speech';
import { loadIdeas } from './upgrades';
import type { UpgradeIdea } from '../../../packages/shared/src/protocol';
import { stopIntent } from '../../../packages/shared/src/intent';
import { whyReply } from './why'; // [abilities]
import { dayDoings } from './today'; // [abilities]
import { dayLines, todayAsked } from '../../../packages/shared/src/abilities'; // [abilities]
import { checkLink, linksIn, messageShape, verdictWords } from './integrations/linkcheck'; // [guardian]
import { feel } from './mood'; // [guardian]

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
/** The Bot API lets a bot fetch files of at most 20 MB (getFile). */
export const MAX_FETCH_BYTES = 20 * 1024 * 1024;
/** A button press counts for this long after the message was sent. */
export const BUTTON_TTL_MS = 24 * 3600_000;
/** Answers given on Telegram, kept for the app to show (the newest few). */
export const ANSWERS_KEY = 'telegram:answers';
/** Approvals from the app already sent here (each once). */
const ASKED_KEY = 'telegram:asked';
/** agent.ts keeps the approval waiting for the owner under this key ({ id, calls }). */
const PENDING_KEY = 'pending';

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
  runTurn(text: string, images: string[], client: ClientContext, emit: (ev: ChatEvent) => void, signal: AbortSignal, note?: string): Promise<void>;
  /** The owner's answer to an approval, carried on with `run`; or why nothing was waiting. */
  takeApproval(id: string, allow: boolean): Promise<{ error: string } | { run: (emit: (ev: ChatEvent) => void, signal: AbortSignal) => Promise<void> }>;
  /** One line for /status: models ready, keys set — never a secret. */
  statusLine(): Promise<string>;
  /** Stop the turn under way (/stop, or a stop by intent: `harsh` leaves him subdued, any other is calm; mood.ts). */
  stop(harsh?: boolean): void;
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
/** A video, a round video note or a GIF (an `animation`, which Telegram also sends as `document`): the parts read here. */
interface TgVideo extends TgFile {
  duration?: number;
  thumbnail?: TgPhotoSize;
  thumb?: TgPhotoSize;
}
interface TgMessage {
  message_id: number;
  chat: TgChat;
  from?: TgUser;
  text?: string;
  caption?: string;
  photo?: TgPhotoSize[];
  /** A file: a picture sent "as a file" (full quality) is read like a photo. */
  document?: TgFile & { file_name?: string; thumbnail?: TgPhotoSize; thumb?: TgPhotoSize };
  voice?: TgFile;
  audio?: TgFile;
  video?: TgVideo;
  video_note?: TgVideo;
  animation?: TgVideo;
  /** [guardian] A message he forwarded from somewhere else (a text, an email): checked as a possible scam. */
  forward_origin?: unknown;
  forward_date?: number;
  forward_from?: TgUser;
  forward_sender_name?: string;
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

/** A method that uploads a file (multipart): same answers and errors as `api`, the token kept out of both. */
async function apiForm<T = unknown>(token: string, method: string, form: FormData): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`${API}/bot${token}/${method}`, { method: 'POST', body: form });
  } catch (e) {
    throw new Error(`Telegram ${method}: ${scrub(String((e as Error)?.message ?? e), token).slice(0, 160)}`);
  }
  const j = (await r.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string };
  if (j.ok) return j.result as T;
  throw new Error(`Telegram ${method} answered ${r.status}: ${scrub(String(j.description ?? ''), token).slice(0, 200)}`);
}

// ---- signed buttons ----

const b64url = (b: ArrayBuffer): string => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function buttonSig(token: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(`ghosty-telegram-buttons|${token}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))).slice(0, 22);
}

/** What a button does: `a` an approval waiting in the brain, `u` an upgrade idea; `yes` APPROVE / BUILD IT, else NOT NOW. */
export interface ButtonPress {
  kind: 'a' | 'u';
  id: string;
  yes: boolean;
}

/** A button's callback data: what it does, until when (seconds, base 36), and a signature over both (≤ 64 bytes, Telegram's limit). */
export async function signButton(token: string, press: ButtonPress, now = Date.now()): Promise<string> {
  const body = `${press.kind}:${press.id}:${press.yes ? 1 : 0}:${Math.floor((now + BUTTON_TTL_MS) / 1000).toString(36)}`;
  return `${body}:${await buttonSig(token, body)}`;
}

/** A pressed button's data, checked: the press, or why it is refused (made elsewhere or changed: `forged`; too old: `expired`). */
export async function readButton(token: string, data: string, now = Date.now()): Promise<ButtonPress | { refused: 'forged' | 'expired' }> {
  const m = /^([au]):([\w-]{1,16}):([01]):([0-9a-z]{1,9}):([\w-]{22})$/.exec(data);
  if (!m) return { refused: 'forged' };
  const body = `${m[1]}:${m[2]}:${m[3]}:${m[4]}`;
  if (!sameSecret(await buttonSig(token, body), m[5]!)) return { refused: 'forged' };
  if (parseInt(m[4]!, 36) * 1000 < now) return { refused: 'expired' };
  return { kind: m[1] as 'a' | 'u', id: m[2]!, yes: m[3] === '1' };
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

/** A question with two signed buttons. */
async function tgAsk(token: string, chatId: number, text: string, kind: ButtonPress['kind'], id: string, yes = 'APPROVE'): Promise<void> {
  await api(token, 'sendMessage', {
    chat_id: chatId,
    text,
    reply_markup: { inline_keyboard: [[{ text: yes, callback_data: await signButton(token, { kind, id, yes: true }) }, { text: 'NOT NOW', callback_data: await signButton(token, { kind, id, yes: false }) }]] },
  });
}

const tgApproval = (token: string, chatId: number, reason: string, id: string): Promise<void> => tgAsk(token, chatId, `Needs your approval: ${reason}`, 'a', id);

// ---- Ghosty's voice, back ----

/** What an audio file is, from its first bytes: MeloTTS answers MP3; an OGG would be Opus already. */
export function audioKind(bytes: ArrayBuffer): { mime: string; ext: string } | null {
  const b = new Uint8Array(bytes.slice(0, 4));
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return { mime: 'audio/mpeg', ext: 'mp3' }; // ID3 tag
  if (b[0] === 0xff && ((b[1] ?? 0) & 0xe0) === 0xe0) return { mime: 'audio/mpeg', ext: 'mp3' }; // frame sync
  if (b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) return { mime: 'audio/ogg', ext: 'ogg' }; // OggS
  return null;
}

/** The reply as it should be heard: plain words, cut at a sentence end within what the voice reads at once. */
export function spokenPart(text: string, max = MAX_TTS_CHARS): string {
  const t = speakable(text);
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (end > max / 3) return cut.slice(0, end + 1);
  const space = cut.lastIndexOf(' ');
  return `${cut.slice(0, space > 0 ? space : max - 1)}…`;
}

/**
 * The reply as a voice note, after the text. Telegram's sendVoice takes MP3 (and OGG/Opus, M4A),
 * so MeloTTS's MP3 goes as it is — no converting; a chat that refuses voice messages gets the
 * same file by sendAudio. No voice (no Workers AI, the day's allowance spent): the text stands.
 */
async function voiceOut(env: Pick<Env, 'AI'>, token: string, chatId: number, text: string): Promise<'voice' | 'audio' | null> {
  const words = spokenPart(text);
  if (!words) return null;
  let bytes: ArrayBuffer;
  try {
    bytes = await synthesize(env, words);
  } catch {
    return null;
  }
  const kind = audioKind(bytes) ?? { mime: 'audio/mpeg', ext: 'mp3' };
  const form = (field: string) => {
    const f = new FormData();
    f.append('chat_id', String(chatId));
    f.append(field, new Blob([bytes], { type: kind.mime }), `ghosty.${kind.ext}`);
    if (field === 'audio') f.append('title', 'Ghosty');
    return f;
  };
  try {
    await apiForm(token, 'sendVoice', form('voice'));
    return 'voice';
  } catch {
    try {
      await apiForm(token, 'sendAudio', form('audio'));
      return 'audio';
    } catch {
      return null;
    }
  }
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
function collector(token: string, chatId: number, origin: string, prefix = '', onAsk?: (id: string) => Promise<void>): { emit: (ev: ChatEvent) => void; flush: () => Promise<void>; said: () => string } {
  let chain: Promise<void> = Promise.resolve();
  const queue = (fn: () => Promise<void>) => void (chain = chain.then(fn).catch(() => undefined));
  let first = true;
  const replies: string[] = [];
  return {
    emit(ev) {
      if (ev.t === 'text') {
        const text = `${first ? prefix : ''}${ev.text}`;
        first = false;
        replies.push(ev.text);
        queue(() => tgReply(token, chatId, text, origin));
      } else if (ev.t === 'approval') {
        queue(async () => {
          await tgApproval(token, chatId, ev.reason, ev.id);
          await onAsk?.(ev.id);
        });
      }
      else if (ev.t === 'client' && SCREEN_ACTIONS.has(ev.name)) queue(() => tgSend(token, chatId, `(a screen action — ${ev.name.replace(/_/g, ' ')} — which only shows in the Ghosty app on your phone)`));
      else if (ev.t === 'error') queue(() => tgSend(token, chatId, ev.message));
    },
    flush: () => chain,
    said: () => replies.join('\n\n'),
  };
}

// ---- answers given here, for the app ----

/** An approval answered on Telegram. */
export interface TelegramAnswer {
  id: string;
  allow: boolean;
  at: number;
}

async function recordAnswer(storage: DurableObjectStorage, id: string, allow: boolean): Promise<void> {
  const list = ((await storage.get<TelegramAnswer[]>(ANSWERS_KEY).catch(() => undefined)) ?? []).filter((a) => a.id !== id);
  await storage.put(ANSWERS_KEY, [...list, { id, allow, at: Date.now() }].slice(-20)).catch(() => undefined);
}

/** "Allow publish site? name: bakery" — what a waiting tool call asks, from the call itself (short values only). */
export function pendingReason(fn: { name: string; arguments: string }): string {
  let args: Record<string, unknown> = {};
  try {
    const v = JSON.parse(fn.arguments || '{}') as unknown;
    if (v && typeof v === 'object' && !Array.isArray(v)) args = v as Record<string, unknown>;
  } catch {
    /* no readable arguments: the name alone */
  }
  const bits = Object.entries(args)
    .filter(([, v]) => (typeof v === 'string' && v.length <= 80) || typeof v === 'number' || typeof v === 'boolean')
    .slice(0, 3)
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${String(v)}`);
  return `Allow ${fn.name.replace(/_/g, ' ')}?${bits.length ? ` ${bits.join(' · ')}` : ''}`;
}

/** The chat the Workshop's BUILD starts for an upgrade idea (features/workshop/index.ts words it the same way). */
export function upgradeAsk(i: UpgradeIdea): string {
  return `Build this upgrade: ${i.title}. ${i.why ? `${i.why.replace(/[.\s]+$/, '')}. ` : ''}Steps: ${i.steps.map((s, n) => `${n + 1}. ${s.replace(/[.\s]+$/, '')}`).join('. ')}.`;
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
  // An approval waiting in the app, sent here too (the app does this once the owner has walked away from it).
  const ask = path.match(/^\/telegram\/ask\/([\w-]{1,16})$/);
  if (ask && method === 'POST') {
    if (!link?.chatId || !token) return json({ sent: false, error: 'Telegram is not paired' }, 400);
    const pending = await host.storage.get<{ id: string; calls: { function: { name: string; arguments: string } }[] }>(PENDING_KEY).catch(() => undefined);
    // Only the approval really waiting, under that id: nothing a request makes up is ever put to the owner.
    if (!pending || pending.id !== ask[1] || !pending.calls[0]) return json({ sent: false, error: 'nothing is waiting for approval' }, 404);
    const asked = (await host.storage.get<string[]>(ASKED_KEY).catch(() => undefined)) ?? [];
    if (asked.includes(pending.id)) return json({ sent: false, already: true });
    try {
      await tgApproval(token, link.chatId, `${pendingReason(pending.calls[0].function)} (asked in the app)`, pending.id);
    } catch (e) {
      return json({ sent: false, error: scrub(String((e as Error)?.message ?? e), token).slice(0, 200) }, 502);
    }
    await host.storage.put(ASKED_KEY, [...asked, pending.id].slice(-20)).catch(() => undefined);
    return json({ sent: true });
  }
  // Whether an approval was answered on Telegram, for the app's approval card.
  const ans = path.match(/^\/telegram\/answer\/([\w-]{1,16})$/);
  if (ans && method === 'GET') {
    const a = ((await host.storage.get<TelegramAnswer[]>(ANSWERS_KEY).catch(() => undefined)) ?? []).find((x) => x.id === ans[1]);
    return json(a ? { answered: true, allow: a.allow, at: a.at } : { answered: false });
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
  // New upgrade ideas (upgrades.ts names them in the text): each with BUILD IT / NOT NOW.
  if (item.title === 'Upgrade idea') {
    const ideas = (await loadIdeas(host.storage).catch(() => [])).filter((i) => item.text.includes(i.title)).slice(0, 3);
    for (const i of ideas) await tgAsk(token, link.chatId, `Build it? ${i.title}${i.why ? ` — ${i.why}` : ''}`.slice(0, 900), 'u', i.id, 'BUILD IT').catch(() => undefined);
  }
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
  // A turn: text, a photo with its caption, a video's still frame, or a voice note.
  const images: string[] = [];
  let heard = '';
  /** What could not be taken in, said first in the reply (`shown`) and told to the model (`note`, prompt.ts unreadNote). */
  let shown = '';
  let note = '';
  if (m.photo?.length) {
    // The Lens's way: the picture itself to a model that can see, the caption as the question.
    try {
      images.push(await photoDataUrl(token, m.photo));
    } catch (e) {
      return tgSend(token, chatId, `I couldn't get that photo: ${scrub(String((e as Error)?.message ?? e), token).slice(0, 160)}`);
    }
    if (!text) text = 'What is in this picture?';
  } else if (m.video || m.video_note || m.animation || /^video\//i.test(m.document?.mime_type ?? '')) {
    // A video (OWNER-ISSUES 79: one went unnoticed and the words left over were answered blind). Nothing in a Worker can take
    // a video apart, so it cannot be watched or heard here yet: Telegram's one still frame of it goes the photo's way, the
    // caption as the question, and the owner and the model are both told plainly what of it did not come through.
    const v = (m.video ?? m.video_note ?? m.animation ?? m.document)!;
    const kind = m.video_note ? 'video note' : m.animation ? 'GIF' : 'video';
    const sound = kind === 'GIF' ? '' : ", and I can't hear its sound";
    const over = (v.file_size ?? 0) > MAX_FETCH_BYTES ? ` It's ${Math.round(v.file_size! / 1e6)} MB, and Telegram only lets me fetch files up to 20 MB.` : '';
    const thumb = v.thumbnail ?? v.thumb;
    const frame = thumb ? await photoDataUrl(token, [thumb]).catch(() => '') : '';
    if (!frame) return tgSend(token, chatId, `I can't watch ${kind}s yet, and this one came without a still frame I could get, so I can't see anything of it.${over} Tell me what's in it, or send a screenshot.`);
    images.push(frame);
    shown = `🎞 I can't watch ${kind}s yet: I'm going by one still frame of it${sound}.${over}`;
    note = unreadNote(kind, `one still frame of it (the picture with this message)${sound ? ', and none of its sound' : ''}`);
    if (!text) text = `What do you make of this ${kind}?`;
  } else if (m.document && /^image\//i.test(m.document.mime_type ?? '')) {
    // A picture sent as a file: an iPhone original is often 2–5 MB or HEIC. Read whole when it can be
    // (JPEG, PNG or WebP within the limit — the size checked before any download), else Telegram's preview of it.
    const d = m.document;
    const whole = /^image\/(jpeg|png|webp)$/i.test(d.mime_type ?? '') && (d.file_size ?? 0) <= MAX_IMAGE_BYTES;
    const preview = d.thumbnail ?? d.thumb;
    let got = '';
    if (whole) got = await photoDataUrl(token, [{ file_id: d.file_id, width: 1, height: 1, file_size: d.file_size }]).catch(() => '');
    if (!got && preview) {
      got = await photoDataUrl(token, [preview]).catch(() => '');
      if (got) await tgSend(token, chatId, 'That file is too big or in a format I cannot read whole, so I am looking at its small preview. Send it as a photo, not a file, for more detail.').catch(() => undefined);
    }
    if (!got) return tgSend(token, chatId, 'I could not read that picture file (too big, or a format like HEIC). Send it as a photo, not a file.');
    images.push(got);
    if (!text) text = 'What is in this picture?';
  } else if (m.document) {
    return tgSend(token, chatId, 'I can read photos and pictures sent as files here; other files go in the Library tab in the app.');
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
  // A TikTok link (no file came): its public oEmbed — title, author and cover — the same honest way. (A YouTube link needs
  // nothing here: the youtube tool reads its captions.)
  const tiktok = !images.length && !heard ? TIKTOK.exec(text)?.[0] : undefined;
  if (tiktok) {
    const card = await tiktokCard(tiktok);
    const cover = card?.cover ? await pictureAt(card.cover).catch(() => '') : '';
    if (cover) images.push(cover);
    shown = card ? `🎞 I can't watch TikToks yet: I'm going by its title and author${cover ? ', and its cover picture' : ''}.` : "🎞 I couldn't open that TikTok (it may be private or gone), and I can't watch videos yet.";
    note = unreadNote('TikTok video, as a link', card ? `its public title "${card.title}" by ${card.author}${cover ? ', and its cover picture (with this message)' : ''}` : 'nothing of it: the link could not be opened');
  }
  if (!text) return tgSend(token, chatId, 'Send me text, a voice note or a photo.');
  // [guardian] A message he forwarded with a link in it, or the shape of a scam: checked from public records, no model
  // (integrations/linkcheck.ts); any other forward is talked about as usual.
  if (!images.length && (m.forward_origin || m.forward_date || m.forward_from || m.forward_sender_name) && (linksIn(text).length || messageShape(text).length)) {
    const c = await checkLink(text).catch(() => null);
    if (c) {
      if (c.verdict === 'scam') await feel(host.storage, { kind: 'danger', scam: true }).catch(() => undefined);
      return tgSend(token, chatId, verdictWords(c));
    }
  }
  // A stop by intent ("shut up", "enough", "leave it": intent.ts), typed or in a voice note: whatever is under way stops,
  // and nothing is said back (OWNER-ISSUES 70a). /stop above is the command; this is the owner talking.
  const stop = !images.length ? stopIntent(text) : null;
  if (stop) {
    host.stop(stop.harsh);
    return;
  }
  // "why?" (OWNER-ISSUES 67d): the last turn's trail in plain words, with no model (why.ts); a bare "why?" after a reply that
  // ran nothing is about what was said, so it goes to the model as a message
  const why = !images.length ? await whyReply(host.storage, text).catch(() => null) : null;
  if (why) return tgSend(token, chatId, why);
  // "what did you do today?" (OWNER-ISSUES 68c): the day's doings from what the brain keeps, newest first, no model (today.ts)
  if (!images.length && todayAsked(text)) {
    const tz = (await host.client().catch(() => ({}) as ClientContext)).tz;
    const items = await dayDoings({ storage: host.storage, env: host.env }, tz).catch(() => []);
    return tgSend(token, chatId, dayLines(items, tz).join('\n'));
  }
  const slot = await host.claimTurn(WAIT_FOR_TURN_MS);
  if (!slot) return tgSend(token, chatId, "I'm still busy with something from your phone. Send /stop to stop it, or try again in a minute.");
  const busy = typing(token, chatId);
  const out = collector(token, chatId, host.origin, heard ? `🎤 ${heard}\n\n` : shown ? `${shown}\n\n` : '', (id) => noteAsked(host.storage, id));
  try {
    const client = await host.client();
    // Spoken to: answered in the spoken style (persona.ts SPOKEN), and in Ghosty's voice below.
    if (heard) client.voice = true;
    await host.runTurn(text, images, client, out.emit, slot.signal, note || undefined);
  } catch (e) {
    out.emit({ t: 'error', message: storageError(e) ?? scrub(String((e as Error)?.message ?? e), token).slice(0, 300) });
  } finally {
    busy.stop();
    slot.done();
    await out.flush();
  }
  // A voice note gets a voice note back, after the text (which always goes).
  if (heard && out.said()) await voiceOut(host.env, token, chatId, out.said());
}

/** An approval sent to Telegram (from a turn here, or from the app): never sent twice. */
async function noteAsked(storage: DurableObjectStorage, id: string): Promise<void> {
  const asked = (await storage.get<string[]>(ASKED_KEY).catch(() => undefined)) ?? [];
  if (!asked.includes(id)) await storage.put(ASKED_KEY, [...asked, id].slice(-20)).catch(() => undefined);
}

/**
 * A button pressed: APPROVE / NOT NOW under an approval (the same answer POST /approve gives), or
 * BUILD IT / NOT NOW under an upgrade idea. Acted on only when it was pressed in the owner's chat,
 * by the owner, and its data carries Ghosty's own signature and has not expired; anything else
 * is answered (so the button stops spinning) and otherwise ignored.
 */
async function handleCallback(host: TelegramHost, link: TelegramLink, token: string, q: NonNullable<TgUpdate['callback_query']>): Promise<void> {
  const chatId = q.message?.chat.id;
  // The owner's chat, pressed by the owner (the chat id alone would let anyone in a group answer).
  const ours = chatId !== undefined && chatId === link.chatId && q.from?.id === link.chatId;
  const press = ours ? await readButton(token, q.data ?? '') : null;
  const ok = press && !('refused' in press) ? press : null;
  // A button sent before buttons were signed ("ap:<id>:1"), pressed by the owner: treated as expired, never acted on.
  const legacy = ours && /^ap:[\w-]{1,16}:[01]$/.test(q.data ?? '');
  const expired = legacy || (!!press && 'refused' in press && press.refused === 'expired');
  const note = ok ? (ok.yes ? (ok.kind === 'u' ? 'Building it' : 'Approved') : 'Not now') : expired ? 'That button has expired' : undefined;
  await api(token, 'answerCallbackQuery', { callback_query_id: q.id, ...(note ? { text: note } : {}) }).catch(() => undefined);
  if (!ours || chatId === undefined) return;
  const unbutton = () => (q.message ? api(token, 'editMessageReplyMarkup', { chat_id: chatId, message_id: q.message.message_id, reply_markup: { inline_keyboard: [] } }).catch(() => undefined) : Promise.resolve());
  if (expired) {
    await unbutton();
    return tgSend(token, chatId, legacy ? 'That button is from before an update and no longer works. Answer it in the app.' : 'That button has expired. Ask me again, or answer it in the app.');
  }
  if (!ok) return;
  if (ok.kind === 'u' && !ok.yes) {
    await unbutton();
    return tgSend(token, chatId, 'Left in Workshop → UPGRADE IDEAS for later.');
  }
  const slot = await host.claimTurn(WAIT_FOR_TURN_MS);
  // The buttons stay while the brain is busy, so the answer can be given again later.
  if (!slot) return tgSend(token, chatId, "I'm still busy with something from your phone. Send /stop to stop it, then press the button again.");
  // The buttons come off the question, so it cannot be answered twice.
  await unbutton();
  const out = collector(token, chatId, host.origin, '', (id) => noteAsked(host.storage, id));
  const busy = typing(token, chatId);
  try {
    if (ok.kind === 'u') {
      const idea = (await loadIdeas(host.storage)).find((i) => i.id === ok.id);
      if (!idea) out.emit({ t: 'error', message: 'That idea is gone from the Workshop (dismissed or replaced).' });
      else await host.runTurn(upgradeAsk(idea), [], await host.client(), out.emit, slot.signal);
    } else {
      const a = await host.takeApproval(ok.id, ok.yes);
      if ('error' in a) out.emit({ t: 'error', message: /nothing is waiting/i.test(a.error) ? 'Already answered (here or in the app), or I have moved on since.' : a.error });
      else {
        // The app's approval card shows the answer (GET /telegram/answer/<id>).
        await recordAnswer(host.storage, ok.id, ok.yes);
        await a.run(out.emit, slot.signal);
      }
    }
  } catch (e) {
    out.emit({ t: 'error', message: storageError(e) ?? scrub(String((e as Error)?.message ?? e), token).slice(0, 300) });
  } finally {
    busy.stop();
    slot.done();
    await out.flush();
  }
}

// ---- files from Telegram ----

/** A TikTok link (www., vm., vt. or m.tiktok.com) in a message's words. */
export const TIKTOK = /https?:\/\/(?:[\w-]+\.)?tiktok\.com\/\S+/i;

/** A TikTok's public card (its oEmbed, free and keyless): title, author and cover address; null when it would not open. */
export async function tiktokCard(url: string): Promise<{ title: string; author: string; cover: string } | null> {
  try {
    const r = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const j = (await r.json()) as { title?: unknown; author_name?: unknown; thumbnail_url?: unknown };
    const title = String(j.title ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
    const author = String(j.author_name ?? '').trim().slice(0, 80);
    return title || author ? { title: title || '(no title)', author: author || 'someone', cover: typeof j.thumbnail_url === 'string' ? j.thumbnail_url : '' } : null;
  } catch {
    return null;
  }
}

/** A picture at a public https address (a TikTok's cover) as a data URL: within the picture limit, JPEG, PNG or WebP; else ''. */
async function pictureAt(url: string): Promise<string> {
  if (!/^https:\/\//i.test(url)) return '';
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok || Number(r.headers.get('content-length') ?? 0) > MAX_IMAGE_BYTES) return '';
  const bytes = await r.arrayBuffer();
  const type = bytes.byteLength <= MAX_IMAGE_BYTES ? sniffImage(bytes) : null;
  return type ? `data:${type};base64,${toBase64(bytes)}` : '';
}

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
