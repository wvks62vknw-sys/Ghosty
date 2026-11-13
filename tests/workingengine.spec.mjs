// THE WORKING ENGINE (BRIEF-WORKING-ENGINE; OWNER-ISSUES 91a "i have this car and this is what's wrong with it", 164 and the audit's "the working
// 3-D engine") on the owner's iPhone (440 × 956 and 390 × 844, en-GB, Europe/London), against the real brain with the scripted model; the vehicle
// check is stubbed with a made-up plate (GH17 OST, a blue VW Golf, petrol, 1395 cc on its record):
//  a. "open the bonnet": the bay, the honest line (a typical four-cylinder petrol engine, a first estimate) said once, the ESTIMATE line once;
//     LIFT THE COVER shows the engine turning: the crank angle advances, two snapshots differ;
//  b. PAUSE stills it; STEP turns it a quarter and the strokes line changes (and goes round, in the firing order's words); the REVS dial changes the
//     rate; with Reduce Motion it is still at top dead centre and STEP works;
//  c. a tap on a piston lights it, its sheet names it with its numbers each marked (estimate, typical, from the record); "what is this?" answers
//     from the sheet with no brain;
//  d. TAKE APART at 50 % moves the head away and the pistons stay with their rods; SECTION cuts the casing (the hook lists the cut parts);
//     MEASURE between two taps gives a length in cm;
//  e. "the battery light is on" lights the alternator as before (and "it won't start" the battery and the starter);
//  f. the 3-D ENGINE's tray has ENGINE, placed on the ground, EXPORT's glTF names its meshes;
//  g. "how does an engine work" shows the Stage's part with the engine, and OPEN goes to the Studio with it turning;
//  h. the frame time printed, every control 44 pt, nothing sideways at 440 and 390, the ESTIMATE line once, no security-policy refusal.
//   BASE=http://localhost:8824 NO_GL_SHOTS=1 node tests/workingengine.spec.mjs [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { PHONE, UK } from './nav.mjs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const NOGL = !!process.env.NO_GL_SHOTS;
const SMALL = { width: 390, height: 844 };
const problems = [];
const check = (ok, what) => void (ok || problems.push(what));
const t0 = Date.now();
const lap = (what) => console.log(`  ${((Date.now() - t0) / 1000).toFixed(0)}s ${what}`);

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});

// ---- the vehicle check, stubbed: a made-up plate, shaped like the brain's answer (integrations/vehicle.ts)
const record = {
  plate: 'GH17 OST', make: 'VOLKSWAGEN', model: 'GOLF', colour: 'Blue', fuel: 'Petrol', firstUsed: '2017-03-28', engineCc: 1395, recall: 'No',
  mot: { state: 'valid', date: '2027-03-19', text: 'MOT valid until 19 Mar 2027' },
  tests: [{ date: '2026-03-20', result: 'PASSED', expiry: '2027-03-19', odometer: 61234, unit: 'mi', defects: [{ type: 'ADVISORY', text: 'Nearside Front Brake pad(s) wearing thin (1.1.13 (a) (ii))', dangerous: false }] }],
  mileage: { last: 61234, unit: 'mi', at: '2026-03-20', points: [], drops: [] }, advisories: 1, verdict: 'MOT valid until 19 Mar 2027', sources: ['DVSA MOT history'],
};
const links = [{ title: 'MOT history (GOV.UK)', url: 'https://www.gov.uk/check-mot-history' }];
const FACTS = { plate: 'GH17 OST', make: 'VOLKSWAGEN', model: 'GOLF', colour: 'Blue', fuel: 'Petrol', year: 2017, engineCc: 1395 };

