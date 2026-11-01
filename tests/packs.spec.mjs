// THE PACKS on the owner's phone (BRIEF-PACKS-1: money, body, kitchen), against the preview's real brain (no model needed
// for any of this), at 440 × 956 and 390 × 844:
//  - MONEY: a statement pasted in the chat's one-line box (its breaks lost, put back) → the month's card in the chat (the
//    top five, what changed) and his message shown as "a statement pasted", never the statement; the PASTE A STATEMENT box
//    keeps a PDF's text lines and reads it too; the brain kept the rows by its rules;
//  - KITCHEN: "timer 8 minutes for the pasta" typed → the phone's clock stubbed 8 minutes on → it rings (its
//    card, the timer ringing) → "stop the pasta timer"; the shopping list: added in its sheet, a thing ticked, kept by the brain;
//  - BODY: "breathe" opens BREATHE and its phases move; "count my squats" opens REPS on Chromium's fake camera (as the Lens
//    specs) with the pose model stood in (window.__ghostyPoseEngine, honoured only under a test runner) squatting three
//    times → 3 counted → DONE → the card in the chat; and the real vendored pose model loads and runs on the fake camera;
//  - every sheet (statement, timers, shopping, plan, breathe, stretch, reps, run, health, water) at 390 × 844: nothing
//    sideways, every button and field named for VoiceOver, the counts live regions. No page errors.
//   BASE=http://localhost:8822 node tests/packs.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, standDown } from './nav.mjs';
import { mkdirSync, readFileSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const problems = [];
const t0 = Date.now();
await standDown(base, KEY);
const log = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s · ${s}`);
const api = (path, body) => fetch(`${base}/api${path}`, { method: body ? 'POST' : 'GET', headers: { 'x-ghosty': '1', 'x-ghosty-key': KEY, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }).then((r) => r.json());
const MONZO = readFileSync(new URL('../apps/edge/test/spending/monzo.csv', import.meta.url), 'utf8');
const PDF_TEXT = `Statement 1 November 2026 to 30 November 2026
01 Nov 26 BALANCE BROUGHT FORWARD 900.00
02 Nov 26 SAINSBURYS S/MKTS DEB 31.20 868.80
03 Nov 26 GREGGS DEB 3.45 865.35
04 Nov 26 TRAINLINE DEB 22.10 843.25`;

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const until = (page, fn, arg, ms, why) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => (problems.push(why), false));
const sideways = (page, sel) => page.$$eval(sel, (els) => els.filter((e) => {
  if (!e.getClientRects().length) return false;
  const r = e.getBoundingClientRect();
  return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1);
}).slice(0, 5).map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join('.')} "${(e.textContent ?? '').trim().slice(0, 40)}"`));
/** Buttons and fields with no name VoiceOver could read. */
const unnamed = (page) => page.$$eval('.modal .pk button, .modal .pk input:not([type=hidden]), .modal .pk textarea', (els) => els.filter((e) => e.getClientRects().length || e.type === 'file').filter((e) => !(e.getAttribute('aria-label') || (e.textContent ?? '').trim() || e.closest('label')?.textContent?.trim())).map((e) => e.outerHTML.slice(0, 80)));

/** The stand-in pose model: standing, then three squats (half a second down, half a second up), then standing still. */
const STAND_IN = () => {
  const blank = () => Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
  const legs = (deg) => {
    const p = blank();
    const hip = { x: 0.5, y: 0.4 }, knee = { x: 0.5, y: 0.6 }, a = ((180 - deg) * Math.PI) / 180;
    const ankle = { x: knee.x + 0.2 * Math.sin(a), y: knee.y + 0.2 * Math.cos(a) };
    for (const [i, m] of [[23, hip], [24, hip], [25, knee], [26, knee], [27, ankle], [28, ankle]]) p[i] = { ...m, visibility: 0.95 };
    return p;
  };
  let first = 0;
  window.__ghostyPoseEngine = {
    detect: (_v, t) => {
      first ||= t;
      const k = Math.floor((t - first) / 500);
      return legs(k >= 1 && k <= 6 && k % 2 === 1 ? 80 : 175);
    },
    close: () => undefined,
  };
};

