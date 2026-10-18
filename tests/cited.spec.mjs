// Cited answers on an iPhone 13: CITED next to SEND turns on (and stays on after a reload), the
// chat request carries it, and the preview brain (scripted model; the web from
// tests/fixtures/cited.json) answers "what is the speed of light" with [n] chips — a chip opens
// its page, a chip for a source never looked up warns instead — a SOURCES list, the check line
// "✓ 2 of 4 claims found in the sources" and the two unconfirmed claims marked. A reload shows
// it all again from the brain's history; with CITED off a reply is plain.
//   node tests/cited.spec.mjs [outDir]
import { devices } from 'playwright';
import { launch, webkitNoise } from './browser.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const problems = [];

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
// What each chat request asked for (the cited flag rides in its body).
const asked = [];
ctx.on('request', (r) => {
  if (r.url().endsWith('/api/chat') && r.method() === 'POST') asked.push(JSON.parse(r.postData() ?? '{}'));
});
// A source page opens in a new tab: answered here so the test never reaches the real web.
await ctx.route('https://physics.example.test/**', (route) => route.fulfill({ status: 200, headers: { 'content-type': 'text/html' }, body: '<title>Physics Reference</title><h1>Speed of light</h1>' }));

await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#pair input', { timeout: 15000 });
await page.fill('#pair input', 'preview-owner-key-0123456789');
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });

// 1. CITED sits next to SEND, off at first; on with a tap; remembered on this device
const cited = page.locator('#cbar button.citedbtn');
await cited.waitFor({ state: 'visible', timeout: 10000 }).catch(() => problems.push('no CITED button in the chat bar'));
const order = await page.$$eval('#cbar > button', (b) => b.map((x) => x.textContent.trim()));
if (order.indexOf('CITED') !== order.indexOf('SEND') + 1) problems.push(`CITED is not next to SEND: ${order.join(', ')}`);
if ((await cited.getAttribute('aria-pressed')) !== 'false') problems.push('CITED starts on');
await cited.click();
if ((await cited.getAttribute('aria-pressed')) !== 'true' || !(await cited.evaluate((b) => b.classList.contains('on')))) problems.push('CITED did not turn on');
if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) problems.push('the chat bar with CITED scrolls sideways');
await page.waitForTimeout(500); // settings are saved a moment after a change
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 }).catch(() => undefined);
await cited.waitFor({ state: 'visible', timeout: 10000 });
if ((await cited.getAttribute('aria-pressed')) !== 'true') problems.push('CITED was not remembered after a reload');
const bar = await page.locator('#cbar').boundingBox();
const btn = await cited.boundingBox();
if (!bar || !btn || btn.x < bar.x - 1 || btn.x + btn.width > bar.x + bar.width + 1) problems.push(`CITED sticks out of the chat bar: ${JSON.stringify({ bar, btn })}`);

