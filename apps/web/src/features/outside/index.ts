/**
 * OUTSIDE (BRIEF-TABS 2; LIFE): the outside pack's own screen, a pill for each of its sheet's pages (features/outside/sheet.ts):
 * a safer walk scored against police street reports, what is near (car parks, toilets, cash, water, what is open), where he
 * parked, the way when he is lost, and a fare split. The phone's position is asked only when he taps USE WHERE I AM NOW, sent
 * once with that one question and kept nowhere here. "toilets near me", "I'm lost" still open the sheet from the chat.
 */
import type { TabDef } from '../../shell/tabs';
import { cardBig, cardLoad, cardNow } from '../../shell/cardline';
import { sheetPage } from '../../ui/sheetpage';

export const outsideTab: TabDef = {
  id: 'outside',
  title: 'OUTSIDE',
  icon: '<path d="M12 21V3.5M12 5h6.5l2 2-2 2H12M12 11.5H5.5l-2 2 2 2H12"/>',
  scene: 'backdrop',
  blurb: 'a safer walk · what is near · my car · lost · split a fare',
  now: () => cardNow('outside'),
  mount: (root) =>
    sheetPage(root, {
      screen: 'outside',
      tag: 'LIFE // OUTSIDE',
      sub: 'A safer walk, what is near, your car, the way when lost, a fare split.',
      big: () => cardBig('outside'),
      load: () => cardLoad('outside'),
      sections: async () => {
        const m = await import('./sheet');
        return m.OUTSIDE_VIEWS.map((v) => ({ id: v.id, label: v.label, parts: [{ title: v.label.toUpperCase(), pack: 'outside', screen: v.id, build: () => ({ el: m.outsideView(v.id) }) }] }));
      },
    }),
};
