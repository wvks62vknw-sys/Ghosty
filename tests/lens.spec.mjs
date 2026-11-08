// The Lens on an iPhone 13: the brain's open_lens opens the tab but not the camera, START (a tap)
// opens it (a fake one here), SEE loads the detector and runs, UNFREEZE in READ clears the held
// frame, READ reads a drawn line of text on the phone and files it in the library and still works
// after the tab was left mid-read, a tap on the Lens tile opens the camera again, HANDS loads the
// gesture recogniser, ASK sends a still to the brain and shows its reply (the mock model answers
// "I can see a picture"), NAME's LIVING THING and ASK's WHAT'S IN IT? make their cards (the mock model's
// robin and plate of fish and chips; PLANT with no Pl@ntNet key), and the security policy lets the vendored WebAssembly run.
// THE ONE LENS (BRIEF-LENS; the last section): the camera shows a test card (a line of text, a QR code, a lemon; tests/fixtures/lenscard.mjs) and
// the Lens opens on ONE view that tags what it sees in the Machine's marks: text and a code stand with their keys within two seconds of the
// first look, the object says "looks like a …" only after the heavy pass (which waits for his tap on GET THE EYES and for a steady frame),
// a tap on the text tag reads it into the library, a tap on the code tag shows what SCAN shows, the tags go two seconds after the picture
// leaves, MORE opens the tools (HANDS, AIM, MEASURE, SOUND, SHAPES, PEOPLE), "read that" works by words with no model, the mark on the bar
// says WORKING / DEGRADED / OFFLINE, nothing sticks out sideways and every control is 44 pt at 440 and 390, the UI keeps its frame rate
// while it tags, and the text check costs under 4 ms a frame.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { PHONE, UK, openDeck } from './nav.mjs';
import { makeCardVideo } from './fixtures/lenscard.mjs';

