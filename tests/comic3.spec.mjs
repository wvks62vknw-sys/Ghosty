// THE COMIC, next round (comic3), the real app at 440 × 956 and 390 × 844: (a) YOUR WEEK AS A COMIC: with nothing in his week it
// says so in his words; with a to-do ticked this week, "make my week into a comic" in the chat makes it (Ghosty writes it, his
// name is the hero), and with no signal the phone's own week comic has a panel a day and the last word; (b) the reader's
// thumbnail strip, bookmarks, night tint and reading log; (c) the shelf's search, sort and read marks; (d) every key 44 pt and
// nothing sideways, at BODY 21 too.
//   BASE=http://localhost:8788 node tests/comic3.spec.mjs tests/.shots
import { launch, webkitNoise } from './browser.mjs';
import { UK } from './nav.mjs';
import { mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

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

// ---- a page picture made here (paper with drawn panels), and a CBZ of them
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
function pagePng(w, h, panels, tint) {
  const px = Buffer.alloc(w * h * 3, 255);
  for (const [x0, y0, pw, ph] of panels) for (let y = y0; y < y0 + ph; y++) for (let x = x0; x < x0 + pw; x++) {
    const i = (y * w + x) * 3;
    const edge = x < x0 + 4 || x >= x0 + pw - 4 || y < y0 + 4 || y >= y0 + ph - 4;
    px[i] = edge ? 0 : tint[0];
    px[i + 1] = edge ? 0 : tint[1];
    px[i + 2] = edge ? 0 : (x + y) % 255;
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
const cbz = (title, n) => zip(Array.from({ length: n }, (_, i) => ({ name: `${title}/${String(i + 1).padStart(3, '0')}.png`, data: pagePng(300, 450, [[10, 10, 280, 210], [10, 230, 280, 210]], [40 * i, 120, 200]) })));

const live = [];
async function open(viewport, o = {}) {
  const ctx = await browser.newContext({ viewport, screen: viewport, deviceScaleFactor: 1, isMobile: true, hasTouch: true, acceptDownloads: true, ...UK, serviceWorkers: 'block' });
  live.push(ctx);
  await ctx.route(/^https:\/\/(?!localhost)/, (route) => route.fulfill({ status: 404, body: '' }));
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${viewport.width}] pageerror: ${e.message}`));
  await page.addInitScript(({ key, body, todos }) => {
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.themes1', '1');
    localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Tony', speak: false, sounds: false, theme: 'reactor', favourites: [], look: { ground: 'graphite', world: 'scan', night: 'graphite', switches: body ? { body } : {} }, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
    if (todos && !sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('ghosty.agenda.todo', JSON.stringify(todos.map((t) => ({ ...t, doneAt: Date.now() - t.ago }))));
    }
    window.__ghostyHero = true;
  }, { key: KEY, body: o.body ?? 0, todos: o.todos ?? null });
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
  await page.waitForTimeout(400);
};
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
async function bar(page, tag, root = '#pg-comic') {
  check(!(await sideways(page, root)), `${tag}: nothing sideways`);
  const s = await small(page, root);
  check(!s.length, `${tag}: every key 44 pt: ${s.join(', ')}`);
}
async function chat(page, words) {
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForSelector('#cin', { state: 'visible', timeout: 15000 });
  await page.fill('#cin', words);
  await page.keyboard.press('Enter');
}
const TODOS = [{ id: 't1', text: 'Call the bank', due: '', done: true, at: Date.now() - 86_400_000, ago: 60_000 }, { id: 't2', text: 'Book the dentist', due: '', done: true, at: Date.now() - 86_400_000, ago: 120_000 }];

for (const vp of [PHONE, PHONE2]) {
  const T = `[${vp.width}]`;
  console.log(`\n== ${T}`);
  // (a) his week, empty first
  {
    const { ctx, page } = await open(vp);
    await goComic(page, 'make');
    await page.click('#pg-comic button[aria-label="Make a comic of my week from my agenda"]');
    check(await until(page, () => window.__ghosty.comic.editing.week === 0 && /Nothing in your week yet/.test(document.querySelector('#pg-comic .cx')?.textContent ?? '')), `${T} (a) with nothing in his week it says so, with what to do`);
    await bar(page, `${T} (a) MAKE`);
    await ctx.close();
  }
  {
    const { ctx, page } = await open(vp, { todos: TODOS });
    await chat(page, 'make my week into a comic');
    check(await until(page, () => location.hash.startsWith('#comic') && window.__ghosty.comic.editing.week === 2 && window.__ghosty.comic.editing.by === 'brain' && window.__ghosty.comic.editing.pages > 0, null, 20000), `${T} (a) "make my week into a comic" makes it, Ghosty writing from his two ticked to-dos`);
    check((await C(page)).editing.cast[0] === 'Tony', `${T} (a) he is the hero: ${(await C(page)).editing.cast.join(', ')}`);
    // with no signal, the phone's own week comic
    await page.click('#pg-comic button[aria-label="Start a new comic from an idea"]');
    await ctx.setOffline(true);
    await page.click('#pg-comic button[aria-label="Make a comic of my week from my agenda"]');
    check(await until(page, () => window.__ghosty.comic.editing.by === 'phone' && window.__ghosty.comic.editing.title === 'Tony’s Week'), `${T} (a) with no signal the phone makes "Tony’s Week"`);
    await page.click('#pg-comic button[aria-label="Next page"]');
    const p1 = await page.evaluate(() => document.querySelector('#pg-comic .cxpage').getAttribute('aria-label'));
    check(/Ticked off: (Call the bank|Book the dentist)/.test(p1) && /THE END… until next week\./.test(p1) && /Done\. Look at me, getting things done\./.test(p1), `${T} (a) a panel for the day, a line for it, and the last word: "${p1.slice(0, 160)}"`);
    await ctx.setOffline(false);
    await bar(page, `${T} (a) the week comic`);
    await ctx.close();
  }
}

await browser.close();
const secs = ((Date.now() - t0) / 1000).toFixed(0);
console.log(problems.length ? `PROBLEMS (${problems.length} of ${checks} checks):\n${problems.join('\n')}` : `COMIC next round run clean: ${checks} checks in ${secs} s: his week as a comic, written by Ghosty or by the phone, empty said, at both widths`);
process.exit(problems.length ? 1 : 0);
