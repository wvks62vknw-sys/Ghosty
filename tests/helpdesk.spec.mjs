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
/** The jump bar opened as his keyboard opens it (Ctrl+K works even with the chat box focused), and his words typed in it. */
async function openJump(page) {
  if (!(await page.locator('#palette.on').count())) await page.keyboard.press('Control+KeyK');
  await page.waitForSelector('#palette.on input', { timeout: 5000 });
}
async function jumpFind(page, words) {
  await go(page, 'core');
  await openJump(page);
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
  // a sum, answered as he types; a lone number is still the room's thing, never a sum
  await jumpFind(page, '15% of 80');
  await until(page, () => window.__ghosty?.jump?.sum === '12' && !!document.querySelector('#palette .jsum'), null, 5000, `[sum ${W}] "15% of 80" is not 12 in the bar: ${await page.evaluate(() => JSON.stringify(window.__ghosty?.jump ?? null))}`);
  await page.fill('#palette input', '12*7');
  await until(page, () => window.__ghosty?.jump?.sum === '84', null, 5000, `[sum ${W}] "12*7" is not 84`);
  await page.fill('#palette input', '2');
  await until(page, () => !window.__ghosty?.jump?.sum, null, 5000, `[sum ${W}] a lone "2" was read as a sum`);
  await page.keyboard.press('Escape');
  await jumpFind(page, 'rad');
  await until(page, () => /^radio/i.test(window.__ghosty?.jump?.found ?? '') && !window.__ghosty?.jump?.sentence, null, 5000, `[sentence ${W}] "rad" is no longer the Radio`);
  await page.keyboard.press('Escape');

  // [how]
  const how = await ask(page, 'how do I paste a bank statement?', /Money/);
  check(!!how && /Life → Money/.test(how.text) && /statement/i.test(how.text), `[how ${W}] the reply reads "${how?.text}"`);
  // (measured with the conversation open: on a phone it sits behind its own button)
  await page.evaluate(() => { const hud = document.querySelector('#pg-core .hud.core'); if (hud && !hud.classList.contains('logopen')) document.querySelector('.logbtn')?.click(); });
  await page.waitForFunction(() => { const b = [...document.querySelectorAll('#pg-core .msg:not(.me) button')].filter((x) => /^try it$/i.test(x.textContent.trim())).pop(); return !!b && b.getBoundingClientRect().height > 0; }, null, { timeout: 5000 }).catch(() => undefined);
  const tryIt = await page.evaluate(() => { const b = [...document.querySelectorAll('#pg-core .msg:not(.me) button')].filter((x) => /^try it$/i.test(x.textContent.trim())).pop(); if (!b) return null; b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return { w: r.width, h: r.height }; });
  check(!!tryIt && tryIt.w >= 43.5 && tryIt.h >= 43.5, `[how ${W}] TRY IT is missing or under 44 pt: ${JSON.stringify(tryIt)}`);
  if (tryIt) {
    // (on a phone the conversation sits behind its own button: the key is pressed where it is drawn)
    await page.locator('#pg-core .msg:not(.me) button', { hasText: /^try it$/i }).last().evaluate((b) => b.click());
    await until(page, () => document.body.dataset.tab === 'money', null, 8000, `[how ${W}] TRY IT did not open Money`);
  }
  const door = await ask(page, 'how do I fix a squeaky door?', /\S/, 15000);
  check(!door || !/TRY IT/i.test(door.keys.map((k) => k.t).join(' ')), `[how ${W}] a real question was taken by the help desk: "${door?.text}"`);

  // [say] asked from the Kitchen (the jump bar's "Or ask me": the question goes to Home, the Kitchen is what "here" means)
  await go(page, 'kitchen');
  await openJump(page);
  await page.fill('#palette input', 'what can I say here?');
  await page.waitForSelector('#palette .jask', { timeout: 5000 });
  await page.click('#palette .jask');
  const said = await page.waitForFunction(() => [...document.querySelectorAll('#pg-core .msg:not(.me)')].map((m) => m.textContent ?? '').find((x) => /On Kitchen you can say/.test(x)) ?? null, null, { timeout: 10000 }).then((h) => h.jsonValue(), () => null);
  check(!!said && /“/.test(said), `[say ${W}] "what can I say here?" from the Kitchen read "${said}"`);

  // [tour] "show me around": the rooms in a reply, each a key, then the walk through them and back to Home (only at 440: it takes
  // half a minute); a new word stops it
  if (W === 440) {
    const tour = await ask(page, 'show me around', /room by room/);
    check(!!tour && ['Home', 'See', 'Make', 'Learn', 'Plan', 'Life', 'Me'].every((r) => tour.text.includes(`${r}:`)) && /Try:/.test(tour.text), `[tour] the reply reads "${tour?.text?.slice(0, 300)}"`);
    check((tour?.keys ?? []).filter((k) => /^(Home|See|Make|Learn|Plan|Life|Me)$/.test(k.t)).length === 7, `[tour] the reply's room keys: ${JSON.stringify(tour?.keys?.map((k) => k.t))}`);
    await until(page, () => (window.__ghosty?.tour?.shown ?? []).length >= 2, null, 15000, '[tour] the walk did not go through the rooms');
    await until(page, () => document.body.dataset.tab?.startsWith('area-'), null, 5000, '[tour] no room is on screen during the walk');
    await ask(page, 'thanks', /\S/, 15000);
    const at = await page.evaluate(() => ({ ...window.__ghosty?.tour }));
    check(at.stopped === true && at.done !== true, `[tour] a new word did not stop it: ${JSON.stringify(at)}`);
  }

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
