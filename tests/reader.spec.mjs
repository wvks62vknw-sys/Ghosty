// THE LIBRARY AS A LIBRARY (BRIEF-LIBRARY-READER and its 7 Nov addendum; OWNER-ISSUES 125: "i insert books but he can't even read
// them to me and i can't pull up the library and read them myself"), on the preview with the scripted brain and the talk spec's
// stand-in voice (tests/talk.spec.mjs: one queue, an idle voice 120 ms to start, a queued sentence starting as the last ends,
// cancel dropping what was queued), on the owner's iPhone 18 Pro Max (440 × 956) and at 390 × 844. Every check fails on the
// code before the reader (a book opened in a pop-up, passage by passage with MORE; no place, no chapters, nothing read aloud):
//  1. A three-chapter book imported (a text with its pages: form feeds) and an e-book with a cover and an author: the Shelf shows
//     covers (the e-book's own picture, a drawn one for the text), authors, the sort (recent, progress, title) and progress on
//     every row; a tap opens THE READER at the book's start with page marks and chapter heads, the stamp line looking at it;
//     THE SPEED BUDGET: the reader opens (tap → its words at his place on the page) in under 1,000 ms.
//  2. The place is kept as he reads, on the phone and on the brain, across a reload: the Shelf row says the page, and the book
//     opens there again with the recognition tone, once.
//  3. CHAPTERS jumps; SEARCH finds inside the book and jumps to the passage, its words marked.
//  4. LISTEN reads from the place passage after passage with no gap (the stand-in's record: each piece handed to the voice before
//     the one before ended), the lit passage following and the place moving; in the phone's own voice by default (my voice can
//     speak, and is not asked); THE SPEED BUDGET: the first word within 1,000 ms of the tap.
//  5. Talking over him silences him within 150 ms and keeps the place; "go on" carries on from that sentence after the bridge,
//     never from the top; a question mid-read is answered and "go on" goes back to the book; "stop reading" ends it and says
//     the page; "that's all" signs off with the page.
//  6. "read me <book>" and "where were we" by words, with no model (the brain's chat is never called); a book he has not got is
//     said so, with the ADD button.
//  7. The Learn hub's library card: "Reading · <the book>" and "Page · N of 9".
//  8. Nothing sticks out sideways at 390 and 440, in every section and on the Shelf; every control has a name and is 44 pt; the
//     book's words 17 pt to start, never under 12; pages mode turns whole lines a screen at a time, by key and by swipe.
//  9. Offline, a book kept on this phone (KEEP ON THIS PHONE, its size said) still opens and LISTEN reads it in the phone's voice.
// 10. HIS VOICE FOR BOOKS on: my own voice reads until its share runs out (the stand-in's), then the phone's voice says "My own
//     voice from here." and carries on, with no gap of its own.
// 11. Easy to find (the addendum's third rule): two taps from Learn (the Library's card opens the Shelf, then the book) and one
//     typed word from the jump bar ("read", or a word of its title).
// 12. "Just this chapter", typed while I read and after the next chapter's first words were already handed to the voice: I stop
//     at the end of the chapter he was hearing, say so and where, and none of the next chapter is heard.
//   BASE=http://localhost:8788 node tests/reader.spec.mjs [outDir]   (ONLY=shelf,place,listen,talk,words,card,fit,offline,voice,find,chapter)
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, openSection } from './nav.mjs';
import { mkdirSync } from 'node:fs';
import { deflateRawSync, crc32 } from 'node:zlib';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const SMALL = { width: 390, height: 844 };
const OPEN_BUDGET = 1000;
const FIRST_WORD_BUDGET = 1000;
const CUT_BUDGET = 150;
const only = (process.env.ONLY ?? '').split(',').filter(Boolean);
const part = (k) => !only.length || only.includes(k);
const problems = [];
const measured = {};
const check = (ok, what) => void (ok || problems.push(what));
const RUN = Date.now().toString(36).slice(-4);
const ms = (n) => (n == null || !Number.isFinite(n) ? 'n/a' : `${Math.round(n)} ms`);
const api = (path, init = {}) => fetch(`${base}/api${path}`, { ...init, headers: { 'x-ghosty': '1', 'x-ghosty-key': KEY, 'content-type': 'application/json', ...(init.headers ?? {}) } }).then((r) => r.json());
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });

// ---------------------------------------------------------------- the books
// "The Lighthouse Keeper": three chapters of three pages each (a form feed between pages, as a PDF turned into text has), one
// passage a page; "storm" only on page 5; each sentence its own clause, so the voice's pieces are whole sentences.
const LH = `The Lighthouse Keeper ${RUN}`;
const NW = `Night Walks ${RUN}`;
const AUTHOR = 'Iris Calder';
const sentence = (p, i) => [
  `On page ${p} the keeper climbed the iron stairs again and counted every step under his breath.`,
  `The gulls below him wheeled over the harbour wall while the evening light went copper and then grey.`,
  `He polished the great lens with a soft cloth until his own face looked back at him from the glass.`,
  `Far out on the water a fishing boat turned for home with its little lamp swinging at the stern.`,
  `He wrote the time and the weather in the log book in small careful letters that leaned to the right.`,
  `Then he sat by the window with a mug of tea and listened to the sea breathing against the rocks.`,
][i];
const chapterTitles = ['Chapter One: The Lamp', 'Chapter Two: The Gale', 'Chapter Three: The Morning'];
const pages = [];
for (let p = 1; p <= 9; p++) {
  const c = Math.floor((p - 1) / 3);
  const head = (p - 1) % 3 === 0 ? `# ${chapterTitles[c]}\n\n` : '';
  const extra = p === 5 ? 'That night a storm came in from the west and threw spray as high as the gallery rail. ' : '';
  pages.push(`${head}${[0, 1, 2].map((i) => sentence(p, i)).join(' ')}\n\n${extra}${[3, 4, 5].map((i) => sentence(p, i)).join(' ')}`);
}
const lighthouseTxt = Buffer.from(pages.join('\f'));

function zip(files) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const [name, data0] of Object.entries(files)) {
    const data = Buffer.isBuffer(data0) ? data0 : Buffer.from(data0);
    const comp = deflateRawSync(data);
    const nameB = Buffer.from(name);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameB.length, 26);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(8, 10);
    cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(comp.length, 20); cd.writeUInt32LE(data.length, 24); cd.writeUInt16LE(nameB.length, 28); cd.writeUInt32LE(offset, 42);
    locals.push(local, nameB, comp);
    central.push(cd, nameB);
    offset += 30 + nameB.length + comp.length;
  }
  const cdBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cdBuf.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cdBuf, end]);
}
// the e-book's cover: a picture made here (a JPEG, as an e-book's own cover is)
const press = await browser.newPage();
await press.setViewportSize({ width: 300, height: 450 });
await press.setContent('<html><body style="margin:0;background:#20324a;display:grid;place-items:center;height:450px"><h1 style="font:700 44px Georgia;color:#f3e9d2;text-align:center">Night<br>Walks</h1></body></html>');
const coverJpg = await press.screenshot({ type: 'jpeg', quality: 85 });
await press.close();
const nightWalks = zip({
  mimetype: 'application/epub+zip',
  'META-INF/container.xml': '<?xml version="1.0"?><container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>',
  'OEBPS/content.opf': `<?xml version="1.0"?><package><metadata><dc:title>${NW}</dc:title><dc:creator>${AUTHOR}</dc:creator><meta name="cover" content="cover-img"/></metadata><manifest><item id="cover-img" href="cover.jpg" media-type="image/jpeg"/><item id="c1" href="one.xhtml"/><item id="c2" href="two.xhtml"/></manifest><spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>`,
  'OEBPS/cover.jpg': coverJpg,
  'OEBPS/one.xhtml': '<html><body><h1>The Canal</h1><p>We walked along the canal after midnight while the city slept behind its curtains. The towpath was wet and the moon sat in the water like a coin.</p><p>A heron stood on one leg by the lock gates and did not move as we passed.</p></body></html>',
  'OEBPS/two.xhtml': '<html><body><h1>The Market</h1><p>At four in the morning the market lorries arrived with crates of oranges and cabbages. The porters called to each other in voices that carried across the square.</p></body></html>',
});

