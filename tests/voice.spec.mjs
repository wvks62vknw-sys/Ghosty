// Ghosty's own voice and pictures in the chat. The brain here has no Workers AI, so its status
// is patched to say it can speak and /api/tts answers with a short real WAV: a reply must then
// play through the shared audio element (its src becomes a blob address), the SETTINGS select
// switches to the phone's voice (no more /api/tts calls) and back, and a reply carrying one of
// Ghosty's /i/<id> picture links shows the picture itself as a card. Then, on a phone-sized page
// with a made-up microphone and made-up phone voices: SETTINGS → VOICE (automatic by default,
// the brain's voices, the phone's natural British voices first, SAMPLE, the fallbacks), and
// barge-in — Ghosty's own echo never stops it, the owner talking over it does within ~300 ms,
// the reply is marked cut off, what they said is heard and answered, a tap cuts in too.
//   node tests/voice.spec.mjs [outDir]
import { isWebKit, launch, webkitNoise } from './browser.mjs';
import { DESKTOP, PHONE, UK, openPanel } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const problems = [];

/**
 * Tap the mic and speak only once Ghosty can hear. The recogniser (voice.ts listenWhisper) spends its first 20 animation
 * frames learning the room's noise floor, and a voice that arrives during those frames is learned AS the room: it is then
 * never heard, nothing is sent, and the test reads silence (CI run 253 on main: "with no connection the owner was told").
 * On a slow runner a frame can take half a second, so the wait is measured against this page's real frame rate rather
 * than a fixed pause, and kept under the 12 s a quiet listen allows before it gives up.
 */
async function tapAndSpeak(page, name, { level = 0.3, ms = 1000 } = {}) {
  const before = await page.evaluate(() => window.__mic.calls);
  await page.click('#mic');
  if (!(await page.waitForFunction((n) => window.__mic.calls > n, before, { timeout: 6000 }).then(() => true, () => false))) problems.push(`[${name}] the microphone was not opened after the tap (getUserMedia calls stayed at ${before})`);
  if (!(await page.waitForFunction(() => window.__ghosty.ui.get().voice === 'listening', null, { timeout: 8000 }).then(() => true, () => false))) problems.push(`[${name}] the mic did not start listening (${await page.evaluate(() => document.querySelector('#toasts')?.textContent ?? 'no toast')})`);
  // the calibration: 20 animation frames at whatever rate this page draws them, with room to spare
  const perFrame = await page.evaluate(() => new Promise((res) => {
    const t0 = performance.now();
    let n = 0;
    const f = () => (++n >= 12 || performance.now() - t0 > 1500 ? res((performance.now() - t0) / n) : requestAnimationFrame(f));
    requestAnimationFrame(f);
  }));
  await page.waitForTimeout(Math.min(7000, Math.max(500, Math.ceil(perFrame * 26))));
  await page.evaluate((v) => window.__mic.set(v), level);
  await page.waitForTimeout(ms);
  await page.evaluate(() => window.__mic.set(0));
}

