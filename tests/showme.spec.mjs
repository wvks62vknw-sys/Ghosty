// SHOW ME, THE FIRST SLICE (BRIEF-SHOW-ME-1; STARS 164, OWNER-ISSUES 129, 131) on the owner's iPhone 18 Pro Max (440 × 956, en-GB,
// Europe/London), against the real brain with the stream faked as journey.spec does (the brain's own replies are not what is under test:
// what the Machine shows of them is):
//  a. THE DECISIONS (pure, in the page): a saved place → map; a city → God's Eye; a city "on the map" → map; a route command → the
//     journey, drawn by its own screen; figures → bars, months → a line; a letter or a plan → document; a throw → simulation with the
//     solver's own range; "a desk 140 by 70" → part with those numbers; "a room 4 by 3 with a sofa and a bed" → room; words with
//     nothing to show, two numbers, a person's name, a buying question → nothing.
//  b. EACH KIND THROUGH A REAL TURN in the chat: the Stage appears under the reply with its tag, its picture and its truth line; the
//     reply's sentence landed BEFORE the Stage (the order is recorded) and, with the picture slowed, the sentence still landed first.
//  c. THE KEYS: CLOSE, Escape and his next word take it away; OPEN opens the real screen (map sheet, document editor, Workbench, Studio).
//  d. THE THREE WORLDS AND THE PHONE: The Scan, Glass and ONE INK at 440 × 956 (and The Scan at 390 × 844): the Stage sits in the
//     world's own plate, every key 44 pt, nothing sideways, the ask line still under it; Reduce Motion lands it with nothing moving.
//  e. THE WALL: with no `__ghostyShow` under a test runner nothing appears.
//  f. THE BRAIN CHOOSES (kernel batch 4): a scripted `show` event is drawn as the kind it names, ahead of the phone's own reading; one
//     that cannot be drawn falls back to the phone's own reading.
//  g. THE SWITCH (kernel batch 5): Settings → Show me, on by default; off, no Stage ever (the brain's own pick too); on again, it returns.
// Everything it adds is taken away again (the saved place). Screenshots go to the output directory.
//   BASE=http://localhost:8788 node tests/showme.spec.mjs [outDir]
import { mkdirSync } from 'node:fs';
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const problems = [];
const check = (ok, what) => void (ok || problems.push(what));
const SCAN = { ground: 'graphite', world: 'scan', night: 'graphite', switches: {} };
const GLASS = { ground: 'graphite', world: 'glass', night: 'graphite', switches: {} };
const INK = { ground: 'warm', world: 'ink', night: 'warm', switches: {} };
const gym = { id: 'gym', label: 'Gym', query: 'PureGym Moseley', address: 'PureGym, Alcester Road, Moseley', lat: 52.4452, lon: -1.8886 };

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

/** A phone signed in, his name Boss, in the look asked for; `show`: the Stage's switch under a test runner. */
async function open({ look = SCAN, viewport = PHONE, show = true, reduced = false } = {}) {
  const ctx = await browser.newContext({ viewport, ...UK, serviceWorkers: 'block', ...(reduced ? { reducedMotion: 'reduce' } : {}) });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => webkitNoise(e) || (console.log('pageerror', e.message, (e.stack ?? '').split('\n').slice(0, 4).join(' | ')), problems.push(`pageerror: ${e.message}`)));
  if (process.env.DBG) page.on('console', (m) => m.type() === 'error' && console.log('console', m.text().slice(0, 200)));
  await page.addInitScript(({ key, look, show }) => {
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.themes1', '1');
    localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Boss', speak: false, sounds: false, theme: 'reactor', look, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
    if (show) window.__ghostyShow = true;
    window.__ghostyHero = true;
    window.__ghostyPlace = { none: true };
  }, { key: KEY, look, show });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 40000 }).catch(() => problems.push('the boot never ended'));
  await page.waitForFunction(() => !!window.__ghosty?.show, null, { timeout: 15000 }).catch(() => problems.push('window.__ghosty.show never appeared'));
  return { ctx, page };
}
const api = (page, path, init = {}) => page.evaluate(async ([p, i, k]) => (await fetch(`/api${p}`, { ...i, headers: { 'content-type': 'application/json', 'x-ghosty': '1', 'x-ghosty-key': k } })).json(), [path, init, KEY]);
const ndjson = (events) => events.map((e) => JSON.stringify(e)).join('\n') + '\n';
const until = (page, fn, arg, ms, what) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => (problems.push(what), false));

