// Lens SOUND on an iPhone 13, with Chromium's fake microphone playing a WAV made here:
//  1. a clipped 440 Hz sine → LISTEN (5 s) says "clipping: turn the volume down…", the spectrum is
//     drawn, and ASK GHOSTY sends the report in words as `seen` (never the recording; /api/chat is
//     stubbed and checked);
//  2. a clean sine → LISTEN says clean; TEST TONE (the fake microphone cannot hear the phone's tone)
//     says plainly that it didn't hear the test tone;
//  3. a recording of the test tone through a speaker that clips above 60% (the plan rendered by
//     sound/analyse.ts itself, then clipped) → TEST TONE finds where it distorts and draws the
//     response.
// The camera stays off in SOUND, the security policy blocks nothing and nothing sticks out sideways.
import { chromium } from 'playwright';
import { PHONE, UK } from './nav.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const problems = [];
const SR = 48000;

/** 16-bit mono PCM WAV. */
function wav(samples) {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + samples.length * 2, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  return b;
}
const sine = (f, a, sec, clip = Infinity) => Array.from({ length: Math.round(SR * sec) }, (_, i) => Math.max(-clip, Math.min(clip, a * Math.sin((2 * Math.PI * f * i) / SR))));
/** The test tone as sound/analyse.ts renders it (TONE_PLAN), as heard 1 s in, through a speaker at 80% that clips at `clip`. */
function plan(clip) {
  const levels = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
  const step = 0.5, gap = 0.3, from = 40, to = 16000, sweepSec = 4, sweepLevel = 0.5;
  const lead = Math.round(1.0 * SR);
  const stepN = Math.round(step * SR);
  const outS = new Array(lead + levels.length * stepN + Math.round((gap + sweepSec + 1.5) * SR)).fill(0);
  for (let i = 0; i < levels.length * stepN; i++) outS[lead + i] = Math.max(-clip, Math.min(clip, 0.8 * levels[Math.floor(i / stepN)] * Math.sin((2 * Math.PI * 1000 * i) / SR)));
  const s0 = lead + levels.length * stepN + Math.round(gap * SR);
  const k = Math.log(to / from);
  for (let i = 0; i < sweepSec * SR; i++) {
    const t = i / SR;
    outS[s0 + i] = Math.max(-clip, Math.min(clip, 0.8 * sweepLevel * Math.sin(((2 * Math.PI * from * sweepSec) / k) * (Math.exp((k * t) / sweepSec) - 1))));
  }
  return outS;
}
const dir = join(tmpdir(), `ghosty-sound-${process.pid}`);
mkdirSync(dir, { recursive: true });
const files = {
  clipped: join(dir, 'clipped.wav'),
  clean: join(dir, 'clean.wav'),
  tone: join(dir, 'tone.wav'),
};
writeFileSync(files.clipped, wav(sine(440, 2, 12, 0.9)));
writeFileSync(files.clean, wav(sine(440, 0.5, 12)));
writeFileSync(files.tone, wav(plan(0.45)));