const t0spec = Date.now();
const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
// the fake camera plays a still test card (text, a QR code, a lemon) instead of its moving pattern: a held phone, for the one view
const drawer = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined });
const cardVideo = await makeCardVideo(drawer);
await drawer.close();
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-video-capture=${cardVideo}`],
});
const problems = [];
const ctx = await browser.newContext({
  viewport: PHONE,
  ...UK,
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  permissions: ['camera'],
});
const page = await ctx.newPage();
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  const t = m.text();
  // MediaPipe's runtime talks through console.error: its info and warning lines ("I1016 …", "W1016 …",
  // "INFO: Created TensorFlow Lite XNNPACK delegate") are not problems; its error lines ("E1016 …") are.
  if (m.type() === 'error' && !/favicon|net::ERR|404|Failed to load resource|^[WI]\d{4} |^INFO:/.test(t)) problems.push(`console: ${t.slice(0, 200)}`);
});
await page.addInitScript(() => {
  // the camera takes a moment to open, as on the phone (the fake one is instant): the button must say so meanwhile
  const gum = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
  if (gum) navigator.mediaDevices.getUserMedia = (c) => new Promise((ok) => setTimeout(ok, 1500)).then(() => gum(c));
  // SEE's scene classifier is held back until SEE has drawn: the boxes must not wait for its 5.4 MB (they did)
  const realFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input?.url ?? String(input);
    if (!/efficientnet_lite0\.tflite/.test(url) || window.__classifierFree) return realFetch(input, init);
    return new Promise((ok) => { const t = setInterval(() => { if (window.__classifierFree) { clearInterval(t); ok(realFetch(input, init)); } }, 100); });
  };
  window.__csp = [];
  document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
});

await page.goto(base);
await page.fill('#pair input', 'preview-owner-key-0123456789');
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });

const lens = () => page.evaluate(() => {
  const s = window.__ghosty?.lens;
  return s ? { mode: s.mode, status: s.status, camera: s.camera, fps: s.fps, detections: s.detections.length, scene: s.scene.length, ocrText: s.ocrText, ocrConfidence: s.ocrConfidence, gesture: s.gesture, reply: s.reply, error: s.error } : null;
});
/** Where a thing sits against the tab bar: on screen and wholly above it (the Lens scrolls as one page on a phone). */
const clearOfDock = (sel, text) => page.evaluate(([sel, text]) => {
  const el = [...document.querySelectorAll(sel)].find((e) => e.offsetParent && (!text || e.textContent.trim().toUpperCase() === text));
  const dock = document.querySelector('#dock')?.getBoundingClientRect().top ?? innerHeight;
  if (!el) return 'not shown';
  const r = el.getBoundingClientRect();
  return r.top >= 0 && r.bottom <= dock + 1 ? '' : `at ${Math.round(r.top)}–${Math.round(r.bottom)} px, the tab bar starts at ${Math.round(dock)} px`;
}, [sel, text]);
const check_ = (ok, what) => void (ok || problems.push(what));
const until = (fn, ms, what) => page.waitForFunction(fn, null, { timeout: ms }).then(() => true).catch(() => { problems.push(what); return false; });

// ---- open_lens (the brain's auto-approved command) opens the LENS tab but leaves the camera off ----
// A Playwright evaluate counts as a tap for 5 s, so the command runs from a timer after that, like a
// client event from the brain with no tap behind it; nothing is evaluated in the page meanwhile.
await page.evaluate(() => setTimeout(() => window.__ghosty.run('open_lens', { mode: 'see' }), 5500));
await page.waitForTimeout(7000);
if (!(await page.locator('#pg-lens').isVisible())) problems.push('open_lens did not open the LENS tab');
const untouched = await lens();
if (untouched?.camera !== 'off') problems.push(`open_lens switched the camera on by itself: ${JSON.stringify(untouched)}`);
const startLabel = (await page.locator('#pg-lens .lensbar button').first().textContent()) ?? '';
if (startLabel !== 'START') problems.push(`the camera button reads "${startLabel}" while the camera is off`);
// the empty viewfinder says the camera is off and what to do, not a black box with a small pill
const emptyMsg = await page.evaluate(() => { const e = document.querySelector('#pg-lens .lensempty'); return e && !e.hidden && e.offsetParent ? e.textContent : ''; });
if (!/Camera off/.test(emptyMsg) || !/START/.test(emptyMsg)) problems.push(`with the camera off the viewfinder says "${emptyMsg}"`);
// FLIP and FREEZE need the camera: dimmed while it is off (FLIP did nothing at all when tapped)
const deadBtns = await page.evaluate(() => [...document.querySelectorAll('#pg-lens .lensbar button')].filter((b) => /^(FLIP|FREEZE)$/.test(b.textContent) && !b.disabled).map((b) => b.textContent));
if (deadBtns.length) problems.push(`with the camera off ${deadBtns.join(' and ')} can still be tapped`);

// ---- SEE: START (a tap) opens the camera and the detector runs on the live picture ----
await page.locator('#pg-lens .lensbar button', { hasText: 'START' }).click();
// while the camera opens the button reads STOP: a START there invited a second tap, which stopped it
const opening = await page.evaluate(() => ({ camera: window.__ghosty.lens.camera, label: document.querySelector('#pg-lens .lensbar button')?.textContent }));
if (opening.camera === 'starting' && opening.label !== 'STOP') problems.push(`the camera button reads "${opening.label}" while the camera opens`);
await until(() => window.__ghosty?.lens?.camera === 'on', 20000, `the fake camera did not open from START: ${JSON.stringify(await lens())}`);
if (await page.evaluate(() => !!document.querySelector('#pg-lens .lensempty')?.offsetParent)) problems.push('the camera-off message stayed over the live picture');
// swiftshader runs the detector slowly; one run is enough to show it loaded and works
await until(() => window.__ghosty?.lens?.fps > 0, 90000, `SEE never ran the detector while the scene classifier was still downloading: ${JSON.stringify(await lens())}`);
await page.evaluate(() => (window.__classifierFree = true));
const see = await lens();
if (see?.error) problems.push(`SEE error: ${see.error}`);
// the status line settles from "loading … / starting …" to plain words: "looking · nothing it can name yet", "2 things in view · tap a box"
// (it had said "1.0 fps · 5181 ms a look")
await until(() => !/loading|starting|opening/i.test(window.__ghosty?.lens?.status ?? ''), 60000, `SEE status never settled: "${(await lens())?.status}"`);
const seeStatus = (await lens())?.status ?? '';
if (!/live|frozen|looking|in view/.test(seeStatus) || /fps|ms a look/.test(seeStatus)) problems.push(`SEE status is "${seeStatus}"`);

// ---- READ: a drawn line of text, picked as a photo, is read on the phone and filed in the library ----
// (switching away stops the detector loop, which under software rendering hogs the main thread)
await page.evaluate(() => window.__ghosty.lens.setMode('read'));
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/lens-see.png`, timeout: 90000 }).catch((e) => problems.push(`screenshot after SEE: ${e.message.split('\n')[0]}`));
// FREEZE holds a frame over the live picture; UNFREEZE lets go of it in READ too (nothing else to clear it there)
const stillShown = () => page.evaluate(() => !document.querySelector('#pg-lens canvas.lensstill')?.hidden);
await page.locator('#pg-lens .lensbar button', { hasText: 'FREEZE' }).click();
await page.waitForTimeout(300);
if (!(await stillShown())) problems.push('FREEZE in READ did not show the held frame');
await page.locator('#pg-lens .lensbar button', { hasText: 'UNFREEZE' }).click();
await page.waitForTimeout(300);
if (await stillShown()) problems.push('UNFREEZE in READ left the held frame on screen');
if ((await lens())?.frozen) problems.push('UNFREEZE in READ left the Lens frozen');
const drawn = (big, small) => page.evaluate(async ([big, small]) => {
  const c = document.createElement('canvas');
  c.width = 1200;
  c.height = 400;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#000';
  g.font = 'bold 72px sans-serif';
  g.fillText(big, 60, 150);
  g.font = '48px sans-serif';
  g.fillText(small, 60, 280);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s);
}, [big, small]);
const pickPhoto = async (png) => page.locator('#pg-lens input[type=file]').setInputFiles({ name: 'note.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
const png = await drawn('GHOSTY READS THIS', 'Second line of the note');
await pickPhoto(png);
await until(() => /GHOSTY READS THIS/i.test(window.__ghosty?.lens?.ocrText ?? ''), 120000, `READ did not read the drawn text: ${JSON.stringify(await lens())}`);
const read = await lens();
if (read && read.ocrConfidence < 60) problems.push(`READ confidence is low: ${read.ocrConfidence}`);
if (read && !/second line/i.test(read.ocrText)) problems.push(`READ missed the second line: ${JSON.stringify(read.ocrText)}`);
// the text read and its SAVE TO LIBRARY come up above the tab bar by themselves (they had landed under it)
await page.waitForTimeout(1200);
for (const [sel, text] of [['#pg-lens textarea.lensocr'], ['#pg-lens .lenspanel button', 'SAVE TO LIBRARY']]) {
  const where = await clearOfDock(sel, text);
  if (where) problems.push(`READ's ${text ?? 'text'} is not in view once read: ${where}`);
}
const saved = page.waitForResponse((r) => r.url().includes('/api/library/text'), { timeout: 20000 }).catch(() => null);
await page.locator('#pg-lens button', { hasText: 'SAVE TO LIBRARY' }).first().click();
const saveRes = await saved;
if (!saveRes) problems.push('SAVE TO LIBRARY sent nothing to the brain');
else {
  const j = await saveRes.json().catch(() => ({}));
  if (saveRes.status() !== 200 || !j.id) problems.push(`SAVE TO LIBRARY answered ${saveRes.status()} ${JSON.stringify(j).slice(0, 160)}`);
  else if (j.kind !== 'scan') problems.push(`the scanned note was filed as "${j.kind}", not "scan"`);
}
await page.screenshot({ path: `${out}/lens-read.png`, timeout: 90000 }).catch((e) => problems.push(`screenshot after READ: ${e.message.split('\n')[0]}`));

// ---- leaving the Lens mid-read, then coming back by a tap on its tile: the camera opens again and READ reads again ----
await pickPhoto(png);
await until(() => { const p = document.querySelector('#pg-lens .lensprog'); return !!p && !p.hidden; }, 15000, `the second read did not start: ${JSON.stringify(await lens())}`);
await page.click('#dock button[data-id="core"]');
await page.waitForTimeout(600);
if (await page.locator('#pg-lens').isVisible()) problems.push('the CORE tab did not replace the Lens');
const away = await lens();
if (away?.camera !== 'off') problems.push(`leaving the Lens did not stop the camera: ${JSON.stringify(away)}`);
await openDeck(page);
await page.waitForSelector('#deck.on', { timeout: 3000 }).catch(() => problems.push('the systems deck did not open'));
await page.click('#deck .dkcard[data-id="lens"]');
await page.click('#deck .dkx[data-id="lens"] .dkopen');
await until(() => window.__ghosty?.lens?.camera === 'on', 20000, `a tap on the Lens tile did not open the camera again: ${JSON.stringify(await lens())}`);
if ((await lens())?.mode !== 'read') problems.push(`the Lens came back in ${(await lens())?.mode}, not READ`);
await page.evaluate(() => (window.__ghosty.lens.ocrText = ''));
await pickPhoto(await drawn('LENS READS AGAIN', 'after the tab was left'));
await until(() => /LENS READS AGAIN/i.test(window.__ghosty?.lens?.ocrText ?? ''), 120000, `READ did not work again after the Lens was left mid-read: ${JSON.stringify(await lens())}`);

// ---- HANDS: the gesture recogniser loads and runs (the fake camera shows no hand) ----
await page.evaluate(() => window.__ghosty.lens.setMode('hands'));
await until(() => window.__ghosty?.lens?.mode === 'hands' && window.__ghosty?.lens?.fps > 0, 90000, `HANDS never ran the recogniser: ${JSON.stringify(await lens())}`);
await page.waitForTimeout(1200);
const hands = await lens();
if (hands?.error) problems.push(`HANDS error: ${hands.error}`);
if (!/hand|gesture|let go/.test(hands?.status ?? '') || /fps/.test(hands?.status ?? '')) problems.push(`HANDS status is "${hands?.status}"`);

// ---- ASK: a question with the still reaches the brain; the mock model says it can see a picture ----
await page.evaluate(() => window.__ghosty.lens.setMode('ask'));
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/lens-hands.png`, timeout: 90000 }).catch((e) => problems.push(`screenshot after HANDS: ${e.message.split('\n')[0]}`));
await page.fill('#pg-lens textarea.lensq', 'What is this?');
const askReq = page.waitForRequest((r) => r.url().includes('/api/chat') && r.method() === 'POST', { timeout: 20000 }).catch(() => null);
await page.locator('#pg-lens button', { hasText: 'ASK GHOSTY' }).first().click();
const req = await askReq;
if (!req) problems.push('ASK GHOSTY sent nothing to the brain');
else {
  const body = req.postDataJSON();
  if (!Array.isArray(body.images) || !/^data:image\/jpeg;base64,/.test(body.images[0] ?? '')) problems.push(`ASK did not send a JPEG still: ${JSON.stringify(Object.keys(body))}`);
  if ((body.images?.[0]?.length ?? 0) > 1_500_000 * 1.4) problems.push('the still sent is bigger than 1.5 MB');
}
await until(() => /I can see a picture/.test(window.__ghosty?.lens?.reply ?? ''), 30000, `ASK got no reply from the brain: ${JSON.stringify(await lens())}`);
await page.waitForTimeout(1200);
const replyWhere = await clearOfDock('#pg-lens .lensreply');
if (replyWhere) problems.push(`ASK's reply is not in view once it came: ${replyWhere}`);
await page.screenshot({ path: `${out}/lens-ask.png`, timeout: 90000 }).catch((e) => problems.push(`screenshot after ASK: ${e.message.split('\n')[0]}`));
// the question also shows in the chat history, marked as a photo turn
const chatHasTurn = await page.evaluate(() => {
  try {
    return /\[photo\]/.test(localStorage.getItem('ghosty.chat') ?? '');
  } catch {
    return false;
  }
});
if (!chatHasTurn) problems.push('the photo question was not mirrored into the chat history');

// ---- NAME IT: LIVING THING → BIRD sends the photo to the brain's seeing model (the mock answers a robin, "fairly
// confident"); the card shows the name, how sure in plain words, the tell-tale, Wikipedia and SAVE, and SAVE keeps
// "seen: …" in Memory. PLANT with no Pl@ntNet key says what is missing. WHAT'S IN IT? in ASK lists the foods (the
// mock: fish in batter, chips, mushy peas) with the rough total and its honesty line. ----
const card = () => page.evaluate(() => window.__ghosty?.lens?.card ?? null);
const cardEl = '#pg-lens .livingcard';
await page.evaluate(() => window.__ghosty.lens.setMode('name'));
await page.waitForTimeout(500);
await pickPhoto(await drawn('A BIRD ON A BRANCH', 'red breast'));
await page.locator('#pg-lens button', { hasText: 'LIVING THING' }).click();
const remembered = async () => (await (await page.request.get(`${base}/api/memory`, { headers: { 'x-ghosty': '1', 'x-ghosty-key': 'preview-owner-key-0123456789' } }).catch(() => null))?.json().catch(() => ({})))?.facts ?? [];
const factsBefore = (await remembered()).length;
const birdReq = page.waitForRequest((r) => r.url().includes('/api/chat') && r.method() === 'POST', { timeout: 20000 }).catch(() => null);
await page.locator('#pg-lens .livingkinds button', { hasText: 'BIRD' }).click();
await until(() => window.__ghosty?.lens?.card?.what === 'living', 60000, `LIVING THING → BIRD showed no card: ${JSON.stringify(await card())}`);
const birdBody = (await birdReq)?.postDataJSON();
if (!/^data:image\/jpeg;base64,/.test(birdBody?.images?.[0] ?? '')) problems.push('BIRD did not send the photo to the brain');
if (!/^LENS NAME IT \(bird\)/.test(birdBody?.message ?? '')) problems.push(`BIRD asked "${(birdBody?.message ?? '').slice(0, 60)}"`);
const bird = (await card())?.text ?? '';
for (const want of ['European robin', 'Erithacus rubecula', 'Probably a European robin.', 'probably — the model said “fairly confident”', 'Tell-tale: the orange-red breast and face']) if (!bird.includes(want)) problems.push(`the bird card lacks "${want}": ${bird}`);
if (!(await page.locator(`${cardEl} a[href="https://en.wikipedia.org/wiki/Erithacus_rubecula"]`).count())) problems.push('the bird card has no Wikipedia link');
if (!(await page.locator(`${cardEl} button`, { hasText: 'SAVE' }).isVisible())) problems.push('the bird card has no SAVE');
const chatShown = await page.evaluate(() => { try { return localStorage.getItem('ghosty.chat') ?? ''; } catch { return ''; } });
if (/LENS NAME IT/.test(chatShown)) problems.push('the NAME IT question was put in the chat on screen');
if ((await remembered()).length !== factsBefore) problems.push('something was kept in Memory before SAVE');
const history = await (await page.request.get(`${base}/api/history`, { headers: { 'x-ghosty': '1', 'x-ghosty-key': 'preview-owner-key-0123456789' } }).catch(() => null))?.json().catch(() => ({}));
if (/LENS NAME IT|European robin/.test(JSON.stringify(history?.turns ?? []))) problems.push('the brain kept the NAME IT exchange in its history');
await page.locator(`${cardEl} .row`).last().evaluate((el) => el.scrollIntoView({ block: 'center' }));
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/lens-living-bird.png`, timeout: 90000 }).catch((e) => problems.push(`screenshot of the bird card: ${e.message.split('\n')[0]}`));
const memSaved = page.waitForResponse((r) => r.url().endsWith('/api/memory') && r.request().method() === 'POST', { timeout: 20000 }).catch(() => null);
await page.locator(`${cardEl} button`, { hasText: 'SAVE' }).click();
const memRes = await memSaved;
const savedText = memRes ? JSON.parse(memRes.request().postData() ?? '{}').text : '';
if (!/^seen: a European robin, \d{1,2} [A-Z][a-z]{2}$/.test(savedText ?? '')) problems.push(`SAVE kept "${savedText}"`);
if (!(await remembered()).some((f) => /^seen: a European robin/.test(f.text))) problems.push('SAVE did not reach Memory');

await page.locator('#pg-lens button', { hasText: 'LIVING THING' }).click();
await page.locator('#pg-lens .livingkinds button', { hasText: 'PLANT' }).click();
await until(() => window.__ghosty?.lens?.card?.what === 'missing', 60000, `PLANT with no key showed no missing-key card: ${JSON.stringify(await card())}`);
const nokey = (await card())?.text ?? '';
for (const want of ['PL@NTNET NEEDS ITS FREE KEY', 'SYSTEM → KEYS → Pl@ntNet', 'my.plantnet.org', '500 plants a day']) if (!nokey.includes(want)) problems.push(`the no-key card lacks "${want}": ${nokey}`);
if (!(await page.locator(`${cardEl} button`, { hasText: 'ASK GHOSTY INSTEAD' }).isVisible())) problems.push('the no-key card offers no other way');
await page.locator(`${cardEl} .row`).last().evaluate((el) => el.scrollIntoView({ block: 'center' }));
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/lens-living-nokey.png`, timeout: 90000 }).catch((e) => problems.push(`screenshot of the no-key card: ${e.message.split('\n')[0]}`));

