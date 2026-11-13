// THE BODY LANE (FINAL ROUND, docs/build-plan/FINAL-BODY.md): the five trackers kept on the phone (features/body/track.ts: water,
// sleep, steps, weight, mood), each a whole app, and every screen of the lane (BODY, KITCHEN, OUTSIDE) drawn right, at 440 × 956
// and 390 × 844, against the preview's real brain (no model needed; the trackers need no brain at all):
//   a. WATER: the goal is worked out from his body and the day's heat and said as a first estimate (2,000 ml with no weight,
//      +250 ml at 24°C; from 13 st 4 it is 33 ml a kilo); a glass, a mug, a bottle, a pint and his own cup add; a drink is taken
//      back from today's list and by UNDO; the ring fills; the week and the month draw as a chart with the goal's line; the streak
//      counts the days in a row (today's unmet goal never breaks yesterday's run); kept on the phone (localStorage) with my brain cut;
//   b. NUDGES: on, behind at 15:00 a nudge is said; never in his quiet hours (23:00); never once the goal is met;
//   c. SLEEP: GOING TO BED then I'M UP 7 h 30 min later keeps 7 h 30 min; STEPS: two +5,000 meet the 8,000 goal (the ring met);
//      WEIGHT: "13 st 4" kept as 84.4 kg with BMI's first estimate from his height; MOOD: one tap, pressed;
//   d. THE CHAT, many wordings, answered on the phone with no model: "I drank a pint", "log a glass of water", "how much have I
//      drunk?", "I slept 7 and a half hours", "walked 6,000 steps", "how many steps today?", "what do I weigh?", "my mood is good";
//      "remind me to drink water at 5" is NOT the trackers' (the agenda's);
//   e. THE HOME CARD: the Body card's line says today's water;
//   f. every pill of BODY, KITCHEN and OUTSIDE: nothing sideways, every control 44 pt, no raw browser string; the water screen
//      offline says so in his words; at the biggest text (BODY 21) nothing is cut; in all seven looks the water screen draws whole.
//   BASE=http://localhost:8788 NO_GL_SHOTS=1 node tests/bodylane.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { UK, standDown } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const problems = [];
let checks = 0;
const t0 = Date.now();
const check = (ok, msg) => {
  checks++;
  if (!ok) {
    problems.push(msg);
    console.log(`  red: ${msg.slice(0, 240)}`);
  }
};
const log = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s · ${s}`);
const RAW = /aborted|fetch failed|undefined|NaN|\[object Object\]|TypeError|NetworkError|Failed to|Load failed|HTTP \d/i;
const VIEWPORTS = [{ width: 440, height: 956 }, { width: 390, height: 844 }];
const DAY = 864e5;
await standDown(base, KEY);
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined });

/** Three earlier days of water, each over any goal: the streak's run. */
const seedDays = () => {
  const pad = (n) => String(n).padStart(2, '0');
  const dayOf = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const water = [1, 2, 3].map((k) => ({ d: dayOf(Date.now() - k * 864e5), t: Date.now() - k * 864e5, v: 4200, from: 'tap' }));
  return { v: 1, log: { water, sleep: [], steps: [], weight: [], mood: [] }, set: {}, nudged: 0 };
};

async function phone(viewport, o = {}) {
  const ctx = await browser.newContext({ viewport, screen: viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ...UK, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(6000);
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${viewport.width}] pageerror: ${e.message}`));
  await page.addInitScript(({ key, body, world, seed }) => {
    if (!sessionStorage.getItem('bl.seeded')) {
      localStorage.setItem('ghosty.ownerKey', key);
      localStorage.setItem('ghosty.themes1', '1');
      localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Tony', speak: false, sounds: false, theme: 'reactor', favourites: [], look: { ground: 'graphite', world, night: 'graphite', switches: body ? { body } : {} }, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
      if (seed) localStorage.setItem('ghosty.body.track', JSON.stringify(seed));
      sessionStorage.setItem('bl.seeded', '1');
    }
    window.__ghostyHero = true;
    window.__ghostyPlace = { none: true };
    window.__ghostyHeat = 24;
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => window.__off !== true });
  }, { key: KEY, body: o.body ?? 0, world: o.world ?? 'scan', seed: o.seed ?? null });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
  return { ctx, page };
}