/** A phone signed in: the vehicle check stubbed, the brain's calls counted, the Stage's switch on (the Stage shows only for a test that asks). */
async function open({ size = PHONE, reduced = false, name = 'main' } = {}) {
  const ctx = await browser.newContext({ viewport: size, ...UK, hasTouch: true, serviceWorkers: 'block', permissions: ['camera'], ...(reduced ? { reducedMotion: 'reduce' } : {}) });
  await ctx.addInitScript((k) => {
    window.__ghostyCards = true;
    window.__ghostyShow = true;
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
    try {
      localStorage.setItem('ghosty.ownerKey', k);
      if (!localStorage.getItem('ghosty.settings')) localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Boss', speak: false, sounds: false, home: { name: 'Birmingham', lat: 52.4862, lon: -1.8904 } }));
    } catch { /* a sandboxed frame */ }
  }, KEY);
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  const bodies = [];
  await page.route('**/api/chat', (route) => {
    try { bodies.push(JSON.parse(route.request().postData() ?? '{}')); } catch { /* not json */ }
    return route.continue();
  });
  await page.route('**/api/vehicle', async (route) => {
    const body = route.request().postDataJSON();
    if (body.plate === 'GH17OST') return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify({ ok: true, report: record, text: 'Vehicle GH17 OST…', links }) });
    return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ ok: false, reason: 'not_found', message: `No vehicle with the plate ${body.plate} is on record.`, links }) });
  });
  page.on('pageerror', (e) => problems.push(`[${name}] pageerror: ${e.message}`));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/favicon|net::ERR|404|Failed to load resource|^[WI]\d{4} |^INFO:|Failed to fetch|NotAllowed/.test(t)) problems.push(`[${name}] console: ${t.slice(0, 200)}`);
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
  await page.waitForFunction(() => document.body.dataset.tab === 'core' && !!window.__ghosty?.send, null, { timeout: 30000 }).catch(() => problems.push(`[${name}] Home did not open`));
  await page.waitForTimeout(800);
  return { ctx, page, bodies };
}
const until = (page, fn, arg, ms, what) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => (problems.push(what), false));
const E = (page) => page.evaluate(() => window.__ghosty.car?.engine?.state() ?? null);
const C = (page) => page.evaluate(() => window.__ghosty.car?.state() ?? null);
const say = (page, words) => page.evaluate((t) => window.__ghosty.send(t, false), words);
const lastReply = (page) => page.evaluate(() => [...document.querySelectorAll('.msg:not(.me)')].at(-1)?.textContent ?? '');
const openChat = async (page) => {
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(600);
  if (!(await page.evaluate(() => document.querySelector('#pg-core .hud.core')?.classList.contains('logopen')))) await page.click('.logbtn').catch(() => undefined);
  await page.waitForTimeout(400);
};
const type = async (page, words) => {
  await page.fill('#cin', words);
  await page.press('#cin', 'Enter');
};
/** The car's bay by the plate, as he would: the plate typed, SHOW THE CAR, "open the bonnet" (no model). */
async function bonnet(page) {
  await openChat(page);
  await type(page, 'GH17 OST');
  await until(page, () => [...document.querySelectorAll('#pg-core .ccard[data-kind="car"]')].some((c) => /That's a plate/.test(c.textContent ?? '')), null, 25000, 'a plate typed: no CAR offer');
  await page.locator('#pg-core .ccard[data-kind="car"]:not(.wall) .ccacts button', { hasText: 'SHOW THE CAR' }).last().click();
  await until(page, () => !!document.querySelector('#pg-core .ccard[data-kind="car"] input.ccfixin'), null, 15000, 'the CAR card has no WHAT’S WRONG? box');
  await openChat(page);
  await type(page, 'open the bonnet');
  return until(page, () => { const s = window.__ghosty.car?.state(); return s?.on && s.view === 'bay' && !s.moving && s.pose.bonnet > 1 && !!s.engine; }, null, 90000, `"open the bonnet": no bay view with an engine (${JSON.stringify(await C(page))?.slice(0, 200)})`);
}
/** The car pane straight in the bay (the second phone, the reduced-motion one): the car shown by its facts, no chat. */
async function bay(page) {
  await page.evaluate(() => (location.hash = 'studio'));
  await page.waitForFunction(() => !!window.__ghosty?.car && !!window.__ghosty?.studio, null, { timeout: 30000 });
  await page.evaluate((f) => { window.__ghosty.car.show(f); window.__ghosty.studio.loadSample('car'); }, FACTS);
  await page.waitForFunction(() => window.__ghosty.car.state().ready && window.__ghosty.car.state().on, null, { timeout: 90000 }).catch(() => problems.push('the car did not come up in the Studio'));
  await page.evaluate(() => window.__ghosty.car.view('bay'));
  return until(page, () => { const s = window.__ghosty.car.state(); return s.view === 'bay' && !s.moving && s.pose.bonnet > 1 && !!s.engine; }, null, 60000, `the bay did not open (${JSON.stringify(await C(page))?.slice(0, 160)})`);
}
const wide = (page, root = '#pg-studio .hud.studio') =>
  page.evaluate((r) => {
    const o = [];
    if (document.documentElement.scrollWidth > innerWidth + 1) o.push('page');
    for (const el of document.querySelectorAll(`${r} *`)) {
      const b = el.getBoundingClientRect();
      if (b.width && el.getClientRects().length && (b.right > innerWidth + 2 || b.left < -2)) o.push(`${el.tagName}.${el.className} ${Math.round(b.left)}–${Math.round(b.right)}`);
    }
    return o.slice(0, 5);
  }, root);
/** Every control of the engine's block, its size on the page. */
const controls = (page) =>
  page.$$eval('#pg-studio .carengine :is(button, input)', (els) => els.filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map((e) => ({ what: e.getAttribute('aria-label') || e.textContent?.trim() || e.className, h: Math.round(e.getBoundingClientRect().height), w: Math.round(e.getBoundingClientRect().width) })));
/** One part of the run; a crash in it is a failure on the list (with its name), not the end of the run. */
async function section(name, fn) {
  try {
    await fn();
  } catch (e) {
    problems.push(`[${name}] stopped: ${String(e?.message ?? e).split('\n')[0].slice(0, 200)}`);
  }
}
/** A tap on the car's canvas at page coordinates, as one down and one up in the same moment (the slow software renderer can hold the page for a second between two real clicks, and a tap that long is a press). */
const tapAt = (page, x, y) =>
  page.evaluate(([x, y]) => {
    const c = document.querySelector('#pg-studio canvas.carcanvas');
    const o = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0 };
    c.dispatchEvent(new PointerEvent('pointerdown', { ...o, buttons: 1 }));
    c.dispatchEvent(new PointerEvent('pointerup', { ...o, buttons: 0 }));
  }, [x, y]);
const stageShot = async (page, file) => {
  if (NOGL) return null;
  return page.locator('#pg-studio .carstage').screenshot({ path: file }).catch(() => null);
};

// ================================================================ a to e, h: one phone at 440, by the plate (then 390)
await section('a to e, h at 440', async () => {
  const { ctx, page, bodies } = await open({ size: PHONE, name: '440' });
  lap('phone open');
  if (await bonnet(page)) {
    lap('the bonnet is open');
    // ---- a. the bay: the honest line once, the estimate once
    const words = await page.evaluate(() => {
      const leaf = [...document.querySelectorAll('#pg-studio *')].filter((e) => e.children.length === 0);
      const n = (re) => leaf.filter((e) => re.test(e.textContent ?? '')).length;
      return {
        honest: n(/^A typical four-cylinder petrol engine for a car like yours, a first estimate; not your exact engine\.$/),
        standIn: n(/^A stand-in: the shape/),
        estimate: n(/^Every size here is a first estimate, never certified\.$/),
        lift: [...document.querySelectorAll('#pg-studio .carcover')].map((b) => b.textContent),
        intro: document.querySelector('#pg-studio .carengintro')?.textContent ?? '',
      };
    });
    check(words.honest === 1, `the honest line (a typical four-cylinder petrol engine…) is said ${words.honest} times`);
    check(words.standIn === 0, `the old "a stand-in" line is still said in the bay (${words.standIn})`);
    check(words.estimate === 1, `the ESTIMATE line is on the view ${words.estimate} times`);
    check(words.lift.length === 1 && words.lift[0] === 'LIFT THE COVER' && /Under the cover is the engine/.test(words.intro), `the cover's key and its words: ${JSON.stringify(words)}`);
    let e = await E(page);
    check(e?.layout === 'I4' && e.cylinders === 4 && e.cc === 1395 && e.ccFrom === 'record' && /four-cylinder petrol/.test(e.words), `the engine from the record: ${JSON.stringify({ l: e?.layout, c: e?.cc, f: e?.ccFrom, w: e?.words })}`);
    check(e?.firing === '1-3-4-2' && e.bore > 60 && e.bore < 85 && e.stroke > 60 && e.stroke < 90, `its firing order and its bore and stroke: ${e?.firing} ${e?.bore} × ${e?.stroke}`);
    check(e?.cover === 0 && e.pieces > 50, `the cover is on and the engine has its parts: ${e?.cover} ${e?.pieces}`);
    await stageShot(page, `${out}/engine-covered.png`);

    // ---- LIFT THE COVER: the engine turning
    await page.locator('#pg-studio .carcover').click();
    await until(page, () => window.__ghosty.car.engine.state().cover >= 0.99, null, 20000, 'LIFT THE COVER did not lift the cover');
    check((await page.evaluate(() => document.querySelector('#pg-studio .carcover')?.textContent)) === 'PUT THE COVER BACK', 'the cover’s key does not say PUT THE COVER BACK once it is up');
    lap('cover lifted');
    const turned0 = (await E(page)).turned;
    const f0 = (await C(page)).frames;
    const s1 = NOGL ? null : await page.locator('#pg-studio .carstage').screenshot().catch(() => null);
    // (the software renderer can take a second or two to draw a frame on this machine: wait for the crank to move, not for a clock)
    await until(page, (t) => window.__ghosty.car.engine.state().turned > t + 20, turned0, 40000, 'the crank did not advance in forty seconds');
    const s2 = NOGL ? null : await page.locator('#pg-studio .carstage').screenshot().catch(() => null);
    e = await E(page);
    check(e.turned > turned0 + 20, `the crank did not advance: ${turned0} → ${e.turned}`);
    check((await C(page)).frames > f0, 'no frames were drawn while the engine turned');
    if (s1 && s2) check(!s1.equals(s2), 'two snapshots of the engine are the same: it is not turning');
    check(e.rpm === 800 && !e.paused && !e.reduced, `idle by default: ${JSON.stringify({ r: e.rpm, p: e.paused, d: e.reduced })}`);
    await stageShot(page, `${out}/engine-lifted.png`);
    // the frame time over a longer run than the first frames (the first ones compile their shaders)
    await until(page, (f) => window.__ghosty.car.state().frames > f + 30, (await C(page)).frames, 90000, 'the engine drew fewer than thirty frames in ninety seconds');
    const frame = await C(page);
    console.log(`workingengine: frame time ${frame.frameMs} ms, p95 ${frame.frameP95} ms (drawing ${frame.drawMs} ms) over ${frame.frames} frames in this browser's software renderer, engine lifted and turning (${e.pieces} parts)`);

    // the words of the strokes: one line, cylinder one named, the four in order, the firing order under it
    const sline = await page.evaluate(() => ({ name: document.querySelector('#pg-studio .carstroke')?.textContent ?? '', say: document.querySelector('#pg-studio .carstrokesay')?.textContent ?? '', crank: document.querySelector('#pg-studio .carcrank')?.textContent ?? '', fire: document.querySelector('#pg-studio .carfirelabel')?.textContent ?? '', chips: [...document.querySelectorAll('#pg-studio .carfirechip')].map((c) => c.textContent), on: document.querySelectorAll('#pg-studio .carfirechip.on').length }));
    check(/^CYLINDER 1 · (INTAKE|COMPRESSION|POWER|EXHAUST)$/.test(sline.name) && /intake|INTAKE/.test(sline.say) && /compression|COMPRESSION/.test(sline.say) && /power|POWER/.test(sline.say) && /exhaust|EXHAUST/.test(sline.say), `the strokes line: ${JSON.stringify(sline)}`);
    check(sline.fire === 'FIRING ORDER 1-3-4-2' && sline.chips.join('') === '1342' && sline.on >= 1, `the firing order under it: ${JSON.stringify(sline)}`);

    // ---- b. PAUSE stills it; STEP a quarter turn; the strokes line changes
    await page.locator('#pg-studio .carpause').click();
    await page.waitForTimeout(250);
    const p0 = await E(page);
    await page.waitForTimeout(700);
    const p1 = await E(page);
    check(p0.paused && p1.crank === p0.crank && p1.turned === p0.turned, `PAUSE did not still it: ${p0.crank} → ${p1.crank}`);
    check((await page.evaluate(() => document.querySelector('#pg-studio .carpause')?.textContent)) === 'PLAY', 'PAUSE does not turn into PLAY');
    const lines = [];
    let prev = await E(page);
    const wantStroke = (c) => (c % 720 < 180 ? 'POWER' : c % 720 < 360 ? 'EXHAUST' : c % 720 < 540 ? 'INTAKE' : 'COMPRESSION');
    for (let i = 0; i < 4; i++) {
      const before = await page.evaluate(() => window.__ghosty.car.engine.line());
      await page.locator('#pg-studio .carstep').click();
      await page.waitForFunction((b) => window.__ghosty.car.engine.line() !== b, before, { timeout: 5000 }).catch(() => problems.push(`STEP ${i + 1}: the strokes line did not change`));
      const now = await E(page);
      const d = (((now.crank - prev.crank) % 720) + 720) % 720;
      check(Math.abs(d - 90) < 0.6, `STEP ${i + 1} turned ${d}°, not a quarter turn`);
      check(now.stroke1 === wantStroke(now.crank) || Math.abs((now.crank % 180)) < 1.5 || Math.abs((now.crank % 180) - 180) < 1.5, `at ${now.crank}° cylinder one says ${now.stroke1}, not ${wantStroke(now.crank)}`);
      lines.push(`${now.stroke1}@${Math.round(now.crank)}`);
      prev = now;
    }
    check(new Set(lines).size === 4 && new Set(lines.map((l) => l.split('@')[0])).size >= 2, `the strokes line did not go round over four steps: ${lines.join(' ')}`);
    // the REVS dial: faster when up
    await page.locator('#pg-studio .carpause').click();
    const rate = async (rpm) => {
      await page.evaluate((r) => window.__ghosty.car.engine.rpm(r), rpm);
      await page.waitForTimeout(300);
      const a = await E(page);
      const ta = Date.now();
      await page.waitForTimeout(2200);
      const b = await E(page);
      return (b.turned - a.turned) / ((Date.now() - ta) / 1000);
    };
    const slow = await rate(600);
    const fast = await rate(3000);
    check(slow > 0 && fast > slow * 2.5, `REVS did not change the rate: ${slow.toFixed(0)}°/s at 600 and ${fast.toFixed(0)}°/s at 3000`);
    // the dial itself: 44 pt, 600 to 6000, its words
    const dial = await page.evaluate(() => { const r = document.querySelector('#pg-studio .carrevs'); return { min: r?.min, max: r?.max, h: Math.round(r?.getBoundingClientRect().height ?? 0), out: document.querySelector('#pg-studio .carrevout')?.textContent ?? '', label: r?.getAttribute('aria-label') }; });
    check(dial.min === '600' && dial.max === '6000' && dial.h >= 44 && /slowed 20×/.test(dial.out), `the REVS dial: ${JSON.stringify(dial)}`);
    await page.evaluate(() => window.__ghosty.car.engine.rpm(800));
    await page.evaluate(() => window.__ghosty.car.engine.pause(true));
    lap('strokes, pause, step and revs done');

    // ---- c. a tap on a piston lights it; its sheet names it, numbers marked; "what is this?" with no brain
    await page.evaluate(() => window.__ghosty.car.engine.step(0));
    let tapped = '';
    for (const inst of ['Piston 2', 'Piston 3', 'Piston 1', 'Piston 4']) {
      const at = await page.evaluate((i) => window.__ghosty.car.engine.screenOf(i), inst);
      if (!at) continue;
      await tapAt(page, at.x, at.y);
      await page.waitForTimeout(250);
      const s = await E(page);
      if (/^Piston \d$/.test(s.selected)) {
        tapped = s.selected;
        break;
      }
    }
    check(!!tapped, 'a tap on a piston did not light a piston (the casing is see-through: the tap goes through it)');
    e = await E(page);
    const sheet = await page.evaluate(() => { const s = document.querySelector('#pg-studio .carsheet'); return { part: s?.dataset.part, inst: s?.dataset.inst, text: s?.innerText ?? '' }; });
    check(sheet.part === 'piston' && sheet.inst === tapped && new RegExp(`^${tapped}\\b`).test(sheet.text), `the sheet does not name the piston: ${JSON.stringify(sheet).slice(0, 160)}`);
    const nums = await page.$$eval('#pg-studio .carsheet .carnums li', (l) => l.map((x) => x.textContent ?? ''));
    check(nums.length >= 3 && nums.every((n) => /\b(estimate|typical|from the MOT record)\b/.test(n)) && nums.some((n) => /Bore \d+ mm, an estimate/.test(n)) && nums.some((n) => /Compression ratio [\d.]+ to 1, typical/.test(n)), `the piston's numbers are not each marked: ${JSON.stringify(nums)}`);
    check(/WHAT IT IS/.test(sheet.text) && /A 30-SECOND CHECK/.test(sheet.text) && /A ROUGH COST\s+£[\d,]+–£[\d,]+: .*A first estimate, not a quote\./.test(sheet.text) && !/certified/i.test(sheet.text), `the piston's sheet: ${sheet.text.slice(0, 200)}`);
    check(e.selected === tapped, `the piston is not lit: ${e.selected}`);
    const calls = bodies.length;
    await say(page, 'what is this?');
    await until(page, () => [...document.querySelectorAll('.msg:not(.me)')].some((m) => /piston/i.test(m.textContent ?? '') && /estimate/.test(m.textContent ?? '')), null, 15000, `"what is this?" with a piston lit did not answer from its sheet: ${await lastReply(page)}`);
    check(bodies.length === calls, '"what is this?" went to the brain');
    const reply = await lastReply(page);
    check(new RegExp(tapped).test(reply) && /Bore \d+ mm, an estimate/.test(reply), `the answer does not name it and give its numbers: ${reply.slice(0, 200)}`);
    lap('piston tapped, what is this');

    // ---- d. TAKE APART at 50 %: the head moves away from the block, the pistons stay with their rods
    await page.evaluate(() => window.__ghosty.car.engine.pause(true));
    const before = await E(page);
    await page.evaluate(() => { const r = document.querySelector('#pg-studio .carapart'); r.value = '50'; r.dispatchEvent(new Event('input', { bubbles: true })); });
    const mid = await E(page);
    const part = (st, inst) => st.parts.find((p) => p.inst === inst);
    const headGap = (st) => part(st, 'Cylinder head').origin[1] - part(st, 'Engine block').origin[1];
    check(Math.abs(mid.explode - 0.5) < 0.01 && headGap(mid) - headGap(before) > 0.05, `TAKE APART at 50 % did not move the head from the block: ${headGap(before).toFixed(3)} → ${headGap(mid).toFixed(3)} m`);
    const blockMoved = Math.hypot(...part(mid, 'Engine block').origin.map((v, k) => v - part(before, 'Engine block').origin[k]));
    check(blockMoved < 1e-4 && part(mid, 'Cylinder head').fly >= 0.5, `the block stays, the head goes first: the block moved ${blockMoved}, the head has flown ${part(mid, 'Cylinder head').fly}`);
    for (let i = 1; i <= 4; i++) {
      const dp = part(mid, `Piston ${i}`).origin.map((v, k) => v - part(before, `Piston ${i}`).origin[k]);
      const dr = part(mid, `Connecting rod ${i}`).origin.map((v, k) => v - part(before, `Connecting rod ${i}`).origin[k]);
      check(dp.every((v, k) => Math.abs(v - dr[k]) < 1e-3) && Math.hypot(...dp) > 0.003, `piston ${i} did not stay with its rod: ${dp.map((v) => v.toFixed(3))} vs ${dr.map((v) => v.toFixed(3))}`);
      check(part(mid, `Piston ${i}`).fly === part(mid, `Connecting rod ${i}`).fly, `piston ${i} and its rod fly by different amounts`);
    }
    check(part(mid, 'Inlet valve 1').fly > 0 && part(mid, 'Inlet valve 1').fly < part(mid, 'Cylinder head').fly, 'the valves and cams go after the head');
    await stageShot(page, `${out}/engine-apart.png`);
    // SECTION: the casing cut along the cylinders, the pistons and valves seen working
    await page.evaluate(() => window.__ghosty.car.engine.explode(0));
    await page.locator('#pg-studio .carsection').click();
    await page.waitForTimeout(300);
    e = await E(page);
    check(e.section && e.cut.slice().sort().join() === 'block,head,sump', `SECTION did not cut the casing: ${JSON.stringify({ s: e.section, c: e.cut })}`);
    check((await page.evaluate(() => document.querySelector('#pg-studio .carsection')?.getAttribute('aria-pressed'))) === 'true', 'SECTION does not say it is on');
    await page.evaluate(() => window.__ghosty.car.engine.pause(false));
    const secA = (await E(page)).turned;
    await page.waitForTimeout(900);
    check((await E(page)).turned > secA + 10, 'the pistons and valves do not work in the cut-open engine');
    await stageShot(page, `${out}/engine-section.png`);
    await page.evaluate(() => window.__ghosty.car.engine.pause(true));
    // MEASURE: two taps, a length in cm
    await page.locator('#pg-studio button.carmeasure').click();
    check((await E(page)).measuring, 'MEASURE did not switch on');
    check(/TAP POINT 1 OF 2/.test(await page.evaluate(() => document.querySelector('#pg-studio button.carmeasure')?.textContent ?? '')), 'MEASURE does not say to tap point 1 of 2');
    let measured = null;
    for (const [a, b] of [['Crankshaft', 'Flywheel'], ['Engine block', 'Sump'], ['Crank pulley', 'Alternator'], ['Piston 1', 'Piston 4']]) {
      const pa = await page.evaluate((i) => window.__ghosty.car.engine.screenOf(i), a);
      const pb = await page.evaluate((i) => window.__ghosty.car.engine.screenOf(i), b);
      if (!pa || !pb) continue;
      await tapAt(page, pa.x, pa.y);
      await page.waitForTimeout(200);
      await tapAt(page, pb.x, pb.y);
      await page.waitForTimeout(250);
      const s = await E(page);
      if (s.points === 2 && s.cm !== null) {
        measured = s.cm;
        break;
      }
    }
    check(measured !== null && measured > 0 && measured < 300, `MEASURE between two taps gave no length in cm (${measured})`);
    const mtext = await page.evaluate(() => document.querySelector('#pg-studio .carmeasured')?.textContent ?? '');
    check(/cm between the two points, an estimate/.test(mtext), `the length is not said with its word: ${mtext}`);
    await page.locator('#pg-studio button.carmeasure').click();
    lap('take apart, section, measure');
    // PUT THE COVER BACK clears all of it
    await page.evaluate(() => window.__ghosty.car.engine.section(false));

    // ---- h. every control 44 pt, nothing sideways at 440
    const cs = await controls(page);
    check(cs.length >= 7 && cs.every((c) => c.h >= 44), `a control is under 44 pt: ${JSON.stringify(cs.filter((c) => c.h < 44))}`);
    check(!(await wide(page)).length, `the engine block sticks out sideways at 440: ${(await wide(page)).join(', ')}`);
    await page.screenshot({ path: `${out}/engine-440.png` }).catch(() => undefined);

    // ---- e. "the battery light is on": the alternator lit, as before
    await openChat(page);
    await say(page, 'the battery light is on');
    await until(page, () => /Likely: the alternator is not charging/.test([...document.querySelectorAll('#pg-core .ccard[data-kind="car"]')].at(-1)?.textContent ?? ''), null, 20000, '"the battery light is on": the card has no suspect');
    await page.locator('#pg-core .ccard[data-kind="car"]:not(.wall) .ccacts button', { hasText: 'SHOW ME' }).last().click();
    await until(page, () => { const s = window.__ghosty.car?.state(); return s?.on && s.view === 'bay' && !s.moving && s.lit[0] === 'alternator'; }, null, 60000, 'SHOW ME for the battery light: no bay view with the alternator lit');
    const bl = await C(page);
    check(['alternator', 'drive_belt', 'battery_terminals'].every((id) => bl?.lit.includes(id)), `the battery light lights ${bl?.lit}`);
    check(!!(await page.evaluate(() => window.__ghosty.car.screenOf('alternator'))), 'the lit alternator is not on screen');
    check((await page.$$eval('#pg-studio .carpin', (p) => p.map((x) => x.getAttribute('aria-label')))).some((l) => /Alternator/.test(l ?? '')), 'no pin on the alternator');
    await stageShot(page, `${out}/engine-battery.png`);
    // then "the car won't start, it just clicks": the battery and the starter
    await openChat(page);
    await say(page, "the car won't start, it just clicks");
    await until(page, () => /flat battery/i.test([...document.querySelectorAll('#pg-core .ccard[data-kind="car"]')].at(-1)?.textContent ?? ''), null, 20000, '"it won’t start": the card has no flat battery');
    await page.locator('#pg-core .ccard[data-kind="car"]:not(.wall) .ccacts button', { hasText: 'SHOW ME' }).last().click();
    await until(page, () => { const s = window.__ghosty.car?.state(); return s?.on && s.view === 'bay' && !s.moving && s.lit.includes('starter') && s.lit.includes('battery'); }, null, 60000, '"it won’t start": the battery and the starter are not both lit in the bay');
    check(!!(await page.evaluate(() => window.__ghosty.car.screenOf('starter'))), 'the starter is lit but not on screen in the bay');
    lap('the battery light, the starter');
  }
  // ---- the same phone at 390 × 844 (the cover was lifted a moment ago; the engine is on show in the bay, the battery light's alternator lit)
  await page.setViewportSize(SMALL);
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__ghosty.car.engine.lift(true));
  await until(page, () => window.__ghosty.car.engine.state().cover >= 0.99, null, 20000, '[390] the cover is not up');
  await page.waitForTimeout(500);
  {
    const cs = await controls(page);
    check(cs.length >= 7 && cs.every((c) => c.h >= 44), `[390] a control is under 44 pt: ${JSON.stringify(cs.filter((c) => c.h < 44))}`);
    const side = await wide(page);
    check(!side.length, `[390] the engine block sticks out sideways: ${side.join(', ')}`);
    const words = await page.evaluate(() => ({ est: [...document.querySelectorAll('#pg-studio *')].filter((e) => e.children.length === 0 && /^Every size here is a first estimate, never certified\.$/.test(e.textContent ?? '')).length, line: document.querySelector('#pg-studio .carstandin')?.textContent ?? '' }));
    check(words.est === 1 && /typical four-cylinder petrol engine for a car like yours, a first estimate; not your exact engine\./.test(words.line), `[390] the words: ${JSON.stringify(words)}`);
    await page.evaluate(() => window.__ghosty.car.engine.pause(false));
    const t = (await E(page)).turned;
    await page.waitForTimeout(1200);
    check((await E(page)).turned > t + 10, '[390] the engine is not turning');
    const unnamed = await page.$$eval('#pg-studio .carengine :is(button, input)', (els) => els.filter((e) => e.getClientRects().length && !((e.getAttribute('aria-label') || e.textContent || '').trim())).length);
    check(unnamed === 0, `[390] ${unnamed} controls have no name`);
    await page.screenshot({ path: `${out}/engine-390.png` }).catch(() => undefined);
    await page.evaluate(() => window.__ghosty.car.engine.lift(false));
    await until(page, () => window.__ghosty.car.engine.state().cover <= 0.01, null, 20000, '[390] PUT THE COVER BACK did not put it back');
    check(await page.evaluate(() => document.querySelector('#pg-studio .carengctl')?.hidden === true), '[390] the controls stay when the cover is on');
    lap('390 done');
  }
  const csp = await page.evaluate(() => window.__csp);
  check(!csp.length, `the security policy blocked: ${csp.join(' | ')}`);
  await ctx.close();
});

