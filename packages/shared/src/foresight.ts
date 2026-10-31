/**
 * FORESIGHT (OWNER-ISSUES 61a, 74(3), 75(b)): a ledger of predictions Ghosty makes about public things — the rain at his
 * saved home, a train or bus on his way to work, his commute's drive, and what Ghosty told him when he asked what it
 * reckons — each scored only against a public feed's later value or the owner's own word, never adjusted after the fact.
 * The pure parts, shared by the brain (apps/edge/src/foresight.ts, the job and the routes), the phone (the Brief, the Report
 * card, the chat with no model) and the tests: the shapes, the guesses, the scoring, the calibration and the words.
 *
 * The line that holds: no prediction about any person. `personProblem` refuses a subject that stands for a person (a
 * pronoun, a relation, a name, "someone", "people"); nothing about anyone is read, kept or inferred here.
 */

/** The brain's storage key for the ledger. */
export const FORESIGHT_KEY = 'foresight:ledger';

export type ForeKind = 'rain' | 'commute' | 'departure' | 'answer';
export const FORE_KINDS: ForeKind[] = ['rain', 'departure', 'commute', 'answer'];

/** How a prediction came out: what happened, whether it was right (null: it could not be told, never counted), and who said. */
export interface Outcome {
  at: number;
  /** What happened, in a few words ("6 minutes late", "dry (0.0 mm)", "31 minutes", "you said it was right"). */
  actual: string;
  right: boolean | null;
  how: 'feed' | 'owner';
  /** The number behind `actual` (a delay in seconds, millimetres of rain, minutes of driving), when there is one. */
  value?: number;
}

/** What the job needs to score a prediction later (never anything about a person: places he saved, a stop, a line). */
export interface ForeRef {
  lat?: number;
  lon?: number;
  /** The rain window, ms (start, end]. */
  win?: [number, number];
  stopId?: string;
  line?: string;
  /** The departure's timetabled time, ms. */
  scheduled?: number;
  /** The samples key it adds to once scored. */
  key?: string;
  /** The commute's predicted minutes. */
  minutes?: number;
  from?: { lat: number; lon: number };
  to?: { lat: number; lon: number };
}

export interface Prediction {
  id: string;
  /** When it was made. */
  at: number;
  kind: ForeKind;
  /** What it is about, at most 80 characters ("rain at Home 12:00–18:00"; his question for 'answer'). */
  subject: string;
  /** What was expected, at most 120 characters, completing "I expect …" ("rain by 15:00", "on time", "about 34 minutes"). */
  expect: string;
  /** 0.5–0.95. */
  confidence: number;
  /** When it can be scored (ms). */
  by: number;
  /** The line he was told, if any. */
  said?: string;
  outcome?: Outcome;
  /** He was told how it came out (the first one that came true). */
  told?: boolean;
  ref?: ForeRef;
}

/** The ledger's own memory of the public feeds: counts about public services, kept to make better guesses. */
export interface Samples {
  /** "line|stop|hh:mm|wd" (or "we") → the last 30 delays in seconds. */
  dep: Record<string, number[]>;
  /** "from|to|hh:mm" → the last 30 live drive times in minutes. */
  com: Record<string, number[]>;
}

export interface ForeLedger {
  items: Prediction[];
  samples: Samples;
  /** When the first prediction came true (the one notification, once ever). */
  firstTrue?: number;
  /** The owner's day the predictions were last made, the kinds already dealt with that day, and why any was left out. */
  made: { day: string; done?: ForeKind[]; notes?: string[] };
  /** Commute samples taken without a prediction ("am" / "pm" → his day). */
  sampled?: Record<string, string>;
}

/** Hourly values from Open-Meteo: `time` in ms, each value for the hour that ends at that time. */
export interface Hourly {
  time: number[];
  /** Probability of more than 0.1 mm in the hour, %. */
  prob: number[];
  /** Precipitation in the hour, mm. */
  mm: number[];
}

export interface Calibration {
  n: number;
  right: number;
  share: number;
}

