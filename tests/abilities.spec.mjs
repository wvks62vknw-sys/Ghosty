// ABILITIES (OWNER-ISSUES 68, 67b, 67d, 68c) on the owner's phone (440 × 956) and a smaller one (390): the screen opens from
// the Me sheet and from the Every screen deck, in his voice ("I can …"), grouped SEE · KNOW · BUILD · WATCH OVER YOU · PLAY ·
// LEARN · DO FOR YOU · TALK, made from what is really there (the brain's tool groups through /api/abilities and the app's
// screens, games, Lens modes and school stages); every GO and every ask lands somewhere real, and the ones tapped land
// where they say (a screen, a panel on it, a command, the chat box); one that needs a key says so and GO goes to KEYS;
// LEARNING opens with "I can learn anything you teach me"; nothing sideways at 440 or 390; every target 44 pt.
// "Can you …?" (item 2): in the box and in the chat, the ability and GO, a near miss, or "Not yet. Want me to learn it?" →
// YES keeps it as a learning goal (LEARNING, the brain, the Workshop); a request ("…at 5") still goes to the brain.
// WHY (item 3): a reply's trail in a sheet, from its WHY or a long press; "why did you do that?" answered in the chat, no model.
// Today (item 4): "what did you do today?" lists the day, no model; a fresh phone hears three things it can do once, never again.
// In context (item 5): a worry typed gets ONE line offering an ability, once, one a day; the day's one "did you know I can …?".
//   BASE=http://localhost:8866 node tests/abilities.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, standDown } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const problems = [];
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
const state = (page) => page.evaluate(() => window.__ghosty?.abilities ?? null);

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

/** Open ABILITIES from the Me sheet's row, and wait for the brain's abilities to be on it. */
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
  await until(page, () => (window.__ghosty?.abilities?.brain ?? 0) > 20, null, 15000, `[${W}] the brain's abilities never arrived`);
  await settle(page);
}
/** The push transition done (the screen slides in from the side): measured only once nothing is moving. */
const settle = (page) => page.waitForTimeout(150).then(() => page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))))).catch(() => undefined);

