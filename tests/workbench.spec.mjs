// THE WORKBENCH on the owner's phone (440 × 956; OWNER-ISSUES 61b): the MAKE area's engineering first estimates, by the
// in-house solvers on the phone (packages/shared/src/workbench) — no model, no fetch.
//  1. the tab opens from the MAKE hub and from #workbench; its sections are pills; every panel's default answer card is
//     there with the standing label FIRST ESTIMATE · NOT CERTIFIED;
//  2. the beam form at 3 m / 5 kN / steel 100×200 shows the textbook deflection (PL³/48EI) within 5 % and says "not
//     certified"; a change answers at once (4 m) with no button;
//  3. the units switch (SETTINGS) changes the display (feet, inches, pound-force), and back;
//  4. the chat, no model: "beam calculator" opens BEAM and "3 m steel beam 5 kN in the middle" is answered on the phone, with
//     no request to /api/chat; "how strong is a 3 m steel beam with 5 kn in the middle" goes to the brain (the mock model)
//     and its answer carries "First estimate";
//  5. nothing scrolls sideways, every row is 44 pt or more, and a reload keeps his inputs;
//  6. his screenshots (31 Oct), as Safari (no scroll anchoring): after picking AIR (the wind tunnel) or GEARS (Drive) from far
//     down the page, and after tapping a mode there, no mode button and no panel title is under the held section pills; and
//     with the wing changed last, the head over GEARS does not read "Wing".
// It changes only this browser's own storage and puts the units back.
//   BASE=http://localhost:8788 node tests/workbench.spec.mjs [outDir]
import { mkdirSync } from 'node:fs';
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const problems = [];
const check = (ok, what) => void (ok || problems.push(what));
const t0 = Date.now();

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined });
// (the service worker blocked: Chromium stops reporting a controlled page's requests, and this spec counts them)
const ctx = await browser.newContext({ viewport: PHONE, ...UK, serviceWorkers: 'block', hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
const chats = [];
await ctx.route('**/api/chat', (route) => {
  if (route.request().method() === 'POST') chats.push(route.request().postData() ?? '');
  return route.continue();
});

const boot = async () => {
  await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
  await page.waitForFunction(() => !!window.__ghosty, null, { timeout: 15000 });
};
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#pair input', { timeout: 20000 });
await page.fill('#pair input', KEY);
await page.click('#pair button.on');
await boot();
const until = (fn, arg, ms, what) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => (problems.push(what), false));
const W = () => page.evaluate(() => {
  const w = window.__ghosty.workbench;
  return w ? JSON.parse(JSON.stringify({ ready: w.ready, panel: w.panel, units: w.units, estimates: w.estimates, values: w.values })) : null;
});
const shot = async (name) => {
  await page.waitForTimeout(250);
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined)))).catch(() => undefined);
  await page.screenshot({ path: `${out}/${name}.png` });
};
const pill = (sec) => page.click(`#pg-workbench .secpill[data-sec="${sec}"]`);

