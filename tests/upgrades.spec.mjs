// Upgrade ideas in the Workshop on an iPhone 13: the panel lists what Ghosty proposed for itself
// (the brain's /api/upgrades routes stubbed), DISMISS drops one, THINK NOW asks and shows what
// came back, and BUILD puts "Build this upgrade: …" in the chat and opens the Core tab, where the
// preview brain (scripted model) answers it.
//   node tests/upgrades.spec.mjs [outDir]
import { devices } from 'playwright';
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, openSection } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const problems = [];

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: PHONE, screen: PHONE, ...UK });
const page = await ctx.newPage();
page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));

let ideas = [
  { id: 'i1', title: 'A rain radar panel on the Brief tab', why: 'You ask about rain most mornings.', steps: ['Add data/radar.ts reading RainViewer tiles', 'Add a RADAR panel to features/brief/index.ts'], at: Date.now() - 3600_000 },
  { id: 'i2', title: 'One-tap commute summary', why: 'Your commute questions repeat every weekday.', steps: ['Add commute_summary to tools/extra.ts'], at: Date.now() - 7200_000 },
];
const json = (route, body) => route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
await page.route('**/api/upgrades', (route) => json(route, { ideas, next: Date.now() + 3600_000, last: null }));
await page.route('**/api/upgrades/now', (route) => {
  ideas = [{ id: 'i3', title: 'Read the morning emails aloud', why: 'Hands-free mornings.', steps: ['Add a read_inbox_aloud tool to tools/extra.ts'], at: Date.now() }, ...ideas];
  return json(route, { ideas, added: 1, note: '1 new idea: Read the morning emails aloud' });
});
// (registered last, so checked first: anything but a dismissal falls through to the stubs above)
await page.route('**/api/upgrades/*', (route) => {
  if (route.request().method() !== 'DELETE') return route.fallback();
  const id = route.request().url().split('/').pop();
  ideas = ideas.filter((i) => i.id !== id);
  return json(route, { removed: true });
});

await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#pair input', { timeout: 15000 });
await page.fill('#pair input', 'preview-owner-key-0123456789');
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
await page.evaluate(() => (location.hash = 'workshop'));
// (on the phone the Workshop is in sections, ui/sections.ts: the ideas are under their own pill)
await page.waitForSelector('#pg-workshop .secpills .secpill', { state: 'visible', timeout: 10000 }).catch(() => problems.push('the Workshop has no pills'));
await openSection(page, 'workshop', 'Ideas');

// 1. the panel lists every idea with its why and steps
const cards = page.locator('#pg-workshop .idea');
await cards.first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => problems.push('no UPGRADE IDEAS cards in the Workshop'));
const titles = await page.$$eval('#pg-workshop .idea b', (b) => b.map((x) => x.textContent));
if (titles.join('|') !== 'A rain radar panel on the Brief tab|One-tap commute summary') problems.push(`ideas listed: ${titles.join(' | ')}`);
const steps = await page.$$eval('#pg-workshop .idea ol li', (l) => l.map((x) => x.textContent));
if (!steps.includes('Add data/radar.ts reading RainViewer tiles') || steps.length !== 3) problems.push(`steps listed: ${steps.join(' | ')}`);
const why = await page.textContent('#pg-workshop .idea .note').catch(() => '');
if (!/You ask about rain most mornings/.test(why ?? '')) problems.push(`why reads: ${why}`);
const status = await page.textContent('#pg-workshop .pn:has(.idea) h3 small').catch(() => '');
if (status?.trim() !== '2') problems.push(`the panel's count reads "${status}"`);
if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) problems.push('the Workshop scrolls sideways with the ideas panel');
const btns = await page.$$eval('#pg-workshop .idea button', (b) => b.map((x) => x.textContent.trim()));
if (!btns.includes('BUILD') || !btns.includes('DISMISS')) problems.push(`idea buttons: ${btns.join(', ')}`);
await page.screenshot({ path: `${out}/upgrades-phone.png` });

// 2. DISMISS drops the idea
await page.locator('#pg-workshop .idea', { hasText: 'One-tap commute summary' }).locator('button:has-text("DISMISS")').tap();
await page.waitForFunction(() => document.querySelectorAll('#pg-workshop .idea').length === 1, null, { timeout: 5000 }).catch(() => problems.push('DISMISS did not remove the idea'));

// 3. THINK NOW asks the brain and shows the new idea first
await page.locator('#pg-workshop button:has-text("THINK NOW")').tap();
await page.waitForFunction(() => document.querySelector('#pg-workshop .idea b')?.textContent === 'Read the morning emails aloud', null, { timeout: 10000 }).catch(() => problems.push('THINK NOW did not show the new idea first'));

// 4. BUILD: the build request goes to the chat (as the owner's own message) and the Core tab opens; the brain answers
await page.locator('#pg-workshop .idea').first().locator('button:has-text("BUILD")').tap();
await page.waitForFunction(() => location.hash === '#core', null, { timeout: 5000 }).catch(async () => problems.push(`BUILD did not open the Core tab (${await page.evaluate(() => location.hash)})`));
const sent = await page
  .waitForFunction(() => [...document.querySelectorAll('.msg.me span')].map((s) => s.textContent ?? '').find((t) => t.startsWith('Build this upgrade:')) ?? null, null, { timeout: 10000 })
  .then((h) => h.jsonValue())
  .catch(() => '');
const want = 'Build this upgrade: Read the morning emails aloud. Hands-free mornings. Steps: 1. Add a read_inbox_aloud tool to tools/extra.ts.';
if (sent !== want) problems.push(`the chat got "${sent}", expected "${want}"`);
await page.waitForFunction(() => [...document.querySelectorAll('.msg:not(.me) span')].some((s) => /Mock reply to: build this upgrade/.test(s.textContent ?? '')), null, { timeout: 20000 }).catch(() => problems.push('the brain did not answer the build request'));
if (await page.$('.logbtn')) await page.click('.logbtn'); // the phone keeps the log folded until asked
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/upgrades-build.png` });

await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'Upgrades run clean: ideas listed with why and steps on an iPhone 13, DISMISS drops one, THINK NOW shows the new one, BUILD puts the request in the chat and opens Core.');
process.exit(problems.length ? 1 : 0);
