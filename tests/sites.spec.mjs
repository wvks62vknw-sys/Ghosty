// A rebuilt website on an iPhone 13: Ghosty publishes it, a tappable card appears in the chat,
// tapping it opens the live page — phone-sized, sandboxed (no access to Ghosty's storage),
// with the "rebuilt by Ghosty" badge.
//   node tests/sites.spec.mjs [outDir]
import { devices } from 'playwright';
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const problems = [];

const browser = await launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: PHONE, screen: PHONE, ...UK });
const ui = await ctx.newPage();
ui.on('pageerror', (er) => webkitNoise(er) || problems.push(`pageerror: ${er.message}`));
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
  // (Update when the page is already there from an earlier run on the same brain.)
  if (!/(Publish|Update) "Acme Bakery — rebuilt" \(rebuilt from acme\.example\) as a public page at .*\/s\/acme-bakery/.test(reason ?? '')) problems.push(`approval says: ${reason}`);
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
  // Ghosty's own bar, which the rebuilt page can't touch, over the page in a locked frame.
  const bar = await site.textContent('#bar').catch(() => '');
  if (!/Rebuilt by Ghosty from acme\.example · not the official site/.test(bar ?? '')) problems.push(`bar: ${bar}`);
  const frame = await site.waitForSelector('iframe').then((f) => f.contentFrame()).catch(() => null);
  if (!frame) problems.push('the rebuilt page is not in its frame');
  else {
    await frame.waitForFunction(() => document.querySelector('h1')?.dataset.ready === '1' && document.body.dataset.net, null, { timeout: 10000 }).catch(() => problems.push("the published page's script didn't run"));
    const r = await frame.evaluate(() => ({ h1: document.querySelector('h1')?.textContent, storage: document.body.dataset.storage, net: document.body.dataset.net, wide: document.documentElement.scrollWidth > innerWidth + 1, w: innerWidth }));
    if (r.h1 !== 'Bread worth waking up for') problems.push(`page shows: ${r.h1}`);
    if (r.storage !== 'blocked') problems.push(`the published page could reach Ghosty's storage (${r.storage})`);
    if (r.net !== 'blocked') problems.push(`the published page could send data out (${r.net})`);
    if (r.wide) problems.push('the published page scrolls sideways on the phone');
    if (r.w !== PHONE.width) problems.push(`not phone width: ${r.w}`);
  }
  const outer = await site.evaluate(() => ({ wide: document.documentElement.scrollWidth > innerWidth + 1 }));
  if (outer.wide) problems.push('the page with the bar scrolls sideways');
  await site.screenshot({ path: `${out}/iphone-site-live.png` });
  // Opened directly, the bare page goes back to the one with the bar.
  const direct = await ctx.newPage();
  await direct.goto(`${base}/s/acme-bakery/page`);
  if (!/\/s\/acme-bakery$/.test(direct.url()) || !(await direct.$('#bar'))) problems.push(`the bare page opened without the bar: ${direct.url()}`);
  await direct.close();
  await site.close();

  // A reload keeps the link card in the conversation (the brain's history carries it).
  await ui.reload({ waitUntil: 'domcontentloaded' });
  await ui.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
  await ui.evaluate(() => (location.hash = 'core'));
  await ui.waitForTimeout(800);
  if (await ui.$('.logbtn')) await ui.click('.logbtn'); // the phone keeps the log folded until asked
  const kept = await ui.waitForSelector('#pg-core a.sitelink', { timeout: 15000 }).catch(() => null);
  if (!kept) problems.push('after a reload the link card is gone from the conversation');
  else if (!/\/s\/acme-bakery$/.test((await kept.getAttribute('href')) ?? '')) problems.push('the kept card links elsewhere');

  // The Workshop lists every published page, with COPY LINK and UNPUBLISH.
  await ui.evaluate(() => (location.hash = 'workshop'));
  await ui.waitForTimeout(800);
  // On the phone the Workshop shows one column at a time: PUBLISHED PAGES is in the WIDGETS & VERSIONS column.
  const swap = await ui.$('#pg-workshop button.swap');
  if (swap && !(await ui.$eval('#pg-workshop .site', (el) => el.getBoundingClientRect().height > 0).catch(() => false))) await swap.tap();
  const listed = await ui.waitForSelector('#pg-workshop .site a.sitelink', { timeout: 15000 }).catch(() => null);
  if (!listed) problems.push('the Workshop does not list the published page');
  else {
    const title = (await listed.textContent()) ?? '';
    if (!/Acme Bakery — rebuilt/.test(title)) problems.push(`the listed page reads: ${title}`);
    if (!/\/s\/acme-bakery$/.test((await listed.getAttribute('href')) ?? '')) problems.push('the listed page links elsewhere');
    const btns = await ui.$$eval('#pg-workshop .site button', (b) => b.map((x) => x.textContent.trim()));
    for (const want of ['COPY LINK', 'UNPUBLISH']) if (!btns.includes(want)) problems.push(`the listed page has no ${want} button (${btns.join(', ')})`);
    await ui.screenshot({ path: `${out}/iphone-published-pages.png` });
    // UNPUBLISH asks, then the link stops working.
    ui.once('dialog', (d) => void d.accept());
    await ui.click('#pg-workshop .site button:has-text("UNPUBLISH")');
    await ui.waitForSelector('#pg-workshop .site a.sitelink', { state: 'detached', timeout: 10000 }).catch(() => problems.push('the page is still listed after UNPUBLISH'));
    // (asked outside the browser's cache: the page was opened a moment ago and is cacheable for a minute)
    const r = await ctx.request.get(`${base}/s/acme-bakery`, { headers: { 'cache-control': 'no-cache' } });
    if (r.status() !== 404) problems.push(`the taken-down page still answers ${r.status()}`);
  }
}
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'Sites run clean: published from chat on an iPhone 13, tappable card (kept after a reload), live page opens under Ghosty\'s bar in a locked frame (no storage, no sending data), no sideways scroll; the Workshop lists it and UNPUBLISH takes it down.');
process.exit(problems.length ? 1 : 0);
