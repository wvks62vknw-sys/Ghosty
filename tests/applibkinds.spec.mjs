// THE PRO ROUND, lane KINDS (docs/build-plan/APPLIB-PRO.md; apps/web/src/features/applib/renderers/kinds.ts): each small kind of
// app driven through its main move at 440 × 956 and at 390, touch only.
// - calc: the answer first, said in words from its bands ("22.9 · Healthy weight") with its tone and meaning; no raw 0, 1, true or
//   false anywhere; the slider and the steppers change the answer live; a unit chip shows the same weight in pounds; KEEP saves it
//   to the history; the estimate and source lines at the foot.
// - checklist: the progress ring, sections as cards, a tick counted.
// - timer: the ring runs (its arc grows), the step's name and the next step, rounds as dots; a reload carries on running.
// - deck: the card flips on a tap, a swipe right puts it off (knew it), a swipe left brings it back (again); the intervals are on
//   the keys; the session summary at the end.
// - counter: a tap adds, a long press takes one off, the leader is shown.
// - guide: the contents sheet, search highlights its words.
// - a game opens on its launcher (art tile, PLAY, best, streak, today) and PLAY starts the board.
import { launch } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined });
const problems = [];
const check = (ok, what) => ok || problems.push(what);
const T0 = Date.now();
const SMALL = { width: 390, height: 844 };
const T = ['These are sample entries.', 'Tap one to change it.', 'Settings has export and Recently deleted.'];

const BMI = {
  id: 'kinds-bmi', name: 'Kinds BMI', family: 'body', glyph: 'heart', archetype: 'calc', pitch: 'Your body mass index from your height and your weight.', keywords: ['kinds bmi'], tour: T,
  calc: {
    inputs: [{ id: 'kg', label: 'Weight', unit: 'kg', default: 70, min: 30, max: 200 }, { id: 'cm', label: 'Height', unit: 'cm', default: 175, min: 120, max: 220 }, { id: 'who', label: 'Who', default: 1, choices: [{ label: 'Adult', value: 1 }, { label: 'Child', value: 0 }] }],
    outputs: [
      { id: 'bmi', label: 'BMI', expr: 'kg / (cm / 100) ^ 2', dp: 1, explain: 'A healthy adult BMI is 18.5 to 24.9.', bands: [{ upTo: 18.4, words: 'Underweight', tone: 'warn' }, { upTo: 24.9, words: 'Healthy weight', tone: 'good' }, { upTo: 29.9, words: 'Overweight', tone: 'warn' }, { words: 'Obese', tone: 'bad' }] },
      { id: 'over', label: 'Over 25', expr: 'if(bmi > 25, 1, 0)', dp: 0 },
      { id: 'aim', label: 'At a healthy weight', expr: 'bmi >= 18.5 and bmi <= 24.9', bands: [{ upTo: 0, words: 'Not yet', tone: 'warn' }, { words: 'Yes', tone: 'good' }] },
      { id: 'to', label: 'To a BMI of 25', expr: '25 * (cm / 100) ^ 2 - kg', unit: 'kg', dp: 1 },
    ],
    tests: [{ in: { kg: 70, cm: 175 }, out: { bmi: 22.86 } }, { in: { kg: 90, cm: 180 }, out: { bmi: 27.78 } }], estimate: true, source: 'NHS BMI formula',
  },
};
const LIST = { id: 'kinds-morning', name: 'Kinds Morning', family: 'life', glyph: 'check', archetype: 'checklist', pitch: 'A calm morning routine, ticked off one step at a time.', keywords: ['kinds morning'], tour: T, checklist: { sections: [{ name: 'Wake', items: ['Water', 'Stretch'] }, { name: 'Out', items: ['Keys', 'Wallet', 'Phone'] }], repeat: 'daily' } };
const TIMER = { id: 'kinds-intervals', name: 'Kinds Intervals', family: 'body', glyph: 'timer', archetype: 'timer', pitch: 'Short hard efforts with rests between, timed for you.', keywords: ['kinds intervals'], tour: T, timer: { steps: [{ name: 'Work', secs: 4 }, { name: 'Rest', secs: 2 }], rounds: 3 } };
const DECK = { id: 'kinds-capitals', name: 'Kinds Capitals', family: 'learn', glyph: 'globe', archetype: 'deck', pitch: 'The capital cities of Europe, learnt a few at a time.', keywords: ['kinds capitals'], tour: T, deck: { cards: [{ q: 'France', a: 'Paris' }, { q: 'Spain', a: 'Madrid' }, { q: 'Italy', a: 'Rome' }], mode: 'srs' } };
const COUNT = { id: 'kinds-tally', name: 'Kinds Tally', family: 'tools', glyph: 'plus', archetype: 'counter', pitch: 'Count anything with one tap, and start again each day.', keywords: ['kinds tally'], tour: T, counter: { names: ['Laps', 'Glasses'], step: 1, reset: 'daily' } };
const GUIDE = { id: 'kinds-knots', name: 'Kinds Knots', family: 'world', glyph: 'anchor', archetype: 'guide', pitch: 'The knots worth knowing, and what each one is good for.', keywords: ['kinds knots'], tour: T, guide: { sections: [{ title: 'Reef knot', body: 'Joins two ends of the same thickness.', tags: ['join'] }, { title: 'Bowline', body: 'A fixed loop that will not slip.\n\nTie it round your waist.', tags: ['loop'] }, { title: 'Clove hitch', body: 'Holds a line to a post.' }], source: { name: 'Scouts', url: 'https://www.scouts.org.uk' } } };

