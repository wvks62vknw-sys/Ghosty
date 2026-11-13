// BRIEF-EDITOR-VIDEO (the seventh full editor) on the preview, at 440 × 956 and 390 × 844. It needs GL and the recorder: run it
// WITHOUT NO_GL_SHOTS (the machine's software GL makes it slow), alone:
//   BASE=http://localhost:8834 timeout 600 node tests/video.spec.mjs tests/.shots
// The BENCHMARK (PROGRAMME-EDITORS 7) is the 440 run: four clips of fifteen seconds drawn by this spec (1280 × 720, a moving shape, a
// distinct colour and a 1 kHz tone each, made on the preview through the MediaRecorder path and kept in the shots folder, never
// committed) are added, one trimmed, one split at a SCENES cut, ordered, joined by a crossfade and a wipe, two graded (one with a .cube
// LUT written here), a TITLE, MUSIC ducking under a fed voice-over, QUIET cutting the pauses, two subtitles, and the 1080p 16:9 export,
// each step timed, the exported file decoded by the page's own <video>, and (where the phone has WebCodecs with AAC) its moov read by
// this file's own box walk. Where the preview's browser has no AAC encoder, the export proves the MediaRecorder path and the app's own
// muxer is proved in the browser by a short video-only file (muxProbe) and by the brain test. The phone check is the owner's.
import { launch, webkitNoise } from './browser.mjs';
import { openSection, UK } from './nav.mjs';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(`${out}/clips`, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const problems = [];
const check = (ok, msg) => {
  if (!ok) problems.push(msg);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
  return ok;
};
const until = (page, fn, arg, ms = 15000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const T = {};
/** (while building: VSTOP=<label> ends the run after that stage, to try one stage without the rest) */
let lapAt = Date.now();
const stopAt = async (label) => {
  T[`step ${label}`] = Date.now() - lapAt;
  lapAt = Date.now();
  if (process.env.VSTOP !== label) return;
  console.log(`stopped after ${label}; problems: ${problems.length}`);
  await browser.close();
  process.exit(problems.length ? 1 : 0);
};
const timed = async (name, fn) => {
  const t0 = Date.now();
  const r = await fn();
  T[name] = Date.now() - t0;
  console.log(`time ${name}: ${T[name]} ms`);
  return r;
};

// ---------------------------------------------------------------- the pictures and sounds this spec makes
const COLOURS = { red: [208, 32, 32], green: [32, 176, 48], orange: [224, 128, 16], blue: [32, 64, 208], yellow: [208, 192, 32] };
const near = (px, c, tol = 40) => px && c.every((v, i) => Math.abs(px[i] - v) <= tol);
const hex = (c) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
/** A mono 16-bit WAV of a tone. */
function wav(hz, secs, rate = 22050, amp = 0.5) {
  const n = Math.round(secs * rate);
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * hz * i) / rate) * amp * 32767), 44 + i * 2);
  return b;
}
/** A 17-point .cube that inverts every colour. */
const INVERT_CUBE = ['TITLE "Invert"', 'LUT_3D_SIZE 17', ...Array.from({ length: 17 ** 3 }, (_, i) => `${1 - (i % 17) / 16} ${1 - (Math.floor(i / 17) % 17) / 16} ${1 - Math.floor(i / 289) / 16}`)].join('\n');

/** Clips drawn and recorded on the preview (the recorder path), one after another; returns what each is. */
let bringBack = null;
async function makeClips(specs) {
  // (while building: VIDEO_CLIPS=<folder> keeps the drawn clips between runs, so one stage can be tried without drawing them again)
  const keep = process.env.VIDEO_CLIPS;
  if (keep && specs.every((s) => existsSync(`${keep}/${s.name}`))) return specs.map((s) => { const buffer = readFileSync(`${keep}/${s.name}`); return { name: s.name, mimeType: 'video/mp4', buffer, size: buffer.length }; });
  // a page of its own for each clip, one after another: four software encoders at once starve each other, and a second recorder in the
  // same page gets fewer frames than the first, so the clips would hold a few frames each
  const made = [];
  for (const spec of specs) {
    const gp = await browser.newPage();
    await gp.goto(base, { waitUntil: 'domcontentloaded' });
    // (a page behind another is not painted, so its canvas would stop giving the recorder frames)
    await gp.bringToFront();
    made.push(await gp.evaluate(async (s) => {
      const type = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t));
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      const g = canvas.getContext('2d');
      const ac = new AudioContext();
      const osc = ac.createOscillator();
      osc.frequency.value = 1000;
      const gain = ac.createGain();
      gain.gain.value = 0.3;
      const dest = ac.createMediaStreamDestination();
      osc.connect(gain).connect(dest);
      osc.start();
      const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
      const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 1_500_000 });
      const parts = [];
      rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
      const stopped = new Promise((ok) => (rec.onstop = ok));
      const t0 = performance.now();
      const draw = () => {
        const t = (performance.now() - t0) / 1000;
        g.fillStyle = s.cutAt && t > s.cutAt ? s.colour2 : s.colour;
        g.fillRect(0, 0, 1280, 720);
        g.fillStyle = '#fff';
        g.fillRect((t * 200) % 1100, 310, 100, 100);
        if (s.silence) gain.gain.value = t > s.silence[0] && t < s.silence[1] ? 0 : 0.3;
      };
      const iv = setInterval(draw, 33);
      draw();
      rec.start(500);
      await new Promise((r) => setTimeout(r, s.secs * 1000));
      clearInterval(iv);
      rec.stop();
      await stopped;
      stream.getTracks().forEach((t) => t.stop());
      osc.stop();
      void ac.close();
      const buf = new Uint8Array(await new Blob(parts, { type }).arrayBuffer());
      let bin = '';
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return { name: s.name, type: type.split(';')[0], b64: btoa(bin), size: buf.length };
    }, spec));
    await gp.close();
  }
  await bringBack?.();
  return made.map((m) => {
    const file = `${out}/clips/${m.name}`;
    writeFileSync(file, Buffer.from(m.b64, 'base64'));
    if (keep) { mkdirSync(keep, { recursive: true }); writeFileSync(`${keep}/${m.name}`, Buffer.from(m.b64, 'base64')); }
    return { name: m.name, mimeType: m.type, buffer: readFileSync(file), size: m.size };
  });
}

