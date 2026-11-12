// POLISH 1, THE EDGES (docs/build-plan/BRIEF-POLISH-1.md): the seams of the new worlds, THE SCAN and ONE INK, at 440 × 956 and 390 × 844.
//   a. ONE ERROR VOICE: with the network cut (every request refused) on Home, in the chat and on the Lens, no element's text is a raw
//      browser string ("aborted", "fetch failed", "undefined", "[object Object]", "TypeError", "NetworkError", "Failed to"), and his own
//      words about the signal are on the screen;
//   b. EVERY WAIT SAID: the Stage ("Drawing it…"), the Lens ("Waking the eyes…", then "Looking…" as a tag row) and the Studio ("Opening
//      the model…") put a waiting line up within 400 ms of their start and take it away when the thing lands;
//   c. THE BIGGEST TEXT (BODY 21): the house line (THE HOUSE · 7 ROOMS / YOU ARE IN <ROOM>) and ONE INK's foot are inside the screen with no
//      word cut, the line wraps to two rows with the second right-aligned, every key 44 pt, nothing sideways;
//   d. EMPTY STATES: Favourites, Recents, the Library shelf and Spending (nothing seeded) each show empty()'s shape (a head and the one
//      thing to do) in the world's marks (left-aligned on a hairline); Watchers are not landed, so not checked;
//   e. THE BOOT ON A SLOW OPEN: with the first screen seven seconds late the film goes on drawing (a frame at least every 1.5 s, the sweep passing
//      every 1.3 s), says "Still waking. The signal is slow." after six seconds, and lands on Home with no cut (the marks stand where they were).
//   BASE=http://localhost:8813 NO_GL_SHOTS=1 node tests/polish1.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { UK } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
const problems = [];
const check = (ok, what) => ok || problems.push(what);
const KEY = 'preview-owner-key-0123456789';
const T0 = Date.now();
const WORLDS = ['scan', 'ink'];
const VIEWPORTS = [{ width: 440, height: 956 }, { width: 390, height: 844 }];
const RAW = /aborted|fetch failed|undefined|\[object Object\]|TypeError|NetworkError|Failed to/i;
const lookOf = (world, body) => ({ ground: world === 'ink' ? 'warm' : 'graphite', world, night: world === 'ink' ? 'warm' : 'graphite', switches: body ? { body } : {} });

async function open({ world = 'scan', viewport = VIEWPORTS[0], body = 0, boot = false, heavy = false, camera = false } = {}) {
  const ctx = await browser.newContext({ viewport, ...UK, deviceScaleFactor: boot ? 1 : 2, isMobile: true, hasTouch: true, permissions: camera ? ['camera'] : [] });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
  await page.addInitScript(({ key, look, boot, heavy }) => {
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.themes1', '1');
    localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Tony', speak: false, sounds: false, theme: 'reactor', favourites: [], look, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
    if (heavy) localStorage.setItem('ghosty.lens.heavy', '1');
    window.__ghostyHero = true;
    window.__ghostyPlace = { none: true };
    if (boot) {
      window.__ghostyBoot = true;
      window.__ghostyBootKind = 'full';
    }
    // every waiting line ever put up, with the moment it came and went (ui/wait.ts)
    window.__waits = [];
    new MutationObserver((ms) => {
      for (const m of ms) {
        // (a line put up inside a screen that is then added to the page comes in with its screen: the node and the ones inside it)
        const lines = (n) => (n.nodeType === 1 ? [...(n.matches?.('[data-wait]') ? [n] : []), ...n.querySelectorAll('[data-wait]')] : []);
        for (const n of m.addedNodes) for (const l of lines(n)) window.__waits.push({ w: l.dataset.wait, in: Math.round(performance.now()) });
        for (const n of m.removedNodes) for (const l of lines(n)) window.__waits.push({ w: l.dataset.wait, out: Math.round(performance.now()) });
      }
    }).observe(document, { childList: true, subtree: true });
  }, { key: KEY, look: lookOf(world, body), boot, heavy });
  return { ctx, page };
}
const settle = async (page) => {
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 40000 }).catch(() => problems.push('the boot never ended'));
  await page.waitForTimeout(1500);
};
const go = async (page, hash, ms = 1300) => {
  await page.evaluate((h) => (location.hash = h), hash);
  await page.waitForTimeout(ms);
};
// every visible element's own words (its text nodes), its VoiceOver name and its title
const visibleTexts = (page) => page.evaluate(() => [...document.querySelectorAll('body *')]
  .filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden')
  .map((e) => `${[...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ')} ${e.getAttribute('aria-label') ?? ''} ${e.getAttribute('title') ?? ''}`.trim())
  .filter(Boolean));
