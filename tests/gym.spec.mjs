// The GYM tab on an iPhone 13. The tab opens with a card for each of the ten games; tic-tac-toe opens and
// TRAIN runs in the Web Worker while a timer on the page keeps ticking (no frozen screen); progress is
// measured, saved to IndexedDB, survives a reload and training carries on from it; PLAY HIM works on the
// tic-tac-toe and Connect 4 boards (he answers each move); WATCH plays a maze route frame by frame;
// Code Breaker cracks a code the owner picks. Nothing sticks out sideways at 390 px; the security policy
// blocks nothing (the worker is the app's own bundled worker file).
//   BASE=http://localhost:8872 node tests/gym.spec.mjs /tmp/gym-shots          (Chromium)
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/wk/browsers BROWSER=webkit BASE=… node tests/gym.spec.mjs …   (WebKit)
import { launch, webkitNoise, engine } from './browser.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const problems = [];
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: engine !== 'webkit' ? true : undefined,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
const page = await ctx.newPage();
page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' && !/favicon|net::ERR|404|Failed to load resource|^[WI]\d{4} |^INFO:/.test(t)) problems.push(`console: ${t.slice(0, 200)}`);
});
await page.addInitScript(() => {
  window.__csp = [];
  document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
});

const boot = async () => {
  await page.goto(base);
  if (await page.locator('#pair input').isVisible().catch(() => false)) {
    await page.fill('#pair input', 'preview-owner-key-0123456789');
    await page.click('#pair button.on');
  }
  await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
  await page.evaluate(() => (location.hash = 'gym'));
};
const st = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__ghosty?.gym ?? null)));
const until = (fn, ms, what, arg = null) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => { problems.push(what); return false; });
const G = (sel, opts) => page.locator(`#pg-gym ${sel}`, opts);
const wideCheck = async (where) => {
  const wide = await page.evaluate(() => {
    const W = window.innerWidth;
    const over = [...document.querySelectorAll('#pg-gym *')].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width && r.right > W + 1 && getComputedStyle(e).position !== 'fixed';
    });
    return { page: document.documentElement.scrollWidth > W + 1, over: over.slice(0, 3).map((e) => `${e.tagName}.${e.className}`) };
  });
  if (wide.page || wide.over.length) problems.push(`${where}: something sticks out sideways (${wide.over.join(', ') || 'page'})`);
};
const card = (id) => G(`.gymcard[data-game="${id}"]`);
/** The chat log is an overlay on phones: close it if it is open. */
const closeLog = async () => {
  if (await page.locator('#log.open, .log.open').count().catch(() => 0)) await page.click('.logbtn').catch(() => undefined);
};

// ---- the tab and its cards ----
await boot();
await until(() => window.__ghosty?.gym?.cards === 10, 15000, 'the GYM tab did not open with its game cards');
await closeLog();
const n = await G('.gymcard').count();
if (n !== 10) problems.push(`the GYM shows ${n} game cards (want 10)`);
for (const name of ['MAZE', 'CODE BREAKER', 'COLONY', 'TRUST TOURNAMENT', 'TIC-TAC-TOE', 'CONNECT 4', 'SLIDING TILES', 'SUDOKU', 'COUNTDOWN', 'WORD GUESS']) {
  if (!(await G('.gymcard .gymname', { hasText: name }).count()) && !(await page.locator(`#pg-gym .gymcard:has-text("${name}")`).count())) problems.push(`no card for ${name}`);
}
await wideCheck('the game cards');
await page.screenshot({ path: `${out}/gym-cards.png` });

// ---- tic-tac-toe: TRAIN in the worker while the page keeps ticking ----
await card('tictactoe').click();
await until(() => window.__ghosty?.gym?.open === 'tictactoe', 5000, 'tapping the tic-tac-toe card did not open it');
const btns = await G('.gymactions button:visible').allInnerTexts();
for (const want of ['TRAIN', 'WATCH', 'PLAY HIM', 'RESET']) if (!btns.some((b) => b.trim() === want)) problems.push(`tic-tac-toe has no ${want} button (has ${btns.join(', ')})`);
const small = await page.evaluate(() => [...document.querySelectorAll('#pg-gym .gymactions button')].filter((b) => b.offsetParent && b.getBoundingClientRect().height < 40).length);
if (small) problems.push(`${small} GYM buttons are shorter than 40 px`);
await page.evaluate(() => {
  window.__ticks = [];
  window.__tick = setInterval(() => window.__ticks.push(performance.now()), 50);
});
await G('button.gymtrain').click();
await until(() => window.__ghosty?.gym?.training === 'tictactoe', 5000, 'TRAIN did not start training');
await until(() => (window.__ghosty?.gym?.recs?.tictactoe?.units ?? 0) > 2000 && window.__ghosty.gym.progress >= 3, 30000, 'training made no progress in the worker');
await until(() => window.__ghosty?.gym?.saves >= 1, 20000, 'training progress was never saved');
const gap = await page.evaluate(() => {
  const t = window.__ticks;
  let worst = 0;
  for (let i = 1; i < t.length; i++) worst = Math.max(worst, t[i] - t[i - 1]);
  return { worst: Math.round(worst), n: t.length };
});
if (gap.n < 20 || gap.worst > 500) problems.push(`the page froze while training: the timer ticked ${gap.n} times, longest gap ${gap.worst} ms`);
const status = await G('.gymstatus').innerText();
if (!/^Learning… [\d,]+ games · Level \d+ · mastery \d+% → \d+%$/.test(status)) problems.push(`the status line reads "${status}"`);
if (!(await G('.gymgraph polyline').count())) problems.push('no progress graph');
await page.screenshot({ path: `${out}/gym-training.png` });
await G('button.gymtrain').click(); // PAUSE
await until(() => window.__ghosty?.gym?.training === '', 5000, 'PAUSE did not stop training');
const saves = (await st()).saves;
await until((s) => window.__ghosty?.gym?.saves > s, 10000, 'pausing did not save', saves);
const before = (await st()).recs.tictactoe;
await page.waitForTimeout(500);

