// EVERY FEATURE A TAB (BRIEF-TABS; OWNER-ISSUES 119, his words: "can't we add tabs for everything we have like all the tabs we
// already have"), on his iPhone 18 Pro Max (440 × 956), a 390 × 844 phone and a television (1,920 × 1,080, TV mode):
//  - the tab bar holds the seven areas: Ask, See, Make, Learn, Plan and LIFE on the bar (Life between Plan and Me), Me at the
//    top; every label whole and readable, every button a finger's (44 pt; 56 on the television, where the bar stands up on
//    the left and the d-pad's Enter opens Life);
//  - every area's hub lists every tool of its area as a card, and its last card is reachable by a scroll, clear of the bar
//    (Me's hub too, its cards the Me sheet's rows, SOCIAL among them); every card's words whole (its title, its readings'
//    names, its why line, at both widths: the five-second test of 2 Nov), and IN THE WORKS on the two cards whose screens
//    hold a table typed in by hand (LEARNING, COACH) and on no other;
//  - each of the fourteen new screens (LIFE's eight packs; LEARN's learning pack and coach; MAKE's converter, documents and
//    house; ME's social self) opens from its card, from Every screen and from the jump bar (by its name, and by a plain
//    word from what it does), and from a link (?open=, ?do=open:); it shows its sheet's own pages under its pills, each page
//    drawn when its pill is picked; at 390 × 844 nothing sticks out sideways and every control is named for VoiceOver and
//    44 pt; its line at the top says what it holds (never left on "Reading…"); a page holding a table typed in by hand
//    says so in one plain line over it (LEARNING's words and first aid, the COACH's words) and no other page does; at
//    440 × 956 each opens on its first page whole too; opening a screen and its pages never starts the camera, the
//    microphone or the phone's position;
//  - the chat's doors still open the sheets: "when are the bins?" answers with HOME's bins in the chat and its chip opens the
//    HOME sheet there; "typing test" opens the coach's sheet on TYPING; "convert this to PDF" the converter's sheet.
// The preview's brain is shared with the specs before this one: nothing here needs it fresh, every chat check waits for the
// reply to what this spec said, and nothing is left made.
//   BASE=http://localhost:8788 node tests/tabs.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { GLASS, PHONE, UK, openDeck } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const SMALL = { width: 390, height: 844 };
const TV = { width: 1920, height: 1080 };
const problems = [];
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

// ---- what the screens and the areas hold (shell/areadefs.ts; ui/sheetpage.ts draws a screen's pages under its pills)
const AREA_TOOLS = {
  ask: ['core', 'brief', 'voice'], see: ['eye', 'lens', 'interpreter'], make: ['studio', 'workshop', 'reverse', 'space', 'workbench', 'convert', 'editors', 'house'],
  learn: ['learn', 'arcade', 'gym', 'school', 'library', 'learning', 'coach', 'rehearse'], plan: ['agenda', 'markets', 'threats', 'radio'],
  life: ['money', 'body', 'kitchen', 'people', 'work', 'creative', 'outside', 'homeadmin'],
  // (Me's hub is the jump bar's "Me": its screens were there with nothing on their cards until 2 Nov)
  me: ['memory', 'settings', 'system', 'links', 'social'], // (ABILITIES left on 7 Nov: BRIEF-SHELL pass 1)
};
/** The pages that hold a table typed in by hand, and what their one plain line says (ui/sheetpage.ts SheetPart.line). */
const STAND_IN = { learning: { WORDS: /starter set, typed in by hand/, 'FIRST AID': /NHS.*999/ }, coach: { WORDS: /starter set, typed in by hand/ } };
/** The cards that carry IN THE WORKS (shell/hubcards.ts HubCard.works): the screens whose pages hold one of those tables. */
const IN_THE_WORKS = ['coach', 'learning'];
/** Each new screen: its area, its name as the jump bar and the deck show it, a plain word it is found by, its pills and pages. */
const NEW = {
  money: { area: 'life', name: 'Money', word: 'statement', pills: ['Month', 'Budgets', 'Bills', 'Trends', 'Statement'], pages: ['YOUR MONTH', 'BUDGETS', 'BILLS AND SUBSCRIPTIONS', 'TRENDS', 'PASTE A STATEMENT'] },
  body: { area: 'life', name: 'Body', word: 'squats', pills: ['Reps', 'Run', 'Breathe', 'Stretch', 'Health', 'Water'], pages: ['COUNT MY REPS', 'RUNNING COACH', 'BREATHE', 'STRETCH SET', 'MY HEALTH WEEK', 'WATER TODAY'] },
  kitchen: { area: 'life', name: 'Kitchen', word: 'shopping list', pills: ['Timers', 'Shopping', 'Meal plan'], pages: ['TIMERS', 'SHOPPING LIST', 'MEAL PLAN'] },
  people: { area: 'life', name: 'People', word: 'gift ideas', pills: ['Your people', 'Coming up', 'Group plan'], pages: ['YOUR PEOPLE', 'COMING UP', 'GROUP PLAN'] },
  work: { area: 'life', name: 'Work', word: 'interview', pills: ['To-do', 'Interview', 'Document'], pages: ['TO-DO', 'INTERVIEW PRACTICE', 'DOCUMENT'] },
  creative: { area: 'life', name: 'Creative', word: 'poster', pills: ['Music', 'Poster', 'Card', 'Comic', 'Logo', 'Palette'], pages: ['YOUR SONG', 'DRUM PADS', 'POSTER', 'BIRTHDAY CARD', 'COMIC STRIP', 'LOGO SKETCH', 'PALETTE'] },
  outside: { area: 'life', name: 'Outside', word: 'toilets', pills: ['Walk', 'Nearby', 'My car', 'Lost', 'Split'], pages: ['WALK', 'NEARBY', 'MY CAR', 'LOST', 'SPLIT'] },
  homeadmin: { area: 'life', name: 'Home', word: 'bins', pills: ['Due', 'Bins', 'Bills', 'Meter', 'Rooms'], pages: ['DUE', 'BINS', 'BILLS', 'METER', 'ROOMS'] },
  learning: { area: 'learn', name: 'Learning', word: 'first aid', pills: ['Words', 'Draw', 'Typing', 'Drills', 'First aid', 'Plan'], pages: ['WORDS', 'CARDS', 'DRAW', 'WRITING', 'TYPING', 'READING', 'MEMORY', 'MATHS', 'SPELLING', 'FIRST AID', 'PLAN', 'STREAKS'] },
  coach: { area: 'learn', name: 'Coach', word: 'guitar', pills: ['Tuner', 'Lessons', 'Typing', 'Draw', 'Words'], pages: ['TUNER', 'LESSONS', 'TYPING', 'DRAW', 'WORDS'] },
  social: { area: 'me', name: 'Social', word: 'bluesky', pills: ['Waiting', 'Accounts', 'Origin'], pages: ['WAITING FOR YOUR APPROVE', 'SENT TODAY', 'BLUESKY', 'MASTODON', 'DISCORD', 'TELEGRAM CHANNEL', 'FATHER AND THE ORIGIN'] },
  convert: { area: 'make', name: 'Convert', word: 'pdfs', pills: [], pages: ['CONVERT'] },
  docs: { area: 'make', name: 'Documents', word: 'landlord', pills: [], pages: ['DOCUMENTS'] },
  sheets: { area: 'make', name: 'Spreadsheets', word: 'formulas', pills: [], pages: ['SPREADSHEETS'] },
  slides: { area: 'make', name: 'Presentations', word: 'slides', pills: [], pages: ['PRESENTATIONS'] },
  workspace: { area: 'make', name: 'The workspace', word: 'workspace', pills: [], pages: ['THE WORKSPACE'] },
  house: { area: 'make', name: 'House', word: 'heating', pills: [], pages: ['HOUSE'] },
};

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
 * Controls a finger cannot take: under 44 pt (a box or a switch counts by the label round it). No exception: the drum pads' step grid
 * (CREATIVE → DRUM PADS) is sixteen steps as four beats of four, each a full 44 pt (BRIEF-QUALITY-LIFE).
 */
