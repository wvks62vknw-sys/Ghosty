// FORESIGHT on the owner's phone (440 × 956; OWNER-ISSUES 61a, 74(3), 75(b)), against the preview brain with its public
// feeds stood in (tests/fixtures/foresight-feeds.mjs: never the live ones) and a day of foresight put in its ledger
// (/__test/foresight?made=1: yesterday's 08:12 expected late and six minutes late, one of his questions from yesterday still
// open, today's rain and train open), so nothing here depends on the clock:
//  1. the Brief's FORESIGHT, after YOUR DAY and the commute: today's expectations with the confidence as a word, yesterday's
//     line, his question on record, the standing line and what is missing; a tap on his question offers RIGHT / WRONG, and
//     RIGHT keeps his word: the yesterday line updates (right 2 of 2);
//  2. SYSTEM → Report card → FORESIGHT: a bar per kind, the last scored with ✓, the open ones, the honest footer;
//  3. the chat with no model: "what do you expect today?" and "how often are you right?" answered on the phone, no request
//     to /api/chat;
//  4. one of his questions put on record by the chat's model (the foresee tool), then "you were right" → "Noted: right."
//     with no request to /api/chat;
//  5. the day scored by the feeds, the brain's own alarm brought forward (/__test/foresee-due): the rain came (right), the
//     08:12 was six minutes late (expected on time: wrong) — the Report card shows both;
//  then the ledger and the places are put back for the specs after it on the same brain.
//   BASE=http://localhost:8788 node tests/foresight.spec.mjs [outDir]
import { mkdirSync } from 'node:fs';
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, openPanel, openSection } from './nav.mjs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const problems = [];
const check = (ok, what) => void (ok || problems.push(what));

// The seeded day is UK days: a run that would straddle midnight waits for it to pass first (a "yesterday" that turns
// into "two days ago" half-way through would be the clock's fault, not the code's).
const ukClock = () => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(Date.now());
if (ukClock() >= '23:54') {
  console.log('waiting for UK midnight to pass before seeding the day');
  while (ukClock() >= '23:54') await new Promise((r) => setTimeout(r, 15_000));
}

const fore = (q) => fetch(`${base}/__test/foresight?${q}`).then((r) => r.json());
await fore('reset=1&made=1&rain=1&late=1');

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
// (the service worker blocked: Chromium stops reporting a controlled page's requests, and this spec counts them)
const ctx = await browser.newContext({ viewport: PHONE, ...UK, serviceWorkers: 'block' });
const page = await ctx.newPage();
page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
const chats = [];
// the Brief's drive to work (no TomTom key on the preview): stood in, so the brain never asks the live route service
await ctx.route('**/api/traffic/commute/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ minutes: 35, km: 32.5, delayMin: 0, live: false, line: 'about 35 min by car with clear roads (no live traffic: add the free TomTom key in System for it)' }) }));
await ctx.route('**/api/chat', (route) => {
  if (route.request().method() === 'POST') chats.push(route.request().postData() ?? '');
  return route.continue();
});

await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#pair input', { timeout: 20000 });
await page.fill('#pair input', KEY);
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
const api = (path, init = {}) => page.evaluate(async ([p, i, k]) => (await fetch(`/api${p}`, { ...i, headers: { 'content-type': 'application/json', 'x-ghosty': '1', 'x-ghosty-key': k } })).json(), [path, init, KEY]);
const until = (fn, arg, ms, what) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => (problems.push(what), false));
const text = (sel) => page.evaluate((s) => document.querySelector(s)?.textContent?.replace(/\s+/g, ' ').trim() ?? '', sel);
/** A picture once nothing is moving (the screen slides in), with the card in view. */
const shot = async (sel, name) => {
  await page.locator(sel).first().scrollIntoViewIfNeeded().catch(() => undefined);
  await page.waitForTimeout(150);
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined)))).catch(() => undefined);
  await page.screenshot({ path: `${out}/${name}.png` });
};

// his home and work, as Memory → ME → PLACES keeps them (no TomTom key on the preview: the commute's prediction is said missing)
const had = (await api('/profile/places')).places ?? [];
await api('/profile/places', { method: 'POST', body: JSON.stringify({ found: { id: 'home', label: 'Home', query: 'B13 8PX', address: 'B13 8PX, Moseley, Birmingham', lat: 52.443186, lon: -1.892525 } }) });
await api('/profile/places', { method: 'POST', body: JSON.stringify({ found: { id: 'work', label: 'Work', query: 'WV1 1LY', address: 'WV1 1LY, Wolverhampton', lat: 52.5862, lon: -2.1288 } }) });

