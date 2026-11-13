// The LEARN tab on the owner's phone (440 × 956). From the chat ("teach me photosynthesis": the brain's tutor tool)
// a course is planned and the tab opens on its MAP: two units with their headers, five stops not started, the
// pace and what to know first; lesson 1 is read in its six parts (WHY IT MATTERS, THE IDEA, two worked examples,
// COMMON MISTAKES, TRY IT answered right, IN ONE LINE), NEXT goes on to lesson 2, the streak starts and the one
// line is a card for tomorrow; a quiz is taken with the confidence taps (SURE, THINK SO, GUESSING: 44 points
// tall, before any mark is shown) — a sure wrong answer, a right one, a right short answer marked by the brain —
// and scored; the map then shows lesson 1 QUIZ PASSED and the CALIBRATION line; REVISE on the map (up to 10 of
// the course's due cards) shows the miss offline, rated AGAIN and then GOOD when it comes back (the lapse
// counts); with the brain unreachable the course and cards are still there (the phone's copy) and a lesson is
// finished; back online the queued revisions and lesson reach the brain and both copies agree. Then the EXAM,
// with a faked clock: started, two answers, left for two minutes (the clock kept running), the page reloaded
// (resumed with the same deadline and the answers kept), finished: the grade, the weak lesson with REVISE, the
// result on the map; a second exam left to run out is marked by itself. Nothing sticks out sideways; the
// security policy blocks nothing.
import { launch, webkitNoise } from './browser.mjs';
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
// the map: two units with their headers, every stop not started, the pace, what to know first, the mastery ring
const units = await L('.learnunit b').allInnerTexts();
if (units.join(' | ') !== 'UNIT 1 · The basics | UNIT 2 · Going further') problems.push(`the map's units are "${units.join(' | ')}"`);
const map0 = (await st())?.map;
if (map0?.units !== 2 || map0?.stops?.join(',') !== 'new,new,new,new,new' || map0?.mastery !== 0) problems.push(`the map's state is ${JSON.stringify(map0)}`);
if ((await L('.learnunit').nth(1).locator('xpath=following-sibling::div[1]').locator('.learnlesson').count()) !== 2) problems.push('unit 2 does not hold lessons 4 and 5');
const pace = await L('.learnfact.pace').innerText().catch(() => '');
if (!/^PACE\s+3 lessons a week, done by \d{1,2} (October|November) · on track$/.test(pace)) problems.push(`the pace says "${pace}"`);
if (!/BEFORE YOU START\s+what a plant cell is/.test(await L('.learnfact.prereqs').innerText().catch(() => ''))) problems.push('no BEFORE YOU START line');
if ((await L('.learnhead .learnring text').textContent().catch(() => '')) !== '0%') problems.push('the map\'s ring does not show the mastery (0%)');
if (!(await L('.learnlesson.next[data-n="1"]').count())) problems.push('the next stop (lesson 1) is not lit');
await page.screenshot({ path: `${out}/learn-map.png` });

