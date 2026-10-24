/**
 * Memory → ME → PLACES: home, work, school, the gym, his parents' and any place he names, kept in the brain's
 * memory (apps/edge/src/places.ts) and nowhere else. FIND looks the address or postcode up on the free map and
 * shows what it found; KEEP IT is his yes (nothing is kept before). Each place has EDIT and FORGET (with UNDO).
 * Journeys and directions ("take me home"), the Brief's commute and God's Eye's pins read them.
 */
import type { PlaceCandidate, SavedPlace } from '../../../../../packages/shared/src/places';
import { brain } from '../../api/brain';
import { clear, h } from '../../core/dom';
import { button, toast, undoBar } from '../../ui/components';

const KINDS: [string, string][] = [
  ['home', 'Home'],
  ['work', 'Work'],
  ['school', 'School'],
  ['gym', 'Gym'],
  ['parents', "Parents'"],
  ['', 'Another place…'],
];

export function placesBlock(): { el: HTMLElement; refresh(): Promise<void> } {
  let places: SavedPlace[] = [];
  let found: PlaceCandidate | null = null;
  const list = h('div.placelist');
  const kind = h('select', { 'aria-label': 'Which place' }, ...KINDS.map(([v, t]) => h('option', { value: v }, t)));
  const name = h('input', { placeholder: 'Its name, e.g. Nan’s', 'aria-label': 'Name of the place', hidden: true });
  const where = h('input', { placeholder: 'Address or postcode', 'aria-label': 'Address or postcode', autocomplete: 'street-address' });
  const check = h('div.placefound', { hidden: true, role: 'status' });
  const undo = undoBar();
  kind.addEventListener('change', () => (name.hidden = kind.value !== ''));
  const label = () => (kind.value || name.value.trim());

  const find = async (b: HTMLButtonElement) => {
    if (!label()) return toast('Give the place a name', 'warn');
    if (!where.value.trim()) return toast('Type the address or postcode', 'warn');
    b.disabled = true;
    b.textContent = 'FINDING…';
    try {
      found = (await brain.placeFind(label(), where.value.trim())).found;
      paintFound();
    } catch (e) {
      found = null;
      check.hidden = false;
      clear(check, h('p.note.bad', `Not found: ${(e as Error).message}`));
    }
    b.disabled = false;
    b.textContent = 'FIND';
  };
  const paintFound = () => {
    if (!found) {
      check.hidden = true;
      return clear(check);
    }
    const f = found;
    check.hidden = false;
    clear(
      check,
      h('p.lab', `IS THIS ${f.label.toUpperCase()}?`),
      h('p.addr', f.address),
      h('small.note', `${f.lat.toFixed(5)}, ${f.lon.toFixed(5)} on the map`),
      h(
        'div.row',
        button('KEEP IT', async (b) => {
          b.disabled = true;
          // a new home replaces the old one: UNDO puts the old one back exactly
          const was = places.findIndex((x) => x.id === f.id || x.label.toLowerCase() === f.label.toLowerCase());
          const old = was >= 0 ? places[was]! : null;
          try {
            places = (await brain.placeKeep(f)).places;
            if (old) undo.show(`${f.label} changed to ${f.address}`, () => putBack(old, was));
            else toast(`${f.label} kept`, 'ok');
            found = null;
            where.value = '';
            name.value = '';
            paintFound();
            paint();
          } catch (e) {
            toast(`Could not keep it: ${(e as Error).message}`, 'bad');
            b.disabled = false;
          }
        }, 'on'),
        button('NOT THIS', () => {
          found = null;
          paintFound();
          where.focus();
        }),
      ),
    );
  };

  /** UNDO: a place back exactly as it was (its date, its place in the list). */
  const putBack = async (p: SavedPlace, index: number) => {
    places = (await brain.placeKeep({ id: p.id, label: p.label, query: p.query, address: p.address, lat: p.lat, lon: p.lon }, { at: p.at, index })).places;
    paint();
  };

  const paint = () => {
    clear(list);
    if (!places.length) {
      list.append(h('p.note', 'No places yet. Add home and work and I can take you home, time the drive to work, and show your commute in the Brief.'));
      return;
    }
    for (const [i, p] of places.entries()) {
      const edit = button('EDIT', () => {
        const k = KINDS.find(([v]) => v === p.id);
        kind.value = k ? p.id : '';
        name.hidden = !!k;
        name.value = k ? '' : p.label;
        where.value = p.query || p.address;
        found = null;
        paintFound();
        where.focus();
      });
      const forget = button('FORGET', async () => {
        try {
          places = (await brain.placeForget(p.id)).places;
          paint();
          undo.show(`Forgot ${p.label}`, () => putBack(p, i));
        } catch (e) {
          toast(`Could not forget it: ${(e as Error).message}`, 'bad');
        }
      }, 'warn');
      list.append(h('div.placerow', { dataset: { id: p.id } }, h('span.k', p.label), h('span.v', p.address), h('span.acts', edit, forget)));
    }
  };

  const el = h(
    'div.places',
    h('div.lab', 'PLACES'),
    h('p.note.privacy', 'Kept in my memory like everything here, and nowhere else. Only the map points go to the free route service when I work out a journey.'),
    undo.el,
    list,
    h('div.keyrow.wrapit.placeadd', kind, name, where, button('FIND', (b) => void find(b))),
    check,
  );
  where.addEventListener('keydown', (e) => e.key === 'Enter' && void find(el.querySelector<HTMLButtonElement>('.placeadd button')!));
  return {
    el,
    async refresh() {
      try {
        places = (await brain.places()).places ?? [];
      } catch {
        /* offline: the last list stays */
      }
      paint();
    },
  };
}
