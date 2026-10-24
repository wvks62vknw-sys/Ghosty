// The offline brain's weekly self-training, on the phone (Chromium, or WebKit with BROWSER=webkit):
//  1. SYSTEM → OFFLINE BRAIN TRAINING with no keys (the real preview brain): "NEEDS 2 KEYS", which two keys and
//     where to get them in plain steps, TRAIN NOW off; the two key slots are in KEYS with HOW TO GET IT;
//  2. 👍 / 👎 under a reply: the rating reaches the brain (its status counts it), tapping again takes it back,
//     the choice shows again after a reload;
//  3. the report card (the brain's answer stood in for with a finished week): this week vs last week by area,
//     KEPT and why, what he trained on, how long, what was thrown away and why, the brains kept (RECOMMENDED);
//     ROLLBACK goes one back; GPU HOURS (Kaggle's hours left, when they come back, what the next run needs and its
//     mode, a smaller run said in plain words); what ran on which of Kaggle's two cards, in how many sessions;
//     the offline brain's chooser in SETTINGS lists the trained weeks with the stock
//     models as the fallback and says which one is new;
//  4. nothing scrolls sideways at iPhone width.
//   BASE=http://localhost:8875 node tests/selftrain.spec.mjs [outDir]
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
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#pair input', { timeout: 20000 });
await page.fill('#pair input', KEY);
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });

const api = (path, init = {}) => page.evaluate(async ([p, i, k]) => (await fetch(`/api${p}`, { ...i, headers: { 'content-type': 'application/json', 'x-ghosty': '1', 'x-ghosty-key': k } })).json(), [path, init, KEY]);
const panelText = () => page.evaluate(() => document.querySelector('#pg-system .selftrain')?.textContent ?? '');

