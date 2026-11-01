/**
 * THE PEOPLE PACK (BRIEF-PACKS-2; OWNER-ISSUES 92 ④): ONE tool, `people`, its abilities an `action` enum — described in full
 * only when his words turn the group on, named "people pack" otherwise (tools/index.ts). The people HE introduces and what he
 * says about them: birthdays and dates (a reminder a week before and on the day), gift ideas from his own notes, messages,
 * thank-yous and a card's words in the shape of his own messages (shown first, never sent), who's who, a call to make, a
 * group's plans, a contact's details, his people's cars (read from the guardian's, as they are). Kept in his brain; one line
 * per person goes to his memory so the Memory tab shows it. NOTHING is looked up about anyone: a name he never gave is "I
 * don't have anyone called …". The pure parts: packages/shared/src/people.ts.
 */
import { localDay } from '../../../../packages/shared/src/cadence';
import { card, carName, RELATIONS } from '../../../../packages/shared/src/cards';
import { formatPlate } from '../../../../packages/shared/src/plates';
import {
  applyReplies,
  birthdayCard,
  birthdayWords,
  bornKey,
  budgetOf,
  callAsk,
  callCard,
  cardWords,
  contactAsked,
  dateNext,
  emptyBook,
  giftIdeas,
  giftWords,
  interestsOf,
  messageDraft,
  nextOn,
  occasionOf,
  OCCASIONS,
  parseBirthday,
  parseContact,
  parseKeptDate,
  parsePlan,
  personCardOf,
  personOf,
  planCard,
  planWords,
  repliesIn,
  thanksNote,
  toneOf,
  toneWords,
  turning,
  VOICE_KEY,
  whenWords,
  whoOf,
  type Book,
  type CardStyle,
  type Occasion,
  type Person,
  type Plan,
} from '../../../../packages/shared/src/people';
import { addDays, daysBetween, prettyDay, shortId } from '../../../../packages/shared/src/packs';
import { listCars, knownPeople } from '../cars';
import { addJob, loadJobs, removeJob } from '../schedule';
import { fromZoned, zoned } from '../time';
import { load, packTool, save, todayOf, wordsOf, type ActionFn, type PackDeps } from '../packs/base';
import { loadMemory, MEMORY_KEY } from './memory';
import { arg, type Tool } from './types';

export const PEOPLE_KEYS = { book: 'people:book', plans: 'people:plans', voice: VOICE_KEY } as const;
const MAX_PEOPLE = 200;
const MAX_NOTES = 12;
const REL = [...RELATIONS].sort((a, b) => b.length - a.length).join('|');

/** When the group is described in full: his words about the people in his life. */
export const PEOPLE_WHEN = new RegExp(
  `\\b(birthdays?|bday|gift ideas?|gifts? for|presents? for|what (?:should|shall|can) i (?:get|buy)|anniversar(?:y|ies)|who(?:['’]s| is) who|my people|thank[- ]you|group plans?|who(?:['’]s| is| said) (?:coming|in|yes)|(?:call|ring|text|phone|visit) (?:my )?(?:${REL})|remind me to (?:call|ring|text|phone|visit|email|message)|(?:number|address|email)(?: is| for)|['’]s (?:number|address|email|phone)|message for|card words|words for a card|in my (?:own )?voice|sound like me|how i (?:write|text))\\b`,
  'i',
);
export const PEOPLE_ABOUT =
  'You can keep his people (people: birthday, date, gift, note, who, call, thanks, message, card, plan, contact, cars, coming, forget, voice): only those he introduced, never looked up; nothing is sent.';

// ---------------------------------------------------------------- the book

const loadBook = (d: PackDeps) => load<Book>(d, PEOPLE_KEYS.book, emptyBook());
const saveBook = (d: PackDeps, b: Book) => save(d, PEOPLE_KEYS.book, b);
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const hm = (d: PackDeps) => {
  const z = zoned(d.now(), d.tz);
  return `${String(z.h).padStart(2, '0')}:${String(z.mi).padStart(2, '0')}`;
};

