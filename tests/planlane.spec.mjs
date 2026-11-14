// THE PLAN AND HOME LANE (FINAL ROUND, 13 Nov 2026): what the lane made, proved at the owner's 440 × 956 and at 390 × 844, and in all seven looks.
//  - the AGENDA's TO-DO: add one with a day, its words ("Due today"), tick it, CLEAR DONE with UNDO, remove with UNDO, kept on the phone;
//  - the AGENDA's MONTH: today lit, a day with an event dotted, a tap says the day in words;
//  - THE BRIEF's YOUR DAY says the to-do due today (the brief and the agenda agree);
//  - the RADIO's sleep timer (a key per choice, its line, TIMER OFF), RECENT, and the lock screen's next and previous;
//  - SOCIAL's WRITE A POST makes a DRAFT only: the page never asks the brain to approve or send anything;
//  - on every screen it touched: every key 44 pt, nothing sideways (no horizontal scroll), no word cut at BODY 21.
// The pure words are read from the very source files the page is built from. The radio's directory and stream are stood in with
// page.route; the social accounts are stood in the same way; the agenda's own event is added through the preview's brain and removed.
//   BASE=http://localhost:8788 node tests/planlane.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, openSection, standDown } from './nav.mjs';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const { buildSync } = createRequire(new URL('../apps/web/package.json', import.meta.url))('esbuild');

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const PHONE2 = { width: 390, height: 844 };
const WORLDS = ['scan', 'map', 'eye', 'orbit', 'grown', 'ink', 'glass'];
// PLANLANE_ONLY=radio,agenda runs only those parts (tests/planlane/<name>.mjs) and skips the core checks below; unset, everything runs.
const ONLY = (process.env.PLANLANE_ONLY ?? '').split(',').map((x) => x.trim()).filter(Boolean);
const core = !ONLY.length || ONLY.includes('core');
const problems = [];
let checks = 0;
const t0 = Date.now();
const check = (ok, msg) => {
  checks++;
  if (!ok) {
    problems.push(msg);
    console.log(`  red: ${msg.slice(0, 240)}`);
  }
};
const log = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s · ${s}`);
const RAW = /undefined|\[object Object\]|TypeError|NetworkError|Failed to|HTTP \d|NaN/;
await standDown(base, KEY);

async function pure(entry) {
  const r = buildSync({ entryPoints: [new URL(`../${entry}`, import.meta.url).pathname], bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`);
}

