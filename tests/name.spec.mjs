// The Lens's NAME mode on an iPhone 13: the namer (MobileCLIP-S0's picture encoder under ONNX
// Runtime WebAssembly, the 4,624 core names) loads from /vendor/clip with the camera still off, a
// picked photo of a lemon (tests/fixtures/lemon.jpg, CC0, Evan-Amos on Wikimedia Commons) is named
// "lemon" first, a tap on that name offers SEARCH THE WEB (words only to the brain) and ASK GHOSTY
// (the picture plus the names as the phone's guesses in `seen`), the live fake camera is named too,
// and the security policy lets the vendored runtime and its WebAssembly run. The runtime runs in its
// own worker, ended on leaving NAME (the only way to give its WebAssembly memory back). The real
// model runs here: no WebGPU needed, one thread.
import { chromium } from 'playwright';
import { PHONE, UK } from './nav.mjs';
import { mkdirSync, readFileSync } from 'node:fs';

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
  if (m.type() === 'error' && !/favicon|net::ERR|404|Failed to load resource|^[WI]\d{4} |^INFO:/.test(t)) problems.push(`console: ${t.slice(0, 200)}`);
});
await page.addInitScript(() => {
  window.__csp = [];
  // every worker the page starts, and whether it was ended
  window.__workers = [];
  const W = window.Worker;
  window.Worker = class extends W {
    constructor(url, opts) {
      super(url, opts);
      const rec = { url: String(url), ended: false };
      window.__workers.push(rec);
      const end = this.terminate.bind(this);
      this.terminate = () => {
        rec.ended = true;
        end();
      };
    }
  };
  document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
});

await page.goto(base);
await page.fill('#pair input', 'preview-owner-key-0123456789');
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });

const lens = () => page.evaluate(() => {
  const s = window.__ghosty?.lens;
  return s ? { mode: s.mode, status: s.status, camera: s.camera, names: s.names, reply: s.reply, error: s.error } : null;
});
const until = (fn, ms, what) => page.waitForFunction(fn, null, { timeout: ms }).then(() => true).catch(() => { problems.push(what); return false; });

// ---- NAME: the tile is there; the namer loads with the camera off ----
await page.evaluate(() => window.__ghosty.run('open_lens', { mode: 'see' }));
await page.waitForSelector('#pg-lens', { state: 'visible', timeout: 15000 });
// the evaluate above counts as a tap, so the camera may have opened: close it, the photo is named without it
if ((await lens())?.camera !== 'off') await page.locator('#pg-lens .lensbar button').first().click();
const tile = page.locator('#pg-lens .lensmodes button', { hasText: 'NAME' });
if (!(await tile.count())) problems.push('no NAME tile in the Lens');
else await tile.click();
const t0 = Date.now();
await until(() => /namer ready/.test(window.__ghosty?.lens?.status ?? ''), 180000, `the namer never loaded: ${JSON.stringify(await lens())}`);
const loadSecs = ((Date.now() - t0) / 1000).toFixed(1);

// ---- a picked photo of a lemon is named "lemon" first ----
await page.locator('#pg-lens input[type=file]').setInputFiles({ name: 'lemon.jpg', mimeType: 'image/jpeg', buffer: readFileSync(new URL('./fixtures/lemon.jpg', import.meta.url)) });
await until(() => (window.__ghosty?.lens?.names?.length ?? 0) > 0, 120000, `the photo was never named: ${JSON.stringify(await lens())}`);
const named = await lens();
const top = named?.names?.[0];
if (top?.label !== 'lemon') problems.push(`the lemon was named ${JSON.stringify(named?.names)}`);
else if (!(top.p > 0.3)) problems.push(`"lemon" is only ${Math.round(top.p * 100)}% sure`);
if ((named?.names?.length ?? 0) !== 5) problems.push(`NAME shows ${named?.names?.length} names, not 5`);
const shown = await page.locator('#pg-lens .lensnames button').count();
if (shown !== 5) problems.push(`${shown} name buttons on screen, not 5`);
const lookMs = Number((named?.status ?? '').match(/(\d+) ms a look/)?.[1] ?? NaN);
await page.screenshot({ path: `${out}/name-photo.png`, timeout: 90000 }).catch((e) => problems.push(`screenshot: ${e.message.split('\n')[0]}`));

// ---- MORE NAMES: the extended bank (28,223 more names) loads and the photo is named again from both ----
await page.locator('#pg-lens button', { hasText: 'MORE NAMES' }).click();
await until(() => /more names/.test(window.__ghosty?.lens?.status ?? ''), 120000, `MORE NAMES never named the photo again: ${JSON.stringify(await lens())}`);
const more = await lens();
if (!/lemon/.test(more?.names?.[0]?.label ?? '')) problems.push(`with MORE NAMES the lemon was named ${JSON.stringify(more?.names)}`);
await page.locator('#pg-lens button', { hasText: 'MORE NAMES' }).click();
await until(() => !/more names/.test(window.__ghosty?.lens?.status ?? '') && window.__ghosty?.lens?.names?.[0]?.label === 'lemon', 30000, `MORE NAMES did not switch off: ${JSON.stringify(await lens())}`);

