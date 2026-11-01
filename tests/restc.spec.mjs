// BATCH ⑧ PART C (BRIEF-REST-C) on the owner's phone (440 × 956) and on a television (1,920 × 1,080):
//  1. CHECK IT'S LIVE in the Lens's PEOPLE, from the fake camera (Chromium's own, through getUserMedia like a phone's)
//     with the face models stood in (window.__ghostyFaceEngine, honoured only under a test runner) and the face points
//     played from the recorded sequences (tests/fixtures/livefaces.mjs), one look at a time: ENROL ME with a still image
//     → "I can't be sure that's a live face" and nothing saved; with a blink sequence → enrolled; "this is <name>" with a
//     screen playing a blinking still → refused, no name; with a live face blinking → introduced; the switch in
//     Settings → PRIVACY → FACES (on, said to VoiceOver as a switch).
//  2. SHAPES: "draw a room with my hands" in the chat opens the Lens on SHAPES; the first open teaches four gestures; a
//     scripted hand (the tracker stood in: window.__ghostyHands) traces a shaky rectangle and pinches → a room;
//     "that wall is four metres" → 4.00 by the drawn depth, every wall a whole number of 5 cm; two fingers held on the bottom
//     wall → a door; "a bed here", "north is to the left"; the blueprint's VoiceOver words; EXPORT as a PNG and as the
//     measured list (with the honest line); SEE IN 3-D → the Studio builds the room with its door, the roof switches on.
//  3. Nothing sideways at 390 × 844 (SHAPES, PEOPLE, PRIVACY → FACES).
//  4. TV MODE at 1,920 × 1,080 in the PS5's browser's name, with the 3-D switched off (as its older WebKit is): on by
//     itself; Home's Mind drawn flat; the arrow keys (and a stood-in controller's d-pad) move a visible ring; the deck by
//     the keyboard as a grid of large tiles → God's Eye, flat with its line; Escape back; a chat message typed in the
//     bigger box and the on-screen keyboard; the arcade's shelf says the DOS engine started and the 3-D games are hidden;
//     the Studio's one line; the TV MODE switch on in SETTINGS → THEME; no sensor asked for.
//   BASE=http://localhost:8722 node tests/restc.spec.mjs [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { PHONE, UK, openPanel } from './nav.mjs';
import { faceSequence } from './fixtures/livefaces.mjs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8722';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const problems = [];
const check = (ok, what) => void (ok || problems.push(what));
const NAME = 'Quorrin Vexmoor';
const SEQS = Object.fromEntries(['blink', 'photo', 'screen-blink'].map((k) => [k, faceSequence(k, { seed: 5 })]));

