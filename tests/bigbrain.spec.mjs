// A bigger offline brain (SETTINGS → OFFLINE BRAIN → WHICH BRAIN; apps/web/src/offline/models.ts PICKER and fitLine,
// offline/brain.ts chooseBrain / fallBack, features/settings/offline.ts). No WebGPU here, so a test engine stands in
// for the model on the phone (window.__ghostyOfflineEngine, as in offlinebrain.spec.mjs); it is told which model it
// loads, and "runs out of memory" for the one named in `failFor`. The browser is made to say what Safari says: no
// memory figure, no connection type (unless the spec sets one). Checked, at the owner's iPhone 18 Pro Max size:
//  1. the picker lists Qwen3 0.6B (in use, the fallback), Qwen3.5 2B and 4B with download, memory when running and
//     "fits an 18 Pro Max: yes / yes / tight"; the one line on cost and gain; a browser that gives its memory (8 GB)
//     gets "fits this device (8 GB)";
//  2. GET on mobile data is refused with the size, no question asked; on Wi-Fi it asks first, with the size; saying no
//     changes nothing; yes downloads it (the engine loads that very model), marks it IN USE, keeps the 0.6B ON THIS
//     PHONE, and tells the brain the training's new base (POST /api/training/base);
//  3. TEST on the chosen brain: the speed line, then the report card's QUICK CHECK, every question asked of the 2B,
//     filed in the report card under the 2B and its commit;
//  4. a bigger brain the phone cannot give the memory to: on GET (the 4B) and when a reply loads it (the 2B), the 0.6B
//     takes over and the panel says so in plain words; the training's base is not changed by a fallback; REMOVE frees
//     the 4B;
//  5. nothing scrolls sideways.
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
const ID = { small: 'Qwen3-0.6B-q4f16_1-MLC', two: 'Qwen3.5-2B-q4f16_1-MLC', four: 'Qwen3.5-4B-q4f16_1-MLC' };

