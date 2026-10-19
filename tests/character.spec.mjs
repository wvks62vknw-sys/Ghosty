// Ghosty's character in a real browser (Chromium, or WebKit with BROWSER=webkit):
//  - SETTINGS → CHARACTER shows three dials (HOW DRY / HOW BRIEF / HOW WARM), the default picked,
//    and the exact words Ghosty is given;
//  - a change is saved by the brain (POST /api/profile/persona) and comes back from the brain after
//    a reload even when this phone's copy is gone; DEFAULT puts the character back;
//  - in the chat, a model's chatbot slip ("Great question! … I hope this helps!") reaches the owner
//    polished, and a typed message is answered in the written style;
//  - nothing scrolls sideways at iPhone width.
//   BASE=http://localhost:8876 node tests/character.spec.mjs [outDir]
import { mkdirSync } from 'node:fs';
import { openPanel } from './nav.mjs';
import { engine, launch, webkitNoise } from './browser.mjs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const problems = [];
const check = (ok, what) => void (ok || problems.push(what));

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
const saves = [];
page.on('request', (r) => {
  if (r.url().endsWith('/api/profile/persona') && r.method() === 'POST') saves.push(JSON.parse(r.postData() ?? '{}'));
});
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#pair input', { timeout: 20000 });
await page.fill('#pair input', KEY);
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });

const openSettings = async () => {
  await page.evaluate(() => (location.hash = 'settings'));
  await openPanel(page, 'settings', 'CHARACTER');
  await page.waitForSelector('#pg-settings .character [data-dial="dry"] button', { timeout: 15000 });
};
const dials = () =>
  page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll('#pg-settings .character [data-dial]')].map((g) => [
        g.getAttribute('data-dial'),
        { label: g.querySelector('.lab')?.textContent ?? '', steps: [...g.querySelectorAll('button')].map((b) => b.textContent), on: g.querySelector('button.on')?.textContent ?? '' },
      ]),
    ),
  );
const told = () => page.locator('#pg-settings .character .charsays').textContent();

// ---- 1. the panel: three dials, the default character
await openSettings();
let d = await dials();
check(d.dry?.label === 'HOW DRY' && d.dry.steps.join('|') === 'PLAIN|DRY|VERY DRY' && d.dry.on === 'DRY', `dry dial: ${JSON.stringify(d.dry)}`);
check(d.brief?.label === 'HOW BRIEF' && d.brief.steps.join('|') === 'FULLER|SHORT|TERSE' && d.brief.on === 'SHORT', `brief dial: ${JSON.stringify(d.brief)}`);
check(d.warm?.label === 'HOW WARM' && d.warm.steps.join('|') === 'COOL|WARM|WARMER' && d.warm.on === 'WARM', `warm dial: ${JSON.stringify(d.warm)}`);
check(/^CHARACTER: sharp, dry, quietly confident, warm underneath\. Plain British English\./.test((await told()) ?? ''), `default words: ${await told()}`);
await page.locator('#pg-settings .character').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${out}/character-${engine}-default.png` });

// ---- 2. VERY DRY and TERSE: saved by the brain, the words follow
await page.locator('#pg-settings .character [data-dial="dry"] button', { hasText: 'VERY DRY' }).click();
await page.waitForFunction(() => /^Saved\./.test(document.querySelector('#pg-settings .character .charstate')?.textContent ?? ''), null, { timeout: 10000 }).catch(() => problems.push('no "Saved." after VERY DRY'));
await page.locator('#pg-settings .character [data-dial="brief"] button', { hasText: 'TERSE' }).click();
await page.waitForFunction(() => /As short as it can be/.test(document.querySelector('#pg-settings .character .charsays')?.textContent ?? ''), null, { timeout: 10000 }).catch(() => undefined);
check(JSON.stringify(saves.at(-1)) === JSON.stringify({ dry: 2, brief: 2, warm: 1 }), `last save: ${JSON.stringify(saves.at(-1))}`);
check(/very dry, deadpan/.test((await told()) ?? '') && /As short as it can be/.test((await told()) ?? ''), `tuned words: ${await told()}`);

// ---- 3. after a reload, with this phone's copy gone, the brain's copy rules
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('ghosty.settings') ?? '{}');
  delete s.persona;
  localStorage.setItem('ghosty.settings', JSON.stringify(s));
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 }).catch(() => undefined);
await openSettings();
await page.waitForFunction(() => document.querySelector('#pg-settings .character [data-dial="dry"] button.on')?.textContent === 'VERY DRY', null, { timeout: 10000 }).catch(() => undefined);
d = await dials();
check(d.dry?.on === 'VERY DRY' && d.brief?.on === 'TERSE' && d.warm?.on === 'WARM', `after a reload: ${JSON.stringify(d)}`);
const fit = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, vw: innerWidth }));
check(fit.doc <= fit.vw, `sideways: ${JSON.stringify(fit)}`);
await page.locator('#pg-settings .character').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${out}/character-${engine}-tuned.png` });

// ---- 4. DEFAULT puts the character back
await page.locator('#pg-settings .character button', { hasText: 'DEFAULT' }).click();
await page.waitForFunction(() => document.querySelector('#pg-settings .character [data-dial="dry"] button.on')?.textContent === 'DRY', null, { timeout: 10000 }).catch(() => undefined);
check(JSON.stringify(saves.at(-1)) === JSON.stringify({ dry: 1, brief: 1, warm: 1 }), `DEFAULT saved: ${JSON.stringify(saves.at(-1))}`);

// ---- 5. the chat: a slip arrives polished; typed is the written style
await page.evaluate(() => (location.hash = 'core'));
await page.waitForSelector('#cin', { timeout: 15000 });
await page.click('.logbtn').catch(() => undefined);
const reply = async (text) => {
  const before = await page.locator('.log .msg:not(.me)').count();
  await page.fill('#cin', text);
  await page.press('#cin', 'Enter');
  await page.waitForFunction((n) => document.querySelectorAll('.log .msg:not(.me)').length > n, before, { timeout: 20000 }).catch(() => undefined);
  // the reply's own words, without its 👍 / 👎 buttons (features/core/rate.ts)
  return ((await page.locator('.log .msg:not(.me)').last().evaluate((m) => { const c = m.cloneNode(true); c.querySelectorAll('.rateb').forEach((b) => b.remove()); return c.textContent; })) ?? '').trim();
};
const chatty = await reply('say something chatty');
check(/The kettle is on\.$/.test(chatty) && !/Great question|hope this helps|Let me know/.test(chatty), `polished reply: "${chatty}"`);
const style = await reply('how will you answer?');
check(/In writing\.$/.test(style), `typed style: "${style}"`);
await page.screenshot({ path: `${out}/character-${engine}-chat.png` });

await browser.close();
if (problems.length) {
  console.error(`FAIL (${engine}):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`ok (${engine}): SETTINGS → CHARACTER dials round-trip through the brain; chat replies polished`);
