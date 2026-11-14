// PHOTO TOOLS on an iPhone (440 × 956), with the real brain and its Hugging Face Spaces answered from their real
// answers (tests/fixtures/photo-spaces.mjs in the preview server): a photo taken in the Lens (the fake camera,
// FREEZE) shows the PHOTO TOOLS chip; the sheet opens with BACKGROUND / SHARPER / ERASE; REMOVE THE
// BACKGROUND goes through BiRefNet's real free-limit answer to BRIA RMBG-1.4 and says so; the result comes back
// from the picture store (/i/<id>) and BEFORE ↔ AFTER moves with the slider; SAVE TO PHOTOS downloads the very
// picture kept; ERASE takes a finger-drawn mask (a PNG of the photo's own size, white where drawn — checked in the
// request and by the Space); a Space asleep is said with "try again in a minute"; with the free online tools asleep
// BACKGROUND offers CUT IT OUT ON THIS PHONE (with no pack kept: the download named with its size, nothing fetched, the
// photo editor's BRAIN tray offering it) and SHARPER says it must wait; with no brain every job says
// "needs the brain"; ASK with "remove the background" opens the sheet on that job; the brain's open_photo_tools
// opens it on a kept picture with its result. The security policy blocks nothing and nothing sticks out sideways.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { PHONE, UK } from './nav.mjs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const fx = JSON.parse(readFileSync(new URL('../apps/edge/test/photo.fixture.json', import.meta.url), 'utf8'));
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
  acceptDownloads: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  permissions: ['camera'],
});
const page = await ctx.newPage();
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' && !/favicon|net::ERR|404|Failed to load resource|^[WI]\d{4} |^INFO:/.test(t)) problems.push(`console: ${t.slice(0, 200)}`);
});
await page.addInitScript(() => {
  window.__csp = [];
  document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
});
// Every photo the sheet posts, its form's parts as bytes (Playwright shows no body for a form holding files).
await page.addInitScript(() => {
  window.__photoPosts = [];
  const f = window.fetch;
  window.fetch = (u, o) => {
    if (String(u).endsWith('/api/m3d/photo') && o?.body instanceof FormData) {
      const post = {};
      window.__photoPosts.push(post);
      for (const [k, v] of o.body.entries()) {
        if (typeof v === 'string') post[k] = v;
        else void v.arrayBuffer().then((b) => (post[k] = [...new Uint8Array(b)]));
      }
    }
    return f(u, o);
  };
});
/** A picture's type and size from its header (PNG, JPEG). */
function sizeOf(b) {
  if (b[0] === 0x89 && b[1] === 0x50) return { type: 'png', w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length && b[i] === 0xff) {
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { type: 'jpeg', w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}
const mode = (q) => fetch(`${base}/__test/photo-mode?${q}`).then((r) => r.json());
const photo = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__ghosty?.photo ?? null)));
const until = (fn, ms, what) => page.waitForFunction(fn, null, { timeout: ms }).then(() => true).catch(async () => { problems.push(`${what}: ${JSON.stringify(await photo())}`); return false; });
const shot = (name) => page.screenshot({ path: `${out}/${name}.png`, timeout: 90000 }).catch((e) => problems.push(`screenshot ${name}: ${e.message.split('\n')[0]}`));
const sideways = async (where) => {
  const w = await page.evaluate(() => document.scrollingElement.scrollWidth);
  if (w > PHONE.width) problems.push(`${where}: the page is ${w} px wide (sticks out sideways)`);
};

await mode('reset=1');
await page.goto(base);
await page.fill('#pair input', 'preview-owner-key-0123456789');
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });

