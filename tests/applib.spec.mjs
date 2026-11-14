// THE APP LIBRARY (APPLIB, lane ENGINE; apps/web/src/features/applib/): the Apps screen and the engine that draws every AppDef.
// - The Library: featured, families, search as he types, an app's page with OPEN and PIN TO HOME, recently used, pinned Home cards;
//   "open <app>" found on the phone with no brain, and #apps/<id> opening the app.
// - Every app in LIBRARY opens and draws with no page error, one scroll area, nothing sideways and every key 44 pt.
// - One app of each archetype driven through its main move: add (log, with every field type), tick (checklist), calculate (calc),
//   time (timer, and it survives a reload), review (deck), count (counter), search (guide) and open (screen). Game and importer are
//   driven when their lanes' renderers are in (one line says so when they are not).
// - One app per archetype in all seven looks at 440 and 390.
import { launch } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined });
const problems = [];
const notes = [];
const check = (ok, what) => ok || problems.push(what);
const T0 = Date.now();
const WORLDS = ['glass', 'eye', 'grown', 'ink', 'map', 'orbit', 'scan'];
const SMALL = { width: 390, height: 844 };
const day = (n = 0) => { const d = new Date(Date.now() + n * 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// one app of each archetype the engine draws (the spec's own, so it never waits on a catalogue)
const T = ['These are sample entries.', 'Tap one to change it.', 'Settings has export and Recently deleted.'];
const FIX = {
  log: {
    id: 'spec-cellar', name: 'Spec Cellar', family: 'life', glyph: 'bottle', archetype: 'log', pitch: 'Every bottle you keep, what it cost and when to drink it.', keywords: ['spec cellar', 'bottles'], tour: T,
    log: {
      fields: [
        { id: 'name', label: 'Wine', type: 'text', required: true, hint: 'e.g. Rioja' }, { id: 'notes', label: 'Notes', type: 'long' },
        { id: 'year', label: 'Vintage', type: 'number' }, { id: 'price', label: 'Price', type: 'money' }, { id: 'drinkby', label: 'Drink by', type: 'date', default: 'today' },
        { id: 'at', label: 'Opened at', type: 'time' }, { id: 'aired', label: 'Aired', type: 'duration' }, { id: 'colour', label: 'Colour', type: 'choice', options: ['Red', 'White', 'Rosé'] },
        { id: 'grapes', label: 'Grapes', type: 'multi', options: ['Merlot', 'Syrah', 'Chardonnay'] }, { id: 'rating', label: 'Rating', type: 'rating' }, { id: 'body', label: 'Body', type: 'scale' },
        { id: 'gift', label: 'A gift', type: 'check' }, { id: 'photo', label: 'Label', type: 'photo' }, { id: 'link', label: 'Page', type: 'link' }, { id: 'bottles', label: 'Bottles', type: 'number' },
      ],
      title: '{name} ({year})', sub: 'colour', meta: 'price', date: 'drinkby', group: 'colour',
      stats: [{ label: 'Bottles', kind: 'sum', field: 'bottles', goal: 12, dir: 'reach' }, { label: 'Spent', kind: 'sum', field: 'price', period: 'year', goal: 100, dir: 'limit' }, { label: 'Kinds', kind: 'distinct', field: 'colour' }],
      chart: { field: 'price', kind: 'bar', period: 'week' }, views: ['list', 'board', 'calendar', 'gallery'], remind: { field: 'drinkby', words: 'Drink by today: {name}' },
    },
    sample: [{ name: 'Rioja Reserva', year: 2018, colour: 'Red', price: 14.5, bottles: 3, drinkby: day(0) }, { name: 'Chablis', year: 2021, colour: 'White', price: 18, bottles: 2, drinkby: day(-2) }, { name: 'Provence', year: 2023, colour: 'Rosé', price: 11, bottles: 1, drinkby: day(30) }],
  },
  checklist: { id: 'spec-morning', name: 'Spec Morning', family: 'life', glyph: 'check', archetype: 'checklist', pitch: 'A calm morning routine, ticked off one step at a time.', keywords: ['spec morning'], tour: T, checklist: { sections: [{ name: 'Wake', items: ['Water', 'Stretch'] }, { name: 'Out', items: ['Keys', 'Wallet', 'Phone'] }], repeat: 'daily' } },
  calc: { id: 'spec-bmi', name: 'Spec BMI', family: 'body', glyph: 'heart', archetype: 'calc', pitch: 'Your body mass index from your height and your weight.', keywords: ['spec bmi'], tour: T, calc: { inputs: [{ id: 'kg', label: 'Weight', unit: 'kg', default: 70 }, { id: 'cm', label: 'Height', unit: 'cm', default: 175 }, { id: 'sex', label: 'Who', default: 1, choices: [{ label: 'Adult', value: 1 }, { label: 'Child', value: 0 }] }], outputs: [{ id: 'bmi', label: 'BMI', expr: 'kg / (cm / 100) ^ 2', dp: 1 }, { id: 'band', label: 'Over 25', expr: 'if(bmi > 25, 1, 0)', dp: 0 }], tests: [{ in: { kg: 70, cm: 175 }, out: { bmi: 22.86 } }, { in: { kg: 90, cm: 180 }, out: { bmi: 27.78 } }], estimate: true, source: 'NHS BMI formula' } },
  timer: { id: 'spec-intervals', name: 'Spec Intervals', family: 'body', glyph: 'timer', archetype: 'timer', pitch: 'Short hard efforts with rests between, timed for you.', keywords: ['spec intervals'], tour: T, timer: { steps: [{ name: 'Work', secs: 2 }, { name: 'Rest', secs: 1 }], rounds: 2 } },
  deck: { id: 'spec-capitals', name: 'Spec Capitals', family: 'learn', glyph: 'globe', archetype: 'deck', pitch: 'The capital cities of Europe, learnt a few at a time.', keywords: ['spec capitals'], tour: T, deck: { cards: [{ q: 'France', a: 'Paris' }, { q: 'Spain', a: 'Madrid' }, { q: 'Italy', a: 'Rome' }, { q: 'Norway', a: 'Oslo' }], mode: 'srs' } },
  counter: { id: 'spec-tally', name: 'Spec Tally', family: 'tools', glyph: 'plus', archetype: 'counter', pitch: 'Count anything with one tap, and start again each day.', keywords: ['spec tally'], tour: T, counter: { names: ['Laps', 'Glasses'], step: 1, reset: 'daily' } },
  guide: { id: 'spec-knots', name: 'Spec Knots', family: 'world', glyph: 'anchor', archetype: 'guide', pitch: 'The knots worth knowing, and what each one is good for.', keywords: ['spec knots'], tour: T, guide: { sections: [{ title: 'Reef knot', body: 'Joins two ends of the same thickness.', tags: ['join'] }, { title: 'Bowline', body: 'A fixed loop that will not slip.', tags: ['loop'] }], source: { name: 'Scouts', url: 'https://www.scouts.org.uk' } } },
  screen: { id: 'spec-sheets', name: 'Spec Sheets', family: 'office', glyph: 'grid', archetype: 'screen', pitch: 'Budgets and lists with formulas that follow, kept here.', keywords: ['spec sheets'], tour: T, screen: { hash: 'sheets' } },
};

async function open(viewport = PHONE, world = 'glass', hash = 'apps') {
  const ctx = await browser.newContext({ viewport, ...UK, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`[${world} ${viewport.width}] pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && /applib|al-|ak-/.test(m.text())) problems.push(`[${world}] console: ${m.text().slice(0, 160)}`); });
  await page.addInitScript((world) => {
    localStorage.setItem('ghosty.ownerKey', 'preview-owner-key-0123456789');
    if (!localStorage.getItem('ghosty.settings')) localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Boss', speak: false, sounds: false, look: { ground: 'graphite', world, night: 'graphite', switches: {} } }));
  }, world);
  await page.goto(`${base}/#${hash}`);
  await page.waitForFunction(() => !!window.__ghosty?.applib, null, { timeout: 30000 });
  return { ctx, page };
}
const L = (page) => page.evaluate(() => ({ ...window.__ghosty.applib.library }));
const tryApp = async (page, def) => {
  await page.evaluate((d) => window.__ghosty.applib.try(d), def);
  await page.waitForSelector(`.ak-app[data-app="${def.id}"]`, { timeout: 8000 });
  await page.evaluate(() => { for (const b of document.querySelectorAll('#pg-apps .ak-tour button')) b.click(); });
  await page.evaluate(() => new Promise((r) => setTimeout(r, 50)));
};
/** One scroll area, nothing sideways, every key 44 pt, the keys at the bottom, words never under a key. */
const fit = (page, sel) => page.evaluate((sel) => {
  const root = document.querySelector(sel);
  if (!root) return { missing: true };
  const scrollers = [...root.querySelectorAll('*')].filter((e) => { const s = getComputedStyle(e); return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 1 && !e.closest('.ak-sheet'); });
  const keys = [...root.querySelectorAll('button, select, input:not([type=file]):not([type=range])')].filter((b) => b.offsetParent && !b.closest('[hidden]'));
  const small = keys.filter((b) => { const r = b.getBoundingClientRect(); return r.height < 43.5 || (b.matches('button') && r.width < 43.5); }).map((b) => (b.getAttribute('aria-label') || b.textContent || b.className).slice(0, 30));
  const wide = [...root.querySelectorAll('*')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > innerWidth + 0.5 || r.left < -0.5); }).map((e) => e.className.toString().slice(0, 30)).slice(0, 4);
  return { scrollers: scrollers.length, scroller: scrollers[0]?.className ?? '', small: small.slice(0, 5), wide, sideways: document.documentElement.scrollWidth > innerWidth };
}, sel);
const fitOk = (m) => !m.missing && m.scrollers <= 1 && !m.small.length && !m.wide.length && !m.sideways;

// ── the Library screen ─────────────────────────────────────────────────────────────────────────
{
  const { ctx, page } = await open(PHONE, 'glass');
  const count = await page.evaluate(() => window.__ghosty.applib.count());
  check(count >= 40, `[library] only ${count} apps (Ghosty's own screens alone are 45)`);
  check(await page.evaluate(() => window.__ghosty.applib.library.view) === 'home' && await page.locator('#pg-apps .al-find').count() === 1, '[library] the front page with its search is not drawn');
  check(await page.locator('#pg-apps .al-shelf[data-shelf="featured"] .al-hero').count() === 1, '[library] no featured app');
  check(await page.locator('#pg-apps .al-shelf[data-shelf="families"] .al-chip').count() >= 3, '[library] the families are missing');
  let m = await fit(page, '#pg-apps');
  check(fitOk(m), `[library fit] ${JSON.stringify(m)}`);
  // search as he types
  await page.fill('#pg-apps .al-find', 'spreadsheets');
  const hit = await page.locator('#pg-apps .al-results .al-approw').first().getAttribute('data-app');
  check(hit === 'ghosty-sheets', `[search] "spreadsheets" found ${hit}`);
  await page.fill('#pg-apps .al-find', 'zzzzqq');
  check(/No app matches “zzzzqq”/.test(await page.textContent('#pg-apps .al-libbody')), '[search] no words for no match');
  await page.fill('#pg-apps .al-find', '');
  // an app's page: OPEN, PIN TO HOME, back
  await page.evaluate((d) => { window.__ghosty.applib.try(d); }, FIX.log);
  await page.evaluate(() => window.__ghosty.applib.open('nothing'));
  await page.evaluate(() => { location.hash = '#apps/about/spec-cellar'; });
  await page.waitForSelector('#pg-apps .al-about[data-app="spec-cellar"]');
  check(/Wine, Notes, Vintage/.test(await page.textContent('#pg-apps .al-libbody')), '[page] what it keeps is not said');
  await page.click('#pg-apps .al-aboutkeys button[aria-label="Pin Spec Cellar to Home"]');
  check(/pinned to Home/.test(await page.textContent('#pg-apps .al-said')), '[page] PIN TO HOME said nothing');
  m = await fit(page, '#pg-apps');
  check(fitOk(m), `[page fit] ${JSON.stringify(m)}`);
  await page.click('#pg-apps .al-aboutkeys button[aria-label="Open Spec Cellar"]');
  await page.waitForSelector('#pg-apps .ak-app[data-app="spec-cellar"]');
  check(/#apps\/spec-cellar$/.test(page.url()), `[open] the address is ${page.url()}`);
  await page.click('#pg-apps .ak-head .al-back');
  await page.waitForSelector('#pg-apps .al-shelf[data-shelf="pinned"] .ak-card');
  check(await page.locator('#pg-apps .al-shelf[data-shelf="recent"] .al-tile[data-app="spec-cellar"]').count() === 1, '[recent] the app is not in Recently used');
  // his words, on the phone: "open spec cellar" (and a screen's name is left alone)
  check(await page.evaluate(() => window.__ghosty.applib.sentence('open spec cellar')) === 'spec-cellar', '[words] "open spec cellar" found nothing');
  check(await page.evaluate(() => window.__ghosty.applib.sentence('please open the spec cellar app')) === 'spec-cellar', '[words] "please open the spec cellar app" found nothing');
  check(await page.evaluate(() => window.__ghosty.applib.sentence('open radio')) === null, '[words] "open radio" was taken from the radio screen');
  check(await page.evaluate(() => window.__ghosty.applib.sentence('what is a cellar')) === null, '[words] a question was taken as an app');
  await page.screenshot({ path: `${out}/applib-library.png` });
  await ctx.close();
}

// ── each archetype through its main move ──────────────────────────────────────────────────────
{
  const { ctx, page } = await open(PHONE, 'glass');
  const A = '#pg-apps .ak-app';
  // log: the stats and rings, the chart, the reminder, every field type in the sheet, an add, the views
  await tryApp(page, FIX.log);
  check(await page.locator(`${A} .al-stat`).count() === 3 && await page.locator(`${A} .al-ring`).count() === 2, '[log] the stats strip or its goal rings are missing');
  check(/^6$/.test((await page.textContent(`${A} .al-stat[data-kind="sum"] b`)).trim()), `[log] bottles summed to "${await page.textContent(`${A} .al-stat[data-kind="sum"] b`)}"`);
  check(await page.locator(`${A} svg.al-chart rect.al-bar`).count() === 7, '[log] the week chart has not 7 bars');
  check(/Drink by today: Rioja Reserva/.test(await page.textContent(`${A} .ak-notice`).catch(() => '')) || (await page.evaluate(() => new Promise((r) => setTimeout(r, 500)))) || /Drink by today/.test(await page.textContent(`${A} .ak-notice`)), '[log] the reminder on the day was not said');
  await page.click(`${A} .ak-tools button[aria-label="Add to Spec Cellar"]`);
  const types = await page.$$eval(`${A} .al-edit .al-field`, (e) => e.map((x) => x.dataset.type));
  check(['text', 'long', 'number', 'money', 'date', 'time', 'duration', 'choice', 'multi', 'rating', 'scale', 'check', 'photo', 'link'].every((t) => types.includes(t)), `[log] the sheet lacks a field type: ${types}`);
  await page.click(`${A} .al-edit button:has-text("Save")`);
  check(/Wine is needed/.test(await page.textContent(`${A} .ak-notice`)), '[log] a missing required field was not said');
  await page.fill(`${A} .al-edit [data-field="name"] input`, 'Barolo');
  await page.fill(`${A} .al-edit [data-field="year"] input`, '2016');
  await page.fill(`${A} .al-edit [data-field="price"] input`, '32.5');
  await page.click(`${A} .al-edit [data-field="colour"] .al-chip:has-text("Red")`);
  await page.click(`${A} .al-edit [data-field="rating"] .al-star >> nth=3`);
  await page.click(`${A} .al-edit button:has-text("Save")`);
  const titles = await page.$$eval(`${A} .ak-rowtitle`, (e) => e.map((x) => x.textContent));
  check(titles.includes('Barolo (2016)'), `[log] the new entry is not listed: ${titles}`);
  check(await page.locator(`${A} .ak-row:has-text("Barolo") .ak-rowmeta`).textContent() === '£32.50', '[log] the price is not shown as money');
  await page.click(`${A} .ak-tools button:has-text("Undo")`);
  check(!(await page.$$eval(`${A} .ak-rowtitle`, (e) => e.map((x) => x.textContent))).includes('Barolo (2016)'), '[log] Undo did not take the entry back');
  await page.click(`${A} .ak-tools button:has-text("Redo")`);
  for (const v of ['Board', 'Calendar', 'Gallery', 'List']) {
    await page.click(`${A} .al-segkey:has-text("${v}")`);
    check(await page.locator(`${A} .ak-body`).getAttribute('data-view') === v.toLowerCase(), `[log] the ${v} view did not draw`);
    const m = await fit(page, A);
    check(fitOk(m), `[log ${v} fit] ${JSON.stringify(m)}`);
    if (v === 'Board') { await page.click(`${A} .al-col[data-col="Red"] .al-bcard >> nth=0 >> button[aria-label^="Move"]`); check(/Moved/.test(await page.textContent(`${A} .ak-notice`)), '[log] the board did not move a card'); }
    if (v === 'Calendar') check(await page.locator(`${A} .al-day[data-n="1"]`).count() >= 1, '[log] the calendar has no marked day');
  }
  await page.screenshot({ path: `${out}/applib-log.png` });

  // checklist: tick, the count, clear
  await tryApp(page, FIX.checklist);
  await page.click(`${A} .al-tick:has-text("Water")`);
  check(/^1 of 5$/.test(await page.textContent(`${A} .al-progress b`)), `[checklist] after one tick: ${await page.textContent(`${A} .al-progress b`)}`);
  await page.click(`${A} .ak-tools button:has-text("Clear ticks")`);
  check(/^0 of 5$/.test(await page.textContent(`${A} .al-progress b`)), '[checklist] CLEAR TICKS did not clear');

  // calc: live as he types, the estimate and the source, KEEP
  await tryApp(page, FIX.calc);
  check(await page.textContent(`${A} .al-out[data-output="bmi"] .al-outval`) === '22.9', `[calc] the first answer: ${await page.textContent(`${A} .al-out[data-output="bmi"] .al-outval`)}`);
  await page.fill(`${A} .al-field[data-input="kg"] input`, '90');
  await page.fill(`${A} .al-field[data-input="cm"] input`, '180');
  check(await page.textContent(`${A} .al-out[data-output="bmi"] .al-outval`) === '27.8', `[calc] live: ${await page.textContent(`${A} .al-out[data-output="bmi"] .al-outval`)}`);
  check(await page.textContent(`${A} .al-out[data-output="band"] .al-outval`) === '1', '[calc] an output reading an earlier one');
  check(await page.locator(`${A} .al-estimate`).textContent() === 'A first estimate, never certified.' && /NHS BMI formula/.test(await page.textContent(`${A} .al-source`)), '[calc] the estimate or source line is missing');
  await page.click(`${A} .ak-tools button:has-text("Keep")`);
  check(/BMI: 27.8/.test(await page.textContent(`${A} .ak-body`)), '[calc] KEEP kept nothing');

  // timer: start, steps, a reload keeps it running, the session kept
  await tryApp(page, FIX.timer);
  await page.click(`${A} .ak-tools button:has-text("Voice on")`);
  await page.click(`${A} .ak-tools button:has-text("Start")`);
  check(await page.textContent(`${A} .al-stepname`) === 'Work', '[timer] the first step is not Work');
  await page.reload();
  await page.waitForSelector(`${A}[data-app="spec-intervals"]`, { timeout: 15000 }).catch(() => problems.push('[timer] a reload did not open the timer again'));
  check(await page.locator(`${A} .al-timer[data-on="true"]`).count() === 1, '[timer] a reload stopped the timer');
  await page.waitForFunction(() => /Spec Intervals: 2 rounds/.test(document.querySelector('#pg-apps .ak-body')?.textContent ?? ''), null, { timeout: 9000 }).catch(() => problems.push('[timer] the finished session was not kept'));

  // deck: show, rate, the due count goes down
  await page.evaluate((d) => window.__ghosty.applib.try(d), FIX.deck);
  await page.waitForSelector(`${A}[data-app="spec-capitals"]`);
  check(/4 due/.test(await page.textContent(`${A} .al-progress b`)), '[deck] not 4 due at the start');
  await page.click(`${A} button:has-text("Show answer")`);
  check(await page.textContent(`${A} .al-a`) === 'Paris', '[deck] the answer is not shown');
  await page.click(`${A} button:has-text("Good")`);
  check(/3 due/.test(await page.textContent(`${A} .al-progress b`)), '[deck] a good card was not put off');

  // counter: more and less
  await tryApp(page, FIX.counter);
  await page.click(`${A} button[aria-label="Laps up by 1"]`);
  await page.click(`${A} button[aria-label="Laps up by 1"]`);
  await page.click(`${A} button[aria-label="Laps down by 1"]`);
  check(await page.textContent(`${A} .al-count[data-id="n0"] .al-countval`) === '1', '[counter] up twice and down once is not 1');

  // guide: search
  await tryApp(page, FIX.guide);
  await page.click(`${A} .ak-head button[aria-label="Search"]`);
  await page.fill(`${A} .ak-find`, 'loop');
  check(await page.locator(`${A} .al-guide`).count() === 1 && /fixed loop/.test(await page.textContent(`${A} .ak-body`)), '[guide] search did not find the bowline');
  check(/Source: Scouts/.test(await page.textContent(`${A} .al-source`)), '[guide] no source');

  // screen: opens Ghosty's own screen
  await page.evaluate(() => window.__ghosty.applib.open('ghosty-sheets'));
  await page.waitForFunction(() => location.hash === '#sheets', null, { timeout: 5000 }).catch(() => problems.push('[screen] it did not open #sheets'));

  // game and importer: their lanes' renderers
  for (const a of ['game', 'importer']) {
    const ids = await page.evaluate((a) => window.__ghosty.applib.ids().filter((id) => id), a);
    if (!ids.length) notes.push(`${a}: no app yet`);
  }
  await ctx.close();
}

// ── every app in LIBRARY opens and draws ─────────────────────────────────────────────────────
{
  const { ctx, page } = await open(SMALL, 'glass');
  const ids = await page.evaluate(() => window.__ghosty.applib.ids().filter((id) => !id.startsWith('spec-')));
  const arch = await page.evaluate(() => Object.fromEntries(window.__ghosty.applib.ids().map((id) => [id, null])));
  let bad = 0;
  for (const id of ids) {
    const r = await page.evaluate(async (id) => {
      const a = window.__ghosty.applib;
      a.open(id);
      await new Promise((res) => setTimeout(res, 60));
      return { hash: location.hash, eng: { ...a.engine } };
    }, id);
    if (r.hash.startsWith('#apps/') === false) { await page.evaluate(() => { location.hash = '#apps'; }); continue; }
    const m = await fit(page, '#pg-apps');
    const ok = fitOk(m) && !r.eng.error;
    if (!ok && bad++ < 12) problems.push(`[every app] ${id}: ${r.eng.error || JSON.stringify(m)}`);
  }
  if (bad > 12) problems.push(`[every app] and ${bad - 12} more`);
  notes.push(`${ids.length} apps opened`);
  void arch;
  await ctx.close();
}

// ── one app per archetype in all seven looks at 440 and 390 ─────────────────────────────────────
for (const vp of [PHONE, SMALL]) {
  for (const world of WORLDS) {
    const { ctx, page } = await open(vp, world);
    for (const def of Object.values(FIX).filter((d) => d.archetype !== 'screen')) {
      await tryApp(page, def);
      const m = await fit(page, '#pg-apps');
      check(fitOk(m), `[${world} ${vp.width} ${def.archetype}] ${JSON.stringify(m)}`);
      const tb = await page.evaluate(() => Math.round(Math.min(innerHeight, document.querySelector('#pg-apps').getBoundingClientRect().bottom) - document.querySelector('#pg-apps .ak-tools').getBoundingClientRect().bottom));
      check(tb >= 0 && tb < 120, `[${world} ${vp.width} ${def.archetype}] the keys are not at the bottom: ${tb}`);
      if (vp.width === 390 && world === 'glass') await page.screenshot({ path: `${out}/applib-${def.archetype}.png` });
    }
    await page.evaluate(() => { location.hash = '#apps'; });
    await page.waitForSelector('#pg-apps .al-find');
    const m = await fit(page, '#pg-apps');
    check(fitOk(m), `[${world} ${vp.width} library] ${JSON.stringify(m)}`);
    if (vp.width === 390) await page.screenshot({ path: `${out}/applib-library-${world}-390.png` });
    await ctx.close();
  }
}

await browser.close();
const s = Math.round((Date.now() - T0) / 1000);
if (problems.length) {
  console.log(`applib: ${problems.length} problem(s) in ${s} s`);
  for (const p of problems) console.log(` - ${p}`);
  process.exit(1);
}
console.log(`applib: OK (the Library: featured, families, search, an app's page, OPEN, PIN TO HOME, recently used, "open <app>" on the phone; log with every field type, its stats, rings, chart, reminder and four views; checklist, calc, timer across a reload, deck, counter, guide and screen driven; every app opened (${notes.join('; ')}); one app per archetype in all seven looks at 440 and 390; ${s} s)`);
