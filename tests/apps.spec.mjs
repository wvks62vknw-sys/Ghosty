// Mini-apps (build_app, the app kit) on an iPhone, in Chromium: every kind of app is made from a request by the
// real build_app tool and served by the real Worker (apps/edge/src/index.ts), exactly as /s/<name> is served
// for real. Then:
//  1. Install: the page is its own document (not framed) with a manifest Chromium parses with no
//     installability errors (name, standalone, start_url and scope /s/<name>/), a 512 px PNG icon, and the
//     security policy that pins the kit's script (no network, not even Ghosty's /api).
//  2. Saved state and offline: two glasses added survive a reload; the service worker takes the page; with
//     the connection off (context.setOffline) the app still opens, still shows them, and still saves.
//  3. UNDO on a delete; the day rolls over at midnight (clock); the timer's pause holds; the list reorders.
//  4. Every kind opens with no errors, takes a tap, and keeps it after a reload (screenshots of each).
//  5. From the chat, on the preview server at BASE (the scripted phrase "make me an app …"): the build is a
//     project in Workshop → PROJECTS with its five steps all done, the link, INSTALL and UNDO; a build whose
//     publish failed part-way shows paused at step 4 and finishes from its record when RESUME is tapped.
// Parts 1–4 build and serve in this process (BASE's port + 1000, else a free one); part 5 needs the preview
// server running at BASE (default http://localhost:8788).
//   node tests/apps.spec.mjs [outDir]
import { devices } from 'playwright';
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const root = new URL('..', import.meta.url).pathname;
const problems = [];
const fail = (m) => problems.push(m);
const t0 = Date.now();
const log = (m) => process.env.DEBUG && console.error(`[apps ${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);

// ── the brain, bundled from source (index.ts serves /s/…; sites.ts has build_app) ──
const { build } = createRequire(join(root, 'apps/edge/package.json'))('esbuild');
const bundle = join(tmpdir(), `ghosty-apps-spec-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { default } from './src/index.ts';\nexport { siteTools, siteStore } from './src/tools/sites.ts';\nexport { PAGE_CSP } from './src/tools/sites.ts';", resolveDir: join(root, 'apps/edge'), loader: 'ts' },
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  external: ['cloudflare:sockets'],
  outfile: bundle,
  logLevel: 'warning',
});
log('built');
const brain = await import(pathToFileURL(bundle).href);
log('imported');
rmSync(bundle, { force: true });

class MemStorage {
  m = new Map();
  async get(k) { return Array.isArray(k) ? new Map(k.filter((x) => this.m.has(x)).map((x) => [x, structuredClone(this.m.get(x))])) : this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
  async put(k, v) { if (typeof k === 'object') for (const [a, b] of Object.entries(k)) this.m.set(a, structuredClone(b)); else this.m.set(k, structuredClone(v)); }
  async delete(k) { return Array.isArray(k) ? k.filter((x) => this.m.delete(x)).length : this.m.delete(k); }
  async list({ prefix = '' } = {}) { return new Map([...this.m].filter(([k]) => k.startsWith(prefix))); }
}
const kvMem = new Map();
const env = {
  SITES: {
    async get(k, type) { if (!kvMem.has(k)) return null; const v = kvMem.get(k); return type === 'json' ? JSON.parse(v) : v; },
    async put(k, v) { kvMem.set(k, typeof v === 'string' ? v : new TextDecoder().decode(v)); },
    async delete(k) { kvMem.delete(k); },
  },
  // Not reached while KV has the page (as in production); a taken-down page answers 404 here.
  AGENT: { idFromName: (n) => n, get: () => ({ fetch: async () => new Response('<!doctype html><title>Not found</title><p>This page doesn\'t exist (any more).</p>', { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } }) }) },
};
const storage = new MemStorage();

