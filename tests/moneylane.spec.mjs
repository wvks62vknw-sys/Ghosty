// THE MONEY LANE (FINAL ROUND, 13 November): the MONEY screen as a budgeting app of its own (features/money/app.ts), PEOPLE's COMING UP
// (features/people/sheet.ts) and HOME's bins, against the preview's real brain (no model). At 440 × 956 and 390 × 844:
//
//   MONTH    out, in and left over equal the brain's own sums to the penny, each with the line that says how it was worked out; the pace;
//            each category with its share; where it went most; a payment found by a word; a tap files it and the brain keeps it; the
//            month arrows say why one cannot be pressed.
//   BUDGETS  a budget's bar and what is left; one set and one taken away from the screen, in his words; an empty amount says what to do.
//   BILLS    the subscriptions found in his statements and a bill he showed HOME, in date order; a price that went up said with both prices.
//   TRENDS   each month he gave me, the average, the dearest and the cheapest; one category picked across them.
//   STATES   each page empty (with the way to a statement), waiting, failed (in his words, with a TRY AGAIN) and offline.
//   THE BAR  every key 44 pt, nothing sideways, no raw string; at BODY 21 nothing cut or outside; the seven looks at 440.
//   WORDS    "my budgets" in the chat opens BUDGETS; "birthdays coming" opens COMING UP.
//   PEOPLE   COMING UP lists a kept birthday and keeps a new one; YOUR PEOPLE finds by a word and forgets on his say, asked once more.
//   HOME     "A collection moved" with nothing typed asks where to, and keeps no made-up day.
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, standDown } from './nav.mjs';
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
  return ok;
};
const log = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s · ${s}`);
async function block(name, fn) {
  try {
    await fn();
  } catch (e) {
    problems.push(`${name}: the check stopped: ${String(e.message ?? e).split('\n')[0].slice(0, 200)}`);
  }
}
await standDown(base, KEY);
const H = { 'x-ghosty': '1', 'x-ghosty-key': KEY, 'content-type': 'application/json' };
const api = (path, body, method) => fetch(`${base}/api${path}`, { method: method ?? (body ? 'POST' : 'GET'), headers: H, ...(body ? { body: JSON.stringify(body) } : {}) }).then((r) => r.json()).catch(() => ({}));
const pk = (packName, action, args = {}) => api('/packs/do', { pack: packName, action, args });
const RAW = /aborted|fetch failed|undefined|\[object Object\]|TypeError|NetworkError|Failed to|Load failed|HTTP \d|NaN/i;
const pounds = (n) => `£${Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

// three months of a statement: this month and the two before, each on its 1st and 2nd (so "this month" always has rows)
const ym = (k) => {
  const d = new Date();
  const t = new Date(d.getFullYear(), d.getMonth() - k, 1);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
};
const M = [ym(2), ym(1), ym(0)];
const CSV = ['Date,Description,Amount', ...M.flatMap((m, i) => [
  `${m}-01,SPOTIFY,-11.99`,
  `${m}-02,NETFLIX.COM,${i === 2 ? '-12.99' : '-10.99'}`,
  `${m}-01,TESCO STORES,-${(42.1 + i * 10).toFixed(2)}`,
  `${m}-02,GREGGS,-${['3.45', '4.10', '2.95'][i]}`,
  `${m}-01,PAYROLL ACME,1500.00`,
])].join('\n') + '\n';

async function wipe() {
  await fetch(`${base}/api/profile/spending`, { method: 'DELETE', headers: H }).catch(() => undefined);
  const bills = (await pk('homeadmin', 'bills', {})).data?.bills ?? [];
  const people = (await pk('people', 'who', { words: 'everyone' })).data?.people ?? [];
  await Promise.all([...bills.map((b) => pk('homeadmin', 'paid', { id: b.id, remove: true })), ...people.map((p) => pk('people', 'forget', { who: p.name })), pk('homeadmin', 'bins', { words: 'forget my bins' })]);
  for (const c of ['groceries', 'eating out']) await api('/profile/spending/budget', { words: `£0 a month on ${c}`, month: '' });
}
async function seed() {
  await wipe();
  const r = await api('/profile/spending/import', { csv: CSV, rulesOnly: true });
  await api('/profile/spending/budget', { words: '£100 a month on groceries', month: '' });
  const due = new Date(Date.now() + 9 * 864e5).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  await pk('homeadmin', 'bill', { text: `Octopus Energy\nElectricity bill\nAmount due £84.20\nPay by ${due}` });
  return r;
}

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined });
const LOOKS = {
  scan: { ground: 'graphite', world: 'scan', night: 'graphite' },
  map: { ground: 'slate', world: 'map', night: 'slate' },
  eye: { ground: 'graphite', world: 'eye', night: 'graphite' },
  orbit: { ground: 'black', world: 'orbit', night: 'black' },
  grown: { ground: 'graphite', world: 'grown', night: 'graphite' },
  ink: { ground: 'warm', world: 'ink', night: 'warm' },
  glass: { ground: 'graphite', world: 'glass', night: 'graphite' },
};

