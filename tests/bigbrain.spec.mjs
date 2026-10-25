// A bigger offline brain (SETTINGS → OFFLINE BRAIN → WHICH BRAIN; apps/web/src/offline/models.ts PICKER, fitLine and
// limitsProblem, offline/fill.ts, offline/brain.ts getBrain / useBrain / recoverFromClose, features/settings/offline.ts).
// No WebGPU here, so a test engine stands in for the model on the phone (window.__ghostyOfflineEngine, as in
// offlinebrain.spec.mjs): it is told which model it loads, "runs out of memory" for the one named in `failFor`, and
// never finishes loading the one in `hangFor` (iOS closing Ghosty mid-load is then a page reload). With `files: true`
// GET and DOWNLOAD really fill the Cache API: this spec serves a stand-in model of a few small pieces for every
// huggingface.co address (a config, the list of pieces, a tokenizer and four 1.5 MB shards; the compiled library comes
// from this site), one fetch at a time checked. A fake WebGPU adapter gives its limits and counts every device and
// buffer asked for. The browser is made to say what Safari says: no memory figure, no connection type. Checked, at the
// owner's iPhone 18 Pro Max size (24 Oct: "whenever i go to download one of the big brains Ghosty just crashes"):
//  1. the picker lists Qwen3 0.6B (in use, the fallback), Qwen3.5 0.8B, 2B and 4B with download, memory and fit;
//     the one line on cost and gain; "what this phone can hold" from the adapter;
//  2. GET on mobile data is refused with the size, no question asked; on Wi-Fi it asks first; "no" changes nothing;
//     yes stores the pieces in WebLLM's own stores and keys, one at a time, with "piece 5 of 8 · 3 MB of 6 MB", the
//     log written before each piece, the brain in use unloaded first, and NO graphics device or buffer, and nothing
//     loaded; the 0.6B stays in use and the 2B is ON THIS PHONE;
//  3. a simulated kill mid-download (the page reloaded with the log set): the picker says where it stopped, nothing
//     restarts by itself, CONTINUE asks and fetches only the pieces not yet stored;
//  4. USE: the warning before the first load of a bigger brain (KEEP IT loads nothing), then the load, the training
//     told, the crash record cleared, 12 s to UNDO; TEST on the chosen brain (the speed line, the report card's QUICK
//     CHECK); a simulated kill during USE (the page reloaded with the load record set): the next open says the load
//     closed Ghosty, the 0.6B is in use, the download stays, the brain is marked "closed Ghosty on this phone" and USE
//     asks again; an out-of-memory error at USE or at a reply: the 0.6B takes over in plain words; REMOVE asks first;
//  5. nothing scrolls sideways; a browser that gives its memory (8 GB) gets "fits this device (8 GB)";
//  6. Safari's default limits (256 MB buffers, 128 MB bindings): USE refuses the 2B in plain words with nothing loaded
//     and no warning; the 0.8B (the step between) passes, loads, and leaves the training's base alone;
//  7. the owner's phone as the old GET left it (the 2B "in use", never loaded, its files whole): on opening, the 0.6B
//     is back in use and the 2B is marked as having closed Ghosty, with nothing loaded.
//   BASE=http://localhost:8892 node tests/bigbrain.spec.mjs [outDir]
import { mkdirSync } from 'node:fs';
import { engine as browserName, launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, openPanel } from './nav.mjs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const problems = [];
const check = (ok, what) => void (ok || problems.push(what));
// (a step that throws still shows every check that failed before it)
let reported = false;
process.on('exit', (code) => {
  if (!reported && code && problems.length) console.error(`bigbrain spec: ${problems.length} problem(s) before it stopped\n- ${problems.join('\n- ')}`);
});
const ID = { small: 'Qwen3-0.6B-q4f16_1-MLC', mid: 'Qwen3.5-0.8B-q4f16_1-MLC', two: 'Qwen3.5-2B-q4f16_1-MLC', four: 'Qwen3.5-4B-q4f16_1-MLC' };
const MiB = 2 ** 20;
const GENEROUS = { maxBufferSize: 4 * 2 ** 30, maxStorageBufferBindingSize: 4 * 2 ** 30, maxComputeWorkgroupStorageSize: 32768, maxStorageBuffersPerShaderStage: 10, maxComputeInvocationsPerWorkgroup: 1024 };
const SAFARI_DEFAULT = { ...GENEROUS, maxBufferSize: 256 * MiB, maxStorageBufferBindingSize: 128 * MiB };

// The stand-in model: the same small pieces for every brain (each brain's own address, so its own cache keys).
const SHARD = 1_500_000;
const SHARDS = 4;
const STANDIN = {
  'mlc-chat-config.json': JSON.stringify({ model_type: 'standin', tokenizer_files: ['tokenizer.json', 'vocab.json'] }),
  'tensor-cache.json': JSON.stringify({ metadata: {}, records: Array.from({ length: SHARDS }, (_, i) => ({ dataPath: `params_shard_${i}.bin`, format: 'raw-shard', nbytes: SHARD, records: [] })) }),
  'tokenizer.json': '{"stand-in":true}',
};
const PIECES = 3 + SHARDS + 1; // config, list, tokenizer, the shards, the compiled library

