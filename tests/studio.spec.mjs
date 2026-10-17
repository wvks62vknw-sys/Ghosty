// 3D STUDIO on an iPhone 13 (WebGL through SwiftShader). The tab opens on the built-in arc reactor
// (three.js loads only now, from /vendor/three); TAKE APART moves every part away from the centre
// and REASSEMBLE puts each back exactly; the slider sets any point between; a part can be selected,
// isolated and hidden; SECTION cuts along an axis; MEASURE gives a distance between two taps; a
// Khronos sample (the toy car) loads and is split into parts; a model "made from a photo" comes back
// from the brain (stubbed /api/m3d, with a real GLB) and opens, and a quota refusal is shown in
// words; ROOM builds a room from typed sizes and from the planner's JSON (an item that sticks out
// is named); SPLINE refuses anything but a my.spline.design public link and frames a good one with
// "Powered by Spline"; SHOT gives a PNG; asking Ghosty "open the studio with the chair" opens it on
// the chair. The security policy blocks nothing and nothing sticks out sideways.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const truck = readFileSync(new URL('../apps/web/public/models/CesiumMilkTruck.glb', import.meta.url));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const problems = [];
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  acceptDownloads: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
const page = await ctx.newPage();
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' && !/favicon|net::ERR|404|Failed to load resource|^[WI]\d{4} |^INFO:|GPU stall|WebGL/.test(t)) problems.push(`console: ${t.slice(0, 200)}`);
});
await page.addInitScript(() => {
  window.__csp = [];
  document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
});

// The brain's 3-D maker, stubbed: the first photo is "made" (a real GLB comes back), the second hits the quota.
let makes = 0;
const sentPhotos = [];
await page.route('**/api/m3d', async (route) => {
  const req = route.request();
  if (req.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ models: makes ? [{ id: 'AAAAAAAAAAAAAAAA', title: 'From a photo', at: Date.now(), bytes: truck.length }] : [] }) });
  sentPhotos.push({ type: req.headers()['content-type'], bytes: (req.postDataBuffer() ?? Buffer.alloc(0)).length, title: req.headers()['x-title'] });
  makes++;
  if (makes === 1) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ model: { id: 'AAAAAAAAAAAAAAAA', title: 'From a photo', at: Date.now(), bytes: truck.length } }) });
  return route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: "the free 3-D model maker (Hugging Face ZeroGPU) has used up today's GPU allowance — try again in about 13 h 46 min." }) });
});
await page.route('**/api/m3d/AAAAAAAAAAAAAAAA', (route) => route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: truck }));
// A Spline scene, stubbed so the test needs no network: only the frame's address matters here.
const framed = [];
await page.route('https://my.spline.design/**', (route) => {
  framed.push(route.request().url());
  return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Spline</title><body style="background:#123">scene</body>' });
});

await page.goto(base);
await page.fill('#pair input', 'preview-owner-key-0123456789');
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });

const S = () => page.evaluate(() => window.__ghosty?.studio?.state() ?? null);
const until = (fn, ms, what, arg = null) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => { problems.push(what); return false; });
const pane = (label) => page.locator('#pg-studio .studioseg button', { hasText: label }).click();
const btn = (label) => page.locator('#pg-studio .studiobar button, #pg-studio .studiopanel button', { hasText: label }).first();
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const spread = (st) => {
  const ps = st.parts;
  const c = [0, 1, 2].map((k) => ps.reduce((s, p) => s + p.home[k], 0) / ps.length);
  return ps.reduce((s, p) => s + dist(p.pos, c), 0) / ps.length;
};

