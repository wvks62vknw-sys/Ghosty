/**
 * LINKS → TELEGRAM, in his words: the four states of the panel (not connected, waiting for the code, paired, not known while
 * paused), the code's three taps in order, its countdown, the expired line, TEST and UNPAIR. Pure: no screen, no clock it is not
 * handed. The brain's own Telegram lines are in apps/edge/src/telegramwords.ts, which says the same things in the same voice.
 */
import type { TelegramStatus } from '../../../../../packages/shared/src/protocol';

/** How long a code has left, in words: "about 14 minutes", "about a minute". */
export function codeLeft(ms: number): string {
  const min = Math.max(1, Math.ceil(ms / 60_000));
  return min === 1 ? 'about a minute' : `about ${min} minutes`;
}

export const TELEGRAM = {
  offline: "I can't reach my brain right now, so I can't tell whether Telegram is linked. Tap TRY AGAIN when you have a signal.",
  paused: "My brain's database is paused, so I can't read or use the Telegram link until it's back (by midnight UTC). Nothing you paired is lost. Tap TRY AGAIN later.",
  noKey: "Talk to me from Telegram: send a message, a voice note or a photo, and get my reminders there too. Paste your bot's key in SYSTEM → KEYS → Telegram bot; HOW TO GET IT takes about two minutes.",
  keyNotConnected: "I have your bot's key, but I couldn't connect the bot with it. Open SYSTEM → KEYS → Telegram bot and press SAVE again.",
  /** The code's message: the three taps in order. */
  steps: (bot: string): string => `Open @${bot} in Telegram, tap START, then send it this code:`,
  /** Under the code: what is left of it, or that it has run out (NEW CODE stays under the thumb either way). */
  left: (ms: number, live: boolean): string => (live ? `valid for ${codeLeft(ms)}` : 'The code has run out. Tap NEW CODE for a fresh one.'),
  pairedNote: "Send me a message, a voice note or a photo there and I'll answer as I do here; my reminders and finished tasks arrive there too.",
  testSent: 'Sent. Look in your Telegram.',
  unpairTitle: 'Unpair Telegram?',
  unpairBody: "I'll stop answering in your Telegram chat and send nothing more there. To pair again, send the bot a new code.",
  unpairKey: 'UNPAIR',
  unpaired: "Unpaired. I've stopped answering on Telegram.",
  unpairFailed: "I couldn't unpair just now. Try again in a moment.",
} as const;

/** The clock time a message was missed, as he reads it. */
const at = (t: number): string => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

/** A message that did not reach Telegram: said once under the paired panel (the brain keeps the newest, with a count). */
export function missedWords(m: NonNullable<TelegramStatus['missed']>): string {
  const what = m.what === 'reminder' ? 'a reminder' : m.what === 'task' ? 'a finished task' : 'a warning';
  return m.n > 1
    ? `${m.n} messages did not reach you on Telegram, the last one at ${at(m.at)} (${what}); they are in your inbox in the app.`
    : `A message didn't reach you on Telegram at ${at(m.at)} (${what}); it is in your inbox in the app.`;
}

/** LINKS' words, pure (the spec imports this file): a link that failed says the one thing to try, a count of devices is said as he says it. */
export type LinkKind = 'bluesky' | 'mastodon' | 'discord' | 'channel';

const TRY: Record<LinkKind, string> = {
  bluesky: 'Check the handle and the app password, then tap LINK BLUESKY again.',
  mastodon: 'Check the server and the access token, then tap LINK MASTODON again.',
  discord: 'Check the bot token and the three IDs, then tap LINK DISCORD again.',
  channel: 'Check my bot is an admin of the channel, then tap LINK CHANNEL again.',
};

/** A link that did not work: what happened, and the one thing to try. */
export const linkFailed = (kind: LinkKind, name: string): string => `I couldn’t sign in to ${name}. ${TRY[kind]}`;
export const LINKING = (name: string): string => `Signing in to ${name} to check it…`;