async function phone(viewport, o = {}) {
  const ctx = await browser.newContext({ viewport, screen: viewport, deviceScaleFactor: 1, isMobile: true, hasTouch: true, ...UK, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(6000);
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${viewport.width}] pageerror: ${e.message}`));
  await page.addInitScript(({ key, body, look }) => {
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.themes1', '1');
    localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Tony', speak: false, sounds: false, theme: 'reactor', favourites: [], look: { ...look, switches: body ? { body } : {} }, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
    window.__ghostyHero = true;
    window.__ghostyPlace = { none: true };
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => window.__off !== true });
    window.__waits = [];
    new MutationObserver((ms) => {
      for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) for (const l of [...(n.matches?.('[data-wait]') ? [n] : []), ...n.querySelectorAll('[data-wait]')]) window.__waits.push(l.dataset.wait);
    }).observe(document, { childList: true, subtree: true });
  }, { key: KEY, body: o.body ?? 0, look: o.look ?? LOOKS.scan });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
  await page.waitForFunction(() => !!window.__ghosty, null, { timeout: 15000 }).catch(() => undefined);
  return { ctx, page };
}

const PK = (id) => `#pg-${id} .pn:not([hidden]) .pk`;
const txt = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].map((e) => e.textContent ?? '').join(' | '), sel);
const count = (page, sel) => page.locator(sel).count();
const until = (page, fn, arg, ms = 8000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
/** A screen open on a pill, its page drawn and (for the money app) read. */
async function open(page, id, pill, ready = true) {
  await page.evaluate((t) => (location.hash = t), id);
  await page.waitForFunction((t) => document.body.dataset.tab === t && window.__ghosty?.sheetpages?.[t]?.ready, id, { timeout: 15000 }).catch(() => problems.push(`${id}: the screen did not open`));
  if (pill) await page.locator(`#pg-${id} .secpills .secpill`, { hasText: new RegExp(`^${pill}$`) }).first().click().catch(() => problems.push(`${id}: no "${pill}" pill`));
  if (ready) await page.waitForSelector(`${PK(id)} > *`, { timeout: 8000 }).catch(() => problems.push(`${id}/${pill}: the page was not drawn`));
}
/** The money app's page, once it has said its state (ready, empty, error or offline). */
async function money(page, pill, want = 'ready') {
  const key = pill.toLowerCase();
  await page.evaluate((k) => window.__ghosty?.moneyapp && delete window.__ghosty.moneyapp.state[k], key);
  await open(page, 'money', pill);
  const ok = await until(page, ([k, w]) => window.__ghosty?.moneyapp?.state?.[k] === w && !document.querySelector('#pg-money .pn:not([hidden]) [data-wait]'), [key, want], 15000);
  check(ok, `money/${pill}: the page did not come to "${want}" (it is "${await page.evaluate((k) => window.__ghosty?.moneyapp?.state?.[k], key)}")`);
}
const small = (page, sel) => page.$$eval(`${sel} :is(button, input:not([type=hidden]):not([type=file]), textarea, select, [role=button])`, (els) => els
  .filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]'))
  .map((e) => {
    // (a tick box's target is its whole row, as the lifepass spec measures it)
    const r = (/^(checkbox|radio)$/.test(e.type ?? '') ? e.closest('label') ?? e : e).getBoundingClientRect();
    return r.width >= 43.5 && r.height >= 43.5 ? '' : `${e.tagName.toLowerCase()} "${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24)}" ${Math.round(r.width)}×${Math.round(r.height)}`;
  }).filter(Boolean).slice(0, 5));
