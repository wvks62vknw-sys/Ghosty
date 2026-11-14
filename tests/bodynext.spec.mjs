// THE BODY LANE, NEXT ROUND (docs/build-plan/NEXT-BODY.md): kitchen and body as one coach, at 440 × 956 and 390 × 844, against the
// preview's real brain (no model needed):
//   a. THE MEAL PLAN WRITES THE SHOPPING LIST (body.u10): his pantry (pasta, cheese) and the plan (Tuna pasta bake on Monday, a dinner
//      not in the book on Tuesday); SHOPPING FOR THE WEEK puts the missing things on the list (tuna, sweetcorn, chopped tomatoes), never
//      what the pantry has, and names the unknown dinner; FILL THE EMPTY DAYS plans the other days from the book, none twice;
//   b. TABLETS (body.s1): a tablet kept with two times; TAKEN and SKIPPED tick, the packet counts down and the refill line moves; the
//      lock-screen reminders go to the brain as daily reminders with the time and a plain line only (never the name, never a tick);
//   c. WATER ON THE LOCK SCREEN (body.u1): nudges on, the brain gets only the next nudge times and "Time for a glass of water." (no
//      amount); a drink logged sends a fresh set and takes back the old;
//   d. STEPS FROM HEALTH: "#body?steps=8421" keeps today's steps and opens Move; a second evening number replaces the first;
//   e. THE CHAT, many wordings, on the phone with no model: "shopping for the week", "plan my dinners", "I took my tablets",
//      "did I take my tablets?", "open my tablets";
//   f. every new room: nothing sideways, every control 44 pt, no raw browser string; offline said in his words.
//   BASE=http://localhost:8788 node tests/bodynext.spec.mjs [outDir]
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
    console.log(`  red: ${msg.slice(0, 260)}`);
  }
};
const log = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s · ${s}`);
const RAW = /aborted|fetch failed|undefined|NaN|\[object Object\]|TypeError|NetworkError|Failed to|Load failed|HTTP \d/i;
const VIEWPORTS = [{ width: 440, height: 956 }, { width: 390, height: 844 }];
await standDown(base, KEY);
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined });
const brainDo = (pack, action, args) => fetch(`${base}/api/packs/do`, { method: 'POST', headers: { 'x-ghosty': '1', 'x-ghosty-key': KEY, 'content-type': 'application/json' }, body: JSON.stringify({ pack, action, args }) }).then((r) => r.json());
const jobs = () => fetch(`${base}/api/agenda?days=2&tz=Europe%2FLondon`, { headers: { 'x-ghosty': '1', 'x-ghosty-key': KEY } }).then((r) => r.json()).then((j) => j.jobs ?? []);

// the day anchored to London's midnight in his own time (a run between 00:00 and 01:00 still passes)
const ymd = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

async function phone(viewport, o = {}) {
  const ctx = await browser.newContext({ viewport, screen: viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ...UK });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${viewport.width}] pageerror: ${e.message}`));
  await page.addInitScript(({ key, world, larder }) => {
    if (!sessionStorage.getItem('bn.seeded')) {
      localStorage.setItem('ghosty.ownerKey', key);
      localStorage.setItem('ghosty.themes1', '1');
      localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Tony', speak: false, sounds: false, theme: 'reactor', favourites: [], look: { ground: 'graphite', world, night: 'graphite', switches: {} }, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
      if (larder) localStorage.setItem('ghosty.kitchen.larder', JSON.stringify(larder));
      sessionStorage.setItem('bn.seeded', '1');
    }
    window.__ghostyHero = true;
    window.__ghostyPlace = { none: true };
    window.__ghostyHeat = 18;
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => window.__off !== true });
  }, { key: KEY, world: o.world ?? 'scan', larder: o.larder ?? null });
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
const until = (page, fn, arg, ms = 8000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const txt = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].map((e) => e.textContent ?? '').join(' | '), sel);
const small = (page, sel) => page.$$eval(`${sel} :is(button, input:not([type=hidden]):not([type=file]), textarea, select, [role=button], summary)`, (els) => els
  .filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]'))
  .map((e) => {
    const r = { width: e.offsetWidth || e.getBoundingClientRect().width, height: e.offsetHeight || e.getBoundingClientRect().height };
    return r.width >= 43.5 && r.height >= 43.5 ? '' : `${e.tagName.toLowerCase()} "${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24)}" ${Math.round(r.width)}×${Math.round(r.height)}`;
  }).filter(Boolean).slice(0, 5));
