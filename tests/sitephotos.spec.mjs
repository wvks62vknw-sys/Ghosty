// HIS OWN PHOTOS ON HIS SITES (NEXT ROUND sites.u12), the real app at 440 × 956 and 390 × 844. (a) Workshop → Made shows PHOTOS FOR
// YOUR SITES with its empty state in his words; (b) a photo with a GPS position, a phone model and a comment in it is added: it is made
// smaller on the phone and kept with none of that (the kept bytes are read back); (c) a caption is kept; (d) a second photo is made
// the main picture; (e) every key is 44 pt, nothing sideways, BODY 21 cuts no words; (f) "build a website for my café with my photos"
// asks APPROVE saying his photos will be used (declined here: nothing is built); (g) a photo is removed after its confirm; (h) UNDO FOR
// PUBLISHED PAGES (sites.u2): a page updated from the chat goes back to its earlier version with the Workshop's UNDO LAST UPDATE.
//   BASE=http://localhost:8788 node tests/sitephotos.spec.mjs tests/.shots
import { devices } from 'playwright';
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, openSection } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await launch();
const problems = [];
const check = (ok, msg) => {
  if (!ok) problems.push(msg);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
};
const until = (page, fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);
const P = '#pg-workshop [data-panel="sitephotos"]';

async function open(size) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: size, screen: size, ...UK });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => !webkitNoise(e) && errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|401|403|404/.test(m.text()) && errors.push(m.text()));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pair input', { timeout: 15000 });
  await page.fill('#pair input', 'preview-owner-key-0123456789');
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
  await page.waitForTimeout(800);
  return { ctx, page, errors };
}
/** A real JPEG drawn in the page, with a camera's Exif (a GPS position, the phone), XMP and a comment put in after its start. */
async function cameraJpeg(page, w, h, hue) {
  const bytes = await page.evaluate(async ([w, h, hue]) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = `hsl(${hue} 60% 50%)`;
    g.fillRect(0, 0, w, h);
    g.fillStyle = `hsl(${(hue + 180) % 360} 60% 50%)`;
    g.fillRect(w / 4, h / 4, w / 2, h / 2);
    const b = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.9));
    return [...new Uint8Array(await b.arrayBuffer())];
  }, [w, h, hue]);
  const seg = (marker, text) => { const p = Buffer.from(text, 'latin1'); return Buffer.concat([Buffer.from([0xff, marker, (p.length + 2) >> 8, (p.length + 2) & 255]), p]); };
  const jpg = Buffer.from(bytes);
  return Buffer.concat([jpg.subarray(0, 2), seg(0xe1, 'Exif\0\0GPSLatitude 52.4862 N GPSLongitude 1.8904 W Model iPhone 15'), seg(0xe1, 'http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>52.4862</x:xmpmeta>'), seg(0xfe, 'taken at home'), jpg.subarray(2)]);
}
const cards = (page) => page.$$eval(`${P} .sphCard`, (c) => c.map((x) => ({ id: x.dataset.photo, cap: x.querySelector('.sphCap')?.value ?? '', meta: x.querySelector('small')?.textContent ?? '', main: x.querySelector('.sphMain') !== null })));

