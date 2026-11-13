/**
 * PRESENTATIONS (BRIEF-EDITOR-PRESENTATIONS; MAKE): the core of PowerPoint on the phone. Its page is the sheet's (slides/sheet.ts): MY SLIDES
 * kept on this phone, a deck made from a report or opened from a .pptx, a film of slides, each edited in a line above it, a picture, a chart
 * from typed numbers, a table, shapes, notes, themes, a talk with the notes in his hand, a .pptx, a PDF and a PNG out. "my slides" and the
 * Stage's MAKE SLIDES OF IT open it from the chat.
 */
import type { TabDef } from '../../shell/tabs';
import { cardBig, cardLoad, cardNow } from '../../shell/cardline';
import { sheetPage } from '../../ui/sheetpage';

export const slidesTab: TabDef = {
  id: 'slides',
  title: 'PRESENTATIONS',
  icon: '<rect x="3.5" y="5" width="17" height="11" rx="1.5"/><path d="M12 16v3.5M8.5 19.5h7M7.5 9h5M7.5 12h8"/>',
  scene: 'backdrop',
  blurb: 'slides · notes · a talk · PowerPoint in and out · kept on this phone',
  now: () => cardNow('slides'),
  mount: (root) => {
    const page = sheetPage(root, {
      screen: 'slides',
      tag: 'MAKE // PRESENTATIONS',
      sub: 'Slides from a report or from scratch, with your notes in your hand.',
      big: () => cardBig('slides'),
      load: () => cardLoad('slides'),
      sections: async () => {
        const m = await import('../../slides/sheet');
        return [{
          id: 'slides',
          label: 'Presentations',
          parts: [{
            title: m.SLIDES_TITLE,
            build: () => {
              // (the line over the page says how many decks are kept: it is read again when that changes)
              const d = m.slidesParts({ onChange: () => page.repaint() });
              void d.start({});
              return { el: d.el, stop: d.stop };
            },
          }],
        }];
      },
    });
    return page;
  },
};