/** What GET /api/foresight answers. */
export interface ForesightInfo {
  items: Prediction[];
  expect: string[];
  yesterday: string;
  calibration: Record<ForeKind | 'all', Calibration>;
  /** The standing line: "I keep score: right 78% of the time about trains." */
  score: string;
  /** What is missing, said plainly ("The commute needs the free TomTom key, SYSTEM → KEYS."). */
  notes: string[];
  tz: string;
}

export const MAX_ITEMS = 400;
export const MAX_SAMPLES = 30;
/** A departure this late or later is "late". */
export const LATE_S = 180;
/** Rain: at least this much in the window is rain. */
export const RAIN_MM = 0.2;
/** Fewer scored than this and the line says "only N so far". */
export const FEW = 5;
/** "you were right" is read only while an open 'answer' prediction is this young. */
export const ANSWER_DAYS = 7;

const clip = (s: string, n: number) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
/** A confidence kept to 0.5–0.95, to two places. */
export const clampConfidence = (c: number) => Math.round(clamp(Number.isFinite(c) ? c : 0.6, 0.5, 0.95) * 100) / 100;
const two = (x: number) => Math.round(x * 100) / 100;
export const subjectOf = (s: string) => clip(s, 80);
export const expectOf = (s: string) => clip(s, 120);

/** "15:00" in his zone. */
export function hhmm(t: number, tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz || 'UTC' }).format(t);
  } catch {
    return new Date(t).toISOString().slice(11, 16);
  }
}

/** "2026-10-31", his local day. */
export function dayOf(t: number, tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: tz || 'UTC' }).format(t);
  } catch {
    return new Date(t).toISOString().slice(0, 10);
  }
}

/** The day before "2026-10-31": "2026-10-30" (calendar days, whatever the clocks did). */
export function dayBefore(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, (d ?? 1) - 1)).toISOString().slice(0, 10);
}

const pct = (c: number) => `${Math.round(c * 100)}%`;
const minutesWord = (n: number) => `${n} minute${n === 1 ? '' : 's'}`;

// ---------------------------------------------------------------- the guesses

/**
 * Rain in a window from the hourly probabilities: 60 % or more in any hour → "rain by <the first such hour>"; 25 % or
 * less in every hour → "no rain this afternoon"; anything between → no prediction (null). Confidence is the probability
 * (or its complement for a dry one), kept to 0.5–0.95.
 */
export function predictRain(h: Hourly, win: [number, number], tz: string): { expect: string; confidence: number } | null {
  const hours = h.time.map((t, i) => ({ t, p: h.prob[i] })).filter((x) => x.t > win[0] && x.t <= win[1] && typeof x.p === 'number' && Number.isFinite(x.p));
  if (!hours.length) return null;
  const top = Math.max(...hours.map((x) => x.p as number));
  if (top >= 60) {
    const first = hours.find((x) => (x.p as number) >= 60)!;
    return { expect: `rain by ${hhmm(first.t, tz)}`, confidence: clampConfidence(top / 100) };
  }
  if (top <= 25) return { expect: 'no rain this afternoon', confidence: clampConfidence(1 - top / 100) };
  return null;
}

/** A departure from its own past: the first week "on time" at 0.6; then late when more than half the delays were 3 min or more. */
export function predictDeparture(samples: number[]): { expect: string; confidence: number } {
  const s = samples.filter((x) => Number.isFinite(x)).slice(-MAX_SAMPLES);
  if (s.length < FEW) return { expect: 'on time', confidence: 0.6 };
  const late = s.filter((x) => x >= LATE_S).length / s.length;
  return late > 0.5 ? { expect: 'late by 3 min or more', confidence: two(clamp(late, 0.55, 0.9)) } : { expect: 'on time', confidence: two(clamp(1 - late, 0.55, 0.9)) };
}

/** The commute from its own past: the median of the last ten, the confidence by their spread (null: fewer than three). */
export function predictCommute(samples: number[]): { expect: string; confidence: number; minutes: number } | null {
  const s = samples.filter((x) => Number.isFinite(x) && x > 0).slice(-10);
  if (s.length < 3) return null;
  const sorted = [...s].sort((a, b) => a - b);
  const mid = sorted.length / 2;
  const median = Math.round(sorted.length % 2 ? sorted[Math.floor(mid)]! : (sorted[mid - 1]! + sorted[mid]!) / 2);
  const spread = (sorted[sorted.length - 1]! - sorted[0]!) / Math.max(1, median);
  return { expect: `about ${minutesWord(median)}`, confidence: two(clamp(0.9 - spread, 0.55, 0.9)), minutes: median };
}

