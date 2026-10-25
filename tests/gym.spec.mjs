// The GYM tab on the owner's iPhone 18 Pro Max (440 × 956). The tab opens with a card for each of the twenty-two games; tic-tac-toe opens and
// TRAIN runs in the Web Worker while a timer on the page keeps ticking (no frozen screen); progress is
// measured, saved to IndexedDB, survives a reload and training carries on from it; PLAY HIM works on the
// tic-tac-toe and Connect 4 boards (he answers each move), and on the checkers, chess and Go boards with taps
// (a picked piece lights up its legal squares; Go marks the legal points and has PASS); WATCH plays a maze
// route frame by frame and draws the balancing run;
// Code Breaker cracks a code the owner picks. While a game trains, card taps still land and a finished
// WATCH stays on the board; an armed RESET does not carry over to another game; a game RESET while it
// trains does not come back (in the page or after a reload). The six reasoning games of part 2 open, have no
// PLAY HIM, and WATCH shows his reasoning as text; the network lab (the heaviest) trains without freezing
// the page. Nothing sticks out sideways at 440 px (nor, at the end, at a narrow 390 px); the security policy blocks nothing (the worker is the
// app's own bundled worker file).
// Part 3: WATCH on the maze at Level 1 reaches Level 2 by itself and
// goes on watching, with one GYM toast on screen; STOP ends it; TRAIN ALL starts with the least learned game
// and its line names it; KEEP AWAKE (a mocked wake lock) is asked for, asked for again after the app is
// hidden and shown, and let go on STOP; a reload shows where TRAIN ALL got to; nothing sticks out at 440 px.
// GYM ideas: a maze whose puzzles at his edge stand at Level 7½ says so, and TRAIN makes him try one more there;
// tic-tac-toe's new versions meet his past selves and his rating shows on the card and the game's page.
//   BASE=http://localhost:8872 node tests/gym.spec.mjs /tmp/gym-shots          (Chromium)
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/wk/browsers BROWSER=webkit BASE=… node tests/gym.spec.mjs …   (WebKit)
import { launch, webkitNoise, engine } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const problems = [];
const ctx = await browser.newContext({
  viewport: PHONE,
  ...UK,
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
  // (the pairing screen or the app, whichever comes first: a slow machine shows the pairing screen late)
  await page.waitForFunction(() => !!document.querySelector('#pair input') || !document.querySelector('#boot'), null, { timeout: 20000 }).catch(() => undefined);
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
    // (a card on another page of the games' sideways strip is off screen on purpose: the strip itself must fit)
    const inStrip = (e) => {
      for (let p = e.parentElement; p; p = p.parentElement) if (/(auto|scroll)/.test(getComputedStyle(p).overflowX) && p.getBoundingClientRect().right <= W + 1 && p.getBoundingClientRect().left >= -1 && p.matches('.gymcards')) return true;
      return false;
    };
    const over = [...document.querySelectorAll('#pg-gym *')].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width && r.right > W + 1 && getComputedStyle(e).position !== 'fixed' && !inStrip(e);
    });
    return { page: document.documentElement.scrollWidth > W + 1, over: over.slice(0, 3).map((e) => `${e.tagName}.${e.className}`) };
  });
  if (wide.page || wide.over.length) problems.push(`${where}: something sticks out sideways (${wide.over.join(', ') || 'page'})`);
};
const card = (id) => G(`.gymcard[data-game="${id}"]`);
// On a phone a game opens as its own screen ("‹ Gym" back to the cards).
const tap = async (id) => {
  if (await page.locator('#pg-gym.gympush').count()) await page.click('#top .navback');
  await card(id).click();
};
// The game's actions as the owner can reach them: the buttons shown, and RESET in the "…" menu.
const actions = async () => {
  const l = await G('.gymactions > button:visible').allInnerTexts();
  l.push(...(await G('.gymmenu button.warn').allTextContents()));
  return [...new Set(l.map((b) => b.trim().toUpperCase()))];
};
/** RESET the open game: the "…" menu is its own confirmation. */
const resetGame = async () => {
  await G('.gymmore').click();
  await G('.gymmenu button.warn').click();
};
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