// ---- 1. the pure words and orders
const T = await pure('apps/web/src/features/agenda/todowords.ts');
const R = await pure('apps/web/src/features/radio/words.ts');
const S = await pure('apps/web/src/features/social/words.ts');
{
  const now = new Date(2026, 10, 13, 9, 0).getTime();
  check(T.dueWords('2026-11-13', now) === 'Due today', `dueWords today: ${T.dueWords('2026-11-13', now)}`);
  check(T.dueWords('2026-11-14', now) === 'Due tomorrow', `dueWords tomorrow: ${T.dueWords('2026-11-14', now)}`);
  check(T.dueWords('2026-11-12', now) === '1 day late', `dueWords late: ${T.dueWords('2026-11-12', now)}`);
  check(T.dueWords('2026-11-10', now) === '3 days late', `dueWords 3 late: ${T.dueWords('2026-11-10', now)}`);
  check(/^Due \w{3},? 20 Nov$/.test(T.dueWords('2026-11-20', now)), `dueWords later: ${T.dueWords('2026-11-20', now)}`);
  check(T.dueWords('', now) === '', 'no day, no words');
  const l = [
    { id: 'a', text: 'no day', due: '', done: false, at: 1 },
    { id: 'b', text: 'late', due: '2026-11-10', done: false, at: 2 },
    { id: 'c', text: 'done', due: '2026-11-01', done: true, at: 3, doneAt: 5 },
    { id: 'd', text: 'today', due: '2026-11-13', done: false, at: 4 },
  ];
  check(T.sortTodos(l).map((t) => t.id).join('') === 'bdac', `the order: late, today, no day, done: ${T.sortTodos(l).map((t) => t.id).join('')}`);
  check(T.dueToday(l, now).map((t) => t.id).join('') === 'bd', 'due today or late, for the brief');
  check(T.todoLine(l, now) === '3 to do · 1 late · 1 due today · 1 done', `the list's line: ${T.todoLine(l, now)}`);
  const g = T.monthGrid(2026, 10);
  check(g.every((w) => w.length === 7) && g[0][6] === 1 && g.flat().filter(Boolean).length === 30, `November 2026 starts on a Sunday, Monday first, 30 days: ${JSON.stringify(g[0])}`);
  check(/^Friday 13 November: 2 events, 1 to-do due$/.test(T.dayLine(now, 2, 1)) && /nothing on$/.test(T.dayLine(now, 0, 0)), `a day said in words: ${T.dayLine(now, 2, 1)}`);
  check(R.sleepLine(0, now).startsWith('Sleep timer: off') && /^Goes quiet at 09:30 \(in 30 min\), then stops\.$/.test(R.sleepLine(now + 30 * 60_000, now)), `the sleep line: ${R.sleepLine(now + 30 * 60_000, now)}`);
  check(R.SLEEP_CHOICES.map(R.sleepKey).join(',') === '15 MIN,30 MIN,45 MIN,1 HOUR,90 MIN', `the sleep keys: ${R.SLEEP_CHOICES.map(R.sleepKey).join(',')}`);
  check(R.sleepSet(60) === 'Sleep timer set: the radio stops in an hour.', R.sleepSet(60));
  check(S.lengthWords(12, 300, 'Bluesky') === '12 of 300 letters' && S.lengthWords(312, 300, 'Bluesky') === '12 over the 300 Bluesky takes', 'the composer counts');
  check(/draft only/i.test(S.COMPOSE_NOTE) && /APPROVE/.test(S.COMPOSE_NOTE), 'the composer says it only drafts');
}
log('pure words');

