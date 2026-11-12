// FURTHER (BRIEF-OCT-IDEAS-3): the ten things of the third October slice, at 440 and 390 (the phone is the iPhone 18 Pro Max, then a
// smaller one). Each fails on the code before this brief.
//  (a) INTERPRETER MODE opens from the words and from SEE; two halves (the far one upside down), a hold-to-talk key on each; a seeded
//      phrase said one way is written and spoken the other way (the fake speaker counts), and the other way back; nothing is stored
//      after leaving; a plain line says nothing is kept; the key is a finger's, nothing sideways
//  (b) a long hold on the orb (and "what do you know?") opens MIND AS A MAP with nodes from the seeded memory, nearest subjects largest;
//      a tap reads one in a sheet with KEEP and FORGET, and UNDO brings it back
//  (c) "can you teleport me?" → "Not yet. Want me to learn it?" → YES drafts a Workshop job (plan, files, test) and sends nothing
//  (d) THE LAB lists five pages, each with a question, a public source, what it showed and a date; one runs again and its date moves
//  (e) "walk me through the library" shows the pointer on the first key; NEXT moves it; reduced motion stills the pulse
//  (f) with seeded changes THE PLAN shows one line on three rooms and none on the rest; "what changed?" reads them
//  (g) REHEARSE runs three rounds against the mock brain and shows NOTES in five lines; nothing is kept without KEEP
//  (h) seeded statements and a saved work place give "you spent £… near work this week"
//  (i) KEEP on a living card files a diary entry with its place; the library's diary page lists it
//  (j) the Sunday letter's fixture carries the new section (the brain test, apps/edge/test/sundaynote.test.mjs, covers its words)
//  (k) the biggest text: the three new screens say their words whole, nothing sideways, every control a finger's
//   BASE=http://localhost:8814 NO_GL_SHOTS=1 node tests/further.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';
import { mkdirSync, readFileSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const problems = [];
const check = (ok, what) => ok || problems.push(what);
const SMALL = { width: 390, height: 844 };
// ONLY=ab runs just those sections while one is being built; the whole spec (no ONLY) is what counts
const only = process.env.ONLY ?? 'abcdefghijk';
const SKIP = Symbol('skip');
const DAY = 86_400_000;

const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/** A paired phone: a fake speech recogniser (what it hears is `window.__heard`, in order) and speaker (what it says is `window.__said`). */
async function open(viewport, { reduced = false } = {}) {
  const ctx = await browser.newContext({ viewport, screen: viewport, ...UK, serviceWorkers: 'block', reducedMotion: reduced ? 'reduce' : 'no-preference', permissions: ['geolocation'], geolocation: { latitude: 52.4862, longitude: -1.8904 } });
  await ctx.addInitScript((k) => {
    localStorage.setItem('ghosty.ownerKey', k);
    if (!localStorage.getItem('ghosty.settings')) localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Boss', home: { name: 'Birmingham', lat: 52.4862, lon: -1.8904 }, units: 'metric', offlineBrain: 'off' }));
    window.__heard = [];
    window.__said = [];
    window.__starts = [];
    window.SpeechRecognition = window.webkitSpeechRecognition = class {
      constructor() {
        this.lang = '';
      }
      start() {
        window.__starts.push(this.lang);
      }
      stop() {
        setTimeout(() => {
          const t = window.__heard.shift();
          if (t) this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: t }], { isFinal: true })] });
          this.onend?.();
        }, 10);
      }
      abort() {
        this.onend?.();
      }
    };
    window.SpeechSynthesisUtterance = class {
      constructor(text) {
        Object.assign(this, { text, voice: null, lang: '', rate: 1, pitch: 1, volume: 1 });
      }
    };
    const synth = window.SpeechSynthesis?.prototype ?? window.speechSynthesis;
    synth.getVoices = () => [
      { name: 'Daniel', lang: 'en-GB', voiceURI: 'Daniel', localService: true, default: true },
      { name: 'Thomas', lang: 'fr-FR', voiceURI: 'Thomas', localService: true, default: false },
    ];
    synth.speak = (u) => {
      if (u.text.trim()) window.__said.push({ text: u.text, lang: u.lang });
      setTimeout(() => {
        u.onstart?.();
        setTimeout(() => u.onend?.(), 20);
      }, 5);
    };
    synth.cancel = () => undefined;
    synth.resume = () => undefined;
  }, KEY);
  const page = await ctx.newPage();
  const tag = `${viewport.width}`;
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${tag}] pageerror: ${e.message}`));
  page.__tag = tag;
  return { ctx, page };
}
async function boot(page) {
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
  await page.waitForTimeout(600);
}
const until = (page, fn, arg, ms, why) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => (problems.push(why), false));
const go = async (page, hash, wait = 700) => {
  await page.evaluate((t) => (location.hash = t), hash);
  await page.waitForTimeout(wait);
  await page.evaluate(() => document.querySelectorAll('#toasts .toast').forEach((t) => t.remove()));
};
const say = async (page, words) => {
  await go(page, 'core', 500);
  if (!(await page.evaluate(() => !!document.querySelector('.hud.core.logopen')))) await page.locator('.logbtn:visible').first().click().catch(() => undefined);
  await page.waitForSelector('#cin', { state: 'visible', timeout: 15000 });
  await page.fill('#cin', words);
  await page.press('#cin', 'Enter');
};
const sideways = (page, sel) => page.$$eval(sel, (els) => els.filter((e) => e.getClientRects().length && (e.getBoundingClientRect().left < -1 || e.getBoundingClientRect().right > innerWidth + 1)).slice(0, 5).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]}`));
const small = (page, sel) => page.$$eval(`${sel} :is(button, input:not([type=hidden]), textarea, select)`, (els) => els
  .filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]'))
  .filter((e) => (e.offsetHeight || e.getBoundingClientRect().height) < 43.5 || (e.offsetWidth || e.getBoundingClientRect().width) < 43.5)
  .slice(0, 6).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} "${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 24)}" ${e.offsetWidth}x${e.offsetHeight}`));

/** Hold a key: down, wait, up (the held time is the spoken time). */
async function hold(page, sel, ms = 350) {
  await page.locator(sel).first().scrollIntoViewIfNeeded();
  const b = await page.locator(sel).first().boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  return async () => page.mouse.up();
}

const MEMORY = [
  { id: 'p:i like flat whites', kind: 'profile', section: 'likes', text: 'I like flat whites', at: Date.now() - DAY, src: { kind: 'owner', at: Date.now() }, locked: false },
  { id: 'p:ann is my sister', kind: 'profile', section: 'people', text: 'Ann is my sister', at: Date.now() - 2 * DAY, src: { kind: 'owner', at: Date.now() }, locked: false },
  { id: 'p:i work at the depot on broad street', kind: 'profile', section: 'places', text: 'I work at the depot on Broad Street', at: Date.now() - 3 * DAY, src: { kind: 'owner', at: Date.now() }, locked: false },
  { id: 'f:7', kind: 'fact', text: 'The bridge on the A38 was inspected in March', at: Date.now() - 4 * DAY, src: { kind: 'chat', at: Date.now() }, locked: false, weight: 3 },
  { id: 'd:2026-11-09', kind: 'diary', text: 'Today we planned the Tuesday runs.', at: Date.now() - 2 * DAY, src: { kind: 'reflection', at: Date.now() }, locked: false },
  { id: 'l:3', kind: 'lesson', text: 'Check the units before the sum', at: Date.now() - 5 * DAY, src: { kind: 'reflection', at: Date.now() }, locked: false },
];

/** The brain's own answers for what these checks seed (everything else is the preview brain's). */
async function stubs(ctx, state) {
  await ctx.route('**/api/translate', async (route) => {
    const b = route.request().postDataJSON();
    state.translated.push(b);
    return json(route, { text: b.to === 'fr' ? 'Où est la gare ?' : 'The station is behind you.', from: b.from ?? '', to: b.to, engine: 'workers-ai' });
  });
  await ctx.route('**/api/profile/timeline', (route) => json(route, { items: state.memory, patterns: [], forgotten: [] }));
  await ctx.route('**/api/profile/item', async (route) => {
    const b = route.request().postDataJSON();
    state.items.push(b);
    return json(route, { item: b.op === 'forget' ? null : state.memory.find((m) => m.id === b.id) ?? null });
  });
  await ctx.route('**/api/profile/places', (route) => (route.request().method() === 'GET' ? json(route, { places: state.places }) : route.continue()));
  await ctx.route('**/api/profile/spending**', (route) => (route.request().method() === 'GET' && state.spending ? json(route, state.spending) : route.continue()));
  await ctx.route('**/api/projects', (route) => (route.request().method() === 'GET' ? json(route, { projects: [{ id: 'p1', title: 'A website', status: 'done', updated: Date.now(), steps: [] }] }) : route.continue()));
  await ctx.route('**/api/packs/do', (route) => {
    const b = route.request().postDataJSON() ?? {};
    if (b.pack === 'people' && b.action === 'who') return json(route, { reply: 'three', data: { people: [{ name: 'Ann' }, { name: 'Sam' }, { name: 'Jo' }] } });
    return route.continue();
  });
  await ctx.route('**/api/transit**', (route) => json(route, { vehicles: [{ id: 'a', delayS: 30 }, { id: 'b', delayS: 420 }, { id: 'c', delayS: -20 }, { id: 'd', delayS: 100 }], src: 'bustimes.org', at: Date.now() }));
  await ctx.route('**/api/proxy**', (route) => {
    const u = decodeURIComponent(new URL(route.request().url()).searchParams.get('url') ?? '');
    state.fed.push(u);
    if (/earthquake\.usgs\.gov\/fdsnws\/event\/1\/count/.test(u)) return route.fulfill({ status: 200, contentType: 'text/plain', body: String(10 + (state.fed.length % 7)) });
    if (/open-meteo\.com\/v1\/forecast.*precipitation_sum/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ daily: { time: ['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12'], precipitation_sum: [0, 4.2, 1.1, 0.2, 3.5] } }) });
    if (/coingecko/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ symbol: 'btc', name: 'Bitcoin', current_price: 61000, price_change_percentage_24h: 1.2, last_updated: new Date().toISOString(), sparkline_in_7d: { price: [58000, 59000, 60000, 59500, 61000] } }]) });
    if (/swpc\.noaa/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([['time_tag', 'Kp', 'a_running', 'station_count'], ['2026-11-10 00:00:00.000', '2.33', '9', '8'], ['2026-11-10 03:00:00.000', '3.67', '18', '8'], ['2026-11-11 00:00:00.000', '5.00', '48', '8']]) });
    return route.continue();
  });
}

async function run(viewport) {
  const tag = `${viewport.width}`;
  const { ctx, page } = await open(viewport);
  const state = { translated: [], memory: structuredClone(MEMORY), items: [], places: [], spending: null, fed: [] };
  await stubs(ctx, state);
  const chatPosts = [];
  page.on('request', (r) => r.method() === 'POST' && /\/api\/chat$/.test(r.url()) && chatPosts.push(r.postData() ?? ''));
  await boot(page);

  // ---------------------------------------------------------------- (a) INTERPRETER
  try {
    if (!only.includes('a')) throw SKIP;
  await say(page, 'interpreter');
  await until(page, () => document.body.dataset.tab === 'interpreter', null, 15000, `[${tag}] (a) "interpreter" did not open the interpreter`);
  await page.waitForSelector('#pg-interpreter .fxhalf.far', { timeout: 8000 }).catch(() => problems.push(`[${tag}] (a) the interpreter has no far half`));
  await page.waitForTimeout(1000);
  const halves = await page.evaluate(() => ({
    far: !!document.querySelector('#pg-interpreter .fxhalf.far .fxkey'),
    near: !!document.querySelector('#pg-interpreter .fxhalf.near .fxkey'),
    flipped: /rotate\(180deg\)|matrix\(-1, ?[-0.e]+, ?[-0.e]+, ?-1/.test(getComputedStyle(document.querySelector('#pg-interpreter .fxhalf.far')).transform),
    note: document.querySelector('#pg-interpreter .fxnote')?.textContent ?? '',
  }));
  check(halves.far && halves.near, `[${tag}] (a) a half has no hold-to-talk key`);
  check(halves.flipped, `[${tag}] (a) the far half is not upside down`);
  check(/Nothing is recorded/.test(halves.note) && /nothing of the other person is kept/i.test(halves.note), `[${tag}] (a) no plain line that nothing is kept: ${halves.note}`);
  check((await small(page, '#pg-interpreter')).length === 0, `[${tag}] (a) a control under 44 pt: ${(await small(page, '#pg-interpreter')).join('; ')}`);
  check((await sideways(page, '#pg-interpreter *')).length === 0, `[${tag}] (a) sideways: ${(await sideways(page, '#pg-interpreter *')).join('; ')}`);
  // English → French: the phrase is written in the far half and said in French
  await page.selectOption('#fxb', 'fr');
  await page.evaluate(() => (window.__heard = ['Where is the station?']));
  const up = await hold(page, '#pg-interpreter .fxhalf.near .fxkey');
  check((await page.evaluate(() => window.__starts.at(-1))) === 'en', `[${tag}] (a) the near key did not listen in English`);
  await up();
  await until(page, () => /Où est la gare/.test(document.querySelector('#pg-interpreter .fxhalf.far .fxlines')?.textContent ?? ''), null, 8000, `[${tag}] (a) the far half did not write the French`);
  check(/Where is the station/.test(await page.locator('#pg-interpreter .fxhalf.near .fxlines').textContent()), `[${tag}] (a) the near half lost what was said`);
  await until(page, () => window.__said.some((s) => /gare/.test(s.text) && /^fr/.test(s.lang)), null, 4000, `[${tag}] (a) the French was not said aloud in a French voice: ${JSON.stringify(await page.evaluate(() => window.__said))}`);
  check(state.translated.at(-1)?.to === 'fr' && state.translated.at(-1)?.from === 'en', `[${tag}] (a) the translation was not asked English to French: ${JSON.stringify(state.translated.at(-1))}`);
  // and back: French heard on the far key is written in English in the near half and said in English
  await page.evaluate(() => (window.__heard = ['La gare est derrière vous.']));
  const up2 = await hold(page, '#pg-interpreter .fxhalf.far .fxkey');
  check((await page.evaluate(() => window.__starts.at(-1))) === 'fr', `[${tag}] (a) the far key did not listen in French`);
  await up2();
  await until(page, () => /The station is behind you/.test(document.querySelector('#pg-interpreter .fxhalf.near .fxlines')?.textContent ?? ''), null, 8000, `[${tag}] (a) the near half did not write the English`);
  await until(page, () => window.__said.some((s) => /behind you/.test(s.text) && /^en/.test(s.lang)), null, 4000, `[${tag}] (a) the English was not said aloud`);
  check(await page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.interpreter.pair') ?? '{}').b === 'fr'), `[${tag}] (a) the pair was not remembered`);
  await page.waitForTimeout(300);
  // with no signal and no offline brain on this phone it says so, in words, on the half he holds
  const noSignal = (route) => route.abort('internetdisconnected');
  await ctx.route('**/api/translate', noSignal);
  await page.evaluate(() => (window.__heard = ['Good morning']));
  const up3 = await hold(page, '#pg-interpreter .fxhalf.near .fxkey');
  await up3();
  await until(page, () => /offline brain/.test(document.querySelector('#pg-interpreter .fxhalf.near .fxstate')?.textContent ?? ''), null, 8000, `[${tag}] (a) no signal and no offline brain: nothing said on the screen (${await page.locator('#pg-interpreter .fxhalf.near .fxstate').textContent().catch(() => '')})`);
  await ctx.unroute('**/api/translate', noSignal);
  await page.screenshot({ path: `${out}/further-${tag}-interpreter.png` });
  // nothing is stored after leaving: no line of the talk is in any storage, and the screen holds none
  await go(page, 'core', 600);
  const kept = await page.evaluate(async () => {
    const hay = [];
    for (let i = 0; i < localStorage.length; i++) hay.push(localStorage.getItem(localStorage.key(i)));
    for (let i = 0; i < sessionStorage.length; i++) hay.push(sessionStorage.getItem(sessionStorage.key(i)));
    const dbs = (await indexedDB.databases?.()) ?? [];
    return { hit: hay.some((v) => /Où est la gare|Where is the station|derrière vous|The station is behind you/i.test(v ?? '')), lines: window.__ghosty.interpreter.lines.length, spoken: window.__ghosty.interpreter.spoken.length, dbs: dbs.length };
  });
  check(!kept.hit && kept.lines === 0 && kept.spoken === 0, `[${tag}] (a) something of the talk was kept after leaving: ${JSON.stringify(kept)}`);
  // from SEE: the room's card (the Lens next to it) opens it
  await go(page, 'area-see', 800);
  const card = page.locator('#pg-area-see .hubtile[data-id="interpreter"]');
  check((await card.count()) === 1, `[${tag}] (a) SEE has no Interpreter card`);
  await card.click({ timeout: 4000 }).catch(() => undefined);
  await until(page, () => document.body.dataset.tab === 'interpreter', null, 6000, `[${tag}] (a) the SEE card did not open the interpreter`);
  // "translate for us" and "help me talk to a French speaker" open it too, the second with French set
  await go(page, 'core', 400);
  await say(page, 'help me talk to a Spanish speaker');
  await until(page, () => document.body.dataset.tab === 'interpreter' && document.querySelector('#fxb')?.value === 'es', null, 15000, `[${tag}] (a) "help me talk to a Spanish speaker" did not open it with Spanish`);

  } catch (e) {
    if (e !== SKIP) problems.push(`[${tag}] (a) stopped: ${String(e.message).split('\n')[0]}`);
  }
  // ---------------------------------------------------------------- (b) THE ORB AS A MAP
  try {
    if (!only.includes('b')) throw SKIP;
  await go(page, 'core', 1500);
  // (the conversation's log is closed: the orb is what is held)
  if (await page.evaluate(() => !!document.querySelector('.hud.core.logopen'))) await page.locator('.logbtn:visible').first().click().catch(() => undefined);
  await page.waitForTimeout(600);
  const orb = await page.evaluate(() => {
    const r = document.querySelector('.rwrap')?.getBoundingClientRect();
    if (!r) return null;
    // a point on the orb as it is drawn now (the latest reply and the day's plates may cover part of it)
    for (const fy of [0.5, 0.3, 0.7, 0.2, 0.8, 0.4, 0.6]) for (const fx of [0.5, 0.35, 0.65, 0.2, 0.8]) {
      const x = r.x + r.width * fx;
      const y = r.y + r.height * fy;
      if (document.querySelector('.rwrap')?.contains(document.elementFromPoint(x, y))) return { x, y, w: r.width, h: r.height };
    }
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
  });
  check(!!orb && orb.w > 40, `[${tag}] (b) Home has no orb to hold`);
  if (orb) {
    await page.mouse.move(orb.x, orb.y);
    await page.mouse.down();
    await page.waitForTimeout(1100);
    await page.mouse.up();
  }
  await page.waitForSelector('.modal .mindmap', { timeout: 8000 }).catch(async () => (await page.screenshot({ path: `${out}/further-${tag}-orbfail.png` }), problems.push(`[${tag}] (b) a long hold on the orb did not open the map: ${JSON.stringify(await page.evaluate((o) => ({ tab: document.body.dataset.tab, log: !!document.querySelector('.hud.core.logopen'), at: (() => { const e = o && document.elementFromPoint(o.x, o.y); return e ? `${e.tagName}.${e.className}` : null; })(), orb: o, map: window.__ghosty.mindmap, modals: document.querySelectorAll('.modal').length }), orb))}`)));
  await page.waitForFunction(() => document.querySelectorAll('.modal .mmnode').length >= 6, null, { timeout: 8000 }).catch(() => undefined);
  await page.waitForTimeout(700); // (the sheet's own landing, and the map drawn again at the width it has)
  const nodes = await page.$$eval('.modal .mmnode', (els) => els.map((e) => ({ id: e.dataset.id, subject: e.dataset.subject, size: Number(e.dataset.size), box: e.offsetWidth, rect: Math.round(e.getBoundingClientRect().width), disp: getComputedStyle(e).display })));
  check(nodes.length >= 6, `[${tag}] (b) the map has ${nodes.length} nodes (want one for each seeded memory)`);
  check(new Set(nodes.map((n) => n.subject)).size >= 4, `[${tag}] (b) the nodes are not laid out by subject: ${[...new Set(nodes.map((n) => n.subject))]}`);
  check(nodes.every((n) => n.box >= 43.5), `[${tag}] (b) a node is under a finger: ${JSON.stringify(nodes.map((n) => [n.box, n.rect, n.disp]))}`);
  check(Math.max(...nodes.map((n) => n.size)) > Math.min(...nodes.map((n) => n.size)), `[${tag}] (b) every node is the same size`);
  check((await sideways(page, '.modal .mindmap *')).length === 0, `[${tag}] (b) the map is sideways: ${(await sideways(page, '.modal .mindmap *')).join('; ')}`);
  await page.screenshot({ path: `${out}/further-${tag}-mindmap.png` });
  await page.click('.modal .mmnode[data-id="p:ann is my sister"]', { timeout: 4000 }).catch(() => problems.push(`[${tag}] (b) could not tap the node for Ann`));
  await until(page, () => /Ann is my sister/.test(document.querySelector('.modal .mmread')?.textContent ?? ''), null, 4000, `[${tag}] (b) a tap did not read the memory behind the node`);
  const acts = await page.$$eval('.modal .mmread button', (b) => b.map((x) => x.textContent?.trim()));
  check(acts.includes('KEEP') && acts.includes('FORGET'), `[${tag}] (b) the sheet has ${acts.join(', ')} (want KEEP and FORGET)`);
  await page.click('.modal .mmread button:has-text("FORGET")');
  await until(page, () => !!document.querySelector('.undo:not([hidden])'), null, 6000, `[${tag}] (b) FORGET showed no UNDO`);
  check(state.items.some((i) => i.id === 'p:ann is my sister' && i.op === 'forget'), `[${tag}] (b) FORGET did not go to the memory: ${JSON.stringify(state.items)}`);
  await page.click('.undo:not([hidden]) button:has-text("UNDO")');
  await until(page, () => true, null, 100, '');
  await page.waitForTimeout(500);
  check(state.items.some((i) => i.id === 'p:ann is my sister' && i.op === 'restore'), `[${tag}] (b) UNDO did not restore it: ${JSON.stringify(state.items)}`);
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.querySelector('.modal .mhead button')?.click());
  // the words do the same
  await say(page, 'what do you know?');
  await page.waitForSelector('.modal .mindmap', { timeout: 10000 }).catch(() => problems.push(`[${tag}] (b) "what do you know?" did not open the map`));
  await page.evaluate(() => document.querySelector('.modal .mhead button')?.click());

  } catch (e) {
    if (e !== SKIP) problems.push(`[${tag}] (b) stopped: ${String(e.message).split('\n')[0]}`);
  }
  // ---------------------------------------------------------------- (c) HIS OWN MISSING TOOLS
  try {
    if (!only.includes('c')) throw SKIP;
  const before = chatPosts.length;
  await say(page, 'are you able to teleport parcels to Mars?');
  await page.waitForSelector('.localacts .learnyes', { timeout: 15000 }).catch(() => problems.push(`[${tag}] (c) "Not yet. Want me to learn it?" had no YES`));
  await page.click('.localacts .learnyes').catch(() => undefined);
  await page.waitForTimeout(900);
  check(chatPosts.length === before, `[${tag}] (c) YES sent something to the chat (${chatPosts.length - before}): nothing may be sent without the tap on SHIP IT`);
  await go(page, 'workshop', 900);
  await page.waitForSelector('#pg-workshop .selfdraft', { state: 'attached', timeout: 8000 }).catch(() => problems.push(`[${tag}] (c) the Workshop has no drafted job after YES`));
  const draft = await page.evaluate(() => {
    const d = document.querySelector('#pg-workshop .selfdraft');
    const t = (s) => d?.querySelector(s)?.textContent?.trim() ?? '';
    return { plan: t('.sdplan'), files: t('.sdfiles'), test: t('.sdtest'), says: t('.sdwhat'), ship: [...(d?.querySelectorAll('button') ?? [])].map((b) => b.textContent?.trim()), state: d?.dataset.state ?? '' };
  });
  check(/teleport/i.test(draft.plan) && draft.plan.length > 40, `[${tag}] (c) the plan is not a paragraph in his words: "${draft.plan}"`);
  check(/\.ts/.test(draft.files), `[${tag}] (c) the files he would touch are not named: "${draft.files}"`);
  check(/spec|test/i.test(draft.test), `[${tag}] (c) the test he would add is not named: "${draft.test}"`);
  check(draft.ship.includes('SHIP IT') && draft.state === 'draft', `[${tag}] (c) no SHIP IT on a draft (${draft.ship}, ${draft.state})`);
  check(chatPosts.length === before, `[${tag}] (c) the Workshop sent something at once`);
  await page.screenshot({ path: `${out}/further-${tag}-selfdraft.png` });

  } catch (e) {
    if (e !== SKIP) problems.push(`[${tag}] (c) stopped: ${String(e.message).split('\n')[0]}`);
  }
  // ---------------------------------------------------------------- (d) THE LAB
  try {
    if (!only.includes('d')) throw SKIP;
  await page.evaluate(() => localStorage.setItem('ghosty.lab', JSON.stringify({ pages: { quakes: { ran: Date.parse('2026-10-01T09:00:00Z'), showed: 'old', rows: [['Sep', 3]] } } })));
  // THE LAB is one row away inside the Workshop (Make, Workshop, the row: three taps)
  await go(page, 'workshop', 900);
  await page.evaluate(() => [...document.querySelectorAll('#pg-workshop .pn')].find((p) => /^THE LAB/i.test(p.querySelector('.ptitle')?.textContent ?? ''))?.querySelector('.rw')?.click());
  await until(page, () => document.body.dataset.tab === 'lab', null, 8000, `[${tag}] (d) the Workshop's THE LAB row did not open the lab`);
  await page.waitForTimeout(1200);
  await page.waitForFunction(() => document.querySelectorAll('#pg-lab .labpage').length === 5, null, { timeout: 8000 }).catch(() => problems.push(`[${tag}] (d) THE LAB does not list five pages`));
  const lab = await page.$$eval('#pg-lab .labpage', (els) => els.map((e) => ({ id: e.dataset.id, q: e.querySelector('.labq')?.textContent?.trim(), src: e.querySelector('.labsrc')?.textContent?.trim(), showed: e.querySelector('.labshowed')?.textContent?.trim(), date: e.querySelector('.labdate')?.dataset.ran, again: !!e.querySelector('button[data-act="again"]'), exp: !!e.querySelector('button[data-act="export"]') })));
  check(lab.map((x) => x.id).join() === 'quakes,rain,bus,markets,space', `[${tag}] (d) the lab's pages are ${lab.map((x) => x.id)}`);
  for (const x of lab) {
    check(!!x.q && /\?$/.test(x.q), `[${tag}] (d) ${x.id}: no question`);
    check(!!x.src && /^(Source|From)/.test(x.src), `[${tag}] (d) ${x.id}: no source line (${x.src})`);
    check(!!x.showed, `[${tag}] (d) ${x.id}: nothing said it showed`);
    check(x.again && x.exp, `[${tag}] (d) ${x.id}: RUN IT AGAIN or EXPORT missing`);
  }
  const oldRan = Number(lab[0]?.date);
  check(oldRan === Date.parse('2026-10-01T09:00:00Z'), `[${tag}] (d) the quakes page lost its seeded date (${lab[0]?.date})`);
  await page.click('#pg-lab .labpage[data-id="quakes"] button[data-act="again"]');
  await until(page, (o) => Number(document.querySelector('#pg-lab .labpage[data-id="quakes"] .labdate')?.dataset.ran) > o, oldRan, 10000, `[${tag}] (d) RUN IT AGAIN did not move the date`);
  check(state.fed.some((u) => /earthquake\.usgs/.test(u)), `[${tag}] (d) the quakes page did not read the public feed (${state.fed.slice(0, 3)})`);
  check((await small(page, '#pg-lab')).length === 0, `[${tag}] (d) a control under 44 pt in the lab: ${(await small(page, '#pg-lab')).join('; ')}`);
  check((await sideways(page, '#pg-lab *')).length === 0, `[${tag}] (d) the lab is sideways: ${(await sideways(page, '#pg-lab *')).join('; ')}`);
  await page.screenshot({ path: `${out}/further-${tag}-lab.png` });

  } catch (e) {
    if (e !== SKIP) problems.push(`[${tag}] (d) stopped: ${String(e.message).split('\n')[0]}`);
  }
  // ---------------------------------------------------------------- (e) WALK ME THROUGH IT
  try {
    if (!only.includes('e')) throw SKIP;
  await say(page, 'walk me through the library');
  await page.waitForSelector('#fxwalk .fxptr', { state: 'visible', timeout: 15000 }).catch(() => problems.push(`[${tag}] (e) no pointer for "walk me through the library"`));
  const w0 = await page.evaluate(() => ({ ...window.__ghosty.walk, tab: document.body.dataset.tab, sentence: document.querySelector('#fxwalk .fxwalksays')?.textContent ?? '', at: (() => { const r = document.querySelector('#fxwalk .fxptr')?.getBoundingClientRect(); return r ? [Math.round(r.x), Math.round(r.y)] : null; })() }));
  check(w0.tab === 'library' && w0.screen === 'library' && w0.i === 0 && w0.of >= 3, `[${tag}] (e) the walk did not start at step 1 on the library: ${JSON.stringify(w0)}`);
  check(w0.sentence.length > 10, `[${tag}] (e) the first step has no sentence`);
  check(await page.evaluate(() => getComputedStyle(document.querySelector('#fxwalk .fxptr')).animationName !== 'none'), `[${tag}] (e) the pointer does not pulse (with motion on)`);
  check(!!w0.target, `[${tag}] (e) the first step points at nothing`);
  await page.click('#fxwalk button[data-act="next"]');
  await page.waitForTimeout(500);
  const w1 = await page.evaluate(() => ({ ...window.__ghosty.walk, at: (() => { const r = document.querySelector('#fxwalk .fxptr')?.getBoundingClientRect(); return r ? [Math.round(r.x), Math.round(r.y)] : null; })() }));
  check(w1.i === 1 && w1.target !== w0.target, `[${tag}] (e) NEXT did not move the pointer: ${JSON.stringify(w1)} from ${JSON.stringify(w0)}`);
  check((await small(page, '#fxwalk')).length === 0, `[${tag}] (e) a walk control under 44 pt: ${(await small(page, '#fxwalk')).join('; ')}`);
  await page.screenshot({ path: `${out}/further-${tag}-walk.png` });
  await page.evaluate(() => document.querySelector('#fxwalk button[data-act="done"]')?.click());
  await page.waitForTimeout(300);
  check((await page.locator('#fxwalk').count()) === 0 || !(await page.locator('#fxwalk').isVisible()), `[${tag}] (e) DONE did not end the walk`);
  // a long press on a thing in the plan walks him through it too
  await go(page, 'memory', 900);
  await page.click('.housebtn', { timeout: 5000 }).catch(() => problems.push(`[${tag}] (e) no house key to open the plan`));
  await page.waitForSelector('#plan .planthing[data-id="gym"]', { timeout: 5000 }).catch(() => problems.push(`[${tag}] (e) the plan has no Gym to hold`));
  const upW = await hold(page, '#plan .planthing[data-id="gym"]', 900);
  await upW();
  await until(page, () => window.__ghosty.walk?.on && window.__ghosty.walk.screen === 'gym', null, 12000, `[${tag}] (e) a long press on Gym in the plan did not start the walk: ${JSON.stringify(await page.evaluate(() => window.__ghosty.walk))}`);
  await page.evaluate(() => document.querySelector('#fxwalk button[data-act="done"]')?.click());
  await page.evaluate(() => document.querySelector('#fxwalk button[data-act="next"]')?.click());

  } catch (e) {
    if (e !== SKIP) problems.push(`[${tag}] (e) stopped: ${String(e.message).split('\n')[0]}`);
  }
  // ---------------------------------------------------------------- (f) WHAT CHANGED SINCE YESTERDAY
  try {
    if (!only.includes('f')) throw SKIP;
    await go(page, 'memory', 900);
    await page.evaluate((d) => {
      const key = (t) => new Date(t).toLocaleDateString('en-CA');
      // yesterday's readings, kept as the phone keeps them; today's are the coach's two passed lessons, three people and one project done
      localStorage.setItem('ghosty.since', JSON.stringify({ days: { [key(Date.now() - d)]: { learn: { coach: 0 }, life: { people: 0 }, make: { projects: 0 } } } }));
      localStorage.setItem('ghosty.coach', JSON.stringify({ v: 1, days: [], best: {}, passed: { 'guitar-1': '2026-11-10', 'guitar-2': '2026-11-10' }, typing: { best: 0, log: [] }, words: {}, drawn: [] }));
    }, DAY);
    // the house's plan (a phone in The Scan): one line on three rooms, none on the rest
    await page.click('.housebtn', { timeout: 5000 }).catch(() => problems.push(`[${tag}] (f) no house key to open the plan`));
    await page.waitForSelector('#plan', { timeout: 5000 }).catch(() => problems.push(`[${tag}] (f) the plan did not open`));
    await until(page, () => document.querySelectorAll('#plan .planchg').length >= 3, null, 15000, `[${tag}] (f) the plan shows ${await page.evaluate(() => document.querySelectorAll('#plan .planchg').length)} changed lines (want three)`);
    const lines = await page.$$eval('#plan .planchg', (p) => p.map((x) => `${x.dataset.room}: ${x.textContent}`));
    check(lines.length === 3 && lines.map((l) => l.split(':')[0]).sort().join() === 'learn,life,make', `[${tag}] (f) the lines are on ${lines.map((l) => l.split(':')[0])} (want learn, life, make): ${lines.join(' | ')}`);
    check(lines.some((l) => /I passed 2 more coach lessons/.test(l)) && lines.some((l) => /3 new people you told me about/.test(l)) && lines.some((l) => /I finished 1 project/.test(l)), `[${tag}] (f) the words are not his: ${lines.join(' | ')}`);
    const rooms = await page.$$eval('#plan .planroom', (r) => r.map((x) => [x.dataset.room, !!x.querySelector('.planchg')]));
    check(rooms.filter(([, has]) => has).length === 3 && rooms.length === 7, `[${tag}] (f) ${JSON.stringify(rooms)}`);
    await page.screenshot({ path: `${out}/further-${tag}-changed.png` });
    await page.keyboard.press('Escape');
    await say(page, 'what changed?');
    await until(page, () => [...document.querySelectorAll('#pg-core .msg:not(.me)')].some((m) => /LEARN: I passed 2 more coach lessons/.test(m.textContent ?? '') && /MAKE: I finished 1 project/.test(m.textContent ?? '')), null, 20000, `[${tag}] (f) "what changed?" did not read the lines`);
  } catch (e) {
    if (e !== SKIP) problems.push(`[${tag}] (f) stopped: ${String(e.message).split('\n')[0]}`);
  }

  // ---------------------------------------------------------------- (g) REHEARSE
  try {
    if (!only.includes('g')) throw SKIP;
  await say(page, 'rehearse a job interview for a junior mechanic');
  await until(page, () => document.body.dataset.tab === 'rehearse', null, 15000, `[${tag}] (g) "rehearse …" did not open REHEARSE`);
  const sit = await page.locator('#pg-rehearse textarea[name="situation"]').inputValue().catch(() => '');
  check(/junior mechanic/.test(sit), `[${tag}] (g) the situation was not filled in from his words ("${sit}")`);
  await page.click('#pg-rehearse button[data-act="start"]');
  for (let r = 1; r <= 3; r++) {
    await until(page, (n) => document.querySelectorAll('#pg-rehearse .rhline.theirs').length >= n && !!document.querySelector('#pg-rehearse textarea[name="answer"]:not([disabled])'), r, 30000, `[${tag}] (g) round ${r}: the other side did not speak`);
    await page.fill('#pg-rehearse textarea[name="answer"]', `Round ${r}: I fixed my own car for six years and I would like to learn properly.`);
    await page.click('#pg-rehearse button[data-act="send"]');
  }
  await page.waitForSelector('#pg-rehearse .rhnotes', { timeout: 40000 }).catch(() => problems.push(`[${tag}] (g) three rounds gave no NOTES`));
  const notes = await page.$$eval('#pg-rehearse .rhnotes li', (l) => l.map((x) => x.textContent?.trim()));
  check(notes.length === 5, `[${tag}] (g) NOTES has ${notes.length} lines (want five)`);
  const keptBefore = await page.evaluate(() => JSON.stringify(Object.entries(localStorage).filter(([k]) => /rehears/i.test(k))));
  check(keptBefore === '[]', `[${tag}] (g) something was kept before KEEP: ${keptBefore}`);
  await page.screenshot({ path: `${out}/further-${tag}-rehearse.png` });
  await page.click('#pg-rehearse button[data-act="keep"]');
  await page.waitForTimeout(400);
  check(await page.evaluate(() => Object.keys(localStorage).some((k) => /rehears/i.test(k))), `[${tag}] (g) KEEP kept nothing`);
  await page.evaluate(() => Object.keys(localStorage).filter((k) => /rehears/i.test(k)).forEach((k) => localStorage.removeItem(k)));

  } catch (e) {
    if (e !== SKIP) problems.push(`[${tag}] (g) stopped: ${String(e.message).split('\n')[0]}`);
  }
  // ---------------------------------------------------------------- (h) PLACES AND SPENDING
  try {
    if (!only.includes('h')) throw SKIP;
    const ymd = (t) => new Date(t).toLocaleDateString('en-CA');
    const month = ymd(Date.now()).slice(0, 7);
    state.places = [
      { id: 'home', label: 'Home', query: 'Acacia Avenue', address: 'Acacia Avenue, Kings Heath', lat: 52.4, lon: -1.9, at: Date.now() },
      { id: 'work', label: 'Work', query: 'Broad Street', address: 'Broad Street, Birmingham', lat: 52.4776, lon: -1.9086, at: Date.now() },
    ];
    const row = (n, t, a, c) => ({ d: ymd(Date.now() - n * DAY), t, a, k: t.toLowerCase().replace(/\W+/g, ''), c, by: 'rule' });
    state.spending = {
      privacy: '', month, months: [month], kept: 3, cap: 1000, rules: 0, last: null,
      view: { month, out: 140, in: 0, categories: [{ c: 'eating out', spent: 62 }, { c: 'groceries', spent: 78 }] },
      year: null, changes: [], subscriptions: [], budgets: [],
      rows: [row(1, 'COSTA BROAD STREET', -4.5, 'eating out'), row(2, 'GREGGS BROAD ST BHAM', -57.5, 'eating out'), row(3, 'TESCO LONDON', -78, 'groceries'), row(20, 'PRET BROAD STREET', -9, 'eating out')],
    };
    await ctx.route('**/api/traffic/commute/**', (route) => json(route, { minutes: 24, km: 14, delayMin: 0, live: false, line: '24 min by car, 14 km' }));
    await go(page, 'agenda', 1200);
    await page.evaluate(() => document.querySelector('#pg-agenda .secpill[data-sec="spending"]')?.click());
    await page.waitForSelector('#pg-agenda .spnear', { timeout: 10000 }).catch(() => problems.push(`[${tag}] (h) the spending sheet has no line for money near Work`));
    const line = await page.$eval('#pg-agenda .spnear', (e) => e.textContent ?? '').catch(() => '');
    check(/You spent £62 near Work this week/.test(line), `[${tag}] (h) the line reads "${line}" (want £62: Costa and Greggs, not Tesco, not last month's Pret)`);
    check(/Matched by words alone/.test(line) && /no position used/.test(line), `[${tag}] (h) the line does not say how it was worked out: ${line}`);
    await page.screenshot({ path: `${out}/further-${tag}-spendnear.png` });
    // the Brief: the sentence says the money, and the commute says its fuel as an estimate
    await go(page, 'brief', 1500);
    await until(page, () => /£62 spent near Work this week/.test(document.querySelector('#pg-brief .hero .brsay')?.textContent ?? ''), null, 15000, `[${tag}] (h) the Brief's sentence has no money line: ${await page.locator('#pg-brief .hero .brsay').textContent().catch(() => '')}`);
    await until(page, () => /fuel there and back \(estimate/.test(document.querySelector('#pg-brief .pn.commute')?.textContent ?? ''), null, 8000, `[${tag}] (h) the commute does not say its fuel as an estimate: ${await page.locator('#pg-brief .pn.commute').textContent().catch(() => '')}`);
    const brief = await page.locator('#pg-brief .hero .brsay').textContent().catch(() => '');
    check(/About £2\.80 in fuel there and back \(estimate/.test(brief), `[${tag}] (h) the Brief's sentence says no estimated fuel: ${brief}`);
  } catch (e) {
    if (e !== SKIP) problems.push(`[${tag}] (h) stopped: ${String(e.message).split('\n')[0]}`);
  }

  // ---------------------------------------------------------------- (i) THE NATURE DIARY
  try {
    if (!only.includes('i')) throw SKIP;
    // he stands 1.5 km north-east of home; the Lens names a bird (the preview brain's model says a robin); KEEP files it, SAVE is the Memory's own
    await ctx.setGeolocation({ latitude: 52.4939, longitude: -1.8731 });
    const sent = [];
    page.on('request', (r) => sent.push(`${r.url()} ${r.postData() ?? ''}`));
    await go(page, 'lens', 1500);
    await page.evaluate(() => window.__ghosty.lens.setMode('name'));
    await page.waitForTimeout(600);
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    await page.locator('#pg-lens input[type=file]').setInputFiles({ name: 'bird.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    await page.locator('#pg-lens button', { hasText: 'LIVING THING' }).click({ timeout: 10000 });
    await page.locator('#pg-lens .livingkinds button', { hasText: 'BIRD' }).click({ timeout: 10000 });
    await until(page, () => window.__ghosty?.lens?.card?.what === 'living', null, 60000, `[${tag}] (i) the Lens showed no living card`);
    check(await page.evaluate(() => !localStorage.getItem('ghosty.diary')), `[${tag}] (i) something was in the diary before KEEP`);
    const keep = page.locator('#pg-lens .livingcard button', { hasText: 'KEEP' });
    check((await keep.count()) === 1, `[${tag}] (i) the living card has no KEEP`);
    await keep.click();
    await until(page, () => (JSON.parse(localStorage.getItem('ghosty.diary') ?? '[]')).length === 1, null, 12000, `[${tag}] (i) KEEP did not file a diary entry`);
    const entry = await page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.diary') ?? '[]')[0]);
    check(/robin/i.test(entry?.name ?? '') && Math.abs((entry?.at2?.lat ?? 0) - 52.4939) < 0.001 && /^\d(\.\d)? km north-east of Birmingham$/.test(entry?.near ?? ''), `[${tag}] (i) the entry is ${JSON.stringify(entry)}`);
    check(!sent.some((x) => /52\.4939|-1\.8731/.test(x)), `[${tag}] (i) his position went to the network: ${sent.filter((x) => /52\.4939|-1\.8731/.test(x)).slice(0, 2).join(' | ')}`);
    await go(page, 'library', 1200);
    await page.evaluate(() => document.querySelector('#pg-library .secpill[data-sec="shelf"]')?.click());
    await page.waitForSelector('#pg-library .diaryrow', { timeout: 10000 }).catch(() => problems.push(`[${tag}] (i) the library's diary lists nothing`));
    const rowText = await page.$eval('#pg-library .diaryrow', (e) => e.textContent ?? '').catch(() => '');
    check(/seen: a European robin, \d{1,2} [A-Z][a-z]{2}, \d(\.\d)? km north-east of Birmingham/.test(rowText), `[${tag}] (i) the diary row reads "${rowText}"`);
    check((await page.locator('#pg-library .diarysvg .diarydot').count()) === 1, `[${tag}] (i) the diary's map has no dot`);
    check((await small(page, '#pg-library .diary')).length === 0, `[${tag}] (i) a diary control under 44 pt: ${(await small(page, '#pg-library .diary')).join('; ')}`);
    await page.screenshot({ path: `${out}/further-${tag}-diary.png` });
  } catch (e) {
    if (e !== SKIP) problems.push(`[${tag}] (i) stopped: ${String(e.message).split('\n')[0]}`);
  }

  // ---------------------------------------------------------------- (j) THE SUNDAY NOTE
  try {
    if (!only.includes('j')) throw SKIP;
    const fx = JSON.parse(readFileSync(new URL('./fixtures/sunday-letter.json', import.meta.url), 'utf8'));
    check(fx.title === 'What I learned to do this week' && typeof fx.text === 'string', `[${tag}] (j) the letter's title is "${fx.title}"`);
    check(Array.isArray(fx.learned) && fx.learned.length >= 1 && fx.learned.length <= 5, `[${tag}] (j) the new section has ${fx.learned?.length} lines (one to five)`);
    check(fx.text.includes('What I learned this week') && fx.learned.every((l) => fx.text.includes(l)), `[${tag}] (j) the letter's text lacks the new section's lines`);
    check(/\b(?:no|not|can’t|don’t|did not|only)\b/i.test(fx.learned.join(' ')), `[${tag}] (j) the new section does not say what the week did not show`);
    check(fx.text.split('\n').length <= 12, `[${tag}] (j) the letter is ${fx.text.split('\n').length} lines: one letter, not two`);
  } catch (e) {
    if (e !== SKIP) problems.push(`[${tag}] (j) stopped: ${String(e.message).split('\n')[0]}`);
  }

  // ---------------------------------------------------------------- (k) THE BIGGEST TEXT
  try {
    if (!only.includes('k')) throw SKIP;
    for (let i = 0; i < 2; i++) await say(page, 'bigger text');
    await until(page, () => document.documentElement.dataset.body === '21', null, 8000, `[${tag}] (k) "bigger text" twice did not make BODY 21`);
    for (const [id, sel] of [['interpreter', '#pg-interpreter'], ['lab', '#pg-lab'], ['rehearse', '#pg-rehearse']]) {
      await go(page, id, 1500);
      check((await sideways(page, `${sel} *`)).length === 0, `[${tag}] (k) ${id} at the biggest text sticks out sideways: ${(await sideways(page, `${sel} *`)).join('; ')}`);
      check((await small(page, sel)).length === 0, `[${tag}] (k) ${id} at the biggest text has a control under 44 pt: ${(await small(page, sel)).join('; ')}`);
      const cut = await page.$$eval(`${sel} :is(button, .fxhead, .labq, .rhlab, .fxpair label span)`, (els) => els.filter((e) => e.getClientRects().length && e.scrollWidth > e.clientWidth + 1).slice(0, 4).map((e) => `"${(e.textContent || '').trim().slice(0, 24)}" ${e.scrollWidth}/${e.clientWidth}`));
      check(!cut.length, `[${tag}] (k) ${id} at the biggest text cuts words: ${cut.join(' | ')}`);
    }
    await page.screenshot({ path: `${out}/further-${tag}-biggest.png` });
  } catch (e) {
    if (e !== SKIP) problems.push(`[${tag}] (k) stopped: ${String(e.message).split('\n')[0]}`);
  }

  await ctx.close();
}

// VIEW=440 runs one size while a thing is being built; the whole spec runs both
if (process.env.VIEW !== '390') await run(PHONE);
if (process.env.VIEW !== '440') await run(SMALL);

// ---- (e) again with Reduce Motion on: the pointer's pulse is still
if (only.includes('e')) {
  const { ctx, page } = await open(PHONE, { reduced: true });
  try {
    await stubs(ctx, { translated: [], memory: [], items: [], places: [], spending: null, fed: [] });
    await boot(page);
    await say(page, 'walk me through the library');
    await page.waitForSelector('#fxwalk .fxptr', { state: 'visible', timeout: 15000 });
    const anim = await page.evaluate(() => getComputedStyle(document.querySelector('#fxwalk .fxptr')).animationName);
    check(anim === 'none', `[reduced] (e) the pointer still pulses with Reduce Motion on (animation: ${anim})`);
  } catch (e) {
    problems.push(`[reduced] (e) stopped: ${String(e.message).split('\n')[0]}`);
  }
  await ctx.close();
}

await browser.close();
if (problems.length) {
  console.error(`further: ${problems.length} problem(s)\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('further: OK');
