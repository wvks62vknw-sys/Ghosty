// THE NEXT ROUND, MAKE LANE (docs/build-plan/NEXT-MAKE.md): what the lane made this round, proved on the phone at 440 × 956 and 390 × 844.
//   THE CURVE BEHIND A WORKBENCH ANSWER (C, make.u6): under the beam's numbers, how it sags along its span (zero at the supports,
//     the most in the middle, the span/250 line across), following a change to the span at once; a room's heat by month as twelve
//     bars; the car's power curve; each note "First estimate, not certified"; VoiceOver reads one sentence for the picture.
//   THE 3D STUDIO's WAITING LIST (Q): a job the free makers are too busy for waits on the phone, is tried again by itself while
//     Ghosty is open (3, 10, 30 minutes; after midnight when the day's tries are used), offers the catalogue's nearest real models
//     meanwhile, survives a reload, and says when it is ready.
//   SPACE FROM PHOTO, finished (P): after room photos he taps the outline where each door and window is; USE THIS PLAN puts them in
//     those walls; the sizes say ROUGH above MATERIALS until one wall's real length is typed.
//   MATERIALS' PRICES (M): typical UK prices beside paint, flooring and skirting from Design a build's table, LAMINATE or CARPET,
//     the total and wallpaper instead, "not quotes"; SET AGAINST MY SPENDING sets the makeover against his own last three months.
//   THE BAR (every one of them): every key 44 pt, nothing sideways, no word cut, at both sizes, at BODY 21, and in all seven looks.
//   BASE=http://localhost:8788 node tests/makenext.spec.mjs [outDir]
//   BASE=http://localhost:8788 node tests/makelane.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, openSection, standDown } from './nav.mjs';
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const { buildSync } = createRequire(new URL('../apps/web/package.json', import.meta.url))('esbuild');

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const PHONE2 = { width: 390, height: 844 };
const WORLDS = ['scan', 'map', 'eye', 'orbit', 'grown', 'ink', 'glass'];
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
const on = (k) => !process.env.MN_ONLY || process.env.MN_ONLY.split(',').includes(k);
const RAW = /aborted|fetch failed|undefined|NaN|\[object Object\]|TypeError|NetworkError|Failed to|HTTP \d|SyntaxError|ReferenceError/i;
await standDown(base, KEY);

