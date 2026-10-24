// The Memory tab's ME and DIARY panels: the profile drawn from the brain (stubbed first, exact
// values), a line added and removed, a diary entry opened, REFLECT NOW's toast — then, through
// the preview brain's scripted model, a real reflection over two things the owner said. Then the
// TIMELINE over the real brain: a fact said in chat shows with that chat as its source (which
// opens it), EDIT, LOCK (and the "Locked only" filter), FORGET and UNDO (back still locked), the
// kind filter and search; and PATTERNS: four evenings on one topic show with their evidence, and
// ✕ hides the pattern for good (still hidden after a reload).
//   node tests/memory.spec.mjs [outDir]
import { isWebKit, launch, webkitNoise } from './browser.mjs';
import { DESKTOP, PHONE, UK } from './nav.mjs';
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
  const stub = async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    // The timeline is the real brain's (checked below); ME ✕ forgets through it (POST /api/profile/item).
    if (url.pathname.startsWith('/api/profile/patterns/')) return route.continue();
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
  if (!/LIKES/i.test(text) || !/rain on the window/.test(text) || !/Ann is my sister/.test(text)) problems.push(`[${name}] ME is missing section lines: ${text.slice(0, 200)}`);
  if (!/6 LINES/.test(text)) problems.push(`[${name}] ME status should count 6 lines: ${text.slice(0, 120)}`);
  await page.waitForTimeout(600); // the panes settle into place with a short animation
  await page.screenshot({ path: `${out}/${name}-memory-me.png` });
  // add a line under ROUTINES (the "Add a memory…" row opens the form in a sheet)
  const addRow = page.locator('#pg-memory .addrow');
  const sheet = (await addRow.isVisible().catch(() => false)) ? (await addRow.click(), page.locator('.modal .memadd')) : me;
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
  // the DIARY (other column on phones): newest first, opens in a modal; REFLECT NOW toasts what changed
  const narrow = viewport.width < 900;
  if (narrow) await page.click('#pg-memory .swap');
  const dp = page.locator('#pg-memory .pn', { has: page.locator('h3:has-text("DIARY")') });
  await dp.waitFor({ state: 'visible', timeout: 8000 });
  const rows = dp.locator('.rw');
  await rows.first().waitFor({ state: 'attached', timeout: 8000 }).catch(() => undefined);
  const first = (await rows.first().textContent()) ?? '';
  if (!/2026-10-17/.test(first)) problems.push(`[${name}] the diary is not newest first: "${first.slice(0, 60)}"`);
  await rows.first().click();
  const modalText = await page.locator('.modal .mbody').textContent({ timeout: 5000 }).catch(() => '');
  if (!/We decided to train on Tuesdays/.test(modalText ?? '')) problems.push(`[${name}] the diary entry did not open in a modal`);
  await page.screenshot({ path: `${out}/${name}-memory-diary.png` });
  await page.keyboard.press('Escape');
  await dp.locator('button:has-text("REFLECT NOW")').click();
  await page.waitForFunction(() => /Reflected: 1 new fact, 1 line about you/.test(document.querySelector('#toasts')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => problems.push(`[${name}] no toast after REFLECT NOW`));
  if (state.reflected !== 1) problems.push(`[${name}] REFLECT NOW called the brain ${state.reflected} times`);
  await page.unroute('**/api/profile**', stub);

  // the real thing: two things said in chat, then a reflection by the preview brain's scripted model
  if (narrow) await page.click('#pg-memory .swap');
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
  if (narrow) await page.click('#pg-memory .swap');
  await dp.locator('button:has-text("REFLECT NOW")').click();
  await page.waitForFunction(() => /Reflected: /.test(document.querySelector('#toasts')?.textContent ?? ''), null, { timeout: 15000 }).catch(() => problems.push(`[${name}] the real reflection gave no toast`));
  if (narrow) await page.click('#pg-memory .swap');
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
  const tlp = page.locator('#pg-memory .pn.tl');
  await tlp.waitFor({ state: 'visible', timeout: 10000 }).catch(() => problems.push(`[${name}] no TIMELINE panel`));
  const item = (text) => tlp.locator('.mi', { hasText: text });
  await item(thing).first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => problems.push(`[${name}] the fact said in chat is not in the timeline`));
  const src = (await item(thing).first().locator('.misrc').textContent().catch(() => '')) ?? '';
  if (!/From your chat on/.test(src)) problems.push(`[${name}] the chat fact's source reads "${src}"`);
  // everything is there: what reflection kept, newest first
  const kinds = await tlp.locator('.mik').allTextContents();
  if (!kinds.some((k) => /ABOUT YOU/.test(k)) || !kinds.some((k) => /SAVED FACT/.test(k))) problems.push(`[${name}] the timeline is missing kinds: ${kinds.join(', ')}`);
  if (!kinds.some((k) => /DIARY/.test(k))) problems.push(`[${name}] the diary is not in the timeline`);
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
  const undo = tlp.locator('.undo button:has-text("UNDO")');
  if (!(await undo.isVisible().catch(() => false))) problems.push(`[${name}] no UNDO after FORGET`);
  await page.screenshot({ path: `${out}/${name}-memory-undo.png` });
  await undo.click().catch(() => undefined);
  await page.waitForFunction((t) => [...document.querySelectorAll('#pg-memory .pn.tl .mi.locked')].some((x) => x.textContent.includes(t)), edited, { timeout: 8000 }).catch(() => problems.push(`[${name}] UNDO did not bring it back locked`));
  // RECENTLY FORGOTTEN: forget it again, then a line under ME (its ✕): both stay undoable after the bar has gone
  await item(edited).first().locator('button:has-text("FORGET")').click();
  await page.waitForFunction((t) => ![...document.querySelectorAll('#pg-memory .pn.tl .mi')].some((x) => x.textContent.includes(t)), edited, { timeout: 8000 }).catch(() => undefined);
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
  // the filter by kind and the search
  await tlp.locator('select[aria-label="Show which memories"]').selectOption('profile');
  const kinds2 = await tlp.locator('.mik').allTextContents();
  if (!kinds2.length || kinds2.some((k) => !/ABOUT YOU/.test(k))) problems.push(`[${name}] "About you" shows: ${kinds2.join(', ')}`);
  await tlp.locator('select[aria-label="Show which memories"]').selectOption('all');
  await tlp.locator('input[aria-label="Find a memory"]').fill(edited.toUpperCase());
  if ((await tlp.locator('.mi').count()) !== 1) problems.push(`[${name}] searching found ${await tlp.locator('.mi').count()} rows`);
  await tlp.locator('input[aria-label="Find a memory"]').fill('');
  // PATTERNS: the topic of four evenings, with its evidence; ✕ hides it for good
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
  await tlp.locator('.mi').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => undefined);
  await page.waitForTimeout(800);
  if (await pp.locator('.pat', { hasText: topic }).count()) problems.push(`[${name}] the dismissed pattern came back after a reload`);
  await ctx.close();
}

await run('desktop', DESKTOP);
await run('phone', PHONE);
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'Memory run clean: ME, DIARY, REFLECT NOW, the TIMELINE (source, edit, lock, forget, undo, filters) and PATTERNS work.');
process.exit(problems.length ? 1 : 0);