// ================================================================ reduced motion: still at top dead centre, STEP works
await section('reduced motion', async () => {
  const { ctx, page } = await open({ size: PHONE, reduced: true, name: 'reduced' });
  if (await bay(page)) {
    await page.locator('#pg-studio .carcover').click();
    await until(page, () => window.__ghosty.car.engine.state().cover >= 0.99, null, 20000, '[reduced] LIFT THE COVER did not lift the cover at once');
    await page.waitForTimeout(1000);
    let e = await E(page);
    check(e.reduced && e.paused && e.crank === 0 && e.turned === 0 && e.stroke1 === 'POWER', `[reduced] it is not still at top dead centre: ${JSON.stringify({ r: e.reduced, p: e.paused, c: e.crank, t: e.turned, s: e.stroke1 })}`);
    const ui = await page.evaluate(() => ({ pause: document.querySelector('#pg-studio .carpause')?.hidden, note: document.querySelector('#pg-studio .carmotion')?.textContent ?? '' }));
    check(ui.pause === true && /Reduce Motion is on, so it stays still: STEP turns it a quarter at a time\./.test(ui.note), `[reduced] its words: ${JSON.stringify(ui)}`);
    const l0 = await page.evaluate(() => window.__ghosty.car.engine.line());
    await page.locator('#pg-studio .carstep').click();
    await page.waitForTimeout(300);
    e = await E(page);
    const l1 = await page.evaluate(() => window.__ghosty.car.engine.line());
    check(e.crank === 90 && l1 !== l0 && e.stroke1 === 'POWER', `[reduced] STEP: ${e.crank}° ${l0} → ${l1}`);
    await page.locator('#pg-studio .carstep').click();
    await page.locator('#pg-studio .carstep').click();
    await page.waitForTimeout(300);
    e = await E(page);
    check(e.crank === 270 && e.stroke1 === 'EXHAUST', `[reduced] three steps: ${e.crank}° ${e.stroke1}`);
  }
  await ctx.close();
});

