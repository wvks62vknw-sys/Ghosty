/**
 * SETTINGS: an on/off setting as a switch row (the name, a line under it, the switch on the right; the whole row is
 * one 44 pt target), as iOS Settings has them. A yes/no used to be a drop-down ("Interface sounds: on"), which opens
 * a picker wheel for two choices. role="switch" and aria-checked tell VoiceOver what it is and whether it is on.
 */
import { h } from '../../core/dom';

export function switchRow(label: string, sub: string, get: () => boolean, set: (on: boolean) => void): { el: HTMLButtonElement; paint(): void } {
  const el = h('button.setsw', { type: 'button', role: 'switch', 'aria-checked': String(get()), dataset: { case: 'keep' } }, h('span.setswt', h('b', label), sub ? h('small', sub) : null), h('i.setknob', { 'aria-hidden': 'true' }));
  const paint = () => el.setAttribute('aria-checked', String(get()));
  el.addEventListener('click', () => {
    set(!get());
    paint();
  });
  return { el, paint };
}
