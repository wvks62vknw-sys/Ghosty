// THE PHOTO EDITOR (BRIEF-EDITOR-PHOTO) on an iPhone (440 × 956) and a small one (390 × 844), in Chromium with the software GPU:
//  (a) MAKE → PHOTO in two taps; "edit a photo" in the chat opens it; (b) the empty shelf's words, then a photo opened; (c) each slider moves
//  a sampled pixel the right way (exposure up brightens, temperature up reddens, a curve point lifts the midtones) and a double tap resets;
//  (d) CROP and straighten change the drawn size and the angle, and a ratio holds; (e) a gradient mask darkens the top sample and not the
//  bottom, a brush stroke shows red under SHOW THE MASK, SUBJECT says its first-cut line; (f) HEAL takes a drawn blemish out; (g) a LAYER with
//  multiply darkens; (h) a press and hold shows the original and letting go brings the edit back; UNDO, REDO and HISTORY; (i) a look saved
//  and put on a second photo, BATCH on three with the total size said; (j) EXPORT JPEG with the size said before, the file the original's
//  size, and the original back out byte for byte; (k) WebGL forced off: the slow line shown and the picture the same within one unit; (l) the
//  Lens's PHOTO TOOLS chip lands here on BRAIN with the three keys and their offline line; (m) autosave said once and the recipe reopens;
//  (n) at BODY 21 nothing is clipped, every control is 44 pt and nothing sticks out sideways. At 440 only, the benchmark (PROGRAMME-EDITORS 6):
//  a 12-megapixel JPEG opened, straightened, graded, its sky darkened through a gradient, three blemishes healed, a look saved, put on four
//  more photos in BATCH and exported at full size, the original read back byte for byte, each step timed, and the GPU's picture against the
//  slow path's on a 64 × 64 sample.
// Needs the machine's software GL (it samples drawn pixels), so run WITHOUT NO_GL_SHOTS: it is slow there.
//   BASE=http://localhost:8788 node tests/photoedit.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';
import { mkdirSync, readFileSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const SMALL = { width: 390, height: 844 };
const problems = [];
const times = [];
const notes = [];
const ok = (cond, why) => cond || problems.push(why);
const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'];
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ARGS });

async function open(viewport, o = {}) {
  const ctx = await browser.newContext({ viewport, ...UK, deviceScaleFactor: 2, hasTouch: false, acceptDownloads: true, permissions: ['camera'] });
  if (o.noGl) {
    // WebGL2 refused, as an old phone or a lost context would: the canvas gives nothing for it
    await ctx.addInitScript(() => {
      const g = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (t, ...r) {
        return /webgl/i.test(String(t)) ? null : g.call(this, t, ...r);
      };
    });
  }
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${viewport.width}] pageerror: ${e.message}`));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/favicon|net::ERR|404|403|Failed to load resource|^[WI]\d{4} |^INFO:|WebGL|GL Driver/.test(t)) problems.push(`[${viewport.width}] console: ${t.slice(0, 200)}`);
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pair input', { timeout: 20000 });
  await page.fill('#pair input', KEY);
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
  return { ctx, page };
}

/** A JPEG drawn in the page: a gradient sky, a tilted horizon, three dark blemishes (and a tint, to tell the photos apart). */
async function jpeg(page, w, h, o = {}) {
  const b64 = await page.evaluate(async ({ w, h, tilt, tint, blem, q }) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, h * 0.58);
    sky.addColorStop(0, `rgb(${30 + tint}, 90, 205)`);
    sky.addColorStop(1, `rgb(${185 + tint}, 215, 245)`);
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    g.save();
    g.translate(w / 2, h * 0.58);
    g.rotate(tilt);
    const land = g.createLinearGradient(0, 0, 0, h * 0.42);
    land.addColorStop(0, '#4d8a43');
    land.addColorStop(1, '#2a5a2c');
    g.fillStyle = land;
    g.fillRect(-w, 0, 2 * w, h);
    g.restore();
    g.fillStyle = 'rgb(28,28,34)';
    for (const [x, y] of blem) {
      g.beginPath();
      g.arc(x * w, y * h, w * 0.0075, 0, Math.PI * 2);
      g.fill();
    }
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', q));
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode(...buf.subarray(i, i + 8192));
    return btoa(s);
  }, { w, h, tilt: o.tilt ?? 0.05, tint: o.tint ?? 0, blem: o.blem ?? [[0.26, 0.2], [0.58, 0.28], [0.8, 0.14]], q: o.q ?? 0.9 });
  return Buffer.from(b64, 'base64');
}
const gray = async (page, v) => {
  const b64 = await page.evaluate(async (v) => {
    const c = document.createElement('canvas');
    c.width = 400;
    c.height = 300;
    const g = c.getContext('2d');
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(0, 0, 400, 300);
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.92));
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (const x of buf) s += String.fromCharCode(x);
    return btoa(s);
  }, v);
  return Buffer.from(b64, 'base64');
};
const jpegSize = (b) => {
  let i = 2;
  while (i + 9 < b.length && b[i] === 0xff) {
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
};

const st = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__ghosty.photoedit, (k, v) => (typeof v === 'function' ? undefined : v))));
const recipe = (page) => page.evaluate(() => window.__ghosty.photoedit.recipe());
/** Wait until the picture has been drawn again and has stopped changing. */
async function settle(page, ms = 160) {
  let last = -1;
  for (let i = 0; i < 120; i++) {
    const s = await st(page);
    if (!s.pending && s.draws === last) return s.draws;
    last = s.draws;
    await page.waitForTimeout(ms);
  }
  return last;
}
const sample = (page, fx, fy) => page.evaluate(([x, y]) => window.__ghosty.photoedit.sample(x, y), [fx, fy]);
const tool = async (page, t) => {
  await page.click(`.pepill[data-tool="${t}"]`);
  await page.waitForTimeout(120);
};
const slide = (page, id, v) =>
  page.evaluate(([id, v]) => {
    const i = document.querySelector(`#pe-s-${id}`);
    i.value = String(v);
    i.dispatchEvent(new Event('input', { bubbles: true }));
    i.dispatchEvent(new Event('change', { bubbles: true }));
  }, [id, v]);