// ---- lesson 1: read it, answer its check question, NEXT ----
await L('.learnbar button.on').first().click();
await until(() => window.__ghosty?.learn?.view === 'lesson' && !!document.querySelector('#pg-learn .learntext'), 15000, 'lesson 1 did not open');
const text = await L('.learntext').innerText();
if (!/Plants use light to make sugar/.test(text)) problems.push(`the lesson text is not the written lesson: ${text.slice(0, 120)}`);
// the six parts, in order: WHY IT MATTERS, THE IDEA, TWO WORKED EXAMPLES, COMMON MISTAKES, TRY IT, IN ONE LINE
const parts = await page.$$eval('#pg-learn [data-part]', (els) => els.map((e) => e.getAttribute('data-part')));
if (parts.join(',') !== 'why,idea,examples,mistakes,try,summary') problems.push(`the lesson's parts are ${parts.join(',')}`);
if ((await L('[data-part="examples"] .learnexample').count()) !== 2) problems.push('the lesson does not have two worked examples');
if ((await L('[data-part="examples"] .learnexample').first().locator('ol li').count()) !== 3) problems.push('the first worked example is not three numbered steps');
if ((await L('[data-part="mistakes"] li').count()) !== 2) problems.push('COMMON MISTAKES is not two lines');
const oneLine = await L('[data-part="summary"]').innerText().catch(() => '');
if (!/IN ONE LINE\s+plants turn light, water and carbon dioxide into sugar and oxygen\.\s+Becomes a flashcard when you finish this lesson\./.test(oneLine)) problems.push(`IN ONE LINE says "${oneLine}"`);
const labels = await page.$$eval('#pg-learn [data-part] > .lab', (els) => els.map((e) => e.textContent));
if (labels.join(' | ') !== 'WHY IT MATTERS | THE IDEA | TWO WORKED EXAMPLES | COMMON MISTAKES | TRY IT | IN ONE LINE') problems.push(`the parts are labelled ${labels.join(' | ')}`);
if (!(await L('.learntext sup.learncite').count())) problems.push('the lesson shows no [n] source markers');
if (!(await L('button', { hasText: 'READ ALOUD' }).count()) && !(await page.locator('#pg-learn button:has-text("READ ALOUD")').count())) problems.push('no READ ALOUD');
const choices = L('.learncheck button.learnchoice');
if ((await choices.count()) !== 4) problems.push(`the TRY IT question has ${await choices.count()} choices`);
await choices.nth(1).click();
await until(() => window.__ghosty?.learn?.quiz?.last === 'right', 5000, 'the check question was not marked right');
if (!(await L('.learncheck button.learnchoice.good').count())) problems.push('the right choice is not shown in green');
await page.screenshot({ path: `${out}/learn-lesson.png`, fullPage: true });
// the top of the lesson (the page and the panel scroll on their own: both back to the lesson's head)
await page.evaluate(() => {
  for (let el = document.querySelector('#pg-learn .learnstudy .learnhead'); el; el = el.parentElement) if (el.scrollTop) el.scrollTop = 0;
  document.querySelector('#pg-learn .learnstudy')?.scrollIntoView({ block: 'start' });
});
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/learn-lesson-top.png` });
await wideCheck('the lesson');
await page.locator('#pg-learn button:has-text("NEXT LESSON")').click();
await until(() => window.__ghosty?.learn?.view === 'lesson' && window.__ghosty?.learn?.lesson === 2 && !!document.querySelector('#pg-learn .learntext'), 15000, 'NEXT did not go on to lesson 2');
await until(() => window.__ghosty?.learn?.streak?.current >= 1 && window.__ghosty?.learn?.streak?.today === true, 5000, `the streak did not start: ${JSON.stringify((await st())?.streak)}`);
const big = await page.locator('#pg-learn .bigv').innerText();
if (!/1 DAY STREAK/i.test(big)) problems.push(`the hero says "${big}"`);
// lesson 1's IN ONE LINE is now a card about lesson 1, back tomorrow (not due now)
await until(() => (JSON.parse(localStorage.getItem('ghosty.learn') ?? '{}').cards ?? []).some((c) => c.lesson === 1 && /Sum it up in one line/.test(c.front)), 5000, 'reading lesson 1 did not make its one-line card');
const lineCard = await page.evaluate(() => (JSON.parse(localStorage.getItem('ghosty.learn') ?? '{}').cards ?? []).find((c) => /Sum it up in one line/.test(c.front)));
if (lineCard && lineCard.due - lineCard.added !== 86_400_000) problems.push(`the one-line card is due ${(lineCard.due - lineCard.added) / 3600000} h after it was made (want tomorrow: 24 h)`);

// ---- a quiz: wrong, right, a right short answer; the score ----
await page.locator('#pg-learn button:has-text("BACK TO COURSE")').click();
await until(() => window.__ghosty?.learn?.view === 'course', 8000, 'BACK TO COURSE did not go back');
await page.locator('#pg-learn button:has-text("QUIZ ME")').click();
await until(() => window.__ghosty?.learn?.view === 'quiz' && window.__ghosty?.learn?.quiz?.n === 3, 15000, `the quiz did not open with 3 questions (${JSON.stringify((await st())?.quiz)})`);
/** The three confidence taps, after an answer is picked and before it is marked: each at least 44 points tall. */
const confTap = async (which) => {
  await L('.learnconf').waitFor({ timeout: 5000 });
  const boxes = await L('.learnconf button').evaluateAll((els) => els.map((e) => [e.textContent, Math.round(e.getBoundingClientRect().height)]));
  if (boxes.map((b) => b[0]).join(',') !== 'SURE,THINK SO,GUESSING' || boxes.some((b) => b[1] < 44)) problems.push(`the confidence taps are ${JSON.stringify(boxes)} (want SURE, THINK SO, GUESSING, 44 points or more)`);
  await L(`.learnconf button.${which}`).click();
};
await L('button.learnchoice').nth(1).click(); // "Oxygen": wrong
if ((await st())?.quiz?.answered !== 0 || (await L('button.learnchoice.good, button.learnchoice.bad').count())) problems.push('the answer was marked before the confidence was tapped');
await page.screenshot({ path: `${out}/learn-quiz-confidence.png` });
await confTap('sure');
await until(() => window.__ghosty?.learn?.quiz?.last === 'wrong', 5000, 'a wrong answer was not marked wrong');
if (!/You were sure: this card comes back more often\./.test(await L('.learnfeed').innerText())) problems.push('a sure but wrong answer does not say its card comes back more often');
await page.screenshot({ path: `${out}/learn-quiz.png` });
await page.locator('#pg-learn .learnbar button:has-text("NEXT")').click();
await L('button.learnchoice', { hasText: 'Chloroplast' }).click();
await confTap('think');
await until(() => window.__ghosty?.learn?.quiz?.last === 'right' && window.__ghosty?.learn?.quiz?.right === 1, 5000, 'a right answer was not marked right');
await page.locator('#pg-learn .learnbar button:has-text("NEXT")').click();
await L('.learnshort input').fill('Chlorophyll');
await L('.learnshort button').click();
await confTap('guess');
await until(() => window.__ghosty?.learn?.quiz?.answered === 3 && window.__ghosty?.learn?.quiz?.right === 2, 10000, `the short answer was not marked right by the brain (${JSON.stringify((await st())?.quiz)})`);
await page.locator('#pg-learn .learnbar button:has-text("SCORE")').click();
const score = await L('.learnscore b').innerText().catch(() => '');
if (score !== '2 / 3') problems.push(`the score says "${score}"`);
await wideCheck('the quiz');
// the map: lesson 1 quiz passed (4 answers, 3 right: 75 %, a card due), the calibration line
await page.locator('#pg-learn button:has-text("BACK TO COURSE")').click();
await until(() => window.__ghosty?.learn?.view === 'course' && window.__ghosty?.learn?.map?.stops?.[0] === 'passed', 8000, `lesson 1 is not QUIZ PASSED on the map (${JSON.stringify((await st())?.map)})`);
const calib = await L('.learnfact.calib').innerText().catch(() => '');
if (!/CALIBRATION\s+Sure and right 0 of 1 · Thought so and right 1 of 1 · Guessed and right 1 of 1/.test(calib)) problems.push(`the calibration line says "${calib}"`);
if (!/QUIZ PASSED · quiz 75% · 1 card due/.test(await L('.learnlesson[data-n="1"] small').innerText())) problems.push(`stop 1 says "${await L('.learnlesson[data-n="1"] small').innerText()}"`);
// the guessed right answer still made a card (back tomorrow); the sure wrong one is due now, at quality 1
const qcards = await page.evaluate(() => (JSON.parse(localStorage.getItem('ghosty.learn') ?? '{}').cards ?? []).filter((c) => !/Sum it up/.test(c.front)).map((c) => ({ front: c.front.split('\n')[0], ef: c.ef, interval: c.interval, lesson: c.lesson })));
if (!qcards.some((c) => /green pigment/.test(c.front) && c.interval === 1) || !qcards.some((c) => /Which gas/.test(c.front) && c.ef === 1.96 && c.lesson === 1)) problems.push(`the quiz's cards are ${JSON.stringify(qcards)}`);
await until(() => document.querySelector('#pg-learn .learncourse .learncinfo small')?.textContent?.includes('1/5 read'), 8000, `the course list does not show lesson 1 read: ${await L('.learncourse .learncinfo small').first().textContent().catch(() => '?')}`);

