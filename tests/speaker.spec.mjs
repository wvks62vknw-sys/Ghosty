// THE REAL SPEAKER MODEL FOR HIS VOICE (STARS 171; BRIEF-SPEAKER), in a real browser at 440 × 956 and 390 × 844, in all three worlds
// (The Scan, Glass, ONE INK). Chromium's fake microphone plays synthetic voices (tests/voicegen.mjs: fixture buffers written as WAV, one
// launch for each voice on one profile directory, so what the phone keeps is what the next launch finds). The model's network is not
// downloaded: every address of the pack's GET is answered by a route here (zeros at the pinned size, counted), and the 256 numbers come
// from a stand-in (tests/fixtures/fakespeaker.mjs, honoured only under a test runner); the filterbank, the judge, the store, the words
// and the screens are the page's own.
//  1. the pins in offline/speakerfiles.ts are held to the files on disk; the stand-in tells the three voices apart;
//  2. SETTINGS → VOICE MODEL: offered with its size said ("Get · 41 MB"), its licence, "on Wi-Fi"; nothing fetched by looking; MY VOICE
//     says what judges (the phone's own features);
//  3. NO MODEL (the courtesy signal that exists today): enrol with the three lines, he is YOU by the features, the record has no model numbers;
//  4. MOBILE DATA: a tap fetches nothing and says it waits for Wi-Fi; Wi-Fi comes and it starts; STOP stops it and keeps what came;
//     GET fetches only on the tap; the pack is kept ("<name>, <month>, <size> on your phone");
//  5. ENROL WITH THE MODEL: three lines, each kept as 256 numbers beside the features, never a recording, nothing in localStorage or on
//     the network, no sound sent to be written down; MY VOICE says the voice model judges;
//  6. RECOGNISE: he is YOU by the model, the brain is told "owner" and no number; another voice is "A VOICE I DON'T KNOW", held for GO ON
//     (sent as unknown); Sam is introduced with her yes aloud and is SAM by name; a third voice is unknown among two; him saying something
//     else is still YOU; a stranger is never given a name;
//  7. NEVER A LOCK: with his voice scored as him, an approval still waits for the tap; saying "yes, approve it" in his own voice approves
//     nothing; only the tap does (the brain's /approve is asked once, after it);
//  8. DELETE: MY VOICE gone with its model numbers at once, UNDO puts it all back; the voice model's own DELETE with UNDO; with the pack
//     gone he is still YOU by the features;
//  9. every world at 440 and 390: nothing sideways, every key 44 pt, no page errors.
//   BASE=http://localhost:8805 node tests/speaker.spec.mjs [outDir]
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PHONE, UK, openPanel } from './nav.mjs';
import { say, wav } from './voicegen.mjs';
import { FAKE_EMBED, fakeEmbed } from './fixtures/fakespeaker.mjs';

const root = new URL('..', import.meta.url).pathname;
const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const SMALL = { width: 390, height: 844 };
const problems = [];
const check = (ok, what) => ok || (console.log(`  PROBLEM: ${what}`), problems.push(what));
const notes = [];
process.on('exit', (c) => c && problems.length && console.error(`problems so far:\n- ${problems.join('\n- ')}`));
const READ = ['I’m Ghosty, and I’m listening for you.', 'I keep this on your phone, and nowhere else.', 'Ask me anything, and I’ll answer plainly.'];
const LEAD = 1.6;
const TAIL = 5;

// ---- 1. the pins, bundled from the source and held to the files; the stand-in tells the voices apart
const esbuild = createRequire(join(root, 'apps/web/package.json'))('esbuild');
const tmp = mkdtempSync(join(tmpdir(), 'speaker-'));
esbuild.buildSync({ entryPoints: [join(root, 'apps/web/src/offline/speakerfiles.ts')], bundle: true, format: 'esm', outfile: join(tmp, 'speakerfiles.mjs'), logLevel: 'warning' });
const F = await import(join(tmp, 'speakerfiles.mjs'));
const PUBLIC = join(root, 'apps/web/public');
const sizeWords = (b) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b >= 1e6 ? `${Math.round(b / 1e6)} MB` : `${Math.max(1, Math.round(b / 1000))} KB`);
const SIZES = new Map(); // every address of the pack and the bytes pinned
for (const [url, bytes] of [...F.VOICE_MODEL_ROWS, ...F.WORKER_RUNTIME_ROWS]) SIZES.set(url, bytes);
for (const [url, bytes] of F.VOICE_MODEL_ROWS) check(statSync(join(PUBLIC, url)).size === bytes, `[pins] ${url} is not ${bytes} bytes on disk`);
check(F.VOICE_PACK_BYTES === [...SIZES.values()].reduce((a, b) => a + b, 0), '[pins] the pack size is not the sum of its files');
const SAID = sizeWords(F.VOICE_PACK_BYTES);
const cosine = (a, b) => {
  const n = (v) => Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return a.reduce((s, x, i) => s + x * b[i], 0) / (n(a) * n(b));
};
{
  const e = {};
  for (const v of ['A', 'B', 'C']) for (const s of [0, 3]) e[v + s] = fakeEmbed(say(v, s, { seed: 3 + s, lead: LEAD, tail: TAIL }));
  check(cosine(e.A0, e.A3) > 0.6 && cosine(e.B0, e.B3) > 0.6, '[stand-in] the same voice does not land near itself');
  // (A and C are told apart after the browser's microphone chain has been over them, which the stand-in's centring is measured on: the page checks that below)
  check(cosine(e.A0, e.B0) < 0.4 && cosine(e.B0, e.C3) < 0.2, '[stand-in] two voices land too near each other');
}