// ================================================================ f. the 3-D ENGINE's tray has ENGINE
await section('f. the tray', async () => {
  const { ctx, page } = await open({ size: PHONE, name: 'tray' });
  await page.evaluate(() => (location.hash = 'studio'));
  await page.waitForSelector('#pg-studio .studioseg button[data-pane="engine"]', { timeout: 30000 });
  await page.click('#pg-studio .studioseg button[data-pane="engine"]');
  await until(page, () => window.__ghosty?.engine3d?.state().ready === true && window.__ghosty.engine3d.state().size.h > 100, null, 30000, '[f] the 3-D engine never became ready');
  const tray = await page.$$eval('#pg-studio .e3card', (c) => c.map((x) => x.textContent?.trim() ?? ''));
  check(tray.some((t) => /^Engine/.test(t)) && tray.length >= 15, `[f] the tray has no ENGINE: ${tray.join(' | ')}`);
  // armed from its card, then a tap on the ground: it stands there
  await page.locator('#pg-studio .e3card', { hasText: /^Engine/ }).first().click();
  check((await page.evaluate(() => window.__ghosty.engine3d.state().armed)) === 'Engine', '[f] a tap on ENGINE did not arm it');
  const at = await page.evaluate(() => window.__ghosty.engine3d.screenOf(0, 0, 0));
  await page.touchscreen.tap(at.x, at.y);
  await until(page, () => window.__ghosty.engine3d.state().objects.some((o) => o.kind === 'engine'), null, 10000, '[f] a tap on the ground did not place the engine');
  const s = await page.evaluate(() => JSON.parse(JSON.stringify(window.__ghosty.engine3d.state(), (k, v) => (k === 'scene' ? undefined : v))));
  const o = s.objects.find((x) => x.kind === 'engine');
  check(o && o.w === 120 && o.d === 60 && o.h === 70 && o.y === 0 && o.mat === 'steel', `[f] the engine is not 120 × 60 × 70 cm on the ground: ${JSON.stringify(o)}`);
  check(s.drawn === s.objects.length, `[f] ${s.drawn} things drawn for ${s.objects.length}`);
  // resizable: typed in cm
  await page.fill('.e3num[data-key="w"]', '90');
  await page.press('.e3num[data-key="w"]', 'Tab');
  check((await page.evaluate((id) => window.__ghosty.engine3d.state().objects.find((x) => x.id === id).w, o.id)) === 90, '[f] the engine is not resizable');
  await page.fill('.e3num[data-key="w"]', '120');
  await page.press('.e3num[data-key="w"]', 'Tab');
  // EXPORT: the glTF names its meshes and carries the credit line
  const text = await page.evaluate(() => window.__ghosty.engine3d.exportNow());
  const j = JSON.parse(text);
  const names = j.nodes.map((n) => n.name);
  check(names.includes('Engine: Piston 2') && names.includes('Engine: Crankshaft') && names.includes('Engine: Engine block') && names.filter((n) => /^Engine: Piston \d$/.test(n)).length === 4, `[f] the file does not name the engine's meshes: ${names.slice(0, 12).join(', ')}`);
  check(j.nodes.length > 40 && j.meshes.length === j.nodes.length && j.nodes.every((n) => n.name === 'Ground' || /^Engine: /.test(n.name)), `[f] a node a part: ${j.nodes.length} nodes, ${j.meshes.length} meshes`);
  const piston = j.nodes.find((n) => n.name === 'Engine: Piston 2');
  check(/a first estimate/.test(piston?.extras?.credit ?? '') && !/certified/i.test(piston?.extras?.credit ?? ''), `[f] the credit line: ${piston?.extras?.credit}`);
  check(/first estimate, never certified/.test(j.asset?.extras?.note ?? ''), '[f] the file does not say its sizes are first estimates');
  // bounds: every engine mesh inside 120 × 60 × 70 cm round the object's place
  let mn = [Infinity, Infinity, Infinity];
  let mx = [-Infinity, -Infinity, -Infinity];
  for (const n of j.nodes) {
    if (n.name === 'Ground') continue;
    const acc = j.accessors[j.meshes[n.mesh].primitives[0].attributes.POSITION];
    for (let a = 0; a < 3; a++) {
      mn[a] = Math.min(mn[a], acc.min[a] + n.translation[a]);
      mx[a] = Math.max(mx[a], acc.max[a] + n.translation[a]);
    }
  }
  check(mx[0] - mn[0] <= 1.2 + 1e-3 && mx[1] - mn[1] <= 0.7 + 1e-3 && mx[2] - mn[2] <= 0.6 + 1e-3 && mn[1] > -1e-3, `[f] the exported engine is ${mx.map((v, a) => ((v - mn[a]) * 100).toFixed(0))} cm, not inside 120 × 70 × 60 standing on the ground`);
  check(/^Engine\b/.test(await page.evaluate(() => window.__ghosty.engine3d.state().objects.find((x) => x.kind === 'engine')?.name)), '[f] the engine is not named');
  await ctx.close();
});

