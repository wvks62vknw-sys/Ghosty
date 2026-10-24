// Ghosty's library in a real browser:
//  1. the document reader (no libraries, no AI) on a real PDF printed by Chromium, a Word file and an e-book
//  2. the Library tab: add files, see them on the shelf, search them (no AI)
//  3. SELF-STUDY at 440 × 956 (the iPhone 18 Pro Max): the queue and its status line, STUDY on a picked field
//     (through the mock brain), the STUDY ALL switch remembered after a reload, nothing sideways, 44 px targets
//   node tests/library.spec.mjs [outDir]
import { chromium } from 'playwright';
import { isWebKit, launch, webkitNoise } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { deflateRawSync, crc32 } from 'node:zlib';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const root = new URL('..', import.meta.url).pathname;
const esbuild = createRequire(`${root}apps/web/package.json`)('esbuild');
const problems = [];

// The reader, bundled on its own so it can be tested without signing in.
const reader = esbuild.buildSync({
  stdin: { contents: "import * as X from './src/library/extract.ts'; import { chunkText } from '../../packages/shared/src/chunk.ts'; window.__lib = { ...X, chunkText };", resolveDir: `${root}apps/web`, loader: 'ts' },
  bundle: true, format: 'iife', write: false, target: 'es2022',
}).outputFiles[0].text;

// ---------- test documents ----------
function zip(files) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const data = Buffer.from(text);
    const comp = deflateRawSync(data);
    const nameB = Buffer.from(name);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameB.length, 26);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(8, 10);
    cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(comp.length, 20); cd.writeUInt32LE(data.length, 24); cd.writeUInt16LE(nameB.length, 28); cd.writeUInt32LE(offset, 42);
    locals.push(local, nameB, comp);
    central.push(cd, nameB);
    offset += 30 + nameB.length + comp.length;
  }
  const cdBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cdBuf.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cdBuf, end]);
}

const docx = zip({
  '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
  'docProps/core.xml': '<?xml version="1.0"?><cp:coreProperties xmlns:cp="x" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Fishing Handbook</dc:title></cp:coreProperties>',
  'word/document.xml': '<?xml version="1.0"?><w:document xmlns:w="w"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Knots</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">The improved clinch knot </w:t></w:r><w:r><w:t>holds hooks &amp; lures securely.</w:t></w:r></w:p></w:body></w:document>',
});
const epub = zip({
  mimetype: 'application/epub+zip',
  'META-INF/container.xml': '<?xml version="1.0"?><container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>',
  'OEBPS/content.opf': '<?xml version="1.0"?><package><metadata><dc:title>Lighthouse Tales</dc:title></metadata><manifest><item id="c1" href="one.xhtml"/><item id="c2" href="two.xhtml"/></manifest><spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>',
  'OEBPS/one.xhtml': '<html><body><h1>Chapter One</h1><p>The keeper climbed one hundred and twelve steps every night.</p></body></html>',
  'OEBPS/two.xhtml': '<html><body><h1>Chapter Two</h1><p>A storm broke the great lens in the winter of 1887.</p></body></html>',
});

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined });

// A real-world PDF: Chromium prints it (compressed streams, embedded subset fonts, ToUnicode maps). Only Chromium
// prints to PDF, so a WebKit run borrows it for this one page (set CHROMIUM when it is installed elsewhere).
const press = isWebKit ? await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined }) : browser;
const printer = await press.newPage();
await printer.setContent(`<html><body style="font-family: Georgia, serif">
  <h1>Volcano Field Notes</h1>
  <p>The quick brown fox jumps over the lazy dog near the crater rim.</p>
  <p>Basaltic lava flows faster than rhyolitic lava because it has less silica.</p>
  <div style="page-break-before: always"></div>
  <h2>Safety</h2>
  <p>Always carry a gas mask: sulphur dioxide levels rise without warning.</p>
  <p style="font-family: Arial">Emergency frequency is 156.8 MHz — call the station on channel 16.</p>
</body></html>`);
const pdf = await printer.pdf({ format: 'A4' });
// A photo of a page (printed words on white), for the Library's own reading of photos.
await printer.setViewportSize({ width: 900, height: 700 });
await printer.setContent('<html><body style="background:#fff;margin:48px;font:28px Georgia"><h1>Quillwort revision card</h1><p>Osmosis is the movement of water across a partially permeable membrane.</p></body></html>');
const photo = await printer.screenshot({ type: 'jpeg', quality: 90 });
await printer.close();
if (press !== browser) await press.close();

