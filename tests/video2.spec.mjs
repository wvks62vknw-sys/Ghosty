// BRIEF-EDITOR-VIDEO-2: STEADY, THE BEST CLIPS, ON THE BEAT, REVERSE and a SPEED RAMP on the preview, at 440 × 956 and 390 × 844. It needs
// GL and the recorder: run it WITHOUT NO_GL_SHOTS (the machine's software GL makes it slow), alone:
//   BASE=http://localhost:8839 timeout 1700 node tests/video2.spec.mjs tests/.shots
// Clips are drawn and recorded here on the preview (kept in the shots folder, never committed): a textured scene with a camera shake (a
// shift and a small turn at every frame) and a white mark that sits still in the scene; four 3 s clips of which one is blurred and one
// dark; and a click track at 120 beats a minute made as a WAV in this file. Each measure is this file's own: the mark's centre as drawn,
// its spread over a handful of frames before and after STEADY; the picked list; the tempo said; the cuts' moves; the frame at the start
// of a reversed clip against the original's end; the length a ramp says.
import { launch, webkitNoise } from './browser.mjs';
import { UK } from './nav.mjs';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';

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
const timed = async (name, fn) => {
  const t0 = Date.now();
  const r = await fn();
  T[name] = Date.now() - t0;
  console.log(`time ${name}: ${T[name]} ms`);
  return r;
};

// ---------------------------------------------------------------- the click track (a mono WAV, 120 beats a minute, a 2 kHz burst on each beat)
function clickWav(bpm, secs, rate = 22050, offset = 0.12) {
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
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = 0.02 * Math.sin((2 * Math.PI * 110 * i) / rate);
  for (let t = offset; t < secs - 0.05; t += 60 / bpm) {
    const s0 = Math.round(t * rate);
    for (let k = 0; k < 440 && s0 + k < n; k++) x[s0 + k] += 0.8 * Math.exp(-k / 120) * Math.sin((2 * Math.PI * 2000 * k) / rate);
  }
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x[i])) * 32767), 44 + i * 2);
  return b;
}

// ---------------------------------------------------------------- the clips this spec draws
/** Each clip: a textured scene (a fixed pattern of rectangles that are never near white), tinted, with an optional shake, blur or darkness, and a white mark. */
async function makeClips(specs) {
  const made = [];
  for (const spec of specs) {
    const file = `${out}/clips/v2-${spec.name}`;
    if (process.env.VIDEO_CLIPS && existsSync(`${process.env.VIDEO_CLIPS}/v2-${spec.name}`)) {
      const buffer = readFileSync(`${process.env.VIDEO_CLIPS}/v2-${spec.name}`);
      made.push({ name: spec.name, mimeType: 'video/mp4', buffer, size: buffer.length });
      continue;
    }
    const gp = await browser.newPage();
    await gp.goto(base, { waitUntil: 'domcontentloaded' });
    await gp.bringToFront();
    const m = await gp.evaluate(async (s) => {
      const type = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t));
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      const g = canvas.getContext('2d');
      const ac = new AudioContext();
      const osc = ac.createOscillator();
      osc.frequency.value = 800;
      const gain = ac.createGain();
      gain.gain.value = 0.25;
      const dest = ac.createMediaStreamDestination();
      osc.connect(gain).connect(dest);
      osc.start();
      const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
      const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 2_500_000 });
      const parts = [];
      rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
      const stopped = new Promise((ok) => (rec.onstop = ok));
      // a fixed pattern from a seeded generator
      let seed = s.seed;
      const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      const rects = Array.from({ length: 160 }, () => ({ x: -140 + rnd() * 1560, y: -140 + rnd() * 1000, w: 30 + rnd() * 150, h: 30 + rnd() * 110, l: 0.25 + rnd() * 0.6 }));
      const scene = (g2, withMover, t) => {
        g2.fillStyle = `hsl(${s.hue} 30% 30%)`;
        g2.fillRect(0, 0, 1280, 720);
        g2.save();
        if (s.shake) {
          g2.translate(640 + (Math.random() * 2 - 1) * 16, 360 + (Math.random() * 2 - 1) * 12);
          g2.rotate(((Math.random() * 2 - 1) * 1.2 * Math.PI) / 180);
          g2.translate(-640, -360);
        }
        for (const r of rects) {
          g2.fillStyle = `hsl(${(s.hue + r.x) % 360} 45% ${Math.round(r.l * 62)}%)`;
          g2.fillRect(r.x, r.y, r.w, r.h);
        }
        if (s.still) {
          g2.fillStyle = '#fff';
          g2.fillRect(590, 310, 100, 100);
        }
        g2.restore();
        if (withMover) {
          g2.fillStyle = '#fff';
          g2.fillRect((t * 200) % 1100, 310, 100, 100);
        }
      };
      // a blurred clip is made once (a blur every frame is more than the software graphics can do in time) and a blurred mark slides over it
      let still = null;
      let sprite = null;
      if (s.blur) {
        const a = document.createElement('canvas');
        a.width = 1280;
        a.height = 720;
        scene(a.getContext('2d'), false, 0);
        still = document.createElement('canvas');
        still.width = 1280;
        still.height = 720;
        const sg = still.getContext('2d');
        sg.filter = 'blur(22px)';
        sg.drawImage(a, 0, 0);
        sprite = document.createElement('canvas');
        sprite.width = 220;
        sprite.height = 220;
        const pg = sprite.getContext('2d');
        pg.filter = 'blur(22px)';
        pg.fillStyle = '#fff';
        pg.fillRect(60, 60, 100, 100);
      }
      const t0 = performance.now();
      const draw = () => {
        const t = (performance.now() - t0) / 1000;
        if (s.blur) {
          g.drawImage(still, 0, 0);
          g.drawImage(sprite, ((t * 200) % 1100) - 60, 250);
        } else scene(g, s.mover, t);
        if (s.dark) {
          g.fillStyle = 'rgba(0,0,0,0.955)';
          g.fillRect(0, 0, 1280, 720);
        }
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
      return { type: type.split(';')[0], b64: btoa(bin), size: buf.length };
    }, spec);
    await gp.close();
    writeFileSync(file, Buffer.from(m.b64, 'base64'));
    if (process.env.VIDEO_CLIPS) { mkdirSync(process.env.VIDEO_CLIPS, { recursive: true }); writeFileSync(`${process.env.VIDEO_CLIPS}/v2-${spec.name}`, Buffer.from(m.b64, 'base64')); }
    made.push({ name: spec.name, mimeType: m.type, buffer: readFileSync(file), size: m.size });
  }
  return made;
}