// ---- 1. the Brief's FORESIGHT
await page.evaluate(() => (location.hash = 'brief'));
const card = '#pg-brief .pn.foresight';
await page.waitForSelector(card, { timeout: 10000 });
await until((s) => /Yesterday: right 1 of 1/.test(document.querySelector(s)?.textContent ?? ''), card, 15000, `the Brief's FORESIGHT never showed yesterday: "${await text(card)}"`);
const order = await page.$$eval('#pg-brief .col .pn:not([hidden])', (ps) => ps.map((p) => p.className.split(' ').find((c) => ['brday', 'commute', 'foresight', 'wx', 'news'].includes(c)) ?? p.className));
check(order.indexOf('foresight') > order.indexOf('brday') && order[1] === 'commute' && order[2] === 'foresight', `FORESIGHT is not after YOUR DAY and the commute (order: ${order.join(', ')})`);
const lines = await page.$$eval(`${card} .foreline .v`, (vs) => vs.map((v) => v.textContent));
check(lines.join(' | ') === 'Likely: rain by 15:00 | I think: the 08:12 on time', `today's lines: ${lines.join(' | ')}`);
const brief = await text(card);
check(brief.includes('Yesterday: right 1 of 1 — I expected the 08:12 late; it was, by 6 minutes.'), `the yesterday line: ${brief}`);
check(brief.includes('I keep score: I’ve only scored 1 so far about trains.') || brief.includes("I keep score: I've only scored 1 so far about trains."), `the standing line: ${brief}`);
check(brief.includes('The commute needs the free TomTom key, SYSTEM → KEYS.'), `the missing key is not said: ${brief}`);
check(/On record\s*rain on Saturday · “will it rain on Saturday\?”/i.test(brief), `his question on record: ${brief}`);
check(/2 today/i.test(await text(`${card} .phead small, ${card} small`)) || /2 TODAY/.test(brief), `the panel's status: ${await text(card)}`);
await shot(card, 'foresight-brief');
// a tap on his question: RIGHT / WRONG; RIGHT keeps his word and the yesterday line updates
await page.locator(`${card} .foreask`).first().click();
await page.waitForSelector(`${card} .foreacts`, { timeout: 5000 }).catch(() => problems.push('a tap on his question offered no RIGHT / WRONG'));
const acts = await page.$$eval(`${card} .foreacts button`, (bs) => bs.map((b) => ({ t: b.textContent, h: b.getBoundingClientRect().height })));
check(acts.map((a) => a.t).join(',') === 'RIGHT,WRONG' && acts.every((a) => a.h >= 44), `the choices: ${JSON.stringify(acts)}`);
await page.locator(`${card} .foreacts button`, { hasText: 'RIGHT' }).click();
await until((s) => /Yesterday: right 2 of 2 — I expected the 08:12 late; it was, by 6 minutes\./.test(document.querySelector(s)?.textContent ?? ''), card, 10000, `RIGHT did not update the yesterday line: "${await text(card)}"`);
check(!(await page.locator(`${card} .foreask`).count()), 'his answered question is still on record as open');
const asked = (await api('/foresight')).items.find((p) => p.id === 'seed-ask-y');
check(asked?.outcome?.right === true && asked.outcome.how === 'owner', `his word was not kept: ${JSON.stringify(asked?.outcome)}`);
await shot(card, 'foresight-brief-right');

// ---- 2. SYSTEM → Report card → FORESIGHT
const rcard = '#pg-system .pn.foresightrc';
const openReport = async () => {
  await page.evaluate(() => (location.hash = 'system'));
  await openSection(page, 'system', 'Report card');
  await openPanel(page, 'system', 'FORESIGHT');
  await page.waitForSelector(rcard, { state: 'visible', timeout: 10000 }).catch(() => problems.push('no FORESIGHT on the Report card'));
};
await openReport();
await until((s) => /LAST SCORED/.test(document.querySelector(s)?.textContent ?? '') && /YOUR QUESTIONS/i.test(document.querySelector(s)?.textContent ?? ''), rcard, 10000, `the Report card's FORESIGHT: "${await text(rcard)}"`);
const bars = await page.$$eval(`${rcard} .forebars .bar`, (bs) => bs.map((b) => `${b.dataset.kind}:${b.querySelector('b')?.textContent}`));
check(bars.join(' | ') === 'rain:none yet | departure:100% · 1 | commute:none yet | answer:100% · 1', `the bars: ${bars.join(' | ')}`);
const rc = await text(rcard);
check(/✓\s*I expected the 08:12 late; it was, by 6 minutes\./.test(rc) && /✓\s*I expected rain on Saturday; you said I was right\./.test(rc), `the last scored: ${rc}`);
check(/I expect rain by 15:00 \(70%\)/.test(rc) && /I expect the 08:12 on time \(60%\)/.test(rc), `the open ones: ${rc}`);
check(rc.includes('Scored only against the feeds and your own word') && rc.includes('The commute needs the free TomTom key, SYSTEM → KEYS.'), `the footer: ${rc}`);
await shot(rcard, 'foresight-reportcard');

