// BATCH 8 PART E (BRIEF-REST-E): the converter, documents, and the rights-and-law topics from primary sources.
//  1. THE CONVERTER — what a file is, inflate and zip, our own PDF writer (read back by pdf.js, vendored), pages split
//     and joined (a classic table and a compressed object stream), pictures in a PDF as they are, location taken out of
//     a photo, CSV ↔ JSON ↔ XLSX (SheetJS, vendored) with the header kept, a pasted table, JSON pretty and small, QR
//     codes read back by ZXing (vendored), units, base64, Unix time, WAV both ways and a trim, MP3 by LAME (vendored).
//  2. DOCUMENTS — Markdown, text and HTML in and out, the brain's reply as a letter with his name and the date, the
//     layout's PDF, our own Word writer (its parts; read back by mammoth, vendored), find and replace, undo, the brain's
//     edits as suggestions accepted one by one, a translation keeping the structure, transliteration round trips.
//  3. THE RIGHTS-AND-LAW TOPICS — every entry's shape (a finding, a date, an address on a primary or credible host, its
//     tier as the sourcing code labels it, the day it was checked), no two alike, and the retrieval that hands the
//     matching entries to the brain.
// Bundles are built here with esbuild's API (the files are pure), so a stale bundle can never give a false answer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { deflateRawSync, deflateSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
const web = at('../../web/src');
const vendor = at('../../web/public/vendor/');
const entries = [
  `${web}/convert/bytes.ts`,
  `${web}/convert/inflate.ts`,
  `${web}/convert/zip.ts`,
  `${web}/convert/pdfwrite.ts`,
  `${web}/convert/pdfpages.ts`,
  `${web}/convert/exif.ts`,
  `${web}/convert/table.ts`,
  `${web}/convert/qr.ts`,
  `${web}/convert/units.ts`,
  `${web}/convert/audio.ts`,
  `${web}/convert/list.ts`,
  `${web}/docs/model.ts`,
  `${web}/docs/docx.ts`,
  `${web}/docs/layout.ts`,
  `${web}/docs/translit.ts`,
];
await build({ entryPoints: entries, bundle: true, format: 'esm', platform: 'neutral', outdir: at('./.build/reste'), outbase: at('../../..'), outExtension: { '.js': '.mjs' }, logLevel: 'warning' });
const load = (f) => import(`./.build/reste/${f}.mjs`);
const B = await load('apps/web/src/convert/bytes');
const I = await load('apps/web/src/convert/inflate');
const Z = await load('apps/web/src/convert/zip');
const P = await load('apps/web/src/convert/pdfwrite');
const S = await load('apps/web/src/convert/pdfpages');
const E = await load('apps/web/src/convert/exif');
const T = await load('apps/web/src/convert/table');
const Q = await load('apps/web/src/convert/qr');
const U = await load('apps/web/src/convert/units');
const A = await load('apps/web/src/convert/audio');
const L = await load('apps/web/src/convert/list');
const M = await load('apps/web/src/docs/model');
const D = await load('apps/web/src/docs/docx');
const Y = await load('apps/web/src/docs/layout');
const R = await load('apps/web/src/docs/translit');

// the vendored libraries, as the phone loads them
const pdfjs = await import(pathToFileURL(`${vendor}pdfjs/pdf.min.mjs`).href);
pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(`${vendor}pdfjs/pdf.worker.min.mjs`).href;
const umd = (file, name) => {
  const ctx = { module: { exports: {} }, console, setTimeout, clearTimeout, setImmediate, TextDecoder, TextEncoder, Uint8Array, ArrayBuffer, DataView, Promise, Date, Math, JSON };
  ctx.exports = ctx.module.exports;
  ctx.self = ctx;
  ctx.window = ctx;
  ctx.global = ctx;
  vm.createContext(ctx);
  vm.runInContext(readFileSync(`${vendor}${file}`, 'utf8'), ctx);
  return Object.keys(ctx.module.exports).length ? ctx.module.exports : ctx[name];
};
const XLSX = umd('sheetjs/xlsx.mini.min.js', 'XLSX');
const lamejs = umd('lamejs/lame.min.js', 'lamejs');
const mammoth = umd('mammoth/mammoth.browser.min.js', 'mammoth');

/** A PDF as pdf.js reads it: its page count and each page's words. */
async function readPdf(bytes) {
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), verbosity: 0, isEvalSupported: false, useSystemFonts: false });
  const doc = await task.promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) pages.push((await (await doc.getPage(i)).getTextContent()).items.map((x) => x.str).join(' ').replace(/\s+/g, ' ').trim());
  const n = doc.numPages;
  await task.destroy();
  return { n, pages };
}
const enc = (s) => new TextEncoder().encode(s);

// ================================================================ 1. THE CONVERTER