/** The people a name (or a relation, "dad") could mean. */
export function findPeople(book: Book, q: string): Person[] {
  const k = q.trim().toLowerCase().replace(/^my\s+/, '').replace(/['’]s$/, '');
  if (!k) return [];
  const exact = book.people.filter((p) => p.name.toLowerCase() === k);
  if (exact.length) return exact;
  const rel = book.people.filter((p) => p.rel === k);
  if (rel.length) return rel;
  return book.people.filter((p) => p.name.toLowerCase().startsWith(k) || p.name.toLowerCase().split(/\s+/).includes(k));
}
/** He introduced them by telling me: add the person (or find them). */
function ensure(book: Book, who: { name: string; rel?: string }, now: number): Person {
  const have = findPeople(book, who.name)[0];
  if (have) {
    if (who.rel && !have.rel) have.rel = who.rel;
    have.seen = now;
    return have;
  }
  const p: Person = { id: shortId(), name: who.name, ...(who.rel ? { rel: who.rel } : {}), notes: [], seen: now };
  book.people.push(p);
  if (book.people.length > MAX_PEOPLE) book.people.shift();
  return p;
}

const fmtOn = (on: string) => `${+on.slice(-2)} ${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][+on.slice(-5, -3) - 1]}`;
/** One line of his memory per person (the Memory tab shows it; every chat reads it). */
async function syncMemory(d: PackDeps, p: Person): Promise<void> {
  const bits = [p.born ? `birthday ${fmtOn(p.born)}` : '', ...p.notes.slice(-4).map((n) => n.text)].filter(Boolean);
  const text = `${p.name}${p.rel ? ` (his ${p.rel})` : ''}${bits.length ? `: ${bits.join('; ')}` : ''}`.slice(0, 300);
  const facts = await loadMemory(d.storage);
  const i = p.mid ? facts.findIndex((f) => f.id === p.mid) : -1;
  if (i >= 0) facts[i] = { ...facts[i]!, text, edited: d.now() };
  else {
    p.mid = crypto.randomUUID().slice(0, 8);
    facts.push({ id: p.mid, text, at: d.now(), src: { kind: 'chat', at: d.now() } });
  }
  await d.storage.put(MEMORY_KEY, facts);
}
async function dropMemory(d: PackDeps, p: Person): Promise<void> {
  if (!p.mid) return;
  const facts = await loadMemory(d.storage);
  await d.storage.put(MEMORY_KEY, facts.filter((f) => f.id !== p.mid));
}

// ---------------------------------------------------------------- reminders (a week before and on the day, 9am)

const remTitle = (kind: 'Birthday' | 'Date', name: string) => `${kind}: ${name}`;
async function armDay(d: PackDeps, title: string, ymd: string, text: string): Promise<boolean> {
  const at = fromZoned(+ymd.slice(0, 4), +ymd.slice(5, 7), +ymd.slice(8, 10), 9, 0, d.tz);
  if (at < d.now() - 60_000) return false;
  if ((await loadJobs(d.storage)).some((j) => j.kind === 'reminder' && j.title === title && j.next === at)) return true;
  await addJob(d.storage, { kind: 'reminder', title, text, next: at, tz: d.tz }, d.now());
  return true;
}
/** The two reminders for the next time it falls; how many are set (0 to 2). */
async function armYear(d: PackDeps, title: string, next: string, week: string, day: string): Promise<number> {
  let n = 0;
  if (await armDay(d, title, addDays(next, -7), week).catch(() => false)) n++;
  if (await armDay(d, title, next, day).catch(() => false)) n++;
  return n;
}
async function armBirthday(d: PackDeps, p: Person, today: string): Promise<number> {
  if (!p.born) return 0;
  let next = nextOn(p.born, today);
  const age = turning(p.born, next);
  const a = age && age > 0 && age < 130 ? `, turning ${age}` : '';
  let n = await armYear(d, remTitle('Birthday', p.name), next, `${p.name}’s birthday is in a week (${prettyDay(next)}${a}). A card or a gift?`, `It’s ${p.name}’s birthday today${a}.`);
  // today's, and past 9am: the next year's are set instead
  if (!n && daysBetween(today, next) === 0) {
    next = nextOn(p.born, addDays(today, 1));
    n = await armYear(d, remTitle('Birthday', p.name), next, `${p.name}’s birthday is in a week (${prettyDay(next)}).`, `It’s ${p.name}’s birthday today.`);
  }
  return n;
}
async function cancelReminders(d: PackDeps, title: string): Promise<void> {
  for (const j of (await loadJobs(d.storage)).filter((x) => x.kind === 'reminder' && x.title === title)) await removeJob(d.storage, j.id);
}
/** Birthdays whose reminders have all gone: the next year's are set (the Brief's look calls this; nothing else does). */
async function rearm(d: PackDeps, book: Book, today: string): Promise<void> {
  const jobs = await loadJobs(d.storage);
  for (const p of book.people) {
    if (!p.born) continue;
    const t = remTitle('Birthday', p.name);
    if (!jobs.some((j) => j.kind === 'reminder' && j.title === t && j.next > d.now())) await armBirthday(d, p, today);
  }
}

// ---------------------------------------------------------------- the actions

const birthday: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const today = todayOf(d);
  const book = await loadBook(d);
  if (!words && !arg.str(a, 'who', false)) {
    const list = book.people.filter((p) => p.born).map((p) => ({ p, n: daysBetween(today, nextOn(p.born!, today)) })).sort((x, y) => x.n - y.n);
    return { text: list.length ? `Birthdays coming: ${list.map((x) => birthdayWords(x.p, today)).join('; ')}.` : 'No birthdays kept yet. Say "Dad’s birthday is 14 March" and I’ll remind you a week before and on the day.' };
  }
  const b = parseBirthday(words, arg.str(a, 'who', false), today);
  if (!b) return { text: 'Whose, and which day? Say it like "Dad’s birthday is 14 March" (add the year, or "turns 40", and I’ll say how old).' };
  const p = ensure(book, { name: b.name, ...(b.rel ? { rel: b.rel } : {}) }, d.now());
  p.born = bornKey(b);
  await saveBook(d, book);
  const armed = await armBirthday(d, p, today);
  await syncMemory(d, p);
  await saveBook(d, book);
  const next = nextOn(p.born, today);
  const n = daysBetween(today, next);
  return {
    text: `Kept: ${p.name}’s birthday is ${fmtOn(p.born)}${p.born.length === 10 ? ` ${p.born.slice(0, 4)}` : ''} — next ${prettyDay(next)}${n === 0 ? ' (today)' : n === 1 ? ' (tomorrow)' : ` (in ${n} days)`}. ${armed === 2 ? 'I’ll remind you a week before and on the day, at 9am (both are in your Agenda).' : armed === 1 ? 'I’ll remind you on the day at 9am (it’s in your Agenda); the week before has gone.' : 'The reminders for this year have gone; next year’s are set when it comes round.'} Gift ideas, a card or a message are a word away.`,
    cards: [birthdayCard(p, today, armed, d.now())],
  };
};

const date: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const today = todayOf(d);
  const book = await loadBook(d);
  if (!words) {
    const list = [...book.dates].sort((x, y) => (dateNext(x, today) < dateNext(y, today) ? -1 : 1));
    return { text: list.length ? `Your dates: ${list.map((k) => `${k.what} ${prettyDay(dateNext(k, today), today.slice(0, 4))}`).join('; ')}.` : 'No dates kept. Say "our anniversary is 12 June" or "Mum’s retirement do is 5 December".' };
  }
  const k = parseKeptDate(words, today);
  if (!k) return { text: 'Which day? Say it like "our anniversary is 12 June".' };
  book.dates = [...book.dates.filter((x) => x.what.toLowerCase() !== k.what.toLowerCase()), { id: shortId(), ...k }];
  await saveBook(d, book);
  const next = k.yearly ? nextOn(k.on, today) : k.on;
  const armed = next >= today ? await armYear(d, remTitle('Date', k.what), next, `${k.what} is in a week (${prettyDay(next)}).`, `${k.what} is today.`) : 0;
  return {
    text: `Kept: ${k.what} on ${prettyDay(next, today.slice(0, 4))}${k.yearly ? ', every year' : ''}. ${armed === 2 ? 'I’ll remind you a week before and on the day, at 9am.' : armed === 1 ? 'I’ll remind you on the day, at 9am.' : next < today ? 'That day has gone, so no reminder.' : 'No reminder is left to set for it.'}`,
    cards: [card({ id: `people:date:${k.what.toLowerCase()}`, kind: 'brief', at: d.now(), title: k.what, line: `${prettyDay(next, today.slice(0, 4))} · ${armed ? 'reminders set' : 'no reminder'}`, brief: { icon: 'reminder' } })],
  };
};

