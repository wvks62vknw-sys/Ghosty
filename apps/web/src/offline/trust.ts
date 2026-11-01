/**
 * TRUST BY GRADE (BRIEF-OFFLINE-DEFAULT; OWNER-ISSUES 72, 78): the brain on his phone answers FIRST what it has passed.
 *  - The kind of ask, decided here by code from his words (no model): greetings and small talk; rewording or fixing the
 *    grammar of text he gives; summing up text he gives; translating a sentence (TRANSLATE_LANGS); sums and units (the
 *    calculator first); his memory and the library on this phone; questions on what he reads; spelling; the day read back.
 *    Everything else is the cloud's (search, tools, long reasoning, anything that acts), and so is any ask whose words touch
 *    a tool — a time, a place, "remind", "send", "search" — whatever else it looks like (`touchesTool`).
 *  - The grades: SCHOOL's report card per brain (apps/edge/src/school/trust.ts, GET /api/school/trust), kept here. A kind is
 *    trusted for a brain at his bar (SETTINGS → OFFLINE BRAIN → TRUST, 80% unless he moves it) on at least twenty held-out
 *    questions; three ASK THE CLOUD taps on it in a week put it back to the cloud for that brain until its next report card.
 *  - The meter's sums by kind (the independence sheet, features/system/independence.ts) and the Brief's weekly line.
 *  - What a task kept on the phone does (`keptAnswer`, assistant/session.ts): its brain answers, or it stops with words.
 *    There is no way to the cloud in it: that is the fail-closed line (OWNER-ISSUES 72), tested with a marker
 *    (apps/edge/test/offline2.test.mjs). A trusted kind never changes that: "always" (SOVEREIGN MODE) is the phone's alone.
 * Pure but for the kept store (`trust`, localStorage `ghosty.trust`); offline/brain.ts fetches the table and asks the phone.
 */
import { OWN_BRAINS, ownShare, weekOf, type MeterDay, type Where } from '../../../../packages/shared/src/independence';
import { createStore } from '../core/store';
import { calcExact, exactText, sumIn, toNumber } from './exact';
import { translateAsk } from './prompt';

// ---------------------------------------------------------------- the kinds of ask

/** The kinds of ask the phone's brain may answer first (the same ids as apps/edge/src/school/trust.ts TRUST_CATS). */
export const TRUST_CATS = ['greet', 'reword', 'summary', 'translate', 'sums', 'memory', 'reading', 'spelling', 'agenda'] as const;
export type TrustCat = (typeof TRUST_CATS)[number];
export type AskCat = TrustCat | 'cloud';

/** Each kind in his words: the TRUST table's row, and the short form WHICH BRAIN lists. */
export const CAT_WORDS: Record<AskCat, { label: string; short: string }> = {
  greet: { label: 'Greetings and small talk', short: 'greetings' },
  reword: { label: 'Rewording and grammar', short: 'rewording' },
  summary: { label: 'Summing up what you give me', short: 'summaries' },
  translate: { label: 'Translating a sentence', short: 'translating' },
  sums: { label: 'Sums and units', short: 'sums' },
  memory: { label: 'Your memory and library', short: 'your memory' },
  reading: { label: 'Questions on what you read', short: 'reading questions' },
  spelling: { label: 'Spelling', short: 'spelling' },
  agenda: { label: 'Your day read back', short: 'your day' },
  cloud: { label: 'Everything else', short: 'everything else' },
};

/** The eight languages a sentence may be translated in first on the phone (the others are the cloud's). */
export const TRANSLATE_LANGS = ['fr', 'es', 'de', 'it', 'pt', 'nl', 'pl', 'zh'];

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** The text he gives with an ask: on the lines after the first, after a colon, or in double quotes ('' when none). */
export function splitGiven(text: string): { ask: string; given: string } {
  const t = text.trim();
  const nl = t.indexOf('\n');
  if (nl > 0 && t.slice(nl + 1).trim()) return { ask: t.slice(0, nl).trim(), given: t.slice(nl + 1).trim() };
  const colon = /^([^:\n]{2,80}):\s*([\s\S]+)$/.exec(t);
  if (colon) return { ask: colon[1]!.trim(), given: colon[2]!.trim() };
  const q = /^([\s\S]*?)["“]([\s\S]{3,})["”]\s*[.?!]*$/.exec(t);
  if (q) return { ask: q[1]!.trim(), given: q[2]!.trim() };
  return { ask: t, given: '' };
}

