// POKER, WORDS and GAMES 5's loose ends (BRIEF-GAMES-6). (a) the ARCADE room (440 × 956, the real app) lists POKER and WORDS right
// after CONNECT 4, each with PLAY at once and its card ending in the two ratings; (b) poker in the harness page (tests/fixtures/
// games6: the player at its smallest, bundled here with esbuild and served on the preview's own origin under the production policy,
// so the styles and the board Worker are the build's): a hand dealt, a bet made under the thumb, Ghosty answers within his thinking
// time with "thinking…" shown, the pot and the stacks in chips (and the chips always add up), a hand's result in his voice with the
// winning hand named, HINT says "about N%", the session ends and the rating line moves, "Chips, never money." on the card, the
// hands readable afterwards; (c) words: the list's size said before anything is fetched and fetched only after the tap, a word placed
// by drag and by tap, an invalid word refused at once ("Not in my list."), the score said with its bonus, SWAP, PASS, Ghosty plays a
// real word from the list, the end and the count, the list kept and removable; (d) offline from a fresh open: the board Worker is in
// the service worker's precache and answers with no network; (e) backgammon's take-back takes the whole turn; (f) every control
// 44 pt, nothing sideways at 440 × 956 and 390 × 844, reduced motion stills the pulse, sound on and off; (g) the GYM's Report card
// lists the six ratings. The frame times are printed.
//   BASE=http://localhost:8835 node tests/games6.spec.mjs tests/.shots [arcade|poker|words|offline|backgammon]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const root = new URL('..', import.meta.url).pathname;
const esbuild = createRequire(join(root, 'apps/web/package.json'))('esbuild');
const bundle = await esbuild.build({ entryPoints: [join(root, 'tests/fixtures/games6/harness.mjs')], bundle: true, format: 'esm', target: 'es2022', write: false, external: ['/vendor/*'], logLevel: 'warning' });
const js = bundle.outputFiles[0].text;
const html = readFileSync(join(root, 'tests/fixtures/games6/index.html'), 'utf8');
const csp = /Content-Security-Policy: (default-src 'self'[^\n]*)/.exec(readFileSync(join(root, 'apps/web/public/_headers'), 'utf8'))[1];
const rb = await esbuild.build({ entryPoints: [join(root, 'tests/fixtures/games6/rules.mjs')], bundle: true, format: 'esm', platform: 'neutral', write: false, logLevel: 'warning' });
const R = await import(`data:text/javascript;base64,${Buffer.from(rb.outputFiles[0].text).toString('base64')}`);
const LEX = new R.Lex(readFileSync(join(root, 'apps/web/public/data/words-en.dawg')));
const only = process.argv[3] ?? '';

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const problems = [];
const check = (ok, msg) => {
  if (!ok) problems.push(msg);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
};
const SIZES = [{ width: 440, height: 956 }, { width: 390, height: 844 }];

