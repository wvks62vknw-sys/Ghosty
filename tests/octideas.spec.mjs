// THE OCTOBER IDEAS, SLICE 1 (BRIEF-OCT-IDEAS-1): the HUD alive, at 440 × 956 and 390 × 844 (every check fails on the code before this brief: it
// was run against it once and its last line is in the report):
//   a. THE READOUT RIBBON: on Home in THE SCAN under the stamp, five parts each a span.g-truth, none cut and none past the screen, one
//      aria-live="off" line, wrapping to two at 390; absent on the first frame after the hand-over and there within 3 s; absent in GLASS;
//      in ONE INK the same line set in the serif under the masthead;
//   b. THE TILT: with it permitted the world, the plates and the orb shift by at most 6 px (the world most, the orb least) on synthetic
//      deviceorientation events and come home when the phone is level; a light follows a finger across a plate; off (the default), still;
//      Reduce Motion still; ONE INK never moves; THE LOOK has the PERMIT key;
//   c. THE ORB REACTING: the plan open draws a thread from the orb's box to the lit room's row and the fold takes it away; a turn being
//      thought breathes the orb's glow (a variable that changes over 1.5 s) and stops with the first word; a fake microphone feed draws a
//      ring of 32 bars; Reduce Motion draws none of the three;
//   d. THE LIGHT FOLLOWING THE DAY: --g-day is set and differs between a 10:00 and a 22:00 clock, and so does the Scan's ground and ONE INK's paper;
//   e. SPOKEN ACKNOWLEDGEMENTS: a TRAIN NOW tap with the voice on speaks once with a word from the table (a fake speaker counts), twice
//      tapped once, with the row off or the voice off never, and Settings → Voice has the row.
//   BASE=http://localhost:8811 node tests/octideas.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, openPanel } from './nav.mjs';
import { fakeSpeaker } from './fixtures/fakespeech.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const problems = [];
const check = (ok, what) => ok || problems.push(what);
// a check that cannot run because what it reads is not there (the code before this brief) is a problem said, not a crash
process.on('uncaughtException', (e) => {
  problems.push(`crashed: ${String(e.message).split('\n')[0]}`);
  console.log(`PROBLEMS:\n${problems.join('\n')}`);
  process.exit(1);
});
const KEY = 'preview-owner-key-0123456789';
const WIDE = { width: 390, height: 844 };
const INK = { ground: 'warm', world: 'ink', night: 'warm', switches: {} };
const GLASS = { ground: 'graphite', world: 'glass', night: 'graphite', switches: {} };
const SCAN = { ground: 'graphite', world: 'scan', night: 'graphite', switches: {} };

/** A phone opened on Ghosty in the look asked for. `boot`: the full film (the first frame after the hand-over is looked at). */
async function open({ viewport = PHONE, look = SCAN, boot = false, settings = {}, reduced = false, speaker = false } = {}) {
  const ctx = await browser.newContext({ viewport, ...UK, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/favicon|net::ERR|40[134]|Failed to load resource|^[WI]\d{4} |^INFO:|GPU stall|WebGL/.test(t)) problems.push(`console: ${t.slice(0, 200)}`);
  });
  if (speaker) await ctx.addInitScript(fakeSpeaker);
  await page.addInitScript(({ key, look, boot, settings }) => {
    // when the boot's veil left and when the ribbon was first drawn (ms on the page's own clock): the ribbon is not on the first frame after the hand-over
    window.__t = { boot: -1, ribbon: -1 };
    new MutationObserver((ms) => {
      for (const m of ms) {
        for (const n of m.removedNodes) if (n.nodeType === 1 && n.id === 'boot' && window.__t.boot < 0) window.__t.boot = Math.round(performance.now());
        for (const n of m.addedNodes) if (n.nodeType === 1 && (n.classList?.contains('ribbon') || n.querySelector?.('.ribbon')) && window.__t.ribbon < 0) window.__t.ribbon = Math.round(performance.now());
      }
    }).observe(document, { childList: true, subtree: true });
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.themes1', '1');
    if (!localStorage.getItem('spec.octideas.seeded')) {
      localStorage.setItem('spec.octideas.seeded', '1');
      localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Boss', speak: false, sounds: false, theme: 'reactor', look, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 }, ...settings }));
    }
    window.__ghostyHero = true;
    window.__ghostyPlace = { none: true };
    if (boot) {
      window.__ghostyBoot = true;
      window.__ghostyBootKind = 'full';
    }
  }, { key: KEY, look, boot, settings });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  return { ctx, page };
}
const until = (page, fn, ms, what, arg = null) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => { problems.push(what); return false; });
const homeReady = async (page, look, tag) => {
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 }).catch(() => problems.push(`${tag} the boot never ended`));
  await until(page, (look) => (look === 'ink' ? window.__ghosty?.ink?.on : window.__ghosty?.scan?.on), 40000, `${tag} Home never drew`, look);
};
/** An element's translation (px) from its computed transform. */
const shift = (page, sel) => page.evaluate((sel) => {
  const e = document.querySelector(sel);
  if (!e) return null;
  const m = new DOMMatrix(getComputedStyle(e).transform);
  return [Math.round(m.m41 * 100) / 100, Math.round(m.m42 * 100) / 100];
}, sel);
const tiltTo = (page, beta, gamma) => page.evaluate(([beta, gamma]) => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta, gamma, absolute: false })), [beta, gamma]);
const bg = (page, sel) => page.evaluate((sel) => getComputedStyle(document.querySelector(sel)).backgroundColor, sel);
const setClock = (page, h) => page.evaluate((h) => {
  window.__ghosty.day.clock = () => new Date(2026, 10, 11, h, 0, 0).getTime();
  window.__ghosty.day.set();
  return window.__ghosty.day.value;
}, h);
const shot = (page, name) => page.screenshot({ path: `${out}/${name}.png` });

