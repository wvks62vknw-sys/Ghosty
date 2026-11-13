// THE EYE 2 (BRIEF-EYE-HUD-2; apps/web/src/features/core/eye/{room,abilities,film,reading,words,ground,home}.ts, shell/areas.ts, shell/boot.ts, styles.css THE EYE) on the
// owner's 440 × 956 and a 390 × 844 phone, world eye (every check fails on the code before this brief: it was run against it once):
//   a. A ROOM IS THE WALL: each of the six rooms (SEE MAKE LEARN PLAN LIFE ME) is feeds with the cards' own readings, exactly ONE sharp feed (the thing used
//      last, else the first starred, else the room's first), the line of sight under it at the instruments' lit key, `LOOKING AT <ROOM> · N FEEDS`, his
//      favourites in bracket corners, MAKE's EDITORS feed holding eight small feeds (COMIC joined on 13 Nov), a tap opens the thing, a long press pins, a room opens under 300 ms;
//   b. THE FILM: the boot's last shot in the eye is the wall (the boot spec's harness, stepped by hand): the feeds in their frames, one boxed in the accent,
//      the line of sight, on Home's own rectangles; Reduce Motion lands on the still wall; the other worlds draw none of it;
//   c. ABILITIES AS THE WALL: Home's ABILITIES feed and a room's open the wall of what I can do (one sharp, the kick row, the line of sight); a tap asks it in the ask line;
//   d. BODY 21: the ask line above the instruments on both phones, the instruments one row of seven inside the screen, the wall's last row above the ask line at the end;
//   e. THE GROUND'S ONE LINE: "Lighting the ground…" shows once while a software GL starts and is gone within 3 s of the globe being lit; it never shows on a GPU (mocked);
//   f. OFFLINE: every feed that needs the signal shows its last reading and its age, none blank, the stamp says paused;
//   g. THE SCAN, ONE INK, THE MAP and Glass draw their rooms as before (no wall, their own band and cards).
//   BASE=http://localhost:8845 node tests/eyehud2.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const problems = [];
const timings = [];
const check = (ok, what) => ok || problems.push(what);
const KEY = 'preview-owner-key-0123456789';
const T0 = Date.now();
const BUDGET = 300;
const look = (world) => ({ ground: 'graphite', world, night: 'graphite', switches: {} });
const WIDE = { width: 390, height: 844 };
const ROOMS = [['see', 'See'], ['make', 'Make'], ['learn', 'Learn'], ['plan', 'Plan'], ['life', 'Life'], ['me', 'Me']];
const PILLS = ['DOCUMENTS', 'SPREADSHEETS', 'PRESENTATIONS', 'THE WORKSPACE', 'PHOTO', 'VIDEO', 'GAME STUDIO', 'COMIC'];
// (a photograph on the software GL can stall behind the globe's frames: it is a record, never a check, so it gives up after eight seconds)
const shot = (page, path) => page.screenshot({ path, timeout: 8000 }).catch(() => undefined);
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