// ---- 1. from the MAKE hub, and from #workbench
await page.evaluate(() => (location.hash = 'area-make'));
const tile = '#pg-area-make .hubtile[data-id="workbench"]';
await page.waitForSelector(tile, { state: 'visible', timeout: 10000 }).catch(() => problems.push('the MAKE hub has no Workbench card'));
const card = await page.$eval(tile, (e) => ({ t: e.querySelector('.t')?.textContent?.trim(), reads: [...e.querySelectorAll('.reads .rd')].map((d) => `${d.querySelector('em')?.textContent}=${d.querySelector('b')?.textContent}`) })).catch(() => null);
check(card?.t === 'Engineering estimates', `the hub card: ${JSON.stringify(card)}`);
await page.click(tile);
await until(() => document.body.dataset.tab === 'workbench' && window.__ghosty.workbench?.ready, null, 10000, 'the hub card did not open the Workbench');
await page.evaluate(() => (location.hash = 'core'));
await page.waitForTimeout(400);
await page.evaluate(() => (location.hash = 'workbench'));
await until(() => document.body.dataset.tab === 'workbench', null, 10000, '#workbench did not open it');
const pills = await page.$$eval('#pg-workbench .secpill', (ps) => ps.map((p) => p.textContent));
check(pills.join(',') === 'Wind tunnel,Structure,Drive,Flight,Home', `the sections: ${pills.join(',')}`);
// every panel's default answer, with its label (each section shown in turn)
const PANELS = { structure: ['beam', 'column'], drive: ['gears', 'engine'], flight: ['wing', 'projectile', 'orbit'], home: ['heat', 'sun', 'circuit'] };
for (const [sec, ids] of Object.entries(PANELS)) {
  await pill(sec);
  await page.waitForTimeout(200);
  for (const id of ids) {
    const c = await page.$eval(`#pg-workbench .pn.wb-${id}`, (p) => ({
      shown: !p.hidden && p.getClientRects().length > 0,
      label: p.querySelector('.wbcard .wblabel span')?.textContent ?? '',
      lines: p.querySelectorAll('.wbcard .wbline').length,
      problem: p.querySelector('.wbcard .wbproblem')?.textContent ?? '',
      caveat: p.querySelector('.wbcard .wbcaveat')?.textContent ?? '',
    })).catch(() => null);
    check(c?.shown, `[${id}] not shown under ${sec}`);
    check(c?.label === 'FIRST ESTIMATE · NOT CERTIFIED', `[${id}] the label reads "${c?.label}"`);
    check(c?.lines >= 2 && !c.problem, `[${id}] the default answer: ${c?.lines} lines, problem "${c?.problem}"`);
    check(/^First estimate, not certified — /.test(c?.caveat ?? ''), `[${id}] the caveat: "${c?.caveat}"`);
  }
  // nothing sideways; every row 44 pt or more
  const geo = await page.evaluate(() => {
    const vis = (e) => e.getClientRects().length > 0 && !e.closest('[hidden]');
    const rows = [...document.querySelectorAll('#pg-workbench :is(.wbf, .wbline, .wblabel, .wbconf, .wbfold > summary, .wbmodes button, .secpill)')].filter(vis);
    return {
      wide: document.documentElement.scrollWidth > innerWidth + 1 || [...document.querySelectorAll('#pg-workbench .pn.wb *')].filter(vis).some((e) => e.getBoundingClientRect().right > innerWidth + 1),
      short: rows.map((r) => ({ c: r.className || r.tagName, h: r.getBoundingClientRect().height, t: (r.textContent ?? '').slice(0, 30) })).filter((r) => r.h < 44 - 0.5),
      rows: rows.length,
    };
  });
  check(!geo.wide, `[${sec}] something sticks out sideways`);
  check(!geo.short.length, `[${sec}] rows under 44 pt: ${JSON.stringify(geo.short.slice(0, 4))}`);
  check(geo.rows > 10, `[${sec}] only ${geo.rows} rows measured`);
  await page.evaluate(() => document.querySelector('#pg-workbench .hud')?.scrollTo(0, 0));
  await shot(`workbench-${sec}`);
}

// ---- 2. the beam at 3 m, 5 kN in the middle, steel S275 100 × 200: PL³/48EI
await pill('structure');
const I = (0.1 * 0.2 ** 3) / 12;
const textbook = (P, L) => (P * L ** 3) / (48 * 210e9 * I);
const beamCard = () => page.$eval('#pg-workbench .pn.wb-beam .wbcard', (c) => ({ text: c.textContent, defl: [...c.querySelectorAll('.wbline')].find((l) => /Max deflection/.test(l.textContent))?.querySelector('.v')?.textContent ?? '' }));
let b = await beamCard();
const mm = (s) => { const m = /([\d.]+)\s*mm/.exec(s); return m ? Number(m[1]) / 1000 : NaN; };
const err = Math.abs(mm(b.defl) - textbook(5000, 3)) / textbook(5000, 3);
check(err <= 0.05, `the beam's deflection "${b.defl}" is ${(err * 100).toFixed(2)} % off PL³/48EI (${(textbook(5000, 3) * 1000).toFixed(4)} mm)`);
check(/not certified/.test(b.text), 'the beam card does not say "not certified"');
const vals = (await W()).values.beam.v;
check(vals.span === 3 && vals.load === 5000 && vals.material === 's275' && vals.shape === 'rect' && vals.b === 0.1 && vals.h === 0.2, `the beam's inputs: ${JSON.stringify(vals)}`);
// a change answers at once: 4 m
await page.fill('#wb-beam-beam-span', '4');
await until((want) => Math.abs((window.__ghosty.workbench.estimates.beam?.values?.deflection ?? 0) - want) < want * 0.01, textbook(5000, 4), 3000, 'changing the span to 4 m did not answer at once');
b = await beamCard();
check(Math.abs(mm(b.defl) - textbook(5000, 4)) / textbook(5000, 4) <= 0.05, `at 4 m the card reads "${b.defl}"`);
// a value with its own unit is read too ("5000 N" in a kN field)
await page.fill('#wb-beam-beam-load', '5000 N');
await page.waitForTimeout(200);
check((await W()).values.beam.v.load === 5000, '"5000 N" in the load was not read as 5 kN');