const gift: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const who = personOf(arg.str(a, 'who', false), words.replace(/^.*?\b(?:for|get|buy)\s+(?:my\s+)?/i, 'my '));
  if (!who) return { text: 'Who is it for? Tell me their name, and what they like, and I’ll find ideas.' };
  const book = await loadBook(d);
  const p = findPeople(book, who.name)[0];
  const { likes, careful } = interestsOf((p?.notes ?? []).map((n) => n.text).reverse());
  const budget = budgetOf(words);
  const seed = Math.max(0, Math.floor(arg.num(a, 'variant', 0)));
  const gifts = giftIdeas(likes, budget, seed);
  const name = p?.name ?? who.name;
  const sayName = careful.map((c) => (c.toLowerCase().startsWith(name.toLowerCase()) ? c : `${name} ${c}`));
  return { text: giftWords(name, likes, sayName, gifts, budget, !p || !p.notes.length), data: { gifts } };
};

const note: ActionFn = async (a, d) => {
  const words = wordsOf(a).replace(/^(?:note|remember|keep|save|tell|that|fyi|btw)\b[:,]?\s*(?:that\s+)?/i, '');
  const who = personOf(arg.str(a, 'who', false), words);
  if (!who) return { text: 'Who is it about? Say it like "Sam loves fishing" or "my cousin Ali is moving to Leeds".' };
  // his own words about them, with their name taken off the front ("Sam likes fishing" → "likes fishing")
  const rest = words
    .replace(new RegExp(`^(?:my\\s+(?:${REL})\\s+)?${who.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:['’]s)?\\b[,:]?\\s*`, 'i'), '')
    .replace(new RegExp(`^my\\s+(?:${REL})(?:['’]s)?\\b[,:]?\\s*`, 'i'), '')
    .trim()
    .replace(/[.]+$/, '');
  const book = await loadBook(d);
  const rel = new RegExp(`^(?:is|’s|'s)\\s+(?:my|his|her|our)\\s+(${REL})\\s*$`, 'i').exec(rest)?.[1]?.toLowerCase();
  if (!rest || (!rel && rest.length < 3)) return { text: `What about ${who.name}? Say it like "${who.name} loves fishing".` };
  const p = ensure(book, { name: who.name, ...(who.rel ? { rel: who.rel } : {}) }, d.now());
  if (rel) p.rel = rel;
  else if (!p.notes.some((n) => n.text.toLowerCase() === rest.toLowerCase())) p.notes = [...p.notes, { at: d.now(), text: rest.slice(0, 160) }].slice(-MAX_NOTES);
  await syncMemory(d, p);
  await saveBook(d, book);
  return { text: rel ? `Kept: ${p.name} is your ${rel}.` : `Kept about ${p.name}: “${rest}”. It’s a line in your Memory too; “forget ${p.name}” drops it all.`, cards: [personCardOf(p, todayOf(d), d.now())], data: { person: p.name } };
};

