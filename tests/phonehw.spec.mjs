// THE PHONE'S HARDWARE (BRIEF-PHONE-HARDWARE): 120 Hz motion, a second size of the Lens's eyes, WebGPU for the GYM, the offline brain
// measured; each built for a phone that has the feature and with a fallback for one that lacks it. No phone is here: the capabilities are
// faked by page.addInitScript (the frame callback at 120 and at 60 Hz, WebGPU present, absent and failing half-way, memory large, small
// and not reported), and the sums that need no page are bundled from the source and run here.
//  1. refresh: the meter snaps made-up frame times (stalls ignored, nothing known before 12 gaps), mind.ts keeps no fixed 60;
//     SYSTEM → THIS PHONE reads "120 Hz" on a 120 Hz frame callback and "60 Hz" on a 60 Hz one, with Reduce Motion on too;
//  2. sizes: the capability rule (8 GB + 8 cores + WebGPU: larger; Safari's missing memory, 4 GB, no WebGPU: standard); OFFLINE EYES with a
//     stand-in larger pack: second row with its size said, nothing fetched by looking, nothing on mobile data, fetched on the tap on
//     Wi-Fi, AUTO picks by the phone, STANDARD and LARGER by hand; with none on the site the panel says one size and reads the phone;
//  3. GYM: WebGPU present: the line says so and the fake's dispatches were counted; absent: the processor and why; failing half-way: the
//     run finishes on the processor and says so; both paths train the same network to the same loss;
//  4. the offline brain: a load is measured (timings; heap where the browser has it), SYSTEM shows it and the three sizes' guidance; a
//     phone that says 4 GB refuses the 4B in plain words and the smaller brain takes over; 12 GB or no figure does not refuse;
//  5. 440 × 956 in all three worlds (and 390): nothing sideways, every key 44 pt, no page errors.
//   BASE=http://localhost:8807 node tests/phonehw.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, openPanel } from './nav.mjs';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
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
process.on('exit', (c) => c && problems.length && console.error(`problems so far:\n- ${problems.join('\n- ')}`));

// ---- the sums with no page, bundled from the source
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
const esbuild = createRequire(join(root, 'apps/web/package.json'))('esbuild');
const tmp = mkdtempSync(join(tmpdir(), 'phonehw-'));
const bundle = async (rel) => {
  const outfile = join(tmp, `${rel.replace(/\W+/g, '_')}.mjs`);
  esbuild.buildSync({ entryPoints: [join(root, 'apps/web/src', rel)], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'error' });
  return import(outfile);
};
const R = await bundle('engine/refresh.ts');
const C = await bundle('offline/capability.ts');
const G = await bundle('gym/gpu.ts');
const T = await bundle('gym/gputrain.ts');
const M = await bundle('offline/measure.ts');
const MODELS = await bundle('offline/models.ts');

// ---- 1a. the meter
{
  const m = new R.RefreshMeter();
  for (let i = 1; i <= 11; i++) m.note(i * 8.33);
  check(m.hz === 0 && m.rate() === 60 && /^Measuring/.test(m.words()), `[meter] it claims a rate before 12 gaps: ${m.hz} / ${m.words()}`);
  m.note(12 * 8.33);
  m.note(13 * 8.33);
  check(m.hz === 120, `[meter] 8.33 ms gaps are not 120 Hz: ${m.hz}`);
  const at60 = new R.RefreshMeter();
  for (let i = 1; i <= 40; i++) at60.note(i * 16.7);
  check(at60.hz === 60 && /^60 Hz, measured over \d+ frames$/.test(at60.words()), `[meter] 16.7 ms gaps: ${at60.words()}`);
  const stalls = new R.RefreshMeter();
  let t = 0;
  for (let i = 0; i < 60; i++) {
    t += i % 10 === 9 ? 400 : 8.33;
    stalls.note(t);
  }
  check(stalls.hz === 120, `[meter] a stall (a hidden tab, a long task) is counted as the display: ${stalls.hz}`);
  const paused = new R.RefreshMeter();
  for (let i = 1; i <= 20; i++) paused.note(i * 16.7);
  paused.pause();
  paused.note(99999);
  check(paused.hz === 60, `[meter] the first frame after a pause was counted as a gap: ${paused.hz}`);
  for (const [gap, hz] of [[11.1, 90], [6.94, 144], [33.3, 30], [8.9, 112], [41.7, 24]]) check(R.snapHz(gap) === hz, `[meter] ${gap} ms should be ${hz} Hz, got ${R.snapHz(gap)}`);
  check(R.moving(m) === 120 && R.moving(new R.RefreshMeter()) === 60 && R.moving(Object.assign(new R.RefreshMeter(), { hz: 30 })) === 60, '[meter] moving(): the display rate, never below 60');
  const mind = readFileSync(join(root, 'apps/web/src/features/core/mind.ts'), 'utf8');
  check(!/\? 60 : 30/.test(mind) && (mind.match(/moving\(\)/g) ?? []).length >= 2, '[meter] the orb still keeps a fixed 60 fps step');
  const sched = readFileSync(join(root, 'apps/web/src/engine/scheduler.ts'), 'utf8');
  check(!/\|\| 0\.016/.test(sched) && /refresh\.note\(now\)/.test(sched), '[meter] the one loop keeps a fixed 16 ms step or does not feed the meter');
}