for (const [W, vp] of [[440, PHONE], [390, WIDE]]) {
  const tag = `[${W}]`;

  // ---- a. + b + c + d, THE SCAN: one phone, the full film first
  {
    const { ctx, page } = await open({ viewport: vp, boot: true });
    await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 }).catch(() => problems.push(`${tag}[a] the boot never ended`));
    // the first frame after the hand-over: no ribbon yet, and it is there within 3 s
    await until(page, () => window.__t.ribbon > 0 && document.querySelectorAll('.scanribbon .g-truth').length === 5, 8000, `${tag}[a] the ribbon is not drawn after the hand-over`);
    const tt = await page.evaluate(() => window.__t);
    check(tt.boot > 0 && tt.ribbon - tt.boot >= 400 && tt.ribbon - tt.boot <= 3000, `${tag}[a] the ribbon came ${tt.ribbon - tt.boot} ms after the hand-over (boot left at ${tt.boot}, ribbon at ${tt.ribbon}): want between 400 ms (not on the first frame) and 3 s`);
    await until(page, () => window.__ghosty?.scan?.on && window.__ghosty.scan.alt, 20000, `${tag}[a] Home never drew`);
    await page.waitForTimeout(600);
    const r = await page.evaluate((W) => {
      const el = document.querySelector('.scanribbon');
      if (!el) return null;
      const parts = [...el.querySelectorAll(':scope > span.g-truth')];
      const stamp = document.querySelector('.scantop .hstamp')?.getBoundingClientRect();
      const rr = el.getBoundingClientRect();
      const where = document.querySelector('.scanwhere')?.getBoundingClientRect();
      return {
        n: parts.length, live: el.getAttribute('aria-live'), texts: parts.map((p) => p.textContent.replace(/\s+/g, ' ').trim()),
        cut: parts.filter((p) => p.scrollWidth > p.clientWidth + 1).map((p) => p.textContent.slice(0, 20)),
        out: parts.filter((p) => { const b = p.getBoundingClientRect(); return b.left < -0.5 || b.right > W + 0.5; }).length,
        mono: getComputedStyle(parts[0]).fontFamily, lines: new Set(parts.map((p) => Math.round(p.getBoundingClientRect().top))).size,
        underStamp: !!stamp && rr.top >= stamp.bottom - 1, aboveWhere: !where || rr.bottom <= where.top + 1,
        h: Math.round(rr.height), sep: el.querySelectorAll('.g-sep').length,
        truthSameAsStamp: parts[0] && document.querySelector('.hstamp') ? getComputedStyle(parts[0]).fontFamily === getComputedStyle(document.querySelector('.hstamp')).fontFamily : false,
      };
    }, W);
    check(r && r.n === 5 && r.live === 'off', `${tag}[a] the ribbon is not five span.g-truth parts in an aria-live="off" line: ${JSON.stringify(r)}`);
    check(r && r.cut.length === 0 && r.out === 0, `${tag}[a] a ribbon part is cut or past the screen: ${JSON.stringify(r)}`);
    check(r && r.underStamp && r.aboveWhere, `${tag}[a] the ribbon is not under the stamp line: ${JSON.stringify(r)}`);
    check(r && r.truthSameAsStamp && r.sep === 4, `${tag}[a] the ribbon is not in the stamp's own marks (mono, four dots): ${JSON.stringify(r)}`);
    check(r && r.lines >= 1 && r.lines <= 2, `${tag}[a] the ribbon is ${r?.lines} lines (want one, two at 390): ${JSON.stringify(r)}`);
    check(r && /^\d\d:\d\d( ·)?$/.test(r.texts[0]) && /^Threat /.test(r.texts[3]) && /^(Idle|Thinking|Training|Sitting|Making|Downloading)/.test(r.texts[4]), `${tag}[a] the ribbon's parts read oddly: ${JSON.stringify(r?.texts)}`);
    // the first screen's budget is speed2's; here only that the ribbon asked for nothing of its own
    const asks = await page.evaluate(() => performance.getEntriesByType('resource').filter((e) => /weather|forecast|ribbon/i.test(e.name) && !/open-meteo/.test(e.name)).length);
    check(asks === 0, `${tag}[a] the ribbon made a request of its own`);
    await shot(page, `octideas-scan-${W}`);

    // ---- d. the light following the day
    const d10 = await setClock(page, 10);
    const g10 = await bg(page, '.scanframe');
    const v10 = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--g-day').trim());
    const d22 = await setClock(page, 22);
    const g22 = await bg(page, '.scanframe');
    const v22 = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--g-day').trim());
    check(v10 !== '' && v22 !== '' && Number(v10) === d10 && Number(v22) === d22 && d10 > d22 && d10 >= 0 && d10 <= 1 && d22 >= 0, `${tag}[d] --g-day is not set from the hour (10:00 ${v10}, 22:00 ${v22})`);
    check(g10 !== g22, `${tag}[d] the Scan's ground is the same at 10:00 and 22:00 (${g10})`);
    const dn = await setClock(page, 12);
    check(dn === 1, `${tag}[d] --g-day at noon is ${dn} (want 1)`);
    await setClock(page, 3);
    check((await page.evaluate(() => window.__ghosty.day.value)) === 0, `${tag}[d] --g-day at 3:00 is not 0`);
    await page.evaluate(() => { window.__ghosty.day.clock = null; window.__ghosty.day.set(); });

    // ---- c. the plan open draws the thread from the orb to the lit room's row
    await page.click('.scankickkey');
    await page.waitForSelector('#plan', { timeout: 5000 }).catch(() => problems.push(`${tag}[c] the plan did not open`));
    await until(page, () => !!document.querySelector('svg.orbthread .orbthreadline'), 3000, `${tag}[c] no thread is drawn when the plan opens`);
    await page.waitForTimeout(400);
    const th = await page.evaluate(() => {
      const t = window.__ghosty.orbfx.thread;
      const o = document.querySelector('.scanorb').getBoundingClientRect();
      const row = document.querySelector('#plan .planroom.lit .planroomhead')?.getBoundingClientRect();
      const svg = document.querySelector('svg.orbthread');
      return { t, o: [o.left, o.top, o.right, o.bottom], row: row ? [row.left, row.top, row.right, row.bottom] : null, hidden: svg?.getAttribute('aria-hidden'), len: svg?.querySelector('path')?.getTotalLength?.() };
    });
    const inside = (p, b, e) => !!p && !!b && p[0] >= b[0] - e && p[0] <= b[2] + e && p[1] >= b[1] - e && p[1] <= b[3] + e;
    check(th.t && inside(th.t.from, th.o, 3) && inside(th.t.to, th.row, 3), `${tag}[c] the thread does not run from the orb's box to the lit row's box: ${JSON.stringify(th)}`);
    check(th.hidden === 'true' && th.len > 20, `${tag}[c] the thread is not decorative or has no length: ${JSON.stringify(th)}`);
    await shot(page, `octideas-thread-${W}`);
    await page.click('#plan .planhead');
    await until(page, () => !document.querySelector('svg.orbthread'), 2000, `${tag}[c] the thread stays when the plan folds`);

    // ---- c. thinking breathes the orb: the glow variable changes over 1.5 s, and stops with the first word
    await page.evaluate(() => window.__ghosty.ui.set({ busy: true, voice: 'idle' }));
    const seen = [];
    for (let i = 0; i < 16; i++) {
      seen.push(await page.evaluate(() => Number(document.querySelector('.orbfx')?.style.getPropertyValue('--g-orb-breath') || 0)));
      await page.waitForTimeout(100);
    }
    const lo = Math.min(...seen);
    const hi = Math.max(...seen);
    check(hi - lo > 0.3 && (await page.evaluate(() => window.__ghosty.orbfx.thinking)), `${tag}[c] the orb's glow does not breathe while I think (${lo}..${hi})`);
    await page.evaluate(() => window.__ghosty.ui.set({ busy: false }));
    await until(page, () => window.__ghosty.orbfx.breath === 0 && !window.__ghosty.orbfx.thinking, 4000, `${tag}[c] the glow still breathes after the turn`);

    // ---- c. the mic's ring of 32 bars from a fake feed
    await page.evaluate(() => { window.__ghosty.orbfx.feed = () => Uint8Array.from({ length: 128 }, (_, i) => 40 + ((i * 7) % 200)); });
    await until(page, () => document.querySelector('.orbring')?.dataset.on === 'true', 3000, `${tag}[c] the ring is not drawn while the mic feed is open`);
    await until(page, () => Number(getComputedStyle(document.querySelector('.orbring')).opacity) > 0.5, 4000, `${tag}[c] the ring does not show`);
    const ring = await page.evaluate(() => {
      const bars = [...document.querySelectorAll('.orbring .bar')];
      const v = bars.map((b) => Number(b.style.getPropertyValue('--v')));
      return { n: bars.length, min: Math.min(...v), max: Math.max(...v), level: window.__ghosty.orbfx.level.length, vis: getComputedStyle(document.querySelector('.orbring')).opacity, hidden: document.querySelector('.orbfx').getAttribute('aria-hidden') };
    });
    check(ring.n === 32 && ring.level === 32 && ring.max - ring.min > 0.2 && Number(ring.vis) > 0.5 && ring.hidden === 'true', `${tag}[c] the ring is not 32 bars of the voice's amplitude: ${JSON.stringify(ring)}`);
    await shot(page, `octideas-ring-${W}`);
    await page.evaluate(() => { window.__ghosty.orbfx.feed = null; });
    await until(page, () => document.querySelector('.orbring')?.dataset.on === 'false', 3000, `${tag}[c] the ring stays after the mic closes`);

    // ---- b. the tilt: off by default, nothing moves; permitted, the layers shift at most 6 px and come home
    await tiltTo(page, 50, 25);
    await page.waitForTimeout(500);
    check(JSON.stringify(await shift(page, '.scanstage')) === '[0,0]', `${tag}[b] the world moves with the tilt off: ${JSON.stringify(await shift(page, '.scanstage'))}`);
    await page.evaluate(() => window.__ghosty.settings.set({ hudTilt: true }));
    await until(page, () => window.__ghosty.tilt.on, 8000, `${tag}[b] the tilt never listens once permitted`);
    await tiltTo(page, 45, 0);
    await page.waitForTimeout(300);
    await tiltTo(page, 70, 28);
    await until(page, () => { const m = new DOMMatrix(getComputedStyle(document.querySelector('.scanstage')).transform); return Math.abs(m.m41) > 3; }, 8000, `${tag}[b] the world does not move once permitted`);
    await page.waitForTimeout(900);
    const w1 = await shift(page, '.scanstage');
    const p1 = await shift(page, '.scancol');
    const o1 = await shift(page, '.scanorb');
    const m1 = await shift(page, '.scanmarks');
    const big = (a) => Math.max(Math.abs(a[0]), Math.abs(a[1]));
    check(big(w1) > 1 && big(w1) <= 6.001, `${tag}[b] the world's shift is ${JSON.stringify(w1)} (want more than 1 px and at most 6)`);
    check(big(p1) > 0.3 && big(p1) < big(w1) && big(p1) <= 3.001, `${tag}[b] the plates' shift ${JSON.stringify(p1)} is not less than the world's ${JSON.stringify(w1)}`);
    check(big(o1) > 0.1 && big(o1) < big(p1) && big(o1) <= 1.501, `${tag}[b] the orb's shift ${JSON.stringify(o1)} is not the least (plates ${JSON.stringify(p1)})`);
    check(Math.abs(m1[0] - w1[0]) < 0.6 && Math.abs(m1[1] - w1[1]) < 0.6, `${tag}[b] the marks do not move with the world: ${JSON.stringify(m1)} vs ${JSON.stringify(w1)}`);
    await tiltTo(page, 70, 90);
    await tiltTo(page, 20, -90);
    await page.waitForTimeout(700);
    const w2 = await shift(page, '.scanstage');
    check(big(w2) <= 6.001, `${tag}[b] the world moved ${JSON.stringify(w2)}: more than 6 px`);
    // held level for a while (the resting angle settles to where he holds it), the layers come home
    await page.evaluate(() => { for (let i = 0; i < 2500; i++) window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta: 20, gamma: 0 })); });
    await until(page, () => { const e = document.querySelector('.scanstage'); const m = new DOMMatrix(getComputedStyle(e).transform); return Math.abs(m.m41) < 1.2 && Math.abs(m.m42) < 1.2; }, 6000, `${tag}[b] the world did not come home when the phone was level`);
    const w3 = await shift(page, '.scanstage');
    check(big(w3) < 1.2, `${tag}[b] the world did not come home when the phone was level: ${JSON.stringify(w3)}`);
    // the light follows a finger across a plate
    await page.click('.scandaykey');
    await until(page, () => [...document.querySelectorAll('.scancol > *')].some((n) => n.getBoundingClientRect().height > 30), 6000, `${tag}[b] no plate to run a finger over`);
    await page.waitForTimeout(1500);
    // a point on a plate that is really the thing under the finger (the top block is over the column's first rows while it settles)
    const plate = await page.evaluate(() => {
      for (const n of document.querySelectorAll('.scancol > *')) {
        const r = n.getBoundingClientRect();
        if (r.height < 30) continue;
        for (let fy = 0.5; fy <= 0.95; fy += 0.15) for (let fx = 0.3; fx <= 0.7; fx += 0.2) {
          const hit = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy);
          if (hit && n.contains(hit)) return [r.left, r.top, r.width, r.height, fx, fy];
        }
      }
      return null;
    });
    check(!!plate, `${tag}[b] no plate to run a finger over`);
    await page.mouse.move(plate[0] + plate[2] * plate[4] - 8, plate[1] + plate[3] * plate[5]);
    await page.mouse.move(plate[0] + plate[2] * plate[4], plate[1] + plate[3] * plate[5], { steps: 3 });
    const sw = await page.evaluate(() => { const s = document.querySelector('.scansweep'); const r = s.getBoundingClientRect(); return { on: s.dataset.on, box: [r.left, r.top, r.width, r.height], sx: s.style.getPropertyValue('--sx'), hidden: s.getAttribute('aria-hidden'), bg: getComputedStyle(s).backgroundImage.slice(0, 40) }; });
    check(sw.on === 'true' && Math.abs(sw.box[0] - plate[0]) < 2 && Math.abs(sw.box[3] - plate[3]) < 2 && parseFloat(sw.sx) > plate[2] * 0.2 && sw.hidden === 'true' && /radial-gradient/.test(sw.bg), `${tag}[b] no light follows the finger across the plate: ${JSON.stringify(sw)} plate ${plate}`);
    await page.evaluate(() => window.__ghosty.settings.set({ hudTilt: false }));
    await until(page, () => new DOMMatrix(getComputedStyle(document.querySelector('.scanstage')).transform).m41 === 0, 6000, `${tag}[b] the world is not still with the tilt switched off`);
    await page.mouse.move(plate[0] + plate[2] * plate[4] + 5, plate[1] + plate[3] * plate[5]);
    check((await page.evaluate(() => document.querySelector('.scansweep').dataset.on)) === 'false', `${tag}[b] a light follows the finger with the tilt off`);

    // THE LOOK has the PERMIT key and the voice row is in Settings
    await page.evaluate(() => (location.hash = 'look'));
    await page.waitForSelector('#pg-look', { timeout: 10000 }).catch(() => undefined);
    const pill = page.locator('#pg-look .secpills .secpill', { hasText: 'Themes' }).first();
    if (await pill.count()) await pill.click().catch(() => undefined);
    await until(page, () => !!document.querySelector('#pg-look .glook-tilt button'), 10000, `${tag}[b] THE LOOK has no PERMIT key`);
    const key = await page.evaluate(() => { const b = document.querySelector('#pg-look .glook-tilt button'); const r = b?.getBoundingClientRect(); return { word: b?.textContent.trim(), name: document.querySelector('#pg-look .glook-tilt b')?.textContent, h: r?.height, w: r?.width }; });
    check(key.word === 'PERMIT' && key.name === 'The HUD tilts with the phone' && key.h >= 43.5 && key.w >= 43.5, `${tag}[b] the PERMIT key is not as asked: ${JSON.stringify(key)}`);
    await page.locator('#pg-look .glook-tilt button').scrollIntoViewIfNeeded().catch(() => undefined);
    await shot(page, `octideas-permit-${W}`);
    await ctx.close();
  }

  // ---- b. Reduce Motion: nothing moves, no sweep, no thread, no pulse
  {
    const { ctx, page } = await open({ viewport: vp, settings: { hudTilt: true }, reduced: true });
    await homeReady(page, 'scan', `${tag}[b-rm]`);
    await page.waitForTimeout(800);
    await tiltTo(page, 45, 0);
    await tiltTo(page, 70, 28);
    await page.waitForTimeout(700);
    check(JSON.stringify(await shift(page, '.scanstage')) === '[0,0]' && JSON.stringify(await shift(page, '.scancol')) === '[0,0]' && JSON.stringify(await shift(page, '.scanorb')) === '[0,0]', `${tag}[b] a layer moves under Reduce Motion`);
    await page.click('.scankickkey');
    await page.waitForSelector('#plan', { timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(500);
    check((await page.locator('svg.orbthread').count()) === 0, `${tag}[c] a thread is drawn under Reduce Motion`);
    await page.click('#plan .planhead');
    await page.evaluate(() => window.__ghosty.ui.set({ busy: true, voice: 'idle' }));
    await page.waitForTimeout(600);
    check((await page.evaluate(() => window.__ghosty.orbfx.breath)) === 0 && !(await page.evaluate(() => window.__ghosty.orbfx.thinking)), `${tag}[c] the orb breathes under Reduce Motion`);
    await page.evaluate(() => { window.__ghosty.ui.set({ busy: false }); window.__ghosty.orbfx.feed = () => new Uint8Array(64).fill(200); });
    await page.waitForTimeout(500);
    check((await page.evaluate(() => document.querySelector('.orbring')?.dataset.on)) === 'false', `${tag}[c] the ring is drawn under Reduce Motion`);
    await ctx.close();
  }

  // ---- a + b + d, ONE INK: the same line in the serif; nothing moves; the paper warms in the evening
  {
    const { ctx, page } = await open({ viewport: vp, look: INK, settings: { hudTilt: true } });
    await homeReady(page, 'ink', `${tag}[a-ink]`);
    await until(page, () => document.querySelectorAll('.inkribbon .g-truth').length === 5, 20000, `${tag}[a] ONE INK has no ribbon`);
    const k = await page.evaluate((W) => {
      const el = document.querySelector('.inkribbon');
      const parts = [...el.querySelectorAll(':scope > span.g-truth')];
      const mast = document.querySelector('.inkmast')?.getBoundingClientRect();
      const rr = el.getBoundingClientRect();
      const serif = getComputedStyle(document.documentElement).getPropertyValue('--g-font-serif').split(',')[0].trim().replace(/["']/g, '');
      const family = getComputedStyle(parts[0]).fontFamily;
      return { n: parts.length, live: el.getAttribute('aria-live'), serif, family, upper: getComputedStyle(parts[0]).textTransform, underMast: !!mast && rr.top >= mast.bottom - 1, cut: parts.filter((p) => p.scrollWidth > p.clientWidth + 1).length, out: parts.filter((p) => { const b = p.getBoundingClientRect(); return b.left < -0.5 || b.right > W + 0.5; }).length, size: parseFloat(getComputedStyle(parts[0]).fontSize), glow: getComputedStyle(parts[0]).textShadow };
    }, W);
    check(k.n === 5 && k.live === 'off' && k.family.includes(k.serif) && k.upper === 'none' && k.underMast && k.cut === 0 && k.out === 0 && k.size >= 12, `${tag}[a] ONE INK's ribbon is not the serif line under the masthead: ${JSON.stringify(k)}`);
    check(k.glow === 'none', `${tag}[a] ONE INK's ribbon glows (${k.glow})`);
    await shot(page, `octideas-ink-${W}`);
    await page.waitForTimeout(500);
    await tiltTo(page, 45, 0);
    await tiltTo(page, 70, 28);
    await page.waitForTimeout(600);
    const still = await page.evaluate(() => [...document.querySelectorAll('.inkframe, .inkframe *')].filter((e) => new DOMMatrix(getComputedStyle(e).transform).m41 !== 0 || new DOMMatrix(getComputedStyle(e).transform).m42 !== 0).length);
    check(still === 0 && (await page.locator('.scansweep').count()) >= 0, `${tag}[b] something in ONE INK moves with the tilt (${still})`);
    const noGlow = await page.evaluate(() => getComputedStyle(document.querySelector('.inkorb') ?? document.body).filter);
    check(noGlow === 'none' || noGlow === '', `${tag}[b] ONE INK's orb has a filter (${noGlow})`);
    await setClock(page, 10);
    const i10 = await page.evaluate(() => getComputedStyle(document.querySelector('.inkframe')).backgroundImage);
    await setClock(page, 22);
    const i22 = await page.evaluate(() => getComputedStyle(document.querySelector('.inkframe')).backgroundImage);
    check(i10 !== i22, `${tag}[d] ONE INK's paper is the same at 10:00 and 22:00 (${i10})`);
    await ctx.close();
  }

  // ---- a. GLASS: no ribbon
  {
    const { ctx, page } = await open({ viewport: vp, look: GLASS });
    await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 }).catch(() => problems.push(`${tag}[a-glass] the boot never ended`));
    await page.waitForTimeout(4500);
    const g = await page.evaluate(() => ({ ribbons: document.querySelectorAll('.ribbon').length, scan: document.body.classList.contains('scanhome'), ink: document.body.classList.contains('inkhome') }));
    check(g.ribbons === 0 && !g.scan && !g.ink, `${tag}[a] GLASS draws a ribbon or another look's Home: ${JSON.stringify(g)}`);
    await ctx.close();
  }
}

// ---- e. SPOKEN ACKNOWLEDGEMENTS (440: the same code at both widths)
{
  const TRAIN = { keys: { kaggle: true, hf: true }, phase: 'idle', note: 'Next training Sat 24 Oct, 01:00.', week: 2, next: Date.UTC(2026, 9, 24, 1), gathered: {}, report: null, previous: null, models: [], active: '', privateData: true, ratings: { up: 0, down: 0 }, weights: '', gpu: null, pool: { phase: 'off', note: 'Not set up.', offer: false, week: 0, waiting: 0 } };
  const { ctx, page } = await open({ settings: { speak: true, voiceEngine: 'phone', sayStart: true }, speaker: true });
  await page.route('**/api/training', (r) => r.fulfill({ json: TRAIN }));
  await page.route('**/api/training/now', (r) => r.fulfill({ json: { ...TRAIN, phase: 'running' } }));
  await homeReady(page, 'scan', '[e]');
  await page.evaluate(() => (location.hash = 'settings'));
  await page.waitForTimeout(300);
  await page.evaluate(() => (location.hash = 'system'));
  await openPanel(page, 'system', 'OFFLINE BRAIN TRAINING');
  await page.waitForSelector('#pg-system .selftrain button', { timeout: 15000 }).catch(() => problems.push('[e] the training panel never drew'));
  const train = () => page.locator('#pg-system .selftrain button', { hasText: /^TRAIN NOW$/ }).first();
  check((await train().count()) === 1 && (await train().isEnabled()), '[e] TRAIN NOW is not there to tap');
  // twice tapped, once
  await train().click({ force: true });
  await page.waitForTimeout(150);
  await train().click({ force: true }).catch(() => undefined);
  await page.waitForTimeout(500);
  // (the words in the table; Ghosty's own unprompted lines, when the voice is on, are not counted)
  const WORDS = ['On it.', 'Sitting it now.'];
  const said = () => page.evaluate((WORDS) => window.__spoken.filter((t) => WORDS.includes(t)), WORDS);
  let s = await said();
  check(s.length === 1 && ['On it.', 'Sitting it now.'].includes(s[0]), `[e] two taps on TRAIN NOW spoke ${JSON.stringify(s)} (want one word from the table)`);
  check(s[0] === 'On it.', `[e] TRAIN NOW said "${s[0]}" (want "On it.")`);
  // the row off: never
  await page.evaluate(() => { window.__spoken.length = 0; window.__ghosty.settings.set({ sayStart: false }); });
  await page.waitForTimeout(5000);
  await train().click({ force: true });
  await page.waitForTimeout(500);
  check((await said()).length === 0, `[e] a word is said with "A word when I start something" off: ${JSON.stringify(await said())}`);
  // the voice off: never
  await page.evaluate(() => window.__ghosty.settings.set({ sayStart: true, speak: false }));
  await page.waitForTimeout(100);
  await train().click({ force: true });
  await page.waitForTimeout(500);
  check((await said()).length === 0, `[e] a word is said with Voice off: ${JSON.stringify(await said())}`);
  // never over a reply being said
  await page.evaluate(() => { window.__ghosty.settings.set({ speak: true }); window.__ghosty.ui.set({ voice: 'speaking' }); });
  await page.waitForTimeout(100);
  await page.evaluate(() => { window.__spoken.length = 0; });
  await page.waitForTimeout(4500);
  await train().click({ force: true });
  await page.waitForTimeout(400);
  check((await said()).length === 0, `[e] a word is said over a reply being spoken: ${JSON.stringify(await said())}`);
  await page.evaluate(() => window.__ghosty.ui.set({ voice: 'idle' }));
  // the table by the action, for the keys that are not on screen here (a key made on the page and tapped goes through the same listener)
  await page.waitForTimeout(4200);
  const POS = [['PUBLISH', '', 'On it.'], ['SIT', '', 'Sitting it now.'], ['WATCH', '', 'On it.'], ['STUDY ALL: OFF', '', 'On it.'], ['START', 'pg-learn', 'On it.']];
  // (a download's GET and a run's RUN NOW say nothing on the tap: a download asks for Wi-Fi or a confirm first, and RUN NOW speaks after its own confirm)
  const NEG = [['START', ''], ['STOP', ''], ['STUDY ALL: ON', ''], ['SAVE', ''], ['RUN NOW', ''], ['Get · about 70 MB', '']];
  for (const [label, within, want] of POS) {
    const got = await page.evaluate(async ([label, within]) => {
      const host = within ? (document.getElementById(within) ?? document.body.appendChild(Object.assign(document.createElement('div'), { id: within }))) : document.body;
      const b = host.appendChild(document.createElement('button'));
      b.textContent = label;
      const n = window.__ghosty.acks.said.length;
      b.click();
      b.remove();
      return window.__ghosty.acks.said.slice(n);
    }, [label, within]);
    check(got.length === 1 && got[0] === want, `[e] "${label}"${within ? ` in ${within}` : ''} said ${JSON.stringify(got)} (want "${want}")`);
    await until(page, () => window.__ghosty.ui.get().voice !== 'speaking', 4000, '[e] the voice never finished a word');
  }
  for (const [label, within] of NEG) {
    const got = await page.evaluate(([label]) => {
      const b = document.body.appendChild(document.createElement('button'));
      b.textContent = label;
      const n = window.__ghosty.acks.said.length;
      b.click();
      b.remove();
      return window.__ghosty.acks.said.slice(n);
    }, [label, within]);
    check(got.length === 0, `[e] "${label}" said ${JSON.stringify(got)} (it starts nothing that takes a moment)`);
  }
  // Settings → Voice has the row
  await page.evaluate(() => (location.hash = 'settings'));
  await page.waitForTimeout(500);
  await openPanel(page, 'settings', 'VOICE');
  const row = await page.evaluate(() => { const r = document.querySelector('#pg-settings .setsw[data-id="saystart"]'); return r ? { name: r.querySelector('b')?.textContent, on: r.getAttribute('aria-checked'), h: r.getBoundingClientRect().height } : null; });
  check(row !== null && (row.name === 'A word when I start something' && row.on === 'true' && row.h >= 43.5), `[e] the Settings row is not as asked: ${JSON.stringify(row)}`);
  await ctx.close();
}

await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : "THE OCTOBER IDEAS, SLICE 1 run clean at 440 × 956 and 390 × 844: the readout ribbon under the stamp (five whole parts, one aria-live=off line, two lines at 390, not on the first frame and there within 3 s, none in Glass, the serif in ONE INK); the tilt (off by default, at most 6 px, the world most and the orb least, home when level, a light on the plate under the finger, still under Reduce Motion and in ONE INK, the PERMIT key in THE LOOK); the orb's thread to the lit room, its breathing while I think and its ring of 32 bars from a mic feed; --g-day from the hour moving the Scan's ground and ONE INK's paper; one spoken word for TRAIN NOW, never twice, never with the row or the voice off or over a reply.");
process.exit(problems.length ? 1 : 0);