// ---- 3. the units switch: imperial, then back
await page.evaluate(() => window.__ghosty.settings.set({ units: 'imperial' }));
await until(() => window.__ghosty.workbench.units === 'imperial', null, 5000, 'the Workbench did not follow the units');
const imp = await page.evaluate(() => ({
  spanUnit: document.querySelector('#pg-workbench .pn.wb-beam .wbf[data-key="span"] .wbu')?.textContent,
  span: document.querySelector('#wb-beam-beam-span')?.value,
  defl: [...document.querySelectorAll('#pg-workbench .pn.wb-beam .wbline')].find((l) => /Max deflection/.test(l.textContent))?.querySelector('.v')?.textContent,
  load: document.querySelector('#pg-workbench .pn.wb-beam .wbf[data-key="load"] .wbu')?.textContent,
}));
check(imp.spanUnit === 'ft' && imp.span === '13.12' && / in$/.test(imp.defl ?? '') && imp.load === 'lbf', `in imperial: ${JSON.stringify(imp)}`);
await shot('workbench-imperial');
await page.evaluate(() => window.__ghosty.settings.set({ units: 'metric' }));
await until(() => window.__ghosty.workbench.units === 'metric' && document.querySelector('#wb-beam-beam-span')?.value === '4', null, 5000, 'back in metric, the span does not read 4');
await page.fill('#wb-beam-beam-span', '3');
await page.waitForTimeout(200);

// ---- 4. the chat, no model; then a question for the brain
await page.evaluate(() => (location.hash = 'core'));
await page.waitForSelector('#cin', { state: 'visible', timeout: 10000 });
const replies = () => page.evaluate(() => [...document.querySelectorAll('#pg-core .msg:not(.me)')].map((m) => m.textContent?.replace(/\s+/g, ' ').trim() ?? ''));
const say = async (t) => {
  await page.fill('#cin', t);
  await page.keyboard.press('Enter');
};
const before = chats.length;
await say('beam calculator');
await until(() => document.body.dataset.tab === 'workbench' && !document.querySelector('#pg-workbench .pn.wb-beam')?.hidden, null, 8000, '"beam calculator" did not open BEAM');
await page.evaluate(() => (location.hash = 'core'));
await page.waitForSelector('#cin', { state: 'visible', timeout: 10000 });
await say('3 m steel beam 5 kN in the middle');
await until(() => [...document.querySelectorAll('#pg-core .msg:not(.me)')].some((m) => /Max deflection: 0\.201 mm[\s\S]*First estimate, not certified/.test(m.textContent ?? '')), null, 8000, `"3 m steel beam 5 kN in the middle" was not answered on the phone: ${JSON.stringify((await replies()).slice(-1))}`);
await page.waitForTimeout(400);
check(chats.length === before, `the Workbench's own words went to the brain's chat ${chats.length - before} time(s)`);
await page.evaluate(() => (location.hash = 'core'));
await page.waitForSelector('#cin', { state: 'visible', timeout: 10000 });
const had = (await replies()).length;
await say('how strong is a 3 m steel beam with 5 kn in the middle');
// (a new reply, after the question: the phone's own answer above carries the same numbers)
await until((n) => [...document.querySelectorAll('#pg-core .msg:not(.me)')].slice(n).some((m) => /Max deflection: 0\.201 mm/.test(m.textContent ?? '') && /First estimate/.test(m.textContent ?? '') && /chartered engineer/.test(m.textContent ?? '')), had, 60000, `the brain's answer: ${JSON.stringify((await replies()).slice(-1))}`);
check(chats.length === before + 1, `the question went to the brain's chat ${chats.length - before} time(s), want once`);
await shot('workbench-chat');

// ---- 5. a reload keeps his inputs
await page.evaluate(() => (location.hash = 'workbench'));
await until(() => document.body.dataset.tab === 'workbench', null, 8000, 'back to the Workbench');
await pill('drive');
await page.fill('#wb-engine-engine-rpm', '6500');
await page.selectOption('#wb-engine-engine-type', 'turbo');
await page.waitForTimeout(200);
await page.reload({ waitUntil: 'domcontentloaded' });
await boot();
await until(() => document.body.dataset.tab === 'workbench' && window.__ghosty.workbench?.ready, null, 15000, 'the reload did not come back to the Workbench');
const kept = await page.evaluate(() => ({ rpm: document.querySelector('#wb-engine-engine-rpm')?.value, type: document.querySelector('#wb-engine-engine-type')?.value, sec: document.querySelector('#pg-workbench .secpills')?.dataset.current }));
check(kept.rpm === '6500' && kept.type === 'turbo', `after a reload the engine reads ${JSON.stringify(kept)}`);
check(kept.sec === 'drive', `after a reload the section is "${kept.sec}"`);