test('what a file is, from its first bytes: pictures, PDF, the zip-based ones by name, sound, video, text', () => {
  const head = (s) => Uint8Array.from([...s].map((c) => c.charCodeAt(0)));
  assert.equal(B.sniff(readFileSync(at('../../../tests/fixtures/lemon.jpg'))), 'jpg');
  assert.equal(B.sniff(head('\x89PNG\r\n\x1a\n')), 'png');
  assert.equal(B.sniff(head('RIFF\0\0\0\0WEBPVP8 ')), 'webp');
  assert.equal(B.sniff(head('RIFF\0\0\0\0WAVEfmt ')), 'wav');
  assert.equal(B.sniff(head('\0\0\0\x18ftypheic\0\0\0\0')), 'heic');
  assert.equal(B.sniff(head('\0\0\0\x18ftypM4A \0\0\0\0')), 'm4a');
  assert.equal(B.sniff(head('\0\0\0\x18ftypqt  \0\0\0\0')), 'mov');
  assert.equal(B.sniff(head('%PDF-1.7\n')), 'pdf');
  assert.equal(B.sniff(head('PK\x03\x04'), 'Letter.docx'), 'docx');
  assert.equal(B.sniff(head('PK\x03\x04'), 'Sums.xlsx'), 'xlsx');
  assert.equal(B.sniff(head('PK\x03\x04\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0mimetypeapplication/epub+zip'), 'book'), 'epub');
  assert.equal(B.sniff(head('ID3\x03'), 'song.mp3'), 'mp3');
  assert.equal(B.sniff(enc('name,age\nSam,9\n'), 'people.csv'), 'csv');
  assert.equal(B.sniff(enc('{"a":1}'), 'x'), 'json');
  assert.equal(B.sniff(enc('<!doctype html><title>x</title>'), 'page'), 'html');
  assert.equal(B.sniff(enc('Just some words'), 'note'), 'txt');
  assert.equal(B.sizeWords(820), '820 bytes');
  assert.equal(B.sizeWords(34_400), '34.4 KB');
  assert.equal(B.sizeWords(2_400_000), '2.4 MB');
  assert.equal(B.renamed('Holiday photo.HEIC', 'jpg'), 'Holiday photo.jpg');
});

test('base64 both ways (words and bytes), and what is not base64 is said', () => {
  assert.equal(B.textToBase64('hello £5 ✓'), Buffer.from('hello £5 ✓').toString('base64'));
  assert.equal(B.base64ToText('aGVsbG8gwqM1IOKckw=='), 'hello £5 ✓');
  assert.equal(B.base64ToText('aGVsbG8'), 'hello', 'padding is optional');
  assert.equal(B.base64ToText('not base64!'), null);
  assert.equal(B.base64ToText(Buffer.from([0xff, 0xfe, 0x00, 0x01]).toString('base64')), null, 'bytes that are not words are a file, not text');
  assert.equal(U.base64Asked('hello in base64').out, 'aGVsbG8=');
  assert.equal(U.base64Asked('decode aGVsbG8=').out, 'hello');
});

test('inflate reads what zlib writes (raw and wrapped, small and large), and stored zlib reads back', () => {
  const text = enc('The quick brown fox jumps over the lazy dog. '.repeat(400) + 'and then some more words to finish');
  const rnd = new Uint8Array(70_000).map((_, i) => (i * 2654435761) >>> 24);
  for (const data of [text, rnd, new Uint8Array(0), enc('a')]) {
    assert.deepEqual(I.inflate(new Uint8Array(deflateSync(data))), data);
    assert.deepEqual(I.inflateRaw(new Uint8Array(deflateRawSync(data, { level: 1 }))), data);
    assert.deepEqual(I.inflate(I.zlibStored(data, B.adler32(data))), data);
  }
  assert.throws(() => I.inflateRaw(new Uint8Array([0xff, 0xff, 0xff])));
});

test('a zip written here reads back, part for part', () => {
  const z = Z.zipStore([{ name: 'a.txt', data: 'alpha' }, { name: 'dir/β.xml', data: enc('<x/>') }]);
  const back = Z.unzipSync(z);
  assert.deepEqual([...back.keys()], ['a.txt', 'dir/β.xml']);
  assert.equal(new TextDecoder().decode(back.get('a.txt')), 'alpha');
  assert.throws(() => Z.unzipSync(enc('not a zip')), /not a zip/);
});

/** A small RGB PNG made here (8-bit colour, stored zlib), and one with transparency. */
function png(w, h, type, px) {
  const bpp = type === 6 ? 4 : 3;
  const raw = new Uint8Array((w * bpp + 1) * h);
  for (let y = 0; y < h; y++) raw.set(px.subarray(y * w * bpp, (y + 1) * w * bpp), y * (w * bpp + 1) + 1);
  const chunk = (t, body) => {
    const out = Buffer.alloc(12 + body.length);
    out.writeUInt32BE(body.length, 0);
    out.write(t, 4, 'latin1');
    Buffer.from(body).copy(out, 8);
    out.writeUInt32BE(B.crc32(new Uint8Array([...Buffer.from(t, 'latin1'), ...body])), 8 + body.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = type;
  return new Uint8Array(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array())]));
}