// ---- the cards in pages of six (the navigation sheet, BRIEF-NAV-BOOT 1): two columns and three rows a page, one swipe a
// page (scroll-snap), the dots under them as tap targets, and the GYM opens on the page of the game played last.
// (Fails on the old GYM: 22 cards in one long column, no dots.)
/** Which cards show on screen now, and how: two columns and three rows of the six of one page. */
const onScreen = () => page.evaluate(() => {
  const strip = document.querySelector('#pg-gym .gymcards');
  const s = strip?.getBoundingClientRect();
  if (!s) return null;
  const cards = [...strip.querySelectorAll('.gymcard')].map((b) => ({ id: b.dataset.game, r: b.getBoundingClientRect() }))
    .filter((c) => c.r.left >= s.left - 1 && c.r.right <= s.right + 1);
  const xs = [...new Set(cards.map((c) => Math.round(c.r.left)))];
  const ys = [...new Set(cards.map((c) => Math.round(c.r.top)))];
  return { ids: cards.map((c) => c.id), cols: xs.length, rows: ys.length, page: window.__ghosty?.gym?.page, dots: [...document.querySelectorAll('#pg-gym .gymdot')].map((d) => ({ on: d.classList.contains('on'), w: Math.round(d.getBoundingClientRect().width), h: Math.round(d.getBoundingClientRect().height) })), word: document.querySelector('#pg-gym .gympgw')?.textContent ?? '' };
});
const IDS = await page.$$eval('#pg-gym .gymcard', (bs) => bs.map((b) => b.dataset.game));
const wantPage = (p) => IDS.slice(p * 6, p * 6 + 6).join(',');
let pg = await onScreen();
if (!pg) problems.push('pages of six: no strip of game cards');
else {
  if (pg.ids.join(',') !== wantPage(0) || pg.cols !== 2 || pg.rows !== 3) problems.push(`pages of six: the first page shows ${pg.ids.length} cards in ${pg.cols} columns and ${pg.rows} rows (${pg.ids.join(', ')})`);
  if (pg.dots.length !== Math.ceil(CARDS / 6)) problems.push(`pages of six: ${pg.dots.length} dots for ${CARDS} games`);
  if (pg.dots.some((d) => d.w < 44 || d.h < 44)) problems.push(`pages of six: a dot's target is under 44 pt: ${JSON.stringify(pg.dots)}`);
  if (!pg.dots[0]?.on || pg.word !== `Games 1–6 of ${CARDS}`) problems.push(`pages of six: the first page's dot and words: ${JSON.stringify(pg)}`);
}
// a tap on the third dot shows the third page
await G('.gymdot').nth(2).click({ timeout: 5000 }).catch(() => problems.push('pages of six: no third dot to tap'));
// (the strip glides there: give a busy machine time to finish the glide)
await page.waitForFunction(() => { const c = document.querySelector('#pg-gym .gymcards'); return c && Math.abs(c.scrollLeft - 2 * c.clientWidth) < 2; }, null, { timeout: 4000 }).catch(() => undefined);
await page.waitForTimeout(200);
pg = await onScreen();
if (pg?.ids.join(',') !== wantPage(2) || !pg.dots[2]?.on || pg.page !== 2) problems.push(`the third dot did not show games 13–18: ${JSON.stringify(pg)}`);
await wideCheck('the third page of games');
await page.screenshot({ path: `${out}/gym-page3.png` });
// a finger swipe from right to left shows the next page, and only the next (Chromium's touch screen; WebKit has none)
if (engine !== 'webkit') {
  const box = await G('.gymcards').boundingBox();
  const cdp = await ctx.newCDPSession(page);
  const y = Math.round(box.y + 90);
  const finger = async (from, to) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from, y }] });
    for (let i = 1; i <= 10; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: Math.round(from + ((to - from) * i) / 10), y }] });
      await page.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(900);
  };
  await finger(Math.round(box.x + box.width - 40), Math.round(box.x + 60));
  pg = await onScreen();
  if (pg?.ids.join(',') !== wantPage(3) || !pg.dots[3]?.on) problems.push(`a swipe left from the third page did not land on the fourth: ${JSON.stringify(pg)}`);
  await finger(Math.round(box.x + 60), Math.round(box.x + box.width - 40));
  pg = await onScreen();
  if (pg?.ids.join(',') !== wantPage(2)) problems.push(`a swipe right did not go back one page: ${JSON.stringify(pg)}`);
  await cdp.detach();
}
// the GYM opens on the page of the game played last: Sokoban (page 4) tapped, then Home and back to the GYM
await tap('sokoban');
await until(() => window.__ghosty?.gym?.open === 'sokoban', 5000, 'tapping the Sokoban card did not open it');
await page.click('#top .navback');
await page.waitForTimeout(500);
await G('.gymdot').first().click({ timeout: 5000 }).catch(() => undefined);
await page.evaluate(() => (location.hash = 'core'));
await page.waitForTimeout(600);
await page.evaluate(() => (location.hash = 'gym'));
await page.waitForTimeout(900);
pg = await onScreen();
const soko = Math.floor(IDS.indexOf('sokoban') / 6);
if (pg?.page !== soko || !pg.ids.includes('sokoban')) problems.push(`the GYM did not open on the page of the game played last (Sokoban, page ${soko + 1}): ${JSON.stringify(pg)}`);
await G('.gymdot').first().click({ timeout: 5000 }).catch(() => undefined);
await page.waitForTimeout(700);

// ---- tic-tac-toe: TRAIN in the worker while the page keeps ticking ----
await tap('tictactoe');
await until(() => window.__ghosty?.gym?.open === 'tictactoe', 5000, 'tapping the tic-tac-toe card did not open it');
const btns = await actions(); // compared without case: labels show in sentence case
for (const want of ['TRAIN', 'WATCH', 'PLAY HIM', 'RESET']) if (!btns.some((b) => b.trim() === want)) problems.push(`tic-tac-toe has no ${want} button (has ${btns.join(', ')})`);
const small = await page.evaluate(() => [...document.querySelectorAll('#pg-gym .gymactions > button')].filter((b) => b.offsetParent && b.getBoundingClientRect().height < 40).length);
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
// the page holding the game in training carries the small training dot (tic-tac-toe: the first page), and no other
const trainDots = await page.$$eval('#pg-gym .gymdot.train', (ds) => ds.map((d) => `${d.dataset.page} ${d.getAttribute('aria-label')}`));
if (trainDots.length !== 1 || !/^0 Games 1 to 6, Tic-tac-toe training$/.test(trainDots[0] ?? '')) problems.push(`the training dot: ${JSON.stringify(trainDots)} (want the first page's, naming Tic-tac-toe)`);
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
await tap('tictactoe');
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
  await tap('tictactoe');
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
  await tap('tictactoe');
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
await tap('connect4');
await until(() => window.__ghosty?.gym?.open === 'connect4', 5000, 'the Connect 4 card did not open');
await G('button', { hasText: 'PLAY HIM' }).click();
await until(() => window.__ghosty?.gym?.play?.game === 'connect4', 5000, 'PLAY HIM did not start Connect 4');
await G('.gymboard button.gymcell').nth(3).click(); // top row, column 4: drops to the bottom
await until(() => window.__ghosty.gym.play.board.includes(2), 20000, 'he did not answer my Connect 4 move');
const cb = (await st()).play.board;
if (cb[3 * 6] !== 1) problems.push('my Connect 4 stone did not drop to the bottom of column 4');
await wideCheck('playing Connect 4');
await page.screenshot({ path: `${out}/gym-c4.png` });

