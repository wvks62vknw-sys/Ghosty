/**
 * THE PEOPLE PACK, the pure parts (BRIEF-PACKS-2; OWNER-ISSUES 92 ④): the people HE introduces — what he tells Ghosty about
 * them, nothing searched for, no social media, nobody profiled. Birthdays and dates he gives, a gift idea from the notes he
 * made about someone with a rough price, a message or a thank-you in his voice (the shape of his own past messages where he
 * shared them, else plain), a card's words, a group's plans (who said yes), a contact's details he gives, a reminder to call
 * someone. Pure: no storage, no network (tools/people.ts keeps and arms the reminders). Every number says what it assumed;
 * every draft is shown first and never sent.
 */
import { card, RELATIONS, type Card } from './cards';
import { addDays, daysBetween, daysInMonth, dayWords, moneyIn, prettyDay, weekdayOf } from './packs';

const pad = (n: number) => String(n).padStart(2, '0');
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
/** His own writing samples, kept as one list (also read by the work pack's emails). */
export const VOICE_KEY = 'people:voice';

/** "who's who", "my people": the phone opens its people sheet with no model (assistant/phrases.ts, features/people). */
export const PEOPLE_ASK = /^(?:who'?s who|who is who|my people|show (?:me )?my people|open my people|who do you know about)[?.!]?$/i;

// ---------------------------------------------------------------- the book

export interface Note {
  at: number;
  text: string;
}
export interface Person {
  id: string;
  name: string;
  /** How he knows them, in his word: "cousin", "dad", "mate". */
  rel?: string;
  /** "MM-DD", or "YYYY-MM-DD" when he gave the year. */
  born?: string;
  notes: Note[];
  phone?: string;
  address?: string;
  email?: string;
  /** The memory line's id (the Memory tab shows it). */
  mid?: string;
  /** The last time he said something about them. */
  seen: number;
}
/** A date he gave that is not a birthday: "our anniversary", "Mum's retirement do". `on`: "MM-DD" yearly, or a full day once. */
export interface KeptDate {
  id: string;
  what: string;
  on: string;
  yearly: boolean;
}
export interface Plan {
  id: string;
  what: string;
  where?: string;
  /** YYYY-MM-DD */
  when?: string;
  /** HH:MM */
  time?: string;
  yes: string[];
  no: string[];
  maybe: string[];
  /** Everyone he said was asked. */
  asked: string[];
  at: number;
  closed?: boolean;
}
export interface Book {
  people: Person[];
  dates: KeptDate[];
}
export const emptyBook = (): Book => ({ people: [], dates: [] });

// ---------------------------------------------------------------- who he means

const MONTH_WORDS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const NOT_NAMES = new Set(
  ('i i\'m i\'ll i\'ve my the a an and but so what when where who whom how why remind reminder tell add note call ring text gift gifts present presents birthday birthdays thanks thank happy dear hi hey hello please can could would should it is are was his her their our us today tomorrow tonight yesterday ' +
    'monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october november december christmas easter new year valentine mother\'s father\'s ' +
    'remember keep save forget write draft make find give show plan group anniversary born turns turning also then now next this that these those there here yes no maybe sorry congrats').split(' '),
);
const RELS = [...RELATIONS].sort((x, y) => y.length - x.length);
const REL_ALT = RELS.join('|');
const NAME_TOKEN = "[A-Z][\\p{L}'’-]*";

/** Who a sentence is about: "my dad's", "my cousin Sam", "Sam's", "Ali" — a relation or a capitalised name; null when it names nobody. */
export function whoOf(words: string): { name: string; rel?: string } | null {
  const w = words.replace(/[‘’]/g, "'");
  // "Ali is my friend", "Sam, my cousin, loves fishing": the name comes first and the relation after it
  let m = new RegExp(`(?:^|[^\\p{L}])(${NAME_TOKEN}),?\\s+(?:is\\s+)?my\\s+(${REL_ALT})\\b`, 'u').exec(w);
  if (m && !NOT_NAMES.has(m[1]!.replace(/'s$/i, '').toLowerCase())) return { name: m[1]!.replace(/'s$/i, ''), rel: m[2]!.toLowerCase() };
  m = new RegExp(`\\bmy\\s+(${REL_ALT})\\s+(${NAME_TOKEN})`, 'iu').exec(w);
  if (m && /^[A-Z]/.test(m[2]!) && !NOT_NAMES.has(m[2]!.toLowerCase())) return { name: m[2]!.replace(/'s$/i, ''), rel: m[1]!.toLowerCase() };
  m = new RegExp(`\\bmy\\s+(${REL_ALT})\\b`, 'i').exec(w);
  if (m) return { name: cap(m[1]!.toLowerCase()), rel: m[1]!.toLowerCase() };
  for (const t of w.matchAll(new RegExp(`(?:^|[^\\p{L}])(${NAME_TOKEN})`, 'gu'))) {
    const n = t[1]!.replace(/'s$/i, '');
    if (!NOT_NAMES.has(n.toLowerCase()) && n.length > 1) return RELATIONS.includes(n.toLowerCase()) ? { name: n, rel: n.toLowerCase() } : { name: n };
  }
  m = new RegExp(`\\b(${REL_ALT})\\b`, 'i').exec(w);
  return m ? { name: cap(m[1]!.toLowerCase()), rel: m[1]!.toLowerCase() } : null;
}

/** Whom he means: the name he passed, else the one in his words. */
export function personOf(who: string, words: string): { name: string; rel?: string } | null {
  const w = who.trim().replace(/^my\s+/i, '');
  if (!w) return whoOf(words);
  const rel = RELATIONS.includes(w.toLowerCase()) ? w.toLowerCase() : undefined;
  return { name: cap(w.slice(0, 40)), ...(rel ? { rel } : {}) };
}

/** A day and month in his words ("14 March", "March 14th", "14/03", "2000-03-14"), with the year when he gave one. */
export function monthDay(words: string): { m: number; d: number; y?: number } | null {
  const w = ` ${words.toLowerCase()} `;
  const ok = (m: number, d: number, y?: number) => (m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y ?? 2024, m) ? { m, d, ...(y ? { y } : {}) } : null);
  let m = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/.exec(w);
  if (m) return ok(+m[2]!, +m[3]!, +m[1]!);
  const mon = `(${MONTH_WORDS.join('|')})[a-z]*\\.?`;
  m = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+of)?\\s+${mon}(?:,?\\s+(\\d{4}))?\\b`).exec(w);
  if (m) return ok(MONTH_WORDS.indexOf(m[2]!) + 1, +m[1]!, m[3] ? +m[3] : undefined);
  m = new RegExp(`\\b${mon}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`).exec(w);
  if (m) return ok(MONTH_WORDS.indexOf(m[1]!) + 1, +m[2]!, m[3] ? +m[3] : undefined);
  m = /\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{4}|\d{2}))?\b/.exec(w);
  if (m) return ok(+m[2]!, +m[1]!, m[3] ? (m[3].length === 2 ? 1900 + +m[3] : +m[3]) : undefined);
  return null;
}

/** The next time "MM-DD" falls, today counting (29 February is the 28th in the years that have none). */
export function nextOn(on: string, today: string): string {
  const mm = +on.slice(-5, -3);
  const dd = +on.slice(-2);
  const y0 = +today.slice(0, 4);
  for (let y = y0; y <= y0 + 1; y++) {
    const ymd = `${y}-${pad(mm)}-${pad(mm === 2 && dd === 29 && daysInMonth(y, 2) < 29 ? 28 : dd)}`;
    if (ymd >= today) return ymd;
  }
  return `${y0 + 1}-${pad(mm)}-${pad(dd)}`;
}
/** The age he turns on a day, when he gave the year he was born. */
export const turning = (born: string | undefined, on: string): number | null => (born && born.length === 10 ? +on.slice(0, 4) - +born.slice(0, 4) : null);

export interface ParsedBirthday {
  name: string;
  rel?: string;
  on: string;
  year?: number;
}
/** "Dad's birthday is 14 March", "my cousin Sam was born 3/5/1990", "Ali turns 40 on 9 June": whose and which day (and year). */
export function parseBirthday(words: string, who = '', today = '2000-01-01'): ParsedBirthday | null {
  const d = monthDay(words);
  if (!d) return null;
  const p = personOf(who, words);
  if (!p) return null;
  let year = d.y;
  const age = /\b(?:turns?|turning|will be|is turning)\s+(\d{1,3})\b/i.exec(words);
  if (!year && age) year = +nextOn(`${pad(d.m)}-${pad(d.d)}`, today).slice(0, 4) - +age[1]!;
  return { ...p, on: `${pad(d.m)}-${pad(d.d)}`, ...(year ? { year } : {}) };
}
/** The birthday as it is kept: "MM-DD", or the full day when the year is known. */
export const bornKey = (b: ParsedBirthday): string => (b.year ? `${b.year}-${b.on}` : b.on);

/** "Dad: Sat 14 Mar, in 3 days (turning 70)". */
export function birthdayWords(p: Person, today: string): string {
  if (!p.born) return '';
  const next = nextOn(p.born, today);
  const n = daysBetween(today, next);
  const age = turning(p.born, next);
  return `${p.name}: ${prettyDay(next)}, ${n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`}${age !== null && age > 0 && age < 130 ? ` (turning ${age})` : ''}`;
}

/** A date that is not a birthday: "our anniversary is 12 June", "Mum's retirement do is on 5 December 2026". */
export function parseKeptDate(words: string, today: string): { what: string; on: string; yearly: boolean } | null {
  const d = monthDay(words);
  if (!d) return null;
  const yearly = /\b(anniversary|every year|yearly|annual|each year)\b/i.test(words) && !d.y;
  const cut = words.replace(/\b(?:remind me (?:of|about)|remember|keep|save|note|my|the date|date)\b/gi, ' ');
  const what = cut.split(/\b(?:is|on|=|:|falls)\b/i)[0]!.replace(/\s+/g, ' ').trim().replace(/[,.]+$/, '') || 'a date';
  const on = yearly ? `${pad(d.m)}-${pad(d.d)}` : d.y ? `${d.y}-${pad(d.m)}-${pad(d.d)}` : nextOn(`${pad(d.m)}-${pad(d.d)}`, today);
  return { what: cap(what.slice(0, 60)), on, yearly };
}

/** The day to remember it on, from today. */
export const dateNext = (k: KeptDate, today: string): string => (k.yearly ? nextOn(k.on, today) : k.on);

// ---------------------------------------------------------------- when (calls and reminders)

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
/** What a reminder was read as: the day, the time and what had to be assumed. */
export interface When {
  date: string;
  time: string;
  assumed: string[];
}
/**
 * "Sunday", "tomorrow at 6", "tonight", "Friday evening", "in 2 days", "the 14th", "after work": the day and the time, from
 * today and the time now (HH:MM). A weekday means the next one (never today unless he says "today"); a bare hour 1 to 9 is the evening (said); with no time it is
 * 18:00, said. Null when the words name no day or time.
 */
export function whenWords(words: string, today: string, nowHm = '09:00'): When | null {
  const w = ` ${words.toLowerCase()} `;
  const assumed: string[] = [];
  let date = '';
  const wd = /\b(next|this|on)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday|mon|tues?|wed|thur?s?|fri)\b/.exec(w);
  const inDays = /\bin (\d{1,2}|a|an|two|three|four|five|six|seven) (day|week)s?\b/.exec(w);
  if (/\btoday\b|\btonight\b|\bthis (?:morning|afternoon|evening)\b/.test(w)) date = today;
  else if (/\btomorrow\b/.test(w)) date = addDays(today, 1);
  else if (inDays) {
    const n = ({ a: 1, an: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 } as Record<string, number>)[inDays[1]!] ?? +inDays[1]!;
    date = addDays(today, n * (inDays[2] === 'week' ? 7 : 1));
  } else if (wd) {
    const target = WEEKDAYS.findIndex((x) => x.startsWith(wd[2]!.slice(0, 3)));
    let step = (target - weekdayOf(today) + 7) % 7;
    if (step === 0) step = 7;
    date = addDays(today, step);
  } else {
    date = dayWords(words, today);
  }
  let time = '';
  const t = /\b(?:at|@|by|around)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/.exec(w.replace(/\b\d{1,2}(?:st|nd|rd|th)\b/g, ' ').replace(/\b(?:in|for) \d+\s*(?:day|week|min|minute|hour)s?\b/g, ' '));
  const named = /\bnoon\b|\blunch(?:time)?\b/.test(w) ? '12:30' : /\bmorning\b/.test(w) ? '09:00' : /\bafternoon\b/.test(w) ? '14:00' : /\bevening\b|\bafter work\b/.test(w) ? '18:00' : /\btonight\b/.test(w) ? '19:00' : '';
  if (t && (t[3] || t[2] || /\b(?:at|@)\s*\d/.test(w))) {
    let h = +t[1]!;
    const mi = t[2] ? +t[2] : 0;
    if (t[3] === 'pm' && h < 12) h += 12;
    else if (t[3] === 'am' && h === 12) h = 0;
    else if (!t[3] && h >= 1 && h <= 9) {
      assumed.push(`${h}${t[2] ? `:${t[2]}` : ''} as ${h}${t[2] ? `:${t[2]}` : ''}pm`);
      h += 12;
    }
    if (h < 24 && mi < 60) time = `${pad(h)}:${pad(mi)}`;
  }
  if (!time && named) time = named;
  if (!date && !time) return null;
  if (!date) {
    date = time > nowHm ? today : addDays(today, 1);
    assumed.push(`${date === today ? 'today' : 'tomorrow'}, as you gave a time and no day`);
  }
  if (!time) {
    time = '18:00';
    assumed.push('18:00, as you gave no time');
  }
  if (date === today && time <= nowHm) {
    date = addDays(today, 1);
    assumed.push('tomorrow, as that time has gone today');
  }
  return { date, time, assumed };
}

/** "remind me to call Dad Sunday", "ring Sam tomorrow at 6", "text Ali tonight": the verb, whom and the rest (the when). */
export function callAsk(words: string): { verb: string; who: string; rel?: string; rest: string } | null {
  const m = /\b(call|ring|phone|text|message|whatsapp|visit|see|email|catch up with|facetime|speak to|talk to|write to)\s+(?:my\s+)?([\p{L}][\p{L}'’-]*)(.*)$/iu.exec(words);
  if (!m) return null;
  const who = m[2]!.replace(/['’]s$/i, '');
  if (NOT_NAMES.has(who.toLowerCase()) && !RELATIONS.includes(who.toLowerCase())) return null;
  const rel = RELATIONS.includes(who.toLowerCase()) ? who.toLowerCase() : undefined;
  return { verb: m[1]!.toLowerCase().replace('facetime', 'FaceTime'), who: cap(who), ...(rel ? { rel } : {}), rest: m[3]!.trim() };
}

// ---------------------------------------------------------------- notes, interests and gifts

const GIFTS: [RegExp, string, [string, number, number][]][] = [
  [/\bfish(?:ing)?\b|\bangl/, 'fishing', [['a tackle box or a bait box', 15, 35], ['a day ticket or a lesson at a local fishery', 20, 50], ['a good landing net or a head torch for night sessions', 20, 45]]],
  [/\bcoffee\b|espresso|barista/, 'coffee', [['good beans or a coffee subscription', 10, 25], ['a stainless-steel travel cup', 15, 30], ['a hand grinder or an AeroPress', 25, 60]]],
  [/\btea\b/, 'tea', [['a loose-leaf tea sampler', 10, 25], ['a proper teapot with an infuser', 15, 35], ['a tea-tasting afternoon', 25, 50]]],
  [/garden|\bplants?\b|allotment|flowers?/, 'gardening', [['good secateurs or gardening gloves', 10, 25], ['seeds for a patch to grow', 5, 15], ['a kneeler or a trug', 15, 35]]],
  [/\bcook|\bbak(?:e|ing)|kitchen/, 'cooking', [['a good chef’s knife or a cast-iron pan', 25, 70], ['a baking tin set or a cookbook by a chef they like', 12, 30], ['a hamper of spices, or a cooking class', 15, 60]]],
  [/\brun(?:ning|s)?\b|\bjog|marathon|parkrun/, 'running', [['running socks or a light running hat', 8, 20], ['a phone armband or belt', 10, 25], ['an entry to a local race', 15, 40]]],
  [/cycl|\bbike/, 'cycling', [['a good set of lights', 15, 40], ['a multi-tool and puncture kit', 10, 30], ['padded gloves or a cycling cap', 12, 30]]],
  [/football|footy|\bsoccer\b/, 'football', [['a matchday programme or a scarf for their club', 8, 25], ['tickets to a local match', 20, 60], ['a book about their club', 10, 20]]],
  [/\bread|\bbooks?\b|novel/, 'reading', [['a paperback by an author they love', 7, 15], ['a book light or a nice bookmark', 5, 15], ['a bookshop voucher', 10, 30]]],
  [/\bwine\b/, 'wine', [['a bottle from a region they like', 10, 25], ['a wine-tasting session', 20, 50], ['a decent corkscrew and stopper set', 8, 20]]],
  [/whisk|\bgin\b|\bbeer|craft ale|\bales?\b|spirits/, 'drinks', [['a small-batch bottle of what they drink', 15, 40], ['a tasting set of miniatures', 15, 30], ['a set of good glasses', 12, 30]]],
  [/\bmusic|vinyl|\brecords?\b|guitar|piano|drums?\b|\bsing/, 'music', [['a record or concert tickets', 12, 60], ['spare strings or a capo, if they play guitar', 5, 15], ['a pair of decent headphones', 25, 80]]],
  [/\bgam(?:e|es|ing|er)\b|xbox|playstation|nintendo/, 'gaming', [['a game from their wishlist (a friend can tell you what they lack)', 20, 60], ['a controller grip or a headset stand', 10, 25], ['a gift card for their console', 10, 50]]],
  [/\bwalk(?:ing|s)?\b|\bhik|camp|outdoor|mountain/, 'the outdoors', [['a flask or a dry bag', 10, 30], ['a head torch', 10, 30], ['an Ordnance Survey map of their favourite area', 8, 15]]],
  [/photo|camera/, 'photography', [['a camera strap or a cleaning kit', 8, 25], ['a photo book printed from their own pictures', 15, 40], ['a small tripod', 15, 40]]],
  [/\bcats?\b|kitten/, 'cats', [['a toy or a treat box for the cat', 5, 15], ['a cosy cat bed', 12, 30], ['a cat-themed mug or calendar', 6, 15]]],
  [/\bdogs?\b|puppy|walkies/, 'dogs', [['a durable chew toy', 5, 12], ['a long lead or a treat pouch', 8, 20], ['a collar light for evening walks', 6, 15]]],
  [/travel|holiday|abroad/, 'travel', [['a packing-cube set', 10, 25], ['a scratch-off world map', 12, 25], ['a guide to where they want to go', 8, 18]]],
  [/\bart\b|paint|\bdraw|sketch/, 'art', [['a decent sketchbook and pencils', 8, 25], ['a set of watercolours', 10, 30], ['a class at a local art studio', 20, 50]]],
  [/knit|crochet|\bsew|crafts?\b/, 'crafts', [['yarn or fabric in colours they like', 8, 25], ['a pattern book', 8, 18], ['a craft kit', 12, 30]]],
  [/board ?game|puzzle|jigsaw|chess/, 'games and puzzles', [['a 1,000-piece jigsaw of a place they love', 10, 20], ['a new board game', 15, 40], ['a travel chess or cards set', 8, 20]]],
  [/\bfilms?\b|movies?|cinema/, 'films', [['cinema tickets for two', 14, 30], ['a favourite film on Blu-ray', 8, 18], ['a popcorn and treats set', 8, 20]]],
  [/yoga|pilates|\bgym\b|fitness|weights/, 'fitness', [['a mat or a resistance-band set', 10, 30], ['a good drinks bottle', 10, 25], ['a class pass', 15, 40]]],
  [/\btech\b|gadget|laptop|computers?\b/, 'gadgets', [['a power bank or a good phone case', 12, 35], ['a smart plug set', 10, 25], ['a wireless charger', 12, 30]]],
  [/chocolate|sweets?\b|\bcake|dessert|biscuit/, 'sweet things', [['good chocolates from a small maker', 8, 20], ['fancy biscuits, or a cake from a local baker', 8, 25], ['a dessert-making kit', 12, 25]]],
  [/\bgolf/, 'golf', [['a sleeve of balls and tees', 8, 20], ['a golf glove and towel', 8, 18], ['a range or a round voucher', 15, 40]]],
  [/\bdiy\b|\btools?\b|\bshed\b|woodwork/, 'DIY', [['a good multi-tool', 15, 40], ['a head torch', 8, 18], ['a spirit level or a tape measure', 8, 20]]],
  [/\bcars?\b|motors?\b/, 'cars', [['a microfibre and wash kit', 10, 30], ['a phone mount or a tyre-pressure gauge', 8, 25], ['a trip to a car show or museum', 15, 40]]],
  [/candle|\bspa\b|\bbath|relax/, 'pampering', [['a candle and bath set', 10, 30], ['a face-mask set', 8, 20], ['a massage voucher', 25, 60]]],
];
const GENERIC: [string, number, number][] = [
  ['a plant they can keep alive', 8, 20],
  ['good chocolates or fancy biscuits', 6, 15],
  ['a voucher for a meal or a coffee out together', 15, 40],
  ['a framed photo of the two of you', 10, 25],
  ['an experience: a day out, tickets, a class', 20, 60],
];
const AVOID = /\b(hates?|dislikes?|doesn'?t like|does not like|allergic to|can'?t (?:eat|drink|have)|vegan|vegetarian|teetotal|sober|doesn'?t drink|gluten|lactose|diabet\w*|intolerant)\b/i;

/** What his notes about someone say they like (newest first), and what to be careful of. */
export function interestsOf(notes: string[]): { likes: string[]; careful: string[] } {
  const careful = notes.filter((n) => AVOID.test(n)).slice(0, 3);
  const dry = notes.some((n) => /\b(teetotal|sober|doesn'?t drink|no alcohol)\b/i.test(n));
  const likes: string[] = [];
  for (const n of notes) for (const [re, label] of GIFTS) if (re.test(n.toLowerCase()) && !likes.includes(label) && !(dry && (label === 'wine' || label === 'drinks'))) likes.push(label);
  return { likes, careful };
}

export interface Budget {
  lo?: number;
  hi?: number;
}
/** "under £30", "£20 to £40", "around 25", "at least £50": a budget in his words (null for none). */
export function budgetOf(words: string): Budget | null {
  const range = /(?:£\s?)?(\d+(?:\.\d+)?)\s*(?:to|-|–|and)\s*£?\s?(\d+(?:\.\d+)?)/i.exec(words);
  if (range && /£|quid|pounds|budget|between|under|around|about/i.test(words)) return { lo: Math.min(+range[1]!, +range[2]!), hi: Math.max(+range[1]!, +range[2]!) };
  const n = moneyIn(words.replace(/\b(19|20)\d\d\b/g, ' '));
  if (n === null) return null;
  if (/\b(under|less than|up to|max(?:imum)?|no more than|at most|below|within)\b/i.test(words)) return { hi: n };
  if (/\b(over|more than|at least|above|from)\b/i.test(words)) return { lo: n };
  return { lo: Math.round(n * 0.7), hi: Math.round(n * 1.3) };
}

export interface Gift {
  idea: string;
  lo: number;
  hi: number;
  because: string;
}
/** Up to five ideas that fit the notes and the budget, rough UK prices (not looked up). The same notes and budget give the same ideas. */
export function giftIdeas(likes: string[], budget: Budget | null, seed = 0): Gift[] {
  const all: Gift[] = [];
  for (const label of likes) {
    const row = GIFTS.find((g) => g[1] === label);
    if (row) for (const [idea, lo, hi] of row[2]) all.push({ idea, lo, hi, because: `they like ${label}` });
  }
  if (all.length < 3) for (const [idea, lo, hi] of GENERIC) all.push({ idea, lo, hi, because: 'a safe choice' });
  const fits = (g: Gift) => (budget?.hi === undefined || g.lo <= budget.hi) && (budget?.lo === undefined || g.hi >= budget.lo);
  const mid = budget ? ((budget.lo ?? 0) + (budget.hi ?? (budget.lo ?? 0) * 2)) / 2 : 0;
  const pool = all.filter(fits);
  const picked = (pool.length ? pool : all).map((g, i) => ({ g, i, d: budget ? Math.abs((g.lo + g.hi) / 2 - mid) : 0 }));
  // like first (their order in the notes), then the nearest to the budget; a seed rotates the ties so "another" differs
  picked.sort((a, b) => (likes.indexOf(a.g.because.replace('they like ', '')) - likes.indexOf(b.g.because.replace('they like ', ''))) || a.d - b.d || ((a.i + seed) % 7) - ((b.i + seed) % 7));
  return picked.slice(0, 5).map((x) => x.g);
}

/** "Sam’s gift ideas" as words: the notes it came from, the ideas with rough prices, what to be careful of. */
export function giftWords(name: string, likes: string[], careful: string[], gifts: Gift[], budget: Budget | null, noNotes: boolean): string {
  const b = budget ? ` for ${budget.lo !== undefined && budget.hi !== undefined ? `£${budget.lo} to £${budget.hi}` : budget.hi !== undefined ? `under £${budget.hi}` : `£${budget.lo} or more`}` : '';
  const from = likes.length ? `From what you told me about ${name} (${likes.join(', ')})` : noNotes ? `You haven’t told me what ${name} likes yet, so these are safe choices (tell me, like "${name} loves fishing", and I’ll do better)` : `Your notes on ${name} don’t say what they like, so these are safe choices`;
  const lines = gifts.map((g) => `- ${g.idea}: about £${g.lo} to £${g.hi}`).join('\n');
  return `${from}, gift ideas${b}:\n${lines}${careful.length ? `\nCareful: you noted “${careful.join('”, “')}”.` : ''}\nPrices are rough guides for a typical UK shop, not looked up: check the shops. I haven’t searched for anything about ${name}.`;
}

// ---------------------------------------------------------------- his voice (the shape of his own messages)

export interface Tone {
  n: number;
  /** Words a message, on average. */
  words: number;
  exclaim: number;
  emoji: boolean;
  lower: boolean;
  fullStops: boolean;
  greet: string;
  signoff: string;
  kisses: boolean;
  contractions: boolean;
  formal: boolean;
}
const GREETS = ['hey', 'hi', 'hello', 'hiya', 'heya', 'alright', 'yo', 'morning', 'dear', 'oi', 'hiya'];
const SIGNOFFS = ['cheers', 'thanks', 'ta', 'love', 'best', 'regards', 'kind regards', 'speak soon', 'see you soon', 'laters', 'take care', 'ta ra', 'yours'];
/** The shape of the messages he shared: how long, how he opens and signs off, his punctuation. null with none. */
export function toneOf(samples: string[]): Tone | null {
  const s = samples.map((x) => x.trim()).filter(Boolean);
  if (!s.length) return null;
  const count = (re: RegExp) => s.filter((x) => re.test(x)).length;
  const most = (list: string[]) => {
    const tally = new Map<string, number>();
    for (const x of list) if (x) tally.set(x, (tally.get(x) ?? 0) + 1);
    return [...tally].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  };
  const ends = [...SIGNOFFS].sort((a, b) => b.length - a.length);
  const words = s.reduce((k, x) => k + x.split(/\s+/).length, 0) / s.length;
  return {
    n: s.length,
    words: Math.round(words),
    exclaim: Math.round((s.reduce((k, x) => k + (x.match(/!/g)?.length ?? 0), 0) / s.length) * 10) / 10,
    emoji: count(/\p{Extended_Pictographic}/u) >= s.length / 3,
    lower: s.filter((x) => /^[a-z]/.test(x)).length > s.length / 2,
    fullStops: count(/\.(\s|$)/) > s.length / 2,
    greet: most(s.map((x) => x.toLowerCase().split(/[\s,!.]+/)[0]!).filter((x) => GREETS.includes(x))),
    signoff: most(s.map((x) => ends.find((c) => new RegExp(`(?:^|[\\s,.!])${c}[\\s.!x]*$`).test(x.toLowerCase())) ?? '')),
    kisses: count(/\bxx?\s*$/i) > s.length / 3,
    contractions: count(/\b\w+['’](?:t|s|m|ll|re|ve|d)\b/i) > 0,
    formal: count(/\b(dear|sincerely|regards|yours)\b/i) > s.length / 2 || (count(/['’]/) === 0 && words > 25),
  };
}
/** The tone in words, for him to check and for a model to follow. */
export function toneWords(t: Tone | null): string {
  if (!t) return 'plain and friendly (you haven’t shared any of your messages yet: say "this is how I write: …" and I’ll match them)';
  const bits = [
    t.words <= 12 ? `short (about ${t.words} words)` : t.words <= 35 ? `a couple of sentences (about ${t.words} words)` : `fuller (about ${t.words} words)`,
    t.formal ? 'formal' : t.contractions ? 'relaxed, with contractions' : 'neat',
    t.lower ? 'starting in lower case' : '',
    t.fullStops ? '' : 'few full stops',
    t.exclaim >= 1 ? 'exclamation marks' : t.exclaim === 0 ? 'no exclamation marks' : 'few exclamation marks',
    t.emoji ? 'emoji' : 'no emoji',
    t.greet ? `opens “${t.greet}”` : '',
    t.signoff ? `signs off “${t.signoff}”` : '',
    t.kisses ? 'kisses on the end' : '',
  ].filter(Boolean);
  return `${bits.join(', ')} (from ${t.n} of your messages)`;
}
/** A draft dressed in his shape: his greeting and sign-off, his case and punctuation, an emoji if he uses them. Never invents words he did not write. */
export function inTone(text: string, t: Tone | null, emoji = ''): string {
  if (!t) return text;
  let out = text;
  if (t.exclaim === 0) out = out.replace(/!/g, '.');
  if (t.greet && /^(Hi|Hello|Hey|Dear)\b/.test(out)) out = out.replace(/^(Hi|Hello|Hey|Dear)\b/, cap(t.greet));
  if (t.lower) out = out.replace(/(^|\n)([A-Z])(?=[a-z])/g, (_m, a: string, b: string) => a + b.toLowerCase());
  if (!t.fullStops) out = out.replace(/\.(\s*)$/g, '$1').replace(/\.\n/g, '\n');
  if (['cheers', 'ta', 'love', 'speak soon', 'take care', 'laters'].includes(t.signoff) && !/\n/.test(out.trim()) && !t.formal && !new RegExp(`\\b${t.signoff}\\W*$`, 'i').test(out)) out = `${out.replace(/[.!]+$/, '')}, ${t.signoff}`;
  if (t.emoji && emoji) out = `${out.trimEnd()} ${emoji}`;
  if (t.kisses && !/\bxx?\s*$/i.test(out)) out = `${out.trimEnd()} x`;
  return out;
}

// ---------------------------------------------------------------- messages, thank-yous and a card's words

export const OCCASIONS = ['birthday', 'thanks', 'sorry', 'congrats', 'get well', 'good luck', 'new job', 'new home', 'anniversary', 'wedding', 'new baby', 'thinking of you', 'miss you', 'sympathy'] as const;
export type Occasion = (typeof OCCASIONS)[number];
/** Which occasion his words are about. */
export function occasionOf(words: string): Occasion | null {
  const w = words.toLowerCase();
  const table: [RegExp, Occasion][] = [
    [/\bbirthday\b|\bbday\b/, 'birthday'], [/\bthank/, 'thanks'], [/\bsorry|apolog/, 'sorry'], [/congrat|well done|passed|graduat|promotion|promoted/, 'congrats'],
    [/get well|feel better|poorly|unwell|in hospital|recover/, 'get well'], [/good luck|best of luck|break a leg|exam|interview/, 'good luck'], [/new job|first day|started (?:a )?job/, 'new job'],
    [/new (?:home|house|flat)|housewarming|moved/, 'new home'], [/anniversary/, 'anniversary'], [/\bwedding|engaged|engagement/, 'wedding'], [/\bbaby\b|newborn|expecting|pregnan/, 'new baby'],
    [/thinking of you|checking in/, 'thinking of you'], [/miss you|missing you/, 'miss you'], [/condolence|sympathy|passed away|died|funeral|loss of/, 'sympathy'],
  ];
  return table.find(([re]) => re.test(w))?.[1] ?? null;
}
const EMOJI: Partial<Record<Occasion, string>> = { birthday: '🎂', thanks: '🙏', congrats: '🎉', 'get well': '💐', 'good luck': '🍀', 'new job': '🎉', 'new home': '🏡', wedding: '💍', 'new baby': '👶', anniversary: '🥂', 'thinking of you': '💛', 'miss you': '💛' };

/** The messages for each occasion: three each; {n} his name for them, {a} the age. */
const MESSAGES: Record<Occasion, string[]> = {
  birthday: [
    'Happy birthday, {n}! Hope today is a really good one{a}. Thinking of you.',
    'Happy birthday {n}! Have a brilliant day{a}, you deserve it.',
    'Many happy returns, {n}{a}. Hope you get spoiled today.',
  ],
  thanks: [
    'Thank you so much, {n}. It really meant a lot to me.',
    'Thanks {n}, I really appreciate it. I owe you one.',
    '{n}, thank you. You made my week.',
  ],
  sorry: [
    'I’m sorry, {n}. I got it wrong and I’d like to put it right. Can we talk when you’re ready?',
    '{n}, I’m really sorry about what happened. No excuses. I’d like to make it up to you.',
    'Sorry, {n}. I’ve been thinking about it and I was in the wrong. I hope we’re okay.',
  ],
  congrats: [
    'Congratulations, {n}! You earned it. So pleased for you.',
    'Well done, {n}! That’s brilliant news. Proud of you.',
    '{n}, congratulations! Let’s celebrate soon.',
  ],
  'get well': [
    'Hope you’re feeling better soon, {n}. Rest up and shout if you need anything.',
    '{n}, sorry you’re poorly. Get well soon. I’m here if you need anything.',
    'Thinking of you, {n}. Take it easy and get better soon.',
  ],
  'good luck': [
    'Good luck, {n}! You’ve got this. Let me know how it goes.',
    'Best of luck today, {n}. You’ve worked hard for it.',
    '{n}, good luck! Be yourself and you’ll be great.',
  ],
  'new job': [
    'Congratulations on the new job, {n}! Wishing you a brilliant first day and a great start.',
    '{n}, new job! Well done. I hope it’s everything you wanted.',
    'So pleased for you, {n}. Enjoy the new job and shout if you want to celebrate.',
  ],
  'new home': [
    'Congratulations on the new home, {n}! Hope you’re settling in. Can’t wait to see it.',
    '{n}, enjoy the new place! I’ll bring something for the housewarming.',
    'Happy new home, {n}. Wishing you lots of happy memories there.',
  ],
  anniversary: [
    'Happy anniversary, {n}! Wishing you both many more happy years.',
    '{n}, happy anniversary. Hope you have a lovely day together.',
    'Congratulations on your anniversary, {n}. Here’s to you both.',
  ],
  wedding: [
    'Congratulations, {n}! Wishing you both a lifetime of happiness together.',
    '{n}, so happy for you both. Congratulations on the big news.',
    'Huge congratulations, {n}. Wishing you all the best for the future together.',
  ],
  'new baby': [
    'Congratulations, {n}! Welcome to the world, little one. So happy for you all.',
    '{n}, huge congratulations on the new arrival. Wishing you lots of love and some sleep.',
    'Lovely news, {n}. Congratulations to you all.',
  ],
  'thinking of you': [
    'Just thinking of you, {n}. No need to reply. Hope you’re doing okay.',
    'Hi {n}, I was thinking about you and wanted to say hello. How are you?',
    '{n}, thinking of you today. Here if you want a chat.',
  ],
  'miss you': [
    'I miss you, {n}. We should catch up soon. When are you free?',
    '{n}, I’ve been missing you. Let’s sort a date to meet up.',
    'Hi {n}, it’s been too long. I miss you. Are you around soon?',
  ],
  sympathy: [
    'I’m so sorry for your loss, {n}. Thinking of you and your family. I’m here whenever you want to talk, or just want company.',
    '{n}, I’m so sorry. Thinking of you at this time. Please let me know if there is anything I can do.',
    'With love and sympathy, {n}. I’m here for you, in whatever way you need.',
  ],
};
export interface Draft {
  text: string;
  occasion: Occasion;
  variant: number;
}
/** The message for an occasion: three wordings that rotate (variant), a detail he gave added, his tone applied. Shown first, never sent. */
export function messageDraft(o: { occasion: Occasion; name: string; age?: number | null; detail?: string; variant?: number }, tone: Tone | null): Draft {
  const list = MESSAGES[o.occasion];
  const variant = ((o.variant ?? 0) % list.length + list.length) % list.length;
  const age = o.age && o.age > 0 && o.age < 130 && o.occasion === 'birthday' ? `, and a very happy ${o.age}` : '';
  let text = list[variant]!.replace(/\{n\}/g, o.name).replace(/\{a\}/g, age);
  if (o.detail?.trim()) text = `${text} ${cap(o.detail.trim().replace(/[.!]+$/, ''))}.`;
  return { text: inTone(text, tone, EMOJI[o.occasion] ?? ''), occasion: o.occasion, variant };
}

/** A thank-you note: what for decides its shape (a gift, help, hospitality, a reference, an interview). */
export function thanksNote(o: { name: string; forWhat: string; detail?: string; from?: string }, tone: Tone | null): string {
  const f = o.forWhat.replace(/^for\s+/i, '').replace(/[.!]+$/, '').trim() || 'everything';
  const kind = /\binterview\b/i.test(f) ? 'interview' : /\b(dinner|lunch|tea|stay|hosting|evening|party|meal|weekend|visit)\b/i.test(f) ? 'host' : /\b(help|helping|lift|advice|reference|support|time|favour|favor|hand)\b/i.test(f) ? 'help' : 'gift';
  const detail = o.detail?.trim() ? ` ${cap(o.detail.trim().replace(/[.!]+$/, ''))}.` : '';
  const body =
    kind === 'interview'
      ? `Dear ${o.name},\n\nThank you for taking the time to meet me about ${f.replace(/^(the|my)\s+/i, '')}. I enjoyed learning more about the role and the team.${detail} I would be glad to talk further if there is anything else you need from me.\n\n${o.from ? `Kind regards,\n${o.from}` : 'Kind regards'}`
      : kind === 'host'
        ? `Dear ${o.name},\n\nThank you so much for ${f}. I had a lovely time and it was very kind of you to have me.${detail} I hope we can do the same for you soon.\n\n${o.from ? `With thanks,\n${o.from}` : 'With thanks'}`
        : kind === 'help'
          ? `Dear ${o.name},\n\nThank you so much for ${f}. It made a real difference and I really appreciate it.${detail} If I can ever return the favour, please ask.\n\n${o.from ? `With thanks,\n${o.from}` : 'With thanks'}`
          : `Dear ${o.name},\n\nThank you so much for ${f}. It was such a kind thought and I really love it.${detail} It was lovely to be thought of.\n\n${o.from ? `With love,\n${o.from}` : 'With love'}`;
  return inTone(body, tone && !tone.formal ? { ...tone, greet: tone.greet === 'dear' ? '' : tone.greet } : tone, '🙏');
}

export type CardStyle = 'warm' | 'funny' | 'short' | 'formal';
/** The words inside a card, for the occasion in one of four styles (a joke or two of ours, never anyone's copyrighted verse). */
export function cardWords(o: { occasion: Occasion; name: string; from?: string; style: CardStyle; age?: number | null }): string {
  const n = o.name;
  const age = o.age && o.age > 0 && o.age < 130 ? o.age : null;
  const sign = o.from ? `\n\nFrom ${o.from}` : '';
  const funny: Partial<Record<Occasion, string>> = {
    birthday: age ? `Happy birthday, ${n}!\n\n${age} candles is a fire hazard. We’ll bring the extinguisher and the cake.` : `Happy birthday, ${n}!\n\nAnother year older, but still the youngest person in this card’s opinion.`,
    anniversary: `Happy anniversary, ${n}!\n\nAnother year of putting up with each other. Impressive.`,
    'get well': `Get well soon, ${n}!\n\nThe office is falling apart without you. (Please come back and fix it.)`,
    congrats: `Congratulations, ${n}!\n\nYou did the thing. Now go and eat cake.`,
    'new job': `Congratulations on the new job, ${n}!\n\nMay the coffee be strong and the meetings short.`,
    'new home': `Happy new home, ${n}!\n\nMay the boxes be unpacked by Christmas. (Which Christmas is up to you.)`,
    'good luck': `Good luck, ${n}!\n\nYou’ve got this. And if not, there’s always cake.`,
  };
  const short: Record<Occasion, string> = {
    birthday: `Happy birthday, ${n}! Have a great day${age ? `, and a great ${age}` : ''}.`, thanks: `Thank you, ${n}.`, sorry: `I’m sorry, ${n}.`, congrats: `Congratulations, ${n}!`, 'get well': `Get well soon, ${n}.`,
    'good luck': `Good luck, ${n}!`, 'new job': `Congratulations on the new job, ${n}!`, 'new home': `Happy new home, ${n}!`, anniversary: `Happy anniversary, ${n}!`, wedding: `Congratulations, ${n}!`, 'new baby': `Congratulations, ${n}!`,
    'thinking of you': `Thinking of you, ${n}.`, 'miss you': `Missing you, ${n}.`, sympathy: `With deepest sympathy, ${n}.`,
  };
  if (o.style === 'short') return `${short[o.occasion]}${sign}`;
  if (o.style === 'funny' && funny[o.occasion]) return `${funny[o.occasion]}${sign}`;
  const draft = messageDraft({ occasion: o.occasion, name: n, age: age ?? undefined, variant: o.style === 'formal' ? 2 : 0 }, null).text;
  return o.style === 'formal' ? `Dear ${n},\n\n${draft}\n\nWith best wishes${o.from ? `,\n${o.from}` : ''}` : `${draft}${sign}`;
}

// ---------------------------------------------------------------- a group's plans (who said yes)

const IN_WORDS = /\b(yes|yeah|yep|in|is in|coming|can make it|can come|going|confirmed|keen|up for it|definitely|will be there|is on)\b/i;
const OUT_WORDS = /\b(no|nope|out|is out|can['’]?t(?: make it| come)?|cannot|not coming|not going|busy|won['’]?t make it|unable|declined|away)\b/i;
const MAYBE_WORDS = /\b(maybe|might|not sure|unsure|tentative|possibly|50\/50|perhaps|will see|will let me know)\b/i;
export interface Reply {
  name: string;
  say: 'yes' | 'no' | 'maybe';
}
/** "Ali yes, Sam can't, Jo maybe", "Jo's in", "Sam is out": who answered what. Names are capitalised words as he gave them. */
export function repliesIn(words: string): Reply[] {
  const out: Reply[] = [];
  const parts = words.replace(/\b(?:and|but|plus)\b/gi, ',').split(/[,;.\n]+/);
  for (const part of parts) {
    const m = new RegExp(`(${NAME_TOKEN})`, 'u').exec(part.trim());
    if (!m) continue;
    const name = m[1]!.replace(/['’]s$/i, '');
    if (NOT_NAMES.has(name.toLowerCase())) continue;
    const rest = part.trim().slice(m.index + m[0].length);
    if (!rest.trim()) continue;
    const say = MAYBE_WORDS.test(rest) ? 'maybe' : OUT_WORDS.test(rest) ? 'no' : IN_WORDS.test(rest) ? 'yes' : null;
    if (say && !out.some((r) => r.name === name)) out.push({ name, say });
  }
  return out;
}
/** The plan out of "pub on Friday at 8pm at the Crown; asked Ali, Sam, Jo": what, when, where and who was asked. */
export function parsePlan(words: string, today: string, nowHm = '09:00'): { what: string; where?: string; when?: string; time?: string; asked: string[]; replies: Reply[] } {
  const body = words.replace(/^(?:plan|plans|we(?:'re| are) (?:going|doing)|new plan|group plan)\s*[:\-–]?\s*/i, '');
  const first = body.split(/[.;\n]/)[0]!.replace(/[,\s]*\b(?:asked|invited|inviting|asking)\b.*$/i, '');
  const asked = /\b(?:asked|invited|inviting|asking)\s+([^.;\n]+)/i.exec(body)?.[1]?.split(/,|\band\b/).map((x) => x.trim().replace(/[^\p{L}'’ -]/gu, '')).filter((x) => /^[A-Z]/.test(x) && !NOT_NAMES.has(x.toLowerCase())) ?? [];
  const w = whenWords(first, today, nowHm);
  const where = /\b(?:at|in)\s+((?:the\s+)?[A-Z][\p{L}'’& -]+?)(?=\s*(?:on|at|,|;|\.|$|with|asked|for))/u.exec(first.replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?/gi, ' '))?.[1]?.trim();
  const what = first.replace(/\b(?:on|at|this|next)\s+(?:mon|tues|wednes|thurs|fri|satur|sun)[a-z]*\b/gi, ' ').replace(/\b(?:tomorrow|tonight|today)\b/gi, ' ').replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?/gi, ' ').replace(/\b(?:at|in)\s+(?:the\s+)?[A-Z][\p{L}'’& -]+$/u, ' ').replace(/\s+/g, ' ').replace(/[,\s]+$/, '').trim();
  return { what: cap(what.slice(0, 60)) || 'Plan', ...(where ? { where } : {}), ...(w ? { when: w.date, time: w.time } : {}), asked, replies: repliesIn(body.split(/[.;\n]/).slice(1).join(',') || '') };
}
/** Record answers on a plan (a later answer replaces an earlier one). */
export function applyReplies(p: Plan, rs: Reply[]): Plan {
  const out: Plan = { ...p, yes: [...p.yes], no: [...p.no], maybe: [...p.maybe], asked: [...p.asked] };
  for (const r of rs) {
    for (const k of ['yes', 'no', 'maybe'] as const) out[k] = out[k].filter((x) => x.toLowerCase() !== r.name.toLowerCase());
    out[r.say].push(r.name);
    if (!out.asked.some((x) => x.toLowerCase() === r.name.toLowerCase())) out.asked.push(r.name);
  }
  return out;
}
/** Still waiting to hear from. */
export const waitingOn = (p: Plan): string[] => p.asked.filter((n) => ![...p.yes, ...p.no, ...p.maybe].some((x) => x.toLowerCase() === n.toLowerCase()));
/** "Pub, Fri 6 Nov 8pm at the Crown. Yes: Ali, Jo (2). No: Sam. Maybe: Dee. Not heard from: Kai." */
export function planWords(p: Plan, thisYear?: string): string {
  const when = p.when ? `${prettyDay(p.when, thisYear)}${p.time ? ` ${p.time}` : ''}` : '';
  const head = [p.what, when, p.where ? `at ${p.where}` : ''].filter(Boolean).join(', ');
  const bits = [p.yes.length ? `Yes: ${p.yes.join(', ')} (${p.yes.length})` : '', p.no.length ? `No: ${p.no.join(', ')}` : '', p.maybe.length ? `Maybe: ${p.maybe.join(', ')}` : '', waitingOn(p).length ? `Not heard from: ${waitingOn(p).join(', ')}` : ''].filter(Boolean);
  return `${head}. ${bits.length ? `${bits.join('. ')}.` : 'Nobody has answered yet.'}`;
}

// ---------------------------------------------------------------- a contact's details

/** What he gave: "Sam's number is 07700 900123", "Dad's address: 12 High St, Leeds LS1 4AB", "Ali's email is a@b.co". */
export function parseContact(words: string): { phone?: string; email?: string; address?: string } {
  const out: { phone?: string; email?: string; address?: string } = {};
  const email = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/.exec(words);
  if (email) out.email = email[0].toLowerCase();
  const phone = /(?:number|phone|mobile|cell|tel(?:ephone)?|landline)\s*(?:is|:|=|-)?\s*(\+?[\d][\d\s()-]{5,17}\d)/i.exec(words);
  if (phone) out.phone = tidyPhone(phone[1]!);
  const address = /\baddress\s*(?:is|:|=|-)?\s*(.{6,120}?)\s*$/i.exec(words);
  if (address) out.address = address[1]!.replace(/[.]+$/, '');
  return out;
}
/** "07700900123" → "07700 900123"; a +44 number grouped after the country code; anything else as typed, spaced. */
export function tidyPhone(s: string): string {
  const d = s.replace(/[^\d+]/g, '');
  if (/^07\d{9}$/.test(d)) return `${d.slice(0, 5)} ${d.slice(5)}`;
  if (/^0\d{10}$/.test(d)) return `${d.slice(0, 5)} ${d.slice(5)}`;
  if (/^\+44\d{10}$/.test(d)) return `+44 ${d.slice(3, 7)} ${d.slice(7)}`;
  return s.replace(/\s+/g, ' ').trim();
}
/** Which detail he is asking for: "what's Sam's number?" → phone. */
export function contactAsked(words: string): 'phone' | 'email' | 'address' | null {
  if (!/\?|\b(what|what's|whats|where|give me|tell me|show me|have you got|do you have|need)\b/i.test(words)) return null;
  return /\b(number|phone|mobile|ring|tel)\b/i.test(words) ? 'phone' : /\bemail\b/i.test(words) ? 'email' : /\baddress|live|postcode\b/i.test(words) ? 'address' : null;
}

// ---------------------------------------------------------------- the cards

const reminderCard = (id: string, title: string, line: string, at: number, acts: Card['acts'] = []): Card => card({ id, kind: 'brief', at, title, line, brief: { icon: 'reminder' }, acts });

/** A birthday kept: when it falls, what is armed, an UNDO and the gift ideas a tap away. */
export function birthdayCard(p: Person, today: string, armed: number, at = Date.now()): Card {
  const next = p.born ? nextOn(p.born, today) : today;
  const n = daysBetween(today, next);
  const age = turning(p.born, next);
  return reminderCard(`people:bday:${p.id}`, `${p.name}’s birthday`, `${prettyDay(next)} · ${n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`}${age && age > 0 && age < 130 ? ` · turning ${age}` : ''}${armed ? ` · reminders ${armed === 2 ? 'a week before and on the day' : 'set'}` : ''}`, at, [
    { label: 'GIFT IDEAS', ask: `Gift ideas for ${p.name}` },
    { label: 'UNDO', run: { name: 'packs_do', args: { pack: 'people', action: 'forget', args: { words: `${p.name}’s birthday`, who: p.name, what: 'birthday' } } } },
  ]);
}
/** One person: how he knows them, their next date, the last thing he said. */
export function personCardOf(p: Person, today: string, at = Date.now()): Card {
  const bits = [p.rel ? cap(p.rel) : 'You told me about them', p.born ? birthdayWords(p, today).replace(/^[^:]+: /, 'birthday ') : '', p.notes[p.notes.length - 1]?.text ?? ''].filter(Boolean);
  return card({ id: `people:who:${p.id}`, kind: 'person', at, title: p.name, line: bits.join(' · '), person: { name: p.name }, acts: [{ label: 'GIFT IDEAS', ask: `Gift ideas for ${p.name}` }, { label: 'ALL MY PEOPLE', run: { name: 'open_people', args: { what: 'who' } } }] });
}
export function planCard(p: Plan, at = Date.now()): Card {
  return reminderCard(`people:plan:${p.id}`, p.what, `${p.when ? `${prettyDay(p.when)} · ` : ''}${p.yes.length} yes · ${p.maybe.length} maybe · ${p.no.length} no${waitingOn(p).length ? ` · ${waitingOn(p).length} to hear from` : ''}`, at, [{ label: 'OPEN PLAN', run: { name: 'open_people', args: { what: 'plan' } } }]);
}
export function callCard(title: string, line: string, id: string, at = Date.now()): Card {
  return reminderCard(`people:call:${id}`, title, line, at, [{ label: 'ALL MY PEOPLE', run: { name: 'open_people', args: { what: 'who' } } }]);
}
