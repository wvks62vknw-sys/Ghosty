// QUALITY PASS: THE BOOT AND THE ORB (BRIEF-QUALITY-BOOT-ORB): the cinematic's every state, the orb's every state and the ribbon, measured and made
// right, nothing new added. One check for each rough spot closed, named for it, grouped THE BOOT · THE ORB · THE RIBBON, at 440 × 956 and 390 × 844
// with software GL (the orb) and the flat kind (WebGL refused: the boot's words must be the same). The pure words (the greeting, the fault, the
// hold's line, the orb's lines, the ribbon's sentences) are read from the very files the page is built from. The boot's own cut, its times and
// boot.spec's checks are not touched here: the timings are boot.spec's, read once at the end of this run's report.
// Stills (440 only), before and after: BOOTPASS_STILL=before|after names them tests/.shots/bootpass-<name>-440-<before|after>.png.
//   BASE=http://localhost:8846 node tests/bootpass.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, standDown } from './nav.mjs';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const { buildSync } = createRequire(new URL('../apps/web/package.json', import.meta.url))('esbuild');

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const STILL = process.env.BOOTPASS_STILL ?? 'after';
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
const on = (k) => !process.env.BP_ONLY || process.env.BP_ONLY.split(',').includes(k);
const log = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s · ${s}`);
await standDown(base, KEY);
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

/** A source file of the app, bundled and imported (pure files only). */
async function pure(entry) {
  try {
    const r = buildSync({ entryPoints: [new URL(`../${entry}`, import.meta.url).pathname], bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent' });
    return await import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`);
  } catch {
    return null; // (the code before this brief has no such file: every check that needs it is red there)
  }
}
const bw = await pure('apps/web/src/shell/bootwords.ts');
const ow = await pure('apps/web/src/features/core/orbwords.ts');
const rw = await pure('apps/web/src/features/core/ribbonwords.ts');

