// PHOTO 2 (BRIEF-EDITOR-PHOTO-2) on an iPhone (440 × 956) and a small one (390 × 844), Chromium with the software GPU: the three downloads the
// photo editor offers, each on his tap, with the size said first, and what they do.
//  (a) SUBJECT with no pack: the first cut's line and "A better cut-out needs the cut-out model (N MB): GET", nothing fetched before the tap;
//  (f) offline: GET waits and says so, and starts by itself when the signal is back; (b) the pack fetched (this site's own files): SUBJECT on a
//  drawn picture of a dark shape on a light ground gives a mask that covers the shape and not the ground, says "From the cut-out model", still
//  offers REFINE WITH DEPTH (which says what it needs), and the brush fixes it; (c) ERASE: the offer with its size and BRAIN ERASE beside it, then
//  with the pack a drawn blemish on a flat ground is gone within a threshold of its neighbours, UNDO brings it back, REDO again, the export at
//  full size carries the erase, and the tray says it ran on this phone; (d) RAW: a tiny linear DNG this spec writes, shared in with no reader
//  kept, says the reader's size and GET; with it the RAW opens, says so, the exposure slider moves a sampled pixel, and EXPORT ORIGINAL gives the
//  DNG's bytes back equal; (e) REMOVE in Settings frees the pack with the size said, and SUBJECT is back to its first cut with its line;
//  (g) every control 44 pt, nothing sideways, BODY 21 clips nothing, at both widths.
// Needs the machine's software GL and runs the models in WebAssembly (slow when the machine is busy), so run WITHOUT NO_GL_SHOTS:
//   BASE=http://localhost:8836 node tests/photo2.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, openPanel } from './nav.mjs';
import { mkdirSync, readFileSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const SMALL = { width: 390, height: 844 };
const problems = [];
const notes = [];
const ok = (cond, why) => cond || problems.push(why);
const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ARGS });
const started = Date.now();
const T = {};
const lap = (name, t0) => (T[name] = Math.round(performance.now() - t0));

// ---- the pictures this spec draws and writes
/** A dark shape on a light ground (a mug seen from above, as a salient-object model sees it). */
async function shapePic(page) {
  const b64 = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 800;
    c.height = 600;
    const g = c.getContext('2d');
    g.fillStyle = 'rgb(232,229,218)';
    g.fillRect(0, 0, 800, 600);
    g.fillStyle = 'rgb(38,52,96)';
    g.beginPath();
    g.ellipse(400, 300, 150, 150, 0, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 36;
    g.strokeStyle = 'rgb(38,52,96)';
    g.beginPath();
    g.arc(570, 300, 62, -1.9, 1.9);
    g.stroke();
    g.fillStyle = 'rgb(86,104,160)';
    g.beginPath();
    g.ellipse(400, 300, 70, 70, 0, 0, Math.PI * 2);
    g.fill();
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.92));
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode(...buf.subarray(i, i + 8192));
    return btoa(s);
  });
  return Buffer.from(b64, 'base64');
}
/** A smooth light ground with a little noise and one dark blemish at (0.4, 0.45). */
async function blemishPic(page) {
  const b64 = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 800;
    c.height = 600;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 800, 600);
    grad.addColorStop(0, 'rgb(214,208,196)');
    grad.addColorStop(1, 'rgb(188,184,176)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 800, 600);
    const d = g.getImageData(0, 0, 800, 600);
    let s = 11;
    for (let i = 0; i < d.data.length; i += 4) {
      s = (s * 1664525 + 1013904223) >>> 0;
      const n = ((s >>> 24) / 255 - 0.5) * 6;
      d.data[i] += n;
      d.data[i + 1] += n;
      d.data[i + 2] += n;
    }
    g.putImageData(d, 0, 0);
    g.fillStyle = 'rgb(40,36,34)';
    g.beginPath();
    g.arc(320, 270, 14, 0, Math.PI * 2);
    g.fill();
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.95));
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s2 = '';
    for (let i = 0; i < buf.length; i += 8192) s2 += String.fromCharCode(...buf.subarray(i, i + 8192));
    return btoa(s2);
  });
  return Buffer.from(b64, 'base64');
}
/** A tiny linear DNG: 16 bits, three channels, little-endian TIFF with the DNG tags a reader needs. */
function tinyDng(W, H) {
  const pix = new Uint16Array(W * H * 3);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      pix[i] = 6000 + Math.round((x / W) * 30000);
      pix[i + 1] = 8000 + Math.round((y / H) * 24000);
      pix[i + 2] = 5000 + Math.round(((x + y) / (W + H)) * 20000);
    }
  const entries = [];
  const ascii = (s) => Buffer.from(`${s}\0`, 'latin1');
  const rat = (arr) => {
    const b = Buffer.alloc(arr.length * 8);
    arr.forEach(([n, d], i) => (b.writeInt32LE(n, i * 8), b.writeInt32LE(d, i * 8 + 4)));
    return b;
  };
  const u16 = (arr) => {
    const b = Buffer.alloc(arr.length * 2);
    arr.forEach((v, i) => b.writeUInt16LE(v, i * 2));
    return b;
  };
  const u32 = (arr) => {
    const b = Buffer.alloc(arr.length * 4);
    arr.forEach((v, i) => b.writeUInt32LE(v, i * 4));
    return b;
  };
  const add = (tag, type, count, buf) => entries.push({ tag, type, count, buf });
  const pixBuf = Buffer.from(pix.buffer, pix.byteOffset, pix.byteLength);
  add(254, 4, 1, u32([0]));
  add(256, 4, 1, u32([W]));
  add(257, 4, 1, u32([H]));
  add(258, 3, 3, u16([16, 16, 16]));
  add(259, 3, 1, u16([1]));
  add(262, 3, 1, u16([34892]));
  add(271, 2, 5, ascii('Test'));
  add(272, 2, 9, ascii('Tiny DNG'));
  add(273, 4, 1, u32([0]));
  add(277, 3, 1, u16([3]));
  add(278, 4, 1, u32([H]));
  add(279, 4, 1, u32([pixBuf.length]));
  add(284, 3, 1, u16([1]));
  add(50706, 1, 4, Buffer.from([1, 4, 0, 0]));
  add(50707, 1, 4, Buffer.from([1, 1, 0, 0]));
  add(50708, 2, 9, ascii('Tiny DNG'));
  add(50721, 10, 9, rat([[1000, 1000], [0, 1000], [0, 1000], [0, 1000], [1000, 1000], [0, 1000], [0, 1000], [0, 1000], [1000, 1000]]));
  add(50728, 5, 3, rat([[1000, 1000], [1000, 1000], [1000, 1000]]));
  add(50778, 3, 1, u16([21]));
  entries.sort((a, b) => a.tag - b.tag);
  const ifdSize = 2 + entries.length * 12 + 4;
  let off = 8 + ifdSize;
  const body = [];
  for (const e of entries) {
    if (e.buf.length <= 4) e.inline = Buffer.concat([e.buf, Buffer.alloc(4 - e.buf.length)]);
    else {
      if (off % 2) (body.push(Buffer.alloc(1)), off++);
      e.off = off;
      body.push(e.buf);
      off += e.buf.length;
    }
  }
  if (off % 2) (body.push(Buffer.alloc(1)), off++);
  const stripOff = off;
  const head = Buffer.alloc(8 + ifdSize);
  head.write('II', 0, 'latin1');
  head.writeUInt16LE(42, 2);
  head.writeUInt32LE(8, 4);
  head.writeUInt16LE(entries.length, 8);
  entries.forEach((e, i) => {
    const p = 10 + i * 12;
    head.writeUInt16LE(e.tag, p);
    head.writeUInt16LE(e.type, p + 2);
    head.writeUInt32LE(e.count, p + 4);
    if (e.tag === 273) head.writeUInt32LE(stripOff, p + 8);
    else if (e.inline) e.inline.copy(head, p + 8);
    else head.writeUInt32LE(e.off, p + 8);
  });
  head.writeUInt32LE(0, 10 + entries.length * 12);
  return Buffer.concat([head, ...body, pixBuf]);
}

