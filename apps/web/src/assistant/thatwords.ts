/**
 * The words of "that one" (BRIEF-AWARENESS item 4), pure: which act ("make that wall longer", "add a wardrobe there", "a door in that
 * wall", "find me a replacement", "read that one", "open that one") these words are. The phrases registry and the reader read it;
 * the handler that acts on the selection is assistant/thatone.ts.
 */
export type That =
  | { act: 'longer' }
  | { act: 'add'; what: string }
  | { act: 'opening'; type: 'door' | 'window' }
  | { act: 'replace' }
  | { act: 'read' }
  | { act: 'open' };

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
  if (new RegExp(`^(?:read|play|listen to|start)(?: me| to me)? ${THIS}(?: one| passage| book| bit)?$`, 'i').test(t)) return { act: 'read' };
  if (new RegExp(`^(?:open|go to|show|take me to) ${THIS}(?: one| card)?$`, 'i').test(t)) return { act: 'open' };
  return null;
}
