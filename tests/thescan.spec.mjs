// THE SCAN's Home and its boot (BRIEF-HUD-SCAN-1 stage 5; apps/web/src/features/core/scan, shell/boot.ts) on the owner's 440 × 956
// and a 390 × 844 phone, with software WebGL (SwiftShader, as tests/hero.spec.mjs runs MIND). The check reads the structure, the
// landing rules, the place line and the floor, never a frame rate (the runner draws at a few frames a second; the frame rate is
// his phone's number, read from the preview):
//   1. THE LANDING: a cold open lands on the world frame (THE WHOLE OF IT), the world drawn in Home's one context (the Mind's
//      stage: one WebGL canvas, the orb inside its viewport), the scene built once (tens of thousands of points, hairlines,
//      occluders), the marks of the world frame (the lit thing, the shelf, the aircraft, the station) each a 44 pt target, the
//      room's small things NOT marked from the sky; the house along the bottom with its seven rooms (HOME first, ME last), the
//      ask line's words; the stamp line and the where-line under it, mono, whole segments; the floor at 440 (nothing he can
//      press under 44 × 44, no type under 12 px, nothing wider than the screen);
//   2. THE FINDING RULE: a tap on the lit thing opens its screen; back on Home, Home lands on THE ROOM (he came from a thing in
//      it) with all eight things marked; a pinch out goes up one altitude at a time to the whole; a pinch in comes down;
//   3. THE LANDING RULES by a fake clock: left under twenty minutes ago → the room; twenty minutes or more → the world frame;
//   4. HOME BY PLACE: the three lines (AT HOME · FROM YOUR SAVED PLACE · NEVER SENT; OUT · FROM THE PHONE'S OWN SENSE · NEVER SENT;
//      ON THE WAY · 64 MPH · THIS PHONE · NEVER SENT), each a visibly different Home (the frame it lands on changes), the kicker
//      (YOU ARE OUT), and the switch off → SAVED PLACE ONLY and the home world; with no sense of place the line says so;
//   5. NOTHING SENT: with the phone's sense standing in as OUT at a known place and speed, a question goes to the brain and no
//      request that leaves the phone carries the fix's coordinates, its speed, or any coordinate but his saved place's; the
//      context carries at most the word and the saved place's name;
//   6. the same floor at 390 × 844.
// Under 300 s on the runner alone.
//   BASE=http://localhost:8788 node tests/thescan.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, openPanel, openSection } from './nav.mjs';
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

