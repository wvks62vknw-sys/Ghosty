/**
 * The catalogue's words for batch ⑧ part C (BRIEF-REST-C): CHECK IT'S LIVE, the face check before a face is saved
 * (apps/web/src/features/lens/liveness.ts; the setting in SETTINGS → PRIVACY → FACES); SHAPES, a room drawn in the air
 * with one finger, as a blueprint and in 3-D (apps/web/src/hands; the Lens tile and the chat's phrase); TV MODE, the
 * layout for a television (apps/web/src/tv; the switch in SETTINGS → THEME and the chat's phrase). The rules are catalogue.ts
 * `wordProblems`; the completeness test names any registry item without words (apps/edge/test/catalogue.test.mjs).
 */
import type { CatValue } from '../catalogue';

export const RESTC_WORDS: Record<string, CatValue> = {
  'app:livecheck': {
    name: 'Check it’s a live face', line: 'I make sure a face is really there, not a photo held up, before I save it: you blink twice or turn your head.',
    more: 'I check before I save your face or someone you introduce, and before anything that unlocks or acts; a hello by name skips it. All on this phone. A video of a real head can still fool it.',
    say: ['(tap ENROL ME in the Lens’s PEOPLE)', 'This is Sam'], scene: ['camera', 'phone'], cat: 'see', needs: ['camera'],
    go: { open: 'settings', panel: 'PRIVACY' }, tryText: 'Opens Settings, where it can be turned off', since: '2026-11-01',
  },
  'lens:shapes': {
    name: 'Draw a room in the air', line: 'You can draw a room in the air with one finger and I make it a blueprint with sizes, and the same room in 3-D.',
    more: 'Point to draw, pinch to finish, two fingers on a wall for a door. Say one real length, like “that wall is four metres”, and every size follows, to 5 cm. A sketch to measurements you gave, not a survey.',
    say: ['Draw a room with my hands', 'That wall is four metres', 'A bed here', 'North is left'], scene: ['camera', 'making'], cat: 'build', needs: ['camera'],
    since: '2026-11-01',
  },
  'phrase:shapes': {
    name: 'Draw with my hands', line: 'You can say "draw a room with my hands" and I open the Lens ready to trace it in the air, with no AI.',
    more: 'The camera starts when you tap START. Your hand is tracked on this phone only; the plan goes to the 3D studio and out as a picture or a measured list.',
    say: ['Draw a room with my hands', 'Sketch a plan in the air'], scene: ['talking', 'making'], cat: 'build',
    go: { ask: 'Draw a room with my hands', send: false }, since: '2026-11-01',
  },
  'app:tvmode': {
    name: 'Ghosty on your television', line: 'You can use me on a television: big buttons, a focus ring, and the arrow keys or a controller’s d-pad.',
    more: 'On by itself on a TV-shaped screen like the PS5’s browser, or from Settings. A or Enter presses, B or Escape goes back. Where the TV cannot draw 3-D, God’s eye is flat and I say what is hidden.',
    say: ['TV mode on', 'TV mode off'], scene: ['playing', 'behind'], cat: 'do',
    go: { open: 'settings', panel: 'THEME' }, tryText: 'Opens Settings, where TV mode is', since: '2026-11-01',
  },
  'phrase:tvmode': {
    name: 'Turn TV mode on', line: 'You can say "TV mode on" or "TV mode off" and the layout changes at once, with no AI.',
    more: 'TV mode makes every button big and lets the arrow keys or a controller move between them. It needs nothing from the phone: no camera, no tilt, no position.',
    say: ['TV mode on', 'TV mode off'], scene: ['talking', 'playing'], cat: 'do',
    go: { ask: 'TV mode on', send: false }, since: '2026-11-01',
  },
};
