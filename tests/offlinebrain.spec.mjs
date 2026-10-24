// The offline brain (SETTINGS → OFFLINE BRAIN, apps/web/src/offline/): this browser has no WebGPU,
// so a test engine stands in for the model on the phone (window.__ghostyOfflineEngine). Checked:
// the vendored runtime, worker and model code are served with the right types and the policy lets
// the weights come from Hugging Face; the panel shows its state, DOWNLOAD and TEST work; with the
// brain unreachable (the chat request aborted) or out of models ("no model:" in the mock) the reply
// comes from the phone with its OFFLINE chip, but not once a tool already ran in the turn; the model
// leaves memory after DOWNLOAD and soon after a reply; "translate … into Spanish" with no signal (chat and Lens
// TRANSLATE) is translated by the phone's model and says "rough, offline" and "check the important bits"; "always" never asks the brain at all, never
// starts a download when the model isn't here, and "stop" while the model loads writes nothing. TEST ends with the
// report card's QUICK CHECK on the same brain.
//   node tests/offlinebrain.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { DESKTOP, PHONE, UK, openPanel } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const problems = [];

// The vendored files load from this site, with the types a browser insists on.
for (const [path, type] of [
  ['/vendor/webllm/worker.mjs', /javascript/],
  ['/vendor/webllm/web-llm.mjs', /javascript/],
  ['/vendor/webllm/libs/Qwen3-0.6B-q4f16_1_cs1k-webgpu.wasm', /^application\/wasm/],
  ['/vendor/webllm/libs/Qwen2-0.5B-Instruct-q4f16_1_cs1k-webgpu.wasm', /^application\/wasm/],
]) {
  const r = await fetch(base + path, { method: 'HEAD' }).catch((e) => ({ ok: false, status: String(e), headers: new Headers() }));
  if (!r.ok) problems.push(`${path}: HTTP ${r.status}`);
  else if (!type.test(r.headers.get('content-type') ?? '')) problems.push(`${path}: content-type ${r.headers.get('content-type')}`);
  const csp = r.headers.get('content-security-policy') ?? '';
  if (r.ok && !/connect-src[^;]*https:\/\/huggingface\.co[^;]*https:\/\/\*\.hf\.co/.test(csp)) problems.push(`${path}: the policy does not let the weights come from Hugging Face: ${csp.slice(0, 120)}`);
  if (r.ok && !/script-src[^;]*'wasm-unsafe-eval'/.test(csp)) problems.push(`${path}: the policy does not let WebAssembly compile`);
}

const engine = () => {
  // A stand-in for the model on the phone: not downloaded yet, answers in four pieces.
  window.__ghostyOfflineEngine = {
    ready: false,
    calls: [],
    loads: 0,
    unloads: 0,
    loadMs: 0,
    idleMs: 500,
    async load() {
      this.loads++;
      if (this.loadMs) await new Promise((r) => setTimeout(r, this.loadMs));
    },
    unload() {
      this.unloads++;
    },
    async chat(messages, onToken) {
      this.calls.push(messages);
      // Asked to translate (offline/prompt.ts translatePrompt): a translation, labelled the way a small model might.
      const words = /You are a translator/.test(messages[0]?.content ?? '') ? ['<think>\n\n</think>\n\n', 'Spanish: ', '"Buenos ', 'días"'] : ['<think>\n\n</think>\n\n', 'Hello ', 'from ', 'your ', 'phone.'];
      for (const w of words) {
        await new Promise((r) => setTimeout(r, 30));
        onToken(w);
      }
    },
  };
};

