/**
 * What the chat answers on this phone with no model, as the tables that recognise it. Pure, so the ABILITIES catalogue
 * reads the same list (apps/web/src/abilities/sources.ts) and its test can too.
 *
 *  - LOCAL_ASKS: the questions about Ghosty himself, in the order assistant/local.ts `localTurn` tries them — it dispatches
 *    from this list (a table added here needs its handler there, or the typecheck fails; a handler not listed here is never
 *    asked). A table that matches but has nothing to say (no open question for "you were right") lets the next one try.
 *  - FIRST_ASKS: what assistant/session.ts `send` reads before anything else, with the same matchers it uses: the walk home
 *    (assistant/guard.ts), a stop by intent, "reboot".
 * The panic phrase is his own words, checked by their hash only (Settings → GUARDIAN), so it has no table here; PEOPLE's
 * "this is Sam" is the Lens's while PEOPLE is open (features/lens/people.ts).
 */
import { canYouAsked, todayAsked, whyAsked } from '../../../../packages/shared/src/abilities';
import { foresightAsked, rightSaid } from '../../../../packages/shared/src/foresight';
import { homeSaid, walkCancelled, walkStart } from '../../../../packages/shared/src/guardian';
import { stopIntent } from '../../../../packages/shared/src/intent';
import { workbenchAsked } from '../../../../packages/shared/src/workbench';
import { machineAsked } from '../features/eye/machine';
import { looksLikeStatement } from '../../../../packages/shared/src/money';
import { bodyAsked } from '../../../../packages/shared/src/body';
import { ovenAsked, shoppingAsked, timerAsked } from '../../../../packages/shared/src/kitchen';
import { wikiAsked } from '../wiki/words';
import { morseAsked } from '../morse/code';

/** "reboot": the boot cinematic again, here on the phone (shell/boot.ts); the brain is not asked. */
export const REBOOT = /^(reboot|reboot (him|yourself|ghosty)|restart yourself)[.!]?$/i;

export const LOCAL_ASKS = [
  // [packs] a statement pasted in the chat: to his brain's SPENDING by the rule table, never to a model (assistant/packs.ts)
  { id: 'statement', test: (t: string) => looksLikeStatement(t) || /^(?:i want to |let me |can i )?(?:paste|add|read|send)\s+(?:in\s+)?(?:a|my)\s+(?:bank\s+)?statement[.!?]?$/i.test(t.trim()) },
  // [packs] the body pack's screens and a glass of water, on the phone (features/body)
  { id: 'reps', test: (t: string) => bodyAsked(t)?.what === 'reps' },
  { id: 'run', test: (t: string) => bodyAsked(t)?.what === 'run' },
  { id: 'breathe', test: (t: string) => bodyAsked(t)?.what === 'breathe' },
  { id: 'stretch', test: (t: string) => bodyAsked(t)?.what === 'stretch' },
  { id: 'water', test: (t: string) => bodyAsked(t)?.what === 'water' },
  // [packs] the kitchen pack on the phone: timers, the shopping list, the oven line (features/kitchen)
  { id: 'timer', test: (t: string) => !!timerAsked(t) },
  { id: 'shopping', test: (t: string) => shoppingAsked(t) },
  { id: 'oven', test: (t: string) => !!ovenAsked(t) },
  // [resta] Wikipedia from the file on this phone (wiki/ask.ts) and the Morse sheet (morse/sheet.ts), both with no model
  { id: 'wiki', test: (t: string) => !!wikiAsked(t) },
  { id: 'morse', test: (t: string) => !!morseAsked(t) },
  { id: 'machine', test: (t: string) => machineAsked(t) },
  { id: 'workbench', test: (t: string) => !!workbenchAsked(t) },
  { id: 'foresight', test: (t: string) => !!foresightAsked(t) },
  { id: 'right', test: (t: string) => !!rightSaid(t) },
  { id: 'today', test: (t: string) => todayAsked(t) },
  { id: 'why', test: (t: string) => !!whyAsked(t) },
  { id: 'canyou', test: (t: string) => canYouAsked(t) !== null },
] as const;
export type LocalAsk = (typeof LOCAL_ASKS)[number]['id'];

export const FIRST_ASKS = [
  { id: 'walk', test: (t: string) => !!walkStart(t) || homeSaid(t) || walkCancelled(t) },
  { id: 'stop', test: (t: string) => !!stopIntent(t) },
  { id: 'reboot', test: (t: string) => REBOOT.test(t) },
] as const;
