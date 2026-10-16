// A rebuilt website on an iPhone 13: Ghosty publishes it, a tappable card appears in the chat,
// tapping it opens the live page — phone-sized, sandboxed (no access to Ghosty's storage),
// with the "rebuilt by Ghosty" badge.
//   node tests/sites.spec.mjs [outDir]
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const problems = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const ui = await ctx.newPage();
ui.on('pageerror', (er) => problems.push(`pageerror: ${er.message}`));
await ui.goto(base, { waitUntil: 'domcontentloaded' });
await ui.waitForSelector('#pair input', { timeout: 15000 });
await ui.fill('#pair input', 'preview-owner-key-0123456789');
await ui.click('#pair button.on');
await ui.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
await ui.waitForTimeout(800);
if (await ui.$('.logbtn')) await ui.click('.logbtn');
await ui.fill('#cin', 'publish site acme-bakery');
await ui.keyboard.press('Enter');
// Publishing puts a page on the public internet: Ghosty asks first, one tap.
const approve = await ui.waitForSelector('.approval button.on', { timeout: 15000 }).catch(() => null);
if (!approve) problems.push('Ghosty did not ask before publishing');
else {
  const reason = await ui.$eval('.approval b', (b) => b.textContent);
  if (!/Publish "Acme Bakery — rebuilt" \(rebuilt from acme\.example\) as a public page at .*\/s\/acme-bakery/.test(reason ?? '')) problems.push(`approval says: ${reason}`);
  await approve.tap();
}
const card = await ui.waitForSelector('a.sitelink', { timeout: 15000 }).catch(() => null);
if (!card) problems.push('no link card in the chat after publishing');
else {
  const box = await card.boundingBox();
  if (!box || box.height < 44) problems.push(`the link card is too small to tap (${box?.height}px)`);
  const href = await card.getAttribute('href');
  if (!/\/s\/acme-bakery$/.test(href ?? '')) problems.push(`card links to ${href}`);
  if ((await card.getAttribute('target')) !== '_blank') problems.push('card should open in a new tab');
  const text = await ui.evaluate(() => [...document.querySelectorAll('.msg a')].map((a) => a.getAttribute('href')));
  if (!text.some((h) => /\/s\/acme-bakery$/.test(h ?? ''))) problems.push(`the link in Ghosty's reply isn't tappable: ${JSON.stringify(text)}`);
  await ui.screenshot({ path: `${out}/iphone-site-card.png` });
  const [site] = await Promise.all([ctx.waitForEvent('page'), card.tap()]);
  await site.waitForLoadState('domcontentloaded');
  await site.waitForFunction(() => document.querySelector('h1')?.dataset.ready === '1', null, { timeout: 10000 }).catch(() => problems.push("the published page's script didn't run"));
  const r = await site.evaluate(() => ({ h1: document.querySelector('h1')?.textContent, badge: document.getElementById('ghosty-badge')?.textContent, storage: document.body.dataset.storage, wide: document.documentElement.scrollWidth > innerWidth + 1, w: innerWidth }));
  if (r.h1 !== 'Bread worth waking up for') problems.push(`page shows: ${r.h1}`);
  if (!/Rebuilt by Ghosty from acme\.example/.test(r.badge ?? '')) problems.push(`badge: ${r.badge}`);
  if (r.storage !== 'blocked') problems.push(`the published page could reach Ghosty's storage (${r.storage})`);
  if (r.wide) problems.push('the published page scrolls sideways on the phone');
  if (r.w !== 390) problems.push(`not phone width: ${r.w}`);
  await site.screenshot({ path: `${out}/iphone-site-live.png` });
}
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'Sites run clean: published from chat on an iPhone 13, tappable card, live page opens sandboxed with the badge, no sideways scroll.');
process.exit(problems.length ? 1 : 0);
