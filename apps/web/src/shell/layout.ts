/** The frame around every tab: top bar, stage, dock, HUD frame and the systems deck. */
import { togglePalette } from '../commands/registry';
import { h, icon, pad } from '../core/dom';
import { memoryPaused, pauseEndsAt } from '../api/brain';
import { player, stopAudio } from '../assistant/media';
import { ui } from '../state/app';
import { buildLauncher } from './launcher';
import { modal } from '../ui/components';
import { go } from './tabs';
import { buildTabBar, navInfo, navTo } from './areas';
import { niceCase } from '../ui/components';
import { listMode, type ListGroup } from '../ui/listmode';
import { startTv } from '../tv'; // [restc] TV MODE: big targets, the focus ring, the d-pad; the no-3-D fallbacks

/** The pages shown as an iOS Settings list, and their names for the back button. */
const LISTED: Record<string, string> = { settings: 'Settings', system: 'System', links: 'Links' };
/** Their groups: a small title above each card, a footer under it where a line explains something.
 *  A group's panels must follow each other in one column, or its title and footer are drawn twice
 *  (CHARACTER sits in the other column from VOICE and OFFLINE, so it has no group of its own). */
const GROUPS: Record<string, ListGroup[]> = {
  settings: [
    { title: 'Appearance', match: /^THEME/, foot: 'Reactor or Graphite: the same screens in another colour.' },
    { title: 'You', match: /^NAME/ },
    { title: 'Voice and home', match: /^(VOICE|OFFLINE)/, foot: 'The offline brain answers on this phone when there is no signal.' },
    { title: 'Ghosty', match: /^(SYSTEM|LINKS)$/ },
    { title: 'About', match: /^(ABOUT|PRIVACY|HELP)$/ },
  ],
  system: [
    { title: 'Brain', match: /^(KEYS|AI|GITHUB)/, foot: 'Keys are kept in your own Cloudflare account and never shown again once saved.' },
    { title: 'Data', match: /^(STORAGE|BACKUP)/ },
    // [offline2] SYSTEM → INDEPENDENCE (features/system/independence.ts), matched here as in the screen's sections (Report card)
    { title: 'Your own brains', match: /^INDEPENDENCE/, foot: 'How much of what you ask stays on this phone, kind by kind, and why the rest still goes to the cloud.' },
  ],
  links: [
    // (TELEGRAM CHANNEL is one of his social accounts, not the paired bot: without the lookahead the Accounts heading was drawn
    // twice on LINKS, once before EMAIL and again before the channel, after the social panels)
    { title: 'Accounts', match: /^(EMAIL|SPOTIFY|TELEGRAM(?! CHANNEL))/ },
    { title: 'Social', match: /^(BLUESKY|MASTODON|DISCORD|TELEGRAM CHANNEL)/, foot: 'The accounts you made for me: every post waits for your APPROVE.' },
    { title: 'This phone', match: /^(PHONE|NOTIF)/ },
    // [restd] HOME ASSISTANT follows GITHUB in the same column (features/links/index.ts): one Services card
    { title: 'Services', match: /^(LIVE|AI|GITHUB|HOME ASSISTANT)/ },
  ],
};
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
    np.textContent = p.now ? `♪ ${p.state === 'loading' ? 'Connecting' : p.state === 'error' ? `${p.now.name} didn't play` : p.state === 'paused' ? `${p.now.name} · paused` : p.now.name}` : ''; // (the Radio pass's words)
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
  // The navigation bar: "‹ Learn" back to the area, and where you are as a large title.
  const back = h('button.navback', { type: 'button', 'aria-label': 'Back' }, icon('<path d="M15 4.5L7.5 12l7.5 7.5"/>'), h('span'));
  back.addEventListener('click', () => {
    if (pushed) return pushed.pop();
    const n = navInfo(ui.get().tab);
    if (n?.backTo) navTo(n.backTo, 'pop');
  });
  const navTitle = h('h1.navtitle');
  // A screen pushed inside a tab (a Settings row, a Gym game, the conversation): the bar says where it came from.
  // ownBack: the screen brings its own back button (the conversation's, known to tests as .logbtn).
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
      // route C: a long name steps down a size rather than being cut ("Phone · App & Notifications")
      const n = navTitle.textContent.length;
      navTitle.dataset.len = n > 24 ? 'xl' : n > 17 ? 'l' : '';
      return;
    }
    pushed = null;
    document.body.classList.remove('ownback');
    const n = navInfo(tab);
    const pg = document.getElementById(`pg-${tab}`);
    if (pg && LISTED[tab]) listMode(pg, LISTED[tab]!, tab === 'system' ? /^STATUS/ : null, GROUPS[tab]);
    document.body.dataset.depth = !n || tab === 'core' ? 'home' : n.back ? 'inner' : 'hub';
    (back.lastChild as HTMLElement).textContent = n?.back ?? '';
    back.hidden = !n?.back;
    // the reactor's greeting keeps the name as typed
    navTitle.textContent = tab === 'core' ? n?.title ?? '' : niceCase(n?.title ?? '');
    navTitle.dataset.case = 'keep';
    navTitle.dataset.len = '';
  };
  // the greeting follows the clock
  setInterval(() => ui.get().tab === 'core' && !pushed && paintNav(), 60_000);
  const top = h('header#top', back, h('button.logo', { type: 'button', onclick: () => deck.toggle(), title: 'Systems — every screen (M)', 'aria-label': 'Open systems' }, icon(LOGO), h('span.lname', 'GHOSTY'), h('i.caret')), status, h('span.sp'), pausedTag, np, npStop, h('button.cmd', { type: 'button', onclick: togglePalette, title: 'Command palette (Ctrl/Cmd+K or /)' }, 'CMD'), clock, dot, navTitle);
  const stage = h('main#stage');
  const dock = h('nav#dock', { 'aria-label': 'Tabs' });
  const deck = buildLauncher();
  // Route C: offline, every screen but Home (its own pill says so) shows one quiet line above the tab bar.
  const offline = h('div#rcoffline', { role: 'status', 'aria-live': 'polite', dataset: { case: 'keep' } }, h('i'), h('b', 'Offline'), h('span', ' · showing what’s saved on this phone'));
  document.getElementById('app')!.append(top, stage, dock, offline);

  let paintTabBar: (() => void) | null = null;
  // The five areas in a floating glass pill, and the round "you" in the navigation bar (shell/areas.ts).
  const buildDock = () => {
    dock.classList.add('areas');
    document.querySelector('#top .you')?.remove();
    paintTabBar = buildTabBar(dock, () => deck.open());
    document.body.classList.add('tabbar');
    paintNav();
  };
  const paintDock = () => {
    paintNav();
    paintTabBar?.();
  };
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
  // The keyboard: iPhone Safari covers the bottom of the screen with it but leaves the page as tall as before (only
  // the visual viewport shrinks). While it is up the app, a sheet and the deck fit the part still visible (body.kb,
  // --vvh / --vvt in styles.css), so the ask bar and the field being typed in sit just above it and every page still
  // scrolls to its end; the tab bar steps aside meanwhile. A pinch-zoom shrinks the viewport too: that is not a keyboard.
  const vv = window.visualViewport;
  if (vv) {
    const rootEl = document.documentElement;
    const fit = () => {
      const el = document.activeElement as HTMLElement | null;
      const typing = !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
      const kb = typing && vv.scale < 1.05 && innerHeight - vv.height > 120;
      document.body.classList.toggle('kb', kb);
      if (kb) {
        rootEl.style.setProperty('--vvh', `${Math.round(vv.height)}px`);
        rootEl.style.setProperty('--vvt', `${Math.round(vv.offsetTop)}px`);
      } else if (rootEl.style.getPropertyValue('--vvh')) {
        rootEl.style.removeProperty('--vvh');
        rootEl.style.removeProperty('--vvt');
        if (scrollY) scrollTo(0, 0); // Safari can leave the page pushed up once the keyboard has gone
      }
    };
    vv.addEventListener('resize', fit);
    vv.addEventListener('scroll', fit);
    addEventListener('focusin', fit);
    addEventListener('focusout', () => setTimeout(fit, 0));
  }
  const tick = () => {
    const d = new Date();
    clock.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };
  tick();
  setInterval(tick, 1000);
  // [restc] TV MODE (tv/index.ts): on by itself on a television or from SETTINGS → THEME; and, anywhere WebGL is missing,
  // God's Eye flat, the Studio and the 3-D games said to be hidden
  startTv();
  return { stage, buildDock };
}
