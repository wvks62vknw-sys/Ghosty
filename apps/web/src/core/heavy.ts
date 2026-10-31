/**
 * Heavy mode (docs/build-plan/SMALL-GAPS.md family G): while something big runs on the phone's own brain (a SCHOOL
 * paper being sat, school/sit.ts), the things that only look nice step aside so the page stays inside what iOS lets
 * one page hold: the GYM's worker pauses (features/gym) and Mind draws still frames (features/core/mind.ts). Both
 * carry on by themselves when it ends. `why` is the job, for a spec (window.__ghosty.heavy) and the console.
 */
import { createStore } from './store';

export const heavy = createStore({ on: false, why: '' });
