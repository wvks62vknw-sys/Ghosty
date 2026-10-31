// THE INDEPENDENCE METER and SOVEREIGN MODE (OWNER-ISSUES 78) on the owner's phone (440 × 956), with a stand-in for the
// offline brain (as offlinebrain.spec.mjs) and the mock brain for the cloud. Checked:
//  1. Settings → OFFLINE BRAIN says the week in his voice from the counts kept on the phone — "This week 71% of what you
//     asked was answered on your own brains (phone 54%, library 17%). The cloud did 29%: mostly live facts and long
//     writing." — with the bar and the weeks' trend, and the per cents add up to 100.
//  2. Every answer is counted where it was answered, from the line it carries: a cloud reply (the mock brain), the phone's
//     own brain when the brain can't be reached; the numbers still add up after them.
//  3. The REPORT CARD says the same week.
//  4. The brain is given the days as counts only (never words), once.
//  5. SOVEREIGN MODE (Always): a kept answer is counted as the phone's and kept; one the phone can't give stops ("Nothing of
//     it left the phone") and is listed under SOVEREIGN MODE with why; nothing reaches the brain, the meter's copy neither.
// No page errors, nothing sideways.
//   BASE=http://localhost:<port> node tests/independence.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, openPanel } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const problems = [];
const check = (n, ok, what) => ok || problems.push(`[${n}] ${what}`);

const engine = () => {
  // The offline brain on the phone, stood in: not downloaded until DOWNLOAD, answers in pieces.
  window.__ghostyOfflineEngine = {
    ready: false,
    calls: [],
    loads: 0,
    unloads: 0,
    loadMs: 0,
    idleMs: 500,
    async load() {
      this.loads++;
    },
    unload() {
      this.unloads++;
    },
    async chat(messages, onToken) {
      this.calls.push(messages);
      if (this.fail) throw new Error('the stand-in was told to fail');
      for (const w of ['<think>\n\n</think>\n\n', 'Hello ', 'from ', 'your ', 'phone.']) {
        await new Promise((r) => setTimeout(r, 20));
        onToken(w);
      }
    },
  };
};

