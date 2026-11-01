// ABILITIES — THE EVERYTHING TAB (BRIEF-EVERYTHING; OWNER-ISSUES 92 ①, 68, 67b, 67d, 68c) on the owner's phone (440 × 956)
// and a smaller one (390 × 844):
//  - the tab opens from the Me sheet and from the Every screen deck; the count is at least 250 and is the registries' own
//    (every registry item has its words: none missing; every entry is reachable under its chip, once); every TRY IT lands
//    somewhere this build has; the chat's own controls and what works everywhere are where the registry says;
//  - the scenes in order, each a panel of cards; a card is the plain name then its line (VoiceOver reads them in that
//    order); NEW on exactly the entries that arrived within two weeks; the eight chips narrow the list to their own;
//  - search: "train" finds the live departures; a card opens its sheet (the line, the explanation, SAY IT LIKE THIS,
//    TRY IT, WHERE IT LIVES, SINCE, and for a brain tool WHY I MIGHT USE IT MYSELF); TRY IT does what its button says on
//    six entries: a screen and its panel (System → BACKUP), a key still needed (changing my own code → SYSTEM → KEYS), a
//    command (the Gym on chess; the Lens on SCAN → TRANSLATE), an ask sent to the chat (the next train), words left in the
//    chat box (a reminder);
//  - nothing sideways at 440 or 390; every row and target 44 pt or more.
// Kept from before (they still apply): "Can you …?" in the box — a yes, a near miss ("Not quite"), or "Not yet. Want me to
// learn it?" → YES keeps it as a learning goal (LEARNING, the brain, the Workshop first); the same question in the chat with
// no model, a request ("…at 5") still to the brain; WHY (a reply's trail in a sheet, from WHY or a long press, and "why did
// you do that?" typed); "what did you do today?" with no model; the first run's three things, once; one offer in context,
// one a day; the day's one "did you know".
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

/** Open ABILITIES from the Me sheet's row, and wait for the brain's items to be on it. */
async function openFromMe(page, W) {
  if (!(await page.locator('#top .you').isVisible().catch(() => false))) {
    await page.evaluate(() => (location.hash = 'core'));
    await page.waitForTimeout(500);
  }
  await page.click('#top .you');
  await page.waitForSelector('#mesheet .merow[data-id="abilities"]', { timeout: 5000 }).catch(() => problems.push(`[${W}] no Abilities row on the Me sheet`));
  await page.waitForTimeout(400);
  await page.click('#mesheet .merow[data-id="abilities"]');
  await until(page, () => document.body.dataset.tab === 'abilities' && !document.querySelector('#mesheet'), null, 6000, `[${W}] the Me sheet's Abilities row did not open ABILITIES`);
  await until(page, () => (window.__ghosty?.abilities?.brain ?? 0) > 100, null, 15000, `[${W}] the brain's items never arrived`);
  await settle(page);
}
/** Every animation done (the push transition, the panels' rise): measured only once nothing is moving. */
const settle = (page) => page.waitForTimeout(150).then(() => page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))))).catch(() => undefined);
/** Back to ABILITIES with its search cleared and no chip on. */
async function back(page) {
  await page.evaluate(() => (location.hash = 'abilities'));
  await until(page, () => document.body.dataset.tab === 'abilities', null, 5000, 'ABILITIES did not come back');
  await page.evaluate(() => {
    const i = document.querySelector('#pg-abilities .canin');
    if (i && i.value) { i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); }
    if (window.__ghosty.abilities.cat) document.querySelector(`#pg-abilities .catchip[data-cat="${window.__ghosty.abilities.cat}"]`)?.click();
  });
  await page.waitForTimeout(250);
  await settle(page);
}
/** Search the box (Enter, as he would) and read what it found. */
async function search(page, words) {
  await back(page);
  await page.locator('#pg-abilities .canin').fill(words);
  await page.locator('#pg-abilities .canin').press('Enter');
  await page.waitForTimeout(350);
  return state(page);
}
/** Open an entry's sheet from its card (searching for it first by its own name when it is not on screen). */
async function sheetOf(page, id, words) {
  const s = await search(page, words);
  if (!s.found.includes(id)) problems.push(`searching "${words}" did not find ${id}: ${s.found.join(', ')}`);
  await page.locator(`#pg-abilities .canans .catcard[data-id="${id}"]`).first().click().catch((e) => problems.push(`could not tap ${id}: ${e.message.split('\n')[0]}`));
  await page.waitForSelector(`.modal .catbody[data-id="${id}"]`, { timeout: 5000 }).catch(() => problems.push(`${id}: its card did not open its sheet`));
  await settle(page);
}
/** TRY IT on an open sheet: its words, and a tap. */
async function tryIt(page, id, label) {
  const b = page.locator(`.modal .catbody[data-id="${id}"] button.cattry`);
  const said = (await b.textContent().catch(() => '')) ?? '';
  if (!label.test(said)) problems.push(`${id}: TRY IT says "${said}" (want ${label})`);
  await b.click().catch((e) => problems.push(`${id}: could not tap TRY IT: ${e.message.split('\n')[0]}`));
  return said;
}