// ---------------------------------------------------------------- the stand-in voice, microphone and the page's clock
/** The talk spec's stand-in (tests/talk.spec.mjs fakeTalk), with the brain's chat counted: no model may be asked for a book. */
const fakeTalk = () => {
  const T = (window.__talk = { key: 0, synth: [], clips: [], tts: [], sfx: [], chat: 0, listenAt: 0, primed: [] });
  const mic = (window.__mic = { calls: 0, set: () => undefined, stream: null });
  document.addEventListener('keydown', (e) => e.key === 'Enter' && e.target?.id === 'cin' && (T.key = performance.now()), true);
  document.addEventListener('click', (e) => e.target?.closest?.('#pg-reader .grd-bar .g-key.fill') && (T.listenAt = performance.now()), true);
  for (const ev of ['playing', 'pause', 'ended']) document.addEventListener(ev, (e) => e.target?.id === 'gvoice' && T.clips.push({ ev, at: performance.now(), dur: e.target.duration }), true);
  document.addEventListener('ghosty-sfx', (e) => T.sfx.push({ kind: e.detail, at: performance.now() }));
  const fetch0 = window.fetch;
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input?.url ?? '';
    if (/\/api\/tts$/.test(url)) T.tts.push({ at: performance.now(), text: JSON.parse(init?.body ?? '{}').text ?? '' });
    if (/\/api\/chat$/.test(url)) T.chat++;
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
      static isTypeSupported() { return false; }
      constructor() { this.state = 'inactive'; this.mimeType = 'audio/wav'; }
      start() { this.state = 'recording'; }
      stop() {
        if (this.state === 'inactive') return;
        this.state = 'inactive';
        const n = 16000;
        const b = new DataView(new ArrayBuffer(44 + n * 2));
        const w = (o, t) => [...t].forEach((c, i) => b.setUint8(o + i, c.charCodeAt(0)));
        w(0, 'RIFF'); b.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true);
        b.setUint32(24, 16000, true); b.setUint32(28, 32000, true); b.setUint16(32, 2, true); b.setUint16(34, 16, true); w(36, 'data'); b.setUint32(40, n * 2, true);
        setTimeout(() => { this.ondataavailable?.({ data: new Blob([b.buffer], { type: 'audio/wav' }) }); this.onstop?.(); }, 10);
      }
    };
  }
  const voices = [{ name: 'Daniel', lang: 'en-GB' }, { name: 'Daniel (Enhanced)', lang: 'en-GB' }, { name: 'Serena (Premium)', lang: 'en-GB' }, { name: 'Samantha', lang: 'en-US' }].map((v) => ({ ...v, voiceURI: v.name, localService: true, default: false }));
  window.SpeechSynthesisUtterance = class { constructor(text) { Object.assign(this, { text, voice: null, lang: '', rate: 1, pitch: 1, volume: 1 }); } };
  const synth = window.SpeechSynthesis?.prototype ?? window.speechSynthesis;
  const q = [];
  let cur = null;
  let paused = false;
  let timer = 0;
  let left = 0;
  let since = 0;
  let lastSound = -1e9;
  const end = () => {
    const c = cur;
    cur = null;
    lastSound = performance.now();
    if (!c) return;
    Object.assign(c.rec, { endAt: performance.now() });
    c.u.onend?.({});
    run(false);
  };
  const run = (idle) => {
    if (cur || paused || !q.length) return;
    cur = q.shift();
    const begin = () => {
      if (!cur) return;
      Object.assign(cur.rec, { startAt: performance.now() });
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
      T.primed.push({ at: performance.now() });
      lastSound = performance.now();
      setTimeout(() => u.onend?.({}), 5);
      return;
    }
    T.synth.push(rec);
    q.push({ u, rec });
    run(!cur);
  };
  synth.cancel = () => {
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

/** A WAV of silence as long as `secs`: my own voice saying a sentence (quicker than a person, for the checks). */
function wav(secs) {
  const n = Math.max(1600, Math.round(16_000 * secs));
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(16_000, 24); b.writeUInt32LE(32_000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  return b;
}

/**
 * Ghosty on a phone with the stand-in voice. `tts`: my own voice can speak (the brain says so); `shareAfter`: the stand-in share
 * for my natural voice runs out after that many clips (then the brain answers in its plain voice, `x-voice-reason: share`).
 */
async function phone(name, { viewport = PHONE, tts = true, wordMs = 30, shareAfter = Infinity } = {}) {
  await api('/inbox/read', { method: 'POST', body: '{}' }).catch(() => undefined);
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, ...UK });
  await ctx.addInitScript((m) => { window.__talkWordMs = m; }, wordMs);
  await ctx.addInitScript(fakeTalk);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${name}] pageerror: ${e.message}`));
  const io = { heard: [], clips: 0 };
  await ctx.route('**/api/status', async (route) => {
    const r = await route.fetch();
    const j = await r.json();
    j.speech = { stt: true, tts };
    await route.fulfill({ response: r, headers: { ...r.headers(), 'content-type': 'application/json' }, body: JSON.stringify(j) });
  });
  await ctx.route('**/api/tts', async (route) => {
    const text = JSON.parse(route.request().postData() ?? '{}').text ?? '';
    io.clips++;
    const share = io.clips > shareAfter;
    await route.fulfill({ status: 200, headers: { 'content-type': 'audio/wav', 'x-voice': share ? 'melo' : 'draco', ...(share ? { 'x-voice-reason': 'share', 'x-voice-note': 'today\'s share for the natural voice is used up' } : {}) }, body: wav(Math.max(0.4, text.length / 60)) });
  });
  await ctx.route('**/api/stt', async (route) => {
    const text = io.heard.shift() ?? '';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text }) });
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pair input', { timeout: 20000 });
  await page.fill('#pair input', KEY);
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
  await page.evaluate(() => window.__ghosty.settings.set({ sounds: true }));
  await page.waitForTimeout(600);
  return { ctx, page, io };
}

const R = (page) => page.evaluate(() => {
  const r = window.__ghosty.reader;
  return r ? JSON.parse(JSON.stringify({ doc: r.doc, opens: r.opens, mode: r.mode, size: r.size, screen: r.screen, screens: r.screens, states: r.states, reading: r.reading, listen: r.listen, places: r.places })) : null;
});
const until = (page, fn, arg, timeout, what) => page.waitForFunction(fn, arg, { timeout }).then(() => true, () => (what && problems.push(what), false));
const seen = (page, re, timeout = 15000) => page.waitForFunction((src) => new RegExp(src).test(document.body.innerText), re.source, { timeout }).then(() => true, () => false);
/** He speaks for `ms` and stops: the page's clock when his voice ended. */
async function speakFor(page, ms = 700, level = 0.3) {
  await page.evaluate((v) => window.__mic.set(v), level);
  await page.waitForTimeout(ms);
  return page.evaluate(() => {
    window.__mic.set(0);
    return performance.now();
  });
}
/** What the phone's voice was handed after `from` (the page's clock), with when each began and ended. */
const synthSince = (page, from = 0) => page.evaluate((t0) => window.__talk.synth.filter((s) => s.calledAt >= t0).map((s) => ({ text: s.text, calledAt: s.calledAt, startAt: s.startAt ?? null, endAt: s.endAt ?? null, pausedAt: s.pausedAt ?? null, cancelled: !!s.cancelled })), from);
const docByTitle = async (title) => (await api('/library')).docs?.find((d) => d.title === title) ?? null;
/**
 * He heard `re` after `from` (the page's clock): what the phone's voice was handed since, in order, as one line (a line of mine is
 * handed to the voice a sentence at a time, as every reply is: "Page 7." then "I'll carry on from here.").
 */
async function heardLine(page, from, re, timeout, what) {
  const ok = await page.waitForFunction(([t, src]) => new RegExp(src).test(window.__talk.synth.filter((s) => s.calledAt > t).map((s) => s.text).join(' ')), [from, re.source], { timeout }).then(() => true, () => false);
  if (!ok) problems.push(`${what}: ${JSON.stringify((await synthSince(page, from)).map((s) => s.text).slice(-6))}`);
  return ok;
}
const PAGE_LINE = /Page \d\. I['’]ll carry on from here\./;

/** The Library on the Shelf pill, with the two books added if they are not there yet (each spec run adds its own, by RUN). */
async function shelfWithBooks(page) {
  await page.evaluate(() => (location.hash = 'library'));
  await page.waitForFunction(() => /PASSAGES/.test(document.querySelector('#pg-library .bigv')?.textContent ?? ''), null, { timeout: 20000 }).catch(() => problems.push('[shelf] the Library never loaded'));
  if (!(await docByTitle(LH)) || !(await docByTitle(NW))) {
    await openSection(page, 'library', 'Add');
    await page.setInputFiles('#pg-library input[type=file]', [
      { name: `${LH}.txt`, mimeType: 'text/plain', buffer: lighthouseTxt },
      { name: 'night-walks.epub', mimeType: 'application/epub+zip', buffer: nightWalks },
    ]);
    await page.waitForFunction(() => document.querySelectorAll('#pg-library .liblog .note.ok').length >= 2 || document.querySelector('#pg-library .liblog .note.bad'), null, { timeout: 30000 }).catch(() => undefined);
    const log = await page.$$eval('#pg-library .liblog .note', (n) => n.map((x) => x.textContent ?? ''));
    check(log.filter((l) => l.startsWith('✓')).length >= 2, `[shelf] the two books were not added: ${log.join(' | ')}`);
  }
  await openSection(page, 'library', 'Shelf');
  await page.waitForFunction((t) => [...document.querySelectorAll('#pg-library .pn.shelf .bookrow .v')].some((v) => v.textContent === t), LH, { timeout: 15000 }).catch(() => problems.push('[shelf] the lighthouse book is not on the Shelf'));
}
const shelfRows = (page) => page.$$eval('#pg-library .pn.shelf .bookrow', (rs) => rs.map((r) => ({ title: r.querySelector('.v')?.textContent ?? '', by: r.querySelector('.by')?.textContent ?? '', kind: r.querySelector('.k')?.textContent ?? '', truth: r.querySelector('.g-truth')?.textContent ?? '', pic: !!r.querySelector('.grd-cover.pic img'), drawn: !!r.querySelector('.grd-cover.drawn'), state: r.dataset.state, label: r.getAttribute('aria-label') ?? '', h: Math.round(r.getBoundingClientRect().height) })));
/** The book opened from its Shelf row (the tap's own clock is the open's start). */
async function openFromShelf(page, title) {
  const row = page.locator('#pg-library .pn.shelf .bookrow', { has: page.locator('.v', { hasText: title }) }).first();
  await row.scrollIntoViewIfNeeded().catch(() => undefined);
  const before = (await R(page))?.opens?.length ?? 0;
  await row.click();
  await until(page, (n) => document.body.dataset.tab === 'reader' && (window.__ghosty.reader?.opens?.length ?? 0) > n, before, 10000, `[open] "${title}" did not open in the reader`);
  await page.waitForTimeout(300);
  return (await R(page))?.opens?.at(-1) ?? null;
}
/** What is at the top of the page now: the passage under the pills. */
const topPassage = (page) => page.evaluate(() => {
  const pills = document.querySelector('#pg-reader .secpills')?.getBoundingClientRect();
  const y = (pills ? pills.bottom : 100) + 12;
  const el = [...document.querySelectorAll('#pg-reader .grd-p')].find((e) => e.getBoundingClientRect().bottom > y);
  return el ? Number(el.dataset.n) : -1;
});
async function pickSection(page, label) {
  await page.click(`#pg-reader .secpill[data-sec="${label}"]`);
  await page.waitForTimeout(300);
}

