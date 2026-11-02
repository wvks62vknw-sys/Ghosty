// Talking to Ghosty (BRIEF-TALK-1A; STARS 1, 2, 9, 10, 16, 83): a conversation that feels like a call with a quick, present
// person, measured on the preview with the scripted brain, a made-up microphone and made-up speech (as tests/voice.spec.mjs):
//  1. FIRST SPOKEN WORD: from his last word (Enter, or the end of his speech) to the first sound, within 1,000 ms; the first
//     piece said is the first sentence or its first twelve words; every later piece is handed to the voice before the one
//     before it ends (no gap); the words on screen stay ahead of the voice; the phone's voice is primed on the mic tap.
//  2. INTERRUPTION: talking over him silences him within 150 ms; "sorry, go on" resumes from the sentence he was cut in,
//     with "…as I was saying,"; a new ask after a cut is answered, and the brain was told only what he heard.
//  3. NARRATION: a slow tool turn says what he is doing in the status line (never a bare "thinking"), and in a spoken turn
//     a short aside per step, never before 1.5 s and never over the reply; a typed turn has the lines but no asides.
//  4. CONVERSATION: one tap, then ten turns with no tap, the ear open again the moment each reply ends with a soft
//     "your turn" tone; "that's all" ends it, signed off, the microphone let go.
//  5. MODEL SUPPLY: every model cooling down is said within two seconds with the time the first is back (a wait that
//     ends in an answer, and the scripted "no model:"), aloud in a spoken turn; the phone's brain is offered when warm.
//  6. SIRI SHORTCUT: ?do=listen opens Ghosty listening within a second of it showing; SHORTCUTS lists it and says iOS
//     listens to nothing in the background.
// The phone's speech here is a stand-in modelled on an iPhone's: one queue; an idle voice takes a moment to start (longer
// when it has not spoken for a while, which the mic tap's priming saves); a queued sentence starts the moment the one
// before it ends. Ghosty's own voice is /api/tts answered with silent WAV as long as the words. What only his iPhone can
// show (the real voices, the real microphone, Siri) is named in the report, not pretended here.
//   BASE=http://localhost:8788 node tests/talk.spec.mjs [outDir]
import { isWebKit, launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, openPanel } from './nav.mjs';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const problems = [];
const measured = {};
const RUN = Date.now().toString(36).slice(-5);
const SMALL = { width: 390, height: 844 };
// ONLY=first,spoken,narrate,convo,cooling,shortcut runs some parts (while working on one); unset, all of them.
const only = (process.env.ONLY ?? '').split(',').filter(Boolean);
const part = (k) => !only.length || only.includes(k);
const words = (s) => s.trim().split(/\s+/).filter(Boolean).length;
const ms = (n) => (n == null || !Number.isFinite(n) ? 'n/a' : `${Math.round(n)} ms`);

