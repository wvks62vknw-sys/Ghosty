/**
 * SOCIAL's words, pure (the spec imports this file): the queue in one line, what exactly goes out, a failed post said with APPROVE again, and the key
 * that drops a draft. The posting rule (nothing leaves without his APPROVE, every time) is the code's, not these words'.
 */
export const APPROVE = 'APPROVE';
export const NO = 'NO';

/** The queue's line: how many wait, and that nothing goes until he taps (one sentence). */
export const queueNote = (n: number): string => (n ? `${n} waiting for your APPROVE. Nothing goes out until you tap it; a draft goes after 24 hours.` : 'Nothing waiting. Ask me to draft a post, and it waits here for your APPROVE.');
export const QUEUE_LOADING = 'Reading the queue…';
export const QUEUE_ERROR = 'I can’t reach my brain, so I can’t read the queue. Try again in a moment.';

/** The exact line above APPROVE: what leaves, and where, word for word as shown. */
export function exactLine(kind: 'post' | 'follow' | 'unfollow', where: string, who?: string, key = APPROVE): string {
  return kind === 'post' ? `I will post exactly this on ${where}, only when you tap ${key}.` : `I will ${kind} ${who ?? 'them'} on ${where}, only when you tap ${key}.`;
}

/** A post that did not go: it says so, that nothing went out, and that APPROVE sends it once. */
export function failedWords(fault?: string): string {
  const why = (fault ?? '').trim().replace(/[.!?]+$/, '');
  return `Not sent${why && why.split(/\s+/).length <= 14 && !/undefined|\[object|TypeError|HTTP \d/i.test(why) ? `: ${why}` : ''}. Nothing went out. APPROVE sends it once.`;
}
/** The key that sends: APPROVE, while it waits and after it failed (every send is his tap, every time). */
export const sendKey = (_state: string): string => APPROVE;

/** WRITE A POST (the planlane pass): the composer on the queue makes a DRAFT only; it then waits above for his APPROVE like any other. */
export const COMPOSE_NOTE = 'This makes a draft only. It waits in the queue above until you tap APPROVE.';
export const COMPOSE_NONE = 'Link one of your accounts under Accounts first, then write here.';
export const COMPOSE_KEY = 'MAKE THE DRAFT';
export const COMPOSE_EMPTY = 'Write the post first';
/** The count under the box: "212 of 300 letters" or "12 over the 300 Bluesky takes". */
export function lengthWords(n: number, max: number, where: string): string {
  return n <= max ? `${n} of ${max} letters` : `${n - max} over the ${max} ${where} takes`;
}

// ---------------------------------------------------------------- the composer, whole (planlane:social)

/** "Bluesky", "Bluesky and Mastodon", "Bluesky, Mastodon and Discord". */
export function andList(names: string[]): string {
  return names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}
const NUMBER = ['no', 'one', 'two', 'three', 'four'];
const num = (n: number) => NUMBER[n] ?? String(n);
const Cap = (s: string) => `${s[0]!.toUpperCase()}${s.slice(1)}`;

/** The key that makes the drafts: one account, MAKE THE DRAFT; two, MAKE 2 DRAFTS (each its own APPROVE). */
export const composeKey = (n: number): string => (n > 1 ? `MAKE ${n} DRAFTS` : COMPOSE_KEY);

/** Under the account keys: where it goes, and that each draft waits for its own APPROVE. */
export function toWords(names: string[]): string {
  if (!names.length) return 'Tap an account above to choose where it goes.';
  if (names.length === 1) return `To ${names[0]}: one draft, and it waits for your APPROVE.`;
  return `To ${andList(names)}: ${num(names.length)} drafts, and each waits for its own APPROVE.`;
}

