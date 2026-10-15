// Installable app + push: manifest, service worker, a push message delivered through the
// browser's own push pipeline (Chrome DevTools Protocol) becomes a notification.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const problems = [];
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.grantPermissions(['notifications'], { origin: base });
const page = await ctx.newPage();
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
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

// Deliver a push straight to the service worker, as a push service would.
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

await page.evaluate(() => (location.hash = 'system'));
await page.waitForTimeout(1500);
await page.click('#pg-system .swap');
await page.waitForTimeout(500);
const panelText = await page.evaluate(() => [...document.querySelectorAll('#pg-system .pn')].map((p) => p.textContent).join(' '));
if (!/PHONE APP & NOTIFICATIONS/.test(panelText) || !/TURN ON NOTIFICATIONS|TURN OFF HERE/.test(panelText)) problems.push('System panel for notifications missing');
await page.screenshot({ path: `${out}/phone-system-app.png` });
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : `App run clean (manifest ${manifest.n} icons, service worker active, push → notification).`);
process.exit(problems.length ? 1 : 0);