// ---- the page, its state and the small helpers (the same ways photoedit.spec drives it)
const st = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__ghosty.photoedit, (k, v) => (typeof v === 'function' ? undefined : v))));
const recipe = (page) => page.evaluate(() => window.__ghosty.photoedit.recipe());
async function settle(page, ms = 160) {
  let last = -1;
  for (let i = 0; i < 160; i++) {
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
  await page.waitForTimeout(150);
};
const key = (page, re) => page.getByRole('button', { name: re }).first();
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const dist = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
const until = (page, fn, arg, ms, why) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => (problems.push(why), false));
const downloaded = async (page, click) => {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 180000 }), click()]);
  const bytes = readFileSync(await dl.path());
  await dl.delete().catch(() => undefined);
  return { name: dl.suggestedFilename(), bytes };
};
const closeSheet = (page) => page.evaluate(() => document.querySelector('.modal .mhead button')?.click());
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
  await until(page, () => window.__ghosty.photoedit.ready === true && window.__ghosty.photoedit.draws > 0, null, 120000, 'the photo was never ready');
  await settle(page);
};
const redAt = (page, [x, y]) =>
  page.evaluate(([x, y]) => {
    const c = document.querySelector('.pered');
    if (!c || c.hidden) return null;
    const r = c.getBoundingClientRect();
    return c.getContext('2d').getImageData(Math.min(c.width - 1, Math.max(0, Math.round(((x - r.left) / r.width) * c.width))), Math.min(c.height - 1, Math.max(0, Math.round(((y - r.top) / r.height) * c.height))), 1, 1).data[3];
  }, [x, y]);
const screenPt = (page, fx, fy) => page.evaluate(([x, y]) => window.__ghosty.photoedit.project(x, y), [fx, fy]);
const MB = /(\d+(?:\.\d+)?) MB/;