const basePort = Number(new URL(process.env.BASE ?? 'http://localhost:0').port || 0);
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${port}`);
    const r = await brain.default.fetch(new Request(url, { method: req.method, headers: req.headers }), env, { waitUntil: () => undefined });
    res.writeHead(r.status, Object.fromEntries(r.headers));
    if (r.body) for await (const c of r.body) res.write(c);
    res.end();
  } catch (e) {
    if (!res.headersSent) res.writeHead(500);
    res.end(String(e));
  }
});
await new Promise((ok) => server.listen(basePort ? basePort + 1000 : 0, ok));
const port = server.address().port;
log(`listening on ${port}`);
const origin = `http://localhost:${port}`;
const ctx = { env, storage, origin, emit: () => undefined, progress: () => undefined };
const tool = brain.siteTools.find((t) => t.name === 'build_app');

/** build_app as Ghosty runs it: the approval, then the run with the arguments it pinned. */
async function make(args) {
  log(`approval ${args.shape}`);
  const ap = await tool.approval(args, ctx);
  log(`run ${args.shape}`);
  const report = await tool.run(ap.args, ctx);
  log(`made ${args.shape}`);
  return { reason: ap.reason, report, name: ap.args.link_name };
}

const APPS = {
  tracker: { request: 'make me an app that tracks my water intake', title: 'Water', tagline: 'Eight glasses a day', shape: 'tracker' },
  list: { request: 'packing list for Spain with passport, charger and sun cream', shape: 'list', title: 'Packing for Spain' },
  timer: { request: 'a plank timer: 1 minute on, 30 seconds rest, 3 rounds', shape: 'timer', title: 'Plank timer' },
  calc: { request: 'a tip calculator for the group', shape: 'calc', calc: 'tip', title: 'Tip & split' },
  counter: { request: 'scoreboard for darts with me and Sam', shape: 'counter', title: 'Darts', items: ['Me', 'Sam'] },
  habits: { request: 'habit tracker for walking, reading and no sugar', shape: 'habits' },
  notes: { request: 'notes app for my ideas', shape: 'notes', title: 'Ideas' },
  cards: { request: 'flash cards for my French verbs', shape: 'cards', title: 'French verbs', cards: [{ q: 'être', a: 'to be' }, { q: 'avoir', a: 'to have' }, { q: 'aller', a: 'to go' }] },
  game: { request: 'a game for the kids', shape: 'game' },
};
log('const made = {};');
const made = {};
for (const [k, args] of Object.entries(APPS)) {
  try {
    made[k] = await make(args);
  } catch (e) {
    fail(`${k}: build_app failed: ${e.message}`);
  }
}
const w = made.tracker;
if (w) {
  if (!/^Make the mini-app "Water" and publish it at http:\/\/localhost:\d+\/s\/water\/\?/.test(w.reason)) fail(`approval: ${w.reason.slice(0, 160)}`);
  for (const re of [/WHAT IT DOES: /, /WHAT IT SAVES: .*on this phone only/, /not an App Store app/, /What is your daily goal\? \(8 glasses\)/]) if (!re.test(w.reason)) fail(`the approval does not say ${re}`);
  for (const re of [/live at http:\/\/localhost:\d+\/s\/water\/ /, /INSTALL: .*Share, then Add to Home Screen/, /UNDO: say "take down water"/]) if (!re.test(w.report)) fail(`the report does not say ${re}`);
}

