/**
 * THE COMIC (FINAL ROUND, lane COMIC; MAKE): a comic app of its own. SHELF (his comics: imported files, public-domain ones and
 * the ones he made, read full screen with page turns, a guided panel-by-panel view, zoom and two pages on a wide screen), MAKE
 * (an idea becomes a whole comic he can change line by line, saved as CBZ or PDF) and LIBRARY (public-domain comics from the
 * Internet Archive, on his tap, on Wi-Fi, the size said). "make me a comic about…", "read a comic", "import a comic" and
 * "public domain comics" in the chat land here (features/comic/asks.ts). Everything stays on this phone.
 */
import type { TabDef } from '../../shell/tabs';
import { sheetPage } from '../../ui/sheetpage';
import { comicState } from './state';

export const COMIC_TITLES = { shelf: 'MY SHELF', make: 'MAKE A COMIC', library: 'PUBLIC-DOMAIN LIBRARY' } as const;

export const comicTab: TabDef = {
  id: 'comic',
  title: 'COMIC',
  icon: '<rect x="3" y="3.5" width="18" height="17" rx="2"/><path d="M3 11h9M12 3.5v17M12 14.5h9"/><path d="M15 6.5h3.5a1 1 0 011 1v1.6a1 1 0 01-1 1h-1.8l-1.7 1.4v-1.4h0a1 1 0 01-1-1V7.5a1 1 0 011-1z"/>',
  scene: 'backdrop',
  blurb: 'read your comics · make your own · public-domain library',
  now: () => (comicState.books ? `${comicState.books} comic${comicState.books === 1 ? '' : 's'} on the shelf` : ''),
  mount(root) {
    const w = window as unknown as { __ghosty?: Record<string, unknown> };
    if (w.__ghosty) w.__ghosty.comic = comicState;
    const inst = sheetPage(root, {
      screen: 'comic',
      tag: 'MAKE // COMIC',
      sub: 'Read your own comics and free public-domain ones, or make a whole comic from an idea. Everything stays on this phone.',
      big: () => (comicState.books ? `${comicState.books} on the shelf` : 'Your comics'),
      load: async () => (await import('./app')).countShelf(),
      name: 'Comic',
      also: () => (comicState.editing.id ? `editing “${comicState.editing.title.slice(0, 40)}”` : comicState.books ? `${comicState.books} comics on the shelf` : ''),
      sections: async () => {
        const m = await import('./app');
        return [
          { id: 'shelf', label: 'Shelf', parts: [{ title: COMIC_TITLES.shelf, screen: 'shelf', build: () => m.shelfPart() }] },
          { id: 'make', label: 'Make', parts: [{ title: COMIC_TITLES.make, screen: 'make', build: () => m.makePart() }] },
          { id: 'library', label: 'Library', parts: [{ title: COMIC_TITLES.library, screen: 'library', build: () => m.libraryPart() }] },
        ];
      },
    });
    return inst;
  },
};
