/**
 * HOME (BRIEF-TABS 2; LIFE): the home pack's own screen, a pill for each of its sheet's pages (features/homeadmin/sheet.ts): what
 * is due at home in date order, the bin days, the bills (photographed or pasted, read on this phone), a meter's reading and each
 * room's things, all kept in my brain. "when are the bins?" still opens the same pages in the sheet from the chat.
 */
import type { TabDef } from '../../shell/tabs';
import { cardBig, cardLoad, cardNow } from '../../shell/cardline';
import { sheetPage } from '../../ui/sheetpage';

export const homeadminTab: TabDef = {
  id: 'homeadmin',
  title: 'HOME',
  icon: '<rect x="5" y="4.5" width="14" height="16.5" rx="2.5"/><path d="M9 4.5V3h6v1.5M8.5 12l2.2 2.2 4.5-4.5M8.5 17.5h7"/>',
  scene: 'backdrop',
  blurb: 'what is due · bin days · bills · the meter · rooms',
  now: () => cardNow('homeadmin'),
  mount: (root) =>
    sheetPage(root, {
      screen: 'homeadmin',
      name: 'Home admin',
      tag: 'LIFE // HOME',
      sub: 'What is due at home, bins, bills, the meter and your rooms.',
      big: () => cardBig('homeadmin'),
      load: () => cardLoad('homeadmin'),
      sections: async () => {
        const m = await import('./sheet');
        return m.HOME_VIEWS.map((v) => ({ id: v.id, label: v.label, parts: [{ title: v.label.toUpperCase(), pack: 'homeadmin', screen: v.id, build: () => ({ el: m.homeView(v.id) }) }] }));
      },
    }),
};
