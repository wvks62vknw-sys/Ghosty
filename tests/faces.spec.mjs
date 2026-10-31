// THE LENS's PEOPLE on the owner's phone (440 × 956; OWNER-ISSUES 55, 56), from the fake camera (Chromium's own, through
// getUserMedia like a phone's): the two face models stood in (window.__ghostyFaceEngine, honoured only under a test runner,
// as the offline brain's specs do), everything else real — the live-camera check, the matching, the boxes, the words, the
// store, Settings.
//  1. the face module refuses anything but the live camera: a picture in a video element, a canvas drawn into a stream;
//  2. ENROL ME from the front camera: five looks, kept; then a thin WHITE box labelled ADMIN and "It's you." once;
//     "who am I?" → "Admin.", "is this me?" → "Yes.";
//  3. "Ghosty, this is <name>" through the chat's own send() (the stop and raising readings never see it), with someone
//     in the picture → remembered; next time a box with their name; "who's this?" → their name; a stranger → no name,
//     no guess, "I don't know them: introduce us.";
//  4. Settings → PRIVACY → FACES: the count, × each with UNDO, DELETE for his own;
//  5. a face never leaves the phone, by the marker method (onphone.spec's): every request leaving the page is held at the
//     door and written down — the introduced name and the face numbers are in none of them.
//   BASE=http://localhost:8788 node tests/faces.spec.mjs [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { PHONE, UK, openPanel } from './nav.mjs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const problems = [];
const check = (ok, what) => void (ok || problems.push(what));
// Fictional, and nothing a page would ever carry by chance.
const NAME = 'Quorrin Vexmoor';
// The service worker is blocked: once it controls the page, Chromium reports none of its requests to the test.
const ctx = await browser.newContext({ viewport: PHONE, ...UK, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: ['camera'], serviceWorkers: 'block' });
const page = await ctx.newPage();
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' && !/favicon|net::ERR|404|Failed to load resource|^[WI]\d{4} |^INFO:/.test(t)) problems.push(`console: ${t.slice(0, 200)}`);
});
const sent = [];
await ctx.route('**/*', (route) => {
  const r = route.request();
  sent.push({ url: r.url(), body: r.postData() ?? '' });
  return route.continue();
});
await page.addInitScript(() => {
  // Three people's faces as the model would see them: each a direction in 128 numbers (seeded), each look a little off it.
  let seed = 4242;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const gauss = () => Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
  const face = () => Array.from({ length: 128 }, gauss);
  const PEOPLE = { admin: face(), other: face(), stranger: face() };
  window.__embs = [];
  window.__scene = 'none';
  // who is in the picture: 'admin', 'admin+other', 'other', 'stranger', 'none'
  window.__ghostyFaceEngine = {
    detect(size) {
      const s = window.__scene;
      const box = (x) => ({ x: size.w * x, y: size.h * 0.2, w: size.w * 0.3, h: size.h * 0.5 });
      const pts = (b) => [[b.x + b.w * 0.3, b.y + b.h * 0.4], [b.x + b.w * 0.7, b.y + b.h * 0.4], [b.x + b.w * 0.5, b.y + b.h * 0.6], [b.x + b.w * 0.5, b.y + b.h * 0.8]];
      const out = [];
      if (s.includes('admin')) out.push(box(0.08));
      if (s.includes('other') || s.includes('stranger')) out.push(box(0.6));
      return out.map((b) => ({ box: b, points: pts(b), score: 0.96 }));
    },
    embed(f) {
      const s = window.__scene;
      const who = f.box.x < f.box.w ? 'admin' : s.includes('stranger') ? 'stranger' : 'other';
      const v = PEOPLE[who].map((x) => x + 0.3 * gauss());
      window.__embs.push(v);
      return v;
    },
  };
});

await page.goto(base);
await page.fill('#pair input', 'preview-owner-key-0123456789');
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });

const people = () => page.evaluate(() => ({ ...window.__ghosty.people, faces: [...(window.__ghosty.people?.faces ?? [])] }));
const until = (fn, arg, ms, what) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => (problems.push(what), false));
const said = () => page.evaluate(() => window.__ghosty.people?.said ?? '');
const ask = async (text) => {
  await page.fill('#pg-lens .pplin', text);
  await page.locator('#pg-lens .pplask button', { hasText: 'SAY' }).click();
};

