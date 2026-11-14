/**
 * MEMORY AND RECALL (BRIEF-DEPTH-MEMORY), the pure parts both sides use: what "what did I ask you about X?" looks like, how a
 * kept turn is matched to a question by its words, how a day is said ("today", "yesterday", "on Tuesday", "last week"), and what
 * "remind me to chase this if Sam doesn't reply by Thursday" asks. No model, no network, no browser.
 *
 * Everything here is about HIS OWN words: the turns he typed or said, and what Ghosty answered him. A name in a chase is the name he
 * used for his own correspondent; nothing about anyone is inferred.
 */
import { queryTerms, wordMatcher } from './meaning';

/** One kept turn: when, where (app, telegram), what he asked, and the first words of what Ghosty said. */
export interface Gist {
  at: number;
  via: string;
  q: string;
  a?: string;
  /** [recall] memory.u11: pinned, so it stays past the 30 days. */
  pinned?: boolean;
}

/** A kept turn found for a question, with its day said in words. */
export interface RecallHit extends Gist {
  /** "today", "yesterday", "on Tuesday", "last week", "on 2 Oct". */
  day: string;
  /** "Tue 10 Nov · Telegram". */
  stamp: string;
  score: number;
}

/** How long a turn's gist is kept on the brain (days). */
export const RECALL_DAYS = 30;
/** How far back the RECALL block in a reply's context looks for a matching turn (days). */
export const RECALL_WEEK = 7;
/** At most this many RECALL lines in the prompt. */
export const RECALL_LINES = 4;

const LEAD = String.raw`^(?:hey ghosty[, ]+|ghosty[, ]+|ok(?:ay)?[, ]+|so[, ]+)?`;
const ASKS: RegExp[] = [
  new RegExp(`${LEAD}(?:what|when) (?:did|have) i (?:ask(?:ed)?|tell|told|say|said) (?:to )?(?:you )?(?:about|on|re|regarding) (.+)$`, 'i'),
  new RegExp(`${LEAD}when did i (?:mention|bring up|talk about|ask about|ask you about|tell you about|say anything about) (.+)$`, 'i'),
  new RegExp(`${LEAD}(?:did|have) i (?:ever )?(?:tell|told|ask|asked) you (?:about|anything about) (.+)$`, 'i'),
  new RegExp(`${LEAD}(?:find|show me|search for) (?:where|when|the times?) i (?:said|mentioned|asked about|talked about|asked you about|told you about) (.+)$`, 'i'),
  new RegExp(`${LEAD}what have i (?:asked|told) you about (.+)$`, 'i'),
  // (memory.c5: the ways he says it out loud, in the car)
  new RegExp(`${LEAD}(?:what was i asking(?: you)? about|remind me what i (?:asked|said)(?: you)?(?: about)?|what did we (?:say|talk about|decide) (?:about|on)|did we (?:talk|speak) about|have we (?:talked|spoken) about|what did you tell me about|what did i say about|when did we (?:talk|speak) about|what was that (?:thing )?(?:about|on)) (.+)$`, 'i'),
];

/** The thing he is looking for in "what did I ask you about trains?" ("trains"), or null when it is no such question. */
export function recallAsked(text: string): string | null {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim().replace(/[?.!]+$/, '');
  if (t.length > 160) return null;
  for (const re of ASKS) {
    const m = re.exec(t);
    if (!m) continue;
    const about = m[1]!.replace(/^(?:the|a|an|my) /i, '').replace(/\s+(?:before|earlier|last week|this week|the other day|recently)$/i, '').trim();
    if (about && queryTerms(about).length) return about;
  }
  return null;
}

const DAY_MS = 86_400_000;
const fmt = (tz: string, o: Intl.DateTimeFormatOptions) => {
  try {
    return new Intl.DateTimeFormat('en-GB', { ...o, timeZone: tz || 'UTC' });
  } catch {
    return new Intl.DateTimeFormat('en-GB', { ...o, timeZone: 'UTC' });
  }
};
/** The local date of a moment, "2026-11-10". */
export const localDay = (at: number, tz: string): string => fmt(tz, { year: 'numeric', month: '2-digit', day: '2-digit' }).format(at).split('/').reverse().join('-');
/** Whole local days from `at` to `now` (0: the same day). */
export function daysAgo(at: number, now: number, tz: string): number {
  const d = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.round((d(localDay(now, tz)) - d(localDay(at, tz))) / DAY_MS);
}

/** How he would say the day: "today", "yesterday", "on Tuesday" (this week), "last week", else "on 2 Oct". */
export function dayWord(at: number, now: number, tz: string): string {
  const n = daysAgo(at, now, tz);
  if (n <= 0) return 'today';
  if (n === 1) return 'yesterday';
  if (n < 7) return `on ${fmt(tz, { weekday: 'long' }).format(at)}`;
  if (n < 14) return 'last week';
  return `on ${fmt(tz, { day: 'numeric', month: 'short' }).format(at)}`;
}

