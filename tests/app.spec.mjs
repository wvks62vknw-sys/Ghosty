// Installable app + push: manifest, service worker, a push message delivered through the
// browser's own push pipeline (Chrome DevTools Protocol) becomes a notification.
import { isWebKit, launch, webkitNoise } from './browser.mjs';
import { mkdirSync } from 'node:fs';
import { openDeck } from './nav.mjs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
// The full browser (not the stripped-down headless shell), which supports notifications.
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, ...(process.env.CHROMIUM ? {} : { channel: 'chromium' }), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const problems = [];
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' }); // (the default; WebKit runs block it otherwise)
await ctx.grantPermissions(['notifications'], { origin: base });
const page = await ctx.newPage();
page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
await page.goto(base);
await page.fill('#pair input', 'preview-owner-key-0123456789');
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });

const manifest = await page.evaluate(async () => {
  const href = document.querySelector('link[rel=manifest]')?.getAttribute('href');
  const j = await (await fetch(href)).json();
  const icons = await Promise.all(j.icons.map(async (i) => (await fetch(i.src)).ok));
  return { name: j.name, display: j.display, iconsOk: icons.every(Boolean), n: icons.length };
});
if (manifest.name !== 'Ghosty' || manifest.display !== 'standalone' || !manifest.iconsOk) problems.push(`manifest: ${JSON.stringify(manifest)}`);

const sw = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready;
  return { active: !!reg.active, scope: reg.scope };
});
if (!sw.active) problems.push('service worker not active');

// Deliver a push straight to the service worker, as a push service would. That needs Chrome DevTools
// Protocol, which only Chromium has: in WebKit the push pipeline is not driven (the rest of the run is).
if (!isWebKit) {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('ServiceWorker.enable');
  const regId = await new Promise((resolve) => {
    cdp.on('ServiceWorker.workerRegistrationUpdated', (e) => {
      const r = e.registrations.find((x) => x.scopeURL.startsWith(base));
      if (r) resolve(r.registrationId);
    });
    setTimeout(() => resolve(null), 5000);
  });
  if (!regId) problems.push('no service worker registration seen over CDP');
  else {
    await cdp.send('ServiceWorker.deliverPushMessage', { origin: base, registrationId: regId, data: JSON.stringify({ title: '⏰ Reminder', body: 'stretch', tag: 't1', url: '/#agenda' }) });
    let notes = [];
    for (let i = 0; i < 20 && !notes.length; i++) {
      await page.waitForTimeout(500);
      notes = await page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => `${n.title}|${n.body}`));
    }
    if (!notes.includes('⏰ Reminder|stretch')) problems.push(`push did not become a notification: ${JSON.stringify(notes)}`);
  }
}

// The systems deck (from the avatar's Me sheet) lists every screen; LINKS holds email, Spotify and notifications.
await openDeck(page);
await page.waitForSelector('#deck.on', { timeout: 3000 }).catch(() => problems.push('systems deck did not open'));
const tiles = await page.$$eval('#deck .dtile b', (n) => n.map((x) => x.textContent));
if (tiles.length < 12 || !tiles.includes('LINKS') || !tiles.includes('LIBRARY')) problems.push(`systems deck tiles: ${tiles.join(', ')}`);
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/phone-deck.png` });
await page.click('#deck .dtile[data-id="links"]');
await page.waitForTimeout(1500);
if (await page.$('#deck.on')) problems.push('systems deck did not close after choosing a screen');
const panelText = await page.evaluate(() => [...document.querySelectorAll('#pg-links .pn')].map((p) => p.textContent).join(' '));
for (const want of ['EMAIL', 'SPOTIFY', 'PHONE · APP & NOTIFICATIONS', 'AI BRAIN', 'GITHUB']) if (!panelText.includes(want)) problems.push(`Links: ${want} panel missing`);
if (!/TURN ON NOTIFICATIONS|TURN OFF HERE/.test(panelText)) problems.push('Links: notifications button missing');
if (!/LINK EMAIL/.test(panelText) || !(await page.$('#pg-links select[aria-label="Email provider"]'))) problems.push('Links: email sign-in form missing');
if (!/LINK SPOTIFY|UNLINK/.test(panelText)) problems.push('Links: Spotify link button missing');
// On a phone everything is on one scrolling page: the last panel can be scrolled into view.
const reach = await page.evaluate(() => {
  const hud = document.querySelector('#pg-links .hud');
  const last = [...document.querySelectorAll('#pg-links .pn')].pop();
  hud.scrollTop = hud.scrollHeight;
  const r = last.getBoundingClientRect();
  return r.top < innerHeight && r.bottom > 0 && getComputedStyle(last).display !== 'none';
});
if (!reach) problems.push('Links: the last panel cannot be scrolled into view on a phone');
await page.evaluate(() => (document.querySelector('#pg-links .hud').scrollTop = 0));
await page.screenshot({ path: `${out}/phone-links.png` });

// God's Eye layers on a phone: a sheet of tiles where every layer can be reached and switched.
await page.evaluate(() => (location.hash = 'eye'));
await page.waitForTimeout(1500);
await page.click('.eyelay h3');
await page.waitForTimeout(300);
const sheet = await page.evaluate(() => {
  const tiles = [...document.querySelectorAll('.eyelay .ltile')];
  const last = tiles[tiles.length - 1];
  last?.scrollIntoView({ block: 'nearest' });
  const r = last?.getBoundingClientRect();
  return { n: tiles.length, visible: !!r && r.bottom <= innerHeight && r.top >= 0 && r.right <= innerWidth, groups: document.querySelectorAll('.eyelay .lgroup').length };
});
if (sheet.n < 20 || !sheet.visible || sheet.groups < 4) problems.push(`God's Eye layers on a phone: ${JSON.stringify(sheet)}`);
const before = await page.evaluate(() => window.__ghosty.globe.vis.traffic);
await page.click('.eyelay .ltile:has-text("LIVE TRAFFIC")');
if ((await page.evaluate(() => window.__ghosty.globe.vis.traffic)) === before) problems.push('tapping a layer tile did not switch it');
await page.screenshot({ path: `${out}/phone-layers.png` });
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : `App run clean (manifest ${manifest.n} icons, service worker active, ${isWebKit ? 'push not driven: no CDP in WebKit' : 'push → notification'}).`);
process.exit(problems.length ? 1 : 0);
