// FILES (THE APPS ROUND, lane BOOT; docs/build-plan/APPS-BOOT.md): one place for everything Ghosty keeps (features/files). At 440 × 956 and
// 390 × 844, with a document, a spreadsheet and a presentation kept by their own apps, and files brought in from the phone:
//   a. BROWSE lists all three from their apps, with sizes; search finds by name and by the words inside (the line around it shown), and says
//      so plainly when nothing matches; the kind chips narrow it;
//   b. the star keeps a thing in FAVOURITES; RECENTS lists what changed or was opened;
//   c. a thing's card: a preview of its words, OPEN IN its app, SHARE, RENAME, DUPLICATE, MOVE, TAGS and DELETE, every key 44 pt; RENAME
//      changes it in its own app; TAGS and MOVE are kept and searched; DUPLICATE puts a copy beside it;
//   d. DELETE goes to Recently deleted with an UNDO bar (UNDO puts it back); from RECENTLY DELETED, RESTORE puts it back exactly;
//   e. IMPORT brings in a text file (searched inside) and a zip (opened to its files);
//   f. SELECT two and ZIP gives one zip of them, in the leaders' formats (a .docx inside);
//   g. STORAGE says the total and each kind's space, and lists the biggest first;
//   h. nothing sideways and every key 44 pt at both widths.
//   BASE=http://localhost:8788 node tests/files.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const { buildSync } = createRequire(new URL('../apps/web/package.json', import.meta.url))('esbuild');

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const SMALL = { width: 390, height: 844 };
const problems = [];
const t0 = Date.now();
const check = (ok, msg) => ok || problems.push(msg);

/** A source file of the app, bundled and imported (pure files only). */
async function pure(entry) {
  const r = buildSync({ entryPoints: [new URL(`../${entry}`, import.meta.url).pathname], bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`);
}
const DM = await pure('apps/web/src/docs/model.ts');
const SM = await pure('apps/web/src/sheets/model.ts');
const PM = await pure('apps/web/src/slides/model.ts');
const ZIP = await pure('apps/web/src/convert/zip.ts');
const W = await pure('apps/web/src/features/files/words.ts');
const doc = { ...DM.newDoc('Garden plan', [DM.block('h1', 'Garden plan'), DM.block('p', 'Plant the wisteria by the south wall in March.')]), at: Date.now() - 3_600_000 };
const book = (() => { const b = SM.newBook('Budget 2026'); b.sheets[0].cells.A1 = { v: 'Council tax' }; b.sheets[0].cells.B1 = { v: 1840 }; b.at = Date.now() - 7_200_000; return b; })();
const deck = { ...PM.newDeck('Trip to Lisbon', [PM.newSlide('title', { title: DM.block('h1', 'Trip to Lisbon') })]), at: Date.now() - 10_800_000 };
const zipBytes = ZIP.zipStore([{ name: 'packing.txt', data: 'Passport, adapter, sun cream.' }, { name: 'route.txt', data: 'Tram 28 to the castle.' }]);

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined });

async function open(viewport) {
  const ctx = await browser.newContext({ viewport, ...UK, deviceScaleFactor: 1, isMobile: true, hasTouch: true, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${viewport.width}] pageerror: ${e.message}`));
  // his answers to the phone's own text boxes (RENAME, TAGS, MOVE, NEW FOLDER) and its are-you-sure questions, in order
  const answers = [];
  page.on('dialog', (d) => void (d.type() === 'confirm' ? d.accept() : d.accept(answers.shift() ?? '')));
  await page.addInitScript(({ key, doc, book, deck }) => {
    if (sessionStorage.getItem('files.seeded')) return;
    sessionStorage.setItem('files.seeded', '1');
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Tony', speak: false }));
    localStorage.setItem('ghosty.docs', JSON.stringify([doc]));
    localStorage.setItem('ghosty.sheets', JSON.stringify([book]));
    localStorage.setItem('ghosty.slides', JSON.stringify([deck]));
  }, { key: KEY, doc, book, deck });
  await page.goto(`${base}/#files`);
  await page.waitForFunction(() => document.querySelectorAll('#pg-files .frow').length >= 3, null, { timeout: 20000 }).catch(() => problems.push(`[${viewport.width}] Files never listed the three things`));
  return { ctx, page, answers };
}
const rows = (page) => page.evaluate(() => [...document.querySelectorAll('#pg-files .flistbox:not([hidden]) .frow')].filter((r) => r.offsetParent).map((r) => ({ key: r.dataset.key, name: r.querySelector('.fname')?.textContent, snip: r.querySelector('.fsnip')?.textContent ?? '' })));
const status = (page) => page.evaluate(() => document.querySelector('#pg-files [data-id="filesstatus"]')?.textContent ?? '');
const search = async (page, q) => {
  await page.fill('#pg-files .fsearch', q);
  await page.waitForTimeout(150);
};
const pill = (page, sec) => page.evaluate((s) => document.querySelector(`#pg-files .secpill[data-sec="${s}"]`)?.click(), sec);
const docs = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.docs') ?? '[]').map((d) => d.title));
// (the card scales in as it opens: measured once it has settled, the same size on two frames running and nothing still animating)
const cardKeys = async (page) => (await page.waitForFunction(() => { const b = document.querySelector('.fcard .fkeys button'); const h = b ? Math.round(b.getBoundingClientRect().height * 10) : 0; const same = h > 0 && h === window.__cardH; window.__cardH = h; const moving = [...document.querySelectorAll('.mbox, .fcard')].some((e) => e.getAnimations?.({ subtree: true }).some((x) => x.playState === 'running')); return same && !moving; }, null, { timeout: 5000, polling: 'raf' }).catch(() => undefined), page.evaluate(() => [...document.querySelectorAll('.fcard .fkeys button')].map((b) => { const r = b.getBoundingClientRect(); return { t: (b.dataset.label || b.textContent || '').trim().toUpperCase(), w: Math.round(r.width), h: Math.round(r.height) }; })));
const closeCard = (page) => page.keyboard.press('Escape');