// ---- the Lens: a photo taken (the fake camera, FREEZE) brings the PHOTO TOOLS chip ----
await page.evaluate(() => window.__ghosty.run('open_lens', { mode: 'ask' }));
await page.waitForSelector('#pg-lens', { state: 'visible', timeout: 15000 });
const chip = page.locator('#pg-lens .lensbar button', { hasText: 'PHOTO TOOLS' });
if (await chip.isVisible()) problems.push('the PHOTO TOOLS chip shows before there is a photo');
// (an evaluate counts as a tap, so open_lens may open the camera by itself here; START only when it did not)
await page.waitForTimeout(1500);
if ((await page.evaluate(() => window.__ghosty.lens.camera)) === 'off') await page.locator('#pg-lens .lensbar button', { hasText: 'START' }).click();
await page.waitForFunction(() => window.__ghosty?.lens?.camera === 'on', null, { timeout: 30000 }).catch(() => problems.push('the fake camera did not open'));
await page.waitForTimeout(800);
await page.locator('#pg-lens .lensbar button', { hasText: 'FREEZE' }).click();
await chip.waitFor({ state: 'visible', timeout: 5000 }).catch(() => problems.push('no PHOTO TOOLS chip once a photo was taken'));
await shot('photo-chip');
await chip.click();
// the chip lands in the photo editor (BRIEF-EDITOR-PHOTO) on its BRAIN group; the BACKGROUND key opens the sheet below, as the chip did
await page.waitForSelector('#pg-photo .pe:not([hidden]) .pebrain[data-job="background"]', { timeout: 30000 }).catch(() => problems.push('the PHOTO TOOLS chip did not land on the editor\'s BRAIN keys'));
await page.locator('#pg-photo .pebrain[data-job="background"]').click();

// ---- the sheet: three jobs; REMOVE THE BACKGROUND through BiRefNet's limit to BRIA RMBG-1.4 ----
const sheet = page.locator('.modal .ptsheet');
await sheet.waitFor({ state: 'visible', timeout: 5000 }).catch(() => problems.push('the PHOTO TOOLS sheet did not open'));
const chips = (await page.locator('.ptjobs button').allTextContents()).join(' | ');
if (chips !== 'BACKGROUND | SHARPER | ERASE') problems.push(`the jobs read "${chips}"`);
const size = (await photo())?.size;
if (!size || Math.max(size.w, size.h) > 1024) problems.push(`the photo in the sheet is ${JSON.stringify(size)} (1024 px at most)`);
await page.locator('.ptsheet button', { hasText: 'REMOVE THE BACKGROUND' }).click();
await until(() => window.__ghosty.photo.phase === 'done' || window.__ghosty.photo.phase === 'failed', 60000, 'REMOVE THE BACKGROUND never finished');
let s = await photo();
if (s.phase !== 'done') problems.push(`the background job: ${s.phase} "${s.status}"`);
if (!s.steps.some((l) => /^BiRefNet is over its free limit for now .* — trying BRIA RMBG-1\.4 on a free computer instead…$/.test(l))) problems.push(`BiRefNet's limit was not said in plain words: ${JSON.stringify(s.steps)}`);
if (!s.steps.some((l) => /^removing the background/.test(l))) problems.push(`no progress words: ${JSON.stringify(s.steps)}`);
if (s.by !== 'BRIA RMBG-1.4' || !/^\/i\/[A-Za-z0-9_-]{16}$/.test(s.result)) problems.push(`the result: ${JSON.stringify(s)}`);
const firstResult = s.result;
// the picture store has it, for 10 years, as the very PNG the Space made
const kept = await page.evaluate(async (u) => {
  const r = await fetch(u);
  return { status: r.status, type: r.headers.get('content-type'), bytes: [...new Uint8Array(await r.arrayBuffer())] };
}, s.result);
if (kept.status !== 200 || kept.type !== 'image/png' || !Buffer.from(kept.bytes).equals(Buffer.from(fx.rmbg.png, 'base64'))) problems.push(`the kept result: ${kept.status} ${kept.type}`);
if (!(await page.locator('.ptsheet .ptcredit').textContent())?.includes('Kept for 10 years')) problems.push('the sheet does not say how long it is kept');
const loaded = await page.evaluate(() => document.querySelector('.ptafter')?.complete && document.querySelector('.ptafter').naturalWidth > 0);
if (!loaded) problems.push('the AFTER picture did not show');

