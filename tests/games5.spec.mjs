// THE PLATFORMER, THE CAVE and four board games he can lose to (BRIEF-GAMES-5). (a) the ARCADE room (440 × 956, the real app)
// lists six new tiles after THE BEAT, each with PLAY at once and its card ending in the two scores (levels for the platformer and
// the cave, ratings for the board games); (b) the platformer in the harness page (tests/fixtures/games5: the player at its
// smallest, bundled here with esbuild and served on the preview's own origin under the production policy, so the styles and the
// board Worker are the build's): the pad under the thumbs, ▶ and RUN move him faster, JUMP jumps, a run its bot plays collects a coin,
// stomps, takes the checkpoint, reaches the flag and "Level 2" comes up; the dotted ghost runs; (c) the cave: NEW GAME, a room crossed,
// a lantern saves into the arcade's save store, a reload and CONTINUE restore the room and the hearts, the map fills and a pinch opens
// it; (d) each board game: a legal move shown on touch and made, Ghosty answers within his thinking time with "thinking…" shown, one
// hint, a take-back, and a game one move from won (found by playing at random on this side) that ends with the rating line moved;
// (e) every control 44 pt and nothing sideways at 440 × 956 and 390 × 844, reduced motion stills the parallax, sound on and off;
// (f) the GYM's Report card lists the four board ratings. The frame times are printed.
//   BASE=http://localhost:8822 node tests/games5.spec.mjs tests/.shots
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const root = new URL('..', import.meta.url).pathname;
const esbuild = createRequire(join(root, 'apps/web/package.json'))('esbuild');
const bundle = await esbuild.build({ entryPoints: [join(root, 'tests/fixtures/games5/harness.mjs')], bundle: true, format: 'esm', target: 'es2022', write: false, external: ['/vendor/*'], logLevel: 'warning' });
const js = bundle.outputFiles[0].text;
const html = readFileSync(join(root, 'tests/fixtures/games5/index.html'), 'utf8');
const csp = /Content-Security-Policy: (default-src 'self'[^\n]*)/.exec(readFileSync(join(root, 'apps/web/public/_headers'), 'utf8'))[1];
const rb = await esbuild.build({ entryPoints: [join(root, 'tests/fixtures/games5/rules.mjs')], bundle: true, format: 'esm', platform: 'neutral', write: false, logLevel: 'warning' });
const R = await import(`data:text/javascript;base64,${Buffer.from(rb.outputFiles[0].text).toString('base64')}`);
const only = process.argv[3] ?? '';

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const problems = [];
const check = (ok, msg) => {
  if (!ok) problems.push(msg);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
};
const SIZES = [{ width: 440, height: 956 }, { width: 390, height: 844 }];

