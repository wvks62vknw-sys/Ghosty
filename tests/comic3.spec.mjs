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
const agendaAsked = [];
async function open(viewport, o = {}) {
  const ctx = await browser.newContext({ viewport, screen: viewport, deviceScaleFactor: 1, isMobile: true, hasTouch: true, acceptDownloads: true, ...UK, serviceWorkers: 'block' });
  live.push(ctx);
  await ctx.route(/^https:\/\/(?!localhost)/, (route) => route.fulfill({ status: 404, body: '' }));
  // (his agenda is this spec's own: empty, so the week is exactly the to-dos it seeds)
  // (and his to-do list too: the one list lives in the brain, which keeps what other runs left; here it is exactly this run's)
  await ctx.route(/\/api\/packs\/do$/, async (route) => {
    const b = JSON.parse(route.request().postData() ?? '{}');
    if (b.pack !== 'work' || b.action !== 'todo') return route.continue();
    const list = (o.todos ?? []).map((t) => ({ ...t, doneAt: Date.now() - t.ago }));
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'ok', data: { list, added: 0 } }) });
  });
  await ctx.route(/\/api\/agenda\?/, (route) => (agendaAsked.push(route.request().url()), route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tz: 'Europe/London', events: [], errors: [], jobs: [], feeds: [] }) })));
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${viewport.width}] pageerror: ${e.message}`));
  await page.addInitScript(({ key, body, todos }) => {
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.themes1', '1');
    localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Tony', speak: false, sounds: false, theme: 'reactor', favourites: [], look: { ground: 'graphite', world: 'scan', night: 'graphite', switches: body ? { body } : {} }, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
    if (!todos && !sessionStorage.getItem('seeded')) localStorage.setItem('ghosty.agenda.todo', '[]');
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
    // the week is asked for from its Monday, not from today (a Friday's Monday to Thursday are in it)
    const mon = await page.evaluate(() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); });
    check(agendaAsked.some((u) => new URL(u).searchParams.get('from') === String(mon) && new URL(u).searchParams.get('days') === '7'), `${T} (a) the agenda is read from this week's Monday: ${agendaAsked.slice(-1)[0]?.slice(-60)}`);
    // a page turned is no change: UNDO stays dark, and the drag mode ends with the chosen panel
    await page.click('#pg-comic button[aria-label="Next page"]');
    await page.click('#pg-comic button[aria-label="Next page"]');
    check(await until(page, () => window.__ghosty.comic.editing.undo === 0 && document.querySelector('#pg-comic button[aria-label="Undo the last change"]').disabled), `${T} (a) turning pages is no change: UNDO stays dark (${(await C(page)).editing.undo})`);
    // a panel picked takes the finger for dragging; another page, and the page scrolls again
    await page.locator('#pg-comic .cxpage').scrollIntoViewIfNeeded();
    const bb = await page.locator('#pg-comic .cxpage').boundingBox();
    await page.mouse.click(bb.x + bb.width * 0.3, bb.y + bb.height * 0.7);
    check(await until(page, () => window.__ghosty.comic.editing.panel >= 0 && document.querySelector('#pg-comic .cxpage').classList.contains('cxdrag')), `${T} (a) a panel picked: the page takes the finger for dragging (panel ${(await C(page)).editing.panel})`);
    await page.click('#pg-comic button[aria-label="Previous page"]');
    check(await until(page, () => !document.querySelector('#pg-comic .cxpage').classList.contains('cxdrag')), `${T} (a) another page: no panel picked, the page scrolls again`);
    // MAKE closed and opened again from the chat: the week lands on the screen he sees
    await goComic(page, 'shelf');
    await chat(page, 'a comic of my week');
    check(await until(page, () => location.hash.startsWith('#comic') && !!document.querySelector('#pg-comic .cxpage')?.getClientRects().length && window.__ghosty.comic.editing.pages > 0, null, 20000), `${T} (a) asked again after MAKE was put away, the week comic is on screen`);
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
  // (b) the reader: the page strip, a bookmark, the night tint, turning by itself; (c) the shelf: search, sort, read marks, the log
  {
    const { ctx, page } = await open(vp);
    await goComic(page, 'shelf');
    await until(page, () => window.__ghosty?.comic?.shelf.state === 'empty');
    for (const [t, n] of [['Zebra Patrol', 4], ['Apple Squad', 3]]) {
      await page.setInputFiles('#pg-comic .cx input[type=file][accept]', [{ name: `${t}.cbz`, mimeType: 'application/zip', buffer: cbz(t, n) }]);
      await until(page, (title) => window.__ghosty.comic.import.state === 'done' && window.__ghosty.comic.last === title, t, 15000);
    }
    check(/Your reading log starts when you read/.test(await txt(page, '#pg-comic .cxlog')), `${T} (c) before any reading, the log says how it starts`);
    await page.selectOption('#pg-comic select[aria-label="Sort"]', 'title');
    check(await until(page, () => window.__ghosty.comic.shelf.titles.join() === 'Apple Squad,Zebra Patrol'), `${T} (c) SORT by title`);
    await page.fill('#pg-comic input[aria-label="Find a comic on my shelf"]', 'zeb');
    check(await until(page, () => window.__ghosty.comic.shelf.titles.join() === 'Zebra Patrol'), `${T} (c) FIND narrows the shelf`);
    await page.fill('#pg-comic input[aria-label="Find a comic on my shelf"]', 'nothing like it');
    check(await until(page, () => /No comic on your shelf matches “nothing like it”/.test(document.querySelector('#pg-comic .cxshelf')?.textContent ?? '')), `${T} (c) nothing found is said`);
    await page.fill('#pg-comic input[aria-label="Find a comic on my shelf"]', '');
    await until(page, () => window.__ghosty.comic.shelf.titles.length === 2);
    await bar(page, `${T} (c) the shelf with its search`);
    // read Zebra Patrol to the end with the strip, a bookmark, the night tint and AUTO
    await page.locator('#pg-comic .cxbook', { hasText: 'Zebra Patrol' }).locator('button', { hasText: /^Read$/ }).click();
    await until(page, () => window.__ghosty.comic.reader.open && document.querySelector('.cxread .cxrpage')?.complete);
    await page.click('.cxread button[aria-label="Show every page as a strip of small pictures"]');
    check(await until(page, () => document.querySelectorAll('.cxread .cxrthumb').length === 4 && document.querySelectorAll('.cxread .cxrthumb img').length >= 1), `${T} (b) PAGES shows the strip, its pictures filling in`);
    await page.click('.cxread .cxrthumb[data-n="2"]');
    check(await until(page, () => window.__ghosty.comic.reader.page === 2 && document.querySelector('.cxread .cxrthumb[data-n="2"]').classList.contains('on')), `${T} (b) a tap on a page in the strip goes there`);
    await page.click('.cxread button[aria-label="Bookmark page 3"]');
    check(await until(page, () => window.__ghosty.comic.reader.marks.join() === '2' && document.querySelector('.cxread .cxrthumb[data-n="2"]').classList.contains('marked')), `${T} (b) BOOKMARK marks the page, in the strip too`);
    await page.click('.cxread button[aria-label^="Night reading"]');
    check(await until(page, () => window.__ghosty.comic.reader.night && document.querySelector('.cxread').classList.contains('night')), `${T} (b) NIGHT tints the page`);
    await bar(page, `${T} (b) the reader with its strip`, '.cxread');
    await page.click('.cxread button[aria-label="Turn the pages by themselves"]');
    check(await until(page, () => window.__ghosty.comic.reader.auto === 8 && window.__ghosty.comic.reader.page === 3, null, 12000), `${T} (b) AUTO turns the page by itself (every 8 s)`);
    check(await until(page, () => window.__ghosty.comic.reader.auto === 0, null, 12000), `${T} (b) AUTO stops at the last page`);
    await page.click('.cxread button[aria-label="Close the comic"]');
    await until(page, () => !document.querySelector('.cxread'));
    check(await until(page, () => window.__ghosty.comic.shelf.log.pages >= 2 && /This month: \d+ pages read/.test(document.querySelector('#pg-comic .cxlog')?.textContent ?? '')), `${T} (c) the reading log counts the pages read: "${await txt(page, '#pg-comic .cxlog')}"`);
    check(/^Read · /.test(await page.locator('#pg-comic .cxbook', { hasText: 'Zebra Patrol' }).locator('.cxbookline').textContent()) && /^Unread · /.test(await page.locator('#pg-comic .cxbook', { hasText: 'Apple Squad' }).locator('.cxbookline').textContent()), `${T} (c) READ and UNREAD marks on the shelf`);
    await page.selectOption('#pg-comic select[aria-label="Show"]', 'unread');
    check(await until(page, () => window.__ghosty.comic.shelf.titles.join() === 'Apple Squad'), `${T} (c) SHOW unread`);
    await page.selectOption('#pg-comic select[aria-label="Show"]', 'all');
    // reopened, the bookmark and the night tint are kept
    await page.locator('#pg-comic .cxbook', { hasText: 'Zebra Patrol' }).locator('button', { hasText: /^Read$/ }).click();
    await until(page, () => window.__ghosty.comic.reader.open);
    check(await until(page, () => window.__ghosty.comic.reader.marks.join() === '2' && window.__ghosty.comic.reader.night), `${T} (b) the bookmark and the night tint are kept`);
    await page.keyboard.press('Escape');
    await until(page, () => !document.querySelector('.cxread'));
    // (d) the new exports: the phone scroll, the panels, the booklet
    await goComic(page, 'make');
    await page.selectOption('#pg-comic select[aria-label="Who writes it"]', 'phone');
    await page.click('#pg-comic button[aria-label="Make a whole comic from this idea"]');
    await until(page, () => window.__ghosty.comic.editing.pages === 4);
    for (const [label, kind, test] of [['Save the comic as one long picture to scroll on a phone', 'jpg', /-scroll\.jpg, .+: the whole comic as one long picture/], ['Save every panel as its own picture', 'zip', /-panels\.zip, .+: 14 panels, each its own picture/], ['Save a PDF to print, fold and staple into a booklet', 'pdf', /-booklet\.pdf, .+: print it on both sides/]]) {
      const dl = page.waitForEvent('download', { timeout: 20000 });
      await page.click(`#pg-comic button[aria-label="${label}"]`);
      const d = await dl.catch(() => null);
      check(!!d && d.suggestedFilename().endsWith(`.${kind}`) && test.test(await txt(page, '#pg-comic .cxedit .cxnote')), `${T} (d) ${label}: ${d?.suggestedFilename()} — "${(await txt(page, '#pg-comic .cxedit .cxnote')).slice(0, 100)}"`);
    }
    // (e) translate its words (comic.s12), and UNDO puts them back
    await page.click('#pg-comic summary:has-text("Translate its words")');
    await page.selectOption('#pg-comic select[aria-label="Translate into"]', 'Spanish');
    await page.click('#pg-comic button[aria-label="Translate every balloon and caption"]');
    check(await until(page, () => window.__ghosty.comic.editing.translated === 'Spanish' && /Translated \d+ of \d+ lines into Spanish/.test(document.querySelector('#pg-comic .cxedit .cxnote')?.textContent ?? '')), `${T} (e) TRANSLATE puts every line into Spanish: "${(await txt(page, '#pg-comic .cxedit .cxnote')).slice(0, 80)}"`);
    check(/\(sp\) /.test(await page.evaluate(() => document.querySelector('#pg-comic .cxpage').getAttribute('aria-label'))), `${T} (e) the page shows the new words`);
    await page.click('#pg-comic button[aria-label="Undo the last change"]');
    check(await until(page, () => !/\(sp\) /.test(document.querySelector('#pg-comic .cxpage').getAttribute('aria-label'))), `${T} (e) UNDO puts the old words back`);
    // (f) his own look, picked by hand and kept, cast again (comic.u8)
    await page.click('#pg-comic summary:has-text("The cast")');
    const hero = (await C(page)).editing.cast[0];
    await page.click(`#pg-comic summary:has-text("Pick ${hero}’s look by hand")`);
    await page.selectOption(`#pg-comic select[aria-label="${hero}’s hair"]`, 'Red');
    await page.selectOption(`#pg-comic select[aria-label="${hero}’s glasses"]`, 'yes');
    await page.click(`#pg-comic button[aria-label="Keep ${hero}’s look to cast again"]`);
    check(await until(page, (n) => JSON.parse(localStorage.getItem('ghosty.comic.people') ?? '[]').some((p) => p.name === n && p.look.hair === '#b8342f' && p.look.glasses), hero), `${T} (f) KEEP THIS LOOK keeps ${hero}’s hand-picked look on the phone`);
    await page.selectOption('#pg-comic select[aria-label="Cast someone I saved"]', hero);
    check(await until(page, (n) => window.__ghosty.comic.editing.cast.filter((x) => x === n).length === 2, hero), `${T} (f) CAST SOMEONE I SAVED puts them in the comic`);
    check((await C(page)).saved.count === 4, `${T} (d) the booklet is 2 sheets, 4 sides, for 5 pages padded to 8 (${(await C(page)).saved.count} sides)`);
    await bar(page, `${T} (d) the editor with its exports`);
    await ctx.close();
  }
  // (g) the other shapes (comic.s5, s6, s2): a one-panel joke, a greeting card, a picture book; and "make it a comic" (comic.c6)
  {
    const { ctx, page } = await open(vp);
    await goComic(page, 'make');
    await page.selectOption('#pg-comic select[aria-label="Who writes it"]', 'phone');
    for (const [fmt, words, test] of [['joke', 'a dog who wants to drive', (st) => st.pages === 1 && st.panels === 1], ['card', 'a birthday card for Dad', (st) => st.pages === 1 && st.panels === 3 && /Happy Birthday, Dad/.test(st.title)], ['book', 'a little bear who wants to fly', (st) => st.pages === 6 && st.panels === 1]]) {
      if (await page.$('#pg-comic button[aria-label="Start a new comic from an idea"]')) await page.click('#pg-comic button[aria-label="Start a new comic from an idea"]');
      await page.selectOption('#pg-comic select[aria-label="What to make"]', fmt);
      await page.fill('#pg-comic textarea', words);
      await page.click('#pg-comic button[aria-label="Make a whole comic from this idea"]');
      await until(page, () => window.__ghosty.comic.editing.pages > 0 && window.__ghosty.comic.editing.by === 'phone');
      await page.click('#pg-comic button[aria-label="Next page"]');
      await page.waitForTimeout(150);
      const st = (await C(page)).editing;
      check(test(st), `${T} (g) ${fmt}: ${st.pages} page(s), ${st.panels} panel(s) on the first, "${st.title}"`);
    }
    // issue 2 with the same cast (comic.u3), and the comic read aloud, a voice a character (comic.u12)
    await page.click('#pg-comic button[aria-label="Start a new comic from an idea"]');
    await page.selectOption('#pg-comic select[aria-label="What to make"]', 'comic');
    await page.fill('#pg-comic textarea', 'a robot who wants to bake bread');
    await page.click('#pg-comic button[aria-label="Make a whole comic from this idea"]');
    await until(page, () => window.__ghosty.comic.editing.pages === 4 && window.__ghosty.comic.editing.by === 'phone');
    const first = await C(page);
    await page.click('#pg-comic button[aria-label="Make issue 2 with the same cast"]');
    check(await until(page, (t) => window.__ghosty.comic.editing.series === 2 && window.__ghosty.comic.editing.title !== t, first.editing.title), `${T} (g) ISSUE 2 makes the next issue`);
    const second = await C(page);
    check(second.editing.cast.join() === first.editing.cast.join() && /, No\. 2$/.test(second.editing.title), `${T} (g) …with the same cast, numbered: "${second.editing.title}" (${second.editing.cast.join(', ')})`);
    check(/^The cover: .+, No\. 2/.test(await page.evaluate(() => document.querySelector('#pg-comic .cxpage').getAttribute('aria-label'))), `${T} (g) its cover says No. 2`);
    await page.click('#pg-comic button[aria-label="Read your comic full screen"]');
    await until(page, () => window.__ghosty.comic.reader.open);
    await page.click('.cxread button[aria-label="Read the comic aloud, a voice for each character"]');
    check(await until(page, () => window.__ghosty.comic.reader.aloud.on && window.__ghosty.comic.reader.guided && window.__ghosty.comic.reader.aloud.lines >= 1), `${T} (g) READ ALOUD reads panel by panel in the guided view`);
    check(await until(page, () => window.__ghosty.comic.reader.page >= 1 && window.__ghosty.comic.reader.aloud.lines >= 3, null, 20000), `${T} (g) …and goes on to the next panels by itself (${(await C(page)).reader.aloud.lines} lines, page ${(await C(page)).reader.page + 1})`);
    await page.click('.cxread button[aria-pressed="true"]:has-text("Stop reading")');
    check(await until(page, () => !window.__ghosty.comic.reader.aloud.on), `${T} (g) STOP READING stops it`);
    await page.keyboard.press('Escape');
    await until(page, () => !document.querySelector('.cxread'));
    // Ghosty writes a joke too, kept to one panel whatever comes back
    await page.click('#pg-comic button[aria-label="Start a new comic from an idea"]');
    await page.selectOption('#pg-comic select[aria-label="Who writes it"]', 'ghosty');
    await page.selectOption('#pg-comic select[aria-label="What to make"]', 'joke');
    await page.fill('#pg-comic textarea', 'a dog who wants to drive');
    await page.click('#pg-comic button[aria-label="Make a whole comic from this idea"]');
    check(await until(page, () => window.__ghosty.comic.editing.by === 'brain' && window.__ghosty.comic.editing.pages === 1, null, 20000), `${T} (g) Ghosty's joke is one page`);
    await page.click('#pg-comic button[aria-label="Next page"]');
    check(await until(page, () => window.__ghosty.comic.editing.panels === 1), `${T} (g) …of one panel`);
    await bar(page, `${T} (g) MAKE with its shapes`);
    // "make it a comic": what I last said becomes the comic
    await page.selectOption('#pg-comic select[aria-label="What to make"]', 'comic').catch(() => undefined);
    // (his message found by when it was sent, data-at, and the reply after it waited for: never a fixed sleep)
    const t0 = await page.evaluate(() => Date.now());
    await chat(page, 'what is the weather like');
    const said = await page.waitForFunction((t) => {
      const msgs = [...document.querySelectorAll('#pg-core .msg')];
      const mine = msgs.map((m) => m.classList.contains('me') && Number(m.dataset.at ?? 0) >= t).lastIndexOf(true);
      if (mine < 0) return null;
      const r = msgs.slice(mine + 1).find((m) => !m.classList.contains('me') && (m.textContent ?? '').replace(/\s+/g, ' ').trim().length > 20);
      return r ? (r.textContent ?? '').replace(/\s+/g, ' ').trim() : null;
    }, t0, { timeout: 20000 }).then((h) => h.jsonValue(), () => '');
    check(!!said, `${T} (g) Ghosty answered first: "${said.slice(0, 60)}"`);
    await chat(page, 'make it a comic');
    check(await until(page, () => location.hash.startsWith('#comic') && window.__ghosty.comic.editing.pages > 0 && window.__ghosty.comic.editing.writing === false, null, 20000), `${T} (g) “make it a comic” makes a comic`);
    // (and built from that reply: its first words are the comic's opening caption)
    await page.click('#pg-comic button[aria-label="Next page"]');
    const p1 = await page.evaluate(() => (document.querySelector('#pg-comic .cxpage').getAttribute('aria-label') ?? '').replace(/\s+/g, ' '));
    const head = (/as a comic: (.{24})/.exec(p1)?.[1] ?? '').trim();
    check(head.length >= 20 && said.includes(head), `${T} (g) …made from what I last said ("${head}" is in the reply "${said.slice(0, 90)}")`);
    await ctx.close();
  }
}

await browser.close();
const secs = ((Date.now() - t0) / 1000).toFixed(0);
console.log(problems.length ? `PROBLEMS (${problems.length} of ${checks} checks):\n${problems.join('\n')}` : `COMIC next round run clean: ${checks} checks in ${secs} s: his week as a comic, written by Ghosty or by the phone, empty said, at both widths`);
process.exit(problems.length ? 1 : 0);
