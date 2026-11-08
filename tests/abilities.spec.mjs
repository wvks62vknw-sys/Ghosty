// ABILITIES (BRIEF-EVERYTHING; OWNER-ISSUES 92, 68, 67b, 67d, 68c; re-pointed by BRIEF-SHELL pass 1, OWNER-ISSUES 130 and 143) on the
// owner's phone (440 × 956) and a smaller one (390 × 844). The page that listed everything is withdrawn as a way in ("get rid of the
// abilities page for every ability": no bar button, no Me row, no hub card, no deck card, no address); what answers a question stays:
//  - the page is gone: the Me sheet, the deck, the Me hub and #abilities no longer open it;
//  - the catalogue is still made (for the brain and the checks): at least 250 things, every registry item with its words, every way in
//    lands on a screen, a command or words this build has, what the brain serves is what the phone holds, FAVOURITES said in it;
//  - "can you …?" by words, in the chat, answered on this phone with no model: a yes with a way to it (GO), a near miss ("Not quite")
//    with YES and NO, "Not yet. Want me to learn it?" and YES keeps it as a learning goal (the brain, the Workshop first); a yes
//    comes with chips ("can you translate signs?") and one opens where it says (backing up the phone opens System); a request ("…at 5") still goes
//    to the brain; the chat's own controls are where the registry says;
//  - WHY (a reply's trail in a sheet, from WHY or a long press, and "why did you do that?" typed); "what did you do today?" with no
//    model; the first run's three things, once; one offer in context, one a day; the day's one "did you know".
//   BASE=http://localhost:8877 node tests/abilities.spec.mjs [outDir]
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
const api = (path, init = {}) => fetch(`${base}/api${path}`, { ...init, headers: { 'x-ghosty': '1', 'x-ghosty-key': KEY, 'content-type': 'application/json', ...(init.headers ?? {}) } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const until = (page, fn, arg, ms, why) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => (problems.push(why), false));
const sideways = (page, sel) => page.$$eval(sel, (els) => els.filter((e) => {
  if (!e.getClientRects().length) return false;
  const r = e.getBoundingClientRect();
  return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1);
}).slice(0, 5).map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join('.')} "${(e.textContent ?? '').trim().slice(0, 40)}"`));
const small = (page, sel) => page.$$eval(sel, (els) => els.filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map((e) => {
  const r = e.getBoundingClientRect();
  return r.width < 43.5 || r.height < 43.5 ? `${e.className} "${(e.textContent ?? '').trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)}` : null;
}).filter(Boolean).slice(0, 5));
const state = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__ghosty?.abilities ?? null)));

