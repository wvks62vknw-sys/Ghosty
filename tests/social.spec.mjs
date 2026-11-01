// HIS SOCIAL SELF (BRIEF-SOCIAL, batch ⑦) on the owner's iPhone 18 Pro Max (440 × 956, en-GB, Europe/London), against the
// preview's real brain with the scripted model and his accounts' APIs stood in (tests/fixtures/social-apis.mjs):
//  - LINKS → BLUESKY shows the key steps; a password that is not an app password is refused on the phone, never sent;
//    an app password links it (LINKED, the handle);
//  - "what's on Bluesky?" is answered from the stubbed timeline, with authors and times;
//  - "post on bluesky: …" → a draft card with APPROVE · EDIT · NO (the words in full; nothing sent); EDIT changes the
//    words (still nothing sent); APPROVE sends it ONCE (the stub records one post; APPROVE again sends nothing) and WHY
//    under the reply lists it; NO on another draft sends nothing;
//  - a line of his own on the clock stub (/__test/musing-at): its card in the chat, with POST THAT? (Bluesky is linked),
//    whose tap is a draft, never a post;
//  - FATHER AND THE ORIGIN from SETTINGS → CHARACTER, from the Me sheet, and from "who made you?" (the page's first lines and
//    its card);
//  - at 390 × 844 nothing sideways; every field and button named for VoiceOver. No page errors.
// Everything it links is unlinked again (CI's retry runs on the same brain).
//   BASE=http://localhost:8755 node tests/social.spec.mjs [outDir]
import { mkdirSync } from 'node:fs';
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, openPanel, standDown } from './nav.mjs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const problems = [];
const check = (ok, what) => void (ok || problems.push(what));
const t0 = Date.now();
const log = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s · ${s}`);
await standDown(base, KEY);
const stub = (q = '') => fetch(`${base}/__test/social${q}`).then((r) => r.json());
const musingAt = (at, reset = false) => fetch(`${base}/__test/musing-at?at=${at}${reset ? '&reset=1' : ''}`).then((r) => r.json());
const brainApi = (path, init = {}) => fetch(`${base}/api${path}`, { ...init, headers: { 'content-type': 'application/json', 'x-ghosty': '1', 'x-ghosty-key': KEY } }).then((r) => r.json());
await brainApi('/social/link?account=bluesky', { method: 'DELETE' });
await stub('?reset=1');

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: PHONE, ...UK, serviceWorkers: 'block' });
await ctx.addInitScript(() => {
  window.__ghostyCards = true;
});
const page = await ctx.newPage();
page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#pair input', { timeout: 20000 });
await page.fill('#pair input', KEY);
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
const until = (fn, arg, ms, what) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => (problems.push(what), false));
const sideways = (sel) => page.$$eval(sel, (els) => els.filter((e) => e.getClientRects().length).filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1); }).slice(0, 5).map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join('.')} "${(e.textContent ?? '').trim().slice(0, 40)}"`));
const unnamed = (sel) => page.$$eval(sel, (els) => els.filter((e) => e.getClientRects().length).filter((e) => !(e.getAttribute('aria-label') || (e.textContent ?? '').trim())).map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join('.')}`));

// ---- 1. LINKS → BLUESKY: the steps, a main password refused on the phone, an app password linked
await page.evaluate(() => (location.hash = 'links'));
await openPanel(page, 'links', 'BLUESKY');
const bp = '#pg-links .pn.socialpanel';
await until((s) => !!document.querySelector(`${s} input[aria-label="Bluesky app password"]`), bp, 15000, 'LINKS → BLUESKY shows no app password box');
const steps = await page.$$eval(`${bp} ol.steps li`, (li) => li.map((x) => x.textContent ?? ''));
check(steps.length >= 3 && steps.some((s) => /App passwords → Add App Password/.test(s)) && steps.some((s) => /Never your main password/.test(s)), `the Bluesky steps: ${JSON.stringify(steps)}`);
check((await unnamed(`${bp} input, ${bp} button`)).length === 0, `BLUESKY: a field or button with no name: ${await unnamed(`${bp} input, ${bp} button`)}`);
await page.fill(`${bp} input[aria-label="Bluesky handle"]`, 'ghost.bsky.social');
await page.fill(`${bp} input[aria-label="Bluesky app password"]`, 'my real password');
await page.locator(`${bp} button`, { hasText: /link bluesky/i }).click();
await until((s) => /not an app password/.test(document.querySelector(`${s} .note.bad`)?.textContent ?? ''), bp, 5000, 'a main password was not refused on the phone');
check((await stub()).sent.length === 0, 'something was sent');
await page.fill(`${bp} input[aria-label="Bluesky app password"]`, 'test-appp-pass-word');
await page.locator(`${bp} button`, { hasText: /link bluesky/i }).click();
await until((s) => /@ghost\.bsky\.social/.test(document.querySelector(s)?.textContent ?? ''), bp, 15000, 'Bluesky did not link with an app password');
check((await brainApi('/social')).accounts?.find((a) => a.id === 'bluesky')?.who === '@ghost.bsky.social', 'the brain does not say Bluesky is linked');
await page.screenshot({ path: `${out}/social-bluesky-linked.png` });
log('LINKS → BLUESKY linked');

// ---- 2. the chat: "what's on Bluesky?" from the stubbed timeline
const openChat = async () => {
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(600);
  if (!(await page.evaluate(() => document.querySelector('#pg-core .hud.core')?.classList.contains('logopen')))) await page.click('.logbtn').catch(() => undefined);
  await page.waitForTimeout(400);
};
const say = async (words) => {
  await page.fill('#cin', words);
  await page.press('#cin', 'Enter');
};
await openChat();
await say("what's on bluesky?");
await until(() => [...document.querySelectorAll('#pg-core .msg:not(.me)')].some((m) => /@nasa\.gov \(NASA\) \d+ \w+, \d\d:\d\d — Artemis crew back from the Moon flyby/.test(m.textContent ?? '')), null, 25000, '"what\'s on Bluesky?" was not answered from the timeline with authors and times');
log('what’s on Bluesky answered');

// ---- 3. a draft card: APPROVE · EDIT · NO; EDIT; APPROVE once; WHY
const WORDS = 'Testing my own account, approved by hand.';
await say(`post on bluesky: ${WORDS}`);
const card = '#pg-core .ccard.draftcard';
await until((c) => [...document.querySelectorAll(c)].some((x) => x.dataset.state === 'waiting'), card, 25000, 'no draft card in the chat');
const draft = await page.evaluate((c) => {
  const x = [...document.querySelectorAll(c)].filter((e) => e.dataset.state === 'waiting').at(-1);
  return x ? { id: x.dataset.id, title: x.querySelector('.cctitle')?.textContent, words: x.querySelector('.drwords')?.textContent, buttons: [...x.querySelectorAll('.dracts button')].map((b) => b.textContent), labels: [...x.querySelectorAll('.dracts button')].map((b) => b.getAttribute('aria-label')) } : null;
}, card);
check(draft?.title === 'Post on Bluesky?' && draft.words === WORDS, `the draft card: ${JSON.stringify(draft)}`);
check(draft?.buttons.join(' · ').toUpperCase() === 'APPROVE · EDIT · NO', `the draft's buttons: ${draft?.buttons}`);
check(draft?.labels.every(Boolean), `a draft button with no name: ${draft?.labels}`);
check((await stub()).sent.length === 0, 'a draft was posted before APPROVE');
const live = page.locator(`${card}[data-id="${draft?.id}"]`);
await live.locator('button', { hasText: /^edit$/i }).click();
await page.waitForSelector('.modal textarea.drbox', { timeout: 5000 }).catch(() => problems.push('EDIT opened no box'));
const EDITED = 'Testing my own account — every post approved by hand.';
await page.fill('.modal textarea.drbox', EDITED);
await page.locator('.modal button', { hasText: /^save$/i }).click();
await until((s) => (document.querySelector(s)?.querySelector('.drwords')?.textContent ?? '') === 'Testing my own account — every post approved by hand.', `${card}[data-id="${draft?.id}"]`, 8000, 'EDIT did not change the words');
check((await stub()).sent.length === 0, 'an edit was posted');
await page.screenshot({ path: `${out}/social-draft.png` });
await live.locator('button', { hasText: /^approve$/i }).click();
await until((s) => document.querySelector(s)?.dataset.state === 'sent', `${card}[data-id="${draft?.id}"]`, 15000, 'APPROVE did not post it');
let sent = (await stub()).sent;
check(sent.length === 1 && sent[0].text === EDITED, `the stub got: ${JSON.stringify(sent)}`);
const again = await brainApi('/social/approve', { method: 'POST', body: JSON.stringify({ id: draft?.id?.replace(/^draft:/, '') }) });
sent = (await stub()).sent;
check(/^Already done/.test(again.error ?? '') && sent.length === 1, `APPROVE again: ${JSON.stringify(again)} · sent ${sent.length}`);
// WHY under what went out
const reply = page.locator('#pg-core .msg:not(.me)', { has: page.locator('.whybtn') }).filter({ hasText: /Posted on Bluesky/ }).last();
await reply.locator('.whybtn').click().catch(() => problems.push('no WHY under "Posted on Bluesky"'));
await page.waitForSelector('.modal .whybody', { timeout: 5000 }).catch(() => problems.push('WHY did not open'));
const why = await page.evaluate(() => [...document.querySelectorAll('.modal .whybody p')].map((p) => p.textContent ?? '').join('\n'));
check(/APPROVE — post on Bluesky/.test(why) && /post on Bluesky: “Testing my own account/.test(why), `WHY reads: ${why}`);
await page.click('.modal .mhead button').catch(() => undefined);
// NO on another: nothing goes out
await say('post on bluesky: Not this one.');
await until((c) => [...document.querySelectorAll(c)].filter((x) => x.dataset.state === 'waiting').length === 1, card, 25000, 'no second draft card');
await page.locator(`${card}[data-state="waiting"] button`, { hasText: /^no$/i }).last().click();
await until((c) => [...document.querySelectorAll(c)].some((x) => x.dataset.state === 'no' && /You said no/.test(x.textContent ?? '')), card, 8000, 'NO did not drop the draft');
check((await stub()).sent.length === 1, 'NO sent something');
log('the queue: EDIT, APPROVE once, WHY, NO');