// ---- 2a. the capability rule
{
  const big = { memoryGB: 8, cores: 8, gpu: true, buffer: 1 << 30, f16: true };
  check(C.takesLarger(big).ok, '[caps] 8 GB, 8 cores and WebGPU should take a larger size');
  for (const [name, c, re] of [
    ['Safari (no memory figure)', { ...big, memoryGB: null }, /does not say how much memory/],
    ['4 GB', { ...big, memoryGB: 4 }, /4 GB of memory and a larger one wants 6/],
    ['no WebGPU', { ...big, gpu: false, buffer: null }, /no WebGPU/],
    ['2 cores', { ...big, cores: 2 }, /2 cores/],
    ['small buffers', { ...big, buffer: 1 << 27 }, /128 MB/],
  ]) {
    const r = C.takesLarger(c);
    check(!r.ok && re.test(r.why), `[caps] ${name} was not refused in words: ${JSON.stringify(r)}`);
  }
  const L = { here: true };
  check(C.chooseSize('auto', big, L).size === 'larger', '[caps] AUTO on a capable phone with the larger one here should be larger');
  check(C.chooseSize('auto', big, { here: false }).size === 'standard', '[caps] AUTO picked a larger size that is not on the phone');
  check(C.chooseSize('auto', { ...big, memoryGB: null }, L).size === 'standard', '[caps] AUTO picked larger on a phone that does not say its memory');
  check(C.chooseSize('larger', { ...big, memoryGB: null }, L).size === 'larger', '[caps] a hand-chosen larger size was refused');
  check(C.chooseSize('larger', big, { here: false }).size === 'standard', '[caps] a hand-chosen larger size that is not here was used');
  check(C.chooseSize('standard', big, L).size === 'standard' && C.chooseSize('auto', big, null).size === 'standard', '[caps] STANDARD, or only one size, should be standard');
  const probed = await C.probeCaps({ deviceMemory: 8, hardwareConcurrency: 6, gpu: { requestAdapter: async () => ({ limits: { maxBufferSize: 1 << 30 }, features: new Set(['shader-f16']) }) } });
  check(probed.gpu && probed.memoryGB === 8 && probed.cores === 6 && probed.f16 && probed.buffer === 1 << 30, `[caps] probe: ${JSON.stringify(probed)}`);
  const none = await C.probeCaps({ gpu: { requestAdapter: async () => { throw new Error('no'); } } });
  check(!none.gpu && none.memoryGB === null, `[caps] a throwing adapter should read as none: ${JSON.stringify(none)}`);
}

// ---- 3a. both paths on fakes, in node
{
  const p = T.blobs(256, 8, 3, 5);
  const cpu = await T.trainMlp(G.cpuBackend, p, [16], 40, 0.5, 9);
  check(cpu.accuracy > 0.9 && cpu.loss < 0.5, `[gym] the network does not learn on the processor: ${JSON.stringify(cpu)}`);
  const fakeGpu = { path: 'webgpu', calls: 0, async matmul(a, b, m, k, n) { this.calls++; return G.cpuBackend.matmul(a, b, m, k, n); }, close() {} };
  const chosen = await G.chooseBackend({}, async () => fakeGpu);
  const gpu = await T.trainMlp(chosen.backend, p, [16], 40, 0.5, 9);
  check(chosen.path === 'webgpu' && chosen.message === G.WORDS.gpu && fakeGpu.calls > 100, `[gym] the fake chip was not used: ${chosen.path} ${fakeGpu.calls}`);
  check(Math.abs(gpu.loss - cpu.loss) < 1e-4 && Math.abs(gpu.accuracy - cpu.accuracy) < 0.01, `[gym] the two paths learn different networks: ${gpu.loss} against ${cpu.loss}`);
  const none = await G.chooseBackend(undefined);
  check(none.path === 'cpu' && none.message === 'Training on the processor: this browser has no WebGPU.', `[gym] no WebGPU: "${none.message}"`);
  const noAdapter = await G.chooseBackend({ requestAdapter: async () => null });
  check(noAdapter.path === 'cpu' && /graphics chip is not available/.test(noAdapter.message), `[gym] no adapter: "${noAdapter.message}"`);
  let heard = '';
  const flaky = { path: 'webgpu', n: 0, async matmul(a, b, m, k, n) { if (++this.n > 7) throw new Error('device lost'); return G.cpuBackend.matmul(a, b, m, k, n); }, close() {} };
  const half = await G.chooseBackend({}, async () => flaky, (m) => (heard = m));
  const done = await T.trainMlp(half.backend, p, [16], 40, 0.5, 9);
  check(half.path === 'cpu' && half.message === 'Training moved to the processor: WebGPU stopped (the chip stopped partway).' && heard === half.message, `[gym] a chip that fails half-way: "${half.message}" / "${heard}"`);
  check(Math.abs(done.loss - cpu.loss) < 1e-6, `[gym] the run that moved to the processor ended somewhere else: ${done.loss} against ${cpu.loss}`);
}