const key = (page, re) => page.getByRole('button', { name: re }).first();
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const dist = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
const until = (page, fn, arg, ms, why) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => (problems.push(why), false));
const downloaded = async (page, click) => {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), click()]);
  const path = await dl.path();
  const bytes = readFileSync(path);
  await dl.delete().catch(() => undefined);
  return { name: dl.suggestedFilename(), bytes };
};
const closeSheet = (page) => page.evaluate(() => document.querySelector('.modal .mhead button')?.click());
const goPhoto = async (page) => {
  await page.evaluate(() => (location.hash = 'area-make'));
  await page.waitForSelector('#pg-area-make .hubtile[data-id="editors"] .hubpill[data-editor="photo"]', { timeout: 15000 });
  await page.click('#pg-area-make .hubtile[data-id="editors"] .hubpill[data-editor="photo"]');
  await page.waitForFunction(() => document.body.dataset.tab === 'photo', null, { timeout: 15000 });
};
const toShelf = async (page) => {
  if (await page.locator('.pe:not([hidden])').count()) await page.click('.peback');
  await page.waitForSelector('.peshelf:not([hidden])', { timeout: 10000 });
};
const openFiles = async (page, files) => {
  await toShelf(page);
  await page.setInputFiles('.peshelf input[type=file]', files);
};
const ready = async (page) => {
  await page.waitForSelector('.pe:not([hidden]) .pestage', { timeout: 30000 });
  await until(page, () => window.__ghosty.photoedit.ready === true && window.__ghosty.photoedit.draws > 0, null, 60000, 'the photo was never ready');
  await settle(page);
};

