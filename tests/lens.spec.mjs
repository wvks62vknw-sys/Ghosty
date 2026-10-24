// The Lens on an iPhone 13: the brain's open_lens opens the tab but not the camera, START (a tap)
// opens it (a fake one here), SEE loads the detector and runs, UNFREEZE in READ clears the held
// frame, READ reads a drawn line of text on the phone and files it in the library and still works
// after the tab was left mid-read, a tap on the Lens tile opens the camera again, HANDS loads the
// gesture recogniser, ASK sends a still to the brain and shows its reply (the mock model answers
// "I can see a picture"), NAME's LIVING THING and ASK's WHAT'S IN IT? make their cards (the mock model's
// robin and plate of fish and chips; PLANT with no Pl@ntNet key), and the security policy lets the vendored WebAssembly run.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { PHONE, UK, openDeck } from './nav.mjs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
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

await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'Lens run clean on an iPhone 13: open_lens left the camera off, START opened it, SEE ran the detector, UNFREEZE cleared the held frame in READ, READ read a drawn note on the phone, filed it as SCANNED and read again after the tab was left mid-read, a tap on the Lens tile opened the camera again, HANDS ran the gesture recogniser, ASK sent a JPEG still to the brain and showed its reply, LIVING THING named a bird with how sure and saved it on SAVE only, PLANT without a key said what to do, WHAT\'S IN IT? gave the foods and a rough total, and the security policy blocked nothing.');
process.exit(problems.length ? 1 : 0);