const fakes = ({ memory, limits }) => {
  // Safari says nothing about the device's memory or its connection (a spec may set window.__net).
  Object.defineProperty(Navigator.prototype, 'deviceMemory', { get: () => memory ?? undefined, configurable: true });
  window.__net = '';
  Object.defineProperty(Navigator.prototype, 'connection', { get: () => (window.__net ? { type: window.__net } : undefined), configurable: true });
  // A graphics chip with these limits: asking for its limits is free; a device or a buffer is counted.
  window.__gpu = { adapters: 0, devices: 0, buffers: 0 };
  const adapter = {
    features: new Set(['shader-f16']),
    limits,
    async requestDevice() {
      window.__gpu.devices++;
      return { features: new Set(['shader-f16']), limits, createBuffer: () => void window.__gpu.buffers++, lost: new Promise(() => undefined) };
    },
  };
  Object.defineProperty(Navigator.prototype, 'gpu', { get: () => ({ requestAdapter: async () => (window.__gpu.adapters++, adapter), getPreferredCanvasFormat: () => 'bgra8unorm' }), configurable: true });
  // The download log, as it is written (before each piece), and the progress line as the owner sees it.
  window.__logs = [];
  const set = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    if (k === 'ghosty.offlinebrain.getting') window.__logs.push(JSON.parse(v));
    return set.call(this, k, v);
  };
  window.__lines = [];
  setInterval(() => {
    const t = document.querySelector('#pg-settings .offbrain .obtext')?.textContent ?? '';
    if (t && window.__lines.at(-1) !== t) window.__lines.push(t);
  }, 15);
  window.__ghostyOfflineEngine = {
    ready: false,
    files: true,
    loads: [],
    calls: [],
    unloads: 0,
    failFor: '',
    hangFor: '',
    idleMs: 60000,
    load(model) {
      this.loads.push(model);
      if (model && model === this.failFor) throw new Error('Out of memory: the GPU device was lost while loading');
      if (model && model === this.hangFor) return new Promise(() => undefined);
    },
    unload() {
      this.unloads++;
    },
    async chat(messages, onToken) {
      this.calls.push({ model: this.loads.at(-1), q: messages.at(-1).content });
      await new Promise((r) => setTimeout(r, 4));
      onToken('Hello from your phone.');
    },
  };
};

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

/** Every huggingface.co address answered with the stand-in, one at a time checked; `hang` files never answer. */
function standIn(ctx) {
  const net = { hits: [], inflight: 0, most: 0, hang: new Set() };
  void ctx.route('https://huggingface.co/**', async (route) => {
    const url = route.request().url();
    const file = url.split('/').pop();
    net.hits.push(url);
    if (net.hang.has(file)) return; // the connection just stops (never answered)
    net.inflight++;
    net.most = Math.max(net.most, net.inflight);
    await new Promise((r) => setTimeout(r, file.startsWith('params_shard') ? 120 : 20));
    net.inflight--;
    const body = file.startsWith('params_shard') ? Buffer.alloc(SHARD, 7) : STANDIN[file];
    if (body === undefined) return route.fulfill({ status: 404, body: 'no such file', headers: { 'access-control-allow-origin': '*' } });
    await route.fulfill({ status: 200, body, headers: { 'access-control-allow-origin': '*', 'content-type': file.endsWith('.json') ? 'application/json' : 'application/octet-stream' } }).catch(() => undefined);
  });
  return net;
}

async function toSettings(page) {
  await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
  await page.evaluate(() => (location.hash = 'settings'));
  await openPanel(page, 'settings', 'OFFLINE');
  await page.waitForSelector('#pg-settings .offbrain .obbrain', { state: 'attached', timeout: 10000 });
  await page.waitForTimeout(500);
}

async function signedIn({ memory = null, limits = GENEROUS } = {}) {
  const ctx = await browser.newContext({ viewport: PHONE, ...UK });
  const net = standIn(ctx);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
  await page.addInitScript(fakes, { memory, limits });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pair input', { timeout: 20000 });
  await page.fill('#pair input', KEY);
  await page.click('#pair button.on');
  await toSettings(page);
  return { ctx, page, net };
}
/** iOS closed Ghosty: the page goes away mid-step and is opened again (localStorage and the Cache API stay). */
async function killAndReopen(page) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await toSettings(page);
}

const rows = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('#pg-settings .offbrain .obbrain')].map((r) => ({
      model: r.dataset.model,
      name: r.querySelector('.obname b')?.textContent ?? '',
      tag: r.querySelector('.obtag')?.textContent ?? '',
      facts: r.querySelector('.obfacts')?.textContent ?? '',
      closed: r.querySelector('.obclosed')?.textContent ?? '',
      buttons: [...r.querySelectorAll('button')].map((b) => b.textContent),
    })),
  );
