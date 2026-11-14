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
//  7. NOTICES IN TURN (OWNER-ISSUES 123): a notice from the inbox is read out only in a quiet moment — after the greeting,
//     whole, one after another, oldest first — never over anything; a reply he asks for cuts it and it is not read again;
//     one that arrives while a turn is at work waits for the reply.
// The phone's speech here is a stand-in modelled on an iPhone's: one queue; an idle voice takes a moment to start (longer
// when it has not spoken for a while, which the mic tap's priming saves); a queued sentence starts the moment the one
// before it ends; cancel drops what was queued with an error event, as a browser does. Ghosty's own voice is /api/tts
// answered with silent WAV as long as the words. Each measured page starts with the brain's inbox read: a notice another
// spec left on this brain would otherwise be read out over what is measured (that is what part 7 checks on its own). What only his iPhone can
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
// ONLY=first,spoken,narrate,convo,cooling,shortcut,notice runs some parts (while working on one); unset, all of them.
const only = (process.env.ONLY ?? '').split(',').filter(Boolean);
const part = (k) => !only.length || only.includes(k);
const words = (s) => s.trim().split(/\s+/).filter(Boolean).length;
const ms = (n) => (n == null || !Number.isFinite(n) ? 'n/a' : `${Math.round(n)} ms`);
const KEY = 'preview-owner-key-0123456789';
/** The brain's own API, as the owner's phone calls it. */
const api = (path, init = {}) => fetch(`${base}/api${path}`, { ...init, headers: { 'x-ghosty': '1', 'x-ghosty-key': KEY, 'content-type': 'application/json', ...(init.headers ?? {}) } }).then((r) => r.json());

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
  // each lasts 60 ms a word (quick, for the checks; a page may ask for a person's pace, window.__talkWordMs); pause,
  // resume and cancel as Safari's.
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
      left = Math.max(150, (window.__talkWordMs ?? 60) * cur.u.text.split(/\s+/).length);
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
    // (as a browser does: what was queued and never began is dropped with an error event, 'canceled'; for the record it ended)
    for (const { u, rec } of q.splice(0)) {
      Object.assign(rec, { endAt: performance.now(), cancelled: true, dropped: true });
      setTimeout(() => u.onerror?.({ error: 'canceled' }), 0);
    }
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

/**
 * A phone-sized Ghosty with the made-up microphone and voices; `heard` is what the brain's ears will write down, in order.
 * `keepInbox`: the brain's inbox is left as it is (part 7 wants its notices); otherwise it is read first — a used brain (the
 * specs before this one on its shard) may have left an unread notice, and a fresh page reads one from the last ten minutes
 * out loud (notices.ts), over what is measured. `boot`: the cinematic plays (its greeting is spoken); checks are otherwise
 * spared it (boot.ts). `before`: routes to lay before the page loads. `wordMs`: the phone's voice at this pace (a person's is
 * about 400 ms a word; the checks' quick default is 60).
 */
async function talkPage(name, { tts = true, viewport = PHONE, keepInbox = false, boot = false, before = null, wordMs = 0 } = {}) {
  if (!keepInbox) await api('/inbox/read', { method: 'POST', body: '{}' }).catch(() => undefined);
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, ...UK });
  if (wordMs) await ctx.addInitScript((ms) => { window.__talkWordMs = ms; }, wordMs);
  await ctx.addInitScript(fakeTalk);
  if (boot) await ctx.addInitScript(() => { window.__ghostyBoot = true; window.__ghostyBootKind = 'still'; });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${name}] pageerror: ${e.message}`));
  if (before) await before(page);
  const io = { heard: [], stt: [], statusSeen: 0 };
  // (a check that ends closes its page while the page's own status poll may be on its way: that one is let go, never thrown out of
  // the run as "socket hang up" or "Response has been disposed"; one that fails while the page is open is a problem)
  let closing = false;
  const close = ctx.close.bind(ctx);
  ctx.close = (...a) => ((closing = true), close(...a));
  await ctx.route('**/api/status', async (route) => {
    try {
      const r = await route.fetch();
      const j = await r.json();
      j.speech = { stt: true, tts };
      io.statusSeen++;
      await route.fulfill({ response: r, headers: { ...r.headers(), 'content-type': 'application/json' }, body: JSON.stringify(j) });
    } catch (e) {
      if (!closing) problems.push(`[${name}] the page's status read failed on its way: ${(e?.message ?? '').split('\n')[0]}`);
    }
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
  await page.fill('#pair input', KEY);
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
/** Every clip asked for after `from` has played to its end and the ear is open again: a reply said through, not just begun (a
 *  carrying on is four sentences, about fifteen seconds of voice at 15 characters a second). */
