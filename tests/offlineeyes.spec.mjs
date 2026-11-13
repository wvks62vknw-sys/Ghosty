// OFFLINE EYES (BRIEF-OFFLINE-1): the Lens's on-device models kept on the phone on his tap, in a real browser at 440 × 956 and 390 × 844,
// in all three worlds (The Scan, Glass, ONE INK). Nothing is downloaded from anywhere: the pack's files are this site's own /vendor, and
// every address of a pack's GET is answered by a route here (from the repository's own files, or cut short on purpose); the preview
// stands in for the site. The service worker is ON (the Lens loads its runtime and models through it), and the offline part is the
// browser's own offline mode: the app is reloaded with no network at all, so only what the service worker and the packs hold can load.
//  1. the pins in offline/eyes.ts are held to the files on disk (every byte count), and the seven packs (the Lens’s four and PHOTO 2’s three) add up to what is said;
//  2. SETTINGS → OFFLINE EYES: seven packs offered, each with its size said ("Get · 47 MB"), its licence, "on Wi-Fi"; the panel says what
//     cannot run on the phone (ASK, plant, bird and insect names, a meal's contents); nothing was fetched by looking;
//  3. MOBILE DATA: a tap fetches nothing and says it waits for Wi-Fi; Wi-Fi comes and it starts by itself;
//  4. THE LENS'S EYES: a file that comes back the wrong size stops it ("came back the wrong size... carries on from there"), GET again
//     fetches only what is missing, and the pack is kept in ghosty-eyes-v1 ("<name>, <month>, <size> on your phone"); the Lens's own
//     step (GET THE EYES) is marked as started on this phone;
//  5. NO SIGNAL (navigator.onLine false, every address that reaches the network refused and counted): the Lens opens, the object finder
//     loads from the pack by itself and says ready, and not one of the pack's files was asked of the network; the GET THE EYES key is
//     live offline when its files are here and dead when they are not; a model loaded through the loader's own path comes from the pack;
//  6. DELETE: the UNDO bar holds it back; UNDO keeps it; DELETE again and the files are gone from the cache and the offer is back;
//  7. the shared files: deleting one pack keeps what another still needs;
//  8. every world at 440 and 390: nothing sideways, every key 44 pt, no page errors, nothing blocked by the security policy.
//   BASE=http://localhost:8800 node tests/offlineeyes.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, openPanel } from './nav.mjs';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const SMALL = { width: 390, height: 844 };
const problems = [];
const check = (ok, what) => ok || problems.push(what);
const notes = [];
process.on('exit', (c) => c && problems.length && console.error(`problems so far:\n- ${problems.join('\n- ')}`));

// ---- the pins, bundled from the source and held to the files
const esbuild = createRequire(join(root, 'apps/web/package.json'))('esbuild');
const tmp = mkdtempSync(join(tmpdir(), 'offlineeyes-'));
esbuild.buildSync({ entryPoints: [join(root, 'apps/web/src/offline/eyesfiles.ts')], bundle: true, format: 'esm', outfile: join(tmp, 'eyesfiles.mjs'), logLevel: 'warning' });
const F = await import(join(tmp, 'eyesfiles.mjs'));
const PUBLIC = join(root, 'apps/web/public');
const sizeWords = (b) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b >= 1e6 ? `${Math.round(b / 1e6)} MB` : `${Math.max(1, Math.round(b / 1000))} KB`);
const PACKS = {
  'eyes-lens': [F.RUNTIME, F.FINDER, F.READING, F.CODES],
  'eyes-name': [F.WORKER_RUNTIME, F.NAMER],
  'eyes-people': [F.RUNTIME, F.WORKER_RUNTIME, F.FACES],
  'eyes-measure': [F.WORKER_RUNTIME, F.DEPTH],
  // PHOTO 2 (BRIEF-EDITOR-PHOTO-2): the cut-out model, the erase model and the RAW reader
  'photo-cutout': [F.WORKER_RUNTIME, F.CUTOUT],
  'photo-erase': [F.WORKER_RUNTIME, F.ERASE],
  'photo-raw': [F.RAWREADER],
};
const FILES = new Map();
for (const g of Object.values(F).filter(Array.isArray)) for (const [url, bytes] of g) FILES.set(url, bytes);
for (const [url, bytes] of FILES) {
  let on = -1;
  try {
    on = statSync(join(PUBLIC, url)).size;
  } catch {
    /* missing */
  }
  check(on === bytes, `[pins] ${url} is ${on} bytes on disk, pinned at ${bytes}`);
}
const packBytes = (id) => F.sum(...PACKS[id]);
check(packBytes('eyes-lens') > 44e6 && packBytes('eyes-lens') < 50e6, `[pins] the Lens's eyes are ${sizeWords(packBytes('eyes-lens'))} (said as about 47 MB)`);
const body = new Map();
const bytesOf = (url) => body.get(url) ?? (body.set(url, readFileSync(join(PUBLIC, url))), body.get(url));

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const GL = { look: { ground: 'graphite', world: 'glass', night: 'graphite', switches: {} } };
const INK = { look: { ground: 'warm', world: 'ink', night: 'warm', switches: {} } };

