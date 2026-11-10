// The first screen (BRIEF-SPEED-5, offender 1): on a phone whose every request to the brain and the data costs 150 ms (a mobile
// network), the first screen opens at the pace of the slowest of what it needs, not of all of it added up. The Earth data, the
// brain's health and status and the conversation's history used to be asked one after the other (1,167 ms on this phone and this
// network, median of five); now the Earth data goes with the brain and the history with its status.
//  - first screen (the stopwatch's cold start, core/stopwatch.ts) in under 1,000 ms, median of five, 150 ms a request;
//  - still the same boot: connected, the dock drawn, the conversation on the log (a reply left there by this spec comes back);
//  - the brain is not asked for the same thing twice to open it (health, status, history once each), and the history goes
//    out with the status, not after it;
//  - a phone whose key is refused still gets the pairing form and, after it, its conversation (the history asked ahead is
//    never what a refused phone sees).
//   BASE=http://localhost:8788 node tests/speed2.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';

const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const NETWORK_MS = 150;
const BUDGET_MS = 1000;
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const problems = [];
const check = (ok, what) => ok || problems.push(what);

// a conversation to find on the log
const SAID = `speed two checks the history ${Date.now()}`;
await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'x-ghosty': '1', 'x-ghosty-key': KEY, 'content-type': 'application/json' }, body: JSON.stringify({ message: SAID, context: {} }) }).then((r) => r.text());

async function boot(key, seen) {
  const ctx = await browser.newContext({ viewport: PHONE, ...UK, deviceScaleFactor: 1 });
  await ctx.addInitScript((k) => k && localStorage.setItem('ghosty.ownerKey', k), key);
  await ctx.route(/\/(api|data)\//, async (r) => {
    seen?.push(new URL(r.request().url()).pathname);
    await new Promise((ok) => setTimeout(ok, NETWORK_MS));
    await r.continue();
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  return { ctx, page };
}

// ---- 1. the budget: five cold starts (the first is also looked over: the same boot as ever)
const screens = [];
for (let i = 0; i < 5; i++) {
  const seen = [];
  const { ctx, page } = await boot(KEY, seen);
  await page.waitForSelector('#boot', { state: 'detached', timeout: 25000 });
  // what Ghosty asked to open the screen: everything before the chores that follow it (the inbox is the first of those)
  const early = seen.slice(0, Math.max(1, seen.indexOf('/api/inbox')));
  const asked = early.map((p) => p.replace(/^.*\/api\//, '')).filter((p) => /^(status|history|health)$/.test(p));
  await page.waitForTimeout(900);
  const s = await page.evaluate(() => window.__ghosty.stopwatch.summary());
  if (s.start.screen) screens.push(s.start.screen.median);
  else problems.push(`[run ${i + 1}] the stopwatch timed no cold start`);
  if (i === 0) {
    const st = await page.evaluate(() => ({ connected: window.__ghosty.ui.get().connected, dock: !!document.querySelector('#dock, #tabbar, nav') }));
    check(st.connected === true, '[boot] not connected after boot');
    check(st.dock, '[boot] no dock drawn');
    await page.waitForSelector('.log .msg', { state: 'attached', timeout: 10000 }).catch(() => undefined);
    const log = await page.evaluate(() => [...document.querySelectorAll('.log .msg')].map((m) => m.textContent ?? '').join('\n'));
    check(log.includes(SAID), '[boot] the conversation (history) is not on the log after boot');
    check(early[0] === '/data/world.json' && early.slice(1, 4).includes('/api/history') && early.indexOf('/api/history') < early.indexOf('/api/status'), `[boot] the history is not asked alongside the status: ${early.join(' ')}`);
    for (const name of ['health', 'status', 'history']) check(asked.filter((p) => p === name).length === 1, `[boot] /api/${name} asked ${asked.filter((p) => p === name).length} times before the screen opened`);
  }
  await ctx.close();
}
screens.sort((a, b) => a - b);
const median = screens[Math.floor(screens.length / 2)];
check(median !== undefined && median <= BUDGET_MS, `first screen ${median} ms (median of ${screens.join(', ')}) with ${NETWORK_MS} ms a request: over the ${BUDGET_MS} ms budget`);

// ---- 3. a refused key still pairs, and the conversation comes after
{
  const { page, ctx } = await boot('not-the-key-0123456789', null);
  await page.waitForSelector('#pair-key', { timeout: 20000 }).catch(() => problems.push('[refused] no pairing form for a refused key'));
  await page.fill('#pair-key', KEY).catch(() => undefined);
  await page.press('#pair-key', 'Enter').catch(() => undefined);
  await page.waitForSelector('#boot', { state: 'detached', timeout: 25000 }).catch(() => problems.push('[refused] boot never finished after pairing'));
  await page.waitForSelector('.log .msg', { state: 'attached', timeout: 10000 }).catch(() => undefined);
  const log = await page.evaluate(() => [...document.querySelectorAll('.log .msg')].map((m) => m.textContent ?? '').join('\n'));
  check(log.includes(SAID), '[refused] after pairing the conversation is not on the log');
  await ctx.close();
}

await browser.close();
if (problems.length) {
  console.error(`PROBLEMS:\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(`SPEED2 run clean: with ${NETWORK_MS} ms a request the first screen opens in ${median} ms (median of five: ${screens.join(', ')}; budget ${BUDGET_MS}); connected, dock drawn, the conversation on the log, health, status and history each asked once; a refused key still pairs and then shows its conversation.`);
