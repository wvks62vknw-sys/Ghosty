/**
 * PAINT (APPS ROUND, lane COMIC; MAKE): a real painting app. Pressure and tilt with an Apple Pencil, smoothing for a finger,
 * six brushes, layers with blend modes, masks, alpha lock and a reference layer, selection, move and turn, liquify, symmetry,
 * QuickShape, undo and redo, a time-lapse saved as a video, PNG, JPEG, layered PSD and OpenRaster files, and colouring pages
 * from open line art or his own photos. "open paint", "I want to draw" and "colouring page" in the chat land here.
 * Everything stays on this phone.
 */
import type { TabDef } from '../../shell/tabs';
import { sheetPage } from '../../ui/sheetpage';
import { paintState } from './state';

export const PAINT_TITLES = { gallery: 'MY PAINTINGS', colouring: 'COLOURING PAGES', settings: 'PAINT SETTINGS' } as const;

export const paintTab: TabDef = {
  id: 'paint',
  title: 'PAINT',
  icon: '<path d="M18.5 3.5a2.1 2.1 0 013 3L12 16l-4 1 1-4z"/><path d="M7 17c-2 0-3 1.4-3 3.5h0c2 0 4.5-.6 4.5-2.6"/>',
  scene: 'backdrop',
  blurb: 'draw and paint · layers · time-lapse · colouring pages',
  now: () => (paintState.count ? `${paintState.count} painting${paintState.count === 1 ? '' : 's'}` : ''),
  mount(root) {
    const w = window as unknown as { __ghosty?: Record<string, unknown> };
    if (w.__ghosty) w.__ghosty.paint = paintState;
    return sheetPage(root, {
      screen: 'paint',
      tag: 'MAKE // PAINT',
      sub: 'Draw and paint with a finger or an Apple Pencil: real brushes, layers, a time-lapse of every stroke. Everything stays on this phone.',
      big: () => (paintState.count ? `${paintState.count} in the gallery` : 'Your paintings'),
      load: async () => (await import('./app')).countGallery(),
      name: 'Paint',
      also: () => (paintState.open ? `painting “${paintState.title.slice(0, 40)}”` : paintState.count ? `${paintState.count} paintings in the gallery` : ''),
      sections: async () => {
        const m = await import('./app');
        return [
          { id: 'gallery', label: 'Gallery', parts: [{ title: PAINT_TITLES.gallery, screen: 'gallery', build: () => m.galleryPart() }] },
          { id: 'colouring', label: 'Colouring', parts: [{ title: PAINT_TITLES.colouring, screen: 'colouring', build: () => m.colouringPart() }] },
          { id: 'settings', label: 'Settings', parts: [{ title: PAINT_TITLES.settings, screen: 'settings', build: () => m.settingsPart() }] },
        ];
      },
    });
  },
};
