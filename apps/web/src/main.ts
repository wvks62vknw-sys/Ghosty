/**
 * Ghosty interface — boot sequence. The boot cinematic (shell/boot.ts: MIND waking up) plays over all of this from the
 * first frame and never holds it up; it lands on Home once both are done.
 *  1. theme + 3D engine + Earth data
 *  2. connect to the brain (Cloudflare Access, or pair this device with the owner key)
 *  3. build the shell, open the first tab, start the single frame loop
 */
import { AuthError, brain, mirrorLibraryNow, ownerKey, refreshKeyCopy, sendQueued } from './api/brain';
import { onLocalReminder } from './api/offline';
import { startNotices } from './assistant/notices';
import { initApp } from './assistant/push';
import { loadHistory } from './assistant/session';
import { syncTrained } from './offline/trained';
import { startMeaning } from './library/meaning';
import { finishSpotifyLink } from './assistant/spotify';
import { startNight } from './night';
import { registerBuiltins } from './commands/builtin';
import { h } from './core/dom';
import { gfx } from './engine/gfx';
import { startLoop } from './engine/scheduler';
import { World } from './engine/world';
import { TABS } from './features';
import { autoBackup } from './features/system/backup';
import { checkStorage, persistAsksQuietly } from './features/system/storage';
import { bootFault, bootReady, bootState, startBoot } from './shell/boot';
import { buildLayout } from './shell/layout';
import { go, registerTabs } from './shell/tabs';
import { settings, ui } from './state/app';
import { applyMood, applyTheme, settleTheme } from './state/theme';
import { mood } from './state/mood';
import { button, toast } from './ui/components';

/**
 * Ask for the owner key on this device (only needed when Cloudflare Access isn't set up). A real
 * sign-in form — a username ("Ghosty owner", hidden) and a password field — so iPhone offers to
 * save the key in Passwords (iCloud Keychain) and fills it with Face ID next time. The form is
 * taken away once the key works, which is what tells Safari the sign-in succeeded.
 */