/** The chat open on Home (the Scan's frame may still be settling: the key is pressed until it takes). */
async function chatOpen(page) {
  const open = () => page.evaluate(() => !!document.querySelector('#pg-core .hud.core.logopen'));
  for (let i = 0; i < 8 && !(await open()); i++) {
    if (i === 0) await page.evaluate(() => (location.hash = 'core'));
    await page.waitForTimeout(i ? 600 : 300);
    await page.locator('.logbtn:visible').first().click({ timeout: 3000 }).catch(() => undefined);
    // (ONE INK has no key for it on its page: the conversation opens as the app itself opens it, shell/launcher openChat)
    if (!(await open())) await page.evaluate(() => document.querySelector('.logbtn')?.click());
    await page.waitForTimeout(400);
  }
}

/** Ask in the chat with the brain's stream faked: `events` after the status; the reply's sentence is the text. */
async function say(page, ask, reply, extra = []) {
  if (process.env.DBG) console.log('say:', ask);
  const body = ndjson([{ t: 'status', text: 'thinking…' }, ...extra, ...(reply ? [{ t: 'text', text: reply }] : []), { t: 'done', model: 'Mock · scripted' }]);
  await page.route('**/api/chat', (r) => r.continue({ url: `${base}/__test/stream?lines=${encodeURIComponent(Buffer.from(body).toString('base64'))}` }));
  await chatOpen(page);
  await page.fill('#cin', ask);
  await page.keyboard.press('Enter');
}
/** Away from a screen a key opened: its sheet closed, back on Home with the chat open (God's Eye's own page is WebGL: nothing is photographed there). */
async function backHome(page) {
  await page.keyboard.press('Escape').catch(() => undefined);
  await page.evaluate(() => { for (const b of document.querySelectorAll('.modal .mhead button')) if (/close/i.test(b.textContent ?? '')) b.click(); });
  await page.waitForTimeout(500);
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(900);
  await chatOpen(page);
}
const stageKind = (page) => page.evaluate(() => document.querySelector('#thestage')?.dataset.kind ?? null);
const waitStage = (page, kind, what) => until(page, (k) => document.querySelector('#thestage')?.dataset.kind === k, kind, 20000, what);
const state = (page) => page.evaluate(async () => JSON.parse(JSON.stringify(await window.__ghosty.show.state())));
const gone = (page, what) => until(page, () => !document.querySelector('#thestage'), null, 5000, what);