// ---- 1. no keys: the panel says exactly which two and where
await page.evaluate(() => (location.hash = 'system'));
await openPanel(page, 'system', 'OFFLINE BRAIN TRAINING');
await page.waitForSelector('#pg-system .selftrain .trainnote', { timeout: 15000 });
let light = await page.evaluate(() => document.querySelector('#pg-system .selftrain h3 small')?.textContent ?? '');
check(light === 'NEEDS 2 KEYS', `status light: "${light}"`);
let text = await panelText();
check(/Waiting for two keys: Kaggle and a Hugging Face write token/.test(text), `note: ${text.slice(0, 200)}`);
check(/kaggle\.com → Settings → API Tokens → Generate New Token/.test(text) && /"Hugging Face token \(training\)"/.test(text) && /two private spaces/.test(text) && /only reach those two/.test(text), 'the steps say where each key is made (today\'s Kaggle page; a token for two private repos)');
check(await page.evaluate(() => [...document.querySelectorAll('#pg-system .selftrain button')].find((b) => b.textContent === 'TRAIN NOW')?.disabled === true), 'TRAIN NOW is off without the keys');
check(await page.evaluate(() => [...document.querySelectorAll('#pg-system .selftrain button')].find((b) => b.textContent === 'ROLLBACK')?.disabled === true), 'ROLLBACK is off with nothing to go back to');
await page.locator('#pg-system .selftrain').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${out}/selftrain-${engine}-nokeys.png` });
await openPanel(page, 'system', 'KEYS');
await page.evaluate(() => [...document.querySelectorAll('#pg-system button')].find((b) => /OPTIONAL KEYS/.test(b.textContent ?? ''))?.click());
await page.waitForFunction(() => [...document.querySelectorAll('#pg-system .keyblock .lab')].some((l) => /Kaggle/.test(l.textContent ?? '')), null, { timeout: 5000 }).catch(() => undefined);
const slots = await page.evaluate(() => [...document.querySelectorAll('#pg-system .keyblock')].map((b) => ({ lab: b.querySelector('.lab')?.textContent ?? '', steps: b.querySelectorAll('ol.steps li').length, help: !!b.querySelector('button') })));
for (const want of ['Kaggle (free GPUs for training)', 'Hugging Face token (training)']) {
  const s = slots.find((x) => x.lab === want);
  check(!!s && s.steps >= 3 && s.help, `key slot "${want}": ${JSON.stringify(s)}`);
}

// ---- 2. 👍 / 👎 under a reply: in the caption (what a phone shows) and in the LOG
await page.evaluate(() => (location.hash = 'core'));
await page.waitForSelector('#cin', { timeout: 10000 });
// (the preview brain is shared by every spec run: count from what it already has)
const r0 = (await api('/training')).ratings;
await page.fill('#cin', 'hello there, rate me');
await page.press('#cin', 'Enter');
await page.waitForSelector('#ccap .rate button[aria-label="Bad reply"]', { state: 'visible', timeout: 20000 }).catch(() => problems.push('no 👍/👎 under the reply in the caption'));
// (the caption types itself in: wait for the whole reply)
await page.waitForFunction(() => /Mock reply to: hello there, rate me/.test(document.querySelector('#ccap')?.textContent ?? ''), null, { timeout: 5000 }).catch(() => problems.push('the caption shows the reply with its buttons'));
await page.screenshot({ path: `${out}/selftrain-${engine}-caption.png` });
await page.locator('#ccap button[aria-label="Bad reply"]').click();
await page.waitForTimeout(600);
check((await page.locator('#ccap').textContent())?.includes('Mock reply'), 'tapping 👎 does not dismiss the caption');
check((await page.locator('#ccap button[aria-label="Bad reply"]').getAttribute('aria-pressed')) === 'true', '👎 shows as pressed');
let st = await api('/training');
check(st.ratings?.down === r0.down + 1 && st.ratings?.up === r0.up, `the brain counted the 👎: ${JSON.stringify(st.ratings)}`);
// the LOG: the same reply, the same choice; change of mind there
await page.locator('.logbtn:visible').first().click();
const reply = page.locator('.log .msg', { has: page.locator('.rate') }).last();
await reply.waitFor({ state: 'visible', timeout: 5000 });
check(/Mock reply to: hello there, rate me/.test((await reply.textContent()) ?? ''), 'the buttons sit under the reply in the LOG');
check((await reply.locator('button[aria-label="Bad reply"]').getAttribute('aria-pressed')) === 'true', 'the LOG shows the 👎 too');
check((await page.locator('.log .msg.me .rate').count()) === 0, "no buttons under the owner's own messages");
await reply.locator('button[aria-label="Good reply"]').click();
await page.waitForTimeout(600);
st = await api('/training');
check(st.ratings?.down === r0.down && st.ratings?.up === r0.up + 1, `👍 replaced the 👎: ${JSON.stringify(st.ratings)}`);
await page.screenshot({ path: `${out}/selftrain-${engine}-rate.png` });
await page.reload({ waitUntil: 'domcontentloaded' });
await page.locator('.logbtn:visible').first().waitFor({ timeout: 20000 });
await page.locator('.logbtn:visible').first().click();
await page.locator('.log .msg .rate').last().waitFor({ state: 'visible', timeout: 20000 });
check(await page.evaluate(() => [...document.querySelectorAll('.log .msg button[aria-label="Good reply"]')].some((b) => b.getAttribute('aria-pressed') === 'true')), 'the 👍 shows again after a reload');
await page.locator('.log .msg button[aria-label="Good reply"][aria-pressed="true"]').last().click();
await page.waitForTimeout(600);
st = await api('/training');
check(st.ratings?.down === r0.down && st.ratings?.up === r0.up, `tapping 👍 again took it back: ${JSON.stringify(st.ratings)}`);
await page.locator('.logbtn:visible').first().click();

// ---- 3. a finished week (the brain's answer stood in for): the report card
const c = (ch) => ch.repeat(40);
const week = (n, after, commit) => ({ week: n, label: `Ghosty (week ${n})`, repo: 'owner/ghosty-offline-brain', commit, at: Date.UTC(2026, 9, 10 + n), scores: after });
const report = {
  week: 2, startedAt: Date.UTC(2026, 9, 17, 1), finishedAt: Date.UTC(2026, 9, 17, 6), base: 'Ghosty (week 1)',
  before: { gym: 0.31, general: 0.52, library: 0.4, tools: 0.58, safety: 0.9 },
  after: { gym: 0.38, general: 0.55, library: 0.47, tools: 0.67, safety: 0.9 },
  items: { gym: 48, general: 33, library: 12, tools: 12, safety: 10 },
  gate: { pass: true, why: '5.6 points better on average, no area down more than 3 points' },
  trained: { star: 412, critique: 37, evol: 58, library: 34, tool: 71, pref: 9, replay: 380, general: 400, dpo: 211 },
  rejected: [{ why: 'STaR samples the checker failed', n: 5120 }, { why: 'evolved tasks dropped: not changed', n: 4 }, { why: 'bad dataset row: bad task (or an exam seed)', n: 1 }],
  phases: [{ name: 'setup', minutes: 14 }, { name: 'exam_before', minutes: 6 }, { name: 'star', minutes: 71 }, { name: 'critique', minutes: 12 }, { name: 'judge', minutes: 4 }, { name: 'sft', minutes: 38 }, { name: 'dpo', minutes: 9 }, { name: 'exam_after', minutes: 12 }, { name: 'publish', minutes: 17 }],
  published: { repo: 'owner/ghosty-offline-brain', commit: c('b') }, scale: 1,
  cards: { count: 2, train: 'cuda:0', sample: 'cuda:1', names: ['Tesla T4', 'Tesla T4'], saved_minutes: 52 }, sessions: 2,
};
const gpuLine = 'Kaggle: 6 of 30 free GPU hours left this week; they come back Sat 24 Oct, 01:00. Only 6 h left this week: a smaller run, the exam on the phone. (A full run needs 10 h.)';
const previous = { ...report, week: 1, before: { gym: 0.25, general: 0.5, library: 0.33, tools: 0.5, safety: 0.9 }, after: report.before, gate: { pass: true, why: '' } };
const status = (active) => ({ keys: { kaggle: true, hf: true }, phase: 'idle', note: 'Next training Sat 24 Oct, 01:00.', week: 2, next: Date.UTC(2026, 9, 24, 1), gathered: {}, report, previous, models: [week(2, report.after, c('b')), week(1, report.before, c('a'))], active, privateData: true, ratings: { up: 0, down: 0 }, weights: `/api/w/${'c'.repeat(48)}/`, gpu: { left: 6, total: 30, refreshAt: Date.UTC(2026, 9, 24), at: Date.UTC(2026, 9, 20), needs: 5.5, mode: 'economy', line: gpuLine } });
await page.route('**/api/training', (r) => r.fulfill({ json: status(c('b')) }));
await page.route('**/api/training/rollback', (r) => r.fulfill({ json: status(c('a')) }));
await page.route('**/api/training/gym', (r) => r.fulfill({ json: { ok: true } }));
await page.evaluate(() => (location.hash = 'settings'));
await page.waitForTimeout(300);
await page.evaluate(() => (location.hash = 'system'));
await openPanel(page, 'system', 'OFFLINE BRAIN TRAINING');
await page.waitForFunction(() => document.querySelector('#pg-system .selftrain .trainweek')?.textContent?.startsWith('WEEK 2'), null, { timeout: 10000 }).catch(() => problems.push('the report card did not show week 2'));
light = await page.evaluate(() => document.querySelector('#pg-system .selftrain h3 small')?.textContent ?? '');
check(light === 'IDLE', `status light with keys: "${light}"`);
const card = await page.evaluate(() => {
  const pn = document.querySelector('#pg-system .selftrain');
  const rows = [...pn.querySelectorAll('.rw')].map((r) => ({ area: r.dataset.area ?? '', model: r.dataset.model ?? '', k: r.querySelector('.k')?.textContent ?? '', v: r.querySelector('.v')?.textContent ?? '', n: r.querySelector('.n')?.textContent ?? '' }));
  return { rows, text: pn.textContent ?? '' };
});
const area = (a) => card.rows.find((r) => r.area === a);
check(area('gym')?.v === '31% → 38% (last week 31%) · 48 questions' && area('gym')?.n === '+7', `GYM row: ${JSON.stringify(area('gym'))}`);
check(area('safety')?.n === '±0', `SAFETY row: ${JSON.stringify(area('safety'))}`);
check(card.rows.some((r) => r.k === 'AVERAGE' && r.n === 'KEPT'), 'AVERAGE … KEPT');
check(/Kept: 5\.6 points better on average, no area down more than 3 points\. \(Both brains were tested exactly as your phone would run them\.\)/.test(card.text), 'why it was kept');
check(card.rows.some((r) => /puzzles he solved himself \(each answer checked\)/.test(r.v) && r.n === '412'), 'what he trained on (STaR), in plain words');
check(card.rows.some((r) => /your 👍 and 👎/.test(r.v) && r.n === '9'), 'what he trained on (ratings)');
check(/HOW LONG: 3 h 3 min ON KAGGLE/.test(card.text), `how long: ${card.text.match(/HOW LONG[^O]*/)?.[0]}`);
check(card.rows.some((r) => r.v === 'STaR samples the checker failed' && r.n === '5,120'), 'what was thrown away, and why');
check(card.rows.some((r) => r.model === c('b') && r.n === 'RECOMMENDED') && card.rows.some((r) => r.model === c('a') && !r.n), 'the brains kept, week 2 recommended');
check(/This phone is set to: /.test(card.text) && !/The phone uses/.test(card.text), 'what the phone is set to, said apart from what is recommended');
check(!/Not tried for real yet/.test(card.text), 'a finished week is not called untried');
check(card.rows.some((r) => r.k === 'STOCK'), 'the stock model kept as the fallback');
check(card.rows.some((r) => r.k === 'GPU HOURS' && r.v === gpuLine && r.n === 'SMALLER RUN'), `the quota line: ${JSON.stringify(card.rows.find((r) => r.k === 'GPU HOURS'))}`);
check(/Two GPUs: practice and tests on the second while he learned on the first, 52 min saved\. Done in 2 sessions: each saved its place and the next carried on\./.test(card.text), 'what ran where, and in how many sessions');
await page.locator('#pg-system .selftrain').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${out}/selftrain-${engine}-report.png`, fullPage: false });
const roll = page.locator('#pg-system .selftrain button', { hasText: 'ROLLBACK' });
check(!(await roll.isDisabled()), 'ROLLBACK is on with an older brain to go back to');
await roll.click();
// (it asks first: the newest brain is dropped for good)
await page.locator('.modal .confirm.sure button.sureyes').click({ timeout: 5000 }).catch(() => problems.push('ROLLBACK did not ask first'));
await page.waitForFunction((a) => document.querySelector(`#pg-system .selftrain .rw[data-model="${a}"] .n`)?.textContent === 'RECOMMENDED', c('a'), { timeout: 5000 }).catch(() => problems.push('ROLLBACK did not make week 1 the recommended brain'));
await page.waitForTimeout(600); // (stores save a moment after they change)
const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.offlinebrain') ?? '{}'));
check(stored.active === c('a') && stored.trained?.length === 2, `the phone keeps the trained list: ${JSON.stringify({ active: stored.active, n: stored.trained?.length })}`);

