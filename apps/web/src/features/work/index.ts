/**
 * WORK (BRIEF-TABS 2; LIFE): the work pack's own screen, its sheet's three pages (features/work/sheet.ts): the to-do list ticked
 * here and kept in my brain, interview practice (each question asked aloud, the answer timed, a plain critique back) and the
 * last document I wrote for him (a CV, a cover letter, an email), as text to copy or share: nothing is sent for him.
 * "interview practice" and a written document still open the sheet from the chat.
 */
import type { TabDef } from '../../shell/tabs';
import { cardBig, cardLoad, cardNow } from '../../shell/cardline';
import { sheetPage } from '../../ui/sheetpage';

export const workTab: TabDef = {
  id: 'work',
  title: 'WORK',
  icon: '<rect x="3" y="7.5" width="18" height="12" rx="2.5"/><path d="M8.5 7.5V5.5A1.5 1.5 0 0110 4h4a1.5 1.5 0 011.5 1.5v2M3 12.5h18"/>',
  scene: 'backdrop',
  blurb: 'to-do list · interview practice · your documents library, kept with versions',
  now: () => cardNow('work'),
  mount: (root) =>
    sheetPage(root, {
      screen: 'work',
      tag: 'LIFE // WORK',
      sub: 'Your to-do list, interview practice and the documents I write for you.',
      big: () => cardBig('work'),
      load: () => cardLoad('work'),
      sections: async () => {
        const m = await import('./sheet');
        return [
          { id: 'todo', label: 'To-do', parts: [{ title: m.WORK_TITLES.todo, pack: 'work', screen: 'todo', build: () => m.workScreen('todo') }] },
          { id: 'interview', label: 'Interview', parts: [{ title: m.WORK_TITLES.interview, pack: 'work', screen: 'interview', build: () => m.workScreen('interview') }] },
          {
            id: 'doc',
            label: 'Document',
            parts: [{
              title: m.WORK_TITLES.doc,
              pack: 'work',
              screen: 'doc',
              // [moneynext] every document I wrote for him, kept on this phone with its versions (features/work/library.ts)
              build: () => m.libraryScreen(),
            }],
          },
        ];
      },
    }),
};