async function open({ viewport = PHONE, world = 'eye', pins = ['lens', 'gym'], recents = ['library', 'eye', 'brief'], reduced = false, body = '', seed = null, soft = null, boot = false, once = true } = {}) {
  const ctx = await browser.newContext({ viewport, ...UK, deviceScaleFactor: boot ? 1 : 2, isMobile: true, hasTouch: true, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/favicon|net::ERR|40[134]|Failed to load resource|^[WI]\d{4} |^INFO:|GPU stall|WebGL/.test(t)) problems.push(`console: ${t.slice(0, 200)}`);
  });
  await page.addInitScript(({ look, pins, recents, body, seed, soft, boot, once, reduced }) => {
    localStorage.setItem('ghosty.ownerKey', 'preview-owner-key-0123456789');
    localStorage.setItem('ghosty.themes1', '1');
    if (!once || !localStorage.getItem('spec.eye2.seeded')) {
      localStorage.setItem('spec.eye2.seeded', '1');
      localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Boss', speak: false, sounds: false, theme: 'reactor', favourites: pins, look, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
      if (recents) localStorage.setItem('ghosty.recents', JSON.stringify(recents));
      if (seed) localStorage.setItem('ghosty.eyereads', JSON.stringify(Object.fromEntries(Object.entries(seed).map(([k, v]) => [k, { line: v.line, at: Date.now() - v.ageMin * 60_000 }]))));
    }
    window.__ghostyHero = true;
    window.__ghostyPlace = { none: true };
    if (boot) { window.__ghostyBoot = true; if (!reduced) window.__ghostyBootKind = 'full'; window.__ghostyBootManual = true; }
    if (body) document.addEventListener('DOMContentLoaded', () => (document.documentElement.dataset.body = body));
    // what the stamp's own small line showed (the checks read when it was up and when it went)
    window.__lit = { shown: [], gone: [] };
    new MutationObserver(() => {
      const l = document.querySelector('.eyelight');
      if (!l) return;
      const up = !l.hidden;
      const last = window.__lit.shown.length - window.__lit.gone.length;
      if (up && last === 0) window.__lit.shown.push(performance.now());
      if (!up && last === 1) window.__lit.gone.push(performance.now());
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'] });
    if (soft !== null) {
      const gp = WebGL2RenderingContext.prototype.getParameter;
      WebGL2RenderingContext.prototype.getParameter = function (p) { return p === 0x9246 && soft === false ? 'Apple GPU' : gp.call(this, p); };
    }
    window.__eyeTests = {
      room: (k) => document.body.dataset.tab === `area-${k}` && !!document.querySelector(`#pg-area-${k} .eyeroom .eyefeed`)?.getBoundingClientRect().width,
    };
  }, { look: look(world), pins, recents, body, seed, soft, boot, once, reduced });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  if (!boot) await page.waitForSelector('#boot', { state: 'detached', timeout: 40000 }).catch(() => problems.push('the boot never ended'));
  return { ctx, page };
}
const until = (page, fn, ms, what, arg = null) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => { problems.push(what); return false; });
const go = async (page, hash) => {
  await page.evaluate((h) => (location.hash = h), hash);
  await page.waitForTimeout(700);
};
const roomReady = (page, k, what) => until(page, (k) => document.body.dataset.tab === `area-${k}` && !!document.querySelector(`#pg-area-${k} .eyeroom .eyefeed`)?.getBoundingClientRect().width && [...document.querySelectorAll(`#pg-area-${k} canvas.eyepic`)].filter((c) => c.dataset.drawn).length > 1, 12000, what, k);
const floor = (page, W, scope) => page.evaluate(([W, scope]) => {
  const bad = [];
  const seen = (e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none';
  for (const b of document.querySelectorAll(`${scope} button, #dock .tabcap button`)) {
    if (!seen(b)) continue;
    const r = b.getBoundingClientRect();
    if (r.width < 43.5 || r.height < 43.5) bad.push(`target "${(b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 24)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
  }
  for (const e of document.querySelectorAll(`${scope} *, #dock .tabcap *`)) {
    if (!seen(e)) continue;
    const r = e.getBoundingClientRect();
    if (r.width && (r.right > W + 1 || r.left < -1) && !e.closest('canvas, .eyepic')) bad.push(`sideways: <${e.tagName.toLowerCase()}> "${(e.textContent || '').trim().slice(0, 20)}" ${Math.round(r.left)}–${Math.round(r.right)}`);
  }
  if (document.documentElement.scrollWidth > W + 1) bad.push(`the page scrolls sideways: ${document.documentElement.scrollWidth}`);
  return bad;
}, [W, scope]);
async function timed(page, click, name, arg) {
  await page.evaluate(([name, arg]) => {
    window.__eye_t = null;
    document.addEventListener('click', () => {
      const t0 = performance.now();
      const tick = () => {
        if (window.__eyeTests[name](arg)) window.__eye_t = Math.round(performance.now() - t0);
        else if (performance.now() - t0 < 5000) requestAnimationFrame(tick);
      };
      tick();
    }, { capture: true, once: true });
  }, [name, arg]);
  await click();
  await page.waitForFunction(() => window.__eye_t != null, null, { timeout: 6000 }).catch(() => undefined);
  return page.evaluate(() => window.__eye_t);
}

const mark = (w) => console.error(`[${Math.round((Date.now() - T0) / 1000)} s] ${w}`);
// ---- a. a room is the wall, at 440 and 390
for (const [vp, tag] of [[PHONE, '440'], [WIDE, '390']]) {
  const { ctx, page } = await open({ viewport: vp });
  for (const [k, title] of ROOMS) {
    await go(page, `area-${k}`);
    if (!(await roomReady(page, k, `[${tag} ${k}] the room never became the wall`))) continue;
    await page.waitForTimeout(500);
    const r = await page.evaluate((k) => {
      const root = document.querySelector(`#pg-area-${k} .eyeroom`);
      const q = (s) => root.querySelector(s);
      const key = document.querySelector('#dock .tabcap button.on')?.getBoundingClientRect();
      const sight = q('.eyefocus .eyesight');
      const sr = sight?.getBoundingClientRect();
      const focus = q('.eyefocus')?.getBoundingClientRect();
      const sharp = [...root.querySelectorAll('.eyefeed.sharp')];
      const feeds = [...root.querySelectorAll('.eyefeed:not(.mini)')].map((f) => ({ id: f.dataset.id ?? f.dataset.kind, kind: f.dataset.kind, sharp: f.classList.contains('sharp'), fav: f.dataset.fav === 'true', tag: (f.querySelector('.eyetag')?.textContent ?? '').trim(), line: (f.querySelector('.eyeline')?.textContent ?? '').trim(), corners: getComputedStyle(f, '::after').content !== 'none', pic: f.querySelector('canvas.eyepic')?.dataset.drawn ? 'drawn' : f.classList.contains('sharp') ? 'none' : 'undrawn', border: getComputedStyle(f).borderTopStyle, h: Math.round(f.getBoundingClientRect().height) }));
      const kick = (q('.eyekick')?.textContent ?? '').trim();
      return {
        kick, feeds, sharpN: sharp.length, sharpTag: (sharp[0]?.querySelector('.eyetag')?.textContent ?? '').trim(), sharpName: (sharp[0]?.querySelector('.eyename')?.textContent ?? '').trim(),
        sightX: sr ? Math.round(sr.left) : null, sightH: sr ? Math.round(sr.height) : 0, sightStyle: sight ? getComputedStyle(sight).borderLeftStyle : '', keyX: key ? Math.round(key.left + key.width / 2) : null,
        sharpBottom: sharp[0] ? Math.round(sharp[0].getBoundingClientRect().bottom) : 0, focusBottom: focus ? Math.round(focus.bottom) : 0, kickTop: Math.round(document.querySelector('#dock .housekick').getBoundingClientRect().top),
        minis: [...root.querySelectorAll('.eyefeed.mini')].map((m) => ({ t: m.textContent.trim(), h: Math.round(m.getBoundingClientRect().height), w: Math.round(m.getBoundingClientRect().width), pic: !!m.querySelector('canvas.eyepic')?.dataset.drawn })),
        state: { kick: window.__ghosty.eyeroom.kick, sharp: window.__ghosty.eyeroom.sharp, pills: window.__ghosty.eyeroom.pills, n: window.__ghosty.eyeroom.feeds.length },
        sub: (document.querySelector(`#pg-area-${k} .hubsub`)?.textContent ?? '').trim(), band: !!document.querySelector(`#pg-area-${k} .roomband`)?.getClientRects().length, scanroom: !!document.querySelector(`#pg-area-${k} .scanroom`)?.getClientRects().length,
      };
    }, k);
    const n = r.feeds.length;
    check(r.kick.toUpperCase() === `LOOKING AT ${title.toUpperCase()} · ${r.state.n} ${r.state.n === 1 ? 'FEED' : 'FEEDS'}` && r.state.kick === r.kick, `[${tag} ${k}] the kick row: "${r.kick}" / state "${r.state.kick}"`);
    check(r.sharpN === 1 && r.state.sharp === 1 && r.feeds.filter((f) => f.sharp).length === 1, `[${tag} ${k}] sharp feeds: ${r.sharpN}`);
    const want = { see: ['eye', 'LAST USED'], learn: ['library', 'LAST USED'], make: ['studio', 'START HERE'] }[k];
    if (want) check(r.feeds.find((f) => f.sharp)?.id === want[0] && r.sharpTag.toUpperCase().includes(want[1]), `[${tag} ${k}] the sharp feed is ${r.feeds.find((f) => f.sharp)?.id} "${r.sharpTag}", want ${want}`);
    check(r.feeds.filter((f) => !f.sharp && f.kind !== 'abilities').every((f) => f.pic === 'drawn' && f.line.length > 1 && f.border === 'dotted') && r.feeds.every((f) => f.line.length > 1), `[${tag} ${k}] a feed with no picture or no reading: ${JSON.stringify(r.feeds.filter((f) => f.pic === 'undrawn' || f.line.length < 2).map((f) => f.id))}`);
    check(r.sightH >= 10 && /dashed/.test(r.sightStyle) && r.keyX != null && Math.abs(r.sightX - r.keyX) <= 4 && r.sharpBottom <= r.focusBottom && r.focusBottom <= r.kickTop + 1, `[${tag} ${k}] the line of sight: x ${r.sightX} h ${r.sightH} ${r.sightStyle}, the lit key at ${r.keyX}; focus ends ${r.focusBottom}, instruments' words at ${r.kickTop}`);
    check(r.feeds.some((f) => f.kind === 'abilities') && r.sub.length > 5 && !r.band && !r.scanroom, `[${tag} ${k}] a Scan band or room is still drawn (band ${r.band}, room ${r.scanroom}) or no abilities feed`);
    if (k === 'see' || k === 'learn') check(r.feeds.some((f) => f.fav && f.corners), `[${tag} ${k}] no favourite in bracket corners: ${JSON.stringify(r.feeds.filter((f) => f.fav))}`);
    if (k === 'make') {
      const ed = r.feeds.find((f) => f.id === 'editors');
      check(ed && r.minis.map((m) => m.t).join() === PILLS.join() && r.state.pills.join() === PILLS.join() && r.minis.every((m) => m.h >= 44 && m.w >= 44 && m.pic), `[${tag} make] the EDITORS feed holds ${JSON.stringify(r.minis)}`);
    }
    const bad = await floor(page, vp.width, '#stage > .pg');
    check(!bad.length, `[${tag} ${k}] the floor: ${bad.slice(0, 5).join('; ')}`);
    if (k === 'learn') await shot(page, `${out}/eye2-room-learn-${tag}.png`);
    if (k === 'make') await shot(page, `${out}/eye2-room-make-${tag}.png`);
  }
  // a tap opens the thing (SEE's Lens), a pill opens one editor (VIDEO), a long press pins and again unpins
  await go(page, 'area-see');
  await roomReady(page, 'see', `[${tag}] SEE did not come back`);
  await page.click('#pg-area-see .eyefeed[data-id="lens"]');
  await until(page, () => document.body.dataset.tab === 'lens', 8000, `[${tag}] a tap on the Lens feed did not open it`);
  await go(page, 'area-make');
  await roomReady(page, 'make', `[${tag}] MAKE did not come back`);
  await page.evaluate(() => document.querySelector('#pg-area-make .eyefeed.mini[data-editor="video"]')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  await page.click('#pg-area-make .eyefeed.mini[data-editor="video"]');
  await until(page, () => document.body.dataset.tab === 'video', 8000, `[${tag}] the VIDEO pill did not open the video editor`);
  await go(page, 'area-learn');
  await roomReady(page, 'learn', `[${tag}] LEARN did not come back`);
  for (const [want, label] of [['pin', 'PIN'], ['unpin', 'UNPIN']]) {
    const sel = '#pg-area-learn .eyefeed[data-id="school"]';
    await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center' }), sel);
    await page.waitForTimeout(300);
    const box = await page.locator(sel).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1200);
    await page.mouse.up();
    await until(page, () => !!document.querySelector('#pinsheet [data-pin]'), 5000, `[${tag}] a long press on a feed did not open the pin sheet (${label})`);
    const offered = await page.evaluate(() => document.querySelector('#pinsheet [data-pin]')?.dataset.pin);
    check(offered === want, `[${tag}] the pin sheet offered ${offered}, want ${want}`);
    await page.click('#pinsheet [data-pin]');
    await page.waitForTimeout(700);
    check(await page.evaluate((w) => (document.querySelector('#pg-area-learn .eyefeed[data-id="school"]')?.dataset.fav === 'true') === (w === 'pin'), want), `[${tag}] after ${want} the feed's bracket corners are wrong`);
  }
  // under 300 ms (median of five), a room from its key
  await go(page, 'core');
  await page.waitForTimeout(1500);
  const times = [];
  for (let i = 0; i < 5; i++) {
    await go(page, 'core');
    await page.waitForTimeout(400);
    times.push((await timed(page, () => page.click('#dock .tabcap button[data-area="see"]'), 'room', 'see')) ?? 9999);
  }
  timings.push(`room ${tag}: SEE's wall opens ${times.join(', ')} ms from its key (median ${median(times)})`);
  check(median(times) < BUDGET, `[speed ${tag}] a room's wall took ${median(times)} ms (median of five: ${times.join(', ')}; the budget is ${BUDGET} ms)`);
  await ctx.close();
}

mark(' b. T');
// ---- b. THE FILM: the boot's last shot in the eye is the wall (stepped by hand)
for (const reduced of [false, true]) {
  const { ctx, page } = await open({ boot: true, reduced, recents: null });
  const ready = await until(page, () => window.__ghosty?.hero?.mode === 'mind' && !!document.querySelector('canvas.reactor.mindon') && window.__bootState?.appReady >= 0, 90000, `[film${reduced ? ' reduced' : ''}] MIND and Home never got ready under the cinematic`);
  if (ready) {
    const seek = async (t) => { await page.evaluate((t) => window.__bootSeek(t), t); await page.waitForTimeout(250); return page.evaluate(() => JSON.parse(JSON.stringify(window.__bootState.eyewall))); };
    const END = reduced ? 1200 : 2880;
    const pts = reduced ? [200, 1000] : [1500, 2100, 2640];
    const seen = {};
    for (const t of pts) {
      seen[t] = await seek(t);
      await shot(page, `${out}/eye2-boot-${reduced ? 'still-' : ''}${t}.png`);
    }
    const last = seen[pts.at(-1)];
    check(last && last.k >= 0.99 && last.sharp && last.sight && last.feeds >= 10, `[film${reduced ? ' reduced' : ''}] the last shot is not the whole wall: ${JSON.stringify(last)}`);
    if (!reduced) {
      check(seen[1500].k === 0 && seen[1500].feeds === 0 && seen[2100].k > 0.05 && seen[2100].k < 0.9 && !seen[2100].sharp && seen[2100].feeds > 0, `[film] the wall is not resolving in the last second: ${JSON.stringify([seen[1500], seen[2100]])}`);
    } else check(seen[200].k === 0, `[film reduced] the still wall came before its frame: ${JSON.stringify(seen[200])}`);
    // the pixels: the sharp feed's box is in the accent, and the canvas has grain inside the other feeds' frames
    const px = await page.evaluate(() => {
      const c = document.querySelector('#boot canvas.bwall');
      if (!c) return null;
      const s = window.__bootState.eyewall;
      if (!s.sharpRect.length) return { empty: true };
      const g = c.getContext('2d');
      const k = c.width / innerWidth;
      const [x, y, w, h] = s.sharpRect;
      const edge = g.getImageData(Math.round((x + w / 2) * k), Math.round(y * k), 1, 3).data;
      let lit = 0;
      for (const f of document.querySelectorAll('.eyewall .eyefeed:not(.sharp)')) {
        const r = f.getBoundingClientRect();
        const d = g.getImageData(Math.round(r.left * k), Math.round(r.top * k), Math.max(1, Math.round(r.width * k)), Math.max(1, Math.round(r.height * k))).data;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 8) { lit++; break; }
      }
      return { edgeAlpha: Math.max(edge[3], edge[7], edge[11]), feedsWithInk: lit, feeds: document.querySelectorAll('.eyewall .eyefeed:not(.sharp)').length };
    });
    check(px && px.edgeAlpha > 200 && px.feedsWithInk >= px.feeds - 1, `[film${reduced ? ' reduced' : ''}] the canvas: ${JSON.stringify(px)}`);
    // Home lands with no cut: the shot's rectangles are Home's own
    await page.evaluate((e) => window.__bootSeek(e), END);
    await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 }).catch(() => problems.push(`[film${reduced ? ' reduced' : ''}] the boot did not end`));
    await page.waitForTimeout(500);
    const home = await page.evaluate(() => { const r = document.querySelector('.eyefeed.sharp')?.getBoundingClientRect(); return r ? [r.left, r.top, r.width, r.height].map((v) => Math.round(v * 10) / 10) : null; });
    check(home && last && home.every((v, i) => Math.abs(v - last.sharpRect[i]) <= 2), `[film${reduced ? ' reduced' : ''}] the shot's box ${JSON.stringify(last?.sharpRect)} is not Home's sharp feed ${JSON.stringify(home)}`);
    timings.push(`film${reduced ? ' (reduced)' : ''}: ${pts.map((t) => `${t} ms k ${seen[t].k} feeds ${seen[t].feeds}${seen[t].sharp ? ' sharp' : ''}${seen[t].sight ? ' sight' : ''}`).join('; ')}`);
  }
  await ctx.close();
}
// the other worlds draw none of it
for (const w of ['scan', 'ink', 'map', 'glass']) {
  const { ctx, page } = await open({ boot: true, world: w, recents: null });
  const ready = await until(page, () => window.__ghosty?.hero?.mode === 'mind' && window.__bootState?.appReady >= 0, 90000, `[film ${w}] MIND and Home never got ready`);
  if (ready) {
    await page.evaluate(() => window.__bootSeek(2400));
    await page.waitForTimeout(300);
    const s = await page.evaluate(() => ({ wall: window.__bootState.eyewall, canvas: !!document.querySelector('#boot canvas.bwall, #boot canvas.bwallpic') }));
    check(s.wall === null && !s.canvas, `[film ${w}] the eye's wall is on the boot: ${JSON.stringify(s)}`);
  }
  await ctx.close();
}