const who: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const today = todayOf(d);
  const book = await loadBook(d);
  const q = arg.str(a, 'who', false) || (/\b(who(?:'s| is)? who|everyone|everybody|all (?:my )?people|my people)\b/i.test(words) ? '' : (whoOf(words)?.name ?? ''));
  const data = { people: book.people.map((p) => ({ id: p.id, name: p.name, rel: p.rel ?? '', born: p.born ?? '', next: p.born ? nextOn(p.born, today) : '', notes: p.notes.map((n) => n.text), phone: p.phone ?? '', address: p.address ?? '', email: p.email ?? '' })) };
  if (!q) {
    if (!book.people.length) return { text: 'You haven’t told me about anyone yet. Say "Sam is my cousin" or "Dad loves fishing" and I’ll keep it.', data };
    const lines = [...book.people].sort((x, y) => x.name.localeCompare(y.name)).map((p) => `- ${p.name}${p.rel ? ` (${p.rel})` : ''}${p.born ? `, birthday ${fmtOn(p.born)}` : ''}${p.notes.length ? `; last: ${p.notes[p.notes.length - 1]!.text}` : ''}`);
    const nextB = book.people.filter((p) => p.born).map((p) => ({ p, n: daysBetween(today, nextOn(p.born!, today)) })).sort((x, y) => x.n - y.n)[0];
    return {
      text: `The people you’ve told me about (${book.people.length}):\n${lines.join('\n')}`,
      data,
      cards: [card({ id: 'people:book', kind: 'brief', at: d.now(), title: `${book.people.length} people`, line: nextB ? `Next birthday: ${nextB.p.name}, ${nextB.n === 0 ? 'today' : nextB.n === 1 ? 'tomorrow' : `in ${nextB.n} days`}` : 'Tell me more and I’ll remember it', brief: { icon: 'diary' }, acts: [{ label: 'OPEN', run: { name: 'open_people', args: { what: 'who' } } }] })],
    };
  }
  const found = findPeople(book, q);
  if (!found.length) return { text: `I don’t have anyone called ${cap(q)}. I only know the people you tell me about (say "${cap(q)} is my …" and I’ll keep it), and I never look anyone up.`, data };
  if (found.length > 1) return { text: `Which one? ${found.map((p) => `${p.name}${p.rel ? ` (${p.rel})` : ''}`).join('; ')}.`, data };
  const p = found[0]!;
  const bits = [
    p.rel ? `${p.name} is your ${p.rel}.` : `${p.name}: you told me about them.`,
    p.born ? `Birthday: ${birthdayWords(p, today).replace(/^[^:]+: /, '')}.` : '',
    p.notes.length ? `What you’ve said: ${p.notes.slice(-4).map((n) => `${n.text} (${prettyDay(new Date(n.at).toISOString().slice(0, 10), today.slice(0, 4))})`).join('; ')}.` : 'You haven’t said anything else about them.',
    p.phone || p.address || p.email ? `I have their ${[p.phone && 'number', p.email && 'email', p.address && 'address'].filter(Boolean).join(', ')} (ask for it).` : '',
  ].filter(Boolean);
  return { text: bits.join(' '), cards: [personCardOf(p, today, d.now())], data };
};

const call: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const today = todayOf(d);
  const ask = callAsk(words);
  const name = cap(arg.str(a, 'who', false).trim().replace(/^my\s+/i, '')) || ask?.who || '';
  if (!name) return { text: 'Whom, and when? Say "remind me to call Dad on Sunday".' };
  const w = whenWords(ask?.rest ?? words, today, hm(d));
  if (!w) return { text: `When should I remind you to ${ask?.verb ?? 'call'} ${name}? Say a day, like "Sunday" or "tomorrow at 6".` };
  const verb = ask?.verb ?? 'call';
  const title = `${cap(verb)} ${name}`;
  const at = fromZoned(+w.date.slice(0, 4), +w.date.slice(5, 7), +w.date.slice(8, 10), +w.time.slice(0, 2), +w.time.slice(3, 5), d.tz);
  let job;
  try {
    job = await addJob(d.storage, { kind: 'reminder', title, text: `${title}${ask?.rest && !/^(?:on|at|tomorrow|tonight|today)\b/i.test(ask.rest) ? ` ${ask.rest}` : ''}.`.replace(/\s+\./, '.'), next: at, tz: d.tz }, d.now());
  } catch (e) {
    return { text: `I couldn’t set that reminder (${(e as Error).message}).` };
  }
  const book = await loadBook(d);
  const p = findPeople(book, name)[0];
  if (p) {
    p.seen = d.now();
    await saveBook(d, book);
  }
  return {
    text: `Reminder set: ${title} on ${prettyDay(w.date, today.slice(0, 4))} at ${w.time}${w.assumed.length ? ` (I took ${w.assumed.join('; ')})` : ''}. It’s in your Agenda.`,
    cards: [callCard(title, `${prettyDay(w.date, today.slice(0, 4))} at ${w.time}`, job.id, d.now())],
  };
};

async function voiceSamples(d: PackDeps, a: Record<string, unknown>): Promise<string[]> {
  const given = Array.isArray(a.samples) ? (a.samples as unknown[]).filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean) : [];
  return [...(await load<string[]>(d, PEOPLE_KEYS.voice, [])), ...given].slice(-24);
}
const NOT_SENT = 'Shown for you to check; nothing is sent.';