/** A source file of the app, bundled and imported: the page's own words and sums, read by the spec (pure files only). */
async function pure(entry) {
  const r = buildSync({ entryPoints: [new URL(`../${entry}`, import.meta.url).pathname], bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`);
}
const live = [];
async function section(name, fn) {
  if (!on(name)) return;
  try {
    await fn();
  } catch (e) {
    check(false, `[${name}] stopped: ${String(e?.message ?? e).split('\n')[0].slice(0, 220)}`);
    for (const c of live.splice(0)) await c.close().catch(() => undefined);
  }
}

const ROOM = { id: 'r1', name: 'Lounge', poly: [[0, 0], [400, 0], [400, 300], [0, 300]] };
const OPENINGS = [
  { id: 'o1', type: 'door', room: 'r1', wall: 0, at: 20, w: 80, h: 200, sill: 0, hinge: 'start', swing: 'in' },
  { id: 'o2', type: 'window', room: 'r1', wall: 2, at: 100, w: 100, h: 120, sill: 90, hinge: 'start', swing: 'in' },
];
// ================================================================ the phone
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

/** One phone. `world`: the look; `body`: the text size; `store`: localStorage to start with. */
async function phone(viewport, o = {}) {
  const ctx = await browser.newContext({ viewport, screen: viewport, deviceScaleFactor: 1, isMobile: true, hasTouch: true, ...UK, serviceWorkers: 'block' });
  live.push(ctx);
  await ctx.route(/^https:\/\/(?!localhost)/, (route) => route.fulfill({ status: 404, body: '' }));
  if (o.clipboard) await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base }).catch(() => undefined);
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${viewport.width}] pageerror: ${e.message}`));
  await page.addInitScript(({ key, body, world, store }) => {
    if (sessionStorage.getItem('mn.seeded')) return;
    sessionStorage.setItem('mn.seeded', '1');
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.themes1', '1');
    localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Tony', speak: false, sounds: false, theme: 'reactor', favourites: [], look: { ground: 'graphite', world, night: 'graphite', switches: body ? { body } : {} }, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
    for (const [k, v] of Object.entries(store ?? {})) localStorage.setItem(k, v);
    window.__ghostyHero = true;
  }, { key: KEY, body: o.body ?? 0, world: o.world ?? 'scan', store: o.store ?? {} });
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
  return { ctx, page };
}
const until = (page, fn, arg, ms = 10000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const go = async (page, id) => {
  await page.evaluate((i) => (location.hash = i), id);
  await page.waitForSelector(`#pg-${id}`, { state: 'attached', timeout: 30000 });
};
const text = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => e.getClientRects().length).map((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim()).join(' | '), sel);
/** Every key in `root` at 44 pt, nothing sideways on the page, no word cut inside `root`, no raw string. */
async function bar(page, tag, id, root) {
  const r = await page.evaluate(({ t, root }) => {
    const vis = (e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]');
    const els = [...document.querySelectorAll(root)];
    const all = els.flatMap((x) => [x, ...x.querySelectorAll('*')]).filter(vis);
    const small = all.filter((e) => e.matches('button, input:not([type=hidden]):not([type=file]):not([type=range]), select, textarea, [role=button]')).map((e) => {
      const b = e.getBoundingClientRect();
      return b.width >= 43.5 && b.height >= 43.5 ? '' : `${e.tagName.toLowerCase()} "${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24)}" ${Math.round(b.width)}×${Math.round(b.height)}`;
    }).filter(Boolean);
    const sideways = document.documentElement.scrollWidth > innerWidth + 1 || all.some((e) => {
      for (let p = e.parentElement; p; p = p.parentElement) if (/(auto|scroll|hidden)/.test(getComputedStyle(p).overflowX) && p.id !== `pg-${t}`) return false;
      const b = e.getBoundingClientRect();
      return b.width > 0 && (b.left < -1 || b.right > innerWidth + 1);
    });
    const cut = all.filter((e) => !e.matches('input, select, textarea') && e.textContent.trim() && e.scrollWidth > e.clientWidth + 1 && /(hidden|clip)/.test(getComputedStyle(e).overflowX)).map((e) => e.textContent.trim().slice(0, 30));
    return { small: small.slice(0, 6), sideways, cut: cut.slice(0, 4), words: els.map((x) => x.innerText).join(' ') };
  }, { t: id, root });
  check(!r.small.length, `${tag}: under 44 pt: ${r.small.join(', ')}`);
  check(!r.sideways, `${tag}: sideways`);
  check(!r.cut.length, `${tag}: words cut: ${r.cut.join(' | ')}`);
  check(!RAW.test(r.words), `${tag}: a raw string: ${(RAW.exec(r.words) ?? [''])[0]}`);
}
const openUnits = async (page) => {
  await page.locator('#pg-convert .cvtoolbtn[data-id=units]').click();
  await page.waitForSelector('#pg-convert .cvpad .cvpadval', { timeout: 10000 });
};
const ans = (page) => text(page, '#pg-convert .cvpadans');
const SPACE_STORE = { 'ghosty.space': JSON.stringify({ plan: { v: 2, room: { w: 400, d: 300 }, items: [], rooms: [ROOM], openings: OPENINGS, wall: 10, h: 240, north: 0 }, measures: [] }) };

// ================================================================ U · CONVERT's UNIT PAD
const CV = await pure('packages/shared/src/workbench/index.ts');
const WB_STORE = { 'ghosty.workbench': JSON.stringify({ panels: { beam: { mode: 'beam', v: { support: 'simple', span: 3, load: 5000, material: 's275', shape: 'rect', b: 0.1, h: 0.2 } } }, last: 'beam' }) };
/** A colour that is drawn: not nothing, and not its card's background. */
const drawnColour = (page, sel, prop) => page.evaluate(({ sel, prop }) => {
  const e = document.querySelector(sel);
  if (!e) return { ok: false, c: '(none)' };
  const c = getComputedStyle(e)[prop];
  return { ok: !!c && c !== 'none' && !/rgba\(0, 0, 0, 0\)/.test(c), c };
}, { sel, prop });

