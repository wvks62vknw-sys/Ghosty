// SCHOOL in a real browser at 440 × 956 (the iPhone 18 Pro Max): the tab opens from the systems deck; the ladder
// shows Nursery as "now" and every other stage locked; SIT runs a paper on a stand-in for the offline brain (the
// test engine at window.__ghostyOfflineEngine, as in thinkharder.spec.mjs) with "Question x of y" while it works,
// the exam prompt and the choices A–D reaching the model, and the result card with a grade when the brain has
// marked it; RESULTS opens the paper with every question, his answer and the marks; the placement picker lists
// every stage; without the download it says so and offers DOWNLOAD IT IN SETTINGS. Nothing scrolls sideways and
// every button is at least 44 px tall.
//   BASE=http://localhost:8803 node tests/school.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { mkdirSync } from 'node:fs';
import { openDeck } from './nav.mjs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const problems = [];
const STAGES = ['nursery', 'reception', 'ks1', 'ks2', 'ks3', 'gcse', 'alevel', 'university', 'library'];

/** The phone's model, stood in for: a short wait, then an answer in the exam's format (always the first choice). */
const engine = (ready) => {
  window.__ghostyOfflineEngine = {
    ready,
    calls: [],
    delay: 400,
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
      const said = /\nA\) /.test(q) ? 'I think it is the first one.\nAnswer: A' : /How many|What number|comes (after|before)|bigger/.test(q) ? 'Answer: 5' : 'Answer: cat';
      if (!signal?.aborted) onToken(said);
    },
  };
};

const noSideways = async (page, where) => {
  const o = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth - innerWidth, body: document.body.scrollWidth - innerWidth }));
  if (o.doc > 1 || o.body > 1) problems.push(`${where}: the page scrolls sideways (${o.doc}px / ${o.body}px)`);
};
const smallTargets = async (page, where) => {
  const small = await page.evaluate(() => [...document.querySelectorAll('#pg-school button')].filter((b) => b.offsetParent && b.getBoundingClientRect().height < 43.5).map((b) => `${b.textContent.trim().slice(0, 30)} (${Math.round(b.getBoundingClientRect().height)}px)`));
  if (small.length) problems.push(`${where}: buttons under 44 px: ${small.join(', ')}`);
};