const message: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const occasion = (OCCASIONS as readonly string[]).includes(arg.str(a, 'occasion', false)) ? (arg.str(a, 'occasion', false) as Occasion) : occasionOf(words);
  const w = personOf(arg.str(a, 'who', false), words);
  if (!occasion || !w) return { text: `Who is it for, and what for? Occasions: ${OCCASIONS.join(', ')}.` };
  const book = await loadBook(d);
  const p = findPeople(book, w.name)[0];
  const today = todayOf(d);
  const tone = toneOf(await voiceSamples(d, a));
  const dr = messageDraft({ occasion, name: p?.name ?? w.name, age: p?.born ? turning(p.born, nextOn(p.born, today)) : null, detail: arg.str(a, 'detail', false), variant: arg.num(a, 'variant', 0) }, tone);
  return {
    text: `For ${p?.name ?? w.name} (${occasion}), in your voice:\n“${dr.text}”\nYour tone: ${toneWords(tone)}.\n${NOT_SENT} Say "another" for a different wording. (If you reword it, keep it his: the tone above, and nothing new about ${p?.name ?? w.name}.)`,
    data: { draft: dr.text, variant: dr.variant },
  };
};

const thanks: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const w = personOf(arg.str(a, 'who', false), words.replace(/^.*?\b(?:to|for)\s+(?:my\s+)?/i, 'my '));
  const forWhat = arg.str(a, 'forWhat', false) || /\bfor\s+(.+)$/i.exec(words)?.[1] || '';
  if (!w) return { text: 'Who is it to, and what for? Say "a thank-you note to Auntie Jo for the jumper".' };
  const tone = toneOf(await voiceSamples(d, a));
  const text = thanksNote({ name: w.name, forWhat: forWhat || 'everything', detail: arg.str(a, 'detail', false), from: arg.str(a, 'from', false) }, tone);
  return { text: `A thank-you note to ${w.name}:\n\n${text}\n\nYour tone: ${toneWords(tone)}. ${NOT_SENT} Add one detail of your own (what you will do with it, or what you liked) and it reads like you.` };
};

const cardAction: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const occasion = (OCCASIONS as readonly string[]).includes(arg.str(a, 'occasion', false)) ? (arg.str(a, 'occasion', false) as Occasion) : occasionOf(words) ?? 'birthday';
  const w = personOf(arg.str(a, 'who', false), words);
  const style = (['warm', 'funny', 'short', 'formal'] as const).find((s) => s === arg.str(a, 'style', false) || new RegExp(`\\b${s}\\b`, 'i').test(words)) ?? 'warm';
  if (!w) return { text: 'Who is the card for? Say "card words for Dad’s 70th, funny".' };
  const book = await loadBook(d);
  const p = findPeople(book, w.name)[0];
  const age = Number(/\b(\d{2,3})(?:st|nd|rd|th)\b/.exec(words)?.[1] ?? NaN) || (p?.born ? turning(p.born, nextOn(p.born, todayOf(d))) : null);
  const text = cardWords({ occasion, name: p?.name ?? w.name, style: style as CardStyle, age, from: arg.str(a, 'from', false) });
  return { text: `Words for the card (${occasion}, ${style}):\n\n${text}\n\nThey’re ours, not copied from anyone. Say "funny", "short" or "formal" for another style. ${NOT_SENT}` };
};

