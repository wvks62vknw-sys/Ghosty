/**
 * WHAT EACH DENSE SCREEN DROPS FROM ITS TOP HALF (BRIEF-GROWN-UP-HUD 6; d3/README: "a screen migrates by losing things"). In GROWN UP six of the seven
 * dense screens (Home is the seventh: it drops the four gauges and the second bar by its own design, features/core/grown/home.ts) each fold ONE thing
 * that is not what the screen is for into a one-line key, a second tap: the thing is not removed, it is where it was, closed, and the key above it opens
 * it in place. Each is a thing the capsule, the Me sheet or the screen's own sections already give a second way to (named below).
 *
 *   GYM       the levels-by-game chart (22 bars)            -> "Levels by game · N of 22 mastered": the games themselves are the way in
 *   SCHOOL    the stages still locked                       -> "N stages locked": the one he is at stays; the order is said at the foot
 *   LIBRARY   the row of section pills                      -> "Sections": the recent card on its hub carries Shelf and Ask the library as chips
 *   GOD'S EYE the row of layer chips                        -> "Layers": the Layers panel and the zoom rail stay on the globe
 *   SETTINGS  the row of section pills                      -> "Sections": the capsule's field says `Find a setting` and finds any of them
 *   SYSTEM    the three dials (free AI, database, offline)  -> "The three dials": the Me sheet's Status card draws the same three
 *
 * Nothing is deleted and nothing is moved in the document: a dropped thing keeps its place and its own code, and is only closed (`data-gstate`). A screen
 * that draws itself again (a list that refreshes) is folded again where the thing comes back. Drawn only while the world is Grown Up on a phone.
 */
import { h, icon } from '../core/dom';
import { ui } from '../state/app';
import { recipeEvents } from '../state/theme';
import { grownOn } from './house';

const CARET = '<path d="M6 9l6 6 6-6"/>';

export interface Drop {
  /** The screen it belongs to (its `#pg-<tab>`). */
  tab: string;
  /** Its name, for the checks and the report. */
  id: string;
  /** The things folded. */
  pick(pg: HTMLElement): HTMLElement[];
  /** The key's words, from the screen's own words where it has them. */
  label(pg: HTMLElement, els: HTMLElement[]): string;
  /** The key is a list item where the things are (a list may hold nothing but items). */
  item?: boolean;
}

const q = (pg: HTMLElement, sel: string) => [...pg.querySelectorAll<HTMLElement>(sel)];
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const DROPS: Drop[] = [
  { tab: 'gym', id: 'levels', pick: (pg) => q(pg, '.gymlvhd, .gymlvls'), label: (pg) => pg.querySelector('.gymlvhd .k')?.textContent?.trim().replace(/^./, (c) => c.toUpperCase()) ?? 'Levels by game' },
  { tab: 'school', id: 'locked', item: true, pick: (pg) => q(pg, '.schrung.s-locked'), label: (_pg, els) => `${plural(els.length, 'stage', 'stages')} still locked` },
  { tab: 'library', id: 'sections', pick: (pg) => q(pg, ':scope > .hud > .secpills'), label: () => 'Sections' },
  { tab: 'eye', id: 'layers', pick: (pg) => q(pg, '.eyetop .eyechips'), label: () => 'Layers' },
  { tab: 'settings', id: 'sections', pick: (pg) => q(pg, ':scope > .hud > .secpills'), label: () => 'Sections' },
  { tab: 'system', id: 'dials', pick: (pg) => q(pg, '.megauges'), label: () => 'The three dials' },
];

/** What is folded now, for the checks (window.__ghosty.drops): by screen, the things closed and whether their key is open. */
export const dropState = { on: false, shown: {} as Record<string, { n: number; open: boolean; label: string }> };

/** The folds opened by hand stay open while the screen stands (per screen and drop, this visit only). */
const opened = new Set<string>();

function apply(d: Drop, pg: HTMLElement): void {
  const els = d.pick(pg).filter((e) => !e.classList.contains('gdropkey') && !e.classList.contains('gdropli'));
  const id = `${d.tab}.${d.id}`;
  let holder = pg.querySelector<HTMLElement>(`[data-gdropkey="${id}"]`);
  if (!els.length) {
    holder?.remove();
    delete dropState.shown[id];
    return;
  }
  const open = opened.has(id);
  const label = d.label(pg, els);
  if (!holder) {
    const b = h('button.gdropkey', { type: 'button', 'aria-expanded': String(open), dataset: { case: 'keep' } }, h('span.gdroplabel', label), icon(CARET, 'ic gdropcaret'));
    b.addEventListener('click', () => {
      if (opened.has(id)) opened.delete(id);
      else opened.add(id);
      apply(d, pg);
    });
    holder = d.item ? h('li.gdropli', b) : b;
    holder.dataset.gdropkey = id;
  }
  // (the key stands where the first thing stood; a list that drew itself again puts it back)
  if (holder.nextElementSibling !== els[0]) els[0]!.before(holder);
  const btn = holder.matches('button') ? holder : holder.querySelector('button')!;
  if (btn.getAttribute('aria-expanded') !== String(open)) btn.setAttribute('aria-expanded', String(open));
  const text = btn.querySelector('.gdroplabel');
  if (text && text.textContent !== label) text.textContent = label;
  const state = open ? 'open' : 'closed';
  for (const e of els) {
    if (e.dataset.gdrop !== id) e.dataset.gdrop = id;
    if (e.dataset.gstate !== state) e.dataset.gstate = state;
  }
  dropState.shown[id] = { n: els.length, open, label };
}

/** The observers: one per screen, made when the screen first comes up (its page exists then), writing only when something changed. */
export function buildDrops(): void {
  const watched = new Set<string>();
  const run = (tab: string) => {
    const pg = document.getElementById(`pg-${tab}`);
    for (const d of DROPS) if (d.tab === tab && pg) apply(d, pg);
  };
  const watch = (tab: string) => {
    if (watched.has(tab)) return;
    const pg = document.getElementById(`pg-${tab}`);
    if (!pg) return;
    watched.add(tab);
    let queued = false;
    new MutationObserver(() => {
      if (queued || !grownOn()) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        if (grownOn()) run(tab);
      });
    }).observe(pg, { childList: true, subtree: true });
  };
  const paint = () => {
    dropState.on = grownOn();
    if (!dropState.on) return;
    const tab = ui.get().tab;
    if (!DROPS.some((d) => d.tab === tab)) return;
    watch(tab);
    run(tab);
    // (a screen draws its parts a moment after it opens: the folds are checked again once it has)
    setTimeout(() => grownOn() && ui.get().tab === tab && run(tab), 600);
  };
  ui.subscribe((s, p) => s.tab !== p.tab && paint());
  recipeEvents.on('change', paint);
  addEventListener('resize', paint);
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  const attach = (n = 0) => (w.__ghosty ? (w.__ghosty.drops = dropState) : n < 150 && setTimeout(() => attach(n + 1), 100));
  attach();
  paint();
}
