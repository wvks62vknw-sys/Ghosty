// THE HELP DESK AND THE JUMP BAR'S SENTENCES (NEXT-ROUND consistency.s1, u5, c6), on the real app at 440 × 956 and 390 × 844:
//  [sentence] typed in the jump bar, "where do I paste a bank statement" finds Money, "set a timer for the pasta" the Kitchen, and
//             OPEN opens it; a word or two stays the bar's own search ("rad" is still the Radio);
//  [how]      "how do I paste a bank statement?" in the chat is answered on the phone with the taps (Life → Money), what it does and
//             TRY IT, which opens Money; "how do I fix a squeaky door?" is left to the brain;
//  [say]      "what can I say here?" on the Kitchen gives that screen's own wordings, each a key;
//  [timer]    a kitchen timer running on the phone shows in the Brief's day as TIMER, and a tap opens the Kitchen;
//  [fit]      the replies' keys 44 pt, nothing sideways.
//   node tests/helpdesk.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { UK } from './nav.mjs';
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
// ---- the rules, read from the code
const S = await pure('apps/web/src/shell/sentence.ts');
const want = [['where do I paste a bank statement', 'money'], ['put some tunes on', 'radio'], ['how do I count my squats', 'body'], ['set a timer for the pasta', 'kitchen'], ['where are my birthdays and gift ideas', 'people']];
for (const [q, s] of want) check(S.screenForSentence(q)?.screen === s, `[rules] "${q}" reads as ${JSON.stringify(S.screenForSentence(q))}, want ${s}`);
check(S.screenForSentence('radio') === null, '[rules] a single word is read as a sentence (it is the bar\'s own search)');
check(S.screenForSentence('how do I fix a squeaky door', undefined, true) === null, '[rules] the help desk would take a real question from the brain');

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
const go = async (page, id) => {
  await page.evaluate((h) => (location.hash = h), id);
  await page.waitForFunction((id) => document.body.dataset.tab === id, id, { timeout: 15000 });
};
/** His words in the chat, and Ghosty's first reply after them that matches (by the time his message was sent, never a count). */
async function ask(page, words, re, ms = 15000) {
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
    return r ? { text: r.textContent, keys: [...r.querySelectorAll('button')].map((b) => ({ t: b.textContent.trim(), w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height })) } : null;
  };
  return page.waitForFunction(find, { t0, src: re.source }, { timeout: ms }).then((h) => h.jsonValue(), () => null);
}
async function jumpFind(page, words) {
  await go(page, 'core');
  await page.keyboard.press('/');
  await page.waitForSelector('#palette.on input', { timeout: 5000 });
  await page.fill('#palette input', words);
}

for (const viewport of [{ width: 440, height: 956 }, { width: 390, height: 844 }]) {
  const W = viewport.width;
  const { ctx, page } = await phone(viewport);
  // [sentence]
  await jumpFind(page, 'where do I paste a bank statement');
  await until(page, () => window.__ghosty?.jump?.sentence === 'money' && /^money/i.test(window.__ghosty?.jump?.found ?? ''), null, 5000, `[sentence ${W}] the bar did not find Money: ${await page.evaluate(() => JSON.stringify(window.__ghosty?.jump ?? null))}`);
  await page.screenshot({ path: `${out}/helpdesk-${W}-jump.png` });
  await page.click('#palette .jplate [data-act="open"]');
  await until(page, () => document.body.dataset.tab === 'money', null, 8000, `[sentence ${W}] OPEN did not open Money`);
  await jumpFind(page, 'set a timer for the pasta');
  await until(page, () => window.__ghosty?.jump?.sentence === 'kitchen', null, 5000, `[sentence ${W}] the bar did not find the Kitchen`);
  await page.keyboard.press('Escape');
  await jumpFind(page, 'rad');
  await until(page, () => /^radio/i.test(window.__ghosty?.jump?.found ?? '') && !window.__ghosty?.jump?.sentence, null, 5000, `[sentence ${W}] "rad" is no longer the Radio`);
  await page.keyboard.press('Escape');

  // [how]
  const how = await ask(page, 'how do I paste a bank statement?', /Money/);
  check(!!how && /Life → Money/.test(how.text) && /statement/i.test(how.text), `[how ${W}] the reply reads "${how?.text}"`);
  const tryIt = how?.keys.find((k) => /^try it$/i.test(k.t));
  check(!!tryIt && tryIt.w >= 43.5 && tryIt.h >= 43.5, `[how ${W}] TRY IT is missing or under 44 pt: ${JSON.stringify(how?.keys)}`);
  if (tryIt) {
    await page.locator('#pg-core .msg:not(.me) button', { hasText: /^try it$/i }).last().click();
    await until(page, () => document.body.dataset.tab === 'money', null, 8000, `[how ${W}] TRY IT did not open Money`);
  }
  const door = await ask(page, 'how do I fix a squeaky door?', /\S/, 15000);
  check(!door || !/TRY IT/i.test(door.keys.map((k) => k.t).join(' ')), `[how ${W}] a real question was taken by the help desk: "${door?.text}"`);

  // [say] asked from the Kitchen (the jump bar's "Or ask me": the question goes to Home, the Kitchen is what "here" means)
  await go(page, 'kitchen');
  await page.keyboard.press('/');
  await page.waitForSelector('#palette.on input', { timeout: 5000 });
  await page.fill('#palette input', 'what can I say here?');
  await page.waitForSelector('#palette .jask', { timeout: 5000 });
  await page.click('#palette .jask');
  const said = await page.waitForFunction(() => [...document.querySelectorAll('#pg-core .msg:not(.me)')].map((m) => m.textContent ?? '').find((x) => /On Kitchen you can say/.test(x)) ?? null, null, { timeout: 10000 }).then((h) => h.jsonValue(), () => null);
  check(!!said && /“/.test(said), `[say ${W}] "what can I say here?" from the Kitchen read "${said}"`);

  // [timer] the Brief's TIMER line
  await page.evaluate(() => {
    const now = Date.now();
    localStorage.setItem('ghosty:timers', JSON.stringify([{ id: 't1', name: 'Pasta', secs: 600, end: now + 600_000 }]));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
  await go(page, 'brief');
  await until(page, () => /Pasta: (?:9|10) minutes left/.test(document.querySelector('#pg-brief .brtimer')?.textContent ?? ''), null, 10000, `[timer ${W}] the Brief has no TIMER line: "${await page.locator('#pg-brief .brday').textContent().catch(() => '')}"`);
  await page.locator('#pg-brief .brtimer').first().click().catch(() => undefined);
  await until(page, () => document.body.dataset.tab === 'kitchen', null, 8000, `[timer ${W}] the TIMER line did not open the Kitchen`);
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), `[fit ${W}] the page scrolls sideways`);
  await ctx.close();
}

await browser.close();
const secs = Math.round((Date.now() - started) / 1000);
if (problems.length) {
  console.log(`helpdesk: ${problems.length} problem(s) in ${secs} s`);
  for (const p of problems) console.log(` - ${p}`);
  process.exit(1);
}
console.log(`helpdesk: OK (sentences in the jump bar find Money and the Kitchen, a word stays a search; "how do I…" answered with the taps and TRY IT, a real question left to the brain; "what can I say here?" on the Kitchen; the Brief's TIMER line; ${secs} s)`);
