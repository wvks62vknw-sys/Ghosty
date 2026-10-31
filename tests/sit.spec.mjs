// Sitting a SCHOOL paper on the phone's brain without closing Ghosty (OWNER-ISSUES 57c), in a real browser at
// 440 × 956, on the stand-in for the offline brain (window.__ghostyOfflineEngine, as in school.spec.mjs):
//  A. heavy mode: while a paper is sat the GYM's training pauses and Mind (Home's WebGL hero) draws still frames;
//     when the paper is in, both carry on by themselves; the one line says which brain is sitting it.
//  B. the page is reloaded mid-paper (as when iOS closes Ghosty): it opens on SCHOOL, on the same paper at the same
//     question, with the one line; CARRY ON picks up at that question (the answers before it were saved one by one).
//  C. the brain itself fails mid-paper (WebGPU lost its device): it stops there, says so plainly (never the browser's
//     words), asks nothing more of the broken model, and CARRY ON picks up at that question.
//  D. the brain in use is a bigger one (Qwen3.5 2B): the paper is sat on the smallest brain on this phone and his choice
//     stays his; SIT ON QWEN3.5 2B is his explicit choice for school, and then it is sat on the 2B.
// Nothing scrolls sideways and every button is at least 44 px tall.
//   BASE=http://localhost:8788 node tests/sit.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { mkdirSync } from 'node:fs';
import { PHONE, UK, openSection } from './nav.mjs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const problems = [];
const SMALL = 'Qwen3-0.6B-q4f16_1-MLC';
const BIG = 'Qwen3.5-2B-q4f16_1-MLC';

/**
 * The phone's model, stood in for: a short wait, then an answer in the exam's format. `failAt`: that call (counted
 * from the first) fails as a lost WebGPU device does; `holdAt`: that call waits until `release()` (or a reload), so the
 * checks made mid-paper never race the paper. `big`: the brain in use is the 2B, with the 0.6B also on the phone.
 */
const engine = (big) => {
  window.__ghostyHero = true; // Mind draws (automated checks otherwise get the 2-D reactor: mind.ts)
  if (big && !sessionStorage.getItem('sit-big')) {
    sessionStorage.setItem('sit-big', '1');
    localStorage.setItem('ghosty.offlinebrain', JSON.stringify({ model: 'Qwen3.5-2B-q4f16_1-MLC', downloaded: true, have: ['Qwen3-0.6B-q4f16_1-MLC', 'Qwen3.5-2B-q4f16_1-MLC'], guarded: true }));
    // (no WebGPU here: the 2B's limits are not checked, so his choice of it loads as on a phone that can hold it)
    Object.defineProperty(Navigator.prototype, 'gpu', { get: () => undefined, configurable: true });
  }
  window.__ghostyOfflineEngine = {
    ready: true,
    calls: [],
    loads: [],
    unloads: 0,
    delay: 400,
    failAt: 0,
    holdAt: 0,
    release: () => undefined,
    idleMs: 60000,
    load(model) {
      this.loads.push(model ?? '');
    },
    unload() {
      this.unloads++;
    },
    async chat(messages, onToken, signal, opts) {
      this.calls.push({ q: messages.at(-1).content, max: opts?.max ?? null });
      if (this.failAt && this.calls.length === this.failAt) throw new Error('Device was lost. This can happen due to insufficient memory or other GPU constraints. Detailed error: [object GPUDeviceLostInfo].');
      if (this.holdAt && this.calls.length === this.holdAt) await new Promise((resolve) => ((this.release = resolve), signal?.addEventListener('abort', () => resolve(), { once: true })));
      await new Promise((resolve) => {
        const t = setTimeout(resolve, this.delay);
        signal?.addEventListener('abort', () => (clearTimeout(t), resolve()), { once: true });
      });
      const q = messages.at(-1).content;
      const said = /\nA\) /.test(q) ? 'Answer: A' : /How many|What number|comes (after|before)|bigger/.test(q) ? 'Answer: 5' : 'Answer: cat';
      if (!signal?.aborted) onToken(said);
    },
  };
};