// the whole suite runs in one browser context (the packs stay kept from one width to the next), the viewport changed under it
const ctx = await browser.newContext({ viewport: PHONE, ...UK, deviceScaleFactor: 2, hasTouch: false, acceptDownloads: true });
const page = await ctx.newPage();
const asked = [];
ctx.on('request', (r) => asked.push(r.url()));
const askedFor = (dir) => asked.filter((u) => u.includes(`/vendor/${dir}/`));
page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' && !/favicon|net::ERR|404|403|401|Failed to load resource|^[WI]\d{4} |^INFO:|WebGL|GL Driver/.test(t)) problems.push(`console: ${t.slice(0, 200)}`);
});
await page.addInitScript(() => {
  window.__cspv = [];
  document.addEventListener('securitypolicyviolation', (e) => window.__cspv.push(`${e.violatedDirective} ${e.blockedURI}`));
});
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#pair input', { timeout: 20000 });
await page.fill('#pair input', KEY);
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
await page.evaluate(() => (location.hash = 'area-make'));
await page.waitForSelector('#pg-area-make .hubtile[data-id="editors"] .hubpill[data-editor="photo"]', { timeout: 15000 });
await page.click('#pg-area-make .hubtile[data-id="editors"] .hubpill[data-editor="photo"]');
await page.waitForFunction(() => document.body.dataset.tab === 'photo', null, { timeout: 15000 });
await page.waitForSelector('.peshelf:not([hidden])', { timeout: 10000 });

const shot = (name) => page.screenshot({ path: `${out}/photo2-${page.viewportSize().width}-${name}.png`, timeout: 90000 }).catch((e) => problems.push(`screenshot ${name}: ${e.message.split('\n')[0]}`));
const sizeOf = async (sel) => ((await page.locator(sel).first().textContent().catch(() => '')) ?? '').match(MB)?.[0] ?? '';

/** Everything that is 44 pt, inside the width and uncut, in each tool named, at the body size asked for. */
async function layout(W, tools, body) {
  const at = `[${W}${body ? ' BODY 21' : ''}]`;
  if (body) await page.evaluate((b) => (document.documentElement.dataset.body = b), body);
  for (const t of tools) {
    await tool(page, t);
    await page.waitForTimeout(350);
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
    ok(!m.small.length, `${at} [${t}] a control under 44 pt: ${m.small.join(' | ')}`);
    ok(!m.unnamed.length, `${at} [${t}] a control with no name: ${m.unnamed.join(' | ')}`);
    ok(!m.cut.length, `${at} [${t}] a key cuts its words: ${m.cut.join(' | ')}`);
    ok(!m.wide.length && m.scroll <= W, `${at} [${t}] sticks out sideways (${m.scroll}): ${m.wide.join(' | ')}`);
  }
  if (body) await page.evaluate(() => delete document.documentElement.dataset.body);
}