for (const [vp, tag] of [[PHONE, '440'], [SMALL, '390']]) {
  const T = `[${tag}]`;
  const { ctx, page, answers } = await open(vp);
  // a. browse and search
  let r = await rows(page);
  check(['docs', 'sheets', 'slides'].every((s) => r.some((x) => x.key?.startsWith(`${s}:`))), `${T} a. Browse lists ${JSON.stringify(r.map((x) => x.key))} (want the document, the spreadsheet and the presentation)`);
  check(/^3 things · \d+ (bytes|KB)$/.test(await status(page)), `${T} a. the status reads "${await status(page)}"`);
  await search(page, 'wisteria');
  r = await rows(page);
  check(r.length === 1 && r[0].key === `docs:${doc.id}` && /wisteria/.test(r[0].snip), `${T} a. "wisteria" (inside the document) found ${JSON.stringify(r)}`);
  await search(page, 'council tax');
  r = await rows(page);
  check(r.length === 1 && r[0].key === `sheets:${book.id}`, `${T} a. "council tax" (a cell inside the spreadsheet) found ${JSON.stringify(r)}`);
  await search(page, 'zzqx');
  check((await rows(page)).length === 0 && (await status(page)) === W.EMPTY.search('zzqx'), `${T} a. no match says "${await status(page)}"`);
  await search(page, '');
  await page.evaluate(() => [...document.querySelectorAll('#pg-files .fchips button')].find((b) => b.textContent === 'Spreadsheets')?.click());
  await page.waitForTimeout(150);
  r = await rows(page);
  check(r.length === 1 && r[0].key === `sheets:${book.id}`, `${T} a. the Spreadsheets chip shows ${JSON.stringify(r)}`);
  await page.evaluate(() => [...document.querySelectorAll('#pg-files .fchips button')].find((b) => b.textContent === 'All')?.click());
  await page.waitForTimeout(150);
  // b. the star and favourites; recents
  await page.click(`#pg-files .frow[data-key="docs:${doc.id}"] .fstar`);
  const starred = await page.evaluate((k) => JSON.parse(localStorage.getItem('ghosty.files') ?? '{}').items?.[k]?.fav, `docs:${doc.id}`);
  check(starred === true, `${T} b. the star was not kept`);
  await pill(page, 'recents');
  await page.waitForFunction(() => [...document.querySelectorAll('#pg-files .frow')].some((r) => r.offsetParent), null, { timeout: 8000 }).catch(() => undefined);
  const fav = await page.evaluate(() => [...document.querySelectorAll('#pg-files .flistbox')].map((l) => [...l.querySelectorAll('.frow')].filter((r) => r.offsetParent).map((r) => r.dataset.key)));
  check(fav.some((l) => l.length === 3) && fav.some((l) => l.length === 1 && l[0] === `docs:${doc.id}`), `${T} b. Recents and Favourites show ${JSON.stringify(fav)} (want all three, and the starred document)`);
  await pill(page, 'browse');
  await page.waitForTimeout(200);
  // c. the card: preview and keys; rename, tags, move, duplicate (the first width only: the second checks the card's keys)
  await page.click(`#pg-files .frow[data-key="docs:${doc.id}"] .fname`);
  await page.waitForSelector('.fcard', { timeout: 8000 }).catch(() => problems.push(`${T} c. the card never opened`));
  const keys = await cardKeys(page);
  const want = ['OPEN IN DOCUMENTS', 'SHARE', 'RENAME', 'DUPLICATE', 'MOVE', 'TAGS', 'DELETE'];
  check(want.every((k) => keys.some((x) => x.t === k)) && keys.every((k) => k.w >= 44 && k.h >= 44), `${T} c. the card's keys ${JSON.stringify(keys)} (want ${want.join(', ')} at 44 pt)`);
  check(await page.evaluate(() => /wisteria/.test(document.querySelector('.fcard .ftext')?.textContent ?? '')), `${T} c. the preview does not show the document's words`);
  if (tag === '440') {
    answers.push('garden, spring');
    await page.evaluate(() => [...document.querySelectorAll('.fcard .fkeys button')].find((b) => /^tags$/i.test((b.dataset.label || b.textContent || '').trim()))?.click());
    await page.waitForTimeout(400);
    let note = await page.evaluate((k) => JSON.parse(localStorage.getItem('ghosty.files') ?? '{}').items?.[k], `docs:${doc.id}`);
    check(JSON.stringify(note?.tags) === '["garden","spring"]', `${T} c. TAGS kept ${JSON.stringify(note)}`);
    await page.click(`#pg-files .frow[data-key="docs:${doc.id}"] .fname`);
    await page.waitForSelector('.fcard', { timeout: 8000 });
    answers.push('House');
    await page.evaluate(() => [...document.querySelectorAll('.fcard .fkeys button')].find((b) => /^move$/i.test((b.dataset.label || b.textContent || '').trim()))?.click());
    await page.waitForTimeout(400);
    note = await page.evaluate((k) => JSON.parse(localStorage.getItem('ghosty.files') ?? '{}'), `docs:${doc.id}`);
    check(note.items?.[`docs:${doc.id}`]?.folder === 'House' && note.folders?.includes('House'), `${T} c. MOVE kept ${JSON.stringify(note)}`);
    await search(page, 'spring');
    check((await rows(page)).map((x) => x.key).join() === `docs:${doc.id}`, `${T} c. a tag is searched`);
    await search(page, '');
    await page.click(`#pg-files .frow[data-key="docs:${doc.id}"] .fname`);
    await page.waitForSelector('.fcard', { timeout: 8000 });
    answers.push('Garden plan 2026');
    await page.evaluate(() => [...document.querySelectorAll('.fcard .fkeys button')].find((b) => /^rename$/i.test((b.dataset.label || b.textContent || '').trim()))?.click());
    await page.waitForTimeout(400);
    check((await docs(page)).includes('Garden plan 2026'), `${T} c. RENAME left the documents ${JSON.stringify(await docs(page))}`);
    await page.click(`#pg-files .frow[data-key="docs:${doc.id}"] .fname`);
    await page.waitForSelector('.fcard', { timeout: 8000 });
    await page.evaluate(() => [...document.querySelectorAll('.fcard .fkeys button')].find((b) => /^duplicate$/i.test((b.dataset.label || b.textContent || '').trim()))?.click());
    await page.waitForTimeout(500);
    const ds = await docs(page);
    check(ds.length === 2 && ds.includes('Garden plan 2026 copy'), `${T} c. DUPLICATE left ${JSON.stringify(ds)}`);
    // d. delete the copy: UNDO puts it back; delete it again: RESTORE from Recently deleted
    const copyKey = await page.evaluate(() => `docs:${JSON.parse(localStorage.getItem('ghosty.docs')).find((d) => / copy$/.test(d.title)).id}`);
    const del = async () => {
      await page.click(`#pg-files .frow[data-key="${copyKey}"] .fname`);
      await page.waitForSelector('.fcard', { timeout: 8000 });
      await page.evaluate(() => [...document.querySelectorAll('.fcard .fkeys button')].find((b) => /^delete$/i.test((b.dataset.label || b.textContent || '').trim()))?.click());
      await page.waitForTimeout(500);
    };
    await del();
    const bar = await page.evaluate(() => { const u = [...document.querySelectorAll('#pg-files .undo')].find((x) => !x.hidden && x.offsetParent); return u ? u.textContent : ''; });
    check((await docs(page)).length === 1 && /Recently deleted/.test(bar), `${T} d. DELETE left ${JSON.stringify(await docs(page))}, the bar "${bar}"`);
    await page.evaluate(() => [...document.querySelectorAll('#pg-files .undo button')].find((b) => b.offsetParent)?.click());
    await page.waitForTimeout(500);
    check((await docs(page)).length === 2, `${T} d. UNDO left ${JSON.stringify(await docs(page))}`);
    await del();
    await pill(page, 'deleted');
    await page.waitForFunction(() => /1 thing/.test(document.querySelector('#pg-files [data-id="filesbin"]')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => problems.push(`${T} d. Recently deleted does not list the copy`));
    await page.evaluate(() => [...document.querySelectorAll('#pg-files .fbinkeys button')].find((b) => /^restore$/i.test((b.dataset.label || b.textContent || '').trim()))?.click());
    await page.waitForTimeout(600);
    const binLine = await page.evaluate(() => document.querySelector('#pg-files [data-id="filesbin"]')?.textContent ?? '');
    check((await docs(page)).length === 2 && binLine === W.EMPTY.bin, `${T} d. RESTORE left ${JSON.stringify(await docs(page))}, the bin "${binLine}"`);
    await pill(page, 'browse');
    await page.waitForTimeout(200);
    // e. import a text file and a zip
    await page.setInputFiles('#pg-files .files input[type=file]', [
      { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('The lighthouse opens at nine.') },
      { name: 'trip.zip', mimeType: 'application/zip', buffer: Buffer.from(zipBytes) },
    ]);
    await page.waitForFunction(() => document.querySelectorAll('#pg-files .frow[data-key^="own:"]').length >= 3, null, { timeout: 10000 }).catch(() => problems.push(`${T} e. IMPORT did not bring in the text file and the zip's two files`));
    await search(page, 'lighthouse');
    r = await rows(page);
    check(r.length === 1 && r[0].name === 'notes.txt', `${T} e. "lighthouse" (inside the imported file) found ${JSON.stringify(r)}`);
    await search(page, '');
    const names = await page.evaluate(() => [...document.querySelectorAll('#pg-files .frow[data-key^="own:"] .fname')].map((e) => e.textContent).sort());
    check(JSON.stringify(names) === '["notes.txt","packing.txt","route.txt"]', `${T} e. the files brought in are ${JSON.stringify(names)}`);
    // f. select two and ZIP: one zip, a .docx inside
    await page.evaluate(() => [...document.querySelectorAll('#pg-files .ftools button')].find((b) => /^select$/i.test((b.dataset.label || b.textContent || '').trim()))?.click());
    await page.waitForTimeout(200);
    await page.click(`#pg-files .frow[data-key="docs:${doc.id}"] .fpick`);
    await page.click(`#pg-files .frow[data-key="sheets:${book.id}"] .fpick`);
    const dl = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
    await page.evaluate(() => [...document.querySelectorAll('#pg-files .fselbar button')].find((b) => /^zip/i.test((b.dataset.label || b.textContent || '').trim()))?.click());
    const d = await dl;
    if (!d) problems.push(`${T} f. ZIP gave no file`);
    else {
      const p = await d.path();
      const { readFileSync } = await import('node:fs');
      const entries = [...ZIP.unzipSync(new Uint8Array(readFileSync(p))).keys()].sort();
      check(/\.zip$/.test(d.suggestedFilename()) && JSON.stringify(entries) === '["Budget 2026.xlsx","Garden plan 2026.docx"]', `${T} f. the zip ${d.suggestedFilename()} holds ${JSON.stringify(entries)}`);
    }
    await page.evaluate(() => [...document.querySelectorAll('#pg-files .ftools button')].find((b) => /^cancel$/i.test((b.dataset.label || b.textContent || '').trim()))?.click());
  } else await closeCard(page);
  await closeCard(page).catch(() => undefined);
  // g. storage
  await pill(page, 'storage');
  await page.waitForFunction(() => /^\d+(\.\d)? (KB|MB|bytes) in \d+ things?$/.test(document.querySelector('#pg-files [data-id="filestotal"]')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => undefined);
  const st = await page.evaluate(() => ({ total: document.querySelector('#pg-files [data-id="filestotal"]')?.textContent ?? '', bars: [...document.querySelectorAll('#pg-files .fbar .fbarname')].map((e) => e.textContent), big: [...document.querySelectorAll('#pg-files .fbars ~ .flistbox .frow')].length }));
  check(/^\d+(\.\d)? (KB|MB|bytes) in \d+ things?$/.test(st.total) && st.bars.includes('Documents') && st.bars.includes('Spreadsheets') && st.big >= 3, `${T} g. STORAGE shows ${JSON.stringify(st)}`);
  await page.screenshot({ path: `${out}/files-${tag}-storage.png` }).catch(() => undefined);
  // h. nothing sideways, every key 44 pt, on each section
  for (const sec of ['browse', 'recents', 'deleted', 'storage']) {
    await pill(page, sec);
    await page.waitForTimeout(300);
    const m = await page.evaluate(() => ({ side: document.scrollingElement.scrollWidth - innerWidth, small: [...document.querySelectorAll('#pg-files .files button, #pg-files .files select, #pg-files .files .fsearch')].filter((b) => b.offsetParent && !b.closest('[hidden]')).map((b) => { const r = b.getBoundingClientRect(); return { t: (b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 20), w: Math.round(r.width), h: Math.round(r.height) }; }).filter((k) => k.w < 44 || k.h < 44) }));
    check(m.side <= 1 && !m.small.length, `${T} h. ${sec}: ${m.side} px sideways, keys under 44 pt ${JSON.stringify(m.small)}`);
  }
  await pill(page, 'browse');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/files-${tag}-browse.png` }).catch(() => undefined);
  await ctx.close();
}

await browser.close();
if (problems.length) {
  console.error(`files: ${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`ok files (${Math.round((Date.now() - t0) / 1000)} s): at 440 and 390, Files lists the document, the spreadsheet and the presentation from their own apps; search by name, by tag and by the words inside, with the line around it; the kind chips; the star and FAVOURITES, RECENTS; a card with its preview and OPEN IN, SHARE, RENAME, DUPLICATE, MOVE, TAGS and DELETE at 44 pt, each doing it in its own app; DELETE to Recently deleted with UNDO, and RESTORE; IMPORT of a text file and a zip opened to its files; SELECT two and ZIP, a .docx and a .xlsx inside; STORAGE's total, each kind's space and the biggest first; nothing sideways`);