const small = (page, sel) => page.$$eval(`${sel} :is(button, input:not([type=hidden]):not([type=file]), textarea, select, [role=button])`, (els) => els
  .filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]'))
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

// ===================================================================== 1. the tab bar's seven areas and every hub, at 440 and 390
for (const viewport of [PHONE, SMALL]) {
  const W = viewport.width;
  const { ctx, page } = await open(viewport);
  await go(page, 'area-life', 1500);
  const dock = await page.evaluate(() => ({
    areas: [...document.querySelectorAll('#dock .tabcap button[data-area]')].map((b) => ({ id: b.dataset.area, label: b.querySelector('span')?.textContent ?? '' })),
    me: !!document.querySelector('#top .you[data-area="me"]'),
    lit: document.querySelector('#dock .tabcap button.on')?.dataset.area ?? '',
    cut: [...document.querySelectorAll('#dock .tabcap button')].filter((b) => {
      const s = b.querySelector('span');
      if (!s || !s.textContent?.trim()) return true;
      const r = s.getBoundingClientRect();
      const o = b.getBoundingClientRect();
      return s.scrollWidth > s.clientWidth + 1 || r.left < o.left - 0.5 || r.right > o.right + 0.5 || parseFloat(getComputedStyle(s).fontSize) < 10 || getComputedStyle(s).visibility === 'hidden';
    }).map((b) => b.dataset.area),
    boxes: [...document.querySelectorAll('#dock .tabcap button, #top .you')].map((b) => { const r = b.getBoundingClientRect(); return { id: b.dataset.area, w: r.width, h: r.height }; }),
  }));
  if (dock.areas.map((a) => a.id).join(',') !== 'ask,see,make,learn,plan,life' || !dock.me) problems.push(`[${W}] the tab bar holds ${dock.areas.map((a) => a.id).join(', ')}${dock.me ? ' and Me' : ', no Me'} (want Ask, See, Make, Learn, Plan, Life, and Me)`);
  if (dock.areas.at(-1)?.label !== 'Life') problems.push(`[${W}] the seventh area is labelled "${dock.areas.at(-1)?.label}"`);
  if (dock.lit !== 'life') problems.push(`[${W}] Life is not lit on its hub (${dock.lit})`);
  if (dock.cut.length) problems.push(`[${W}] a tab-bar label is cut or too small to read: ${dock.cut.join(', ')}`);
  for (const b of dock.boxes) if (b.w < 44 || b.h < 44) problems.push(`[${W}] the ${b.id} button is ${Math.round(b.w)}×${Math.round(b.h)} (under 44 pt)`);
  for (const x of await sideways(page, '#dock *, #top *')) problems.push(`[${W}] the bars stick out sideways: ${x}`);
  await page.screenshot({ path: `${out}/tabs-${W}-life.png` });
  // every area's hub: every tool a card, the last reachable by a scroll and clear of the bar
  const works = [];
  for (const [area, ids] of Object.entries(AREA_TOOLS)) {
    await go(page, `area-${area}`, 1200);
    for (const c of await cutWords(page, area)) problems.push(`[${W} ${area}] a card's words are cut short: ${c}`);
    works.push(...(await page.$$eval(`#pg-area-${area} .hubtile .works`, (ws) => ws.map((w) => ({ id: w.closest('.hubtile')?.dataset.id, label: getComputedStyle(w.querySelector('b')).textTransform === 'uppercase' ? w.querySelector('b')?.textContent?.toUpperCase() : w.querySelector('b')?.textContent, line: w.querySelector('span')?.textContent?.trim() ?? '' })))));
    const h = await page.evaluate((a) => {
      const hub = document.querySelector(`#pg-area-${a} .hub`);
      const cards = [...(hub?.querySelectorAll('.hubgrid > .hubtile') ?? [])];
      const last = cards.at(-1);
      last?.scrollIntoView({ block: 'end', behavior: 'instant' });
      const r = last?.getBoundingClientRect();
      const bar = document.querySelector('#dock .tabcap')?.getBoundingClientRect().top ?? innerHeight;
      const res = { ids: cards.map((c) => c.dataset.id), bottom: r?.bottom ?? 0, top: r?.top ?? 0, bar, empty: cards.filter((c) => !c.querySelector('.t')?.textContent?.trim() || c.querySelectorAll('.reads .rd').length !== 2).map((c) => c.dataset.id), more: !!hub?.querySelector('.hubmore, .hubmini') };
      if (hub) hub.scrollTop = 0;
      return res;
    }, area);
    if (h.ids.join(',') !== ids.join(',')) problems.push(`[${W} ${area}] the hub's cards are "${h.ids.join(',')}", want every tool: "${ids.join(',')}"`);
    if (!(h.bottom <= h.bar + 0.5 && h.top >= 0)) problems.push(`[${W} ${area}] the last card cannot be scrolled clear of the tab bar (it ends at ${Math.round(h.bottom)}, the bar starts at ${Math.round(h.bar)})`);
    if (h.empty.length) problems.push(`[${W} ${area}] a card with no line or not two readings: ${h.empty.join(', ')}`);
    if (h.more) problems.push(`[${W} ${area}] a More row is still drawn`);
    for (const x of await sideways(page, `#pg-area-${area} *`)) problems.push(`[${W} ${area}] sticks out sideways: ${x}`);
  }
  if (works.map((w) => w.id).sort().join(',') !== IN_THE_WORKS.join(',')) problems.push(`[${W}] IN THE WORKS is on ${works.map((w) => w.id).join(', ') || 'no card'} (want ${IN_THE_WORKS.join(', ')})`);
  for (const w of works) if (w.label !== 'IN THE WORKS' || w.line.length < 12) problems.push(`[${W} ${w.id}] its IN THE WORKS reads "${w.label}: ${w.line}" (want the label and its one line)`);
  // Me: the avatar's sheet, its rows the area's screens, SOCIAL among them
  await go(page, 'core', 800);
  await page.click('#top .you');
  await page.waitForSelector('#mesheet .merow', { timeout: 5000 }).catch(() => problems.push(`[${W}] the Me sheet did not open`));
  const rows = await page.$$eval('#mesheet .merow', (rs) => rs.map((r) => r.dataset.id));
  for (const id of ['memory', 'settings', 'system', 'links', 'social', 'area-me']) if (!rows.includes(id)) problems.push(`[${W}] the Me sheet has no ${id} row: ${rows.join(', ')}`);
  await page.keyboard.press('Escape');
  await ctx.close();
}

