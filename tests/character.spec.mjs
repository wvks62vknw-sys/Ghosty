// Ghosty's character in a real browser (Chromium, or WebKit with BROWSER=webkit):
//  - SETTINGS → CHARACTER shows four dials (HOW DRY / HOW BRIEF / HOW WARM / HOW FIERY), the default picked,
//    and the exact words Ghosty is given;
//  - a change is saved by the brain (POST /api/profile/persona) and comes back from the brain after
//    a reload even when this phone's copy is gone; DEFAULT puts the character back;
//  - in the chat, a model's chatbot slip ("Great question! … I hope this helps!") reaches the owner
//    polished, a typed message is answered in the written style, and a short message gets a short reply
//    (his length, OWNER-ISSUES 64b) with no assistant cadence (64c); the empty chat says "Here, Boss." (67a);
//  - nothing scrolls sideways at iPhone width.
//   BASE=http://localhost:8876 node tests/character.spec.mjs [outDir]
import { mkdirSync } from 'node:fs';
import { PHONE, UK, openPanel } from './nav.mjs';
import { engine, launch, webkitNoise } from './browser.mjs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const problems = [];
const check = (ok, what) => void (ok || problems.push(what));

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined });
const ctx = await browser.newContext({ viewport: PHONE, ...UK });
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
check(d.brief?.label === 'HOW BRIEF' && d.brief.steps.join('|') === 'FULLER|LIKE YOU|TERSE' && d.brief.on === 'LIKE YOU', `brief dial: ${JSON.stringify(d.brief)}`);
check(d.warm?.label === 'HOW WARM' && d.warm.steps.join('|') === 'COOL|WARM|WARMER' && d.warm.on === 'WARM', `warm dial: ${JSON.stringify(d.warm)}`);
check(d.fire?.label === 'HOW FIERY' && d.fire.steps.join('|') === 'MILD|FIRM|FIERY' && d.fire.on === 'FIRM', `fire dial: ${JSON.stringify(d.fire)}`);
check(/^CHARACTER: sharp, dry, quietly confident, warm underneath\. Plain British English\./.test((await told()) ?? ''), `default words: ${await told()}`);
// how he sounds, in plain words, first; the exact words he is given one tap away (not a wall of prompt text)
const nowLine = () => page.locator('#pg-settings .character .charnow').textContent().catch(() => '');
check((await nowLine()) === 'Now: dry, warm, firm, answers as long as yours, as he comes. The app, the voice, Telegram and notifications all sound like this.', `the plain line: "${await nowLine()}"`);
check(!(await page.locator('#pg-settings .character .charsays').isVisible()) && (await page.locator('#pg-settings .character details.charwords summary').textContent()) === 'The exact words Ghosty is given', 'the exact words are folded behind "The exact words Ghosty is given"');
await page.locator('#pg-settings .character').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${out}/character-${engine}-default.png` });
// every dial step and DEFAULT is a 44 pt target (the owner's rule; they were 40)
const small = await page.$$eval('#pg-settings .character button', (bs) => bs.filter((b) => b.offsetParent).map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent, w: Math.round(r.width), h: Math.round(r.height) }; }).filter((x) => x.h < 44 || x.w < 44));
check(small.length === 0, `CHARACTER targets under 44 pt: ${JSON.stringify(small)}`);

// ---- 2. VERY DRY and TERSE: saved by the brain, the words follow
await page.locator('#pg-settings .character [data-dial="dry"] button', { hasText: 'VERY DRY' }).click();
await page.waitForFunction(() => /^Saved\./.test(document.querySelector('#pg-settings .character .charstate')?.textContent ?? ''), null, { timeout: 10000 }).catch(() => problems.push('no "Saved." after VERY DRY'));
await page.locator('#pg-settings .character [data-dial="brief"] button', { hasText: 'TERSE' }).click();
await page.waitForFunction(() => /As short as it can be/.test(document.querySelector('#pg-settings .character .charsays')?.textContent ?? ''), null, { timeout: 10000 }).catch(() => undefined);
check(JSON.stringify(saves.at(-1)) === JSON.stringify({ dry: 2, brief: 2, warm: 1, fire: 1 }), `last save: ${JSON.stringify(saves.at(-1))}`);
check(/very dry, deadpan/.test((await told()) ?? '') && /As short as it can be/.test((await told()) ?? ''), `tuned words: ${await told()}`);
check(/^Now: very dry, warm, firm, terse answers\. /.test((await nowLine()) ?? ''), `the plain line after VERY DRY and TERSE: "${await nowLine()}"`);
// HOW FIERY (OWNER-ISSUES 69a): FIERY is saved by the brain and its one line is what he is given
await page.locator('#pg-settings .character [data-dial="fire"] button', { hasText: 'FIERY' }).click();
await page.waitForFunction(() => /Argue hard and blunt, rude back if he is\./.test(document.querySelector('#pg-settings .character .charsays')?.textContent ?? ''), null, { timeout: 10000 }).catch(() => undefined);
check(JSON.stringify(saves.at(-1)) === JSON.stringify({ dry: 2, brief: 2, warm: 1, fire: 2 }), `FIERY saved: ${JSON.stringify(saves.at(-1))}`);
check(/Argue hard and blunt, rude back if he is\./.test((await told()) ?? '') && !/hold your view/.test((await told()) ?? ''), `FIERY's words: ${await told()}`);

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
check(d.dry?.on === 'VERY DRY' && d.brief?.on === 'TERSE' && d.warm?.on === 'WARM' && d.fire?.on === 'FIERY', `after a reload: ${JSON.stringify(d)}`);
const fit = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, vw: innerWidth }));
check(fit.doc <= fit.vw, `sideways: ${JSON.stringify(fit)}`);
await page.locator('#pg-settings .character').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${out}/character-${engine}-tuned.png` });

// ---- 4. DEFAULT puts the character back
await page.locator('#pg-settings .character button', { hasText: 'DEFAULT' }).click();
await page.waitForFunction(() => document.querySelector('#pg-settings .character [data-dial="dry"] button.on')?.textContent === 'DRY', null, { timeout: 10000 }).catch(() => undefined);
check(JSON.stringify(saves.at(-1)) === JSON.stringify({ dry: 1, brief: 1, warm: 1, fire: 1 }), `DEFAULT saved: ${JSON.stringify(saves.at(-1))}`);

// ---- 5. the chat: a slip arrives polished; typed is the written style
await page.evaluate(() => (location.hash = 'core'));
await page.waitForSelector('#cin', { timeout: 15000 });
await page.click('.logbtn').catch(() => undefined);
// an empty conversation reads as someone already there (OWNER-ISSUES 67a): his name, no menu, no "how can I help"
const idle = ((await page.locator('.log .logidle').textContent({ timeout: 5000 }).catch(() => '')) ?? '').trim();
check(idle === 'Here, Boss.', `the empty chat: "${idle}"`);
check((await page.locator('#cin').getAttribute('placeholder')) === 'Talk to me', 'the field invites talk, not a query');
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
// his length (64b) and no assistant cadence (64c): a short message gets a short reply, without "Certainly!" or the closing offer
const short = await reply('pineapple on pizza?');
check(/It works: sweet against salt\.$/.test(short) && !/acid|ham/.test(short), `a short message, a short reply: "${short}"`);
check(!/Certainly|hope this helps|How can I help|Let me know/i.test(short), `no assistant cadence: "${short}"`);
check(!(await page.locator('.log .logidle').count()), 'the quiet line goes once there is a conversation');
await page.screenshot({ path: `${out}/character-${engine}-chat.png` });

await browser.close();
if (problems.length) {
  console.error(`FAIL (${engine}):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`ok (${engine}): SETTINGS → CHARACTER dials round-trip through the brain; chat replies polished`);
