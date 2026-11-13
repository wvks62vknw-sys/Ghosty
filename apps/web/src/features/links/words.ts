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
