/**
 * The quick switcher (the navigation sheet the owner said yes to, BRIEF-NAV-BOOT 1; mockups/nav frame 4: "hold a tab ·
 * slide · let go"). A long press (350 ms, the tab's touch flare already lit) on a tab-bar button fans that area's tools
 * out above the bar as a short arc of small instruments with their names, the lit one first (a tool that is live or
 * training now); the same drawings as the hub cards (ui/instruments.ts through shell/hubcards.ts).
 *
 * Sliding the finger onto one and lifting opens it; lifting where the press began leaves the arc open for a tap; lifting
 * anywhere else closes it. A plain tap on the tab still does what it always did (shell/areas.ts). Reduce Motion: the arc
 * is there at once, nothing moves. Keyboard and VoiceOver users have the hub one tap away, so the arc is out of their
 * way: `aria-hidden` while closed.
 */
import { clear, h, icon } from '../core/dom';
import type { StatusWord } from './hubcards';

export interface SwitchItem {
  id: string;
  name: string;
  glyph: string;
  status: StatusWord;
  /** Its instrument, drawn from real state (as on its hub card), or null. */
  instrument: Element | null;
  /** One reading under the name ("1,685", "Not yet"). */
  reading: string;
  /** What it does for him (the card's line), shown when the finger is on it. */
  line: string;
  open(): void;
}

/** How long a press must be held before the arc opens. */
export const HOLD_MS = 350;
/** A finger closer than this to an instrument's centre is on it. */
const REACH = 52;

/** What the switcher shows, for specs (window.__ghosty.switcher). */
export const switcherState = { open: false, area: '', items: [] as string[], on: '', opened: '' };

/** The part of an instrument that fits a small round face: the drawing itself, not its words. */
function face(el: Element | null, glyph: string): Element {
  if (!el) return icon(glyph);
  // a ring with its count in the middle (the GYM's, the SCHOOL's) keeps its count
  if (el instanceof SVGElement || el.classList.contains('insc')) return el;
  return el.querySelector('svg') ?? el.querySelector('.segs') ?? icon(glyph);
}

export function buildSwitcher(): {
  el: HTMLElement;
  isOpen(): boolean;
  open(from: HTMLElement, area: string, items: SwitchItem[]): void;
  /** The finger moved: light the instrument under it. */
  hover(x: number, y: number): void;
  /** The finger lifted: open the one under it, stay open on the tab it began on, or close. */
  release(x: number, y: number): void;
  close(): void;
} {
  const kick = h('span.swk');
  const title = h('b.swt');
  const hint = h('small.swh');
  const cap = h('div.swcap', kick, title, hint);
  const arc = h('div.swarc');
  const el = h('div#switcher', { 'aria-hidden': 'true', dataset: { case: 'keep' } }, h('div.swdim'), cap, arc);
  el.hidden = true;
  let from: HTMLElement | null = null;
  let area = '';
  let items: { it: SwitchItem; b: HTMLButtonElement; x: number; y: number }[] = [];
  let on = -1;

  const say = () => {
    const cur = items[on]?.it;
    kick.textContent = cur ? cur.name : area;
    title.textContent = cur ? cur.line : `${items.length} ${items.length === 1 ? 'tool' : 'tools'}`;
    hint.textContent = cur ? 'Let go to open · slide off to cancel' : 'Slide onto one and let go, or tap one';
    for (const [i, x] of items.entries()) x.b.classList.toggle('on', i === on);
    switcherState.on = cur?.id ?? '';
  };
  const close = () => {
    if (el.hidden) return;
    el.hidden = true;
    el.setAttribute('aria-hidden', 'true');
    el.classList.remove('in');
    from?.classList.remove('held');
    from = null;
    on = -1;
    switcherState.open = false;
    removeEventListener('keydown', esc);
  };
  const esc = (e: KeyboardEvent) => e.key === 'Escape' && close();
  const choose = (i: number) => {
    const x = items[i];
    if (!x) return;
    switcherState.opened = x.it.id;
    close();
    x.it.open();
  };
  el.querySelector('.swdim')!.addEventListener('click', close);

  const open = (btn: HTMLElement, name: string, list: SwitchItem[]) => {
    from = btn;
    area = name;
    btn.classList.add('held');
    // the arc: centred on the screen above the bar, the outer ones lower; its size follows the screen's width
    const bar = btn.closest('.tabcap')?.getBoundingClientRect() ?? btn.getBoundingClientRect();
    const W = innerWidth;
    const n = list.length;
    const R = Math.min(W / 2 - 52, 172);
    const spread = n < 2 ? 0 : Math.min(140, 48 * (n - 1));
    const cx = W / 2;
    const cy = bar.top - 36;
    const bx = btn.getBoundingClientRect();
    const ox = bx.left + bx.width / 2;
    const oy = bx.top + bx.height / 2;
    clear(arc);
    items = list.map((it, i) => {
      const deg = n < 2 ? 90 : 90 + spread / 2 - (i * spread) / (n - 1);
      const x = Math.round(cx + R * Math.cos((deg * Math.PI) / 180));
      const y = Math.round(cy - R * Math.sin((deg * Math.PI) / 180));
      const b = h('button.switem', { type: 'button', tabindex: '-1', dataset: { id: it.id, status: it.status.toLowerCase(), case: 'keep' }, onclick: () => choose(i) },
        h('span.swring', face(it.instrument, it.glyph)),
        h('span.swnm', it.name),
        h('small.swrd', it.reading),
      );
      // where it fans out from: the tab under the finger
      b.style.left = `${x}px`;
      b.style.top = `${y}px`;
      b.style.setProperty('--fx', `${Math.round(ox - x)}px`);
      b.style.setProperty('--fy', `${Math.round(oy - y)}px`);
      b.style.setProperty('--i', String(i));
      arc.append(b);
      return { it, b, x, y };
    });
    const top = Math.min(...items.map((x) => x.y));
    cap.style.top = `${Math.max(12, top - 52 - 96)}px`;
    on = -1;
    say();
    el.hidden = false;
    el.removeAttribute('aria-hidden');
    // the next frame: from folded at the tab to the arc (at once under Reduce Motion: no transition there)
    requestAnimationFrame(() => el.classList.add('in'));
    switcherState.open = true;
    switcherState.area = name;
    switcherState.items = list.map((x) => x.id);
    switcherState.on = '';
    addEventListener('keydown', esc);
  };
  const nearest = (x: number, y: number) => {
    let best = -1;
    let d = REACH;
    items.forEach((it, i) => {
      const dd = Math.hypot(it.x - x, it.y - y);
      if (dd < d) [best, d] = [i, dd];
    });
    return best;
  };
  const hover = (x: number, y: number) => {
    if (el.hidden) return;
    const i = nearest(x, y);
    if (i !== on) {
      on = i;
      say();
    }
  };
  const release = (x: number, y: number) => {
    if (el.hidden) return;
    const i = nearest(x, y);
    if (i >= 0) return choose(i);
    // lifted on the tab it began on: the arc stays for a tap; anywhere else: it closes
    const r = from?.getBoundingClientRect();
    if (r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
      from?.classList.remove('held');
      on = -1;
      say();
      return;
    }
    close();
  };
  return { el, isOpen: () => !el.hidden, open, hover, release, close };
}
