// HIS OWN ONE-WORD ROUTINES (NEXT-ROUND consistency.s2, voice.s7), on the real app at 440 × 956 and 390 × 844:
//  [empty]   Settings → ROUTINES on a fresh phone says there are none, in his words, with MORNING and GOODNIGHT to add in one tap;
//  [make]    ADD MORNING keeps it on the phone; NEW ROUTINE makes "Movie time" from a screen found by a word and his own words, SAVE
//            keeps it; a word that already means something ("stop") or one he has ("morning") is refused in his words;
//  [run]     typed in the chat, "movie time" is answered on the phone with its steps in order, then they run in turn: the Radio
//            opens and his words reach Ghosty as his own message; "run morning" runs Morning; a reload keeps both;
//  [change]  EDIT changes one, DELETE takes it out and RESTORE puts it back;
//  [fit]     every key 44 pt, nothing sideways, at both sizes;
//  [catalogue] Abilities lists it (the catalogue entry, read from the code).
//   node tests/routines.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { UK, openPanel } from './nav.mjs';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const { buildSync } = createRequire(new URL('../apps/web/package.json', import.meta.url))('esbuild');

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const problems = [];
const check = (ok, why) => ok || problems.push(why);
const started = Date.now();

function pure(entry) {
  const r = buildSync({ entryPoints: [new URL(`../${entry}`, import.meta.url).pathname], bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`);
}
const R = await pure('apps/web/src/assistant/routines.ts');
const C = await pure('packages/shared/src/catalogue.ts');

// ---- the rules, read from the code
check(!!R.routineFor('movie time', [{ word: 'Movie time', steps: [{ label: 'x', act: { open: 'radio' } }], at: 0 }]), '[rules] "movie time" does not find Movie time');
check(!!R.routineFor('Run my goodnight routine.', [{ word: 'Good night', steps: [{ label: 'x', act: { open: 'agenda' } }], at: 0 }]), '[rules] "run my goodnight routine" does not find Good night');
check(!R.routineFor('what is on tomorrow morning', [{ word: 'Morning', steps: [{ label: 'x', act: { open: 'brief' } }], at: 0 }]), '[rules] a sentence with the word in it ran the routine');
check(/already means something/.test(R.wordProblem('stop', [])), `[rules] "stop" may be a routine's word: "${R.wordProblem('stop', [])}"`);
check(!R.safeAct({ run: 'send_email' }) && !R.safeAct({ run: 'social_post' }) && R.safeAct({ run: 'open_gym' }), '[rules] a step may run a command that sends');
check(R.parseRoutines(JSON.stringify([{ word: 'x', steps: [{ label: 'bad', act: { run: 'publish_site' } }], at: 0 }])).length === 0, '[rules] a kept routine with a sending step is not left out');
const entry = C.CATALOGUE['panel:settings:ROUTINES'];
check(!!entry && /one word/i.test(entry.line ?? '') && /APPROVE/.test(entry.more ?? ''), '[catalogue] Abilities has no true entry for ROUTINES');

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function phone(viewport) {
  const ctx = await browser.newContext({ viewport, ...UK, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  await ctx.addInitScript((k) => {
    localStorage.setItem('ghosty.ownerKey', k);
    if (!localStorage.getItem('ghosty.settings')) localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Tony', speak: false, sounds: false, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
  }, KEY);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror (${viewport.width}): ${e.message}`));
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
  return { ctx, page };
}
const until = (page, fn, arg, ms, why) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => (problems.push(why), false));
const P = '#pg-settings .pn.routines';
async function openRoutines(page) {
  await page.evaluate(() => (location.hash = 'settings'));
  await page.waitForFunction(() => document.body.dataset.tab === 'settings', null, { timeout: 15000 });
  await openPanel(page, 'settings', 'ROUTINES');
  await page.locator(P).scrollIntoViewIfNeeded().catch(() => undefined);
  return until(page, (p) => !!document.querySelector(`${p} .scgal, ${p} .empty, ${p} .rtedit`), P, 8000, '[open] Settings → ROUTINES did not open');
}
const tap = (page, label) => page.locator(`${P} button`, { hasText: new RegExp(`^${label}$`, 'i') }).first().click();
const kept = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.routines') ?? '[]'));
const fit = (page, sel, tag) => page.evaluate(({ sel }) => ({
  small: [...document.querySelectorAll(`${sel} button`)].filter((b) => { const r = b.getBoundingClientRect(); return r.width && r.height && (r.width < 43.5 || r.height < 43.5) && getComputedStyle(b).visibility !== 'hidden'; }).map((b) => `${b.textContent} ${Math.round(b.getBoundingClientRect().width)}×${Math.round(b.getBoundingClientRect().height)}`),
  wide: document.documentElement.scrollWidth > innerWidth + 1,
}), { sel }).then((f) => {
  check(!f.small.length, `[fit ${tag}] keys under 44 pt: ${f.small.join(', ')}`);
  check(!f.wide, `[fit ${tag}] the page scrolls sideways`);
});

/** His words in the chat, and Ghosty's first reply after them that matches (by the time his message was sent, never a count). */
async function ask(page, words, re, ms = 20000) {
  const t0 = await page.evaluate(() => Date.now());
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForSelector('#cin', { state: 'visible', timeout: 15000 });
  await page.fill('#cin', words);
  await page.keyboard.press('Enter');
  const find = ({ t0, src }) => {
    const msgs = [...document.querySelectorAll('#pg-core .msg')];
    const mine = msgs.map((m) => m.classList.contains('me') && Number(m.dataset.at ?? 0) >= t0).indexOf(true);
    if (mine < 0) return null;
    const r = msgs.slice(mine + 1).find((m) => !m.classList.contains('me') && new RegExp(src).test(m.textContent ?? ''));
    return r ? r.textContent : null;
  };
  return page.waitForFunction(find, { t0, src: re.source }, { timeout: ms }).then((h) => h.jsonValue(), () => null);
}

for (const viewport of [{ width: 440, height: 956 }, { width: 390, height: 844 }]) {
  const W = viewport.width;
  const { ctx, page } = await phone(viewport);
  if (!(await openRoutines(page))) { await ctx.close(); continue; }
  // [empty]
  const emptyWords = (await page.locator(`${P} .empty`).textContent().catch(() => '')) ?? '';
  check(/No routines yet/.test(emptyWords) && /morning/i.test(emptyWords), `[empty ${W}] the empty list reads "${emptyWords}"`);
  check(await page.locator(`${P} .rtstarter`).count() === 2, `[empty ${W}] MORNING and GOODNIGHT are not offered`);
  await fit(page, P, `${W} empty`);
  await page.screenshot({ path: `${out}/routines-${W}-empty.png` });
  // [make] one tap
  await tap(page, 'ADD MORNING');
  await until(page, (p) => !!document.querySelector(`${p} .rtrow[data-word="Morning"]`), P, 5000, `[make ${W}] ADD MORNING drew no row`);
  check((await kept(page)).some((r) => r.word === 'Morning' && r.steps.length === 3), `[make ${W}] Morning is not kept on the phone`);
  // [make] NEW ROUTINE: a word refused, then Movie time
  await tap(page, 'NEW ROUTINE');
  await page.fill(`${P} .rtword`, 'stop');
  await page.fill(`${P} .rtsay`, 'What is on tomorrow?');
  await tap(page, 'ADD WORDS');
  await tap(page, 'SAVE');
  check(/already means something/.test((await page.locator(`${P} .rtproblem`).textContent()) ?? ''), `[make ${W}] "stop" was not refused in his words`);
  await page.fill(`${P} .rtword`, 'morning');
  await tap(page, 'SAVE');
  check(/already have/.test((await page.locator(`${P} .rtproblem`).textContent()) ?? ''), `[make ${W}] a second "morning" was not refused`);
  await page.fill(`${P} .rtword`, 'Movie time');
  await page.fill(`${P} .rtfind`, 'radio');
  await until(page, (p) => [...document.querySelectorAll(`${p} .rtpick`)].some((b) => /^Radio: open it$/.test(b.textContent ?? '')), P, 4000, `[make ${W}] finding "radio" offers no Radio`);
  await page.locator(`${P} .rtpick`, { hasText: /^Radio: open it$/ }).first().click();
  // the Radio first, then his words: ↑ on the second step (his words were added first)
  await page.locator(`${P} .rtstep`).nth(1).locator('button', { hasText: '↑' }).click();
  const order = await page.$$eval(`${P} .rtstep > span`, (s) => s.map((x) => x.textContent));
  check(order.join('|') === 'Radio: open it|Say: What is on tomorrow?', `[make ${W}] the steps read ${order.join(' | ')}`);
  await fit(page, P, `${W} editor`);
  await page.screenshot({ path: `${out}/routines-${W}-editor.png` });
  await tap(page, 'SAVE');
  await until(page, (p) => !!document.querySelector(`${p} .rtrow[data-word="Movie time"]`), P, 5000, `[make ${W}] Movie time was not kept`);
  await fit(page, P, `${W} list`);
  await page.screenshot({ path: `${out}/routines-${W}-list.png` });

  // [run] typed in the chat
  const reply = await ask(page, 'movie time', /Movie time: 2 things/);
  check(!!reply && /1\. Radio/.test(reply) && /2\. Say: What is on tomorrow\?/.test(reply) && /APPROVE/.test(reply), `[run ${W}] the reply reads "${reply}"`);
  await until(page, () => document.body.dataset.tab === 'radio', null, 8000, `[run ${W}] the Radio did not open`);
  await until(page, () => [...document.querySelectorAll('#pg-core .msg.me')].some((m) => /What is on tomorrow\?/.test(m.textContent ?? '')), null, 15000, `[run ${W}] his words did not reach Ghosty as his own message`);
  // (Movie time ran to its end before the next word: its last step was a question to Ghosty, answered in its own time)
  await until(page, () => { const r = window.__ghosty?.routines; return !!r && r.word === 'Movie time' && r.done === r.of; }, null, 20000, `[run ${W}] Movie time did not run to its end`);
  // "run morning" runs Morning; its first step opens the Brief
  const morning = await ask(page, 'run morning', /Morning: 3 things/);
  check(!!morning, `[run ${W}] "run morning" did not run Morning`);
  await until(page, () => document.body.dataset.tab === 'brief', null, 8000, `[run ${W}] Morning did not open the Brief`);
  // a reload keeps both
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
  check((await kept(page)).map((r) => r.word).join(',') === 'Morning,Movie time', `[run ${W}] after a reload the phone keeps ${(await kept(page)).map((r) => r.word)}`);

  // [change] EDIT, DELETE, RESTORE
  await openRoutines(page);
  await page.locator(`${P} .rtrow[data-word="Movie time"] button`, { hasText: /^edit$/i }).click();
  await page.fill(`${P} .rtword`, 'Film night');
  await tap(page, 'SAVE');
  await until(page, (p) => !!document.querySelector(`${p} .rtrow[data-word="Film night"]`) && !document.querySelector(`${p} .rtrow[data-word="Movie time"]`), P, 5000, `[change ${W}] EDIT did not rename Movie time`);
  await page.locator(`${P} .rtrow[data-word="Film night"] button`, { hasText: /^delete$/i }).click();
  await until(page, (p) => !document.querySelector(`${p} .rtrow[data-word="Film night"]`), P, 5000, `[change ${W}] DELETE left Film night`);
  await tap(page, 'RESTORE');
  await until(page, (p) => !!document.querySelector(`${p} .rtrow[data-word="Film night"]`), P, 5000, `[change ${W}] RESTORE did not put Film night back`);
  await ctx.close();
}

await browser.close();
const secs = Math.round((Date.now() - started) / 1000);
if (problems.length) {
  console.log(`routines: ${problems.length} problem(s) in ${secs} s`);
  for (const p of problems) console.log(` - ${p}`);
  process.exit(1);
}
console.log(`routines: OK (none to start, said; MORNING in one tap; Movie time made from a found screen and his own words, a reserved word and a second "morning" refused; typed in the chat it ran in turn, the Radio and his words; "run morning" opened the Brief; kept after a reload; EDIT, DELETE and RESTORE; 44 pt keys and nothing sideways at 440 and 390; in Abilities; ${secs} s)`);
