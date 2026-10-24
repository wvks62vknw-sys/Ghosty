// MARK MY WORK at 440 × 956 (the iPhone 18 Pro Max), the brain mocked (the preview's scripted model marks written
// answers). Lens → READ reads a drawn page of maths answers on the phone; MARK opens MARK MY WORK with that text in an
// editable box and the plain warning that handwriting is hard for the phone to read; the owner corrects it, names the
// subject, and MARK IT marks every sum exactly (no model): marks per question, the total, the band only "as this marking
// scheme sees it" and never a real exam grade, a line for the miss; KEEP AS REVISION CARDS puts the miss in LEARN. Then a
// short-answer page with a mark scheme read from a second photo (and corrected): exact where it can, the model with the
// scheme where it cannot, the unanswered question said. BACK TO READ puts READ back. Nothing scrolls sideways, every
// button is at least 44 px tall and the security policy blocks nothing.
//   BASE=http://localhost:8889 node tests/mark.spec.mjs [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { PHONE, UK, openScreen } from './nav.mjs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const problems = [];
const ctx = await browser.newContext({
  viewport: PHONE,
  ...UK,
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  permissions: ['camera'],
});
const page = await ctx.newPage();
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' && !/favicon|net::ERR|404|Failed to load resource|^[WI]\d{4} |^INFO:/.test(t)) problems.push(`console: ${t.slice(0, 200)}`);
});
await page.addInitScript(() => {
  window.__csp = [];
  document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
});

const until = (fn, ms, what) => page.waitForFunction(fn, null, { timeout: ms }).then(() => true).catch(() => { problems.push(what); return false; });
const mark = () => page.evaluate(() => {
  const m = window.__ghosty?.lens?.mark;
  return m ? { open: m.open, status: m.status, error: m.error, kept: m.kept, result: m.result } : null;
});
const checks = async (where) => {
  const o = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth - innerWidth, body: document.body.scrollWidth - innerWidth }));
  if (o.doc > 1 || o.body > 1) problems.push(`${where}: the page scrolls sideways (${o.doc}px / ${o.body}px)`);
  const small = await page.evaluate(() => [...document.querySelectorAll('#pg-lens .markview button')].filter((b) => b.offsetParent && b.getBoundingClientRect().height < 43.5).map((b) => `${b.textContent.trim().slice(0, 30)} (${Math.round(b.getBoundingClientRect().height)}px)`));
  if (small.length) problems.push(`${where}: buttons under 44 px: ${small.join(', ')}`);
};
/** A page of answers drawn on white, as a photo's stand-in (big, dark, plain: what a clear photo of neat writing reads as). */
const drawn = (lines) => page.evaluate(async (lines) => {
  const c = document.createElement('canvas');
  c.width = 1400;
  c.height = 140 + lines.length * 110;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#111';
  g.font = '64px sans-serif';
  lines.forEach((l, i) => g.fillText(l, 60, 120 + i * 110));
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s);
}, lines);
const png = (b64, name) => ({ name, mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });

await page.goto(base);
await page.fill('#pair input', 'preview-owner-key-0123456789');
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });

// ---- Lens → READ: a photographed page of maths answers is read on the phone ----
await openScreen(page, 'lens');
await page.waitForSelector('#pg-lens', { state: 'visible', timeout: 15000 });
await page.evaluate(() => window.__ghosty.lens.setMode('read'));
await page.waitForTimeout(500);
await page.locator('#pg-lens input[type=file]').first().setInputFiles(png(await drawn(['1) 7 + 5 = 12', '2) 9 x 6 = 56', '3) 15 - 8 = 7', '4) 144 / 12 = 12']), 'maths.png'));
await until(() => /56/.test(window.__ghosty?.lens?.ocrText ?? ''), 180000, 'READ did not read the maths page');
const ocr = await page.evaluate(() => window.__ghosty.lens.ocrText);