const sideways = (page, id) => page.evaluate((t) => document.documentElement.scrollWidth > innerWidth + 1 || [...document.querySelectorAll(`#pg-${t} .pn:not([hidden]) *`)].some((e) => { if (!e.getClientRects().length) return false; for (let p = e.parentElement; p; p = p.parentElement) if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX) && p.id !== `pg-${t}`) return false; const r = e.getBoundingClientRect(); return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1); }), id);
async function bar(page, tag, id) {
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined)))).catch(() => undefined);
  await page.evaluate((t) => document.querySelectorAll(`#pg-${t} .pn:not([hidden]) details`).forEach((d) => (d.open = true)), id);
  check(!(await sideways(page, id)), `${tag}: sideways`);
  const s = await small(page, PK(id));
  check(!s.length, `${tag}: under 44 pt: ${s.join(', ')}`);
  const t = await txt(page, `${PK(id)} *`);
  check(!RAW.test(t), `${tag}: a raw string on the page: ${(RAW.exec(t) ?? [''])[0]}`);
}
/** Say `words` in the chat and wait for the first reply after his own message (found by its data-at) that matches `re`. */
async function ask(page, words, re = /\S/, ms = 15000) {
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForSelector('#cin', { state: 'visible', timeout: 15000 });
  const at = await page.evaluate(() => Date.now());
  await page.fill('#cin', words);
  await page.keyboard.press('Enter');
  const find = ({ at, src, flags, any }) => {
    const rx = new RegExp(src, flags);
    const msgs = [...document.querySelectorAll('#pg-core .msg')];
    const mine = msgs.map((m) => m.classList.contains('me') && Number(m.dataset.at ?? 0) >= at).lastIndexOf(true);
    if (mine < 0) return null;
    const replies = msgs.slice(mine + 1).filter((m) => !m.classList.contains('me'));
    const r = any ? replies.at(-1) : replies.find((m) => rx.test(m.textContent ?? ''));
    return r ? r.textContent ?? '' : null;
  };
  const arg = { at, src: re.source, flags: re.flags, any: false };
  const got = await page.waitForFunction(find, arg, { timeout: ms }).then((h) => h.jsonValue(), () => null);
  if (got) return { ok: true, text: got };
  return { ok: false, text: (await page.evaluate(find, { ...arg, any: true }).catch(() => '')) ?? '' };
}