const plan: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const today = todayOf(d);
  const plans = await load<Plan[]>(d, PEOPLE_KEYS.plans, []);
  const active = [...plans].reverse().find((p) => !p.closed);
  if (!words) return active ? { text: planWords(active, today.slice(0, 4)), cards: [planCard(active, d.now())], data: { plan: active } } : { text: 'No plan yet. Say "plan: pub on Friday at 8 at the Crown, asked Ali, Sam and Jo", then "Jo’s in, Sam can’t make it".', data: { plan: null } };
  if (active && /\b(cancel|close|scrap|drop|delete|forget)\b.*\bplan\b|^cancel it$/i.test(words)) {
    active.closed = true;
    await save(d, PEOPLE_KEYS.plans, plans);
    return { text: `Plan closed: ${active.what}.`, data: { plan: null } };
  }
  const fresh = !active || /^(?:new plan|plans?|group plan|we(?:'re| are) (?:going|doing))\b/i.test(words);
  let p: Plan;
  if (fresh) {
    const x = parsePlan(words, today, hm(d));
    p = applyReplies({ id: shortId(), what: x.what, ...(x.where ? { where: x.where } : {}), ...(x.when ? { when: x.when } : {}), ...(x.time ? { time: x.time } : {}), yes: [], no: [], maybe: [], asked: x.asked, at: d.now() }, x.replies);
    plans.push(p);
  } else {
    p = active;
    const rs = repliesIn(words);
    const w = /\b(move|change|make|shift|push)\b/i.test(words) ? whenWords(words, today, hm(d)) : null;
    if (!rs.length && !w) return { text: 'I didn’t catch who said what. Try "Jo’s in, Sam can’t make it, Dee maybe" or "move it to Saturday at 7".', data: { plan: p } };
    Object.assign(p, applyReplies(p, rs));
    if (w) {
      p.when = w.date;
      p.time = w.time;
    }
  }
  await save(d, PEOPLE_KEYS.plans, plans.slice(-20));
  return { text: `${fresh ? 'Plan kept: ' : 'Updated: '}${planWords(p, today.slice(0, 4))}`, cards: [planCard(p, d.now())], data: { plan: p } };
};

const contact: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const w = personOf(arg.str(a, 'who', false), words);
  if (!w) return { text: 'Whose? Say "Sam’s number is 07700 900123" or "what’s Sam’s number?".' };
  const book = await loadBook(d);
  const field = arg.str(a, 'field', false) || contactAsked(words);
  const found = parseContact(words);
  if (!Object.keys(found).length) {
    const p = findPeople(book, w.name)[0];
    if (!p) return { text: `I don’t have anyone called ${w.name}. Tell me their number or address and I’ll keep it.` };
    const f = (field === 'phone' || field === 'email' || field === 'address' ? field : '') as 'phone' | 'email' | 'address' | '';
    if (f) return { text: p[f] ? `${p.name}’s ${f === 'phone' ? 'number' : f} is ${p[f]}.` : `I haven’t got ${p.name}’s ${f === 'phone' ? 'number' : f}. Tell me it and I’ll keep it.` };
    return { text: [p.phone && `Number: ${p.phone}`, p.email && `Email: ${p.email}`, p.address && `Address: ${p.address}`].filter(Boolean).join('. ') || `I haven’t got any details for ${p.name} yet.` };
  }
  const p = ensure(book, w, d.now());
  Object.assign(p, found);
  await saveBook(d, book);
  return { text: `Kept for ${p.name}: ${[found.phone && `number ${found.phone}`, found.email && `email ${found.email}`, found.address && `address ${found.address}`].filter(Boolean).join(', ')}. Only in your brain; ask "what’s ${p.name}’s number?" any time.` };
};

const cars: ActionFn = async (_a, d) => {
  const [list, known] = await Promise.all([listCars(d.storage).catch(() => []), knownPeople(d.storage).catch(() => [] as string[])]);
  const theirs = list.filter((c) => c.whose !== 'me');
  const lines = theirs.map((c) => `${carName(c)}: ${formatPlate(c.plate)}${c.mot ? `, MOT due ${c.mot}` : ''}${c.tax ? `, tax due ${c.tax}` : ''}`);
  const without = known.filter((n) => !theirs.some((c) => c.whose.toLowerCase() === n.toLowerCase()));
  return { text: lines.length ? `Your people’s cars (from the guardian’s list):\n${lines.map((l) => `- ${l}`).join('\n')}${without.length ? `\nNo car named for: ${without.join(', ')}.` : ''}` : `No one’s car is named yet.${without.length ? ` (${without.join(', ')} ${without.length === 1 ? 'is' : 'are'} on your guardian list.)` : ''} Say "my dad’s car is AB12 CDE" and it shows here.` };
};