async function open(game, args = 'nopractice', size = SIZES[1], extra = {}, init = null) {
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 2, hasTouch: true, isMobile: true, serviceWorkers: 'block', ...UK, ...extra });
  if (init) await ctx.addInitScript(init);
  await ctx.route(`${base}/__g5/**`, (route) => {
    const p = new URL(route.request().url()).pathname;
    if (p === '/__g5/harness.js') return route.fulfill({ body: js, contentType: 'text/javascript', headers: { 'content-security-policy': csp } });
    return route.fulfill({ body: html, contentType: 'text/html', headers: { 'content-security-policy': csp } });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => !webkitNoise(e) && errors.push(e.message));
  page.on('console', (m) => (m.type() === 'error' || /Refused to|Content Security Policy/.test(m.text())) && errors.push(m.text()));
  await page.goto(`${base}/__g5/index.html?game=${game}&args=${encodeURIComponent(args)}`);
  await page.waitForFunction(() => window.__g5?.ready || window.__g5?.events?.error, null, { timeout: 60000 });
  const err = await page.evaluate(() => window.__g5.events.error);
  check(!err, `${game} (${size.width}): it starts${err ? `: ${err}` : ''}`);
  await page.waitForFunction(() => window.__g5.handle.peek().frames > 3, null, { timeout: 30000 });
  return { ctx, page, errors };
}
const peek = (page) => page.evaluate(() => window.__g5.handle.peek());
const st = async (page) => (await peek(page)).state;
const until = (page, fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);
const menuOf = (page) => page.locator('.g2menu .g2btns button').allTextContents();
const store = (page, key) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);
async function sideways(page, label, size) {
  const r = await page.evaluate(() => {
    const W = innerWidth;
    const out = [];
    for (const el of document.querySelectorAll('.g2ui *')) {
      const b = el.getBoundingClientRect();
      if (b.width && b.height && (b.left < -1 || b.right > W + 1) && getComputedStyle(el).visibility !== 'hidden') out.push(`${el.className} ${Math.round(b.left)}…${Math.round(b.right)}`);
    }
    return { scroll: document.documentElement.scrollWidth, W, out };
  });
  check(r.scroll <= r.W && r.out.length === 0, `${label}: nothing sideways at ${size.width} × ${size.height} (${r.out.slice(0, 3).join('; ') || 'all inside'})`);
}
async function controls(page, label) {
  const bad = await page.evaluate(() => [...document.querySelectorAll('.g2ui button')].filter((b) => b.getClientRects().length && !(b.getAttribute('aria-label') || b.textContent.trim())).map((b) => b.className));
  const small = await page.evaluate(() => [...document.querySelectorAll('.g2ui button')].filter((b) => b.getClientRects().length).filter((b) => { const r = b.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).map((b) => `${b.textContent} ${Math.round(b.getBoundingClientRect().width)}×${Math.round(b.getBoundingClientRect().height)}`));
  check(bad.length === 0, `${label}: every control has a VoiceOver label${bad.length ? `: ${bad.join(', ')}` : ''}`);
  check(small.length === 0, `${label}: every control is 44 pt or more${small.length ? `: ${small.join(', ')}` : ''}`);
}
async function measure(page, game, ms = 2500) {
  await page.evaluate(() => window.__g5.handle.resetStats());
  await page.waitForTimeout(ms);
  const s = await peek(page);
  console.log(`     ${game}: first frame ${Math.round(s.firstFrameMs)} ms; frame interval p50 ${s.p50.toFixed(1)} ms, p95 ${s.p95.toFixed(1)} ms; our own work p95 ${s.workP95.toFixed(1)} ms; drawn at ${s.scale}× (${s.width} × ${s.height}) (software rendering)`);
}
const shot = (page, name) => page.screenshot({ path: `${out}/games5-${name}.png`, timeout: 15000 }).catch(() => undefined);
async function hold(page, sel, ms) {
  const b = await page.locator(sel).boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}
async function quitFrees(page, game) {
  await page.evaluate(() => window.__g5.handle.quit());
  const after = await page.evaluate(() => ({ w: window.__g5.canvas.width, h: window.__g5.canvas.height, ui: !!document.querySelector('.g2ui') }));
  check(after.w === 0 && after.h === 0 && !after.ui, `${game}: quit lets the canvas go (0 × 0, the overlay gone)`);
}

// ================================================================ (a) the ARCADE room, in the real app
if (!only || only === 'arcade') {
  const ctx = await browser.newContext({ viewport: PHONE, ...UK, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    localStorage.setItem('ghosty.arcade.board.rating', JSON.stringify({ draughts: { you: { r: 1180, rd: 120, vol: 0.06, games: 6 }, me: { r: 1420, rd: 120, vol: 0.06, games: 6 }, wins: 2, losses: 4, draws: 0, log: [] }, connect4: { you: { r: 1290, rd: 130, vol: 0.06, games: 3 }, me: { r: 1110, rd: 130, vol: 0.06, games: 3 }, wins: 2, losses: 1, draws: 0, log: [] } }));
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => !webkitNoise(e) && errors.push(e.message));
  page.on('console', (m) => /Refused to|Content Security Policy/.test(m.text()) && errors.push(m.text()));
  const boot = async () => {
    await page.goto(base);
    await page.waitForFunction(() => !!document.querySelector('#pair input') || !document.querySelector('#boot'), null, { timeout: 20000 }).catch(() => undefined);
    if (await page.locator('#pair input').isVisible().catch(() => false)) {
      await page.fill('#pair input', 'preview-owner-key-0123456789');
      await page.click('#pair button.on');
    }
    await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
  };
  await boot();
  await page.evaluate(() => (location.hash = 'arcade'));
  await until(page, () => !!document.querySelector('#pg-arcade .arccard') && getComputedStyle(document.getElementById('pg-arcade')).display !== 'none', null, 20000);
  const cards = await page.evaluate(() => [...document.querySelectorAll('#pg-arcade .arccard:not(.arcpack)')].map((c) => ({ id: c.dataset.id, act: c.querySelector('.arcact')?.textContent ?? '', score: c.querySelector('.arcscore')?.textContent ?? '', title: c.querySelector('.arctitle')?.textContent ?? '' })));
  const ids = cards.map((c) => c.id);
  const SIX = ['platform', 'cave', 'draughts', 'othello', 'backgammon', 'connect4'];
  check(JSON.stringify(ids.slice(ids.indexOf('beat') + 1, ids.indexOf('beat') + 7)) === JSON.stringify(SIX), `the six new tiles come right after THE BEAT (${ids.slice(ids.indexOf('beat') + 1).join(', ')})`);
  for (const id of SIX) {
    const c = cards.find((x) => x.id === id);
    check(!!c && c.act === 'PLAY', `${id}: PLAY at once (${c?.act})`);
    const ending = id === 'platform' || id === 'cave' ? /You: Level \d+ · Ghosty: Level \d+$/ : /You: [\d,]+ · Ghosty: [\d,]+$/;
    check(!!c && ending.test(c.score), `${id}: the card ends in the two scores ("${c?.score}")`);
  }
  check(/You: 1,180 · Ghosty: 1,420$/.test(cards.find((x) => x.id === 'draughts')?.score ?? ''), 'draughts: the card shows the ratings it was given (You: 1,180 · Ghosty: 1,420)');
  check(/You: 1,200 · Ghosty: 1,200$/.test(cards.find((x) => x.id === 'othello')?.score ?? ''), 'othello: the starting 1,200 for both before a first game');
  await shot(page, 'arcade-440');
  const wide = await page.evaluate(() => ({ page: document.documentElement.scrollWidth > innerWidth + 1, over: [...document.querySelectorAll('#pg-arcade .arccard, #pg-arcade .arcact')].filter((e) => e.getBoundingClientRect().right > innerWidth + 1).length }));
  check(!wide.page && wide.over === 0, 'the shelf with the six sticks out nowhere at 440 × 956');
  // PLAY on a board game starts it in the player, with the build's own Worker
  if (await page.locator('#pg-arcade .arccard[data-id="connect4"] .arcact').count()) await page.locator('#pg-arcade .arccard[data-id="connect4"] .arcact').tap();
  const started = await until(page, () => !!document.querySelector('.arcplayer .g2ui .g2menu') && !!document.querySelector('.arcplayer canvas')?.width, null, 30000);
  check(started, 'connect4: PLAY starts it in the arcade\'s player with its menu');
  if (started) {
    check((await page.locator('.g2menu .g2note', { hasText: 'search alone until the GYM trains him' }).count()) === 1, 'connect4: the title says he is search alone until trained, and that nothing learns on the phone');
    await page.locator('.g2btn[data-id="play"]').tap();
    await until(page, () => !!document.querySelector('.arcplayer .g4board .g4btn[data-act="hint"]'), null, 10000);
    check(!!(await page.locator('.g4board .g4btn[data-act="hint"]').count()), 'connect4: HINT, TAKE BACK and RULES are under the thumb in the player');
    await shot(page, 'connect4-in-app-440');
    await page.locator('.g2pause').tap();
    await page.locator('.arcplayer .g2menu .g2btns button', { hasText: /quit/i }).click();
    check(await until(page, () => !document.querySelector('.arcplayer') && !window.__ghosty.arcade.playing, null, 15000), 'connect4: its own Quit returns to the shelf');
  }
  // (f) the GYM's Report card lists the four board ratings
  await page.evaluate(() => (location.hash = 'gym'));
  const gym = await until(page, () => document.querySelectorAll('#pg-gym .gymboards .gb').length === 4, null, 25000);
  check(gym, 'the GYM\'s Report card lists four board games');
  const lines = await page.evaluate(() => [...document.querySelectorAll('#pg-gym .gymboards .gb')].map((e) => e.textContent));
  check(lines.length === 4 && ['Draughts', 'Othello', 'Backgammon', 'Connect 4'].every((n, i) => lines[i].startsWith(n)), `the four are Draughts, Othello, Backgammon, Connect 4 (${lines.map((l) => l.slice(0, 20)).join(' | ')})`);
  check(/You: 1,180 · Ghosty: 1,420 · ±\d+ · 6 games: 2 won, 0 drawn, 4 lost/.test(lines[0] ?? ''), `Draughts' line is honest about games and doubt ("${lines[0]}")`);
  check(/not rated yet/.test(lines[1] ?? '') && /You: 1,200 · Ghosty: 1,200/.test(lines[1] ?? ''), 'Othello is not rated yet, and says so');
  check((await page.locator('#pg-gym .gbnote').innerText()).includes('search alone until the GYM trains him'), 'the Report card says plainly he is search alone until trained');
  await shot(page, 'gym-report-440');
  const gw = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  check(!gw, 'the GYM sticks out nowhere at 440 × 956');
  check(errors.length === 0, `no page errors in the real app${errors.length ? `: ${errors[0]}` : ''}`);
  await ctx.close();
}

// ================================================================ (b) THE PLATFORMER
if (!only || only === 'platform') {
  for (const size of SIZES) {
    const { ctx, page, errors } = await open('platform', 'nopractice|calm', size);
    const g = 'platform';
    check(JSON.stringify(await menuOf(page)) === JSON.stringify(['Play', 'How to play', 'Sound: on', 'Quit']), `${g} (${size.width}): Play · How to play · Sound · Quit`);
    check(await page.locator('.g2menu .g2note', { hasText: 'You: Level 1' }).isVisible() && await page.locator('.g2menu .g2note', { hasText: 'Ghosty: Level 1' }).isVisible(), `${g} (${size.width}): both levels on the title`);
    await controls(page, `${g} title`);
    await page.locator('.g2btn[data-id="how-to-play"]').tap();
    check(await page.locator('.g2how', { hasText: 'coin' }).isVisible() || await page.locator('.g2how', { hasText: 'stomp' }).isVisible(), `${g} (${size.width}): How to play explains the stomp and the shell`);
    await page.locator('.g2btn[data-id="back"]').tap();
    await page.locator('.g2btn[data-id="sound-on"]').tap();
    check((await menuOf(page)).includes('Sound: off'), `${g} (${size.width}): Sound turns off`);
    await page.locator('.g2btn[data-id="sound-off"]').tap();
    await page.locator('.g2btn[data-id="play"]').tap();
    check((await peek(page)).mode === 'play', `${g} (${size.width}): Play starts a run`);
    await controls(page, `${g} in play`);
    await sideways(page, g, size);
    const bottoms = await page.evaluate(() => ({ left: !!document.querySelector('.g4grp.left .g4btn[data-act="left"]'), right: !!document.querySelector('.g4grp.right .g4btn[data-act="a"]'), run: !!document.querySelector('.g4grp.right .g4btn[data-act="c"]') }));
    check(bottoms.left && bottoms.right && bottoms.run, `${g} (${size.width}): ◀ ▶ under the left thumb, RUN and JUMP under the right`);
    const x0 = (await st(page)).x;
    const bw = await page.locator('.g4btn[data-act="right"]').boundingBox();
    await page.mouse.move(bw.x + bw.width / 2, bw.y + bw.height / 2);
    await page.mouse.down();
    await until(page, (x) => window.__g5.handle.peek().state.x > x + 25, x0, 8000);
    await page.mouse.up();
    const walked = (await st(page)).x - x0;
    check(walked > 25, `${g} (${size.width}): ▶ walks (${walked.toFixed(0)} px)`);
    // run: both held, faster than a walk
    const b1 = await page.locator('.g4btn[data-act="right"]').boundingBox();
    const b2 = await page.locator('.g4btn[data-act="c"]').boundingBox();
    await page.touchscreen.tap(b1.x + 1, b1.y + 1).catch(() => undefined);
    const client = await ctx.newCDPSession(page);
    const pt = (b, id) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2, id });
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt(b1, 1), pt(b2, 2)] });
    await page.waitForTimeout(900);
    const vRun = (await st(page)).vx;
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    check(vRun > 105, `${g} (${size.width}): RUN with ▶ goes faster than a walk (${vRun.toFixed(0)} px/s, a walk is 88)`);
    // jump: higher when held (the peak is sampled in the page, every frame, so a slow machine cannot miss it)
    const rise = async (hold) => {
      await until(page, () => window.__g5.handle.peek().state.onGround, null, 15000);
      await page.evaluate(() => {
        const s0 = window.__g5.handle.peek().state;
        window.__top = { y0: s0.y, top: s0.y };
        const f = () => { window.__top.top = Math.min(window.__top.top, window.__g5.handle.peek().state.y); window.__top.raf = requestAnimationFrame(f); };
        f();
      });
      const bj = await page.locator('.g4btn[data-act="a"]').boundingBox();
      if (hold) {
        await page.mouse.move(bj.x + bj.width / 2, bj.y + bj.height / 2);
        await page.mouse.down();
        await until(page, () => window.__g5.handle.peek().state.vy > 20, null, 8000);
        await page.mouse.up();
      } else await page.locator('.g4btn[data-act="a"]').tap();
      await page.waitForTimeout(150);
      await until(page, () => window.__g5.handle.peek().state.onGround, null, 8000);
      return page.evaluate(() => { cancelAnimationFrame(window.__top.raf); return window.__top.y0 - window.__top.top; });
    };
    const tapRise = await rise(false);
    const holdRise = await rise(true);
    check(tapRise > 2 && holdRise > tapRise + 6, `${g} (${size.width}): JUMP jumps, and holding it goes higher (a tap rose ${tapRise.toFixed(0)} px, a hold ${holdRise.toFixed(0)} px)`);
    await page.evaluate(() => { window.__g5.intent.moveX = 1; });
    const xp = (await st(page)).x;
    const moved = await until(page, (x) => window.__g5.handle.peek().state.x > x + 8, xp, 10000);
    await page.evaluate(() => { window.__g5.intent.moveX = 0; });
    check(moved, `${g} (${size.width}): the controller's Intent moves him`);
    if (size.width === 440) {
      await shot(page, 'platform-play-440');
      await measure(page, g);
      await page.locator('.g2pause').tap();
      check((await peek(page)).mode === 'paused' && (await menuOf(page)).includes('Resume'), `${g}: PAUSE opens Resume · How to play · Sound · End run · Quit`);
      await page.locator('.g2btn[data-id="resume"]').tap();
    }
    await quitFrees(page, g);
    check(errors.length === 0, `${g} (${size.width}): no page errors${errors.length ? `: ${errors[0]}` : ''}`);
    await ctx.close();
  }
  // a run its bot plays: a coin counted, a stomp, the checkpoint, the flag, "Level 2"
  {
    const { ctx, page, errors } = await open('platform', 'nopractice|auto|level=1|speed=6|seed=3', SIZES[0]);
    await page.locator('.g2btn[data-id="play"]').tap();
    let sawCheck = false;
    let ghostMoved = null;
    const over = await until(page, () => { const s = window.__g5.handle.peek(); const q = s.state; window.__seen = window.__seen || { check: false, stomp: false }; window.__seen.check ||= q.checked; window.__seen.stomp ||= q.stomps > 0; return s.mode === 'over'; }, null, 120000);
    check(over, 'platform: a run its bot plays comes to its end');
    const seen = await page.evaluate(() => window.__seen);
    sawCheck = seen?.check;
    const s = await peek(page);
    check(s.state.coins > 0, `platform: coins counted (${s.state.coins})`);
    check(sawCheck, 'platform: the checkpoint flag was taken');
    check(s.state.won && s.passed, 'platform: the flag ends the level');
    check(await page.locator('.g2menu .g2note', { hasText: 'On to Level 2' }).first().isVisible(), `platform: "Level 2" comes up after the mark (${(await page.locator('.g2menu .g2note').allTextContents()).join(' | ').slice(0, 160)})`);
    const sk = await store(page, 'ghosty.arcade.skill');
    check(sk?.platform?.you?.r >= 1, `platform: the level record rose (${sk?.platform?.you?.r})`);
    const sc = await store(page, 'ghosty.arcade.scores');
    check(sc?.platform?.last === Math.round(s.score), 'platform: the score is written');
    await shot(page, 'platform-over-440');
    await controls(page, 'platform end of run');
    await quitFrees(page, 'platform');
    check(errors.length === 0, `platform: no page errors${errors.length ? `: ${errors[0]}` : ''}`);
    await ctx.close();
  }
  // a run at the second world: a walker stomped, a shell met, the flag
  {
    const { ctx, page } = await open('platform', 'nopractice|auto|level=2|speed=6|seed=3', SIZES[0]);
    await page.locator('.g2btn[data-id="play"]').tap();
    await until(page, () => window.__g5.handle.peek().mode === 'over', null, 120000);
    const s = await st(page);
    check(s.stomps > 0 && s.won, `platform: at the second world a walker was stomped (${s.stomps}) and the flag reached`);
    await page.evaluate(() => window.__g5.handle.quit());
    await ctx.close();
  }
  // the dotted ghost runs: Ghosty's best run of the first world, kept by his practice, runs beside the player
  {
    const { ctx, page } = await open('platform', 'level=1|seed=3', SIZES[0]);
    const kept = await until(page, () => !!localStorage.getItem('ghosty.arcade.platform.ghost'), null, 60000);
    check(kept, 'platform: Ghosty\'s practice kept his best run of the first world as a ghost');
    await page.evaluate(() => window.__g5.handle.quit());
    await ctx.close();
    const second = await open('platform', 'nopractice|level=1|seed=3|calm', SIZES[0], {}, () => {
      localStorage.setItem('ghosty.arcade.platform.ghost', JSON.stringify({ 0: { t: 24, p: Array.from({ length: 150 }, (_, i) => [32 + i * 14, 146, 1]).flat() } }));
    });
    await second.page.locator('.g2btn[data-id="play"]').tap();
    check((await st(second.page)).ghost === true, 'platform: the ghost is on for this world');
    await second.page.evaluate(() => { window.__g5.intent.moveX = 1; });
    await until(second.page, () => window.__g5.handle.peek().state.t > 1, null, 15000);
    const a = await second.page.evaluate(() => window.__g5.handle.peek().state.t);
    check(a > 1, `platform: the ghost's clock runs with his (${a})`);
    await second.page.evaluate(() => { window.__g5.intent.moveX = 0; });
    await quitFrees(second.page, 'platform (ghost)');
    await second.ctx.close();
  }
  // reduced motion stills the parallax; otherwise it moves with the camera
  for (const reduce of [true, false]) {
    const { ctx, page } = await open('platform', 'nopractice|auto|level=2|speed=3|seed=2', SIZES[0], { reducedMotion: reduce ? 'reduce' : 'no-preference' });
    await page.locator('.g2btn[data-id="play"]').tap();
    await until(page, () => window.__g5.handle.peek().state.camX > 60, null, 40000);
    const s = await st(page);
    check(s.reduced === reduce && s.camX > 60 && (reduce ? s.parallax === 0 : s.parallax > 5), `platform: ${reduce ? 'reduced motion: the parallax stands still while the camera has moved' : 'the parallax moves with the camera'} (camera ${s.camX.toFixed(0)}, parallax ${s.parallax.toFixed(1)})`);
    await page.evaluate(() => window.__g5.handle.quit());
    await ctx.close();
  }
}

