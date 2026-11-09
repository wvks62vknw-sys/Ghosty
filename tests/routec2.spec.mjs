// Route C, part 2 (BRIEF-DESIGN-BUILD-2), split out of routec.spec.mjs, which outgrew the 480 s a spec may run (same checks, same helpers),
// in The Scan, the default world, on the iPhone 18 Pro Max (440 × 956) and a 390-wide phone: every other screen opens through Every
// screen (the inventory in The Scan: tests/nav.mjs openScreen), nothing on it sticks out sideways, and every empty list on it says what
// it is with one sentence on what to do next — with the lists made empty on purpose for Workshop, Memory, Agenda, Radio's favourites and
// GYM's levels; System and Links open their inner panels the same way; offline, a quiet line says so.
//   BASE=http://localhost:8788 node tests/routec2.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { GLASS, PHONE, UK, openPanel, openScreen, openSection } from './nav.mjs';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const problems = [];
const HOME = { name: 'Birmingham', lat: 52.4862, lon: -1.8904 };
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function brainGet(path) {
  const r = await fetch(`${base}/api${path}`, { headers: { 'x-ghosty-key': KEY } });
  return r.ok ? r.json() : null;
}

// (Route C's Home, its glass pill, its cards and its themes are Glass's, held to their own checks unchanged: that world is set for them;
// part 2, every screen through Every screen, runs in The Scan, the default world, where Every screen is the inventory: BRIEF-SHELL-2)
async function open(viewport, opts = {}, world = 'glass') {
  const ctx = await browser.newContext({ viewport, ...UK, deviceScaleFactor: 2, hasTouch: true, isMobile: true, ...opts });
  await ctx.addInitScript(([k, home, look]) => {
    localStorage.setItem('ghosty.ownerKey', k);
    if (!localStorage.getItem('ghosty.settings')) localStorage.setItem('ghosty.settings', JSON.stringify({ home, units: 'metric', ...(look ? { look } : {}) }));
  }, [KEY, HOME, world === 'glass' ? GLASS.look : null]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${viewport.width}] pageerror: ${e.message}`));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 25000 });
  // A fresh preview brain is still seeding its starter library during the first boot: wait for it to settle, then
  // open Home again so the gauges read the settled count (the app itself looks again after 15 s in that case).
  let libAtBoot = null;
  for (let i = 0; i < 30; i++) {
    const l = await brainGet('/library').catch(() => null);
    if (l?.starterReady && libAtBoot && l.stats.passages === libAtBoot.stats.passages) break;
    libAtBoot = l;
    await page.waitForTimeout(1000);
  }
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 25000 });
  libAtBoot = await brainGet('/library').catch(() => libAtBoot);
  return { ctx, page, libAtBoot };
}

/** Elements (visible, not inside something that clips them) that run past the screen's sides. */
const sideways = (page, sel) => page.$$eval(sel, (els) => els.filter((e) => {
  if (!e.getClientRects().length || getComputedStyle(e).visibility === 'hidden') return false;
  const r = e.getBoundingClientRect();
  if (!r.width || r.bottom < 0 || r.top > innerHeight) return false;
  for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
    const cs = getComputedStyle(p);
    if (/(hidden|auto|scroll|clip)/.test(cs.overflowX)) {
      const pr = p.getBoundingClientRect();
      if (pr.left >= -1 && pr.right <= innerWidth + 1) return false;
    }
  }
  return r.left < -1 || r.right > innerWidth + 1;
}).filter((e) => !e.classList.contains('rcglow')).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} "${(e.dataset.label || e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 24)}"`));

/** A finger 20 pt left, right, above and below the button's centre still lands on it: a 44 pt target (a button
 *  drawn smaller to the eye may take the finger with an invisible margin). */
const target44 = (page, sel) => page.$$eval(sel, (els) => els.filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map((e) => {
  const r = e.getBoundingClientRect();
  if (r.top < 0 || r.bottom > innerHeight) return '';
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const hits = [[x, y - 20], [x, y + 20], [x - 20, y], [x + 20, y]].map(([px, py]) => { const t = document.elementFromPoint(px, py); return !!t && (t === e || e.contains(t)); });
  return hits.every(Boolean) ? '' : `"${(e.dataset.label || e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 24)}" ${Math.round(r.width)}×${Math.round(r.height)} (${hits.map(Number).join('')})`;
}).filter(Boolean));


