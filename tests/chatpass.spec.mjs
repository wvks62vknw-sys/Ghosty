// QUALITY PASS: THE CHAT (BRIEF-QUALITY-CHAT): the conversation itself, measured and made right, nothing new added. One check for each
// fix, named for the rough spot it closes, grouped THE LOG · A TURN'S STATES · THE TALK BAR · THE STAGE · THE SOURCES · THE PHONE'S OWN
// ANSWERS · THE GUARDIAN AND THE HUD, at 440 × 956 and 390 × 844 (390 with Reduce Motion on, so the talk bar's words are read with the
// animation off), in THE SCAN, against the preview's own brain with its reply stood in by a scripted stream where a check needs a
// slow, a cut or a long one (the stream's every event is the brain's real protocol), the made-up microphone and voices talk.spec
// uses, and the brain's silence by a route the checks put up. The pure words (the log's, the talk bar's, the Stage's) are read from
// the very source files the page is built from. The preview's brain is left as found: its inbox is read first and no notice is left.
// Stills (440 only), before and after a fix pass: CHAT_STILL=before|after names them tests/.shots/chatpass-<name>-440-<before|after>.png.
//   BASE=http://localhost:8842 NO_GL_SHOTS=1 node tests/chatpass.spec.mjs [outDir]
process.env.TZ = 'Europe/London';
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, standDown } from './nav.mjs';
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const { buildSync } = createRequire(new URL('../apps/web/package.json', import.meta.url))('esbuild');

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const STILL = process.env.CHAT_STILL ?? 'after';
const PHONE2 = { width: 390, height: 844 };
const problems = [];
let checks = 0;
const t0 = Date.now();
const check = (ok, msg) => {
  checks++;
  if (!ok) {
    problems.push(msg);
    console.log(`  red: ${msg.slice(0, 260)}`);
  }
};
const on = (k) => !process.env.CP_ONLY || process.env.CP_ONLY.split(',').includes(k);
const log = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s · ${s}`);
const words = (s) => (s.trim().match(/\S+/g) ?? []).length;
const RAW = /aborted|fetch failed|undefined|\[object Object\]|TypeError|NetworkError|Failed to|Load failed|HTTP \d|PROBLEM|\bstream\b|\btoken\b|\bsession\b|\bpayload\b|\btimeout\b/i;
const api = (path, init = {}) => fetch(`${base}/api${path}`, { ...init, headers: { 'x-ghosty': '1', 'x-ghosty-key': KEY, 'content-type': 'application/json', ...(init.headers ?? {}) } }).then((r) => r.json());
await standDown(base, KEY);

/** A source file of the app, bundled and imported: the page's own words, read by the spec (pure files only). */
async function pure(entry) {
  const r = buildSync({ entryPoints: [new URL(`../${entry}`, import.meta.url).pathname], bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`);
}
const src = (f) => readFileSync(new URL(`../apps/web/src/${f}`, import.meta.url), 'utf8');
const CW = await pure('apps/web/src/features/core/words.ts');
const TW = await pure('apps/web/src/assistant/words.ts');
const SW = await pure('apps/web/src/show/words.ts');
const DEFS = await pure('apps/web/src/shell/areadefs.ts');

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


// ================================================================ the words, read from the source (once)
{
  log('pure words');
  const NOW = new Date(2026, 10, 12, 14, 0, 0).getTime(); // Thursday 12 November 2026
  const ago = (d, h = 9) => new Date(2026, 10, 12 - d, h, 5, 0).getTime();
  const dw = [0, 1, 3, 10].map((d) => CW.dayWords(ago(d), NOW));
  check(dw[0] === 'Today' && dw[1] === 'Yesterday' && dw[2] === 'Monday' && dw[3] === 'Monday 2 November' && dw.every((d) => !/^\d/.test(d)),
    `[log: a day's heading] today, yesterday, 3 days, 10 days read ${JSON.stringify(dw)} (want Today, Yesterday, Monday, Monday 2 November: never a bare date)`);
  // a long reply folds in whole sentences
  const sentences = Array.from({ length: 26 }, (_, i) => `Sentence number ${i + 1} is about the weather where he lives and what it means for the day.`);
  const longText = sentences.join(' ');
  const fold = CW.foldReply(longText);
  check(fold && /[.!?]$/.test(fold.head) && `${fold.head} ${fold.rest}` === longText && fold.head.split(/(?<=\.)\s/).every((s) => sentences.includes(s)) && Math.ceil(fold.head.length / CW.FOLD_ACROSS) <= CW.FOLD_LINES + 1,
    `[log: a long reply] the fold ${fold ? `keeps ${fold.head.length} letters and ends "${fold.head.slice(-24)}"` : 'is null'} (want whole sentences, twelve lines, nothing lost)`);
  check(CW.foldReply('A short reply. It fits.') === null && CW.foldReply(`${'One very long sentence '.repeat(40)}ends here.`) === null, '[log: a long reply] a reply that fits, or is one sentence, is never folded or cut');
  // the sources, in words
  check(CW.checkWords(5, 6) === '5 of 6 things I said are in the sources; the one that isn’t is marked.' && CW.checkWords(6, 6) === 'All 6 things I said are in the sources.' && CW.checkWords(2, 4) === '2 of 4 things I said are in the sources; the 2 that aren’t are marked.' && /None of the 3 things/.test(CW.checkWords(0, 3)),
    `[sources: the check line] reads "${CW.checkWords(5, 6)}" / "${CW.checkWords(2, 4)}"`);
  check(CW.shareText('It is so.', [{ n: 1, title: 'Physics', url: 'https://p.test/a' }, { n: 2, title: 'Lost', missing: true }, { n: 3, title: 'Shelf', doc: 'x' }]) === 'It is so.\n\nSources:\n1. Physics: https://p.test/a\n3. Shelf: in my library', '[log: copy and share] a reply as plain words with its sources’ addresses');
  // a turn's one line
  check(CW.turnWords('sending') === 'Sending…' && CW.turnWords('waiting') === 'Asking my brain…' && CW.turnWords('running', 'thinking…') === 'Asking my brain…' && CW.turnWords('running', 'reading that page…') === 'Reading that page…' && /^All my models are busy/.test(CW.turnWords('running', 'waiting for free AI room · 12 s')) && CW.turnWords('stopped') === 'Stopped. What came is above.' && CW.turnWords('idle') === '',
    '[turn: its one line] the words by phase');
  // the talk bar
  const st = (o) => TW.talkState({ voice: 'listening', heard: false, quietFor: 0, cut: false, refused: '', ended: false, ...o });
  check(st({}) === 'listening' && st({ quietFor: 3000 }) === 'quiet' && st({ heard: true, quietFor: 9000 }) === 'hearing' && st({ cut: true }) === 'cut' && st({ voice: 'speaking' }) === 'speaking' && st({ refused: 'x' }) === 'refused' && st({ voice: 'idle', ended: true }) === 'ended',
    '[talk bar: every state] the state follows what the microphone and the voice are doing');
  check(TW.TALK_WORDS.listening === 'I’m listening.' && TW.TALK_WORDS.quiet === 'Go on, I’m still listening.' && TW.TALK_WORDS.speaking === 'Tap to stop me.' && TW.TALK_WORDS.cut === 'You cut in; go on.', '[talk bar: every state] the words');
  // the Stage
  check(SW.drawingWords('chart my spending') === 'Drawing the chart…' && SW.drawingWords('show me Lisbon on the map') === 'Drawing the map…' && SW.drawingWords('how are you') === 'Drawing it…' && SW.noPictureWords('chart of nothing') && SW.noPictureWords('how are you') === null,
    '[stage: its wait and its nothing] the kind of picture said, and why when there is none');
  // every line he is told is one sentence or two short ones, at most 20 words, and no developer word
  const lines = [CW.FIRST_OPEN.say, ...CW.FIRST_OPEN.tries, CW.SIGNAL_WENT, CW.COPY_FAILED, CW.sourceUnopened(2, 'https://x.test'), CW.sourceUnopened(2), CW.approvalAsk('Searching the web'), CW.approvalDone(true), CW.approvalDone(false), ...Object.values(TW.TALK_WORDS).filter(Boolean), TW.MIC_BLOCKED, TW.MIC_BROWSER, TW.MIC_NONE, TW.CAN_NONE, TW.CAN_NEAR('Your books.'), SW.noPictureWords('chart of nothing'), SW.noPictureWords('a map'), SW.noPictureWords('draw it')];
  const bad = lines.filter((l) => words(l) > 20 || RAW.test(l));
  check(!bad.length, `[words] a line is over 20 words or has a developer word: ${bad[0]}`);
  // the guardian's walk bar, and the files that could not be made to happen here (no walk on a healthy preview; a dead microphone is its own check below)
  const guard = src('assistant/guard.ts');
  check(guard.includes('Tap I’M HOME when you’re in.') && guard.includes('I couldn’t reach my brain to end the walk.') && /Home\? /.test(guard), '[guardian: the walk bar] "Home?" says how to answer, and a walk that could not be ended says so in the chat');
  const voice = src('assistant/voice.ts');
  check(!/Cloudflare|Microphone blocked\./.test(voice) && voice.includes("from './words'"), '[talk bar: the browser’s refusal] the voice’s own words are not a developer’s ("Cloudflare", "Microphone blocked.")');
  const core = src('features/core/index.ts');
  check(!/ARC · 3 GW|'OFFLINE'/.test(core.replace(/connected === false \? 'OFFLINE'/g, '')) && core.includes('CALLOUT.powerNone') && core.includes('CALLOUT.libraryDead') && core.includes('CALLOUT.uplinkNoSignal') && CW.CALLOUT.powerNone === 'NO READING' && CW.CALLOUT.libraryDead === 'NOT ANSWERING',
    '[hud: the library and power call-outs] (shown on wide screens only) a dead library reads "NOT ANSWERING" and no battery "NO READING", never a made-up "ARC · 3 GW" (read from the source: the phone does not draw them)');
  const sess = src('assistant/session.ts');
  check(sess.includes('I was closed while I was thinking, so I stopped.') && !sess.includes('stopped: Ghosty was closed'), '[turn: a thought cut by closing] the THINK HARDER line says it in my voice');
}

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });

