// The Memory tab's ME and DIARY panels: the profile drawn from the brain (stubbed first, exact
// values) — ME first on his side, headed in his words, where it came from and when, the title's
// count —, a line added and removed, a diary entry opened (its day in words), REFLECT NOW's toast,
// Memory's sentences in one voice, every target 44 pt — then, through
// the preview brain's scripted model, a real reflection over two things the owner said. Then the
// TIMELINE over the real brain: a fact said in chat shows with that chat as its source (which
// opens it), EDIT, LOCK (and the "Locked only" filter), FORGET and UNDO (back still locked), the
// kind filter and search; and PATTERNS: four evenings on one topic show with their evidence, and
// ✕ hides the pattern for good (still hidden after a reload); a row 26 deep forgotten with its UNDO
// on screen; offline: the title line says so and a FORGET says why nothing changed.
//   node tests/memory.spec.mjs [outDir]
import { isWebKit, launch, webkitNoise } from './browser.mjs';
import { DESKTOP, PHONE, UK, openSection } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const problems = [];

const profile = () => ({ summary: 'A bridge engineer in Kings Heath who likes flat whites.', sections: { about: ['bridge engineer'], likes: ['flat whites', 'rain on the window'], dislikes: [], people: ['Ann is my sister'], places: ['Kings Heath'], routines: [], goals: ['run a half marathon'], work: [], other: [] }, updatedAt: Date.now() });
const diary = [
  { heading: '2026-10-17', text: 'Today the owner told me about the race. We decided to train on Tuesdays. Follow up: a plan.', rid: 2 },
  { heading: '2026-10-16', text: 'A quiet day of questions about bridges.', rid: 1 },
];