// ================================================================ a. the decisions, pure
if (!process.env.WORLDS) {
  const { ctx, page } = await open();
  const decide = (facts) => page.evaluate(async (f) => {
    const base = { tools: [], clients: [], cards: [], places: [{ label: 'Home', lat: 52.48, lon: -1.9 }, { label: 'Nan', lat: 52.4, lon: -1.8 }], city: (n) => (n === 'lisbon' ? { name: 'Lisbon', lat: 38.72, lon: -9.14, country: 'PT' } : null), reply: 'Sure.' };
    const s = await window.__ghosty.show.decide({ ...base, ...f });
    return s ? { kind: s.kind, title: s.title, truth: s.truth, via: s.via, bars: s.series?.points.length, line: s.series?.kind, unit: s.series?.unit, range: s.sim?.values.range, dims: s.part?.dims, given: s.part?.given, room: s.room, paras: s.paragraphs?.length } : null;
  }, facts);
  const kind = async (f, want, what) => {
    const s = await decide(f);
    check((s?.kind ?? null) === want, `[decide] ${what}: wanted ${want}, got ${JSON.stringify(s)}`);
    return s;
  };
  await kind({ ask: 'where is home' }, 'map', 'a saved place by name');
  await kind({ ask: 'where is Lisbon?' }, 'eye', 'a city');
  const m = await kind({ ask: 'show me lisbon on the map' }, 'map', 'a city "on the map"');
  check(m?.truth?.includes('OPENSTREETMAP'), '[decide] the map does not say where it comes from');
  await kind({ ask: 'is it far', mentioned: { label: 'Nan', lat: 52.4, lon: -1.8 } }, 'map', 'a saved place named in passing');
  const j = await kind({ ask: 'how do I get to the station', clients: [{ name: 'show_journey', args: {} }] }, 'journey', 'a journey command');
  check(j?.via === 'its screen', `[decide] the journey is not left to its own screen: ${JSON.stringify(j)}`);
  const c = await kind({ ask: 'how is my spending?', reply: 'Here you go:\n- January: £120\n- February: £95\n- March: £140\n- April: £80' }, 'chart', 'four figures in a list');
  check(c?.bars === 4 && c.line === 'line' && c.unit === '£', `[decide] the list chart: ${JSON.stringify(c)}`);
  const c2 = await kind({ ask: 'what do the shops charge', reply: 'Tesco 120, Asda 95, Lidl 140 and Aldi 80.' }, 'chart', 'figures in a sentence');
  check(c2?.line === 'bars', `[decide] shops are bars, not a line: ${JSON.stringify(c2)}`);
  await kind({ ask: 'compare', reply: '| Month | Spend |\n|---|---|\n| Jan | 120 |\n| Feb | 95 |\n| Mar | 140 |' }, 'chart', 'a table');
  await kind({ ask: 'how much did I spend', reply: 'You spent £120 on food and £95 on fuel.' }, null, 'two numbers are a sentence');
  const d = await kind({ ask: 'write a letter to my landlord about the damp', reply: 'Dear Mr Smith,\n\nI am writing about the damp in the bedroom, which has got worse since October and needs fixing now.\n\nYours sincerely,\nBoss' }, 'document', 'a letter');
  check(/landlord/i.test(d?.title ?? ''), `[decide] the letter's name is "${d?.title}"`);
  await kind({ ask: 'make me a revision plan for maths', reply: 'Here is a plan:\n\n- Monday: algebra\n- Tuesday: geometry\n- Wednesday: fractions\n- Thursday: a past paper' }, 'document', 'a plan with a list');
  await kind({ ask: 'make me a plan', reply: 'Sure, what for?' }, null, 'a plan with nothing in the reply');
  const s = await kind({ ask: 'how far would a ball go if I threw it at 20 m/s at 40 degrees?' }, 'simulation', 'a throw');
  check(s && Math.abs(s.range - 29.1) < 0.2, `[decide] the throw's range is the solver's 29.1 m, got ${s?.range}`);
  await kind({ ask: 'what is the orbit speed at 400 km altitude' }, 'simulation', 'an orbit');
  const p = await kind({ ask: 'show me a desk 140 by 70' }, 'part', 'a desk');
  check(p?.dims?.w === 140 && p.dims.d === 70 && p.dims.h === 75 && p.given.length === 2, `[decide] the desk's numbers: ${JSON.stringify(p)}`);
  const sh = await kind({ ask: 'show me a bookshelf 2 m tall' }, 'part', 'a shelf');
  check(sh?.dims?.h === 200 && sh.given.join() === 'h', `[decide] the shelf's height is his 200: ${JSON.stringify(sh)}`);
  const r = await kind({ ask: 'show me a room 4 by 3 with a sofa and a bed' }, 'room', 'a room');
  check(r?.room?.w === 400 && r.room.d === 300 && r.room.things.map((t) => t.kind).sort().join() === 'bed,sofa', `[decide] the room: ${JSON.stringify(r?.room)}`);
  await kind({ ask: 'where can I buy a desk' }, null, 'a buying question');
  await kind({ ask: 'will my dad get better?', reply: 'He is 62: 70% chance.' }, null, 'a person (no prediction about any person)');
  await kind({ ask: 'where is my dad' }, null, 'a person is never a place');
  await kind({ ask: 'where is the best place to eat' }, null, 'not a place');
  await kind({ ask: 'hello there', reply: 'Hello Boss.' }, null, 'words with nothing to show');
  await ctx.close();
}