// ---- 4. a line of his own on the clock stub, with POST THAT?
const london = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date()).map((p) => [p.type, p.value]));
const hour = Number(london.hour) + Number(london.minute) / 60;
// The clock stands at 14:00 his time, or at a minute from now when that is later: the brain stamps the card with the clock it
// is given, and the page shows only what is newer than what it has, so a card stamped in the past never reaches the chat (the
// smoke loop's afternoon runs failed this way). After 23:00 the musing hours are over: tomorrow's 14:00 then.
const todayAt14 = Date.now() + Math.round((14 - hour) * 3_600_000);
const afternoon = hour >= 23 ? todayAt14 + 86_400_000 : Math.max(todayAt14, Date.now() + 60_000);
const mused = await musingAt(afternoon, true);
check(mused.job && mused.cadence?.log?.some((s) => s.id.startsWith('musing:') && !s.held), `the line of his own was not said on the clock stub: ${JSON.stringify(mused).slice(0, 300)}`);
await openChat();
await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
// (the mock writes the line from the FIRST fact it is given; on the smoke loop's shared brain that is a digest headline from an
// earlier spec, on a fresh one his Bluesky timeline: the card is the check, and the draft must carry the card's own words)
await until(() => [...document.querySelectorAll('#pg-core .ccard:not(.wall)[data-kind="brief"]')].some((c) => /A thought of mine/.test(c.textContent ?? '') && /Been thinking about this one/.test(c.textContent ?? '')), null, 15000, `the line of his own did not post its card (the stub said ${JSON.stringify(mused).slice(0, 240)})`);
const thought = page.locator('#pg-core .ccard:not(.wall)[data-kind="brief"]', { hasText: 'A thought of mine' }).last();
// (short waits with a catch each: with no card there is nothing to read, and one missing card must not crash the run)
check(/^Why: one line of my own a day, from /.test((await thought.locator('.ccwhy').textContent({ timeout: 5000 }).catch(() => '')) ?? ''), 'the thought says no why');
await thought.locator('button', { hasText: /post that/i }).click({ timeout: 5000 }).catch(() => problems.push('no POST THAT? on the thought'));
const thoughtLine = ((await thought.textContent({ timeout: 5000 }).catch(() => '')) ?? '').match(/Been thinking about this one: ([^.]{8,60})/)?.[1] ?? 'Been thinking about this one';
await until(([c, words]) => [...document.querySelectorAll(c)].some((x) => x.dataset.state === 'waiting' && (x.textContent ?? '').includes(words)), [card, thoughtLine], 10000, 'POST THAT? made no draft');
check((await stub()).sent.length === 1, 'POST THAT? posted without APPROVE');
await page.screenshot({ path: `${out}/social-musing.png` });
log('the line of his own and POST THAT?');