/** The count for several accounts: "Bluesky 34 of 300 · Mastodon 34 of 500" (one account: the plain lengthWords). */
export function countWords(rows: { name: string; n: number; max: number }[]): string {
  if (rows.length === 1) return lengthWords(rows[0]!.n, rows[0]!.max, rows[0]!.name);
  return rows.map((r) => (r.n <= r.max ? `${r.name} ${r.n} of ${r.max}` : `${r.name} ${r.n - r.max} over its ${r.max}`)).join(' · ');
}

/** Whether a picture can go: the line by ADD A PICTURE. */
export function pictureWords(names: string[], noPictures: string[]): string {
  if (!names.length) return '';
  if (!noPictures.length) return `${andList(names)} ${names.length > 1 ? 'take' : 'takes'} one picture, with a line saying what is in it for anyone who cannot see it.`;
  return `${Cap(andList(noPictures))} ${noPictures.length > 1 ? 'take' : 'takes'} words only, so no picture can go with this one.`;
}
/** Under the picture: where it is kept, and for how long (the brain keeps it as long as a draft can wait). */
export const PICTURE_KEPT = 'When you make the drafts, my brain keeps this picture for 24 hours, as long as a draft can wait, so it can go with the post.';
export const ALT_MISSING = 'Say what is in the picture first, in a line, for anyone who cannot see it.';
export const PICTURE_NO = (names: string[]): string => `${Cap(andList(names))} ${names.length > 1 ? 'take' : 'takes'} no pictures. Take the picture off, or untick ${names.length > 1 ? 'them' : 'it'}.`;
export const PICTURE_KINDS = 'Only a JPEG, PNG or WebP picture can go with a post.';
export const PICTURE_BIG = 'That picture is over 1.5 MB, too big to post. Pick a smaller one.';
/** Where his words are while he writes (said under the box, so he knows nothing is lost). */
export const KEPT_NOTE = 'Your words stay on this phone while you write, even if you leave. A picture stays until Ghosty is closed.';

/** What MAKE THE DRAFT did across his accounts: made for some, and why not for the others. */
export function madeWords(made: string[], missed: { name: string; why: string }[]): string {
  const ok = made.length ? `${made.length > 1 ? `${Cap(num(made.length))} drafts` : 'Draft'} made for ${andList(made)}: ${made.length > 1 ? 'each waits' : 'it waits'} above for your APPROVE.` : '';
  const no = missed.map((m) => `Not for ${m.name}: ${m.why.replace(/[.!?]+$/, '')}.`).join(' ');
  return [ok, no, missed.length ? 'Your words are still here: tap the key again for the rest.' : ''].filter(Boolean).join(' ');
}

/** Each account's state in words, on the queue: linked as who, not linked, or the brain not answering. */
export function accountsWords(accounts: { name: string; who: string | null }[] | null): string {
  if (!accounts) return 'I can’t reach my brain, so I can’t say which of your accounts are linked. Try again in a moment.';
  const linked = accounts.filter((a) => a.who);
  const not = accounts.filter((a) => !a.who).map((a) => a.name);
  const yes = linked.length ? `Linked: ${linked.map((a) => `${a.name} as ${a.who}`).join(', ')}.` : 'None of your accounts is linked yet.';
  return `${yes}${not.length ? ` Not linked: ${andList(not)} (under Accounts, with the steps).` : ''}`;
}

/** SENT TODAY's lines. */
export const SENT_LOADING = 'Reading what went out today…';
export const SENT_ERROR = 'I can’t reach my brain, so I can’t read what went out today. Try again in a moment.';
export const SENT_EMPTY = 'Nothing went out today. Every post waits in the queue for your APPROVE first.';
export const sentNote = (n: number): string => `${n === 1 ? 'One thing' : `${n} things`} went out today, each after your APPROVE:`;
/** A panel's line when the brain cannot be reached (LINKS' panels, on SOCIAL and LINKS). */
export const accountOffline = (name: string): string => `I can’t reach my brain, so I can’t tell whether ${name} is linked. Nothing has changed. Try again in a moment.`;