// ---- the tab opens on the arc reactor, three.js loaded from this site ----
const scripts = [];
page.on('request', (r) => r.url().includes('/vendor/three/') && scripts.push(new URL(r.url()).pathname));
await page.evaluate(() => window.__ghosty.run('open_studio', {}));
await until(() => (window.__ghosty?.studio?.state().parts.length ?? 0) >= 16, 30000, `the arc reactor did not load: ${JSON.stringify(await S())}`);
if (!scripts.includes('/vendor/three/three.module.min.js') || !scripts.some((s) => s.endsWith('GLTFLoader.js'))) problems.push(`three.js was not loaded from /vendor/three: ${JSON.stringify(scripts)}`);
const canvasOk = await page.evaluate(() => {
  const c = document.querySelector('#pg-studio canvas.studiocanvas');
  return !!c && c.width > 100 && c.height > 100;
});
if (!canvasOk) problems.push('no 3-D canvas in the studio');
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/studio-reactor.png` });

// ---- TAKE APART: every part moves away from the centre; REASSEMBLE puts each back ----
const before = await S();
await btn('TAKE APART').click();
await until(() => window.__ghosty.studio.state().explode === 1, 8000, 'TAKE APART did not reach 100 %');
const apart = await S();
const moved = apart.parts.filter((p) => dist(p.pos, p.home) > 1e-4).length;
if (moved < apart.parts.length - 1) problems.push(`only ${moved} of ${apart.parts.length} parts moved apart`);
if (!(spread(apart) > spread(before) * 1.5)) problems.push(`the parts did not spread out (${spread(before).toFixed(4)} → ${spread(apart).toFixed(4)})`);
if ((await page.locator('#pg-studio .studiopct').textContent()) !== '100%') problems.push('the slider does not read 100% after TAKE APART');
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/studio-apart.png` });
await btn('REASSEMBLE').click();
await until(() => window.__ghosty.studio.state().explode === 0, 8000, 'REASSEMBLE did not return to 0 %');
const back = await S();
const off = back.parts.filter((p) => dist(p.pos, p.home) > 1e-6);
if (off.length) problems.push(`${off.length} parts did not go back home after REASSEMBLE`);
// the slider: halfway
await page.locator('#pg-studio input.studioslider').first().fill('50');
await until(() => Math.abs(window.__ghosty.studio.state().explode - 0.5) < 0.01, 3000, 'the slider did not set 50 %');

// ---- PARTS: select, isolate, hide, show all ----
await pane('PARTS');
const rows = page.locator('#pg-studio .studiolist .rw');
if ((await rows.count()) !== apart.parts.length) problems.push(`the part list shows ${await rows.count()} parts, not ${apart.parts.length}`);
await rows.filter({ hasText: 'Core' }).first().click();
await until(() => { const s = window.__ghosty.studio.state(); return s.selected !== null && s.parts[s.selected].name === 'Core'; }, 3000, 'tapping "Core" in the part list did not select it');
await btn('ISOLATE').click();
const iso = await S();
if (iso.parts.filter((p) => p.visible).length !== 1) problems.push(`ISOLATE left ${iso.parts.filter((p) => p.visible).length} parts showing`);
await btn('SHOW ALL').click();
await page.locator('#pg-studio .studiolist .rw', { hasText: 'Casing' }).locator('.eye').click();
const hid = await S();
if (hid.parts.find((p) => p.name === 'Casing')?.visible !== false) problems.push('the eye did not hide the casing');
await btn('SHOW ALL').click();
if ((await S()).parts.some((p) => !p.visible)) problems.push('SHOW ALL did not bring every part back');