const fakes = (memory) => {
  // Safari says nothing about the device's memory or its connection (a spec may set window.__net).
  Object.defineProperty(Navigator.prototype, 'deviceMemory', { get: () => memory ?? undefined, configurable: true });
  window.__net = '';
  Object.defineProperty(Navigator.prototype, 'connection', { get: () => (window.__net ? { type: window.__net } : undefined), configurable: true });
  window.__ghostyOfflineEngine = {
    ready: false,
    loads: [],
    calls: [],
    unloads: 0,
    failFor: '',
    idleMs: 60000,
    load(model) {
      this.loads.push(model);
      if (model && model === this.failFor) throw new Error('Out of memory: the GPU device was lost while loading');
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

async function signedIn(memory) {
  const ctx = await browser.newContext({ viewport: PHONE, ...UK });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
  await page.addInitScript(fakes, memory ?? null);
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pair input', { timeout: 20000 });
  await page.fill('#pair input', KEY);
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
  await page.evaluate(() => (location.hash = 'settings'));
  await openPanel(page, 'settings', 'OFFLINE');
  await page.waitForSelector('#pg-settings .offbrain .obbrain', { state: 'attached', timeout: 10000 });
  return { ctx, page };
}

const rows = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('#pg-settings .offbrain .obbrain')].map((r) => ({
      model: r.dataset.model,
      name: r.querySelector('.obname b')?.textContent ?? '',
      tag: r.querySelector('.obtag')?.textContent ?? '',
      facts: r.querySelector('.obfacts')?.textContent ?? '',
      buttons: [...r.querySelectorAll('button')].map((b) => b.textContent),
    })),
  );
const row = async (page, id) => (await rows(page)).find((r) => r.model === id);
const press = (page, id, label) => page.locator(`#pg-settings .offbrain .obbrain[data-model="${id}"] button`, { hasText: new RegExp(`^${label}$`) }).click();
// (stores save a moment after they change)
const stored = async (page) => (await page.waitForTimeout(600), page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.offlinebrain') ?? '{}')));
const toasts = (page) => page.evaluate(() => document.querySelector('#toasts')?.textContent ?? '');
const shot = async (page, name) => {
  await page.evaluate(() => document.querySelector('#pg-settings .offbrain .obpick')?.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/bigbrain-${browserName}-${name}.png` });
};

// ---- 1. the picker, as the owner's iPhone sees it
const { ctx, page } = await signedIn();
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
check(JSON.stringify(list.map((r) => r.name)) === JSON.stringify(['Qwen3 0.6B', 'Qwen3.5 2B', 'Qwen3.5 4B']), `the picker's brains: ${JSON.stringify(list.map((r) => r.name))}`);
check(list[0]?.facts === '352 MB download · about 1.4 GB of memory when running · fits an 18 Pro Max: yes · the fallback', `0.6B line: "${list[0]?.facts}"`);
check(list[1]?.facts === '1.1 GB download · about 2.2 GB of memory when running · fits an 18 Pro Max: yes', `2B line: "${list[1]?.facts}"`);
check(list[2]?.facts === '2.4 GB download · about 3.8 GB of memory when running · fits an 18 Pro Max: tight', `4B line: "${list[2]?.facts}"`);
check(list[0]?.tag === 'IN USE' && !list[1]?.tag && !list[2]?.tag, `only the 0.6B is marked in use: ${JSON.stringify(list.map((r) => r.tag))}`);
check(list[1]?.buttons.join() === 'GET' && list[2]?.buttons.join() === 'GET', `GET for the brains not on the phone: ${JSON.stringify(list.map((r) => r.buttons))}`);
check((await page.locator(`#pg-settings .offbrain .obbrain[data-model="${ID.two}"] button`).getAttribute('aria-label')) === 'Get Qwen3.5 2B: about 1.1 GB, on Wi-Fi', 'GET says the size to VoiceOver');
const cost = await page.locator('#pg-settings .offbrain .obcost').textContent();
check(/bigger download, more of the phone’s memory and a slower first word/.test(cost ?? '') && /answers better/.test(cost ?? '') && /tap TEST after it loads/.test(cost ?? ''), `the cost and gain line: "${cost}"`);
await shot(page, 'picker');

// the 0.6B on the phone first (the fallback), as the owner has it today
await page.locator('#pg-settings .offbrain > .bd > .keyrow button', { hasText: 'DOWNLOAD' }).click();
await page.waitForFunction(() => /READY/.test(document.querySelector('#pg-settings .pn.offbrain h3')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => problems.push('the 0.6B did not download'));

// ---- 2. GET: never on mobile data; asked first on Wi-Fi, with the size; "no" changes nothing
await page.evaluate(() => (window.__net = 'cellular'));
await press(page, ID.two, 'GET');
await page.waitForTimeout(400);
check(/You are on mobile data: Qwen3\.5 2B is about 1\.1 GB\. Join Wi-Fi/.test(await toasts(page)), `mobile data refused: "${await toasts(page)}"`);
check(dialogs.length === 0, 'no question on mobile data');
await page.evaluate(() => (window.__net = 'wifi'));
answer = 'dismiss';
await press(page, ID.two, 'GET');
await page.waitForTimeout(400);
check(/^Download Qwen3\.5 2B\? About 1\.1 GB, once, so only on Wi-Fi\. It needs about 2\.2 GB of memory when running; if your phone cannot give it that, Qwen3 0\.6B takes over\.$/.test(dialogs[0] ?? ''), `the question: "${dialogs[0]}"`);
check((await stored(page)).model === ID.small && !(await page.evaluate(() => window.__ghostyOfflineEngine.loads)).includes(ID.two), 'saying no changes nothing');
answer = 'accept';
await press(page, ID.two, 'GET');
await page.waitForFunction((id) => document.querySelector(`#pg-settings .offbrain .obbrain[data-model="${id}"] .obtag`)?.textContent === 'IN USE', ID.two, { timeout: 10000 }).catch(() => problems.push('the 2B is not marked IN USE after GET'));
check((await page.evaluate(() => window.__ghostyOfflineEngine.loads)).includes(ID.two), 'the download loaded the 2B itself');
list = await rows(page);
check(list[0]?.tag === 'ON THIS PHONE' && list[0]?.buttons.join() === 'USE', `the 0.6B stays on the phone, ready to switch back: ${JSON.stringify(list[0])}`);
check(/Ready on this phone: Qwen3\.5 2B \(1\.1 GB\)/.test((await page.locator('#pg-settings .offbrain .obstate').textContent()) ?? ''), 'the state line names the 2B');
await page.waitForTimeout(500);
check(based.join() === 'qwen3.5-2b', `the weekly training was told the new base: ${JSON.stringify(based)}`);
check((await stored(page)).trainBase === 'qwen3.5-2b' && (await stored(page)).pendingBase === null, `the brain's answer kept: ${JSON.stringify(await stored(page))}`);

// ---- 3. TEST on the chosen brain: the speed line, then the quick check, all on the 2B
await page.evaluate(() => (window.__ghostyOfflineEngine.calls = []));
await page.locator('#pg-settings .offbrain button', { hasText: /^TEST$/ }).click();
await page.waitForFunction(() => /tokens a second[\s\S]*QUICK CHECK on Qwen3\.5 2B: \d+ of 20 right as in chat/.test(document.querySelector('#pg-settings .offbrain .obtest')?.textContent ?? ''), null, { timeout: 60000 }).catch(async () => problems.push(`TEST did not show the speed and the quick check: "${await page.locator('#pg-settings .offbrain .obtest').textContent()}"`));
const asked = await page.evaluate(() => window.__ghostyOfflineEngine.calls);
check(asked.length === 21 && asked.every((c) => c.model === 'Qwen3.5-2B-q4f16_1-MLC'), `every TEST question went to the 2B: ${asked.length} calls, models ${[...new Set(asked.map((c) => c.model))]}`);
await page.waitForTimeout(600);
const filed = await page.evaluate(() => (JSON.parse(localStorage.getItem('ghosty.reportcard') ?? '{}').history ?? []).at(-1));
check(filed?.model === 'Qwen3.5-2B-q4f16_1-MLC@dd74e9c' && filed?.withThink === false && filed?.items?.length === 20, `filed in the report card under the 2B: ${JSON.stringify({ model: filed?.model, n: filed?.items?.length })}`);
await shot(page, 'tested-2b');
await page.locator('#pg-settings .offbrain .obtest').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${out}/bigbrain-${browserName}-test-line.png` });

// ---- 4. too big for the phone's memory: on GET (the 4B) …
await page.evaluate((id) => (window.__ghostyOfflineEngine.failFor = id), ID.four);
await press(page, ID.four, 'GET');
await page.waitForFunction(() => !!document.querySelector('#pg-settings .offbrain .obfell:not([hidden])'), null, { timeout: 10000 }).catch(() => problems.push('no words when the 4B did not fit'));
const fell = (await page.locator('#pg-settings .offbrain .obfell').textContent()) ?? '';
check(/^Qwen3\.5 4B needed more memory than this phone could give it just now, so Ghosty is using Qwen3 0\.6B instead\. Qwen3\.5 4B stays on this phone: close other apps and choose it again to try once more, or REMOVE it to free 2\.4 GB\.$/.test(fell), `the fallback words: "${fell}"`);
check((await stored(page)).model === ID.small, `the 0.6B took over: ${(await stored(page)).model}`);
check(/Download stopped: Qwen3\.5 4B needed more memory/.test(await toasts(page)), 'the download says why it stopped');
list = await rows(page);
check(list[0]?.tag === 'IN USE' && list[2]?.tag === 'ON THIS PHONE' && list[2]?.buttons.join() === 'USE,REMOVE', `after the fallback: ${JSON.stringify(list.map((r) => [r.tag, r.buttons]))}`);
check(based.join() === 'qwen3.5-2b', `a fallback does not move the training: ${JSON.stringify(based)}`);
check(/READY/.test((await page.locator('#pg-settings .pn.offbrain h3').textContent()) ?? ''), 'the 0.6B is ready at once (it was on the phone)');
await shot(page, 'fallback-4b');

// … and when a reply loads a brain that no longer fits (the 2B, chosen again: on the phone, so no question)
dialogs = [];
await page.evaluate(() => (window.__ghostyOfflineEngine.failFor = ''));
await press(page, ID.two, 'USE');
await page.waitForFunction((id) => document.querySelector(`#pg-settings .offbrain .obbrain[data-model="${id}"] .obtag`)?.textContent === 'IN USE', ID.two, { timeout: 5000 }).catch(() => problems.push('USE did not switch to the 2B'));
check(dialogs.length === 0, 'a brain on the phone is switched to without a question');
check(!(await page.locator('#pg-settings .offbrain .obfell').isVisible()), 'choosing again clears the fallback words');
await page.evaluate((id) => {
  window.__ghostyOfflineEngine.failFor = id;
  window.__ghostyOfflineEngine.calls = [];
}, ID.two);
await page.locator('#pg-settings .offbrain button', { hasText: /^TEST$/ }).click();
await page.waitForFunction(() => /tokens a second[\s\S]*QUICK CHECK on Qwen3 0\.6B: \d+ of 20/.test(document.querySelector('#pg-settings .offbrain .obtest')?.textContent ?? ''), null, { timeout: 60000 }).catch(async () => problems.push(`TEST after the 2B failed to load did not answer on the 0.6B: "${await page.locator('#pg-settings .offbrain .obtest').textContent()}"`));
const fell2 = (await page.locator('#pg-settings .offbrain .obfell').textContent()) ?? '';
check(/^Qwen3\.5 2B needed more memory than this phone could give it just now, so Ghosty is using Qwen3 0\.6B instead\./.test(fell2), `the fallback words at load: "${fell2}"`);
const asked2 = await page.evaluate(() => window.__ghostyOfflineEngine.calls);
check(asked2.length > 0 && asked2.every((c) => c.model === 'Qwen3-0.6B-q4f16_1-MLC'), `the answers came from the 0.6B: ${[...new Set(asked2.map((c) => c.model))]}`);

// REMOVE frees the 4B (asked first)
await page.evaluate(() => (window.__ghostyOfflineEngine.failFor = ''));
await press(page, ID.four, 'REMOVE');
await page.waitForFunction((id) => [...(document.querySelector(`#pg-settings .offbrain .obbrain[data-model="${id}"]`)?.querySelectorAll('button') ?? [])].some((b) => b.textContent === 'GET'), ID.four, { timeout: 5000 }).catch(() => problems.push('REMOVE did not take the 4B off the phone'));
check(/^Remove Qwen3\.5 4B from this phone\? It frees about 2\.4 GB/.test(dialogs.at(-1) ?? ''), `REMOVE asks: "${dialogs.at(-1)}"`);
check(!(await stored(page)).have.includes(ID.four), 'the 4B is no longer listed as on the phone');

// ---- 5. iPhone width: nothing sideways
const fit = await page.evaluate(() => {
  const pn = document.querySelector('#pg-settings .offbrain');
  const w = pn.getBoundingClientRect();
  const over = [...pn.querySelectorAll('.obbrain, .obbrain *, .obcost, .obfell')].filter((e) => e.getBoundingClientRect().right > w.right + 1).map((e) => `${e.className}: ${(e.textContent ?? '').slice(0, 30)}`);
  return { doc: document.documentElement.scrollWidth, vw: innerWidth, over };
});
check(fit.doc <= fit.vw && fit.over.length === 0, `sideways: ${JSON.stringify(fit)}`);
// (the preview brain is shared by every spec run: its training goes back to the 0.6B, leaving nothing to roll back to)
const back = await page.evaluate(async (k) => (await fetch('/api/training/base', { method: 'POST', body: '{"base":"qwen3-0.6b"}', headers: { 'content-type': 'application/json', 'x-ghosty': '1', 'x-ghosty-key': k } })).json(), KEY);
check(back.base === 'qwen3-0.6b' && back.switchedFrom === undefined, `the preview brain put back: ${JSON.stringify({ base: back.base, from: back.switchedFrom })}`);
await ctx.close();

// ---- a browser that says how much memory it has (Chrome on a laptop: 8 GB)
const chrome = await signedIn(8);
const lines = (await rows(chrome.page)).map((r) => r.facts.split(' · ').at(-1) === 'the fallback' ? r.facts.split(' · ').at(-2) : r.facts.split(' · ').at(-1));
check(JSON.stringify(lines) === JSON.stringify(['fits this device (8 GB): yes', 'fits this device (8 GB): tight', 'fits this device (8 GB): no']), `with the browser's 8 GB: ${JSON.stringify(lines)}`);
await chrome.ctx.close();

await browser.close();
if (problems.length) {
  console.error(`bigbrain spec (${browserName}): ${problems.length} problem(s)\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`bigbrain spec (${browserName}): all good — the picker, GET asked with the size and never on mobile data, TEST on the chosen brain, the 0.6B fallback in plain words, REMOVE, no sideways scroll`);