test('our own PDF writer: a JPEG as it is, a PNG as a Flate stream (and one with transparency), A4 or its own shape — read by pdf.js', async () => {
  const jpg = new Uint8Array(readFileSync(at('../../../tests/fixtures/lemon.jpg')));
  const ji = P.jpegInfo(jpg);
  assert.ok(ji.w > 0 && ji.h > 0 && ji.comps === 3, 'the JPEG’s size and colours');
  const j = P.jpegImage(jpg);
  assert.equal(j.filter, 'DCTDecode');
  assert.equal(j.data, jpg, 'the JPEG goes in byte for byte');
  const rgb = png(4, 3, 2, new Uint8Array(36).map((_, i) => (i * 7) % 256));
  const p = await P.pngImage(rgb);
  assert.equal(p.filter, 'FlateDecode');
  assert.match(p.parms, /Predictor 15/, 'a plain colour PNG keeps its own compressed data with the PNG predictor');
  const rgba = png(2, 2, 6, new Uint8Array([255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 0, 9, 9, 9, 255]));
  const pa = await P.pngImage(rgba);
  assert.ok(pa.smask, 'its transparency is a soft mask');
  const pages = [P.picturePage(j, 'a4'), P.picturePage(p, 'fit'), P.picturePage(pa, 'a4')];
  assert.ok(Math.abs(pages[0].w - P.A4.w) < 0.01 || Math.abs(pages[0].w - P.A4.h) < 0.01, 'A4');
  assert.ok(Math.abs(Math.max(pages[1].w, pages[1].h) - P.A4.h) < 0.01 && Math.abs(pages[1].w / pages[1].h - 4 / 3) < 0.01, 'its own shape, A4 long');
  const pdf = P.writePdf(pages, { title: 'Lemons — and a test' });
  assert.match(new TextDecoder('latin1').decode(pdf.subarray(0, 9)), /^%PDF-1\.4/);
  const read = await readPdf(pdf);
  assert.equal(read.n, 3, 'pdf.js reads three pages');
  const task = pdfjs.getDocument({ data: pdf, verbosity: 0 });
  const doc = await task.promise;
  assert.equal((await doc.getMetadata()).info.Title, 'Lemons — and a test', 'the title, in UTF-16');
  const ops = await (await doc.getPage(1)).getOperatorList();
  assert.ok(ops.fnArray.includes(pdfjs.OPS.paintImageXObject), 'the photo is painted on page 1');
  await task.destroy();
});

test('a document as a PDF of words: headings, bold and italic, a list, "1 of 2" at the foot — and pdf.js reads the words back', async () => {
  const d = M.newDoc('My letter', [M.block('right', '1 November 2026'), M.block('h1', 'The damp'), M.block('p', M.inline('There is **black mould** in the *back bedroom*, and it has been there since August.')), M.block('ul', 'It smells'), M.block('ul', 'My coat went green'), ...Array.from({ length: 40 }, (_, i) => M.block('p', `Paragraph ${i + 1} of the long part, with enough words in it to wrap onto a second line on an A4 page set in Times.`))]);
  assert.ok(Y.canSetAsText(d));
  const pages = Y.layoutPages(d);
  assert.ok(pages.length >= 2, 'it runs onto a second page');
  for (const pg of pages) for (const r of pg.runs) assert.ok(r.x >= Y.MARGIN - 20 && r.x + 1 <= P.A4.w - Y.MARGIN + 1, `inside the margins: "${r.text}" at ${r.x}`);
  const fonts = new Set(pages.flatMap((pg) => pg.runs.map((r) => r.font)));
  for (const f of ['Helvetica-Bold', 'Times-Roman', 'Times-Bold', 'Times-Italic']) assert.ok(fonts.has(f), f);
  const pdf = Y.pdfOfDoc(d, 'Sam');
  const read = await readPdf(pdf);
  assert.equal(read.n, pages.length);
  assert.match(read.pages[0], /My letter.*1 November 2026.*The damp.*black mould.*back bedroom/);
  assert.match(read.pages[0], /•/, 'the bullet');
  assert.match(read.pages[read.n - 1], new RegExp(`${read.n} of ${read.n}`));
  assert.equal(Y.pdfOfDoc(M.newDoc('خط', [M.block('p', 'سلام')])), null, 'Urdu is drawn by the phone, not set in Times');
  assert.match(Y.readingWords(d), /words, about \d+ minutes? to read/);
});

/** A PDF whose objects sit in a compressed object stream, found through a cross-reference stream (as most PDFs made today are). */
function compressedPdf(words) {
  const content = `BT /F1 24 Tf 72 700 Td (${words}) Tj ET`;
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 /MediaBox [0 0 595 842] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >>', '<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>'];
  let head = '';
  let body = '';
  for (const [i, o] of objs.entries()) {
    head += `${i + 1} ${body.length} `;
    body += `${o}\n`;
  }
  const stm = deflateSync(Buffer.from(head + body));
  let out = '%PDF-1.7\n';
  const off = [];
  off[4] = out.length;
  out += `4 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`;
  off[5] = out.length;
  const stmObj = Buffer.concat([Buffer.from(`5 0 obj\n<< /Type /ObjStm /N 3 /First ${head.length} /Filter /FlateDecode /Length ${stm.length} >>\nstream\n`), stm, Buffer.from('\nendstream\nendobj\n')]);
  const xrefAt = out.length + stmObj.length;
  // the cross-reference stream: type, offset (4 bytes), index; each row PNG-Up filtered (predictor 12, 6 columns)
  const rows = [[0, 0, 0xffff], [2, 5, 0], [2, 5, 1], [2, 5, 2], [1, off[4], 0], [1, off[5], 0], [1, xrefAt, 0]];
  const raw = [];
  let prev = [0, 0, 0, 0, 0, 0, 0];
  for (const [t, o, g] of rows) {
    const row = [t, (o >>> 24) & 255, (o >>> 16) & 255, (o >>> 8) & 255, o & 255, g === 0xffff ? 255 : 0, g === 0xffff ? 255 : g];
    raw.push(2, ...row.map((v, k) => (v - prev[k] + 256) & 255));
    prev = row;
  }
  const xs = deflateSync(Buffer.from(raw));
  const xobj = Buffer.concat([Buffer.from(`6 0 obj\n<< /Type /XRef /Size 7 /W [1 4 2] /Root 1 0 R /Filter /FlateDecode /DecodeParms << /Predictor 12 /Columns 7 >> /Length ${xs.length} >>\nstream\n`), xs, Buffer.from('\nendstream\nendobj\n')]);
  return new Uint8Array(Buffer.concat([Buffer.from(out, 'latin1'), stmObj, xobj, Buffer.from(`startxref\n${xrefAt}\n%%EOF\n`)]));
}

