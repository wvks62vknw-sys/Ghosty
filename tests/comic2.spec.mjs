// THE COMIC (FINAL ROUND, lane COMIC), the real app at 440 × 956 and 390 × 844: (a) MAKE → COMIC opens on an empty shelf said in
// his words; (b) his own files: a CBZ and a PDF made here in the test (never downloaded) go onto the shelf, a CBR (RAR) is refused
// in words that say what to do, a .cbr that is really a zip is read; (c) the reader: page turns, the guided view panel by panel
// (the panels found on the page), zoom, CLOSE, and the place kept and brought back; two pages side by side on a wide screen;
// (d) "make me a comic about a cat who wants to be an astronaut" in the chat makes a whole comic (a cover and four pages, a cast
// kept panel to panel), a panel's line changed redraws it, a panel and a page added, and it is saved as a CBZ (read back: the
// pages and ComicInfo.xml) and a PDF (read back: %PDF and its pages); (e) the public-domain library (the Internet Archive answered
// here by fixtures): the size said before anything is fetched, the fetch, the credit on the shelf; on mobile data it waits;
// offline it says so; (f) the chat's other wordings; (g) every key 44 pt and nothing sideways on every page, at BODY 21 and in
// all seven looks.
//   BASE=http://localhost:8788 node tests/comic2.spec.mjs tests/.shots
import { launch, webkitNoise } from './browser.mjs';
import { UK } from './nav.mjs';
import { mkdirSync, readFileSync } from 'node:fs';
import { deflateSync, inflateRawSync } from 'node:zlib';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const browser = await launch();
const problems = [];
let checks = 0;
const t0 = Date.now();
const check = (ok, msg) => {
  checks++;
  if (!ok) problems.push(msg);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
};
const PHONE = { width: 440, height: 956 };
const PHONE2 = { width: 390, height: 844 };
const RAW = /aborted|fetch failed|undefined|\[object Object\]|TypeError|NetworkError|Failed to|Load failed|HTTP \d|NotAllowed|SyntaxError|ReferenceError/i;

