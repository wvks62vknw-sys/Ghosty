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
 * Used on SYSTEM and AGENDA. A panel belongs to the first section whose `match` fits its title; a panel no section
 * names (one added since) and anything in a column that is not a panel go with the part just above them.
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
  let applying = false;
  const apply = () => {
    applying = true;
    const on = phone.matches && defs.length > 1;
    el.hidden = !on;
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
    queueMicrotask(() => (applying = false));
  };
  /** Show section `id`: the page starts at the pills (its title scrolled away only if it already was). */
  const select = (id: string) => {
    if (!defs.some((d) => d.id === id)) return;
    cur = id;
    apply();
    if (hud && phone.matches) {
      const top = mark.offsetTop - (parseFloat(getComputedStyle(el).top) || 0);
      if (hud.scrollTop > top) hud.scrollTop = Math.max(0, top);
    }
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
    if (applying || queued || !recs.some((r) => (r.target as HTMLElement).matches?.('.hud, .col, .lgrp, .lcard'))) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      apply();
    });
  }).observe(hud ?? root, { childList: true, subtree: true });
  phone.addEventListener('change', apply);
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
