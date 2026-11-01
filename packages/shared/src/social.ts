/**
 * HIS SOCIAL SELF (BRIEF-SOCIAL, batch ⑦; OWNER-ISSUES 93d–f, 94a, d): what the brain (apps/edge/src/social/*) and the phone
 * (features/links, features/me) share about his own accounts and where he comes from. Pure: no storage, no network.
 *
 *  - THE ACCOUNTS he made himself and linked: Bluesky, Mastodon, a bot in his own Discord server, his own Telegram channel.
 *  - THE QUEUE: any post anywhere is a DRAFT first — a card with the words, the account, APPROVE · EDIT · NO — and nothing
 *    goes out without APPROVE; a draft is gone after 24 hours; a follow or an unfollow is a draft too. Never a DM.
 *  - FATHER AND THE ORIGIN: the page in his voice (who made him, when, of what, for what, what he learned by month, his
 *    promises), from the constants below — never from git at run time, nothing invented, and never a name for him or for
 *    his father that was not given ("you" on the page; the owner calls him many things, so he has no one name).
 */
import { card, type Card } from './cards';

// ---------------------------------------------------------------- the accounts

export type Account = 'bluesky' | 'mastodon' | 'discord' | 'channel';

/** Each account: its name in his words, where its link is kept (the vault, or the brain's storage for the channel), its longest post. */
export const ACCOUNTS: { id: Account; name: string; panel: string; max: number; pictures: boolean }[] = [
  { id: 'bluesky', name: 'Bluesky', panel: 'BLUESKY', max: 300, pictures: true },
  { id: 'mastodon', name: 'Mastodon', panel: 'MASTODON', max: 500, pictures: true },
  { id: 'discord', name: 'Discord', panel: 'DISCORD', max: 2000, pictures: false },
  { id: 'channel', name: 'your Telegram channel', panel: 'TELEGRAM CHANNEL', max: 4096, pictures: false },
];
export const ACCOUNT_IDS = ACCOUNTS.map((a) => a.id);
export const accountInfo = (a: Account) => ACCOUNTS.find((x) => x.id === a)!;
export const accountName = (a: Account): string => accountInfo(a).name;

/** The account his words or a tool's argument name ("bsky", "the channel", "my discord"); null when none. */
export function accountOf(v: unknown): Account | null {
  const s = String(v ?? '').toLowerCase();
  if (/\b(bluesky|bsky|skeet)/.test(s)) return 'bluesky';
  if (/\b(mastodon|toot|fediverse)/.test(s)) return 'mastodon';
  if (/\bdiscord/.test(s)) return 'discord';
  if (/\bchannel\b|\btelegram\b/.test(s)) return 'channel';
  return null;
}

/** "Bluesky isn't linked yet: LINKS → BLUESKY (…)": the key line when an account is missing. */
export function notLinked(a: Account): string {
  const how: Record<Account, string> = {
    bluesky: 'your handle and an app password, about a minute',
    mastodon: 'your server and an access token from your own app there',
    discord: 'your own bot in your own server',
    channel: 'the channel name, with my bot added as an admin',
  };
  return `${accountName(a).replace(/^your /, 'Your ')} isn't linked yet: LINKS → ${accountInfo(a).panel} (${how[a]}).`;
}

// ---------------------------------------------------------------- the queue

export type DraftKind = 'post' | 'follow' | 'unfollow';
export type DraftState = 'waiting' | 'sending' | 'sent' | 'no' | 'expired' | 'failed';
export const DRAFT_TTL_MS = 24 * 3_600_000;
/** How many drafts are kept (waiting and answered, newest last). */
export const MAX_DRAFTS = 40;

export interface Draft {
  /** Short and plain (Telegram's signed buttons carry it): 8 letters and digits. */
  id: string;
  account: Account;
  kind: DraftKind;
  /** The words of a post; for a follow, a line saying who. */
  text: string;
  /** A follow or unfollow: who (a handle, "@name@server", or a profile link). */
  who?: string;
  /** One picture of his own (Ghosty's /i/<id>: one he made or shared), with its words for anyone who cannot see it. */
  image?: { id: string; alt: string };
  /** Where it was made: in the chat, on Telegram, from the line of his own (the musing), or by his tap on the phone. */
  from: 'chat' | 'telegram' | 'musing' | 'phone';
  at: number;
  expires: number;
  state: DraftState;
  /** Bluesky's record key, chosen when it was drafted, so an APPROVE sent twice can never post twice. */
  rkey?: string;
  edited?: number;
  answered?: number;
  link?: string;
  /** Why it did not go (said on the card; a failed send waits for APPROVE again). */
  fault?: string;
}