mark(' c. A');
// ---- c. ABILITIES as the wall
for (const [vp, tag] of [[PHONE, '440'], [WIDE, '390']]) {
  const { ctx, page } = await open({ viewport: vp });
  await go(page, 'core');
  await until(page, () => document.body.classList.contains('eyehome') && !!document.querySelector('.eyefeed.abil[data-slot="x"]')?.getBoundingClientRect().width, 15000, `[abilities ${tag}] Home has no ABILITIES feed`);
  await page.waitForTimeout(900);
  await page.click('.eyefeed.abil[data-slot="x"]');
  await until(page, () => window.__ghosty.eyeabil?.open && document.querySelectorAll('#eyeabil .eyefeed').length > 2, 8000, `[abilities ${tag}] the abilities wall did not open from Home`);
  await page.waitForTimeout(600);
  const a = await page.evaluate(() => {
    const root = document.querySelector('#eyeabil');
    const feeds = [...root.querySelectorAll('.eyefeed')].map((f) => ({ id: f.dataset.ability, sharp: f.classList.contains('sharp'), line: (f.querySelector('.eyeline')?.textContent ?? '').trim(), pic: !!f.querySelector('canvas.eyepic')?.dataset.drawn, h: Math.round(f.getBoundingClientRect().height) }));
    const sr = root.querySelector('.eyesight')?.getBoundingClientRect();
    const key = document.querySelector('#dock .tabcap button.on')?.getBoundingClientRect();
    return { kick: (root.querySelector('.eyekick')?.textContent ?? '').trim(), feeds, sightX: sr && Math.round(sr.left), sightH: sr && Math.round(sr.height), keyX: key && Math.round(key.left + key.width / 2), state: window.__ghosty.eyeabil.feeds.length, bottom: Math.round(root.getBoundingClientRect().bottom), kickTop: Math.round(document.querySelector('#dock .housekick').getBoundingClientRect().top) };
  });
  check(new RegExp(`^Looking at what I can do · ${a.feeds.length} feeds$`, 'i').test(a.kick) && a.state === a.feeds.length && a.feeds.length > 2, `[abilities ${tag}] the kick row "${a.kick}" for ${a.feeds.length} feeds`);
  check(a.feeds.filter((f) => f.sharp).length === 1 && a.feeds.filter((f) => !f.sharp).every((f) => f.pic) && a.feeds.every((f) => f.line.length > 5 && f.h >= 44), `[abilities ${tag}] the feeds: ${JSON.stringify(a.feeds.filter((f) => !f.pic && !f.sharp).map((f) => f.id))}`);
  check(a.sightH >= 10 && Math.abs(a.sightX - a.keyX) <= 4 && a.bottom <= a.kickTop + 1, `[abilities ${tag}] the line of sight ${a.sightX}/${a.keyX} (${a.sightH}) or the wall runs under the instruments (${a.bottom} vs ${a.kickTop})`);
  const bad = await floor(page, vp.width, '#eyeabil');
  check(!bad.length, `[abilities ${tag}] the floor: ${bad.slice(0, 5).join('; ')}`);
  await shot(page, `${out}/eye2-abilities-${tag}.png`);
  // a tap asks it in the ask line (the chat's box, never sent for him)
  const pick = await page.evaluate(() => { const f = [...document.querySelectorAll('#eyeabil .eyefeed:not(.sharp)')].find((x) => window.__ghosty.eyeabil.feeds.find((y) => y.id === x.dataset.ability)?.ask); return f ? { id: f.dataset.ability, ask: window.__ghosty.eyeabil.feeds.find((y) => y.id === f.dataset.ability).ask } : null; });
  check(!!pick, `[abilities ${tag}] no feed with an ask`);
  if (pick) {
    await page.evaluate((id) => document.querySelector(`#eyeabil .eyefeed[data-ability="${id}"]`).scrollIntoView({ block: 'center' }), pick.id);
    await page.waitForTimeout(250);
    await page.click(`#eyeabil .eyefeed[data-ability="${pick.id}"]`);
    await until(page, (ask) => document.querySelector("#cin")?.value === ask, 15000, `[abilities ${tag}] a tap did not put "${pick.ask}" in the ask line`, pick.ask);
    check(await page.evaluate(() => !document.querySelector('#eyeabil') && window.__ghosty.eyeabil.asked !== ''), `[abilities ${tag}] the wall stayed open or did not remember what was asked`);
  }
  // the room's own: SEE's abilities open as the wall and name the Lens
  await page.waitForTimeout(2200);
  await go(page, 'area-see');
  await roomReady(page, 'see', `[abilities ${tag}] SEE did not come back`);
  await page.evaluate(() => document.querySelector('#pg-area-see .eyefeed.abil')?.scrollIntoView({ block: 'center' }));
  await until(page, () => /things I can do here/.test(document.querySelector('#pg-area-see .eyefeed.abil .eyeline')?.textContent ?? ''), 8000, `[abilities ${tag}] SEE's ABILITIES feed has no count`);
  await page.click('#pg-area-see .eyefeed.abil');
  await until(page, () => window.__ghosty.eyeabil?.open && window.__ghosty.eyeabil.room === 'see', 8000, `[abilities ${tag}] SEE's abilities did not open`);
  const see = await page.evaluate(() => ({ ids: window.__ghosty.eyeabil.feeds.map((f) => f.id), kick: window.__ghosty.eyeabil.kick }));
  check(see.ids.includes('s:lens') && see.ids.includes('lens:modes') && !see.ids.includes('s:gym') && /in See/.test(see.kick), `[abilities ${tag}] SEE's abilities: ${JSON.stringify(see)}`);
  await ctx.close();
}

