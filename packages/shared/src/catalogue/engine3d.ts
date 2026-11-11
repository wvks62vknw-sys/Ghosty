/**
 * The catalogue's words for the 3-D ENGINE (BRIEF-ENGINE-3D-1): the 3D STUDIO's pane (apps/web/src/features/studio/
 * samples.ts, the engine in apps/web/src/engine3d). Every size in it is a first estimate, never certified; a free model is fetched
 * only on his tap on Wi-Fi with its size said. Joined into APP_WORDS in app.ts.
 */
import type { CatValue } from '../catalogue';

const SINCE = '2026-11-10';

export const ENGINE3D_WORDS: Record<string, CatValue> = {
  'studio:pane:engine': {
    name: 'The 3-D engine',
    line: 'You can tap a shape or a piece of furniture, tap the ground to put it there, then drag its handles to move, turn and size it.',
    more: 'One finger turns the view, two fingers pinch and slide it. The library has the parametric set and a shelf of free models from Objaverse (CC0 or CC BY 4.0, each listed with its licence, its author and its download size): a model is fetched only when you tap GET, and only on Wi-Fi. Save a scene, open it again, and export it to a glTF file. Every size is a first estimate, never certified.',
    say: ['Show me a room 4 by 3 with a desk', 'Show me a desk 140 by 70'],
    scene: ['making'], cat: 'build',
    since: SINCE,
  },
};
