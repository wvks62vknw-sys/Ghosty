// Ghosty's own voice and pictures in the chat. The brain here has no Workers AI, so its status
// is patched to say it can speak and /api/tts answers with a short real WAV: a reply must then
// play through the shared audio element (its src becomes a blob address), the SETTINGS select
// switches to the phone's voice (no more /api/tts calls) and back, and a reply carrying one of
// Ghosty's /i/<id> picture links shows the picture itself as a card.
//   node tests/voice.spec.mjs [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const problems = [];

/** A tenth of a second of silence as 16 kHz mono 16-bit WAV. */
function wav(samples = 1600, rate = 16_000) {
  const b = Buffer.alloc(44 + samples * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + samples * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(samples * 2, 40);
  return b;
}
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8DwnwEIGIEEADWvA/+VJyY+AAAAAElFTkSuQmCC', 'base64');

for (const [name, viewport] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`[${name}] pageerror: ${e.message}`));
  let tts = 0;
  const said = [];
  await ctx.route('**/api/status', async (route) => {
    const r = await route.fetch();
    const j = await r.json();
    j.speech = { stt: true, tts: true };
    await route.fulfill({ response: r, headers: { ...r.headers(), 'content-type': 'application/json' }, body: JSON.stringify(j) });
  });
  await ctx.route('**/api/tts', async (route) => {
    tts++;
    said.push(JSON.parse(route.request().postData() ?? '{}').text);
    await route.fulfill({ status: 200, headers: { 'content-type': 'audio/wav', 'cache-control': 'private, max-age=86400' }, body: wav() });
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pair input', { timeout: 15000 });
  await page.fill('#pair input', 'preview-owner-key-0123456789');
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
  await page.waitForTimeout(800);
  const narrow = viewport.width < 1240;
  if (narrow) await page.click('.logbtn');
  const ask = async (text, expect) => {
    await page.fill('#cin', text);
    await page.keyboard.press('Enter');
    await page.waitForFunction((e) => document.body.innerText.includes(e), expect, { timeout: 15000 });
  };
  /** Waits (up to `ms`) for the stubbed /api/tts to have been asked `n` times: the request is counted when the stub answers it. */
  const ttsCalls = async (n, ms = 8000) => {
    const t0 = Date.now();
    while (tts < n && Date.now() - t0 < ms) await page.waitForTimeout(100);
    return tts >= n;
  };
  const clipSrc = () => page.evaluate(() => document.querySelector('audio#gvoice')?.src ?? '');

  // 1. a reply is spoken in Ghosty's own voice: /api/tts is asked and the audio element plays the clip
  const caps = await page.evaluate(() => window.__ghosty.settings.get().voiceEngine);
  if (caps !== 'ghosty') problems.push(`[${name}] the default voice engine is ${caps}, not ghosty`);
  // the first tap already played a moment of silence through the element: the reply must be a different clip
  const unlockSrc = await clipSrc();
  if (!unlockSrc.startsWith('blob:')) problems.push(`[${name}] the first tap did not unlock the audio element (src "${unlockSrc}")`);
  await ask('hello there', 'Mock reply to: hello there');
  if (!(await ttsCalls(1))) problems.push(`[${name}] /api/tts was never asked`);
  const played = await page.waitForFunction((prev) => {
    const s = document.querySelector('audio#gvoice')?.src ?? '';
    return s.startsWith('blob:') && s !== prev;
  }, unlockSrc, { timeout: 8000 }).then(() => true, () => false);
  if (!played) problems.push(`[${name}] the reply did not go through the audio element (tts calls: ${tts})`);
  if (!said.some((s) => /hello there/.test(s))) problems.push(`[${name}] the sentence sent to /api/tts was ${JSON.stringify(said)}`);
  await page.screenshot({ path: `${out}/${name}-voice-ghosty.png` });

  // 2. SETTINGS → VOICE: the phone's voice instead — no more /api/tts calls
  if (narrow) await page.click('.logbtn');
  await page.evaluate(() => (location.hash = 'settings'));
  await page.waitForSelector('select[aria-label="Voice engine"]', { timeout: 10000 });
  const options = await page.evaluate(() => [...document.querySelectorAll('select[aria-label="Voice engine"] option')].map((o) => o.textContent));
  if (!options.some((o) => /Ghosty's own voice/.test(o)) || !options.some((o) => /This phone's voice/.test(o))) problems.push(`[${name}] voice engine options: ${options.join(' | ')}`);
  await page.selectOption('select[aria-label="Voice engine"]', 'phone');
  const engine = await page.evaluate(() => window.__ghosty.settings.get().voiceEngine);
  if (engine !== 'phone') problems.push(`[${name}] the select did not switch the engine (settings say ${engine})`);
  await page.waitForTimeout(900); // the panes assemble with a short animation: photograph them where they land
  await page.screenshot({ path: `${out}/${name}-voice-settings.png` });
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(500);
  if (narrow) await page.click('.logbtn');
  const before = tts;
  await ask('hello again', 'Mock reply to: hello again');
  await page.waitForTimeout(1500);
  if (tts !== before) problems.push(`[${name}] the phone's voice was chosen but /api/tts was still asked (${tts - before} more calls)`);
  // and back: Ghosty's voice again (a fresh page, so an earlier playback hiccup cannot hold the phone's voice)
  await page.evaluate(() => (location.hash = 'settings'));
  await page.waitForSelector('select[aria-label="Voice engine"]', { timeout: 10000 });
  await page.selectOption('select[aria-label="Voice engine"]', 'ghosty');
  await page.waitForTimeout(400);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(400);
  if (narrow) await page.click('.logbtn');
  const again = tts;
  await ask('and once more', 'Mock reply to: and once more');
  if (!(await ttsCalls(again + 1))) problems.push(`[${name}] back on Ghosty's voice, /api/tts was not asked`);

  // 3. a picture Ghosty made: its /i/<id> link in a reply shows as the picture
  const pic = `${base}/i/AAAAAAAAAAAAAAAA`;
  await ctx.route('**/i/AAAAAAAAAAAAAAAA', (route) => route.fulfill({ status: 200, headers: { 'content-type': 'image/png' }, body: PNG }));
  const lines = `${JSON.stringify({ t: 'text', text: `Here is your cat: ${pic} (kept 7 days).` })}\n${JSON.stringify({ t: 'done', model: 'Mock · scripted' })}\n`;
  await ctx.route('**/api/chat', (route) => route.fulfill({ status: 200, headers: { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' }, body: lines }));
  await ask('draw a cat', 'Here is your cat');
  const card = await page.waitForFunction(() => {
    const img = document.querySelector('.msg a.piccard img');
    return img && img.complete && img.naturalWidth > 0 ? { alt: img.alt, href: img.closest('a').href, w: img.getBoundingClientRect().width, vw: innerWidth } : null;
  }, null, { timeout: 10000 }).then((h) => h.jsonValue(), () => null);
  if (!card) problems.push(`[${name}] the picture link did not become a picture card`);
  else {
    if (card.alt !== 'picture Ghosty made') problems.push(`[${name}] picture alt is "${card.alt}"`);
    if (card.href !== pic) problems.push(`[${name}] picture card opens ${card.href}`);
    if (card.w > card.vw) problems.push(`[${name}] picture card wider than the screen (${card.w} > ${card.vw})`);
  }
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/${name}-voice-picture.png` });
  await ctx.close();
}
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : "Voice run clean: Ghosty's voice, the engine switch and the picture card.");
process.exit(problems.length ? 1 : 0);