const saidThrough = (page, from, timeout = 45000) =>
  page.waitForFunction((t) => {
    const asked = window.__talk.tts.filter((x) => x.at > t).length;
    const clips = window.__talk.clips.filter((c) => c.at > t && c.dur > 0.3);
    return asked > 0 && clips.filter((c) => c.ev === 'ended').length >= asked && window.__ghosty.ui.get().voice === 'listening';
  }, from, { timeout }).then(() => true, () => false);

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
  // (the page's very first turn carries one-off costs — the first request, the first clip — so it gets a little room here; the
  // 1,000 ms budget is held turn after turn on the ten turns of the conversation below, by their median)
  if (!clips.length) problems.push(`[${name}] the spoken ask was not answered aloud`);
  else if (!(spokenMs <= 1200)) problems.push(`[${name}] the first word came ${ms(spokenMs)} after his voice ended, on the page's first turn (1,200 ms at most; the budget is 1,000 ms)`);
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
  // 2b'. cut again at once, in the carrying on's own first sentence (a tap), then "go on" once more: one bridge, never two
  const rw = await page.locator('#pg-core .rwrap').boundingBox();
  const cutAgain = await waitVoice(page, 'speaking', 5000);
  if (cutAgain) await page.mouse.click(rw.x + rw.width / 2, rw.y + rw.height / 2);
  else problems.push(`[${name}] the carrying on was not being said, to cut it again`);
  await page.click('.logbtn');
  await page.waitForTimeout(400);
  if ((await page.locator('#pg-core .log .msg .cutchip').count()) < 1) problems.push(`[${name}] the cut reply is not marked cut off`);
  if (!(await page.evaluate(() => [...document.querySelectorAll('#pg-core .log .msg:not(.me)')].some((m) => /as I was saying,/i.test(m.textContent ?? ''))))) problems.push(`[${name}] the carrying on is not in the chat`);
  await page.screenshot({ path: `${out}/talk-carry-on.png` });
  await page.click('.logbtn');
  console.log(`[${name}] cut in "${cutPiece}"; carried on: "${resumed.slice(0, 90)}…"`);
  if (cutAgain) {
    // (listening again after the tap: waited for as long as the later steps wait, and settled, as the new ask below is; on a slow runner 8 s was not enough
    // and "go on" was said into a mind that was not listening yet)
    await waitVoice(page, 'listening', 20000);
    await settle(page);
    const again = await page.evaluate(() => performance.now());
    io.heard.push('go on');
    await speakFor(page, 400);
    await page.waitForFunction((t) => window.__talk.tts.some((x) => x.at > t + 300), again, { timeout: 15000 }).catch(() => undefined);
    const twice = (await ttsSince(page, again + 300)).map((x) => x.text).join(' ');
    if (!/^…?\s*as I was saying,/i.test(twice)) problems.push(`[${name}] a second "go on" did not carry on: "${twice.slice(0, 80) || '(nothing said)'}"`);
    if (/as I was saying,.*as I was saying/i.test(twice)) problems.push(`[${name}] carried on with the bridge twice: "${twice.slice(0, 100)}"`);
    // (said through before the next ask: the ear is open again while that carrying on is still being fetched, so "listening" alone
    // let the ask below start over it on a slow runner, and its tap cut the carrying on instead of the reply about the hills)
    if (!(await saidThrough(page, again + 300))) problems.push(`[${name}] the second carrying on was not said through: ${JSON.stringify(await page.evaluate((t) => window.__talk.clips.filter((c) => c.at > t).map((c) => c.ev), again))}`);
  }

  // 2c. a new ask after a cut: the cut reply stays as it is, the ask is answered, and the brain knows what he heard
  await waitVoice(page, 'listening', 20000);
  await settle(page);
  io.heard.push(ASK('the hills'));
  const t1 = await speakFor(page, 700);
  await page.waitForFunction((t) => window.__talk.clips.filter((c) => c.at >= t && c.ev === 'playing' && c.dur > 0.3).length >= 2, t1, { timeout: 20000 }).catch(() => problems.push(`[${name}] the second piece about the hills never played`));
  // The tap lands in a piece while it plays, with time left in it: never in the gap between two, nor in a piece's last moment (the
  // second piece, "It is older than it looks.", lasts under two seconds: a slow runner's fixed 300 ms and the click after it ran
  // into the third, and the check below then took what he really heard for more than he did).
  const box = await page.locator('#pg-core .rwrap').boundingBox();
  await page.waitForFunction((t) => {
    const el = document.getElementById('gvoice');
    const cs = window.__talk.clips.filter((c) => c.at >= t && c.dur > 0.3);
    return cs.filter((c) => c.ev === 'playing').length >= 2 && cs.at(-1)?.ev === 'playing' && !!el && !el.paused && el.currentTime > 0.3 && el.duration - el.currentTime > 0.8;
  }, t1, { timeout: 20000 }).catch(() => problems.push(`[${name}] no piece about the hills was playing to tap`));
  const tapAt = await page.evaluate(() => performance.now());
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const tapSilence = await page.waitForFunction((t) => {
    const p = window.__talk.clips.filter((c) => c.ev === 'pause' && c.at >= t)[0];
    return p ? Math.max(0.1, p.at - t) : 0;
  }, tapAt, { timeout: 2000 }).then((h) => h.jsonValue(), () => -1);
  measured.tapToSilence = tapSilence;
  if (tapSilence < 0 || tapSilence > 150) problems.push(`[${name}] a tap took ${ms(tapSilence)} to silence him`);
  // what he heard: every piece that began before the tap silenced him, but the one it silenced (the pieces in the order they were asked for)
  // (a clip that ends by itself fires 'pause' too, before 'ended': the silence is the first pause after the tap)
  const { pieces, begun } = await page.evaluate(([t, tap]) => {
    const stop = window.__talk.clips.find((c) => c.ev === 'pause' && c.at >= tap)?.at ?? performance.now();
    return { pieces: window.__talk.tts.filter((x) => x.at >= t).map((x) => x.text), begun: window.__talk.clips.filter((c) => c.at >= t && c.at <= stop && c.dur > 0.3 && c.ev === 'playing').length };
  }, [t1, tapAt]);
  const heardPieces = pieces.slice(0, Math.max(1, begun - 1));
  const cutPieceHills = pieces[Math.max(1, begun - 1)] ?? '';
  await waitVoice(page, 'listening', 8000);
  await settle(page);
  io.heard.push('what did I hear?');
  await speakFor(page, 600);
  if (!(await seen(page, /You heard only: "/, 15000))) problems.push(`[${name}] the brain was not told what he heard of the cut reply (${await page.evaluate(() => [...document.querySelectorAll('#pg-core .log .msg:not(.me)')].at(-1)?.textContent ?? '')})`);
  else {
    const said = await page.evaluate(() => [...document.querySelectorAll('#pg-core .log .msg:not(.me)')].map((m) => m.textContent ?? '').findLast((t) => t.includes('You heard only')) ?? '');
    const missing = heardPieces.filter((p) => !said.includes(p.slice(0, 25)));
    if (missing.length) problems.push(`[${name}] the brain was told he heard "${said.slice(0, 160)}", not "${heardPieces.join(' ')}"`);
    if (cutPieceHills && said.includes(cutPieceHills.slice(0, 20))) problems.push(`[${name}] the brain was told he heard more than he did: "${cutPieceHills}" was cut, and told as heard`);
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
  }, req.url.includes('slow') ? 8000 : req.url.includes('/a') ? 3500 : 4500);
});
await new Promise((r) => slow.listen(0, '127.0.0.1', r));
const slowAsk = (k) => `read http://slow.loopback.test:${slow.address().port}/a${k} and http://slow.loopback.test:${slow.address().port}/b${k} together`;
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
  // A2. he talks over an aside while the brain is still at work: it goes quiet at once, no reply is marked cut, and what he
  // says is heard and answered there and then (not when the turn's ear would open, 8 s in)
  await waitVoice(page, 'listening', 15000);
  io.heard.push(slowAsk(`slow${RUN}`), `a quick one ${RUN}`);
  const t2 = await speakFor(page, 700);
  const playing = await page.waitForFunction((t) => {
    const a = window.__talk.tts.find((x) => x.at > t && /…$/.test(x.text));
    const el = document.querySelector('audio#gvoice');
    return a && el && !el.paused && window.__ghosty.ui.get().voice === 'speaking' ? performance.now() : 0;
  }, t2, { timeout: 10000, polling: 20 }).then((h) => h.jsonValue(), () => 0);
  if (!playing) problems.push(`[${name}] no aside was said in the second slow turn`);
  else {
    await page.waitForTimeout(850); // (the ear over his voice first learns the echo: barge.ts)
    const cutsBefore = await page.evaluate(() => document.querySelectorAll('#pg-core .log .msg .cutchip').length);
    const quiet = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const el = document.querySelector('audio#gvoice');
          const t = performance.now();
          if (el.paused) return resolve(0);
          el.addEventListener('pause', () => resolve(performance.now() - t), { once: true });
          window.__mic.set(0.3);
          setTimeout(() => resolve(-1), 2000);
        }),
    );
    measured.narration.asideQuiet = Math.round(quiet);
    if (quiet < 0) problems.push(`[${name}] talking over an aside did not silence it`);
    await page.waitForTimeout(600);
    const stoppedAt = Date.now();
    await page.evaluate(() => window.__mic.set(0));
    if (!(await seen(page, new RegExp(`Mock reply to: a quick one ${RUN}`), 15000))) problems.push(`[${name}] what he said over an aside was not heard and answered`);
    // there and then: within a few seconds of his last word, not when the slow turn's own ear would have opened (8 s in)
    else {
      measured.narration.overAsideAnsweredMs = Date.now() - stoppedAt;
      if (Date.now() - stoppedAt > 3000) problems.push(`[${name}] what he said over the aside was answered ${Date.now() - stoppedAt} ms after he stopped (want it there and then)`);
    }
    if ((await page.evaluate(() => document.querySelectorAll('#pg-core .log .msg .cutchip').length)) !== cutsBefore) problems.push(`[${name}] talking over an aside marked a reply cut off`);
  }
  await page.waitForFunction(() => !window.__ghosty.ui.get().busy, null, { timeout: 30000 }).catch(() => undefined);
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
  if (!typed.lines.some((l) => !GENERIC.test(l))) problems.push(`[${name}] a typed slow turn had no specific status line: ${JSON.stringify(typed.lines)} ${JSON.stringify(await page.evaluate((k) => window.__talk.status.filter((s) => s.at > k).map((s) => [Math.round(s.at - k), s.text, s.busy]), k0))}`);
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
  const firstWords = [];
  const noTick = [];
  const heardAt = [];
  let answered = 0;
  for (let i = 1; i <= 10; i++) {
    const said = `turn ${i} of ten ${RUN}`;
    io.heard.push(said);
    const sfxBefore = await page.evaluate(() => window.__talk.sfx.filter((s) => s.kind === 'turn').length);
    // turn 5 is said the moment the ear opens: it must already be able to hear him
    if (i !== 5 && i !== 1) await page.waitForTimeout(150);
    const endAt0 = await speakFor(page, 700);
    const ok = await seen(page, new RegExp(`Mock reply to: ${said}`), 15000);
    const first = await page.waitForFunction((t) => window.__talk.clips.find((c) => c.at >= t && c.ev === 'playing' && c.dur > 0.3)?.at, endAt0, { timeout: 8000 }).then((h) => h.jsonValue(), () => null);
    if (first) firstWords.push(Math.round(first - endAt0));
    // [ci] NEXT ci.u5: the soft tick that says he was heard, after his last word and before Ghosty's first
    const tick = await page.evaluate((t) => window.__talk.sfx.find((x) => x.kind === 'heard' && x.at >= t)?.at ?? null, endAt0);
    if (tick === null) noTick.push(i);
    else if (first && tick > first) noTick.push(`${i} (after the reply began)`);
    else heardAt.push(Math.round(tick - endAt0));
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
  const median = [...firstWords].sort((a, b) => a - b)[Math.floor(firstWords.length / 2)];
  measured.convo = { taps, answered, reopen, firstWords, firstWordMedian: median };
  // his last word to Ghosty's first, turn after turn of a running conversation: within the second
  if (!(median <= 1000)) problems.push(`[${name}] the first word came a median ${ms(median)} after he stopped speaking (${firstWords.join(', ')} ms; budget 1,000 ms)`);
  if (answered < 10) problems.push(`[${name}] ${answered} of ten turns answered with no tap`);
  // [ci] NEXT ci.u3: the SPEED card's voice line is timed on the phone itself, and agrees with this check's own clock
  const vs = await page.evaluate(() => window.__ghosty.stopwatch?.summary().then((x) => ({ voice: x.voice, line: x.lines.find((l) => l.startsWith('Voice:')) ?? '' })) ?? null);
  if (!vs?.voice?.first || vs.voice.first.n < 8 || !vs.voice.reopen || vs.voice.reopen.n < 8) problems.push(`[${name}] the SPEED card's voice timings were not kept for the ten turns: ${JSON.stringify(vs)}`);
  else if (Math.abs(vs.voice.first.median - median) > 300) problems.push(`[${name}] the phone timed its first word at ${vs.voice.first.median} ms, this check at ${median} ms (want within 300 ms)`);
  console.log(`[${name}] the SPEED card says: "${vs?.line}"`);
  if (noTick.length) problems.push(`[${name}] no soft "heard" tick on turn ${noTick.join(', ')} (want one each time he finishes speaking)`);
  console.log(`[${name}] the "heard" tick came ${heardAt.join(', ')} ms after he stopped`);
  if ((await page.evaluate(() => window.__mic.calls)) !== 1) problems.push(`[${name}] the microphone was asked for ${await page.evaluate(() => window.__mic.calls)} times in one conversation`);
  if (reopen.some((r) => r > 400)) problems.push(`[${name}] the ear opened again late after a reply: ${reopen.join(', ')} ms`);
  console.log(`[${name}] ten turns: ${answered} answered with ${taps} tap (the one that started it); ear open again ${reopen.join(', ')} ms after each reply; his last word to the first of Ghosty's ${firstWords.join(', ')} ms (median ${median})`);
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
if (part('cooling')) {
  // C. the brain on the phone is awake: the cooling line offers it; ASK MY PHONE ends the wait and the phone answers at once
  const name = 'cooling-phone';
  const ctx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 1, ...UK });
  await ctx.addInitScript(fakeTalk);
  await ctx.addInitScript(() => {
    if (!sessionStorage.getItem('t-seeded')) {
      sessionStorage.setItem('t-seeded', '1');
      localStorage.setItem('ghosty.offlinebrain', JSON.stringify({ downloaded: true, have: [], guarded: true }));
    }
    window.__ghostyOfflineEngine = {
      ready: true,
      loaded: true,
      calls: [],
      async load() {
        this.loaded = true;
      },
      unload() {},
      async chat(messages, onToken) {
        this.calls.push(messages.at(-1)?.content ?? '');
        for (const w of ['Hello ', 'from ', 'your ', 'phone.']) {
          await new Promise((r) => setTimeout(r, 20));
          onToken(w);
        }
      },
    };
  });
  // (no kind of ask is trusted to the phone first here: only the offer can send this one to it)
  await ctx.route('**/api/school/trust', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ floor: 20, brains: [] }) }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${name}] pageerror: ${e.message}`));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pair input', { timeout: 15000 });
  await page.fill('#pair input', KEY);
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
  await page.waitForTimeout(800);
  await page.click('.logbtn');
  const ask = `cooling for 8 s: hello ${RUN}`;
  await page.fill('#cin', ask);
  await page.keyboard.press('Enter');
  const offer = page.locator('#pg-core .log .msg.cool .askphone');
  if (!(await offer.waitFor({ state: 'visible', timeout: 4000 }).then(() => true, () => false))) problems.push(`[${name}] the cooling line did not offer the brain on the phone while it was awake`);
  else {
    const line = (await page.locator('#pg-core .log .msg.cool').last().textContent()) ?? '';
    if (!/until \d\d:\d\d/.test(line)) problems.push(`[${name}] the offer does not say when the models are back: "${line}"`);
    const box = await offer.boundingBox();
    if (!box || box.height < 44) problems.push(`[${name}] ASK MY PHONE is ${box?.height ?? 0} pt tall (44 at least)`);
    await page.screenshot({ path: `${out}/talk-cooling-offer.png` });
    await offer.click();
    if (!(await seen(page, /Hello from your phone\./, 6000))) problems.push(`[${name}] ASK MY PHONE did not have the phone answer`);
    // the wait was ended, in the brain too: the cloud's answer never comes after it
    await page.waitForTimeout(9000);
    if (await page.evaluate((a) => document.body.innerText.includes(`Mock reply to: ${a}`), ask)) problems.push(`[${name}] the cloud still answered after ASK MY PHONE`);
    if (await page.locator('#pg-core .log .msg.cool .askphone').count()) problems.push(`[${name}] ASK MY PHONE is still offered after it was tapped`);
  }
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
  await page.waitForTimeout(900); // (the panes assemble with a short animation: photographed where they land)
  await page.screenshot({ path: `${out}/talk-shortcuts.png` });
  await ctx.close();
}

// ================================================================ 7. NOTICES IN TURN
// (OWNER-ISSUES 123: main went red after PR #54 when a notice the spec before this one had left was read out over the reply)
if (part('notice')) {
  const name = 'notice';
  /** An inbox item as a scheduled job leaves one (as tests/restd.spec.mjs makes it): a task for the house, run now, the job gone. */
  const leave = async (title) => {
    const job = await api('/jobs', { method: 'POST', body: JSON.stringify({ kind: 'task', title, text: 'unlock the back door', at: Date.now() + 3_600_000, tz: 'Europe/London' }) });
    const ran = await api(`/jobs/${job.job?.id}/run`, { method: 'POST', body: '{}' });
    await api(`/jobs/${job.job?.id}`, { method: 'DELETE' });
    if (!ran.item) problems.push(`[${name}] the brain left no inbox item for "${title}": ${JSON.stringify(ran).slice(0, 120)}`);
    return ran.item;
  };
  /** What the phone's voice was handed, in order, with when each began and ended (the stand-in's record). */
  const voiceLog = (page) => page.evaluate(() => window.__talk.synth.map((s) => ({ text: s.text, calledAt: s.calledAt, startAt: s.startAt ?? null, endAt: s.endAt ?? null, cancelled: !!s.cancelled })));
  // (the inbox read first each time: a used brain's own notices would queue ahead of these)
  const quietInbox = () => api('/inbox/read', { method: 'POST', body: '{}' }).catch(() => undefined);
  // 7a. two notices waiting at open, and the greeting: the greeting first and whole, then each notice whole, oldest first
  {
    await quietInbox();
    await leave(`Dog walker ${RUN}`);
    await leave(`Garden gate ${RUN}`);
    const { ctx, page } = await talkPage(name, { tts: false, keepInbox: true, boot: true });
    const greeting = await page.evaluate(() => window.__bootState?.greeting ?? '');
    await page.waitForFunction((m) => window.__talk.synth.filter((s) => s.text.startsWith(m)).length >= 1 && window.__talk.synth.every((s) => s.endAt), `Garden gate ${RUN}`, { timeout: 25000 }).catch(() => problems.push(`[${name}] the greeting and two notices were not all said within 25 s`));
    await page.waitForTimeout(300);
    const log = await voiceLog(page);
    const said = log.filter((s) => s.startAt !== null);
    const cut = log.filter((s) => s.cancelled);
    if (cut.length) problems.push(`[${name}] something was cut off: ${cut.map((s) => `"${s.text.slice(0, 40)}"`).join(', ')}`);
    if (!greeting || !said[0] || !said[0].text.startsWith(greeting.replace(/\.$/, ''))) problems.push(`[${name}] the greeting was not the first thing said (greeting "${greeting}"; first "${said[0]?.text.slice(0, 60) ?? ''}")`);
    const ia = said.findIndex((s) => s.text.startsWith(`Dog walker ${RUN}`));
    const ib = said.findIndex((s) => s.text.startsWith(`Garden gate ${RUN}`));
    if (ia < 0 || ib < 0) problems.push(`[${name}] a notice was not read out (dog walker ${ia}, garden gate ${ib}): ${said.map((s) => s.text.slice(0, 30)).join(' | ')}`);
    else if (!(ia < ib)) problems.push(`[${name}] the notices were not read oldest first`);
    // nothing begins before what came before it has ended; the greeting had ended before the first notice began
    const over = said.slice(1).filter((s, i) => s.startAt < said[i].endAt - 1);
    if (over.length) problems.push(`[${name}] said over something else: "${over[0].text.slice(0, 40)}"`);
    if (ia > 0 && said[ia].startAt < said[0].endAt) problems.push(`[${name}] the first notice began before the greeting ended`);
    measured.notices = { pieces: said.length, cut: cut.length };
    console.log(`[${name}] the greeting, then ${Math.max(0, said.length - 1)} notice pieces, each after the last: ${said.map((s) => `${words(s.text)}w`).join(' ')}; cut off: ${cut.length}`);
    await ctx.close();
  }
  // 7b. a reply he asks for while a notice is being read: the notice gives way at once, and is not read again after the reply
  // (the voice slower here, 200 ms a word: the notice takes about five seconds to read, so the reply lands inside it for sure)
  {
    await quietInbox();
    await leave(`Dog walker ${RUN}2`);
    const { ctx, page } = await talkPage(name, { tts: false, keepInbox: true, wordMs: 200 });
    const started = await page.waitForFunction((m) => window.__talk.synth.some((s) => s.text.startsWith(m) && s.startAt), `Dog walker ${RUN}2`, { timeout: 15000 }).then(() => true, () => false);
    if (!started) problems.push(`[${name}] the notice was not read out at open`);
    await page.click('.logbtn');
    await page.fill('#cin', ASK('the hills'));
    await page.keyboard.press('Enter');
    await seen(page, new RegExp(`The hills ${RUN}: I could talk`));
    // (the reply is 55 words: eleven seconds at this pace)
    await page.waitForFunction(() => !window.__ghosty.ui.get().busy && window.__ghosty.ui.get().voice === 'idle' && window.__talk.synth.every((s) => s.endAt), null, { timeout: 30000 }).catch(() => problems.push(`[${name}] the reply was not said to the end`));
    await page.waitForTimeout(1500); // (a notice read again would begin in this time)
    const log = await voiceLog(page);
    const key = await page.evaluate(() => window.__talk.key);
    const before = log.filter((s) => s.calledAt < key);
    const after = log.filter((s) => s.calledAt >= key);
    if (started && !before.some((s) => s.cancelled)) problems.push(`[${name}] the notice did not give way to the reply (${before.map((s) => `${words(s.text)}w${s.cancelled ? ' cut' : ''}`).join(' ')})`);
    if (!after.length || !after.every((s) => s.endAt && !s.cancelled)) problems.push(`[${name}] the reply was not said whole after the notice gave way`);
    if (after.some((s) => s.text.startsWith('Dog walker'))) problems.push(`[${name}] the notice was read again after the reply`);
    console.log(`[${name}] a reply over a notice: the notice ${before.some((s) => s.cancelled) ? 'gave way' : 'was over'}; the reply ${after.length} pieces, ${after.every((s) => s.endAt && !s.cancelled) ? 'whole' : 'NOT whole'}; the notice ${after.some((s) => s.text.startsWith('Dog walker')) ? 'READ AGAIN' : 'not read again'}`);
    await ctx.close();
  }
  // 7c. a notice that arrives while a turn is at work waits for the reply to be said, then is read, whole
  {
    let late = null;
    const { ctx, page } = await talkPage(name, {
      tts: false,
      before: (page) => page.route('**/api/inbox', (r) => (r.request().method() !== 'GET' ? r.continue() : r.fulfill({ contentType: 'application/json', body: JSON.stringify(late ? { unread: 1, items: [late] } : { unread: 0, items: [] }) }))),
    });
    await page.click('.logbtn');
    await page.fill('#cin', ASK('the woods'));
    await page.keyboard.press('Enter');
    // the brain's inbox has a notice now; the page looks on coming back to the front (notices.ts)
    late = { id: `late-${RUN}`, at: Date.now(), kind: 'task', title: `Bins ${RUN}`, text: 'The bins go out tonight, both of them.' };
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await seen(page, new RegExp(`The woods ${RUN}: I could talk`));
    await page.waitForFunction((m) => window.__talk.synth.some((s) => s.text.startsWith(m)) && window.__talk.synth.every((s) => s.endAt), `Bins ${RUN}`, { timeout: 25000 }).catch(() => problems.push(`[${name}] the notice that arrived mid-turn was not read after the reply`));
    await page.waitForTimeout(300);
    const log = await voiceLog(page);
    const key = await page.evaluate(() => window.__talk.key);
    // the reply's pieces were handed to the voice before the notice's (a notice is handed over whole, title then text)
    const noticeAt = log.find((s) => s.text.startsWith(`Bins ${RUN}`))?.calledAt ?? Infinity;
    const reply = log.filter((s) => s.calledAt >= key && s.calledAt < noticeAt);
    const notice = log.filter((s) => s.calledAt >= noticeAt);
    if (!reply.length || !reply.every((s) => s.endAt && !s.cancelled)) problems.push(`[${name}] the reply was cut by the notice that arrived mid-turn`);
    const replyEnd = Math.max(0, ...reply.map((s) => s.endAt ?? 0));
    if (notice[0] && notice[0].startAt !== null && notice[0].startAt < replyEnd - 1) problems.push(`[${name}] the notice began ${ms(replyEnd - notice[0].startAt)} before the reply had ended`);
    if (notice.some((s) => s.cancelled)) problems.push(`[${name}] the notice read after the reply was cut off`);
    console.log(`[${name}] a notice mid-turn: read ${notice[0] && notice[0].startAt !== null ? ms(notice[0].startAt - replyEnd) : 'n/a'} after the reply ended, whole`);
    await ctx.close();
  }
}

await browser.close();
console.log(`MEASURED ${JSON.stringify(measured)}`);
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'Talk run clean: the first word within a second (typed and spoken), sentences queued with no gap, a cut silent within 150 ms and carried on from its sentence, the brain told what he heard, narration per step, ten turns with no tap, cooling down said within two seconds with its time, Siri’s listen link, and notices read in turn, never over the greeting or a reply.');
process.exit(problems.length ? 1 : 0);
