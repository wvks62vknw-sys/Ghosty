/**
 * Interface sounds: tiny synthesized blips (no audio files), quiet enough to sit under the
 * radio. Off in Settings → VOICE & HOME. Browsers only allow sound after the first tap, so
 * nothing plays at boot.
 */
import { settings } from '../state/app';

/** `turn`: his turn to talk in a voice conversation (BRIEF-TALK-1A 4): the ear has just opened and can hear him.
 *  `lock`: the moment of recognition (ui/machine.ts `recognise`): the box snaps onto what he asked for, once.
 *  `click`: the same moment as one small click, when THE SOUND is set to click (BRIEF-THEMES-2). */
export type Sfx = 'tab' | 'open' | 'close' | 'tap' | 'ok' | 'turn' | 'lock' | 'click';

/** Whether the interface may make a sound now: his setting on and the phone already tapped (said on THE LOOK when not). */
export function sfxAllowed(): boolean {
  if (!settings.get().sounds) return false;
  const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  return !ua || ua.hasBeenActive;
}

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (!sfxAllowed()) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** One tone: frequency glide f0 → f1 over `dur` seconds, starting `at` seconds from now. */
function tone(a: AudioContext, f0: number, f1: number, dur: number, at = 0, vol = 0.035, type: OscillatorType = 'sine'): void {
  const t = a.currentTime + at;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/**
 * Play one of the set. `afterMs`: scheduled that far ahead on the audio clock (the moment of recognition plays as the box lands,
 * sample-exact however busy the page is); the checks' event goes at once.
 */
export function sfx(kind: Sfx, afterMs = 0): void {
  const a0 = audio();
  if (!a0) return;
  const after = Math.max(0, afterMs) / 1000;
  const a = after ? ({ get currentTime() { return a0.currentTime + after; }, createOscillator: () => a0.createOscillator(), createGain: () => a0.createGain(), destination: a0.destination } as unknown as AudioContext) : a0;
  if (kind === 'tab') {
    tone(a, 880, 1320, 0.07);
    tone(a, 1760, 2200, 0.05, 0.05, 0.018);
  } else if (kind === 'open') {
    tone(a, 220, 660, 0.22, 0, 0.03, 'triangle');
    tone(a, 1320, 1980, 0.08, 0.12, 0.02);
  } else if (kind === 'close') tone(a, 660, 260, 0.14, 0, 0.025, 'triangle');
  else if (kind === 'ok') {
    tone(a, 990, 990, 0.06);
    tone(a, 1480, 1480, 0.09, 0.07);
  } else if (kind === 'turn') {
    // two soft rising notes, a fifth apart, quieter than the rest: heard, never talked over
    tone(a, 587, 587, 0.07, 0, 0.022);
    tone(a, 880, 880, 0.11, 0.075, 0.018);
  } else if (kind === 'lock') {
    // the box closing on a thing: one short, level tone with a faint edge an octave up, gone in 90 ms
    tone(a, 1568, 1568, 0.09, 0, 0.03);
    tone(a, 3136, 3136, 0.035, 0, 0.01, 'triangle');
  } else if (kind === 'click') {
    // the lock as a click: a dry tick, shorter and lower than the tone, the box landing rather than ringing
    tone(a, 2400, 1800, 0.018, 0, 0.03, 'square');
  } else tone(a, 1500, 1200, 0.03, 0, 0.02);
  // (what played, for the checks that listen for it: tests/talk.spec.mjs)
  document.dispatchEvent(new CustomEvent('ghosty-sfx', { detail: kind }));
}