const SCAN = { ground: 'graphite', world: 'scan', night: 'graphite', switches: {} };
/** A phone opened on Ghosty. `boot`: the cinematic plays (kind: 'flat' is the WebGL-refused cut); `hero`: MIND draws (software GL). */
async function phone(viewport, o = {}) {
  const ctx = await browser.newContext({ viewport, screen: viewport, deviceScaleFactor: o.still ? 2 : 1, isMobile: true, hasTouch: true, ...UK, serviceWorkers: 'block', reducedMotion: o.reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${viewport.width}] pageerror: ${e.message}`));
  await page.addInitScript(({ key, o, scan }) => {
    if (!localStorage.getItem('ghosty.ownerKey')) localStorage.setItem('ghosty.ownerKey', key);
    if (!localStorage.getItem('ghosty.settings')) localStorage.setItem('ghosty.settings', JSON.stringify({ ...(o.name === undefined ? { name: 'Tony' } : o.name === null ? {} : { name: o.name }), speak: false, sounds: false, theme: 'reactor', favourites: [], look: { ...scan, world: o.world ?? 'scan', switches: o.body ? { body: o.body } : {} }, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
    window.__ghostyPlace = { none: true };
    if (o.hero) window.__ghostyHero = true;
    if (o.boot) window.__ghostyBoot = true;
    if (o.kind) window.__ghostyBootKind = o.kind;
    if (o.manual) window.__ghostyBootManual = true;
    if (o.offline) Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    // what the boot layer showed, every frame: its words and the held landing's line
    window.__bp = { texts: new Set(), hold: [], holdAt: -1, heldAt: -1, skipH: 0 };
    const look = () => {
      const b = document.getElementById('boot');
      if (b) {
        const t = (b.innerText || '').trim().replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n');
        if (t) window.__bp.texts.add(t);
        const hl = b.querySelector('.bhold');
        if (hl && !hl.hidden && hl.textContent) {
          if (window.__bp.holdAt < 0) window.__bp.holdAt = performance.now();
          window.__bp.hold.push(hl.textContent);
        }
        if (window.__bootState?.held > 0 && window.__bp.heldAt < 0) window.__bp.heldAt = performance.now();
        const sk = b.querySelector('.bskip');
        if (sk) window.__bp.skipH = Math.max(window.__bp.skipH, sk.getBoundingClientRect().height);
      }
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  }, { key: KEY, o, scan: SCAN });
  if (o.dead) await page.route('**/api/**', (r) => r.abort('failed'));
  else if (o.slow) await page.route(/\/api\/(status|library|school|health|agenda|highways|mind)/, async (r) => { await new Promise((s) => setTimeout(s, o.slow)); r.continue().catch(() => undefined); });
  if (o.noGuardian) await page.route(/\/api\/guardian/, (r) => r.abort('failed'));
  await page.route(/\/api\/tts$/, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"no voice here"}' }));
  if (o.chatDown) await page.route(/\/api\/chat$/, (r) => r.abort('failed'));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  if (!o.boot) await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 }).catch(() => undefined);
  if (!o.boot) await page.waitForTimeout(o.settle ?? 1500);
  return { ctx, page, o };
}
const until = (page, fn, arg, ms = 8000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const bootDone = (page) => page.waitForSelector('#boot', { state: 'detached', timeout: 60000 }).then(() => true, () => false);
const seen = (page) => page.evaluate(() => ({ texts: [...window.__bp.texts], state: JSON.parse(JSON.stringify(window.__bootState ?? null)), hold: window.__bp.hold.slice(-1)[0] ?? '', holdAt: window.__bp.holdAt, heldAt: window.__bp.heldAt, skipH: window.__bp.skipH }));
const still = (page, name) => page.screenshot({ path: `${out}/bootpass-${name}-440-${STILL}.png` }).catch(() => undefined);

// ================================================================ the pure words
if (on('words')) {
  log('pure words');
  const hr = (h) => bw?.greetingFor('', h);
  check(!!bw && hr(20) === 'Good evening.' && bw.greetingFor('Boss', 20) === 'Good evening.' && bw.greetingFor('  ', 7) === 'Good morning.' && bw.greetingFor('Tony', 20) === 'Good evening, Tony.' && bw.greetingFor('', 3) === 'Good night.',
    `[THE BOOT · the greeting is never a stand-in] "${hr(20)}", with Boss "${bw?.greetingFor('Boss', 20)}", with Tony "${bw?.greetingFor('Tony', 20)}" (want "Good evening." alone for none or the app's own Boss, his name when he saved one)`);
  check(!!bw && /^I couldn’t start this time\. Tap to try again\.$/.test(bw.FAULT_WORDS), `[THE BOOT · the fault says the next thing] "${bw?.FAULT_WORDS}"`);
  const hw = bw ? [bw.holdWords({ online: false, brain: null }), bw.holdWords({ online: true, brain: null }), bw.holdWords({ online: true, brain: true })] : [];
  check(hw.length === 3 && hw.every((w) => /^Still starting, .+\.$/.test(w) && !/\.\./.test(w)) && /signal/.test(hw[0]) && /brain/.test(hw[1]) && new Set(hw).size === 3, `[THE BOOT · the held landing says what it waits for] ${JSON.stringify(hw)}`);
  const st = bw?.settledFeeds({ watching: null, offline: false }, true);
  check(st?.watching === 0 && bw.settledFeeds({ watching: null, offline: false }, false).watching === null && bw.settledFeeds({ watching: null, offline: true }, true).watching === null && bw.settledFeeds({ watching: 2, offline: false }, true).watching === 2,
    '[THE BOOT · CHECKING FEEDS settles] settledFeeds');
  const said = ow ? Object.values(ow.STATE_WORDS) : [];
  check(!!ow && ow.STATE_WORDS.listening === 'I’m listening.' && said.length >= 4 && said.every((w) => /^[A-Z][^.]*\.$/.test(w)) && /^I can’t reach my brain/.test(ow.offlineWords(true)) && /signal/.test(ow.offlineWords(false)) && /14:32/.test(ow.coolingWords('14:32')) && /^I’m holding still/.test(ow.HEAVY_WORDS) && /every room\.$/.test(ow.PRESS_HINT),
    `[THE ORB · the words] ${JSON.stringify(ow && { s: ow.STATE_WORDS, o: ow.offlineWords(true), c: ow.coolingWords('14:32') })}`);
  // THE RIBBON · one sentence per state, the first true one, nothing a developer would say
  const D = { online: true, brain: true, busy: false, status: '', cool: '', failed: false, retry: false, done: false, live: '' };
  const table = rw ? {
    idle: rw.doingWords(D), turn: rw.doingWords({ ...D, busy: true }), tool: rw.doingWords({ ...D, busy: true, status: 'LOOKING THAT UP…' }), bare: rw.doingWords({ ...D, busy: true, status: 'SEARCHING' }),
    done: rw.doingWords({ ...D, done: true }), failed: rw.doingWords({ ...D, failed: true, retry: true }), failedNoRetry: rw.doingWords({ ...D, failed: true }), offline: rw.doingWords({ ...D, online: false }),
    dead: rw.doingWords({ ...D, brain: false }), cooling: rw.doingWords({ ...D, busy: true, cool: '14:32' }), long: rw.doingWords({ ...D, busy: true, status: 'reading the manual for the washing machine, then the one for the dryer, then the warranty' }),
  } : {};
  const all = Object.values(table);
  check(all.length === 11 && all.every((w) => /^[A-Z][^.…]*\.( Tap RETRY\.)?$/.test(w)) && table.tool === 'Looking that up.' && table.bare === 'Thinking it over.' && /RETRY/.test(table.failed) && !/RETRY/.test(table.failedNoRetry) && /14:32/.test(table.cooling) && /signal/.test(table.offline) && /brain/.test(table.dead) && table.long.length <= 46 && !/\b(init|ws|fetch|ready|tilt|light|undefined)\b/i.test(all.join(' ')),
    `[THE RIBBON · one sentence per state, in his voice] ${JSON.stringify(table)}`);
}

// ================================================================ THE BOOT
if (on('boot')) {
  log('THE BOOT (the flat kind: WebGL refused)');
  // the greeting, in the page, with the name the app starts with and with none: never a stand-in
  for (const name of ['Boss', null, 'Tony']) {
    const { ctx, page } = await phone(PHONE, { boot: true, kind: 'flat', name });
    await bootDone(page);
    const s = await seen(page);
    const want = new Date().getHours();
    const g = s.state?.greeting ?? '';
    const ok = name === 'Tony' ? /^Good (night|morning|afternoon|evening), Tony\.$/.test(g) : /^Good (night|morning|afternoon|evening)\.$/.test(g) && !/Boss/.test(s.texts.join(' '));
    check(ok, `[THE BOOT · no placeholder greets] name ${JSON.stringify(name)}: greeting "${g}" (the hour ${want}); words seen ${JSON.stringify(s.texts.slice(-1))}`);
    await ctx.close();
  }
  // the fault: the next thing, and the tap does it
  {
    const { ctx, page } = await phone(PHONE, { boot: true, kind: 'flat' });
    await bootDone(page);
    await page.waitForTimeout(500);
    const has = await page.evaluate(() => typeof window.__bootFault);
    if (has === 'function') {
      await page.evaluate(() => window.__bootFault());
      const f = await page.evaluate(() => {
        const b = document.querySelector('#boot .bfault');
        const btn = b?.querySelector('button');
        const r = btn?.getBoundingClientRect();
        return { text: b?.querySelector('p')?.textContent ?? '', h: r?.height ?? 0, alert: b?.getAttribute('role') ?? '' };
      });
      await still(page, 'fault');
      const nav = page.waitForEvent('framenavigated', { timeout: 8000 }).then(() => true, () => false);
      await page.mouse.click(220, 300);
      check(f.text === bw?.FAULT_WORDS && f.h >= 44 && f.alert === 'alert' && (await nav), `[THE BOOT · the fault says the next thing and the tap does it] ${JSON.stringify(f)}; reloaded on a tap on the layer: ${await nav}`);
    } else check(false, '[THE BOOT · the fault says the next thing and the tap does it] the page cannot show the fault (no __bootFault)');
    await ctx.close();
  }
  // CHECKING FEEDS settles: no feed answers (the guardian is down), the stamp says so by the recognition, never holds
  {
    const { ctx, page } = await phone(PHONE, { boot: true, kind: 'flat', noGuardian: true });
    await bootDone(page);
    const s = await seen(page);
    const stamp = (s.state?.stamp ?? []).join(' · ');
    check(/No feeds yet/.test(stamp) && !/Checking feeds/i.test(stamp), `[THE BOOT · CHECKING FEEDS settles within the storyboard's time] the stamp at its end: "${stamp}"`);
    await ctx.close();
  }
  // offline: the stamp says so in one line, no feed is pretended
  {
    const { ctx, page } = await phone(PHONE, { boot: true, kind: 'flat', offline: true });
    await bootDone(page);
    const s = await seen(page);
    const stamp = (s.state?.stamp ?? []).join(' · ');
    check(/Offline, feeds paused/.test(stamp) && !/Checking|Watching/i.test(stamp) && (s.state?.feedLines ?? []).length === 0, `[THE BOOT · offline said in one line, no feed pretended] stamp "${stamp}", feed lines ${JSON.stringify(s.state?.feedLines)}`);
    await ctx.close();
  }
  // TAP TO SKIP: a target of 44 pt
  {
    const { ctx, page } = await phone(PHONE, { boot: true, kind: 'flat' });
    await bootDone(page);
    const s = await seen(page);
    check(s.skipH >= 44, `[THE BOOT · TAP TO SKIP is 44 pt] its tallest box ${s.skipH} px`);
    await ctx.close();
  }
  // every shot of the flat kind and of Reduce Motion carries the full cut's words: the stamp's day, G H O S T Y, his greeting, "Tap to skip".
  // The boot is stepped by hand (as boot.spec does) so a loaded machine's late frames cannot hide a shot: the words at each shot of its cut.
  for (const [label, o] of [['the flat kind', { kind: 'flat' }], ['Reduce Motion', { kind: 'still', reduced: true }]]) {
    const { ctx, page } = await phone(PHONE, { boot: true, manual: true, ...o });
    await until(page, () => typeof window.__bootSeek === 'function', null, 20000);
    await page.evaluate(() => window.__bootSeek(0));
    // (the cut that played: each beat's own time, a little past it, and the last moment before the landing)
    const tl = await page.evaluate(() => window.__bootState.timeline);
    const cut = [...Object.entries(tl).filter(([k]) => k !== 'end' && k !== 'ground').map(([, v]) => v + 20), tl.land - 5];
    const shots = [];
    for (const ms of cut) {
      await page.evaluate((ms) => window.__bootSeek(ms), ms);
      shots.push(await page.evaluate(() => (document.getElementById('boot')?.innerText ?? '').replace(/\u00a0/g, ' ').replace(/\s*\n\s*/g, ' | ').trim()));
      if (ms === cut[3]) await still(page, label === 'Reduce Motion' ? 'boot-still' : 'boot-flat');
    }
    const all = shots.join('\n');
    check(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/i.test(all) && /GHOSTY/.test(all) && /Good (night|morning|afternoon|evening)(, Tony)?\./.test(all) && /tap to skip/i.test(all) && !/Boss/.test(all), `[THE BOOT · ${label} carries every word the full cut does] ${JSON.stringify(shots)}`);
    await ctx.close();
  }
  // the slow open: the hold's line within 1.5 s of the landing being held, in the stamp's small type, never a frozen frame; the landing with no cut
  {
    const { ctx, page } = await phone(PHONE, { boot: true, kind: 'flat', slow: 7000 });
    await until(page, () => window.__bootState?.held > 1400, null, 30000);
    await still(page, 'hold');
    await bootDone(page);
    const s = await seen(page);
    const lag = s.holdAt > 0 && s.heldAt > 0 ? Math.round(s.holdAt - s.heldAt) : -1;
    check(s.hold === bw?.holdWords({ online: true, brain: null }) || /^Still starting, /.test(s.hold), `[THE BOOT · a slow open says what it waits for] hold line "${s.hold}"`);
    check(lag >= 0 && lag <= 1500, `[THE BOOT · the hold's line comes within 1.5 s of the hold] ${lag} ms after the landing began to wait`);
    check((s.state?.budget?.gaps ?? []).every((g) => g <= 1500) && s.state?.worstGap <= 1500, `[THE BOOT · a slow open never holds a frame] worst gap ${s.state?.worstGap} ms`);
    await ctx.close();
  }
}

// ================================================================ THE ORB
if (on('orb')) {
  log('THE ORB');
  for (const vp of [PHONE, PHONE2]) {
    const tag = `${vp.width}`;
    const { ctx, page } = await phone(vp, { hero: true, reduced: true, settle: 2500 });
    await until(page, () => window.__ghosty?.hero?.mode === 'mind', null, 60000);
    // only the orb's own pixels are measured: everything else on the page (the rings, the plates, the line under the orb) is hidden
    await page.evaluate(() => { const c = document.querySelector('canvas.mindhero'); document.querySelectorAll('body *').forEach((e) => { if (!e.contains(c) && !c.contains(e)) e.style.visibility = 'hidden'; }); c.style.visibility = 'visible'; });
    const shotOf = async (name) => {
      const loc = page.locator('canvas.mindhero');
      const b = await loc.screenshot({ timeout: 90000 });
      if (vp === PHONE) await loc.screenshot({ path: `${out}/bootpass-orb-${name}-440-${STILL}.png`, timeout: 90000 }).catch(() => undefined);
      return b.toString('base64');
    };
    /** Mean brightness 0..255 of a screenshot, and the mean absolute difference between two (read in the page: no image library). */
    // (`box`, in the canvas's CSS px: only that part is read; the orb's own square, so the world drawn behind it is left out)
    const px = (a, b, box = null) => page.evaluate(async ([a, b, box]) => {
      const load = (s) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = `data:image/png;base64,${s}`; });
      const cw = document.querySelector('canvas.mindhero')?.getBoundingClientRect().width || 1;
      const get = async (s) => { const i = await load(s); const k = i.width / cw; const [x, y, w, h] = box ? box.map((v) => Math.round(v * k)) : [0, 0, i.width, i.height]; const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(i, x, y, w, h, 0, 0, w, h); return g.getImageData(0, 0, w, h).data; };
      const A = await get(a);
      const B = b ? await get(b) : null;
      let sum = 0, d = 0;
      const L = [];
      for (let k = 0; k < A.length; k += 4) { L.push((A[k] + A[k + 1] + A[k + 2]) / 3); sum += (A[k] + A[k + 1] + A[k + 2]) / 3; if (B) d += (Math.abs(A[k] - B[k]) + Math.abs(A[k + 1] - B[k + 1]) + Math.abs(A[k + 2] - B[k + 2])) / 3; }
      L.sort((x, y) => x - y);
      return { lum: sum / (A.length / 4), p97: L[Math.floor(L.length * 0.97)], diff: B ? d / (A.length / 4) : 0 };
    }, [a, b, box]);
    const setState = async (st, ms = 900) => {
      await page.evaluate(async (st) => {
        const U = window.__ghosty.ui;
        U.set({ voice: 'idle', busy: false });
        if (window.__box) { window.__box.hidden = true; window.__box.remove(); window.__box = null; }
        if (st === 'listening') U.set({ voice: 'listening' });
        if (st === 'thinking') U.set({ busy: true, voice: 'idle' });
        if (st === 'speaking') U.set({ voice: 'speaking' });
        if (st === 'attending') {
          const M = window.__ghosty.machine;
          window.__box = M.lockBox(document.querySelector('.hud.core .rwrap') ?? document.body);
          await M.recognise(window.__box, document.querySelector('.hud.core canvas.reactor'), { name: 'Mind' });
        }
      }, st);
      await page.waitForTimeout(ms);
    };
    const order = ['idle', 'listening', 'attending', 'thinking', 'speaking'];
    const shots = {};
    for (const st of order) {
      await setState(st);
      shots[st] = await shotOf(st);
    }
    // the orb's five states told apart with the motion off by the light alone: each pair differs by a measured amount, read in the orb's
    // own square (MIND's stage rect, else the Scan's orb), relative to the canvas
    const orbBox = await page.evaluate(() => {
      const c = document.querySelector('canvas.mindhero').getBoundingClientRect();
      const r = window.__ghosty.hero?.stage?.rect;
      if (r && r[2] > 8) return r;
      const o = document.querySelector('.scanorb')?.getBoundingClientRect();
      return o && o.width > 8 ? [o.left - c.left, o.top - c.top, o.width, o.height] : null;
    });
    const reads = {};
    let least = 1e9, pair = '';
    for (let i = 0; i < order.length; i++) {
      reads[order[i]] = Math.round((await px(shots[order[i]], null, orbBox)).lum * 100) / 100;
      for (let j = i + 1; j < order.length; j++) {
        const r = await px(shots[order[i]], shots[order[j]], orbBox);
        if (r.diff < least) { least = r.diff; pair = `${order[i]}/${order[j]}`; }
      }
    }
    await setState('idle', 600);
    const idle2 = await shotOf('idle2');
    const idleP97 = (await px(idle2)).p97;
    // (the same state shot twice is the floor: two states must differ by twice what idle differs from itself, so a world that moves
    // between shots can never pass for states told apart)
    const floor = (await px(shots.idle, idle2, orbBox)).diff;
    check(!!orbBox && least >= 5 && least >= 2 * floor, `[THE ORB · ${tag} · five states told apart with the motion off] in the orb's square ${JSON.stringify(orbBox)} the two most alike are ${pair}, a mean difference of ${least.toFixed(2)} of 255 (want 5 or more, and twice idle against itself: ${floor.toFixed(2)}); light ${JSON.stringify(reads)}`);
    // the press target is 44 pt at least
    const tgt = await page.evaluate(() => { const r = document.querySelector('canvas.mindhero')?.getBoundingClientRect(); const o = document.querySelector('.scanorb')?.getBoundingClientRect(); return { w: Math.round(r?.width ?? 0), h: Math.round(r?.height ?? 0), hw: Math.round(o?.width ?? 0), hh: Math.round(o?.height ?? 0) }; });
    check(tgt.w >= 44 && tgt.h >= 44 && tgt.hw >= 44 && tgt.hh >= 44, `[THE ORB · ${tag} · the press target is 44 pt] ${JSON.stringify(tgt)}`);
    // the first time he sees listening / thinking, a line under it says so, once (and not again)
    await page.evaluate(() => { localStorage.removeItem('ghosty.orbsaid'); window.__ghosty.orbsay && (window.__ghosty.orbsay.said.length = 0); });
    await setState('listening', 400);
    const l1 = await page.evaluate(() => ({ said: window.__ghosty.orbsay?.said ?? null, text: document.querySelector('.orbsay')?.textContent ?? '', hidden: document.querySelector('.orbsay')?.hidden ?? true, live: document.querySelector('.orbsay')?.getAttribute('role') }));
    if (vp === PHONE) await still(page, 'orb-says');
    await setState('idle', 300);
    await setState('listening', 400);
    const l2 = await page.evaluate(() => window.__ghosty.orbsay?.said ?? null);
    check(l1.text === ow?.STATE_WORDS.listening && !l1.hidden && l1.live === 'status' && l2?.filter((t) => t === ow?.STATE_WORDS.listening).length === 1, `[THE ORB · ${tag} · listening said once in words on first use] ${JSON.stringify({ l1, l2 })}`);
    await setState('idle', 300);
    // the brain gone: the orb goes low (measurably dimmer than idle) and says why; no pulses
    await page.evaluate(() => window.__ghosty.ui.set({ connected: false, voice: 'idle', busy: false }));
    await page.waitForTimeout(1200);
    const dead = await shotOf('dead');
    const off = await px(dead);
    const offSay = await page.evaluate(() => ({ text: (window.__ghosty.orbsay?.said ?? []).filter((t) => /resting/.test(t)).slice(-1)[0] ?? '', state: window.__ghosty.hero.state }));
    if (vp === PHONE) await still(page, 'orb-dead-says');
    check(offSay.state === 'offline' && off.p97 < idleP97 * 0.75 && offSay.text === ow?.offlineWords(true), `[THE ORB · ${tag} · a dead brain dims the orb and says why] state ${offSay.state}, brightest light ${off.p97.toFixed(1)} against idle ${idleP97.toFixed(1)} (want under 75 % of it), line "${offSay.text}"`);
    await page.evaluate(() => window.__ghosty.ui.set({ connected: true }));
    await ctx.close();
  }
  // the models cooling: the time said, and the pulses slowed (read from the one number the light is drawn with)
  {
    const { ctx, page } = await phone(PHONE, { hero: true, settle: 2500 });
    await until(page, () => window.__ghosty?.hero?.mode === 'mind', null, 60000);
    const r = await page.evaluate(async () => {
      const at = Date.now() + 90_000;
      window.__ghosty.ui.set({ busy: true, voice: 'idle', coolUntil: at });
      await new Promise((s) => setTimeout(s, 500));
      return { text: document.querySelector('.orbsay')?.textContent ?? '', at: new Date(at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) };
    });
    check(!!ow && r.text === ow.coolingWords(r.at), `[THE ORB · cooling is said with its time] "${r.text}" (want the first back at ${r.at})`);
    await ctx.close();
  }
  // the press: a hint from the first press, one sentence, once (in a world with no hint of its own: ONE INK)
  {
    const { ctx, page } = await phone(PHONE, { hero: true, world: 'ink', settle: 2500 });
    await page.evaluate(() => { localStorage.removeItem('ghosty.orbpresses'); window.__ghosty.orbsay && (window.__ghosty.orbsay.said.length = 0); });
    const press = async () => { await page.evaluate(() => document.querySelector('canvas.reactor')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))); await page.waitForTimeout(250); };
    await press();
    const a = await page.evaluate(() => window.__ghosty.orbsay?.said ?? null);
    await press();
    await press();
    const b = await page.evaluate(() => window.__ghosty.orbsay?.said ?? null);
    check(a?.length === 1 && a[0] === ow?.PRESS_HINT && b?.length === 1, `[THE ORB · the press's hint is said from the first press, once] after one ${JSON.stringify(a)}, after three ${JSON.stringify(b)}`);
    await ctx.close();
  }
  // heavy mode: the still frame says once why it is still
  {
    const { ctx, page } = await phone(PHONE, { hero: true, settle: 2500 });
    await until(page, () => window.__ghosty?.hero?.mode === 'mind', null, 60000);
    const said = await page.evaluate(async () => {
      const heavy = window.__ghosty.heavy;
      if (!heavy?.set) return null;
      heavy.set({ on: true, why: 'a paper' });
      await new Promise((s) => setTimeout(s, 300));
      heavy.set({ on: false, why: '' });
      heavy.set({ on: true, why: 'a paper' });
      await new Promise((s) => setTimeout(s, 300));
      return window.__ghosty.orbsay?.said?.filter((t) => /holding still/.test(t)) ?? null;
    });
    check(Array.isArray(said) && said.length === 1 && said[0] === ow?.HEAVY_WORDS, `[THE ORB · heavy mode's still frame says why, once] ${JSON.stringify(said)}`);
    await ctx.close();
  }
}