mark(' d. B');
// ---- d. BODY 21: the ask line above the instruments, the instruments inside the screen, the wall's last row above the ask line
for (const [vp, tag] of [[PHONE, '440'], [WIDE, '390']]) {
  const { ctx, page } = await open({ viewport: vp, body: '21' });
  await go(page, 'core');
  await until(page, () => document.body.classList.contains('eyehome') && !!document.querySelector('.eyeask')?.getBoundingClientRect().width, 15000, `[body21 ${tag}] Home never became the wall`);
  await page.waitForTimeout(1200);
  const m = await page.evaluate(() => {
    const ask = document.querySelector('.eyeask').getBoundingClientRect();
    const kick = document.querySelector('#dock .housekick').getBoundingClientRect();
    const keys = [...document.querySelectorAll('#dock .tabcap button')].map((b) => { const r = b.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right), Math.round(r.height)]; });
    const fr = document.querySelector('.eyeframe');
    fr.scrollTop = fr.scrollHeight;
    return { ask: Math.round(ask.bottom), kick: Math.round(kick.top), keys, W: innerWidth, body: document.documentElement.dataset.body };
  });
  await page.waitForTimeout(300);
  const end = await page.evaluate(() => {
    const ask = document.querySelector('.eyeask').getBoundingClientRect();
    const rows = [...document.querySelectorAll('.eyewall .eyefeed')].map((f) => f.getBoundingClientRect().bottom);
    const fr = document.querySelector('.eyeframe');
    return { askTop: Math.round(ask.top), lastRow: Math.round(Math.max(...rows)), frameBottom: Math.round(fr.getBoundingClientRect().bottom) };
  });
  check(m.body === '21' && m.ask <= m.kick + 1, `[body21 ${tag}] the ask line (${m.ask}) is under the instruments' words (${m.kick})`);
  check(m.keys.length === 7 && m.keys.every(([l, r, h]) => l >= -1 && r <= m.W + 1 && h >= 44), `[body21 ${tag}] the instruments run past the screen: ${JSON.stringify(m.keys)}`);
  check(end.lastRow <= end.askTop + 1, `[body21 ${tag}] at the end of the scroll the wall's last row (${end.lastRow}) is under the ask line (${end.askTop})`);
  const bad = await floor(page, vp.width, '.eyeframe');
  check(!bad.length, `[body21 ${tag}] Home's floor: ${bad.slice(0, 5).join('; ')}`);
  await shot(page, `${out}/eye2-body21-${tag}.png`);
  for (const k of ['learn', 'make']) {
    await go(page, `area-${k}`);
    await roomReady(page, k, `[body21 ${tag} ${k}] the room never became the wall`);
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => ({ keys: [...document.querySelectorAll('#dock .tabcap button')].every((b) => b.getBoundingClientRect().right <= innerWidth + 1), clipped: [...document.querySelectorAll('.eyeroom .eyetag span')].filter((s) => s.scrollWidth > s.clientWidth + 1).map((s) => s.textContent) }));
    const rb = await floor(page, vp.width, '#stage > .pg');
    check(r.keys && !r.clipped.length && !rb.length, `[body21 ${tag} ${k}] ${JSON.stringify(r)} ${rb.slice(0, 4).join('; ')}`);
    if (k === 'make') await shot(page, `${out}/eye2-body21-make-${tag}.png`);
  }
  await ctx.close();
}

