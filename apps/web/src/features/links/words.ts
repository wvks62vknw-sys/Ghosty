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
  offline: "I can't reach my brain right now.",
  paused: "My brain's database is paused, so I can't read the Telegram link; if a chat was paired, it still works.",
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