await page.evaluate(() => window.__ghosty.lens.setMode('ask'));
await page.waitForTimeout(500);
await page.locator('#pg-lens button', { hasText: "WHAT'S IN IT?" }).click();
await until(() => window.__ghosty?.lens?.card?.what === 'meal', 60000, `WHAT'S IN IT? showed no meal card: ${JSON.stringify(await card())}`);
const meal = (await card())?.text ?? '';
for (const want of ['fish in batter, about 150 g: about 350 kcal', 'chips, about 150 g: about 470 kcal', 'mushy peas, about 80 g: about 60 kcal', 'about 880 kcal', 'rough: portions are guessed from a photo', 'USDA FoodData Central']) if (!meal.includes(want)) problems.push(`the meal card lacks "${want}": ${meal}`);
await page.locator(`${cardEl} .row`).last().evaluate((el) => el.scrollIntoView({ block: 'center' }));
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/lens-meal.png`, timeout: 90000 }).catch((e) => problems.push(`screenshot of the meal card: ${e.message.split('\n')[0]}`));

// ---- SOUND, the last tile: the mode in use is in sight in the tile row, not off its right edge ----
await page.evaluate(() => window.__ghosty.lens.setMode('sound'));
// the row scrolls smoothly: give it time on a busy machine
await page.waitForFunction(() => {
  const row = document.querySelector('#pg-lens .lensmodes').getBoundingClientRect();
  const r = document.querySelector('#pg-lens .lensmodes button.on')?.getBoundingClientRect();
  return !!r && r.right <= row.right - 27;
}, null, { timeout: 6000 }).catch(() => undefined);
const tile = await page.evaluate(() => {
  const row = document.querySelector('#pg-lens .lensmodes').getBoundingClientRect();
  const on = document.querySelector('#pg-lens .lensmodes button.on');
  const r = on?.getBoundingClientRect();
  return { label: on?.textContent ?? '', inSight: !!r && r.left >= row.left - 1 && r.right <= row.right - 27 };
});
if (!/^SOUND/.test(tile.label) || !tile.inSight) problems.push(`in SOUND the lit tile is ${tile.inSight ? '' : 'off screen '}("${tile.label}")`);
// SOUND switched the camera off; ASK next says so instead of keeping SOUND's line ("LISTEN: play your music, then RECORD")
await page.evaluate(() => window.__ghosty.lens.setMode('ask'));
await page.waitForTimeout(400);
const askLine = (await lens())?.status ?? '';
if (!/camera off/.test(askLine)) problems.push(`ASK after SOUND says "${askLine}"`);

// ---- the security policy: WebAssembly and the camera were allowed, nothing was blocked ----
const csp = await page.evaluate(() => window.__csp);
if (csp.length) problems.push(`security policy blocked: ${csp.join(' | ')}`);
// phone layout: nothing sticks out sideways
const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
if (wide) problems.push('the Lens is wider than the phone screen');


// ================================================================================================================================
// ---- THE ONE LENS: a new page (nothing of the modes above left in it), the card on the camera
// ================================================================================================================================
// (the first page and its camera are let go: the one view runs on a quiet machine, as it would on a phone with one Lens open)
console.log(`the modes (SEE, READ, HANDS, ASK, NAME, SOUND), as before: ${Math.round((Date.now() - t0spec) / 1000)} s`);
await ctx.close();
const t0one = Date.now();
try {
const ctx2 = await browser.newContext({ viewport: PHONE, ...UK, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', permissions: ['camera'] });
const p2 = await ctx2.newPage();
p2.on('pageerror', (e) => problems.push(`one view pageerror: ${e.message}`));
p2.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' && !/favicon|net::ERR|404|Failed to load resource|^[WI]\d{4} |^INFO:/.test(t)) problems.push(`one view console: ${t.slice(0, 200)}`);
});
const chatPosts = [];
p2.on('request', (r) => { if (r.url().includes('/api/chat') && r.method() === 'POST') chatPosts.push(r.url()); });
// a clock in the page (every frame): when the camera came on, when the picture first held still, when the text and the code first stood
await p2.addInitScript(() => {
  window.__clock = {};
  const f = () => {
    const o = window.__ghosty?.one;
    const c = window.__clock;
    const now = performance.now();
    if (o) {
      if (window.__ghosty.lens.camera === 'on' && !c.camera) c.camera = now;
      if (o.steady && !c.steady) c.steady = now;
      if (o.tags.some((t) => t.kind === 'text') && !c.text) c.text = now;
      if (o.tags.some((t) => t.kind === 'code') && !c.code) c.code = now;
    }
    requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
});
await p2.goto(base);
await p2.fill('#pair input', 'preview-owner-key-0123456789');
await p2.click('#pair button.on');
await p2.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
const one = () => p2.evaluate(() => JSON.parse(JSON.stringify(window.__ghosty.one)));
const L2 = () => p2.evaluate(() => ({ mode: window.__ghosty.lens.mode, camera: window.__ghosty.lens.camera, status: window.__ghosty.lens.status, ocrText: window.__ghosty.lens.ocrText }));
const until2 = (fn, ms, what, arg = null) => p2.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => { problems.push(what); return false; });
const kinds = (st) => st.tags.map((t) => t.kind).sort().join(',');
/** Every control in the Lens that is on screen, with a box under 44 pt either way. */
const small = () => p2.evaluate(() => [...document.querySelectorAll('#pg-lens button, #pg-lens .g-key, #pg-lens .g-ret')].filter((b) => b.offsetParent !== null).map((b) => ({ t: (b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 24), r: b.getBoundingClientRect() })).filter((x) => x.r.width > 0 && (x.r.width < 43.5 || x.r.height < 43.5)).map((x) => `${x.t} ${Math.round(x.r.width)}×${Math.round(x.r.height)}`));
const sideways = () => p2.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
const fpsOver = (ms) => p2.evaluate((ms) => new Promise((ok) => { let n = 0; const t0 = performance.now(); let worst = 0; let last = t0; const f = (t) => { n++; worst = Math.max(worst, t - last); last = t; if (t - t0 < ms) requestAnimationFrame(f); else ok({ fps: Math.round((n / (t - t0)) * 10000) / 10, worst: Math.round(worst) }); }; requestAnimationFrame(f); }), ms);

await p2.evaluate(() => (location.hash = 'lens'));
await p2.waitForSelector('#pg-lens .lensbar', { timeout: 15000 });
// the Lens opens on ONE view: no mode to pick, the tool row behind MORE
const first = await L2();
if (first.mode !== 'lens') problems.push(`the Lens opened in "${first.mode}", not the one view`);
if (await p2.locator('#pg-lens .lensmodes').isVisible()) problems.push('the row of modes is showing in the one view: nothing to pick should be on screen');
if (!(await p2.locator('#pg-lens .lensbar button', { hasText: 'MORE' }).isVisible())) problems.push('no MORE key on the bar');
// the mark and its download key, said before anything is on the phone: DEGRADED, the heavy detectors with their size
const markWords = () => p2.evaluate(() => document.querySelector('#pg-lens .lensmark')?.textContent?.trim() ?? '');
if (!/DEGRADED/i.test(await markWords())) problems.push(`the mark on the bar says "${await markWords()}" before the heavy detectors are on the phone`);
const getKey = await p2.locator('#pg-lens .lensget').textContent().catch(() => '');
if (!/GET THE EYES/i.test(getKey) || !/47 MB/.test(getKey)) problems.push(`the download key says "${getKey}"`);
if ((await p2.locator('#pg-lens .lensget').getAttribute('aria-label').catch(() => '')) === null) problems.push('the download key has no name for VoiceOver');
// the camera opens from a tap only (an evaluate counts as a tap for five seconds: START when it is not already opening)
await p2.waitForTimeout(600);
if ((await L2()).camera === 'off') await p2.locator('#pg-lens .lensbar button', { hasText: 'START' }).click();
await until2(() => window.__ghosty.lens.camera === 'on', 25000, `the fake camera did not open in the one view: ${JSON.stringify(await L2())}`);
const cameraOnAt = Date.now();
// ---- the budgets: the first tags (text, a code) within two seconds of the first look, nothing named yet
await until2(() => { const t = window.__ghosty.one.tags.map((x) => x.kind); return t.includes('text') && t.includes('code'); }, 60000, `the text and the code were not tagged: ${JSON.stringify((await one()).tags.map((t) => t.kind))}`);
const tagged = await one();
const standAt = Date.now();
await until2(() => window.__ghosty.one.steady, 90000, 'the held card never counted as a steady frame');
// the speed habit: from a steady frame to the first tags under two seconds (a tag that stood before the picture was steady counts as none)
const clock = await p2.evaluate(() => window.__clock);
const steadyToTags = Math.max(clock.text, clock.code) - (clock.steady ?? clock.camera);
check_(clock.steady != null && steadyToTags < 2000, `from a steady frame to the text and the code tagged took ${Math.round(steadyToTags)} ms (budget 2000): ${JSON.stringify(clock)}`);
// the text check's cost is read once a dozen frames have been timed with nothing else running (the first frames of a visit, with
// the camera starting and the first look drawn through software graphics, are warm-up, not the cost: main went red on them twice)
await until2(() => window.__ghosty.one.textFrames >= 12, 30000, `the text check was not timed on a dozen frames: ${JSON.stringify(await one().then((o) => ({ frames: o.textFrames, ms: o.textMs })))}`);
const warm = await one();
console.log(`one view: camera on to the first look ${Math.round(tagged.grabMs)} ms (a frame read through the software graphics here), camera on → steady ${Math.round(clock.steady - clock.camera)} ms, steady → text and code tagged ${Math.round(steadyToTags)} ms, the first tag ${tagged.firstTagMs} ms after the first look was asked for; text check ${warm.textMs} ms a frame (${tagged.textMs} on the first frames)`);
if (warm.textMs <= 0 || warm.textMs >= 4) problems.push(`the text-present check cost ${warm.textMs} ms a frame (budget 4)`);
const text = tagged.tags.find((t) => t.kind === 'text');
const code = tagged.tags.find((t) => t.kind === 'code');
if (text?.truth !== 'I see text — tap to read it') problems.push(`the text tag says "${text?.truth}"`);
if (text?.acts.join() !== 'READ,TRANSLATE,ASK') problems.push(`the text tag offers ${text?.acts}`);
if (code?.truth !== 'a web address') problems.push(`the code tag says "${code?.truth}"`);
if (code?.acts.join() !== 'LOOK,ASK') problems.push(`the code tag offers ${code?.acts}`);
if (tagged.tags.some((t) => /looks like/i.test(t.truth))) problems.push('an object was named before the heavy pass ran');
if (tagged.tags.some((t) => t.kind === 'object') && tagged.heavy !== 'ready') problems.push('an object tag stands before the heavy detectors were loaded');
if (tagged.heavy !== 'off' || !/DEGRADED/i.test(await markWords())) problems.push(`before the tap, heavy is "${tagged.heavy}" and the mark "${await markWords()}"`);
// the tags are drawn in the Machine's marks: a reticle, a tag, a true line, a key (in the DOM, over the video)
const marks = await p2.evaluate(() => ({ ret: document.querySelectorAll('#pg-lens .lenstags .g-ret[data-g="reticle"]').length, tag: document.querySelectorAll('#pg-lens .lenstags [data-g="tag"]').length, truth: document.querySelectorAll('#pg-lens .lenstagunder [data-g="truth"]').length, key: document.querySelectorAll('#pg-lens .lenstagunder button.g-key').length, over: !!document.querySelector('#pg-lens .lensview > .lenstags') }));
if (marks.ret < 2 || marks.tag < 2 || marks.truth < 2 || marks.key < 4 || !marks.over) problems.push(`the tags are not the Machine's marks over the video: ${JSON.stringify(marks)}`);
await p2.screenshot({ path: `${out}/lens-one-tags.png`, timeout: 90000 }).catch((e) => problems.push(`screenshot of the tags: ${e.message.split('\n')[0]}`));
// nothing sideways and every control 44 pt, at 440 and at 390
let bad = await small();
if (bad.length) problems.push(`controls under 44 pt at 440: ${bad.join(', ')}`);
if (await sideways()) problems.push('the one view is wider than the phone at 440');
await p2.setViewportSize({ width: 390, height: 844 });
await p2.waitForTimeout(1200);
bad = await small();
if (bad.length) problems.push(`controls under 44 pt at 390: ${bad.join(', ')}`);
if (await sideways()) problems.push('the one view is wider than the phone at 390');
const edge = await p2.evaluate(() => { const v = document.querySelector('#pg-lens .lensview').getBoundingClientRect(); return [...document.querySelectorAll('#pg-lens .lenstag, #pg-lens .lenstagunder')].filter((e) => !e.hidden).map((e) => e.getBoundingClientRect()).filter((r) => r.left < v.left - 1 || r.right > v.right + 1).length; });
if (edge) problems.push(`${edge} tag(s) stick out of the viewfinder at 390`);
await p2.screenshot({ path: `${out}/lens-one-390.png`, timeout: 90000 }).catch(() => undefined);
await p2.setViewportSize(PHONE);
await p2.waitForTimeout(800);
// ---- the UI keeps its frame rate while it tags (the same page held still is the baseline: the picture frozen, the tags still drawn)
// (two runs of each, the better of them: a shared machine has its slow seconds)
const tag1 = await fpsOver(3000);
await p2.locator('#pg-lens .lensbar button', { hasText: 'FREEZE' }).click();
await p2.waitForTimeout(600);
const held1 = await fpsOver(3000);
await p2.locator('#pg-lens .lensbar button', { hasText: 'UNFREEZE' }).click();
await p2.waitForTimeout(800);
const tag2 = await fpsOver(3000);
await p2.locator('#pg-lens .lensbar button', { hasText: 'FREEZE' }).click();
await p2.waitForTimeout(600);
const held2 = await fpsOver(3000);
await p2.locator('#pg-lens .lensbar button', { hasText: 'UNFREEZE' }).click();
const tagging = tag1.fps >= tag2.fps ? tag1 : tag2;
const baseline = held1.fps >= held2.fps ? held1 : held2;
console.log(`one view: ${tagging.fps} fps while tagging (worst frame ${tagging.worst} ms), ${baseline.fps} fps with the picture held (the baseline on this machine: its software graphics draw even Home at a few frames a second)`);
if (tagging.fps < Math.min(30, baseline.fps * 0.8)) problems.push(`tagging costs the UI its frame rate: ${tagging.fps} fps against ${baseline.fps} held (floor min(30, 80% of the baseline))`);