// ===================================================================== 2. the fourteen screens at 390 × 844
{
  const W = SMALL.width;
  const { ctx, page } = await open(SMALL);
  for (const [id, s] of Object.entries(NEW)) {
    const at = `[${W} ${id}]`;
    // ---- from its card on its area's hub (Me's: its row on the Me sheet)
    if (s.area === 'me') {
      await go(page, 'core', 700);
      await page.click('#top .you');
      await page.waitForSelector(`#mesheet .merow[data-id="${id}"]`, { timeout: 5000 }).catch(() => undefined);
      await page.click(`#mesheet .merow[data-id="${id}"]`).catch(() => problems.push(`${at} no row on the Me sheet`));
    } else {
      await go(page, `area-${s.area}`, 1000);
      // (the editors sit under the one EDITORS card since the MAKE room passed ten things: their pills are one tap, shell/areadefs.ts)
      const card = page.locator(['docs', 'sheets', 'slides', 'workspace'].includes(id) ? `#pg-area-${s.area} .hubtile[data-id="editors"] .hubpill[data-editor="${id}"]` : `#pg-area-${s.area} .hubtile[data-id="${id}"]`);
      await card.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => undefined);
      await card.click({ timeout: 5000 }).catch(() => problems.push(`${at} has no card on the ${s.area} hub`));
    }
    await until(page, (t) => document.body.dataset.tab === t && window.__ghosty?.sheetpages?.[t]?.ready, id, 10000, async () => `${at} its card did not open it (on ${await tabNow(page)})`);
    await heroSaid(page, id, at);
    // ---- its pages under its pills, each drawn when its pill is picked
    const pills = await page.$$eval(`#pg-${id} .secpills:not([hidden]) .secpill`, (b) => b.map((x) => x.textContent ?? ''));
    if (pills.join('|') !== s.pills.join('|')) problems.push(`${at} the pills read "${pills.join(', ')}" (want "${s.pills.join(', ')}")`);
    const pages = await page.$$eval(`#pg-${id} .pn .ptitle`, (t) => t.map((x) => x.textContent ?? ''));
    if (pages.join('|') !== s.pages.join('|')) problems.push(`${at} the pages are "${pages.join(', ')}" (want "${s.pages.join(', ')}")`);
    for (const label of s.pills.length ? s.pills : ['']) {
      if (label) await page.locator(`#pg-${id} .secpills .secpill`, { hasText: new RegExp(`^${label}$`) }).first().click().catch(() => problems.push(`${at} no "${label}" pill`));
      // the panels this pill shows, each with its page drawn in it
      const ok = await until(page, (t) => {
        const st = window.__ghosty?.sheetpages?.[t];
        const shown = [...document.querySelectorAll(`#pg-${t} .pn`)].filter((p) => !p.hidden);
        return !!st && shown.length > 0 && shown.every((p) => st.built.includes(p.querySelector('.ptitle')?.textContent ?? '') && p.querySelector(':scope > .bd')?.childElementCount);
      }, id, 15000, async () => `${at} ${label || 'its page'}: not every page it shows was drawn (${JSON.stringify(await sheetState(page, id))})`);
      await page.waitForTimeout(500);
      await settle(page);
      if (!ok) continue;
      const shown = `#pg-${id} .pn:not([hidden])`;
      for (const x of await sideways(page, `${shown} *, #pg-${id} .secpills`)) problems.push(`${at} ${label || 'its page'} sticks out sideways: ${x}`);
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) problems.push(`${at} ${label || 'its page'}: the page scrolls sideways`);
      for (const u of await unnamed(page, shown)) problems.push(`${at} ${label || 'its page'}: a control with no name: ${u}`);
      for (const t of await small(page, shown)) problems.push(`${at} ${label || 'its page'}: under 44 pt: ${t}`);
      // a page holding a table typed in by hand says so over it, in one plain line; no other page carries one
      for (const l of await page.$$eval(`${shown}`, (ps) => ps.map((p) => ({ title: p.querySelector('.ptitle')?.textContent ?? '', line: p.querySelector(':scope > .bd > .sheetline')?.textContent ?? '' })))) {
        const want = STAND_IN[id]?.[l.title];
        if (want && !want.test(l.line)) problems.push(`${at} ${l.title}: its line over the page reads "${l.line}" (want ${want})`);
        if (!want && l.line) problems.push(`${at} ${l.title}: a stand-in line on a page that holds none: "${l.line}"`);
      }
    }
    // pages that are not on screen are not drawn (a pill shows its own; the rest wait)
    if (s.pills.length > 1) {
      const st = await sheetState(page, id);
      const shown = await page.$$eval(`#pg-${id} .pn:not([hidden]) .ptitle`, (t) => t.map((x) => x.textContent ?? ''));
      const extra = (st?.built ?? []).filter((t) => !shown.includes(t));
      if (extra.length) problems.push(`${at} pages drawn while their pill is not picked: ${extra.join(', ')}`);
    }
    await page.screenshot({ path: `${out}/tabs-390-${id}.png` });
    // ---- left: what it drew is put away
    await go(page, 'core', 700);
    const left = await sheetState(page, id);
    if (left?.built?.length && !left.built.every((t) => ['BLUESKY', 'MASTODON', 'DISCORD', 'TELEGRAM CHANNEL'].includes(t))) problems.push(`${at} its pages stay drawn after it is left: ${left.built.join(', ')}`);
    if (left?.on) problems.push(`${at} still marked on after it is left`);
  }
  // nothing asked for the camera, the microphone or where the phone is, by opening any of them
  const asked = await page.evaluate(() => window.__asked ?? []);
  if (asked.length) problems.push(`[${W}] opening the screens asked for ${asked.join(', ')} (only a tap on START or USE WHERE I AM NOW may)`);

  // ---- from Every screen: each card's OPEN
  for (const [id, s] of Object.entries(NEW)) {
    await go(page, 'core', 600);
    await openDeck(page);
    await page.waitForSelector(`#deck.on .dkcard[data-id="${id}"]`, { timeout: 5000 }).catch(() => problems.push(`[deck] no card for ${id}`));
    await page.click(`#deck .dkcard[data-id="${id}"]`).catch(() => undefined);
    const x = await page.waitForSelector(`#deck .dkx[data-id="${id}"]`, { timeout: 5000 }).catch(() => null);
    if (!x) {
      problems.push(`[deck ${id}] its card did not open in place`);
      await page.keyboard.press('Escape');
      continue;
    }
    const d = await page.evaluate((t) => {
      const e = document.querySelector(`#deck .dkx[data-id="${t}"]`);
      const img = e?.querySelector('.dkmini img');
      return { rows: e?.querySelectorAll('.dkcan .dkrow').length ?? 0, asks: e?.querySelectorAll('.dkcan .dkrow[data-act="ask"]').length ?? 0, dyk: e?.querySelector('.dkdyk')?.textContent ?? '', open: e?.querySelector('.dkopen')?.textContent ?? '', pic: img?.getAttribute('src') ?? '' };
    }, id);
    if (d.rows < 3 || d.asks < 2 || !/^Did you know/i.test(d.dyk) || d.open !== `Open ${s.name}` || d.pic !== `/deck/${id}.jpg`) problems.push(`[deck ${id}] ${JSON.stringify(d)} (want three YOU CAN lines, two of them things to ask, a DID YOU KNOW, "Open ${s.name}" and its picture)`);
    await until(page, (t) => document.querySelector(`#deck .dkx[data-id="${t}"] .dkmini img`)?.complete && !document.querySelector(`#deck .dkx[data-id="${t}"] .dkmini.none`), id, 6000, `[deck ${id}] its picture did not load`);
    await page.click(`#deck .dkx[data-id="${id}"] .dkopen`);
    await until(page, (t) => document.body.dataset.tab === t && !document.querySelector('#deck.on'), id, 8000, async () => `[deck ${id}] OPEN did not open it (on ${await tabNow(page)})`);
  }

  // ---- from the jump bar: by its name, and by a plain word from what it does
  for (const [id, s] of Object.entries(NEW)) {
    for (const words of [s.name.toLowerCase(), s.word]) {
      await go(page, 'core', 500);
      await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
      await page.keyboard.press('Control+k');
      await page.waitForSelector('#palette.on input', { timeout: 5000 }).catch(() => problems.push('[jump bar] it did not open'));
      await page.fill('#palette input', words);
      await page.waitForTimeout(250);
      const hit = page.locator('#palette .it', { has: page.locator('span', { hasText: new RegExp(`^${s.name}$`) }) }).first();
      if (!(await hit.count())) {
        problems.push(`[jump bar] "${words}" does not find ${s.name}: ${(await page.$$eval('#palette .it span', (x) => x.map((e) => e.textContent))).join(' | ')}`);
        await page.keyboard.press('Escape');
        continue;
      }
      await hit.click();
      await until(page, (t) => document.body.dataset.tab === t, id, 6000, async () => `[jump bar] "${words}" → ${s.name} did not open it (on ${await tabNow(page)})`);
    }
  }
  await ctx.close();
}

