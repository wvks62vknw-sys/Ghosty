/**
 * His mood on this phone (OWNER-ISSUES 70b, 63): a mirror of the brain's (apps/edge/src/mood.ts), from the status, from the
 * chat's `mood` event the moment a message moves it, and — for a stop, which is never sent as a message — from the same rule
 * the brain applies (packages/shared/src/mood.ts), so "shut up" or "stand down" shows here at once. It fades on its own time.
 */
import { lastSeen } from '../api/brain';
import { svgEl } from '../core/dom';
import { createStore } from '../core/store';
import { CALM, moodAfter, moodNow, type Mood, type MoodEvent, type MoodKind } from '../../../../packages/shared/src/mood';

export const mood = createStore({ now: CALM as Mood });

let fade = 0;
/**
 * The mood as it is now; a timer puts him back to calm when it fades (no poll needed). `fromStatus`: a status can have been
 * read before something newer happened here (a stop said a moment ago): it never puts back what came before it.
 */
export function setMood(m: Mood | null | undefined, opts: { fromStatus?: boolean } = {}): void {
  const now = moodNow(m);
  const was = mood.get().now;
  if (opts.fromStatus && (now.since || 0) < (was.since || 0)) return;
  clearTimeout(fade);
  if (now.kind !== 'calm') fade = window.setTimeout(() => setMood(CALM), Math.max(1000, now.until - Date.now()) + 500);
  if (was.kind !== now.kind || was.since !== now.since) mood.set({ now });
}

/** Something the phone saw happen (a stop): felt here as the brain feels it. */
export function feelHere(ev: MoodEvent): void {
  setMood(moodAfter(mood.get().now, ev));
}

/** Each mood's shape, so it reads without colour (SMALL-GAPS L): calm a circle, focused a square, protective a shield,
 * pleased a triangle up, subdued a triangle down, cross a bolt. */
const SHAPES: Record<MoodKind, string> = {
  calm: 'M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10z',
  focused: 'M7 7h10v10H7z',
  protective: 'M12 4l7 3v5c0 4-3 7-7 8c-4-1-7-4-7-8V7z',
  pleased: 'M12 6l7 12H5z',
  subdued: 'M5 7h14l-7 12z',
  cross: 'M13 3L6 13h5l-1 8l7-10h-5z',
};
export function moodShape(kind: MoodKind): SVGSVGElement {
  const s = svgEl('svg', { viewBox: '0 0 24 24', class: 'ic moodshape', 'aria-hidden': 'true' });
  s.append(svgEl('path', { d: SHAPES[kind] }));
  return s;
}

// every status the phone is given (Home, the Me sheet, the two-minute check) carries the brain's mood
lastSeen.subscribe((s) => s.status && setMood(s.status.mood, { fromStatus: true }));
