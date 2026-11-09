// SHARED SET-UP of the reader specs (reader.spec.mjs and reader2.spec.mjs): the books, the stand-in voice, microphone and the page's
// clock, the page opener and the helpers. Split out of reader.spec.mjs so that each spec runs well inside the smoke loop's 480 s.
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
/**
 * "Go on" carried on from the sentence he was in (`cut`: the piece being said when he stopped me, from the listen log): the first
 * of the book said after the bridge starts that sentence in the same passage (a reading's first sentence is handed over in two
 * pieces, so he may have stopped me in its second half: then the sentence is said again from its start, never from a fragment),
 * and what he was hearing is said again.
 */
async function fromTheSentence(page, said, bridge, cut, since) {
  // (the log has a piece once it is heard: the bridge is said first)
  await page.waitForFunction((t) => window.__ghosty.reader.listen.pieces.some((p) => p.at > t && !p.line), since, { timeout: 8000 }).catch(() => undefined);
  const first = await page.evaluate((t) => window.__ghosty.reader.listen.pieces.find((p) => p.at > t && !p.line) ?? null, since);
  const again = said.slice(bridge + 1, bridge + 3).map((s) => s.text).join(' ');
  return !!first && first.n === cut.n && first.off <= cut.off && cut.off - first.off < 300 && (again.includes(cut.text) || cut.text.startsWith(said[bridge + 1]?.text.slice(0, 20) ?? '\u0000'));
}

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
  // (the page's entry still moving: a screen's arrival scales it from .985 for half a second, which a slow runner can catch as 43 px
  // keys; the sizes are the settled ones, so every animation under the root is waited for first, up to two seconds)
  await page.evaluate((sel) => Promise.race([
    Promise.all(document.getAnimations().filter((a) => { const t = a.effect?.target; return t && (t === document.querySelector(sel) || document.querySelector(sel)?.contains(t)); }).map((a) => a.finished.catch(() => undefined))),
    new Promise((r) => setTimeout(r, 2000)),
  ]), sel).catch(() => undefined);
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

export { AUTHOR, CUT_BUDGET, FIRST_WORD_BUDGET, KEY, LH, NW, OPEN_BUDGET, PAGE_LINE, R, RUN, SMALL, api, base, browser, chapterTitles, check, coverJpg, docByTitle, fakeTalk, fromTheSentence, heardLine, lighthouseTxt, measure, measured, ms, nightWalks, only, openFromShelf, out, pages, part, phone, pickSection, press, problems, seen, sentence, shelfRows, shelfWithBooks, speakFor, synthSince, topPassage, until, wav, zip };