for (const [W, size] of [[440, PHONE], [390, { width: 390, height: 844 }]]) {
  if (process.env.ONLY && process.env.ONLY !== String(W)) continue;
  console.log(`\n== ${W}`);
  const { ctx, page, errors } = await open(size);
  // a clean start: earlier runs' photos off the list
  await page.evaluate(async () => {
    const h = { 'x-ghosty': '1', 'x-ghosty-key': 'preview-owner-key-0123456789' };
    const j = await (await fetch('/api/sites/photos', { headers: h })).json();
    for (const p of j.photos ?? []) await fetch(`/api/sites/photos?id=${p.id}`, { method: 'DELETE', headers: h });
  });

  // (a) the panel and its empty state
  await page.evaluate(() => (location.hash = 'workshop'));
  await page.waitForSelector('#pg-workshop', { state: 'visible', timeout: 15000 });
  await openSection(page, 'workshop', 'Made');
  check(await until(page, (sel) => /No photos yet/.test(document.querySelector(sel)?.textContent ?? ''), P, 15000), `${W}: (a) PHOTOS FOR YOUR SITES is under Made and says "No photos yet"`);
  const intro = await page.locator(P).textContent();
  check(/made smaller on this phone and its location is removed/.test(intro) && /with my photos/.test(intro) && /right to share/.test(intro), `${W}: (a) it says what happens to a photo and how to use them`);

  // (b) two photos from his phone, with a place in them
  const big = await cameraJpeg(page, 3000, 2000, 30);
  const tall = await cameraJpeg(page, 1200, 1800, 200);
  await page.setInputFiles(`${P} input.sphFile`, [{ name: 'shop-front.jpg', mimeType: 'image/jpeg', buffer: big }, { name: 'IMG_2041.JPG', mimeType: 'image/jpeg', buffer: tall }]);
  check(await until(page, (sel) => document.querySelectorAll(`${sel} .sphCard`).length === 2 && /2 photos kept, smaller and with no location/.test(document.querySelector(`${sel} .sphSaid`)?.textContent ?? ''), P, 30000), `${W}: (b) two photos kept, "smaller and with no location"`);
  let list = await cards(page);
  check(list[0]?.cap === 'shop front' && list[1]?.cap === '', `${W}: (b) a named file gives a caption, a camera number does not: ${JSON.stringify(list.map((x) => x.cap))}`);
  check(/^1600 × 1067 · \d+ KB · no location$/.test(list[0]?.meta ?? '') && /^1067 × 1600/.test(list[1]?.meta ?? ''), `${W}: (b) made smaller on the phone to 1600 on the long side: ${list.map((x) => x.meta).join(' | ')}`);
  const kept = await page.evaluate(async (id) => {
    const r = await fetch(`/i/${id}`);
    const b = new Uint8Array(await r.arrayBuffer());
    let s = '';
    for (const x of b) s += String.fromCharCode(x);
    return { type: r.headers.get('content-type'), gps: /GPS|52\.4862|iPhone|xmpmeta|taken at home/.test(s), exif: s.includes('Exif\0\0'), size: b.length };
  }, list[0].id);
  check(kept.type === 'image/jpeg' && !kept.gps && !kept.exif && kept.size > 1000, `${W}: (b) the kept photo has no location, no phone, no Exif at all: ${JSON.stringify(kept)}`);
  check(list[0].main && !list[1].main, `${W}: (b) the first is the main picture`);

  // (c) a caption
  await page.fill(`${P} .sphCard >> nth=1 >> .sphCap`, 'Flat white on the counter');
  await page.locator(`${P} .sphCard >> nth=1 >> .sphCap`).press('Tab');
  check(await until(page, () => /Caption kept/.test(document.body.textContent ?? ''), null, 8000), `${W}: (c) "Caption kept"`);
  // (d) the second made the main picture
  await page.click(`${P} button[aria-label="Make photo 2 the main picture"]`);
  check(await until(page, (sel) => document.querySelector(`${sel} .sphCard .sphCap`)?.value === 'Flat white on the counter', P, 8000), `${W}: (d) MAKE MAIN puts it first, as the main picture`);
  list = await cards(page);
  check(list[0].main && list[0].cap === 'Flat white on the counter', `${W}: (d) the main picture is marked`);

  // (e) keys 44 pt, nothing sideways, BODY 21 cuts nothing
  for (const body of ['', '21']) {
    await page.evaluate((b) => (b ? (document.documentElement.dataset.body = b) : delete document.documentElement.dataset.body), body);
    await page.waitForTimeout(300);
    const r = await page.evaluate((sel) => {
      const box = document.querySelector(sel);
      const small = [...(box?.querySelectorAll('button, input:not([type=file])') ?? [])].filter((b) => b.getClientRects().length).filter((b) => b.getBoundingClientRect().height < 43.4 || (b.tagName === 'BUTTON' && b.getBoundingClientRect().width < 43.4)).map((b) => b.textContent || b.getAttribute('aria-label'));
      const cut = [...(box?.querySelectorAll('button, p, small, .ptitle') ?? [])].filter((e) => e.getClientRects().length && e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow !== 'visible').map((e) => e.textContent.slice(0, 24));
      return { small, cut, sideways: document.documentElement.scrollWidth > innerWidth };
    }, P);
    check(!r.small.length && !r.cut.length && !r.sideways, `${W}: (e) BODY ${body || 'default'}: 44 pt keys, nothing cut, nothing sideways ${JSON.stringify(r)}`);
  }
  await page.evaluate(() => delete document.documentElement.dataset.body);
  await page.locator(P).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/sitephotos-${W}.png` });

  // (f) the chat: "with my photos" asks APPROVE saying so (declined: nothing is built)
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(400);
  // the conversation open, so his approval card is on screen (the key is pressed until it takes)
  for (let i = 0; i < 6 && !(await page.evaluate(() => !!document.querySelector('#pg-core .hud.core.logopen'))); i++) {
    await page.locator('.logbtn:visible').first().click({ timeout: 3000 }).catch(() => page.evaluate(() => document.querySelector('.logbtn')?.click()));
    await page.waitForTimeout(400);
  }
  await page.waitForSelector('#cin', { state: 'visible', timeout: 15000 });
  await page.fill('#cin', 'build a website for my cafe in Bilston called Little Fern with my photos');
  await page.keyboard.press('Enter');
  const card = await page.waitForSelector('.approval button.on', { state: 'attached', timeout: 30000 }).catch(() => null);
  const reason = card ? await card.evaluate((b) => b.closest('.approval')?.textContent ?? '') : '';
  if (!card) await page.screenshot({ path: `${out}/sitephotos-${W}-noapproval.png` });
  check(/With your own 2 photos \(Workshop → PHOTOS FOR YOUR SITES\), not stock pictures\./.test(reason), `${W}: (f) the approval says his 2 photos will be used: ${reason.slice(0, 220)}`);
  check(!!card && (await card.isVisible()), `${W}: (f) the approval card is on screen in the conversation`);
  if (card) await page.evaluate(() => [...document.querySelectorAll('.approval button')].find((b) => /decline/i.test(b.textContent))?.click());

  // (g) remove one, after its confirm
  await page.evaluate(() => (location.hash = 'workshop'));
  await openSection(page, 'workshop', 'Made');
  await page.waitForSelector(`${P} .sphCard`, { timeout: 15000 });
  await page.click(`${P} button[aria-label="Remove photo 2"]`);
  const sure = await page.waitForSelector('.confirm.sure button:text-is("REMOVE IT"), .confirm.sure button:text-is("Remove it")', { timeout: 8000 }).catch(() => null);
  check(!!sure, `${W}: (g) REMOVE asks first`);
  await sure?.click();
  check(await until(page, (sel) => document.querySelectorAll(`${sel} .sphCard`).length === 1, P, 8000), `${W}: (g) one photo left`);

  // (h) undo for a published page (sites.u2): two versions published from the chat (each APPROVE tapped), UNDO LAST UPDATE in the
  // Workshop after its confirm, and the live page is the first version again
  const slug = `party-site-${W}`;
  const say = async (words) => {
    await page.evaluate(() => (location.hash = 'core'));
    for (let i = 0; i < 6 && !(await page.evaluate(() => !!document.querySelector('#pg-core .hud.core.logopen'))); i++) {
      await page.locator('.logbtn:visible').first().click({ timeout: 3000 }).catch(() => page.evaluate(() => document.querySelector('.logbtn')?.click()));
      await page.waitForTimeout(400);
    }
    const before = await page.$$eval('.approval[data-state="waiting"] button.on', (b) => b.length);
    await page.fill('#cin', words);
    await page.keyboard.press('Enter');
    const ok = await until(page, (n) => document.querySelectorAll('.approval[data-state="waiting"] button.on').length > n, before, 30000);
    if (ok) await page.evaluate(() => [...document.querySelectorAll('.approval[data-state="waiting"] button.on')].pop()?.click());
    return ok;
  };
  const v1 = await say(`publish site ${slug} saying Saturday at 8`);
  // the framed page as its frame loads it (a header only the outside can send)
  const framed = async () => {
    const r = await page.request.get(`${base}/s/${slug}/page`, { headers: { 'sec-fetch-dest': 'iframe' }, maxRedirects: 0 });
    return r.status() === 200 ? r.text() : '';
  };
  const waitFor = async (re, ms) => { for (const end = Date.now() + ms; Date.now() < end; ) { if (re.test(await framed())) return true; await page.waitForTimeout(250); } return false; };
  const v1Live = v1 && (await waitFor(/saturday at 8/i, 20000));
  const v2 = v1Live && (await say(`publish site ${slug} saying Sunday at 9`));
  const read = () => page.evaluate((s) => fetch(`/api/sites`, { headers: { 'x-ghosty': '1', 'x-ghosty-key': 'preview-owner-key-0123456789' } }).then((r) => r.json()).then((j) => j.sites.find((x) => x.name === s)), slug);
  check(v2 && (await waitFor(/sunday at 9/i, 20000)) && (await (async () => { for (let i = 0; i < 40; i++) { const e = await read(); if (e?.versions === 1) return true; await page.waitForTimeout(250); } return false; })()), `${W}: (h) two versions published after APPROVE: one earlier version kept`);
  await page.evaluate(() => (location.hash = 'workshop'));
  await openSection(page, 'workshop', 'Made');
  const undoKey = `#pg-workshop .site[data-site="${slug}"] button[aria-label="Undo the last update to Party"]`;
  check(await until(page, (k) => !!document.querySelector(k), undoKey, 20000), `${W}: (h) the page's card has UNDO LAST UPDATE`);
  const box = await page.$(undoKey);
  const hgt = box ? (await box.boundingBox())?.height ?? 0 : 0;
  check(hgt >= 43.4, `${W}: (h) UNDO LAST UPDATE is 44 pt (${hgt})`);
  await box?.click();
  const put = await page.waitForSelector('.confirm.sure button:text-is("PUT IT BACK"), .confirm.sure button:text-is("Put it back")', { timeout: 8000 }).catch(() => null);
  check(!!put, `${W}: (h) it asks first, saying what is live now is kept`);
  await put?.click();
  check(await waitFor(/saturday at 8/i, 15000), `${W}: (h) the live page is the earlier version again`);
  check(await until(page, () => /the earlier version is live again/.test(document.body.textContent ?? ''), null, 8000), `${W}: (h) it says so`);
  check(errors.length === 0, `${W}: no page error${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
  await ctx.close();
}

await browser.close();
console.log(problems.length ? `\nFAIL sitephotos: ${problems.length} problem(s)\n- ${problems.join('\n- ')}` : '\nPASS sitephotos: his own photos on his sites, smaller and with no location, the main picture his choice, used only after APPROVE');
process.exit(problems.length ? 1 : 0);