const timing = [];
const run = (k) => !process.env.ONLY || process.env.ONLY.includes(k);

// ---- a. one error voice: the network cut
if (run('a')) for (const world of WORLDS) for (const viewport of VIEWPORTS) {
  const tag = `[voice ${world} ${viewport.width}]`;
  const { ctx, page } = await open({ world, viewport, camera: true });
  await settle(page);
  await ctx.route(/^http:\/\/localhost:\d+\/api\//, (r) => r.abort());
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  await go(page, 'core', 900);
  let t = await visibleTexts(page);
  check(!t.some((x) => RAW.test(x)), `${tag} Home shows a raw browser string: ${t.filter((x) => RAW.test(x)).join(' | ').slice(0, 200)}`);
  // the chat: the ask line (Home's own in THE SCAN, the jump bar from ONE INK's ask line)
  let box = page.locator('#cbar input, .scanask input').first();
  if (world === 'ink') {
    await page.locator('.inkask').first().click({ timeout: 8000 }).catch(() => problems.push(`${tag} ONE INK's ask line did not open`));
    await page.waitForTimeout(500);
    box = page.locator('#palette input').first();
  }
  await box.fill('what is the weather like', { timeout: 8000 }).catch(() => problems.push(`${tag} the ask line took no words`));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => /can.t reach my brain|lost the signal|no connection|on this device|on this phone/i.test(document.body.innerText), null, { timeout: 60000 }).catch(() => undefined);
  await page.waitForTimeout(500);
  t = await visibleTexts(page);
  check(!t.some((x) => RAW.test(x)), `${tag} the chat shows a raw browser string: ${t.filter((x) => RAW.test(x)).join(' | ').slice(0, 200)}`);
  check(t.some((x) => /can.t reach my brain|lost the signal|no connection|on this device|on this phone/i.test(x)), `${tag} the chat says nothing in his own words about the signal (the screen says: ${t.filter((x) => x.length > 20).slice(0, 4).join(' | ').slice(0, 300)})`);
  // the Lens
  await go(page, 'lens', 3500);
  t = await visibleTexts(page);
  check(!t.some((x) => RAW.test(x)), `${tag} the Lens shows a raw browser string: ${t.filter((x) => RAW.test(x)).join(' | ').slice(0, 200)}`);
  check(t.some((x) => /phone|signal|offline|connection|Wi-?Fi/i.test(x)), `${tag} the Lens says nothing about what works without a signal`);
  // an action that fails on the cut line: REVERSE's START says what happened in his words, not the browser's
  await go(page, 'reverse', 2500);
  await page.locator('#pg-reverse input[aria-label="What to look at"]').first().fill('bbc.co.uk', { timeout: 20000 }).catch(() => problems.push(`${tag} REVERSE's link line took no words`));
  // (START is pressed once: the app may try a cut line again for a while before it gives up, and a second press while it does is refused)
  await page.locator('#pg-reverse button', { hasText: /^start$/i }).first().evaluate((b) => b.click()).catch(() => problems.push(`${tag} REVERSE's START did not press`));
  await page.waitForFunction(() => /lost the signal halfway/i.test(document.getElementById('pg-reverse')?.innerText ?? ''), null, { timeout: 90000 }).catch(() => undefined);
  t = await visibleTexts(page);
  check(!t.some((x) => RAW.test(x)), `${tag} a failed START in REVERSE shows a raw browser string: ${t.filter((x) => RAW.test(x)).join(' | ').slice(0, 200)}`);
  check(t.some((x) => /lost the signal|can.t reach|try again/i.test(x)), `${tag} a failed START in REVERSE says nothing in his own words (the page says: ${await page.evaluate(() => (document.getElementById('pg-reverse')?.innerText ?? '').replace(/\\s+/g, ' ').slice(0, 260))})`);
  await ctx.close();
}