async function suite(viewport, first) {
  const W = viewport.width;
  const at = `[${W}]`;
  /** (g) every control 44 pt, nothing sideways, BODY 21 clipping nothing, in the tools named, as they stand now. */
  const both = async (tools) => {
    await layout(W, tools, null);
    await layout(W, tools, '21');
  };
  await page.setViewportSize(viewport);
  await page.waitForTimeout(400);
  const shape = await shapePic(page);

  // ---------------------------------------------------------------- (a) SUBJECT with no pack
  await openFiles(page, [{ name: `shape-${W}.jpg`, mimeType: 'image/jpeg', buffer: shape }]);
  await ready(page);
  await tool(page, 'masks');
  await key(page, /^subject$/i).click();
  await page.waitForSelector('.pesubjectbox', { timeout: 10000 });
  if (first) {
    await page.waitForSelector('.pecutoffer .pepack[data-pack="cutout"]', { timeout: 10000 }).catch(() => problems.push(`${at} (a) no GET line for the cut-out model`));
    const head = ((await page.locator('.pesubject').first().textContent()) ?? '').trim();
    ok(/first cut/i.test(head) && /paint to fix it/i.test(head), `${at} (a) SUBJECT says "${head}"`);
    const offer = ((await page.locator('.pepack[data-pack="cutout"] .pepackline').textContent().catch(() => '')) ?? '').trim();
    ok(/^A better cut-out needs the cut-out model \(\d+ MB\): GET$/.test(offer), `${at} (a) the GET line says "${offer}"`);
    const sz = Number((offer.match(/\((\d+) MB\)/) ?? [])[1]);
    ok(sz >= 18 && sz <= 20, `${at} (a) the cut-out model is said as ${sz} MB (about 19 expected)`);
    const getB = page.locator('.pepack[data-pack="cutout"] button[data-act="get"]');
    ok(/GET · (about )?\d+ MB/.test((await getB.textContent()) ?? '') && /on Wi-Fi/.test((await getB.getAttribute('aria-label')) ?? ''), `${at} (a) GET's label: ${await getB.getAttribute('aria-label')}`);
    ok(/Only on Wi-Fi, only when you tap/.test((await page.locator('.pepack[data-pack="cutout"]').textContent()) ?? ''), `${at} (a) the Wi-Fi words are not said`);
    // MAKE THE CUT with no pack and no first-cut packs: the first cut's words, and no fetch
    await key(page, /make the cut/i).click();
    await page.waitForTimeout(600);
    const line = (await page.locator('#pe-subject-line').textContent()) ?? '';
    ok(/To make the cut I need|on this phone/.test(line), `${at} (a) the first cut's pack line: "${line}"`);
    ok(askedFor('cutout').length === 0 && askedFor('erase').length === 0 && askedFor('raw').length === 0, `${at} (a) something was fetched before any tap: ${[...askedFor('cutout'), ...askedFor('erase'), ...askedFor('raw')].join(', ')}`);
    await shot('subject-offer');
    await both(['masks']);

    // ---------------------------------------------------------------- (f) offline: GET waits and says so
    await ctx.setOffline(true);
    await page.locator('.pepack[data-pack="cutout"] button[data-act="get"]').click();
    await until(page, () => /No signal right now/.test(document.querySelector('.pepack[data-pack="cutout"] .pepackline')?.textContent ?? ''), null, 8000, `${at} (f) offline, GET did not say it waits`);
    const wait = (await page.locator('.pepack[data-pack="cutout"] .pepackline').textContent()) ?? '';
    ok(/waits for Wi-Fi/.test(wait) && /\d+ MB/.test(wait) && /starts by itself/.test(wait), `${at} (f) the waiting words: "${wait}"`);
    await page.waitForTimeout(700);
    ok(askedFor('cutout').length === 0, `${at} (f) offline, GET fetched ${askedFor('cutout').join(', ')}`);
    ok((await page.locator('.pepack[data-pack="cutout"] button[data-act="stop"]').count()) === 1, `${at} (f) no STOP while it waits`);
    await ctx.setOffline(false);
    // (b) the signal back: it starts by itself and the pack is kept
    await until(page, () => !document.querySelector('.pecutoffer .pepack'), null, 180000, `${at} (b) the cut-out model never finished fetching after the signal came back`);
    const got = askedFor('cutout').map((u) => new URL(u).pathname);
    ok(got.includes('/vendor/cutout/cutout.v1.onnx') && got.includes('/vendor/cutout/worker.mjs'), `${at} (b) the cut-out pack's files: ${got.join(', ')}`);
  }

  // ---------------------------------------------------------------- (b) SUBJECT from the cut-out model
  const t0 = performance.now();
  // (with the pack kept, the SUBJECT key makes the cut by itself; the first time round it is MAKE THE CUT that does)
  if (first) await key(page, /make the cut/i).click();
  await until(page, () => window.__ghosty.photoedit.cutFrom === 'model', null, 240000, `${at} (b) the cut-out model made no cut (${'status'})`);
  lap(`cut-${W}`, t0);
  await settle(page);
  let s = await st(page);
  ok(s.cutMs > 100, `${at} (b) the cut's time was not recorded: ${s.cutMs}`);
  await page.waitForSelector('.pesubject[data-cut="model"]', { timeout: 10000 }).catch(() => problems.push(`${at} (b) the tray does not say which cut`));
  const said = ((await page.locator('.pesubject').first().textContent()) ?? '').trim();
  ok(/^From the cut-out model: paint to fix it\.$/i.test(said), `${at} (b) the tray says "${said}"`);
  ok((await recipe(page)).masks[0].cut === 'model', `${at} (b) the mask does not remember its cut`);
  await page.waitForTimeout(400);
  const inShape = await screenPt(page, 0.5, 0.5);
  const onGround = await screenPt(page, 0.06, 0.08);
  const aIn = await redAt(page, [inShape.x, inShape.y]);
  const aOut = await redAt(page, [onGround.x, onGround.y]);
  ok(aIn !== null && aIn > 100, `${at} (b) the cut does not cover the shape: red ${aIn} in the middle of it`);
  ok(aOut !== null && aOut < 25, `${at} (b) the cut covers the ground: red ${aOut} in the corner`);
  const ring = await screenPt(page, 0.5, 0.34);
  ok((await redAt(page, [ring.x, ring.y])) > 90, `${at} (b) the cut misses the top of the shape: ${await redAt(page, [ring.x, ring.y])}`);
  await shot('subject-model');
  await both(['masks']);
  // REFINE WITH DEPTH is still offered (and says what it needs when the distance model is not kept)
  const refine = key(page, /^refine with depth$/i);
  ok(await refine.isVisible(), `${at} (b) REFINE WITH DEPTH is not offered`);
  await refine.click();
  await page.waitForTimeout(500);
  const rl = (await page.locator('#pe-subject-line').textContent()) ?? '';
  ok(/MEASURE’S DISTANCE/.test(rl) && /\d+ MB/.test(rl), `${at} (b) REFINE WITH DEPTH says "${rl}"`);
  ok(await redAt(page, [inShape.x, inShape.y]) > 100, `${at} (b) REFINE WITH DEPTH changed the cut though it could not run`);
  // the brush fixes it: PAINT, a dab on the ground
  await key(page, /^paint$/i).click();
  // (the tray grows and the picture moves while it settles: the spot is read once it has)
  await page.waitForTimeout(900);
  await settle(page);
  const fix = await screenPt(page, 0.1, 0.12);
  await page.mouse.click(fix.x, fix.y);
  await page.waitForTimeout(900);
  await settle(page);
  const fix2 = await screenPt(page, 0.1, 0.12);
  ok((await redAt(page, [fix2.x, fix2.y])) > 90, `${at} (b) the brush did not fix the cut: red ${await redAt(page, [fix2.x, fix2.y])} where it painted`);
  // a tool that takes a mask takes it: the mask darkens the shape and not the ground
  const gBefore = await sample(page, 0.06, 0.4);
  const sBefore = await sample(page, 0.5, 0.5);
  await page.evaluate(() => {
    const i = document.querySelector('#pe-s-m-exposure');
    i.value = '-70';
    i.dispatchEvent(new Event('input', { bubbles: true }));
    i.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await settle(page);
  ok(lum(await sample(page, 0.5, 0.5)) < lum(sBefore) - 6, `${at} (b) a mask made by the model did not darken the shape: ${sBefore} → ${await sample(page, 0.5, 0.5)}`);
  ok(dist(await sample(page, 0.06, 0.4), gBefore) <= 3, `${at} (b) the mask changed the ground: ${gBefore} → ${await sample(page, 0.06, 0.4)}`);

  // ---------------------------------------------------------------- (c) ERASE
  const blem = await blemishPic(page);
  await openFiles(page, [{ name: `table-${W}.jpg`, mimeType: 'image/jpeg', buffer: blem }]);
  await ready(page);
  await tool(page, 'erase');
  await page.waitForSelector('.pepack[data-pack="erase"], [data-act="erase"]', { timeout: 10000 });
  if (first) {
    const offer = ((await page.locator('.pepack[data-pack="erase"] .pepackline').textContent().catch(() => '')) ?? '').trim();
    ok(/^Erase on this phone needs the erase model \(\d+ MB\): GET$/.test(offer), `${at} (c) the erase offer says "${offer}"`);
    const sz = Number((offer.match(/\((\d+) MB\)/) ?? [])[1]);
    ok(sz >= 69 && sz <= 71, `${at} (c) the erase model is said as ${sz} MB (about 70 expected)`);
    ok((await page.locator('button[data-act="brain-erase"]').count()) === 1 && /BRAIN ERASE/.test((await page.locator('button[data-act="brain-erase"]').textContent()) ?? ''), `${at} (c) BRAIN ERASE is not in the tray`);
    ok(askedFor('erase').length === 0, `${at} (c) the erase files were fetched before the tap`);
    await shot('erase-offer');
    await both(['erase']);
    await page.locator('.pepack[data-pack="erase"] button[data-act="get"]').click();
    await until(page, () => /piece \d+ of \d+/.test(document.querySelector('.pepack[data-pack="erase"] .pepackline')?.textContent ?? '') || !!document.querySelector('[data-act="erase"]'), null, 60000, `${at} (c) GET showed no progress`);
    await until(page, () => !!document.querySelector('[data-act="erase"]'), null, 300000, `${at} (c) the erase model never finished fetching`);
    const gotE = askedFor('erase').map((u) => new URL(u).pathname);
    ok(['worker.mjs', 'erase.v1.wq8.onnx.part1', 'erase.v1.wq8.onnx.part2', 'erase.v1.wq8.onnx.part3'].every((f) => gotE.includes(`/vendor/erase/${f}`)), `${at} (c) the erase pack's files: ${gotE.join(', ')}`);
  }
  await page.waitForSelector('[data-act="erase"]', { timeout: 30000 });
  // (the tray changes the picture's height while it settles: where the blemish is on the screen is read once it has)
  await page.waitForTimeout(1500);
  await settle(page);
  const bp = await screenPt(page, 0.4, 0.45);
  const nb = [await sample(page, 0.4 - 0.1, 0.45), await sample(page, 0.4 + 0.1, 0.45), await sample(page, 0.4, 0.45 - 0.12), await sample(page, 0.4, 0.45 + 0.12)];
  const near = nb[0].map((_, i) => nb.reduce((a, c) => a + c[i], 0) / 4);
  const dark = await sample(page, 0.4, 0.45);
  ok(lum(near) - lum(dark) > 80, `${at} (c) the drawn blemish is not dark: ${dark} against ${near}`);
  ok(await page.locator('[data-act="erase"]').isDisabled(), `${at} (c) ERASE is live with nothing painted`);
  await page.mouse.click(bp.x, bp.y);
  await page.waitForTimeout(300);
  await page.waitForFunction(() => !document.querySelector('[data-act="erase"]')?.disabled, null, { timeout: 8000 }).catch(() => problems.push(`${at} (c) painting over the blemish did not enable ERASE`));
  await settle(page);
  const bp2 = await screenPt(page, 0.4, 0.45);
  const redOnBlem = await redAt(page, [bp2.x, bp2.y]);
  ok(redOnBlem > 90, `${at} (c) the painted hole is not shown in red: ${redOnBlem}`);
  const e0 = performance.now();
  await page.locator('[data-act="erase"]').click();
  await until(page, () => /Erasing/.test(document.querySelector('.pebusy')?.textContent ?? '') && /about \d+ s/.test(document.querySelector('.pebusy')?.textContent ?? ''), null, 20000, `${at} (c) the wait did not say "Erasing… about N s"`);
  await until(page, () => window.__ghosty.photoedit.erasedBy === 'phone' && !window.__ghosty.photoedit.erasing, null, 420000, `${at} (c) the erase never finished (${'see the tray'})`);
  lap(`erase-${W}`, e0);
  await page.waitForTimeout(1500);
  await settle(page);
  s = await st(page);
  ok(!s.eraseFail, `${at} (c) the erase model failed: ${s.eraseFail}`);
  const after = await sample(page, 0.4, 0.45);
  ok(dist(after, near) <= 26 && lum(after) > lum(dark) + 70, `${at} (c) the blemish is not gone: ${dark} → ${after}, its neighbours are ${near}`);
  const r1 = await recipe(page);
  ok(Array.isArray(r1.patches) && r1.patches.length === 1, `${at} (c) the recipe holds ${JSON.stringify(r1.patches)} (one heal layer expected)`);
  ok(/Erased on this phone/i.test(((await page.locator('.peeraseline').textContent()) ?? '') + (await st(page)).status) || /ERASED ON THIS PHONE/.test(((await page.locator('.peeraseline').textContent()) ?? '')), `${at} (c) the tray does not say which erase ran: "${await page.locator('.peeraseline').textContent()}"`);
  await shot('erase-done');
  await both(['erase', 'brain']);
  await tool(page, 'erase');
  // UNDO brings it back, REDO takes it away again
  await page.getByRole('button', { name: /^undo$/i }).click();
  await settle(page);
  ok(lum(near) - lum(await sample(page, 0.4, 0.45)) > 70, `${at} (c) UNDO did not bring the blemish back: ${await sample(page, 0.4, 0.45)}`);
  await page.getByRole('button', { name: /^redo$/i }).click();
  await settle(page);
  ok(dist(await sample(page, 0.4, 0.45), near) <= 26, `${at} (c) REDO did not erase it again: ${await sample(page, 0.4, 0.45)}`);
  // the hold shows the original, with the blemish
  // the export at full size carries the erase
  await page.getByRole('button', { name: /^export$/i }).click();
  await page.waitForSelector('.peexport', { timeout: 10000 });
  await until(page, () => window.__ghosty.photoedit.export.phase === 'ready' && window.__ghosty.photoedit.export.bytes > 0, null, 240000, `${at} (c) the export never got ready`);
  const said2 = (await page.locator('.peexsize').textContent()) ?? '';
  ok(/^800 × 600 · 0\.5 megapixels/.test(said2), `${at} (c) the export says "${said2}"`);
  const ex = await downloaded(page, () => page.getByRole('button', { name: /^save$/i }).click());
  const px = await page.evaluate(async (b64) => {
    const bin = atob(b64);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const bmp = await createImageBitmap(new Blob([u], { type: 'image/jpeg' }));
    const c = document.createElement('canvas');
    c.width = bmp.width;
    c.height = bmp.height;
    const g = c.getContext('2d');
    g.drawImage(bmp, 0, 0);
    const at = (x, y) => [...g.getImageData(x, y, 1, 1).data.slice(0, 3)];
    return { w: bmp.width, h: bmp.height, hole: at(320, 270), a: at(220, 270), b: at(420, 270), c: at(320, 150), d: at(320, 390) };
  }, ex.bytes.toString('base64'));
  const around = [0, 1, 2].map((i) => (px.a[i] + px.b[i] + px.c[i] + px.d[i]) / 4);
  ok(px.w === 800 && px.h === 600, `${at} (c) the export is ${px.w} × ${px.h}`);
  ok(Math.max(...px.hole.map((v, i) => Math.abs(v - around[i]))) <= 22 && lum(px.hole) > 120, `${at} (c) the exported file does not carry the erase: ${px.hole} against ${around}`);
  await closeSheet(page);
  // BRAIN ERASE is still there with the pack kept
  ok((await page.locator('button[data-act="brain-erase"]').count()) === 1, `${at} (c) BRAIN ERASE went away when the pack was kept`);
  // the erase used SUBJECT's mask as the hole too: the button is there once a subject mask exists on this photo only
  ok(await page.locator('button[data-act="use-subject"]').isDisabled(), `${at} (c) USE THE SUBJECT MASK is live with no subject mask on this photo`);

  // ---------------------------------------------------------------- (d) RAW
  const dng = tinyDng(200, 150);
  await openFiles(page, [{ name: `holiday-${W}.dng`, mimeType: 'image/x-adobe-dng', buffer: dng }]);
  if (first) {
    await page.waitForSelector('.perawshelf .pepack[data-pack="raw"]', { timeout: 20000 }).catch(() => problems.push(`${at} (d) a RAW shared in with no reader did not offer it`));
    const offer = ((await page.locator('.perawshelf .pepackline').textContent().catch(() => '')) ?? '').trim();
    ok(/^This is a RAW\. To open it I need the RAW reader \(\d+ (KB|MB)\): GET$/.test(offer), `${at} (d) the RAW offer says "${offer}"`);
    ok(/\((9\d\d KB|1 MB)\)/.test(offer), `${at} (d) the reader is said as "${offer}" (about 0.9 MB expected)`);
    ok(/RAW reader/.test(((await page.locator('.peshelfmsg').textContent()) ?? '')), `${at} (d) the shelf's own line: "${await page.locator('.peshelfmsg').textContent()}"`);
    ok(askedFor('raw').length === 0, `${at} (d) the RAW reader was fetched before the tap: ${askedFor('raw').join(', ')}`);
    await shot('raw-offer');
    const r0 = performance.now();
    await page.locator('.perawshelf button[data-act="get"]').click();
    await ready(page);
    lap(`raw-${W}`, r0);
    const gotR = askedFor('raw').map((u) => new URL(u).pathname);
    ok(gotR.includes('/vendor/raw/libraw.wasm') && gotR.includes('/vendor/raw/libraw.mjs') && gotR.includes('/vendor/raw/worker.mjs'), `${at} (d) the reader's files: ${gotR.join(', ')}`);
  } else await ready(page);
  s = await st(page);
  ok(/^holiday-\d+\.dng$/.test(s.name) && s.size.w === 200 && s.size.h === 150, `${at} (d) the RAW opened as ${s.name} ${JSON.stringify(s.size)}`);
  ok(/Tiny DNG/.test(s.raw) && /0\.0 megapixels/.test(s.raw), `${at} (d) the RAW's line is "${s.raw}"`);
  await tool(page, 'light');
  const base1 = await sample(page, 0.5, 0.5);
  await page.evaluate(() => {
    const i = document.querySelector('#pe-s-exposure');
    i.value = '1';
    i.dispatchEvent(new Event('input', { bubbles: true }));
    i.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await settle(page);
  ok(lum(await sample(page, 0.5, 0.5)) > lum(base1) + 10, `${at} (d) the exposure slider did not move a RAW's pixel: ${base1} → ${await sample(page, 0.5, 0.5)}`);
  const hl = await sample(page, 0.95, 0.9);
  ok(hl.every((v) => v < 255) || lum(hl) < 255, `${at} (d) a bright part is already clipped in the working picture: ${hl}`);
  await page.getByRole('button', { name: /^export$/i }).click();
  await page.waitForSelector('.peexport', { timeout: 10000 });
  await until(page, () => window.__ghosty.photoedit.export.phase === 'ready', null, 120000, `${at} (d) the RAW's export never got ready`);
  await page.getByRole('button', { name: /^the original$/i }).click();
  await until(page, (n) => window.__ghosty.photoedit.export.format === 'original' && window.__ghosty.photoedit.export.bytes === n, dng.length, 10000, `${at} (d) THE ORIGINAL never took the file's own size`);
  const back = await downloaded(page, () => page.getByRole('button', { name: /^save$/i }).click());
  ok(back.bytes.equals(dng) && new RegExp(`^holiday-${W}\\.dng$`).test(back.name), `${at} (d) EXPORT ORIGINAL did not give the RAW back equal (${back.bytes.length} bytes against ${dng.length}, "${back.name}")`);
  await closeSheet(page);
  // a RAW that is not one: the reader's plain words (a shelf line, nothing kept)
  await openFiles(page, [{ name: `broken-${W}.nef`, mimeType: 'application/octet-stream', buffer: Buffer.from('this is words, not a camera file at all, and a bit longer than that') }]);
  await page.waitForFunction(() => /could not open|can’t read|not a RAW/.test(document.querySelector('.peshelfmsg')?.textContent ?? ''), null, { timeout: 30000 }).catch(() => problems.push(`${at} (d) an unreadable RAW did not say so: "${'—'}"`));
  const refusal = (await page.locator('.peshelfmsg').textContent().catch(() => '')) ?? '';
  ok(/broken-\d+\.nef/.test(refusal) && /JPEG or HEIC/.test(refusal) && !/LibRaw|wasm|exception/i.test(refusal), `${at} (d) the unreadable RAW's words: "${refusal}"`);

  // ---------------------------------------------------------------- (g) was checked in each tool as it stood: see `both`
  ok((await page.evaluate(() => window.__cspv ?? [])).length === 0, `${at} the security policy blocked: ${JSON.stringify(await page.evaluate(() => window.__cspv ?? []))}`);
}

await suite(PHONE, true);
await suite(SMALL, false);

// ---------------------------------------------------------------- (e) REMOVE frees the pack with the size said; SUBJECT falls back with its line
{
  await page.setViewportSize(PHONE);
  await page.evaluate(() => (location.hash = 'settings'));
  await page.waitForSelector('#pg-settings .scanset button.srow, #pg-settings.listmode .pn[data-row]', { timeout: 20000 });
  await openPanel(page, 'settings', 'OFFLINE EYES');
  await page.waitForSelector('#pg-settings .wikioffer[data-pack="photo-cutout"]', { timeout: 10000 });
  const row = page.locator('#pg-settings .wikioffer[data-pack="photo-cutout"]');
  const rows = await page.locator('#pg-settings .offeyes .wikioffer').count();
  ok(rows === 7, `(e) the offline packs screen lists ${rows} packs (seven expected with the three new ones)`);
  for (const id of ['photo-cutout', 'photo-erase', 'photo-raw']) ok((await page.locator(`#pg-settings .wikioffer[data-pack="${id}"]`).count()) === 1, `(e) ${id} is not in the offline packs screen`);
  await until(page, () => document.querySelector('.wikioffer[data-pack="photo-cutout"]')?.dataset.state === 'here', null, 5000, '(e) the kept cut-out model is not shown as on the phone');
  const keptLine = ((await row.textContent()) ?? '').replace(/\s+/g, ' ');
  ok(/The cut-out model, November 2026, \d+ MB on your phone/.test(keptLine), `(e) the kept row says "${keptLine.slice(0, 200)}"`);
  const freed = keptLine.match(/(\d+) MB on your phone/)?.[1];
  await row.locator('button[data-act="delete"]').click();
  await page.waitForSelector('.undo:not([hidden]), .rcundo:not([hidden])', { timeout: 5000 }).catch(() => problems.push('(e) no UNDO bar after REMOVE'));
  const body = (await page.textContent('body')) ?? '';
  ok(new RegExp(`The cut-out model \\(${freed} MB\\) deleted from this phone`).test(body), `(e) REMOVE does not say the size it frees (${freed} MB): ${body.match(/The cut-out model \([^)]*\) deleted[^.]*\./)?.[0]}`);
  await page.waitForFunction(async () => !(await (await caches.open('ghosty-eyes-v1')).match('/vendor/cutout/cutout.v1.onnx')), null, { timeout: 30000, polling: 500 }).catch(() => problems.push('(e) the cut-out model is still in the cache after REMOVE'));
  ok(await page.evaluate(async () => !!(await (await caches.open('ghosty-eyes-v1')).match('/vendor/erase/erase.v1.wq8.onnx.part1'))), '(e) REMOVE took the erase model with it');
  // back in PHOTO: SUBJECT is back to its first cut and says so, with the offer
  await page.evaluate(() => (location.hash = 'area-make'));
  await page.waitForSelector('#pg-area-make .hubtile[data-id="editors"] .hubpill[data-editor="photo"]', { timeout: 15000 });
  await page.click('#pg-area-make .hubtile[data-id="editors"] .hubpill[data-editor="photo"]');
  await page.waitForFunction(() => document.body.dataset.tab === 'photo', null, { timeout: 15000 });
  await page.waitForSelector('.pe:not([hidden]) .pestage, .peshelf:not([hidden])', { timeout: 20000 });
  await openFiles(page, [{ name: 'shape-after.jpg', mimeType: 'image/jpeg', buffer: await shapePic(page) }]);
  await ready(page);
  await tool(page, 'masks');
  const sub = page.getByRole('button', { name: /^subject$/i });
  if (await sub.count()) await sub.first().click().catch(() => undefined);
  await page.waitForSelector('.pesubjectbox', { timeout: 10000 }).catch(() => undefined);
  await page.waitForSelector('.pecutoffer .pepack[data-pack="cutout"]', { timeout: 10000 }).catch(() => problems.push('(e) after REMOVE, SUBJECT does not offer the cut-out model again'));
  const first2 = ((await page.locator('.pesubject').first().textContent().catch(() => '')) ?? '').trim();
  ok(/first cut|from the cut-out model/i.test(first2), `(e) SUBJECT after REMOVE says "${first2}"`);
  await key(page, /make the cut/i).click();
  await page.waitForTimeout(800);
  const s3 = await st(page);
  const line3 = ((await page.locator('#pe-subject-line').textContent().catch(() => '')) ?? '') + ' ' + s3.status;
  ok(/first cut|To make the cut I need|A better cut-out needs the cut-out model/i.test(line3 + ((await page.locator('.pepack[data-pack="cutout"] .pepackline').textContent().catch(() => '')) ?? '')), `(e) SUBJECT after REMOVE: "${line3}"`);
  const offer3 = ((await page.locator('.pepack[data-pack="cutout"] .pepackline').textContent().catch(() => '')) ?? '').trim();
  ok(/^A better cut-out needs the cut-out model \(\d+ MB\): GET$/.test(offer3), `(e) the offer after REMOVE says "${offer3}"`);
  ok(askedFor('cutout').filter((u) => u.endsWith('.onnx')).length === 1, `(e) the cut-out model was fetched ${askedFor('cutout').filter((u) => u.endsWith('.onnx')).length} times (once expected: REMOVE does not bring it back)`);
  await shot('after-remove');
}

await browser.close();
notes.push(`times (ms): ${Object.entries(T).map(([k, v]) => `${k} ${v}`).join(', ')}; the whole run took ${Math.round((Date.now() - started) / 1000)} s`);
for (const n of notes) console.log(n);
if (problems.length) {
  console.error(`FAIL photo2:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('ok: PHOTO 2 — the cut-out model, the erase model and the RAW reader each offered with their size and fetched only on a tap (waiting offline, said), SUBJECT from the cut-out model covering the shape and not the ground with REFINE WITH DEPTH and the brush, ERASE taking a blemish out with UNDO, REDO, the export at full size and BRAIN ERASE beside it, a DNG opened with EXPORT ORIGINAL giving its bytes back, REMOVE freeing the pack with the size said, 44 pt and BODY 21 at 440 and 390.');
