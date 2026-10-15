/**
 * Ghosty interface — boot sequence.
 *  1. theme + 3D engine + Earth data
 *  2. connect to the brain (Cloudflare Access, or pair this device with the owner key)
 *  3. build the shell, open the first tab, start the single frame loop
 */
import { AuthError, brain, ownerKey } from './api/brain';
import { startNotices } from './assistant/notices';
import { initApp } from './assistant/push';
import { loadHistory } from './assistant/session';
import { registerBuiltins } from './commands/builtin';
import { h } from './core/dom';
import { gfx } from './engine/gfx';
import { startLoop } from './engine/scheduler';
import { World } from './engine/world';
import { TABS } from './features';
import { buildLayout } from './shell/layout';
import { go, registerTabs } from './shell/tabs';
import { settings, ui } from './state/app';
import { applyTheme } from './state/theme';
import { button } from './ui/components';

const bootEl = document.getElementById('boot')!;
const bootLog = (text: string, ok = 'OK') => bootEl.querySelector('.log')!.append(h('div', h('span', text), h('b', ok)));

/** Ask for the owner key on this device (only needed when Cloudflare Access isn't set up). */
function pair(reason: string): Promise<void> {
  return new Promise((resolve) => {
    const input = h('input', { type: 'password', placeholder: 'Owner key', autocomplete: 'current-password', 'aria-label': 'Owner key' });
    const msg = h('p.note', reason);
    const submit = async () => {
      ownerKey.set(input.value.trim());
      try {
        await brain.status();
        box.remove();
        resolve();
      } catch (e) {
        msg.textContent = e instanceof AuthError ? 'That key was not accepted.' : `Brain unreachable: ${String((e as Error).message)}`;
      }
    };
    input.addEventListener('keydown', (e) => e.key === 'Enter' && void submit());
    const box = h('div#pair', h('div.bx', h('h2', 'PAIR THIS DEVICE'), h('p', 'Ghosty only answers to its owner. Enter your owner password. It is stored on this device only.'), input, button('UNLOCK', () => void submit(), 'on'), msg, button('CONTINUE OFFLINE', () => { box.remove(); resolve(); })));
    document.body.append(box);
    setTimeout(() => input.focus(), 50);
  });
}

async function connect(): Promise<void> {
  const health = await brain.health();
  if (!health) {
    ui.set({ connected: false });
    bootLog('BRAIN', 'UNREACHABLE');
    return;
  }
  if (!health.secured) {
    bootLog('BRAIN', 'NOT SECURED');
    await pair('The brain is running but not secured yet: set OWNER_KEY_HASH, OWNER_KEY or Cloudflare Access (see SETUP.md). Until then it refuses every request.');
    return;
  }
  try {
    await brain.status();
    ui.set({ connected: true });
    bootLog('BRAIN', 'LINKED');
  } catch (e) {
    if (e instanceof AuthError) {
      await pair(ownerKey.get() ? 'The saved key was not accepted.' : 'Sign-in needed.');
      try {
        await brain.status();
        ui.set({ connected: true });
      } catch {
        ui.set({ connected: false });
      }
    } else ui.set({ connected: false });
  }
}

async function boot(): Promise<void> {
  applyTheme(settings.get().theme);
  const cv = document.getElementById('gl') as HTMLCanvasElement;
  bootLog('RENDER CORE', gfx.init(cv) ? 'WEBGL2' : 'NO WEBGL2');
  addEventListener('resize', () => gfx.resize());
  bootLog('EARTH DATA', (await World.load()) ? `${World.cities.length} CITIES` : 'MISSING');
  await connect();
  const layout = buildLayout();
  registerTabs(TABS, layout.stage);
  registerBuiltins();
  layout.buildDock();
  if (ui.get().connected) {
    await loadHistory();
    startNotices();
    void initApp();
  }
  const first = location.hash.slice(1);
  if (!go(first)) go('core');
  addEventListener('hashchange', () => go(location.hash.slice(1)));
  startLoop();
  // Debug handle for the browser console: __ghosty.globe.cam, __ghosty.ui.get(), …
  (window as unknown as { __ghosty: unknown }).__ghosty = { gfx, globe: (await import('./engine/globe')).globe, ui, settings, stats: (await import('./engine/scheduler')).stats, run: (await import('./commands/registry')).run };
  bootEl.classList.add('out');
  setTimeout(() => bootEl.remove(), 700);
  gfx.post.flash = 0.6;
}

boot().catch((e) => {
  console.error(e);
  bootLog('BOOT FAULT', String((e as Error)?.message ?? e).slice(0, 60));
});