async function phone(viewport, opts = {}) {
  const ctx = await browser.newContext({ viewport, screen: viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ...UK, serviceWorkers: 'block', permissions: ['camera'] });
  if (opts.standIn) await ctx.addInitScript(STAND_IN);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${viewport.width}] pageerror: ${e.message}`));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pair input', { timeout: 15000 });
  await page.fill('#pair input', KEY);
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForSelector('#cin', { timeout: 10000 });
  return { ctx, page };
}
/** Polled from here (a few short page reads), for the timer's moments. */
async function poll(page, fn, ms, why) {
  for (const end = Date.now() + ms; Date.now() < end; await new Promise((r) => setTimeout(r, 150))) if (await page.evaluate(fn).catch(() => false)) return true;
  problems.push(why);
  return false;
}
async function say(page, words) {
  await page.fill('#cin', words);
  await page.press('#cin', 'Enter');
}
const lastReply = (page) => page.evaluate(() => [...document.querySelectorAll('#pg-core .msg:not(.me)')].map((m) => m.textContent ?? '').pop() ?? '');
const card = (page, prefix) => page.evaluate((p) => [...document.querySelectorAll('#pg-core article.ccard:not(.wall)')].filter((c) => c.dataset.id?.startsWith(p)).map((c) => ({ id: c.dataset.id, title: c.querySelector('.cctitle')?.textContent ?? '', line: c.querySelector('.ccline')?.textContent ?? '', acts: [...c.querySelectorAll('.ccbtn')].map((b) => b.textContent) })).pop() ?? null, prefix);
const closeSheet = (page) => page.evaluate(() => document.querySelector('.modal .mhead button')?.click());

// ---------------------------------------------------------------- 440 × 956: money, the shopping list, breathing, reps
{
  const W = 440;
  const { ctx, page } = await phone(PHONE, { standIn: true });
  // a fresh start in the preview's brain: no statement rows yet
  await fetch(`${base}/api/profile/spending`, { method: 'DELETE', headers: { 'x-ghosty': '1', 'x-ghosty-key': KEY } });
  log('money');
  // MONEY: the statement pasted in the chat's one-line box
  await say(page, MONZO);
  await until(page, () => [...document.querySelectorAll('article.ccard')].some((c) => c.dataset.id?.startsWith('money:month:')), null, 20000, `[${W}] no month card after a pasted statement: ${await lastReply(page)}`);
  const m = await card(page, 'money:month:');
  if (m && !/^October £[\d,]+ out$/.test(m.title)) problems.push(`[${W}] the month card's title: "${m.title}"`);
  if (m && m.line.split(' · ').length < 3) problems.push(`[${W}] the month card's line (the top five): "${m.line}"`);
  if (m && JSON.stringify(m.acts.map((x) => x.toUpperCase())) !== JSON.stringify(['OPEN SPENDING', 'ASK'])) problems.push(`[${W}] the month card's buttons: ${JSON.stringify(m.acts)}`);
  const shown = await page.evaluate(() => [...document.querySelectorAll('#pg-core .msg.me')].map((x) => x.textContent ?? '').join('\n'));
  if (/tx_0000|ACME WIDGETS/.test(shown) || !/A statement pasted \(19 lines\)/.test(shown)) problems.push(`[${W}] his message showed the statement itself: ${shown.slice(0, 160)}`);
  if (!/Since September/.test(await lastReply(page))) problems.push(`[${W}] the reply did not say what changed: ${await lastReply(page)}`);
  const kept = await api('/profile/spending?month=2026-10');
  if (kept.kept !== 18) problems.push(`[${W}] the brain kept ${kept.kept} rows (18 in the statement)`);
  await page.screenshot({ path: `${out}/packs-money-card-${W}.png` });
  log('statement box');
  // the PASTE A STATEMENT box keeps a PDF's text lines
  await say(page, 'Paste a statement');
  await page.waitForSelector('.modal textarea.pkpaste', { timeout: 6000 }).catch(() => problems.push(`[${W}] "paste a statement" did not open the box`));
  await page.fill('.modal textarea.pkpaste', PDF_TEXT);
  await page.click('.modal .pk button[aria-label="Read the pasted statement"]');
  await until(page, () => (window.__ghosty?.money?.read ?? 0) >= 1, null, 15000, `[${W}] the box did not read the statement`);
  const reply = await page.evaluate(() => window.__ghosty.money.reply);
  if (!/^Read 3 payments\b/.test(reply) || !/November: /.test(reply)) problems.push(`[${W}] the box's reply: ${reply.slice(0, 160)}`);
  await page.screenshot({ path: `${out}/packs-statement-${W}.png` });
  await closeSheet(page);

  log('shopping');
  // KITCHEN: the shopping list, added in its sheet and ticked
  await api('/packs/do', { pack: 'kitchen', action: 'shop', args: { words: 'clear' } });
  await say(page, 'shopping list');
  await page.waitForSelector('.modal [data-screen="shopping"]', { timeout: 6000 }).catch(() => problems.push(`[${W}] "shopping list" did not open the list`));
  await page.fill('.modal .pkadd input', 'milk, eggs and bread');
  await page.click('.modal .pkadd button');
  await until(page, () => window.__ghosty?.kitchen?.list?.length === 3, null, 8000, `[${W}] the three things were not added`);
  await page.locator('.modal .pkitem label', { hasText: 'milk' }).click();
  await until(page, () => window.__ghosty?.kitchen?.list?.find((x) => x.text === 'milk')?.done === true, null, 8000, `[${W}] milk was not ticked`);
  const brainList = (await api('/packs/do', { pack: 'kitchen', action: 'shop', args: { words: '' } })).data?.list ?? [];
  if (!brainList.some((x) => x.text === 'milk' && x.done) || brainList.filter((x) => !x.done).length !== 2) problems.push(`[${W}] the brain's list: ${JSON.stringify(brainList)}`);
  await page.click('.modal .pk button:has-text("Share as text")');
  await until(page, () => /• eggs/.test(window.__ghosty?.kitchen?.shared ?? ''), null, 6000, `[${W}] SHARE AS TEXT did not make the text`);
  await page.screenshot({ path: `${out}/packs-shopping-${W}.png` });
  await closeSheet(page);

  log('breathe');
  // BODY: breathing
  await say(page, 'breathe');
  await page.waitForSelector('.modal [data-screen="breathe"]', { timeout: 6000 }).catch(() => problems.push(`[${W}] "breathe" did not open BREATHE`));
  await page.click('.modal .pk button[aria-label="Start breathing"]');
  await until(page, () => window.__ghosty?.body?.breath?.say === 'Breathe in', null, 4000, `[${W}] breathing did not start`);
  await until(page, () => window.__ghosty?.body?.breath?.say === 'Hold', null, 7000, `[${W}] breathing did not move on to Hold`);
  await page.screenshot({ path: `${out}/packs-breathe-${W}.png` });
  await closeSheet(page);

  log('reps');
  // BODY: reps on the fake camera, the pose model stood in
  const repsBefore = Number(/(\d+) reps/.exec((await api('/packs/do', { pack: 'body', action: 'week', args: {} })).text ?? '')?.[1] ?? 0);
  await say(page, 'count my squats');
  await page.waitForSelector('.modal [data-screen="reps"]', { timeout: 6000 }).catch(() => problems.push(`[${W}] "count my squats" did not open REPS`));
  await page.click('.modal .pk button[aria-label="Start counting"]');
  await until(page, () => window.__ghosty?.body?.camera === 'on' && window.__ghosty?.body?.engine === 'stand-in', null, 15000, `[${W}] the fake camera or the stand-in did not start: ${JSON.stringify(await page.evaluate(() => window.__ghosty?.body))}`);
  await until(page, () => window.__ghosty?.body?.reps === 3, null, 15000, `[${W}] three squats were not counted: ${await page.evaluate(() => window.__ghosty?.body?.reps)}`);
  await page.screenshot({ path: `${out}/packs-reps-${W}.png` });
  await page.click('.modal .pk button[aria-label="Done: put the count in the chat"]');
  await until(page, () => window.__ghosty?.body?.camera === 'off', null, 4000, `[${W}] DONE did not stop the camera`);
  await closeSheet(page);
  await until(page, () => [...document.querySelectorAll('article.ccard')].some((c) => c.dataset.id?.startsWith('body:reps:squats')), null, 6000, `[${W}] no reps card in the chat`);
  const r = await card(page, 'body:reps:squats');
  if (r && r.title !== '3 squats') problems.push(`[${W}] the reps card: ${JSON.stringify(r)}`);
  const week = await api('/packs/do', { pack: 'body', action: 'week', args: {} });
  if (!new RegExp(`\\b${repsBefore + 3} reps\\b`).test(week.text ?? '')) problems.push(`[${W}] the brain did not keep the three squats (${repsBefore} before): ${week.text}`);
  await page.screenshot({ path: `${out}/packs-chat-${W}.png` });
  await ctx.close();
}

