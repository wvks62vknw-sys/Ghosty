/**
 * Answers with no AI model at all. When every model is cooling down or failing, a simple ask
 * is still answered: a small table maps the owner's words to one read-only tool with sensible
 * arguments (the weather here, today's agenda, what Ghosty remembers, the buses or the roads
 * nearby) or to the local time, and the tool's raw text is the reply — with the exact local
 * time the first model is back, so the owner knows when to ask for more. Anything else gets
 * that time too, and the one tip that ends the waiting for good.
 */
import type { ClientContext } from './prompt';
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
  if (TIME.test(t)) return { kind: 'time' };
  if (WEATHER.test(t)) return place ? { kind: 'tool', name: 'weather', args: { place } } : here ? { kind: 'tool', name: 'weather', args: here } : null;
  if (MEMORY.test(t)) return { kind: 'tool', name: 'list_memory', args: {} };
  if (AGENDA.test(t)) return { kind: 'tool', name: 'list_agenda', args: { days: /\bweek\b/.test(t) ? 7 : /\btomorrow\b/.test(t) ? 2 : 1 } };
  if (TRANSIT.test(t)) return spot ? { kind: 'tool', name: 'transit_now', args: spot } : null;
  if (ROADS.test(t)) return spot ? { kind: 'tool', name: 'motorway_now', args: spot } : null;
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
