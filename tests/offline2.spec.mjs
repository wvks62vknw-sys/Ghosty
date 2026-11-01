// TRUST BY GRADE and THE INDEPENDENCE SHEET (BRIEF-OFFLINE-DEFAULT, batch ⑥ part 2; OWNER-ISSUES 72, 78), in a real browser
// at 390 × 844, on the stand-in for the brain on the phone (window.__ghostyOfflineEngine, as the sit spec uses) and the
// preview brain for the cloud. SCHOOL's grades per brain come as a fixture for GET /api/school/trust (the brain's own
// route is checked to answer, then stood in for: the grades themselves are apps/edge/test/offline2.test.mjs's). Checked:
//  1. a trusted ask ("hello": greetings at 92% on 24 questions) is answered FIRST on the phone, tagged "on this phone",
//     with ASK THE CLOUD under it; the meter counts it as his own, by its kind;
//  2. ASK THE CLOUD: the cloud answers the same ask under it, the phone's answer stays above, struck faintly; the question
//     is not shown twice; the tap is kept as a miss and the meter counts the ask as the cloud's;
//  3. an untrusted ask (rewording, at 70% under his 80%) goes to the cloud, the phone's brain is not asked;
//  4. SETTINGS → OFFLINE BRAIN → TRUST: the dial ("above this grade I answer on your phone first"), the table (kind, grade,
//     questions, on phone or cloud, why), the dial moving a kind; WHICH BRAIN's one line per brain here;
//  5. "how independent are you?": the week said in the chat and SYSTEM → INDEPENDENCE open: seven and thirty days, the
//     kinds and why, the sparkline week by week, Sovereign mode's truth and the honest ceiling; the Brief's weekly line;
//  6. SOVEREIGN MODE (Always) with no brain to answer: a greeting stops with the refusal line, and its marker reaches no
//     address;
// nothing scrolls sideways at 390 × 844, every button is at least 44 px tall, and the new parts carry VoiceOver labels.
//   BASE=http://localhost:<port> node tests/offline2.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { UK, openPanel, openSection } from './nav.mjs';
import { mkdirSync, readFileSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const SMALL = { width: 390, height: 844 };
const problems = [];
const check = (n, ok, what) => ok || problems.push(`[${n}] ${what}`);

// The brains' keys as SCHOOL files their papers: id and the first seven of the weights' commit (offline/models.ts).
const models = readFileSync(new URL('../apps/web/src/offline/models.ts', import.meta.url), 'utf8');
const keyOf = (id) => `${id}@${new RegExp(`id: '${id.replace(/\./g, '\\.')}', label: '[^']+', repo: '[^']+', rev: '([0-9a-f]{40})'`).exec(models)[1].slice(0, 7)}`;
const QWEN3 = 'Qwen3-0.6B-q4f16_1-MLC';
const FLOOR = 'SmolLM2-360M-Instruct-q4f16_1-MLC';
const row = (cat, pct, items, from) => ({ cat, pct, items, from });
const NONE = (cats) => cats.map((c) => row(c, null, 0, ''));
const TABLE = {
  floor: 20,
  brains: [
    { model: keyOf(QWEN3), at: Date.now() - 86_400_000, papers: 7, rows: [row('greet', 92, 24, 'talking and listening'), row('spelling', 100, 21, 'spelling'), row('reword', 70, 20, 'grammar and writing'), ...NONE(['summary', 'translate', 'sums', 'memory', 'reading', 'agenda'])] },
    { model: keyOf(FLOOR), at: Date.now() - 2 * 86_400_000, papers: 3, rows: [row('greet', 85, 22, 'talking and listening'), row('spelling', 60, 21, 'spelling'), ...NONE(['reword', 'summary', 'translate', 'sums', 'memory', 'reading', 'agenda'])] },
  ],
};

const engine = (have) => {
  // The brain on the phone, stood in: here (Qwen3 0.6B in use, the floor beside it), answering in pieces.
  if (!sessionStorage.getItem('o2-seeded')) {
    sessionStorage.setItem('o2-seeded', '1');
    localStorage.setItem('ghosty.offlinebrain', JSON.stringify({ model: 'Qwen3-0.6B-q4f16_1-MLC', downloaded: true, have, guarded: true }));
    // two weeks before this one, for the trend: 40% and 48% on his own brains
    const pad = (n) => String(n).padStart(2, '0');
    const day = (ago) => {
      const d = new Date(Date.now() - ago * 86_400_000);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };
    localStorage.setItem('ghosty.independence', JSON.stringify({ days: [
      { d: day(15), n: { phone: 8, cloud: 12 }, c: { mock: 12 }, a: { chat: 12 }, g: { greet: { n: 8, o: 8 }, cloud: { n: 12, o: 0 } } },
      { d: day(8), n: { phone: 12, cloud: 13 }, c: { mock: 13 }, a: { chat: 13 }, g: { greet: { n: 12, o: 12 }, cloud: { n: 13, o: 0 } } },
    ], stopped: [], postedAt: Date.now() }));
  }
  window.__ghostyOfflineEngine = {
    ready: true,
    calls: [],
    loads: 0,
    unloads: 0,
    idleMs: 500,
    async load() {
      this.loads++;
    },
    unload() {
      this.unloads++;
    },
    async chat(messages, onToken) {
      this.calls.push(messages.at(-1)?.content ?? '');
      for (const w of ['Hello ', 'from ', 'your ', 'phone.']) {
        await new Promise((r) => setTimeout(r, 20));
        onToken(w);
      }
    },
  };
};

// The brain's own route answers (owner-only), before the fixture stands in for its grades.
const real = await fetch(`${base}/api/school/trust`, { headers: { 'x-ghosty': '1', 'x-ghosty-key': KEY } }).then((r) => r.json()).catch((e) => ({ error: String(e) }));
check(0, Array.isArray(real.brains) && real.floor === 20, `GET /api/school/trust answered ${JSON.stringify(real).slice(0, 160)}`);

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: SMALL, deviceScaleFactor: 2, ...UK, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
const page = await ctx.newPage();
page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
await page.addInitScript(engine, [FLOOR, QWEN3]);
await page.route('**/api/school/trust', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TABLE) }));
const sent = [];
page.on('request', (r) => {
  const u = new URL(r.url());
  if (u.pathname.startsWith('/api/')) sent.push({ path: u.pathname, body: r.postData() ?? '' });
});