async function signIn(ready) {
  const ctx = await browser.newContext({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
  await page.addInitScript(engine, ready);
  await page.goto(base);
  await page.fill('#pair input', 'preview-owner-key-0123456789');
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
  return { ctx, page };
}

// ---- the tab from the deck: the ladder, nursery now, the rest locked ---------------------------------------------
const { ctx, page } = await signIn(true);
await openDeck(page);
await page.waitForSelector('#deck.on', { timeout: 3000 }).catch(() => problems.push('the systems deck did not open'));
if (!(await page.locator('#deck .dtile[data-id="school"]').count())) problems.push('SCHOOL is not in the systems deck');
await page.click('#deck .dtile[data-id="school"]');
await page.waitForFunction(() => document.querySelectorAll('#pg-school .schrung').length === 9, null, { timeout: 15000 }).catch(() => problems.push('the ladder did not show nine stages'));
const rungs = await page.$$eval('#pg-school .schrung', (r) => r.map((x) => ({ cls: x.className, name: x.querySelector('.schname b')?.textContent, state: x.querySelector('.schstate')?.textContent })));
if (!/s-now/.test(rungs[0]?.cls ?? '') || rungs[0]?.name !== 'Nursery' || !/^now$/i.test(rungs[0]?.state ?? '')) problems.push(`Nursery is not "now": ${JSON.stringify(rungs[0])}`);
if (rungs.slice(1).some((r) => !/s-locked/.test(r.cls) || !/^locked$/i.test(r.state ?? ''))) problems.push(`stages after nursery are not all locked: ${JSON.stringify(rungs.slice(1))}`);
if ((await page.locator('#pg-school .schrung.s-locked .schmark.lock svg').count()) !== 8) problems.push('the locked stages have no lock');
const navTitle = (await page.locator('#top .navtitle').textContent().catch(() => '')) ?? '';
const tag = (await page.locator('#pg-school .hero .tag').textContent().catch(() => '')) ?? '';
if (navTitle !== 'School' && tag !== 'SCHOOL') problems.push(`no "School" title (nav "${navTitle}", tag "${tag}")`);
const subs = await page.$$eval('#pg-school .schsub .schsubname b', (n) => n.map((x) => x.textContent));
if (subs.join('|') !== 'Talking and listening|Letters and sounds|Numbers|The world around us') problems.push(`nursery subjects: ${subs.join(', ')}`);
// (A preview brain that has run this spec before already holds papers: the empty states are checked on a fresh one.)
const before = (await page.evaluate(() => window.__ghosty?.school?.results)) ?? 0;
if (!before && !/Nothing sat yet/.test(await page.locator('#pg-school .schresults').textContent())) problems.push('RESULTS does not say nothing was sat yet');
if (!before && !/Weak spots show after his first papers/.test(await page.locator('#pg-school .schweak').textContent())) problems.push('WEAK SPOTS does not explain itself before any paper');
if (!/marked by the code[\s\S]*stronger model against the mark scheme/.test(await page.locator('#pg-school .schset').textContent())) problems.push('no honest note on how marking works');
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/school-start.png` });
await page.screenshot({ path: `${out}/school-start-full.png`, fullPage: true });
await noSideways(page, 'the SCHOOL tab');
await smallTargets(page, 'the SCHOOL tab');

// ---- SIT one subject on the stand-in model: "Question x of y", then the result card with a grade -------------------
await page.locator('#pg-school .schsub').nth(2).locator('button').click(); // Numbers
await page.waitForFunction(() => /^Question \d+ of \d+$/.test(document.querySelector('#pg-school .schliveh b')?.textContent ?? ''), null, { timeout: 15000 }).catch(async () => problems.push(`no "Question x of y" while he sits it: "${await page.locator('#pg-school .schliveh b').textContent().catch(() => '')}"`));
if (!(await page.locator('#pg-school .schbtns button.warn:not([hidden])').count())) problems.push('no STOP while he sits');
await smallTargets(page, 'sitting');
await page.locator('#pg-school .schlive').scrollIntoViewIfNeeded().catch(() => undefined);
await page.screenshot({ path: `${out}/school-sitting.png` });
await page.waitForFunction(() => { const b = document.querySelector('#pg-school .schresult .schgrade b'); return !!b && b.textContent !== '…' && b.textContent.length > 0; }, null, { timeout: 30000 }).catch(() => problems.push('the result card did not appear with a grade'));
const grade = (await page.locator('#pg-school .schresult .schgrade b').textContent().catch(() => '')) ?? '';
if (!/^(Top band|Secure|Expected|Working towards)$/.test(grade)) problems.push(`the result card's grade is "${grade}"`);
await page.locator('#pg-school .schresult').scrollIntoViewIfNeeded().catch(() => undefined);
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/school-result.png` });
const calls = await page.evaluate(() => window.__ghostyOfflineEngine.calls.map((c) => ({ sys: c.messages[0].content, q: c.messages.at(-1).content, max: c.opts?.max })));
if (!calls.length) problems.push('the offline brain was never asked');
if (calls.some((c) => !/^You are sitting an exam\. Answer the question\. Finish with 'Answer: <your answer>'/.test(c.sys))) problems.push(`not the exam prompt: ${calls[0]?.sys}`);
if (calls.some((c) => !(c.max <= 350))) problems.push(`a question's token budget is over 350: ${JSON.stringify(calls.map((c) => c.max))}`);
if (calls.some((c) => /\nA\) /.test(c.q)) && !calls.filter((c) => /\nA\) /.test(c.q)).every((c) => /\nB\) [\s\S]*\nC\) [\s\S]*\nD\) /.test(c.q))) problems.push('multiple choice without the four choices A–D');
const st = await page.evaluate(() => window.__ghosty?.school);
if (st?.results !== before + 1) problems.push(`the result is not in the record: ${JSON.stringify(st)}`);
await noSideways(page, 'the result');