const row = async (page, id) => (await rows(page)).find((r) => r.model === id);
const press = (page, id, label) => page.locator(`#pg-settings .offbrain .obbrain[data-model="${id}"] button`, { hasText: new RegExp(`^${label}$`) }).click();
const tagIs = (page, id, tag, ms = 10000) => page.waitForFunction(([id, tag]) => document.querySelector(`#pg-settings .offbrain .obbrain[data-model="${id}"] .obtag`)?.textContent === tag, [id, tag], { timeout: ms }).then(() => true, () => false);
// (stores save a moment after they change)
const stored = async (page) => (await page.waitForTimeout(600), page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.offlinebrain') ?? '{}')));
const toasts = (page) => page.evaluate(() => document.querySelector('#toasts')?.textContent ?? '');
const text = (page, sel) => page.locator(`#pg-settings .offbrain ${sel}`).first().textContent().then((t) => t ?? '', () => '');
const gpu = (page) => page.evaluate(() => window.__gpu);
const engine = (page) => page.evaluate(() => ({ loads: window.__ghostyOfflineEngine.loads, unloads: window.__ghostyOfflineEngine.unloads }));
const sheet = (page) => page.locator('.modal .confirm.sure');
const cached = (page, model) =>
  page.evaluate(async (model) => {
    const out = {};
    for (const name of ['webllm/model', 'webllm/config', 'webllm/wasm']) out[name] = (await (await caches.open(name)).keys()).map((r) => r.url).filter((u) => u.includes(`/mlc-ai/${model}/`) || u.includes(model.replace('-MLC', '_cs1k')));
    return out;
  }, model);
const shot = async (page, name) => {
  await page.evaluate(() => document.querySelector('#pg-settings .offbrain .obpick')?.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/bigbrain-${browserName}-${name}.png` });
};

// ---- 1. the picker, as the owner's iPhone sees it
const { ctx, page, net } = await signedIn();
const based = [];
page.on('request', (r) => {
  if (new URL(r.url()).pathname === '/api/training/base') based.push(JSON.parse(r.postData() ?? '{}').base);
});
let dialogs = [];
let answer = 'accept';
page.on('dialog', (d) => {
  dialogs.push(d.message());
  void (answer === 'accept' ? d.accept() : d.dismiss());
});
let list = await rows(page);
check(JSON.stringify(list.map((r) => r.name)) === JSON.stringify(['Qwen3 0.6B', 'Qwen3.5 0.8B', 'Qwen3.5 2B', 'Qwen3.5 4B']), `the picker's brains: ${JSON.stringify(list.map((r) => r.name))}`);
check(list[0]?.facts === '352 MB download · about 1.4 GB of memory when running · fits an 18 Pro Max: yes · the fallback', `0.6B line: "${list[0]?.facts}"`);
check(list[1]?.facts === '447 MB download · about 1.6 GB of memory when running · fits an 18 Pro Max: yes', `0.8B line: "${list[1]?.facts}"`);
check(list[2]?.facts === '1.1 GB download · about 2.2 GB of memory when running · fits an 18 Pro Max: yes', `2B line: "${list[2]?.facts}"`);
check(list[3]?.facts === '2.4 GB download · about 3.8 GB of memory when running · fits an 18 Pro Max: tight', `4B line: "${list[3]?.facts}"`);
check(list[0]?.tag === 'IN USE' && list.slice(1).every((r) => !r.tag), `only the 0.6B is marked in use: ${JSON.stringify(list.map((r) => r.tag))}`);
check(list.slice(1).every((r) => r.buttons.join() === 'GET'), `GET for the brains not on the phone: ${JSON.stringify(list.map((r) => r.buttons))}`);
check((await page.locator(`#pg-settings .offbrain .obbrain[data-model="${ID.two}"] button`).getAttribute('aria-label')) === 'Get Qwen3.5 2B: about 1.1 GB, on Wi-Fi', 'GET says the size to VoiceOver');
const cost = await text(page, '.obcost');
check(/bigger download, more of the phone’s memory and a slower first word/.test(cost) && /answers better/.test(cost) && /tap TEST after it loads/.test(cost), `the cost and gain line: "${cost}"`);
const hold0 = await text(page, '.obhold');
check(/^What this phone can hold: its graphics chip takes pieces of up to 1,024 MB, enough for every brain here\. How much graphics memory a page may use is only known by trying: iOS closes a page that asks for too much\.$/.test(hold0), `the can-hold line: "${hold0}"`);
await shot(page, 'picker');

// the 0.6B on the phone first (the fallback), as the owner has it today: DOWNLOAD stores it, loads nothing
await page.locator('#pg-settings .offbrain > .bd > .keyrow button', { hasText: 'DOWNLOAD' }).click();
await page.waitForFunction(() => /READY/.test(document.querySelector('#pg-settings .pn.offbrain h3')?.textContent ?? ''), null, { timeout: 15000 }).catch(() => problems.push('the 0.6B did not download'));
check((await engine(page)).loads.length === 0, `DOWNLOAD loaded nothing: ${JSON.stringify((await engine(page)).loads)}`);
check((await cached(page, ID.small))['webllm/model'].length === SHARDS + 2, `the 0.6B's pieces are in WebLLM's store: ${JSON.stringify(await cached(page, ID.small))}`);

// ---- 2. GET: never on mobile data; asked first on Wi-Fi, with the size; "no" changes nothing
await page.evaluate(() => (window.__net = 'cellular'));
await press(page, ID.two, 'GET');
await page.waitForTimeout(400);
check(/You are on mobile data: Qwen3\.5 2B is about 1\.1 GB\. Join Wi-Fi/.test(await toasts(page)), `mobile data refused: "${await toasts(page)}"`);
check(dialogs.length === 0, 'no question on mobile data');
await page.evaluate(() => (window.__net = 'wifi'));
answer = 'dismiss';
const hitsBefore = net.hits.length;
await press(page, ID.two, 'GET');
await page.waitForTimeout(400);
check(/^Download Qwen3\.5 2B\? About 1\.1 GB, once, so only on Wi-Fi\. It is only stored: nothing is loaded until you tap USE, which first checks this phone can run it \(it needs about 2\.2 GB of memory when running; if your phone cannot give it that, Qwen3 0\.6B takes over\)\.$/.test(dialogs[0] ?? ''), `the question: "${dialogs[0]}"`);
check((await stored(page)).model === ID.small && net.hits.length === hitsBefore, 'saying no changes nothing and fetches nothing');
answer = 'accept';
const unloadsBefore = (await engine(page)).unloads;
await page.evaluate(() => ((window.__logs = []), (window.__lines = [])));
net.most = 0;
await press(page, ID.two, 'GET');
check(await tagIs(page, ID.two, 'ON THIS PHONE', 20000), 'the 2B is not ON THIS PHONE after GET');
const got = await cached(page, ID.two);
check(got['webllm/model'].length === SHARDS + 2 && got['webllm/config'].length === 1 && got['webllm/wasm'].length === 1, `the 2B's pieces in WebLLM's own stores and keys: ${JSON.stringify(got)}`);
check(got['webllm/model'].includes('https://huggingface.co/mlc-ai/Qwen3.5-2B-q4f16_1-MLC/resolve/dd74e9c8a20c4546df85c844103bff87b6dcacad/params_shard_3.bin'), 'a shard is keyed by its full pinned address, as WebLLM looks for it');
check(net.most === 1, `one fetch at a time (at most ${net.most} at once)`);
const logs = await page.evaluate(() => window.__logs);
check(JSON.stringify(logs.filter((l) => l.of).map((l) => l.piece)) === JSON.stringify([3, 4, 5, 6, 7, 8]) && logs.every((l) => l.model === ID.two && l.at > 0), `the log written before each piece: ${JSON.stringify(logs.map((l) => [l.piece, l.of, l.bytes]))}`);
check(logs.find((l) => l.piece === 6)?.bytes === 2 * SHARD && logs.find((l) => l.piece === 6)?.of === PIECES, `the log says where it was: ${JSON.stringify(logs.find((l) => l.piece === 6))}`);
check((await page.evaluate(() => localStorage.getItem('ghosty.offlinebrain.getting'))) === null, 'a finished download clears the log');
const lines = await page.evaluate(() => window.__lines);
check(lines.includes('piece 6 of 8 · 3 MB of 6 MB') && lines.every((l) => /^piece [1-8] of 8 · \d MB of 6 MB$/.test(l)), `the progress line (the piece being fetched, the MB stored before it): ${JSON.stringify(lines)}`);
const g1 = await gpu(page);
check(g1.devices === 0 && g1.buffers === 0, `GET asked for no graphics device or buffer: ${JSON.stringify(g1)}`);
check(!(await engine(page)).loads.includes(ID.two), 'GET loaded nothing');
check((await engine(page)).unloads > unloadsBefore, 'the brain in use left memory before the download');
list = await rows(page);
check(list[0]?.tag === 'IN USE' && list[2]?.buttons.join() === 'USE,REMOVE', `the 0.6B stays in use, the 2B waits for USE: ${JSON.stringify(list.map((r) => [r.tag, r.buttons]))}`);
check(/Qwen3\.5 2B is on this phone: tap USE to load it/.test(await toasts(page)), `GET's toast: "${await toasts(page)}"`);
check(based.length === 0, `GET does not move the training: ${JSON.stringify(based)}`);
await shot(page, 'got-2b');

// ---- 3. iOS closes Ghosty half-way through GET (the 4B): the next open says where it stopped; CONTINUE carries on
net.hang.add('params_shard_2.bin');
await press(page, ID.four, 'GET');
await page.waitForFunction(() => window.__logs.at(-1)?.piece === 6 && window.__logs.at(-1)?.model === 'Qwen3.5-4B-q4f16_1-MLC', null, { timeout: 10000 }).catch(() => problems.push('GET of the 4B never reached piece 6'));
await page.waitForTimeout(200);
await killAndReopen(page);
const afterKill = net.hits.length;
const carry = await text(page, '.obgetting');
check(carry === 'Ghosty was closed while getting Qwen3.5 4B at piece 6 of 8. Tap CONTINUE to carry on from there.', `the carry-on line: "${carry}"`);
check((await row(page, ID.four))?.buttons.join() === 'CONTINUE,REMOVE', `CONTINUE for the 4B: ${JSON.stringify(await row(page, ID.four))}`);
await page.waitForTimeout(1500);
check(net.hits.length === afterKill, `nothing restarts by itself: ${net.hits.slice(afterKill)}`);
await shot(page, 'carry-on');
net.hang.clear();
dialogs = [];
const before4 = net.hits.length;
await press(page, ID.four, 'CONTINUE');
check(await tagIs(page, ID.four, 'ON THIS PHONE', 20000), 'CONTINUE did not finish the 4B');
check(/^Carry on getting Qwen3\.5 4B\? The pieces already on this phone are kept/.test(dialogs[0] ?? ''), `CONTINUE asks first: "${dialogs[0]}"`);
const fetched = net.hits.slice(before4).map((u) => u.split('/').pop());
check(JSON.stringify(fetched) === JSON.stringify(['params_shard_2.bin', 'params_shard_3.bin']), `CONTINUE fetched only what was missing: ${JSON.stringify(fetched)}`);
check((await text(page, '.obgetting')) === '' && (await page.evaluate(() => localStorage.getItem('ghosty.offlinebrain.getting'))) === null, 'the carry-on line and the log are gone');
check((await gpu(page)).devices === 0, 'still no graphics device');

// ---- 4. USE: the warning before the first load; KEEP IT loads nothing; LOAD IT loads
await press(page, ID.two, 'USE');
await sheet(page).waitFor({ state: 'visible', timeout: 4000 }).catch(() => problems.push('USE of the 2B gave no warning'));
const warn = (await page.locator('.modal').last().textContent().catch(() => '')) ?? '';
check(/Load Qwen3\.5 2B\?/.test(warn) && /Loading the 2B takes about 2\.2 GB of graphics memory\. If the phone cannot hold it, Ghosty will close and come back on the 0\.6B\./.test(warn), `the warning: "${warn}"`);
await page.screenshot({ path: `${out}/bigbrain-${browserName}-warning.png` });
await sheet(page).locator('button', { hasText: 'KEEP IT' }).click();
await page.waitForTimeout(400);
check(!(await engine(page)).loads.includes(ID.two) && (await stored(page)).model === ID.small, 'KEEP IT loads nothing and changes nothing');
await press(page, ID.two, 'USE');
await sheet(page).locator('button.sureyes').click().catch(() => problems.push('no LOAD IT in the warning'));
check(await tagIs(page, ID.two, 'IN USE'), 'the 2B is not IN USE after USE');
check((await engine(page)).loads.at(-1) === ID.two, `USE loaded the 2B: ${JSON.stringify((await engine(page)).loads)}`);
check((await page.evaluate(() => localStorage.getItem('ghosty.offlinebrain.loading'))) === null, 'the load record is cleared after the load');
let st = await stored(page);
check(st.held?.['qwen3.5-2b']?.s === 'loaded', `the 2B is remembered as having run here: ${JSON.stringify(st.held)}`);
await page.waitForTimeout(500);
check(based.join() === 'qwen3.5-2b', `the weekly training was told the new base: ${JSON.stringify(based)}`);
check(/Ready on this phone: Qwen3\.5 2B \(1\.1 GB\)/.test(await text(page, '.obstate')), 'the state line names the 2B');
// USE is a big change: 12 s to UNDO it, back to the brain that was and its base
const undoBar = page.locator('.rcundo.undofloat');
await undoBar.waitFor({ state: 'visible', timeout: 4000 }).catch(() => problems.push('USE showed no UNDO bar'));
check(/Offline brain: Qwen3\.5 2B/.test((await undoBar.textContent().catch(() => '')) ?? ''), 'the UNDO bar says what changed');
await undoBar.locator('button', { hasText: 'UNDO' }).click();
check(await tagIs(page, ID.small, 'IN USE', 5000), 'UNDO did not go back to the 0.6B');
await page.waitForTimeout(500);
check(based.slice(-2).join() === 'qwen3.5-2b,qwen3-0.6b', `the training followed USE, then UNDO: ${JSON.stringify(based)}`);
// a brain that has run here is switched to again without the warning
await press(page, ID.two, 'USE');
check(await tagIs(page, ID.two, 'IN USE', 5000), 'USE did not switch to the 2B again');
check(!(await sheet(page).isVisible().catch(() => false)), 'no warning once the 2B has run here');
await page.locator('.rcundo.undofloat button', { hasText: /^×$|CLOSE|OK/ }).click().catch(() => undefined);

// TEST on the chosen brain: the speed line, then the quick check, all on the 2B
await page.evaluate(() => (window.__ghostyOfflineEngine.calls = []));
await page.locator('#pg-settings .offbrain button', { hasText: /^TEST$/ }).click();
await page.waitForFunction(() => /tokens a second[\s\S]*QUICK CHECK on Qwen3\.5 2B: \d+ of 20 right as in chat/.test(document.querySelector('#pg-settings .offbrain .obtest')?.textContent ?? ''), null, { timeout: 60000 }).catch(async () => problems.push(`TEST did not show the speed and the quick check: "${await text(page, '.obtest')}"`));
const asked = await page.evaluate(() => window.__ghostyOfflineEngine.calls);
check(asked.length === 21 && asked.every((c) => c.model === ID.two), `every TEST question went to the 2B: ${asked.length} calls`);
await page.waitForTimeout(600);
const filed = await page.evaluate(() => (JSON.parse(localStorage.getItem('ghosty.reportcard') ?? '{}').history ?? []).at(-1));
check(filed?.model === 'Qwen3.5-2B-q4f16_1-MLC@dd74e9c' && filed?.items?.length === 20, `filed in the report card under the 2B: ${JSON.stringify({ model: filed?.model })}`);
await shot(page, 'tested-2b');

// iOS closes Ghosty while the 4B loads (USE, after the warning): the next open says so and is back on the 0.6B
await page.evaluate((id) => (window.__ghostyOfflineEngine.hangFor = id), ID.four);
await press(page, ID.four, 'USE');
await sheet(page).locator('button.sureyes').click().catch(() => problems.push('no warning before the first load of the 4B'));
await page.waitForFunction(() => JSON.parse(localStorage.getItem('ghosty.offlinebrain.loading') ?? 'null')?.loading === 'Qwen3.5-4B-q4f16_1-MLC', null, { timeout: 5000 }).catch(() => problems.push('no load record before the 4B loaded'));
await page.waitForTimeout(400); // (long enough for the store to save the 4B as the brain in use)
await killAndReopen(page);
st = await stored(page);
check(st.model === ID.small, `the 0.6B is the brain in use after the close: ${st.model}`);
check(st.held?.['qwen3.5-4b']?.s === 'closed', `the 4B is remembered as having closed Ghosty: ${JSON.stringify(st.held)}`);
check((await page.evaluate(() => localStorage.getItem('ghosty.offlinebrain.loading'))) === null, 'the load record is cleared on opening');
const closedLine = await text(page, '.obfell');
check(/^Loading Qwen3\.5 4B closed Ghosty \(\d+ \w+, \d\d:\d\d\): the phone could not hold it\. Ghosty is back on Qwen3 0\.6B\. Qwen3\.5 4B's download stays on this phone, and USE asks before it tries again\.$/.test(closedLine), `the words after the close: "${closedLine}"`);
const r4 = await row(page, ID.four);
check(r4?.tag === 'ON THIS PHONE' && r4?.buttons.join() === 'USE,REMOVE' && /^closed Ghosty on this phone \(\d+ \w+\): USE asks before trying again$/.test(r4?.closed ?? ''), `the 4B after the close: ${JSON.stringify(r4)}`);
check((await engine(page)).loads.length === 0, `nothing loaded on opening: ${JSON.stringify((await engine(page)).loads)}`);
check(/closed Ghosty loading Qwen3\.5 4B/.test(await text(page, '.obhold')) && /has run Qwen3\.5 2B/.test(await text(page, '.obhold')), `the can-hold line remembers: "${await text(page, '.obhold')}"`);
await shot(page, 'closed-4b');
// USE asks again before another try (KEEP IT: nothing)
await press(page, ID.four, 'USE');
await sheet(page).waitFor({ state: 'visible', timeout: 4000 }).catch(() => problems.push('USE of the 4B did not ask again'));
check(/It closed Ghosty on this phone on \d+ \w+\. Loading the 4B takes about 3\.8 GB of graphics memory/.test((await page.locator('.modal').last().textContent().catch(() => '')) ?? ''), 'the question says it closed Ghosty before');
await sheet(page).locator('button', { hasText: 'KEEP IT' }).click();
await page.waitForTimeout(400);
check((await engine(page)).loads.length === 0 && (await stored(page)).model === ID.small, 'KEEP IT after a close loads nothing');

// out of memory said by WebGPU at USE (the 2B, which ran here before): the 0.6B takes over in plain words
await page.evaluate((id) => (window.__ghostyOfflineEngine.failFor = id), ID.two);
await press(page, ID.two, 'USE');
await page.waitForFunction(() => /needed more memory/.test(document.querySelector('#pg-settings .offbrain .obfell')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => problems.push('no words when the 2B ran out of memory'));
const fell = await text(page, '.obfell');
check(/^Qwen3\.5 2B needed more memory than this phone could give it just now, so Ghosty is using Qwen3 0\.6B instead\. Qwen3\.5 2B stays on this phone: close other apps and choose it again to try once more, or REMOVE it to free 1\.1 GB\.$/.test(fell), `the fallback words: "${fell}"`);
check((await stored(page)).model === ID.small && (await tagIs(page, ID.small, 'IN USE', 3000)), 'the 0.6B took over');
check(!(await engine(page)).loads.includes(ID.small), 'USE that failed does not load the 0.6B in its place (a reply will)');
// and when a reply loads a brain that no longer fits (USE the 2B again: fine; then it fails at TEST's load)
await page.evaluate(() => (window.__ghostyOfflineEngine.failFor = ''));
await press(page, ID.two, 'USE');
await sheet(page).locator('button.sureyes').click({ timeout: 3000 }).catch(() => undefined); // (asked again after running out of memory)
check(await tagIs(page, ID.two, 'IN USE', 5000), 'USE did not switch to the 2B');
check(!(await page.locator('#pg-settings .offbrain .obfell').isVisible()), 'choosing again clears the fallback words');
await page.evaluate((id) => {
  window.__ghostyOfflineEngine.failFor = id;
  window.__ghostyOfflineEngine.calls = [];
}, ID.two);
await page.locator('#pg-settings .offbrain button', { hasText: /^TEST$/ }).click();
await page.waitForFunction(() => /tokens a second[\s\S]*QUICK CHECK on Qwen3 0\.6B: \d+ of 20/.test(document.querySelector('#pg-settings .offbrain .obtest')?.textContent ?? ''), null, { timeout: 60000 }).catch(async () => problems.push(`TEST after the 2B failed to load did not answer on the 0.6B: "${await text(page, '.obtest')}"`));
const asked2 = await page.evaluate(() => window.__ghostyOfflineEngine.calls);
check(asked2.length > 0 && asked2.every((c) => c.model === ID.small), `the answers came from the 0.6B: ${[...new Set(asked2.map((c) => c.model))]}`);

// REMOVE frees the 4B (asked first, in a one-tap confirm); KEEP IT changes nothing
await page.evaluate(() => (window.__ghostyOfflineEngine.failFor = ''));
await press(page, ID.four, 'REMOVE');
await sheet(page).waitFor({ state: 'visible', timeout: 4000 }).catch(() => problems.push('REMOVE did not ask first'));
const asks = (await page.locator('.modal').last().textContent().catch(() => '')) ?? '';
check(/Remove this brain\?/i.test(asks) && /Qwen3\.5 4B comes off this phone and frees about 2\.4 GB\./.test(asks), `REMOVE asks: "${asks}"`);
await sheet(page).locator('button', { hasText: 'KEEP IT' }).click();
await page.waitForTimeout(400);
check((await stored(page)).have.includes(ID.four), 'KEEP IT leaves the 4B on the phone');
dialogs = [];
await press(page, ID.four, 'REMOVE');
await sheet(page).locator('button.sureyes').click().catch(() => problems.push('no REMOVE in the confirm'));
await page.waitForFunction((id) => [...(document.querySelector(`#pg-settings .offbrain .obbrain[data-model="${id}"]`)?.querySelectorAll('button') ?? [])].some((b) => b.textContent === 'GET'), ID.four, { timeout: 5000 }).catch(() => problems.push('REMOVE did not take the 4B off the phone'));
check(dialogs.length === 0, `no browser dialog for USE or REMOVE: ${JSON.stringify(dialogs)}`);
check(!(await stored(page)).have.includes(ID.four) && (await cached(page, ID.four))['webllm/model'].length === 0, 'the 4B and its pieces are gone');

// ---- 5. iPhone width: nothing sideways
const fit = await page.evaluate(() => {
  const pn = document.querySelector('#pg-settings .offbrain');
  const w = pn.getBoundingClientRect();
  const over = [...pn.querySelectorAll('.obbrain, .obbrain *, .obcost, .obfell, .obgetting, .obhold')].filter((e) => e.getBoundingClientRect().right > w.right + 1).map((e) => `${e.className}: ${(e.textContent ?? '').slice(0, 30)}`);
  return { doc: document.documentElement.scrollWidth, vw: innerWidth, over };
});
check(fit.doc <= fit.vw && fit.over.length === 0, `sideways: ${JSON.stringify(fit)}`);
check((await gpu(page)).devices === 0 && (await gpu(page)).buffers === 0, 'no graphics device was ever asked for by the page itself');
// (the preview brain is shared by every spec run: its training goes back to the 0.6B, leaving nothing to roll back to)
const putBack = async (p) => p.evaluate(async (k) => (await fetch('/api/training/base', { method: 'POST', body: '{"base":"qwen3-0.6b"}', headers: { 'content-type': 'application/json', 'x-ghosty': '1', 'x-ghosty-key': k } })).json(), KEY);
const back = await putBack(page);
check(back.base === 'qwen3-0.6b', `the preview brain put back: ${JSON.stringify({ base: back.base })}`);
await ctx.close();

// a browser that says how much memory it has (Chrome on a laptop: 8 GB)
const chrome = await signedIn({ memory: 8 });
const lines8 = (await rows(chrome.page)).map((r) => (r.facts.split(' · ').at(-1) === 'the fallback' ? r.facts.split(' · ').at(-2) : r.facts.split(' · ').at(-1)));
check(JSON.stringify(lines8) === JSON.stringify(['fits this device (8 GB): yes', 'fits this device (8 GB): yes', 'fits this device (8 GB): tight', 'fits this device (8 GB): no']), `with the browser's 8 GB: ${JSON.stringify(lines8)}`);
await chrome.ctx.close();

// ---- 6. a graphics chip with Safari's default limits: the 2B is refused before any load; the 0.8B is the step
const safari = await signedIn({ limits: SAFARI_DEFAULT });
const sp = safari.page;
const sBased = [];
sp.on('request', (r) => {
  if (new URL(r.url()).pathname === '/api/training/base') sBased.push(JSON.parse(r.postData() ?? '{}').base);
});
sp.on('dialog', (d) => void d.accept());
check(/^What this phone can hold: its graphics chip takes pieces of up to 128 MB, enough for the 0\.6B, 0\.8B\./.test(await text(sp, '.obhold')), `the can-hold line with Safari's limits: "${await text(sp, '.obhold')}"`);
await press(sp, ID.two, 'GET');
check(await tagIs(sp, ID.two, 'ON THIS PHONE', 20000), 'GET of the 2B did not finish (Safari limits)');
await press(sp, ID.two, 'USE');
await sp.waitForTimeout(800);
const refused = await text(sp, '.obtest');
check(refused === 'Qwen3.5 2B has one piece of 243 MB that must sit in the graphics chip in one go, and this phone gives a web page pieces of at most 128 MB. It cannot run here, so Ghosty does not try.', `the 2B refused in plain words: "${refused}"`);
check(!(await sheet(sp).isVisible().catch(() => false)), 'no warning for a brain that cannot run');
check((await engine(sp)).loads.length === 0 && (await stored(sp)).model === ID.small, 'nothing loaded, the 0.6B still in use');
check((await stored(sp)).held?.['qwen3.5-2b']?.s === 'refused' && /could not start Qwen3\.5 2B/.test(await text(sp, '.obhold')), `remembered as could not start: "${await text(sp, '.obhold')}"`);
await shot(sp, 'refused-2b');
await press(sp, ID.mid, 'GET');
check(await tagIs(sp, ID.mid, 'ON THIS PHONE', 20000), 'GET of the 0.8B did not finish');
await press(sp, ID.mid, 'USE');
const midWarn = await sheet(sp).waitFor({ state: 'visible', timeout: 4000 }).then(() => sp.locator('.modal').last().textContent(), () => '');
check(/Loading the 0\.8B takes about 1\.6 GB of graphics memory\. If the phone cannot hold it, Ghosty will close and come back on the 0\.6B\./.test(midWarn ?? ''), `the 0.8B's warning: "${midWarn}"`);
await sheet(sp).locator('button.sureyes').click().catch(() => problems.push('no LOAD IT for the 0.8B'));
check(await tagIs(sp, ID.mid, 'IN USE', 5000), 'the 0.8B is not IN USE after USE');
check((await engine(sp)).loads.at(-1) === ID.mid, 'USE loaded the 0.8B');
const midRows = await rows(sp);
check(midRows.filter((r) => r.tag.startsWith('IN USE')).map((r) => r.model).join() === ID.mid, `only the 0.8B is marked in use: ${JSON.stringify(midRows.map((r) => r.tag))}`);
await sp.waitForTimeout(600);
check(sBased.length === 0, `the 0.8B leaves the training's base alone: ${JSON.stringify(sBased)}`);
await shot(sp, 'middle-0.8b');

// ---- 7. the owner's phone as the old GET left it: the 2B "in use", never loaded, its files whole (download, then a
// load that closed Ghosty). On opening: back on the 0.6B, the 2B marked, nothing loaded.
await sp.evaluate((two) => {
  const s = JSON.parse(localStorage.getItem('ghosty.offlinebrain') ?? '{}');
  localStorage.setItem('ghosty.offlinebrain', JSON.stringify({ ...s, model: two, downloaded: false, have: (s.have ?? []).filter((x) => x !== two), held: {}, guarded: false, fellBack: '' }));
}, ID.two);
await killAndReopen(sp);
await sp.waitForTimeout(600);
st = await stored(sp);
check(st.model === ID.small && st.held?.['qwen3.5-2b']?.s === 'closed' && st.have.includes(ID.two), `the old state put right: ${JSON.stringify({ model: st.model, held: st.held, have: st.have })}`);
check(/^Loading Qwen3\.5 2B closed Ghosty the last time it was tried: the phone could not hold it\. Ghosty is back on Qwen3 0\.6B/.test(await text(sp, '.obfell')), `the words for the old state: "${await text(sp, '.obfell')}"`);
check((await engine(sp)).loads.length === 0 && (await gpu(sp)).devices === 0, 'nothing loaded on opening');
await shot(sp, 'legacy-2b');
await putBack(sp);
await safari.ctx.close();

await browser.close();
reported = true;
if (problems.length) {
  console.error(`bigbrain spec (${browserName}): ${problems.length} problem(s)\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`bigbrain spec (${browserName}): all good — the picker, GET stores pieces one at a time with no graphics memory, the carry-on after a close, USE's limits check and warning, the closed-Ghosty mark, the 0.8B step, the 0.6B fallback, REMOVE, no sideways scroll`);
