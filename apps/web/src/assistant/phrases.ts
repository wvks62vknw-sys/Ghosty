/**
 * What the chat answers on this phone with no model, as the tables that recognise it. Pure, so the ABILITIES catalogue
 * reads the same list (apps/web/src/abilities/sources.ts) and its test can too.
 *
 *  - LOCAL_ASKS: the questions about Ghosty himself, in the order assistant/local.ts `localTurn` tries them — it dispatches
 *    from this list (a table added here needs its handler there, or the typecheck fails; a handler not listed here is never
 *    asked). A table that matches but has nothing to say (no open question for "you were right") lets the next one try.
 *    The car's two come first (BRIEF-CAR): what is wrong with a car (car/faults.ts, the fault table), and the words that
 *    open its views ("open the bonnet", "show me the engine": before the Workbench's engine panel, which has them too).
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
import { symptomOf, viewAsked } from '../car/faults';
import { originAsked } from '../../../../packages/shared/src/social';
import { wikiAsked } from '../wiki/words';
import { morseAsked } from '../morse/code';
import { PEOPLE_ASK } from '../../../../packages/shared/src/people';
import { INTERVIEW_ASK, POMO_ASK } from '../../../../packages/shared/src/work';
import { BEAT_ASK, DRAW_ASK } from '../../../../packages/shared/src/creative';
import { ratingAsked } from '../gym/chessrate';
import { coachAsked } from '../coach/ask';

/** "reboot": the boot cinematic again, here on the phone (shell/boot.ts); the brain is not asked. */
export const REBOOT = /^(reboot|reboot (him|yourself|ghosty)|restart yourself)[.!]?$/i;

export const LOCAL_ASKS = [
  { id: 'carview', test: (t: string) => viewAsked(t) !== null },
  { id: 'carfault', test: (t: string) => symptomOf(t) !== null },
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
  // [social] "who made you?", "where did you come from?": FATHER AND THE ORIGIN's first lines and its card (features/me)
  { id: 'origin', test: (t: string) => originAsked(t) },
  // [resta] Wikipedia from the file on this phone (wiki/ask.ts) and the Morse sheet (morse/sheet.ts), both with no model
  { id: 'wiki', test: (t: string) => !!wikiAsked(t) },
  { id: 'morse', test: (t: string) => !!morseAsked(t) },
  // [packs2] the people pack's who's who, on the phone (features/people); the work and creative packs' phrases follow
  { id: 'people', test: (t: string) => PEOPLE_ASK.test(t.trim()) },
  { id: 'interview', test: (t: string) => INTERVIEW_ASK.test(t.trim()) },
  { id: 'pomodoro', test: (t: string) => POMO_ASK.test(t.trim()) },
  { id: 'beat', test: (t: string) => BEAT_ASK.test(t.trim()) },
  { id: 'drawing', test: (t: string) => DRAW_ASK.test(t.trim()) },
  { id: 'machine', test: (t: string) => machineAsked(t) },
  { id: 'workbench', test: (t: string) => !!workbenchAsked(t) },
  { id: 'foresight', test: (t: string) => !!foresightAsked(t) },
  { id: 'right', test: (t: string) => !!rightSaid(t) },
  { id: 'today', test: (t: string) => todayAsked(t) },
  { id: 'why', test: (t: string) => !!whyAsked(t) },
  // [restb] chess with a real rating: both ratings in words (assistant/restb.ts, gym/chessrate.ts)
  { id: 'chessrating', test: (t: string) => ratingAsked(t) },
  // [restb] the instrument and skills coach on the phone: the tuner, the lessons, and typing, drawing and words (assistant/restb.ts, coach/)
  { id: 'tuner', test: (t: string) => coachAsked(t)?.what === 'tuner' },
  { id: 'coach', test: (t: string) => coachAsked(t)?.what === 'lessons' },
  { id: 'skill', test: (t: string) => ['typing', 'draw', 'words', 'juggle'].includes(coachAsked(t)?.what ?? '') },
  { id: 'canyou', test: (t: string) => canYouAsked(t) !== null },
] as const;
export type LocalAsk = (typeof LOCAL_ASKS)[number]['id'];

export const FIRST_ASKS = [
  { id: 'walk', test: (t: string) => !!walkStart(t) || homeSaid(t) || walkCancelled(t) },
  { id: 'stop', test: (t: string) => !!stopIntent(t) },
  { id: 'reboot', test: (t: string) => REBOOT.test(t) },
] as const;
