// THE 3-D ENGINE, FIRST WORKING SLICE (BRIEF-ENGINE-3D-1; OWNER-ISSUES 127, 164; AUDIT-8-NOV 16) on the owner's iPhone 18 Pro Max
// (440 × 956, en-GB, Europe/London), against the preview. WebGL screenshots hang in the sandbox, so the engine is checked through the
// page's own state (window.__ghosty.engine3d): counts, sizes, the saved scene, the file, never pixels.
//  1. THE PANE: opens from the 3D studio's bar; the estimate is on screen once; a ground, a camera, a drawn frame.
//  2. THE CAMERA BY TOUCH: one finger turns it, two fingers pinch it nearer and slide it.
//  3. PLACE, MOVE, TURN, SIZE: a library card arms it and a real touch on the ground puts a desk there (snapped to 5 cm, selected);
//     every primitive and every part places; sizes typed in cm are exact; a drag on the body, on the turn handle and on the three size
//     handles (found at the screen point the engine reports) gives the numbers the camera maths says.
//  4. MATERIALS AND UNDO: a swatch changes the material; UNDO and REDO walk back and forward.
//  5. FREE MODELS (every route stubbed, no real download): the shelf lists models with their size, licence and author and fetches
//     NOTHING; GET on mobile data fetches nothing and says it waits for Wi-Fi; GET on Wi-Fi fetches once, arms it, a tap places it at
//     its stated size with its credit; it is kept on the phone (a second GET fetches nothing).
//  6. SAVE AND REOPEN: SAVE names a scene; a reload brings the scene back; NEW then OPEN brings the saved one; DELETE removes it.
//  7. EXPORT: the downloaded .gltf has a node per object and the ground, accessor bounds that match the cm sizes, a material per palette
//     entry used, the credit and the estimate in its asset; the vendored loader reads it (as a .glb) and finds the same meshes.
//  8. SHOW ME: "show me a room 4 by 3 with a desk" puts the Stage up; OPEN opens the engine with a 400 × 300 ground, four walls and
//     the desk; "show me a desk 140 by 70" opens it with the part at that size.
//  9. THE THREE WORLDS: The Scan (and at 390 × 844), Glass and ONE INK: the pane is reachable, nothing sideways, every key 44 pt, no
//     security-policy refusal, no page error.
// 10. PHYSICS (BRIEF-KERNEL-2): off by default (the package is not fetched, a part dropped stays); PHYSICS: ON fetches the one vendored file
//     and says its true size once in the pane's line, nothing moves until DROP IT; a part dropped lands on the floor within 2 s, one dropped
//     onto another rests on it, one dropped over a wall stops on it; eight resting blocks draw under 16 ms a frame (a first estimate);
//     UNDO puts a drop back; OFF leaves everything where it is and a second ON fetches nothing.
//   BASE=http://localhost:8802 NO_GL_SHOTS=1 node tests/engine3d.spec.mjs [outDir]
import { mkdirSync, readFileSync } from 'node:fs';
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const problems = [];
const check = (ok, what) => void (ok || problems.push(what));
const SCAN = { ground: 'graphite', world: 'scan', night: 'graphite', switches: {} };
const GLASS = { ground: 'graphite', world: 'glass', night: 'graphite', switches: {} };
const INK = { ground: 'warm', world: 'ink', night: 'warm', switches: {} };
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const policy = [];
// ONLY=e|s|w|p runs just the editor, SHOW ME, the worlds or PHYSICS (for working on one part; CI runs all four)
const only = process.env.ONLY ?? 'eswp';

async function open({ look = SCAN, viewport = PHONE, show = false, fresh = true } = {}, ctxIn = null) {
  const ctx = ctxIn ?? (await browser.newContext({ viewport, ...UK, serviceWorkers: 'block', hasTouch: true, isMobile: true }));
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => webkitNoise(e) || (console.log('pageerror', e.message, (e.stack ?? '').split('\n').slice(0, 3).join(' | ')), problems.push(`pageerror: ${e.message}`)));
  page.on('console', (m) => /Refused to|Content Security Policy/.test(m.text()) && policy.push(m.text().slice(0, 200)));
  await page.addInitScript(({ key, look, show, fresh }) => {
    if (fresh && !sessionStorage.getItem('e3seeded')) {
      sessionStorage.setItem('e3seeded', '1');
      localStorage.setItem('ghosty.ownerKey', key);
      localStorage.setItem('ghosty.themes1', '1');
      localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Boss', speak: false, sounds: false, theme: 'reactor', look, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
    }
    if (show) window.__ghostyShow = true;
    window.__ghostyHero = true;
    window.__ghostyPlace = { none: true };
  }, { key: KEY, look, show, fresh });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 40000 }).catch(() => problems.push('the boot never ended'));
  return { ctx, page };
}
/** A key under the stage (the stage stays in view while the panel scrolls): brought into view clear of it, then a real tap. */
const press = async (page, sel) => {
  await page.locator(sel).first().evaluate((el) => el.scrollIntoView({ block: 'nearest' }));
  await page.click(sel);
};
const until = (page, fn, arg, ms, what) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => (problems.push(what), false));
const E = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__ghosty.engine3d.state(), (k, v) => (k === 'scene' ? undefined : v))));
const obj = async (page, id) => (await E(page)).objects.find((o) => o.id === id);

async function toEngine(page) {
  await page.evaluate(() => (location.hash = 'studio'));
  await page.waitForSelector('#pg-studio .studioseg button[data-pane="engine"]', { timeout: 20000 });
  await page.click('#pg-studio .studioseg button[data-pane="engine"]');
  await until(page, () => window.__ghosty?.engine3d?.state().ready === true && window.__ghosty.engine3d.state().size.h > 100, null, 25000, 'the engine never became ready');
  await page.waitForTimeout(300);
}

/** Pointer events straight onto the stage: [{ t: 'down'|'move'|'up', id, x, y }] in page pixels, one after another. */
async function touch(page, steps) {
  await page.evaluate((steps) => {
    const el = document.querySelector('.e3stage');
    for (const s of steps) {
      const ev = new PointerEvent(`pointer${s.t}`, { bubbles: true, cancelable: true, pointerId: s.id, pointerType: 'touch', isPrimary: s.id === 1, clientX: s.x, clientY: s.y, buttons: s.t === 'up' ? 0 : 1 });
      document.elementFromPoint(s.x, s.y)?.closest('.e3stage') ? el.dispatchEvent(ev) : el.dispatchEvent(ev);
    }
  }, steps);
}
const drag1 = (page, a, b, n = 6) => touch(page, [{ t: 'down', id: 1, x: a.x, y: a.y }, ...Array.from({ length: n }, (_, i) => ({ t: 'move', id: 1, x: a.x + ((b.x - a.x) * (i + 1)) / n, y: a.y + ((b.y - a.y) * (i + 1)) / n })), { t: 'up', id: 1, x: b.x, y: b.y }]);
const scr = (page, x, y, z) => page.evaluate(([x, y, z]) => window.__ghosty.engine3d.screenOf(x, y, z), [x, y, z]);