/** A phone with its service worker on, the pack's addresses answered here, the connection the spec says. */
async function phone({ viewport = PHONE, world = null } = {}) {
  const ctx = await browser.newContext({ viewport, ...UK, hasTouch: true, isMobile: true, permissions: ['camera'] });
  const page = await ctx.newPage();
  const st = { asked: new Map(), short: '', off: false, live: [] };
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/favicon|net::ERR|404|Failed to load resource|^[WI]\d{4} |^INFO:/.test(t)) problems.push(`console: ${t.slice(0, 200)}`);
  });
  await page.addInitScript(() => {
    const conn = Object.assign(new EventTarget(), { type: 'wifi', saveData: false });
    Object.defineProperty(navigator, 'connection', { get: () => conn, configurable: true });
    window.__net = (type) => {
      conn.type = type;
      conn.dispatchEvent(new Event('change'));
    };
  });
  await ctx.route('**/vendor/**', (r) => {
    const p = new URL(r.request().url()).pathname;
    if (!FILES.has(p)) return r.fallback();
    st.asked.set(p, (st.asked.get(p) ?? 0) + 1);
    if (st.off) {
      st.live.push(p);
      return r.abort('internetdisconnected');
    }
    if (st.short && p === st.short) return r.fulfill({ contentType: 'application/octet-stream', body: bytesOf(p).subarray(0, 100) });
    return r.fulfill({ contentType: /\.m?js$/.test(p) ? 'text/javascript' : /\.wasm$/.test(p) ? 'application/wasm' : 'application/octet-stream', body: bytesOf(p) });
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pair input', { timeout: 20000 });
  await page.fill('#pair input', KEY);
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
  const w = world === 'glass' ? GL : world === 'ink' ? INK : {};
  await page.evaluate((w) => window.__ghosty.settings.set({ sounds: false, ...w }), w);
  await page.evaluate(() => {
    window.__cspv = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__cspv.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  return { ctx, page, st };
}

const row = (page, id) => page.locator(`#pg-settings .wikioffer[data-pack="${id}"]`);
const rowText = async (page, id) => ((await row(page, id).innerText().catch(() => '')) ?? '').replace(/\s+/g, ' ');
async function openEyes(page) {
  await page.evaluate(() => (location.hash = 'settings'));
  await page.waitForSelector('#pg-settings .scanset button.srow, #pg-settings.listmode .pn[data-row]', { timeout: 20000 });
  await openPanel(page, 'settings', 'OFFLINE EYES');
  await page.waitForSelector('#pg-settings .wikioffer[data-pack="eyes-lens"]', { timeout: 10000 });
}
/** Waits for an async condition (Playwright's own waiting takes a promise as true at once). */
const poll = async (page, fn, ms, why) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await page.evaluate(fn).catch(() => false)) return true;
    await page.waitForTimeout(300);
  }
  problems.push(why);
  return false;
};
const until = (page, fn, arg, ms, why) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, async () => (problems.push(typeof why === 'function' ? await why() : why), false));
const sideways = (page, sel) =>
  page.$$eval(sel, (els) =>
    els
      .filter((e) => {
        if (!e.getClientRects().length) return false;
        const r = e.getBoundingClientRect();
        return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1);
      })
      .slice(0, 5)
      .map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join('.')}`),
  );
const small = (page, sel) =>
  page.$$eval(sel, (els) => els.filter((e) => e.getClientRects().length && e.getBoundingClientRect().height < 43.5 && e.getBoundingClientRect().height > 0).slice(0, 5).map((e) => `${e.tagName.toLowerCase()} "${(e.textContent ?? '').trim().slice(0, 24)}" ${Math.round(e.getBoundingClientRect().height)}`));
const waitBoot = (page) => page.waitForSelector('#boot', { state: 'detached', timeout: 45000 });

// ================================================================== 2-6: offered, mobile data, kept, offline Lens, delete
{
  const { ctx, page, st } = await phone();
  await openEyes(page);
  // 2. the seven packs offered with their sizes, licences and what cannot run
  const panel = ((await page.locator('#pg-settings .offeyes').innerText()) ?? '').replace(/\s+/g, ' ');
  for (const [id, name] of [['eyes-lens', 'The Lens’s eyes'], ['eyes-name', 'The namer'], ['eyes-people', 'People he knows'], ['eyes-measure', 'Measure’s distance'], ['photo-cutout', 'The cut-out model'], ['photo-erase', 'The erase model'], ['photo-raw', 'The RAW reader']]) {
    const t = await rowText(page, id);
    check(t.includes(name), `[offer] ${id} is not named "${name}": ${t.slice(0, 80)}`);
    check(new RegExp(`Get · ${sizeWords(packBytes(id)).replace(/[.]/g, '\\.')}`, 'i').test(t), `[offer] ${id}: the size on the button is not ${sizeWords(packBytes(id))}: ${t.slice(0, 220)}`);
    check(/on Wi-Fi/.test(t), `[offer] ${id} does not say on Wi-Fi`);
    check(/Apache|MIT|LGPL|Research use only|licen|LICEN/.test(t), `[offer] ${id} has no licence`);
    check((await row(page, id).locator('button[data-act="get"]').getAttribute('aria-label')) === `Get ${name}, ${sizeWords(packBytes(id))}, on Wi-Fi`, `[offer] ${id}: the button's VoiceOver label`);
  }
  check(/Needs a signal, and says so: ASK about a picture, the plant, bird and insect names, a meal’s contents/.test(panel), '[offer] the panel does not say what cannot run on the phone');
  check(/Nothing of what it sees is ever sent/.test(panel), '[offer] the panel does not say nothing is sent');
  check(st.asked.size === 0, `[offer] looking at the offers fetched ${st.asked.size} files`);
  await page.screenshot({ path: `${out}/eyes-offered.png` });
  const lensBytes = packBytes('eyes-lens');
  check(sizeWords(lensBytes) === '47 MB', `[offer] the Lens's eyes read ${sizeWords(lensBytes)}, not 47 MB`);

  // 3. mobile data
  await page.evaluate(() => window.__net('cellular'));
  await row(page, 'eyes-lens').locator('button[data-act="get"]').click();
  await until(page, () => /it waits for Wi-Fi/.test(document.querySelector('.wikioffer[data-pack="eyes-lens"]')?.textContent ?? ''), null, 5000, '[mobile] a tap on mobile data did not say it waits for Wi-Fi');
  check(new RegExp(`You are on mobile data, and The Lens’s eyes is ${sizeWords(lensBytes)}: it waits for Wi-Fi\\. Join Wi-Fi and it starts by itself\\.`).test(await rowText(page, 'eyes-lens')), `[mobile] the words: ${(await rowText(page, 'eyes-lens')).slice(0, 240)}`);
  await page.waitForTimeout(500);
  check(st.asked.size === 0, `[mobile] ${st.asked.size} files were fetched on mobile data`);
  const short = '/vendor/zxing/zxing-reader.mjs';

  // 4. Wi-Fi comes: one file arrives cut short and stops it; GET again carries on and fetches only what is missing
  st.short = short;
  await page.evaluate(() => window.__net('wifi'));
  await until(page, () => /came back the wrong size/.test(document.querySelector('.wikioffer[data-pack="eyes-lens"]')?.textContent ?? ''), null, 120000, '[get] a file cut short did not stop it with "came back the wrong size"');
  check(/Tap RETRY on Wi-Fi: it fetches that piece again/.test(await rowText(page, 'eyes-lens')), '[get] the stop does not say what GET again does');
  check(await row(page, 'eyes-lens').locator('button[data-act="get"]').isEnabled(), '[get] GET is not there again after a stop');
  const kept1 = await page.evaluate(async () => (await (await caches.open('ghosty-eyes-v1')).keys()).length);
  st.short = '';
  const before = new Map(st.asked);
  await row(page, 'eyes-lens').locator('button[data-act="get"]').click();
  const done = await until(page, () => document.querySelector('.wikioffer[data-pack="eyes-lens"]')?.dataset.state === 'here', null, 180000, async () => `[get] the Lens's eyes did not finish: ${(await rowText(page, 'eyes-lens')).slice(0, 400)}`);
  if (done) {
    const twice = [...st.asked].filter(([p, n]) => n > 1 && p !== short);
    check(twice.length === 0, `[get] fetched twice (GET again must carry on): ${twice.slice(0, 3).map(([p]) => p).join(', ')}`);
    check([...before].every(([p, n]) => p === short || st.asked.get(p) === n), '[get] GET again fetched a file that was already kept');
    const files = PACKS['eyes-lens'].flat();
    check(files.every(([p]) => st.asked.has(p)), '[get] a file of the pack was not fetched');
    const t = await rowText(page, 'eyes-lens');
    const month = await page.evaluate(() => `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][new Date().getMonth()]} ${new Date().getFullYear()}`);
    check(new RegExp(`The Lens’s eyes, ${month}, 4[67] MB on your phone`).test(t), `[kept] the kept line: ${t.slice(0, 200)}`);
    const inCache = await page.evaluate(async () => (await (await caches.open('ghosty-eyes-v1')).keys()).map((r) => new URL(r.url).pathname));
    check(files.every(([p]) => inCache.includes(p)), '[kept] a file of the pack is not in ghosty-eyes-v1');
    check(kept1 < inCache.length, '[kept] nothing was added by GET again');
    check(await page.evaluate(() => localStorage.getItem('ghosty.lens.heavy') === '1'), '[kept] the Lens\'s own step (GET THE EYES) is not marked as started on this phone');
    check(await page.evaluate(() => localStorage.getItem('ghosty.lens.namer') !== '1'), '[kept] the namer was marked though only the eyes were fetched');
    await page.screenshot({ path: `${out}/eyes-kept.png` });
    notes.push(`the Lens's eyes: ${files.length} files, ${sizeWords(lensBytes)}, none fetched twice`);
  }

  // 5. no network at all: the app reloads from what the phone holds, and the Lens opens its eyes from the pack
  await page.evaluate(() => navigator.serviceWorker.ready);
  await ctx.setOffline(true);
  st.off = true;
  st.live.length = 0;
  st.asked.clear();
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => problems.push('[offline] the app did not reload with no network'));
  await waitBoot(page).catch(() => problems.push('[offline] the app did not boot with no network'));
  await page.evaluate(() => {
    window.__cspv = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__cspv.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  await page.evaluate(() => (location.hash = 'lens'));
  await page.waitForSelector('#pg-lens', { timeout: 15000 });
  const ready = await until(page, () => window.__ghosty?.one?.finder === 'ready', null, 90000, async () => `[offline] the object finder did not load from the pack: ${await page.evaluate(() => JSON.stringify({ f: window.__ghosty?.one?.finder, said: window.__ghosty?.one?.stepSaid })).catch(() => '')}`);
  if (ready) {
    check(st.live.length === 0, `[offline] the network was asked for ${st.live.slice(0, 4).join(', ')}`);
    check(await page.evaluate(() => !document.querySelector('#pg-lens .key.honest, #pg-lens button[aria-label^="Get the eyes"]:not([hidden])')), '[offline] GET THE EYES is still showing with the eyes loaded');
    await page.screenshot({ path: `${out}/eyes-offline-lens.png` });
    notes.push('offline: the app reloaded with no network and the finder loaded from the pack');
  }
  // the key is live offline when the files are here: take the Lens's own mark away and open it again
  await page.evaluate(() => localStorage.removeItem('ghosty.lens.heavy'));
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(500);
  await page.evaluate(() => (location.hash = 'lens'));
  await until(page, () => window.__ghosty?.one?.finder === 'off', null, 8000, '[offline] the Lens did not start the finder from "off" without its mark');
  const key = page.locator('#pg-lens button[aria-label^="Get the eyes"]').first();
  check(await key.isVisible().catch(() => false), '[offline] GET THE EYES is not offered when the eyes are kept but the Lens never started them');
  check(await key.isEnabled().catch(() => false), '[offline] GET THE EYES is dead with no signal though its files are here');
  // (the key is pressed through the DOM: the Lens's bar moves under it while the camera row settles)
  await key.evaluate((el) => el.click());
  await until(page, () => window.__ghosty?.one?.finder === 'ready', null, 90000, '[offline] a tap on GET THE EYES did not load the finder from the pack with no signal');

  // 6. DELETE with UNDO (the network back)
  st.off = false;
  await ctx.setOffline(false);
  await openEyes(page);
  await row(page, 'eyes-lens').locator('button[data-act="delete"]').click();
  await page.waitForSelector('.undo:not([hidden]), .rcundo:not([hidden])', { timeout: 5000 }).catch(() => problems.push('[delete] no UNDO bar'));
  check(/deleted from this phone/.test((await page.textContent('body')) ?? ''), '[delete] the bar does not say it was deleted');
  check((await page.locator('#pg-settings .wikioffer[data-pack="eyes-lens"] button[data-act="get"]').count()) === 1, '[delete] the offer did not come back at once');
  await page.locator('.undo:not([hidden]) button, .rcundo:not([hidden]) button').first().click();
  await until(page, () => document.querySelector('.wikioffer[data-pack="eyes-lens"]')?.dataset.state === 'here', null, 5000, '[delete] UNDO did not keep the pack');
  check(await page.evaluate(async () => (await (await caches.open('ghosty-eyes-v1')).keys()).length > 5), '[delete] UNDO lost the files');

  // 7. a second pack shares the runtime: deleting it keeps what the first needs; deleting the first then takes it all
  await row(page, 'eyes-people').locator('button[data-act="get"]').click();
  await until(page, () => document.querySelector('.wikioffer[data-pack="eyes-people"]')?.dataset.state === 'here', null, 180000, '[shared] People he knows did not finish');
  const fetchedAgain = [...st.asked.keys()].filter((p) => F.RUNTIME.some(([r]) => r === p));
  check(fetchedAgain.length === 0, `[shared] the vision runtime was fetched again for People he knows: ${fetchedAgain.join(', ')}`);
  await row(page, 'eyes-people').locator('button[data-act="delete"]').click();
  await page.waitForTimeout(300);
  await page.locator('.undo:not([hidden]) button, .rcundo:not([hidden]) button').first().waitFor({ timeout: 5000 }).catch(() => undefined);
  await poll(page, async () => !(await (await caches.open('ghosty-eyes-v1')).match('/vendor/faces/worker.mjs')), 25000, '[shared] People he knows kept its own files after DELETE');
  check(await page.evaluate(async () => !!(await (await caches.open('ghosty-eyes-v1')).match('/vendor/mediapipe/vision_bundle.mjs'))), '[shared] DELETE took the runtime the Lens\'s eyes still needs');
  await row(page, 'eyes-lens').locator('button[data-act="delete"]').click();
  await poll(page, async () => !(await caches.has('ghosty-eyes-v1')), 25000, '[delete] the cache was not cleared once the bar let it go');
  check(await row(page, 'eyes-lens').locator('button[data-act="get"]').isVisible(), '[delete] the offer is not back after DELETE');
  check((await page.evaluate(() => window.__cspv ?? [])).length === 0, `[security] blocked by the policy: ${JSON.stringify(await page.evaluate(() => window.__cspv ?? []))}`);
  await ctx.close();
}

// ================================================================== 5b: no pack, no signal: the key is dead and says why
{
  const { ctx, page } = await phone();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await ctx.setOffline(true);
  await page.evaluate(() => (location.hash = 'lens'));
  await page.waitForSelector('#pg-lens', { timeout: 15000 });
  await page.waitForTimeout(800);
  const key = page.locator('#pg-lens button[aria-label^="Get the eyes"]').first();
  check((await key.getAttribute('aria-label').catch(() => '')) === `Get the eyes, 18 MB: needs a signal`, `[no pack] the key's label: ${await key.getAttribute('aria-label').catch(() => '(none)')}`);
  check(await key.isDisabled().catch(() => false), '[no pack] GET THE EYES is live with no signal and no pack');
  await ctx.close();
}

// ================================================================== 8: the three worlds, at 440 and 390
for (const world of ['scan', 'glass', 'ink']) {
  for (const vp of [PHONE, SMALL]) {
    const { ctx, page } = await phone({ viewport: vp, world });
    await openEyes(page);
    await page.waitForTimeout(900); // (the panel pushes in on a spring: measured when it has landed)
    const tag = `[${world} ${vp.width}]`;
    check((await sideways(page, '#pg-settings *')).length === 0, `${tag} something sticks out sideways: ${(await sideways(page, '#pg-settings *')).join(', ')}`);
    const tiny = await small(page, '#pg-settings .offeyes button');
    check(tiny.length === 0, `${tag} a key under 44 pt: ${tiny.join(', ')}`);
    check((await page.locator('#pg-settings .offeyes .wikioffer').count()) === 7, `${tag} the seven packs are not offered`);
    await page.screenshot({ path: `${out}/eyes-${world}-${vp.width}.png` });
    await ctx.close();
  }
}

await browser.close();
if (problems.length) {
  console.error(`OFFLINE EYES: ${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`ok: OFFLINE EYES - seven packs offered with their sizes, licences and what cannot run, waits for Wi-Fi, a short file stops it and GET again carries on, kept in ghosty-eyes-v1, the app reloads with no network and the Lens loads its finder from the pack (and its key works offline), DELETE with UNDO, the shared runtime kept, three worlds at 440 and 390 (${notes.join('; ')})`);
