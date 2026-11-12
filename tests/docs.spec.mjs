// THE FULL EDITORS, THE SECOND: DOCUMENTS, the core of Word (BRIEF-EDITOR-DOCUMENTS; OWNER-ISSUES 127, 164) on the owner's iPhone 18 Pro Max
// (440 × 956, en-GB, Europe/London) against the real brain with its scripted model:
//  1. WRITE in MAKE → Documents: NEW, a title, paragraphs by the keyboard, headings, a list, alignment; bold, italic, underline and a link on
//     chosen words; each kept in the document (read back from the page's own state).
//  2. INSERT a photo (a JPEG made here, shrunk and kept in the phone's database), a table (3 × 3, filled, a row and a column added, the
//     header row), a page break; PAGE: Letter, narrow margins, a header, a footer, numbers; FIND AND REPLACE across paragraphs and cells;
//     the word count, characters and pages said; UNDO and REDO.
//  3. AUTOSAVE: the document is in My documents with its words at once; a reload and a tap reopen it, its photo drawn.
//  4. EXPORT WORD and read it with a parser that is not ours (the vendored mammoth), its XML well formed in the browser's own parser, then IMPORT
//     it again and see the same page; EXPORT PDF: Letter's page size, the footer and the picture in it; a DOCX built here by hand, the way Word
//     writes one (a Title, a heading, a link, a table with a header row, a picture, a Letter landscape footer with a PAGE field), read by our reader.
//  5. GHOSTY IN IT: WRITE INTO IT lays the brain's words after the paragraph he is in (its chatter gone) and UNDO takes them out; REWRITE THIS
//     PARAGRAPH is one suggestion to accept. OPEN on the Stage's letter opens this same editor.
//  6. THE THREE WORLDS AND THE PHONE: The Scan, Glass and ONE INK at 440 × 956 and The Scan at 390 × 844: every key 44 pt, nothing sideways,
//     every control named.
// The benchmark (a letter with a table and a footer written, styled, exported and read back) is timed and printed.
//   BASE=http://localhost:8810 node tests/docs.spec.mjs [outDir]
import { mkdirSync, readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const problems = [];
const check = (ok, msg) => {
  if (!ok) problems.push(msg);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
  return ok;
};
const SCAN = { ground: 'graphite', world: 'scan', night: 'graphite', switches: {} };
const GLASS = { ground: 'graphite', world: 'glass', night: 'graphite', switches: {} };
const INK = { ground: 'warm', world: 'ink', night: 'warm', switches: {} };
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

async function open({ look = SCAN, viewport = PHONE, show = false } = {}) {
  const ctx = await browser.newContext({ viewport, ...UK, serviceWorkers: 'block', acceptDownloads: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
  await page.addInitScript(({ key, look, show }) => {
    if (!localStorage.getItem('spec.docs.seeded')) {
      localStorage.setItem('spec.docs.seeded', '1');
      localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Boss', speak: false, sounds: false, theme: 'reactor', look, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
    }
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.themes1', '1');
    if (show) window.__ghostyShow = true;
    window.__ghostyHero = true;
    window.__ghostyPlace = { none: true };
  }, { key: KEY, look, show });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 40000 }).catch(() => problems.push('the boot never ended'));
  return { ctx, page };
}
const until = (page, fn, arg, ms = 15000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const docs = (page) => page.evaluate(() => ({ ...window.__ghosty.docs, json: undefined, doc: JSON.parse(window.__ghosty.docs.json || 'null') }));
const goDocs = async (page) => {
  await page.evaluate(() => (location.hash = 'area-make'));
  await page.waitForSelector('#pg-area-make .hubtile[data-id="docs"]', { timeout: 15000 });
  await page.click('#pg-area-make .hubtile[data-id="docs"]');
  await page.waitForSelector('#pg-docs .dcsheet', { timeout: 15000 });
};
const pill = (page, name) => page.locator('.dcpill', { hasText: new RegExp(`^${name}$`, 'i') }).click();
const key = (page, label) => page.locator('.dcpanel:not([hidden]) button, .dctools button, .dcexport button, .dcasks button, .dcfind button, .dcsugs button').filter({ hasText: label }).first();
const aria = (page, label) => page.locator(`.dcsheet button[aria-label="${label}"]`).first();
/** The words `word` inside the paragraph holding `text`, chosen. */
const select = (page, text, word) => page.evaluate(([t, w]) => {
  const el = [...document.querySelectorAll('.dcpage .dcb')].find((e) => e.textContent.includes(t));
  el.focus();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const i = n.textContent.indexOf(w);
    if (i < 0) continue;
    const r = document.createRange();
    r.setStart(n, i);
    r.setEnd(n, i + w.length);
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
    return true;
  }
  return false;
}, [text, word]).then(async (ok) => (await page.waitForTimeout(150), ok));
const blockWith = (page, text) => page.locator('.dcpage .dcb', { hasText: text }).first();
async function saved(page, click) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), click()]);
  return { name: dl.suggestedFilename(), bytes: readFileSync(await dl.path()) };
}
/** A JPEG made in the page (a photo of his, stood in for). */
const jpeg = (page) => page.evaluate(() => {
  const c = document.createElement('canvas');
  c.width = 1600;
  c.height = 900;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 1600, 900);
  grad.addColorStop(0, '#2b6cb0');
  grad.addColorStop(1, '#f6ad55');
  g.fillStyle = grad;
  g.fillRect(0, 0, 1600, 900);
  g.fillStyle = '#fff';
  g.font = '120px sans-serif';
  g.fillText('damp wall', 400, 480);
  return c.toDataURL('image/jpeg', 0.9).split(',')[1];
}).then((b) => Buffer.from(b, 'base64'));