// ---- 4a. the measure and the guidance
{
  const sizes = MODELS.PICKER.filter((m) => !m.alone);
  check(sizes.map((m) => m.label).join() === 'Qwen3 0.6B,Qwen3.5 2B,Qwen3.5 4B', `[brain] the three sizes: ${sizes.map((m) => m.label)}`);
  const four = sizes[2];
  check(M.memoryShort(four, 4).short && /needs about 3\.8 GB of memory when running and this phone says it has 4 GB/.test(M.memoryShort(four, 4).why), `[brain] 4 GB: ${JSON.stringify(M.memoryShort(four, 4))}`);
  check(!M.memoryShort(four, 12).short && !M.memoryShort(four, null).short, '[brain] 12 GB or no figure refused the 4B');
  const g = M.guidance(sizes, 8, { [sizes[0].id]: { id: sizes[0].id, label: sizes[0].label, ms: 6200, heapMB: 310, at: 1 }, [sizes[1].id]: { id: sizes[1].id, label: sizes[1].label, ms: 61000, heapMB: null, at: 1 } });
  check(/loaded in 6\.2 s, the page gained 310 MB/.test(g[0].line) && g[0].tone === 'ok', `[brain] 0.6B guidance: ${g[0].line}`);
  check(/loaded in 61 s, memory not reported by this browser; a long wait/.test(g[1].line) && g[1].tone === 'slow', `[brain] 2B guidance: ${g[1].line}`);
  check(g[2].tone === 'short' && /Ghosty uses a smaller brain instead/.test(g[2].line), `[brain] 4B on 8 GB should be short: ${g[2].line}`);
  check(/does not report memory/.test(M.guidance(sizes, null, {})[0].line), '[brain] no figure: the line should say so');
}

// ================================================================== the browser
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const GL = { look: { ground: 'graphite', world: 'glass', night: 'graphite', switches: {} } };
const INK = { look: { ground: 'warm', world: 'ink', night: 'warm', switches: {} } };
const FOUR = 'Qwen3.5-4B-q4f16_1-MLC';
const SMALLID = 'Qwen3-0.6B-q4f16_1-MLC';
const LARGER = [['eyes-name', 'The namer, larger', 4734976, ['/vendor/clip/core.f16.bin']]];

