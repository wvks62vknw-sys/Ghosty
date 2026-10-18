// LINKS → NOTIFICATIONS in a real browser: a switch per kind (reminders, morning brief, flashcards
// due, 3D model ready, price drops, upgrade ideas), kept by the brain (it checks them before every
// push) and still set after a reload; SEND A TEST; and on an iPhone in a Safari tab (not opened
// from the Home Screen) the plain sentence saying notifications need the Home Screen.
//   BASE=http://localhost:8852 node tests/notifications.spec.mjs [outDir]
//   (the iPhone part runs in WebKit when PLAYWRIGHT_BROWSERS_PATH has it: /tmp/claude-0/wk/browsers)
import { chromium, webkit } from 'playwright';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const HOME_ONLY = 'iPhone only allows notifications for apps on your Home Screen: Share → Add to Home Screen, then open Ghosty from there.';
const problems = [];
const check = (ok, what) => void (ok || problems.push(what));

async function open(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ...opts });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pair input', { timeout: 20000 });
  await page.fill('#pair input', KEY);
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
  await page.evaluate(() => (location.hash = 'links'));
  await page.waitForSelector('#pg-links button[data-kind]', { timeout: 15000 });
  return { ctx, page };
}
const prefs = (page) => page.evaluate(async (key) => (await (await fetch('/api/push/prefs', { headers: { 'x-ghosty': '1', 'x-ghosty-key': key } })).json()).prefs, KEY);

// ---- the switches (Chromium, a computer: no Home Screen sentence)
const chrome = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined });
{
  const { page } = await open(chrome);
  const kinds = await page.$$eval('#pg-links button[data-kind]', (bs) => bs.map((b) => `${b.dataset.kind}:${b.textContent}`));
  check(JSON.stringify(kinds) === JSON.stringify(['reminders:ON', 'brief:ON', 'flashcards:ON', 'model3d:ON', 'prices:ON', 'upgrades:ON']), `switches: ${kinds.join(', ')}`);
  const labels = await page.$$eval('#pg-links .rw', (rs) => rs.map((r) => r.querySelector('.k')?.textContent ?? ''));
  for (const l of ['REMINDERS', 'MORNING BRIEF', 'FLASHCARDS DUE', '3D MODEL READY', 'PRICE DROPS', 'UPGRADE IDEAS']) check(labels.includes(l), `no ${l} switch`);
  check(!(await page.$('#pg-links .homeonly')), 'Home Screen sentence shown on a computer');
  await page.click('#pg-links button[data-kind="reminders"]');
  await page.waitForFunction(() => document.querySelector('#pg-links button[data-kind="reminders"]')?.textContent === 'OFF', null, { timeout: 8000 }).catch(() => problems.push('REMINDERS did not switch off'));
  await page.click('#pg-links button[data-kind="upgrades"]');
  await page.waitForFunction(() => document.querySelector('#pg-links button[data-kind="upgrades"]')?.textContent === 'OFF', null, { timeout: 8000 }).catch(() => problems.push('UPGRADE IDEAS did not switch off'));
  const p = await prefs(page);
  check(p.reminders === false && p.upgrades === false && p.brief === true, `the brain did not keep the choices: ${JSON.stringify(p)}`);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pg-links button[data-kind="reminders"]', { timeout: 20000 });
  check((await page.textContent('#pg-links button[data-kind="reminders"]')) === 'OFF', 'REMINDERS came back ON after a reload');
  check(!!(await page.$('#pg-links button:has-text("SEND A TEST")')), 'no SEND A TEST');
  await page.click('#pg-links button:has-text("SEND A TEST")');
  await page.waitForSelector('#toasts :text("No device has notifications on yet")', { timeout: 8000 }).catch(() => problems.push('SEND A TEST gave no answer'));
  await page.locator('#pg-links section.pn:has(button[data-kind])').screenshot({ path: `${out}/notifications.png` });
  // put them back for other specs
  await page.click('#pg-links button[data-kind="reminders"]');
  await page.click('#pg-links button[data-kind="upgrades"]');
  await page.waitForTimeout(800);
}
await chrome.close();

// ---- an iPhone in a Safari tab (WebKit, iPhone user agent, not opened from the Home Screen)
let wk = null;
try {
  wk = await webkit.launch();
} catch {
  console.log('(WebKit not installed here: iPhone part skipped)');
}
if (wk) {
  const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  const { page } = await open(wk, { userAgent: ua });
  await page.waitForSelector('#pg-links .homeonly', { timeout: 8000 }).catch(() => problems.push('no Home Screen sentence on an iPhone in a Safari tab'));
  check((await page.textContent('#pg-links .homeonly').catch(() => '')) === HOME_ONLY, 'the Home Screen sentence is not word for word');
  check((await page.$$('#pg-links button[data-kind]')).length === 6, 'the switches are missing on the iPhone');
  await page.locator('#pg-links section.pn:has(button[data-kind])').screenshot({ path: `${out}/notifications-iphone.png` });
  await wk.close();
}

console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'Notifications run clean: six switches kept by the brain, SEND A TEST, Home Screen sentence on iPhone.');
process.exit(problems.length ? 1 : 0);
