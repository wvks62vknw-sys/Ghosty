// THE NEXT ROUND, THE MONEY LANE (14 November): money and papers handled for you, against the preview's real brain (no model). At
// 440 × 956 and 390 × 844:
//
//   SAFE      YOUR MONTH asks for payday first, keeps it, then shows safe to spend and a day's worth equal to the brain's own sums
//             to the penny, with every payment still due before payday; his sorting rules are listed with their counts and change.
//   GOALS     a goal kept from the screen with its bar and what it is a month; money put in; taken away.
//   SHARED    a household bill shared three ways says who owes whom; settled on a tap says nothing was paid or sent.
//   CALENDAR  the month as a grid, a HOME bill on its day, payday filled, a tapped day says what falls on it.
//   YEAR      the year's totals and the PRINT key.
//   HOME      a paid bill stays under PAID with what its supplier cost this year, and can be forgotten.
//   WORK      every document shown is kept in the library on the phone, a new version when its words change, reopened and forgotten
//             (asked once more).
//   STATES    each new page offline and failed, in his words with TRY AGAIN; the bar: 44 pt keys, nothing sideways, no raw string;
//             BODY 21 and the seven looks; the chat's words open the pages.
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
const pounds = (n) => `${n < 0 ? '−' : ''}£${Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

// London's day (CI runs at any hour): every date here is anchored to it
const london = (ms = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
const TODAY = london();
const ym = (k) => {
  const y = +TODAY.slice(0, 4);
  const m = +TODAY.slice(5, 7) - 1 - k;
  const t = new Date(Date.UTC(y, m, 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}`;
};
const M = [ym(2), ym(1), ym(0)];
// three months with a balance column, each row on the 1st (so this month always has rows on or before today)
const CSV = ['Date,Description,Amount,Balance', ...M.flatMap((m, i) => [
  `${m}-01,PAYROLL ACME,1500.00,${(2000 + i * 100).toFixed(2)}`,
  `${m}-01,SPOTIFY,-11.99,${(1988.01 + i * 100).toFixed(2)}`,
  `${m}-01,TESCO STORES,-40.00,${(1948.01 + i * 100).toFixed(2)}`,
]), `${TODAY},COSTA COFFEE,-3.50,2144.51`].join('\n') + '\n';
const inDays = (n) => london(Date.now() + n * 864e5);

