// Live progress in the chat: a tool at work shows what it is doing under its own line ("crt.sh…
// 3 of 7" with a bar) and the row goes when the tool's result lands; while the brain really is
// fetching, the HUD shows the step too. Two parts: the row and bar from a faked brain stream
// (exact numbers, no network), then a real turn through the preview brain whose web_fetch hits
// a slow page served by this script, so the stream stays open long enough to look at the HUD.
import { launch, webkitNoise } from './browser.mjs';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const problems = [];
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));

const ndjson = (events) => events.map((e) => JSON.stringify(e)).join('\n') + '\n';
// Part 1a: the brain starts a tool and reports its third step of seven; the stream then stays open
// (a turn still live) for a few seconds, so the row can be looked at: a stream that ends without
// the tool's result marks it stopped, and the row goes.
let body = ndjson([
  { t: 'status', text: 'thinking…' },
  { t: 'tool', id: 'c1', name: 'cert_search', args: { domain: 'example.com' } },
  { t: 'progress', id: 'c1', name: 'cert_search', label: 'crt.sh…', done: 3, total: 7 },
]);
let hold = 6000;
// the preview server's test-only stream: the same lines, held open `hold` ms (a fulfilled route would end at once)
const fake = (r) => r.continue({ url: `${base}/__test/stream?lines=${encodeURIComponent(Buffer.from(body).toString('base64'))}&hold=${hold}` });
await page.route('**/api/chat', fake);

await page.goto(base);
await page.fill('#pair input', 'preview-owner-key-0123456789');
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
await page.fill('#cin', 'certificates for example.com');
await page.keyboard.press('Enter');

const row = page.locator('.convo .log .act.live .prog');
const shown = await row.first().waitFor({ state: 'attached', timeout: 10000 }).then(() => true).catch(() => false);
if (!shown) problems.push('no progress row appeared under the running tool');
else {
  const text = (await row.first().locator('span').first().textContent()) ?? '';
  if (!/crt\.sh… 3 of 7/.test(text)) problems.push(`progress row reads "${text}", not "crt.sh… 3 of 7"`);
  const width = await row.first().locator('.pbar b').first().evaluate((el) => el.style.width).catch(() => '');
  if (width !== '43%') problems.push(`the bar is ${width || 'missing'}, expected 43%`);
}
await page.locator('.logbtn').first().click().catch(() => undefined);
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/progress-phone.png` });

// The held stream ends without the tool's result: the row stops (no stale task on the HUD for the next turn).
const stopped = await page.waitForFunction(() => !document.querySelector('.convo .log .act.live') && !document.querySelector('.convo .log .act .prog'), null, { timeout: 15000 }).then(() => true).catch(() => false);
if (!stopped) problems.push('a turn that ended without the tool result left its row live (stale progress)');

// Part 1b: the same tool call finishes; its row goes and the line turns green.
hold = 0;
body = ndjson([
  { t: 'tool_result', id: 'c1', name: 'cert_search', ok: true, summary: '81 certificates' },
  { t: 'text', text: 'Done: 81 certificates for example.com.' },
  { t: 'done', model: 'Mock' },
]);
await page.fill('#cin', 'carry on');
await page.keyboard.press('Enter');
const gone = await page.waitForFunction(() => !document.querySelector('.convo .log .act .prog') && !!document.querySelector('.convo .log .act.ok'), null, { timeout: 10000 }).then(() => true).catch(() => false);
if (!gone) problems.push('the progress row did not go when the tool finished');
await page.unroute('**/api/chat', fake);

// Part 2: a real turn. The preview brain's mock model reads two pages "together"; this script
// serves them slowly, so the tool is at work for a few seconds and the HUD has time to say so.
const slow = createServer((req, res) => {
  setTimeout(() => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<html><head><title>Slow page ${req.url}</title></head><body><p>A page that takes its time: ${req.url}.</p></body></html>`);
  }, req.url.includes('/a') ? 6000 : 7000);
});
await new Promise((r) => slow.listen(0, '127.0.0.1', r));
const port = slow.address().port;
await page.fill('#cin', `read http://127.0.0.1:${port}/a and http://127.0.0.1:${port}/b together`);
await page.keyboard.press('Enter');
const hudShown = await page.waitForFunction(() => {
  const el = document.querySelector('.hudtask');
  return !!el && !el.hidden && /fetching|reading/i.test(el.textContent ?? '');
}, null, { timeout: 20000 }).then(() => true).catch(() => false);
if (!hudShown) problems.push(`the HUD did not show the fetch step: "${await page.locator('.hudtask').first().evaluate((el) => (el.hidden ? '(hidden) ' : '') + (el.textContent ?? '')).catch(() => '')}"`);
const rowsLive = await page.evaluate(() => document.querySelectorAll('.convo .log .act.live .prog').length);
if (rowsLive < 1) problems.push('no live progress row while the brain was fetching');
const finished = await page.waitForFunction(() => document.querySelectorAll('.convo .log .act.ok').length >= 3 && !document.querySelector('.convo .log .act .prog'), null, { timeout: 40000 }).then(() => true).catch(() => false);
if (!finished) problems.push('the two fetches did not both finish cleanly (rows should turn green and lose their progress)');
const hudAfter = await page.waitForFunction(() => {
  const el = document.querySelector('.hudtask');
  return !el || el.hidden || !(el.textContent ?? '').trim();
}, null, { timeout: 10000 }).then(() => true).catch(() => false);
if (!hudAfter) problems.push('the HUD still shows a step after the tools finished');
slow.close();

await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'Progress run clean: a tool at work shows "crt.sh… 3 of 7" with a 43% bar under its line, the row goes when its result lands, and during a real fetch the HUD names the step until both reads finish.');
process.exit(problems.length ? 1 : 0);