async function open(page, id, pill) {
  await page.evaluate((t) => (location.hash = t), id);
  await page.waitForFunction((t) => document.body.dataset.tab === t && window.__ghosty?.sheetpages?.[t]?.ready, id, { timeout: 15000 }).catch(() => problems.push(`${id}: the screen did not open`));
  if (pill) await page.locator(`#pg-${id} .secpills .secpill`, { hasText: new RegExp(`^${pill}$`) }).first().click().catch(() => problems.push(`${id}: no "${pill}" pill`));
  await page.waitForSelector(`#pg-${id} .pn:not([hidden]) .pk > *`, { timeout: 8000 }).catch(() => problems.push(`${id}/${pill}: the page was not drawn`));
}
const PK = (id) => `#pg-${id} .pn:not([hidden]) .pk`;
let W = '';
const on = (m) => (W = `#pg-body .pn:not([hidden]) .pk .bt[data-track="${m}"]`);
const txt = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].map((e) => e.textContent ?? '').join(' | '), sel);
const until = (page, fn, arg, ms = 6000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const ringIs = (page, re) => until(page, ([s, r]) => new RegExp(r).test(document.querySelector(`${s} .bt-ringbig`)?.textContent ?? ''), [W, re.source]);
const tap = (page, label) => page.locator(`${W} button[aria-label^="${label}"]`).first().click();
const small = (page, sel) => page.$$eval(`${sel} :is(button, input:not([type=hidden]):not([type=file]), textarea, select, [role=button], summary)`, (els) => els
  .filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]'))
  .map((e) => {
    const r = { width: e.offsetWidth || e.getBoundingClientRect().width, height: e.offsetHeight || e.getBoundingClientRect().height };
    return r.width >= 43.5 && r.height >= 43.5 ? '' : `${e.tagName.toLowerCase()} "${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24)}" ${Math.round(r.width)}×${Math.round(r.height)}`;
  }).filter(Boolean).slice(0, 5));
const sideways = (page, id) => page.evaluate((t) => document.documentElement.scrollWidth > innerWidth + 1 || [...document.querySelectorAll(`#pg-${t} .pn:not([hidden]) *`)].some((e) => { if (!e.getClientRects().length) return false; for (let p = e.parentElement; p; p = p.parentElement) if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX) && p.id !== `pg-${t}`) return false; const r = e.getBoundingClientRect(); return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1); }), id);
async function bar(page, tag, id) {
  // (every fold open, so its keys are measured too)
  await page.evaluate((t) => document.querySelectorAll(`#pg-${t} .pn:not([hidden]) details`).forEach((d) => (d.open = true)), id);
  check(!(await sideways(page, id)), `${tag}: sideways`);
  const s = await small(page, PK(id));
  check(!s.length, `${tag}: under 44 pt: ${s.join(', ')}`);
  const t = await txt(page, `${PK(id)} *`);
  check(!RAW.test(t), `${tag}: a raw string on the page: ${(RAW.exec(t) ?? [''])[0]}`);
}
/** The chat: a line said, the reply's words back (the newest of mine). */
async function say(page, words) {
  const n = await page.locator('#pg-core .log .msg:not(.me)').count();
  await page.fill('#cin', words);
  await page.press('#cin', 'Enter');
  await until(page, (k) => document.querySelectorAll('#pg-core .log .msg:not(.me)').length > k && !/…$/.test([...document.querySelectorAll('#pg-core .log .msg:not(.me)')].pop()?.textContent ?? '…'), n, 10000);
  return page.evaluate(() => [...document.querySelectorAll('#pg-core .log .msg:not(.me)')].pop()?.textContent ?? '');
}

