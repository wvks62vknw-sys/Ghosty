/**
 * LEARNING (BRIEF-TABS 2; LEARN): the learning pack's own screen, its sheet's twelve pages (features/learning/sheet.ts) under six
 * pills: words in eight languages and the cards to review; drawing and handwriting; typing and fast reading; the drills (memory,
 * maths, spelling); first aid; the plan and the streaks. Each is the sheet's own page, with its own timers and voices stopped
 * when it is left. "ten words in Spanish", "typing test" (the coach's), "first aid for a burn" still open the sheets from the chat.
 */
import type { TabDef } from '../../shell/tabs';
import { cardBig, cardLoad, cardNow } from '../../shell/cardline';
import { sheetPage } from '../../ui/sheetpage';

export const learningTab: TabDef = {
  id: 'learning',
  title: 'LEARNING',
  icon: '<path d="M4.5 19.5V6A2 2 0 016.5 4H19v13H6.5a2 2 0 00-2 2.5z"/><path d="M6.5 19.5H19M8.5 8h7M8.5 11.5h5"/>',
  scene: 'backdrop',
  blurb: 'words · cards · drawing · typing · reading · memory · maths · first aid · streaks',
  now: () => cardNow('learning'),
  mount: (root) =>
    sheetPage(root, {
      screen: 'learning',
      tag: 'LEARN // LEARNING',
      sub: 'Words in eight languages, cards, drawing, typing, handwriting, fast reading, memory, maths, spelling, first aid, a plan and your streaks.',
      big: () => cardBig('learning'),
      load: () => cardLoad('learning'),
      sections: async () => {
        const m = await import('./sheet');
        type V = (typeof m.LEARN_VIEWS)[number]['id'];
        const part = (id: V) => ({ title: (m.LEARN_VIEWS.find((v) => v.id === id)?.label ?? id).toUpperCase(), pack: 'learning', screen: id, build: () => m.learningView(id) });
        return [
          { id: 'words', label: 'Words', parts: [part('words'), part('review')] },
          { id: 'draw', label: 'Draw', parts: [part('draw'), part('hand')] },
          { id: 'typing', label: 'Typing', parts: [part('typing'), part('readfast')] },
          { id: 'drills', label: 'Drills', parts: [part('memory'), part('maths'), part('spelling')] },
          { id: 'firstaid', label: 'First aid', parts: [part('firstaid')] },
          { id: 'plan', label: 'Plan', parts: [part('plan'), part('progress')] },
        ];
      },
    }),
};
