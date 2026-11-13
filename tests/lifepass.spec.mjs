// QUALITY PASS: LIFE (BRIEF-QUALITY-LIFE): the eight packs measured and made right, nothing new added. One check for each of the
// eighty fixes (ten a pack, each named for the rough spot it closes: M = MONEY, B = BODY, K = KITCHEN, P = PEOPLE, W = WORK,
// C = CREATIVE, O = OUTSIDE, H = HOME), at 440 × 956 and 390 × 844, against the preview's real brain (no model needed), with the
// phone's GPS, camera and signal stood in by flags the checks flip (window.__geo, __cam, __off, __noBlob). Besides them, for every pack:
// nothing sideways, every control 44 pt, the chat phrase listed on its screen opens its sheet, and the biggest text (BODY 21) clips nothing.
// Stills (440 only), before and after a fix pass: LIFE_STILL=before|after names them tests/.shots/lifepass-<pack>-440-<before|after>.png.
//   BASE=http://localhost:8826 NO_GL_SHOTS=1 node tests/lifepass.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, standDown } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const STILL = process.env.LIFE_STILL ?? 'after';
const problems = [];
let checks = 0;
const t0 = Date.now();
let lastAt = Date.now();
const gaps = [];
const check = (ok, msg) => {
  checks++;
  if (Date.now() - lastAt > 3500) gaps.push(`${((Date.now() - lastAt) / 1000).toFixed(1)} s before: ${msg.slice(0, 70)}`);
  lastAt = Date.now();
  if (!ok) {
    problems.push(msg);
    console.log(`  red: ${msg.slice(0, 220)}`);
  }
};
async function block(name, fn) {
  if (process.env.ONLY && !process.env.ONLY.split(',').some((k) => name.startsWith(k))) return;
  if (process.env.ONLYW && !name.endsWith(process.env.ONLYW)) return;
  try {
    await fn();
  } catch (e) {
    problems.push(`${name}: the check stopped: ${String(e.message ?? e).split('\n')[0].slice(0, 160)}`);
  }
}
const log = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s · ${s}`);
await standDown(base, KEY);
const api = (path, body) => fetch(`${base}/api${path}`, { method: body ? 'POST' : 'GET', headers: { 'x-ghosty': '1', 'x-ghosty-key': KEY, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }).then((r) => r.json()).catch(() => ({}));
const pk = (packName, action, args = {}) => api('/packs/do', { pack: packName, action, args });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RAW = /aborted|fetch failed|undefined|\[object Object\]|TypeError|NetworkError|Failed to|Load failed|HTTP \d/i;
const words = (s) => (s.trim().match(/\S+/g) ?? []).length;

/** The brain's own keeping, put back as a fresh phone would find it (what a check seeds is wiped before the next). */
async function wipe() {
  const people = (await pk('people', 'who', { words: 'everyone' })).data?.people ?? [];
  const todo = (await pk('work', 'todo', { words: '' })).data?.list ?? [];
  const bills = (await pk('homeadmin', 'bills', {})).data?.bills ?? [];
  const plan = (await pk('people', 'plan', { words: '' })).data?.plan;
  await Promise.all([
    ...people.map((p) => pk('people', 'forget', { who: p.name })),
    ...(plan ? [pk('people', 'plan', { words: 'cancel the plan' })] : []),
    ...todo.map((t) => pk('work', 'todo', { words: `tick ${t.text}` })),
    ...bills.map((b) => pk('homeadmin', 'paid', { id: b.id, remove: true })),
    ...['Thames Water', 'Octopus Energy'].map((n) => pk('homeadmin', 'paid', { words: `forget ${n}` })),
    pk('homeadmin', 'bins', { words: 'forget my bins' }),
    pk('homeadmin', 'meter', { words: 'forget all my meter readings' }),
    pk('homeadmin', 'inventory', { words: 'forget everything' }),
    pk('outside', 'parked', { words: 'forget' }),
    pk('kitchen', 'shop', { words: 'clear' }),
    pk('kitchen', 'plan', { days: ['', '', '', '', '', '', ''] }),
    fetch(`${base}/api/profile/spending`, { method: 'DELETE', headers: { 'x-ghosty': '1', 'x-ghosty-key': KEY } }).catch(() => undefined),
  ]);
  await pk('work', 'todo', { words: 'clear done' });
}

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });

/** The stand-in pose model: standing, then squats, as the packs spec does. */
const STAND_IN = () => {
  const blank = () => Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
  const legs = (deg) => {
    const p = blank();
    const hip = { x: 0.5, y: 0.4 }, knee = { x: 0.5, y: 0.6 }, a = ((180 - deg) * Math.PI) / 180;
    const ankle = { x: knee.x + 0.2 * Math.sin(a), y: knee.y + 0.2 * Math.cos(a) };
    for (const [i, m] of [[23, hip], [24, hip], [25, knee], [26, knee], [27, ankle], [28, ankle]]) p[i] = { ...m, visibility: 0.95 };
    return p;
  };
  let first = 0;
  window.__ghostyPoseEngine = { detect: (_v, t) => { first ||= t; const k = Math.floor((t - first) / 500); return legs(k >= 1 && k <= 6 && k % 2 === 1 ? 80 : 175); }, close: () => undefined };
};

async function phone(viewport, o = {}) {
  const ctx = await browser.newContext({ viewport, screen: viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ...UK, serviceWorkers: 'block', permissions: ['camera'] });
  const page = await ctx.newPage();
  page.setDefaultTimeout(5000);
  // (a fixed wait is shortened: the checks wait for what they need by its own signal, and the machine is shared)
  const pause = page.waitForTimeout.bind(page);
  page.waitForTimeout = (ms) => pause(Math.max(100, Math.round(ms * 0.45)));
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${viewport.width}] pageerror: ${e.message}`));
  await page.addInitScript(({ key, body }) => {
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.themes1', '1');
    localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Tony', speak: false, sounds: false, theme: 'reactor', favourites: [], look: { ground: 'graphite', world: 'scan', night: 'graphite', switches: body ? { body } : {} }, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
    window.__ghostyHero = true;
    window.__ghostyPlace = { none: true };
    // the phone's signal, position and camera, and a picture that will not be made: flipped by the checks
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => window.__off !== true });
    const real = navigator.geolocation;
    const geo = { getCurrentPosition: (ok, bad) => (window.__geo === 'deny' ? bad({ code: 1, message: 'User denied Geolocation' }) : ok({ coords: { latitude: 51.5, longitude: -0.12, accuracy: 12 }, timestamp: Date.now() })), watchPosition: (ok, bad) => (window.__geo === 'deny' ? (bad({ code: 1, message: 'User denied Geolocation' }), 1) : real.watchPosition(ok, bad)), clearWatch: (i) => real.clearWatch(i) };
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: geo });
    const gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = (c) => (window.__cam === 'deny' ? Promise.reject(new DOMException('Permission denied', 'NotAllowedError')) : gum(c));
    const tb = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (cb, ...r) { return window.__noBlob ? cb(null) : tb.call(this, cb, ...r); };
    // every waiting line, with the moment it came and went (ui/wait.ts)
    window.__waits = [];
    new MutationObserver((ms) => {
      const lines = (n) => (n.nodeType === 1 ? [...(n.matches?.('[data-wait]') ? [n] : []), ...n.querySelectorAll('[data-wait]')] : []);
      for (const m of ms) {
        for (const n of m.addedNodes) for (const l of lines(n)) window.__waits.push({ w: l.dataset.wait, in: Math.round(performance.now()) });
        for (const n of m.removedNodes) for (const l of lines(n)) window.__waits.push({ w: l.dataset.wait, out: Math.round(performance.now()) });
      }
    }).observe(document, { childList: true, subtree: true });
    if (/stand/.test(location.search)) window.__standIn = 1;
  }, { key: KEY, body: o.body ?? 0 });
  if (o.standIn) await ctx.addInitScript(STAND_IN);
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
  await page.waitForTimeout(1200);
  return { ctx, page };
}

