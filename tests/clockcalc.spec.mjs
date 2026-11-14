// THE CLOCK and THE CALCULATOR (docs/build-plan/apps/polish3.md, new apps on the App Kit), at 440 × 956 and 390 × 844:
//   a. System → CLOCK AND CALCULATOR opens each; "open the clock", "stopwatch" and "calculator" in the chat open them too.
//   b. The clock: the time here, three sample cities with their time and how each stands to here; a city found as he types and
//      added; ✕ deletes with Undo; the stopwatch starts, laps, stops and resets; a timer starts and shows in the list.
//   c. The calculator: keys and a keyboard make a sum, = puts it on the tape, a shop percent, a division by nothing said in
//      plain words, a tape row tapped to use again; every key 44 pt, nothing sideways, in all seven worlds and at BODY 21.
//   BASE=http://localhost:8788 node tests/clockcalc.spec.mjs [outDir]
import { mkdirSync } from 'node:fs';
import { launch, webkitNoise } from './browser.mjs';
import { UK } from './nav.mjs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const PHONE = { width: 440, height: 956 };
const PHONE2 = { width: 390, height: 844 };
const WORLDS = ['scan', 'map', 'eye', 'orbit', 'grown', 'ink', 'glass'];
const RAW = /\b(undefined|NaN|null|\[object Object\])\b|\$\{/;
const problems = [];
let checks = 0;
const t0 = Date.now();
const check = (ok, msg) => {
  checks++;
  if (!ok) {
    problems.push(msg);
    console.log(`  red: ${msg.slice(0, 280)}`);
  }
};
const log = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s · ${s}`);

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--disable-dev-shm-usage'] });
const live = [];
process.on('uncaughtException', async (e) => {
  problems.push(`crashed: ${String(e.message).split('\n')[0]} ${String(e.stack ?? '').split('\n').filter((l) => l.includes('.spec.mjs')).slice(0, 2).join(' ')}`);
  console.log(`PROBLEMS:\n${problems.join('\n')}`);
  process.exit(1);
});

/** One phone, paired, in a world and a text size; `store` seeds localStorage once; `status` replaces the brain's /api/status answer. */
async function phone(viewport, o = {}) {
  const ctx = await browser.newContext({ viewport, screen: viewport, deviceScaleFactor: 1, isMobile: true, hasTouch: true, ...UK, serviceWorkers: 'block', acceptDownloads: true });
  live.push(ctx);
  await ctx.route(/^https:\/\/(?!localhost)/, (route) => route.fulfill({ status: 404, body: '' }));
  if (o.status) await ctx.route('**/api/status', async (route) => {
    const r = await route.fetch().catch(() => null);
    const real = r ? await r.json().catch(() => ({})) : {};
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...real, ...o.status }) });
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${viewport.width}] pageerror: ${e.message}`));
  await page.addInitScript(({ key, body, world, store }) => {
    if (sessionStorage.getItem('sn.seeded')) return;
    sessionStorage.setItem('sn.seeded', '1');
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.themes1', '1');
    localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Tony', speak: false, sounds: false, favourites: [], look: { ground: 'graphite', world, night: 'graphite', switches: body ? { body } : {} }, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
    for (const [k, v] of Object.entries(store ?? {})) localStorage.setItem(k, v);
  }, { key: KEY, body: o.body ?? 0, world: o.world ?? 'scan', store: o.store ?? {} });
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
  return { ctx, page };
}
const until = (page, fn, arg, ms = 10000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const text = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => e.getClientRects().length).map((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim()).join(' | '), sel);
/** Every key in `root` at 44 pt, nothing sideways on the page, no word cut inside `root`, no raw string. */
async function fit(page, tag, root) {
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined)))).catch(() => undefined);
  const r = await page.evaluate((root) => {
    const vis = (e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]');
    const all = [...document.querySelectorAll(root)].flatMap((x) => [x, ...x.querySelectorAll('*')]).filter(vis);
    const small = all.filter((e) => e.matches('button, summary, input:not([type=hidden]):not([type=file]), select, [role=button]')).map((e) => {
      const b = e.getBoundingClientRect();
      return b.width >= 43.5 && b.height >= 43.5 ? '' : `${e.tagName.toLowerCase()} "${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24)}" ${Math.round(b.width)}×${Math.round(b.height)}`;
    }).filter(Boolean);
    const sideways = document.documentElement.scrollWidth > innerWidth + 1;
    const cut = all.filter((e) => !e.matches('input, select, textarea') && e.textContent.trim() && e.scrollWidth > e.clientWidth + 1 && /(hidden|clip)/.test(getComputedStyle(e).overflowX)).map((e) => e.textContent.trim().slice(0, 30));
    return { small: small.slice(0, 6), sideways, cut: cut.slice(0, 4), words: [...document.querySelectorAll(root)].map((x) => x.innerText).join(' ') };
  }, root);
  check(!r.small.length, `${tag}: under 44 pt: ${r.small.join(', ')}`);
  check(!r.sideways, `${tag}: sideways`);
  check(!r.cut.length, `${tag}: words cut: ${r.cut.join(' | ')}`);
  check(!RAW.test(r.words), `${tag}: a raw string: ${(RAW.exec(r.words) ?? [''])[0]}`);
}

