/**
 * LIFE EASIER (BRIEF-OCT-IDEAS-2): the words and rules of eight small things that save him a tap or a thought. Pure, so the phone and
 * the tests read the same rules. Everything here works from his own data or the public page he named; nothing asks a model.
 *   - watchers: what "tell me when this price drops" means, and what the phone lists of a watcher (the brain's watchers.ts keeps them);
 *   - email triage: which of his unread emails look like they need an answer (the sender and the subject only), the count in words,
 *     and the starting point of a reply (his to edit; sent only on his SEND tap);
 *   - what did I miss: the lines of the card from his own data since his last open;
 *   - teach me what you learned: five plain sentences at most, from the report card and the capability ledger;
 *   - the photographed letter: whether read text looks like a letter or a bill, its date, its amount and its sender.
 */

// ================================================================ watchers

export type WatchKind = 'price' | 'page' | 'strike' | 'reply';

/** A watcher as the brain lists it (apps/edge/src/watchers.ts publicWatcher). */
export interface WatcherInfo {
  id: string;
  kind: WatchKind;
  url: string;
  label: string;
  created: number;
  checked: number;
  ok: boolean;
  state: 'watching' | 'told' | 'stopped';
  toldAt?: number;
  line?: string;
  note?: string;
  price?: number;
  strikeNow?: boolean;
  /** [recall] a chase (kind `reply`): the name he used, what about, its morning, whether mail was linked, and when a reply came. */
  who?: string;
  about?: string;
  by?: number;
  mail?: boolean;
  repliedAt?: number;
}

