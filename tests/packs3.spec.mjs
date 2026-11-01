// THE OUTSIDE, HOME AND LEARNING PACKS on the owner's phone (BRIEF-PACKS-3), against the preview's real brain and its scripted
// model (the mock calls the tools; every number, date and picture is made by code), at 440 × 956 and 390 × 844. No flow here
// needs the internet: the maps, the police data and the planning data are covered by the brain's own tests on real captures.
// The smoke loop runs every spec against ONE preview brain: nothing here assumes it is empty (what a flow needs is put back to
// nothing first, each reply waited for is one that arrives AFTER the message that asked for it), and what it kept is forgotten at
// the end.
//  - OUTSIDE: "I parked on Cannon Street until 3pm" typed → kept by the brain, "where did I park?" answers from it; "split the
//    taxi: £48, I paid, between me, Sam and Jo" typed → who owes whom, to the penny; the OUTSIDE sheet keeps a parked spot with a
//    rule and splits a fare;
//  - HOME: "bins are Tuesday, recycling every other Tuesday, next recycling is 10 November" typed → kept, "when are the bins?"
//    answered with no model; the HOME sheet reads a pasted bill (supplier, amount, due day), marks it paid, keeps a meter reading
//    and a room's things as CSV;
//  - LEARNING: "ten Spanish words" answered in the chat; a typing test run in the chat's own box (the passage typed with real keys,
//    scored on the phone, kept in the brain, "how am I doing" reads it back); the LEARNING sheet: the words in two languages (the
//    Arabic right to left, with how it sounds), the deck and a card reviewed, a star traced with a finger (scored by overlap) and a
//    scribble scored low, mental maths, a memory drill, first aid put in order, reading at speed with three questions, the slips in
//    his own message drilled, a four-week plan ticked off, and his streaks;
//  - every sheet at 390 × 844: nothing sideways, every button, field and picture named for VoiceOver. No page errors.
//   BASE=http://localhost:8788 node tests/packs3.spec.mjs [outDir]
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
const api = (path, body) => fetch(`${base}/api${path}`, { method: body ? 'POST' : 'GET', headers: { 'x-ghosty': '1', 'x-ghosty-key': KEY, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }).then((r) => r.json());
const doPack = (pack, action, args = {}) => api('/packs/do', { pack, action, args });
/** Everything these three packs keep, put back to nothing (a brain an earlier spec used, or this spec's own last run). */
async function clean() {
  for (const [pack, action, args] of [
    ['outside', 'parked', { words: 'forget' }],
    ['homeadmin', 'bins', { words: 'forget my bins' }],
    ['homeadmin', 'meter', { words: 'forget the electricity' }],
    ['homeadmin', 'inventory', { words: 'forget living room' }],
    ['learning', 'done', { stop: 'all' }],
    ['learning', 'deck', { stop: 'all' }],
    ['learning', 'plan', { stop: 'all' }],
    ['learning', 'spelling', { stop: 'all' }],
  ]) await doPack(pack, action, args).catch(() => undefined);
  // (this spec's bill, paid or not, as many times as an earlier run left it)
  for (let i = 0; i < 6; i++) if (!/^Forgot the British Gas bill/.test((await doPack('homeadmin', 'paid', { words: 'forget British Gas' }).catch(() => ({}))).text ?? '')) break;
}

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const until = (page, fn, arg, ms, why) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, async () => (problems.push(typeof why === 'function' ? await why() : why), false));
const sideways = (page, sel) => page.$$eval(sel, (els) => els.filter((e) => {
  if (!e.getClientRects().length) return false;
  const r = e.getBoundingClientRect();
  return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1);
}).slice(0, 5).map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join('.')} "${(e.textContent ?? '').trim().slice(0, 40)}"`));
/** Buttons, fields, selects, pictures and drawings with no name VoiceOver could read. */
const unnamed = (page) => page.$$eval('.modal .pk button, .modal .pk input:not([type=hidden]), .modal .pk textarea, .modal .pk select, .modal .pk canvas, .modal .pk pre, .modal .pk svg[role=img]', (els) => els.filter((e) => e.getClientRects().length || e.type === 'file').filter((e) => !(e.getAttribute('aria-label') || (e.textContent ?? '').trim() || e.closest('label')?.textContent?.trim())).map((e) => e.outerHTML.slice(0, 80)));

async function phone(viewport) {
  const ctx = await browser.newContext({ viewport, screen: viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true, ...UK, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${viewport.width}] pageerror: ${e.message}`));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pair input', { timeout: 15000 });
  await page.fill('#pair input', KEY);
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForSelector('#cin', { timeout: 10000 });
  return { ctx, page };
}
/** The last message the assistant said, as the chat shows it. */
const lastReply = (page) => page.evaluate(() => [...document.querySelectorAll('#pg-core .msg:not(.me)')].map((m) => m.textContent ?? '').pop() ?? '');
/**
 * Wait for a reply that matches `re` AFTER the last thing HE said, which must be `words` (so neither an earlier run's message nor a
 * reply another spec left can satisfy it, and the chat keeping only its latest messages on screen does not matter); that reply
 * ('' and a problem noted when none).
 */