// ---- PLAY HIM at full strength (gym2, OWNER-ISSUES 52): the trick sequences that beat the old PLAY HIM every time ----
// The owner (X) plays these columns, taking a four whenever there is one; after the list, a plain player (block a four,
// else the most central column that hands none over). Played against the engine in the worker, as PLAY HIM asks it, on a
// fresh Connect 4 (no training at all: the old PLAY HIM lost every one of these by the 7th or 9th stone). Each must now
// end without the owner winning, every move of his with a reason. (Fails on the old code: X wins all four.)
const TRICKS = [[4, 2, 3, 5], [4, 3, 5, 2], [4, 5, 3, 2], [4, 5, 6, 3]];
const trickRuns = await page.evaluate(async (tricks) => {
  const w = new Worker('/textures.worker.js');
  let req = 900000;
  const waiting = new Map();
  w.onmessage = (e) => {
    const m = e.data;
    if (m?.gym === 'reply') (waiting.get(m.req)?.(m), waiting.delete(m.req));
  };
  const ask = (board) => new Promise((ok) => {
    const id = ++req;
    waiting.set(id, ok);
    w.postMessage({ gym: 'move', id: 'connect4', req: id, board, rec: null, epoch: 0 });
  });
  const LINES = [];
  for (let c = 0; c < 7; c++) for (let r = 0; r < 6; r++) for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    if (c + 3 * dc > 6 || r + 3 * dr < 0 || r + 3 * dr > 5) continue;
    LINES.push([0, 1, 2, 3].map((k) => (c + k * dc) * 6 + r + k * dr));
  }
  const won = (b, who) => LINES.some((l) => l.every((s) => b[s] === who));
  const height = (b, c) => { let r = 0; while (r < 6 && b[c * 6 + r]) r++; return r; };
  const drop = (b, c, who) => { const q = b.slice(); q[c * 6 + height(b, c)] = who; return q; };
  const legalCols = (b) => [3, 2, 4, 1, 5, 0, 6].filter((c) => height(b, c) < 6);
  const out = [];
  for (const xs of tricks) {
    let b = new Array(42).fill(0);
    const why = [];
    let res = '';
    let slowest = 0;
    for (let i = 0; i < 21 && !res; i++) {
      const ms = legalCols(b);
      let c = ms.find((x) => won(drop(b, x, 1), 1));
      if (c == null && i < xs.length && height(b, xs[i] - 1) < 6) c = xs[i] - 1;
      if (c == null) c = ms.find((x) => won(drop(b, x, 2), 2));
      if (c == null) c = ms.find((x) => !legalCols(drop(b, x, 1)).some((y) => won(drop(drop(b, x, 1), y, 2), 2))) ?? ms[0];
      b = drop(b, c, 1);
      if (won(b, 1)) { res = 'X'; break; }
      if (b.every((x) => x)) { res = 'D'; break; }
      const t = performance.now();
      const m = await ask(b);
      slowest = Math.max(slowest, performance.now() - t);
      if (m.error || m.move == null || m.move < 0) { res = `error ${m.error ?? m.move}`; break; }
      why.push(m.why?.reason ?? '');
      b = drop(b, m.move, 2);
      if (won(b, 2)) res = 'O';
      else if (b.every((x) => x)) res = 'D';
    }
    out.push({ xs: xs.join(''), res, why, slowest: Math.round(slowest) });
  }
  w.terminate();
  return out;
}, TRICKS);
for (const t of trickRuns) {
  if (t.res === 'X') problems.push(`PLAY HIM lost to the trick ${t.xs} (the owner won): ${t.why.join(' | ')}`);
  else if (t.res !== 'O' && t.res !== 'D') problems.push(`PLAY HIM did not finish the trick ${t.xs}: ${t.res}`);
  if (t.why.some((w) => !w)) problems.push(`PLAY HIM gave a move without a reason in the trick ${t.xs}: ${t.why.join(' | ')}`);
}
console.log(`tricks against PLAY HIM in the worker: ${trickRuns.map((t) => `${t.xs} → ${t.res === 'O' ? 'he won' : t.res === 'D' ? 'a draw' : t.res} (slowest move ${t.slowest} ms)`).join('; ')}`);
// (Every game played on the board is kept in his journal and may teach him: the games here are the spec's, so Connect 4's
// record and the journal are kept aside now and put back after the learning section below.)
// (kept in the same store under an id no game has, so typed arrays survive and a reload does not lose it)
const C4SNAP = '~spec-c4';
const snapshotC4 = () => page.evaluate((key) => new Promise((ok) => {
  const r = indexedDB.open('ghosty-gym', 1);
  r.onsuccess = () => {
    const tx = r.result.transaction('games', 'readwrite');
    const st = tx.objectStore('games');
    const j = st.get('~journal');
    const c = st.get('connect4');
    c.onsuccess = () => st.put({ id: key, journal: j.result ?? null, rec: c.result ?? null });
    tx.oncomplete = () => (r.result.close(), ok(true));
    tx.onerror = () => (r.result.close(), ok(false));
  };
  r.onerror = () => ok(false);
}), C4SNAP);
/** Put Connect 4's record and the journal back from the copy (and drop the copy with `drop`). */
const restoreC4 = (drop) => page.evaluate(([key, dropIt]) => new Promise((ok) => {
  const r = indexedDB.open('ghosty-gym', 1);
  r.onsuccess = () => {
    const tx = r.result.transaction('games', 'readwrite');
    const st = tx.objectStore('games');
    const g = st.get(key);
    g.onsuccess = () => {
      const snap = g.result;
      if (!snap) return;
      if (snap.journal) st.put(snap.journal);
      else st.delete('~journal');
      if (snap.rec) st.put(snap.rec);
      else st.delete('connect4');
      if (dropIt) st.delete(key);
    };
    tx.oncomplete = () => (r.result.close(), ok(true));
    tx.onerror = () => (r.result.close(), ok(false));
  };
  r.onerror = () => ok(false);
}), [C4SNAP, drop]);
/** The journal's last look moved back `ago` ms, with nothing counted then. */
const seenBack = (ago) => page.evaluate((a) => new Promise((ok) => {
  const r = indexedDB.open('ghosty-gym', 1);
  r.onsuccess = () => {
    const tx = r.result.transaction('games', 'readwrite');
    const st = tx.objectStore('games');
    const j = st.get('~journal');
    j.onsuccess = () => st.put({ id: '~journal', c4: j.result?.c4 ?? [], seen: { at: Date.now() - a, t: { lessons: 0, self: 0, solved: 0, played: 0 } } });
    tx.oncomplete = () => (r.result.close(), ok(true));
    tx.onerror = () => (r.result.close(), ok(false));
  };
  r.onerror = () => ok(false);
}), ago);
await snapshotC4();
// The first trick by taps on the real board: no four for the owner, a reason under the board after each of his moves,
// and the page never freezes while he thinks (the worker does the thinking).
await G('button', { hasText: 'NEW GAME' }).click();
await page.evaluate(() => {
  window.__ticks = [];
  clearInterval(window.__tick);
  window.__tick = setInterval(() => window.__ticks.push(performance.now()), 50);
});
const captions = [];
for (const c of TRICKS[0]) {
  const s0 = await st();
  if (s0.play.over) break;
  const before = s0.play.board.filter((x) => x === 2).length;
  // (a four first, as the owner would)
  await G('.gymboard button.gymcell').nth(c - 1).click();
  await until((n) => window.__ghosty.gym.play.board.filter((x) => x === 2).length > n || !!window.__ghosty.gym.play.over, 20000, `he did not answer my column ${c}`, before);
  captions.push(await G('.gymboard .gymcap').innerText().catch(() => ''));
}
const c4gap = await page.evaluate(() => {
  const t = window.__ticks;
  let worst = 0;
  for (let i = 1; i < t.length; i++) worst = Math.max(worst, t[i] - t[i - 1]);
  clearInterval(window.__tick);
  return { worst: Math.round(worst), n: t.length };
});
if (c4gap.worst > 500) problems.push(`the page froze while he thought: longest gap ${c4gap.worst} ms`);
if ((await st()).play.over === 'You win.') problems.push(`the bottom-row trick still wins on the board: ${captions.join(' | ')}`);
if (captions.some((t) => !/\. Your move\.$|wins|draw/i.test(t) || /^He dropped in column/.test(t))) problems.push(`his reasons on the board: ${captions.join(' | ')}`);
console.log(`the bottom-row trick on the board: ${captions.join(' | ')} (longest page pause ${c4gap.worst} ms)`);
await page.screenshot({ path: `${out}/gym-c4-reason.png` });