/** A fresh phone, paired, with the face models stood in and the recorded face points played one look at a time. */
async function phone(viewport = PHONE) {
  const ctx = await browser.newContext({ viewport, ...UK, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: ['camera'], serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/favicon|net::ERR|404|Failed to load resource|^[WI]\d{4} |^INFO:/.test(t)) problems.push(`console: ${t.slice(0, 200)}`);
  });
  await page.addInitScript((seqs) => {
    let seed = 77;
    const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const gauss = () => Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
    const face = () => Array.from({ length: 128 }, gauss);
    const PEOPLE = { admin: face(), other: face() };
    window.__scene = 'admin';
    window.__liveSeq = 'photo';
    window.__liveAt = 0;
    window.__ghostyFaceEngine = {
      challenge: 'blink',
      detect(size) {
        const s = window.__scene;
        const box = (x) => ({ x: size.w * x, y: size.h * 0.2, w: size.w * 0.3, h: size.h * 0.5 });
        const pts = (b) => [[b.x + b.w * 0.3, b.y + b.h * 0.4], [b.x + b.w * 0.7, b.y + b.h * 0.4], [b.x + b.w * 0.5, b.y + b.h * 0.6], [b.x + b.w * 0.5, b.y + b.h * 0.8]];
        const outF = [];
        if (s.includes('admin')) outF.push(box(0.08));
        if (s.includes('other')) outF.push(box(0.6));
        return outF.map((b) => ({ box: b, points: pts(b), score: 0.96 }));
      },
      embed(f) {
        const who = f.box.x < f.box.w ? 'admin' : 'other';
        return PEOPLE[who].map((x) => x + 0.3 * gauss());
      },
      // the recorded sequence, one look at a time, looping with its own clock
      points() {
        const seq = seqs[window.__liveSeq];
        const i = window.__liveAt++;
        const f = seq[i % seq.length];
        const lap = Math.floor(i / seq.length) * (seq[seq.length - 1].t + 33);
        return { t: f.t + lap, faces: [f.p] };
      },
    };
    // a hand, as the tracker gives it: 21 points in the picture's 0–1 coordinates, the index fingertip at x, y
    window.__handPose = (pose, x, y) => {
      const out = { point: [1], two: [1, 2], open: [1, 2, 3, 4], pinch: [1], fist: [] }[pose] ?? [];
      const p = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
      const fingers = [[1, 2, 3, 4, -0.08], [5, 6, 7, 8, 0], [9, 10, 11, 12, 0.03], [13, 14, 15, 16, 0.06], [17, 18, 19, 20, 0.09]];
      for (const [f, [mcp, pip, dip, tip, dx]] of fingers.entries()) {
        const on = out.includes(f);
        p[mcp] = { x: x + dx, y: y + 0.12, z: 0 };
        p[pip] = { x: x + dx, y: y + 0.07, z: 0 };
        p[dip] = on ? { x: x + dx, y: y + 0.035, z: 0 } : { x: x + dx, y: y + 0.1, z: 0 };
        p[tip] = on ? { x: x + dx, y, z: 0 } : { x: x + dx, y: y + 0.13, z: 0 };
      }
      p[0] = { x: x + 0.02, y: y + 0.24, z: 0 };
      p[4] = pose === 'pinch' ? { ...p[8] } : { x: x - 0.1, y: y + 0.1, z: 0 };
      return p;
    };
    // the scripted hand: each look takes the next frame; a frame with `ms` is held that long
    window.__handScript = [];
    window.__handAt = 0;
    let heldSince = 0;
    window.__ghostyHands = {
      recognizeForVideo() {
        const f = window.__handScript[window.__handAt];
        if (!f) return {};
        if (f.ms) {
          heldSince ||= performance.now();
          if (performance.now() - heldSince >= f.ms) {
            heldSince = 0;
            window.__handAt++;
          }
        } else window.__handAt++;
        return { landmarks: [window.__handPose(f.pose, f.x, f.y)], gestures: [[{ categoryName: 'None', score: 0.9 }]], handedness: [[{ categoryName: 'Right', score: 0.9 }]] };
      },
      close() {},
    };
  }, SEQS);
  await page.goto(base);
  await page.fill('#pair input', 'preview-owner-key-0123456789');
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
  return { ctx, page };
}
const untilOn = (page, fn, arg, ms, what) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => (problems.push(what), false));