// ---- the browser
function wav(sec = 30, rate = 8000) {
  const n = sec * rate;
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(i / 9) * 2000), 44 + i * 2);
  return b;
}
const TONE = wav();
const DIRECTORY = [
  { name: 'Spec Lane FM', url_resolved: 'https://spec-lane.test-radio.example/one', country: 'UK', countrycode: 'GB', tags: 'news', codec: 'MP3', bitrate: 128 },
  { name: 'Spec Lane Two', url_resolved: 'https://spec-lane.test-radio.example/two', country: 'UK', countrycode: 'GB', tags: 'news', codec: 'MP3', bitrate: 128 },
];
/** [planlane2:onelist] the one to-do list in the preview brain, emptied (as a page that brings its own list needs). */
async function clearOneList() {
  const r = await fetch(`${base}/api/packs/do`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-ghosty': '1', 'x-ghosty-key': KEY }, body: JSON.stringify({ pack: 'work', action: 'todo', args: { words: 'clear my to-do list' } }) });
  if (!r.ok) throw new Error(`the preview brain would not clear the one to-do list (${r.status})`);
}
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--autoplay-policy=no-user-gesture-required'] });

/** A paired phone at `viewport` in the look `world`, with `seed` put in its storage first and BODY at `body` (21 = his largest text; 0 = the default). */
async function phone(viewport, world = 'scan', seed = {}, body = 0) {
  // [planlane2:onelist] the to-do list is one list kept in the brain, with this phone's copy: a page that brings its own list starts
  // the brain's empty, so the list it brings is the whole of the one list (it joins the brain's on the first open)
  if (Object.hasOwn(seed, 'ghosty.agenda.todo')) await clearOneList();
  // (paired by the key in storage, motion calm and no service worker: the app boots about 40% sooner, which keeps the run inside CI's eight
  // minutes; nothing checked here depends on the boot's motion. The pairing screen itself has its own specs.)
  const ctx = await browser.newContext({ viewport, ...UK, reducedMotion: 'reduce', serviceWorkers: 'block' });
  await ctx.addInitScript(({ world, seed, body, key }) => {
    if (!localStorage.getItem('ghosty.ownerKey')) localStorage.setItem('ghosty.ownerKey', key);
    if (!localStorage.getItem('ghosty.settings'))
      localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Tony', speak: false, sounds: false, theme: 'reactor', favourites: [], look: { ground: 'graphite', world, night: 'graphite', switches: body ? { body } : {} }, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
    for (const [k, v] of Object.entries(seed)) if (!localStorage.getItem(k)) localStorage.setItem(k, v);
    window.__specActions = {};
    if (navigator.mediaSession) {
      const set = navigator.mediaSession.setActionHandler.bind(navigator.mediaSession);
      navigator.mediaSession.setActionHandler = (a, fn) => { window.__specActions[a] = fn; return set(a, fn); };
    }
  }, { world, seed, body, key: KEY });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror (${world} ${viewport.width}): ${e.message}`));
  await page.route(/\/api\/proxy\?.*radio-browser/, (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(DIRECTORY) }));
  await page.route(/^https:\/\/spec-lane\.test-radio\.example\//, (r) => r.fulfill({ status: 200, contentType: 'audio/wav', body: TONE }));
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
  return { ctx, page };
}
const open = async (page, tab) => {
  await page.evaluate((t) => (location.hash = t), tab);
  await page.waitForFunction((t) => document.body.dataset.tab === t && document.querySelector(`#pg-${t}`), tab, { timeout: 15000 });
};
/** Say something in the chat (as he types it), on the core screen. */
const chat = async (page, words) => {
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForSelector('#cin', { state: 'visible', timeout: 15000 });
  await page.fill('#cin', words);
  await page.keyboard.press('Enter');
};
/**
 * Say `words` in the chat and wait for Ghosty's reply to THEM: the first reply drawn after his own message (found by the time it was sent,
 * `data-at`, on the page's own clock) whose words match `re`, up to `ms`. Never a count of replies (the log draws only its last 40 entries,
 * so after twenty turns a count stops growing even when the reply is there), never a fixed sleep, never the last message read at once.
 * Returns { ok, text (the reply's textContent), inner (its innerText, spaces folded) }; when no matching reply came, the newest reply after
 * his message (or '') so the check can say what was there.
 */
const ask = async (page, words, re = /\S/, ms = 20000) => {
  const t0 = await page.evaluate(() => Date.now());
  await chat(page, words);
  const find = ({ t0, src, flags, any }) => {
    const rx = new RegExp(src, flags);
    const msgs = [...document.querySelectorAll('#pg-core .msg')];
    const mine = msgs.map((m) => m.classList.contains('me') && Number(m.dataset.at ?? 0) >= t0).lastIndexOf(true);
    if (mine < 0) return null;
    const replies = msgs.slice(mine + 1).filter((m) => !m.classList.contains('me'));
    const r = any ? replies.at(-1) : replies.find((m) => rx.test(m.textContent ?? ''));
    return r ? { text: r.textContent ?? '', inner: (r.innerText ?? '').replace(/\s+/g, ' ').trim() } : null;
  };
  const arg = { t0, src: re.source, flags: re.flags.replace('g', ''), any: false };
  const got = await page.waitForFunction(find, arg, { timeout: ms }).then((h) => h.jsonValue(), () => null);
  if (got) return { ok: true, ...got };
  const seen = await page.evaluate(find, { ...arg, any: true }).catch(() => null);
  return { ok: false, text: seen?.text ?? '', inner: seen?.inner ?? '' };
};
/** Every visible key under `sel` that is under 44 pt, and whether the page scrolls sideways, and any word cut. */
const fit = async (page, sel) => {
  // (once the screen's entrance has finished: mid-way every key reads a fraction short. The real condition, never a fixed sleep.)
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined)))).catch(() => undefined);
  return page.evaluate((sel) => {
    const small = [...document.querySelectorAll(`${sel} button`)].filter((b) => {
      const r = b.getBoundingClientRect();
      return r.width && r.height && (r.width < 43.5 || r.height < 43.5) && getComputedStyle(b).visibility !== 'hidden';
    }).map((b) => `${(b.getAttribute('aria-label') ?? b.textContent).trim().slice(0, 30)} ${Math.round(b.getBoundingClientRect().width)}×${Math.round(b.getBoundingClientRect().height)}`);
    const pg = document.querySelector(sel.split(' ')[0]);
    const sideways = document.documentElement.scrollWidth > innerWidth + 1 || (pg && pg.scrollWidth > pg.clientWidth + 1);
    const cut = [...document.querySelectorAll(`${sel} :is(b, small, span, p)`)].filter((e) => {
      if (!e.offsetParent || e.children.length) return false;
      const cs = getComputedStyle(e);
      return cs.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1;
    }).map((e) => e.textContent.slice(0, 30));
    return { small, sideways: !!sideways, cut };
  }, sel);
};

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ---- 2. THE AGENDA: TO-DO and MONTH, at both sizes
// (440 only: each screen's own part below proves both sizes; this keeps the run inside CI's eight minutes)
if (core) for (const vp of [PHONE]) {
  // the one list lives in the brain, which every spec before this one in the run shares: start it empty, so "an empty list" is true
  await clearOneList();
  const { ctx, page } = await phone(vp);
  await open(page, 'agenda');
  const pills = await page.$$eval('#pg-agenda .secpill', (b) => b.map((x) => x.textContent));
  check(pills.includes('To-do'), `[${vp.width}] the agenda's pills include To-do: ${pills.join(', ')}`);
  await openSection(page, 'agenda', 'To-do');
  const empty = await page.textContent('#pg-agenda .pn.todo .empty').catch(() => '');
  check(/Nothing to do/.test(empty), `[${vp.width}] an empty list says so in his words: ${empty}`);
  await page.fill('#pg-agenda .todoadd input:not([type=date])', 'Renew the passport');
  await page.fill('#pg-agenda .todoadd input[type=date]', today());
  await page.click('#pg-agenda .todoadd button');
  await page.fill('#pg-agenda .todoadd input:not([type=date])', 'Buy a kettle');
  await page.press('#pg-agenda .todoadd input:not([type=date])', 'Enter');
  await page.waitForFunction(() => document.querySelectorAll('#pg-agenda .todoit').length === 2, null, { timeout: 5000 }).catch(() => check(false, `[${vp.width}] two to-dos did not show`));
  const items = await page.$$eval('#pg-agenda .todoit', (e) => e.map((x) => x.innerText.replace(/\s+/g, ' ').trim()));
  check(/Renew the passport Due today/.test(items[0] ?? '') && /Buy a kettle/.test(items[1] ?? ''), `[${vp.width}] the one due today first, said "Due today": ${JSON.stringify(items)}`);
  const line = await page.textContent('#pg-agenda .todoline');
  check(line === '2 to do · 1 due today', `[${vp.width}] the list's line: ${line}`);
  const sub = await page.textContent('#pg-agenda .hero .sub').catch(() => '');
  check(/2 to do/.test(sub), `[${vp.width}] the agenda's top line counts the to-dos: ${sub}`);
  const f = await fit(page, '#pg-agenda .pn.todo');
  check(!f.small.length && !f.sideways && !f.cut.length, `[${vp.width}] TO-DO fits: ${JSON.stringify(f)}`);
  // tick, then CLEAR DONE with its UNDO
  await page.click('#pg-agenda .todoit:has-text("Buy a kettle") button.todotick');
  await page.waitForSelector('#pg-agenda .todoit.done', { timeout: 3000 }).catch(() => check(false, `[${vp.width}] ticking did not mark it done`));
  check((await page.getAttribute('#pg-agenda .todoit.done button.todotick', 'aria-checked')) === 'true', `[${vp.width}] the tick says it is checked`);
  await page.click('#pg-agenda .pn.todo button:has-text("Clear done")');
  await page.waitForFunction(() => document.querySelectorAll('#pg-agenda .todoit').length === 1, null, { timeout: 3000 }).catch(() => check(false, `[${vp.width}] CLEAR DONE left the done one`));
  const undoBtn = page.locator('.undofloat button').first();
  await undoBtn.click({ timeout: 3000 }).catch(() => check(false, `[${vp.width}] no UNDO after CLEAR DONE`));
  await page.waitForFunction(() => document.querySelectorAll('#pg-agenda .todoit').length === 2, null, { timeout: 3000 }).catch(() => check(false, `[${vp.width}] UNDO did not bring the done one back`));
  // kept on the phone across a reload
  await page.reload();
  await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
  await open(page, 'agenda');
  await openSection(page, 'agenda', 'To-do');
  await page.waitForSelector('#pg-agenda .todoit', { timeout: 5000 }).catch(() => undefined);
  check((await page.$$('#pg-agenda .todoit')).length === 2, `[${vp.width}] the list is kept on the phone across a reload`);
  // THE BRIEF says the one due today
  await open(page, 'brief');
  const said = await page.waitForSelector('#pg-brief .brtodo', { timeout: 15000 }).then((e) => e.textContent(), () => '');
  check(/Renew the passport/.test(said ?? ''), `[${vp.width}] the brief's YOUR DAY says the to-do due today: ${said}`);
  // HOME's Today card says it too, when the diary has room (the preview's diary is empty)
  await open(page, 'core');
  const homeSaid = await page.waitForSelector('.rctoday .rctodo', { state: 'attached', timeout: 15000 }).then((e) => e.textContent(), () => '');
  check(/Renew the passport/.test(homeSaid ?? ''), `[${vp.width}] Home's Today card says the to-do due today: ${homeSaid}`);
  // THE MONTH: today lit, a tap on a day says it in words
  await open(page, 'agenda');
  await openSection(page, 'agenda', 'Diary');
  await page.waitForSelector('#pg-agenda .mongrid .mday.today', { timeout: 5000 }).catch(() => check(false, `[${vp.width}] the month has no today`));
  check(await page.$eval('#pg-agenda .mday.today', (b) => b.classList.contains('due')).catch(() => false), `[${vp.width}] today carries the ring of a to-do due`);
  const dline = await page.textContent('#pg-agenda .mdayline').catch(() => '');
  check(/: 1 to-do due$|1 to-do due/.test(dline ?? '') && !RAW.test(dline ?? ''), `[${vp.width}] the day under the month: ${dline}`);
  check(/Renew the passport/.test(await page.textContent('#pg-agenda .monlist').catch(() => '')), `[${vp.width}] the day lists its to-do`);
  const days = await page.$$('#pg-agenda .mongrid button.mday');
  if (days.length > 20) await days[20].click();
  const dline2 = await page.textContent('#pg-agenda .mdayline').catch(() => '');
  check(/^\w+day \d+ \w+: /.test(dline2 ?? ''), `[${vp.width}] a tapped day is said: ${dline2}`);
  await page.click('#pg-agenda .monbar button[aria-label="Next month"]');
  const nm = await page.textContent('#pg-agenda .monname');
  // (‹ and › step any month now: › shows next month by its name, and THIS MONTH comes home)
  const nmWant = await page.evaluate(() => { const n = new Date(); const d = new Date(n.getFullYear(), n.getMonth() + 1, 1); return `${d.toLocaleDateString('en-GB', { month: 'long' })} ${d.getFullYear()}`; });
  check(nm === nmWant && !(await page.isDisabled('#pg-agenda .monbar button[aria-label="Last month"]')) && !!(await page.$('#pg-agenda .pn.month button.monhome')), `[${vp.width}] › steps to the next month: ${nm}`);
  const fm = await fit(page, '#pg-agenda .pn.month');
  check(!fm.small.length && !fm.sideways && !fm.cut.length, `[${vp.width}] MONTH fits: ${JSON.stringify(fm)}`);
  if (vp === PHONE) await page.screenshot({ path: `${out}/planlane-month-${vp.width}.png` });
  await ctx.close();
}
log('agenda, brief');