const coming: ActionFn = async (a, d) => {
  const today = todayOf(d);
  const days = Math.min(366, Math.max(1, Math.floor(arg.num(a, 'days', 30))));
  const book = await loadBook(d);
  const items: { on: string; text: string }[] = [];
  for (const p of book.people) if (p.born) items.push({ on: nextOn(p.born, today), text: `${p.name}’s birthday${turning(p.born, nextOn(p.born, today)) ? ` (turning ${turning(p.born, nextOn(p.born, today))})` : ''}` });
  for (const k of book.dates) if (dateNext(k, today) >= today) items.push({ on: dateNext(k, today), text: k.what });
  for (const p of await load<Plan[]>(d, PEOPLE_KEYS.plans, [])) if (!p.closed && p.when && p.when >= today) items.push({ on: p.when, text: `${p.what}${p.time ? ` at ${p.time}` : ''}` });
  for (const j of await loadJobs(d.storage)) {
    if (j.kind !== 'reminder' || !/^(Call|Ring|Phone|Text|Message|Whatsapp|Visit|See|Email|Catch up with|FaceTime|Speak to|Talk to|Write to) /.test(j.title)) continue;
    items.push({ on: localDay(j.next, d.tz), text: j.title });
  }
  const within = items.filter((x) => daysBetween(today, x.on) >= 0 && daysBetween(today, x.on) <= days).sort((x, y) => (x.on < y.on ? -1 : 1));
  if (!within.length) return { text: `Nothing coming in the next ${days} days. Tell me birthdays and dates and I’ll keep them.` };
  return { text: `Coming up (next ${days} days):\n${within.map((x) => `- ${prettyDay(x.on, today.slice(0, 4))}: ${x.text}`).join('\n')}` };
};

const forget: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const book = await loadBook(d);
  const what = arg.str(a, 'what', false).toLowerCase() || (/\bbirthday\b/i.test(words) ? 'birthday' : /\b(number|phone|mobile)\b/i.test(words) ? 'phone' : /\baddress\b/i.test(words) ? 'address' : /\bemail\b/i.test(words) ? 'email' : /\bnotes?\b/i.test(words) ? 'notes' : '');
  const dateHit = book.dates.find((k) => k.what.toLowerCase().split(/\s+/).filter((w) => w.length > 3).some((w) => words.toLowerCase().includes(w)));
  const q = arg.str(a, 'who', false) || whoOf(words.replace(/^(?:forget|remove|drop|delete|take|clear)\b\s*(?:off\s+)?/i, ''))?.name || '';
  const found = q ? findPeople(book, q) : [];
  if (dateHit && !found.length) {
    book.dates = book.dates.filter((k) => k.id !== dateHit.id);
    await saveBook(d, book);
    await cancelReminders(d, remTitle('Date', dateHit.what));
    return { text: `Dropped the date: ${dateHit.what}, and its reminders.` };
  }
  if (!found.length) return { text: q ? `I don’t have anyone called ${cap(q)}.` : 'Whom? Say "forget Sam" (all of it) or "forget Sam’s number".' };
  if (found.length > 1) return { text: `Which one? ${found.map((p) => p.name).join('; ')}.` };
  const p = found[0]!;
  if (what === 'birthday' && p.born) {
    delete p.born;
    await cancelReminders(d, remTitle('Birthday', p.name));
    await syncMemory(d, p);
    await saveBook(d, book);
    return { text: `Forgot ${p.name}’s birthday, and its reminders.` };
  }
  if (what === 'phone' || what === 'address' || what === 'email') {
    delete p[what];
    await saveBook(d, book);
    return { text: `Forgot ${p.name}’s ${what === 'phone' ? 'number' : what}.` };
  }
  if (what === 'notes') {
    p.notes = [];
    await syncMemory(d, p);
    await saveBook(d, book);
    return { text: `Forgot what you’d said about ${p.name}; I still know who they are.` };
  }
  book.people = book.people.filter((x) => x.id !== p.id);
  await saveBook(d, book);
  await cancelReminders(d, remTitle('Birthday', p.name));
  await dropMemory(d, p);
  return { text: `Forgot ${p.name} completely: their notes, birthday reminders, details and the line in your Memory.` };
};