/** The capabilities, faked before the page's own scripts run. */
function faked(o) {
  if ('mem' in o) Object.defineProperty(navigator, 'deviceMemory', { get: () => o.mem ?? undefined, configurable: true });
  if (o.cores) Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => o.cores, configurable: true });
  const conn = Object.assign(new EventTarget(), { type: 'wifi', saveData: false });
  Object.defineProperty(navigator, 'connection', { get: () => conn, configurable: true });
  window.__net = (type) => {
    conn.type = type;
    conn.dispatchEvent(new Event('change'));
  };
  if (o.larger) window.__ghostyEyesLarger = o.larger;
  // the frame callback at the display's rate: browser frame times exactly 1000 / hz apart
  if (o.hz) {
    // one tick per frame runs every callback asked for, all with the same browser frame time, exactly 1000 / hz after the last
    let n = 0;
    let id = 0;
    let queue = [];
    let timer = 0;
    window.__raf = 0;
    const tick = () => {
      timer = 0;
      const now = 1000 + ++n * (1000 / o.hz);
      window.__raf += 1;
      const run = queue;
      queue = [];
      for (const [, cb] of run) cb(now);
    };
    window.requestAnimationFrame = (cb) => {
      queue.push([++id, cb]);
      if (!timer) timer = setTimeout(tick, 1000 / o.hz);
      return id;
    };
    window.cancelAnimationFrame = (x) => void (queue = queue.filter((q) => q[0] !== x));
  }
  if (o.engine) {
    window.__ghostyOfflineEngine = { ready: true, loaded: false, loads: [], async load(m) { this.loads.push(m); await new Promise((ok) => setTimeout(ok, 250)); this.loaded = true; }, unload() { this.loaded = false; }, async chat() { return 'ok'; } };
  }
  window.__gpu = { dispatches: 0, adapters: 0 };
  if (!o.gpu) {
    Object.defineProperty(navigator, 'gpu', { get: () => undefined, configurable: true });
  } else {
    const buf = ({ size }) => ({ data: new ArrayBuffer(size), mapAsync: async () => {}, getMappedRange() { return this.data; }, unmap() {}, destroy() {} });
    const device = {
      createShaderModule: (d) => d,
      createComputePipeline: () => ({ getBindGroupLayout: () => ({}) }),
      createBuffer: buf,
      createBindGroup: (d) => d,
      createCommandEncoder: () => {
        const ops = [];
        return {
          beginComputePass: () => ({ setPipeline() {}, setBindGroup(i, g) { this.g = g; }, dispatchWorkgroups() { ops.push(['d', this.g]); }, end() {} }),
          copyBufferToBuffer: (a, ao, b, bo, size) => ops.push(['c', a, b, size]),
          finish: () => ops,
        };
      },
      queue: {
        writeBuffer: (b, off, d) => new Uint8Array(b.data).set(new Uint8Array(d.buffer, d.byteOffset, d.byteLength), off),
        submit: (cmds) => {
          for (const ops of cmds)
            for (const op of ops) {
              if (op[0] === 'c') new Uint8Array(op[2].data).set(new Uint8Array(op[1].data, 0, op[3]));
              else {
                window.__gpu.dispatches++;
                if (o.failAfter != null && window.__gpu.dispatches > o.failAfter) throw new Error('device lost');
                const [A, B, C, D] = op[1].entries.map((e) => e.resource.buffer);
                const [m, k, n] = new Uint32Array(D.data);
                const a = new Float32Array(A.data);
                const b = new Float32Array(B.data);
                const c = new Float32Array(C.data);
                for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) { let s = 0; for (let p = 0; p < k; p++) s += a[i * k + p] * b[p * n + j]; c[i * n + j] = s; }
              }
            }
        },
      },
    };
    Object.defineProperty(navigator, 'gpu', { get: () => ({ requestAdapter: async () => ({ limits: { maxBufferSize: 2 ** 30, maxStorageBufferBindingSize: 2 ** 30, maxComputeWorkgroupStorageSize: 32768, maxStorageBuffersPerShaderStage: 10, maxComputeInvocationsPerWorkgroup: 256 }, features: new Set(['shader-f16']), requestDevice: async () => device }) }), configurable: true });
  }
}

async function phone(o = {}, { viewport = PHONE, world = null, seed = null, reduce = false } = {}) {
  const ctx = await browser.newContext({ viewport, ...UK, hasTouch: true, isMobile: true, ...(reduce ? { reducedMotion: 'reduce' } : {}) });
  const page = await ctx.newPage();
  const asked = [];
  page.on('request', (r) => asked.push(new URL(r.url()).pathname));
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/favicon|net::ERR|404|Failed to load resource|^[WI]\d{4} |^INFO:/.test(t)) problems.push(`console: ${t.slice(0, 200)}`);
  });
  await page.addInitScript(faked, o);
  if (seed) await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, JSON.stringify(v)); }, seed);
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pair input', { timeout: 20000 });
  await page.fill('#pair input', KEY);
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 45000 });
  const w = world === 'glass' ? GL : world === 'ink' ? INK : {};
  await page.evaluate((w) => window.__ghosty.settings.set({ sounds: false, ...w }), w);
  return { ctx, page, asked };
}
const sideways = (page, sel) =>
  page.$$eval(sel, (els) => els.filter((e) => { if (!e.getClientRects().length) return false; const r = e.getBoundingClientRect(); return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1); }).slice(0, 5).map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join('.')}`));
const tiny = (page, sel) =>
  page.$$eval(sel, (els) => els.filter((e) => e.getClientRects().length && e.getBoundingClientRect().height < 43.5 && e.getBoundingClientRect().height > 0).slice(0, 5).map((e) => `${e.tagName.toLowerCase()} "${(e.textContent ?? '').trim().slice(0, 24)}" ${Math.round(e.getBoundingClientRect().height)}`));
async function openSystem(page) {
  await page.evaluate(() => (location.hash = 'system'));
  await page.waitForSelector('#pg-system .phonecard', { state: 'attached', timeout: 20000 });
  await page.locator('#pg-system .phonecard').scrollIntoViewIfNeeded().catch(() => undefined);
}
const phoneRow = (page, key) => page.locator(`#pg-system .phonecard [data-phone="${key}"] .v`);
const text = async (loc) => ((await loc.first().innerText().catch(() => '')) ?? '').replace(/\s+/g, ' ');