/** A pack's screen open on a pill: the page is drawn when the pill is picked. */
async function open(page, id, pill, ready = true) {
  await page.evaluate((t) => (location.hash = t), id);
  await page.waitForFunction((t) => document.body.dataset.tab === t && window.__ghosty?.sheetpages?.[t]?.ready, id, { timeout: 15000 }).catch(() => problems.push(`${id}: the screen did not open`));
  if (pill) await page.locator(`#pg-${id} .secpills .secpill`, { hasText: new RegExp(`^${pill}$`) }).first().click().catch(() => problems.push(`${id}: no "${pill}" pill`));
  if (ready) await page.waitForSelector(`#pg-${id} .pn:not([hidden]) .pk > *`, { timeout: 8000 }).catch(() => problems.push(`${id}/${pill}: the page was not drawn`));
  await page.waitForTimeout(250);
}
const PK = (id) => `#pg-${id} .pn:not([hidden]) .pk`;
const txt = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].map((e) => e.textContent ?? '').join(' | '), sel);
const count = (page, sel) => page.locator(sel).count();
/** The words of a state that is drawn once the brain has answered: waited for, not guessed at. */
const stateText = async (page, sel) => (await page.waitForSelector(sel, { timeout: 5000 }).catch(() => undefined), page.evaluate((q) => document.querySelector(q)?.textContent ?? '', sel));
const waitsSince = (page, n) => page.evaluate((k) => window.__waits.slice(k).filter((x) => x.in !== undefined).map((x) => x.w), n);
const waitsN = (page) => page.evaluate(() => window.__waits.length);
const until = (page, fn, arg, ms = 8000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
/** A request the brain answers slowly (ms), or never (abort), for the pack's one endpoint. */
async function slow(page, match, ms) {
  await page.route(match, async (r) => (await sleep(ms), r.continue().catch(() => undefined)));
}
const cut = (page, match) => page.route(match, (r) => r.abort('failed'));
const PACKS = /\/api\/packs\/do/;
const unroute = (page) => page.unrouteAll({ behavior: 'ignoreErrors' });
const small = (page, sel) => page.$$eval(`${sel} :is(button, input:not([type=hidden]):not([type=file]), textarea, select, [role=button])`, (els) => els
  .filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]'))
  .map((e) => {
    const t = /^(checkbox|radio)$/.test(e.type ?? '') ? e.closest('label') ?? e : e;
    const r = { width: t.offsetWidth || t.getBoundingClientRect().width, height: t.offsetHeight || t.getBoundingClientRect().height };
    return r.width >= 43.5 && r.height >= 43.5 ? '' : `${t.tagName.toLowerCase()} "${(t.getAttribute('aria-label') || t.textContent || '').trim().slice(0, 24)}" ${Math.round(r.width)}×${Math.round(r.height)}`;
  }).filter(Boolean).slice(0, 5));
const sideways = (page, id) => page.evaluate((t) => document.documentElement.scrollWidth > innerWidth + 1 || [...document.querySelectorAll(`#pg-${t} .pn:not([hidden]) *`)].some((e) => { if (!e.getClientRects().length) return false; for (let p = e.parentElement; p; p = p.parentElement) if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX) && p.id !== `pg-${t}`) return false; const r = e.getBoundingClientRect(); return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1); }), id);

/** The generic bar for every page of a pack: nothing sideways, every control 44 pt, no raw browser string anywhere. */
async function bar(page, tag, id) {
  check(!(await sideways(page, id)), `${tag}: sideways`);
  const s = await small(page, PK(id));
  check(!s.length, `${tag}: under 44 pt: ${s.join(', ')}`);
  const t = await txt(page, `${PK(id)} *`);
  check(!RAW.test(t), `${tag}: a raw string on the page: ${(RAW.exec(t) ?? [''])[0]}`);
}
/** The chat phrase each screen lists: read from the screen now, said in the chat after the packs (one visit to the chat, not eight). */
const chatPhrases = [];
async function phraseOpens(page, id, packName, tag) {
  const says = await page.evaluate((s) => document.querySelector(`#pg-${s} .pkphrases`)?.dataset.says ?? '', id);
  check(says.length > 0, `${tag}: the screen lists no phrase (.pkphrases)`);
  check(words(await txt(page, `#pg-${id} .pkphrases`)) <= 22, `${tag}: the phrases line is over one line of words`);
  // (the chat's door is the same at both widths: it is opened at 440)
  if (says && page.viewportSize().width === 440) chatPhrases.push({ packName, first: says.split('|')[0], tag });
}
async function chatDoor(page) {
  if (!chatPhrases.length) return;
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(600);
  if (!(await page.evaluate(() => !!document.querySelector('.hud.core.logopen')))) await page.locator('.logbtn:visible').first().click().catch(() => undefined);
  await page.waitForSelector('#cin', { state: 'visible', timeout: 8000 }).catch(() => problems.push('the chat’s box did not open'));
  for (const { packName, first, tag } of chatPhrases.splice(0)) {
    await page.fill('#cin', first);
    await page.press('#cin', 'Enter');
    let ok = await page.waitForSelector(`.modal [data-pack="${packName}"]`, { timeout: 6000 }).then(() => true, () => false);
    if (!ok) {
      // (a phrase the chat answers in words, with a chip that opens the sheet)
      const chip = page.locator('#pg-core .msg:not(.me) :is(button, a):visible', { hasText: /^open (the .* sheet|it again|it)$/i }).last();
      if (await chip.count()) await chip.click().catch(() => undefined);
      ok = await page.waitForSelector(`.modal [data-pack="${packName}"]`, { timeout: 8000 }).then(() => true, () => false);
    }
    check(ok, `${tag}: saying "${first}" did not open the ${packName} sheet`);
    await page.evaluate(() => document.querySelector('.modal .mhead button')?.click());
    await page.waitForTimeout(300);
  }
}
const still = (page, name, vp) => (vp.width === 440 ? page.screenshot({ path: `${out}/lifepass-${name}-440-${STILL}.png` }).catch(() => undefined) : undefined);

