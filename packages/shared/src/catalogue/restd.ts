/**
 * The catalogue's words for batch ⑧ part D (BRIEF-REST-D): DESIGN A BUILD — the 3D STUDIO's sample and its pane
 * (apps/web/src/features/studio/samples.ts) and its chat words (assistant/phrases.ts `build`); THE HOME ASSISTANT BRIDGE —
 * LINKS → HOME ASSISTANT (features/links/index.ts) and the house's chat words (`house`). Every number a design gives is a
 * first estimate, never certified; the guarded set needs his tap and a confirm: the words say so. Joined into APP_WORDS in
 * app.ts.
 */
import type { CatValue } from '../catalogue';

const SINCE = '2026-11-01';

export const RESTD_WORDS: Record<string, CatValue> = {
  'studio:sample:build': {
    name: 'Design and show a build',
    line: 'You can tell me what you want to build and I draw it: the plan with every size, the parts and their prices, and how to build it.',
    more: 'A shed, a garden room, a garage, a room, a bookshelf, a desk, a bench or a PC, from your words. Every number is a first estimate, never certified: prices are typical from October 2026 until you price a line live. A car, a robot or a TV is a concept with real parts, not a build plan.',
    say: ['Design me a shed three by two', 'Build me a garden room with a desk', 'Spec me a gaming PC under £800'],
    scene: ['making'], cat: 'build',
    tryText: 'Opens the 3D studio on a build', since: SINCE,
  },
  'studio:pane:build': {
    name: 'Your build in 3-D',
    line: 'You can see the build in 3-D with a person beside it for scale, explode it to see the frame, lift the roof off, tap a part for its lines.',
    more: 'Change a size and every face follows: the plan, the 3-D, the bill and the steps. The bill counts every board, screw box and tube of sealant, with a cut list in the lengths timber is sold in and the waste said. FIRST ESTIMATE, NEVER CERTIFIED is on the sheet and on everything you export.',
    say: ['Show me the build', 'Price the roof', 'Make it 4 by 3'],
    scene: ['making'], cat: 'build',
    since: SINCE,
  },
  'phrase:build': {
    name: 'Design it from my words',
    line: 'You can say “design me a shed three by two” and I make the design on your phone, with no AI, and open its plan.',
    more: 'Then “show me the build”, “price the roof”, “make it 4 by 3”, “an apex roof” or “add a window”. The planning and safety lines are rules of thumb with the official words: check with your council. Paste a shop page into a line and it is watched twice a day, so its price is real and dated.',
    say: ['Design me a shed three by two', 'Design me a bedroom 4 by 3 with a wardrobe wall', 'Price the roof', 'Show me the build'],
    scene: ['talking', 'making'], cat: 'build',
    go: { ask: 'Design me a shed three by two', send: false }, since: SINCE,
  },
  'panel:links:HOME ASSISTANT': {
    name: 'Your smart home, linked',
    line: 'You can link your own free Home Assistant box and I work the smart things in your house: lights, heating, blinds, the TV.',
    more: 'Your box reachable over HTTPS with the free DuckDNS add-on, one port forwarded on your router, and a long-lived token: both go in SYSTEM → KEYS, and the token stays in my vault, never on your phone. Nothing paid is needed. Locks, alarms, garage doors and gates always need your own tap and a confirm.',
    say: ['Link my Home Assistant', 'Open the house'],
    scene: ['phone', 'watching'], cat: 'do',
    since: SINCE,
  },
  'phrase:house': {
    name: 'Run the house by words',
    line: 'You can say “turn off the hall light” or “set the heating to 21” and I do it in your house, with no AI.',
    more: 'Also “dim the lamp to 40”, “is the back door open?”, “what’s the temperature in the kitchen?”, “pause the telly”, “close the blinds”, and “the house” for the HOUSE sheet. Two things with one name get “which one?”. A lock, an alarm or a garage door is only ever a button for your tap and a confirm, and nothing acts on a schedule unless you set the rule yourself.',
    say: ['Turn off the hall light', 'Set the heating to 21', 'Is the back door open?', 'Pause the telly'],
    scene: ['talking', 'watching'], cat: 'do',
    go: { ask: 'Is the back door open?', send: false }, since: SINCE,
  },
};
