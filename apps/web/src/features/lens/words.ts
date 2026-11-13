/**
 * THE LENS'S WORDS (BRIEF-QUALITY-SEE): the lines the modes say in his voice, in one place and with no DOM, so the spec reads the very
 * words the page is built from. The people rule's line is the rule's own, word for word.
 */
import type { NameGuess } from '../../vision/clipmath';

/** PEOPLE, a face he did not introduce: the rule's own line. Never a name, never a guess. */
export const STRANGER = 'Someone I don’t know. I never identify a stranger.';

/** READ found nothing to read. */
export const NO_WORDS = 'No words in view. Hold the page flatter.';

/** NAME found nothing it could name. */
export const NO_NAME = 'Nothing I can name from that. Try closer, in better light.';

/** ASK with nothing to ask about, and with no signal to ask it on. */
export const NO_PICTURE = 'No picture yet. Tap START to take one.';
export const NO_SIGNAL_ASK = 'No signal, so I can’t ask my brain. READ, NAME and SEE still work on this phone.';

/** MEASURE: said on every number: it is a first estimate (never certified). */
export const FIRST_ESTIMATE = 'a first estimate';

/** NAME's closest names, said as a guess: "Maybe robin, sparrow or wren. I’m guessing." */
export function maybeWords(names: NameGuess[], max = 3): string {
  const top = names.slice(0, max).map((n) => n.label);
  if (!top.length) return '';
  const list = top.length === 1 ? top[0]! : `${top.slice(0, -1).join(', ')} or ${top[top.length - 1]}`;
  return `Maybe ${list}. I’m guessing.`;
}
