// BATCH 8 PART B (BRIEF-REST-B) on the owner's phone (440 × 956) and a narrow 390 × 844:
//  1. CHESS WITH A REAL RATING — the GYM's CHESS shows the rated section with "Not rated yet"; RATED GAME starts a game
//     against the vendored Stockfish (the real WebAssembly engine, loaded under the app's security policy), his first move
//     is answered by the engine, HINT names a move in words and makes the game unrated, RESIGN of a hint-free game is a rated
//     loss that gives a rating and shows it on the card ("You: about … · ±…"), CHECK MY GAME names what the game cost;
//     RATE ME has Ghosty play the engine; the chat answers "what's my chess rating?" from this phone.
//  (the coach, the review link and the first run are the sections below it)
//   BASE=http://localhost:8733 node tests/restb.spec.mjs tests/.shots
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, standDown } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const problems = [];
const t0 = Date.now();
await standDown(base, KEY);
const log = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s · ${s}`);
const check = (ok, msg) => {
  if (!ok) problems.push(msg);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
};

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
const until = (page, fn, arg, ms, why) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => (problems.push(why), false));
const sideways = (page, sel) => page.$$eval(sel, (els) => els.filter((e) => {
  if (!e.getClientRects().length) return false;
  const r = e.getBoundingClientRect();
  return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1);
}).slice(0, 5).map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join('.')} "${(e.textContent ?? '').trim().slice(0, 40)}"`));
/** Buttons and fields with no name VoiceOver could read. */
const unnamed = (page, root) => page.$$eval(`${root} button, ${root} input:not([type=hidden]), ${root} textarea, ${root} select`, (els) => els.filter((e) => e.getClientRects().length).filter((e) => !(e.getAttribute('aria-label') || (e.textContent ?? '').trim() || e.getAttribute('title') || e.getAttribute('placeholder'))).slice(0, 5).map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join('.')}`));

async function phone(viewport, opts = {}) {
  const ctx = await browser.newContext({ viewport, screen: viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ...UK, serviceWorkers: 'block', permissions: ['microphone', 'camera'], ...opts });
  await ctx.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${viewport.width}] pageerror: ${e.message}`));
  page.on('console', (m) => {
    const t = m.text();
    if ((m.type() === 'error' && !/favicon|net::ERR|404|Failed to load resource|^[WI]\d{4} |^INFO:/.test(t)) || /Refused to|Content Security Policy/.test(t)) problems.push(`[${viewport.width}] console: ${t.slice(0, 200)}`);
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pair input', { timeout: 15000 });
  await page.fill('#pair input', KEY);
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForSelector('#cin', { timeout: 10000 });
  return { ctx, page };
}
async function say(page, words) {
  await page.fill('#cin', words);
  await page.press('#cin', 'Enter');
}
const lastReply = (page) => page.evaluate(() => [...document.querySelectorAll('#pg-core .msg:not(.me)')].map((m) => m.textContent ?? '').pop() ?? '');
const state = (page, key) => page.evaluate((k) => JSON.parse(JSON.stringify(window.__ghosty?.[k] ?? null)), key);

// ================================================================ 1. CHESS WITH A REAL RATING
{
  const { ctx, page } = await phone(PHONE);
  log('chess');
  // the chat knows no rating yet and says how to get one
  await say(page, "what's my chess rating?");
  await until(page, () => /RATED GAME/.test([...document.querySelectorAll('#pg-core .msg:not(.me)')].map((m) => m.textContent ?? '').pop() ?? ''), null, 20000, 'the chat did not answer the chess rating on the phone');
  check(/approximate/.test(await lastReply(page)), 'the chat says the ratings are approximate, and how to get one');

  await page.evaluate(() => (location.hash = 'gym'));
  await until(page, () => window.__ghosty?.gym?.cards > 0, null, 15000, 'the GYM did not open');
  await page.locator('#pg-gym .gymcard[data-game="chess"]').click();
  await page.waitForSelector('#pg-gym .chessrate', { timeout: 10000 });
  check(true, 'CHESS opens with the rated section');
  let s = await state(page, 'chessRated');
  check(s.words === 'Not rated yet', `before any game it says "Not rated yet" (${s.words})`);
  check(/Next to try: Level 2 · Easy · about 1,?320/.test(await page.locator('#pg-gym .chessrate .crnext').innerText()), 'the next level to try is the nearest to a new player: Level 2, about 1320');

  // RATED GAME against the real engine (the 1.9 MB engine loads now, under the page's security policy)
  await page.locator('#pg-gym .chessrate .cractions button', { hasText: 'RATED GAME' }).click();
  await until(page, () => window.__ghosty?.chessRated?.mode === 'you', null, 10000, 'RATED GAME did not start');
  await page.locator('#pg-gym .chessrate .gymgrid .gymcell').nth(52).click(); // e2
  await page.locator('#pg-gym .chessrate .gymgrid .gymcell').nth(36).click(); // e4
  await until(page, () => window.__ghosty?.chessRated?.sans?.length >= 2 && !window.__ghosty.chessRated.thinking, null, 90000, 'the engine did not answer 1.e4 (the real Stockfish, in its worker)');
  s = await state(page, 'chessRated');
  check(s.sans[0] === 'e4' && s.sans.length === 2, `his e4 and the engine's reply are on the board (${s.sans.join(' ')})`);
  check(!s.error, `the engine started under the security policy (${s.error || 'no error'})`);
  await page.screenshot({ path: `${out}/restb-chess-game.png` });
  const csp = await page.evaluate(() => window.__csp ?? []);
  check(!csp.length, `nothing blocked by the security policy (${csp.join('; ')})`);

  // RESIGN of a hint-free game is a rated loss: a rating, shown on the card
  await page.locator('#pg-gym .chessrate .cractions button', { hasText: 'RESIGN' }).click();
  await until(page, () => window.__ghosty?.chessRated?.games?.you === 1, null, 10000, 'a resigned game was not rated');
  s = await state(page, 'chessRated');
  check(/^You: about [\d,]+ · ±\d+$/.test(s.words), `his rating is on the card: "${s.words}"`);
  const card = await page.locator('#pg-gym .gymcard[data-game="chess"] .gymrate').innerText();
  check(card === s.words, `the same words are on the chess card in the list ("${card}")`);
  // CHECK MY GAME: the engine looks at each position; the result is in plain words
  await page.locator('#pg-gym .chessrate .cractions button', { hasText: 'CHECK MY GAME' }).click();
  await until(page, () => !!window.__ghosty?.chessRated?.summary, null, 60000, 'CHECK MY GAME gave no words');
  s = await state(page, 'chessRated');
  check(/clean game|cost you something/.test(s.summary), `the check says it in words: "${s.summary}"`);

  // a game with a hint is not rated
  await page.locator('#pg-gym .chessrate .cractions button', { hasText: 'RATED GAME' }).click();
  await until(page, () => window.__ghosty?.chessRated?.mode === 'you' && window.__ghosty.chessRated.sans.length === 0 && !window.__ghosty.chessRated.over, null, 10000, 'the second game did not start');
  await page.locator('#pg-gym .chessrate .cractions button', { hasText: 'HINT' }).click();
  await until(page, () => !!window.__ghosty?.chessRated?.hint, null, 60000, 'HINT gave no move');
  s = await state(page, 'chessRated');
  check(/^Try [A-Za-z0-9=+#]+: /.test(s.hint) && /no longer rated/.test(s.hint), `HINT names a move in words and says the game is not rated ("${s.hint}")`);
  await page.locator('#pg-gym .chessrate .cractions button', { hasText: 'RESIGN' }).click();
  await page.waitForTimeout(500);
  s = await state(page, 'chessRated');
  check(s.games.you === 1, `a game played with a hint is not rated (${s.games.you} rated game)`);

  // RATE ME: Ghosty's own chess plays the engine (one game with each colour); the engine is the real one, so the games are capped short here
  await page.locator('#pg-gym .chessrate .cractions button', { hasText: 'RATE ME' }).click();
  await until(page, () => window.__ghosty?.chessRated?.games?.me >= 1, null, 240000, 'RATE ME did not finish a game');
  s = await state(page, 'chessRated');
  check(/^You: about [\d,]+ · Me: about [\d,]+ · ±\d+$/.test(s.words), `both ratings are on the card: "${s.words}"`);
  await until(page, () => window.__ghosty?.chessRated?.games?.me >= 2 || document.querySelector('#pg-gym .chessrate .crsay')?.textContent?.startsWith('I played'), null, 240000, 'RATE ME did not finish its two games');
  await page.screenshot({ path: `${out}/restb-chess-rated.png` });
  check((await sideways(page, '#pg-gym .chessrate, #pg-gym .chessrate *')).length === 0, 'nothing sticks out sideways in the rated section at 440 px');
  const un = await unnamed(page, '#pg-gym .chessrate');
  check(un.length === 0, `every control in the rated section has a name for VoiceOver (${un.join(', ')})`);
  await ctx.close();
}

// ================================================================ the end
await browser.close();
console.log(`\n${((Date.now() - t0) / 1000).toFixed(0)} s`);
if (problems.length) {
  console.log(`\n${problems.length} problem(s):\n${problems.map((p) => ` - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log('\nrestb: all good');