/** What he asked a watcher to do, from "tell me when …": the kind, and the address if his words carry one. null when it is no such ask. */
export function watcherAsked(text: string): { kind: Exclude<WatchKind, 'reply'>; url: string; words: string } | null {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!/^(?:hey ghosty[, ]+|ghosty[, ]+|please[, ]+)?(?:tell|let|ping|notify|message|warn|alert)\s+me\s+(?:when|if|as soon as|the moment)\b/i.test(t) && !/^(?:hey ghosty[, ]+|ghosty[, ]+|please[, ]+)?let me know\s+(?:when|if|as soon as)\b/i.test(t)) return null;
  const url = (/https?:\/\/[^\s<>"']+/i.exec(t)?.[0] ?? '').replace(/[.,;:!?)]+$/, '');
  const rest = t.replace(/https?:\/\/[^\s<>"']+/gi, ' ');
  const kind: Exclude<WatchKind, 'reply'> | null =
    /\b(strikes?|industrial action|walk-?outs?)\b/i.test(rest) ? 'strike'
    : /\b(price|cost)\b.*\b(drops?|falls?|goes down|gets? cheaper|reduced|lower|comes down|dips?)\b|\b(drops?|falls?|goes down|gets? cheaper|reduced|comes down|goes on sale|on sale|cheaper)\b/i.test(rest) && /\b(price|cost|cheaper|sale|reduced|drops?|goes down)\b/i.test(rest) ? 'price'
    : /\b(change[sd]?|updates?d?|new|different|moves?|is posted|appears?)\b/i.test(rest) && /\b(page|site|website|web ?page|notice|status|timetable|list|post|link)\b/i.test(rest) ? 'page'
    : null;
  return kind ? { kind, url, words: rest.replace(/\s+/g, ' ').trim() } : null;
}

/** The plain line a watcher says under PLAN: what it watches for, and where it stands. */
export function watcherStands(w: Pick<WatcherInfo, 'kind' | 'state' | 'ok' | 'checked' | 'note' | 'line' | 'toldAt' | 'price' | 'strikeNow'> & Partial<Pick<WatcherInfo, 'by' | 'mail' | 'who'>>, now: number, clock: (ms: number) => string, day: (ms: number) => string): string {
  // [recall] a chase: when it looks, and whether that is through his mail or a plain reminder
  if (w.kind === 'reply' && w.state === 'watching') return `I look on ${w.by ? day(w.by) : 'its day'} at 9 am${w.mail ? ` for a reply${w.who ? ` from ${w.who}` : ''}` : ': a plain reminder, as no mail account is linked'}${w.note ? ` · ${w.note}` : ''}`;
  const what = w.kind === 'price' ? 'a price drop' : w.kind === 'page' ? 'a change to the page' : 'a strike or industrial action';
  if (w.state === 'told') return `Told you${w.toldAt ? ` on ${day(w.toldAt)}` : ''}: ${w.line ?? what}`;
  if (w.state === 'stopped') return `Stopped: ${(w.note ?? 'I cannot read it any more').replace(/^I could not read it: /, '')}`;
  const seen = w.checked ? `Last looked at ${now - w.checked < 86_400_000 ? clock(w.checked) : day(w.checked)}${w.ok ? '' : `, but ${(w.note ?? 'it did not answer').replace(/^I could not read it: /, '')}`}` : 'Not looked at yet';
  const num = w.kind === 'price' && w.price !== undefined ? ` · £${w.price.toFixed(2).replace(/\.00$/, '')} now` : '';
  return `Waiting for ${what}${num} · ${seen}`;
}

// ================================================================ email triage

/** One unread email, the sender and the subject only (the brain's GET /guardian/mail/inbox). */
export interface MailLine {
  uid: number;
  from: string;
  name: string;
  address: string;
  subject: string;
  date: string;
}

const AUTOMATED_FROM = /(?:^|[^a-z])(?:no-?reply|do-?not-?reply|noreply|mailer-daemon|postmaster|bounce|newsletter|news|marketing|offers?|deals?|promo(?:tions?)?|notifications?|alerts?|updates?|info|hello|team|support|billing|receipts?|orders?|accounts?|security|digest|survey|feedback)(?:[^a-z]|$)/i;
const AUTOMATED_SUBJECT = /\b(newsletter|unsubscribe|receipt|your order|order confirmation|has shipped|dispatched|invoice|statement is ready|verification code|verify your|password|security alert|sign-?in|\d+% off|sale|offer|deal|webinar|digest|survey|rate your|welcome to|thanks for (?:your order|signing up)|delivery|tracking)\b/i;
const ASKS = /\?|\b(can you|could you|would you|will you|are you|do you|did you|please|pls|reply|respond|rsvp|confirm|let me know|let us know|need (?:your|you to)|waiting (?:for|on)|get back to|any chance|when (?:are|can|will)|urgent|asap|invitation|invite|your thoughts|quick question)\b/i;

/** Does this unread email look like it needs an answer: a person's address (not a no-reply or a shop), and an ask in the subject. */
export function needsAnswer(m: Pick<MailLine, 'address' | 'from' | 'subject'>): boolean {
  const who = `${m.address} ${m.from}`;
  if (!m.address || AUTOMATED_FROM.test(m.address.split('@')[0] ?? '') || /\b(?:no-?reply|noreply)\b/i.test(who)) return false;
  if (AUTOMATED_SUBJECT.test(m.subject)) return false;
  return ASKS.test(m.subject);
}

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
/** "two emails need an answer", "one email needs an answer", "12 emails need an answer". */
export function triageLine(n: number): string {
  const w = n >= 0 && n <= 10 ? NUMBER_WORDS[n]! : String(n);
  return n === 1 ? `${w} email needs an answer` : `${w} emails need an answer`;
}

/** The first name of a sender ("Sam Jones" → "Sam"; an address alone → its local part, capitalised). */
export function firstName(m: Pick<MailLine, 'name' | 'address'>): string {
  const n = (m.name || m.address.split('@')[0] || '').replace(/[._-]+/g, ' ').trim().split(/\s+/)[0] ?? '';
  return n ? n.charAt(0).toUpperCase() + n.slice(1) : '';
}

/**
 * A reply to start from, written by rule and never by a model: it says he has seen it and will come back. His to change before the
 * SEND tap; `me` is his name when he has given one.
 */
export function draftReply(m: Pick<MailLine, 'name' | 'address' | 'subject'>, me = ''): { subject: string; body: string } {
  const subject = m.subject.replace(/^(?:re:\s*)+/i, '').trim();
  const hi = firstName(m);
  return { subject: `Re: ${subject}`, body: `${hi ? `Hi ${hi},` : 'Hi,'}\n\nThanks for your email about “${subject}”. I’ve seen it, and I’ll come back to you properly very soon.\n\n${me ? `Thanks,\n${me}` : 'Thanks'}` };
}

// ================================================================ what did I miss

export interface MissedInput {
  /** When he was last here (ms) and now. */
  since: number;
  now: number;
  /** Headlines he has not seen (the Brief remembers the ones it showed). */
  headlines: string[];
  /** Things in his agenda that came and went since: their time (ms) and title. */
  passed: { at: number; title: string }[];
  /** Spending added since: rows from the statements he added. */
  spend: { rows: number } | null;
  /** The school's and the training's notices since, as the brain sent them: title and text. */
  school: string[];
  training: string[];
  /** Notices from Ghosty not yet read. */
  inbox: number;
}

/** "yesterday at 14:20", "on Monday at 09:05", "3 days ago": when he was last here, in his words. */
export function whenWords(since: number, now: number, clock: (ms: number) => string): string {
  const sod = (t: number) => new Date(t).setHours(0, 0, 0, 0);
  const days = Math.round((sod(now) - sod(since)) / 86_400_000);
  if (days <= 0) return `today at ${clock(since)}`;
  if (days === 1) return `yesterday at ${clock(since)}`;
  if (days < 7) return `on ${new Date(since).toLocaleDateString('en-GB', { weekday: 'long' })} at ${clock(since)}`;
  return `${days} days ago`;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const cut = (s: string, n = 70) => (s.length > n ? `${s.slice(0, n - 1).replace(/\s+\S*$/, '')}…` : s);

/** The card's lines: one sentence each, only for what there is, in the order he cares about; [] when nothing came. */
export function missedLines(m: MissedInput, clock: (ms: number) => string): string[] {
  const out: string[] = [];
  if (m.passed.length) {
    const first = m.passed[0]!;
    out.push(m.passed.length === 1 ? `${first.title} came and went at ${clock(first.at)}.` : `${plural(m.passed.length, 'thing')} in your diary came and went, the last ${m.passed[m.passed.length - 1]!.title} at ${clock(m.passed[m.passed.length - 1]!.at)}.`);
  }
  if (m.headlines.length) out.push(m.headlines.length === 1 ? `One headline you haven’t seen: ${cut(m.headlines[0]!)}` : `${plural(m.headlines.length, 'headline')} you haven’t seen, first: ${cut(m.headlines[0]!)}`);
  if (m.spend?.rows) out.push(`You added ${plural(m.spend.rows, 'row')} of spending.`);
  if (m.school.length) out.push(`School: ${cut(m.school[0]!, 90)}`);
  if (m.training.length) out.push(`Training: ${cut(m.training[0]!, 90)}`);
  if (m.inbox) out.push(`${plural(m.inbox, 'notice')} from me ${m.inbox === 1 ? 'is' : 'are'} unread.`);
  return out;
}

/** The ask line's words for it: "what did I miss?", "catch me up", "what have I missed". */
export function missedAsked(text: string): boolean {
  const t = text.trim().replace(/[?.!]+$/, '').replace(/’/g, "'");
  return /^(?:(?:hey )?ghosty[, ]+|please[, ]+)?(?:so[, ]+)?(?:what (?:did|have) i miss(?:ed)?(?: while i was (?:away|out|gone))?|what(?:'s| has| is) (?:happened|been going on)(?: while i was (?:away|out|gone))?|catch me up|bring me up to speed|what happened while i was (?:away|out|gone))$/i.test(t);
}

// ================================================================ teach me what you learned

/** The report card's runs on this phone (offline/bench.ts Run, only what is read here). */
export interface ReportRun {
  at: number;
  complete: boolean;
  model?: string;
  items: { plain: boolean; think: boolean | null }[];
}

export interface TeachInput {
  now: number;
  /** The brain's WHAT I LEARNED TO DO lines (GET /api/training/ledger), or the last copy kept on this phone; null: none to be had. */
  ledger: string[] | null;
  /** True when `ledger` is this phone's own last copy, not the brain's word today. */
  ledgerKept: boolean;
  runs: ReportRun[];
  /** The GYM: losses to him that Ghosty studied (Connect 4), the latest with its move and idea. */
  gym: { lessons: number; latest?: { wonAt: number; idea?: string } | null };
}

const score = (r: ReportRun): { plain: number; think: number | null; n: number; tn: number } => {
  const th = r.items.filter((x) => x.think !== null);
  return { plain: r.items.filter((x) => x.plain).length, think: th.length ? th.filter((x) => x.think).length : null, n: r.items.length, tn: th.length };
};

/**
 * "Teach me what you learned this week": at most five plain sentences, in my voice, from the report card's numbers (the gap between
 * answering as in chat and answering with THINK HARDER: closed or not), what I learned to do (the ledger), and the loss he studied
 * in the GYM. Nothing is added that the records do not say; a record that is not there is said so once, plainly.
 */
export function teachLines(x: TeachInput): string[] {
  const out: string[] = [];
  const done = x.runs.filter((r) => r.complete && r.items.length);
  const last = done[done.length - 1];
  const was = done[done.length - 2];
  if (last) {
    const a = score(last);
    const gap = a.think !== null ? a.think - a.plain : null;
    const head = `On my report card I got ${a.plain} of ${a.n} right as I answer in chat${a.think !== null ? ` and ${a.think} of ${a.tn} with THINK HARDER` : ''}.`;
    out.push(head);
    if (gap !== null) {
      const b = was ? score(was) : null;
      const before = b && b.think !== null ? b.think - b.plain : null;
      if (before === null) out.push(gap > 0 ? `That is the first time I have measured it, so the gap of ${plural(gap, 'question')} has nothing to be compared with yet.` : 'That is the first time I have measured it, and THINK HARDER did not help me at all.');
      else if (gap < before) out.push(`The gap between the two closed from ${plural(before, 'question')} to ${gap}: I am getting better without thinking harder.`);
      else if (gap === before) out.push(`The gap between the two did not move: it is still ${plural(gap, 'question')}.`);
      else out.push(`The gap did not close: it grew from ${plural(before, 'question')} to ${gap}.`);
    }
  } else out.push('I have not run my report card to the end yet, so I have no scores to teach you from.');
  const ledger: string[] = [];
  if (x.ledger === null) ledger.push('I cannot reach my brain, so I cannot say what I learned to do this week.');
  else if (!x.ledger.length) ledger.push('I did not learn anything new to do this week.');
  else {
    if (x.ledgerKept) ledger.push('I cannot reach my brain, so this is from my last copy of what I learned to do.');
    ledger.push(...x.ledger.slice(0, 2).map((l) => l.replace(/\s+/g, ' ').trim()));
  }
  const gym =
    x.gym.lessons > 0
      ? [`In the GYM you beat me at Connect 4${x.gym.latest?.wonAt ? ` at move ${x.gym.latest.wonAt}` : ''}${x.gym.latest?.idea ? ` with ${x.gym.latest.idea}` : ''}, and I studied that loss until I could see it coming.`]
      : [];
  // five sentences at most: the second thing I learned to do is the first to go, then the first (the GYM and the scores stay)
  const all = [...out, ...ledger, ...gym];
  while (all.length > 5) {
    const spare = all.indexOf(ledger[1] ?? '\0');
    all.splice(spare >= 0 ? spare : all.length - 1, 1);
    if (all.length > 5 && spare < 0) break;
  }
  return all.slice(0, 5);
}

/** The ask line's words for it. */
export function teachAsked(text: string): boolean {
  const t = text.trim();
  return /\b(?:teach me|tell me|explain|show me|what)\b/i.test(t) && /\blearn(?:ed|t)\b/i.test(t) && /\b(?:this week|lately|recently|last week|training)\b/i.test(t);
}

// ================================================================ the photographed letter

export interface LetterRead {
  /** What it looks like: a bill when it asks for money, else a letter. */
  kind: 'bill' | 'letter';
  /** The date it asks about, as YYYY-MM-DD in his zone (a date in the future), or null when none was found. */
  date: string | null;
  /** The date as the letter wrote it ("14 November 2026"). */
  dateText: string;
  amount: string | null;
  sender: string;
  reference: string | null;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const valid = (y: number, m: number, d: number) => m >= 1 && m <= 12 && d >= 1 && d <= new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Every date the words give (day first, as a UK letter writes it): [text, ISO, where it stood]. A date with no year is the next one coming. */
export function datesIn(text: string, today: string): { text: string; iso: string; at: number }[] {
  const out: { text: string; iso: string; at: number }[] = [];
  const t0 = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  const add = (m: RegExpExecArray, y: number, mo: number, d: number, noYear = false) => {
    let yy = y;
    if (yy < 100) yy += 2000;
    if (noYear && valid(yy, mo, d) && Date.UTC(yy, mo - 1, d) < t0) yy += 1;
    if (valid(yy, mo, d)) out.push({ text: m[0].trim(), iso: iso(yy, mo, d), at: m.index });
  };
  let m: RegExpExecArray | null;
  const named = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?(?:,?\s+(\d{4}))?\b/gi;
  while ((m = named.exec(text))) add(m, m[3] ? +m[3] : +today.slice(0, 4), MONTHS.indexOf(m[2]!.slice(0, 3).toLowerCase()) + 1, +m[1]!, !m[3]);
  const us = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/gi;
  while ((m = us.exec(text))) add(m, m[3] ? +m[3] : +today.slice(0, 4), MONTHS.indexOf(m[1]!.slice(0, 3).toLowerCase()) + 1, +m[2]!, !m[3]);
  const num = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/g;
  while ((m = num.exec(text))) add(m, +m[3]!, +m[2]!, +m[1]!);
  const isoRe = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
  while ((m = isoRe.exec(text))) add(m, +m[1]!, +m[2]!, +m[3]!);
  return out.sort((a, b) => a.at - b.at);
}

const DUE = /\b(due|payable|pay(?:ment)? by|please pay|balance|amount due|total due|overdue|direct debit)\b/i;
const APPT = /\b(appointment|appt|booked|booking|reservation|surgery|clinic|hospital|clinic|attend|visit)\b/i;
const REF = /\b(reference|ref(?:erence)?\.? (?:no|number|n°)?|account number|policy number|customer number|case number|nhs number)\b/i;
const BY = /\b(by|before|no later than|on or before)\b/i;

/**
 * Does read text look like a letter or a bill, and what does it ask: a date in the future, an amount, "by", "due", "appointment",
 * "reference" (at least three of the six, or a date and two). `today` is his day, "2026-11-11". null when it looks like neither.
 */
export function letterOf(text: string, today: string): LetterRead | null {
  const t = text.replace(/[ \t]+/g, ' ').trim();
  if (t.length < 25) return null;
  const dates = datesIn(t, today).filter((d) => d.iso >= today);
  const amount = /£\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?)/.exec(t)?.[0].replace(/\s+/g, '') ?? null;
  const flags = [dates.length > 0, !!amount, DUE.test(t), APPT.test(t), REF.test(t), dates.some((d) => BY.test(t.slice(Math.max(0, d.at - 14), d.at)))];
  const hits = flags.filter(Boolean).length;
  if (!(hits >= 3 || (dates.length > 0 && hits >= 2))) return null;
  // the date he is asked about: the one a "by" or "due" stands before, else the first one coming
  const near = dates.find((d) => /\b(by|before|due|on|date|appointment)\b/i.test(t.slice(Math.max(0, d.at - 26), d.at))) ?? dates[0] ?? null;
  const ref = /(?:reference|ref\.?|account|policy|customer|case)\s*(?:number|no\.?|n°)?\s*[:#]?\s*([A-Z0-9][A-Z0-9 -]{3,18}[A-Z0-9])/i.exec(t)?.[1]?.trim() ?? null;
  return { kind: amount && DUE.test(t) ? 'bill' : 'letter', date: near?.iso ?? null, dateText: near?.text ?? '', amount, sender: senderOf(t), reference: ref };
}

/** Who a letter is from: a "From:" line, else the letterhead (the first short line of words), else "A letter". */
export function senderOf(text: string): string {
  const from = /^\s*from:\s*(.{2,50})$/im.exec(text)?.[1]?.trim();
  if (from) return from.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  for (const raw of text.split(/\n|\s{3,}/)) {
    const l = raw.replace(/\s+/g, ' ').trim();
    if (l.length < 3 || l.length > 44 || !/[A-Za-z]{3}/.test(l)) continue;
    if (/^(dear|date|ref|reference|account|tel|phone|email|www|http|page|invoice|statement|your|hi |hello)\b/i.test(l) || /£|\d{2,}[/.-]\d{2}|^\d/.test(l) || /[.!?]$/.test(l)) continue;
    return l.replace(/[,;:]+$/, '');
  }
  return 'A letter';
}

/** "14 November 2026" for an ISO date. */
export function longDay(isoDay: string): string {
  const d = new Date(Date.UTC(+isoDay.slice(0, 4), +isoDay.slice(5, 7) - 1, +isoDay.slice(8, 10)));
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