// ================================================================ b, c. each kind through a turn, the keys
if (!process.env.WORLDS) {
  const { ctx, page } = await open();
  await api(page, '/profile/places', { method: 'POST', body: JSON.stringify({ found: gym }) });
  const sentenceFirst = async (what) => {
    const order = await page.evaluate(() => [...window.__ghosty.show.trace.order]);
    check(order.join() === 'sentence,stage', `[order] ${what}: the sentence and the picture came as ${order.join(' → ')}`);
  };
  const log = (page) => page.evaluate(() => document.querySelector('#pg-core .convo, .convo')?.textContent ?? '');

  // God's Eye: a city, from the world pack
  await say(page, 'where is Lisbon?', 'Lisbon is the capital of Portugal, on the Atlantic coast.');
  if (await waitStage(page, 'eye', "[eye] where is Lisbon?: no God's Eye on the Stage")) {
    const s = await state(page);
    check(s.drawn.land > 8 && s.drawn.points > 200, `[eye] the globe has no land: ${JSON.stringify(s.drawn)}`);
    check(await page.evaluate(() => !!document.querySelector('#thestage [data-centre]') && /SHOWING · GOD/i.test(document.querySelector('#thestage .g-tag')?.textContent ?? '')), "[eye] no reticle at the centre or no SHOWING · GOD'S EYE tag");
    check(/Atlantic coast/.test(await log(page)), '[eye] the sentence is not in the log');
    await sentenceFirst("God's Eye");
    check(await page.evaluate(() => /WORLD PACK/.test(document.querySelector('#thestage .g-truth')?.textContent ?? '')), "[eye] the truth line does not say what it is made from");
    await page.screenshot({ path: `${out}/showme-scan-eye.png`, timeout: 20000 }).catch(() => undefined);
    // CLOSE
    await page.click('#thestage button[aria-label="Close"]');
    await gone(page, '[keys] CLOSE did not take the Stage away');
    check((await state(page)).closed === 'closed', '[keys] CLOSE not recorded');
  }

  // a saved place: the map, his tiles and his pin
  await say(page, 'is the gym busy at the moment', 'Probably quiet this early.');
  if (await waitStage(page, 'map', '[map] a saved place did not bring the map')) {
    const s = await state(page);
    check(s.drawn.tiles >= 6, `[map] too few tiles: ${JSON.stringify(s.drawn)}`);
    check(await page.evaluate(() => !!document.querySelector('#thestage .stgpin .stg-core') && /Gym/.test(document.querySelector('#thestage .stgtitle')?.textContent ?? '')), '[map] no pin or no name');
    await sentenceFirst('the map');
    // OPEN → the real map sheet
    await page.click('#thestage button[aria-label^="Open"]');
    await until(page, () => !!document.querySelector('.modal'), null, 15000, '[keys] OPEN on the map did not open the map sheet');
    await backHome(page);
  }

  // numbers: bars from the reply's own list, the figures written on them
  await say(page, 'how are my shops doing', 'Prices today:\n- Tesco: £120\n- Asda: £95\n- Lidl: £140\n- Aldi: £80');
  if (await waitStage(page, 'chart', '[chart] four figures did not bring a chart')) {
    const c = await page.evaluate(() => ({ bars: document.querySelectorAll('#thestage .stg-bar').length, figs: [...document.querySelectorAll('#thestage .stg-t.fig')].map((t) => t.textContent) }));
    check(c.bars === 4 && c.figs.join() === '£120,£95,£140,£80', `[chart] bars ${c.bars}, figures ${c.figs.join()}`);
    check(await page.evaluate(() => !document.querySelector('#thestage button[aria-label^="Open"]')), '[chart] a chart has nothing to OPEN');
    check(await page.evaluate(() => [...document.querySelectorAll('#thestage .stg-t.cap')].every((t) => getComputedStyle(t).textTransform !== 'lowercase' && t.textContent === t.textContent.toUpperCase())), '[chart] the labels are lower-cased by the app\'s own case rule, not the Machine\'s capitals');
    await sentenceFirst('the chart');
    // the next word takes it away
    await say(page, 'thanks', 'Any time.');
    await gone(page, '[keys] his next word did not take the Stage away');
  }
  // months run in time: a line
  await say(page, 'how was my year', 'Spend by month: Jan 120, Feb 95, Mar 140, Apr 80, May 110.');
  if (await waitStage(page, 'chart', '[chart] months did not bring a chart')) {
    check(await page.evaluate(() => !!document.querySelector('#thestage .stg-line') && document.querySelectorAll('#thestage .stg-dot').length === 5), '[chart] months are not a line of five points');
    await page.keyboard.press('Escape');
    await gone(page, '[keys] Escape did not take the Stage away');
  }
  // two numbers are a sentence
  await say(page, 'how much did I spend', 'You spent £120 on food and £95 on fuel.');
  await page.waitForTimeout(1500);
  check((await stageKind(page)) === null, '[chart] two numbers brought a Stage');

  // a letter, laid out
  await say(page, 'write a letter to my landlord about the damp', 'Dear Mr Smith,\n\nI am writing about the damp in the bedroom, which has got worse since October and needs fixing now.\n\nYours sincerely,\nBoss');
  if (await waitStage(page, 'document', '[document] a letter did not bring the page')) {
    const d = await page.evaluate(() => ({ head: document.querySelector('#thestage .stgh')?.textContent ?? '', n: document.querySelectorAll('#thestage .stgpage > *').length, all: document.querySelector('#thestage .stgpage')?.textContent ?? '' }));
    check(d.n >= 4 && /damp/.test(d.all) && /landlord/i.test(d.head), `[document] the page: ${JSON.stringify(d)}`);
    check(await page.evaluate(() => [...document.querySelectorAll('#thestage .stgpage > *')].every((t) => getComputedStyle(t).textTransform === 'none')), '[document] a letter\'s words are re-cased by the app (a letter keeps its capitals)');
    await sentenceFirst('the document');
    await page.click('#thestage button[aria-label^="Open"]');
    await until(page, () => !!document.querySelector('.modal'), null, 15000, '[keys] OPEN on the letter did not open the document editor');
    await backHome(page);
  }

  // a formula: the throw runs, the solver's range written on it
  await say(page, 'how far would a ball go if I threw it at 20 m/s at 40 degrees?', 'About 29 metres through the air.');
  if (await waitStage(page, 'simulation', '[simulation] a throw did not bring the simulation')) {
    const t = await page.evaluate(() => ({ path: Number(document.querySelector('#thestage [data-path]')?.dataset.path ?? 0), truth: [...document.querySelectorAll('#thestage .g-truth')].map((x) => x.textContent).join(' | ') }));
    check(t.path > 20 && /FIRST ESTIMATE/.test(t.truth) && /NOT CERTIFIED/.test(t.truth) && /RANGE THROUGH AIR 29\.\d/i.test(t.truth), `[simulation] ${JSON.stringify(t)}`);
    await sentenceFirst('the simulation');
    await page.screenshot({ path: `${out}/showme-scan-simulation.png`, timeout: 20000 }).catch(() => undefined);
    await page.click('#thestage button[aria-label^="Open"]');
    await until(page, () => document.body.dataset.tab === 'workbench' || /workbench/.test(location.hash) || !!document.querySelector('#pg-workbench'), null, 15000, '[keys] OPEN on the simulation did not open the Workbench');
    await backHome(page);
  }

  // a part, built from parameters
  await say(page, 'show me a desk 140 by 70', 'Here is a desk, 140 by 70.');
  if (await waitStage(page, 'part', '[part] a desk did not bring the part')) {
    const s = await state(page);
    const t = await page.evaluate(() => ({ title: document.querySelector('#thestage .stgtitle')?.textContent ?? '', truth: document.querySelector('#thestage .g-truth')?.textContent ?? '', faces: document.querySelectorAll('#thestage .stg-face').length }));
    check(/140 × 70 × 75/.test(t.title) && /BUILT FROM PARAMETERS/.test(t.truth) && /NO FREE TEXT-TO-3D/.test(t.truth), `[part] ${JSON.stringify(t)}`);
    check(s.drawn.faces >= 12 && t.faces === s.drawn.faces, `[part] the boxes are not drawn: ${JSON.stringify(s.drawn)}`);
    await sentenceFirst('the part');
    await page.click('#thestage button[aria-label^="Open"]');
    await until(page, () => document.body.dataset.tab === 'studio' || /studio/.test(location.hash), null, 15000, '[keys] OPEN on the part did not open the Studio');
    await backHome(page);
  }

  // a room, built from parameters
  await say(page, 'show me a room 4 by 3 with a sofa and a bed', 'A room of 4 by 3 metres with a sofa and a bed.');
  if (await waitStage(page, 'room', '[room] a room did not bring the room')) {
    const s = await state(page);
    const t = await page.evaluate(() => ({ title: document.querySelector('#thestage .stgtitle')?.textContent ?? '', truth: [...document.querySelectorAll('#thestage .g-truth')].map((x) => x.textContent).join(' | ') }));
    check(/4 × 3 m/.test(t.title) && /1 SOFA/.test(t.truth) && /1 BED/.test(t.truth) && /NO FREE TEXT-TO-3D/.test(t.truth), `[room] ${JSON.stringify(t)}`);
    check(s.drawn.faces >= 30, `[room] too few faces: ${JSON.stringify(s.drawn)}`);
    await page.screenshot({ path: `${out}/showme-scan-room.png`, timeout: 20000 }).catch(() => undefined);
    await page.keyboard.press('Escape');
    await gone(page, '[keys] Escape did not take the room away');
  }

  // a route: its own screen draws it; the Stage records it and does not draw it twice
  await say(page, 'how do I drive to the airport', 'About twenty minutes.', [
    { t: 'tool', id: 'r1', name: 'get_directions', args: { from: 'Home', to: 'Airport' } },
    { t: 'client', name: 'show_route', args: { path: [[52.48, -1.9], [52.49, -1.85], [52.5, -1.8], [52.45, -1.75]], from: 'Home', to: 'Birmingham Airport', mode: 'driving', distance_m: 15000, duration_s: 1200 } },
    { t: 'tool_result', id: 'r1', name: 'get_directions', ok: true, summary: 'Route found' },
  ]);
  for (let i = 0; i < 40 && (await state(page)).last?.kind !== 'journey'; i++) await page.waitForTimeout(500);
  const jr = await state(page);
  check(jr.last?.via === 'its screen' && !(await stageKind(page)), `[journey] the Stage drew a second journey: ${JSON.stringify(jr.last)}`);
  await backHome(page);

  // nothing to show, and a person: nothing (the Stage was asked and decided so: its count moved and it said why)
  for (const [ask, reply, what] of [['what colour is the sky', 'Blue, mostly, in daylight.', '[nothing] a plain answer'], ['will my dad get better?', 'I cannot say. He is 62: 70% chance of a good week.', '[person] a question about a person']]) {
    const before = (await state(page)).presented;
    await say(page, ask, reply);
    for (let i = 0; i < 30 && (await state(page)).presented === before; i++) await page.waitForTimeout(300);
    const s = await state(page);
    check(s.presented === before + 1 && (await stageKind(page)) === null && s.last === null && /nothing/.test(s.why), `${what} brought a Stage or was not asked: ${JSON.stringify(s)}`);
  }

  // THE SPEAKING RULE: the picture slowed, the sentence still lands first and alone for a moment
  await page.evaluate(() => (window.__ghostyShowDelay = 2200));
  await say(page, 'show me a stool', 'A stool, 35 by 35 and 65 high.');
  await until(page, () => /stool/.test(document.querySelector('.convo')?.textContent ?? ''), null, 15000, '[speaking] the sentence never landed');
  check((await stageKind(page)) === null, '[speaking] the Stage was there before the slowed picture was ready');
  await waitStage(page, 'part', '[speaking] the slowed picture never came');
  await sentenceFirst('the slowed stool');
  await page.evaluate(() => (window.__ghostyShowDelay = 0));
  await page.keyboard.press('Escape');

  await api(page, '/profile/places?id=gym', { method: 'DELETE' });
  await ctx.close();
}

