// PAINT (APPS ROUND, lane COMIC), the real app at 440 × 956 and 390 × 844: (a) the first visit's gallery holds a sample painting
// and the three-step tour, never an empty screen; (b) a new painting: a finger stroke lands, UNDO and REDO take it back and put it
// back, and a two-finger tap undoes; (c) the Apple Pencil's pressure makes a firmer stroke wider than a light one; (d) QuickShape
// snaps a wobbly circle; (e) symmetry mirrors a stroke; (f) layers: a new one, its blend mode, alpha lock; (g) a colouring page's
// lines are a reference layer, and FILL fills between them on the colour layer; (h) the time-lapse plays every step; (i) a PSD
// keeps the layers; (j) delete goes to Recently deleted and comes back; (k) every key 44 pt and nothing sideways, at BODY 21 too,
// and the studio in all seven looks.
//   BASE=http://localhost:8788 node tests/paint.spec.mjs tests/.shots
import { launch, webkitNoise } from './browser.mjs';
import { UK } from './nav.mjs';
import { mkdirSync, readFileSync } from 'node:fs';

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

const live = [];
async function open(viewport, o = {}) {
  const ctx = await browser.newContext({ viewport, screen: viewport, deviceScaleFactor: 1, isMobile: true, hasTouch: true, acceptDownloads: true, ...UK, serviceWorkers: 'block' });
  live.push(ctx);
  await ctx.route(/^https:\/\/(?!localhost)/, (route) => route.fulfill({ status: 404, body: '' }));
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${viewport.width}] pageerror: ${e.message}`));
  await page.addInitScript(({ key, body, world }) => {
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.themes1', '1');
    localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Tony', speak: false, sounds: false, theme: 'reactor', favourites: [], look: { ground: 'graphite', world, night: 'graphite', switches: body ? { body } : {} }, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
    localStorage.setItem('ghosty.paint.prefs', JSON.stringify({ cue: false }));
    window.__ghostyHero = true;
  }, { key: KEY, body: o.body ?? 0, world: o.world ?? 'scan' });
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
  await page.waitForTimeout(600);
  return { ctx, page };
}
const until = (page, fn, arg, ms = 12000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const S = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__ghosty?.paint ?? null)));
const goPaint = async (page, sec) => {
  await page.evaluate((s) => (location.hash = s ? `paint?${s}` : 'paint'), sec);
  await page.waitForSelector('#pg-paint', { state: 'attached', timeout: 30000 });
  if (sec) await page.evaluate((s) => document.querySelector(`#pg-paint .secpill[data-sec="${s}"]`)?.click(), sec);
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
async function bar(page, tag, root) {
  check(!(await sideways(page, root)), `${tag}: nothing sideways`);
  const s = await small(page, root);
  check(!s.length, `${tag}: every key 44 pt: ${s.join(', ')}`);
}

/** A stroke on the canvas as real pointer events: points in canvas pixels, each with its pressure. */
async function stroke(page, pts, o = {}) {
  // (after a panel opens or closes the canvas fits itself again on the next frame: the stroke waits for it)
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.evaluate(({ pts, type, hold }) => new Promise((done) => {
    const stage = document.querySelector('.pxstudio .pxstage');
    const r = stage.getBoundingClientRect();
    const d = window.__ghosty.paintDoc();
    const s = d.s;
    const ox = r.left + d.tx, oy = r.top + d.ty;
    const ev = (kind, [x, y, p], t) => stage.dispatchEvent(new PointerEvent(kind, { pointerId: 7, pointerType: type, isPrimary: true, bubbles: true, cancelable: true, clientX: ox + x * s, clientY: oy + y * s, pressure: p ?? 0.5, buttons: kind === 'pointerup' ? 0 : 1, button: 0 }));
    ev('pointerdown', pts[0], 0);
    pts.slice(1).forEach((q, i) => ev('pointermove', q, i + 1));
    setTimeout(() => { ev('pointerup', pts[pts.length - 1], pts.length); done(); }, hold);
  }), { pts, type: o.type ?? 'touch', hold: o.hold ?? 30 });
  await page.waitForTimeout(60);
}
const lineAt = (y, p, x0 = 200, x1 = 1000) => Array.from({ length: 40 }, (_, i) => [x0 + ((x1 - x0) * i) / 39, y, p]);
const tool = (page, label) => page.click(`.pxstudio .pxbar button[aria-label^="${label}"]`);