// ---- a tap on a name: SEARCH THE WEB sends words only ----
await page.locator('#pg-lens .lensnames button').first().click();
if (!(await page.locator('#pg-lens .lenssel:not(.livingcard)').isVisible())) problems.push('a tap on a name did not offer ASK GHOSTY / SEARCH THE WEB');
const searchReq = page.waitForRequest((r) => r.url().includes('/api/chat') && r.method() === 'POST', { timeout: 20000 }).catch(() => null);
await page.locator('#pg-lens button', { hasText: 'SEARCH THE WEB' }).click();
const sreq = await searchReq;
if (!sreq) problems.push('SEARCH THE WEB sent nothing to the brain');
else {
  const body = sreq.postDataJSON();
  if (body.images) problems.push('SEARCH THE WEB sent a picture');
  if (!/Search the web for "lemon"/.test(body.message ?? '')) problems.push(`SEARCH THE WEB asked: ${body.message}`);
  // the screen description Ghosty gets carries the names while NAME is showing
  if (!/closest names \(phone guesses\): lemon/.test(body.context?.screen ?? '')) problems.push(`the screen description has no names: ${String(body.context?.screen).slice(0, 200)}`);
}
await until(() => (window.__ghosty?.lens?.reply ?? '').length > 0, 30000, `SEARCH THE WEB got no reply: ${JSON.stringify(await lens())}`);

// ---- ASK GHOSTY: the picture goes with the question, the names ride along as the phone's guesses ----
const askReq = page.waitForRequest((r) => r.url().includes('/api/chat') && r.method() === 'POST', { timeout: 20000 }).catch(() => null);
await page.locator('#pg-lens .lenssel:not(.livingcard) button', { hasText: 'ASK GHOSTY' }).click();
const areq = await askReq;
if (!areq) problems.push('ASK GHOSTY from NAME sent nothing to the brain');
else {
  const body = areq.postDataJSON();
  if (!Array.isArray(body.images) || !/^data:image\/jpeg;base64,/.test(body.images[0] ?? '')) problems.push('ASK GHOSTY from NAME sent no JPEG');
  if (!/phone guesses \(name match, may be wrong\) lemon \d+%/.test(body.seen ?? '')) problems.push(`the names did not ride along in seen: ${JSON.stringify(body.seen)}`);
  if (/lemon/.test((body.message ?? '').replace(/Is it a lemon\?/, ''))) problems.push(`the guesses leaked into the question: ${body.message}`);
}
await until(() => window.__ghosty?.lens?.mode === 'ask' && /I can see a picture/.test(window.__ghosty?.lens?.reply ?? ''), 30000, `ASK from NAME got no reply: ${JSON.stringify(await lens())}`);

// ---- leaving NAME ends the namer's worker: its runtime and WebAssembly memory go with it ----
const clipWorkers = () => page.evaluate(() => window.__workers.filter((w) => /\/vendor\/clip\/worker\.mjs/.test(w.url)));
const afterLeave = await clipWorkers();
if (!afterLeave.length) problems.push('the namer did not run in its own worker');
else if (afterLeave.some((w) => !w.ended)) problems.push(`leaving NAME left the namer's worker running: ${JSON.stringify(afterLeave)}`);

// ---- live: START the camera, back to NAME, the fake camera's picture gets names (loaded again after leaving) ----
await page.locator('#pg-lens .lensbar button', { hasText: 'START' }).click();
await until(() => window.__ghosty?.lens?.camera === 'on', 20000, `the fake camera did not open: ${JSON.stringify(await lens())}`);
await page.evaluate(() => (window.__ghosty.lens.names = []));
await page.locator('#pg-lens .lensmodes button', { hasText: 'NAME' }).click();
await until(() => (window.__ghosty?.lens?.names?.length ?? 0) === 5 && /ms a look/.test(window.__ghosty?.lens?.status ?? ''), 180000, `the live picture was never named: ${JSON.stringify(await lens())}`);
// a tap on the viewfinder names just that part
// (the NAME tile sits low on a phone: bring the viewfinder back into view first, as a thumb would)
await page.locator('#pg-lens .lensview').evaluate((v) => v.scrollIntoView({ block: 'center' }));
await page.waitForTimeout(300);
const box = await page.locator('#pg-lens .lensview').boundingBox();
if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await until(() => /tapped part/.test(document.querySelector('#pg-lens .lenscount')?.textContent ?? ''), 10000, 'a tap on the viewfinder did not name the tapped part');
const again = await clipWorkers();
if (again.filter((w) => !w.ended).length !== 1) problems.push(`back in NAME, ${again.filter((w) => !w.ended).length} namer workers are running, not 1`);
await page.screenshot({ path: `${out}/name-live.png`, timeout: 90000 }).catch((e) => problems.push(`screenshot: ${e.message.split('\n')[0]}`));

const csp = await page.evaluate(() => window.__csp);
if (csp.length) problems.push(`security policy blocked: ${csp.join(' | ')}`);
const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
if (wide) problems.push('the Lens is wider than the phone screen');

await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : `NAME run clean on an iPhone 13: the namer loaded in ${loadSecs} s (${Number.isFinite(lookMs) ? `${lookMs} ms a look` : 'look time not shown'}), named the lemon photo "lemon" ${Math.round((top?.p ?? 0) * 100)}% (and with MORE NAMES too), SEARCH THE WEB sent words only, ASK GHOSTY sent the picture with the names as phone guesses, the live camera was named and a tap named the tapped part, and the security policy blocked nothing.`);
process.exit(problems.length ? 1 : 0);