// ================================================================ C · THE CURVE BEHIND A WORKBENCH ANSWER
await section('words', async () => {
  log('the curves, by hand');
  const at = Date.UTC(2026, 5, 21, 12);
  const beam = CV.curveOf(CV.solve('beam', { span: 3, load: 5000 }, 'metric', at), { span: 3, load: 5000 }, 'metric', at);
  check(beam.points.length === 41 && beam.points[0].y === 0 && Math.abs(beam.points[20].y - 0.2009) < 0.002, `[C sums] the beam's curve ${JSON.stringify(beam.points.slice(19, 22))}`);
  const months = CV.heatByMonth(50, 294.15);
  check(Math.abs(months[0].kwh - 505.92) < 1e-6, `[C heat] January is ${months[0].kwh} kWh (want 505.92)`);
});
for (const vp of [PHONE, PHONE2]) {
  const T = `[${vp.width}]`;
  await section('curve', async () => {
    log(`curves ${vp.width}`);
    const { ctx, page } = await phone(vp, { store: WB_STORE });
    await go(page, 'workbench');
    await openSection(page, 'workbench', 'Structure');
    const fig = '#pg-workbench .wb-beam .wbcurve';
    check(await until(page, (s) => [...document.querySelectorAll(s)].some((f) => f.getClientRects().length), fig, 15000), `${T} [C1 beam] no curve under the beam's numbers`);
    const c1 = await page.evaluate((s) => {
      const f = document.querySelector(s);
      return { pts: f.dataset.points, aria: f.querySelector('svg').getAttribute('aria-label'), note: f.querySelector('.wbcnote').textContent, line: !!f.querySelector('.wbc-line'), limit: !!f.querySelector('.wbc-limit'), mark: !!f.querySelector('.wbc-mark'), keys: f.querySelector('.wbckeys')?.textContent ?? '' };
    }, fig);
    check(c1.pts === '41' && c1.line && c1.mark && !c1.limit, `${T} [C2 drawn] the beam's curve: ${JSON.stringify(c1)}`);
    check(/^How it bends along the span: sag from 0 to 0 mm/.test(c1.aria) && /Most sag 0\.201 mm/.test(c1.aria), `${T} [C3 VoiceOver] the picture reads "${c1.aria}"`);
    check(/^First estimate, not certified: /.test(c1.note) && /most sag 0\.201 mm/.test(c1.keys) && /span\/250: 12 mm, far beyond this/.test(c1.keys), `${T} [C4 words] note "${c1.note}", keys "${c1.keys}"`);
    // a longer span: the curve follows at once (PL³/48EI at 4 m: 0.476 mm)
    await page.locator('#wb-beam-beam-span').fill('4');
    check(await until(page, (s) => /Most sag 0\.476 mm/.test(document.querySelector(s)?.querySelector('svg')?.getAttribute('aria-label') ?? ''), fig, 5000), `${T} [C5 follows] after a 4 m span the picture reads "${await page.evaluate((s) => document.querySelector(s)?.querySelector('svg')?.getAttribute('aria-label'), fig)}"`);
    const st = await page.evaluate(() => window.__ghosty.workbench.curves.beam);
    check(st && Math.abs(st.mark.y - 0.476) < 0.002, `${T} [C5 state] the screen's curve mark is ${st?.mark?.y}`);
    await bar(page, `${T} [C bar]`, 'workbench', '#pg-workbench .wb-beam .wbcard');
    // HOME: the room's heat as twelve bars, and its year said as a first estimate, never a bill
    await openSection(page, 'workbench', 'Home');
    const heat = '#pg-workbench .wb-heat .wbcurve';
    check(await until(page, (s) => !!document.querySelector(s)?.getClientRects().length, heat, 10000), `${T} [C6 heat] no heat curve`);
    const h1 = await page.evaluate((s) => ({ bars: document.querySelectorAll(`${s} .wbc-bar`).length, note: document.querySelector(`${s} .wbcnote`).textContent, aria: document.querySelector(`${s} svg`).getAttribute('aria-label') }), heat);
    check(h1.bars === 12 && /never a bill/.test(h1.note) && /Met Office/.test(h1.note) && /the most in Jan/.test(h1.aria), `${T} [C6 heat] ${JSON.stringify(h1)}`);
    await bar(page, `${T} [C heat bar]`, 'workbench', '#pg-workbench .wb-heat .wbcard');
    // FLIGHT: the car's power curve (the wing panel's CAR kind)
    await openSection(page, 'workbench', 'Flight');
    await page.locator('#pg-workbench .wb-wing .wbmodes button[data-mode=car]').click();
    check(await until(page, () => /^Power it takes as it speeds up/.test(document.querySelector('#pg-workbench .wb-wing .wbcurve svg')?.getAttribute('aria-label') ?? ''), null, 5000), `${T} [C7 car] no power curve under the car`);
    await bar(page, `${T} [C car bar]`, 'workbench', '#pg-workbench .wb-wing .wbcard');
    await ctx.close();
  });
}