// Last week (yesterday): 54 answered by the phone's brain, 17 by its library, 29 by the cloud (20 for live facts, 9 long
// writing); the two weeks before, 64 % and 58 % on his own brains. Seeded once, in the phone's own days.
const seed = () => {
  if (localStorage.getItem('ghosty.test.indep')) return;
  localStorage.setItem('ghosty.test.indep', '1');
  const pad = (n) => String(n).padStart(2, '0');
  const day = (ago) => {
    const d = new Date(Date.now() - ago * 86_400_000);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const days = [
    { d: day(15), n: { phone: 58, cloud: 42 }, c: { groq: 42 }, a: { chat: 42 } },
    { d: day(8), n: { phone: 64, cloud: 36 }, c: { groq: 36 }, a: { chat: 36 } },
    { d: day(1), n: { phone: 54, library: 17, cloud: 29 }, k: {}, c: { groq: 20, gemini: 9 }, a: { live: 20, long: 9 } },
  ];
  localStorage.setItem('ghosty.independence', JSON.stringify({ days, stopped: [], postedAt: 0 }));
};

const browser = await launch();
const ctx = await browser.newContext({ viewport: PHONE, ...UK, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
const page = await ctx.newPage();
page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
await page.addInitScript(engine);
await page.addInitScript(seed);
// (the service worker is blocked, so every request the page makes is seen here)
const sent = [];
page.on('request', (r) => {
  const u = new URL(r.url());
  if (u.pathname.startsWith('/api/')) sent.push({ path: u.pathname, body: r.postData() ?? '' });
});
const kept = () => page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.independence') ?? '{}'));
const today = () => page.evaluate(() => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
});
/** Per cents in the line: own parts, own, cloud — they must add up. */
const addsUp = (line) => {
  const m = line.match(/This week (\d+)% of what you asked was answered on your own brains \(([^)]*)\)\. The cloud did (\d+)%/);
  if (!m) return false;
  const parts = [...m[2].matchAll(/(\d+)%/g)].reduce((t, x) => t + Number(x[1]), 0);
  return parts === Number(m[1]) && Number(m[1]) + Number(m[3]) === 100;
};
/**
 * Ask in the chat and wait until the kept copy has moved (the meter counts an answer once it is complete): `want.where`
 * reaching `want.n` today, or `want.stopped` tasks listed. (A function, not a string: the app's policy forbids eval.)
 */
const ask = async (words, want) => {
  if (!(await page.locator('#cin').isVisible().catch(() => false))) await page.click('.logbtn').catch(() => undefined);
  await page.fill('#cin', words);
  await page.keyboard.press('Enter');
  // (polled on a clock, not on animation frames: the kept copy changes without the screen repainting)
  await page
    .waitForFunction(
      (w) => {
        const d = new Date();
        const p = (n) => String(n).padStart(2, '0');
        const k = JSON.parse(localStorage.getItem('ghosty.independence') ?? '{}');
        if (w.stopped) return (k.stopped ?? []).length >= w.stopped;
        const t = (k.days ?? []).find((x) => x.d === `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
        return (t?.n?.[w.where] ?? 0) >= w.n;
      },
      want,
      { timeout: 15000, polling: 250 },
    )
    .catch(() => problems.push(`the meter did not move for "${words}"`));
};

await page.goto(base);
await page.fill('#pair input', KEY);
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });

// 1. Settings → OFFLINE BRAIN: the week in his voice, the bar, the trend; it adds up.
await page.evaluate(() => (location.hash = 'settings'));
await page.locator('#pg-settings .pn.offbrain').waitFor({ state: 'attached', timeout: 10000 });
await openPanel(page, 'settings', 'OFFLINE');
const pn = page.locator('#pg-settings .pn.offbrain');
const line = async () => ((await pn.locator('.indep .indline').textContent().catch(() => '')) ?? '').trim();
check(1, (await line()) === 'This week 71% of what you asked was answered on your own brains (phone 54%, library 17%). The cloud did 29%: mostly live facts and long writing.', `the meter reads "${await line()}"`);
check(1, /71%/.test((await pn.locator('.indep .bar').textContent().catch(() => '')) ?? ''), 'no bar at 71%');
check(1, ((await pn.locator('.indep .indtrend').textContent().catch(() => '')) ?? '').includes('Your own brains, week by week: 58% → 64% → 71%.'), 'no trend over the weeks');
check(1, addsUp(await line()), `the per cents do not add up: "${await line()}"`);
check(1, /SOVEREIGN MODE · OFF/.test((await pn.locator('.indep').textContent()) ?? ''), 'Sovereign Mode not shown as off');
await pn.locator('.indep').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${out}/independence-settings.png` });

// 4. The brain's copy: counts only, once.
await page.waitForTimeout(500);
const copies = sent.filter((r) => r.path === '/api/training/meter');
check(4, copies.length === 1, `the brain was given the days ${copies.length} times`);
const copy = JSON.parse(copies[0]?.body || '{}');
check(4, Array.isArray(copy.days) && copy.days.some((x) => x.n?.library === 17) && !/"q"|stopped|Hello/.test(copies[0]?.body ?? ''), `the brain's copy is not counts only: ${(copies[0]?.body ?? '').slice(0, 200)}`);
const held = await fetch(`${base}/api/training/meter`, { headers: { 'x-ghosty': '1', 'x-ghosty-key': KEY } }).then((r) => r.json()).catch(() => null);
check(4, held?.week?.by?.library === 17 && held?.week?.total === 100, `the brain's week reads ${JSON.stringify(held?.week)}`);

// 2. Answers counted where they were answered: the cloud (the mock brain), then the phone's own brain with no brain to reach.
await pn.locator('button:has-text("DOWNLOAD")').click();
await page.waitForFunction(() => /READY/.test(document.querySelector('#pg-settings .pn.offbrain h3')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => problems.push('[2] the stand-in brain did not turn READY'));
const d0 = await today();
const before = (await kept()).days?.find((x) => x.d === d0)?.n ?? {};
await page.evaluate(() => (location.hash = 'core'));
await ask('hello', { where: 'cloud', n: (before.cloud ?? 0) + 1 });
let now = (await kept()).days?.find((x) => x.d === d0) ?? { n: {}, c: {} };
check(2, (now.n.cloud ?? 0) === (before.cloud ?? 0) + 1 && Object.values(now.c ?? {}).reduce((t, x) => t + x, 0) >= 1, `a cloud reply was not counted as the cloud's: ${JSON.stringify(now)}`);
await page.route('**/api/chat', (r) => r.abort('internetdisconnected'));
await ask('what should I cook tonight', { where: 'phone', n: (before.phone ?? 0) + 1 });
now = (await kept()).days?.find((x) => x.d === d0) ?? { n: {} };
check(2, (now.n.phone ?? 0) === (before.phone ?? 0) + 1, `the phone's own answer was not counted as the phone's: ${JSON.stringify(now)}`);
await page.unroute('**/api/chat');

// 3. The REPORT CARD says the same week (and it still adds up).
await page.evaluate(() => (location.hash = 'system'));
await openPanel(page, 'system', 'OFFLINE BRAIN REPORT');
const rc = ((await page.locator('#pg-system .pn.reportcard .indep .indline').textContent().catch(() => '')) ?? '').trim();
await page.evaluate(() => (location.hash = 'settings'));
await openPanel(page, 'settings', 'OFFLINE');
check(3, rc && rc === (await line()), `the REPORT CARD reads "${rc}", Settings "${await line()}"`);
check(3, addsUp(rc), `the REPORT CARD's per cents do not add up: "${rc}"`);

// 5. SOVEREIGN MODE: Always. A kept answer is the phone's (and kept); one the phone can't give stops and is listed; nothing reaches the brain.
await pn.locator('select[aria-label="Offline brain mode"]').selectOption('always');
await page.waitForFunction(() => /SOVEREIGN MODE · ON/.test(document.querySelector('#pg-settings .pn.offbrain .indep')?.textContent ?? ''), null, { timeout: 5000 }).catch(() => problems.push('[5] Sovereign Mode does not show as on'));
const quiet = sent.length;
await page.evaluate(() => (location.hash = 'core'));
await ask('tell me something nice', { where: 'phone', n: (before.phone ?? 0) + 2 });
now = (await kept()).days?.find((x) => x.d === d0) ?? { n: {}, k: {} };
check(5, (now.n.phone ?? 0) === (before.phone ?? 0) + 2 && (now.k?.phone ?? 0) >= 1, `a kept answer was not counted as the phone's, kept: ${JSON.stringify(now)}`);
await page.evaluate(() => (window.__ghostyOfflineEngine.fail = true));
await ask('book me a table for two tonight', { stopped: 1 });
const stopped = (await kept()).stopped ?? [];
check(5, stopped.some((x) => x.q === 'book me a table for two tonight' && /couldn't answer/.test(x.why)), `the stopped task is not kept for the list: ${JSON.stringify(stopped)}`);
await page.evaluate(() => (location.hash = 'settings'));
await openPanel(page, 'settings', 'OFFLINE');
const sov = ((await pn.locator('.indep').textContent()) ?? '').replace(/\s+/g, ' ');
check(5, /SOVEREIGN MODE · ON/.test(sov) && /What stopped for want of the cloud this week:/.test(sov) && /book me a table for two tonight · my offline brain couldn't answer it/.test(sov), `the Sovereign list reads "${sov.slice(0, 400)}"`);
const leaked = sent.slice(quiet).filter((r) => r.path === '/api/chat' || r.path === '/api/training/meter' || /book me a table|tell me something nice/.test(r.body));
check(5, !leaked.length, `with Sovereign Mode on, the page still sent: ${leaked.map((r) => r.path).join(', ')}`);
await pn.locator('.indep').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${out}/independence-sovereign.png` });

// nothing sideways
check(0, !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'the page scrolls sideways');
await ctx.close();
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'Independence run clean: the week in his voice from the counts on the phone (71%: phone 54%, library 17%; the cloud 29%, mostly live facts and long writing), the bar and the trend, the per cents add up; a cloud reply and the phone\'s own answer counted where they were answered; the REPORT CARD says the same; the brain given counts only, once; Sovereign Mode: a kept answer counted as the phone\'s, the one it could not give listed with why, nothing sent.');
process.exit(problems.length ? 1 : 0);
