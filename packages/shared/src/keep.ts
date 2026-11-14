/**
 * A MEMORY THAT KEEPS YOUR WORD (NEXT ROUND, MEMORY lane): the pure parts, used by the brain (apps/edge/src/keep.ts) and the phone.
 *
 *  - PROMISES: what he said HE would do ("I'll send Jo the photos tomorrow"), from his own words only, with its day when he gave one;
 *    "I sent Jo the photos" marks it done.
 *  - WHERE THINGS ARE: "the spare key is in the blue tin", "I put my passport in the top drawer"; "where's the spare key?".
 *  - WHY HE CHOSE: "I picked the canal flat because it's quieter"; "why did I pick the canal flat?".
 *  - DATES: "last March", "on the 3rd", "last week" as a span of days, for recall and "what was I doing on the 3rd?".
 *  - THE WEEK: what he asked about most, what he finished, what is still open (the Sunday card).
 *
 * Every item is HIS words about HIS life. A name in a promise ("Jo") is only the word he used: nothing is looked up, nothing about
 * that person is inferred or kept apart from his sentence. No model, no network.
 */
import { localDay } from './recall';

export type KeepKind = 'promise' | 'where' | 'why';

/** One kept thing of his. `text` is his sentence (cut short); the rest is read from it. */
export interface KeepItem {
  id: string;
  kind: KeepKind;
  /** When he said it (ms) and where (app, telegram, phone). */
  at: number;
  via: string;
  /** His words, at most 160 characters. */
  text: string;
  /** promise: what he will do; where: the thing; why: what he chose. */
  what: string;
  /** where: the place; why: his reason. */
  detail?: string;
  /** promise: the day word he gave ("tomorrow", "friday") and when the nudge goes (ms). */
  due?: string;
  remindAt?: number;
  /** promise: open, done or let go; when it changed; whether the nudge went. */
  state?: 'open' | 'done' | 'dropped';
  doneAt?: number;
  nudged?: number;
  /** Kept past the usual limit (he pinned it). */
  pinned?: boolean;
}

const clean = (s: string): string => s.replace(/\s+/g, ' ').trim();
const cut = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const LEAD = /^(?:(?:hey )?ghosty[, ]+|ok(?:ay)?[, ]+|so[, ]+|oh[, ]+|right[, ]+|also[, ]+|and[, ]+|actually[, ]+|btw[, ]+|by the way[, ]+)+/i;

// ================================================================ promises

/** The verbs of a thing he can do (so "I need to know why…" or "I'll be honest" is never a promise). */
const DO = 'send|call|ring|phone|text|email|e-mail|message|reply|write|pay|buy|book|return|give|bring|fix|finish|post|pick up|collect|cancel|renew|sort out|sort|check|tell|ask|visit|clean|tidy|order|submit|get back to|drop off|drop round|take|meet|see|print|sign|file|update|wash|mow|cook|make|chase|transfer|move|put|hand in|show|change|repair|charge|top up|feed|walk|water|apply|register|wrap|deliver|lend|share|upload|back up|install|read|review|practise|practice|revise|study|tidy up|clear|empty|bin|recycle';
const PROMISE = new RegExp(String.raw`\bI(?:'ll| will| need to| must| have to| promised(?: (?:[A-Z][\w'-]*|him|her|them|my \w+))? (?:to|I'd|I would)| said I'd| said I would|'m going to| am going to|'m gonna| gotta| should really| really need to| owe (?:[A-Z][\w'-]*|him|her|them|my \w+) (?:a|an|the)?)\s+(?:also\s+|definitely\s+|really\s+|just\s+|quickly\s+)?((?:${DO})\b[^.!?;]*)`, 'i');