// ---------------------------------------------------------------- the scoring

/** Rain in the window, from the hourly totals: right when it rained (0.2 mm or more) as expected. null: the window is not in the data. */
export function scoreRain(p: Prediction, h: Hourly, now: number): Outcome | null {
  const win = p.ref?.win;
  if (!win) return null;
  const hours = h.time.map((t, i) => ({ t, mm: h.mm[i] })).filter((x) => x.t > win[0] && x.t <= win[1] && typeof x.mm === 'number' && Number.isFinite(x.mm));
  if (!hours.length) return null;
  const mm = Math.round(hours.reduce((a, x) => a + (x.mm as number), 0) * 10) / 10;
  const rained = mm >= RAIN_MM;
  const wanted = !/^no rain/i.test(p.expect);
  return { at: now, actual: rained ? `rain (${mm.toFixed(1)} mm)` : `dry (${mm.toFixed(1)} mm)`, right: rained === wanted, how: 'feed', value: mm };
}

/**
 * A departure as it really went: right when the sign matches (expected late and 3 min or more late; expected on time and
 * less). Cancelled counts as late. null `found`: the feed had no answer for it (never counted).
 */
export function scoreDeparture(p: Prediction, found: { delay: number; cancelled?: boolean } | null, now: number): Outcome {
  if (!found) return { at: now, actual: 'the feed had no answer', right: null, how: 'feed' };
  const wantLate = /late/i.test(p.expect);
  if (found.cancelled) return { at: now, actual: 'cancelled', right: wantLate, how: 'feed' };
  const m = Math.round(found.delay / 60);
  const late = found.delay >= LATE_S;
  const actual = Math.abs(found.delay) < 60 ? 'on time' : found.delay > 0 ? `${minutesWord(m)} late` : `${minutesWord(-m)} early`;
  return { at: now, actual, right: late === wantLate, how: 'feed', value: found.delay };
}

/** The commute as it really was: right within 20 % or 5 minutes of what was expected. */
export function scoreCommute(p: Prediction, minutes: number, now: number): Outcome {
  const want = p.ref?.minutes ?? Number(/(\d+)/.exec(p.expect)?.[1] ?? NaN);
  const ok = Number.isFinite(want) && Math.abs(minutes - want) <= Math.max(5, 0.2 * want);
  return { at: now, actual: minutesWord(Math.round(minutes)), right: Number.isFinite(want) ? ok : null, how: 'feed', value: minutes };
}

/** The owner's own word. */
export const ownerOutcome = (right: boolean | null, now: number): Outcome => ({ at: now, actual: right === null ? 'you said it could not be told' : right ? 'you said I was right' : 'you said I was wrong', right, how: 'owner' });

// ---------------------------------------------------------------- the record

/** How often the scored ones were right (the last `days`; never one that could not be told). */
export function calibration(items: Prediction[], kind: ForeKind | 'all', now: number, days = 30): Calibration {
  const since = now - days * 86_400_000;
  const scored = items.filter((p) => (kind === 'all' || p.kind === kind) && p.outcome && p.outcome.right !== null && p.outcome.at >= since);
  const right = scored.filter((p) => p.outcome!.right === true).length;
  return { n: scored.length, right, share: scored.length ? right / scored.length : 0 };
}

/** What each kind is about, in his words; departures by what they are (trains, trams, buses). */
export function kindWord(kind: ForeKind | 'all', items: Prediction[] = []): string {
  if (kind === 'rain') return 'rain';
  if (kind === 'commute') return 'the commute';
  if (kind === 'answer') return 'your questions';
  if (kind === 'all') return 'everything';
  const modes = new Set(items.filter((p) => p.kind === 'departure').map((p) => /\b(train|tram|bus)\b/.exec(p.subject)?.[1] ?? 'train'));
  if (modes.size === 1) return [...modes][0] === 'bus' ? 'buses' : `${[...modes][0]}s`;
  return modes.size ? 'trains and buses' : 'trains';
}