// ---- RESULTS: the paper with every question, his answer and the marks -----------------------------------------
await page.locator('#pg-school .schresults button.schrow').first().click();
await page.waitForFunction(() => document.querySelectorAll('.modal .schq').length >= 8, null, { timeout: 10000 }).catch(() => problems.push('the paper did not open with its questions'));
const paperText = (await page.locator('.modal').textContent().catch(() => '')) ?? '';
if (!/HIS ANSWER/.test(paperText) || !/RIGHT ANSWER/.test(paperText) || !/Written by Ghosty in the same style/.test(paperText) || !/marked exactly by the code/.test(paperText)) problems.push(`the paper view is missing parts: ${paperText.slice(0, 300)}`);
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/school-paper.png` });
await noSideways(page, 'the paper');
await page.keyboard.press('Escape');
await page.locator('.modal .mhead button').click().catch(() => undefined);
await page.waitForTimeout(300);

// ---- the placement picker lists every stage -------------------------------------------------------------------------
await page.locator('#pg-school .schplace button', { hasText: /placement test/i }).click();
await page.waitForFunction(() => document.querySelectorAll('#pg-school .schpick button').length === 9, null, { timeout: 5000 }).catch(() => problems.push('the placement picker does not list nine stages'));
const picks = await page.$$eval('#pg-school .schpick button', (b) => b.map((x) => ({ id: x.dataset.stage, off: x.disabled })));
if (picks.map((p) => p.id).join(',') !== STAGES.join(',')) problems.push(`placement stages: ${picks.map((p) => p.id).join(', ')}`);
if (picks.slice(0, 4).some((p) => p.off) || picks.slice(4).some((p) => !p.off)) problems.push(`placement: nursery to Key Stage 2 can be sat, the rest have no papers yet: ${JSON.stringify(picks)}`);
await page.locator('#pg-school .schpick button[data-stage="ks2"]').click();
const goText = (await page.locator('#pg-school .schgo').textContent().catch(() => '')) ?? '';
if (!/If he gets top grades, that stage and everything below it is done at once/.test(goText)) problems.push(`the placement does not say what it does: ${goText}`);
await page.locator('#pg-school .schplace').scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/school-placement.png` });
await noSideways(page, 'the placement picker');
await smallTargets(page, 'the placement picker');
await ctx.close();

// ---- not downloaded: it says so and offers DOWNLOAD IT IN SETTINGS ----------------------------------------------
{
  const { ctx, page } = await signIn(false);
  await page.evaluate(() => (location.hash = 'school'));
  await page.waitForFunction(() => document.querySelectorAll('#pg-school .schrung').length === 9, null, { timeout: 15000 }).catch(() => problems.push('[not downloaded] the ladder did not show'));
  await page.waitForTimeout(500);
  const txt = await page.locator('#pg-school .schstage').textContent();
  if (!/isn't on this phone yet/.test(txt)) problems.push(`[not downloaded] no plain words about the download: ${txt.slice(0, 200)}`);
  if (!(await page.locator('#pg-school .schstage button', { hasText: 'DOWNLOAD IT IN SETTINGS' }).isVisible())) problems.push('[not downloaded] no DOWNLOAD IT IN SETTINGS');
  if (!(await page.locator('#pg-school .schstage button', { hasText: 'SIT THE EXAM' }).isDisabled())) problems.push('[not downloaded] SIT THE EXAM is not disabled');
  await page.locator('#pg-school .schstage').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/school-not-downloaded.png` });
  await ctx.close();
}

await browser.close();
if (problems.length) {
  console.error(`SCHOOL: ${problems.length} problem(s)\n - ${problems.join('\n - ')}`);
  process.exit(1);
}
console.log(`SCHOOL: all good · screenshots in ${out}`);
