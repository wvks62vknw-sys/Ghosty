/**
 * FILES (THE APPS ROUND, lane BOOT; ME): one place for everything Ghosty keeps (features/files/app.ts). BROWSE (everything, searched by name,
 * tag and the words inside, by kind and folder, sorted; IMPORT; SELECT for ZIP), RECENTS, FAVOURITES, DELETED (30 days, RESTORE) and STORAGE.
 * "open files", "my files", "recently deleted" and "storage" reach it. Everything stays on this phone.
 */
import type { TabDef } from '../../shell/tabs';
import { sheetPage } from '../../ui/sheetpage';
import { filesState } from './state';
import { SUB } from './words';

export const FILES_TITLES = { browse: 'EVERYTHING', recents: 'RECENTS', favourites: 'FAVOURITES', bin: 'RECENTLY DELETED', storage: 'STORAGE' } as const;
const sizeShort = (n: number) => (n < 1_000_000 ? `${Math.max(1, Math.round(n / 1000))} KB` : `${(n / 1_000_000).toFixed(1)} MB`);

export const filesTab: TabDef = {
  id: 'files',
  title: 'FILES',
  icon: '<path d="M3 7.5a2 2 0 012-2h4.2l2 2.2H19a2 2 0 012 2V17a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M3 10.5h18"/>',
  scene: 'backdrop',
  blurb: 'everything you keep · search · folders',
  now: () => (filesState.loaded && filesState.count ? `${filesState.count} things · ${sizeShort(filesState.bytes)}` : ''),
  mount(root) {
    const w = window as unknown as { __ghosty?: Record<string, unknown> };
    void import('./app').then((m) => {
      if (w.__ghosty) w.__ghosty.files = m.filesApi;
    });
    return sheetPage(root, {
      screen: 'files',
      tag: 'ME // FILES',
      sub: SUB,
      big: () => (filesState.loaded ? `${filesState.count} ${filesState.count === 1 ? 'thing' : 'things'}` : 'Your files'),
      load: async () => (await import('./app')).countFiles(),
      name: 'Files',
      also: () => (filesState.loaded && filesState.count ? `${filesState.count} things, ${sizeShort(filesState.bytes)}` : ''),
      sections: async () => {
        const m = await import('./app');
        return [
          { id: 'browse', label: 'Browse', parts: [{ title: FILES_TITLES.browse, screen: 'browse', build: () => m.browsePart() }] },
          { id: 'recents', label: 'Recents', parts: [{ title: FILES_TITLES.recents, screen: 'recents', build: () => m.recentsPart() }, { title: FILES_TITLES.favourites, screen: 'favourites', build: () => m.favouritesPart() }] },
          { id: 'deleted', label: 'Deleted', parts: [{ title: FILES_TITLES.bin, screen: 'bin', build: () => m.binPart() }] },
          { id: 'storage', label: 'Storage', parts: [{ title: FILES_TITLES.storage, screen: 'storage', build: () => m.storagePart() }] },
        ];
      },
    });
  },
};