// ---------------------------------------------------------------- 1. CHECK IT'S LIVE
{
  const { ctx, page } = await phone();
  const people = () => page.evaluate(() => ({ enrolled: window.__ghosty.people.enrolled, known: window.__ghosty.people.known, said: window.__ghosty.people.said, live: { ...window.__ghosty.people.live, verdict: window.__ghosty.people.live.verdict && { ...window.__ghosty.people.live.verdict } } }));
  // straight to PEOPLE (SEE's object models never load: on a busy machine they hold the page for seconds a frame)
  await page.evaluate(() => window.__ghosty.run('open_lens', { mode: 'people' }));
  await page.waitForSelector('#pg-lens .lensmodes', { timeout: 15000 });
  await untilOn(page, () => window.__ghosty?.lens?.mode === 'people', null, 10000, 'open_lens did not open PEOPLE');
  await page.waitForTimeout(600);
  if ((await page.evaluate(() => window.__ghosty.lens.camera)) === 'off') await page.locator('#pg-lens .lensbar button', { hasText: 'START' }).click();
  await untilOn(page, () => window.__ghosty?.lens?.camera === 'on', null, 20000, 'the fake camera did not open');

  // a still image held up: asked to blink, it cannot; refused with the line, nothing saved
  await page.evaluate(() => ((window.__liveSeq = 'photo'), (window.__liveAt = 0)));
  await page.locator('#pg-lens .people button', { hasText: 'ENROL ME' }).click();
  await untilOn(page, () => /blink twice/i.test(window.__ghosty.people.said), null, 8000, 'ENROL ME did not ask for two blinks first');
  await untilOn(page, () => /can.t be sure that.s a live face/i.test(window.__ghosty.people.said), null, 20000, `a still image was not refused with the line: "${(await people()).said}"`);
  let p = await people();
  check(!p.enrolled, 'a still image was enrolled as him');
  check(p.live.verdict && !p.live.verdict.live && p.live.verdict.why === 'challenge', `the still image's verdict: ${JSON.stringify(p.live.verdict)}`);
  check(await page.locator('#pg-lens .pplsay[role="status"][aria-live="polite"]').count(), 'the line is not said to VoiceOver');
  await page.screenshot({ path: `${out}/restc-live-refused.png` });

  // a live face blinking twice: passes, then the five looks, enrolled
  await page.evaluate(() => ((window.__liveSeq = 'blink'), (window.__liveAt = 0)));
  await page.locator('#pg-lens .people button', { hasText: 'ENROL ME' }).click();
  await untilOn(page, () => window.__ghosty.people.enrolled === true, null, 40000, `a blink sequence did not pass and enrol: ${JSON.stringify(await people())}`);
  p = await people();
  check(p.live.verdict?.live === true && p.live.verdict.blinks >= 2 && p.live.verdict.depth === 'deep', `the blink sequence's verdict: ${JSON.stringify(p.live.verdict)}`);

  // "this is <name>": a screen playing a blinking still is refused (no name); a live face blinking is introduced
  await page.evaluate(() => ((window.__scene = 'admin+other'), (window.__liveSeq = 'screen-blink'), (window.__liveAt = 0)));
  await page.waitForTimeout(800);
  await page.fill('#pg-lens .pplin', `this is ${NAME}`);
  await page.locator('#pg-lens .pplask button', { hasText: 'SAY' }).click();
  await untilOn(page, () => /ask them to blink twice/i.test(window.__ghosty.people.said), null, 10000, `introducing did not ask them to blink: "${(await people()).said}"`);
  await untilOn(page, () => /can.t be sure that.s a live face/i.test(window.__ghosty.people.said), null, 30000, `a screen video was not refused: "${(await people()).said}"`);
  p = await people();
  check(p.known === 0, 'a screen video was saved as a person');
  check(p.live.verdict && !p.live.verdict.live && p.live.verdict.blinks >= 2 && p.live.verdict.depth !== 'deep', `the screen's verdict: ${JSON.stringify(p.live.verdict)}`);
  await page.evaluate(() => ((window.__liveSeq = 'blink'), (window.__liveAt = 0)));
  await page.fill('#pg-lens .pplin', `this is ${NAME}`);
  await page.locator('#pg-lens .pplask button', { hasText: 'SAY' }).click();
  await untilOn(page, () => window.__ghosty.people.known === 1, null, 40000, `a live face was not introduced: ${JSON.stringify(await people())}`);
  check(new RegExp(`Hello, ${NAME}`).test((await people()).said), `no hello after the introduction: "${(await people()).said}"`);

  // the switch: Settings → PRIVACY → FACES → CHECK IT'S LIVE, on, a switch to VoiceOver
  await page.evaluate(() => (location.hash = 'settings'));
  await openPanel(page, 'settings', 'PRIVACY');
  const sw = page.locator('#pg-settings .faces button.setsw', { hasText: 'CHECK IT’S LIVE' });
  await sw.waitFor({ timeout: 8000 }).catch(() => undefined);
  check((await sw.getAttribute('role').catch(() => '')) === 'switch' && (await sw.getAttribute('aria-checked').catch(() => '')) === 'true', 'CHECK IT’S LIVE is not an on switch in PRIVACY → FACES');
  await page.screenshot({ path: `${out}/restc-live-setting.png` });
  await ctx.close();
}