const until = (page, fn, ms, what, arg = null) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => (problems.push(what), false));
const sec = async (page, label) => {
  await page.waitForSelector('#pg-school .secpills .secpill', { state: 'visible', timeout: 10000 }).catch(() => undefined);
  return openSection(page, 'school', label);
};
const smallTargets = async (page, where) => {
  const small = await page.evaluate(() => [...document.querySelectorAll('#pg-school button')].filter((b) => b.offsetParent && b.getBoundingClientRect().height < 43.5).map((b) => `${b.textContent.trim().slice(0, 30)} (${Math.round(b.getBoundingClientRect().height)}px)`));
  if (small.length) problems.push(`${where}: buttons under 44 px: ${small.join(', ')}`);
  const o = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (o > 1) problems.push(`${where}: the page scrolls sideways (${o}px)`);
};
const toasts = (page) => page.$$eval('#toasts .toast', (t) => t.map((x) => x.textContent ?? ''));
/** SIT on the subject in this row of THIS STAGE (its SIT; FREE GPU is beside it). */
const sitRow = async (page, k) => {
  await sec(page, 'This stage');
  await page.locator('#pg-school .schsub').nth(k).locator('.schsubbtns button').first().click();
};
const sat = (page) => page.evaluate(() => ({ ...window.__ghosty?.school, reading: undefined }));
const school = (page) => page.evaluate(() => (location.hash = 'school'));

async function signIn(big = false) {
  const ctx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2, ...UK });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
  await page.addInitScript(engine, big);
  await page.goto(base);
  await page.fill('#pair input', 'preview-owner-key-0123456789');
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
  return { ctx, page };
}

// ---- A. heavy mode: the GYM pauses and Mind goes still while he sits; both carry on after ----------------------------
{
  const { ctx, page } = await signIn();
  await page.evaluate(() => (location.hash = 'gym'));
  await until(page, () => (window.__ghosty?.gym?.cards ?? 0) > 0, 15000, '[heavy] the GYM did not open');
  if (await page.locator('#log.open, .log.open').count().catch(() => 0)) await page.click('.logbtn').catch(() => undefined);
  await page.locator('#pg-gym .gymcard[data-game="tictactoe"]').click();
  await until(page, () => window.__ghosty?.gym?.open === 'tictactoe', 5000, '[heavy] tic-tac-toe did not open');
  await page.locator('#pg-gym button.gymtrain').click();
  const training = await until(page, () => window.__ghosty?.gym?.training === 'tictactoe', 8000, '[heavy] TRAIN did not start training');

  await school(page);
  await until(page, () => document.querySelectorAll('#pg-school .schsub').length >= 4, 15000, '[heavy] SCHOOL did not show the stage');
  await sec(page, 'This stage');
  await until(page, () => /^I sit papers on Qwen3 0\.6B\.$/.test(document.querySelector('#pg-school .schbrain .note')?.textContent ?? ''), 8000, `[heavy] no line saying which brain sits the papers: "${await page.locator('#pg-school .schbrain').textContent().catch(() => '')}"`);
  // (the 2nd question waits for release(): everything below is checked while the paper is really being sat)
  await page.evaluate(() => (window.__ghostyOfflineEngine.holdAt = 2));
  await sitRow(page, 2);
  await until(page, () => window.__ghostyOfflineEngine.calls.length === 2, 15000, '[heavy] the paper did not start');
  const during = await page.evaluate(() => ({ gym: window.__ghosty.gym.training, log: window.__ghosty.gym.log.slice(-4), brain: document.querySelector('#pg-school .schlive .schbrain')?.textContent ?? '' }));
  if (training && during.gym !== '') problems.push(`[heavy] the GYM kept training while he sat the paper: ${JSON.stringify(during)}`);
  if (!during.log.some((l) => /heavy/.test(l))) problems.push(`[heavy] the GYM never heard of heavy mode: ${JSON.stringify(during.log)}`);
  if (during.brain !== "I'm sitting it on Qwen3 0.6B.") problems.push(`[heavy] while sitting, the brain line is "${during.brain}"`);
  await smallTargets(page, '[heavy] sitting');
  await page.locator('#pg-school .schlive').scrollIntoViewIfNeeded().catch(() => undefined);
  await page.screenshot({ path: `${out}/sit-heavy.png` });
  // Home while the paper is sat: Mind runs no loop (one still frame per change)
  await page.evaluate(() => (location.hash = 'core'));
  const mind = await until(page, () => window.__ghosty?.hero?.mode === 'mind' && (window.__ghosty.hero.frames ?? 0) > 0, 30000, `[heavy] Mind did not start on Home (WebGL): ${JSON.stringify(await page.evaluate(() => window.__ghosty?.hero ?? null))}`);
  if (mind) await until(page, () => window.__ghosty.hero.loop === false, 5000, '[heavy] Mind kept its frame loop while he sat the paper');
  if (!(await page.evaluate(() => window.__ghosty.school.sitting))) problems.push('[heavy] the paper finished before Home was checked (the check proves nothing)');
  // the paper is in: the GYM trains again and Mind loops again, by themselves
  await page.evaluate(() => window.__ghostyOfflineEngine.release());
  await until(page, () => window.__ghosty?.school?.sitting === false, 90000, '[heavy] the paper was never handed in');
  if (training) await until(page, () => window.__ghosty.gym.training === 'tictactoe', 8000, `[heavy] the GYM did not carry on training after the paper: ${JSON.stringify(await page.evaluate(() => window.__ghosty.gym.log.slice(-4)))}`);
  if (mind) await until(page, () => window.__ghosty.hero.loop === true, 8000, '[heavy] Mind did not go back to its loop after the paper');
  await ctx.close();
}

