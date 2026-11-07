/**
 * THE READER as a screen of its own (`screen:reader`; BRIEF-LIBRARY-READER 1): a book from the Library's Shelf, read here or
 * aloud, its place kept. It lives inside the Library (Learn → Library → the book: two taps; "read" or a title in the jump bar:
 * one word), so the Every screen deck shows the Library's card, whose lines lead here. The screen itself is drawn in
 * features/library/reader.ts; its four sections are named here, where the catalogue reads every screen's panels and pills.
 */
import type { TabDef } from '../../shell/tabs';
import { panel } from '../../ui/components';
import { sections } from '../../ui/sections';
import { mountReader, READER_ICON, readerNow, readerShell } from '../library/reader';

export const readerTab: TabDef = {
  id: 'reader',
  title: 'READER',
  icon: READER_ICON,
  scene: 'backdrop',
  inside: 'library',
  blurb: 'your books, read here or aloud · your place kept',
  now: readerNow,
  mount(root) {
    const P = {
      read: panel('READ', { grow: false }),
      chapters: panel('CHAPTERS', { grow: false }),
      search: panel('SEARCH', { grow: false }),
      about: panel('ABOUT', { grow: false }),
    };
    const shell = readerShell(root, P);
    const secs = sections(root, 'reader', [
      { id: 'read', label: 'Read', match: /^READ$/ },
      { id: 'chapters', label: 'Chapters', match: /^CHAPTERS/ },
      { id: 'search', label: 'Search', match: /^SEARCH/ },
      { id: 'about', label: 'About', match: /^ABOUT/ },
    ]);
    return mountReader(shell, P, secs);
  },
};
