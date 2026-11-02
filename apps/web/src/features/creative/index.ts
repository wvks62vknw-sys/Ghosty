/**
 * CREATIVE (BRIEF-TABS 2; LIFE): the creative pack's own screen, its sheet's seven pages (features/creative/sheet.ts): a song played
 * by the phone, a poster, a birthday card, a comic strip, a logo sketch, a palette and the drum pads. Each is the sheet's own
 * page; the sound starts only on his tap and stops when its pill or the screen is left. Everything is saved to his own downloads
 * on his tap; nothing is sent anywhere. "make me a beat", "what should I draw?" still open the sheet from the chat.
 */
import type { TabDef } from '../../shell/tabs';
import { cardBig, cardLoad, cardNow } from '../../shell/cardline';
import { sheetPage } from '../../ui/sheetpage';

export const creativeTab: TabDef = {
  id: 'creative',
  title: 'CREATIVE',
  icon: '<path d="M12 3.5a8.5 8.5 0 100 17c1.2 0 1.8-.8 1.8-1.7 0-1.3-1.2-1.6-1.2-2.8 0-1 .8-1.7 1.8-1.7h2.1a4 4 0 004-4c0-3.9-3.8-6.8-8.5-6.8z"/><circle cx="7.8" cy="11" r="1.1"/><circle cx="10.5" cy="7.5" r="1.1"/><circle cx="15" cy="7.8" r="1.1"/>',
  scene: 'backdrop',
  blurb: 'a song · poster · birthday card · comic · logo · palette · drum pads',
  now: () => cardNow('creative'),
  mount: (root) =>
    sheetPage(root, {
      screen: 'creative',
      tag: 'LIFE // CREATIVE',
      sub: 'A song, a poster, a birthday card, a comic, a logo, a palette and drum pads, made on this phone.',
      big: () => cardBig('creative'),
      load: () => cardLoad('creative'),
      sections: async () => {
        const m = await import('./sheet');
        const part = (what: 'song' | 'poster' | 'birthday' | 'comic' | 'logo' | 'palette' | 'beat') => ({ title: m.CREATIVE_TITLES[what], pack: 'creative', screen: what, build: () => m.creativeScreen(what) });
        return [
          { id: 'music', label: 'Music', parts: [part('song'), part('beat')] },
          { id: 'poster', label: 'Poster', parts: [part('poster')] },
          { id: 'card', label: 'Card', parts: [part('birthday')] },
          { id: 'comic', label: 'Comic', parts: [part('comic')] },
          { id: 'logo', label: 'Logo', parts: [part('logo')] },
          { id: 'palette', label: 'Palette', parts: [part('palette')] },
        ];
      },
    }),
};