async function phone(viewport, init) {
  const ctx = await browser.newContext({ viewport, screen: viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ...UK, serviceWorkers: 'block' });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${viewport.width}] pageerror: ${e.message}`));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pair input', { timeout: 15000 });
  await page.fill('#pair input', KEY);
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
  return { ctx, page };
}

/** Home with the chat's box open (the box is on Home; on a phone it sits behind LOG). */
async function chatOpen(page) {
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(600);
  if (!(await page.evaluate(() => document.querySelector('#pg-core .hud.core')?.classList.contains('logopen')))) await page.click('.logbtn').catch(() => undefined);
  await page.waitForTimeout(300);
}
/** Ask "can you …?" as he would, and wait for the answer made on the phone, with no model; its words and its buttons. */
async function canYou(page, words, asked) {
  await chatOpen(page);
  const had = await page.evaluate(() => document.querySelectorAll('#pg-core .msg:not(.me)').length);
  await page.fill('#cin', words);
  await page.press('#cin', 'Enter');
  await until(page, (n) => document.querySelectorAll('#pg-core .msg:not(.me)').length > n && /^(Yes\.|Not quite\.|Not yet\.)/.test([...document.querySelectorAll('#pg-core .msg:not(.me)')].at(-1)?.querySelector(':scope > span')?.textContent ?? ''), had, 10000, `"${words}" was not answered on the phone`);
  await page.waitForTimeout(300);
  if (asked.some((b) => b.includes(words.slice(0, 20)))) problems.push(`"${words}" went to the model`);
  return page.evaluate(() => {
    const m = [...document.querySelectorAll('#pg-core .msg:not(.me)')].at(-1);
    return { text: m?.querySelector(':scope > span')?.textContent ?? '', go: [...(m?.querySelectorAll('.localacts button.localgo') ?? [])].map((b) => b.textContent), yes: !!m?.querySelector('.learnyes'), no: !!m?.querySelector('.learnno') };
  });
}

for (const viewport of [PHONE, { width: 390, height: 844 }]) {
  const W = viewport.width;
  const { ctx, page } = await phone(viewport);
  const asked = [];
  page.on('request', (r) => r.url().includes('/api/chat') && r.method() === 'POST' && asked.push(r.postData() ?? ''));
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(500);

  // ---- the page is withdrawn as a way in (OWNER-ISSUES 130, 143): the Me sheet, the deck, the Me hub and the address no longer open it
  await page.click('#top .you');
  await page.waitForSelector('#mesheet .merow', { timeout: 5000 });
  const meRows = await page.$$eval('#mesheet .merow', (r) => r.map((x) => x.dataset.id));
  if (meRows.includes('abilities')) problems.push(`[${W}] the Me sheet still has an Abilities row: ${meRows.join(', ')}`);
  for (const id of ['memory', 'settings', 'system', 'links', 'social', 'area-me', 'deck']) if (!meRows.includes(id)) problems.push(`[${W}] the Me sheet lost its ${id} row: ${meRows.join(', ')}`);
  await page.click('#mesheet .merow[data-id="deck"]');
  await until(page, () => !!document.querySelector('#deck.on'), null, 5000, `[${W}] the deck did not open`);
  if (await page.locator('#deck .dkcard[data-id="abilities"]').count()) problems.push(`[${W}] the deck still has an Abilities card`);
  await page.keyboard.press('Escape');
  await page.evaluate(() => (location.hash = 'area-me'));
  await until(page, () => document.body.dataset.tab === 'area-me', null, 5000, `[${W}] the Me hub did not open`);
  if (await page.locator('#pg-area-me .hubtile[data-id="abilities"]').count()) problems.push(`[${W}] the Me hub still has an Abilities card`);
  await page.evaluate(() => (location.hash = 'abilities'));
  await page.waitForTimeout(500);
  if (await page.evaluate(() => document.body.dataset.tab === 'abilities' || !!document.getElementById('pg-abilities'))) problems.push(`[${W}] #abilities still opens a page`);

  // ---- the catalogue is still made (for the brain and the checks), with no page to show it: the count is the registries' own (at
  // least 250, every item with its words), every way in lands somewhere this build has, and what the brain serves is what the phone holds
  await page.evaluate(() => (location.hash = 'core'));
  await page.evaluate(() => window.__ghosty.abilities.load());
  await until(page, () => window.__ghosty?.abilities?.health, null, 10000, `[${W}] no catalogue health on this build`);
  const brainWait = await until(page, async () => (await window.__ghosty.abilities.health()).brain > 100, null, 15000, `[${W}] the brain's items never arrived`);
  const s = await page.evaluate(() => window.__ghosty.abilities.health());
  if (s.count < 250) problems.push(`[${W}] only ${s.count} things in the catalogue`);
  if (s.missing.length) problems.push(`[${W}] registry items with no words: ${s.missing.slice(0, 6).join(', ')}`);
  if (s.items < s.count) problems.push(`[${W}] ${s.items} registry items for ${s.count} entries`);
  if (s.broken.length) problems.push(`[${W}] a way in goes nowhere: ${s.broken.slice(0, 4).join(' | ')}`);
  const info = await api('/abilities');
  if (!info?.catalogue || info.catalogue.length !== s.brain) problems.push(`[${W}] the brain serves ${info?.catalogue?.length} items, the phone holds ${s.brain}`);
  if (brainWait && !s.controls.some((c) => c.id === 'favourites')) problems.push(`[${W}] the catalogue does not say FAVOURITES`);

  // ---- "can you …?" by words, in the chat, answered on the phone with no model (what the page's search proved, proved where it lives now)
  let a = await canYou(page, "can you check my car's MOT", asked);
  if (!/^Yes\./.test(a.text) || !a.go.length) problems.push(`[${W}] "can you check my car's MOT" → ${JSON.stringify(a)} (want a yes and a way to it)`);
  a = await canYou(page, 'can you fly a plane?', asked);
  if (!/^Not quite\. The nearest I’ve got:/.test(a.text) || !a.yes || !a.no) problems.push(`[${W}] "can you fly a plane?" → ${JSON.stringify(a)} (want a near miss with YES and NO)`);
  await page.locator('#pg-core .msg:not(.me)').last().locator('button.learnno').click().catch(() => problems.push(`[${W}] no NO under a near miss`));
  await page.waitForTimeout(200);
  if (await page.locator('#pg-core .msg:not(.me)').last().locator('button.learnyes').count()) problems.push(`[${W}] NO did not just close the offer`);
  if (W === PHONE.width) {
    // a yes comes with its way in: "can you translate signs?" says yes and offers the chips (the brain's scan, the app's own screens)
    a = await canYou(page, 'can you translate signs?', asked);
    if (!/^Yes\. /.test(a.text) || a.go.length < 2) problems.push(`"can you translate signs?" → ${JSON.stringify(a)} (want a yes and two ways to it)`);
    // a made-up one is "Not yet", and YES puts it on my learning list (the brain keeps it; the Workshop lists it first)
    const nonce = () => Array.from({ length: 4 }, () => 'bcdfghjklmnpqrstvwxz'[Math.floor(Math.random() * 20)]).join('');
    const want = `${nonce()} ${nonce()}`;
    a = await canYou(page, `are you able to ${want}`, asked);
    if (!/^Not yet\. Want me to learn it\?/.test(a.text) || !a.yes) problems.push(`"are you able to ${want}" → ${JSON.stringify(a)} (want "Not yet. Want me to learn it?")`);
    await page.screenshot({ path: `${out}/abilities-notyet.png` });
    await page.locator('#pg-core .msg:not(.me)').last().locator('button.learnyes').click().catch(() => problems.push('no YES under "Not yet"'));
    await until(page, () => [...document.querySelectorAll('#pg-core .msg:not(.me) .learned')].some((n) => /On my learning list/.test(n.textContent ?? '')), null, 8000, 'YES did not record the learning goal');
    const goals = (await api('/abilities'))?.goals ?? [];
    if (!goals.some((g) => g.ask.includes(want))) problems.push(`the brain did not keep the goal: ${JSON.stringify(goals.slice(0, 3))}`);
    await page.evaluate(() => (location.hash = 'workshop'));
    await until(page, (w) => { const first = document.querySelector('#pg-workshop .idea'); return !!first && first.classList.contains('mine') && first.textContent.includes(w); }, want, 10000, 'the Workshop does not list his goal first, marked as his');
    // the chat's own controls are where the registry says (the reply ones once a reply is there; ASK MY PHONE shows only while every
    // model is cooling down with the phone's brain awake, and tests/talk.spec.mjs finds and taps it there)
    await chatOpen(page);
    const missingControls = await page.evaluate(() => window.__ghosty.abilities.health().then((h) => h.controls.filter((c) => c.sel && !['undo', 'harder', 'bigbrain', 'askcloud', 'askphone'].includes(c.id) && !document.querySelector(c.sel)).map((c) => c.id)));
    if (missingControls.length) problems.push(`the chat's controls not found where the registry says: ${missingControls.join(', ')}`);
    // a yes goes where it says: "are you able to back up this phone" offers System, and its chip opens it (what TRY IT on that entry did)
    a = await canYou(page, 'are you able to back up this phone', asked);
    if (!/^Yes\./.test(a.text) || !a.go.length) problems.push(`"are you able to back up this phone" → ${JSON.stringify(a)}`);
    await page.locator('#pg-core .msg:not(.me)').last().locator('button.localgo').first().click().catch(() => problems.push('no GO under the backup answer'));
    await until(page, () => document.body.dataset.tab === 'system', null, 8000, 'GO on the backup answer did not open System');

    // ---- the first card of the first run, the chat, the offers: unchanged below
    // ---- the chat answers the same kind of question with no model (kept)
    await page.evaluate(() => (location.hash = 'core'));
    await page.waitForTimeout(600);
    if (!(await page.evaluate(() => document.querySelector('#pg-core .hud.core')?.classList.contains('logopen')))) await page.click('.logbtn').catch(() => undefined);
    await page.waitForTimeout(300);
    await page.fill('#cin', 'can you beat me at chess?');
    await page.press('#cin', 'Enter');
    await until(page, () => [...document.querySelectorAll('#pg-core .msg:not(.me)')].some((m) => /Yes\. I teach myself by playing \d+ games/.test(m.textContent ?? '') && /Play me at Chess/.test(m.textContent ?? '')), null, 8000, 'the chat did not answer "can you beat me at chess?" from the abilities');
    await page.waitForTimeout(800);
    if (asked.some((b) => /beat me at chess/.test(b))) problems.push('"can you beat me at chess?" went to the model');
    await page.screenshot({ path: `${out}/abilities-chat.png` });
    await page.locator('#pg-core .msg:not(.me)').last().locator('button.localgo').first().click().catch(() => problems.push('no GO under the chat answer'));
    await until(page, () => document.body.dataset.tab === 'gym', null, 8000, 'GO under the chat answer did not open the GYM');
    // a request is not a question about him: it goes to the brain as always
    await page.evaluate(() => (location.hash = 'core'));
    await page.waitForTimeout(600);
    await page.fill('#cin', 'can you remind me to call mum at 5');
    await page.press('#cin', 'Enter');
    await until(page, () => [...document.querySelectorAll('#pg-core .msg:not(.me)')].some((m) => /Mock reply to: can you remind me to call mum at 5/i.test(m.textContent ?? '')), null, 20000, 'a request ("can you remind me…at 5") was not answered by the brain');
    await page.fill('#cin', 'can you juggle?');
    await page.press('#cin', 'Enter');
    await until(page, () => [...document.querySelectorAll('#pg-core .msg:not(.me)')].some((m) => /^.*Not (?:yet|quite)/.test(m.textContent ?? '')), null, 8000, '"can you juggle?" was not answered "Not yet" in the chat');
    if (asked.some((b) => /juggle/.test(b))) problems.push('"can you juggle?" went to the model');

    // ---- WHY did you do that (kept): a reply's trail in a sheet, from its WHY or a long press; "why did you do that?" typed
    const fact = `my ${nonce()} cat is called Tom`;
    await page.fill('#cin', `remember ${fact}`);
    await page.press('#cin', 'Enter');
    await until(page, () => [...document.querySelectorAll('#pg-core .msg:not(.me)')].some((m) => /remember/i.test(m.textContent ?? '') && m.querySelector('.whybtn')), null, 20000, 'the reply to "remember …" has no WHY');
    const whySheet = async (how) => {
      await page.waitForSelector('.modal .whybody', { timeout: 5000 }).catch(() => problems.push(`${how} did not open the WHY sheet`));
      const w = await page.evaluate(() => ({
        title: document.querySelector('.modal .mhead b')?.textContent ?? '',
        ask: document.querySelector('.modal .whyask')?.textContent ?? '',
        steps: [...document.querySelectorAll('.modal .whystep')].map((x) => x.textContent),
        why: [...document.querySelectorAll('.modal .whyreason')].map((x) => x.textContent),
      }));
      if (w.title !== 'Why I did that') problems.push(`${how}: the sheet is called "${w.title}"`);
      if (w.ask !== `You asked: “remember ${fact}”`) problems.push(`${how}: the sheet starts "${w.ask}"`);
      if (w.steps[0] !== `1. Remembered — text: ${fact}: it worked.`) problems.push(`${how}: the step reads "${w.steps[0]}"`);
      if (!/^Why: you asked about “remember”, and I can remember lasting facts you tell me/.test(w.why[0] ?? '')) problems.push(`${how}: the reason reads "${w.why[0]}"`);
      await page.screenshot({ path: `${out}/abilities-why.png` });
      await page.click('.modal .mhead button').catch(() => undefined);
      await page.waitForTimeout(300);
    };
    const reply = page.locator('#pg-core .msg:not(.me)', { has: page.locator('.whybtn') }).last();
    // the reply's own controls are where the registry says, now that a reply is there
    const replyControls = await page.evaluate(async () => { const controls = (await window.__ghosty.abilities.health()).controls; return ['listen', 'copy', 'why', 'rate'].filter((id) => { const c = controls.find((x) => x.id === id); return !c || !document.querySelector(c.sel); }); });
    if (replyControls.length) problems.push(`a reply's controls not found where the registry says: ${replyControls.join(', ')}`);
    await reply.locator('.whybtn').click().catch(() => problems.push('could not tap WHY'));
    await whySheet('WHY');
    const box = await reply.locator(':scope > span').first().boundingBox().catch(() => null);
    if (box) {
      await page.mouse.move(box.x + 10, box.y + 6);
      await page.mouse.down();
      await page.waitForTimeout(800);
      await page.mouse.up();
      await whySheet('a long press');
    } else problems.push('no words on the reply to press');
    const before = asked.length;
    await page.fill('#cin', 'why did you do that?');
    await page.press('#cin', 'Enter');
    await until(page, (f) => [...document.querySelectorAll('#pg-core .msg:not(.me)')].some((m) => (m.textContent ?? '').includes(`Why I did that:\nYou asked: “remember ${f}”\n1. Remembered`)), fact, 8000, '"why did you do that?" was not answered with the trail in the chat');
    await page.waitForTimeout(600);
    if (asked.length !== before) problems.push('"why did you do that?" went to the model');

    // ---- what did you do today (kept): the brain's day and this phone's, newest first, no model
    const before2 = asked.length;
    await page.fill('#cin', 'what did you do today?');
    await page.press('#cin', 'Enter');
    await until(page, (f) => [...document.querySelectorAll('#pg-core .msg:not(.me)')].some((m) => /Today, newest first \(\d+ things?\):\n• \d\d:\d\d — /.test(m.textContent ?? '') && (m.textContent ?? '').includes(`Remembered (text: ${f})`)), fact, 10000, '"what did you do today?" did not list the day with the fact just remembered');
    await page.waitForTimeout(600);
    if (asked.length !== before2) problems.push('"what did you do today?" went to the model');
    await page.screenshot({ path: `${out}/abilities-today.png` });
  }
  await ctx.close();
}

