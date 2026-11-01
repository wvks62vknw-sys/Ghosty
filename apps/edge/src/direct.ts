/**
 * Answers with no AI model at all. When every model is cooling down or failing, a simple ask
 * is still answered: a small table maps the owner's words to one read-only tool with sensible
 * arguments (the weather here, today's agenda, what Ghosty remembers, the buses or the roads
 * nearby) or to the local time, and the tool's raw text is the reply — with the exact local
 * time the first model is back, so the owner knows when to ask for more. Anything else gets
 * that time too, and the one tip that ends the waiting for good.
 */
import type { ClientContext } from './prompt';
import type { Raising } from '../../../packages/shared/src/intent';
import { fmtLocal, safeTz, zoned } from './time';

/** What to do instead of asking a model: the local time, or one read-only tool with its arguments. */
export type DirectPlan = { kind: 'time' } | { kind: 'tool'; name: 'weather' | 'list_agenda' | 'list_memory' | 'transit_now' | 'motorway_now'; args: Record<string, unknown> };

export const KEY_TIP = 'Tip: a free key in SYSTEM (Groq, Cerebras or NVIDIA) means never waiting.';

const TIME = /\b(?:what(?:'s| is) the time|what time is it|time is it|what day is it|what(?:'s| is) (?:the |today'?s )?date|today'?s date|which day is it)\b/;
const WEATHER = /\b(?:weather|forecast|rain|raining|snow|snowing|temperature|how (?:hot|cold|warm) is it|umbrella|sunny|windy)\b/;
const MEMORY = /\b(?:what do you (?:remember|know) about me|what have you remembered|what do you remember|list (?:my|your) memor(?:y|ies)|what(?:'s| is) in your memory|your memory of me|what you know about me)\b/;
const AGENDA = /\b(?:agenda|my (?:plans|schedule|calendar|diary)|what(?:'s| is) on (?:today|tomorrow|this week)|what do i have (?:on|today|tomorrow)|(?:any )?plans? (?:for )?(?:today|tomorrow|this week)|appointments?|meetings?)\b/;
const TRANSIT = /\b(?:bus|buses|tram|trams|metro)\b/;
const ROADS = /\b(?:traffic|motorways?|m6|m5|m42|m54|a38|jams?|incidents?|roadworks|road closures?)\b/;

/**
 * The quick asks answered with no model while none is free, by the table that recognises them (directPlan reads them from
 * here; the abilities catalogue lists each one: packages/shared/src/catalogue).
 */
export const DIRECT_ASKS = { time: TIME, weather: WEATHER, memory: MEMORY, agenda: AGENDA, transit: TRANSIT, roads: ROADS } as const;

/** Words that follow "in", "for" or "near" without naming a place. */
const NOT_A_PLACE = /^(?:me|here|there|town|now|today|tomorrow|tonight|the (?:morning|afternoon|evening|night|day|week|weekend|moment|end|city|area)|a (?:bit|while|minute|moment)|my (?:area|place|location|town|city)|this (?:morning|afternoon|evening|week|weekend))$/;

/** A place named after "in", "for", "near", "around" or "at" ("weather in Leeds", "buses near New Street"), or ''. */
export function namedPlace(text: string): string {
  for (const m of text.matchAll(/\b(?:in|for|near|around|at)\s+([a-z][a-z0-9 .'-]{1,40}?)\s*(?:[?!.,;]|$| (?:today|tomorrow|tonight|now|please|right now|at the moment|this (?:morning|afternoon|evening|week)))/gi)) {
    const place = (m[1] ?? '').trim();
    if (place && !NOT_A_PLACE.test(place.toLowerCase())) return place;
  }
  return '';
}

/**
 * The owner's words → what to run instead of a model, or null when only a model could answer.
 * Only read-only tools; a place in the words wins over the owner's own location.
 */
export function directPlan(text: string, c: Pick<ClientContext, 'location'>): DirectPlan | null {
  const t = text.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!t || t.length > 240) return null; // a long message is a conversation, not a quick ask
  const place = namedPlace(t);
  const here = c.location && Number.isFinite(c.location.lat) && Number.isFinite(c.location.lon) ? { lat: c.location.lat, lon: c.location.lon } : null;
  // The transport and road tools name the spot from `place`; weather would geocode it instead, so it gets coordinates alone.
  const spot = place ? { place } : here ? { ...here, ...(c.location?.name ? { place: c.location.name } : {}) } : null;
  const A = DIRECT_ASKS;
  if (A.time.test(t)) return { kind: 'time' };
  if (A.weather.test(t)) return place ? { kind: 'tool', name: 'weather', args: { place } } : here ? { kind: 'tool', name: 'weather', args: here } : null;
  if (A.memory.test(t)) return { kind: 'tool', name: 'list_memory', args: {} };
  if (A.agenda.test(t)) return { kind: 'tool', name: 'list_agenda', args: { days: /\bweek\b/.test(t) ? 7 : /\btomorrow\b/.test(t) ? 2 : 1 } };
  if (A.transit.test(t)) return spot ? { kind: 'tool', name: 'transit_now', args: spot } : null;
  if (A.roads.test(t)) return spot ? { kind: 'tool', name: 'motorway_now', args: spot } : null;
  return null;
}

// ---- small talk: greetings and acknowledgements need no model at all (OWNER-ISSUES 64d: "hey" met "no free model")

/** His name, a "mate", and the dressing around a word ("hey ghosty!!", "ok then mate 👍") — none of it changes what was said. */
const DRESS = /(?:^|\s)(?:ghosty|ghost|mate|bro|man|pal|buddy|kiddo|lad|boss|then|x+)(?=\s|$)/g;
const GREET = /^(?:hey+|hi+|hiya|hello+|hullo|yo+|sup|wassup|what'?s up|ay+|oi|evening|morning|afternoon|good (?:morning|afternoon|evening)|hey there|hi there|you there|you about|you up)$/;
const HOW = /^(?:how are you|how are ya|how're you|how you doing|how are you doing|how'?s it going|how are things|you alright|you ok|you okay|u ok|you good)$/;
const THANKS = /^(?:thanks|thank you|thank u|thanks a lot|thanks so much|cheers|ta|thx|ty|tysm|many thanks|appreciate it|much appreciated)$/;
const ACK = /^(?:ok|okay|alright|k|kk|okey|okie|cool|got it|gotcha|right|righto|fair|fair enough|noted|sure|yep|yup|yeah|ya|aye|sound|safe|bet|understood|makes sense|fine|all good)$/;
const NIGHT = /^(?:night|nite|goodnight|good night|night night|nighty night|gn|sleep well|off to bed|going to bed|i'?m off to bed|bed ?time)$/;
const BYE = /^(?:bye|bye bye|see you|see ya|see you later|cya|later|laters|catch you later|ttyl|speak later|talk later)$/;

/** The small talk answered with no model, always, by the table that recognises it (smallTalk reads them from here; listed in the catalogue). */
export const SMALL_TALK = { greet: GREET, how: HOW, thanks: THANKS, ack: ACK, night: NIGHT, bye: BYE } as const;

/** A reply that asked him something or offered to do something: a bare "ok" or "yeah" after it is an answer, for the model. */
const ASKED = /\?|\b(?:i can|i could|shall i|should i|want me|i'll|would you like|do you want)\b/i;

/**
 * A greeting, a thank-you, an acknowledgement, goodnight or goodbye, answered as a person would — one short line, no
 * model, no menu, no "how can I help". null for anything else (anything with more in it is a conversation). `last`: his
 * own last reply: after a question or an offer, "ok" and "yeah" are answers, so they go to the model.
 */
export function smallTalk(text: string, c: Pick<ClientContext, 'tz' | 'name'>, last = '', now = Date.now()): string | null {
  const t = text.toLowerCase().replace(/[’']/g, "'").replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(DRESS, ' ').replace(/\s+/g, ' ').trim();
  if (!t || t.length > 40) return null;
  const name = c.name?.trim() || 'boss';
  const hour = zoned(now, safeTz(c.tz)).h;
  // A steady choice between two lines (so it is never the same word twice in a row, and a test can know it).
  const pick = (a: string, b: string) => (Math.floor(now / 60_000) % 2 ? b : a);
  const S = SMALL_TALK;
  if (S.greet.test(t)) return hour < 5 ? `Still up, ${name}?` : hour < 12 ? `Morning, ${name}.` : hour < 18 ? `Afternoon, ${name}.` : `Evening, ${name}.`;
  if (S.how.test(t)) return pick('All quiet this end. You?', 'Good. Quiet here. You?');
  if (S.thanks.test(t)) return pick('Any time.', `Any time, ${name}.`);
  if (S.night.test(t)) return `Night, ${name}. I'll keep watch.`;
  if (S.bye.test(t)) return `Later, ${name}.`;
  if (S.ack.test(t) && !ASKED.test(last)) return pick('Right.', 'Good.');
  return null;
}

/** The one line for praise (by its weight) or a standing rule (a length rule, or any other): raisedReply says these. Listed in the catalogue. */
export const RAISED_LINES = {
  praise: { 3: 'That means something. Thank you.', 2: "Good. I'll keep it that way.", 1: 'Noted.' },
  rule: { length: 'Shorter. Noted.', other: "Understood. I'll keep to that." },
} as const;

/**
 * Praise or a standing rule and nothing else (intent.ts raising), acknowledged in one line in his voice — never grovelling,
 * never a speech, no model. A telling-off is answered by the model (he owns it and puts it right): null.
 */
export function raisedReply(r: Raising): string | null {
  if (r.rest || r.kind === 'discipline') return null;
  if (r.rule) return r.length ? RAISED_LINES.rule.length : RAISED_LINES.rule.other;
  if (r.kind === 'reward') return RAISED_LINES.praise[r.weight === 3 ? 3 : r.weight === 2 ? 2 : 1];
  return null;
}

/** "It is Fri 17 Oct 2026, 14:05 (Europe/London)." */
export function localTimeAnswer(c: Pick<ClientContext, 'tz'>, now = Date.now()): string {
  const tz = safeTz(c.tz);
  return `It is ${fmtLocal(now, tz, false)} ${zoned(now, tz).y}, ${fmtLocal(now, tz).slice(-5)} (${tz}).`;
}

/** The wait a failed completion carries (RouterError.waitMs), or null when it says nothing usable. */
export function waitOf(e: unknown): number | null {
  const w = (e as { waitMs?: unknown } | null)?.waitMs;
  return typeof w === 'number' && Number.isFinite(w) && w > 0 ? w : null;
}

/** The owner's local time the first model is back: "14:05", with the day when it is not today ("08:00 Sat 18 Oct"), or '' when no wait is known. */
export function backAt(waitMs: number | null | undefined, c: Pick<ClientContext, 'tz'>, now = Date.now()): string {
  if (typeof waitMs !== 'number' || !Number.isFinite(waitMs) || waitMs <= 0) return '';
  const tz = safeTz(c.tz);
  const at = now + waitMs;
  const day = (ms: number) => {
    const z = zoned(ms, tz);
    return `${z.y}-${z.m}-${z.d}`;
  };
  const time = fmtLocal(at, tz).slice(-5);
  return day(at) === day(now) ? time : `${time} ${fmtLocal(at, tz, false)}`;
}

/** The first line of a reply made without a model. */
export function noModelLine(waitMs: number | null | undefined, c: Pick<ClientContext, 'tz'>, now = Date.now()): string {
  const at = backAt(waitMs, c, now);
  return at ? `No AI model is free right now (the first is back at ${at}).` : 'No AI model is free right now.';
}

/** A direct answer as the owner reads it: the no-model line, then the tool's own text. */
export function directReply(line: string, raw: string): string {
  return `${line} The raw answer:\n${raw.trim()}`;
}

/** The message when nothing could answer: the router's reason, the exact local time the first model is back, and the tip. */
export function noModelMessage(why: string, waitMs: number | null | undefined, c: Pick<ClientContext, 'tz'>, now = Date.now()): string {
  const at = backAt(waitMs, c, now);
  // The router's own key hint gives way to the tip (one hint is enough).
  const reason = why.replace(/\s*Another free key in the System tab gives me more room\.?/, '').trim().replace(/[.\s]*$/, '.');
  return `${reason}${at ? ` The first model is back at ${at}.` : ''} ${KEY_TIP}`;
}
