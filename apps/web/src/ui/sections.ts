/**
 * Sections on a long tool screen (the navigation sheet the owner said yes to, BRIEF-NAV-BOOT 1; his words: "too much
 * things in one tab so you have to scroll loads but there should be different like tabs for all of it but not
 * overstimulating"). A row of pills under the screen's title, one per major part of the page (six at most), that stays
 * in reach as the page scrolls. A tap shows that section alone and the page is short again; the first pill is the one
 * he uses most; the pill he picked is remembered per screen on this phone.
 *
 * Nothing is taken out of the page: a panel of another section is only `hidden` (its selectors, its timers and its
 * repaints carry on), and a link to a panel — the deck's YOU CAN lines, `revealSection` — selects the pill that holds
 * it first. On a wide screen (900 pt and up) every panel shows at once and the pills step aside.
 *
 * Used on SYSTEM, AGENDA, SETTINGS, the LIBRARY, MEMORY, SCHOOL, the WORKSHOP, THREATS and LINKS. A panel belongs to the first
 * section whose `match` fits its title; a panel no section names (one added since) and anything in a column that is not a
 * panel go with the part just above them. The row sizes each pill to its name; when the names do not fit (six of them, or a
 * narrow phone) it is set a little tighter (`.dense`), and when they still do not it scrolls by itself (`.scrolls`).
 */
import { h } from '../core/dom';
import { go } from '../shell/tabs';

export interface SectionDef {
  id: string;
  /** The pill's words: one or two plain words. */
  label: string;
  /** The panels it holds, by the start of their titles ("DIARY · NEXT 14 DAYS" → /^DIARY/). */
  match: RegExp;
}

export interface Sections {
  /** The row of pills (already in the page, under the title). */
  el: HTMLElement;
  /** Show one section (as a tap on its pill does). */
  select(id: string): void;
  current(): string;
}

/** At most six pills: more would not fit one row on the phone, and would be the clutter this is here to remove. */
export const MAX_SECTIONS = 6;
const PHONE = '(max-width: 899px)';
const keyOf = (screen: string) => `ghosty.sections.${screen}`;
const REVEAL = 'ghosty:reveal';

function remembered(screen: string): string {
  try {
    return localStorage.getItem(keyOf(screen)) ?? '';
  } catch {
    return '';
  }
}
function remember(screen: string, id: string): void {
  try {
    localStorage.setItem(keyOf(screen), id);
  } catch {
    /* storage unavailable: the pill is kept for this visit only */
  }
}

/**
 * Give a screen built with ui/page.ts its sections. `root` is the tab's page (#pg-<id>); `screen` names it for the
 * remembered pill. The pills go under the hero (the screen's title and its one line) and stick under the navigation
 * bar while the page scrolls.
 */
