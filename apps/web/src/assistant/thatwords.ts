/**
 * The words of "that one" (BRIEF-AWARENESS item 4), pure: which act ("make that wall longer", "add a wardrobe there", "a door in that
 * wall", "find me a replacement", "read that one", "open that one") these words are. The phrases registry and the reader read it;
 * the handler that acts on the selection is assistant/thatone.ts.
 */
import { lensWord, type LensWord } from '../vision/frame';

/** The Lens's tools, opened by their words (the one view's MORE key does the same). */
export type LensTool = 'hands' | 'aim' | 'measure' | 'sound' | 'shapes' | 'people';

export type That =
  | { act: 'longer' }
  | { act: 'add'; what: string }
  | { act: 'opening'; type: 'door' | 'window' }
  | { act: 'replace' }
  | { act: 'read' }
  | { act: 'open' }
  // the one Lens (BRIEF-LENS): "what is that", "translate it", "measure it", "name it", "ask about it", "look at it" act on the tag he tapped
  | { act: 'lens'; word: Exclude<LensWord, 'read'> }
  // a tool or an act of the Lens by its word ("hands", "open measure", "is it distorting"): no selection needed
  | { act: 'tool'; mode: LensTool };

const THIS = '(?:that|this|the selected|the highlighted)';
const clean = (t: string) => String(t ?? '').trim().replace(/[.!?\s]+$/g, '').replace(/\s+/g, ' ');

/** Which "that one" act these words are, or null. Short asks only: a long message is a conversation, and goes to the brain. */
export function thatOne(text: string): That | null {
  if (String(text ?? '').length > 90) return null;
  const t = clean(text).replace(/^(?:ok(?:ay)?|right|so|now|please|can you|could you|will you)[, ]+/i, '').replace(/^please /i, '');
  if (new RegExp(`^(?:make|set|change|resize|adjust) ${THIS} wall(?:'?s)?(?: length)?(?: (?:a (?:bit|little) )?(?:longer|shorter|bigger|smaller|wider|different))?$`, 'i').test(t) && /\b(?:longer|shorter|bigger|smaller|wider|length|different)\b/i.test(t)) return { act: 'longer' };
  const op = new RegExp(`^(?:(?:add|put|make|cut|put in|stick) (?:me )?)?(?:a|an|one) (door|window)(?: (?:in|on|into|at|through) ${THIS}(?: wall| one)?| (?:there|here))$`, 'i').exec(t);
  if (op) return { act: 'opening', type: op[1]!.toLowerCase() as 'door' | 'window' };
  const add = new RegExp(`^(?:add|put|place|stick|pop) (?:me )?(?:in )?(.+?) (?:there|here|on ${THIS} wall|against ${THIS} wall|by ${THIS} wall|at ${THIS} wall|next to ${THIS}(?: one)?)$`, 'i').exec(t);
  if (add && !/\b(?:door|window)\b/i.test(add[1]!)) return { act: 'add', what: add[1]! };
  if (new RegExp(`^(?:find|get|search for|look for|show|order|price) (?:me )?(?:a |an |the |some )?(?:replacement|new one|spare|another one)(?: (?:for|of) ${THIS}(?: part| one)?)?$`, 'i').test(t) || new RegExp(`^(?:replace|fix) ${THIS}(?: part| one)?$`, 'i').test(t)) return { act: 'replace' };
  const tool = lensTool(t);
  if (tool) return { act: 'tool', mode: tool };
  const lw = lensWord(t);
  // ("read that" stays the older "read that one": the Lens takes it when it is the screen)
  if (lw) return lw === 'read' ? { act: 'read' } : { act: 'lens', word: lw };
  if (new RegExp(`^(?:read|play|listen to|start)(?: me| to me)? ${THIS}(?: one| passage| book| bit)?$`, 'i').test(t)) return { act: 'read' };
  if (new RegExp(`^(?:open|go to|show|take me to) ${THIS}(?: one| card)?$`, 'i').test(t)) return { act: 'open' };
  return null;
}

/** The Lens's tools by their words: "the lens on hands", "open measure", "hands", "is my speaker distorting". Short asks only. */
export function lensTool(text: string): LensTool | null {
  const t = clean(text).toLowerCase().replace(/^(?:ok(?:ay)?|please|now)[, ]+/, '');
  const m = /^(?:(?:open|start|show|go to|switch to) )?(?:the )?lens (?:on |in )?(hands|aim|measure|sound|shapes|people)$/.exec(t) ?? /^(?:(?:open|start|show) )?(hands|aim|measure|shapes) (?:mode|tool)$/.exec(t) ?? /^(?:(?:open|start|show) )?(hands|measure)$/.exec(t);
  if (m) return m[1] as LensTool;
  if (/^(?:is|are) (?:it|my speaker|the speaker|my speakers|the speakers) distorting$/.test(t)) return 'sound';
  return null;
}