/** "Sent to 1 device", "Sent to 2 devices". */
export const sentTo = (n: number): string => `Sent to ${n} device${n === 1 ? '' : 's'}.`;
export const NO_DEVICE = 'No device has notifications on yet. Turn them on under PHONE.';
export const TELEGRAM_TEST_FAILED = 'I couldn’t send to your Telegram. Check it is still paired, then try again.';

export const NOTES_LOADING = 'Reading your choices…';
/** The notifications' scope: what OFF stops (one sentence), and the rest behind its "?". */
export const NOTIFY_SCOPE = {
  short: 'OFF stops that kind everywhere: no phone notification, no Telegram message, no alert or voice in the app.',
  more: 'It still goes in your Agenda inbox. Always sent: what you ask for (“ping my phone…”), finished tasks and projects, and anything that went wrong.',
};

// ---- LINKS as one connections screen (FINAL ROUND): each connection says its state the same way, and the top line counts the rows

/** Where a connection stands. `failing`: linked, but the last check said it does not work. `waiting`: one step left (Telegram's code).
 *  `broken`: not working, and never was linked (notifications the browser blocks, an AI brain with no model ready): counted as not
 *  working at the top, never as linked. */
export type LinkState = 'checking' | 'not' | 'waiting' | 'linked' | 'failing' | 'broken' | 'paused' | 'offline';
export interface LinkRow {
  id: string;
  state: LinkState;
}

/** The panel's line for a state: "Linked as tony@gmail.com", "Not linked", "Linked, but not working". */
export function stateTag(state: LinkState, who?: string | null): string {
  switch (state) {
    case 'checking':
      return 'Checking…';
    case 'not':
      return 'Not linked';
    case 'waiting':
      return 'One step left';
    case 'linked':
      return who ? `Linked as ${who}` : 'Linked';
    case 'failing':
      return 'Linked, but not working';
    case 'broken':
      return 'Not working';
    case 'paused':
      return 'Not known while paused';
    case 'offline':
      return 'Can’t reach my brain';
  }
}

/** The panel's light for a state: 'ok' lit, 'mid' amber (a step for him), 'off' red (something is wrong). */
export const stateLight = (state: LinkState): 'ok' | 'mid' | 'off' | undefined => (state === 'linked' ? 'ok' : state === 'failing' || state === 'broken' || state === 'offline' ? 'off' : state === 'checking' ? undefined : 'mid');

/** A connection's dial at the top: ON, FIX, OFF only when it is not linked, … while checking, ? while not known (never OFF as if not set up). */
export const stateDial = (state: LinkState): string =>
  state === 'linked' ? 'ON' : state === 'failing' || state === 'broken' ? 'FIX' : state === 'checking' ? '…' : state === 'offline' || state === 'paused' ? '?' : 'OFF';

/** The top of LINKS: how many are linked (big), and what needs him (small). Counts only the rows drawn, so it never disagrees with them. */
export function heroWords(rows: readonly LinkRow[]): { big: string; sub: string } {
  const n = (s: LinkState) => rows.filter((r) => r.state === s).length;
  const linked = n('linked') + n('failing');
  const bad = n('failing') + n('broken');
  const big = n('checking') && !linked ? 'Checking…' : linked ? `${linked} linked` : 'Nothing linked yet';
  if (n('offline')) return { big, sub: 'I can’t reach my brain, so some of these are not known. Tap TRY AGAIN in one of them when you have a signal.' };
  const parts = [
    bad ? `${bad} not working` : '',
    n('waiting') ? `${n('waiting')} with one step left` : '',
    n('paused') ? `${n('paused')} not known while paused` : '',
    n('not') ? `${n('not')} not linked` : '',
  ].filter(Boolean);
  return { big, sub: parts.length ? parts.join(' · ') : linked ? 'Everything here is linked and working.' : 'everything Ghosty is plugged into' };
}

/** "1 model ready", "3 models ready" (never "1 models"). */
export const modelsReady = (n: number): string => (n ? `${n} model${n === 1 ? '' : 's'} ready` : 'No models ready');

/** The last time he tested a link, and what it said: kept on the phone (ghosty.links.checks). */
export interface LinkCheck {
  ok: boolean;
  at: number;
  /** Who it was linked as when tested: a check about another account says nothing about this one. */
  who?: string;
  /** Why it failed, already in his words. */
  why?: string;
}