/** The day he gave for it: "tomorrow", "tonight", "today", "on friday", "by friday", "this weekend", "next week". */
const DUE = /\b(today|tonight|tomorrow(?: morning| evening| night)?|this (?:afternoon|evening|weekend)|next week|(?:on |by |this |next )?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i;

/** What he said he'd do and the day word, or null. Questions and requests to Ghosty are never his promise. */
export function promiseIn(raw: string): { what: string; due?: string } | null {
  // (a promise and a question in one message: "I'll send Jo the photos tomorrow, can you find me an app for it?" — each part on its own)
  const parts = clean(String(raw ?? '')).split(/(?<=[.!?])\s+|,\s*(?=(?:can|could|would|will|what|how|why|when|where|who|which|any|is|are|do|does)\b)/i);
  for (const part of parts) {
    const r = promiseOne(part);
    if (r) return r;
  }
  return null;
}
function promiseOne(raw: string): { what: string; due?: string } | null {
  const t = clean(String(raw ?? '')).replace(LEAD, '');
  if (!t || /\?\s*$/.test(t) || /^(?:can|could|would|will|should|do|does|did|is|are|what|how|why|when|where|who|which)\b/i.test(t)) return null;
  // (asking Ghosty to remind him is a reminder the reminder tools already keep, not a promise to notice)
  if (/\bremind me\b|\bset (?:a |an )?(?:reminder|alarm|timer)\b/i.test(t)) return null;
  const m = PROMISE.exec(t);
  if (!m) return null;
  let what = clean(m[1]!).replace(/[,:]\s*(?:but|and then|then|so|because)\b.*$/i, '').replace(/\s+(?:but|so|because|if)\b.*$/i, '');
  const due = DUE.exec(what)?.[1] ?? DUE.exec(t.slice(m.index))?.[1];
  what = clean(what.replace(DUE, '').replace(/\s+(?:at|in the|later|first thing)$/i, ''));
  if (what.split(' ').length < 2) return null;
  return { what: cut(what, 90), ...(due ? { due: due.toLowerCase().replace(/^(?:on|by|this) (monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/, '$1') } : {}) };
}

const PAST = 'sent|called|rang|phoned|texted|emailed|messaged|replied|wrote|paid|bought|booked|returned|gave|brought|fixed|finished|posted|picked up|collected|cancelled|canceled|renewed|sorted|checked|told|asked|visited|cleaned|tidied|ordered|submitted|got back to|dropped off|took|met|saw|printed|signed|filed|updated|washed|mowed|cooked|made|chased|transferred|moved|put|handed in|showed|changed|repaired|charged|topped up|fed|walked|watered|applied|registered|wrapped|delivered|lent|shared|uploaded|backed up|installed|read|reviewed|practised|practiced|revised|studied|cleared|emptied|did|done';
const DONE = new RegExp(String.raw`(?:^|\bI(?:'ve| have)?\s+|\b(?:just|finally|already)\s+)(?:just\s+|finally\s+|already\s+)?(?:${PAST})\b|\b(?:done|sorted|finished)\b`, 'i');
/** The verbs, present and past, so what is matched is what was done to whom ("the photos", "Jo"), never the verb. */
const VERBS = new Set(`${DO}|${PAST}`.split('|').flatMap((v) => v.split(' ')));
const words = (s: string): string[] =>
  (s.match(/[A-Za-z][A-Za-z'-]+/g) ?? [])
    .filter((w) => (w.length >= 3 || /^[A-Z][a-z]$/.test(w)) && !COMMON.has(w.toLowerCase()) && !VERBS.has(w.toLowerCase()))
    .map((w) => w.toLowerCase().replace(/'s$/, '').replace(/(?:ing|es|s)$/, ''))
    .filter((w) => w.length >= 2);
const COMMON = new Set('the and for you your him her them his their our with that this from into about then just really also have has had will would could should need must going gonna gotta promised said done sorted finished today tonight tomorrow week weekend morning evening night monday tuesday wednesday thursday friday saturday sunday next some all any one two'.split(' '));

/** Which open promise his words say is done ("I sent Jo the photos"): the best match by its words, or null. */
export function doneWith(raw: string, open: Pick<KeepItem, 'id' | 'what'>[]): string | null {
  const t = clean(String(raw ?? ''));
  if (!DONE.test(t) || /\?\s*$/.test(t) || /\b(?:not|n't|never)\b/i.test(t)) return null;
  const have = new Set(words(t));
  let best: { id: string; n: number } | null = null;
  for (const p of open) {
    const want = words(p.what);
    // (the verb itself is the weakest word: what is done to whom is what counts)
    const hit = want.filter((w) => have.has(w)).length;
    const need = want.length <= 1 ? want.length : Math.max(want.length === 2 ? 1 : 2, Math.ceil(want.length * 0.5));
    if (want.length && hit >= need && (!best || hit > best.n)) best = { id: p.id, n: hit };
  }
  return best?.id ?? null;
}

// ================================================================ where things are

const NOT_A_THING = /^(?:it|this|that|there|meeting|appointment|party|game|match|film|movie|show|concert|class|lesson|train|bus|flight|event|deadline|plan|answer|problem|weather|news|forecast|time|day|week)$/i;
const NOT_A_PLACE = /\b(?:morning|afternoon|evening|night|week|month|year|diary|calendar|future|past|news|mood|trouble|love|charge|stock|town|london|the uk|england|progress|use|danger|hospital|the post|the mail|the car park)\b/i;

/** "the spare key is in the blue tin", "I put my passport in the top drawer", "I've left the drill in the shed": the thing and the place. */
export function whereIn(raw: string): { what: string; where: string } | null {
  const t = clean(String(raw ?? '')).replace(LEAD, '').replace(/^remember(?: that)?[, ]+/i, '').replace(/[.!]+$/, '').replace(/\s+(?:now|again|too|as well|these days)$/i, '');
  if (!t || t.length > 140 || /\?\s*$/.test(t)) return null;
  const PREP = '(?:in|inside|under|underneath|on top of|on|behind|beside|next to|by|at the back of|in the back of|at the bottom of|at the top of|in the bottom of|in the top of)';
  const m = new RegExp(String.raw`^(?:I(?:'ve| have)? (?:put|left|kept|stashed|hidden|hid|placed|stored|keep|leave|store)|I always (?:put|keep|leave)) ((?:the|my|our|a|an) [\w' -]{2,40}?|[\w' -]{2,30}?) ${PREP} ((?:the|my|our|a|an) [\w' -]{2,50})$`, 'i').exec(t)
    ?? new RegExp(String.raw`^((?:the|my|our) [\w' -]{2,40}?) (?:is|are|lives|live|goes|go|is kept|are kept|is always|are always) ${PREP} ((?:the|my|our) [\w' -]{2,50})$`, 'i').exec(t);
  if (!m) return null;
  const what = clean(m[1]!).replace(/^(?:a|an) /i, 'the ');
  const prep = new RegExp(String.raw`\s${PREP}\s`, 'i').exec(t.slice(t.toLowerCase().indexOf(m[1]!.toLowerCase()) + m[1]!.length - 1))?.[0]?.trim() ?? 'in';
  const where = `${prep} ${clean(m[2]!)}`;
  const head = what.replace(/^(?:the|my|our) /i, '').split(' ').pop() ?? '';
  if (NOT_A_THING.test(head) || NOT_A_PLACE.test(where)) return null;
  return { what: cut(what, 50), where: cut(where, 70) };
}

/** "where's the spare key?", "where did I put my passport?", "where are my glasses": the thing, or null. */
export function whereAsked(raw: string): string | null {
  const t = clean(String(raw ?? '')).replace(LEAD, '').replace(/[?.!]+$/, '');
  const m = /^(?:where(?:'s| is| are|'re)|where did I (?:put|leave|keep|stash|hide)|where do I (?:keep|put)|have you got where I (?:put|left)) ((?:the|my|our) )?([\w' -]{2,40})$/i.exec(t);
  if (!m) return null;
  const thing = clean(m[2]!).replace(/(?:\s+(?:again|now|then|please|mate|pal|love|ghosty|today))+$/i, '');
  // ("where's my money gone?" is about spending, "where's my week" the diary: never a thing he put somewhere)
  if (/\b(?:gone|going|went|been|heading|off to|at)$/i.test(thing) || /^(?:money|cash|time|week|day|weekend|life|head|mind)$/i.test(thing)) return null;
  // (a place he goes, or the phone's own screens, is never a thing he put somewhere)
  if (/^(?:i|we|you|it|he|she|they|that|this|everyone|everybody|the nearest|home|the station|the shop|the shops|my phone's? settings|settings)$/i.test(thing) || /\b(?:nearest|closest|near me|from here)\b/i.test(thing)) return null;
  return thing;
}

// ================================================================ why he chose

/** "I picked the canal flat because it's quieter", "I went with the red one as it was cheaper": what he chose and why. */
export function whyIn(raw: string): { what: string; why: string } | null {
  const t = clean(String(raw ?? '')).replace(LEAD, '').replace(/[.!]+$/, '');
  if (!t || /\?\s*$/.test(t)) return null;
  const m = /\bI(?:'ve| have)? (?:picked|chose|chosen|went with|gone with|decided on|decided to (?:go with|get|buy|take|book)|bought|booked|took|got|opted for|settled on|signed up for|switched to)\s+(.+?)\s+(?:because|cos|'cause|since|as)\s+(.{6,})/i.exec(t);
  if (!m) return null;
  const what = clean(m[1]!).replace(/,$/, '');
  if (what.split(' ').length > 8 || /^(?:it|that|this|them|one)$/i.test(what)) return null;
  return { what: cut(what, 60), why: cut(clean(m[2]!), 120) };
}

/** "why did I pick the canal flat?", "why did we choose that boiler", "why did I go with Octopus": what, or null. */
export function whyAsked(raw: string): string | null {
  const t = clean(String(raw ?? '')).replace(LEAD, '').replace(/[?.!]+$/, '');
  const m = /^(?:why did (?:I|we) (?:pick|choose|go with|decide on|buy|book|take|get|opt for|settle on|switch to|sign up for)|what made me (?:pick|choose|go with|buy|book)|remind me why I (?:picked|chose|went with|bought|booked)) (.{2,60})$/i.exec(t);
  return m ? clean(m[1]!) : null;
}

/** "what did I say I'd do?", "what have I promised?", "my promises", "what do I owe people": the promise list. */
export const promisesAsked = (raw: string): boolean =>
  /^(?:(?:hey )?ghosty[, ]+)?(?:what (?:did|have) I (?:say|said|promise|promised) (?:I'd|I would|to) do|what have I promised(?: to do)?|what did I promise|(?:show |list )?(?:me )?my promises|what do I owe(?: people| anyone)?|what am I supposed to (?:be doing|do)|what have I got to do that I said|what did I say I would do)[?.!]*$/i.test(clean(String(raw ?? '')));

// ================================================================ when a promise is due

const DAY = 86_400_000;
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
function offsetMin(at: number, tz: string): number {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(at).map((x) => [x.type, x.value]));
  return Math.round((Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour! % 24, +p.minute!) - Math.floor(at / 60_000) * 60_000) / 60_000);
}
/** A local wall time on a day `add` days from today, in ms. */
function wall(now: number, tz: string, add: number, hour: number): number {
  const d = new Date(`${localDay(now, tz)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + add);
  d.setUTCHours(hour);
  const g = d.getTime();
  return g - offsetMin(g, tz) * 60_000;
}

/**
 * When to nudge him about a promise: on the day he gave, at 9 (tonight: 6 pm; this weekend: Saturday 10), or, with no day, two days
 * after he said it at 9. Never a moment already gone: a due time passed is an hour from now.
 */
export function remindAtFor(due: string | undefined, now: number, tz: string): number {
  const dow = new Date(`${localDay(now, tz)}T12:00:00Z`).getUTCDay();
  const w = (due ?? '').toLowerCase();
  let at: number;
  if (!w) at = wall(now, tz, 2, 9);
  else if (w === 'today' || w === 'this afternoon') at = wall(now, tz, 0, 14);
  else if (w === 'tonight' || w === 'this evening') at = wall(now, tz, 0, 18);
  else if (w.startsWith('tomorrow')) at = wall(now, tz, 1, /evening|night/.test(w) ? 18 : 9);
  else if (w === 'this weekend') at = wall(now, tz, (6 - dow + 7) % 7 || (dow === 6 ? 0 : 7), 10);
  else if (w === 'next week') at = wall(now, tz, ((1 - dow + 7) % 7) || 7, 9);
  else {
    const name = w.replace(/^next /, '');
    const want = WEEKDAYS.indexOf(name);
    const add = want < 0 ? 2 : ((want - dow + 7) % 7 || 7) + (w.startsWith('next ') && (want - dow + 7) % 7 !== 0 ? 0 : 0);
    at = wall(now, tz, add, 9);
  }
  return at <= now ? now + 3600_000 : at;
}

/** How a promise's day is said: "tomorrow", "Friday", "by the weekend"; '' with none. */
export const dueWords = (due?: string): string => (!due ? '' : /^(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/.test(due) ? due[0]!.toUpperCase() + due.slice(1) : due.replace(/^next (monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/, (_, c: string) => `next ${c[0]!.toUpperCase()}${c.slice(1)}`));

// ================================================================ dates in a question

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const ORD = /\b(?:on )?(?:the )?(\d{1,2})(?:st|nd|rd|th)(?: of (\w+))?\b/i;

/**
 * A date phrase in his words as a span of local days [from, to) in ms, with the words it was said in, and his words without it:
 * "last March", "in March", "in October 2026", "last week", "this week", "last month", "this month", "yesterday", "today",
 * "on Tuesday", "on the 3rd", "on the 3rd of November". Null when there is none.
 */
export function dateSpan(raw: string, now: number, tz: string): { from: number; to: number; said: string; rest: string } | null {
  const t = clean(String(raw ?? ''));
  const today = wall(now, tz, 0, 0);
  const z = localDay(now, tz);
  const y = +z.slice(0, 4);
  const mo = +z.slice(5, 7) - 1;
  const dayStart = (yy: number, mm: number, dd: number) => {
    const g = Date.UTC(yy, mm, dd);
    return g - offsetMin(g, tz) * 60_000;
  };
  const strip = (said: string) => clean(t.replace(new RegExp(String.raw`\s*\b(?:on |in |during |back in |from )?${said.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\b`, 'i'), ' '));
  let m: RegExpExecArray | null;
  if ((m = /\b(last|this) (week|month|year)\b/i.exec(t))) {
    const said = m[0];
    const dow = (new Date(`${z}T12:00:00Z`).getUTCDay() + 6) % 7;
    const monday = today - dow * DAY;
    const k = m[2]!.toLowerCase();
    const last = m[1]!.toLowerCase() === 'last';
    if (k === 'week') return { from: last ? monday - 7 * DAY : monday, to: last ? monday : today + DAY, said, rest: strip(said) };
    if (k === 'month') return { from: last ? dayStart(mo === 0 ? y - 1 : y, (mo + 11) % 12, 1) : dayStart(y, mo, 1), to: last ? dayStart(y, mo, 1) : today + DAY, said, rest: strip(said) };
    return { from: last ? dayStart(y - 1, 0, 1) : dayStart(y, 0, 1), to: last ? dayStart(y, 0, 1) : today + DAY, said, rest: strip(said) };
  }
  if ((m = ORD.exec(t))) {
    const dd = +m[1]!;
    const k = m[2] ? MONTHS.indexOf(m[2].toLowerCase()) : -1;
    if (dd < 1 || dd > 31 || (m[2] && k < 0)) return null;
    let mm = k >= 0 ? k : mo;
    let yy = y;
    if (k < 0 && dd > +z.slice(8, 10)) mm = mo === 0 ? 11 : mo - 1;
    if (mm > mo || (k < 0 && mo === 0 && mm === 11)) yy = y - 1;
    const from = dayStart(yy, mm, dd);
    return { from, to: from + DAY, said: m[0], rest: strip(m[0]) };
  }
  if ((m = new RegExp(String.raw`\b(last |this )?(${MONTHS.join('|')})(?: (\d{4}))?\b`, 'i').exec(t)) && !/\bmay (?:i|we|you)\b/i.test(t.slice(m.index))) {
    const k = MONTHS.indexOf(m[2]!.toLowerCase());
    const yy = m[3] ? +m[3] : k > mo || (m[1]?.toLowerCase().trim() === 'last' && k >= mo) ? y - 1 : y;
    return { from: dayStart(yy, k, 1), to: k === 11 ? dayStart(yy + 1, 0, 1) : dayStart(yy, k + 1, 1), said: m[0], rest: strip(m[0]) };
  }
  if ((m = /\b(yesterday|today)\b/i.exec(t))) {
    const back = m[1]!.toLowerCase() === 'yesterday' ? 1 : 0;
    return { from: today - back * DAY, to: today - back * DAY + DAY, said: m[0], rest: strip(m[0]) };
  }
  if ((m = /\b(?:on |last )?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.exec(t))) {
    const want = WEEKDAYS.indexOf(m[1]!.toLowerCase());
    const dow = new Date(`${z}T12:00:00Z`).getUTCDay();
    const back = (dow - want + 7) % 7 || 7;
    return { from: today - back * DAY, to: today - back * DAY + DAY, said: m[0], rest: strip(m[0]) };
  }
  return null;
}

/** "what was I doing on the 3rd?", "what did I do last Tuesday?", "what happened yesterday": the date words, or null. */
export function dayAsked(raw: string): string | null {
  const t = clean(String(raw ?? '')).replace(LEAD, '').replace(/[?.!]+$/, '');
  const m = /^(?:what (?:was I doing|did I do|did I get up to|happened|did we talk about|did I ask you)|what were we talking about|what did I do in ghosty) ((?:on |last |this )?(?:the \d{1,2}(?:st|nd|rd|th)(?: of \w+)?|\d{1,2}(?:st|nd|rd|th)(?: of \w+)?|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|last week|this week))$/i.exec(t);
  return m ? m[1]! : null;
}

// ================================================================ the week

/** An answer that is not a real one (so the question stays open): "I don't know", "I couldn't find…", "I can't reach…". */
export const unanswered = (a: string | undefined): boolean => !a || /^(?:I (?:don't|do not) know|I(?:'m| am) not sure|I couldn't|I could not|I can't|I cannot|I wasn't able|I was not able|I(?:'m| am) unable|no idea|sorry,? I|that didn't work|something went wrong|I can’t|I don’t|I couldn’t)/i.test(a.trim());

/** His turn words that say what it was about (for "what you asked about most"), most first. */
export function topicsOf(asks: string[], k = 3): { word: string; n: number }[] {
  const count = new Map<string, number>();
  const shown = new Map<string, string>();
  for (const q of asks) {
    const seen = new Set<string>();
    for (const m of q.match(/[A-Za-z][A-Za-z'-]{3,}/g) ?? []) {
      const w = m.toLowerCase().replace(/'s$/, '');
      if (TOPIC_STOP.has(w) || w.includes("'")) continue;
      const s = w.replace(/(?:ing|es|s)$/, '');
      if (s.length < 4 || seen.has(s)) continue;
      seen.add(s);
      count.set(s, (count.get(s) ?? 0) + 1);
      if (!shown.has(s) || w.length < shown.get(s)!.length) shown.set(s, w);
    }
  }
  return [...count].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, k).map(([s, n]) => ({ word: shown.get(s)!, n }));
}
const TOPIC_STOP = new Set(
  'monday tuesday wednesday thursday friday saturday sunday what when where which while would could should there their them they then than that this these those with from have about your yours just like really very much more some will been were want need know think going make made does doing done thing things also only even well good okay yeah sure please thanks thank today tonight tomorrow yesterday morning evening night time week weekend year years days last next ever never always still again here back over under after before because every other another each most many such ghosty hello right maybe actually something anything nothing everything someone tell said says asked help remember forget look find show give take come went getting know lets shall might must cannot dont didnt doesnt isnt wasnt cant wont youre thats whats little quite pretty kind sort stuff open play turn check search remind reminder send call into onto than does best better around near me mine much many said tell what’s don’t can’t i’ll i’m it’s that’s'.split(' '),
);

export interface WeekReview {
  /** Monday 00:00 of the week (ms, his zone). */
  week: number;
  asks: number;
  topics: { word: string; n: number }[];
  finished: string[];
  open: string[];
  unanswered: { at: number; q: string }[];
}

/** The Sunday card's lines in his voice: one line each, only what is there. */
export function weekLines(w: WeekReview): string[] {
  const out: string[] = [];
  out.push(w.asks ? `You asked me ${w.asks === 1 ? 'one thing' : `${w.asks} things`} this week${w.topics.length ? `, most about ${listWords(w.topics.map((t) => t.word))}` : ''}.` : 'A quiet week: you didn’t ask me anything.');
  if (w.finished.length) out.push(`You finished: ${listWords(w.finished.slice(0, 4))}${w.finished.length > 4 ? ` and ${w.finished.length - 4} more` : ''}.`);
  if (w.open.length) out.push(`Still open: ${listWords(w.open.slice(0, 4))}${w.open.length > 4 ? ` and ${w.open.length - 4} more` : ''}.`);
  if (w.unanswered.length) out.push(`${w.unanswered.length === 1 ? 'One question' : `${w.unanswered.length} questions`} never got a real answer: “${cut(w.unanswered[0]!.q, 60)}”${w.unanswered.length > 1 ? ' and more' : ''}.`);
  return out;
}
export const listWords = (xs: string[]): string => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
