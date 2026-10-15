/**
 * Interface sounds: tiny synthesized blips (no audio files), quiet enough to sit under the
 * radio. Off in System → Look & Voice. Browsers only allow sound after the first tap, so
 * nothing plays at boot.
 */
import { settings } from '../state/app';

export type Sfx = 'tab' | 'open' | 'close' | 'tap' | 'ok';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (!settings.get().sounds) return null;
  const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  if (ua && !ua.hasBeenActive) return null;
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

export function sfx(kind: Sfx): void {
  const a = audio();
  if (!a) return;
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
  } else tone(a, 1500, 1200, 0.03, 0, 0.02);
}