test('a PDF’s pages split out and PDFs joined, on the phone: inherited resources kept, object streams read, a broken table rebuilt', async () => {
  const three = Y.pdfOfDoc(M.newDoc('Three pages', Array.from({ length: 60 }, (_, i) => M.block('p', `Line ${i + 1}: the words of a page that is long enough to need three pages altogether when it is set on A4.`))));
  const all = await readPdf(three);
  assert.ok(all.n >= 3, `${all.n} pages`);
  assert.equal(S.pdfPageCount(three), all.n);
  const two = await readPdf(S.splitPdf(three, [2]));
  assert.equal(two.n, 1);
  assert.equal(two.pages[0], all.pages[1], 'page 2 alone, its words intact');
  const swapped = await readPdf(S.splitPdf(three, [3, 1]));
  assert.deepEqual(swapped.pages, [all.pages[2], all.pages[0]], 'in the order asked');
  const packed = compressedPdf('Packed words');
  assert.equal((await readPdf(packed)).pages[0], 'Packed words', 'the hand-made compressed PDF is a real one');
  assert.equal(S.pdfPageCount(packed), 1);
  const joined = await readPdf(S.joinPdfs([three, packed]));
  assert.equal(joined.n, all.n + 1);
  assert.equal(joined.pages[all.n], 'Packed words', 'its page from the object stream, with the font it inherits from its tree');
  // the same file with its table's offsets wrong: rebuilt by finding every object
  const broken = new Uint8Array(three);
  const s = new TextDecoder('latin1').decode(broken);
  const x = s.lastIndexOf('startxref');
  broken.set(enc('startxref\n99999999\n'.padEnd(s.length - x, ' ')), x);
  assert.equal((await readPdf(S.splitPdf(broken, [1]))).pages[0], all.pages[0]);
  assert.deepEqual(S.pageList('1-3, 5, 8-', 9), [1, 2, 3, 5, 8, 9]);
  assert.deepEqual(S.pageList('2 and 4', 5), [2, 4]);
  assert.throws(() => S.splitPdf(enc('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R /Encrypt 2 0 R >>\n%%EOF'), [1]), /locked/);
});

