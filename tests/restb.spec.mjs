// BATCH 8 PART B (BRIEF-REST-B) on the owner's phone (440 × 956) and a narrow 390 × 844:
//  1. CHESS WITH A REAL RATING — the GYM's CHESS shows the rated section with "Not rated yet"; RATED GAME starts a game
//     against the vendored Stockfish (the real WebAssembly engine, loaded under the app's security policy), his first move
//     is answered by the engine, HINT names a move in words and makes the game unrated, RESIGN of a hint-free game is a rated
//     loss that gives a rating and shows it on the card ("You: about … · ±…"), CHECK MY GAME names what the game cost;
//     RATE ME has Ghosty play the engine; the chat answers "what's my chess rating?" from this phone.
//  2. THE COACH (the tuner through a fake microphone, a lesson, typing, drawing, words) and 3. THE REVIEW LINK (/demo, its separation
//     from the real app, /demo/tour) are the sections below it
//  4. THE FIRST RUN on a fresh deployment: the wizard makes the key, shows its fingerprint, pairs, names him, saves Home, says three things
//   BASE=http://localhost:8733 node tests/restb.spec.mjs tests/.shots
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, standDown } from './nav.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const problems = [];
const t0 = Date.now();
// ONLY=chess|coach|demo|firstrun runs one section (while it is being worked on); with nothing set every section runs
const want = (n) => !process.env.ONLY || process.env.ONLY === n;
await standDown(base, KEY);
const log = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s · ${s}`);
const check = (ok, msg) => {
  if (!ok) problems.push(msg);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
};

// The fake microphone plays a WAV made here, over and over: an A4 (440 Hz), a low E (82.41 Hz, a guitar's) and a G3 detuned
// 20 cents sharp, a second and a half each with a gap, so the tuner is read on tones made in code.
const SR = 48000;
function wav(samples) {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + samples.length * 2, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  return b;
}
const pluck = (hz, secs) => Array.from({ length: Math.round(SR * secs) }, (_, i) => 0.35 * (Math.sin((2 * Math.PI * hz * i) / SR) + 0.5 * Math.sin((2 * Math.PI * 2 * hz * i) / SR) + 0.25 * Math.sin((2 * Math.PI * 3 * hz * i) / SR)) / 1.75);
const quiet = (secs) => new Array(Math.round(SR * secs)).fill(0);
const G3_SHARP = 196 * 2 ** (20 / 1200);
const micFile = join(tmpdir(), `restb-fake-mic-${process.pid}.wav`);
writeFileSync(micFile, wav([...pluck(440, 1.5), ...quiet(0.4), ...pluck(82.4069, 1.5), ...quiet(0.4), ...pluck(G3_SHARP, 1.5), ...quiet(0.4)]));

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${micFile}`, '--autoplay-policy=no-user-gesture-required'] });
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
    // the speech recogniser's stand-in: it hears the word that was asked (the specs run no real speech)
    window.__ghostyListen = async (want) => want;
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
if (want('chess')) {
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

// ================================================================ 2. THE INSTRUMENT AND SKILLS COACH
if (want('coach')) {
  const { ctx, page } = await phone(PHONE);
  log('coach');
  const coach = () => state(page, 'coach');
  const sheet = () => page.locator('.modal .coach');
  const closeSheet = () => page.evaluate(() => document.querySelector('.modal .mhead button')?.click());

  // THE TUNER, from the fake microphone's tones made in code
  await say(page, 'tune my guitar');
  await page.waitForSelector('.modal .coach', { timeout: 15000 });
  check((await coach()).open === 'tuner', 'the chat opened the tuner for "tune my guitar"');
  check(/Nothing is recorded or sent/.test(await lastReply(page)), 'the chat says nothing is recorded or sent');
  await page.locator('.modal .cotuner button', { hasText: 'START' }).click();
  await until(page, () => window.__ghosty?.coach?.tuner?.on, null, 15000, 'the tuner did not start (the fake microphone)');
  await until(page, () => window.__ghosty.coach.tuner.note === 'A4', null, 30000, 'the needle never read A4 from the 440 Hz tone');
  let c = await coach();
  check(c.tuner.note === 'A4' && Math.abs(c.tuner.cents) <= 5, `the needle reads A4 (${c.tuner.note}, ${c.tuner.cents} cents, ${c.tuner.hz} Hz)`);
  await until(page, () => window.__ghosty.coach.tuner.note === 'E2', null, 30000, 'the tuner never read the low E');
  c = await coach();
  check(c.tuner.string === 'E2' && Math.abs(c.tuner.cents) <= 6, `a low E reads as the E2 string (${c.tuner.words})`);
  await until(page, () => window.__ghosty.coach.tuner.note === 'G3', null, 30000, 'the tuner never read the detuned G');
  c = await coach();
  check(c.tuner.string === 'G3' && !c.tuner.inTune && c.tuner.cents > 14 && c.tuner.cents < 26 && /cents sharp/.test(c.tuner.words), `a G 20 cents sharp reads sharp (${c.tuner.cents} cents: ${c.tuner.words})`);
  const needle = await page.locator('.modal .coneedle').evaluate((e) => parseFloat(e.style.left));
  check(needle > 50, `the needle sits right of centre for a sharp note (${needle}%)`);
  await page.screenshot({ path: `${out}/restb-tuner.png` });
  await page.locator('.modal .cotuner button', { hasText: 'STOP' }).click();
  check(!(await coach()).tuner.on, 'STOP lets the microphone go');
  await closeSheet();
  await say(page, 'am I in tune?');
  await page.waitForSelector('.modal .coach', { timeout: 15000 });
  c = await coach();
  check(c.open === 'tuner' && c.tuner.instrument === 'free', `"am I in tune?" opens the tuner for any note (${c.tuner.instrument})`);
  await closeSheet();

  // LESSONS: the list, a lesson's first step, a run to the end
  await say(page, 'teach me guitar');
  await page.waitForSelector('.modal .colessons', { timeout: 15000 });
  check((await page.locator('.modal .colessons .colbtn').count()) === 10, 'ten guitar lessons are listed');
  check(/Guitar: 0 of 10 passed\. Next: lesson 1, open strings, low to high/.test(await page.locator('.modal .copractice').innerText()), 'what to practise next is said: lesson 1');
  await page.locator('.modal .colessons .colbtn').first().click();
  check((await page.locator('.modal .costep').count()) === 6, 'lesson 1 shows its six steps: E A D G B E');
  check(/Pluck each open string once/.test(await page.locator('.modal .cohow').innerText()), "the lesson's first step is in plain words");
  await page.screenshot({ path: `${out}/restb-lesson.png` });
  await page.locator('.modal .colessons button', { hasText: /^START$/ }).click();
  await until(page, () => ['ready', 'play'].includes(window.__ghosty?.coach?.lesson?.phase), null, 15000, 'the lesson did not count in');
  await until(page, () => window.__ghosty.coach.lesson.phase === 'done', null, 60000, 'the lesson did not finish and score');
  c = await coach();
  check(c.lesson.score >= 0 && c.lesson.score <= 1 && /\d+%/.test(c.lesson.summary), `the lesson is scored from what the mic heard (${c.lesson.summary})`);
  check(c.streak >= 1, `the day counts toward the streak (${c.streak})`);
  check(/-day streak/.test(await sheet().locator('.costreak').innerText()), 'the streak is on the sheet');
  check((await page.locator('.modal .coresult').innerText()).length > 20, 'the result says what to fix and what is next');
  await page.screenshot({ path: `${out}/restb-lesson-done.png` });
  await closeSheet();

  // TYPING
  await say(page, 'typing test');
  await page.waitForSelector('.modal .cotyping', { timeout: 15000 });
  const target = (await coach()).typing.target;
  check(target.length > 40, `a passage to type (${target.length} characters)`);
  await page.locator('.modal .cotype').click();
  // (60 ms a key, about 200 words a minute at most: at 25 ms a fast runner typed the short passage at 408 wpm, past the check's
  // own ceiling of 400 (CI, 1 Nov); the coach records any speed, the ceiling is this spec's sanity bound)
  await page.keyboard.type(target, { delay: 60 });
  await until(page, () => window.__ghosty.coach.typing.done, null, 30000, 'the typing test did not finish');
  c = await coach();
  check(c.typing.accuracy === 1 && c.typing.wpm > 20 && c.typing.wpm < 400, `a clean run scores 100% (${c.typing.wpm} wpm, ${c.typing.accuracy})`);
  check(/Every key was right/.test(await page.locator('.modal .cotyping .coresult').innerText()), 'it says every key was right');
  await page.locator('.modal .cotyping button', { hasText: 'ANOTHER PASSAGE' }).click();
  const next = (await coach()).typing.target;
  await page.locator('.modal .cotype').click();
  // a typo: the first "e" of the passage is typed as "x"
  const at = next.indexOf('e');
  await page.keyboard.type(next.slice(0, at) + 'x' + next.slice(at + 1), { delay: 20 });
  await until(page, () => window.__ghosty.coach.typing.done, null, 30000, 'the second typing test did not finish');
  c = await coach();
  check(c.typing.accuracy < 1 && c.typing.weak.includes('e'), `a missed key is named as a weak one (${c.typing.weak.join(', ')}, ${c.typing.accuracy})`);
  await closeSheet();

  // DRAW: the prompt of the day, his picture beside it
  await say(page, 'what should I draw?');
  await page.waitForSelector('.modal .codraw', { timeout: 15000 });
  const prompt = (await coach()).draw.prompt;
  check(/^Draw .+, .+\.$/.test(prompt), `a prompt of the day: "${prompt}"`);
  check(/Draw/.test(await page.locator('.modal .codrawtext').innerText()), 'the prompt is on the sheet');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await page.locator('.modal .codraw input[type=file]').setInputFiles({ name: 'drawing.png', mimeType: 'image/png', buffer: png });
  await page.waitForSelector('.modal .codrawpic img', { timeout: 10000 });
  check((await coach()).draw.done, 'his picture sits beside the prompt');
  check(/I do not mark/.test(await page.locator('.modal .codraw').innerText()), 'it says it does not mark drawings');
  await closeSheet();

  // WORDS: ten a day in a language, said back (the recogniser stood in for), scored
  await say(page, 'Spanish word of the day');
  await page.waitForSelector('.modal .cowords', { timeout: 15000 });
  c = await coach();
  check(c.words.language === 'es' && c.words.list.length === 10, `ten Spanish words today (${c.words.list.join(', ')})`);
  await page.locator('.modal .coword').first().locator('button', { hasText: 'SAY IT' }).click();
  await until(page, () => window.__ghosty.coach.words.results[0] === 'right', null, 10000, 'a word said back was not scored');
  check(/1 of 10 said back today/.test(await page.locator('.modal .coscore').innerText()), 'one of ten said back is counted');
  await page.locator('.modal .cowords button', { hasText: 'FRENCH' }).click();
  c = await coach();
  check(c.words.language === 'fr' && c.words.list.length === 10 && c.words.list[0] !== 'hola', `French has its own ten (${c.words.list.slice(0, 3).join(', ')}…)`);
  await page.screenshot({ path: `${out}/restb-words.png` });
  await closeSheet();

  // juggling by camera is not in, and the chat says so
  await say(page, 'teach me to juggle');
  await until(page, () => /are not in/.test([...document.querySelectorAll('#pg-core .msg:not(.me)')].map((m) => m.textContent ?? '').pop() ?? ''), null, 15000, 'the chat did not say juggling is not in');
  check(/camera cannot follow/.test(await lastReply(page)), 'juggling and tricks by camera are said not to be in, and why');
  await ctx.close();

  // at 390 × 844: nothing sideways, every control named
  const narrow = await phone({ width: 390, height: 844 });
  for (const [words, root] of [['tune my guitar', '.modal .cotuner'], ['teach me guitar', '.modal .colessons'], ['typing test', '.modal .cotyping'], ['what should I draw?', '.modal .codraw'], ['Spanish word of the day', '.modal .cowords']]) {
    await say(narrow.page, words);
    await narrow.page.waitForSelector(root, { timeout: 15000 });
    const bad = await sideways(narrow.page, '.modal .coach, .modal .coach *');
    check(bad.length === 0, `nothing sticks out sideways at 390 px: ${words} (${bad.join('; ')})`);
    const un = await unnamed(narrow.page, '.modal .coach');
    check(un.length === 0, `every control has a name for VoiceOver: ${words} (${un.join(', ')})`);
    await narrow.page.evaluate(() => document.querySelector('.modal .mhead button')?.click());
  }
  await narrow.ctx.close();
}

// ================================================================ 3. THE REVIEW LINK
if (want('demo')) {
  log('demo');
  // the owner's own app first: paired, with its key and a setting saved in this browser's storage
  const real = await phone(PHONE);
  await real.page.evaluate(() => localStorage.setItem('ghosty.restb.marker', 'the-owners-own'));
  const ownerKeyBefore = await real.page.evaluate(() => localStorage.getItem('ghosty.ownerKey'));
  check(ownerKeyBefore === KEY, 'the real app is paired with its owner key in this browser');
  // the demo, opened in the same browser (the same address and storage): it must see none of it
  await real.page.goto(`${base}/demo`, { waitUntil: 'domcontentloaded' });
  await real.page.waitForSelector('#demobar', { timeout: 15000 });
  await real.page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
  const bar = await real.page.locator('#demobar').innerText();
  check(/This is a demo of Ghosty with sample data/.test(bar), `the banner says so ("${bar.replace(/\s+/g, ' ').slice(0, 80)}")`);
  const inDemo = await real.page.evaluate(() => ({ demo: window.__GHOSTY_DEMO__, storage: window.__GHOSTY_DEMO_STORAGE__, key: localStorage.getItem('ghosty.ownerKey'), settings: localStorage.getItem('ghosty.restb.marker') }));
  check(inDemo.demo === true && inDemo.storage === 'memory', `the demo keeps its own storage in memory (${inDemo.storage})`);
  check(inDemo.key !== KEY && /^demo-visitor-key/.test(inDemo.key) && inDemo.settings === null, 'the demo sees neither the owner key nor anything else the real app saved here');
  check(await real.page.locator('#pair, #pairform').count() === 0 || !(await real.page.locator('#pair input').isVisible().catch(() => false)), 'the demo asks for no key');
  await real.page.evaluate(() => (location.hash = 'core'));
  await real.page.waitForSelector('#cin', { timeout: 15000 });
  // the demo's chat says this is the demo to anything that acts
  await say(real.page, "email my boss that I'm running late");
  await until(real.page, () => /This is the demo/.test([...document.querySelectorAll('#pg-core .msg:not(.me)')].map((m) => m.textContent ?? '').pop() ?? ''), null, 20000, 'the demo chat did not say this is the demo');
  await say(real.page, "what's on tomorrow?");
  await until(real.page, () => /sample week/.test([...document.querySelectorAll('#pg-core .msg:not(.me)')].map((m) => m.textContent ?? '').pop() ?? ''), null, 20000, "the demo chat did not read Sam's sample week");
  check(/Library shift|Guitar practice|Spanish/.test(await lastReply(real.page)), 'it reads the sample week back');
  // a request that would change something is refused by the demo's door, whoever makes it
  const refused = await real.page.evaluate(async () => {
    const r = await fetch('/api/keys', { method: 'POST', headers: { 'x-ghosty': '1', 'content-type': 'application/json' }, body: JSON.stringify({ name: 'github', value: 'ghp_x' }) });
    return { status: r.status, body: await r.json() };
  });
  check(refused.status === 403 && /this is the demo/i.test(refused.body.error), `changing a key is refused in the demo ("${refused.body.error.slice(0, 50)}…")`);
  // the sample data is on the screens
  await real.page.evaluate(() => (location.hash = 'agenda'));
  await until(real.page, () => /Guitar practice|Library shift/.test(document.body.innerText), null, 20000, "Sam's sample week is not on the Agenda");
  check(true, "Sam's sample week is on the Agenda");
  await real.page.screenshot({ path: `${out}/restb-demo.png` });
  const sw = await sideways(real.page, '#demobar, #demobar *');
  check(sw.length === 0, 'the banner stays inside the screen');
  // back to the real app: its key and settings are exactly as they were
  await real.page.goto(base, { waitUntil: 'domcontentloaded' });
  await real.page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
  const after = await real.page.evaluate(() => ({ key: localStorage.getItem('ghosty.ownerKey'), marker: localStorage.getItem('ghosty.restb.marker') }));
  check(after.key === KEY && after.marker === 'the-owners-own', `the real app’s key and what it saved are untouched by the demo (${after.key === KEY ? 'key kept' : 'KEY CHANGED'}, marker ${after.marker ?? 'GONE'})`);
  // and the owner's own brain has nothing of the demo in it
  const mem = await fetch(`${base}/api/memory`, { headers: { 'x-ghosty': '1', 'x-ghosty-key': KEY } }).then((r) => r.json());
  check(!mem.facts.some((f) => /Sam/.test(f.text)), 'the owner’s brain holds none of the demo’s sample facts');
  const ownerAsDemo = await fetch(`${base}/api/memory`, { headers: { 'x-ghosty': '1', 'x-ghosty-key': KEY, 'x-ghosty-demo': '1' } }).then((r) => r.json());
  check(ownerAsDemo.facts.some((f) => f.text === 'My name is Sam.') && !ownerAsDemo.facts.some((f) => !/Sam|guitar|Spanish|vegetarian|Alex|bike|two sentences|walk/i.test(f.text)), 'with the demo mark the owner key still reads only the demo’s sample facts');
  await real.ctx.close();

  // THE TOUR, on a phone
  const tour = await phone({ width: 390, height: 844 }, { permissions: ['clipboard-read', 'clipboard-write'] });
  await tour.page.goto(`${base}/demo/tour`, { waitUntil: 'domcontentloaded' });
  await tour.page.waitForSelector('h1', { timeout: 15000 });
  const text = await tour.page.locator('main').innerText();
  const total = Number(/I can do (\d+) things/.exec(text)?.[1] ?? 0);
  check(total > 400, `the tour counts what Ghosty can do from the catalogue (${total} things)`);
  for (const h of ['What I am', 'What I can do', 'The lines that hold', 'What to try', 'What you cannot see', 'What you think']) check(text.includes(h), `the tour has “${h}”`);
  check(/Nothing of the owner's data is here/.test(text) && /Nothing here bills/.test(text) && /Only lessons and music of our own/.test(text), 'the lines that hold are said');
  check((await tour.page.locator('form').count()) === 0, 'the tour has no form');
  const sc = await sideways(tour.page, 'main, main *');
  check(sc.length === 0, `nothing sticks out sideways on the tour at 390 px (${sc.join('; ')})`);
  await tour.page.locator('#notes').fill('Liked the tuner. The chat felt scripted.');
  await tour.page.locator('#copy').click();
  await until(tour.page, () => /Copied/.test(document.getElementById('copystatus')?.textContent ?? ''), null, 10000, 'COPY did not say it copied');
  const clip = await tour.page.evaluate(() => navigator.clipboard.readText());
  check(clip === 'Liked the tuner. The chat felt scripted.', 'the notes are on the clipboard, nothing sent');
  await tour.page.screenshot({ path: `${out}/restb-tour.png`, fullPage: false });
  const un = await unnamed(tour.page, 'main');
  check(un.length === 0, `every control on the tour has a name (${un.join(', ')})`);
  await tour.ctx.close();
}

// ================================================================ 4. THE FIRST RUN ON A FRESH DEPLOYMENT
if (want('firstrun')) {
  log('first run');
  const sha = (s) => createHash('sha256').update(s).digest('hex');
  // The preview's brain stands in for the new deployment: the page is told (through its health call) that there is no owner
  // yet, until the spec says the variable is set; the wizard makes the key the preview already accepts (a test runner may give
  // it the key to make), and the geocoder, which needs the Internet, is stood in for with an invented place.
  let secured = false;
  const wizard = async (viewport) => {
    const ctx = await browser.newContext({ viewport, screen: viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ...UK, serviceWorkers: 'block' });
    await ctx.addInitScript((k) => { window.__ghostyFirstRunKey = k; }, KEY);
    await ctx.route('**/api/health', (route) => (secured ? route.continue() : route.fulfill({ json: { ok: true, secured: false, access: false, preview: false } })));
    await ctx.route('**/api/profile/places/find', (route) => route.fulfill({ json: { found: { id: 'home', label: 'Home', query: '1 Demo Lane', address: '1 Demo Lane, Sampleton (made up)', lat: 53.7965, lon: -1.5478 } } }));
    const page = await ctx.newPage();
    page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${viewport.width}] pageerror: ${e.message}`));
    page.on('console', (m) => {
      const t = m.text();
      if ((m.type() === 'error' && !/favicon|net::ERR|404|Failed to load resource|^[WI]\d{4} |^INFO:/.test(t)) || /Refused to|Content Security Policy/.test(t)) problems.push(`[${viewport.width}] console: ${t.slice(0, 200)}`);
    });
    return { ctx, page };
  };
  const fr = () => state_(page_, '__ghostyFirstRun');
  let page_;
  const state_ = (p, k) => p.evaluate((n) => JSON.parse(JSON.stringify(window[n] ?? null)), k);
  const text = () => page_.locator('#firstrun').innerText();

  // --- the whole way through, on the owner's phone
  const w = await wizard(PHONE);
  page_ = w.page;
  secured = false;
  await page_.goto(base, { waitUntil: 'domcontentloaded' });
  await page_.waitForSelector('#firstrun', { timeout: 20000 });
  check((await page_.locator('#pair input').count()) === 0, 'a brain with no owner shows the wizard, not the sign-in');
  check(/WELCOME/i.test(await text()) && /no owner yet/.test(await text()), 'it says this Ghosty has no owner yet');
  check(/nothing carried over from anyone/.test(await text()), 'and that nothing is carried over from anyone');
  await page_.locator('#firstrun button', { hasText: 'START' }).click();
  await page_.locator('#firstrun button', { hasText: 'MAKE MY KEY' }).click();
  await page_.waitForSelector('#firstrun .frkey', { timeout: 10000 });
  let s = await fr();
  check(s.step === 'key' && s.key === KEY, 'the key is made on the phone (here the one the preview accepts, handed in by the spec)');
  check((await page_.locator('#firstrun .frkey').innerText()) === KEY, 'the key is shown');
  check((await page_.locator('#firstrun .frhash').innerText()) === sha(KEY) && s.hash === sha(KEY), 'its fingerprint (SHA-256, the value for OWNER_KEY_HASH) is shown');
  check(/OWNER_KEY_HASH/.test(await text()) && /Secret/.test(await text()), 'it says where in Cloudflare the fingerprint goes');
  await page_.screenshot({ path: `${out}/restb-firstrun-key.png` });
  // a reload on the way to the dashboard does not lose the key
  await page_.reload({ waitUntil: 'domcontentloaded' });
  await page_.waitForSelector('#firstrun .frkey', { timeout: 20000 });
  check((await page_.locator('#firstrun .frkey').innerText()) === KEY, 'a reload resumes at the key step with the same key');
  // I ADDED IT before the Worker knows the fingerprint: not yet
  await page_.locator('#firstrun button', { hasText: 'I ADDED IT' }).click();
  await until(page_, () => /doesn’t know the fingerprint/.test(document.querySelector('#firstrun')?.innerText ?? ''), null, 10000, 'the wizard did not say the Worker does not know the fingerprint yet');
  check((await page_.evaluate(() => localStorage.getItem('ghosty.ownerKey'))) === null || (await page_.evaluate(() => localStorage.getItem('ghosty.ownerKey'))) === '', 'nothing is paired yet');
  // the variable is set: now it pairs, with the app's own pairing code
  secured = true;
  await page_.locator('#firstrun button', { hasText: 'I ADDED IT' }).click();
  await page_.waitForSelector('#firstrun input[aria-label="Your name"]', { timeout: 20000 });
  check((await page_.evaluate(() => localStorage.getItem('ghosty.ownerKey'))) === KEY, 'this phone is paired: the key is the app’s owner key now');
  s = await fr();
  check(s.paired && s.key === '' && s.step === 'name', 'the wizard no longer holds the key once it is paired');
  // the name, home, three things
  await page_.locator('#firstrun input[aria-label="Your name"]').fill('Zed');
  await page_.locator('#firstrun button', { hasText: 'CONTINUE' }).click();
  await page_.waitForSelector('#firstrun input[aria-label="Your home address or postcode"]', { timeout: 10000 });
  await page_.locator('#firstrun input[aria-label="Your home address or postcode"]').fill('1 Demo Lane');
  await page_.locator('#firstrun button', { hasText: 'FIND IT' }).click();
  await page_.locator('#firstrun button', { hasText: 'KEEP IT' }).waitFor({ state: 'visible', timeout: 10000 });
  check(/Sampleton \(made up\)/.test(await text()), 'the place found is shown before it is kept');
  await page_.locator('#firstrun button', { hasText: 'KEEP IT' }).click();
  await page_.waitForSelector('#firstrun .frthree', { timeout: 10000 });
  check((await page_.locator('#firstrun .frthree li').count()) === 3, 'three things to try are said');
  await page_.screenshot({ path: `${out}/restb-firstrun-try.png` });
  await page_.locator('#firstrun button', { hasText: 'DONE' }).click();
  await page_.waitForSelector('#cin', { timeout: 30000 });
  check((await page_.locator('#firstrun').count()) === 0, 'the wizard is gone and the app is up, signed in');
  const kept = await page_.evaluate(() => localStorage.getItem('ghosty.setup.progress'));
  check(kept === null, `its progress is no longer kept (${kept})`);
  check(/Zed/.test((await page_.evaluate(() => localStorage.getItem('ghosty.settings'))) ?? ''), 'the app knows his name');
  // what it wrote in the brain: his name, his home — and nothing else; then put back
  const api = (path, init = {}) => fetch(`${base}/api${path}`, { ...init, headers: { 'x-ghosty': '1', 'x-ghosty-key': KEY, 'content-type': 'application/json' } }).then((r) => r.json());
  const mem = await api('/memory');
  const mine = mem.facts.find((f) => f.text === 'My name is Zed.');
  check(!!mine, 'his name is in his brain’s memory');
  const places = await api('/profile/places');
  check(places.places.some((p) => p.id === 'home' && /Sampleton/.test(p.address)), 'his home is in his brain’s places');
  if (mine) await api(`/memory/${encodeURIComponent(mine.id)}`, { method: 'DELETE' });
  await api('/profile/places?id=home', { method: 'DELETE' });
  await w.ctx.close();

  // --- "I already have a key" goes to the app's own sign-in, and nothing of the first run is written
  secured = false;
  const w2 = await wizard(PHONE);
  page_ = w2.page;
  await page_.goto(base, { waitUntil: 'domcontentloaded' });
  await page_.waitForSelector('#firstrun', { timeout: 20000 });
  await page_.locator('#firstrun button', { hasText: 'I ALREADY HAVE A KEY' }).click();
  await page_.waitForSelector('#pair input', { timeout: 10000 });
  check((await page_.locator('#firstrun').count()) === 0, '"I already have a key" goes to the app’s own sign-in');
  await w2.ctx.close();

  // --- at 390 × 844: nothing sideways, every control named, at each step
  secured = false;
  const w3 = await wizard({ width: 390, height: 844 });
  page_ = w3.page;
  await page_.goto(base, { waitUntil: 'domcontentloaded' });
  await page_.waitForSelector('#firstrun', { timeout: 20000 });
  for (const [label, click] of [['welcome', null], ['key', 'START'], ['made key', 'MAKE MY KEY']]) {
    if (click) await page_.locator('#firstrun button', { hasText: click }).click();
    await page_.waitForTimeout(300);
    const bad = await sideways(page_, '#firstrun, #firstrun *');
    check(bad.length === 0, `nothing sticks out sideways at 390 px: ${label} (${bad.join('; ')})`);
    const un = await unnamed(page_, '#firstrun');
    check(un.length === 0, `every control has a name for VoiceOver: ${label} (${un.join(', ')})`);
  }
  await w3.ctx.close();
}

// ================================================================ the end
await browser.close();
console.log(`\n${((Date.now() - t0) / 1000).toFixed(0)} s`);
if (problems.length) {
  console.log(`\n${problems.length} problem(s):\n${problems.map((p) => ` - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log('\nrestb: all good');