/** A phone opened on Ghosty, signed in, his name Tony, his saved place Birmingham, the phone's sense standing in (`place`). */
async function open({ viewport = PHONE, place = { here: true }, hero = true, boot = false } = {}) {
  const ctx = await browser.newContext({ viewport, ...UK, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/favicon|net::ERR|40[134]|Failed to load resource|^[WI]\d{4} |^INFO:|GPU stall|WebGL/.test(t)) problems.push(`console: ${t.slice(0, 200)}`);
  });
  await page.addInitScript(({ key, place, hero, boot }) => {
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Tony', speak: false, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
    if (hero) window.__ghostyHero = true;
    if (boot) {
      window.__ghostyBoot = true;
      window.__ghostyBootKind = 'full';
    }
    window.__ghostyPlace = place;
  }, { key: KEY, place, hero, boot });
  return { ctx, page };
}
const state = (page) => page.evaluate(() => {
  const s = window.__ghosty?.scan;
  if (!s) return null;
  return { on: s.on, alt: s.alt, landed: s.landed, place: s.place, line: s.line, lit: s.lit, marks: s.marks, orb: s.orb, scene: s.scene, staged: s.staged, moving: s.moving, moves: s.moves, stage: window.__ghosty.hero?.stage ?? null, mode: window.__ghosty.hero?.mode };
});
const until = (page, fn, ms, what, arg = null) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => { problems.push(what); return false; });
const settled = (page) => until(page, () => window.__ghosty?.scan && !window.__ghosty.scan.moving, 8000, 'the camera never settled');
/** The floor inside the frame and the house: targets, type, nothing sideways. */
const floor = (page, W) => page.evaluate((W) => {
  const bad = [];
  const seen = (e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none';
  for (const b of document.querySelectorAll('.scanframe button, #dock .tabcap button, #cbar #mic, #cbar .logbtn, #top .you')) {
    if (!seen(b)) continue;
    const r = b.getBoundingClientRect();
    if (r.width < 43.5 || r.height < 43.5) bad.push(`target "${(b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 24)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
  }
  for (const e of document.querySelectorAll('.scanframe *, #dock .tabcap *')) {
    if (!seen(e) || !e.childNodes.length || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    // (an icon key's word is for VoiceOver alone: the chat key's LOG is drawn as its glyph)
    if (e.closest('.logbtn') || getComputedStyle(e).color === 'rgba(0, 0, 0, 0)') continue;
    const px = parseFloat(getComputedStyle(e).fontSize);
    if (px < 12) bad.push(`type ${px}px: "${e.textContent.trim().slice(0, 24)}"`);
    const r = e.getBoundingClientRect();
    if (r.right > W + 1 || r.left < -1) bad.push(`sideways: "${e.textContent.trim().slice(0, 24)}" ${Math.round(r.left)}–${Math.round(r.right)}`);
  }
  return bad;
}, W);
const houseRooms = (page) => page.evaluate(() => [...document.querySelectorAll('#dock .tabcap button')].map((b) => b.textContent.trim()));
const whereLine = (page) => page.evaluate(() => document.querySelector('.scanwhere')?.innerText.replace(/\s+/g, ' ').trim() ?? '');

// ---- 1. the landing on the world frame, the one context, the marks, the house, the floor
{
  const { ctx, page } = await open();
  const t = Date.now();
  await page.goto(base);
  await page.waitForSelector('#boot', { state: 'detached', timeout: 40000 }).catch(() => problems.push('[land] the boot never ended'));
  await until(page, () => window.__ghosty?.scan?.on && window.__ghosty.scan.staged, 40000, '[land] Home never took the stage (Mind drawing the world in the one context)');
  await until(page, () => (window.__ghosty?.hero?.stage?.frames ?? 0) >= 1, 30000, '[land] the stage never drew a frame');
  const s = await state(page);
  timings.push(`land: Home on the stage ${Date.now() - t} ms after goto; scene ${JSON.stringify(s?.scene)}; ${s?.stage?.frames} stage frames`);
  check(s?.alt === 'whole' && s?.landed === 'boot', `[land] a cold open landed on "${s?.alt}" by "${s?.landed}" (want the whole of it, by the boot)`);
  check(s?.scene?.points > 50000 && s?.scene?.lines > 3000 && s?.scene?.occluders > 10, `[land] the scene is ${JSON.stringify(s?.scene)} (want the room, the house, the street and the city: tens of thousands of points)`);
  check(s?.mode === 'mind' && s?.stage?.on && Array.isArray(s?.stage?.rect), `[land] Mind is not drawing the world on its stage: ${JSON.stringify({ mode: s?.mode, stage: s?.stage })}`);
  // one WebGL canvas on the page: the Mind's, full-screen; the 2-D reactor's canvas under it is clear
  const canvases = await page.evaluate(() => ({ gl: document.querySelectorAll('canvas.mindhero').length, staged: !!document.querySelector('.scanstage canvas.mindhero.staged'), reactorHidden: Number(getComputedStyle(document.querySelector('canvas.reactor')).opacity) === 0, size: (() => { const c = document.querySelector('canvas.mindhero'); const r = c.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })() }));
  check(canvases.gl === 1 && canvases.staged && canvases.reactorHidden, `[land] the one context: ${JSON.stringify(canvases)}`);
  check(canvases.size[0] >= PHONE.width - 1 && canvases.size[1] >= PHONE.height * 0.8, `[land] the stage canvas is ${canvases.size} (want the screen)`);
  // the orb's viewport is where the orb's box is (the hero's wrap, placed by the camera)
  const orbBox = await page.evaluate(() => { const r = document.querySelector('.scanorb').getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round); });
  check(JSON.stringify(orbBox) === JSON.stringify(s?.stage?.rect), `[land] the orb's viewport ${JSON.stringify(s?.stage?.rect)} is not its box ${JSON.stringify(orbBox)}`);
  // the world frame's marks: the lit thing (the book or the Brief by the hour), the shelf, the aircraft, the station; never the room's small things
  const ids = (s?.marks ?? []).map((m) => m.id);
  for (const want of [s?.lit, 'r-shelf', 'r-air', 'r-station']) check(ids.includes(want), `[land] the world frame does not mark ${want}: ${ids.join(', ')}`);
  for (const not of ['r-lens', 'r-gym', 'r-courses', 'r-agenda', 'r-win']) check(!ids.includes(not), `[land] the world frame marks ${not} (the room's small things would stack)`);
  for (const m of s?.marks ?? []) check(m.rect[2] >= 44 && m.rect[3] >= 44, `[land] the mark ${m.id} is ${m.rect[2]}×${m.rect[3]} (want 44 pt)`);
  // the house: seven rooms, HOME first and lit, ME last; the ask line's words
  const rooms = await houseRooms(page);
  check(rooms.length === 7 && /^home$/i.test(rooms[0]) && /^me$/i.test(rooms[6]), `[land] the house has ${rooms.length} rooms: ${rooms.join(', ')}`);
  const ask = await page.evaluate(() => ({ ph: document.querySelector('#cin')?.placeholder, inFrame: !!document.querySelector('.scanask #cbar'), kick: document.querySelector('.scankick')?.innerText.replace(/\s+/g, ' ').trim() }));
  check(ask.inFrame && ask.ph === 'Ask, or say where to go', `[land] the ask line: ${JSON.stringify(ask)}`);
  check(/THE HOUSE · 7 ROOMS/.test(ask.kick ?? '') && /YOU ARE HOME/.test(ask.kick ?? ''), `[land] the house's kicker reads "${ask.kick}"`);
  // the stamp and the where-line: mono, whole segments, the dot at each segment's end
  const top = await page.evaluate(() => ({ stamp: document.querySelector('.scantop .hstamp')?.innerText.replace(/\s+/g, ' ').trim() ?? '', where: document.querySelector('.scanwhere')?.innerText.replace(/\s+/g, ' ').trim() ?? '', mono: /mono|Menlo|Plex/i.test(getComputedStyle(document.querySelector('.scanwhere')).fontFamily), say: document.querySelector('.scansay')?.textContent, count: document.querySelectorAll('#pg-core .g-stamp').length }));
  check(top.count === 1 && / · (WATCHING \d+ FEEDS?|CHECKING FEEDS|NO FEEDS YET|OFFLINE, FEEDS PAUSED) · LOOKING AT HOME$/.test(top.stamp), `[land] Home's stamp line: ${JSON.stringify(top)}`);
  check(top.where === 'AT HOME · FROM YOUR SAVED PLACE · NEVER SENT' && top.mono, `[land] the where-line reads "${top.where}" (mono ${top.mono})`);
  check(/^Good (morning|afternoon|evening|night), Tony\.$/.test(top.say ?? ''), `[land] the greeting reads "${top.say}"`);
  const bad = await floor(page, PHONE.width);
  check(!bad.length, `[land 440] the floor: ${bad.slice(0, 6).join('; ')}`);
  await page.screenshot({ path: `${out}/thescan-world.png` });

  // ---- 2. the finding rule: the lit thing one tap; back, the room; a pinch out goes up, a pinch in down
  const litTo = (s?.marks ?? []).find((m) => m.id === s?.lit)?.to ?? '';
  await page.click(`.scanret[data-id="${s?.lit}"]`);
  await until(page, (to) => document.body.dataset.tab === to.split('?')[0], 10000, `[find] the lit thing's tap did not open ${litTo}`, litTo);
  await page.evaluate(() => (location.hash = 'core'));
  await until(page, () => document.body.dataset.tab === 'core' && window.__ghosty.scan.on, 10000, '[find] Home did not come back');
  await settled(page);
  const r = await state(page);
  check(r?.alt === 'room' && r?.landed === 'thing', `[find] back from a thing in the room Home landed on "${r?.alt}" by "${r?.landed}" (want the room)`);
  const roomIds = (r?.marks ?? []).map((m) => m.id);
  for (const want of ['r-win', 'r-shelf', 'r-lens', 'r-agenda', 'r-brief', 'r-alice', 'r-gym', 'r-courses']) check(roomIds.includes(want), `[find] the room does not mark ${want}: ${roomIds.join(', ')}`);
  for (const m of r?.marks ?? []) check(m.rect[2] >= 44 && m.rect[3] >= 44, `[find] the room's mark ${m.id} is ${m.rect[2]}×${m.rect[3]}`);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/thescan-room.png` });
  const steps = [];
  for (const want of ['street', 'city', 'whole']) {
    await page.evaluate(() => window.__ghosty.scan.pinch(1.6));
    await settled(page);
    steps.push((await state(page))?.alt);
    check(steps.at(-1) === want, `[find] a pinch out went to "${steps.at(-1)}" (want ${want})`);
  }
  await page.evaluate(() => window.__ghosty.scan.pinch(0.6));
  await settled(page);
  check((await state(page))?.alt === 'city', `[find] a pinch in from the whole went to "${(await state(page))?.alt}" (want the city)`);
  const moved = (await state(page))?.moves;
  check(moved >= 4, `[find] the camera moved ${moved} times (want one a pinch)`);
  // the camera's move is on the tokens' curve: the bring (900 ms) and no cut
  const bring = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--g-dur-bring')));
  check(bring === 900, `[find] --g-dur-bring is ${bring}`);
  timings.push(`find: pinches ${steps.join(' → ')}, then down to city; ${moved} moves`);

  // ---- 3. the landing rules by a fake clock: back within twenty minutes → the room; after → the whole
  await page.evaluate(() => { window.__ghosty.scan.clock = () => Date.now(); });
  await page.evaluate(() => window.__ghosty.scan.goAlt('room'));
  await settled(page);
  await page.evaluate(() => (location.hash = 'agenda'));
  await until(page, () => document.body.dataset.tab === 'agenda', 10000, '[rules] the agenda did not open');
  await page.evaluate(() => (location.hash = 'core'));
  await until(page, () => document.body.dataset.tab === 'core' && window.__ghosty.scan.on, 10000, '[rules] Home did not come back (1)');
  const soon = await state(page);
  check(soon?.alt === 'room' && soon?.landed === 'recent', `[rules] back within twenty minutes Home landed on "${soon?.alt}" by "${soon?.landed}" (want the room, recent)`);
  await page.evaluate(() => (location.hash = 'agenda'));
  await until(page, () => document.body.dataset.tab === 'agenda', 10000, '[rules] the agenda did not open (2)');
  await page.evaluate(() => { window.__ghosty.scan.clock = () => Date.now() + 21 * 60_000; });
  await page.evaluate(() => (location.hash = 'core'));
  await until(page, () => document.body.dataset.tab === 'core' && window.__ghosty.scan.on, 10000, '[rules] Home did not come back (2)');
  const later = await state(page);
  check(later?.alt === 'whole' && later?.landed === 'absence', `[rules] back after twenty-one minutes Home landed on "${later?.alt}" by "${later?.landed}" (want the whole, absence)`);
  await page.evaluate(() => { window.__ghosty.scan.clock = null; });

  // ---- 4. Home by place: the three lines, each a different frame; the switch; no sense of place
  await page.evaluate(() => { window.__ghostyPlace = { far: true }; window.__ghosty.scan.reland(); });
  await settled(page);
  const outS = await state(page);
  check(outS?.place === 'out' && (await whereLine(page)) === 'OUT · FROM THE PHONE’S OWN SENSE · NEVER SENT', `[place] OUT: "${await whereLine(page)}" (${outS?.place})`);
  check(outS?.alt === 'out', `[place] OUT landed on "${outS?.alt}" (want the world on the street and the city)`);
  const outWords = await page.evaluate(() => ({ kick: document.querySelector('.scankick')?.innerText.replace(/\s+/g, ' ').trim(), now: document.querySelector('.scanco')?.innerText.replace(/\s+/g, ' ').trim() }));
  check(/YOU ARE OUT/.test(outWords.kick ?? '') && /THE WAY HOME/.test(outWords.now ?? '') && /Birmingham/.test(outWords.now ?? ''), `[place] OUT's words: ${JSON.stringify(outWords)}`);
  check(!/\d+\.\d+/.test(await page.evaluate(() => document.querySelector('.scanframe').innerText)), '[place] a number with a decimal on the frame (a coordinate?)');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/thescan-out.png` });
  await page.evaluate(() => { window.__ghostyPlace = { mph: 64 }; window.__ghosty.scan.reland(); });
  await settled(page);
  const wayS = await state(page);
  check(wayS?.place === 'way' && (await whereLine(page)) === 'ON THE WAY · 64 MPH · THIS PHONE · NEVER SENT', `[place] ON THE WAY: "${await whereLine(page)}" (${wayS?.place})`);
  check(wayS?.alt === 'line', `[place] ON THE WAY landed on "${wayS?.alt}" (want the line)`);
  check(/YOU ARE ON THE WAY/.test(await page.evaluate(() => document.querySelector('.scankick')?.innerText.replace(/\s+/g, ' ') ?? '')), '[place] the kicker does not say YOU ARE ON THE WAY');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/thescan-way.png` });
  // the switch off: SAVED PLACE ONLY, and the home world whatever the sense says
  await page.evaluate(() => window.__ghosty.settings.set({ placeSense: false }));
  await settled(page);
  const offS = await state(page);
  check((await whereLine(page)) === 'SAVED PLACE ONLY' && offS?.place === 'saved', `[place] the switch off: "${await whereLine(page)}" (${offS?.place})`);
  check(offS?.alt !== 'line' && offS?.alt !== 'out', `[place] the switch off still shows the place's frame (${offS?.alt})`);
  check(/YOU ARE HOME/.test(await page.evaluate(() => document.querySelector('.scankick')?.innerText.replace(/\s+/g, ' ') ?? '')), '[place] the switch off: the kicker is not YOU ARE HOME');
  await page.evaluate(() => window.__ghosty.settings.set({ placeSense: true }));
  // no sense of place: said, never guessed
  await page.evaluate(() => { window.__ghostyPlace = { none: true }; window.__ghosty.scan.reland(); });
  await settled(page);
  check((await whereLine(page)) === 'AT HOME · FROM THE HOUR AND YOUR SAVED PLACE · NEVER SENT', `[place] no sense of place: "${await whereLine(page)}"`);
  // the switch lives in Settings → Voice & home (with the boot's score beside the sounds): tapped there, Home says SAVED PLACE ONLY
  await page.evaluate(() => (location.hash = 'settings'));
  await until(page, () => document.body.dataset.tab === 'settings', 10000, '[switch] Settings did not open');
  await openSection(page, 'settings', 'Voice & home');
  await openPanel(page, 'settings', 'VOICE & HOME');
  const rows = await page.evaluate(() => ({ sense: document.querySelector('#pg-settings .setsw[data-id="placesense"]')?.getAttribute('aria-checked'), score: document.querySelector('#pg-settings .setsw[data-id="bootscore"]')?.getAttribute('aria-checked'), senseWords: document.querySelector('#pg-settings .setsw[data-id="placesense"]')?.textContent ?? '' }));
  check(rows.sense === 'true' && rows.score === 'true', `[switch] the rows in Settings → Voice & home: ${JSON.stringify(rows)} (want both on by default)`);
  check(/Never sent/.test(rows.senseWords), `[switch] the row does not say never sent: "${rows.senseWords.slice(0, 120)}"`);
  await page.click('#pg-settings .setsw[data-id="placesense"]').catch(() => problems.push('[switch] no switch to tap'));
  await page.evaluate(() => (location.hash = 'core'));
  await until(page, () => document.body.dataset.tab === 'core' && window.__ghosty.scan.on, 10000, '[switch] Home did not come back');
  await settled(page);
  check((await whereLine(page)) === 'SAVED PLACE ONLY', `[switch] after the row was tapped off: "${await whereLine(page)}"`);
  await page.evaluate(() => window.__ghosty.settings.set({ placeSense: true }));
  await settled(page);

  // ---- 5. nothing sent: OUT at a known speed, a question to the brain; no request carries the fix, the speed or any coordinate but his saved place's
  await page.evaluate(() => { window.__ghostyPlace = { far: true, mph: 0 }; window.__ghosty.scan.reland(); });
  await settled(page);
  const sent = [];
  page.on('request', (rq) => {
    if (!/\/api\//.test(rq.url())) return;
    sent.push({ url: rq.url(), body: rq.postData() ?? '' });
  });
  await page.evaluate(() => window.__ghosty.send('where am I right now'));
  await until(page, () => window.__ghosty.awareness.lastSent().at > 0, 15000, '[sent] the question never went');
  await page.waitForTimeout(1200);
  const chat = sent.find((r) => /\/api\/chat/.test(r.url));
  check(!!chat, '[sent] no chat request left the phone');
  if (chat) {
    let ctxOf = null;
    try {
      ctxOf = JSON.parse(chat.body).context;
    } catch {
      /* not JSON */
    }
    check(ctxOf && ctxOf.place && ctxOf.place.word === 'out' && ctxOf.place.name === 'Birmingham' && Object.keys(ctxOf.place).length === 2, `[sent] the context's place: ${JSON.stringify(ctxOf?.place)} (want the word and the saved place's name, nothing else)`);
    check(ctxOf && /the home screen, out, near Birmingham/.test(ctxOf.screen?.line ?? ''), `[sent] the screen line: ${ctxOf?.screen?.line}`);
    check(!/speed|mph|geolocation|latitude|accuracy|fix/i.test(JSON.stringify(ctxOf ?? {})), `[sent] the context carries a speed or a fix: ${JSON.stringify(ctxOf).slice(0, 200)}`);
  }
  // every number pair on every request that could be a coordinate is his saved place's (52.48, -1.9), never another
  const coords = sent.flatMap((r) => [...(r.body + r.url).matchAll(/-?\d{1,3}\.\d{2,}/g)].map((m) => m[0]));
  const strange = coords.filter((c) => !['52.48', '-1.9', '-1.90'].some((ok) => c.startsWith(ok)) && Math.abs(Number(c)) <= 180);
  check(!strange.length, `[sent] a coordinate that is not his saved place's left the phone: ${strange.slice(0, 4).join(', ')}`);
  timings.push(`sent: ${sent.length} requests while asking, context place ${JSON.stringify((() => { try { return JSON.parse(chat?.body ?? '{}').context?.place; } catch { return null; } })())}`);
  await ctx.close();
}

// ---- 6. the floor at 390 × 844
{
  const { ctx, page } = await open({ viewport: { width: 390, height: 844 } });
  await page.goto(base);
  await page.waitForSelector('#boot', { state: 'detached', timeout: 40000 }).catch(() => problems.push('[390] the boot never ended'));
  await until(page, () => window.__ghosty?.scan?.on && window.__ghosty.scan.staged, 40000, '[390] Home never took the stage');
  await page.waitForTimeout(800);
  const s = await state(page);
  for (const m of s?.marks ?? []) check(m.rect[2] >= 44 && m.rect[3] >= 44, `[390] the mark ${m.id} is ${m.rect[2]}×${m.rect[3]}`);
  const bad = await floor(page, 390);
  check(!bad.length, `[390] the floor: ${bad.slice(0, 6).join('; ')}`);
  await page.screenshot({ path: `${out}/thescan-world-390.png` });
  await page.evaluate(() => window.__ghosty.scan.goAlt('room'));
  await settled(page);
  await page.waitForTimeout(600);
  const bad2 = await floor(page, 390);
  check(!bad2.length, `[390 room] the floor: ${bad2.slice(0, 6).join('; ')}`);
  await page.screenshot({ path: `${out}/thescan-room-390.png` });
  await ctx.close();
}

// ---- 7. the score (B) under the film: a cold open is silent (the platform's rule, said nowhere); a reboot after a tap hears it,
//         cue by cue; with the row off, A: the one tone alone
{
  const { ctx, page } = await open({ boot: true });
  await page.addInitScript(() => {
    window.__sfx = [];
    document.addEventListener('ghosty-sfx', (e) => window.__sfx.push(e.detail));
    // the phone's rule on a cold open: no sound until a real tap (Playwright's evaluate counts as a gesture in Chromium otherwise)
    window.__tapped = false;
    addEventListener('pointerdown', (e) => e.isTrusted && (window.__tapped = true), true);
    try {
      Object.defineProperty(Navigator.prototype, 'userActivation', { configurable: true, get: () => ({ get hasBeenActive() { return window.__tapped; }, get isActive() { return false; } }) });
    } catch { /* left as it is */ }
  });
  const t = Date.now();
  await page.goto(base);
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 }).catch(() => problems.push('[score] the film never ended'));
  const cold = await page.evaluate(() => ({ film: window.__bootState.film, kind: window.__bootState.kind, score: window.__bootState.score, sound: window.__bootState.sound, tone: window.__bootState.tone, sfx: window.__sfx }));
  timings.push(`score: the cold open's film ended ${Date.now() - t} ms after goto (${cold.kind})`);
  check(cold.film && !cold.score.on && !cold.sound && cold.tone === 'quiet' && !cold.sfx.length, `[score] a cold open sounded before any tap: ${JSON.stringify({ score: cold.score, sound: cold.sound, tone: cold.tone, sfx: cold.sfx })}`);
  check(!(await page.evaluate(() => /sound|tap to hear|silent/i.test(document.querySelector('#pg-core .scanframe')?.innerText ?? ''))), '[score] the screen says something about the sound (the rule is honoured and said nowhere)');
  // a tap, then the film again (reboot): the score sounds, cue by cue, and stops dead at the lock
  await page.mouse.click(220, 120);
  await page.evaluate(() => window.__ghosty.run('reboot'));
  await until(page, () => window.__bootState.plays === 2, 8000, '[score] the reboot did not play');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 }).catch(() => problems.push('[score] the reboot never ended'));
  const heard = await page.evaluate(() => ({ score: window.__bootState.score, sound: window.__bootState.sound, tone: window.__bootState.tone, sfx: window.__sfx.filter((k) => k === 'lock' || k === 'click'), feedLines: window.__bootState.feedLines }));
  check(heard.score.on === false && heard.sound && heard.tone === 'tone' && heard.sfx.length === 1, `[score] after a tap the reboot: ${JSON.stringify(heard)} (want the score played and stopped, the tone once)`);
  for (const cue of ['scan', 'thing', 'sphere', 'lock', 'voice', 'stop']) check(heard.score.cues.includes(cue), `[score] the cue "${cue}" never came: ${heard.score.cues.join(', ')}`);
  // (the runner's frames can be a second apart, so phases arrive together; the pad still rises before the chord stops dead with the lock)
  const cues = heard.score.cues;
  check(cues.indexOf('scan') < cues.indexOf('lock') && cues.indexOf('thing') < cues.indexOf('lock') && cues.filter((c) => c === 'thing').length >= 4 && cues.filter((c) => c === 'feed').length <= 3, `[score] the cues: ${cues.join(', ')}`);
  // one tick per feed that answered during the film, and none for a feed that did not (the feeds' lines are only the ones that
  // connected: a guardian still loading when the film plays gives no line and no tick)
  const fed = cues.filter((c) => c === 'feed').length;
  check(fed === heard.feedLines.length, `[score] ${fed} feed tick(s) for ${heard.feedLines.length} feed line(s): ${JSON.stringify(heard.feedLines)}`);
  // A: the row off, the one tone alone
  await page.evaluate(() => window.__ghosty.settings.set({ bootScore: false }));
  await page.evaluate(() => window.__ghosty.run('reboot'));
  await until(page, () => window.__bootState.plays === 3, 8000, '[score] the second reboot did not play');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 }).catch(() => problems.push('[score] the second reboot never ended'));
  const a = await page.evaluate(() => ({ score: window.__bootState.score, sound: window.__bootState.sound, tone: window.__bootState.tone, cues: window.__bootState.score.cues.length }));
  check(!a.score.on && !a.cues && a.tone === 'tone', `[score] A (the row off): ${JSON.stringify(a)} (want no score, the tone alone, as today)`);
  await ctx.close();
}

await browser.close();
timings.push(`whole run ${Math.round((Date.now() - T0) / 1000)} s`);
console.log(timings.map((t) => `TIMING ${t}`).join('\n'));
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'THE SCAN run clean at 440 × 956 and 390 × 844: a cold open landed on the world frame drawn in Home\'s one context with the orb in its viewport, the scene built once, the world frame\'s marks (and not the room\'s small things) each 44 pt, the house of seven rooms and the ask line, the stamp and the where-line mono and whole; the lit thing one tap and Home back on the room with all eight marked; a pinch out up through the street and the city to the whole and a pinch in down; the landing rules by a fake clock; the three place lines each on their own frame, the switch off saying SAVED PLACE ONLY and no sense of place said; a question out with the word and the saved place\'s name and no fix, speed or other coordinate; the floor at both widths.');
process.exit(problems.length ? 1 : 0);