// ---- he learns from the owner's games (gym2): a real game he loses, studied while the GYM is idle ----
// He thinks on a test's tiny limit (2,000 positions a move: PLAY HIM otherwise takes its full time and does not lose
// to this) against the owner's moves from a second engine in its own worker (1.2 s a move). After the loss, with
// nothing training, he studies it with the solver: the card, the game screen and the review say what he found.
// (Fails on the old code: no journal, no study, no lines.)
await page.evaluate(() => (window.__ghosty.gym.limit = { nodes: 2000 }));
const oracle = (board) => page.evaluate((b) => new Promise((ok) => {
  if (!window.__oracle) {
    window.__oracle = new Worker('/textures.worker.js');
    window.__oracleWait = new Map();
    window.__oracle.onmessage = (e) => e.data?.gym === 'reply' && (window.__oracleWait.get(e.data.req)?.(e.data), window.__oracleWait.delete(e.data.req));
  }
  const id = 800000 + Math.floor(Math.random() * 99999);
  window.__oracleWait.set(id, (m) => ok(m.move));
  window.__oracle.postMessage({ gym: 'move', id: 'connect4', req: id, board: b, rec: null, epoch: 0, limit: { ms: 1200 } });
}), board);
let lostGame = null;
for (let tries = 0; tries < 3 && !lostGame; tries++) {
  await G('button', { hasText: 'NEW GAME' }).click();
  for (let i = 0; i < 21; i++) {
    const s0 = await st();
    if (s0.play.over) break;
    const col = await oracle(s0.play.board);
    const stones = s0.play.board.filter((x) => x).length;
    await G('.gymboard button.gymcell').nth(col).click();
    await until((n) => window.__ghosty.gym.play.board.filter((x) => x).length >= n + 2 || !!window.__ghosty.gym.play.over, 20000, 'he did not answer (the learning game)', stones);
  }
  const s1 = await st();
  if (s1.play.over === 'You win.') lostGame = s1.play.board;
}
await page.evaluate(() => (window.__ghosty.gym.limit = null));
if (!lostGame) problems.push('learning: the owner\'s engine did not beat him in three games on the tiny limit');
else {
  await until(() => window.__ghosty.gym.c4.studied >= 1 && !window.__ghosty.gym.c4.studying, 180000, 'learning: the lost game was never studied');
  const c4 = (await st()).c4;
  if (!/^You beat me at move \d+( with (a double threat on columns [\d, and]+|two threats stacked in column \d|the (odd|even) threat on the \w+ row of column \d|your threat on the \w+ row of column \d: I played under it|four in a row through column \d))?\. I’ve studied it\. Play me again\.$/.test(c4.screen)) problems.push(`learning: the game screen says "${c4.screen}"`);
  if (!/^You’ve taught me \d+ lessons?\.$/.test(c4.card)) problems.push(`learning: the card says "${c4.card}"`);
  const cardText = await G('.gymcard[data-game="connect4"] .gymnext').innerText().catch(() => '');
  if (cardText !== c4.card) problems.push(`learning: the Connect 4 card shows "${cardText}", not "${c4.card}"`);
  if (!/^You’ve taught me \d+ lessons?; (I’ve won \d+ of (our \d+|the last 5)|you won our only game)\.$/.test(c4.count)) problems.push(`learning: the count says "${c4.count}"`);
  if (!c4.review.length || !c4.review.some((r) => /^Move \d+ · Your /.test(r))) problems.push(`learning: the review: ${JSON.stringify(c4.review)}`);
  const shown = await G('.gymsays b').innerText().catch(() => '');
  if (shown !== c4.screen) problems.push(`learning: the game screen shows "${shown}"`);
  if (!(await G('.gymreview').count())) problems.push('learning: no review under the finished game');
  console.log(`learning from him: lost at move ${lostGame.filter((x) => x).length}; "${c4.screen}" · card "${c4.card}" · "${c4.count}" · review: ${c4.review.join(' | ')} · book ${c4.book} positions, ${c4.lessons} lessons`);
  await G('.gymreview').scrollIntoViewIfNeeded().catch(() => undefined);
  await wideCheck('the review after a loss');
  await page.screenshot({ path: `${out}/gym-c4-review.png` });
  await G('.gymsays').scrollIntoViewIfNeeded().catch(() => undefined);
  await page.screenshot({ path: `${out}/gym-c4-line.png` });
}
await page.evaluate(() => window.__oracle?.terminate());
// Connect 4's record and the journal go back as they were before the spec's games (nothing pondering meanwhile: the
// GYM is left first).
await page.evaluate(() => (location.hash = 'core'));
await page.waitForTimeout(800);
await restoreC4(false);
// The GYM's greeting says what changed since he last looked: the journal's last look moved back a day with nothing
// counted then, the GYM opened again.
await seenBack(86_400_000);
await boot();
await until((c) => window.__ghosty?.gym?.cards === c, 15000, 'the GYM did not come back for the greeting', CARDS);
await until(() => !!window.__ghosty.gym.c4.greeting, 10000, 'no greeting when the GYM opened');
const greetTxt = await page.locator('#pg-gym .two > .hero .sub').innerText().catch(() => '');
if (!/^Since yesterday: (\d+ games? with you, )?(\d+ lessons? from you, )?[\d,]+ games? against myself(, \d+ positions? solved)?\.$/.test(greetTxt)) problems.push(`the GYM's greeting reads "${greetTxt}"`);
console.log(`the GYM's greeting: "${greetTxt}"`);
await closeLog();
await page.screenshot({ path: `${out}/gym-greeting.png` });
// …and back again (the greeting's look is the spec's too), then the app opened afresh.
await page.evaluate(() => (location.hash = 'core'));
await page.waitForTimeout(800);
await restoreC4(true);
await boot();
await until((c) => window.__ghosty?.gym?.cards === c, 15000, 'the GYM did not come back after the learning section', CARDS);
await closeLog();