// ================================================================== 1b. 120 Hz and 60 Hz
for (const [hz, reduce] of [[120, false], [60, false], [120, true]]) {
  const { ctx, page } = await phone({ hz, gpu: false, mem: null }, { reduce });
  await openSystem(page);
  await page.waitForFunction((hz) => new RegExp(`^${hz} Hz, measured over`).test(document.querySelector('#pg-system .phonecard [data-phone="refresh"] .v')?.textContent ?? ''), hz, { timeout: 20000 }).catch(async () => problems.push(`[refresh ${hz}${reduce ? ' reduced' : ''}] SYSTEM says "${await text(phoneRow(page, 'refresh'))}"`));
  check((await page.evaluate(() => window.__ghosty.stats.hz)) === hz, `[refresh ${hz}] the loop's stats.hz is ${await page.evaluate(() => window.__ghosty.stats.hz)}`);
  if (hz === 120 && !reduce) await page.screenshot({ path: `${out}/phone-120.png`, timeout: 15000 }).catch(() => undefined);
  await ctx.close();
}

// ================================================================== 2b. OFFLINE EYES: a second size
async function openEyes(page) {
  await page.evaluate(() => (location.hash = 'settings'));
  await page.waitForSelector('#pg-settings .scanset button.srow, #pg-settings.listmode .pn[data-row]', { timeout: 20000 });
  await openPanel(page, 'settings', 'OFFLINE EYES');
  await page.waitForSelector('#pg-settings .wikioffer[data-pack="eyes-lens"]', { timeout: 10000 });
  await page.waitForSelector('#pg-settings .offeyes [data-eyes="caps"]', { timeout: 10000 });
}
const eyeRow = (page, id) => page.locator(`#pg-settings .wikioffer[data-pack="${id}"]`);
const eyeText = async (page, id) => ((await eyeRow(page, id).innerText().catch(() => '')) ?? '').replace(/\s+/g, ' ');
const inUse = (page) => text(page.locator('#pg-settings .offeyes .eyesize[data-of="eyes-name"] small'));
const caps = (page) => text(page.locator('#pg-settings .offeyes [data-eyes="caps"]'));
const CORE = '/vendor/clip/core.f16.bin';
{
  // a capable phone: 8 GB, 8 cores, WebGPU
  const { ctx, page, asked } = await phone({ mem: 8, cores: 8, gpu: true, larger: LARGER });
  await openEyes(page);
  // the standard seven (the Lens's four and the photo editor's cut-out, erase and RAW packs) and the larger row right after its own
  const order = await page.$$eval('#pg-settings .offeyes .wikioffer', (rs) => rs.map((r) => r.dataset.pack));
  check((await eyeRow(page, 'eyes-name-large').count()) === 1 && order.length === 8 && order[order.indexOf('eyes-name-large') - 1] === 'eyes-name', `[sizes] the larger row is not beside the standard seven: ${order.join(', ')}`);
  const t = await eyeText(page, 'eyes-name-large');
  check(/Larger, \d+ MB, for a newer phone/.test(t) && /Get · \d+ MB/i.test(t) && /on Wi-Fi/.test(t), `[sizes] the second size does not say what it is and what it costs: ${t.slice(0, 200)}`);
  check(/memory 8 GB · 8 cores · WebGPU yes; a larger size would be chosen for it/.test(await caps(page)), `[sizes] the capability line: "${await caps(page)}"`);
  check(/standard size \(the larger one is not on the phone yet\)/.test(await inUse(page)), `[sizes] before the fetch: "${await inUse(page)}"`);
  check(!asked.includes(CORE), '[sizes] looking at the panel fetched the larger model');
  await page.screenshot({ path: `${out}/eyes-larger.png`, timeout: 15000 }).catch(() => undefined);
  // mobile data: the tap waits for Wi-Fi and fetches nothing
  await page.evaluate(() => window.__net('cellular'));
  await eyeRow(page, 'eyes-name-large').locator('button[data-act="get"]').click();
  await page.waitForTimeout(700);
  check(!asked.includes(CORE) && /waits for Wi-Fi/.test(await eyeText(page, 'eyes-name-large')), `[sizes] on mobile data the larger model was fetched or the wait was not said: ${(await eyeText(page, 'eyes-name-large')).slice(0, 200)}`);
  await page.evaluate(() => window.__net('wifi'));
  await page.waitForFunction(() => document.querySelector('#pg-settings .wikioffer[data-pack="eyes-name-large"]')?.dataset.state === 'here', null, { timeout: 30000 }).catch(() => problems.push('[sizes] the larger pack did not arrive when Wi-Fi came'));
  check(asked.filter((p) => p === CORE).length >= 1, '[sizes] the larger model was never fetched on Wi-Fi');
  check((await eyeRow(page, 'eyes-name').getAttribute('data-state')) !== 'here', '[sizes] fetching the larger pack marked the standard one as here');
  check(/the larger size \(chosen for you: 8 GB of memory, 8 cores and WebGPU\)/.test(await inUse(page)), `[sizes] AUTO on a capable phone, larger here: "${await inUse(page)}"`);
  const pick = async (v) => { await page.locator(`#pg-settings .eyesize[data-of="eyes-name"] button[data-act="size-${v}"]`).click(); await page.waitForTimeout(500); };
  await pick('standard');
  check(/standard size \(chosen by hand\)/.test(await inUse(page)), `[sizes] STANDARD by hand: "${await inUse(page)}"`);
  await pick('larger');
  check(/the larger size \(chosen by hand\)/.test(await inUse(page)), `[sizes] LARGER by hand: "${await inUse(page)}"`);
  check((await page.evaluate(() => localStorage.getItem('ghosty.eyessize.eyes-name'))) === 'larger', '[sizes] the choice was not kept on the phone');
  await pick('auto');
  check(/chosen for you/.test(await inUse(page)) && (await page.evaluate(() => localStorage.getItem('ghosty.eyessize.eyes-name'))) === null, `[sizes] AUTO again: "${await inUse(page)}"`);
  await ctx.close();
}
for (const [name, o, re, larger] of [
  ['safari', { mem: null, cores: 6, gpu: true }, /memory not reported · 6 cores · WebGPU yes; a larger size is not chosen for it by itself: this browser does not say how much memory/, LARGER],
  ['4 GB', { mem: 4, cores: 8, gpu: true }, /memory 4 GB .* the phone says 4 GB of memory and a larger one wants 6/, LARGER],
  ['no WebGPU', { mem: 8, cores: 8, gpu: false }, /WebGPU no; a larger size is not chosen for it by itself: this browser has no WebGPU/, LARGER],
]) {
  const { ctx, page } = await phone(o);
  await page.evaluate((l) => (window.__ghostyEyesLarger = l), larger);
  await openEyes(page);
  const c = await caps(page);
  check(re.test(c), `[sizes ${name}] the capability line: "${c}"`);
  check(/standard size/.test(await inUse(page)), `[sizes ${name}] a phone that is not chosen for it uses the larger size: "${await inUse(page)}"`);
  await ctx.close();
}
{
  // Safari: even with the larger one on the phone, AUTO keeps the standard one, and LARGER by hand uses it
  const { ctx, page } = await phone({ mem: null, cores: 6, gpu: true, larger: LARGER });
  await openEyes(page);
  await eyeRow(page, 'eyes-name-large').locator('button[data-act="get"]').click();
  await page.waitForFunction(() => document.querySelector('#pg-settings .wikioffer[data-pack="eyes-name-large"]')?.dataset.state === 'here', null, { timeout: 30000 }).catch(() => problems.push('[sizes safari] the larger pack did not arrive'));
  check(/standard size \(this browser does not say how much memory/.test(await inUse(page)), `[sizes safari] AUTO with the larger here and no memory figure: "${await inUse(page)}"`);
  await page.locator('#pg-settings .eyesize[data-of="eyes-name"] button[data-act="size-larger"]').click();
  await page.waitForTimeout(500);
  check(/the larger size \(chosen by hand\)/.test(await inUse(page)), `[sizes safari] LARGER by hand: "${await inUse(page)}"`);
  await ctx.close();
}
{
  // no larger model on the site (the real list): one size, said plainly, and the phone read aloud
  const { ctx, page } = await phone({ mem: 8, cores: 8, gpu: true });
  await openEyes(page);
  check((await page.locator('#pg-settings .offeyes .wikioffer').count()) === 7 && (await page.locator('#pg-settings .offeyes .eyesize').count()) === 0, '[sizes none] a larger row or a choice is offered with no larger model (the standard seven only)');
  check(/^One size only for now: the Lens uses the one above on every phone\.$/.test(await text(page.locator('#pg-settings .offeyes [data-eyes="one"]'))) && /no larger free model with a clear licence is on this site yet/.test(await text(page.locator('#pg-settings .offeyes'))), '[sizes none] the panel does not say it is one size, with why behind its "?"');
  check(/memory 8 GB/.test(await caps(page)), `[sizes none] the phone is not read aloud: "${await caps(page)}"`);
  await ctx.close();
}

// ================================================================== 3b. the GYM's path
async function openGym(page) {
  await page.evaluate(() => (location.hash = 'gym'));
  await page.waitForSelector('#pg-gym .gympath', { state: 'attached', timeout: 20000 });
  await page.waitForFunction(() => !!document.querySelector('#pg-gym .gympath')?.dataset.path, null, { timeout: 15000 });
}
const gpath = (page) => page.locator('#pg-gym .gympath');
for (const [name, o, path, say, after] of [
  ['webgpu', { gpu: true, mem: 8 }, 'webgpu', /^Training on the graphics chip \(WebGPU\)\.$/, /^Graphics chip .* processor .*/],
  ['absent', { gpu: false, mem: 8 }, 'cpu', /^Training on the processor: this browser has no WebGPU\.$/, /^Processor .* for the practice network\.$/],
  ['fails', { gpu: true, mem: 8, failAfter: 12 }, 'cpu', null, /^Graphics chip|^Processor|processor was quicker|about/],
]) {
  const { ctx, page } = await phone(o);
  await openGym(page);
  const first = await text(page.locator('#pg-gym .gympath .gympathsay'));
  if (name !== 'fails') {
    check((await gpath(page).getAttribute('data-path')) === path && say.test(first), `[gym ${name}] before TIME IT: ${await gpath(page).getAttribute('data-path')} "${first}"`);
  } else check((await gpath(page).getAttribute('data-path')) === 'webgpu' && /graphics chip/.test(first), `[gym fails] chosen by capability first: "${first}"`);
  await page.locator('#pg-gym .gympath button[data-act="time-training"]').click();
  await page.waitForFunction(() => /ms|[0-9] s/.test(document.querySelector('#pg-gym .gympath .gympathtime')?.textContent ?? ''), null, { timeout: 90000 }).catch(() => problems.push(`[gym ${name}] TIME IT never said a time`));
  const timed = await text(page.locator('#pg-gym .gympath .gympathtime'));
  const said = await text(page.locator('#pg-gym .gympath .gympathsay'));
  const dispatches = await page.evaluate(() => window.__gpu.dispatches);
  if (name === 'webgpu') check(after.test(timed) && dispatches > 20 && (await gpath(page).getAttribute('data-path')) === 'webgpu', `[gym webgpu] "${timed}" after ${dispatches} dispatches`);
  if (name === 'absent') check(after.test(timed) && dispatches === 0 && (await gpath(page).getAttribute('data-path')) === 'cpu', `[gym absent] "${timed}" after ${dispatches} dispatches`);
  if (name === 'fails') check((await gpath(page).getAttribute('data-path')) === 'cpu' && /^Training moved to the processor: WebGPU stopped \(the chip stopped partway\)\.$/.test(said) && after.test(timed), `[gym fails] path ${await gpath(page).getAttribute('data-path')} "${said}" "${timed}"`);
  if (name === 'webgpu') await page.screenshot({ path: `${out}/gym-path.png`, timeout: 15000 }).catch(() => undefined);
  await ctx.close();
}

// ================================================================== 4b. the offline brain, measured
const engineSeed = { 'ghosty.offlinebrain': { model: FOUR, downloaded: true, have: [FOUR, SMALLID], guarded: true } };
const withEngine = (o) => phone({ ...o, engine: true }, { seed: engineSeed });
const stored = (page, k) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), k);
for (const [name, mem] of [['4 GB', 4], ['12 GB', 12], ['no figure', null]]) {
  const { ctx, page } = await withEngine({ mem, cores: 6, gpu: false });
  await openSystem(page);
  const line4 = await text(page.locator(`#pg-system .phonecard [data-phone="size"][data-size="${FOUR}"] .v`));
  if (mem === 4) check(/over what this phone says it can hold \(4 GB\): Ghosty uses a smaller brain instead/.test(line4), `[brain ${name}] the 4B's guidance: "${line4}"`);
  if (mem === 12) check(/needs about 3\.8 GB when running; fits what this phone says \(12 GB\); not measured yet/.test(line4), `[brain ${name}] the 4B's guidance: "${line4}"`);
  if (mem === null) check(/this browser does not report memory/.test(line4), `[brain ${name}] the 4B's guidance: "${line4}"`);
  check((await page.locator('#pg-system .phonecard [data-phone="size"]').count()) === 3, `[brain ${name}] not three sizes' guidance`);
  await page.locator('#pg-system .phonecard button[data-act="measure-brain"]').click();
  await page.waitForFunction(() => /loaded in|did not load/.test(document.querySelector('#pg-system .phonecard .pcnote')?.textContent ?? ''), null, { timeout: 20000 }).catch(() => problems.push(`[brain ${name}] MEASURE THE BRAIN never finished`));
  const note = await text(page.locator('#pg-system .phonecard .pcnote'));
  await page.waitForTimeout(800);
  const by = (await stored(page, 'ghosty.brainmeasure'))?.by ?? {};
  const brain = await stored(page, 'ghosty.offlinebrain');
  if (mem === 4) {
    check(!by[FOUR] && Object.keys(by).length === 1 && by[Object.keys(by)[0]].ms >= 200, `[brain 4 GB] the measure after the fall back: ${JSON.stringify(by)}`);
    check(/^Qwen3\.5 4B needs about 3\.8 GB of memory when running and this phone says it has 4 GB, which is too little to hold it safely, so Ghosty does not try\. Ghosty is using /.test(brain?.fellBack ?? ''), `[brain 4 GB] the plain words: "${brain?.fellBack}"`);
    check(brain?.model !== FOUR, '[brain 4 GB] the 4B stayed the brain in use');
    check(!(await page.evaluate(() => window.__ghostyOfflineEngine.loads)).includes(FOUR), '[brain 4 GB] the 4B was loaded anyway');
  } else {
    check(by[FOUR]?.ms >= 200 && by[FOUR].ms < 5000, `[brain ${name}] the 4B's measure: ${JSON.stringify(by)}`);
    check(!brain?.fellBack && brain?.model === FOUR, `[brain ${name}] the 4B was refused: "${brain?.fellBack}" ${brain?.model}`);
    check(/loaded in \d+ ms|loaded in 0\.\d s/.test(note) && /the page gained \d+(\.\d)? MB|memory not reported/.test(note), `[brain ${name}] the note: "${note}"`);
    const after4 = await text(page.locator(`#pg-system .phonecard [data-phone="size"][data-size="${FOUR}"] .v`));
    check(/loaded in/.test(after4), `[brain ${name}] the 4B's guidance after the measure: "${after4}"`);
  }
  await page.screenshot({ path: `${out}/phone-brain-${name.replace(' ', '')}.png`, timeout: 15000 }).catch(() => undefined);
  await ctx.close();
}
{
  // not on the phone: nothing to time, nothing downloaded
  const { ctx, page, asked } = await phone({ mem: 8, gpu: false });
  await openSystem(page);
  await page.locator('#pg-system .phonecard button[data-act="measure-brain"]').click();
  await page.waitForTimeout(500);
  check(/^No offline brain is on this phone, so there is nothing to time, and nothing is downloaded for this; GET one in SETTINGS\.$/.test(await text(page.locator('#pg-system .phonecard .pcnote'))), '[brain none] no words for a brain that is not on the phone');
  check(!asked.some((p) => /huggingface|webllm\/.*\.bin|resolve\/main/.test(p)), '[brain none] something was downloaded');
  await ctx.close();
}

