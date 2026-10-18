/**
 * The systems deck: a full-screen menu with every screen Ghosty has, each with its icon,
 * name and what it is for, plus a Settings tile. Opens from the GHOSTY logo (any
 * screen size), the SYSTEMS button in the phone dock, or the M key. Escape closes it.
 */
import { register } from '../commands/registry';
import { clear, h, icon, pad } from '../core/dom';
import { sfx } from '../assistant/sfx';
import { settings, ui } from '../state/app';
import { go, tabs } from './tabs';
import { ACRONYM, niceCase } from '../ui/components';
import { AREAS, areaOf } from './areas';
import { proLook } from '../state/theme';
import type { TabDef } from './tabs';

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export interface Launcher {
  open(): void;
  close(): void;
  toggle(): void;
}

export function buildLauncher(): Launcher {
  const time = h('b.dtime');
  const date = h('span.ddate');
  const tiles = h('div.dtiles');
  const quick = h('div.dquick');
  const box = h('div.deckin', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Systems' },
    h('div.dhead',
      h('div.dtitle', h('small', 'GHOSTY // SYSTEMS'), h('span', 'AT YOUR SERVICE, ', h('i.dname', settings.get().name))),
      h('span.sp'),
      h('div.dclock', time, date),
      h('button.dclose', { type: 'button', 'aria-label': 'Close systems', onclick: () => close() }, '✕'),
    ),
    tiles,
    quick,
  );
  const deck = h('div#deck', box);
  deck.addEventListener('click', (e) => e.target === deck && close());
  document.body.append(deck);

  let timer = 0;
  const tick = () => {
    const d = new Date();
    time.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    date.textContent = `${DAYS[d.getDay()]} ${pad(d.getDate())} ${MONTHS[d.getMonth()]}`;
  };

  const paint = () => {
    const cur = ui.get().tab;
    const tile = (t: TabDef, i: number) => h(`button.dtile${t.id === cur ? '.on' : ''}` as 'button', {
      type: 'button',
      dataset: { id: t.id, area: areaOf(t.id)?.id ?? '' },
      style: `animation-delay:${i * 22}ms;--tint:${areaOf(t.id)?.tint ?? '#8e8e93'}`,
      onclick: () => {
        close(true);
        go(t.id);
      },
    }, icon(t.icon), h('b', { dataset: ACRONYM.test(t.title) ? { label: niceCase(t.title) } : {} }, t.title), h('small', t.blurb ?? ''));
    const all = tabs().filter((t) => !t.hub);
    // The calm looks group the screens by area under small headings (a home screen with folders' names);
    // the classic looks keep the plain list.
    if (proLook()) {
      let i = 0;
      clear(tiles, ...AREAS.flatMap((a) => [h('h4.dsec', { style: `--tint:${a.tint}` }, a.title), ...a.tabs.map((id) => all.find((t) => t.id === id)).filter((t): t is TabDef => !!t).map((t) => tile(t, i++))]));
    } else clear(tiles, ...all.map(tile));
    quick.hidden = true;
    clear(box.querySelector('.dtitle span')!, 'AT YOUR SERVICE, ', h('i.dname', settings.get().name)); // the name as typed (the classic look shows it in capitals)
  };

  const esc = (e: KeyboardEvent) => e.key === 'Escape' && close();
  const open = () => {
    if (deck.classList.contains('on')) return;
    paint();
    tick();
    timer = window.setInterval(tick, 1000);
    deck.classList.add('on');
    document.body.classList.add('decked');
    addEventListener('keydown', esc);
    sfx('open');
    (tiles.querySelector('.on') as HTMLElement | null)?.focus({ preventScroll: true });
  };
  /** quiet: a tile was chosen, so the tab change makes the sound instead. */
  const close = (quiet = false) => {
    if (!deck.classList.contains('on')) return;
    deck.classList.remove('on');
    document.body.classList.remove('decked');
    clearInterval(timer);
    removeEventListener('keydown', esc);
    if (!quiet) sfx('close');
  };
  const toggle = () => (deck.classList.contains('on') ? close() : open());
  register({ id: 'open_systems', title: 'Systems deck (every screen)', group: 'SYSTEM', keys: 'm', run: toggle });
  return { open, close: () => close(), toggle };
}