// ---- CUT · MEASURE ----
await page.locator('#pg-studio input.studioslider').first().fill('0');
await pane('CUT');
await page.locator('#pg-studio .studioaxes button', { hasText: 'X' }).click();
const cut = await S();
if (cut.section?.axis !== 'x') problems.push(`SECTION X did not cut: ${JSON.stringify(cut.section)}`);
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/studio-section.png` });
await page.locator('#pg-studio .studioaxes button', { hasText: 'OFF' }).click();
await btn('MEASURE').click();
const box = await page.locator('#pg-studio canvas.studiocanvas').boundingBox();
// two taps on the reactor's face: its centre and a little to the side
await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.52);
await page.waitForTimeout(150);
await page.mouse.click(box.x + box.width * 0.58, box.y + box.height * 0.5);
await until(() => /\d/.test(window.__ghosty.studio.state().measure), 4000, `MEASURE gave no distance after two taps: ${JSON.stringify((await S())?.measure)}`);
const measured = (await S()).measure;
if (!/(cm|m)$/.test(measured)) problems.push(`the measurement is not in real units: "${measured}"`);
if (!(await page.locator('#pg-studio .studiomeasure', { hasText: measured }).isVisible())) problems.push('the distance is not shown over the scene');
await page.screenshot({ path: `${out}/studio-measure.png` });
await btn('MEASURING').click();

// ---- a Khronos sample: the toy car, split into parts, credited ----
await pane('MODELS');
await page.locator('#pg-studio .studiopane .rw', { hasText: 'Toy car' }).click();
await until(() => window.__ghosty.studio.state().title === 'Toy car' && window.__ghosty.studio.state().parts.length >= 4, 60000, `the toy car did not load in parts: ${JSON.stringify((await S())?.parts.map((p) => p.name))}`);
if (!(await page.locator('#pg-studio .studiocredit', { hasText: 'CC0' }).count())) problems.push('the toy car is not credited');
await btn('TAKE APART').click();
await until(() => window.__ghosty.studio.state().explode === 1, 8000, 'the toy car did not come apart');
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/studio-toycar.png` });

// ---- PHOTO → 3D: a photo goes to the brain, the model comes back and opens; then a quota refusal in words ----
await pane('PHOTO');
const photo = await page.evaluate(async () => {
  const c = document.createElement('canvas');
  c.width = 1600;
  c.height = 1200;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#c33';
  g.fillRect(500, 300, 600, 600);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s);
});
await page.locator('#pg-studio input[type=file][accept="image/*"]').setInputFiles({ name: 'mug.png', mimeType: 'image/png', buffer: Buffer.from(photo, 'base64') });
await until(() => !document.querySelector('#pg-studio .studiothumb')?.hidden, 20000, 'the chosen photo is not shown');
await btn('MAKE 3-D').click();
await until(() => window.__ghosty.studio.state().title === 'From a photo' && window.__ghosty.studio.state().parts.length > 0, 30000, `the made model did not open: ${JSON.stringify(await S())}`);
const sent = sentPhotos[0];
if (!sent || sent.type !== 'image/jpeg' || !(sent.bytes > 1000)) problems.push(`the photo was not sent as a JPEG: ${JSON.stringify(sent)}`);
const dims = await page.evaluate(() => new Promise((res) => { const i = new Image(); i.onload = () => res([i.naturalWidth, i.naturalHeight]); i.src = document.querySelector('#pg-studio .studiothumb').src; }));
if (Math.max(...dims) > 1024) problems.push(`the photo was not shrunk before sending (${dims})`);
await btn('MAKE 3-D').click();
await until(() => /GPU allowance/.test(document.querySelector('#pg-studio .studiopane .studioreadout')?.textContent ?? ''), 10000, 'a quota refusal was not shown in words');
await pane('MODELS');
await until(() => [...document.querySelectorAll('#pg-studio .studiolist .rw')].some((r) => /From a photo/.test(r.textContent)), 5000, 'the made model is not listed under MADE FROM PICTURES');

