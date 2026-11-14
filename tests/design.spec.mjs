// DESIGN (THE APPS ROUND, lane SITES): one free canvas in CREATIVE → Poster (its first panel), on an iPhone at 440 × 956 and 390 × 844.
// (a) it opens on a designed page, never a blank one; (b) the templates, filtered by occasion, each fit their size; (c) a part dragged by
// hand moves, snapping with guides, and UNDO / REDO take it back and forth; (d) a corner resizes it, the top handle turns it; (e) Layers
// hides and locks (a locked part does not move); (f) magic resize makes a copy at another size, the first kept; (g) the brand kit keeps a
// colour; (h) exports made on the tap: a PNG at the page's size, an SVG with its words, a print PDF with 3 mm bleed (its TrimBox inside its
// MediaBox); (i) My designs and Recently deleted, and it is all still there after a reload; (j) 44 pt keys and nothing sideways; and at 440,
// (k) ON MY SITES waits for his APPROVE in the chat, then the page is live with the design as its picture.
//   BASE=http://localhost:8788 node tests/design.spec.mjs tests/.shots
import { devices } from 'playwright';
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, openSection } from './nav.mjs';
import { mkdirSync, readFileSync } from 'node:fs';

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
const D = '#pg-creative .dz';
const st = (page) => page.evaluate(() => ({ ...window.__ghosty.design }));

async function open(size) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: size, screen: size, ...UK, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => !webkitNoise(e) && errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|401|403|404/.test(m.text()) && errors.push(m.text()));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pair input', { timeout: 15000 });
  await page.fill('#pair input', 'preview-owner-key-0123456789');
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
  return { ctx, page, errors };
}
const tab = async (page, name) => {
  await page.locator(`${D} .dztab`, { hasText: new RegExp(`^${name}$`) }).click();
  await until(page, (n) => document.querySelector('#pg-creative .dz .dzbody')?.dataset.panel === n, name.toLowerCase().replace('my designs', 'designs'), 4000);
};
/** A part's middle on the screen. */
const mid = (page, id) => page.evaluate((i) => { document.querySelector('#pg-creative .dz .dzstage').scrollIntoView({ block: 'center' }); const r = document.querySelector(`#pg-creative .dz .dzl[data-id="${i}"]`).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, id);
const layer = (page, id) => page.evaluate((i) => { const s = window.__ghosty.design; const l = JSON.parse(localStorage.getItem(`ghosty-design:d:${s.open}`)).layers.find((x) => x.id === i); return l; }, id);
const dragBy = async (page, from, dx, dy, steps = 8) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) await page.mouse.move(from.x + (dx * i) / steps, from.y + (dy * i) / steps);
};
const toDesign = async (page) => {
  await page.evaluate(() => (location.hash = 'creative'));
  await page.waitForSelector('#pg-creative .secpills .secpill', { timeout: 15000 });
  // (its pill is remembered: tapped only when another one is showing)
  const on = await page.$$eval('#pg-creative .secpills .secpill', (bs) => bs.some((b) => (b) => b.textContent === 'Poster' && (b.getAttribute('aria-pressed') === 'true' || b.getAttribute('aria-selected') === 'true'))).catch(() => false);
  if (!on) await openSection(page, 'creative', 'Poster');
};
const saved = async (page) => until(page, () => { const s = window.__ghosty.design; return s.saved > 0; }, null, 4000);

