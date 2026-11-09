/**
 * The catalogue's words for AWARENESS (BRIEF-AWARENESS PR A): the chat's "that one", which acts on what is selected on the
 * screen. Joined into APP_WORDS in app.ts.
 */
import type { CatValue } from '../catalogue';

export const AWARENESS_WORDS: Record<string, CatValue> = {
  'phrase:thatone': {
    name: 'Say “that one”',
    line: 'You can point at something on the screen and say “that one”: I know which you mean, and do it.',
    more: 'On the room plan, tap a wall and say “make that wall longer” or “add a wardrobe there”. In the car, tap a part and say “find me a replacement”. In the reader, “read that one”; in the Lens, tap a tag and say “what is that”. It works here with no AI; anything else I answer knowing what is on your screen.',
    say: ['Make that wall longer', 'Add a wardrobe there', 'Find me a replacement', 'What is that?'], scene: ['talking'], cat: 'talk', since: '2026-11-07',
  },
  'phrase:roomnumber': {
    name: 'Say a number',
    line: 'I open any thing in a room by its number: say “open two” and I open the second one there.',
    more: 'In a room (Learn, Plan, Life …) “open two” is that room’s second thing. Anywhere else it is the second of your starred and recent screens, and “open learn five” is the fifth thing in Learn. The numbers are on the house’s plan, on each room and in Every screen.',
    say: ['Open two', 'Open learn five'], scene: ['talking'], cat: 'talk', since: '2026-11-08',
  },
};
