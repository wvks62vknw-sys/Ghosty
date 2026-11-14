/**
 * The REACTION board. Options (GameConfig.options): rounds (3 to 10, default 5), minMs (default 1200), maxMs (default 4000).
 * Tap the panel when it changes. A tap too soon is an early start and the round is taken again. Lower is better.
 */
import { h, clear } from '../../../core/dom';
import * as R from '../../../../../../packages/shared/src/applib/games/reaction';
import { num, rng } from '../../../../../../packages/shared/src/applib/games/rng';
import type { Board } from './frame';

export const reaction: Board = (p) => {
  const rounds = num(p.opts, 'rounds', 5, 3, 10);
  const minMs = num(p.opts, 'minMs', 1200, 500, 5000);
  const maxMs = num(p.opts, 'maxMs', 4000, minMs, 8000);
  const r = rng(p.seed());
  const times: number[] = [];
  let phase: 'ready' | 'wait' | 'go' = 'ready';
  let goAt = 0;
  let timer = 0;
  const panel = h('div.al-greact', { role: 'button', tabIndex: 0, 'aria-label': 'The reaction panel' });
  p.stage.append(panel);
  const say = (big: string, small: string) => clear(panel, h('b', big), h('small', small));
  function arm(): void {
    phase = 'wait';
    panel.dataset.phase = 'wait';
    say('Wait', 'Tap when the panel changes.');
    timer = window.setTimeout(() => {
      phase = 'go';
      panel.dataset.phase = 'go';
      goAt = performance.now();
      say('Tap', '');
    }, R.waitMs(r, minMs, maxMs));
  }
  panel.addEventListener('pointerdown', () => {
    if (p.paused()) return;
    if (phase === 'ready') return arm();
    if (phase === 'wait') {
      clearTimeout(timer);
      phase = 'ready';
      panel.dataset.phase = 'early';
      return say('Too soon', 'That round is taken again. Tap to go.');
    }
    const ms = Math.round(performance.now() - goAt);
    times.push(ms);
    p.score(R.average(times), `Round ${times.length} of ${rounds} · last ${ms} ms`);
    if (times.length >= rounds) {
      phase = 'ready';
      const avg = R.average(times);
      return p.end({ won: true, score: avg, lower: true, words: `Average ${avg} ms. ${R.verdict(avg)}.` });
    }
    phase = 'ready';
    panel.dataset.phase = 'ready';
    say(`${ms} ms`, 'Tap for the next round.');
  });
  p.onPause((paused) => {
    if (paused && phase === 'wait') {
      clearTimeout(timer);
      phase = 'ready';
      panel.dataset.phase = 'ready';
      say('Ready', 'Tap to go.');
    }
  });
  panel.dataset.phase = 'ready';
  say('Ready', `${rounds} rounds. Tap to go.`);
  p.score(0, `Round 1 of ${rounds}`);
  return () => clearTimeout(timer);
};
