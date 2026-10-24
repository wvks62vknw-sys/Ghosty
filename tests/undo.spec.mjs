// UNDO everywhere (docs/build-plan/BRIEF-UNDO-OFFLINE.md A), on the owner's phone (440 × 956, en-GB, London):
// every action that removes or changes something the owner would miss either shows the UNDO bar (12 s; UNDO puts
// it back exactly and says so) or, where it cannot come back, asks first in a one-tap confirm that says what
// happens. Walked here, one by one:
//   UNDO   a memory forgotten (✕), a memory's words EDITed, the conversation CLEARed (the brain keeps it until the
//          bar goes, then forgets it), a library document REMOVEd (likewise), a widget deleted (saved back), an
//          upgrade idea DISMISSed, the roadmap CLEARed, a calendar disconnected, a notified device removed, the
//          offline brain switched off, a course REMOVEd, a GYM game RESET, a SPACE piece REMOVEd
//   CONFIRM  a page UNPUBLISHed, a change DISCARDed, email and Spotify UNLINKed, a key REMOVEd, the owner key
//          forgotten on this phone, the offline brain DELETEd — KEEP IT changes nothing
//   node tests/undo.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, openPanel } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const problems = [];
const done = [];

/** The real brain behind the preview, asked directly. */
const api = async (method, path, body) => {
  const r = await fetch(`${base}/api${path}`, { method, headers: { 'x-ghosty': '1', 'x-ghosty-key': KEY, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return r.json().catch(() => ({}));
};

const ctx = await browser.newContext({ viewport: PHONE, ...UK, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
// The offline brain's stand-in (no WebGPU here): on this phone, ready.
await page.addInitScript(() => {
  window.__ghostyOfflineEngine = { ready: true, idleMs: 500, async chat(m, on) { on('ok'); } };
});
// What the interface asked of the brain, for the checks below.
const asked = [];
page.on('request', (r) => {
  const u = new URL(r.url());
  if (u.pathname.startsWith('/api/') && r.method() !== 'GET') asked.push(`${r.method()} ${u.pathname}`);
});
const askedFor = (re) => asked.filter((a) => re.test(a)).length;

const until = (fn, ms, what, arg = null) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => (problems.push(what), false));
const go = async (tab) => {
  await page.evaluate((t) => (location.hash = t), tab);
  await page.waitForTimeout(700);
};
/** The floating UNDO bar: it shows `words`, and UNDO is on it. */
const bar = page.locator('.undofloat');
const sawBar = async (words, what) => {
  const ok = await page.waitForFunction((src) => { const b = document.querySelector('.undofloat'); return !!b && !b.hidden && new RegExp(src, 'i').test(b.textContent ?? ''); }, words.source, { timeout: 6000 }).then(() => true, () => false);
  if (!ok) problems.push(`${what}: no UNDO bar saying ${words} (bar: "${await bar.textContent().catch(() => '')}")`);
  return ok;
};
const tapUndo = () => bar.locator('button', { hasText: 'UNDO' }).click();
/** The one-tap confirm: it says `words`, KEEP IT changes nothing; `yes` taps its action instead. */
const sheet = page.locator('.modal .confirm.sure');
const sawSheet = async (words, what) => {
  const ok = await sheet.waitFor({ state: 'visible', timeout: 6000 }).then(() => true, () => false);
  if (!ok) return problems.push(`${what}: no confirm asked first`), false;
  const text = (await sheet.textContent()) ?? '';
  if (!words.test(text)) problems.push(`${what}: the confirm does not say what happens (${text.slice(0, 160)})`);
  return true;
};
const keepIt = () => sheet.locator('button', { hasText: 'KEEP IT' }).click();
const yes = () => sheet.locator('button.sureyes').click();
const clickJs = (loc) => loc.evaluate((el) => el.click());
let shot = 0;
// (after the bar's and the sheet's entrance animations)
const snap = async (name) => (await page.waitForTimeout(600), page.screenshot({ path: `${out}/undo-${String(++shot).padStart(2, '0')}-${name}.png` }));

await page.goto(base);
await page.fill('#pair input', KEY);
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
// The chat log is an overlay on phones: closed for the walk.
const closeLog = async () => (await page.locator('#log.open, .log.open').count().catch(() => 0)) && (await page.click('.logbtn').catch(() => undefined));

// ---- 1. MEMORY: a remembered fact forgotten with its ✕ → UNDO brings it back ----
await api('POST', '/memory', { text: 'Undo test: likes marmalade on toast' });
await go('memory');
await page.evaluate(() => document.querySelector('#pg-memory')?.dispatchEvent(new Event('enter')));
const fact = page.locator('#pg-memory .rw', { hasText: 'likes marmalade on toast' }).first();
await page.waitForFunction(() => document.querySelector('#pg-memory')?.textContent?.includes('likes marmalade on toast'), null, { timeout: 10000 }).catch(() => undefined);
if (!(await fact.count())) problems.push('memory: the new fact is not listed');
else {
  await clickJs(fact.locator('.del'));
  await sawBar(/Forgotten: .*marmalade/, 'memory fact ✕');
  const gone = !(await api('GET', '/memory')).facts?.some((f) => /marmalade/.test(f.text));
  if (!gone) problems.push('memory: the fact was not forgotten by the brain');
  await snap('memory-forgotten');
  await tapUndo();
  await until(() => [...document.querySelectorAll('#pg-memory .rw')].some((r) => /marmalade/.test(r.textContent ?? '')), 10000, 'memory: UNDO did not bring the fact back on screen');
  if (!(await api('GET', '/memory')).facts?.some((f) => /marmalade/.test(f.text))) problems.push('memory: after UNDO the brain still has the fact forgotten');
  else done.push('memory fact ✕ → UNDO');
}

// ---- 2. MEMORY → TIMELINE: EDIT a memory's words → UNDO puts the old words back ----
const tl = page.locator('#pg-memory .pn.tl');
const tlItem = tl.locator('.mi', { hasText: 'marmalade' }).first();
if (await tlItem.waitFor({ state: 'attached', timeout: 10000 }).then(() => true, () => false)) {
  await clickJs(tlItem.locator('button', { hasText: 'EDIT' }));
  await tl.locator('textarea').fill('Undo test: likes lemon curd on toast');
  await clickJs(tl.locator('button', { hasText: 'SAVE' }));
  await until(() => [...document.querySelectorAll('#pg-memory .pn.tl .mi')].some((m) => /lemon curd/.test(m.textContent ?? '')), 8000, 'timeline: EDIT did not save the new words');
  const tlBar = tl.locator('.undo');
  if (!(await tlBar.isVisible().catch(() => false)) || !/Changed/.test((await tlBar.textContent()) ?? '')) problems.push('timeline: no UNDO bar after EDIT');
  await tlBar.scrollIntoViewIfNeeded().catch(() => undefined);
  await snap('memory-edited');
  await clickJs(tlBar.locator('button', { hasText: 'UNDO' }));
  if (await until(() => [...document.querySelectorAll('#pg-memory .pn.tl .mi')].some((m) => /likes marmalade on toast/.test(m.textContent ?? '')) && ![...document.querySelectorAll('#pg-memory .pn.tl .mi')].some((m) => /lemon curd/.test(m.textContent ?? '')), 8000, 'timeline: UNDO did not put the old words back'))
    done.push('memory EDIT → UNDO');
} else problems.push('timeline: the fact is not in the timeline');

// ---- 3. MEMORY → CLEAR CONVERSATION: gone at once, the brain forgets it only when the bar goes; UNDO puts it back ----
await api('POST', '/history', { turns: [{ role: 'user', text: 'Undo test: what is a kestrel?', at: Date.now() - 60_000 }, { role: 'assistant', text: 'A small falcon that hovers.', at: Date.now() - 59_000 }] });
await page.reload();
await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
await go('memory');
const conv = page.locator('#pg-memory .pn', { hasText: 'CONVERSATION' }).last();
await until(() => document.querySelector('#pg-memory')?.textContent?.includes('A small falcon that hovers'), 10000, 'conversation: the turns did not load');
await clickJs(page.locator('#pg-memory button', { hasText: 'CLEAR CONVERSATION' }));
await sawBar(/Conversation cleared/, 'CLEAR CONVERSATION');
if ((await conv.textContent())?.includes('A small falcon')) problems.push('conversation: still on screen after CLEAR');
if (!(await api('GET', '/history')).turns?.length) problems.push('conversation: the brain forgot it before the UNDO bar went');
await snap('conversation-cleared');
await tapUndo();
if (await until(() => document.querySelector('#pg-memory')?.textContent?.includes('A small falcon that hovers'), 5000, 'conversation: UNDO did not put it back')) done.push('CLEAR CONVERSATION → UNDO');
// cleared again and left: the brain forgets it once the 12 s are up
await clickJs(page.locator('#pg-memory button', { hasText: 'CLEAR CONVERSATION' }));
await page.waitForTimeout(13_000);
if ((await api('GET', '/history')).turns?.length) problems.push('conversation: the brain still has it after the UNDO bar went');
else done.push('CLEAR CONVERSATION → made after 12 s');

// ---- 4. LIBRARY: REMOVE FROM LIBRARY → off the shelf with UNDO; the brain removes it only when the bar goes ----
const made = await api('POST', '/library/docs', { title: 'Undo test notebook', source: 'pasted', kind: 'note', pages: 1 });
const docId = made.doc?.id;
await api('POST', `/library/docs/${docId}/passages`, { passages: [{ text: 'Kestrels hover over verges, looking for voles.' }] });
await api('POST', `/library/docs/${docId}/done`, {});
const libHas = async () => (await api('GET', '/library')).docs?.some((d) => d.id === docId);
await go('library');
const shelfRow = () => page.locator('#pg-library .pn.shelf .rw', { hasText: 'Undo test notebook' });
await until(() => [...document.querySelectorAll('#pg-library .pn.shelf .rw')].some((r) => /Undo test notebook/.test(r.textContent ?? '')), 10000, 'library: the document is not on the shelf');
const removeDoc = async () => {
  await clickJs(shelfRow().first());
  await page.locator('.modal button', { hasText: 'REMOVE FROM LIBRARY' }).click();
};
if (await shelfRow().count()) {
  await removeDoc();
  await sawBar(/Removed: .*Undo test notebook/, 'library REMOVE');
  if (await shelfRow().count()) problems.push('library: still on the shelf after REMOVE');
  if (!(await libHas())) problems.push('library: the brain removed it before the UNDO bar went');
  await snap('library-removed');
  await tapUndo();
  if (await until(() => [...document.querySelectorAll('#pg-library .pn.shelf .rw')].some((r) => /Undo test notebook/.test(r.textContent ?? '')), 5000, 'library: UNDO did not put it back on the shelf')) done.push('library REMOVE → UNDO');
  if (!(await libHas())) problems.push('library: gone from the brain after UNDO');
}

// ---- 5. WORKSHOP: a widget deleted (✕) → UNDO saves the very same widget back ----
await api('POST', '/widgets', { name: 'undo-test', title: 'Undo test timer', html: '<p>tick</p>' });
// (an upgrade idea, the roadmap, a published page and an open change, as the brain would list them)
let ideaDeletes = 0;
await page.route('**/api/upgrades', (r) => r.fulfill({ json: { ideas: [{ id: 'idea1', title: 'Undo test idea', why: 'because', steps: ['one'], at: Date.now() }], next: null, last: null } }));
await page.route('**/api/upgrades/idea1', (r) => (r.request().method() === 'DELETE' ? (ideaDeletes++, r.fulfill({ json: { removed: true } })) : r.continue()));
let roadmapDeletes = 0;
await page.route('**/api/roadmap', (r) => (r.request().method() === 'DELETE' ? (roadmapDeletes++, r.fulfill({ json: { ok: true } })) : r.fulfill({ json: { roadmap: { goal: 'Undo test roadmap', steps: [{ id: 1, title: 'First step', status: 'todo' }] } } })));
let siteDeletes = 0;
await page.route('**/api/sites', (r) => r.fulfill({ json: { sites: siteDeletes ? [] : [{ name: 'undo-bakery', title: 'Undo Bakery', at: Date.now(), bytes: 4000 }], origin: base } }));
await page.route('**/api/sites/undo-bakery', (r) => (siteDeletes++, r.fulfill({ json: { removed: true } })));
let discards = 0;
await page.route('**/api/changes', (r) => r.fulfill({ json: { ready: true, changes: discards ? [] : [{ number: 7, title: 'Undo test change', sha: 'a'.repeat(40), url: 'https://github.com/x/y/pull/7', checks: 'passed', preview: 'none', createdAt: new Date().toISOString() }], versions: [] } }));
await page.route('**/api/changes/7/discard', (r) => (discards++, r.fulfill({ json: { result: 'Discarded #7' } })));
await go('workshop');
await page.evaluate(() => (location.hash = 'workshop'));
const widgetRow = () => page.locator('#pg-workshop .rw', { hasText: 'Undo test timer' });
await until(() => [...document.querySelectorAll('#pg-workshop .rw')].some((r) => /Undo test timer/.test(r.textContent ?? '')), 15000, 'workshop: the widget is not listed');
if (await widgetRow().count()) {
  await clickJs(widgetRow().first().locator('.del'));
  await sawBar(/Deleted: Undo test timer/, 'widget ✕');
  const gone = !(await api('GET', '/widgets')).widgets?.some((w) => w.title === 'Undo test timer');
  if (!gone) problems.push('widget: still on the brain after ✕');
  await snap('widget-deleted');
  await tapUndo();
  await until(() => [...document.querySelectorAll('#pg-workshop .rw')].some((r) => /Undo test timer/.test(r.textContent ?? '')), 8000, 'widget: UNDO did not list it again');
  const back = (await api('GET', '/widgets')).widgets?.find((w) => w.title === 'Undo test timer');
  if (back?.html !== '<p>tick</p>' || back?.title !== 'Undo test timer') problems.push(`widget: UNDO did not save it back as it was (${JSON.stringify(back)?.slice(0, 120)})`);
  else done.push('widget ✕ → UNDO');
}

// ---- 6. WORKSHOP: an upgrade idea DISMISSed → UNDO; the brain is told only when the bar goes ----
const idea = page.locator('#pg-workshop .idea', { hasText: 'Undo test idea' });
await until(() => !!document.querySelector('#pg-workshop .idea'), 10000, 'upgrades: the idea is not listed');
if (await idea.count()) {
  await clickJs(idea.locator('button', { hasText: 'DISMISS' }));
  await sawBar(/Dismissed: Undo test idea/, 'upgrade DISMISS');
  if (await idea.count()) problems.push('upgrades: still listed after DISMISS');
  if (ideaDeletes) problems.push('upgrades: the brain was told before the UNDO bar went');
  await tapUndo();
  if (await until(() => !!document.querySelector('#pg-workshop .idea'), 4000, 'upgrades: UNDO did not bring the idea back')) done.push('upgrade DISMISS → UNDO');
  if (ideaDeletes) problems.push('upgrades: UNDO still dismissed it on the brain');
  // dismissed again, and the next change takes the bar: then the brain is told
  await clickJs(idea.locator('button', { hasText: 'DISMISS' }));
}

// ---- 7. WORKSHOP: the roadmap CLEARed → UNDO ----
const rmap = page.locator('#pg-workshop .pn', { hasText: 'Undo test roadmap' });
await until(() => document.querySelector('#pg-workshop')?.textContent?.includes('Undo test roadmap'), 10000, 'roadmap: not shown');
if (await rmap.count()) {
  await clickJs(rmap.first().locator('button', { hasText: /^CLEAR$/ }));
  await sawBar(/Roadmap cleared/, 'roadmap CLEAR');
  // (the brain is told as the next change takes the bar: its request is on its way)
  for (let i = 0; i < 30 && !ideaDeletes; i++) await page.waitForTimeout(100);
  if (!ideaDeletes) problems.push('upgrades: a dismissal was never sent once the next change took the bar');
  if (roadmapDeletes) problems.push('roadmap: the brain cleared it before the UNDO bar went');
  await tapUndo();
  if (await until(() => document.querySelector('#pg-workshop')?.textContent?.includes('Undo test roadmap'), 4000, 'roadmap: UNDO did not bring it back')) done.push('roadmap CLEAR → UNDO');
}

// ---- 8. WORKSHOP: UNPUBLISH a page (its link gone for good) → a confirm that says so; KEEP IT changes nothing ----
const site = page.locator('#pg-workshop .site', { hasText: 'Undo Bakery' });
await until(() => document.querySelector('#pg-workshop')?.textContent?.includes('Undo Bakery'), 10000, 'sites: the page is not listed');
if (await site.count()) {
  await clickJs(site.locator('button', { hasText: 'UNPUBLISH' }));
  if (await sawSheet(/stops working for everyone, for good/, 'UNPUBLISH')) {
    await snap('unpublish-confirm');
    await keepIt();
    await page.waitForTimeout(400);
    if (siteDeletes || !(await site.count())) problems.push('sites: KEEP IT still took the page down');
    await clickJs(site.locator('button', { hasText: 'UNPUBLISH' }));
    await sheet.waitFor({ state: 'visible', timeout: 4000 }).catch(() => undefined);
    await yes();
    if (await until(() => !document.querySelector('#pg-workshop')?.textContent?.includes('Undo Bakery'), 6000, 'sites: TAKE IT DOWN did not take it down')) done.push('UNPUBLISH → confirm (KEEP IT / TAKE IT DOWN)');
  }
}

// ---- 9. WORKSHOP: DISCARD a change → a confirm; KEEP IT changes nothing ----
const change = page.locator('#pg-workshop .change', { hasText: 'Undo test change' });
await until(() => document.querySelector('#pg-workshop')?.textContent?.includes('Undo test change'), 10000, 'changes: the change is not listed');
if (await change.count()) {
  await clickJs(change.locator('button', { hasText: 'DISCARD' }));
  if (await sawSheet(/closed and never shipped/, 'DISCARD')) {
    await keepIt();
    await page.waitForTimeout(300);
    if (discards) problems.push('changes: KEEP IT still discarded it');
    await clickJs(change.locator('button', { hasText: 'DISCARD' }));
    await sheet.waitFor({ state: 'visible', timeout: 4000 }).catch(() => undefined);
    await yes();
    if (await until(() => !document.querySelector('#pg-workshop')?.textContent?.includes('Undo test change'), 6000, 'changes: DISCARD after the confirm did not discard')) done.push('DISCARD → confirm');
  }
}

// ---- 10. AGENDA: a calendar disconnected (✕) → UNDO; the brain disconnects it only when the bar goes ----
let feedDeletes = 0;
await page.route('**/api/agenda?**', async (r) => {
  const res = await r.fetch();
  const j = await res.json();
  await r.fulfill({ json: { ...j, feeds: feedDeletes ? [] : [{ id: 'feed1', name: 'Undo test calendar', at: Date.now() }] } });
});
await page.route('**/api/feeds/feed1', (r) => (feedDeletes++, r.fulfill({ json: { ok: true } })));
await go('agenda');
const feed = page.locator('#pg-agenda .rw', { hasText: 'Undo test calendar' });
await until(() => document.querySelector('#pg-agenda')?.textContent?.includes('Undo test calendar'), 10000, 'agenda: the calendar is not listed');
if (await feed.count()) {
  await clickJs(feed.first().locator('.del'));
  await sawBar(/Disconnected: Undo test calendar/, 'calendar ✕');
  if (feedDeletes) problems.push('agenda: disconnected on the brain before the UNDO bar went');
  await snap('calendar-disconnected');
  await tapUndo();
  if (await until(() => document.querySelector('#pg-agenda')?.textContent?.includes('Undo test calendar'), 4000, 'agenda: UNDO did not list the calendar again')) done.push('calendar ✕ → UNDO');
  if (feedDeletes) problems.push('agenda: UNDO still disconnected it');
}

// ---- 11. LINKS: Spotify and email UNLINK ask first (they cannot be put back from here); a notified device ✕ → UNDO ----
await page.route('**/api/spotify/status', (r) => r.fulfill({ json: { linked: true, name: 'Owner', product: 'premium', clientId: 'x' } }));
await page.route('**/api/email/status', (r) => r.fulfill({ json: { linked: true, address: 'owner@example.com', server: 'imap.example.com' } }));
let pushDeletes = 0;
await page.route('**/api/push/devices', (r) => r.fulfill({ json: { devices: [{ id: 'dev1', label: 'Undo test iPad', at: Date.now() - 86_400_000, endpoint: 'https://push.example/1' }] } }));
await page.route('**/api/push/devices/dev1', (r) => (pushDeletes++, r.fulfill({ json: { ok: true } })));
await go('links');
for (const [title, words] of [['SPOTIFY', /Spotify’s sign-in once more/], ['EMAIL', /app password is wiped/]]) {
  await openPanel(page, 'links', title);
  const un = page.locator('#pg-links .pn.pushed button', { hasText: 'UNLINK' }).first();
  if (!(await un.waitFor({ state: 'attached', timeout: 8000 }).then(() => true, () => false))) {
    problems.push(`links: no UNLINK for ${title}`);
    continue;
  }
  const before = askedFor(/unlink|\/keys/);
  await clickJs(un);
  if (await sawSheet(words, `${title} UNLINK`)) {
    if (title === 'SPOTIFY') await snap('spotify-unlink-confirm');
    await keepIt();
    await page.waitForTimeout(400);
    if (askedFor(/unlink|\/keys/) !== before) problems.push(`links: KEEP IT still unlinked ${title}`);
    else done.push(`${title} UNLINK → confirm (KEEP IT)`);
  }
}
await openPanel(page, 'links', 'THIS PHONE');
const dev = page.locator('#pg-links .rw', { hasText: 'Undo test iPad' });
if (await dev.waitFor({ state: 'attached', timeout: 8000 }).then(() => true, () => false)) {
  await clickJs(dev.locator('.del'));
  await sawBar(/No more notifications to Undo test iPad/, 'device ✕');
  if (pushDeletes) problems.push('links: the device was removed before the UNDO bar went');
  await tapUndo();
  if (await until(() => document.querySelector('#pg-links')?.textContent?.includes('Undo test iPad'), 5000, 'links: UNDO did not list the device again')) done.push('notified device ✕ → UNDO');
} else problems.push('links: the notified device is not listed');

// ---- 12. SYSTEM: a key REMOVEd, and the owner key forgotten here: both ask first; KEEP IT changes nothing ----
await page.route('**/api/status', async (r) => {
  const res = await r.fetch();
  const j = await res.json();
  if (Array.isArray(j.keys) && j.keys[0]) j.keys[0].set = true;
  await r.fulfill({ json: j });
});
await go('system');
await openPanel(page, 'system', 'KEYS');
const rm = page.locator('#pg-system .keyblock button', { hasText: 'REMOVE' }).first();
if (await rm.waitFor({ state: 'attached', timeout: 8000 }).then(() => true, () => false)) {
  const before = askedFor(/\/api\/keys/);
  await clickJs(rm);
  if (await sawSheet(/wiped from Ghosty, not kept anywhere/, 'key REMOVE')) {
    await snap('key-remove-confirm');
    await keepIt();
    await page.waitForTimeout(300);
    if (askedFor(/\/api\/keys/) !== before) problems.push('system: KEEP IT still removed the key');
    else done.push('key REMOVE → confirm (KEEP IT)');
  }
} else problems.push('system: no REMOVE on a saved key');
const forgetKey = page.locator('#pg-system button', { hasText: 'FORGET OWNER KEY ON THIS DEVICE' });
if (!(await forgetKey.count())) await openPanel(page, 'system', 'STATUS').catch(() => undefined);
if (await forgetKey.count()) {
  await clickJs(forgetKey.first());
  if (await sawSheet(/stops being able to talk to Ghosty’s brain/, 'FORGET OWNER KEY')) {
    await keepIt();
    await page.waitForTimeout(300);
    if (!(await page.evaluate(() => !!localStorage.getItem('ghosty.ownerKey') || !!document.querySelector('#pg-system')))) problems.push('system: KEEP IT still forgot the owner key');
    else done.push('FORGET OWNER KEY → confirm (KEEP IT)');
  }
} else problems.push('system: no FORGET OWNER KEY button found');

// ---- 13. SETTINGS → OFFLINE BRAIN: switched off → UNDO; DELETE asks first (it must be downloaded again) ----
await go('settings');
await openPanel(page, 'settings', 'OFFLINE');
const mode = page.locator('#pg-settings select[aria-label="Offline brain mode"]');
const was = await mode.inputValue().catch(() => '');
await mode.selectOption('off');
await sawBar(/Offline brain: off/, 'offline brain off');
await snap('offline-brain-off');
await tapUndo();
if (await until((w) => window.__ghosty?.settings?.get?.().offlineBrain === w || document.querySelector('#pg-settings select[aria-label="Offline brain mode"]')?.value === w, 4000, 'settings: UNDO did not switch the offline brain back', was)) done.push('offline brain off → UNDO');
const del = page.locator('#pg-settings .pn.offbrain button', { hasText: 'DELETE' });
if (await del.count()) {
  await del.evaluate((b) => (b.disabled = false));
  await clickJs(del);
  if (await sawSheet(/download it again \(about \d+ MB/, 'offline brain DELETE')) {
    await snap('offline-delete-confirm');
    await keepIt();
    await page.waitForTimeout(300);
    if (!(await page.evaluate(() => window.__ghostyOfflineEngine.ready))) problems.push('settings: KEEP IT still deleted the offline brain');
    else done.push('offline brain DELETE → confirm (KEEP IT)');
  }
}

// ---- 14. LEARN: a course REMOVEd → UNDO puts it back; the brain forgets it only when the bar goes ----
await go('core');
if (!(await page.locator('#cin').isVisible().catch(() => false))) await page.click('.logbtn').catch(() => undefined);
await page.fill('#cin', 'teach me photosynthesis');
await page.keyboard.press('Enter');
await until(() => window.__ghosty?.learn?.view === 'course' && window.__ghosty?.learn?.courses === 1, 30000, 'learn: the course was not planned');
await closeLog();
const learnRemove = page.locator('#pg-learn .learnbar button', { hasText: 'REMOVE' });
if (await learnRemove.count()) {
  const courseDeletes = () => askedFor(/DELETE \/api\/learn\/course/);
  await clickJs(learnRemove);
  await sawBar(/Course removed/, 'course REMOVE');
  if ((await page.evaluate(() => window.__ghosty?.learn?.courses)) !== 0) problems.push('learn: the course is still listed after REMOVE');
  if (courseDeletes()) problems.push('learn: the brain forgot the course before the UNDO bar went');
  await snap('course-removed');
  await tapUndo();
  if (await until(() => window.__ghosty?.learn?.courses === 1, 4000, 'learn: UNDO did not bring the course back')) done.push('course REMOVE → UNDO');
  if (courseDeletes()) problems.push('learn: UNDO still deleted the course on the brain');
} else problems.push('learn: no REMOVE on the course');

// ---- 15. GYM: RESET (asked in its menu) → UNDO puts back what he had learned ----
await go('gym');
await until(() => (window.__ghosty?.gym?.cards ?? 0) > 0, 15000, 'gym: no game cards');
await page.locator('#pg-gym .gymcard[data-game="tictactoe"]').click();
await page.locator('#pg-gym button.gymtrain').click();
const trained = await until(() => window.__ghosty?.gym?.saves >= 1 && (window.__ghosty?.gym?.recs?.tictactoe?.units ?? 0) > 0, 40000, 'gym: training was never saved');
if (trained) {
  if ((await page.evaluate(() => window.__ghosty?.gym?.training)) === 'tictactoe') await page.locator('#pg-gym button.gymtrain').click();
  await page.waitForTimeout(500);
  const units = await page.evaluate(() => window.__ghosty?.gym?.recs?.tictactoe?.units ?? 0);
  await page.locator('#pg-gym .gymmore').click();
  await page.locator('#pg-gym .gymmenu button.warn').click();
  await sawBar(/Tic-tac-toe: reset/i, 'GYM RESET');
  if (await page.evaluate(() => !!window.__ghosty?.gym?.recs?.tictactoe)) problems.push('gym: RESET kept the game');
  await snap('gym-reset');
  await tapUndo();
  if (await until((u) => (window.__ghosty?.gym?.recs?.tictactoe?.units ?? 0) >= u * 0.5 && (window.__ghosty?.gym?.recs?.tictactoe?.units ?? 0) > 0, 5000, 'gym: UNDO did not put the game back', units)) done.push('GYM RESET → UNDO');
}

// ---- 16. SPACE: a piece REMOVEd → UNDO puts it back where it was ----
await page.evaluate(() => window.__ghosty?.run?.('open_tab', { tab: 'space' }));
await go('space');
await until(() => (window.__ghosty?.space?.items?.length ?? 0) > 0, 10000, 'space: the plan did not load');
await page.locator('#pg-space .spacecat button', { hasText: 'Desk' }).click();
const desk = await page.evaluate(() => window.__ghosty.space.items.find((i) => i.kind === 'desk'));
if (desk) {
  const n = await page.evaluate(() => window.__ghosty.space.items.length);
  await clickJs(page.locator('#pg-space .spacebar button', { hasText: 'REMOVE' }).first());
  await sawBar(/Removed: .*desk/i, 'SPACE REMOVE');
  if ((await page.evaluate(() => window.__ghosty.space.items.length)) !== n - 1) problems.push('space: REMOVE did not remove the desk');
  await snap('space-removed');
  await tapUndo();
  if (await until((d) => window.__ghosty.space.items.some((i) => i.id === d.id && i.x === d.x && i.y === d.y), 4000, 'space: UNDO did not put the desk back where it was', desk)) done.push('SPACE REMOVE → UNDO');
} else problems.push('space: the desk was not added');

// ---- the phone layout: the bar fits at 440 wide, nothing sideways ----
await page.locator('#pg-space .spacecat button', { hasText: 'Desk' }).click();
await clickJs(page.locator('#pg-space .spacebar button', { hasText: 'REMOVE' }).first());
await sawBar(/Removed/, 'layout check');
const box = await bar.boundingBox();
if (!box || box.x < 0 || box.x + box.width > PHONE.width) problems.push(`the UNDO bar does not fit the phone: ${JSON.stringify(box)}`);
if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) problems.push('the page scrolls sideways with the UNDO bar up');
await snap('bar-on-phone');

await browser.close();
console.log(`Walked: ${done.length}\n  ${done.join('\n  ')}`);
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : `Undo run clean: ${done.length} actions each undone or confirmed on an iPhone-sized screen.`);
process.exit(problems.length ? 1 : 0);