// ---------------------------------------------------------------- measuring the screen
const wide = (page) => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1 || document.body.scrollWidth > innerWidth + 1);
const sideways = (page, sel) =>
  page.$$eval(sel, (els) =>
    els.filter((e) => {
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
    }).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} "${(e.textContent || '').trim().slice(0, 24)}"`),
  );
const unnamed = (page, sel) => page.$$eval(`${sel} :is(button, input, select, textarea)`, (els) => els.filter((e) => e.type !== 'file' && e.getClientRects().length && !((e.getAttribute('aria-label') || e.getAttribute('title') || e.textContent || '').trim() || e.closest('label'))).map((e) => e.outerHTML.slice(0, 80)));
const small = (page) => page.$$eval('.vd :is(button, input:not([type=file]), select, textarea)', (els) => els.filter((e) => e.getClientRects().length).filter((e) => { const r = e.getBoundingClientRect(); return r.width < 43.5 || r.height < 43.5; }).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} ${Math.round(e.getBoundingClientRect().width)}×${Math.round(e.getBoundingClientRect().height)} "${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 20)}"`));
const cut = (page) => page.$$eval('.vd button, .vd .vdsay, .vd .vdnote, .vd .vdline', (els) => els.filter((e) => e.getClientRects().length && e.scrollWidth > e.clientWidth + 1).map((e) => `"${(e.textContent || '').trim().slice(0, 24)}" ${e.scrollWidth}/${e.clientWidth}`).slice(0, 5));