/** Tap a confirm sheet's yes once its sheet has finished arriving (a tap mid-spring can land on the backdrop and close it). */
async function sayYes(page, word) {
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined)))).catch(() => undefined);
  await page.locator('.sureyes', { hasText: word }).last().click();
}


const tapKey = (page, label) => page.click(`.calchost .calcpad [data-calc="${label}"]`);
async function openSystemPanel(page) {
  await page.evaluate(() => (location.hash = 'system'));
  await page.waitForSelector('#pg-system [data-act="openclock"]', { state: 'attached', timeout: 30000 });
  await page.evaluate(() => document.querySelector('#pg-system [data-act="openclock"]').closest('.pn')?.scrollIntoView());
}
async function chat(page, words) {
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForSelector('#cin', { state: 'visible', timeout: 15000 });
  await page.fill('#cin', words);
  await page.keyboard.press('Enter');
}
const closeModal = async (page) => {
  await page.keyboard.press('Escape');
  await until(page, () => !document.querySelector('.modal'));
};

// ---------- a + b + c at 440 and 390, in the first world
for (const [vp, tag] of [[PHONE, '440'], [PHONE2, '390']]) {
  const { ctx, page } = await phone(vp);
  try {
    // a. the front door in System
    await openSystemPanel(page);
    await page.evaluate(() => document.querySelector('#pg-system [data-act="openclock"]').click());
    check(await until(page, () => !!document.querySelector('.modal .clkhost .ak-app')), `${tag}: OPEN THE CLOCK did not open the clock`);
    // b. the clock
    const c = await page.evaluate(() => ({
      big: document.querySelector('.clkbig')?.textContent ?? '',
      rows: [...document.querySelectorAll('.clkhost .ak-row')].map((r) => ({ t: r.querySelector('.ak-rowtitle')?.textContent, meta: r.querySelector('.ak-rowmeta')?.textContent ?? '', sub: r.querySelector('.ak-rowsub')?.textContent ?? '' })),
      tour: document.querySelector('.clkhost .ak-tour')?.textContent ?? '',
    }));
    check(/^\d\d:\d\d$/.test(c.big), `${tag} clock: the time here reads "${c.big}"`);
    check(c.rows.map((r) => r.t).join(',') === 'New York,Dubai,Tokyo', `${tag} clock: sample cities ${c.rows.map((r) => r.t).join(',')}`);
    check(c.rows.every((r) => /^\d\d:\d\d$/.test(r.meta) && /^(Today|Tomorrow|Yesterday), /.test(r.sub)), `${tag} clock: a row reads ${JSON.stringify(c.rows[0])}`);
    await page.fill('.clkcity', 'syd');
    await page.click('.clkfound button[aria-label="Add Sydney"]');
    check(await until(page, () => document.querySelector('.clkhost .ak-row .ak-rowtitle')?.textContent === 'Sydney' && /Added Sydney/.test(document.querySelector('.clkhost .ak-notice')?.textContent ?? '')), `${tag} clock: Sydney was not added with its notice`);
    await page.click('.clkhost .ak-row[data-id="c-dubai"] .ak-rowdel');
    check(await until(page, () => !document.querySelector('.clkhost .ak-row[data-id="c-dubai"]') && /Recently deleted/.test(document.querySelector('.clkhost .ak-notice')?.textContent ?? '')), `${tag} clock: ✕ did not delete Dubai with its notice`);
    await page.locator('.clkhost .ak-tools button', { hasText: 'Undo' }).click();
    check(await until(page, () => !!document.querySelector('.clkhost .ak-row[data-id="c-dubai"]')), `${tag} clock: Undo did not bring Dubai back`);
    await fit(page, `${tag} clock world`, '.modal');
    if (tag === '440') await page.screenshot({ path: `${out}/clockcalc-clock-440.png` });
    await page.click('.clkseg [data-part="stopwatch"]');
    await page.locator('.clkkeys button', { hasText: 'Start' }).click();
    const from = await page.evaluate(() => performance.now());
    await page.waitForFunction((t) => performance.now() > t + 400, from);
    await page.locator('.clkkeys button', { hasText: 'Lap' }).click();
    await page.locator('.clkkeys button', { hasText: 'Stop' }).click();
    const sw = await page.evaluate(() => ({ st: window.__ghosty.clockApp, read: document.querySelector('.clkwatch')?.textContent ?? '', laps: document.querySelectorAll('.clklaps li').length }));
    check(sw.st?.watch === 'stopped' && sw.laps === 1 && /^0:00\.[3-9]\d$|^0:0[1-9]\.\d\d$/.test(sw.read), `${tag} stopwatch: ${JSON.stringify(sw)}`);
    await fit(page, `${tag} stopwatch`, '.modal');
    await page.locator('.clkkeys button', { hasText: 'Reset' }).click();
    check(await until(page, () => window.__ghosty.clockApp.watch === 'idle'), `${tag} stopwatch: Reset did not reset`);
    await page.click('.clkseg [data-part="timer"]');
    await page.click('.clkpresets button[aria-label="Start a 5 minute timer"]');
    check(await until(page, () => /^4:5\d|^5:00/.test(document.querySelector('.clktimer span span')?.textContent?.trim() ?? '')), `${tag} timers: the 5 minute timer is not running`);
    await fit(page, `${tag} timers`, '.modal');
    await page.locator('.clktimer button', { hasText: 'Cancel' }).first().click();
    await closeModal(page);

    // c. the calculator
    await openSystemPanel(page);
    await page.evaluate(() => document.querySelector('#pg-system [data-act="opencalc"]').click());
    check(await until(page, () => !!document.querySelector('.modal .calchost .ak-app')), `${tag}: OPEN THE CALCULATOR did not open it`);
    const tape0 = await page.evaluate(() => [...document.querySelectorAll('.calchost .ak-row')].map((r) => r.querySelector('.ak-rowmeta')?.textContent));
    check(tape0.join(',') === '15,000,74.52', `${tag} calc: the sample tape reads ${tape0.join(' | ')}`);
    for (const k of ['1', '2', '×', '7']) await tapKey(page, k);
    check(await until(page, () => document.querySelector('.calcbig')?.textContent === '84'), `${tag} calc: 12 × 7 shows ${await page.textContent('.calcbig')}`);
    await tapKey(page, '=');
    check(await until(page, () => document.querySelector('.calchost .ak-row .ak-rowmeta')?.textContent === '84' && document.querySelector('.calchost .ak-row .ak-rowtitle')?.textContent === '12 × 7'), `${tag} calc: = did not put 12 × 7 = 84 on the tape`);
    await page.keyboard.type('+10%');
    check(await until(page, () => document.querySelector('.calcbig')?.textContent === '92.4'), `${tag} calc: 84 + 10% by keyboard shows ${await page.textContent('.calcbig')}`);
    await page.keyboard.press('Enter');
    await tapKey(page, 'C');
    await page.keyboard.type('1/0');
    await page.keyboard.press('Enter');
    check(await until(page, () => /divide by nothing/.test(document.querySelector('.calcbig')?.textContent ?? '')), `${tag} calc: 1 ÷ 0 says ${await page.textContent('.calcbig')}`);
    await page.click('.calchost .ak-row[data-id="k-1"] .ak-rowmain');
    check(await until(page, () => document.querySelector('.calcbig')?.textContent === '15,000'), `${tag} calc: tapping the tape row did not use it again`);
    await fit(page, `${tag} calc`, '.modal');
    if (tag === '440') await page.screenshot({ path: `${out}/clockcalc-calc-440.png` });
    await closeModal(page);

    // a. by words
    if (tag === '440') {
      await chat(page, 'calculator');
      check(await until(page, () => !!document.querySelector('.modal .calchost'), null, 15000), '"calculator" did not open the calculator');
      await closeModal(page);
      await chat(page, 'stopwatch');
      check(await until(page, () => !!document.querySelector('.modal .clkhost .clkwatch'), null, 15000), '"stopwatch" did not open the clock on its stopwatch');
      await closeModal(page);
    }
  } finally {
    await ctx.close();
  }
}
log('a, b, c at 440 and 390');

// ---------- every world, and BODY 21
for (const [i, world] of [...WORLDS, 'scan'].entries()) {
  const body = i === WORLDS.length ? 21 : 0;
  const tag = body ? 'BODY 21' : world;
  const { ctx, page } = await phone(PHONE, { world, body });
  try {
    await openSystemPanel(page);
    await page.evaluate(() => document.querySelector('#pg-system [data-act="openclock"]').click());
    await page.waitForSelector('.modal .clkhost .ak-row', { timeout: 10000 });
    await fit(page, `${tag} clock`, '.modal');
    await closeModal(page);
    await page.evaluate(() => document.querySelector('#pg-system [data-act="opencalc"]').click());
    await page.waitForSelector('.modal .calchost .calcpad', { timeout: 10000 });
    await fit(page, `${tag} calc`, '.modal');
    if (world === 'ink' || body) await page.screenshot({ path: `${out}/clockcalc-calc-${body ? 'body21' : world}-440.png` });
    await closeModal(page);
  } finally {
    await ctx.close();
  }
}
log('every world and BODY 21');

await browser.close();
console.log(`${checks} checks`);
if (problems.length) {
  console.log(`PROBLEMS:\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('clockcalc: all green');