/** A JPEG made by hand: an EXIF block (orientation 6, and a GPS position: 52°29'N 1°53'W), a frame header, the end. */
function gpsJpeg() {
  const t = [];
  const u16 = (v) => t.push(v >> 8, v & 255);
  const u32 = (v) => t.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
  t.push(0x4d, 0x4d);
  u16(42);
  u32(8);
  // IFD0 at 8: two entries (orientation, GPS pointer), no next
  u16(2);
  u16(0x0112), u16(3), u32(1), u16(6), u16(0);
  u16(0x8825), u16(4), u32(1), u32(38);
  u32(0);
  // GPS IFD at 38: four entries, then the rationals at 92
  u16(4);
  u16(1), u16(2), u32(2), t.push(0x4e, 0, 0, 0);
  u16(2), u16(5), u32(3), u32(92);
  u16(3), u16(2), u32(2), t.push(0x57, 0, 0, 0);
  u16(4), u16(5), u32(3), u32(116);
  u32(0);
  for (const [a, b] of [[52, 1], [29, 1], [0, 1], [1, 1], [53, 1], [0, 1]]) u32(a), u32(b);
  const exif = [0x45, 0x78, 0x69, 0x66, 0, 0, ...t];
  const app1 = [0xff, 0xe1, (exif.length + 2) >> 8, (exif.length + 2) & 255, ...exif];
  const sof = [0xff, 0xc0, 0, 17, 8, 0, 30, 0, 40, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
  return new Uint8Array([0xff, 0xd8, ...app1, ...sof, 0xff, 0xd9]);
}

test('strip location: the GPS block of a JPEG emptied in place (way up and size kept), said as what it removes', () => {
  const j = gpsJpeg();
  const where = E.gpsOf(j);
  assert.ok(Math.abs(where.lat - 52.4833) < 0.001 && Math.abs(where.lon + 1.8833) < 0.001, 'it said where it was taken');
  assert.equal(P.jpegInfo(j).orientation, 6);
  const s = E.stripLocation(j);
  assert.equal(E.gpsOf(s.bytes), null, 'no place left in it');
  assert.equal(s.bytes.length, j.length, 'nothing re-compressed: the same bytes but the place');
  assert.equal(P.jpegInfo(s.bytes).orientation, 6, 'its way up is kept');
  assert.deepEqual([P.jpegInfo(s.bytes).w, P.jpegInfo(s.bytes).h], [40, 30]);
  assert.match(s.removed.join(' '), /GPS position/);
  const clean = E.stripLocation(s.bytes);
  assert.deepEqual(clean.removed, [], 'a second time there is nothing to take');
  assert.throws(() => E.stripLocation(enc('%PDF')), /JPEG, PNG and WebP/);
});

test('CSV ↔ JSON ↔ XLSX with the header row kept (SheetJS, as vendored), a pasted table, JSON pretty and small', () => {
  const csv = 'Name,Age,Note\r\nSam,9,"likes ""lemons"", a lot"\r\nAisha,10,"two\nlines"\r\n';
  const rows = T.parseCsv(csv);
  assert.deepEqual(rows, [['Name', 'Age', 'Note'], ['Sam', '9', 'likes "lemons", a lot'], ['Aisha', '10', 'two\nlines']]);
  assert.equal(T.toCsv(rows), csv, 'CSV round trip');
  assert.equal(T.guessDelimiter('a;b;c\n1;2;3'), ';');
  const objs = T.rowsToObjects(rows);
  assert.deepEqual(objs[0], { Name: 'Sam', Age: 9, Note: 'likes "lemons", a lot' });
  assert.deepEqual(T.jsonToRows(objs), [['Name', 'Age', 'Note'], ['Sam', '9', 'likes "lemons", a lot'], ['Aisha', '10', 'two\nlines']], 'JSON → rows, header first');
  assert.deepEqual(T.jsonToRows({ people: [{ a: 1 }, { b: 2 }] }), [['a', 'b'], ['1', ''], ['', '2']]);
  const xlsx = T.rowsToXlsx(XLSX, rows);
  assert.equal(B.sniff(xlsx, 'x.xlsx'), 'xlsx');
  const back = T.xlsxToRows(XLSX, xlsx);
  assert.deepEqual(back[0].rows, rows, 'XLSX round trip, header row kept');
  assert.equal(T.reformatJson('{"a":[1,2]}', true), '{\n  "a": [\n    1,\n    2\n  ]\n}\n');
  assert.equal(T.reformatJson('{\n "a": [1, 2]\n}', false), '{"a":[1,2]}');
  assert.throws(() => T.reformatJson('{\n"a": 1,\n}', true), /line 3/);
  assert.deepEqual(T.pastedTable('', '<table><tr><th>Town</th><th>Pop.</th></tr><tr><td>Leeds</td><td>812,000</td></tr></table>'), [['Town', 'Pop.'], ['Leeds', '812,000']]);
  assert.deepEqual(T.pastedTable('Town\tPop.\nLeeds\t812,000'), [['Town', 'Pop.'], ['Leeds', '812,000']]);
  assert.deepEqual(T.pastedTable('| Town | Pop. |\n|---|---|\n| Leeds | 812,000 |'), [['Town', 'Pop.'], ['Leeds', '812,000']]);
});

test('a QR code made here reads back with ZXing (vendored): text, a link, Wi-Fi, small and large versions', async () => {
  const zx = await import(pathToFileURL(`${vendor}zxing/zxing-reader.mjs`).href);
  await zx.prepareZXingModule({ overrides: { wasmBinary: readFileSync(`${vendor}zxing/zxing_reader.wasm`) }, fireImmediately: true });
  globalThis.ImageData ??= class {
    constructor(data, width, height) {
      Object.assign(this, { data, width, height, colorSpace: 'srgb' });
    }
  };
  const wifi = Q.wifiText('Home; Net', 'p@ss:word');
  assert.equal(wifi, 'WIFI:T:WPA;S:Home\\; Net;P:p@ss\\:word;;');
  const cases = [['HELLO', 'M'], ['https://example.com/a?b=c', 'L'], [wifi, 'Q'], ['Ghosty makes QR codes on the phone. '.repeat(4), 'M'], ['x'.repeat(300), 'H'], ['ünïcödé ✓ 漢字', 'M']];
  const versions = [];
  for (const [text, ecc] of cases) {
    const q = Q.makeQr(text, ecc);
    versions.push(q.version);
    const px = Q.qrPixels(q, 4);
    const found = await zx.readBarcodes(new ImageData(px.data, px.width, px.height), { formats: ['QRCode'], tryHarder: true });
    assert.equal(found[0]?.text, text, `v${q.version}-${ecc} reads back`);
  }
  assert.ok(versions.some((v) => v >= 7), `a version with its version blocks (${versions.join(', ')})`);
  assert.throws(() => Q.makeQr('x'.repeat(5000)), /too long/);
  const pngBytes = Q.qrPng(Q.makeQr('HELLO'), 4);
  assert.equal(B.sniff(pngBytes), 'png');
  assert.match(Q.qrSvg(Q.makeQr('HELLO')), /^<svg [^>]*viewBox="0 0 29 29"/);
});

test('units and numbers: lengths, weights, temperatures, feet and inches, stone; money left to the brain; Unix time both ways', () => {
  assert.equal(U.unitsAsked('3.5 miles in km').text, '3.5 miles is 5.633 km');
  assert.equal(U.unitsAsked('what is 100 F in C?').text, '100 °F is 37.78 °C');
  assert.equal(U.unitsAsked('5 ft 10 in cm').text, '5 ft 10 in is 177.8 cm');
  assert.equal(U.unitsAsked('11 stone 4 in kg').text, '11 st 4 lb is 71.67 kg');
  assert.equal(U.unitsAsked('2 pints to litres').text, '2 pints is 1.137 litres');
  assert.equal(U.unitsAsked('60 mph in km/h').text, '60 mph is 96.56 km/h');
  assert.equal(U.unitsAsked('3 kg in miles'), null, 'different kinds');
  assert.equal(U.unitsAsked('what is 5 in french'), null);
  assert.ok(U.moneyAsked('£40 in euros') && U.moneyAsked('convert 40 GBP to USD') && !U.moneyAsked('40 miles in km'));
  assert.match(U.unixAsked('1700000000 as a date').text, /Tuesday,? 14 November 2023 at 22:13:20 GMT/);
  assert.equal(U.unixAsked('2023-11-14T22:13:20Z in unix time').out, '1700000000');
  assert.equal(U.unixAsked('what is the unix time now', 1_800_000_000_000).out, '1800000000');
});

test('WAV both ways and a trim; MP3 by LAME (vendored, under 300 KB) with real frames', () => {
  const rate = 44100;
  const n = rate;
  const sound = { rate, channels: [new Float32Array(n).map((_, i) => Math.sin((i / rate) * 2 * Math.PI * 440) * 0.5), new Float32Array(n)] };
  const wav = A.encodeWav(sound);
  assert.equal(B.sniff(wav), 'wav');
  const back = A.decodeWav(wav);
  assert.equal(back.rate, rate);
  assert.equal(back.channels.length, 2);
  assert.ok(Math.abs(back.channels[0][1000] - sound.channels[0][1000]) < 1e-4, 'the samples come back');
  const cut = A.trimSound(back, 0.25, 0.75);
  assert.equal(cut.channels[0].length, rate / 2);
  assert.equal(A.lengthWords(cut), '0.5 s');
  assert.deepEqual(A.rangeOf('0:12 to 1:05'), { from: 12, to: 65 });
  assert.equal(A.rangeOf('9 to 3'), null);
  assert.ok(readFileSync(`${vendor}lamejs/lame.min.js`).length < 300_000, 'the encoder is under 300 KB');
  const mp3 = A.encodeMp3(lamejs, sound, 128);
  assert.ok(mp3.length > 10_000 && mp3.length < 30_000, `a second at 128 kbps is about 16 KB (${mp3.length})`);
  assert.equal(mp3[0], 0xff);
  assert.equal(mp3[1] & 0xe0, 0xe0, 'it starts with an MPEG frame');
  assert.equal(B.sniff(mp3), 'mp3');
});

test('the conversions as built, by group: thirty and more, each said in plain words, video said as not done', () => {
  const list = L.CONVERSIONS;
  assert.ok(list.length >= 30, `${list.length} conversions`);
  const ids = list.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const c of list) {
    assert.ok(c.label && c.label.length <= 40, `${c.id}: its label`);
    assert.ok(['images', 'pdf', 'text', 'documents', 'audio', 'codes', 'numbers'].includes(c.group), `${c.id}: its group`);
  }
  assert.deepEqual(L.forKinds(['jpg']).map((c) => c.id).slice(0, 3), ['img-jpg', 'img-png', 'img-webp']);
  assert.ok(L.forKinds(['jpg', 'png']).some((c) => c.id === 'images-pdf'), 'several pictures make one PDF');
  assert.ok(L.forKinds(['pdf', 'pdf']).some((c) => c.id === 'pdf-join'));
  assert.ok(!L.forKinds(['pdf']).some((c) => c.id === 'pdf-join'), 'one PDF is not joined');
  assert.match(L.VIDEO_LINE, /not on the phone/i);
});

