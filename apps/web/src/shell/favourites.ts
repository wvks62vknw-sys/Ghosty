/**
 * FAVOURITES (BRIEF-SHELL pass 1; STARS 163; the finding rule, OWNER-ISSUES 143: "recents and favourites in two taps").
 *
 * A screen he pins sits first in the jump bar (FAVOURITES, above RECENT), up to six, in the order he pinned them: tap the search,
 * tap the row. A long press on a jump-bar row, a hub card or a deck card opens a small sheet with the Machine's key, PIN or UNPIN
 * (44 pt); the lift that ends the press is not a tap, so nothing opens. The list is kept in `ghosty.settings` (so the daily backup
 * carries it to another phone). Only screens that exist and are not a hub can be pinned; a pin of a screen this build has not got
 * is left out when read, never an error.
 */
import { h } from '../core/dom';
import { settings } from '../state/app';
import { key, plate, tag } from '../ui/machine';
import { toolName } from './areas';
import { tabs } from './tabs';

export const MAX_FAVOURITES = 6;
/** How long a finger rests before it is a long press (the quick switcher's is 350 ms; a card is a bigger thing to hold). */
export const PIN_HOLD_MS = 500;

/** What the pin sheet and the pins show, for specs (window.__ghosty.pins). */
export const pinState = { open: '', pinned: [] as string[], held: '' };

const pinnable = (id: string) => {
  const t = tabs().find((x) => x.id === id);
  return !!t && !t.hub;
};

/** The pinned screens, in his order (ids this build has). */
export const favourites = (): string[] => settings.get().favourites.filter((id, i, a) => pinnable(id) && a.indexOf(id) === i).slice(0, MAX_FAVOURITES);
export const isFavourite = (id: string) => favourites().includes(id);

/** Pin or unpin; false when it cannot be pinned (a hub, an unknown id, or six already). */
export function setFavourite(id: string, on: boolean): boolean {
  const now = favourites();
  if (on && !pinnable(id)) return false;
  if (on && !now.includes(id) && now.length >= MAX_FAVOURITES) return false;
  const next = on ? (now.includes(id) ? now : [...now, id]) : now.filter((x) => x !== id);
  settings.set({ favourites: next });
  pinState.pinned = next;
  return true;
}

let sheet: HTMLElement | null = null;
const closeSheet = () => {
  sheet?.remove();
  sheet = null;
  pinState.open = '';
  removeEventListener('keydown', onKey);
};
const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeSheet();

/** The long-press sheet: the screen's name, one line, PIN or UNPIN and CANCEL. */
export function openPinSheet(id: string): void {
  const t = tabs().find((x) => x.id === id);
  if (!t || t.hub) return;
  closeSheet();
  const name = toolName(t);
  const pinned = isFavourite(id);
  const full = !pinned && favourites().length >= MAX_FAVOURITES;
  const say = pinned ? 'It is pinned: first in the search.' : full ? `I keep ${MAX_FAVOURITES} pinned. Unpin one first.` : 'Pin it and it is first in the search, two taps from anywhere.';
  const act = key(pinned ? 'UNPIN' : 'PIN', () => {
    setFavourite(id, !pinned);
    closeSheet();
  }, { kind: 'fill', label: `${pinned ? 'Unpin' : 'Pin'} ${name}` });
  act.dataset.pin = pinned ? 'unpin' : 'pin';
  if (full) act.disabled = true;
  const box = plate({ strong: true, label: name }, tag(name), h('p.pinsay', { dataset: { case: 'keep' } }, say), h('div.pinkeys', act, key('CANCEL', closeSheet, { kind: 'ghost' })));
  sheet = h('div#pinsheet', { role: 'dialog', 'aria-modal': 'true', 'aria-label': `${name}: pin it` }, box);
  sheet.addEventListener('click', (e) => e.target === sheet && closeSheet());
  document.body.append(sheet);
  addEventListener('keydown', onKey);
  pinState.open = id;
  act.focus({ preventScroll: true });
}

/**
 * A long press on `el` opens the pin sheet for `id`. The lift (or the click the press would have been) is swallowed, so the
 * screen does not open under the sheet; a finger that wanders more than 10 px, or lifts early, is an ordinary tap or scroll.
 */
export function pinOnHold(el: HTMLElement, id: string): void {
  let timer = 0;
  let at = { x: 0, y: 0 };
  let fired = false;
  const cancel = () => {
    clearTimeout(timer);
    timer = 0;
  };
  el.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    fired = false;
    at = { x: e.clientX, y: e.clientY };
    cancel();
    timer = window.setTimeout(() => {
      timer = 0;
      fired = true;
      pinState.held = id;
      openPinSheet(id);
    }, PIN_HOLD_MS);
  });
  el.addEventListener('pointermove', (e) => timer && Math.hypot(e.clientX - at.x, e.clientY - at.y) > 10 && cancel());
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, cancel);
  // the click that ends a long press is not a tap (captured, so the card's own handler never sees it)
  el.addEventListener('click', (e) => {
    if (!fired) return;
    fired = false;
    e.stopImmediatePropagation();
    e.preventDefault();
  }, true);
  // (the phone's own menu on a long press, and a right-click with a mouse: the same sheet)
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (!fired) openPinSheet(id);
  });
}
