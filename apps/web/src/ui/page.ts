/**
 * Standard tab layout: a hero readout in the middle (big value + subtitle + dials) with a
 * column of panels on each side. On phones the two columns swap with a toggle button, or —
 * with `stack` — follow each other in one scrolling page.
 */
import { clear, h } from '../core/dom';
import { button, dial, niceCase } from './components';
import { proLook, themeEvents } from '../state/theme';

export interface Page {
  root: HTMLElement;
  tag: HTMLElement;
  big: HTMLElement;
  sub: HTMLElement;
  left: HTMLElement;
  right: HTMLElement;
  dials(list: [label: string, frac: number, text: string, color?: string][]): void;
}

/** `stackInPro`: route C shows both sides in one scrolling page (the day in one look), the classic looks keep the swap. */
export function page(root: HTMLElement, opts: { tag: string; sub?: string; leftLabel?: string; rightLabel?: string; stack?: boolean; stackInPro?: boolean }): Page {
  const tag = h('div.tag', opts.tag);
  const big = h('div.bigv', '');
  const sub = h('div.sub', opts.sub ?? '');
  const dialBox = h('div.dials');
  const hud = h(`div.hud.two${opts.stack ? '.stack' : ''}` as 'div');
  const swap = button(opts.rightLabel ?? 'MORE', (b) => {
    const on = hud.classList.toggle('alt');
    b.textContent = on ? (opts.leftLabel ?? 'BACK') : (opts.rightLabel ?? 'MORE');
  }, 'swap');
  // The calm looks draw this as a segmented control (both names, the shown side selected).
  swap.dataset.left = niceCase(opts.leftLabel ?? 'Back');
  swap.dataset.right = niceCase(opts.rightLabel ?? 'More');
  const hero = h('div.hero', tag, big, sub, swap, dialBox);
  const left = h('div.col.cL');
  const right = h('div.col.cR');
  hud.append(hero, left, right);
  root.append(hud);
  if (opts.stackInPro) {
    const fit = () => hud.classList.toggle('stack', proLook());
    fit();
    themeEvents.on('change', fit);
  }
  return {
    root,
    tag,
    big,
    sub,
    left,
    right,
    dials(list) {
      clear(dialBox, ...list.map(([l, f, t, c]) => dial(l, f, t, c)));
    },
  };
}