const clipped = (page, id) => page.evaluate((t) => {
  const bad = [];
  for (const e of document.querySelectorAll(`#pg-${t} .pn:not([hidden]) .pk *`)) {
    if (!e.getClientRects().length || !(e.textContent ?? '').trim() || e.closest('canvas,select,textarea,input,pre')) continue;
    const cs = getComputedStyle(e);
    if (cs.overflowX !== 'visible' && e.scrollWidth > e.clientWidth + 1) bad.push(`cut "${(e.textContent ?? '').trim().slice(0, 24)}"`);
    const b = e.getBoundingClientRect();
    if (b.width > 2 && (b.right > innerWidth + 1 || b.left < -1)) bad.push(`outside "${(e.textContent ?? '').trim().slice(0, 24)}"`);
  }
  if (document.documentElement.scrollWidth > innerWidth + 1) bad.push('the page scrolls sideways');
  return bad.slice(0, 4);
}, id);
async function bar(page, tag, id) {
  const c = await clipped(page, id);
  check(!c.length, `${tag}: ${c.join(' | ')}`);
  const s = await small(page, PK(id));
  check(!s.length, `${tag}: under 44 pt: ${s.join(', ')}`);
  const t = await txt(page, `${PK(id)} *`);
  check(!RAW.test(t), `${tag}: a raw string on the page: ${(RAW.exec(t) ?? [''])[0]}`);
}

