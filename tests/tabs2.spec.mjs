// THE HOUSE IN THE SCAN (BRIEF-SHELL-2): split out of tabs.spec.mjs, which outgrew the 480 s a spec may run (same checks, same helpers):
// in The Scan, on his iPhone 18 Pro Max (440 × 956) and a 390 × 844 phone, every screen has the house with YOU ARE IN <room> and the
// room lit; a tap on THE HOUSE unfolds the plan (numbered things, the room he is in lit), a tap on a thing goes there; the jump bar
// (the field raises FAVOURITES and RECENT, a typed word is the search, OPEN opens it, under 300 ms); a hub is a room (the band, AT
// HAND, THE REST); the finding rule in the Scan. tabs.spec.mjs holds the rest, Glass's shell among it.
//   BASE=http://localhost:8788 node tests/tabs2.spec.mjs [outDir]
// The preview's brain is shared with the specs before this one: nothing here needs it fresh, every chat check waits for the
// reply to what this spec said, and nothing is left made.
import { launch, webkitNoise } from './browser.mjs';
import { GLASS, PHONE, UK, openDeck } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const SMALL = { width: 390, height: 844 };
const AREA_TOOLS = {
  ask: ['core', 'brief', 'voice'], see: ['eye', 'lens', 'interpreter'], make: ['studio', 'workshop', 'reverse', 'space', 'workbench', 'convert', 'editors', 'house'],
  learn: ['learn', 'arcade', 'gym', 'school', 'library', 'learning', 'coach', 'rehearse'], plan: ['agenda', 'markets', 'threats', 'radio'],
  life: ['money', 'body', 'kitchen', 'people', 'work', 'creative', 'outside', 'homeadmin'],
  // (Me's hub is the jump bar's "Me": its screens were there with nothing on their cards until 2 Nov)
  me: ['memory', 'settings', 'system', 'links', 'social'], // (ABILITIES left on 7 Nov: BRIEF-SHELL pass 1)
};
/** The pages that hold a table typed in by hand, and what their one plain line says (ui/sheetpage.ts SheetPart.line). */
const STAND_IN = { learning: { WORDS: /starter set, typed in by hand/, 'FIRST AID': /NHS.*999/ }, coach: { WORDS: /starter set, typed in by hand/ } };
const TV = { width: 1920, height: 1080 };
const problems = [];
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
/** A phone (or a television) with his settings, paired; every ask for the camera, the microphone or the position counted. */
async function open(viewport, { tv = false, path = '', world = 'glass' } = {}) {
  const ctx = await browser.newContext({ viewport, screen: viewport, ...UK, ...(tv ? {} : { deviceScaleFactor: 2, hasTouch: true, isMobile: true }), serviceWorkers: 'block' });
  await ctx.addInitScript(([k, tv, glass]) => {
    localStorage.setItem('ghosty.ownerKey', k);
    // (the bar, the cards, the deck's cards and the search below are GLASS's, held to their own checks unchanged: that world is set for them;
    // The Scan's house, plan, jump bar and rooms are checked in their own world at the end: BRIEF-SHELL-2)
    if (!localStorage.getItem('ghosty.settings')) localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Boss', home: { name: 'Birmingham', lat: 52.4862, lon: -1.8904 }, units: 'metric', ...(glass ? { look: glass } : {}) }));
    if (tv) localStorage.setItem('ghosty.tv', JSON.stringify({ mode: 'on' }));
    window.__asked = [];
    const md = navigator.mediaDevices;
    if (md?.getUserMedia) {
      const g = md.getUserMedia.bind(md);
      md.getUserMedia = (c) => (window.__asked.push(`media ${JSON.stringify(c)}`), g(c));
    }
    const geo = navigator.geolocation;
    if (geo) for (const k of ['getCurrentPosition', 'watchPosition']) {
      const f = geo[k].bind(geo);
      geo[k] = (...a) => (window.__asked.push(k), f(...a));
    }
  }, [KEY, tv, world === 'glass' ? GLASS.look : null]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${viewport.width}] pageerror: ${e.message}`));
  await page.goto(`${base}/${path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
  return { ctx, page };
}
const until = (page, fn, arg, ms, why) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, async () => (problems.push(typeof why === 'function' ? await why() : why), false));
const tabNow = (page) => page.evaluate(() => document.body.dataset.tab);
const go = async (page, hash, wait = 900) => {
  await page.evaluate((t) => (location.hash = t), hash);
  await page.waitForTimeout(wait);
  await page.evaluate(() => document.querySelectorAll('#toasts .toast').forEach((t) => t.remove()));
};
/** Things past the screen's sides (a row that scrolls sideways on purpose holds its own). */
const sideways = (page, sel) => page.$$eval(sel, (els) => els.filter((e) => {
  if (!e.getClientRects().length || getComputedStyle(e).visibility === 'hidden') return false;
  const r = e.getBoundingClientRect();
  if (!r.width || r.bottom < 0 || r.top > innerHeight) return false;
  for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
    if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) {
      const pr = p.getBoundingClientRect();
      if (pr.left >= -1 && pr.right <= innerWidth + 1) return false;
    }
  }
  return r.left < -1 || r.right > innerWidth + 1;
}).slice(0, 6).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} "${(e.textContent || '').trim().slice(0, 30)}"`));
/** Controls with no name VoiceOver reads (an aria-label, its words, or a label round it). */
const unnamed = (page, sel) => page.$$eval(`${sel} :is(button, input:not([type=hidden]), textarea, select, a[href], [role=button])`, (els) => els
  .filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden')
  .filter((e) => !((e.getAttribute('aria-label') || e.getAttribute('title') || e.textContent || e.getAttribute('placeholder') || '').trim() || e.closest('label')?.textContent?.trim()))
  .slice(0, 6).map((e) => e.outerHTML.slice(0, 90)));
/**
 * Controls a finger cannot take: under 44 pt (a box or a switch counts by the label round it). One known exception, said in the
 * report: the drum pads' step grid (CREATIVE → DRUM PADS), sixteen steps as two rows of eight, each 44 pt tall but only as wide
 * as a 390-pt phone leaves (about 31 pt), as in its sheet.
 */
const small = (page, sel) => page.$$eval(`${sel} :is(button, input:not([type=hidden]):not([type=file]), textarea, select, [role=button])`, (els) => els
  .filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]'))
  .filter((e) => !(e.matches('.pkgridrow .pkstep') && e.offsetHeight >= 44))
  .map((e) => {
    const t = /^(checkbox|radio)$/.test(e.type ?? '') ? e.closest('label') ?? e : e;
    // its laid-out size (a page still landing is drawn a little smaller for a moment: that is not the target's size)
    const r = { width: t.offsetWidth || t.getBoundingClientRect().width, height: t.offsetHeight || t.getBoundingClientRect().height };
    return r.width >= 43.5 && r.height >= 43.5 ? '' : `${t.tagName.toLowerCase()}${t.type ? `[${t.type}]` : ''} "${(t.getAttribute('aria-label') || t.textContent || '').trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)}`;
  }).filter(Boolean).slice(0, 6));