async function run(name, viewport) {
  const ctx = await browser.newContext({ viewport, ...UK });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${name}] pageerror: ${e.message}`));
  const state = { profile: profile(), reflected: 0 };
  /** On the phone MEMORY is in sections (ui/sections.ts, one drawn at a time): show the part that holds what is checked next. */
  const sec = async (label) => {
    if (viewport.width >= 900) return false;
    await page.waitForSelector('#pg-memory .secpills .secpill', { state: 'visible', timeout: 10000 }).catch(() => undefined);
    return openSection(page, 'memory', label);
  };
  const stub = async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    // The timeline is the real brain's (checked below); ME ✕ forgets through it (POST /api/profile/item). PRINCIPLES are the brain's.
    if (url.pathname.startsWith('/api/profile/patterns/') || url.pathname === '/api/profile/principles') return route.continue();
    if (url.pathname === '/api/profile/timeline') return json({ items: [], patterns: [], forgotten: [] });
    if (url.pathname === '/api/profile/item') {
      const b = req.postDataJSON();
      for (const s of Object.keys(state.profile.sections)) state.profile.sections[s] = state.profile.sections[s].filter((x) => `p:${x.toLowerCase()}` !== b.id);
      return json({ item: null });
    }
    if (url.pathname === '/api/profile/reflect') {
      state.reflected++;
      return json({ ok: true, facts: ['runs on Tuesdays'], lines: [{ section: 'routines', text: 'trains on Tuesdays' }], diary: 'x', summary: state.profile.summary, profile: state.profile });
    }
    if (req.method() === 'GET') return json({ profile: state.profile, diary, lastReflect: Date.now() - 3600_000 });
    if (req.method() === 'POST') {
      const b = req.postDataJSON();
      state.profile.sections[b.section].push(b.text);
      return json({ profile: state.profile, added: true });
    }
    if (req.method() === 'DELETE') {
      state.profile.sections[url.searchParams.get('section')].splice(Number(url.searchParams.get('i')), 1);
      return json({ profile: state.profile, removed: true });
    }
    return route.continue();
  };
  await page.route('**/api/profile**', stub);
  await page.goto(base);
  await page.fill('#pair input', 'preview-owner-key-0123456789');
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
  // A run may follow another against the same preview brain: what an earlier run noticed is cleared first.
  await page.evaluate(() => fetch('/api/profile/patterns/clear', { method: 'POST', headers: { 'x-ghosty': '1', 'x-ghosty-key': 'preview-owner-key-0123456789', 'content-type': 'application/json' }, body: '{}' }));
  await page.evaluate(() => (location.hash = 'memory'));
  const me = page.locator('#pg-memory .pn.me');
  await me.waitFor({ state: 'attached', timeout: 10000 });
  await page.waitForFunction(() => document.querySelector('#pg-memory .pn.me')?.textContent?.includes('flat whites'), null, { timeout: 10000 }).catch(() => problems.push(`[${name}] the ME panel did not show the profile`));
  const text = (await me.textContent()) ?? '';
  if (!/A bridge engineer in Kings Heath/.test(text)) problems.push(`[${name}] no summary line in ME`);
  if (!/rain on the window/.test(text) || !/Ann is my sister/.test(text)) problems.push(`[${name}] ME is missing section lines: ${text.slice(0, 200)}`);
  // ME reads as his: the sections headed in his words (not "likes", "people"), where it came from and when
  const heads = await me.locator('.lab[data-section]').allTextContents();
  if (heads.join('|') !== 'Who you are|What you like|Your people|Places in your life|What you’re working towards') problems.push(`[${name}] ME's headings read: ${heads.join(' | ') || (await me.locator('.lab').allTextContents()).join(' | ')}`);
  if (!/From your own words · updated today/.test(text)) problems.push(`[${name}] ME does not say where it came from and when: ${text.slice(0, 160)}`);
  // the count under the title is everything known about him: his facts and the lines about him
  const known = await page.evaluate(async () => (await (await fetch('/api/memory', { headers: { 'x-ghosty': '1', 'x-ghosty-key': 'preview-owner-key-0123456789' } })).json()).facts.length);
  await page.waitForFunction((n) => document.querySelector('#pg-memory .sub')?.textContent?.startsWith(`${n} `), known + 6, { timeout: 5000 }).catch(() => undefined);
  const sub = (await page.locator('#pg-memory .sub').first().textContent()) ?? '';
  if (!sub.startsWith(`${known + 6} things I know about you`)) problems.push(`[${name}] the title says "${sub}", not ${known + 6} things (${known} facts and 6 lines)`);
  if (!/6 LINES/.test(text)) problems.push(`[${name}] ME status should count 6 lines: ${text.slice(0, 120)}`);
  await page.waitForTimeout(600); // the panes settle into place with a short animation
  // ME (who he is) comes first, above PATTERNS and the TIMELINE (in the page, and as the first pills on the phone), and starts on the first screen
  const order = await page.evaluate(() => {
    const at = (c) => document.querySelector(`#pg-memory .pn.${c}`);
    const before = (a, b) => !!a && !!b && !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    return { inOrder: before(at('me'), at('pats')) && before(at('pats'), at('tl')), meTop: at('me')?.getBoundingClientRect().top ?? -1, pills: [...document.querySelectorAll('#pg-memory .secpill')].map((b) => b.textContent).slice(0, 3).join(',') };
  });
  if (!order.inOrder) problems.push(`[${name}] ME, PATTERNS and the TIMELINE are not in that order in the page`);
  if (viewport.width < 900 && order.pills !== 'Me,Patterns,Timeline') problems.push(`[${name}] the first pills read "${order.pills}", not Me, Patterns, Timeline`);
  if (order.meTop > viewport.height - 200) problems.push(`[${name}] ME starts ${Math.round(order.meTop)} points down, below the first screen`);
  await page.screenshot({ path: `${out}/${name}-memory-me.png` });
  // one voice: Memory's own sentences speak as Ghosty ("I"), never of him in the third person ("he keeps it", "his memory")
  const voice = await page.$$eval('#pg-memory :is(.note, .empty, .placelist p)', (els) => els.map((e) => e.textContent ?? '').filter((t) => /\b(he|him|his)\b/i.test(t)));
  if (voice.length) problems.push(`[${name}] Memory speaks of Ghosty as "he": ${voice.join(' / ').slice(0, 300)}`);
  // add a line under ROUTINES (the "Add a memory…" row opens the form in a sheet)
  const addRow = page.locator('#pg-memory .addrow');
  const sheet = (await addRow.isVisible().catch(() => false)) ? (await addRow.click(), page.locator('.modal .memadd')) : me;
  if (await page.locator('.modal .memadd').count()) {
    // the sheet's fields sit inside its margins (they touched its edges)
    const gap = await page.evaluate(() => document.querySelector('.modal .memadd input').getBoundingClientRect().left - document.querySelector('.modal').getBoundingClientRect().left);
    if (gap < 16) problems.push(`[${name}] the Add a memory sheet's field is ${Math.round(gap)} points from the sheet's edge`);
  }
  await sheet.locator('select').selectOption('routines');
  await sheet.locator('input').fill('I run on Tuesdays');
  await sheet.locator('button:has-text("ADD")').click();
  await page.waitForFunction(() => document.querySelector('#pg-memory .pn.me')?.textContent?.includes('I run on Tuesdays'), null, { timeout: 8000 }).catch(() => problems.push(`[${name}] the added line did not appear`));
  await page.waitForTimeout(300);
  if (await page.locator('.modal .memadd').count()) problems.push(`[${name}] the Add a memory sheet stayed open after ADD`);
  if (!/ROUTINES/i.test((await me.textContent()) ?? '')) problems.push(`[${name}] the ROUTINES section did not appear`);
  // remove it again (the ✕ on its row, shown after Edit)
  const added = me.locator('.rw', { hasText: 'I run on Tuesdays' });
  const edit = page.locator('#pg-memory .editbtn');
  const editing = await edit.isVisible().catch(() => false);
  if (editing) await edit.click();
  await added.locator('.del').click();
  await page.waitForFunction(() => !document.querySelector('#pg-memory .pn.me')?.textContent?.includes('I run on Tuesdays'), null, { timeout: 8000 }).catch(() => problems.push(`[${name}] the removed line is still there`));
  if (editing) await edit.click(); // Done
  // every target he taps is at least 44 pt (CSS points: the page's own zoom aside)
  const small = async () => page.$$eval('#pg-memory :is(button, select, input, summary)', (els) => els.filter((e) => e.offsetParent && e.getClientRects().length && parseFloat(getComputedStyle(e).height) < 44 && getComputedStyle(e).height !== 'auto').map((e) => `${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 24)} (${getComputedStyle(e).height})`));
  // (on the phone each part is a section: every one is looked at in turn)
  const tiny = [];
  for (const label of ['Me', 'Patterns', 'Timeline']) {
    await sec(label);
    tiny.push(...(await small()));
  }
  await sec('Me');
  // the DIARY (other column on phones): newest first, opens in a modal; REFLECT NOW toasts what changed
  const narrow = viewport.width < 900;
  await sec('Diary');
  const dp = page.locator('#pg-memory .pn', { has: page.locator('h3:has-text("DIARY")') });
  await dp.waitFor({ state: 'visible', timeout: 8000 });
  // the other side opens on the DIARY (on the phone it has its own pill, "Diary")
  const firstRight = await page.evaluate(() => document.querySelector('#pg-memory .col.cR > .pn h3')?.textContent ?? '');
  if (!/DIARY/i.test(firstRight)) problems.push(`[${name}] the other side opens on "${firstRight}", not the DIARY`);
  if (narrow && !(await page.locator('#pg-memory .secpill', { hasText: /^Diary$/ }).count())) problems.push(`[${name}] there is no Diary pill`);
  const rows = dp.locator('.rw');
  await rows.first().waitFor({ state: 'attached', timeout: 8000 }).catch(() => undefined);
  const first = (await rows.first().innerText()) ?? ''; // (as shown: its capitals too)
  // newest first, its day as he would say it (never "2026-10-17")
  if (!/Saturday 17 October/.test(first) || /2026-10-17/.test(first)) problems.push(`[${name}] the diary's first row is not "Saturday 17 October", newest first: "${first.slice(0, 80)}"`);
  await rows.first().click();
  const modalText = await page.locator('.modal .mbody').textContent({ timeout: 5000 }).catch(() => '');
  if (!/We decided to train on Tuesdays/.test(modalText ?? '')) problems.push(`[${name}] the diary entry did not open in a modal`);
  const modalTitle = (await page.locator('.modal').first().textContent().catch(() => '')) ?? '';
  if (!/Diary · Saturday 17 October/.test(modalTitle)) problems.push(`[${name}] the diary page's title reads "${modalTitle.slice(0, 60)}"`);
  await page.screenshot({ path: `${out}/${name}-memory-diary.png` });
  await page.keyboard.press('Escape');
  for (const label of ['Diary', 'Chat']) {
    await sec(label);
    tiny.push(...(await small()));
  }
  await sec('Diary');
  if (tiny.length) problems.push(`[${name}] targets under 44 pt: ${[...new Set(tiny)].join(', ')}`);
  await dp.locator('button:has-text("REFLECT NOW")').click();
  await page.waitForFunction(() => /Reflected: 1 new fact, 1 line about you/.test(document.querySelector('#toasts')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => problems.push(`[${name}] no toast after REFLECT NOW`));
  if (state.reflected !== 1) problems.push(`[${name}] REFLECT NOW called the brain ${state.reflected} times`);
  await page.unroute('**/api/profile**', stub);

  // the real thing: two things said in chat, then a reflection by the preview brain's scripted model
  await sec('Me');
  await page.evaluate(() => (location.hash = 'core'));
  if (narrow) await page.click('.logbtn');
  for (const line of ['I like flat whites', 'I like walks in Kings Heath']) {
    await page.fill('#cin', line);
    await page.keyboard.press('Enter');
    await page.waitForFunction((l) => document.body.innerText.includes(`Mock reply to: ${l.toLowerCase()}`), line, { timeout: 10000 }).catch(() => problems.push(`[${name}] no reply to "${line}"`));
  }
  if (narrow) await page.click('.logbtn');
  await page.evaluate(() => (location.hash = 'memory'));
  await page.waitForTimeout(600);
  await sec('Diary');
  await dp.locator('button:has-text("REFLECT NOW")').click();
  await page.waitForFunction(() => /Reflected: /.test(document.querySelector('#toasts')?.textContent ?? ''), null, { timeout: 15000 }).catch(() => problems.push(`[${name}] the real reflection gave no toast`));
  await sec('Me');
  await page.waitForFunction(() => /flat whites/.test(document.querySelector('#pg-memory .pn.me')?.textContent ?? ''), null, { timeout: 10000 }).catch(() => problems.push(`[${name}] the real reflection did not put "flat whites" in the profile`));
  const real = (await me.textContent()) ?? '';
  if (!/walks in Kings Heath/.test(real)) problems.push(`[${name}] the second thing said is missing from the profile: ${real.slice(0, 200)}`);
  await page.screenshot({ path: `${out}/${name}-memory-reflected.png` });

  // ---- TIMELINE and PATTERNS (features/memory/timeline.ts over the preview brain's memories.ts) ----
  // A fact said in a chat: the timeline shows it with that chat as its source, and the source opens it.
  // Words of this run only (letters), so a run after another against the same preview brain finds its own.
  const word = () => Array.from({ length: 7 }, () => 'bcdfghjklmnpqrstvwxz'[Math.floor(Math.random() * 20)]).join('');
  const thing = `my ${name === 'desktop' ? 'bike' : 'kettle'} is ${word()}`;
  const topic = word();
  await page.evaluate(() => (location.hash = 'core'));
  if (narrow) await page.click('.logbtn');
  await page.fill('#cin', `remember ${thing}`);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => /Saved \(id|Mock|remember/i.test(document.querySelector('#pg-core .log')?.textContent ?? ''), null, { timeout: 10000 }).catch(() => undefined);
  await page.waitForTimeout(800);
  if (narrow) await page.click('.logbtn');
  // Four evenings of talk about one topic, sent to the brain's history as the app does after a pause.
  await page.evaluate(async ([topic]) => {
    const day = 86_400_000;
    const now = Date.now();
    const turns = [1, 2, 3, 4].map((d) => ({ role: 'user', text: `how is the ${topic} coming along`, at: now - d * day }));
    await fetch('/api/history', { method: 'POST', headers: { 'x-ghosty': '1', 'x-ghosty-key': 'preview-owner-key-0123456789', 'content-type': 'application/json' }, body: JSON.stringify({ turns }) });
  }, [topic]);
  await page.evaluate(() => (location.hash = 'memory'));
  await sec('Timeline');
  const tlp = page.locator('#pg-memory .pn.tl');
  await tlp.waitFor({ state: 'visible', timeout: 10000 }).catch(() => problems.push(`[${name}] no TIMELINE panel`));
  const item = (text) => tlp.locator('.mi', { hasText: text });
  await item(thing).first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => problems.push(`[${name}] the fact said in chat is not in the timeline`));
  const src = (await item(thing).first().locator('.misrc').textContent().catch(() => '')) ?? '';
  if (!/From your chat on/.test(src)) problems.push(`[${name}] the chat fact's source reads "${src}"`);
  // everything is there: what reflection kept, newest first
  // (each kind through the filter: on a preview other runs have filled, the first page may be all facts)
  for (const [kind, label] of [['profile', /ABOUT YOU/], ['fact', /SAVED FACT/], ['diary', /DIARY/]]) {
    await tlp.locator('select[aria-label="Show which memories"]').selectOption(kind);
    const kinds = await tlp.locator('.mik').allTextContents();
    if (!kinds.length || kinds.some((k) => !label.test(k))) problems.push(`[${name}] the timeline's ${kind} rows read: ${kinds.slice(0, 5).join(', ') || 'none'}`);
  }
  await tlp.locator('select[aria-label="Show which memories"]').selectOption('all');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${name}-memory-timeline.png` });
  // the source opens that chat (the CORE log, the message picked out), or what was said when the phone no longer has it
  await item(thing).first().locator('button.srclink').click();
  const opened = await page.waitForFunction(() => document.querySelector('#pg-core .msg.me.found') || document.querySelector('.modal .mbody'), null, { timeout: 6000 }).then(() => true, () => false);
  if (!opened) problems.push(`[${name}] tapping the source did not open the chat`);
  else if (!(await page.evaluate(() => location.hash === '#core' && !!document.querySelector('#pg-core .msg.me.found')))) problems.push(`[${name}] the chat is on this phone, but it showed a box instead of the conversation`);
  await page.screenshot({ path: `${out}/${name}-memory-source.png` });
  await page.keyboard.press('Escape');
  await page.evaluate(() => (location.hash = 'memory'));
  await item(thing).first().waitFor({ state: 'visible', timeout: 8000 });
  // EDIT
  await item(thing).first().locator('button:has-text("EDIT")').click();
  const edited = `${thing}, and old`;
  await tlp.locator('.mi textarea').fill(edited);
  await tlp.locator('.mi button:has-text("SAVE")').click();
  await item(edited).first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => problems.push(`[${name}] the edit did not show`));
  if (!/edited/.test((await item(edited).first().locator('.misrc').textContent().catch(() => '')) ?? '')) problems.push(`[${name}] the edited memory is not marked edited`);
  // LOCK
  await item(edited).first().locator('button:has-text("LOCK")').click();
  await page.waitForFunction((t) => [...document.querySelectorAll('#pg-memory .pn.tl .mi.locked')].some((x) => x.textContent.includes(t)), edited, { timeout: 8000 }).catch(() => problems.push(`[${name}] LOCK did not lock it`));
  await tlp.locator('select[aria-label="Show which memories"]').selectOption('locked');
  const lockedOnly = await tlp.locator('.mi').count();
  if (lockedOnly < 1 || (await tlp.locator('.mi:not(.locked)').count())) problems.push(`[${name}] "Locked only" shows ${lockedOnly} rows, some unlocked`);
  await tlp.locator('select[aria-label="Show which memories"]').selectOption('all');
  // FORGET, then UNDO: back, still locked
  await item(edited).first().locator('button:has-text("FORGET")').click();
  await page.waitForFunction((t) => ![...document.querySelectorAll('#pg-memory .pn.tl .mi')].some((x) => x.textContent.includes(t)), edited, { timeout: 8000 }).catch(() => problems.push(`[${name}] FORGET did not remove it`));
  // the UNDO bar floats above the tab bar (on screen wherever the row was)
  const undo = page.locator('.undo.undofloat:not([hidden]) button:has-text("UNDO")');
  if (!(await undo.isVisible().catch(() => false))) problems.push(`[${name}] no UNDO after FORGET`);
  await page.screenshot({ path: `${out}/${name}-memory-undo.png` });
  await undo.click().catch(() => undefined);
  await page.waitForFunction((t) => [...document.querySelectorAll('#pg-memory .pn.tl .mi.locked')].some((x) => x.textContent.includes(t)), edited, { timeout: 8000 }).catch(() => problems.push(`[${name}] UNDO did not bring it back locked`));
  // RECENTLY FORGOTTEN: forget it again, then a line under ME (its ✕): both stay undoable after the bar has gone
  await item(edited).first().locator('button:has-text("FORGET")').click({ timeout: 8000 }).catch(() => problems.push(`[${name}] the memory to forget again is not there`));
  await page.waitForFunction((t) => ![...document.querySelectorAll('#pg-memory .pn.tl .mi')].some((x) => x.textContent.includes(t)), edited, { timeout: 8000 }).catch(() => undefined);
  await sec('Me');
  const meLine = me.locator('.rw', { hasText: 'walks in Kings Heath' }).first();
  if (await meLine.count()) {
    // (the delete buttons show in Edit mode)
    const ed = page.locator('#pg-memory .editbtn');
    const on = await ed.isVisible().catch(() => false);
    if (on) await ed.click();
    await meLine.locator('.del').click();
    if (on) await ed.click();
  }
  else problems.push(`[${name}] no ME line to forget`);
  await sec('Timeline');
  const fb = tlp.locator('details.forgot');
  if (!(await fb.waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false))) problems.push(`[${name}] no RECENTLY FORGOTTEN list`);
  await fb.locator('summary').click();
  await page.waitForFunction(() => document.querySelectorAll('#pg-memory .pn.tl details.forgot .fgi').length >= 2, null, { timeout: 8000 }).catch(() => undefined);
  const fg = await fb.locator('.fgi .fgt').allTextContents();
  if (!fg.some((t) => t.includes(edited)) || !fg.some((t) => /walks in Kings Heath/.test(t))) problems.push(`[${name}] RECENTLY FORGOTTEN lists ${JSON.stringify(fg)}`);
  await page.screenshot({ path: `${out}/${name}-memory-forgotten.png` });
  await fb.locator('.fgi', { hasText: edited }).locator('button:has-text("UNDO")').click().catch(() => problems.push(`[${name}] no UNDO in RECENTLY FORGOTTEN`));
  await page.waitForFunction((t) => [...document.querySelectorAll('#pg-memory .pn.tl .mi.locked')].some((x) => x.textContent.includes(t)), edited, { timeout: 8000 }).catch(() => problems.push(`[${name}] UNDO from RECENTLY FORGOTTEN did not bring it back locked`));
  await fb.locator('.fgi', { hasText: 'walks in Kings Heath' }).locator('button:has-text("UNDO")').click().catch(() => undefined);
  await page.waitForFunction(() => /walks in Kings Heath/.test(document.querySelector('#pg-memory .pn.me')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => problems.push(`[${name}] the ME line did not come back`));
  // A row far down the timeline: its FORGET's UNDO is on screen (it sat at the top of the panel, thousands of points up).
  const deepWord = word();
  await page.evaluate(async (w) => {
    for (let i = 1; i <= 26; i++) await fetch('/api/memory', { method: 'POST', headers: { 'x-ghosty': '1', 'x-ghosty-key': 'preview-owner-key-0123456789', 'content-type': 'application/json' }, body: JSON.stringify({ text: `deep ${w} number ${i}` }) });
  }, deepWord);
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(300);
  await page.evaluate(() => (location.hash = 'memory'));
  // the oldest of the 26: about the 26th row, newest first
  const deepText = `deep ${deepWord} number 1`;
  const deep = tlp.locator('.mi').filter({ has: page.locator('.mit', { hasText: new RegExp(`^${deepText}$`) }) });
  if (await deep.waitFor({ state: 'visible', timeout: 10000 }).then(() => true, () => false)) {
    await deep.evaluate((e) => e.scrollIntoView({ block: 'center' }));
    const rowIndex = await deep.evaluate((e) => [...e.parentElement.querySelectorAll('.mi')].indexOf(e));
    await deep.locator('button:has-text("FORGET")').click();
    await page.waitForTimeout(500);
    const seen = await page.evaluate(() => [...document.querySelectorAll('.undo:not([hidden])')].some((u) => { const b = u.getBoundingClientRect(); return b.height > 0 && b.top >= 0 && b.bottom <= innerHeight && /deep/.test(u.textContent); }));
    if (!seen) problems.push(`[${name}] FORGET on row ${rowIndex + 1} of the timeline: its UNDO is not on screen`);
    await undo.click().catch(() => problems.push(`[${name}] no UNDO to tap after forgetting row ${rowIndex + 1}`));
    await page.waitForFunction((t) => [...document.querySelectorAll('#pg-memory .pn.tl .mi .mit')].some((x) => x.textContent === t), deepText, { timeout: 8000 }).catch(() => problems.push(`[${name}] UNDO did not bring the deep row back`));
  } else problems.push(`[${name}] the 26 seeded memories are not in the timeline`);
  // the filter by kind and the search
  await tlp.locator('select[aria-label="Show which memories"]').selectOption('profile');
  const kinds2 = await tlp.locator('.mik').allTextContents();
  if (!kinds2.length || kinds2.some((k) => !/ABOUT YOU/.test(k))) problems.push(`[${name}] "About you" shows: ${kinds2.join(', ')}`);
  await tlp.locator('select[aria-label="Show which memories"]').selectOption('all');
  await tlp.locator('input[aria-label="Find a memory"]').fill(edited.toUpperCase());
  if ((await tlp.locator('.mi').count()) !== 1) problems.push(`[${name}] searching found ${await tlp.locator('.mi').count()} rows`);
  await tlp.locator('input[aria-label="Find a memory"]').fill('');
  // PATTERNS: the topic of four evenings, with its evidence; ✕ hides it for good
  await sec('Patterns');
  const pp = page.locator('#pg-memory .pn.pats');
  const pat = pp.locator('.pat', { hasText: topic });
  if (!(await pat.first().waitFor({ state: 'visible', timeout: 10000 }).then(() => true, () => false))) problems.push(`[${name}] no pattern about "${topic}": ${(await pp.textContent().catch(() => '')) ?? ''}`);
  const evidence = (await pat.first().locator('.pe').textContent().catch(() => '')) ?? '';
  if (!/^\d+ days$/.test(evidence.trim()) || Number.parseInt(evidence, 10) < 3) problems.push(`[${name}] the pattern's evidence reads "${evidence}"`);
  await page.screenshot({ path: `${out}/${name}-memory-patterns.png` });
  await pat.first().locator('button.del').click().catch(() => undefined);
  await page.waitForFunction((t) => ![...document.querySelectorAll('#pg-memory .pn.pats .pat')].some((x) => x.textContent.includes(t)), topic, { timeout: 8000 }).catch(() => problems.push(`[${name}] dismissing the pattern did not hide it`));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
  await page.evaluate(() => (location.hash = 'memory'));
  await sec('Timeline');
  await tlp.locator('.mi').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => undefined);
  await page.waitForTimeout(800);
  if (await pp.locator('.pat', { hasText: topic }).count()) problems.push(`[${name}] the dismissed pattern came back after a reload`);
  // ---- RAISING HIM (OWNER-ISSUES 64, 69b): a rule said in chat is kept in his words and forgotten from MEMORY like any lesson;
  // his PRINCIPLES are written here in his own words, kept by the brain, and ✕ takes one away.
  const rule = `never say ${word()}`;
  await page.evaluate(() => (location.hash = 'core'));
  if (narrow) await page.click('.logbtn');
  // (the same words may already be in the log from an earlier run against this brain: wait for a new reply)
  const said = await page.locator('#pg-core .log .msg:not(.me)').count();
  await page.fill('#cin', rule);
  await page.keyboard.press('Enter');
  await page.waitForFunction((n) => { const m = [...document.querySelectorAll('#pg-core .log .msg:not(.me)')]; return m.length > n && /Understood\. I'll keep to that\./.test(m.at(-1)?.textContent ?? ''); }, said, { timeout: 10000 }).catch(() => problems.push(`[${name}] "${rule}" was not answered in one line`));
  if (narrow) await page.click('.logbtn');
  await page.evaluate(() => (location.hash = 'memory'));
  await page.waitForTimeout(600);
  await sec('Chat');
  const ruleRow = page.locator('#pg-memory .rw[data-kind="conduct"]', { hasText: rule });
  await ruleRow.first().waitFor({ state: 'attached', timeout: 10000 }).catch(() => undefined);
  await ruleRow.first().scrollIntoViewIfNeeded().catch(() => undefined);
  if (!(await ruleRow.first().waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false))) problems.push(`[${name}] MEMORY does not show his rule "${rule}": ${((await page.locator('#pg-memory .pn', { hasText: 'LESSONS LEARNED' }).first().textContent().catch(() => '')) ?? '').slice(0, 300)} (on ${await page.evaluate(() => location.hash)})`);
  else {
    const label = (await ruleRow.first().locator('.k').textContent()) ?? '';
    if (!/you told me/i.test(label)) problems.push(`[${name}] his rule is labelled "${label}"`);
    await page.screenshot({ path: `${out}/${name}-memory-rule.png` });
    // the ✕ on its row, shown after Edit (as every memory is forgotten here)
    const editRule = page.locator('#pg-memory .editbtn');
    const editingRule = await editRule.isVisible().catch(() => false);
    if (editingRule) await editRule.click();
    await ruleRow.first().locator('.n.del').click();
    if (editingRule) await editRule.click();
    await page.waitForFunction((t) => ![...document.querySelectorAll('#pg-memory .rw[data-kind="conduct"]')].some((x) => x.textContent.includes(t)), rule, { timeout: 8000 }).catch(() => problems.push(`[${name}] ✕ did not forget his rule`));
  }
  await sec('Me');
  const prp = page.locator('#pg-memory .pn.princpn');
  const principle = `Never lie to me about ${word()}.`;
  await prp.locator('input').fill(principle);
  await prp.locator('button:has-text("ADD")').click();
  const shown = () => page.evaluate((l) => [...document.querySelectorAll('#pg-memory .pn.princpn .rw .v')].some((x) => x.textContent === l), principle);
  await page.waitForFunction((l) => [...document.querySelectorAll('#pg-memory .pn.princpn .rw .v')].some((x) => x.textContent === l), principle, { timeout: 8000 }).catch(() => problems.push(`[${name}] the principle was not kept`));
  const kept = await page.evaluate(async () => (await (await fetch('/api/profile/principles', { headers: { 'x-ghosty': '1', 'x-ghosty-key': 'preview-owner-key-0123456789' } })).json()).lines);
  if (!kept.includes(principle)) problems.push(`[${name}] the brain does not keep the principle: ${JSON.stringify(kept)}`);
  await page.screenshot({ path: `${out}/${name}-memory-principles.png` });
  await prp.locator('.rw', { hasText: principle }).locator('button.princdel').click();
  await page.waitForFunction((l) => ![...document.querySelectorAll('#pg-memory .pn.princpn .rw .v')].some((x) => x.textContent === l), principle, { timeout: 8000 }).catch(() => undefined);
  if (await shown()) problems.push(`[${name}] ✕ did not take the principle away`);
  await sec('Timeline'); // where the next step expects to be
  // OFFLINE: one line says what shows is what I knew before; a FORGET says so plainly (never "Failed to fetch") and keeps the memory
  await ctx.setOffline(true);
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(300);
  await page.evaluate(() => (location.hash = 'memory'));
  await page.waitForTimeout(1200);
  const offSub = (await page.locator('#pg-memory .sub').first().textContent()) ?? '';
  if (!/You’re offline: this is what I knew before/.test(offSub)) problems.push(`[${name}] offline, the title line reads "${offSub}"`);
  const keep = tlp.locator('.mi').first();
  const keepText = (await keep.locator('.mit').textContent().catch(() => '')) ?? '';
  if (keepText) {
    await page.evaluate(() => document.querySelector('#toasts')?.replaceChildren());
    await keep.locator('button:has-text("FORGET")').click().catch(() => undefined);
    await page.waitForFunction(() => /offline|Failed|Could not/i.test(document.querySelector('#toasts')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => undefined);
    const said = (await page.locator('#toasts').textContent().catch(() => '')) ?? '';
    if (!/you’re offline, so nothing changed/.test(said) || /Failed to fetch/.test(said)) problems.push(`[${name}] a FORGET with no connection says: "${said.slice(0, 120)}"`);
    if (!(await page.evaluate((t) => [...document.querySelectorAll('#pg-memory .pn.tl .mi .mit')].some((x) => x.textContent === t), keepText))) problems.push(`[${name}] offline, the memory left the list though nothing was forgotten`);
  }
  await page.screenshot({ path: `${out}/${name}-memory-offline.png` });
  await ctx.setOffline(false);
  await page.waitForFunction(() => /things I know about you/.test(document.querySelector('#pg-memory .sub')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => problems.push(`[${name}] back online, the title line still says offline`));
  await ctx.close();
}

await run('desktop', DESKTOP);
await run('phone', PHONE);
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'Memory run clean: ME first and in his words, DIARY (its days in words), REFLECT NOW, the TIMELINE (source, edit, lock, forget, undo on screen however deep, filters), PATTERNS, one voice, offline said plainly, every target 44 pt.');
process.exit(problems.length ? 1 : 0);
