/**
 * WIKIPEDIA, OFFLINE in his words (assistant/phrases.ts LOCAL_ASKS; wiki/ask.ts answers them on the phone, no model):
 *  - "look it up offline" (the thing he asked about last), "look up black holes offline", "look black holes up offline";
 *  - "offline wikipedia black holes", "wikipedia offline: black holes";
 *  - "what does wikipedia say about black holes (offline)?" — with "offline" it is always the phone's; without it the phone
 *    answers only when a Wikipedia file is here, and the brain otherwise.
 * And `whatIsAsked`: the thing in "what is a cat?", "who was Ray Charles?", "tell me about black holes" — what the chat
 * offers from the file when the brain cannot be reached and nothing else answered (assistant/session.ts).
 * Pure, so the tests run it.
 */

export interface WikiAsk {
  /** What to look up; '' for "look it up offline" (the thing of his last question). */
  thing: string;
  /** He said "offline" (or "wikipedia offline"): the phone answers even when no file is here (to say how to get one). */
  offline: boolean;
}

const LEAD = /^(?:hey ghosty[,!]?\s+|ghosty[,!]?\s+)?(?:please\s+|can you\s+|could you\s+)?/i;
const END = /[\s.!?]*$/;
const strip = (s: string) => s.replace(/^[\s"'“‘]+|[\s"'”’]+$/g, '').replace(/\s+/g, ' ').trim();

export function wikiAsked(text: string): WikiAsk | null {
  const t = text.trim().replace(LEAD, '').replace(END, '');
  if (!t || t.length > 160) return null;
  let m = /^look (?:it|that|this) up (?:offline|in (?:the |my )?offline wikipedia|on (?:the )?offline wikipedia|in wikipedia offline)$/i.exec(t);
  if (m) return { thing: '', offline: true };
  m = /^look up (.+?) (?:offline|in (?:the |my )?offline wikipedia|on (?:the )?offline wikipedia)$/i.exec(t) ?? /^look (.+?) up (?:offline|in (?:the |my )?offline wikipedia)$/i.exec(t);
  if (m && strip(m[1]!)) return { thing: strip(m[1]!), offline: true };
  m = /^(?:offline wikipedia|wikipedia offline)(?:\s*[:,-]\s*|\s+)(?:for |on |about )?(.+)$/i.exec(t);
  if (m && strip(m[1]!)) return { thing: strip(m[1]!), offline: true };
  m = /^(?:what does|what do(?:es)? the|what's|what is|whats) (?:the )?(?:offline )?wikipedia (?:say|have|got|know|tell me)(?: to say)? (?:about|on) (.+?)(\s*\(?\s*offline\s*\)?)?$/i.exec(t);
  if (m && strip(m[1]!)) return { thing: strip(m[1]!), offline: !!m[2] || /offline wikipedia/i.test(t) };
  return null;
}

/** "what is the time?" and the like are not Wikipedia's to answer. */
const NOT_A_TOPIC = /^(?:the )?(?:time|date|day|weather|temperature|forecast|news|score|plan|matter|point|deal|problem|answer|news today|traffic|it|this|that|up|next|new|happening|going on|on|today|tomorrow|tonight|yesterday)\b|^(?:my|your|our|his|her|their|me|you|ghosty)\b/i;

/** The thing he asked about in "what is a cat?", "who was Ray Charles", "tell me about black holes"; null otherwise. */
export function whatIsAsked(text: string): string | null {
  const t = text.trim().replace(LEAD, '').replace(END, '');
  const m = /^(?:what|who)(?: is|'s|’s| are| was| were) (?:a |an |the )?(.+)$/i.exec(t) ?? /^(?:tell me about|define|explain) (?:a |an |the )?(.+)$/i.exec(t);
  if (!m) return null;
  const thing = strip(m[1]!);
  if (!thing || thing.length > 80 || NOT_A_TOPIC.test(thing) || /\b(?:i|me|my|you|your)\b/i.test(thing)) return null;
  return thing;
}

/** The titles to try for a thing, best first: as said, its first letter up, each word up ("black holes" → "Black holes", "Black Holes"). */
export function titleVariants(thing: string): string[] {
  const t = thing.replace(/_/g, ' ').replace(/\s+/g, ' ').trim().replace(/^(?:a|an|the) /i, '');
  if (!t) return [];
  const first = t.charAt(0).toUpperCase() + t.slice(1);
  const lowerRest = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
  const words = t.split(' ').map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ');
  return [...new Set([t, first, lowerRest, words, t.toLowerCase(), t.toUpperCase()])].filter(Boolean);
}