// ---- REVISE, offline: the miss is a card, due now; AGAIN, then GOOD when it comes back ----
await until(() => window.__ghosty?.learn?.due >= 1, 8000, 'the wrong answer did not become a card due now');
const mirror = () => page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.learn') ?? '{}'));
const ask = (path) => page.evaluate((p) => fetch(`/api/learn${p}`, { headers: { 'x-ghosty': '1', 'x-ghosty-key': 'preview-owner-key-0123456789' } }).then((r) => r.json()), path);
await page.route('**/api/learn**', (r) => r.abort());
const reviseLabel = await L('button.learnrevisebtn').innerText().catch(() => '');
if (!/^REVISE 1$/i.test(reviseLabel.trim())) problems.push(`the map's REVISE button says "${reviseLabel}" (want REVISE 1: one card due)`);
await L('button.learnrevisebtn').click();
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
// (its own card: another spec's cards may be due on a shared preview — MARK MY WORK keeps its misses in LEARN)
await until(() => window.__ghosty?.learn?.revise?.done === 2 && (() => { try { return JSON.parse(localStorage.getItem('ghosty.learn') ?? '{}').cards?.filter((c) => /Which gas do plants take in/.test(c.front ?? '') && c.due <= Date.now()).length === 0; } catch { return false; } })(), 5000, `GOOD did not finish the card (${JSON.stringify((await st())?.revise)})`);
await page.waitForTimeout(400);
// AGAIN then GOOD on the sure-but-wrong card (ease 1.96): the lapse counts (1.96 → 1.42, one lapse), then 1 day
let m = await mirror();
const card = (m.cards ?? []).find((c) => front.startsWith(c.front.split('\n')[0]));
if (!card || card.lapses !== 1 || card.reps !== 1 || card.interval !== 1 || Math.abs(card.ef - 1.42) > 1e-9) problems.push(`after AGAIN then GOOD the phone's card is ${JSON.stringify(card && { reps: card.reps, interval: card.interval, ef: card.ef, lapses: card.lapses })} (want reps 1, interval 1, ef 1.42, lapses 1)`);
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
await until(() => document.querySelector('#pg-learn .learncourse .learncinfo small')?.textContent?.includes('2/5 read'), 8000, `after syncing the course list says ${await L('.learncourse .learncinfo small').first().textContent().catch(() => '?')} (want 2/5 read)`);