/** "right 78% of the time about trains (14 of 18)" / "I've only scored 2 so far about rain" / "nothing scored yet about rain". */
export function calibrationLine(kind: ForeKind | 'all', c: Calibration, items: Prediction[] = []): string {
  const w = kindWord(kind, items);
  if (!c.n) return `nothing scored yet about ${w}`;
  if (c.n < FEW) return `I've only scored ${c.n} so far about ${w}`;
  return `right ${Math.round(c.share * 100)}% of the time about ${w} (${c.right} of ${c.n})`;
}

/** The standing line: the kind with the most scored, or how many so far. */
export function scoreLine(items: Prediction[], now: number): string {
  const best = FORE_KINDS.map((k) => ({ k, c: calibration(items, k, now) })).sort((a, b) => b.c.n - a.c.n)[0];
  if (!best || !best.c.n) return "I keep score: nothing scored yet.";
  const line = calibrationLine(best.k, best.c, items);
  return /^right /.test(line) ? `I keep score: ${line.replace(/ \(\d+ of \d+\)$/, '')}.` : `I keep score: ${line}.`;
}

// ---------------------------------------------------------------- the words

/** "likely" (0.7 or more) or "I think". */
export const confidenceWord = (c: number) => (c >= 0.7 ? 'likely' : 'I think');

/** "the 08:12" from "the 08:12 train from Birmingham New Street (…)". */
const shortDeparture = (subject: string) => /^the \d{1,2}:\d{2}/.exec(subject)?.[0] ?? subject;

/** What is expected, as the rest of "I expect …": "rain by 15:00", "the 08:12 on time", "the commute to take about 34 minutes". */
export function expectPhrase(p: Prediction): string {
  if (p.kind === 'departure') return `${shortDeparture(p.subject)} ${p.expect}`;
  if (p.kind === 'commute') return `the commute to take ${p.expect}`;
  return p.expect;
}

/** "I expect rain by 15:00 (70%)". */
export const expectLine = (p: Prediction) => `I expect ${expectPhrase(p)} (${pct(p.confidence)})`;

/** The Brief's line: "Likely: rain by 15:00", "I think: the 08:12 on time". */
export function briefLine(p: Prediction): string {
  const w = confidenceWord(p.confidence);
  return `${w === 'likely' ? 'Likely' : 'I think'}: ${expectPhrase(p)}`;
}

/** Open ones due today (his zone), soonest first. */
export function todayOpen(items: Prediction[], now: number, tz: string): Prediction[] {
  const today = dayOf(now, tz);
  return items.filter((p) => !p.outcome && (dayOf(p.by, tz) === today || (p.kind === 'answer' && dayOf(p.at, tz) === today))).sort((a, b) => a.by - b.by);
}

/** Today's open predictions in his voice. */
export const expectLines = (items: Prediction[], now: number, tz: string): string[] => todayOpen(items, now, tz).map(expectLine);

/** How one came out, in one sentence: "I expected the 08:12 late; it was, by 6 minutes." */
export function proofLine(p: Prediction): string {
  const o = p.outcome;
  if (!o) return '';
  if (p.kind === 'answer') return `I expected ${p.expect}; ${o.right === null ? 'you said it could not be told' : o.right ? 'you said I was right' : 'you said I was wrong'}.`;
  if (p.kind === 'departure') {
    const s = shortDeparture(p.subject);
    const wantLate = /late/i.test(p.expect);
    const was = `I expected ${s} ${wantLate ? 'late' : 'on time'}`;
    if (o.actual === 'cancelled') return `${was}; it was cancelled.`;
    if (o.right && wantLate) return `${was}; it was, by ${minutesWord(Math.round((o.value ?? 0) / 60))}.`;
    if (o.right) return `${was}; it was${o.actual === 'on time' ? '' : ` (${o.actual})`}.`;
    return `${was}; it was ${o.actual}.`;
  }
  if (p.kind === 'rain') {
    const rained = /^rain/.test(o.actual);
    return `I expected ${p.expect}; ${rained ? `it rained (${(o.value ?? 0).toFixed(1)} mm)` : 'it stayed dry'}.`;
  }
  return `I expected the commute to take ${p.expect}; it took ${o.actual}.`;
}