// ---- reload: what he learned is still there, and training carries on from it ----
await boot();
await until(() => window.__ghosty?.gym?.cards === 10, 15000, 'the GYM did not come back after a reload');
await until((u) => (window.__ghosty?.gym?.recs?.tictactoe?.units ?? 0) >= u, 10000, `progress did not survive the reload (had ${before?.units} games)`, before?.units ?? 1);
const after = (await st()).recs.tictactoe;
if (after && before && (after.level !== before.level || Math.abs(after.mastery - before.mastery) > 1e-9)) problems.push(`after the reload the record changed: ${JSON.stringify(before)} → ${JSON.stringify(after)}`);
await closeLog();
await card('tictactoe').click();
await G('button.gymtrain').click();
await until((u) => (window.__ghosty?.gym?.recs?.tictactoe?.units ?? 0) > u + 500, 20000, 'training did not carry on after the reload', after?.units ?? 0);
await G('button.gymtrain').click();
await until(() => window.__ghosty?.gym?.training === '', 5000, 'PAUSE did not stop training after the reload');

// ---- PLAY HIM: tic-tac-toe ----
await G('button', { hasText: 'PLAY HIM' }).click();
await until(() => window.__ghosty?.gym?.play?.game === 'tictactoe', 5000, 'PLAY HIM did not start a tic-tac-toe game');
await G('.gymboard button.gymcell').nth(4).click();
await until(() => window.__ghosty.gym.play.board.includes(2), 10000, 'he did not answer my tic-tac-toe move');
const tb = (await st()).play.board;
if (tb[4] !== 1) problems.push(`my X is not in the centre: ${tb.join('')}`);
const free = tb.findIndex((x) => !x);
await G('.gymboard button.gymcell').nth(free).click();
await until(() => window.__ghosty.gym.play.board.filter((x) => x === 2).length >= 2 || !!window.__ghosty.gym.play.over, 10000, 'he did not answer my second tic-tac-toe move');
await wideCheck('playing tic-tac-toe');
await page.screenshot({ path: `${out}/gym-ttt.png` });

// ---- PLAY HIM: Connect 4 ----
await card('connect4').click();
await until(() => window.__ghosty?.gym?.open === 'connect4', 5000, 'the Connect 4 card did not open');
await G('button', { hasText: 'PLAY HIM' }).click();
await until(() => window.__ghosty?.gym?.play?.game === 'connect4', 5000, 'PLAY HIM did not start Connect 4');
await G('.gymboard button.gymcell').nth(3).click(); // top row, column 4: drops to the bottom
await until(() => window.__ghosty.gym.play.board.includes(2), 20000, 'he did not answer my Connect 4 move');
const cb = (await st()).play.board;
if (cb[3 * 6] !== 1) problems.push('my Connect 4 stone did not drop to the bottom of column 4');
await wideCheck('playing Connect 4');
await page.screenshot({ path: `${out}/gym-c4.png` });

// ---- WATCH: a maze route, frame by frame ----
await card('maze').click();
await G('button', { hasText: 'WATCH' }).click();
await until(() => window.__ghosty?.gym?.frames >= 2, 15000, 'WATCH did not play his maze route');
if (!(await G('.gymboard .gymcell.me').count()) && !(await G('.gymboard .gymcell').count())) problems.push('WATCH shows no maze');
await wideCheck('watching the maze');

// ---- PLAY HIM: Code Breaker cracks the owner's code ----
await card('codebreaker').click();
await G('button', { hasText: 'PLAY HIM' }).click();
await G('.gymsecret input').fill('12');
await G('.gymsecret button').click();
await until(() => /Cracked 12 in/.test(document.querySelector('#pg-gym .gymboard')?.textContent ?? ''), 20000, 'Code Breaker did not crack my code 12');
const fs = await page.evaluate(() => getComputedStyle(document.querySelector('#pg-gym .gymsecret input')).fontSize);
if (fs !== '16px') problems.push(`the secret box is ${fs} (16 px stops iPhone zooming in)`);
await wideCheck('Code Breaker');
await page.screenshot({ path: `${out}/gym-code.png` });

const csp = await page.evaluate(() => window.__csp);
if (csp.length) problems.push(`security policy blocked: ${csp.join(' | ')}`);
await page.evaluate(() => clearInterval(window.__tick));
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${[...new Set(problems)].join('\n')}` : `GYM run clean in ${engine}: 10 cards, training in the worker (longest page pause ${gap.worst} ms), saved and carried on after a reload, PLAY HIM on both boards, WATCH, and a code cracked.`);
process.exit(problems.length ? 1 : 0);