mark(' e. t');
// ---- e. the ground's one line: on a software GL it shows once and goes; on a GPU (mocked) it never shows
for (const [soft, name] of [[true, 'software GL'], [false, 'a GPU']]) {
  const { ctx, page } = await open({ soft });
  await go(page, 'core');
  await until(page, () => window.__ghosty.eyeground?.on && window.__ghosty.eyeground.draws > 0, 60000, `[ground ${name}] the globe never lit`);
  await page.waitForTimeout(3200);
  const l = await page.evaluate(() => ({ lit: window.__lit, said: window.__ghosty.eyeground.said, soft: window.__ghosty.eyeground.soft, lighting: window.__ghosty.eyeground.lighting, text: document.querySelector('.eyelight')?.textContent, hidden: document.querySelector('.eyelight')?.hidden }));
  if (soft) {
    check(l.soft && l.said === 1 && l.lit.shown.length === 1 && l.lit.gone.length === 1 && !l.lighting && l.hidden && l.text === 'Lighting the ground…', `[ground ${name}] the line: ${JSON.stringify(l)}`);
    const gone = l.lit.gone[0] - l.lit.shown[0];
    check(gone > 0 && gone < 8000, `[ground ${name}] the line stood ${Math.round(gone)} ms`);
    timings.push(`ground: "Lighting the ground…" stood ${Math.round(gone)} ms on a software GL, said ${l.said} time`);
  } else check(!l.soft && l.said === 0 && l.lit.shown.length === 0, `[ground ${name}] the line showed on a GPU: ${JSON.stringify(l)}`);
  await ctx.close();
}

