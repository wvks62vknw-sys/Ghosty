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
import { symptomOf, viewAsked } from '../car/faults';

/** "reboot": the boot cinematic again, here on the phone (shell/boot.ts); the brain is not asked. */
export const REBOOT = /^(reboot|reboot (him|yourself|ghosty)|restart yourself)[.!]?$/i;

export const LOCAL_ASKS = [
  { id: 'carview', test: (t: string) => viewAsked(t) !== null },
  { id: 'carfault', test: (t: string) => symptomOf(t) !== null },
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