// ---- B. reloaded mid-paper: SCHOOL opens on the same paper at the same question; CARRY ON picks up there -------------
// ---- C. the brain fails mid-paper: it stops there, plainly, and CARRY ON picks up there -------------------------------
{
  const { ctx, page } = await signIn();
  await school(page);
  await until(page, () => document.querySelectorAll('#pg-school .schsub').length >= 4, 15000, '[reload] SCHOOL did not show the stage');
  // (question 3 waits: the reload comes while it is being answered, with questions 1 and 2 answered and saved)
  await page.evaluate(() => (window.__ghostyOfflineEngine.holdAt = 3));
  await sitRow(page, 3);
  const at3 = await until(page, () => window.__ghostyOfflineEngine.calls.length === 3 && /^Question 3 of \d+$/.test(document.querySelector('#pg-school .schliveh b')?.textContent ?? ''), 30000, '[reload] the paper never reached question 3');
  const before = await page.evaluate(() => window.__ghostyOfflineEngine.calls.map((c) => c.q));
  const of = Number((await page.locator('#pg-school .schliveh b').textContent().catch(() => '')).split(' of ')[1]) || 0;
  // (as on the phone, he may be on Home when iOS closes it)
  await page.evaluate(() => (location.hash = 'core'));
  await page.reload();
  await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 }).catch(() => problems.push('[reload] Ghosty did not open again'));
  await until(page, () => !!document.querySelector('#pg-school .schresume') && !!window.__ghosty?.school, 30000, `[reload] SCHOOL did not open on the paper with CARRY ON (on "${await page.evaluate(() => location.hash)}")`);
  const re = await sat(page);
  const want = new RegExp(`^Ghosty closed while I sat .+, at question 3 of ${of}\\. My answers before it are kept\\. CARRY ON picks up there, on Qwen3 0\\.6B\\.$`);
  if (!at3 || before.length !== 3) problems.push(`[reload] it was reloaded at the wrong moment: ${before.length} questions asked`);
  if (!want.test(re.resume ?? '')) problems.push(`[reload] the one line is "${re.resume}"`);
  if ((await page.evaluate(() => location.hash)) !== '#school') problems.push('[reload] it did not open on SCHOOL');
  const shown = await page.locator('#pg-school .schresume').isVisible().catch(() => false);
  if (!shown || !want.test((await page.locator('#pg-school .schresume .schliveh b').textContent().catch(() => '')) ?? '')) problems.push('[reload] the line is not on screen');
  if (re.sitting) problems.push('[reload] it started sitting again by itself (never a blind retry)');
  if ((await page.evaluate(() => window.__ghostyOfflineEngine.calls.length)) !== 0) problems.push('[reload] the model was asked before CARRY ON');
  await smallTargets(page, '[reload] CARRY ON');
  await page.locator('#pg-school .schresume').scrollIntoViewIfNeeded().catch(() => undefined);
  await page.screenshot({ path: `${out}/sit-carry-on.png` });
  await page.locator('#pg-school .schresume button', { hasText: 'CARRY ON' }).click();
  await until(page, () => window.__ghostyOfflineEngine.calls.length >= 1, 15000, '[reload] CARRY ON did not ask the model');
  const first = await page.evaluate(() => window.__ghostyOfflineEngine.calls[0]?.q);
  if (first !== before[2]) problems.push(`[reload] CARRY ON did not pick up at question 3: asked "${first?.slice(0, 80)}", question 3 is "${before[2]?.slice(0, 80)}"`);
  if ((await page.evaluate(() => window.__ghostyOfflineEngine.calls.map((c) => c.q))).some((q) => q === before[0] || q === before[1])) problems.push('[reload] questions 1 and 2 were asked again (their answers were not kept)');
  await until(page, () => window.__ghosty?.school?.sitting === false && !!window.__ghosty.school.last, 60000, '[reload] the paper was not handed in after CARRY ON');
  if ((await sat(page)).resume) problems.push('[reload] the offer stayed after the paper was handed in');

  // C: the 2nd question of the next paper fails as a lost device
  await page.evaluate(() => {
    const e = window.__ghostyOfflineEngine;
    e.delay = 300;
    e.calls = [];
    e.unloads = 0;
    e.failAt = 2;
  });
  await sitRow(page, 0);
  await until(page, () => !!window.__ghosty?.school?.resume, 20000, '[lost] the failed brain was not offered again');
  const lost = await sat(page);
  const calls = await page.evaluate(() => window.__ghostyOfflineEngine.calls.map((c) => c.q));
  const wantLost = /^My brain on this phone gave out while I sat .+, at question 2 of \d+ \(most likely the phone ran short of memory\)\. My answers before it are kept\. CARRY ON picks up there, on Qwen3 0\.6B\.$/;
  const toldLost = 'My brain on this phone gave out mid-paper (most likely short of memory). My answers are kept: CARRY ON in SCHOOL picks up where it stopped.';
  if (!wantLost.test(lost.resume ?? '')) problems.push(`[lost] the one line is "${lost.resume}"`);
  if (calls.length !== 2) problems.push(`[lost] the broken model was asked ${calls.length - 2} more question(s) after it failed (a blank answer each)`);
  if ((await page.evaluate(() => window.__ghostyOfflineEngine.unloads)) < 1) problems.push('[lost] the broken model was not let go');
  if (lost.sitting) problems.push('[lost] it is still sitting');
  const said = await toasts(page);
  if (said.some((t) => /Device was lost|GPUDeviceLostInfo|undefined|\[object/.test(t))) problems.push(`[lost] the browser's words reached him: ${JSON.stringify(said)}`);
  if (!said.some((t) => t.trim() === toldLost)) problems.push(`[lost] he was not told: ${JSON.stringify(said)}`);
  if (!wantLost.test((await page.locator('#pg-school .schresume .schliveh b').textContent().catch(() => '')) ?? '')) problems.push('[lost] the offer is not on screen');
  await page.locator('#pg-school .schresume').scrollIntoViewIfNeeded().catch(() => undefined);
  await page.screenshot({ path: `${out}/sit-brain-lost.png` });
  await page.evaluate(() => (window.__ghostyOfflineEngine.failAt = 0));
  await page.locator('#pg-school .schresume button', { hasText: 'CARRY ON' }).click();
  await until(page, () => window.__ghostyOfflineEngine.calls.length >= 3, 15000, '[lost] CARRY ON did not ask the model');
  const again = await page.evaluate(() => window.__ghostyOfflineEngine.calls[2]?.q);
  if (again !== calls[1]) problems.push(`[lost] CARRY ON did not pick up at question 2: "${again?.slice(0, 80)}"`);
  await until(page, () => window.__ghosty?.school?.sitting === false && !window.__ghosty.school.resume, 60000, '[lost] the paper was not handed in after CARRY ON');
  await ctx.close();
}