// ---- 3. THE RADIO: sleep timer, RECENT, next and previous
// (440 only: each screen's own part below proves both sizes; this keeps the run inside CI's eight minutes)
if (core) for (const vp of [PHONE]) {
  const { ctx, page } = await phone(vp);
  await open(page, 'radio');
  await page.waitForSelector('#pg-radio .pn.stations .rw.station', { timeout: 15000 });
  check(/Nothing played yet/.test(await page.textContent('#pg-radio .pn.recent').catch(() => '')), `[${vp.width}] RECENT empty says so`);
  check(!(await page.$('#pg-radio .npsleep')), `[${vp.width}] no sleep timer while nothing plays`);
  await page.locator('#pg-radio .pn.stations .rw.station', { hasText: 'Spec Lane FM' }).locator('.n').click();
  await page.waitForFunction(() => /ON AIR/i.test(document.querySelector('#pg-radio .pn.nowp .nptx small')?.textContent ?? ''), null, { timeout: 15000 }).catch(() => check(false, `[${vp.width}] Spec Lane FM did not go on air`));
  await page.waitForSelector('#pg-radio .npsleepk button', { timeout: 5000 }).catch(() => check(false, `[${vp.width}] no sleep timer while a station plays`));
  check((await page.textContent('#pg-radio .npsleepl'))?.startsWith('Sleep timer: off'), `[${vp.width}] the timer starts off`);
  await page.click('#pg-radio .npsleepk button:has-text("30 min")');
  await page.waitForFunction(() => /^Goes quiet at \d\d:\d\d \(in 30 min\), then stops\.$/.test(document.querySelector('#pg-radio .npsleepl')?.textContent ?? ''), null, { timeout: 3000 }).catch(async () => check(false, `[${vp.width}] the sleep line after 30 MIN: ${await page.textContent('#pg-radio .npsleepl')}`));
  check((await page.getAttribute('#pg-radio .npsleepk button:has-text("30 min")', 'aria-pressed')) === 'true', `[${vp.width}] 30 MIN is marked as the one set`);
  const fr = await fit(page, '#pg-radio .pn.nowp');
  check(!fr.small.length && !fr.sideways && !fr.cut.length, `[${vp.width}] NOW PLAYING fits: ${JSON.stringify(fr)}`);
  await page.click('#pg-radio .npsleepk button:has-text("Timer off")');
  await page.waitForFunction(() => (document.querySelector('#pg-radio .npsleepl')?.textContent ?? '').startsWith('Sleep timer: off'), null, { timeout: 3000 }).catch(() => check(false, `[${vp.width}] TIMER OFF did not take it off`));
  const rec = await page.textContent('#pg-radio .pn.recent');
  check(/Spec Lane FM/.test(rec), `[${vp.width}] RECENT lists what played: ${rec.slice(0, 80)}`);
  const acts = await page.evaluate(() => Object.keys(window.__specActions).sort().join(','));
  check(/nexttrack/.test(acts) && /previoustrack/.test(acts), `[${vp.width}] the lock screen has next and previous: ${acts}`);
  // ⏭ from the lock screen: the next of the ones he played lately (two stations: play the second, then step)
  await page.locator('#pg-radio .pn.stations .rw.station', { hasText: 'Spec Lane Two' }).locator('.n').click();
  await page.waitForFunction(() => /Spec Lane Two/.test(navigator.mediaSession?.metadata?.title ?? ''), null, { timeout: 8000 }).catch(() => undefined);
  await page.evaluate(() => window.__specActions.nexttrack?.());
  await page.waitForFunction(() => navigator.mediaSession?.metadata?.title === 'Spec Lane FM', null, { timeout: 8000 }).catch(async () => check(false, `[${vp.width}] ⏭ did not step to Spec Lane FM: ${await page.evaluate(() => navigator.mediaSession?.metadata?.title)}`));
  const fp = await fit(page, '#pg-radio .pn.recent');
  check(!fp.small.length && !fp.sideways, `[${vp.width}] RECENT fits: ${JSON.stringify(fp)}`);
  await page.evaluate(() => window.__specActions.stop?.());
  await ctx.close();
}
log('radio');