log('const browser = await launch()');
const browser = await launch();
const phone = { ...devices['iPhone 13'], viewport: PHONE, screen: PHONE, ...UK };
async function open(name, context) {
  const page = await context.newPage();
  const errs = [];
  page.on('pageerror', (er) => webkitNoise(er) || errs.push(`pageerror: ${er.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_INTERNET_DISCONNECTED|Failed to load resource|api\/health/.test(m.text())) errs.push(`console: ${m.text()}`); });
  await page.goto(`${origin}/s/${name}`, { waitUntil: 'load' });
  await page.waitForSelector('#app-main > *', { timeout: 10000 });
  return { page, errs };
}
const big = (page) => page.$eval('.hero .big', (e) => e.textContent.trim());

log('// ── 1 + 2:');
// ── 1 + 2: the water tracker: install, saved state, offline ──
if (w) {
  const context = await browser.newContext(phone);
  const { page, errs } = await open('water', context);
  if (!page.url().endsWith('/s/water/')) fail(`the app did not move to its own scope: ${page.url()}`);
  const head = await page.request.get(`${origin}/s/water/`);
  const csp = head.headers()['content-security-policy'] ?? '';
  if (!/script-src 'sha256-[A-Za-z0-9+/=]{44}';/.test(csp) || /unsafe-inline'[^;]*;\s*style/.test(csp.split('style-src')[0]) || !/connect-src 'none'/.test(csp) || !/frame-ancestors 'none'/.test(csp)) fail(`the app's security policy: ${csp}`);
  if (/<iframe/.test(await head.text())) fail('the app is framed');
  const cdp = await context.newCDPSession(page);
  const man = await cdp.send('Page.getAppManifest');
  const m = JSON.parse(man.data || '{}');
  if (!man.url.endsWith('/s/water/page') || man.errors.length) fail(`manifest: ${man.url} ${JSON.stringify(man.errors)}`);
  if (m.name !== 'Water' || m.short_name !== 'Water' || m.start_url !== '/s/water/' || m.scope !== '/s/water/' || m.display !== 'standalone' || !m.icons?.some((i) => i.sizes === '512x512' && i.type === 'image/png')) fail(`manifest fields: ${man.data}`);
  const inst = await cdp.send('Page.getInstallabilityErrors').catch((e) => ({ installabilityErrors: [{ errorId: e.message }] }));
  if (inst.installabilityErrors.length) fail(`not installable: ${JSON.stringify(inst.installabilityErrors)}`);
  const icon = await page.request.get(`${origin}/s/water/page`, { headers: { 'sec-fetch-dest': 'image' } });
  const png = Buffer.from(await icon.body());
  if (icon.headers()['content-type'] !== 'image/png' || png.readUInt32BE(0) !== 0x89504e47 || png.readUInt32BE(16) !== 512 || png.readUInt32BE(20) !== 512) fail('the Home Screen icon is not a 512 px PNG');
  const touch = await page.$eval('link[rel="apple-touch-icon"]', (l) => l.getAttribute('href'));
  if (touch !== '/s/water/page') fail(`apple-touch-icon: ${touch}`);
  // nothing reaches the network, not even Ghosty's own API
  const net = await page.evaluate(() => window.fetch.call(window, '/api/health').then(() => 'sent', () => 'blocked'));
  if (net !== 'blocked') fail('the app could call /api');
  await page.screenshot({ path: `${out}/apps-water-empty.png` });
  await page.getByRole('button', { name: '+1 GLASS' }).click();
  await page.getByRole('button', { name: '+1 GLASS' }).click();
  if ((await big(page)) !== '2') fail(`two glasses show as ${await big(page)}`);
  await page.waitForFunction(() => /Works offline/.test(document.getElementById('app-status').textContent), null, { timeout: 10000 }).catch(() => fail('the status line never said it works offline'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hero .big');
  if ((await big(page)) !== '2') fail(`after a reload: ${await big(page)}`);
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) fail('the service worker does not control the app');
  await page.screenshot({ path: `${out}/apps-water.png` });
  // offline
  await context.setOffline(true);
  await page.reload({ waitUntil: 'load' }).catch((e) => fail(`offline reload: ${e.message}`));
  await page.waitForSelector('.hero .big', { timeout: 5000 }).catch(() => fail('offline: the app did not open'));
  if ((await page.title()) !== 'Water') fail(`offline title: ${await page.title()}`);
  if ((await big(page).catch(() => '')) !== '2') fail('offline: the saved glasses are gone');
  await page.getByRole('button', { name: '+1 GLASS' }).click();
  await page.reload({ waitUntil: 'load' }).catch(() => undefined);
  await page.waitForSelector('.hero .big', { timeout: 5000 }).catch(() => undefined);
  if ((await big(page).catch(() => '')) !== '3') fail('offline: a glass added offline was not kept');
  await page.screenshot({ path: `${out}/apps-water-offline.png` });
  await context.setOffline(false);
  // UNDO on a delete
  await page.getByRole('button', { name: /^Remove/ }).first().click();
  if ((await big(page)) !== '2') fail('a removed glass is still counted');
  await page.waitForSelector('#app-toast.on .tundo');
  await page.screenshot({ path: `${out}/apps-water-undo.png` });
  await page.click('#app-toast .tundo');
  if ((await big(page)) !== '3') fail('UNDO did not put the glass back');
  // settings sheet
  await page.click('#app-set');
  await page.waitForSelector('#app-sheet[open]');
  if (!/WHAT IT SAVES|What it saves/i.test(await page.textContent('#app-sheet'))) fail('Settings has no "what it saves"');
  await page.screenshot({ path: `${out}/apps-water-settings.png` });
  errs.forEach(fail);
  await context.close();
}

log('// ── 3a:');
// ── 3a: midnight: today starts again, yesterday goes into the history ──
if (w) {
  const context = await browser.newContext(phone);
  const page = await context.newPage();
  // 23:58 on the owner's phone, which keeps London time (BST, +01:00, until the clocks go back on the 25th): the day turns
  // over three minutes later whatever zone this machine is in (new Date(2026, 9, 24, 23, 58) is 23:58 in the machine's own)
  await page.clock.install({ time: new Date('2026-10-24T23:58:00+01:00') });
  await page.goto(`${origin}/s/water/`);
  await page.waitForSelector('.hero .big');
  await page.getByRole('button', { name: '+1 GLASS' }).click();
  if ((await big(page)) !== '1') fail('before midnight: one glass');
  await page.clock.runFor(3 * 60_000);
  if ((await big(page)) !== '0') fail(`after midnight today should start at 0, shows ${await big(page)}`);
  const bars = await page.$$eval('.bar .bv', (b) => b.map((x) => x.textContent));
  if (bars[5] !== '1' || bars[6] !== '') fail(`yesterday in the history: ${JSON.stringify(bars)}`);
  await context.close();
}

log('// ── 3b:');
// ── 3b: the timer's pause holds; it moves on to rest ──
if (made.timer) {
  const context = await browser.newContext(phone);
  const page = await context.newPage();
  await page.clock.install({ time: new Date(2026, 9, 24, 12, 0, 0) });
  await page.goto(`${origin}/s/${made.timer.name}/`);
  await page.waitForSelector('.clock');
  await page.getByRole('button', { name: 'START' }).click();
  await page.clock.runFor(10_000);
  const t1 = await page.textContent('.clock');
  await page.getByRole('button', { name: 'PAUSE' }).click();
  const t2 = await page.textContent('.clock');
  await page.clock.runFor(60_000);
  const t3 = await page.textContent('.clock');
  if (!/^0:5[01]$/.test(t1) || t2 !== '0:50' || t3 !== '0:50') fail(`timer: ${t1} after 10 s, ${t2} when paused, ${t3} after a 60 s pause`);
  await page.getByRole('button', { name: 'RESUME' }).click();
  await page.clock.runFor(51_000);
  if (!/Rest/.test(await page.textContent('.hero'))) fail('the timer did not move on to Rest');
  await page.screenshot({ path: `${out}/apps-timer.png` });
  await context.close();
}

log('// ── 3c + 4:');
// ── 3c + 4: every kind opens clean, takes a tap, keeps it after a reload ──
const context = await browser.newContext(phone);
const steps = {
  list: async (p) => {
    await p.fill('.addbox input', 'Sunglasses');
    await p.click('.addbox button[type=submit]');
    await p.getByRole('button', { name: 'Tick off Passport' }).click();
    await p.getByRole('button', { name: 'REORDER' }).click();
    await p.getByRole('button', { name: 'Move Sunglasses up' }).click();
    const order = await p.$$eval('.itext', (x) => x.map((e) => e.textContent));
    if (order.join('|') !== 'Passport|Charger|Sunglasses|Sun cream') fail(`list order: ${order.join('|')}`);
    await p.getByRole('button', { name: 'DONE', exact: true }).click();
    return () => p.$$eval('.itext', (x) => x.map((e) => e.textContent).join('|'));
  },
  calc: async (p) => {
    await p.fill('input[aria-label="Bill (£)"]', '84.50');
    await p.getByRole('button', { name: 'One more person' }).click();
    const r = await p.textContent('.results');
    if (!/Each person pays£31\.68.*2 of you pay 1p more \(£31\.69\)/.test(r)) fail(`tip: ${r}`);
    return () => p.textContent('.results');
  },
  counter: async (p) => {
    await p.getByRole('button', { name: 'Add 1 to Sam' }).click();
    await p.getByRole('button', { name: 'Add 1 to Sam' }).click();
    if (!/AHEAD/.test(await p.textContent('.player.lead'))) fail('the leader is not shown');
    return () => p.$$eval('.score', (x) => x.map((e) => e.textContent).join('|'));
  },
  habits: async (p) => {
    await p.locator('.habit').first().locator('.dot.today').click();
    return () => p.$$eval('.dot.on', (x) => x.length);
  },
  notes: async (p) => {
    await p.getByRole('button', { name: 'NEW NOTE' }).click();
    await p.fill('.notearea', 'Garden ideas\nRaised beds by the fence');
    await p.waitForTimeout(400);
    await p.locator('#app-sheet').getByRole('button', { name: 'DONE', exact: true }).click();
    return () => p.$$eval('.ntitle', (x) => x.map((e) => e.textContent).join('|'));
  },
  cards: async (p) => {
    await p.click('.flash');
    await p.locator('.ctrls').getByRole('button', { name: 'GOT IT' }).click();
    return () => p.textContent('.tools .count');
  },
  game: async (p) => {
    const before = await p.$$eval('.tile', (x) => x.map((e) => e.textContent).join(','));
    for (const k of ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown']) await p.keyboard.press(k);
    const after = await p.$$eval('.tile', (x) => x.map((e) => e.textContent).join(','));
    if (before === after) fail('the game did not move');
    return () => p.$$eval('.tile', (x) => x.map((e) => e.textContent).join(','));
  },
};
for (const [k, step] of Object.entries(steps)) {
  if (!made[k]) continue;
  const { page, errs } = await open(made[k].name, context);
  try {
    const read = await step(page);
    const seen = await read();
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('#app-main > *');
    const again = await read();
    if (JSON.stringify(seen) !== JSON.stringify(again)) fail(`${k}: not kept after a reload (${seen} → ${again})`);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (wide > 0) fail(`${k}: the page scrolls sideways by ${wide}px`);
    const small = await page.$$eval('button:not([disabled]), input, select', (els) => els.filter((e) => e.offsetParent && e.getBoundingClientRect().height < 43.5).map((e) => e.getAttribute('aria-label') || e.textContent));
    if (small.length) fail(`${k}: targets under 44 px: ${small.slice(0, 4).join(', ')}`);
    await page.screenshot({ path: `${out}/apps-${k}.png`, fullPage: true });
  } catch (e) {
    fail(`${k}: ${e.message.split('\n')[0]}`);
  }
  errs.forEach((x) => fail(`${k}: ${x}`));
  await page.close();
}
await context.close();

log('// ── UNDO = unpublish');
// ── UNDO = unpublish: the link stops working ──
if (w) {
  const unpub = brain.siteTools.find((t) => t.name === 'unpublish_site');
  await unpub.run({ name: 'water' }, ctx);
  const gone = await fetch(`${origin}/s/water/`);
  if (gone.status !== 404) fail(`after unpublish the app answers ${gone.status}`);
}

log('// ── 5. from the chat: Workshop → PROJECTS');
// ── 5. from the chat: the build is a project in Workshop → PROJECTS ──
{
  const base = process.env.BASE ?? 'http://localhost:8788';
  const context = await browser.newContext(phone);
  const ui = await context.newPage();
  ui.on('pageerror', (er) => webkitNoise(er) || fail(`chat: pageerror: ${er.message}`));
  await ui.goto(base, { waitUntil: 'domcontentloaded' });
  await ui.waitForSelector('#pair input', { timeout: 15000 });
  await ui.fill('#pair input', 'preview-owner-key-0123456789');
  await ui.click('#pair button.on');
  await ui.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
  await ui.waitForTimeout(800);
  if (await ui.$('.logbtn')) await ui.click('.logbtn');
  /** Ask for an app in the chat; the approval names the link. `before` runs between reading it and tapping approve. */
  const ask = async (words, before) => {
    await ui.evaluate(() => (location.hash = 'core'));
    await ui.waitForTimeout(500);
    if (!(await ui.locator('#cin').isVisible())) await ui.click('.logbtn').catch(() => undefined);
    await ui.fill('#cin', words);
    await ui.keyboard.press('Enter');
    const ok = await ui.waitForSelector('.approval button.on', { timeout: 20000 }).catch(() => null);
    if (!ok) return fail(`chat: no approval for "${words}"`);
    const reason = (await ok.evaluate((b) => b.closest('.approval')?.textContent ?? '')) ?? '';
    const name = reason.match(/\/s\/([a-z0-9-]+)\/\?/)?.[1];
    if (!name) return fail(`chat: the approval names no link: ${reason.slice(0, 160)}`);
    await before?.(name);
    await ok.tap();
    return name;
  };
  // The preview brain keeps earlier runs' projects: a card is the newest with that title in a state (the panel lists
  // running ones first, then paused, then the rest, newest first within each), counted before the build.
  const cards = (title, state = '') => ui.locator(`#pg-workshop .change.project${state}`, { hasText: title });
  const card = (title, state = '') => cards(title, state).first();
  const workshop = async () => {
    await ui.evaluate(() => (location.hash = 'workshop'));
    await ui.waitForTimeout(600);
  };
  /** Wait for a number of cards with that title in that state (the panel is opened again every 5 s). */
  const count = async (title, state, n, ms) => {
    const end = Date.now() + ms;
    for (let i = 1; Date.now() < end; i++) {
      if ((await cards(title, state).count()) >= n) return true;
      await ui.waitForTimeout(1000);
      if (i % 5 === 0) {
        await ui.evaluate(() => (location.hash = 'core'));
        await ui.waitForTimeout(300);
        await workshop();
      }
    }
    return false;
  };
  const before = async (title, state) => {
    await workshop();
    await ui.waitForTimeout(1500);
    return cards(title, state).count();
  };
  /**
   * Wait for the card's text to match. The panel looks again every 15 s while a project runs (once a minute
   * otherwise), so with `reopen` the Workshop is left and opened again every 5 s, which looks at once.
   */
  const until = async (title, re, ms, reopen = true) => {
    const end = Date.now() + ms;
    for (let i = 1; Date.now() < end; i++) {
      if (re.test((await card(title).textContent({ timeout: 1000 }).catch(() => '')) ?? '')) return true;
      await ui.waitForTimeout(1000);
      if (reopen && i % 5 === 0) {
        await ui.evaluate(() => (location.hash = 'core'));
        await ui.waitForTimeout(300);
        await workshop();
      }
    }
    return false;
  };
  const STEPS = ['Brief and plan', 'Build and icon', 'Check', 'Publish', 'Report'];
  // a. one message, one approval: the project is there with all five steps done, the link, INSTALL and UNDO
  const doneBefore = await before('App: Water', '.passed');
  const water = await ask('make me an app that tracks my water intake');
  if (water) {
    // the chat keeps its link card
    await ui.waitForSelector(`#pg-core a.sitelink[href$="/s/${water}/"]`, { state: 'attached', timeout: 20000 }).catch(() => fail('chat: no link card after the build'));
    await workshop();
    if (!(await count('App: Water', '.passed', doneBefore + 1, 20000))) fail('PROJECTS: no finished "App: Water" project');
    else {
      const c = card('App: Water', '.passed');
      if (!(await c.evaluate((e) => e.classList.contains('passed')))) fail('PROJECTS: the app project is not marked done');
      const text = (await c.textContent()) ?? '';
      if (!/5\/5/.test(text)) fail(`PROJECTS: not 5/5: ${text.slice(0, 160)}`);
      for (const s of STEPS) if (!text.includes(s)) fail(`PROJECTS: no step "${s}"`);
      if (await c.locator('.rw:not(.st-done)').count()) fail('PROJECTS: a step is not done');
      const report = (await c.locator('.preport').textContent().catch(() => '')) ?? '';
      if (!new RegExp(`"Water" is live at ${base.replace(/[.]/g, '\\.')}/s/${water}/`).test(report)) fail(`PROJECTS: the report has no link: ${report.slice(0, 160)}`);
      if (!/INSTALL: on the iPhone/.test(report) || !/UNDO: say "take down/.test(report)) fail('PROJECTS: the report has no INSTALL or UNDO');
      for (const b of ['OPEN', 'UNDO']) if (!(await c.locator(`button:has-text("${b}")`).count())) fail(`PROJECTS: no ${b} button`);
      const live = await context.request.get(`${base}/s/${water}/`);
      if (live.status() !== 200) fail(`the app's link answers ${live.status()}`);
      await c.evaluate((e) => e.scrollIntoView({ block: 'start' }));
      await ui.waitForTimeout(300);
      await ui.screenshot({ path: `${out}/apps-project-done.png` });
    }
  }
  // b. the publish fails part-way (one database blip): paused at step 4 with the reason; RESUME finishes it from its record
  const pausedBefore = await before('App: Darts', '.paused');
  const dartsDone = await cards('App: Darts', '.passed').count();
  const darts = await ask('make me an app that keeps score at darts for me and sam', (name) => context.request.get(`${base}/__test/blip?key=site:${name}`));
  if (darts) {
    await workshop();
    if (!(await count('App: Darts', '.paused', pausedBefore + 1, 20000))) fail('PROJECTS: the failed build is not shown paused');
    else {
      const c = card('App: Darts', '.paused');
      const text = (await c.textContent()) ?? '';
      if (!/3\/5/.test(text) || !/step 4 "Publish" stopped: .*storage blip.*RESUME carries on from here/.test(text)) fail(`PROJECTS: the stopped build: ${text.slice(0, 240)}`);
      await c.scrollIntoViewIfNeeded();
      await ui.screenshot({ path: `${out}/apps-project-paused.png` });
      await c.locator('button:has-text("RESUME")').click();
      if (!(await until('App: Darts', /RUNNING[\s\S]*NOW: step 4 · Publish/, 4000, false))) fail('PROJECTS: after RESUME the card does not show the step it runs now');
      else await ui.screenshot({ path: `${out}/apps-project-resumed.png` });
      if (!(await count('App: Darts', '.passed', dartsDone + 1, 45000))) fail('PROJECTS: the resumed build did not finish');
      else {
        const done = card('App: Darts', '.passed');
        if (!/5\/5/.test((await done.textContent()) ?? '')) fail('PROJECTS: the resumed build is not 5/5');
        const report = (await done.locator('.preport').textContent().catch(() => '')) ?? '';
        if (!report.includes(`/s/${darts}/`)) fail(`PROJECTS: the resumed build's report has no link: ${report.slice(0, 120)}`);
        await done.evaluate((e) => e.scrollIntoView({ block: 'start' }));
        await ui.waitForTimeout(300);
        await ui.screenshot({ path: `${out}/apps-project-resumed-done.png` });
      }
    }
  }
  await context.close();
}

await browser.close();
server.close();
if (problems.length) {
  console.error(`apps spec: ${problems.length} problem(s)\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`apps spec: OK — 9 kinds made by build_app and served by the Worker; install, saved state, offline, UNDO, midnight, timer pause and list reorder all checked; from the chat the build is a Workshop project (five steps done, the link, INSTALL, UNDO) and a build stopped at its publish finishes from RESUME (screenshots in ${out})`);