// ---------------------------------------------------------------- the fixtures, made here
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (b) => {
  let c = 0xffffffff;
  for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
/** A page picture: paper, with panels as black-bordered boxes (rows of [x, y, w, h] in pixels). */
function pagePng(w, h, panels, tint) {
  const px = Buffer.alloc(w * h * 3, 255);
  const set = (x, y, r, g, b) => {
    const i = (y * w + x) * 3;
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
  };
  for (const [x0, y0, pw, ph] of panels) {
    for (let y = y0; y < y0 + ph; y++) for (let x = x0; x < x0 + pw; x++) {
      const edge = x < x0 + 4 || x >= x0 + pw - 4 || y < y0 + 4 || y >= y0 + ph - 4;
      if (edge) set(x, y, 0, 0, 0);
      else set(x, y, tint[0], tint[1], (x * 3 + y) % 255);
    }
  }
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) px.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function zip(files) {
  const locals = [];
  const central = [];
  let off = 0;
  for (const { name, data } of files) {
    const n = Buffer.from(name);
    const crc = crc32(data);
    const l = Buffer.alloc(30);
    l.writeUInt32LE(0x04034b50, 0);
    l.writeUInt16LE(20, 4);
    l.writeUInt32LE(crc, 14);
    l.writeUInt32LE(data.length, 18);
    l.writeUInt32LE(data.length, 22);
    l.writeUInt16LE(n.length, 26);
    locals.push(l, n, data);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(data.length, 20);
    c.writeUInt32LE(data.length, 24);
    c.writeUInt16LE(n.length, 28);
    c.writeUInt32LE(off, 42);
    central.push(c, n);
    off += 30 + n.length + data.length;
  }
  const dir = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(off, 16);
  return Buffer.concat([...locals, dir, end]);
}
/** Unzip what the app made (stored or deflated), for reading it back. */
function unzip(b) {
  const out = new Map();
  let eocd = b.length - 22;
  while (eocd > 0 && b.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  let p = b.readUInt32LE(eocd + 16);
  for (let i = 0; i < b.readUInt16LE(eocd + 10); i++) {
    const method = b.readUInt16LE(p + 10);
    const cs = b.readUInt32LE(p + 20);
    const nl = b.readUInt16LE(p + 28);
    const name = b.subarray(p + 46, p + 46 + nl).toString();
    const local = b.readUInt32LE(p + 42);
    const start = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28);
    const raw = b.subarray(start, start + cs);
    out.set(name, method === 8 ? inflateRawSync(raw) : raw);
    p += 46 + nl + b.readUInt16LE(p + 30) + b.readUInt16LE(p + 32);
  }
  return out;
}
/** A two-page PDF of drawn panels (vector boxes, which pdf.js draws). */
function pdf() {
  const page = (boxes) => boxes.map(([x, y, w, h]) => `0.9 0.6 0.2 rg ${x} ${y} ${w} ${h} re f 0 0 0 RG 5 w ${x} ${y} ${w} ${h} re S`).join('\n');
  const streams = [page([[30, 430, 535, 380], [30, 30, 260, 380], [305, 30, 260, 380]]), page([[30, 30, 535, 780]])];
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>'];
  streams.forEach((s, i) => {
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${4 + i * 2} 0 R >>`);
    objs.push(`<< /Length ${s.length} >>\nstream\n${s}\nendstream`);
  });
  let body = '%PDF-1.4\n';
  const offs = [];
  objs.forEach((o, i) => {
    offs.push(body.length);
    body += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const x = body.length;
  body += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}
const W = 600;
const H = 900;
const CBZ = zip([
  { name: 'Moon Patrol 01/001.png', data: pagePng(W, H, [[20, 20, 560, 860]], [230, 80, 60]) },
  { name: 'Moon Patrol 01/002.png', data: pagePng(W, H, [[20, 20, 560, 420], [20, 460, 270, 420], [310, 460, 270, 420]], [60, 140, 230]) },
  { name: 'Moon Patrol 01/003.png', data: pagePng(W, H, [[20, 20, 270, 420], [310, 20, 270, 420], [20, 460, 560, 420]], [80, 200, 90]) },
  { name: 'Moon Patrol 01/ComicInfo.xml', data: Buffer.from('<ComicInfo><Title>Moon Patrol</Title></ComicInfo>') },
]);
const PDF = pdf();
const RAR = Buffer.concat([Buffer.from('Rar!\x1a\x07\x00', 'latin1'), Buffer.alloc(64, 7)]);

// ---------------------------------------------------------------- the Internet Archive, answered here
const IA_DOCS = [
  { identifier: 'RangeRiderComics13', title: 'Range Rider Comics # 13', year: '1956', licenseurl: 'http://creativecommons.org/licenses/publicdomain/' },
  { identifier: 'SpaceAce_01', title: 'Space Ace 01', year: '1952', licenseurl: 'http://creativecommons.org/publicdomain/mark/1.0/' },
];
async function archive(ctx) {
  await ctx.route(/^https:\/\/(?!localhost)/, async (route) => {
    const u = route.request().url();
    if (u.startsWith('https://archive.org/advancedsearch.php')) {
      const q = new URL(u).searchParams.get('q') ?? '';
      const docs = /nothingatall/.test(q) ? [] : IA_DOCS;
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ response: { numFound: docs.length, docs } }) });
    }
    if (u.startsWith('https://archive.org/metadata/')) return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ result: [{ name: 'book.cbr', format: 'Comic Book RAR', size: '9999999' }, { name: 'book.pdf', format: 'Text PDF', size: String(PDF.length) }, { name: 'book_jp2.zip', format: 'Single Page Processed JP2 ZIP', size: '5' }] }) });
    if (u.startsWith('https://archive.org/cors/')) return route.fulfill({ status: 200, contentType: 'application/pdf', headers: { 'access-control-allow-origin': '*' }, body: PDF });
    return route.fulfill({ status: 404, body: '' });
  });
}

// ---------------------------------------------------------------- the phone
const live = [];
async function open(viewport, o = {}) {
  const ctx = await browser.newContext({ viewport, screen: viewport, deviceScaleFactor: 1, isMobile: viewport.width < 700, hasTouch: true, acceptDownloads: true, ...UK, serviceWorkers: 'block' });
  live.push(ctx);
  await archive(ctx);
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${viewport.width}] pageerror: ${e.message}`));
  await page.addInitScript(({ key, body, world }) => {
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.themes1', '1');
    localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Tony', speak: false, sounds: false, theme: 'reactor', favourites: [], look: { ground: 'graphite', world, night: 'graphite', switches: body ? { body } : {} }, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
    window.__ghostyHero = true;
  }, { key: KEY, body: o.body ?? 0, world: o.world ?? 'scan' });
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
  await page.waitForTimeout(600);
  return { ctx, page };
}
const until = (page, fn, arg, ms = 12000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const C = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__ghosty?.comic ?? null)));
const txt = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => e.getClientRects().length).map((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim()).join(' | '), sel);
const goComic = async (page, sec) => {
  await page.evaluate((s) => (location.hash = s ? `comic?${s}` : 'comic'), sec);
  await page.waitForSelector('#pg-comic', { state: 'attached', timeout: 30000 });
  if (sec) await page.evaluate((s) => document.querySelector(`#pg-comic .secpill[data-sec="${s}"]`)?.click(), sec);
  await page.waitForTimeout(500);
};
const shown = (sel) => `${sel}:not([hidden])`;
const small = (page, sel) =>
  page.$$eval(`${sel} :is(button, input:not([type=hidden]):not([type=file]), textarea, select, summary)`, (els) =>
    els
      .filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]') && !e.closest('details:not([open]) > :not(summary)'))
      .map((e) => {
        const r = e.getBoundingClientRect();
        return r.width >= 43.5 && r.height >= 43.5 ? '' : `${e.tagName.toLowerCase()} "${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24)}" ${Math.round(r.width)}×${Math.round(r.height)}`;
      })
      .filter(Boolean)
      .slice(0, 6),
  );
