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
//  8. (25 Oct: "you have to download the offline brain every time") what GET stored is found on the next open: the
//     panel counts it ("On this phone: … whole") and says ON THIS PHONE before USE; WebLLM 0.2.85's own lookups
//     (hasModelInCache, and the match its ArtifactCache makes for every file a load reads) find every piece; USE then
//     fetches nothing; and a new version of Ghosty (its service worker replaced) leaves every download where it was;
//  9. (25 Oct: "i still can't download the biggest one") a big piece comes in Range-request parts, one at a time, the
//     log written before each part; a close mid-piece carries on at that piece's next part, and the stored piece is
//     byte-identical to the file served;
// 10. what the phone holds, said honestly: a GET the space cannot hold is refused before a byte comes, in plain words;
//     persist() asked once and its answer shown; a piece gone between opens named; Safari and the Home Screen app.
// 11. (31 Oct: "when i try to sit an exam on any brain it just crashes and closes", at question 1 of 10 on the 0.6B) a
//     reply is written under a crash record of its own; found on opening, the 0.6B is marked as having closed Ghosty
//     while answering, in plain words, TEST and USE ask before it is tried again, the smaller Qwen2.5 0.5B is offered
//     first (GET); stored and USEd, it is the brain in use, its reply writes and clears the record, and SCHOOL sits
//     papers on it.
// 12. (1 Nov: "the brain school thing is still crashing") the 0.5B's answer closed Ghosty too: the floor (SmolLM2 360M,
//     "the tiniest") is offered first; SCHOOL shows ONE button, "GET SmolLM2 360M (212 MB) and sit": on mobile data it
//     waits with its line and fetches nothing; on Wi-Fi it gets the floor at its pinned commit, loads it and the paper is
//     sat on it, the 0.5B still his choice.
//   BASE=http://localhost:8892 node tests/bigbrain.spec.mjs [outDir]
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { engine as browserName, launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, openPanel, openSection } from './nav.mjs';

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
const ID = { least: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', small: 'Qwen3-0.6B-q4f16_1-MLC', mid: 'Qwen3.5-0.8B-q4f16_1-MLC', two: 'Qwen3.5-2B-q4f16_1-MLC', four: 'Qwen3.5-4B-q4f16_1-MLC', floor: 'SmolLM2-360M-Instruct-q4f16_1-MLC' };
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

// Each brain as the app pins it (offline/models.ts): WebLLM's lookups below build its addresses from these.
const PINS = {
  [ID.small]: { rev: '8c14ce481d4c692769976ad52afea453a102df19', lib: 'Qwen3-0.6B-q4f16_1_cs1k-webgpu.wasm' },
  [ID.mid]: { rev: '0ec138972555613c1d7812a821778ad0398c8790', lib: 'Qwen3.5-0.8B-q4f16_1_cs1k-webgpu.wasm' },
  [ID.two]: { rev: 'dd74e9c8a20c4546df85c844103bff87b6dcacad', lib: 'Qwen3.5-2B-q4f16_1_cs1k-webgpu.wasm' },
  [ID.four]: { rev: '44b42469f9e192814bfd90440e3b377d89ba7a13', lib: 'Qwen3.5-4B-q4f16_1_cs1k-webgpu.wasm' },
  [ID.floor]: { rev: '3a622fd89e0216e8bb10c410c007c786baa8a033', lib: 'SmolLM2-360M-Instruct-q4f16_1_cs1k-webgpu.wasm' },
};
/** A shard's bytes: different in every shard and every position, so a part put back in the wrong place shows. */
const shardBody = (file) => {
  const k = Number(/(\d+)\.bin$/.exec(file)?.[1] ?? 0);
  const b = Buffer.alloc(SHARD);
  for (let j = 0; j < SHARD; j++) b[j] = (j * 31 + (j >> 9) * 7 + k * 101) & 255;
  return b;
};
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

const fakes = ({ memory, limits, pins, storage }) => {
  // The space the browser says Ghosty has, and whether it keeps it for good (a spec may set them; else the browser's own).
  window.__persistAsked = 0;
  if (storage) {
    let kept = false;
    StorageManager.prototype.estimate = async () => ({ quota: storage.quota, usage: storage.usage });
    StorageManager.prototype.persisted = async () => kept;
    StorageManager.prototype.persist = async () => (window.__persistAsked++, (kept = storage.grant));
  }
  // What WebLLM 0.2.85 looks up when it loads a brain (worker.mjs → MLCEngine.reload), asked of the real vendored
  // web-llm.mjs: hasModelInCache, then every file the load reads, matched the way its ArtifactCache.addToCache
  // matches (caches.open(scope), match(new Request(url))): a miss would be fetched (cache.add), so it is counted.
  window.__webllmMissed = [];
  window.__webllmLooked = [];
  window.__webllmLoad = async (model) => {
    const pin = pins[model];
    if (!pin) return;
    const base = `https://huggingface.co/mlc-ai/${model}/resolve/${pin.rev}/`;
    const lib = new URL(`/vendor/webllm/libs/${pin.lib}`, location.origin).href;
    const webllm = await import('/vendor/webllm/web-llm.mjs');
    const inCache = await webllm.hasModelInCache(model, { model_list: [{ model: base, model_id: model, model_lib: lib }] });
    const take = async (scope, url) => {
      const c = await caches.open(scope);
      const hit = await c.match(new Request(url));
      if (hit) return hit;
      window.__webllmMissed.push(url);
      await c.add(new Request(url));
      return c.match(new Request(url));
    };
    const cfg = await (await take('webllm/config', new URL('mlc-chat-config.json', base).href)).json();
    await take('webllm/wasm', lib);
    if (cfg.tokenizer_files?.includes('tokenizer.json')) await take('webllm/model', new URL('tokenizer.json', base).href);
    const list = await (await take('webllm/model', new URL('tensor-cache.json', base).href)).json();
    for (const r of list.records) await take('webllm/model', new URL(r.dataPath, base).href);
    window.__webllmLooked.push({ model, inCache });
  };
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
    async load(model) {
      this.loads.push(model);
      // what the real load would read from the cache first (a miss is a fetch, counted)
      await window.__webllmLoad(model);
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

/**
 * Every huggingface.co address answered with the stand-in, one at a time checked; `hang` files never answer, nor does a
 * part in `hangRange` ("file@first byte"). A Range request gets its part (206), as Hugging Face sends it.
 */
function standIn(ctx) {
  const net = { hits: [], ranges: [], inflight: 0, most: 0, hang: new Set(), hangRange: new Set() };
  void ctx.route('https://huggingface.co/**', async (route) => {
    const req = route.request();
    const url = req.url();
    const file = url.split('/').pop();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'range', 'access-control-allow-methods': 'GET, HEAD' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const range = /^bytes=(\d+)-(\d+)$/.exec((await req.allHeaders()).range ?? '');
    net.hits.push(url);
    net.ranges.push(`${file}@${range ? `${range[1]}-${range[2]}` : 'all'}`);
    if (net.hang.has(file) || (range && net.hangRange.has(`${file}@${range[1]}`))) return; // the connection just stops (never answered)
    net.inflight++;
    net.most = Math.max(net.most, net.inflight);
    await new Promise((r) => setTimeout(r, file.startsWith('params_shard') ? 120 : 20));
    net.inflight--;
    const whole = file.startsWith('params_shard') ? shardBody(file) : STANDIN[file];
    if (whole === undefined) return route.fulfill({ status: 404, body: 'no such file', headers: cors });
    const type = { 'content-type': file.endsWith('.json') ? 'application/json' : 'application/octet-stream' };
    if (range) {
      const buf = Buffer.from(whole);
      const [a, b] = [Number(range[1]), Math.min(Number(range[2]), buf.length - 1)];
      return route.fulfill({ status: 206, body: buf.subarray(a, b + 1), headers: { ...cors, ...type, 'content-range': `bytes ${a}-${b}/${buf.length}` } }).catch(() => undefined);
    }
    await route.fulfill({ status: 200, body: whole, headers: { ...cors, ...type } }).catch(() => undefined);
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

// (a phone with room: 64 GB for Ghosty, and kept for good once asked; Chromium's own figure for a test context is small)
const ROOMY = { quota: 64e9, usage: 1e8, grant: true };
async function signedIn({ memory = null, limits = GENEROUS, storage = ROOMY, userAgent = undefined } = {}) {
  const ctx = await browser.newContext({ viewport: PHONE, ...UK, ...(userAgent ? { userAgent } : {}) });
  const net = standIn(ctx);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
  await page.addInitScript(fakes, { memory, limits, pins: PINS, storage });
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
/** GET and CONTINUE ask in Ghosty's own sheet (never the browser's confirm()): its words, then KEEP IT or its yes. */
const answerSheet = async (page, yes) => {
  const shown = await sheet(page).waitFor({ state: 'visible', timeout: 4000 }).then(() => true, () => false);
  if (!shown) return '';
  const words = (await sheet(page).locator('p.note').textContent().catch(() => '')) ?? '';
  await sheet(page).locator(yes ? 'button.sureyes' : 'button:not(.sureyes)').first().click();
  await page.waitForTimeout(200);
  return words;
};
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
check(dialogs.length === 0 && !(await sheet(page).isVisible().catch(() => false)), 'no question on mobile data');
await page.evaluate(() => (window.__net = 'wifi'));
const hitsBefore = net.hits.length;
await press(page, ID.two, 'GET');
const asked2B = await answerSheet(page, false);
check(/^Download Qwen3\.5 2B\? About 1\.1 GB, once, so only on Wi-Fi\. It is only stored: nothing is loaded until you tap USE, which first checks this phone can run it \(it needs about 2\.2 GB of memory when running; if your phone cannot give it that, Qwen3 0\.6B takes over\)\.$/.test(asked2B), `the question, in Ghosty's own sheet: "${asked2B}"`);
check(dialogs.length === 0, `GET asks in Ghosty's sheet, not the browser's: ${JSON.stringify(dialogs)}`);
check((await stored(page)).model === ID.small && net.hits.length === hitsBefore, 'saying no changes nothing and fetches nothing');
const unloadsBefore = (await engine(page)).unloads;
await page.evaluate(() => ((window.__logs = []), (window.__lines = [])));
net.most = 0;
await press(page, ID.two, 'GET');
await answerSheet(page, true);
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
check(/Qwen3\.5 2B is on this phone: tap Use to load it/.test(await toasts(page)), `GET's toast (the button named as it shows, not lower-cased): "${await toasts(page)}"`);
check(based.length === 0, `GET does not move the training: ${JSON.stringify(based)}`);
await shot(page, 'got-2b');

// ---- 8. what GET stored is found on the next open (25 Oct: "you have to download the offline brain every time")
const ONPHONE = 'On this phone: Qwen3 0.6B whole (352 MB) · Qwen3.5 2B whole (1.1 GB).';
check((await text(page, '.obkeep .obhere')) === ONPHONE, `the pieces on this phone, counted in the cache: "${await text(page, '.obkeep .obhere')}"`);
await killAndReopen(page);
const hitsReopened = net.hits.length;
// before USE is tapped: the panel says the 2B is here, from the pieces really in the cache
check(await tagIs(page, ID.two, 'ON THIS PHONE', 5000), `after reopening, the 2B is not ON THIS PHONE: ${JSON.stringify(await row(page, ID.two))}`);
check((await row(page, ID.two))?.buttons.join() === 'USE,REMOVE', `after reopening, the 2B offers USE (not GET): ${JSON.stringify(await row(page, ID.two))}`);
check((await text(page, '.obkeep .obhere')) === ONPHONE, `after reopening, the same pieces: "${await text(page, '.obkeep .obhere')}"`);
check((await page.locator('#pg-settings .offbrain .obgone').count()) === 0, 'nothing named as gone after a plain reopen');
// WebLLM 0.2.85's own lookups, as its load makes them, find every piece: no fetch
await page.evaluate(() => window.__webllmLoad('Qwen3.5-2B-q4f16_1-MLC'));
const looked = await page.evaluate(() => ({ looked: window.__webllmLooked, missed: window.__webllmMissed }));
check(looked.looked.at(-1)?.inCache === true && looked.missed.length === 0, `WebLLM's own lookups after reopening: ${JSON.stringify(looked)}`);
check(net.hits.length === hitsReopened, `reopening and WebLLM's lookups fetched nothing: ${net.hits.slice(hitsReopened)}`);

// ---- 3. iOS closes Ghosty half-way through GET (the 4B): the next open says where it stopped; CONTINUE carries on
net.hang.add('params_shard_2.bin');
await press(page, ID.four, 'GET');
await answerSheet(page, true);
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
const askedOn = await answerSheet(page, true);
check(await tagIs(page, ID.four, 'ON THIS PHONE', 20000), 'CONTINUE did not finish the 4B');
check(/^Carry on getting Qwen3\.5 4B\? The pieces already on this phone are kept/.test(askedOn) && dialogs.length === 0, `CONTINUE asks first, in Ghosty's sheet: "${askedOn}" ${JSON.stringify(dialogs)}`);
const fetched = net.hits.slice(before4).map((u) => u.split('/').pop());
check(JSON.stringify(fetched) === JSON.stringify(['params_shard_2.bin', 'params_shard_3.bin']), `CONTINUE fetched only what was missing: ${JSON.stringify(fetched)}`);
check((await text(page, '.obgetting')) === '' && (await page.evaluate(() => localStorage.getItem('ghosty.offlinebrain.getting'))) === null, 'the carry-on line and the log are gone');
check((await gpu(page)).devices === 0, 'still no graphics device');

// ---- 4. USE: the warning before the first load; KEEP IT loads nothing; LOAD IT loads
await press(page, ID.two, 'USE');
await sheet(page).waitFor({ state: 'visible', timeout: 4000 }).catch(() => problems.push('USE of the 2B gave no warning'));
const warn = (await page.locator('.modal').last().textContent().catch(() => '')) ?? '';
// the title names the brain as it is written (sentence case had made it "Load qwen3.5 2b?")
const warnTitle = await page.locator('.modal .mhead b').last().evaluate((b) => ({ t: b.textContent, tt: getComputedStyle(b).textTransform })).catch(() => null);
check(warnTitle?.t === 'Load Qwen3.5 2B?' && warnTitle.tt === 'none', `the warning's title as shown: ${JSON.stringify(warnTitle)}`);
check(/Load Qwen3\.5 2B\?/.test(warn) && /Loading the 2B takes about 2\.2 GB of graphics memory\. If the phone cannot hold it, Ghosty will close and come back on the 0\.6B\./.test(warn), `the warning: "${warn}"`);
await page.screenshot({ path: `${out}/bigbrain-${browserName}-warning.png` });
await sheet(page).locator('button', { hasText: 'KEEP IT' }).click();
await page.waitForTimeout(400);
check(!(await engine(page)).loads.includes(ID.two) && (await stored(page)).model === ID.small, 'KEEP IT loads nothing and changes nothing');
const hitsBeforeUse = net.hits.length;
await press(page, ID.two, 'USE');
await sheet(page).locator('button.sureyes').click().catch(() => problems.push('no LOAD IT in the warning'));
check(await tagIs(page, ID.two, 'IN USE'), 'the 2B is not IN USE after USE');
// the load (WebLLM's lookups in the test engine) read every file from the cache: not one request for the brain's files
check(net.hits.length === hitsBeforeUse && (await page.evaluate(() => window.__webllmMissed.length)) === 0, `USE fetched the 2B's files: ${JSON.stringify({ hits: net.hits.slice(hitsBeforeUse), missed: await page.evaluate(() => window.__webllmMissed) })}`);
check((await engine(page)).loads.at(-1) === ID.two, `USE loaded the 2B: ${JSON.stringify((await engine(page)).loads)}`);
// (the stand-in load reads every file from the cache first, as WebLLM does: the record goes when it is done)
check(await page.waitForFunction(() => localStorage.getItem('ghosty.offlinebrain.loading') === null, null, { timeout: 10000 }).then(() => true, () => false), 'the load record is cleared after the load');
let st = await stored(page);
check(st.held?.['qwen3.5-2b']?.s === 'loaded', `the 2B is remembered as having run here: ${JSON.stringify(st.held)}`);
// (its row says so too: what happened here, not the guess from the memory figure)
await page.waitForFunction((id) => /runs on this phone$/.test(document.querySelector(`#pg-settings .offbrain .obbrain[data-model="${id}"] .obfacts`)?.textContent ?? ''), ID.two, { timeout: 5000 }).catch(() => undefined);
check((await row(page, ID.two))?.facts === '1.1 GB download · about 2.2 GB of memory when running · runs on this phone', `the 2B's line once it has run here: "${(await row(page, ID.two))?.facts}"`);
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
check(r4?.facts === '2.4 GB download · about 3.8 GB of memory when running · did not fit this phone', `the 4B's line after it closed Ghosty does not say it fits: "${r4?.facts}"`);
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
  const over = [...pn.querySelectorAll('.obbrain, .obbrain *, .obcost, .obfell, .obgetting, .obhold, .obkeep, .obkeep *')].filter((e) => e.getBoundingClientRect().right > w.right + 1).map((e) => `${e.className}: ${(e.textContent ?? '').slice(0, 30)}`);
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
await answerSheet(sp, true);
check(await tagIs(sp, ID.two, 'ON THIS PHONE', 20000), 'GET of the 2B did not finish (Safari limits)');
await press(sp, ID.two, 'USE');
await sp.waitForTimeout(800);
const refused = await text(sp, '.obtest');
check(refused === 'Qwen3.5 2B has one piece of 243 MB that must sit in the graphics chip in one go, and this phone gives a web page pieces of at most 128 MB. It cannot run here, so Ghosty does not try.', `the 2B refused in plain words: "${refused}"`);
check(!(await sheet(sp).isVisible().catch(() => false)), 'no warning for a brain that cannot run');
check((await engine(sp)).loads.length === 0 && (await stored(sp)).model === ID.small, 'nothing loaded, the 0.6B still in use');
check((await stored(sp)).held?.['qwen3.5-2b']?.s === 'refused' && /could not start Qwen3\.5 2B/.test(await text(sp, '.obhold')), `remembered as could not start: "${await text(sp, '.obhold')}"`);
check((await row(sp, ID.two))?.facts === '1.1 GB download · about 2.2 GB of memory when running · cannot run on this phone', `the refused 2B's line: "${(await row(sp, ID.two))?.facts}"`);
await shot(sp, 'refused-2b');
await press(sp, ID.mid, 'GET');
await answerSheet(sp, true);
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

// ---- 8 (continued). a new version of Ghosty replaces its service worker: every download stays where it was
const fresh = await signedIn();
const fp = fresh.page;
fp.on('dialog', (d) => void d.accept());
await fp.locator('#pg-settings .offbrain > .bd > .keyrow button', { hasText: 'DOWNLOAD' }).click();
await fp.waitForFunction(() => /READY/.test(document.querySelector('#pg-settings .pn.offbrain h3')?.textContent ?? ''), null, { timeout: 15000 }).catch(() => problems.push('the 0.6B did not download (fresh phone)'));
await press(fp, ID.mid, 'GET');
await answerSheet(fp, true);
check(await tagIs(fp, ID.mid, 'ON THIS PHONE', 20000), 'GET of the 0.8B did not finish (fresh phone)');
const swNext = await fp.evaluate(async () => {
  // (as a new build's sw.js would: a different worker script for the same scope, installed and activated)
  const reg = await navigator.serviceWorker.register('/sw.js?build=next', { scope: '/' });
  const sw = reg.installing ?? reg.waiting ?? reg.active;
  if (sw && sw.state !== 'activated') await new Promise((r) => sw.addEventListener('statechange', () => sw.state === 'activated' && r(undefined)));
  await new Promise((r) => setTimeout(r, 300));
  return { script: reg.active?.scriptURL ?? '', caches: await caches.keys() };
});
check(/build=next/.test(swNext.script), `the new service worker took over: ${JSON.stringify(swNext)}`);
check(['webllm/model', 'webllm/config', 'webllm/wasm'].every((c) => swNext.caches.includes(c)), `the new service worker left WebLLM's stores alone: ${JSON.stringify(swNext.caches)}`);
await killAndReopen(fp);
const freshHits = fresh.net.hits.length;
check(await tagIs(fp, ID.mid, 'ON THIS PHONE', 5000), `after a new service worker, the 0.8B is not ON THIS PHONE: ${JSON.stringify(await row(fp, ID.mid))}`);
check(/READY/.test((await fp.locator('#pg-settings .pn.offbrain h3').textContent()) ?? ''), 'after a new service worker, the 0.6B is not READY');
check((await text(fp, '.obkeep .obhere')) === 'On this phone: Qwen3 0.6B whole (352 MB) · Qwen3.5 0.8B whole (447 MB).', `after a new service worker: "${await text(fp, '.obkeep .obhere')}"`);
await fp.evaluate(() => window.__webllmLoad('Qwen3.5-0.8B-q4f16_1-MLC'));
check((await fp.evaluate(() => window.__webllmMissed.length)) === 0 && fresh.net.hits.length === freshHits, `after a new service worker, WebLLM's lookups fetched: ${fresh.net.hits.slice(freshHits)}`);
check((await fp.locator('#pg-settings .offbrain .obkeep > div').allTextContents()).includes('Kept for good: yes. The phone will not clear Ghosty’s downloads to make space.'), 'the phone\'s answer (granted) on the panel');
await shot(fp, 'kept-after-new-version');

// ---- 9. the biggest brain's download in parts (pieces of 1.5 MB here, parts of 500 KB: three parts a piece)
await fp.evaluate(() => {
  window.__ghostyOfflineEngine.part = 500_000;
  window.__logs = [];
  window.__lines = [];
});
fresh.net.most = 0;
fresh.net.hangRange.add('params_shard_2.bin@1000000'); // the third part of the third shard never comes: iOS closes Ghosty then
const partsFrom = fresh.net.ranges.length;
await press(fp, ID.four, 'GET');
await answerSheet(fp, true);
await fp.waitForFunction(() => window.__logs.at(-1)?.piece === 6 && window.__logs.at(-1)?.part === 3, null, { timeout: 10000 }).catch(() => problems.push('GET in parts never reached piece 6, part 3'));
await fp.waitForTimeout(200);
const partLogs = await fp.evaluate(() => window.__logs.filter((l) => l.parts).map((l) => `${l.piece}.${l.part}/${l.parts}`));
check(JSON.stringify(partLogs) === JSON.stringify(['4.1/3', '4.2/3', '4.3/3', '5.1/3', '5.2/3', '5.3/3', '6.1/3', '6.2/3', '6.3/3']), `the log written before each part: ${JSON.stringify(partLogs)}`);
check(fresh.net.most === 1, `one part at a time, never two pieces at once (at most ${fresh.net.most} in flight)`);
const askedParts = fresh.net.ranges.slice(partsFrom).filter((r) => r.startsWith('params_shard'));
check(JSON.stringify(askedParts.slice(0, 3)) === JSON.stringify(['params_shard_0.bin@0-499999', 'params_shard_0.bin@500000-999999', 'params_shard_0.bin@1000000-1499999']), `the parts asked for: ${JSON.stringify(askedParts)}`);
const partLines = await fp.evaluate(() => window.__lines);
check(partLines.includes('piece 5 of 8 · part 2 of 3 · 2 MB of 6 MB'), `the progress line names the part: ${JSON.stringify(partLines)}`);
await killAndReopen(fp);
await fp.evaluate(() => (window.__ghostyOfflineEngine.part = 500_000)); // (the same part size after the reopen)
const carryPart = await text(fp, '.obgetting');
check(carryPart === 'Ghosty was closed while getting Qwen3.5 4B at piece 6 of 8, part 3 of 3. Tap CONTINUE to carry on from there.', `the carry-on line names the part: "${carryPart}"`);
const kept4 = await fp.evaluate(async () => (await (await caches.open('ghosty-brain-parts')).keys()).map((r) => r.url.split('/').pop()));
check(JSON.stringify(kept4.sort()) === JSON.stringify(['params_shard_2.bin?ghosty-part=1-of-3', 'params_shard_2.bin?ghosty-part=2-of-3']), `the parts of the unfinished piece are kept: ${JSON.stringify(kept4)}`);
check((await text(fp, '.obkeep .obhere')) === 'On this phone: Qwen3 0.6B whole (352 MB) · Qwen3.5 0.8B whole (447 MB) · Qwen3.5 4B 5 of 8 pieces.', `the half-way brain counted: "${await text(fp, '.obkeep .obhere')}"`);
fresh.net.hangRange.clear();
const resumeFrom = fresh.net.ranges.length;
await press(fp, ID.four, 'CONTINUE');
await answerSheet(fp, true);
check(await tagIs(fp, ID.four, 'ON THIS PHONE', 20000), 'CONTINUE in parts did not finish the 4B');
const resumed = fresh.net.ranges.slice(resumeFrom);
check(JSON.stringify(resumed) === JSON.stringify(['params_shard_2.bin@1000000-1499999', 'params_shard_3.bin@0-499999', 'params_shard_3.bin@500000-999999', 'params_shard_3.bin@1000000-1499999']), `CONTINUE carried on at the piece's next part: ${JSON.stringify(resumed)}`);
const stored4 = await fp.evaluate(async () => {
  const c = await caches.open('webllm/model');
  const out = {};
  for (const k of [2, 3]) {
    const r = await c.match(new Request(`https://huggingface.co/mlc-ai/Qwen3.5-4B-q4f16_1-MLC/resolve/44b42469f9e192814bfd90440e3b377d89ba7a13/params_shard_${k}.bin`));
    const b = r ? new Uint8Array(await r.arrayBuffer()) : new Uint8Array();
    out[k] = { bytes: b.length, sha: [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))].map((x) => x.toString(16).padStart(2, '0')).join('') };
  }
  return { out, parts: (await (await caches.open('ghosty-brain-parts')).keys()).length };
});
check(stored4.out[2]?.bytes === SHARD && stored4.out[2]?.sha === sha(shardBody('params_shard_2.bin')), `the piece put together after the close is byte-identical: ${JSON.stringify(stored4.out[2])}`);
check(stored4.out[3]?.sha === sha(shardBody('params_shard_3.bin')), `the next piece is byte-identical: ${JSON.stringify(stored4.out[3])}`);
check(stored4.parts === 0, `the parts are gone once each piece is whole: ${stored4.parts}`);
await fp.evaluate(() => window.__webllmLoad('Qwen3.5-4B-q4f16_1-MLC'));
check((await fp.evaluate(() => window.__webllmLooked.at(-1)?.inCache && window.__webllmMissed.length === 0)) === true, 'WebLLM finds the 4B built from parts under its own keys');
await shot(fp, 'parts-done');
await putBack(fp);
await fresh.ctx.close();

// ---- 10. honest storage: an iPhone in Safari that gives Ghosty 1.2 GB (300 MB used), keeping it for good once asked
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const tight = await signedIn({ storage: { quota: 1.2e9, usage: 0.3e9, grant: false }, userAgent: IPHONE });
const tp = tight.page;
const askedBefore = await tp.evaluate(() => window.__persistAsked);
const tHits = tight.net.hits.length;
await press(tp, ID.four, 'GET');
await tp.waitForTimeout(600);
const roomWords = 'This phone gives Ghosty 1.2 GB of space (900 MB of it free); the 4B needs 2.7 GB (its files and room to put its biggest piece together). Nothing was downloaded: free some space on the phone, or choose a smaller brain.';
check((await text(tp, '.obtest')) === roomWords, `the 4B refused for space, in plain words: "${await text(tp, '.obtest')}"`);
check((await toasts(tp)).includes(roomWords.slice(0, 60)), `…and in a toast: "${await toasts(tp)}"`);
check(!(await sheet(tp).isVisible().catch(() => false)) && tight.net.hits.length === tHits, `refused before anything was asked or fetched: ${tight.net.hits.slice(tHits)}`);
await shot(tp, 'no-room-4b');
await press(tp, ID.mid, 'GET');
await answerSheet(tp, true);
check(await tagIs(tp, ID.mid, 'ON THIS PHONE', 20000), 'the 0.8B (it fits the space) did not download');
await tp.locator('#pg-settings .offbrain > .bd > .keyrow button', { hasText: 'DOWNLOAD' }).click();
await tp.waitForFunction(() => /READY/.test(document.querySelector('#pg-settings .pn.offbrain h3')?.textContent ?? ''), null, { timeout: 15000 }).catch(() => problems.push('the 0.6B did not download (tight phone)'));
check((await tp.evaluate(() => window.__persistAsked)) - askedBefore === 1, `persist() asked once for two downloads: ${askedBefore} → ${await tp.evaluate(() => window.__persistAsked)}`);
const keepLines = await tp.locator('#pg-settings .offbrain .obkeep > div').allTextContents();
check(keepLines.includes('Kept for good: no. The phone may clear downloaded brains when it runs short of space.'), `the phone's answer (not granted) on the panel: ${JSON.stringify(keepLines)}`);
check(keepLines.includes('This is Safari: a brain stays where it was downloaded (Safari and the Home Screen app each keep their own), so use Ghosty from one of them.'), `Safari and the Home Screen app: ${JSON.stringify(keepLines)}`);
// pieces gone between opens (the phone cleared them): named, not a silent new download
await tp.evaluate(async () => {
  const c = await caches.open('webllm/model');
  for (const r of await c.keys()) if (/Qwen3\.5-0\.8B.*params_shard_[01]\.bin$/.test(r.url)) await c.delete(r);
});
await killAndReopen(tp);
const goneWords = await text(tp, '.obkeep .obgone');
check(/^Qwen3\.5 0\.8B was whole on this phone on \d+ \w+ \(8 pieces\); 2 of them have gone since, and Ghosty did not remove them\. Getting it again fetches only what is missing\.$/.test(goneWords), `the pieces gone, said by name: "${goneWords}"`);
check((await text(tp, '.obkeep .obhere')) === 'On this phone: Qwen3 0.6B whole (352 MB) · Qwen3.5 0.8B 6 of 8 pieces.', `what is left, counted: "${await text(tp, '.obkeep .obhere')}"`);
check((await row(tp, ID.mid))?.buttons.join() === 'GET', `the 0.8B offers GET again: ${JSON.stringify(await row(tp, ID.mid))}`);
await shot(tp, 'gone-named');
const fit10 = await tp.evaluate(() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('#pg-settings .offbrain .obkeep *')].every((e) => e.getBoundingClientRect().right <= document.querySelector('#pg-settings .offbrain').getBoundingClientRect().right + 1));
check(fit10, 'the storage lines fit the phone (nothing sideways)');
await putBack(tp);
await tight.ctx.close();

// ---- 11. the 0.6B closed Ghosty while answering (his phone, 31 Oct): remembered, refused until he says, the smallest offered
const closer = await signedIn();
const cp = closer.page;
// his phone as it was: the 0.6B downloaded and in use
await cp.locator('#pg-settings .offbrain button', { hasText: /^DOWNLOAD$/ }).click();
check(await cp.waitForFunction(() => JSON.parse(localStorage.getItem('ghosty.offlinebrain') ?? '{}').downloaded === true, null, { timeout: 30000 }).then(() => true, () => false), '[closed] the 0.6B did not download');
await cp.waitForTimeout(400);
// a reply that closed Ghosty: its record is still there when Ghosty opens again
await cp.evaluate((id) => localStorage.setItem('ghosty.offlinebrain.answering', JSON.stringify({ model: id, at: Date.now() - 90_000 })), ID.small);
await killAndReopen(cp);
await cp.waitForTimeout(600);
let cst = await stored(cp);
check(cst.held?.['qwen3-0.6b']?.s === 'closed' && cst.held?.['qwen3-0.6b']?.phase === 'answering', `[closed] the 0.6B is remembered as having closed Ghosty while answering: ${JSON.stringify(cst.held)}`);
check(cst.model === ID.small && (await cp.evaluate(() => localStorage.getItem('ghosty.offlinebrain.answering'))) === null, '[closed] the record is cleared on opening; with nothing smaller here the 0.6B stays the brain in use');
const closedFell = await text(cp, '.obfell');
check(/^Qwen3 0\.6B closed Ghosty while answering \(\d+ \w+, \d\d:\d\d\): this phone could not hold it while it worked\. The smaller Qwen2\.5 0\.5B \(about 290 MB, 0\.9 GB when running\) may fit: GET it in WHICH BRAIN, on Wi-Fi, and Ghosty uses it\. Qwen3 0\.6B stays on this phone, and USE asks before it is tried again\.$/.test(closedFell), `[closed] the words after the close: "${closedFell}"`);
let crows = await rows(cp);
check(crows[0]?.model === ID.least && crows[0]?.buttons.join() === 'GET' && / · the smallest$/.test(crows[0]?.facts ?? '') && crows[1]?.model === ID.small && crows[1]?.tag === 'IN USE', `[closed] the smallest brain is offered first, the 0.6B still in use: ${JSON.stringify(crows.slice(0, 2).map((r) => [r.model, r.tag, r.buttons, r.facts]))}`);
check(/^closed Ghosty on this phone \(\d+ \w+\), while answering: USE asks before trying again$/.test(crows[1]?.closed ?? ''), `[closed] the 0.6B's own note: "${crows[1]?.closed}"`);
check(/closed Ghosty answering on Qwen3 0\.6B/.test(await text(cp, '.obhold')), `[closed] the can-hold line: "${await text(cp, '.obhold')}"`);
// TEST asks first now (KEEP IT: nothing loaded, nothing asked of the model)
await cp.locator('#pg-settings .offbrain button', { hasText: /^TEST$/ }).click();
check(await sheet(cp).waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false), '[closed] TEST on the brain that closed Ghosty did not ask first');
const closedAsk = (await cp.locator('.modal').last().textContent().catch(() => '')) ?? '';
check(/It closed Ghosty on this phone on \d+ \w+ while answering\. Loading the 0\.6B takes about 1\.4 GB of graphics memory\. If the phone cannot hold it, Ghosty will close and come back\./.test(closedAsk), `[closed] the question before another try: "${closedAsk}"`);
await sheet(cp).locator('button', { hasText: 'KEEP IT' }).click();
await cp.waitForTimeout(400);
check((await engine(cp)).loads.length === 0, '[closed] KEEP IT loaded nothing');
// GET the smallest (on Wi-Fi, asked first), then USE: it is the brain in use, and the 0.6B's row is no longer marked
await press(cp, ID.least, 'GET');
await sheet(cp).waitFor({ state: 'visible', timeout: 5000 }).catch(() => problems.push('[closed] GET did not ask first'));
await sheet(cp).locator('button', { hasText: 'DOWNLOAD' }).click();
check(await tagIs(cp, ID.least, 'ON THIS PHONE', 30000), '[closed] GET did not store the smallest brain');
await press(cp, ID.least, 'USE');
check(await tagIs(cp, ID.least, 'IN USE', 10000), '[closed] USE did not make the smallest brain the one in use');
crows = await rows(cp);
check(crows.find((r) => r.model === ID.small)?.tag === 'ON THIS PHONE', `[closed] the 0.6B is on the phone but no longer in use: ${JSON.stringify(crows.map((r) => [r.model, r.tag]))}`);
check((await engine(cp)).loads.at(-1) === ID.least, `[closed] USE loaded the smallest brain: ${JSON.stringify((await engine(cp)).loads)}`);
// a reply goes under its record (written before the model runs, cleared after). TEST's reply is the first one asked; the
// QUICK CHECK that follows it asks twenty more, each under a record of its own, so "after" is read once they are done
// (read while one of them is being answered, it is that one's record, not a record left behind)
await cp.evaluate(() => {
  const e = window.__ghostyOfflineEngine;
  const chat = e.chat.bind(e);
  e.chat = async (...a) => {
    if (!window.__asked) ((window.__asked = true), (window.__answering = localStorage.getItem('ghosty.offlinebrain.answering')));
    return chat(...a);
  };
});
await cp.locator('#pg-settings .offbrain button', { hasText: /^TEST$/ }).click();
check(await cp.waitForFunction(() => /tokens a second/.test(document.querySelector('#pg-settings .offbrain .obtest')?.textContent ?? ''), null, { timeout: 20000 }).then(() => true, () => false), '[closed] TEST on the smallest brain gave no speed line');
check(await cp.waitForFunction(() => /right as in chat|did not run/.test(document.querySelector('#pg-settings .offbrain .obquick')?.textContent ?? ''), null, { timeout: 60000 }).then(() => true, () => false), `[closed] the QUICK CHECK after TEST did not finish: "${await text(cp, '.obquick')}"`);
const answering = await cp.evaluate(() => ({ during: JSON.parse(window.__answering ?? 'null'), after: localStorage.getItem('ghosty.offlinebrain.answering') }));
check(answering.during?.model === ID.least && typeof answering.during?.at === 'number' && answering.after === null, `[closed] the reply's record: ${JSON.stringify(answering)}`);
// SCHOOL sits its papers on the smallest brain now
await cp.evaluate(() => (location.hash = 'school'));
check(await cp.waitForFunction(() => /^I sit papers on Qwen2\.5 0\.5B\.$/.test(document.querySelector('#pg-school .schbrain .note')?.textContent ?? ''), null, { timeout: 20000 }).then(() => true, () => false), `[closed] SCHOOL's brain line: "${await cp.locator('#pg-school .schbrain .note').first().textContent().catch(() => '')}"`);
await shot(cp, 'smallest-after-close');

// ---- 12. (1 Nov: "the brain school thing is still crashing") the 0.5B closed Ghosty too: the floor is offered, and SCHOOL
//      is ONE button that gets it and sits; on mobile data the button waits with its line and nothing is fetched
await cp.evaluate((id) => localStorage.setItem('ghosty.offlinebrain.answering', JSON.stringify({ model: id, at: Date.now() - 60_000 })), ID.least);
await killAndReopen(cp);
await cp.waitForTimeout(600);
cst = await stored(cp);
check(cst.held?.[ID.least]?.s === 'closed' && cst.held?.[ID.least]?.phase === 'answering' && cst.held?.['qwen3-0.6b']?.s === 'closed', `[floor] the 0.5B is remembered as having closed Ghosty while answering, apart from the 0.6B: ${JSON.stringify(cst.held)}`);
const floorFell = await text(cp, '.obfell');
check(/^Qwen2\.5 0\.5B closed Ghosty while answering \(\d+ \w+, \d\d:\d\d\): this phone could not hold it while it worked\. The smaller SmolLM2 360M \(about 212 MB, 0\.4 GB when running\) may fit: GET it in WHICH BRAIN, on Wi-Fi, and Ghosty uses it\. Qwen2\.5 0\.5B stays on this phone, and USE asks before it is tried again\.$/.test(floorFell), `[floor] the words after the close: "${floorFell}"`);
crows = await rows(cp);
check(crows[0]?.model === ID.floor && crows[0]?.buttons.join() === 'GET' && crows[0]?.facts === '212 MB download · about 0.4 GB of memory when running · fits an 18 Pro Max: yes · the tiniest', `[floor] the floor is offered first: ${JSON.stringify(crows[0])}`);
check(crows[1]?.model === ID.least && crows[1]?.tag === 'IN USE' && /, while answering: USE asks before trying again$/.test(crows[1]?.closed ?? ''), `[floor] the 0.5B is still in use, with its own note: ${JSON.stringify(crows[1])}`);
check(/closed Ghosty answering on Qwen2\.5 0\.5B \(\d+ \w+\), Qwen3 0\.6B \(\d+ \w+\); not tried yet: SmolLM2 360M,/.test(await text(cp, '.obhold')), `[floor] the can-hold line: "${await text(cp, '.obhold')}"`);
await shot(cp, 'floor-offered');
// SCHOOL: no brain here may sit, so SIT is ONE button with the floor's name and size
await cp.evaluate(() => (location.hash = 'school'));
await openSection(cp, 'school', 'This stage').catch(() => undefined);
const tap = cp.locator('#pg-school .schstage button.schgetsit');
check(await tap.first().waitFor({ state: 'visible', timeout: 20000 }).then(() => true, () => false), '[floor] SCHOOL shows no GET-and-sit button');
check((await tap.count()) === 1 && (await tap.first().textContent().catch(() => '')) === 'GET SmolLM2 360M (212 MB) and sit', `[floor] the one button: ${await tap.count()} × "${await tap.first().textContent().catch(() => '')}"`);
check(!(await cp.locator('#pg-school .schstage button', { hasText: /^SIT THE EXAM$/ }).isVisible().catch(() => false)), '[floor] SIT THE EXAM beside the one button');
const tapWhy = (await cp.locator('#pg-school .schstage .schwhy').textContent().catch(() => '')) ?? '';
check(tapWhy === 'Qwen2.5 0.5B closed Ghosty on this phone. The smaller SmolLM2 360M may fit: one tap gets it (212 MB, on Wi-Fi) and I sit on it.', `[floor] the words beside it: "${tapWhy}"`);
// mobile data: nothing is fetched, the line says so, the button stays
const hitsBeforeTap = closer.net.hits.length;
await cp.evaluate(() => (window.__net = 'cellular'));
await tap.first().click();
await cp.waitForTimeout(800);
const waitWhy = (await cp.locator('#pg-school .schstage .schwhy').textContent().catch(() => '')) ?? '';
check(/You are on mobile data, and SmolLM2 360M is 212 MB: it waits for Wi-Fi\. Join Wi-Fi, then tap it again\.$/.test(waitWhy), `[floor] on mobile data: "${waitWhy}"`);
check(closer.net.hits.length === hitsBeforeTap && !(await cp.evaluate(() => window.__ghosty?.school?.sitting)), `[floor] the one tap fetched or sat on mobile data (${closer.net.hits.length - hitsBeforeTap} fetches)`);
check(await tap.first().isVisible().catch(() => false), '[floor] the button went on mobile data');
await shot(cp, 'floor-mobile-data');
// Wi-Fi: one tap gets the floor (its pieces into WebLLM's stores), loads it and the paper starts on it
await cp.evaluate(() => {
  window.__net = '';
  window.__ghostyOfflineEngine.calls = [];
  window.__webllmMissed = [];
});
await tap.first().click();
check(await cp.waitForFunction(() => window.__ghosty?.school?.sitting === true, null, { timeout: 30000 }).then(() => true, () => false), '[floor] the paper did not start after the one tap');
check(await cp.waitForFunction((id) => window.__ghostyOfflineEngine.calls.some((c) => c.model === id), ID.floor, { timeout: 30000 }).then(() => true, () => false), `[floor] no question went to the floor: ${JSON.stringify(await cp.evaluate(() => window.__ghostyOfflineEngine.calls.slice(0, 2)))}`);
const sitLine = (await cp.locator('#pg-school .schlive .schbrain').textContent().catch(() => '')) ?? '';
check(sitLine === "I'm sitting it on SmolLM2 360M: Qwen2.5 0.5B closed Ghosty on this phone.", `[floor] while sitting: "${sitLine}"`);
check((await engine(cp)).loads.at(-1) === ID.floor, `[floor] loaded: ${JSON.stringify((await engine(cp)).loads)}`);
check((await cached(cp, ID.floor))['webllm/model'].length === SHARDS + 2 && (await cp.evaluate(() => window.__webllmMissed.length)) === 0, `[floor] the floor's pieces are in WebLLM's own stores: ${JSON.stringify(await cached(cp, ID.floor))}`);
check(closer.net.hits.slice(hitsBeforeTap).every((u) => u.startsWith(`https://huggingface.co/mlc-ai/${ID.floor}/resolve/${PINS[ID.floor].rev}/`)), '[floor] the one tap fetched something other than the floor at its pinned commit');
check(await cp.waitForFunction(() => window.__ghosty?.school?.sitting === false, null, { timeout: 90000 }).then(() => true, () => false), '[floor] the paper on the floor was not handed in');
const afterFloor = await stored(cp);
check(afterFloor.model === ID.least && afterFloor.have?.includes(ID.floor) && afterFloor.held?.[ID.floor]?.s === 'loaded', `[floor] after it: the 0.5B is still his choice, the floor is on this phone and has run: ${JSON.stringify({ model: afterFloor.model, have: afterFloor.have, held: afterFloor.held?.[ID.floor] })}`);
await putBack(cp);
await closer.ctx.close();

await browser.close();
reported = true;
if (problems.length) {
  console.error(`bigbrain spec (${browserName}): ${problems.length} problem(s)\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`bigbrain spec (${browserName}): all good — the picker, GET stores pieces one at a time with no graphics memory, the carry-on after a close, USE's limits check and warning, the closed-Ghosty mark, the 0.8B step, the 0.6B fallback, REMOVE, no sideways scroll; what GET stored found on the next open and after a new service worker with no fetch, a big piece in parts resumed at its next part and byte-identical, a GET the space cannot hold refused, the storage lines; the 0.6B that closed Ghosty while answering refused until he says and the smallest brain offered, stored, used and sitting papers; the 0.5B that closed Ghosty too: the floor offered, SCHOOL's one tap waiting on mobile data and on Wi-Fi getting the floor and sitting the paper on it`);
