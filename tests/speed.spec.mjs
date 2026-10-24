// The SPEED card (SYSTEM → STATUS, under the dials; features/system/speed.ts), on the owner's phone (440 × 956, en-GB):
//  - a fresh page before any reply: "No replies timed yet today" for this phone, and "The brain has not timed anything
//    yet" for a brain with nothing timed (its status given with an empty stopwatch, since other checks share the brain);
//  - after one chat reply and two tabs opened: this phone's reply line with real medians, a Screens line naming both
//    tabs, the brain's first-word line (the preview brain's mock calls are timed), "Where a reply's time goes" as one
//    bar of four labelled parts adding up to the whole, and RECENT with the brain's entries;
//  - the card repaints when this phone times something new and when a status arrives (here: the Me sheet's);
//  - nothing sticks out sideways and no figure is cut.
//   BASE=http://localhost:8788 node tests/speed.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const problems = [];
const check = (ok, what) => ok || problems.push(what);

async function open(name, { emptyBrain = false } = {}) {
  const ctx = await browser.newContext({ viewport: PHONE, ...UK, deviceScaleFactor: 1 });
  await ctx.addInitScript((k) => localStorage.setItem('ghosty.ownerKey', k), KEY);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${name}] pageerror: ${e.message}`));
  if (emptyBrain)
    await page.route('**/api/status', async (r) => {
      const res = await r.fetch();
      const st = await res.json();
      st.speed = { today: { day: new Date().toISOString().slice(0, 10), firstToken: null, reply: null, providers: [], tools: [], split: null }, week: null, lines: ['No model calls timed yet'], recent: [] };
      await r.fulfill({ response: res, json: st });
    });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 25000 });
  return { ctx, page };
}

const card = (page) => page.evaluate(() => {
  const c = document.querySelector('#pg-system .keepcard [data-speed="card"]');
  if (!c) return null;
  const t = (sel) => [...c.querySelectorAll(sel)].map((e) => e.textContent.trim());
  const row = (k) => c.querySelector(`.spdrow[data-speed="${k}"] .v`)?.textContent ?? '';
  return {
    afterDials: c.previousElementSibling?.classList.contains('megauges') ?? false,
    phone: t('[data-speed="phone"] .spdline span'),
    brain: t('[data-speed="brain"] .spdline span'),
    screens: row('screens'),
    trip: row('trip'),
    parts: [...c.querySelectorAll('.spdbar i')].map((i) => ({ part: i.dataset.part, ms: Number(i.dataset.ms), pc: Number(i.dataset.pc), w: i.getBoundingClientRect().width })),
    bar: c.querySelector('.spdbar')?.getBoundingClientRect().width ?? 0,
    key: t('.spdkey span'),
    total: c.querySelector('.spdsk .v')?.textContent ?? '',
    recentShown: !c.querySelector('[data-speed="recent"]')?.hidden,
    recent: [...c.querySelectorAll('.spdlist li')].map((li) => ({ kind: li.dataset.kind, text: li.textContent })),
  };
});

// nothing sideways, no figure cut
const tidy = (page, name) => page.evaluate(() => {
  const c = document.querySelector('#pg-system [data-speed="card"]');
  const bad = [];
  for (const e of c?.querySelectorAll('*') ?? []) {
    if (!e.getClientRects().length) continue;
    const r = e.getBoundingClientRect();
    if (r.left < -1 || r.right > innerWidth + 1) bad.push(`"${e.textContent.trim().slice(0, 30)}" at ${Math.round(r.left)}–${Math.round(r.right)}`);
    if (e.matches('.spdrow .v, .spdline span, .spdkey span') && e.scrollWidth > e.clientWidth + 1) bad.push(`cut: "${e.textContent.trim().slice(0, 40)}"`);
  }
  return bad;
}).then((bad) => bad.forEach((b) => problems.push(`[${name}] ${b}`)));

const toSystem = async (page) => {
  await page.evaluate(() => (location.hash = 'system'));
  await page.waitForSelector('#pg-system [data-speed="card"]', { timeout: 15000 }).catch(() => undefined);
  await page.waitForTimeout(1500);
};
const shoot = async (page, file) => {
  await page.locator('#pg-system [data-speed="card"]').scrollIntoViewIfNeeded().catch(() => undefined);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${file}-screen.png` });
  await page.locator('#pg-system [data-speed="card"]').screenshot({ path: `${out}/${file}.png` }).catch((e) => problems.push(`[${file}] no card to photograph: ${e.message}`));
};