const today = () => page.evaluate(() => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const k = JSON.parse(localStorage.getItem('ghosty.independence') ?? '{}');
  return (k.days ?? []).find((x) => x.d === `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`) ?? { n: {}, g: {} };
});
const sideways = async (where) => {
  const o = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check(where, o <= 1, `${where}: the page scrolls sideways (${o}px)`);
};
const small = async (where, sel) => {
  const s = await page.evaluate((sel) => [...document.querySelectorAll(sel)].filter((b) => b.offsetParent && b.getBoundingClientRect().height < 43.5).map((b) => `${b.textContent.trim().slice(0, 30)} (${Math.round(b.getBoundingClientRect().height)}px)`), sel);
  check(where, !s.length, `${where}: buttons under 44 px: ${s.join(', ')}`);
};
const say = async (words) => {
  await page.evaluate(() => (location.hash = 'core'));
  if (!(await page.locator('#cin').isVisible().catch(() => false))) await page.click('.logbtn').catch(() => undefined);
  await page.fill('#cin', words);
  await page.keyboard.press('Enter');
};
/** The last entry is a reply from the cloud (its own model line, not the phone's), after `n` entries. */
const cloudAfter = (n, what) => page.waitForFunction((n) => {
  const ms = [...document.querySelectorAll('.msg')];
  const m = ms.at(-1);
  return ms.length > n && !!m && !m.classList.contains('me') && !m.classList.contains('off') && !!m.querySelector('.rcwho') && !/on (this|your) phone/.test(m.querySelector('.rcwho')?.textContent ?? '');
}, n, { timeout: 20000 }).then(() => true).catch(() => (problems.push(what), false));
const replies = () => page.$$eval('.msg', (ms) => ms.map((m) => ({ cls: m.className, who: m.querySelector('.rcwho')?.textContent ?? '', text: m.textContent ?? '' })));
const calls = () => page.evaluate(() => window.__ghostyOfflineEngine.calls.length);