async function replyTo(page, words, re, ms, W, what) {
  const ok = await until(page, ([src, said]) => {
    const all = [...document.querySelectorAll('#pg-core .msg')];
    const me = all.map((m) => m.classList.contains('me')).lastIndexOf(true);
    if (me < 0 || !(all[me].textContent ?? '').includes(said)) return false;
    return all.slice(me + 1).filter((m) => !m.classList.contains('me')).some((m) => new RegExp(src).test(m.textContent ?? ''));
  }, [re.source, words.trim()], ms, async () => `[${W}] ${what}: after "${words.slice(0, 50)}" the last reply was "${(await lastReply(page)).slice(0, 160)}"`);
  return ok ? page.evaluate(([src, said]) => {
    const all = [...document.querySelectorAll('#pg-core .msg')];
    const me = all.map((m) => m.classList.contains('me')).lastIndexOf(true);
    return all.slice(me + 1).filter((m) => !m.classList.contains('me')).map((m) => m.textContent ?? '').find((t) => new RegExp(src).test(t)) ?? '';
  }, [re.source, words.trim()]) : '';
}
/** Say `words` in the chat and wait for the reply that matches `re`. */
async function ask(page, words, re, W, what) {
  await page.fill('#cin', words);
  await page.press('#cin', 'Enter');
  return replyTo(page, words, re, 30000, W, what);
}
const card = (page, prefix) => page.evaluate((p) => [...document.querySelectorAll('#pg-core article.ccard:not(.wall)')].filter((c) => c.dataset.id?.startsWith(p)).map((c) => ({ id: c.dataset.id, title: c.querySelector('.cctitle')?.textContent ?? '', line: c.querySelector('.ccline')?.textContent ?? '', acts: [...c.querySelectorAll('.ccbtn')].map((b) => b.textContent) })).pop() ?? null, prefix);
const openChat = async (page) => {
  if (!(await page.evaluate(() => !!document.querySelector('.hud.core.logopen')))) await page.locator('.logbtn:visible').first().click().catch(() => undefined);
  await page.waitForFunction(() => !!document.querySelector('.hud.core.logopen'), null, { timeout: 8000 }).catch(() => problems.push('the chat did not open'));
  await page.waitForTimeout(300);
};
const closeSheet = (page) => page.evaluate(() => document.querySelector('.modal .mhead button')?.click());
const open = async (page, cmd, args, screen, W, why) => {
  await page.evaluate(([c, a]) => window.__ghosty.run(c, a), [cmd, args]);
  const el = await page.waitForSelector(`.modal [data-screen="${screen}"]`, { timeout: 12000 }).catch(() => null);
  if (!el) problems.push(`[${W}] ${why}`);
  return !!el;
};
const state = (page, key) => page.evaluate((k) => JSON.parse(JSON.stringify(window.__ghosty?.[k] ?? null)), key);
const note = (page) => page.evaluate(() => document.querySelector('.modal .pk .pknote')?.textContent ?? '');
/** A date in the bill's own words, `days` from now: "14 November 2026". */
const dayWords = (days) => new Date(Date.now() + days * 86_400_000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

await clean();

// ---------------------------------------------------------------- 440 × 956
{
  const W = 440;
  const { ctx, page } = await phone(PHONE);

  // ------------------------------------------------------------ OUTSIDE
  log('outside');
  const kept = await ask(page, 'I parked on Cannon Street until 3pm', /Kept: the car is at Cannon Street/, W, 'the parked car was not kept');
  if (kept && !/Paid until 15:00/.test(kept)) problems.push(`[${W}] the parking ticket time was not kept: ${kept}`);
  await ask(page, 'where did I park?', /The car: Cannon Street/, W, '"where did I park?" did not answer from the notes');
  await ask(page, 'split the taxi: £48, I paid, between me, Sam and Jo', /£48 between 3: £16 each\. Sam owes you £16; Jo owes you £16\./, W, 'the taxi was not split to the penny');
  await openChat(page);
  // the sheet: the car with a rule, a fare split
  if (await open(page, 'open_outside', { what: 'car' }, 'car', W, 'the OUTSIDE sheet did not open on the car')) {
    await page.fill('.modal .pk input[aria-label="Where you parked"]', 'Corporation Street car park');
    await page.fill('.modal .pk input[aria-label="A rule or note about this parking"]', 'free after 6');
    await page.click('.modal .pk button[aria-label="Keep where I parked"]');
    await until(page, () => /Corporation Street car park/.test(window.__ghosty?.outside?.car ?? ''), null, 10000, async () => `[${W}] the car was not kept from the sheet: ${JSON.stringify(await state(page, 'outside'))}`);
    await page.click('.modal button[data-view="split"]');
    await page.waitForSelector('.modal [data-screen="split"]', { timeout: 8000 }).catch(() => problems.push(`[${W}] no split page`));
    await page.fill('.modal .pk textarea[aria-label="The fare and who shares it"]', 'I paid £30, Sam paid £12, split 3 ways');
    await page.click('.modal .pk button[aria-label="Work out who owes whom"]');
    await until(page, () => /owes/.test(document.querySelector('.modal .pk .pknote')?.textContent ?? ''), null, 8000, `[${W}] the sheet did not split the fare`);
    await closeSheet(page);
  }
  await doPack('outside', 'parked', { words: 'forget' });

  // ------------------------------------------------------------ HOME
  log('home');
  const bins = await ask(page, 'bins are Tuesday, recycling every other Tuesday, next recycling is 10 November', /Kept: Rubbish: every Tuesday; Recycling: every other Tuesday/, W, 'the bin days were not kept');
  if (bins && !/Recycling: every other Tuesday \(next from Tue 10 Nov\)/.test(bins)) problems.push(`[${W}] the recycling anchor: ${bins}`);
  await ask(page, 'when are the bins?', /Rubbish: \w{3} \d+ \w{3}, then \w{3} \d+ \w{3}[^]*Recycling: \w{3} \d+ \w{3}, then/, W, '"when are the bins?" did not answer from the kept days');
  // the sheet: a bill pasted → kept → paid; a meter; a room's things as CSV
  if (await open(page, 'open_homeadmin', { what: 'bills' }, 'bills', W, 'the HOME sheet did not open on the bills')) {
    const bill = `British Gas\nYour energy bill\nStatement date: ${dayWords(-3)}\nBilling period 1 Oct 2026 to 31 Oct 2026\nTotal amount due £84.20\nPlease pay by ${dayWords(10)}`;
    await page.fill('.modal .pk textarea[aria-label="The text of a bill, pasted"]', bill);
    await page.click('.modal .pk button[aria-label="Read the bill text I pasted"]');
    await until(page, () => (window.__ghosty?.homeadmin?.bills ?? []).some((b) => b.supplier === 'British Gas' && b.amount === 84.2), null, 12000, async () => `[${W}] the bill was not read: ${JSON.stringify(await state(page, 'homeadmin'))}`);
    const row = await page.evaluate(() => [...document.querySelectorAll('.modal .pkperson b')].map((b) => b.textContent).find((t) => /British Gas/.test(t ?? '')) ?? '');
    if (row !== 'British Gas £84.20') problems.push(`[${W}] the bill's row: ${row}`);
    await page.screenshot({ path: `${out}/packs3-home-bill-${W}.png` });
    await page.click('.modal .pk button[aria-label="Mark British Gas paid"]');
    // a paid bill leaves the list of what is still to pay
    await until(page, () => !(window.__ghosty?.homeadmin?.bills ?? []).some((b) => b.supplier === 'British Gas') && /marked paid/.test(window.__ghosty.homeadmin.said), null, 8000, async () => `[${W}] "Paid" did not reach the brain: ${JSON.stringify(await state(page, 'homeadmin'))}`);
    await closeSheet(page);
  }
  if (await open(page, 'open_homeadmin', { what: 'meter' }, 'meter', W, 'no meter page')) {
    await page.fill('.modal .pk input[aria-label="The meter reading"]', '12345');
    await page.click('.modal .pk button[aria-label="Keep the reading I typed"]');
    await until(page, () => /Electricity: 12,345/.test(document.querySelector('.modal .pk .pknote')?.textContent ?? ''), null, 8000, async () => `[${W}] the meter reading was not kept: ${await note(page)}`);
    await closeSheet(page);
  }
  if (await open(page, 'open_homeadmin', { what: 'things' }, 'things', W, 'no rooms page')) {
    await page.fill('.modal .pk input[aria-label="Which room"]', 'living room');
    await page.fill('.modal .pk textarea[aria-label="The things in that room"]', 'a 55 inch TV worth £400, 2 armchairs');
    await page.click('.modal .pk button[aria-label="Keep the things I typed"]');
    await until(page, () => /living room/i.test(document.querySelector('.modal .pk .pknote')?.textContent ?? ''), null, 8000, `[${W}] the room's things were not kept`);
    await page.click('.modal .pk button[aria-label="Make the inventory CSV for my insurer"]');
    await until(page, () => /TV/.test(document.querySelector('.modal .pk pre')?.textContent ?? ''), null, 8000, async () => `[${W}] no CSV: ${JSON.stringify(await state(page, 'homeadmin'))}`);
    await closeSheet(page);
  }
  await clean();

  // ------------------------------------------------------------ LEARNING
  log('learning: the chat');
  // (Polish, because the coach's phrases also take the four languages it teaches: this chat line reaches this pack whichever of the two answers first)
  const ten = await ask(page, 'ten Polish words', /Polish, today’s ten \(/, W, '"ten Polish words" was not answered in the chat');
  if (ten && ten.split('\n').filter((l) => /^\d+\. .+ — .+/.test(l)).length !== 10) problems.push(`[${W}] the ten words: ${ten.slice(0, 200)}`);
  if (await page.$('.modal')) problems.push(`[${W}] "ten Polish words" opened a sheet over the answer`);
  await ask(page, 'a 4 week plan for the guitar', /A four-week plan for guitar, 10 minutes a day/, W, 'no four-week plan for the guitar');
  await openChat(page);
  const pc = await card(page, 'learning:plan:');
  if (!pc || pc.title !== 'Guitar plan' || !/10 minutes a day for four weeks/.test(pc.line)) problems.push(`[${W}] the plan's card: ${JSON.stringify(pc)}`);
  // a typing test in the chat's own box: the passage typed with real keys, scored on the phone
  log('learning: the typing test');
  const given = await ask(page, 'a words per minute test', /Typing test: type this as fast as you can/, W, '"a words per minute test" gave no passage');
  const passage = /“([^”]+)”/.exec(given)?.[1] ?? '';
  if (passage.split(' ').length < 8) problems.push(`[${W}] the typing passage: ${given.slice(0, 200)}`);
  else {
    await page.click('#cin');
    await page.type('#cin', passage, { delay: 55 });
    await page.press('#cin', 'Enter');
    const scored = await replyTo(page, passage, /words a minute at \d+% accuracy/, 30000, W, 'the typed passage was not scored');
    const m = /(\d+) words a minute at (\d+)% accuracy/.exec(scored);
    if (m && (Number(m[2]) < 95 || Number(m[1]) < 15 || Number(m[1]) > 250)) problems.push(`[${W}] the typing score: ${scored.slice(0, 200)}`);
    if (scored && !/Logged Typing \d+ wpm/.test(scored)) problems.push(`[${W}] the typing result was not kept: ${scored.slice(0, 240)}`);
    if (/I did not see your first key/.test(scored)) problems.push(`[${W}] the first key was not seen in the chat's box`);
  }
  const doing = await ask(page, 'how am I doing?', /Any practice: 1 day in a row/, W, '"how am I doing?" did not read the streaks');
  if (doing && !/Typing: 1 day in a row/.test(doing)) problems.push(`[${W}] the streaks: ${doing.slice(0, 200)}`);
  // a message with slips for the spelling drill below: what he said before this is looked through first and let go, so only this one counts
  await doPack('learning', 'spelling', {});
  await doPack('learning', 'spelling', { stop: 'all' });
  await ask(page, 'I definately recieve it untill friday', /./, W, 'no reply to the message with slips');
  for (let i = 0; i < 30 && !(await api('/history')).turns.some((t) => /definately recieve/.test(t.text)); i++) await page.waitForTimeout(300);

  log('learning: words and cards');
  if (await open(page, 'open_learning', { what: 'words', lang: 'fr' }, 'words', W, 'the LEARNING sheet did not open on the words')) {
    const rows = await page.$$eval('.modal .pk .pkperson[role=listitem]', (els) => els.length);
    if (rows !== 10) problems.push(`[${W}] the words page shows ${rows} words, not ten`);
    await page.selectOption('.modal .pk select[aria-label="Language"]', 'ar');
    const ar = await page.evaluate(() => ({ rtl: document.querySelector('.modal .pkperson b')?.getAttribute('dir'), lang: document.querySelector('.modal .pkperson b')?.getAttribute('lang'), sound: document.querySelector('.modal .pkperson .pklab')?.textContent ?? '' }));
    if (ar.rtl !== 'rtl' || ar.lang !== 'ar-SA' || !/ · [a-zʿāīūḥṣṭḍẓ’' -]+$/i.test(ar.sound)) problems.push(`[${W}] the Arabic row: ${JSON.stringify(ar)}`);
    await page.selectOption('.modal .pk select[aria-label="Language"]', 'fr');
    await page.selectOption('.modal .pk select[aria-label^="Today"]', 'cafe');
    const ph = await page.$$eval('.modal .pk .pkperson[role=listitem]', (els) => els.length);
    if (ph !== 3) problems.push(`[${W}] the café phrases: ${ph}`);
    await page.selectOption('.modal .pk select[aria-label^="Today"]', 'today');
    await page.click('.modal .pk button[aria-label^="Say "]');
    await page.waitForTimeout(150);
    const voices = await state(page, 'learning');
    if (!voices || typeof voices.voices?.none !== 'boolean') problems.push(`[${W}] the words page did not report the phone's voices`);
    await page.click('.modal .pk button[aria-label="Keep these in my flashcard deck"]');
    await until(page, () => /Kept 10 French words/.test(document.querySelector('.modal .pk .pknote')?.textContent ?? ''), null, 8000, async () => `[${W}] the French words were not kept in the deck: ${await note(page)}`);
    await closeSheet(page);
  }
  if (await open(page, 'open_learning', { what: 'review' }, 'review', W, 'no cards page')) {
    await page.waitForSelector('.modal .pk button[aria-label="Show the answer"]', { timeout: 8000 }).catch(() => problems.push(`[${W}] no card to review`));
    const first = await note(page);
    if (!/^10 cards due\. French: say it, then check\./.test(first)) problems.push(`[${W}] the cards page: ${first}`);
    await page.click('.modal .pk button[aria-label="Show the answer"]');
    await page.waitForSelector('.modal .pk button[aria-label^="good:"]', { timeout: 5000 });
    await page.click('.modal .pk button[aria-label^="good:"]');
    await until(page, () => /^9 cards due\./.test(document.querySelector('.modal .pk .pknote')?.textContent ?? ''), null, 8000, async () => `[${W}] grading a card did not bring the next: ${await note(page)}`);
    await closeSheet(page);
  }

  log('learning: drawing');
  if (await open(page, 'open_learning', { what: 'draw', shape: 'star' }, 'draw', W, 'no drawing page')) {
    const trace = async (strokes) => {
      const el = await page.$('.modal .pkguide');
      await el.scrollIntoViewIfNeeded();
      // (the first mouse move over the page makes Chromium swap its scrollbars, which re-wraps the text above the drawing and moves it a
      // little, and slowly on a busy machine: hover first, wait until it has stayed still, and measure it again for every point; a finger
      // has no hover)
      const b0 = await el.boundingBox();
      await page.mouse.move(b0.x + b0.width / 2, b0.y + b0.height / 2);
      let still = 0;
      let last = '';
      for (let i = 0; i < 40 && still < 4; i++) {
        const now = JSON.stringify(await el.boundingBox());
        still = now === last ? still + 1 : 0;
        last = now;
        await page.waitForTimeout(150);
      }
      const at = async ([x, y]) => {
        const b = await el.boundingBox();
        return [b.x + (x * b.width) / 100, b.y + (y * b.height) / 100];
      };
      for (const s of strokes) {
        await page.mouse.move(...(await at(s[0])));
        await page.mouse.down();
        for (const pt of s.slice(1)) await page.mouse.move(...(await at(pt)));
        await page.mouse.up();
      }
    };
    const guide = await page.$$eval('.modal .pkguide .g polyline', (els) => els.map((e) => e.getAttribute('points').split(' ').map((p) => p.split(',').map(Number))));
    if ((await state(page, 'learning')).guide !== 'star' || guide.length !== 1) problems.push(`[${W}] the star's guide: ${JSON.stringify((await state(page, 'learning')).guide)} ${guide.length}`);
    await trace(guide);
    await until(page, () => window.__ghosty.learning.strokes === 1, null, 5000, `[${W}] the traced star was not drawn`);
    await page.click('.modal .pk button[aria-label="Score my drawing"]');
    await until(page, () => window.__ghosty.learning.score >= 85, null, 8000, async () => `[${W}] a star traced over its guide scored ${(await state(page, 'learning')).score}: ${(await state(page, 'learning')).result}`);
    await until(page, () => /^Logged Drawing \d+ % overlap/.test(window.__ghosty.learning.logged), null, 8000, async () => `[${W}] the drawing was not logged: ${(await state(page, 'learning')).logged}`);
    await page.screenshot({ path: `${out}/packs3-learning-draw-${W}.png` });
    await page.click('.modal .pk button[aria-label="Clear my drawing"]');
    await trace([[[4, 4], [16, 9], [8, 18], [20, 14]]]);
    await page.click('.modal .pk button[aria-label="Score my drawing"]');
    await until(page, () => window.__ghosty.learning.score >= 0 && window.__ghosty.learning.score < 40, null, 8000, async () => `[${W}] a scribble in the corner scored ${(await state(page, 'learning')).score}`);
    if (!/not the shape yet|fair start/.test((await state(page, 'learning')).result)) problems.push(`[${W}] the scribble's words: ${(await state(page, 'learning')).result}`);
    await closeSheet(page);
  }

  log('learning: maths and memory');
  if (await open(page, 'open_learning', { what: 'maths' }, 'maths', W, 'no maths page')) {
    await page.click('.modal .pk button[aria-label="Start the five-minute drill"]');
    await page.waitForSelector('.modal .pk input[aria-label="Your answer"]:not([hidden])', { timeout: 8000 });
    for (let i = 0; i < 6; i++) {
      const q = await page.evaluate(() => document.querySelector('.modal .pkbig')?.textContent ?? '');
      const sum = q.replace(/ =$/, '').replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/');
      const answer = Function(`return (${sum})`)() + (i === 5 ? 1 : 0);
      await page.fill('.modal .pk input[aria-label="Your answer"]', String(answer));
      await page.press('.modal .pk input[aria-label="Your answer"]', 'Enter');
    }
    await page.click('.modal .pk button[aria-label="Stop and score the drill"]');
    await until(page, () => /^5 of 6 right \(83%\) at level 1\./.test(window.__ghosty.learning.result), null, 8000, async () => `[${W}] the maths result: ${(await state(page, 'learning')).result}`);
    await until(page, () => /^Logged Mental maths 5 of 6 right\./.test(window.__ghosty.learning.logged), null, 8000, async () => `[${W}] the maths log: ${(await state(page, 'learning')).logged}`);
    await closeSheet(page);
  }
  if (await open(page, 'open_learning', { what: 'memory', kind: 'number' }, 'memory', W, 'no memory page')) {
    await page.click('.modal .pk button[aria-label="Start the memory drill"]');
    await page.waitForSelector('.modal .pk .pkpass:not([hidden])', { timeout: 8000 });
    const digits = (await page.evaluate(() => document.querySelector('.modal .pk .pkpass')?.textContent ?? '')).replace(/\D/g, '');
    if (digits.length !== 4) problems.push(`[${W}] the memory drill at level 1 showed ${digits.length} digits`);
    await page.waitForSelector('.modal .pk input[aria-label="Your answer"]:not([hidden])', { timeout: 12000 });
    if (await page.evaluate(() => !document.querySelector('.modal .pk .pkpass')?.hidden)) problems.push(`[${W}] the digits stayed on screen for the answer`);
    await page.fill('.modal .pk input[aria-label="Your answer"]', digits);
    await page.click('.modal .pk button[aria-label="Check my answer"]');
    await until(page, () => /^Right: all 4 digits\./.test(window.__ghosty.learning.result), null, 8000, async () => `[${W}] the memory result: ${(await state(page, 'learning')).result}`);
    await until(page, () => /Next number drill: level 2\./.test(window.__ghosty.learning.logged), null, 8000, async () => `[${W}] the memory level: ${(await state(page, 'learning')).logged}`);
    await closeSheet(page);
  }

  log('learning: first aid and spelling');
  if (await open(page, 'open_learning', { what: 'firstaid', which: 'choking' }, 'firstaid', W, 'no first aid page')) {
    if (!/call 999/i.test(await note(page))) problems.push(`[${W}] the first aid page lacks the call 999 line`);
    const steps = (await doPack('learning', 'firstaid', { which: 'choking' })).data.scenario.steps;
    await page.click('.modal .pk button[aria-label="Test me on the order"]');
    for (const s of steps) await page.click(`.modal .pk button[aria-label="Step: ${s.replace(/"/g, '\\"')}"]`);
    await until(page, () => /^4 of 4 steps in the right place\. That is the order\./.test(window.__ghosty.learning.result), null, 8000, async () => `[${W}] first aid in order: ${(await state(page, 'learning')).result}`);
    await closeSheet(page);
  }
  if (await open(page, 'open_learning', { what: 'spelling' }, 'spelling', W, 'no spelling page')) {
    await page.waitForSelector('.modal .pk input[aria-label="Spell the word"]:not([hidden])', { timeout: 10000 }).catch(async () => problems.push(`[${W}] no word to spell: ${await note(page)}`));
    const shown = await note(page);
    if (!/^In your latest messages: “definately” for definitely, “recieve” for receive, “untill” for until\. Kept for the drill\. 3 words to practise\. Listen, then spell it: 10 letters, starting with d\.$/.test(shown)) problems.push(`[${W}] the spelling page: ${shown}`);
    await page.fill('.modal .pk input[aria-label="Spell the word"]', 'definitely');
    await page.press('.modal .pk input[aria-label="Spell the word"]', 'Enter');
    await until(page, () => /^Right: definitely\./.test(document.querySelector('.modal .pk .pknote')?.textContent ?? ''), null, 8000, async () => `[${W}] the spelling check: ${await note(page)}`);
    await closeSheet(page);
  }

  log('learning: reading, plan and streaks');
  await page.evaluate(() => localStorage.setItem('ghosty.learning.wpm', '900'));
  if (await open(page, 'open_learning', { what: 'readfast' }, 'readfast', W, 'no reading page')) {
    await page.click('.modal .pk button[aria-label="Start reading"]');
    await page.waitForSelector('.modal .pk .pkrow[aria-label="Question 3"]', { timeout: 60000 }).catch(() => problems.push(`[${W}] no three questions after the passage`));
    for (const n of [1, 2, 3]) await page.click(`.modal .pk button[aria-label^="Question ${n}:"]`).catch(() => problems.push(`[${W}] no option for question ${n}`));
    await until(page, () => /^\d of 3 right at 900 words a minute\./.test(window.__ghosty.learning.result), null, 8000, async () => `[${W}] the reading result: ${(await state(page, 'learning')).result}`);
    await closeSheet(page);
  }
  if (await open(page, 'open_learning', { what: 'plan' }, 'plan', W, 'no plan page')) {
    await page.waitForSelector('.modal .pk button[aria-label="I did today’s guitar"]', { timeout: 8000 }).catch(() => problems.push(`[${W}] the guitar plan is not on the plan page`));
    await page.click('.modal .pk button[aria-label="I did today’s guitar"]');
    await until(page, () => /^Logged Guitar\./.test(window.__ghosty.learning.logged), null, 8000, async () => `[${W}] the plan day was not logged: ${(await state(page, 'learning')).logged}`);
    await closeSheet(page);
  }
  if (await open(page, 'open_learning', { what: 'progress' }, 'progress', W, 'no streaks page')) {
    await until(page, () => document.querySelectorAll('.modal .pk .pkperson').length >= 6, null, 8000, async () => `[${W}] the streaks page shows ${await page.evaluate(() => [...document.querySelectorAll('.modal .pk .pkperson b')].map((b) => b.textContent).join(', '))}`);
    const names = await page.$$eval('.modal .pk .pkperson b', (els) => els.map((e) => e.textContent));
    for (const n of ['Typing', 'Drawing', 'Mental maths', 'Memory', 'Guitar']) if (!names.includes(n)) problems.push(`[${W}] ${n} is not in the streaks: ${names.join(', ')}`);
    await closeSheet(page);
  }
  // the day's lines in the Brief: the plan, and nothing nagging
  const today = (await doPack('learning', 'today')).text;
  if (!/^Today:\n- Guitar: Day 1 of 28/.test(today)) problems.push(`[${W}] today's lines: ${today.slice(0, 200)}`);
  await ctx.close();
}

// ---------------------------------------------------------------- 390 × 844: every sheet, nothing sideways, everything named
{
  const W = 390;
  const { ctx, page } = await phone({ width: 390, height: 844 });
  await doPack('learning', 'deck', { lang: 'es' });
  const sheets = [
    ['open_outside', { what: 'safewalk' }, 'safewalk'],
    ['open_outside', { what: 'toilets' }, 'nearby'],
    ['open_outside', { what: 'car' }, 'car'],
    ['open_outside', { what: 'lost' }, 'lost'],
    ['open_outside', { what: 'split' }, 'split'],
    ['open_homeadmin', { what: 'due' }, 'due'],
    ['open_homeadmin', { what: 'bins' }, 'bins'],
    ['open_homeadmin', { what: 'bills' }, 'bills'],
    ['open_homeadmin', { what: 'meter' }, 'meter'],
    ['open_homeadmin', { what: 'things' }, 'things'],
    ...['words', 'review', 'draw', 'typing', 'hand', 'readfast', 'memory', 'maths', 'spelling', 'firstaid', 'plan', 'progress'].map((v) => ['open_learning', { what: v }, v]),
    ['open_learning', { what: 'words', lang: 'zh' }, 'words'],
    ['open_learning', { what: 'firstaid', which: 'cpr' }, 'firstaid'],
  ];
  // (a picture of a few, not of all: the checks are the point)
  const shot = new Set(['open_learning:words']);
  for (const [cmd, args, screen] of sheets) {
    log(`390: ${cmd} ${screen}`);
    if (!(await open(page, cmd, args, screen, W, `${cmd} ${JSON.stringify(args).slice(0, 60)} did not open ${screen}`))) continue;
    await page.waitForTimeout(350);
    const side = await sideways(page, '.modal .pk, .modal .pk *');
    if (side.length) problems.push(`[${W}] ${cmd} ${screen}: sideways: ${side.join('; ')}`);
    const named = await unnamed(page);
    if (named.length) problems.push(`[${W}] ${cmd} ${screen}: unnamed for VoiceOver: ${named.join('; ')}`);
    if (screen === 'draw' && !(await page.$('.modal .pk svg[role=img][aria-label^="Drawing canvas"]'))) problems.push(`[${W}] the drawing canvas has no name`);
    if (screen === 'maths' && !(await page.$('.modal .pk [role="timer"]'))) problems.push(`[${W}] the maths clock is not a timer`);
    if (shot.has(`${cmd}:${screen}`) && !args.lang) await page.screenshot({ path: `${out}/packs3-${cmd.replace('open_', '')}-${screen}-${W}.png` });
    await closeSheet(page);
  }
  // the tabs of the learning sheet are a group of named buttons, the pressed one said
  await open(page, 'open_learning', { what: 'draw' }, 'draw', W, 'no drawing page for the tabs');
  const tabs = await page.$$eval('.modal button[data-view]', (els) => els.map((e) => [e.dataset.view, e.getAttribute('aria-label'), e.getAttribute('aria-pressed')]));
  if (tabs.length !== 12 || tabs.some((t) => !t[1]) || tabs.filter((t) => t[2] === 'true').map((t) => t[0]).join() !== 'draw') problems.push(`[${W}] the learning tabs: ${JSON.stringify(tabs)}`);
  await closeSheet(page);
  await ctx.close();
}

// what this spec kept in the preview's brain goes, so the specs after it start as they would
await clean();

await browser.close();
console.log(`(packs3 spec: ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
if (problems.length) {
  console.log(`PROBLEMS:\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('Packs 3 run clean: a parked car was kept and answered, a taxi split to the penny, in the chat and in the OUTSIDE sheet; bin days were kept and answered with no model, a pasted bill was read and marked paid, a meter and a room’s things (as CSV) kept; ten words answered in the chat, a typing test run in the chat’s own box and kept, the words said in two languages (Arabic right to left, with its sound), a deck and a card reviewed, a star traced and scored by overlap and a scribble scored low, mental maths, a memory drill, first aid put in order, reading at speed with three questions, the slips in his own message drilled, a plan ticked off, and his streaks; every sheet at 390 × 844 with nothing sideways and everything named.');
