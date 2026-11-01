/**
 * WORK (BRIEF-TABS 2; LIFE): the work pack's own screen, its sheet's three pages (features/work/sheet.ts): the to-do list ticked
 * here and kept in my brain, interview practice (each question asked aloud, the answer timed, a plain critique back) and the
 * last document I wrote for him (a CV, a cover letter, an email), as text to copy or share: nothing is sent for him.
 * "interview practice" and a written document still open the sheet from the chat.
 */
import { h } from '../../core/dom';
import type { TabDef } from '../../shell/tabs';
import { cardBig, cardLoad, cardNow } from '../../shell/cardline';
import { sheetPage } from '../../ui/sheetpage';

export const workTab: TabDef = {
  id: 'work',
  title: 'WORK',
  icon: '<rect x="3" y="7.5" width="18" height="12" rx="2.5"/><path d="M8.5 7.5V5.5A1.5 1.5 0 0110 4h4a1.5 1.5 0 011.5 1.5v2M3 12.5h18"/>',
  scene: 'backdrop',
  blurb: 'to-do list · interview practice · documents to copy or share',
  now: () => cardNow('work'),
  mount: (root) =>
    sheetPage(root, {
      screen: 'work',
      tag: 'LIFE // WORK',
      sub: 'Your to-do list, interview practice out loud, and the documents I write for you to copy or share.',
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
              // the last one I wrote on this visit, as its sheet showed it; none yet: where one comes from
              build: () => (m.workState.doc.text ? m.workScreen('doc', { title: m.workState.doc.title, text: m.workState.doc.text }) : { el: h('p.pknote', 'Nothing written yet. Ask me in the chat for a CV, a cover letter, an email or a meeting summary: it shows here as text for you to copy or share. Nothing is sent for you.') }),
            }],
          },
        ];
      },
    }),
};
