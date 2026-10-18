// THINK HARDER and the offline brain's REPORT CARD (apps/web/src/offline/think.ts, harder.ts, bench.ts;
// features/system/reportcard.ts). No WebGPU here, so a test engine stands in for the model on the phone
// (window.__ghostyOfflineEngine, as in offlinebrain.spec.mjs): it gets 17 × 23 wrong twice, then right.
// Checked: the latest answer has a THINK HARDER button; pressing it shows live progress in plain words, never
// asks the cloud brain, and answers with how sure it is (the calculator's exact check picks 391 over two
// 381s); "think harder: …" typed in the chat does the same (three agreeing attempts stop it early); STOP keeps
// the best so far; the attempts reach the model at different temperatures; ASK THE BIG BRAIN is a separate
// step that does ask the brain (even in "always"); without the download it says so. SYSTEM → REPORT CARD:
// RUN CHECK scores the five kinds as in chat and with THINK HARDER, with times and a verdict; a second check
// draws the graph; STOP keeps a partial run out of the graph; a new model shows as NEW MODEL. No sideways
// scrolling on a phone.
//   node tests/thinkharder.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const problems = [];

const engine = () => {
  const SUMS = { '17 × 23': '391', '(18 + 7) × 4': '100', '903 − 476': '427', '144 ÷ 12 + 7': '19' };
  window.__ghostyOfflineEngine = {
    ready: true,
    calls: [],
    delay: 40,
    idleMs: 60000,
    load() {},
    unload() {},
    async chat(messages, onToken, signal, opts) {
      this.calls.push({ messages, opts: opts ?? null });
      await new Promise((resolve) => {
        const t = setTimeout(resolve, this.delay);
        signal?.addEventListener('abort', () => (clearTimeout(t), resolve()), { once: true });
      });
      const q = messages.at(-1).content;
      const sys = messages[0].content;
      let said;
      if (/Proposed answer:/.test(q)) said = 'YES';
      else if (/^What is 17 × 23\?$|17 × 23\?$/.test(q.trim()) && /ANSWER: <the answer only>/.test(sys)) {
        const n = this.calls.filter((c) => /17 × 23/.test(c.messages.at(-1).content)).length;
        said = n < 3 ? 'Seventeen twenty-threes…\nANSWER: 381' : '17 × 20 = 340, 17 × 3 = 51, 340 + 51 = 391\nANSWER: 391';
      } else if (/91 prime/.test(q)) said = '91 = 7 × 13.\nANSWER: No';
      else if (/meaning of life/.test(q)) said = `ANSWER: ${this.calls.length}`; // never agrees: runs until stopped
      else if (/Write only the next step/.test(q)) said = 'Do the multiplication first.';
      else if (/Continue from these steps/.test(q)) said = 'ANSWER: 14';
      else if (/^What is (.+)\?$/.test(q) && SUMS[q.match(/^What is (.+)\?$/)[1]]) said = `ANSWER: ${SUMS[q.match(/^What is (.+)\?$/)[1]]}`;
      else if (/capital of Japan/.test(q)) said = 'ANSWER: Tokyo';
      else if (/set_timer\(/.test(q)) said = '{"tool": "set_timer", "args": {"minutes": 5}}';
      else if (/three words/.test(q)) said = /ANSWER:/.test(sys) ? 'ANSWER: BLUE SKY TODAY' : 'Sure: blue sky today';
      else said = /ANSWER: <the answer only>/.test(sys) ? 'ANSWER: 4' : 'Hello from your phone.';
      if (!signal?.aborted) onToken(said);
    },
  };
};

const noSideways = async (page, name, where) => {
  const o = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth - innerWidth, body: document.body.scrollWidth - innerWidth }));
  if (o.doc > 1 || o.body > 1) problems.push(`[${name}] ${where}: the page scrolls sideways (${o.doc}px / ${o.body}px)`);
};