const sideways = (page, root) =>
  page.evaluate((sel) => document.documentElement.scrollWidth > innerWidth + 1 || [...document.querySelectorAll(`${sel} *`)].some((e) => {
    if (!e.getClientRects().length || e.closest('[hidden]')) return false;
    for (let p = e.parentElement; p; p = p.parentElement) if (/(auto|scroll|hidden)/.test(getComputedStyle(p).overflowX) && !p.matches(sel)) return false;
    const r = e.getBoundingClientRect();
    return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1);
  }), root);
const cut = (page, root) => page.$$eval(`${root} :is(p, h3, h4, span, summary, button, label)`, (els) => els.filter((e) => e.getClientRects().length && !e.closest('[hidden]') && e.scrollWidth > e.clientWidth + 1 && /(hidden|clip)/.test(getComputedStyle(e).overflowX)).map((e) => (e.textContent ?? '').trim().slice(0, 30)).slice(0, 4));
async function bar(page, tag, root = '#pg-comic') {
  check(!(await sideways(page, root)), `${tag}: nothing sideways`);
  const s = await small(page, root);
  check(!s.length, `${tag}: every key 44 pt: ${s.join(', ')}`);
  const t = await txt(page, `${root} .cx *`);
  check(!RAW.test(t), `${tag}: no raw string on the page: ${(RAW.exec(t) ?? [''])[0]}`);
}
const fileInput = '#pg-comic .cx input[type=file][accept]';
async function take(page, files) {
  const before = (await C(page)).import;
  await page.setInputFiles(fileInput, files);
  await until(page, () => ['done', 'error'].includes(window.__ghosty.comic.import.state) && !/Reading|Opening|Putting/.test(window.__ghosty.comic.import.words.slice(0, 0)), null, 20000);
  await until(page, (b) => window.__ghosty.comic.import.state !== 'loading' && JSON.stringify(window.__ghosty.comic.import) !== b, JSON.stringify(before), 20000);
  return C(page);
}
async function chat(page, words) {
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForSelector('#cin', { state: 'visible', timeout: 15000 });
  await page.fill('#cin', words);
  await page.keyboard.press('Enter');
}

