// SCHOOL in a real browser at 440 × 956 (the iPhone 18 Pro Max): the tab opens from the systems deck; the ladder
// shows Nursery as "now" and every other stage locked; SIT runs a paper on a stand-in for the offline brain (the
// test engine at window.__ghostyOfflineEngine, as in thinkharder.spec.mjs) with "Question x of y" while it works,
// the exam prompt and the choices A–D reaching the model, and the result card with a grade when the brain has
// marked it; RESULTS opens the paper with every question, his answer and the marks; the placement picker lists
// every stage; without the download it says so and offers DOWNLOAD IT IN SETTINGS. Nothing scrolls sideways and
// every button is at least 44 px tall.
// Part 2: each subject says where its next paper comes from; OFFICIAL PAPERS lists the real papers with their
// source and licence, and FETCH reads one on the phone (the file is a stand-in PDF served here, never the real
// site) and the mock brain makes it into a paper ("Ready", the diagram question left out); WRITE THE PAPERS for
// Key Stage 3 writes its banks through the mock brain until the stage can be sat.
// Part 3: READING lists his stage's shelf with each book's source and licence; READ runs through the mock brain until
// the book is read (the preview brain fetches the small real Gutenberg text); the reading check is sat on the stand-in
// model with the book's words and its score kept; BORROW shows the rule and why a higher book cannot be borrowed yet.
//   BASE=http://localhost:8803 node tests/school.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { mkdirSync } from 'node:fs';

