/**
 * God's Eye: his saved places (Memory → ME → PLACES; apps/edge/src/places.ts) as chips under the search — a tap
 * flies there and drops the pin, so the spot card (Street View, map, traffic, GO) opens on home or work. The
 * search box finds them by name too ("home"). Read from the brain's memory each time the tab opens.
 */
import { matchPlace, type SavedPlace } from '../../../../../packages/shared/src/places';
import { brain } from '../../api/brain';
import { clear, h, icon } from '../../core/dom';

const PIN = '<path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0113 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>';

export function myPlaces(fly: (p: SavedPlace) => void): { el: HTMLElement; refresh(): Promise<void>; find(words: string): SavedPlace | null } {
  let places: SavedPlace[] = [];
  const el = h('div.myplaces', { hidden: true, 'aria-label': 'Your places' });
  const paint = () => {
    el.hidden = !places.length;
    clear(el, ...places.map((p) => {
      const b = h('button.lchip.place', { type: 'button', dataset: { case: 'keep', id: p.id }, title: p.address }, icon(PIN), h('span', p.label));
      b.addEventListener('click', () => fly(p));
      return b;
    }));
  };
  return {
    el,
    async refresh() {
      try {
        places = (await brain.places()).places ?? [];
      } catch {
        /* offline: the chips from last time stay */
      }
      paint();
    },
    find: (words) => matchPlace(words, places),
  };
}