// ---- PLAY HIM on the bigger boards: checkers, chess, Go (taps; legal squares light up) ----
const cellAt = (i) => G('.gymboard button.gymcell').nth(i);
const lit = () => page.evaluate(() => [...document.querySelectorAll('#pg-gym .gymboard .gymcell.tgt')].length);
for (const [id, pick, to, label] of [
  // Checkers: Black's man on square 9 (row 3 from the top, b-file) → square 13 below it.
  ['checkers', 2 * 8 + 1, 3 * 8 + 2, 'checkers'],
  // Chess: the e2 pawn → e4.
  ['chess', 6 * 8 + 4, 4 * 8 + 4, 'chess'],
]) {
  await tap(id);
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
  await until(() => (window.__ghosty.gym.play.replies ?? 0) >= 1 || /I played/.test(document.querySelector('#pg-gym .gymboard .gymcap')?.textContent ?? ''), 30000, `he did not answer my ${id} move`);
  await wideCheck(`playing ${id}`);
  await page.screenshot({ path: `${out}/gym-${id}.png` });
}
// Go: legal points are marked; tap the centre; he answers; PASS is there.
await tap('go');
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
await tap('balance');
await G('button', { hasText: 'WATCH' }).click();
await until(() => window.__ghosty?.gym?.frames >= 3 && !!document.querySelector('#pg-gym .gymboard svg.gymdraw'), 15000, 'WATCH did not draw the cart and pole');
await wideCheck('watching the balance run');

// ---- WATCH: a maze route, frame by frame ----
await tap('maze');
await page.evaluate(() => (window.__ghosty.gym.frames = 0)); // (the balance run before counted frames too)
await G('button', { hasText: 'WATCH' }).click();
await until(() => window.__ghosty?.gym?.frames >= 2, 15000, 'WATCH did not play his maze route');
if (!(await G('.gymboard .gymcell.me').count()) && !(await G('.gymboard .gymcell').count())) problems.push('WATCH shows no maze');
await wideCheck('watching the maze');

// ---- PLAY HIM: Code Breaker cracks the owner's code ----
await tap('codebreaker');
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
await tap('connect4');
await G('button.gymtrain').click();
await until(() => window.__ghosty?.gym?.training === 'connect4', 5000, 'TRAIN did not start (second time)');
const cardEl = await card('maze').elementHandle();
await until((n) => window.__ghosty.gym.progress >= n + 2, 15000, 'no progress while training (second time)', (await st()).progress);
if (!(await cardEl.evaluate((e) => e.isConnected))) problems.push('the game cards were rebuilt by a progress repaint (a tap in flight would be lost)');
for (const id of ['maze', 'colony', 'tiles', 'connect4']) {
  await tap(id);
  const ok = await until((x) => window.__ghosty.gym.open === x, 1500, `tapping the ${id} card while training did not open it`, id);
  if (!ok) break;
}
await G('button', { hasText: 'WATCH' }).click();
await until(() => window.__ghosty.gym.watching, 20000, 'WATCH during training did not start');
await until(() => window.__ghosty.gym.frames >= 3, 20000, 'WATCH during training showed no moves');
// WATCH goes on round after round now: STOP ends it (it did not start the training, so that carries on).
await G('button.gymwatch').dispatchEvent('click');
await until(() => !window.__ghosty.gym.watching && !window.__ghosty.gym.watchOn, 5000, 'STOP did not end WATCH');
if ((await st()).training !== 'connect4') problems.push('STOP on a WATCH started while training stopped the training too');
const lastCap = await G('.gymboard .gymcap').innerText();
const progressThen = (await st()).progress;
// (If he masters the last level meanwhile, training ends by itself and no more repaints come — nothing to check.)
if (!(await until((n) => window.__ghosty.gym.progress >= n + 2 || window.__ghosty.gym.recs.connect4?.mastered, 20000, 'no progress after WATCH', progressThen))) problems.push(`(state then: ${JSON.stringify({ ...(await st()), recs: undefined })}, log: ${(await st()).log.join(' | ')})`);
const capNow = await G('.gymboard .gymcap').innerText().catch(() => '');
if (capNow !== lastCap) problems.push(`the finished WATCH was replaced by a repaint: "${lastCap}" → "${capNow}"`);
// (A level-up toast may sit over the button while it trains: press it directly.)
if ((await st()).training) await G('button.gymtrain').dispatchEvent('click');
await until(() => window.__ghosty?.gym?.training === '', 5000, 'PAUSE did not stop (second time)');

