/**
 * CONVERT (BRIEF-TABS 2; MAKE): the converter's own screen. Its page is the sheet's (convert/sheet.ts): choose or drop a file (or
 * several), see what it is and its size, pick a conversion, done on this phone with SAVE and SHARE; and the tools that need no
 * file (a QR code, units, money at a rate, base64, Unix time, a pasted table, a recording). Nothing is uploaded anywhere.
 * A file dropped on the chat and "convert this to PDF" still open the sheet.
 */
import type { TabDef } from '../../shell/tabs';
import { cardBig, cardLoad, cardNow } from '../../shell/cardline';
import { sheetPage } from '../../ui/sheetpage';

export const convertTab: TabDef = {
  id: 'convert',
  title: 'CONVERT',
  icon: '<path d="M4 7.5h12.5l-3-3M20 16.5H7.5l3 3"/>',
  scene: 'backdrop',
  blurb: 'pictures · PDFs · Word · tables · sound · QR codes, on this phone',
  now: () => cardNow('convert'),
  mount: (root) =>
    sheetPage(root, {
      screen: 'convert',
      tag: 'MAKE // CONVERT',
      sub: 'Pictures, PDFs, Word files, tables and sound into other formats on this phone. Nothing is uploaded.',
      big: () => cardBig('convert'),
      load: () => cardLoad('convert'),
      sections: async () => {
        const m = await import('../../convert/sheet');
        return [{
          id: 'convert',
          label: 'Convert',
          parts: [{
            title: m.CONVERT_TITLE,
            build: () => {
              const c = m.convertParts();
              void c.start([], {});
              return { el: c.el, stop: c.stop };
            },
          }],
        }];
      },
    }),
};
