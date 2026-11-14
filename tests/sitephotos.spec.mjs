// HIS OWN PHOTOS ON HIS SITES (NEXT ROUND sites.u12), the real app at 440 × 956 and 390 × 844. (a) Workshop → Made shows PHOTOS FOR
// YOUR SITES with its empty state in his words; (b) a photo with a GPS position, a phone model and a comment in it is added: it is made
// smaller on the phone and kept with none of that (the kept bytes are read back); (c) a caption is kept; (d) a second photo is made
// the main picture; (e) every key is 44 pt, nothing sideways, BODY 21 cuts no words; (f) "build a website for my café with my photos"
// asks APPROVE saying his photos will be used (declined here: nothing is built); (g) a photo is removed after its confirm; (h) UNDO FOR
// PUBLISHED PAGES (sites.u2): a page updated from the chat goes back to its earlier version with the Workshop's UNDO LAST UPDATE;
// (i) a document and (j) a deck at their own link after APPROVE (sites.s4, s3); (k) a mini-app changed after it is made (sites.u6); (l) one home page listing the pages he chose (sites.u8); (m) a page's QR code and an A4 poster (sites.s2, u4); (n) a page's check-up (sites.u9); (o) a sheet as a list app (sites.s8).
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
  check(v2 && (await waitFor(/sunday at 9/i, 20000)) && (await (async () => { for (let i = 0; i < 40; i++) { const e = await read(); if ((e?.versions ?? 0) >= 1) return true; await page.waitForTimeout(250); } return false; })()), `${W}: (h) two versions published after APPROVE: one earlier version kept`);
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

  // (i) a document at its own link (sites.s4): DOCS → PUT IT ON MY SITES hands the page over and asks in the chat; APPROVE puts it up
  const approveNext = async (before) => {
    const ok = await until(page, (n) => document.querySelectorAll('.approval[data-state="waiting"] button.on').length > n, before, 30000);
    const reason = ok ? await page.evaluate(() => [...document.querySelectorAll('.approval[data-state="waiting"]')].pop()?.textContent ?? '') : '';
    if (ok) await page.evaluate(() => [...document.querySelectorAll('.approval[data-state="waiting"] button.on')].pop()?.click());
    return reason;
  };
  const docTitle = `Garden guide ${W}`;
  await page.evaluate(() => (location.hash = 'area-make'));
  await page.waitForSelector('#pg-area-make .hubtile[data-id="editors"] .hubpill[data-editor="docs"]', { timeout: 15000 });
  await page.click('#pg-area-make .hubtile[data-id="editors"] .hubpill[data-editor="docs"]');
  await page.waitForSelector('#pg-docs .dcsheet', { timeout: 15000 });
  await page.locator('#pg-docs .dcbar button', { hasText: 'NEW' }).click();
  await page.waitForFunction(() => window.__ghosty?.docs?.view === 'doc', null, { timeout: 15000 });
  await page.fill('.dctitle', docTitle);
  await page.press('.dctitle', 'Tab');
  await page.locator('.dcpage .dcb').first().click();
  await page.keyboard.type('Sow the beans in May.');
  await page.waitForTimeout(400);
  const docLine = await page.locator('#pg-docs .dcsites').first().textContent().catch(() => '');
  check(docLine === 'Put this document on your sites as a read-only page at its own link. I ask your APPROVE in the chat first.', `${W}: (i) DOCS says what PUT IT ON MY SITES does: ${docLine}`);
  const waiting0 = await page.$$eval('.approval[data-state="waiting"] button.on', (b) => b.length);
  await page.locator('#pg-docs .dcexport button', { hasText: 'PUT IT ON MY SITES' }).first().click();
  const docReason = await approveNext(waiting0);
  const docSlug = docTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  check(new RegExp(`(?:Publish|Update) "${docTitle}" \\(the document from your phone, read-only\\) as a public page at .*/s/${docSlug}\\?`, 'i').test(docReason), `${W}: (i) the chat asks APPROVE for the document: ${docReason.slice(0, 200)}`);
  const docLive = async () => { for (let i = 0; i < 60; i++) { const r = await page.request.get(`${base}/s/${docSlug}/page`, { headers: { 'sec-fetch-dest': 'iframe' }, maxRedirects: 0 }); if (r.status() === 200 && /Sow the beans in May/.test(await r.text())) return true; await page.waitForTimeout(250); } return false; };
  check(await docLive(), `${W}: (i) after APPROVE the document is live at /s/${docSlug}, read-only`);

  // (j) a deck at its own link (sites.s3): START BLANK, EXPORT → PUT IT ON MY SITES, APPROVE; the page plays with no script
  await page.evaluate(() => (location.hash = 'area-make'));
  await page.waitForSelector('#pg-area-make .hubtile[data-id="editors"] .hubpill[data-editor="slides"]', { timeout: 15000 });
  await page.click('#pg-area-make .hubtile[data-id="editors"] .hubpill[data-editor="slides"]');
  await page.waitForSelector('#pg-slides .slsheet', { timeout: 15000 });
  const slKey = (label) => page.locator('.slsheet button:visible').filter({ hasText: new RegExp(`^${label}$`, 'i') }).first();
  if (await slKey('START BLANK').count()) await slKey('START BLANK').click();
  else await slKey('NEW').click().catch(() => undefined);
  await page.waitForFunction(() => window.__ghosty?.slides?.view === 'deck' || window.__ghosty?.slides?.view === 'slide', null, { timeout: 15000 }).catch(() => undefined);
  const deckTitle = await page.evaluate(() => JSON.parse(window.__ghosty.slides.json || 'null')?.title ?? '');
  await slKey('EXPORT').click().catch(() => undefined);
  const waiting1 = await page.$$eval('.approval[data-state="waiting"] button.on', (b) => b.length);
  await page.locator('.slexport button', { hasText: 'PUT IT ON MY SITES' }).first().click();
  const deckReason = await approveNext(waiting1);
  check(/\(the deck from your phone, read-only\) as a public page/.test(deckReason), `${W}: (j) the chat asks APPROVE for the deck "${deckTitle}": ${deckReason.slice(0, 200)}`);
  const deckSlug = /\/s\/([a-z0-9-]+)\?/.exec(deckReason)?.[1] ?? '';
  let deckHtml = '';
  for (let i = 0; i < 60 && !deckHtml; i++) { const r = await page.request.get(`${base}/s/${deckSlug}/page`, { headers: { 'sec-fetch-dest': 'iframe' }, maxRedirects: 0 }); if (r.status() === 200) deckHtml = await r.text(); else await page.waitForTimeout(250); }
  check(/<section aria-label="Slide 1 of \d+/.test(deckHtml) && /<svg/.test(deckHtml) && !/<script/i.test(deckHtml) && /scroll-snap-type/.test(deckHtml), `${W}: (j) the deck is live as its slides, drawn, swiped like a book, with no script`);


  // (k) a mini-app changed after it is made (sites.u6): a habit added at the same link after APPROVE
  if (W === 440) {
    const made = await say('make me an app to tick off my daily habits water and walk');
    const appSlug = made ? ((await page.evaluate(() => [...document.querySelectorAll('.approval')].pop()?.textContent ?? '')).match(/\/s\/([a-z0-9-]+)\/\?/)?.[1] ?? '') : '';
    const appLive = async (re) => { for (let i = 0; i < 60; i++) { const r = await page.request.get(`${base}/s/${appSlug}/`, { headers: { 'sec-fetch-dest': 'document' } }); if (r.status() === 200 && re.test(await r.text())) return true; await page.waitForTimeout(250); } return false; };
    check(!!appSlug && (await appLive(/"habits"/)), `${W}: (k) a habits app is made after APPROVE (${appSlug})`);
    const before = await page.$$eval('.approval[data-state="waiting"] button.on', (b) => b.length);
    await page.fill('#cin', `add stretch to my app ${appSlug}`);
    await page.keyboard.press('Enter');
    const changeReason = await approveNext(before);
    check(/Change the mini-app "Habits" at .*: habits: .* → .*“Stretch”\? Same link; what is saved on your phone stays\./.test(changeReason), `${W}: (k) the change is said before APPROVE: ${changeReason.slice(0, 220)}`);
    check(await appLive(/Stretch/), `${W}: (k) after APPROVE the app at the same link has the new habit`);
  }


  // (o) a sheet as a mini-app (sites.s8): SHEETS' first column becomes a list app after APPROVE
  if (W === 440) {
    await page.evaluate(() => (location.hash = 'area-make'));
    await page.waitForSelector('#pg-area-make .hubtile[data-id="editors"] .hubpill[data-editor="sheets"]', { timeout: 15000 });
    await page.click('#pg-area-make .hubtile[data-id="editors"] .hubpill[data-editor="sheets"]');
    await page.waitForSelector('#pg-sheets .shbar button', { timeout: 15000 });
    await page.locator('#pg-sheets .shbar button', { hasText: 'NEW' }).first().click();
    await page.waitForFunction(() => window.__ghosty?.sheets?.view === 'book', null, { timeout: 15000 });
    for (const [a, t] of [['A1', 'Shopping'], ['A2', 'Milk'], ['A3', 'Eggs'], ['A4', 'Bread']]) {
      await page.locator(`.shsheet .shc[data-a="${a}"]`).first().click();
      await page.locator('.shline').fill(t);
      await page.locator('.shline').press('Enter');
      await page.waitForTimeout(80);
    }
    await page.locator('.shpill', { hasText: /^DATA$/i }).click();
    const before = await page.$$eval('.approval[data-state="waiting"] button.on', (b) => b.length);
    await page.locator('.shexport button', { hasText: 'AS AN APP ON MY HOME SCREEN' }).click();
    const listReason = await approveNext(before);
    check(/Make the mini-app "/i.test(listReason), `${W}: (o) the sheet asks APPROVE for a list app: ${listReason.slice(0, 160)}`);
    const listSlug = /\/s\/([a-z0-9-]+)\/\?/.exec(listReason)?.[1] ?? '';
    let listHtml = '';
    for (let i = 0; i < 60 && !/milk/i.test(listHtml); i++) { const r = await page.request.get(`${base}/s/${listSlug}/`, { headers: { 'sec-fetch-dest': 'document' } }); listHtml = r.status() === 200 ? await r.text() : ''; if (!/milk/i.test(listHtml)) await page.waitForTimeout(250); }
    check(/milk/i.test(listHtml) && /eggs/i.test(listHtml) && /bread/i.test(listHtml) && !/shopping"\s*,\s*"/i.test(listHtml.match(/"items":\[[^\]]*\]/)?.[0] ?? ''), `${W}: (o) the app at /s/${listSlug}/ holds the sheet's rows, not its heading`);
  }

  // (l) one home page for his sites (sites.u8): two pages ticked ON MY HOME PAGE (kept on the phone), PUBLISH MY HOME PAGE, APPROVE;
  // the page lists exactly those two
  if (W === 440) {
    await page.evaluate(() => (location.hash = 'workshop'));
    await openSection(page, 'workshop', 'Made');
    const tick = async (name) => {
      const k = `#pg-workshop .site[data-site="${name}"] button[aria-pressed]`;
      await page.waitForSelector(k, { timeout: 15000 });
      if ((await page.getAttribute(k, 'aria-pressed')) !== 'true') await page.click(k);
      return until(page, (q) => document.querySelector(q)?.getAttribute('aria-pressed') === 'true', k, 5000);
    };
    const t1 = await tick(slug);
    const t2 = await tick(docSlug);
    check(t1 && t2 && (await page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.sites.home') ?? '[]').length)) >= 2, `${W}: (l) two pages ticked ON MY HOME PAGE, kept on the phone`);
    const homeKey = page.locator('#pg-workshop .sitehome button');
    check(/^PUBLISH MY HOME PAGE \(\d+\)$/i.test((await homeKey.textContent()) ?? '') && ((await homeKey.boundingBox())?.height ?? 0) >= 43.4, `${W}: (l) PUBLISH MY HOME PAGE says how many, at 44 pt`);
    const before = await page.$$eval('.approval[data-state="waiting"] button.on', (b) => b.length);
    await homeKey.click();
    const homeReason = await approveNext(before);
    check(/Publish "My pages" \(your home page from your phone: only the pages you chose\)/.test(homeReason), `${W}: (l) it asks APPROVE for his home page: ${homeReason.slice(0, 200)}`);
    let homeHtml = '';
    for (let i = 0; i < 60 && !homeHtml; i++) { const r = await page.request.get(`${base}/s/my-pages/page`, { headers: { 'sec-fetch-dest': 'iframe' }, maxRedirects: 0 }); if (r.status() === 200) homeHtml = await r.text(); else await page.waitForTimeout(250); }
    const listed = [...homeHtml.matchAll(/<li><a href="([^"]+)"/g)].map((m) => m[1].replace(/^.*\/s\//, ''));
    check(listed.includes(slug) && listed.includes(docSlug) && !/<script/i.test(homeHtml), `${W}: (l) the home page lists the pages he chose, with no script: ${listed.join(', ')}`);
  }


  // (m) QR AND POSTER (sites.s2, u4): a page's QR code, and an A4 poster saved, made on the phone
  {
    await page.evaluate(() => (location.hash = 'workshop'));
    await openSection(page, 'workshop', 'Made');
    const qrKey = `#pg-workshop .site[data-site="${slug}"] button[aria-label="QR code and poster for Party"]`;
    await page.waitForSelector(qrKey, { timeout: 15000 });
    await page.click(qrKey);
    const shown = await until(page, () => !!document.querySelector('.modal .psheet .pqr svg path'), null, 8000);
    const addr = await page.locator('.modal .psheet .paddr').textContent().catch(() => '');
    check(shown && addr.endsWith(`/s/${slug}`), `${W}: (m) QR AND POSTER shows the page's QR code and its address (${addr})`);
    // (measured as laid out: the sheet slides in slightly scaled, which a bounding box would count)
    const small = await page.$$eval('.modal .psheet button', (b) => b.filter((x) => x.offsetHeight < 43.4).map((x) => x.textContent));
    check(small.length === 0, `${W}: (m) its keys are 44 pt ${JSON.stringify(small)}`);
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }).catch(() => null), page.locator('.modal .psheet .prow').first().locator('button', { hasText: 'SAVE' }).click()]);
    let dims = '';
    if (dl) {
      const p = await dl.path();
      const b = p ? (await import('node:fs')).readFileSync(p) : Buffer.alloc(0);
      dims = b.length > 24 && b[1] === 0x50 ? `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}` : '';
    }
    check(dims === '1240x1754' && /Party poster\.png$/.test(dl?.suggestedFilename() ?? ''), `${W}: (m) SAVE gives an A4 poster picture made on the phone (${dims}, ${dl?.suggestedFilename()})`);
    await page.keyboard.press('Escape');
    // (n) CHECK (sites.u9): the publish check on the live page, said in his words
    const checkKey = `#pg-workshop .site[data-site="${slug}"] button[aria-label="Check Party"]`;
    await page.waitForSelector(checkKey, { timeout: 8000 });
    await page.click(checkKey);
    check(await until(page, (s) => /All clear: nothing to fix|worth fixing|to fix/.test(document.querySelector(`#pg-workshop .site[data-site="${s}"] .sitecheck`)?.textContent ?? ''), slug, 10000), `${W}: (n) CHECK says how the live page is, in his words`);
  }

  check(errors.length === 0, `${W}: no page error${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
  await ctx.close();
}

await browser.close();
console.log(problems.length ? `\nFAIL sitephotos: ${problems.length} problem(s)\n- ${problems.join('\n- ')}` : '\nPASS sitephotos: his own photos on his sites, smaller and with no location, the main picture his choice, used only after APPROVE');
process.exit(problems.length ? 1 : 0);