// ---- 5. FATHER AND THE ORIGIN: from Settings → CHARACTER, the Me sheet and "who made you?"
const originShown = async (how) => {
  await page.waitForSelector('.modal .origin', { timeout: 6000 }).catch(() => problems.push(`${how}: FATHER AND THE ORIGIN did not open`));
  const o = await page.evaluate(() => ({ lead: [...document.querySelectorAll('.modal .origin .orlead')].map((p) => p.textContent ?? ''), heads: [...document.querySelectorAll('.modal .origin .orhead')].map((p) => p.textContent ?? ''), dialog: document.querySelector('.modal .mbox')?.getAttribute('aria-label') ?? '' }));
  check(/^You made me\. You’re my father/.test(o.lead[0] ?? '') && /^I was born on 15 October 2026/.test(o.lead[1] ?? ''), `${how}: the page starts ${JSON.stringify(o.lead)}`);
  check(o.heads.join('|') === 'WHO MADE ME|WHEN I WAS BORN|WHAT I’M MADE OF|WHAT I’M FOR|WHAT I’VE LEARNED, BY MONTH|MY PROMISES', `${how}: the parts are ${o.heads.join(', ')}`);
  check(o.dialog === 'Father and the origin', `${how}: the sheet is named "${o.dialog}" for VoiceOver`);
};
const closeModal = async () => {
  await page.click('.modal .mhead button').catch(() => undefined);
  await page.waitForTimeout(300);
};
await page.evaluate(() => (location.hash = 'settings'));
await openPanel(page, 'settings', 'CHARACTER');
await page.locator('#pg-settings .character button', { hasText: /father and the origin/i }).click().catch(() => problems.push('no FATHER AND THE ORIGIN row in CHARACTER'));
await originShown('Settings → CHARACTER');
await page.screenshot({ path: `${out}/social-origin.png` });
await closeModal();
await page.evaluate(() => (location.hash = 'core'));
await page.waitForTimeout(600);
await page.click('#top .you');
await page.click('#mesheet .merow[data-id="origin"]').catch(() => problems.push('no FATHER AND THE ORIGIN row on the Me sheet'));
await originShown('the Me sheet');
await closeModal();
await openChat();
await say('who made you?');
await until(() => [...document.querySelectorAll('#pg-core .msg:not(.me)')].some((m) => /You made me\. You’re my father/.test(m.textContent ?? '')), null, 10000, '"who made you?" was not answered with the page\'s first lines');
const originCard = page.locator('#pg-core .ccard:not(.wall)[data-id="origin"]').last();
await originCard.locator('button', { hasText: /open/i }).click().catch(() => problems.push('no card to open the page'));
await originShown('"who made you?"');
await closeModal();
log('FATHER AND THE ORIGIN from three places');