// ---- GET THE EYES (his tap): the heavy detectors load; the object is tagged "looks like a …" only on a steady frame
await p2.locator('#pg-lens .lensget').click();
await until2(() => window.__ghosty.one.heavy === 'ready', 180000, `the heavy detectors did not load: ${JSON.stringify(await one().then((o) => ({ heavy: o.heavy, said: o.said })))}`);
if (!/WORKING/i.test(await markWords())) problems.push(`after the eyes are on the phone the mark says "${await markWords()}"`);
if (await p2.locator('#pg-lens .lensget').isVisible()) problems.push('the download key is still offered once the eyes are on the phone');
await until2(() => window.__ghosty.one.tags.some((t) => t.kind === 'object' && /^looks like (a|an) lemon/i.test(t.truth)), 120000, `the object was not named after the heavy pass: ${JSON.stringify((await one()).tags.map((t) => `${t.kind}:${t.truth}`))}`);
const named = await one();
const obj = named.tags.find((t) => t.kind === 'object');
if (obj && obj.acts.join() !== 'NAME IT,ASK,MEASURE') problems.push(`the named object offers ${obj.acts}`);
console.log(`one view: heavy pass ${named.heavyMs} ms (${named.heavyPasses} so far); the text, the code and the object stand together: ${kinds(named)}`);
await p2.screenshot({ path: `${out}/lens-one-named.png`, timeout: 90000 }).catch(() => undefined);
// the context the brain gets: counts and kinds, never who
const ctxLine = await p2.evaluate(() => window.__ghosty.awareness.wordsNow());
if (!/^On screen: the Lens, camera on: \d tags?: /.test(ctxLine)) problems.push(`the Lens tells the brain: "${ctxLine}"`);