await page.goto(base);
await page.fill('#pair input', KEY);
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
// the table comes with the training's check at start (offline/trained.ts → offline/brain.ts syncTrust)
await page.waitForFunction(() => (JSON.parse(localStorage.getItem('ghosty.trust') ?? '{}').brains ?? []).length === 2, null, { timeout: 15000 }).catch(() => problems.push('[0] the trust table was not fetched at start'));

// 1. a trusted ask: answered first on this phone, tagged so, ASK THE CLOUD under it
await say('hello');
const first = page.locator('.msg.off.first').last();
await first.waitFor({ state: 'attached', timeout: 15000 }).catch(() => problems.push('[1] "hello" was not answered first on the phone'));
await page.waitForFunction(() => /phone\./.test([...document.querySelectorAll('.msg.off.first')].at(-1)?.textContent ?? ''), null, { timeout: 10000 }).catch(() => undefined);
check(1, /on this phone/.test((await first.locator('.rcwho').textContent().catch(() => '')) ?? ''), 'the model line does not say "on this phone"');
check(1, /greetings passed at 92% on 24 questions/.test((await first.textContent().catch(() => '')) ?? ''), 'the answer does not say the grade that earned it');
check(1, (await calls()) === 1, `the phone's brain was asked ${await calls()} times`);
// (on Home the reply shows on its card; the log, with the model line, opens from "Continue in chat")
check(1, (await first.locator('button.askcloud').count()) === 1, 'no ASK THE CLOUD under the answer in the chat');
const ask = page.locator('#ccap button.askcloud');
await ask.waitFor({ state: 'visible', timeout: 8000 }).catch(() => problems.push('[1] no ASK THE CLOUD on the reply card'));
check(1, ((await ask.getAttribute('aria-label').catch(() => '')) ?? '').includes('Ask the cloud the same question'), 'ASK THE CLOUD has no VoiceOver label');
await page.waitForFunction(() => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const t = (JSON.parse(localStorage.getItem('ghosty.independence') ?? '{}').days ?? []).find((x) => x.d === `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
  return t?.g?.greet?.o === 1;
}, null, { timeout: 8000 }).catch(async () => problems.push(`[1] the meter did not count it as his own greeting: ${JSON.stringify(await today())}`));
// (the reply card eases in: measured once it has settled)
await page.waitForTimeout(900);
await small('chat', '.msg button.askcloud, #ccap button.askcloud');
await sideways('chat');
await page.screenshot({ path: `${out}/offline2-first.png` });

// 2. ASK THE CLOUD: the cloud answers under it; the phone's answer stays above, struck; a miss kept; counted as the cloud's
const before = (await replies()).length;
await ask.click();
await cloudAfter(before, '[2] the cloud did not answer under it');
const r2 = await replies();
const struck = r2.findIndex((r) => /\bfirst\b/.test(r.cls) && /\bstruck\b/.test(r.cls));
check(2, struck >= 0 && struck < r2.length - 1, 'the phone’s answer is not kept above the cloud’s, struck');
check(2, struck > 0 && /\bme\b/.test(r2[struck - 1].cls) && /hello/.test(r2[struck - 1].text) && !r2.slice(struck + 1).some((r) => /\bme\b/.test(r.cls)), 'the question was shown twice');
check(2, !(await page.locator('.msg.first.struck button.askcloud, #ccap button.askcloud').count()), 'ASK THE CLOUD is still there after the tap');
const misses = await page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.trust') ?? '{}').misses ?? []);
check(2, misses.length === 1 && misses[0].cat === 'greet' && /^Qwen3-0\.6B-q4f16_1-MLC@[0-9a-f]{7}$/.test(misses[0].model), `the miss: ${JSON.stringify(misses)}`);
await page.waitForFunction(() => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const t = (JSON.parse(localStorage.getItem('ghosty.independence') ?? '{}').days ?? []).find((x) => x.d === `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
  return t?.g?.greet?.n === 1 && t?.g?.greet?.o === 0 && (t?.n?.cloud ?? 0) >= 1;
}, null, { timeout: 8000 }).catch(async () => problems.push(`[2] the ask was not counted as the cloud's: ${JSON.stringify(await today())}`));
await page.screenshot({ path: `${out}/offline2-askcloud.png` });