// ===================================================================== 2b. the fourteen at 440 × 956, each on its first page
{
  const W = PHONE.width;
  const { ctx, page } = await open(PHONE);
  for (const id of Object.keys(NEW)) {
    const at = `[${W} ${id}]`;
    await go(page, id, 600);
    const ok = await until(page, (t) => {
      const shown = [...document.querySelectorAll(`#pg-${t} .pn`)].filter((p) => !p.hidden);
      return document.body.dataset.tab === t && shown.length > 0 && shown.every((p) => p.querySelector(':scope > .bd')?.childElementCount && !p.querySelector('.sheetwait'));
    }, id, 15000, async () => `${at} did not open on its first page drawn (${JSON.stringify(await sheetState(page, id))})`);
    if (!ok) continue;
    await heroSaid(page, id, at);
    await page.waitForTimeout(400);
    await settle(page);
    const shown = `#pg-${id} .pn:not([hidden])`;
    for (const x of await sideways(page, `${shown} *, #pg-${id} .secpills, #pg-${id} .hero *`)) problems.push(`${at} sticks out sideways: ${x}`);
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) problems.push(`${at} the page scrolls sideways`);
    for (const u of await unnamed(page, shown)) problems.push(`${at} a control with no name: ${u}`);
    for (const t of await small(page, shown)) problems.push(`${at} under 44 pt: ${t}`);
    await page.screenshot({ path: `${out}/tabs-440-${id}.png` });
  }
  await ctx.close();
}