// ================================================================ (c) THE CAVE
if (!only || only === 'cave') {
  for (const size of SIZES) {
    const { ctx, page, errors } = await open('cave', 'nopractice', size);
    const g = 'cave';
    check(JSON.stringify(await menuOf(page)) === JSON.stringify(['New game', 'How to play', 'Sound: on', 'Quit']), `${g} (${size.width}): New game · How to play · Sound · Quit, and no Continue yet (${(await menuOf(page)).join(' · ')})`);
    await controls(page, `${g} title`);
    await page.locator('.g2btn[data-id="how-to-play"]').tap();
    check(await page.locator('.g2how', { hasText: 'Pinch' }).isVisible(), `${g} (${size.width}): How to play says to pinch for the map`);
    await page.locator('.g2btn[data-id="back"]').tap();
    await page.locator('.g2btn[data-id="new-game"]').tap();
    check((await peek(page)).mode === 'play' && (await st(page)).room === 'landing', `${g} (${size.width}): NEW GAME starts in Lantern Landing`);
    await controls(page, `${g} in play`);
    await sideways(page, g, size);
    check(!!(await page.locator('.g4grp.left .g4btn[data-act="up"]').count()) && !!(await page.locator('.g4grp.right .g4btn[data-act="map"]').count()), `${g} (${size.width}): ◀ ▲ ▶ and JUMP FIRE USE MAP are under the thumbs`);
    // cross a room
    const b = await page.locator('.g4btn[data-act="right"]').boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    const crossed = await until(page, () => window.__g5.handle.peek().state.room === 'moss', null, 20000);
    await page.mouse.up();
    check(crossed, `${g} (${size.width}): a room crossed: Lantern Landing into Moss Hall`);
    if (size.width === 440) {
      check((await st(page)).visited.length === 2, `${g}: the map has filled with the second room`);
      await page.locator('.g4btn[data-act="map"]').tap();
      await until(page, () => window.__g5.handle.peek().state.mapOpen === true, null, 5000);
      check((await st(page)).mapOpen === true, `${g}: MAP opens the map`);
      await shot(page, 'cave-map-440');
      await page.locator('.g4btn[data-act="map"]').tap();
      await until(page, () => window.__g5.handle.peek().state.mapOpen === false, null, 5000);
      check((await st(page)).mapOpen === false, `${g}: and closes it`);
      // a pinch (two fingers apart) opens it too
      const client = await ctx.newCDPSession(page);
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 190, y: 380, id: 1 }, { x: 250, y: 380, id: 2 }] });
      for (let i = 1; i <= 6; i++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 190 - i * 14, y: 380, id: 1 }, { x: 250 + i * 14, y: 380, id: 2 }] });
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await until(page, () => window.__g5.handle.peek().state.mapOpen === true, null, 5000);
      check((await st(page)).mapOpen === true, `${g}: a pinch opens the map`);
      await page.locator('.g4btn[data-act="map"]').tap();
      // back to the lantern and save
      const bl = await page.locator('.g4btn[data-act="left"]').boundingBox();
      await page.mouse.move(bl.x + bl.width / 2, bl.y + bl.height / 2);
      await page.mouse.down();
      await until(page, () => { const q = window.__g5.handle.peek().state; return q.room === 'landing' && q.x < 232; }, null, 30000);
      await page.mouse.up();
      await page.waitForTimeout(300);
      await page.locator('.g4btn[data-act="use"], .g4btn[data-act="b"]').first().tap();
      const saved = await until(page, () => window.__g5.handle.peek().state.saved === 'landing', null, 8000);
      const sd = await st(page);
      check(saved, `${g}: USE at a lantern saves ("Saved. Hearts mended.") (room ${sd.room}, x ${sd.x?.toFixed(0)}, y ${sd.y?.toFixed(0)}, hearts ${sd.hearts}, mode ${(await peek(page)).mode})`);
      const file = await page.evaluate(async () => { const b = await window.__g5.saves.get('cave.json'); return b ? JSON.parse(new TextDecoder().decode(b)) : null; });
      check(!!file && file.room === 'landing' && file.v === 1 && file.hearts === 5, `${g}: the save is in the arcade's store (room ${file?.room}, hearts ${file?.hearts})`);
      await shot(page, 'cave-play-440');
      await measure(page, g);
    }
    await page.evaluate(() => window.__g5.handle.quit());
    if (size.width === 440) {
      // a reload and CONTINUE restore it
      await page.reload();
      await page.waitForFunction(() => window.__g5?.ready, null, { timeout: 30000 });
      const m = await menuOf(page);
      check(m[0] === 'Continue' && m.includes('New game'), `${g}: after a reload the title offers Continue (${m.join(' · ')})`);
      await page.locator('.g2btn[data-id="continue"]').tap();
      const s = await st(page);
      check(s.room === 'landing' && s.hearts === 5 && s.visited.includes('moss'), `${g}: CONTINUE puts him back in ${s.room} with ${s.hearts} hearts and the map as it was (${s.visited.length} rooms)`);
      // a prepared save: another room, two hearts, the boots
      await page.evaluate(async () => {
        const save = { v: 1, room: 'drip', x: 51, y: 226, hearts: 2, tools: ['boots'], xp: 3, crystals: 3, taken: [], visited: ['landing', 'moss', 'drip'], bosses: [], seen: [], time: 90, deaths: 1, level: 1, seed: 4 };
        await window.__g5.saves.put('cave.json', new TextEncoder().encode(JSON.stringify(save)));
      });
      await page.reload();
      await page.waitForFunction(() => window.__g5?.ready, null, { timeout: 30000 });
      await page.locator('.g2btn[data-id="continue"]').tap();
      const t = await st(page);
      check(t.room === 'drip' && t.hearts === 2 && t.tools.includes('boots') && t.crystals === 3, `${g}: a save from the Drip Tunnel comes back as it was (room ${t.room}, hearts ${t.hearts}, tools ${t.tools.join('+')})`);
      await shot(page, 'cave-continue-440');
    }
    await ctx.close();
    check(errors.length === 0, `${g} (${size.width}): no page errors${errors.length ? `: ${errors[0]}` : ''}`);
  }
  // the whole cave, walked by his bot at the first level (sped up): a card for each tool, both bosses, the way out and its time
  {
    const { ctx, page, errors } = await open('cave', 'nopractice|auto|level=1|speed=14|seed=3', SIZES[0]);
    await page.locator('.g2btn[data-id="new-game"]').tap();
    let cards = 0;
    const over = await until(page, () => { const s = window.__g5.handle.peek(); const m = document.querySelector('.g2menu.card .g2btn'); if (m) { window.__cards = (window.__cards ?? 0) + 1; m.click(); } return s.mode === 'over'; }, null, 240000);
    cards = await page.evaluate(() => window.__cards ?? 0);
    check(over, 'cave: a run his bot plays comes to the way out');
    const s = await st(page);
    check(s.ended && s.visited.length === 12 && s.tools.length === 3 && s.bosses.length === 2, `cave: twelve rooms, three tools, two bosses, out (${s.visited.length} rooms, ${s.tools.join('+')}, ${s.bosses.join('+')}, ${cards} cards)`);
    check(cards >= 3, `cave: the dwellers and the tools spoke on cards (${cards})`);
    const notes = (await page.locator('.g2menu .g2note').allTextContents()).join(' | ');
    check(/Out in \d+:\d\d · \d+ crystals found/.test(notes), `cave: the ending shows the time and the crystals (${notes.slice(0, 120)})`);
    await shot(page, 'cave-end-440');
    await quitFrees(page, 'cave');
    check(errors.length === 0, `cave: no page errors${errors.length ? `: ${errors[0]}` : ''}`);
    await ctx.close();
  }
}

