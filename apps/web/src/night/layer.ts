/**
 * NIGHT SCHOOL's dark layer: while the plan runs the screen is kept on (a wake lock: night/index.ts), so it is dimmed
 * with a dark layer over everything that shows only the progress line. A tap lifts it for a minute (liftDim).
 */
import { h } from '../core/dom';
import { liftDim, night } from './index';

export function nightLayer(): HTMLElement {
  const line = h('div.nightdimline');
  const el = h(
    'div#nightdim',
    { role: 'button', tabindex: '0', 'aria-label': 'Night School is running: tap to see Ghosty', hidden: true },
    line,
    h('div.nightdimhint', 'Night School · keep Ghosty open and the phone plugged in · tap to see Ghosty'),
  );
  el.addEventListener('click', liftDim);
  el.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && liftDim());
  document.body.append(el);
  const paint = () => {
    const s = night.get();
    el.hidden = !s.dim;
    line.textContent = s.line;
  };
  night.subscribe(paint);
  paint();
  return el;
}