// ---- RESET: asks first (a "…" menu that says what will go), and an open question does not carry over to another game ----
await tap('codebreaker');
await G('.gymmore').click().catch(() => problems.push('the game has no … menu'));
if (!(await G('.gymmenu').isVisible()) || !/Reset Code breaker\? I forget everything I learned in it/i.test(await G('.gymmenu').innerText())) problems.push('the … menu did not ask before RESET');
await tap('maze');
if (await G('.gymmenu').isVisible()) problems.push('the RESET menu carried over to another game');
if (!/maze/i.test(await G('.gymmenu .gymmenunote').textContent())) problems.push('the RESET menu does not name the open game');

// ---- RESET while training: the wiped game does not come back (messages in flight are dropped) ----
await G('button.gymtrain').click();
await until(() => (window.__ghosty?.gym?.recs?.maze?.units ?? 0) > 0, 15000, 'maze did not train');
await resetGame();
await page.waitForTimeout(3500);
const afterReset = await st();
if (afterReset.recs.maze) problems.push(`the reset maze came back: ${JSON.stringify(afterReset.recs.maze)}`);
if ((await card('maze').locator('.gymst').innerText()).trim().toUpperCase() !== 'NEW') problems.push('the reset maze card does not say NEW');
await boot();
await until((c) => window.__ghosty?.gym?.cards === c, 15000, 'the GYM did not come back after the reset reload', CARDS);
await page.waitForTimeout(1000);
if ((await st()).recs.maze) problems.push('the reset maze came back after a reload');
await closeLog();

