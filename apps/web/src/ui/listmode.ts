/**
 * iOS Settings for the calm looks: a page's panels become one grouped list — a tinted icon square,
 * the name, its value on the right, a chevron — and a tap pushes the panel in as its own screen.
 * The navigation bar's back button pops it. Used on Settings, System and Links. Nothing changes in
 * the DOM a test reads (every panel, title and control stays where it was); the classic looks
 * never see it.
 */
import { h, icon } from '../core/dom';
import { ui } from '../state/app';
import { proLook } from '../state/theme';

const G = {
  brush: '<path d="M14 4l6 6-8 8H6v-6z"/><path d="M4 20c1-3 2-4 4-4"/>',
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
};
/** Panel title (start of it) → glyph and iOS system colour. */
const MAP: [RegExp, keyof typeof G, string][] = [
  [/^LOOK/, 'brush', '#bf5af2'],
  [/^VOICE/, 'wave', '#ff375f'],
  [/^OFFLINE BRAIN/, 'chip', '#5e5ce6'],
  [/^KEYS/, 'key', '#ffb340'],
  [/^AI ROOM/, 'room', '#ff9f0a'],
  [/^AI/, 'spark', '#0a84ff'],
  [/^STATUS/, 'pulse', '#30d158'],
  [/^STORAGE/, 'drive', '#8e8e93'],
  [/^BACKUP/, 'restore', '#40c8e0'],
  [/^EMAIL/, 'mail', '#0a84ff'],
  [/^SPOTIFY/, 'music', '#30d158'],
  [/^TELEGRAM/, 'plane', '#40c8e0'],
  [/^(PHONE|NOTIFICATIONS)/, 'bell', '#ff453a'],
  [/^GITHUB/, 'branch', '#636366'],
  [/^LIVE TRAFFIC/, 'car', '#ff9f0a'],
];

/** Make one page a grouped list with pushed sub-pages. `name` is the page's own name for the back button. */
export function listMode(root: HTMLElement, name: string, keep: RegExp | null = null): void {
  if (root.dataset.list) return;
  root.dataset.list = '1';
  root.classList.add('listmode');
  const deco = () => {
    for (const pn of root.querySelectorAll<HTMLElement>('.pn')) {
      if (pn.dataset.row) continue;
      const head = pn.querySelector(':scope > h3');
      if (!head) continue;
      const t = pn.querySelector('.ptitle')?.textContent ?? '';
      // an overview the page opens on stays a card above the list
      if (keep?.test(t)) {
        pn.classList.add('keepcard');
        continue;
      }
      const [, g, tint] = MAP.find(([re]) => re.test(t)) ?? [null, 'gear', '#8e8e93'];
      pn.dataset.row = '1';
      pn.style.setProperty('--tint', tint);
      head.prepend(h('span.rowic', icon(G[g as keyof typeof G])));
      head.append(h('i.chev', { 'aria-hidden': 'true' }));
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
    dispatchEvent(new CustomEvent('ghosty:push', { detail: null }));
  };
  // Capture: in a calm look a tap on a panel's title pushes it, before the panel would fold itself.
  root.addEventListener('click', (e) => {
    if (!proLook()) return;
    const el = e.target as HTMLElement;
    const head = el.closest('.pn[data-row] > h3');
    if (!head || el.closest('button, a, input, select, textarea')) return;
    const pn = head.parentElement as HTMLElement;
    if (pn.classList.contains('pushed')) return void e.stopPropagation();
    e.stopPropagation();
    pn.classList.remove('min');
    const s = scroller();
    scroll = s?.scrollTop ?? 0;
    if (s) s.scrollTop = 0;
    pushed = pn;
    pn.classList.add('pushed');
    root.classList.add('haspush');
    dispatchEvent(new CustomEvent('ghosty:push', { detail: { back: name, title: pn.querySelector('.ptitle')?.textContent ?? '', label: pn.querySelector<HTMLElement>('.ptitle')?.dataset.label ?? '', pop } }));
  }, true);
  // Leaving the page closes the pushed panel, so the list is there next time.
  ui.subscribe((st, pr) => st.tab !== pr.tab && pop());
}