// ---- the stubbed free models: a fixture index, and a tiny model served as a .glb for any file asked of Hugging Face
const UID = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const UID2 = '0f9e8d7c6b5a49382716f5e4d3c2b1a0';
const INDEX = {
  v: 1, source: 'fixture', fields: ['uid', 'shard', 'name', 'cat', 'licence', 'author', 'kB', 'faces', 'thumb', 'tags'], cats: ['armchair', 'floor lamp'],
  items: [
    [UID, 3, 'Test armchair', 0, 0, 'Ada Maker', 48, 400, `${UID2}/t1.jpeg`, 'chair seat'],
    [UID2, 4, 'Test lamp', 1, 1, 'Bo Builder', 1450, 900, `${UID}/t2.jpeg`, 'lamp light'],
  ],
};
function glbOf(gltfText, dropGround = false) {
  const j = JSON.parse(gltfText);
  if (dropGround) j.scenes[0].nodes = j.scenes[0].nodes.filter((i) => j.nodes[i].name !== 'Ground');
  const bin = Buffer.from(j.buffers[0].uri.split(',')[1], 'base64');
  delete j.buffers[0].uri;
  j.buffers[0].byteLength = bin.length;
  let js = Buffer.from(JSON.stringify(j));
  js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const pad = Buffer.alloc((4 - (bin.length % 4)) % 4);
  const body = Buffer.concat([bin, pad]);
  const head = Buffer.alloc(12);
  head.write('glTF', 0);
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(12 + 8 + js.length + 8 + body.length, 8);
  const c1 = Buffer.alloc(8);
  c1.writeUInt32LE(js.length, 0);
  c1.write('JSON', 4);
  const c2 = Buffer.alloc(8);
  c2.writeUInt32LE(body.length, 0);
  c2.write('BIN\0', 4);
  return Buffer.concat([head, c1, js, c2, body]);
}

let exportedText = '';
let modelGlb = null;
let savedFileText = '';
const hf = { hits: 0 };