// ---------------------------------------------------------------- measuring the screen
const wide = (page) => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1 || document.body.scrollWidth > innerWidth + 1);
const sideways = (page, sel) =>
  page.$$eval(sel, (els) =>
    els
      .filter((e) => {
        if (!e.getClientRects().length || getComputedStyle(e).visibility === 'hidden') return false;
        const r = e.getBoundingClientRect();
        if (!r.width || r.bottom < 0 || r.top > innerHeight) return false;
        for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
          if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) {
            const pr = p.getBoundingClientRect();
            if (pr.left >= -1 && pr.right <= innerWidth + 1) return false;
          }
        }
        return r.left < -1 || r.right > innerWidth + 1;
      })
      .map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} "${(e.textContent || '').trim().slice(0, 24)}"`),
  );
const unnamed = (page, sel) =>
  page.$$eval(`${sel} :is(button, input, select, textarea)`, (els) => els.filter((e) => e.type !== 'file' && e.getClientRects().length && !((e.getAttribute('aria-label') || e.getAttribute('title') || e.textContent || '').trim() || e.closest('label'))).map((e) => e.outerHTML.slice(0, 80)));
/** Every control shown on the screen is at least 44 points both ways. */
const small = (page) =>
  page.$$eval('.vd :is(button, input:not([type=file]), select, textarea)', (els) =>
    els.filter((e) => e.getClientRects().length).filter((e) => { const r = e.getBoundingClientRect(); return r.width < 43.5 || r.height < 43.5; }).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} ${Math.round(e.getBoundingClientRect().width)}×${Math.round(e.getBoundingClientRect().height)} "${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 20)}"`),
  );
const cut = (page) =>
  page.$$eval('.vd button, .vd .vdsay, .vd .vdnote, .vd .vdline', (els) => els.filter((e) => e.getClientRects().length && e.scrollWidth > e.clientWidth + 1).map((e) => `"${(e.textContent || '').trim().slice(0, 24)}" ${e.scrollWidth}/${e.clientWidth}`).slice(0, 5));