/** A WAV of silence as long as `secs` (16 kHz mono): Ghosty's voice saying something that long. */
function wav(secs) {
  const n = Math.max(1600, Math.round(16_000 * secs));
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(16_000, 24); b.writeUInt32LE(32_000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  return b;
}
/** How long Ghosty's voice takes to say `text` here: about 15 characters a second, as a person speaks. */
const clipSecs = (text) => Math.max(0.4, text.length / 15);

/** The made-up microphone, the stand-in speech and the page's own clock of what was heard (run before the page loads). */
const fakeTalk = () => {
  const T = (window.__talk = { key: 0, synth: [], clips: [], tts: [], sfx: [], status: [], primed: [] });
  const mic = (window.__mic = { calls: 0, set: () => undefined, stream: null });
  document.addEventListener('keydown', (e) => e.key === 'Enter' && e.target?.id === 'cin' && (T.key = performance.now()), true);
  for (const ev of ['playing', 'pause', 'ended']) document.addEventListener(ev, (e) => e.target?.id === 'gvoice' && T.clips.push({ ev, at: performance.now(), dur: e.target.duration }), true);
  document.addEventListener('ghosty-sfx', (e) => T.sfx.push({ kind: e.detail, at: performance.now() }));
  const fetch0 = window.fetch;
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input?.url ?? '';
    if (/\/api\/tts$/.test(url)) T.tts.push({ at: performance.now(), text: JSON.parse(init?.body ?? '{}').text ?? '' });
    return fetch0(input, init);
  };
  const devices = window.MediaDevices?.prototype ?? navigator.mediaDevices;
  devices.getUserMedia = async () => {
    mic.calls++;
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
    return dest.stream;
  };
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
  // The phone's speech, as an iPhone's behaves: one queue; an idle voice takes 120 ms to start, 450 ms when it has said
  // nothing for half a minute (the slow first utterance a tap's priming avoids); a queued one starts as the last ends;
  // each lasts 60 ms a word; pause, resume and cancel as Safari's.
  const voices = [
    { name: 'Daniel', lang: 'en-GB' },
    { name: 'Daniel (Enhanced)', lang: 'en-GB' },
    { name: 'Serena (Premium)', lang: 'en-GB' },
    { name: 'Samantha', lang: 'en-US' },
  ].map((v) => ({ ...v, voiceURI: v.name, localService: true, default: false }));
  window.SpeechSynthesisUtterance = class {
    constructor(text) {
      Object.assign(this, { text, voice: null, lang: '', rate: 1, pitch: 1, volume: 1 });
    }
  };
  const synth = window.SpeechSynthesis?.prototype ?? window.speechSynthesis;
  const q = [];
  let cur = null;
  let paused = false;
  let timer = 0;
  let left = 0;
  let since = 0;
  let lastSound = -1e9;
  const caption = () => document.querySelector('#ccap span')?.textContent ?? '';
  const end = () => {
    const c = cur;
    cur = null;
    lastSound = performance.now();
    if (!c) return;
    Object.assign(c.rec, { endAt: performance.now(), captionEnd: caption() });
    c.u.onend?.({});
    run(false);
  };
  const run = (idle) => {
    if (cur || paused || !q.length) return;
    cur = q.shift();
    const begin = () => {
      if (!cur) return;
      Object.assign(cur.rec, { startAt: performance.now(), captionStart: caption() });
      cur.u.onstart?.({});
      left = Math.max(150, 60 * cur.u.text.split(/\s+/).length);
      since = performance.now();
      timer = setTimeout(end, left);
    };
    if (!idle) return begin();
    const cold = performance.now() - lastSound > 30_000;
    setTimeout(begin, cold ? 450 : 120);
  };
  synth.getVoices = () => voices;
  Object.defineProperty(synth, 'speaking', { configurable: true, get: () => !!cur });
  Object.defineProperty(synth, 'pending', { configurable: true, get: () => q.length > 0 });
  synth.speak = (u) => {
    const rec = { text: u.text, volume: u.volume, voice: u.voice?.name ?? null, calledAt: performance.now() };
    if (!u.text.trim() || u.volume === 0) {
      // a silent utterance (the tap's priming): the voice is woken and nothing is heard
      T.primed.push({ at: performance.now(), voice: rec.voice });
      lastSound = performance.now();
      setTimeout(() => u.onend?.({}), 5);
      return;
    }
    T.synth.push(rec);
    q.push({ u, rec });
    run(!cur);
  };
  synth.cancel = () => {
    q.length = 0;
    clearTimeout(timer);
    paused = false;
    if (cur) {
      Object.assign(cur.rec, { endAt: performance.now(), cancelled: true });
      const u = cur.u;
      cur = null;
      lastSound = performance.now();
      u.onend?.({});
    }
  };
  synth.pause = () => {
    if (!cur || paused) return;
    paused = true;
    clearTimeout(timer);
    left -= performance.now() - since;
    cur.rec.pausedAt ??= performance.now();
  };
  synth.resume = () => {
    if (!paused) return;
    paused = false;
    if (!cur) return run(true);
    since = performance.now();
    timer = setTimeout(end, Math.max(0, left));
  };
};