// ===================================================================== 3. a link opens them: ?open=<screen>, and ?do=open:<screen>
// (a screen from each area here, each way; every one of the fourteen is held to both by the brain's test of the links,
// apps/edge/test/resta.test.mjs, so this run stays inside its time)
{
  const { ctx, page } = await open(PHONE);
  for (const [i, id] of ['kitchen', 'coach', 'house', 'social'].entries()) {
    const q = i % 2 ? `?do=open:${id}` : `?open=${id}`;
    await page.goto(`${base}/${q}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
    await until(page, (t) => document.body.dataset.tab === t, id, 10000, async () => `[link] ${q} did not open ${id} (on ${await tabNow(page)})`);
  }
  await ctx.close();
}

// ===================================================================== 4. the chat's doors still open the sheets
{
  const W = PHONE.width;
  const { ctx, page } = await open(PHONE);
  /** Say `words` in the chat; the first reply after his message (the latest one he said, so nothing earlier can count). */
  const say = async (words, re, why) => {
    await go(page, 'core', 600);
    // the conversation open (its log, where a reply's chips are)
    if (!(await page.evaluate(() => !!document.querySelector('.hud.core.logopen')))) await page.locator('.logbtn:visible').first().click().catch(() => undefined);
    await page.waitForFunction(() => !!document.querySelector('.hud.core.logopen'), null, { timeout: 8000 }).catch(() => problems.push('[chat] the conversation did not open'));
    await page.waitForSelector('#cin', { state: 'visible', timeout: 15000 });
    await page.fill('#cin', words);
    await page.press('#cin', 'Enter');
    const ok = await until(page, ([w, src]) => {
      const all = [...document.querySelectorAll('#pg-core .msg')];
      const me = all.map((m) => m.classList.contains('me') && (m.textContent ?? '').includes(w)).lastIndexOf(true);
      return me >= 0 && all.slice(me + 1).some((m) => !m.classList.contains('me') && new RegExp(src, 'i').test(m.textContent ?? ''));
    }, [words, re.source], 30000, why);
    return ok;
  };
  // the home pack: the bins answered in the chat with no model, its chip opens the HOME sheet on its BINS page
  if (await say('when are the bins?', /bin/, '[chat] "when are the bins?" had no answer about the bins')) {
    const chip = page.locator('#pg-core .msg:not(.me) :is(button, a):visible', { hasText: /^Open the HOME sheet$/i }).last();
    if (!(await chip.count())) problems.push('[chat] the bins answer has no chip to open the HOME sheet');
    else {
      await chip.click({ timeout: 8000 }).catch(() => problems.push('[chat] the chip to open the HOME sheet could not be tapped'));
      await until(page, () => !!document.querySelector('.modal .pk[data-pack="homeadmin"][data-screen="bins"]') && window.__ghosty?.homeadmin?.open === 'bins', null, 10000, '[chat] the chip did not open the HOME sheet on its BINS page');
      await page.screenshot({ path: `${out}/tabs-door-bins.png` });
      await page.evaluate(() => document.querySelector('.modal .mhead button')?.click());
    }
  }
  // the coach's typing test: its sheet, on TYPING
  if (await say('typing test', /typing test is open/, '[chat] "typing test" did not say the typing test is open')) {
    await until(page, () => !!document.querySelector('.modal .pk.coach') && window.__ghosty?.coach?.open === 'typing', null, 10000, '[chat] "typing test" did not open the coach’s sheet on TYPING');
    await page.screenshot({ path: `${out}/tabs-door-typing.png` });
    await page.evaluate(() => document.querySelector('.modal .mhead button')?.click());
  }
  // the converter: its sheet
  if (await say('convert this to PDF', /converter is open/, '[chat] "convert this to PDF" did not say the converter is open')) {
    await until(page, () => !!document.querySelector('.modal .cvsheet') && window.__ghosty?.convert?.open === true, null, 10000, '[chat] "convert this to PDF" did not open the converter’s sheet');
    await page.screenshot({ path: `${out}/tabs-door-convert.png` });
    await page.evaluate(() => document.querySelector('.modal .mhead button')?.click());
  }
  if ((await page.evaluate(() => window.__asked ?? [])).length) problems.push(`[${W} chat] the doors asked for the camera, the microphone or the position unasked`);
  await ctx.close();
}

// ===================================================================== 5. the television: the bar standing up on the left, seven areas
{
  const { ctx, page } = await open(TV, { tv: true });
  await until(page, () => window.__ghosty?.tv?.on === true && document.body.classList.contains('tv'), null, 15000, '[tv] TV mode did not come on');
  await go(page, 'area-see', 1200);
  const bar = await page.evaluate(() => ({
    areas: [...document.querySelectorAll('#dock .tabcap button[data-area]')].map((b) => { const r = b.getBoundingClientRect(); const s = b.querySelector('span'); return { id: b.dataset.area, w: r.width, h: r.height, top: r.top, bottom: r.bottom, left: r.left, cut: !s || s.scrollWidth > s.clientWidth + 1 || s.getBoundingClientRect().right > r.right + 0.5 || s.getBoundingClientRect().left < r.left - 0.5 }; }),
    me: !!document.querySelector('#top .you[data-area="me"]'),
    h: innerHeight,
  }));
  if (bar.areas.map((a) => a.id).join(',') !== 'ask,see,make,learn,plan,life' || !bar.me) problems.push(`[tv] the bar holds ${bar.areas.map((a) => a.id).join(', ')} (want the six and Me)`);
  for (const a of bar.areas) {
    if (a.w < 56 || a.h < 56) problems.push(`[tv] the ${a.id} button is ${Math.round(a.w)}×${Math.round(a.h)} (under 56 pt)`);
    if (a.top < 0 || a.bottom > bar.h || a.left < 0) problems.push(`[tv] the ${a.id} button is off the screen (${Math.round(a.top)}–${Math.round(a.bottom)} of ${bar.h})`);
    if (a.cut) problems.push(`[tv] the ${a.id} label is cut`);
  }
  // the d-pad's Enter on Life opens its hub, every one of its eight cards there
  await page.focus('#dock .tabcap button[data-area="life"]');
  await page.keyboard.press('Enter');
  await until(page, () => document.body.dataset.tab === 'area-life' && document.querySelectorAll('#pg-area-life .hubgrid > .hubtile').length === 8, null, 8000, async () => `[tv] Enter on Life did not open its hub with its eight cards (on ${await tabNow(page)})`);
  // the bar's capsule holds its six (none spilling out of it), and the hub's cards start clear of the bar
  const fit = await page.evaluate(() => {
    const cap = document.querySelector('#dock .tabcap').getBoundingClientRect();
    const btns = [...document.querySelectorAll('#dock .tabcap button')].map((b) => b.getBoundingClientRect());
    const card = document.querySelector('#pg-area-life .hubgrid > .hubtile')?.getBoundingClientRect();
    return { spill: btns.filter((b) => b.top < cap.top - 0.5 || b.bottom > cap.bottom + 0.5).length, capRight: cap.right, cardLeft: card?.left ?? 0 };
  });
  if (fit.spill) problems.push(`[tv] ${fit.spill} of the bar's buttons spill out of its capsule`);
  if (fit.cardLeft < fit.capRight) problems.push(`[tv] the hub's first card runs under the bar (card at ${Math.round(fit.cardLeft)}, the bar ends at ${Math.round(fit.capRight)})`);
  await page.screenshot({ path: `${out}/tabs-tv-life.png` });
  await ctx.close();
}

// ======================================================================== THE FINDING RULE, ON A PHONE (BRIEF-SHELL pass 1; OWNER-ISSUES 143)
// "recents and favourites in two taps, everything else in three taps or one typed word": eight screens walked from Home by real
// taps and counted (apps/edge/test/finding.test.mjs holds the rule for every screen), the jump bar's open time with FAVOURITES in it,
// and FAVOURITES themselves: a long press pins from a hub card, a jump-bar row and a deck card, the pin is the first row, two taps from
// Home, the deck opens on the group he left.
{
  const { ctx, page } = await open(PHONE);
  let taps = 0;
  const tap = async (sel, wait = 700) => {
    taps++;
    // (a card with a meter that is always drawing is never "stable" for Playwright's wait: after three seconds the finger goes down on it anyway, as a person's would)
    await page.click(sel, { timeout: 3000 }).catch(() => page.click(sel, { timeout: 5000, force: true })).catch((e) => problems.push(`[finding] could not tap ${sel}: ${e.message.split('\n').filter((l) => /intercepts|not visible|outside/.test(l)).join(' ').slice(0, 200) || e.message.split('\n')[0]}`));
    await page.waitForTimeout(wait);
  };
  const bar = (a) => `#dock .tabcap button[data-area="${a}"]`;
  const card = (a, id) => `#pg-area-${a} .hubtile[data-id="${id}"]`;
  const WALK = {
    brief: { want: 'brief', taps: [bar('ask'), card('ask', 'brief')] },
    eye: { want: 'eye', taps: [bar('see'), card('see', 'eye')] },
    gym: { want: 'gym', taps: [bar('learn'), card('learn', 'gym')] },
    agenda: { want: 'agenda', taps: [bar('plan'), card('plan', 'agenda')] },
    money: { want: 'money', taps: [bar('life'), card('life', 'money')] },
    house: { want: 'house', taps: [bar('make'), card('make', 'house')] },
    memory: { want: 'memory', taps: ['#top .you', '#mesheet .merow[data-id="memory"]'] },
    // THE LOOK: the Me sheet, Settings (which opens on Appearance, where its row is), the row: three taps
    look: { want: 'look', taps: ['#top .you', '#mesheet .merow[data-id="settings"]', '#pg-settings .pn[data-row][data-go="look"] > h3'] },
  };
  for (const [id, w] of Object.entries(WALK)) {
    await go(page, 'core', 700);
    taps = 0;
    for (let i = 0; i < w.taps.length; i++) {
      if (id === 'look' && i === 2) await page.waitForSelector(w.taps[2], { state: 'visible', timeout: 8000 }).catch(() => problems.push('[finding] THE LOOK has no row on Settings as it opens'));
      await tap(w.taps[i], i === w.taps.length - 1 ? 900 : 700);
    }
    const at = await tabNow(page);
    if (at !== w.want) problems.push(`[finding] ${id}: ${w.taps.length} taps from Home landed on ${at}`);
    if (taps > 3) problems.push(`[finding] ${id} took ${taps} taps (the rule is three)`);
    console.log(`finding: ${id} in ${taps} taps from Home`);
  }
  // one typed word: the search, the word, the row
  for (const [word, want] of [['money', 'money'], ['workbench', 'workbench'], ['threats', 'threats']]) {
    await go(page, 'core', 600);
    await page.click('#top .cmd');
    await page.fill('#palette input', word);
    await page.waitForTimeout(250);
    const rowAt = await page.$$eval('#palette .it', (rs, w) => rs.findIndex((r) => r.querySelector('small')?.textContent === 'GO' && r.textContent.toLowerCase().includes(w)), word);
    if (rowAt < 0 || rowAt > 5) problems.push(`[finding] "${word}" typed puts its row at ${rowAt} (the first screenful is six)`);
    else await page.locator('#palette .it').nth(rowAt).click();
    await page.waitForTimeout(700);
    if ((await tabNow(page)) !== want) problems.push(`[finding] the typed word "${word}" did not open ${want}`);
  }

  // ---- FAVOURITES: a long press on a hub card pins it
  await go(page, 'area-learn', 800);
  const hold = async (sel, ms = 700) => {
    await page.locator(sel).first().scrollIntoViewIfNeeded().catch(() => undefined);
    const b = await page.locator(sel).first().boundingBox();
    if (!b) return problems.push(`[pins] nothing to press at ${sel}`);
    await page.mouse.move(b.x + b.width / 2, b.y + 24);
    await page.mouse.down();
    await page.waitForTimeout(ms);
    await page.mouse.up();
    await page.waitForTimeout(250);
  };
  await hold(card('learn', 'gym'));
  if (!(await page.locator('#pinsheet').count())) problems.push('[pins] a long press on a hub card opened no pin sheet');
  if ((await tabNow(page)) !== 'area-learn') problems.push(`[pins] the long press opened a screen (${await tabNow(page)}) under the sheet`);
  const key = await page.evaluate(() => { const b = document.querySelector('#pinsheet .g-key.fill'); const r = b?.getBoundingClientRect(); return { word: b?.textContent ?? '', w: r?.width ?? 0, h: r?.height ?? 0 }; });
  if (key.word !== 'PIN' || key.w < 43.5 || key.h < 43.5) problems.push(`[pins] the sheet's key reads "${key.word}" at ${Math.round(key.w)}×${Math.round(key.h)} (want PIN, 44 pt)`);
  await page.screenshot({ path: `${out}/tabs-pinsheet.png` });
  await page.click('#pinsheet .g-key.fill');
  await page.waitForTimeout(400);
  if (await page.locator('#pinsheet').count()) problems.push('[pins] PIN left the sheet open');
  if ((await page.evaluate(() => window.__ghosty.pins.favourites().join(','))) !== 'gym') problems.push('[pins] gym was not pinned');
  if (!(await page.locator(`${card('learn', 'gym')}[data-pinned="true"] .pinmark`).count())) problems.push('[pins] the pinned card carries no PINNED mark');
  await page.screenshot({ path: `${out}/tabs-pinned-card.png` });
  // the jump bar: open time with FAVOURITES in it (the speed habit: under 300 ms), the pin first, two taps from Home
  await go(page, 'core', 700);
  taps = 0;
  taps++;
  // (five opens, the median: this runs with software WebGL drawing Home behind it, which one frame can stall for a long time)
  const times = [];
  for (let i = 0; i < 5; i++) {
    times.push(await page.evaluate(() => new Promise((r) => {
      const t = performance.now();
      document.querySelector('#top .cmd').click();
      requestAnimationFrame(() => requestAnimationFrame(() => r(performance.now() - t)));
    })));
    if (i < 4) {
      await page.click('#palette .pcancel');
      await page.waitForTimeout(400);
    }
  }
  const openMs = [...times].sort((x, y) => x - y)[2];
  console.log(`finding: the jump bar opens with FAVOURITES in ${Math.round(openMs)} ms (median of five: ${times.map((x) => Math.round(x)).join(', ')})`);
  if (openMs > 300) problems.push(`[speed] the jump bar took ${Math.round(openMs)} ms to open with FAVOURITES, median of five (the budget is 300)`);
  const rows = await page.$$eval('#palette .it, #palette .grp', (els) => els.map((e) => (e.classList.contains('grp') ? `#${e.textContent}` : `${e.querySelector('small')?.textContent}:${e.textContent.replace(/^\s*(FAVOURITES|RECENT|GO)/, '')}`)));
  if (rows[0] !== '#Favourites' || !/^FAVOURITES:.*Gym/i.test(rows[1] ?? '')) problems.push(`[pins] the jump bar's first rows are ${JSON.stringify(rows.slice(0, 3))} (want Favourites, then Gym)`);
  await page.screenshot({ path: `${out}/tabs-jumpbar-favourites.png` });
  await page.locator('#palette .it').first().click();
  taps++;
  await page.waitForTimeout(800);
  if ((await tabNow(page)) !== 'gym' || taps !== 2) problems.push(`[pins] the pin did not open Gym in two taps (on ${await tabNow(page)}, ${taps} taps)`);
  // a long press on a recent pins it too, in his order; a long press on a pin unpins it
  for (const t of ['agenda', 'money']) await go(page, t, 500);
  await go(page, 'core', 600);
  await page.click('#top .cmd');
  await page.waitForTimeout(300);
  const recent = page.locator('#palette .it', { has: page.locator('small', { hasText: 'RECENT' }) }).first();
  await hold('#palette .it:has(small:text("RECENT"))');
  if (!(await page.locator('#pinsheet').count())) problems.push('[pins] a long press on a jump-bar recent opened no pin sheet');
  else {
    await page.click('#pinsheet .g-key.fill');
    await page.waitForTimeout(400);
  }
  void recent;
  const two = await page.evaluate(() => window.__ghosty.pins.favourites());
  if (two.length !== 2 || two[0] !== 'gym') problems.push(`[pins] the pins are ${two.join(', ')} (want gym, then the recent, in his order)`);
  await hold('#palette .it:has(small:text("FAVOURITES"))');
  const un = await page.evaluate(() => document.querySelector('#pinsheet .g-key.fill')?.textContent ?? '');
  if (un !== 'UNPIN') problems.push(`[pins] a long press on a pin offers "${un}" (want UNPIN)`);
  await page.click('#pinsheet .g-key.fill').catch(() => undefined);
  await page.waitForTimeout(400);
  if ((await page.evaluate(() => window.__ghosty.pins.favourites().length)) !== 1) problems.push('[pins] UNPIN did not take the pin away');
  // six at most
  const six = await page.evaluate(() => { const p = window.__ghosty.pins; return ['agenda', 'money', 'body', 'kitchen', 'work', 'eye'].map((x) => p.setFavourite(x, true)).concat(p.setFavourite('radio', true)); });
  if (six.slice(0, 5).includes(false) || six.at(-1) !== false) problems.push(`[pins] six at most: ${JSON.stringify(six)}`);
  // kept in ghosty.settings (the daily backup carries it)
  await page.waitForTimeout(700);
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.settings') ?? '{}').favourites ?? []);
  if (kept.length !== 6) problems.push(`[pins] ghosty.settings keeps ${kept.length} pins (want 6)`);
  await page.click('#palette .pcancel').catch(() => undefined);
  await page.waitForTimeout(300);
  await page.evaluate(() => { for (const x of window.__ghosty.pins.favourites()) window.__ghosty.pins.setFavourite(x, false); });

  // ---- the deck: a long press pins a card; it opens on the group he left
  await go(page, 'core', 600);
  await openDeck(page);
  await hold('#deck .dkcard[data-id="agenda"]');
  if (!(await page.locator('#pinsheet').count())) problems.push('[pins] a long press on a deck card opened no pin sheet');
  else {
    await page.click('#pinsheet .g-key.fill');
    await page.waitForTimeout(400);
    if (!(await page.locator('#deck .dkcard[data-id="agenda"][data-pinned="true"]').count())) problems.push('[pins] the deck card did not show its pin after PIN');
  }
  await page.locator('#deck .dkcard[data-id="money"]').click();
  await page.waitForTimeout(400);
  await page.click('#deck .dkx[data-id="money"] .dkopen');
  await until(page, () => document.body.dataset.tab === 'money', null, 6000, '[deck] Open on the Money card did not open it');
  await openDeck(page);
  await page.waitForTimeout(500);
  const left = await page.evaluate(() => {
    const sec = document.querySelector('#deck .dkgroup[data-group="Life"]');
    const sc = document.querySelector('#deck .dk');
    return { group: window.__ghosty.deck.group, off: sec && sc ? Math.round(sec.getBoundingClientRect().top - sc.getBoundingClientRect().top) : null };
  });
  if (left.group !== 'Life' || left.off == null || Math.abs(left.off) > 60) problems.push(`[deck] the deck did not open on the group he left (Life): ${JSON.stringify(left)}`);
  await page.screenshot({ path: `${out}/tabs-deck-remembers.png` });
  await page.keyboard.press('Escape');
  await ctx.close();
}


// ======================================================================== GLASS IS UNCHANGED (BRIEF-SHELL-2): its shell as it was, its DOM shape held
{
  const { ctx, page } = await open(PHONE);
  await go(page, 'area-learn', 1400);
  const g = await page.evaluate(() => ({
    housed: document.body.classList.contains('housed'), world: document.documentElement.dataset.world,
    keys: [...document.querySelectorAll('#dock .tabcap button')].filter((b) => getComputedStyle(b).display !== 'none').map((b) => b.querySelector('span')?.textContent),
    kick: getComputedStyle(document.querySelector('#dock .housekick')).display, ask: getComputedStyle(document.querySelector('#dock .houseask')).display,
    cards: [...document.querySelectorAll('#pg-area-learn .hubgrid > .hubtile')].filter((e) => e.getClientRects().length).length, room: getComputedStyle(document.querySelector('#pg-area-learn .scanroom')).display,
    plan: !!document.querySelector('#plan'), headstamp: getComputedStyle(document.querySelector('#top .headstamp')).display, you: !!document.querySelector('#top .you'),
  }));
  if (g.world !== 'glass' || g.housed) problems.push(`[glass] the world is ${g.world}, housed ${g.housed}`);
  if (g.keys.join(',') !== 'Ask,See,Make,Learn,Plan,Life') problems.push(`[glass] the bar's words are ${g.keys.join(',')} (want Ask, See, Make, Learn, Plan, Life: six keys, no Me)`);
  if (g.kick !== 'none' || g.ask !== 'none' || g.headstamp !== 'none' || g.plan) problems.push(`[glass] the house's parts are drawn: ${JSON.stringify(g)}`);
  if (g.cards !== 8 || g.room !== 'none') problems.push(`[glass] the Learn hub shows ${g.cards} cards (want its 8), the room is ${g.room}`);
  await go(page, 'settings', 900);
  if ((await page.evaluate(() => getComputedStyle(document.querySelector('#pg-settings .scanset')).display)) !== 'none' || !(await page.locator('#pg-settings .secpills .secpill').first().isVisible())) problems.push('[glass] Settings is not today\'s list with its pills');
  await go(page, 'core', 800);
  await page.click('#top .cmd');
  if (!(await page.locator('#palette.on:not(.scanjump) .bx .prow').count())) problems.push('[glass] the palette is not today\'s');
  await page.keyboard.press('Escape');
  await ctx.close();
}

await browser.close();
if (problems.length) {
  console.error(`FAIL tabs\n${[...new Set(problems)].join('\n')}`);
  process.exit(1);
}
console.log('tabs: OK (seven areas, Life on the bar at 440, 390 and on a television, every label whole and every button a finger’s; every hub with every tool of its area as a card, the last reachable by a scroll; the fourteen new screens each opened from its card, Every screen, the jump bar by name and by a plain word, and a link; their pages drawn under their pills when picked and put away when left, nothing sideways at 390, every control named and 44 pt, no camera, microphone or position asked; the chat’s doors still open the HOME, coach and converter sheets)');
