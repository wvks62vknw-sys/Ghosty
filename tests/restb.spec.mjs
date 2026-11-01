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
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

// ================================================================ 2. THE INSTRUMENT AND SKILLS COACH
{
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
  await page.keyboard.type(target, { delay: 25 });
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

// ================================================================ the end
await browser.close();
console.log(`\n${((Date.now() - t0) / 1000).toFixed(0)} s`);
if (problems.length) {
  console.log(`\n${problems.length} problem(s):\n${problems.map((p) => ` - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log('\nrestb: all good');
