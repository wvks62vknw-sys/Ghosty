/**
 * FURTHER (BRIEF-OCT-IDEAS-3): the words that open the ten new things, pure, so the chat's table (assistant/phrases.ts) and the
 * ABILITIES catalogue read the one list and a test can too. Nothing here fetches or draws.
 *
 *  - "interpreter", "translate for us", "help me talk to a French speaker": INTERPRETER (features/interpreter)
 *  - "what do you know?": MIND AS A MAP (features/further/mindmap.ts), the same as a long hold on the orb
 *  - "walk me through the library", "walk me through it": WALK ME THROUGH IT (features/further/walk.ts)
 *  - "what changed?": WHAT CHANGED SINCE YESTERDAY (further/changed.ts)
 *  - "rehearse a job interview", "help me practise telling my landlord about the damp": REHEARSE (features/rehearse)
 */
import { LANGUAGES } from '../../../../packages/shared/src/scan';

const END = '[\\s.!?]*$';

/** A language named in his words ("a French speaker", "into Urdu"): its code, or ''. The longest name wins. */
export function languageIn(text: string): string {
  const t = ` ${text.toLowerCase()} `;
  const hit = [...LANGUAGES]
    .filter((l) => l.code !== 'en')
    .sort((a, b) => b.name.length - a.name.length)
    .find((l) => new RegExp(`[^a-z]${l.name.toLowerCase()}[^a-z]`).test(t));
  return hit?.code ?? '';
}

/** The interpreter asked for: `to` is the other person's language when his words named one. */
export function interpreterAsked(text: string): { to: string } | null {
  const t = String(text ?? '').trim().replace(/^(?:ok(?:ay)?|please|hey|now)[, ]+/i, '');
  const open = new RegExp(`^(?:(?:open|start|switch on|turn on|go to)\\s+)?(?:the\\s+)?(?:interpreter(?:\\s+mode)?|be my interpreter|interpret for (?:me|us)|translate for (?:us|me)(?:\\s+(?:into|to)\\s+.+)?|help me (?:talk|speak) (?:to|with)\\s+.+)${END}`, 'i');
  return open.test(t) ? { to: languageIn(t) } : null;
}

/** "what do you know?": the map of his memory (not "what do you know about X", which the brain answers). */
export const mapAsked = (text: string): boolean => new RegExp(`^(?:so,?\\s+)?what (?:do|d'?)(?: )?you know(?: about me)?${END}`, 'i').test(String(text ?? '').trim());

/** "walk me through the library", "walk me through it" (it: the screen he is on): the screen's words, or 'here'. */
export function walkAsked(text: string): { what: string } | null {
  const m = new RegExp(`^(?:can you |could you |please )?walk me (?:through|round|around)\\s+(?:the\\s+)?(.+?)${END}`, 'i').exec(String(text ?? '').trim());
  if (!m) return null;
  const what = m[1]!.trim().toLowerCase();
  return { what: /^(?:it|this|this screen|here|that)$/.test(what) ? 'here' : what };
}

/** "what changed?", "what changed since yesterday?": the plan's lines, read out. */
export const changedAsked = (text: string): boolean => new RegExp(`^(?:so,?\\s+)?what(?:'s| has| have)? (?:changed|new)(?: since yesterday)?${END}`, 'i').test(String(text ?? '').trim());

/** REHEARSE asked for, with the situation if his words gave one ("a job interview for a junior mechanic"). */
export function rehearseAsked(text: string): { situation: string; talk: boolean } | null {
  const t = String(text ?? '').trim();
  const talk = new RegExp(`^(?:practi[sc]e|rehearse|run through)\\s+(?:my|a|the)\\s+(?:presentation|talk|speech|pitch)${END}`, 'i');
  if (talk.test(t) || /^presentation practice[.!?]*$/i.test(t)) return { situation: '', talk: true };
  // "rehearse …" and "role-play …" always; "practise" only for a conversation (the coach has typing, guitar and the interview pack has its own)
  const m = /^(?:let'?s |can we |i want to |help me |i need to )?(?:(?:rehearse|role-?play)|(?:practi[sc]e)(?=\s+(?:telling|talking|asking|having|saying|a conversation|a difficult)))(?:\s+(?:for|with|a|an|the|my))?\s*(.*?)[\s.!?]*$/i.exec(t);
  if (!m) return null;
  const rest = (m[1] ?? '').trim();
  return { situation: rest, talk: false };
}

/** Whether these are words FURTHER answers (the chat table's test; pure). */
export const furtherAsked = (t: string): boolean => !!interpreterAsked(t) || mapAsked(t) || !!walkAsked(t) || changedAsked(t) || !!rehearseAsked(t);