// ================================================================ 2. DOCUMENTS

test('Markdown, text and HTML in and out: headings, lists, bold and italic, line breaks kept', () => {
  const md = '# A title\n\nSome **bold** and *italic* words.\nA second line.\n\n- one\n- two\n\n1. first\n2. second\n\n> quoted';
  const blocks = M.fromMarkdown(md);
  assert.deepEqual(blocks.map((b) => b.t), ['h1', 'p', 'ul', 'ul', 'ol', 'ol', 'quote']);
  assert.deepEqual(blocks[1].runs, [{ text: 'Some ' }, { text: 'bold', b: true }, { text: ' and ' }, { text: 'italic', i: true }, { text: ' words.\nA second line.' }]);
  const d = M.newDoc('Doc', blocks);
  const html = M.toHtml(d);
  assert.match(html, /<h1>A title<\/h1>\n<p>Some <strong>bold<\/strong> and <em>italic<\/em> words\.<br>A second line\.<\/p>\n<ul>\n<li>one<\/li>\n<li>two<\/li>\n<\/ul>\n<ol>/);
  assert.deepEqual(M.fromHtml(html).map((b) => [b.t, M.textOf(b)]), blocks.map((b) => [b.t, M.textOf(b)]), 'HTML round trip');
  const back = M.titled(M.fromMarkdown(M.toMarkdown(d)), 'x');
  assert.equal(back.title, 'Doc');
  assert.deepEqual(back.blocks.map((b) => [b.t, b.runs]), blocks.map((b) => [b.t, b.runs]), 'Markdown round trip (its title first, the headings under it)');
  assert.match(M.toText(d), /^Doc\n\nA title\n\nSome bold and italic words\.\nA second line\.\n\n• one\n• two\n\n1\. first\n2\. second\n\n“quoted”\n$/);
  assert.match(M.toHtml(d, true), /^<!doctype html>[\s\S]*<title>Doc<\/title>/);
  const page = M.fromHtml('<html><head><title>T</title><style>p{}</style></head><body><nav>menu</nav><h2>Part &amp; parcel</h2><p>Hello<br/>there&nbsp;you</p><script>x()</script><ul><li><b>Bold</b> item</li></ul></body></html>');
  assert.deepEqual(page.map((b) => [b.t, M.textOf(b)]), [['h2', 'Part & parcel'], ['p', 'Hello\nthere you'], ['ul', 'Bold item']]);
  assert.equal(M.htmlTitle('<title> My  page </title>'), 'My page');
  assert.equal(M.fromText('A *star* stays\n\n• a bullet')[0].runs[0].text, 'A *star* stays');
});