mark(' f. o');
// ---- f. offline: the last reading and its age on every feed that needs the signal; none blank; the stamp says paused
{
  const { ctx, page } = await open({ recents: ['eye', 'threats', 'brief'], pins: ['markets', 'gym'] });
  await go(page, 'core');
  await until(page, () => document.body.classList.contains('eyehome') && document.querySelectorAll('.eyefeed[data-kind="recent"]').length >= 2 && [...document.querySelectorAll('.eyefeed[data-id="eye"] .eyeline')].every((l) => l.textContent.length > 3), 15000, '[offline] Home never became the wall');
  await page.waitForTimeout(800);
  const online = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.eyewall .eyefeed[data-id]')].map((f) => [f.dataset.id, (f.querySelector('.eyeline')?.textContent ?? '').trim()])));
  check(!!online.eye && !!online.markets && !!online.gym && !/old|signal/.test(online.eye), `[offline] the online readings: ${JSON.stringify(online)}`);
  // (twelve minutes pass: the clock is moved on, the signal goes)
  await page.evaluate(() => { const real = Date.now; Date.now = () => real() + 12 * 60_000; });
  await ctx.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await page.waitForTimeout(1500);
  const h = await page.evaluate(() => ({ stamp: document.querySelector('.eyemast .g-stamp')?.innerText.replace(/\s+/g, ' ').trim() ?? '', feeds: [...document.querySelectorAll('.eyewall .eyefeed[data-id]')].map((f) => ({ id: f.dataset.id, line: (f.querySelector('.eyeline')?.textContent ?? '').trim() })), blank: [...document.querySelectorAll('.eyewall .eyefeed:not(.free) .eyeline')].filter((l) => !l.textContent.trim()).length, on: navigator.onLine }));
  check(!h.on && /OFFLINE, FEEDS PAUSED/i.test(h.stamp), `[offline] the stamp reads "${h.stamp}" (online ${h.on})`);
  const by = (id) => h.feeds.find((f) => f.id === id)?.line;
  check(by('eye') === `${online.eye} · 12 min old` && by('markets') === `${online.markets} · 12 min old`, `[offline] the kept readings: eye "${by('eye')}" (was "${online.eye}"), markets "${by('markets')}" (was "${online.markets}")`);
  check(h.blank === 0 && h.feeds.every((f) => f.line.length > 2), `[offline] a blank feed: ${JSON.stringify(h.feeds.filter((f) => f.line.length < 3))}`);
  check(by('gym') === online.gym && !/old|signal/.test(by('gym')), `[offline] a feed that does not need the signal changed: "${by('gym')}" (was "${online.gym}")`);
  await shot(page, `${out}/eye2-offline-home.png`);
  await go(page, 'area-plan');
  await roomReady(page, 'plan', '[offline] PLAN never became the wall');
  await page.waitForTimeout(800);
  const p = await page.evaluate(() => ({ feeds: [...document.querySelectorAll('#pg-area-plan .eyeroom .eyefeed')].map((f) => ({ id: f.dataset.id ?? f.dataset.kind, line: (f.querySelector('.eyeline')?.textContent ?? '').trim() })) }));
  check(p.feeds.every((f) => f.line.length > 1) && p.feeds.filter((f) => ['markets', 'threats', 'radio'].includes(f.id)).every((f) => /· 12 min old$|^No reading yet\. Needs a signal\.$/.test(f.line)), `[offline] PLAN's feeds: ${JSON.stringify(p.feeds)}`);
  await go(page, 'area-learn');
  await roomReady(page, 'learn', '[offline] LEARN never became the wall');
  check(await page.evaluate(() => [...document.querySelectorAll('#pg-area-learn .eyeroom .eyefeed')].every((f) => (f.querySelector('.eyeline')?.textContent ?? '').trim().length > 1)), '[offline] a feed in LEARN is blank');
  await ctx.close();
}