for (const vp of VIEWPORTS) {
  const T = `[${vp.width}]`;
  log(`trackers ${vp.width}`);
  const { ctx, page } = await phone(vp, { seed: seedDays() });
  // my brain cut off for the packs: the trackers must not need it
  await page.route(/\/api\/packs\/do/, (r) => r.abort('failed'));

  // ---- a. WATER (today's drinks at 10:00 on the phone's clock, moved by window.__ghostyClockOffset, so the nudges' hours are known)
  const at = (h) => page.evaluate((hr) => { const d = new Date(); d.setHours(hr, 0, 0, 0); window.__ghostyClockOffset = d.getTime() - Date.now(); }, h);
  await at(10);
  await open(page, 'body', 'Water');
  on('water');
  await page.waitForSelector(`${W} .bt-ringbig`);
  check(/^0 ml$/.test((await txt(page, `${W} .bt-ringbig`)).trim()), `${T} water starts at 0 ml today: "${await txt(page, `${W} .bt-ringbig`)}"`);
  check(/of 2\.25 litres/.test(await txt(page, `${W} .bt-ringsmall`)), `${T} the goal with no weight at 24°C is 2.25 litres: "${await txt(page, `${W} .bt-ringsmall`)}"`);
  const why = await txt(page, `${W} .bt-goalbox`);
  check(/2,000 ml to start/.test(why) && /\+250 ml: up to 24°C today/.test(why) && /first estimate/i.test(why) && /not medical advice/i.test(why), `${T} the goal says how it was worked out, as a first estimate: "${why.slice(0, 200)}"`);
  check((await page.locator(`${W} [data-state="empty"]`).count()) === 1, `${T} nothing drunk yet today is a designed state`);
  check(/3 days in a row/.test(await txt(page, `${W} .bt-streak`)), `${T} the streak counts the three days before, today unmet not breaking it: "${await txt(page, `${W} .bt-streak`)}"`);
  await page.screenshot({ path: `${out}/bodylane-water-empty-${vp.width}.png` });
  for (const [k, re] of [['Add a pint', /^568 ml$/], ['Add a glass', /^818 ml$/], ['Add a mug', /^1\.17 litres$/], ['Add a bottle', /^1\.67 litres$/]]) {
    await tap(page, k);
    check(await ringIs(page, re), `${T} ${k} → ${re}: "${await txt(page, `${W} .bt-ringbig`)}"`);
  }
  check((await page.locator(`${W} [data-state="empty"]`).count()) === 0, `${T} the empty state goes with the first drink`);
  check((await page.locator(`${W} .pkitems li`).count()) === 4, `${T} today's list holds the four drinks`);
  await page.locator(`${W} .pkitems li button`).first().click();
  check(await ringIs(page, /^1\.17 litres$/), `${T} TAKE BACK on the newest drink (the bottle) takes it off: "${await txt(page, `${W} .bt-ringbig`)}"`);
  await page.locator(`${W} button[aria-label="Take back the last drink"]`).click();
  check(await ringIs(page, /^818 ml$/), `${T} UNDO takes back the last: "${await txt(page, `${W} .bt-ringbig`)}"`);
  // his own cup
  await page.evaluate(() => document.querySelectorAll('.bt-goalbox').forEach((d) => (d.open = true)));
  await page.fill(`${W} input[aria-label="Your cup’s name"]`, 'Flask');
  await page.fill(`${W} input[aria-label="Your cup’s size, in ml"]`, '400');
  await page.locator(`${W} button[aria-label="Add your own cup"]`).click();
  check(await until(page, (s) => !!document.querySelector(`${s} button[aria-label^="Add a flask"]`), W), `${T} his own cup becomes a key`);
  await tap(page, 'Add a flask');
  check(await ringIs(page, /^1\.22 litres$/), `${T} his flask adds 400 ml: "${await txt(page, `${W} .bt-ringbig`)}"`);
  // the chart, week and month
  const bars = () => page.locator(`${W} .bt-chart rect.bt-bar`).count();
  check((await bars()) === 4 && (await page.locator(`${W} .bt-chart rect.bt-bar.met`).count()) === 3 && (await page.locator(`${W} .bt-chart line.bt-goal`).count()) === 1, `${T} the week: four days drawn, three met, the goal's line (${await bars()} bars)`);
  check((await page.locator(`${W} .bt-days small`).count()) === 7, `${T} the week has seven days under it`);
  await page.locator(`${W} .bt-hist button`, { hasText: /^Month$/ }).click();
  check(await until(page, (s) => document.querySelectorAll(`${s} .bt-days small`).length === 30 && document.querySelector(`${s} .bt-hist button[aria-pressed="true"]`)?.textContent === 'Month', W), `${T} MONTH draws thirty days, pressed`);
  check(/The last 30 days: .* a day on average/.test(await txt(page, `${W} [data-avg]`)), `${T} the month's average is said: "${await txt(page, `${W} [data-avg]`)}"`);
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.body.track') ?? '{}').log?.water?.length);
  check(kept === 6, `${T} kept in the phone's own storage (3 days before, and today's pint, glass and flask): ${kept}`);
  await page.screenshot({ path: `${out}/bodylane-water-${vp.width}.png` });
  await bar(page, `${T} water`, 'body');

  // ---- b. NUDGES (the phone's clock moved to the hour needed: window.__ghostyClockOffset)
  await page.evaluate((s) => (document.querySelector(`${s} .bt-nudges`).open = true), W);
  await page.locator(`${W} .bt-nudges button[aria-pressed]`).click();
  check(await until(page, (s) => document.querySelector(`${s} .bt-nudges button[aria-pressed]`)?.getAttribute('aria-pressed') === 'true', W), `${T} nudges turn on`);
  await at(20);
  const nudge = await page.evaluate(() => { window.__ghosty.track.nudge.tick(); return window.__ghosty.track.nudge.last; });
  check(nudge === 'behind' && (await until(page, () => [...document.querySelectorAll('.toast, [role=status], [role=alert]')].some((e) => /Time for some water/.test(e.textContent ?? '')))), `${T} behind at 20:00, a nudge is said (${nudge})`);
  await at(12);
  check((await page.evaluate(() => { window.__ghosty.track.nudge.tick(); return window.__ghosty.track.nudge.last; })) === 'on track', `${T} on track at noon (1.22 of 2.25 litres): no nudge`);
  await at(23);
  check((await page.evaluate(() => { window.__ghosty.track.nudge.tick(); return window.__ghosty.track.nudge.last; })) === 'quiet', `${T} never in his quiet hours (23:00)`);
  await at(20);
  await page.evaluate(() => (window.__ghostyClockOffset += 1));
  for (let i = 0; i < 3; i++) await tap(page, 'Add a bottle');
  check((await page.evaluate(() => { window.__ghosty.track.nudge.tick(); return window.__ghosty.track.nudge.last; })) === 'met', `${T} no nudge once the goal is met`);
  check(/goal met/.test(await txt(page, `${W} .bt-line`)) && (await page.locator(`${W} .bt-fill.met`).count()) === 1, `${T} the ring says the goal is met: "${await txt(page, `${W} .bt-line`)}"`);
  check(/4 days in a row/.test(await txt(page, `${W} .bt-streak`)), `${T} today met joins the run: "${await txt(page, `${W} .bt-streak`)}"`);
  await page.evaluate(() => (window.__ghostyClockOffset = 0));

  // ---- c. SLEEP, STEPS, WEIGHT, MOOD
  await open(page, 'body', 'Sleep');
  on('sleep');
  check((await page.locator(`${W} [data-state="empty"]`).count()) === 1, `${T} sleep: none kept is a designed state`);
  await tap(page, 'Going to bed');
  check(await until(page, (s) => !!document.querySelector(`${s} [data-bed]`), W), `${T} GOING TO BED says the time`);
  await page.evaluate(() => (window.__ghostyClockOffset = 7.5 * 3600e3));
  await tap(page, 'I’m up');
  check(await ringIs(page, /^7 h 30 min$/), `${T} I'M UP 7 h 30 min later keeps it: "${await txt(page, `${W} .bt-ringbig`)}"`);
  check(/7 h 30 min last night, 30 min under your 8 h goal/.test(await txt(page, `${W} .bt-line`)), `${T} sleep says it against the goal: "${await txt(page, `${W} .bt-line`)}"`);
  await page.evaluate(() => (window.__ghostyClockOffset = 0));
  await bar(page, `${T} sleep`, 'body');
  await open(page, 'body', 'Steps');
  on('steps');
  await tap(page, 'Add 5,000 steps');
  await tap(page, 'Add 5,000 steps');
  check((await ringIs(page, /^10,000$/)) && (await page.locator(`${W} .bt-fill.met`).count()) === 1, `${T} steps: 10,000 meets the 8,000 goal: "${await txt(page, `${W} .bt-ringbig`)}"`);
  await bar(page, `${T} steps`, 'body');
  await open(page, 'body', 'Weight');
  on('weight');
  await page.fill(`${W} input[aria-label^="Your weight"]`, '13 st 4');
  await tap(page, 'Keep this weight');
  check(await ringIs(page, /^84\.4 kg$/), `${T} "13 st 4" kept as 84.4 kg: "${await txt(page, `${W} .bt-ringbig`)}"`);
  await page.evaluate(() => document.querySelectorAll('.bt-goalbox').forEach((d) => (d.open = true)));
  await page.fill(`${W} input[aria-label="Your height, in cm"]`, '180');
  await page.locator(`${W} button[aria-label="Set your height, in cm"]`).click();
  check(await until(page, (s) => /BMI about 26, over the healthy range[\s\S]*first estimate/i.test(document.querySelector(`${s} [data-bmi]`)?.textContent ?? ''), W), `${T} BMI as a first estimate from his height: "${await txt(page, `${W} [data-bmi]`)}"`);
  await bar(page, `${T} weight`, 'body');
  await open(page, 'body', 'Mood');
  on('mood');
  await page.locator(`${W} .bt-moods button`, { hasText: /^Good$/ }).click();
  check(await until(page, (s) => document.querySelector(`${s} .bt-moods button[aria-pressed="true"]`)?.textContent === 'Good' && /Today: Good/.test(document.querySelector(`${s} .bt-line`)?.textContent ?? ''), W), `${T} mood: one tap, pressed and said`);
  await bar(page, `${T} mood`, 'body');
  // the water goal from his body now: 84.4 kg × 33 ml, +250 ml at 24°C, +350 ml for 10,000 steps = 3,385, to 3.4 litres
  await open(page, 'body', 'Water');
  on('water');
  check(/of 3\.4 litres/.test(await txt(page, `${W} .bt-ringsmall`)) && /84 kg × 33 ml = 2\.8 litres/.test(await txt(page, `${W} .bt-goalbox`)) && /\+350 ml: 10,000 steps today/.test(await txt(page, `${W} .bt-goalbox`)), `${T} the water goal is worked out from his weight: "${await txt(page, `${W} .bt-ringsmall`)}"`);
  // offline: everything works, the heat waits, said in his words
  await page.evaluate(() => { window.__off = true; delete window.__ghostyHeat; });
  await page.locator(`${W} .bt-hist button`, { hasText: /^Week$/ }).click();
  check(await until(page, (s) => /No signal: everything here works on the phone/.test(document.querySelector(`${s} [data-state="offline"]`)?.textContent ?? ''), W), `${T} water offline says so in his words`);
  await page.evaluate(() => { window.__off = false; window.__ghostyHeat = 24; });

  // ---- e. THE HOME CARD
  // (the card's line is the top of its screen and its live line in Every screen: shell/cardline.ts, ui/sheetpage.ts)
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(300);
  await open(page, 'body', 'Water');
  on('water');
  const topOk = await until(page, () => /Water \d[\d.,]* (ml|litres?) of 3\.4 litres/.test(document.querySelector('#pg-body')?.textContent ?? ''), null, 6000);
  check(topOk, `${T} the Body card says today's water: "${(await txt(page, '#pg-body')).slice(0, 160)}"`);

  // ---- d. THE CHAT
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(400);
  if (!(await page.evaluate(() => !!document.querySelector('.hud.core.logopen')))) await page.locator('.logbtn:visible').first().click().catch(() => undefined);
  await page.waitForSelector('#cin', { state: 'visible', timeout: 8000 }).catch(() => problems.push(`${T} the chat's box did not open`));
  const before = await page.evaluate(() => window.__ghosty.track.data().log.water.length);
  for (const [w, re] of [
    ['I drank a pint', /568 ml kept\./],
    ['log a glass of water', /250 ml kept\./],
    ['how much have I drunk?', /litres today|to go/],
    ['I slept 7 and a half hours', /7 h 30 min of sleep kept/],
    ['walked 6,000 steps', /6,000 steps kept/],
    ['how many steps today?', /16,000 steps today/],
    ['what do I weigh?', /84\.4 kg \(13 st 4 lb\)[\s\S]*first estimate/],
    ['my mood is great', /Mood kept: Great/],
  ]) {
    const r = await say(page, w);
    check(re.test(r) && !RAW.test(r), `${T} the chat: "${w}" → "${r.slice(0, 140)}"`);
  }
  check((await page.evaluate(() => window.__ghosty.track.data().log.water.length)) === before + 2, `${T} the chat's drinks are kept on the phone`);
  const agenda = await say(page, 'remind me to drink water at 5');
  check(!/water nudges on|kept\./i.test(agenda), `${T} "remind me to drink water at 5" is the agenda's, not the trackers': "${agenda.slice(0, 120)}"`);
  // the pantry by chat
  const f1 = await say(page, 'add milk and eggs to the fridge');
  check(/In the fridge: milk, eggs\./.test(f1), `${T} the chat: "add milk and eggs to the fridge" → "${f1.slice(-80)}"`);
  const f2 = await say(page, 'what’s in my fridge?');
  check(/In the fridge: milk, eggs\./.test(f2), `${T} the chat: "what’s in my fridge?" → "${f2.slice(-80)}"`);

  // ---- g. THE PANTRY AND THE RECIPE BOOK (kept on the phone)
  await open(page, 'kitchen', 'Pantry');
  const PN = '#pg-kitchen .pn:not([hidden]) [data-larder="pantry"]';
  check((await page.locator(`${PN} li[data-item]`).count()) === 2, `${T} the pantry holds what the chat put in`);
  await page.fill(`${PN} input[aria-label="What to add to the pantry"]`, 'chicken');
  await page.selectOption(`${PN} select[aria-label="Where it goes"]`, 'fridge');
  await page.evaluate((s) => { const i = document.querySelector(`${s} input[type=date]`); const d = new Date(); i.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }, PN);
  await page.locator(`${PN} button[aria-label="Add to the pantry"]`).click();
  check(await until(page, (s) => /chicken · use today/.test(document.querySelector(`${s} .kl-soon`)?.textContent ?? ''), PN), `${T} a thing with today's date is under USE SOON: "${await txt(page, `${PN} .kl-soon`)}"`);
  await page.locator(`${PN} button[aria-label="eggs: used up"]`).click();
  check(await until(page, (s) => document.querySelectorAll(`${s} li[data-item]`).length === 2 && !!document.querySelector(`${s} button`)?.parentElement && [...document.querySelectorAll(`${s} button`)].some((b) => b.textContent === 'Add eggs to shopping'), PN), `${T} USED UP takes it off and offers the shopping list`);
  await bar(page, `${T} pantry`, 'kitchen');
  await open(page, 'kitchen', 'Recipes');
  const RC = '#pg-kitchen .pn:not([hidden]) [data-larder="recipes"]';
  check((await page.locator(`${RC} [data-state="empty"]`).count()) === 1, `${T} recipes: none of his own yet is a designed state`);
  await page.evaluate((s) => (document.querySelector(`${s} .kl-add`).open = true), RC);
  await page.fill(`${RC} input[aria-label="The recipe’s name"]`, 'Tony’s pasta');
  await page.fill(`${RC} input[aria-label="How many it serves"]`, '2');
  await page.fill(`${RC} textarea[aria-label="Its things, one a line"]`, '200 g pasta\n2 eggs\n1 chicken breast');
  await page.fill(`${RC} textarea[aria-label="Its steps, one a line"]`, 'Boil the pasta for 10 minutes.\nFry the chicken 6 minutes.\nStir in the eggs off the heat.');
  await page.locator(`${RC} button`, { hasText: /^Keep the recipe$/ }).click();
  check(await until(page, (s) => /Tony’s pasta/.test(document.querySelector(`${s} .kl-book li`)?.textContent ?? ''), RC), `${T} his recipe is kept, first in the book`);
  await page.locator(`${RC} button[aria-label="Open Tony’s pasta"]`).click();
  await page.locator(`${RC} button[aria-label="More people"]`).click();
  check(await until(page, (s) => /300 g pasta/.test(document.querySelector(s)?.textContent ?? '') && /3 eggs/.test(document.querySelector(s)?.textContent ?? '') && document.querySelector(`${s} [data-serves]`)?.dataset.serves === '3', RC), `${T} SERVES 3 scales his amounts: "${(await txt(page, `${RC} .pkitems`)).slice(0, 100)}"`);
  check(/chicken breast · in the pantry/.test(await txt(page, RC)), `${T} what the pantry has is marked`);
  await page.locator(`${RC} button`, { hasText: /^Cook it, step by step$/ }).click();
  check(await until(page, (s) => document.querySelector(`${s} [data-step]`)?.dataset.step === '1', RC), `${T} cook mode opens on step 1`);
  const n0 = await page.evaluate(() => window.__ghosty.timers().length);
  await page.locator(`${RC} button[aria-label="Start a 10 minute timer"]`).click();
  check(await until(page, (k) => window.__ghosty.timers().length === k + 1, n0), `${T} a step's minutes start a kitchen timer`);
  await page.locator(`${RC} button`, { hasText: /^Next step$/ }).click();
  check(await until(page, (s) => document.querySelector(`${s} [data-step]`)?.dataset.step === '2', RC), `${T} NEXT STEP`);
  await bar(page, `${T} recipes`, 'kitchen');
  await page.evaluate(() => window.__ghosty.timers().forEach(() => undefined));
  await ctx.close();

  // ---- f. every pill of the lane
  log(`every pill ${vp.width}`);
  const p2 = await phone(vp);
  for (const [id, pills] of [['body', ['Reps', 'Run', 'Breathe', 'Stretch', 'Health', 'Water', 'Sleep', 'Steps', 'Weight', 'Mood']], ['kitchen', ['Timers', 'Shopping', 'Meal plan']], ['outside', ['Walk', 'Nearby', 'My car', 'Lost', 'Split']]]) {
    for (const pill of pills) {
      await open(p2.page, id, pill);
      await p2.page.waitForTimeout(300);
      await bar(p2.page, `${T} ${id}/${pill}`, id);
    }
  }
  await p2.ctx.close();
}