// ---------- 1. the reader ----------
const page = await browser.newPage({ ...UK });
page.on('pageerror', (e) => webkitNoise(e) || problems.push(`reader pageerror: ${e.message}`));
await page.setContent('<html><body></body></html>');
await page.addScriptTag({ content: reader });
const read = (fn, bytes, title) => page.evaluate(async ([fn, b64, title]) => {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const x = await window.__lib[fn](bytes, title);
  return { ...x, passages: window.__lib.chunkText(x.pages).length };
}, [fn, Buffer.from(bytes).toString('base64'), title]);

const p = await read('extractPdf', pdf, 'volcano');
const pdfText = p.pages.join('\n');
if (p.pages.length !== 2) problems.push(`PDF: expected 2 pages, got ${p.pages.length}`);
for (const s of ['Volcano Field Notes', 'The quick brown fox jumps over the lazy dog near the crater rim.', 'Basaltic lava flows faster than rhyolitic lava', 'sulphur dioxide levels rise without warning', 'Emergency frequency is 156.8 MHz']) {
  if (!pdfText.replace(/\s+/g, ' ').includes(s)) problems.push(`PDF text is missing "${s}". Got: ${pdfText.slice(0, 300).replace(/\n/g, ' | ')}`);
}
if (!/sulphur/.test(p.pages[1] ?? '')) problems.push('PDF: page 2 text not on page 2');
if (p.warning) problems.push(`PDF: unexpected warning "${p.warning}"`);

const d = await read('extractDocx', docx, 'fishing');
if (d.title !== 'Fishing Handbook' || !d.pages[0].includes('# Knots') || !d.pages[0].includes('The improved clinch knot holds hooks & lures securely.')) problems.push(`Word: got ${JSON.stringify(d).slice(0, 300)}`);

// A classic PDF: standard Type 1 font, no ToUnicode map, kerning arrays (TJ), a /Differences glyph (fi).
const classic = Buffer.from(['%PDF-1.4',
  '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
  '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
  '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >> endobj',
  '4 0 obj << /Length 120 >>', 'stream',
  'BT /F1 12 Tf 72 720 Td [(Hello) -250 (W) 80 (orld)] TJ 0 -14 Td (Second line \\(ok\\) to \\037nd caf\\351.) Tj ET',
  'endstream', 'endobj',
  '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding << /Type /Encoding /BaseEncoding /WinAnsiEncoding /Differences [31 /fi] >> >> endobj',
  'trailer << /Root 1 0 R >>', '%%EOF'].join('\n'), 'latin1');
const c = await read('extractPdf', classic, 'classic');
if (c.pages[0] !== 'Hello World\nSecond line (ok) to find café.') problems.push(`classic PDF: got ${JSON.stringify(c.pages[0])}`);

const e = await read('extractEpub', epub, 'lighthouse');
if (e.title !== 'Lighthouse Tales' || e.pages.length !== 2 || !e.pages[1].includes('A storm broke the great lens')) problems.push(`E-book: got ${JSON.stringify(e).slice(0, 300)}`);
await page.close();

// ---------- 2. the Library tab ----------
/** Wait for a library search to finish (its panel says "searching…" until the results are in). */
const searched = (ui) =>
  ui
    .waitForFunction(() => !/searching/.test(document.querySelector('#pg-library .pn.ask h3 small')?.textContent ?? 'searching'), null, { timeout: 10000 })
    .catch(() => undefined);