test('a letter from the chat: the chatter gone, his name and the date in their places, the title from his ask', () => {
  const reply = "Sure, here's a letter you can send:\n\n[Your name]\n12 High Street\nBirmingham\n\n[Date]\n\nDear Mr Khan,\n\nI am writing about the **damp** in the back bedroom.\n\nYours sincerely,\n[Your name]\n\nWant me to make it more formal?";
  assert.equal(M.writeAsked('write a letter to my landlord about the damp'), 'letter');
  assert.equal(M.writeAsked('can you draft an email to school'), 'email');
  assert.equal(M.writeAsked('what is a letter'), null);
  const d = M.docFromReply(reply, 'write a letter to my landlord about the damp', { name: 'Sam Ali', date: '1 November 2026' });
  assert.equal(d.title, 'Letter to my landlord about the damp');
  assert.equal(d.kind, 'letter');
  const text = M.docText(d);
  assert.doesNotMatch(text, /Sure|Want me|\[Your name\]|\[Date\]/);
  assert.match(text, /^Sam Ali\n12 High Street\nBirmingham\n\n1 November 2026\n\nDear Mr Khan,/);
  assert.ok(d.blocks.some((b) => b.runs.some((r) => r.b && r.text === 'damp')));
  const plain = M.docFromReply('Dear Sir,\n\nThe boiler is broken.\n\nRegards', 'write a letter to the council', { name: 'Sam Ali', date: '1 November 2026' });
  assert.deepEqual(plain.blocks.slice(0, 2).map((b) => [b.t, M.textOf(b)]), [['right', 'Sam Ali'], ['right', '1 November 2026']], 'no date in it: his name and the date go at the top on the right');
});