async function run(viewport) {
  const W = viewport.width;
  const { ctx, page } = await open(viewport);
  // (a) the first visit
  await goPaint(page, 'gallery');
  const sampled = await until(page, () => window.__ghosty?.paint?.gallery.state === 'ready', null, 30000);
  const st = await S(page);
  check(sampled && st.gallery.titles.some((t) => /^Sample: sunset/.test(t)), `[${W}] the first visit's gallery holds the sample painting: ${st?.gallery.titles.join(', ')}`);
  check(await page.locator('#pg-paint .pxtour li').count() === 3, `[${W}] the three-step tour is shown`);
  await bar(page, `[${W}] the gallery`, '#pg-paint');
  // search: a title with nothing like it says so in his words, with CLEAR SEARCH (the App Kit's state card)
  await page.fill('#pg-paint input[aria-label="Find a painting by its title"]', 'zebra crossing');
  check(/No painting’s title has “zebra crossing” in it/.test(await page.locator('#pg-paint .ak-state').textContent().catch(() => '')), `[${W}] a search with no match says so`);
  await page.click('#pg-paint .ak-state button');
  check((await S(page)).gallery.titles.length === 1, `[${W}] CLEAR SEARCH shows the gallery again`);

  // (b) a new painting
  await page.click('#pg-paint button[aria-label="Start a new painting"]');
  check(await until(page, () => window.__ghosty.paint.open && document.querySelector('.pxstudio .pxstage canvas')), `[${W}] NEW PAINTING opens the studio`);
  await page.waitForTimeout(300);
  let s = await S(page);
  check(s.layers.map((l) => l.name).join(',') === 'Background,Layer 1' && s.cur === 1, `[${W}] a new painting has a background and Layer 1, drawing on Layer 1: ${s.layers.map((l) => l.name)}`);
  await stroke(page, lineAt(300, 0.6));
  s = await S(page);
  const inked1 = (await page.evaluate(() => window.__ghosty.paintInked()))[1];
  check(s.undo === 1 && s.strokes === 1 && inked1 > 20, `[${W}] a finger stroke lands on Layer 1 (${inked1} cells inked, ${s.undo} step)`);
  check((await page.evaluate(() => window.__ghosty.paintAt(600, 300, 1))) > 100, `[${W}] the ink is where the finger went`);
  await page.click('.pxstudio button[aria-label^="Undo"]');
  s = await S(page);
  check(s.undo === 0 && s.redo === 1 && (await page.evaluate(() => window.__ghosty.paintAt(600, 300, 1))) === 0, `[${W}] UNDO takes the stroke away`);
  await page.click('.pxstudio button[aria-label="Redo"]');
  check((await page.evaluate(() => window.__ghosty.paintAt(600, 300, 1))) > 100 && (await S(page)).redo === 0, `[${W}] REDO puts it back`);
  // a two-finger tap undoes
  await page.evaluate(() => {
    const stage = document.querySelector('.pxstudio .pxstage');
    const r = stage.getBoundingClientRect();
    const e = (k, id, x) => stage.dispatchEvent(new PointerEvent(k, { pointerId: id, pointerType: 'touch', bubbles: true, clientX: r.left + x, clientY: r.top + 200, buttons: k === 'pointerup' ? 0 : 1 }));
    e('pointerdown', 21, 100); e('pointerdown', 22, 200); e('pointerup', 21, 100); e('pointerup', 22, 200);
  });
  check(await until(page, () => window.__ghosty.paint.undo === 0 && window.__ghosty.paintAt(600, 300, 1) === 0, null, 3000), `[${W}] a two-finger tap undoes`);

  // (c) the Apple Pencil's pressure
  await stroke(page, lineAt(500, 0.15), { type: 'pen' });
  await stroke(page, lineAt(800, 1), { type: 'pen' });
  const thick = await page.evaluate(() => { let light = 0, firm = 0; for (let dy = -30; dy <= 30; dy++) { if (window.__ghosty.paintAt(600, 500 + dy, 1) > 40) light++; if (window.__ghosty.paintAt(600, 800 + dy, 1) > 40) firm++; } return { light, firm }; });
  check(thick.firm > thick.light * 1.5 && thick.light > 0, `[${W}] a firm Apple Pencil stroke is wider than a light one (${thick.firm} px against ${thick.light} px)`);
  check((await S(page)).pressure.kind === 'pen', `[${W}] the pencil is read as a pencil`);

  // once the pencil has touched the glass, a resting palm or finger draws nothing
  const before = (await S(page)).undo;
  await stroke(page, lineAt(650, 0.8));
  check((await S(page)).undo === before && (await page.evaluate(() => window.__ghosty.paintAt(600, 650, 1))) === 0, `[${W}] after the Apple Pencil, a palm or finger on the glass draws nothing`);

  // (d) QuickShape: a wobbly circle, held still at the end
  const wobble = Array.from({ length: 60 }, (_, i) => { const a = (i / 59) * Math.PI * 2; const r = 180 + Math.sin(i * 1.7) * 9; return [600 + Math.cos(a) * r, 1150 + Math.sin(a) * r, 0.6]; });
  await stroke(page, wobble, { hold: 900, type: 'pen' });
  s = await S(page);
  check(/circle|ellipse/.test(s.quick), `[${W}] QuickShape snaps a wobbly circle: "${s.quick}" (${s.note})`);

  // (e) symmetry
  await tool(page, 'More');
  await page.selectOption('.pxstudio select[aria-label="Symmetry guide"]', 'vertical');
  await page.click('.pxstudio .pxsheet button[aria-label^="Close"]');
  await stroke(page, [[200, 1450, 0.7], [260, 1460, 0.7], [320, 1450, 0.7], [380, 1460, 0.7]], { type: 'pen' });
  const mirror = await page.evaluate(() => { const col = (x) => { let n = 0; for (let y = 1420; y <= 1490; y++) if (window.__ghosty.paintAt(x, y, 1) > 60) n++; return n; }; return { left: col(300), right: col(1200 - 300) }; });
  check(mirror.left > 0 && mirror.right > 0 && Math.abs(mirror.left - mirror.right) <= 2, `[${W}] symmetry mirrors the stroke to the other side (${mirror.left} px on the left, ${mirror.right} px on the right)`);

  // (f) layers
  await tool(page, 'Layers');
  await page.click('.pxstudio button[aria-label="Add a new layer"]');
  s = await S(page);
  check(s.layers.length === 3 && s.cur === 2, `[${W}] NEW LAYER adds a layer on top and draws on it`);
  await page.selectOption('.pxstudio select[aria-label="Blend mode"]', 'multiply');
  await page.click('.pxstudio button[aria-label^="Alpha lock"]');
  s = await S(page);
  check(s.layers[2].blend === 'multiply' && s.layers[2].alphaLock, `[${W}] the layer's blend mode and alpha lock are kept`);
  await bar(page, `[${W}] the layers panel`, '.pxstudio');
  await page.click('.pxstudio .pxsheet button[aria-label^="Close"]');
  // alpha lock: a stroke on the empty locked layer leaves nothing
  await stroke(page, lineAt(1500, 0.8), { type: 'pen' });
  check((await page.evaluate(() => window.__ghosty.paintInked()))[2] === 0, `[${W}] alpha lock: paint lands only where the layer has paint (none)`);

  // Ghosty inside: ASK GHOSTY FOR A PALETTE shows colours as a suggestion, kept only on KEEP THESE
  await tool(page, 'Colour');
  await page.fill('.pxstudio input[aria-label="A mood for Ghosty’s palette"]', 'a calm dusk');
  await page.click('.pxstudio button[aria-label="Ask Ghosty for a palette that fits a mood"]');
  const asked = await until(page, () => window.__ghosty.paint.ask.state === 'done', null, 20000);
  s = await S(page);
  check(asked && s.ask.colours.length === 6 && s.ask.colours.every((c) => /^#[0-9a-f]{6}$/.test(c)), `[${W}] Ghosty suggests six colours for the mood: ${s.ask.state} ${s.ask.colours.join(' ')}`);
  const colourBefore = s.colour;
  await page.click('.pxstudio button[aria-label="Keep the suggested colours"]');
  s = await S(page);
  check(s.colour !== colourBefore && s.colour === s.ask.colours[0], `[${W}] KEEP THESE keeps the suggestion (the brush takes its first colour)`);
  await page.click('.pxstudio .pxsheet button[aria-label^="Close"]');

  // (h) the time-lapse
  await tool(page, 'More');
  await page.click('.pxstudio button[aria-label="Play the time-lapse"]');
  const played = await until(page, () => window.__ghosty.paint.timelapse.frames > 5 && !window.__ghosty.paint.timelapse.playing && window.__ghosty.paint.timelapse.shown >= window.__ghosty.paint.timelapse.frames, null, 30000);
  s = await S(page);
  check(played, `[${W}] the time-lapse plays every step (${s.timelapse.shown} of ${s.timelapse.frames})`);

  // (i) a PSD keeps the layers
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('.pxstudio button[aria-label="Save as a layered PSD"]')]);
  const psd = readFileSync(await dl.path());
  const names = (() => {
    const v = new DataView(psd.buffer, psd.byteOffset, psd.byteLength);
    let at = 26; at += 4 + v.getUint32(at); at += 4 + v.getUint32(at); at += 8;
    const n = Math.abs(v.getInt16(at)); at += 2;
    const out = [];
    for (let i = 0; i < n; i++) { at += 16; const nc = v.getUint16(at); at += 2 + nc * 6 + 12; const extra = v.getUint32(at); at += 4; const end = at + extra; at += 4 + v.getUint32(at); at += 4 + v.getUint32(at); out.push(psd.subarray(at + 1, at + 1 + psd[at]).toString('latin1')); at = end; }
    return out;
  })();
  check(psd.subarray(0, 4).toString('latin1') === '8BPS' && names.join(',') === 'Paper,Background,Layer 1,Layer 3', `[${W}] the PSD keeps every layer by name: ${names.join(', ')}`);
  await bar(page, `[${W}] the studio's MORE panel`, '.pxstudio');
  await page.screenshot({ path: `${out}/paint-studio-${W}.png` }).catch(() => undefined);

  // back to the gallery: it was kept as he went
  await page.click('.pxstudio button[aria-label^="Back to the gallery"]');
  check(await until(page, () => !document.querySelector('.pxstudio') && window.__ghosty.paint.gallery.titles.includes('Painting 2'), null, 15000), `[${W}] GALLERY keeps the new painting`);

  // (g) a colouring page: the lines are the reference, FILL fills the colour layer between them
  await goPaint(page, 'colouring');
  await page.click('#pg-paint button[aria-label="Colour the Mandala"]');
  check(await until(page, () => window.__ghosty.paint.open, null, 20000), `[${W}] COLOUR THIS opens the mandala`);
  await page.waitForTimeout(300);
  s = await S(page);
  check(s.layers.map((l) => l.name).join(',') === 'Background,Colour,Lines' && s.layers[2].reference && s.layers[s.cur].name === 'Colour', `[${W}] the lines are a reference layer over the colour layer: ${s.layers.map((l) => `${l.name}${l.reference ? '*' : ''}`)}`);
  await tool(page, 'Fill');
  const box = await page.locator('.pxstudio .pxstage').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const inked = await page.evaluate(() => window.__ghosty.paintInked());
  check(inked[1] > 10 && inked[1] < 20000 && (await S(page)).undo === 1, `[${W}] FILL fills the centre of the mandala up to its lines, on the colour layer (${inked[1]} cells)`);
  await page.click('.pxstudio button[aria-label^="Back to the gallery"]');
  await until(page, () => !document.querySelector('.pxstudio'), null, 15000);

  // (j) delete and restore
  await goPaint(page, 'gallery');
  await until(page, () => window.__ghosty.paint.gallery.titles.includes('Colouring: Mandala'), null, 15000);
  await page.click('#pg-paint button[aria-label="Delete Colouring: Mandala"]');
  check(await until(page, () => !window.__ghosty.paint.gallery.titles.includes('Colouring: Mandala') && window.__ghosty.paint.bin === 1), `[${W}] DELETE puts it in Recently deleted`);
  await page.click('#pg-paint details.pxbin > summary');
  await page.click('#pg-paint button[aria-label="Restore Colouring: Mandala"]');
  check(await until(page, () => window.__ghosty.paint.gallery.titles.includes('Colouring: Mandala') && window.__ghosty.paint.bin === 0), `[${W}] RESTORE brings it back`);
  await goPaint(page, 'settings');
  await bar(page, `[${W}] the settings`, '#pg-paint');
  await ctx.close();
}