async function open(viewport) {
  const ctx = await browser.newContext({ viewport, ...UK, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`[${viewport.width}] pageerror: ${e.message}`));
  await page.addInitScript(() => {
    localStorage.setItem('ghosty.ownerKey', 'preview-owner-key-0123456789');
    if (!localStorage.getItem('ghosty.settings')) localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Boss', speak: false, sounds: false, look: { ground: 'graphite', world: 'glass', night: 'graphite', switches: {} } }));
  });
  await page.goto(`${base}/#apps`);
  await page.waitForFunction(() => !!window.__ghosty?.applib, null, { timeout: 30000 });
  return { ctx, page };
}
const A = '.ak-app';
const tryApp = async (page, def) => {
  await page.evaluate((d) => window.__ghosty.applib.try(d), def);
  await page.waitForSelector(`${A}[data-app="${def.id}"]`, { timeout: 8000 });
  for (let i = 0; i < 3; i++) await page.evaluate(() => { for (const b of document.querySelectorAll('.ak-tour button')) b.click(); });
  await page.waitForTimeout(60);
};
const text = (page, sel) => page.textContent(sel).then((t) => (t ?? '').trim(), () => '');
/** Nothing sideways, every button 44 pt, at most one scroll area. */
const fit = (page) => page.evaluate(() => {
  const root = document.querySelector('.ak-app');
  const small = [...root.querySelectorAll('button, select, input:not([type=file]):not([type=range])')].filter((b) => b.offsetParent && !b.closest('[hidden]')).filter((b) => { const r = b.getBoundingClientRect(); return r.height < 43.5 || (b.matches('button') && r.width < 43.5); }).map((b) => (b.getAttribute('aria-label') || b.textContent).slice(0, 24));
  const wide = [...root.querySelectorAll('*')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > innerWidth + 0.5 || r.left < -0.5) && !e.closest('.al-flip'); }).map((e) => e.className.toString().slice(0, 30)).slice(0, 4);
  const scrollers = [...root.querySelectorAll('*')].filter((e) => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 1 && !e.closest('.ak-sheet')).length;
  return { small: small.slice(0, 5), wide, scrollers, sideways: document.documentElement.scrollWidth > innerWidth };
});
const fitOk = (m) => !m.small.length && !m.wide.length && m.scrollers <= 1 && !m.sideways;
/** A drag across an element with the finger (pointer events, as WebKit sends for touch). */
const drag = async (page, sel, dx) => {
  const b = await page.locator(sel).boundingBox();
  const x = b.x + b.width / 2;
  const y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(x + (dx * i) / 8, y);
  await page.mouse.up();
  await page.waitForTimeout(350);
};

