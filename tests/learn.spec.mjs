// The LEARN tab on an iPhone 13. From the chat ("teach me photosynthesis": the brain's tutor tool)
// a course is planned and the tab opens on it; lesson 1 is read (written by the scripted model,
// its CHECK question answered right), NEXT goes on to lesson 2 and the streak starts; a quiz is
// taken (a wrong multiple-choice answer, a right one, a right short answer marked by the brain)
// and scored; the miss became a flashcard that REVISE shows offline, rated AGAIN and then GOOD
// when it comes back (the lapse counts); with the brain unreachable the course and cards are still
// there (the phone's copy) and a lesson is finished; back online the queued revisions and lesson
// reach the brain and both copies agree. Nothing sticks out sideways; the security policy blocks nothing.
import { launch, webkitNoise } from './browser.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const problems = [];
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
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
  document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
});

await page.goto(base);
await page.fill('#pair input', 'preview-owner-key-0123456789');
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });

const st = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__ghosty?.learn ?? null)));
const until = (fn, ms, what, arg = null) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => { problems.push(what); return false; });
const L = (sel, opts) => page.locator(`#pg-learn ${sel}`, opts);
const wideCheck = async (where) => {
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (wide) problems.push(`${where}: the page is wider than the phone`);
};
/** The chat log is an overlay on phones: close it when it covers the tab. */
const closeLog = async () => {
  if (!(await page.locator('.logbtn').isVisible())) return;
  const covered = await page.evaluate(() => {
    const c = document.querySelector('#pg-learn .learnstudy');
    if (!c) return true;
    const r = c.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, Math.max(r.top + 20, 80));
    return !c.contains(el);
  });
  if (covered) await page.click('.logbtn');
};

// ---- from the chat: "teach me photosynthesis" plans a course and opens it ----
await page.click('.logbtn');
await page.fill('#cin', 'teach me photosynthesis');
await page.keyboard.press('Enter');
await until(() => window.__ghosty?.ui?.get?.().tab === 'learn', 25000, "the brain's tutor tool did not open the LEARN tab");
await until(() => window.__ghosty?.learn?.view === 'course' && window.__ghosty?.learn?.courses === 1, 15000, `the course view did not open (${JSON.stringify(await st())})`);
await closeLog();
const lessonCount = await L('.learnlesson').count();
if (lessonCount !== 5) problems.push(`the course lists ${lessonCount} lessons (want the scripted plan's 5)`);
if (!(await L('.learncourse .learnring').count())) problems.push('the course has no progress ring');
await page.screenshot({ path: `${out}/learn-course.png` });

// ---- lesson 1: read it, answer its check question, NEXT ----
await L('.learnbar button.on').first().click();
await until(() => window.__ghosty?.learn?.view === 'lesson' && !!document.querySelector('#pg-learn .learntext'), 15000, 'lesson 1 did not open');
const text = await L('.learntext').innerText();
if (!/Plants use light to make sugar/.test(text)) problems.push(`the lesson text is not the written lesson: ${text.slice(0, 120)}`);
if (!(await L('.learntext sup.learncite').count())) problems.push('the lesson shows no [n] source markers');
if (!(await L('button', { hasText: 'READ ALOUD' }).count()) && !(await page.locator('#pg-learn button:has-text("READ ALOUD")').count())) problems.push('no READ ALOUD');
const choices = L('.learncheck button.learnchoice');
if ((await choices.count()) !== 4) problems.push(`the check question has ${await choices.count()} choices`);
await choices.nth(1).click();
await until(() => window.__ghosty?.learn?.quiz?.last === 'right', 5000, 'the check question was not marked right');
if (!(await L('.learncheck button.learnchoice.good').count())) problems.push('the right choice is not shown in green');
await page.screenshot({ path: `${out}/learn-lesson.png`, fullPage: true });
await wideCheck('the lesson');
await page.locator('#pg-learn button:has-text("NEXT LESSON")').click();
await until(() => window.__ghosty?.learn?.view === 'lesson' && window.__ghosty?.learn?.lesson === 2 && !!document.querySelector('#pg-learn .learntext'), 15000, 'NEXT did not go on to lesson 2');
await until(() => window.__ghosty?.learn?.streak?.current >= 1 && window.__ghosty?.learn?.streak?.today === true, 5000, `the streak did not start: ${JSON.stringify((await st())?.streak)}`);
const big = await page.locator('#pg-learn .bigv').innerText();
if (!/1 DAY STREAK/i.test(big)) problems.push(`the hero says "${big}"`);