/** A hub card's words cut short (an ellipsis, or more lines than it shows): its title, its kicker, its readings' names, its
 * why line and its IN THE WORKS line. (A reading's value is live — the sky, a game's name — and is not held here.) */
const cutWords = (page, area) => page.$$eval(`#pg-area-${area} .hubgrid > .hubtile`, (cs) => cs.flatMap((c) => [...c.querySelectorAll('.t, .kick .nm, .rd em, .why:not([hidden]), .works span')]
  .filter((e) => e.getClientRects().length && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 2))
  .map((e) => `${c.dataset.id} "${e.textContent.trim().slice(0, 50)}" (${e.scrollWidth}×${e.scrollHeight} in ${e.clientWidth}×${e.clientHeight})`)));
/** The line at the top of a screen: said once it is read (never left on "Reading…", never empty). */
const heroSaid = (page, id, at) => until(page, (t) => {
  const s = document.querySelector(`#pg-${t} .hero .bigv`)?.textContent?.trim() ?? '';
  return !!s && s !== 'Reading…';
}, id, 10000, async () => `${at} the line at its top reads "${await page.$eval(`#pg-${id} .hero .bigv`, (e) => e.textContent).catch(() => 'nothing')}"`);
const sheetState = (page, id) => page.evaluate((t) => JSON.parse(JSON.stringify(window.__ghosty?.sheetpages?.[t] ?? null)), id);
/** The page at rest: every animation that ends has ended (a page coming in is drawn a little smaller until it lands). */
const settle = (page) => page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined)))).catch(() => undefined);