for (const vp of [PHONE, { width: 390, height: 844 }]) {
  const W = vp.width;
  const T = (s) => `[${W}] ${s}`;
  const brainSays = await seed();
  check(brainSays?.result?.added === 15, T(`the statement was kept (${brainSays?.result?.added} rows)`));
  const sum = await api(`/profile/spending?month=${M[2]}`);
  const { ctx, page } = await phone(vp);

  await block(`month ${W}`, async () => {
    log(`month ${W}`);
    await money(page, 'Month');
    const P = PK('money');
    const figs = await page.$$eval(`${P} .mnfig`, (n) => n.map((x) => ({ name: x.querySelector('.mnname')?.textContent, val: x.querySelector('.mnval')?.textContent, how: x.querySelector('.mnhow')?.textContent ?? '' })));
    const left = Math.round((sum.view.in - sum.view.out) * 100) / 100;
    check(figs.length === 3 && figs[0].val === pounds(sum.view.out) && figs[1].val === pounds(sum.view.in) && figs[2].val === pounds(left) && figs[2].name === 'Left over', T(`MONTH out, in and left over are the brain's own sums to the penny: ${JSON.stringify(figs.map((f) => `${f.name} ${f.val}`))} against ${pounds(sum.view.out)}, ${pounds(sum.view.in)}, ${pounds(left)}`));
    check(figs.every((f) => f.how.length > 10), T('MONTH every figure says how it was worked out'));
    check(/Day \d+ of \d+: £[\d,]+\.\d\d out so far, about £[\d,]+\.\d\d a day\./.test(await txt(page, `${P} .mnpace`)), T(`MONTH the pace is said in pounds a day: "${await txt(page, `${P} .mnpace`)}"`));
    const cats = await page.$$eval(`${P} .mnmeter .mnline span`, (n) => n.map((x) => x.textContent));
    check(sum.view.categories.every((c) => cats.some((x) => x.startsWith(pounds(c.spent)) && /\d+%$/.test(x))), T(`MONTH each category has its amount and its share: ${cats.slice(0, 5).join(' / ')}`));
    check(/more than last month|less than last month|about the same as last month/.test(await txt(page, `${P} .mnmeter .mnhow`)), T('MONTH a category says its move since the month before'));
    check(/WHERE IT WENT MOST/.test(await txt(page, `${P} .lab`)), T('MONTH where the money went most is listed'));
    const prev = page.locator(`${P} .mnnav button`).first();
    const next = page.locator(`${P} .mnnav button`).last();
    check(!(await prev.isDisabled()) && (await next.isDisabled()) && /latest month I hold/.test((await next.getAttribute('aria-label')) ?? ''), T('MONTH the month arrows: earlier open, later says why it cannot be pressed'));
    // a payment found by a word, then filed
    await page.evaluate((q) => (window.__box = document.querySelector(q)), `${P} input.mnsearch`);
    await page.fill(`${P} input.mnsearch`, 'netflix');
    check(await until(page, () => window.__ghosty.moneyapp.shown === 1), T(`MONTH "netflix" finds the one payment (${await page.evaluate(() => window.__ghosty.moneyapp.shown)})`));
    check((await page.evaluate(() => document.activeElement?.classList.contains('mnsearch') && document.activeElement === window.__box)), T('MONTH the search box keeps the finger while it filters, never replaced under the keyboard'));
    await page.locator(`${P} .mntxn`).first().click();
    await page.waitForSelector('.modal button[aria-label="File it as shopping"]', { timeout: 5000 });
    await page.click('.modal button[aria-label="File it as shopping"]');
    check(await until(page, () => window.__ghosty.moneyapp.refiled >= 1, null, 10000), T('MONTH a tap on a payment files it, and the brain keeps it'));
    check(/Filed \d+ payments? as shopping; the next statement remembers it\./.test(await txt(page, `${P} > .pkcol > p.pknote[aria-live]`)), T(`MONTH filing it is said: "${await txt(page, `${P} > .pkcol > p.pknote[aria-live]`)}"`));
    await page.fill(`${P} input.mnsearch`, 'zzzz');
    check(/No payment this month matches “zzzz”\./.test(await txt(page, P)), T('MONTH a word that finds nothing says so'));
    await page.fill(`${P} input.mnsearch`, '');
    await page.screenshot({ path: `${out}/moneylane-month-${W}.png` });
    await bar(page, T('MONTH bar'), 'money');
    // the earlier month
    await prev.click();
    check(await until(page, (m) => window.__ghosty.moneyapp.month === m, M[1]), T('MONTH ‹ goes to the month before'));
    await api('/profile/spending/file', { k: 'NETFLIX.COM', c: 'subscriptions', month: M[2] });
  });

  await block(`budgets ${W}`, async () => {
    log(`budgets ${W}`);
    await money(page, 'Budgets');
    const P = PK('money');
    check((await count(page, `${P} .mnmeter[data-category="groceries"]`)) === 1 && /£[\d,]+\.\d\d of £100\.00/.test(await txt(page, `${P} .mnmeter[data-category="groceries"] .mnline`)), T(`BUDGETS the groceries budget is drawn: "${await txt(page, `${P} .mnmeter[data-category="groceries"] .mnline`)}"`));
    check(/(On track|Going faster than the month|Over budget): £[\d,]+ (left|over) this month\./.test(await txt(page, `${P} .mnmeter[data-category="groceries"] .mnhow`)), T(`BUDGETS a budget says where it stands: "${await txt(page, `${P} .mnmeter[data-category="groceries"] .mnhow`)}"`));
    await page.click(`${P} button[aria-label="Set this budget"]`);
    check(/Type how much a month first/.test(await txt(page, `${P} p.pknote[aria-live]`)), T('BUDGETS an empty amount says what to do'));
    await page.selectOption(`${P} select.mnselect`, 'eating out');
    await page.fill(`${P} input.mnamount`, '50');
    await page.click(`${P} button[aria-label="Set this budget"]`);
    check(await until(page, (s) => document.querySelector(s)?.textContent?.includes('Budget kept: £50.00 a month on eating out.'), `${P} p.pknote[aria-live]`), T(`BUDGETS a budget set on the screen is kept: "${await txt(page, `${P} p.pknote[aria-live]`)}"`));
    check((await count(page, `${P} .mnmeter[data-category="eating out"]`)) === 1, T('BUDGETS the new budget is drawn at once'));
    await bar(page, T('BUDGETS bar'), 'money');
    await page.screenshot({ path: `${out}/moneylane-budgets-${W}.png` });
    await page.click(`${P} button[aria-label="Take away the eating out budget"]`);
    check(await until(page, (s) => document.querySelector(s)?.textContent?.includes('No budget on eating out now.'), `${P} p.pknote[aria-live]`), T('BUDGETS a budget taken away is said'));
    check((await count(page, `${P} .mnmeter[data-category="eating out"]`)) === 0, T('BUDGETS and its bar goes'));
  });

  await block(`bills ${W}`, async () => {
    log(`bills ${W}`);
    await money(page, 'Bills');
    const P = PK('money');
    const due = await page.evaluate(() => window.__ghosty.moneyapp.due);
    check(due.some((d) => /Spotify £11\.99/.test(d)) && due.some((d) => /Netflix £12\.99/i.test(d)) && due.some((d) => /Octopus Energy £84\.20/.test(d)), T(`BILLS the subscriptions found and the bill he showed HOME are due: ${due.join(' / ')}`));
    check(due.every((d, i) => i === 0 || d.slice(0, 10) >= due[i - 1].slice(0, 10)), T('BILLS in date order'));
    check(/Netflix: £12\.99, up from £10\.99 on /i.test(await txt(page, `${P} .mnup`)), T(`BILLS a price that went up is said with both prices: "${await txt(page, `${P} .mnup`)}"`));
    check((await count(page, `${P} .mndue[data-kind="bill"]`)) === 1 && /From the .* you showed me on the HOME screen\./.test(await txt(page, `${P} .mndue[data-kind="bill"] .mnhow`)), T('BILLS a HOME bill says where it came from'));
    const figs = await page.$$eval(`${P} .mnfig .mnname`, (n) => n.map((x) => x.textContent));
    check(figs.join('|') === 'Next 30 days|Subscriptions a month|A year', T(`BILLS the three totals: ${figs.join(', ')}`));
    check(/£24\.98/.test(await txt(page, `${P} .mnfig .mnval`)), T(`BILLS the subscriptions a month add up (11.99 + 12.99 = £24.98): ${await txt(page, `${P} .mnfig .mnval`)}`));
    await bar(page, T('BILLS bar'), 'money');
    await page.screenshot({ path: `${out}/moneylane-bills-${W}.png` });
  });

  await block(`trends ${W}`, async () => {
    log(`trends ${W}`);
    await money(page, 'Trends');
    const P = PK('money');
    const tr = await page.evaluate(() => window.__ghosty.moneyapp.trend);
    check(tr.length === 3 && tr.map((x) => x.slice(0, 7)).join() === M.join(), T(`TRENDS each month he gave me, in order: ${tr.join(' / ')}`));
    check(/so far/.test(await txt(page, `${P} .mnmeter .mnline b`)) && /this month is still going, so it is left out/.test(await txt(page, `${P} .mnfig .mnhow`)), T('TRENDS the month still going is said as so far, and left out of the average'));
    check(/A month on average/.test(await txt(page, `${P} .mnfig`)) && /Dearest month/.test(await txt(page, `${P} .mnfig`)) && /Cheapest month/.test(await txt(page, `${P} .mnfig`)), T('TRENDS the average, the dearest and the cheapest'));
    await page.click(`${P} button[aria-label="Show groceries across the months"]`);
    check((await page.getAttribute(`${P} button[aria-label="Show groceries across the months"]`, 'aria-pressed')) === 'true' && /^Groceries: £[\d,]+\.\d\d a month on average/.test(await txt(page, `${P} .mnwhy`)), T(`TRENDS one category across the months: "${await txt(page, `${P} .mnwhy`)}"`));
    await bar(page, T('TRENDS bar'), 'money');
    await page.screenshot({ path: `${out}/moneylane-trends-${W}.png` });
  });

  if (W === 440) {
    await block('states', async () => {
      log('states');
      const P = PK('money');
      // failed (with no copy of an earlier read kept on the phone: a kept copy is shown instead, which is right when the brain is away)
      await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('ghosty.read:/profile/spending')) localStorage.removeItem(k); });
      await page.route(/\/api\/profile\/spending(\?|$)/, (r) => r.abort('failed'));
      for (const pill of ['Month', 'Budgets', 'Bills', 'Trends']) {
        await money(page, pill, 'error');
        const e = await txt(page, `${P} [data-state="error"]`);
        check(e.length > 0 && !RAW.test(e) && (await count(page, `${P} button[aria-label="Try reading your money again"]`)) === 1, T(`${pill}: a failed read is said in his words with TRY AGAIN: "${e.slice(0, 100)}"`));
        check(!(await small(page, P)).length, T(`${pill}: its TRY AGAIN is 44 pt`));
      }
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      // offline
      await page.evaluate(() => (window.__off = true));
      for (const pill of ['Month', 'Budgets', 'Bills', 'Trends']) {
        await money(page, pill, 'offline');
        check(/No signal/.test(await txt(page, `${P} [data-state="offline"]`)), T(`${pill}: no signal is said`));
      }
      await page.evaluate(() => (window.__off = false));
      // waiting
      await page.route(/\/api\/profile\/spending(\?|$)/, async (r) => (await new Promise((k) => setTimeout(k, 1500)), r.continue().catch(() => undefined)));
      await page.evaluate(() => (window.__waits = []));
      await open(page, 'money', 'Budgets');
      check(await until(page, () => window.__waits.includes('Opening your money…'), null, 4000), T('a read says "Opening your money…" while it waits'));
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      // empty
      await wipe();
      for (const pill of ['Month', 'Budgets', 'Bills', 'Trends']) {
        await money(page, pill, 'empty');
        check(/Nothing kept yet/.test(await txt(page, `${P} [data-state="empty"]`)) && (await count(page, `${P} button[aria-label="Go to Paste a statement"]`)) === 1, T(`${pill}: with nothing kept it says so, with the way to a statement`));
      }
      await page.click(`${P} button[aria-label="Go to Paste a statement"]`);
      check(await until(page, () => window.__ghosty.sheetpages.money.section === 'statement'), T('"Add a statement" opens PASTE A STATEMENT'));
      await seed();
    });
  }
  await ctx.close();
}