// ---- 4. SOCIAL: WRITE A POST makes a draft, and nothing is ever approved or sent by the page
if (core) {
  const { ctx, page } = await phone(PHONE);
  const asked = [];
  let drafts = [];
  await page.route(/\/api\/social(\/|\?|$)/, async (r) => {
    const u = new URL(r.request().url());
    asked.push(`${r.request().method()} ${u.pathname}`);
    if (u.pathname === '/api/social' && r.request().method() === 'GET')
      return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ accounts: [{ id: 'bluesky', name: 'Bluesky', who: 'spec.bsky.social' }, { id: 'mastodon', name: 'Mastodon', who: null }], drafts, sent: [] }) });
    if (u.pathname === '/api/social/draft') {
      const b = JSON.parse(r.request().postData() ?? '{}');
      const d = { id: 'd1', account: b.account, kind: 'post', text: b.text, state: 'waiting', at: Date.now(), expires: Date.now() + 86400_000, from: 'phone' };
      drafts = [d];
      return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ draft: d }) });
    }
    return r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"not in this spec"}' });
  });
  await open(page, 'social');
  await page.waitForSelector('#pg-social .soccompose textarea', { timeout: 15000 }).catch(() => check(false, 'SOCIAL has no WRITE A POST box with an account linked'));
  const keys = await page.$$eval('#pg-social .soccompose .keyrow button', (b) => b.map((x) => x.textContent.trim()));
  check(keys.includes('Bluesky') && !keys.includes('Mastodon'), `only his linked accounts are offered: ${keys.join(', ')}`);
  await page.fill('#pg-social .soccompose textarea', 'A spec post, written on the phone.');
  check((await page.textContent('#pg-social .soccount')) === '34 of 300 letters', `the count: ${await page.textContent('#pg-social .soccount')}`);
  await page.click('#pg-social .soccompose button:has-text("Make the draft")');
  await page.waitForFunction(() => /1 waiting for your APPROVE/.test(document.querySelector('#pg-social .pknote')?.textContent ?? ''), null, { timeout: 8000 }).catch(async () => check(false, `the draft did not wait in the queue: ${await page.textContent('#pg-social .pknote').catch(() => '')}`));
  check(asked.includes('POST /api/social/draft') && !asked.some((a) => /approve/.test(a)), `the page asked for a DRAFT only, never APPROVE: ${asked.join(', ')}`);
  check(/draft only/i.test(await page.textContent('#pg-social .soccompose')), 'the composer says it only drafts');
  const fs = await fit(page, '#pg-social .soccompose');
  check(!fs.small.length && !fs.sideways && !fs.cut.length, `WRITE A POST fits: ${JSON.stringify(fs)}`);
  await ctx.close();
}
log('social');