/**
 * Yesterday, scored: "Yesterday: right 2 of 3 — I expected the 08:12 late; it was, by 6 minutes." The proof names one
 * prediction: the most confident right one, else the wrong one, honestly. '' when nothing due yesterday was scored.
 */
export function yesterdayLine(items: Prediction[], now: number, tz: string): string {
  const y = dayBefore(dayOf(now, tz));
  const scored = items.filter((p) => p.outcome && p.outcome.right !== null && dayOf(p.by, tz) === y);
  if (!scored.length) return '';
  const right = scored.filter((p) => p.outcome!.right);
  const proof = [...(right.length ? right : scored)].sort((a, b) => b.confidence - a.confidence || b.by - a.by)[0]!;
  return `Yesterday: right ${right.length} of ${scored.length} — ${proofLine(proof)}`;
}

/** The one notification, the first time one comes true. */
export const firstTrueText = (p: Prediction) => `My first prediction came true: ${proofLine(p)} I keep score now: SYSTEM → Report card → FORESIGHT.`;

/** "I haven't made any predictions yet…", said when there is nothing to say. */
export const NONE_YET = "I haven't made any predictions yet: I start each morning at six with the day's weather at Home, and your commute when Home and Work are saved.";

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The answer to `foresightAsked`, from what GET /api/foresight holds — the same words in the chat with no model and on
 * Telegram: today's expectations, the record per kind, or how yesterday went.
 */
export function foresightWords(asked: 'today' | 'score' | 'right', info: Pick<ForesightInfo, 'items' | 'expect' | 'yesterday' | 'calibration'>): string {
  if (!info.items.length) return NONE_YET;
  if (asked === 'today') return info.expect.length ? `${info.expect.join('.\n')}.` : "Nothing open for today: I make the day's predictions at six in the morning.";
  if (asked === 'score') {
    const lines = FORE_KINDS.filter((k) => info.calibration[k]?.n).map((k) => `${capital(calibrationLine(k, info.calibration[k]!, info.items))}.`);
    return lines.length ? lines.join('\n') : 'Nothing has been scored yet: each prediction is checked against its feed, or your word, when its time comes.';
  }
  if (info.yesterday) return info.yesterday;
  const last = info.items.filter((p) => p.outcome && p.outcome.right !== null).sort((a, b) => b.outcome!.at - a.outcome!.at)[0];
  return last ? `Nothing was due yesterday. The last one scored: ${proofLine(last)}` : 'Nothing has been scored yet: each prediction is checked when its time comes.';
}

/** What a resolved 'answer' prediction is told: his word, noted. */
export const notedWords = (right: boolean | null) => (right === null ? "Noted: it can't be told." : right ? 'Noted: right.' : "Noted: wrong — I'll remember that.");

// ---------------------------------------------------------------- his words (no model)

