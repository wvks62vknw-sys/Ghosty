/**
 * HOUSE (BRIEF-TABS 2; MAKE): the house's own screen. Its page is the sheet's (house/sheet.ts): his house as Home Assistant has
 * it, room by room, each thing a card in plain words with its control, read fresh when the screen comes on. A lock, an alarm, a
 * garage door or gate, or a switch he marked "needs my word" asks his confirm on every tap; nothing here acts on a schedule.
 * Unlinked, the steps to link it. LINKS → HOME ASSISTANT and the chat's "the house" still open the sheet.
 */
import type { TabDef } from '../../shell/tabs';
import { cardBig, cardLoad, cardNow } from '../../shell/cardline';
import { sheetPage } from '../../ui/sheetpage';

export const houseTab: TabDef = {
  id: 'house',
  title: 'HOUSE',
  icon: '<path d="M3.5 11.5L12 4.5l8.5 7"/><path d="M5.5 10v10h13V10"/><path d="M9.5 16a3.5 3.5 0 015 0M11.2 17.8a1.2 1.2 0 011.6 0"/>',
  scene: 'backdrop',
  blurb: 'lights · heating · blinds · the TV, through your own Home Assistant',
  now: () => cardNow('house'),
  mount: (root) =>
    sheetPage(root, {
      screen: 'house',
      tag: 'MAKE // HOUSE',
      sub: 'Your house as Home Assistant has it, room by room. Locks, alarms, gates and garage doors ask your confirm every time.',
      big: () => cardBig('house'),
      load: () => cardLoad('house'),
      // the rooms on screen (Home Assistant's areas, by their own names): how many, and the first few
      also: () => {
        const rooms = [...document.querySelectorAll<HTMLElement>('#pg-house .houseroom')].map((r) => r.getAttribute('aria-label') ?? '').filter(Boolean);
        return rooms.length ? `${rooms.length} ${rooms.length === 1 ? 'room' : 'rooms'}: ${rooms.slice(0, 3).join(', ')}` : 'no rooms yet';
      },
      sections: async () => {
        const m = await import('../../house/sheet');
        return [{ id: 'house', label: 'House', parts: [{ title: m.HOUSE_TITLE, build: m.houseScreen }] }];
      },
    }),
};
