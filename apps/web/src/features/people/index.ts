/**
 * PEOPLE (BRIEF-TABS 2; LIFE): the people pack's own screen, its sheet's two pages (features/people/sheet.ts): the people he has
 * told me about (birthdays, gift ideas, what he said) and the group plan. I only know what he tells me and never look anyone up.
 * "who's who" still opens the sheet from the chat.
 */
import type { TabDef } from '../../shell/tabs';
import { cardBig, cardLoad, cardNow } from '../../shell/cardline';
import { sheetPage } from '../../ui/sheetpage';

export const peopleTab: TabDef = {
  id: 'people',
  title: 'PEOPLE',
  icon: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19.5c.8-3.3 3.2-5 6-5s5.2 1.7 6 5"/><circle cx="17" cy="9.5" r="2.5"/><path d="M16.5 14.6c2.3.2 3.8 1.7 4.5 4.9"/>',
  scene: 'backdrop',
  blurb: 'the people you told me about · birthdays · gift ideas · a group plan',
  now: () => cardNow('people'),
  mount: (root) =>
    sheetPage(root, {
      screen: 'people',
      tag: 'LIFE // PEOPLE',
      sub: 'Only the people you tell me about, never looked up: birthdays, gift ideas and a plan for a group.',
      big: () => cardBig('people'),
      load: () => cardLoad('people'),
      sections: async () => {
        const m = await import('./sheet');
        const part = (what: 'who' | 'plan') => ({ title: m.PEOPLE_TITLES[what], pack: 'people', screen: what, build: () => m.peopleScreen(what) });
        return [
          { id: 'who', label: 'Your people', parts: [part('who')] },
          { id: 'plan', label: 'Group plan', parts: [part('plan')] },
        ];
      },
    }),
};