async function session(file, name, fn) {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM ?? undefined,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${file}%noloop`, '--autoplay-policy=no-user-gesture-required'],
  });
  const ctx = await browser.newContext({
    viewport: PHONE,
    ...UK,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    permissions: ['microphone', 'camera'],
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`${name}: pageerror: ${e.message}`));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/favicon|net::ERR|404|Failed to load resource|^[WI]\d{4} |^INFO:/.test(t)) problems.push(`${name}: console: ${t.slice(0, 200)}`);
  });
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  await page.goto(base);
  await page.fill('#pair input', 'preview-owner-key-0123456789');
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
  await page.evaluate(() => window.__ghosty.run('open_lens', { mode: 'sound' }));
  await page.waitForSelector('#pg-lens .lensmodes', { timeout: 10000 });
  const tile = page.locator('#pg-lens .lensmodes button', { hasText: 'SOUND' });
  if (!(await tile.isVisible().catch(() => false))) await tile.scrollIntoViewIfNeeded().catch(() => undefined);
  await tile.click();
  const ok = await page.waitForFunction(() => window.__ghosty?.lens?.mode === 'sound' && window.__ghosty?.sound, null, { timeout: 10000 }).then(() => true).catch(() => false);
  if (!ok) problems.push(`${name}: SOUND did not open`);
  else await fn(page);
  const csp = await page.evaluate(() => window.__csp);
  if (csp.length) problems.push(`${name}: security policy blocked: ${csp.join(' | ')}`);
  if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) problems.push(`${name}: wider than the phone screen`);
  if ((await page.evaluate(() => window.__ghosty.lens.camera)) === 'on') problems.push(`${name}: the camera is on in SOUND`);
  await browser.close();
}

const sound = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__ghosty.sound)));
const waitDone = (page, ms, what) => page.waitForFunction(() => ['done', 'error'].includes(window.__ghosty.sound.phase), null, { timeout: ms }).then(() => true).catch(async () => { problems.push(`${what}: ${JSON.stringify(await sound(page))}`); return false; });
const press = (page, label) => page.locator('#pg-lens .lenspanel button', { hasText: label }).first().click();

// 1. clipped → clipping, and ASK GHOSTY sends the words
await session(files.clipped, 'clipped', async (page) => {
  const asked = [];
  await page.route('**/api/chat', async (route) => {
    asked.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/x-ndjson', body: `${JSON.stringify({ t: 'text', text: 'Your speaker is clipping: turn it down two notches.' })}\n${JSON.stringify({ t: 'done', model: 'Mock · scripted' })}\n` });
  });
  await press(page, 'RECORD');
  if (await waitDone(page, 25000, 'LISTEN on a clipped sine never finished')) {
    const s = await sound(page);
    if (s.kind !== 'clipping' || !/^clipping: turn the volume down a couple of notches/.test(s.verdict)) problems.push(`clipped sine: verdict ${s.kind} "${s.verdict}" (findings: ${s.findings.join(' | ')})`);
    if (!(await page.locator('#pg-lens .soundverdict', { hasText: 'Clipping' }).isVisible())) problems.push('the clipping verdict is not on screen');
    if (!(s.sampleRate >= 8000)) problems.push(`no sample rate: ${s.sampleRate}`);
    const drawn = await page.evaluate(() => { const c = document.querySelector('#pg-lens canvas.soundchart'); if (!c || !c.width) return 0; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; });
    if (drawn < 500) problems.push(`the spectrum chart is blank (${drawn} pixels)`);
    await page.screenshot({ path: `${out}/sound-clipping.png` });
    await press(page, 'ASK GHOSTY');
    await page.waitForFunction(() => /clipping: turn it down/i.test(window.__ghosty.sound.reply), null, { timeout: 15000 }).catch(() => problems.push('no reply shown after ASK GHOSTY'));
    const body = asked.at(-1);
    if (!body || !/^SOUND CHECK \(measured by the phone's microphone/.test(body.seen ?? '') || body.images?.length) problems.push(`ASK GHOSTY sent ${JSON.stringify(body)?.slice(0, 300)}`);
    if (body && /SOUND CHECK/.test(body.message)) problems.push('the report went inside the question instead of as data');
    await page.screenshot({ path: `${out}/sound-ask.png` });
  }
});

// 2. clean → clean; TEST TONE with a microphone that cannot hear it → says so
await session(files.clean, 'clean', async (page) => {
  await press(page, 'RECORD');
  if (await waitDone(page, 25000, 'LISTEN on a clean sine never finished')) {
    const s = await sound(page);
    if (s.kind !== 'clean' || !/^clean/.test(s.verdict)) problems.push(`clean sine: verdict ${s.kind} "${s.verdict}" (findings: ${s.findings.join(' | ')})`);
    await page.screenshot({ path: `${out}/sound-clean.png` });
  }
  await page.locator('#pg-lens .soundsubs button', { hasText: 'TEST TONE' }).click();
  await press(page, 'START TEST');
  if (await waitDone(page, 30000, 'TEST TONE never finished')) {
    const s = await sound(page);
    if (s.kind !== 'unheard' || !/^didn't hear the test tone/.test(s.verdict)) problems.push(`TEST TONE without the tone: ${s.kind} "${s.verdict}"`);
  }
});

// 3. the test tone through a speaker that clips above 60%
await session(files.tone, 'tone', async (page) => {
  await page.locator('#pg-lens .soundsubs button', { hasText: 'TEST TONE' }).click();
  await press(page, 'START TEST');
  if (await waitDone(page, 30000, 'TEST TONE on the clipping speaker never finished')) {
    const s = await sound(page);
    if (s.kind !== 'distorts' || !/^distorts above ~60% volume: turn it down a couple of notches/.test(s.verdict)) problems.push(`clipping speaker: ${s.kind} "${s.verdict}" (findings: ${s.findings.join(' | ')})`);
    else console.log(`TEST TONE verdict: ${s.verdict}`);
    await page.screenshot({ path: `${out}/sound-tone.png` });
  }
});

// 4. leaving SOUND while the audio is still starting gives the microphone back
await session(files.clean, 'leave-early', async (page) => {
  await page.evaluate(() => {
    window.__tracks = [];
    const gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (c) => { const s = await gum(c); window.__tracks.push(...s.getTracks()); return s; };
    const resume = AudioContext.prototype.resume;
    AudioContext.prototype.resume = function () { return new Promise((r) => setTimeout(r, 1500)).then(() => resume.call(this)); };
  });
  await press(page, 'RECORD');
  await page.waitForFunction(() => window.__tracks.length > 0, null, { timeout: 5000 }).catch(() => problems.push('leave-early: the microphone never opened'));
  await page.evaluate(() => window.__ghosty.lens.setMode('see'));
  await page.waitForTimeout(2500);
  const live = await page.evaluate(() => window.__tracks.filter((t) => t.readyState !== 'ended').length);
  if (live) problems.push(`leave-early: ${live} microphone track(s) still running after leaving SOUND during start-up`);
});

console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'SOUND run clean on an iPhone 13: a clipped tone from the microphone was called clipping with the advice to turn it down and its spectrum drawn, ASK GHOSTY sent the report as data, a clean tone was called clean, TEST TONE said plainly when it could not hear the tone and found where a clipping speaker starts to distort; the camera stayed off and the security policy blocked nothing.');
process.exit(problems.length ? 1 : 0);
