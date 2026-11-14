/**
 * SETTINGS → THEME → BY THE CLOCK (NEXT ROUND, polish3.u7): the switch, the world for the day and the one for the night, and the hour
 * calm motion starts (state/lookclock.ts).
 */
import { WORLDS, type WorldKey } from '../../../../../packages/shared/src/themes';
import { h } from '../../core/dom';
import { lookClock } from '../../state/lookclock';
import { switchRow } from './switch';

export const CLOCK_WORDS = {
  label: 'Change the look by the clock',
  sub: 'One look by day and one by night, from your home’s sun; off, the look stays as you set it.',
  day: 'By day',
  night: 'By night',
  calm: 'Calm motion from',
  never: 'Never',
};

export function lookClockBlock(): HTMLElement {
  const sw = switchRow(CLOCK_WORDS.label, CLOCK_WORDS.sub, () => lookClock.get().on, (on) => lookClock.set({ on }));
  sw.el.dataset.act = 'lookclock';
  const pick = (label: string, key: 'day' | 'night') => {
    const sel = h('select.lcsel', { 'aria-label': `${label}: the look` }, ...WORLDS.map((w) => h('option', { value: w.key }, w.label))) as HTMLSelectElement;
    sel.value = lookClock.get()[key];
    sel.addEventListener('change', () => lookClock.set({ [key]: sel.value as WorldKey }));
    sel.dataset.clock = key;
    return h('label.lcrow', h('span', label), sel);
  };
  const calm = h('select.lcsel', { 'aria-label': 'Calm motion from' }, h('option', { value: '' }, CLOCK_WORDS.never), ...[20, 21, 22, 23, 0].map((x) => h('option', { value: String(x) }, `${String(x).padStart(2, '0')}:00 to 07:00`))) as HTMLSelectElement;
  calm.value = lookClock.get().calmFrom === null ? '' : String(lookClock.get().calmFrom);
  calm.addEventListener('change', () => lookClock.set({ calmFrom: calm.value === '' ? null : Number(calm.value) }));
  calm.dataset.clock = 'calm';
  const rows = h('div.lcrows', pick(CLOCK_WORDS.day, 'day'), pick(CLOCK_WORDS.night, 'night'), h('label.lcrow', h('span', CLOCK_WORDS.calm), calm));
  const paint = () => {
    sw.paint();
    rows.hidden = !lookClock.get().on;
  };
  lookClock.subscribe(paint);
  paint();
  return h('div.lookclock', h('div.lab', 'BY THE CLOCK'), sw.el, rows);
}