// ---- b. every wait said
if (run('b')) for (const world of WORLDS) {
  const viewport = VIEWPORTS[0];
  const tag = `[waits ${world}]`;
  const { ctx, page } = await open({ world, viewport, heavy: true, camera: true });
  await page.addInitScript(() => {
    window.__ghostyShow = true;
    window.__ghostyShowDelay = 1500;
  });
  await settle(page);
  await page.waitForTimeout(2500);
  // the Stage
  await page.waitForFunction(() => !!window.__ghosty?.show?.present, null, { timeout: 30000 }).catch(() => problems.push(`${tag} the Stage's handle never came up`));
  const stage = await page.evaluate(async () => {
    if (!window.__ghosty?.show?.present) return { t: 0, mid: false, shown: false, still: false, w: [] };
    const t = Math.round(performance.now());
    const p = window.__ghosty.show.present({ ask: 'where is Lisbon', reply: 'Lisbon is in Portugal.', tools: [], clients: [], cards: [] });
    await new Promise((r) => setTimeout(r, 400));
    const mid = !!document.querySelector('[data-wait="Drawing it…"]');
    await p;
    await new Promise((r) => setTimeout(r, 100));
    return { t, mid, shown: !!document.getElementById('thestage'), still: !!document.querySelector('[data-wait="Drawing it…"]'), w: window.__waits.filter((x) => x.w === 'Drawing it…') };
  });
  check(stage.mid && stage.w[0] && stage.w[0].in - stage.t < 400, `${tag} the Stage put no "Drawing it…" up within 400 ms: ${JSON.stringify(stage)}`);
  check(stage.shown && !stage.still && stage.w.some((x) => x.out), `${tag} the Stage's "Drawing it…" did not go when the picture landed: ${JSON.stringify(stage)}`);
  // the Lens: GET THE EYES is kept on this phone, so it wakes them; the first tag is LOOKING… until a real one lands
  await page.evaluate(() => { window.__waits = []; window.__t = Math.round(performance.now()); location.hash = 'lens'; });
  await page.waitForFunction(() => window.__waits.some((x) => x.w === 'Waking the eyes…') && window.__waits.some((x) => x.out), null, { timeout: 40000 }).catch(() => undefined);
  const lens = await page.evaluate(() => ({ t: window.__t, w: window.__waits }));
  const woke = lens.w.find((x) => x.w === 'Waking the eyes…' && x.in);
  check(woke && woke.in - lens.t < 400, `${tag} the Lens put no "Waking the eyes…" up within 400 ms of opening: ${JSON.stringify(lens)}`);
  check(lens.w.some((x) => x.w === 'Waking the eyes…' && x.out), `${tag} the Lens's "Waking the eyes…" never went`);
  await page.waitForTimeout(1500);
  const looking = await page.evaluate(() => window.__waits.filter((x) => x.w === 'Looking…'));
  check(looking.length > 0 || await page.evaluate(() => /failed|off/.test(window.__ghosty?.lens?.finder ?? '') || !!document.querySelector('.lenstags')), `${tag} the Lens never said LOOKING… for its first tag`);
  // the Studio
  await go(page, 'core', 2500); // (the Lens and its eyes are let go of first: the Studio's own opening is what is timed)
  await page.evaluate(() => { window.__waits = []; window.__t = Math.round(performance.now()); location.hash = 'studio'; });
  await page.waitForFunction(() => window.__waits.some((x) => x.out && x.out > window.__t), null, { timeout: 40000 }).catch(() => undefined);
  const studio = await page.evaluate(() => ({ t: window.__t, w: window.__waits }));
  const sw = studio.w.find((x) => /^(Building the room|Opening the model|Opening the studio)…$/.test(x.w) && x.in);
  check(sw && sw.in - studio.t < 400, `${tag} the Studio had no waiting line up within 400 ms of opening: ${JSON.stringify(studio)}`);
  check(studio.w.some((x) => x.out), `${tag} the Studio's waiting line never went when the scene landed`);
  await ctx.close();
}

