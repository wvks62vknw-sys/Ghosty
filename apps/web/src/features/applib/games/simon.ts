/**
 * The SIMON board. Options (GameConfig.options): pads (3 to 6, default 4), speed (ms a pad lights, 250 to 900, default 520).
 * Watch the pads light, then tap them back in order. Each round adds one. A soft tone plays per pad when sound is allowed.
 */
import { h } from '../../../core/dom';
import * as S from '../../../../../../packages/shared/src/applib/games/simon';
import { num, rng } from '../../../../../../packages/shared/src/applib/games/rng';
import type { Board } from './frame';

const NOTES = [329.6, 392, 440, 523.3, 587.3, 659.3];

export const simon: Board = (p) => {
  const pads = num(p.opts, 'pads', 4, 3, 6);
  const speed = num(p.opts, 'speed', 520, 250, 900);
  const r = rng(p.seed());
  const s = S.start(pads, r);
  let showing = true;
  let timers: number[] = [];
  let audio: AudioContext | null = null;
  const tone = (i: number, ms: number) => {
    try {
      audio ??= new AudioContext();
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.frequency.value = NOTES[i]!;
      g.gain.setValueAtTime(0.08, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + ms / 1000);
      o.connect(g).connect(audio.destination);
      o.start();
      o.stop(audio.currentTime + ms / 1000);
    } catch {
      /* no sound: the pads still light */
    }
  };
  const els = Array.from({ length: pads }, (_, i) => {
    const el = h('div.al-gspad', { role: 'button', tabIndex: 0, dataset: { pad: String(i) }, 'aria-label': `Pad ${i + 1}` });
    el.addEventListener('pointerdown', () => tap(i));
    return el;
  });
  p.stage.append(h('div.al-gsimon', { style: `grid-template-columns: repeat(${pads <= 4 ? 2 : 3}, minmax(0, 1fr))` }, ...els));
  const flash = (i: number, ms: number) => {
    els[i]!.classList.add('al-glit');
    tone(i, ms);
    timers.push(window.setTimeout(() => els[i]!.classList.remove('al-glit'), ms * 0.8));
  };
  function show(): void {
    showing = true;
    p.score(S.rounds(s), 'Watch');
    const ms = S.flashMs(s, speed);
    s.seq.forEach((pad, k) => timers.push(window.setTimeout(() => flash(pad, ms), 600 + k * ms * 1.15)));
    timers.push(window.setTimeout(() => ((showing = false), p.score(S.rounds(s), 'Your turn')), 600 + s.seq.length * ms * 1.15));
  }
  function tap(i: number): void {
    if (showing || p.paused() || s.over) return;
    flash(i, 220);
    const res = S.tap(s, i, r);
    if (res === 'wrong') return p.end({ won: S.rounds(s) > 0, score: S.rounds(s), words: `${S.rounds(s)} rounds repeated.` });
    if (res === 'round') {
      p.score(S.rounds(s), 'Well remembered');
      show();
    }
  }
  p.onPause((paused) => {
    if (paused) {
      timers.forEach(clearTimeout);
      timers = [];
    } else {
      s.at = 0;
      show();
    }
  });
  show();
  return () => {
    timers.forEach(clearTimeout);
    void audio?.close();
  };
};