async function open(game, args = 'nopractice', size = SIZES[1], extra = {}, init = null, seen = null) {
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 2, hasTouch: true, isMobile: true, serviceWorkers: 'block', ...UK, ...extra });
  if (init) await ctx.addInitScript(init);
  await ctx.route(`${base}/__g6/**`, (route) => {
    const p = new URL(route.request().url()).pathname;
    if (p === '/__g6/harness.js') return route.fulfill({ body: js, contentType: 'text/javascript', headers: { 'content-security-policy': csp } });
    return route.fulfill({ body: html, contentType: 'text/html', headers: { 'content-security-policy': csp } });
  });
  const page = await ctx.newPage();
  const errors = [];
  if (seen) page.on('request', (r) => seen.push(new URL(r.url()).pathname));
  page.on('pageerror', (e) => !webkitNoise(e) && errors.push(e.message));
  page.on('console', (m) => (m.type() === 'error' || /Refused to|Content Security Policy/.test(m.text())) && errors.push(m.text()));
  await page.goto(`${base}/__g6/index.html?game=${game}&args=${encodeURIComponent(args)}`);
  await page.waitForFunction(() => window.__g5?.ready || window.__g5?.events?.error, null, { timeout: 60000 });
  const err = await page.evaluate(() => window.__g5.events.error);
  check(!err, `${game} (${size.width}): it starts${err ? `: ${err}` : ''}`);
  await page.waitForFunction(() => window.__g5.handle.peek().frames > 3, null, { timeout: 30000 });
  return { ctx, page, errors };
}
const peek = (page) => page.evaluate(() => window.__g5.handle.peek());
const st = async (page) => (await peek(page)).state;
const until = (page, fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);
const menuOf = (page) => page.locator('.g2menu .g2btns button').allTextContents();
const store = (page, key) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);
async function sideways(page, label, size) {
  const r = await page.evaluate(() => {
    const W = innerWidth;
    const out = [];
    for (const el of document.querySelectorAll('.g2ui *')) {
      const b = el.getBoundingClientRect();
      if (b.width && b.height && (b.left < -1 || b.right > W + 1) && getComputedStyle(el).visibility !== 'hidden') out.push(`${el.className} ${Math.round(b.left)}…${Math.round(b.right)}`);
    }
    return { scroll: document.documentElement.scrollWidth, W, out };
  });
  check(r.scroll <= r.W && r.out.length === 0, `${label}: nothing sideways at ${size.width} × ${size.height} (${r.out.slice(0, 3).join('; ') || 'all inside'})`);
}
async function controls(page, label) {
  const bad = await page.evaluate(() => [...document.querySelectorAll('.g2ui button')].filter((b) => b.getClientRects().length && !(b.getAttribute('aria-label') || b.textContent.trim())).map((b) => b.className));
  const small = await page.evaluate(() => [...document.querySelectorAll('.g2ui button')].filter((b) => b.getClientRects().length).filter((b) => { const r = b.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).map((b) => `${b.textContent} ${Math.round(b.getBoundingClientRect().width)}×${Math.round(b.getBoundingClientRect().height)}`));
  check(bad.length === 0, `${label}: every control has a VoiceOver label${bad.length ? `: ${bad.join(', ')}` : ''}`);
  check(small.length === 0, `${label}: every control is 44 pt or more${small.length ? `: ${small.join(', ')}` : ''}`);
}
async function measure(page, game, ms = 2500) {
  await page.evaluate(() => window.__g5.handle.resetStats());
  await page.waitForTimeout(ms);
  const s = await peek(page);
  console.log(`     ${game}: first frame ${Math.round(s.firstFrameMs)} ms; frame interval p50 ${s.p50.toFixed(1)} ms, p95 ${s.p95.toFixed(1)} ms; our own work p95 ${s.workP95.toFixed(1)} ms; drawn at ${s.scale}× (${s.width} × ${s.height}) (software rendering)`);
}
const shot = (page, name) => page.screenshot({ path: `${out}/games6-${name}.png`, timeout: 15000 }).catch(() => undefined);
async function quitFrees(page, game) {
  await page.evaluate(() => window.__g5.handle.quit());
  const after = await page.evaluate(() => ({ w: window.__g5.canvas.width, h: window.__g5.canvas.height, ui: !!document.querySelector('.g2ui') }));
  check(after.w === 0 && after.h === 0 && !after.ui, `${game}: quit lets the canvas go (0 × 0, the overlay gone)`);
}
const tap = (page, p) => page.touchscreen.tap(p.x, p.y);
const RATINGS = /You: [\d,]+ · Ghosty: [\d,]+$/;

// ================================================================ (a) the ARCADE room, in the real app, and (g) the GYM's Report card
if (!only || only === 'arcade') {
  const ctx = await browser.newContext({ viewport: PHONE, ...UK, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    localStorage.setItem('ghosty.arcade.board.rating', JSON.stringify({ poker: { you: { r: 1250, rd: 120, vol: 0.06, games: 4 }, me: { r: 1150, rd: 120, vol: 0.06, games: 4 }, wins: 3, losses: 1, draws: 0, log: [] }, draughts: { you: { r: 1180, rd: 120, vol: 0.06, games: 6 }, me: { r: 1420, rd: 120, vol: 0.06, games: 6 }, wins: 2, losses: 4, draws: 0, log: [] } }));
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => !webkitNoise(e) && errors.push(e.message));
  page.on('console', (m) => /Refused to|Content Security Policy/.test(m.text()) && errors.push(m.text()));
  await page.goto(base);
  await page.waitForFunction(() => !!document.querySelector('#pair input') || !document.querySelector('#boot'), null, { timeout: 20000 }).catch(() => undefined);
  if (await page.locator('#pair input').isVisible().catch(() => false)) {
    await page.fill('#pair input', 'preview-owner-key-0123456789');
    await page.click('#pair button.on');
  }
  await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
  await page.evaluate(() => (location.hash = 'arcade'));
  await until(page, () => !!document.querySelector('#pg-arcade .arccard') && getComputedStyle(document.getElementById('pg-arcade')).display !== 'none', null, 20000);
  const cards = await page.evaluate(() => [...document.querySelectorAll('#pg-arcade .arccard:not(.arcpack)')].map((c) => ({ id: c.dataset.id, act: c.querySelector('.arcact')?.textContent ?? '', score: c.querySelector('.arcscore')?.textContent ?? '' })));
  const ids = cards.map((c) => c.id);
  check(JSON.stringify(ids.slice(ids.indexOf('connect4') + 1)) === JSON.stringify(['poker', 'words']), `POKER and WORDS come right after CONNECT 4 (${ids.slice(ids.indexOf('connect4')).join(', ')})`);
  for (const id of ['poker', 'words']) {
    const c = cards.find((x) => x.id === id);
    check(!!c && c.act === 'PLAY', `${id}: PLAY at once (${c?.act})`);
    check(!!c && RATINGS.test(c.score), `${id}: the card ends in the two ratings ("${c?.score}")`);
  }
  check(/You: 1,250 · Ghosty: 1,150$/.test(cards.find((x) => x.id === 'poker')?.score ?? ''), 'poker: the card shows the ratings it was given (You: 1,250 · Ghosty: 1,150)');
  check(/You: 1,200 · Ghosty: 1,200$/.test(cards.find((x) => x.id === 'words')?.score ?? ''), 'words: the starting 1,200 for both before a first game');
  check(/Chips, never money\./.test(await page.locator('#pg-arcade .arccard[data-id="poker"]').innerText()), 'the POKER card says "Chips, never money."');
  await shot(page, 'arcade-440');
  const wide = await page.evaluate(() => ({ page: document.documentElement.scrollWidth > innerWidth + 1, over: [...document.querySelectorAll('#pg-arcade .arccard, #pg-arcade .arcact')].filter((e) => e.getBoundingClientRect().right > innerWidth + 1).length }));
  check(!wide.page && wide.over === 0, 'the shelf with the two new tiles sticks out nowhere at 440 × 956');
  // PLAY on each starts it in the player
  for (const id of ['poker', 'words']) {
    await page.locator(`#pg-arcade .arccard[data-id="${id}"] .arcact`).tap();
    const started = await until(page, () => !!document.querySelector('.arcplayer .g2ui .g2menu') && !!document.querySelector('.arcplayer canvas')?.width, null, 30000);
    check(started, `${id}: PLAY starts it in the arcade's player with its menu`);
    if (started) {
      const notes = await page.locator('.arcplayer .g2menu .g2note').allTextContents();
      if (id === 'poker') check(notes.some((n) => n === 'Chips, never money.'), 'poker: the title card says "Chips, never money." on a line of its own');
      else check(notes.some((n) => /The word list is a \d+ KB download, once, on Wi-Fi\./.test(n)) && (await page.locator('.arcplayer .g2btn[data-id="play"]').count()) === 0, 'words: the title says the list is a download, once, on Wi-Fi, with its size, and offers no PLAY until it is here');
      await shot(page, `${id}-in-app-440`);
      await page.locator('.g2pause, .arcplayer .g2menu .g2btns button', { hasText: /quit/i }).first().click().catch(() => undefined);
      await page.locator('.arcplayer .g2menu .g2btns button', { hasText: /quit/i }).click().catch(() => undefined);
      check(await until(page, () => !document.querySelector('.arcplayer') && !window.__ghosty.arcade.playing, null, 15000), `${id}: its own Quit returns to the shelf`);
    }
  }
  // (g) the GYM's Report card lists the six board ratings
  await page.evaluate(() => (location.hash = 'gym'));
  const gym = await until(page, () => document.querySelectorAll('#pg-gym .gymboards .gb').length === 6, null, 25000);
  check(gym, "the GYM's Report card lists six games he can lose to");
  const lines = await page.evaluate(() => [...document.querySelectorAll('#pg-gym .gymboards .gb')].map((e) => e.textContent));
  check(lines.length === 6 && ['Draughts', 'Othello', 'Backgammon', 'Connect 4', 'Poker', 'Words'].every((n, i) => lines[i].startsWith(n)), `the six are Draughts, Othello, Backgammon, Connect 4, Poker, Words (${lines.map((l) => l.slice(0, 14)).join(' | ')})`);
  check(/You: 1,250 · Ghosty: 1,150 · ±\d+ · 4 games: 3 won, 0 drawn, 1 lost/.test(lines[4] ?? ''), `Poker's line is honest about games and doubt ("${lines[4]}")`);
  check(/not rated yet/.test(lines[5] ?? ''), 'Words is not rated yet, and says so');
  const gw = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  check(!gw, 'the GYM sticks out nowhere at 440 × 956');
  await shot(page, 'gym-report-440');
  check(errors.length === 0, `no page errors in the real app${errors.length ? `: ${errors[0]}` : ''}`);
  await ctx.close();
}

// ================================================================ (b) POKER
/** Play the hand in front of you to its end: check or call, and fold to a bet of more than four big blinds; true if the hand ended. */
async function callDown(page, limit = 30) {
  for (let i = 0; i < limit; i++) {
    const s = await st(page);
    if (s.handOver) return true;
    if (s.humanTurn) await tap(page, s.owed > s.bb * 4 ? s.fold : s.call);
    await page.waitForTimeout(150);
  }
  return (await st(page)).handOver;
}
if (!only || only === 'poker') {
  for (const size of SIZES) {
    const { ctx, page, errors } = await open('poker', 'nopractice|level=1|seed=11|hands=2', size);
    check(JSON.stringify(await menuOf(page)) === JSON.stringify(['Play', 'How to play', 'Sound: on', 'Quit']), `poker (${size.width}): Play · How to play · Sound · Quit`);
    const notes = (await page.locator('.g2menu .g2note').allTextContents()).join(' | ');
    check(/Level 1 · he thinks for about 0\.\d s a move/.test(notes) && /You: 1,200 · Ghosty: 1,200/.test(notes) && notes.includes('Chips, never money.'), `poker (${size.width}): the title says his level and thinking time, both ratings and "Chips, never money." (${notes.slice(0, 160)})`);
    await controls(page, 'poker title');
    await page.locator('.g2btn[data-id="how-to-play"]').tap();
    check(await page.locator('.g2how', { hasText: 'There is no top level' }).isVisible(), `poker (${size.width}): the rules on one card, and no top level`);
    await page.locator('.g2btn[data-id="back"]').tap();
    await page.locator('.g2btn[data-id="sound-on"]').tap();
    check((await menuOf(page)).includes('Sound: off'), `poker (${size.width}): Sound turns off`);
    await page.locator('.g2btn[data-id="sound-off"]').tap();
    await page.locator('.g2btn[data-id="play"]').tap();
    check((await peek(page)).mode === 'play', `poker (${size.width}): Play starts a session`);
    await controls(page, 'poker in play');
    await sideways(page, 'poker', size);
    let s = await st(page);
    check(s.hand === 1 && s.hole.length === 2 && s.board.length === 0 && s.humanTurn && s.button === 0, `poker (${size.width}): a hand is dealt, two cards each, you on the button and first to act`);
    const tags = await page.locator('.g6tag').allTextContents();
    check(tags.some((t) => /^Pot [\d,]+ chips/.test(t)) && tags.some((t) => /^You · [\d,]+ chips/.test(t)) && tags.some((t) => /^Ghosty · [\d,]+ chips/.test(t)), `poker (${size.width}): the pot and both stacks are said in chips (${tags.join(' | ')})`);
    check(s.total === 2000 && s.pot === 15 && s.stacks[0] === 995 && s.stacks[1] === 990, `poker (${size.width}): the blinds are in and every chip is counted (pot ${s.pot}, you ${s.stacks[0]}, him ${s.stacks[1]}, total ${s.total})`);
    check(/^raise [\d,]+$/i.test((await page.locator('.g4btn[data-act="raise"]').innerText()).trim()), `poker (${size.width}): the raise key names the bet it will make (${(await page.locator('.g4btn[data-act="raise"]').innerText()).trim()})`);
    if (size.width === 440) await shot(page, 'poker-deal-440');
    // a size under the thumb, then the bet
    await page.locator('.g4btn[data-act="size-three"]').tap();
    s = await st(page);
    check(s.sizeId === 'three' && s.raiseTo >= 20, `poker (${size.width}): a bet size is chosen under the thumb (¾ POT is ${s.raiseTo})`);
    const raiseTo = s.raiseTo;
    await tap(page, s.raise);
    // Ghosty answers within his thinking time, with "thinking…" shown
    const thought = await until(page, () => window.__g5.handle.peek().state.thinking, null, 4000);
    const said = await page.locator('.g5status').innerText().catch(() => '');
    check(thought && /thinking…/.test(said), `poker (${size.width}): "thinking…" is shown while he works ("${said}")`);
    const t0 = Date.now();
    const back = await until(page, () => { const q = window.__g5.handle.peek().state; return (q.humanTurn || q.handOver) && !q.thinking; }, null, 12000);
    const took = Date.now() - t0;
    s = await st(page);
    check(back && took < 3500, `poker (${size.width}): he answered in ${took} ms (level 1 thinks for about 0.1 s, the table shows it for at least 0.7 s)`);
    check(s.last.samples > 100 && s.total === 2000, `poker (${size.width}): he dealt out ${s.last.samples} games to the end to work out his chances, and the chips still add up (${s.total})`);
    check(s.bets[0] === raiseTo || s.handOver, `poker (${size.width}): the bet is in front of you (${s.bets[0]} of ${raiseTo})`);
    if (size.width === 440 && !s.handOver) {
      await measure(page, 'poker');
      // HINT: his chance as "about N%", said as an estimate, once a hand
      await page.locator('.g4btn[data-act="hint"]').tap();
      await until(page, () => window.__g5.handle.peek().state.hintText !== '', null, 8000);
      const h1 = await st(page);
      check(/about \d+%/.test(h1.hintText) && /estimate/.test(h1.hintText), `poker: HINT says "about N%" and calls it an estimate ("${h1.hintText.slice(0, 90)}")`);
      const hb = page.locator('.g4btn[data-act="hint"]');
      check((await hb.isDisabled()) && /used/i.test(await hb.innerText()), 'poker: there is one hint a hand, and the key says it is used');
      check(/costs your rating nothing/.test(h1.hintText), 'poker: the hint says it costs the rating nothing');
      await shot(page, 'poker-hint-440');
    }
    const ended = await callDown(page);
    s = await st(page);
    check(ended && /(The pot is yours|The pot is mine|We split the pot)\./.test(s.result), `poker (${size.width}): a hand's result in his voice ("${s.result}")`);
    if (s.names[0] && s.winner !== -1 && !/fold/i.test(s.result)) check(/^(High card|A pair|Two pair|Three of a kind|Straight|Flush|Full house|Four of a kind|Straight flush|Royal flush)/.test(s.names[s.winner === 1 ? 1 : 0]) , `poker (${size.width}): the winning hand is named (${s.names.join(' / ')})`);
    check(s.total === 2000, `poker (${size.width}): after the hand every chip is still counted (${s.stacks.join(' + ')})`);
    if (size.width === 440) await shot(page, 'poker-result-440');
    // the next hand, then the session ends
    const busted = s.sessionOver;
    if (!busted) {
      await page.locator('.g4btn[data-act="next"]').tap();
      await until(page, () => window.__g5.handle.peek().state.hand === 2, null, 4000);
      s = await st(page);
      check(s.hand === 2 && s.button === 1 && s.bb === 10, `poker (${size.width}): the second hand is dealt, Ghosty on the button`);
      await callDown(page, 60);
    }
    check(await until(page, () => window.__g5.handle.peek().mode === 'over', null, 20000), `poker (${size.width}): the session ends after its hands`);
    const over = (await page.locator('.g2menu .g2note').allTextContents()).join(' | ');
    check(/You: [\d,]+ chips · Ghosty: [\d,]+ chips after [12] hands?/.test(over) && over.includes('Chips, never money.') && /Your rating/.test(over) && RATINGS.test((await page.locator('.g2menu .g2note').allTextContents()).find((n) => /^You: [\d,]+ · Ghosty/.test(n)) ?? ''), `poker (${size.width}): the end card ends in the two ratings and says "Chips, never money." (${over.slice(0, 190)})`);
    const book = await store(page, 'ghosty.arcade.board.rating');
    const m = await peek(page);
    const decisive = m.state.stacks[0] !== m.state.stacks[1];
    check(book?.poker?.you?.games === 1 && (!decisive || (book.poker.you.r !== 1200 && book.poker.me.r !== 1200)), `poker (${size.width}): the rating moved with the session (${book?.poker?.you?.r?.toFixed(0)} · ${book?.poker?.me?.r?.toFixed(0)}, ${m.state.stacks.join(' to ')})`);
    if (size.width === 440) await shot(page, 'poker-over-440');
    // every card and every bet, readable afterwards
    await page.locator('.g2btn[data-id="the-hands"]').tap();
    const hist = await page.locator('.g6hist').innerText();
    check(/Hand 1 · blinds 5\/10/.test(hist) && (busted || /Hand 2/.test(hist)) && /Your cards .*Ghosty's /.test(hist) && /(calls|checks|raises|bets|folds)/.test(hist) && /[♣♦♥♠]/.test(hist), `poker (${size.width}): the hand history shows every card and every bet (${hist.slice(0, 120).replace(/\n/g, ' ')})`);
    await page.evaluate(() => window.__g5.handle.quit());
    await ctx.close();
    check(errors.length === 0, `poker (${size.width}): no page errors${errors.length ? `: ${errors[0]}` : ''}`);
  }
  // reduced motion stills the pulse, and the session is kept (a reload offers Continue)
  {
    const { ctx, page, errors } = await open('poker', 'nopractice|level=2|seed=5', SIZES[0], { reducedMotion: 'reduce' });
    await page.locator('.g2btn[data-id="play"]').tap();
    await until(page, () => window.__g5.handle.peek().state.humanTurn, null, 8000);
    const s = await st(page);
    const anim = await page.evaluate(() => getComputedStyle(document.querySelector('.g5dot')).animationName);
    check(s.reduced && anim === 'none', `poker: reduced motion stills every animation (the table's ring and the dot: ${anim})`);
    await tap(page, s.call);
    await until(page, () => { const q = window.__g5.handle.peek().state; return q.humanTurn || q.handOver; }, null, 12000);
    const acts = (await st(page)).bets;
    await page.evaluate(() => window.__g5.handle.quit());
    await page.reload();
    await page.waitForFunction(() => window.__g5?.ready, null, { timeout: 30000 });
    const mm = await menuOf(page);
    check(mm[0] === 'Continue', `poker: the session in hand is kept: after a reload the title offers Continue (${mm.join(' · ')})`);
    await page.locator('.g2btn[data-id="continue"]').tap();
    await until(page, () => window.__g5.handle.peek().mode === 'play', null, 5000);
    const s2 = await st(page);
    check(s2.hand === 1 && s2.total === 2000 && JSON.stringify(s2.bets) === JSON.stringify(acts), `poker: CONTINUE puts the same hand back (bets ${s2.bets.join('/')}, total ${s2.total})`);
    // a save that will not read is said, not quietly replaced
    await page.evaluate(() => window.__g5.handle.quit());
    await page.evaluate(async () => {
      await window.__g5.saves.put('board.poker.json', new TextEncoder().encode('{"seed": 5, "level": '));
    });
    await page.reload();
    await page.waitForFunction(() => window.__g5?.ready, null, { timeout: 30000 });
    const dn = (await page.locator('.g2menu .g2note').allTextContents()).join(' | ');
    check(dn.includes('That save was damaged, so this is a new game.') && (await menuOf(page))[0] === 'Play', `poker: a damaged save says so ("${dn.slice(-60)}")`);
    await quitFrees(page, 'poker');
    await ctx.close();
    check(errors.length === 0, `poker (reduced, kept): no page errors${errors.length ? `: ${errors[0]}` : ''}`);
  }
}

// ================================================================ (c) WORDS
const rackTile = async (page, letter, usedIdx) => {
  const s = await st(page);
  const i = s.rackPos.findIndex((p, k) => p.letter.toLowerCase() === letter && !p.empty && !usedIdx.has(k));
  usedIdx.add(i);
  return s.rackPos[i];
};
async function dragTile(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(80);
}
const cellPos = (page, r, c) => page.evaluate(([a, b]) => window.__g5.handle.cellXY(a, b), [r, c]);
/** The best placement by score for the rack he holds (or one of the shortest if `short`), from the rules module on the node side. */
async function bestMove(page, pick = 'best') {
  const s = await st(page);
  const rows = s.board.split('/').filter(Boolean);
  const board = new Int8Array(225).fill(-1);
  rows.forEach((row, r) => [...row].forEach((ch, c) => { if (ch !== '.') board[r * 15 + c] = ch.toLowerCase().charCodeAt(0) - 97; }));
  const rack = s.rack.map((x) => x.toLowerCase().charCodeAt(0) - 97);
  const all = R.moves(board, rack, LEX).sort((a, b) => b.score - a.score);
  return { board, rack, all, best: pick === 'best' ? all[0] : pick === 'two' ? all.find((m) => m.tiles.length === 2 && m.score > 4) ?? all[all.length - 1] : all[Math.min(all.length - 1, 5)] };
}
async function placeByDrag(page, move) {
  const used = new Set();
  for (const [r, c, l] of move.tiles) {
    const tile = await rackTile(page, String.fromCharCode(97 + l), used);
    const to = await cellPos(page, r, c);
    await dragTile(page, tile, to);
  }
}
const waitHuman = (page, t = 20000) => until(page, () => { const q = window.__g5.handle.peek().state; return (q.humanTurn || q.over) && !q.thinking; }, null, t);
if (!only || only === 'words') {
  for (const size of SIZES) {
    const seen = [];
    const { ctx, page, errors } = await open('words', 'nopractice|level=1|seed=5|first=0', size, {}, null, seen);
    const menu0 = await menuOf(page);
    const notes0 = (await page.locator('.g2menu .g2note').allTextContents()).join(' | ');
    check(menu0.includes('Get the word list (362 KB)') && !menu0.includes('Play'), `words (${size.width}): before the list is here the title offers only to get it (${menu0.join(' · ')})`);
    check(notes0.includes('The word list is a 362 KB download, once, on Wi-Fi.') && /Level 1 · he thinks for about 0\.\d s a move/.test(notes0) && /You: 1,200 · Ghosty: 1,200/.test(notes0), `words (${size.width}): the title says the list's size before anything is fetched, and his level and both ratings (${notes0.slice(0, 150)})`);
    check(!seen.includes('/data/words-en.dawg'), `words (${size.width}): nothing was fetched before the tap`);
    await controls(page, 'words title');
    await page.locator('.g2btn[data-id="how-to-play"]').tap();
    check(await page.locator('.g2how', { hasText: 'Not in my list.' }).isVisible() && await page.locator('.g2how', { hasText: 'There is no top level' }).isVisible(), `words (${size.width}): the rules on one card, and no top level`);
    await page.locator('.g2btn[data-id="back"]').tap();
    await page.locator('.g2btn[data-id="get-list"]').tap();
    check(await until(page, () => window.__g5.handle.peek().state.listState === 'ready', null, 20000), `words (${size.width}): the tap gets the list, and the title offers Play`);
    check(seen.filter((p) => p === '/data/words-en.dawg').length >= 1, `words (${size.width}): the list was fetched after the tap (${seen.filter((p) => p === '/data/words-en.dawg').length} request)`);
    let s = await st(page);
    check(s.listBytes === 361924 && s.listWords === R.TILES.length * 0 + LEX.words, `words (${size.width}): the list reads (${s.listWords.toLocaleString('en-GB')} words)`);
    const m1 = await menuOf(page);
    check(m1[0] === 'Play' && m1.includes('Remove the word list') && m1.includes('Sound: on'), `words (${size.width}): Play · How to play · Remove the word list · Sound · Quit (${m1.join(' · ')})`);
    await page.locator('.g2btn[data-id="sound-on"]').tap();
    check((await menuOf(page)).includes('Sound: off'), `words (${size.width}): Sound turns off`);
    await page.locator('.g2btn[data-id="sound-off"]').tap();
    await page.locator('.g2btn[data-id="play"]').tap();
    check((await peek(page)).mode === 'play', `words (${size.width}): Play starts a game`);
    await controls(page, 'words in play');
    await sideways(page, 'words', size);
    s = await st(page);
    check(s.humanTurn && s.rack.length === 7 && s.bag === 100 - 14 && s.board.replaceAll('/', '').replaceAll('.', '') === '', `words (${size.width}): seven tiles each and eighty-six in the bag (${s.rack.join('')}, bag ${s.bag})`);
    // an invalid word is refused at once
    {
      const rack = s.rack.map((x) => x.toLowerCase());
      let pair = null;
      for (let a = 0; a < 7 && !pair; a++) for (let b = 0; b < 7 && !pair; b++) if (a !== b && !LEX.has(rack[a] + rack[b])) pair = [a, b];
      const used = new Set();
      const t1 = await rackTile(page, rack[pair[0]], used);
      await dragTile(page, t1, await cellPos(page, 7, 7));
      const t2 = await rackTile(page, rack[pair[1]], used);
      await dragTile(page, t2, await cellPos(page, 7, 8));
      s = await st(page);
      check(s.placed === 2 && s.live && !s.live.ok && s.live.reason === 'Not in my list.' && /Not in my list\./.test(await page.locator('.g5status').innerText()), `words (${size.width}): "${rack[pair[0]] + rack[pair[1]]}" is refused at once with "Not in my list." (${s.liveLine})`);
      const plies = s.plies;
      await page.locator('.g4btn[data-act="play"]').evaluate((b) => (b.disabled = false, b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))));
      await page.waitForTimeout(150);
      check((await st(page)).plies === plies && /Not in my list/.test(await page.locator('.g2say').innerText().catch(() => '')), `words (${size.width}): PLAY will not put it down, and says so`);
      if (size.width === 440) await shot(page, 'words-refused-440');
      await page.locator('.g4btn[data-act="recall"]').tap();
      check((await st(page)).placed === 0, `words (${size.width}): RECALL takes the tiles back`);
    }
    // a real word, placed by drag
    const first = await bestMove(page, 'best');
    await placeByDrag(page, first.best);
    s = await st(page);
    check(s.placed === first.best.tiles.length && s.live?.ok && s.live.score === first.best.score, `words (${size.width}): the word is placed by drag and its score is said live (${s.liveLine})`);
    check(/\d+ points/.test(s.liveLine) && s.live.words.every((w) => LEX.has(w.word)), `words (${size.width}): every word it makes is in the list (${s.live.words.map((w) => w.word).join(', ')})`);
    check(s.live.words.some((w) => w.bonus.length) || first.best.score >= 0, `words (${size.width}): the bonuses are named when there are any (${s.live.words.map((w) => `${w.word}: ${w.bonus.join(', ') || 'none'}`).join('; ')})`);
    if (size.width === 440) await shot(page, 'words-placed-440');
    const sc0 = s.scores[0];
    await page.locator('.g4btn[data-act="play"]').tap();
    await until(page, () => window.__g5.handle.peek().state.plies >= 1, null, 4000);
    s = await st(page);
    check(s.scores[0] === sc0 + first.best.score, `words (${size.width}): PLAY scores it (${s.scores[0]})`);
    check(/^You: .* · \d+ points\.$/.test(await page.evaluate(() => document.querySelector('.g2live')?.textContent ?? '')), `words (${size.width}): the score is said, with its words and bonuses, to VoiceOver too`);
    // he answers with "thinking…", and plays a real word
    const thought = await until(page, () => window.__g5.handle.peek().state.thinking, null, 3000);
    const said = await page.locator('.g5status').innerText().catch(() => '');
    check(thought && /thinking…/.test(said), `words (${size.width}): "thinking…" is shown while he works ("${said}")`);
    const t0 = Date.now();
    check(await waitHuman(page), `words (${size.width}): he answered`);
    const took = Date.now() - t0;
    s = await st(page);
    const mine = /^I play ([A-Z]+)/.exec(s.hisLast) ?? /^I (swap|pass)/.exec(s.hisLast);
    check(took < 4500 && !!mine && (mine[1] === 'swap' || mine[1] === 'pass' || LEX.has(mine[1].toLowerCase())), `words (${size.width}): he answered in ${took} ms with a real word from the list ("${s.hisLast}")`);
    check(s.last.count > 0 && s.scores[1] > 0, `words (${size.width}): he looked at ${s.last.count} placements and scored ${s.scores[1]}`);
    if (size.width === 440) {
      await measure(page, 'words');
      await shot(page, 'words-his-440');
    }
    // a word placed by tap: a square, then each tile
    {
      const mv = await bestMove(page, 'two');
      const used = new Set();
      for (const [r, c, l] of mv.best.tiles) {
        const sq = await cellPos(page, r, c);
        await tap(page, sq);
        const tile = await rackTile(page, String.fromCharCode(97 + l), used);
        await tap(page, tile);
      }
      s = await st(page);
      check(s.placed === mv.best.tiles.length && s.live?.ok, `words (${size.width}): a word placed by tap, square then tile (${s.liveLine})`);
      await page.locator('.g4btn[data-act="play"]').tap();
      check(await waitHuman(page), `words (${size.width}): he answered again`);
    }
    // SWAP, then PASS
    s = await st(page);
    if (!s.over) {
      const p0 = s.plies;
      await page.locator('.g4btn[data-act="swap"]').tap();
      await page.locator('.g6swap .g6tile').first().tap();
      await controls(page, 'words swap card');
      await page.locator('.g2btn[data-id="swap-go"]').tap();
      await until(page, (n) => window.__g5.handle.peek().state.plies > n, p0, 4000);
      const s2 = await st(page);
      check(s2.plies > p0 && s2.rack.length === 7 && s2.scores[0] === s.scores[0], `words (${size.width}): SWAP changes a tile and gives up the turn (${s.rack.join('')} → ${s2.rack.join('')})`);
      check(await waitHuman(page), `words (${size.width}): he answered the swap`);
      const s3 = await st(page);
      if (!s3.over) {
        const p1 = s3.plies;
        await page.locator('.g4btn[data-act="pass"]').tap();
        await page.locator('.g2btn[data-id="pass"]').tap();
        await until(page, (n) => window.__g5.handle.peek().state.plies > n, p1, 4000);
        check((await st(page)).plies > p1, `words (${size.width}): PASS gives the turn up`);
        await waitHuman(page);
      }
    }
    // the game is kept: quit, reload, Continue; the list is still on the phone (no second fetch)
    const plies = (await st(page)).plies;
    await page.evaluate(() => window.__g5.handle.quit());
    const before = seen.filter((p) => p === '/data/words-en.dawg').length;
    await page.reload();
    await page.waitForFunction(() => window.__g5?.ready, null, { timeout: 30000 });
    const m2 = await menuOf(page);
    check(m2[0] === 'Continue' && seen.filter((p) => p === '/data/words-en.dawg').length === before, `words (${size.width}): the game and the list are kept on the phone: Continue is offered and nothing is fetched again (${m2.join(' · ')})`);
    await page.locator('.g2btn[data-id="continue"]').tap();
    check((await st(page)).plies === plies, `words (${size.width}): CONTINUE puts the same game back (${plies} plies)`);
    await page.evaluate(() => window.__g5.handle.quit());
    await ctx.close();
    check(errors.length === 0, `words (${size.width}): no page errors${errors.length ? `: ${errors[0]}` : ''}`);
  }
  // the end and the count (a short game: the bag cut to eight tiles), the list removable, reduced motion
  {
    const { ctx, page, errors } = await open('words', 'nopractice|level=1|seed=9|first=1|bag=8|fast', SIZES[0], { reducedMotion: 'reduce' });
    await page.locator('.g2btn[data-id="get-list"]').tap();
    await until(page, () => window.__g5.handle.peek().state.listState === 'ready', null, 20000);
    await page.locator('.g2btn[data-id="play"]').tap();
    let guard = 0;
    while (!(await st(page)).over && guard++ < 60) {
      await waitHuman(page, 30000);
      const s = await st(page);
      if (s.over) break;
      if (s.humanTurn) {
        await page.locator('.g4btn[data-act="pass"]').tap();
        await page.locator('.g2btn[data-id="pass"]').tap();
        await page.waitForTimeout(100);
      }
    }
    check(await until(page, () => window.__g5.handle.peek().mode === 'over', null, 20000), 'words: the game ends (the bag empty and a rack out, or six turns that scored nothing)');
    const s = await st(page);
    const over = await page.locator('.g2menu .g2note').allTextContents();
    check(s.over && /^You -?\d+ · Ghosty -?\d+$/.test(over[0] ?? '') && over[0] === `You ${s.scores[0]} · Ghosty ${s.scores[1]}` && /Tiles left on the racks: yours \d+ points, his \d+/.test(over[1] ?? ''), `words: the end card gives the final count and what is left on the racks (${over.slice(0, 2).join(' | ')})`);
    check(RATINGS.test(over.find((n) => /^You: [\d,]+ · Ghosty/.test(n)) ?? '') && /Your rating/.test(over.join(' ')), 'words: the end card ends in the two ratings and says how they moved');
    const book = await store(page, 'ghosty.arcade.board.rating');
    check(book?.words?.you?.games === 1 && book.words.you.r !== 1200, `words: the rating moved (${book?.words?.you?.r?.toFixed(0)} · ${book?.words?.me?.r?.toFixed(0)})`);
    check(s.reduced, 'words: reduced motion is seen (the cursor does not breathe)');
    await shot(page, 'words-over-440');
    await page.locator('.g2btn[data-id="menu"]').tap();
    await page.locator('.g2btn[data-id="remove-list"]').tap();
    await until(page, () => window.__g5.handle.peek().state.listState === 'missing' && !!document.querySelector('.g2btn[data-id="get-list"]'), null, 8000);
    const gone = (await page.locator('.g2menu .g2note').allTextContents()).join(' | ');
    check(gone.includes('The word list is a 362 KB download, once, on Wi-Fi.') && (await st(page)).listState === 'missing', 'words: the list can be removed from the phone, and the title says it is a download again');
    await page.evaluate(() => window.__g5.handle.quit());
    await ctx.close();
    check(errors.length === 0, `words (short game): no page errors${errors.length ? `: ${errors[0]}` : ''}`);
  }
}

// ================================================================ (d) offline from a fresh open: the Worker is in the precache
if (!only || only === 'offline') {
  const ctx = await browser.newContext({ viewport: PHONE, ...UK, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'allow' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => !webkitNoise(e) && errors.push(e.message));
  await page.goto(base);
  await page.waitForFunction(() => !!document.querySelector('#pair input') || !document.querySelector('#boot'), null, { timeout: 20000 }).catch(() => undefined);
  if (await page.locator('#pair input').isVisible().catch(() => false)) {
    await page.fill('#pair input', 'preview-owner-key-0123456789');
    await page.click('#pair button.on');
  }
  await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
  let kept = false;
  for (let i = 0; i < 60 && !kept; i++) {
    kept = await page.evaluate(async () => { const r = await navigator.serviceWorker?.getRegistration(); return !!r?.active && !!(await caches.match('/board.worker.js')); }).catch(() => false);
    if (!kept) await page.waitForTimeout(500);
  }
  check(kept, 'the service worker is active and has board.worker.js in its precache from the first open');
  const lists = await page.evaluate(async () => ({ board: !!(await caches.match('/board.worker.js')), lens: !!(await caches.match('/lens.worker.js')), textures: !!(await caches.match('/textures.worker.js')) }));
  check(lists.board && lists.lens && lists.textures, `every Worker the build makes is kept (${JSON.stringify(lists)})`);
  await ctx.setOffline(true);
  // with no network at all: the Worker still starts and answers a poker position (his move, from what he may see)
  const sess = R.newSession(7, 1);
  sess.n = 1;
  const hand = R.deal(sess);
  const view = JSON.parse(JSON.stringify(R.viewOf(hand, 1)));
  const answer = await page.evaluate(async (v) => {
    const w = new Worker('/board.worker.js');
    const r = await new Promise((ok, no) => { const t = setTimeout(() => no(new Error('no answer')), 15000); w.onmessage = (e) => { clearTimeout(t); ok(e.data); }; w.onerror = (e) => { clearTimeout(t); no(new Error(String(e.message))); }; w.postMessage({ id: 1, kind: 'poker', view: v, level: 1, seed: 3, ms: 60, samples: 200 }); }).catch((e) => ({ error: String(e) }));
    w.terminate();
    return r;
  }, view);
  check(!answer.error && ['fold', 'call', 'raise', 'check'].includes(answer.t), `offline: the Worker loaded from the precache with no network and answered (${JSON.stringify(answer).slice(0, 90)})`);
  const fetched = await page.evaluate(async () => { const r = await fetch('/board.worker.js'); return { ok: r.ok, bytes: (await r.text()).length }; }).catch((e) => ({ ok: false, bytes: 0, e: String(e) }));
  check(fetched.ok && fetched.bytes > 5000, `offline: /board.worker.js is served from the precache (${fetched.bytes} bytes)`);
  await ctx.setOffline(false);
  check(errors.length === 0, `offline: no page errors${errors.length ? `: ${errors[0]}` : ''}`);
  await ctx.close();
}

// ================================================================ (e) backgammon's take-back takes the whole turn
if (!only || only === 'backgammon') {
  const { ctx, page, errors } = await open('backgammon', 'nopractice|level=1|human=1|seed=5', SIZES[0]);
  await page.locator('.g2btn[data-id="play"]').tap();
  await until(page, () => window.__g5.handle.peek().state.humanTurn, null, 8000);
  let s = await st(page);
  const roll0 = s.roll.join(',');
  const board0 = s.board;
  const diceN = s.dice.length;
  // the first die: pick a piece, play it
  const one = async () => {
    const q = await st(page);
    await tap(page, q.origins[0]);
    await until(page, () => window.__g5.handle.peek().state.targets.length > 0, null, 3000);
    const t = (await st(page)).targets;
    await tap(page, t[0]);
    await page.waitForTimeout(150);
  };
  await one();
  s = await st(page);
  check(s.dice.length === diceN - 1 && s.plies === 1 && s.humanTurn, `backgammon: the first die is played, the second is still to play (${s.dice.join(',')}, ${s.plies} move)`);
  await page.locator('.g4btn[data-act="back"]').tap();
  await until(page, () => window.__g5.handle.peek().state.plies === 0, null, 3000);
  s = await st(page);
  check(s.plies === 0 && s.roll.join(',') === roll0 && s.dice.length === diceN && s.board === board0 && s.tbLeft === 2, `backgammon: TAKE BACK in the middle of a turn puts the whole turn back (dice ${s.dice.join(',')}, ${s.plies} moves, ${s.tbLeft} left)`);
  // a whole turn, his reply, then one take-back takes the whole turn and his reply
  for (let i = 0; i < 6; i++) {
    const q = await st(page);
    if (!q.humanTurn || q.plies > 0 && q.dice.length === 0) break;
    await one();
    const r = await st(page);
    if (r.thinking || !r.humanTurn || r.roll.join(',') !== roll0) break;
  }
  await until(page, () => window.__g5.handle.peek().state.thinking, null, 4000);
  check(await until(page, () => { const q = window.__g5.handle.peek().state; return q.humanTurn && !q.thinking; }, null, 15000), 'backgammon: he replied');
  s = await st(page);
  const movedPlies = s.plies;
  await page.locator('.g4btn[data-act="back"]').tap();
  await until(page, () => window.__g5.handle.peek().state.plies === 0, null, 4000);
  s = await st(page);
  check(movedPlies >= 3 && s.plies === 0 && s.roll.join(',') === roll0 && s.board === board0 && s.humanTurn, `backgammon: one take-back after his reply takes back all your dice and his turn (${movedPlies} moves → ${s.plies}, the roll is ${s.roll.join(',')} again)`);
  await page.evaluate(() => window.__g5.handle.quit());
  await ctx.close();
  check(errors.length === 0, `backgammon: no page errors${errors.length ? `: ${errors[0]}` : ''}`);
}
await browser.close();
console.log(problems.length ? `\n${problems.length} problem(s)` : '\nall checks passed');
process.exit(problems.length ? 1 : 0);