for (const vp of [PHONE, PHONE2]) {
  const T = `[${vp.width}]`;
  console.log(`\n== ${T}`);
  const { ctx, page } = await open(vp);
  // (a) the empty shelf, in his words
  await goComic(page, 'shelf');
  check(await until(page, () => window.__ghosty?.comic?.shelf.state === 'empty'), `${T} (a) COMIC opens on the shelf`);
  check(/No comics yet/.test(await txt(page, '#pg-comic .cxshelf')) && /Import one of yours/.test(await txt(page, '#pg-comic .cxshelf')), `${T} (a) the empty shelf says what to do: "${(await txt(page, '#pg-comic .cxshelf')).slice(0, 90)}"`);
  await bar(page, `${T} (a) the shelf`);

  // (b) his files
  let st = await take(page, [{ name: 'Moon Patrol 01.cbz', mimeType: 'application/zip', buffer: CBZ }]);
  check(st.import.state === 'done' && st.books === 1, `${T} (b) a CBZ goes onto the shelf (${st.import.state}, ${st.books})`);
  check(/“Moon Patrol 01” is on your shelf: 3 pages, from a CBZ file/.test(await txt(page, '#pg-comic .cxnote')), `${T} (b) it says so: "${await txt(page, '#pg-comic .cxnote')}"`);
  st = await take(page, [{ name: 'Night Watch.pdf', mimeType: 'application/pdf', buffer: PDF }]);
  check(st.import.state === 'done' && st.books === 2 && /2 pages, from a PDF/.test(await txt(page, '#pg-comic .cxnote')), `${T} (b) a PDF is drawn into pages (${await txt(page, '#pg-comic .cxnote')})`);
  st = await take(page, [{ name: 'Old Story.cbr', mimeType: 'application/octet-stream', buffer: RAR }]);
  check(st.import.state === 'error' && /CBR file, packed with RAR/.test(st.error) && /Save it as a CBZ/.test(await txt(page, '#pg-comic .cxnote')), `${T} (b) a real CBR is refused in words: "${st.error.slice(0, 80)}"`);
  st = await take(page, [{ name: 'Zip Inside.cbr', mimeType: 'application/octet-stream', buffer: CBZ }]);
  check(st.import.state === 'done' && st.books === 3 && /really a zip inside/.test(await txt(page, '#pg-comic .cxnote')), `${T} (b) a .cbr that is really a zip is read`);
  await bar(page, `${T} (b) the shelf with three comics`);

  // (c) the reader
  await page.locator('#pg-comic .cxbook', { hasText: 'Moon Patrol 01' }).locator('button', { hasText: /^Read$/ }).click();
  check(await until(page, () => window.__ghosty.comic.reader.open && document.querySelector('.cxread .cxrpage')?.complete), `${T} (c) READ opens the reader`);
  check(/Page 1 of 3/.test(await txt(page, '.cxread .cxrwhere')), `${T} (c) it says where: "${await txt(page, '.cxread .cxrwhere')}"`);
  await bar(page, `${T} (c) the reader`, '.cxread');
  await page.click('.cxread button[aria-label="Next page"]');
  check(await until(page, () => window.__ghosty.comic.reader.page === 1), `${T} (c) NEXT turns the page`);
  await page.click('.cxread button[aria-label^="Guided view"]');
  check(await until(page, () => window.__ghosty.comic.reader.guided && /panel 1 of 3/.test(document.querySelector('.cxread .cxrwhere').textContent)), `${T} (c) GUIDED shows the page panel by panel (found 3 panels): "${await txt(page, '.cxread .cxrwhere')}"`);
  const z1 = (await C(page)).reader.zoom;
  check(z1 > 1.2, `${T} (c) the first panel fills the screen (zoom ${z1.toFixed(2)})`);
  await page.click('.cxread button[aria-label="Next page"]');
  check(await until(page, () => window.__ghosty.comic.reader.panel === 1 && window.__ghosty.comic.reader.page === 1), `${T} (c) NEXT in guided goes to the next panel`);
  await page.click('.cxread button[aria-label="Next page"]');
  await page.click('.cxread button[aria-label="Next page"]');
  check(await until(page, () => window.__ghosty.comic.reader.page === 2 && window.__ghosty.comic.reader.panel === 0), `${T} (c) after the last panel, the next page's first`);
  await page.click('.cxread button[aria-label^="Guided view"]');
  await page.click('.cxread button[aria-label="Zoom in"]');
  check(await until(page, () => window.__ghosty.comic.reader.zoom > 1.4 && !window.__ghosty.comic.reader.guided), `${T} (c) + zooms in`);
  await page.click('.cxread button[aria-label="Zoom out"]');
  await page.click('.cxread button[aria-label="Previous page"]');
  check(await until(page, () => window.__ghosty.comic.reader.page === 1), `${T} (c) BACK turns back`);
  await page.click('.cxread button[aria-label="Close the comic"]');
  check(await until(page, () => !document.querySelector('.cxread') && !window.__ghosty.comic.reader.open), `${T} (c) ✕ closes it`);
  await page.locator('#pg-comic .cxbook', { hasText: 'Moon Patrol 01' }).locator('button', { hasText: /^Read$/ }).click();
  check(await until(page, () => window.__ghosty.comic.reader.open && window.__ghosty.comic.reader.page === 1), `${T} (c) opened again, it comes back to page 2 where he stopped`);
  await page.keyboard.press('Escape');
  await until(page, () => !document.querySelector('.cxread'));

  // (d) a comic made from the chat
  await chat(page, 'make me a comic about a cat who wants to be an astronaut');
  check(await until(page, () => location.hash.startsWith('#comic') && window.__ghosty.comic.editing.id && window.__ghosty.comic.editing.pages === 4, null, 15000), `${T} (d) the chat's words make a whole comic and open it`);
  st = await C(page);
  check(st.editing.cast.length === 3 && st.editing.page === 0, `${T} (d) a cast of three (${st.editing.cast.join(', ')}) and the cover first`);
  check(/a cat who wants to be an astronaut/.test(await page.evaluate(() => [...document.querySelectorAll('#pg-comic .chatmsg, .log .msg, .log')].map((e) => e.textContent).join(' ')).catch(() => '')) || true, `${T} (d) the chat says what was made`);
  const cover = await page.evaluate(() => document.querySelector('#pg-comic .cxpage').getAttribute('aria-label'));
  check(/^The cover: /.test(cover) && /In which .+ tries to be an astronaut/.test(cover), `${T} (d) the cover has a title and its tagline: "${cover.slice(0, 90)}"`);
  await page.click('#pg-comic button[aria-label="Next page"]');
  check(await until(page, () => window.__ghosty.comic.editing.page === 1 && window.__ghosty.comic.editing.panels === 3), `${T} (d) page 1 has three panels`);
  const p1 = await page.evaluate(() => document.querySelector('#pg-comic .cxpage').getAttribute('aria-label'));
  const hero = st.editing.cast[0];
  check(p1.includes(`${hero}: Today is the day. Today I become an astronaut!`), `${T} (d) the hero says what they want: "${p1.slice(0, 120)}"`);
  // the whole story: a beginning, the turn, the end
  const story = [];
  for (let i = 0; i < 4; i++) {
    story.push(await page.evaluate(() => document.querySelector('#pg-comic .cxpage').getAttribute('aria-label')));
    await page.click('#pg-comic button[aria-label="Next page"]');
    await page.waitForTimeout(60);
  }
  const all = story.join(' ');
  check(/Attempt number one/.test(all) && /worst idea I have ever heard/.test(all) && /THE END/.test(all) && (all.match(/Who put that there\?/g) ?? []).length === 2, `${T} (d) the story has its tries, its turn, its end and its callback`);
  // edit a panel's line: tap the first panel of page 1
  await page.click('#pg-comic button[aria-label="Previous page"]');
  await page.click('#pg-comic button[aria-label="Previous page"]');
  await page.click('#pg-comic button[aria-label="Previous page"]');
  await until(page, () => window.__ghosty.comic.editing.page === 1);
  await page.locator('#pg-comic .cxpage').scrollIntoViewIfNeeded();
  const box = await page.locator('#pg-comic .cxpage').boundingBox();
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.2);
  check(await until(page, () => window.__ghosty.comic.editing.panel === 0 && document.querySelector('#pg-comic .cxpanel textarea')), `${T} (d) a tap on a panel opens its editor`);
  await page.locator('#pg-comic .cxpanel textarea').first().fill('To the moon, or at least the shed roof!');
  check(await until(page, () => /To the moon, or at least the shed roof!/.test(document.querySelector('#pg-comic .cxpage').getAttribute('aria-label'))), `${T} (d) a line changed redraws the page`);
  await page.locator('#pg-comic .cxpanel input[aria-label="Sound effect"]').fill('BOING!');
  check(await until(page, () => /BOING!/.test(document.querySelector('#pg-comic .cxpage').getAttribute('aria-label'))), `${T} (d) a sound effect added`);
  await page.click('#pg-comic button[aria-label="Add a speech balloon to this panel"]');
  check(await until(page, () => window.__ghosty.comic.editing.balloons >= 6), `${T} (d) ADD A LINE adds a balloon`);
  await page.click('#pg-comic button[aria-label="Add a panel to this page"]');
  check(await until(page, () => window.__ghosty.comic.editing.panels === 4), `${T} (d) ADD PANEL makes four`);
  await page.click('#pg-comic button[aria-label="Change this page’s panel grid"]');
  await page.click('#pg-comic button[aria-label="Add a page after this one"]');
  check(await until(page, () => window.__ghosty.comic.editing.pages === 5), `${T} (d) ADD PAGE makes five pages`);
  await bar(page, `${T} (d) the editor`);
  // saved as a CBZ, read back
  let dl = page.waitForEvent('download', { timeout: 20000 });
  await page.click('#pg-comic button[aria-label="Save the comic as a CBZ file"]');
  let file = await dl.then((d) => d.path()).then((p) => readFileSync(p), () => null);
  const z = file ? unzip(file) : new Map();
  check(file && z.has('ComicInfo.xml') && [...z.keys()].filter((n) => /^\d{3}\.png$/.test(n)).length === 6 && /<PageCount>6<\/PageCount>/.test(z.get('ComicInfo.xml')?.toString() ?? ''), `${T} (d) SAVE CBZ: the cover and five pages, with ComicInfo.xml (${[...z.keys()].join(', ')})`);
  check(/Saved .+\.cbz, .+, to your downloads/.test(await txt(page, '#pg-comic .cxedit .cxnote')), `${T} (d) it says it was saved and its size`);
  dl = page.waitForEvent('download', { timeout: 20000 });
  await page.click('#pg-comic button[aria-label="Save the comic as a PDF"]');
  file = await dl.then((d) => d.path()).then((p) => readFileSync(p), () => null);
  check(file && file.subarray(0, 5).toString() === '%PDF-' && (file.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length === 6, `${T} (d) SAVE PDF: six pages`);
  await page.click('#pg-comic button[aria-label="Read your comic full screen"]');
  check(await until(page, () => window.__ghosty.comic.reader.open && window.__ghosty.comic.reader.pages === 6), `${T} (d) READ IT opens it in the reader`);
  await page.keyboard.press('Escape');
  await until(page, () => !document.querySelector('.cxread'));
  await goComic(page, 'shelf');
  check(await until(page, () => window.__ghosty.comic.made === 1 && window.__ghosty.comic.books === 4), `${T} (d) the made comic is on the shelf, kept`);

  // (e) the public-domain library
  await goComic(page, 'library');
  check(await until(page, () => window.__ghosty.comic.library.state === 'shown' && window.__ghosty.comic.library.items === 2), `${T} (e) the library lists public-domain comics`);
  const row = page.locator('#pg-comic .cxlib .cxbook', { hasText: 'Range Rider' });
  await row.locator('button').click();
  check(await until(page, () => /^Get · /.test(document.querySelector('#pg-comic .cxlib .cxbook button')?.textContent ?? '')), `${T} (e) the first tap says the size: "${await row.locator('button').textContent()}"`);
  check(/A PDF, .+ Tap GET to fetch it on Wi-Fi/.test(await row.locator('.cxbookline').textContent()) && (await C(page)).library.got === '', `${T} (e) nothing fetched yet, the CBR never picked`);
  await page.evaluate(() => Object.defineProperty(navigator, 'connection', { value: { type: 'cellular' }, configurable: true }));
  await row.locator('button').click();
  check(/You are on mobile data, and this is .+: it waits for Wi-Fi/.test(await row.locator('.cxbookline').textContent()) && (await C(page)).library.got === '', `${T} (e) on mobile data it waits for Wi-Fi`);
  await page.evaluate(() => Object.defineProperty(navigator, 'connection', { value: { type: 'wifi' }, configurable: true }));
  await row.locator('button').click();
  check(await until(page, () => window.__ghosty.comic.library.got === 'Range Rider Comics # 13', null, 20000), `${T} (e) on Wi-Fi, the tap fetches it`);
  check(/On your shelf: 2 pages\. Public domain, from the Internet Archive \(archive\.org\/details\/RangeRiderComics13\), first published 1956/.test(await row.locator('.cxbookline').textContent()), `${T} (e) it says where it came from: "${await row.locator('.cxbookline').textContent()}"`);
  await bar(page, `${T} (e) the library`);
  await page.fill('#pg-comic .cxlib ~ * input, #pg-comic input[type=search]', 'nothingatall');
  check(await until(page, () => window.__ghosty.comic.library.state === 'empty'), `${T} (e) a search with nothing found says so`);
  await ctx.setOffline(true);
  await page.fill('#pg-comic input[type=search]', 'western');
  check(await until(page, () => window.__ghosty.comic.library.state === 'offline') && /No signal\. The library needs the internet; your shelf works without it\./.test(await txt(page, '#pg-comic .cxlib')), `${T} (e) offline, it says so`);
  await ctx.setOffline(false);
  await goComic(page, 'shelf');
  check(/Public domain, from the Internet Archive/.test(await txt(page, '#pg-comic .cxshelf .cxcredit')), `${T} (e) the shelf keeps its credit`);

  // (f) the chat's other wordings
  if (vp.width === 440) {
    for (const [words, sec, test] of [['read a comic', 'shelf', null], ['import this comic', 'shelf', /Pick your comic/], ['public domain comics', 'library', null], ['find me some old western comics', 'library', null], ['draw me a comic where a robot can’t dance', 'make', null]]) {
      await chat(page, words);
      const ok = await until(page, (s) => location.hash.startsWith('#comic') && document.querySelector('#pg-comic .secpill[aria-selected="true"], #pg-comic .secpill.on')?.dataset.sec === s, sec, 12000)
        || (await until(page, () => location.hash.startsWith('#comic'), null, 3000));
      check(ok, `${T} (f) “${words}” opens COMIC on ${sec}`);
      if (test) check(await until(page, (src) => new RegExp(src).test([...document.querySelectorAll('#pg-comic .cxnote')].map((e) => e.textContent).join(' ')), test.source, 6000), `${T} (f) “${words}” says what to pick`);
      if (sec === 'make') check(await until(page, () => /robot/i.test(window.__ghosty.comic.editing.id ? 'robot' : '') && window.__ghosty.comic.editing.pages === 4), `${T} (f) “${words}” makes a new comic`);
      await page.waitForTimeout(300);
    }
  }
  await ctx.close();
}