// ---- the slider: all BEFORE, all AFTER, in between ----
const clip = () => page.evaluate(() => getComputedStyle(document.querySelector('.ptafter')).clipPath);
const slider = page.locator('.ptslider');
await slider.focus();
await page.keyboard.press('Home');
if ((await photo()).slider !== 0 || !/inset\(0(px)? 100% 0(px)? 0(px)?\)/.test(await clip())) problems.push(`slider at BEFORE: ${(await photo()).slider} ${await clip()}`);
await page.keyboard.press('End');
if ((await photo()).slider !== 100 || !/inset\(0(px)?( 0%)?( 0(px)?)?( 0(px)?)?\)|inset\(0px\)/.test(await clip())) problems.push(`slider at AFTER: ${(await photo()).slider} ${await clip()}`);
const box = await slider.boundingBox();
await page.mouse.click(box.x + box.width * 0.3, box.y + box.height / 2);
s = await photo();
if (s.slider < 15 || s.slider > 45) problems.push(`a tap at 30 % of the slider set it to ${s.slider}`);
await slider.evaluate((el) => {
  el.value = '50';
  el.dispatchEvent(new Event('input'));
});
await shot('photo-slider');
await sideways('the sheet with a result');

// ---- SAVE TO PHOTOS: the kept picture itself, downloaded ----
const [download] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }).catch(() => null), page.locator('.ptsheet button', { hasText: 'SAVE TO PHOTOS' }).click()]);
if (!download) problems.push('SAVE TO PHOTOS downloaded nothing');
else {
  const name = download.suggestedFilename();
  if (!/^ghosty-background-[A-Za-z0-9_-]{8}\.png$/.test(name)) problems.push(`the download is called "${name}"`);
  const path = await download.path();
  if (!readFileSync(path).equals(Buffer.from(fx.rmbg.png, 'base64'))) problems.push('the download is not the picture kept');
}
if (!(await page.locator('.ptsheet button', { hasText: 'SHARE' }).isVisible())) problems.push('no SHARE');

// ---- ERASE: a finger-drawn mask, a PNG of the photo's own size, white where drawn ----
await page.locator('.ptjobs button', { hasText: 'ERASE' }).click();
const eraseBtn = page.locator('.ptsheet button', { hasText: 'ERASE IT' });
if (!(await eraseBtn.isDisabled())) problems.push('ERASE IT can be pressed before anything is drawn');
const ink = await page.locator('.ptink').boundingBox();
await page.mouse.move(ink.x + ink.width * 0.35, ink.y + ink.height * 0.4);
await page.mouse.down();
for (let i = 1; i <= 8; i++) await page.mouse.move(ink.x + ink.width * (0.35 + i * 0.03), ink.y + ink.height * (0.4 + i * 0.02));
await page.mouse.up();
if ((await photo()).strokes !== 1) problems.push(`one stroke drawn, the sheet counts ${(await photo()).strokes}`);
await shot('photo-mask');
await page.evaluate(() => (window.__photoPosts.length = 0));
await eraseBtn.click();
await until(() => ['done', 'failed'].includes(window.__ghosty.photo.phase), 60000, 'ERASE IT never finished');
s = await photo();
if (s.phase !== 'done' || s.by !== 'LaMa (IOPaint)') problems.push(`erase: ${s.phase} "${s.status}" by ${s.by}`);
const sent = (await page.evaluate(() => window.__photoPosts[0])) ?? {};
const pic = sent.picture ? sizeOf(Buffer.from(sent.picture)) : null;
const mask = sent.mask ? sizeOf(Buffer.from(sent.mask)) : null;
if (sent.job !== 'erase' || pic?.type !== 'jpeg' || mask?.type !== 'png' || mask.w !== pic.w || mask.h !== pic.h) problems.push(`the erase request: job ${sent.job}, photo ${JSON.stringify(pic)}, mask ${JSON.stringify(mask)}`);
if (!s.mask || s.mask.w !== pic?.w || s.mask.white <= 0.002 || s.mask.white > 0.5) problems.push(`the mask drawn: ${JSON.stringify(s.mask)}`);
const seen = (await mode('')).lastErase;
if (!seen?.mask || seen.mask.w !== seen.image?.w || seen.mask.h !== seen.image?.h) problems.push(`the eraser Space was sent ${JSON.stringify(seen)}`);
await shot('photo-erased');