/** A tenth of a second of silence as 16 kHz mono 16-bit WAV. */
function wav(samples = 1600, rate = 16_000) {
  const b = Buffer.alloc(44 + samples * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + samples * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(samples * 2, 40);
  return b;
}
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8DwnwEIGIEEADWvA/+VJyY+AAAAAElFTkSuQmCC', 'base64');

for (const [name, viewport] of [['desktop', DESKTOP], ['phone', PHONE]]) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, ...UK });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${name}] pageerror: ${e.message}`));
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
  // the default: the best British voice available — the brain's own natural voice when it can speak
  const caps = await page.evaluate(() => window.__ghosty.settings.get().voiceEngine);
  if (caps !== 'auto') problems.push(`[${name}] the default voice engine is ${caps}, not auto`);
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
  await openPanel(page, 'settings', 'VOICE');
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
  await openPanel(page, 'settings', 'VOICE');
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

  // 4. (on the phone) a long reply read out by itself stops after about half a minute and says the rest is on screen,
  // with prices and times said whole; LISTEN under it reads it and, tapped while Ghosty speaks, stops it; VOICE OFF
  // silences what is being said
  if (name === 'phone') {
    const long = `Here's Saturday:\n\n1. Leave by 8.30am.\n2. Fuel is £1.42 a litre.\n\n${'The forecast is dry with a light breeze from the west and highs of 14.5°C, so a jacket is enough. '.repeat(12)}`;
    const longLines = `${JSON.stringify({ t: 'text', text: long })}\n${JSON.stringify({ t: 'done', model: 'Mock · scripted' })}\n`;
    await ctx.route('**/api/chat', (route) => route.fulfill({ status: 200, headers: { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' }, body: longLines }));
    const from = said.length;
    await ask('plan saturday', 'The forecast is dry');
    await page.waitForFunction(() => window.__ghosty.ui.get().voice === 'speaking', null, { timeout: 8000 }).catch(() => undefined);
    await page.waitForFunction(() => window.__ghosty.ui.get().voice !== 'speaking', null, { timeout: 30000 }).catch(() => undefined);
    const spoken = said.slice(from);
    const chars = spoken.join(' ').length;
    if (chars > 560 || spoken.at(-1) !== 'The rest is on screen.') problems.push(`[${name}] a ${long.length}-character reply was read out as ${spoken.length} clips, ${chars} characters, ending "${spoken.at(-1)}"`);
    const split = spoken.filter((x) => /^\d+\.$|£1\.$|8\.$/.test(x));
    if (split.length) problems.push(`[${name}] a number or a list marker was said on its own: ${JSON.stringify(split)}`);
    const listen = page.locator('#pg-core .log .msg button[aria-label="Read the reply aloud"]').last();
    await listen.click();
    const reading = await page.waitForFunction(() => window.__ghosty.ui.get().voice === 'speaking', null, { timeout: 8000 }).then(() => true, () => false);
    if (!reading) problems.push(`[${name}] LISTEN did not read the reply`);
    const stopLabel = await page.locator('#pg-core .log .msg button.msgact.on').last().getAttribute('aria-label').catch(() => null);
    if (stopLabel !== 'Stop reading aloud') problems.push(`[${name}] while it reads, LISTEN is labelled ${JSON.stringify(stopLabel)}`);
    await page.locator('#pg-core .log .msg button.msgact.on').last().click().catch(() => listen.click());
    const stopped = await page.waitForFunction(() => window.__ghosty.ui.get().voice !== 'speaking', null, { timeout: 1500 }).then(() => true, () => false);
    if (!stopped) problems.push(`[${name}] LISTEN tapped while Ghosty reads did not stop it`);
    await page.waitForTimeout(800);
    if (await page.evaluate(() => !document.querySelector('audio#gvoice')?.paused)) problems.push(`[${name}] the voice still plays after LISTEN stopped it`);
    // VOICE OFF while it speaks: silent at once
    await listen.click();
    await page.waitForFunction(() => window.__ghosty.ui.get().voice === 'speaking', null, { timeout: 8000 }).catch(() => undefined);
    await page.evaluate(() => window.__ghosty.settings.set({ speak: false }));
    const off = await page.waitForFunction(() => window.__ghosty.ui.get().voice !== 'speaking', null, { timeout: 1500 }).then(() => true, () => false);
    if (!off) problems.push(`[${name}] VOICE OFF did not stop the voice that was speaking`);
    await page.evaluate(() => window.__ghosty.settings.set({ speak: true }));
  }
  await ctx.close();
}

// ---- Barge-in and the voice picker, on the owner's phone size, with a made-up microphone and made-up phone voices ----
// The microphone: an oscillator through a gain the test turns up and down (a stand-in for the owner's voice; WebKit has
// no fake microphone of its own, and this works in both engines). The phone's voices: a few, as an iPhone lists them,
// with speech that "plays" for a moment and records what it was asked to say and in which voice.
/** The made-up microphone and phone voices (run in the page before it loads). */
const fakePhone = () => {
    // Two sounds reach the made-up microphone: the owner (`set`, turned up and down by the test) and Ghosty's own voice
    // leaking back (`echo`: a level heard only while the voice element is playing, with a louder syllable every 0.7 s),
    // as a phone's echo cancellation leaves a little of it.
    const mic = (window.__mic = { calls: 0, constraints: null, echo: 0, set: () => undefined });
    let playing = false;
    for (const ev of ['playing', 'pause', 'ended', 'emptied']) document.addEventListener(ev, (e) => e.target?.id === 'gvoice' && (playing = ev === 'playing'), true);
    // On the prototype: WebKit ignores a method set on navigator.mediaDevices itself.
    const devices = window.MediaDevices?.prototype ?? navigator.mediaDevices;
    devices.getUserMedia = async (c) => {
      mic.calls++;
      mic.constraints = c;
      const ac = new AudioContext();
      await ac.resume().catch(() => undefined);
      const osc = ac.createOscillator();
      osc.frequency.value = 220;
      const gain = ac.createGain();
      gain.gain.value = 0;
      const dest = ac.createMediaStreamDestination();
      osc.connect(gain).connect(dest);
      osc.start();
      mic.set = (v) => gain.gain.setValueAtTime(v, ac.currentTime);
      mic.stream = dest.stream;
      const echoOsc = ac.createOscillator();
      echoOsc.frequency.value = 330;
      const echoGain = ac.createGain();
      echoGain.gain.value = 0;
      echoOsc.connect(echoGain).connect(dest);
      echoOsc.start();
      setInterval(() => echoGain.gain.setValueAtTime(playing ? mic.echo * (performance.now() % 700 < 60 ? 1.8 : 1) : 0, ac.currentTime), 20);
      return dest.stream;
    };
    // Playwright's WebKit on Linux has no MediaRecorder (Safari on the iPhone does): a stand-in that hands over a
    // second of real silent WAV when stopped, so the rest of the path (decode, trim, send) runs as it would.
    if (typeof MediaRecorder === 'undefined') {
      window.MediaRecorder = class {
        static isTypeSupported() {
          return false;
        }
        constructor() {
          this.state = 'inactive';
          this.mimeType = 'audio/wav';
        }
        start() {
          this.state = 'recording';
        }
        stop() {
          if (this.state === 'inactive') return;
          this.state = 'inactive';
          const n = 16000;
          const b = new DataView(new ArrayBuffer(44 + n * 2));
          const w = (o, t) => [...t].forEach((c, i) => b.setUint8(o + i, c.charCodeAt(0)));
          w(0, 'RIFF'); b.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true);
          b.setUint32(24, 16000, true); b.setUint32(28, 32000, true); b.setUint16(32, 2, true); b.setUint16(34, 16, true); w(36, 'data'); b.setUint32(40, n * 2, true);
          setTimeout(() => {
            this.ondataavailable?.({ data: new Blob([b.buffer], { type: 'audio/wav' }) });
            this.onstop?.();
          }, 10);
        }
      };
    }
    const voices = [
      { name: 'Fred', lang: 'en-US' },
      { name: 'Daniel', lang: 'en-GB' },
      { name: 'Daniel (Enhanced)', lang: 'en-GB' },
      { name: 'Serena (Premium)', lang: 'en-GB' },
      { name: 'Samantha', lang: 'en-US' },
      { name: 'Amélie', lang: 'fr-CA' },
    ].map((v) => ({ ...v, voiceURI: v.name, localService: true, default: false }));
    window.__said = [];
    window.SpeechSynthesisUtterance = class {
      constructor(text) {
        Object.assign(this, { text, voice: null, lang: '', rate: 1, pitch: 1, volume: 1 });
      }
    };
    // On the prototype: WebKit ignores methods set on the speechSynthesis object itself.
    const synth = window.SpeechSynthesis?.prototype ?? window.speechSynthesis;
    synth.getVoices = () => voices;
    synth.speak = (u) => {
      if (u.text.trim()) window.__said.push({ text: u.text, voice: u.voice?.name ?? null, rate: u.rate, pitch: u.pitch, volume: u.volume });
      setTimeout(() => {
        u.onstart?.();
        setTimeout(() => u.onend?.(), 150);
      }, 10);
    };
    synth.cancel = () => undefined;
    synth.resume = () => undefined;
};
{
  const name = 'barge';
  const ctx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 1, ...UK });
  await ctx.addInitScript(fakePhone);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${name}] pageerror: ${e.message}`));
  const ttsBodies = [];
  let ttsAnswer = { voice: null, note: null, status: 200, seconds: 0.1 };
  let stt = 0;
  const heard = ['tell me about the weather', 'what about tomorrow', 'thanks'];
  await ctx.route('**/api/status', async (route) => {
    const r = await route.fetch();
    const j = await r.json();
    j.speech = { stt: true, tts: true };
    await route.fulfill({ response: r, headers: { ...r.headers(), 'content-type': 'application/json' }, body: JSON.stringify(j) });
  });
  await ctx.route('**/api/tts', async (route) => {
    ttsBodies.push(JSON.parse(route.request().postData() ?? '{}'));
    if (ttsAnswer.status !== 200) return route.fulfill({ status: ttsAnswer.status, contentType: 'application/json', body: JSON.stringify({ error: "no voice: Ghosty's own voice needs Workers AI" }) });
    // The brain says which voice spoke: the one asked for ('auto' is Draco) unless this test says otherwise.
    const asked = ttsBodies.at(-1).voice;
    const spoke = ttsAnswer.voice ?? (asked === 'auto' || !asked ? 'draco' : asked);
    await route.fulfill({ status: 200, headers: { 'content-type': 'audio/wav', 'x-voice': spoke, ...(ttsAnswer.note ? { 'x-voice-note': ttsAnswer.note } : {}), ...(ttsAnswer.reason ? { 'x-voice-reason': ttsAnswer.reason } : {}) }, body: wav(Math.round(16_000 * ttsAnswer.seconds)) });
  });
  await ctx.route('**/api/stt', async (route) => {
    const size = route.request().postDataBuffer()?.length ?? 0;
    const type = route.request().headers()['content-type'];
    stt++;
    // (WebKit does not show a test the bytes of a Blob body: the size is checked in Chromium.)
    if ((size < 1000 && !isWebKit) || !/^audio\//.test(type)) problems.push(`[${name}] recording ${stt} sent as ${type}, ${size} bytes`);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: heard[stt - 1] ?? '' }) });
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pair input', { timeout: 15000 });
  await page.fill('#pair input', 'preview-owner-key-0123456789');
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
  await page.waitForTimeout(800);
  const voiceState = () => page.evaluate(() => window.__ghosty.ui.get().voice);
  const waitVoice = (want, ms = 15000) => page.waitForFunction((w) => window.__ghosty.ui.get().voice === w, want, { timeout: ms }).then(() => true, () => false);
  const say = async (level, ms) => {
    await page.evaluate((v) => window.__mic.set(v), level);
    if (ms) await page.waitForTimeout(ms);
  };

  // 1. SETTINGS → VOICE: automatic by default, naming the natural British voice this phone has; the brain's voices; SAMPLE
  await page.evaluate(() => (location.hash = 'settings'));
  await openPanel(page, 'settings', 'VOICE');
  const engineSel = page.locator('select[aria-label="Voice engine"]');
  await engineSel.waitFor({ timeout: 10000 });
  if ((await engineSel.inputValue()) !== 'auto') problems.push(`[${name}] the voice picker does not start on automatic`);
  const vnow = (await page.locator('.note.vnow').textContent()) ?? '';
  if (!/Draco/.test(vnow) || !/Serena \(Premium\) on this phone/.test(vnow)) problems.push(`[${name}] the automatic voice is explained as "${vnow}"`);
  await engineSel.selectOption('ghosty');
  const brainOpts = await page.locator('select[aria-label="Voice"] option').allTextContents();
  for (const v of ['Draco', 'Pandora', 'Helios', 'Athena', 'Melo']) if (!brainOpts.some((o) => o.startsWith(v))) problems.push(`[${name}] the brain's voices are missing ${v}: ${brainOpts.join(' | ')}`);
  // plain words: the picker never names the models behind the voices
  const pickerWords = `${brainOpts.join(' ')} ${await page.locator('.note.vnow').textContent()}`;
  if (/Aura|MeloTTS|Deepgram|neuron/i.test(pickerWords)) problems.push(`[${name}] the voice picker speaks in model names: ${pickerWords}`);
  await page.selectOption('select[aria-label="Voice"]', 'pandora');
  // SAMPLE is STOP while a sample is still being said: a click then would only stop it, so wait for the last one to end.
  const sampleNow = async () => {
    await page.waitForFunction(() => document.querySelector('button[aria-label="Hear a sample of this voice"]')?.textContent === 'SAMPLE', null, { timeout: 10000 }).catch(() => undefined);
    await page.click('button[aria-label="Hear a sample of this voice"]');
  };
  await sampleNow();
  await page.waitForFunction(() => /Just spoke: Pandora/.test(document.querySelector('.note.vlast')?.textContent ?? ''), null, { timeout: 10000 }).catch(() => problems.push(`[${name}] SAMPLE did not say which voice spoke`));
  const sampled = ttsBodies.filter((b) => /how I'll sound|Say the word|This is how/.test(b.text ?? ''));
  if (!sampled.length || sampled.some((b) => b.voice !== 'pandora')) problems.push(`[${name}] SAMPLE asked the brain for ${JSON.stringify(ttsBodies)}`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/phone-voice-picker.png` });
  // this phone's voices: natural British ones first, marked; novelty and non-English ones not first or not at all
  await engineSel.selectOption('phone');
  const phoneOpts = await page.locator('select[aria-label="Voice"] option').allTextContents();
  if (!/Serena \(Premium\)/.test(phoneOpts[0] ?? '') || !/Serena \(Premium\).*natural/.test(phoneOpts[1] ?? '') || !/Daniel \(Enhanced\)/.test(phoneOpts[2] ?? '')) problems.push(`[${name}] the phone's voices are listed as ${phoneOpts.join(' | ')}`);
  if (phoneOpts.some((o) => /Amélie/.test(o))) problems.push(`[${name}] a French voice is offered`);
  if (/Fred/.test(phoneOpts[1] ?? '')) problems.push(`[${name}] a novelty voice is ranked first`);
  await sampleNow();
  await page.waitForFunction(() => window.__said.some((s) => /how I'll sound/.test(s.text)), null, { timeout: 8000 }).catch(() => undefined);
  const sample = await page.evaluate(() => window.__said.find((s) => /how I'll sound/.test(s.text)));
  if (sample?.voice !== 'Serena (Premium)') problems.push(`[${name}] the phone sample spoke in ${JSON.stringify(sample)}`);
  // back to automatic: a passing Aura error is not "used up": the plain clip the brain sent plays, the phone stays quiet
  await engineSel.selectOption('auto');
  ttsAnswer = { voice: 'melo', note: 'the natural voice did not answer (3040: capacity temporarily exceeded): the plain voice spoke instead', reason: 'error', status: 200, seconds: 0.1 };
  // (only the sample line counts: anything else the phone may still be finishing is not this sample)
  const quiet = await page.evaluate(() => window.__said.filter((x) => /how I'll sound/.test(x.text)).length);
  const asked = ttsBodies.length;
  await sampleNow();
  await page.waitForFunction(() => /Just spoke: Melo/.test(document.querySelector('.note.vlast')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => problems.push(`[${name}] after an Aura error the plain clip was not played`));
  const lastLine = (await page.locator('.note.vlast').textContent()) ?? '';
  if (/3040|capacity/.test(lastLine)) problems.push(`[${name}] the brain's error code reached the owner: "${lastLine}"`);
  if ((await page.evaluate(() => window.__said.filter((x) => /how I'll sound/.test(x.text)).length)) !== quiet) problems.push(`[${name}] one Aura error sent the voice to the phone`);
  if (ttsBodies.length === asked) problems.push(`[${name}] after an Aura error the brain was not asked`);
  // when the natural voice's share is used up for today, the phone's natural voice takes over
  ttsAnswer = { voice: 'melo', note: "today's share for the natural voice is used up", reason: 'share', status: 200, seconds: 0.1 };
  const before = await page.evaluate(() => window.__said.length);
  await sampleNow();
  await page.waitForFunction((n) => window.__said.length > n, before, { timeout: 8000 }).catch(() => problems.push(`[${name}] with the natural voice used up, the phone did not take over`));
  const fallback = await page.evaluate(() => window.__said.at(-1));
  if (fallback && fallback.voice !== 'Serena (Premium)') problems.push(`[${name}] the fallback spoke in ${fallback.voice}`);
  // his voice follows his mood (OWNER-ISSUES 63): the phone's voice lower, slower and colder when he is cross, lower, slower
  // and quieter when subdued, a touch brighter when pleased; calm again, exactly his own
  {
    await engineSel.selectOption('phone');
    const say = async () => {
      const n = await page.evaluate(() => window.__said.length);
      await sampleNow();
      await page.waitForFunction((k) => window.__said.length > k, n, { timeout: 8000 }).catch(() => undefined);
      return page.evaluate(() => window.__said.at(-1));
    };
    // (set on this phone, newer than anything the brain's status can bring meanwhile: state/mood.ts setMood)
    const feel = (kind) => page.evaluate((k) => window.__ghosty.mood.set({ now: k === 'calm' ? { kind: 'calm', since: Date.now(), cause: '', until: 0 } : { kind: k, since: Date.now(), cause: 'a test', until: Date.now() + 600_000 } }), kind);
    const near = (a, b) => Math.abs(a - b) < 1e-6;
    await feel('calm');
    const calm = await say();
    const tones = {};
    for (const k of ['cross', 'subdued', 'pleased', 'protective']) {
      await feel(k);
      tones[k] = await say();
    }
    await feel('calm');
    const back = await say();
    const want = { cross: [0.9, 0.8, 1], subdued: [0.92, 0.9, 0.8], pleased: [1.02, 1.05, 1], protective: [0.95, 1, 1] };
    for (const [k, [rate, pitch, volume]] of Object.entries(want)) {
      const u = tones[k];
      if (!u || !calm || !near(u.rate, rate) || !near(u.pitch / calm.pitch, pitch) || !near(u.volume, volume)) problems.push(`[${name}] ${k}: the phone's voice spoke at ${JSON.stringify(u)} (calm ${JSON.stringify(calm)})`);
    }
    if (!back || back.rate !== calm.rate || back.pitch !== calm.pitch || back.volume !== calm.volume) problems.push(`[${name}] calm again, the voice is not his own: ${JSON.stringify(back)} vs ${JSON.stringify(calm)}`);
  }
  // no voice on the brain at all: the phone speaks (graceful)
  ttsAnswer = { voice: null, note: null, status: 404, seconds: 0.1 };
  await engineSel.selectOption('ghosty');
  const before2 = await page.evaluate(() => window.__said.length);
  await sampleNow();
  await page.waitForFunction((n) => window.__said.length > n, before2, { timeout: 8000 }).catch(() => problems.push(`[${name}] a brain without a voice left the sample silent`));
  // back to automatic, Ghosty's natural voice, a reply long enough to talk over
  ttsAnswer = { voice: null, note: null, status: 200, seconds: 4 };
  await engineSel.selectOption('auto');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(400);

  // 2. A voice conversation: the mic asks once (echo cancellation on), the owner speaks, Ghosty answers aloud
  await page.evaluate(() => (window.__mic.echo = 0.05));
  await tapAndSpeak(page, name);
  if (!(await waitVoice('speaking', 20000))) problems.push(`[${name}] Ghosty did not speak the reply (stt calls ${stt}, voice ${await voiceState()})`);
  const cons = await page.evaluate(() => window.__mic.constraints);
  if (!cons?.audio?.echoCancellation) problems.push(`[${name}] the microphone was opened without echo cancellation: ${JSON.stringify(cons)}`);
  // Ghosty's own voice leaking back into the mic (steady, with louder syllables) must not stop it
  await page.waitForFunction(() => !document.querySelector('audio#gvoice')?.paused, null, { timeout: 8000 }).catch(() => undefined);
  await page.waitForTimeout(1200);
  if ((await voiceState()) !== 'speaking') problems.push(`[${name}] Ghosty stopped for its own echo (voice ${await voiceState()})`);
  // 3. the owner talks over it: speech stops within about 300 ms, the reply is marked cut off, and what they say is heard
  const took = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const t0 = performance.now();
        const off = window.__ghosty.ui.subscribe((s) => {
          if (s.voice !== 'speaking') {
            off?.();
            resolve(performance.now() - t0);
          }
        });
        window.__mic.set(0.3);
        setTimeout(() => resolve(-1), 3000);
      }),
  );
  if (took < 0) problems.push(`[${name}] talking over Ghosty did not stop it`);
  // Headless WebKit here runs the page's 20 ms timer every 50–70 ms, so it gets a little more room than Chromium.
  else if (took > (isWebKit ? 500 : 400)) problems.push(`[${name}] talking over Ghosty took ${Math.round(took)} ms to stop it (want about 300)`);
  else console.log(`[${name}] barge-in stopped Ghosty in ${Math.round(took)} ms`);
  const paused = await page.evaluate(() => document.querySelector('audio#gvoice')?.paused);
  if (!paused) problems.push(`[${name}] the audio still plays after the barge-in`);
  await page.waitForTimeout(500);
  await say(0, 0);
  await page.waitForFunction(() => document.body.innerText.includes('Mock reply to: what about tomorrow'), null, { timeout: 20000 }).catch(() => problems.push(`[${name}] what the owner said over Ghosty was not heard and answered (stt calls ${stt})`));
  await page.click('.logbtn');
  await page.waitForFunction(() => document.querySelectorAll('#pg-core .log .msg .cutchip').length >= 1, null, { timeout: 3000 }).catch(() => undefined);
  const cut = await page.locator('#pg-core .log .msg .cutchip').count();
  if (cut < 1) problems.push(`[${name}] the interrupted reply is not marked as cut off`);
  await page.screenshot({ path: `${out}/phone-barge-cut.png` });
  await page.click('.logbtn');
  // 4. a tap on the reactor cuts in too
  if (!(await waitVoice('speaking', 15000))) problems.push(`[${name}] the second reply was not spoken`);
  await page.waitForTimeout(300);
  const t0 = Date.now();
  // (the reactor lets taps through to the scene behind it: the tap lands on the page, as a finger's would)
  const box = await page.locator('#pg-core .rwrap').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction(() => window.__ghosty.ui.get().voice !== 'speaking', null, { timeout: 3000 }).catch(() => problems.push(`[${name}] a tap did not stop Ghosty`));
  if (Date.now() - t0 > 1500) problems.push(`[${name}] a tap took ${Date.now() - t0} ms to stop Ghosty`);
  await page.waitForFunction(() => document.querySelectorAll('#pg-core .log .msg .cutchip').length >= 2, null, { timeout: 3000 }).catch(() => undefined);
  const cut2 = await page.locator('#pg-core .log .msg .cutchip').count();
  if (cut2 < 2) problems.push(`[${name}] the tapped reply is not marked as cut off (${cut2} marked)`);
  if ((await page.evaluate(() => window.__mic.calls)) !== 1) problems.push(`[${name}] the microphone was asked for ${await page.evaluate(() => window.__mic.calls)} times in one conversation`);
  // the conversation goes on listening; the mic button ends it
  await waitVoice('listening', 5000);
  await page.click('#mic');
  await page.waitForTimeout(500);
  if ((await voiceState()) === 'listening') problems.push(`[${name}] the mic button did not end the conversation`);
  // 5. speech that is not a reply (an approval's question read out): an interruption marks no reply — not even the
  // reply before it, which was heard to the end
  ttsAnswer = { voice: null, note: null, status: 200, seconds: 0.1 };
  await page.click('.logbtn');
  await page.fill('#cin', 'a short one please');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.body.innerText.includes('Mock reply to: a short one please'), null, { timeout: 10000 }).catch(() => undefined);
  await page.click('.logbtn');
  await waitVoice('idle', 10000);
  await page.waitForTimeout(500);
  ttsAnswer = { voice: null, note: null, status: 200, seconds: 4 };
  const approval = `${JSON.stringify({ t: 'approval', id: 'ap1', name: 'forget_everything', reason: 'Shall I forget everything I know about you? Say yes or no when you are ready.', args: {} })}\n${JSON.stringify({ t: 'done', model: 'Mock · scripted' })}\n`;
  await ctx.route('**/api/chat', (route) => route.fulfill({ status: 200, headers: { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' }, body: approval }));
  await page.click('.logbtn');
  await page.fill('#cin', 'forget everything');
  await page.keyboard.press('Enter');
  await page.click('.logbtn');
  if (!(await waitVoice('speaking', 10000))) problems.push(`[${name}] the approval was not read out`);
  await page.waitForTimeout(300);
  const cutsBefore = await page.locator('#pg-core .log .msg .cutchip').count();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction(() => window.__ghosty.ui.get().voice !== 'speaking', null, { timeout: 3000 }).catch(() => problems.push(`[${name}] a tap did not stop the approval being read`));
  await page.waitForTimeout(300);
  if ((await page.locator('#pg-core .log .msg .cutchip').count()) !== cutsBefore) problems.push(`[${name}] interrupting the approval's question marked a reply as cut off`);
  await ctx.unroute('**/api/chat');
  // 6. the app hidden (another app, the lock screen): the microphone is let go and the conversation ends
  await page.click('#mic');
  if (!(await waitVoice('listening', 8000))) problems.push(`[${name}] the mic did not start listening again`);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(500);
  const hidden = await page.evaluate(() => ({ voice: window.__ghosty.ui.get().voice, on: document.querySelector('#mic').classList.contains('on'), live: window.__mic.stream?.getTracks().some((t) => t.readyState === 'live') }));
  if (hidden.voice === 'listening' || hidden.on || hidden.live) problems.push(`[${name}] hidden, the microphone is still held: ${JSON.stringify(hidden)}`);
  await ctx.close();
}
// ---- The microphone's other moments, on the phone: what the screen says while the words are worked out, a quiet room,
// no connection, and a phone recogniser that fails ----
async function micPage(name, { stt }) {
  const ctx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 1, ...UK });
  await ctx.addInitScript(fakePhone);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${name}] pageerror: ${e.message}`));
  await ctx.route('**/api/status', async (route) => {
    const r = await route.fetch();
    const j = await r.json();
    j.speech = { stt, tts: true };
    page.statusSeen = (page.statusSeen ?? 0) + 1;
    await route.fulfill({ response: r, headers: { ...r.headers(), 'content-type': 'application/json' }, body: JSON.stringify(j) });
  });
  await ctx.route('**/api/tts', (route) => route.fulfill({ status: 200, headers: { 'content-type': 'audio/wav' }, body: wav() }));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pair input', { timeout: 15000 });
  await page.fill('#pair input', 'preview-owner-key-0123456789');
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
  // the brain's status (which says it can hear) has come back
  for (let i = 0; i < 50 && !page.statusSeen; i++) await page.waitForTimeout(100);
  await page.waitForTimeout(800);
  return { ctx, page };
}
const toastSays = (page, re, ms = 6000) => page.waitForFunction((src) => new RegExp(src).test(document.querySelector('#toasts')?.textContent ?? ''), re.source, { timeout: ms }).then(() => true, () => false);
{
  const name = 'mic';
  const { ctx, page } = await micPage(name, { stt: true });
  let stt = 0;
  let during = null;
  let sttMode = 'slow';
  await ctx.route('**/api/stt', async (route) => {
    stt++;
    if (sttMode === 'offline') return route.abort('internetdisconnected');
    // the brain takes a moment to write the words down: what does the screen say meanwhile?
    await new Promise((r) => setTimeout(r, 900));
    during = await page.evaluate(() => document.querySelector('#cstate')?.textContent ?? '');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'what time is it' }) });
  });
  // 1. while the words are worked out the screen does not still say LISTENING
  await tapAndSpeak(page, name);
  await page.waitForFunction(() => document.body.innerText.includes('Mock reply to: what time is it'), null, { timeout: 20000 }).catch(() => problems.push(`[${name}] what was said was not answered (stt calls ${stt})`));
  if (during === null || /LISTENING/.test(during) || !/WRITING DOWN WHAT YOU SAID/i.test(during)) problems.push(`[${name}] while the words were worked out the screen said "${during}"`);
  // 2. a quiet room: after the reply the conversation listens; nothing is said for ~25 s: no recording of the room goes to
  // the brain, and the conversation ends by itself with the microphone off, saying so
  await page.waitForFunction(() => window.__ghosty.ui.get().voice === 'listening', null, { timeout: 15000 }).catch(() => undefined);
  const heardBefore = stt;
  const ended = await toastSays(page, /stopped listening/i, 30000);
  if (!ended) problems.push(`[${name}] ~30 s of quiet and the conversation is still listening`);
  if (stt !== heardBefore) problems.push(`[${name}] ${stt - heardBefore} recordings of a quiet room were sent to be written down`);
  const after = await page.evaluate(() => ({ on: document.querySelector('#mic').classList.contains('on'), live: window.__mic.stream?.getTracks().some((t) => t.readyState === 'live'), state: document.querySelector('#cstate')?.textContent }));
  if (after.on || after.live || after.state === 'READY') problems.push(`[${name}] after the quiet the microphone is still held: ${JSON.stringify(after)}`);
  await page.screenshot({ path: `${out}/phone-mic-quiet.png` });
  // 3. no connection when the recording is sent: plain words, not "Failed to fetch"
  sttMode = 'offline';
  await tapAndSpeak(page, name);
  if (!(await toastSays(page, /No connection, so I can't hear you/, 15000))) problems.push(`[${name}] with no connection the owner was told "${await page.evaluate(() => document.querySelector('#toasts')?.textContent ?? '')}"`);
  await page.screenshot({ path: `${out}/phone-mic-offline.png` });
  await ctx.close();
}
{
  // 4. the brain cannot hear and the phone's own recogniser fails (no connection): said once, in plain words, not tried
  // again and again with the microphone on
  const name = 'mic-phone';
  const ctx2 = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 1, ...UK });
  await ctx2.addInitScript(fakePhone);
  await ctx2.addInitScript(() => {
    window.__rec = 0;
    window.SpeechRecognition = window.webkitSpeechRecognition = class {
      start() {
        window.__rec++;
        setTimeout(() => {
          this.onerror?.({ error: 'network' });
          this.onend?.();
        }, 50);
      }
      abort() {}
    };
  });
  const page2 = await ctx2.newPage();
  page2.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${name}] pageerror: ${e.message}`));
  await ctx2.route('**/api/status', async (route) => {
    const r = await route.fetch();
    const j = await r.json();
    j.speech = { stt: false, tts: false };
    await route.fulfill({ response: r, headers: { ...r.headers(), 'content-type': 'application/json' }, body: JSON.stringify(j) });
  });
  await page2.goto(base, { waitUntil: 'domcontentloaded' });
  await page2.waitForSelector('#pair input', { timeout: 15000 });
  await page2.fill('#pair input', 'preview-owner-key-0123456789');
  await page2.click('#pair button.on');
  await page2.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
  await page2.waitForTimeout(800);
  await page2.click('#mic');
  const told = await toastSays(page2, /No connection, so I can't hear you/, 4000);
  await page2.waitForTimeout(1500);
  const r = await page2.evaluate(() => ({ starts: window.__rec, on: document.querySelector('#mic').classList.contains('on') }));
  if (!told || r.starts > 1 || r.on) problems.push(`[${name}] the phone's recogniser failing: told ${told}, started ${r.starts} times, mic ${r.on ? 'still on' : 'off'}`);
  await ctx2.close();
}
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : "Voice run clean: Ghosty's voice, the engine switch, the picture card, the voice picker and barge-in.");
process.exit(problems.length ? 1 : 0);