// ---------------------------------------------------------------- 2. SHAPES
{
  const { ctx, page } = await phone();
  const shapes = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__ghosty.shapes ?? null)));
  const play = (frames) => page.evaluate((f) => ((window.__handScript = f), (window.__handAt = 0)), frames);
  const played = (ms, what) => untilOn(page, () => window.__handAt >= window.__handScript.length, null, ms, what);
  const tell = async (text) => {
    await page.fill('#pg-lens .shpin', text);
    await page.locator('#pg-lens .shpask button', { hasText: 'SAY' }).click();
  };
  // the chat's own words open it: "draw a room with my hands"
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForSelector('#cin', { timeout: 15000 });
  await page.fill('#cin', 'draw a room with my hands');
  await page.press('#cin', 'Enter');
  await untilOn(page, () => window.__ghosty?.lens?.mode === 'shapes', null, 15000, '"draw a room with my hands" did not open the Lens on SHAPES');
  // the first open teaches the four gestures
  const tut = page.locator('#pg-lens .shptut');
  check(await tut.isVisible().catch(() => false), 'no lesson of the four gestures on the first open');
  check((await page.locator('#pg-lens .shptut .shprow').count()) === 4, 'the lesson does not have four gestures');
  await page.screenshot({ path: `${out}/restc-shapes-lesson.png` });
  await page.locator('#pg-lens .shptut button', { hasText: 'GOT IT' }).click();
  await page.waitForTimeout(600);
  if ((await page.evaluate(() => window.__ghosty.lens.camera)) === 'off') await page.locator('#pg-lens .lensbar button', { hasText: 'START' }).click();
  await untilOn(page, () => window.__ghosty?.lens?.camera === 'on', null, 20000, 'the fake camera did not open for SHAPES');

  // a room traced in the air (shaky), finished with a pinch
  const side = (a, b, n = 14) => Array.from({ length: n }, (_, i) => ({ pose: 'point', x: a[0] + ((b[0] - a[0]) * i) / n + Math.sin(i * 1.7) * 0.003, y: a[1] + ((b[1] - a[1]) * i) / n + Math.cos(i * 2.3) * 0.003 }));
  const C = [[0.3, 0.3], [0.7, 0.3], [0.7, 0.6], [0.3, 0.6]];
  await play([
    { pose: 'open', x: 0.3, y: 0.3, ms: 200 },
    ...side(C[0], C[1]), ...side(C[1], C[2]), ...side(C[2], C[3]), ...side(C[3], C[0]),
    { pose: 'point', x: 0.3, y: 0.3 },
    { pose: 'pinch', x: 0.3, y: 0.3, ms: 300 },
    { pose: 'open', x: 0.5, y: 0.45, ms: 300 },
  ]);
  await played(20000, 'the scripted room was not played through');
  await untilOn(page, () => window.__ghosty.shapes?.built?.rooms?.length === 1, null, 8000, `the traced room was not placed: ${JSON.stringify((await shapes())?.said)}`);
  // one real length: the scale for everything
  await tell('that wall is four metres');
  await untilOn(page, () => window.__ghosty.shapes?.built?.scaleSaid === true, null, 5000, 'the said length did not set the scale');
  let st = await shapes();
  const room = st?.built?.rooms?.[0];
  // the trace was 0.4 of the picture across and 0.3 down: in the camera's own pixels, that is the room's shape
  const vid = await page.evaluate(() => { const v = document.querySelector('#pg-lens video'); return [v.videoWidth, v.videoHeight]; });
  const depthM = (4 * 0.3 * vid[1]) / (0.4 * vid[0]);
  check(room && room.box && room.box[0] === 4 && Math.abs(room.box[1] - depthM) <= 0.1, `the room is not 4 by about ${depthM.toFixed(2)} metres (camera ${vid}): ${JSON.stringify(room)}`);
  check(room && room.walls.every((m) => Math.abs(Math.round(m * 20) - m * 20) < 1e-9), `a wall is not a whole number of 5 cm: ${room?.walls}`);
  // a door cut with two fingers held on the bottom wall; a bed by its word, where the hand is
  await play([{ pose: 'two', x: 0.5, y: 0.6, ms: 900 }, { pose: 'open', x: 0.5, y: 0.45, ms: 300 }]);
  await played(10000, 'the scripted cut was not played through');
  await untilOn(page, () => window.__ghosty.shapes?.built?.openings?.length === 1, null, 5000, `the two-finger cut made no door: ${JSON.stringify((await shapes())?.said)}`);
  await tell('a bed here');
  await tell('north is to the left');
  st = await shapes();
  check(st.built.items.length === 1 && st.built.items[0].label === 'Bed, double', `no bed: ${JSON.stringify(st.built.items)}`);
  check(st.built.room.north === 90, 'north was not set');
  // VoiceOver: the blueprint is a picture with its words; what was placed is said
  const label = await page.locator('#pg-lens canvas.shpcanvas').getAttribute('aria-label');
  check(/^Blueprint: Room 1, 4\.00 by \d\.\d\d metres, \d+\.\d m².*1 door.*bed, double/.test(label ?? ''), `the blueprint's VoiceOver label: "${label}"`);
  check((await page.locator('#pg-lens .shpsay[role="status"][aria-live="polite"]').count()) === 1, 'what was placed is not said to VoiceOver');
  check(/not a survey/.test(await page.locator('#pg-lens .shphonest').textContent()), 'SHAPES does not say it is a sketch, not a survey');
  await page.screenshot({ path: `${out}/restc-shapes-blueprint.png` });
  // EXPORT: the picture and the measured list
  await page.locator('#pg-lens .shpacts button', { hasText: 'PNG' }).click();
  await untilOn(page, () => window.__ghosty.shapes?.exported?.png > 5000, null, 10000, 'EXPORT PNG made no picture');
  await page.locator('#pg-lens .shpacts button', { hasText: 'LIST' }).click();
  await untilOn(page, () => window.__ghosty.shapes?.exported?.list > 0, null, 5000, 'EXPORT LIST made no list');
  const list = (await shapes()).exported.listText;
  check(/A sketch to measurements you gave, not a survey\./.test(list) && /Room 1: 4\.00 m ×/.test(list) && /Door: 0\.80 m wide/.test(list) && /Bed, double/.test(list), `the measured list: ${list.slice(0, 300)}`);
  // the same plan in 3-D in the Studio: walls, the door, the roof switch
  await page.locator('#pg-lens .shpacts button', { hasText: 'SEE IN 3-D' }).click();
  await untilOn(page, () => window.__ghosty?.studio?.state?.().rooms === 1 && window.__ghosty.studio.state().openings === 1 && window.__ghosty.studio.state().boxes > 4, null, 90000, `the Studio did not build the sketch in 3-D: ${JSON.stringify(await page.evaluate(() => { const s = window.__ghosty?.studio?.state?.(); return s && { rooms: s.rooms, openings: s.openings, boxes: s.boxes, error: s.error, warnings: s.warnings }; }))}`);
  await page.evaluate(() => window.__ghosty.studio.setCeiling(true));
  await untilOn(page, () => window.__ghosty.studio.state().ceiling === true, null, 20000, 'the Studio’s roof (CEILING) did not switch on');
  await page.screenshot({ path: `${out}/restc-shapes-3d.png` });
  await ctx.close();
}