// ---- ROOM: typed sizes, then the planner's JSON with an item that sticks out ----
await pane('ROOM');
await page.fill('#pg-studio input[aria-label="Width (cm)"]', '420');
await page.fill('#pg-studio input[aria-label="Depth (cm)"]', '310');
await page.fill('#pg-studio input[aria-label="Height (cm)"]', '250');
await btn('BUILD ROOM').click();
await until(() => { const s = window.__ghosty.studio.state(); return s.room && s.parts.length === 5; }, 8000, `the typed room was not built: ${JSON.stringify((await S())?.parts.map((p) => p.name))}`);
await page.fill('#pg-studio textarea[aria-label="Room JSON"]', JSON.stringify({ room: { w: 400, d: 300, h: 240 }, items: [{ name: 'Sofa', w: 200, d: 90, h: 85, x: 20, y: 200, rot: 0 }, { name: 'Wardrobe', w: 100, d: 60, h: 200, x: 350, y: 0, rot: 0 }] }));
await btn('BUILD ROOM').click();
await until(() => { const s = window.__ghosty.studio.state(); return s.room && s.parts.some((p) => p.name === 'Sofa') && s.parts.length === 7; }, 8000, `the planner's room was not built: ${JSON.stringify((await S())?.parts.map((p) => p.name))}`);
const room = await S();
if (!room.warnings.some((w) => /Wardrobe sticks out/.test(w))) problems.push(`the wardrobe that sticks out was not named: ${JSON.stringify(room.warnings)}`);
if (room.warnings.some((w) => /Sofa/.test(w))) problems.push('the sofa that fits was flagged');
await btn('INSIDE VIEW').click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/studio-room.png` });

// ---- ARCHITECTURE: an L-shaped room with a door and a window — walls cut round them; CEILING; WALK and AERIAL ----
const lroom = { v: 2, room: { w: 500, d: 400, h: 240 }, wall: 10, rooms: [{ id: 'r1', name: 'Lounge', poly: [[0, 0], [300, 0], [300, 150], [500, 150], [500, 400], [0, 400]] }], openings: [{ id: 'd1', type: 'door', room: 'r1', wall: 4, at: 300, w: 80, hinge: 'start', swing: 'in' }, { id: 'w1', type: 'window', room: 'r1', wall: 0, at: 100, w: 120, h: 120, sill: 90 }], items: [{ name: 'Sofa', w: 200, d: 90, h: 85, x: 20, y: 280, rot: 0 }] };
await page.fill('#pg-studio textarea[aria-label="Room JSON"]', JSON.stringify(lroom));
await btn('BUILD ROOM').click();
await until(() => { const s = window.__ghosty.studio.state(); return s.room && s.openings === 2 && s.parts.some((p) => /over the door/.test(p.name)); }, 8000, `the L-shaped room with a door and a window was not built: ${JSON.stringify((await S())?.parts.map((p) => p.name))}`);
let arch = await S();
const names = arch.parts.map((p) => p.name);
// six walls; the top one cut round the window (2 solid + over + under + glass), the bottom round the door (2 solid + over), a door leaf, a floor, the sofa
const want = { wall: 4 + (2 + 2) + (2 + 1), glass: 1, door: 1 };
const n = (re) => names.filter((x) => re.test(x)).length;
if (n(/, window$/) !== want.glass || n(/^Door d1$/) !== want.door || n(/^Lounge, wall \d(?!.*, window$)/) !== want.wall || n(/floor$/) !== 1) problems.push(`the L's pieces: ${JSON.stringify(names)}`);
if (arch.warnings.length) problems.push(`the L warned: ${arch.warnings}`);
if (!/WALK stands you in it/.test(await page.locator('#pg-studio .studiopane .studioreadout').textContent())) problems.push('the room pane does not say what WALK does');
await btn('CEILING: OFF').click();
await until(() => window.__ghosty.studio.state().ceiling && window.__ghosty.studio.state().parts.some((p) => /ceiling$/.test(p.name)), 8000, 'CEILING did not add a ceiling');
// WALK: eye height, the joystick walks, a drag on the scene looks about
const modes = page.locator('#pg-studio .studiomodes');
if (!(await modes.isVisible())) problems.push('no ORBIT / WALK / AERIAL on the scene for a room');
await modes.locator('button', { hasText: 'WALK' }).click();
arch = await S();
if (arch.mode !== 'walk' || !arch.walk || Math.abs(arch.camera[1] - 1.6) > 0.1) problems.push(`WALK: ${JSON.stringify({ mode: arch.mode, walk: arch.walk, camera: arch.camera })}`);
const stick = page.locator('#pg-studio .studiostick');
if (!(await stick.isVisible())) problems.push('no joystick in WALK');
else {
  const sb = await stick.boundingBox();
  const start = arch.walk;
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await page.mouse.down();
  await page.mouse.move(sb.x + sb.width / 2, sb.y + 4, { steps: 4 });
  await page.waitForTimeout(900);
  await page.mouse.up();
  const walked = (await S()).walk;
  const d = Math.hypot(walked.x - start.x, walked.z - start.z);
  if (!(d > 0.3)) problems.push(`the joystick did not walk: moved ${d.toFixed(2)} m (${JSON.stringify(start)} → ${JSON.stringify(walked)})`);
  const view = await page.locator('#pg-studio .studioview').boundingBox();
  await page.mouse.move(view.x + view.width * 0.7, view.y + view.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(view.x + view.width * 0.3, view.y + view.height * 0.4, { steps: 5 });
  await page.mouse.up();
  const looked = (await S()).walk;
  if (!(looked.yaw > walked.yaw + 0.3)) problems.push(`dragging the scene did not turn the head: yaw ${walked.yaw} → ${looked.yaw}`);
}
await page.screenshot({ path: `${out}/studio-walk.png` });
await modes.locator('button', { hasText: 'AERIAL' }).click();
arch = await S();
if (arch.mode !== 'aerial' || !(arch.camera[1] > 4)) problems.push(`AERIAL: ${JSON.stringify({ mode: arch.mode, camera: arch.camera })}`);
if (await stick.isVisible()) problems.push('the joystick stays in AERIAL');
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/studio-aerial.png` });
await modes.locator('button', { hasText: 'ORBIT' }).click();
if ((await S()).mode !== 'orbit') problems.push('ORBIT did not come back');

// ---- SPLINE: strict links only; a good one is framed with "Powered by Spline" ----
await pane('SPLINE');
const spline = page.locator('#pg-studio input[aria-label="Spline public URL"]');
for (const [bad, why] of [['https://evil.example/scene/', /only Spline public scenes/], ['https://my.spline.design.evil.example/x/', /only Spline public scenes/], ['https://app.spline.design/file/1234', /editor/], ['http://my.spline.design/abc/', /https/], ['https://my.spline.design/a/b/c', /not a Spline scene address/]]) {
  await spline.fill(bad);
  await btn('SHOW').click();
  const note = (await page.locator('#pg-studio .studioreadout').textContent()) ?? '';
  if (!why.test(note)) problems.push(`"${bad}" was answered "${note}"`);
  if (await page.locator('#pg-studio .studiospline iframe').count()) problems.push(`"${bad}" was framed`);
}
await spline.fill('https://my.spline.design/ghostyreactor-0a1b2c3d4e5f/');
await btn('SHOW').click();
await until(() => document.querySelector('#pg-studio .studiospline iframe')?.src === 'https://my.spline.design/ghostyreactor-0a1b2c3d4e5f/', 4000, 'a good Spline link was not framed');
if (!(await page.locator('#pg-studio .studiopowered', { hasText: 'Powered by Spline' }).isVisible())) problems.push('no "Powered by Spline" under the Spline scene');
await page.waitForTimeout(800);
if (!framed.length) problems.push('the Spline frame never loaded (blocked?)');
await page.screenshot({ path: `${out}/studio-spline.png` });

// ---- SHOT: a PNG of the view ----
const dl = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
await btn('SHOT').click();
const file = await dl;
const shot = await page.evaluate(() => window.__ghosty.studio.lastShot);
if (!shot || shot.type !== 'image/png' || !(shot.bytes > 2000)) problems.push(`SHOT gave no picture: ${JSON.stringify(shot)}`);
if (!file || !/\.png$/.test(file.suggestedFilename())) problems.push('SHOT did not hand over a .png');

// ---- asking Ghosty: "open the studio with the chair" ----
await page.evaluate(() => (location.hash = 'core'));
await page.waitForTimeout(600);
if (await page.locator('.logbtn').isVisible()) await page.click('.logbtn');
await page.fill('#cin', 'open the studio with the chair');
await page.keyboard.press('Enter');
await until(() => window.__ghosty.studio.state().title === 'Sheen chair', 60000, `"open the studio with the chair" did not open the chair: ${JSON.stringify((await S())?.title)} — ${(await page.evaluate(() => document.querySelector('.convo, .log')?.innerText ?? document.body.innerText)).slice(-600)}`);

// ---- a model that arrives after the owner has left the studio does not start drawing behind another tab ----
await page.evaluate(() => (location.hash = 'core'));
await until(() => window.__ghosty?.ui?.get?.().tab === 'core', 5000, 'the chat tab did not open');
if (await page.evaluate(() => window.__ghosty.studio.viewer.running)) problems.push('the studio still draws after leaving it');
await page.evaluate(() => void window.__ghosty.studio.loadSample('toycar'));
await until(() => window.__ghosty.studio.state().title === 'Toy car', 30000, 'the toy car did not load while away');
await page.waitForTimeout(300);
if (await page.evaluate(() => window.__ghosty.studio.viewer.running)) problems.push('a model that arrived while away restarted the studio\'s drawing behind the chat');

// ---- the security policy and the phone layout ----
await page.evaluate(() => window.__ghosty.run('open_studio', { sample: 'reactor' }));
await page.waitForTimeout(500);
const csp = await page.evaluate(() => window.__csp);
if (csp.length) problems.push(`security policy blocked: ${csp.join(' | ')}`);
for (const p of ['MODELS', 'PARTS', 'CUT', 'PHOTO', 'ROOM', 'SPLINE']) {
  await pane(p);
  const wide = await page.evaluate(() => {
    const out = [];
    if (document.documentElement.scrollWidth > innerWidth + 1) out.push('page');
    for (const el of document.querySelectorAll('#pg-studio button, #pg-studio input, #pg-studio textarea, #pg-studio iframe')) {
      const r = el.getBoundingClientRect();
      if (r.width && (r.right > innerWidth + 2 || r.left < -2)) out.push(`${el.tagName} ${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 20)}`);
    }
    return out;
  });
  if (wide.length) problems.push(`${p}: sticks out sideways: ${wide.join(', ')}`);
}
const st = await S();
if (st?.error) problems.push(`studio error: ${st.error}`);

// ---- a first visit straight into a room (open_studio {room} before the studio was ever shown):
// one drawing surface, and the room stays (the default reactor must not replace it) ----
const fresh = await ctx.newPage();
fresh.on('pageerror', (e) => problems.push(`fresh pageerror: ${e.message}`));
await fresh.goto(base);
if (await fresh.locator('#pair input').isVisible().catch(() => false)) {
  await fresh.fill('#pair input', 'preview-owner-key-0123456789');
  await fresh.click('#pair button.on');
}
await fresh.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
await fresh.waitForFunction(() => typeof window.__ghosty?.run === 'function', null, { timeout: 10000 });
if (await fresh.evaluate(() => !!window.__ghosty.studio)) problems.push('the fresh page had the studio open already (the first-visit check means nothing)');
await fresh.evaluate(() => window.__ghosty.run('open_studio', { room: { w: 380, d: 290, h: 240 } }));
await fresh.waitForFunction(() => window.__ghosty?.studio?.state().room === true, null, { timeout: 30000 }).catch(() => problems.push('the room did not build on a first visit'));
await fresh.waitForTimeout(1500);
const first = await fresh.evaluate(() => ({ canvases: document.querySelectorAll('#pg-studio canvas.studiocanvas').length, title: window.__ghosty.studio.state().title }));
if (first.canvases !== 1) problems.push(`a first visit with a room made ${first.canvases} drawing surfaces (want 1)`);
if (!/^Room 380 × 290/.test(first.title)) problems.push(`a first visit with a room shows "${first.title}" (the reactor replaced the room?)`);
await fresh.close();

await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : '3D STUDIO run clean on an iPhone 13: three.js loaded from this site, the arc reactor came apart and went back exactly, the slider, select, isolate, hide, section and measure worked, the toy car loaded in parts with its credit, a photo became a model through the (stubbed) brain and a quota refusal was shown in words, rooms were built from sizes and from the planner\'s JSON (the misfit named), an L-shaped room with a door and a window was built with its walls cut round them, a ceiling added, WALK walked with the joystick and looked about with a drag, AERIAL looked down, Spline took only public my.spline.design links and framed one with "Powered by Spline", SHOT gave a PNG, Ghosty opened the chair on request, and the security policy blocked nothing.');
process.exit(problems.length ? 1 : 0);
