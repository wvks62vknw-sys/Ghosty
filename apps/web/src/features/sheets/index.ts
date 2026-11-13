/**
 * SPREADSHEETS (BRIEF-EDITOR-SPREADSHEETS; MAKE): the core of Excel on the phone. Its page is the sheet's (sheets/sheet.ts): MY SPREADSHEETS kept on
 * this phone, a grid with a formula line, formulas worked out by the app's own engine, formats, sort and filter, a chart from a range, several
 * sheets, an .xlsx or CSV opened and made, a PDF; "my spreadsheets" and a table in an answer (the Stage's OPEN) open the sheet from the chat.
 */
import type { TabDef } from '../../shell/tabs';
import { cardBig, cardLoad, cardNow } from '../../shell/cardline';
import { sheetPage } from '../../ui/sheetpage';

export const sheetsTab: TabDef = {
  id: 'sheets',
  title: 'SPREADSHEETS',
  icon: '<rect x="4" y="4.5" width="16" height="15" rx="1.5"/><path d="M4 9.5h16M4 14.5h16M9.5 4.5v15M15 4.5v15"/>',
  scene: 'backdrop',
  blurb: 'formulas · charts · Excel in and out · kept on this phone',
  now: () => cardNow('sheets'),
  mount: (root) =>
    sheetPage(root, {
      screen: 'sheets',
      tag: 'MAKE // SPREADSHEETS',
      sub: 'Budgets and lists with formulas that follow, kept on this phone.',
      big: () => cardBig('sheets'),
      load: () => cardLoad('sheets'),
      sections: async () => {
        const m = await import('../../sheets/sheet');
        return [{
          id: 'sheets',
          label: 'Spreadsheets',
          parts: [{
            title: m.SHEETS_TITLE,
            build: () => {
              const d = m.sheetsParts();
              void d.start({});
              return { el: d.el, stop: d.stop };
            },
          }],
        }];
      },
    }),
};