// 2. a cited answer
await page.click('.logbtn');
const had = await page.locator('.log .msg.cited').count();
await page.fill('#cin', 'what is the speed of light');
await page.press('#cin', 'Enter');
await page.waitForFunction((n) => document.querySelectorAll('.log .msg.cited').length > n, had, { timeout: 20000 }).catch(() => problems.push('no cited reply in the log'));
const reply = page.locator('.log .msg.cited').last();
if (!asked.at(-1)?.cited) problems.push(`the chat request did not carry cited: ${JSON.stringify(asked.at(-1))}`);
const chips = await reply.locator('.citedtext .cite').evaluateAll((c) => c.map((x) => ({ n: x.textContent, tag: x.tagName, href: x.getAttribute('href'), miss: x.classList.contains('miss'), un: x.classList.contains('un') })));
if (chips.map((c) => c.n).join(',') !== '1,1,2,3') problems.push(`chips: ${JSON.stringify(chips)}`);
if (chips[0]?.tag !== 'A' || chips[0]?.href !== 'https://physics.example.test/speed-of-light') problems.push(`chip 1 does not link its page: ${JSON.stringify(chips[0])}`);
if (!chips[2]?.miss || !chips[3]?.miss) problems.push('the chips for sources never looked up ([2], [3]) are not flagged');
if (!chips[2]?.un || chips[0]?.un) problems.push('chip highlighting does not follow the unconfirmed claims');
const words = (await reply.locator('.citedtext').textContent()) ?? '';
if (/SOURCES|https?:\/\//.test(words)) problems.push(`the source list is still in the reply's words: ${words}`);
const marked = await reply.locator('mark.unconf').allTextContents();
if (!marked.some((m) => /Light from the Sun takes about eight minutes/.test(m)) || !marked.some((m) => /Nothing can travel faster/.test(m)) || marked.some((m) => /299,792,458/.test(m))) problems.push(`unconfirmed claims marked: ${JSON.stringify(marked)}`);
const rows = await reply.locator('.citesrc .csrc').evaluateAll((r) => r.map((x) => ({ text: x.textContent, miss: x.classList.contains('miss'), href: x.getAttribute('href') })));
if (rows.length !== 3 || !/\[1\]Speed of light — Physics Reference/.test(rows[0]?.text ?? '') || rows[0]?.href !== 'https://physics.example.test/speed-of-light' || !rows[1]?.miss || !/never looked up/.test(rows[1]?.text ?? '')) problems.push(`SOURCES rows: ${JSON.stringify(rows)}`);
const check = ((await reply.locator('.citecheck').textContent().catch(() => '')) ?? '').trim();
if (!/^✓ 2 of 4 claims found in the sources/.test(check) || !(await reply.locator('.citecheck.warn').count())) problems.push(`check line: "${check}"`);
if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) problems.push('the cited reply scrolls sideways');
await page.screenshot({ path: `${out}/cited-phone.png` });

// 3. a chip opens its source in a new tab; one never looked up warns instead
const [tab] = await Promise.all([ctx.waitForEvent('page', { timeout: 10000 }).catch(() => null), reply.locator('.citedtext a.cite').first().click()]);
if (!tab) problems.push('chip 1 opened nothing');
else {
  await tab.waitForLoadState('domcontentloaded').catch(() => undefined);
  if (tab.url() !== 'https://physics.example.test/speed-of-light') problems.push(`chip 1 opened ${tab.url()}`);
  await tab.close();
}
await reply.locator('.citedtext .cite.miss').last().click();
const warned = await page.locator('.toast', { hasText: 'never looked up' }).first().waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false);
if (!warned) problems.push('a chip for a source never looked up did not warn');

// 4. after a reload the brain's history brings the chips back
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 }).catch(() => undefined);
await page.click('.logbtn');
const again = page.locator('.log .msg.cited').last();
await again.waitFor({ state: 'visible', timeout: 15000 }).catch(() => problems.push('the cited reply lost its sources after a reload'));
if ((await again.locator('.cite').count()) !== 4) problems.push('chips missing after a reload');

// 5. CITED off: a plain reply, and the request says nothing about citing
await cited.click();
if ((await cited.getAttribute('aria-pressed')) !== 'false') problems.push('CITED did not turn off');
const before = await page.locator('.log .msg:not(.me)').count();
await page.fill('#cin', 'hello there');
await page.press('#cin', 'Enter');
await page.waitForFunction((n) => document.querySelectorAll('.log .msg:not(.me)').length > n, before, { timeout: 15000 }).catch(() => problems.push('no reply with CITED off'));
if (asked.at(-1)?.cited) problems.push('CITED off still sent cited');
const plain = page.locator('.log .msg:not(.me)').last();
if (await plain.evaluate((m) => m.classList.contains('cited'))) problems.push('a reply with CITED off was drawn as cited');
await page.screenshot({ path: `${out}/cited-off-phone.png` });

await browser.close();
if (problems.length) {
  console.error(`cited.spec: ${problems.length} problem(s)\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('cited.spec: CITED toggle, chips, sources, check line, unconfirmed marks, reload: all good');
