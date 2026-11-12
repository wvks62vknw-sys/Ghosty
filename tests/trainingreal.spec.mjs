// THE WEEKLY TRAINING CARD (BRIEF-TRAINING-REAL), on the phone at 440 × 956, in three worlds (The Scan, Glass, Ink).
// SYSTEM → OFFLINE BRAIN TRAINING opens with THE WEEKLY TRAINING: LAST REAL RUN, REPORT CARD, WHAT HAPPENED, NEXT DUE and
// PRE-FLIGHT in the brain's own plain words; CHECK FIRST asks (the brain's answer stood in for) and shows the step that stopped;
// RUN NOW says what it will do and starts NOTHING until he confirms (KEEP IT sends nothing), then sends the one confirmed call;
// with no real run yet it says so; nothing scrolls sideways.
//   BASE=http://localhost:8806 node tests/trainingreal.spec.mjs [outDir]
import { mkdirSync } from 'node:fs';
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, openPanel } from './nav.mjs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const problems = [];
const check = (ok, what) => void (ok || problems.push(what));
const T = (y, m, d, h = 6) => Date.UTC(y, m, d, h);

const report = {
  week: 3, startedAt: T(2026, 10, 9, 1), finishedAt: T(2026, 10, 9, 8), base: 'stock',
  before: { gym: 0.31, general: 0.52, safety: 0.9 }, after: { gym: 0.4, general: 0.55, safety: 0.9 }, items: { gym: 48, general: 33, safety: 10 },
  gate: { pass: true, why: '4.6 points better on average, and no area fell further than it may' }, trained: { star: 100 }, rejected: [], phases: [{ name: 'star', minutes: 70 }],
  published: { repo: 'owner/ghosty-offline-brain', commit: 'b'.repeat(40) }, scale: 1,
};
const preflightOk = { at: T(2026, 10, 11, 9), ok: true, steps: [] };
const lines = {
  last: 'Week 3, finished Mon 9 Nov, 08:00.',
  card: 'The old brain scored 58% and the new one 62% on the same questions. Best: gym puzzles +9. Worst: general +3.',
  happened: 'Published: the new brain beat the old one (4.6 points better on average, and no area fell further than it may) and is offered to your phone.',
  next: 'The next run is due Mon 16 Nov, 08:00; it starts by itself.',
  preflight: 'Checked Wed 11 Nov, 09:00: all clear.',
};
const WILL = ["Gather this week's lessons from your own data and public sources, and keep them in your private Hugging Face space.", "Train on Kaggle's free GPU, which takes a few hours. Only free hours: nothing can cost money.", 'Test the new brain against the one you use now, on the same questions.', 'Offer it to your phone only if it does better. If not, nothing changes.'];
const status = (weekly, o = {}) => ({
  keys: { kaggle: true, hf: true }, phase: 'idle', note: 'Next training Mon 16 Nov, 08:00.', week: 3, next: T(2026, 10, 16, 8), gathered: {}, report: o.report === undefined ? report : o.report, previous: null,
  models: o.report === null ? [] : [{ week: 3, label: 'Ghosty (week 3)', repo: 'owner/ghosty-offline-brain', commit: 'b'.repeat(40), at: T(2026, 10, 9, 8), scores: report.after }], active: o.report === null ? null : 'b'.repeat(40),
  base: 'qwen3-0.6b', privateData: true, ratings: { up: 0, down: 0 }, weights: null, weekly: { ...weekly, willDo: WILL },
});
const withRun = status({ last: { at: T(2026, 10, 9, 8), kind: 'run', week: 3, real: true, before: 0.58, after: 0.62, outcome: 'published', why: '' }, lines, dueAt: T(2026, 10, 16, 8), preflight: preflightOk });
const noRun = status({ last: null, lines: { last: 'No real run has finished yet.', card: 'There is no report card yet: it appears when the first run has trained and tested a new brain.', happened: 'Nothing has been published.', next: 'The next run is due Mon 16 Nov, 08:00; it starts by itself.', preflight: 'Not checked yet: CHECK FIRST asks Kaggle and Hugging Face and starts nothing.' }, dueAt: T(2026, 10, 16, 8), preflight: null }, { report: null });
const stopped = { at: T(2026, 10, 11, 9, 5), ok: false, stoppedAt: 'hours', steps: [{ id: 'hours', label: "Kaggle's free GPU hours", ok: false, say: "Only 2 of Kaggle's 30 free GPU hours are left this week." }] };
const afterCheck = status({ last: null, lines: { ...noRun.weekly.lines, preflight: 'Checked Wed 11 Nov, 09:05: stopped at "Kaggle\'s free GPU hours". Only 2 of Kaggle\'s 30 free GPU hours are left this week.' }, dueAt: noRun.weekly.dueAt, preflight: stopped }, { report: null });

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined });
for (const world of ['scan', 'glass', 'ink']) {
  const ctx = await browser.newContext({ viewport: PHONE, ...UK });
  const page = await ctx.newPage();
  const tag = `[${world}]`;
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`${tag} pageerror: ${e.message}`));
  await page.addInitScript(({ key, w }) => {
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.themes1', '1');
    localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Boss', speak: false, sounds: false, theme: 'reactor', look: { ground: 'graphite', world: w, night: 'graphite', switches: {} } }));
    window.__ghostyHero = true;
    window.__ghostyPlace = { none: true };
  }, { key: KEY, w: world });
  let current = withRun;
  const posts = [];
  await page.route('**/api/training', (r) => r.fulfill({ json: current }));
  await page.route('**/api/training/gym', (r) => r.fulfill({ json: { ok: true } }));
  await page.route('**/api/training/preflight', (r) => {
    posts.push('preflight');
    current = afterCheck;
    return r.fulfill({ json: stopped });
  });
  await page.route('**/api/training/run', (r) => {
    posts.push(`run ${r.request().postData()}`);
    current = { ...withRun, phase: 'running', note: 'Starting now.', weekly: { ...withRun.weekly, lines: { ...lines, next: 'A run is under way: Starting now.' }, dueAt: null, willDo: WILL } };
    return r.fulfill({ json: current });
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 25000 }).catch(() => undefined);
  await page.evaluate(() => (location.hash = 'system'));
  await openPanel(page, 'system', 'OFFLINE BRAIN TRAINING');
  await page.waitForSelector('#pg-system .selftrain .trainweekly', { timeout: 15000 }).catch(() => problems.push(`${tag} no weekly card`));
  const rows = () => page.evaluate(() => Object.fromEntries(['last', 'card', 'happened', 'next', 'preflight'].map((k) => {
    const r = document.querySelector(`#pg-system .selftrain .trainweekly .rw[data-weekly=${k}]`);
    return [k, { k: r?.querySelector('.k')?.textContent ?? '', v: r?.querySelector('.v')?.textContent ?? '', say: document.querySelector(`#pg-system .selftrain .trainweekly .trainline[data-weekly=${k}]`)?.textContent ?? '' }];
  })));
  let r = await rows();
  check(r.last?.k === 'LAST REAL RUN' && r.last.v === 'Week 3' && r.last.say === lines.last, `${tag} last: ${JSON.stringify(r.last)}`);
  check(r.card?.v === '58% → 62%' && r.card.say === lines.card, `${tag} card: ${JSON.stringify(r.card)}`);
  check(r.happened?.v === 'Published' && r.happened.say === lines.happened, `${tag} happened: ${JSON.stringify(r.happened)}`);
  check(/^The next run is due Mon 16 Nov, 08:00/.test(r.next?.say ?? ''), `${tag} next: ${JSON.stringify(r.next)}`);
  check(r.preflight?.v === 'All clear' && /all clear/.test(r.preflight.say), `${tag} preflight: ${JSON.stringify(r.preflight)}`);
  // (the whole sentence is on show: a row would cut it at three lines)
  check(await page.evaluate(() => [...document.querySelectorAll('#pg-system .selftrain .trainline')].every((n) => n.scrollHeight <= n.clientHeight + 1)), `${tag} a sentence is cut off`);
  const btn = (name) => page.locator('#pg-system .selftrain .trainweekly button', { hasText: new RegExp(`^${name}$`, 'i') });
  check((await btn('CHECK FIRST').count()) === 1 && (await btn('RUN NOW').count()) === 1, `${tag} CHECK FIRST and RUN NOW keys`);
  check(await btn('RUN NOW').isEnabled(), `${tag} RUN NOW on with keys and nothing running`);
  for (const k of ['CHECK FIRST', 'RUN NOW']) {
    const box = await btn(k).boundingBox();
    check(!!box && box.height >= 43.5, `${tag} ${k} is a 44 pt key: ${box?.height}`);
  }
  await page.locator('#pg-system .selftrain .trainweekly').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/trainingreal-${world}.png` });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${tag} nothing sideways`);

  // RUN NOW: says what it will do; KEEP IT starts nothing
  await btn('RUN NOW').click();
  await page.waitForSelector('.confirm.sure', { timeout: 5000 }).catch(() => problems.push(`${tag} RUN NOW showed no confirm`));
  const said = await page.evaluate(() => document.querySelector('.confirm.sure')?.textContent ?? '');
  for (const w of [/your own data and public sources/, /free GPU/, /nothing can cost money/, /only if it does better/, /stops without starting if anything is wrong/]) check(w.test(said), `${tag} the confirm lacks ${w}: ${said.slice(0, 120)}`);
  await page.locator('.confirm.sure button', { hasText: /^KEEP IT$/i }).click();
  await page.waitForTimeout(400);
  check(posts.length === 0, `${tag} KEEP IT sent something: ${posts.join()}`);
  // CHECK FIRST: the step that stopped shows on the card
  await btn('CHECK FIRST').click();
  await page.waitForFunction(() => /stopped at "Kaggle's free GPU hours"/.test(document.querySelector('#pg-system .selftrain .trainweekly .trainline[data-weekly=preflight]')?.textContent ?? ''), null, { timeout: 5000 }).catch(() => problems.push(`${tag} the card never showed the step that stopped`));
  r = await rows();
  check(r.preflight?.v === 'Stopped', `${tag} preflight word: ${JSON.stringify(r.preflight)}`);
  check(posts.join() === 'preflight', `${tag} posts: ${posts.join()}`);
  // RUN NOW confirmed: the one call, with confirm, and the card says a run is under way
  await btn('RUN NOW').click();
  await page.waitForSelector('.confirm.sure', { timeout: 5000 });
  await page.locator('.confirm.sure button', { hasText: /^RUN NOW$/i }).click();
  await page.waitForFunction(() => /A run is under way/.test(document.querySelector('#pg-system .selftrain .trainweekly .trainline[data-weekly=next]')?.textContent ?? ''), null, { timeout: 5000 }).catch(() => problems.push(`${tag} after RUN NOW the card does not say a run is under way`));
  check(posts.at(-1) === 'run {"confirm":true}', `${tag} the confirmed call: ${posts.at(-1)}`);
  check(!(await btn('RUN NOW').isEnabled()), `${tag} RUN NOW is off while a run is under way`);

  // nothing yet: honest words
  current = noRun;
  await page.evaluate(() => (location.hash = 'core'));
  await page.evaluate(() => (location.hash = 'system'));
  await openPanel(page, 'system', 'OFFLINE BRAIN TRAINING');
  await page.waitForFunction(() => /No real run has finished yet/.test(document.querySelector('#pg-system .selftrain .trainweekly')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => problems.push(`${tag} no "No real run has finished yet"`));
  r = await rows();
  check(r.last?.v === 'None yet' && r.last.say === 'No real run has finished yet.' && /no report card yet/.test(r.card?.say ?? '') && r.happened?.say === 'Nothing has been published.', `${tag} the empty card: ${JSON.stringify(r)}`);
  await page.screenshot({ path: `${out}/trainingreal-${world}-none.png` });
  await ctx.close();
}
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'Weekly training card clean: last real run, report card, what happened, next due and pre-flight in words; CHECK FIRST shows the step that stopped; RUN NOW says what it will do and starts nothing until confirmed; honest with no run yet; Scan, Glass and Ink at 440.');
process.exit(problems.length ? 1 : 0);