for (const viewport of [PHONE, { width: 390, height: 844 }]) {
  const W = viewport.width;
  const { ctx, page } = await phone(viewport);
  await openFromMe(page, W);
  const s = await state(page);
  const look = await page.evaluate(() => ({
    title: document.querySelector('#top .navtitle')?.textContent ?? '',
    big: document.querySelector('#pg-abilities .bigv')?.textContent ?? '',
    sub: document.querySelector('#pg-abilities .hero .sub')?.textContent ?? '',
    panels: [...document.querySelectorAll('#pg-abilities .pn.abcat:not([hidden]) .ptitle')].map((t) => t.textContent),
    lines: [...document.querySelectorAll('#pg-abilities .abil .abline')].map((l) => l.textContent),
    gos: document.querySelectorAll('#pg-abilities .abil button.abgo').length,
    cards: document.querySelectorAll('#pg-abilities .abil').length,
    brainCards: document.querySelectorAll('#pg-abilities .abil[data-from="brain"]').length,
    learn: document.querySelector('#pg-abilities .ablearn .ablead')?.textContent ?? '',
    off: [...document.querySelectorAll('#pg-abilities .abil[data-off] .aboff')].map((x) => x.textContent),
  }));
  const want = ['SEE', 'KNOW', 'BUILD', 'WATCH OVER YOU', 'PLAY', 'LEARN', 'DO FOR YOU', 'TALK'];
  if (look.panels.join('|') !== want.join('|')) problems.push(`[${W}] the groups are ${look.panels.join(', ')} (want ${want.join(', ')})`);
  if (!/^\d+ THINGS$/.test(look.big) || Number.parseInt(look.big, 10) !== s.count) problems.push(`[${W}] the hero reads "${look.big}" (count ${s.count})`);
  if (!/^Everything I can do for you/.test(look.sub)) problems.push(`[${W}] the line under the title reads "${look.sub}"`);
  if (look.cards !== s.count || look.gos !== s.count) problems.push(`[${W}] ${look.cards} cards and ${look.gos} GO buttons for ${s.count} abilities`);
  // the brain's abilities: one per tool group (from its registry, read the same way the screen does)
  const info = await api('/abilities');
  if (!info || look.brainCards !== info.abilities.length) problems.push(`[${W}] ${look.brainCards} of the brain's abilities shown, it has ${info?.abilities.length}`);
  // his voice: the brain's every line starts "I can"; the screens' lines are his promises ("I …"), never "he"
  const notMine = look.lines.filter((l) => /\b(?:he|him|his|the owner)\b/i.test(l) || /_/.test(l));
  if (notMine.length) problems.push(`[${W}] lines not in his voice: ${notMine.slice(0, 3).join(' | ')}`);
  if (!look.lines.includes('I can learn anything you teach me.')) problems.push(`[${W}] "I can learn anything you teach me." is not listed`);
  if (!look.lines.some((l) => /^I teach myself by playing \d+ games/.test(l))) problems.push(`[${W}] the GYM's games are not listed`);
  if (!look.lines.some((l) => /^I see through your camera/.test(l))) problems.push(`[${W}] the Lens's modes are not listed`);
  if (!look.lines.some((l) => /^I go to school and sit real exams, stage by stage: Nursery/.test(l))) problems.push(`[${W}] SCHOOL's stages are not listed`);
  // honest about what needs a key: this preview brain has no GitHub token, so changing his own code says so
  if (!look.off.some((o) => /^Needs a key: SYSTEM → KEYS → GitHub token$/.test(o))) problems.push(`[${W}] nothing says it needs the GitHub key: ${look.off.join(' | ')}`);
  if (!/^I can learn anything you teach me/.test(look.learn)) problems.push(`[${W}] LEARNING opens with "${look.learn}"`);
  // nothing in the list is marked as the answer to a question nobody asked
  const marked = await page.locator('#pg-abilities .abcat .abask.best').count();
  if (marked) problems.push(`[${W}] ${marked} asks in the list are marked as the one that fits`);
  // every GO and every ask lands somewhere real (a screen this build has, a command it registered, the chat box)
  if (s.broken.length) problems.push(`[${W}] GO or an ask goes nowhere: ${s.broken.slice(0, 4).join(' | ')}`);
  for (const x of await sideways(page, '#pg-abilities *')) problems.push(`[${W}] sticks out sideways: ${x}`);
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) problems.push(`[${W}] the page scrolls sideways`);
  await page.screenshot({ path: `${out}/abilities-${W}.png` });
  // the asks hidden behind "+N more" are opened first, so every target is measured
  for (const m of await page.$$('#pg-abilities button.abmore')) await m.click().catch(() => undefined);
  for (const t of await small(page, '#pg-abilities :is(button.abgo, button.abask, button.abmore, .ablearn button)')) problems.push(`[${W}] under 44 pt: ${t}`);

  if (W === PHONE.width) {
    // ---- GO lands where it says
    const tap = async (sel) => {
      await page.evaluate(() => (location.hash = 'abilities'));
      await until(page, () => document.body.dataset.tab === 'abilities', null, 5000, 'ABILITIES did not come back');
      await page.waitForTimeout(250);
      await page.locator(sel).first().scrollIntoViewIfNeeded().catch(() => undefined);
      await page.locator(sel).first().click({ timeout: 5000 }).catch((e) => problems.push(`could not tap ${sel}: ${e.message.split('\n')[0]}`));
    };
    // a screen: SPACE
    await tap('#pg-abilities .abil[data-id="s:space"] button.abgo');
    await until(page, () => document.body.dataset.tab === 'space', null, 6000, 'GO on Space did not open SPACE');
    // a panel on a screen: the System's BACKUP (an ask of the System screen)
    await tap('#pg-abilities .abil[data-id="s:system"] button.abask[data-go="open:system/BACKUP"]');
    await until(page, () => document.body.dataset.tab === 'system' && [...document.querySelectorAll('#pg-system .pn')].some((p) => /^BACKUP/i.test(p.querySelector('.ptitle')?.textContent ?? '') && p.getClientRects().length), null, 8000, 'the System ask did not land on BACKUP');
    // a command: the GYM on chess
    await tap('#pg-abilities .abil[data-id="gym:games"] button.abmore');
    await tap('#pg-abilities .abil[data-id="gym:games"] button.abask:has-text("Play me at Chess")');
    await until(page, () => document.body.dataset.tab === 'gym', null, 8000, '"Play me at Chess" did not open the GYM');
    // the brain's: the example into the chat box, not sent
    const sentBefore = await page.evaluate(() => document.querySelectorAll('#pg-core .msg.me').length);
    await tap('#pg-abilities .abil[data-id="g:journeys"] button.abgo');
    await until(page, () => document.body.dataset.tab === 'core' && document.querySelector('#cin')?.value === 'Plan journey', null, 6000, 'GO on journeys did not put "Plan journey" in the chat box');
    if ((await page.evaluate(() => document.querySelectorAll('#pg-core .msg.me').length)) !== sentBefore) problems.push('GO sent the example instead of leaving it in the box');
    await page.evaluate(() => { const b = document.querySelector('#cin'); if (b) b.value = ''; });
    // one that needs a key: SET UP goes to SYSTEM → KEYS
    await tap('#pg-abilities .abil[data-id="g:repo"] button.abgo');
    await until(page, () => document.body.dataset.tab === 'system' && [...document.querySelectorAll('#pg-system .pn')].some((p) => /^KEYS/i.test(p.querySelector('.ptitle')?.textContent ?? '') && p.getClientRects().length), null, 8000, 'SET UP on changing my own code did not land on SYSTEM → KEYS');
    // ---- from the deck: the Me group's Abilities card opens it
    await page.evaluate(() => (location.hash = 'core'));
    await page.waitForTimeout(500);
    await page.click('#top .you');
    await page.click('#mesheet .merow[data-id="deck"]');
    await until(page, () => !!document.querySelector('#deck.on'), null, 5000, 'the deck did not open');
    await page.click('#deck .dkcard[data-id="abilities"]').catch(() => problems.push('no Abilities card in the deck'));
    await page.click('#deck .dkx[data-id="abilities"] .dkopen').catch(() => problems.push('the deck card has no OPEN'));
    await until(page, () => document.body.dataset.tab === 'abilities', null, 6000, 'the deck did not open ABILITIES');

    // ---- "Can you …?" (item 2): the ability and GO, a near miss, or "Not yet. Want me to learn it?"
    const canYou = async (words) => {
      await page.evaluate(() => (location.hash = 'abilities'));
      await until(page, () => document.body.dataset.tab === 'abilities', null, 5000, 'ABILITIES did not come back');
      await page.locator('#pg-abilities .canin').fill(words);
      await page.locator('#pg-abilities .canin').press('Enter');
      await page.waitForTimeout(300);
      return state(page);
    };
    let st = await canYou('can you translate signs?');
    if (st.answer !== 'hit' || !st.found.includes('s:lens')) problems.push(`"can you translate signs?" → ${st.answer} ${st.found.join(', ')} (want the Lens)`);
    const best = page.locator('#pg-abilities .canans .abil[data-id="s:lens"] button.abask.best');
    if ((await best.textContent().catch(() => '')) !== 'Translate a sign or a menu') problems.push(`the Lens's ask that fits is not marked: "${await best.textContent().catch(() => '')}"`);
    await best.click().catch(() => problems.push('no ask to tap under "translate signs"'));
    await until(page, () => document.body.dataset.tab === 'lens' && window.__ghosty?.lens?.mode === 'scan' && window.__ghosty?.scan?.sub === 'translate', null, 15000, '"Translate a sign or a menu" did not open the Lens on SCAN → TRANSLATE');
    st = await canYou("can you check my car's MOT");
    if (st.answer !== 'hit' || st.found[0] !== 'g:vehicle') problems.push(`"can you check my car's MOT" → ${st.answer} ${st.found.join(', ')} (want the vehicle check)`);
    st = await canYou('can you fly a plane?');
    if (st.answer !== 'near') problems.push(`"can you fly a plane?" → ${st.answer} (want a near miss)`);
    if (!(await page.locator('#pg-abilities .canans', { hasText: 'Not quite. The nearest I’ve got:' }).count())) problems.push('a near miss does not say "Not quite"');
    await page.locator('#pg-abilities .canans button.learnno').click().catch(() => problems.push('no NO under a near miss'));
    if ((await page.locator('#pg-abilities .canans *').count()) || (await page.inputValue('#pg-abilities .canin')) !== '') problems.push('NO did not just close the offer');
    // (two made-up words, so this run's goal is never the same goal as an earlier run's: the brain keeps one of each)
    const nonce = () => Array.from({ length: 4 }, () => 'bcdfghjklmnpqrstvwxz'[Math.floor(Math.random() * 20)]).join('');
    const want = `make me a ${nonce()} ${nonce()} sandwich`;
    st = await canYou(`can you ${want}?`);
    if (st.answer !== 'none' || !(await page.locator('#pg-abilities .canans', { hasText: 'Not yet. Want me to learn it?' }).count())) problems.push(`"can you ${want}?" → ${st.answer} (want "Not yet. Want me to learn it?")`);
    await page.screenshot({ path: `${out}/abilities-notyet.png` });
    await page.locator('#pg-abilities .canans button.learnyes').click().catch(() => problems.push('no YES under "Not yet"'));
    await until(page, () => window.__ghosty?.abilities?.answer === 'learned', null, 8000, 'YES did not record the learning goal');
    await until(page, (w) => [...document.querySelectorAll('#pg-abilities .ablearn .abgoal b')].some((b) => b.textContent.includes(w)), want, 8000, 'the goal is not shown under LEARNING');
    const goals = (await api('/abilities'))?.goals ?? [];
    if (!goals.some((g) => g.ask.includes(want))) problems.push(`the brain did not keep the goal: ${JSON.stringify(goals.slice(0, 3))}`);
    // and in the Workshop's UPGRADE IDEAS, marked as his and first
    await page.evaluate(() => (location.hash = 'workshop'));
    await until(page, (w) => { const first = document.querySelector('#pg-workshop .idea'); return !!first && first.classList.contains('mine') && first.textContent.includes(w); }, want, 10000, 'the Workshop does not list his goal first, marked as his');

    // ---- the chat answers the same question the same way, with no model
    const asked = [];
    page.on('request', (r) => r.url().includes('/api/chat') && r.method() === 'POST' && asked.push(r.postData() ?? ''));
    await page.evaluate(() => (location.hash = 'core'));
    await page.waitForTimeout(600);
    // the conversation open (on a phone it sits behind its button; GO above may have opened it already)
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
    // nothing it cannot do yet goes to the model either: "Not yet. Want me to learn it?" in the chat too
    await page.fill('#cin', 'can you juggle?');
    await page.press('#cin', 'Enter');
    await until(page, () => [...document.querySelectorAll('#pg-core .msg:not(.me)')].some((m) => /^.*Not (?:yet|quite)/.test(m.textContent ?? '')), null, 8000, '"can you juggle?" was not answered "Not yet" in the chat');
    if (asked.some((b) => /juggle/.test(b))) problems.push('"can you juggle?" went to the model');

    // ---- WHY did you do that (item 3): a reply's trail in a sheet, from its WHY or a long press; "why did you do that?" typed
    const fact = `my ${nonce()} cat is called Tom`;
    await page.fill('#cin', `remember ${fact}`);
    await page.press('#cin', 'Enter');
    await until(page, () => [...document.querySelectorAll('#pg-core .msg:not(.me)')].some((m) => /remember/i.test(m.textContent ?? '') && m.querySelector('.whybtn')), null, 20000, 'the reply to "remember …" has no WHY');
    const sheet = async (how) => {
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
    await reply.locator('.whybtn').click().catch(() => problems.push('could not tap WHY'));
    await sheet('WHY');
    // a long press on the reply's words
    const box = await reply.locator(':scope > span').first().boundingBox().catch(() => null);
    if (box) {
      await page.mouse.move(box.x + 10, box.y + 6);
      await page.mouse.down();
      await page.waitForTimeout(800);
      await page.mouse.up();
      await sheet('a long press');
    } else problems.push('no words on the reply to press');
    const before = asked.length;
    await page.fill('#cin', 'why did you do that?');
    await page.press('#cin', 'Enter');
    await until(page, (f) => [...document.querySelectorAll('#pg-core .msg:not(.me)')].some((m) => (m.textContent ?? '').includes(`Why I did that:\nYou asked: “remember ${f}”\n1. Remembered`)), fact, 8000, '"why did you do that?" was not answered with the trail in the chat');
    await page.waitForTimeout(600);
    if (asked.length !== before) problems.push('"why did you do that?" went to the model');

    // ---- what did you do today (item 4): the brain's day and this phone's, newest first, no model
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

// ---- the first run (item 4): a fresh phone hears three things it can do, once, then never again
{
  const { ctx, page } = await phone(PHONE, () => { window.__ghostyFirstRun = true; });
  const first = () => page.evaluate(() => [...document.querySelectorAll('#pg-core .msg:not(.me)')].filter((m) => (m.textContent ?? '').includes('Three things I can do for you, to start:')).length);
  await until(page, () => [...document.querySelectorAll('#pg-core .msg:not(.me)')].some((m) => (m.textContent ?? '').includes('Three things I can do for you, to start:')), null, 10000, 'a fresh phone was not told three things it can do');
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

// ---- abilities revealed in context (item 5): one line after a turn that plainly calls for one, once; the day's one
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
  // the day's one "did you know I can …?", a while after the app opens with nothing under way
  const { ctx, page } = await offersPhone(true);
  await until(page, () => [...document.querySelectorAll('#pg-core .msg:not(.me)')].some((m) => /Did you know/.test(m.textContent ?? '')), null, 30000, '[offers] no "did you know" a while after the app opened');
  await page.waitForTimeout(1500);
  const dyk = await page.evaluate(() => [...document.querySelectorAll('#pg-core .msg:not(.me)')].filter((m) => /Did you know/.test(m.textContent ?? '')).map((m) => ({ text: m.querySelector(':scope > span')?.textContent ?? '', taps: m.querySelectorAll('.localacts button').length })));
  if (dyk.length !== 1 || !dyk[0].taps) problems.push(`[offers] the day's line: ${JSON.stringify(dyk)}`);
  await ctx.close();
}

await browser.close();
if (problems.length) {
  console.log(`PROBLEMS:\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('Abilities run clean: opens from the Me sheet and the deck, in his voice, the eight groups in order, one card per brain tool group and per screen, the GYM, the Lens and SCHOOL from their own lists, the key it needs said honestly, every GO and ask lands somewhere real (Space, System → BACKUP, the GYM on chess, the chat box unsent, SYSTEM → KEYS), nothing sideways at 440 or 390, 44 pt targets; "can you…?": translate signs → the Lens on TRANSLATE, the MOT → the vehicle check, a near miss, NO closes, YES keeps the goal (LEARNING, the brain, the Workshop first); the chat answers the same way with no model, GO opens the GYM, a request still goes to the brain; WHY: the sheet from a reply’s WHY and from a long press (what he asked, the step with its arguments and outcome, the reason), and "why did you do that?" answered in the chat with no model; "what did you do today?" lists the day with no model; a fresh phone hears three things once (God’s eye, Brief, Gym, everything), never again after it is opened again; in context: a worry typed gets the one line offering a reminder, the brain is told, the tap starts one, never again that day; the day’s one “did you know”.');