// ---- 1. the Lens, PEOPLE, the camera (a tap)
await page.evaluate(() => (location.hash = 'lens'));
await page.waitForSelector('#pg-lens .lensmodes', { timeout: 15000 });
await page.locator('#pg-lens .lensmodes button', { hasText: 'PEOPLE' }).click();
await until(() => window.__ghosty?.lens?.mode === 'people', null, 5000, 'the PEOPLE tile did not open PEOPLE');
check(await page.locator('#pg-lens .people button', { hasText: 'ENROL ME' }).isVisible(), 'no ENROL ME before he is enrolled');
check(/stay on this phone|never sent to my brain/i.test(await page.locator('#pg-lens .pplpriv').textContent()), 'PEOPLE does not say where faces stay');
// (an evaluate counts as a tap for a few seconds, so the camera may already be opening: START only when it is off)
await page.waitForTimeout(600);
if ((await page.evaluate(() => window.__ghosty.lens.camera)) === 'off') await page.locator('#pg-lens .lensbar button', { hasText: 'START' }).click();
await until(() => window.__ghosty?.lens?.camera === 'on', null, 20000, 'the fake camera did not open');

// the face module looks at nothing but the live camera
const refused = await page.evaluate(async () => {
  const out = [];
  const img = document.createElement('video');
  img.src = '/icon-192.png';
  try {
    await window.__ghosty.faces.look({ video: img, stream: null });
    out.push('looked at a picture');
  } catch (e) {
    out.push(e.message);
  }
  const c = document.createElement('canvas');
  c.width = 320;
  c.height = 240;
  c.getContext('2d').fillRect(0, 0, 100, 100);
  const stream = c.captureStream(5);
  const v = document.createElement('video');
  v.muted = true;
  v.srcObject = stream;
  await v.play().catch(() => undefined);
  await new Promise((r) => setTimeout(r, 300));
  try {
    await window.__ghosty.faces.look({ video: v, stream });
    out.push('looked at a canvas');
  } catch (e) {
    out.push(e.message);
  }
  for (const t of stream.getTracks()) t.stop();
  return out;
});
check(refused.length === 2 && refused.every((m) => /only look at faces through the live camera, never at a picture/.test(m)), `a picture or a drawn stream was not refused: ${JSON.stringify(refused)}`);

// ---- 2. ENROL ME: him alone in the picture, the front camera
await page.evaluate(() => (window.__scene = 'admin'));
await page.locator('#pg-lens .people button', { hasText: 'ENROL ME' }).click();
await until(() => window.__ghosty.people?.enrolled === true, null, 40000, `ENROL ME did not enrol him: ${JSON.stringify(await people())}`);
const enrolled = await people();
check(enrolled.looks >= 3 && enrolled.looks <= 5, `enrolled with ${enrolled.looks} looks`);
check(await page.evaluate(() => window.__ghosty.lens.facing === 'user'), 'ENROL ME did not turn to the front camera');
check(!(await page.locator('#pg-lens .people button', { hasText: 'ENROL ME' }).isVisible()), 'ENROL ME is still offered once he is enrolled');
// "It's you." once, and the thin white ADMIN box
await until(() => window.__ghosty.people?.said === 'It’s you.', null, 15000, `no "It's you.": "${await said()}"`);
await until(() => (window.__ghosty.people?.faces ?? []).some((f) => f.label === 'ADMIN' && f.me && f.sure), null, 10000, `no ADMIN box: ${JSON.stringify((await people()).faces)}`);
const white = await page.evaluate(() => {
  const c = document.querySelector('#pg-lens canvas.lensov');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] > 245 && d[i + 1] > 245 && d[i + 2] > 245 && d[i + 3] > 200) n++;
  return n;
});
check(white > 200, `the ADMIN box is not drawn in white (${white} white pixels)`);
await page.screenshot({ path: `${out}/faces-admin.png` });
// a word each
await ask('who am I?');
await until(() => window.__ghosty.people?.said === 'Admin.', null, 8000, `"who am I?" → "${await said()}"`);
await ask('is this me?');
await until(() => window.__ghosty.people?.said === 'Yes.', null, 8000, `"is this me?" → "${await said()}"`);
// "It's you." was once: a look later it is not said again
await page.waitForTimeout(1200);
check((await said()) === 'Yes.', `"It's you." came back: "${await said()}"`);

// ---- 3. someone he introduces, through the chat's own way in (send), the Lens still open
await page.evaluate(() => (window.__scene = 'admin+other'));
await page.waitForTimeout(800);
await page.evaluate((n) => window.__ghosty.send(`Ghosty, this is ${n}`), NAME);
await until((n) => (window.__ghosty.people?.said ?? '').startsWith(`Hello, ${n}.`), NAME, 20000, `the introduction was not taken: "${await said()}"`);
check((await people()).known === 1, `after the introduction PEOPLE knows ${(await people()).known} people`);
check(await page.evaluate(() => window.__ghosty.lens.mode === 'people' && window.__ghosty.lens.camera === 'on'), 'the introduction left the Lens');
// next time: their box with their name; "who's this?" in a word
await page.evaluate(() => (window.__scene = 'other'));
await until((n) => (window.__ghosty.people?.faces ?? []).some((f) => f.label === n && f.sure), NAME, 12000, `no box with the name: ${JSON.stringify((await people()).faces)}`);
await ask("who's this?");
await until((n) => window.__ghosty.people?.said === `${n}.`, NAME, 8000, `"who's this?" → "${await said()}"`);
await page.screenshot({ path: `${out}/faces-introduced.png` });
// a stranger: no name, no guess
await page.evaluate(() => (window.__scene = 'stranger'));
await page.waitForTimeout(1500);
await ask("who's this?");
await until(() => window.__ghosty.people?.said === 'I don’t know them: introduce us.', null, 8000, `a stranger → "${await said()}"`);
const strangerBoxes = (await people()).faces;
check(strangerBoxes.length >= 1 && strangerBoxes.every((f) => f.label === ''), `a stranger got a label: ${JSON.stringify(strangerBoxes)}`);