// ---- the EXAM, on a faked clock: start, answer, leave, come back, reload, finish; then one left to run out ----
// The page's clock (Date.now) is moved on by hand: __advance(ms) is time passing while the owner is away. (Playwright's
// own page.clock runs the app's 3-D backdrop frame after frame on fake time and starves the page, so it is not used.)
await page.addInitScript(() => {
  const real = Date.now.bind(Date);
  const shift = () => Number(sessionStorage.getItem('__shift') || 0);
  Date.now = () => real() + shift();
  window.__advance = (ms) => sessionStorage.setItem('__shift', String(shift() + ms));
});
const advance = (ms) => page.evaluate((x) => window.__advance(x), ms);
await page.reload();
await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 }).catch(() => undefined);
await page.evaluate(() => (location.hash = 'learn'));
await until(() => document.querySelectorAll('#pg-learn .learncourse').length === 1, 10000, 'the course list did not come back after the reload');
await page.locator('#pg-learn .learncourse').first().click();
await until(() => window.__ghosty?.learn?.view === 'course', 8000, 'the course map did not open');
await L('button.learnexambtn').click();
await until(() => window.__ghosty?.learn?.view === 'exam' && window.__ghosty?.learn?.exam?.n > 0 && !!document.querySelector('#pg-learn .learnclock'), 15000, `the exam did not start (${JSON.stringify((await st())?.exam)})`);
const exam0 = (await st())?.exam;
// lessons 1 and 2 were opened: their pools (TRY IT and the quiz's questions) and one question each the scripted model added
/** The exam as the phone keeps it (its save follows each answer by a moment: waited for). */
const held = async () => {
  await page.waitForFunction(() => {
    const e = JSON.parse(localStorage.getItem('ghosty.learn') ?? '{}').exam;
    const s = window.__ghosty?.learn?.exam;
    return !!e && !!s && e.answers.length === s.answered && e.i === s.i;
  }, null, { timeout: 5000 }).catch(() => problems.push('the phone did not keep the exam'));
  return (await mirror()).exam;
};
let ex = await held();
const lessonsIn = [...new Set(ex?.exam?.questions?.map((q) => q.lesson))];
if (exam0.n < 3 || exam0.n > 20 || lessonsIn.join(',') !== '1,2') problems.push(`the exam has ${exam0.n} questions on lessons ${lessonsIn.join(',')} (want lessons 1 and 2)`);
if (ex?.exam?.seconds !== exam0.n * 90) problems.push(`the exam's time is ${ex?.exam?.seconds} s for ${exam0.n} questions (a beginner: 90 s each)`);
if (Math.abs(exam0.left - exam0.n * 90) > 3) problems.push(`the clock starts at ${exam0.left} s (want ${exam0.n * 90})`);
/** Answer the question on show: lesson 1's right, lesson 2's wrong; then how sure. */
const answerOne = async () => {
  const e = await held();
  const q = e.exam.questions[e.i];
  if (q.kind === 'mc') await L('button.learnchoice').nth(q.lesson === 1 ? q.answer : (q.answer + 1) % q.choices.length).click();
  else {
    await L('.learnshort input').fill(q.lesson === 1 ? String(q.answer) : 'no idea');
    await L('.learnshort button').click();
  }
  if (await L('.learnfeed.good, .learnfeed.bad, button.learnchoice.good, button.learnchoice.bad').count()) problems.push('the exam showed a mark before the end');
  await confTap(q.lesson === 1 ? 'sure' : 'think');
  await until((i) => window.__ghosty?.learn?.exam?.answered === i, 5000, 'an exam answer was not kept', e.answers.length + 1);
};
await answerOne();
await answerOne();
await page.waitForTimeout(1100);
await page.screenshot({ path: `${out}/learn-exam.png` });
await wideCheck('the exam');
// leave for two minutes (another screen), and come back: the clock kept running
const before = (await st()).exam.left;
await page.evaluate(() => (location.hash = 'core'));
await page.waitForTimeout(300);
await advance(120_000);
await page.evaluate(() => (location.hash = 'learn'));
await until(() => window.__ghosty?.learn?.view === 'exam' && !!document.querySelector('#pg-learn .learnclock'), 5000, 'coming back did not resume the exam');
await page.waitForTimeout(1100);
const after = (await st()).exam.left;
if (after > before - 120 || after < before - 126) problems.push(`after two minutes away the clock shows ${after} s (it showed ${before} s: want about ${before - 121})`);
// a reload (a real leave): the same exam, the same deadline, the answers kept
const deadline = (await held()).endsAt;
await page.waitForTimeout(400);
await page.reload();
await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 }).catch(() => undefined);
await page.evaluate(() => (location.hash = 'learn'));
await until(() => [...document.querySelectorAll('#pg-learn button.learnbig')].some((b) => /RESUME EXAM/i.test(b.textContent)), 10000, 'after a reload the home does not offer RESUME EXAM');
await page.locator('#pg-learn button.learnbig', { hasText: /RESUME EXAM/i }).click();
await until(() => window.__ghosty?.learn?.view === 'exam' && window.__ghosty?.learn?.exam?.answered === 2, 8000, `the exam did not resume with its 2 answers (${JSON.stringify((await st())?.exam)})`);
ex = await held();
if (ex.exam.id !== exam0.id || ex.endsAt !== deadline) problems.push(`after a reload the exam is ${ex.exam.id} ending ${ex.endsAt} (want ${exam0.id} ending ${deadline}: the same deadline)`);
// the rest, then FINISH AND MARK
while ((await held()).i < exam0.n) await answerOne();
await L('button:has-text("FINISH AND MARK")').click();
await until(() => window.__ghosty?.learn?.exam?.done === true, 15000, `the exam was not marked (${JSON.stringify((await st())?.exam)})`);
const res = (await st()).exam;
const l1 = ex.exam.questions.filter((q) => q.lesson === 1).length;
// the time taken is the phone's (the two minutes away count): at least 120 s
const usedText = await L('.learngrade small').innerText().catch(() => '');
const usedSec = (([m, s]) => Number(m) * 60 + Number(s))((usedText.match(/· (\d+):(\d\d) of /) ?? [0, 0, 0]).slice(1));
if (usedSec < 120) problems.push(`the result says "${usedText}": the two minutes away are not counted`);
if (res.right !== l1 || res.n !== exam0.n) problems.push(`the exam scored ${res.right} of ${res.n} (want ${l1} of ${exam0.n}: lesson 1 right, lesson 2 wrong)`);
const wantGrade = res.pct >= 85 ? 'Top band' : res.pct >= 70 ? 'Secure' : res.pct >= 50 ? 'Expected' : 'Working towards';
if (res.grade !== wantGrade) problems.push(`the grade is "${res.grade}" at ${res.pct}% (the percent bands give ${wantGrade})`);
if (res.weak.join(',') !== '2') problems.push(`the weak lessons are ${res.weak.join(',')} (want lesson 2)`);
if (!/^2\. The key ideas: photosynthesis/.test(await L('.learnweakrow b').first().innerText().catch(() => ''))) problems.push('the weak lesson is not named');
if ((await L('.learnrev').count()) !== exam0.n) problems.push('the result does not list every question');
await page.screenshot({ path: `${out}/learn-exam-result.png`, fullPage: true });
await wideCheck('the exam result');
// REVISE on the weak lesson: its cards (the exam's misses about lesson 2)
await L('.learnweakrow button:has-text("REVISE")').first().click();
await until(() => window.__ghosty?.learn?.view === 'revise' && window.__ghosty?.learn?.revise?.left >= 1, 5000, `REVISE on the weak lesson shows no cards (${JSON.stringify((await st())?.revise)})`);
const weakCard = await L('.learnfront').innerText().catch(() => '');
const l2q = ex.exam.questions.filter((q) => q.lesson === 2).map((q) => q.q);
if (!l2q.some((q) => weakCard.startsWith(q))) problems.push(`REVISE on lesson 2 shows "${weakCard.slice(0, 60)}", not one of its questions`);
// the result is on the map
await page.locator('#pg-learn .learncourse').first().click();
await until(() => window.__ghosty?.learn?.view === 'course', 8000, 'the course map did not open after the exam');
const lastExam = await L('.learnfact.lastexam').innerText().catch(() => '');
if (!new RegExp(`LAST EXAM\\s+${res.grade} · ${res.right} of ${res.n} \\(${res.pct}%\\)`).test(lastExam)) problems.push(`the map's last exam says "${lastExam}"`);
await page.screenshot({ path: `${out}/learn-map-after.png`, fullPage: true });
// a second exam, left to run out: the time is up and it is marked by itself (nothing answered: all wrong)
await L('button.learnexambtn').click();
await until(() => window.__ghosty?.learn?.view === 'exam' && window.__ghosty?.learn?.exam?.done === false && window.__ghosty?.learn?.exam?.left > 0, 15000, 'a second exam did not start');
const n2 = (await st()).exam.n;
await advance((n2 * 90 + 5) * 1000);
await until(() => window.__ghosty?.learn?.exam?.done === true, 15000, `an exam whose time ran out was not marked (${JSON.stringify((await st())?.exam)})`);
const out2 = (await st()).exam;
if (out2.right !== 0 || out2.grade !== 'Working towards') problems.push(`the timed-out exam scored ${out2.right} (${out2.grade}): nothing was answered`);

await wideCheck('the tab');
const csp = await page.evaluate(() => window.__csp);
if (csp.length) problems.push(`security policy blocked: ${csp.join(' | ')}`);
await page.screenshot({ path: `${out}/learn-final.png` });

await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : `LEARN run clean at 440 × 956: "teach me photosynthesis" planned a course of two units and opened its map (pace, what to know first, mastery 0%), lesson 1 read in its six parts with its sources and TRY IT answered, NEXT went on, the streak started and the one line became a card for tomorrow, a quiz with SURE / THINK SO / GUESSING before each mark scored 2 / 3 (the short answer marked by the brain), the map showed lesson 1 QUIZ PASSED and the calibration line, REVISE on the map rated the sure miss AGAIN then GOOD offline, the course, cards and lessons stayed on the phone offline, a lesson finished offline counted, on reconnect the brain's copy matched the phone's, and the exam on a faked clock kept its deadline through leaving and a reload, was marked with its grade and weak lesson (REVISE showed its cards, the map its result), and a second one left to run out marked itself.`);
process.exit(problems.length ? 1 : 0);