// ================================================================ d. the three worlds and the phone
const WORLDS = [
  ['scan', SCAN, PHONE],
  ['glass', GLASS, PHONE],
  ['ink', INK, PHONE],
  ['scan390', SCAN, { width: 390, height: 844 }],
];
for (const [name, look, viewport] of WORLDS) {
  const { ctx, page } = await open({ look, viewport });
  await say(page, 'show me a room 4 by 3 with a sofa and a bed', 'A room of 4 by 3 metres with a sofa and a bed.');
  if (await waitStage(page, 'room', `[${name}] the Stage did not come`)) {
    // (measured settled: the Stage's entrance slides it up over 900 ms, longer under load; its animations are awaited, up to 3 s)
    await page.evaluate(() => Promise.race([
      Promise.all(document.getAnimations().filter((a) => { const t = a.effect?.target; const st = document.getElementById('thestage'); return t && st && (t === st || st.contains(t)); }).map((a) => a.finished.catch(() => undefined))),
      new Promise((r) => setTimeout(r, 3000)),
    ])).catch(() => undefined);
    await page.waitForTimeout(100);
    const m = await page.evaluate(() => {
      const st = document.getElementById('thestage');
      const cs = getComputedStyle(st);
      const r = st.getBoundingClientRect();
      const bar = document.getElementById('cbar')?.getBoundingClientRect();
      const keys = [...st.querySelectorAll('button')].map((b) => { const q = b.getBoundingClientRect(); return [Math.round(q.width), Math.round(q.height)]; });
      const wide = [...st.querySelectorAll('*')].filter((e) => { const q = e.getBoundingClientRect(); return q.width && (q.right > innerWidth + 1 || q.left < -1); }).length;
      return { world: document.documentElement.dataset.world, border: cs.borderLeftWidth, top: cs.borderTopWidth, radius: cs.borderTopLeftRadius, blur: cs.backdropFilter, bg: cs.backgroundColor, rect: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)], bar: bar && [Math.round(bar.top), Math.round(bar.height)], keys, wide, scrollW: document.documentElement.scrollWidth, anim: cs.animationName, reply: (() => { const m = [...document.querySelectorAll('#pg-core .msg:not(.me)')].pop(); const q = m?.getBoundingClientRect(); return q ? [Math.round(q.top), Math.round(q.bottom)] : null; })(), logBottom: document.querySelector('.hud.core.logopen .cside.l')?.getBoundingClientRect().bottom ?? null };
    });
    check(m.keys.length >= 2 && m.keys.every(([w, h]) => w >= 43.5 && h >= 43.5), `[${name}] a key is under 44 pt: ${JSON.stringify(m.keys)}`);
    check(m.wide === 0 && m.scrollW <= viewport.width + 1, `[${name}] something sticks out sideways: ${m.wide} elements, page ${m.scrollW}`);
    check(m.bar && m.rect[3] <= m.bar[0] + 1, `[${name}] the Stage covers the ask line: ${JSON.stringify([m.rect, m.bar])}`);
    check(m.rect[1] >= 40 && m.rect[0] >= 0 && m.rect[2] <= viewport.width, `[${name}] the Stage is off the screen: ${m.rect}`);
    check(m.reply && m.reply[0] >= 0 && m.reply[0] + 24 <= m.rect[1], `[${name}] the reply's sentence is under the Stage, not above it: reply ${m.reply}, Stage starts ${m.rect[1]}`);
    if (m.logBottom !== null) check(m.logBottom <= m.rect[1] + 2, `[${name}] the conversation is under the Stage, not above it: log ends ${m.logBottom}, Stage starts ${m.rect[1]}`);
    // the world's own plate: Glass is rounded and frosted, The Scan is a square plate, ONE INK has rules and no sides
    if (name.startsWith('scan')) check(parseFloat(m.radius) <= 4 && parseFloat(m.border) > 0 && /^(none|blur\(0px\))$/.test(m.blur), `[scan] not the Scan's plate: ${JSON.stringify({ radius: m.radius, border: m.border, blur: m.blur })}`);
    if (name === 'glass') check(parseFloat(m.radius) >= 8 && /blur/.test(m.blur), `[glass] not glass: ${JSON.stringify({ radius: m.radius, blur: m.blur })}`);
    if (name === 'ink') check(parseFloat(m.border) === 0 && parseFloat(m.top) > 0 && parseFloat(m.radius) === 0, `[ink] not rules: ${JSON.stringify({ side: m.border, top: m.top, radius: m.radius })}`);
    await page.screenshot({ path: `${out}/showme-${name}-room.png`, timeout: 20000 }).catch(() => undefined);
    if (name === 'scan') {
      // the same Stage seen in the other kinds, in this world
      for (const [ask, reply, kind] of [['show me a desk 140 by 70', 'Here is a desk.', 'part'], ['how are my shops doing', 'Prices:\n- Tesco: £120\n- Asda: £95\n- Lidl: £140', 'chart']]) {
        await say(page, ask, reply);
        if (await waitStage(page, kind, `[${name}] ${kind} did not come`)) {
          await page.waitForTimeout(600);
          await page.screenshot({ path: `${out}/showme-${name}-${kind}.png`, timeout: 20000 }).catch(() => undefined);
        }
      }
    }
  }
  await ctx.close();
}