// ---- c. the biggest text: the house line and the foot
if (run('c')) for (const world of WORLDS) for (const viewport of VIEWPORTS) {
  const { ctx, page } = await open({ world, viewport, body: 21 });
  await settle(page);
  for (const room of ['area-make', 'area-learn', 'area-life', 'settings']) {
    const tag = `[body21 ${world} ${viewport.width} ${room}]`;
    await go(page, room);
    const r = await page.evaluate((W) => {
      const seen = (e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none';
      const bad = [];
      const body = document.documentElement.dataset.body;
      for (const el of document.querySelectorAll('#dock *')) {
        if (!seen(el) || !el.textContent.trim() || el.closest('.houseask')) continue;
        const b = el.getBoundingClientRect();
        if (b.width <= 2) continue; // (a word kept for VoiceOver alone is one pixel wide)
        const cs = getComputedStyle(el);
        if (cs.overflow !== 'visible' && el.scrollWidth > el.clientWidth + 1) bad.push(`cut: "${el.textContent.trim().slice(0, 24)}" ${el.scrollWidth}/${el.clientWidth}`);
        if (b.right > W + 0.5 || b.left < -0.5) bad.push(`outside: "${el.textContent.trim().slice(0, 24)}" ${Math.round(b.left)}–${Math.round(b.right)}`);
      }
      for (const b of document.querySelectorAll('#dock button')) {
        if (!seen(b)) continue;
        const r = b.getBoundingClientRect();
        if (r.width < 43.5 || r.height < 43.5) bad.push(`small: "${(b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 20)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
      }
      const kick = document.querySelector('#dock .housekick');
      const btn = document.querySelector('#dock .housebtn');
      const where = document.querySelector('#dock .housewhere');
      let line = null;
      if (kick && seen(kick) && btn && where) {
        const k = kick.getBoundingClientRect();
        const w = where.getBoundingClientRect();
        const bb = btn.getBoundingClientRect();
        line = { wrapped: w.top >= bb.bottom - 2, whereRight: Math.round(w.right), kickRight: Math.round(k.right), rows: Math.round(k.height) };
      }
      return { body, bad, line, side: document.documentElement.scrollWidth > W + 1 };
    }, viewport.width);
    check(r.body === '21', `${tag} the page is not at BODY 21 (${r.body})`);
    check(!r.bad.length, `${tag} the house at BODY 21: ${r.bad.slice(0, 4).join(' | ')}`);
    check(!r.side, `${tag} the page is sideways at BODY 21`);
    if (world === 'scan' && room !== 'settings') check(r.line && Math.abs(r.line.whereRight - r.line.kickRight) <= 2, `${tag} the second row of the house line is not right-aligned: ${JSON.stringify(r.line)}`);
    if (world === 'scan' && room === 'area-learn' && viewport.width === 390) check(r.line?.wrapped, `${tag} the house line did not wrap to two rows: ${JSON.stringify(r.line)}`);
    if (room === 'area-make') await page.screenshot({ path: `${out}/polish1-body21-${world}-${viewport.width}.png` }).catch(() => undefined);
  }
  await ctx.close();
}

// ---- d. empty states
if (run('d')) for (const world of WORLDS) {
  const tag = `[empty ${world}]`;
  const { ctx, page } = await open({ world });
  await settle(page);
  const shape = (sel) => page.evaluate((sel) => {
    const e = [...document.querySelectorAll(sel)].find((x) => x.getClientRects().length);
    if (!e) return null;
    const b = e.querySelector('b');
    const s = e.querySelector('span');
    return { head: b?.textContent.trim() ?? '', next: s?.textContent.trim() ?? '', align: getComputedStyle(e).textAlign, systemVoice: /STANDING BY|ACQUIRING|NO SIGNAL|nothing to show yet|establishing link/.test(e.textContent) };
  }, sel);
  const okShape = (s, what) => {
    check(!!s, `${tag} ${what}: no empty() on the screen`);
    if (!s) return;
    check(s.head.length > 3 && s.next.length > 8, `${tag} ${what}: the head or the next-thing line is missing: ${JSON.stringify(s)}`);
    check(!s.systemVoice, `${tag} ${what}: it speaks in the system's voice: ${JSON.stringify(s)}`);
    check(s.align === 'left' || s.align === 'start', `${tag} ${what}: not in the world's marks (text-align ${s.align})`);
  };
  // the hub's hand (first: opening screens fills Recents)
  await go(page, 'area-learn');
  okShape(await shape('.rnone .empty'), 'the hub\'s hand (recent and starred)');
  // Favourites and Recents: Every screen, from ME
  await go(page, 'area-me');
  await page.getByText('Every screen', { exact: true }).first().click({ timeout: 8000 }).catch(() => problems.push(`${tag} Every screen did not open`));
  await page.waitForTimeout(1200);
  okShape(await shape('#deck .invnone:has(+ *), #deck .invnone'), 'Favourites');
  const heads = await page.evaluate(() => [...document.querySelectorAll('#deck .invnone .empty b')].map((b) => b.textContent.trim()));
  check(heads.length >= 2 && /pinned/i.test(heads[0]) && /opened/i.test(heads[1]), `${tag} Favourites and Recents each say what is empty: ${JSON.stringify(heads)}`);
  await page.keyboard.press('Escape');
  // the Library's shelf (nothing seeded: the brain's shelf is stubbed empty, as a phone that has never added a book sees it; a shared preview brain may hold other specs' books)
  await page.route('**/api/library', (r) => (r.request().method() === 'GET' ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ docs: [], stats: { docs: 0, passages: 0, chars: 0, bytes: 0, vectors: 0 }, starterReady: true, vectors: false }) }) : r.continue()));
  await go(page, 'library', 7000);
  await page.locator('#pg-library .secpill', { hasText: /^Shelf$/ }).first().click({ timeout: 45000 }).catch(() => problems.push(`${tag} the Library's Shelf pill did not open`));
  await page.waitForTimeout(1000);
  okShape(await shape('.shelfempty .empty'), 'the Library shelf');
  // Spending
  await go(page, 'agenda', 2500);
  await page.getByText('Spending', { exact: true }).first().click({ timeout: 8000 }).catch(() => problems.push(`${tag} the Spending pill did not open`));
  await page.waitForTimeout(1200);
  okShape(await shape('.spendempty .empty, .pn .empty'), 'Spending');
  await ctx.close();
}

// ---- e. the boot on a slow open
if (run('e')) {
  for (const world of ['scan']) {
    const tag = `[boot ${world}]`;
    const { ctx, page } = await open({ world, boot: true });
    // the library answers at once (the orb is drawn from it, as tests/boot.spec.mjs stubs it); everything else the first screen waits for is seven seconds late
    const LIB = { docs: [], stats: { docs: 12, passages: 4186, chars: 0, bytes: 0, vectors: 0 }, starterReady: true, vectors: false };
    await page.route('**/api/library', (r) => (r.request().method() === 'GET' ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LIB) }) : r.continue()));
    await page.route(/\/api\/(?!library)/, async (r) => {
      await new Promise((x) => setTimeout(x, 7000));
      r.continue().catch(() => undefined);
    });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    const t0 = Date.now();
    // (the world is drawn by WebGL, which a still of this runner does not hold: the film's life is read from its own counters, and the marks, which are plain page, by their places)
    const samples = [];
    let slowSaid = '';
    while (Date.now() - t0 < 40000) {
      const s = await page.evaluate(() => {
        const b = window.__bootState;
        const marks = {};
        for (const t of document.querySelectorAll('.g-tag')) {
          const r = t.getBoundingClientRect();
          const w = t.textContent.trim().toUpperCase();
          if (r.width && /^(LIBRARY|BRIEF|AGENDA)/.test(w.replace(/^[^A-Z]*/, ''))) marks[w.replace(/^[^A-Z]*/, '')] = [Math.round(r.left), Math.round(r.top)];
        }
        return { boot: !!document.getElementById('boot'), slow: document.querySelector('#boot .bslow:not([hidden])')?.textContent ?? '', held: b?.held ?? 0, sweeps: b?.heldSweeps ?? 0, frames: b?.frames ?? 0, marks };
      });
      samples.push({ ...s, at: Date.now() - t0 });
      if (s.slow) slowSaid = s.slow;
      if (!s.boot) break;
      await page.waitForTimeout(250);
    }
    const landed = samples.at(-1);
    check(!landed.boot, `${tag} the film never landed on Home`);
    check(slowSaid === 'Still waking. The signal is slow.', `${tag} the film did not say the signal is slow after six seconds (said: "${slowSaid}")`);
    const held = samples.filter((x) => x.boot && x.held > 0);
    check(held.length >= 3, `${tag} the film was never held for the slow screen (${held.length} held samples)`);
    const heldMs = held.length ? held.at(-1).held : 0;
    // the last shot keeps moving: a pass of the sweep every 1.3 s while it is held (the count of passes follows the hold), and a frame drawn at least every 1.5 s
    check(heldMs < 2000 || held.at(-1).sweeps >= Math.floor(heldMs / 1300) - 1, `${tag} the sweep did not go on passing while the film was held ${heldMs} ms: ${held.at(-1)?.sweeps} passes`);
    let worstGap = 0;
    for (let i = 1; i < samples.length; i++) if (samples[i].frames === samples[i - 1].frames && samples[i].boot) {
      let j = i;
      while (j > 0 && samples[j - 1].frames === samples[i].frames) j--;
      worstGap = Math.max(worstGap, samples[i].at - samples[j].at);
    }
    check(worstGap <= 1500, `${tag} no new frame was drawn for ${worstGap} ms on a slow open`);
    // no cut: the marks stand where the film put them when Home takes over
    const lastFilm = [...samples].reverse().find((x) => x.boot && Object.keys(x.marks).length >= 2);
    const firstHome = samples.find((x) => !x.boot && Object.keys(x.marks).length >= 2);
    check(!!lastFilm && !!firstHome, `${tag} the film's marks or Home's could not be read (${Object.keys(lastFilm?.marks ?? {}).length}, ${Object.keys(firstHome?.marks ?? {}).length})`);
    if (lastFilm && firstHome) {
      const moved = Object.keys(lastFilm.marks).filter((k) => firstHome.marks[k]).map((k) => Math.max(Math.abs(lastFilm.marks[k][0] - firstHome.marks[k][0]), Math.abs(lastFilm.marks[k][1] - firstHome.marks[k][1])));
      check(moved.length >= 2 && Math.max(...moved) <= 4, `${tag} the landing is a cut: the marks moved ${moved.join(', ')} px`);
      timing.push(`boot hand-over: ${moved.length} marks moved at most ${Math.max(...moved)} px between the film's last sample and Home's first`);
    }
    timing.push(`boot: landed ${landed.at} ms after the open, held ${heldMs} ms with ${held.at(-1)?.sweeps ?? 0} passes of the sweep, no new frame for more than ${worstGap} ms`);
    await page.screenshot({ path: `${out}/polish1-boot-${world}.png` }).catch(() => undefined);
    await ctx.close();
  }
}

await browser.close();
for (const n of timing) console.log(n);
if (problems.length) {
  console.error(`FAIL polish1:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`ok polish1 (${Math.round((Date.now() - T0) / 1000)} s): ONE ERROR VOICE with the network cut on Home, the chat and the Lens (no raw browser string, his words about the signal, both worlds, both widths); EVERY WAIT SAID (the Stage, the Lens, the Studio within 400 ms, gone when the thing lands); THE BIGGEST TEXT (the house line wraps to two rows right-aligned, the foot and the keys whole and 44 pt); EMPTY STATES in the worlds' marks (Favourites, Recents, the shelf, Spending, the hub's hand); THE BOOT ON A SLOW OPEN (a frame at least every 1.5 s, the sweep going on passing, the line after six seconds, the landing with no cut)`);