// ---- MARK: the text read, editable, with the honest warning ----
await page.locator('#pg-lens button.markchip').click();
await page.waitForSelector('#pg-lens .markview', { timeout: 5000 }).catch(() => problems.push('MARK did not open MARK MY WORK'));
const warn = (await page.locator('#pg-lens .markwarn').textContent().catch(() => '')) ?? '';
if (!/Handwriting is hard for the phone to read: check every answer below and correct it before marking/.test(warn)) problems.push(`no honest OCR warning: "${warn}"`);
const pre = await page.inputValue('#pg-lens textarea.markans').catch(() => '');
if (pre.trim() !== ocr.trim()) problems.push(`the answers box does not hold what READ read: ${JSON.stringify(pre)} vs ${JSON.stringify(ocr)}`);
// the owner corrects what the phone misread (here: types the page as written), names the subject; GCSE is picked already
await page.fill('#pg-lens textarea.markans', '1) 7 + 5 = 12\n2) 9 x 6 = 56\n3) 15 - 8 = 7\n4) 144 / 12 = 12');
await page.fill('#pg-lens input.marksubj', 'maths');
if ((await page.locator('#pg-lens .marklevels button.on').getAttribute('data-label')) !== 'GCSE') problems.push('GCSE is not the level picked first');
const sent = page.waitForRequest((r) => r.url().endsWith('/api/school/markwork') && r.method() === 'POST', { timeout: 10000 }).catch(() => null);
await page.locator('#pg-lens .markview button', { hasText: 'MARK IT' }).click();
const req1 = await sent;
if (!req1) problems.push('MARK IT sent nothing to the brain');
else {
  const b = req1.postDataJSON();
  if (b.subject !== 'maths' || b.level !== 'gcse' || !/9 x 6 = 56/.test(b.answers)) problems.push(`MARK IT sent ${JSON.stringify(b)}`);
}
await until(() => window.__ghosty?.lens?.mark?.status === 'done' || window.__ghosty?.lens?.mark?.status === 'error', 30000, 'the maths page was never marked');
const m1 = await mark();
const r1 = m1?.result;
if (m1?.status !== 'done') problems.push(`marking the maths page failed: ${m1?.error}`);
else {
  if (`${r1.raw}/${r1.max}` !== '3/4') problems.push(`the maths page scored ${r1.raw}/${r1.max}, not 3/4`);
  if (r1.marks.map((m) => `${m.n}:${m.got}/${m.max}:${m.how}`).join(' ') !== '1:1/1:exact 2:0/1:exact 3:1/1:exact 4:1/1:exact') problems.push(`per-question marks: ${JSON.stringify(r1.marks)}`);
  if (r1.grade !== '8') problems.push(`the band is "${r1.grade}", not GCSE 8`);
  if (JSON.stringify(r1.wrong) !== JSON.stringify(['Q2: 9 x 6 is 54, not 56.'])) problems.push(`what was missed: ${JSON.stringify(r1.wrong)}`);
}
const shown = (await page.locator('#pg-lens .markresult').textContent().catch(() => '')) ?? '';
if (!/3 \/ 4/.test(shown)) problems.push('the total is not on screen');
if (!/As this marking scheme sees it: 8 on GCSE's bands \(3 of 4, 75%\)\. Not a real exam grade/.test(shown)) problems.push(`the honesty line is not on screen: ${shown.slice(0, 300)}`);
if (!/Q2.*0\/1.*✗ checked exactly/.test(shown) || !/9 x 6 is 54, not 56\./.test(shown)) problems.push('Q2\'s mark and what was missed are not on screen');
if (!/Not kept anywhere: this is your work, not a school record/.test(shown)) problems.push('the result does not say it is not a school record');
await page.locator('#pg-lens .markhead').evaluate((e) => e.scrollIntoView({ block: 'center' }));
await checks('the maths page marked');
await page.screenshot({ path: `${out}/mark-maths.png` });

// ---- KEEP AS REVISION CARDS: the miss goes to LEARN ----
const cardRes = page.waitForResponse((r) => r.url().endsWith('/api/learn/card'), { timeout: 10000 }).catch(() => null);
await page.locator('#pg-lens .markresult button', { hasText: 'KEEP AS REVISION CARDS (1)' }).click();
const cr = await cardRes;
if (!cr || cr.status() !== 200) problems.push(`the card was not kept: ${cr?.status()}`);
else {
  const card = (await cr.json()).card;
  if (!/^Maths · question 2\nYou wrote: 9 x 6 = 56/.test(card?.front ?? '') || !/Answer: 54/.test(card?.back ?? '')) problems.push(`the card: ${JSON.stringify(card)}`);
}
await until(() => window.__ghosty?.lens?.mark?.kept === 1, 10000, 'KEEP AS REVISION CARDS did not finish');
const learn = await page.evaluate(async () => (await fetch('/api/learn', { credentials: 'same-origin', headers: { 'x-ghosty': '1', 'x-ghosty-key': 'preview-owner-key-0123456789' } }).then((r) => r.json()).catch(() => null)));
if (!learn || JSON.stringify(learn).indexOf('Maths · question 2') < 0) problems.push(`LEARN does not hold the card: ${JSON.stringify(learn).slice(0, 200)}`);

// ---- a short-answer page: the mark scheme from a second photo (corrected), exact and model marking, an unanswered question ----
await page.fill('#pg-lens textarea.markans', '1. paris\n2. Plants make food from sunlight\n3. 1066');
await page.fill('#pg-lens input.marksubj', 'science');
await page.locator('#pg-lens .marklevels button', { hasText: 'KS3' }).click();
await page.locator('#pg-lens .markview + input[type=file], #pg-lens input[type=file][aria-label^="A photo of the questions"]').first().setInputFiles(png(await drawn(['1. Paris', '2. Light energy makes glucose', '3. 1066', '4. Mitochondria']), 'scheme.png'));
await until(() => /Paris/i.test(document.querySelector('#pg-lens textarea.markscheme')?.value ?? ''), 180000, 'READ A PHOTO OF IT did not read the mark scheme');
// he checks it against the sheet and puts the marks in
await page.fill('#pg-lens textarea.markscheme', '1. Paris [1]\n2. Photosynthesis: light energy makes glucose in the chlorophyll [2 marks]\n3. 1066 (1 mark)\n4. Mitochondria [1]');
await page.locator('#pg-lens .markview button', { hasText: 'MARK IT' }).click();
await page.waitForTimeout(300);
await until(() => window.__ghosty?.lens?.mark?.status === 'done' && window.__ghosty.lens.mark.result?.subject === 'science', 30000, 'the short-answer page was never marked');
const r2 = (await mark())?.result;
if (r2) {
  if (r2.marks.map((m) => `${m.n}:${m.got}/${m.max}:${m.how}`).join(' ') !== '1:1/1:exact 2:2/2:model 3:1/1:exact 4:0/1:unanswered') problems.push(`short answers: ${JSON.stringify(r2.marks)}`);
  if (`${r2.raw}/${r2.max}` !== '4/5' || r2.grade !== 'Secure') problems.push(`short answers scored ${r2.raw}/${r2.max} ${r2.grade}`);
  if (!r2.scheme || /No mark scheme/.test(r2.honest)) problems.push('the mark scheme was not used');
  if (JSON.stringify(r2.wrong) !== JSON.stringify(['Q4: No answer was written.'])) problems.push(`short answers missed: ${JSON.stringify(r2.wrong)}`);
}
const shown2 = (await page.locator('#pg-lens .markresult').textContent().catch(() => '')) ?? '';
if (!/marked by the model/.test(shown2) || !/not answered/.test(shown2) || !/As this marking scheme sees it: Secure on Key Stage 3's bands/.test(shown2)) problems.push(`the short-answer result on screen: ${shown2.slice(0, 300)}`);
await page.locator('#pg-lens .markhead').evaluate((e) => e.scrollIntoView({ block: 'center' }));
await checks('the short-answer page marked');
await page.screenshot({ path: `${out}/mark-short.png` });
await page.locator('#pg-lens .markview').evaluate((e) => e.scrollIntoView());
await page.screenshot({ path: `${out}/mark-form.png` });

// ---- BACK TO READ ----
await page.locator('#pg-lens .markview button', { hasText: 'BACK TO READ' }).click();
await page.waitForTimeout(300);
if (await page.locator('#pg-lens .markview').count()) problems.push('BACK TO READ left MARK on screen');
if (!(await page.locator('#pg-lens textarea.lensocr').first().isVisible())) problems.push('BACK TO READ did not bring READ back');

const csp = await page.evaluate(() => window.__csp);
if (csp.length) problems.push(`security policy blocked: ${csp.join(' | ')}`);
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'MARK MY WORK clean at 440 × 956: READ read a maths page, MARK showed it to correct with the handwriting warning, every sum was marked exactly (3/4, GCSE 8 "as this marking scheme sees it", not a real grade), Q2\'s miss said and kept as a LEARN card; a short-answer page with a scheme read from a second photo was marked exactly and by the model (4/5, the unanswered question said); BACK TO READ worked; nothing scrolled sideways and the security policy blocked nothing.');
process.exit(problems.length ? 1 : 0);