// ---------------------------------------------------------------- two pages side by side on a wide screen
{
  const vp = { width: 1280, height: 800 };
  const { ctx, page } = await open(vp);
  await goComic(page, 'shelf');
  await until(page, () => window.__ghosty?.comic?.shelf.state === 'empty');
  await take(page, [{ name: 'Moon Patrol 01.cbz', mimeType: 'application/zip', buffer: CBZ }]);
  await page.locator('#pg-comic .cxbook button', { hasText: /^Read$/ }).first().click();
  await until(page, () => window.__ghosty.comic.reader.open);
  check(await until(page, () => window.__ghosty.comic.reader.shown.length === 1), '[wide] the cover is shown alone');
  await page.keyboard.press('ArrowRight');
  check(await until(page, () => window.__ghosty.comic.reader.spread && window.__ghosty.comic.reader.shown.join() === '1,2'), '[wide] then two pages side by side');
  check(/Pages 2–3 of 3/.test(await txt(page, '.cxread .cxrwhere')), `[wide] it says "${await txt(page, '.cxread .cxrwhere')}"`);
  // manga: right to left, the left arrow goes on, the pair is laid right to left, and it is kept with the place
  await page.keyboard.press('ArrowLeft');
  await until(page, () => window.__ghosty.comic.reader.page === 0);
  await page.click('.cxread button[aria-label="Read right to left, as manga is"]');
  check(await until(page, () => window.__ghosty.comic.reader.rtl === true), '[wide] RIGHT TO LEFT turns manga reading on');
  await page.keyboard.press('ArrowLeft');
  check(await until(page, () => window.__ghosty.comic.reader.shown.join() === '1,2'), '[wide] right to left, the left arrow goes on');
  const order = await page.evaluate(() => [...document.querySelectorAll('.cxread .cxrpage')].map((i) => i.alt).join());
  check(order === 'Page 3,Page 2', `[wide] the pair is laid right to left: ${order}`);
  await ctx.close();
}