// ---- the biggest text (BODY 21) and the seven looks, at 390 (the narrower)
log('body 21 and the seven looks');
{
  const { ctx, page } = await phone(VIEWPORTS[1], { body: 21, seed: seedDays() });
  for (const pill of ['Water', 'Sleep', 'Steps', 'Weight', 'Mood']) {
    await open(page, 'body', pill);
    await page.evaluate(() => document.querySelectorAll('#pg-body .pn:not([hidden]) details').forEach((d) => (d.open = true)));
    const r = await page.evaluate(() => {
      const bad = [];
      for (const e of document.querySelectorAll('#pg-body .pn:not([hidden]) .pk *')) {
        if (!e.getClientRects().length || !(e.textContent ?? '').trim() || e.closest('canvas,select,textarea,input,pre')) continue;
        const cs = getComputedStyle(e);
        if (cs.overflowX !== 'visible' && e.scrollWidth > e.clientWidth + 1) bad.push(`cut "${(e.textContent ?? '').trim().slice(0, 20)}"`);
        const b = e.getBoundingClientRect();
        if (b.width > 2 && (b.right > innerWidth + 1 || b.left < -1)) bad.push(`outside "${(e.textContent ?? '').trim().slice(0, 20)}"`);
      }
      return { body: document.documentElement.dataset.body, bad: bad.slice(0, 3), side: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    check(r.body === '21' && !r.bad.length && !r.side, `[body21] ${pill} clips or sticks out at the biggest text (body ${r.body}): ${r.bad.join(' | ')}`);
  }
  await ctx.close();
}
for (const world of ['scan', 'map', 'eye', 'orbit', 'grown', 'ink', 'glass']) {
  const { ctx, page } = await phone(VIEWPORTS[1], { world, seed: seedDays() });
  await open(page, 'body', 'Water');
  on('water');
  await page.waitForSelector(`${W} .bt-ringbig`).catch(() => undefined);
  const r = await page.evaluate((s) => {
    const fill = document.querySelector(`${s} .bt-fill`);
    const bar = document.querySelector(`${s} .bt-bar.met`);
    const line = document.querySelector(`${s} .bt-line`);
    const ink = (e, p) => (e ? getComputedStyle(e)[p] : '');
    return { world: document.documentElement.dataset.world, stroke: ink(fill, 'stroke'), bar: ink(bar, 'fill'), color: ink(line, 'color'), bg: getComputedStyle(document.body).backgroundColor };
  }, W);
  check(r.world === world && r.stroke && r.stroke !== 'none' && r.bar && r.bar !== 'none' && r.bar !== 'rgb(0, 0, 0)' && r.color && r.color !== r.bg, `[look ${world}] the water screen draws in the look's tokens: ${JSON.stringify(r)}`);
  check(!(await sideways(page, 'body')), `[look ${world}] sideways`);
  const s = await small(page, PK('body'));
  check(!s.length, `[look ${world}] under 44 pt: ${s.join(', ')}`);
  await page.screenshot({ path: `${out}/bodylane-look-${world}.png` });
  await ctx.close();
}

await browser.close();
console.log(`(bodylane spec: ${((Date.now() - t0) / 1000).toFixed(1)} s, ${checks} checks)`);
if (problems.length) {
  console.log(`PROBLEMS (${problems.length}):\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('BODY LANE run clean: the five trackers whole at 440 and 390, kept on the phone with my brain cut, said in many wordings in the chat, every pill of BODY, KITCHEN and OUTSIDE at 44 pt with nothing sideways, BODY 21 cutting nothing, and the water screen whole in all seven looks.');