/** A one-page PDF with these lines of text (Helvetica), as an exam paper's stand-in. */
function makePdf(lines) {
  const esc = (t) => t.replace(/[\\()]/g, (c) => `\\${c}`);
  const content = `BT /F1 12 Tf 50 800 Td ${lines.map((l, i) => `${i ? '0 -20 Td ' : ''}(${esc(l)}) Tj`).join(' ')} ET`;
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>', `<< /Length ${content.length} >>\nstream\n${content}\nendstream`];
  let out = '%PDF-1.4\n';
  const offs = [];
  objs.forEach((o, i) => {
    offs.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const x = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
const GPS_QUESTIONS = makePdf(['KEY STAGE 2 ENGLISH GRAMMAR, PUNCTUATION AND SPELLING PAPER 1', '1 What is 12 + 30? [1 mark]', '2 What is 7 + 8? [1 mark]', '3 Use the diagram to find angle x [2 marks]', '4 Explain why 9 is not a prime number [2 marks]']);
const GPS_MARKS = makePdf(['MARK SCHEMES', '1 Answer: 42', '2 Answer: 15', '3 Answer: 40', '4 Answer: it has the factor 3']);
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

/** Stop here: what went wrong so far is reported, and the run fails. */
async function bail() {
  await browser.close();
  console.error(`SCHOOL: ${problems.length} problem(s)\n - ${problems.join('\n - ')}`);
  process.exit(1);
}

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
if (!(await page.locator('#deck .dtile[data-id="school"]').count())) {
  problems.push('SCHOOL is not in the systems deck');
  await bail();
}
await page.click('#deck .dtile[data-id="school"]');
if (!(await page.waitForFunction(() => document.querySelectorAll('#pg-school .schrung').length === 9, null, { timeout: 15000 }).then(() => true, () => false))) {
  problems.push('the ladder did not show nine stages');
  await bail();
}
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
const picks = await page.$$eval('#pg-school .schpick button', (b) => b.map((x) => ({ id: x.dataset.stage, off: x.disabled, papers: x.dataset.papers })));
if (picks.slice(0, 4).some((p) => p.papers !== 'true')) problems.push(`placement: nursery to Key Stage 2 have papers: ${JSON.stringify(picks)}`);
if (picks.map((p) => p.id).join(',') !== STAGES.join(',')) problems.push(`placement stages: ${picks.map((p) => p.id).join(', ')}`);
if (picks.slice(0, 8).some((p) => p.off) || !picks[8].off) problems.push(`placement: nursery to university can be picked (Key Stage 3 up to write their papers), the library cannot: ${JSON.stringify(picks)}`);
await page.locator('#pg-school .schpick button[data-stage="ks2"]').click();
const goText = (await page.locator('#pg-school .schgo').textContent().catch(() => '')) ?? '';
if (!/If he gets top grades, that stage and everything below it is done at once/.test(goText)) problems.push(`the placement does not say what it does: ${goText}`);
await page.locator('#pg-school .schplace').scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/school-placement.png` });
await noSideways(page, 'the placement picker');
await smallTargets(page, 'the placement picker');

// ---- each subject says where its paper comes from ----------------------------------------------------------------
const froms = await page.$$eval('#pg-school .schsub .schfrom', (n) => n.map((x) => x.textContent));
if (froms.length !== 4 || froms.some((f) => !/^Next paper: written by Ghosty$/.test(f))) problems.push(`the subjects do not say who writes their papers: ${JSON.stringify(froms)}`);

// ---- OFFICIAL PAPERS: the list with source and licence; FETCH reads one on the phone and the brain makes it a paper ----
await page.waitForFunction(() => document.querySelectorAll('#pg-school .schofficial .schoff').length >= 25, null, { timeout: 10000 }).catch(() => problems.push('OFFICIAL PAPERS does not list the official papers'));
const offs = await page.$$eval('#pg-school .schofficial .schoff', (n) => n.map((x) => ({ id: x.dataset.id, text: x.textContent })));
if (!offs.some((o) => o.id === 'ks2-2024-gps') || !offs.some((o) => o.id === 'gcse-aqa-8300-1h-2023') || !offs.some((o) => o.id === 'gcse-ocr-j277-01-2023') || !offs.some((o) => o.id === 'alevel-aqa-7357-1-2023')) problems.push(`official papers missing: ${offs.map((o) => o.id).join(', ')}`);
for (const o of offs) if (!/Source: /.test(o.text) || !/(Open Government Licence|copyright stays with)/.test(o.text) || !/never shared/.test(o.text)) problems.push(`${o.id}: no source or licence line`);
const groups = await page.$$eval('#pg-school .schofficial details.schoffgrp > summary', (n) => n.map((x) => x.textContent));
if (groups.length !== 3 || !/^Key Stage 2 SATs · 9 papers/.test(groups[0]) || !/^GCSE · 11 papers/.test(groups[1]) || !/^A-level · 9 papers/.test(groups[2])) problems.push(`official paper groups: ${JSON.stringify(groups)}`);
// The files: stand-ins served here (the spec never reaches the real sites).
const fileAsks = [];
await page.route('**/api/school/official/file?**', (route) => {
  const u = new URL(route.request().url());
  fileAsks.push(`${u.searchParams.get('id')}#${u.searchParams.get('part')}`);
  route.fulfill({ status: 200, contentType: 'application/pdf', body: u.searchParams.get('part') === '0' ? GPS_QUESTIONS : GPS_MARKS });
});
const gpsRow = page.locator('#pg-school .schoff[data-id="ks2-2024-gps"]');
if (!(await gpsRow.count())) problems.push('OFFICIAL PAPERS has no 2024 grammar paper to FETCH');
else if (!(await gpsRow.isVisible())) await page.locator('#pg-school .schofficial details.schoffgrp > summary').first().click({ timeout: 5000 }).catch(() => problems.push('the SATs group does not open'));
const alreadyFetched = (await gpsRow.count()) > 0 && !(await gpsRow.locator('button', { hasText: /^FETCH/ }).count());
if ((await gpsRow.count()) && !alreadyFetched) {
  await gpsRow.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/school-official.png` });
  await gpsRow.locator('button', { hasText: /^FETCH/ }).click();
  await page.waitForFunction(() => (window.__ghosty?.school?.official ?? []).find((o) => o.id === 'ks2-2024-gps')?.status === 'ready', null, { timeout: 30000 }).catch(async () => problems.push(`FETCH did not make the paper ready: ${JSON.stringify(await page.evaluate(() => (window.__ghosty?.school?.official ?? []).find((o) => o.id === 'ks2-2024-gps')))}`));
  if (fileAsks.join(',') !== 'ks2-2024-gps#0,ks2-2024-gps#1') problems.push(`the parts were not fetched through the brain in order: ${fileAsks.join(',')}`);
}
await page.waitForFunction(() => /^(Ready|Sat): 3 questions, 4 of the paper's 70 marks$/.test(document.querySelector('#pg-school .schoff[data-id="ks2-2024-gps"] .schoffline')?.textContent ?? ''), null, { timeout: 15000 }).catch(async () => problems.push(`the fetched paper's line: "${await gpsRow.locator('.schoffline').textContent().catch(() => '')}"`));
await gpsRow.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => undefined);
await page.waitForFunction(() => !document.querySelector('.toast'), null, { timeout: 8000 }).catch(() => undefined);
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/school-official-ready.png` });
await noSideways(page, 'OFFICIAL PAPERS');
await smallTargets(page, 'OFFICIAL PAPERS');
// Key Stage 2's grammar paper is official now (picked for a placement, it says so).
await page.locator('#pg-school .schpick button[data-stage="ks2"]').click().catch(() => undefined);
const ks2Go = (await page.locator('#pg-school .schgo').textContent().catch(() => '')) ?? '';
if (!/Grammar, punctuation and spelling — official/.test(ks2Go) && !alreadyFetched) problems.push(`Key Stage 2 grammar is not marked official: ${ks2Go}`);

// ---- WRITE THE PAPERS: Key Stage 3's banks written through the mock brain until the stage can be sat ---------------
await page.locator('#pg-school .schpick button[data-stage="ks3"]').click({ timeout: 5000 }).catch(() => problems.push('Key Stage 3 cannot be picked to write its papers'));
const ks3Ready = async () => (await page.locator('#pg-school .schpick button[data-stage="ks3"]').getAttribute('data-papers')) === 'true';
if (!(await ks3Ready())) {
  const writeBtn = page.locator('#pg-school .schgo button.schwrite');
  if (!/WRITE THE PAPERS/.test((await writeBtn.textContent().catch(() => '')) ?? '')) problems.push('Key Stage 3 without papers does not offer WRITE THE PAPERS');
  const why = (await page.locator('#pg-school .schgo .note').first().textContent().catch(() => '')) ?? '';
  if (!/no Key Stage 3 papers yet[\s\S]*second check/.test(why)) problems.push(`WRITE THE PAPERS does not say what it does: ${why}`);
  await writeBtn.click({ timeout: 5000 }).catch(() => undefined);
  await page.waitForFunction(() => (window.__ghosty?.school?.banks ?? []).some((b) => /^Writing the Key Stage 3 [\w ]+ bank · \d+ of \d+/.test(b.line)), null, { timeout: 15000 }).catch(() => problems.push('no honest progress line while the banks are written'));
  await page.waitForFunction(() => !document.querySelector('.toast'), null, { timeout: 8000 }).catch(() => undefined);
  await page.locator('#pg-school .schgo .schbanklines').evaluate((el) => el.scrollIntoView({ block: 'center' })).catch(() => undefined);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/school-writing.png` });
  if (problems.length) await bail();
  await page.waitForFunction(() => (window.__ghosty?.school?.stages ?? []).find((s) => s.id === 'ks3')?.papers === true, null, { timeout: 150000 }).catch(async () => problems.push(`Key Stage 3 never became sittable: ${JSON.stringify(await page.evaluate(() => window.__ghosty?.school?.banks))}`));
}
await page.waitForFunction(() => document.querySelector('#pg-school .schpick button[data-stage="ks3"]')?.dataset.papers === 'true', null, { timeout: 10000 }).catch(() => problems.push('the placement picker does not offer Key Stage 3 to sit'));
await page.locator('#pg-school .schpick button[data-stage="ks3"]').click().catch(() => undefined);
const ks3Go = (await page.locator('#pg-school .schgo').textContent().catch(() => '')) ?? '';
if (!/Key Stage 3: 6 papers/.test(ks3Go) || !(await page.locator('#pg-school .schgo button', { hasText: 'SIT KEY STAGE 3' }).count())) problems.push(`Key Stage 3 cannot be sat after its banks: ${ks3Go}`);
await page.locator('#pg-school .schplace').scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/school-ks3-ready.png` });
await noSideways(page, 'Key Stage 3 written');
await ctx.close();

// ---- READING (part 3): the shelf with source and licence, READ through the mock brain, the reading check, BORROW's rule ----
{
  const { ctx, page } = await signIn(true);
  await page.evaluate(() => (location.hash = 'school'));
  await page.waitForFunction(() => document.querySelectorAll('#pg-school .schreading .schbook').length >= 6, null, { timeout: 20000 }).catch(() => problems.push('READING does not list his shelf'));
  const rows = await page.$$eval('#pg-school .schreading .schbook', (n) => n.map((x) => ({ id: x.dataset.id, text: x.textContent })));
  const shelf = (await page.evaluate(() => window.__ghosty?.school?.reading?.shelf)) ?? [];
  if (!shelf.some((r) => r.id === 'pg-14838') || shelf.length < 6) problems.push(`READING: the nursery shelf: ${JSON.stringify(shelf)}`);
  for (const r of rows.filter((x) => shelf.some((s) => s.id === x.id))) if (!/Project Gutenberg #\d+ · Public domain in the UK: .* died .* before 1955/.test(r.text)) problems.push(`READING: ${r.id} has no source and licence line`);
  const readTxt = (await page.locator('#pg-school .schreading').textContent().catch(() => '')) ?? '';
  if (!/SIT THE READING CHECK/.test(readTxt) || !/80% passes/.test(readTxt)) problems.push('READING does not offer the reading check with its pass mark');
  await page.locator('#pg-school .schreading').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/school-reading.png` });
  await noSideways(page, 'READING');
  await smallTargets(page, 'READING');
  // READ: the brain imports the book through the library's importers, a part at a time, until it is read.
  const peter = page.locator('#pg-school .schreading .schbook[data-id="pg-14838"]');
  if ((await peter.locator('button', { hasText: /^(READ|CARRY ON READING)$/ }).count())) await peter.locator('button', { hasText: /^(READ|CARRY ON READING)$/ }).click();
  await page.waitForFunction(() => (window.__ghosty?.school?.reading?.shelf ?? []).find((r) => r.id === 'pg-14838')?.status === 'read', null, { timeout: 90000 }).catch(async () => problems.push(`READ did not finish The Tale of Peter Rabbit: ${await peter.textContent().catch(() => '')}`));
  await page.waitForFunction(() => /Read ✓/.test(document.querySelector('#pg-school .schreading .schbook[data-id="pg-14838"] .schbookst')?.textContent ?? ''), null, { timeout: 10000 }).catch(() => problems.push('a book he has read is not listed as read with the day'));
  // The reading check, sat on the stand-in model like a paper: "Question x of 10", then the score with the book.
  const jemima = page.locator('#pg-school .schreading .schbook[data-id="pg-14814"]');
  const before = (await page.evaluate(() => window.__ghostyOfflineEngine.calls.length)) ?? 0;
  if ((await jemima.locator('button', { hasText: 'SIT THE READING CHECK' }).count())) {
    await jemima.locator('button', { hasText: 'SIT THE READING CHECK' }).click();
    await page.waitForFunction(() => /^Question \d+ of 10$/.test(window.__ghosty?.school?.reading?.live ?? ''), null, { timeout: 60000 }).catch(async () => problems.push(`no "Question x of 10" while he sits the reading check: "${await page.evaluate(() => window.__ghosty?.school?.reading?.live)}"`));
    await page.locator('#pg-school .schreading .schcheck').evaluate((el) => el.scrollIntoView({ block: 'center' })).catch(() => undefined);
    await page.screenshot({ path: `${out}/school-reading-check.png` });
    await smallTargets(page, 'the reading check');
    await page.waitForFunction(() => /\d+\/10 \(\d+%\) — (passed|not passed) \(80% passes\)/.test(window.__ghosty?.school?.reading?.last ?? ''), null, { timeout: 60000 }).catch(async () => problems.push(`the reading check was not marked: "${await page.evaluate(() => window.__ghosty?.school?.reading?.last)}"`));
    const asked = await page.evaluate((n) => window.__ghostyOfflineEngine.calls.slice(n).map((c) => c.messages.at(-1).content), before);
    if (asked.length !== 10 || !asked.every((q) => /^Read this: "/.test(q))) problems.push(`the check's questions did not reach the model with the book's words: ${asked.length} asked`);
  }
  await page.waitForFunction(() => /^\d+\/10$/.test((window.__ghosty?.school?.reading?.shelf ?? []).find((r) => r.id === 'pg-14814')?.check ?? ''), null, { timeout: 15000 }).catch(() => problems.push('the check’s score is not kept with the book'));
  // BORROW: the rule in one line; without top grades in his reading, every higher book says why and cannot be borrowed.
  const rule = (await page.locator('#pg-school .schreading .schrule').textContent().catch(() => '')) ?? '';
  if (!/two stages above/.test(rule) || !/80%/.test(rule) || !/never count towards passing a stage/.test(rule)) problems.push(`BORROW's rule: "${rule}"`);
  const borrowLine = (await page.locator('#pg-school .schreading .schborrowline').textContent().catch(() => '')) ?? '';
  if (!/must be at top grades/.test(borrowLine)) problems.push(`BORROW does not say it is not earned yet: "${borrowLine}"`);
  const aheads = await page.$$eval('#pg-school .schreading details.schahead', (n) => n.map((x) => x.dataset.stage));
  if (aheads.join(',') !== 'reception,ks1') problems.push(`the higher shelves: ${aheads.join(',')}`);
  await page.locator('#pg-school .schreading details.schahead[data-stage="reception"] > summary').click();
  const bunny = page.locator('#pg-school .schreading details.schahead[data-stage="reception"] .schbook[data-id="pg-14407"]');
  if (!(await bunny.locator('button', { hasText: 'BORROW' }).isDisabled().catch(() => false))) problems.push('BORROW is open before it is earned');
  if (!/top grades/.test((await bunny.locator('.schborrowwhy').textContent().catch(() => '')) ?? '')) problems.push('a higher book does not say why it cannot be borrowed');
  const locks = (await page.locator('#pg-school .schreading .schlocks').textContent().catch(() => '')) ?? '';
  if (!/locked until GCSE/.test(locks)) problems.push(`WHAT IS LOCKED: "${locks}"`);
  await bunny.scrollIntoViewIfNeeded().catch(() => undefined);
  await page.waitForFunction(() => !document.querySelector('.toast'), null, { timeout: 8000 }).catch(() => undefined);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/school-reading-borrow.png` });
  await page.locator('#pg-school .schreading .schbook[data-id="pg-14814"]').scrollIntoViewIfNeeded().catch(() => undefined);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/school-reading-done.png` });
  await noSideways(page, 'READING after a check');
  await smallTargets(page, 'READING after a check');
  await ctx.close();
}

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
