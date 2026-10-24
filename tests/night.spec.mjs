// NIGHT SCHOOL on the iPhone 18 Pro Max (440 × 956), with a faked clock (Playwright's page.clock, London time) and the
// screen wake lock mocked (as in gym.spec.mjs); the phone's battery state unknown, as on an iPhone:
//  1. SYSTEM → NIGHT SCHOOL: the switch (off), the window 23:00–06:00 UK time, the plan in order with each stopping
//     point, the honest iPhone words (open on Ghosty, plugged in, nothing runs with the screen off);
//  2. ON before the window: "starts at 23:00", nothing held; the brain keeps the switch;
//  3. 23:01: the wake lock held, the screen dimmed with the progress line; school practice on the offline brain (a
//     stand-in engine) "school practice x of 6 · gym next", marked five at a time;
//  4. the GYM's TRAIN ALL next ("gym: maze level 1 · study next"); Ghosty hidden → paused, the lock let go and TRAIN ALL stopped;
//     shown again → on again;
//  5. 05:01 (the last hour is for study): "study: 40 passages read · until 06:00";
//  6. 06:01: the morning report reaches the brain (the inbox has it), the card shows LAST NIGHT, the lock is let go;
//  7. nothing scrolls sideways.
// Tonight's practice and the library's study are the brain's (school/night.ts and library/study.ts are tested in
// apps/edge/test/night.test.mjs); here they are stood in for, so the phone's side runs on a fresh preview brain.
//   BASE=http://localhost:8890 node tests/night.spec.mjs [outDir]
import { mkdirSync } from 'node:fs';
import { engine, launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, openPanel } from './nav.mjs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const problems = [];
const check = (ok, what) => void (ok || problems.push(what));

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined });
const ctx = await browser.newContext({ viewport: PHONE, ...UK });
const page = await ctx.newPage();
page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
page.on('dialog', (d) => void d.accept());

await page.addInitScript(() => {
  // the screen wake lock, counted
  const w = (window.__wake = { requests: 0, releases: 0, live: 0 });
  const live = new Set();
  const drop = (s) => {
    if (s.released) return;
    s.released = true;
    live.delete(s);
    w.releases++;
    w.live = live.size;
    for (const f of s.fns) f();
  };
  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: {
      request: async (type) => {
        w.requests++;
        const s = { type, released: false, fns: [], addEventListener: (t, f) => t === 'release' && s.fns.push(f), release: async () => drop(s) };
        live.add(s);
        w.live = live.size;
        return s;
      },
    },
  });
  // an iPhone cannot say whether it is charging
  Object.defineProperty(Navigator.prototype, 'getBattery', { configurable: true, value: undefined });
  // an app that can be hidden and shown again (the phone lets go of a wake lock when hidden)
  let hid = false;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hid });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hid ? 'hidden' : 'visible') });
  document.addEventListener('visibilitychange', () => hid && [...live].forEach(drop));
  window.__setHidden = (v) => {
    hid = v;
    document.dispatchEvent(new Event('visibilitychange'));
  };
  // the offline brain, stood in for: right about legs (4), wrong about everything else
  window.__ghostyOfflineEngine = {
    ready: true,
    calls: [],
    load() {},
    unload() {},
    async chat(messages, onToken, signal) {
      this.calls.push(messages.at(-1).content);
      await new Promise((r) => setTimeout(r, 40));
      if (!signal?.aborted) onToken(/legs/.test(messages.at(-1).content) ? 'Answer: 4' : 'Answer: no idea');
    },
  };
});

// Tonight's practice (six questions, none with an answer) and its marks; the library's study (40 passages a session).
const ITEMS = [1, 2, 3, 4, 5, 6].map((i) => ({ id: `school:practice:nursery:maths:counting#${i}`, q: i % 2 ? `How many legs does animal ${i} have?` : `What comes after ${i}?`, type: 'number', marks: 1 }));
const marked = [];
await page.route('**/api/school/night/practice', (r) => r.fulfill({ json: { stage: 'nursery', items: ITEMS } }));
await page.route('**/api/school/night/answers', async (r) => {
  const a = JSON.parse(r.request().postData() ?? '{}').answers ?? [];
  marked.push(a.length);
  await r.fulfill({ json: { marked: a.length, right: a.filter((x) => /Answer: 4/.test(x.given)).length } });
});
let read = 1000;
const studied = [];
await page.route('**/api/library/study', async (r) => {
  studied.push(r.request().method());
  if (r.request().method() === 'POST') read += 40;
  const domains = [1, 2, 3].map((i) => ({ id: `d${i}`, name: `Field ${i}`, topics: 500, read: 100, digested: 0, focus: false }));
  await r.fulfill({ json: { on: true, i: 0, gaps: [], sessions: 1, focus: [], summary: { topics: 1500, read, digested: 0, domains, levels: [], today: { reads: 0, digests: 0, drills: 0, ai: 0 }, drills: { asked: 0, right: 0, skills: [] }, pending: 0, finished: 0 } } });
});