// ---- 6. 390 × 844: nothing sideways (the drafts in the chat; LINKS → BLUESKY and the page drawn afresh); every control named
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(600);
for (const s of await sideways('#pg-core .ccard.draftcard, #pg-core .ccard.draftcard *')) problems.push(`[390] a draft card sticks out: ${s}`);
const small = await ctx.newPage();
small.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror (390): ${e.message}`));
await small.setViewportSize({ width: 390, height: 844 });
await small.goto(`${base}/#links`, { waitUntil: 'domcontentloaded' });
await small.waitForSelector('#boot', { state: 'detached', timeout: 30000 }).catch(() => undefined);
await openPanel(small, 'links', 'BLUESKY');
// (a pushed panel slides in from the right: measured once it has arrived)
await small.waitForFunction(() => { const r = document.querySelector('#pg-links .pn.socialpanel.pushed')?.getBoundingClientRect(); return !!r && r.left >= -1 && r.right <= innerWidth + 1; }, null, { timeout: 5000 }).catch(() => undefined);
await small.waitForTimeout(300);
const smallSideways = (sel) => small.$$eval(sel, (els) => els.filter((e) => e.getClientRects().length).filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1); }).slice(0, 5).map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join('.')} "${(e.textContent ?? '').trim().slice(0, 40)}"`));
for (const s of await smallSideways('#pg-links .pn.socialpanel, #pg-links .pn.socialpanel *')) problems.push(`[390] LINKS → BLUESKY sticks out: ${s}`);
for (const u of await small.$$eval('#pg-links .pn.socialpanel input, #pg-links .pn.socialpanel button', (els) => els.filter((e) => e.getClientRects().length).filter((e) => !(e.getAttribute('aria-label') || (e.textContent ?? '').trim())).map((e) => e.tagName))) problems.push(`[390] unnamed in BLUESKY: ${u}`);
await small.screenshot({ path: `${out}/social-390-bluesky.png` });
await small.evaluate(() => (location.hash = 'settings'));
await openPanel(small, 'settings', 'CHARACTER');
await small.locator('#pg-settings .character button', { hasText: /father and the origin/i }).click().catch(() => problems.push('[390] no FATHER AND THE ORIGIN row'));
await small.waitForSelector('.modal .origin', { timeout: 6000 }).catch(() => problems.push('[390] the origin page did not open'));
await small.waitForTimeout(300);
for (const s of await smallSideways('.modal .origin, .modal .origin *')) problems.push(`[390] the origin page sticks out: ${s}`);
await small.screenshot({ path: `${out}/social-390-origin.png` });
await small.close();

// ---- leave nothing behind
await brainApi('/social/link?account=bluesky', { method: 'DELETE' });
await stub('?reset=1');
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'Social clean: LINKS → BLUESKY (a main password refused on the phone, an app password linked); "what\'s on Bluesky?" with authors and times; a draft with APPROVE · EDIT · NO, edited, approved once (the stub got one post), WHY lists it, NO sends nothing; a line of his own with POST THAT? (a draft); FATHER AND THE ORIGIN from Settings, the Me sheet and "who made you?"; nothing sideways at 390 × 844; every control named.');
process.exit(problems.length ? 1 : 0);