/** A phone-sized Ghosty with the made-up microphone and voices; `heard` is what the brain's ears will write down, in order. */
async function talkPage(name, { tts = true, viewport = PHONE } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, ...UK });
  await ctx.addInitScript(fakeTalk);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${name}] pageerror: ${e.message}`));
  const io = { heard: [], stt: [], statusSeen: 0 };
  await ctx.route('**/api/status', async (route) => {
    const r = await route.fetch();
    const j = await r.json();
    j.speech = { stt: true, tts };
    io.statusSeen++;
    await route.fulfill({ response: r, headers: { ...r.headers(), 'content-type': 'application/json' }, body: JSON.stringify(j) });
  });
  await ctx.route('**/api/tts', async (route) => {
    const text = JSON.parse(route.request().postData() ?? '{}').text ?? '';
    await route.fulfill({ status: 200, headers: { 'content-type': 'audio/wav', 'x-voice': 'draco' }, body: wav(clipSecs(text)) });
  });
  await ctx.route('**/api/stt', async (route) => {
    const text = io.heard.shift() ?? '';
    io.stt.push(text);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text }) });
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pair input', { timeout: 15000 });
  await page.fill('#pair input', 'preview-owner-key-0123456789');
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
  for (let i = 0; i < 50 && !io.statusSeen; i++) await page.waitForTimeout(100);
  await page.waitForTimeout(800);
  return { ctx, page, io };
}

const voiceOf = (page) => page.evaluate(() => window.__ghosty.ui.get().voice);
const waitVoice = (page, want, timeout = 15000) => page.waitForFunction((w) => window.__ghosty.ui.get().voice === w, want, { timeout }).then(() => true, () => false);
const seen = (page, re, timeout = 15000) => page.waitForFunction((src) => new RegExp(src).test(document.body.innerText), re.source, { timeout }).then(() => true, () => false);
/** The frames the ear spends learning the room on its first listen (voice.ts), at this page's real frame rate, with room to spare. */
async function settle(page) {
  const perFrame = await page.evaluate(() => new Promise((res) => {
    const t0 = performance.now();
    let n = 0;
    const f = () => (++n >= 12 || performance.now() - t0 > 1500 ? res((performance.now() - t0) / n) : requestAnimationFrame(f));
    requestAnimationFrame(f);
  }));
  await page.waitForTimeout(Math.min(7000, Math.max(500, Math.ceil(perFrame * 26))));
}
/** He speaks for `ms` and stops: the page's clock when his voice ended. */
async function speakFor(page, ms = 900, level = 0.3) {
  await page.evaluate((v) => window.__mic.set(v), level);
  await page.waitForTimeout(ms);
  return page.evaluate(() => {
    window.__mic.set(0);
    return performance.now();
  });
}
/** Reply clips that played after `from` (the page's clock): each with its start and end (silent unlock clips are left out). */
const replyClips = (page, from) =>
  page.evaluate((t0) => {
    const out = [];
    for (const c of window.__talk.clips) {
      if (c.at < t0 || !(c.dur > 0.3)) continue;
      if (c.ev === 'playing') out.push({ start: c.at, end: null });
      else if (c.ev === 'ended' && out.length && out.at(-1).end === null) out.at(-1).end = c.at;
    }
    return out;
  }, from);
/** What went to Ghosty's voice after `from`. */
const ttsSince = (page, from) => page.evaluate((t0) => window.__talk.tts.filter((x) => x.at >= t0), from);

// ================================================================ 1. FIRST SPOKEN WORD
const ASK = (what) => `talk to me about ${what} ${RUN}`;
if (part('first')) {
  // A. typed, the phone's own voice
  const name = 'first-phone';
  const { ctx, page } = await talkPage(name, { tts: false });
  await page.click('.logbtn');
  await page.fill('#cin', ASK('the moon'));
  await page.keyboard.press('Enter');
  await seen(page, new RegExp(`The moon ${RUN}: I could talk`));
  await page.waitForFunction(() => window.__talk.synth.length >= 4 && window.__talk.synth.every((s) => s.endAt) && !window.__ghosty.ui.get().busy, null, { timeout: 20000 }).catch(() => problems.push(`[${name}] the reply was not said to the end`));
  await page.waitForTimeout(400);
  const t = await page.evaluate(() => window.__talk);
  const said = t.synth.filter((s) => s.calledAt >= t.key);
  const first = said[0];
  const firstMs = first?.startAt - t.key;
  measured.firstPhone = firstMs;
  if (!first) problems.push(`[${name}] nothing was said`);
  else {
    if (!(firstMs <= 1000)) problems.push(`[${name}] the first word came ${ms(firstMs)} after Enter (budget 1,000 ms)`);
    if (words(first.text) > 12) problems.push(`[${name}] the first piece said is ${words(first.text)} words ("${first.text}"): the first sentence or its first twelve words`);
    // every later piece handed to the voice before the one before it ended, and started as it ended
    const gaps = said.slice(1).map((s, i) => ({ handed: s.calledAt < said[i].endAt, gap: s.startAt - said[i].endAt }));
    measured.phoneGaps = gaps.map((g) => Math.round(g.gap));
    if (gaps.some((g) => !g.handed)) problems.push(`[${name}] a sentence was handed to the voice only after the one before it ended (${JSON.stringify(gaps)})`);
    if (gaps.some((g) => g.gap > 40)) problems.push(`[${name}] a gap between sentences: ${measured.phoneGaps.join(', ')} ms`);
    // the words on screen stay ahead of the voice: each piece is on screen by the time it is said
    const behind = said.filter((s) => s.captionEnd !== undefined && !s.captionEnd.replace(/\s+/g, ' ').includes(s.text.replace(/\s+/g, ' ').slice(0, 30)));
    if (behind.length) problems.push(`[${name}] the caption was behind the voice: "${behind[0].text}" said before it was on screen ("${behind[0].captionEnd.slice(0, 80)}")`);
  }
  console.log(`[${name}] first word ${ms(firstMs)} after Enter; pieces: ${said.map((s) => `${words(s.text)}w`).join(' ')}; gaps ${JSON.stringify(measured.phoneGaps)}`);
  await ctx.close();
}
if (part('first')) {
  // B. typed, Ghosty's own voice (the brain's clips): the first clip is the first piece, the next is fetched while one plays
  const name = 'first-ghosty';
  const { ctx, page } = await talkPage(name, { tts: true });
  await page.click('.logbtn');
  await page.fill('#cin', ASK('the river'));
  await page.keyboard.press('Enter');
  const key = await page.evaluate(() => window.__talk.key);
  await seen(page, new RegExp(`The river ${RUN}: I could talk`));
  await page.waitForFunction((t0) => window.__talk.clips.filter((c) => c.at >= t0 && c.ev === 'ended' && c.dur > 0.3).length >= 4, key, { timeout: 30000 }).catch(() => undefined);
  const clips = await replyClips(page, key);
  const asked = await ttsSince(page, key);
  const firstMs = clips[0]?.start - key;
  measured.firstGhosty = firstMs;
  if (!clips.length) problems.push(`[${name}] no clip of the reply played`);
  else if (!(firstMs <= 1000)) problems.push(`[${name}] the first word came ${ms(firstMs)} after Enter (budget 1,000 ms)`);
  if (asked[0] && words(asked[0].text) > 12) problems.push(`[${name}] the first clip asked for is ${words(asked[0].text)} words ("${asked[0].text}")`);
  const late = clips.slice(0, -1).map((c, i) => (asked[i + 1] ? asked[i + 1].at - c.end : null)).filter((d) => d !== null && d > 0);
  if (late.length) problems.push(`[${name}] a clip was asked for only after the one before it had ended`);
  const gaps = clips.slice(1).map((c, i) => c.start - clips[i].end).map(Math.round);
  measured.ghostyGaps = gaps;
  if (gaps.some((g) => g > 120)) problems.push(`[${name}] a gap between clips: ${gaps.join(', ')} ms`);
  console.log(`[${name}] first word ${ms(firstMs)} after Enter; clips ${clips.length}; first clip ${asked[0] ? words(asked[0].text) : '?'} words; gaps ${JSON.stringify(gaps)}`);
  await ctx.close();
}

// ================================================================ 1C, 2. SPOKEN: FIRST WORD, THE CUT, CARRYING ON, A NEW ASK
if (part('spoken')) {
  const name = 'spoken';
  const { ctx, page, io } = await talkPage(name, { tts: true });
  // the mic tap primes the phone's voice (a silent utterance in the voice that will speak)
  const primedBefore = await page.evaluate(() => window.__talk.primed.length);
  await page.click('#mic');
  if (!(await waitVoice(page, 'listening', 8000))) problems.push(`[${name}] the mic did not start listening`);
  const primed = (await page.evaluate(() => window.__talk.primed.length)) - primedBefore;
  if (primed < 1) problems.push(`[${name}] the mic tap did not prime the phone's voice`);
  await settle(page);
  io.heard.push(ASK('the sea'));
  const t0 = await speakFor(page, 900);
  await page.waitForFunction((t) => window.__talk.clips.some((c) => c.at >= t && c.ev === 'playing' && c.dur > 0.3), t0, { timeout: 15000 }).catch(() => undefined);
  const clips = await replyClips(page, t0);
  const spokenMs = clips[0]?.start - t0;
  measured.firstSpoken = spokenMs;
  if (!clips.length) problems.push(`[${name}] the spoken ask was not answered aloud`);
  else if (!(spokenMs <= 1000)) problems.push(`[${name}] the first word came ${ms(spokenMs)} after his voice ended (budget 1,000 ms)`);
  console.log(`[${name}] first word ${ms(spokenMs)} after the end of his speech`);

  // 2a. he talks over the third piece: silent within 150 ms, the reply marked cut off
  await page.waitForFunction((t) => window.__talk.clips.filter((c) => c.at >= t && c.ev === 'playing' && c.dur > 0.3).length >= 3, t0, { timeout: 20000 }).catch(() => problems.push(`[${name}] the third piece never played`));
  await page.waitForTimeout(500);
  const cutPiece = (await ttsSince(page, t0))[2]?.text ?? '';
  io.heard.push('sorry, go on');
  const silence = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const el = document.querySelector('audio#gvoice');
        const t = performance.now();
        const done = () => resolve(performance.now() - t);
        if (el.paused) return resolve(0);
        el.addEventListener('pause', done, { once: true });
        window.__mic.set(0.3);
        setTimeout(() => resolve(-1), 3000);
      }),
  );
  measured.cutToSilence = silence;
  if (silence < 0) problems.push(`[${name}] talking over him did not silence him`);
  else if (silence > (isWebKit ? 250 : 150)) problems.push(`[${name}] talking over him took ${ms(silence)} to silence him (budget 150 ms)`);
  console.log(`[${name}] talking over him: silent ${ms(silence)} after his voice began`);
  const cutAt = await page.evaluate(() => performance.now());
  await page.waitForTimeout(700);
  await speakFor(page, 400);
  // 2b. "sorry, go on": he carries on from the cut piece with the bridge, never from the top and never asked of the brain
  await page.waitForFunction((t) => window.__talk.tts.some((x) => x.at > t + 600), cutAt, { timeout: 15000 }).catch(() => undefined);
  const after = (await ttsSince(page, cutAt + 600)).map((x) => x.text);
  const resumed = after.join(' ');
  measured.resume = { cutPiece, resumed: resumed.slice(0, 120) };
  const startsRight = /^…?\s*as I was saying,/i.test(after[0] ?? '');
  const fromCut = cutPiece && resumed.toLowerCase().includes(cutPiece.toLowerCase().replace(/^\w/, (c) => c).slice(1, 30));
  measured.resumeCorrect = !!(startsRight && fromCut && !/I could talk about it for hours/.test(resumed));
  if (!startsRight) problems.push(`[${name}] "sorry, go on" did not carry on with the bridge: "${(after[0] ?? '(nothing said)').slice(0, 80)}"`);
  if (!fromCut) problems.push(`[${name}] he did not carry on from the piece he was cut in ("${cutPiece}"): "${resumed.slice(0, 120)}"`);
  if (/I could talk about it for hours/.test(resumed)) problems.push(`[${name}] he started again from the top`);
  if (await page.evaluate(() => document.body.innerText.includes('Mock reply to: sorry, go on'))) problems.push(`[${name}] "sorry, go on" was sent to the brain as a new ask`);
  await page.click('.logbtn');
  await page.waitForTimeout(400);
  if ((await page.locator('#pg-core .log .msg .cutchip').count()) < 1) problems.push(`[${name}] the cut reply is not marked cut off`);
  if (!(await page.evaluate(() => [...document.querySelectorAll('#pg-core .log .msg:not(.me)')].some((m) => /as I was saying,/i.test(m.textContent ?? ''))))) problems.push(`[${name}] the carrying on is not in the chat`);
  await page.screenshot({ path: `${out}/talk-carry-on.png` });
  await page.click('.logbtn');
  console.log(`[${name}] cut in "${cutPiece}"; carried on: "${resumed.slice(0, 90)}…"`);

  // 2c. a new ask after a cut: the cut reply stays as it is, the ask is answered, and the brain knows what he heard
  await waitVoice(page, 'listening', 20000);
  await settle(page);
  io.heard.push(ASK('the hills'));
  const t1 = await speakFor(page, 700);
  await page.waitForFunction((t) => window.__talk.clips.filter((c) => c.at >= t && c.ev === 'playing' && c.dur > 0.3).length >= 2, t1, { timeout: 20000 }).catch(() => problems.push(`[${name}] the second piece about the hills never played`));
  await page.waitForTimeout(300);
  const heardPiece = (await ttsSince(page, t1))[0]?.text ?? '';
  const box = await page.locator('#pg-core .rwrap').boundingBox();
  const tapAt = await page.evaluate(() => performance.now());
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const tapSilence = await page.waitForFunction((t) => {
    const p = window.__talk.clips.filter((c) => c.ev === 'pause' && c.at >= t)[0];
    return p ? p.at - t : 0;
  }, tapAt, { timeout: 2000 }).then((h) => h.jsonValue(), () => -1);
  measured.tapToSilence = tapSilence;
  if (tapSilence < 0 || tapSilence > 150) problems.push(`[${name}] a tap took ${ms(tapSilence)} to silence him`);
  await waitVoice(page, 'listening', 8000);
  await settle(page);
  io.heard.push('what did I hear?');
  await speakFor(page, 600);
  if (!(await seen(page, /You heard only: "/, 15000))) problems.push(`[${name}] the brain was not told what he heard of the cut reply (${await page.evaluate(() => [...document.querySelectorAll('#pg-core .log .msg:not(.me)')].at(-1)?.textContent ?? '')})`);
  else {
    const said = await page.evaluate(() => [...document.querySelectorAll('#pg-core .log .msg:not(.me)')].map((m) => m.textContent ?? '').findLast((t) => t.includes('You heard only')) ?? '');
    if (!said.includes(heardPiece.slice(0, 25))) problems.push(`[${name}] the brain was told he heard "${said.slice(0, 120)}", not "${heardPiece}"`);
    if (/older than it looks/.test(said)) problems.push(`[${name}] the brain was told he heard more than he did`);
  }
  if (await page.evaluate(() => document.body.innerText.includes('Mock reply to: what did I hear'))) problems.push(`[${name}] the new ask was taken for something else`);
  await page.click('#mic').catch(() => undefined);
  await ctx.close();
}

// ================================================================ 3. NARRATION
const slow = createServer((req, res) => {
  setTimeout(() => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<html><head><title>Slow page ${req.url}</title></head><body><p>A page that takes its time: ${req.url}.</p></body></html>`);
  }, req.url.includes('/a') ? 3500 : 4500);
});
await new Promise((r) => slow.listen(0, '127.0.0.1', r));
const slowAsk = (k) => `read http://127.0.0.1:${slow.address().port}/a${k} and http://127.0.0.1:${slow.address().port}/b${k} together`;
const GENERIC = /^(?:thinking|thinking about the results|processing|working|working on it)(?:…|\.\.\.)?$|^$/i;
if (part('narrate')) {
  const name = 'narrate';
  const { ctx, page, io } = await talkPage(name, { tts: true });
  await page.evaluate(() => window.__ghosty.ui.subscribe((s, p) => s.status !== p.status && window.__talk.status.push({ at: performance.now(), text: s.status, busy: s.busy })));
  // A. a spoken turn: the status line and an aside per step
  await page.click('#mic');
  await waitVoice(page, 'listening', 8000);
  await settle(page);
  io.heard.push(slowAsk(`1${RUN}`));
  const t0 = await speakFor(page, 700);
  await page.waitForFunction((t) => window.__talk.clips.some((c) => c.at >= t && c.ev === 'playing' && c.dur > 0.3) && window.__talk.tts.some((x) => x.at >= t && /^Done|together|I read|A page/.test(x.text)), t0, { timeout: 30000 }).catch(() => undefined);
  await page.waitForFunction(() => !window.__ghosty.ui.get().busy, null, { timeout: 30000 }).catch(() => undefined);
  const t = await page.evaluate(() => window.__talk);
  const asked = await page.evaluate(() => [...document.querySelectorAll('#pg-core .log .msg.me')].at(-1)?.textContent ?? '');
  const sentAt = t.status.find((s) => s.at >= t0 && s.busy)?.at ?? t0;
  const replyAt = t.tts.find((x) => x.at >= t0 && !/…$/.test(x.text))?.at ?? Infinity;
  const lines = t.status.filter((s) => s.at >= sentAt + 1500 && s.at < replyAt && s.busy);
  const asides = t.tts.filter((x) => x.at >= t0 && x.at < replyAt);
  measured.narration = { lines: [...new Set(t.status.filter((x) => x.at >= sentAt && x.at < replyAt && x.busy).map((l) => l.text))], asides: asides.map((a) => a.text), firstAsideMs: asides[0] ? Math.round(asides[0].at - sentAt) : null };
  if (!lines.length && !t.status.some((s) => s.at >= sentAt && s.busy && !GENERIC.test(s.text))) problems.push(`[${name}] the status line said nothing specific while the slow turn worked (${JSON.stringify(t.status.slice(-6))})`);
  const bare = lines.filter((l) => GENERIC.test(l.text));
  if (bare.length) problems.push(`[${name}] a bare "${bare[0].text || '(empty)'}" in the status line ${ms(bare[0].at - sentAt)} into the turn`);
  if (!measured.narration.lines.some((l) => /read|page|look/i.test(l))) problems.push(`[${name}] the status line never said what he was doing: ${JSON.stringify(measured.narration.lines)}`);
  if (!asides.length) problems.push(`[${name}] no spoken aside in a spoken turn that worked for seconds`);
  if (asides.some((a) => a.at < sentAt + 1400)) problems.push(`[${name}] an aside before 1.5 s of work`);
  if (asides.some((a) => words(a.text) > 7)) problems.push(`[${name}] an aside is long: ${JSON.stringify(asides.map((a) => a.text))}`);
  if (new Set(asides.map((a) => a.text)).size !== asides.length) problems.push(`[${name}] an aside said twice: ${JSON.stringify(asides.map((a) => a.text))}`);
  const over = t.tts.filter((x) => x.at > replyAt && /…$/.test(x.text));
  if (over.length) problems.push(`[${name}] an aside after the reply began: "${over[0].text}"`);
  console.log(`[${name}] "${asked.slice(0, 40)}…": status ${JSON.stringify(measured.narration.lines)}; asides ${JSON.stringify(measured.narration.asides)}`);
  await page.click('#mic').catch(() => undefined);
  await waitVoice(page, 'idle', 5000);
  // B. a typed turn: the lines, and nothing said over him while he reads
  await page.click('.logbtn');
  const before = await page.evaluate(() => window.__talk.tts.length);
  const k0 = await page.evaluate(() => performance.now());
  await page.fill('#cin', slowAsk(`2${RUN}`));
  await page.keyboard.press('Enter');
  await page.waitForFunction((t) => !window.__ghosty.ui.get().busy && window.__talk.status.some((s) => s.at > t), k0, { timeout: 30000 }).catch(() => undefined);
  await page.waitForTimeout(500);
  const typed = await page.evaluate(({ k, n }) => ({ asides: window.__talk.tts.slice(n).filter((x) => /…$/.test(x.text)).map((x) => x.text), lines: window.__talk.status.filter((s) => s.at > k + 1500 && s.busy).map((s) => s.text) }), { k: k0, n: before });
  if (typed.asides.length) problems.push(`[${name}] asides spoken in a typed turn: ${JSON.stringify(typed.asides)}`);
  if (!typed.lines.some((l) => !GENERIC.test(l))) problems.push(`[${name}] a typed slow turn had no specific status line: ${JSON.stringify(typed.lines)}`);
  await page.screenshot({ path: `${out}/talk-narrate.png` });
  await ctx.close();
}
slow.close();

// ================================================================ 4. CONVERSATION: ten turns, no taps
if (part('convo')) {
  const name = 'convo';
  const { ctx, page, io } = await talkPage(name, { tts: true });
  let taps = 0;
  await page.click('#mic');
  taps++;
  await waitVoice(page, 'listening', 8000);
  await settle(page);
  const reopen = [];
  let answered = 0;
  for (let i = 1; i <= 10; i++) {
    const said = `turn ${i} of ten ${RUN}`;
    io.heard.push(said);
    const sfxBefore = await page.evaluate(() => window.__talk.sfx.filter((s) => s.kind === 'turn').length);
    // turn 5 is said the moment the ear opens: it must already be able to hear him
    if (i !== 5 && i !== 1) await page.waitForTimeout(150);
    await speakFor(page, 700);
    const ok = await seen(page, new RegExp(`Mock reply to: ${said}`), 15000);
    if (!ok) {
      problems.push(`[${name}] turn ${i} was not answered (heard ${JSON.stringify(io.stt.slice(-2))})`);
      break;
    }
    answered++;
    const endAt = await page.waitForFunction(() => {
      const c = window.__talk.clips.filter((x) => x.dur > 0.3);
      return c.at(-1)?.ev === 'ended' ? c.at(-1).at : 0;
    }, null, { timeout: 15000 }).then((h) => h.jsonValue(), () => 0);
    if (!(await waitVoice(page, 'listening', 8000))) {
      problems.push(`[${name}] after turn ${i} the ear did not open again`);
      break;
    }
    const at = await page.evaluate(() => performance.now());
    reopen.push(Math.round(at - endAt));
    if ((await page.evaluate(() => window.__talk.sfx.filter((s) => s.kind === 'turn').length)) <= sfxBefore) problems.push(`[${name}] no "your turn" tone after turn ${i}`);
  }
  measured.convo = { taps, answered, reopen };
  if (answered < 10) problems.push(`[${name}] ${answered} of ten turns answered with no tap`);
  if ((await page.evaluate(() => window.__mic.calls)) !== 1) problems.push(`[${name}] the microphone was asked for ${await page.evaluate(() => window.__mic.calls)} times in one conversation`);
  if (reopen.some((r) => r > 400)) problems.push(`[${name}] the ear opened again late after a reply: ${reopen.join(', ')} ms`);
  console.log(`[${name}] ten turns: ${answered} answered with ${taps} tap (the one that started it); ear open again ${reopen.join(', ')} ms after each reply`);
  // "that's all": signed off, the microphone let go, both in the chat
  io.heard.push("that's all");
  const byeAt = await speakFor(page, 500);
  await page.waitForFunction((t) => !document.querySelector('#mic').classList.contains('on') && window.__ghosty.ui.get().voice !== 'listening' && window.__talk.tts.some((x) => x.at > t), byeAt, { timeout: 15000 }).catch(() => problems.push(`[${name}] "that's all" did not end the conversation`));
  await page.waitForTimeout(2500);
  const end = await page.evaluate(() => ({ on: document.querySelector('#mic').classList.contains('on'), live: window.__mic.stream?.getTracks().some((t) => t.readyState === 'live'), voice: window.__ghosty.ui.get().voice }));
  if (end.on || end.live || end.voice === 'listening') problems.push(`[${name}] after "that's all" the microphone is still held: ${JSON.stringify(end)}`);
  if (await page.evaluate(() => document.body.innerText.includes("Mock reply to: that's all"))) problems.push(`[${name}] "that's all" went to the brain`);
  await page.click('.logbtn');
  await page.waitForTimeout(400);
  const lastTwo = await page.evaluate(() => [...document.querySelectorAll('#pg-core .log .msg')].slice(-2).map((m) => m.textContent ?? ''));
  if (!/that's all/i.test(lastTwo[0] ?? '') || !lastTwo[1]) problems.push(`[${name}] the sign-off is not in the chat: ${JSON.stringify(lastTwo)}`);
  await page.screenshot({ path: `${out}/talk-convo.png` });
  await ctx.close();
}

// ================================================================ 5. MODEL SUPPLY: cooling down, said at once
for (const viewport of part('cooling') ? [PHONE, SMALL] : []) {
  const name = `cooling-${viewport.width}`;
  const { ctx, page, io } = await talkPage(name, { tts: true, viewport });
  await page.click('#mic');
  await waitVoice(page, 'listening', 8000);
  await settle(page);
  // A. a wait that ends in an answer: said within two seconds, with the time, then answered
  io.heard.push(`cooling for 6 s: hello ${RUN}`);
  const t0 = await speakFor(page, 700);
  const line = await page.waitForFunction(() => {
    const m = /back at (\d\d:\d\d)/.exec(document.querySelector('#ccap')?.textContent ?? '') ?? /back at (\d\d:\d\d)/.exec([...document.querySelectorAll('#pg-core .log .msg:not(.me)')].at(-1)?.textContent ?? '');
    return m ? { at: performance.now(), time: m[1] } : null;
  }, null, { timeout: 6000, polling: 50 }).then((h) => h.jsonValue(), () => null);
  const sentAt = io.stt.length ? t0 : t0;
  const shownMs = line ? line.at - sentAt : null;
  const spoke = await page.waitForFunction((t) => window.__talk.tts.find((x) => x.at > t && /back at/i.test(x.text)), t0, { timeout: 6000 }).then((h) => h.jsonValue(), () => null);
  const spokenMs = spoke ? spoke.at - t0 : null;
  if (viewport === PHONE) measured.coolingWait = { shownMs, spokenMs, line: spoke?.text ?? null };
  if (!line) problems.push(`[${name}] every model cooling down was not said in the chat with the time it is back`);
  if (!spoke) problems.push(`[${name}] every model cooling down was not said aloud in a spoken turn`);
  // (from the end of his speech: the 700 ms the ear waits for him to finish, the writing down and the brain's first wait)
  else if (spokenMs > 2000) problems.push(`[${name}] "cooling down" was said ${ms(spokenMs)} after he spoke (budget 2,000 ms)`);
  if (!(await seen(page, new RegExp(`Mock reply to: cooling for 6 s: hello ${RUN}`), 15000))) problems.push(`[${name}] the answer did not come once the model was back`);
  await page.screenshot({ path: `${out}/talk-cooling-${viewport.width}.png` });
  // B. none free (the scripted "no model:"): said aloud within two seconds, with the time
  await waitVoice(page, 'listening', 15000);
  await settle(page);
  io.heard.push(`no model: tell me a joke ${RUN}`);
  const t1 = await speakFor(page, 700);
  const none = await page.waitForFunction((t) => window.__talk.tts.find((x) => x.at > t && /back at \d\d:\d\d/i.test(x.text)), t1, { timeout: 6000 }).then((h) => h.jsonValue(), () => null);
  const noneMs = none ? none.at - t1 : null;
  if (viewport === PHONE) measured.coolingNone = { spokenMs: noneMs, line: none?.text ?? null };
  if (!none) problems.push(`[${name}] "no model is free" was not said aloud with the time the first is back`);
  else if (noneMs > 2000) problems.push(`[${name}] "no model is free" was said ${ms(noneMs)} after he spoke (budget 2,000 ms)`);
  if (none && words(none.text) > 28) problems.push(`[${name}] the cooling line is not one short sentence: "${none.text}"`);
  console.log(`[${name}] cooling (a wait): shown ${ms(shownMs)}, said ${ms(spokenMs)} ("${spoke?.text ?? ''}"); none free: said ${ms(noneMs)} ("${none?.text ?? ''}")`);
  await page.click('#mic').catch(() => undefined);
  await ctx.close();
}

// ================================================================ 6. SIRI SHORTCUT: ?do=listen
if (part('shortcut')) {
  const name = 'shortcut';
  const { ctx, page } = await talkPage(name, { tts: true });
  await page.goto(`${base}/?do=listen`, { waitUntil: 'domcontentloaded' });
  const shownAt = await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 }).then(() => page.evaluate(() => performance.now()), () => null);
  const listening = await page.waitForFunction(() => window.__ghosty?.ui?.get().voice === 'listening', null, { timeout: 8000, polling: 20 }).then(() => page.evaluate(() => performance.now()), () => null);
  const took = shownAt !== null && listening !== null ? listening - shownAt : null;
  measured.shortcut = took;
  if (listening === null) problems.push(`[${name}] ?do=listen did not start listening (${await page.evaluate(() => document.querySelector('#toasts')?.textContent ?? '')})`);
  else if (took > 1000) problems.push(`[${name}] ?do=listen was listening ${ms(took)} after Ghosty showed (budget 1,000 ms)`);
  if ((await page.evaluate(() => location.search)) !== '') problems.push(`[${name}] the address was not cleaned after the link`);
  await page.click('#mic').catch(() => undefined);
  console.log(`[${name}] ?do=listen: listening ${ms(took)} after Ghosty showed`);
  // SHORTCUTS: "Ghosty listen" is offered, and the truth about the background is said
  await page.evaluate(() => (location.hash = 'settings'));
  await openPanel(page, 'settings', 'SHORTCUTS');
  const panelText = await page.evaluate(() => [...document.querySelectorAll('.panel')].find((p) => /SHORTCUTS/.test(p.querySelector('.ph, h2, header')?.textContent ?? p.textContent ?? ''))?.textContent ?? document.body.innerText);
  if (!/Ghosty listen/.test(panelText) || !/\?do=listen/.test(panelText)) problems.push(`[${name}] SHORTCUTS does not offer "Ghosty listen"`);
  if (!/background/i.test(panelText)) problems.push(`[${name}] SHORTCUTS does not say that iPhone lets nothing listen in the background`);
  await page.screenshot({ path: `${out}/talk-shortcuts.png` });
  await ctx.close();
}

await browser.close();
console.log(`MEASURED ${JSON.stringify(measured)}`);
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'Talk run clean: the first word within a second (typed and spoken), sentences queued with no gap, a cut silent within 150 ms and carried on from its sentence, the brain told what he heard, narration per step, ten turns with no tap, cooling down said within two seconds with its time, and Siri’s listen link.');
process.exit(problems.length ? 1 : 0);