// 22:50 on Tuesday 20 October in London (BST): ten minutes before the window
await page.clock.install({ time: new Date('2026-10-20T22:50:00+01:00') });
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#pair input', { timeout: 20000 });
await page.fill('#pair input', KEY);
await page.click('#pair button.on');
await page.waitForSelector('#boot.out', { timeout: 30000 });
// (the faked clock: its timers move when it is moved)
await page.clock.runFor(2000);
await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });

const api = (path, init = {}) => page.evaluate(async ([p, i, k]) => (await fetch(`/api${p}`, { ...i, headers: { 'content-type': 'application/json', 'x-ghosty': '1', 'x-ghosty-key': k } })).json(), [path, init, KEY]);
const st = () => page.evaluate(() => window.__ghosty?.night?.get?.() ?? null);
const tick = () => page.evaluate(() => window.__ghosty?.night?.tick?.());
const wake = () => page.evaluate(() => window.__wake);
const until = async (fn, ms, what, arg) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => (problems.push(what), false));
const card = () => page.evaluate(() => document.querySelector('#pg-system .nightsch')?.textContent ?? '');
const noSideways = async (where) => {
  const o = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth - innerWidth, body: document.body.scrollWidth - innerWidth }));
  check(o.doc <= 0 && o.body <= 0, `${where}: the page scrolls sideways (${JSON.stringify(o)})`);
};
const shot = async (name) => page.screenshot({ path: `${out}/night-${engine}-${name}.png` });

// ---- 1. the card, off
await page.evaluate(() => (location.hash = 'system'));
await openPanel(page, 'system', 'NIGHT SCHOOL');
await page.waitForSelector('#pg-system .nightsch .nightsw', { timeout: 15000 });
await page.locator('#pg-system .nightsch').scrollIntoViewIfNeeded();
let text = await card();
check((await page.locator('#pg-system .nightsch .nightsw').textContent()) === 'NIGHT SCHOOL: OFF', 'the switch starts OFF');
check((await page.inputValue('#pg-system .nightsch input[aria-label="Night School starts at"]')) === '23:00' && (await page.inputValue('#pg-system .nightsch input[aria-label="Night School ends at"]')) === '06:00', 'the window starts 23:00 to 06:00');
check(/UK time/.test(text), 'the window says UK time');
const plan = await page.$$eval('#pg-system .nightsch ol.nightplan li', (l) => l.map((x) => x.textContent));
check(plan.length === 3 && /^School practice/.test(plan[0]) && /^Gym/.test(plan[1]) && /^Study/.test(plan[2]), `the plan in order: ${JSON.stringify(plan)}`);
check(/Stops after 40 questions/.test(plan[0]) && /Stops after 3 hours, or with an hour of the night left/.test(plan[1]) && /Until the end of the night/.test(plan[2]), 'each part says where it stops');
check(/leave Ghosty open on the screen and the phone plugged in/.test(text) && /nothing runs with the screen off/.test(text) && /pauses the plan/.test(text), `the iPhone words are honest: ${text.slice(0, 400)}`);
await shot('off');
await noSideways('the card');

// ---- 2. on, before the window
await page.click('#pg-system .nightsch .nightsw');
await until(() => window.__ghosty?.night?.get?.().state === 'waiting', 10000, 'switched on before 23:00: not waiting');
check((await page.locator('#pg-system .nightsch .nightsw').textContent()) === 'NIGHT SCHOOL: ON', 'the switch reads ON');
check((await st()).line === 'Night School · on · starts at 23:00', `before the window: "${(await st()).line}"`);
check((await wake()).requests === 0, 'nothing holds the screen before the window');
check((await api('/school/night')).settings?.on === true, 'the brain keeps the switch (its own part runs in the same window)');
check(/does not tell Ghosty whether it is charging: plug it in/.test(await card()), 'no battery state: it says to plug the phone in');