// ======================================================================== THE HOUSE IN THE SCAN (BRIEF-SHELL-2): the house on every screen, the plan, the jump bar, a room
for (const viewport of [PHONE, SMALL]) {
  const W = viewport.width;
  const { ctx, page } = await open(viewport, { world: 'scan' });
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('ghosty.settings') || '{}'); s.favourites = ['gym', 'learn']; localStorage.setItem('ghosty.settings', JSON.stringify(s)); });
  await page.reload();
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
  // 1. the house on every screen: seven keys HOME SEE MAKE LEARN PLAN LIFE ME, YOU ARE IN <ROOM> at the right, the room lit, the stamp over the title
  const HOUSE = [['area-learn', 'LEARN'], ['radio', 'PLAN'], ['settings', 'ME'], ['money', 'LIFE'], ['brief', 'HOME'], ['eye', 'SEE'], ['studio', 'MAKE']];
  for (const [t, room] of HOUSE) {
    await go(page, t, 900);
    const h = await page.evaluate(() => ({
      where: document.querySelector('#dock .housewhere')?.textContent, left: document.querySelector('#dock .housebtn')?.textContent,
      keys: [...document.querySelectorAll('#dock .tabcap button')].map((b) => (b.querySelector('span')?.textContent ?? '').toUpperCase()), lit: [...document.querySelectorAll('#dock .tabcap button.on')].length,
      small: [...document.querySelectorAll('#dock .tabcap button, #dock .housebtn, #dock .housefield, #dock .housemic')].filter((b) => b.getClientRects().length).filter((b) => { const r = b.getBoundingClientRect(); return r.height < 43.5 || r.width < 43.5; }).map((b) => b.className),
      stamp: document.querySelector('#top .headstamp')?.textContent ?? '', title: document.querySelector('#top .navtitle')?.textContent ?? '', field: document.querySelector('#dock .housewords')?.textContent,
    }));
    if (h.where !== `You are in ${room}` || !/The house · 7 rooms/i.test(h.left)) problems.push(`[${W} ${t}] the house says "${h.left}" / "${h.where}" (want The house · 7 rooms / You are in ${room})`);
    if (h.keys.join() !== 'HOME,SEE,MAKE,LEARN,PLAN,LIFE,ME' || h.lit !== 1) problems.push(`[${W} ${t}] the keys are ${h.keys.join()}, ${h.lit} lit (want HOME SEE MAKE LEARN PLAN LIFE ME and one lit)`);
    if (h.small.length) problems.push(`[${W} ${t}] under 44 pt: ${h.small.join()}`);
    if (!/^[A-Za-z]{3} \d+ [A-Za-z]{3}[\s\u00a0]· ?\d\d:\d\d[\s\u00a0]· ?Birmingham[\s\u00a0]· ?.*Looking at /.test(h.stamp) || !h.title) problems.push(`[${W} ${t}] the stamp and title read "${h.stamp}" / "${h.title}"`);
    if (t === 'area-learn' && h.field !== 'Find anything in Learn') problems.push(`[${W}] the Learn field says "${h.field}"`);
    if (t === 'settings' && h.field !== 'Find a setting') problems.push(`[${W}] the Settings field says "${h.field}"`);
    for (const x of await sideways(page, '#dock *, #top *')) problems.push(`[${W} ${t}] the house or the top sticks out sideways: ${x}`);
  }
  // 2. THE PLAN: one tap on THE HOUSE; 7 rooms, 43 things numbered in 7 rooms, the room he is in lit, favourites starred, in the works dotted; a tap goes there
  await go(page, 'area-learn', 1000);
  await page.click('#dock .housebtn');
  await page.waitForSelector('#plan .planroom', { timeout: 5000 }).catch(() => problems.push(`[${W}] THE HOUSE did not unfold the plan`));
  await page.waitForTimeout(400);
  const plan = await page.evaluate(() => ({
    rooms: [...document.querySelectorAll('#plan .planroom')].map((r) => r.dataset.room), things: document.querySelectorAll('#plan .planthing').length, lit: document.querySelector('#plan .planroom.lit')?.dataset.room,
    learn: [...document.querySelectorAll('#plan .planroom[data-room="learn"] .planthing')].map((x) => `${x.dataset.n}:${x.dataset.id}`).join(), starred: [...document.querySelectorAll('#plan .planthing[data-starred]')].map((x) => x.dataset.id), works: [...document.querySelectorAll('#plan .planthing[data-works]')].map((x) => x.dataset.id),
    small: [...document.querySelectorAll('#plan button')].filter((b) => { const r = b.getBoundingClientRect(); return r.height < 43.5; }).length, expanded: document.querySelector('#dock .housebtn')?.getAttribute('aria-expanded'),
    names: [...document.querySelectorAll('#plan .planroom[data-room="learn"] .ptname')].map((x) => x.textContent).join(),
  }));
  if (plan.rooms.join() !== 'home,see,make,learn,plan,life,me' || plan.things !== 43 || plan.lit !== 'learn') problems.push(`[${W}] the plan: ${JSON.stringify(plan)} (want 7 rooms, 43 numbered things, Learn lit)`);
  if (plan.learn !== '1:learn,2:arcade,3:gym,4:school,5:library,6:learning,7:coach,8:rehearse' || plan.names !== 'Courses,Arcade,Gym,School,Library,Learning,Coach,Rehearse') problems.push(`[${W}] Learn's things on the plan: ${plan.learn} / ${plan.names}`);
  if (plan.starred.join() !== 'learn,gym' && plan.starred.join() !== 'gym,learn') problems.push(`[${W}] the plan stars ${plan.starred} (his favourites: gym, courses)`);
  if (plan.works.sort().join() !== 'coach,learning') problems.push(`[${W}] the plan dots IN THE WORKS on ${plan.works}`);
  if (plan.small) problems.push(`[${W}] ${plan.small} plan keys are under 44 pt`);
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) problems.push(`[${W}] the plan scrolls sideways`);
  await page.screenshot({ path: `${out}/tabs-${W}-plan.png` });
  await page.click('#plan .planthing[data-room="plan"][data-n="4"]');
  await until(page, () => document.body.dataset.tab === 'radio' && !document.querySelector('#plan'), null, 6000, `[${W}] "04 Radio" on the plan did not open Radio and fold it`);
  await go(page, 'area-learn', 800);
  await page.click('#dock .housebtn');
  await page.waitForSelector('#plan');
  await page.click('#plan .planhead');
  if (await page.locator('#plan').count()) problems.push(`[${W}] a tap on THE HOUSE did not fold the plan`);
  await page.click('#dock .housebtn');
  await page.keyboard.press('Escape');
  if (await page.locator('#plan').count()) problems.push(`[${W}] Escape did not fold the plan`);
  // Home draws the same house and the same plan
  await go(page, 'core', 1500);
  await page.click('.scankickkey');
  await page.waitForSelector('#plan .planroom', { timeout: 5000 }).catch(() => problems.push(`[${W}] Home's THE HOUSE did not unfold the plan`));
  const hk = await page.evaluate(() => { const b = document.querySelector('.scankickkey')?.getBoundingClientRect(); return { h: b?.height ?? 0 }; });
  await page.keyboard.press('Escape');
  if (hk.h < 43.5) problems.push(`[${W}] Home's THE HOUSE key is ${hk.h} pt tall (want 44)`);
  // 3. THE JUMP BAR: a tap into the field raises FAVOURITES and RECENT; "rad" is found in PLAN and locks; Enter opens; the open under 300 ms
  await go(page, 'area-learn', 900);
  await page.click('#dock .housefield');
  await page.waitForSelector('#palette.scanjump .jgroup', { timeout: 5000 }).catch(() => problems.push(`[${W}] a tap in the field raised no FAVOURITES`));
  const jb = await page.evaluate(() => ({ groups: [...document.querySelectorAll('#palette .jgroup')].map((g) => g.dataset.group), pins: [...document.querySelectorAll('#palette .jgroup[data-group="Favourites"] .jchip')].map((c) => c.textContent), small: [...document.querySelectorAll('#palette .jchip, #palette .prow button')].filter((b) => b.getClientRects().length).filter((b) => b.getBoundingClientRect().height < 43.5).length, hint: getComputedStyle(document.querySelector('#palette .hint')).display }));
  if (jb.groups[0] !== 'Favourites' || !/Gym/i.test(jb.pins.join())) problems.push(`[${W}] the jump bar shows ${JSON.stringify(jb)} (want FAVOURITES first, Gym in it)`);
  if (jb.small) problems.push(`[${W}] ${jb.small} jump-bar keys are under 44 pt`);
  await page.screenshot({ path: `${out}/tabs-${W}-jump.png` });
  await page.keyboard.type('rad');
  await page.waitForTimeout(700);
  const ty = await page.evaluate(() => ({ chk: document.querySelector('#palette .jchecked')?.textContent, name: document.querySelector('#palette .jname')?.textContent, n: document.querySelector('#palette .jplate')?.dataset.n, open: document.querySelector('#palette .jplate .g-key')?.textContent, locks: window.__ghosty?.jump?.locks, found: window.__ghosty?.jump?.found, ask: document.querySelector('#palette .jask')?.textContent ?? '' }));
  if (!/^checked home[\s\u00a0]· ?see[\s\u00a0]· ?make[\s\u00a0]· ?learn[\s\u00a0]· ?found in plan$/i.test(ty.chk ?? '') || !/radio/i.test(ty.name ?? '') || ty.n !== '4' || !/^open$/i.test(ty.open ?? '') || !(ty.locks >= 1) || !/RADIO · 04/i.test(ty.found ?? '')) problems.push(`[${W}] typed "rad": ${JSON.stringify(ty)} (want CHECKED HOME · SEE · MAKE · LEARN · FOUND IN PLAN, the box on RADIO · 04 with OPEN, locked once)`);
  if (!/Or ask me: .rad.*goes to me as a question/i.test(ty.ask)) problems.push(`[${W}] no "or ask me" row under the find: "${ty.ask}"`);
  await page.screenshot({ path: `${out}/tabs-${W}-typed.png` });
  await page.keyboard.press('Enter');
  await until(page, () => document.body.dataset.tab === 'radio', null, 6000, `[${W}] Enter on the find did not open Radio`);
  // words that match no screen go to Ghosty as the question they are
  await go(page, 'area-plan', 800);
  await page.click('#dock .housefield');
  const words = 'How far is the Moon from Birmingham';
  await page.keyboard.type(words);
  await page.keyboard.press('Enter');
  await until(page, (w) => document.body.dataset.tab === 'core' && [...document.querySelectorAll('#pg-core .log .msg.me')].some((m) => m.textContent.includes(w)), 'How far is the Moon', 15000, `[${W}] words that match no screen did not go to Ghosty as a question`);
  // the open budget: median of five
  await go(page, 'area-learn', 600);
  const ms = [];
  for (let i = 0; i < 5; i++) {
    ms.push(await page.evaluate(() => new Promise((r) => { const t = performance.now(); document.querySelector('#dock .housefield').click(); requestAnimationFrame(() => requestAnimationFrame(() => { const ok = !!document.querySelector('#palette.on .jroot .jgroup'); r(ok ? performance.now() - t : 9999); })); })));
    await page.click('#palette .pcancel');
    await page.waitForTimeout(350);
  }
  const med = [...ms].sort((a, b) => a - b)[2];
  console.log(`house: the jump bar opens in ${Math.round(med)} ms (median of five: ${ms.map(Math.round).join(', ')}) at ${W}`);
  if (med > 300) problems.push(`[${W}] [speed] the jump bar took ${Math.round(med)} ms to open, median of five (the budget is 300)`);
  // 4. a room: Learn at 440 and 390, every tool of every area, the finding rule by real taps through the house
  if (W === PHONE.width) {
    for (const [area, ids] of Object.entries(AREA_TOOLS)) {
      await go(page, `area-${area}`, 1200);
      const got = await page.evaluate((a) => [...document.querySelectorAll(`#pg-area-${a} :is(.athand, .therest) .hubtile`)].map((c) => c.dataset.id).sort().join(), area);
      // (the Me room also holds the two rows of the Me sheet that are not screens: Father and the origin, and Every screen)
      const want = (area === 'me' ? [...ids, 'origin', 'deck'] : ids).slice().sort().join();
      if (got !== want) problems.push(`[${W} ${area}] the room holds "${got}", want every tool "${want}"`);
      for (const x of await sideways(page, `#pg-area-${area} *`)) problems.push(`[${W} ${area}] the room sticks out sideways: ${x}`);
      const clear = await page.evaluate((a) => { const hub = document.querySelector(`#pg-area-${a} .hub`); const last = [...hub.querySelectorAll('.hubtile')].filter((c) => c.getClientRects().length).at(-1); last?.scrollIntoView({ block: 'end', behavior: 'instant' }); const r = last?.getBoundingClientRect(); const top = document.querySelector('#dock .housekick')?.getBoundingClientRect().top ?? innerHeight; return { b: r?.bottom ?? 0, top }; }, area);
      if (!(clear.b <= clear.top + 0.5)) problems.push(`[${W} ${area}] its last thing cannot be scrolled clear of the house (ends ${Math.round(clear.b)}, the house starts ${Math.round(clear.top)})`);
    }
  }
  // the finding rule by real taps in The Scan: eight screens from Home, counted (the rule: recents and favourites two, the rest three)
  let taps = 0;
  const tap = async (sel, wait = 700) => { taps++; await page.click(sel, { timeout: 3000 }).catch(() => page.click(sel, { timeout: 5000, force: true })).catch((e) => problems.push(`[${W} finding] could not tap ${sel}`)); await page.waitForTimeout(wait); };
  const key = (a) => `#dock .tabcap button[data-area="${a}"]`;
  const thing = (a, id) => `#pg-area-${a} .hubtile[data-id="${id}"]`;
  const WALK = { brief: [key('ask'), thing('ask', 'brief')], eye: [key('see'), thing('see', 'eye')], gym: [key('learn'), thing('learn', 'gym')], agenda: [key('plan'), thing('plan', 'agenda')], money: [key('life'), thing('life', 'money')], house: [key('make'), thing('make', 'house')], memory: [key('me'), thing('me', 'memory')], look: [key('me'), thing('me', 'settings'), '#pg-settings .srow[data-title="THE LOOK"]'] };
  for (const [id, steps] of Object.entries(WALK)) {
    await go(page, 'core', 900);
    taps = 0;
    for (const sel of steps) await tap(sel);
    const at = await tabNow(page);
    const want = id === 'brief' || id === 'look' ? id : id;
    if (at !== want) problems.push(`[${W} finding] ${id}: ${steps.length} taps from Home landed on ${at}`);
    if (taps > 3) problems.push(`[${W} finding] ${id} took ${taps} taps (the rule is three)`);
  }
  await ctx.close();
}

await browser.close();
if (problems.length) {
  console.error(`FAIL tabs2\n${[...new Set(problems)].join('\n')}`);
  process.exit(1);
}
console.log("tabs2: OK (the house on every screen in The Scan with YOU ARE IN and the room lit, the plan with its numbered things and a tap on a thing, the jump bar with FAVOURITES and RECENT and a typed word found and opened under 300 ms, a hub as a room, the finding rule in The Scan)");