await run(PHONE);
await run(PHONE2);

// ---------------------------------------------------------------- the Comic's freehand ink, drawn in PAINT's studio over a panel
{
  const { ctx, page } = await open(PHONE);
  await page.evaluate(() => (location.hash = 'comic?make'));
  await page.waitForSelector('#pg-comic', { state: 'attached', timeout: 30000 });
  await page.evaluate(() => document.querySelector('#pg-comic .secpill[data-sec="make"]')?.click());
  await page.click('#pg-comic button[aria-label="Make a whole comic from this idea"]');
  await until(page, () => window.__ghosty.comic?.editing.pages === 4, null, 20000);
  await page.click('#pg-comic button[aria-label="Next page"]');
  await page.locator('#pg-comic .cxpage').scrollIntoViewIfNeeded();
  const box = await page.locator('#pg-comic .cxpage').boundingBox();
  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.7);
  await until(page, () => window.__ghosty.comic.editing.panel >= 0);
  await page.click('#pg-comic button[aria-label="Draw or ink on this panel with a finger or an Apple Pencil"]');
  check(await until(page, () => window.__ghosty.comic.editing.inking && document.querySelector('.pxstudio .pxcanvas')), '[440] DRAW ON IT opens the studio over the panel');
  const layers = await page.evaluate(() => window.__ghosty.paint?.layers?.map((l) => l.name).join(',') ?? '');
  await stroke(page, Array.from({ length: 30 }, (_, i) => [60 + i * 20, 200 + Math.sin(i / 3) * 40, 0.8]), { type: 'pen' });
  await page.click('.pxstudio button[aria-label="DONE"]');
  check(await until(page, () => !document.querySelector('.pxstudio') && window.__ghosty.comic.editing.inked === 1 && /Your drawing is on the panel/.test(document.querySelector('#pg-comic .cxedit .cxnote')?.textContent ?? '')), `[440] DONE puts his ink on the panel, under its balloons (${layers})`);
  check(await page.locator('#pg-comic button[aria-label="Take my drawing off this panel"]').count() === 1, '[440] the panel offers to take the drawing off again');
  await ctx.close();
}

