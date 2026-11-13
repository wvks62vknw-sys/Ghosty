/**
 * BODY (BRIEF-TABS 2; LIFE): the body pack's own screen, a pill for each of its sheet's screens (features/body/sheet.ts): reps
 * counted by the camera's pose model, the running coach on the GPS, breathing, the stretch set, the Health export's week, and
 * the five trackers kept on this phone: water, sleep, steps, weight and mood (features/body/track.ts). Each is the sheet's own screen; the camera, the GPS and the timers start only on its START, and stop when its pill or
 * the screen is left, as when the sheet is closed. "count my squats", "start a run", "breathe" still open the sheet.
 */
import type { TabDef } from '../../shell/tabs';
import { cardBig, cardLoad, cardNow } from '../../shell/cardline';
import { sheetPage } from '../../ui/sheetpage';

export const bodyTab: TabDef = {
  id: 'body',
  title: 'BODY',
  icon: '<path d="M2.5 12.5h4l2.2-4.5 3.6 9 2.6-6 1.4 1.5h5.2"/>',
  scene: 'backdrop',
  blurb: 'water · sleep · steps · weight · mood · reps by camera · running coach · breathe · stretch · health',
  now: () => cardNow('body'),
  mount: (root) =>
    sheetPage(root, {
      screen: 'body',
      tag: 'LIFE // BODY',
      sub: 'Water, sleep, steps, weight and mood, kept on this phone; reps, a running coach, breathing, stretches and your Health week.',
      big: () => cardBig('body'),
      load: () => cardLoad('body'),
      sections: async () => {
        const m = await import('./sheet');
        const part = (what: import('./sheet').BodyWhat) => ({ title: m.BODY_TITLES[what], pack: 'body', screen: what, build: () => m.bodyScreen(what) });
        // (six pills at most, ui/sections.ts: each holds its rooms, drawn one under another)
        return [
          { id: 'water', label: 'Water', parts: [part('water')] },
          { id: 'sleep', label: 'Sleep', parts: [part('sleep')] },
          { id: 'move', label: 'Move', parts: [part('steps'), part('reps'), part('run')] },
          { id: 'mood', label: 'Mood', parts: [part('mood'), part('breathe'), part('stretch')] },
          { id: 'weight', label: 'Weight', parts: [part('weight')] },
          { id: 'health', label: 'Health', parts: [part('health')] },
        ];
      },
    }),
};