const hm = (t: number): string => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

/** "Tested just now: it works.", "Tested at 10:42: it didn’t work." */
export function checkLine(c: LinkCheck, now = Date.now()): string {
  const d = new Date(c.at);
  const today = new Date(now).toDateString() === d.toDateString();
  const when = now - c.at < 60_000 ? 'just now' : today ? `at ${hm(c.at)}` : `on ${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} at ${hm(c.at)}`;
  return `Tested ${when}: ${c.ok ? 'it works.' : 'it didn’t work.'}`;
}

/** The email check could not reach the mail server (a weak signal, a slow server): it says nothing about the saved key, so it is never
 *  kept as "not working" (the chat's next "any new email?" tries it again). */
export const emailUnreached = (info = ''): boolean => /did not answer|could not (reach|connect|talk|send)|closed the connection|network|timed? ?out/i.test(info) && !/outlook|microsoft/i.test(info);

/** Why an email check failed, from the brain's own line, in his words with the one next step (never the server's raw text). */
export function emailWhy(info = ''): string {
  const i = info.toLowerCase();
  if (/outlook|microsoft/.test(i)) return 'Microsoft does not let apps sign in to Outlook.com mail with a password. Forward your mail to a Gmail or iCloud address and link that.';
  if (emailUnreached(info)) return 'I couldn’t reach your mail server to check it. Check the server names, then tap CHANGE ACCOUNT.';
  if (/server name|host name|mail servers for/.test(i)) return 'I don’t know the mail servers for that address. Tap CHANGE ACCOUNT, pick Other in PROVIDER and type both server names.';
  if (/password|auth|login|credential|denied|reject|user ?name/.test(i)) return 'Your mail server turned down the address or the app password. Make a new app password, tap CHANGE ACCOUNT and paste it.';
  if (/imap/.test(i)) return 'Your mail server would not let me read the inbox. Check IMAP is switched on in your mail settings, then tap CHANGE ACCOUNT.';
  return 'I couldn’t sign in to your email with what was saved. Tap CHANGE ACCOUNT and link it again.';
}

/** Why a Spotify check failed (the brain's /spotify/test `why`), in his words with the one next step. */
export function spotifyWhy(why?: string): string {
  switch (why) {
    case 'signin':
      return 'Spotify no longer accepts my sign-in. Tap UNLINK, then link Spotify again.';
    case 'busy':
      return 'Spotify is busy and asked me to wait. Tap TEST again in a minute.';
    case 'refused':
      return 'Spotify turned the check down. Tap TEST again in a minute; if it keeps failing, unlink and link it again.';
    case 'not':
      return 'Spotify isn’t linked any more. Link it again below.';
    default:
      return 'I couldn’t reach Spotify. Tap TEST again in a minute.';
  }
}

/** A key check (GitHub, TomTom) in his words, from the brain's answer: `kept` only when the service said the key itself is wrong; a
 *  service out of reach or busy says nothing about the key, so it is never kept as "not working". Never the service's raw text. */
export function keyWhy(name: string, info = ''): { kept: boolean; why: string } {
  const i = info.toLowerCase();
  const who = name === 'github' ? 'GitHub' : name === 'tomtom' ? 'TomTom' : 'the service';
  if (name === 'github' && /read but not write/.test(i)) return { kept: true, why: 'This token can read my repository but not change it. Make one with “Contents: Read and write” and paste it below.' };
  if (name === 'github' && /access to your ghosty repository/.test(i)) return { kept: true, why: 'This token can’t see my repository. On GitHub, give it access to the Ghosty repository, then paste it below.' };
  if (/not valid/.test(i)) return { kept: true, why: `${who} says this key is not valid. Copy it again with no spaces, then paste it below.` };
  return { kept: false, why: `I couldn’t check it with ${who} just now. It is saved; paste it again later to check it.` };
}