const dir = resolve('tests/.tmp', `speaker-${process.pid}`);
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
const fileOf = (voice, sentence) => {
  const f = `${dir}/${voice}${sentence}.wav`;
  writeFileSync(f, wav(say(voice, sentence, { seed: 7 + sentence, lead: LEAD, tail: TAIL })));
  return f;
};
const profile = `${dir}/profile`;
const zeros = new Map();
const bodyOf = (url) => (zeros.has(url) ? zeros.get(url) : (zeros.set(url, Buffer.alloc(SIZES.get(url))), zeros.get(url)));
const GL = { look: { ground: 'graphite', world: 'glass', night: 'graphite', switches: {} } };
const INK = { look: { ground: 'warm', world: 'ink', night: 'warm', switches: {} } };

/** One launch: the fake microphone plays `file`; the pack's addresses are answered here; the brain is stood in for; everything out is watched. */
async function launch(file, label, { viewport = PHONE, world = null, mic = true } = {}) {
  const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', ...(mic ? ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${file}`] : [])];
  const ctx = await chromium.launchPersistentContext(mic ? profile : join(dir, `p-${label}`), { executablePath: process.env.CHROMIUM ?? undefined, args, viewport, deviceScaleFactor: 1, permissions: mic ? ['microphone'] : [], serviceWorkers: 'block', ...UK });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  const seen = { chats: [], approves: [], stt: 0, tts: [], posts: [], urls: [], asked: new Map(), delay: 0, said: 'what time is it', csp: [] };
  page.on('pageerror', (e) => problems.push(`${label}: pageerror: ${e.message}`));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/favicon|net::ERR|404|Failed to load resource|^[WI]\d{4} |^INFO:/.test(t)) problems.push(`${label}: console: ${t.slice(0, 200)}`);
  });
  page.on('request', (r) => {
    seen.urls.push(r.url());
    if (r.method() === 'POST') seen.posts.push({ url: r.url(), body: r.postData() ?? '' });
  });
  await page.addInitScript(`window.__ghostySpeakerEngine = { embed: ${FAKE_EMBED} };`);
  await page.addInitScript(() => {
    const conn = Object.assign(new EventTarget(), { type: 'wifi', saveData: false });
    Object.defineProperty(navigator, 'connection', { get: () => conn, configurable: true });
    window.__net = (type) => {
      conn.type = type;
      conn.dispatchEvent(new Event('change'));
    };
  });
  await ctx.route('**/vendor/**', async (r) => {
    const p = new URL(r.request().url()).pathname;
    if (!SIZES.has(p)) return r.fallback();
    seen.asked.set(p, (seen.asked.get(p) ?? 0) + 1);
    if (seen.delay && p === F.VOICE_MODEL_PIN.parts[0]) await new Promise((res) => setTimeout(res, seen.delay));
    return r.fulfill({ contentType: /\.m?js$/.test(p) ? 'text/javascript' : /\.wasm$/.test(p) ? 'application/wasm' : 'application/octet-stream', body: bodyOf(p) });
  });
  await ctx.route('**/api/status', async (route) => {
    const r = await route.fetch();
    const j = await r.json();
    j.speech = { stt: true, tts: true };
    await route.fulfill({ response: r, headers: { ...r.headers(), 'content-type': 'application/json' }, body: JSON.stringify(j) });
  });
  await ctx.route('**/api/tts', async (route) => {
    seen.tts.push(JSON.parse(route.request().postData() ?? '{}').text);
    await route.fulfill({ status: 200, headers: { 'content-type': 'audio/wav' }, body: wav(new Float32Array(1600)) });
  });
  await ctx.route('**/api/stt', async (route) => {
    seen.stt++;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: seen.said }) });
  });
  const nd = (...lines) => `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`;
  await ctx.route('**/api/chat', async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}');
    seen.chats.push({ message: body.message, voice: body.context?.voice });
    const ev = /send the email/i.test(body.message ?? '')
      ? nd({ t: 'approval', id: 'ap1', name: 'send_email', reason: 'Send the email to Sam?', args: { to: 'sam' } }, { t: 'done', model: 'Mock · scripted' })
      : nd({ t: 'text', text: `Mock reply to: ${body.message}` }, { t: 'done', model: 'Mock · scripted' });
    await route.fulfill({ status: 200, headers: { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' }, body: ev });
  });
  await ctx.route('**/api/approve', async (route) => {
    seen.approves.push(route.request().postData() ?? '');
    await route.fulfill({ status: 200, headers: { 'content-type': 'application/x-ndjson' }, body: nd({ t: 'text', text: 'Done.' }, { t: 'done', model: 'Mock · scripted' }) });
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  if (await page.waitForSelector('#pair input', { timeout: 8000 }).then(() => true, () => false)) {
    await page.fill('#pair input', KEY);
    await page.click('#pair button.on');
  }
  await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 }).catch(() => undefined);
  const w = world === 'glass' ? GL : world === 'ink' ? INK : {};
  await page.evaluate((w) => window.__ghosty.settings.set({ sounds: false, ...w }), w);
  await page.evaluate(() => {
    document.addEventListener('securitypolicyviolation', (e) => (window.__cspv ??= []).push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  await page.waitForTimeout(700);
  return { ctx, page, seen };
}

const settingsPanel = async (page, title) => {
  await page.evaluate(() => (location.hash = 'settings'));
  await openPanel(page, 'settings', title);
  await page.waitForTimeout(500);
};
const mark = (page) => page.evaluate(() => document.querySelector('#pg-settings .vk-marks [data-mark]')?.dataset.mark ?? '');
const waitMark = (page, want, ms) => page.waitForFunction((w) => document.querySelector('#pg-settings .vk-marks [data-mark]')?.dataset.mark === w, want, { timeout: ms }).then(() => true, () => false);
const judged = (page) => page.evaluate(() => document.querySelector('#pg-settings [data-judged]')?.dataset.judged ?? '');
const tagWho = (page) => page.evaluate(() => (document.querySelector('#voicetag:not([hidden])') ? document.querySelector('#voicetag').dataset.who : ''));
const score = (page) => page.evaluate(() => ({ ...window.__ghosty.voiceknown.lastScore }));
const row = (page) => page.locator('#pg-settings .wikioffer[data-pack="voice-model"]');
const rowText = async (page) => ((await row(page).innerText().catch(() => '')) ?? '').replace(/\s+/g, ' ');
const idb = (page) => page.evaluate(() => new Promise((resolve) => {
  const r = indexedDB.open('ghosty-voices');
  r.onsuccess = () => {
    const db = r.result;
    if (!db.objectStoreNames.contains('voices')) return resolve([]);
    const q = db.transaction('voices').objectStore('voices').getAll();
    q.onsuccess = () => resolve(q.result);
    q.onerror = () => resolve(null);
  };
  r.onerror = () => resolve(null);
}));
const inCache = (page) => page.evaluate(async (urls) => {
  if (!(await caches.has('ghosty-eyes-v1'))) return [];
  const c = await caches.open('ghosty-eyes-v1');
  const have = (await c.keys()).map((k) => new URL(k.url).pathname);
  return urls.filter((u) => have.includes(u));
}, [...SIZES.keys()]);
/**
 * The voice conversation ended for certain. A tap on the mic while Ghosty is speaking only cuts him off and leaves the conversation on
 * (its loop then listens again by itself and takes the fake microphone's next line), so a tap is repeated, once he is not speaking,
 * until the mic's button says it is off.
 */
async function endTalk(page, ms = 20000) {
  const t0 = Date.now();
  const state = () => page.evaluate(() => ({ on: !!document.querySelector('#mic')?.classList.contains('on'), speaking: window.__ghosty.ui.get().voice === 'speaking' }));
  for (let st = await state(); st.on && Date.now() - t0 < ms; st = await state()) {
    if (!st.speaking) await page.click('#mic');
    await page.waitForTimeout(250);
  }
  await page.waitForFunction(() => window.__ghosty.ui.get().voice !== 'speaking' && window.__ghosty.ui.get().voice !== 'listening', null, { timeout: 8000 }).catch(() => undefined);
}
/** A spoken turn: the earlier conversation is ended first; the mic is tapped, the fake microphone plays; the conversation is ended once the tag shows (it would listen again). */
async function speakTurn(page, who, ms = 25000) {
  await endTalk(page);
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(400);
  const was = await page.evaluate(() => window.__ghosty.voiceknown.speaker.get().at);
  await page.click('#mic');
  const t0 = Date.now();
  const ok = await page.waitForFunction(({ w, was }) => window.__ghosty.voiceknown.speaker.get().at > was && document.querySelector('#voicetag:not([hidden])')?.dataset.who === w, { w: who, was }, { timeout: ms }).then(() => true, () => false);
  if (process.env.DEBUG_TURN) console.log(`  turn ${who}: ${ok} in ${Date.now() - t0} ms ${JSON.stringify(await score(page))} tag=${await tagWho(page)}`);
  await endTalk(page);
  return ok;
}
const waitChats = async (seen, page, n, ms) => {
  const t0 = Date.now();
  while (seen.chats.length <= n && Date.now() - t0 < ms) await page.waitForTimeout(200);
  return seen.chats.length > n;
};
const controls = async (page, sel, name) => {
  const found = await page.evaluate((s) => [...document.querySelectorAll(`${s} button, ${s} input`)].filter((b) => b.getClientRects().length).map((b) => {
    const r = b.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), name: (b.getAttribute('aria-label') || b.textContent || b.getAttribute('placeholder') || '').trim() };
  }), sel);
  check(found.length > 0, `${name}: no controls found in ${sel}`);
  for (const c of found) {
    check(c.h >= 44 && (c.w >= 44 || /Dismiss/.test(c.name)), `${name}: "${c.name}" is ${c.w} x ${c.h} pt (want 44)`);
    check(!!c.name, `${name}: a control with no name`);
  }
};
const sideways = (page, sel) => page.$$eval(sel, (els) => els.filter((e) => e.getClientRects().length && e.getBoundingClientRect().width > 0 && (e.getBoundingClientRect().left < -1 || e.getBoundingClientRect().right > innerWidth + 1)).slice(0, 5).map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join('.')}`));
const enrolFlow = async (page, seen, label, button) => {
  const t0 = Date.now();
  const stt0 = seen.stt;
  await page.click(button);
  for (let i = 0; i < 3; i++) {
    check(await page.waitForFunction((s) => document.querySelector('.vk-sentence')?.textContent === s, READ[i], { timeout: 25000 }).then(() => true, () => false), `${label}: sentence ${i + 1} was not shown`);
  }
  const done = await page.waitForFunction(() => !document.querySelector('.vk-stage'), null, { timeout: 40000 }).then(() => true, () => false);
  check(done, `${label}: the enrolment did not finish (${await page.evaluate(() => document.querySelector('.vk-stage')?.textContent ?? '')})`);
  check(seen.stt === stt0, `${label}: enrolling sent ${seen.stt - stt0} recordings to be written down (want none)`);
  return Date.now() - t0;
};
const undoBtn = (page) => page.locator('.undofloat button, .undo button').filter({ hasText: /undo/i }).first();

// ================================================================== 2-8: his voice with and without the model, the packs, the others
let mine = [];
{
  const { ctx, page, seen } = await launch(fileOf('A', 0), 'A');
  // 2. offered with the size said; nothing fetched by looking
  await settingsPanel(page, 'VOICE MODEL');
  await row(page).waitFor({ timeout: 10000 });
  let t = await rowText(page);
  check(/The voice model/.test(t) && new RegExp(`Get · ${SAID.replace('.', '\\.')}`, 'i').test(t), `[offer] the size said is not "Get · ${SAID}": ${t.slice(0, 200)}`);
  check(/on Wi-Fi/.test(t) && /CC BY 4\.0/.test(t) && /27 MB/.test(t), `[offer] on Wi-Fi, the licence and the model's own 27 MB are not said: ${t.slice(0, 300)}`);
  check(/never a lock/i.test(await page.locator('#pg-settings .offvoice').innerText()), '[offer] the panel does not say it is never a lock');
  check((await row(page).locator('button[data-act="get"]').getAttribute('aria-label')) === `Get The voice model, ${SAID}, on Wi-Fi`, '[offer] the button\'s VoiceOver label');
  check(seen.asked.size === 0, `[offer] looking fetched ${[...seen.asked.keys()].join(', ')}`);
  await page.screenshot({ path: `${out}/speaker-offer.png` });
  await openPanel(page, 'settings', 'MY VOICE');
  check((await judged(page)) === 'features' || (await mark(page)) === 'degraded', '[mark] before enrolling, MY VOICE is DEGRADED');
  check(/the phone’s own sound features/.test(await page.evaluate(() => document.querySelector('#pg-settings [data-id="myvoice"]').textContent)), '[mark] MY VOICE does not say the phone’s own features judge');

  // 3. NO MODEL: the courtesy signal that exists today
  seen.said = 'what time is it';
  const ms0 = await enrolFlow(page, seen, '[no model]', 'button[aria-label^="Enrol my voice"]');
  check(await waitMark(page, 'working', 10000), '[no model] enrolling with no model did not give a working mark');
  let rows = await idb(page);
  check(rows?.length === 1 && rows[0].me && rows[0].print.emb === undefined && rows[0].print.looks.flat().length + rows[0].print.pooled.length === 200, `[no model] the record kept is ${JSON.stringify(rows)?.slice(0, 120)} (want the 200 features and no model numbers)`);
  check((await judged(page)) === 'features', '[no model] MY VOICE does not say the phone’s own features judge');
  check(await speakTurn(page, 'owner'), `[no model] his voice was not YOU (tag "${await tagWho(page)}", ${JSON.stringify(await score(page))})`);
  check((await score(page)).via === 'features', `[no model] the judge was ${(await score(page)).via} (want features)`);
  check(seen.asked.size === 0, '[no model] the model was fetched without his tap');

  // 4. MOBILE DATA, STOP, GET only on the tap
  await settingsPanel(page, 'VOICE MODEL');
  await page.evaluate(() => window.__net('cellular'));
  await row(page).locator('button[data-act="get"]').click();
  await page.waitForTimeout(900);
  t = await rowText(page);
  check(/mobile data/i.test(t) && /waits for Wi-Fi/.test(t), `[mobile] a tap on mobile data does not say it waits for Wi-Fi: ${t.slice(0, 220)}`);
  check(seen.asked.size === 0, `[mobile] mobile data fetched ${[...seen.asked.keys()].join(', ')}`);
  seen.delay = 12000; // the model answers slowly, so STOP can be pressed while it comes
  await page.evaluate(() => window.__net('wifi'));
  check(await page.waitForFunction(() => document.querySelector('#pg-settings .wikioffer[data-pack="voice-model"] button[data-act="stop"]'), null, { timeout: 8000 }).then(() => true, () => false), '[mobile] Wi-Fi came and it did not start by itself');
  await page.screenshot({ path: `${out}/speaker-getting.png` });
  await page.evaluate(() => document.querySelector('#pg-settings .wikioffer[data-pack="voice-model"] button[data-act="stop"]')?.click()); // (the row repaints with each piece: a plain click would chase it)
  await page.waitForTimeout(1200);
  t = await rowText(page);
  check(/Stopped/.test(t) && (await row(page).locator('button[data-act="get"]').count()) === 1, `[stop] STOP did not stop it with GET still there: ${t.slice(0, 200)}`);
  check((await inCache(page)).length < SIZES.size, `[stop] a stopped GET kept the whole pack: ${(await inCache(page)).join(' ')}; asked ${[...seen.asked].join(' ')}; ${(await rowText(page)).slice(0, 160)}`);
  seen.delay = 0;
  seen.asked.clear();
  await row(page).locator('button[data-act="get"]').click();
  check(await page.waitForFunction(() => /on your phone/.test(document.querySelector('#pg-settings .wikioffer[data-pack="voice-model"]')?.textContent ?? ''), null, { timeout: 30000 }).then(() => true, () => false), `[get] the pack was not kept: ${(await rowText(page)).slice(0, 200)}`);
  t = await rowText(page);
  check(new RegExp(`The voice model, November 2026, ${SAID.replace('.', '\\.')} on your phone`).test(t), `[get] the kept words: ${t.slice(0, 200)}`);
  check((await inCache(page)).length === SIZES.size, '[get] not every file of the pack is in the phone\'s cache');
  check(seen.asked.get(F.VOICE_MODEL_PIN.parts[0]) === 1 && (seen.asked.get(F.VOICE_MODEL_PIN.parts[1]) ?? 0) <= 1, `[get] the model's parts were asked ${F.VOICE_MODEL_PIN.parts.map((u) => seen.asked.get(u) ?? 0)} times after the tap (the first once, the second once or not at all: a stopped GET keeps what came)`);
  await page.screenshot({ path: `${out}/speaker-kept.png` });

  // 5. ENROL WITH THE MODEL
  await openPanel(page, 'settings', 'MY VOICE');
  check((await judged(page)) === 'features', '[mark] with the model here and his record made before it, MY VOICE should say ENROL again');
  check(/ENROL again so the voice model learns you/.test(await page.evaluate(() => document.querySelector('#pg-settings [data-id="myvoice"]').textContent)), '[mark] MY VOICE does not invite enrolling again');
  const first = rows[0].at;
  const ms1 = await enrolFlow(page, seen, '[model]', 'button[aria-label^="Enrol my voice again"]');
  notes.push(`enrolment ${Math.round(ms1 / 1000)} s with the model (${Math.round(ms0 / 1000)} s without; ${LEAD * 3} s of each is the machine's room)`);
  rows = await idb(page);
  const emb = rows?.[0]?.print.emb;
  check(rows?.length === 1 && rows[0].at > first && !!emb && emb.looks.length === 3 && emb.looks.every((l) => l.length === 256 && l.every(Number.isFinite)) && emb.pooled.length === 256 && Number.isFinite(emb.accept), `[model] the record kept is ${JSON.stringify(rows?.[0]?.print)?.slice(0, 100)} (want 3 x 256 and the centre)`);
  check(rows?.[0] && JSON.stringify(rows[0]).length < 40_000, '[model] the record is large: a recording?');
  check(rows?.[0]?.print.looks.flat().length + rows?.[0]?.print.pooled.length === 200, '[model] the 200 features are not kept beside');
  check((await judged(page)) === 'model', '[model] MY VOICE does not say the voice model judges');
  check(await waitMark(page, 'working', 8000), '[model] the mark is not WORKING');
  const bits = emb?.pooled.slice(0, 5).map((x) => x.toFixed(4)) ?? [];
  const stores = await page.evaluate(() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]));
  check(!/"pooled"|"emb"|ghosty-voices/.test(stores) && !bits.some((n) => stores.includes(n)), '[model] something of the voice is in localStorage or sessionStorage');
  check(!seen.posts.some((p) => bits.some((n) => p.body.includes(n))), '[model] the voice\'s numbers went out in a request');
  check(!seen.posts.some((p) => !p.url.startsWith(base)), `[model] a POST left this site: ${seen.posts.find((p) => !p.url.startsWith(base))?.url}`);
  await page.screenshot({ path: `${out}/speaker-enrolled.png` });

  // 6. RECOGNISE: him by the model; the brain told "owner" and no number
  seen.said = 'what time is it';
  check(await speakTurn(page, 'owner'), `[model] his voice was not YOU (tag "${await tagWho(page)}", ${JSON.stringify(await score(page))})`);
  check((await score(page)).via === 'model', `[model] the judge was "${(await score(page)).via}" (want the model)`);
  await waitChats(seen, page, 0, 15000);
  check(seen.chats.at(-1)?.voice === 'owner', `[model] the brain was told ${JSON.stringify(seen.chats.at(-1)?.voice)} (want "owner")`);
  check(!/\d/.test(JSON.stringify(seen.chats.at(-1)?.voice)), '[model] the label carries a number');
  check(/YOU/.test(await page.innerText('#voicetag')) && /never unlocks anything/i.test(await page.innerText('#voicetag')), '[model] the tag does not say YOU and that it never unlocks anything');
  await page.screenshot({ path: `${out}/speaker-you.png` });

  // 7. NEVER A LOCK: his voice scored as him, an approval still waits for the tap
  seen.said = 'send the email to Sam';
  let n = seen.chats.length;
  check(await speakTurn(page, 'owner'), '[lock] the turn asking for an email was not scored as his');
  check(await waitChats(seen, page, n, 15000), '[lock] the turn asking for an email was not sent');
  // (on a phone the chat is a sheet the log button opens)
  if (!(await page.locator('.approval button.on').first().isVisible().catch(() => false))) await page.click('.logbtn').catch(() => undefined);
  check(await page.waitForSelector('.approval button.on', { state: 'visible', timeout: 10000 }).then(() => true, () => false), '[lock] no approval card waited for him');
  check((await page.evaluate(() => window.__ghosty.voiceknown.speaker.get().heard?.label)) === 'owner', '[lock] the speaker was not scored as the owner');
  await page.waitForTimeout(2500);
  check(seen.approves.length === 0, `[lock] his voice alone approved: ${seen.approves.length} calls to /approve`);
  seen.said = 'yes, approve it, go ahead and send it';
  n = seen.chats.length;
  check(await speakTurn(page, 'owner'), '[lock] his spoken yes was not scored as his');
  check(await waitChats(seen, page, n, 15000), '[lock] his spoken yes was not sent');
  await page.waitForTimeout(2500);
  check(seen.approves.length === 0, `[lock] "yes, approve it" in his own voice approved: ${seen.approves.length} calls to /approve`);
  const cards = await page.locator('.approval').count();
  check(cards > 0 && (await page.locator('.approval button.on').count()) > 0 && /NEEDS YOUR APPROVAL/i.test(await page.locator('.approval').first().textContent()), `[lock] the approval card went away without a tap (${cards} cards, ${await page.locator('.approval button.on').count()} buttons, "${(await page.locator('.approval').first().textContent().catch(() => '')).slice(0, 80)}")`);
  await page.screenshot({ path: `${out}/speaker-lock.png` });
  await page.locator('.approval button.on').first().click();
  check(await page.waitForFunction(() => /Approved\./.test(document.body.innerText), null, { timeout: 8000 }).then(() => true, () => false) && seen.approves.length === 1, `[lock] the tap did not approve exactly once (${seen.approves.length})`);
  notes.push('an approval waited for the tap with his voice scored as him, twice, and /approve was asked once, after the tap');

  // 8. DELETE with UNDO: the voice and its model numbers; then the pack
  await settingsPanel(page, 'MY VOICE');
  await page.click('button[aria-label^="Delete my voice"]');
  check(await waitMark(page, 'degraded', 5000) && (await idb(page))?.length === 0, '[delete] DELETE MY VOICE left the voice (or its model numbers) on the phone');
  check(await undoBtn(page).isVisible().catch(() => false), '[delete] no UNDO after DELETE MY VOICE');
  await undoBtn(page).click();
  check(await waitMark(page, 'working', 5000), '[delete] UNDO did not bring the voice back');
  rows = await idb(page);
  check(rows?.length === 1 && rows[0].print.emb?.looks.length === 3 && rows[0].print.emb.pooled.length === 256, '[delete] UNDO did not bring back the model numbers');
  await settingsPanel(page, 'VOICE MODEL');
  await row(page).locator('button[data-act="delete"]').click();
  await page.waitForTimeout(500);
  check(await undoBtn(page).isVisible().catch(() => false) && (await inCache(page)).length === SIZES.size, '[delete] the pack went before the UNDO bar did');
  await undoBtn(page).click();
  await page.waitForTimeout(600);
  check(/on your phone/.test(await rowText(page)) && (await inCache(page)).length === SIZES.size, '[delete] UNDO did not keep the pack');
  await row(page).locator('button[data-act="delete"]').click();
  await page.waitForTimeout(500);
  check(await page.waitForFunction(() => document.querySelector('#pg-settings .wikioffer[data-pack="voice-model"]')?.dataset.state === 'offered', null, { timeout: 20000 }).then(() => true, () => false), '[delete] the pack was not deleted once the UNDO bar went');
  for (let i = 0; i < 120 && (await inCache(page)).some((u) => u.includes('/speaker/')); i++) await page.waitForTimeout(250); // (the files go when the UNDO bar does)
  check((await inCache(page)).filter((u) => u.includes('/speaker/')).length === 0, '[delete] the model is still in the phone\'s cache');
  await undoBtn(page).waitFor({ state: 'hidden', timeout: 20000 }).catch(() => undefined);
  await page.waitForTimeout(1500); // (the engine forgets the pack once the files are gone)
  // the model gone, he is still YOU by the features (his record kept both)
  seen.said = 'what is the weather';
  check(await speakTurn(page, 'owner'), `[fallback] with the pack deleted his voice was not YOU (${JSON.stringify(await score(page))})`);
  check((await score(page)).via === 'features', `[fallback] the judge was "${(await score(page)).via}" (want features)`);
  await settingsPanel(page, 'MY VOICE');
  check((await judged(page)) === 'features', '[fallback] MY VOICE does not say the features judge once the model is gone');
  mine = rows;
  await ctx.close();
}