for (const viewport of [PHONE, { width: 390, height: 844 }]) {
  const W = viewport.width;
  const { ctx, page } = await phone(viewport);
  await openFromMe(page, W);
  const s = await state(page);
  const look = await page.evaluate(() => ({
    title: document.querySelector('#top .navtitle')?.textContent ?? '',
    big: document.querySelector('#pg-abilities .bigv')?.textContent ?? '',
    sub: document.querySelector('#pg-abilities .hero .sub')?.textContent ?? '',
    scenes: [...document.querySelectorAll('#pg-abilities .pn.catscene:not([hidden]) .ptitle')].map((t) => t.textContent.trim().toUpperCase()),
    chips: [...document.querySelectorAll('#pg-abilities .catchip')].map((c) => c.dataset.cat),
    cards: [...document.querySelectorAll('#pg-abilities .pn.catscene:not([hidden]) .catcard')].map((c) => ({ id: c.dataset.id, aria: c.getAttribute('aria-label') ?? '', name: c.querySelector('.catname')?.textContent ?? '', line: c.querySelector('.catline')?.textContent ?? '', isNew: !!c.querySelector('.catnew') })),
    learn: document.querySelector('#pg-abilities .ablearn .ablead')?.textContent ?? '',
  }));
  // the count: the registries' own, at least 250, every item with its words
  if (s.count < 250) problems.push(`[${W}] only ${s.count} things listed`);
  if (s.missing.length) problems.push(`[${W}] registry items with no words: ${s.missing.slice(0, 6).join(', ')}`);
  if (s.items < s.count) problems.push(`[${W}] ${s.items} registry items for ${s.count} entries`);
  if (look.big !== `${s.count} things`) problems.push(`[${W}] the hero reads "${look.big}" (count ${s.count})`);
  if (!new RegExp(`^I can do ${s.count} things(, ${s.fresh} of them new in the last two weeks)?\\.`).test(look.sub)) problems.push(`[${W}] the count line reads "${look.sub}"`);
  // the scenes, in order; the chips: All and the eight
  const SCENES = ['IN THE MORNING', 'WHEN YOU’RE OUT', 'WITH THE CAMERA', 'MAKING THINGS', 'WATCHING OVER YOU', 'LEARNING AND SCHOOL', 'PLAYING', 'YOUR MONEY AND ADMIN', 'TALKING TO ME', 'ON THIS PHONE ONLY', 'BEHIND THE SCENES'];
  if (look.scenes.join('|') !== SCENES.join('|')) problems.push(`[${W}] the scenes are ${look.scenes.join(', ')}`);
  if (look.chips.join(',') !== ',see,know,build,watch,play,learn,do,talk') problems.push(`[${W}] the chips are ${look.chips.join(',')}`);
  // a card: the name, then the line, read in that order; NEW on exactly the new ones
  for (const c of look.cards) {
    if (!c.aria.startsWith(`${c.name}. ${c.line}`)) problems.push(`[${W}] ${c.id}: VoiceOver reads "${c.aria.slice(0, 80)}"`);
    if (c.isNew !== s.newIds.includes(c.id)) problems.push(`[${W}] ${c.id}: NEW is ${c.isNew ? 'shown on an old one' : 'missing on a new one'}`);
    if (/\b[a-z]+_[a-z0-9_]+\b/.test(`${c.name} ${c.line}`)) problems.push(`[${W}] ${c.id}: a code word in "${c.name} ${c.line}"`);
  }
  if (!look.cards.length) problems.push(`[${W}] no cards`);
  if (!/^I can learn anything you teach me/.test(look.learn)) problems.push(`[${W}] LEARNING opens with "${look.learn}"`);
  // every TRY IT lands somewhere this build has (a screen, a command it registered, words)
  if (s.broken.length) problems.push(`[${W}] TRY IT goes nowhere: ${s.broken.slice(0, 4).join(' | ')}`);
  // what the brain serves is what the tab counts as the brain's
  const info = await api('/abilities');
  if (!info?.catalogue || info.catalogue.length !== s.brain) problems.push(`[${W}] the brain serves ${info?.catalogue?.length} items, the tab has ${s.brain}`);
  for (const x of await sideways(page, '#pg-abilities *')) problems.push(`[${W}] sticks out sideways: ${x}`);
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) problems.push(`[${W}] the page scrolls sideways`);
  await page.screenshot({ path: `${out}/abilities-${W}.png` });
  for (const t of await small(page, '#pg-abilities :is(button.catcard, button.catchip, button.catmore, .canform button, .canin, .ablearn button)')) problems.push(`[${W}] under 44 pt: ${t}`);

  // ---- the eight chips: each narrows the list to its own, and together they hold every entry once
  const seen = new Set();
  for (const cat of ['see', 'know', 'build', 'watch', 'play', 'learn', 'do', 'talk']) {
    await page.click(`#pg-abilities .catchip[data-cat="${cat}"]`);
    await page.waitForTimeout(200);
    const got = await page.evaluate(() => [...document.querySelectorAll('#pg-abilities .pn.catscene:not([hidden]) .catcard')].map((c) => ({ id: c.dataset.id, cat: c.dataset.cat })));
    const others = got.filter((c) => c.cat !== cat);
    if (others.length) problems.push(`[${W}] the ${cat} chip shows ${others.length} of other chips: ${others.slice(0, 3).map((c) => c.id).join(', ')}`);
    const ids = new Set(got.map((c) => c.id));
    if (ids.size !== s.perCat[cat]) problems.push(`[${W}] the ${cat} chip shows ${ids.size} things, it has ${s.perCat[cat]}`);
    for (const id of ids) seen.add(id);
    if (cat === 'play') await page.screenshot({ path: `${out}/abilities-${W}-play.png` });
    await page.click(`#pg-abilities .catchip[data-cat="${cat}"]`);
    await page.waitForTimeout(150);
  }
  if (seen.size !== s.count) problems.push(`[${W}] the chips hold ${seen.size} things between them, the count is ${s.count}`);
  for (const t of await small(page, '#pg-abilities button.catchip')) problems.push(`[${W}] a chip under 44 pt: ${t}`);

  // ---- search: "train" finds the live departures; a card opens its sheet
  let st = await search(page, 'train');
  if (st.answer !== 'hit' || !st.found.includes('tool:next_departures')) problems.push(`[${W}] "train" → ${st.answer}: ${st.found.join(', ')} (want the live departures)`);
  await page.screenshot({ path: `${out}/abilities-${W}-train.png` });
  await sheetOf(page, 'tool:next_departures', 'train');
  const sh = await page.evaluate(() => {
    const b = document.querySelector('.modal .catbody');
    return {
      title: document.querySelector('.modal .mhead b')?.textContent ?? '',
      lead: b?.querySelector('.catlead')?.textContent ?? '',
      more: b?.querySelector('.catmore')?.textContent ?? '',
      heads: [...(b?.querySelectorAll('.catk') ?? [])].map((k) => k.textContent),
      say: [...(b?.querySelectorAll('.catsay li') ?? [])].map((l) => l.textContent),
      text: b?.textContent ?? '',
    };
  });
  if (sh.title !== 'Live train and bus times') problems.push(`[${W}] the sheet's title is "${sh.title}"`);
  if (!/^I can look up the next trains/.test(sh.lead) || sh.more.length < 40) problems.push(`[${W}] the sheet does not explain itself: ${JSON.stringify([sh.lead, sh.more])}`);
  for (const k of ['SAY IT LIKE THIS', 'TRY IT', 'WHERE IT LIVES', 'SINCE', 'WHY I MIGHT USE IT MYSELF']) if (!sh.heads.includes(k)) problems.push(`[${W}] the sheet has no ${k}: ${sh.heads.join(', ')}`);
  if (sh.say.length < 2) problems.push(`[${W}] the sheet says ${sh.say.length} ways to say it`);
  if (/\b[a-z]+_[a-z0-9_]+\b/.test(sh.text)) problems.push(`[${W}] a code word on the sheet: ${sh.text.slice(0, 120)}`);
  for (const x of await sideways(page, '.modal *')) problems.push(`[${W}] the sheet sticks out sideways: ${x}`);
  for (const t of await small(page, '.modal :is(button.cattry, button.catset, .mhead button)')) problems.push(`[${W}] under 44 pt on the sheet: ${t}`);
  await page.screenshot({ path: `${out}/abilities-${W}-sheet.png` });
  await page.click('.modal .mhead button');
  await page.waitForTimeout(250);

  if (W === PHONE.width) {
    // ---- TRY IT does what its button says, on six entries
    const sentBefore = await page.evaluate(() => document.querySelectorAll('#pg-core .msg.me').length);
    // 1. a screen and its panel: System → BACKUP
    await sheetOf(page, 'panel:system:BACKUP & RESTORE', 'back up this phone');
    await tryIt(page, 'panel:system:BACKUP & RESTORE', /^Opens System on Backup & restore$/);
    await until(page, () => document.body.dataset.tab === 'system' && [...document.querySelectorAll('#pg-system .pn')].some((p) => /^BACKUP/i.test(p.querySelector('.ptitle')?.textContent ?? '') && p.getClientRects().length), null, 8000, 'TRY IT on BACKUP did not open System on BACKUP');
    // 2. a key still needed: changing my own code (this preview brain has no GitHub token) → SYSTEM → KEYS
    await sheetOf(page, 'tool:propose_change', 'change my own code');
    if (!(await page.locator('.modal .catbody .catoff', { hasText: 'GitHub token' }).count())) problems.push('changing my own code does not say it needs the GitHub token');
    await tryIt(page, 'tool:propose_change', /^Set it up: needs a key: SYSTEM → KEYS → GitHub token$/);
    await until(page, () => document.body.dataset.tab === 'system' && [...document.querySelectorAll('#pg-system .pn')].some((p) => /^KEYS/i.test(p.querySelector('.ptitle')?.textContent ?? '') && p.getClientRects().length), null, 8000, 'TRY IT on changing my own code did not land on SYSTEM → KEYS');
    // 3. a command: the Gym on chess
    await sheetOf(page, 'game:chess', 'chess');
    await tryIt(page, 'game:chess', /^Opens the Gym on Chess$/);
    await until(page, () => document.body.dataset.tab === 'gym', null, 8000, 'TRY IT on chess did not open the Gym');
    // 4. a command: the Lens on SCAN → TRANSLATE ("can you translate signs?" finds it first)
    st = await search(page, 'can you translate signs?');
    if (st.answer !== 'hit' || st.found[0] !== 'deck:lens:translate-a-sign-or-a-menu') problems.push(`"can you translate signs?" → ${st.answer} ${st.found.join(', ')} (want the Lens's translate first)`);
    await sheetOf(page, 'deck:lens:translate-a-sign-or-a-menu', 'can you translate signs?');
    await tryIt(page, 'deck:lens:translate-a-sign-or-a-menu', /^Opens the Lens on SCAN → TRANSLATE$/);
    await until(page, () => document.body.dataset.tab === 'lens' && window.__ghosty?.lens?.mode === 'scan' && window.__ghosty?.scan?.sub === 'translate', null, 15000, 'TRY IT on translating a sign did not open the Lens on SCAN → TRANSLATE');
    // 5. an ask sent to the chat: the next train
    await sheetOf(page, 'tool:next_departures', 'train');
    const said = await tryIt(page, 'tool:next_departures', /^Asks me: “When’s the next train from New Street\?”$/);
    await until(page, () => document.body.dataset.tab === 'core' && [...document.querySelectorAll('#pg-core .msg.me')].some((m) => (m.textContent ?? '').includes('When’s the next train from New Street?')), null, 10000, `TRY IT ("${said}") did not send the words to the chat`);
    // 6. words left in the chat box for him to finish: a reminder (never one he did not ask for)
    await sheetOf(page, 'tool:set_reminder', 'birthday');
    await tryIt(page, 'tool:set_reminder', /^Starts “Remind me…” in the chat box for you$/);
    await until(page, () => document.body.dataset.tab === 'core' && document.querySelector('#cin')?.value === 'Remind me ', null, 6000, 'TRY IT on a reminder did not put "Remind me" in the chat box');
    const sentAfter = await page.evaluate(() => document.querySelectorAll('#pg-core .msg.me').length);
    if (sentAfter !== sentBefore + 1) problems.push(`TRY IT sent ${sentAfter - sentBefore} messages (want only the train's)`);
    await page.evaluate(() => { const b = document.querySelector('#cin'); if (b) b.value = ''; });
    // the chat's own controls are where the registry says (the reply ones once a reply is there)
    const missingControls = await page.evaluate(() => (window.__ghosty.abilities.controls ?? []).filter((c) => c.sel && !['undo', 'harder', 'bigbrain', 'askcloud'].includes(c.id) && !document.querySelector(c.sel)).map((c) => c.id));
    if (missingControls.length) problems.push(`the chat's controls not found where the registry says: ${missingControls.join(', ')}`);

    // ---- from the deck: the Me group's Abilities card opens it
    await page.evaluate(() => (location.hash = 'core'));
    await page.waitForTimeout(500);
    await page.click('#top .you');
    await page.click('#mesheet .merow[data-id="deck"]');
    await until(page, () => !!document.querySelector('#deck.on'), null, 5000, 'the deck did not open');
    await page.click('#deck .dkcard[data-id="abilities"]').catch(() => problems.push('no Abilities card in the deck'));
    await page.click('#deck .dkx[data-id="abilities"] .dkopen').catch(() => problems.push('the deck card has no OPEN'));
    await until(page, () => document.body.dataset.tab === 'abilities', null, 6000, 'the deck did not open ABILITIES');

    // ---- "Can you …?" (kept): a yes, a near miss, or "Not yet. Want me to learn it?"
    st = await search(page, "can you check my car's MOT");
    if (st.answer !== 'hit' || st.found[0] !== 'tool:vehicle_check') problems.push(`"can you check my car's MOT" → ${st.answer} ${st.found.join(', ')} (want the vehicle check)`);
    st = await search(page, 'can you fly a plane?');
    if (st.answer !== 'near') problems.push(`"can you fly a plane?" → ${st.answer} (want a near miss)`);
    if (!(await page.locator('#pg-abilities .canans', { hasText: 'Not quite. The nearest I’ve got:' }).count())) problems.push('a near miss does not say "Not quite"');
    await page.locator('#pg-abilities .canans button.learnno').click().catch(() => problems.push('no NO under a near miss'));
    if ((await page.locator('#pg-abilities .canans *').count()) || (await page.inputValue('#pg-abilities .canin')) !== '') problems.push('NO did not just close the offer');
    // (two made-up words, so this run's goal is never the same goal as an earlier run's: the brain keeps one of each)
    const nonce = () => Array.from({ length: 4 }, () => 'bcdfghjklmnpqrstvwxz'[Math.floor(Math.random() * 20)]).join('');
    const want = `make me a ${nonce()} ${nonce()} sandwich`;
    st = await search(page, `can you ${want}?`);
    if (st.answer !== 'none' || !(await page.locator('#pg-abilities .canans', { hasText: 'Not yet. Want me to learn it?' }).count())) problems.push(`"can you ${want}?" → ${st.answer} (want "Not yet. Want me to learn it?")`);
    await page.screenshot({ path: `${out}/abilities-notyet.png` });
    await page.locator('#pg-abilities .canans button.learnyes').click().catch(() => problems.push('no YES under "Not yet"'));
    await until(page, () => window.__ghosty?.abilities?.answer === 'learned', null, 8000, 'YES did not record the learning goal');
    await until(page, (w) => [...document.querySelectorAll('#pg-abilities .ablearn .abgoal b')].some((b) => b.textContent.includes(w)), want, 8000, 'the goal is not shown under LEARNING');
    const goals = (await api('/abilities'))?.goals ?? [];
    if (!goals.some((g) => g.ask.includes(want))) problems.push(`the brain did not keep the goal: ${JSON.stringify(goals.slice(0, 3))}`);
    await page.evaluate(() => (location.hash = 'workshop'));
    await until(page, (w) => { const first = document.querySelector('#pg-workshop .idea'); return !!first && first.classList.contains('mine') && first.textContent.includes(w); }, want, 10000, 'the Workshop does not list his goal first, marked as his');

    // ---- the chat answers the same kind of question with no model (kept)
    const asked = [];
    page.on('request', (r) => r.url().includes('/api/chat') && r.method() === 'POST' && asked.push(r.postData() ?? ''));
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
    await page.locator('#pg-core .localacts button.localgo').first().click().catch(() => problems.push('no GO under the chat answer'));
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
    const replyControls = await page.evaluate(() => ['listen', 'copy', 'why', 'rate'].filter((id) => { const c = (window.__ghosty.abilities.controls ?? []).find((x) => x.id === id); return !c || !document.querySelector(c.sel); }));
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
  if (said.chips.join('|') !== 'God’s eye|Brief|Gym|Everything I can do') problems.push(`[first run] its buttons are ${said.chips.join(', ')}`);
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
console.log('Abilities run clean: the everything tab opens from the Me sheet and the deck; the count is the registries’ own (at least 250, none missing), every TRY IT lands somewhere real, the chat’s controls are where the registry says; the scenes in order, cards read name then line, NEW on exactly the new ones, the eight chips narrow to their own and hold every entry between them; "train" finds the live departures and its sheet explains itself; TRY IT on System → BACKUP, a key still needed (→ KEYS), the Gym on chess, the Lens on SCAN → TRANSLATE, the next train asked in the chat, and a reminder left in the chat box; nothing sideways at 440 or 390, 44 pt targets; "can you…?": the MOT → the vehicle check, a near miss, NO closes, YES keeps the goal (LEARNING, the brain, the Workshop first); the chat answers with no model, GO opens the GYM, a request still goes to the brain; WHY from a reply’s WHY and a long press, and typed; "what did you do today?" with no model; a fresh phone hears three things once; one offer in context, once; the day’s one “did you know”.');