// ---- 5. THE SEVEN LOOKS: the to-do list and the radio's keys hold in every world (44 pt, nothing sideways, nothing cut)
// (each part below runs its own screen in all seven looks, The Scan at BODY 21; this loop runs only when asked for: PLANLANE_ONLY=core,looks)
if (core && ONLY.includes('looks')) for (const world of WORLDS) {
  const seed = { 'ghosty.agenda.todo': JSON.stringify([{ id: 'w1', text: 'A to-do long enough to wrap onto a second line at body twenty-one', due: today(), done: false, at: 1 }]) };
  // (The Scan at BODY 21: his largest text)
  const { ctx, page } = await phone(PHONE2, world, seed, world === 'scan' ? 21 : 0);
  await open(page, 'agenda');
  await openSection(page, 'agenda', 'To-do');
  await page.waitForSelector('#pg-agenda .todoit', { timeout: 8000 }).catch(() => check(false, `[${world}] the to-do did not show`));
  const a = await fit(page, '#pg-agenda .pn.todo');
  check(!a.small.length && !a.sideways && !a.cut.length, `[${world}] TO-DO fits: ${JSON.stringify(a)}`);
  const colours = await page.$eval('#pg-agenda .todoit .todotx b', (b) => { const c = getComputedStyle(b); return { color: c.color, bg: getComputedStyle(document.body).backgroundColor }; }).catch(() => null);
  check(colours && colours.color !== colours.bg, `[${world}] the to-do's words are drawn in a colour of the look: ${JSON.stringify(colours)}`);
  await open(page, 'radio');
  await page.waitForSelector('#pg-radio .pn.stations .rw.station', { timeout: 15000 }).catch(() => undefined);
  const r = await fit(page, '#pg-radio .pn.recent');
  check(!r.small.length && !r.sideways, `[${world}] RADIO fits: ${JSON.stringify(r)}`);
  await ctx.close();
}
log('seven looks');