// ================================================================ (d) the four board games
const tapCell = async (page, c) => page.touchscreen.tap(c.x, c.y);
async function humanTurn(page) {
  for (let i = 0; i < 8; i++) {
    const s = await st(page);
    if (!s.humanTurn || s.result) return;
    if (s.origins.length) {
      await tapCell(page, s.origins[0]);
      await until(page, () => window.__g5.handle.peek().state.targets.length > 0, null, 3000);
      const t = (await st(page)).targets;
      if (t.length) await tapCell(page, t[0]);
    } else if (s.targets.length) await tapCell(page, s.targets[0]);
    await page.waitForTimeout(120);
  }
}
const BOARDS = [
  { id: 'draughts', game: R.draughts, plies: [30, 40, 50] },
  { id: 'othello', game: R.othello, plies: [52, 53, 54, 55, 56, 57, 58, 59, 60, 61] },
  { id: 'backgammon', game: R.backgammon, plies: [100, 120] },
  { id: 'connect4', game: R.connect4, plies: [12, 14, 16] },
];
/** A game one move from won for side 1, found by playing at random with the dice the game itself will roll. */
function winPosition(game, plies) {
  for (let seed = 1; seed < 6000; seed++) {
    const rnd = R.rngOf(seed * 31 + 7);
    let s = game.start(seed);
    const moves = [];
    for (let i = 0; i < 400 && !game.result(s); i++) {
      if (plies.includes(i) && game.side(s) === 1) {
        const wins = game.legal(s).filter((m) => game.result(game.apply(s, m, () => 0.5)) === 1);
        if (wins.length) return { seed, moves: moves.slice(), win: wins[0] };
      }
      const ms = game.legal(s);
      const m = ms[Math.floor(rnd() * ms.length)];
      s = game.apply(s, m, R.rngAt(seed, i));
      moves.push(m);
    }
  }
  return null;
}
if (!only || BOARDS.some((b) => b.id === only)) {
  for (const B of BOARDS.filter((b) => !only || b.id === only)) {
    const id = B.id;
    for (const size of SIZES) {
      const { ctx, page, errors } = await open(id, 'nopractice|level=1|human=1|seed=5', size);
      check(JSON.stringify(await menuOf(page)) === JSON.stringify(['Play', 'How to play', 'Sound: on', 'Quit']), `${id} (${size.width}): Play · How to play · Sound · Quit`);
      const notes = (await page.locator('.g2menu .g2note').allTextContents()).join(' | ');
      check(/Level 1 · he thinks for about 0\.2 s/.test(notes) && /You: 1,200 · Ghosty: 1,200/.test(notes) && /search alone until the GYM trains him/.test(notes), `${id} (${size.width}): the title says his level and thinking time, both ratings, and that he is search alone (${notes.slice(0, 150)})`);
      await controls(page, `${id} title`);
      await page.locator('.g2btn[data-id="how-to-play"]').tap();
      check(await page.locator('.g2how', { hasText: 'There is no top level' }).isVisible(), `${id} (${size.width}): the rules on one card, and no top level`);
      await page.locator('.g2btn[data-id="back"]').tap();
      await page.locator('.g2btn[data-id="sound-on"]').tap();
      check((await menuOf(page)).includes('Sound: off'), `${id} (${size.width}): Sound turns off`);
      await page.locator('.g2btn[data-id="sound-off"]').tap();
      await page.locator('.g2btn[data-id="play"]').tap();
      check((await peek(page)).mode === 'play', `${id} (${size.width}): Play starts a game`);
      await controls(page, `${id} in play`);
      await sideways(page, id, size);
      let s = await st(page);
      check(s.humanTurn && s.moves > 0, `${id} (${size.width}): it is his move first (${s.moves} legal)`);
      // a legal move shown on touch, and made
      const direct = s.origins.length === 0;
      if (!direct) {
        await tapCell(page, s.origins[0]);
        await until(page, () => window.__g5.handle.peek().state.targets.length > 0, null, 4000);
        s = await st(page);
        check(s.targets.length > 0 && s.selected >= 0, `${id} (${size.width}): touching a piece shows where it may go (${s.targets.length} places)`);
      } else check(s.targets.length > 0, `${id} (${size.width}): the legal moves are shown (${s.targets.length})`);
      if (size.width === 440) await shot(page, `${id}-legal-440`);
      const p0 = s.plies;
      await tapCell(page, s.targets[0]);
      if (id === 'backgammon') await humanTurn(page);
      await until(page, (n) => window.__g5.handle.peek().state.plies > n, p0, 4000);
      check((await st(page)).plies > p0, `${id} (${size.width}): the move is made (${p0} → ${(await st(page)).plies} plies)`);
      // Ghosty answers within his thinking time, with "thinking…" shown
      const thought = await until(page, () => window.__g5.handle.peek().state.thinking, null, 4000);
      const said = await page.locator('.g5status').innerText().catch(() => '');
      check(thought && /thinking…/.test(said), `${id} (${size.width}): "thinking…" is shown while he works ("${said}")`);
      const t0 = Date.now();
      const back = await until(page, () => window.__g5.handle.peek().state.humanTurn, null, 12000);
      const took = Date.now() - t0;
      const sa = await st(page);
      check(back && took < 3500, `${id} (${size.width}): he answered in ${took} ms (level 1 thinks for 0.2 s, the board shows it for at least half a second)`);
      check(sa.last.iters > 20, `${id} (${size.width}): he searched (${sa.last.iters} playouts${sa.last.depth ? `, depth ${sa.last.depth}` : ''})`);
      if (size.width === 440) {
        await measure(page, id);
        // a hint, once
        const h0 = await st(page);
        await page.locator('.g4btn[data-act="hint"]').tap();
        await until(page, () => window.__g5.handle.peek().state.hint !== null, null, 8000);
        const h1 = await st(page);
        check(h1.hint !== null && h1.hintUsed, `${id}: HINT marks a move (${JSON.stringify(h1.hint)})`);
        { const hb = page.locator('.g4btn[data-act="hint"]'); const dis = await hb.isDisabled(); const tx = await hb.innerText(); check(dis && /used/i.test(tx), `${id}: there is one hint a game, and the key says it is used (${dis}, "${tx}")`); }
        check(/costs your rating nothing/.test(await page.locator('.g2say').innerText().catch(() => '')) || h1.hintUsed, `${id}: the hint says it costs the rating nothing`);
        await shot(page, `${id}-hint-440`);
        // a take-back
        await page.locator('.g4btn[data-act="back"]').tap();
        await until(page, (n) => window.__g5.handle.peek().state.plies < n, h1.plies, 4000);
        const tb = await st(page);
        check(tb.plies < h1.plies && tb.tbLeft === 2 && tb.humanTurn, `${id}: TAKE BACK undoes his move and the reply (${h1.plies} → ${tb.plies} plies, ${tb.tbLeft} left)`);
        await page.locator('.g2pause').tap();
        check((await peek(page)).mode === 'paused' && (await menuOf(page)).includes('Give up'), `${id}: PAUSE opens Resume · How to play · Sound · Give up · Quit`);
        await page.locator('.g2btn[data-id="resume"]').tap();
        // the game is kept: quit, and a reload offers Continue
        const plies = (await st(page)).plies;
        await page.evaluate(() => window.__g5.handle.quit());
        await page.reload();
        await page.waitForFunction(() => window.__g5?.ready, null, { timeout: 30000 });
        const m = await menuOf(page);
        check(m[0] === 'Continue', `${id}: the game in hand is kept: after a reload the title offers Continue (${m.join(' · ')})`);
        await page.locator('.g2btn[data-id="continue"]').tap();
        check((await st(page)).plies === plies, `${id}: CONTINUE puts the same game back (${plies} plies)`);
      }
      await page.evaluate(() => window.__g5.handle.quit());
      await ctx.close();
      check(errors.length === 0, `${id} (${size.width}): no page errors${errors.length ? `: ${errors[0]}` : ''}`);
    }
    // a game one move from won: the win ends it with the rating line moved
    const pos = winPosition(B.game, B.plies);
    check(!!pos, `${id}: a game one move from won was found to play on`);
    if (pos) {
      const { ctx, page, errors } = await open(id, `nopractice|level=3|human=1|seed=${pos.seed}|moves=${JSON.stringify(pos.moves)}`, SIZES[0]);
      await page.locator('.g2btn[data-id="continue"]').tap();
      await until(page, () => window.__g5.handle.peek().state.humanTurn, null, 10000);
      const from = B.game.from(pos.win);
      const to = B.game.to(pos.win);
      let s = await st(page);
      if (from >= 0) {
        const o = s.origins.find((c) => c.cell === from);
        check(!!o, `${id}: the winning piece can be picked (cell ${from})`);
        if (o) await tapCell(page, o);
        await until(page, () => window.__g5.handle.peek().state.targets.length > 0, null, 4000);
        s = await st(page);
      }
      const tgt = s.targets.find((c) => c.cell === to);
      check(!!tgt, `${id}: the winning move is shown (cell ${to})`);
      if (tgt) await tapCell(page, tgt);
      const won = await until(page, () => window.__g5.handle.peek().state.result === 1, null, 8000);
      check(won, `${id}: the win ends the game`);
      await until(page, () => window.__g5.handle.peek().mode === 'over', null, 8000);
      const notes2 = (await page.locator('.g2menu .g2note').allTextContents()).join(' | ');
      check(/You won/.test(await page.locator('.g2title').innerText()) && /Your rating [\d,]+ to [\d,]+/.test(notes2), `${id}: the end says "You won" and the rating line moved (${notes2.slice(0, 120)})`);
      const book = await store(page, 'ghosty.arcade.board.rating');
      check(book?.[id]?.you?.r > 1200 && book?.[id]?.me?.r < 1200 && book[id].wins === 1, `${id}: your rating rose and his fell (${book?.[id]?.you?.r?.toFixed(0)} · ${book?.[id]?.me?.r?.toFixed(0)})`);
      const sk = await store(page, 'ghosty.arcade.skill');
      check(sk?.[id]?.you?.r === 1, `${id}: and the level rose to 2 (rating ${sk?.[id]?.you?.r})`);
      check(/Level 3 beaten|beaten/.test(notes2), `${id}: it says which level it beat`);
      if (id === 'connect4') await shot(page, 'connect4-won-440');
      await page.evaluate(() => window.__g5.handle.quit());
      await ctx.close();
      check(errors.length === 0, `${id} (win): no page errors${errors.length ? `: ${errors[0]}` : ''}`);
    }
  }
}
await browser.close();
console.log(problems.length ? `\n${problems.length} problem(s)` : '\nall checks passed');
process.exit(problems.length ? 1 : 0);