// ---------------------------------------------------------------- a timer set by text, the clock run on: it rings
{
  const W = 440;
  const { ctx, page } = await phone(PHONE);
  log('timer');
  await say(page, 'timer 8 minutes for the pasta');
  await poll(page, () => (window.__ghosty?.timers?.() ?? []).some((t) => t.name === 'pasta' && t.left > 470 && t.left <= 480), 8000, `[${W}] the pasta timer was not set: ${await lastReply(page)}`);
  if (!/Set: pasta 8:00 \(rings at \d\d:\d\d\)\. A sound and a buzz/.test(await lastReply(page))) problems.push(`[${W}] the timer's reply: ${await lastReply(page)}`);
  // the clock stub (features/kitchen/timers.ts clockNow, honoured only under a test runner): eight minutes on
  await page.evaluate(() => (window.__ghostyClockOffset = 8 * 60_000 + 1500));
  await poll(page, () => (window.__ghosty?.timers?.() ?? []).some((t) => t.name === 'pasta' && t.ringing), 6000, `[${W}] the pasta timer did not ring: ${JSON.stringify(await page.evaluate(() => window.__ghosty?.timers?.()))}`);
  await poll(page, () => [...document.querySelectorAll('article.ccard')].some((c) => c.dataset.id?.startsWith('kitchen:timer:') && /pasta done/i.test(c.textContent ?? '')), 6000, `[${W}] no "pasta done" card`);
  await page.screenshot({ path: `${out}/packs-timer-ringing-${W}.png` });
  await say(page, 'stop the pasta timer');
  await poll(page, () => (window.__ghosty?.timers?.() ?? []).length === 0, 5000, `[${W}] the timer did not stop`);
  if (!/Stopped the pasta timer\./.test(await lastReply(page))) problems.push(`[${W}] the stop's reply: ${await lastReply(page)}`);
  await ctx.close();
}

