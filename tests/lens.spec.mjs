// The Lens on an iPhone 13: the brain's open_lens opens the tab but not the camera, START (a tap)
// opens it (a fake one here), SEE loads the detector and runs, UNFREEZE in READ clears the held
// frame, READ reads a drawn line of text on the phone and files it in the library and still works
// after the tab was left mid-read, a tap on the Lens tile opens the camera again, HANDS loads the
// gesture recogniser, ASK sends a still to the brain and shows its reply (the mock model answers
// "I can see a picture"), and the security policy lets the vendored WebAssembly run.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const problems = [];
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
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

// ---- SEE: START (a tap) opens the camera and the detector runs on the live picture ----
await page.locator('#pg-lens .lensbar button', { hasText: 'START' }).click();
await until(() => window.__ghosty?.lens?.camera === 'on', 20000, `the fake camera did not open from START: ${JSON.stringify(await lens())}`);
// swiftshader runs the detector slowly; one run is enough to show it loaded and works
await until(() => window.__ghosty?.lens?.fps > 0 || window.__ghosty?.lens?.scene?.length > 0, 90000, `SEE never ran the detector: ${JSON.stringify(await lens())}`);
const see = await lens();
if (see?.error) problems.push(`SEE error: ${see.error}`);
// the status line settles from "loading … / starting …" to "live", "frozen" or the rate ("1.0 fps · 2697 ms a look")
await until(() => !/loading|starting|opening/i.test(window.__ghosty?.lens?.status ?? ''), 60000, `SEE status never settled: "${(await lens())?.status}"`);
const seeStatus = (await lens())?.status ?? '';
if (!/live|frozen|fps/.test(seeStatus)) problems.push(`SEE status is "${seeStatus}"`);

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
await page.click('#top .logo');
await page.waitForSelector('#deck.on', { timeout: 3000 }).catch(() => problems.push('the systems deck did not open from the logo'));
await page.click('#deck .dtile[data-id="lens"]');
await until(() => window.__ghosty?.lens?.camera === 'on', 20000, `a tap on the Lens tile did not open the camera again: ${JSON.stringify(await lens())}`);
if ((await lens())?.mode !== 'read') problems.push(`the Lens came back in ${(await lens())?.mode}, not READ`);
await page.evaluate(() => (window.__ghosty.lens.ocrText = ''));
await pickPhoto(await drawn('LENS READS AGAIN', 'after the tab was left'));
await until(() => /LENS READS AGAIN/i.test(window.__ghosty?.lens?.ocrText ?? ''), 120000, `READ did not work again after the Lens was left mid-read: ${JSON.stringify(await lens())}`);

// ---- HANDS: the gesture recogniser loads and runs (the fake camera shows no hand) ----
await page.evaluate(() => window.__ghosty.lens.setMode('hands'));
await until(() => window.__ghosty?.lens?.mode === 'hands' && window.__ghosty?.lens?.fps > 0, 90000, `HANDS never ran the recogniser: ${JSON.stringify(await lens())}`);
const hands = await lens();
if (hands?.error) problems.push(`HANDS error: ${hands.error}`);

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

// ---- the security policy: WebAssembly and the camera were allowed, nothing was blocked ----
const csp = await page.evaluate(() => window.__csp);
if (csp.length) problems.push(`security policy blocked: ${csp.join(' | ')}`);
// phone layout: nothing sticks out sideways
const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
if (wide) problems.push('the Lens is wider than the phone screen');

await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'Lens run clean on an iPhone 13: open_lens left the camera off, START opened it, SEE ran the detector, UNFREEZE cleared the held frame in READ, READ read a drawn note on the phone, filed it as SCANNED and read again after the tab was left mid-read, a tap on the Lens tile opened the camera again, HANDS ran the gesture recogniser, ASK sent a JPEG still to the brain and showed its reply, and the security policy blocked nothing.');
process.exit(problems.length ? 1 : 0);