// A tool's words: what only the cloud can do or look up (a time or a place said is a tool's too: a reminder, a route).
const TOOL =
  /\b(?:remind(?:er|ers|ing)?|alarms?|timers?|send|sent|e-?mail(?:s|ed)?|text (?:him|her|them|me|my|back)|message (?:him|her|them|my)|call (?:me|him|her|them|my|mum|dad|home)|ring (?:me|him|her|them|my)|search(?:ing)?|google|look (?:it |this |that )?up|find (?:me|out)|browse|website|online|internet|the web|news|headlines?|weather|forecast|traffic|prices?|stocks?|bitcoin|crypto|scores?|fixtures|book (?:me|us|a|an|tickets?|tables?|flights?|hotels?|appointments?)|booking|order (?:me|a|an|some)|buy|pay|transfer|tweet|publish|upload|download|open|play (?:me|some|a|the|my|music|radio|songs?)|stream|record|turn (?:on|off)|switch (?:on|off)|schedule (?:a|an|me|it|this|that|for)|set (?:a|an|the|my|up|me)|add (?:a|an|the|my|to|it|this|that)|create|delete|remove|cancel|save|remember (?:that|this|to|my)|forget|note (?:that|this|down)|directions?|navigate|route|maps?|near(?:by|est)?|where(?:'s| is| are)|how far|distance|postcode|address|live|latest|currently|right now)\b/i;
// A time of day or a while: "at 5", "5pm", "17:30", "in ten minutes", "o'clock".
const CLOCK = /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|\b\d{1,2}[:.]\d{2}\b|\b(?:at|by|until|till|before|after) (?:\d{1,2}|noon|midnight)\b|\bin (?:\d+|a|an|one|two|five|ten|fifteen|twenty|thirty|half an) (?:min(?:ute)?s?|hours?|days?|weeks?)\b|\bo'?clock\b/i;
// Money in another currency needs a live rate: the cloud's.
const CURRENCY = /[$€¥]|\b(?:dollars?|euros?|yen|rupees?|currenc(?:y|ies)|exchange rate)\b/i;

/** His words touch a tool (a time, a place, a reminder, a send, a search, live things): never answered on the phone first. */
export const touchesTool = (text: string): boolean => TOOL.test(text) || CLOCK.test(text);

const UNIT = '(?:km|kilomet(?:re|er)s?|miles?|met(?:re|er)s?|cm|centimet(?:re|er)s?|mm|inch(?:es)?|feet|foot|ft|yards?|kg|kilos?|kilograms?|grams?|lbs?|pounds?|stones?|ounces?|oz|lit(?:re|er)s?|ml|pints?|gallons?|celsius|fahrenheit|degrees|mph|kph|cups?|teaspoons?|tablespoons?)';
const UNIT_SUM = new RegExp(`\\b\\d+(?:\\.\\d+)?\\s*${UNIT}\\b.{0,20}\\b(?:in|to|into|as)\\s+${UNIT}\\b|\\bhow many ${UNIT} (?:are )?(?:in|to) (?:a|an|one|\\d+(?:\\.\\d+)?)\\s*${UNIT}\\b`, 'i');
const BARE_SUM = /^[\d\s.,+\-*/×÷^()%−–]+[?=]?$/;

/** A sum to work out ("what's 17 × 23?", "15% of 80", "(4+5)*3") or a unit sum ("5 miles in km"). */
export function sumAsked(text: string): boolean {
  const t = text.trim();
  if (CURRENCY.test(t) || CLOCK.test(t)) return false;
  // (a sum said bare: "15% of 80", "17 times 23")
  if (sumIn(t) || (/^[\d(−-]/.test(t) && sumIn(`what is ${t}`))) return true;
  if (BARE_SUM.test(t) && /\d\s*[-+*/×÷^%−–]\s*[\d(]/.test(t)) return !!calcExact(t.replace(/[?=]\s*$/, ''));
  return UNIT_SUM.test(t);
}

/** The exact answer to a sum, worked out on the phone with no model ("17 × 23 = 391"), or null. */
export function workedOut(text: string): string | null {
  const s = sumIn(text.trim()) ?? (/^[\d(−-]/.test(text.trim()) ? sumIn(`what is ${text.trim()}`) : null);
  const expr = s?.expr ?? (BARE_SUM.test(text.trim()) ? text.trim().replace(/[?=]\s*$/, '').trim() : '');
  const v = s?.exact ?? (expr ? calcExact(expr) : null);
  if (!v) return null;
  const whole = v.d === 1n;
  const n = toNumber(v);
  return `${expr} = ${whole ? exactText(v) : `${exactText(v)} (about ${Number(n.toPrecision(6))})`}`;
}

const REWORD =
  /\b(?:re-?word|rephrase|re-?write|paraphrase|shorten|make (?:it|this|that) (?:shorter|clearer|simpler|sound better|more (?:formal|polite|friendly|casual|professional))|tighten(?: up)?|tidy (?:it |this |that )?up|fix (?:the |my |its |this )?(?:grammar|spelling|punctuation|wording|english)|correct (?:the |my |its |this )?(?:grammar|spelling|punctuation|english)|proof-?read|clean (?:it |this |that )?up|improve (?:the |my )?wording|say (?:it|this|that) better|check (?:the |my )?grammar)\b/i;
const SUMMARY = /\b(?:summari[sz]e|summary of|sum (?:it|this|that) up|tl;?dr|the gist|key points|main points|in a nutshell|boil (?:it|this|that) down)\b/i;
const SPELL = /^(?:how (?:do (?:you|i)|to|would you|should i|d'?you) spell|spell(?: out)?\b|what'?s the spelling of|(?:the )?correct spelling of|is it spel(?:t|led)|how is .{1,40} spel(?:t|led)|is .{1,40} spel(?:t|led) (?:right|correctly))/i;
const AGENDA =
  /\b(?:what(?:'s| is) (?:on )?my (?:agenda|schedule|calendar|diary|day|plan)|what(?:'s| is) on (?:today|tomorrow|this (?:morning|afternoon|evening)|for (?:today|tomorrow))|what (?:have i got|do i have|am i doing)(?: on)? (?:today|tomorrow|this (?:morning|afternoon|evening))|read (?:me )?(?:out )?my (?:agenda|schedule|diary|day|calendar)|(?:my|the) (?:agenda|schedule|diary) (?:for )?(?:today|tomorrow)|anything on (?:today|tomorrow)|am i (?:free|busy) (?:today|tomorrow))\b/i;
const MEMORY =
  /\b(?:do you remember|what do you (?:know|remember) about (?:me|my)|what did i (?:tell|say to|teach) you|what have i (?:told|taught) you|who(?:'s| is) my [a-z]+|when(?:'s| is) my (?:birthday|anniversary)|what(?:'s| is) my (?:name|favourite [a-z]+|[a-z]+'s (?:name|birthday))|(?:in|from) my (?:library|notes|books?|memory)|what does my (?:library|book|notes?) say)\b/i;
const READING =
  /\b(?:in|from) (?:the |this |that )?(?:book|story|chapter(?: \d+)?|passage|poem|novel|fable|tale)\b|\bwhat happens in (?:the )?(?:book|story|chapter|end)\b|\bwho (?:is|was) the (?:main character|hero|heroine|villain|narrator|author)\b/i;
const GREET =
  /^(?:hi|hello|hey|hiya|heya|yo|howdy|hullo|good (?:morning|afternoon|evening|night)|morning|evening|night night|how are (?:you|u|things)|how(?:'s| is) (?:it going|your day|things|you)|how(?:'re| are) you|what'?s up|sup|thanks|thank (?:you|u)|ta|cheers|nice one|bye|goodbye|see (?:you|ya)|later|ok(?:ay)?|cool|great|lovely|nice|brilliant|alright|all right|you there|are you there|i'?m (?:back|tired|bored|good|fine|ok))\b/i;

/**
 * The kind of ask his words are, by code (no model). `last`: the last reply, for "translate that into French". A tool's
 * words make anything the cloud's; the text he gives (after a colon, in quotes, on the next lines) is not read for them.
 */
export function categorise(text: string, last = ''): AskCat {
  const t = text.trim();
  if (!t) return 'cloud';
  if (sumAsked(t)) return 'sums';
  const tr = translateAsk(t, last);
  if (tr) return TRANSLATE_LANGS.includes(tr.to) && !touchesTool(t.replace(tr.text, ' ')) ? 'translate' : 'cloud';
  const { ask, given } = splitGiven(t);
  if (given && words(given) >= 3) {
    if (REWORD.test(ask)) return touchesTool(ask) ? 'cloud' : 'reword';
    if (SUMMARY.test(ask) && words(given) >= 12) return touchesTool(ask) ? 'cloud' : 'summary';
  }
  if (touchesTool(t)) return 'cloud';
  if (SPELL.test(t) && words(t) <= 12) return 'spelling';
  if (AGENDA.test(t)) return 'agenda';
  if (MEMORY.test(t)) return 'memory';
  if (READING.test(t)) return 'reading';
  if (GREET.test(t) && words(t) <= 8) return 'greet';
  return 'cloud';
}

/** "How independent are you?" (and "independence meter", "show me my independence"): the INDEPENDENCE sheet, no model. */
export const INDEPENDENT_ASK = /^(?:how independent are (?:you|we)|how independent am i|(?:show (?:me )?|open )?(?:the |my |your )?independence(?: meter| sheet)?)\s*[?.!]*$/i;

// ---------------------------------------------------------------- the trust table and the bar

/** One kind's grade for one brain, from SCHOOL's papers (the brain's GET /api/school/trust). */
export interface TrustRow {
  cat: TrustCat;
  pct: number | null;
  items: number;
  from: string;
}
export interface BrainTrust {
  /** The brain and its weights' commit, as SCHOOL files a paper ("<model id>@<7 characters>"). */
  model: string;
  /** Its report card's date: the newest paper it sat. */
  at: number;
  papers?: number;
  rows: TrustRow[];
}
/** ASK THE CLOUD under an answer the phone gave first: a miss for that kind on that brain. */
export interface Miss {
  at: number;
  cat: string;
  model: string;
}
export interface Judged extends TrustRow {
  trusted: boolean;
  why: string;
}

export const DEFAULT_BAR = 80;
export const ITEM_FLOOR = 20;
/** This many misses in a week put a kind back to the cloud for that brain until its next report card. */
export const MISSES = 3;
const DAY = 86_400_000;

/** Three misses within a week since the brain's report card (`since`): the kind is the cloud's again until the next one. */
export function dropped(misses: Miss[], model: string, cat: string, since: number): boolean {
  const t = misses.filter((m) => m.model === model && m.cat === cat && m.at > since).map((m) => m.at).sort((a, b) => a - b);
  for (let i = 0; i + MISSES - 1 < t.length; i++) if (t[i + MISSES - 1]! - t[i]! <= 7 * DAY) return true;
  return false;
}

/** Each kind for one brain: its grade, on how many questions, whether it is trusted at his bar, and why, in his words. */
export function judge(brain: BrainTrust | undefined, o: { bar: number; misses: Miss[]; floor?: number }): Judged[] {
  const floor = o.floor ?? ITEM_FLOOR;
  return TRUST_CATS.map((cat): Judged => {
    const r = brain?.rows.find((x) => x.cat === cat);
    const row: TrustRow = { cat, pct: r?.pct ?? null, items: r?.items ?? 0, from: r?.from ?? '' };
    const no = (why: string): Judged => ({ ...row, trusted: false, why });
    if (!brain) return no('this brain has sat no paper yet');
    if (row.pct === null || !row.items) return no('no paper tests it yet');
    if (row.items < floor) return no(`${row.pct}%, but on only ${row.items} questions: ${floor} are needed`);
    if (row.pct < o.bar) return no(`${row.pct}% on ${row.items} questions: under your ${o.bar}%`);
    if (dropped(o.misses, brain.model, cat, brain.at)) return no(`you asked the cloud instead ${MISSES} times this week: the cloud's until its next report card`);
    return { ...row, trusted: true, why: `${row.pct}% on ${row.items} questions` };
  });
}

const andList = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

/**
 * WHICH BRAIN's line for each brain here, smallest first: "SmolLM2 360M: greetings and spelling", then a bigger one that
 * does all of that and more as "Qwen2.5 0.5B: + rewording, summaries".
 */
export function whichLines(brains: { label: string; judged: Judged[] }[]): string[] {
  let before: string[] = [];
  return brains.map((b) => {
    const has = b.judged.filter((j) => j.trusted).map((j) => CAT_WORDS[j.cat].short);
    const more = has.filter((x) => !before.includes(x));
    const line = !has.length ? `${b.label}: nothing yet (the cloud answers first)` : before.length && more.length && before.every((x) => has.includes(x)) ? `${b.label}: + ${more.join(', ')}` : `${b.label}: ${andList(has)}`;
    before = has;
    return line;
  });
}

// ---------------------------------------------------------------- what the phone keeps

/** The table as last fetched (every brain that sat a paper), his bar, and the misses (sixty days, two hundred at most). */
export const trust = createStore(
  { bar: DEFAULT_BAR, brains: [] as BrainTrust[], floor: ITEM_FLOOR, fetchedAt: 0, misses: [] as Miss[] },
  { persist: 'ghosty.trust' },
);

export function noteMiss(cat: string, model: string, now = Date.now()): void {
  trust.set((s) => ({ misses: [...s.misses.filter((m) => now - m.at < 60 * DAY), { at: now, cat, model }].slice(-200) }));
}

/** One brain's kinds as his bar and the misses judge them now. */
export function judgedFor(model: string): Judged[] {
  const s = trust.get();
  return judge(s.brains.find((b) => b.model === model), { bar: s.bar, misses: s.misses, floor: s.floor });
}

// ---------------------------------------------------------------- where a turn goes

export type Mode = 'auto' | 'always' | 'off';

/** Kept on the phone (OWNER-ISSUES 72): "always" (SOVEREIGN MODE), or ON THIS PHONE for it — unless he tapped for the cloud. */
export const keptTurn = (o: { cloud?: boolean; here?: boolean; mode: Mode }): boolean => !o.cloud && (o.mode === 'always' || !!o.here);

/** The phone's brain may answer FIRST: not a kept task (that is the phone's alone), not with it off, not the cloud's kinds. */
export const mayGoFirst = (o: { cloud?: boolean; here?: boolean; again?: boolean; mode: Mode; cat: AskCat }): boolean =>
  !keptTurn(o) && !o.cloud && !o.again && o.mode === 'auto' && o.cat !== 'cloud';

/** Why a task kept on the phone stopped, in his words. */
export const keptWhy = (mode: Mode, ready: boolean): string =>
  mode === 'off' ? 'my offline brain is switched off (Settings → Offline brain)' : ready ? "my offline brain couldn't answer it" : "my offline brain isn't on this phone yet (Settings → Offline brain → DOWNLOAD, on Wi-Fi)";
/** The stop itself: nothing of it went anywhere, and the cloud is only an offer he taps. */
export const keptWords = (why: string): string => `I can't do this on the phone right now: ${why}. Nothing of it left the phone.`;

/**
 * A task kept on the phone: its brain answers, or the task stops with words (`stop`). What it is given has no way to the
 * cloud: not a first try, not a retry, not a fallback. True when the phone answered.
 */
export async function keptAnswer(mode: Mode, fx: { ready(): Promise<boolean>; answer(): Promise<boolean>; stop(why: string, words: string): void }): Promise<boolean> {
  const ready = mode !== 'off' && (await fx.ready().catch(() => false));
  if (ready && (await fx.answer().catch(() => false))) return true;
  const why = keptWhy(mode, ready);
  fx.stop(why, keptWords(why));
  return false;
}

// ---------------------------------------------------------------- the meter by kind

const noon = (d: string) => Date.parse(`${d}T12:00:00Z`);

/** The `span` days ending `day`: answers, those on his own brains, the share (null: none), and each kind's. */
export function spanOf(days: MeterDay[], day: string, span: number): { total: number; own: number; pct: number | null; cats: Record<string, { n: number; o: number }> } {
  const end = noon(day);
  let total = 0;
  let own = 0;
  const cats: Record<string, { n: number; o: number }> = {};
  for (const x of days) {
    const t = noon(x.d);
    if (!(t <= end && t > end - span * DAY)) continue;
    for (const [k, v] of Object.entries(x.n) as [Where, number][]) {
      if (!(v > 0)) continue;
      total += v;
      if (OWN_BRAINS.includes(k)) own += v;
    }
    for (const [k, v] of Object.entries(x.g ?? {})) cats[k] = { n: (cats[k]?.n ?? 0) + v.n, o: (cats[k]?.o ?? 0) + v.o };
  }
  return { total, own, pct: total ? Math.round((own / total) * 100) : null, cats };
}

/** The Brief's weekly line: "This week 61 per cent of what you asked stayed on your phone, up from 48." ('' when nothing was asked). */
export function briefLine(days: MeterDay[], day: string): string {
  const now = ownShare(weekOf(days, day));
  if (now === null) return '';
  const before = ownShare(weekOf(days, day, 1));
  const tail = before === null ? '' : before === now ? ', the same as last week' : `, ${now > before ? 'up' : 'down'} from ${before}`;
  return `This week ${now} per cent of what you asked stayed on your phone${tail}.`;
}
