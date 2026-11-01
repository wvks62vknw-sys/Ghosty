/**
 * TV MODE's setting and the screen's facts (BRIEF-REST-C part 3): SETTINGS → THEME → TV MODE (AUTO until he flips it:
 * on by itself on a television, tv/detect.ts), kept on this device. Small on purpose: the boot cinematic reads it before
 * anything else is up (shell/boot.ts plays the short cut on a television).
 */
import { createStore } from '../core/store';
import { tvWanted, type ScreenFacts, type TvSetting } from './detect';

export const tvSetting = createStore({ mode: 'auto' as TvSetting }, { persist: 'ghosty.tv' });

/** This screen, now. */
export function screenFacts(): ScreenFacts {
  const mm = (q: string) => typeof matchMedia === 'function' && matchMedia(q).matches;
  return { w: innerWidth, h: innerHeight, pointer: mm('(pointer: fine)') ? 'fine' : mm('(pointer: coarse)') ? 'coarse' : 'none', touch: navigator.maxTouchPoints || 0, agent: navigator.userAgent };
}

/** Is TV mode on now (his setting, else the screen's shape)? */
export const tvNow = (): boolean => tvWanted(tvSetting.get().mode, screenFacts());