// ---- the chat's words, people, home
await block('words people home', async () => {
  log('words, people, home');
  const { ctx, page } = await phone(PHONE);
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(400);
  if (!(await page.evaluate(() => !!document.querySelector('.hud.core.logopen')))) await page.locator('.logbtn:visible').first().click().catch(() => undefined);
  await page.waitForSelector('#cin', { state: 'visible', timeout: 8000 });
  for (const [said, section] of [['my budgets', 'budgets'], ['my subscriptions', 'bills'], ['spending trends', 'trends'], ['my spending', 'month']]) {
    await page.evaluate(() => (location.hash = 'core'));
    await page.waitForSelector('#cin', { state: 'visible', timeout: 8000 }).catch(() => undefined);
    await page.fill('#cin', said);
    await page.press('#cin', 'Enter');
    check(await until(page, (s) => document.body.dataset.tab === 'money' && window.__ghosty?.sheetpages?.money?.section === s, section, 10000), `"${said}" in the chat opens MONEY on ${section} (${await page.evaluate(() => `${document.body.dataset.tab} ${window.__ghosty?.sheetpages?.money?.section}`)})`);
  }
  // people: COMING UP
  const on = new Date(Date.now() + 8 * 864e5).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
  await pk('people', 'birthday', { who: 'Ali', words: `Ali birthday ${on}` });
  await open(page, 'people', 'Coming up');
  const P = PK('people');
  await page.waitForSelector(`${P} .pkperson`, { timeout: 8000 }).catch(() => undefined);
  check(/Ali’s birthday/.test(await txt(page, `${P} .pkperson`)), `COMING UP lists the birthday he kept: "${(await txt(page, `${P} .pkperson`)).slice(0, 80)}"`);
  await page.click(`${P} button[aria-label="Keep this birthday"]`);
  check(/Give me a name and the day/.test(await txt(page, `${P} p.pknote`)), 'COMING UP an empty birthday says what it needs');
  await page.fill(`${P} input[aria-label="Whose birthday"]`, 'Mum');
  await page.fill(`${P} input[aria-label="The day of the birthday"]`, '14 March');
  await page.click(`${P} button[aria-label="Keep this birthday"]`);
  check(await until(page, () => (window.__ghosty.people.coming ?? []).some((l) => /Mum’s birthday/.test(l)), null, 10000), 'COMING UP a birthday kept there is listed');
  await bar(page, 'COMING UP bar', 'people');
  await page.screenshot({ path: `${out}/moneylane-coming-440.png` });
  // YOUR PEOPLE: found by a word, forgotten on his say
  await open(page, 'people', 'Your people');
  await page.waitForSelector(`${P} input.ppfind:not([hidden])`, { timeout: 8000 }).catch(() => undefined);
  await page.fill(`${P} input.ppfind`, 'mum');
  check(await until(page, () => window.__ghosty.people.shown === 1), `YOUR PEOPLE "mum" finds one (${await page.evaluate(() => window.__ghosty.people.shown)})`);
  await page.click(`${P} .pkperson button:has-text("Details")`);
  await page.click(`${P} button[aria-label="Forget Mum"]`);
  await page.waitForSelector('.modal button:has-text("Keep them")', { timeout: 5000 });
  check((await count(page, '.modal button:has-text("Forget Mum")')) === 1, 'YOUR PEOPLE forgetting asks once more first');
  await page.locator('.modal button:has-text("Forget Mum")').click();
  check(await until(page, () => !(window.__ghosty.people.people ?? []).some((p) => p.name === 'Mum'), null, 10000), 'YOUR PEOPLE Mum is forgotten on his say');
  await bar(page, 'YOUR PEOPLE bar', 'people');
  // GROUP PLAN: made on the screen and called off there, nobody messaged
  await open(page, 'people', 'Group plan');
  await page.waitForSelector(`${P} input[aria-label="The plan, in your words"]`, { timeout: 8000 }).catch(() => undefined);
  await page.click(`${P} button[aria-label="Make this plan"]`);
  check(/Say the plan first/.test(await txt(page, `${P} p.pknote`)), 'GROUP PLAN an empty plan says what it needs');
  await page.fill(`${P} input[aria-label="The plan, in your words"]`, 'pub on Friday at 8 at the Crown, asked Ali, Sam and Jo');
  await page.click(`${P} button[aria-label="Make this plan"]`);
  check(await until(page, () => /pub/i.test(window.__ghosty.people.plan?.what ?? '') && (window.__ghosty.people.plan?.asked ?? []).length === 3, null, 10000), `GROUP PLAN a plan typed on the screen is made: ${JSON.stringify(await page.evaluate(() => window.__ghosty.people.plan))}`);
  check((await count(page, `${P} button[aria-label="Ali: yes"]`)) === 1 && (await page.locator(`${P} button[aria-label="Call off the plan"]`).isVisible()), 'GROUP PLAN its people and CALL OFF are there');
  await bar(page, 'GROUP PLAN bar', 'people');
  await page.click(`${P} button[aria-label="Call off the plan"]`);
  check(await until(page, () => window.__ghosty.people.plan === null, null, 10000), 'GROUP PLAN called off on the screen');
  // WORK: the to-do list in a to-do app's order, with its count
  for (const t of (await pk('work', 'todo', { words: '' })).data?.list ?? []) await pk('work', 'todo', { words: `tick ${t.text}` });
  await pk('work', 'todo', { words: 'clear done' });
  await pk('work', 'todo', { words: 'add: ring the garage' });
  await pk('work', 'todo', { words: 'add: post the parcel' });
  await pk('work', 'todo', { words: 'tick post the parcel' });
  await open(page, 'work', 'To-do');
  const Wk = PK('work');
  await page.waitForSelector(`${Wk} .pkitem`, { timeout: 8000 }).catch(() => undefined);
  check(/^1 to do · 1 done$/.test((await txt(page, `${Wk} .pktodocount`)).trim()), `WORK the count line: "${await txt(page, `${Wk} .pktodocount`)}"`);
  const order = await page.$$eval(`${Wk} .pkitems > li`, (l) => l.map((x) => x.textContent.trim()));
  check(order.join('|').toLowerCase() === 'any time|ring the garage|done|post the parcel', `WORK open jobs first under their heads, done last: ${order.join(' | ')}`);
  await bar(page, 'WORK to-do bar', 'work');
  await pk('work', 'todo', { words: 'tick ring the garage' });
  await pk('work', 'todo', { words: 'clear done' });
  // HOME: the bills still to pay, added up
  await pk('homeadmin', 'bill', { text: 'Thames Water\nAmount due £40.10\nPay by 30 December 2026' });
  await open(page, 'homeadmin', 'Bills');
  const Hb = PK('homeadmin');
  await page.waitForSelector(`${Hb} .pkbilltotal`, { timeout: 8000 }).catch(() => undefined);
  check(/^£\d+\.\d\d still to pay across \d+ bills?, from the bills you showed me\.$/.test((await txt(page, `${Hb} .pkbilltotal`)).trim()), `HOME the bills still to pay are added up: "${await txt(page, `${Hb} .pkbilltotal`)}"`);
  // HOME: a collection moved with nothing typed
  await open(page, 'homeadmin', 'Bins');
  const Hm = PK('homeadmin');
  await page.waitForTimeout(600);
  await page.click(`${Hm} button[aria-label="Tell me a collection moved"]`);
  check(/Type where it moved first/.test(await txt(page, `${Hm} p.pknote`)), 'HOME "A collection moved" with nothing typed asks where to');
  await page.fill(`${Hm} textarea[aria-label="Your bin days, in your words"]`, 'to Wednesday this week');
  await page.click(`${Hm} button[aria-label="Tell me a collection moved"]`);
  check(/Tell me your bin days first/.test(await txt(page, `${Hm} p.pknote`)), 'HOME a move with no bin days kept asks for the days first, and keeps none');
  await page.fill(`${Hm} textarea[aria-label="Your bin days, in your words"]`, '');
  const bins = (await pk('homeadmin', 'bins', {})).text ?? '';
  check(!/Wednesday/.test(bins), `HOME no made-up day was kept: "${bins.slice(0, 80)}"`);
  await ctx.close();
});