// ---- 6. THE PARTS: each screen's own checks (tests/planlane/<name>.mjs, each exporting `run(H)`), in name order, with the harness above
const H = { browser, phone, open, fit, check, log, pure, chat, ask, out, base, KEY, today, PHONE, PHONE2, WORLDS, RAW, TONE, DIRECTORY };
const partsDir = new URL('./planlane/', import.meta.url);
const parts = existsSync(partsDir) ? readdirSync(partsDir).filter((f) => f.endsWith('.mjs')).sort() : [];
// Two lanes at once (CI's eight minutes): the parts that read his diary on the shared preview brain run one after another in the first
// (the agenda adds and removes its own event, so Home and the Brief never see it half-way); the parts whose sources are all stood in by
// page.route run in the second. A part named in neither joins the first.
const LANES = [['agenda', 'home', 'brief', 'house'], ['links', 'markets', 'radio', 'social']];
const named = parts.map((f) => f.replace(/\.mjs$/, '')).filter((n) => !ONLY.length || ONLY.includes(n));
const lanes = [named.filter((n) => !LANES[1].includes(n)).sort((a, b) => (LANES[0].indexOf(a) + 1 || 99) - (LANES[0].indexOf(b) + 1 || 99)), LANES[1].filter((n) => named.includes(n))];
await Promise.all(lanes.map(async (lane) => {
  for (const name of lane) {
    const m = await import(new URL(`${name}.mjs`, partsDir).href);
    const t = Date.now();
    try {
      await m.run(H);
    } catch (e) {
      check(false, `[${name}] the part stopped: ${String(e?.stack ?? e).slice(0, 400)}`);
    }
    log(`part ${name} (${((Date.now() - t) / 1000).toFixed(1)} s)`);
  }
}));

// [planlane2:onelist] the one to-do list left empty for the specs after this one (they share the preview brain)
await clearOneList().catch(() => undefined);
await browser.close();
console.log(`${checks} checks, ${problems.length} problems`);
if (problems.length) {
  console.log(problems.map((p) => `- ${p}`).join('\n'));
  process.exit(1);
}
console.log('PLANLANE OK');