// ---- a quiz: wrong, right, a right short answer; the score ----
await page.locator('#pg-learn button:has-text("BACK TO COURSE")').click();
await until(() => window.__ghosty?.learn?.view === 'course', 8000, 'BACK TO COURSE did not go back');
await page.locator('#pg-learn button:has-text("QUIZ ME")').click();
await until(() => window.__ghosty?.learn?.view === 'quiz' && window.__ghosty?.learn?.quiz?.n === 3, 15000, `the quiz did not open with 3 questions (${JSON.stringify((await st())?.quiz)})`);
await L('button.learnchoice').nth(1).click(); // "Oxygen": wrong
await until(() => window.__ghosty?.learn?.quiz?.last === 'wrong', 5000, 'a wrong answer was not marked wrong');
await page.screenshot({ path: `${out}/learn-quiz.png` });
await page.locator('#pg-learn .learnbar button:has-text("NEXT")').click();
await L('button.learnchoice', { hasText: 'Chloroplast' }).click();
await until(() => window.__ghosty?.learn?.quiz?.last === 'right' && window.__ghosty?.learn?.quiz?.right === 1, 5000, 'a right answer was not marked right');
await page.locator('#pg-learn .learnbar button:has-text("NEXT")').click();
await L('.learnshort input').fill('Chlorophyll');
await L('.learnshort button').click();
await until(() => window.__ghosty?.learn?.quiz?.answered === 3 && window.__ghosty?.learn?.quiz?.right === 2, 10000, `the short answer was not marked right by the brain (${JSON.stringify((await st())?.quiz)})`);
await page.locator('#pg-learn .learnbar button:has-text("SCORE")').click();
const score = await L('.learnscore b').innerText().catch(() => '');
if (score !== '2 / 3') problems.push(`the score says "${score}"`);
await wideCheck('the quiz');
await until(() => document.querySelector('#pg-learn .learncourse .learnring text')?.textContent === '1/5', 8000, `the course ring does not show lesson 1 done: ${await L('.learncourse .learnring text').first().textContent().catch(() => '?')}`);

// ---- REVISE, offline: the miss is a card, due now; AGAIN, then GOOD when it comes back ----
await until(() => window.__ghosty?.learn?.due >= 1, 8000, 'the wrong answer did not become a card due now');
const mirror = () => page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.learn') ?? '{}'));
const ask = (path) => page.evaluate((p) => fetch(`/api/learn${p}`, { headers: { 'x-ghosty': '1', 'x-ghosty-key': 'preview-owner-key-0123456789' } }).then((r) => r.json()), path);
await page.route('**/api/learn**', (r) => r.abort());
await page.locator('#pg-learn button:has-text("REVISE")').first().click();
await until(() => window.__ghosty?.learn?.view === 'revise' && !!document.querySelector('#pg-learn .learncard'), 5000, 'REVISE did not show a card');
const front = await L('.learnfront').innerText();
if (!/Which gas do plants take in/.test(front)) problems.push(`the card's front is "${front.slice(0, 80)}"`);
await page.locator('#pg-learn button:has-text("SHOW ANSWER")').click();
if (!(await L('.learnback').isVisible())) problems.push('SHOW ANSWER did not show the back');
const small = await L('button.learnrate.good small').innerText();
if (small !== '1 day') problems.push(`GOOD on a new card should say "1 day", says "${small}"`);
await page.screenshot({ path: `${out}/learn-revise.png` });
await wideCheck('the flashcards');
await L('button.learnrate.again').click();
await until(() => window.__ghosty?.learn?.revise?.done === 1 && !!document.querySelector('#pg-learn .learncard'), 5000, 'AGAIN did not bring the card back in this sitting');
const front2 = await L('.learnfront').innerText();
if (front2 !== front) problems.push(`after AGAIN the next card is "${front2.slice(0, 80)}", not the forgotten one`);
await page.locator('#pg-learn button:has-text("SHOW ANSWER")').click();
await L('button.learnrate.good').click();
await until(() => window.__ghosty?.learn?.revise?.done === 2 && window.__ghosty?.learn?.due === 0, 5000, `GOOD did not finish the card (${JSON.stringify((await st())?.revise)})`);
await page.waitForTimeout(400);
// AGAIN then GOOD on a new card: the lapse counts (ease 2.5 → 1.96, one lapse), then 1 day
let m = await mirror();
const card = (m.cards ?? []).find((c) => front.startsWith(c.front.split('\n')[0]));
if (!card || card.lapses !== 1 || card.reps !== 1 || card.interval !== 1 || Math.abs(card.ef - 1.96) > 1e-9) problems.push(`after AGAIN then GOOD the phone's card is ${JSON.stringify(card && { reps: card.reps, interval: card.interval, ef: card.ef, lapses: card.lapses })} (want reps 1, interval 1, ef 1.96, lapses 1)`);
if (m.pending?.length !== 2) problems.push(`offline, ${m.pending?.length} revisions are queued (want 2)`);