test('our own Word writer: its parts, its headings, lists and bold — read back by mammoth (vendored)', async () => {
  const d = M.newDoc('Report', [M.block('h1', 'Findings'), M.block('p', M.inline('It is **bold** and *new*.\nNext line.')), M.block('ul', 'a bullet'), M.block('ol', 'one'), M.block('ol', 'two'), M.block('p', 'gap'), M.block('ol', 'again one'), M.block('right', 'Sam')]);
  const docx = D.docxFrom(d, 'Sam');
  const parts = Z.unzipSync(docx);
  for (const p of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml', 'word/numbering.xml', 'word/_rels/document.xml.rels', 'docProps/core.xml']) assert.ok(parts.has(p), p);
  const xml = new TextDecoder().decode(parts.get('word/document.xml'));
  assert.match(xml, /<w:pStyle w:val="Heading1"\/>/);
  assert.match(xml, /<w:b\/><\/w:rPr><w:t xml:space="preserve">bold</);
  assert.match(xml, /<w:br\/><w:t xml:space="preserve">Next line\./);
  assert.match(xml, /<w:jc w:val="right"\/>/);
  assert.equal([...new TextDecoder().decode(parts.get('word/numbering.xml')).matchAll(/<w:startOverride w:val="1"\/>/g)].length, 2, 'each numbered list counts from 1');
  assert.match(new TextDecoder().decode(parts.get('docProps/core.xml')), /<dc:title>Report<\/dc:title><dc:creator>Sam<\/dc:creator>/);
  const html = (await mammoth.convertToHtml({ arrayBuffer: docx.buffer.slice(docx.byteOffset, docx.byteOffset + docx.byteLength) })).value;
  assert.match(html, /<h1>Findings<\/h1>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<ul><li>a bullet<\/li><\/ul><ol><li>one<\/li><li>two<\/li><\/ol>/);
  const back = M.fromHtml(html);
  assert.ok(back.some((b) => b.t === 'h1' && M.textOf(b) === 'Findings'), 'Word → our document');
});

test('the editor: find, replace inside the formatting, undo and redo', () => {
  const d = M.newDoc('D', [M.block('p', M.inline('The cat sat. The **cat** ran.')), M.block('p', 'No match here; Category stays.')]);
  assert.deepEqual(M.findIn(d, 'cat').map((x) => x.count), [2, 1]);
  assert.deepEqual(M.findIn(d, 'cat', false, true).map((x) => x.count), [2], 'whole words only');
  const r = M.replaceAll(d, 'cat', 'dog', false, true);
  assert.equal(r.count, 2);
  assert.deepEqual(r.doc.blocks[0].runs, [{ text: 'The dog sat. The ' }, { text: 'dog', b: true }, { text: ' ran.' }], 'bold stays bold');
  const h = new M.History(d);
  h.push(r.doc);
  h.push(M.withBlock(h.doc, h.doc.blocks[1].id, () => null));
  assert.equal(h.doc.blocks.length, 1);
  assert.equal(h.undo().blocks.length, 2);
  assert.equal(M.textOf(h.undo().blocks[0]), 'The cat sat. The cat ran.');
  assert.ok(!h.canUndo && h.canRedo);
  assert.equal(M.textOf(h.redo().blocks[0]), 'The dog sat. The dog ran.');
});

test('the brain’s edits come as suggestions: only changed paragraphs, the old words struck beside the new, accepted one by one', () => {
  const d = M.newDoc('Letter', [M.block('h1', 'The damp'), M.block('p', 'i is writing about the damp, it are bad.'), M.block('p', 'Thank you.')]);
  const ask = M.editMessage(d, 'grammar');
  assert.match(ask, /^DOCUMENT EDIT — fix the spelling, grammar and punctuation only/);
  assert.match(ask, /\[1\] The damp\n\[2\] i is writing about the damp, it are bad\.\n\[3\] Thank you\./);
  const reply = 'Here are the changes:\n[2] I am writing about the damp; it is bad.\n[3] Thank you.';
  const s = M.suggestionsFrom(d, reply);
  assert.equal(s.length, 1, 'an unchanged paragraph is no suggestion');
  assert.equal(s[0].old, 'i is writing about the damp, it are bad.');
  assert.equal(s[0].new, 'I am writing about the damp; it is bad.');
  const diff = M.wordDiff(s[0].old, s[0].new);
  assert.ok(diff.some((x) => x.gone === 'i is') || diff.some((x) => x.gone?.includes('is')), 'the old words are marked gone');
  assert.ok(diff.some((x) => x.came?.includes('am')), 'the new words are marked new');
  assert.equal(M.textOf(d.blocks[1]), 'i is writing about the damp, it are bad.', 'nothing changes until he accepts');
  const done = M.accept(d, s[0]);
  assert.equal(M.textOf(done.blocks[1]), 'I am writing about the damp; it is bad.');
  assert.deepEqual(M.parseNumbered('[1] one\ncontinues\n2. two\n[3] "quoted"'), new Map([[1, 'one continues'], [2, 'two'], [3, 'quoted']]));
});

test('a translation paragraph by paragraph: every block in its place, the language by name, right to left for Urdu', () => {
  const d = M.newDoc('Letter', [M.block('h1', 'The damp'), M.block('p', 'Dear Mr Khan,'), M.block('ul', 'Mould'), M.block('p', 'Thanks')]);
  assert.equal(M.languageAsked('translate this into Urdu'), 'Urdu');
  assert.equal(M.languageAsked('can you put it in polish please'), 'Polish');
  assert.equal(M.languageAsked('translate this'), null);
  const ask = M.translateMessage(d, 'Urdu');
  assert.match(ask, /^DOCUMENT TRANSLATE into Urdu\./);
  assert.match(ask, /\[4\] Thanks$/);
  const { doc, missing } = M.translatedDoc(d, M.parseNumbered('[1] نمی\n[2] محترم خان صاحب،\n[3] پھپھوندی'), 'Urdu');
  assert.deepEqual(doc.blocks.map((b) => b.t), ['h1', 'p', 'ul', 'p'], 'the structure kept');
  assert.equal(M.textOf(doc.blocks[1]), 'محترم خان صاحب،');
  assert.equal(missing, 1, 'one paragraph had no translation: kept as it was, and said');
  assert.equal(doc.rtl, true);
  assert.equal(doc.lang, 'Urdu');
  assert.equal(doc.title, 'Letter (Urdu)');
  assert.ok(M.LANGUAGES.includes('Urdu') && M.LANGUAGES.length >= 25);
});

test('transliteration: each script to Latin, and back where the table is one-to-one', () => {
  const trips = [
    ['cyrillic', 'Щука и ёжик. Привет, мир!', 'Ŝuka i ëžik. Privet, mir!'],
    ['cyrillic', 'Київ, Ґанок', 'Kiïv, G̀anok'],
    ['greek', 'Καλημέρα, θάλασσα και ψυχή', 'Kalīméra, tháLassa kai psychī́'],
    ['armenian', 'Բարեւ Հայաստան', 'Barew Hayastan'],
    ['georgian', 'თბილისი საქართველო', 't’bilisi sak’art’velo'],
    ['devanagari', 'नमस्ते भारत', 'namastē bhārata'],
    ['arabic', 'السلام عليكم', 'ālslām ʿlykm'],
    ['urdu', 'پاکستان زندہ باد', 'pākstān zndh bād'],
  ];
  for (const [id, native, latin] of trips) {
    const got = R.toLatin(native, id);
    if (id !== 'greek') assert.equal(got, latin.normalize('NFC'), `${id} → Latin`);
    assert.equal(R.fromLatin(got, id), native.normalize('NFC'), `${id}: back again`);
  }
  assert.equal(R.scriptOf('پاکستان'), R.SCRIPTS.find((s) => s.id === 'urdu'), 'Urdu’s own letters decide');
  assert.equal(R.scriptOf('مرحبا')?.id, 'arabic');
  assert.equal(R.scriptOf('hello'), null);
  assert.equal(R.toLatin('שָׁלוֹם', 'hebrew'), 'šālōm');
  assert.equal(R.fromLatin('shalom', 'hebrew'), null, 'Hebrew does not come back one to one');
  assert.equal(R.THE_LINE, 'The sounds in Latin letters, not a translation.');
});