for (const vp of VIEWPORTS) {
  const T = `[${vp.width}]`;
  // the brain's kitchen starts empty for each size (the preview's brain is shared)
  await brainDo('kitchen', 'plan', { days: ['', '', '', '', '', '', ''] });
  await brainDo('kitchen', 'shop', { words: 'clear' });
  for (const j of await jobs()) if (j.kind === 'reminder' && /^(?:Water|Tablets)$/.test(j.title)) await fetch(`${base}/api/jobs/${j.id}`, { method: 'DELETE', headers: { 'x-ghosty': '1', 'x-ghosty-key': KEY } });
  const larder = { v: 1, items: [{ id: 'a', name: 'pasta', where: 'cupboard', useBy: '', added: 1 }, { id: 'b', name: 'cheese', where: 'fridge', useBy: '', added: 1 }], recipes: [] };
  const { ctx, page } = await phone(vp, { larder });

  // ---- a. THE MEAL PLAN WRITES THE SHOPPING LIST
  log(`meal plan ${vp.width}`);
  await open(page, 'kitchen', 'Meal plan');
  const P = PK('kitchen');
  await page.waitForFunction((s) => document.querySelector(`${s} input[aria-label="Mon’s dinner"]`) && !document.querySelector(`${s} .sheetwait, ${s} [data-state="loading"]`), P, { timeout: 10000 }).catch(() => undefined);
  check((await page.locator(`${P} datalist option`).count()) >= 12, `${T} each day suggests the recipe book's names (${await page.locator(`${P} datalist option`).count()})`);
  await page.locator(`${P} button[aria-label="Put what the week needs on the shopping list"]`).click();
  check(await until(page, (s) => !!document.querySelector(`${s} [data-weekshop] [data-state="empty"]`), P), `${T} with nothing planned, the week's shopping says so in his words`);
  await page.fill(`${P} input[aria-label="Mon’s dinner"]`, 'Tuna pasta bake');
  await page.fill(`${P} input[aria-label="Tue’s dinner"]`, 'Gran’s stew');
  await page.locator(`${P} button`, { hasText: /^Save the week$/ }).click();
  check(await until(page, (s) => /Saved: 2 dinners kept/.test(document.querySelector(`${s}`)?.textContent ?? ''), P), `${T} the week saves`);
  await page.locator(`${P} button[aria-label="Put what the week needs on the shopping list"]`).click();
  check(await until(page, (s) => /^On the shopping list for 1 dinner/.test(document.querySelector(`${s} [data-added]`)?.textContent ?? ''), P, 10000), `${T} SHOPPING FOR THE WEEK puts the missing things on the list: "${await txt(page, `${P} [data-weekshop]`)}"`);
  const shop = await brainDo('kitchen', 'shop', { words: '' });
  const names = (shop.data?.list ?? []).map((x) => x.text.toLowerCase());
  check(['tuna', 'sweetcorn', 'chopped tomatoes'].every((n) => names.includes(n)) && !names.includes('pasta') && !names.includes('cheese'), `${T} the list has what's missing, never what the pantry has: ${names.join(', ')}`);
  check(/Already in your pantry: .*pasta/.test(await txt(page, `${P} [data-have]`)) && /Gran’s stew/.test(await txt(page, `${P} [data-unknown]`)), `${T} it says what the pantry has and the dinner not in the book`);
  await page.locator(`${P} button[aria-label="Fill the empty days from my recipe book"]`).click();
  check(await until(page, (s) => /5 empty days filled/.test(document.querySelector(s)?.textContent ?? ''), P, 10000), `${T} FILL THE EMPTY DAYS fills the other five: "${await txt(page, `${P} [aria-live]`)}"`);
  const plan = (await brainDo('kitchen', 'plan', { words: '' })).data?.plan?.days ?? [];
  check(plan.filter(Boolean).length === 7 && new Set(plan).size === 7 && plan[0] === 'Tuna pasta bake' && plan[1] === 'Gran’s stew', `${T} the week: seven dinners, none twice, his own two kept: ${plan.join(' / ')}`);
  await page.screenshot({ path: `${out}/bodynext-plan-${vp.width}.png` });
  await bar(page, `${T} meal plan`, 'kitchen');

  // ---- b. TABLETS
  log(`tablets ${vp.width}`);
  const at = (h, m = 0) => page.evaluate(([hr, mi]) => { const d = new Date(); d.setHours(hr, mi, 0, 0); window.__ghostyClockOffset = d.getTime() - Date.now(); }, [h, m]);
  await at(9);
  await open(page, 'body', 'Health');
  const M = `${PK('body')} .bt[data-track="meds"]`;
  await page.waitForSelector(M);
  check((await page.locator(`${M} [data-state="empty"]`).count()) === 1, `${T} no tablets yet is a designed state`);
  await page.evaluate((s) => (document.querySelector(`${s} .bm-add`).open = true), M);
  await page.fill(`${M} input[aria-label="The tablet’s name"]`, 'Vitamin D');
  await page.fill(`${M} input[aria-label="The dose"]`, '1 tablet');
  await page.fill(`${M} input[aria-label="Its times of day"]`, '8am, 8pm');
  await page.fill(`${M} input[aria-label="How many you have"]`, '10');
  await page.locator(`${M} button[aria-label="Keep this tablet"]`).click();
  check(await until(page, (s) => document.querySelectorAll(`${s} .bm-dose`).length === 2, M), `${T} the tablet's two doses show for today`);
  check(/Vitamin D · refill soon, about 5 days left/.test(await txt(page, `${M} .bm-med summary`)), `${T} the refill countdown: 10 at two a day is about 5 days: "${await txt(page, `${M} .bm-med summary`)}"`);
  check(await until(page, () => (window.__ghosty?.lockpush?.sent ?? []).filter((x) => x.key.startsWith('meds:')).length === 2, null, 10000), `${T} two daily lock-screen reminders went to the brain`);
  const sent = await page.evaluate(() => window.__ghosty.lockpush.sent.filter((x) => x.key.startsWith('meds:')));
  check(sent.every((x) => x.repeat === 'daily' && x.title === 'Tablets' && !/vitamin/i.test(x.text)) && sent.map((x) => new Date(x.at).getHours()).sort((a, b) => a - b).join(',') === '8,20', `${T} each is the time and a plain line, never the name: ${JSON.stringify(sent.map((x) => [new Date(x.at).getHours(), x.text]))}`);
  const onBrain = (await jobs()).filter((j) => j.title === 'Tablets');
  check(onBrain.length === 2 && onBrain.every((j) => j.repeat === 'daily' && !/vitamin/i.test(j.text)), `${T} the brain holds two daily reminders with no name: ${JSON.stringify(onBrain.map((j) => [j.repeat, j.text]))}`);
  await page.locator(`${M} button[aria-label="Vitamin D at 08:00: taken"]`).click();
  check(await until(page, (s) => document.querySelector(`${s} [data-dose="Vitamin D@08:00"]`)?.dataset.tick === 'taken', M), `${T} TAKEN ticks the morning dose`);
  check(/about 4 days left/.test(await txt(page, `${M} .bm-med summary`)), `${T} the packet counts down: "${await txt(page, `${M} .bm-med summary`)}"`);
  await page.locator(`${M} button[aria-label="Vitamin D at 20:00: skipped"]`).click();
  check(await until(page, (s) => document.querySelector(`${s} [data-dose="Vitamin D@20:00"]`)?.dataset.tick === 'skipped', M), `${T} SKIPPED ticks the evening dose`);
  check(/Every dose ticked today/.test(await txt(page, `${M} [data-line]`)), `${T} today's line: "${await txt(page, `${M} [data-line]`)}"`);
  check(/The last 7 days: 1 of 1 doses ticked taken/.test(await txt(page, `${M} [data-week]`)), `${T} the week counts only the doses due since it was added (at 09:00, the morning one): "${await txt(page, `${M} [data-week]`)}"`);
  check(!(await page.evaluate(() => window.__ghosty.lockpush.sent.some((x) => /taken|skipped/i.test(x.text)))), `${T} a tick never goes to the brain`);
  await page.screenshot({ path: `${out}/bodynext-meds-${vp.width}.png` });
  await bar(page, `${T} tablets`, 'body');
  await page.evaluate(() => (window.__ghostyClockOffset = 0));

  // ---- c. WATER ON THE LOCK SCREEN
  log(`water lock ${vp.width}`);
  await at(10);
  await open(page, 'body', 'Water');
  const W = `${PK('body')} .bt[data-track="water"]`;
  await page.waitForSelector(`${W} .bt-nudges`);
  await page.evaluate((s) => (document.querySelector(`${s} .bt-nudges`).open = true), W);
  await page.locator(`${W} .bt-nudges button[aria-pressed]`).first().click();
  check(await until(page, () => (window.__ghosty?.lockpush?.sent ?? []).some((x) => x.key === 'water'), null, 10000), `${T} nudges on: the next nudge times go to the brain`);
  const water = await page.evaluate(() => window.__ghosty.lockpush.sent.filter((x) => x.key === 'water'));
  check(water.length >= 1 && water.length <= 6 && water.every((x) => x.text === 'Time for a glass of water.' && x.repeat === 'none' && !/\d+\s*ml|litre/i.test(x.text)), `${T} only times and a plain line, no amount: ${JSON.stringify(water.map((x) => x.text))}`);
  check(water.every((x) => { const h = new Date(x.at).getHours(); return h >= 9 && h < 21; }), `${T} every time inside his nudge hours: ${water.map((x) => new Date(x.at).toTimeString().slice(0, 5)).join(', ')}`);
  const n0 = await page.evaluate(() => window.__ghosty.lockpush.gone.length);
  await page.locator(`${W} button[aria-label^="Add a pint"]`).click();
  check(await until(page, (n) => window.__ghosty.lockpush.gone.length > n, n0, 10000), `${T} a drink logged takes the old times back and sends fresh ones`);
  check(/with my brain, from \d\d:\d\d: only the times, never your amounts/.test(await txt(page, `${W} [data-lock]`)) || /No nudge needed/.test(await txt(page, `${W} [data-lock]`)), `${T} the screen says what the brain holds: "${await txt(page, `${W} [data-lock]`)}"`);
  await page.evaluate(() => (window.__ghostyClockOffset = 0));

  // ---- d. STEPS FROM HEALTH (the evening Shortcut)
  log(`steps ${vp.width}`);
  await page.evaluate(() => (location.hash = 'body?steps=8421'));
  check(await until(page, () => (window.__ghosty?.track?.data().log.steps ?? []).filter((e) => e.from === 'health').reduce((a, e) => a + e.v, 0) === 8421, null, 10000), `${T} "#body?steps=8421" keeps today's steps from Health`);
  await page.evaluate(() => (location.hash = 'body?steps=9012'));
  check(await until(page, () => (window.__ghosty?.track?.data().log.steps ?? []).filter((e) => e.from === 'health' && e.d === window.__ghosty.track.data().log.steps.at(-1).d).reduce((a, e) => a + e.v, 0) === 9012, null, 10000), `${T} a later number replaces the first, never adds to it`);
  check(await until(page, () => document.querySelector('#pg-body .pn:not([hidden]) .bt[data-track="steps"]') !== null, null, 8000), `${T} it opens on Move with the steps`);
  await page.evaluate(() => document.querySelectorAll('#pg-body .bt-shortcut').forEach((d) => (d.open = true)));
  check(/body\?steps=/.test(await txt(page, '#pg-body .pn:not([hidden]) .bt-link')), `${T} the Shortcut's link is shown to copy`);
  await bar(page, `${T} steps`, 'body');

  // ---- e. THE CHAT
  log(`chat ${vp.width}`);
  if (vp.width === 440) {
    await brainDo('kitchen', 'shop', { words: 'clear' });
    let r = await ask(page, 'shopping for the week', /On the shopping list for|pantry has everything/);
    check(r.ok, `${T} "shopping for the week": "${r.text.slice(0, 160)}"`);
    r = await ask(page, 'plan my dinners', /Every day of the week already has a dinner|Planned from your recipe book/);
    check(r.ok, `${T} "plan my dinners": "${r.text.slice(0, 160)}"`);
    r = await ask(page, 'did I take my tablets?', /08:00 Vitamin D: taken; 20:00 Vitamin D: skipped/);
    check(r.ok, `${T} "did I take my tablets?": "${r.text.slice(0, 160)}"`);
    r = await ask(page, 'open my tablets', /Your tablets are open/);
    check(r.ok, `${T} "open my tablets": "${r.text.slice(0, 160)}"`);
  }
  await ctx.close();
}

// ---- f. offline: the tablets and the meal plan say it in his words
{
  log('offline');
  const { ctx, page } = await phone(VIEWPORTS[1]);
  await page.evaluate(() => (window.__off = true));
  await open(page, 'body', 'Health');
  check(/No signal: ticking works on the phone/.test(await txt(page, `${PK('body')} .bt[data-track="meds"] [data-state="offline"]`)), 'tablets offline says so in his words');
  await open(page, 'kitchen', 'Meal plan');
  check(await until(page, (s) => /No signal\. The week is kept in my brain/.test(document.querySelector(s)?.textContent ?? ''), PK('kitchen')), 'the meal plan offline says so in his words');
  await ctx.close();
}

await browser.close();
console.log(`\n${checks} checks, ${problems.length} red, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
if (problems.length) {
  for (const p of problems) console.log(` - ${p}`);
  process.exit(1);
}