// ================================================================== 5. three worlds at 440 and 390
for (const world of ['scan', 'glass', 'ink']) {
  for (const vp of [PHONE, SMALL]) {
    const tag = `[${world} ${vp.width}]`;
    const o = { hz: 120, mem: 8, cores: 8, gpu: true, larger: LARGER };
    const { ctx, page } = await phone(o, { viewport: vp, world });
    await openSystem(page);
    await page.waitForTimeout(900);
    check((await sideways(page, '#pg-system *')).length === 0, `${tag} SYSTEM sticks out sideways: ${(await sideways(page, '#pg-system *')).join(', ')}`);
    check((await tiny(page, '#pg-system .phonecard button')).length === 0, `${tag} a key under 44 pt on THIS PHONE: ${(await tiny(page, '#pg-system .phonecard button')).join(', ')}`);
    await page.screenshot({ path: `${out}/phone-${world}-${vp.width}.png`, timeout: 15000 }).catch(() => undefined);
    await openGym(page);
    await page.waitForTimeout(1800);
    check((await sideways(page, '#pg-gym .gympath, #pg-gym .gympath *')).length === 0 && (await page.$$eval('#pg-gym .gympath button', (b) => b.filter((x) => x.offsetHeight && x.offsetHeight < 44).map((x) => x.offsetHeight))).length === 0, `${tag} the GYM's path row: sideways ${(await sideways(page, '#pg-gym .gympath, #pg-gym .gympath *')).join()} small ${(await tiny(page, '#pg-gym .gympath button')).join()}`);
    await ctx.close();
    const e = await phone(o, { viewport: vp, world });
    await openEyes(e.page);
    await e.page.waitForTimeout(1800);
    check((await sideways(e.page, '#pg-settings *')).length === 0, `${tag} OFFLINE EYES sticks out sideways: ${(await sideways(e.page, '#pg-settings *')).join(', ')}`);
    check((await tiny(e.page, '#pg-settings .offeyes button')).length === 0, `${tag} a key under 44 pt in OFFLINE EYES: ${(await tiny(e.page, '#pg-settings .offeyes button')).join(', ')}`);
    await e.page.screenshot({ path: `${out}/eyes-larger-${world}-${vp.width}.png`, timeout: 15000 }).catch(() => undefined);
    await e.ctx.close();
  }
}

await browser.close();
if (problems.length) {
  console.error(`PHONE HARDWARE: ${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('ok: PHONE HARDWARE - the refresh meter and SYSTEM reading 120 and 60 Hz (Reduce Motion too), the capability rule and OFFLINE EYES with a second size (not fetched by looking, waits for Wi-Fi, AUTO by the phone, STANDARD and LARGER by hand, one size said when none is on the site), the GYM on WebGPU, without it and when it fails half-way (the same network learned on both), the offline brain measured with its three sizes guided, the 4B refused at 4 GB with the smaller brain taking over, three worlds at 440 and 390');
