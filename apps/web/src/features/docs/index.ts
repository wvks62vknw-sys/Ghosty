/**
 * DOCUMENTS (BRIEF-TABS 2; MAKE): the documents' own screen. Its page is the sheet's (docs/sheet.ts): MY DOCUMENTS kept on this
 * phone with their dates, NEW, OPEN A FILE (PDF, Word, EPUB, a web page, Markdown, text) read here with its contents and READ
 * IT TO ME; editing with the brain's edits as suggestions, translation side by side, letters by tables, exported as PDF, Word,
 * Markdown or HTML. "my documents" and a reply's laid-out card still open the sheet from the chat.
 */
import type { TabDef } from '../../shell/tabs';
import { cardBig, cardLoad, cardNow } from '../../shell/cardline';
import { sheetPage } from '../../ui/sheetpage';

export const docsTab: TabDef = {
  id: 'docs',
  title: 'DOCUMENTS',
  icon: '<path d="M6.5 3.5h8l3.5 3.5v13.5h-11.5z"/><path d="M14.5 3.5V7H18M9 11h6M9 14.5h6M9 18h4"/>',
  scene: 'backdrop',
  blurb: 'read · write · edit · translate · kept on this phone',
  now: () => cardNow('docs'),
  mount: (root) =>
    sheetPage(root, {
      screen: 'docs',
      tag: 'MAKE // DOCUMENTS',
      sub: 'Read, write, edit and translate documents, kept on this phone.',
      big: () => cardBig('docs'),
      load: () => cardLoad('docs'),
      sections: async () => {
        const m = await import('../../docs/sheet');
        return [{
          id: 'docs',
          label: 'Documents',
          parts: [{
            title: m.DOCS_TITLE,
            build: () => {
              const d = m.docsParts();
              void d.start({});
              return { el: d.el, stop: d.stop };
            },
          }],
        }];
      },
    }),
};