// ================================================================ THE RIBBON
if (on('ribbon')) {
  log('THE RIBBON');
  for (const vp of [PHONE, PHONE2]) {
    const tag = `${vp.width}`;
    const { ctx, page } = await phone(vp, { hero: false, chatDown: true, settle: 3500 });
    await until(page, () => document.querySelectorAll('.scanribbon .g-truth').length === 5, null, 20000);
    const rib = () => page.evaluate(() => { const e = document.querySelector('.scanribbon'); const k = [...e.querySelectorAll('.g-truth')]; const r = e.getBoundingClientRect(); return { last: k[4]?.textContent?.trim() ?? '', all: e.textContent.replace(/\s+/g, ' ').trim(), cut: k.filter((x) => x.scrollWidth > x.clientWidth + 1).length, out: r.right > innerWidth + 1 || r.left < -1, ell: getComputedStyle(e).textOverflow, ow: getComputedStyle(e).overflow, role: k[4]?.getAttribute('role') ?? '', lines: Math.round(r.height / parseFloat(getComputedStyle(e).lineHeight || '16')), h: k[4]?.getBoundingClientRect().height ?? 0, w: e.getBoundingClientRect().width }; });
    const idle = await rib();
    if (vp === PHONE) await still(page, 'ribbon-idle');
    check(idle.lines <= 2, `[THE RIBBON · ${tag} · idle keeps the ribbon to its two lines] ${idle.lines} lines: "${idle.all}"`);
    check(idle.last === rw?.doingWords({ online: true, brain: true, busy: false, status: '', cool: '', failed: false, retry: false, done: false, live: '' }) || /^[A-Z][^.…]*\.$/.test(idle.last), `[THE RIBBON · ${tag} · idle is a sentence] "${idle.last}"`);
    // a turn running with a tool
    await page.evaluate(() => window.__ghosty.ui.set({ busy: true, status: 'looking that up…' }));
    await page.waitForTimeout(500);
    const tool = await rib();
    if (vp === PHONE) await still(page, 'ribbon-tool');
    check(tool.last === 'Looking that up.', `[THE RIBBON · ${tag} · a tool's line is a sentence, never a bare verb] "${tool.last}"`);
    // the models cooling, with the time
    await page.evaluate(() => window.__ghosty.ui.set({ coolUntil: Date.now() + 120_000 }));
    await page.waitForTimeout(500);
    const cool = await rib();
    if (vp === PHONE) await still(page, 'ribbon-cooling');
    check(/^Cooling down until \d\d:\d\d\.$/.test(cool.last), `[THE RIBBON · ${tag} · cooling says its time] "${cool.last}"`);
    await page.evaluate(() => window.__ghosty.ui.set({ busy: false, status: '', coolUntil: 0 }));
    // the brain gone / no signal
    await page.evaluate(() => window.__ghosty.ui.set({ connected: false }));
    await page.waitForTimeout(500);
    const dead = await rib();
    check(dead.last === 'I can’t reach my brain.', `[THE RIBBON · ${tag} · the brain gone is said] "${dead.last}"`);
    await page.evaluate(() => window.__ghosty.ui.set({ connected: true }));
    // a failed send: the line says so and RETRY is the part itself, 44 pt tall (the send is refused by a route)
    await page.evaluate(() => {
      const c = window.__ghosty.chat;
      if (c) c.set({ entries: [...c.get().entries, { kind: 'error', text: 'x', retry: 'what is the weather' }] });
    });
    await page.waitForTimeout(500);
    const fail = await rib();
    if (vp === PHONE) await still(page, 'ribbon-failed');
    check(/^That didn’t go through\. Tap RETRY\.$/.test(fail.last) && fail.role === 'button' && fail.h >= 44, `[THE RIBBON · ${tag} · a failed turn says so with RETRY, a 44 pt part] ${JSON.stringify({ last: fail.last, role: fail.role, h: fail.h })}`);
    // no developer word on it, ever
    check(!/\b(init|ws|fetch|ready|tilt|undefined|NaN|null)\b/i.test(fail.all + ' ' + idle.all), `[THE RIBBON · ${tag} · the tilt and the hour's light and the plumbing are named nowhere] "${idle.all}"`);
    await ctx.close();
    // the biggest text, BODY 21: a long tool line wraps or stops at its first clause; nothing cut, nothing past the screen, no ellipsis
    {
      const big = await phone(vp, { body: 21, settle: 3500 });
      await until(big.page, () => document.querySelectorAll('.scanribbon .g-truth').length === 5, null, 20000);
      await big.page.evaluate(() => window.__ghosty.ui.set({ busy: true, status: 'reading the manual for the washing machine, then the one for the dryer, then the warranty…' }));
      await big.page.waitForTimeout(600);
      const r = await big.page.evaluate(() => { const e = document.querySelector('.scanribbon'); const k = [...e.querySelectorAll('.g-truth')]; const b = e.getBoundingClientRect(); return { cut: k.filter((x) => x.scrollWidth > x.clientWidth + 1).length, out: b.right > innerWidth + 1 || b.left < -1, ell: getComputedStyle(e).textOverflow, last: k[4]?.textContent?.trim() ?? '', fs: parseFloat(getComputedStyle(k[4]).fontSize) }; });
      if (vp === PHONE) await big.page.screenshot({ path: `${out}/bootpass-ribbon-body21-440-${STILL}.png` }).catch(() => undefined);
      check(r.cut === 0 && !r.out && r.ell !== 'ellipsis' && /^[A-Z][^…]*\.$/.test(r.last) && r.last.length <= 46, `[THE RIBBON · ${tag} · nothing cut at BODY 21] ${JSON.stringify(r)}`);
      await big.ctx.close();
    }
  }
}

await browser.close();
console.log(`(bootpass spec: ${((Date.now() - t0) / 1000).toFixed(1)} s, ${checks} checks)`);
if (problems.length) {
  console.log(`PROBLEMS (${problems.length}):\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('QUALITY PASS: THE BOOT AND THE ORB run clean at 440 × 956 and 390 × 844: no placeholder greets, the fault says the next thing and the tap does it, CHECKING FEEDS settles, offline is one line, TAP TO SKIP is 44 pt, the flat kind and Reduce Motion carry the full cut\'s words, a slow open says what it waits for within 1.5 s; the orb\'s five states differ with the motion off, a dead brain dims it and says why, cooling shows its time, the press and heavy mode say their one line once; the ribbon has one sentence for every state, RETRY as a 44 pt part, nothing cut at the biggest text.');