async function run(name, viewport) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${name}] pageerror: ${e.message}`));
  await page.addInitScript(engine);
  let chats = 0;
  page.on('request', (r) => {
    if (new URL(r.url()).pathname === '/api/chat') chats++;
  });
  await page.goto(base);
  await page.fill('#pair input', 'preview-owner-key-0123456789');
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
  const narrow = viewport.width < 900;
  if (narrow) await page.click('.logbtn');

  // ---- the THINK HARDER button under the latest answer ----------------------------------------------------
  await page.fill('#cin', 'What is 17 × 23?');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.body.innerText.includes('Mock reply to: what is 17 × 23'), null, { timeout: 10000 }).catch(() => problems.push(`[${name}] the brain did not answer the question`));
  const btn = page.locator('.log .msg .thinkbtn');
  if ((await btn.count()) !== 1) problems.push(`[${name}] expected one THINK HARDER button (on the latest answer), found ${await btn.count()}`);
  const sent = chats;
  await page.evaluate(() => (window.__ghostyOfflineEngine.delay = 400));
  await btn.first().click();
  await page.waitForFunction(() => /trying 6 approaches… \d done/.test(document.querySelector('.log .msg.think .thinkline')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => problems.push(`[${name}] no live progress in plain words while thinking`));
  await page.screenshot({ path: `${out}/${name}-think-running.png` });
  await page.waitForFunction(() => document.querySelector('.log .msg.think .thinkans')?.textContent === '391', null, { timeout: 15000 }).catch(() => problems.push(`[${name}] THINK HARDER did not answer 391`));
  const conf = (await page.locator('.log .msg.think .thinkconf').last().textContent().catch(() => '')) ?? '';
  if (!/^checked exactly \(a calculator\) · 1 of 3 attempts passed · \d+ s$/.test(conf)) problems.push(`[${name}] the confidence line is "${conf}"`);
  if (!(await page.locator('.log .msg.think .thinkconf.checked').count())) problems.push(`[${name}] the checked answer is not marked as checked`);
  if (chats !== sent) problems.push(`[${name}] THINK HARDER asked the cloud brain (${chats - sent} chat requests)`);
  if ((await page.locator('.log .msg.me span').last().textContent()) !== 'Think harder: What is 17 × 23?') problems.push(`[${name}] the log does not show the THINK HARDER question`);
  const temps = await page.evaluate(() => [...new Set(window.__ghostyOfflineEngine.calls.filter((c) => /17 × 23/.test(c.messages.at(-1).content)).map((c) => c.opts?.temperature))]);
  if (temps.length < 3 || temps.some((t) => typeof t !== 'number')) problems.push(`[${name}] the attempts did not reach the model at different temperatures: ${JSON.stringify(temps)}`);
  if ((await page.locator('.log .msg.think details.thinkwork').count()) < 1) problems.push(`[${name}] the working is not offered`);
  if ((await page.locator('.log .msg.think').last().locator('.thinkbtn').count()) !== 0) problems.push(`[${name}] a THINK HARDER answer offers THINK HARDER again`);
  await page.locator('.log .msg.think').last().scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/${name}-think-done.png` });
  if (narrow) await noSideways(page, name, 'chat with a THINK HARDER answer');

  // ---- ASK THE BIG BRAIN: a separate step that does ask the brain ------------------------------------------
  const big = page.locator('.log .msg.think .bigbrain').last();
  if (!(await big.count())) problems.push(`[${name}] no ASK THE BIG BRAIN button`);
  else {
    const before = chats;
    await big.click();
    await page.waitForFunction(() => document.querySelectorAll('.log .msg').length && [...document.querySelectorAll('.log .msg')].filter((m) => m.textContent.includes('Mock reply to: what is 17 × 23')).length >= 2, null, { timeout: 10000 }).catch(() => problems.push(`[${name}] ASK THE BIG BRAIN got no answer from the brain`));
    if (chats !== before + 1) problems.push(`[${name}] ASK THE BIG BRAIN sent ${chats - before} chat requests`);
  }

  // ---- "think harder: …" typed in the chat; three that agree stop it early -----------------------------------
  await page.evaluate(() => (window.__ghostyOfflineEngine.delay = 30));
  const sent2 = chats;
  const n0 = await page.evaluate(() => window.__ghostyOfflineEngine.calls.length);
  await page.fill('#cin', 'think harder: is 91 prime?');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => /^3 of 3 attempts agree/.test([...document.querySelectorAll('.log .msg.think .thinkconf')].at(-1)?.textContent ?? ''), null, { timeout: 10000 }).catch(async () => problems.push(`[${name}] "think harder: …" did not end with three agreeing: ${await page.locator('.log .msg.think .thinkconf').last().textContent().catch(() => '')}`));
  if ((await page.locator('.log .msg.think .thinkans').last().textContent()) !== 'No') problems.push(`[${name}] the answer to "is 91 prime" is not "No"`);
  if ((await page.evaluate(() => window.__ghostyOfflineEngine.calls.length)) - n0 !== 3) problems.push(`[${name}] it did not stop early after three agreeing attempts`);
  if (chats !== sent2) problems.push(`[${name}] "think harder: …" asked the cloud brain`);

  // ---- STOP keeps the best so far ----------------------------------------------------------------------------
  await page.evaluate(() => (window.__ghostyOfflineEngine.delay = 1500));
  await page.fill('#cin', 'think harder: what is the meaning of life');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => /1 done/.test([...document.querySelectorAll('.log .msg.think .thinkline')].at(-1)?.textContent ?? ''), null, { timeout: 8000 }).catch(async () => {
    problems.push(`[${name}] the long think never got going: ${(await page.locator('.log').textContent()).slice(-400)}`);
    await page.screenshot({ path: `${out}/${name}-think-stuck.png` });
  });
  await page.locator('.log .msg.think button:has-text("STOP")').last().click({ timeout: 8000 });
  await page.waitForFunction(() => /^(?:only 1 attempt: not enough to compare|[1-5] of [1-5] attempts agree.*) \(stopped early by you: best so far\) · \d+ s$/.test([...document.querySelectorAll('.log .msg.think .thinkconf')].at(-1)?.textContent ?? ''), null, { timeout: 5000 }).catch(async () => problems.push(`[${name}] STOP did not keep the best so far: "${await page.locator('.log .msg.think .thinkconf').last().textContent().catch(() => '')}"`));
  if ((await page.locator('.log .msg.think .thinkline').count()) !== 0) problems.push(`[${name}] a THINK HARDER answer still shows as running after STOP`);

  // ---- not downloaded: it says so, and nothing is asked --------------------------------------------------------
  await page.evaluate(() => {
    window.__ghostyOfflineEngine.ready = false;
    window.__ghostyOfflineEngine.delay = 20;
  });
  const n1 = await page.evaluate(() => window.__ghostyOfflineEngine.calls.length);
  await page.fill('#cin', 'think harder');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => [...document.querySelectorAll('.log .msg.err')].some((m) => /isn't downloaded yet[\s\S]*DOWNLOAD/.test(m.textContent ?? '')), null, { timeout: 5000 }).catch(() => problems.push(`[${name}] without the download, THINK HARDER did not say to DOWNLOAD it`));
  if ((await page.evaluate(() => window.__ghostyOfflineEngine.calls.length)) !== n1) problems.push(`[${name}] without the download the model was still asked`);
  await page.evaluate(() => (window.__ghostyOfflineEngine.ready = true));

  // ---- "always": ASK THE BIG BRAIN still asks the brain (the owner asked) ------------------------------------
  if (narrow) await page.click('.logbtn');
  await page.evaluate(() => (location.hash = 'settings'));
  await page.locator('select[aria-label="Offline brain mode"]').selectOption('always');
  // THINK HARDER's time is an owner setting.
  const tsel = page.locator('select[aria-label="Think harder time"]');
  if (!(await tsel.count())) problems.push(`[${name}] no THINK HARDER time setting`);
  else if ((await tsel.inputValue()) !== '55') problems.push(`[${name}] THINK HARDER's time is not a minute by default`);
  await page.evaluate(() => (location.hash = 'core'));
  if (narrow) await page.click('.logbtn');
  const before3 = chats;
  await page.locator('.log .msg.think .bigbrain').first().click();
  await page.waitForTimeout(1500);
  if (chats !== before3 + 1) problems.push(`[${name}] in "always", ASK THE BIG BRAIN did not ask the brain (${chats - before3} requests)`);
  if (narrow) await page.click('.logbtn');

  // ---- SYSTEM → OFFLINE BRAIN REPORT CARD ------------------------------------------------------------------------
  await page.evaluate(() => (window.__ghostyOfflineEngine.delay = 2));
  await page.evaluate(() => (location.hash = 'system'));
  const pn = page.locator('#pg-system .pn.reportcard');
  await pn.waitFor({ state: 'attached', timeout: 10000 }).catch(() => problems.push(`[${name}] no REPORT CARD panel in SYSTEM`));
  const status = () => pn.locator('h3').textContent();
  await page.waitForFunction(() => /NOT RUN/.test(document.querySelector('#pg-system .pn.reportcard h3')?.textContent ?? ''), null, { timeout: 8000 }).catch(async () => problems.push(`[${name}] the report card does not say NOT RUN: ${await status()}`));
  await pn.locator('button:has-text("RUN CHECK")').click();
  await page.waitForFunction(() => /CHECKED/.test(document.querySelector('#pg-system .pn.reportcard h3')?.textContent ?? ''), null, { timeout: 90000 }).catch(async () => problems.push(`[${name}] RUN CHECK did not finish: ${await status()}`));
  const rows = await pn.locator('.rcrow:not(.rchd):not(.rctot) .rccat').allTextContents();
  if (rows.join('|') !== 'SUMS|LOGIC PUZZLES|FACTS|INSTRUCTIONS|TOOL CALLS') problems.push(`[${name}] the report card's kinds are ${rows.join('|')}`);
  const sums = await pn.locator('.rcrow.c-arithmetic').textContent();
  if (!/SUMS4\/44\/4/.test(sums?.replace(/\s/g, '') ?? '')) problems.push(`[${name}] sums are not 4/4 both ways: ${sums}`);
  const ins = (await pn.locator('.rcrow.c-instructions').textContent())?.replace(/\s/g, '') ?? '';
  if (!/^INSTRUCTIONS0\/41\/4/.test(ins)) problems.push(`[${name}] instructions: ${ins}`);
  const sum = (await pn.locator('.rcsum').textContent().catch(() => '')) ?? '';
  if (!/^Good at sums\./.test(sum) || !/Don't trust it for/.test(sum)) problems.push(`[${name}] the verdict reads: ${sum}`);
  if (!/Last checked .* on this phone/.test((await pn.locator('.rchead').textContent()) ?? '')) problems.push(`[${name}] no "last checked" line`);
  if ((await pn.locator('.rcgraph').count()) !== 0) problems.push(`[${name}] a graph after only one check`);
  await pn.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/${name}-reportcard.png` });
  // A second check (the quick one): the graph appears.
  await pn.locator('button:has-text("QUICK CHECK")').click();
  await page.waitForFunction(() => document.querySelector('#pg-system .pn.reportcard .rcgraph'), null, { timeout: 60000 }).catch(() => problems.push(`[${name}] no graph after two checks`));
  const dots = await pn.locator('.rcgraph circle.plain').count();
  if (dots !== 2) problems.push(`[${name}] the graph has ${dots} points (as in chat), not 2`);
  // STOP part-way: kept, but not graphed.
  await page.evaluate(() => (window.__ghostyOfflineEngine.delay = 300));
  await pn.locator('button:has-text("RUN CHECK")').click();
  await page.waitForFunction(() => /CHECKING/.test(document.querySelector('#pg-system .pn.reportcard h3')?.textContent ?? ''), null, { timeout: 5000 }).catch(() => problems.push(`[${name}] the report card did not say CHECKING`));
  await page.waitForFunction(() => /asking/.test(document.querySelector('#pg-system .pn.reportcard .rcline')?.textContent ?? ''), null, { timeout: 5000 }).catch(() => problems.push(`[${name}] no progress line while checking`));
  await page.screenshot({ path: `${out}/${name}-reportcard-running.png` });
  await pn.locator('button:has-text("STOP")').click();
  await page.waitForFunction(() => !/CHECKING/.test(document.querySelector('#pg-system .pn.reportcard h3')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => problems.push(`[${name}] STOP did not stop the report card`));
  await page.waitForTimeout(500);
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.reportcard') ?? '{}').history ?? []);
  if (kept.length !== 3 || kept.at(-1).complete !== false) problems.push(`[${name}] the stopped check was not kept as partial: ${kept.map((r) => r.complete).join(',')}`);
  if ((await pn.locator('.rcgraph circle.plain').count()) !== 2) problems.push(`[${name}] a stopped check went into the graph`);
  if (!/stopped early/.test((await pn.locator('.rchead').textContent()) ?? '')) problems.push(`[${name}] the head does not say the last check stopped early`);
  if (narrow) await noSideways(page, name, 'SYSTEM with the report card');
  const pw = await pn.evaluate((el) => el.scrollWidth - el.clientWidth);
  if (pw > 1) problems.push(`[${name}] the report card is ${pw}px wider than its panel`);

  // A new model (Stage 2's weekly one) since the last check: NEW MODEL.
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('ghosty.reportcard') ?? '{}');
    localStorage.setItem('ghosty.reportcard', JSON.stringify({ ...s, checked: 'Qwen3-0.6B-q4f16_1-MLC@0000000' }));
  });
  await page.reload();
  await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 }).catch(() => undefined);
  await page.evaluate(() => (location.hash = 'system'));
  await page.waitForFunction(() => /NEW MODEL/.test(document.querySelector('#pg-system .pn.reportcard h3')?.textContent ?? ''), null, { timeout: 8000 }).catch(async () => problems.push(`[${name}] a new model does not show as NEW MODEL: ${await status()}`));
  await ctx.close();
}

for (const [name, viewport] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
  await run(name, viewport).catch((e) => problems.push(`[${name}] stopped: ${String(e?.message ?? e).split('\n').slice(0, 12).join(' / ')}`));
}
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'THINK HARDER and the report card run clean: progress, exact check, early stop, STOP, big brain, report card, graph, new model.');
process.exit(problems.length ? 1 : 0);