mark(' g. t');
// ---- g. the other worlds' rooms as before
for (const w of ['scan', 'ink', 'map', 'glass']) {
  const { ctx, page } = await open({ world: w });
  await go(page, 'area-learn');
  await page.waitForTimeout(1800);
  const r = await page.evaluate(() => {
    const pg = document.querySelector('#pg-area-learn');
    const shown = (s) => [...pg.querySelectorAll(s)].some((e) => e.getClientRects().length && getComputedStyle(e).display !== 'none');
    return { eyehub: shown('.eyehub'), eyeing: !!pg.querySelector('.hub.eyeing'), feeds: shown('.eyefeed'), tiles: [...pg.querySelectorAll('.hubtile')].filter((e) => e.getClientRects().length).length, band: shown('.roomband'), kick: document.querySelector('#dock .housekick')?.textContent.replace(/\s+/g, ' ').trim() ?? '', world: document.documentElement.dataset.world, light: !!document.querySelector('.eyelight') && !document.querySelector('.eyelight').hidden };
  });
  check(!r.eyehub && !r.eyeing && !r.feeds && r.tiles > 3 && !/THE WALL|LOOKING AT/i.test(r.kick) && r.world === w && !r.light, `[world] ${w}'s LEARN wears the eye: ${JSON.stringify(r)}`);
  if (w === 'scan') check(r.band, '[world] The Scan\'s LEARN lost its band');
  await ctx.close();
}

await browser.close();
timings.push(`whole run ${Math.round((Date.now() - T0) / 1000)} s`);
console.log(timings.map((t) => `TIMING ${t}`).join('\n'));
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'THE EYE 2 run clean at 440 × 956 and 390 × 844: every room the wall (one sharp feed, the line of sight, the kick row, EDITORS holding eight feeds, a tap opens, a hold pins, under budget), the film ending as the wall, ABILITIES as the wall with a tap that asks, BODY 21 with the ask line above the instruments, the ground\'s one line, offline readings with their age, the other worlds untouched.');
process.exit(problems.length ? 1 : 0);