// ================================================================ f. THE BRAIN CHOOSES THE PICTURE (BRIEF-KERNEL-YES 4): a `show` event from the scripted brain
// is drawn as the kind it names, ahead of the phone's own reading; bad data from it falls back to the phone's own reading.
{
  const { ctx, page } = await open();
  const brain = (kind, data) => ({ t: 'show', kind, data });
  // pure: the pick wins over the phone's own guess, and a pick that cannot be drawn is ignored
  const pick = (f) => page.evaluate(async (x) => { const s = await window.__ghosty.show.decide({ tools: [], clients: [], cards: [], places: [], reply: 'Sure.', ...x }); return s ? { kind: s.kind, bars: s.series?.points.length, title: s.title } : null; }, f);
  const own = await pick({ ask: 'tell me about my trip', reply: 'It was a lovely day out.' });
  check(own === null, `[brain] the phone's own reading of a plain sentence should show nothing, got ${JSON.stringify(own)}`);
  const viaBrain = await pick({ ask: 'tell me about my trip', reply: 'It was a lovely day out.', brain: { kind: 'place', data: { label: 'Lisbon', lat: 38.72, lon: -9.14, globe: true } } });
  check(viaBrain?.kind === 'eye' && viaBrain.title === 'Lisbon', `[brain] a place from the brain: ${JSON.stringify(viaBrain)}`);
  const bad = await pick({ ask: 'tell me about my trip', reply: 'It was a lovely day out.', brain: { kind: 'place', data: { label: 'Nowhere', lat: 999, lon: 0 } } });
  check(bad === null, `[brain] a place that cannot be drawn is ignored: ${JSON.stringify(bad)}`);

  // through a real turn: the Stage draws what the brain named
  await say(page, 'tell me about my trip', 'It was a lovely day out.', [brain('place', { label: 'Lisbon', lat: 38.72, lon: -9.14, globe: true })]);
  if (await waitStage(page, 'eye', "[brain] a `show` place with globe did not draw God's Eye")) check(await page.evaluate(() => /Lisbon/.test(document.querySelector('#thestage .stgtitle')?.textContent ?? '')), '[brain] the brain-chosen globe is not on Lisbon');
  // ahead of the phone's own guess: asked "where is Lisbon?" (own: God's Eye), the brain says a map
  await say(page, 'where is Lisbon?', 'Lisbon is the capital of Portugal.', [brain('place', { label: 'Lisbon', lat: 38.72, lon: -9.14, zoom: 11 })]);
  await waitStage(page, 'map', "[brain] the brain's map did not beat the phone's own God's Eye");
  // numbers: three bars the brain named, not the four the reply's own list would give
  await say(page, 'how are my shops doing', 'Prices today:\n- Tesco: £120\n- Asda: £95\n- Lidl: £140\n- Aldi: £80', [brain('numbers', { points: [{ label: 'Tesco', value: 120 }, { label: 'Asda', value: 95 }, { label: 'Lidl', value: 140 }], line: false, unit: '£', before: true })]);
  if (await waitStage(page, 'chart', '[brain] numbers from the brain did not draw a chart')) check((await page.evaluate(() => document.querySelectorAll('#thestage .stg-bar').length)) === 3, "[brain] the chart is the phone's own four bars, not the brain's three");
  // a pick that cannot be drawn: the phone's own reading takes over
  await say(page, 'where is Lisbon?', 'Lisbon is the capital of Portugal.', [brain('place', { label: 'x', lat: 999, lon: 0 })]);
  await waitStage(page, 'eye', "[brain] a bad pick did not fall back to the phone's own God's Eye");
  await ctx.close();
}