async function run(name, viewport) {
  const ctx = await browser.newContext({ viewport, ...UK });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${name}] pageerror: ${e.message}`));
  await page.addInitScript(engine);
  // A phone with a Spanish voice (headless Chromium has none): what READ ALOUD says, and in which voice, is recorded.
  await page.addInitScript(() => {
    const es = { name: 'Mónica', lang: 'es-ES', localService: true, default: false, voiceURI: 'Mónica' };
    const en = { name: 'Daniel', lang: 'en-GB', localService: true, default: true, voiceURI: 'Daniel' };
    window.__spoken = [];
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    speechSynthesis.getVoices = () => [en, es];
    speechSynthesis.speak = (u) => { window.__spoken.push({ text: u.text, lang: u.lang, voice: u.voice?.name }); setTimeout(() => u.onend?.(), 10); };
  });
  let chats = 0;
  page.on('request', (r) => {
    if (new URL(r.url()).pathname === '/api/chat') chats++;
  });
  await page.goto(base);
  await page.fill('#pair input', 'preview-owner-key-0123456789');
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
  const narrow = viewport.width < 900;

  // The real worker starts under the app's policy and imports the vendored runtime (WebGPU itself
  // is missing here, so it can only say the model isn't loaded — which proves it parsed and answers).
  const reply = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const w = new Worker('/vendor/webllm/worker.mjs', { type: 'module' });
        const done = (v) => {
          w.terminate();
          resolve(v);
        };
        w.onmessage = (e) => done(e.data);
        w.onerror = (e) => done({ t: 'worker-error', message: e.message });
        w.postMessage({ id: 7, op: 'chat', messages: [] });
        setTimeout(() => done({ t: 'timeout' }), 20000);
      }),
  );
  if (reply?.id !== 7 || reply?.t !== 'error' || !/not loaded/.test(reply?.message ?? '')) problems.push(`[${name}] the vendored worker did not start: ${JSON.stringify(reply).slice(0, 200)}`);

  // The panel: not downloaded → DOWNLOAD → ready → TEST shows the reply and its speed.
  await page.evaluate(() => (location.hash = 'settings'));
  const pn = page.locator('#pg-settings .pn.offbrain');
  await pn.waitFor({ state: 'attached', timeout: 10000 });
  await openPanel(page, 'settings', 'OFFLINE');
  await page.waitForFunction(() => /NOT DOWNLOADED/.test(document.querySelector('#pg-settings .pn.offbrain h3')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => problems.push(`[${name}] the panel does not say NOT DOWNLOADED`));
  if (!/About 352 MB, once: use Wi-Fi/.test((await pn.textContent()) ?? '')) problems.push(`[${name}] no size and Wi-Fi advice`);
  // What it is for (OWNER-ISSUES 46): online the far bigger free brains answer; this one is for no signal. No stale size.
  const what = (await pn.locator('.obwhat').textContent().catch(() => '')) ?? '';
  if (!/^For when there is no signal\. Online, Ghosty answers with far bigger brains, free/.test(what) || /352 MB/.test(what)) problems.push(`[${name}] the panel does not say what the phone brain is for: "${what}"`);
  const modes = await pn.locator('select[aria-label="Offline brain mode"] option').allTextContents();
  if (modes.join(' | ') !== 'Answer on this phone: only when needed (no signal) | Answer on this phone: always (never online) | Answer on this phone: never') problems.push(`[${name}] the mode reads: ${modes.join(' | ')}`);
  if (!(await pn.locator('button:has-text("TEST")').isDisabled())) problems.push(`[${name}] TEST is enabled before a download`);
  await pn.locator('button:has-text("DOWNLOAD")').click();
  await page.waitForFunction(() => /READY/.test(document.querySelector('#pg-settings .pn.offbrain h3')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => problems.push(`[${name}] the panel did not turn READY after DOWNLOAD`));
  // A download alone leaves nothing in memory (the camera and the namer need the room).
  if ((await page.evaluate(() => window.__ghostyOfflineEngine.unloads)) < 1) problems.push(`[${name}] the model stayed in memory after DOWNLOAD`);
  // Counted before TEST: on a slow runner the idle unload (500 ms here) can land before the reply is seen.
  const unloaded = await page.evaluate(() => window.__ghostyOfflineEngine.unloads);
  await pn.locator('button:has-text("TEST")').click();
  await page.waitForFunction(() => /Hello from your phone\.[\s\S]*tokens a second/.test(document.querySelector('#pg-settings .pn.offbrain .obtest')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => problems.push(`[${name}] TEST did not show the reply and its speed`));
  // then the report card's QUICK CHECK on the same brain (tests/bigbrain.spec.mjs checks it in full)
  await page.waitForFunction(() => /QUICK CHECK on Qwen3 0\.6B: \d+ of 20 right as in chat/.test(document.querySelector('#pg-settings .pn.offbrain .obtest')?.textContent ?? ''), null, { timeout: 60000 }).catch(() => problems.push(`[${name}] TEST did not run the quick check`));
  // the result sits right under TEST (not under the two choices below it), and one token is "1 token"
  const placed = await page.evaluate(() => { const o = document.querySelector('#pg-settings .pn.offbrain .obtest'); const prev = o?.previousElementSibling; return { prev: prev?.className ?? '', test: [...(prev?.querySelectorAll('button') ?? [])].some((b) => b.textContent === 'TEST'), text: o?.textContent ?? '' }; });
  if (!placed.test || /\b1 tokens\b/.test(placed.text)) problems.push(`[${name}] TEST's result is not under TEST, or says "1 tokens": ${JSON.stringify(placed).slice(0, 200)}`);
  // After a reply, too, it leaves memory once idle (idleMs here; two minutes on the phone).
  await page.waitForFunction((k) => window.__ghostyOfflineEngine.unloads > k, unloaded, { timeout: 5000 }).catch(() => problems.push(`[${name}] the model stayed in memory after TEST`));
  await pn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${name}-offline-panel.png` });

  // The brain unreachable: the phone answers, with the chip; what it was told says it is offline.
  await page.evaluate(() => (location.hash = 'core'));
  if (narrow) await page.click('.logbtn');
  await page.route('**/api/chat', (route) => route.abort('internetdisconnected'));
  await page.fill('#cin', 'what should I cook tonight');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => [...document.querySelectorAll('.msg.off')].some((m) => /Hello from your phone\./.test(m.textContent ?? '') && /Answered on your phone \(offline\)/i.test(m.textContent ?? '')), null, { timeout: 10000 }).catch(() => problems.push(`[${name}] no offline reply when the brain was unreachable`));
  const sys = await page.evaluate(() => window.__ghostyOfflineEngine.calls.at(-1)?.[0]?.content ?? '');
  if (!/running on .*phone, offline/.test(sys)) problems.push(`[${name}] the small model was not told it is offline: ${sys.slice(0, 160)}`);
  const asked = await page.evaluate(() => window.__ghostyOfflineEngine.calls.at(-1)?.at(-1)?.content ?? '');
  if (asked !== 'what should I cook tonight') problems.push(`[${name}] the question was not last: "${asked}"`);
  if (await page.locator('.msg.err', { hasText: 'Failed to fetch' }).count()) problems.push(`[${name}] the connection error showed as well`);
  await page.unroute('**/api/chat');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${name}-offline-unreachable.png` });

  // "Translate … into Spanish" with no signal: the phone's model is asked only to translate; the card says
  // which language, "rough, offline", and "Offline translation: check the important bits".
  await page.route('**/api/chat', (route) => route.abort('internetdisconnected'));
  await page.fill('#cin', 'translate good morning into Spanish');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => [...document.querySelectorAll('.msg.off.tr')].some((m) => /Buenos días/.test(m.textContent ?? '') && /Spanish · rough, offline/.test(m.textContent ?? '') && /Offline translation: check the important bits/.test(m.textContent ?? '')), null, { timeout: 10000 }).catch(async () => problems.push(`[${name}] no rough offline translation shown: ${(await page.locator('.msg').allTextContents()).slice(-2).join(' | ').slice(0, 300)}`));
  const trCall = await page.evaluate(() => window.__ghostyOfflineEngine.calls.at(-1));
  if (!/Translate the user's message into Spanish/.test(trCall?.[0]?.content ?? '') || trCall?.at(-1)?.content !== 'good morning') problems.push(`[${name}] the small model was not asked to translate: ${JSON.stringify(trCall).slice(0, 200)}`);
  // the translation itself, cleaned of its label and quotes
  const trText = await page.locator('.msg.off.tr .trtext').last().textContent().catch(() => '');
  if (trText !== 'Buenos días') problems.push(`[${name}] the translation reads "${trText}"`);
  // READ ALOUD in the translation's own language, with the phone's Spanish voice
  await page.locator('.msg.off.tr button', { hasText: 'READ ALOUD' }).last().click().catch(() => problems.push(`[${name}] no READ ALOUD on the offline translation`));
  await page.waitForTimeout(200);
  const said = await page.evaluate(() => window.__spoken.at(-1));
  if (said?.text !== 'Buenos días' || said?.lang !== 'es-ES' || said?.voice !== 'Mónica') problems.push(`[${name}] READ ALOUD did not use the Spanish voice: ${JSON.stringify(said)}`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${name}-offline-translation.png` });
  await page.unroute('**/api/chat');

  // Lens TRANSLATE with no signal falls back to the phone's model too, with the same honest words.
  if (narrow) await page.click('.logbtn').catch(() => undefined);
  await page.route('**/api/translate', (route) => route.abort('internetdisconnected'));
  await page.evaluate(() => window.__ghosty.run('open_lens', { mode: 'translate' }));
  const scanTr = page.locator('#pg-lens textarea.lensocr');
  if (await scanTr.waitFor({ state: 'visible', timeout: 10000 }).then(() => true, () => false)) {
    await page.locator('#pg-lens select.scanlang').selectOption('es');
    await scanTr.fill('good morning');
    await page.locator('#pg-lens button.warn', { hasText: /^TRANSLATE$/ }).click();
    await page.waitForFunction(() => window.__ghosty?.scan?.translation === 'Buenos días' && window.__ghosty?.scan?.engine === 'offline', null, { timeout: 10000 }).catch(async () => problems.push(`[${name}] Lens TRANSLATE did not fall back to the phone: ${JSON.stringify(await page.evaluate(() => window.__ghosty?.scan ?? null)).slice(0, 300)}`));
    const reply = (await page.locator('#pg-lens .lensreply').textContent().catch(() => '')) ?? '';
    if (!/rough, offline/.test(reply) || !/Offline translation: check the important bits/.test(reply)) problems.push(`[${name}] the Lens translation does not say it is rough and offline: ${reply.slice(0, 200)}`);
    await page.locator('#pg-lens .lensreply').scrollIntoViewIfNeeded().catch(() => undefined);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/${name}-lens-offline-translation.png` });
  } else problems.push(`[${name}] Lens TRANSLATE did not open`);
  await page.unroute('**/api/translate');
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(400);
  if (narrow && !(await page.locator('#cin').isVisible().catch(() => false))) await page.click('.logbtn');

  // Every model busy (the mock's "no model:"): the brain's error is held back and the phone answers.
  const before = await page.locator('.msg.off').count();
  await page.fill('#cin', 'no model: zxqv blorf quux');
  await page.keyboard.press('Enter');
  // Wait for the reply itself, not just its bubble: the bubble shows before the phone's model is asked,
  // and the next step counts the model's calls.
  await page.waitForFunction((n) => { const off = [...document.querySelectorAll('.msg.off')]; return off.length > n && /Hello from your phone\./.test(off.at(-1)?.textContent ?? ''); }, before, { timeout: 15000 }).catch(() => problems.push(`[${name}] no offline reply when no model was free`));
  await page.waitForFunction(() => !document.body.innerText.includes('thinking on your phone'), null, { timeout: 5000 }).catch(() => undefined);
  if (await page.locator('.msg.err', { hasText: 'cooling down' }).count()) problems.push(`[${name}] the "no model" error showed although the phone answered`);

  // A tool already ran in the turn, then no model was free: the phone's model can't see what the tool
  // found, so the brain's own error shows and the phone does not answer blind.
  const offBefore = await page.locator('.msg.off').count();
  const askedBefore = await page.evaluate(() => window.__ghostyOfflineEngine.calls.length);
  await page.fill('#cin', 'tool then no model: zxqv blorf');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => [...document.querySelectorAll('.msg.err')].some((m) => /cooling down/.test(m.textContent ?? '')), null, { timeout: 15000 }).catch(() => problems.push(`[${name}] the brain's "no model" error after a tool did not show`));
  await page.waitForTimeout(500);
  if ((await page.locator('.msg.off').count()) !== offBefore || (await page.evaluate(() => window.__ghostyOfflineEngine.calls.length)) !== askedBefore) problems.push(`[${name}] the phone answered a turn whose tool had already run`);

  // An ordinary message still goes to the brain in "only when needed".
  await page.fill('#cin', 'hello brain');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.body.innerText.includes('Mock reply to: hello brain'), null, { timeout: 10000 }).catch(() => problems.push(`[${name}] the brain did not answer an ordinary message`));

  // "Always": the brain is never asked.
  if (narrow) await page.click('.logbtn');
  await page.evaluate(() => (location.hash = 'settings'));
  await openPanel(page, 'settings', 'OFFLINE');
  await pn.locator('select[aria-label="Offline brain mode"]').selectOption('always');
  await page.evaluate(() => (location.hash = 'core'));
  if (narrow) await page.click('.logbtn');
  const sent = chats;
  const n = await page.locator('.msg.off').count();
  await page.fill('#cin', 'tell me something nice');
  await page.keyboard.press('Enter');
  await page.waitForFunction((k) => document.querySelectorAll('.msg.off').length > k, n, { timeout: 10000 }).catch(() => problems.push(`[${name}] "always" gave no offline reply`));
  await page.waitForTimeout(500);
  if (chats !== sent) problems.push(`[${name}] "always" still asked the brain (${chats - sent} chat requests)`);
  await page.screenshot({ path: `${out}/${name}-offline-always.png` });

  // "Always", and "stop" while the model is still loading: nothing is written or spoken.
  await page.evaluate(() => (window.__ghostyOfflineEngine.loadMs = 1500));
  const n2 = await page.locator('.msg.off').count();
  const asked2 = await page.evaluate(() => window.__ghostyOfflineEngine.calls.length);
  const loads2 = await page.evaluate(() => window.__ghostyOfflineEngine.loads);
  await page.fill('#cin', 'tell me a long story');
  await page.keyboard.press('Enter');
  await page.waitForFunction((k) => window.__ghostyOfflineEngine.loads > k, loads2, { timeout: 5000 }).catch(() => problems.push(`[${name}] the model never started loading`));
  await page.fill('#cin', 'stop');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2500);
  if ((await page.evaluate(() => window.__ghostyOfflineEngine.calls.length)) !== asked2) problems.push(`[${name}] "stop" while loading was ignored: the model wrote a reply`);
  if ((await page.locator('.msg.off').count()) !== n2) problems.push(`[${name}] "stop" while loading still left a reply`);
  if (await page.locator('.msg.err', { hasText: "couldn't answer" }).count()) problems.push(`[${name}] "stop" while loading showed an error`);
  await page.evaluate(() => (window.__ghostyOfflineEngine.loadMs = 0));

  // "Always" with the model not on this phone (never downloaded, or the cache was cleared): no
  // download starts and the model is never asked; the chat says to DOWNLOAD it first.
  await page.evaluate(() => (window.__ghostyOfflineEngine.ready = false));
  const loads3 = await page.evaluate(() => window.__ghostyOfflineEngine.loads);
  const asked3 = await page.evaluate(() => window.__ghostyOfflineEngine.calls.length);
  const sent3 = chats;
  await page.fill('#cin', 'are you there');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => [...document.querySelectorAll('.msg.err')].some((m) => /isn't on this phone yet[\s\S]*DOWNLOAD/.test(m.textContent ?? '')), null, { timeout: 8000 }).catch(() => problems.push(`[${name}] "always" without the model did not say to DOWNLOAD it`));
  if ((await page.evaluate(() => window.__ghostyOfflineEngine.loads)) !== loads3 || (await page.evaluate(() => window.__ghostyOfflineEngine.calls.length)) !== asked3) problems.push(`[${name}] "always" without the model still tried to load (download) it`);
  if (chats !== sent3) problems.push(`[${name}] "always" without the model asked the brain`);
  await ctx.close();
}

await run('desktop', DESKTOP);
await run('phone', PHONE);
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'Offline brain run clean: vendored files served, panel, fallback and "always" work.');
process.exit(problems.length ? 1 : 0);