const voice: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  if (/^(?:forget|clear|delete|remove)\b/i.test(words)) {
    await d.storage.delete(PEOPLE_KEYS.voice);
    return { text: 'Forgot the samples of how you write. Drafts will be plain until you share some again.' };
  }
  const given = Array.isArray(a.samples) ? (a.samples as unknown[]).filter((x): x is string => typeof x === 'string').map((x) => x.trim().slice(0, 400)).filter(Boolean) : [];
  const fromText = arg.str(a, 'text', false) ? arg.str(a, 'text', false).split(/\n\s*(?:---+|\n)\s*/).map((x) => x.trim().slice(0, 400)).filter(Boolean) : [];
  const add = [...given, ...fromText];
  const kept = await load<string[]>(d, PEOPLE_KEYS.voice, []);
  if (add.length) {
    const all = [...kept, ...add.filter((x) => !kept.includes(x))].slice(-12);
    await save(d, PEOPLE_KEYS.voice, all);
    return { text: `Kept ${add.length} of your messages as the shape of how you write (${all.length} in all, only in your brain). Your tone: ${toneWords(toneOf(all))}. “forget my writing samples” clears them.` };
  }
  return { text: `How you write: ${toneWords(toneOf(kept))}.${kept.length ? '' : ' Paste a few of your own messages ("this is how I text: …") and my drafts will sound like you.'}` };
};

export const PEOPLE: Record<string, ActionFn> = { birthday, date, gift, note, who, call, thanks, message, card: cardAction, plan, contact, cars, coming, forget, voice };
export const PEOPLE_ACTIONS = Object.keys(PEOPLE);

export const peopleTools: Tool[] = [
  packTool({
    name: 'people',
    description:
      "His people pack: only people he introduces; nothing looked up, nothing sent. birthday: keep one (words, who) or list the next. date: another date (\"our anniversary is 12 June\"). gift: ideas from his notes with rough prices (who; words may give a budget). note: keep what he says about someone (who, words). who: one person or everyone. call: a reminder to call or text someone (words). thanks: a thank-you note (who, forWhat). message: a message for an occasion in his voice (who, occasion, detail, variant). card: a card's words (who, occasion, style). plan: a group plan and who said yes (words). contact: keep or recall a number, email or address (who, words). cars: his people's cars. coming: what is coming up (days). forget: drop a person or one detail (who, what). voice: keep samples of how he writes (samples) or say how he writes. Drafts are shown to him first, never sent.",
    actions: PEOPLE,
    properties: {
      words: { type: 'string', description: 'his words for it, as he said them' },
      who: { type: 'string', description: 'the person: a name or "dad"' },
      occasion: { type: 'string', enum: [...OCCASIONS], description: 'message, card' },
      style: { type: 'string', enum: ['warm', 'funny', 'short', 'formal'], description: 'card' },
      forWhat: { type: 'string', description: 'thanks: what the thanks are for' },
      detail: { type: 'string', description: 'message, thanks: one detail of his own to add' },
      variant: { type: 'number', description: 'message, gift: 1, 2… for another wording or other ideas' },
      samples: { type: 'array', items: { type: 'string' }, description: 'voice (and message): his own past messages, as he shared them' },
      what: { type: 'string', enum: ['birthday', 'phone', 'address', 'email', 'notes'], description: 'forget: one detail only' },
      days: { type: 'number', description: 'coming: how many days ahead (default 30)' },
    },
    reads: ['who', 'gift', 'thanks', 'message', 'card', 'cars', 'coming'],
  }),
];

/** The Brief's people lines (mind.ts): a birthday within the week, a date, a plan today or tomorrow. Also sets next year's birthday reminders. */
export async function peopleLines(d: PackDeps): Promise<string[]> {
  const today = todayOf(d);
  const book = await loadBook(d);
  await rearm(d, book, today).catch(() => undefined);
  const items: { n: number; text: string }[] = [];
  const phrase = (n: number, who: string, thing: string, on: string) => (n === 0 ? `${who}’s ${thing} is today` : n === 1 ? `${who}’s ${thing} is tomorrow` : `${who}’s ${thing} in ${n} days (${prettyDay(on)})`);
  for (const p of book.people) {
    if (!p.born) continue;
    const on = nextOn(p.born, today);
    const n = daysBetween(today, on);
    if (n <= 7) items.push({ n, text: phrase(n, p.name, 'birthday', on) });
  }
  for (const k of book.dates) {
    const on = dateNext(k, today);
    const n = daysBetween(today, on);
    if (n >= 0 && n <= 7) items.push({ n, text: n === 0 ? `${k.what} is today` : n === 1 ? `${k.what} is tomorrow` : `${k.what} in ${n} days (${prettyDay(on)})` });
  }
  for (const p of await load<Plan[]>(d, PEOPLE_KEYS.plans, [])) {
    const n = p.when ? daysBetween(today, p.when) : 99;
    if (!p.closed && n >= 0 && n <= 1) items.push({ n, text: `${p.what} ${n === 0 ? 'today' : 'tomorrow'}${p.time ? ` at ${p.time}` : ''}: ${p.yes.length} yes${waitingNote(p)}` });
  }
  return items.sort((x, y) => x.n - y.n).slice(0, 3).map((x) => x.text);
}
const waitingNote = (p: Plan): string => {
  const w = p.asked.filter((n) => ![...p.yes, ...p.no, ...p.maybe].some((x) => x.toLowerCase() === n.toLowerCase()));
  return w.length ? `, waiting on ${w.join(', ')}` : '';
};