/** Anything sticking out sideways, a control with no name, a control under 44 pt, text under 12 pt (the visible ones, in `sel`). */
async function measure(page, sel, W) {
  return page.evaluate(({ sel, W }) => {
    const root = document.querySelector(sel);
    if (!root) return { missing: true };
    const seenEl = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
    const side = [];
    for (const el of root.querySelectorAll('*')) {
      if (!seenEl(el) || el.closest('.secpills.scrolls') || el.closest('svg')) continue;
      const r = el.getBoundingClientRect();
      if (r.right > W + 0.5 || r.left < -0.5) side.push(`${el.tagName.toLowerCase()}.${String(el.className.baseVal ?? el.className).split(' ')[0]} ${Math.round(r.left)}–${Math.round(r.right)}`);
    }
    const controls = [...root.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [role="tab"], [role="switch"]')].filter(seenEl);
    const unnamed = controls.filter((c) => !(c.getAttribute('aria-label') || c.textContent || c.getAttribute('placeholder') || '').trim()).map((c) => c.outerHTML.slice(0, 80));
    const small = controls.map((c) => [c, c.getBoundingClientRect()]).filter(([, r]) => r.width < 43.5 || r.height < 43.5).map(([c, r]) => `${(c.getAttribute('aria-label') || c.textContent || '').trim().slice(0, 30)} ${Math.round(r.width)}×${Math.round(r.height)}`);
    // (an element with a data-label shows its words through its ::before, at the label's size: its own text sits at 0 px, unseen)
    const sizeOf = (el) => parseFloat(getComputedStyle(el, el.hasAttribute('data-label') ? '::before' : null).fontSize);
    const tiny = [...root.querySelectorAll('*')].filter((el) => seenEl(el) && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && sizeOf(el) < 12).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} ${sizeOf(el)}px`);
    return { side: side.slice(0, 6), unnamed: unnamed.slice(0, 6), small: small.slice(0, 6), tiny: tiny.slice(0, 6), scroll: document.documentElement.scrollWidth };
  }, { sel, W });
}

// ================================================================ 1. the Shelf, and the reader at a book's start
if (part('shelf')) {
  const name = 'shelf';
  const { ctx, page } = await phone(name);
  await shelfWithBooks(page);
  const rows = await shelfRows(page);
  const lh = rows.find((r) => r.title === LH);
  const nw = rows.find((r) => r.title === NW);
  check(lh && nw, `[${name}] the two books are not rows on the Shelf: ${JSON.stringify(rows.map((r) => r.title))}`);
  if (nw) {
    check(nw.pic, `[${name}] the e-book's own cover is not on its row (${JSON.stringify(nw)})`);
    check(nw.by === AUTHOR, `[${name}] the e-book's author "${nw.by}", want "${AUTHOR}"`);
  }
  if (lh) {
    check(lh.drawn && !lh.pic, `[${name}] the text with no picture has no drawn cover (${JSON.stringify(lh)})`);
    check(/not started/i.test(lh.truth) && lh.state === 'new', `[${name}] a book never opened does not say so: "${lh.truth}"`);
    check(/9 pages/i.test(lh.kind), `[${name}] the text's pages are not said on its row: "${lh.kind}"`);
  }
  const sorts = await page.$$eval('#pg-library .shelfsort .g-key', (b) => b.map((x) => ({ t: x.textContent, p: x.getAttribute('aria-pressed') })));
  check(sorts.map((s) => s.t?.toLowerCase()).join() === 'recent,progress,title' && sorts.filter((s) => s.p === 'true').length === 1, `[${name}] the sort keys: ${JSON.stringify(sorts)}`);
  await page.screenshot({ path: `${out}/reader-shelf-440.png` });
  // the reader at the book's start: page marks, chapter heads, the stamp line looking at it; the open within the budget
  const open = await openFromShelf(page, LH);
  measured.openMs = open?.ms;
  check(open && open.ms < OPEN_BUDGET, `[speed] the reader took ${ms(open?.ms)} to open the book (the budget is ${OPEN_BUDGET} ms)`);
  check(open && open.n === 0 && open.off === 0 && !open.kept, `[${name}] a book never read did not open at its start: ${JSON.stringify(open)}`);
  const look = await page.evaluate(() => ({
    marks: [...document.querySelectorAll('#pg-reader .grd-pg')].map((m) => m.textContent),
    heads: [...document.querySelectorAll('#pg-reader .grd-ch')].map((m) => m.textContent),
    stamp: document.querySelector('#pg-reader .g-stamp')?.getAttribute('aria-label') ?? '',
    title: document.querySelector('#pg-reader .grd-title')?.textContent ?? '',
    place: document.querySelector('#pg-reader .grd-place')?.textContent ?? '',
    first: document.querySelector('#pg-reader .grd-p .grd-tx')?.textContent ?? '',
    pill: document.querySelector('#pg-reader .secpill.on')?.dataset.sec ?? '',
    canvas: getComputedStyle(document.getElementById('pg-reader')).backgroundColor,
    page: getComputedStyle(document.querySelector('#pg-reader .grd-page')).backgroundColor,
  }));
  check(look.marks.length === 9 && look.marks[0] === 'Page 1' && look.marks[8] === 'Page 9', `[${name}] the page marks: ${JSON.stringify(look.marks)}`);
  check(look.heads.join(' | ') === chapterTitles.join(' | '), `[${name}] the chapter heads: ${JSON.stringify(look.heads)}`);
  check(new RegExp(`Looking at ${LH.split(' ').slice(0, 3).join(' ')}`, 'i').test(look.stamp), `[${name}] the stamp line does not look at the book: "${look.stamp}"`);
  check(look.title === LH && /page 1 of 9/i.test(look.place), `[${name}] the head: "${look.title}" · "${look.place}"`);
  check(/^On page 1 the keeper climbed/.test(look.first) && look.pill === 'read', `[${name}] it did not open on READ at the first words: "${look.first.slice(0, 60)}" (${look.pill})`);
  check(look.canvas === 'rgb(16, 19, 23)' && look.page === 'rgb(23, 27, 32)', `[${name}] not the tokens' canvas and plate (not so dark): ${look.canvas} / ${look.page}`);
  // the words carried from one passage to the next are not read twice (the old pop-up repeated them at every passage)
  const text = await page.evaluate(() => [...document.querySelectorAll('#pg-reader .grd-tx')].map((p) => p.textContent).join(' '));
  check((text.match(/listened to the sea breathing against the rocks/g) ?? []).length === 9, `[${name}] a sentence is shown more than once a page (the passages' overlap repeated)`);
  await page.screenshot({ path: `${out}/reader-open-440.png` });
  console.log(`[${name}] opened in ${ms(open?.ms)}; ${look.marks.length} page marks, ${look.heads.length} chapter heads; rows: ${rows.length}`);
  await ctx.close();
}

// ================================================================ 2. the place kept, across a reload; 3. CHAPTERS and SEARCH
if (part('place')) {
  const name = 'place';
  const { ctx, page } = await phone(name);
  await shelfWithBooks(page);
  await openFromShelf(page, LH);
  const doc = await docByTitle(LH);
  // CHAPTERS: three, the one he is in marked; a tap on the second jumps there
  await pickSection(page, 'chapters');
  const ch = await page.$$eval('#pg-reader .grd-chrow', (b) => b.map((x) => ({ t: x.querySelector('b')?.textContent ?? '', cur: x.getAttribute('aria-current') === 'true', label: x.getAttribute('aria-label') ?? '' })));
  check(ch.length === 3 && ch[0].cur && ch.map((c) => c.t).join(' | ') === chapterTitles.join(' | '), `[${name}] CHAPTERS lists ${JSON.stringify(ch)}`);
  await page.screenshot({ path: `${out}/reader-chapters-440.png` });
  await page.click('#pg-reader .grd-chrow[data-i="1"]');
  await page.waitForTimeout(500);
  const at2 = await page.evaluate(() => ({ pill: document.querySelector('#pg-reader .secpill.on')?.dataset.sec, place: window.__ghosty.reader.place(window.__ghosty.reader.doc) }));
  check(at2.pill === 'read' && at2.place?.n === 3 && at2.place?.page === 4, `[${name}] CHAPTERS → Chapter Two did not jump there: ${JSON.stringify(at2)}`);
  check((await topPassage(page)) === 3, `[${name}] Chapter Two is not at the top of the page (passage ${await topPassage(page)})`);
  // SEARCH: "storm" is on page 5 only: a result, then a tap jumps there with the word marked
  await pickSection(page, 'search');
  await page.fill('#pg-reader input.grd-q', 'storm');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const hits = await page.$$eval('#pg-reader .grd-hit', (b) => b.map((x) => ({ n: Number(x.dataset.n), text: x.textContent ?? '', marks: [...x.querySelectorAll('mark')].map((m) => m.textContent) })));
  check(hits.length === 1 && hits[0].n === 4 && hits[0].marks.includes('storm') && /Page 5/i.test(hits[0].text), `[${name}] SEARCH "storm": ${JSON.stringify(hits)}`);
  await page.screenshot({ path: `${out}/reader-search-440.png` });
  if (hits.length) await page.click('#pg-reader .grd-hit');
  await page.waitForTimeout(600);
  const marked = await page.evaluate(() => ({ pill: document.querySelector('#pg-reader .secpill.on')?.dataset.sec, found: document.querySelector('#pg-reader .grd-p.found')?.dataset.n ?? null, marks: [...document.querySelectorAll('#pg-reader .grd-p.found mark')].map((m) => m.textContent), inView: (() => { const m = document.querySelector('#pg-reader .grd-p.found mark'); const r = m?.getBoundingClientRect(); return !!r && r.top > 0 && r.bottom < innerHeight; })(), box: !document.querySelector('#pg-reader .g-lock')?.hidden }));
  check(marked.pill === 'read' && marked.found === '4' && marked.marks.includes('storm') && marked.inView && marked.box, `[${name}] the search result did not open marked: ${JSON.stringify(marked)}`);
  // scrolled on by hand to page 6: the place follows; then the brain has it (another device would open there)
  await page.evaluate(() => {
    const el = document.querySelector('#pg-reader .grd-p[data-n="5"]');
    const hud = document.querySelector('#pg-reader .hud');
    const pills = document.querySelector('#pg-reader .secpills').getBoundingClientRect();
    hud.scrollTop += el.getBoundingClientRect().top - pills.bottom - 8 + 40;
  });
  await page.waitForTimeout(2200);
  const kept = await page.evaluate(() => window.__ghosty.reader.place(window.__ghosty.reader.doc));
  check(kept?.n === 5 && kept?.page === 6, `[${name}] scrolling to page 6 did not move the place: ${JSON.stringify(kept)}`);
  const onBrain = doc ? (await api(`/library/place?doc=${doc.id}`)).place : null;
  check(onBrain?.n === 5 && onBrain?.page === 6, `[${name}] the brain does not have the place: ${JSON.stringify(onBrain)}`);
  // a reload: the Shelf row says the page, and the book opens there with the recognition tone, once
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
  await page.evaluate(() => window.__ghosty.settings.set({ sounds: true }));
  await page.mouse.click(5, 300); // (sound needs one tap first, as on the phone)
  await shelfWithBooks(page);
  const row = (await shelfRows(page)).find((r) => r.title === LH);
  check(row && /page 6 of 9/i.test(row.truth) && /today/i.test(row.truth) && row.state === 'reading', `[${name}] after a reload the Shelf row says "${row?.truth}"`);
  await page.screenshot({ path: `${out}/reader-shelf-progress-440.png` });
  const tones = await page.evaluate(() => window.__talk.sfx.filter((s) => s.kind === 'lock').length);
  const again = await openFromShelf(page, LH);
  check(again?.kept && again.n === 5, `[${name}] the book did not open at his place after a reload: ${JSON.stringify(again)}`);
  check((await topPassage(page)) === 5, `[${name}] page 6 is not at the top after the reopen (passage ${await topPassage(page)})`);
  await page.waitForTimeout(400);
  const toneNow = await page.evaluate(() => window.__talk.sfx.filter((s) => s.kind === 'lock').length);
  check(toneNow === tones + 1 && again?.tone, `[${name}] the recognition tone played ${toneNow - tones} times as the book opened at his place (once)`);
  measured.reopenMs = again?.ms;
  check(again && again.ms < OPEN_BUDGET, `[speed] reopening at his place took ${ms(again?.ms)} (the budget is ${OPEN_BUDGET} ms)`);
  await page.screenshot({ path: `${out}/reader-reopen-440.png` });
  console.log(`[${name}] chapters ${ch.length}; search ${hits.length}; place kept on the phone and the brain at page 6; reopened in ${ms(again?.ms)} with ${toneNow - tones} tone`);
  await ctx.close();
}

// ================================================================ 4. LISTEN: passage after passage, no gap, the phone's voice
if (part('listen')) {
  const name = 'listen';
  const { ctx, page } = await phone(name, { tts: true });
  await shelfWithBooks(page);
  await openFromShelf(page, LH);
  // from the start of Chapter Two (passage 3): two passages' ends crossed while he listens
  await pickSection(page, 'chapters');
  await page.click('#pg-reader .grd-chrow[data-i="1"]');
  await page.waitForTimeout(500);
  const t0 = await page.evaluate(() => performance.now());
  await page.click('#pg-reader .grd-bar .g-key.fill');
  await until(page, () => (window.__ghosty.reader.listen.pieces.at(-1)?.n ?? 0) >= 5, null, 30000, `[${name}] LISTEN never reached the third passage`);
  const said = (await synthSince(page, t0)).filter((s) => s.startAt !== null);
  const listenAt = await page.evaluate(() => window.__talk.listenAt);
  const first = said[0];
  measured.listenFirstWord = first ? first.startAt - listenAt : null;
  check(first && first.startAt - listenAt <= FIRST_WORD_BUDGET, `[speed] LISTEN's first word came ${ms(measured.listenFirstWord)} after the tap (budget ${FIRST_WORD_BUDGET} ms)`);
  check(first && /^Chapter Two: The Gale/.test(first.text), `[${name}] LISTEN did not start at his place (Chapter Two): "${first?.text}"`);
  // every piece handed to the voice before the one before it ended, and started as it ended (across the passages' ends too)
  const done = said.filter((s) => s.endAt !== null);
  const gaps = done.slice(1).map((s, i) => ({ handed: s.calledAt < done[i].endAt, gap: s.startAt - done[i].endAt, text: s.text.slice(0, 30) }));
  measured.listenGaps = gaps.map((g) => Math.round(g.gap));
  check(gaps.length >= 10, `[${name}] only ${gaps.length + 1} pieces said`);
  check(gaps.every((g) => g.handed), `[${name}] a piece was handed to the voice only after the one before it ended: ${JSON.stringify(gaps.filter((g) => !g.handed))}`);
  check(gaps.every((g) => g.gap <= 40), `[${name}] a gap between pieces: ${measured.listenGaps.join(', ')} ms`);
  // the phone's own voice by default: my voice could speak (the status says so), and none of the book went to it
  const tts = await page.evaluate(() => window.__talk.tts.map((x) => x.text));
  check(!tts.some((x) => /keeper|gulls|Chapter Two/.test(x)), `[${name}] the book went to my own voice by default: ${JSON.stringify(tts.slice(0, 3))}`);
  // the lit passage follows the voice, and the place moves with it
  const lit = await page.evaluate(() => ({ lit: document.querySelector('#pg-reader .grd-p.lit')?.dataset.n ?? null, frame: !!document.querySelector('#pg-reader .grd-p.lit > .grd-litframe'), current: document.querySelector('#pg-reader .grd-p[aria-current="true"]')?.dataset.n ?? null, reading: window.__ghosty.reader.reading, place: window.__ghosty.reader.place(window.__ghosty.reader.doc), bar: document.querySelector('#pg-reader .grd-barline')?.textContent ?? '' }));
  check(lit.lit === String(lit.reading.lit) && lit.frame && lit.current === lit.lit && Number(lit.lit) >= 5, `[${name}] the lit passage does not follow the voice: ${JSON.stringify(lit)}`);
  check(lit.place?.n >= 5 && lit.place.n === lit.reading.n, `[${name}] the place did not move with the voice: ${JSON.stringify(lit.place)} (reading ${lit.reading.n})`);
  check(/attending/i.test(lit.bar) && /phone/i.test(lit.bar), `[${name}] the bar does not say it is attending, in the phone's voice: "${lit.bar}"`);
  const litBox = await page.evaluate(() => { const r = document.querySelector('#pg-reader .grd-p.lit')?.getBoundingClientRect(); return r ? { top: r.top, bottom: r.bottom, h: innerHeight } : null; });
  check(litBox && litBox.top < litBox.h - 120 && litBox.bottom > 0, `[${name}] the page did not follow the voice: the lit passage is off the screen ${JSON.stringify(litBox)}`);
  // a chapter's end names the next chapter: Chapter Three's head is read as it comes
  await until(page, () => window.__ghosty.reader.listen.pieces.some((p) => /^Chapter Three/.test(p.text)), null, 30000, `[${name}] the next chapter's name was not said at the chapter's end`);
  await page.screenshot({ path: `${out}/reader-listen-440.png` });
  // STOP: the reading ends and the page is said ("Page 7. I'll carry on from here.")
  const s0 = await page.evaluate(() => performance.now());
  await page.click('#pg-reader .grd-bar .g-key.fill');
  await heardLine(page, s0, PAGE_LINE, 8000, `[${name}] STOP did not say the page`);
  console.log(`[${name}] first word ${ms(measured.listenFirstWord)} after the tap; ${said.length} pieces; gaps ${JSON.stringify(measured.listenGaps)}`);
  await ctx.close();
}

// ================================================================ 5. talking over him, "go on", a question, "stop reading", "that's all"
if (part('talk')) {
  const name = 'talk';
  const { ctx, page, io } = await phone(name, { tts: true, wordMs: 60 });
  await shelfWithBooks(page);
  await openFromShelf(page, LH);
  await pickSection(page, 'chapters');
  await page.click('#pg-reader .grd-chrow[data-i="0"]');
  await page.waitForTimeout(400);
  await page.click('#pg-reader .grd-bar .g-key.fill');
  // (the ear over his voice first learns the echo: barge.ts) a few sentences in, he talks over me
  await until(page, () => (window.__ghosty.reader.listen.pieces.length ?? 0) >= 4 && window.__ghosty.ui.get().voice === 'speaking', null, 20000, `[${name}] LISTEN did not get going`);
  await page.waitForTimeout(900);
  io.heard.push('go on');
  const cutPiece = await page.evaluate(() => window.__ghosty.reader.listen.pieces.at(-1));
  const silence = await page.evaluate(() => new Promise((resolve) => {
    const t = performance.now();
    window.__mic.set(0.3);
    const look = () => {
      const s = window.__talk.synth.find((x) => x.startAt && (x.pausedAt >= t || (x.cancelled && x.endAt >= t)));
      if (s) return resolve(Math.min(s.pausedAt ?? Infinity, s.cancelled ? s.endAt : Infinity) - t);
      if (performance.now() - t > 3000) return resolve(-1);
      setTimeout(look, 5);
    };
    look();
  }));
  measured.cutToSilence = silence;
  check(silence >= 0 && silence <= CUT_BUDGET, `[${name}] talking over him took ${ms(silence)} to silence him (budget ${CUT_BUDGET} ms)`);
  await page.waitForTimeout(500);
  const endAt = await page.evaluate(() => { window.__mic.set(0); return performance.now(); });
  const cut = await R(page);
  check(cut.reading.state === 'cut' && cut.reading.n === cutPiece.n && cut.reading.off === cutPiece.off, `[${name}] the place did not stay at the sentence he was in: ${JSON.stringify({ reading: cut.reading, cutPiece })}`);
  const keptAt = await page.evaluate(() => window.__ghosty.reader.place(window.__ghosty.reader.doc));
  check(keptAt?.n === cutPiece.n && keptAt?.off === cutPiece.off, `[${name}] the kept place is not the cut sentence: ${JSON.stringify(keptAt)}`);
  // "go on": the bridge, then the sentence he was in — never the top
  await until(page, (t) => window.__talk.synth.some((s) => s.calledAt > t && /^Back to The Lighthouse Keeper/.test(s.text) && s.startAt), endAt, 12000, `[${name}] "go on" did not carry on with the bridge: ${JSON.stringify((await synthSince(page, endAt)).map((s) => s.text).slice(0, 3))}`);
  const resumed = await synthSince(page, endAt);
  const bridge = resumed.findIndex((s) => /^Back to The Lighthouse Keeper/.test(s.text));
  measured.resumeMs = bridge >= 0 ? resumed[bridge].startAt - endAt : null;
  check(bridge >= 0 && resumed[bridge + 1] && cutPiece.text.startsWith(resumed[bridge + 1].text.slice(0, 20)), `[${name}] after the bridge came "${resumed[bridge + 1]?.text}", not the cut sentence "${cutPiece.text}"`);
  check(!resumed.some((s) => /^Chapter One: The Lamp/.test(s.text)), `[${name}] "go on" started again from the top`);
  check(!(await page.evaluate(() => document.body.innerText.includes('Mock reply to: go on'))), `[${name}] "go on" went to the brain`);
  // a question mid-read: answered (by the brain), then "go on" goes back to the book from the same sentence
  await until(page, () => window.__ghosty.reader.reading.state === 'reading' && window.__ghosty.reader.listen.pieces.length > 0, null, 8000);
  await page.waitForTimeout(1500);
  const q0 = await page.evaluate(() => window.__ghosty.reader.listen.pieces.at(-1));
  io.heard.push('what does that word mean?');
  await speakFor(page, 700);
  check(await seen(page, /Mock reply to: what does that word mean/, 15000), `[${name}] the question mid-read was not answered`);
  const qCut = await R(page);
  check(qCut.reading.state === 'cut' && qCut.reading.n === q0.n, `[${name}] the book's place did not wait at the sentence of the question: ${JSON.stringify(qCut.reading)} (was ${JSON.stringify(q0)})`);
  // the reply said, the ear opens again (the conversation): "go on"
  await until(page, () => window.__ghosty.ui.get().voice === 'listening', null, 20000, `[${name}] the ear did not open again after the answer`);
  await page.waitForTimeout(400);
  io.heard.push('go on');
  const g2 = await speakFor(page, 500);
  await until(page, (t) => window.__talk.synth.some((s) => s.calledAt > t && /^Back to The Lighthouse Keeper/.test(s.text)), g2, 12000, `[${name}] "go on" after the answer did not go back to the book`);
  const back2 = await synthSince(page, g2);
  const b2 = back2.findIndex((s) => /^Back to The Lighthouse Keeper/.test(s.text));
  check(b2 >= 0 && back2[b2 + 1] && q0.text.startsWith(back2[b2 + 1].text.slice(0, 20)), `[${name}] after the answer the book carried on from "${back2[b2 + 1]?.text}", not "${q0.text}"`);
  // "stop reading": it ends, and the page is said
  await until(page, () => window.__ghosty.reader.reading.state === 'reading', null, 8000);
  await page.waitForTimeout(1200);
  io.heard.push('stop reading');
  const st = await speakFor(page, 600);
  await heardLine(page, st, PAGE_LINE, 12000, `[${name}] "stop reading" did not end it with the page said`);
  check((await R(page)).reading.state === 'ended', `[${name}] after "stop reading" the reading is "${(await R(page)).reading.state}"`);
  check(await page.evaluate(() => [...document.querySelectorAll('#pg-core .log .msg')].slice(-2).map((m) => m.textContent ?? '').join(' | ').match(/stop reading.*Page \d\. I['’]ll carry on from here/i) !== null), `[${name}] "stop reading" and the page are not in the conversation`);
  // "that's all" while I read: the conversation ends, signed off with the page, the microphone let go
  await page.click('#pg-reader .grd-bar .g-key.fill');
  await until(page, () => window.__ghosty.reader.reading.state === 'reading', null, 8000);
  await page.waitForTimeout(1500);
  io.heard.push("that's all");
  const ta = await speakFor(page, 600);
  await heardLine(page, ta, PAGE_LINE, 12000, `[${name}] "that's all" did not sign off with the page`);
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => ({ mic: document.querySelector('#mic')?.classList.contains('on'), live: window.__mic.stream?.getTracks().some((t) => t.readyState === 'live'), voice: window.__ghosty.ui.get().voice, chat: window.__talk.chat }));
  check(!after.mic && after.voice !== 'listening', `[${name}] after "that's all" the microphone is still held: ${JSON.stringify(after)}`);
  check(!(await page.evaluate(() => document.body.innerText.includes("Mock reply to: that's all"))), `[${name}] "that's all" went to the brain`);
  await page.screenshot({ path: `${out}/reader-talk-440.png` });
  console.log(`[${name}] silent ${ms(silence)} after his voice began; "go on" carried on ${ms(measured.resumeMs)} after he stopped; a question answered and the book went on; "stop reading" and "that's all" said the page`);
  await ctx.close();
}

// ================================================================ 6. by words, with no model
if (part('words')) {
  const name = 'words';
  const { ctx, page } = await phone(name, { tts: true });
  await shelfWithBooks(page);
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(500);
  const chat0 = await page.evaluate(() => window.__talk.chat);
  await page.click('.logbtn').catch(() => undefined);
  await page.fill('#cin', `read me night walks`);
  await page.keyboard.press('Enter');
  await until(page, () => document.body.dataset.tab === 'reader' && window.__ghosty.reader.reading.state === 'reading', null, 15000, `[${name}] "read me night walks" did not open the reader and read`);
  const r1 = await R(page);
  const enter = await page.evaluate(() => window.__talk.key);
  // (handed to the voice is not yet heard: the first word is timed when it begins)
  await page.waitForFunction((t) => window.__talk.synth.some((s) => s.calledAt >= t && s.startAt), enter, { timeout: 8000 }).catch(() => undefined);
  const said1 = await synthSince(page, enter);
  measured.readMeFirstWord = said1[0]?.startAt ? said1[0].startAt - enter : null;
  check(said1[0] && /^Night Walks/.test(said1[0].text) && /from the start/.test(said1[0].text), `[${name}] "read me night walks" did not start with the book's name: "${said1[0]?.text}"`);
  check(measured.readMeFirstWord !== null && measured.readMeFirstWord <= FIRST_WORD_BUDGET, `[speed] "read me" said its first word ${ms(measured.readMeFirstWord)} after Enter (budget ${FIRST_WORD_BUDGET} ms)`);
  check(r1.reading.title === NW, `[${name}] it is reading "${r1.reading.title}"`);
  await until(page, () => window.__ghosty.reader.listen.pieces.some((p) => /canal/.test(p.text)), null, 10000, `[${name}] Night Walks' own words were not read`);
  // stop, and "where were we" from Home: the place said, and on it reads
  await page.click('#pg-reader .grd-bar .g-key.fill');
  await page.waitForTimeout(800);
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(500);
  await page.click('.logbtn').catch(() => undefined);
  await page.fill('#cin', 'where were we?');
  await page.keyboard.press('Enter');
  await until(page, () => window.__ghosty.reader.reading.state === 'reading', null, 15000, `[${name}] "where were we" did not carry on reading`);
  const w0 = await page.evaluate(() => window.__talk.key);
  const said2 = await synthSince(page, w0);
  check(said2[0] && /^We were .* into Night Walks/.test(said2[0].text), `[${name}] "where were we" did not say where we were: "${said2[0]?.text}"`);
  // a book he has not got: said so, with ADD
  await page.click('#pg-reader .grd-bar .g-key.fill');
  await page.waitForTimeout(600);
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(400);
  await page.click('.logbtn').catch(() => undefined);
  await page.fill('#cin', 'read me the count of monte cristo');
  await page.keyboard.press('Enter');
  check(await seen(page, /I don’t have that one\. ADD it to the library and I’ll read it\./, 8000), `[${name}] a book he has not got was not said so`);
  const add = page.locator('#pg-core .log .msg .localgo', { hasText: /^ADD$/ }).last();
  check(await add.count(), `[${name}] no ADD button under "I don't have that one"`);
  await page.screenshot({ path: `${out}/reader-words-440.png` });
  if (await add.count()) {
    await add.click();
    await until(page, () => document.body.dataset.tab === 'library' && document.querySelector('#pg-library .secpill.on')?.dataset.sec === 'add', null, 8000, `[${name}] ADD did not open the Library on Add`);
  }
  const chat1 = await page.evaluate(() => window.__talk.chat);
  check(chat1 === chat0, `[${name}] the brain's chat was called ${chat1 - chat0} times for reading by words (no model)`);
  console.log(`[${name}] "read me": first word ${ms(measured.readMeFirstWord)} after Enter; "where were we" carried on; no model asked (${chat1 - chat0} calls)`);
  await ctx.close();
}

// ================================================================ 7. the Learn hub's library card
if (part('card')) {
  const name = 'card';
  const { ctx, page } = await phone(name);
  await shelfWithBooks(page);
  await openFromShelf(page, LH);
  await pickSection(page, 'chapters');
  await page.click('#pg-reader .grd-chrow[data-i="1"]');
  await page.waitForTimeout(600);
  await page.evaluate(() => (location.hash = 'area-learn'));
  await until(page, () => document.querySelector('#pg-area-learn .hubgrid > [data-id="library"] .reads'), null, 10000, `[${name}] no library card on Learn`);
  await page.waitForTimeout(1200);
  const reads = await page.$$eval('#pg-area-learn .hubgrid > [data-id="library"] .reads .rd', (ds) => ds.map((d) => `${d.querySelector('em')?.textContent?.trim()} · ${d.querySelector('b')?.textContent?.trim()}`));
  const want = [`Reading · ${LH.split(' ').slice(0, 8).join(' ')}`, 'Page · 4 of 9'];
  check(reads.join(' | ') === want.join(' | '), `[${name}] the library card reads ${JSON.stringify(reads)}, want ${JSON.stringify(want)}`);
  await page.screenshot({ path: `${out}/reader-card-440.png` });
  console.log(`[${name}] ${reads.join(' | ')}`);
  await ctx.close();
}

// ================================================================ 8. both widths: nothing sideways, every control named, 44 pt; the type; pages mode
if (part('fit')) {
  for (const viewport of [PHONE, SMALL]) {
    const W = viewport.width;
    const name = `fit-${W}`;
    const { ctx, page } = await phone(name, { viewport });
    await shelfWithBooks(page);
    const sm = await measure(page, '#pg-library .pn.shelf', W);
    check(!sm.side?.length && sm.scroll <= W, `[${name}] the Shelf sticks out sideways: ${JSON.stringify(sm.side)} (${sm.scroll})`);
    check(!sm.unnamed?.length, `[${name}] a control on the Shelf has no name: ${sm.unnamed?.join(' | ')}`);
    check(!sm.small?.length, `[${name}] under 44 pt on the Shelf: ${sm.small?.join(' | ')}`);
    await page.screenshot({ path: `${out}/reader-shelf-${W}.png` });
    await openFromShelf(page, LH);
    for (const sec of ['read', 'chapters', 'search', 'about']) {
      await pickSection(page, sec);
      if (sec === 'search') {
        await page.fill('#pg-reader input.grd-q', 'keeper lens');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(200);
      }
      const m = await measure(page, '#pg-reader', W);
      check(!m.side.length && m.scroll <= W, `[${name} ${sec}] sticks out sideways: ${m.side.join(' | ')} (${m.scroll})`);
      check(!m.unnamed.length, `[${name} ${sec}] a control with no name: ${m.unnamed.join(' | ')}`);
      check(!m.small.length, `[${name} ${sec}] under 44 pt: ${m.small.join(' | ')}`);
      check(!m.tiny.length, `[${name} ${sec}] text under 12 pt: ${m.tiny.join(' | ')}`);
      await page.screenshot({ path: `${out}/reader-${sec}-${W}.png` });
    }
    // the book's words: 17 pt to start; the size keys step through the floor (12) and the top (28)
    await pickSection(page, 'read');
    const px = () => page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#pg-reader .grd-tx')).fontSize));
    check((await px()) === 17, `[${name}] the book's words are ${await px()} px to start (17)`);
    await page.click('#pg-reader .grd-bar .g-key[aria-label^="Text"]');
    await page.waitForTimeout(200);
    for (let i = 0; i < 6; i++) await page.click('#pg-reader .grd-prefsbox .g-key[aria-label="Smaller text"]').catch(() => undefined);
    check((await px()) === 12 && (await page.$eval('#pg-reader .grd-prefsbox .g-key[aria-label="Smaller text"]', (b) => b.disabled)), `[${name}] the smallest size is ${await px()} px (12, then no smaller)`);
    for (let i = 0; i < 3; i++) await page.click('#pg-reader .grd-prefsbox .g-key[aria-label="Bigger text"]');
    check((await px()) === 17, `[${name}] back up three steps the words are ${await px()} px`);
    // pages mode: a box of whole lines, turned a screen at a time by the keys and by a swipe
    await page.click('#pg-reader .grd-prefsbox .g-key[aria-label="Read a page at a time"]');
    await page.waitForTimeout(500);
    const pg = await page.evaluate(() => { const p = document.querySelector('#pg-reader .grd-page'); const lh = parseFloat(getComputedStyle(document.querySelector('#pg-reader .grd-flow')).lineHeight); return { pages: p.classList.contains('pages'), inner: p.clientHeight - 32, lh, screen: window.__ghosty.reader.screen, screens: window.__ghosty.reader.screens }; });
    check(pg.pages && pg.inner % pg.lh === 0 && pg.screens > 1, `[${name}] pages mode is not a box of whole lines: ${JSON.stringify(pg)}`);
    await page.click('#pg-reader .grd-prefsbox .g-key[aria-label^="Text"]').catch(() => undefined);
    await page.click('#pg-reader .grd-bar .g-key[aria-label="Next page"]');
    await page.waitForTimeout(500);
    const s1 = (await R(page)).screen;
    const box = await page.locator('#pg-reader .grd-page').boundingBox();
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    const s2 = (await R(page)).screen;
    check(s1 === pg.screen + 1 && s2 === s1 + 1, `[${name}] the page did not turn by key then by swipe: ${pg.screen} → ${s1} → ${s2}`);
    const mp = await measure(page, '#pg-reader', W);
    check(!mp.side.length && !mp.small.length && !mp.unnamed.length, `[${name} pages] ${JSON.stringify(mp)}`);
    await page.screenshot({ path: `${out}/reader-pages-${W}.png` });
    await page.evaluate(() => window.__ghosty && localStorage.setItem('ghosty.reading', JSON.stringify({ mode: 'scroll', size: 17, bookVoice: false })));
    await ctx.close();
  }
}

// ================================================================ 9. offline: a book kept on this phone reads, in the phone's voice
if (part('offline')) {
  const name = 'offline';
  const { ctx, page } = await phone(name, { tts: true });
  await shelfWithBooks(page);
  await openFromShelf(page, NW);
  await pickSection(page, 'about');
  const keep = page.locator('#pg-reader .grd-keepkey');
  const words = (await keep.textContent()) ?? '';
  check(/(Keep|Kept) on this phone · \d+ KB/i.test(words), `[${name}] KEEP ON THIS PHONE does not say its size: "${words}"`);
  if (!(await keep.isDisabled())) await keep.click();
  await until(page, () => /Kept on this phone/i.test(document.querySelector('#pg-reader .grd-keepkey')?.textContent ?? ''), null, 15000, `[${name}] KEEP ON THIS PHONE never finished`);
  await page.screenshot({ path: `${out}/reader-about-kept-440.png` });
  await ctx.setOffline(true);
  await page.evaluate(() => (location.hash = 'library'));
  await page.waitForTimeout(800);
  await openSection(page, 'library', 'Shelf');
  await page.waitForFunction((t) => [...document.querySelectorAll('#pg-library .pn.shelf .bookrow .v')].some((v) => v.textContent === t), NW, { timeout: 15000 }).catch(() => problems.push(`[${name}] offline, the kept book is not on the Shelf`));
  await page.evaluate(() => { window.__talk.tts.length = 0; });
  const open = await openFromShelf(page, NW);
  check(open && (await page.evaluate(() => /moon sat in the water/.test(document.querySelector('#pg-reader .grd-flow')?.textContent ?? ''))), `[${name}] offline, the kept book does not read`);
  // (from its first chapter, The Canal: the checks before left his place anywhere in it)
  await pickSection(page, 'chapters');
  await page.click('#pg-reader .grd-chrow[data-i="0"]');
  await page.waitForTimeout(400);
  const t0 = await page.evaluate(() => performance.now());
  await page.click('#pg-reader .grd-bar .g-key.fill');
  await until(page, (t) => window.__talk.synth.some((s) => s.calledAt > t && s.startAt && /canal|towpath|Canal/.test(s.text)), t0, 10000, `[${name}] offline, LISTEN did not read the kept book in the phone's voice`);
  check(!(await page.evaluate(() => window.__talk.tts.length)), `[${name}] offline, LISTEN asked for my own voice`);
  await page.click('#pg-reader .grd-bar .g-key.fill').catch(() => undefined);
  await page.screenshot({ path: `${out}/reader-offline-440.png` });
  await ctx.setOffline(false);
  await ctx.close();
}

// ================================================================ 10. HIS VOICE FOR BOOKS: my voice until the share runs out, then the phone's, said
if (part('voice')) {
  const name = 'voice';
  const { ctx, page } = await phone(name, { tts: true, shareAfter: 3 });
  await page.evaluate(() => localStorage.setItem('ghosty.reading', JSON.stringify({ mode: 'scroll', size: 17, bookVoice: true })));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
  await page.waitForTimeout(600);
  await shelfWithBooks(page);
  await openFromShelf(page, LH);
  await pickSection(page, 'chapters');
  await page.click('#pg-reader .grd-chrow[data-i="0"]');
  await page.waitForTimeout(400);
  const t0 = await page.evaluate(() => performance.now());
  await page.click('#pg-reader .grd-bar .g-key.fill');
  await until(page, (t) => window.__talk.synth.some((s) => s.calledAt > t && s.text === 'My own voice from here.' && s.startAt), t0, 30000, `[${name}] the share ran out and "My own voice from here." was not said`);
  await until(page, (t) => window.__talk.synth.filter((s) => s.calledAt > t && s.startAt).length >= 4, t0, 15000);
  const clips = await page.evaluate((t) => window.__talk.clips.filter((c) => c.at > t && c.dur > 0.3), t0);
  const played = clips.filter((c) => c.ev === 'ended');
  const said = await synthSince(page, t0);
  const sw = said.findIndex((s) => s.text === 'My own voice from here.');
  const lastClipEnd = played.at(-1)?.at ?? null;
  measured.voiceSwitchGap = sw >= 0 && lastClipEnd ? said[sw].startAt - lastClipEnd : null;
  check(played.length === 3, `[${name}] ${played.length} clips of my own voice played before the share ran out (3)`);
  check(sw === 0, `[${name}] the phone's voice said something before "My own voice from here.": ${JSON.stringify(said.slice(0, 2).map((s) => s.text))}`);
  check(measured.voiceSwitchGap !== null && measured.voiceSwitchGap <= 300, `[${name}] the switch left ${ms(measured.voiceSwitchGap)} of silence (the phone voice's own start is 120 ms: at most 300)`);
  // and carries on from the piece that was next, back to back
  const after = said.slice(sw + 1).filter((s) => s.endAt);
  check(after.length >= 2 && after.slice(1).every((s, i) => s.calledAt < after[i].endAt), `[${name}] after the switch the pieces were not handed back to back`);
  const tts = await page.evaluate((t) => window.__talk.tts.filter((x) => x.at > t).map((x) => x.text), t0);
  check(after[0] && tts[3] && after[0].text === tts[3], `[${name}] the phone's voice did not carry on from the piece my voice could not say ("${tts[3]}"): "${after[0]?.text}"`);
  const bar = await page.evaluate(() => document.querySelector('#pg-reader .grd-barline')?.textContent ?? '');
  check(/phone/i.test(bar), `[${name}] the bar does not say the phone's voice reads from here: "${bar}"`);
  await page.screenshot({ path: `${out}/reader-voice-440.png` });
  await page.click('#pg-reader .grd-bar .g-key.fill').catch(() => undefined);
  await page.evaluate(() => localStorage.setItem('ghosty.reading', JSON.stringify({ mode: 'scroll', size: 17, bookVoice: false })));
  console.log(`[${name}] ${played.length} clips of my own voice, then "My own voice from here." ${ms(measured.voiceSwitchGap)} after the last ended, and on`);
  await ctx.close();
}

// ================================================================ 11. easy to find: two taps from Learn, one word from the jump bar
if (part('find')) {
  const name = 'find';
  const { ctx, page } = await phone(name);
  await shelfWithBooks(page);
  // somewhere in the book already (Chapter Two), so the open is at his place
  await openFromShelf(page, LH);
  await pickSection(page, 'chapters');
  await page.click('#pg-reader .grd-chrow[data-i="1"]');
  await page.waitForTimeout(400);
  // the Library somewhere else than its Shelf, as he may have left it
  await page.evaluate(() => (location.hash = 'library'));
  await openSection(page, 'library', 'Ask');
  await page.evaluate(() => (location.hash = 'area-learn'));
  await until(page, () => !!document.querySelector('#pg-area-learn .hubgrid > [data-id="library"]'), null, 10000, `[${name}] no library card on Learn`);
  await page.waitForTimeout(600);
  const card = page.locator('#pg-area-learn .hubgrid > [data-id="library"]');
  await card.scrollIntoViewIfNeeded().catch(() => undefined);
  await card.click(); // tap 1
  await until(page, () => document.body.dataset.tab === 'library' && document.querySelector('#pg-library .secpill.on')?.dataset.sec === 'shelf', null, 8000, `[${name}] the Library's card on Learn did not open the Shelf (${await page.evaluate(() => `${document.body.dataset.tab} / ${document.querySelector('#pg-library .secpill.on')?.dataset.sec}`)})`);
  const row = page.locator('#pg-library .pn.shelf .bookrow', { has: page.locator('.v', { hasText: LH }) }).first();
  await row.waitFor({ state: 'visible', timeout: 8000 }).catch(() => problems.push(`[${name}] the book is not in view on the Shelf after one tap`));
  const before = (await R(page))?.opens?.length ?? 0;
  await row.click(); // tap 2
  await until(page, (n) => document.body.dataset.tab === 'reader' && (window.__ghosty.reader?.opens?.length ?? 0) > n, before, 8000, `[${name}] two taps from Learn did not open the book`);
  const two = (await R(page))?.opens?.at(-1);
  check(two?.doc === (await docByTitle(LH))?.id && two?.kept && two?.n === 3, `[${name}] two taps from Learn did not open the book at his place: ${JSON.stringify(two)}`);
  await page.screenshot({ path: `${out}/reader-two-taps-440.png` });
  // one typed word: "read" finds the reader, a word of the title finds the book itself
  const jump = async (words, want) => {
    await page.evaluate(() => (location.hash = 'core'));
    await page.waitForTimeout(500);
    await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
    await page.keyboard.press('Control+k');
    await page.waitForSelector('#palette.on input', { timeout: 5000 }).catch(() => problems.push(`[${name}] the jump bar did not open`));
    await page.fill('#palette input', words);
    await page.waitForTimeout(300);
    const hit = page.locator('#palette .it', { has: page.locator('span', { hasText: want }) }).first();
    if (!(await hit.count())) {
      problems.push(`[${name}] "${words}" in the jump bar does not find ${want}: ${(await page.$$eval('#palette .it span', (x) => x.map((e) => e.textContent))).join(' | ')}`);
      await page.keyboard.press('Escape');
      return null;
    }
    const n = (await R(page))?.opens?.length ?? 0;
    await hit.click();
    await until(page, (k) => document.body.dataset.tab === 'reader' && (window.__ghosty.reader?.opens?.length ?? 0) >= k, n, 8000, `[${name}] "${words}" → ${want} did not open the reader`);
    await page.waitForTimeout(400);
    return { tab: await page.evaluate(() => document.body.dataset.tab), doc: (await R(page))?.doc };
  };
  const byRead = await jump('read', /^Reader$/);
  check(byRead?.tab === 'reader' && byRead.doc === two?.doc, `[${name}] "read" in the jump bar did not open the reader on the book he was reading: ${JSON.stringify(byRead)}`);
  const byTitle = await jump('lighthouse', new RegExp(`^Read: ${LH}$`));
  check(byTitle?.tab === 'reader' && byTitle.doc === two?.doc, `[${name}] a word of the title in the jump bar did not open the book: ${JSON.stringify(byTitle)}`);
  console.log(`[${name}] two taps from Learn to the book at his place; "read" and "lighthouse" from the jump bar`);
  await ctx.close();
}

// ================================================================ 12. "just this chapter", typed mid-read, after the voice was handed the next chapter
if (part('chapter')) {
  const name = 'chapter';
  // (a slower stand-in voice: each sentence about two seconds, so the words are typed while the chapter's last sentences are said)
  const { ctx, page } = await phone(name, { tts: true, wordMs: 120 });
  await shelfWithBooks(page);
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(500);
  const chat0 = await page.evaluate(() => window.__talk.chat);
  const type = async (words) => {
    if (await page.evaluate(() => document.body.dataset.tab !== 'core')) {
      await page.evaluate(() => (location.hash = 'core'));
      await page.waitForTimeout(400);
    }
    await page.click('.logbtn').catch(() => undefined);
    await page.fill('#cin', words);
    await page.keyboard.press('Enter');
  };
  // page 6 is the last page of Chapter Two: its six sentences, then Chapter Three
  await type(`read from page 6 of ${LH.toLowerCase()}`);
  await until(page, () => window.__ghosty.reader?.reading?.state === 'reading', null, 15000, `[${name}] "read from page 6" did not start reading`);
  // the fourth sentence of page 6 being said: the voice already holds the rest of the page and Chapter Three's head
  await until(page, () => window.__ghosty.reader.listen.pieces.some((p) => p.n === 5 && /^Far out on the water/.test(p.text)), null, 30000, `[${name}] page 6's fourth sentence was never said`);
  const queued = await page.evaluate(() => window.__talk.synth.some((x) => /^Chapter Three/.test(x.text)));
  await type('just this chapter');
  const t0 = await page.evaluate(() => performance.now());
  await heardLine(page, t0, /That['’]s the end of Chapter Two: The Gale\. Page 7\. I['’]ll carry on from here\./, 20000, `[${name}] the end of the chapter was not said`);
  await page.waitForTimeout(800);
  const heard = await page.evaluate(() => window.__talk.synth.filter((x) => /^Chapter Three|^On page 7/.test(x.text)).map((x) => ({ text: x.text.slice(0, 30), startAt: x.startAt ?? null, endAt: x.endAt ?? null, cancelled: !!x.cancelled })));
  check(heard.every((x) => x.startAt === null || (x.cancelled && x.endAt - x.startAt <= 30)), `[${name}] the next chapter was heard after "just this chapter": ${JSON.stringify(heard)}`);
  const end = await R(page);
  check(end.reading.state === 'ended' && !end.reading.finished && end.listen.ends.at(-1) === 'chapter', `[${name}] the reading did not end at the chapter's end: ${JSON.stringify({ state: end.reading.state, finished: end.reading.finished, ends: end.listen.ends })}`);
  const place = await page.evaluate(() => window.__ghosty.reader.place(window.__ghosty.reader.doc));
  check(place?.n === 6 && place?.off === 0 && place?.page === 7, `[${name}] the place did not move to Chapter Three's start: ${JSON.stringify(place)}`);
  check((await page.evaluate(() => window.__talk.chat)) === chat0, `[${name}] the brain's chat was called for reading by words`);
  await page.screenshot({ path: `${out}/reader-chapter-440.png` });
  console.log(`[${name}] "just this chapter" typed with Chapter Three ${queued ? 'already handed to the voice' : 'not yet handed over'}: stopped at the chapter's end, the place at page 7`);
  await ctx.close();
}

await browser.close();
console.log(`MEASURED ${JSON.stringify(measured)}`);
if (problems.length) {
  console.error(`FAIL reader:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`ok: the reader — the Shelf with covers, authors, progress and the sort; a book at its start with page marks and chapter heads in ${ms(measured.openMs)}; the place kept across a reload with one tone; chapters and search; LISTEN with no gap, the first word in ${ms(measured.listenFirstWord)}; talked over and silent in ${ms(measured.cutToSilence)}; "go on", a question, "stop reading", "that's all"; by words with no model; the card; both widths; offline; my voice to the phone's, said.`);