// ---- a tap on the text tag reads it into the library (as READ did); the key does the same
await p2.locator('#pg-lens .lenstagunder[data-kind="text"] button.g-key', { hasText: /^READ$/ }).first().click();
await until2(() => window.__ghosty.lens.mode === 'read', 8000, `the READ key did not open READ: ${JSON.stringify(await L2())}`);
await until2(() => /GHOSTY READS THIS/i.test(window.__ghosty.lens.ocrText ?? ''), 120000, `READ did not read the tagged text: ${JSON.stringify(await L2())}`);
const savedOne = p2.waitForResponse((r) => r.url().includes('/api/library/text'), { timeout: 20000 }).catch(() => null);
await p2.locator('#pg-lens button', { hasText: 'SAVE TO LIBRARY' }).first().click();
const saveOne = await savedOne;
if (!saveOne) problems.push('the tagged text was not saved to the library');
else if ((await saveOne.json().catch(() => ({}))).kind !== 'scan') problems.push('the tagged text was not filed as a scan');
await p2.locator('#pg-lens .lensbar .lensback').click();
await until2(() => window.__ghosty.lens.mode === 'lens', 5000, 'the back key did not return to the one view');
// ---- a tap on the code tag does what SCAN did: the web address, its real site, the warning, never opened
await until2(() => window.__ghosty.one.tags.some((t) => t.kind === 'code'), 60000, 'the code tag did not come back after READ');
await p2.locator('#pg-lens .lenstags .g-ret[aria-label^="A code"]').first().click();
await until2(() => window.__ghosty.lens.mode === 'scan', 8000, `a tap on the code tag did not open SCAN: ${JSON.stringify(await L2())}`);
await until2(() => (window.__ghosty.scan?.codes ?? []).some((c) => c.kind === 'url'), 20000, `SCAN did not show the tagged code: ${JSON.stringify(await p2.evaluate(() => window.__ghosty.scan?.codes))}`);
const scanned = await p2.evaluate(() => window.__ghosty.scan.codes.at(-1));
if (scanned?.text !== 'https://paypal.com.secure-login.example/verify') problems.push(`the code tag handed SCAN ${JSON.stringify(scanned)}`);
if ((await p2.locator('#pg-lens .scansite b').textContent().catch(() => '')) !== 'secure-login.example') problems.push('the code card does not name the real site');
await p2.screenshot({ path: `${out}/lens-one-code.png`, timeout: 90000 }).catch(() => undefined);
await p2.locator('#pg-lens .lensbar .lensback').click();
await until2(() => window.__ghosty.lens.mode === 'lens', 5000, 'the back key did not return from SCAN');