/** Where a turn was: "Telegram" or "the app". */
export const viaWord = (via: string): string => (via === 'telegram' ? 'Telegram' : 'the app');
/** "Tue 10 Nov · Telegram". */
export const stampOf = (at: number, via: string, tz: string): string => `${fmt(tz, { weekday: 'short', day: 'numeric', month: 'short' }).format(at).replace(',', '')} · ${via === 'telegram' ? 'Telegram' : 'App'}`;

/**
 * The kept turns that match a question by its words, best first (more of its words, then the newest). `since`: only turns at or
 * after it; `skip`: leave these out (the turn being asked right now). Words only: the phone adds meaning when its model is there.
 */
export function matchGists(query: string, gists: Gist[], o: { now: number; tz: string; since?: number; skip?: (g: Gist) => boolean; k?: number }): RecallHit[] {
  const m = wordMatcher(query);
  if (!m) return [];
  const out: RecallHit[] = [];
  for (const g of gists) {
    if ((o.since && g.at < o.since) || g.at > o.now + 60_000 || o.skip?.(g)) continue;
    const s = m(`${g.q} ${g.a ?? ''}`.toLowerCase());
    if (!s.matched) continue;
    out.push({ ...g, day: dayWord(g.at, o.now, o.tz), stamp: stampOf(g.at, g.via, o.tz), score: s.words });
  }
  return out.sort((a, b) => b.score - a.score || b.at - a.at).slice(0, o.k ?? 8);
}

/** A kept turn's question from the day log's gist (`asked: "…"`), or '' for any other line. */
export const gistAsk = (text: string): string => /^asked: "(.*)"$/.exec(text)?.[1] ?? '';

