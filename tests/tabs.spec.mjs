// EVERY FEATURE A TAB (BRIEF-TABS; OWNER-ISSUES 119, his words: "can't we add tabs for everything we have like all the tabs we
// already have"), on his iPhone 18 Pro Max (440 × 956), a 390 × 844 phone and a television (1,920 × 1,080, TV mode):
//  - the tab bar holds the seven areas: Ask, See, Make, Learn, Plan and LIFE on the bar (Life between Plan and Me), Me at the
//    top; every label whole and readable, every button a finger's (44 pt; 56 on the television, where the bar stands up on
//    the left and the d-pad's Enter opens Life);
//  - every area's hub lists every tool of its area as a card, and its last card is reachable by a scroll, clear of the bar
//    (Me's are the Me sheet's rows, SOCIAL among them);
//  - each of the fourteen new screens (LIFE's eight packs; LEARN's learning pack and coach; MAKE's converter, documents and
//    house; ME's social self) opens from its card, from Every screen and from the jump bar (by its name, and by a plain
//    word from what it does), and from a link (?open=, ?do=open:); it shows its sheet's own pages under its pills, each page
//    drawn when its pill is picked; at 390 × 844 nothing sticks out sideways and every control is named for VoiceOver and
//    44 pt; opening a screen and its pages never starts the camera, the microphone or the phone's position;
//  - the chat's doors still open the sheets: "when are the bins?" answers with HOME's bins in the chat and its chip opens the
//    HOME sheet there; "typing test" opens the coach's sheet on TYPING; "convert this to PDF" the converter's sheet.
// The preview's brain is shared with the specs before this one: nothing here needs it fresh, every chat check waits for the
// reply to what this spec said, and nothing is left made.
//   BASE=http://localhost:8788 node tests/tabs.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, openDeck } from './nav.mjs';
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
  ask: ['core', 'brief', 'voice'], see: ['eye', 'lens'], make: ['studio', 'workshop', 'reverse', 'space', 'workbench', 'convert', 'docs', 'house'],
  learn: ['learn', 'arcade', 'gym', 'school', 'library', 'learning', 'coach'], plan: ['agenda', 'markets', 'threats', 'radio'],
  life: ['money', 'body', 'kitchen', 'people', 'work', 'creative', 'outside', 'homeadmin'],
};
/** Each new screen: its area, its name as the jump bar and the deck show it, a plain word it is found by, its pills and pages. */
const NEW = {
  money: { area: 'life', name: 'Money', word: 'statement', pills: [], pages: ['PASTE A STATEMENT'] },
  body: { area: 'life', name: 'Body', word: 'squats', pills: ['Reps', 'Run', 'Breathe', 'Stretch', 'Health', 'Water'], pages: ['COUNT MY REPS', 'RUNNING COACH', 'BREATHE', 'STRETCH SET', 'MY HEALTH WEEK', 'WATER TODAY'] },
  kitchen: { area: 'life', name: 'Kitchen', word: 'shopping list', pills: ['Timers', 'Shopping', 'Meal plan'], pages: ['TIMERS', 'SHOPPING LIST', 'MEAL PLAN'] },
  people: { area: 'life', name: 'People', word: 'gift ideas', pills: ['Your people', 'Group plan'], pages: ['YOUR PEOPLE', 'GROUP PLAN'] },
  work: { area: 'life', name: 'Work', word: 'interview', pills: ['To-do', 'Interview', 'Document'], pages: ['TO-DO', 'INTERVIEW PRACTICE', 'DOCUMENT'] },
  creative: { area: 'life', name: 'Creative', word: 'poster', pills: ['Music', 'Poster', 'Card', 'Comic', 'Logo', 'Palette'], pages: ['YOUR SONG', 'DRUM PADS', 'POSTER', 'BIRTHDAY CARD', 'COMIC STRIP', 'LOGO SKETCH', 'PALETTE'] },
  outside: { area: 'life', name: 'Outside', word: 'toilets', pills: ['Walk', 'Nearby', 'My car', 'Lost', 'Split'], pages: ['WALK', 'NEARBY', 'MY CAR', 'LOST', 'SPLIT'] },
  homeadmin: { area: 'life', name: 'Home', word: 'bins', pills: ['Due', 'Bins', 'Bills', 'Meter', 'Rooms'], pages: ['DUE', 'BINS', 'BILLS', 'METER', 'ROOMS'] },
  learning: { area: 'learn', name: 'Learning', word: 'first aid', pills: ['Words', 'Draw', 'Typing', 'Drills', 'First aid', 'Plan'], pages: ['WORDS', 'CARDS', 'DRAW', 'WRITING', 'TYPING', 'READING', 'MEMORY', 'MATHS', 'SPELLING', 'FIRST AID', 'PLAN', 'STREAKS'] },
  coach: { area: 'learn', name: 'Coach', word: 'guitar', pills: ['Tuner', 'Lessons', 'Typing', 'Draw', 'Words'], pages: ['TUNER', 'LESSONS', 'TYPING', 'DRAW', 'WORDS'] },
  social: { area: 'me', name: 'Social', word: 'bluesky', pills: ['Waiting', 'Accounts', 'Origin'], pages: ['WAITING FOR YOUR APPROVE', 'SENT TODAY', 'BLUESKY', 'MASTODON', 'DISCORD', 'TELEGRAM CHANNEL', 'FATHER AND THE ORIGIN'] },
  convert: { area: 'make', name: 'Convert', word: 'pdfs', pills: [], pages: ['CONVERT'] },
  docs: { area: 'make', name: 'Documents', word: 'landlord', pills: [], pages: ['DOCUMENTS'] },
  house: { area: 'make', name: 'House', word: 'heating', pills: [], pages: ['HOUSE'] },
};

