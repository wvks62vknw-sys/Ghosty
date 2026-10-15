/** The frame around every tab: top bar, stage, dock (and MORE launcher on phones). */
import { togglePalette } from '../commands/registry';
import { clear, h, icon, pad } from '../core/dom';
import { player, stopAudio } from '../assistant/media';
import { ui } from '../state/app';
import { go, tabs } from './tabs';

const MORE = '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>';
const LOGO = '<path d="M12 3c-4 0-7 3-7 7v11l2.5-2 2 2 2.5-2 2.5 2 2-2 2.5 2V10c0-4-3-7-7-7z"/><circle cx="9.5" cy="10.5" r="1.1"/><circle cx="14.5" cy="10.5" r="1.1"/>';

export function buildLayout(): { stage: HTMLElement; buildDock: () => void } {
  const dot = h('i.conn');
  const clock = h('span.clock');
  const status = h('span.tstatus');
  const np = h('button.nowplaying', { type: 'button', title: 'Radio — tap to open, ■ to stop', onclick: () => go('radio') });
  np.hidden = true;
  const npStop = h('button.npstop', { type: 'button', title: 'Stop radio', onclick: () => stopAudio() }, '■');
  npStop.hidden = true;
  player.subscribe((p) => {
    np.hidden = npStop.hidden = !p.now;
    np.textContent = p.now ? `♪ ${p.state === 'loading' ? 'TUNING' : p.state === 'error' ? 'NO SIGNAL' : p.now.name}` : '';
  });
  const top = h('header#top', h('b.logo', { onclick: () => go('core'), title: 'Core' }, icon(LOGO), 'GHOSTY'), status, h('span.sp'), np, npStop, h('button.cmd', { type: 'button', onclick: togglePalette, title: 'Command palette (Ctrl/Cmd+K or /)' }, 'CMD'), clock, dot);
  const stage = h('main#stage');
  const dock = h('nav#dock', { 'aria-label': 'Tabs' });
  const more = h('div#more', { role: 'dialog', 'aria-label': 'More tabs' });
  document.getElementById('app')!.append(top, stage, dock);
  document.body.append(more);

  const buildDock = () => {
    const wide = innerWidth >= 900;
    const list = tabs();
    const shown = wide ? list : list.filter((t) => t.primary).slice(0, 5);
    clear(dock);
    for (const t of shown) {
      const b = h('button', { type: 'button', dataset: { id: t.id }, title: t.title }, icon(t.icon), h('span', t.title.replace("GOD'S ", '')));
      b.addEventListener('click', () => go(t.id));
      dock.append(b);
    }
    if (!wide) {
      const b = h('button', { type: 'button', dataset: { id: 'more' } }, icon(MORE), h('span', 'MORE'));
      b.addEventListener('click', () => {
        clear(more, h('div.grid', ...list.filter((t) => !shown.includes(t)).map((t) => {
          const x = h('button', { type: 'button' }, icon(t.icon), h('span', t.title));
          x.addEventListener('click', () => {
            more.classList.remove('on');
            go(t.id);
          });
          return x;
        })));
        more.classList.add('on');
      });
      dock.append(b);
    }
    paintDock();
  };
  more.addEventListener('click', (e) => e.target === more && more.classList.remove('on'));
  const paintDock = () => [...dock.children].forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.id === ui.get().tab));
  let wasWide = innerWidth >= 900;
  addEventListener('resize', () => {
    const wide = innerWidth >= 900;
    if (wide !== wasWide) {
      wasWide = wide;
      buildDock();
    }
  });
  ui.subscribe((s, p) => {
    if (s.tab !== p.tab) paintDock();
    status.textContent = s.busy ? `● ${s.status || 'thinking…'}` : '';
    dot.className = `conn ${s.connected === false ? 'off' : s.connected ? 'on' : ''}`;
    dot.title = s.connected === false ? 'Brain unreachable' : 'Brain connected';
  });
  const tick = () => {
    const d = new Date();
    clock.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };
  tick();
  setInterval(tick, 1000);
  return { stage, buildDock };
}