async function pair(ctx, size) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${size.width}] pageerror: ${e.message}`));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pair input', { timeout: 20000 });
  await page.fill('#pair input', KEY);
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
  return page;
}


/** This file's own box walk, run in the page on the exported file: its tracks (the sample entry and the sample count from stsz). */
const WALK = async (which) => {
  const blob = window.__ghosty.video.lastBlob(which);
  const b = new Uint8Array(await blob.arrayBuffer());
  const dv = new DataView(b.buffer);
  const type = (p) => String.fromCharCode(b[p + 4], b[p + 5], b[p + 6], b[p + 7]);
  const kids = (from, to) => { const out = []; for (let p = from; p + 8 <= to;) { const size = dv.getUint32(p); if (size < 8) break; out.push({ type: type(p), start: p, end: p + size }); p += size; } return out; };
  const top = kids(0, b.length);
  const moov = top.find((x) => x.type === 'moov');
  const tracks = kids(moov.start + 8, moov.end).filter((x) => x.type === 'trak').map((tk) => {
    const dig = (box, path) => path.reduce((cur, name) => cur && kids(cur.start + 8, cur.end).find((x) => x.type === name), box);
    const stbl = dig(tk, ['mdia', 'minf', 'stbl']);
    const stsd = kids(stbl.start + 8, stbl.end).find((x) => x.type === 'stsd');
    const stsz = kids(stbl.start + 8, stbl.end).find((x) => x.type === 'stsz');
    return { entry: type(stsd.start + 16), samples: dv.getUint32(stsz.start + 16) };
  });
  return { top: top.map((x) => x.type), tracks };
};

// ================================================================ the run at one width
async function run(size, full) {
  const tag = `[${size.width}]`;
  const specs = full
    ? [
        { name: 'red.mp4', secs: 15, colour: hex(COLOURS.red) },
        { name: 'green.mp4', secs: 15, colour: hex(COLOURS.green), cutAt: 7.5, colour2: hex(COLOURS.orange) },
        { name: 'blue.mp4', secs: 15, colour: hex(COLOURS.blue) },
        { name: 'yellow.mp4', secs: 15, colour: hex(COLOURS.yellow), silence: [5, 8] },
      ]
    : [
        { name: 'red-s.mp4', secs: 3, colour: hex(COLOURS.red) },
        { name: 'green-s.mp4', secs: 3, colour: hex(COLOURS.green), cutAt: 1.5, colour2: hex(COLOURS.orange) },
      ];
  // (the clips are drawn before the app is open: a recorder in a page beside a busy one gets a few frames, then none)
  const clips = await timed(`${tag} drawing ${specs.length} clips on the preview`, () => makeClips(specs));
  console.log(`clips: ${clips.map((c) => `${c.name} ${(c.size / 1e6).toFixed(1)} MB ${c.mimeType}`).join(', ')}`);
  const ctx = await browser.newContext({ viewport: size, screen: size, deviceScaleFactor: 1, isMobile: true, hasTouch: true, ...UK, serviceWorkers: 'block', acceptDownloads: true });
  let page = await pair(ctx, size);
  const V = (fn, ...a) => page.evaluate(([f, args]) => window.__ghosty.video[f](...args), [fn, a]);
  const state = () => page.evaluate(() => ({ ...window.__ghosty.video.state(), lastExport: undefined, probe: undefined, forced: undefined }));
  const proj = () => page.evaluate(() => window.__ghosty.video.project());
  const pill = async (t) => {
    await page.click(`.vdpill[data-tool="${t}"]`);
    await page.waitForFunction((x) => document.querySelector('.vd')?.dataset.tool === x, t);
  };
  const key = (text) => page.locator('.vd button').filter({ hasText: new RegExp(`^\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i') }).first();
  const press = async (text) => {
    await key(text).scrollIntoViewIfNeeded();
    await key(text).click();
  };
  const slide = (label, v) =>
    page.locator(`.vd input[aria-label="${label}"]`).first().evaluate((el, x) => {
      el.value = String(x);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, v);
  const line = () => page.locator('.vdline').textContent().then((t) => t ?? '');
  const lineHas = (re, ms = 15000) => until(page, (s) => new RegExp(s.src, s.f).test(document.querySelector('.vdline')?.textContent ?? ''), { src: re.source, f: re.flags }, ms);
  const tile = (i) => page.locator(`.vdtile[data-index="${i}"]`);
  const select = async (i) => {
    await tile(i).scrollIntoViewIfNeeded();
    const id = await tile(i).getAttribute('data-id');
    const b = await tile(i).boundingBox();
    const sb = await page.locator('.vdstrip').boundingBox();
    // (the middle of the part of the tile that is on the screen: a long clip's start may be scrolled out of sight)
    const x0 = Math.max(b.x, sb.x);
    const x1 = Math.min(b.x + b.width, sb.x + sb.width);
    await page.mouse.click((x0 + x1) / 2, b.y + b.height / 2);
    await until(page, (want) => window.__ghosty.video.state().selected === want, id, 5000);
  };
  const seek = (ms) => V('seek', ms);
  const px = (fx, fy) => V('pixel', fx, fy);
  const TOP = [0.5, 0.12];
  const names = async () => (await proj()).main.map((c) => proj.src?.[c.src]?.name);
  const clipNames = async () => {
    const p = await proj();
    return p.main.map((c) => p.sources[c.src].name);
  };
  /** Where each main clip starts on the timeline (this file's own reckoning of the overlaps, to check the app's). */
  const where = async () => {
    const p = await proj();
    let at = 0;
    return p.main.map((c, i) => {
      const prev = p.main[i - 1];
      const tl = prev && prev.next.kind !== 'cut' ? prev.next.len : 0;
      const start = Math.max(0, at - tl);
      const len = (c.out - c.in) / c.speed;
      at = start + len;
      return { name: p.sources[c.src].name, start, len, id: c.id };
    });
  };
  const length = async () => (await state()).length;
  const looked = async (name) => {
    await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined)))).catch(() => undefined);
    const s = await sideways(page, '#pg-video .vd *');
    check(!s.length && !(await wide(page)), `${tag} ${name}: nothing sideways${s.length ? `: ${s.slice(0, 4).join(', ')}` : ''}`);
    const u = await unnamed(page, '#pg-video .vd');
    check(!u.length, `${tag} ${name}: every control has a name VoiceOver reads${u.length ? `: ${u.slice(0, 3).join(' | ')}` : ''}`);
    const sm = await small(page);
    check(!sm.length, `${tag} ${name}: every control is 44 pt${sm.length ? `: ${sm.slice(0, 4).join(' | ')}` : ''}`);
  };
  const say = async (words) => {
    await page.evaluate(() => (location.hash = 'core'));
    await page.waitForSelector('#cin', { state: 'visible', timeout: 15000 });
    await page.fill('#cin', words);
    await page.press('#cin', 'Enter');
  };

  // ---------------------------------------------------------------- (a) MAKE → VIDEO in two taps
  await page.evaluate(() => (location.hash = 'area-make'));
  await page.waitForSelector('#pg-area-make .hubtile[data-id="editors"] .hubpill[data-editor="video"]', { timeout: 15000 });
  const vpill = await page.evaluate(() => {
    const p = document.querySelector('#pg-area-make .hubtile[data-id="editors"] .hubpill[data-editor="video"]');
    return { text: p.textContent.trim(), tag: p.tagName, label: p.getAttribute('aria-label'), ids: [...new Set([...document.querySelectorAll('#pg-area-make .hubtile')].map((e) => e.dataset.id))] };
  });
  check(vpill.tag === 'BUTTON' && vpill.text === 'VIDEO' && /^Open /.test(vpill.label ?? ''), `${tag} (a) MAKE's VIDEO pill: ${JSON.stringify(vpill).slice(0, 200)}`);
  check(vpill.ids.length === 8 && !vpill.ids.includes('video'), `${tag} (a) MAKE shows ${vpill.ids.length} cards, eight are expected with VIDEO folded under EDITORS: ${vpill.ids.join(',')}`);
  const t0 = Date.now();
  await page.click('#pg-area-make .hubtile[data-id="editors"] .hubpill[data-editor="video"]');
  await page.waitForSelector('#pg-video .vd', { timeout: 15000 });
  check(await page.evaluate(() => document.body.dataset.tab) === 'video', `${tag} (a) MAKE → the VIDEO pill opens the editor, two taps from the dock`);
  T[`${tag} first open`] = Date.now() - t0;
  // (the first screen opened in a fresh app also loads its pieces; the budget is for the editor opening once those are in)
  await page.evaluate(() => (location.hash = 'area-make'));
  await page.waitForSelector('#pg-area-make .hubtile[data-id="editors"] .hubpill[data-editor="video"]', { timeout: 15000 });
  await page.waitForTimeout(600);
  const t1 = Date.now();
  await page.click('#pg-area-make .hubtile[data-id="editors"] .hubpill[data-editor="video"]');
  await page.waitForSelector('#pg-video .vd', { timeout: 15000 });
  check(Date.now() - t1 < 2000, `${tag} (a) the editor opens within two seconds (${Date.now() - t1} ms; the first time in this app ${T[`${tag} first open`]} ms)`);
  await say('edit a video');
  check(await until(page, () => document.body.dataset.tab === 'video', null, 15000), `${tag} (a) "edit a video" in the chat opens it`);
  await page.waitForSelector('#pg-video .vd', { timeout: 15000 });

  // ---------------------------------------------------------------- (b) the empty state, then the clips
  const empty1 = (await page.locator('.vdempty1').textContent()) ?? '';
  check(/No video yet\. Add a clip from your phone/.test(empty1) && (await key('ADD A CLIP').count()) === 1, `${tag} (b) the empty state says so in a line and offers ADD A CLIP: "${empty1}"`);
  check(/stay on this phone, untouched/.test((await page.locator('.vdempty .vdnote').textContent()) ?? ''), `${tag} (b) it says the clips stay on the phone, untouched`);
  await looked('the empty editor');
  await page.screenshot({ path: `${out}/video-${size.width}-empty.png` });

  const fileInput = '#pg-video .vdsheet > .vd > input[type=file]';
  const firstWords = Date.now();
  await page.setInputFiles(fileInput, clips.slice(0, 1).map(({ name, mimeType, buffer }) => ({ name, mimeType, buffer })));
  check(await until(page, () => /Opening|first clip is in/.test(document.querySelector('.vdline')?.textContent ?? ''), null, 4000), `${tag} (b) adding a clip says what it is doing within two seconds (${Date.now() - firstWords} ms)`);
  await timed(`${tag} (b) clip 1 added`, () => page.waitForSelector('.vdtile', { timeout: 60000 }));
  await page.setInputFiles(fileInput, clips.slice(1).map(({ name, mimeType, buffer }) => ({ name, mimeType, buffer })));
  await timed(`${tag} (b) the other clips added`, () => until(page, (n) => document.querySelectorAll('.vdtile').length >= n, clips.length, 120000));
  check((await page.locator('.vdtile').count()) === clips.length, `${tag} (b) the strip shows ${clips.length} clips`);
  await until(page, (n) => [...document.querySelectorAll('.vdtile')].filter((e) => /url\(/.test(e.style.backgroundImage)).length >= n, clips.length, 8000);
  const posters = await page.$$eval('.vdtile', (els) => els.filter((e) => /url\(/.test(e.style.backgroundImage)).length);
  check(posters === clips.length, `${tag} (b) each shows its poster frame (${posters})`);
  const st0 = await state();
  const sumLen = clips.length * (full ? 15000 : 3000);
  check(Math.abs(st0.length - sumLen) < 600 * clips.length, `${tag} (b) the length said, ${st0.lengthSaid} (${st0.length} ms) is the clips' (${sumLen} ms)`);
  check(/^\d:\d\d\.\d \/ \d:\d\d\.\d$/.test((await page.locator('.vdtime').textContent()) ?? ''), `${tag} (b) the time reads as a clock`);
  // (p) the picture upright at its aspect
  const ar = await page.$eval('.vdcanvas', (c) => { const r = c.getBoundingClientRect(); return { r: r.width / r.height, w: c.width, h: c.height, tr: getComputedStyle(c).transform }; });
  check(Math.abs(ar.r - 16 / 9) < 0.03 && ar.tr === 'none', `${tag} (p) the picture is upright at its own 16:9 (${ar.r.toFixed(2)})`);
  const first = await px(...TOP);
  check(near(first, COLOURS.red, 25), `${tag} (b) the first frame is the first clip's colour (${first})`);
  check(await page.$eval('.vdcanvas', (c) => c.height <= c.width ? (() => { const g = document.createElement('canvas'); return true; })() : false), `${tag} (p) landscape stays landscape`);
  await looked('four clips on the strip');
  await page.screenshot({ path: `${out}/video-${size.width}-strip.png` });

  // ---------------------------------------------------------------- (c) TRIM by the handle, SPLIT, SPEED
  await pill('trim');
  const len0 = await length();
  await select(0);
  const h = page.locator('.vdtile.on .vdhandle.out');
  await h.scrollIntoViewIfNeeded();
  const hb = await h.boundingBox();
  const tTrim = Date.now();
  await page.mouse.move(hb.x + 22, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + 22 - 15, hb.y + hb.height / 2, { steps: 4 });
  await page.mouse.move(hb.x + 22 - 30, hb.y + hb.height / 2, { steps: 4 });
  await page.mouse.up();
  await until(page, (l) => window.__ghosty.video.state().length < l - 200, len0, 5000);
  const len1 = await length();
  check(len1 < len0 - 300 && len1 > len0 - 900, `${tag} (c) TRIM by the end handle takes about half a second off: ${len0} → ${len1} ms (${Date.now() - tTrim} ms)`);
  check(/Trimmed: [\d.]+ s on the timeline/.test(await line()) || /In \d:\d\d\.\d, out/.test(await line()), `${tag} (c) the in and out are said: "${await line()}"`);
  const trimmed = (await proj()).main[0];
  check(trimmed.in === 0 && trimmed.out < clips.length * 0 + (full ? 15000 : 3000) - 300, `${tag} (c) the clip's out moved, its in did not (${trimmed.in}–${trimmed.out})`);
  const sayTrim = (await page.locator('.vdtray .vdsay').first().textContent()) ?? '';
  check(/In 0:00\.0 · out 0:\d\d\.\d · [\d.]+ s on the timeline/.test(sayTrim), `${tag} (c) the tray says the times: "${sayTrim}"`);
  // the steppers, in 44 pt keys
  await page.locator('.vdstep', { hasText: 'End' }).locator('button').first().click();
  check((await proj()).main[0].out === trimmed.out - 500, `${tag} (c) the End stepper takes another half second`);
  await page.locator('.vdstep', { hasText: 'End' }).locator('button').nth(1).click();

  lapAt = Date.now();
  if (full) {
    // ------------------------------------------------------------ (k) SCENES finds the cut inside the second clip, and SPLIT AT THE CUT
    await select(1);
    await pill('scenes');
    const w1 = await where();
    await timed('SCENES looking for cuts in a 15 s clip', async () => {
      await press('LOOK FOR CUTS IN THIS CLIP');
      return lineHas(/I found \d+ cuts?/, 90000);
    });
    const cuts = (await state()).cuts;
    check(cuts.length === 1 && Math.abs(cuts[0] - w1[1].start - 7500) < 900, `${tag} (k) SCENES finds the one cut about 7.5 s into the clip: ${cuts[0] - w1[1].start} ms`);
    const nBefore = (await proj()).main.length;
    await press(`SPLIT AT THE 1 CUT`);
    check((await proj()).main.length === nBefore + 1, `${tag} (k) SPLIT AT THE CUTS makes two of it`);
    check(Math.abs((await length()) - len1) < 60, `${tag} (k) the split leaves the video as long as it was`);
    await stopAt('scenes');
    // after the split: [red, green, orange, blue, yellow]
    // ---------------------------------------------------------- (c) SPEED 2× halves the length said, UNDO puts it back
    await select(4);
    await pill('speed');
    const lenS = await length();
    await page.locator('.vdchoice', { hasText: '2×' }).first().click();
    const sp = (await page.locator('.vdtray .vdsay').first().textContent()) ?? '';
    check(/2× makes this clip 7\.\d s \(it is 7\.\d s\)|2× makes this clip 7\.\d s/.test(sp) || /7\.\d s/.test(sp), `${tag} (c) SPEED 2× says the length that results: "${sp}"`);
    const lenS2 = await length();
    check(Math.abs((lenS - lenS2) - 7500) < 500, `${tag} (c) a 15 s clip at 2× is half as long: ${lenS} → ${lenS2} ms`);
    await page.click('.vdundo');
    check(Math.abs((await length()) - lenS) < 20, `${tag} (c) UNDO gives the speed back`);
    // ---------------------------------------------------------- (c) SPLIT at the playhead makes two; UNDO
    const wS = await where();
    await select(4);
    await seek(wS[4].start + 5000);
    await pill('split');
    const nS = (await proj()).main.length;
    await press('SPLIT AT THE PLAYHEAD');
    check((await proj()).main.length === nS + 1 && /Split at 0:\d\d\.\d: now \d clips/.test(await line()), `${tag} (c) SPLIT at the playhead makes two: "${await line()}"`);
    await page.click('.vdundo');
    check((await proj()).main.length === nS, `${tag} (c) UNDO takes the split back`);
    // ---------------------------------------------------------- (d) ORDER by key and by drag
    await select(4);
    await pill('order');
    await press('MOVE LEFT');
    let order = await clipNames();
    check(order.join() === 'red.mp4,green.mp4,green.mp4,yellow.mp4,blue.mp4', `${tag} (d) MOVE LEFT puts the clip one place earlier: ${order.join(' ')}`);
    // by drag: zoom the time out so the clips fit under the finger, then drag the first one past the second
    for (let i = 0; i < 4; i++) await page.click('.vdz[aria-label="Zoom the time out"]');
    await page.locator('.vdstrip').evaluate((e) => (e.scrollLeft = 0));
    const tb = await tile(0).boundingBox();
    const sb = await page.locator('.vdstrip').boundingBox();
    await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2);
    await page.mouse.down();
    const target = Math.min(sb.x + sb.width - 70, tb.x + tb.width / 2 + tb.width * 1.05);
    await page.mouse.move(tb.x + tb.width / 2 + 20, tb.y + tb.height / 2, { steps: 3 });
    await page.mouse.move(target, tb.y + tb.height / 2, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    order = await clipNames();
    check(order[0] !== 'red.mp4' && order.indexOf('red.mp4') >= 1, `${tag} (d) a press and drag moves a clip along: ${order.join(' ')}`);
    await page.click('.vdundo');
    check((await clipNames())[0] === 'red.mp4', `${tag} (d) UNDO puts the dragged clip back`);
    for (let i = 0; i < 4; i++) await page.click('.vdz[aria-label="Zoom the time in"]');

    await stopAt('order');
    // ---------------------------------------------------------- (e) TRANSITIONS: a crossfade whose middle blends the two colours, and a wipe
    await select(0);
    await pill('transition');
    await page.locator('.vdchoice', { hasText: 'CROSSFADE' }).click();
    let wh = await where();
    await seek(wh[1].start + 500);
    const mid = await px(...TOP);
    const expectMid = COLOURS.red.map((v, i) => (v + COLOURS.green[i]) / 2);
    check(near(mid, expectMid, 38) && mid[0] < COLOURS.red[0] - 40 && mid[1] > COLOURS.red[1] + 40, `${tag} (e) at a crossfade's middle the picture is between red and green: ${mid} (${expectMid})`);
    await select(2);
    await pill('transition');
    await page.locator('.vdchoice', { hasText: 'WIPE' }).click();
    wh = await where();
    await seek(wh[3].start + 500);
    const wl = await px(0.2, 0.12);
    const wr = await px(0.8, 0.12);
    check(near(wl, COLOURS.yellow, 40) && near(wr, COLOURS.orange, 40), `${tag} (e) at a wipe's middle the new clip is on the left (${wl}) and the old on the right (${wr})`);
    const strips = await page.locator('.vdtr').count();
    check(strips === 2, `${tag} (e) the strip marks each transition (${strips})`);
    await page.screenshot({ path: `${out}/video-${size.width}-transitions.png` });

    await stopAt('transitions');
    // ---------------------------------------------------------- (f) GRADE: exposure up brightens; a LUT changes it as the LUT says; hold shows the original
    wh = await where();
    const tA = wh[0].start + 3000;
    await select(0);
    await seek(tA);
    const plain = await px(...TOP);
    await pill('grade');
    await slide('Exposure', 1);
    await page.waitForTimeout(300);
    await seek(tA);
    const bright = await px(...TOP);
    check(bright[0] + bright[1] + bright[2] > plain[0] + plain[1] + plain[2] + 30, `${tag} (f) exposure up brightens a sampled pixel: ${plain} → ${bright}`);
    const holdB = key('HOLD TO SEE THE ORIGINAL');
    await holdB.scrollIntoViewIfNeeded();
    const hbb = await holdB.boundingBox();
    await page.mouse.move(hbb.x + hbb.width / 2, hbb.y + hbb.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(200);
    const held = await px(...TOP);
    await page.mouse.up();
    await page.waitForTimeout(200);
    const released = await px(...TOP);
    check(near(held, plain, 8) && near(released, bright, 8), `${tag} (f) holding the key shows the original (${held}) and letting go brings the grade back (${released})`);
    await select(1);
    wh = await where();
    await seek(wh[1].start + 3000);
    const plain2 = await px(...TOP);
    await page.locator('.vdfile input[data-pick="lut"]').setInputFiles({ name: 'invert.cube', mimeType: 'text/plain', buffer: Buffer.from(INVERT_CUBE) });
    await until(page, () => !!window.__ghosty.video.project().main.find((c) => c.lut), null, 8000);
    await seek(wh[1].start + 3000);
    const lutPx = await px(...TOP);
    const inverted = plain2.slice(0, 3).map((v) => 255 - v);
    check(near(lutPx, inverted, 22), `${tag} (f) a LUT that inverts changes the pixel as it says: ${plain2} → ${lutPx} (${inverted})`);
    await press('COPY THE GRADE TO EVERY CLIP');
    const pc = await proj();
    check(pc.main.every((c) => c.lut && c.lut === pc.main[1].lut), `${tag} (f) COPY THE GRADE puts the LUT on every clip (${pc.main.length})`);
    await page.click('.vdundo');
    check((await proj()).main.filter((c) => c.lut).length === 1, `${tag} (f) UNDO takes the copy back, so two clips are graded`);

    await stopAt('grade');
    // ---------------------------------------------------------- (g) TITLE, typed in the line above the picture, drawn at its time and not before
    await seek(2000);
    await pill('title');
    await press('ADD A TITLE AT THE PLAYHEAD');
    const tin = page.locator('.vdtitleline input');
    check(await tin.isVisible() && /type its words in the line above the picture/.test(await line()), `${tag} (g) the title's words are typed in a line above the picture`);
    await tin.fill('Benchmark');
    await tin.press('Tab');
    await until(page, () => window.__ghosty.video.project().overlays.some((o) => o.title?.text === 'Benchmark'), null, 5000);
    await seek(2600);
    const inText = await V('whiteCount', 0.7, 0.86);
    await seek(900);
    const before = await V('whiteCount', 0.7, 0.86);
    await seek(6500);
    const after = await V('whiteCount', 0.7, 0.86);
    check(inText > 150 && before < 30 && after < 30, `${tag} (g) the title is drawn at its time (${inText} bright pixels) and not before (${before}) or after (${after})`);

    await stopAt('title');
    // ---------------------------------------------------------- (h) MUSIC with a gain, a fed voice-over, DUCK lowering the music under it
    await seek(0);
    await pill('sound');
    await page.locator('.vdfile input[data-pick="music"]').setInputFiles({ name: 'tune.wav', mimeType: 'audio/wav', buffer: wav(440, 20) });
    check(await until(page, () => window.__ghosty.video.project().music.length === 1, null, 20000), `${tag} (h) MUSIC added from a file`);
    await slide('Music level', 0.6);
    check(Math.abs((await proj()).music[0].gain - 0.6) < 0.01, `${tag} (h) its level is set to 60%`);
    await seek(10000);
    await page.locator('.vdfile input[data-pick="voice"]').setInputFiles({ name: 'voice.wav', mimeType: 'audio/wav', buffer: wav(880, 3) });
    check(await until(page, () => window.__ghosty.video.project().voice.length === 1, null, 20000), `${tag} (h) a voice-over fed as a WAV lands at the playhead`);
    check(/Voice-over added at 0:10\.\d/.test(await line()) && (await page.locator('.vdinline', { hasText: 'UNDO' }).count()) === 1, `${tag} (h) it says so, with UNDO in the line: "${await line()}"`);
    const gOut = await V('plan', 'music', 3000);
    const gUnder = await V('plan', 'music', 11500);
    check(gOut > 0.55 && gUnder < gOut * 0.3, `${tag} (h) DUCK: the music's gain is ${gOut.toFixed(2)} outside the voice and ${gUnder.toFixed(2)} under it`);
    await seek(11000);
    await V('play');
    await page.waitForTimeout(700);
    const nodeUnder = await V('nodeGain', 'music');
    await V('pause');
    await seek(4000);
    await V('play');
    await page.waitForTimeout(700);
    const nodeOut = await V('nodeGain', 'music');
    await V('pause');
    check(nodeOut != null && nodeUnder != null && nodeUnder < nodeOut * 0.5, `${tag} (h) the mixer's music node reads ${nodeOut?.toFixed?.(2)} in the open and ${nodeUnder?.toFixed?.(2)} under the voice`);
    await slide('Music drops under your voice by', 0);
    check(Math.abs((await V('plan', 'music', 11500)) - 0.6) < 0.02, `${tag} (h) with the ducking off the music keeps its level under the voice`);
    await slide('Music drops under your voice by', 12);

    await stopAt('sound');
    // ---------------------------------------------------------- (i) SUBTITLES typed, drawn at their times, saved as .srt and read back
    await pill('subtitles');
    await seek(5000);
    await press('ADD A LINE AT THE PLAYHEAD');
    await page.locator('.vdcue').first().fill('Hello from the benchmark');
    await page.locator('.vdcue').first().press('Tab');
    await seek(8000);
    await press('ADD A LINE AT THE PLAYHEAD');
    await page.locator('.vdcue').nth(1).fill('Second line of words');
    await page.locator('.vdcue').nth(1).press('Tab');
    const subs = (await proj()).subs;
    check(subs.length === 2 && subs[0].text === 'Hello from the benchmark' && subs[1].text === 'Second line of words', `${tag} (i) two lines typed, each editable in place`);
    await seek(5500);
    const sOn = await V('whiteCount', 0.84, 0.96);
    await seek(7800);
    const sOff = await V('whiteCount', 0.84, 0.96);
    check(sOn > 120 && sOff < 25, `${tag} (i) a subtitle is drawn at its time (${sOn}) and not between (${sOff})`);
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), press('SAVE .SRT')]);
    const srt = readFileSync(await dl.path(), 'utf8');
    const cues = [...srt.matchAll(/(\d+)\n(\d\d):(\d\d):(\d\d),(\d{3}) --> (\d\d):(\d\d):(\d\d),(\d{3})\n([^\n]+)/g)].map((m) => ({ n: +m[1], start: +m[2] * 3600000 + +m[3] * 60000 + +m[4] * 1000 + +m[5], text: m[10] }));
    check(dl.suggestedFilename().endsWith('.srt') && cues.length === 2 && cues[0].text === 'Hello from the benchmark' && Math.abs(cues[0].start - subs[0].start) < 2 && cues[1].text === 'Second line of words', `${tag} (i) SAVE .SRT gives a file whose cues read back (${cues.map((c) => `${c.start} "${c.text}"`).join(', ')})`);

    await stopAt('subs');
    // ---------------------------------------------------------- (j) OVERLAY with a chroma key: the keyed colour samples transparent
    await seek(16000);
    await pill('overlay');
    await page.locator('.vdfile input[data-pick="pip"]').setInputFiles({ name: clips[0].name, mimeType: clips[0].mimeType, buffer: clips[0].buffer });
    check(await until(page, () => window.__ghosty.video.project().overlays.some((o) => o.clip), null, 30000), `${tag} (j) a picture in picture is added`);
    await seek(16500);
    const under = await px(0.2, 0.12);
    const pipSpot = [0.66, 0.66];
    const keyed0 = await px(...pipSpot);
    check(near(keyed0, COLOURS.red, 30), `${tag} (j) the picture in the corner is red before the key: ${keyed0}`);
    await press('KEY A COLOUR OUT');
    await page.locator('.vdcanvas').scrollIntoViewIfNeeded();
    const cb = await page.locator('.vdcanvas').boundingBox();
    await page.mouse.click(cb.x + cb.width * pipSpot[0], cb.y + cb.height * pipSpot[1]);
    check(await until(page, () => window.__ghosty.video.project().overlays.some((o) => o.clip?.chroma), null, 8000), `${tag} (j) a tap on the picture picks the colour to key`);
    await seek(16500);
    const keyed1 = await px(...pipSpot);
    check(near(keyed1, under, 30) && !near(keyed1, COLOURS.red, 60), `${tag} (j) the keyed colour is transparent: the clip underneath shows through (${keyed1} against ${under})`);

    await stopAt('overlay');
    // ---------------------------------------------------------- (k) QUIET finds the drawn silence and cuts it
    await pill('quiet');
    const lenQ = await length();
    await timed('QUIET listening for pauses', async () => {
      await press('LISTEN FOR PAUSES');
      return lineHas(/I found \d+ pauses?/, 60000);
    });
    const pz = (await state()).pauses;
    const saved = pz.reduce((n, p) => n + (p.to - p.from), 0);
    check(pz.length >= 1 && saved > 1800 && saved < 3100, `${tag} (k) QUIET finds the silence drawn into the last clip (${pz.length} pause, ${saved} ms)`);
    check(/cutting them saves \d(?:\.\d)? s/.test(await line()), `${tag} (k) it says the count and the time saved: "${await line()}"`);
    await press(`CUT THE ${pz.length} PAUSE${pz.length === 1 ? '' : 'S'} (SAVES ${(Math.round(saved / 100) / 10).toString().replace(/^(\d)$/, '$1')} S)`).catch(async () => page.locator('.vdtray .vdkey', { hasText: /CUT THE/ }).click());
    const lenQ2 = await length();
    check(Math.abs(lenQ - lenQ2 - saved) < 40, `${tag} (k) CUT THE PAUSES takes out just what it said: ${lenQ} → ${lenQ2} ms`);

    await stopAt('quiet');
    // ---------------------------------------------------------- (l) EXPORT
    await pill('export');
    const lenX = await length();
    const pathSaid = await until(page, () => !/Checking/.test(document.querySelector('.vdpath')?.textContent ?? 'Checking'), null, 10000);
    const info = await state();
    check(pathSaid && /frame by frame, as H\.264 and AAC|Made in real time: about \d+ seconds, as \.(mp4|webm)/.test(info.exportSaid), `${tag} (l) which path this phone takes is said before the tap: "${info.exportSaid}" (path ${info.exportPath})`);
    const sizeSaid = (await page.locator('.vdsize').textContent()) ?? '';
    check(/will be about \d+(\.\d)? MB/.test(sizeSaid), `${tag} (l) the size is said before the tap, with the word about: "${sizeSaid}"`);
    check(/Wide 1080p \(16:9, 1920 × 1080\), 30 frames a second/.test((await page.locator('.vdtray .vdsay').nth(0).textContent()) ?? ''), `${tag} (l) 1080p 16:9 is the preset`);
    await page.locator('.vdchoice', { hasText: 'TALL STORY' }).click();
    check(/1080 × 1920/.test((await page.locator('.vdtray .vdsay').nth(0).textContent()) ?? ''), `${tag} (l) the 9:16 preset is 1080 × 1920`);
    await page.locator('.vdchoice', { hasText: 'WIDE 1080P' }).click();
    const tEx = Date.now();
    await page.locator('.vdexport').scrollIntoViewIfNeeded();
    await page.locator('.vdexport').click();
    const progressSeen = await until(page, () => !!document.querySelector('.vdprog:not([hidden])') && /\d/.test(document.querySelector('.vdprogwords')?.textContent ?? ''), null, 60000);
    T['export first progress'] = Date.now() - tEx;
    const words1 = (await page.locator('.vdprogwords').textContent()) ?? '';
    check(progressSeen && /frames|of \d+ s/.test(words1) && /left|moment/.test(words1), `${tag} (l) the progress shows the frames or seconds done and the time left: "${words1}" (${T['export first progress']} ms)`);
    const done = await until(page, () => !!window.__ghosty.video.state().exportDone, null, 480000);
    T['export'] = Date.now() - tEx;
    check(done, `${tag} (l) the export finishes (${Math.round(T['export'] / 1000)} s)`);
    if (done) {
      const ex = (await state()).exportDone;
      const after1 = (await page.locator('.vdresultline').textContent()) ?? '';
      check(new RegExp(`${(ex.bytes / 1e6).toFixed(1)} MB`).test(after1.replace(/(\d)\.0 MB/, '$1.0 MB')) || /\d MB|\d KB/.test(after1), `${tag} (l) the size is said after, measured: "${after1}"`);
      console.log(`export: path ${ex.path}, ${ex.ext}, ${ex.w}×${ex.h}, ${ex.bytes} bytes, ${ex.frames} frames, ${ex.audioPackets} audio packets, ${Math.round(ex.seconds)} s, timeline ${ex.durationMs} ms`);
      const decoded = await page.evaluate(async () => {
        const blob = window.__ghosty.video.lastBlob('export');
        const v = document.createElement('video');
        v.muted = true;
        v.preload = 'auto';
        v.src = URL.createObjectURL(blob);
        await new Promise((ok, bad) => { v.onloadeddata = ok; v.onerror = () => bad(new Error('the page cannot decode the exported file')); setTimeout(() => bad(new Error('timeout')), 20000); });
        if (!Number.isFinite(v.duration)) {
          v.currentTime = 1e9;
          await new Promise((r) => (v.onseeked = r));
        }
        const dur = v.duration * 1000;
        v.currentTime = 30;
        await new Promise((r) => (v.onseeked = r));
        const c = document.createElement('canvas');
        c.width = 64;
        c.height = 36;
        const g = c.getContext('2d');
        g.drawImage(v, 0, 0, 64, 36);
        const d = g.getImageData(32, 4, 1, 1).data;
        return { dur, w: v.videoWidth, h: v.videoHeight, px: [d[0], d[1], d[2]], type: blob.type, size: blob.size };
      });
      const lenNow = (await state()).length;
      check(Math.abs(decoded.dur - lenNow) <= 100, `${tag} (l) the exported file decodes in the page, its duration ${Math.round(decoded.dur)} ms within 100 ms of the timeline's ${lenNow} ms`);
      check(decoded.w === 1920 && decoded.h === 1080, `${tag} (l) at 1920 × 1080 (${decoded.w} × ${decoded.h})`);
      check(near(decoded.px, COLOURS.yellow, 45), `${tag} (l) the frame at 30 s is the expected clip's colour, yellow: ${decoded.px}`);
      const said = (await page.evaluate(() => window.__ghosty.video.state().sizeSaid)) ?? 0;
      const ratio = Math.max(said, ex.bytes) / Math.max(1, Math.min(said, ex.bytes));
      const note = ((await page.locator('.vdsizenote').textContent().catch(() => '')) ?? '').trim();
      console.log(`size said ${said} bytes, measured ${ex.bytes} bytes (x${ratio.toFixed(1)}); line: "${note}"`);
      check(ratio <= 2 || /^(Smaller|Bigger) than I said .*chose its own rate\.$/.test(note), `${tag} (l) the size said (${said}) and measured (${ex.bytes}) are within a factor of two, or the sheet says they are not: "${note}"`);
      check(decoded.type === 'video/mp4' || decoded.type === 'video/webm', `${tag} (l) the file's type is said by the phone: ${decoded.type}, ${decoded.size} bytes`);
      if (ex.path === 'webcodecs') {
        const walk = await page.evaluate(WALK, 'export');
        check(walk.tracks.length === 2 && walk.tracks[0].entry === 'avc1' && walk.tracks[1].entry === 'mp4a' && walk.tracks[0].samples === ex.frames && walk.tracks[1].samples === ex.audioPackets, `${tag} (l) the moov read by the spec's own box walk: ${JSON.stringify(walk.tracks)}`);
      } else {
        console.log('note: this browser has no AAC encoder, so the export took the MediaRecorder path; the muxer is proved below on a video-only file and by the brain test');
      }
    }
    // the app's own muxer, proved in the browser: a short video-only file through the WebCodecs writer, read back by the page and by this file's box walk
    const vc = await page.evaluate(() => ({ ve: typeof VideoEncoder })).catch(() => ({ ve: 'undefined' }));
    if (vc.ve === 'function') {
      const mp = await page.evaluate(() => window.__ghosty.video.muxProbe({ preset: 'story', long: 1920, ms: 2000 }));
      const pr = await page.evaluate(async () => {
        const blob = window.__ghosty.video.lastBlob('probe');
        const v = document.createElement('video');
        v.muted = true;
        v.src = URL.createObjectURL(blob);
        await new Promise((ok, bad) => { v.onloadeddata = ok; v.onerror = () => bad(new Error('undecodable')); setTimeout(() => bad(new Error('timeout')), 20000); });
        return { dur: v.duration * 1000, w: v.videoWidth, h: v.videoHeight };
      }).catch((e) => ({ err: String(e) }));
      check(mp && mp.w === 1080 && mp.h === 1920 && !pr.err && Math.abs(pr.dur - 2000) < 120 && pr.w === 1080 && pr.h === 1920, `${tag} (l) the app's own muxer writes a file the page decodes: ${mp?.w}×${mp?.h}, ${mp?.frames} frames, ${Math.round(pr.dur)} ms (a 9:16 preset's size)`);
      const walk = await page.evaluate(WALK, 'probe');
      check(walk.tracks.length === 1 && walk.tracks[0].entry === 'avc1' && walk.tracks[0].samples === mp.frames, `${tag} (l) its moov by the box walk: one avc1 track of ${walk.tracks[0]?.samples} samples = ${mp.frames} frames`);
    } else console.log('note: this browser has no VideoEncoder; the muxer is proved by the brain test alone');

    await stopAt('export');
    // ---------------------------------------------------------- (m) autosave said once; the project reopens at its playhead; UNDO after a delete
    check((await state()).savedSaid === 1, `${tag} (m) the autosave was said once (${(await state()).savedSaid})`);
    await seek(12000);
    await V('pause');
    await page.waitForTimeout(600);
    const nClips = (await proj()).main.length;
    page = await page.reload({ waitUntil: 'domcontentloaded' }).then(async () => {
      await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 }).catch(() => undefined);
      return page;
    });
    await page.evaluate(() => (location.hash = 'video'));
    await page.waitForSelector('.vdtile', { timeout: 30000 });
    await until(page, () => window.__ghosty.video.time() > 11000, null, 20000);
    const t12 = await V('time');
    check(Math.abs(t12 - 12000) < 120 && (await proj()).main.length === nClips, `${tag} (m) the project reopens where it was left: ${(await proj()).main.length} clips, playhead ${Math.round(t12)} ms`);
    const pBefore = (await proj()).main.length;
    await select(1);
    await pill('order');
    await press('DELETE CLIP');
    check((await proj()).main.length === pBefore - 1 && (await page.locator('.vdinline', { hasText: 'UNDO' }).count()) === 1, `${tag} (m) DELETE CLIP takes a clip out and offers UNDO`);
    await page.locator('.vdinline', { hasText: 'UNDO' }).click();
    await page.waitForTimeout(300);
    check((await proj()).main.length === pBefore, `${tag} (m) UNDO after a delete puts it back`);

    // ---------------------------------------------------------- (n) offline: everything but subtitles works, and the one line says so; the brain away
    await ctx.setOffline(true);
    check(await until(page, () => window.__ghosty.video.state().offlineSaid, null, 8000) && /offline: everything here works on the phone except writing subtitles/.test(await line()), `${tag} (n) offline, the one line says everything works but the subtitles: "${await line()}"`);
    await pill('trim');
    await select(0);
    const o0 = (await proj()).main[0].out;
    await page.locator('.vdstep', { hasText: 'End' }).locator('button').first().click();
    check((await proj()).main[0].out === o0 - 500, `${tag} (n) trimming still works offline`);
    await pill('subtitles');
    await press('FROM MY BRAIN');
    check(/You’re offline, so my brain can’t be reached/.test(await line()), `${tag} (n) the subtitles line offline: "${await line()}"`);
    await ctx.setOffline(false);
    await page.route('**/api/stt', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"away"}' }));
    let askedLine = false;
    for (let i = 0; i < 6 && !askedLine; i++) {
      await press('FROM MY BRAIN');
      askedLine = (await page.locator('.vdask').textContent().catch(() => '')).includes('Your clip’s sound goes to your brain to be written down; nothing else leaves');
      if (!askedLine) await page.waitForTimeout(2500);
    }
    check(askedLine, `${tag} (i) before the first piece goes, the sound's way is said once: "Your clip’s sound goes to your brain to be written down; nothing else leaves"`);
    let sent = 0;
    page.on('request', (r) => r.url().includes('/api/stt') && sent++);
    check(sent === 0, `${tag} (i) nothing has gone before he says GO ON`);
    await press('GO ON');
    check(await lineHas(/Your brain is away; type them, or try when it is back/, 30000), `${tag} (n) the brain away: "${await line()}"`);
    await page.unroute('**/api/stt');
    await page.route('**/api/stt', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"text":"This is a first pass of the words in the clip so that you can read them once"}' }));
    const cuesBefore = (await proj()).subs.length;
    await press('FROM MY BRAIN');
    check(await lineHas(/first pass from your brain: read them once/, 60000) && (await proj()).subs.length > cuesBefore, `${tag} (i) the brain's first pass lands as cues he can edit, with "a first pass from your brain: read them once"`);
    await page.unroute('**/api/stt');
    check((await page.locator('.vdask').textContent()) === '', `${tag} (i) the sound's-way line is not said a second time`);
    await looked('the finished video');
    await page.screenshot({ path: `${out}/video-${size.width}-finished.png` });

    // ---------------------------------------------------------- (o) the Library's OPEN IN VIDEO
    const nOpen = (await proj()).main.length;
    await page.evaluate(() => (location.hash = 'library'));
    await page.waitForSelector('.libadd input[type=file]', { state: 'attached', timeout: 20000 });
    await openSection(page, 'library', 'Add');
    await page.setInputFiles('.libadd input[type=file]', { name: 'lib-clip.mp4', mimeType: clips[3].mimeType, buffer: clips[3].buffer });
    await page.waitForSelector('.liblog button:has-text("OPEN IN VIDEO")', { timeout: 15000 });
    check(true, `${tag} (o) a video file in the Library offers OPEN IN VIDEO`);
    await page.click('.liblog button:has-text("OPEN IN VIDEO")');
    check(await until(page, (n) => document.body.dataset.tab === 'video' && window.__ghosty.video.project().main.length === n + 1, nOpen, 40000), `${tag} (o) OPEN IN VIDEO lands in the editor with the clip added`);
    // BODY 21: nothing is cut, every control is 44 pt
    await say('bigger text');
    await page.waitForTimeout(300);
    await say('bigger text');
    await until(page, () => document.documentElement.dataset.body === '21', null, 8000);
    await page.evaluate(() => (location.hash = 'video'));
    await page.waitForSelector('.vdtile', { timeout: 20000 });
    for (const t of ['trim', 'grade', 'sound', 'export', 'project']) {
      await pill(t);
      const cu = await cut(page);
      check(!cu.length, `${tag} (p) at BODY 21 the ${t} tray cuts no words: ${cu.join(' | ')}`);
    }
    await looked('BODY 21');
    await page.screenshot({ path: `${out}/video-${size.width}-body21.png` });
  } else {
    // ---------------------------------------------------------------- the 390 run: the screen at the phone's smaller width
    await select(0);
    await pill('speed');
    const lenS = await length();
    await page.locator('.vdchoice', { hasText: '2×' }).first().click();
    check(Math.abs(lenS - (await length()) - lenS / 4) < 400, `${tag} (c) SPEED 2× halves the selected clip's length (one of two equal clips: a quarter off the whole)`);
    await page.click('.vdundo');
    for (const t of ['trim', 'split', 'speed', 'order', 'transition', 'title', 'grade', 'sound', 'subtitles', 'overlay', 'move', 'crop', 'scenes', 'quiet', 'export', 'project']) {
      await pill(t);
      await looked(`the ${t} tray`);
    }
    await pill('grade');
    await seek(1000);
    const a = await px(...TOP);
    await slide('Exposure', 1);
    const b = await px(...TOP);
    check(b[0] + b[1] + b[2] > a[0] + a[1] + a[2] + 20, `${tag} (f) exposure up brightens a sampled pixel`);
    await page.screenshot({ path: `${out}/video-${size.width}-grade.png` });
    const m = await page.evaluate(() => ({ still: window.__ghosty.video.still() }));
    void m;
    await say('bigger text');
    await page.waitForTimeout(300);
    await say('bigger text');
    await until(page, () => document.documentElement.dataset.body === '21', null, 8000);
    await page.evaluate(() => (location.hash = 'video'));
    await page.waitForSelector('.vdtile', { timeout: 20000 });
    for (const t of ['trim', 'grade', 'export']) {
      await pill(t);
      const cu = await cut(page);
      check(!cu.length, `${tag} (p) at BODY 21 the ${t} tray cuts no words: ${cu.join(' | ')}`);
    }
    await looked('BODY 21');
  }
  await ctx.close();
}

await run({ width: 440, height: 956 }, true);
await run({ width: 390, height: 844 }, false);
console.log(`\ntimes: ${JSON.stringify(T)}`);
await browser.close();
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n${problems.map((p) => ` - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log('\nvideo: all good');