// ---- part 2: the six reasoning games — WATCH shows his reasoning as text; nothing sideways ----
for (const id of ['logic', 'brain', 'bughunt', 'escape', 'factcheck', 'debate']) {
  await tap(id);
  if (!(await until((x) => window.__ghosty.gym.open === x, 3000, `the ${id} card did not open`, id))) continue;
  const acts = await actions();
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
await tap('brain');
await page.evaluate(() => {
  window.__ticks2 = [];
  window.__tick2 = setInterval(() => window.__ticks2.push(performance.now()), 50);
});
// (its WATCH above trained it a little already: count from here)
const brain0 = (await st()).recs.brain?.units ?? 0;
await G('button.gymtrain').click();
await until(() => window.__ghosty?.gym?.training === 'brain', 5000, 'TRAIN did not start the network lab');
await until((u) => (window.__ghosty?.gym?.recs?.brain?.units ?? 0) > u + 20, 30000, 'the network lab made no progress in the worker', brain0);
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

// ---- part 3, on the iPhone 18 Pro Max (440 × 956): he carries on by himself ----
// A wake lock the page can be checked against (the phone lets go of it when the app is hidden), and an app
// that can be hidden and shown again.
await page.addInitScript(() => {
  const w = (window.__wake = { requests: 0, releases: 0, live: 0 });
  const live = new Set();
  const drop = (s) => {
    if (s.released) return;
    s.released = true;
    live.delete(s);
    w.releases++;
    w.live = live.size;
    for (const f of s.fns) f();
  };
  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: {
      request: async (type) => {
        w.requests++;
        const s = { type, released: false, fns: [], addEventListener: (t, f) => t === 'release' && s.fns.push(f), release: async () => drop(s) };
        live.add(s);
        w.live = live.size;
        return s;
      },
    },
  });
  let hid = false;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hid });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hid ? 'hidden' : 'visible') });
  document.addEventListener('visibilitychange', () => hid && [...live].forEach(drop));
  window.__setHidden = (v) => {
    hid = v;
    document.dispatchEvent(new Event('visibilitychange'));
  };
});
await page.setViewportSize(PHONE);
await boot();
await until((c) => window.__ghosty?.gym?.cards === c, 15000, 'part 3: the GYM did not open at 440 px', CARDS);
await closeLog();
const toList = async () => {
  if (await page.locator('#pg-gym.gympush').count()) await page.click('#top .navback');
};
// WATCH + a fast game at Level 1 (the maze, reset above): he reaches Level 2 by himself and goes on, one toast.
{
  const m0 = (await st()).recs.maze;
  if (m0 && m0.level !== 1) problems.push(`part 3: the maze should be at Level 1 after its reset (is at ${m0.level})`);
  await tap('maze');
  await until(() => window.__ghosty.gym.open === 'maze', 5000, 'part 3: the maze did not open');
  if (!(await G('button.gymswitch[role="switch"]', { hasText: /continue by himself/i }).count())) problems.push('part 3: no CONTINUE BY HIMSELF switch in the game view');
  if ((await G('button.gymswitch', { hasText: /continue by himself/i }).getAttribute('aria-checked')) !== 'true') problems.push('part 3: CONTINUE BY HIMSELF is not on by default');
  await page.evaluate(() => {
    window.__maxGymToasts = 0;
    window.__toasts0 = window.__ghosty.gym.toasts.length;
    new MutationObserver(() => (window.__maxGymToasts = Math.max(window.__maxGymToasts, document.querySelectorAll('#toasts > .toast[data-gym]').length))).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-gym'] });
  });
  await G('button.gymwatch').click();
  await until(() => window.__ghosty.gym.watchOn === 'maze' && window.__ghosty.gym.training === 'maze', 5000, 'part 3: WATCH did not start him training while you watch');
  if (await until(() => (window.__ghosty.gym.recs.maze?.level ?? 1) >= 2, 60000, 'part 3: WATCH on the maze did not reach Level 2 by itself')) {
    const at = await st();
    const said = at.toasts.slice(await page.evaluate(() => window.__toasts0)).filter((t) => /passed/.test(t));
    // (Each toast replaces the last: a quick Level 3 turns "Level 1 passed" into "Levels 1–2 passed", still one on screen.)
    if (!said.length || !said.every((t) => /^MAZE: Levels? 1(–\d+)? passed · on to level \d+$/.test(t))) problems.push(`part 3: reaching Level 2 should show one toast, showed ${JSON.stringify(said)}`);
    if (at.watchOn !== 'maze' || at.training !== 'maze') problems.push(`part 3: after the level-up he stopped (watching "${at.watchOn}", training "${at.training}")`);
    // The watching carries on at the new level too: another round comes, no tap.
    await until((n) => window.__ghosty.gym.rounds > n, 40000, 'part 3: no new round of WATCH after the level-up', at.rounds);
    await page.screenshot({ path: `${out}/gym3-watch.png` });
  }
  const most = await page.evaluate(() => window.__maxGymToasts);
  if (most > 1) problems.push(`part 3: ${most} GYM toasts were on screen at once`);
  await wideCheck('part 3: watching the maze at 440 px');
  // STOP: watching and the training WATCH started both stop; the last picture stays.
  await G('button.gymwatch').dispatchEvent('click');
  await until(() => !window.__ghosty.gym.watchOn && window.__ghosty.gym.training === '', 5000, 'part 3: STOP did not stop WATCH and its training');
  if (!(await G('.gymboard .gymframe').count())) problems.push('part 3: STOP cleared his last picture');
}
// TRAIN ALL with KEEP AWAKE: the least learned game first, an honest live line; the wake lock is asked for,
// asked for again after the app was hidden and shown, and let go on STOP.
{
  await toList();
  const sw = G('.gymall button.gymswitch');
  if (!/keep awake/i.test(await sw.innerText()) || !/plug the phone in/i.test(await sw.innerText())) problems.push(`part 3: the KEEP AWAKE switch reads "${await sw.innerText()}"`);
  if (await sw.isDisabled()) problems.push('part 3: KEEP AWAKE is disabled although the phone has a wake lock');
  await sw.click();
  await until(() => window.__ghosty.gym.awake.on, 3000, 'part 3: KEEP AWAKE did not switch on');
  const tall = await page.evaluate(() => [...document.querySelectorAll('#pg-gym .gymall button')].filter((b) => b.getBoundingClientRect().height < 44).length);
  if (tall) problems.push(`part 3: ${tall} TRAIN ALL / KEEP AWAKE targets are under 44 px`);
  await G('button.gymallbtn').click();
  await until(() => window.__ghosty.gym.all.on && !!window.__ghosty.gym.training, 5000, 'part 3: TRAIN ALL did not start');
  const line = await G('.gymallst').innerText();
  if (!/^Training all · .+ level \d+ · \d+ of 22 games mastered · /.test(line)) problems.push(`part 3: the TRAIN ALL line reads "${line}"`);
  const pick = await page.evaluate(() => {
    const g = window.__ghosty.gym;
    const sd = (r) => (!r ? 0 : r.mastered ? 10 : r.level - 1 + Math.min(1, r.mastery));
    const ids = [...document.querySelectorAll('#pg-gym .gymcard')].map((c) => c.dataset.game).filter((id) => !g.recs[id]?.mastered);
    return { cur: g.all.current, ok: ids.every((id) => sd(g.recs[id]) >= sd(g.recs[g.all.current])) };
  });
  if (!pick.ok) problems.push(`part 3: TRAIN ALL started with ${pick.cur}, not the least learned game`);
  await until(() => window.__wake.requests >= 1 && window.__wake.live === 1, 5000, 'part 3: KEEP AWAKE did not ask for a wake lock');
  await wideCheck('part 3: TRAIN ALL at 440 px');
  await page.screenshot({ path: `${out}/gym3-trainall.png` });
  await page.evaluate(() => window.__setHidden(true));
  await until(() => window.__ghosty.gym.training === '' && window.__wake.live === 0, 5000, 'part 3: hiding the app did not pause training');
  const asked = await page.evaluate(() => window.__wake.requests);
  await page.evaluate(() => window.__setHidden(false));
  await until((n) => window.__wake.requests > n && window.__wake.live === 1 && !!window.__ghosty.gym.training, 5000, 'part 3: the wake lock was not asked for again when the app came back', asked);
  const released = await page.evaluate(() => window.__wake.releases);
  await G('button.gymallbtn').dispatchEvent('click'); // STOP
  await until((n) => !window.__ghosty.gym.all.on && window.__ghosty.gym.training === '' && window.__wake.live === 0 && window.__wake.releases > n, 5000, 'part 3: STOP did not stop TRAIN ALL and let go of the wake lock', released);
  // A reload shows where it got to (and remembers the switches).
  await page.waitForTimeout(800);
  await boot();
  await until((c) => window.__ghosty?.gym?.cards === c, 15000, 'part 3: the GYM did not come back after a reload', CARDS);
  await until(() => /^Stopped · .+ level \d+ · \d+ of 22 games mastered · .+ · tap TRAIN ALL to carry on$/.test(document.querySelector('#pg-gym .gymallst')?.textContent ?? ''), 5000, `part 3: after a reload TRAIN ALL does not say where it got to ("${await G('.gymallst').innerText().catch(() => '')}")`);
  await until(() => window.__ghosty.gym.awake.on && window.__ghosty.gym.carry, 3000, 'part 3: KEEP AWAKE / CONTINUE BY HIMSELF were not remembered');
  await closeLog();
  await wideCheck('part 3: the game cards at 440 px');
  await page.screenshot({ path: `${out}/gym3-reload.png` });
  await tap('tictactoe');
  await wideCheck('part 3: a game at 440 px');
  await page.screenshot({ path: `${out}/gym3-game.png`, fullPage: true });
  // a narrow phone (390 × 844) still fits (the rest of the spec runs on the owner's phone, 440 × 956)
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await wideCheck('part 3: a game at 390 px');
  await toList();
  await wideCheck('part 3: the game cards at 390 px');
}

