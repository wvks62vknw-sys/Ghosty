/**
 * iOS Settings: a page's panels become grouped lists — a small title above
 * each card, a tinted glyph square, the name, its value on the right, a chevron, and a footer
 * where a line explains something — and a tap pushes the panel in as its own screen. The
 * navigation bar's back button pops it. A row with data-go opens another screen instead
 * (Settings › System). Used on Settings, System and Links. Every panel, title and control keeps
 * its classes (a group only wraps panels).
 */
import { h, icon } from '../core/dom';
import { go } from '../shell/tabs';
import { ui } from '../state/app';

const G = {
  brush: '<path d="M14 4l6 6-8 8H6v-6z"/><path d="M4 20c1-3 2-4 4-4"/>',
  person: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 19.5c1.2-3.4 3.8-5 7-5s5.8 1.6 7 5"/>',
  wave: '<path d="M4 12h1M8 8v8M12 5v14M16 8v8M20 12h1"/>',
  chip: '<rect x="6" y="6" width="12" height="12" rx="2.5"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2 2M14 9l2 2"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
  pulse: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
  drive: '<rect x="3" y="13" width="18" height="7" rx="2"/><path d="M5 13l2.5-7h9L19 13M16.5 16.5h.5"/>',
  restore: '<path d="M4 12a8 8 0 108-8c-2.4 0-4.5 1-6 2.7"/><path d="M5 3v4h4"/>',
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M4 7l8 6 8-6"/>',
  music: '<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  plane: '<path d="M21 4L3 11l6 2.5L11 20l3-5 5 3z"/><path d="M9 13.5L21 4"/>',
  bell: '<path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 004 0"/>',
  branch: '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="8" r="2"/><path d="M6 7v10M18 10c0 4-6 3-12 7"/>',
  car: '<path d="M4 16v-4l2-5h12l2 5v4z"/><circle cx="7.5" cy="16.5" r="1.5"/><circle cx="16.5" cy="16.5" r="1.5"/>',
  room: '<path d="M4 20V9l8-5 8 5v11z"/><path d="M9 20v-6h6v6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
  link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.4"/>',
  hand: '<path d="M12 3.5l7 2.6v5.4c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6.1z"/><path d="M9 12l2 2 4-4"/>',
  help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.4a2.5 2.5 0 014.9.8c0 1.7-2.5 2.2-2.5 3.8M12 16.6v.4"/>',
};
/** Panel title (start of it) → glyph and colour: by what the row does, the same language as the rest of the app. */
const MAP: [RegExp, keyof typeof G, string][] = [
  [/^THEME/, 'brush', '#bf5af2'],
  [/^NAME/, 'person', '#98989d'],
  [/^VOICE/, 'wave', '#ff375f'],
  [/^CHARACTER/, 'spark', '#ff9f0a'],
  [/^OFFLINE BRAIN/, 'chip', '#5e5ce6'],
  [/^LOOPS/, 'restore', '#30d158'],
  [/^KEYS/, 'key', '#ffb340'],
  [/^AI ROOM/, 'room', '#ff9f0a'],
  [/^AI/, 'spark', '#64d2ff'],
  [/^STATUS/, 'pulse', '#30d158'],
  [/^STORAGE/, 'drive', '#98989d'],
  [/^BACKUP/, 'restore', '#40c8e0'],
  [/^EMAIL/, 'mail', '#0a84ff'],
  [/^SPOTIFY/, 'music', '#30d158'],
  [/^TELEGRAM/, 'plane', '#5ac8fa'],
  [/^(PHONE|NOTIFICATIONS)/, 'bell', '#ff453a'],
  [/^GITHUB/, 'branch', '#98989d'],
  [/^LIVE TRAFFIC/, 'car', '#ff9f0a'],
  [/^SYSTEM$/, 'gear', '#98989d'],
  [/^LINKS$/, 'link', '#0a84ff'],
  [/^ABOUT$/, 'info', '#98989d'],
  [/^PRIVACY$/, 'hand', '#0a84ff'],
  [/^HELP$/, 'help', '#30d158'],
];

export interface ListGroup {
  /** The small title above the group's card. */
  title: string;
  /** Which panels (by title) belong to it. */
  match: RegExp;
  /** A line under the card. */
  foot?: string;
}