// ================================================================ 1 to 7: the editor, one phone
if (only.includes('e')) {
  const { ctx, page } = await open();
  await ctx.route('**/data/models3d.json', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(INDEX) }));
  await ctx.route('**/huggingface.co/**', (r) => {
    hf.hits++;
    return r.fulfill({ status: 200, contentType: 'application/octet-stream', headers: { 'content-length': String(modelGlb.length) }, body: modelGlb });
  });
  await toEngine(page);

  // ---- 1. the pane
  {
    const s = await E(page);
    check(s.ready && !s.error, `[1] the engine did not start: ${s.error}`);
    check(s.scene === undefined && s.objects.length === 0, '[1] a fresh scene is not empty');
    check(s.estimateLines === 1, `[1] the estimate line is on screen ${s.estimateLines} times, not once`);
    const said = await page.evaluate(() => document.querySelector('.e3est')?.textContent ?? '');
    check(/first estimate, never certified/i.test(said), `[1] the estimate line says: ${said}`);
    check((await page.evaluate(() => (document.body.innerText.match(/never certified/gi) ?? []).length)) === 1, '[1] "never certified" is on the screen more than once');
    const g = await page.evaluate(() => window.__ghosty.engine3d.ground());
    check(g.w > 0 && g.d > 0, '[1] no ground');
    check(s.cam.dist > 0 && s.frames >= 1, `[1] no camera or no frame drawn: ${JSON.stringify({ cam: s.cam, frames: s.frames })}`);
    check(await page.evaluate(() => !!document.querySelector('.e3canvas') && document.querySelector('.e3canvas').getAttribute('role') === 'img'), '[1] no named canvas');
  }

  // ---- 2. the camera by touch
  {
    const r = await page.evaluate(() => { const b = document.querySelector('.e3stage').getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
    const c0 = (await E(page)).cam;
    await drag1(page, { x: r.x + 60, y: r.y + r.h * 0.45 }, { x: r.x + 160, y: r.y + r.h * 0.45 + 40 });
    const c1 = (await E(page)).cam;
    check(Math.abs(c1.yaw - c0.yaw) > 0.3 && Math.abs(c1.pitch - c0.pitch) > 0.1, `[2] one finger did not turn the view: ${JSON.stringify([c0, c1])}`);
    const mid = { x: r.x + r.w / 2, y: r.y + r.h * 0.45 };
    // two fingers apart: nearer
    await touch(page, [{ t: 'down', id: 1, x: mid.x - 40, y: mid.y }, { t: 'down', id: 2, x: mid.x + 40, y: mid.y }, { t: 'move', id: 1, x: mid.x - 80, y: mid.y }, { t: 'move', id: 2, x: mid.x + 80, y: mid.y }, { t: 'up', id: 1, x: mid.x - 80, y: mid.y }, { t: 'up', id: 2, x: mid.x + 80, y: mid.y }]);
    const c2 = (await E(page)).cam;
    check(c2.dist < c1.dist * 0.7, `[2] a pinch out did not bring it nearer: ${c1.dist} → ${c2.dist}`);
    // two fingers slid together: panned
    await touch(page, [{ t: 'down', id: 1, x: mid.x - 40, y: mid.y }, { t: 'down', id: 2, x: mid.x + 40, y: mid.y }, { t: 'move', id: 1, x: mid.x - 10, y: mid.y + 50 }, { t: 'move', id: 2, x: mid.x + 70, y: mid.y + 50 }, { t: 'up', id: 1, x: mid.x - 10, y: mid.y + 50 }, { t: 'up', id: 2, x: mid.x + 70, y: mid.y + 50 }]);
    const c3 = (await E(page)).cam;
    check(Math.hypot(c3.tx - c2.tx, c3.tz - c2.tz) > 0.05 && Math.abs(c3.dist - c2.dist) < 0.05, `[2] two fingers did not slide the view: ${JSON.stringify([c2, c3])}`);
    // pitch and distance stay in range however far it is pushed
    await page.evaluate(() => { const e = window.__ghosty.engine3d.engine; for (let i = 0; i < 40; i++) { e.wheel(-400); } });
    check((await E(page)).cam.dist >= 0.5, '[2] the camera went inside its nearest distance');
    await page.evaluate(() => { const e = window.__ghosty.engine3d.engine; for (let i = 0; i < 80; i++) e.pointerMove(9, 0, 0); e.pointerDown(9, 10, 10); for (let i = 0; i < 40; i++) e.pointerMove(9, 10, 10 + i * 40); e.pointerUp(9, 10, 900); });
    const c4 = (await E(page)).cam;
    check(c4.pitch <= (86 * Math.PI) / 180 + 1e-6 && c4.pitch >= (6 * Math.PI) / 180 - 1e-6, `[2] pitch left its range: ${c4.pitch}`);
    await page.click('.e3chip:has-text("FRAME")');
    check(Math.abs((await E(page)).cam.tx) < 1e-6, '[2] FRAME did not frame');
  }

  // ---- 3. place, move, turn, size
  {
    await press(page, '.e3card[data-kind="desk"]');
    let s = await E(page);
    check(s.armed === 'Desk', `[3] a library tap did not arm the desk: "${s.armed}"`);
    check(await page.evaluate(() => !document.querySelector('.e3hint').hidden), '[3] no hint says to tap the ground');
    const p = await scr(page, 30, 0, 20);
    await page.touchscreen.tap(p.x, p.y);
    s = await E(page);
    check(s.objects.length === 1 && s.objects[0].kind === 'desk' && s.selected === s.objects[0].id, `[3] a touch on the ground did not place and select the desk: ${JSON.stringify(s.objects.map((o) => o.kind))}`);
    const d = s.objects[0];
    check(d.x % 5 === 0 && d.z % 5 === 0 && Math.abs(d.x - 30) <= 10 && Math.abs(d.z - 20) <= 10, `[3] the desk is not where the tap was, snapped to 5 cm: ${d.x}, ${d.z}`);
    check(d.w === 120 && d.d === 60 && d.h === 75, `[3] the desk is not at its stated size: ${d.w} × ${d.d} × ${d.h}`);
    check(s.armed === '', '[3] the desk is still armed after it was placed');
    // every primitive and every part places (by the API, one each), each at a stated size
    const kinds = ['box', 'cylinder', 'sphere', 'plane', 'table', 'shelf', 'bed', 'sofa', 'wardrobe', 'chair', 'stool', 'bench', 'cabinet'];
    for (const [i, k] of kinds.entries()) await page.evaluate(([k, i]) => window.__ghosty.engine3d.place(k, -300 + (i % 7) * 100, -200 + Math.floor(i / 7) * 120), [k, i]);
    s = await E(page);
    check(s.objects.length === 14 && kinds.every((k) => s.objects.some((o) => o.kind === k && o.w > 0 && o.d > 0 && o.h > 0)), `[3] not every kind placed: ${s.objects.map((o) => o.kind).join(',')}`);
    check(s.drawn === 14, `[3] ${s.drawn} things drawn for 14 placed`);
    // remove the 13 again so the desk is alone (undo the 13 placements)
    for (let i = 0; i < 13; i++) await page.evaluate(() => window.__ghosty.engine3d.undo());
    s = await E(page);
    check(s.objects.length === 1 && s.objects[0].kind === 'desk', `[3] undo did not take the 13 back: ${s.objects.length}`);
    // typed sizes in cm
    await page.evaluate((id) => window.__ghosty.engine3d.select(id), d.id);
    for (const [key, v] of [['w', 140], ['d', 70], ['h', 76], ['x', 0], ['z', 0], ['rot', 0]]) {
      await page.fill(`.e3num[data-key="${key}"]`, String(v));
      await page.press(`.e3num[data-key="${key}"]`, 'Tab');
    }
    let o = await obj(page, d.id);
    check(o.w === 140 && o.d === 70 && o.h === 76 && o.x === 0 && o.z === 0, `[3] typed sizes are not exact: ${o.w} × ${o.d} × ${o.h} at ${o.x}, ${o.z}`);
    // a clamp: nothing below 1 cm, nothing past 20 m
    await page.fill('.e3num[data-key="w"]', '99999');
    await page.press('.e3num[data-key="w"]', 'Tab');
    check((await obj(page, d.id)).w === 2000, '[3] a width of 99999 cm was not held to 20 m');
    await page.fill('.e3num[data-key="w"]', '140');
    await page.press('.e3num[data-key="w"]', 'Tab');
    // MOVE: from the desk's middle at half height to a point 100 cm across and 50 along
    await page.evaluate(() => window.__ghosty.engine3d.tool('move'));
    const from = await scr(page, 0, 38, 0);
    const to = await scr(page, 100, 38, 50);
    await drag1(page, from, to);
    o = await obj(page, d.id);
    check(o.x === 100 && o.z === 50, `[3] a MOVE drag gave ${o.x}, ${o.z}, not 100, 50`);
    // TURN: the ring's handle to the point 90° round
    await press(page, '.e3tool[data-tool="turn"]');
    let hd = await page.evaluate(() => window.__ghosty.engine3d.handleScreen('turn'));
    check(!!hd, '[3] the turn handle is not there');
    const ring = Math.max(140, 70) / 2 + 20;
    const turnTo = await scr(page, 100, 2, 50 + ring);
    await drag1(page, hd, turnTo);
    o = await obj(page, d.id);
    check(o.rot === 90, `[3] a TURN drag gave ${o.rot}°, not 90°`);
    await page.evaluate((id) => window.__ghosty.engine3d.set(id, { rot: 0, x: 0, z: 0 }), d.id);
    // SIZE: the width, depth and height handles
    await press(page, '.e3tool[data-tool="size"]');
    hd = await page.evaluate(() => window.__ghosty.engine3d.handleScreen('w'));
    await drag1(page, hd, await scr(page, 90, 38, 0));
    check((await obj(page, d.id)).w === 180, `[3] a SIZE drag on the width handle gave ${(await obj(page, d.id)).w}, not 180`);
    hd = await page.evaluate(() => window.__ghosty.engine3d.handleScreen('d'));
    await drag1(page, hd, await scr(page, 0, 38, 60));
    check((await obj(page, d.id)).d === 120, `[3] a SIZE drag on the depth handle gave ${(await obj(page, d.id)).d}, not 120`);
    hd = await page.evaluate(() => window.__ghosty.engine3d.handleScreen('h'));
    await drag1(page, hd, await scr(page, 0, 110, 0));
    o = await obj(page, d.id);
    check(o.h === 110 && o.w === 180 && o.d === 120, `[3] a SIZE drag on the height handle gave ${o.h}: ${JSON.stringify(o)}`);
    check((await E(page)).handles.length === 3 && (await page.$$eval('.e3tool', (b) => b.every((x) => x.getBoundingClientRect().height >= 43.5))), '[3] the handles or the tool keys are not there at 44 pt');
    // the same sizes in the inspector follow the drags
    check((await page.inputValue('.e3num[data-key="w"]')) === '180', '[3] the typed field does not follow a dragged handle');
    // a drag that begins on a handle is one undo step
    const u0 = (await E(page)).undo;
    hd = await page.evaluate(() => window.__ghosty.engine3d.handleScreen('w'));
    await drag1(page, hd, await scr(page, 100, 55, 0));
    const u1 = (await E(page)).undo;
    check(u1 === u0 + 1, `[3] one drag was ${u1 - u0} undo steps`);
    await page.evaluate(() => window.__ghosty.engine3d.undo());
    check((await obj(page, d.id)).w === 180, '[3] undo did not take the drag back');
    // the camera did not move while a handle was dragged
    // a tap on empty ground deselects
    await press(page, '.e3tool[data-tool="move"]');
    const empty = await scr(page, 400, 0, 300);
    if (empty) await page.touchscreen.tap(Math.min(empty.x, 420), Math.min(empty.y, 330));
  }

  // ---- 4. materials and undo
  {
    await page.evaluate(() => { const e = window.__ghosty.engine3d; e.select(e.state().objects[0].id); });
    const id = (await E(page)).objects[0].id;
    await press(page, '.e3swatch[data-mat="navy"]');
    check((await obj(page, id)).mat === 'navy', '[4] a swatch did not change the material');
    check((await page.$$('.e3swatch')).length === 9, '[4] the palette is not nine');
    await press(page, '.e3swatch[data-mat="walnut"]');
    check((await obj(page, id)).mat === 'walnut', '[4] a second swatch did not take');
    await page.click('.e3chip:has-text("UNDO")');
    check((await obj(page, id)).mat === 'navy', '[4] UNDO did not bring navy back');
    await page.click('.e3chip:has-text("REDO")');
    check((await obj(page, id)).mat === 'walnut', '[4] REDO did not bring walnut back');
    await press(page, '.e3act:has-text("DUPLICATE")');
    check((await E(page)).objects.length === 2, '[4] DUPLICATE did not copy');
    await press(page, '.e3act:has-text("DELETE")');
    check((await E(page)).objects.length === 1, '[4] DELETE did not remove');
    await page.evaluate(() => window.__ghosty.engine3d.undo());
    check((await E(page)).objects.length === 2, '[4] undo did not bring the deleted thing back');
    await page.evaluate(() => window.__ghosty.engine3d.undo());
  }

  // ---- 5. free models: stubbed, nothing real
  {
    // the model: a 40 × 30 × 80 cm thing, written by the engine itself, served as a .glb
    await page.evaluate(() => { const e = window.__ghosty.engine3d; e.load({ v: 1, name: 'Model maker', ground: { w: 300, d: 300 }, objects: [{ id: 'm1', kind: 'box', name: 'Block', x: 0, y: 0, z: 0, rot: 0, w: 40, d: 30, h: 80, mat: 'oak' }] }); });
    modelGlb = glbOf(await page.evaluate(() => window.__ghosty.engine3d.exportNow()), true);
    await page.evaluate(() => { const e = window.__ghosty.engine3d; e.load({ v: 1, name: 'Spec room', ground: { w: 400, d: 300 }, objects: [] }); e.free.reset(); });
    await page.evaluate(() => window.__ghosty.engine3d.place('desk', 0, 0));
    await press(page, '.e3pill[data-shelf="free"]');
    await until(page, () => window.__ghosty.engine3d.state().free.rows.length === 2, null, 10000, '[5] the shelf did not list the two stubbed models');
    let s = await E(page);
    await until(page, () => document.querySelectorAll('.e3free').length === 2, null, 8000, '[5] the rows are not on screen');
    const rows = s.free.rows;
    check(rows.some((r) => r.name === 'Test armchair' && r.kb === 48 && r.licence === 'CC0') && rows.some((r) => r.name === 'Test lamp' && r.kb === 1450 && r.licence === 'CC BY 4.0'), `[5] the shelf rows are wrong: ${JSON.stringify(rows)}`);
    const text = await page.evaluate(() => document.querySelector('.e3frees')?.textContent ?? '');
    check(/48 kB/.test(text) && /1\.5 MB|1\.4 MB/.test(text) && /CC0/.test(text) && /CC BY 4\.0/.test(text) && /Ada Maker/.test(text), `[5] a row does not say its size, licence and author: ${text}`);
    check(hf.hits === 0 && s.free.fetches === 0, `[5] listing the shelf fetched ${hf.hits} files`);
    // on mobile data: GET waits
    await page.evaluate(() => Object.defineProperty(navigator, 'connection', { value: { type: 'cellular', saveData: false }, configurable: true }));
    await press(page, `.e3get[data-id="ov:${UID}"]`);
    await page.waitForTimeout(300);
    s = await E(page);
    check(/waits for Wi-Fi/.test(s.free.note) && s.free.waited === 1 && hf.hits === 0 && s.free.fetches === 0, `[5] GET on mobile data did not wait: ${JSON.stringify([s.free.note, hf.hits])}`);
    // on Wi-Fi: one fetch
    await page.evaluate(() => Object.defineProperty(navigator, 'connection', { value: { type: 'wifi', saveData: false }, configurable: true }));
    await press(page, `.e3get[data-id="ov:${UID}"]`);
    await until(page, () => window.__ghosty.engine3d.state().armed === 'Test armchair', null, 15000, `[5] GET on Wi-Fi did not arm the model: ${JSON.stringify(await E(page).then((x) => x.free))}`);
    s = await E(page);
    check(hf.hits === 1 && s.free.fetches === 1 && s.free.kept.includes(`ov:${UID}`), `[5] GET on Wi-Fi was not one fetch kept on the phone: ${hf.hits}, ${JSON.stringify(s.free.kept)}`);
    const at = await scr(page, -100, 0, 60);
    await page.touchscreen.tap(at.x, at.y);
    s = await E(page);
    const m = s.objects.find((o) => o.kind === 'model');
    check(!!m && m.w === 40 && m.d === 30 && m.h === 80 && /Ada Maker/.test(m.model?.credit ?? '') && /CC0/.test(m.model?.credit ?? ''), `[5] the model is not placed at its stated size with its credit: ${JSON.stringify(m)}`);
    check(s.models.includes(`ov:${UID}`), '[5] the model is not loaded in the view');
    // a second GET fetches nothing: it is on the phone
    await press(page, `.e3get[data-id="ov:${UID}"]`);
    await page.waitForTimeout(600);
    check(hf.hits === 1, `[5] a model already on the phone was fetched again (${hf.hits})`);
    await page.evaluate(() => window.__ghosty.engine3d.arm(null));
    // the second model on Wi-Fi is a second fetch
    check((await E(page)).free.rows.length === 2, '[5] the rows went');
  }

  // ---- 7 (before the reload). export: the file
  {
    await page.evaluate(() => window.__ghosty.engine3d.load({ v: 1, name: 'Export room', ground: { w: 400, d: 300 }, objects: [] }));
    await page.evaluate(() => { const e = window.__ghosty.engine3d; e.place('desk', 0, -100, { w: 140, d: 70, h: 76 }); e.place('sofa', 50, 80); e.place('sphere', -120, 0, { mat: 'steel' }); e.place('box', 120, 90, { mat: 'glass', rot: 30 }); });
    // the model joins the scene so its credit goes in the file
    await page.evaluate((uid) => window.__ghosty.engine3d.place('model', -140, -80, { name: 'Test armchair', w: 40, d: 30, h: 80, model: { id: `ov:${uid}`, title: 'Test armchair', credit: '“Test armchair” by Ada Maker · CC0 (public domain) · Sketchfab, via Objaverse', licence: 'CC0', kb: 48 } }), UID);
    await page.waitForTimeout(500);
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }).catch(() => null), press(page, '.e3act:has-text("EXPORT")')]);
    check(!!dl && /\.gltf$/.test(dl.suggestedFilename()), `[7] EXPORT did not download a .gltf: ${dl?.suggestedFilename()}`);
    const path = dl ? await dl.path() : null;
    savedFileText = path ? readFileSync(path, 'utf8') : await page.evaluate(() => window.__ghosty.engine3d.exportText());
    exportedText = await page.evaluate(() => window.__ghosty.engine3d.exportText());
    check(savedFileText === exportedText, '[7] the downloaded file is not the exported text');
    const j = JSON.parse(savedFileText);
    const sc = await E(page);
    check(j.asset?.version === '2.0' && /first estimate, never certified/.test(j.asset.extras?.note ?? ''), '[7] the asset does not say it is a first estimate');
    check(j.asset.extras.credits.length === 1 && /Ada Maker/.test(j.asset.extras.credits[0]) && /Ada Maker/.test(j.asset.copyright), `[7] the credit is not in the file: ${JSON.stringify(j.asset.extras.credits)}`);
    const names = j.nodes.map((n) => n.name);
    check(names.includes('Ground') && sc.objects.every((o) => names.includes(o.name)) && j.nodes.length === sc.objects.length + 1, `[7] nodes ${names.join('|')} against ${sc.objects.length} objects`);
    const buf = Buffer.from(j.buffers[0].uri.split(',')[1], 'base64');
    check(buf.length === j.buffers[0].byteLength, '[7] the buffer length is wrong');
    // each node's mesh bounds against its object's cm size
    const bounds = (n) => { const a = j.accessors[j.meshes[n.mesh].primitives[0].attributes.POSITION]; return a.max.map((v, i) => v - a.min[i]); };
    const near = (a, b) => Math.abs(a - b) < 0.002;
    let ok = true;
    for (const o of sc.objects) {
      const n = j.nodes.find((x) => x.name === o.name) ?? j.nodes.find((x) => x.name.startsWith(o.name));
      if (!n) { ok = false; problems.push(`[7] no node named ${o.name} in ${names.join('|')}`); continue; }
      const [bx, by, bz] = bounds(n);
      const hit = o.kind === 'sphere' || o.kind === 'box' || o.kind === 'model' || o.kind === 'desk' || o.kind === 'sofa';
      if (hit && !(near(bx, o.w / 100) && near(by, o.h / 100) && near(bz, o.d / 100)) && o.kind !== 'sofa' && o.kind !== 'desk') ok = false;
      if (n.extras.cm.w !== o.w || n.extras.cm.d !== o.d || n.extras.cm.h !== o.h) ok = false;
      if (!near(n.translation[0], o.x / 100) || !near(n.translation[2], o.z / 100)) ok = false;
    }
    check(ok, '[7] a node\'s bounds, size or place do not match its object');
    const deskNode = j.nodes.find((x) => x.name === sc.objects[0].name) ?? j.nodes[1];
    const [dx, dy, dz] = bounds(deskNode);
    check(near(dx, 1.4) && near(dy, 0.76) && near(dz, 0.7), `[7] the desk is ${dx} × ${dy} × ${dz} m in the file, not 1.4 × 0.76 × 0.7`);
    const used = new Set(sc.objects.map((o) => o.mat));
    const matNames = j.materials.map((m) => m.name);
    check(matNames.length >= used.size && ['Oak', 'Steel', 'Glass'].every((n) => matNames.some((x) => x.startsWith(n))), `[7] materials: ${matNames.join(', ')}`);
    check(j.materials.find((m) => m.name === 'Glass')?.alphaMode === 'BLEND', '[7] glass is not blended');
    const ex = (await E(page)).exported;
    check(ex && ex.nodes === j.nodes.length && ex.unloaded === 0, `[7] the state of the export: ${JSON.stringify(ex)}`);
    // the vendored loader reads it, as a .glb
    const glb = glbOf(savedFileText);
    const meshes = await page.evaluate(async (b64) => {
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const three = await import('/vendor/three/three.module.min.js');
      const { GLTFLoader } = await import('/vendor/three/addons/loaders/GLTFLoader.js');
      const g = await new GLTFLoader().parseAsync(bin.buffer, '');
      let n = 0;
      let tris = 0;
      g.scene.traverse((o) => { if (o.isMesh) { n++; tris += (o.geometry.index?.count ?? 0) / 3; } });
      const box = new three.Box3().setFromObject(g.scene);
      return { n, tris, w: box.max.x - box.min.x };
    }, glb.toString('base64'));
    check(meshes.n === j.nodes.length && meshes.tris === ex.triangles, `[7] the loader found ${meshes.n} meshes and ${meshes.tris} triangles in a file of ${j.nodes.length} nodes and ${ex.triangles} triangles`);
  }

  // ---- 6. save and reopen
  {
    await page.evaluate(() => window.__ghosty.engine3d.load({ v: 1, name: 'Spec room', ground: { w: 500, d: 400 }, objects: [] }));
    await page.evaluate(() => { const e = window.__ghosty.engine3d; e.place('bed', 0, -100); e.place('wardrobe', 150, 100); e.place('chair', -100, 100); });
    await page.fill('.e3scene .e3name', 'Bedroom plan');
    await page.press('.e3scene .e3name', 'Tab');
    await press(page, '.e3act:has-text("SAVE")');
    await until(page, () => window.__ghosty.engine3d.state().saved.some((x) => x.name === 'Bedroom plan' && x.things === 3), null, 5000, '[6] SAVE did not keep the scene');
    check(await page.evaluate(() => !!document.querySelector('.e3open[aria-label="Open Bedroom plan"]')), '[6] the saved scene is not in the list');
    await page.waitForTimeout(500);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#boot', { state: 'detached', timeout: 40000 }).catch(() => undefined);
    await toEngine(page);
    let s = await E(page);
    check(s.name === 'Bedroom plan' && s.objects.length === 3 && s.objects.map((o) => o.kind).join() === 'bed,wardrobe,chair', `[6] the scene did not come back after a reload: ${s.name}, ${s.objects.map((o) => o.kind)}`);
    check(s.saved.some((x) => x.name === 'Bedroom plan'), '[6] the saved list did not come back');
    await press(page, '.e3act:has-text("NEW")');
    check((await E(page)).objects.length === 0, '[6] NEW did not clear');
    await press(page, '.e3open[aria-label="Open Bedroom plan"]');
    s = await E(page);
    check(s.objects.length === 3 && s.name === 'Bedroom plan', `[6] OPEN did not bring the saved scene back: ${s.objects.length}`);
    check((await page.evaluate(() => window.__ghosty.engine3d.ground())).w === 500, '[6] the ground did not come back at 500');
    await press(page, '.e3saved .e3act[aria-label="Delete the saved scene Bedroom plan"]');
    check(!(await E(page)).saved.some((x) => x.name === 'Bedroom plan'), '[6] DELETE did not remove the saved scene');
    // a damaged entry is dropped, never drawn
    await page.evaluate(() => { const k = JSON.parse(localStorage.getItem('ghosty.engine3d')); k.saved = [{ id: 'bad', name: 'x', at: 1, scene: { v: 2 } }]; localStorage.setItem('ghosty.engine3d', JSON.stringify(k)); });
    check(await page.evaluate(() => !window.__ghosty.engine3d.load({ v: 2, objects: [] }) && !window.__ghosty.engine3d.load('{nope') && window.__ghosty.engine3d.load({ v: 1, name: 'x', ground: { w: 1, d: 1 }, objects: [{ kind: 'dragon' }, { kind: 'box', w: -5, d: 1e9, h: 10 }] })), '[6] a bad scene was not refused');
    const t = await E(page);
    check(t.objects.length === 1 && t.objects[0].w === 1 && t.objects[0].d === 2000, `[6] a read scene was not put in range: ${JSON.stringify(t.objects)}`);
  }
  await ctx.close();
}