// ---- 4. Settings → PRIVACY → FACES
await page.evaluate(() => (location.hash = 'settings'));
await openPanel(page, 'settings', 'PRIVACY');
const faces = page.locator('#pg-settings .pn.pushed .faces');
await faces.waitFor({ state: 'attached', timeout: 10000 });
await faces.scrollIntoViewIfNeeded().catch(() => undefined);
await until(() => /2 faces: you and 1 person you introduced/.test(document.querySelector('#pg-settings .facecount')?.textContent ?? ''), null, 8000, `FACES count: "${await page.locator('#pg-settings .facecount').textContent()}"`);
check(await faces.locator('[data-face="me"] button', { hasText: 'RE-ENROL' }).count() === 1 && await faces.locator('[data-face="me"] button', { hasText: 'DELETE' }).count() === 1, 'his face has no RE-ENROL and DELETE');
const x = faces.locator('button.facedel');
check((await x.count()) === 1 && (await x.getAttribute('aria-label')) === `Forget ${NAME}'s face`, `the × for ${NAME}: ${await x.count()}`);
const box = await x.boundingBox();
check(box && box.width >= 44 && box.height >= 44, `the × is under a 44 pt target: ${JSON.stringify(box)}`);
await x.click();
await until(() => /^1 face: you\./.test(document.querySelector('#pg-settings .facecount')?.textContent ?? ''), null, 5000, `after ×: "${await page.locator('#pg-settings .facecount').textContent()}"`);
await page.locator('.undofloat button', { hasText: 'UNDO' }).click();
await until(() => /2 faces/.test(document.querySelector('#pg-settings .facecount')?.textContent ?? ''), null, 5000, 'UNDO did not bring the face back');
await page.screenshot({ path: `${out}/faces-settings.png` });
await faces.locator('[data-face="me"] button', { hasText: 'DELETE' }).click();
await until(() => /^1 face: 1 person you introduced/.test(document.querySelector('#pg-settings .facecount')?.textContent ?? ''), null, 5000, `after DELETE: "${await page.locator('#pg-settings .facecount').textContent()}"`);
await faces.locator('button.facedel').click();
await until(() => /^None\./.test(document.querySelector('#pg-settings .facecount')?.textContent ?? ''), null, 5000, 'the last face did not go');
const left = await page.evaluate(() => new Promise((ok) => {
  const r = indexedDB.open('ghosty-faces');
  r.onsuccess = () => {
    const q = r.result.transaction('people').objectStore('people').getAll();
    q.onsuccess = () => ok(q.result.length);
    q.onerror = () => ok(-1);
  };
  r.onerror = () => ok(-1);
}));
check(left === 0, `faces left in the phone's database after deleting them: ${left}`);
const wide = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
check(!wide, 'the page scrolls sideways');

// ---- 5. the marker method: nothing of a face, nor the name he gave, left the page
await page.waitForTimeout(1000);
const embs = await page.evaluate(() => window.__embs.slice(0, 40));
const markers = [NAME, NAME.toLowerCase(), ...embs.flatMap((v) => [String(v[0]), v.slice(0, 3).map((x) => Math.round(x / Math.hypot(...v) * 1e4) / 1e4).join(',')])];
const leaked = sent.filter((r) => markers.some((m) => m && (r.url.includes(m) || r.body.includes(m))));
check(!leaked.length, `a face or the name left the phone: ${leaked.map((r) => r.url).join(', ')}`);
check(sent.some((r) => /\/vendor\//.test(r.url) || /\/api\//.test(r.url)), 'the watch saw no requests at all (it is blind)');

await browser.close();
if (problems.length) {
  console.error(`FAIL faces:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`ok: PEOPLE — only the live camera; ENROL ME, the white ADMIN box and "It's you."; "${NAME}" introduced through the chat and known again; a stranger unnamed; FACES with × and UNDO; nothing of a face left the phone (${sent.length} requests watched)`);