// ---------------------------------------------------------------- nothing sideways at 390 × 844 (the phone layout)
{
  const { ctx, page } = await phone({ width: 390, height: 844 });
  const wide = async (where) => {
    // (as routec.spec's check: a part inside a box that clips it within the screen is not sideways; a screen still
    // sliding in is waited for)
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, over: [...document.querySelectorAll('#pg-lens .shapes *, #pg-lens .people *, #pg-settings .faces *')].filter((e) => {
      if (!e.getClientRects().length || getComputedStyle(e).visibility === 'hidden') return false;
      const b = e.getBoundingClientRect();
      if (!b.width || b.bottom < 0 || b.top > innerHeight) return false;
      for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
        if (/(hidden|auto|scroll|clip)/.test(getComputedStyle(p).overflowX)) {
          const pr = p.getBoundingClientRect();
          if (pr.left >= -1 && pr.right <= innerWidth + 1) return false;
        }
      }
      return b.left < -1 || b.right > innerWidth + 1;
    }).map((e) => `${e.className || e.tagName} ${Math.round(e.getBoundingClientRect().left)}–${Math.round(e.getBoundingClientRect().right)}`).slice(0, 5) }));
    check(r.sw <= r.iw && !r.over.length, `${where} goes sideways at 390: ${JSON.stringify(r)}`);
  };
  await page.evaluate(() => window.__ghosty.run('open_lens', { mode: 'people' }));
  await page.waitForSelector('#pg-lens .lensmodes', { timeout: 15000 });
  // the camera stays off here: the tile itself opens SHAPES
  if ((await page.evaluate(() => window.__ghosty.lens.camera)) !== 'off') await page.locator('#pg-lens .lensbar button', { hasText: 'STOP' }).click().catch(() => undefined);
  await page.locator('#pg-lens .lensmodes button', { hasText: 'SHAPES' }).click();
  await untilOn(page, () => window.__ghosty?.lens?.mode === 'shapes', null, 8000, 'the SHAPES tile did not open SHAPES');
  await page.waitForTimeout(500);
  await wide('SHAPES');
  await page.locator('#pg-lens .lensmodes button', { hasText: 'PEOPLE' }).click();
  await page.waitForTimeout(500);
  await wide('PEOPLE');
  await page.evaluate(() => (location.hash = 'settings'));
  await openPanel(page, 'settings', 'PRIVACY');
  await page.waitForTimeout(400);
  await wide('PRIVACY → FACES');
  await page.screenshot({ path: `${out}/restc-390-faces.png` });
  await ctx.close();
}