for (const [W, size] of [[440, PHONE], [390, { width: 390, height: 844 }]]) {
  const { ctx, page, errors } = await open(size);
  await toDesign(page);
  const opened = await until(page, () => !!document.querySelector('#pg-creative .dz .dzpage .dzl'), null, 15000);
  // (a) a designed page, never a blank one
  let s = await st(page);
  check(opened && s.layers >= 3 && s.w > 0 && /is open/.test(s.said), `${W}: (a) Design opens on a designed page (${s.name}, ${s.layers} parts, ${s.w}×${s.h}): "${s.said}"`);
  const panels = await page.$$eval('#pg-creative .pn:not([hidden]) h3', (h) => h.map((x) => x.textContent.trim()));
  check(/^design/i.test(panels[0] ?? ''), `${W}: (a) Design leads CREATIVE's Poster pill (${panels.slice(0, 2).join(', ')})`);
  // (b) templates by occasion
  await tab(page, 'Templates');
  const all = await page.$$eval(`${D} .dzcard`, (c) => c.length);
  await page.locator(`${D} .dzchip`, { hasText: /^Sale$/ }).click();
  const sale = await page.$$eval(`${D} .dzcard b`, (c) => c.map((x) => x.textContent));
  check(all >= 10 && sale.length === 2 && sale.includes('Big sale') && sale.includes('Garage sale'), `${W}: (b) ${all} templates; Sale shows ${sale.join(', ')}`);
  await page.locator(`${D} .dzchip`, { hasText: /^All$/ }).click();
  await page.locator(`${D} .dzcard`, { hasText: 'Club night' }).click();
  await until(page, () => window.__ghosty.design.size === 'a4', null, 4000);
  s = await st(page);
  check(s.size === 'a4' && s.w === 2480 && s.h === 3508 && s.layers === 6, `${W}: (b) Club night opens at A4 (${s.w}×${s.h}, ${s.layers} parts)`);
  await saved(page);
  await page.screenshot({ path: `${out}/design-${W}-a4.png` });
  // (c) drag a part by hand: it moves and snaps with guides; undo and redo
  const doc0 = await page.evaluate(() => JSON.parse(localStorage.getItem(`ghosty-design:d:${window.__ghosty.design.open}`)));
  const ticket = doc0.layers.find((l) => l.name === 'Lineup');
  const p0 = await mid(page, ticket.id);
  await dragBy(page, p0, 2, 40); // a hair sideways, within the snap: it stays on the page's centre line
  const during = await st(page);
  await page.mouse.up();
  await until(page, (u) => window.__ghosty.design.undo > u, s.undo, 3000);
  const moved = await layer(page, ticket.id);
  s = await st(page);
  check(s.selected === ticket.id && moved.y > ticket.y + 40 && Math.abs(moved.x + moved.w / 2 - doc0.w / 2) < 2, `${W}: (c) the line-up moved down by hand and stayed snapped to the page's centre (x ${ticket.x}→${moved.x}, y ${ticket.y}→${moved.y})`);
  check(during.guides >= 1, `${W}: (c) a guide showed while it snapped (${during.guides})`);
  await page.locator(`${D} .dzkeys button`, { hasText: /^Undo$/ }).click();
  await until(page, (y) => { const s = window.__ghosty.design; const l = JSON.parse(localStorage.getItem(`ghosty-design:d:${s.open}`)).layers.find((x) => x.name === 'Lineup'); return l.y === y; }, ticket.y, 4000);
  const back = await layer(page, ticket.id);
  await page.locator(`${D} .dzkeys button`, { hasText: /^Redo$/ }).click();
  await until(page, (y) => { const s = window.__ghosty.design; const l = JSON.parse(localStorage.getItem(`ghosty-design:d:${s.open}`)).layers.find((x) => x.name === 'Lineup'); return l.y === y; }, moved.y, 4000);
  const again = await layer(page, ticket.id);
  check(back.y === ticket.y && again.y === moved.y, `${W}: (c) UNDO put it back (y ${back.y}) and REDO moved it again (y ${again.y})`);
  // (d) a corner resizes it from the opposite corner; the top handle turns it
  await page.locator(`${D} .dzl[data-id="${ticket.id}"]`).click();
  const se = await page.evaluate(() => { document.querySelector('#pg-creative .dz .dzstage').scrollIntoView({ block: 'center' }); const r = document.querySelector('#pg-creative .dz .dzh[data-h="se"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await dragBy(page, se, 40, 20);
  await page.mouse.up();
  await page.waitForTimeout(300);
  const big = await layer(page, ticket.id);
  check(big.w > again.w + 40 && Math.abs(big.x - again.x) <= 2 && Math.abs(big.y - again.y) <= 2, `${W}: (d) the corner made it bigger from its opposite corner (w ${again.w}→${big.w}, at ${big.x},${big.y})`);
  const rot = await page.evaluate(() => { document.querySelector('#pg-creative .dz .dzstage').scrollIntoView({ block: 'center' }); const r = document.querySelector('#pg-creative .dz .dzh[data-h="rot"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const c = await mid(page, ticket.id);
  await dragBy(page, rot, (c.y - rot.y) * 1.2, c.y - rot.y);
  await page.mouse.up();
  await page.waitForTimeout(300);
  const turned = await layer(page, ticket.id);
  check(turned.rot > 20 && turned.rot < 160, `${W}: (d) the top handle turned it (${turned.rot}°)`);
  // (e) layers: hide and lock; a locked part does not move
  await tab(page, 'Layers');
  const rows = await page.$$eval(`${D} .dzlayer`, (r) => r.map((x) => x.querySelector('b')?.textContent));
  check(rows.length === 6 && rows[0] === 'Ticket text', `${W}: (e) Layers lists the parts, top first (${rows.join(', ')})`);
  await page.locator(`${D} .dzlayer[data-id="${ticket.id}"] button`, { hasText: /^Lock$/ }).click();
  await page.waitForTimeout(200);
  const lockedAt = await layer(page, ticket.id);
  const p1 = await mid(page, ticket.id);
  await dragBy(page, p1, 60, 60);
  await page.mouse.up();
  await page.waitForTimeout(200);
  const still = await layer(page, ticket.id);
  check(lockedAt.locked && still.x === lockedAt.x && still.y === lockedAt.y && /locked/.test((await st(page)).said), `${W}: (e) a locked part does not move, and says why`);
  const glow = doc0.layers.find((l) => l.name === 'Glow');
  await page.locator(`${D} .dzlayer[data-id="${glow.id}"] button`, { hasText: /^Hide$/ }).click();
  await page.waitForTimeout(200);
  check(await page.evaluate((i) => getComputedStyle(document.querySelector(`#pg-creative .dz .dzl[data-id="${i}"]`)).display === 'none', glow.id), `${W}: (e) HIDE takes the glow off the page`);
  // (f) magic resize: a Story copy, every part kept, the A4 one kept too
  await tab(page, 'Resize');
  const keptBefore = (await st(page)).kept;
  await page.locator(`${D} .dzsize`, { hasText: /^Story/ }).click();
  await until(page, () => window.__ghosty.design.size === 'story', null, 4000);
  s = await st(page);
  check(s.size === 'story' && s.w === 1080 && s.h === 1920 && s.layers === 6 && s.kept === keptBefore + 1, `${W}: (f) magic resize made a Story copy (${s.w}×${s.h}, ${s.layers} parts), the first kept (${keptBefore}→${s.kept})`);
  const story = await page.evaluate(() => JSON.parse(localStorage.getItem(`ghosty-design:d:${window.__ghosty.design.open}`)));
  check(story.layers.every((l) => l.x + l.w > 0 && l.x < story.w && l.y + l.h > 0 && l.y < story.h), `${W}: (f) every part is still on the resized page`);
  // (g) the brand kit keeps a colour
  await tab(page, 'Brand');
  const before = await page.$$eval(`${D} .dzbody .dzswatch`, (b) => b.length);
  await page.$eval(`${D} .dzbody .dzpick`, (i) => { i.value = '#ff3366'; i.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForTimeout(200);
  const brand = await page.evaluate(() => JSON.parse(localStorage.getItem('ghosty-design:brand')));
  check(brand.colours.includes('#ff3366') && (await page.$$eval(`${D} .dzbody .dzswatch`, (b) => b.length)) === before + 1, `${W}: (g) the brand kit keeps a new colour (${brand.colours.join(', ')})`);
  // (h) exports, made on the tap
  await tab(page, 'Export');
  const save = async (label) => {
    const dl = page.waitForEvent('download', { timeout: 20000 });
    await page.locator(`${D} .dzbody button`, { hasText: new RegExp(`^${label}$`) }).click();
    const d = await dl;
    return { name: d.suggestedFilename(), bytes: readFileSync(await d.path()) };
  };
  const png = await save('PNG picture');
  check(png.bytes[1] === 0x50 && png.bytes.readUInt32BE(16) === 1080 && png.bytes.readUInt32BE(20) === 1920, `${W}: (h) PNG at the page's size (${png.bytes.readUInt32BE(16)}×${png.bytes.readUInt32BE(20)}, ${png.name})`);
  const svg = (await save('Vector file')).bytes.toString('utf8');
  check(svg.startsWith('<svg') && /viewBox="0 0 1080 1920"/.test(svg) && /Soul Night/.test(svg), `${W}: (h) SVG with its words as text`);
  const pdf = await save('Print PDF with bleed');
  const pdfText = pdf.bytes.toString('latin1');
  const media = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(pdfText);
  const trim = /\/TrimBox \[([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)\]/.exec(pdfText);
  const bleedMm = trim ? (Number(trim[1]) * 25.4) / 72 : 0;
  check(pdfText.startsWith('%PDF-1.4') && media && trim && Math.abs(bleedMm - 3) < 0.05 && /\/DCTDecode/.test(pdfText) && /%%EOF\s*$/.test(pdfText), `${W}: (h) a print PDF with ${bleedMm.toFixed(2)} mm bleed (MediaBox ${media?.[1]}×${media?.[2]} pt)`);
  // (i) My designs, Recently deleted, and a reload
  await tab(page, 'My designs');
  const names = await page.$$eval(`${D} .dzlist .dzlname b`, (b) => b.map((x) => x.textContent));
  const firstName = names.find((n) => /^Club night$/.test(n));
  check(names.some((n) => /Club night \(Story\)/.test(n)) && !!firstName, `${W}: (i) My designs keeps both (${names.slice(0, 4).join(', ')})`);
  await page.locator(`${D} .dzlist li`, { hasText: /^Club night(?! \()/ }).first().locator('button', { hasText: /^Delete$/ }).click();
  await until(page, () => /Recently deleted/.test(window.__ghosty.design.said), null, 3000);
  const binned = await page.$$eval(`${D} .dzlist[aria-label="Recently deleted"] b`, (b) => b.map((x) => x.textContent));
  check(binned.includes('Club night'), `${W}: (i) a deleted design waits in Recently deleted (${binned.join(', ')})`);
  await page.locator(`${D} .dzlist[aria-label="Recently deleted"] li`, { hasText: 'Club night' }).first().locator('button', { hasText: /^Put back$/ }).click();
  await page.waitForTimeout(200);
  check((await page.$$eval(`${D} .dzlist[aria-label="My designs"] b`, (b) => b.map((x) => x.textContent))).includes('Club night'), `${W}: (i) PUT BACK returns it to My designs`);
  const openId = (await st(page)).open;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
  await toDesign(page);
  await until(page, () => !!document.querySelector('#pg-creative .dz .dzpage .dzl'), null, 15000);
  s = await st(page);
  check(s.open === openId && s.size === 'story', `${W}: (i) after a reload the same design is open (${s.name}${s.name ? '' : `; ${errors.slice(-2).join(' | ')}; ${(await page.evaluate(() => document.querySelector('#pg-creative .pn:not([hidden])')?.innerText ?? 'no panel')).replace(/\s+/g, ' ').slice(0, 160)}`})`);
  // (j) 44 pt keys, nothing sideways
  for (const p of ['Edit', 'Templates', 'Layers', 'Export']) {
    await tab(page, p);
    const bad = await page.$$eval(`${D} button, ${D} input:not([type=range]), ${D} select`, (els) => els.filter((e) => e.getClientRects().length && !e.closest('.dzcard .dzthumb')).map((e) => [e.textContent || e.getAttribute('aria-label'), e.offsetHeight]).filter(([, h]) => h < 44));
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    check(!bad.length && !wide, `${W}: (j) ${p}: every key 44 pt and nothing sideways${bad.length ? ` (${JSON.stringify(bad.slice(0, 4))})` : ''}`);
  }
  await page.screenshot({ path: `${out}/design-${W}-export.png` });
  // (k) ON MY SITES: only after his APPROVE in the chat
  if (W === 440) {
    await tab(page, 'Export');
    const waiting = () => page.$$eval('.approval[data-state="waiting"] button.on', (b) => b.length);
    const n0 = await waiting();
    await page.locator(`${D} .dzbody button`, { hasText: /^On my sites$/ }).click();
    await page.locator('.logbtn:visible').first().click({ timeout: 3000 }).catch(() => undefined);
    const asked = await until(page, (n) => document.querySelectorAll('.approval[data-state="waiting"] button.on').length > n, n0, 30000);
    const reason = asked ? await page.evaluate(() => [...document.querySelectorAll('.approval[data-state="waiting"]')].pop()?.textContent ?? '') : '';
    const slug = /\/s\/([a-z0-9-]+)\?/.exec(reason)?.[1] ?? '';
    check(asked && /as a public page/.test(reason) && !!slug, `${W}: (k) ON MY SITES asks APPROVE first: ${reason.slice(0, 140)}`);
    const pre = slug ? await page.request.get(`${base}/s/${slug}/page`, { headers: { 'sec-fetch-dest': 'iframe' }, maxRedirects: 0 }) : null;
    const wasLive = pre?.status() === 200 && /Soul Night/.test(await pre.text());
    await page.evaluate(() => [...document.querySelectorAll('.approval[data-state="waiting"] button.on')].pop()?.click());
    let html = '';
    for (let i = 0; i < 60 && !/<img[^>]* src="data:image\/jpeg/.test(html); i++) { const r = await page.request.get(`${base}/s/${slug}/page`, { headers: { 'sec-fetch-dest': 'iframe' }, maxRedirects: 0 }); html = r.status() === 200 ? await r.text() : ''; if (!html) await page.waitForTimeout(250); }
    check(!!html && /<img[^>]* src="data:image\/jpeg;base64,/.test(html) && /alt="[^"]*Soul Night/.test(html) && !/<script/i.test(html), `${W}: (k) after APPROVE the page is live with the design as its picture and its words as the alt text${wasLive ? ' (it was already live from an earlier run)' : ''}${html ? '' : `; ${reason.slice(0, 200)}`}${html && !/<img src="data:image\/jpeg/.test(html) ? `; ${html.slice(0, 300)}` : ''}`);
  }
  check(!errors.length, `${W}: no console errors (${errors.slice(0, 3).join(' | ')})`);
  await ctx.close();
}

await browser.close();
if (problems.length) {
  console.log(`\nPROBLEMS (${problems.length}):\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('\nDesign run clean: templates by occasion, every part moved, resized, turned, layered and locked by hand with snapping and undo, magic resize, a brand kit, PNG, SVG and a print PDF with bleed, My designs with Recently deleted, and ON MY SITES only after APPROVE.');