// ================================================================ Q · THE 3D STUDIO's WAITING LIST (make from words, finished)
const Q = await pure('apps/web/src/features/studio/queue.ts');
await section('words', async () => {
  log('the waiting list, by hand');
  const now = Date.UTC(2026, 10, 14, 22, 0);
  const a = Q.addJob([], 'a rusty robot dog', 'busy', now);
  check(a.jobs.length === 1 && a.job.next === now + 3 * 60_000 && a.job.tries === 0, `[Q1 add] ${JSON.stringify(a.job)}`);
  const b = Q.addJob(a.jobs, 'A rusty robot dog ', 'busy', now);
  check(b.jobs.length === 1, '[Q1 same words] the same job twice is kept once');
  let j = Q.triedAgain(a.jobs, a.job.id, 'busy', now);
  check(j[0].tries === 1 && j[0].next === now + 10 * 60_000, `[Q2 backoff] after one try: ${JSON.stringify(j[0])}`);
  j = Q.triedAgain(Q.triedAgain(j, a.job.id, 'busy', now), a.job.id, 'busy', now);
  check(j[0].tries === 3 && j[0].next === 0 && /TRY NOW/.test(Q.jobWords(j[0], now)), `[Q2 stops] three tries by itself, then it waits for him: ${JSON.stringify(j[0])}`);
  check(Q.nextTry(0, 'quota', now) === Date.UTC(2026, 10, 15, 0, 5) && /midnight/.test(Q.jobWords(Q.addJob([], 'x', 'quota', now).job, now)), '[Q3 quota] today\'s tries used: just after midnight');
  check(Q.waitWhy('busy') === 'busy' && Q.waitWhy(undefined, 429) === 'quota' && Q.waitWhy(undefined, 400, 'that is not a thing') === null && Q.waitWhy('no_picture', 503, 'nothing could draw the object first') === null && Q.waitWhy(undefined, 200, "10 models have been made today, which is Ghosty's own daily limit; more tomorrow") === 'quota', '[Q4 why] busy, quota and a real failure told apart');
  check(Q.dueJob(a.jobs, now) === null && Q.dueJob(a.jobs, now + 3 * 60_000)?.id === a.job.id, '[Q5 due] a job is due at its time, not before');
  let many = [];
  for (let i = 0; i < 9; i++) many = Q.addJob(many, `thing ${i}`, 'busy', now + i).jobs;
  check(many.length === Q.MAX_JOBS && many[0].prompt === 'thing 3', `[Q6 six] ${many.length} kept, the oldest "${many[0].prompt}"`);
  check(Q.readJobs('nonsense').length === 0 && Q.readJobs(JSON.stringify([{ id: 1 }, ...a.jobs])).length === 1, '[Q7 read] what is not a job is left out');
});
const GLB = readFileSync(new URL('../apps/web/public/models/ToyCar.glb', import.meta.url));
/** The brain's make route stood in for: busy, or a model. */
async function makerRoutes(page, state) {
  await page.route(/\/api\/m3d\/generate$/, (route) => {
    state.calls++;
    if (state.mode === 'busy') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'the free 3-D generators are busy right now — try again in a minute', code: 'busy' }) });
    return route.fulfill({ status: 200, contentType: 'application/x-ndjson', body: `${JSON.stringify({ step: 'Drawing it…' })}\n${JSON.stringify({ model: { id: 'testdog', title: 'a rusty robot dog', maker: 'a free maker', textured: true } })}\n` });
  });
  await page.route(/\/api\/m3d\/testdog$/, (route) => route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: GLB }));
}
const openMake = async (page) => {
  await go(page, 'studio');
  await until(page, () => !!window.__ghosty?.studio?.show, null, 30000);
  await page.evaluate(() => window.__ghosty.studio.show('make'));
  await page.waitForSelector('#pg-studio input[aria-label="What to make"]', { timeout: 10000 });
};
const note = (page) => page.evaluate(() => document.querySelector('#pg-studio input[aria-label="What to make"]')?.closest('.studiopane')?.querySelector('.studioreadout')?.textContent ?? '');
for (const vp of [PHONE, PHONE2]) {
  const T = `[${vp.width}]`;
  await section('queue', async () => {
    log(`waiting list ${vp.width}`);
    const { ctx, page } = await phone(vp);
    const st = { mode: 'busy', calls: 0 };
    await makerRoutes(page, st);
    await openMake(page);
    await page.locator('#pg-studio input[aria-label="What to make"]').fill('a rusty robot dog');
    await page.locator('#pg-studio .studiopane button', { hasText: 'MAKE IT' }).click();
    check(await until(page, () => document.querySelectorAll('#pg-studio .studioqueue .studiojob').length === 1, null, 30000), `${T} [Q8 queued] no job waiting; the note says "${await note(page)}"`);
    const n1 = await note(page);
    check(/^“a rusty robot dog” is waiting: the free makers are busy\. I’ll try again in a few minutes while Ghosty is open/.test(n1) && /stand-in/.test(n1), `${T} [Q8 words] "${n1}"`);
    check((await page.locator('#pg-studio .studioreadout[data-state=waiting]').count()) === 1, `${T} [Q8 state] the note is not marked waiting`);
    const near = await text(page, '#pg-studio .studiomeanwhile');
    check(/MEANWHILE, REAL MODELS NEAR IT/.test(near) && /dog/i.test(near), `${T} [Q9 meanwhile] the catalogue's nearest: "${near}"`);
    check(/The free makers were busy\. I’ll try again in 3 min, while Ghosty is open\./.test(await text(page, '#pg-studio .studiojob')), `${T} [Q10 line] "${await text(page, '#pg-studio .studiojob')}"`);
    await bar(page, `${T} [Q bar]`, 'studio', '#pg-studio .studioqueue, #pg-studio .studiomeanwhile');
    if (vp === PHONE) {
      // kept on the phone: back after a reload (from another screen, so the studio mounts afresh)
      await page.evaluate(() => (location.hash = 'workbench'));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
      await openMake(page);
      check(await until(page, () => /a rusty robot dog/.test(document.querySelector('#pg-studio .studioqueue')?.textContent ?? ''), null, 10000), `${T} [Q11 kept] the job is gone after a reload`);
    }
    // the makers free up: TRY NOW makes it, opens it, says so, and the list is empty
    st.mode = 'ok';
    await page.locator('#pg-studio .studiojob button', { hasText: 'TRY NOW' }).click();
    check(await until(page, () => !document.querySelector('#pg-studio .studioqueue .studiojob'), null, 30000), `${T} [Q12 made] the job is still waiting`);
    check(await until(page, () => /^Your “a rusty robot dog” is ready\./.test(document.querySelector('#pg-studio input[aria-label="What to make"]')?.closest('.studiopane')?.querySelector('.studioreadout')?.textContent ?? ''), null, 10000), `${T} [Q12 ready] the note says "${await note(page)}"`);
    check(await page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.studio.queue') ?? '[]').length === 0), `${T} [Q12 kept] the phone's list still holds it`);
    await ctx.close();
  });
}
// a job that is due is tried by itself while the studio is open (every half minute), and made
await section('queue', async () => {
  log('waiting list: by itself');
  const job = { id: 'jdue', prompt: 'a rusty robot dog', at: 1, tries: 0, next: 1, why: 'busy' };
  const { ctx, page } = await phone(PHONE, { store: { 'ghosty.studio.queue': JSON.stringify([job]) } });
  const st = { mode: 'ok', calls: 0 };
  await makerRoutes(page, st);
  await openMake(page);
  check(await until(page, () => /a rusty robot dog/.test(document.querySelector('#pg-studio .studioqueue')?.textContent ?? ''), null, 10000), '[Q13 listed] the seeded job is not listed');
  check(await until(page, () => !document.querySelector('#pg-studio .studioqueue .studiojob'), null, 45000) && st.calls === 1, `[Q13 by itself] the due job was not made by itself (${st.calls} tries)`);
  await ctx.close();
});

// ================================================================ P · SPACE FROM PHOTO, finished: doors and windows tapped, sizes rough until measured
const PM = await pure('apps/web/src/space/photomarks.ts');
await section('words', async () => {
  log('photo marks, by hand');
  const b = { x: 20, y: 20, w: 200, h: 100 };
  const t = PM.edgeHit(70, 22, b);
  check(t?.wall === 0 && Math.abs(t.frac - 0.25) < 1e-9, `[P1 top] ${JSON.stringify(t)}`);
  const r = PM.edgeHit(219, 70, b);
  check(r?.wall === 1 && Math.abs(r.frac - 0.5) < 1e-9, `[P1 right] ${JSON.stringify(r)}`);
  const bt = PM.edgeHit(170, 121, b);
  check(bt?.wall === 2 && Math.abs(bt.frac - 0.25) < 1e-9, `[P1 bottom runs right to left] ${JSON.stringify(bt)}`);
  check(PM.edgeHit(120, 70, b) === null && PM.edgeHit(400, 70, b) === null, '[P1 miss] a tap in the middle of the room, or off it, marks nothing');
  let m = PM.tapMarks([], t, 'door', b);
  m = PM.tapMarks(m, r, 'window', b);
  check(m.length === 2 && PM.tapMarks(m, t, 'window', b).length === 1, '[P2 toggle] a second tap on a mark takes it off');
  const plan = { v: 1, room: { w: 400, d: 300 }, items: [] };
  const got = PM.placeMarks(plan, 'r1', [{ type: 'door', wall: 0, frac: 0.25 }, { type: 'window', wall: 1, frac: 0.5 }]);
  const door = got.plan.openings.find((o) => o.type === 'door');
  const win = got.plan.openings.find((o) => o.type === 'window');
  check(got.placed === 2 && door.wall === 0 && Math.abs(door.at + door.w / 2 - 100) <= 10 && win.wall === 1 && Math.abs(win.at + win.w / 2 - 150) <= 10, `[P3 placed] ${JSON.stringify(got.plan.openings)}`);
  check(/^ROUGH SIZES: from photos, give or take 12 cm\./.test(PM.roughWords({ room: 'r1', wSd: 12, dSd: 9, at: 1 })), '[P4 words] the rough line');
});
for (const vp of [PHONE, PHONE2]) {
  const T = `[${vp.width}]`;
  await section('photo', async () => {
    log(`from photo ${vp.width}`);
    const { ctx, page } = await phone(vp);
    await go(page, 'space');
    await until(page, () => !!window.__ghosty?.space?.roomFound && !!document.querySelector('#pg-space .spacefromphoto'), null, 30000);
    await page.evaluate(() => window.__ghosty.space.roomFound({ w: 400, d: 300, wSd: 12, dSd: 9, turned: false, notes: [] }));
    await page.locator('#pg-space .spacefromphoto canvas').scrollIntoViewIfNeeded();
    check(/Photos can’t see doors and windows: tap the outline where each one is\./.test(await text(page, '#pg-space .spacetapnote')), `${T} [P5 asks] "${await text(page, '#pg-space .spacetapnote')}"`);
    /** A tap on FROM PHOTO's picture at a point of its own drawing (canvas px). */
    const tapPic = async (cx, cy) => {
      const p = await page.evaluate(([cx, cy]) => {
        const c = document.querySelector('#pg-space .spacefromphoto canvas');
        const r = c.getBoundingClientRect();
        return { x: r.left + (cx / c.width) * r.width, y: r.top + (cy / c.height) * r.height };
      }, [cx, cy]);
      await page.touchscreen.tap(p.x, p.y);
    };
    // the outline: 320 × 240 canvas, k = min(280/400, 200/300) = 2/3, so 266.7 × 200 at (26.7, 20)
    const B = { x: (320 - 400 * (2 / 3)) / 2, y: 20, w: 400 * (2 / 3), h: 200 };
    await tapPic(B.x + B.w * 0.25, B.y);
    await page.locator('#pg-space .spacephototap button[data-tap=window]').click();
    await tapPic(B.x + B.w, B.y + B.h / 2);
    let marks = await page.evaluate(() => window.__ghosty.space.fromPhoto.marks);
    check(marks.length === 2 && marks[0].type === 'door' && marks[0].wall === 0 && marks[1].type === 'window' && marks[1].wall === 1, `${T} [P6 tapped] ${JSON.stringify(marks)}`);
    check(/^Marked: 1 door and 1 window\./.test(await text(page, '#pg-space .spacetapnote')), `${T} [P6 said] "${await text(page, '#pg-space .spacetapnote')}"`);
    // a tap in the room's middle marks nothing, and says where to tap
    await tapPic(B.x + B.w / 2, B.y + B.h / 2);
    check((await page.evaluate(() => window.__ghosty.space.fromPhoto.marks.length)) === 2 && /on the outline itself/.test(await text(page, '#pg-space .spacetapnote')), `${T} [P7 miss] "${await text(page, '#pg-space .spacetapnote')}"`);
    await bar(page, `${T} [P bar]`, 'space', '#pg-space .spacefromphoto');
    await page.locator('#pg-space .spacefromphoto button', { hasText: 'USE THIS PLAN' }).click();
    const plan = await page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.space')).plan);
    const door = plan.openings?.find((o) => o.type === 'door');
    const win = plan.openings?.find((o) => o.type === 'window');
    check(plan.rooms?.[0] && door && win && door.wall === 0 && Math.abs(door.at + door.w / 2 - 100) <= 12 && win.wall === 1 && Math.abs(win.at + win.w / 2 - 150) <= 12, `${T} [P8 in the plan] ${JSON.stringify(plan.openings)}`);
    // rough until one real measurement: said above MATERIALS
    check(await until(page, () => /^ROUGH SIZES: from photos, give or take 12 cm/.test(window.__ghosty.space.materials.rough), null, 5000), `${T} [P9 rough] MATERIALS says "${await page.evaluate(() => window.__ghosty.space.materials.rough)}"`);
    await bar(page, `${T} [P rough bar]`, 'space', '#pg-space .spacematerials');
    // one real length typed on a wall: measured now, and the rough line goes
    const at = async (xcm, ycm) => {
      const box = await page.locator('#pg-space .spacecanvas').boundingBox();
      const { pad, k } = await page.evaluate(() => window.__ghosty.space.view);
      return { x: box.x + pad + xcm * k, y: box.y + pad + ycm * k };
    };
    await page.locator('#pg-space .spacecanvas').scrollIntoViewIfNeeded();
    const p = await at(200, 306);
    await page.touchscreen.tap(p.x, p.y);
    check(await until(page, () => /^wall:/.test(window.__ghosty.space.selected), null, 5000), `${T} [P10 wall] tapping the bottom wall chose "${await page.evaluate(() => window.__ghosty.space.selected)}"`);
    await page.fill('#pg-space .spacelen input', '420');
    await page.locator('#pg-space .spacelen button', { hasText: 'SET LENGTH' }).click();
    check(await until(page, () => window.__ghosty.space.materials.rough === '' && !localStorage.getItem('ghosty.space.rough'), null, 5000), `${T} [P10 measured] still rough: "${await page.evaluate(() => window.__ghosty.space.materials.rough)}"`);
    await ctx.close();
  });
}

// ================================================================ M · MATERIALS' typical prices and the makeover against his spending
const MAT = await pure('apps/web/src/space/materials.ts');
const PR = await pure('apps/web/src/build/prices.ts');
const P = { emulsion: PR.PRICES.emulsion.gbp, emulsion25: PR.PRICES.emulsion25.gbp, emulsion1: PR.PRICES.emulsion1.gbp, laminate: PR.PRICES.laminate.gbp, carpet: PR.PRICES.carpet.gbp, skirting: PR.PRICES.skirting.gbp, wallpaper: PR.PRICES.wallpaper.gbp };
await section('words', async () => {
  log('prices, by hand');
  // a 4 × 3 m room with a door and a window: 7.1 L (a 5 L £28 and a 2.5 L £17 = £45), 13.2 m² of laminate at £22 = £290.40,
  // 13.2 m of skirting at £3.20 = £42.24: £377.64; carpet at £32 = £422.40, so £509.64; 7 rolls at £14 = £98
  const m = MAT.materialsFor([ROOM], OPENINGS, 240);
  const lam = MAT.priceMaterials(m, 'laminate', P);
  check(lam.lines[0].gbp === 45 && Math.abs(lam.lines[1].gbp - 290.4) < 1e-9 && Math.abs(lam.lines[2].gbp - 42.24) < 1e-9 && Math.abs(lam.total - 377.64) < 1e-9 && lam.wallpaper === 98, `[M1 laminate] ${JSON.stringify(lam)}`);
  check(Math.abs(MAT.priceMaterials(m, 'carpet', P).total - 509.64) < 1e-9, `[M1 carpet] ${MAT.priceMaterials(m, 'carpet', P).total}`);
  check(MAT.priceMaterials(MAT.materialsFor([], [], 240), 'laminate', P).lines.length === 0, '[M1 none] no room, no prices');
  check(MAT.typicalMonth([1000, 1200, 1400]) === 1200 && MAT.typicalMonth([]) === null && MAT.typicalMonth([0, 900]) === 900, '[M2 month] a typical month is the mean of the months with spending');
  check(MAT.budgetWords(377.64, 1200, 3) === 'About £378 is 31% of what you spent in a typical month (£1,200, the average of your last 3 months of statements). A first estimate, never a quote.', `[M3 words] "${MAT.budgetWords(377.64, 1200, 3)}"`);
  check(/^No statements on your brain yet/.test(MAT.budgetWords(377.64, null, 0)), '[M3 none] no statements said in his words');
  check(/not quotes/.test(PR.PRICE_LINE), `[M4 honest] the price line "${PR.PRICE_LINE}"`);
});
/** The three whole months before this one (London), as statements would hold them. */
const lastMonths = () => {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/London' }));
  return [3, 2, 1].map((k) => {
    const x = new Date(d.getFullYear(), d.getMonth() - k, 1);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
  });
};
for (const vp of [PHONE, PHONE2]) {
  const T = `[${vp.width}]`;
  await section('price', async () => {
    log(`prices ${vp.width}`);
    const { ctx, page } = await phone(vp, { store: SPACE_STORE });
    const months = lastMonths();
    const outs = { [months[0]]: 1000, [months[1]]: 1200, [months[2]]: 1400 };
    let spendingMode = 'ok';
    await page.route(/\/api\/profile\/spending/, (route) => {
      if (spendingMode === 'fail') return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'boom' }) });
      const mo = new URL(route.request().url()).searchParams.get('month') ?? months[2];
      const body = { privacy: '', month: mo, months: spendingMode === 'none' ? [] : months, kept: 1, cap: 1, rules: 0, last: null, view: spendingMode === 'none' ? null : { month: mo, out: outs[mo] ?? 0, in: 0, categories: [] }, year: null, changes: [], subscriptions: [], budgets: [], rows: [] };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await go(page, 'space');
    check(await until(page, () => (window.__ghosty?.space?.materials?.priced?.total ?? 0) > 0, null, 20000), `${T} [M5 priced] no prices on MATERIALS`);
    await page.locator('#pg-space .spaceprices').scrollIntoViewIfNeeded();
    const priceRows = () => page.evaluate(() => [...document.querySelectorAll('#pg-space .spaceprice')].map((e) => e.innerText.replace(/\s+/g, ' ').trim()).join(' | '));
    const rows = await priceRows();
    check(/Paint 1 × 5 L \+ 1 × 2\.5 L £45/.test(rows) && /Laminate with underlay 13\.2 m² £290\.40/.test(rows) && /Skirting 13\.2 m £42\.24/.test(rows), `${T} [M5 rows] "${rows}"`);
    check(/^About £377\.64 for paint, flooring and skirting\. Papering the walls instead: about £98 of rolls\.$/.test(await text(page, '#pg-space .spacepricetotal')), `${T} [M5 total] "${await text(page, '#pg-space .spacepricetotal')}"`);
    check(/Typical prices from October 2026, not quotes/.test(await text(page, '#pg-space .spaceprices')), `${T} [M5 honest] no "not quotes" line`);
    // CARPET changes the floor's line and the total at once, and is kept on the phone
    await page.locator('#pg-space .spaceprices button[data-floor=carpet]').click();
    check(await until(page, () => Math.abs(window.__ghosty.space.materials.priced.total - 509.64) < 1e-6, null, 5000) && /Carpet and underlay, fitted 13\.2 m² £422\.40/.test(await priceRows()), `${T} [M6 carpet] "${await priceRows()}"`);
    check(await page.evaluate(() => localStorage.getItem('ghosty.space.floor') === 'carpet'), `${T} [M6 kept] the floor choice is not kept`);
    await page.locator('#pg-space .spaceprices button[data-floor=laminate]').click();
    // the makeover against his own statements: the last three whole months, averaged
    await page.locator('#pg-space .spaceprices button', { hasText: 'SET AGAINST MY SPENDING' }).click();
    check(await until(page, () => /^About £378 is 31% of what you spent in a typical month \(£1,200, the average of your last 3 months of statements\)\./.test(document.querySelector('#pg-space .spacebudget')?.textContent ?? ''), null, 10000), `${T} [M7 budget] "${await text(page, '#pg-space .spacebudget')}"`);
    spendingMode = 'none';
    await page.locator('#pg-space .spaceprices button', { hasText: 'SET AGAINST MY SPENDING' }).click();
    check(await until(page, () => document.querySelector('#pg-space .spacebudget')?.dataset.state === 'empty', null, 10000) && /^No statements on your brain yet/.test(await text(page, '#pg-space .spacebudget')), `${T} [M8 empty] "${await text(page, '#pg-space .spacebudget')}"`);
    spendingMode = 'fail';
    await page.locator('#pg-space .spaceprices button', { hasText: 'SET AGAINST MY SPENDING' }).click();
    check(await until(page, () => document.querySelector('#pg-space .spacebudget')?.dataset.state === 'error', null, 10000), `${T} [M9 error] "${await text(page, '#pg-space .spacebudget')}"`);
    await bar(page, `${T} [M bar]`, 'space', '#pg-space .spacematerials');
    await ctx.close();
  });
}

// ================================================================ BODY 21 and the seven looks
await section('body21', async () => {
  log('body 21');
  const { ctx, page } = await phone(PHONE, { body: 21, store: WB_STORE });
  await go(page, 'workbench');
  await openSection(page, 'workbench', 'Structure');
  await until(page, () => !!document.querySelector('#pg-workbench .wb-beam .wbcurve'), null, 15000);
  await bar(page, '[440] [BODY 21] [C]', 'workbench', '#pg-workbench .wb-beam .wbcurve');
  await ctx.close();
  const two = await phone(PHONE, { body: 21, store: SPACE_STORE });
  await go(two.page, 'space');
  await until(two.page, () => (window.__ghosty?.space?.materials?.priced?.total ?? 0) > 0, null, 20000);
  await two.page.locator('#pg-space .spaceprices').scrollIntoViewIfNeeded();
  await until(two.page, () => [...document.querySelectorAll('#pg-space .spaceprices button')].every((b) => b.getBoundingClientRect().height >= 43.5), null, 5000);
  await bar(two.page, '[440] [BODY 21] [M]', 'space', '#pg-space .spacematerials');
  await two.ctx.close();
});
await section('looks', async () => {
  for (const world of WORLDS) {
    log(`look ${world}`);
    const { ctx, page } = await phone(PHONE, { world, store: WB_STORE });
    await go(page, 'workbench');
    await openSection(page, 'workbench', 'Structure');
    await until(page, () => !!document.querySelector('#pg-workbench .wb-beam .wbcurve'), null, 15000);
    await bar(page, `[440] [${world}] [C]`, 'workbench', '#pg-workbench .wb-beam .wbcurve');
    const line = await drawnColour(page, '#pg-workbench .wb-beam .wbc-line', 'stroke');
    const mark = await drawnColour(page, '#pg-workbench .wb-beam .wbc-mark', 'fill');
    check(line.ok && mark.ok, `[440] [${world}] the curve is drawn in ${line.c}, its mark in ${mark.c}`);
    await ctx.close();
    const two = await phone(PHONE, { world, store: SPACE_STORE });
    await go(two.page, 'space');
    await until(two.page, () => (window.__ghosty?.space?.materials?.priced?.total ?? 0) > 0, null, 20000);
    await two.page.locator('#pg-space .spaceprices').scrollIntoViewIfNeeded();
    await until(two.page, () => [...document.querySelectorAll('#pg-space .spaceprices button')].every((b) => b.getBoundingClientRect().height >= 43.5), null, 5000);
    await bar(two.page, `[440] [${world}] [M]`, 'space', '#pg-space .spacematerials');
    const price = await drawnColour(two.page, '#pg-space .spaceprice .v', 'color');
    check(price.ok, `[440] [${world}] a price is drawn in ${price.c}`);
    await two.ctx.close();
  }
});

await browser.close();
const secs = ((Date.now() - t0) / 1000).toFixed(0);
console.log(problems.length ? `PROBLEMS (${problems.length} of ${checks} checks):\n${problems.join('\n')}` : `MAKE lane (next round) run clean: ${checks} checks in ${secs} s: the Workbench's curves, the 3D studio's waiting list, FROM PHOTO's doors and windows and ROUGH sizes, MATERIALS' prices and the makeover against his spending, at 440 and 390, at BODY 21 and in all seven looks`);
process.exit(problems.length ? 1 : 0);