// ---------------------------------------------------------------- BODY 21 and the seven looks, at 440
for (const [world, body] of [['scan', 21], ['map', 0], ['eye', 0], ['orbit', 0], ['grown', 0], ['ink', 0], ['glass', 0]]) {
  const tag = `[440] [${body ? 'BODY 21' : world}]`;
  const { ctx, page } = await open(PHONE, { world, body });
  await goPaint(page, 'gallery');
  await until(page, () => window.__ghosty?.paint?.gallery.state === 'ready', null, 30000);
  await bar(page, `${tag} the gallery`, '#pg-paint');
  await page.click('#pg-paint button[aria-label^="Open Sample"]');
  await until(page, () => window.__ghosty.paint.open, null, 15000);
  await page.waitForTimeout(300);
  await bar(page, `${tag} the studio`, '.pxstudio');
  const shown = await page.evaluate(() => { const c = document.querySelector('.pxstudio .pxcanvas'); const r = c.getBoundingClientRect(); return r.width > 200 && r.height > 200; });
  check(shown, `${tag} the canvas fills the studio`);
  await tool(page, 'Colour');
  await bar(page, `${tag} the colour panel`, '.pxstudio');
  if (body || world === 'glass') await page.screenshot({ path: `${out}/paint-${body ? 'body21' : world}.png` }).catch(() => undefined);
  await ctx.close();
}

await browser.close();
const secs = ((Date.now() - t0) / 1000).toFixed(0);
console.log(problems.length ? `PROBLEMS (${problems.length} of ${checks} checks):\n${problems.join('\n')}` : `PAINT run clean: ${checks} checks in ${secs} s: the sample and the tour, strokes with undo and redo, pencil pressure, QuickShape, symmetry, layers, alpha lock, a colouring page's fill, the time-lapse, a layered PSD and the bin, at both widths, BODY 21 and in all seven looks`);
process.exit(problems.length ? 1 : 0);