/** A phone (or a television) with his settings, paired; every ask for the camera, the microphone or the position counted. */
async function open(viewport, { tv = false, path = '' } = {}) {
  const ctx = await browser.newContext({ viewport, screen: viewport, ...UK, ...(tv ? {} : { deviceScaleFactor: 2, hasTouch: true, isMobile: true }), serviceWorkers: 'block' });
  await ctx.addInitScript(([k, tv]) => {
    localStorage.setItem('ghosty.ownerKey', k);
    if (!localStorage.getItem('ghosty.settings')) localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Boss', home: { name: 'Birmingham', lat: 52.4862, lon: -1.8904 }, units: 'metric' }));
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
  }, [KEY, tv]);
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
  for (const [area, ids] of Object.entries(AREA_TOOLS)) {
    await go(page, `area-${area}`, 1200);
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
  // Me: the avatar's sheet, its rows the area's screens, SOCIAL among them
  await go(page, 'core', 800);
  await page.click('#top .you');
  await page.waitForSelector('#mesheet .merow', { timeout: 5000 }).catch(() => problems.push(`[${W}] the Me sheet did not open`));
  const rows = await page.$$eval('#mesheet .merow', (rs) => rs.map((r) => r.dataset.id));
  for (const id of ['memory', 'settings', 'system', 'links', 'abilities', 'social']) if (!rows.includes(id)) problems.push(`[${W}] the Me sheet has no ${id} row: ${rows.join(', ')}`);
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
      const card = page.locator(`#pg-area-${s.area} .hubtile[data-id="${id}"]`);
      await card.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => undefined);
      await card.click({ timeout: 5000 }).catch(() => problems.push(`${at} has no card on the ${s.area} hub`));
    }
    await until(page, (t) => document.body.dataset.tab === t && window.__ghosty?.sheetpages?.[t]?.ready, id, 10000, async () => `${at} its card did not open it (on ${await tabNow(page)})`);
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

// ===================================================================== 3. a link opens each: ?open=<screen>, and ?do=open:<screen>
{
  const { ctx, page } = await open(PHONE);
  for (const [i, id] of Object.keys(NEW).entries()) {
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

await browser.close();
if (problems.length) {
  console.error(`FAIL tabs\n${[...new Set(problems)].join('\n')}`);
  process.exit(1);
}
console.log('tabs: OK (seven areas, Life on the bar at 440, 390 and on a television, every label whole and every button a finger’s; every hub with every tool of its area as a card, the last reachable by a scroll; the fourteen new screens each opened from its card, Every screen, the jump bar by name and by a plain word, and a link; their pages drawn under their pills when picked and put away when left, nothing sideways at 390, every control named and 44 pt, no camera, microphone or position asked; the chat’s doors still open the HOME, coach and converter sheets)');
