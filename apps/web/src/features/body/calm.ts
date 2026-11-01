/**
 * BREATHE and STRETCH (BRIEF-PACKS-1 item 2): box breathing (4-4-4-4) or 4-7-8 with a circle that fills and empties, the
 * phase in words for VoiceOver and a short buzz at each change; the stretch set (packages/shared/src/body.ts STRETCHES)
 * one at a time with its countdown, a buzz between them. Nothing here needs the brain; the stretch set is kept as a
 * workout when it finishes.
 */
import { BREATHS, breathAt, STRETCHES, stretchAt, STRETCH_SECS } from '../../../../../packages/shared/src/body';
import { h } from '../../core/dom';
import { button } from '../../ui/components';
import { brain } from '../../api/brain';
import { bodyState, type Screen } from './index';

const ROUNDS = 4;

export function breatheScreen(first: 'box' | '478'): Screen {
  let kind = first;
  let t0 = 0;
  let timer = 0;
  let lastI = -1;
  const ring = h('div.pkbreath', { 'aria-hidden': 'true' });
  const say = h('b.pkmid', { 'aria-live': 'assertive' }, 'Ready');
  const left = h('span.pklab', `${ROUNDS} rounds`);
  const chips = h('div.pkrow', { role: 'group', 'aria-label': 'Which breathing' });
  const paintChips = () =>
    chips.replaceChildren(
      ...(['box', '478'] as const).map((k) => {
        const b = button(BREATHS[k].label, () => {
          kind = k;
          stop();
          paintChips();
        }, k === kind ? 'on' : '');
        b.setAttribute('aria-pressed', String(k === kind));
        return b;
      }),
    );
  const stop = () => {
    clearInterval(timer);
    timer = 0;
    ring.style.transform = 'scale(.55)';
    say.textContent = 'Ready';
    bodyState.breath = { say: '', round: 0 };
  };
  const step = () => {
    const a = breathAt(kind, Date.now() - t0);
    if (a.round > ROUNDS) {
      stop();
      say.textContent = 'Done. Well breathed.';
      navigator.vibrate?.([40, 60, 40]);
      return;
    }
    const grow = a.say === 'Breathe in' ? 0.55 + 0.45 * a.frac : a.say === 'Breathe out' ? 1 - 0.45 * a.frac : a.i === 1 ? 1 : 0.55;
    ring.style.transform = `scale(${grow.toFixed(3)})`;
    say.textContent = `${a.say} · ${a.left}`;
    left.textContent = `round ${a.round} of ${ROUNDS}`;
    bodyState.breath = { say: a.say, round: a.round };
    if (a.i !== lastI) navigator.vibrate?.(25);
    lastI = a.i;
  };
  const start = button('Start', () => {
    stop();
    t0 = Date.now();
    lastI = -1;
    step();
    timer = window.setInterval(step, 100);
  }, 'on');
  start.setAttribute('aria-label', 'Start breathing');
  paintChips();
  const el = h('div.pkcol', chips, h('div.pkbreathbox', ring), h('div.pkhero', say, left), h('div.pkrow', start, button('Stop', stop)), h('p.pknote', 'Breathe through the nose if you can. Stop if you feel dizzy.'));
  return { el, stop };
}

export function stretchScreen(): Screen {
  let t0 = 0;
  let timer = 0;
  let lastI = -1;
  const name = h('b.pkmid', { 'aria-live': 'polite' }, STRETCHES[0]!.name);
  const cue = h('p.pkcue', STRETCHES[0]!.cue);
  const left = h('b.pkbig', `${STRETCHES[0]!.secs}`);
  const list = h('ol.pklist', { 'aria-label': 'The set' }, ...STRETCHES.map((s) => h('li', `${s.name} — ${s.secs} s`)));
  const stop = () => {
    clearInterval(timer);
    timer = 0;
  };
  const step = () => {
    const a = stretchAt((Date.now() - t0) / 1000);
    const s = STRETCHES[a.i]!;
    bodyState.stretch = { i: a.done ? STRETCHES.length : a.i, left: a.left };
    if (a.done) {
      stop();
      name.textContent = 'Done: the whole set.';
      left.textContent = '✓';
      navigator.vibrate?.([40, 60, 40]);
      void brain.packDo('body', 'log', { words: 'stretched' }).catch(() => undefined);
      return;
    }
    if (a.i !== lastI) {
      name.textContent = s.name;
      cue.textContent = s.cue;
      [...list.children].forEach((li, k) => li.classList.toggle('on', k === a.i));
      if (lastI !== -1) navigator.vibrate?.(60);
      lastI = a.i;
    }
    left.textContent = String(a.left);
  };
  const start = button('Start', () => {
    stop();
    t0 = Date.now();
    lastI = -1;
    step();
    timer = window.setInterval(step, 250);
  }, 'on');
  start.setAttribute('aria-label', `Start the stretch set, ${Math.round(STRETCH_SECS / 60)} minutes`);
  const next = button('Next', () => {
    if (!timer) return;
    const a = stretchAt((Date.now() - t0) / 1000);
    t0 -= a.left * 1000;
    step();
  });
  next.setAttribute('aria-label', 'Next stretch');
  const el = h('div.pkcol', h('div.pkhero', left, h('span.pklab', 'seconds')), name, cue, h('div.pkrow', start, next, button('Stop', stop)), list, h('p.pknote', 'Gently: a stretch should never hurt.'));
  return { el, stop };
}