// ================================================================ g. THE SWITCH (BRIEF-KERNEL-YES 5): Settings → SHOW ME; off, no Stage ever; on by default
{
  const { ctx, page } = await open();
  const row = () => page.evaluate(() => { const b = document.querySelector('#pg-settings .setsw[data-id="showme"]'); return b ? { on: b.getAttribute('aria-checked'), words: b.textContent ?? '', h: Math.round(b.getBoundingClientRect().height) } : null; });
  const stored = () => page.evaluate(() => window.__ghosty.settings.get().showMe);
  check((await stored()) !== false, '[switch] SHOW ME is not on by default');
  await page.evaluate(() => (location.hash = 'settings'));
  await until(page, () => document.body.dataset.tab === 'settings' && !!document.querySelector('#pg-settings .setsw[data-id="showme"]'), null, 15000, '[switch] no SHOW ME row in Settings');
  const r0 = await row();
  check(r0?.on === 'true' && /Show me/i.test(r0.words), `[switch] the row: ${JSON.stringify(r0)} (want on, named Show me)`);
  // on: a desk brings its Stage
  await page.evaluate(() => (location.hash = 'core'));
  await say(page, 'show me a desk 140 by 70', 'Here is a desk.');
  await waitStage(page, 'part', '[switch] with SHOW ME on a desk brought no Stage');
  // off, from the row in Settings: no Stage ever, and the one up goes with his next word as ever
  await page.evaluate(() => (location.hash = 'settings'));
  await until(page, () => document.body.dataset.tab === 'settings', null, 15000, '[switch] Settings did not open again');
  await page.evaluate(() => document.querySelector('#pg-settings .setsw[data-id="showme"]').click());
  check((await stored()) === false && (await row())?.on === 'false', `[switch] tapped off: stored ${await stored()}, row ${JSON.stringify(await row())}`);
  await page.evaluate(() => (location.hash = 'core'));
  await say(page, 'show me a desk 140 by 70', 'Here is a desk, then.');
  await until(page, () => /desk, then/.test(document.querySelector('.convo')?.textContent ?? ''), null, 15000, '[switch] the reply never landed with SHOW ME off');
  await page.waitForTimeout(1500);
  check((await stageKind(page)) === null, '[switch] a Stage appeared with SHOW ME off');
  await say(page, 'where is Lisbon?', 'Lisbon is the capital of Portugal.', [{ t: 'show', kind: 'place', data: { label: 'Lisbon', lat: 38.72, lon: -9.14, globe: true } }]);
  await page.waitForTimeout(1500);
  check((await stageKind(page)) === null, "[switch] a Stage appeared with SHOW ME off, even for the brain's own pick");
  // on again: it comes back
  await page.evaluate(() => window.__ghosty.settings.set({ showMe: true }));
  await say(page, 'show me a desk 140 by 70', 'Here is a desk again.');
  await waitStage(page, 'part', '[switch] with SHOW ME on again the Stage did not return');
  await ctx.close();
}