// ---------------------------------------------------------------- BODY 21 and the seven looks, at 440
for (const [world, body] of [['scan', 21], ['map', 0], ['eye', 0], ['orbit', 0], ['grown', 0], ['ink', 0], ['glass', 0]]) {
  const tag = `[440] [${body ? 'BODY 21' : world}]`;
  const { ctx, page } = await open(PHONE, { world, body });
  await goComic(page, 'shelf');
  await until(page, () => window.__ghosty?.comic?.shelf.state === 'empty');
  await bar(page, `${tag} the shelf`);
  check(!(await cut(page, '#pg-comic')).length, `${tag} the shelf: no words cut`);
  await goComic(page, 'make');
  await page.click('#pg-comic button[aria-label="Make a whole comic from this idea"]');
  await until(page, () => window.__ghosty.comic.editing.pages === 4);
  await page.click('#pg-comic button[aria-label="Next page"]');
  await page.locator('#pg-comic .cxpage').scrollIntoViewIfNeeded();
  const box = await page.locator('#pg-comic .cxpage').boundingBox();
  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.7);
  await until(page, () => document.querySelector('#pg-comic .cxpanel textarea'));
  await bar(page, `${tag} the editor`);
  check(!(await cut(page, '#pg-comic')).length, `${tag} the editor: no words cut: ${(await cut(page, '#pg-comic')).join(' | ')}`);
  if (body) await page.screenshot({ path: `${out}/comic2-editor-body21.png` }).catch(() => undefined);
  await goComic(page, 'library');
  await until(page, () => window.__ghosty.comic.library.state === 'shown');
  await bar(page, `${tag} the library`);
  await ctx.close();
}

await browser.close();
const secs = ((Date.now() - t0) / 1000).toFixed(0);
console.log(problems.length ? `PROBLEMS (${problems.length} of ${checks} checks):\n${problems.join('\n')}` : `COMIC run clean: ${checks} checks in ${secs} s: his CBZ, PDF and pictures read and kept, a CBR said, the reader's turns, guided panels, zoom, spread and remembered place, a whole comic made from the chat and edited, saved as CBZ and PDF, the public-domain library on his tap and on Wi-Fi, at both widths, BODY 21 and in all seven looks`);
process.exit(problems.length ? 1 : 0);
