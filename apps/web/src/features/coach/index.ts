/**
 * COACH (BRIEF-TABS 2; LEARN): the coach's own screen, a pill for each of its sheet's pages (coach/sheet.ts): the tuner (the
 * microphone, pitch worked out in code), ten lessons each for guitar, piano and voice with a metronome of our own, typing, a
 * drawing a day and ten words a day said back. The microphone starts only on START and stops when its pill or the screen is left;
 * nothing leaves the phone and nothing is recorded to keep. "teach me guitar", "typing test" still open the sheet from the chat.
 */
import type { TabDef } from '../../shell/tabs';
import { cardBig, cardLoad, cardNow } from '../../shell/cardline';
import { sheetPage } from '../../ui/sheetpage';

export const coachTab: TabDef = {
  id: 'coach',
  title: 'COACH',
  icon: '<path d="M8 20.5h8l-2.6-16h-2.8z"/><path d="M12 15.5l4.8-8.5M9.2 17.5h5.6"/>',
  scene: 'backdrop',
  blurb: 'tuner · guitar, piano and voice lessons · typing · a drawing a day · words',
  now: () => cardNow('coach'),
  mount(root) {
    const inst = sheetPage(root, {
      screen: 'coach',
      tag: 'LEARN // COACH',
      sub: 'A tuner, ten lessons each for guitar, piano and voice, typing, a drawing a day and words, heard by this phone and kept on it.',
      big: () => cardBig('coach'),
      load: () => cardLoad('coach'),
      sections: async () => {
        const m = await import('../../coach/sheet');
        // (a practice kept lights the streak at the top, as the sheet's line does)
        // (the words of the day are a table written in: said in one plain line on that page)
        const line = (id: string) => (id === 'words' ? { line: 'The words of the day are a starter set, typed in by hand: forty in each of four languages, ten a day, round again every four days. Not a dictionary yet.' } : {});
        return m.COACH_TABS.map((t) => ({ id: t.id, label: t.label.charAt(0) + t.label.slice(1).toLowerCase(), parts: [{ title: t.label, pack: 'coach', screen: t.id, ...line(t.id), build: () => m.coachScreen(t.id, {}, () => void cardLoad('coach').then(inst.repaint)) }] }));
      },
    });
    return inst;
  },
};