// ================================================================ 8. SHOW ME opens the engine
if (only.includes('s')) {
  const { ctx, page } = await open({ show: true });
  const ndjson = (events) => events.map((e) => JSON.stringify(e)).join('\n') + '\n';
  const chatOpen = async () => {
    const isOpen = () => page.evaluate(() => !!document.querySelector('#pg-core .hud.core.logopen'));
    for (let i = 0; i < 8 && !(await isOpen()); i++) {
      if (i === 0) await page.evaluate(() => (location.hash = 'core'));
      await page.waitForTimeout(i ? 600 : 300);
      await page.locator('.logbtn:visible').first().click({ timeout: 3000 }).catch(() => undefined);
      if (!(await isOpen())) await page.evaluate(() => document.querySelector('.logbtn')?.click());
      await page.waitForTimeout(400);
    }
  };
  const say = async (ask, reply) => {
    const body = ndjson([{ t: 'status', text: 'thinking…' }, { t: 'text', text: reply }, { t: 'done', model: 'Mock · scripted' }]);
    await page.route('**/api/chat', (r) => r.continue({ url: `${base}/__test/stream?lines=${encodeURIComponent(Buffer.from(body).toString('base64'))}` }));
    await chatOpen();
    await page.fill('#cin', ask);
    await page.keyboard.press('Enter');
  };
  await page.waitForFunction(() => !!window.__ghosty?.show, null, { timeout: 15000 }).catch(() => problems.push('[8] window.__ghosty.show never appeared'));
  await say('show me a room 4 by 3 with a desk', 'A room of 4 by 3 metres with a desk.');
  if (await until(page, () => document.querySelector('#thestage')?.dataset.kind === 'room', null, 20000, '[8] the room did not reach the Stage')) {
    await page.locator('#thestage button[aria-label^="Open"]').dispatchEvent('click');
    await until(page, () => window.__ghosty?.engine3d?.state().on === true && window.__ghosty.engine3d.state().objects.some((o) => o.kind === 'desk'), null, 25000, '[8] OPEN did not open the engine with the desk');
    const s = await E(page);
    const g = await page.evaluate(() => window.__ghosty.engine3d.ground());
    check(g.w === 400 && g.d === 300, `[8] the ground is ${g.w} × ${g.d}, not 400 × 300`);
    check(s.objects.filter((o) => /^Wall/.test(o.name)).length === 4 && s.objects.filter((o) => o.kind === 'desk').length === 1, `[8] the room is not four walls and a desk: ${s.objects.map((o) => o.name)}`);
    const desk = s.objects.find((o) => o.kind === 'desk');
    check(desk.w === 120 && desk.d === 60 && Math.abs(desk.x) <= 200 && Math.abs(desk.z) <= 150, `[8] the desk is not in the room: ${JSON.stringify(desk)}`);
    check(await page.evaluate(() => document.querySelector('#pg-studio .studioseg button.on')?.dataset.pane === 'engine'), '[8] the studio is not on its engine pane');
    check(/room/i.test(s.name), `[8] the scene's name is "${s.name}"`);
  }
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(900);
  await say('show me a desk 140 by 70', 'Here is a desk, 140 by 70.');
  if (await until(page, () => document.querySelector('#thestage')?.dataset.kind === 'part', null, 20000, '[8] the part did not reach the Stage')) {
    await page.locator('#thestage button[aria-label^="Open"]').dispatchEvent('click');
    await until(page, () => window.__ghosty?.engine3d?.state().on === true && window.__ghosty.engine3d.state().objects.length === 1, null, 25000, '[8] OPEN on the part did not open the engine with one thing');
    const s = await E(page);
    const o = s.objects[0];
    check(o?.kind === 'desk' && o.w === 140 && o.d === 70 && o.h === 75 && o.x === 0 && o.z === 0, `[8] the part is not the desk at 140 × 70: ${JSON.stringify(o)}`);
  }
  await ctx.close();
}