// ================================================================ g. "how does an engine work": the Stage's part, OPEN to the Studio turning
await section('g. the Stage', async () => {
  const { ctx, page } = await open({ size: PHONE, name: 'stage' });
  const reply = 'An engine burns fuel in its cylinders; each push turns the crank. Here is one.';
  const lines = ['{"t":"status","text":"thinking…"}', `{"t":"text","text":${JSON.stringify(reply)}}`, '{"t":"done","model":"Mock · scripted"}'].join('\n') + '\n';
  await page.route('**/api/chat', (r) => r.continue({ url: `${base}/__test/stream?lines=${encodeURIComponent(Buffer.from(lines).toString('base64'))}` }));
  await openChat(page);
  await type(page, 'how does an engine work');
  if (await until(page, () => document.querySelector('#thestage')?.dataset.kind === 'part', null, 70000, '[g] "how does an engine work" did not reach the Stage as a part')) {
    const stage = await page.evaluate(() => ({ id: document.querySelector('#thestage')?.dataset.id, title: document.querySelector('#thestage .stgtitle')?.textContent ?? '', truth: document.querySelector('#thestage .g-truth')?.textContent ?? '', tag: document.querySelector('#thestage .g-tag')?.textContent ?? '', pic: !!document.querySelector('#thestage .stgpic svg, #thestage .stgpic canvas') }));
    check(stage.id === 'part:engine' && /typical engine/i.test(stage.title) && /A TYPICAL ENGINE/.test(stage.truth) && /FIRST ESTIMATE/.test(stage.truth) && stage.pic, `[g] the Stage's engine: ${JSON.stringify(stage)}`);
    await page.locator('#thestage button[aria-label^="Open"]').dispatchEvent('click');
    await until(page, () => { const s = window.__ghosty?.car?.state(); return s?.on && s.view === 'bay' && !s.moving && s.engine && s.engine.cover >= 0.99; }, null, 90000, `[g] OPEN did not take it to the Studio with the cover lifted: ${JSON.stringify((await C(page))?.engine && { c: (await E(page))?.cover })}`);
    const a = await E(page);
    await page.waitForTimeout(1000);
    const b = await E(page);
    check(a && b && b.turned > a.turned + 10 && !b.paused, `[g] the engine is not turning in the Studio: ${a?.turned} → ${b?.turned}`);
    check(/typical .*engine/.test(b?.words ?? ''), `[g] the engine's words: ${b?.words}`);
  }
  // a turbo: it opens on a turbo engine
  await openChat(page);
  await type(page, 'show me a turbo');
  if (await until(page, () => document.querySelector('#thestage')?.dataset.id === 'part:engine:turbo', null, 70000, '[g] "show me a turbo" did not reach the Stage')) {
    await page.locator('#thestage button[aria-label^="Open"]').dispatchEvent('click');
    await until(page, () => { const s = window.__ghosty?.car?.state()?.engine; return !!s && s.ids.includes('turbo') && s.cover >= 0.99; }, null, 90000, '[g] OPEN on the turbo did not open an engine with a turbo');
  }
  await ctx.close();
});

await browser.close();
if (problems.length) {
  console.error(`WORKING ENGINE FAILED (${problems.length}):\n - ${problems.join('\n - ')}`);
  process.exit(1);
}
console.log('Working engine run clean: "open the bonnet" → the bay with its one honest line and its one estimate; LIFT THE COVER → the engine turning with the four strokes named and the firing order under them; PAUSE, STEP a quarter turn, REVS; Reduce Motion still at top dead centre with STEP working; a tap on a piston lights it, its sheet and "what is this?" name it with each number marked; TAKE APART, SECTION and MEASURE; the battery light and the starter lit as before; ENGINE in the 3-D engine’s tray, placed and exported with its meshes named; "how does an engine work" → the Stage → the Studio with it turning; every control 44 pt, nothing sideways at 440 and 390.');