// 3. an untrusted kind (rewording at 70%, under his 80%): the cloud's; the phone's brain is not asked
const asked = await calls();
const n3 = (await replies()).length;
await say('Reword this: i has went to the shop and buyed some bread');
await cloudAfter(n3 + 1, '[3] the rewording did not go to the cloud');
check(3, (await calls()) === asked, 'the phone’s brain was asked an untrusted kind');
check(3, !/\bfirst\b/.test((await replies()).at(-1)?.cls ?? ''), 'an untrusted kind was answered first on the phone');

// 4. SETTINGS → OFFLINE BRAIN → TRUST, and WHICH BRAIN's lines
await page.evaluate(() => (location.hash = 'settings'));
await page.locator('#pg-settings .pn.offbrain').waitFor({ state: 'attached', timeout: 10000 });
await openPanel(page, 'settings', 'OFFLINE');
const pn = page.locator('#pg-settings .pn.offbrain');
const trust = pn.locator('.trustbox');
await trust.waitFor({ state: 'visible', timeout: 8000 }).catch(() => problems.push('[4] no TRUST in Settings → Offline brain'));
check(4, /Above this grade I answer on your phone first: 80%/.test((await trust.textContent().catch(() => '')) ?? ''), 'the dial does not say its words');
check(4, (await trust.locator('input.trustdial').getAttribute('aria-label').catch(() => '')) === 'Trust bar: above this grade I answer on your phone first', 'the dial has no VoiceOver label');
const rowsOf = () => trust.locator('li.trustrow').evaluateAll((ls) => ls.map((l) => ({ on: l.classList.contains('on'), label: l.getAttribute('aria-label') ?? '', text: l.textContent ?? '' })));
let rows = await rowsOf();
check(4, rows.length === 9, `${rows.length} kinds in the table`);
check(4, rows[0]?.on && /^Greetings and small talk: 92% on 24 questions\. Answered on this phone first/.test(rows[0].label), `greetings: ${JSON.stringify(rows[0])}`);
const reword = () => rows.find((r) => /^Rewording/.test(r.label));
check(4, !reword()?.on && /70% on 20 questions: under your 80%/.test(reword()?.text ?? ''), `rewording: ${JSON.stringify(reword())}`);
check(4, /the cloud's until its next report card|you asked the cloud instead/.test(rows[0].text) === false, 'one miss dropped greetings');
const which = ((await pn.locator('.trustwhich').textContent().catch(() => '')) ?? '').trim();
check(4, which.includes('SmolLM2 360M: greetings') && which.includes('Qwen3 0.6B: + spelling'), `WHICH BRAIN reads "${which}"`);
const dialTo = (v) => trust.locator('input.trustdial').evaluate((el, v) => {
  el.value = v;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}, v);
await dialTo('70');
await page.waitForTimeout(300);
rows = await rowsOf();
check(4, reword()?.on === true, 'the dial at 70% does not trust rewording at 70%');
await dialTo('80');
await page.waitForTimeout(300);
await trust.scrollIntoViewIfNeeded().catch(() => undefined);
await sideways('settings');
await page.screenshot({ path: `${out}/offline2-trust.png` });

// 5. "how independent are you?": said in the chat, and SYSTEM → INDEPENDENCE open; then the Brief's line
await say('how independent are you?');
// (the last message, not any: the smoke loop's one preview brain keeps every earlier spec's conversation)
await page.waitForFunction(() => /The last seven days, \d+% of what you asked stayed on your own brains \(\d+ of \d+\)/.test([...document.querySelectorAll('.msg')].at(-1)?.textContent ?? ''), null, { timeout: 10000 }).catch(() => problems.push('[5] the chat did not say the week'));
const sheet = page.locator('#pg-system .pn.indsheet');
await sheet.locator('.indspans').waitFor({ state: 'visible', timeout: 10000 }).catch(() => problems.push('[5] "how independent are you?" did not open SYSTEM → INDEPENDENCE'));
const st = ((await sheet.textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ');
check(5, /The last 7 days: \d+% on your own brains \(\d+ of \d+ asks?\)\./.test(st) && /The last 30 days: \d+% on your own brains/.test(st), 'no seven and thirty days');
check(5, (await sheet.locator('.indtrend svg.spark').count()) === 1 && /Your own brains, week by week: 40% → 48% →/.test(st), 'no sparkline week by week');
const cats = await sheet.locator('li.indcat').evaluateAll((ls) => ls.map((l) => l.getAttribute('aria-label') ?? ''));
check(5, cats.length === 10, `${cats.length} kinds on the sheet`);
check(5, /^Greetings and small talk: on your phone 7 days \d+% of \d+ · 30 days \d+% of \d+\. on this phone first: 92% on 24 questions\.$/.test(cats[0] ?? ''), `greetings on the sheet: "${cats[0]}"`);
check(5, cats.some((c) => /^Rewording and grammar: .*the cloud’s: 70% on 20 questions: under your 80%/.test(c)), 'the sheet does not say why rewording is the cloud’s');
check(5, cats.some((c) => /^Everything else: .*the cloud’s: it needs a tool/.test(c)), 'the sheet does not say why everything else is the cloud’s');
check(5, /SOVEREIGN MODE is the plain name for Always .*the cloud is off-limits; what I can’t do here, I say I can’t\./.test(st), 'no Sovereign mode truth');
check(5, (st.match(/a phone alone will likely never match the very biggest cloud brains/g) ?? []).length === 1, 'the honest ceiling is not said once');
check(5, /Answering first on this phone: Qwen3 0\.6B\. Your bar: 80%\./.test(st), 'the brain sitting here is not named');
await sheet.scrollIntoViewIfNeeded().catch(() => undefined);
await sideways('independence');
await page.screenshot({ path: `${out}/offline2-independence.png`, fullPage: false });
await page.evaluate(() => (location.hash = 'brief'));
await page.waitForFunction(() => /^This week \d+ per cent of what you asked stayed on your phone, (?:up|down) from 48\.$/.test(document.querySelector('#pg-brief .brindep')?.textContent ?? ''), null, { timeout: 10000 }).catch(async () => problems.push(`[5] the Brief's line reads "${await page.locator('#pg-brief .brindep').textContent().catch(() => '')}"`));
await sideways('brief');

// 6. SOVEREIGN MODE with no brain to answer: the refusal line, and the marker goes nowhere
await page.evaluate(() => (location.hash = 'settings'));
await openPanel(page, 'settings', 'OFFLINE');
await pn.locator('select[aria-label="Offline brain mode"]').selectOption('always');
await page.evaluate(() => (window.__ghostyOfflineEngine.ready = false));
const quiet = sent.length;
const MARK = 'hello ZORBLAX-7741';
await say(MARK);
await page.waitForFunction(() => /I can't do this on the phone right now: my offline brain isn't on this phone yet .*Nothing of it left the phone\./.test([...document.querySelectorAll('.msg.err')].at(-1)?.textContent ?? ''), null, { timeout: 10000 }).catch(() => problems.push('[6] no refusal line in Sovereign mode'));
await page.waitForTimeout(1500);
const leaked = sent.slice(quiet).filter((r) => r.body.includes('ZORBLAX'));
check(6, !leaked.length, `the marker left the phone: ${leaked.map((r) => r.path).join(', ')}`);
await page.evaluate(() => (location.hash = 'system'));
await openSection(page, 'system', 'Report card');
await openPanel(page, 'system', 'INDEPENDENCE');
check(6, /SOVEREIGN MODE · ON/.test(((await sheet.textContent().catch(() => '')) ?? '')), 'the sheet does not show Sovereign mode on');
await sideways('sovereign');
await page.screenshot({ path: `${out}/offline2-sovereign.png` });

await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'Offline2 run clean: a trusted greeting answered first on the phone with ASK THE CLOUD (struck, a miss, counted as the cloud’s), rewording at 70% to the cloud, TRUST and WHICH BRAIN, the INDEPENDENCE sheet with its sparkline, the Brief’s line, and Sovereign mode’s refusal with the marker kept on the phone.');
process.exit(problems.length ? 1 : 0);