// ---- 3. the chat, no model
await page.evaluate(() => (location.hash = 'core'));
await page.waitForSelector('#cin', { state: 'visible', timeout: 10000 });
const replies = () => page.evaluate(() => [...document.querySelectorAll('#pg-core .msg:not(.me)')].map((m) => m.textContent?.replace(/\s+/g, ' ').trim() ?? ''));
const lastReply = async () => (await replies()).at(-1) ?? '';
const say = async (t) => {
  await page.fill('#cin', t);
  await page.keyboard.press('Enter');
};
const before = chats.length;
await say('what do you expect today?');
await until(() => [...document.querySelectorAll('#pg-core .msg:not(.me)')].some((m) => /I expect rain by 15:00 \(70%\)\.\s*I expect the 08:12 on time \(60%\)\./.test(m.textContent ?? '')), null, 10000, `"what do you expect today?" → "${await lastReply()}"`);
await say('how often are you right?');
await until(() => [...document.querySelectorAll('#pg-core .msg:not(.me)')].some((m) => /I've only scored 1 so far about trains\.\s*I've only scored 1 so far about your questions\./.test(m.textContent ?? '')), null, 10000, `"how often are you right?" → "${await lastReply()}"`);
await page.waitForTimeout(500);
check(chats.length === before, `the no-model questions went to the brain's chat ${chats.length - before} time(s)`);

// ---- 4. one of his questions put on record by the model, then his word with no model
await say('what do you reckon, will it rain tomorrow?');
await until(() => [...document.querySelectorAll('#pg-core .msg:not(.me)')].some((m) => /On record: I expect rain \(60%\)/.test(m.textContent ?? '')), null, 20000, `the model did not put it on record: "${await lastReply()}"`);
check(chats.length === before + 1, 'the question for the model did not go to the chat');
const onRecord = (await api('/foresight')).items.find((p) => p.subject === 'rain at Home tomorrow');
check(onRecord?.kind === 'answer' && !onRecord.outcome, `the record: ${JSON.stringify(onRecord)}`);
await say('you were right');
await until(() => [...document.querySelectorAll('#pg-core .msg:not(.me)')].some((m) => /Noted: right\./.test(m.textContent ?? '')), null, 10000, `"you were right" → "${await lastReply()}"`);
await page.waitForTimeout(400);
check(chats.length === before + 1, '"you were right" went to the brain\'s chat');
check((await api('/foresight')).items.find((p) => p.subject === 'rain at Home tomorrow')?.outcome?.how === 'owner', 'his word on the new question was not kept');
await shot('#pg-core .msg:last-child', 'foresight-chat');

// ---- 5. the day scored by the feeds: the rain came, the 08:12 was six minutes late
const due = await fetch(`${base}/__test/foresee-due`).then((r) => r.json());
const got = Object.fromEntries((due.ledger?.items ?? []).filter((p) => p.id === 'seed-rain' || p.id === 'seed-dep').map((p) => [p.id, p.outcome]));
check(got['seed-rain']?.right === true && /^rain \(\d+\.\d mm\)$/.test(got['seed-rain']?.actual ?? ''), `the rain: ${JSON.stringify(got['seed-rain'])}`);
check(got['seed-dep']?.right === false && got['seed-dep']?.actual === '6 minutes late', `the 08:12: ${JSON.stringify(got['seed-dep'])}`);
await openReport();
await until((s) => /✗\s*I expected the 08:12 on time; it was 6 minutes late\./.test(document.querySelector(s)?.textContent ?? ''), rcard, 10000, `the Report card after the day: "${await text(rcard)}"`);
const after = await page.$$eval(`${rcard} .forebars .bar`, (bs) => bs.map((b) => `${b.dataset.kind}:${b.querySelector('b')?.textContent}`));
check(after.join(' | ') === 'rain:100% · 1 | departure:50% · 2 | commute:none yet | answer:100% · 2', `the bars after the day: ${after.join(' | ')}`);
await shot(rcard, 'foresight-scored');
for (const r of await page.evaluate(() => [...document.querySelectorAll('#pg-system :is(button, .bar)')].filter((e) => e.getClientRects().length).map((e) => e.getBoundingClientRect().right))) if (r > PHONE.width + 1) problems.push(`something sticks out sideways (${Math.round(r)} px)`);

// ---- put back what this spec changed, for the specs after it on the same brain
await fore('reset=1&rain=1&late=1');
if (!had.some((p) => p.id === 'home')) await api('/profile/places?id=home', { method: 'DELETE' });
if (!had.some((p) => p.id === 'work')) await api('/profile/places?id=work', { method: 'DELETE' });
await api('/inbox/read', { method: 'POST', body: JSON.stringify({ ids: 'all' }) });

await browser.close();
if (problems.length) {
  console.error(`FAIL foresight:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('ok: FORESIGHT — the Brief after the commute: today as "Likely" / "I think", yesterday right 1 of 1, his question on record, the standing line, the missing TomTom key said; RIGHT kept his word and yesterday became right 2 of 2; the Report card: a bar per kind, ✓ and ✗ with what happened, the open ones, the honest footer; "what do you expect today?" and "how often are you right?" with no model; a question put on record by the model and "you were right" with no model; the day scored by the feeds: rain right, the 08:12 six minutes late.');