// ---------------------------------------------------------------- 4. TV MODE at 1,920 × 1,080, driven by the keyboard
// The PS5's hidden browser (its own name; an older WebKit with no WebGL that Ghosty can use): a browser with the 3-D
// switched off stands in for it, so every fallback is the real one — Home's Mind flat, God's Eye flat, the Studio and
// the 3-D games hidden with one line each; the DOS engine really started.
{
  const PS5 = 'Mozilla/5.0 (PlayStation; PlayStation 5/2.26) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0 Safari/605.1.15';
  const tvBrowser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--disable-3d-apis', '--disable-webgl', '--disable-webgl2'] });
  const ctx = await tvBrowser.newContext({ viewport: { width: 1920, height: 1080 }, ...UK, userAgent: PS5, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`[tv] pageerror: ${e.message}`));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/favicon|net::ERR|404|Failed to load resource|WebGL|webgl|^[WI]\d{4} |^INFO:/.test(t)) problems.push(`[tv] console: ${t.slice(0, 200)}`);
  });
  // map tiles from the internet are not this test's business: a blank tile answers
  await ctx.route(/tile\.openstreetmap\.org|opentopomap|arcgisonline|cyclosm/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64') }));
  await page.addInitScript(() => {
    // Home's hero takes its real path here (it stands the 2-D reactor in for checks unless asked)
    window.__ghostyHero = true;
    // nothing in TV mode may ask for the phone's sensors: count any try
    window.__sensors = [];
    const note = (what) => () => window.__sensors.push(what);
    if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = (...a) => (note('camera')(), Promise.reject(new Error('no camera here')));
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition = note('position');
      navigator.geolocation.watchPosition = note('position');
    }
    // a controller: the Gamepad API's standard pad, its buttons set by the test
    window.__pad = { id: 'Wireless Controller (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    navigator.getGamepads = () => [window.__pad];
  });
  await page.goto(base);
  await page.fill('#pair input', 'preview-owner-key-0123456789');
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
  await untilOn(page, () => window.__ghosty?.tv?.on === true, null, 10000, '[tv] TV mode did not come on by itself for the PS5’s browser at 1,920 × 1,080');
  const tv = await page.evaluate(() => ({ ...window.__ghosty.tv, body: document.body.className }));
  check(tv.has3d === false && /\bno3d\b/.test(tv.body) && /\btv\b/.test(tv.body), `[tv] the screen's facts: ${JSON.stringify(tv)}`);
  // Home's centrepiece: MIND, drawn flat (not the old arc reactor)
  await untilOn(page, () => window.__ghosty?.hero?.mode === '2d' && document.querySelector('canvas.reactor')?.dataset.look === 'flatmind', null, 15000, `[tv] Home's Mind was not drawn flat: ${JSON.stringify(await page.evaluate(() => window.__ghosty?.hero && { mode: window.__ghosty.hero.mode, reason: window.__ghosty.hero.reason }))}`);
  await page.screenshot({ path: `${out}/restc-tv-home.png` });

  const active = () => page.evaluate(() => {
    const e = document.activeElement;
    const st = e ? getComputedStyle(e) : null;
    return e && e !== document.body ? { tag: e.tagName, id: e.id, cls: String(e.className), text: (e.getAttribute('aria-label') ?? e.textContent ?? '').trim().slice(0, 40), data: e.dataset?.id ?? '', ring: st.outlineStyle !== 'none' && parseFloat(st.outlineWidth) >= 3, h: e.getBoundingClientRect().height } : null;
  });
  /** Press `key` until `want(active)` (at most `n` times); the last focus. */
  const pressUntil = async (key, want, n = 40) => {
    let a = await active();
    for (let i = 0; i < n && !(a && want(a)); i++) {
      await page.keyboard.press(key);
      a = await active();
    }
    return a;
  };
  /** From the first control, RIGHT through the reading order until `want` (the way a d-pad reaches anything). */
  const walkTo = async (want, n = 90) => {
    await page.evaluate(() => document.activeElement?.blur?.());
    return pressUntil('ArrowRight', want, n);
  };

  // the d-pad moves a ring you can see; the controller's pad does the same
  await page.keyboard.press('ArrowDown');
  let a = await active();
  check(a && a.ring, `[tv] the arrow key gave no focus with a ring: ${JSON.stringify(a)}`);
  const before = JSON.stringify(a);
  await page.evaluate(() => {
    window.__pad.buttons[13] = { pressed: true, value: 1 };
    dispatchEvent(new Event('gamepadconnected'));
  });
  await page.waitForTimeout(120);
  await page.evaluate(() => (window.__pad.buttons[13] = { pressed: false, value: 0 }));
  await page.waitForTimeout(120);
  check(JSON.stringify(await active()) !== before && (await page.evaluate(() => window.__ghosty.tv.pad)), '[tv] the controller’s d-pad did not move the focus');

  // THE DECK, by the keyboard: through Home to ALL SCREENS, Enter; a grid of large tiles; across to God's Eye, open it
  a = await walkTo((x) => /^All screens$/i.test(x.text));
  check(a && /^All screens$/i.test(a.text) && a.h >= 56, `[tv] the d-pad never reached ALL SCREENS (56 pt at least): ${JSON.stringify(a)}`);
  await page.keyboard.press('Enter');
  await untilOn(page, () => !!document.querySelector('#deck.on'), null, 5000, '[tv] Enter on the systems button did not open the deck');
  const grid = await page.evaluate(() => {
    const g = document.querySelector('#deck .dkgrid');
    const c = document.querySelector('#deck .dkgrid .dkcard');
    return { cols: g ? getComputedStyle(g).gridTemplateColumns.split(' ').length : 0, h: c?.getBoundingClientRect().height ?? 0 };
  });
  check(grid.cols >= 4 && grid.h >= 140, `[tv] the deck is not a grid of large tiles: ${JSON.stringify(grid)}`);
  a = await pressUntil('ArrowDown', (x) => /dkcard/.test(x.cls), 10);
  a = await pressUntil('ArrowRight', (x) => x.data === 'eye', 60);
  check(a?.data === 'eye' && a.ring && a.h >= 56, `[tv] the d-pad did not reach God's Eye's tile (with its ring, 56 pt at least): ${JSON.stringify(a)}`);
  await page.screenshot({ path: `${out}/restc-tv-deck.png` });
  await page.keyboard.press('Enter');
  a = await pressUntil('ArrowDown', (x) => /dkopen/.test(x.cls), 10);
  await page.keyboard.press('Enter');
  await untilOn(page, () => document.body.dataset.tab === 'eye' && !document.querySelector('#deck.on'), null, 10000, `[tv] the deck did not open God's Eye: ${JSON.stringify(a)}`);
  // GOD'S EYE, flat: the line, and map tiles
  await untilOn(page, () => /can.t draw the 3-D map/.test(document.querySelector('#pg-eye .tvline.tveye')?.textContent ?? '') && !!document.querySelector('#pg-eye .tvmap .leaflet-container'), null, 20000, `[tv] God's Eye had no flat fallback: ${JSON.stringify(await page.evaluate(() => window.__ghosty.tv.eye))}`);
  await page.screenshot({ path: `${out}/restc-tv-eye.png` });
  // B / Escape goes back
  await page.keyboard.press('Escape');
  await untilOn(page, () => document.body.dataset.tab !== 'eye', null, 5000, '[tv] Escape did not go back from God’s Eye');

  // A CHAT MESSAGE, by the keyboard: down to the box (bigger type), a message sent; the on-screen keyboard types into it
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(600);
  a = await walkTo((x) => x.id === 'cin');
  check(a?.id === 'cin', `[tv] the d-pad never reached the chat box: ${JSON.stringify(a)}`);
  const size = await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('cin')).fontSize));
  check(size >= 24, `[tv] the chat's type is not bigger: ${size}px`);
  await page.keyboard.type('hello from the sofa');
  await page.keyboard.press('Enter');
  await untilOn(page, () => [...document.querySelectorAll('.msg, .umsg, .you')].some((m) => /hello from the sofa/.test(m.textContent)) || /hello from the sofa/.test(document.querySelector('#pg-core')?.textContent ?? ''), null, 10000, '[tv] the chat message did not show');
  await page.locator('#cin').focus();
  a = await pressUntil('ArrowRight', (x) => /tvkbbtn/.test(x.cls), 8);
  check(/tvkbbtn/.test(a?.cls ?? ''), `[tv] the on-screen keyboard's button was not reachable: ${JSON.stringify(a)}`);
  await page.keyboard.press('Enter');
  await untilOn(page, () => !!document.querySelector('#tvkb') && document.activeElement?.classList.contains('tvkey'), null, 5000, '[tv] the on-screen keyboard did not open with a key focused');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  check(/^[qwertyuiop]$/.test(await page.evaluate(() => document.getElementById('cin').value)), `[tv] the on-screen keyboard did not type: "${await page.evaluate(() => document.getElementById('cin').value)}"`);
  await page.screenshot({ path: `${out}/restc-tv-keyboard.png` });
  await page.keyboard.press('Escape');
  check(await page.evaluate(() => !document.querySelector('#tvkb') && document.activeElement?.id === 'cin'), '[tv] B / Escape did not put the keyboard away and go back to the box');

  // THE ARCADE'S SHELF: the DOS engine tried and its result said; the 3-D games hidden with one line; the shelf by the d-pad
  await page.evaluate(() => (location.hash = 'arcade'));
  await untilOn(page, () => /DOS games (start|can.t start) on this screen/.test(document.querySelector('#pg-arcade .tvline.tvdos')?.textContent ?? ''), null, 40000, `[tv] the arcade did not say whether DOS games start: ${JSON.stringify(await page.evaluate(() => window.__ghosty.tv.dos))}`);
  const arc = await page.evaluate(() => ({ dos: document.querySelector('#pg-arcade .tvline.tvdos')?.textContent, games: document.querySelector('#pg-arcade .tvline.tvgames')?.textContent ?? '', quake: document.querySelector('#pg-arcade .arccard[data-id="quake-shareware"]')?.hidden, cards: [...document.querySelectorAll('#pg-arcade .arccard')].filter((c) => !c.hidden).length }));
  check(/DOS games start on this screen/.test(arc.dos ?? ''), `[tv] the DOS engine did not start in a browser with WebAssembly: ${arc.dos}`);
  check(/3-D games are hidden/.test(arc.games) && arc.quake !== false && arc.cards > 0, `[tv] the 3-D games were not hidden with a line, or nothing is left: ${JSON.stringify(arc)}`);
  a = await walkTo((x) => /arcact|arcmore/.test(x.cls));
  check(/arcact|arcmore/.test(a?.cls ?? '') && a.ring, `[tv] the d-pad did not reach the shelf: ${JSON.stringify(a)}`);
  await page.screenshot({ path: `${out}/restc-tv-arcade.png` });
  // THE STUDIO: one line, nothing that needs 3-D
  await page.evaluate(() => (location.hash = 'studio'));
  await untilOn(page, () => /can.t draw 3-D/.test(document.querySelector('#pg-studio .tvline.tvstudio')?.textContent ?? ''), null, 15000, '[tv] the Studio had no one-line "can’t draw 3-D"');
  // SETTINGS → THEME: the TV MODE switch, on
  await page.evaluate(() => (location.hash = 'settings'));
  await openPanel(page, 'settings', 'THEME');
  const sw = page.locator('#pg-settings button.setsw.tvsw');
  await sw.waitFor({ timeout: 8000 }).catch(() => undefined);
  check((await sw.getAttribute('aria-checked').catch(() => '')) === 'true', '[tv] SETTINGS → THEME has no TV MODE switch showing on');
  check((await page.evaluate(() => window.__sensors.length)) === 0, `[tv] TV mode asked for the phone's sensors: ${await page.evaluate(() => window.__sensors.join(', '))}`);
  await ctx.close();
  await tvBrowser.close();
}

await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'restc clean: a still image and a screen video were refused with "I can’t be sure that’s a live face" and nothing saved; a live face blinking enrolled him and introduced someone; CHECK IT’S LIVE is an on switch in PRIVACY → FACES; a scripted hand drew a 4 m room with a door and a bed, exported as a PNG and a measured list, built in 3-D with its roof; nothing went sideways at 390; TV mode came on by itself for the PS5 at 1,920 × 1,080 and the keyboard drove the deck, God’s Eye flat, a chat message and the arcade’s shelf.');
process.exit(problems.length ? 1 : 0);
