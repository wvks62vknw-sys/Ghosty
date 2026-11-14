/**
 * SETTINGS → SAVER (NEXT ROUND, polish3.s1): the one switch that pauses heavy work, and what it has held back while it was on
 * (state/saver.ts). Off forgets the list.
 */
import { h } from '../../core/dom';
import { held, saver, setSaver } from '../../state/saver';
import { panel, type Panel } from '../../ui/components';
import { switchRow } from './switch';

export const SAVER_WORDS = {
  label: 'Saver',
  sub: 'Big downloads and the background feeds wait while it is on; off, they run as usual.',
  none: 'Nothing held back yet.',
  off: 'Off: downloads and feeds run as usual.',
  paused: (what: string[]) => `Held back while it is on: ${what.join(', ')}.`,
};

export function saverPanel(): Panel {
  const p = panel('SAVER', { grow: false, cls: 'saverpn' });
  const sw = switchRow(SAVER_WORDS.label, SAVER_WORDS.sub, () => saver.get().on, (on) => setSaver(on));
  sw.el.dataset.act = 'saver';
  const line = h('p.note.saverline', { dataset: { case: 'keep' } });
  const paint = () => {
    const s = saver.get();
    sw.paint();
    p.setStatus(s.on ? 'ON' : 'OFF', s.on ? 'mid' : 'off');
    line.textContent = !s.on ? SAVER_WORDS.off : s.paused.length ? SAVER_WORDS.paused(s.paused) : SAVER_WORDS.none;
  };
  saver.subscribe(paint);
  paint();
  p.body.append(sw.el, line);
  return p;
}

export { held };
