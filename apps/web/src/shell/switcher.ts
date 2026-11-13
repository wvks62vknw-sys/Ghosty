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

/**
 * ORBIT's fan (BRIEF-ORBIT-HUD 3): the items on one arc round the orb that was held instead of the tab bar's two arcs: centre `cx, cy`, radius
 * `r`, from the angle `from` to `to` (degrees, 90 straight up, 0 to the right). `stay: false`: lifting where the press began closes it
 * (the orb is held to slide, not to tap: a let-go on nothing is nothing).
 */
export interface Fan {
  cx: number;
  cy: number;
  r: number;
  from: number;
  to: number;
  stay?: boolean;
}

/** Where item `i` of `n` stands on a fan (pure: the spec reads it too). */
export function fanPlace(f: Fan, i: number, n: number): [number, number] {
  const deg = n < 2 ? (f.from + f.to) / 2 : f.from + ((f.to - f.from) * i) / (n - 1);
  return [Math.round(f.cx + f.r * Math.cos((deg * Math.PI) / 180)), Math.round(f.cy - f.r * Math.sin((deg * Math.PI) / 180))];
}

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
  open(from: HTMLElement, area: string, items: SwitchItem[], fan?: Fan): void;
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
  let fanned: Fan | null = null;

  const say = () => {
    const cur = items[on]?.it;
    kick.textContent = cur ? cur.name : area;
    title.textContent = cur ? cur.line : fanned ? 'Slide to a room and let go.' : `${items.length} ${items.length === 1 ? 'tool' : 'tools'}`;
    hint.textContent = cur ? 'Let go to open · slide off to cancel' : fanned ? 'Let go on nothing and nothing happens' : 'Slide onto one and let go, or tap one';
    for (const [i, x] of items.entries()) x.b.classList.toggle('on', i === on);
    switcherState.on = cur?.id ?? '';
  };
  const close = () => {
    if (el.hidden) return;
    el.hidden = true;
    el.setAttribute('aria-hidden', 'true');
    el.classList.remove('in');
    el.removeAttribute('data-fan');
    from?.classList.remove('held');
    from = null;
    fanned = null;
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

  const open = (btn: HTMLElement, name: string, list: SwitchItem[], fan?: Fan) => {
    from = btn;
    area = name;
    fanned = fan ?? null;
    if (fan) el.dataset.fan = 'orbit';
    btn.classList.add('held');
    // the arc: centred on the screen above the bar, the outer ones lower; its size follows the screen's width
    const bar = btn.closest('.tabcap')?.getBoundingClientRect() ?? btn.getBoundingClientRect();
    const W = innerWidth;
    const n = list.length;
    const R = Math.min(W / 2 - 52, 172);
    const cx = W / 2;
    const cy = bar.top - 36;
    const bx = btn.getBoundingClientRect();
    const ox = bx.left + bx.width / 2;
    const oy = bx.top + bx.height / 2;
    // [tabs] five or fewer on one arc, as always; six or more (an area shows every tool since 1 Nov: LIFE and MAKE have eight)
    // on two, the first half on the arc nearest the thumb and the rest on one above it, as wide as the screen lets its ends
    // be, so no two overlap on a 390-pt phone. Where there is no room above (a computer's rail), one arc, wider.
    const R2 = R + 110;
    const two = n > 5 && cy - R2 - 36 >= 12;
    const inner = two ? Math.ceil(n / 2) : n;
    const place = (i: number): [number, number] => {
      if (fan) return fanPlace(fan, i, n);
      const out = two && i >= inner;
      const m = out ? n - inner : inner;
      const k = out ? i - inner : i;
      const r = out ? R2 : R;
      const most = out ? 180 - (2 * Math.acos(Math.min(1, (W / 2 - 52) / r)) * 180) / Math.PI : n > 5 && !two ? 170 : 140;
      const spread = m < 2 ? 0 : Math.min(most, 48 * (m - 1));
      const deg = m < 2 ? 90 : 90 + spread / 2 - (k * spread) / (m - 1);
      return [Math.round(cx + r * Math.cos((deg * Math.PI) / 180)), Math.round(cy - r * Math.sin((deg * Math.PI) / 180))];
    };
    clear(arc);
    items = list.map((it, i) => {
      const [x, y] = place(i);
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
    // (a fan's words stand beside the orb: styles.css, ORBIT; the tab bar's arc keeps them above its highest instrument)
    cap.style.top = fan ? '' : `${Math.max(12, top - 52 - 96)}px`;
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
    // lifted on the tab it began on: the arc stays for a tap; anywhere else: it closes (a fan from the orb always closes: nothing happens)
    const r = from?.getBoundingClientRect();
    const keep = !fanned || fanned.stay !== false;
    if (keep && r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
      from?.classList.remove('held');
      on = -1;
      say();
      return;
    }
    close();
  };
  return { el, isOpen: () => !el.hidden, open, hover, release, close };
}