// ---- part 2: every other screen through the deck; nothing sideways; every empty list says what to do next
const EMPTY = {
  '**/api/changes': { ready: true, changes: [], versions: [] },
  '**/api/projects': { projects: [] },
  '**/api/upgrades': { ideas: [], next: null, last: null },
  '**/api/widgets': { widgets: [] },
  '**/api/sites': { sites: [], origin: '' },
  '**/api/profile/timeline': { items: [], patterns: [], forgotten: [] },
  '**/api/lessons': { lessons: [] },
  '**/api/memory': { facts: [] },
  '**/api/agenda?**': { tz: 'UTC', events: [], errors: [], jobs: [], feeds: [] },
};
// the screens, and the empty sentence each must show when its lists are empty (null: whatever is there must be worded)
const SCREENS = [
  ['library', null], ['memory', /Nothing remembered yet[\s\S]*Tell me about yourself/], ['workshop', /No open changes[\s\S]*Ask Ghosty to build something/],
  ['agenda', /Nothing in the next two weeks[\s\S]*Add an event above/], ['brief', null], ['markets', null], ['radio', /No favourites yet[\s\S]*Tap ☆/],
  ['threats', null], ['lens', null], ['learn', null], ['studio', null], ['space', null], ['reverse', null], ['school', null],
  ['gym', /No levels yet · Train all starts with \S/],
];
for (const vp of [PHONE, { width: 390, height: 844 }]) {
  const W = vp.width;
  const { ctx, page } = await open(vp, {}, 'scan');
  for (const [url, body] of Object.entries(EMPTY)) await page.route(url, (r) => (r.request().method() === 'GET' ? r.fulfill({ contentType: 'application/json', body: JSON.stringify(body) }) : r.continue()));
  for (const [tab, want] of SCREENS) {
    await openScreen(page, tab);
    await page.waitForTimeout(tab === 'studio' || tab === 'lens' ? 2500 : 1600);
    const now = await page.evaluate(() => document.body.dataset.tab);
    if (now !== tab) { problems.push(`[${W}] the deck's ${tab} tile opened "${now}"`); continue; }
    for (const s of await sideways(page, `#pg-${tab} :is(button, .pn, .rw, .chip, input, select, .empty, .rccard), #top :is(button, h1)`)) problems.push(`[${W} ${tab}] sticks out sideways: ${s}`);
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) problems.push(`[${W} ${tab}] the page scrolls sideways`);
    // every empty state on the screen is worded: what it is, and a sentence (the route C words are its data-labels)
    // (a screen in sections, ui/sections.ts, draws one part at a time: every part is looked at)
    const parts = ['library', 'memory', 'workshop', 'threats', 'school'].includes(tab) ? await page.$$eval(`#pg-${tab} .secpills:not([hidden]) .secpill`, (b) => b.map((x) => x.textContent ?? '')).catch(() => []) : [];
    const empties = [];
    for (const part of parts.length ? parts : ['']) {
      if (part) {
        await openSection(page, tab, part);
        await page.waitForTimeout(250);
      }
      empties.push(...(await page.$$eval(`#pg-${tab} .empty`, (els) => els.filter((e) => e.getClientRects().length).map((e) => { const w = (x) => (x?.dataset.label ?? x?.textContent ?? '').trim(); return `${w(e.querySelector('b'))} | ${w(e.querySelector('span'))}`; }))));
    }
    for (const e of empties) if (!/\S \| .{12,}[.!”]$/.test(e)) problems.push(`[${W} ${tab}] an empty state is not worded: "${e}"`);
    if (want) {
      const words = await page.evaluate((t) => {
        const root = document.getElementById(`pg-${t}`);
        const own = [...root.querySelectorAll('.empty')].map((e) => [e.querySelector('b'), e.querySelector('span')].map((x) => x?.dataset.label ?? x?.textContent ?? '').join(' ')).join(' / ');
        return `${own} / ${root.querySelector('.gymlvnone')?.textContent ?? ''}`;
      }, tab);
      if (!want.test(words)) problems.push(`[${W} ${tab}] the empty state does not say what to do next: "${words.slice(0, 160)}"`);
    }
    if (W === 440) await page.screenshot({ path: `${out}/routec-${W}-p2-${tab}.png` });
  }
  // System and Links: their inner panels, as pushed screens
  for (const [tab, title] of [['system', 'KEYS'], ['system', 'AI ROOM'], ['links', 'EMAIL'], ['links', 'PHONE']]) {
    await page.evaluate((t) => (location.hash = t), tab);
    await page.waitForTimeout(900);
    await openPanel(page, tab, title);
    const pushed = await page.evaluate((t) => !!document.querySelector(`#pg-${t} .pn.pushed`), tab);
    if (!pushed) problems.push(`[${W}] ${tab} → ${title} did not open`);
    const head = await page.evaluate((t) => { const h = document.querySelector(`#pg-${t} .pn.pushed > h3`); return h ? getComputedStyle(h).display : 'none'; }, tab);
    if (head !== 'none') problems.push(`[${W}] ${tab} → ${title} repeats its own row under the title`);
    const tw = await page.evaluate(() => { const t = document.querySelector('#top .navtitle'); return t.scrollWidth - t.clientWidth; });
    if (tw > 1) problems.push(`[${W}] ${tab} → ${title}: the large title is cut (${tw}px)`);
    for (const s of await sideways(page, `#pg-${tab} .pn.pushed :is(button, input, select, .rw, .keyblock), #top :is(button, h1)`)) problems.push(`[${W} ${tab} ${title}] sticks out sideways: ${s}`);
    if (W === 440) await page.screenshot({ path: `${out}/routec-${W}-p2-${tab}-${title.split(' ')[0].toLowerCase()}.png` });
    await page.click('#top .navback');
    await page.waitForTimeout(500);
  }
  // offline: one quiet line, not on Home
  await page.evaluate(() => { location.hash = 'library'; });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__ghosty.ui.set({ connected: false }));
  await page.waitForTimeout(400);
  const off = await page.evaluate(() => { const e = document.getElementById('rcoffline'); const r = e.getBoundingClientRect(); return { shown: getComputedStyle(e).display !== 'none', text: e.textContent, left: r.left, right: r.right }; });
  if (!off.shown || !/^Offline · /.test(off.text) || off.left < 0 || off.right > W) problems.push(`[${W}] offline line: ${JSON.stringify(off)}`);
  await page.evaluate(() => { location.hash = 'core'; });
  await page.waitForTimeout(600);
  if (await page.evaluate(() => getComputedStyle(document.getElementById('rcoffline')).display !== 'none')) problems.push(`[${W}] the offline line shows on Home (its own pill says so)`);
  await page.evaluate(() => window.__ghosty.ui.set({ connected: true }));
  await ctx.close();
}

await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'Route C part 2 run clean in The Scan: every screen through Every screen with nothing sideways and every empty list worded with what to do next; System and Links open their inner panels; the offline line says so');
process.exit(problems.length ? 1 : 0);
