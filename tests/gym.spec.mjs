// The GYM tab on an iPhone 13. The tab opens with a card for each of the twenty-two games; tic-tac-toe opens and
// TRAIN runs in the Web Worker while a timer on the page keeps ticking (no frozen screen); progress is
// measured, saved to IndexedDB, survives a reload and training carries on from it; PLAY HIM works on the
// tic-tac-toe and Connect 4 boards (he answers each move), and on the checkers, chess and Go boards with taps
// (a picked piece lights up its legal squares; Go marks the legal points and has PASS); WATCH plays a maze
// route frame by frame and draws the balancing run;
// Code Breaker cracks a code the owner picks. While a game trains, card taps still land and a finished
// WATCH stays on the board; an armed RESET does not carry over to another game; a game RESET while it
// trains does not come back (in the page or after a reload). The six reasoning games of part 2 open, have no
// PLAY HIM, and WATCH shows his reasoning as text; the network lab (the heaviest) trains without freezing
// the page. Nothing sticks out sideways at 390 px; the security policy blocks nothing (the worker is the
// app's own bundled worker file).
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
  window.__vis = [];
  document.addEventListener('visibilitychange', () => window.__vis.push(document.visibilityState));
  document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
});
// A slow phone: when asked, reading the saved games takes 3 s (to tap TRAIN before they are in).
await page.addInitScript(() => {
  if (!sessionStorage.getItem('gymslow')) return;
  const getAll = IDBObjectStore.prototype.getAll;
  IDBObjectStore.prototype.getAll = function (...a) {
    const r = getAll.apply(this, a);
    const slow = { result: undefined, onsuccess: null, onerror: null };
    r.onsuccess = () => setTimeout(() => ((slow.result = r.result), slow.onsuccess?.()), 3000);
    r.onerror = () => slow.onerror?.();
    return slow;
  };
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
// Part 1's ten games, then part 2's six reasoning games.
const NAMES = ['MAZE', 'CODE BREAKER', 'COLONY', 'TRUST TOURNAMENT', 'TIC-TAC-TOE', 'CONNECT 4', 'SLIDING TILES', 'SUDOKU', 'COUNTDOWN', 'WORD GUESS', 'LOGIC SANDBOX', 'MINI-BRAIN LAB', 'BUG HUNT', 'TEXT ESCAPE ROOMS', 'FACT-CHECK DUEL', 'DEBATE ARENA', 'CHECKERS', 'CHESS', 'GO 9×9', 'SIMPLE POKER', 'SOKOBAN', 'BALANCE & LANDER'];
const CARDS = NAMES.length;
/** The chat log is an overlay on phones: close it if it is open. */
const closeLog = async () => {
  if (await page.locator('#log.open, .log.open').count().catch(() => 0)) await page.click('.logbtn').catch(() => undefined);
};

// ---- the tab and its cards ----
await boot();
await until((c) => window.__ghosty?.gym?.cards === c, 15000, 'the GYM tab did not open with its game cards', CARDS);
await closeLog();
const n = await G('.gymcard').count();
if (n !== CARDS) problems.push(`the GYM shows ${n} game cards (want ${CARDS})`);
for (const name of NAMES) {
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
// (He may master every level and stop by himself before PAUSE — then there is nothing to pause.)
const saves = (await st()).saves;
if ((await st()).training) await G('button.gymtrain').dispatchEvent('click'); // PAUSE
await until(() => window.__ghosty?.gym?.training === '', 5000, 'PAUSE did not stop training');
await until((s) => window.__ghosty?.gym?.saves > s, 10000, 'pausing did not save', saves);
const before = (await st()).recs.tictactoe;
await page.waitForTimeout(500);

// ---- reload: what he learned is still there, and training carries on from it ----
await boot();
await until((c) => window.__ghosty?.gym?.cards === c, 15000, 'the GYM did not come back after a reload', CARDS);
await until((u) => (window.__ghosty?.gym?.recs?.tictactoe?.units ?? 0) >= u, 10000, `progress did not survive the reload (had ${before?.units} games)`, before?.units ?? 1);
const after = (await st()).recs.tictactoe;
if (after && before && (after.level !== before.level || Math.abs(after.mastery - before.mastery) > 1e-9)) problems.push(`after the reload the record changed: ${JSON.stringify(before)} → ${JSON.stringify(after)}`);
await closeLog();
await card('tictactoe').click();
if (!after?.mastered) {
  await G('button.gymtrain').click();
  await until((u) => (window.__ghosty?.gym?.recs?.tictactoe?.units ?? 0) > u + 500 || window.__ghosty.gym.recs.tictactoe?.mastered, 20000, 'training did not carry on after the reload', after?.units ?? 0);
  if ((await st()).training) await G('button.gymtrain').dispatchEvent('click');
  await until(() => window.__ghosty?.gym?.training === '', 5000, 'PAUSE did not stop training after the reload');
}

// ---- a TRAIN tapped before the saved games are read must not start him again from Level 1 ----
{
  const had = (await st()).recs.tictactoe;
  await page.evaluate(() => sessionStorage.setItem('gymslow', '1'));
  await boot();
  await until((c) => window.__ghosty?.gym?.cards === c, 15000, 'the GYM did not show its cards while still loading', CARDS);
  await closeLog();
  await card('tictactoe').click();
  if (!had?.mastered) {
    await G('button.gymtrain').click(); // within the 3 s the saved games take to arrive
    await page.waitForTimeout(5000);
    if ((await st()).training) await G('button.gymtrain').dispatchEvent('click');
    await until(() => window.__ghosty?.gym?.training === '', 5000, 'PAUSE did not stop training after a slow load');
    await page.waitForTimeout(800);
  }
  await page.evaluate(() => sessionStorage.removeItem('gymslow'));
  await boot();
  await until((c) => window.__ghosty?.gym?.cards === c, 15000, 'the GYM did not come back after the slow-load check', CARDS);
  await until((u) => (window.__ghosty?.gym?.recs?.tictactoe?.units ?? 0) >= u, 10000, `an early TRAIN wiped his saved progress (had ${had?.units} games)`, had?.units ?? 1);
  const now = (await st()).recs.tictactoe;
  if (had && now && now.level < had.level) problems.push(`an early TRAIN sent him back from Level ${had.level} to Level ${now.level}`);
  await closeLog();
  await card('tictactoe').click();
}

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

// ---- PLAY HIM on the bigger boards: checkers, chess, Go (taps; legal squares light up) ----
const cellAt = (i) => G('.gymboard button.gymcell').nth(i);
const lit = () => page.evaluate(() => [...document.querySelectorAll('#pg-gym .gymboard .gymcell.tgt')].length);
for (const [id, pick, to, label] of [
  // Checkers: Black's man on square 9 (row 3 from the top, b-file) → square 13 below it.
  ['checkers', 2 * 8 + 1, 3 * 8 + 2, 'checkers'],
  // Chess: the e2 pawn → e4.
  ['chess', 6 * 8 + 4, 4 * 8 + 4, 'chess'],
]) {
  await card(id).click();
  await until((x) => window.__ghosty?.gym?.open === x, 5000, `the ${id} card did not open`, id);
  await G('button', { hasText: 'PLAY HIM' }).click();
  await until((x) => window.__ghosty?.gym?.play?.game === x, 5000, `PLAY HIM did not start ${id}`, id);
  const cells = await G('.gymboard button.gymcell').count();
  if (cells !== 64) problems.push(`${id}: the board has ${cells} squares (want 64)`);
  const tiny = await page.evaluate(() => [...document.querySelectorAll('#pg-gym .gymboard .gymcell')].filter((b) => b.getBoundingClientRect().width < 34).length);
  if (tiny) problems.push(`${id}: ${tiny} squares are too small to tap`);
  await cellAt(pick).click();
  await until(() => document.querySelectorAll('#pg-gym .gymboard .gymcell.sel').length === 1, 5000, `${id}: tapping a piece did not pick it`);
  const targets = await lit();
  if (targets < 1) problems.push(`${id}: no legal squares lit after picking a piece`);
  if (!(await cellAt(to).evaluate((e) => e.classList.contains('tgt')))) problems.push(`${id}: the square I want is not lit as legal`);
  await page.evaluate(() => (window.__ghosty.gym.play.replies = 0));
  await cellAt(to).click();
  await until(() => (window.__ghosty.gym.play.replies ?? 0) >= 1 || /He played/.test(document.querySelector('#pg-gym .gymboard .gymcap')?.textContent ?? ''), 30000, `he did not answer my ${id} move`);
  await wideCheck(`playing ${id}`);
  await page.screenshot({ path: `${out}/gym-${id}.png` });
}
// Go: legal points are marked; tap the centre; he answers; PASS is there.
await card('go').click();
await until(() => window.__ghosty?.gym?.open === 'go', 5000, 'the Go card did not open');
await G('button', { hasText: 'PLAY HIM' }).click();
await until(() => window.__ghosty?.gym?.play?.game === 'go', 5000, 'PLAY HIM did not start Go');
if ((await G('.gymboard button.gymcell').count()) !== 81) problems.push('Go: the board is not 9×9');
if ((await lit()) < 81) problems.push(`Go: only ${await lit()} legal points marked on an empty board`);
await cellAt(40).click();
await until(() => window.__ghosty.gym.play.board.filter((x) => x === 2).length >= 1, 30000, 'he did not answer my Go move');
if (!(await cellAt(40).evaluate((e) => e.classList.contains('bs')))) problems.push('Go: my stone is not on the centre point');
if (!(await G('.gymboard button', { hasText: 'PASS' }).count())) problems.push('Go: no PASS button');
// A second move: his record went to the worker once for this game, not with every move.
const free2 = await page.evaluate(() => window.__ghosty.gym.play.board.findIndex((x, i) => x === 0 && i !== 40 && i % 9 > 0 && i % 9 < 8 && i > 9 && i < 71));
await cellAt(free2).click();
await until(() => window.__ghosty.gym.play.board.filter((x) => x === 2).length >= 2 || !!window.__ghosty.gym.play.over, 30000, 'he did not answer my second Go move');
const handed = await page.evaluate(() => window.__ghosty.gym.handed.go ?? 0);
if (handed > 1) problems.push(`Go: his whole record went to the worker ${handed} times (once is enough)`);
await wideCheck('playing Go');
await page.screenshot({ path: `${out}/gym-go.png` });

// ---- WATCH draws the balancing run ----
await card('balance').click();
await G('button', { hasText: 'WATCH' }).click();
await until(() => window.__ghosty?.gym?.frames >= 3 && !!document.querySelector('#pg-gym .gymboard svg.gymdraw'), 15000, 'WATCH did not draw the cart and pole');
await wideCheck('watching the balance run');

// ---- WATCH: a maze route, frame by frame ----
await card('maze').click();
await page.evaluate(() => (window.__ghosty.gym.frames = 0)); // (the balance run before counted frames too)
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

// ---- while training: card taps are never lost to a repaint, and a finished WATCH stays on the board ----
// (Connect 4: it learns slowly, so it is still training throughout.)
await card('connect4').click();
await G('button.gymtrain').click();
await until(() => window.__ghosty?.gym?.training === 'connect4', 5000, 'TRAIN did not start (second time)');
const cardEl = await card('maze').elementHandle();
await until((n) => window.__ghosty.gym.progress >= n + 2, 15000, 'no progress while training (second time)', (await st()).progress);
if (!(await cardEl.evaluate((e) => e.isConnected))) problems.push('the game cards were rebuilt by a progress repaint (a tap in flight would be lost)');
for (const id of ['maze', 'colony', 'tiles', 'connect4']) {
  await card(id).click();
  const ok = await until((x) => window.__ghosty.gym.open === x, 1500, `tapping the ${id} card while training did not open it`, id);
  if (!ok) break;
}
await G('button', { hasText: 'WATCH' }).click();
await until(() => window.__ghosty.gym.watching, 20000, 'WATCH during training did not start');
await until(() => !window.__ghosty.gym.watching, 45000, 'WATCH during training did not finish'); // up to 42 moves at 0.45 s each
const lastCap = await G('.gymboard .gymcap').innerText();
const progressThen = (await st()).progress;
// (If he masters the last level meanwhile, training ends by itself and no more repaints come — nothing to check.)
if (!(await until((n) => window.__ghosty.gym.progress >= n + 2 || window.__ghosty.gym.recs.connect4?.mastered, 20000, 'no progress after WATCH', progressThen))) problems.push(`(state then: ${JSON.stringify({ ...(await st()), recs: undefined })}, log: ${(await st()).log.join(' | ')})`);
const capNow = await G('.gymboard .gymcap').innerText().catch(() => '');
if (capNow !== lastCap) problems.push(`the finished WATCH was replaced by a repaint: "${lastCap}" → "${capNow}"`);
// (A level-up toast may sit over the button while it trains: press it directly.)
if ((await st()).training) await G('button.gymtrain').dispatchEvent('click');
await until(() => window.__ghosty?.gym?.training === '', 5000, 'PAUSE did not stop (second time)');

// ---- RESET: two taps; one tap does not carry over to another game ----
await card('codebreaker').click();
await G('button', { hasText: 'RESET' }).click();
if (!/SURE/.test(await G('.gymactions button.warn').innerText())) problems.push('one tap on RESET did not ask "SURE?"');
await card('maze').click();
if ((await G('.gymactions button.warn').innerText()).trim() !== 'RESET') problems.push('the armed RESET carried over to another game');

// ---- RESET while training: the wiped game does not come back (messages in flight are dropped) ----
await G('button.gymtrain').click();
await until(() => (window.__ghosty?.gym?.recs?.maze?.units ?? 0) > 0, 15000, 'maze did not train');
await G('.gymactions button.warn').click();
await G('.gymactions button.warn').click();
await page.waitForTimeout(3500);
const afterReset = await st();
if (afterReset.recs.maze) problems.push(`the reset maze came back: ${JSON.stringify(afterReset.recs.maze)}`);
if ((await card('maze').locator('.gymst').innerText()).trim() !== 'NEW') problems.push('the reset maze card does not say NEW');
await boot();
await until((c) => window.__ghosty?.gym?.cards === c, 15000, 'the GYM did not come back after the reset reload', CARDS);
await page.waitForTimeout(1000);
if ((await st()).recs.maze) problems.push('the reset maze came back after a reload');
await closeLog();

// ---- part 2: the six reasoning games — WATCH shows his reasoning as text; nothing sideways ----
for (const id of ['logic', 'brain', 'bughunt', 'escape', 'factcheck', 'debate']) {
  await card(id).click();
  if (!(await until((x) => window.__ghosty.gym.open === x, 3000, `the ${id} card did not open`, id))) continue;
  const acts = await G('.gymactions button:visible').allInnerTexts();
  for (const want of ['TRAIN', 'WATCH', 'RESET']) if (!acts.some((b) => b.trim() === want)) problems.push(`${id} has no ${want} button`);
  if (acts.some((b) => b.trim() === 'PLAY HIM')) problems.push(`${id} shows PLAY HIM (not a board game)`);
  await page.evaluate(() => (window.__ghosty.gym.frames = 0));
  await G('button', { hasText: 'WATCH' }).click();
  await until(() => window.__ghosty.gym.frames >= 2, 20000, `WATCH did not play ${id}`);
  const text = await G('.gymboard').innerText();
  if (text.length < 60 || /undefined|NaN/.test(text)) problems.push(`${id}: WATCH shows "${text.slice(0, 120)}"`);
  // Program listings and transcripts keep their indentation.
  const ws = await page.evaluate(() => { const e = document.querySelector('#pg-gym .gymboard .gymlines'); return e ? getComputedStyle(e).whiteSpace : 'none'; });
  if (ws !== 'pre-wrap') problems.push(`${id}: WATCH text does not keep its indentation (white-space: ${ws})`);
  await wideCheck(`watching ${id}`);
  await page.screenshot({ path: `${out}/gym-${id}.png` });
}
// The heaviest one, the network lab, trains in the worker without freezing the page.
await card('brain').click();
await page.evaluate(() => {
  window.__ticks2 = [];
  window.__tick2 = setInterval(() => window.__ticks2.push(performance.now()), 50);
});
await G('button.gymtrain').click();
await until(() => window.__ghosty?.gym?.training === 'brain', 5000, 'TRAIN did not start the network lab');
await until(() => (window.__ghosty?.gym?.recs?.brain?.units ?? 0) > 20, 30000, 'the network lab made no progress in the worker');
const gap2 = await page.evaluate(() => {
  const t = window.__ticks2;
  clearInterval(window.__tick2);
  let worst = 0;
  for (let i = 1; i < t.length; i++) worst = Math.max(worst, t[i] - t[i - 1]);
  return { worst: Math.round(worst), n: t.length };
});
if (gap2.n < 20 || gap2.worst > 500) problems.push(`the page froze while the network lab trained: ${gap2.n} ticks, longest gap ${gap2.worst} ms`);
const st2 = await G('.gymstatus').innerText();
if (!/^(Learning… [\d,]+ networks · Level \d+ · mastery \d+% → \d+%|Mastered all 10 levels.*)$/.test(st2)) problems.push(`the network lab's status line reads "${st2}"`);
await wideCheck('training the network lab');
if ((await st()).training) await G('button.gymtrain').dispatchEvent('click');
await until(() => window.__ghosty?.gym?.training === '', 5000, 'PAUSE did not stop the network lab');

const csp = await page.evaluate(() => window.__csp);
if (csp.length) problems.push(`security policy blocked: ${csp.join(' | ')}`);
await page.evaluate(() => clearInterval(window.__tick));
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${[...new Set(problems)].join('\n')}` : `GYM run clean in ${engine}: ${CARDS} cards, training in the worker (longest page pause ${gap.worst} ms), saved and carried on after a reload, PLAY HIM on tic-tac-toe, Connect 4, checkers, chess and Go (legal squares lit), WATCH (maze, the drawn balance run), a code cracked; WATCH as text for the six reasoning games and the network lab trained without a freeze (longest pause ${gap2.worst} ms); card taps and a finished WATCH survive progress repaints, RESET does not carry over and a reset game stays reset.`);
process.exit(problems.length ? 1 : 0);