// ---- the first run (kept): a fresh phone hears three things it can do, once, then never again
{
  const { ctx, page } = await phone(PHONE, () => { window.__ghostyFirstRun = true; });
  const first = () => page.evaluate(() => [...document.querySelectorAll('#pg-core .msg:not(.me)')].filter((m) => (m.textContent ?? '').includes('Three things I can do for you, to start:')).length);
  await until(page, () => [...document.querySelectorAll('#pg-core .msg:not(.me)')].some((m) => (m.textContent ?? '').includes('Three things I can do for you, to start:')), null, 10000, 'a fresh phone was not told three things it can do');
  await until(page, () => (document.querySelector('#ccap')?.textContent ?? '').includes('Three things I can do for you'), null, 8000, "[first run] Home's line does not say it within 8 s");
  const said = await page.evaluate(() => {
    const m = [...document.querySelectorAll('#pg-core .msg:not(.me)')].find((x) => (x.textContent ?? '').includes('Three things I can do for you'));
    return { lines: (m?.querySelector(':scope > span')?.textContent ?? '').split('\n').filter((l) => l.startsWith('• ')).length, chips: [...(m?.querySelectorAll('.localacts button') ?? [])].map((b) => b.textContent), caption: document.querySelector('#ccap')?.textContent ?? '' };
  });
  if (said.lines !== 3) problems.push(`[first run] ${said.lines} things said (want three)`);
  if (said.chips.join('|') !== 'God’s eye|Brief|Gym') problems.push(`[first run] its buttons are ${said.chips.join(', ')}`);
  if (!said.caption.includes('Three things I can do for you')) problems.push(`[first run] Home's line does not say it: "${said.caption.slice(0, 60)}"`);
  await page.screenshot({ path: `${out}/abilities-firstrun.png` });
  if ((await first()) !== 1) problems.push(`[first run] said ${await first()} times`);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 }).catch(() => undefined);
  await page.waitForTimeout(2500);
  if ((await first()) !== 0) problems.push('[first run] said again after the phone was opened again');
  if (!(await page.evaluate(() => !!localStorage.getItem('ghosty.firstrun')))) problems.push('[first run] the phone does not remember it said it');
  await ctx.close();
}