/** The first sentence of a reply, at most `max` characters: what a gist keeps of what Ghosty said. */
export function replyGist(text: string, max = 90): string {
  const t = String(text ?? '').replace(/[*_`#>|]/g, '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  const first = /^(.+?[.!?])(?:\s|$)/.exec(t)?.[1] ?? t;
  return first.length > max ? `${first.slice(0, max - 1).trimEnd()}…` : first;
}

/** One RECALL line for the prompt: "Tue: you asked "trains to Leeds"; I said "The 07:12 is quickest."", at most 120 characters. */
export function recallLine(h: Pick<RecallHit, 'day' | 'q' | 'a'>): string {
  const q = h.q.length > 60 ? `${h.q.slice(0, 59)}…` : h.q;
  const a = h.a ? (h.a.length > 44 ? `${h.a.slice(0, 43)}…` : h.a) : '';
  return `${h.day.replace(/^on /, '')}: "${q}"${a ? ` → "${a}"` : ''}`;
}

/** Does a reply say "like you said on Tuesday" (or "you asked yesterday", "as you mentioned last week")? The day words, or null. */
export function recallSaid(text: string): string | null {
  const m = /\b(?:like|as) you (?:said|asked|mentioned|told me)\s+(today|yesterday|last week|on (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i.exec(text) ?? /\byou (?:said|asked|mentioned|told me)(?: (?:about )?(?:this|that|it))?\s+(yesterday|last week|on (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i.exec(text);
  return m ? m[1]!.toLowerCase() : null;
}

/** Which days "on Tuesday" / "yesterday" / "last week" can mean, as days ago (within a fortnight). */
export function daysFor(word: string, now: number, tz: string): number[] {
  const w = word.toLowerCase().replace(/^on /, '');
  if (w === 'today') return [0];
  if (w === 'yesterday') return [1];
  if (w === 'last week') return [7, 8, 9, 10, 11, 12, 13];
  const names = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const want = names.indexOf(w);
  if (want < 0) return [];
  const out: number[] = [];
  for (let n = 1; n < 14; n++) if (new Date(`${localDay(now - n * DAY_MS, tz)}T12:00:00Z`).getUTCDay() === want) out.push(n);
  return out.slice(0, 1);
}

// ================================================================ a chase held for days

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const PRONOUN = /^(they|them|he|she|him|her|it|anyone|nobody|no one)$/i;

/**
 * "remind me to chase this if Sam doesn't reply by Thursday", "chase this up if they haven't answered by Friday", "if Sam hasn't
 * replied by tomorrow remind me to chase": who (the name he used, '' for "they") and the day word. null when it is no such ask.
 */
export function chaseAsked(text: string): { who: string; day: string; again?: string; wait?: 'parcel' } | null {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim().replace(/[?.!]+$/, '');
  // (memory.u4: "… and again Monday if still nothing": a second look on that day)
  const again = /\band (?:again|once more|chase again) (?:on |by )?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.exec(t)?.[1]?.toLowerCase();
  // (memory.s4: "if the parcel hasn't come by Friday": a wait that his own mail can settle — a delivery email — never a paid tracker)
  const parcel = /\bif (?:the |my )?(parcel|package|delivery|order)\s+(?:hasn'?t|has not|doesn'?t|does not|isn'?t|is not)\s+(?:come|arrived|turned up|been delivered|here|arrive|come in)\b.*?\bby\s+(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.exec(t);
  if (parcel && /\b(?:remind|chase|tell|let) me\b/i.test(t)) return { who: '', day: parcel[2]!.toLowerCase(), wait: 'parcel', ...(again ? { again } : {}) };
  if (!/\bchase\b/i.test(t)) return null;
  const m = /\bif\s+([A-Za-z][\w'’.-]*(?: [A-Z][\w'’.-]*)?)\s+(?:doesn'?t|does not|don'?t|do not|hasn'?t|has not|haven'?t|have not|didn'?t|did not)\s+(?:reply|replied|respond|responded|answer|answered|get back|got back|write back|written back)\b.*?\bby\s+(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.exec(t)
    ?? /\bif\s+(?:there'?s\s+|there is\s+)?no (?:reply|answer|response)(?: from ([A-Za-z][\w'’.-]*))?\s+by\s+(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.exec(t);
  if (!m) return null;
  const raw = (m[1] ?? '').trim();
  return { who: !raw || PRONOUN.test(raw) ? '' : raw.replace(/^./, (c) => c.toUpperCase()), day: m[2]!.toLowerCase(), ...(again ? { again } : {}) };
}

/** Minutes east of UTC for a zone at a moment. */
function offsetMin(at: number, tz: string): number {
  const p = Object.fromEntries(fmt(tz, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(at).map((x) => [x.type, x.value]));
  const local = Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour! % 24, +p.minute!);
  return Math.round((local - Math.floor(at / 60_000) * 60_000) / 60_000);
}

/** 9 am local on the day he named (the next one after today; "today" if it is not yet 9; "tomorrow"), in ms. */
export function chaseAt(day: string, now: number, tz: string): number {
  const today = localDay(now, tz);
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
  let add = 0;
  if (day === 'tomorrow') add = 1;
  else if (day !== 'today') {
    const want = WEEKDAYS.indexOf(day);
    add = (want - dow + 7) % 7 || 7;
  }
  const d = new Date(`${today}T09:00:00Z`);
  d.setUTCDate(d.getUTCDate() + add);
  const guess = d.getTime();
  const at = guess - offsetMin(guess, tz) * 60_000;
  // ("by today" said after 9: three hours from now, never a moment already gone)
  return at <= now ? now + 3 * 3600_000 : at;
}

/** "what are you chasing?", "any chases?", "who am I chasing": the list of chases. */
export const chasingAsked = (text: string): boolean => /^(?:hey ghosty[, ]+|ghosty[, ]+)?(?:what (?:are|am) (?:you|i|we) chasing(?: for me)?|(?:any |my |show (?:me )?my |list (?:my )?)chases|who (?:am i|are you) chasing(?: for me)?)[?.!]*$/i.test(String(text ?? '').trim());

const whoWord = (who: string) => who || 'them';
/** "Thursday 9 am". */
export const chaseDay = (at: number, tz: string): string => `${fmt(tz, { weekday: 'long' }).format(at)} 9 am`;

/** What Ghosty says once when a chase is set. */
export function chaseSetLine(who: string, at: number, tz: string, mail: boolean): string {
  return mail
    ? `If nothing comes from ${whoWord(who)} by ${chaseDay(at, tz)}, I'll remind you to chase it.`
    : `No mail account is linked, so on ${chaseDay(at, tz)} I'll simply remind you to chase ${whoWord(who)}.`;
}
/** That morning, when a reply came. */
export const repliedLine = (who: string, at: number, tz: string): string => `${who || 'They'} replied on ${fmt(tz, { weekday: 'long' }).format(at)}; nothing to chase.`;
/** That morning, when nothing came (or no mail is linked). */
export const chaseDueLine = (who: string, about: string, mail: boolean): string =>
  `${mail ? `No reply from ${whoWord(who)} yet` : `Time to chase ${whoWord(who)}`}${about ? `: “${about.slice(0, 80)}”` : ''}. DRAFT A CHASE writes one for your OK.`;

/** [recall] memory.u4: the second look, said. */
export const againLine = (at: number, tz: string): string => `If there's still nothing, I'll look again on ${chaseDay(at, tz)}.`;
/** [recall] memory.s4: a parcel, settled by a delivery email in his own inbox (never a paid tracker). */
export const parcelSetLine = (at: number, tz: string, mail: boolean): string =>
  mail ? `On ${chaseDay(at, tz)} I'll look in your email for a delivery; if there's none, I'll remind you to chase the parcel.` : `No mail account is linked, so on ${chaseDay(at, tz)} I'll simply remind you to chase the parcel.`;
export const parcelCameLine = (at: number, tz: string): string => {
  const d = new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: tz || 'UTC' }).format(at);
  return `A delivery email came on ${d}; nothing to chase.`;
};
export const parcelDueLine = (about: string, mail: boolean): string => `${mail ? 'No delivery email yet' : 'Time to chase the parcel'}${about ? `: “${about.slice(0, 80)}”` : ''}. Chase the seller, or tell me it came.`;