// the offline brain's chooser in SETTINGS: the trained weeks, then the stock models; the recommended one said
await page.evaluate(() => (location.hash = 'settings'));
await openPanel(page, 'settings', 'OFFLINE BRAIN');
await page.waitForSelector('#pg-settings .offbrain', { timeout: 10000 });
const chooser = await page.evaluate(() => ({ options: [...document.querySelectorAll('#pg-settings .offbrain select.obmodel option')].map((o) => o.textContent), hidden: document.querySelector('#pg-settings .offbrain select.obmodel')?.hidden, news: document.querySelector('#pg-settings .offbrain .obnew')?.textContent ?? '' }));
check(JSON.stringify(chooser.options) === JSON.stringify(['Ghosty (week 2)', 'Ghosty (week 1) · recommended', 'Qwen3 0.6B', 'Qwen2.5 0.5B']) && chooser.hidden === false, `the chooser: ${JSON.stringify(chooser)}`);
check(/^NEW: Ghosty \(week 1\) is the recommended brain/.test(chooser.news) && !/better/.test(chooser.news.split('(')[0]), `the new-brain line: "${chooser.news}"`);
await page.selectOption('#pg-settings .offbrain select.obmodel', { label: 'Ghosty (week 1) · recommended' });
await page.waitForTimeout(600);
const chosen = await page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.offlinebrain') ?? '{}'));
check(/^Ghosty-week-1-aaaaaaa$/.test(chosen.model) && chosen.downloaded === false, `choosing it waits for DOWNLOAD: ${JSON.stringify({ model: chosen.model, downloaded: chosen.downloaded })}`);
await page.locator('#pg-settings .offbrain').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${out}/selftrain-${engine}-chooser.png` });

// ---- 4. iPhone width
await page.evaluate(() => (location.hash = 'system'));
await openPanel(page, 'system', 'OFFLINE BRAIN TRAINING');
await page.waitForSelector('#pg-system .selftrain .trainweek', { timeout: 10000 });
const fit = await page.evaluate(() => {
  const pn = document.querySelector('#pg-system .selftrain');
  const w = pn.getBoundingClientRect();
  const over = [...pn.querySelectorAll('.rw, button, .note')].filter((r) => r.getBoundingClientRect().right > w.right + 1).map((r) => `${r.tagName}.${r.className}: ${(r.textContent ?? '').slice(0, 40)}`);
  return { doc: document.documentElement.scrollWidth, vw: innerWidth, over };
});
check(fit.doc <= fit.vw && fit.over.length === 0, `sideways: ${JSON.stringify(fit)}`);

await browser.close();
if (problems.length) {
  console.error(`selftrain spec (${engine}): ${problems.length} problem(s)\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`selftrain spec (${engine}): all good`);