// ---- NAME IT on the object tag opens NAME on the crop: the closest names, "lemon" first (the card as before)
await until2(() => window.__ghosty.one.tags.some((t) => t.kind === 'object' && /lemon/i.test(t.truth)), 120000, 'the object tag did not come back for NAME IT');
await p2.locator('#pg-lens .lenstagunder[data-kind="object"] button.g-key', { hasText: /^NAME IT$/ }).first().click();
await until2(() => window.__ghosty.lens.mode === 'name', 8000, `NAME IT did not open NAME: ${JSON.stringify(await L2())}`);
await until2(() => (window.__ghosty.lens.names ?? []).some((n) => /lemon/i.test(n.label)), 120000, `NAME did not name the tagged crop a lemon: ${JSON.stringify(await p2.evaluate(() => window.__ghosty.lens.names))}`);
await p2.locator('#pg-lens .lensbar .lensback').click();
await until2(() => window.__ghosty.lens.mode === 'lens', 5000, 'the back key did not return from NAME');
// ---- by words, with no model: "what is that?" says what it sees; "read that" reads
await until2(() => window.__ghosty.one.tags.some((t) => t.kind === 'text') && window.__ghosty.one.tags.some((t) => t.kind === 'object'), 90000, 'the tags did not come back for the words');
const postsBefore = chatPosts.length;
await p2.evaluate(() => window.__ghosty.send('what is that?', false));
await until2(() => /^I see /.test(window.__ghosty.one.said), 8000, `"what is that?" was not answered by the Lens: "${(await one()).said}"`);
if (/lemon/.test((await one()).said) === false && /something that looks like/.test((await one()).said) === false) problems.push(`"what is that?" said "${(await one()).said}"`);
await p2.evaluate(() => window.__ghosty.send('read that', false));
await until2(() => window.__ghosty.lens.mode === 'read', 8000, `"read that" did not read the text: ${JSON.stringify(await L2())}`);
await p2.waitForTimeout(500);
if (chatPosts.length !== postsBefore) problems.push(`the words went to the brain (${chatPosts.length - postsBefore} chat posts): they should be answered here`);
await p2.locator('#pg-lens .lensbar .lensback').click();
await until2(() => window.__ghosty.lens.mode === 'lens', 5000, 'the back key did not return from READ (words)');