/**
 * Push a screen inside the current tab: the navigation bar shows "‹ back" and the label until
 * `pop` runs (or the tab changes). `ownBack`: the screen draws its own back button.
 */
export function pushScreen(d: { back: string; label: string; title?: string; pop: () => void; ownBack?: boolean }): void {
  dispatchEvent(new CustomEvent('ghosty:push', { detail: { title: d.label, ...d } }));
}
/** The pushed screen is gone: the bar goes back to the tab's own. */
export function popScreen(): void {
  dispatchEvent(new CustomEvent('ghosty:push', { detail: null }));
}

/** Make one page a grouped list with pushed sub-pages. `name` is the page's own name for the back button. */
export function listMode(root: HTMLElement, name: string, keep: RegExp | null = null, groups: ListGroup[] = []): void {
  if (root.dataset.list) return;
  root.dataset.list = '1';
  root.classList.add('listmode');
  const titleOf = (pn: Element) => pn.querySelector('.ptitle')?.textContent ?? '';
  const deco = () => {
    for (const pn of root.querySelectorAll<HTMLElement>('.pn')) {
      const head = pn.querySelector(':scope > h3');
      if (!head) continue;
      const t = titleOf(pn);
      if (!pn.dataset.row && !pn.classList.contains('keepcard')) {
        // an overview the page opens on stays a card above the list
        if (keep?.test(t)) {
          pn.classList.add('keepcard');
          continue;
        }
        const [, g, tint] = MAP.find(([re]) => re.test(t)) ?? [null, 'gear', '#98989d'];
        pn.dataset.row = '1';
        pn.style.setProperty('--tint', tint);
        head.prepend(h('span.rowic', icon(G[g as keyof typeof G])));
        head.append(h('i.chev', { 'aria-hidden': 'true' }));
      }
      // into its group's card (consecutive panels of one group in one column share a card)
      const col = pn.parentElement;
      if (!pn.dataset.row || !col?.classList.contains('col')) continue;
      const gi = groups.findIndex((g) => g.match.test(t));
      const prev = pn.previousElementSibling;
      const prevCard = prev?.classList.contains('lgrp') && prev.getAttribute('data-g') === String(gi) ? prev.querySelector('.lcard') : null;
      if (prevCard) {
        prevCard.append(pn);
        continue;
      }
      const g = groups[gi];
      const card = h('div.lcard');
      const grp = h('section.lgrp', { dataset: { g: String(gi) } }, g ? h('h4.lgt', g.title) : null, card, g?.foot ? h('p.lgf', g.foot) : null);
      col.insertBefore(grp, pn);
      card.append(pn);
    }
  };
  deco();
  new MutationObserver(deco).observe(root, { childList: true, subtree: true });
  let pushed: HTMLElement | null = null;
  let scroll = 0;
  const scroller = () => root.querySelector<HTMLElement>('.hud');
  const pop = () => {
    if (!pushed) return;
    pushed.classList.remove('pushed');
    pushed.classList.add('popping');
    const was = pushed;
    setTimeout(() => was.classList.remove('popping'), 400);
    pushed = null;
    root.classList.remove('haspush');
    const s = scroller();
    if (s) s.scrollTop = scroll;
    popScreen();
  };
  // Capture: a tap on a panel's title pushes it, before the panel would fold itself.
  root.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    const head = el.closest('.pn[data-row] > h3');
    if (!head || el.closest('button, a, input, select, textarea')) return;
    const pn = head.parentElement as HTMLElement;
    if (pn.classList.contains('pushed')) return void e.stopPropagation();
    e.stopPropagation();
    // a row that is another screen (Settings › System)
    if (pn.dataset.go) {
      document.documentElement.dataset.nav = 'push';
      go(pn.dataset.go);
      setTimeout(() => (document.documentElement.dataset.nav = 'switch'), 700);
      return;
    }
    pn.classList.remove('min');
    const s = scroller();
    scroll = s?.scrollTop ?? 0;
    if (s) s.scrollTop = 0;
    pushed = pn;
    pn.classList.add('pushed');
    root.classList.add('haspush');
    pushScreen({ back: name, title: titleOf(pn), label: pn.querySelector<HTMLElement>('.ptitle')?.dataset.label ?? '', pop });
  }, true);
  // Leaving the page closes the pushed panel, so the list is there next time.
  ui.subscribe((st, pr) => st.tab !== pr.tab && pop());
}