// ================================================================ 9. the three worlds, and the phone at 390
const worlds = [['scan', SCAN, PHONE], ['glass', GLASS, PHONE], ['ink', INK, PHONE], ['scan390', SCAN, { width: 390, height: 844 }]];
for (const [name, look, viewport] of only.includes('w') ? worlds : []) {
  const { ctx, page } = await open({ look, viewport });
  await toEngine(page);
  await page.evaluate(() => { const e = window.__ghosty.engine3d; e.place('sofa', 0, 0); e.place('box', 120, 80); });
  await press(page, '.e3pill[data-shelf="free"]').catch(() => undefined);
  await page.waitForTimeout(500);
  await press(page, '.e3pill[data-shelf="param"]').catch(() => undefined);
  const sideways = await page.$$eval('#pg-studio :is(.e3stage, .e3pane) :is(div, button, input, label, p, h3, small, span, b)', (els) => els.filter((e) => {
    if (!e.getClientRects().length || getComputedStyle(e).visibility === 'hidden') return false;
    const r = e.getBoundingClientRect();
    if (!r.width || r.bottom < 0) return false;
    for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) { const pr = p.getBoundingClientRect(); if (pr.left >= -1 && pr.right <= innerWidth + 1) return false; }
    return r.left < -1 || r.right > innerWidth + 1;
  }).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]}`));
  check(sideways.length === 0, `[9 ${name}] sideways: ${sideways.slice(0, 5)}`);
  const small = await page.$$eval('#pg-studio :is(.e3stage, .e3pane) :is(button, input[type="number"], input[type="text"], input[type="search"])', (els) => els.filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').filter((e) => { const r = e.getBoundingClientRect(); return r.height < 43.5 || r.width < 43.5; }).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} ${Math.round(e.getBoundingClientRect().width)}×${Math.round(e.getBoundingClientRect().height)}`));
  check(small.length === 0, `[9 ${name}] under 44 pt: ${small.slice(0, 5)}`);
  const s = await E(page);
  check(s.ready && s.objects.length === 2 && s.frames >= 1, `[9 ${name}] the engine is not running: ${JSON.stringify({ ready: s.ready, error: s.error })}`);
  const named = await page.$$eval('#pg-studio :is(.e3stage, .e3pane) :is(button, input, canvas)', (els) => els.filter((e) => e.getClientRects().length && !((e.getAttribute('aria-label') || e.getAttribute('title') || (e.tagName === 'CANVAS' ? '' : e.textContent) || '').trim() || e.closest('label'))).map((e) => e.outerHTML.slice(0, 60)));
  check(named.length === 0, `[9 ${name}] unnamed controls: ${named.slice(0, 3)}`);
  if (name === 'scan') {
    // the Scan's own house along the bottom, and the pane's key on the studio's bar
    check(await page.evaluate(() => document.body.classList.contains('housed') || !!document.querySelector('#dock')), '[9 scan] The Scan\'s house is not along the bottom');
  }
  if (name === 'ink') check(await page.evaluate(() => document.documentElement.dataset.world === 'ink'), '[9 ink] the world is not ONE INK');
  if (name === 'glass') check(await page.evaluate(() => document.documentElement.dataset.world === 'glass'), '[9 glass] the world is not Glass');
  await page.screenshot({ path: `${out}/engine3d-${name}.png`, timeout: 15000 }).catch(() => undefined);
  await ctx.close();
}
// ================================================================ 10. PHYSICS (BRIEF-KERNEL-2 item 3)
let physicsLine = '';
if (only.includes('p')) {
  const { ctx, page } = await open();
  const hits = [];
  page.on('request', (r) => /\/vendor\/rapier\//.test(r.url()) && hits.push(r.url()));
  await toEngine(page);
  const P = (pg) => pg.evaluate(() => window.__ghosty.engine3d.state().physics);
  const room = { v: 1, name: 'Physics room', ground: { w: 400, d: 300 }, objects: [
    { id: 'o1', kind: 'box', name: 'Wall back', x: 0, z: -155, y: 0, rot: 0, w: 420, d: 10, h: 240, mat: 'white' },
    { id: 'o2', kind: 'box', name: 'Wall right', x: 205, z: 0, y: 0, rot: 0, w: 10, d: 300, h: 240, mat: 'white' },
    { id: 'o3', kind: 'table', name: 'Table', x: 0, z: 0, y: 0, rot: 0, w: 120, d: 80, h: 75, mat: 'oak' },
  ] };
  check(await page.evaluate((r) => window.__ghosty.engine3d.load(r), room), '[10] the room scene did not load');
  await page.waitForTimeout(400);
  // ---- off by default: the package is not fetched, nothing moves, DROP IT is not there
  {
    const cup = await page.evaluate(() => window.__ghosty.engine3d.place('cylinder', 150, 100, { name: 'Cup', w: 8, d: 8, h: 10, y: 200 }));
    await page.waitForTimeout(900);
    const st = await E(page);
    check(st.physics.on === false && st.physics.fetched === 0 && !st.physics.loaded, `[10] physics is not off by default: ${JSON.stringify(st.physics)}`);
    check(hits.length === 0, `[10] the physics package was asked for before PHYSICS was turned on: ${hits.join()}`);
    check((await obj(page, cup)).y === 200, '[10] physics off: a part dropped (placed high) moved');
    check(await page.evaluate(() => document.querySelector('.e3pane .e3phys button')?.textContent === 'PHYSICS: OFF'), '[10] the key does not say PHYSICS: OFF');
    check(await page.evaluate(() => ![...document.querySelectorAll('.e3tools button')].some((b) => /DROP IT/.test(b.textContent) && b.getClientRects().length)), '[10] DROP IT shows with physics off');
    check((await page.evaluate((id) => window.__ghosty.engine3d.physics.drop(id), cup)) === false, '[10] a drop worked with physics off');
    await page.waitForTimeout(500);
    check((await obj(page, cup)).y === 200, '[10] physics off: the part dropped did not stay');
    // ---- ON: the one file asked for, its true size said once in the pane's line, nothing moves
    // ---- on mobile data: PHYSICS: ON fetches nothing, says it waits for Wi-Fi with the size, and stays off; on Wi-Fi it goes ahead
    await page.evaluate(() => Object.defineProperty(navigator, 'connection', { value: { type: 'cellular', saveData: false }, configurable: true }));
    await press(page, '.e3phys button');
    await page.waitForTimeout(500);
    const waitedLine = await page.evaluate(() => document.querySelector('.e3say')?.textContent ?? '');
    check(waitedLine === 'You’re on mobile data, so I’ll wait for Wi-Fi, then fetch 4.3 MB.' && hits.length === 0 && (await P(page)).on === false && (await P(page)).waited === 1, `[10] ON on mobile data did not wait: ${waitedLine} ${hits.length}`);
    check(await page.evaluate(() => document.querySelector('.e3phys button')?.textContent === 'PHYSICS: OFF'), '[10] the key left OFF on mobile data');
    await page.evaluate(() => Object.defineProperty(navigator, 'connection', { value: { type: 'cellular', saveData: false }, configurable: true }));
    await page.evaluate(() => Object.defineProperty(navigator, 'connection', { value: { type: 'wifi', saveData: false }, configurable: true }));
    await page.evaluate(() => {
      window.__says = [];
      new MutationObserver(() => window.__says.push(document.querySelector('.e3say')?.textContent ?? '')).observe(document.querySelector('.e3say'), { childList: true, characterData: true, subtree: true });
    });
    await press(page, '.e3phys button');
    check(await until(page, () => window.__ghosty.engine3d.state().physics.on === true, null, 30000, '[10] PHYSICS: ON never came'), '');
    const size = (await (await fetch(`${base}/vendor/rapier/rapier.mjs`)).arrayBuffer()).byteLength; // (read here, not by the page: the page's own requests are what is counted)
    const said = await page.evaluate(() => window.__ghosty.engine3d.state().last);
    const line = await page.evaluate(() => document.querySelector('.e3say')?.textContent ?? '');
    const asked = hits.filter((u) => /rapier\.mjs/.test(u)).length;
    check(asked >= 1, `[10] the package was not fetched on PHYSICS: ON (${hits.join()})`);
    check(size > 4_000_000 && Math.abs(size - 4_340_292) < 1, `[10] the vendored file is ${size} bytes, not the stated 4,340,292`);
    check(/^Physics is on\./.test(line) || /Loading physics/.test(line), `[10] the pane's line: ${line}`);
    check(await page.evaluate((n) => window.__ghosty.engine3d.state().physics.fetched === 1 && n > 0, size), '[10] the package was fetched more than once');
    const says = await page.evaluate(() => window.__says);
    const loading = says.filter((t) => /^Loading physics, /.test(t));
    check(loading.length >= 1 && loading.every((t) => t === `Loading physics, ${(size / 1_000_000).toFixed(1)} MB…`), `[10] the size said in the pane's line is not the file's (${size} bytes): ${JSON.stringify(says)}`);
    void said;
    await page.waitForTimeout(700);
    check((await obj(page, cup)).y === 200, '[10] turning physics on moved a part: nothing may move until DROP IT');
    check(await page.evaluate(() => document.querySelector('.e3phys button')?.textContent === 'PHYSICS: ON'), '[10] the key does not say PHYSICS: ON');
    // ---- DROP IT on a part (a real tap on the key): it lands on the floor within 2 s
    await page.evaluate((id) => window.__ghosty.engine3d.select(id), cup);
    await page.waitForTimeout(150);
    check(await page.evaluate(() => { const b = [...document.querySelectorAll('.e3tools button')].find((x) => /DROP IT/.test(x.textContent)); return !!b && b.getClientRects().length > 0 && b.getBoundingClientRect().height >= 43.5; }), '[10] DROP IT is not there at 44 pt with a thing selected');
    const t0 = Date.now();
    await press(page, '.e3tools button[aria-label^="Drop it"]');
    const landed = await until(page, () => (window.__ghosty.engine3d.state().objects.find((o) => o.name === 'Cup')?.y ?? 99) <= 1.5, null, 2000, '[10] the cup did not land within 2 s');
    const took = Date.now() - t0;
    await until(page, () => window.__ghosty.engine3d.state().physics.landed >= 1, null, 3000, '[10] the cup never came to rest');
    const c = await obj(page, cup);
    check(landed && took <= 2000, `[10] the cup took ${took} ms to land`);
    check(c.y >= 0 && c.y <= 1.5 && Math.abs(c.x - 150) < 1 && Math.abs(c.z - 100) < 1, `[10] the cup is at ${JSON.stringify({ x: c.x, y: c.y, z: c.z })}, not on the floor where it fell`);
    // one undo step puts it back where it was
    check((await page.evaluate(() => window.__ghosty.engine3d.undo())) && (await obj(page, cup)).y === 200, '[10] UNDO did not put the dropped cup back');
    // ---- a part dropped onto another rests on it (the table's top is 75 cm)
    const mug = await page.evaluate(() => window.__ghosty.engine3d.place('cylinder', 20, 10, { name: 'Mug', w: 8, d: 8, h: 10 }));
    await page.evaluate((id) => window.__ghosty.engine3d.select(id), mug);
    await page.evaluate((id) => window.__ghosty.engine3d.physics.drop(id), mug);
    check(await until(page, () => window.__ghosty.engine3d.state().physics.landed >= 2 && window.__ghosty.engine3d.state().physics.moving === 0, null, 3000, '[10] the mug did not land'), '');
    const m = await obj(page, mug);
    check(Math.abs(m.y - 75) <= 2 && Math.abs(m.x - 20) < 1.5 && Math.abs(m.z - 10) < 1.5, `[10] the mug did not rest on the table: ${JSON.stringify({ x: m.x, y: m.y, z: m.z })}`);
    // ---- a part dropped over a wall does not pass through it: it lands on top of it
    const box = await page.evaluate(() => window.__ghosty.engine3d.place('box', 190, -60, { name: 'Crate', w: 40, d: 40, h: 40, y: 400 }));
    await page.evaluate((id) => window.__ghosty.engine3d.physics.drop(id), box);
    check(await until(page, () => window.__ghosty.engine3d.state().physics.moving === 0 && window.__ghosty.engine3d.state().physics.landed >= 3, null, 4000, '[10] the crate did not land'), '');
    const b = await obj(page, box);
    check(b.y >= 238 && b.y <= 242, `[10] the crate dropped over the right wall is at y ${b.y}, not on top of it (240)`);
    // ---- eight things resting: the frame time (a first estimate; the world stepped in every frame, rerun alone before red)
    const eight = [];
    for (let i = 0; i < 8; i++) eight.push(await page.evaluate(([i]) => window.__ghosty.engine3d.place('box', -150 + (i % 4) * 70, 60 + Math.floor(i / 4) * 70, { name: `Block ${i + 1}`, w: 30, d: 30, h: 30, y: 60 }), [i]));
    for (const id of eight) await page.evaluate((id) => window.__ghosty.engine3d.physics.drop(id), id);
    check(await until(page, () => window.__ghosty.engine3d.state().physics.moving === 0 && window.__ghosty.engine3d.state().physics.landed >= 4, null, 6000, '[10] eight blocks did not all land'), '');
    const rest = await Promise.all(eight.map((id) => obj(page, id)));
    check(rest.every((o) => o.y >= 0 && o.y <= 1.5), `[10] a block is not on the floor: ${rest.map((o) => o.y)}`);
    let bench = await page.evaluate(() => window.__ghosty.engine3d.physics.bench(60));
    if (bench.median >= 16) bench = await page.evaluate(() => window.__ghosty.engine3d.physics.bench(60));
    physicsLine = `physics: the package ${size} bytes fetched once on PHYSICS: ON; the cup landed in ${took} ms; frame time with eight blocks resting and the world stepped in every frame: median ${bench.median} ms, mean ${bench.mean} ms, max ${bench.max} ms over ${bench.n} frames (first estimate)`;
    check(bench.median < 16, `[10] the frame time with eight blocks resting is ${bench.median} ms median (max ${bench.max}), not under 16`);
    // ---- OFF: it stays where it is, DROP IT goes, a second ON does not fetch again
    const before = await obj(page, eight[0]);
    await press(page, '.e3phys button');
    check(await until(page, () => window.__ghosty.engine3d.state().physics.on === false, null, 3000, '[10] PHYSICS: OFF never came'), '');
    check(JSON.stringify(await obj(page, eight[0])) === JSON.stringify(before), '[10] turning physics off moved a part');
    check((await page.evaluate((id) => window.__ghosty.engine3d.physics.drop(id), eight[0])) === false, '[10] a drop worked after physics was turned off');
    const hitsBefore = hits.length;
    await press(page, '.e3phys button');
    check(await until(page, () => window.__ghosty.engine3d.state().physics.on === true, null, 8000, '[10] PHYSICS: ON (again) never came'), '');
    check(hits.length === hitsBefore && (await P(page)).fetched === 1, '[10] turning physics on a second time fetched the package again');
    check((await page.evaluate(() => window.__says)).filter((t) => /^Loading physics, /.test(t)).length === loading.length, '[10] the size was said again on the second ON');
  }
  await ctx.close();
}

check(policy.length === 0, `a security-policy refusal: ${policy[0]}`);

await browser.close();
if (problems.length) {
  console.log(`PROBLEMS:\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(physicsLine);
console.log('3-D engine run clean: a ground and a camera turned, pinched and slid by touch; a desk placed by a real tap and moved, turned and sized by its handles to the numbers the camera maths gives; every primitive and part placed, sizes typed in cm exact and clamped; materials, undo and redo; the free models shelf listing size, licence and author and fetching nothing until GET on Wi-Fi (once, kept, credited); save, reload, open and delete; a glTF file read back with the right bounds, materials, credit and estimate and loaded by the vendored loader; SHOW ME opening a 4 by 3 room and a 140 by 70 desk in the engine; the three worlds and 390 clean; PHYSICS off by default and fetching nothing, ON fetching the one file (its true size said once), a dropped part landing on the floor within 2 s, resting on the table, stopped by the wall, eight resting blocks under 16 ms a frame, OFF leaving everything where it is.');