// ---- 6. his screenshots (31 Oct): after a section is picked its mode buttons and its first panel's title are never under the
// held pills, and the head shows that section's own latest estimate or nothing of its own (never the wing's over GEARS). As
// Safari, which has no scroll anchoring to hold the page when the head changes height.
await page.addStyleTag({ content: '*{overflow-anchor:none!important}' });
const under = () => page.evaluate(() => {
  const pills = document.querySelector('#pg-workbench .secpills')?.getBoundingClientRect();
  if (!pills) return ['no pills'];
  const vis = (e) => e.getClientRects().length > 0 && !e.closest('[hidden]');
  const hit = (e) => { const r = e.getBoundingClientRect(); return r.bottom > pills.top + 0.5 && r.top < pills.bottom - 0.5; };
  const modes = [...document.querySelectorAll('#pg-workbench .wbmodes button')].filter(vis).filter(hit).map((b) => `mode "${b.textContent}"`);
  const title = [...document.querySelectorAll('#pg-workbench .pn:not([hidden]) > h3')].filter(vis)[0];
  return [...modes, ...(title && hit(title) ? [`title "${title.textContent}"`] : [])];
});
const heroText = () => page.evaluate(() => document.querySelector('#pg-workbench .hero')?.textContent ?? '');
// the head is one height on every section, whatever it says: a head that grows shorter after a pick pulls the section's first
// panel up under the held pills where nothing holds the page (Safari)
const heads = [];
const headH = () => page.evaluate(() => document.querySelector('#pg-workbench .hero')?.getBoundingClientRect().height ?? 0);
for (const sec of ['tunnel', 'structure', 'drive', 'flight', 'home', 'tunnel']) {
  await pill(sec);
  await page.waitForTimeout(sec === 'tunnel' ? 1500 : 300);
  heads.push([sec, Math.round(await headH())]);
}
check(Math.max(...heads.map((x) => x[1])) - Math.min(...heads.map((x) => x[1])) <= 1, `the head changes height from section to section: ${heads.map((x) => x.join(' ')).join(', ')}`);
// the wing changed last (its lift on the head), then the page scrolled well down, as he would have
await pill('flight');
await page.waitForTimeout(250);
await page.fill('#wb-wing-wing-alpha', '4');
await until(() => /Wing/.test(document.querySelector('#pg-workbench .hero')?.textContent ?? ''), null, 3000, 'the wing\'s estimate is not on the head after changing it');
for (const [sec, what] of [['tunnel', 'AIR (the wind tunnel: Speed / Swirl)'], ['drive', 'GEARS (Gear train / Bicycle)']]) {
  await page.evaluate(() => document.querySelector('#pg-workbench .hud')?.scrollBy(0, 700));
  await page.waitForTimeout(250);
  await pill(sec);
  await page.waitForTimeout(500);
  const hidden = await under();
  check(!hidden.length, `after picking ${what}, under the section pills: ${hidden.join(', ')}`);
  if (sec === 'drive') {
    const t = await heroText();
    check(!/Wing/.test(t), `after choosing GEARS the head still reads the wing: "${t.replace(/\s+/g, ' ').slice(0, 120)}"`);
  }
  // and while it is there: the page scrolled to where the mode buttons sit just under the pills, then a mode tapped
  const modeBtn = sec === 'drive' ? '#pg-workbench .pn.wb-gears .wbmodes button[data-mode="bike"]' : '#pg-workbench .pn.wb-tunnel .wbmodes button[data-view="swirl"]';
  await page.evaluate((sel) => {
    const hud = document.querySelector('#pg-workbench .hud');
    const pills = document.querySelector('#pg-workbench .secpills')?.getBoundingClientRect();
    const b = document.querySelector(sel)?.getBoundingClientRect();
    if (hud && pills && b) hud.scrollBy(0, b.top - pills.bottom - 8);
  }, modeBtn);
  await page.waitForTimeout(250);
  await page.click(modeBtn);
  await page.waitForTimeout(400);
  const after = await under();
  check(!after.filter((x) => x.startsWith('mode')).length, `after tapping a mode under ${what}, under the section pills: ${after.join(', ')}`);
  await shot(`workbench-pills-${sec}`);
}
// back to Gear train for the next run
await page.click('#pg-workbench .pn.wb-gears .wbmodes button[data-mode="train"]').catch(() => undefined);

await browser.close();
console.log(`(workbench spec: ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
if (problems.length) {
  console.log(`PROBLEMS:\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('Workbench run clean: it opens from MAKE and #workbench, every panel answers with FIRST ESTIMATE · NOT CERTIFIED, the beam is PL³/48EI within 5 % and answers at once, imperial and back, the chat opens and answers with no model and the brain answers "how strong…" with "First estimate", nothing sideways, every row 44 pt, a reload keeps his inputs; after picking AIR or GEARS nothing is under the section pills, and the head over GEARS is not the wing’s.');