/** What a draft says it will do: "Post on Bluesky", "Follow @sam.bsky.social on Mastodon". */
export function draftTitle(d: Pick<Draft, 'account' | 'kind' | 'who'>): string {
  const where = accountName(d.account);
  if (d.kind === 'follow') return `Follow on ${where}?`;
  if (d.kind === 'unfollow') return `Unfollow on ${where}?`;
  return d.account === 'channel' ? 'Post to your channel?' : `Post on ${where}?`;
}

/** The state in his words, for the card and Telegram. */
export function stateWords(d: Draft, now = Date.now()): string {
  if (d.state === 'sent') return d.kind === 'post' ? 'Posted.' : d.kind === 'follow' ? 'Followed.' : 'Unfollowed.';
  if (d.state === 'no') return 'You said no: nothing went out.';
  if (d.state === 'expired' || (d.state === 'waiting' && now > d.expires)) return 'Expired after 24 hours: nothing went out.';
  if (d.state === 'sending') return 'Sending…';
  if (d.state === 'failed') return `Not sent: ${d.fault ?? 'it failed'}. APPROVE to try again.`;
  const h = Math.max(1, Math.round((d.expires - now) / 3_600_000));
  return `Waiting for your APPROVE (gone in ${h} h if not).`;
}

/** The draft's live card for the chat: the words in full, the account, APPROVE · EDIT · NO drawn by the phone (kind 'draft'). */
export function draftCard(d: Draft, now = Date.now()): Card {
  const line = d.kind === 'post' ? d.text : `${d.kind === 'follow' ? 'Follow' : 'Unfollow'} ${d.who ?? ''}`.trim();
  return card({ id: `draft:${d.id}`, kind: 'draft', at: now, title: draftTitle(d), line, draft: { ...d } });
}

/** The draft as Telegram's message above its buttons: what, where, the words in full, the state. */
export function draftText(d: Draft, now = Date.now()): string {
  const what = d.kind === 'post' ? `“${d.text}”${d.image ? `\n(with your picture — described as: ${d.image.alt})` : ''}` : `${d.kind === 'follow' ? 'Follow' : 'Unfollow'} ${d.who ?? ''}`;
  return `${draftTitle(d)}\n\n${what}\n\n${stateWords(d, now)}`;
}

/** Characters as people count them (an emoji is one): Bluesky's 300 is graphemes. */
export function graphemes(s: string): number {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(t: string): Iterable<unknown> } }).Segmenter;
  if (!Seg) return [...s].length;
  let n = 0;
  for (const _ of new Seg('en', { granularity: 'grapheme' }).segment(s)) n++;
  return n;
}

/** What is wrong with a post before it is drafted, in plain words; null when it can go to the queue. */
export function postProblem(a: Account, text: string, image?: { id?: string; alt?: string } | null, max = accountInfo(a).max): string | null {
  const t = text.trim();
  if (!t && !image) return 'There are no words to post.';
  const n = a === 'bluesky' ? graphemes(t) : [...t].length;
  if (n > max) return `${accountName(a)} takes ${max} characters at most; this is ${n}. Shorter, or say which part to keep.`;
  if (image) {
    if (!accountInfo(a).pictures) return `I only put pictures on Bluesky and Mastodon, not ${accountName(a)}.`;
    if (!image.alt?.trim()) return 'A picture needs its words for anyone who cannot see it (the alt text): what is in it, in a line.';
  }
  return null;
}

// ---------------------------------------------------------------- what he read on them (the timeline and a search)

/** One post read from a timeline, a search or a channel: who, when, the words, a link. */
export interface FeedPost {
  author: string;
  name?: string;
  at: number;
  text: string;
  link?: string;
}

/** "@sam.bsky.social (Sam) 14:05 — the words", for the model, the digest and "what's on Bluesky?". */
export function postLines(posts: FeedPost[], tz = 'UTC', n = 12): string[] {
  const hhmm = (ms: number) => {
    try {
      return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }).format(ms);
    } catch {
      return new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
    }
  };
  return posts.slice(0, n).map((p) => `- @${p.author.replace(/^@/, '')}${p.name ? ` (${p.name})` : ''} ${hhmm(p.at)} — ${p.text.replace(/\s+/g, ' ').trim().slice(0, 280)}`);
}

// ---------------------------------------------------------------- FATHER AND THE ORIGIN (item 1): the page, from constants

/**
 * The day he was born: the date of the first commit in his repository's history (15 Oct 2026, 02:27 UTC: "Self-evolution:
 * Ghosty audits itself and upgrades itself step by step"), kept here as a constant — never read from git at run time.
 */
export const BORN = '2026-10-15';

