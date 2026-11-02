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
//  7. a phone-first answer never holds a turn (the owner, 2 Nov: "he literally isn't responding, just thinking for so long",
//     ten spoken asks in a row with no reply). The stand-in says whether its model is in memory and how slow it is:
//     a. NOT in memory: it is never loaded inside the turn — the cloud answers at once, no card, the phone's brain is not
//        asked, a load is started in the background, and the next ask is then answered first on the phone;
//     b. in memory but giving no first word: ended after 5 s — the phone's brain was asked and the generation aborted, the
//        cloud's reply arrives within about 10 s, the "On this phone · first" card is gone, and the meter counts the ask as
//        the cloud's, never the phone's;
//     c. a newer message while it is still thinking ends it first (not after its 5 s), and both asks are answered; a stop
//        in words ends it for good, the cloud is not asked for it, and the screen is not left thinking;
//     d. a task kept on the phone (Always) is not given this budget: it is the phone's alone and waits for its model.
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
    // In memory when the page opens, as after an earlier answer: a phone-first ask goes first only on a model that is, so the
    // steps below that need it cold or slow say so (offline/brain.ts modelWarm reads `loaded`; one that says nothing counts as in)
    loaded: true,
    calls: [],
    // the calls whose generation was ended before it gave a word (the 5 s limit, a newer message or a stop), with the time
    aborted: [],
    loads: 0,
    unloads: 0,
    idleMs: 500,
    // milliseconds before the first word (0: as before); and how long a load takes (the model comes into memory when it ends)
    firstDelay: 0,
    loadMs: 0,
    async load() {
      this.loads++;
      if (this.loadMs) await new Promise((r) => setTimeout(r, this.loadMs));
      this.loaded = true;
    },
    unload() {
      this.unloads++;
      this.loaded = false;
    },
    async chat(messages, onToken, signal) {
      const call = this.calls.push(messages.at(-1)?.content ?? '') - 1;
      if (this.firstDelay) {
        const ended = await new Promise((resolve) => {
          const t = setTimeout(() => resolve(false), this.firstDelay);
          signal?.addEventListener('abort', () => (clearTimeout(t), resolve(true)), { once: true });
        });
        if (ended) {
          this.aborted.push({ call, at: Date.now() });
          return;
        }
      }
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
// (the phone's stores save 200 ms after a change (core/store.ts); on the smoke loop's used brain the cloud answered inside that
// window and this read came first (CI, 1 Nov: "the miss: []" twice), so the saved miss is waited for, briefly)
await page.waitForFunction(() => (JSON.parse(localStorage.getItem('ghosty.trust') ?? '{}').misses ?? []).length > 0, null, { timeout: 3000 }).catch(() => undefined);
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

// 7. a phone-first answer never holds a turn hostage (the owner, 2 Nov: ten spoken asks in a row, no reply). The stand-in says
// whether its model is in memory and how slow it is; the cloud is the preview brain ("Mock reply to: …").
// (Each ask below carries a tag of this run's own. The preview brain keeps every earlier run's conversation and the log shows only
// its last 40 entries, so counting the entries on screen means nothing here: an ask's entries are found by its words, and by what
// follows its own message in the log.)
await page.evaluate(() => {
  window.__ghosty.settings.set({ offlineBrain: 'auto' });
  window.__ghostyOfflineEngine.ready = true;
});
const RUN = Date.now().toString(36).slice(-5);
const tagged = (words) => `${words} ${RUN}`;
const setEngine = (p) => page.evaluate((x) => Object.assign(window.__ghostyOfflineEngine, x), p);
const engineNow = () => page.evaluate(() => {
  const e = window.__ghostyOfflineEngine;
  return { calls: e.calls.length, aborted: e.aborted.length, loads: e.loads, loaded: e.loaded };
});
const meterNow = async () => {
  const d = await today();
  return { phone: d.n?.phone ?? 0, cloud: d.n?.cloud ?? 0, greetN: d.g?.greet?.n ?? 0, greetO: d.g?.greet?.o ?? 0 };
};
/** The meter once the cloud's answer to a greeting is in it (the phone's stores save 200 ms after a change). */
const meterAfter = async (was) => {
  await page.waitForFunction((n) => {
    const d = new Date();
    const p = (x) => String(x).padStart(2, '0');
    const t = (JSON.parse(localStorage.getItem('ghosty.independence') ?? '{}').days ?? []).find((x) => x.d === `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
    return (t?.g?.greet?.n ?? 0) > n;
  }, was.greetN, { timeout: 4000 }).catch(() => undefined);
  return meterNow();
};
/** Milliseconds from `t0` until the cloud's reply to `words` is on screen (-1: it never came). */
const cloudSaid = async (words, t0, ms = 15000) => {
  const ok = await page.waitForFunction((w) => [...document.querySelectorAll('.msg')].some((m) => !m.classList.contains('me') && !m.classList.contains('off') && (m.textContent ?? '').includes(`Mock reply to: ${w}`)), words, { timeout: ms }).then(() => true, () => false);
  return ok ? Date.now() - t0 : -1;
};
/** What follows, in the log, the ask whose own message holds `words`: the classes of its entries (null: the ask is not on screen). */
const classesAfter = (words) => page.evaluate((w) => {
  const all = [...document.querySelectorAll('.msg')];
  const i = all.findLastIndex((m) => m.classList.contains('me') && (m.textContent ?? '').includes(w));
  return i < 0 ? null : all.slice(i + 1).map((m) => m.className);
}, words);
const noCardsAfter = async (words, what) => {
  const after = await classesAfter(words);
  check(what, after !== null && !after.some((c) => /\bfirst\b/.test(c)), after === null ? 'the ask is not in the log' : 'an "On this phone · first" card is still in the log for an ask the cloud answered');
};
/** An answer on the phone follows the ask whose message holds `words`: an "On this phone · first" card (`first`), or a kept task's offline card. */
const phoneAnswerAfter = (words, first, ms = 10000) => page.waitForFunction(([w, f]) => {
  const all = [...document.querySelectorAll('.msg')];
  const i = all.findLastIndex((m) => m.classList.contains('me') && (m.textContent ?? '').includes(w));
  return i >= 0 && all.slice(i + 1).some((m) => m.classList.contains('off') && m.classList.contains('first') === f && /phone\./.test(m.textContent ?? ''));
}, [words, first], { timeout: ms }).then(() => true, () => false);

// a. the model is NOT in memory (the page has just opened, or it was idle two minutes): never loaded inside the turn
await setEngine({ loaded: false, loadMs: 800, firstDelay: 0 });
{
  const cold = tagged('hello cold');
  const e0 = await engineNow();
  const m0 = await meterNow();
  const t0 = Date.now();
  await say(cold);
  const took = await cloudSaid(cold, t0);
  check('7a', took >= 0 && took < 10000, `the cloud's reply to an ask on a model not in memory took ${took} ms (-1: never)`);
  const e1 = await engineNow();
  check('7a', e1.calls === e0.calls, `the phone's brain was asked on a model that was not in memory (${e1.calls - e0.calls} calls)`);
  await noCardsAfter(cold, '7a');
  await page.waitForFunction((n) => window.__ghostyOfflineEngine.loads > n, e0.loads, { timeout: 4000 }).catch(() => problems.push('[7a] no load was started in the background'));
  const m1 = await meterAfter(m0);
  check('7a', m1.greetN === m0.greetN + 1 && m1.greetO === m0.greetO && m1.phone === m0.phone && m1.cloud === m0.cloud + 1, `the meter did not count it as the cloud's: ${JSON.stringify(m0)} → ${JSON.stringify(m1)}`);
  // the load ends in the background, and the next ask is the one that goes first
  await page.waitForFunction(() => window.__ghostyOfflineEngine.loaded === true, null, { timeout: 5000 }).catch(() => problems.push('[7a] the background load did not finish'));
  const warm = tagged('hello warm');
  await say(warm);
  if (!(await phoneAnswerAfter(warm, true))) problems.push('[7a] after the load, the next ask was not answered first on the phone');
  check('7a', (await engineNow()).calls === e0.calls + 1, `the phone's brain was asked ${(await engineNow()).calls - e0.calls} times for the one ask it could take`);
  await page.screenshot({ path: `${out}/offline2-cold.png` });
}

// b. in memory, but no first word: ended after 5 s, the cloud answers within about 10, the card goes, the meter is the cloud's
await setEngine({ loaded: true, loadMs: 0, firstDelay: 60000 });
{
  const slow = tagged('hello slow');
  const e0 = await engineNow();
  const m0 = await meterNow();
  const t0 = Date.now();
  await say(slow);
  await page.waitForFunction((n) => window.__ghostyOfflineEngine.calls.length > n, e0.calls, { timeout: 5000 }).catch(() => problems.push('[7b] the phone’s brain was not asked'));
  const took = await cloudSaid(slow, t0);
  check('7b', took >= 4500 && took < 10000, `the cloud's reply came after ${took} ms (a first word is waited for 5 s; the reply is due within about 10; -1: never)`);
  const e1 = await engineNow();
  check('7b', e1.calls === e0.calls + 1 && e1.aborted === e0.aborted + 1, `the attempt was not made and ended once: ${JSON.stringify(e0)} → ${JSON.stringify(e1)}`);
  await noCardsAfter(slow, '7b');
  const m1 = await meterAfter(m0);
  check('7b', m1.greetN === m0.greetN + 1 && m1.greetO === m0.greetO && m1.phone === m0.phone && m1.cloud === m0.cloud + 1, `the meter counted an ended attempt as the phone's: ${JSON.stringify(m0)} → ${JSON.stringify(m1)}`);
  await sideways('ended attempt');
}

// c. a newer message while it is still thinking ends that attempt first (not at its own 5 s); a stop in words ends it for good
await setEngine({ loaded: true, firstDelay: 60000 });
{
  const first = tagged('hello first');
  const second = tagged('hello second');
  const third = tagged('hello third');
  const e0 = await engineNow();
  await say(first);
  await page.waitForFunction((n) => window.__ghostyOfflineEngine.calls.length > n, e0.calls, { timeout: 5000 }).catch(() => problems.push('[7c] the first ask did not reach the phone’s brain'));
  await page.waitForTimeout(1000);
  const t0 = Date.now();
  await say(second);
  const ended = await page.waitForFunction((n) => window.__ghostyOfflineEngine.aborted.length > n, e0.aborted, { timeout: 4000 }).then(() => Date.now() - t0, () => -1);
  check('7c', ended >= 0 && ended < 3000, `the attempt was ended ${ended} ms after the newer message (its own limit is 5 s; -1: not ended)`);
  const one = await cloudSaid(first, t0, 12000);
  const two = await cloudSaid(second, t0, 12000);
  check('7c', one >= 0 && one < 10000 && two >= 0 && two < 10000, `both asks are due an answer within about 10 s of the newer message: first ${one} ms, second ${two} ms (-1: never)`);
  await noCardsAfter(first, '7c');
  // (the newer ask may find the phone's brain free again and be tried there too: then it is ended at its own 5 s; both are the cloud's)
  // a stop in words: ended at once; the cloud is not asked for it; the screen is not left thinking
  // (the stand-in's model leaves memory 500 ms after it was last used, as an idle phone's does: warm it again)
  await setEngine({ loaded: true });
  const e1 = await engineNow();
  const sent0 = sent.length;
  await say(third);
  await page.waitForFunction((n) => window.__ghostyOfflineEngine.calls.length > n, e1.calls, { timeout: 5000 }).catch(() => problems.push('[7c] the third ask did not reach the phone’s brain'));
  await page.waitForTimeout(800);
  await say('stop');
  await page.waitForFunction((n) => window.__ghostyOfflineEngine.aborted.length > n, e1.aborted, { timeout: 3000 }).catch(() => problems.push('[7c] a stop did not end the phone’s attempt'));
  await page.waitForFunction(() => !window.__ghosty.ui.get().busy, null, { timeout: 3000 }).catch(() => problems.push('[7c] after a stop the screen is still thinking'));
  await page.waitForTimeout(6500); // longer than its own limit, which would have sent the ask to the cloud
  check('7c', !sent.slice(sent0).some((r) => r.path === '/api/chat' && r.body.includes(third)), 'an ask the owner said stop to went to the cloud');
  check('7c', (await cloudSaid(third, Date.now(), 300)) === -1, 'an ask the owner said stop to was answered');
}

// d. a task kept on the phone ("Always") is not given this budget: it is the phone's alone; it loads its model inside the turn and waits for it
await page.evaluate(() => window.__ghosty.settings.set({ offlineBrain: 'always' }));
await setEngine({ loaded: false, loadMs: 600, firstDelay: 7000 });
{
  const kept = tagged('hello kept ZORBLAX-7742');
  const e0 = await engineNow();
  const sent0 = sent.length;
  const t0 = Date.now();
  await say(kept);
  const done = await phoneAnswerAfter(kept, false, 25000);
  const took = done ? Date.now() - t0 : -1;
  check('7d', took >= 7000, `a task kept on the phone was answered after ${took} ms: it was given up at the 5 s that only a phone-first answer gets (-1: never)`);
  const e1 = await engineNow();
  check('7d', e1.calls === e0.calls + 1 && e1.aborted === e0.aborted && e1.loads > e0.loads, `the kept task: ${JSON.stringify(e0)} → ${JSON.stringify(e1)}`);
  check('7d', !sent.slice(sent0).some((r) => r.body.includes('ZORBLAX-7742')), 'a task kept on the phone left it');
}
await setEngine({ loaded: true, loadMs: 0, firstDelay: 0 });
await page.evaluate(() => window.__ghosty.settings.set({ offlineBrain: 'auto' }));

await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'Offline2 run clean: a trusted greeting answered first on the phone with ASK THE CLOUD (struck, a miss, counted as the cloud’s), rewording at 70% to the cloud, TRUST and WHICH BRAIN, the INDEPENDENCE sheet with its sparkline, the Brief’s line, Sovereign mode’s refusal with the marker kept on the phone, and a phone-first answer that never holds a turn: a model not in memory is warmed and the cloud answers at once, one with no first word in 5 s is ended and counted as the cloud’s, a newer message or a stop ends it first, and a task kept on the phone is left its own time.');
process.exit(problems.length ? 1 : 0);