for (const viewport of [{ width: 1280, height: 860 }, PHONE]) {
  const name = viewport.width < 600 ? 'phone' : 'desktop';
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, ...UK });
  const ui = await ctx.newPage();
  ui.on('pageerror', (er) => webkitNoise(er) || problems.push(`[${name}] pageerror: ${er.message}`));
  ui.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/.test(m.text())) problems.push(`[${name}] console: ${m.text()}`);
  });
  await ui.goto(base, { waitUntil: 'domcontentloaded' });
  await ui.waitForSelector('#pair input', { timeout: 15000 });
  await ui.fill('#pair input', 'preview-owner-key-0123456789');
  await ui.click('#pair button.on');
  await ui.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
  await ui.evaluate(() => (location.hash = 'library'));
  await ui.waitForFunction(() => /PASSAGES/.test(document.querySelector('#pg-library .bigv')?.textContent ?? ''), null, { timeout: 15000 }).catch(() => problems.push(`[${name}] library tab never loaded`));
  // starter library fills in by itself
  await ui.waitForFunction(() => !/setting up starter/.test(document.querySelector('#pg-library .sub')?.textContent ?? ''), null, { timeout: 30000 }).catch(() => problems.push(`[${name}] starter library never finished`));
  if (name === 'desktop') {
    await ui.setInputFiles('#pg-library input[type=file]', [
      { name: 'volcano-notes.pdf', mimeType: 'application/pdf', buffer: pdf },
      { name: 'fishing.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: docx },
      { name: 'recipes.md', mimeType: 'text/markdown', buffer: Buffer.from('# Pancakes\n\nWhisk two eggs with 100 g flour and 300 ml milk; rest the batter for 20 minutes.') },
    ]);
    await ui.waitForFunction(() => document.querySelectorAll('#pg-library .liblog .note.ok').length >= 3 || document.querySelector('#pg-library .liblog .note.bad'), null, { timeout: 20000 }).catch(() => undefined);
    const log = await ui.$$eval('#pg-library .liblog .note', (n) => n.map((x) => x.textContent));
    if (log.filter((l) => l.startsWith('✓')).length < 3) problems.push(`[${name}] uploads: ${log.join(' | ')}`);
  }
  // search (no AI)
  await ui.fill('#pg-library input[aria-label="Search the library"]', 'sulphur dioxide gas mask');
  await ui.keyboard.press('Enter');
  await searched(ui);
  const res = await ui.$$eval('#pg-library .rw.hit', (n) => n.map((x) => x.textContent));
  if (!res.length || !/Volcano/i.test(res[0])) problems.push(`[${name}] search found: ${res.slice(0, 2).join(' || ') || 'nothing'}`);
  if (name === 'desktop') {
    // The whole library is copied to this device and answers with no connection at all.
    await ui.waitForFunction(() => /on this device \(works offline\)/.test(document.querySelector('#pg-library .sub')?.textContent ?? ''), null, { timeout: 30000 }).catch(() => problems.push(`[${name}] the library was never copied to the device: ${'' }`));
    await ctx.setOffline(true);
    await ui.fill('#pg-library input[aria-label="Search the library"]', 'binary search');
    await ui.keyboard.press('Enter');
    await searched(ui);
    const off = await ui.$$eval('#pg-library .rw.hit', (n) => n.map((x) => x.textContent));
    if (!off.length) problems.push(`[${name}] offline library search found nothing`);
    await ui.evaluate(() => (location.hash = 'core'));
    await ui.fill('#cin', 'pancake batter eggs flour milk');
    await ui.keyboard.press('Enter');
    await ui.waitForFunction(() => /library on this device/i.test(document.body.textContent ?? ''), null, { timeout: 10000 }).catch(() => problems.push(`[${name}] no offline answer from the library in chat`));
    const said = await ui.evaluate(() => /Whisk two eggs/.test(document.body.textContent ?? ''));
    if (!said) problems.push(`[${name}] the offline answer didn't quote the uploaded recipe`);
    await ui.screenshot({ path: `${out}/${name}-library-offline.png` });
    await ctx.setOffline(false);
    await ui.evaluate(() => (location.hash = 'library'));
    await ui.fill('#pg-library input[aria-label="Search the library"]', 'sulphur dioxide gas mask');
    await ui.keyboard.press('Enter');
    await searched(ui);
  }
  // ---- SELF-STUDY: what Ghosty learns on its own, with the owner's focus; and the reader
  const study = await ui.evaluate(() => {
    const pn = document.querySelector('#pg-library .pn.study');
    if (!pn) return null;
    return {
      status: pn.querySelector('h3 small')?.textContent ?? '',
      bars: [...pn.querySelectorAll('.bar')].map((b) => b.textContent?.trim() ?? ''),
      fields: [...pn.querySelectorAll('.studyfields .bar span')].map((b) => b.textContent?.trim() ?? ''),
      buttons: [...pn.querySelectorAll('button')].map((b) => b.textContent?.trim()),
    };
  });
  if (!study) problems.push(`[${name}] no SELF-STUDY panel`);
  else {
    if (!/LEARNING/.test(study.status)) problems.push(`[${name}] self-study status "${study.status}"`);
    if (!study.bars.some((b) => /^READ.*topics$/.test(b))) problems.push(`[${name}] no READ progress: ${study.bars.join(' | ')}`);
    if (study.fields.length < 1) problems.push(`[${name}] no fields in the study panel: ${study.bars.join(' | ')}`);
    for (const b of ['TURN OFF', 'STUDY', 'STUDY ALL: ON', 'EXPORT TO GITHUB', 'FOCUS']) if (!study.buttons.includes(b)) problems.push(`[${name}] no ${b} button (${study.buttons.join(', ')})`);
    const field = study.fields[0].replace(/^★ /, '').replace(/^✓ /, '');
    await ui.fill('#pg-library input[aria-label="Fields to study first"]', field);
    await ui.click('#pg-library .pn.study button:has-text("FOCUS")');
    await ui.waitForFunction((f) => [...document.querySelectorAll('#pg-library .pn.study .rw')].some((r) => r.querySelector('.k')?.textContent === 'FIRST' && (r.textContent ?? '').includes(f)), field, { timeout: 8000 }).catch(() => problems.push(`[${name}] FOCUS "${field}" did not put that field first`));
  }
  if (name === 'phone' && study) {
    // ---- STUDY at scale: one field at a time, its honest status line, STUDY on a picked field, STUDY ALL remembered
    const nowLine = () => ui.evaluate(() => document.querySelector('#pg-library .pn.study .studynow b')?.textContent ?? '');
    const line0 = await nowLine();
    if (!/^Reading .+ · \d+ of \d+ · /.test(line0)) problems.push(`[${name}] the queue's status line reads "${line0}"`);
    const options = await ui.$$eval('#pg-library .pn.study select[aria-label="Field to study"] option', (o) => o.map((x) => ({ value: x.value, text: x.textContent ?? '' })));
    if (options.length < 10) problems.push(`[${name}] the topic picker has ${options.length} fields`);
    const target = options.find((o) => o.value === 'algebra-number-theory') ?? options[1];
    if (target) {
      const fieldName = target.text.split(' · ')[0];
      await ui.selectOption('#pg-library .pn.study select[aria-label="Field to study"]', target.value);
      // STUDY posts the pick as the first focus and reads a few pieces at once; on a loaded runner that request can
      // fail to reach the brain (the button's own toast says so), so the brain's focus is checked and one more tap
      // is allowed before it counts as a failure (PR #36's run: the pick never showed, the brain's focus unchanged).
      const studyState = () => ui.evaluate(async () => (await fetch('/api/library/study', { headers: { 'x-ghosty': '1', 'x-ghosty-key': 'preview-owner-key-0123456789' } })).json().catch(() => null));
      const picked = async () => (((await studyState())?.focus ?? [])[0] === target.value);
      await ui.click('#pg-library .pn.study .studypick button:has-text("STUDY")');
      await ui.waitForFunction((id) => !!document.querySelector('#pg-library .pn.study .studypick button:not([disabled])') && id, target.value, { timeout: 120000 }).catch(() => undefined);
      if (!(await picked())) {
        console.log(`[${name}] STUDY needed a second tap (the brain's focus did not change on the first)`);
        await ui.click('#pg-library .pn.study .studypick button:has-text("STUDY")');
      }
      await ui.waitForFunction((f) => (document.querySelector('#pg-library .pn.study .studynow b')?.textContent ?? '').startsWith(`Reading ${f} · `), fieldName, { timeout: 150000 })
        .catch(async () => problems.push(`[${name}] STUDY did not queue "${fieldName}": "${await nowLine()}" · brain focus ${JSON.stringify((await studyState())?.focus ?? null)} queue ${JSON.stringify((await studyState())?.queue ?? null)}`));
      const first = await ui.evaluate(() => [...document.querySelectorAll('#pg-library .pn.study .rw')].find((r) => r.querySelector('.k')?.textContent === 'FIRST')?.textContent ?? '');
      if (!first.includes(fieldName)) problems.push(`[${name}] the field sent with STUDY is not first: "${first}"`);
    }
    // the STUDY ALL switch: off, and still off after a reload (the brain remembers it)
    const sw = '#pg-library .pn.study button.studyall';
    if ((await ui.getAttribute(sw, 'aria-checked')) !== 'true') problems.push(`[${name}] STUDY ALL is not on by default`);
    await ui.click(sw);
    await ui.waitForFunction((s) => document.querySelector(s)?.getAttribute('aria-checked') === 'false', sw, { timeout: 15000 }).catch(() => problems.push(`[${name}] STUDY ALL did not switch off`));
    await ui.reload({ waitUntil: 'domcontentloaded' });
    await ui.waitForSelector('#boot', { state: 'detached', timeout: 15000 }).catch(() => undefined);
    await ui.evaluate(() => (location.hash = 'library'));
    await ui.waitForSelector(sw, { timeout: 20000 }).catch(() => problems.push(`[${name}] no STUDY ALL switch after a reload`));
    const kept = await ui.getAttribute(sw, 'aria-checked').catch(() => null);
    if (kept !== 'false') problems.push(`[${name}] STUDY ALL was not remembered after a reload (${kept})`);
    if (!/STUDY ALL: OFF/.test((await ui.textContent(sw).catch(() => '')) ?? '')) problems.push(`[${name}] the switch does not say OFF`);
    // nothing sticks out sideways at 440 px, and every target is 44 px tall
    const fit = await ui.evaluate(() => {
      const pn = document.querySelector('#pg-library .pn.study');
      pn?.scrollIntoView({ block: 'start' });
      const wide = [...(pn?.querySelectorAll('*') ?? [])].filter((el) => el.getBoundingClientRect().right > innerWidth + 1).map((el) => `${el.tagName.toLowerCase()}.${el.className}`);
      const small = [...(pn?.querySelectorAll('button, select, input') ?? [])].filter((el) => el.getBoundingClientRect().height && el.getBoundingClientRect().height < 43.5).map((el) => `${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || '').trim()}" ${Math.round(el.getBoundingClientRect().height)}px`);
      return { page: document.documentElement.scrollWidth - innerWidth, wide: wide.slice(0, 5), small: small.slice(0, 5) };
    });
    if (fit.page > 0 || fit.wide.length) problems.push(`[${name}] SELF-STUDY sticks out sideways: page ${fit.page}px, ${fit.wide.join(', ')}`);
    if (fit.small.length) problems.push(`[${name}] targets under 44 px: ${fit.small.join(', ')}`);
    await ui.waitForTimeout(300);
    await ui.locator('#pg-library .pn.study').screenshot({ path: `${out}/${name}-study.png` });
    // back on, as it was
    await ui.click(sw);
    await ui.waitForFunction((s) => document.querySelector(s)?.getAttribute('aria-checked') === 'true', sw, { timeout: 15000 }).catch(() => problems.push(`[${name}] STUDY ALL did not switch back on`));
  }
  if (name === 'phone') {
    // ---- a photo of a page: the picker offers photos, the phone reads the words itself, it is kept and found by them
    const accept = (await ui.getAttribute('#pg-library input[type=file]', 'accept')) ?? '';
    if (!/image\/\*/.test(accept)) problems.push(`[${name}] the Library's picker does not offer photos (accept "${accept.slice(0, 60)}…")`);
    await ui.setInputFiles('#pg-library input[type=file]', [{ name: 'IMG_4471.jpg', mimeType: 'image/jpeg', buffer: photo }]);
    const photoLine = () => ui.evaluate(() => [...document.querySelectorAll('#pg-library .liblog .note')].map((n) => n.textContent ?? '').find((t) => /IMG_4471|Quillwort/i.test(t)) ?? '');
    await ui.waitForFunction(() => [...document.querySelectorAll('#pg-library .liblog .note')].some((n) => /IMG_4471|Quillwort/i.test(n.textContent ?? '') && /^[✓✕]/.test(n.textContent ?? '')), null, { timeout: 150000 }).catch(() => undefined);
    const said = await photoLine();
    if (!/^✓ .*Quillwort/i.test(said)) problems.push(`[${name}] a photo of a page was not read into the library: "${said}"`);
    else {
      await ui.fill('#pg-library input[aria-label="Search the library"]', 'quillwort osmosis membrane');
      await ui.keyboard.press('Enter');
      await searched(ui);
      const found = await ui.$$eval('#pg-library .rw.hit', (n) => n.map((x) => x.textContent ?? ''));
      if (!found.some((t) => /Quillwort/i.test(t) && /membrane/i.test(t))) problems.push(`[${name}] the photo's words are not found by a search: ${found.slice(0, 2).join(' || ') || 'nothing'}`);
    }
    // leave the preview as it was: the photo's document goes again
    await ui.evaluate(async () => {
      const H = { 'x-ghosty': '1', 'x-ghosty-key': 'preview-owner-key-0123456789' };
      const lib = await (await fetch('/api/library', { headers: H })).json().catch(() => ({ docs: [] }));
      for (const d of lib.docs ?? []) if (/Quillwort/i.test(d.title)) await fetch(`/api/library/docs/${encodeURIComponent(d.id)}`, { method: 'DELETE', headers: H });
    });
  }
  // any document on the shelf opens in the reader
  const shelfRow = await ui.$('#pg-library .pn .rw.link .v');
  if (!shelfRow) problems.push(`[${name}] no readable document on the shelf`);
  else {
    const title = (await shelfRow.textContent())?.trim();
    await shelfRow.click();
    await ui.waitForSelector('.modal .reader p', { timeout: 8000 }).catch(() => problems.push(`[${name}] the reader did not open for "${title}"`));
    const shown = await ui.evaluate(() => ({ title: document.querySelector('.modal .mhead b')?.textContent, words: (document.querySelector('.modal .reader')?.textContent ?? '').length }));
    if (shown.title !== title || shown.words < 40) problems.push(`[${name}] reader shows ${JSON.stringify(shown)} for "${title}"`);
    if (name === 'phone') await ui.screenshot({ path: `${out}/${name}-library-reader.png` });
    await ui.click('.modal .mhead button');
    await ui.waitForSelector('.modal', { state: 'detached', timeout: 5000 }).catch(() => problems.push(`[${name}] the reader did not close`));
  }
  const askH = await ui.$eval('#pg-library .pn.ask > .bd', (el) => el.clientHeight);
  if (askH < 260) problems.push(`[${name}] the ASK THE LIBRARY results area is squeezed (${askH}px tall)`);
  await ui.screenshot({ path: `${out}/${name}-library.png` });
  if (name === 'phone') {
    // One scrolling page on phones: scroll down to the shelf.
    const shelf = await ui.evaluate(() => {
      const pn = [...document.querySelectorAll('#pg-library .pn')].find((x) => x.querySelector('h3')?.textContent?.trim().startsWith('SHELF'));
      pn?.scrollIntoView({ block: 'end' });
      const r = pn?.getBoundingClientRect();
      return r ? { h: Math.round(r.height), bottom: Math.round(r.bottom), dock: Math.round(document.querySelector('nav')?.getBoundingClientRect().top ?? innerHeight) } : null;
    });
    if (!shelf || shelf.h < 220 || shelf.bottom > shelf.dock + 2) problems.push(`[${name}] shelf not reachable on the phone: ${JSON.stringify(shelf)}`);
    await ui.waitForTimeout(400);
    await ui.screenshot({ path: `${out}/${name}-library-shelf.png` });
  }
  await ctx.close();
}

await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'Library run clean: PDF, Word and e-book read in the browser; Library tab adds, lists and searches; the whole library is copied to the device and answers offline; SELF-STUDY shows the field being read with its honest status, STUDY queues a picked field, STUDY ALL is remembered, nothing sideways at 440 px, and it takes a focus; the reader opens any document.');
process.exit(problems.length ? 1 : 0);