// GYM ideas (440 × 956): a puzzle at his edge — a maze kept at Level 7 whose edge stands at 7½ (solved 10 of his last
// 20) says so on its page; TRAIN makes him try one more there at once (checked by the maze's own checker), the line
// still at Level 7-and-a-bit. League play: tic-tac-toe trained afresh passes levels; each passed version meets his
// past selves, and his rating shows on the card ("Rating 1,0xx · up …") and the game's page ("… this week"), with the
// versions kept, the bytes they take and the last decision.
{
  await page.setViewportSize({ width: 440, height: 956 });
  await toList();
  const seed = 'maze'.split('').reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const edge = { x: 7.5, level: 7, tries: Array.from({ length: 20 }, (_, i) => i % 2), n: 20, solved: 10, span: 1 };
  await page.evaluate(
    (rec) =>
      new Promise((ok) => {
        const r = indexedDB.open('ghosty-gym', 1);
        r.onsuccess = () => {
          const tx = r.result.transaction('games', 'readwrite');
          tx.objectStore('games').put(rec);
          tx.oncomplete = () => (r.result.close(), ok());
        };
      }),
    { id: 'maze', level: 7, units: 1, mastery: 0, start: 0, detail: '', history: [], mastered: false, seed, saved: null, updated: Date.now(), edge },
  );
  await boot();
  await until((c) => window.__ghosty?.gym?.cards === c, 15000, 'ideas: the GYM did not come back after a reload', CARDS);
  await closeLog();
  await tap('maze');
  await until(() => window.__ghosty.gym.open === 'maze', 5000, 'ideas: the maze did not open');
  const edgeLine = async () => ((await G('.gymidea.edge .gymedgeline').textContent().catch(() => '')) ?? '').trim();
  if ((await edgeLine()) !== 'Level 7½: puzzles he only just fails · solved 10 of his last 20') problems.push(`ideas: the maze's edge reads "${await edgeLine()}"`);
  // (the block is drawn afresh on every repaint: scroll its section, which stays)
  await G('section.gymideas').scrollIntoViewIfNeeded().catch(() => undefined);
  await page.screenshot({ path: `${out}/gym-ideas-edge.png` });
  await G('button.gymtrain').click();
  if (await until(() => (window.__ghosty.gym.edge.maze?.n ?? 0) >= 21, 15000, 'ideas: TRAIN did not make him try a puzzle at his edge')) {
    const e = (await st()).edge.maze;
    // one try from 7½ moves it a twentieth of a level: still a Level 7-and-a-bit puzzle
    if (Math.abs(e.x - 7.5) > 0.11 || !/^Level 7(¼|½|¾)?: .+ · solved \d+ of his last 20$/.test(e.line)) problems.push(`ideas: after one more try the edge is ${e.x} ("${e.line}")`);
  }
  await G('button.gymtrain').click(); // PAUSE
  await wideCheck('ideas: the maze with its edge at 440 px');
  // League play: tic-tac-toe from the start, trained until a new version has met his past selves.
  await tap('tictactoe');
  await until(() => window.__ghosty.gym.open === 'tictactoe', 5000, 'ideas: tic-tac-toe did not open');
  if (await G('button.gymtrain').isDisabled()) {
    await resetGame();
    await page.waitForTimeout(300);
  }
  await G('button.gymtrain').click();
  if (await until(() => /^it scored/.test(window.__ghosty.gym.league.tictactoe?.last ?? ''), 60000, 'ideas: no league decision on tic-tac-toe within a minute of training')) {
    const lg = (await st()).league.tictactoe;
    const onCard = ((await card('tictactoe').locator('.gymrate').textContent()) ?? '').trim();
    if (!/^Rating \d[\d,]* · (up \d+|down \d+|no change)$/.test(onCard)) problems.push(`ideas: the tic-tac-toe card's rating reads "${onCard}"`);
    const line = ((await G('.gymidea.league .gymrateline').textContent()) ?? '').trim();
    if (line !== lg.line || !/^Rating \d[\d,]* · (up \d+|down \d+|no change) this week$/.test(line)) problems.push(`ideas: the league line reads "${line}"`);
    const kept = ((await G('.gymidea.league small').first().textContent()) ?? '').trim();
    if (!/^\d of 8 versions kept on this phone · \d+ KB$/.test(kept)) problems.push(`ideas: the versions line reads "${kept}"`);
    const verdict = ((await G('.gymidea.league small.verdict').textContent()) ?? '').trim();
    if (!/^Level \d+’s version (kept|thrown away): it scored [\d.]+ of \d+ against his/.test(verdict)) problems.push(`ideas: the decision reads "${verdict}"`);
  }
  if ((await st()).training === 'tictactoe') await G('button.gymtrain').click(); // PAUSE
  await G('section.gymideas').scrollIntoViewIfNeeded().catch(() => undefined);
  await page.screenshot({ path: `${out}/gym-ideas-league.png` });
  await wideCheck('ideas: tic-tac-toe with its league at 440 px');
  await toList();
  await card('tictactoe').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/gym-ideas-cards.png` });
  await wideCheck('ideas: the cards with a rating at 440 px');
}

const csp = await page.evaluate(() => window.__csp);
if (csp.length) problems.push(`security policy blocked: ${csp.join(' | ')}`);
await page.evaluate(() => clearInterval(window.__tick));
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${[...new Set(problems)].join('\n')}` : `GYM run clean in ${engine}: ${CARDS} cards, training in the worker (longest page pause ${gap.worst} ms), saved and carried on after a reload, PLAY HIM on tic-tac-toe, Connect 4, checkers, chess and Go (legal squares lit), WATCH (maze, the drawn balance run), a code cracked; WATCH as text for the six reasoning games and the network lab trained without a freeze (longest pause ${gap2.worst} ms); card taps and a finished WATCH survive progress repaints, RESET does not carry over and a reset game stays reset; part 3 at 440 px: WATCH went on to Level 2 by itself with one toast, TRAIN ALL started on the least learned game, KEEP AWAKE asked, asked again after hide/show and let go on STOP, and a reload shows where TRAIN ALL got to; GYM ideas: a puzzle at his edge at Level 7½, and tic-tac-toe's league rating on the card and the page.`);
process.exit(problems.length ? 1 : 0);