// ---- BODY 21 at 440: every money page and the people pages
await block('body 21', async () => {
  log('body 21');
  const { ctx, page } = await phone(PHONE, { body: 21 });
  for (const pill of ['Month', 'Budgets', 'Bills', 'Trends']) {
    await money(page, pill);
    const c = await clipped(page, 'money');
    check((await page.evaluate(() => document.documentElement.dataset.body)) === '21' && !c.length, `[body21] money/${pill}: ${c.join(' | ')}`);
  }
  for (const pill of ['Your people', 'Coming up']) {
    await open(page, 'people', pill);
    await page.waitForTimeout(800);
    const c = await clipped(page, 'people');
    check(!c.length, `[body21] people/${pill}: ${c.join(' | ')}`);
  }
  await page.screenshot({ path: `${out}/moneylane-body21.png` });
  await ctx.close();
});

// ---- the seven looks at 440
for (const [name, look] of Object.entries(LOOKS)) {
  await block(`look ${name}`, async () => {
    log(`look ${name}`);
    const { ctx, page } = await phone(PHONE, { look });
    for (const pill of ['Month', 'Bills']) {
      await money(page, pill);
      await bar(page, `[${name}] money/${pill}`, 'money');
      const seen = await page.evaluate(() => {
        const v = document.querySelector('#pg-money .pn:not([hidden]) .mnfig .mnval');
        const i = document.querySelector('#pg-money .pn:not([hidden]) .mnbar i');
        const c = v ? getComputedStyle(v).color : '';
        const b = i ? getComputedStyle(i).backgroundColor : '';
        // (BILLS draws no bars: its figures carry the colour there)
        return { c, b, ok: !!c && c !== 'rgba(0, 0, 0, 0)' && (!i || (!!b && b !== 'rgba(0, 0, 0, 0)' && b !== 'transparent')) };
      });
      check(seen.ok, `[${name}] money/${pill}: a figure or a bar has no colour of its own (${JSON.stringify(seen)})`);
    }
    await page.screenshot({ path: `${out}/moneylane-look-${name}.png` });
    await ctx.close();
  });
}

await wipe();
await browser.close();
console.log(`(moneylane spec: ${((Date.now() - t0) / 1000).toFixed(1)} s, ${checks} checks)`);
if (problems.length) {
  console.log(`PROBLEMS (${problems.length}):\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('THE MONEY LANE ran clean: MONTH, BUDGETS, BILLS and TRENDS from his statements to the penny, every state said, COMING UP, the bins, 44 pt keys, BODY 21 and the seven looks.');
