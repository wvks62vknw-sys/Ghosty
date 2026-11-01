/**
 * The catalogue's words for the car in 3-D (BRIEF-CAR, batch ⑤ part 1): the 3D STUDIO's CAR sample and its CAR · FIX IT
 * pane (apps/web/src/features/studio/samples.ts), and the two phrases answered with no model (apps/web/src/assistant/
 * phrases.ts `carview`, `carfault`). The rules are catalogue.ts `wordProblems`; the completeness test names any registry
 * item without words (apps/edge/test/catalogue.test.mjs).
 */
import type { CatValue } from '../catalogue';

export const CAR_WORDS: Record<string, CatValue> = {
  'studio:sample:car': {
    name: 'Your car in 3-D', line: 'You can see a car you told me about in 3-D: its shape, colour and plate, the bonnet up, a wheel off, underneath.',
    more: 'Built from the public facts of its plate, so it is a stand-in, and I say so: the parts are where they are on most cars like it. Turn it, pinch to zoom, tap any part for what it is, a quick check and a rough cost.',
    say: ['Show me the car', 'Open the bonnet', 'Show me the brakes', 'What’s under it?'], scene: ['making', 'talking'], cat: 'build',
    tryText: 'Opens the 3D studio on the car', since: '2026-11-01',
  },
  'studio:pane:car': {
    name: 'What’s wrong with the car', line: 'You can tell me what is wrong with a car and I light the likely culprits on it in 3-D, the safest check first.',
    more: 'Grinding brakes, a warning light, a smell, a rattle: about forty everyday faults, with the MOT history’s advisories counted in. Each suspect has a 30-second check, DIY or garage, and a first-estimate cost, never a quote. FIND IT ON THE CAR shows the part’s picture beside your camera; it does not recognise anything.',
    say: ['My dad’s car grinds when he brakes', 'The battery light is on', 'Why is there white smoke?'], scene: ['making', 'camera'], cat: 'build',
    since: '2026-11-01',
  },
  'phrase:carview': {
    name: 'Open the bonnet', line: 'You can say "open the bonnet", "show me the brakes" or "what’s under it" and I open the car in 3-D there, with no AI.',
    more: 'On the car you are talking about: the one on show, the last car card, or the car you named. With no car in mind, only the bonnet opens, on a stand-in; the rest go to my brain as ever.',
    say: ['Open the bonnet', 'Show me the engine', 'Show me the brakes', 'What’s under it?'], scene: ['talking', 'making'], cat: 'talk',
    go: { ask: 'Open the bonnet', send: false }, since: '2026-11-01',
  },
  'phrase:carfault': {
    name: 'Tell me what’s wrong', line: 'You can say what is wrong with a car in your own words and its card shows the likely cause, the check and a rough cost.',
    more: 'With no AI: the same words always give the same answer. A safety line comes first when it matters, said once and never softened. SHOW ME opens the car in 3-D with the suspects lit.',
    say: ['My dad’s car makes a grinding noise when I brake', 'The engine light is on', 'It won’t start, it just clicks'], scene: ['talking', 'making'], cat: 'talk',
    go: { ask: 'My dad’s car makes a grinding noise when I brake', send: false }, since: '2026-11-01',
  },
};