export function sections(root: HTMLElement, screen: string, list: SectionDef[]): Sections {
  const defs = list.slice(0, MAX_SECTIONS);
  const hud = root.querySelector<HTMLElement>('.hud');
  const phone = matchMedia(PHONE);
  const kept = remembered(screen);
  let cur = defs.some((d) => d.id === kept) ? kept : defs[0]?.id ?? '';
  const pills = defs.map((d) => h('button.secpill', { type: 'button', role: 'tab', dataset: { sec: d.id, case: 'keep' }, onclick: () => pick(d.id) }, d.label));
  const el = h('div.secpills', { role: 'tablist', 'aria-label': 'Sections', dataset: { screen } }, ...pills);
  // where the pills sit before they stick (a sticky row's own offset follows the scroll)
  const mark = h('i.secmark', { 'aria-hidden': 'true' });
  const hero = hud?.querySelector(':scope > .hero');
  if (hero) hero.after(mark, el);
  else hud?.prepend(mark, el);
  hud?.classList.add('secs');

  /** Every part of the page in order: the panels (inside a grouped list's cards too) and anything else in a column. */
  const parts = () => [...(hud?.querySelectorAll<HTMLElement>(':scope > .col > *, :scope > .col > .lgrp > .lcard > .pn') ?? [])].filter((e) => !e.classList.contains('lgrp'));
  const titleOf = (e: HTMLElement) => (e.classList.contains('pn') ? e.querySelector(':scope > h3 .ptitle')?.textContent ?? '' : '');
  /** The pill the row was last scrolled to (a row wider than the screen shows the picked pill). */
  let centred = '';
  const centre = () => {
    if (centred === cur || !el.classList.contains('scrolls')) return;
    centred = cur;
    const b = pills.find((x) => x.dataset.sec === cur);
    if (b) el.scrollLeft = Math.max(0, b.offsetLeft - (el.clientWidth - b.offsetWidth) / 2);
  };
  /**
   * How the row sits when its width changes (a page shown, a turn of the phone): as it is; or tighter (`.dense`) when its
   * names do not fit (six of them, "Self-study", "Fresh today"); or, still too wide, a row that scrolls by itself (`.scrolls`)
   * with the picked pill in view. The page never moves for it.
   */
  const fit = () => {
    el.classList.remove('dense', 'scrolls');
    if (el.hidden || !el.clientWidth) return;
    const over = () => el.scrollWidth > el.clientWidth + 1;
    if (over()) {
      el.classList.add('dense');
      if (over()) el.classList.add('scrolls');
    }
    centred = '';
    centre();
  };
  const apply = () => {
    const on = phone.matches && defs.length > 1;
    el.hidden = !on;
    mark.hidden = !on; // (off: the marker is not a grid item of the wide screen's two-column page)
    hud?.classList.toggle('secs', on);
    let prev = defs[0]?.id ?? '';
    for (const p of parts()) {
      const t = titleOf(p);
      const sec = (t && defs.find((d) => d.match.test(t))?.id) || prev;
      prev = sec;
      if (p.dataset.sec !== sec) p.dataset.sec = sec;
      const hide = on && sec !== cur;
      if (p.hidden !== hide) p.hidden = hide;
    }
    // a grouped list's card, and a whole column, with nothing of this section in it step aside too
    for (const g of hud?.querySelectorAll<HTMLElement>(':scope > .col > .lgrp') ?? []) g.classList.toggle('secnone', on && ![...g.querySelectorAll<HTMLElement>('.pn')].some((p) => !p.hidden));
    for (const c of hud?.querySelectorAll<HTMLElement>(':scope > .col') ?? []) c.classList.toggle('secnone', on && ![...c.children].some((k) => !(k as HTMLElement).hidden && !k.classList.contains('secnone')));
    for (const b of pills) {
      const sel = b.dataset.sec === cur;
      b.classList.toggle('on', sel);
      b.setAttribute('aria-selected', String(sel));
    }
    el.dataset.current = cur;
    centre();
  };
  /**
   * Where the page rests with the pills held at their place and nothing above them showing: the pills' own top margin
   * counted (without it 10 pt of the title's last line showed over the pills), the sticky offset taken off.
   */
  const restTop = () => {
    const cs = getComputedStyle(el);
    return Math.max(0, mark.offsetTop + (parseFloat(cs.marginTop) || 0) - (parseFloat(cs.top) || 0));
  };
  /**
   * Show section `id`: the page starts at the pills (its title scrolled away only if it already was). Checked again a frame
   * later, once the screen has redrawn for the section (a head that grew shorter would otherwise pull the section's first
   * panel up under the held pills: Safari has no scroll anchoring to hold it — his Workbench screenshots, 31 Oct).
   */
  const select = (id: string) => {
    if (!defs.some((d) => d.id === id)) return;
    cur = id;
    apply();
    if (!hud || !phone.matches) return;
    if (hud.scrollTop > restTop()) hud.scrollTop = restTop();
    requestAnimationFrame(() => {
      if (cur === id && hud.scrollTop > restTop()) hud.scrollTop = restTop();
    });
  };
  const pick = (id: string) => {
    remember(screen, id);
    select(id);
  };
  // A link to a panel (the deck, revealSection) shows the section that holds it.
  root.addEventListener(REVEAL, (e) => {
    apply();
    const sec = (e.target as HTMLElement).closest<HTMLElement>('[data-sec]')?.dataset.sec;
    if (sec && sec !== cur) select(sec);
  });
  // Panels arrive and move (a grouped list wraps them in its cards once the page is first shown): sort them again.
  let queued = false;
  new MutationObserver((recs) => {
    // (not held back while `apply` runs: the panels are often wrapped in the same task as the first one, and that is when it must run again)
    if (queued || !recs.some((r) => (r.target as HTMLElement).matches?.('.hud, .col, .lgrp, .lcard'))) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      apply();
    });
  }).observe(hud ?? root, { childList: true, subtree: true });
  phone.addEventListener('change', apply);
  new ResizeObserver(fit).observe(el);
  apply();
  return { el, select, current: () => cur };
}

/** Bring panel `pn` into view's section first (it may be hidden in another one); then it can be shown or scrolled to. */
export function revealPanel(pn: Element): void {
  pn.dispatchEvent(new CustomEvent(REVEAL, { bubbles: true }));
}

/** The panel of screen `tab` whose title starts with `title`, its section shown; null when the screen is not built yet. */
export function revealSection(tab: string, title: string): HTMLElement | null {
  const root = document.getElementById(`pg-${tab}`);
  const pn = root && [...root.querySelectorAll<HTMLElement>('.pn')].find((p) => (p.querySelector('.ptitle')?.textContent ?? '').toUpperCase().startsWith(title.toUpperCase()));
  if (pn) revealPanel(pn);
  return pn ?? null;
}

/** Go to screen `tab` on the section that holds its panel `title` (SYSTEM → KEYS from the Lens or Links). */
export function goToPanel(tab: string, title: string): void {
  if (go(tab)) revealSection(tab, title);
}