// ---- a Space asleep: said, with "try again in a minute" ----
await mode('esrgan=asleep');
await page.locator('.ptjobs button', { hasText: 'SHARPER' }).click();
await page.locator('.ptsheet button', { hasText: 'MAKE IT SHARPER' }).click();
await until(() => ['done', 'failed'].includes(window.__ghosty.photo.phase), 60000, 'MAKE IT SHARPER never finished');
s = await photo();
if (s.phase !== 'failed' || s.code !== 'asleep' || s.status !== 'Not done: Real-ESRGAN is asleep (free Spaces sleep when nobody uses them) and is waking up — try again in a minute.') problems.push(`asleep: ${s.phase} ${s.code} "${s.status}"`);
await shot('photo-asleep');
await mode('reset=1');
await page.locator('.ptsheet button', { hasText: 'MAKE IT SHARPER' }).click();
await until(() => ['done', 'failed'].includes(window.__ghosty.photo.phase), 60000, 'MAKE IT SHARPER (awake) never finished');
s = await photo();
if (s.phase !== 'done' || s.by !== 'Real-ESRGAN') problems.push(`sharper: ${s.phase} "${s.status}" by ${s.by}`);

// ---- the free online tools asleep (every POST answered 'asleep'): BACKGROUND offers CUT IT OUT ON THIS PHONE; with no pack kept here
// it names the download and its size and fetches nothing; OPEN THE PHOTO EDITOR lands on its BRAIN tray, where GET offers it; SHARPER
// says it must wait ----
const models = [];
const onModel = (q) => /\/vendor\/(cutout|depth|erase|raw)\//.test(q.url()) && models.push(q.url());
page.on('request', onModel);
await page.route('**/api/m3d/photo', (r) => r.fulfill({ status: 200, contentType: 'application/x-ndjson', body: `${JSON.stringify({ error: 'the free Space is asleep and is waking up — try again in a minute', code: 'asleep' })}\n` }));
await page.locator('.ptjobs button', { hasText: 'BACKGROUND' }).click();
await page.locator('.ptsheet button', { hasText: 'REMOVE THE BACKGROUND' }).click();
await until(() => window.__ghosty.photo.phase === 'failed', 30000, 'BACKGROUND (asleep) did not fail');
const cutKey = page.locator('.ptfallback button', { hasText: 'CUT IT OUT ON THIS PHONE' });
s = await photo();
if (s.code !== 'asleep' || s.fallback !== 'offered' || !(await cutKey.isVisible()) || ((await cutKey.boundingBox())?.height ?? 0) < 44) problems.push(`BACKGROUND asleep: ${s.code} ${s.fallback} "${s.fallbackWords}", the key ${JSON.stringify(await cutKey.boundingBox())}`);
await cutKey.click();
await until(() => !['offered', 'working'].includes(window.__ghosty.photo.fallback), 15000, 'CUT IT OUT ON THIS PHONE never answered');
s = await photo();
if (s.fallback !== 'needs-pack' || !/the cut-out model kept here \(\d+ MB\)\. It comes only when you tap GET, on Wi-Fi/.test(s.fallbackWords)) problems.push(`no pack kept: ${s.fallback} "${s.fallbackWords}"`);
await shot('photo-cut-here');
const toEditor = page.locator('.ptfallback button', { hasText: 'OPEN THE PHOTO EDITOR' });
if (((await toEditor.boundingBox())?.height ?? 0) < 44) problems.push('OPEN THE PHOTO EDITOR is not there, or under 44 pt');
await toEditor.click();
await page.waitForSelector('#pg-photo .pe:not([hidden]) .pecutoffer .pepack[data-pack="cutout"]', { timeout: 15000 }).catch(() => problems.push('OPEN THE PHOTO EDITOR did not land on a BRAIN tray offering the cut-out model'));
if (await sheet.isVisible()) problems.push('the sheet stayed open over the photo editor');
if (models.length) problems.push(`a model was fetched without his tap: ${models.join(', ')}`);
await page.locator('#pg-photo .pebrain[data-job="sharper"]').click();
await sheet.waitFor({ state: 'visible', timeout: 15000 }).catch(() => problems.push('the BRAIN tray did not open the sheet again'));
await page.locator('.ptsheet button', { hasText: 'MAKE IT SHARPER' }).click();
await until(() => window.__ghosty.photo.phase === 'failed', 30000, 'SHARPER (asleep) did not fail');
s = await photo();
if (s.fallback !== 'wait' || !/^SHARPER and ERASE must wait: .*free online tools.* asleep or over their free limit right now\. Try again in a minute\.$/.test(s.fallbackWords) || !/^Not done: /.test(s.status) || (await cutKey.isVisible())) problems.push(`SHARPER asleep: ${s.fallback} "${s.fallbackWords}" "${s.status}"`);
await page.unroute('**/api/m3d/photo');
page.off('request', onModel);