// ---- D. a bigger brain in use: the paper is sat on the smallest here, unless he chooses the bigger one for school ------
{
  const { ctx, page } = await signIn(true);
  await school(page);
  await until(page, () => document.querySelectorAll('#pg-school .schsub').length >= 4, 15000, '[bigger] SCHOOL did not show the stage');
  await sec(page, 'This stage');
  const lineSmall = 'I sit papers on Qwen3 0.6B, the smallest brain on this phone: a paper is long work.';
  await until(page, (w) => document.querySelector('#pg-school .schbrain .note')?.textContent === w, 8000, `[bigger] the brain line is "${await page.locator('#pg-school .schbrain .note').textContent().catch(() => '')}"`, lineSmall);
  const choose = page.locator('#pg-school .schbrain button');
  if ((await choose.count()) !== 1 || !/^Sit on Qwen3\.5 2B$/.test((await choose.getAttribute('data-label').catch(() => '')) ?? '')) problems.push(`[bigger] no choice of the 2B for school: ${await choose.allTextContents()}`);
  await smallTargets(page, '[bigger] the brain line');
  await page.locator('#pg-school .schbrain').scrollIntoViewIfNeeded().catch(() => undefined);
  await page.screenshot({ path: `${out}/sit-smallest.png` });
  await sitRow(page, 1);
  await until(page, () => /^Question \d+ of \d+$/.test(document.querySelector('#pg-school .schliveh b')?.textContent ?? ''), 15000, '[bigger] the paper did not start');
  const live = (await page.locator('#pg-school .schlive .schbrain').textContent().catch(() => '')) ?? '';
  if (live !== "I'm sitting it on Qwen3 0.6B, the smallest brain on this phone: a paper is long work.") problems.push(`[bigger] while sitting, the brain line is "${live}"`);
  await until(page, () => window.__ghosty?.school?.sitting === false, 60000, '[bigger] the paper was not handed in');
  let loads = await page.evaluate(() => window.__ghostyOfflineEngine.loads);
  if (!loads.includes(SMALL) || loads.includes(BIG)) problems.push(`[bigger] not sat on the smallest brain: loaded ${JSON.stringify(loads)}`);
  await page.waitForTimeout(400);
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.offlinebrain') ?? '{}').model);
  if (kept !== BIG) problems.push(`[bigger] the brain in use changed under him: ${kept}`);
  // his explicit choice: the 2B sits it
  await sec(page, 'This stage');
  await page.locator('#pg-school .schbrain button').click();
  await until(page, () => document.querySelector('#pg-school .schbrain .note')?.textContent === 'I sit papers on Qwen3.5 2B, as you chose: my written answers are kept shorter on it.', 8000, `[bigger] choosing the 2B did not say so: "${await page.locator('#pg-school .schbrain .note').textContent().catch(() => '')}"`);
  if (!/^Sit on the smallest$/.test((await page.locator('#pg-school .schbrain button').getAttribute('data-label').catch(() => '')) ?? '')) problems.push('[bigger] no way back to the smallest');
  await page.evaluate(() => (window.__ghostyOfflineEngine.loads = []));
  await sitRow(page, 2);
  await until(page, () => window.__ghosty?.school?.sitting === true, 15000, '[bigger] the paper on the 2B did not start');
  await until(page, () => window.__ghosty?.school?.sitting === false, 60000, '[bigger] the paper on the 2B was not handed in');
  loads = await page.evaluate(() => window.__ghostyOfflineEngine.loads);
  if (loads.at(-1) !== BIG) problems.push(`[bigger] his choice of the 2B was not used: loaded ${JSON.stringify(loads)}`);
  await ctx.close();
}

await browser.close();
if (problems.length) {
  console.error(`SIT: ${problems.length} problem(s)\n - ${problems.join('\n - ')}`);
  process.exit(1);
}
console.log(`SIT: run clean · screenshots in ${out}`);