function pair(reason: string): Promise<void> {
  return new Promise((resolve) => {
    const input = h('input', { type: 'password', name: 'password', id: 'pair-key', placeholder: 'Owner key', autocomplete: 'current-password', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', required: true, 'aria-label': 'Owner key' });
    // Present (password managers need it) but out of sight and out of the tab order.
    const user = h('input.pairuser', { type: 'text', name: 'username', id: 'pair-user', autocomplete: 'username', defaultValue: 'Ghosty owner', tabIndex: -1, 'aria-hidden': 'true' });
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
    const unlock = h('button.on', { type: 'submit' }, 'UNLOCK');
    // The username sits in the form ahead of the password (where iPhone looks for it) but outside
    // #pair, so the panel inside looks and works exactly as before.
    const box = h(
      'form#pairform',
      { method: 'post', action: '/', autocomplete: 'on' },
      user,
      h('div#pair', h('div.bx', h('h2', 'PAIR THIS DEVICE'), h('p', 'Ghosty only answers to its owner. Enter your owner password. It is stored on this device only.'), input, h('small.note.pairtip', 'Tip: let iPhone save this in Passwords — next time Face ID fills it in.'), unlock, msg, button('CONTINUE OFFLINE', () => { box.remove(); resolve(); }))),
    );
    // Enter in the field or UNLOCK: one submit, handled here (never a page load).
    box.addEventListener('submit', (e) => {
      e.preventDefault();
      void submit();
    });
    document.body.append(box);
    setTimeout(() => input.focus(), 50);
  });
}

async function connect(): Promise<void> {
  const health = await brain.health();
  if (!health) {
    ui.set({ connected: false });
    return;
  }
  if (health.preview) {
    // A preview of a proposed change: unreviewed code, so it must never see the password.
    ui.set({ connected: false });
    document.body.append(h('div#previewbar', 'PREVIEW OF A PROPOSED CHANGE · view only · previews never ask for your password — if this one does, do not type it'));
    return;
  }
  if (!health.secured) {
    // [restb] A fresh deployment has no owner yet: the first-run wizard makes the owner key on this phone, says what to put in
    // Cloudflare, pairs this phone and names the owner (features/system/firstrunui.ts; docs/DEPLOY-YOUR-OWN.md).
    const { firstRun } = await import('./features/system/firstrunui');
    if (await firstRun(pair)) ui.set({ connected: true });
    else if (ownerKey.get()) ui.set({ connected: true });
    return;
  }
  try {
    await brain.status();
    ui.set({ connected: true });
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

// Reminders set while the brain's database was paused go off from this device.
onLocalReminder((title, text) => {
  toast(`⏰ ${text}`, 'ok');
  if (settings.get().speak) void import('./assistant/voice').then((v) => v.speak(`Reminder: ${text}`));
  try {
    if ('Notification' in window && Notification.permission === 'granted') new Notification('Ghosty reminder', { body: text, tag: title, icon: '/icon-192.png' });
  } catch {
    /* notifications unavailable */
  }
});

async function boot(): Promise<void> {
  applyTheme(settleTheme());
  // his mood on the whole interface (state/mood.ts → theme.ts applyMood): a live overlay on the accent, never saved
  applyMood(mood.get().now.kind);
  mood.subscribe((s) => applyMood(s.now.kind));
  // the cinematic starts at once (in the theme's colour) and plays while everything below gets ready
  startBoot();
  const cv = document.getElementById('gl') as HTMLCanvasElement;
  gfx.init(cv);
  addEventListener('resize', () => gfx.resize());
  await World.load();
  await connect();
  const layout = buildLayout();
  registerTabs(TABS, layout.stage);
  registerBuiltins();
  layout.buildDock();
  if (ui.get().connected) {
    await loadHistory();
    startNotices();
    void initApp();
    // Paired: ask the phone to keep Ghosty's data (Safari grants it to Home Screen apps) when asking
    // makes no pop-up (Firefox would ask the owner on every start: there, PROTECT in SYSTEM asks); keep the daily backup going.
    void checkStorage(persistAsksQuietly());
    setTimeout(() => void autoBackup(), 20_000);
    window.setInterval(() => void autoBackup(), 3_600_000);
    // Changes made while the brain was unreachable (memory, agenda) go to it now.
    void sendQueued();
    void refreshKeyCopy();
    // Ghosty's whole library is copied to this device, so it can be searched with no database or connection.
    void mirrorLibraryNow();
    window.setInterval(() => void (navigator.onLine && mirrorLibraryNow()), 30 * 60_000);
    // Searched by meaning once that model is on the phone: the index keeps up with the copy (library/meaning.ts).
    startMeaning();
    window.setInterval(() => void (navigator.onLine && sendQueued()), 120_000);
    // The offline brain follows the weekly self-training's kept brains (a new week, a ROLLBACK) without opening its panel.
    void syncTrained();
    window.setInterval(() => void (navigator.onLine && syncTrained()), 3 * 3600_000);
  }
  // Back from Spotify's sign-in page (?code=…&state=…): finish linking, then show Links.
  const spotify = await finishSpotifyLink().catch(() => null);
  const first = spotify ? 'links' : location.hash.slice(1);
  if (!go(first)) go('core');
  if (spotify) toast(spotify.text, spotify.ok ? 'ok' : 'warn');
  addEventListener('hashchange', () => go(location.hash.slice(1)));
  startLoop();
  // Debug handle for the browser console: __ghosty.globe.cam, __ghosty.ui.get(), …
  (window as unknown as { __ghosty: unknown }).__ghosty = { gfx, globe: (await import('./engine/globe')).globe, ui, settings, stats: (await import('./engine/scheduler')).stats, run: (await import('./commands/registry')).run, boot: bootState, mood };
  // NIGHT SCHOOL (night/index.ts): its clock starts here; it does nothing until it is switched on in SYSTEM.
  if (ui.get().connected) startNight();
  // the app is up underneath: the cinematic may land (or, on a plain open, the black simply goes)
  bootReady();
  // a fresh phone: three things I can do, said once (abilities/firstrun.ts); on any other day, a while after it opens and with
  // nothing under way, at most one "did you know I can …?" (abilities/offer.ts)
  void import('./abilities/firstrun').then(async (f) => {
    const o = await import('./abilities/offer');
    if (f.firstRun()) o.noteFirstRun();
    else if (ui.get().connected) setTimeout(() => void o.dailyOffer().catch(() => undefined), 15_000);
  }).catch(() => undefined);
  gfx.post.flash = 0.6;
}

boot().catch((e) => {
  console.error(e);
  bootFault();
});