/**
 * One phone. `turns`/`pending`: the brain's history as the page loads it (the log's first open when none); `dead`: the brain answers
 * nothing; `offline`: no signal; `talk`: the made-up microphone and voices (`wordMs`: how slowly the voice speaks, `heard`: what the ears
 * will write down, in order; `mic`: 'refuse' | 'none' | 'sr'); `body`: the text size; `calm`: Reduce Motion on; `stage`: the Stage may open;
 * `settings`: what is added to his settings.
 */
async function phone(viewport, o = {}) {
  if (o.talk) await api('/inbox/read', { method: 'POST', body: '{}' }).catch(() => undefined);
  const ctx = await browser.newContext({ viewport, screen: viewport, deviceScaleFactor: o.still ? 2 : 1, isMobile: true, hasTouch: true, ...UK, serviceWorkers: 'block', permissions: ['clipboard-read', 'clipboard-write'], reducedMotion: o.calm ? 'reduce' : 'no-preference' });
  openContexts.add(ctx);
  if (o.talk) {
    await ctx.addInitScript(fakeTalk);
    if (o.wordMs) await ctx.addInitScript((ms) => { window.__talkWordMs = ms; }, o.wordMs);
  }
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  // (a tap or a word that cannot be done is a problem named here, so the checks after it still run)
  for (const m of ['click', 'fill']) {
    const f = page[m].bind(page);
    page[m] = (...args) => f(...args).catch((e) => void problems.push(`[${viewport.width}] ${m} ${String(args[0]).slice(0, 50)} could not be done: ${e.message.split('\n')[0]}`));
  }
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${viewport.width}] pageerror: ${e.message}`));
  await page.addInitScript(({ key, body, offline, stage, settings, mic }) => {
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.themes1', '1');
    localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Tony', speak: false, sounds: false, theme: 'reactor', favourites: [], look: { ground: 'graphite', world: 'scan', night: 'graphite', switches: body ? { body } : {} }, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 }, ...settings }));
    window.__ghostyHero = true;
    window.__ghostyPlace = { none: true };
    if (stage) window.__ghostyShow = true;
    if (offline) Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    // the share sheet, as a phone has one: what it was given
    window.__shared = [];
    navigator.share = (d) => (window.__shared.push(d.text), Promise.resolve());
    // the brain's reply, stood in by a scripted stream: [[wait ms, event]] with the brain's own events ('error' breaks the stream off, as a lost signal does)
    window.__chatStub = null;
    const f0 = window.fetch;
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input?.url ?? '';
      if (window.__chatStub && /\/api\/chat$/.test(url)) {
        const sc = window.__chatStub;
        window.__chatStub = null;
        window.__asked = (window.__asked ?? []).concat(JSON.parse(init?.body ?? '{}').message ?? '');
        const enc = new TextEncoder();
        const bodyStream = new ReadableStream({
          async start(c) {
            for (const [ms, ev] of sc) {
              await new Promise((r) => setTimeout(r, ms));
              if (ev === 'error') return c.error(new TypeError('network error'));
              c.enqueue(enc.encode(`${JSON.stringify(ev)}\n`));
            }
            c.close();
          },
        });
        return Promise.resolve(new Response(bodyStream, { status: 200, headers: { 'content-type': 'application/x-ndjson' } }));
      }
      return f0(input, init);
    };
    // the one line under his words, as it came (features/core/index.ts paintTurn), and every waiting line (ui/wait.ts)
    window.__turn = [];
    window.__waits = [];
    new MutationObserver((ms) => {
      const t = document.querySelector('.log > .turnline')?.textContent ?? '';
      if (t && window.__turn.at(-1) !== t) window.__turn.push(t);
      const lines = (n) => (n.nodeType === 1 ? [...(n.matches?.('[data-wait]') ? [n] : []), ...n.querySelectorAll('[data-wait]')] : []);
      for (const m of ms) for (const n of m.addedNodes) for (const l of lines(n)) window.__waits.push(l.dataset.wait);
    }).observe(document, { childList: true, subtree: true, characterData: true });
    if (mic === 'refuse') {
      const e = () => Object.assign(new Error('denied'), { name: 'NotAllowedError' });
      (window.MediaDevices?.prototype ?? navigator.mediaDevices).getUserMedia = async () => { throw e(); };
    }
    if (mic === 'none') {
      window.SpeechRecognition = undefined;
      window.webkitSpeechRecognition = undefined;
      Object.defineProperty(window.MediaDevices?.prototype ?? navigator.mediaDevices, 'getUserMedia', { configurable: true, value: undefined });
    }
    if (mic === 'sr') {
      // the browser's own recogniser: nothing for 3.6 s, then a half-heard sentence
      window.SpeechRecognition = class {
        start() { setTimeout(() => this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: 'turn on the lights' }], { isFinal: false })] }), 3600); }
        abort() { setTimeout(() => this.onend?.(), 5); }
      };
      window.webkitSpeechRecognition = window.SpeechRecognition;
    }
    if (!window.__ghostyBatteryKept) Object.defineProperty(navigator, 'getBattery', { configurable: true, value: undefined });
  }, { key: KEY, body: o.body ?? 0, offline: o.offline, stage: o.stage, settings: o.settings ?? {}, mic: o.mic });
  const io = { heard: [], stt: [] };
  if (o.talk) {
    await ctx.route('**/api/status', async (route) => {
      const r = await route.fetch();
      const j = await r.json();
      j.speech = { stt: true, tts: false };
      await route.fulfill({ response: r, headers: { ...r.headers(), 'content-type': 'application/json' }, body: JSON.stringify(j) });
    });
    await ctx.route('**/api/stt', async (route) => {
      const text = io.heard.shift() ?? '';
      io.stt.push(text);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text }) });
    });
  }
  if (o.dead) await page.route('**/api/**', (r) => r.abort('failed'));
  await page.route(/\/api\/tts$/, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"no voice here"}' }));
  if (!o.dead) await page.route(/\/api\/history/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ turns: o.turns ?? [], pending: o.pending ?? null }) }));
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
  await page.waitForTimeout(o.settle ?? 1500);
  return { ctx, page, io };
}
/** The phones still open (a part that stops leaves them: they are closed before the next part, so a stopped part never slows the ones after it). */
const openContexts = new Set();
/** One part of the spec: a thing that throws is a problem named here, and the next part still runs. */
const part = async (name, W, fn) => {
  if (!on(name)) return;
  try {
    await fn();
  } catch (e) {
    problems.push(`[${W}] [${name}] stopped: ${String(e.message).split('\n')[0].slice(0, 160)}`);
    console.log(`  red: [${W}] [${name}] stopped: ${String(e.message).split('\n')[0].slice(0, 160)}`);
  } finally {
    for (const c of openContexts) await c.close().catch(() => undefined);
    openContexts.clear();
  }
};
const until = (page, fn, arg, ms = 8000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const txt = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].map((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim()).join(' | '), sel);
const small = (page, sel) => page.$$eval(sel, (els) => els
  .filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]'))
  .map((e) => { const r = e.getBoundingClientRect(); return r.width >= 43.5 && r.height >= 43.5 ? '' : `${e.tagName.toLowerCase()} "${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 22)}" ${Math.round(r.width)}×${Math.round(r.height)}`; })
  .filter(Boolean).slice(0, 5));
const sideways = (page) => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
/** Words cut by a box that clips, in the chat's own surfaces. */
const clipped = (page) => page.evaluate(() => [...document.querySelectorAll('.log *, #talkline, #talkline *, #thestage *, .approval *, .citedoc *')]
  .filter((e) => e.getClientRects().length && (e.textContent ?? '').trim() && !e.closest('svg') && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1) && /hidden|clip/.test(getComputedStyle(e).overflowX + getComputedStyle(e).overflowY) && !e.classList.contains('log'))
  .map((e) => `${e.tagName.toLowerCase()}.${e.className} "${(e.textContent ?? '').trim().slice(0, 24)}"`).slice(0, 3));
const still = (page, name, vp) => (vp.width === 440 ? page.screenshot({ path: `${out}/chatpass-${name}-440-${STILL}.png` }).catch(() => undefined) : undefined);
const openLog = async (page) => { await page.click('.logbtn'); await page.waitForTimeout(450); };
const sendText = async (page, t) => { await page.fill('#cin', t); await page.keyboard.press('Enter'); };
const stub = (page, script) => page.evaluate((s) => (window.__chatStub = s), script);
const turnSeen = (page) => page.evaluate(() => window.__turn.slice());
const logEl = '.hud.core .log';
const BARE = /^(?:thinking|thinking about the results|processing|working)(?:…|\.\.\.)?$/i;


const DAY = 864e5;
const NOWMS = Date.now();
/** His history as the brain keeps it: `n` pairs a day, per day gone by. */
const history = (plan, lastLong) => {
  const t = [];
  let k = 0;
  for (const [daysAgo, pairs] of plan) for (let i = 0; i < pairs; i++, k++) {
    const at = new Date(new Date(NOWMS - daysAgo * DAY).setHours(9, 5, 0, 0)).getTime() + i * 90_000;
    // (today's turns are in the past by an hour or so, so a late spec run never puts one in the future)
    const when = daysAgo === 0 ? NOWMS - (plan.at(-1)[1] - i) * 120_000 : at;
    t.push({ role: 'user', text: `Question number ${k + 1}`, at: when }, { role: 'assistant', text: `Answer number ${k + 1}.`, at: when + 4000, model: 'Mock · scripted' });
  }
  if (lastLong) t[t.length - 1].text = lastLong;
  return t;
};
const SENT = Array.from({ length: 26 }, (_, i) => `Sentence number ${i + 1} is about the weather where he lives and what it means for the day.`);
const LONG = SENT.join(' ');
const SEQ = [
  [1400, { t: 'status', text: 'thinking…' }],
  [500, { t: 'tool', id: 'x1', name: 'web_search', args: { query: 'the moon' } }],
  [900, { t: 'tool_result', id: 'x1', name: 'web_search', ok: true, summary: 'found it' }],
  [300, { t: 'text', text: 'The moon is far away. ', part: true }],
  [700, { t: 'text', text: 'It is bright tonight. ', part: true }],
  [300, { t: 'text', text: 'The moon is far away. It is bright tonight.' }],
  [100, { t: 'done', model: 'Mock · scripted' }],
];

for (const vp of [PHONE, PHONE2]) {
  const W = vp.width;
  const calm = W === 390;
  // ============================================================ THE LOG · the first open
  await part('first', W, async () => {
    log(`${W}: the log on first open`);
    const { ctx, page } = await phone(vp, { calm, still: true });
    await openLog(page);
    await still(page, 'log-first', vp);
    const first = await page.evaluate(() => { const f = document.querySelector('.log .logfirst'); return f ? { idle: f.querySelector('.logidle')?.textContent, say: f.querySelector('.logsay')?.textContent, tries: [...f.querySelectorAll('.logtries button')].map((b) => b.textContent.trim()), state: f.dataset.state } : null; });
    check(first && first.idle === 'Here, Tony.' && first.say === CW.FIRST_OPEN.say && JSON.stringify(first.tries) === JSON.stringify(CW.FIRST_OPEN.tries) && first.state === 'empty',
      `[${W}] [log: first open] says ${JSON.stringify(first)} (want his name, "${CW.FIRST_OPEN.say}" and three things he can say)`);
    const sm = await small(page, '.log .logtries button');
    check(!sm.length, `[${W}] [log: first open] a way in under 44 pt: ${sm.join(', ')}`);
    check(!(await sideways(page)) && !(await clipped(page)).length, `[${W}] [log: first open] sideways or cut: ${(await clipped(page)).join(', ')}`);
    await stub(page, [[200, { t: 'text', text: 'Here is what matters today.' }], [50, { t: 'done', model: 'Mock · scripted' }]]);
    await page.click('.log .logtries button >> nth=0');
    await until(page, () => /Here is what matters today\./.test(document.querySelector('.log')?.textContent ?? ''), null, 6000);
    check(!(await page.locator('.log .logfirst').count()) && (await txt(page, '.log .msg.me')).includes(CW.FIRST_OPEN.tries[0]), `[${W}] [log: first open] a try he taps is sent as his words and the first open goes`);
    await ctx.close();
    // with no signal the first open says what the phone can still do, and the three things are ones it answers by itself
    const off = await phone(vp, { calm, offline: true });
    await openLog(off.page);
    const o2 = await off.page.evaluate(() => { const f = document.querySelector('.log .logfirst'); return f ? { say: f.querySelector('.logsay')?.textContent, tries: [...f.querySelectorAll('.logtries button')].map((b) => b.textContent.trim()) } : null; });
    check(o2 && o2.say === CW.FIRST_OPEN.offlineSay && JSON.stringify(o2.tries) === JSON.stringify(CW.FIRST_OPEN.offlineTries), `[${W}] [log: first open, no signal] says ${JSON.stringify(o2)} (want "${CW.FIRST_OPEN.offlineSay}" and three things the phone answers itself)`);
    await off.ctx.close();
    });

  // ============================================================ THE LOG · a long log (days, the fold, a reply while he reads back)
  await part('log', W, async () => {
    log(`${W}: a long log`);
    const turns = history([[10, 5], [3, 4], [1, 3], [0, 3]], LONG);
    const { ctx, page } = await phone(vp, { calm, turns, still: true });
    await openLog(page);
    await page.waitForSelector('.log .daysep', { timeout: 8000 }).catch(() => undefined);
    const seps = await page.evaluate(() => [...document.querySelectorAll('.log .daysep')].map((e) => e.textContent.trim()));
    const heads = seps.map((s) => s.replace(/ \d\d:\d\d$/, ''));
    const want = [10, 3, 1, 0].map((d) => CW.dayWords(NOWMS - d * DAY, NOWMS));
    check(JSON.stringify(heads) === JSON.stringify(want) && heads.every((h) => !/^\d/.test(h)), `[${W}] [log: a day's heading] the log's headings read ${JSON.stringify(seps)} (want ${JSON.stringify(want)} then the time: never a bare date)`);
    // a long reply folds past twelve lines
    const f = await page.evaluate(() => {
      const rest = document.querySelector('.log .msg .foldrest');
      const k = document.querySelector('.log .msg .foldkey');
      const head = rest?.previousElementSibling;
      const r = k?.getBoundingClientRect();
      return rest ? { hidden: rest.hidden, head: head.textContent, headH: head.getBoundingClientRect().height, rest: rest.textContent.trim(), key: k.textContent.trim(), h: r.height, w: r.width, expanded: k.getAttribute('aria-expanded') } : null;
    });
    check(f && f.hidden && /[.!?]$/.test(f.head.trim()) && f.headH <= 13 * 24 + 8 && `${f.head.trim()} ${f.rest}`.replace(/\s+/g, ' ') === LONG && f.key === 'The rest' && f.h >= 43.5 && f.w >= 43.5,
      `[${W}] [log: a long reply] ${f ? `folds at ${Math.round(f.headH)} px, ends "${f.head.trim().slice(-30)}", key "${f.key}" ${Math.round(f.w)}×${Math.round(f.h)}, whole ${f.head.trim().length + f.rest.length + 1 >= LONG.length}` : 'is not folded'} (want twelve lines or so, whole sentences, "The rest" at 44 pt, nothing lost)`);
    check((await page.locator('.log .msg .foldkey').count()) === 1, `[${W}] [log: a long reply] a short reply is folded too`);
    await still(page, 'log-long', vp);
    await page.click('.log .msg .foldkey');
    const opened = await page.evaluate(() => ({ hidden: document.querySelector('.log .foldrest').hidden, key: document.querySelector('.log .foldkey').textContent.trim(), ex: document.querySelector('.log .foldkey').getAttribute('aria-expanded') }));
    check(!opened.hidden && opened.key === 'Less' && opened.ex === 'true', `[${W}] [log: a long reply] "The rest" opens it whole: ${JSON.stringify(opened)}`);
    await page.click('.log .msg .foldkey');
    // a reply landing while he reads older turns: the page stays, a "newest" key says so
    await page.evaluate(() => { document.querySelector('.hud.core .log').scrollTop = 0; });
    await sendText(page, 'tell me something new');
    await until(page, () => [...document.querySelectorAll('.log .msg.me')].some((m) => /tell me something new/.test(m.textContent)), null, 5000);
    await stub(page, [[1600, { t: 'text', text: 'This landed while you were reading back.' }], [50, { t: 'done', model: 'Mock · scripted' }]]);
    await page.waitForTimeout(250);
    await page.evaluate(() => { document.querySelector('.hud.core .log').scrollTop = 0; });
    await until(page, () => /This landed while you were reading back\./.test(document.querySelector('.log')?.textContent ?? ''), null, 8000);
    await page.waitForTimeout(250);
    const n = await page.evaluate(() => { const l = document.querySelector('.hud.core .log'); const k = l.querySelector('.newestkey'); const r = k?.getBoundingClientRect(); return { top: l.scrollTop, key: k ? k.textContent.trim() : null, w: r?.width ?? 0, h: r?.height ?? 0, label: k?.getAttribute('aria-label') }; });
    check(n.top < 120 && n.key === CW.NEWEST && n.h >= 43.5 && n.w >= 43.5, `[${W}] [log: a reply while he reads back] the page ${n.top < 120 ? 'stayed' : `moved to ${Math.round(n.top)}`} and the key is ${JSON.stringify(n)} (want it still at the top, a 44 pt "${CW.NEWEST}" key)`);
    await still(page, 'log-newest', vp);
    await page.click('.log .newestkey').catch(() => undefined);
    await page.waitForTimeout(300);
    const atEnd = await page.evaluate(() => { const l = document.querySelector('.hud.core .log'); return { end: l.scrollHeight - l.scrollTop - l.clientHeight < 80, key: !!l.querySelector('.newestkey') }; });
    check(atEnd.end && !atEnd.key, `[${W}] [log: a reply while he reads back] the key takes him to the newest and goes: ${JSON.stringify(atEnd)}`);
    check(!(await sideways(page)) && !(await clipped(page)).length, `[${W}] [log: a long log] sideways or cut: ${(await clipped(page)).join(', ')}`);
    await ctx.close();
    });

  // ============================================================ THE LOG · a reply cut by the signal; A TURN'S STATES (sending, waiting, running, streaming, stopped)
  await part('turn', W, async () => {
    log(`${W}: a turn's states`);
    const { ctx, page } = await phone(vp, { calm, still: true });
    await openLog(page);
    await stub(page, SEQ);
    await sendText(page, 'tell me about the moon');
    await until(page, () => /^Writing it now…$/.test(document.querySelector('.log > .turnline')?.textContent ?? ''), null, 12000);
    await still(page, 'turn-trail', vp);
    await until(page, () => !window.__ghosty.ui.get().busy && !document.querySelector('.log > .turnline'), null, 12000);
    const seen = await turnSeen(page);
    const at = (t) => seen.findIndex((s) => s === t);
    check(at('Sending…') === 0 && at('Asking my brain…') > at('Sending…') && at('Looking that up…') > at('Asking my brain…') && at('Writing it now…') > at('Looking that up…'),
      `[${W}] [turn: sending, waiting, running, writing] the one line under his words went ${JSON.stringify(seen)} (want Sending…, Asking my brain…, the step in his words, Writing it now…)`);
    check(!seen.some((s) => BARE.test(s) || /^(?:thinking|processing)/i.test(s)), `[${W}] [turn: running] a bare "thinking" under his words: ${JSON.stringify(seen)}`);
    check((await page.locator('.log > .turnline').count()) === 0, `[${W}] [turn: done] the line goes when the turn is over`);
    // the steps' own line in the log: the trail of what ran stays as one line
    check(/1 step/.test(await txt(page, '.log .rcsteps summary')), `[${W}] [turn: the trail] a turn with a tool keeps its one line of steps: "${await txt(page, '.log .rcsteps summary')}"`);
    // stopped by his tap: the words that came stay, the line says so once and stays until he speaks again
    await stub(page, SEQ);
    await sendText(page, 'tell me again about the moon');
    await until(page, () => /^Writing it now…$/.test(document.querySelector('.log > .turnline')?.textContent ?? ''), null, 12000);
    await sendText(page, 'stop');
    await until(page, () => !window.__ghosty.ui.get().busy, null, 12000);
    await page.waitForTimeout(400);
    const stopped = await txt(page, '.log > .turnline');
    check(stopped === CW.turnWords('stopped') && (await page.locator('.log > .turnline[data-phase="stopped"]').count()) === 1, `[${W}] [turn: stopped] the line under his words reads "${stopped}" (want "${CW.turnWords('stopped')}")`);
    await still(page, 'turn-stopped', vp);
    await stub(page, [[100, { t: 'text', text: 'Back again.' }], [50, { t: 'done', model: 'Mock · scripted' }]]);
    await sendText(page, 'carry on');
    await until(page, () => /Back again\./.test(document.querySelector('.log')?.textContent ?? ''), null, 6000);
    check((await page.locator('.log > .turnline[data-phase="stopped"]').count()) === 0, `[${W}] [turn: stopped] the stopped line goes at his next word`);
    // the signal went with part of a reply on screen
    await stub(page, [[300, { t: 'text', text: 'The first part came through. ', part: true }], [900, 'error']]);
    await sendText(page, 'tell me a long one');
    await until(page, () => !!document.querySelector('.log .msg.err'), null, 10000);
    await page.waitForTimeout(500);
    await still(page, 'turn-failed', vp);
    const cut = await page.evaluate((w) => {
      const l = document.querySelector('.log');
      const err = [...l.querySelectorAll('.msg.err')].at(-1);
      const retry = err?.querySelector('button.retry, button');
      const r = retry?.getBoundingClientRect();
      return { label: err?.querySelector('small')?.textContent, text: err?.querySelector('span')?.textContent, said: l.textContent.split(w).length - 1, kept: /The first part came through\./.test(l.textContent), retry: retry?.textContent.trim(), h: r?.height ?? 0, w: r?.width ?? 0 };
    }, CW.SIGNAL_WENT);
    check(cut.kept && cut.text === CW.SIGNAL_WENT && cut.said === 1 && cut.label === CW.CUT_LABEL && /RETRY/i.test(cut.retry ?? '') && cut.h >= 43.5 && cut.w >= 43.5,
      `[${W}] [log: a reply cut by the signal] ${JSON.stringify(cut)} (want what came kept, "${CW.SIGNAL_WENT}" once, a 44 pt RETRY)`);
    check(!RAW.test(await txt(page, '.log .msg.err')), `[${W}] [log: a reply cut by the signal] a raw word in the card`);
    await stub(page, [[100, { t: 'text', text: 'And here is the rest.' }], [50, { t: 'done', model: 'Mock · scripted' }]]);
    await page.click('.log .msg.err button.retry');
    await until(page, () => /And here is the rest\./.test(document.querySelector('.log')?.textContent ?? ''), null, 6000);
    const asked = await page.evaluate(() => window.__asked.at(-1));
    check(asked === 'tell me a long one', `[${W}] [log: a reply cut by the signal] RETRY asks the same words again ("${asked}")`);
    // the next turn after a cut stream starts clean (the pieces of the broken reply never take its words in)
    check(!/The first part came through\. And here is the rest\./.test(await txt(page, '.log')), `[${W}] [log: a reply cut by the signal] the next reply was joined to the broken one`);
    check(!(await sideways(page)) && !(await clipped(page)).length, `[${W}] [turn] sideways or cut: ${(await clipped(page)).join(', ')}`);
    await ctx.close();
    });

  // ============================================================ A TURN'S STATES · an approval asked and answered
  await part('approval', W, async () => {
    log(`${W}: an approval`);
    for (const allow of W === 440 ? [false, true] : [false]) {
      const { ctx, page } = await phone(vp, { calm, pending: { id: 'ap1', name: 'social', args: { action: 'post', text: 'Hello from me' } } });
      await openLog(page);
      await page.waitForSelector('.log .approval', { timeout: 8000 }).catch(() => undefined);
      const a = await page.evaluate(() => { const b = document.querySelector('.log .approval'); return b ? { thing: b.querySelector('.apthing')?.textContent, keys: [...b.querySelectorAll('button.apkey')].map((k) => { const r = k.getBoundingClientRect(); return { t: k.textContent.trim(), l: k.getAttribute('aria-label'), w: r.width, h: r.height }; }), state: b.dataset.state } : null; });
      const want = CW.approvalAsk('Your accounts (action: post · text: Hello from me)');
      check(a && a.thing === want && a.keys.length === 2 && a.keys.every((k) => k.h >= 43.5 && k.w >= 43.5 && /^(Approve|Decline): Your accounts/.test(k.l)) && a.state === 'waiting',
        `[${W}] [approval: the exact thing asked] ${JSON.stringify(a)} (want "${want}" above two 44 pt keys, each named for the thing)`);
      await still(page, allow ? 'approval-yes' : 'approval-asked', vp);
      await page.click(`.log .approval button.apkey >> nth=${allow ? 0 : 1}`);
      await until(page, () => !!document.querySelector('.log .approval:not([data-state="waiting"])'), null, 5000);
      const done = await page.evaluate(() => { const b = document.querySelector('.log .approval'); return { state: b?.dataset.state, note: b?.querySelector('.note:not(.apthing)')?.textContent, keys: b?.querySelectorAll('button.apkey').length }; });
      check(done.note === CW.approvalDone(allow) && done.state === (allow ? 'approved' : 'declined') && !done.keys, `[${W}] [approval: answered ${allow ? 'yes' : 'no'}] ${JSON.stringify(done)} (want "${CW.approvalDone(allow)}")`);
      await ctx.close();
    }
    });

  // ============================================================ THE SOURCES · the check line, a source that will not open, copy and share
  await part('sources', W, async () => {
    log(`${W}: the sources`);
    const { ctx, page } = await phone(vp, { calm, still: true });
    await openLog(page);
    const body = 'The speed of light is 299,792,458 metres a second [1]. It was fixed in 1983 [1]. The moon is made of cheese [2].';
    const cites = [{ n: 1, title: 'Physics Reference', url: 'https://physics.example.ac.uk/speed-of-light', tier: 'primary' }, { n: 2, title: 'Cheese Weekly', missing: true }, { n: 3, title: 'A page I never opened', url: 'https://never.example.test/opened', missing: true }];
    await stub(page, [[200, { t: 'text', text: `${body} [3]` }], [50, { t: 'cited', citations: cites, checks: [{ claim: 'The speed of light is 299,792,458 metres a second [1].', status: 'supported', source: 1, label: 'established fact' }, { claim: 'It was fixed in 1983 [1].', status: 'supported', source: 1, label: 'established fact' }, { claim: 'The moon is made of cheese [2].', status: 'not_found' }] }], [50, { t: 'done', model: 'Mock · scripted' }]]);
    await sendText(page, 'cite: the speed of light');
    await until(page, () => !!document.querySelector('.log .citecheck'), null, 8000);
    await page.waitForTimeout(300);
    const check1 = await txt(page, '.log .citecheck');
    check(check1.startsWith(CW.checkWords(2, 3)) && !/✓|✕|claims? found/.test(check1) && /The moon is made of cheese/.test(await txt(page, '.log mark.unconf')) && !/speed of light/.test(await txt(page, '.log mark.unconf')),
      `[${W}] [sources: the check line] reads "${check1}" with "${await txt(page, '.log mark.unconf')}" marked (want "${CW.checkWords(2, 3)}" and the one that isn't marked)`);
    await still(page, 'sources', vp);
    // a source that never opened: a sheet with the address to copy
    await page.click('.log .cite.miss[data-n="3"]');
    await page.waitForSelector('.modal .citedoc', { timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(500);
    const un = await page.evaluate(() => { const m = document.querySelector('.modal .citedoc'); const k = m?.querySelector('button'); return m ? { text: m.querySelector('.note')?.textContent, addr: m.querySelector('.citeaddr')?.textContent, key: k?.textContent.trim(), h: k?.offsetHeight ?? 0, w: k?.offsetWidth ?? 0 } : null; });
    check(un && un.text === CW.sourceUnopened(3, 'https://never.example.test/opened') && un.addr === 'https://never.example.test/opened' && un.key === CW.COPY_ADDRESS && un.h >= 43.5 && un.w >= 43.5,
      `[${W}] [sources: a source that will not open] ${JSON.stringify(un)} (want the line, the address and a 44 pt ${CW.COPY_ADDRESS})`);
    if (un) {
      await page.click('.modal .citedoc button');
      await page.waitForTimeout(200);
      const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => 'no clipboard'));
      check(clip === 'https://never.example.test/opened', `[${W}] [sources: a source that will not open] the address copied is "${clip}"`);
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    // copy and share: plain words with the sources' addresses (a source never opened is not among them)
    const wantCopy = CW.shareText(`${body} [3]`.replace(/\n\nSOURCES[\s\S]*$/, ''), cites);
    await page.click('.log .msg.latest .msgact[aria-label="Copy the reply"]');
    await page.waitForTimeout(250);
    const copied = await page.evaluate(() => navigator.clipboard.readText().catch(() => 'no clipboard'));
    check(copied === wantCopy && /Sources:\n1\. Physics Reference: https:\/\/physics\.example\.ac\.uk\/speed-of-light$/.test(copied) && !/Cheese|never\.example/.test(copied) && !/\[3\]\s*$/.test(copied.split('\n\nSources:')[1] ?? ''),
      `[${W}] [log: copy and share] a copied reply reads ${JSON.stringify(copied.slice(0, 220))} (want the words, then "Sources:" and each address)`);
    const toasted = await txt(page, '.toast');
    check(toasted.includes(CW.COPIED), `[${W}] [log: copy and share] the copy says "${toasted}" (want "${CW.COPIED}")`);
    const sh = await page.evaluate(() => { const b = document.querySelector('.log .msg.latest .shareact'); const r = b?.getBoundingClientRect(); return { has: !!b, w: r?.width ?? 0, h: r?.height ?? 0 }; });
    check(sh.has && sh.w >= 43.5 && sh.h >= 43.5, `[${W}] [log: copy and share] a phone that can share gets a 44 pt Share key: ${JSON.stringify(sh)}`);
    if (sh.has) {
      await page.click('.log .msg.latest .shareact');
      await page.waitForTimeout(200);
      const shared = await page.evaluate(() => window.__shared.at(-1));
      check(shared === wantCopy, `[${W}] [log: copy and share] what is shared is ${JSON.stringify((shared ?? '').slice(0, 120))}`);
    }
    await ctx.close();
    });

  // ============================================================ THE PHONE'S OWN ANSWERS (offline, no model): the rooms, the not-found line, 44 pt keys
  await part('local', W, async () => {
    log(`${W}: the phone's own answers`);
    const { ctx, page } = await phone(vp, { calm, still: true });
    await openLog(page);
    const lastReply = (sel) => page.evaluate((s) => { const m = [...document.querySelectorAll('.log .msg:not(.me)')].at(-1); return m ? { text: [...m.childNodes].filter((n) => n.nodeType === 3 || n.matches?.('span:not(.rccited), .linkedtext')).map((n) => n.textContent).join(' ').trim(), whole: m.textContent, keys: [...m.querySelectorAll(s)].map((k) => { const r = k.getBoundingClientRect(); return { t: k.textContent.trim(), w: r.width, h: r.height }; }) } : null; }, sel);
    // "what can you do here?": the rooms, one line each, a key into each
    await sendText(page, 'what can you do here?');
    await until(page, () => [...document.querySelectorAll('.log .msg:not(.me)')].some((m) => /Talk to me, or get the day in one look/.test(m.textContent)), null, 8000);
    const rooms = await lastReply('.localacts button');
    const roomLines = DEFS.AREAS.map((a) => `${a.title}: ${a.sub}`);
    check(roomLines.every((l) => rooms?.whole.includes(l)) && rooms.keys.length === DEFS.AREAS.length && rooms.keys.every((k) => k.h >= 43.5 && k.w >= 43.5),
      `[${W}] [local: what can you do here] ${rooms ? `${rooms.keys.length} keys, ${roomLines.filter((l) => rooms.whole.includes(l)).length} of ${roomLines.length} rooms said` : 'no answer'} (want every room in one line and a 44 pt key into each, no model)`);
    check(!/Mock reply/.test(await txt(page, '.log')), `[${W}] [local: what can you do here] the question went to the brain`);
    await still(page, 'local-rooms', vp);
    // a made-up ask: "I can't do that yet. Shall I learn it?" with YES and NO at 44 pt
    await sendText(page, 'are you able to qwxz plmk');
    await until(page, (w) => [...document.querySelectorAll('.log .msg:not(.me)')].some((m) => m.textContent.includes(w)), TW.CAN_NONE, 8000);
    const none = await lastReply('.localacts button');
    check(none && none.whole.includes(TW.CAN_NONE) && none.keys.some((k) => /^Yes/.test(k.t)) && none.keys.some((k) => k.t === 'No') && none.keys.every((k) => k.h >= 43.5 && k.w >= 43.5),
      `[${W}] [local: not found] ${JSON.stringify(none && { keys: none.keys, text: none.whole.slice(0, 120) })} (want "${TW.CAN_NONE}" with YES and NO at 44 pt)`);
    await still(page, 'local-none', vp);
    await sendText(page, 'can you translate signs?');
    await until(page, () => [...document.querySelectorAll('.log .msg:not(.me)')].some((m) => /^.*Yes\./.test(m.textContent) && m.querySelector('.localgo')), null, 8000);
    const yes = await lastReply('.localacts button');
    check(yes && yes.keys.length >= 1 && yes.keys.every((k) => k.h >= 43.5 && k.w >= 43.5), `[${W}] [local: found] the way on is a 44 pt key: ${JSON.stringify(yes?.keys)}`);
    check(!(await sideways(page)) && !(await clipped(page)).length, `[${W}] [local] sideways or cut: ${(await clipped(page)).join(', ')}`);
    await ctx.close();
    });

  // ============================================================ THE STAGE · its wait said with the kind of picture, a picture with no data, its close in a thumb's reach
  await part('stage', W, async () => {
    log(`${W}: the Stage`);
    const { ctx, page } = await phone(vp, { calm, stage: true, still: true });
    await page.evaluate(() => { window.__ghostyShowDelay = 1500; });
    await openLog(page);
    await stub(page, [[150, { t: 'text', text: 'Rent is 900, Food is 300, Bills are 150 and Fun is 100.' }], [50, { t: 'done', model: 'Mock · scripted' }]]);
    await sendText(page, 'chart my spending');
    await until(page, () => (window.__waits ?? []).some((w) => /^Drawing/.test(w)), null, 8000);
    const waits = await page.evaluate(() => window.__waits.slice());
    check(waits.includes(SW.drawingWords('chart my spending')), `[${W}] [stage: its wait] the wait said ${JSON.stringify(waits)} (want "${SW.drawingWords('chart my spending')}": the kind of picture)`);
    await until(page, () => !!document.querySelector('#thestage'), null, 10000);
    const stg = await page.evaluate(() => {
      const s = document.querySelector('#thestage');
      const k = [...(s?.querySelectorAll('.stgkeys button') ?? [])].find((b) => /close/i.test(b.getAttribute('aria-label') ?? ''));
      const r = k?.getBoundingClientRect();
      const l = document.querySelector('.hud.core .log')?.getBoundingClientRect();
      return s ? { vh: innerHeight, closeW: r?.width ?? 0, closeH: r?.height ?? 0, closeMid: r ? r.top + r.height / 2 : 0, logH: l?.height ?? 0, logTop: l?.top ?? 0, stageTop: s.getBoundingClientRect().top } : null;
    });
    check(stg && stg.closeW >= 43.5 && stg.closeH >= 43.5 && stg.closeMid >= stg.vh * 0.5 && stg.closeMid <= stg.vh, `[${W}] [stage: its close] ${JSON.stringify(stg)} (want a 44 pt CLOSE in the lower half of the screen, a thumb's reach)`);
    check(stg && stg.logH >= 120, `[${W}] [stage: the conversation stays] the log above the Stage is ${Math.round(stg?.logH ?? 0)} px tall (want 120 or more)`);
    await still(page, 'stage-picture', vp);
    check(!(await sideways(page)), `[${W}] [stage] sideways`);
    await page.click('#thestage .stgkeys button[aria-label="Close"]');
    // (the Stage leaves by fading, 360 ms, then is gone: stage.ts clearStage)
    check(await page.waitForFunction(() => !document.getElementById('thestage'), null, { timeout: 3000 }).then(() => true, () => false), `[${W}] [stage: its close] CLOSE did not take the Stage away`);
    // a picture asked for with no data to draw it: one line of why, never an empty plate
    await stub(page, [[150, { t: 'text', text: 'There is nothing to chart there.' }], [50, { t: 'done', model: 'Mock · scripted' }]]);
    await sendText(page, 'draw a chart of nothing');
    await until(page, () => !!document.querySelector('.log .msg.err[data-state="empty"]'), null, 10000);
    await page.waitForTimeout(500);
    const none = await page.evaluate(() => ({ plate: !!document.querySelector('#thestage'), note: document.querySelector('.log .msg.err[data-state="empty"] span')?.textContent, label: document.querySelector('.log .msg.err[data-state="empty"] small')?.textContent }));
    check(!none.plate && none.note === SW.noPictureWords('draw a chart of nothing') && none.label === SW.NO_PICTURE_LABEL, `[${W}] [stage: no data] ${JSON.stringify(none)} (want one line of why and no plate)`);
    await still(page, 'stage-none', vp);
    await ctx.close();
    });

  // ============================================================ THE HUD · the call-outs with the brain dead and with no signal; text at its biggest
  await part('hud', W, async () => {
    log(`${W}: the call-outs`);
    for (const [name, o] of [['dead', { dead: true }], ['nosignal', { dead: true, offline: true }]]) {
      const { ctx, page } = await phone(vp, { calm, ...o, settle: 2600 });
      await page.waitForTimeout(1500);
      const co = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#glance .gi')].map((g) => [g.querySelector('small')?.textContent, g.querySelector('b')?.textContent])));
      const up = co.UPLINK ?? '';
      const want = name === 'dead' ? CW.CALLOUT.uplinkDead : CW.CALLOUT.uplinkNoSignal;
      check(up.toUpperCase() === want, `[${W}] [hud: uplink ${name}] reads "${up}" (want "${want}")`);
      check(Object.values(co).every((v) => !/^\s*[—–-]\s*$/.test(v ?? '')), `[${W}] [hud: never a dash] ${JSON.stringify(co)}`);
      if (name === 'dead') await still(page, 'hud-dead', vp);
      await ctx.close();
    }
    // the chat at its biggest text: nothing cut
    const { ctx, page } = await phone(vp, { calm, body: 21, turns: history([[1, 2], [0, 2]], LONG), pending: { id: 'ap2', name: 'social', args: { action: 'post', text: 'Hello from me' } } });
    await openLog(page);
    await page.waitForSelector('.log .approval', { timeout: 8000 }).catch(() => undefined);
    check(!(await sideways(page)) && !(await clipped(page)).length, `[${W}] [chat at BODY 21] sideways or cut: ${(await clipped(page)).join(', ')}`);
    const smBig = await small(page, '.log .foldkey, .log .apkey, .log .msgact, #cin, #mic');
    check(!smBig.length, `[${W}] [chat at BODY 21] a control under 44 pt: ${smBig.join(', ')}`);
    await ctx.close();
    });

  // ============================================================ THE TALK BAR · every state in words, with the made-up microphone and voices
  await part('talk', W, async () => {
    log(`${W}: the talk bar`);
    const line = (page) => page.evaluate(() => { const t = document.querySelector('#talkline'); const k = t?.querySelector('button'); const r = k?.getBoundingClientRect(); const m = document.querySelector('#mic'); return t ? { state: t.dataset.state, text: t.querySelector('.tlsay')?.textContent ?? '', hidden: t.hidden, role: t.getAttribute('role'), stopShown: !!k && !k.hidden && k.getClientRects().length > 0, stopW: r?.width ?? 0, stopH: r?.height ?? 0, micLabel: m?.getAttribute('aria-label'), micPressed: m?.getAttribute('aria-pressed'), color: getComputedStyle(t).color } : null; });
    const waitLine = (page, state, ms = 12000) => until(page, (s) => document.querySelector('#talkline')?.dataset.state === s, state, ms);
    const waitVoice = (page, want, ms = 15000) => until(page, (w) => window.__ghosty.ui.get().voice === w, want, ms);
    const speakFor = async (page, ms = 800, level = 0.3) => { await page.evaluate((v) => window.__mic.set(v), level); await page.waitForTimeout(ms); await page.evaluate(() => window.__mic.set(0)); };
    const settle = async (page) => { const per = await page.evaluate(() => new Promise((res) => { const a = performance.now(); let n = 0; const f = () => (++n >= 12 || performance.now() - a > 1500 ? res((performance.now() - a) / n) : requestAnimationFrame(f)); requestAnimationFrame(f); })); await page.waitForTimeout(Math.min(7000, Math.max(500, Math.ceil(per * 26)))); };
    const REPLY = 'The first sentence is quite long and goes on for a while so it can be cut. The second sentence follows it closely. The third one comes last of all.';
    const said = [{ t: 'text', text: REPLY }];
    {
      const { ctx, page, io } = await phone(vp, { calm, talk: true, wordMs: 450, settings: { speak: true }, still: true });
      const idle = await line(page);
      check(idle && idle.hidden && idle.state === 'idle' && idle.role === 'status', `[${W}] [talk bar: idle] the line is ${JSON.stringify(idle)} (want it there, hidden, a status)`);
      await page.click('#mic');
      await waitVoice(page, 'listening', 8000);
      await waitLine(page, 'listening', 3000);
      const l1 = await line(page);
      check(l1 && l1.state === 'listening' && l1.text === TW.TALK_WORDS.listening && !l1.hidden && l1.micPressed === 'true' && l1.micLabel === 'Stop listening',
        `[${W}] [talk bar: listening] ${JSON.stringify(l1)} (want "${TW.TALK_WORDS.listening}" and the mic named "Stop listening")`);
      await still(page, 'talk-listening', vp);
      await page.waitForTimeout(TW.STILL_LISTENING_MS + 500);
      const l2 = await line(page);
      check(l2 && l2.state === 'quiet' && l2.text === TW.TALK_WORDS.quiet, `[${W}] [talk bar: still listening] after three seconds of quiet ${JSON.stringify(l2)} (want "${TW.TALK_WORDS.quiet}")`);
      // a turn spoken: while he is heard and thought about, then spoken, with STOP
      await settle(page);
      await stub(page, [[300, said[0]], [50, { t: 'done', model: 'Mock · scripted' }]]);
      io.heard.push('tell me something to hear');
      await speakFor(page, 700);
      const spoke = await waitVoice(page, 'speaking', 20000);
      await waitLine(page, 'speaking', 3000);
      const l3 = await line(page);
      check(spoke && l3 && l3.state === 'speaking' && l3.text === TW.TALK_WORDS.speaking && l3.stopShown && l3.stopW >= 43.5 && l3.stopH >= 43.5,
        `[${W}] [talk bar: speaking] ${JSON.stringify(l3)} (want "${TW.TALK_WORDS.speaking}" and a 44 pt STOP)`);
      await still(page, 'talk-speaking', vp);
      if (l3?.stopShown) {
        await page.click('#talkline button');
        const stopped = await until(page, () => window.__ghosty.ui.get().voice !== 'speaking', null, 3000);
        check(stopped, `[${W}] [talk bar: speaking] STOP did not stop me`);
      }
      // cut off by his voice: "You cut in; go on."
      await waitVoice(page, 'listening', 15000);
      await settle(page);
      await stub(page, [[300, said[0]], [50, { t: 'done', model: 'Mock · scripted' }]]);
      io.heard.push('and another thing');
      await speakFor(page, 700);
      await waitVoice(page, 'speaking', 20000);
      await page.waitForTimeout(1600);
      await page.evaluate(() => window.__mic.set(0.3));
      const cutIn = await waitVoice(page, 'listening', 6000);
      await page.evaluate(() => window.__mic.set(0));
      const l4 = await line(page);
      check(cutIn && l4 && l4.state === 'cut' && l4.text === TW.TALK_WORDS.cut, `[${W}] [talk bar: cut in] after he talked over me ${JSON.stringify(l4)} (want "${TW.TALK_WORDS.cut}")`);
      // the words stay readable with the animation off (390 runs with Reduce Motion on) and the line is not sideways, cut or small ink
      if (calm) check(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), `[${W}] [talk bar: no animation] Reduce Motion was not on for this run`);
      check(!(await sideways(page)) && !(await clipped(page)).length, `[${W}] [talk bar] sideways or cut: ${(await clipped(page)).join(', ')}`);
      // the conversation ends: the mic says so and the line goes
      await page.click('#mic');
      await page.waitForTimeout(500);
      const l5 = await line(page);
      check(l5 && l5.micLabel === 'Talk by voice' && l5.micPressed === 'false', `[${W}] [talk bar: the mic's state] after he ends it the mic reads ${JSON.stringify({ l: l5?.micLabel, p: l5?.micPressed })}`);
      await ctx.close();
    }
    // hearing him: the browser's own recogniser sends half a sentence
    if (W === 440) {
      const { ctx, page } = await phone(vp, { calm, talk: true, mic: 'sr', settings: { offlineBrain: 'always' } });
      await page.click('#mic');
      await waitVoice(page, 'listening', 8000);
      const heard = await waitLine(page, 'hearing', 9000);
      const l = await line(page);
      check(heard && l && l.text === TW.TALK_WORDS.hearing, `[${W}] [talk bar: hearing him] ${JSON.stringify(l)} (want "${TW.TALK_WORDS.hearing}" once his words are coming)`);
      await page.click('#mic').catch(() => undefined);
      await ctx.close();
    }
    // the microphone refused by him (Settings) and by the browser
    for (const [mic, want, name] of [['refuse', TW.MIC_BLOCKED, 'by his Settings'], ['none', TW.MIC_BROWSER, 'by the browser']]) {
      const { ctx, page } = await phone(vp, { calm, talk: true, mic, still: mic === 'refuse' });
      await page.click('#mic');
      await waitLine(page, 'refused', 8000);
      const l = await line(page);
      check(l && l.state === 'refused' && l.text === want && !l.hidden, `[${W}] [talk bar: the microphone refused ${name}] ${JSON.stringify(l)} (want "${want}", kept on the bar)`);
      if (mic === 'refuse') {
        check(/Settings/.test(l?.text ?? '') && !RAW.test(l?.text ?? ''), `[${W}] [talk bar: the microphone refused ${name}] the line does not say how to allow it in the phone's own Settings`);
        await still(page, 'talk-refused', vp);
      }
      await page.click('#mic');
      await page.waitForTimeout(400);
      await ctx.close();
    }
    });
}

await browser.close();
console.log(`(chatpass spec: ${((Date.now() - t0) / 1000).toFixed(1)} s, ${checks} checks)`);
if (problems.length) {
  console.log(`CHAT pass: ${problems.length} PROBLEMS of ${checks} checks:\n${problems.map((p) => ` - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`CHAT pass run clean: ${checks} checks at 440 × 956 and 390 × 844 (the log, a turn's states, the talk bar, the Stage, the sources, the phone's own answers, the guardian and the HUD).`);
