// BRIEF-REST-E (batch ⑧ part E) on the preview, a 390 × 844 phone:
//  1. THE CONVERTER (MAKE → CONVERT): the hub's CONVERT card opens the sheet; a JPG chosen is "a JPEG photo" with its
//     size, PICTURES INTO ONE PDF makes a PDF on the phone (SAVE gives a real PDF with the photo in it as it is); a CSV
//     becomes an Excel file with its header row; "3.5 miles in km" is answered in the chat with no model; a QR code is made.
//  2. DOCUMENTS (MAKE → DOCUMENTS): a PDF of words opened is read as a document (its title, its heading) and READ IT TO
//     ME speaks it (the voice stub); "write a letter to my landlord about the damp" in the chat: the brain's letter, its
//     card, OPEN lays it out (the chatter gone, the date in), exported as a PDF and a Word file; MAKE IT SHORTER brings
//     suggestions, one accepted changes the words; a translation into Urdu shows side by side, right to left.
//  3. THE RIGHTS-AND-LAW TOPICS: a question about stop and search is answered with its sources listed (each a primary
//     or credible page, with its tier); the Library's RIGHTS AND LAW opens a topic as a page of its documents.
// Nothing sideways at 390 × 844; VoiceOver names on every control; no security-policy refusal. The preview's brain is
// shared with the other specs: every check waits for what this spec itself posted, never for an empty brain.
//   BASE=http://localhost:8677 node tests/reste.spec.mjs tests/.shots
import { launch, webkitNoise } from './browser.mjs';
import { openSection, UK } from './nav.mjs';
import { mkdirSync, readFileSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const SIZE = { width: 390, height: 844 };

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const problems = [];
const check = (ok, msg) => {
  if (!ok) problems.push(msg);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
  return ok;
};
const until = (page, fn, arg, ms = 15000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);

/** The phone's own voice, stood in for (what was said is kept on the page). */
const STUBS = () => {
  window.__said = [];
  window.SpeechSynthesisUtterance = class {
    constructor(text) {
      Object.assign(this, { text, voice: null, lang: '', rate: 1, pitch: 1, volume: 1 });
    }
  };
  const synth = window.SpeechSynthesis?.prototype ?? window.speechSynthesis;
  synth.getVoices = () => [{ name: 'Daniel', lang: 'en-GB', voiceURI: 'Daniel', localService: true, default: true }];
  synth.speak = (u) => {
    if (u.text.trim()) window.__said.push(u.text);
    setTimeout(() => {
      u.onstart?.();
      setTimeout(() => u.onend?.(), 20);
    }, 5);
  };
  synth.cancel = () => undefined;
  synth.resume = () => undefined;
};

const wide = (page) => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1 || document.body.scrollWidth > innerWidth + 1);
/** What sticks out of the screen sideways (inside a scroller that clips it, it does not count). */
const sideways = (page, sel) =>
  page.$$eval(sel, (els) =>
    els
      .filter((e) => {
        if (!e.getClientRects().length || getComputedStyle(e).visibility === 'hidden') return false;
        const r = e.getBoundingClientRect();
        if (!r.width || r.bottom < 0 || r.top > innerHeight) return false;
        for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
          if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) {
            const pr = p.getBoundingClientRect();
            if (pr.left >= -1 && pr.right <= innerWidth + 1) return false;
          }
        }
        return r.left < -1 || r.right > innerWidth + 1;
      })
      .map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} "${(e.textContent || '').trim().slice(0, 24)}"`),
  );
/** Every button, field and frame in `sel` has a name VoiceOver reads. */
const unnamed = (page, sel) =>
  page.$$eval(`${sel} :is(button, input, select, textarea, iframe)`, (els) =>
    els.filter((e) => e.getClientRects().length && !((e.getAttribute('aria-label') || e.getAttribute('title') || e.textContent || '').trim() || e.closest('label'))).map((e) => e.outerHTML.slice(0, 80)),
  );
const looked = async (page, name) => {
  const s = await sideways(page, '.modal *');
  check(!s.length && !(await wide(page)), `${name}: nothing sideways at 390 × 844${s.length ? `: ${s.slice(0, 4).join(', ')}` : ''}`);
  const u = await unnamed(page, '.modal');
  check(!u.length, `${name}: every control has a name VoiceOver reads${u.length ? `: ${u.slice(0, 3).join(' | ')}` : ''}`);
};

const ctx = await browser.newContext({ viewport: SIZE, screen: SIZE, deviceScaleFactor: 3, isMobile: true, hasTouch: true, ...UK, serviceWorkers: 'block', acceptDownloads: true });
await ctx.addInitScript(STUBS);
const page = await ctx.newPage();
const policy = [];
page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => /Refused to|Content Security Policy/.test(m.text()) && policy.push(m.text().slice(0, 200)));
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#pair input', { timeout: 20000 });
await page.fill('#pair input', KEY);
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });

const say = async (words) => {
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForSelector('#cin', { state: 'visible', timeout: 15000 });
  await page.fill('#cin', words);
  await page.press('#cin', 'Enter');
};
/** The reply to the message just sent: the last of Ghosty's after the last of his, once it has words. */
const replyTo = (words, ms = 30000) =>
  until(page, (w) => {
    const all = [...document.querySelectorAll('#pg-core .msg')];
    const mine = all.map((m) => m.classList.contains('me') && (m.textContent ?? '').includes(w)).lastIndexOf(true);
    return mine >= 0 && all.slice(mine + 1).some((m) => !m.classList.contains('me') && (m.textContent ?? '').trim().length > 8);
  }, words, ms).then(() => page.evaluate((w) => {
    const all = [...document.querySelectorAll('#pg-core .msg')];
    const mine = all.map((m) => m.classList.contains('me') && (m.textContent ?? '').includes(w)).lastIndexOf(true);
    return all.slice(mine + 1).filter((m) => !m.classList.contains('me')).map((m) => m.textContent ?? '').join('\n');
  }, words));
const closeSheet = () => page.evaluate(() => document.querySelector('.modal .mhead button')?.click());
/** A file the spec saves (the sheet's SAVE): its name and bytes. */
async function saved(click) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), click()]);
  return { name: dl.suggestedFilename(), bytes: readFileSync(await dl.path()) };
}

// ================================================================ 1. THE CONVERTER
await page.evaluate(() => (location.hash = 'area-make'));
await page.waitForSelector('#pg-area-make .hubtile[data-id="convert"]', { timeout: 15000 });
check(await page.locator('#pg-area-make .hubmore .hubmini[data-id="docs"]').count() === 1, 'MAKE: CONVERT is a card, DOCUMENTS the seventh tool in the More row');
await page.click('#pg-area-make .hubtile[data-id="convert"]');
await page.waitForSelector('.modal .cvsheet', { timeout: 15000 });
check(/nothing is uploaded/i.test((await page.locator('.cvstatus').textContent()) ?? ''), 'the sheet says nothing is uploaded');
const lemon = readFileSync(new URL('./fixtures/lemon.jpg', import.meta.url));
await page.setInputFiles('.cvsheet input[type=file]', { name: 'lemon.jpg', mimeType: 'image/jpeg', buffer: lemon });
await page.waitForSelector('.cvfile', { timeout: 10000 });
const fileLine = (await page.locator('.cvfile').first().textContent()) ?? '';
check(/lemon\.jpg/.test(fileLine) && /a JPEG photo, \d+(\.\d)? KB/.test(fileLine), `what it is and its size: "${fileLine}"`);
const offered = await page.evaluate(() => window.__ghosty?.convert?.offered ?? []);
check(['img-png', 'img-resize', 'img-strip', 'images-pdf', 'code-read'].every((id) => offered.includes(id)) && !offered.includes('pdf-join'), `the conversions that apply to a photo: ${offered.join(', ')}`);
await looked(page, 'the converter');
await page.screenshot({ path: `${out}/reste-convert-offered.png` });
await page.click('.cvbtn[data-id="images-pdf"]');
await page.click('.cvgo');
check(await until(page, () => (window.__ghosty?.convert?.outputs ?? []).some((o) => o.type === 'application/pdf')), 'a JPG → PDF is made on the phone');
const pdfOut = await page.evaluate(() => window.__ghosty.convert.outputs[0]);
check(/^lemon\.pdf$/.test(pdfOut.name) && /Done on this phone: lemon\.pdf, \d/.test((await page.locator('.cvstatus').textContent()) ?? ''), `its name and size said: ${pdfOut.name}, ${pdfOut.size} bytes`);
const pdf = await saved(() => page.locator('.cvresults button', { hasText: 'SAVE' }).first().click());
const pdfText = pdf.bytes.toString('latin1');
check(pdfText.startsWith('%PDF-1.4') && /\/Filter \/DCTDecode/.test(pdfText) && pdf.bytes.includes(lemon.subarray(0, 4096)), `SAVE gives a real PDF with the photo in it byte for byte (${pdf.bytes.length} bytes)`);
await page.screenshot({ path: `${out}/reste-convert-pdf.png` });
// a CSV → an Excel file with its header row
await page.locator('.cvfile .cvx').first().click();
await page.setInputFiles('.cvsheet input[type=file]', { name: 'reste people.csv', mimeType: 'text/csv', buffer: Buffer.from('Name,Town,Age\nSam,Leeds,9\nAisha,Bradford,10\n') });
await page.waitForSelector('.cvbtn[data-id="csv-xlsx"]', { timeout: 10000 });
await page.click('.cvbtn[data-id="csv-xlsx"]');
await page.click('.cvgo');
check(await until(page, () => (window.__ghosty?.convert?.outputs ?? []).some((o) => /\.xlsx$/.test(o.name))), 'a CSV → XLSX is made on the phone (SheetJS, vendored)');
const xlsx = await saved(() => page.locator('.cvresults button', { hasText: 'SAVE' }).first().click());
check(xlsx.bytes.subarray(0, 2).toString() === 'PK' && xlsx.bytes.includes(Buffer.from('xl/worksheets/sheet1.xml')) && /2 rows under a header row/.test((await page.locator('.cvresults').textContent()) ?? ''), `the Excel file, its header row kept (${xlsx.name}, ${xlsx.bytes.length} bytes)`);
// a QR code made
await page.locator('.cvtoolbtn[data-id="qr-make"]').click();
await page.fill('.cvtool textarea', 'https://example.com/reste');
await page.locator('.cvtool button', { hasText: 'MAKE THE CODE' }).click();
check(await until(page, () => !!document.querySelector('.cvqr img') && /QR code \(version \d/.test(window.__ghosty?.convert?.said ?? '')), 'a QR code is drawn on the phone');
await looked(page, 'the converter with its results');
await page.screenshot({ path: `${out}/reste-convert-qr.png` });
await closeSheet();
// the chat's numbers, with no model
await say('3.5 miles in km');
const miles = await replyTo('3.5 miles in km');
check(/3\.5 miles is 5\.633 km/.test(miles), `"3.5 miles in km" answered on the phone: ${String(miles).slice(0, 80)}`);

// ================================================================ 2. DOCUMENTS
/** A small PDF of words: a big heading, a line, a smaller heading, two lines. */
function wordsPdf() {
  const content = 'BT /F1 22 Tf 72 760 Td (Damp and mould) Tj ET BT /F1 11 Tf 72 730 Td (Black mould grows where the air stays damp.) Tj ET BT /F1 11 Tf 72 716 Td (Open a window after a shower.) Tj ET BT /F1 16 Tf 72 680 Td (Who to call) Tj ET BT /F1 11 Tf 72 656 Td (Your council deals with landlords who do nothing.) Tj ET';
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>', `<< /Length ${content.length} >>\nstream\n${content}\nendstream`];
  let s = '%PDF-1.4\n';
  const off = [];
  objs.forEach((o, i) => {
    off.push(s.length);
    s += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const x = s.length;
  s += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${off.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return Buffer.from(s, 'latin1');
}
await page.evaluate(() => (location.hash = 'area-make'));
await page.waitForSelector('#pg-area-make .hubmini[data-id="docs"]', { timeout: 15000 });
await page.click('#pg-area-make .hubmini[data-id="docs"]');
await page.waitForSelector('.modal .dcsheet', { timeout: 15000 });
await page.setInputFiles('.dcsheet input[type=file]', { name: 'damp leaflet.pdf', mimeType: 'application/pdf', buffer: wordsPdf() });
check(await until(page, () => window.__ghosty?.docs?.view === 'doc' && /Black mould/.test(window.__ghosty.docs.text)), 'a PDF is read as a document on the phone (pdf.js, vendored)');
const read = await page.evaluate(() => ({ title: window.__ghosty.docs.title, heads: [...document.querySelectorAll('.dcpage :is(h2,h3,h4)')].map((e) => e.textContent) }));
check(read.title === 'Damp and mould' && read.heads.includes('Who to call'), `its title and heading kept: ${JSON.stringify(read)}`);
await page.locator('.dctools button', { hasText: 'CONTENTS' }).click();
check(/Who to call/.test((await page.locator('.dccontents').textContent()) ?? ''), 'CONTENTS lists its headings');
await page.locator('.dctools button', { hasText: 'READ IT TO ME' }).click();
check(await until(page, () => (window.__said ?? []).some((s) => /Damp and mould\. Black mould grows/.test(s)) && (window.__said ?? []).some((s) => /council deals with landlords/.test(s))), 'READ IT TO ME reads it in the phone’s voice, from the title to the end');
await looked(page, 'a document read');
await page.screenshot({ path: `${out}/reste-docs-read.png` });
await closeSheet();

// a letter written from the chat, laid out, exported
const LETTER = 'write a letter to my landlord about the damp';
await say(LETTER);
await replyTo(LETTER);
check(await until(page, () => [...document.querySelectorAll('#pg-core [data-id^="doc:"]')].some((c) => /Your letter, laid out/.test(c.textContent ?? '')), null, 20000), 'the reply brings its card: “Your letter, laid out”');
await page.evaluate(() => {
  const card = [...document.querySelectorAll('#pg-core [data-id^="doc:"]')].filter((c) => /Your letter, laid out/.test(c.textContent ?? '')).at(-1);
  const b = [...(card?.querySelectorAll('button') ?? [])].find((x) => /OPEN/i.test(x.textContent ?? ''));
  (b ?? card)?.click();
});
check(await until(page, () => window.__ghosty?.docs?.view === 'doc' && /Dear Mr Khan/.test(window.__ghosty.docs.text)), 'OPEN lays the letter out as a document');
const letter = await page.evaluate(() => window.__ghosty.docs);
const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' });
check(letter.title === 'Letter to my landlord about the damp' && !/Here's a letter|Want me to/.test(letter.text) && letter.text.includes(today), `the chatter gone, the title from his ask, the date in: ${letter.text.slice(0, 120).replace(/\n/g, ' / ')}`);
check((await page.locator('.dcpage strong', { hasText: 'damp' }).count()) >= 1, 'the bold word is bold on the page');
const letterPdf = await saved(() => page.locator('.dcexport button', { hasText: 'PDF' }).click().then(() => page.waitForSelector('.dcouts .cvout')).then(() => page.locator('.dcouts button', { hasText: 'SAVE' }).click()));
check(letterPdf.bytes.toString('latin1').startsWith('%PDF-1.4') && /Times-Roman/.test(letterPdf.bytes.toString('latin1')) && letterPdf.name === 'Letter to my landlord about the damp.pdf', `exported as a PDF of words (${letterPdf.name}, ${letterPdf.bytes.length} bytes)`);
const letterDocx = await saved(() => page.locator('.dcexport button', { hasText: 'WORD' }).click().then(() => page.locator('.dcouts button', { hasText: 'SAVE' }).click()));
check(letterDocx.bytes.subarray(0, 2).toString() === 'PK' && letterDocx.bytes.includes(Buffer.from('word/document.xml')), `and as a Word file (${letterDocx.bytes.length} bytes)`);
// a suggestion accepted
await page.locator('.dcasks button', { hasText: 'Make it shorter' }).click();
check(await until(page, () => (window.__ghosty?.docs?.suggestions ?? []).length > 0, null, 30000), 'MAKE IT SHORTER brings the brain’s suggestions');
const sug = await page.evaluate(() => window.__ghosty.docs.suggestions[0]);
check((await page.locator('.dcsug').first().locator('del').count()) > 0 && (await page.locator('.dcsug').first().locator('ins, del').count()) > 0 && !(await page.evaluate(() => window.__ghosty.docs.text)).includes(`\n${sug.new}\n`), 'shown as the old words struck beside the new, nothing changed yet');
await page.locator('.dcsug').first().locator('button', { hasText: 'ACCEPT' }).click();
check(await until(page, (w) => window.__ghosty.docs.accepted === 1 && window.__ghosty.docs.text.includes(w), sug.new), `a suggestion accepted changes the words: "${sug.new.slice(0, 60)}"`);
await looked(page, 'the letter with its suggestions');
await page.screenshot({ path: `${out}/reste-docs-letter.png` });
// a translation, side by side
await page.selectOption('.dcasks select[aria-label="The language to translate into"]', 'Urdu');
await page.locator('.dcasks button', { hasText: /^TRANSLATE$/ }).click();
check(await until(page, () => window.__ghosty?.docs?.view === 'pair' && window.__ghosty.docs.pair.rtl && /ترجمہ/.test(window.__ghosty.docs.pair.right), null, 30000), 'translated into Urdu paragraph by paragraph');
const pair = await page.evaluate(() => {
  const cols = [...document.querySelectorAll('.dcpair .dccol')];
  const r = cols.map((c) => c.getBoundingClientRect());
  return { n: cols.length, dir: cols[1]?.getAttribute('dir'), stacked: r.length === 2 && r[1].top >= r[0].bottom - 1, label: cols[1]?.querySelector('.dccolh')?.textContent };
});
check(pair.n === 2 && pair.dir === 'rtl' && pair.stacked && pair.label === 'URDU', `the original and the translation, stacked on the phone, the Urdu right to left: ${JSON.stringify(pair)}`);
await looked(page, 'a translation');
await page.screenshot({ path: `${out}/reste-docs-translation.png` });
await page.setViewportSize({ width: 1024, height: 800 });
const side = await page.evaluate(() => {
  const r = [...document.querySelectorAll('.dcpair .dccol')].map((c) => c.getBoundingClientRect());
  return r.length === 2 && Math.abs(r[0].top - r[1].top) < 2 && r[1].left > r[0].right - 1;
});
check(side, 'side by side on a wide screen');
await page.setViewportSize(SIZE);
await closeSheet();

// ================================================================ 3. THE RIGHTS-AND-LAW TOPICS
const RIGHTS_Q = 'What are my rights if the police stop and search me?';
await say(RIGHTS_Q);
const rightsReply = await replyTo(RIGHTS_Q, 60000);
check(/reasonable grounds/i.test(String(rightsReply)) && /Not legal advice/.test(String(rightsReply)), `a rights question answered from the documents, not legal advice said: ${String(rightsReply).slice(0, 140).replace(/\n/g, ' ')}`);
check(await until(page, (w) => {
  const all = [...document.querySelectorAll('#pg-core .msg')];
  const mine = all.map((m) => m.classList.contains('me') && (m.textContent ?? '').includes(w)).lastIndexOf(true);
  const reply = all.slice(mine + 1).find((m) => !m.classList.contains('me') && m.querySelector('.csrc'));
  return !!reply && [...reply.querySelectorAll('a.csrc')].some((a) => /gov\.uk/.test(a.getAttribute('href') ?? '') && /PRIMARY/.test(a.textContent ?? ''));
}, RIGHTS_Q, 30000), 'its sources listed under it: GOV.UK’s page, tiered PRIMARY, linked');
await page.screenshot({ path: `${out}/reste-rights-answer.png` });
// the Library opens a topic as a page of its documents
await page.evaluate(() => (location.hash = 'library'));
await page.waitForSelector('#pg-library .pn.rights', { state: 'attached', timeout: 20000 });
await openSection(page, 'library', 'Shelf');
const rp = page.locator('#pg-library .pn.rights');
await rp.scrollIntoViewIfNeeded();
check((await rp.isVisible()) && /\d+ DOCS/.test((await rp.textContent()) ?? ''), 'RIGHTS AND LAW sits under the Library’s Shelf pill, its documents counted');
await rp.locator('.rw', { hasText: 'Stopped and searched' }).click();
await page.waitForSelector('.modal .rtsheet .rtdoc', { timeout: 10000 });
const topic = await page.evaluate(() => ({
  docs: document.querySelectorAll('.rtsheet .rtdoc').length,
  tiers: [...document.querySelectorAll('.rtsheet .rtdoc .ctier')].map((e) => e.textContent),
  links: [...document.querySelectorAll('.rtsheet .rtlink')].map((a) => a.getAttribute('href')),
  advice: document.querySelector('.rtsheet .rtadvice')?.textContent ?? '',
  call: document.querySelector('.rtsheet .rtcall')?.textContent ?? '',
}));
check(topic.docs >= 3 && topic.tiers.every((t) => t === 'PRIMARY' || t === 'CREDIBLE') && topic.links.every((l) => /^https:\/\//.test(l ?? '')), `a topic as a page of its documents, each tiered and linked: ${JSON.stringify(topic.tiers)}`);
check(/^Not legal advice/.test(topic.advice) && /0300 020 0096/.test(topic.call), 'not legal advice, and who to call with the number');
await looked(page, 'a rights topic');
await page.screenshot({ path: `${out}/reste-rights-topic.png` });
await closeSheet();

check(!policy.length, `no security-policy refusal${policy.length ? `: ${policy[0]}` : ''}`);
await browser.close();
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n${problems.map((p) => ` - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log('\nreste: all good');