const CSV = 'Date,Description,Amount\n2026-10-02,SAINSBURYS,-31.20\n2026-10-03,GREGGS,-3.45\n2026-10-04,TRAINLINE,-22.10\n2026-10-05,PAYROLL ACME,1500.00\n';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const day = (n) => new Date(Date.now() + n * 864e5).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

for (const vp of [PHONE, { width: 390, height: 844 }]) {
  const W = vp.width;
  const { ctx, page } = await phone(vp, { standIn: true });
  await wipe();

  // ================================================================ MONEY
  await block(`money ${W}`, async () => {
    log(`money ${W}`);
    const T = `[money ${W}]`;
    await open(page, 'money');
    const P = PK('money');
    check((await count(page, `${P} [data-state="empty"]`)) === 1 && /Nothing kept yet/.test(await txt(page, `${P} [data-state="empty"]`)) && /Paste one below/.test(await txt(page, `${P} [data-state="empty"]`)), `${T} M1 empty: no statement kept shows "Nothing kept yet" and the one next thing`);
    await still(page, 'money', vp);
    check(words(await txt(page, '#pg-money .hero .sub')) <= 14, `${T} M8 words: the screen's line is over one short line (${words(await txt(page, '#pg-money .hero .sub'))} words)`);
    const notes = await page.$$eval(`${P} .pknote`, (n) => n.map((x) => x.textContent ?? ''));
    check(notes.every((n) => words(n) <= 20 && !/table of rules|\bcode\b|No AI/i.test(n)), `${T} M8 words: a note is long or in jargon: ${notes.filter((n) => words(n) > 20 || /table of rules|\bcode\b|No AI/i.test(n)).join(' / ').slice(0, 160)}`);
    // M4: Read it with nothing in the box
    await page.click(`${P} button[aria-label="Read the pasted statement"]`);
    await page.waitForTimeout(200);
    check(/Paste a statement first/.test(await txt(page, `${P} .pknote`)), `${T} M4 a tap on Read it with an empty box says what to do`);
    // M5: an empty file
    await page.setInputFiles(`${P} input[type=file]`, { name: 'empty.csv', mimeType: 'text/csv', buffer: Buffer.from('') });
    await page.waitForTimeout(500);
    check(/nothing in that file/i.test(await txt(page, `${P} .pknote`)), `${T} M5 an empty file says so in his words`);
    // M3: a failed read keeps what he pasted, in his words
    await cut(page, /\/api\/profile\/spending\/import/);
    await page.fill(`${P} textarea`, CSV);
    await page.click(`${P} button[aria-label="Read the pasted statement"]`);
    await page.waitForSelector(`${P} [data-state="error"]`, { timeout: 15000 }).catch(() => undefined);
    check((await page.inputValue(`${P} textarea`)) === CSV, `${T} M3 a failed read keeps what he pasted`);
    check((await count(page, `${P} [data-state="error"]`)) === 1 && !RAW.test(await txt(page, `${P} [data-state="error"]`)), `${T} M3 a failed read shows one error in his words`);
    await unroute(page);
    // M2 and M10: the wait said; the numbers to the penny, from the statement
    await slow(page, /\/api\/profile\/spending\/import/, 1600);
    const n0 = await waitsN(page);
    await page.click(`${P} button[aria-label="Read the pasted statement"]`);
    await page.waitForTimeout(500);
    check((await count(page, `${P} [data-wait="Reading your statement…"]`)) === 1, `${T} M2 the read says "Reading your statement…" while it waits`);
    await until(page, () => window.__ghosty?.money?.read >= 1, null, 15000);
    await page.waitForTimeout(300);
    check((await count(page, `${P} [data-wait]`)) === 0, `${T} M2 the wait goes when the read lands`);
    const said = await txt(page, `${P} .pknote`);
    check(/from your statement/i.test(said) && (said.match(/£[\d,]+(\.\d+)?/g) ?? []).length > 0 && (said.match(/£[\d,]+(\.\d+)?/g) ?? []).every((m) => /\.\d{2}$/.test(m)), `${T} M10 every amount is to the penny and said to be from his statement: ${said.slice(0, 200)}`);
    check((await count(page, `${P} [data-state="empty"]`)) === 0, `${T} M1 the empty state goes once a statement is kept`);
    await unroute(page);
    // M7: a file's name and size said while it opens
    const n1 = await waitsN(page);
    await page.setInputFiles(`${P} input[type=file]`, { name: 'october.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV) });
    await page.waitForTimeout(400);
    check((await waitsSince(page, n1)).some((x) => /^Opening october\.csv, \d+(\.\d)? ?(bytes|KB|MB)…$/.test(x)), `${T} M7 a file opens under its name and size: ${JSON.stringify(await waitsSince(page, n1))}`);
    // M6: no signal
    await page.evaluate(() => (window.__off = true));
    await open(page, 'money');
    await page.evaluate(() => (location.hash = 'core'));
    await page.waitForTimeout(300);
    await open(page, 'money');
    check((await count(page, `${P} [data-state="offline"]`)) === 1, `${T} M6 offline: the screen says what still works`);
    await page.evaluate(() => (window.__off = false));
    await bar(page, `${T} bar`, 'money');
    await phraseOpens(page, 'money', 'money', `${T} M9 phrases`);
    await wipe();
  });

  // ================================================================ BODY
  await block(`body ${W}`, async () => {
    log(`body ${W}`);
    const T = `[body ${W}]`;
    await open(page, 'body', 'Reps');
    const P = PK('body');
    const geom = await page.evaluate(() => ({ b: document.querySelector('.pn:not([hidden]) button[aria-label="Start counting"]')?.getBoundingClientRect().bottom ?? 9999, dock: document.querySelector('#dock')?.getBoundingClientRect().top ?? 0, off: !!document.querySelector('.pn:not([hidden]) .pkstage [data-state="empty"]') }));
    check(geom.b <= geom.dock - 4, `${T} B1 START is in reach above the dock (bottom ${Math.round(geom.b)}, dock ${Math.round(geom.dock)})`);
    check(geom.off, `${T} B1 the camera's stage says it is off, never a black block`);
    await still(page, 'body', vp);
    // B3: the camera's refusal, once, in his words
    await page.evaluate(() => (window.__cam = 'deny'));
    await page.click(`${P} button[aria-label="Start counting"]`);
    await page.waitForTimeout(600);
    const refuse = await txt(page, `${P} [data-state="error"]`);
    check((await count(page, `${P} [data-state="error"]`)) === 1 && /Settings, Ghosty, Camera/.test(refuse) && !/Safari/.test(refuse), `${T} B3 the camera's refusal is said once in his words with how to allow it: "${refuse}"`);
    await page.evaluate(() => (window.__cam = ''));
    // B4 and B2: the camera's wait said, and a STOP
    const n0 = await waitsN(page);
    await page.click(`${P} button[aria-label="Start counting"]`);
    await page.waitForTimeout(300);
    check((await waitsSince(page, n0)).includes('Opening the camera…'), `${T} B4 the camera's opening is said as a wait: ${JSON.stringify(await waitsSince(page, n0))}`);
    await until(page, () => window.__ghosty?.body?.camera === 'on', null, 15000);
    await until(page, () => window.__ghosty?.body?.engine === 'stand-in', null, 15000);
    await page.waitForTimeout(500);
    const stop = page.locator(`${P} button[aria-label="Stop counting"]`);
    check((await stop.count()) === 1 && ((await stop.boundingBox())?.height ?? 0) >= 43.5, `${T} B2 a STOP at 44 pt is there while it counts`);
    await stop.click().catch(() => undefined);
    await page.waitForTimeout(300);
    check((await page.evaluate(() => window.__ghosty.body.camera)) === 'off', `${T} B2 STOP puts the camera off`);
    await bar(page, `${T} reps bar`, 'body');
    // B5, B6: the run
    await open(page, 'body', 'Run');
    const run = await txt(page, `${P}`);
    check(/measured by the phone/.test(run) && /min per km/.test(run), `${T} B5 a run's distance is "measured by the phone" and its pace is in min per km: ${run.slice(0, 160)}`);
    const rb = await page.$$eval(`${P} button`, (b) => b.map((x) => (x.textContent ?? '').trim()));
    check(!rb.some((x) => /^run saved$/i.test(x)) && rb.some((x) => /^stop and keep$/i.test(x)), `${T} B6 the run's keys are START and "Stop and keep" (not "Run saved"): ${rb.join(', ')}`);
    await bar(page, `${T} run bar`, 'body');
    // B8, B9: a Health export that is no export, in his words, with its wait said
    await open(page, 'body', 'Health');
    check((await count(page, `${P} [data-state="empty"]`)) === 1, `${T} B9 health: nothing read yet is a designed state`);
    const n1 = await waitsN(page);
    await page.setInputFiles(`${P} input[type=file]`, { name: 'export.zip', mimeType: 'application/zip', buffer: Buffer.from('this is not a zip file at all, not even close') });
    await page.waitForTimeout(500);
    check((await waitsSince(page, n1)).some((x) => /^Reading your Health export/.test(x)), `${T} B9 reading the export says what it is doing: ${JSON.stringify(await waitsSince(page, n1))}`);
    await page.waitForSelector(`${P} [data-state="error"]`, { timeout: 8000 }).catch(() => undefined);
    const he = await txt(page, `${P} [data-state="error"]`);
    check(/Health export/.test(he) && !/export\.xml|zip/.test(he), `${T} B8 a wrong file is said in his words: "${he}"`);
    await bar(page, `${T} health bar`, 'body');
    // B10: water with no brain
    await cut(page, PACKS);
    await open(page, 'body', 'Water');
    await page.waitForTimeout(1500);
    const wc = await txt(page, `${P} b.pkbig`);
    check((await count(page, `${P} [data-state="error"]`)) >= 1 && wc.trim() !== '…' && !RAW.test(await txt(page, `${P} [data-state="error"]`)), `${T} B10 water with no brain says so in his words and never hangs on "…" (count: "${wc}")`);
    await unroute(page);
    await open(page, 'body', 'Water');
    await bar(page, `${T} water bar`, 'body');
    await open(page, 'body', 'Breathe');
    await bar(page, `${T} breathe bar`, 'body');
    await open(page, 'body', 'Stretch');
    await bar(page, `${T} stretch bar`, 'body');
    await open(page, 'body', 'Reps');
    await phraseOpens(page, 'body', 'body', `${T} B11 phrases`);
  });

  // ================================================================ KITCHEN
  await block(`kitchen ${W}`, async () => {
    log(`kitchen ${W}`);
    const T = `[kitchen ${W}]`;
    await page.evaluate(() => { localStorage.removeItem('ghosty:timers'); window.__ghostyClockOffset = 0; });
    await open(page, 'kitchen', 'Timers');
    const P = PK('kitchen');
    check((await count(page, `${P} [data-state="empty"]`)) === 1 && /timer/i.test(await txt(page, `${P} [data-state="empty"]`)), `${T} K2 timers: none running is a designed state with the one next thing`);
    check(!(await page.locator(`${P} button:visible`, { hasText: /^Stop all$/ }).count()), `${T} K5 no "Stop all" while nothing runs`);
    await still(page, 'kitchen', vp);
    await page.fill(`${P} .pkadd input`, 'banana');
    await page.click(`${P} button[aria-label="Set the timer"]`);
    await page.waitForTimeout(200);
    check((await count(page, `${P} [data-state="error"]`)) === 1 && /how long/i.test(await txt(page, `${P} [data-state="error"]`)), `${T} K4 words that are no timer are answered in the page, not a toast`);
    await page.fill(`${P} .pkadd input`, '8 minutes for the pasta');
    await page.click(`${P} button[aria-label="Set the timer"]`);
    await page.waitForSelector(`${P} .pktimer`, { timeout: 5000 }).catch(() => undefined);
    await page.evaluate(() => (window.__ghostyClockOffset = 8 * 60 * 1000 + 1500));
    const rang = await page.waitForSelector(`${P} .pktimer.ringing`, { timeout: 6000 }).then(() => true, () => false);
    check(rang, `${T} K1 the timer rang`);
    const ringTxt = await txt(page, `${P} .pktimer.ringing b`);
    check(rang && ringTxt.trim() !== '0:00' && /up|done|ring/i.test(await txt(page, `${P} .pktimer.ringing`)), `${T} K3 a ringing timer says it is up, in words, not "0:00" ("${ringTxt}")`);
    await page.locator(`${P} .pktimer.ringing span`).first().click().catch(() => undefined);
    await page.waitForTimeout(500);
    check((await count(page, `${P} .pktimer`)) === 0, `${T} K1 one tap anywhere on a ringing card stops it`);
    await page.evaluate(() => (window.__ghostyClockOffset = 0));
    await bar(page, `${T} timers bar`, 'kitchen');
    // shopping
    await pk('kitchen', 'shop', { words: 'clear' });
    await slow(page, PACKS, 1600);
    await open(page, 'kitchen', 'Shopping', false);
    await page.waitForTimeout(600);
    check((await count(page, `${P} [data-wait="Opening your list…"]`)) === 1 && !/list is empty|Nothing on the list/i.test(await txt(page, P)), `${T} K6 shopping says "Opening your list…" and never claims the list empty while it waits`);
    await unroute(page);
    await open(page, 'kitchen', 'Shopping');
    await page.waitForTimeout(800);
    check((await count(page, `${P} [data-state="empty"]`)) === 1 && /Nothing on the list/.test(await txt(page, `${P} [data-state="empty"]`)), `${T} K8 an empty list is a designed state: "Nothing on the list"`);
    await cut(page, PACKS);
    await open(page, 'kitchen', 'Timers');
    await open(page, 'kitchen', 'Shopping', false);
    await page.waitForSelector(`${P} [data-state="error"]`, { timeout: 8000 }).catch(() => undefined);
    check((await count(page, `${P} [data-state="error"]`)) >= 1 && !/list is empty|Nothing on the list/i.test(await txt(page, P)) && !RAW.test(await txt(page, P)), `${T} K7 a brain that does not answer is said in his words, and the list is not called empty`);
    await unroute(page);
    // plan
    await open(page, 'kitchen', 'Meal plan');
    await page.waitForTimeout(500);
    await page.fill(`${P} input[aria-label="Mon’s dinner"]`, 'chilli');
    await slow(page, PACKS, 1600);
    await page.click(`${P} button:has-text("Save the week")`);
    await page.waitForTimeout(500);
    check((await count(page, `${P} [data-wait="Saving the week…"]`)) === 1, `${T} K9 saving the week says "Saving the week…"`);
    await until(page, () => /Saved: 1 dinner/.test(document.querySelector('.pn:not([hidden]) .pk .pknote:last-child')?.textContent ?? '') || /Saved: 1 dinner/.test(document.body.innerText), null, 10000);
    check(/Saved: 1 dinner kept/.test(await txt(page, P)), `${T} K9 saved says how many dinners were kept: "${(await txt(page, `${P} .pknote`)).slice(0, 80)}"`);
    await unroute(page);
    await bar(page, `${T} plan bar`, 'kitchen');
    await open(page, 'kitchen', 'Timers');
    await phraseOpens(page, 'kitchen', 'kitchen', `${T} K10 phrases`);
    await wipe();
  });

  // ================================================================ PEOPLE
  await block(`people ${W}`, async () => {
    log(`people ${W}`);
    const T = `[people ${W}]`;
    await open(page, 'people', 'Your people');
    const P = PK('people');
    await page.waitForTimeout(500);
    const em = await stateText(page, `${P} [data-state="empty"]`);
    check(/Tell me about someone\./.test(em) && (await page.locator(`${P} input[aria-label="Who you are telling me about"]`).isVisible()), `${T} P1 with no one: "Tell me about someone." and the field`);
    await still(page, 'people', vp);
    await page.click(`${P} button[aria-label="Keep what I said about them"]`);
    await page.waitForTimeout(200);
    check(/name and one thing/i.test(await txt(page, `${P} .pknote`)), `${T} P4 Keep it with the fields empty says what it needs`);
    await cut(page, PACKS);
    await page.fill(`${P} input[aria-label="Who you are telling me about"]`, 'Sam');
    await page.fill(`${P} input[aria-label="What to remember about them"]`, 'loves fishing');
    await page.click(`${P} button[aria-label="Keep what I said about them"]`);
    await page.waitForTimeout(1200);
    check((await page.inputValue(`${P} input[aria-label="Who you are telling me about"]`)) === 'Sam' && (await page.inputValue(`${P} input[aria-label="What to remember about them"]`)) === 'loves fishing', `${T} P5 a failed keep leaves what he typed`);
    await unroute(page);
    // P3: the list when the brain does not answer
    await cut(page, PACKS);
    await open(page, 'people', 'Group plan');
    await open(page, 'people', 'Your people', false);
    await page.waitForSelector(`${P} [data-state="error"]`, { timeout: 8000 }).catch(() => undefined);
    const tryAgain = page.locator(`${P} [data-state="error"] button, ${P} button:has-text("Try again")`).first();
    check((await count(page, `${P} [data-state="error"]`)) >= 1 && (await tryAgain.count()) === 1 && ((await tryAgain.boundingBox())?.height ?? 0) >= 43.5 && !/Tell me about someone/.test(await txt(page, P)), `${T} P3 a brain that is silent is said, with a TRY AGAIN at 44 pt, and the list is not called empty`);
    await unroute(page);
    // P2: loading
    await slow(page, PACKS, 1600);
    await open(page, 'people', 'Group plan');
    await open(page, 'people', 'Your people', false);
    await page.waitForTimeout(600);
    check((await count(page, `${P} [data-wait="Opening your people…"]`)) === 1 && !/Tell me about someone/.test(await txt(page, P)), `${T} P2 the list says "Opening your people…" while it waits`);
    await unroute(page);
    // P6, P7, P8
    await pk('people', 'birthday', { who: 'Ali', words: `Ali birthday ${day(8).replace(/ \d{4}$/, '')}` });
    await open(page, 'people', 'Group plan');
    await open(page, 'people', 'Your people');
    await page.waitForTimeout(600);
    check(/birthday .*in \d+ days|birthday .*(today|tomorrow)/.test(await txt(page, `${P} .pkperson`)), `${T} P6 a birthday says how far off it is: "${(await txt(page, `${P} .pkperson .pklab`)).slice(0, 80)}"`);
    const det = page.locator(`${P} .pkperson button:has-text("etails")`);
    check((await det.getAttribute('aria-expanded')) === 'false', `${T} P8 Details says whether it is open (aria-expanded false)`);
    await det.click();
    check((await det.getAttribute('aria-expanded')) === 'true' && /Hide/.test((await det.textContent()) ?? ''), `${T} P8 Details turns to HIDE when open`);
    await slow(page, PACKS, 1600);
    const n0 = await waitsN(page);
    await page.click(`${P} button[aria-label="Gift ideas for Ali"]`);
    await page.waitForTimeout(500);
    check((await waitsSince(page, n0)).some((x) => /^Thinking of gifts for Ali/.test(x)), `${T} P7 gift ideas say what they are doing: ${JSON.stringify(await waitsSince(page, n0))}`);
    await unroute(page);
    await bar(page, `${T} who bar`, 'people');
    // P9
    await open(page, 'people', 'Group plan');
    await page.waitForTimeout(500);
    const pe = await stateText(page, `${P} [data-state="empty"]`);
    check(pe.length > 0 && words(pe) <= 24 && /plan:/.test(pe), `${T} P9 no plan is a designed state with the one next thing ("${pe.slice(0, 120)}")`);
    await bar(page, `${T} plan bar`, 'people');
    await open(page, 'people', 'Your people');
    await phraseOpens(page, 'people', 'people', `${T} P10 phrases`);
    await wipe();
  });

  // ================================================================ WORK
  await block(`work ${W}`, async () => {
    log(`work ${W}`);
    const T = `[work ${W}]`;
    await open(page, 'work', 'To-do');
    const P = PK('work');
    await page.waitForTimeout(500);
    check((await count(page, `${P} [data-state="empty"]`)) === 1 && /Your list is clear/.test(await txt(page, `${P} [data-state="empty"]`)), `${T} W1 an empty list is "Your list is clear" with the next thing`);
    await still(page, 'work', vp);
    await slow(page, PACKS, 1600);
    await open(page, 'work', 'Interview');
    await open(page, 'work', 'To-do', false);
    await page.waitForTimeout(600);
    check((await count(page, `${P} [data-wait="Opening your list…"]`)) === 1 && !/Your list is clear/.test(await txt(page, P)), `${T} W2 the list says "Opening your list…" and is not called clear while it waits`);
    await unroute(page);
    await cut(page, PACKS);
    await open(page, 'work', 'Interview');
    await open(page, 'work', 'To-do', false);
    await page.waitForSelector(`${P} [data-state="error"]`, { timeout: 8000 }).catch(() => undefined);
    check((await count(page, `${P} [data-state="error"]`)) >= 1 && !/Your list is clear/.test(await txt(page, P)) && !RAW.test(await txt(page, P)), `${T} W3 a silent brain is said in his words, and the list is not called clear`);
    await unroute(page);
    await pk('work', 'todo', { words: 'add: send the invoice by Friday' });
    await open(page, 'work', 'Interview');
    await open(page, 'work', 'To-do');
    await page.waitForTimeout(600);
    const item = await txt(page, `${P} .pkitem`);
    check(/due (tomorrow|today|in \d+ days)/.test(item) && !/\d{4}-\d{2}-\d{2}/.test(item), `${T} W4 a job's day is said as "due tomorrow", never as 2026-11-13: "${item}"`);
    // W9: a tick that the brain did not take
    await cut(page, PACKS);
    await page.locator(`${P} .pkitem input[type=checkbox]`).first().click();
    await page.waitForTimeout(1200);
    check(!(await page.locator(`${P} .pkitem input[type=checkbox]`).first().isChecked()) && (await count(page, `${P} [data-state="error"]`)) >= 1, `${T} W9 a tick the brain did not take is put back, and said`);
    await unroute(page);
    await bar(page, `${T} todo bar`, 'work');
    // W5, W6: the interview
    await open(page, 'work', 'Interview');
    await page.click(`${P} button[aria-label="Start the timer for your answer"]`);
    await page.evaluate(() => (window.__ghostyClockOffset = 62000));
    await page.fill(`${P} textarea`, 'I led a team of four at the shop and we cut waiting times by ten minutes in March.');
    await slow(page, PACKS, 1600);
    const n0 = await waitsN(page);
    await page.click(`${P} button[aria-label="Stop the timer and critique my answer"]`);
    await page.waitForTimeout(500);
    check((await waitsSince(page, n0)).includes('Looking at your answer…'), `${T} W6 the critique says "Looking at your answer…": ${JSON.stringify(await waitsSince(page, n0))}`);
    await until(page, () => window.__ghosty?.work?.interview?.answered >= 1, null, 12000);
    await unroute(page);
    const crit = await txt(page, `${P} pre`);
    check(/\d+ seconds, measured/.test(crit) && !/^Shape:|^Specifics:/m.test(crit), `${T} W5 the critique is plain and says the time as "N seconds, measured": ${crit.slice(0, 160)}`);
    await page.evaluate(() => (window.__ghostyClockOffset = 0));
    await bar(page, `${T} interview bar`, 'work');
    // W7: no document yet
    await open(page, 'work', 'Document');
    const de = await txt(page, `${P} [data-state="empty"]`);
    check(de.length > 0 && words(de) <= 20, `${T} W7 no document yet is a designed state in one short line (${words(de)} words)`);
    await open(page, 'work', 'To-do');
    await phraseOpens(page, 'work', 'work', `${T} W10 phrases`);
    // W8: a document says its size in words
    await page.evaluate(() => window.__ghosty.run('open_work', { what: 'doc', title: 'YOUR CV', text: 'SAM KHAN\nLeeds\n\nEXPERIENCE\n- Worked at Tesco', kind: 'cv' }));
    await page.waitForSelector('.modal [data-screen="doc"]', { timeout: 8000 }).catch(() => undefined);
    check(/\d+ words/.test(await txt(page, '.modal [data-screen="doc"]')), `${T} W8 a document says how long it is, in words`);
    await page.evaluate(() => document.querySelector('.modal .mhead button')?.click());
    await wipe();
  });

  // ================================================================ CREATIVE
  await block(`creative ${W}`, async () => {
    log(`creative ${W}`);
    const T = `[creative ${W}]`;
    await open(page, 'creative', 'Music');
    const P = PK('creative');
    await page.waitForTimeout(500);
    const info = await txt(page, `${P} .pkcue`);
    check(!/\b(vi|IV)\b/.test(info) && !/major chords: /.test(info), `${T} C5 the song's line is plain: no numerals, no repeats: "${info}"`);
    const wav = await page.locator(`${P} button[aria-label="Save the song as a WAV sound file"]`).first().textContent();
    check(/\d+(\.\d)? ?(KB|MB)/.test(wav ?? ''), `${T} C1 Save WAV says its size before the tap: "${wav}"`);
    await still(page, 'creative', vp);
    // the drum pads at 44 pt
    const steps = await page.$$eval(`${P} .pkstep`, (b) => b.filter((x) => x.getClientRects().length).map((x) => Math.round(x.getBoundingClientRect().width * 10) / 10));
    check(steps.length === 64 && steps.every((x) => x >= 43.5), `${T} C2 the drum pads' steps are 44 pt wide (${steps.length} steps, narrowest ${Math.min(...steps)})`);
    await bar(page, `${T} music bar`, 'creative');
    // poster
    let n0 = await waitsN(page);
    await open(page, 'creative', 'Poster');
    await page.waitForTimeout(700);
    check((await waitsSince(page, n0)).includes('Drawing it…'), `${T} C7 a drawing says "Drawing it…": ${JSON.stringify(await waitsSince(page, n0))}`);
    check((await count(page, `${P} [data-state="empty"]`)) === 1, `${T} C6 a poster with no title says what to type`);
    await page.fill(`${P} input[aria-label="Title"]`, 'Fish and Chips Night');
    await page.waitForTimeout(900);
    check((await count(page, `${P} [data-state="empty"]`)) === 0, `${T} C6 the hint goes once there is a title`);
    const png = await until(page, () => /\d+(\.\d)? ?(KB|MB)/.test(document.querySelector('.pn:not([hidden]) .pk button[aria-label="Save the poster as a PNG picture"]')?.textContent ?? ''), null, 6000);
    check(png, `${T} C1 Save PNG says its size before the tap: "${await page.locator(`${P} button[aria-label="Save the poster as a PNG picture"]`).textContent()}"`);
    await page.click(`${P} button[aria-label="Save the poster as a PNG picture"]`);
    await until(page, () => /Saved /.test(document.querySelector('.pn:not([hidden]) .pk')?.innerText ?? ''), null, 6000);
    check(/Saved .*\d+(\.\d)? ?(KB|MB)/.test(await txt(page, `${P} .pknote`)), `${T} C9 a save says it is saved, and how big: "${(await txt(page, `${P} .pknote`)).slice(0, 100)}"`);
    await page.evaluate(() => (window.__noBlob = true));
    await page.click(`${P} button[aria-label="Save the poster as a PNG picture"]`);
    await page.waitForTimeout(700);
    check((await count(page, `${P} [data-state="error"]`)) === 1 && !RAW.test(await txt(page, `${P} [data-state="error"]`)), `${T} C8 a picture that cannot be made is said in his words`);
    await page.evaluate(() => (window.__noBlob = false));
    await bar(page, `${T} poster bar`, 'creative');
    // palette
    await open(page, 'creative', 'Palette');
    check((await count(page, `${P} [data-state="empty"]`)) === 1 && !(await page.locator(`${P} button:visible`, { hasText: /^Copy all$/ }).count()), `${T} C3 no palette yet is a designed state and COPY ALL waits for colours`);
    n0 = await waitsN(page);
    await page.setInputFiles(`${P} input[type=file]`, { name: 'one.png', mimeType: 'image/png', buffer: PNG });
    await page.waitForTimeout(500);
    check((await waitsSince(page, n0)).includes('Reading the colours…'), `${T} C4 reading colours is said as a wait: ${JSON.stringify(await waitsSince(page, n0))}`);
    await bar(page, `${T} palette bar`, 'creative');
    for (const pill of ['Card', 'Comic', 'Logo']) {
      await open(page, 'creative', pill);
      await bar(page, `${T} ${pill} bar`, 'creative');
    }
    await open(page, 'creative', 'Music');
    await phraseOpens(page, 'creative', 'creative', `${T} C10 phrases`);
  });

  // ================================================================ OUTSIDE
  await block(`outside ${W}`, async () => {
    log(`outside ${W}`);
    const T = `[outside ${W}]`;
    await open(page, 'outside', 'Nearby');
    const P = PK('outside');
    await page.waitForTimeout(400);
    check((await count(page, `${P} [data-state="empty"]`)) === 1, `${T} O4 nothing looked up yet is a designed state`);
    await still(page, 'outside', vp);
    for (const [pill, n] of [['Walk', 1], ['Nearby', 1], ['My car', 1], ['Lost', 1]]) {
      await open(page, 'outside', pill);
      const priv = await page.$$eval(`${P} [data-priv]`, (e) => e.map((x) => x.textContent ?? ''));
      check(priv.length === n && /sent once/i.test(priv[0] ?? '') && /nothing is kept/i.test(priv[0] ?? ''), `${T} O1 ${pill}: "Use where I am now" says once what is sent and that nothing is kept: ${JSON.stringify(priv)}`);
    }
    await open(page, 'outside', 'Nearby');
    await page.evaluate(() => (window.__geo = 'deny'));
    await page.click(`${P} button[aria-label="Use where I am now, once"]`);
    await page.waitForTimeout(400);
    const gps = await txt(page, `${P} [data-state="error"]`);
    check(/Settings, Ghosty, Location/.test(gps) && (await count(page, `${P} [data-state="error"]`)) === 1, `${T} O2 the GPS's refusal is said once with how to allow it: "${gps}"`);
    await page.evaluate(() => (window.__geo = ''));
    // O3: the map's wait
    await slow(page, PACKS, 1600);
    await page.fill(`${P} input[aria-label="A place to look near"]`, 'Cannon Street');
    let w0 = await waitsN(page);
    await page.click(`${P} button[aria-label="Look near the place I typed"]`);
    await page.waitForTimeout(500);
    check((await waitsSince(page, w0)).some((x) => /^Looking for toilets near /.test(x)), `${T} O3 a look says what for: ${JSON.stringify(await waitsSince(page, w0))}`);
    await unroute(page);
    await page.waitForTimeout(1200);
    await bar(page, `${T} nearby bar`, 'outside');
    // O5, O6: the walk
    await open(page, 'outside', 'Walk');
    await page.route(PACKS, async (r) => {
      const b = r.request().postDataJSON();
      if (b?.action === 'safewalk') return r.fulfill({ json: { text: 'Two ways, 2.1 km and 2.6 km. Fewer reports on the first.', data: { from: 'Cannon Street', to: 'home', months: ['2026-08', '2026-09', '2026-10'], best: 0, routes: [{ label: 'Direct', km: 2.1, min: 26, reports: 3, perKm: 1.4, kinds: 'theft', path: [[51.5, -0.12], [51.51, -0.11]], worst: null }, { label: 'Park way', km: 2.6, min: 32, reports: 9, perKm: 3.5, kinds: 'theft', path: [[51.5, -0.12], [51.5, -0.1], [51.51, -0.11]], worst: null }] } } });
      return r.continue();
    });
    await page.fill(`${P} input[aria-label="Walk from"]`, 'Cannon Street');
    await page.click(`${P} button[aria-label="Count police reports along the walk"]`);
    await page.waitForSelector(`${P} .pkmap`, { timeout: 8000 }).catch(() => undefined);
    const legend = await txt(page, `${P} .pkroutes`);
    check(/2\.1 km/.test(legend) && /about 26 minutes/.test(legend) && /3 police reports/.test(legend), `${T} O5 each way says its km, its minutes (about) and its police reports: "${legend}"`);
    await unroute(page);
    await page.evaluate(() => (window.__geo = 'ok'));
    await page.click(`${P} button[aria-label="Use where I am now, once"]`);
    await page.waitForTimeout(500);
    check(/Using where you are now/.test(await txt(page, `${P} .pknote`)), `${T} O6 a tap on "Use where I am now" says it is using it`);
    await bar(page, `${T} walk bar`, 'outside');
    // O7: the car is read at once
    await pk('outside', 'parked', { place: 'Cannon Street' });
    w0 = await waitsN(page);
    await open(page, 'outside', 'My car');
    await page.waitForTimeout(1500);
    check(/Cannon Street/i.test(await txt(page, P)) && (await waitsSince(page, w0)).includes('Looking for your car…'), `${T} O7 the car's page says where it is kept at once: ${JSON.stringify(await waitsSince(page, w0))}`);
    await pk('outside', 'parked', { words: 'forget' });
    await bar(page, `${T} car bar`, 'outside');
    // O8
    await open(page, 'outside', 'Lost');
    const safety = await txt(page, `${P} [data-safety]`);
    const lns = await page.$$eval(`${P} .pknote`, (n) => n.map((x) => x.textContent ?? ''));
    check(/999/.test(safety) && lns.every((n) => words(n) <= 20), `${T} O8 the safety line stands alone and every note is one short sentence: ${lns.filter((n) => words(n) > 20).join(' / ').slice(0, 120)}`);
    await bar(page, `${T} lost bar`, 'outside');
    // O9
    await open(page, 'outside', 'Split');
    await page.click(`${P} button[aria-label="Work out who owes whom"]`);
    await page.waitForTimeout(300);
    check(/Type the fare/i.test(await txt(page, `${P} .pknote`)), `${T} O9 Work it out with nothing typed says what to type`);
    await bar(page, `${T} split bar`, 'outside');
    await open(page, 'outside', 'Walk');
    await phraseOpens(page, 'outside', 'outside', `${T} O10 phrases`);
  });

  // ================================================================ HOME
  await block(`home ${W}`, async () => {
    log(`home ${W}`);
    const T = `[home ${W}]`;
    await open(page, 'homeadmin', 'Due');
    const P = PK('homeadmin');
    await page.waitForTimeout(700);
    const dm = await stateText(page, `${P} [data-state="empty"]`);
    check(/Nothing due/.test(dm) && /bin day/i.test(dm) && words(dm) <= 24, `${T} H1 nothing due says how to tell me the bin day ("${dm}")`);
    await still(page, 'homeadmin', vp);
    await open(page, 'homeadmin', 'Bills');
    await page.waitForTimeout(700);
    check((await count(page, `${P} [data-state="empty"]`)) === 1 && /No bills kept yet/.test(await txt(page, `${P} [data-state="empty"]`)), `${T} H6 no bills is a designed state: "No bills kept yet"`);
    await slow(page, PACKS, 1600);
    let w0 = await waitsN(page);
    await page.fill(`${P} textarea`, `Thames Water bill Amount due £84.20 Pay by ${day(2)}`);
    await page.click(`${P} button[aria-label="Read the bill text I pasted"]`);
    await page.waitForTimeout(500);
    check((await waitsSince(page, w0)).includes('Reading your bill…'), `${T} H5 a bill says "Reading your bill…": ${JSON.stringify(await waitsSince(page, w0))}`);
    await until(page, () => document.querySelector('.pn:not([hidden]) .pk .pkperson'), null, 12000);
    await unroute(page);
    await pk('homeadmin', 'bill', { text: `Octopus Energy Amount due £120.00 Pay by ${day(9)}` });
    await open(page, 'homeadmin', 'Meter');
    await open(page, 'homeadmin', 'Bills');
    await page.waitForTimeout(800);
    const rows = await page.$$eval(`${P} .pkperson`, (r) => r.map((x) => x.textContent ?? ''));
    check(rows.length >= 2 && /due in 2 days/.test(rows[0] ?? '') && /due in 9 days/.test(rows[1] ?? ''), `${T} H2 a bill says "due in 2 days", in date order: ${JSON.stringify(rows)}`);
    check(rows.every((x) => /from the bill you showed me/.test(x)), `${T} H4 each amount says it is from the bill he showed me`);
    await page.locator(`${P} button[aria-label="Mark Thames Water paid"]`).click().catch(() => undefined);
    await page.waitForTimeout(900);
    check(/Marked paid/.test(await txt(page, `${P} .pknote`)), `${T} H3 Paid says what it did: "${(await txt(page, `${P} .pknote`)).slice(0, 100)}"`);
    await bar(page, `${T} bills bar`, 'homeadmin');
    // meter, bins
    await open(page, 'homeadmin', 'Meter');
    await page.waitForTimeout(600);
    const me = await stateText(page, `${P} [data-state="empty"]`);
    check(me.length > 0 && !/sheet/i.test(me) && /meter/i.test(me), `${T} H7 no readings yet is a designed state and never points at a sheet ("${me}")`);
    await bar(page, `${T} meter bar`, 'homeadmin');
    await slow(page, PACKS, 1600);
    await open(page, 'homeadmin', 'Bins', false);
    await page.waitForTimeout(500);
    check((await count(page, `${P} [data-wait="Opening your bin days…"]`)) === 1, `${T} H8 bins say "Opening your bin days…" while they load`);
    await unroute(page);
    await open(page, 'homeadmin', 'Bins');
    await page.waitForTimeout(600);
    await page.click(`${P} button[aria-label="Keep what I said about my bins"]`);
    await page.waitForTimeout(300);
    check(/Tell me your bin days first/.test(await txt(page, `${P} .pknote`)), `${T} H8 Keep these bin days with nothing said asks for them`);
    await bar(page, `${T} bins bar`, 'homeadmin');
    // rooms: the CSV's size
    await open(page, 'homeadmin', 'Rooms');
    await page.fill(`${P} input[aria-label="Which room"]`, 'living room');
    await page.fill(`${P} textarea`, 'a 55 inch TV worth £400, 2 armchairs');
    await page.click(`${P} button[aria-label="Keep the things I typed"]`);
    await page.waitForTimeout(900);
    await page.click(`${P} button[aria-label="Make the inventory CSV for my insurer"]`);
    await page.waitForTimeout(900);
    const sv = await page.locator(`${P} button[aria-label^="Save the inventory as a CSV"]`).textContent();
    check(/\d+(\.\d)? ?(bytes|KB|MB)/.test(sv ?? ''), `${T} H9 Save the CSV says its size before the tap: "${sv}"`);
    await bar(page, `${T} rooms bar`, 'homeadmin');
    await open(page, 'homeadmin', 'Due');
    await phraseOpens(page, 'homeadmin', 'homeadmin', `${T} H10 phrases`);
    await wipe();
  });

  await chatDoor(page);
  await ctx.close();
}

// ================================================================ the biggest text (BODY 21), every pack, at 440
{
  log('body 21');
  const { ctx, page } = await phone(PHONE, { body: 21 });
  for (const [id, pills] of [['money', ['']], ['body', ['Reps', 'Run', 'Water']], ['kitchen', ['Timers', 'Shopping']], ['people', ['Your people']], ['work', ['To-do', 'Interview']], ['creative', ['Music', 'Poster']], ['outside', ['Walk', 'Nearby']], ['homeadmin', ['Due', 'Bills']]]) {
    for (const pill of pills) {
      await open(page, id, pill);
      await page.waitForTimeout(500);
      const r = await page.evaluate((t) => {
        const bad = [];
        for (const e of document.querySelectorAll(`#pg-${t} .pn:not([hidden]) .pk *`)) {
          if (!e.getClientRects().length || !(e.textContent ?? '').trim() || e.closest('canvas,select,textarea,input,pre')) continue;
          const cs = getComputedStyle(e);
          if (cs.overflowX !== 'visible' && e.scrollWidth > e.clientWidth + 1) bad.push(`cut "${(e.textContent ?? '').trim().slice(0, 20)}"`);
          const b = e.getBoundingClientRect();
          if (b.width > 2 && (b.right > innerWidth + 1 || b.left < -1)) bad.push(`outside "${(e.textContent ?? '').trim().slice(0, 20)}"`);
        }
        return { body: document.documentElement.dataset.body, bad: bad.slice(0, 3), side: document.documentElement.scrollWidth > innerWidth + 1 };
      }, id);
      check(r.body === '21' && !r.bad.length && !r.side, `[body21] ${id}/${pill || 'page'} clips or sticks out at the biggest text (body ${r.body}): ${r.bad.join(' | ')}`);
    }
  }
  await ctx.close();
}

await wipe();
await browser.close();
if (process.env.GAPS) console.log(`slow steps:\n${gaps.join('\n')}`);
console.log(`(lifepass spec: ${((Date.now() - t0) / 1000).toFixed(1)} s, ${checks} checks)`);
if (problems.length) {
  console.log(`PROBLEMS (${problems.length}):\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(`LIFE pass run clean: ${checks} checks across the eight packs at 440 and 390, each pack's empty, waiting, error and offline states in his words, every control 44 pt, the biggest text clipping nothing.`);