// ---- still offline after a reload: the course and the cards are on the phone; a lesson is finished here ----
await page.reload();
await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 }).catch(() => undefined);
await page.evaluate(() => (location.hash = 'learn'));
await until(() => window.__ghosty?.learn?.courses === 1 && document.querySelectorAll('#pg-learn .learncourse').length === 1, 10000, 'with the brain unreachable the course is gone from the phone');
const cards = (await mirror()).cards?.length ?? 0;
if (cards < 1) problems.push('the cards were not kept on the phone');
await page.locator('#pg-learn .learncourse').first().click();
await until(() => window.__ghosty?.learn?.view === 'course', 5000, 'the course does not open offline');
await page.locator('#pg-learn .learnlesson').first().click();
await until(() => window.__ghosty?.learn?.view === 'lesson' && /Plants use light/.test(document.querySelector('#pg-learn .learntext')?.textContent ?? ''), 5000, 'lesson 1 cannot be read again offline');
await page.locator('#pg-learn button:has-text("BACK TO COURSE")').click();
await until(() => window.__ghosty?.learn?.view === 'course', 5000, 'BACK TO COURSE did not go back offline');
await page.locator('#pg-learn .learnlesson').nth(1).click();
await until(() => window.__ghosty?.learn?.view === 'lesson' && window.__ghosty?.learn?.lesson === 2 && !!document.querySelector('#pg-learn .learntext'), 5000, 'lesson 2 cannot be read again offline');
await page.locator('#pg-learn button:has-text("NEXT LESSON")').click();
await until(() => JSON.parse(localStorage.getItem('ghosty.learn') ?? '{}').courses?.[0]?.done === 2, 5000, 'finishing lesson 2 offline did not count on the phone');
m = await mirror();
if (m.pendingDone?.length !== 1) problems.push(`offline, ${m.pendingDone?.length} finished lessons are queued (want 1)`);

// ---- back online: what waited is sent, and the brain's copy agrees with the phone's ----
await page.unroute('**/api/learn**');
await page.reload();
await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 }).catch(() => undefined);
await page.evaluate(() => (location.hash = 'learn'));
await until(() => {
  const s = JSON.parse(localStorage.getItem('ghosty.learn') ?? '{}');
  return s.pending?.length === 0 && s.pendingDone?.length === 0 && s.synced > 0;
}, 10000, `the offline revisions and lesson were not sent on reconnect (${JSON.stringify(await mirror().then((x) => ({ pending: x.pending?.length, pendingDone: x.pendingDone?.length })))})`);
await page.waitForTimeout(500);
m = await mirror();
const brainState = await ask('');
const bc = brainState.cards?.find((c) => c.id === card?.id);
const pc = m.cards?.find((c) => c.id === card?.id);
const pick = (c) => c && JSON.stringify([c.reps, c.interval, c.ef, c.lapses, c.due, c.last]);
if (!bc || pick(bc) !== pick(pc)) problems.push(`the brain's card ${pick(bc)} is not the phone's ${pick(pc)}`);
if (brainState.courses?.[0]?.done !== 2) problems.push(`the brain has ${brainState.courses?.[0]?.done} lessons done (want 2: lesson 2 was finished offline)`);
if (m.courses?.[0]?.done !== 2) problems.push(`after syncing the phone shows ${m.courses?.[0]?.done} lessons done (want 2)`);
const brainCourse = await ask(`/course/${brainState.courses?.[0]?.id}`);
if (!brainCourse.course?.lessons?.[1]?.done) problems.push("the brain's course does not have lesson 2 done");
await until(() => document.querySelector('#pg-learn .learncourse .learnring text')?.textContent === '2/5', 8000, `after syncing the course ring says ${await L('.learncourse .learnring text').first().textContent().catch(() => '?')} (want 2/5)`);

await wideCheck('the tab');
const csp = await page.evaluate(() => window.__csp);
if (csp.length) problems.push(`security policy blocked: ${csp.join(' | ')}`);
await page.screenshot({ path: `${out}/learn-final.png` });

await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : `LEARN run clean on an iPhone 13: "teach me photosynthesis" planned a 5-lesson course and opened it, lesson 1 read with its sources and check question answered, NEXT went on and the streak started, a quiz scored 2 / 3 with the short answer marked by the brain, the miss became a card that REVISE rated AGAIN then GOOD offline, the course, cards and lessons stayed on the phone offline, a lesson finished offline counted, and on reconnect the brain's copy matched the phone's.`);
process.exit(problems.length ? 1 : 0);