let lastPage = null;
async function suite(viewport, full) {
  const W = viewport.width;
  const at = `[${W}]`;
  const { ctx, page } = await open(viewport);
  lastPage = page;
  const shot = (name) => page.screenshot({ path: `${out}/photoedit-${W}-${name}.png`, timeout: 90000 }).catch((e) => problems.push(`${at} screenshot ${name}: ${e.message.split('\n')[0]}`));

  // ---- (a) MAKE → PHOTO in two taps; "edit a photo" opens it
  await page.evaluate(() => (location.hash = 'area-make'));
  await page.waitForSelector('#pg-area-make .hubtile[data-id="editors"] .hubpill[data-editor="photo"]', { timeout: 15000 });
  const card = await page.evaluate(() => {
    const p = document.querySelector('#pg-area-make .hubtile[data-id="editors"] .hubpill[data-editor="photo"]');
    return { text: p.textContent.trim(), tag: p.tagName, label: p.getAttribute('aria-label'), ids: [...new Set([...document.querySelectorAll('#pg-area-make .hubtile')].map((e) => e.dataset.id))] };
  });
  ok(card.tag === 'BUTTON' && card.text === 'PHOTO' && /^Open /.test(card.label ?? ''), `${at} MAKE's PHOTO pill: ${JSON.stringify(card).slice(0, 200)}`);
  ok(card.ids.length === 8 && !card.ids.includes('photo'), `${at} MAKE shows ${card.ids.length} cards, eight are expected with PHOTO folded under EDITORS: ${card.ids.join(',')}`);
  await page.click('#pg-area-make .hubtile[data-id="editors"] .hubpill[data-editor="photo"]');
  await page.waitForFunction(() => document.body.dataset.tab === 'photo', null, { timeout: 15000 }).catch(() => problems.push(`${at} the PHOTO pill did not open PHOTO`));
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForSelector('#cin', { state: 'visible', timeout: 15000 });
  await page.fill('#cin', 'edit a photo');
  await page.press('#cin', 'Enter');
  await until(page, () => document.body.dataset.tab === 'photo', null, 20000, `${at} "edit a photo" did not open PHOTO`);

  // ---- (b) the empty shelf's words; a photo opened
  await page.waitForSelector('.peshelf:not([hidden])', { timeout: 10000 });
  const empty = await page.evaluate(() => ({ t: document.querySelector('.peempty')?.textContent ?? '', open: !!document.querySelector('.peopen'), hid: document.querySelector('.peempty')?.hidden }));
  ok(!empty.hid && /No photos yet/.test(empty.t) && /Open one from your camera roll/.test(empty.t) && empty.open, `${at} the empty shelf: ${JSON.stringify(empty)}`);
  await shot('shelf-empty');
  const main = await jpeg(page, 1600, 1200);
  await openFiles(page, [{ name: 'IMG_0412.jpg', mimeType: 'image/jpeg', buffer: main }]);
  await ready(page);
  let s = await st(page);
  ok(s.size.w === 1600 && s.size.h === 1200 && s.name === 'IMG_0412.jpg', `${at} the photo opened as ${JSON.stringify(s.size)} ${s.name}`);
  ok(s.gl === 'webgl2', `${at} the picture is drawn by ${s.gl}`);
  ok(/Hold the photo to see the original/.test(s.holdHint), `${at} the hold hint: "${s.holdHint}"`);
  const SKY = [0.5, 0.18];
  const ORIGINAL = await sample(page, ...SKY);
  const GRASS = await sample(page, 0.5, 0.9);
  await shot('edit');

  // ---- (c) the sliders move a sampled pixel the right way; a double tap resets
  await tool(page, 'light');
  await slide(page, 'exposure', 1.2);
  await settle(page);
  const bright = await sample(page, ...SKY);
  ok(lum(bright) > lum(ORIGINAL) + 12, `${at} exposure up did not brighten: ${ORIGINAL} → ${bright}`);
  ok((await page.locator('.peslider[data-id="exposure"] .peval').textContent()) === '+1.2 stops', `${at} the exposure's value reads "${await page.locator('.peslider[data-id="exposure"] .peval').textContent()}"`);
  await page.locator('#pe-s-exposure').dblclick({ position: { x: 30, y: 22 } });
  await settle(page);
  const back = await sample(page, ...SKY);
  ok(dist(back, ORIGINAL) <= 2 && (await page.locator('#pe-s-exposure').inputValue()) === '0', `${at} a double tap did not reset the exposure: ${back} vs ${ORIGINAL}`);
  await tool(page, 'color');
  await slide(page, 'temp', 9200);
  await settle(page);
  const warm = await sample(page, ...SKY);
  ok(warm[0] - warm[2] > ORIGINAL[0] - ORIGINAL[2] + 6, `${at} temperature up did not redden: ${ORIGINAL} → ${warm}`);
  ok(/9,200 K/.test(await page.locator('.peslider[data-id="temp"] .peval').textContent()), `${at} the temperature reads "${await page.locator('.peslider[data-id="temp"] .peval').textContent()}"`);
  await page.click('.peslider[data-id="temp"] .peval');
  await settle(page);
  ok(dist(await sample(page, ...SKY), ORIGINAL) <= 2, `${at} a tap on the value did not reset the temperature`);
  await tool(page, 'curves');
  const cv = await page.locator('.pecurve').boundingBox();
  await page.mouse.move(cv.x + cv.width * 0.5, cv.y + cv.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(cv.x + cv.width * 0.5, cv.y + cv.height * 0.3, { steps: 6 });
  await page.mouse.up();
  await settle(page);
  const lifted = await sample(page, ...SKY);
  ok(lum(lifted) > lum(ORIGINAL) + 8, `${at} a curve point did not lift the midtones: ${ORIGINAL} → ${lifted}`);
  ok((await recipe(page)).curves.l.length === 3, `${at} the curve holds ${(await recipe(page)).curves.l.length} points`);
  await page.getByRole('button', { name: /reset this curve/i }).click();
  await settle(page);
  ok(dist(await sample(page, ...SKY), ORIGINAL) <= 2, `${at} RESET THIS CURVE did not put the picture back`);
  await shot('curves');

  // ---- (d) CROP and straighten
  await tool(page, 'crop');
  const before = (await st(page)).drawn;
  await key(page, /^1:1$/).click();
  await tool(page, 'light');
  await settle(page);
  const sq = (await st(page)).drawn;
  ok(Math.abs(sq.w - sq.h) <= 2 && sq.w < before.w, `${at} a 1:1 crop is drawn ${sq.w} × ${sq.h} (was ${before.w} × ${before.h})`);
  await tool(page, 'crop');
  await slide(page, 'angle', 3);
  await settle(page);
  let r = await recipe(page);
  ok(Math.abs(r.crop.angle - 3) < 1e-6, `${at} the straighten dial left the angle at ${r.crop.angle}`);
  ok(Math.abs((r.crop.w * 1600) / (r.crop.h * 1200) - 1) < 0.01, `${at} the 1:1 did not hold when straightened: ${(r.crop.w * 1600) / (r.crop.h * 1200)}`);
  ok(/3\.0°/.test(await page.locator('.peslider[data-id="angle"] .peval').textContent()), `${at} the angle reads "${await page.locator('.peslider[data-id="angle"] .peval').textContent()}"`);
  await shot('crop');
  await key(page, /^free$/i).click();
  await page.getByRole('button', { name: /reset the crop/i }).click();
  await settle(page);
  r = await recipe(page);
  ok(r.crop.angle === 0 && r.crop.w === 1 && !r.crop.flip, `${at} the crop was not reset: ${JSON.stringify(r.crop)}`);

  // ---- (e) masks: a gradient darkens the top and not the bottom; a brush shows red; SUBJECT says its first cut
  await tool(page, 'masks');
  const TOP = [0.5, 0.08];
  const topBefore = await sample(page, ...TOP);
  const botBefore = await sample(page, 0.5, 0.52);
  await key(page, /^gradient$/i).click();
  await settle(page);
  ok((await recipe(page)).masks.length === 1, `${at} no gradient mask was made`);
  await slide(page, 'm-exposure', -70);
  await settle(page);
  const topAfter = await sample(page, ...TOP);
  const botAfter = await sample(page, 0.5, 0.9);
  ok(lum(topAfter) < lum(topBefore) - 14, `${at} the gradient did not darken the top: ${topBefore} → ${topAfter}`);
  ok(dist(botAfter, GRASS) <= 3, `${at} the gradient changed the bottom: ${GRASS} → ${botAfter}`);
  void botBefore;
  ok(await page.locator('.peover .pehandle').count() === 2, `${at} a gradient shows ${await page.locator('.peover .pehandle').count()} handles (two expected)`);
  await shot('gradient');
  await key(page, /^brush$/i).click();
  await settle(page);
  const stage = await page.locator('.pestage').boundingBox();
  const sx = stage.x + stage.width * 0.5;
  const sy = stage.y + stage.height * 0.35;
  await page.mouse.move(sx - 40, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 40, sy + 10, { steps: 10 });
  await page.mouse.up();
  await settle(page);
  await key(page, /^show the mask$/i).click();
  await page.waitForTimeout(300);
  const redPx = await page.evaluate(([x, y]) => {
    const c = document.querySelector('.pered');
    if (!c || c.hidden) return null;
    const r = c.getBoundingClientRect();
    const d = c.getContext('2d').getImageData(Math.round(((x - r.left) / r.width) * c.width), Math.round(((y - r.top) / r.height) * c.height), 1, 1).data;
    const far = c.getContext('2d').getImageData(2, c.height - 3, 1, 1).data;
    return { r: d[0], a: d[3], farA: far[3] };
  }, [sx, sy + 5]);
  ok(redPx && redPx.r > 200 && redPx.a > 60 && redPx.farA < 10, `${at} a brush stroke did not show red under SHOW THE MASK: ${JSON.stringify(redPx)}`);
  await shot('brush');
  await key(page, /^subject$/i).click();
  await page.waitForTimeout(400);
  const sub = await page.locator('.pesubject').first().textContent();
  ok(/first cut/i.test(sub) && /paint to fix it/i.test(sub), `${at} SUBJECT says "${sub}"`);
  const subLine = await page.locator('.pesubjectline').textContent().catch(() => '');
  ok(/MEASURE’S DISTANCE|THE LENS’S EYES|on this phone/i.test(subLine), `${at} SUBJECT's pack line says "${subLine}"`);
  // (take them away again: the next steps are about the rest)
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: /^delete the mask$/i }).click().catch(() => undefined), await page.waitForTimeout(100);
  await settle(page);

  // ---- (f) HEAL takes a drawn blemish out
  await tool(page, 'heal');
  const blems = [[0.26, 0.2], [0.58, 0.28], [0.8, 0.14]];
  const pre = await Promise.all(blems.map(([x, y]) => sample(page, x, y)));
  ok(pre.every((c) => lum(c) < 140), `${at} the drawn blemishes are not dark in the picture: ${JSON.stringify(pre)}`);
  const p0 = await page.evaluate(([x, y]) => window.__ghosty.photoedit.project(x, y), blems[0]);
  await page.mouse.click(p0.x, p0.y);
  await settle(page);
  const healed = await sample(page, ...blems[0]);
  const near = await sample(page, blems[0][0] + 0.05, blems[0][1]);
  ok(dist(healed, near) <= 26 || lum(healed) > 150, `${at} HEAL left the blemish: ${pre[0]} → ${healed} (neighbour ${near})`);
  ok((await recipe(page)).heals.length === 1, `${at} ${(await recipe(page)).heals.length} heals after one tap`);
  for (const b of blems.slice(1)) {
    const p = await page.evaluate(([x, y]) => window.__ghosty.photoedit.project(x, y), b);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(350);
  }
  await settle(page);
  ok((await recipe(page)).heals.length === 3, `${at} three taps made ${(await recipe(page)).heals.length} heals (a quick second tap must not be taken for a zoom)`);
  for (const b of blems) {
    const c = await sample(page, ...b);
    ok(lum(c) > 120, `${at} a blemish is still dark after HEAL: ${c}`);
  }
  await shot('heal');

  // ---- (g) a LAYER with multiply darkens
  await tool(page, 'layer');
  const skyPre = await sample(page, 0.5, 0.35);
  await page.setInputFiles('.petray input[type=file]', [{ name: 'texture.jpg', mimeType: 'image/jpeg', buffer: await gray(page, 120) }]);
  await until(page, () => window.__ghosty.photoedit.recipe().layer !== null, null, 15000, `${at} the layer did not come in`);
  await settle(page);
  await key(page, /^multiply$/i).click();
  await settle(page);
  const skyMul = await sample(page, 0.5, 0.35);
  ok(lum(skyMul) < lum(skyPre) - 18, `${at} a multiply layer did not darken: ${skyPre} → ${skyMul}`);
  r = await recipe(page);
  ok(r.layer.blend === 'multiply' && r.layer.opacity === 60, `${at} the layer is ${JSON.stringify({ b: r.layer.blend, o: r.layer.opacity })}`);
  await shot('layer');

  // ---- (h) hold shows the original; UNDO, REDO, HISTORY
  await tool(page, 'light');
  await slide(page, 'exposure', 0.8);
  await settle(page);
  const edited = await sample(page, ...SKY);
  const stg = await page.locator('.pestage').boundingBox();
  await page.mouse.move(stg.x + stg.width * 0.12, stg.y + stg.height * 0.5);
  await page.mouse.down();
  await page.waitForTimeout(500);
  await settle(page);
  ok((await st(page)).held === true, `${at} a press and hold did not show the original`);
  const orig2 = await sample(page, ...SKY);
  ok(dist(orig2, ORIGINAL) <= 3 && dist(orig2, edited) > 8, `${at} while held the sample is ${orig2} (original ${ORIGINAL}, edited ${edited})`);
  const dBefore = (await st(page)).draws;
  await page.mouse.up();
  await until(page, ([d]) => window.__ghosty.photoedit.held === false && window.__ghosty.photoedit.draws > d, [dBefore], 20000, `${at} the picture was not drawn again after letting go`);
  await settle(page);
  const released = await sample(page, ...SKY);
  ok((await st(page)).held === false && dist(released, edited) <= 3, `${at} letting go did not bring the edit back: edited ${edited}, released ${released}, held ${(await st(page)).held}`);
  s = await st(page);
  const steps0 = s.steps;
  ok(s.canUndo && !s.canRedo && steps0 > 6, `${at} the history holds ${steps0} steps (undo ${s.canUndo})`);
  await page.getByRole('button', { name: /^undo$/i }).click();
  await settle(page);
  ok(dist(await sample(page, ...SKY), edited) > 4 || (await recipe(page)).light.exposure === 0, `${at} UNDO did not undo the exposure`);
  ok((await st(page)).canRedo, `${at} REDO is not offered after UNDO`);
  await page.getByRole('button', { name: /^redo$/i }).click();
  await settle(page);
  ok((await recipe(page)).light.exposure === 0.8, `${at} REDO did not do it again (exposure ${(await recipe(page)).light.exposure})`);
  await page.getByRole('button', { name: /^history$/i }).click();
  await page.waitForSelector('.pehist .pestep', { timeout: 5000 });
  const labels = await page.locator('.pehist .pestep b').allTextContents();
  ok(labels.length === steps0 && labels[0] === 'Opened' && labels.some((l) => /Healed a spot/.test(l)) && labels.some((l) => /Exposure/.test(l)), `${at} HISTORY lists ${labels.join(' | ')}`);
  const dZero = (await st(page)).draws;
  await page.locator('.pehist .pestep').nth(0).click();
  await until(page, ([d]) => window.__ghosty.photoedit.at === 0 && window.__ghosty.photoedit.draws > d, [dZero], 20000, `${at} the picture was not drawn again after the jump to the first step`);
  await settle(page);
  const atZero = await sample(page, ...SKY);
  ok(dist(atZero, ORIGINAL) <= 2 && (await st(page)).at === 0, `${at} a tap on the first step did not go back to the photo as opened: ${atZero} against ${ORIGINAL}, step ${(await st(page)).at}`);
  if (process.env.PE_STOP === 'h') return void (await ctx.close());
  await page.getByRole('button', { name: /^history$/i }).click();
  await page.locator('.pehist .pestep').last().click();
  await settle(page);
  ok((await recipe(page)).heals.length === 3, `${at} a tap on the last step did not bring everything back`);

  // ---- (m) autosave said once; the recipe reopens
  await page.waitForTimeout(700);
  s = await st(page);
  ok(s.saved === 'SAVED' && s.saves >= 1, `${at} the autosave said "${s.saved}" after ${s.saves} saves`);
  const savedText = await page.locator('.pesaved').textContent();
  ok(/^SAVED$/.test(savedText), `${at} the saved mark reads "${savedText}"`);
  const mid = JSON.stringify((await recipe(page)).light);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pair input, #boot', { timeout: 20000 }).catch(() => undefined);
  if (await page.locator('#pair input').count()) {
    await page.fill('#pair input', KEY);
    await page.click('#pair button.on');
  }
  await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 }).catch(() => undefined);
  await goPhoto(page);
  await ready(page);
  r = await recipe(page);
  ok(JSON.stringify(r.light) === mid && r.heals.length === 3 && r.layer?.blend === 'multiply', `${at} the recipe did not come back after a reload: ${JSON.stringify(r.light)} ${r.heals.length} heals`);
  ok((await st(page)).name === 'IMG_0412.jpg', `${at} reopened on "${(await st(page)).name}"`);
  await shot('reopened');

  // ---- (i) a look saved and put on a second photo; BATCH on three with EXPORT ALL and the total size said
  await tool(page, 'looks');
  await page.waitForFunction(() => document.querySelectorAll('.pelook').length > 0, null, { timeout: 15000 }).catch(async () => problems.push(`${at} the looks tray is empty: tool ${(await st(page)).tool}, ${(await page.evaluate(() => document.querySelector('.petray')?.innerHTML.slice(0, 160)))}`));
  ok((await page.locator('.pelook').count()) === 9, `${at} the looks strip has ${await page.locator('.pelook').count()} looks (ORIGINAL and eight)`);
  const names = await page.locator('.pelook b').allTextContents();
  ok(names.includes('GOLDEN HOUR') && names.includes('FADED FILM') && names.includes('BLACK AND WHITE') && !names.some((n) => /instagram|vsco|lightroom|kodak|fuji|snapseed/i.test(n)), `${at} the looks are named ${names.join(', ')}`);
  await key(page, /save this as a look/i).click();
  await page.fill('.peinput', 'spec look');
  await page.getByRole('button', { name: /^save$/i }).click();
  await until(page, () => window.__ghosty.photoedit.looks.includes('SPEC LOOK'), null, 8000, `${at} the look was not saved`);
  const keptLight = JSON.stringify((await recipe(page)).light);
  const second = await jpeg(page, 1600, 1200, { tint: 18, tilt: -0.03 });
  const third = await jpeg(page, 1200, 900, { tint: 40, tilt: 0.02 });
  await openFiles(page, [{ name: 'IMG_0413.jpg', mimeType: 'image/jpeg', buffer: second }, { name: 'IMG_0414.jpg', mimeType: 'image/jpeg', buffer: third }]);
  await ready(page);
  ok((await st(page)).name === 'IMG_0413.jpg', `${at} the second photo opened as "${(await st(page)).name}"`);
  await tool(page, 'crop');
  await key(page, /^4:5$/).click();
  await tool(page, 'looks');
  await page.waitForSelector('.pelookmine', { timeout: 10000 });
  await page.locator('.pelookmine .pelook').first().click();
  await settle(page);
  r = await recipe(page);
  ok(JSON.stringify(r.light) === keptLight || r.light.exposure === JSON.parse(keptLight).exposure, `${at} the look did not land on the second photo: ${JSON.stringify(r.light)} vs ${keptLight}`);
  ok(r.crop.ratio === '4:5' && r.crop.w < 1, `${at} the look took the second photo's own crop away: ${JSON.stringify(r.crop)}`);
  await toShelf(page);
  ok((await page.locator('.peshot').count()) === 3, `${at} the shelf holds ${await page.locator('.peshot').count()} photos (three expected)`);
  await page.click('.pebatchb');
  const tiles = page.locator('.peshot');
  for (let i = 0; i < 3; i++) await tiles.nth(i).click();
  ok(/3 PICKED/.test(await page.locator('.pebatchsay').textContent()), `${at} the batch says "${await page.locator('.pebatchsay').textContent()}"`);
  await page.getByRole('button', { name: /look and export all/i }).click();
  await page.waitForSelector('.peexport', { timeout: 10000 });
  await page.getByRole('button', { name: /^golden hour$/i }).click();
  const t0 = Date.now();
  await page.getByRole('button', { name: /apply and export all/i }).click();
  await page.waitForFunction(() => /\d of 3|Photo \d of 3/.test(document.querySelector('.peexstatus')?.textContent ?? ''), null, { timeout: 60000 }).catch(() => problems.push(`${at} the batch never said its count`));
  await until(page, () => window.__ghosty.photoedit.shelf.run.phase === 'done', null, 280000, `${at} the batch never finished`);
  const run = (await st(page)).shelf.run;
  const total = await page.locator('.peexport .peexsize').textContent();
  ok(/^3 photos · golden hour · [\d.,]+ (KB|MB) in all/.test(total), `${at} the batch's total reads "${total}"`);
  ok(run.files.length === 3 && run.files.every((f) => f.bytes > 20000), `${at} the batch's files: ${JSON.stringify(run.files)}`);
  ok(run.files[0].w <= 1600 && run.files[0].h <= 1200 && run.files.some((f) => f.w === 1200 || f.h === 1200 || f.w === 1600), `${at} the batch files' sizes: ${JSON.stringify(run.files.map((f) => `${f.w}x${f.h}`))}`);
  ok(await page.getByRole('button', { name: /share all/i }).isVisible(), `${at} no SHARE ALL once the batch is done`);
  notes.push(`${at} batch of 3 on small photos: ${Date.now() - t0} ms, ${total}`);
  await shot('batch');
  await closeSheet(page);

  // ---- (j) EXPORT JPEG: the size said before, the file the original's size; the original back out byte for byte
  await toShelf(page);
  await openFiles(page, [{ name: 'IMG_0415.jpg', mimeType: 'image/jpeg', buffer: main }]);
  await ready(page);
  await tool(page, 'light');
  await slide(page, 'exposure', 0.4);
  await slide(page, 'contrast', 15);
  await settle(page);
  await page.getByRole('button', { name: /^export$/i }).click();
  await page.waitForSelector('.peexport', { timeout: 10000 });
  await until(page, () => window.__ghosty.photoedit.export.phase === 'ready' && window.__ghosty.photoedit.export.bytes > 0, null, 180000, `${at} the export never got ready`);
  const said = await page.locator('.peexsize').textContent();
  ok(/^1,600 × 1,200 · 1\.9 megapixels · [\d.,]+ (KB|MB)$/.test(said), `${at} the export says "${said}" before saving`);
  const ex = await downloaded(page, () => page.getByRole('button', { name: /^save$/i }).click());
  const dim = jpegSize(ex.bytes);
  ok(dim && dim.w === 1600 && dim.h === 1200 && /^IMG_0415-edit\.jpg$/.test(ex.name), `${at} the exported file is ${JSON.stringify(dim)} called "${ex.name}"`);
  const stated = (await st(page)).export;
  ok(stated.bytes === ex.bytes.length, `${at} the size said (${stated.bytes}) is not the file's (${ex.bytes.length})`);
  await page.getByRole('button', { name: /^the original$/i }).click();
  await page.waitForTimeout(300);
  const said2 = await page.locator('.peexsize').textContent();
  ok(said2.includes(`${(main.length / 1000).toFixed(1)} KB`) || said2.includes(`${(main.length / 1e6).toFixed(1)} MB`), `${at} THE ORIGINAL's size reads "${said2}" (the file is ${main.length} bytes)`);
  const orig = await downloaded(page, () => page.getByRole('button', { name: /^save$/i }).click());
  ok(orig.bytes.equals(main), `${at} the original did not come back out byte for byte (${orig.bytes.length} against ${main.length})`);
  ok(orig.name === 'IMG_0415.jpg', `${at} the original came out as "${orig.name}"`);
  await shot('export');
  await closeSheet(page);

  // ---- (n) BODY 21 clips nothing, every control is 44 pt, nothing is sideways
  for (const body of [null, '21']) {
    if (body) await page.evaluate((b) => (document.documentElement.dataset.body = b), body);
    for (const t of ['light', 'color', 'curves', 'detail', 'crop', 'masks', 'heal', 'layer', 'effects', 'brain', 'looks']) {
      await tool(page, t);
      await page.waitForTimeout(200);
      const m = await page.evaluate(([W, bodyBig]) => {
        const root = document.querySelector('#pg-photo');
        const seen = (el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[hidden]');
        };
        const controls = [...root.querySelectorAll('button, input:not([type=file]), select')].filter(seen);
        const small = controls.filter((c) => c.offsetWidth < 43.5 || c.offsetHeight < 43.5).map((c) => `${c.tagName.toLowerCase()}.${c.className} ${c.offsetWidth}×${c.offsetHeight} "${(c.textContent || c.getAttribute('aria-label') || '').trim().slice(0, 20)}"`);
        const unnamed = controls.filter((c) => !(c.getAttribute('aria-label') || c.textContent || c.labels?.[0]?.textContent || '').trim()).map((c) => c.outerHTML.slice(0, 70));
        const cut = bodyBig ? controls.filter((c) => c.tagName === 'BUTTON' && c.scrollWidth > c.clientWidth + 1 && getComputedStyle(c).overflow !== 'visible').map((c) => `"${(c.textContent || '').trim().slice(0, 24)}" ${c.scrollWidth}/${c.clientWidth}`) : [];
        const wide = [...root.querySelectorAll('*')].filter((el) => !el.closest('svg') && !el.closest('.pepills') && !el.closest('.pelooks') && seen(el) && getComputedStyle(el).position !== 'absolute' && el.getBoundingClientRect().right > W + 0.5).map((el) => `${el.tagName.toLowerCase()}.${el.className}`).slice(0, 4);
        return { small: small.slice(0, 5), unnamed: unnamed.slice(0, 4), cut: cut.slice(0, 5), wide, scroll: document.documentElement.scrollWidth };
      }, [W, !!body]);
      ok(!m.small.length, `${at}${body ? ' BODY 21' : ''} [${t}] a control under 44 pt: ${m.small.join(' | ')}`);
      ok(!m.unnamed.length, `${at}${body ? ' BODY 21' : ''} [${t}] a control with no name: ${m.unnamed.join(' | ')}`);
      ok(!m.cut.length, `${at}${body ? ' BODY 21' : ''} [${t}] a key cuts its words: ${m.cut.join(' | ')}`);
      ok(!m.wide.length && m.scroll <= W, `${at}${body ? ' BODY 21' : ''} [${t}] sticks out sideways (${m.scroll}): ${m.wide.join(' | ')}`);
    }
    if (body) await shot('body21');
  }
  await page.evaluate(() => delete document.documentElement.dataset.body);
  await toShelf(page);
  const side = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, small: [...document.querySelectorAll('#pg-photo button')].filter((b) => b.offsetParent && (b.offsetHeight < 43.5 || b.offsetWidth < 43.5)).map((b) => b.textContent.slice(0, 20)) }));
  ok(side.s <= W && !side.small.length, `${at} the shelf: ${JSON.stringify(side)}`);
  await shot('shelf');

  if (!full) return void (await ctx.close());

  // ---- (k) WebGL forced off: the slow line, the same picture
  const glSamples = [];
  await openFiles(page, [{ name: 'IMG_0420.jpg', mimeType: 'image/jpeg', buffer: main }]);
  await ready(page);
  await tool(page, 'light');
  await slide(page, 'exposure', 0.6);
  await tool(page, 'color');
  await slide(page, 'temp', 8200);
  await settle(page);
  for (const [x, y] of [[0.3, 0.1], [0.7, 0.3], [0.5, 0.45], [0.2, 0.8]]) glSamples.push(await sample(page, x, y));
  const cmp = await page.evaluate(() => window.__ghosty.photoedit.compare64());
  ok(cmp && cmp.max <= 1, `${at} the GPU's picture against the slow path's on 64 × 64: ${JSON.stringify(cmp)} (one unit allowed)`);
  notes.push(`${at} GPU against CPU on 64 × 64: largest difference ${cmp?.max}, mean ${cmp?.mean?.toFixed?.(5)}`);
  await ctx.close();
  {
    const nogl = await open(viewport, { noGl: true });
    const p2 = nogl.page;
    await goPhoto(p2);
    await p2.waitForSelector('.peshelf:not([hidden])');
    await p2.setInputFiles('.peshelf input[type=file]', [{ name: 'IMG_0420.jpg', mimeType: 'image/jpeg', buffer: main }]);
    await ready(p2);
    const s2 = await st(p2);
    ok(s2.gl === 'slow', `${at} with WebGL refused the picture is drawn by "${s2.gl}"`);
    const line = await p2.locator('.peslow').textContent();
    ok(/^Drawing this the slow way…/.test(line) && (await p2.locator('.peslow').isVisible()), `${at} the slow line reads "${line}"`);
    await p2.click('.pepill[data-tool="light"]');
    await slide(p2, 'exposure', 0.6);
    await p2.click('.pepill[data-tool="color"]');
    await slide(p2, 'temp', 8200);
    await settle(p2, 300);
    const slowSamples = [];
    for (const [x, y] of [[0.3, 0.1], [0.7, 0.3], [0.5, 0.45], [0.2, 0.8]]) slowSamples.push(await sample(p2, x, y));
    slowSamples.forEach((c, i) => ok(dist(c, glSamples[i]) <= 1.6, `${at} the slow path's picture differs from the GPU's at sample ${i}: ${c} against ${glSamples[i]}`));
    await p2.screenshot({ path: `${out}/photoedit-${W}-slow.png` });
    // the slow way still exports, and says so
    await p2.getByRole('button', { name: /^export$/i }).click();
    await p2.waitForSelector('.peexport', { timeout: 10000 });
    await until(p2, () => window.__ghosty.photoedit.export.phase === 'ready' && window.__ghosty.photoedit.export.bytes > 0, null, 280000, `${at} the slow export never got ready`);
    ok(/slow way/i.test(await p2.locator('.peexfacts').textContent()), `${at} the export does not say it was drawn the slow way: ${await p2.locator('.peexfacts').textContent()}`);
    await nogl.ctx.close();
  }

  // ---- (l) the Lens's PHOTO TOOLS chip lands here on BRAIN with the three keys and their offline line
  {
    const { ctx: c2, page: p } = await open(viewport);
    await p.evaluate(() => window.__ghosty.run('open_lens', { mode: 'ask' }));
    await p.waitForSelector('#pg-lens', { state: 'visible', timeout: 15000 });
    await p.waitForTimeout(1500);
    if ((await p.evaluate(() => window.__ghosty.lens.camera)) === 'off') await p.locator('#pg-lens .lensbar button', { hasText: 'START' }).click();
    await p.waitForFunction(() => window.__ghosty?.lens?.camera === 'on', null, { timeout: 30000 }).catch(() => problems.push(`${at} the fake camera did not open`));
    await p.waitForTimeout(800);
    await p.locator('#pg-lens .lensbar button', { hasText: 'FREEZE' }).click();
    const chip = p.locator('#pg-lens .lensbar button', { hasText: 'PHOTO TOOLS' });
    await chip.waitFor({ state: 'visible', timeout: 5000 }).catch(() => problems.push(`${at} no PHOTO TOOLS chip once a photo was taken`));
    await chip.click();
    await p.waitForFunction(() => document.body.dataset.tab === 'photo', null, { timeout: 20000 }).catch(() => problems.push(`${at} the PHOTO TOOLS chip did not land in the photo editor`));
    await p.waitForSelector('.pe:not([hidden]) .pebrain', { timeout: 30000 }).catch(() => problems.push(`${at} the BRAIN keys did not show`));
    const keys = (await p.locator('.pebrain b').allTextContents()).join(' | ');
    ok(keys === 'BACKGROUND | SHARPER | ERASE', `${at} the BRAIN keys read "${keys}"`);
    ok((await st(p)).tool === 'brain' && /Lens photo/.test((await st(p)).name), `${at} the chip landed on ${(await st(p)).tool} with "${(await st(p)).name}"`);
    const said = await p.locator('.pebrainline').textContent();
    ok(/SEND THE PHOTO TO THE BRAIN/.test(said), `${at} before the first tap the BRAIN group says "${said}"`);
    await p.evaluate(() => window.__ghosty.ui.set({ connected: false }));
    await p.waitForTimeout(300);
    const off = await p.locator('.pebrainline').textContent();
    ok(/^NEEDS THE BRAIN; EVERYTHING ELSE HERE WORKS WITHOUT IT$/.test(off) && (await p.locator('.pebrain').first().isDisabled()), `${at} offline the BRAIN group says "${off}"`);
    await p.click('.pepill[data-tool="light"]');
    ok(await p.locator('#pe-s-exposure').isEnabled(), `${at} the light tool does not work offline`);
    await p.evaluate(() => window.__ghosty.ui.set({ connected: true }));
    await p.click('.pepill[data-tool="brain"]');
    await p.locator('.pebrain[data-job="background"]').click();
    await p.waitForSelector('.modal .ptsheet', { timeout: 15000 }).catch(() => problems.push(`${at} a BRAIN key did not open the photo tools sheet`));
    ok((await p.evaluate(() => window.__ghosty.photo?.job)) === 'background', `${at} the BACKGROUND key opened the sheet on ${await p.evaluate(() => window.__ghosty.photo?.job)}`);
    await p.screenshot({ path: `${out}/photoedit-${W}-brain.png` }).catch(() => undefined);
    await c2.close();
  }

  // ---- the benchmark (PROGRAMME-EDITORS 6): a 12-megapixel photo, start to finish, each step timed
  {
    const { ctx: c3, page: p } = await open(viewport);
    const T = {};
    const lap = (name, t) => {
      T[name] = Date.now() - t;
      return Date.now();
    };
    const gen = Date.now();
    const big = await jpeg(p, 4000, 3000, { tilt: 0.05, q: 0.9 });
    const bigDim = jpegSize(big);
    notes.push(`${at} benchmark picture: ${bigDim.w} × ${bigDim.h}, ${(big.length / 1e6).toFixed(1)} MB, drawn in ${Date.now() - gen} ms (by the spec; deleted after)`);
    await goPhoto(p);
    await p.waitForSelector('.peshelf:not([hidden])');
    let t = Date.now();
    await p.setInputFiles('.peshelf input[type=file]', [{ name: 'BENCH_12MP.jpg', mimeType: 'image/jpeg', buffer: big }]);
    await ready(p);
    t = lap('open', t);
    ok((await st(p)).size.w === 4000, `${at} the benchmark photo opened as ${JSON.stringify((await st(p)).size)}`);
    const horizonAt = async (u) => p.evaluate((u) => {
      // the row, down the drawn picture, where the sky turns to land
      const c = document.querySelector('.pecanvas:not([hidden])');
      const t = document.createElement('canvas');
      t.width = c.width;
      t.height = c.height;
      const g = t.getContext('2d', { willReadFrequently: true });
      g.drawImage(c, 0, 0);
      const x = Math.round(u * (c.width - 1));
      const d = g.getImageData(x, 0, 1, c.height).data;
      for (let y = 2; y < c.height - 2; y++) if (d[y * 4 + 1] - d[(y + 2) * 4 + 1] > 40 && d[(y + 2) * 4 + 2] < 120) return y / c.height;
      return null;
    }, u);
    const tiltBefore = Math.abs((await horizonAt(0.12)) - (await horizonAt(0.88)));
    await tool(p, 'crop');
    await slide(p, 'angle', 2.9);
    await settle(p);
    t = lap('straighten', t);
    await tool(p, 'light');
    const tiltAfter = Math.abs((await horizonAt(0.12)) - (await horizonAt(0.88)));
    ok(tiltAfter < tiltBefore * 0.35, `${at} straightening left the horizon ${tiltAfter.toFixed(4)} out (it was ${tiltBefore.toFixed(4)})`);
    await slide(p, 'exposure', 0.35);
    await tool(p, 'color');
    await slide(p, 'temp', 7400);
    await tool(p, 'curves');
    const cb = await p.locator('.pecurve').boundingBox();
    await p.mouse.move(cb.x + cb.width * 0.5, cb.y + cb.height * 0.5);
    await p.mouse.down();
    await p.mouse.move(cb.x + cb.width * 0.5, cb.y + cb.height * 0.42, { steps: 4 });
    await p.mouse.up();
    await settle(p);
    t = lap('grade', t);
    await tool(p, 'masks');
    await key(p, /^gradient$/i).click();
    await slide(p, 'm-exposure', -60);
    await settle(p);
    t = lap('sky mask', t);
    await tool(p, 'heal');
    // the blemishes are tapped where the picture shows them now (the sky is still the sky)
    for (const b of [[0.26, 0.2], [0.58, 0.28], [0.8, 0.14]]) {
      const q = await p.evaluate(([x, y]) => window.__ghosty.photoedit.project(x, y), b);
      await p.mouse.click(q.x, q.y);
      await p.waitForTimeout(350);
    }
    await settle(p);
    ok((await recipe(p)).heals.length === 3, `${at} the benchmark healed ${(await recipe(p)).heals.length} of 3 blemishes`);
    t = lap('heal x3', t);
    await tool(p, 'looks');
    await key(p, /save this as a look/i).click();
    await p.fill('.peinput', 'bench look');
    await p.getByRole('button', { name: /^save$/i }).click();
    await until(p, () => window.__ghosty.photoedit.looks.includes('BENCH LOOK'), null, 8000, `${at} the benchmark look was not saved`);
    t = lap('save look', t);
    await toShelf(p);
    const four = [];
    for (let i = 0; i < 4; i++) four.push({ name: `BENCH_12MP_${i + 2}.jpg`, mimeType: 'image/jpeg', buffer: await jpeg(p, 4000, 3000, { tint: 12 * (i + 1), tilt: 0.05 - i * 0.02, q: 0.88 }) });
    t = Date.now();
    await p.setInputFiles('.peshelf input[type=file]', four);
    await ready(p);
    t = lap('keep 4 more', t);
    await toShelf(p);
    ok((await p.locator('.peshot').count()) === 5, `${at} the shelf holds ${await p.locator('.peshot').count()} photos (five expected)`);
    await p.click('.pebatchb');
    await p.getByRole('button', { name: /^all$/i }).click();
    await p.getByRole('button', { name: /look and export all/i }).click();
    await p.getByRole('button', { name: /^bench look$/i }).click();
    t = Date.now();
    await p.getByRole('button', { name: /apply and export all/i }).click();
    await until(p, () => window.__ghosty.photoedit.shelf.run.phase === 'done', null, 900000, `${at} the 12 MP batch never finished`);
    t = lap('batch x5 and export', t);
    const br = (await st(p)).shelf.run;
    const btotal = await p.locator('.peexport .peexsize').textContent();
    ok(br.files.length === 5 && br.files.every((f) => f.w * f.h > 10_000_000), `${at} the 12 MP batch: ${JSON.stringify(br.files.map((f) => `${f.w}x${f.h} ${f.bytes}`))}`);
    ok(/^5 photos · bench look · [\d.,]+ (KB|MB) in all/.test(btotal), `${at} the 12 MP batch's total reads "${btotal}"`);
    notes.push(`${at} the 12 MP batch's files: ${br.files.map((f) => `${f.w}×${f.h} ${(f.bytes / 1e6).toFixed(1)} MB`).join(', ')}; ${btotal}`);
    await closeSheet(p);
    // the first photo exported at full size with the original read back byte for byte
    await toShelf(p);
    const first = p.locator('.peshot', { hasText: 'BENCH_12MP.jpg' });
    await first.click();
    await ready(p);
    t = Date.now();
    await p.getByRole('button', { name: /^export$/i }).click();
    await p.waitForSelector('.peexport');
    await until(p, () => window.__ghosty.photoedit.export.phase === 'ready' && window.__ghosty.photoedit.export.bytes > 0, null, 900000, `${at} the 12 MP export never got ready`);
    t = lap('export 12 MP (draw and encode)', t);
    const es = (await st(p)).export;
    const say12 = await p.locator('.peexsize').textContent();
    const exp = await downloaded(p, () => p.getByRole('button', { name: /^save$/i }).click());
    const ed = jpegSize(exp.bytes);
    // (the straighten crops the corners the turned picture leaves empty: the picture comes out at the crop's own pixels, fewer than 12 MP)
    ok(ed && ed.w === es.w && ed.h === es.h && ed.w * ed.h > 10_500_000, `${at} the 12 MP export is ${JSON.stringify(ed)} (said ${es.w} × ${es.h})`);
    ok(es.bytes === exp.bytes.length, `${at} the 12 MP export said ${es.bytes} bytes and is ${exp.bytes.length}`);
    await p.getByRole('button', { name: /^the original$/i }).click();
    const back = await downloaded(p, () => p.getByRole('button', { name: /^save$/i }).click());
    ok(back.bytes.equals(big), `${at} the 12 MP original did not come back byte for byte`);
    notes.push(`${at} the 12 MP export: ${ed?.w} × ${ed?.h}, "${say12}", ${es.tiles} tiles, drawn in ${es.drawMs} ms, the original read back ${back.bytes.equals(big) ? 'byte-equal' : 'DIFFERENT'}`);
    const info = await st(p);
    notes.push(`${at} pipeline: ${info.renderer}; texture limit ${info.maxTexture}; tile ${info.tile}; intermediate pictures ${info.floatTargets}; frame ${info.frameMs} ms at ${info.drawn.w} × ${info.drawn.h}`);
    const cmp2 = await p.evaluate(() => window.__ghosty.photoedit.compare64());
    ok(cmp2 && cmp2.max <= 1, `${at} the benchmark's GPU against CPU: ${JSON.stringify(cmp2)}`);
    notes.push(`${at} benchmark times (ms): ${Object.entries(T).map(([k, v]) => `${k} ${v}`).join(', ')}`);
    times.push(T);
    await closeSheet(p);
    await c3.close();
  }
  await ctx.close().catch(() => undefined);
}

try {
  await suite(PHONE, true);
  await suite(SMALL, false);
} catch (e) {
  problems.push(`the spec stopped: ${String(e.message).split('\n').slice(0, 3).join(' ')}`);
  await lastPage?.screenshot({ path: `${out}/photoedit-stopped.png` }).catch(() => undefined);
}
await browser.close();
for (const n of notes) console.log(n);
if (problems.length) {
  console.error(`FAIL photoedit:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('ok: PHOTO — MAKE → PHOTO in two taps and from the chat, the empty shelf, every slider moving its pixel and resetting, crop and straighten, the gradient, brush and subject masks, heal, a multiply layer, hold for the original, undo, redo and history, autosave said once and the recipe back after a reload, a look saved and put on a second photo, a batch with its total size, export with the size said and the original back byte for byte, the slow way within one unit, the Lens chip on BRAIN with its offline line, BODY 21 and 44 pt, and the 12-megapixel benchmark.');