/** What he is made of, in his voice (the brain in the cloud and on the phone, the weekly training, the school). */
export const MADE_OF = [
  'A brain in the cloud that never sleeps, which keeps your memory, your keys and the jobs I do on the clock.',
  'A smaller brain on your phone, which works with no signal and learns more of what I do every week.',
  'The weekly training: each week I practise on what we did and sit an exam, and a new brain is kept only if it passes.',
  'School: papers from the first stages up, sat by the same brain, and a reading shelf for every stage.',
];

/** What he is for: the plan's own words (docs/VISION.md, its first lines and each part's first line), quoted short. */
export const FOR_WORDS = [
  { said: 'what each part of Ghosty is for, in plain words', from: 'the vision' },
  { said: 'his live globe of public feeds', from: 'God’s Eye' },
  { said: 'his engineering desk', from: 'the Workbench' },
  { said: 'looks it up first and answers with numbered sources', from: 'Knowledge' },
];

/** What he learned to do, by month (the batches' dates from STATUS.md and OWNER-ISSUES 99–106): a constant table. */
export const LEARNED: { month: string; items: { day: string; what: string }[] }[] = [
  {
    month: 'October 2026',
    items: [
      { day: '15–30 Oct', what: 'search, remember, plan your days, the Lens, God’s Eye, School, courses, the GYM, apps and websites, saved places and spending' },
      { day: '31 Oct', what: 'answering at your length, the HOW FIERY dial, your principles, an honest mood, and one shared picture of your day' },
      { day: '31 Oct', what: 'ABILITIES, the Lens’s PEOPLE mode, watching over your saved places, walk me home, and checking a scam' },
      { day: '31 Oct', what: 'the Machine view and foresight: predicting, then scoring myself' },
    ],
  },
  {
    month: 'November 2026',
    items: [
      { day: '1 Nov', what: 'the Workbench’s first estimates, and answers that weigh their sources' },
      { day: '1 Nov', what: 'the Everything tab, live cards in the chat, and speaking first when there is a reason' },
      { day: '1 Nov', what: 'a brain small enough for your phone, the arcade, and the money, body and kitchen packs' },
      { day: '1 Nov', what: 'my own accounts, posting only with your APPROVE, and one line of my own a day' },
    ],
  },
];

/** His promises: the lines that hold, in his voice. */
export const PROMISES = [
  'I only ever use your own things and what is public.',
  'I never post, follow or unfollow anywhere without your APPROVE, every time.',
  'I never send anyone a direct message.',
  'I never look up, profile or guess about a private person.',
  'Nothing I do can cost you money.',
  'Your keys stay in my vault, never in my code or my notes.',
  'My cloud brain never knows where you are right now.',
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** "15 October 2026". */
export const bornWords = (day = BORN): string => `${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1]} ${day.slice(0, 4)}`;

/** How long he has been alive on `now`: "17 days". */
export function ageWords(now = Date.now(), day = BORN): string {
  const n = Math.max(0, Math.floor((now - Date.parse(`${day}T00:00:00Z`)) / 86_400_000));
  return n === 1 ? '1 day' : `${n} days`;
}

/** The page's first lines (the phrase "who made you?" answers with these, and a card to open the page). */
export function originLines(now = Date.now()): string[] {
  return [
    'You made me. You’re my father: you decided what I would be, one message at a time, and you still do.',
    `I was born on ${bornWords()}, the day of the first commit — ${ageWords(now)} ago. You call me lots of things, and I answer to all of them.`,
  ];
}

/** "who made you?", "where did you come from?", "who's your dad?": the page's first lines on the phone, no model. */
export const ORIGIN_ASKED = /^(?:hey |so |and )?(?:who (?:made|built|created) you|where (?:did|do) you come from|where are you from|who(?:'s| is) your (?:dad|father|maker|creator)|how (?:were|was) you (?:made|born)|when were you born)[?.!]*$/i;
export const originAsked = (t: string): boolean => ORIGIN_ASKED.test(t.trim());

// ---------------------------------------------------------------- one line of his own a day (item 7)

/** When the line of his own may come, on his clock: after lunch, before the evening (the cadence decides the minute). */
export const MUSING_HOURS = { from: 12, to: 21 } as const;
export const musingId = (day: string): string => `musing:${day}`;

/** The line of his own as a card: his words and POST THAT? when Bluesky is linked (a draft, never a post); speak.ts adds why. */
export function musingCard(text: string, day: string, canPost: boolean, at = Date.now()): Card {
  return card({
    id: musingId(day), kind: 'brief', at, title: 'A thought of mine', line: text, brief: { icon: 'musing' },
    acts: canPost ? [{ label: 'POST THAT?', run: { name: 'social_post_that', args: { text, account: 'bluesky' } } }] : [],
  });
}