// Reduce Motion lands it whole: nothing moves
{
  const { ctx, page } = await open({ reduced: true });
  await say(page, 'show me a desk 140 by 70', 'Here is a desk.');
  if (await waitStage(page, 'part', '[reduced] the Stage did not come')) {
    const a = await page.evaluate(() => ({ anim: getComputedStyle(document.getElementById('thestage')).animationDuration, pts: document.querySelector('#thestage .stg-face')?.getAttribute('points') }));
    await page.waitForTimeout(900);
    const b = await page.evaluate(() => document.querySelector('#thestage .stg-face')?.getAttribute('points'));
    check(a.pts === b, '[reduced] the desk turned with Reduce Motion on');
    check(parseFloat(a.anim) === 0, `[reduced] the Stage animates in: ${a.anim}`);
  }
  await ctx.close();
}

// ================================================================ e. the wall: no switch, no Stage under a test runner
{
  const { ctx, page } = await open({ show: false });
  await say(page, 'show me a desk 140 by 70', 'Here is a desk.');
  await until(page, () => /desk/.test(document.querySelector('.convo')?.textContent ?? ''), null, 15000, '[wall] the reply never landed');
  await page.waitForTimeout(1500);
  check((await stageKind(page)) === null, '[wall] a Stage appeared under a test runner without __ghostyShow');
  await ctx.close();
}

await browser.close();
if (problems.length) {
  console.log(`PROBLEMS:\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('Show me run clean: a place is the map or God\'s Eye, figures are bars or a line, a letter or a plan is the page, a throw runs with the solver\'s range, a desk and a room stand on the Stage from parameters, a route is left to its own screen, a person or a sentence with nothing in it shows nothing; the sentence always lands first, the keys put it away or open the real screen, it sits in the plate of The Scan, Glass and ONE INK at 440 and 390, and Reduce Motion lands it still.');