/** A connection's line when the brain cannot be reached: what it means and what to do. */
export const OFFLINE_LINE = (what: string): string => `I can’t reach my brain right now, so I can’t tell whether ${what} is linked. Tap TRY AGAIN when you have a signal.`;
/** The same while the brain's database is paused: nothing he linked is lost. */
export const PAUSED_LINE = (what: string): string => `My brain’s database is paused, so I can’t read or use the ${what} link until it’s back (by midnight UTC). Nothing you linked is lost. Tap TRY AGAIN later.`;

// ---- EMAIL's TEST and the one health line (planlane2:fixes, plan.u14)

/** Why an email TEST did not pass (the brain's /email/test `why`: a reason code, never the server's own words). */
export type EmailTestWhy = 'not' | 'paused' | 'unreached' | 'busy' | 'signin' | 'imap' | 'servers' | 'outlook' | 'saved' | 'other';
/** A TEST that passed: said as what it proved. */
export const emailWorks = (address?: string | null): string => `Email works: I signed in to your mail${address ? ` as ${address}` : ''}.`;
/** A TEST that did not pass, in his words with the one next step. `unreached` (and a paused database) say nothing about what he linked. */
export function emailTestWhy(why?: string): string {
  switch (why) {
    case 'unreached':
      return 'I couldn’t reach your mail server just now, so I couldn’t check it. Nothing has changed: tap TEST again in a minute.';
    case 'busy':
      return 'Your mail server asked me to wait. Nothing has changed: tap TEST again in a minute.';
    case 'signin':
      return emailWhy('password');
    case 'imap':
      return emailWhy('imap');
    case 'servers':
      return emailWhy('mail servers for');
    case 'outlook':
      return emailWhy('outlook');
    case 'paused':
      return 'My brain’s database is paused, so I can’t check your email until it’s back (by midnight UTC). Nothing you linked is lost.';
    case 'not':
      return 'Your email isn’t linked any more. Link it again below.';
    default:
      return emailWhy();
  }
}
/** Only a test that reached his mail server and was turned down is kept as "not working" (a server out of reach, or one that asked me
 *  to wait, says nothing about it). */
export const emailTestKept = (why?: string): boolean => !!why && why !== 'unreached' && why !== 'busy' && why !== 'paused';

/** One row of LINKS for the health line: its name as he reads it, the panel it is in, and its state (the very rows the top counts). */
export interface HealthRow {
  name: string;
  panel: string;
  state: LinkState;
}
/**
 * THE ONE HEALTH LINE at the top of LINKS: everything he linked is fine, or the one thing to fix first (the first row on the screen that
 * is linked but not working, else not working, else one step left), from the same rows the top line counts: never a source of its own.
 */
export function healthWords(rows: readonly HealthRow[]): { kind: 'ok' | 'fix' | 'checking' | 'offline' | 'none'; line: string; panel?: string } {
  const first = (s: LinkState) => rows.find((r) => r.state === s);
  const fix = first('failing') ?? first('broken');
  if (fix) return { kind: 'fix', panel: fix.panel, line: `Fix ${fix.name} first: ${fix.state === 'failing' ? 'it is linked, but not working' : 'it is not working'}. The reason and the next step are in its panel.` };
  const step = first('waiting');
  if (step) return { kind: 'fix', panel: step.panel, line: `Finish ${step.name} first: it has one step left.` };
  if (first('offline')) return { kind: 'offline', line: 'I can’t reach my brain, so I can’t say whether everything you linked is fine.' };
  if (first('checking')) return { kind: 'checking', line: 'Checking everything you linked…' };
  const linked = rows.filter((r) => r.state === 'linked').length;
  const paused = rows.filter((r) => r.state === 'paused').length;
  if (!linked) return { kind: 'none', line: paused ? 'My brain’s database is paused, so I can’t say what is linked until it’s back. Nothing you linked is lost.' : 'Nothing is linked yet, so there is nothing to fix.' };
  return { kind: 'ok', line: `Everything you linked is fine: ${linked === 1 ? 'it works' : `all ${linked} work`}${paused ? `, and ${paused} ${paused === 1 ? 'is' : 'are'} not known while my brain’s database is paused` : ''}.` };
}