const said = (text: string) =>
  String(text ?? '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/^(?:(?:hey|hi|so|ok|okay|oi|and|but|ghosty|mate)[,!]?\s+)*/, '')
    .replace(/[\s?!.]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * "what do you expect today?" → 'today'; "how often are you right?" → 'score'; "were you right?" → 'right'; anything else
 * (a request, "will you marry me") → null. Whole short questions only: words, never a model.
 */
export function foresightAsked(text: string): 'today' | 'score' | 'right' | null {
  const t = said(text);
  if (!t || t.length > 80) return null;
  if (/^(?:what do you (?:expect|predict|foresee)(?: (?:today|for today|this morning|this afternoon|for the day))?|what are your predictions(?: (?:today|for today))?|what(?:'s| is| are) your (?:predictions?|forecasts?|expectations?)(?: (?:for )?today)?|any predictions(?: (?:today|for today))?|what will happen today|what are you expecting(?: today)?)$/.test(t)) return 'today';
  if (/^(?:how often are you right|how good are your predictions|how accurate are (?:you|your predictions)|how(?:'s| is) your (?:record|track record|score)|what(?:'s| is) your (?:record|track record|score)|how many (?:have you|did you) get right|show me your record)$/.test(t)) return 'score';
  if (/^(?:were you right(?: yesterday)?|did you get (?:it|that|them) right|how did you do yesterday|how did your predictions do)$/.test(t)) return 'right';
  return null;
}

/**
 * "you were right", "you were wrong (about the train)", "that was right", "nope, wrong" → his verdict on the latest open
 * 'answer' prediction (the caller checks there is one under seven days old). A short message only; "right, next" is not one.
 */
export function rightSaid(text: string): { right: boolean; about?: string } | null {
  const t = said(text);
  if (!t || t.split(' ').length > 9) return null;
  const m =
    /^(?:you were|that was|you got (?:it|that)|your (?:prediction|guess) was|you called (?:it|that)) (right|correct|spot on|wrong|incorrect)(?:,? (?:about|on|with) (.+))?$/.exec(t) ??
    /^(?:no|nope|nah)[, ]+(wrong)$/.exec(t) ??
    /^(?:yes|yep|yeah)[, ]+(you were right)$/.exec(t);
  if (!m) {
    if (/^you called it(?:,? (?:about|on) (.+))?$/.test(t)) return { right: true, ...(/(?:about|on) (.+)$/.exec(t)?.[1] ? { about: /(?:about|on) (.+)$/.exec(t)![1] } : {}) };
    return null;
  }
  const word = m[1]!;
  return { right: !/wrong|incorrect/.test(word), ...(m[2] ? { about: m[2] } : {}) };
}

// ---------------------------------------------------------------- never about a person

/** Capitalised words that are not people's names (days, months, places and things he may ask about). */
const NOT_NAMES = new Set(
  'Monday Tuesday Wednesday Thursday Friday Saturday Sunday January February March April May June July August September October November December Christmas Easter Halloween Bonfire New Year Today Tomorrow Tonight It The This That These Those There Here What When Where Which Will Would Could Should Is Are Does Do Did Has Have Can Home Work Gym School Bitcoin Ethereum Apple Google Amazon Tesla Nvidia Microsoft Meta Netflix Spotify Sony Samsung Nintendo Xbox Playstation Argos Tesco Sainsbury Sainsburys Asda Aldi Lidl Boots Currys Ikea Birmingham London Manchester Liverpool Leeds Coventry Wolverhampton Solihull Moseley Edgbaston Digbeth England Britain Scotland Wales Ireland Europe America China India City United Villa Arsenal Chelsea Everton Spurs Tottenham Rangers Celtic Albion Wolves Blues Forest Newcastle Brighton Fulham Brentford West Midlands Bank Pound Euro Dollar Ftse Nasdaq Rain Snow Sun Weather Traffic Train Trains Bus Buses Tram Trams Prices Price'.split(' '),
);
const PRONOUN = /\b(?:he|she|they|him|her|them|his|hers|their|theirs|himself|herself|themselves|he'?ll|she'?ll|they'?ll|he'?s|she'?s|they'?re|they'?ve|he'?d|she'?d|they'?d)\b/i;
const SOMEONE = /\b(?:someone|somebody|anyone|anybody|everyone|everybody|no ?one|nobody|people|persons?|folk|folks)\b/i;
const RELATION = /\b(?:mum|mom|mam|mummy|mother|dad|daddy|father|parents?|brothers?|bro|sisters?|sis|siblings?|cousins?|uncles?|aunts?|auntie|aunty|nan|nana|nanny|gran|granny|grandma|grandmother|grandad|granddad|grandpa|grandfather|grandparents?|sons?|daughters?|kids?|children|wife|husband|girlfriend|boyfriend|fianc[ée]e?|mates?|friends?|bestie|bff|colleagues?|co-?workers?|workmates?|neighbou?rs?|landlord|landlady|flatmates?|housemates?|roommates?|relatives?|in-?laws?|crush|the lads|the boys|the girls)\b/i;
/** Words that are a person only with "my", "his", "the"… in front ("my boss", "the baby"; "boss fight" is not one). */
const OWNED = /\b(?:my|our|your|his|her|their|the) (?:boss|manager|teacher|partner|ex|baby|family|team ?mates?|coach|doctor|lecturer|tutor|client|customer|date)\b(?! (?:fight|battle|level|rush|stage|night|out|sale)\b)/i;
/** A name in a question ("will Sam pass", "is Sam going to") or in a statement ("Sam will", "Sam'll"). */
const NAME_AFTER = /\b(?:will|won'?t|is|isn'?t|does|doesn'?t|did|didn'?t|has|hasn'?t|can|could|would|should|might|shall)\s+([A-Z][a-z]{1,15})\b/g;
const NAME_BEFORE = /\b([A-Z][a-z]{1,15})(?:'ll|’ll|\s+(?:will|won'?t|is going to|isn'?t going to|is gonna|gonna|is about to|might|would|could|should|shall)\b)/g;

/**
 * Why a subject is refused — it stands for a person (a pronoun, a relation, a name, "someone", "people") — or null when it
 * is about a thing: the weather, a road, a timetable, a price, his own plans ("I", "my train"). `places`: his saved
 * places' names ("Home", "Nan's"), which are his places, not people: taken out before the checks.
 */
export function personProblem(subject: string, places: string[] = []): string | null {
  let s = String(subject ?? '').replace(/[’‘]/g, "'");
  for (const p of places.map((x) => x.trim().replace(/[’‘]/g, "'")).filter(Boolean)) s = s.replace(new RegExp(`(^|[^\\w'])${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w])`, 'gi'), '$1place');
  if (!s.trim()) return null;
  const hit = (re: RegExp) => re.exec(s)?.[0];
  const w = hit(SOMEONE) ?? hit(PRONOUN) ?? hit(RELATION) ?? hit(OWNED);
  if (w) return `it is about a person ("${w.trim()}")`;
  const ok = NOT_NAMES;
  for (const re of [NAME_AFTER, NAME_BEFORE]) {
    re.lastIndex = 0;
    for (let m = re.exec(s); m; m = re.exec(s)) if (!ok.has(m[1]!)) return `it is about a person ("${m[1]}")`;
  }
  return null;
}

/** What the tool says when it refuses. */
export const NOT_PEOPLE = "I don't make predictions about people.";

// ---------------------------------------------------------------- the ledger's keeping

/** A fresh, empty ledger. */
export const emptyLedger = (): ForeLedger => ({ items: [], samples: { dep: {}, com: {} }, made: { day: '' } });

/** A stored ledger made safe to use (missing parts filled). */
export function readLedger(v: unknown): ForeLedger {
  const o = v && typeof v === 'object' ? (v as Partial<ForeLedger>) : {};
  return {
    items: Array.isArray(o.items) ? o.items.filter((p) => p && typeof p === 'object' && typeof p.id === 'string') : [],
    samples: { dep: o.samples?.dep && typeof o.samples.dep === 'object' ? o.samples.dep : {}, com: o.samples?.com && typeof o.samples.com === 'object' ? o.samples.com : {} },
    ...(typeof o.firstTrue === 'number' ? { firstTrue: o.firstTrue } : {}),
    made: o.made && typeof o.made === 'object' && typeof o.made.day === 'string' ? o.made : { day: '' },
    ...(o.sampled && typeof o.sampled === 'object' ? { sampled: o.sampled } : {}),
  };
}

/** At most `max` items: the oldest scored go first, then (only if it must) the oldest open ones. */
export function prune(items: Prediction[], max = MAX_ITEMS): Prediction[] {
  if (items.length <= max) return items;
  const drop = new Set<string>();
  const scored = items.filter((p) => p.outcome).sort((a, b) => a.at - b.at);
  for (const p of scored) {
    if (items.length - drop.size <= max) break;
    drop.add(p.id);
  }
  const open = items.filter((p) => !p.outcome).sort((a, b) => a.at - b.at);
  for (const p of open) {
    if (items.length - drop.size <= max) break;
    drop.add(p.id);
  }
  return items.filter((p) => !drop.has(p.id));
}

/** Add one value to a samples list, keeping the last 30. */
export function addSample(list: Record<string, number[]>, key: string, v: number): void {
  if (!key || !Number.isFinite(v)) return;
  list[key] = [...(list[key] ?? []), v].slice(-MAX_SAMPLES);
}