// ---- 3. 23:01: school practice on the offline brain, the screen held and dimmed
await page.clock.fastForward('11:00');
await tick();
await until(() => window.__ghosty?.night?.get?.().state === 'running', 10000, '23:01: Night School is not running');
check((await wake()).live === 1, `23:01: the wake lock is not held: ${JSON.stringify(await wake())}`);
await until(() => /^Night School · 23:0\d · school practice [1-6] of 6 · gym next$/.test(window.__ghosty?.night?.get?.().line ?? ''), 15000, 'no "school practice x of 6 · gym next" line');
check(await page.locator('#nightdim').isVisible(), 'the screen is not dimmed');
check(/^Night School · 23:0\d · school practice \d of 6 · gym next$/.test(await page.locator('#nightdim .nightdimline').textContent()), 'the dimmed screen shows the progress line');
await shot('dimmed');
await page.click('#nightdim');
check(!(await page.locator('#nightdim').isVisible()), 'a tap does not lift the dark layer');
await page.locator('#pg-system .nightsch').scrollIntoViewIfNeeded();
await shot('school');
await until(() => window.__ghosty?.night?.get?.().run?.school?.n === 6, 30000, 'the six questions were not all answered');
await tick();
let s = await st();
check(s.run?.school.right === 3, `three right (the legs): ${JSON.stringify(s.run?.school)}`);
check(marked.join(',') === '5,1', `answers marked five at a time: ${marked.join(',')}`);
check(s.run?.ended.school === '6 of 6 answered', `school ended: ${s.run?.ended.school}`);

// ---- 4. the GYM's TRAIN ALL; hidden → paused
await until(() => window.__ghosty?.night?.get?.().run?.part === 'gym', 10000, 'the gym is not next');
await until(() => window.__ghosty?.gym?.all?.on === true, 20000, "the GYM's TRAIN ALL did not start");
await tick();
await until(() => /^Night School · \d\d:\d\d · gym: [a-z0-9 -]+ level \d+ · study next$/.test(window.__ghosty?.night?.get?.().line ?? ''), 10000, `no "gym: … level n · study next" line`);
await page.click('#nightdim').catch(() => undefined);
await page.locator('#pg-system .nightsch').scrollIntoViewIfNeeded();
await shot('gym');
await page.evaluate(() => window.__setHidden(true));
await tick();
s = await st();
check(s.state === 'paused' && s.why === 'Ghosty is not on screen', `hidden: ${s.state} / ${s.why}`);
check((await wake()).live === 0, 'hidden: the wake lock is let go');
check((await page.evaluate(() => window.__ghosty?.gym?.all?.on)) === false, 'hidden: TRAIN ALL stops (nothing runs with the screen off)');
await page.evaluate(() => window.__setHidden(false));
await tick();
await until(() => window.__ghosty?.night?.get?.().state === 'running' && window.__ghosty?.gym?.all?.on === true, 15000, 'shown again: the gym does not carry on');
check((await wake()).live === 1, 'shown again: the screen is held again');

// ---- 5. 05:01: the last hour is for study
await page.clock.fastForward('06:00:00');
await tick();
await until(() => window.__ghosty?.night?.get?.().run?.part === 'study', 10000, '05:01: not on to study');
check((await st()).run?.ended.gym === 'the last hour is for study', `the gym ended: ${(await st()).run?.ended.gym}`);
check((await page.evaluate(() => window.__ghosty?.gym?.all?.on)) === false, 'TRAIN ALL stopped for study');
await page.clock.fastForward('04:00');
await tick();
await until(() => /^Night School · 05:0\d · study: 40 passages read · until 06:00$/.test(window.__ghosty?.night?.get?.().line ?? ''), 10000, `no "study: 40 passages read · until 06:00" line`);
check(studied.includes('POST'), 'the brain was asked for a study session');
await page.click('#nightdim').catch(() => undefined);
await page.locator('#pg-system .nightsch').scrollIntoViewIfNeeded();
await shot('study');

// ---- 6. 06:01: the morning report
await page.clock.fastForward('56:00');
await tick();
await until(() => window.__ghosty?.night?.get?.().run?.reported === true, 15000, 'the morning report was not sent');
s = await st();
check(s.state === 'waiting' && s.line === 'Night School · on · starts at 23:00', `after the window: ${s.state} "${s.line}"`);
check((await wake()).live === 0, 'after the window the screen is let go');
check(!(await page.locator('#nightdim').isVisible()), 'after the window the screen is not dimmed');
const rep = s.report?.text ?? '';
check(/^Last night: 6 practice questions \(3 right\), (.+, )?40 passages read$/.test(rep), `the morning report: "${rep}"`);
const inbox = await api('/inbox');
check((inbox.items ?? []).some((i) => i.title === 'Night School' && i.text === rep), 'the inbox has the morning report');
await page.locator('#pg-system .nightsch').scrollIntoViewIfNeeded();
check((await card()).includes(rep.replace(/^Last night: /, '')), 'the card shows LAST NIGHT');
await shot('report');
await noSideways('after the night');

await browser.close();
if (problems.length) {
  console.error(`NIGHT SCHOOL: ${problems.length} problem(s)\n - ${problems.join('\n - ')}`);
  process.exit(1);
}
console.log('NIGHT SCHOOL: all checks passed');