// ---- abilities revealed in context (kept): one line after a turn that plainly calls for one, once; the day's one
// "did you know"; the brain's memory of them is stubbed here (abilities:offered), so a run never depends on the one before
async function offersPhone(kind) {
  const ctx = await browser.newContext({ viewport: PHONE, screen: PHONE, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ...UK, serviceWorkers: 'block' });
  await ctx.addInitScript((k) => { window.__ghostyOffers = k; }, kind);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[offers] pageerror: ${e.message}`));
  const told = [];
  await page.route('**/api/abilities', async (route) => {
    const r = await route.fetch();
    const j = await r.json();
    await route.fulfill({ json: { ...j, offered: told.map((id) => ({ id, at: Date.now() })), used: [] } });
  });
  await page.route('**/api/abilities/offered', async (route) => {
    told.push(JSON.parse(route.request().postData() ?? '{}').id);
    await route.fulfill({ json: { offered: told.map((id) => ({ id, at: Date.now() })) } });
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pair input', { timeout: 15000 });
  await page.fill('#pair input', KEY);
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(600);
  if (!(await page.evaluate(() => document.querySelector('#pg-core .hud.core')?.classList.contains('logopen')))) await page.click('.logbtn').catch(() => undefined);
  return { ctx, page, told };
}
{
  const { ctx, page, told } = await offersPhone('context');
  const offers = () => page.evaluate(() => [...document.querySelectorAll('#pg-core .msg:not(.me)')].filter((m) => (m.textContent ?? '').includes('I can keep an eye on that for you')).length);
  await page.fill('#cin', 'I’m worried about my driving test');
  await page.press('#cin', 'Enter');
  await until(page, () => [...document.querySelectorAll('#pg-core .msg:not(.me)')].some((m) => (m.textContent ?? '').includes('I can keep an eye on that for you')), null, 20000, '[offers] a worry typed was not met with the one line offering to keep an eye on it');
  if (!told.includes('ctx:worry')) problems.push(`[offers] the brain was not told it was offered: ${told.join(', ')}`);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/abilities-offer.png` });
  await page.locator('#pg-core .msg:not(.me)', { hasText: 'I can keep an eye on that for you' }).locator('.localacts button').first().click().catch(() => problems.push('[offers] no tap under the offer'));
  await until(page, () => document.querySelector('#cin')?.value === 'Remind me ', null, 5000, '[offers] the tap did not start a reminder in the chat box');
  await page.fill('#cin', 'I’m so stressed about it, I keep forgetting things');
  await page.press('#cin', 'Enter');
  await until(page, () => [...document.querySelectorAll('#pg-core .msg:not(.me)')].some((m) => /Mock reply to: I’m so stressed/i.test(m.textContent ?? '')), null, 20000, '[offers] the second message was not answered');
  await page.waitForTimeout(1200);
  if ((await offers()) !== 1) problems.push(`[offers] offered ${await offers()} times (once, and one a day)`);
  if (await page.evaluate(() => [...document.querySelectorAll('#pg-core .msg:not(.me)')].some((m) => /^Ghosty.*Did you know/.test(m.textContent ?? '')))) problems.push('[offers] a "did you know" came on the same day as an offer');
  await ctx.close();
}
{
  const { ctx, page } = await offersPhone(true);
  await until(page, () => [...document.querySelectorAll('#pg-core .msg:not(.me)')].some((m) => /Did you know/.test(m.textContent ?? '')), null, 30000, '[offers] no "did you know" a while after the app opened');
  await page.waitForTimeout(1500);
  const dyk = await page.evaluate(() => [...document.querySelectorAll('#pg-core .msg:not(.me)')].filter((m) => /Did you know/.test(m.textContent ?? '')).map((m) => ({ text: m.querySelector(':scope > span')?.textContent ?? '', taps: m.querySelectorAll('.localacts button').length })));
  if (dyk.length !== 1 || !dyk[0].taps) problems.push(`[offers] the day's line: ${JSON.stringify(dyk)}`);
  await ctx.close();
}

await browser.close();
console.log(`(abilities spec: ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
if (problems.length) {
  console.log(`PROBLEMS:\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('Abilities run clean: the page is gone as a way in (no Me row, deck card, hub card or address); the catalogue is the registries’ own (at least 250, none missing, every way in lands, the brain’s and the phone’s agree, FAVOURITES said); "can you …?" answers on the phone with a way to it, a near miss, "Not yet" and YES to the learning goal; the chat’s controls are where the registry says; WHY, today, the first run, the offers.');