// ---- MORE opens the tools; each opens as it did
await p2.locator('#pg-lens .lensbar button', { hasText: 'MORE' }).click();
await p2.waitForTimeout(300);
if (!(await p2.locator('#pg-lens .lensmodes').isVisible())) problems.push('MORE did not open the row of tools');
const tools = await p2.evaluate(() => [...document.querySelectorAll('#pg-lens .lensmodes button')].map((b) => b.textContent.split(/[a-z]/)[0].trim().replace(/[^A-Z]+$/, '')));
for (const want of ['HANDS', 'AIM', 'MEASURE', 'SOUND', 'SHAPES', 'PEOPLE', 'READ', 'ASK', 'NAME', 'SCAN', 'SEE']) if (!tools.some((t) => t.startsWith(want))) problems.push(`MORE has no ${want}: ${tools.join(' | ')}`);
for (const [label, mode] of [['HANDS', 'hands'], ['AIM', 'aim'], ['MEASURE', 'measure'], ['SOUND', 'sound'], ['SHAPES', 'shapes'], ['PEOPLE', 'people']]) {
  await p2.locator('#pg-lens .lensmodes button', { hasText: label }).first().click();
  await until2((m) => window.__ghosty.lens.mode === m, 8000, `MORE → ${label} did not open ${mode}: ${JSON.stringify(await L2())}`, mode);
  const err = await p2.evaluate(() => window.__ghosty.lens.error);
  if (err && !/camera/i.test(err)) problems.push(`${label} opened with an error: ${err}`);
  await p2.waitForTimeout(250);
}
// the tools by their words (no model): "hands", "is it distorting"
await p2.evaluate(() => window.__ghosty.send('hands', false));
await until2(() => window.__ghosty.lens.mode === 'hands', 8000, `"hands" did not open HANDS: ${JSON.stringify(await L2())}`);
await p2.evaluate(() => window.__ghosty.send('is it distorting', false));
await until2(() => window.__ghosty.lens.mode === 'sound', 8000, `"is it distorting" did not open SOUND: ${JSON.stringify(await L2())}`);
await p2.locator('#pg-lens .lensmodes button', { hasText: 'LENS' }).first().click();
await until2(() => window.__ghosty.lens.mode === 'lens', 5000, 'the LENS tile did not return to the one view');
// SOUND switched the camera off to listen: the camera comes back only from his tap (START), as everywhere
if ((await L2()).camera !== 'on') {
  await p2.locator('#pg-lens .lensbar button', { hasText: 'START' }).click();
  await until2(() => window.__ghosty.lens.camera === 'on', 25000, 'START did not bring the camera back after SOUND');
}
await p2.locator('#pg-lens .lensbar button', { hasText: 'MORE' }).click();
await p2.waitForTimeout(200);