async function wipe() {
  await fetch(`${base}/api/profile/spending`, { method: 'DELETE', headers: H }).catch(() => undefined);
  const b = (await pk('homeadmin', 'bills', {})).data ?? {};
  await Promise.all([...(b.bills ?? []), ...(b.paid ?? [])].map((x) => pk('homeadmin', 'paid', { id: x.id, remove: true })));
  await pk('money', 'payday', { words: 'forget' });
  for (const g of (await pk('money', 'goals', {})).data?.goals ?? []) await pk('money', 'goals', { op: 'remove', id: g.id });
  for (const x of (await pk('money', 'household', {})).data?.bills ?? []) await pk('money', 'household', { op: 'remove', id: x.id });
}
async function seed() {
  await wipe();
  await api('/profile/spending/import', { csv: CSV, rulesOnly: true });
  await api('/profile/spending/file', { k: 'TESCO STORES', c: 'groceries', month: '' });
  const due = new Date(`${inDays(9)}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  await pk('homeadmin', 'bill', { text: `Octopus Energy\nElectricity bill\nAmount due £84.20\nPay by ${due}` });
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
async function open(page, id, pill) {
  await page.evaluate((t) => (location.hash = t), id);
  await page.waitForFunction((t) => document.body.dataset.tab === t && window.__ghosty?.sheetpages?.[t]?.ready, id, { timeout: 15000 }).catch(() => problems.push(`${id}: the screen did not open`));
  if (pill) await page.locator(`#pg-${id} .secpills .secpill`, { hasText: new RegExp(`^${pill}$`) }).first().click().catch(() => problems.push(`${id}: no "${pill}" pill`));
  await page.waitForSelector(`${PK(id)} > *`, { timeout: 8000 }).catch(() => problems.push(`${id}/${pill}: the page was not drawn`));
}
/** A new money page once it has said its state. */
async function plan(page, pill, key, want = 'ready') {
  await page.evaluate((k) => window.__ghosty?.moneyplan && delete window.__ghosty.moneyplan.state[k], key);
  await open(page, 'money', pill);
  const ok = await until(page, ([k, w]) => window.__ghosty?.moneyplan?.state?.[k] === w && !document.querySelector('#pg-money .pn:not([hidden]) [data-wait]'), [key, want], 15000);
  check(ok, `money/${pill}: the page did not come to "${want}" (it is "${await page.evaluate((k) => window.__ghosty?.moneyplan?.state?.[k], key)}")`);
}
const small = (page, sel) => page.$$eval(`${sel} :is(button, input:not([type=hidden]):not([type=file]), textarea, select, summary, [role=button])`, (els) => els
  .filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]'))
  .map((e) => {
    const r = e.getBoundingClientRect();
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
async function bar(page, tag, id, sel = PK(id)) {
  const c = await clipped(page, id);
  check(!c.length, `${tag}: ${c.join(' | ')}`);
  const s = await small(page, sel);
  check(!s.length, `${tag}: under 44 pt: ${s.join(', ')}`);
  const t = await txt(page, `${sel} *`);
  check(!RAW.test(t), `${tag}: a raw string on the page: ${(RAW.exec(t) ?? [''])[0]}`);
}

for (const vp of [PHONE, { width: 390, height: 844 }]) {
  const W = vp.width;
  const T = (s) => `[${W}] ${s}`;
  await seed();
  const { ctx, page } = await phone(vp);
  const P = PK('money');

  await block(`safe ${W}`, async () => {
    log(`safe ${W}`);
    await open(page, 'money', 'Month');
    check(await until(page, () => window.__ghosty?.moneyplan?.state?.safe === 'nopayday', null, 15000), T('SAFE with no payday kept it asks for payday first'));
    await page.click(`${P} button[aria-label="Keep this payday"]`);
    check(/Type your payday first/.test(await txt(page, `${P} .mnsafe ~ p.pknote, ${P} p.pknote[aria-live]`)), T('SAFE an empty payday says what to type'));
    await page.fill(`${P} input[aria-label="When is payday"]`, 'the 28th');
    await page.click(`${P} button[aria-label="Keep this payday"]`);
    check(await until(page, () => window.__ghosty.moneyplan.state.safe === 'ready', null, 10000), T('SAFE the payday is kept and safe to spend is worked out'));
    const brainSays = (await pk('money', 'safe', { today: TODAY })).data;
    const figs = await page.$$eval(`${P} .mnsfig`, (n) => n.map((x) => ({ name: x.querySelector('.mnname')?.textContent, val: x.querySelector('.mnval')?.textContent, how: x.querySelector('.mnhow')?.textContent ?? '' })));
    check(figs.length === 2 && figs[0].val === pounds(brainSays.safe) && figs[1].val === pounds(brainSays.perDay), T(`SAFE the figures are the brain's own sums to the penny: ${JSON.stringify(figs.map((f) => f.val))} against ${pounds(brainSays.safe)}, ${pounds(brainSays.perDay)}`));
    check(brainSays.base === 'balance' && /^Your balance of £[\d,]+\.\d\d on .+, less £[\d,]+\.\d\d still due before payday/.test(figs[0]?.how ?? ''), T(`SAFE it says how it was worked out: "${figs[0]?.how}"`));
    const due = await page.evaluate(() => window.__ghosty.moneyplan.safeDue);
    check(due.length === brainSays.due.length && due.join('|').includes('Octopus Energy £84.20') === brainSays.due.some((d) => d.name === 'Octopus Energy'), T(`SAFE every payment still due before payday is listed: ${due.join(' / ')}`));
    check(/Not a forecast/.test(await txt(page, `${P} .mnsafe .mnwhy`)), T('SAFE it says it is sums, not a forecast'));
    // the three figures of the month stay the month's own three
    check((await count(page, `${P} .mnfig`)) === 3, T(`SAFE YOUR MONTH keeps its own three figures (${await count(page, `${P} .mnfig`)})`));
    await page.screenshot({ path: `${out}/moneynext-safe-${W}.png` });
    await bar(page, T('SAFE bar'), 'money');
    // the sorting rules
    await page.click(`${P} button[aria-label="See and change your sorting rules"]`);
    check(await until(page, () => (window.__ghosty.moneyplan.rules ?? []).some((r) => /^TESCO STORES groceries \d+$/.test(r)), null, 10000), T(`RULES his rule is listed with its count: ${JSON.stringify(await page.evaluate(() => window.__ghosty.moneyplan.rules))}`));
    await page.selectOption('.modal select[aria-label="Where every TESCO STORES goes"]', 'shopping');
    check(await until(page, () => (window.__ghosty.moneyplan.rules ?? []).some((r) => /^TESCO STORES shopping/.test(r)), null, 10000), T('RULES a rule changed there files every payment again'));
    await bar(page, T('RULES bar'), 'money', '.modal');
    await page.click('.modal button[aria-label="Take away the rule for TESCO STORES"]');
    check(await until(page, () => !(window.__ghosty.moneyplan.rules ?? []).length, null, 10000) && /No rules of your own yet/.test(await txt(page, '.modal [data-state="empty"]')), T('RULES a rule taken away goes, and the empty list says how one is made'));
    await page.evaluate(() => document.querySelector('.modal .mhead button')?.click());
  });

  await block(`goals ${W}`, async () => {
    log(`goals ${W}`);
    await plan(page, 'Budgets', 'goals');
    check(/No goals yet/.test(await txt(page, `${P} [data-state="empty"]`)), T('GOALS with none it says how to make one'));
    await page.click(`${P} button[aria-label="Keep this goal"]`);
    check(/Say what the goal is for first/.test(await txt(page, `${P} p.pknote[aria-live]`)), T('GOALS an empty goal says what it needs'));
    const by = `${+TODAY.slice(0, 4) + 1}-06-30`;
    await page.fill(`${P} input[aria-label="What the goal is for"]`, 'Holiday');
    await page.fill(`${P} input[aria-label="How much"]`, '800');
    await page.fill(`${P} input[aria-label="By when (you can leave it empty)"]`, by);
    await page.click(`${P} button[aria-label="Keep this goal"]`);
    check(await until(page, () => (window.__ghosty.moneyplan.goals ?? []).some((g) => /^Holiday £0\.00 of £800\.00 £[\d.]+ a month$/.test(g)), null, 10000), T(`GOALS kept from the screen with what it is a month: ${JSON.stringify(await page.evaluate(() => window.__ghosty.moneyplan.goals))}`));
    await page.fill(`${P} input[aria-label="An amount for Holiday"]`, '50');
    await page.click(`${P} button[aria-label="Put this into Holiday"]`);
    check(await until(page, () => (window.__ghosty.moneyplan.goals ?? []).some((g) => /^Holiday £50\.00 of £800\.00/.test(g)), null, 10000), T('GOALS money put in moves the bar'));
    check(/nothing moves in your bank/.test(await txt(page, `${P} .mnwhy`)), T('GOALS it says nothing moves in his bank'));
    await bar(page, T('GOALS bar'), 'money');
    await page.screenshot({ path: `${out}/moneynext-goals-${W}.png` });
    await page.click(`${P} button[aria-label="Take away the Holiday goal"]`);
    check(await until(page, () => !(window.__ghosty.moneyplan.goals ?? []).length, null, 10000), T('GOALS taken away'));
  });

  await block(`shared ${W}`, async () => {
    log(`shared ${W}`);
    await plan(page, 'Bills', 'shared');
    await page.fill(`${P} input[aria-label="What the bill was"]`, 'Electric');
    await page.fill(`${P} input[aria-label="How much"]`, '96');
    await page.fill(`${P} input[aria-label="Who shares it"]`, 'you, Sam and Jo');
    await page.click(`${P} button[aria-label="Add this shared bill"]`);
    check(await until(page, () => (window.__ghosty.moneyplan.owes ?? []).join('|') === 'Sam owes you £32.00|Jo owes you £32.00', null, 10000), T(`SHARED who owes whom to the penny: ${JSON.stringify(await page.evaluate(() => window.__ghosty.moneyplan.owes))}`));
    await bar(page, T('SHARED bar'), 'money');
    await page.click(`${P} button[aria-label="Mark every shared bill settled"]`);
    check(await until(page, () => !(window.__ghosty.moneyplan.owes ?? []).length, null, 10000) && /Nothing was paid or sent/.test(await txt(page, `${P} p.pknote[aria-live]`)), T('SHARED settled on a tap, and nothing paid or sent'));
  });

  await block(`calendar ${W}`, async () => {
    log(`calendar ${W}`);
    await plan(page, 'Calendar', 'calendar');
    const days = await count(page, `${P} .mncalday`);
    const dim = new Date(Date.UTC(+M[2].slice(0, 4), +M[2].slice(5, 7), 0)).getUTCDate();
    check(days === dim, T(`CALENDAR the month as a grid of its ${dim} days (${days})`));
    const pay = await page.evaluate(() => document.querySelector('.mncalday[data-pay="1"]')?.dataset.day ?? '');
    check(pay.startsWith(M[2]) && +pay.slice(8, 10) >= 26 && +pay.slice(8, 10) <= 28, T(`CALENDAR payday is filled on its day (${pay})`));
    const billDay = inDays(9);
    if (billDay.startsWith(M[2])) check((await page.getAttribute(`${P} .mncalday[data-day="${billDay}"]`, 'data-has')) === '1', T('CALENDAR the HOME bill sits on its day'));
    await page.click(`${P} .mncalday[data-day="${pay}"]`);
    check(/Payday/.test(await txt(page, `${P} .mncaldetail`)), T('CALENDAR a tapped day says what falls on it'));
    await bar(page, T('CALENDAR bar'), 'money');
    await page.screenshot({ path: `${out}/moneynext-calendar-${W}.png` });
    await page.click(`${P} button[aria-label="The month after"]`);
    check(await until(page, (m) => !(window.__ghosty.moneyplan.calendar ?? []).some((d) => d.startsWith(m)) && window.__ghosty.moneyplan.state.calendar === 'ready', M[2], 10000), T('CALENDAR › goes to the month after'));
  });

  await block(`year ${W}`, async () => {
    log(`year ${W}`);
    await plan(page, 'Trends', 'year');
    const y = await page.evaluate(() => window.__ghosty.moneyplan.year);
    check(new RegExp(`^${M[2].slice(0, 4)} £[\\d,]+\\.\\d\\d £[\\d,]+\\.\\d\\d$`).test(y), T(`YEAR the year's totals: "${y}"`));
    check((await count(page, `${P} button[aria-label^="Print your"]`)) === 1, T('YEAR it can be printed'));
    check(/SUBSCRIPTIONS/.test(await txt(page, `${P} .lab`)), T('YEAR subscriptions started and stopped are said'));
    await bar(page, T('YEAR bar'), 'money');
  });

  if (W === 440) {
    await block('home paid', async () => {
      log('home paid');
      await open(page, 'homeadmin', 'Bills');
      const Hb = PK('homeadmin');
      await page.waitForSelector(`${Hb} button[aria-label="Mark Octopus Energy paid"]`, { timeout: 8000 });
      await page.click(`${Hb} button[aria-label="Mark Octopus Energy paid"]`);
      check(await until(page, () => (window.__ghosty.homeadmin.paid ?? []).some((b) => b.supplier === 'Octopus Energy'), null, 10000), 'HOME a paid bill is kept, not lost');
      check(/PAID/.test(await txt(page, `${Hb} .lab`)) && new RegExp(`Octopus Energy: £84\\.20 in ${TODAY.slice(0, 4)}`).test(await txt(page, `${Hb} .pkyear`)), `HOME it stands under PAID with what the supplier cost this year: "${await txt(page, `${Hb} .pkyear`)}"`);
      await bar(page, 'HOME paid bar', 'homeadmin');
      await page.click(`${Hb} .pkpaid button[aria-label="Forget the Octopus Energy bill"]`);
      check(await until(page, () => !(window.__ghosty.homeadmin.paid ?? []).length, null, 10000), 'HOME a paid bill can be forgotten there');
    });

    await block('work library', async () => {
      log('work library');
      await open(page, 'work', 'Document');
      check(/No document yet/.test(await txt(page, `${PK('work')} [data-state="empty"]`)), 'WORK with nothing kept the library says where one comes from');
      for (const text of ['SAM KHAN\nLeeds\n\nEXPERIENCE\n- Worked at Tesco', 'SAM KHAN\nLeeds\n\nEXPERIENCE\n- Worked at Tesco\n- Shift lead at Asda']) {
        await page.evaluate((t) => window.__ghosty.run('open_work', { what: 'doc', title: 'YOUR CV', text: t, kind: 'cv' }), text);
        await page.waitForSelector('.modal [data-screen="doc"]', { timeout: 8000 }).catch(() => undefined);
        check(/library/.test(await txt(page, '.modal [data-screen="doc"] p.pknote')), `WORK a document shown says it is kept: "${await txt(page, '.modal [data-screen="doc"] p.pknote')}"`);
        await page.evaluate(() => document.querySelector('.modal .mhead button')?.click());
      }
      await open(page, 'work', 'To-do');
      await open(page, 'work', 'Document');
      const lib = await page.evaluate(() => window.__ghosty.work.library);
      check(lib.length === 1 && lib[0] === 'YOUR CV 2', `WORK one CV kept with its two versions: ${JSON.stringify(lib)}`);
      const Wk = PK('work');
      check((await count(page, `${Wk} button[aria-label="Edit your cv in Documents"]`)) === 1, 'WORK it can be opened in Documents');
      await page.click(`${Wk} button[aria-label="Show the older versions of your cv"]`);
      check((await count(page, `${Wk} button[aria-label^="Open version 1 from"]`)) === 1, 'WORK its older version is listed');
      await bar(page, 'WORK library bar', 'work');
      await page.click(`${Wk} button[aria-label="Open your cv"]`);
      check(await until(page, () => /Shift lead at Asda/.test(document.querySelector('.modal [data-screen="doc"] pre')?.textContent ?? '')), 'WORK the newest version reopens');
      await page.evaluate(() => document.querySelector('.modal .mhead button')?.click());
      await page.click(`${Wk} button[aria-label="Forget your cv"]`);
      check(await until(page, () => !!document.querySelector('.modal button[aria-label="No, keep it"]')), 'WORK forgetting asks once more first');
      await page.click('.modal button[aria-label="Yes, forget your cv"]');
      check(await until(page, () => !window.__ghosty.work.library.length), 'WORK forgotten on his say');
    });

    await block('states', async () => {
      log('states');
      const pages = [['Budgets', 'goals'], ['Calendar', 'calendar'], ['Trends', 'year']];
      await page.evaluate(() => (window.__off = true));
      for (const [pill, key] of pages) {
        await plan(page, pill, key, 'offline');
        check(/No signal/.test(await txt(page, `${P} [data-state="offline"]`)), `${pill}: no signal is said`);
      }
      await page.evaluate(() => (window.__off = false));
      await page.route(/\/api\/packs\/do/, (r) => r.abort('failed'));
      for (const [pill, key] of pages) {
        await plan(page, pill, key, 'error');
        const e = await txt(page, `${P} [data-state="error"]`);
        check(e.length > 0 && !RAW.test(e) && (await count(page, `${P} button[aria-label="Try reading it again"]`)) >= 1, `${pill}: a failed read is said in his words with TRY AGAIN: "${e.slice(0, 100)}"`);
        check(!(await small(page, P)).length, `${pill}: its TRY AGAIN is 44 pt`);
      }
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    });
  }
  await ctx.close();
}

// ---- the chat's words
await block('words', async () => {
  log('words');
  const { ctx, page } = await phone(PHONE);
  for (const [said, section] of [['safe to spend', 'month'], ['money calendar', 'calendar'], ['savings goals', 'budgets'], ['my year in money', 'trends']]) {
    await page.evaluate(() => (location.hash = 'core'));
    await page.waitForTimeout(300);
    if (!(await page.evaluate(() => !!document.querySelector('.hud.core.logopen')))) await page.locator('.logbtn:visible').first().click().catch(() => undefined);
    await page.waitForSelector('#cin', { state: 'visible', timeout: 8000 }).catch(() => undefined);
    await page.fill('#cin', said);
    await page.press('#cin', 'Enter');
    check(await until(page, (s) => document.body.dataset.tab === 'money' && window.__ghosty?.sheetpages?.money?.section === s, section, 10000), `"${said}" in the chat opens MONEY on ${section} (${await page.evaluate(() => `${document.body.dataset.tab} ${window.__ghosty?.sheetpages?.money?.section}`)})`);
  }
  await ctx.close();
});

// ---- BODY 21 at 440: the new pages
await block('body 21', async () => {
  log('body 21');
  const { ctx, page } = await phone(PHONE, { body: 21 });
  await open(page, 'money', 'Month');
  await until(page, () => window.__ghosty?.moneyplan?.state?.safe === 'ready', null, 15000);
  for (const [pill, key] of [['Month', ''], ['Budgets', 'goals'], ['Bills', 'shared'], ['Calendar', 'calendar'], ['Trends', 'year']]) {
    if (key) await plan(page, pill, key);
    const c = await clipped(page, 'money');
    check((await page.evaluate(() => document.documentElement.dataset.body)) === '21' && !c.length, `[body21] money/${pill}: ${c.join(' | ')}`);
  }
  await page.screenshot({ path: `${out}/moneynext-body21.png` });
  await ctx.close();
});

// ---- the seven looks at 440
for (const [name, look] of Object.entries(LOOKS)) {
  await block(`look ${name}`, async () => {
    log(`look ${name}`);
    const { ctx, page } = await phone(PHONE, { look });
    await plan(page, 'Calendar', 'calendar');
    await bar(page, `[${name}] money/Calendar`, 'money');
    const seen = await page.evaluate(() => {
      const d = document.querySelector('#pg-money .pn:not([hidden]) .mncalday[data-pay="1"]');
      const c = d ? getComputedStyle(d).backgroundColor : '';
      return { c, ok: !!c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent' };
    });
    check(seen.ok, `[${name}] money/Calendar: payday has no colour of its own (${JSON.stringify(seen)})`);
    await page.screenshot({ path: `${out}/moneynext-look-${name}.png` });
    await ctx.close();
  });
}

await wipe();
await browser.close();
console.log(`(moneynext spec: ${((Date.now() - t0) / 1000).toFixed(1)} s, ${checks} checks)`);
if (problems.length) {
  console.log(`PROBLEMS (${problems.length}):\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('THE MONEY LANE, NEXT ROUND, ran clean: safe to spend to the penny, rules, goals, shared bills, the calendar, the year, paid bills kept, the documents library, every state, 44 pt keys, BODY 21 and the seven looks.');