// a tiny zip writer (stored entries) for the hand-built Word file, and the reader of ours for the files the app makes
const crcT = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function zip(files) {
  const locals = [];
  const dir = [];
  let off = 0;
  for (const [name, data] of Object.entries(files)) {
    const nb = Buffer.from(name);
    const db = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt32LE(crc(db), 14); h.writeUInt32LE(db.length, 18); h.writeUInt32LE(db.length, 22); h.writeUInt16LE(nb.length, 26);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt32LE(crc(db), 16); c.writeUInt32LE(db.length, 20); c.writeUInt32LE(db.length, 24); c.writeUInt16LE(nb.length, 28); c.writeUInt32LE(off, 42);
    locals.push(h, nb, db);
    dir.push(c, nb);
    off += 30 + nb.length + db.length;
  }
  const d = Buffer.concat(dir);
  const e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(Object.keys(files).length, 8); e.writeUInt16LE(Object.keys(files).length, 10); e.writeUInt32LE(d.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...locals, d, e]);
}
/** The stored entries of a zip the app wrote (name → bytes). */
function unzipStored(b) {
  const out = {};
  let eocd = b.length - 22;
  while (eocd > 0 && b.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  let p = b.readUInt32LE(eocd + 16);
  for (let n = 0; n < b.readUInt16LE(eocd + 10); n++) {
    const size = b.readUInt32LE(p + 24);
    const nl = b.readUInt16LE(p + 28);
    const el = b.readUInt16LE(p + 30);
    const cl = b.readUInt16LE(p + 32);
    const local = b.readUInt32LE(p + 42);
    const name = b.subarray(p + 46, p + 46 + nl).toString();
    const start = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28);
    out[name] = b.subarray(start, start + size);
    p += 46 + nl + el + cl;
  }
  return out;
}
const PNG = (() => {
  const chunk = (type, data) => {
    const h = Buffer.alloc(8);
    h.writeUInt32BE(data.length, 0);
    h.write(type, 4);
    const body = Buffer.concat([Buffer.from(type), data]);
    const t = Buffer.alloc(4);
    t.writeUInt32BE(crc(body), 0);
    return Buffer.concat([h, data, t]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(8, 0); ihdr.writeUInt32BE(4, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.concat(Array.from({ length: 4 }, () => Buffer.concat([Buffer.from([0]), Buffer.alloc(24, 180)])));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
})();
function handmadeDocx() {
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
  const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const body = `<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>Tenancy notes</w:t></w:r></w:p>
<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Repairs</w:t></w:r></w:p>
<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Bold start, </w:t></w:r><w:r><w:rPr><w:u w:val="single"/></w:rPr><w:t xml:space="preserve">underlined middle, </w:t></w:r><w:hyperlink r:id="rId9" w:history="1"><w:r><w:rPr><w:rStyle w:val="Hyperlink"/></w:rPr><w:t>a link</w:t></w:r></w:hyperlink><w:r><w:t>.</w:t></w:r></w:p>
<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>First bullet</w:t></w:r></w:p>
<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr></w:pPr><w:r><w:t>First number</w:t></w:r></w:p>
<w:tbl><w:tblPr/><w:tblGrid><w:gridCol w:w="3000"/><w:gridCol w:w="3000"/></w:tblGrid>
<w:tr><w:trPr><w:tblHeader/></w:trPr><w:tc><w:p><w:r><w:t>Room</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Problem</w:t></w:r></w:p></w:tc></w:tr>
<w:tr><w:tc><w:p><w:r><w:t>Kitchen</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Leak</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
<w:p><w:r><w:drawing><wp:inline><wp:extent cx="2000000" cy="1000000"/><wp:docPr id="1" name="Picture 1" descr="A tiny test picture"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:blipFill><a:blip r:embed="rId8"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>
<w:p><w:r><w:br w:type="page"/></w:r></w:p>
<w:p><w:r><w:t>After the break.</w:t></w:r></w:p>
<w:sectPr><w:footerReference w:type="default" r:id="rId10"/><w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>`;
  return zip({
    '[Content_Types].xml': `${X}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    '_rels/.rels': `${X}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/officeDocument" Target="word/document.xml"/></Relationships>`,
    'word/_rels/document.xml.rels': `${X}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/styles" Target="styles.xml"/><Relationship Id="rId2" Type="${R}/numbering" Target="numbering.xml"/><Relationship Id="rId8" Type="${R}/image" Target="media/image1.png"/><Relationship Id="rId9" Type="${R}/hyperlink" Target="https://www.gov.uk/private-renting" TargetMode="External"/><Relationship Id="rId10" Type="${R}/footer" Target="footer1.xml"/></Relationships>`,
    'word/document.xml': `${X}<w:document ${W}><w:body>${body}</w:body></w:document>`,
    'word/styles.xml': `${X}<w:styles ${W}><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style><w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/></w:style></w:styles>`,
    'word/numbering.xml': `${X}<w:numbering ${W}><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/></w:lvl></w:abstractNum><w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num></w:numbering>`,
    'word/footer1.xml': `${X}<w:ftr ${W}><w:p><w:r><w:t xml:space="preserve">Confidential </w:t></w:r><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`,
    'word/media/image1.png': PNG,
  });
}

// ================================================================ 1 to 5. one phone, The Scan
const T0 = Date.now();
let jpeg0;
const { ctx, page } = await open({ look: SCAN, show: true });
await goDocs(page);
check(await page.locator('#pg-docs .dcbar button', { hasText: 'NEW' }).count() === 1, 'MAKE → Documents opens the documents screen with NEW');
const tNew = Date.now();
await page.locator('#pg-docs .dcbar button', { hasText: 'NEW' }).click();
check(await until(page, () => window.__ghosty?.docs?.view === 'doc'), 'NEW opens a blank page');
const openMs = Date.now() - tNew;
await page.fill('.dctitle', 'Repairs letter');
await page.press('.dctitle', 'Tab');
await page.locator('.dcpage .dcb').first().click();
const tKey = Date.now();
await page.keyboard.type('Notice of repairs');
await page.waitForFunction(() => JSON.parse(localStorage.getItem('ghosty.docs') ?? '[]')[0]?.blocks?.[0]?.runs?.[0]?.text === 'Notice of repairs', null, { timeout: 5000 }).catch(() => undefined);
const keyMs = Date.now() - tKey;
await page.keyboard.press('Enter');
await page.keyboard.type('Dear Mr Khan, I am writing about the damp in the back bedroom.');
await page.keyboard.press('Enter');
await page.keyboard.type('Please fix it within 14 days, as the council advises.');
await page.keyboard.press('Enter');
await page.keyboard.type('Repair the wall');
await page.keyboard.press('Enter');
await page.keyboard.type('Confirm the date');
await page.waitForTimeout(600);
let s = await docs(page);
check(s.doc.blocks.length === 5 && s.doc.blocks[0].runs[0].text === 'Notice of repairs' && s.doc.title === 'Repairs letter', `typed by the keyboard: ${s.doc.blocks.map((b) => b.t).join(',')} "${s.doc.title}"`);
// styles, lists, alignment
await blockWith(page, 'Notice of repairs').click();
await aria(page, 'Heading 1').click();
await key(page, 'CENTRE').click();
await blockWith(page, 'Repair the wall').click();
await key(page, '• LIST').click();
await blockWith(page, 'Confirm the date').click();
await key(page, '• LIST').click();
s = await docs(page);
check(s.doc.blocks[0].t === 'h1' && s.doc.blocks[0].align === 'center' && s.doc.blocks[3].t === 'ul' && s.doc.blocks[4].t === 'ul', `H1 centred, a bullet list: ${s.doc.blocks.map((b) => b.t + (b.align ? ':' + b.align : '')).join(',')}`);
check(await page.locator('.dcpage h2[data-align="center"]').count() === 1 && await page.locator('.dcpage ul.dcl li').count() === 2, 'the page draws the heading centred and the list');
// marks and a link
await select(page, 'within 14 days', 'within 14 days');
await aria(page, 'Bold').click();
await select(page, 'damp in the back', 'damp');
await aria(page, 'Italic').click();
await select(page, 'damp in the back', 'bedroom');
await aria(page, 'Underline').click();
await select(page, 'Dear Mr Khan', 'Khan');
await key(page, 'LINK').click();
await page.fill('.dclink input', 'gov.uk/private-renting');
await key(page, 'APPLY').click();
await page.waitForTimeout(600);
s = await docs(page);
const runs = s.doc.blocks.flatMap((b) => b.runs);
check(runs.some((r) => r.b && r.text.includes('within 14 days')) && runs.some((r) => r.i && r.text === 'damp') && runs.some((r) => r.u && r.text === 'bedroom') && runs.some((r) => r.href === 'https://gov.uk/private-renting' && r.text === 'Khan'), `bold, italic, underline and a link kept: ${JSON.stringify(runs.filter((r) => r.b || r.i || r.u || r.href))}`);
check(await page.locator('.dcpage a[href="https://gov.uk/private-renting"]').count() === 1 && await page.locator('.dcpage u').count() === 1, 'the page draws the link and the underline');
await page.screenshot({ path: `${out}/docs-write.png` });
// a javascript: address is not a link
await select(page, 'Please fix it', 'Please');
await key(page, 'LINK').click();
await page.fill('.dclink input', 'javascript:alert(1)');
await key(page, 'APPLY').click();
check(!(await docs(page)).doc.blocks.some((b) => b.runs.some((r) => /javascript/i.test(r.href ?? ''))), 'an address that is a script is refused');
await page.locator('.dclink button', { hasText: 'CANCEL' }).click();

// insert: a photo, a table, a page break
await pill(page, 'insert');
await blockWith(page, 'Confirm the date').click();
await page.setInputFiles('.dcsheet input[type=file][accept="image/*"]', { name: 'damp.jpg', mimeType: 'image/jpeg', buffer: (jpeg0 = await jpeg(page)) });
check(await until(page, () => window.__ghosty?.docs && JSON.parse(window.__ghosty.docs.json).blocks.some((b) => b.t === 'img')), 'a photo is added from his photos');
await until(page, () => document.querySelector('.dcpage figure img')?.naturalWidth > 0);
s = await docs(page);
const img = s.doc.blocks.find((b) => b.t === 'img');
const shrunk = await page.evaluate(() => Math.round(document.querySelector('.dcpage figure img').src.length * 0.75));
check(img && img.iw === 1280 && img.ih === 720 && img.w === 60 && !JSON.stringify(s.doc).includes('data:image'), `shrunk to 1,280 px, 60% of the page, only its id in the document: ${img?.iw}×${img?.ih}`);
check(await page.evaluate(() => document.querySelector('.dcpage figure img').naturalWidth) === 1280, 'the photo is drawn on the page');
await page.locator('.dcctx button', { hasText: 'LARGER' }).click();
await page.fill('.dcctx input', 'Black mould on the back bedroom wall');
await page.locator('.dcctx button', { hasText: /^SET$/ }).click();
s = await docs(page);
check(s.doc.blocks.find((b) => b.t === 'img').w === 70 && s.doc.blocks.find((b) => b.t === 'img').alt === 'Black mould on the back bedroom wall', 'LARGER and its description are kept');
await page.locator('.dcpage figure').first().focus();
await key(page, 'INSERT TABLE').click();
check(await until(page, () => document.querySelectorAll('.dcpage .dctable td, .dcpage .dctable th').length === 9), 'INSERT TABLE adds a 3 × 3 table');
const cells = ['Item', 'Cost', 'Date', 'Paint', '40', 'Monday', 'Plaster', '95', 'Friday'];
for (const [i, t] of cells.entries()) {
  const c = page.locator('.dcpage .dctable td, .dcpage .dctable th').nth(i);
  await c.click();
  await page.keyboard.type(t);
}
await page.waitForTimeout(600);
await page.locator('.dcpage .dctable td').nth(0).click(); // (Paint: the first body cell)
await page.locator('.dcctx button', { hasText: '+ ROW' }).click();
await page.locator('.dcctx button', { hasText: '+ COLUMN' }).click();
s = await docs(page);
const tb = s.doc.blocks.find((b) => b.t === 'table');
check(tb.head === true && tb.rows.length === 4 && tb.rows[0].length === 4 && tb.rows[0][0][0].text === 'Item' && tb.rows[0][1].length === 0 && tb.rows[0][2][0].text === 'Cost' && tb.rows[2].every((c) => !c.length) && tb.rows[1][2][0].text === '40' && tb.rows[3][0][0].text === 'Plaster', `the table holds his words, a row and a column added after the cell he was in: ${JSON.stringify(tb.rows.map((r) => r.map((c) => c[0]?.text ?? '')))}`);
await key(page, 'PAGE BREAK').click();
check((await docs(page)).doc.blocks.some((b) => b.t === 'pb'), 'a page break is added');
await page.screenshot({ path: `${out}/docs-insert.png` });

// the page
await pill(page, 'page');
await page.selectOption('.dcpanel:not([hidden]) select[aria-label="Paper size"]', 'letter');
await page.selectOption('.dcpanel:not([hidden]) select[aria-label="Margins"]', 'narrow');
await page.fill('input[aria-label="Header line"]', 'Private and confidential');
await page.press('input[aria-label="Header line"]', 'Tab');
await page.fill('input[aria-label="Footer line"]', 'Flat 4 repairs');
await page.press('input[aria-label="Footer line"]', 'Tab');
s = await docs(page);
check(s.doc.page?.size === 'letter' && s.doc.page.margin === 'narrow' && s.doc.page.header === 'Private and confidential' && s.doc.page.footer === 'Flat 4 repairs' && s.doc.page.numbers === true, `the page is set: ${JSON.stringify(s.doc.page)}`);
check(s.pages >= 2 && /\d+ words · \d+ characters · \d+ pages? \(Letter\)/.test(await page.locator('.dcmeta').textContent()), `the count line says words, characters, pages: ${await page.locator('.dcmeta').textContent()}`);
await page.screenshot({ path: `${out}/docs-page.png` });

// find and replace across paragraphs and cells
await key(page, 'FIND').click();
await page.fill('.dcfind input[type=search]', 'khan');
check(/1 found/.test(await page.locator('.dcfound').textContent()), 'FIND says what it found');
await page.fill('.dcfind input[type=search]', 'Paint');
await page.fill('.dcfind input[placeholder="Replace with"]', 'Emulsion');
await key(page, 'REPLACE ALL').click();
s = await docs(page);
check(JSON.stringify(s.doc).includes('Emulsion') && !JSON.stringify(s.doc.blocks.find((b) => b.t === 'table')).includes('Paint'), 'REPLACE ALL changes the words in a table cell');
await key(page, 'UNDO').click();
check(JSON.stringify((await docs(page)).doc).includes('Paint') && !JSON.stringify((await docs(page)).doc).includes('Emulsion'), 'UNDO puts it back');
await key(page, 'REDO').click();
check(JSON.stringify((await docs(page)).doc).includes('Emulsion'), 'REDO does it again');
await key(page, 'FIND').click();

// 3. autosave: in My documents at once, reopened after a reload
const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.docs') ?? '[]'));
check(kept[0]?.title === 'Repairs letter' && kept[0].blocks.some((b) => b.t === 'table') && /KEPT ON THIS PHONE/.test(await page.locator('.dcsaved').textContent()), 'the document is kept on the phone as he works, and says so');
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('#boot', { state: 'detached', timeout: 40000 }).catch(() => undefined);
await goDocs(page);
check(await until(page, () => /Repairs letter/.test(document.querySelector('.dclist')?.textContent ?? '')), 'after a reload, My documents lists it');
await page.locator('.dcopen', { hasText: 'Repairs letter' }).click();
check(await until(page, () => document.querySelector('.dcpage figure img')?.naturalWidth > 0 && document.querySelectorAll('.dcpage .dctable td').length > 0), 'a tap reopens it with its photo and table');

// 4. export Word, read by a parser that is not ours
const word = await saved(page, async () => {
  await page.locator('.dcexport button', { hasText: 'WORD' }).click();
  await page.waitForSelector('.dcouts .cvoutt b:text-is("Repairs letter.docx")');
  await page.locator('.dcouts button', { hasText: 'SAVE' }).click();
});
const parts = unzipStored(word.bytes);
check(word.name === 'Repairs letter.docx' && ['word/document.xml', 'word/styles.xml', 'word/footer1.xml', 'word/header1.xml', 'word/media/image1.jpeg', 'word/_rels/document.xml.rels'].every((n) => parts[n]), `WORD makes a .docx with its parts: ${Object.keys(parts).join(' ')}`);
const bad = await page.evaluate((xs) => xs.filter(([n, t]) => /\.(xml|rels)$/.test(n) && new DOMParser().parseFromString(t, 'application/xml').getElementsByTagName('parsererror').length).map(([n]) => n), Object.entries(parts).filter(([n]) => /\.(xml|rels)$/.test(n)).map(([n, b]) => [n, b.toString('utf8')]));
check(!bad.length, `every XML part is well formed${bad.length ? ': ' + bad.join(', ') : ''}`);
const docXml = parts['word/document.xml'].toString();
check(/<w:pgSz w:w="12240" w:h="15840"\/>/.test(docXml) && /w:left="737"/.test(docXml) && /<w:tbl>/.test(docXml) && /<w:hyperlink /.test(docXml) && /<w:drawing>/.test(docXml) && /w:type="page"/.test(docXml) && /<w:u w:val="single"\/>/.test(docXml) && /Heading1/.test(docXml) && /descr="Black mould/.test(docXml), 'Letter, narrow margins, a table, a hyperlink, a picture with its description, a page break, underline and a heading style');
check(/PAGE/.test(parts['word/footer1.xml'].toString()) && /Flat 4 repairs/.test(parts['word/footer1.xml'].toString()) && /Private and confidential/.test(parts['word/header1.xml'].toString()), 'the footer has his line and Word’s own page fields, the header his line');
const parsed = await page.evaluate(async (b64) => {
  await new Promise((ok, no) => { if (window.mammoth) return ok(); const s = document.createElement('script'); s.src = '/vendor/mammoth/mammoth.browser.min.js'; s.onload = ok; s.onerror = no; document.head.append(s); });
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return (await window.mammoth.convertToHtml({ arrayBuffer: bytes.buffer })).value;
}, word.bytes.toString('base64'));
check(/<h1>Notice of repairs<\/h1>/.test(parsed) && /<strong>within 14 days<\/strong>/.test(parsed) && /<a href="https:\/\/gov.uk\/private-renting">Khan<\/a>/.test(parsed) && /<table>/.test(parsed) && /<td><p>Emulsion<\/p><\/td>|Emulsion/.test(parsed) && /<img [^>]*alt="Black mould/.test(parsed) && /<ul><li>Repair the wall/.test(parsed), 'an independent parser (mammoth) reads the heading, bold, the link, the table, the picture and its description, the list');
// import it again: the same page
await page.locator('.dcbar button', { hasText: 'MY DOCUMENTS' }).click();
await page.setInputFiles('.dcsheet input[type=file][accept*=".docx"]', { name: 'Repairs back.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: word.bytes });
check(await until(page, () => window.__ghosty?.docs?.view === 'doc' && JSON.parse(window.__ghosty.docs.json).title === 'Repairs letter' && JSON.parse(window.__ghosty.docs.json).blocks.some((b) => b.t === 'table')), 'IMPORT reads the .docx back: its title and table');
s = await docs(page);
const back = s.doc;
const ft = back.blocks.find((b) => b.t === 'table');
check(back.blocks[0].t === 'h1' && back.blocks[0].align === 'center' && back.blocks.some((b) => b.t === 'img' && b.alt?.startsWith('Black mould')) && ft?.head === true && ft.rows[0][0][0].text === 'Item' && back.page.size === 'letter' && back.page.margin === 'narrow' && back.page.footer === 'Flat 4 repairs' && back.page.header === 'Private and confidential' && back.page.numbers === true && back.blocks.some((b) => b.t === 'pb') && back.blocks.flatMap((b) => b.runs).some((r) => r.href === 'https://gov.uk/private-renting' && r.text === 'Khan'), `the same page comes back: ${back.blocks.map((b) => b.t).join(',')} ${JSON.stringify(back.page)}`);
await until(page, () => document.querySelector('.dcpage figure img')?.naturalWidth > 0);
// a .docx made independently of our writer
await page.locator('.dcbar button', { hasText: 'MY DOCUMENTS' }).click();
await page.setInputFiles('.dcsheet input[type=file][accept*=".docx"]', { name: 'Tenancy notes.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: handmadeDocx() });
check(await until(page, () => window.__ghosty?.docs?.view === 'doc' && JSON.parse(window.__ghosty.docs.json).title === 'Tenancy notes'), 'a Word file built by hand is read: its Title is the title');
s = await docs(page);
const hm = s.doc;
const hr = hm.blocks.flatMap((b) => b.runs);
check(hm.blocks[0].t === 'h1' && hm.blocks[0].runs[0].text === 'Repairs' && hm.blocks[1].align === 'center' && hr.some((r) => r.b && r.text.startsWith('Bold start')) && hr.some((r) => r.u && r.text.startsWith('underlined')) && hr.some((r) => r.href === 'https://www.gov.uk/private-renting' && r.text === 'a link'), `its heading, alignment, bold, underline and link: ${JSON.stringify(hm.blocks.slice(0, 2).map((b) => [b.t, b.align]))}`);
check(hm.blocks.some((b) => b.t === 'ul' && b.runs[0].text === 'First bullet') && hm.blocks.some((b) => b.t === 'ol' && b.runs[0].text === 'First number'), 'bullets and counted lists by their numbering');
const ht = hm.blocks.find((b) => b.t === 'table');
check(ht?.head === true && ht.rows.length === 2 && ht.rows[1][1][0].text === 'Leak', 'its table with the header row');
const hi = hm.blocks.find((b) => b.t === 'img');
check(hi && hi.alt === 'A tiny test picture' && hi.w >= 10 && hm.blocks.some((b) => b.t === 'pb') && hm.blocks.at(-1).runs[0].text === 'After the break.', 'its picture with the description, the page break, the last paragraph');
check(hm.page.size === 'letter' && hm.page.landscape === true && hm.page.footer === 'Confidential' && hm.page.numbers === true, `its Letter landscape page and footer with the page field: ${JSON.stringify(hm.page)}`);
check(/Kept in My documents/.test(await page.locator('.dcstatus').textContent()), 'an imported Word file is kept in My documents');
await page.screenshot({ path: `${out}/docs-import.png` });

// export PDF of the first document
await page.locator('.dcbar button', { hasText: 'MY DOCUMENTS' }).click();
await page.locator('.dcopen', { hasText: 'Repairs letter' }).first().click();
await until(page, () => document.querySelector('.dcpage figure img')?.naturalWidth > 0);
const pdf = await saved(page, async () => {
  await page.locator('.dcexport button', { hasText: 'PDF' }).click();
  await page.waitForSelector('.dcouts .cvoutt b:text-is("Repairs letter.pdf")');
  await page.locator('.dcouts button', { hasText: 'SAVE' }).click();
});
const pt = pdf.bytes.toString('latin1');
check(pt.startsWith('%PDF-1.4') && /\/MediaBox \[0 0 612 792\]/.test(pt) && /\(Flat 4 repairs/.test(pt) && /\(Private and confidential/.test(pt) && /DCTDecode/.test(pt) && /\(Item\)|\(Item/.test(pt) && /1 of \d/.test(pt), `the PDF is Letter, has the header, the footer with its number, the table's words and the picture (${pdf.bytes.length} bytes)`);
const md = await saved(page, async () => {
  await page.locator('.dcexport button', { hasText: 'MARKDOWN' }).click();
  await page.waitForSelector('.dcouts .cvoutt b:text-is("Repairs letter.md")');
  await page.locator('.dcouts button', { hasText: 'SAVE' }).click();
});
check(/\| Item \|/.test(md.bytes.toString()) && /\| --- \|/.test(md.bytes.toString()) && /\[Khan\]\(https:\/\/gov.uk\/private-renting\)/.test(md.bytes.toString()), 'Markdown has the table and the link');
const benchMs = Date.now() - T0;

// 5. Ghosty in it
await page.locator('.dcpage .dcb', { hasText: 'Please fix it' }).click();
await page.fill('input[aria-label="What Ghosty should write into the document"]', 'a paragraph on next steps');
await page.locator('.dcwrite button', { hasText: 'WRITE INTO IT' }).click();
check(await until(page, () => /Please reply within 14 days/.test(JSON.parse(window.__ghosty.docs.json).blocks.map((b) => b.runs?.map((r) => r.text).join('')).join('\n')), null, 30000), 'WRITE INTO IT lays the brain’s words into the page');
s = await docs(page);
const at = s.doc.blocks.findIndex((b) => b.runs?.some((r) => /^Please reply within 14 days/.test(r.text)));
const prevI = s.doc.blocks.findIndex((b) => b.runs?.some((r) => /Please fix it/.test(r.text)));
check(at === prevI + 2 && s.doc.blocks[prevI + 1].t === 'h2' && s.doc.blocks.some((b) => b.t === 'ul' && b.runs.some((r) => r.b && r.text === 'damp')) && !JSON.stringify(s.doc).includes('Sure, here you go') && !JSON.stringify(s.doc).includes('Want me to make it firmer'), 'after the paragraph he was in, as a heading, a paragraph and a list with its bold, the chatter gone');
await key(page, 'UNDO').click();
check(!JSON.stringify((await docs(page)).doc).includes('Please reply within 14 days'), 'UNDO takes Ghosty’s words out again');
await page.locator('.dcpage .dcb', { hasText: 'Please fix it' }).click();
await page.locator('.dcwrite button', { hasText: 'REWRITE THIS PARAGRAPH' }).click();
check(await until(page, () => (window.__ghosty.docs.suggestions ?? []).some((x) => /Please arrange the repair/.test(x.new)), null, 30000), 'REWRITE THIS PARAGRAPH brings one suggestion');
await page.locator('.dcsug button', { hasText: 'ACCEPT' }).first().click();
check(JSON.stringify((await docs(page)).doc).includes('Please arrange the repair within 14 days.'), 'accepted, it changes the paragraph');
await page.screenshot({ path: `${out}/docs-ghosty.png` });

// OPEN on the Stage's letter
await page.evaluate(() => document.querySelector('.modal .mhead button')?.click());
await page.evaluate(() => (location.hash = 'core'));
await page.waitForSelector('#cin', { state: 'visible', timeout: 15000 }).catch(async () => { await page.locator('.logbtn:visible').first().click().catch(() => undefined); });
const ndjson = (events) => events.map((e) => JSON.stringify(e)).join('\n') + '\n';
const reply = 'Dear Mr Smith,\n\nI am writing about the damp in the bedroom, which has got worse since October and needs fixing now.\n\nYours sincerely,\nBoss';
await page.route('**/api/chat', (r) => r.continue({ url: `${base}/__test/stream?lines=${encodeURIComponent(Buffer.from(ndjson([{ t: 'status', text: 'thinking…' }, { t: 'text', text: reply }, { t: 'done', model: 'Mock · scripted' }])).toString('base64'))}` }));
for (let i = 0; i < 6 && !(await page.locator('#cin:visible').count()); i++) {
  await page.locator('.logbtn:visible').first().click({ timeout: 2000 }).catch(() => undefined);
  await page.evaluate(() => document.querySelector('.logbtn')?.click());
  await page.waitForTimeout(500);
}
await page.fill('#cin', 'write a letter to my landlord about the damp');
await page.keyboard.press('Enter');
check(await until(page, () => document.querySelector('#thestage')?.dataset.kind === 'document', null, 20000), 'the Stage shows the letter');
await page.click('#thestage button[aria-label^="Open"]');
check(await until(page, () => !!document.querySelector('.modal .dcsheet .dcpage') && /Dear Mr Smith/.test(window.__ghosty?.docs?.text ?? ''), null, 15000) && await page.locator('.modal .dcpill').count() === 3 && await page.locator('.modal .dcwrite').count() === 1, 'OPEN on the Stage opens this same editor, with its keys and Ghosty’s box');
await page.screenshot({ path: `${out}/docs-stage-open.png` });
await ctx.close();

// 6. the three worlds and the phone
const sizes = async (pg, where) => pg.evaluate((w) => {
  const bad = [];
  for (const b of document.querySelectorAll(`${w} :is(button, select, input:not([type=hidden]):not([type=file])):not([hidden])`)) {
    if (!b.getClientRects().length) continue;
    const r = b.getBoundingClientRect();
    if (r.width && (r.height < 43.5 || (b.tagName === 'BUTTON' && r.width < 43.5))) bad.push(`${b.tagName} "${(b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 18)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
  }
  const side = document.documentElement.scrollWidth > innerWidth + 1 || document.body.scrollWidth > innerWidth + 1;
  const names = [...document.querySelectorAll(`${w} :is(button, input, select):not([type=hidden])`)].filter((e) => e.getClientRects().length && !((e.getAttribute('aria-label') || e.textContent || '').trim())).map((e) => e.outerHTML.slice(0, 60));
  return { bad, side, names };
}, where);
for (const [look, name, viewport] of [[SCAN, 'scan', PHONE], [GLASS, 'glass', PHONE], [INK, 'ink', PHONE], [SCAN, 'scan390', { width: 390, height: 844 }]]) {
  const { ctx: c2, page: p2 } = await open({ look, viewport });
  await goDocs(p2);
  await p2.locator('#pg-docs .dcbar button', { hasText: 'NEW' }).click();
  await until(p2, () => window.__ghosty?.docs?.view === 'doc');
  await p2.locator('.dcpage .dcb').first().click();
  await p2.keyboard.type('A line');
  for (const [pn, extra] of [['write', null], ['insert', async () => { await key(p2, 'INSERT TABLE').click(); await until(p2, () => document.querySelectorAll('.dcpage .dctable td').length > 0); await p2.locator('.dcpage .dctable td').first().click(); }], ['page', null]]) {
    await pill(p2, pn);
    if (extra) await extra();
    await p2.waitForTimeout(250);
    const r = await sizes(p2, '#pg-docs .dcsheet');
    check(!r.bad.length && !r.side && !r.names.length, `${name} ${pn}: every key 44 pt, nothing sideways, every control named${r.bad.length ? ': ' + r.bad.slice(0, 4).join(' | ') : ''}${r.side ? ' (sideways)' : ''}${r.names.length ? ': ' + r.names.join(' | ') : ''}`);
  }
  await p2.screenshot({ path: `${out}/docs-${name}.png` });
  await c2.close();
}
console.log(`sizes: .docx ${word.bytes.length} bytes, .pdf ${pdf.bytes.length} bytes, the photo (${(await jpeg0).length} bytes made here) shrunk to 1280×720 ${shrunk} bytes; the editor opens in ${openMs} ms; the words typed are kept ${keyMs} ms after the last key (the 450 ms wait is in it)`);
console.log(`benchmark (the letter with a table, a photo and a footer, written, styled, exported and read back, by the spec): ${benchMs} ms`);
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'DOCUMENTS ran clean: write, format, link, photo, table, page, find and replace, count, undo and redo, autosave and reopen, Word and PDF out and Word in (ours and a hand-built file), Ghosty writing in, OPEN from the Stage, three worlds at 440 and 390.');
process.exit(problems.length ? 1 : 0);