// ---------------------------------------------------------------- 390 × 844: every sheet, nothing sideways, everything named
{
  const W = 390;
  const { ctx, page } = await phone({ width: 390, height: 844 });
  log('390 sheets');
  const sheets = [['open_money', {}, 'statement'], ['open_kitchen', { what: 'timers' }, 'timers'], ['open_kitchen', { what: 'shopping' }, 'shopping'], ['open_kitchen', { what: 'plan' }, 'plan'], ['open_body', { what: 'breathe' }, 'breathe'], ['open_body', { what: 'stretch' }, 'stretch'], ['open_body', { what: 'reps' }, 'reps'], ['open_body', { what: 'run' }, 'run'], ['open_body', { what: 'health' }, 'health'], ['open_body', { what: 'water' }, 'water']];
  for (const [cmd, args, screen] of sheets) {
    log(`390: ${screen}`);
    await page.evaluate(([c, a]) => window.__ghosty.run(c, a), [cmd, args]);
    if (!(await page.waitForSelector(`.modal [data-screen="${screen}"]`, { timeout: 8000 }).catch(() => null))) {
      problems.push(`[${W}] ${cmd} ${JSON.stringify(args)} did not open ${screen}`);
      continue;
    }
    await page.waitForTimeout(500);
    const side = await sideways(page, '.modal .pk, .modal .pk *');
    if (side.length) problems.push(`[${W}] ${screen}: sideways: ${side.join('; ')}`);
    const named = await unnamed(page);
    if (named.length) problems.push(`[${W}] ${screen}: unnamed for VoiceOver: ${named.join('; ')}`);
    await page.screenshot({ path: `${out}/packs-${screen}-${W}.png` });
    // the real pose model: loads from /vendor/pose and runs on the fake camera (no person there: nothing counted)
    if (screen === 'reps') {
      await page.click('.modal .pk button[aria-label="Start counting"]');
      await until(page, () => window.__ghosty?.body?.engine === 'pose' || window.__ghosty?.body?.engine === 'none', null, 90000, `[${W}] the pose model never loaded`);
      const b = await page.evaluate(() => ({ engine: window.__ghosty.body.engine, error: window.__ghosty.body.error, reps: window.__ghosty.body.reps }));
      if (b.engine !== 'pose') problems.push(`[${W}] the vendored pose model did not run: ${b.error}`);
      await page.waitForTimeout(1500);
      if (b.reps !== 0) problems.push(`[${W}] the fake camera (no person) counted ${b.reps}`);
    }
    await closeSheet(page);
    await page.waitForTimeout(300);
  }
  // the live regions VoiceOver reads as they change: the count, the breath, the timers
  await page.evaluate(() => window.__ghosty.run('open_body', { what: 'reps' }));
  await page.waitForSelector('.modal [data-screen="reps"]');
  if (!(await page.$('.modal .pkbig[aria-live="polite"]'))) problems.push(`[${W}] the reps count is not a live region`);
  await closeSheet(page);
  await ctx.close();
}

// what this spec kept in the preview's brain goes, so the specs after it start as they would
await fetch(`${base}/api/profile/spending`, { method: 'DELETE', headers: { 'x-ghosty': '1', 'x-ghosty-key': KEY } }).catch(() => undefined);
await api('/packs/do', { pack: 'kitchen', action: 'shop', args: { words: 'clear' } }).catch(() => undefined);

await browser.close();
console.log(`(packs spec: ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
if (problems.length) {
  console.log(`PROBLEMS:\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('Packs run clean: a pasted statement (one-line box and the statement box) became the month’s card with no model; a timer typed rang when the clock reached it and stopped by name; the shopping list was added to, ticked and shared, kept by the brain; breathing moved through its phases; three squats were counted on the fake camera and carded; the vendored pose model ran; every sheet at 390 × 844 has nothing sideways and every control named.');