// ---- no brain: each job says it needs the brain, and nothing can be pressed ----
await page.evaluate(() => window.__ghosty.ui.set({ connected: false }));
await page.locator('.ptjobs button', { hasText: 'BACKGROUND' }).click();
const who = (await page.locator('.ptsheet .ptwho').textContent()) ?? '';
if (!/^I need my brain for /.test(who) || !(await page.locator('.ptsheet button', { hasText: 'REMOVE THE BACKGROUND' }).isDisabled())) problems.push(`offline: "${who}"`);
if ((await photo()).fallback !== 'offered' || !(await page.locator('.ptfallback button', { hasText: 'CUT IT OUT ON THIS PHONE' }).isVisible())) problems.push(`offline: BACKGROUND does not offer the cut on this phone (${(await photo()).fallback})`);
await shot('photo-offline');
await page.evaluate(() => window.__ghosty.ui.set({ connected: true }));
await page.locator('.modal .mhead button', { hasText: 'CLOSE' }).click();

// ---- ASK "remove the background" opens the sheet on that job ----
// (the chip took him into the photo editor: back to the Lens, and a photo taken again)
await page.evaluate(() => window.__ghosty.run('open_lens', { mode: 'ask' }));
await page.waitForSelector('#pg-lens', { state: 'visible', timeout: 15000 });
await page.waitForTimeout(1500);
if ((await page.evaluate(() => window.__ghosty.lens.camera)) === 'off') await page.locator('#pg-lens .lensbar button', { hasText: 'START' }).click();
await page.waitForFunction(() => window.__ghosty?.lens?.camera === 'on', null, { timeout: 30000 }).catch(() => problems.push('the fake camera did not open again'));
await page.waitForTimeout(800);
if (await page.locator('#pg-lens .lensbar button', { hasText: 'FREEZE' }).isVisible()) await page.locator('#pg-lens .lensbar button', { hasText: 'FREEZE' }).click();
await page.locator('#pg-lens textarea.lensq').fill('remove the background please');
await page.locator('#pg-lens button', { hasText: 'ASK GHOSTY' }).click();
await sheet.waitFor({ state: 'visible', timeout: 5000 }).catch(() => problems.push('ASK "remove the background" did not open PHOTO TOOLS'));
s = await photo();
if (s.job !== 'background' || !s.size) problems.push(`ASK opened the sheet on ${s.job} with ${JSON.stringify(s.size)}`);
await page.locator('.modal .mhead button', { hasText: 'CLOSE' }).click();

// ---- the brain's open_photo_tools: a kept picture with its result, BEFORE and AFTER at once ----
await page.evaluate((r) => window.__ghosty.run('open_photo_tools', { job: 'sharper', picture: r, result: r, by: 'Real-ESRGAN' }), firstResult);
await until(() => window.__ghosty.photo.phase === 'done', 15000, 'open_photo_tools did not show the result');
if ((await photo()).job !== 'sharper') problems.push('open_photo_tools did not open on its job');
await shot('photo-from-chat');
await sideways('the sheet from the chat');

const csp = await page.evaluate(() => window.__csp);
if (csp.length) problems.push(`security policy blocked: ${csp.join(', ')}`);
await browser.close();
if (problems.length) {
  console.log(`PHOTO SPEC: ${problems.length} problem(s)\n${problems.map((p) => `- ${p}`).join('\n')}`);
  process.exit(1);
}
console.log('PHOTO SPEC: all good');