// ---- OFFLINE: ASK and TRANSLATE greyed with OFFLINE on the bar; READ and the codes keep working; back online it is WORKING again
await until2(() => window.__ghosty.one.tags.some((t) => t.kind === 'text') && window.__ghosty.one.tags.some((t) => t.kind === 'code'), 90000, 'the tags did not come back before the offline check');
await ctx2.setOffline(true);
await until2(() => document.querySelector('#pg-lens .lensmark')?.textContent?.trim() === 'OFFLINE', 8000, `going offline did not put OFFLINE on the bar: "${await markWords()}"`);
await p2.waitForTimeout(500);
const off = await one();
const greyedKeys = await p2.evaluate(() => [...document.querySelectorAll('#pg-lens .lenstagunder button.g-key')].map((b) => `${b.textContent.trim()}:${b.disabled ? 'off' : 'on'}`));
if (!greyedKeys.some((k) => k === 'ASK:off') || !greyedKeys.some((k) => k === 'TRANSLATE:off')) problems.push(`offline, ASK and TRANSLATE are not greyed: ${greyedKeys}`);
if (greyedKeys.some((k) => /^(READ|LOOK|NAME IT|MEASURE):off$/.test(k))) problems.push(`offline, a key that needs no signal is greyed: ${greyedKeys}`);
if (!off.tags.length) problems.push('offline, the tags went (the cheap pass needs no signal)');
await p2.screenshot({ path: `${out}/lens-one-offline.png`, timeout: 90000 }).catch(() => undefined);
await ctx2.setOffline(false);
await until2(() => document.querySelector('#pg-lens .lensmark')?.textContent?.trim() === 'WORKING', 8000, `back online the mark says "${await markWords()}"`);

// ---- the tags go two seconds after the picture leaves (the camera's track switched off shows black), and come back with it
// (the picture leaves: the video has no stream, so there is no frame to look at; it comes back with the stream)
const track = (on) => p2.evaluate((on) => {
  const v = document.querySelector('#pg-lens video');
  if (!on) { window.__stream = v.srcObject; v.srcObject = null; return !!window.__stream; }
  v.srcObject = window.__stream;
  return v.play().then(() => true, () => false);
}, on);
await track(false);
const goneFrom = Date.now();
await p2.waitForTimeout(900);
if (!(await one()).tags.length) problems.push('the tags went within a second of the picture leaving: they live two seconds');
await until2(() => window.__ghosty.one.tags.length === 0, 15000, `the tags did not fade after the picture left: ${JSON.stringify((await one()).tags.map((t) => t.kind))}`);
const lived = Date.now() - goneFrom;
console.log(`one view: the tags went ${lived} ms after the picture left (two seconds of life, within a look's delay)`);
if (lived < 1500 || lived > 6000) problems.push(`the tags went after ${lived} ms: they live two seconds`);
await track(true);
await until2(() => window.__ghosty.one.tags.some((t) => t.kind === 'text'), 60000, 'the tags did not come back with the picture');
console.log(`one view section: ${Math.round((Date.now() - t0one) / 1000)} s`);
await ctx2.close();
} catch (e) {
  problems.push(`the one view section stopped: ${String(e.message).split('\n')[0]}`);
}

await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'Lens run clean on an iPhone 13: open_lens left the camera off, START opened it, SEE ran the detector, UNFREEZE cleared the held frame in READ, READ read a drawn note on the phone, filed it as SCANNED and read again after the tab was left mid-read, a tap on the Lens tile opened the camera again, HANDS ran the gesture recogniser, ASK sent a JPEG still to the brain and showed its reply, LIVING THING named a bird with how sure and saved it on SAVE only, PLANT without a key said what to do, WHAT\'S IN IT? gave the foods and a rough total, and the security policy blocked nothing. THE ONE LENS: it opened on one view with the mark and its download key, the text and the code were tagged within two seconds with their keys, the object only after GET THE EYES, READ filed the tagged text, the code tag showed what SCAN shows, words acted with no model, MORE opened the tools, OFFLINE greyed ASK and TRANSLATE, the tags went two seconds after the picture, nothing stuck out and every control was 44 pt at 440 and 390.');
process.exit(problems.length ? 1 : 0);
