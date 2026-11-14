// PHOTOS (THE APPS ROUND, lane LENS): his private library behind the photo editor, on this phone, at 440 × 956 and 390 × 844.
//   FIRST RUN   sample photos drawn on the phone and said to be samples (never an empty grey screen); the storage line; REMOVE SAMPLES
//   ADD         a photo brought in through the picker: kept, counted, its line updated
//   VIEWER      a photo full screen: FAVOURITE (in Albums → Favourites), DELETE with UNDO, Recently deleted and RECOVER
//   SEARCH      "dog on a beach" finds the dog; "videos" says nothing found in plain words
//   ALBUMS      SELECT two, ALBUM, a new album with both in it; DUPLICATES' KEEP THE BEST (UNDO)
//   FOR YOU     On this day; a memory PLAYs
//   DOORS       PHOTO's shelf has MY LIBRARY; open_photos opens on a search
//   LAYOUT      every key 44 pt, nothing sideways, no page errors
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:8788';
const browser = await chromium.launch();
const problems = [];
const check = (ok, msg) => {
  if (!ok) problems.push(msg);
};

async function run(viewport) {
  const T = `[${viewport.width}]`;
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'en-GB', timezoneId: 'Europe/London' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const until = (fn, arg, ms, what) => page.waitForFunction(fn, arg, { timeout: ms, polling: 100 }).then(() => true).catch(() => (problems.push(`${T} ${what}`), false));
  const S = () => page.evaluate(() => window.__ghosty.photos);
  const seg = (v) => page.click(`#pg-photos .phx-seg[data-v="${v}"]`);
  const key = (text) => page.locator('#pg-photos .phx button, .phx-viewer button, .modal button').filter({ hasText: new RegExp(`^\\s*${text}\\s*$`, 'i') }).first();
  const layout = async (what) => {
    await page.waitForTimeout(550);
    const r = await page.evaluate(() => {
      const root = document.querySelector('#pg-photos .phxhud');
      const keys = [...document.querySelectorAll('#pg-photos .phx button, .phx-viewer:not([hidden]) button')].filter((b) => b.offsetParent !== null && !b.hidden);
      const small = keys.map((b) => ({ t: (b.textContent ?? '').trim().slice(0, 20), r: b.getBoundingClientRect() })).filter((k) => k.r.width < 43.5 || k.r.height < 43.5).map((k) => `${k.t} ${Math.round(k.r.width)}×${Math.round(k.r.height)}`);
      return { small, sideways: root ? root.scrollWidth > root.clientWidth + 1 : true, page: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    check(!r.small.length, `${T} [${what}] keys under 44 pt: ${r.small.join(', ')}`);
    check(!r.sideways && !r.page, `${T} [${what}] something scrolls sideways`);
  };

  await page.goto(BASE);
  await page.fill('#pair input', 'preview-owner-key-0123456789');
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });

  // ---- DOORS: PHOTO's shelf leads to the library
  await page.evaluate(() => (location.hash = 'photo'));
  await page.waitForSelector('#pg-photo .pelibrary', { timeout: 15000 }).catch(() => problems.push(`${T} [doors] PHOTO's shelf has no MY LIBRARY`));
  await page.click('#pg-photo .pelibrary').catch(() => undefined);

  // ---- FIRST RUN: the samples, said to be samples
  await until(() => window.__ghosty?.photos?.state === 'ready' && window.__ghosty.photos.count >= 13, null, 30000, `[first run] the library did not open with its samples: ${JSON.stringify(await page.evaluate(() => window.__ghosty?.photos ?? null))}`);
  check(/^13 photos · \d+ KB on this phone$/.test((await S()).line), `${T} [first run] the storage line reads "${(await S()).line}"`);
  check(await page.locator('#pg-photos .phx-note', { hasText: 'sample photos' }).count() === 1 && await key('REMOVE SAMPLES').count() === 1, `${T} [first run] the samples are not said to be samples, with REMOVE SAMPLES`);
  const months = await page.locator('#pg-photos .phx-month .phx-h').allTextContents();
  check(months.length >= 4 && months.every((t) => /^[A-Z][a-z]+ \d{4} · \d+$/.test(t.trim())), `${T} [first run] the months read ${JSON.stringify(months)}`);
  await layout('library');

  // ---- ADD: a photo through the picker, kept and counted
  await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 640;
    c.height = 480;
    const x = c.getContext('2d');
    x.fillStyle = 'hsl(200 60% 50%)';
    x.fillRect(0, 0, 640, 480);
    x.fillStyle = 'hsl(40 80% 60%)';
    x.fillRect(100, 100, 300, 200);
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.9));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], 'IMG_2001.jpg', { type: 'image/jpeg', lastModified: Date.now() }));
    const input = document.querySelector('#pg-photos .phx input[type="file"]');
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await until(() => window.__ghosty.photos.count === 14 && /^14 photos/.test(window.__ghosty.photos.line), null, 15000, `[add] the picked photo was not kept: ${JSON.stringify(await S())}`);

  // ---- VIEWER: favourite, delete with UNDO, Recently deleted, recover
  const first = (await S()).shown[0];
  await page.click(`#pg-photos .phx-cell[data-id="${first}"]`);
  await until((id) => window.__ghosty.photos.viewer === id, first, 5000, '[viewer] the photo did not open full screen');
  await layout('viewer');
  await page.locator('.phx-viewer button', { hasText: 'Favourite' }).click();
  await page.waitForTimeout(300);
  await page.locator('.phx-viewer button', { hasText: /^\s*delete\s*$/i }).click();
  await until(() => !window.__ghosty.photos.viewer && window.__ghosty.photos.count === 13, null, 5000, `[viewer] DELETE did not take it out of the library: ${JSON.stringify(await S())}`);
  await page.locator('.undofloat button', { hasText: 'UNDO' }).click({ timeout: 5000 }).catch(() => problems.push(`${T} [viewer] no UNDO after DELETE`));
  await until(() => window.__ghosty.photos.count === 14, null, 5000, '[viewer] UNDO did not bring it back');
  await seg('albums');
  await until(() => window.__ghosty.photos.view === 'albums' && document.querySelector('#pg-photos .phx-tile[aria-label^="Favourites, 1"]'), null, 5000, '[albums] Favourites does not hold the favourite');
  await layout('albums');
  // places come only from the photos' own data: none of these carries any, and it says so
  check(/none yet/.test(await page.locator('#pg-photos .phx-row', { hasText: 'Places' }).textContent().catch(() => '')), `${T} [albums] Places does not say there are none yet`);
  // delete it again, find it in Recently deleted, recover it
  await seg('library');
  await page.click(`#pg-photos .phx-cell[data-id="${first}"]`);
  await page.locator('.phx-viewer button', { hasText: /^\s*delete\s*$/i }).click();
  await until(() => window.__ghosty.photos.count === 13, null, 5000, '[bin] the second DELETE did not take');
  await seg('albums');
  await page.locator('#pg-photos .phx-row', { hasText: 'Recently deleted' }).click();
  await until(() => window.__ghosty.photos.sub === 'deleted' && document.querySelectorAll('#pg-photos .phx-cell .phx-days').length === 1, null, 5000, '[bin] Recently deleted does not hold it with its days left');
  check(/^30 days$/.test(await page.locator('#pg-photos .phx-days').first().textContent()), `${T} [bin] it does not say 30 days`);
  await page.locator('#pg-photos .phx-cell').first().click();
  await page.locator('.phx-viewer button', { hasText: 'RECOVER' }).click();
  await until(() => window.__ghosty.photos.count === 14, null, 5000, '[bin] RECOVER did not bring it back');

  // ---- SEARCH: by what is in a photo, and nothing found said plainly
  await seg('search');
  await page.fill('#pg-photos .phx-search', 'dog on a beach');
  await until(() => window.__ghosty.photos.search.results === 1, null, 5000, `[search] "dog on a beach" found ${(await S()).search.results}`);
  await page.fill('#pg-photos .phx-search', 'videos');
  await until(() => window.__ghosty.photos.search.q === 'videos' && window.__ghosty.photos.search.results === 0 && !!document.querySelector('#pg-photos .phx-results [data-state="empty"]'), null, 5000, '[search] "videos" did not say nothing was found');
  await layout('search');

  // ---- ALBUMS: two photos into a new album
  await seg('library');
  await page.locator('#pg-photos .phx-select').click();
  const two = (await S()).shown.slice(1, 3);
  for (const id of two) await page.click(`#pg-photos .phx-cell[data-id="${id}"]`);
  await until(() => window.__ghosty.photos.selected.length === 2, null, 3000, '[album] two photos were not selected');
  await layout('selecting');
  await page.locator('#pg-photos .phx-selbar button', { hasText: /album/i }).click();
  await page.fill('.modal .phx-newalbum input', 'Holidays');
  await page.locator('.modal .phx-newalbum button').click();
  await seg('albums');
  await until(() => window.__ghosty.photos.albums.some((a) => a.name === 'Holidays' && a.count === 2), null, 5000, `[album] the new album: ${JSON.stringify((await S()).albums)}`);

  // ---- DUPLICATES: the best kept, the copy to Recently deleted, UNDO
  await page.locator('#pg-photos .phx-row', { hasText: 'Duplicates' }).click();
  await until(() => window.__ghosty.photos.sub === 'duplicates' && document.querySelectorAll('#pg-photos .phx-best').length === 1, null, 5000, `[dupes] the sunset kept twice is not one group with its best: ${(await S()).dupes}`);
  await key('KEEP THE BEST').click();
  await until(() => window.__ghosty.photos.count === 13, null, 5000, '[dupes] KEEP THE BEST did not move the copy out');
  await page.locator('.undofloat button', { hasText: 'UNDO' }).click({ timeout: 5000 }).catch(() => problems.push(`${T} [dupes] no UNDO`));
  await until(() => window.__ghosty.photos.count === 14, null, 5000, '[dupes] UNDO did not bring the copy back');

  // ---- FOR YOU: On this day and a memory that plays
  await seg('foryou');
  await until(() => !!document.querySelector('#pg-photos .phx-tile[aria-label^="A year ago"]') && window.__ghosty.photos.memories.length >= 1, null, 5000, `[for you] no On this day or memory: ${JSON.stringify((await S()).memories)}`);
  await layout('for you');
  await page.locator('#pg-photos .phx-tile').filter({ hasText: /days in/ }).first().click();
  await key('PLAY').click();
  await until(() => !!window.__ghosty.photos.playing && !!window.__ghosty.photos.viewer, null, 5000, '[for you] PLAY did not play the memory');
  await page.locator('.phx-viewer button', { hasText: 'Close' }).click();

  // ---- DOORS: open_photos on a search
  await page.evaluate(() => window.__ghosty.run('open_photos', { q: 'sunset' }));
  await until(() => window.__ghosty.photos.view === 'search' && window.__ghosty.photos.search.q === 'sunset' && window.__ghosty.photos.search.results >= 2, null, 8000, `[doors] open_photos did not open on its search: ${JSON.stringify((await S()).search)}`);

  check(!errors.length, `${T} page errors: ${errors.slice(0, 3).join(' | ')}`);
  await ctx.close();
}

await run({ width: 440, height: 956 });
await run({ width: 390, height: 844 });
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'photos clean at 440 and 390: sample photos on the first run, said to be samples; a picked photo kept and counted; a favourite in Favourites; DELETE with UNDO, Recently deleted with its 30 days and RECOVER; "dog on a beach" found and "videos" said not found; two photos into a new album; the sunset kept twice found with its best shot and KEEP THE BEST undone; On this day and a memory that plays; PHOTO\'s MY LIBRARY and open_photos on a search; every key 44 pt and nothing sideways.');
process.exit(problems.length ? 1 : 0);
