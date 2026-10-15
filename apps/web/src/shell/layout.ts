/** The frame around every tab: top bar, stage, dock, HUD frame and the systems deck. */
import { togglePalette } from '../commands/registry';
import { clear, h, icon, pad } from '../core/dom';
import { memoryPaused } from '../api/brain';
import { player, stopAudio } from '../assistant/media';
import { ui } from '../state/app';
import { buildLauncher } from './launcher';
import { modal } from '../ui/components';
import { go, tabs } from './tabs';

const DECK = '<rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><rect x="14" y="14" width="6" height="6"/>';
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
  // Quiet tag while the database is paused (free daily allowance); tap for what still works.
  const pausedTag = h('button.pausedtag', {
    type: 'button',
    title: 'What still works',
    onclick: () =>
      modal('MEMORY PAUSED', h('div.mnote',
        h('p', "Ghosty's memory is paused until 1am UK time (midnight UTC): Cloudflare's free daily database allowance ran out. Nothing is lost."),
        h('p', h('b', 'Still working: '), "chat and AI, web search, weather, maps, God's Eye, radio, games and widgets (kept on this device, saved to Ghosty when memory is back)."),
        h('p', h('b', 'Back at 1am: '), 'saved memories, your library uploads, agenda and reminders.'),
      )),
  }, 'MEMORY PAUSED');
  pausedTag.hidden = true;
  memoryPaused.subscribe((m) => (pausedTag.hidden = !m.on));
  const top = h('header#top', h('button.logo', { type: 'button', onclick: () => deck.toggle(), title: 'Systems — every screen (M)', 'aria-label': 'Open systems' }, icon(LOGO), 'GHOSTY', h('i.caret')), status, h('span.sp'), pausedTag, np, npStop, h('button.cmd', { type: 'button', onclick: togglePalette, title: 'Command palette (Ctrl/Cmd+K or /)' }, 'CMD'), clock, dot);
  const stage = h('main#stage');
  const dock = h('nav#dock', { 'aria-label': 'Tabs' });
  const deck = buildLauncher();
  // Thin HUD frame around the whole screen: corner brackets and edge ticks (decoration only).
  const frame = h('div#frame', { 'aria-hidden': 'true' }, h('i.tl'), h('i.tr'), h('i.bl'), h('i.br'), h('b.scan'));
  document.getElementById('app')!.append(top, stage, dock);
  document.body.append(frame);

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
      const b = h('button', { type: 'button', dataset: { id: 'deck' } }, icon(DECK), h('span', 'SYSTEMS'));
      b.addEventListener('click', () => deck.open());
      dock.append(b);
    }
    paintDock();
  };
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