// ================================================================== 6: another voice (B), introduced as Sam; a third (C); him again (A)
{
  const { ctx, page, seen } = await launch(fileOf('B', 1), 'B');
  await settingsPanel(page, 'VOICE MODEL');
  await row(page).locator('button[data-act="get"]').click();
  check(await page.waitForFunction(() => /on your phone/.test(document.querySelector('#pg-settings .wikioffer[data-pack="voice-model"]')?.textContent ?? ''), null, { timeout: 30000 }).then(() => true, () => false), '[B] the pack was not fetched again on his tap');
  // his record from before the model's return has the model numbers: they judge now
  seen.said = 'what is on my calendar';
  check(await speakTurn(page, 'unknown'), `[B] another voice did not show A VOICE I DON'T KNOW (${JSON.stringify(await score(page))})`);
  check((await score(page)).via === 'model', `[B] the judge was "${(await score(page)).via}" (want the model)`);
  const t = await page.innerText('#voicetag');
  check(/A VOICE I DON'T KNOW/.test(t) && /A voice I don’t know\. Go on\?/.test(t) && !/YOU|SAM/.test(t), `[B] the bar says "${t}"`);
  await page.waitForTimeout(1500);
  check(seen.chats.length === 0, `[B] the turn went to the brain (${seen.chats.length}) before GO ON`);
  await page.screenshot({ path: `${out}/speaker-unknown.png` });
  await controls(page, '#voicetag', '[B] the bar');
  await page.click('#voicetag button:has-text("GO ON")');
  check(await waitChats(seen, page, 0, 15000) && seen.chats.at(-1)?.voice === 'unknown', `[B] GO ON sent the turn as ${JSON.stringify(seen.chats.at(-1)?.voice)} (want "unknown": nothing private is said to it)`);
  // Sam introduced with her present: the yes aloud, then three lines
  await settingsPanel(page, 'PEOPLE I');
  await page.fill('input[aria-label="Their name"]', 'Sam');
  seen.said = 'yes';
  const sttBefore = seen.stt;
  await page.click('button[aria-label^="Add someone"]');
  check(await page.waitForFunction(() => /Got it\. I’ll know Sam/.test(document.querySelector('#toasts')?.textContent ?? ''), null, { timeout: 70000 }).then(() => true, () => false), `[Sam] Sam was not added (${await page.evaluate(() => document.querySelector('.vk-stage')?.textContent ?? document.querySelector('#toasts')?.textContent ?? '')})`);
  check(/Sam, is it all right if I learn your voice\? Say yes\./.test(seen.tts.join(' ')), `[Sam] Ghosty did not ask aloud: ${JSON.stringify(seen.tts)}`);
  check(seen.stt - sttBefore >= 1 && seen.stt - sttBefore <= 3, `[Sam] the yes was written down ${seen.stt - sttBefore} times (want 1 to 3, for the yes alone)`);
  const rows = await idb(page);
  const sam = rows?.find((r) => r.name === 'Sam');
  check(rows?.length === 2 && !!sam?.print.emb && sam.print.emb.looks.length === 3 && sam.print.emb.pooled.length === 256, `[Sam] Sam's record is ${JSON.stringify(sam?.print)?.slice(0, 80)} (want 3 x 256 and the centre, and his own kept)`);
  check(!seen.posts.some((p) => sam?.print.emb.pooled.slice(0, 5).some((x) => p.body.includes(x.toFixed(4)))), '[Sam] her numbers went out in a request');
  await page.screenshot({ path: `${out}/speaker-people.png` });
  // her voice is SAM; the context is her name and nothing else
  seen.said = 'put the kettle on';
  const k = seen.chats.length;
  check(await speakTurn(page, 'person'), `[Sam] Sam's voice did not show her name (tag "${await tagWho(page)}", ${JSON.stringify(await score(page))})`);
  check(/SAM/.test(await page.innerText('#voicetag')), `[Sam] the tag says "${await page.innerText('#voicetag')}"`);
  await waitChats(seen, page, k, 15000);
  check(JSON.stringify(seen.chats.at(-1)?.voice) === '{"name":"Sam"}', `[Sam] the brain was told ${JSON.stringify(seen.chats.at(-1)?.voice)} (want {"name":"Sam"})`);
  check((await score(page)).via === 'model', '[Sam] the model did not judge her');
  await ctx.close();
}
for (const [voice, sentence, want, label] of [['A', 3, 'owner', 'him, saying something else'], ['C', 4, 'unknown', 'a third voice among two known']]) {
  const { ctx, page, seen } = await launch(fileOf(voice, sentence), `${voice}${sentence}`);
  await settingsPanel(page, 'VOICE MODEL');
  const have = await rowText(page);
  if (!/on your phone/.test(have)) {
    await row(page).locator('button[data-act="get"]').click();
    await page.waitForFunction(() => /on your phone/.test(document.querySelector('#pg-settings .wikioffer[data-pack="voice-model"]')?.textContent ?? ''), null, { timeout: 30000 }).catch(() => undefined);
  }
  seen.said = 'remind me at five';
  check(await speakTurn(page, want), `[${label}] tag "${await tagWho(page)}", ${JSON.stringify(await score(page))} (want ${want})`);
  const s = await score(page);
  check(s.via === 'model', `[${label}] the judge was "${s.via}" (want the model)`);
  if (want === 'unknown') {
    await waitChats(seen, page, 0, 1500);
    check(seen.chats.length === 0 && !/[A-Z]{3,} (SAM|YOU)/.test(await page.innerText('#voicetag')), `[${label}] a stranger was named or let through unasked`);
  }
  notes.push(`${label}: ${want} by the model (${s.ms} ms)`);
  await ctx.close();
}

// ================================================================== 9: the three worlds, at 440 and 390
for (const world of ['scan', 'glass', 'ink']) {
  for (const vp of [PHONE, SMALL]) {
    const { ctx, page } = await launch(null, `${world}${vp.width}`, { viewport: vp, world, mic: false });
    await settingsPanel(page, 'VOICE MODEL');
    await page.waitForTimeout(900);
    await page.waitForFunction(() => !document.getAnimations().some((a) => a.playState === 'running'), null, { timeout: 8000 }).catch(() => undefined);
    const tag = `[${world} ${vp.width}]`;
    check((await sideways(page, '#pg-settings *')).length === 0, `${tag} something sticks out sideways: ${(await sideways(page, '#pg-settings *')).join(', ')}`);
    await controls(page, '#pg-settings .offvoice', `${tag} VOICE MODEL`);
    await page.screenshot({ path: `${out}/speaker-${world}-${vp.width}.png` });
    await openPanel(page, 'settings', 'MY VOICE');
    await page.waitForTimeout(700);
    await page.waitForFunction(() => !document.getAnimations().some((a) => a.playState === 'running'), null, { timeout: 8000 }).catch(() => undefined);
    check((await sideways(page, '#pg-settings *')).length === 0, `${tag} MY VOICE sticks out sideways`);
    await controls(page, '#pg-settings [data-id="myvoice"]', `${tag} MY VOICE`);
    check(((await page.evaluate(() => window.__cspv ?? [])).length) === 0, `${tag} the security policy blocked something`);
    await ctx.close();
  }
}
rmSync(dir, { recursive: true, force: true });
if (problems.length) {
  console.error(`SPEAKER: ${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`ok: SPEAKER - the voice model offered with its size said and fetched only on his tap, STOP, kept; his voice enrolled as 3 x 256 numbers beside the features with nothing sent; YOU, Sam by name and a voice I don't know judged by the model, the features when it is gone; his voice never approves (the tap does); DELETE with UNDO; three worlds at 440 and 390 (${notes.join('; ')})`);