// ---- 1. the empty card: a fresh page, before any reply, with a brain that has timed nothing
{
  const { ctx, page } = await open('empty', { emptyBrain: true });
  await toSystem(page);
  const c = await card(page);
  if (!c) problems.push('[empty] SYSTEM → STATUS has no SPEED card');
  else {
    check(c.afterDials, '[empty] the SPEED card is not under the Status dials');
    check(c.phone.join() === 'No replies timed yet today', `[empty] this phone's line reads ${JSON.stringify(c.phone)}`);
    check(c.brain.join() === 'The brain has not timed anything yet', `[empty] the brain's line reads ${JSON.stringify(c.brain)}`);
    check(!c.parts.length && !c.recentShown, `[empty] a bar or RECENT shows with nothing timed (${c.parts.length} parts, recent ${c.recentShown})`);
  }
  await tidy(page, 'empty');
  await shoot(page, 'speed-empty');
  await ctx.close();
}

// ---- 2. the full card: one chat reply and two tabs opened
{
  const { ctx, page } = await open('full');
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForSelector('#cin', { timeout: 15000 });
  await page.click('.logbtn').catch(() => undefined);
  const before = await page.locator('.log .msg:not(.me)').count();
  await page.fill('#cin', 'hello, how quick are you?');
  await page.press('#cin', 'Enter');
  await page.waitForFunction((n) => document.querySelectorAll('.log .msg:not(.me)').length > n, before, { timeout: 20000 }).catch(() => problems.push('[full] no reply came'));
  await page.waitForTimeout(800);
  for (const tab of ['agenda', 'memory']) {
    await page.evaluate((t) => (location.hash = t), tab);
    await page.waitForTimeout(1500);
  }
  await toSystem(page);
  await page.waitForFunction(() => /^Replies: first word in/.test(document.querySelector('#pg-system [data-speed="phone"] .spdline span')?.textContent ?? ''), null, { timeout: 10000 }).catch(() => undefined);
  const c = await card(page);
  if (!c) problems.push('[full] SYSTEM → STATUS has no SPEED card');
  else {
    check(/^Replies: first word in \d[\d.]* (ms|s), done in \d[\d.]* (ms|s) \(today's medians, 1 reply\)/.test(c.phone[0] ?? ''), `[full] this phone's reply line reads ${JSON.stringify(c.phone)}`);
    check(/\bAgenda \d/.test(c.screens) && /\bMemory \d/.test(c.screens), `[full] the Screens line does not name both tabs: "${c.screens}"`);
    check(/\d (ms|s)/.test(c.trip), `[full] no brain round trip: "${c.trip}"`);
    check(/^First word in \d[\d.]* (ms|s) \(median\), \d[\d.]* (ms|s) at the slow end/.test(c.brain[0] ?? ''), `[full] the brain's first-word line reads ${JSON.stringify(c.brain)}`);
    check(c.brain.some((l) => /^Replies take \d[\d.]* (ms|s) in the brain/.test(l)), `[full] the brain's replies line is missing: ${JSON.stringify(c.brain)}`);
    // the bar: four parts, each labelled, their shares adding up to the whole bar
    check(c.parts.map((p) => p.part).join() === 'model,tools,wait,rest', `[full] the bar's parts are ${JSON.stringify(c.parts.map((p) => p.part))}`);
    check(c.key.length === 4 && /^The model /.test(c.key[0]) && /^Tools /.test(c.key[1]) && /^Waiting /.test(c.key[2]) && /^The rest /.test(c.key[3]), `[full] the bar's labels read ${JSON.stringify(c.key)}`);
    const ms = c.parts.reduce((t, p) => t + p.ms, 0);
    const pc = c.parts.reduce((t, p) => t + p.pc, 0);
    const w = c.parts.reduce((t, p) => t + p.w, 0);
    check(ms > 0 ? pc === 100 && Math.abs(w - c.bar) <= 2 : pc === 0, `[full] the bar's parts do not add up: ${ms} ms, ${pc}%, ${Math.round(w)} of ${Math.round(c.bar)} px`);
    check(/on average/.test(c.total), `[full] no average over the bar: "${c.total}"`);
    check(c.recentShown && c.recent.length >= 2 && c.recent.length <= 20, `[full] RECENT has ${c.recent.length} entries`);
    check(c.recent.some((r) => r.kind === 'm' && /^Model call\s*Mock/.test(r.text)) && c.recent.some((r) => r.kind === 'r' && /^Reply/.test(r.text)), `[full] RECENT lacks a model call or a reply: ${JSON.stringify(c.recent.slice(0, 4))}`);
  }
  // RECENT opens
  await page.locator('#pg-system [data-speed="recent"] > summary').click().catch(() => problems.push('[full] RECENT cannot be opened'));
  await page.waitForTimeout(300);
  check(await page.locator('#pg-system [data-speed="recent"] .spdlist li').first().isVisible().catch(() => false), '[full] RECENT opened but shows no entry');
  await tidy(page, 'full');
  await shoot(page, 'speed-full');

  // the phone times another reply: the card repaints by itself (and RECENT stays open)
  await page.evaluate(async () => {
    const r = window.__ghosty.stopwatch.reply();
    await new Promise((res) => setTimeout(res, 40)); // (a reply's first words come after it was sent)
    r.saw('text');
    r.saw('done');
    r.end();
  });
  await page.waitForFunction(() => /2 replies/.test(document.querySelector('#pg-system [data-speed="phone"]')?.textContent ?? ''), null, { timeout: 5000 }).catch(() => problems.push('[full] the card did not repaint when the phone timed a reply'));
  check(await page.locator('#pg-system [data-speed="recent"]').evaluate((d) => d.open).catch(() => false), '[full] RECENT closed itself on a repaint');
  // a new status (the Me sheet asks for one) brings the brain's newer timings
  const newest = async () => Number(await page.locator('#pg-system .spdlist li').first().getAttribute('data-at').catch(() => 0));
  const was = await newest();
  await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'x-ghosty': '1', 'x-ghosty-key': KEY, 'content-type': 'application/json' }, body: JSON.stringify({ message: 'one more, quickly', context: {} }) }).then((r) => r.text()).catch(() => '');
  await page.click('#top .you').catch(() => problems.push('[full] no avatar to open the Me sheet'));
  await page.waitForFunction((was) => Number(document.querySelector('#pg-system .spdlist li')?.dataset.at ?? 0) > was, was, { timeout: 8000 }).catch(async () => problems.push(`[full] the card did not repaint when a status arrived (newest entry still ${was}, now ${await newest()})`));
  await ctx.close();
}

await browser.close();
if (problems.length) {
  console.error(`PROBLEMS:\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('SPEED run clean: SYSTEM → STATUS shows the SPEED card under the dials; empty, it says "No replies timed yet today" and "The brain has not timed anything yet"; after a reply and two tabs it shows this phone\'s reply medians, the Screens line with both tabs, the brain\'s first-word and reply lines, the four-part bar adding up, and RECENT with the brain\'s entries; it repaints when the phone times something and when a status arrives; nothing sideways or cut at 440 × 956.');