async function pair(ctx, size) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${size.width}] pageerror: ${e.message} (at ${(e.stack ?? '').split('\n').slice(1, 4).map((l) => l.trim()).join(' · ')})`));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pair input', { timeout: 20000 });
  await page.fill('#pair input', KEY);
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
  return page;
}
const sd = (xs) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length); };

// ================================================================ the run at one width
async function run(size, clips, full) {
  const tag = `[${size.width}]`;
  const ctx = await browser.newContext({ viewport: size, screen: size, deviceScaleFactor: 1, isMobile: true, hasTouch: true, ...UK, serviceWorkers: 'block', acceptDownloads: true });
  const page = await pair(ctx, size);
  const V = (fn, ...a) => page.evaluate(([f, args]) => window.__ghosty.video[f](...args), [fn, a]);
  const state = () => page.evaluate(() => JSON.parse(JSON.stringify({ ...window.__ghosty.video.state(), lastExport: undefined, probe: undefined, forced: undefined })));
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
  const slide = (label, v) => page.locator(`.vd input[aria-label="${label}"]`).first().evaluate((el, x) => {
    el.value = String(x);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, v);
  const line = () => page.locator('.vdline').textContent().then((t) => t ?? '');
  const lineHas = (re, ms = 15000) => until(page, (s) => new RegExp(s.src, s.f).test(document.querySelector('.vdline')?.textContent ?? ''), { src: re.source, f: re.flags }, ms);
  const tile = (i) => page.locator(`.vdtile[data-index="${i}"]`);
  const select = async (i) => {
    for (let k = 0; k < 4; k++) {
      try {
        await selectOnce(i);
        return;
      } catch (e) {
        await page.waitForTimeout(400);
      }
    }
    await selectOnce(i);
  };
  const selectOnce = async (i) => {
    await tile(i).scrollIntoViewIfNeeded({ timeout: 5000 });
    const id = await tile(i).getAttribute('data-id');
    const b = await tile(i).boundingBox();
    const sb = await page.locator('.vdstrip').boundingBox();
    const x0 = Math.max(b.x, sb.x);
    const x1 = Math.min(b.x + b.width, sb.x + sb.width);
    await page.mouse.click((x0 + x1) / 2, b.y + b.height / 2);
    await until(page, (want) => window.__ghosty.video.state().selected === want, id, 5000);
  };
  const seek = (ms) => V('seek', ms);
  /** A seek, then a moment for the player to show the frame, then the same seek again (a draw of what is now showing). */
  const settle = async (ms) => {
    await seek(ms);
    await page.waitForTimeout(200);
    await seek(ms);
  };
  const centre = async () => {
    const c = await V('whiteCentre');
    return c ? { x: c.cx * 1280, y: c.cy * 720, n: c.n } : null;
  };
  const looked = async (name) => {
    const s = await sideways(page, '#pg-video .vd *');
    check(!s.length && !(await wide(page)), `${tag} ${name}: nothing sideways${s.length ? `: ${s.slice(0, 4).join(', ')}` : ''}`);
    const u = await unnamed(page, '#pg-video .vd');
    check(!u.length, `${tag} ${name}: every control has a name VoiceOver reads${u.length ? `: ${u.slice(0, 3).join(' | ')}` : ''}`);
    const sm = await small(page);
    check(!sm.length, `${tag} ${name}: every control is 44 pt${sm.length ? `: ${sm.slice(0, 4).join(' | ')}` : ''}`);
  };
  const sayChat = async (words) => {
    await page.evaluate(() => (location.hash = 'core'));
    await page.waitForSelector('#cin', { state: 'visible', timeout: 15000 });
    await page.fill('#cin', words);
    await page.press('#cin', 'Enter');
  };
  const add = async (list) => {
    const have = await page.locator('.vdtile').count();
    await page.setInputFiles('#pg-video .vdsheet > .vd > input[type=file]', list.map(({ name, mimeType, buffer }) => ({ name, mimeType, buffer })));
    return until(page, (n) => document.querySelectorAll('.vdtile').length >= n, have + list.length, 90000);
  };
  const noSignalWords = (words) => !/signal|offline|connect|network|internet|wi-?fi/i.test(words);

  await page.evaluate(() => (location.hash = 'area-make'));
  await page.waitForSelector('#pg-area-make .hubtile[data-id="editors"] .hubpill[data-editor="video"]', { timeout: 15000 });
  await page.click('#pg-area-make .hubtile[data-id="editors"] .hubpill[data-editor="video"]');
  await page.waitForSelector('#pg-video .vd', { timeout: 15000 });
  const byName = Object.fromEntries(clips.map((c) => [c.name, c]));

  // ---------------------------------------------------------------- (a) STEADY on a clip with a shake
  if (!process.env.SKIP_A) {
  check(await add([byName['shake.mp4']]), `${tag} (a) the shaky clip is in`);
  await select(0);
  await pill('speed');
  check((await key('STEADY').count()) === 1, `${tag} (a) a STEADY key sits under SPEED`);
  const sbox = await key('STEADY').boundingBox();
  check(sbox.height >= 43.5 && sbox.width >= 43.5, `${tag} (a) STEADY is 44 pt (${Math.round(sbox.width)}×${Math.round(sbox.height)})`);
  const lenClip = (await state()).length;
  const times = [0.4, 0.8, 1.2, 1.6, 2.0, 2.4, 2.8, 3.2].map((s) => s * 1000).filter((t) => t < lenClip - 200);
  const spread = async () => {
    const xs = [];
    const ys = [];
    for (const t of times) {
      await settle(t);
      const c = await centre();
      if (c) {
        xs.push(c.x);
        ys.push(c.y);
      }
    }
    return { n: xs.length, sx: sd(xs), sy: sd(ys), s: Math.hypot(sd(xs), sd(ys)) };
  };
  const before = await spread();
  check(before.n >= 5 && before.s > 3, `${tag} (a) the shake is there before: the mark's centre moves ${before.s.toFixed(1)} px (${before.n} frames)`);
  const tTap = Date.now();
  await press('STEADY');
  const first = await lineHas(/Steadying/, 2000);
  check(first, `${tag} (a) STEADY says "Steadying… about N s" within two seconds (${Date.now() - tTap} ms): "${await line()}"`);
  await timed(`${tag} STEADY (${(lenClip / 1000).toFixed(1)} s of clip)`, async () => until(page, () => !!window.__ghosty.video.state().steady || !!window.__ghosty.video.state().steadyWhy, null, 240000));
  const st = await state();
  check(!!st.steady && !st.steadyWhy, `${tag} (a) the steadying was made${st.steadyWhy ? `: ${st.steadyWhy}` : ''}`);
  if (st.steady) {
    console.log(`steady: ${(st.steady.ms / 1000).toFixed(1)} s for ${(st.steady.clipMs / 1000).toFixed(1)} s of clip = ${st.steady.perSecond.toFixed(2)} s per second of clip (${st.steady.frames} frames; reading ${(st.steady.readMs / 1000).toFixed(1)} s, the worker ${(st.steady.workMs / 1000).toFixed(1)} s, the player's offset ${st.steady.lagMs} ms)`);
    T[`${tag} steady s per second of clip`] = Math.round(st.steady.perSecond * 100) / 100;
  }
  const keys = (await proj()).main[0].tr.keys;
  check((keys.x?.length ?? 0) > 20 && (keys.y?.length ?? 0) > 20 && (keys.rot?.length ?? 0) > 20 && (keys.scale?.length ?? 0) === 2, `${tag} (a) the keyframes are written: x ${keys.x?.length}, y ${keys.y?.length}, rot ${keys.rot?.length}, scale ${keys.scale?.length}`);
  check(/Steadier: loses \d+% at the edges/.test(await line()) || /Steadier: loses \d+% at the edges/.test(st.steady?.said ?? ''), `${tag} (a) the crop is said as a percentage: "${st.steady?.said}"`);
  await pill('speed');
  const sayNow = (await page.locator('.vdsteadysay').textContent().catch(() => '')) ?? '';
  check(/loses \d+% at the edges/.test(sayNow), `${tag} (a) the tray says it too: "${sayNow}"`);
  const slider = await page.locator('.vd input[aria-label="Steadier"]').boundingBox();
  check(!!slider && slider.height >= 43.5, `${tag} (a) the Steadier slider is there at 44 pt`);
  const after = await spread();
  check(after.s < before.s * 0.7, `${tag} (a) a sampled frame's shift is smaller after: ${after.s.toFixed(1)} px against ${before.s.toFixed(1)} px before`);
  // the slider changes the crop it costs, with no frames read again
  const k0 = (await proj()).main[0].steady;
  await slide('Steadier', 1);
  const k1 = (await proj()).main[0].steady;
  check(k1.strength === 1 && k1.window > k0.window, `${tag} (a) the slider makes the window longer: ${k0.window} → ${k1.window} frames, ${k0.loses}% → ${k1.loses}% lost`);
  await slide('Steadier', 0.5);
  // the export carries it: the plan and spec the exporter draws with hold the keys, and the file is made
  const spec1 = await V('exportSpecAt', 1000);
  check(spec1 && spec1.scale > 1 && (Math.abs(spec1.x) + Math.abs(spec1.y) + Math.abs(spec1.rot)) > 0, `${tag} (a) the export's own frame spec carries the steadying at 1 s: ${JSON.stringify(spec1)}`);
  if (full) {
    const ex = await V('forceExport', { path: 'webcodecs', silent: true, preset: 'source', long: 240 });
    if (ex.path === 'webcodecs') check(!ex.fellBack && ex.frames >= Math.round((lenClip / 1000) * 30) - 2 && Math.abs(ex.durationMs - lenClip) < 100, `${tag} (a) the export of the steadied clip is made, frame by frame: ${ex.frames} frames, ${ex.durationMs} ms`);
    else {
      // this browser's H.264 encoder says yes to its settings and then cannot be made (a stock test browser): the export falls back
      const dur = await page.evaluate(async () => {
        const v = document.createElement('video');
        v.muted = true;
        v.src = URL.createObjectURL(window.__ghosty.video.lastBlob('forced'));
        await new Promise((ok, bad) => { v.onloadeddata = ok; v.onerror = () => bad(new Error('undecodable')); setTimeout(() => bad(new Error('timeout')), 20000); });
        if (!Number.isFinite(v.duration)) {
          v.currentTime = 1e9;
          await new Promise((r) => (v.onseeked = r));
        }
        return v.duration * 1000;
      }).catch((e) => String(e));
      check(ex.path === 'recorder' && ex.fellBack === 'This phone’s H.264 encoder would not start, so I made the file in real time instead.' && ex.frames > 0 && Math.abs(ex.durationMs - lenClip) < 100 && typeof dur === 'number' && Math.abs(dur - lenClip) < 150, `${tag} (a) with no H.264 encoder to start, the export of the steadied clip falls back to the recorder, says so and is made: ${JSON.stringify(ex)}, the file ${typeof dur === 'number' ? Math.round(dur) : dur} ms`);
    }
  }
  await looked('the SPEED tray with a steadied clip');
  await page.screenshot({ path: `${out}/video2-${size.width}-steady.png` });
  await page.click('.vdundo'); // the slider's last change
  await page.click('.vdundo'); // the slider
  await page.click('.vdundo'); // the steadying itself
  let undone = (await proj()).main[0];
  for (let i = 0; i < 4 && undone.steady; i++) {
    await page.click('.vdundo');
    undone = (await proj()).main[0];
  }
  check(!undone.steady && !undone.tr.keys.x, `${tag} (a) UNDO takes the steadying off: no keys, no record`);
  }

  // ---------------------------------------------------------------- (b) BEST CLIPS on four clips, one blurred and one dark
  if (!process.env.SKIP_A) {
    await pill('project');
    await press('NEW VIDEO');
    await page.waitForFunction(() => window.__ghosty.video.project().main.length === 0, null, { timeout: 8000 });
  }
  check(await add([byName['sharp1.mp4'], byName['blur.mp4'], byName['dark.mp4'], byName['sharp2.mp4']]), `${tag} (b) four clips are in`);
  await select(0);
  await pill('scenes');
  check((await key('BEST CLIPS').count()) === 1, `${tag} (b) a BEST CLIPS key sits under SCENES`);
  await page.locator('.vd button', { hasText: /^\s*30 S\s*$/ }).first().click();
  check((await page.locator('.vd input[aria-label="Length in seconds"]').count()) === 1, `${tag} (b) the length can be typed too`);
  await page.locator('.vd input[aria-label="Length in seconds"]').fill('5');
  await page.locator('.vd input[aria-label="Length in seconds"]').dispatchEvent('change');
  const tBest = Date.now();
  await press('BEST CLIPS');
  check(await lineHas(/Looking at/, 2000), `${tag} (b) BEST CLIPS says what it is doing within two seconds (${Date.now() - tBest} ms): "${await line()}"`);
  await timed(`${tag} BEST CLIPS on 4 clips`, () => until(page, () => !!window.__ghosty.video.state().best, null, 240000));
  const best = (await state()).best;
  check(!!best, `${tag} (b) the clips were scored`);
  if (best) console.log(`best: ${(best.ms / 1000).toFixed(1)} s for ${best.clips} clips = ${(best.perClip / 1000).toFixed(2)} s per clip`);
  if (best) T[`${tag} best s per clip`] = Math.round(best.perClip / 10) / 100;
  const pr = await proj();
  const nameOf = (id) => pr.sources[pr.main.find((c) => c.id === id).src].name;
  const left = (best?.left ?? []).map((l) => `${nameOf(l.clip)}: ${l.reason}`);
  check(left.some((l) => /^blur\.mp4: blurred: left out/.test(l)) && left.some((l) => /^dark\.mp4: too dark: left out/.test(l)), `${tag} (b) the blurred and the dark clip are left out with their reasons: ${left.join(' | ')}`);
  const picks = best?.picks ?? [];
  check(picks.length === 2 && picks.every((x) => /^sharp, well lit, a new view$|^a little soft, .*$|^sharp, well lit, like another pick$/.test(x.reason)), `${tag} (b) the two good clips are picked, each with its reason: ${picks.map((x) => `${nameOf(x.clip)} "${x.reason}"`).join(' | ')}`);
  const rows = await page.locator('.vdtick').count();
  check(rows === 2 && (await page.locator('.vdtick[aria-checked="true"]').count()) === 2, `${tag} (b) the pick is a list he can tick off: ${rows} rows, both ticked`);
  const namerLine = (await page.locator('.vdnamer').textContent().catch(() => '')) ?? '';
  check(namerLine === 'Without the namer kept, I choose by sharpness, light and variety alone.', `${tag} (b) the namer's line when it is not kept: "${namerLine}"`);
  check((await page.locator('.vdleft').count()) === 2, `${tag} (b) the two left out are listed with their reasons`);
  await looked('BEST CLIPS list');
  await page.screenshot({ path: `${out}/video2-${size.width}-best.png` });
  const clipsBefore = (await proj()).main.map((c) => c.id).join();
  const tCut = Date.now();
  await press('MAKE THE CUT');
  await until(page, (b) => window.__ghosty.video.project().main.map((c) => c.id).join() !== b, clipsBefore, 4000);
  const cutMs = Date.now() - tCut;
  const made = await state();
  check(cutMs < 1000 && Math.abs(made.length - 5000) <= 1000 && (await proj()).main.length === 2, `${tag} (b) MAKE THE CUT builds a ${(made.length / 1000).toFixed(1)} s project of the 5 s target within a second (${cutMs} ms)`);
  check((await proj()).main.every((c) => ['sharp1.mp4', 'sharp2.mp4'].includes(pr.sources[c.src].name)) && Object.keys((await proj()).sources).length === 4, `${tag} (b) the originals are untouched: four sources still, the cut uses the two good ones`);
  await page.click('.vdundo');
  check((await proj()).main.length === 4 && (await state()).length > 11000, `${tag} (b) UNDO puts the four clips back`);
  await press('BEST CLIPS').catch(() => undefined);
  await until(page, () => /pick/i.test(document.querySelector('.vdline')?.textContent ?? '') || document.querySelector('.vdtick'), null, 120000);
  await press('MAKE THE CUT');
  await until(page, () => window.__ghosty.video.project().main.length === 2, null, 6000);

  // ---------------------------------------------------------------- (c) ON THE BEAT with a click track at 120 beats a minute
  await pill('sound');
  await press('ON THE BEAT');
  check(/I need music on the timeline to find its beat/.test(await line()), `${tag} (c) no music: ON THE BEAT says what it needs: "${await line()}"`);
  await seek(0);
  await page.locator('.vdtray input[type=file]').first().setInputFiles({ name: 'click120.wav', mimeType: 'audio/wav', buffer: clickWav(120, 16) });
  check(await until(page, () => window.__ghosty.video.project().music.length === 1, null, 20000), `${tag} (c) the click track is on the timeline as music`);
  // more cuts for the snap to move, and the first clip trimmed half a second so its cut has picture to move into
  await select(0);
  await pill('trim');
  await page.locator('.vdstep', { hasText: 'End' }).locator('button').first().click();
  await pill('split');
  for (const t of [1300, 2200, 3600]) {
    await seek(t);
    await press('SPLIT AT THE PLAYHEAD');
    console.log(`split at ${t}: ${(await proj()).main.length} clips, "${await line()}"`);
  }
  const cutsBefore = (await proj()).main.map((c) => [c.in, c.out]);
  check(cutsBefore.length === 5, `${tag} (c) five clips, four cuts to move`);
  const lenBeforeSnap = (await state()).length;
  await pill('sound');
  await press('ON THE BEAT');
  await timed(`${tag} ON THE BEAT (16 s of music)`, () => until(page, () => !!window.__ghosty.video.state().beat?.bpm, null, 60000));
  const bt = (await state()).beat;
  const bpmSaid = /about (\d+) beats a minute/.exec(await line())?.[1];
  check(bt && Math.abs(bt.bpm - 120) <= 2 && bpmSaid && Math.abs(Number(bpmSaid) - 120) <= 2, `${tag} (c) the tempo is said as about 120: "${await line()}" (found ${bt?.bpm?.toFixed(1)})`);
  if (bt) { console.log(`beat: ${(bt.ms / 1000).toFixed(2)} s for ${(bt.musicMs / 1000).toFixed(0)} s of music = ${bt.perMinute.toFixed(2)} s per minute`); T[`${tag} beat s per minute of music`] = Math.round(bt.perMinute * 100) / 100; }
  await press('SNAP TO THE BEAT');
  await until(page, () => /cuts? moved to the beat/.test(document.querySelector('.vdline')?.textContent ?? ''), null, 8000);
  const snapLine = await line();
  const m = /(\d+) cuts? moved to the beat, the biggest by (\d+) ms/.exec(snapLine);
  check(!!m && Number(m[1]) === 4 && Number(m[2]) >= 120 && Number(m[2]) <= 220, `${tag} (c) the cuts moved with the count and the biggest move said: "${snapLine}"`);
  const cutsAfter = (await proj()).main.map((c) => [c.in, c.out]);
  check(JSON.stringify(cutsAfter) !== JSON.stringify(cutsBefore) && Math.abs((await state()).length - lenBeforeSnap) < 60, `${tag} (c) the cuts moved and the video is as long as it was (${(await state()).length} ms)`);
  // each cut now sits on a beat of the click track (clicks at 120 ms + 500 k)
  const starts = [];
  let acc = 0;
  for (const c of (await proj()).main) { starts.push(acc); acc += c.out - c.in; }
  const offs = starts.slice(1).map((t) => Math.abs(((t - 120) % 500 + 500) % 500));
  check(offs.every((o) => Math.min(o, 500 - o) <= 45), `${tag} (c) every cut is on a click (off by ${offs.map((o) => Math.round(Math.min(o, 500 - o))).join(', ')} ms)`);
  await looked('the SOUND tray with ON THE BEAT');
  await page.click('.vdundo');
  check(JSON.stringify((await proj()).main.map((c) => [c.in, c.out])) === JSON.stringify(cutsBefore), `${tag} (c) UNDO puts the cuts back`);

  // ---------------------------------------------------------------- (d) REVERSE and RAMP on one clip
  await pill('project');
  await press('NEW VIDEO');
  await page.waitForFunction(() => window.__ghosty.video.project().main.length === 0, null, { timeout: 8000 });
  check(await add([byName['sharp1.mp4']]), `${tag} (d) the clip is in`);
  await select(0);
  const len0 = (await state()).length;
  await settle(len0 - 60);
  const orig = await centre();
  await settle(0);
  const origStart = await centre();
  await pill('speed');
  check((await key('REVERSE').count()) === 1 && (await key('RAMP').count()) === 1, `${tag} (d) REVERSE and RAMP keys sit under SPEED`);
  await press('REVERSE');
  await page.waitForTimeout(400);
  check((await proj()).main[0].reverse === true && /plays backwards/.test(await line()) && /rough/.test(await line()), `${tag} (d) REVERSE says it will be rough until export: "${await line()}"`);
  await settle(0);
  const revStart = await centre();
  check(orig && revStart && Math.abs(revStart.x - orig.x) < 90, `${tag} (d) the frame at the start of the reversed clip matches the original's end (the mark at ${revStart?.x?.toFixed(0)} against ${orig?.x?.toFixed(0)} px; the original's start was ${origStart?.x?.toFixed(0)})`);
  await settle(len0 - 60);
  const revEnd = await centre();
  check(origStart && revEnd && Math.abs(revEnd.x - origStart.x) < 90, `${tag} (d) and its end matches the original's start (${revEnd?.x?.toFixed(0)} against ${origStart?.x?.toFixed(0)} px)`);
  check(Math.abs((await state()).length - len0) < 20, `${tag} (d) reversing leaves the length as it was`);
  await page.click('.vdundo');
  await press('RAMP');
  const rampLine = await line();
  const rm = /this clip is (\d+(?:\.\d)?) s \(it was (\d+(?:\.\d)?) s\)/.exec(rampLine);
  check(!!rm && Math.abs(Number(rm[1]) - Number(rm[2]) * 0.75) < 0.2, `${tag} (d) RAMP says the length it makes (0.75 of the original for 1× to 2×): "${rampLine}"`);
  check(Math.abs((await state()).length - len0 * 0.75) < 60, `${tag} (d) the timeline is ${(await state()).length} ms for a ramp of ${len0} ms`);
  check((await page.locator('.vd button', { hasText: /SOUND PITCHED/ }).count()) === 1 && (await page.locator('.vd button', { hasText: /SOUND DROPPED/ }).count()) === 1, `${tag} (d) the sound is his choice: pitched or dropped`);
  await page.locator('.vd button', { hasText: /SOUND DROPPED/ }).click();
  check((await proj()).main[0].rampSound === 'drop', `${tag} (d) dropped is kept`);
  await looked('REVERSE and RAMP');
  await page.screenshot({ path: `${out}/video2-${size.width}-ramp.png` });
  await page.click('.vdundo');
  await page.click('.vdundo');

  // ---------------------------------------------------------------- (e) offline: all of it works and says nothing about the signal
  if (full) {
    await pill('project');
    await press('NEW VIDEO');
    await page.waitForFunction(() => window.__ghosty.video.project().main.length === 0, null, { timeout: 8000 });
    await add([byName['sharp1.mp4'], byName['blur.mp4'], byName['sharp2.mp4']]);
    await ctx.setOffline(true);
    await select(0);
    await pill('speed');
    const said = [];
    const steadyN = (await state()).steady?.frames ?? 0;
    await press('STEADY');
    await until(page, (n) => (window.__ghosty.video.state().steady?.frames ?? 0) !== n || !!window.__ghosty.video.state().steadyWhy, steadyN, 120000);
    said.push(await line());
    await press('REVERSE');
    said.push(await line());
    await pill('scenes');
    await press('BEST CLIPS');
    await until(page, () => !!document.querySelector('.vdtick'), null, 120000);
    said.push(await line());
    await pill('sound');
    await press('ON THE BEAT');
    said.push(await line());
    check(said.every(noSignalWords) && said.every((w) => w.length > 5), `${tag} (e) offline, STEADY, REVERSE, BEST CLIPS and ON THE BEAT work and say nothing about the signal: ${said.map((w) => `"${w.slice(0, 60)}"`).join(' | ')}`);
    const st2 = await state();
    check(!!st2.best && (!!st2.steady || !!st2.steadyWhy) && (await proj()).main[0].reverse === true, `${tag} (e) offline: the scores and the reverse are there, the steadying ran`);
    await ctx.setOffline(false);
  }

  // ---------------------------------------------------------------- (f) every key 44 pt, nothing sideways, BODY 21 clips nothing
  for (const t of ['speed', 'scenes', 'sound']) {
    await pill(t);
    await looked(`the ${t} tray`);
  }
  await sayChat('bigger text');
  await page.waitForTimeout(300);
  await sayChat('bigger text');
  await until(page, () => document.documentElement.dataset.body === '21', null, 8000);
  await page.evaluate(() => (location.hash = 'video'));
  await page.waitForSelector('.vdtile', { timeout: 20000 });
  for (const t of ['speed', 'scenes', 'sound']) {
    await pill(t);
    const cu = await cut(page);
    check(!cu.length, `${tag} (f) at BODY 21 the ${t} tray cuts no words: ${cu.join(' | ')}`);
  }
  await looked('BODY 21');
  await page.screenshot({ path: `${out}/video2-${size.width}-body21.png` });
  await ctx.close();
}

const clips = await timed('drawing the clips on the preview', () => makeClips([
  { name: 'shake.mp4', secs: 4, hue: 200, seed: 11, shake: true, still: true },
  { name: 'sharp1.mp4', secs: 3, hue: 20, seed: 21, mover: true },
  { name: 'blur.mp4', secs: 3, hue: 120, seed: 31, blur: true },
  { name: 'dark.mp4', secs: 3, hue: 260, seed: 41, dark: true },
  { name: 'sharp2.mp4', secs: 3, hue: 320, seed: 51, mover: true },
]));
console.log(`clips: ${clips.map((c) => `${c.name} ${(c.size / 1e6).toFixed(1)} MB ${c.mimeType}`).join(', ')}`);
await run({ width: 440, height: 956 }, clips, true);
if (!process.env.ONLY440) await run({ width: 390, height: 844 }, clips, false);
console.log(`\ntimes: ${JSON.stringify(T)}`);
await browser.close();
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n${problems.map((p) => ` - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log('\nvideo2: all good');
