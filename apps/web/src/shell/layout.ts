/** The frame around every tab: top bar, stage, dock, HUD frame and the systems deck. */
import { togglePalette } from '../commands/registry';
import { clear, h, icon, pad } from '../core/dom';
import { memoryPaused, pauseEndsAt } from '../api/brain';
import { player, stopAudio } from '../assistant/media';
import { ui } from '../state/app';
import { buildLauncher } from './launcher';
import { modal } from '../ui/components';
import { go, tabs } from './tabs';
import { buildTabBar, navInfo, navTo } from './areas';
import { proLook, themeEvents } from '../state/theme';
import { niceCase } from '../ui/components';
import { listMode, type ListGroup } from '../ui/listmode';

/** The pages shown as an iOS Settings list in the calm looks, and their names for the back button. */
const LISTED: Record<string, string> = { settings: 'Settings', system: 'System', links: 'Links' };
/** Their groups: a small title above each card, a footer under it where a line explains something.
 *  A group's panels must follow each other in one column, or its title and footer are drawn twice
 *  (CHARACTER sits in the other column from VOICE and OFFLINE, so it has no group of its own). */
const GROUPS: Record<string, ListGroup[]> = {
  settings: [
    { title: 'Appearance', match: /^LOOK/ },
    { title: 'Voice and home', match: /^(VOICE|OFFLINE)/, foot: 'The offline brain answers on this phone when there is no signal.' },
    { title: 'Ghosty', match: /^(SYSTEM|LINKS)$/ },
    { title: 'About', match: /^(ABOUT|PRIVACY|HELP)$/ },
  ],
  system: [
    { title: 'Brain', match: /^(KEYS|AI|GITHUB)/, foot: 'Keys are kept in your own Cloudflare account and never shown again once saved.' },
    { title: 'Data', match: /^(STORAGE|BACKUP)/ },
  ],
  links: [
    { title: 'Accounts', match: /^(EMAIL|SPOTIFY|TELEGRAM)/ },
    { title: 'This phone', match: /^(PHONE|NOTIF)/ },
    { title: 'Services', match: /^(LIVE|AI|GITHUB)/ },
  ],
};
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
        h('p', `Ghosty's memory is paused until ${new Date(pauseEndsAt(memoryPaused.get().since || Date.now())).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} (midnight UTC): Cloudflare's free daily database allowance ran out. Nothing is lost.`),
        h('p', h('b', 'Still working: '), "chat and AI with your keys, web search, weather, maps, traffic, God's Eye, email, radio, Spotify, games and widgets — and your memory, agenda, reminders and documents from the copy on this device."),
        h('p', h('b', 'Saved when memory is back: '), "anything you add or change meanwhile (memories, reminders, events, widgets, documents) — automatically. A key you add meanwhile is kept straight away and works at once."),
        h('p', h('b', 'Waits for the reset: '), 'importing web pages into the library, push notifications to your phone, self-study and code changes. The SYSTEM tab shows what used up the allowance.'),
      )),
  }, 'MEMORY PAUSED');
  pausedTag.hidden = true;
  memoryPaused.subscribe((m) => (pausedTag.hidden = !m.on));
  // The calm looks' navigation bar: "‹ Learn" back to the area, and where you are as a large title.
  const back = h('button.navback', { type: 'button', 'aria-label': 'Back' }, icon('<path d="M15 4.5L7.5 12l7.5 7.5"/>'), h('span'));
  back.addEventListener('click', () => {
    if (pushed) return pushed.pop();
    const n = navInfo(ui.get().tab);
    if (n?.backTo) navTo(n.backTo, 'pop');
  });
  const navTitle = h('h1.navtitle');
  // A screen pushed inside a tab (a Settings row, a Gym game, the conversation): the bar says where it came from.
  // ownBack: the screen brings its own back button (the conversation's, known to tests and the classic looks as .logbtn).
  let pushed: { back: string; title: string; label: string; pop: () => void; ownBack?: boolean; tab: string } | null = null;
  addEventListener('ghosty:push', (e) => {
    const d = (e as CustomEvent).detail;
    pushed = d ? { ...d, tab: ui.get().tab } : null;
    paintNav();
  });
  const paintNav = () => {
    const tab = ui.get().tab;
    document.body.dataset.tab = tab;
    if (pushed && pushed.tab === tab) {
      document.body.dataset.depth = 'inner';
      document.body.classList.toggle('ownback', !!pushed.ownBack);
      (back.lastChild as HTMLElement).textContent = pushed.back;
      back.hidden = !!pushed.ownBack;
      navTitle.textContent = pushed.label || niceCase(pushed.title.split(' · ')[0]!);
      navTitle.dataset.case = 'keep';
      return;
    }
    pushed = null;
    document.body.classList.remove('ownback');
    const n = navInfo(tab);
    const pg = document.getElementById(`pg-${tab}`);
    if (pg && LISTED[tab] && proLook()) listMode(pg, LISTED[tab]!, tab === 'system' ? /^STATUS/ : null, GROUPS[tab]);
    document.body.dataset.depth = !n || tab === 'core' ? 'home' : n.back ? 'inner' : 'hub';
    (back.lastChild as HTMLElement).textContent = n?.back ?? '';
    back.hidden = !n?.back;
    // the reactor's greeting keeps the name as typed
    navTitle.textContent = tab === 'core' ? n?.title ?? '' : niceCase(n?.title ?? '');
    navTitle.dataset.case = 'keep';
  };
  // the greeting follows the clock
  setInterval(() => ui.get().tab === 'core' && !pushed && paintNav(), 60_000);
  const top = h('header#top', back, h('button.logo', { type: 'button', onclick: () => deck.toggle(), title: 'Systems — every screen (M)', 'aria-label': 'Open systems' }, icon(LOGO), h('span.lname', 'GHOSTY'), h('i.caret')), status, h('span.sp'), pausedTag, np, npStop, h('button.cmd', { type: 'button', onclick: togglePalette, title: 'Command palette (Ctrl/Cmd+K or /)' }, 'CMD'), clock, dot, navTitle);
  const stage = h('main#stage');
  const dock = h('nav#dock', { 'aria-label': 'Tabs' });
  const deck = buildLauncher();
  // Route C: offline, every screen but Home (its own pill says so) shows one quiet line above the tab bar.
  const offline = h('div#rcoffline', { role: 'status', 'aria-live': 'polite', dataset: { case: 'keep' } }, h('i'), h('b', 'Offline'), h('span', ' · showing what this phone has saved; it updates when the brain is back'));
  document.getElementById('app')!.append(top, stage, dock, offline);

  let paintTabBar: (() => void) | null = null;
  const buildDock = () => {
    dock.classList.toggle('areas', proLook());
    document.querySelector('#top .you')?.remove();
    paintTabBar = proLook() ? buildTabBar(dock, () => deck.open()) : null;
    document.body.classList.toggle('tabbar', !!paintTabBar);
    if (paintTabBar) return paintNav();
    const wide = innerWidth >= 900;
    const list = tabs().filter((t) => !t.hub);
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
  const paintDock = () => {
    paintNav();
    if (paintTabBar) return paintTabBar();
    [...dock.children].forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.id === ui.get().tab));
  };
  // Switching between a classic look and a calm one swaps the dock for the tab bar (and back).
  let wasPro = proLook();
  themeEvents.on('change', () => {
    if (proLook() !== wasPro) {
      wasPro = proLook();
      buildDock();
    }
  });
  let wasWide = innerWidth >= 900;
  addEventListener('resize', () => {
    const wide = innerWidth >= 900;
    if (wide !== wasWide && !paintTabBar) {
      wasWide = wide;
      buildDock();
    }
  });
  ui.subscribe((s, p) => {
    if (s.tab !== p.tab) paintDock();
    status.textContent = s.busy ? (s.status || 'thinking…') : '';
    // The signal line under the top bar follows Ghosty's state (see #top::after in styles.css).
    document.body.classList.toggle('busy', !!s.busy && s.voice !== 'speaking');
    document.body.classList.toggle('speaking', s.voice === 'speaking');
    document.body.classList.toggle('listening', s.voice === 'listening');
    document.body.classList.toggle('offline', s.connected === false);
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