for (const vp of [PHONE, SMALL]) {
  const W = vp.width;
  const { ctx, page } = await open(vp);

  // ── calc ──
  await tryApp(page, BMI);
  check(await text(page, `${A} .al-hero .al-heroval`) === '22.9', `[${W} calc] the answer: ${await text(page, `${A} .al-hero .al-heroval`)}`);
  check(await text(page, `${A} .al-hero .al-herowords`) === 'Healthy weight', `[${W} calc] the answer in words: ${await text(page, `${A} .al-hero .al-herowords`)}`);
  check(await page.getAttribute(`${A} .al-hero`, 'data-tone') === 'good', `[${W} calc] the healthy band's tone is not good`);
  check(/18\.5 to 24\.9/.test(await text(page, `${A} .al-explain`)), `[${W} calc] the meaning is not under the answer`);
  const words = await text(page, `${A} .ak-body`);
  check(!/Over 25/.test(words), `[${W} calc] the yes-or-no flag shows`);
  const raw = await page.$$eval(`${A} .al-outval`, (e) => e.map((x) => x.textContent.trim()).filter((t) => /^(0|1|true|false)$/.test(t)));
  check(!raw.length, `[${W} calc] a raw 0, 1 or boolean shows: ${raw}`);
  check(await text(page, `${A} .al-tile[data-output="aim"] .al-outval`) === 'Yes', `[${W} calc] a yes-or-no with bands is not said in words: ${await text(page, `${A} .al-tile[data-output="aim"] .al-outval`)}`);
  check(await text(page, `${A} .al-tile[data-output="to"] .al-outval`) === '6.6 kg', `[${W} calc] the second answer as a tile: ${await text(page, `${A} .al-tile[data-output="to"] .al-outval`)}`);
  check(await page.locator(`${A} .al-field[data-input="kg"] input[type=range]`).count() === 1 && await page.locator(`${A} .al-field[data-input="kg"] button[aria-label="Weight up"]`).count() === 1, `[${W} calc] the weight has no slider or steppers`);
  // the slider changes the answer
  await page.locator(`${A} .al-field[data-input="kg"] input[type=range]`).fill('90');
  check(await text(page, `${A} .al-hero .al-heroval`) === '29.4' && await text(page, `${A} .al-hero .al-herowords`) === 'Overweight', `[${W} calc] the slider did not change the answer: ${await text(page, `${A} .al-hero`)}`);
  check(await page.getAttribute(`${A} .al-hero`, 'data-tone') === 'warn', `[${W} calc] the overweight band's tone is not warn`);
  check(await text(page, `${A} .al-tile[data-output="aim"] .al-outval`) === 'Not yet', `[${W} calc] the yes-or-no did not follow: ${await text(page, `${A} .al-tile[data-output="aim"] .al-outval`)}`);
  check(await page.inputValue(`${A} .al-field[data-input="kg"] input[type=number]`) === '90', `[${W} calc] the number box did not follow the slider`);
  // typing still works, and the steppers step
  await page.fill(`${A} .al-field[data-input="cm"] input[type=number]`, '180');
  check(await text(page, `${A} .al-hero .al-heroval`) === '27.8', `[${W} calc] typing: ${await text(page, `${A} .al-hero .al-heroval`)}`);
  await page.click(`${A} button[aria-label="Weight down"]`);
  check(await page.inputValue(`${A} .al-field[data-input="kg"] input[type=number]`) === '89', `[${W} calc] the stepper: ${await page.inputValue(`${A} .al-field[data-input="kg"] input[type=number]`)}`);
  await page.click(`${A} button[aria-label="Weight up"]`);
  // a unit chip: the same weight in pounds, the answer unchanged
  await page.click(`${A} .al-field[data-input="kg"] .al-unitchip:has-text("lb")`);
  check(await page.inputValue(`${A} .al-field[data-input="kg"] input[type=number]`) === '198.4' && await text(page, `${A} .al-hero .al-heroval`) === '27.8', `[${W} calc] in pounds: ${await page.inputValue(`${A} .al-field[data-input="kg"] input[type=number]`)}`);
  await page.click(`${A} .al-field[data-input="kg"] .al-unitchip:has-text("kg")`);
  await page.click(`${A} .al-segopt:has-text("Child")`);
  check(await page.getAttribute(`${A} .al-segopt:has-text("Child")`, 'aria-checked') === 'true', `[${W} calc] the choice did not take`);
  await page.click(`${A} .ak-tools button:has-text("Keep")`);
  check(/BMI: 27\.8 · Overweight/.test(await text(page, `${A} .al-history`)), `[${W} calc] KEEP did not save to the history: ${await text(page, `${A} .al-history`)}`);
  check(await text(page, `${A} .al-calcfoot .al-estimate`) === 'A first estimate, never certified.' && /NHS BMI formula/.test(await text(page, `${A} .al-calcfoot .al-source`)), `[${W} calc] the estimate or source is not at the foot`);
  let m = await fit(page);
  check(fitOk(m), `[${W} calc fit] ${JSON.stringify(m)}`);
  await page.screenshot({ path: `${out}/applibkinds-calc-${W}.png` });

  // ── checklist ──
  await tryApp(page, LIST);
  check(await page.locator(`${A} .al-khero .al-bigring`).count() === 1 && await page.locator(`${A} .al-tickcard`).count() === 2, `[${W} checklist] no ring or no section cards`);
  await page.click(`${A} .al-tick:has-text("Water")`);
  check(await text(page, `${A} .al-khero .al-ringmid b`) === '1 of 5', `[${W} checklist] after one tick: ${await text(page, `${A} .al-khero .al-ringmid b`)}`);
  check(/starts fresh each morning/.test(await text(page, `${A} .al-khero`)), `[${W} checklist] the fresh start is not said`);
  m = await fit(page);
  check(fitOk(m), `[${W} checklist fit] ${JSON.stringify(m)}`);

  // ── timer: the ring runs and survives a reload ──
  await tryApp(page, TIMER);
  const arc = () => page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.ak-app .al-timering .al-ringarc')).strokeDasharray) || 0);
  check(await page.locator(`${A} .al-dots i`).count() === 3, `[${W} timer] the rounds are not three dots`);
  check(/Next: Rest/.test(await text(page, `${A} .al-next`)), `[${W} timer] the next step is not shown: ${await text(page, `${A} .al-next`)}`);
  await page.click(`${A} .ak-tools button:has-text("Start")`);
  const a0 = await arc();
  await page.waitForTimeout(1200);
  const a1 = await arc();
  check(a1 > a0 + 5, `[${W} timer] the ring did not run: ${a0} then ${a1}`);
  check(await text(page, `${A} .al-stepname`) === 'Work', `[${W} timer] the step's name: ${await text(page, `${A} .al-stepname`)}`);
  await page.reload();
  await page.waitForSelector(`${A}[data-app="kinds-intervals"]`, { timeout: 15000 }).catch(() => problems.push(`[${W} timer] a reload did not open the timer again`));
  check(await page.locator(`${A} .al-timer[data-on="true"]`).count() === 1, `[${W} timer] a reload stopped the timer`);
  const a2 = await arc();
  check(a2 > a1 || await text(page, `${A} .al-stepname`) !== 'Work', `[${W} timer] after the reload the ring went back: ${a1} then ${a2}`);
  await page.waitForFunction(() => document.querySelector('.ak-app .al-dots i[data-on="done"]'), null, { timeout: 9000 }).catch(() => problems.push(`[${W} timer] no round was marked done`));
  m = await fit(page);
  check(fitOk(m), `[${W} timer fit] ${JSON.stringify(m)}`);
  await page.screenshot({ path: `${out}/applibkinds-timer-${W}.png` });
  await page.click(`${A} .ak-tools button:has-text("Pause")`).catch(() => {});

  // ── deck: flip, swipe right and left, the intervals, the summary ──
  await tryApp(page, DECK);
  check(/3 due/.test(await text(page, `${A} .al-progress b`)), `[${W} deck] not 3 due at the start`);
  await page.click(`${A} .al-flip`);
  check(await page.getAttribute(`${A} .al-flip`, 'data-side') === 'back' && await text(page, `${A} .al-a`) === 'Paris', `[${W} deck] a tap did not turn the card`);
  check(/day/.test(await text(page, `${A} button[data-rate="good"] .al-ival`)), `[${W} deck] no interval on Good: ${await text(page, `${A} button[data-rate="good"]`)}`);
  await drag(page, `${A} .al-flip`, 180);
  check(/2 due/.test(await text(page, `${A} .al-progress b`)), `[${W} deck] a swipe right did not put the card off: ${await text(page, `${A} .al-progress b`)}`);
  check(/Madrid|Spain/.test(await text(page, `${A} .al-flip`)), `[${W} deck] the next card is not Spain`);
  await drag(page, `${A} .al-flip`, -180);
  // (again: back in ten minutes, so out of this round's due count, and counted in the session)
  check(/1 due/.test(await text(page, `${A} .al-progress b`)) && /2 reviewed/.test(await text(page, `${A} .al-progress small`)), `[${W} deck] a swipe left: ${await text(page, `${A} .al-progress`)}`);
  m = await fit(page);
  check(fitOk(m), `[${W} deck fit] ${JSON.stringify(m)}`);
  await page.screenshot({ path: `${out}/applibkinds-deck-${W}.png` });
  // (the rest put off: the session summary)
  for (let i = 0; i < 4 && await page.locator(`${A} .al-flip`).count(); i++) await drag(page, `${A} .al-flip`, 180);
  check(/reviewed/.test(await text(page, `${A} .al-summary`)) && /knew it/.test(await text(page, `${A} .al-summary`)), `[${W} deck] no session summary: ${await text(page, `${A} .ak-body`)}`);

  // ── counter: tap adds, a long press takes off, the leader ──
  await tryApp(page, COUNT);
  await page.click(`${A} .al-tally[aria-label="Laps up by 1"]`);
  await page.click(`${A} .al-tally[aria-label="Laps up by 1"]`);
  await page.click(`${A} .al-tally[aria-label="Laps up by 1"]`);
  check(await text(page, `${A} .al-count[data-id="n0"] .al-countval`) === '3', `[${W} counter] three taps: ${await text(page, `${A} .al-count[data-id="n0"] .al-countval`)}`);
  const lb = await page.locator(`${A} .al-tally[aria-label="Laps up by 1"]`).boundingBox();
  await page.mouse.move(lb.x + lb.width / 2, lb.y + lb.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  await page.waitForTimeout(100);
  check(await text(page, `${A} .al-count[data-id="n0"] .al-countval`) === '2', `[${W} counter] a long press did not take one off: ${await text(page, `${A} .al-count[data-id="n0"] .al-countval`)}`);
  check(/In the lead/.test(await text(page, `${A} .al-leader`)) && /Laps/.test(await text(page, `${A} .al-leader b`)) && await page.locator(`${A} .al-count[data-lead="true"] .al-leadchip`).count() === 1, `[${W} counter] the leader is not shown`);
  m = await fit(page);
  check(fitOk(m), `[${W} counter fit] ${JSON.stringify(m)}`);

  // ── guide: contents and highlighted search ──
  await tryApp(page, GUIDE);
  check(await page.locator(`${A} article.al-guide`).count() === 3, `[${W} guide] not every section is in the article`);
  await page.click(`${A} .ak-tools button[aria-label="Contents"]`);
  check(await page.locator(`${A} .al-contents .al-tocrow`).count() === 3, `[${W} guide] the contents sheet lacks a section`);
  await page.click(`${A} .al-contents .al-tocrow:has-text("Clove hitch")`);
  await page.click(`${A} .ak-head button[aria-label="Search"]`);
  await page.fill(`${A} .ak-find`, 'loop');
  check(await page.locator(`${A} article.al-guide`).count() === 1 && await text(page, `${A} mark.al-hit`) === 'loop', `[${W} guide] search did not highlight "loop"`);
  m = await fit(page);
  check(fitOk(m), `[${W} guide fit] ${JSON.stringify(m)}`);

  // ── a game: the launcher, then PLAY starts the board ──
  await page.evaluate(() => { localStorage.removeItem('ghosty.app.sudoku.play'); location.hash = '#apps/sudoku'; });
  const launched = await page.waitForSelector(`${A} .al-launch`, { timeout: 10000 }).then(() => true, () => false);
  check(launched, `[${W} launcher] the game did not open on its launcher`);
  if (launched) {
    check(await page.locator(`${A} .al-art`).count() === 1 && await page.locator(`${A} .al-gchip`).count() === 3 && /Best/.test(await text(page, `${A} .al-gchips`)) && /Streak/.test(await text(page, `${A} .al-gchips`)) && /Today/.test(await text(page, `${A} .al-gchips`)), `[${W} launcher] the art tile or best, streak and today are missing`);
    await page.evaluate(() => { for (let i = 0; i < 4; i++) document.querySelector('.ak-tour:not([hidden]) button')?.click(); }); // (THE PRO ROUND: the tour is the coach marks now, ended with it)
    m = await fit(page);
    check(fitOk(m), `[${W} launcher fit] ${JSON.stringify(m)}`);
    await page.screenshot({ path: `${out}/applibkinds-launcher-${W}.png` });
    await page.click(`${A} .al-playkey`);
    check(await page.waitForSelector(`${A} .al-game`, { timeout: 8000 }).then(() => true, () => false), `[${W} launcher] PLAY did not start the board`);
  }
  await ctx.close();
}

await browser.close();
const s = Math.round((Date.now() - T0) / 1000);
if (problems.length) {
  console.log(`applibkinds: ${problems.length} problem(s) in ${s} s`);
  for (const p of problems) console.log(` - ${p}`);
  process.exit(1);
}
console.log(`applibkinds: OK (at 440 and 390: the calc's answer in words with its tone and meaning, no raw 0 or boolean, the slider, steppers, typing and a unit chip change it, KEEP saves to the history; the checklist ring and section cards; the timer ring runs and survives a reload; the deck flips and swipes right and left to its summary; the counter's tap, long press and leader; the guide's contents and highlighted search; a game's launcher and PLAY; ${s} s)`);
