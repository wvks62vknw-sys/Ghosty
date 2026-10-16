/**
 * The systems deck: a full-screen holographic menu with every screen Ghosty has, each with
 * its icon, name and what it is for, plus quick actions. Opens from the GHOSTY logo (any
 * screen size), the SYSTEMS button in the phone dock, or the M key. Escape closes it.
 */
import { register, togglePalette } from '../commands/registry';
import { clear, h, icon, pad } from '../core/dom';
import { sfx } from '../assistant/sfx';
import { settings, ui } from '../state/app';
import { go, tabs } from './tabs';

const GEAR = '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>';
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
      h('div.dtitle', h('small', 'GHOSTY // SYSTEMS'), h('span', `AT YOUR SERVICE, ${settings.get().name.toUpperCase()}`)),
      h('span.sp'),
      h('div.dclock', time, date),
      h('button.dclose', { type: 'button', 'aria-label': 'Close systems', onclick: () => close() }, '✕'),
    ),
    tiles,
    quick,
  );
  const deck = h('div#deck', h('div.drings', h('i'), h('i'), h('i')), box);
  deck.addEventListener('click', (e) => e.target === deck && close());
  document.body.append(deck);

  let timer = 0;
  const tick = () => {
    const d = new Date();
    time.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    date.textContent = `${DAYS[d.getDay()]} ${pad(d.getDate())} ${MONTHS[d.getMonth()]}`;
  };

  const action = (label: string, run: () => void) => h('button', { type: 'button', onclick: () => { close(); run(); } }, label);
  const paint = () => {
    const cur = ui.get().tab;
    clear(tiles, ...tabs().map((t, i) => h(`button.dtile${t.id === cur ? '.on' : ''}` as 'button', {
      type: 'button',
      dataset: { id: t.id },
      style: { animationDelay: `${i * 28}ms` },
      onclick: () => {
        close(true);
        go(t.id);
      },
    }, icon(t.icon), h('b', t.title), h('small', t.blurb ?? ''))));
    // One more tile: Settings (name, units, voice, sounds, tilt, theme) — lives on the System tab.
    tiles.append(h('button.dtile.settings', {
      type: 'button',
      dataset: { id: 'settings' },
      style: { animationDelay: `${tabs().length * 28}ms` },
      onclick: () => {
        close(true);
        go('system');
        setTimeout(() => {
          const look = document.querySelector<HTMLElement>('#pg-system .pn.look');
          const box = look?.closest<HTMLElement>('.two.stack');
          if (look && box) box.scrollTo({ top: box.scrollTop + look.getBoundingClientRect().top - box.getBoundingClientRect().top - 8, behavior: 'smooth' });
          else look?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }, 120);
      },
    }, icon(GEAR), h('b', 'SETTINGS'), h('small', 'name · units · voice · sounds · tilt · theme')));
    quick.hidden = true;
    (box.querySelector('.dtitle span') as HTMLElement).textContent = `AT YOUR SERVICE, ${settings.get().name.toUpperCase()}`;
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
