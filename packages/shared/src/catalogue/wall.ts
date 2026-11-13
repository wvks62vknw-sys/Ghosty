/**
 * The catalogue's words for THE WALL (BRIEF-MACHINE-WALL): the panel in Settings that pairs a television or a laptop as the phone's second
 * screen, and the chat words that send it a picture. Joined into APP_WORDS in app.ts.
 */
import type { CatValue } from '../catalogue';

const SINCE = '2026-11-11';

export const WALL_WORDS: Record<string, CatValue> = {
  'panel:settings:THE WALL': {
    name: 'The wall as a second screen',
    line: 'You can make a television or a laptop a second screen, and it shows what we are talking about while you talk on the phone.',
    more: 'Open Ghosty on that screen with ?wall=1 at the end of its address and it shows a six-letter code. Type it in THE WALL, or say “pair the wall” and the code. Then tap WALL on a picture, or say “on the wall” after any ask, and “clear the wall” to rest it. It shows pictures and the one sentence they answer: never the camera, a face, where you are, what you spend or anyone’s messages. Hold anywhere on the wall for a second to unpair it.',
    say: ['Pair the wall', 'Where is Lisbon, on the wall', 'Clear the wall'],
    scene: ['phone', 'out'],
    cat: 'see',
    since: SINCE,
  },
};
