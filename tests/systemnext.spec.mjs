// SYSTEM AND SETTINGS, the next round (docs/build-plan/next/polish3.md), at 440 × 956 and 390 × 844:
//   a. OFFLINE READY (System → Status): the number, its bar, what is here and what is not with sizes, the next download and GET IT IN
//      SETTINGS opening the panel that fetches it (nothing fetched by looking); a kept pack raises the number; every key 44 pt, nothing
//      sideways, no word cut, in all seven worlds and at BODY 21; "how ready are you offline?" answered on the phone and the panel opened.
//   b. YOUR BACKUP AS A FILE (System → Backup): SAVE AS A FILE hands over the locked copy (a download here), its name and size said;
//      OPEN A BACKUP FILE reads it back, asks first, restores and reloads with what it put back; a file that is not a backup is refused
//      in his words.
//   c. A HEADS-UP: a failing key and a provider nearly out are told once (a toast) and stand at the top of AI ROOM.
//   BASE=http://localhost:8788 node tests/systemnext.spec.mjs [outDir]
import { mkdirSync, readFileSync } from 'node:fs';
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, openPanel } from './nav.mjs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const PHONE2 = { width: 390, height: 844 };
const WORLDS = ['scan', 'map', 'eye', 'orbit', 'grown', 'ink', 'glass'];
const RAW = /\b(undefined|NaN|null|\[object Object\])\b|\$\{/;
const problems = [];
let checks = 0;
const t0 = Date.now();
const check = (ok, msg) => {
  checks++;
  if (!ok) {
    problems.push(msg);
    console.log(`  red: ${msg.slice(0, 280)}`);
  }
};
const log = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s · ${s}`);

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--disable-dev-shm-usage'] });
const live = [];
process.on('uncaughtException', async (e) => {
  problems.push(`crashed: ${String(e.message).split('\n')[0]}`);
  console.log(`PROBLEMS:\n${problems.join('\n')}`);
  process.exit(1);
});

/** One phone, paired, in a world and a text size; `store` seeds localStorage once; `status` replaces the brain's /api/status answer. */
async function phone(viewport, o = {}) {
  const ctx = await browser.newContext({ viewport, screen: viewport, deviceScaleFactor: 1, isMobile: true, hasTouch: true, ...UK, serviceWorkers: 'block', acceptDownloads: true });
  live.push(ctx);
  await ctx.route(/^https:\/\/(?!localhost)/, (route) => route.fulfill({ status: 404, body: '' }));
  if (o.status) await ctx.route('**/api/status', async (route) => {
    const r = await route.fetch().catch(() => null);
    const real = r ? await r.json().catch(() => ({})) : {};
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...real, ...o.status }) });
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${viewport.width}] pageerror: ${e.message}`));
  await page.addInitScript(({ key, body, world, store }) => {
    if (sessionStorage.getItem('sn.seeded')) return;
    sessionStorage.setItem('sn.seeded', '1');
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.themes1', '1');
    localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Tony', speak: false, sounds: false, favourites: [], look: { ground: 'graphite', world, night: 'graphite', switches: body ? { body } : {} }, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
    for (const [k, v] of Object.entries(store ?? {})) localStorage.setItem(k, v);
  }, { key: KEY, body: o.body ?? 0, world: o.world ?? 'scan', store: o.store ?? {} });
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
  return { ctx, page };
}
const until = (page, fn, arg, ms = 10000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const text = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => e.getClientRects().length).map((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim()).join(' | '), sel);
async function openSystem(page, title) {
  await page.evaluate(() => (location.hash = 'system'));
  await page.waitForSelector('#pg-system .pn', { state: 'attached', timeout: 30000 });
  await openPanel(page, 'system', title);
}
/** Every key in `root` at 44 pt, nothing sideways on the page, no word cut inside `root`, no raw string. */
async function fit(page, tag, root) {
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined)))).catch(() => undefined);
  const r = await page.evaluate((root) => {
    const vis = (e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]');
    const all = [...document.querySelectorAll(root)].flatMap((x) => [x, ...x.querySelectorAll('*')]).filter(vis);
    const small = all.filter((e) => e.matches('button, summary, input:not([type=hidden]):not([type=file]), select, [role=button]')).map((e) => {
      const b = e.getBoundingClientRect();
      return b.width >= 43.5 && b.height >= 43.5 ? '' : `${e.tagName.toLowerCase()} "${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24)}" ${Math.round(b.width)}×${Math.round(b.height)}`;
    }).filter(Boolean);
    const sideways = document.documentElement.scrollWidth > innerWidth + 1;
    const cut = all.filter((e) => !e.matches('input, select, textarea') && e.textContent.trim() && e.scrollWidth > e.clientWidth + 1 && /(hidden|clip)/.test(getComputedStyle(e).overflowX)).map((e) => e.textContent.trim().slice(0, 30));
    return { small: small.slice(0, 6), sideways, cut: cut.slice(0, 4), words: [...document.querySelectorAll(root)].map((x) => x.innerText).join(' ') };
  }, root);
  check(!r.small.length, `${tag}: under 44 pt: ${r.small.join(', ')}`);
  check(!r.sideways, `${tag}: sideways`);
  check(!r.cut.length, `${tag}: words cut: ${r.cut.join(' | ')}`);
  check(!RAW.test(r.words), `${tag}: a raw string: ${(RAW.exec(r.words) ?? [''])[0]}`);
}
const READY = '#pg-system .pn.offready';
const readyNow = (page) => page.evaluate((sel) => {
  const p = document.querySelector(sel);
  return { pct: p?.querySelector('.ordyhead b')?.textContent ?? '', head: (p?.querySelector('.ordyhead')?.textContent ?? '').trim(), next: p?.querySelector('.ordynext')?.textContent ?? '', bar: p?.querySelector('.ordybar')?.getAttribute('aria-valuenow') ?? '', rows: [...(p?.querySelectorAll('.ordyrow') ?? [])].map((r) => ({ id: r.dataset.piece, state: r.dataset.state, k: r.querySelector('.k')?.textContent ?? '', size: (r.querySelector('.ordysize')?.textContent ?? '').replace(/^ · /, '') })), get: !!p?.querySelector('button.on') };
}, READY);

// ================================================================== a. OFFLINE READY
for (const vp of [PHONE, PHONE2]) {
  const W = vp.width;
  log(`${W}: OFFLINE READY`);
  const asked = [];
  const { ctx, page } = await phone(vp);
  page.on('request', (r) => /\/models\/|huggingface|\/vendor\/webllm|tiles\.openfreemap/.test(r.url()) && asked.push(r.url()));
  await openSystem(page, 'OFFLINE READY');
  check(await until(page, (s) => !!document.querySelector(s)?.querySelector('.ordyhead'), READY), `[${W}] [a] no OFFLINE READY panel`);
  const r0 = await readyNow(page);
  check(r0.head === '0% works with no signal' && r0.bar === '0', `[${W}] [a] nothing kept reads "${r0.head}" (bar ${r0.bar})`);
  check(r0.rows.length === 11 && r0.rows.every((x) => x.state === 'missing' || x.state === 'cannot'), `[${W}] [a] the pieces: ${JSON.stringify(r0.rows)}`);
  check(r0.rows.filter((x) => x.state === 'missing').every((x) => x.k === 'TO GET' && /^(about )?\d[\d.]* (KB|MB|GB)$/.test(x.size)), `[${W}] [a] a missing piece does not say its size: ${JSON.stringify(r0.rows.map((x) => [x.k, x.size]))}`);
  // the next download: the heaviest this phone can run, with its size and what it keeps working
  const runsBrain = await page.evaluate(() => 'gpu' in navigator);
  check(runsBrain ? /^Next: The offline brain, \d+ MB on Wi-Fi, for answers, the interpreter’s translations and School papers \(34% after\)\.$/.test(r0.next) : /^Next: The (offline map|Lens’s eyes), /.test(r0.next), `[${W}] [a] the next download reads "${r0.next}"`);
  check(r0.get, `[${W}] [a] no GET IT IN SETTINGS`);
  if (!runsBrain) check(r0.rows.some((x) => x.id === 'brain' && x.state === 'cannot' && x.k === 'CAN’T'), `[${W}] [a] a phone with no WebGPU does not say it can’t run the brain`);
  await fit(page, `[${W}] [a scan]`, READY);
  await page.screenshot({ path: `${out}/systemnext-ready-${W}.png` });
  // GET IT opens the panel that fetches it; nothing is fetched by looking or by opening
  await page.locator(`${READY} button.on`).click();
  const want = runsBrain ? 'OFFLINE BRAIN' : 'OFFLINE';
  check(await until(page, (w) => document.body.dataset.tab === 'settings' && [...document.querySelectorAll('#pg-settings .pn.pushed .ptitle')].some((t) => t.textContent.startsWith(w)), want, 10000), `[${W}] [a] GET IT did not open Settings → ${want} (on ${await page.evaluate(() => document.body.dataset.tab)})`);
  await page.waitForTimeout(300);
  check(asked.length === 0, `[${W}] [a] looking fetched ${asked.length} files: ${asked.slice(0, 2).join(', ')}`);
  // a pack that finished (its kept record) raises the number, and the panel says it is here
  await page.evaluate(() => localStorage.setItem('ghosty.pack.kept', JSON.stringify({ 'eyes-lens': { files: 4, bytes: 20e6, at: Date.now() } })));
  // (System counts again each time it is opened)
  await page.evaluate(() => { location.hash = 'core'; });
  await page.waitForSelector('#cin', { state: 'visible', timeout: 15000 });
  await openSystem(page, 'OFFLINE READY');
  await until(page, (s) => /HERE/.test(document.querySelector(s)?.textContent ?? ''), READY, 8000);
  const r1 = await readyNow(page);
  const lensPct = runsBrain ? 15 : Math.round((15 / 58) * 100);
  check(r1.pct === `${lensPct}%` && r1.rows.some((x) => x.id === 'eyes-lens' && x.state === 'here' && x.k === 'HERE'), `[${W}] [a] with the Lens's eyes kept it reads ${r1.pct} (want ${lensPct}%): ${JSON.stringify(r1.rows.find((x) => x.id === 'eyes-lens'))}`);
  // the chat: answered on the phone, the panel opened
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForSelector('#cin', { state: 'visible', timeout: 15000 });
  const sent = await page.evaluate(() => Date.now());
  await page.fill('#cin', 'how ready are you offline?');
  await page.keyboard.press('Enter');
  const reply = await page.waitForFunction(({ t }) => {
    const msgs = [...document.querySelectorAll('#pg-core .msg')];
    const mine = msgs.map((m) => m.classList.contains('me') && Number(m.dataset.at ?? 0) >= t).lastIndexOf(true);
    const r = mine < 0 ? null : msgs.slice(mine + 1).find((m) => !m.classList.contains('me') && /works with no signal/.test(m.textContent ?? ''));
    return r ? (r.textContent ?? '').replace(/\s+/g, ' ') : null;
  }, { t: sent }, { timeout: 20000 }).then((h) => h.jsonValue(), () => '');
  check(new RegExp(`${lensPct}% works with no signal right now\\. Here: the Lens’s eyes\\. Next: `).test(reply), `[${W}] [a chat] "how ready are you offline?" answered "${reply.slice(0, 200)}"`);
  check(await until(page, () => document.body.dataset.tab === 'system', null, 8000), `[${W}] [a chat] the answer did not open System`);
  await ctx.close();
}

// the seven worlds at 390, and BODY 21 at 440: nothing small, sideways or cut
for (const world of WORLDS) {
  const { ctx, page } = await phone(PHONE2, { world });
  await openSystem(page, 'OFFLINE READY');
  await until(page, (s) => !!document.querySelector(s)?.querySelector('.ordyhead'), READY);
  await fit(page, `[390 ${world}] [a]`, READY);
  await ctx.close();
}
{
  const { ctx, page } = await phone(PHONE, { body: 21 });
  await openSystem(page, 'OFFLINE READY');
  await until(page, (s) => !!document.querySelector(s)?.querySelector('.ordyhead'), READY);
  await fit(page, '[440 body 21] [a]', READY);
  await page.screenshot({ path: `${out}/systemnext-ready-body21.png` });
  await ctx.close();
}

// ================================================================== b. YOUR BACKUP AS A FILE
for (const vp of [PHONE2]) {
  const W = vp.width;
  log(`${W}: the backup as a file`);
  const { ctx, page } = await phone(vp, { store: { 'ghosty.radio.favs': JSON.stringify([{ id: 'sn-test', name: 'Spec Radio' }]) } });
  await openSystem(page, 'BACKUP');
  const save = page.locator('#pg-system button[data-act="backupfile"]');
  check(await save.waitFor({ timeout: 15000 }).then(() => true, () => false), `[${W}] [b] no SAVE AS A FILE`);
  await fit(page, `[${W}] [b]`, '#pg-system .backupfile');
  const dl = page.waitForEvent('download', { timeout: 30000 }).catch(() => null);
  await save.click();
  const d = await dl;
  const name = d?.suggestedFilename() ?? '';
  check(/^ghosty-backup-\d{4}-\d\d-\d\d\.json$/.test(name), `[${W}] [b] the file is named "${name}"`);
  const path = d ? await d.path().catch(() => null) : null;
  const body = path ? readFileSync(path, 'utf8') : '';
  let doc = null;
  try { doc = JSON.parse(body); } catch { /* checked below */ }
  check(doc?.kind === 'ghosty-backup' && typeof doc?.sealed?.ct === 'string' && !body.includes('Spec Radio'), `[${W}] [b] the file is not the locked copy (or shows its contents): ${body.slice(0, 120)}`);
  const said = await until(page, () => /^Saved ghosty-backup-.+\.json \(\d+(\.\d)? (KB|MB)\), locked with your owner key; keep it in Files or iCloud Drive\.$/.test(document.querySelector('#pg-system .backupmsg')?.textContent ?? ''), null, 10000);
  check(said, `[${W}] [b] after SAVE it says "${await text(page, '#pg-system .backupmsg')}"`);
  // a file that is not a backup is refused in his words
  await page.locator('#pg-system .backupfile input[type=file]').setInputFiles({ name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
  check(await until(page, () => /isn’t one of my backups/.test(document.querySelector('#pg-system .backupmsg')?.textContent ?? ''), null, 8000), `[${W}] [b] a wrong file says "${await text(page, '#pg-system .backupmsg')}"`);
  // the favourite gone from this phone, then the file brings it back: asked first, then restored and reloaded
  await page.evaluate(() => localStorage.removeItem('ghosty.radio.favs'));
  if (path) {
    await page.locator('#pg-system .backupfile input[type=file]').setInputFiles(path);
    const sheet = page.locator('.modal .rpsheet');
    check(await sheet.waitFor({ timeout: 8000 }).then(() => true, () => false), `[${W}] [b] OPEN A BACKUP FILE did not show what it would bring back first`);
    // (polish3.u4) each thing with what a restore does to it, ticked; unticking one leaves it as it is here
    const items = await page.evaluate(() => [...document.querySelectorAll('.modal .rpsheet .rpitem')].map((x) => ({ key: x.dataset.key, result: x.dataset.result, on: x.getAttribute('aria-checked'), words: (x.textContent ?? '').replace(/\s+/g, ' ') })));
    check(items.some((x) => x.key === 'ghosty.radio.favs' && x.result === 'restored' && x.on === 'true' && /radio favourites/.test(x.words) && /Comes back from the backup/.test(x.words)), `[${W}] [b] the preview lists ${JSON.stringify(items).slice(0, 300)}`);
    check(items.some((x) => x.key === 'ghosty.settings' && x.result === 'same' && x.on === null && /Already the same here/.test(x.words)), `[${W}] [b] the settings are not said to be the same here: ${JSON.stringify(items.find((x) => x.key === 'ghosty.settings'))}`);
    const go1 = await page.locator('.modal .rpsheet button.sureyes').textContent();
    await page.locator('.modal .rpsheet button.rpitem[data-key="ghosty.radio.favs"]').click();
    const go2 = await page.locator('.modal .rpsheet button.sureyes').textContent();
    check(/^RESTORE \d+ THINGS?$/.test(go1 ?? '') && go1 !== go2, `[${W}] [b] unticking does not change the key: "${go1}" → "${go2}"`);
    await page.locator('.modal .rpsheet button.rpitem[data-key="ghosty.radio.favs"]').click();
    await fit(page, `[${W}] [b preview]`, '.modal .rpsheet');
    const nav = page.waitForEvent('load', { timeout: 30000 }).catch(() => null);
    await page.locator('.modal button.sureyes').click();
    await nav;
    await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 }).catch(() => undefined);
    const fav = await page.evaluate(() => localStorage.getItem('ghosty.radio.favs') ?? '');
    check(/Spec Radio/.test(fav), `[${W}] [b] the restore from the file did not bring back the radio favourite: "${fav}"`);
  }
  await ctx.close();
}

// ================================================================== b2. the comics and games he made ride the backup (polish3.c1)
{
  log('390: comics and games in the backup');
  const { createRequire } = await import('node:module');
  const { buildSync } = createRequire(new URL('../apps/web/package.json', import.meta.url))('esbuild');
  const root = new URL('../', import.meta.url).pathname;
  const r = buildSync({
    stdin: { contents: "import { collect, restoreEditors, reportText } from './apps/web/src/features/system/backup.ts';\nimport * as cs from './apps/web/src/features/comic/store.ts';\nimport * as gs from './apps/web/src/studio-game/store.ts';\nimport { template } from './apps/web/src/studio-game/model.ts';\nwindow.__bk = { collect, restoreEditors, reportText, cs, gs, template };", resolveDir: root, loader: 'ts' },
    bundle: true, write: false, format: 'iife', platform: 'browser', logLevel: 'silent', loader: { '.css': 'empty' },
  });
  const { ctx, page } = await phone(PHONE2);
  await page.evaluate(r.outputFiles[0].text);
  const got = await page.evaluate(async () => {
    const B = window.__bk;
    const game = B.template('platformer', 'Spec Jumper');
    await B.gs.putGame(game, '');
    const book = { id: 'spec-comic-1', title: 'Spec Comic', from: 'made', pages: 2, bytes: 100, added: Date.now(), kind: 'a comic you made' };
    await B.cs.updateBook(book);
    await B.cs.keepMade(book.id, { id: book.id, title: 'Spec Comic', panels: ['a hero', 'a twist'] });
    const bundle = await B.collect();
    const inGame = bundle.editors?.games?.some((x) => x.game.id === game.id && x.game.name === 'Spec Jumper');
    const inComic = bundle.editors?.comics?.some((x) => x.book.id === book.id && x.made?.panels?.length === 2);
    await B.gs.removeGame(game.id);
    await B.cs.dropBook(book.id);
    const out = { restored: [], merged: [], same: [], skipped: [], docs: 0, photos: 0, looks: 0, videos: 0, photosAway: 0 };
    await B.restoreEditors(bundle.editors, out);
    const backGame = (await B.gs.getGame(game.id))?.name ?? '';
    const backComic = (await B.cs.bookOf(book.id))?.title ?? '';
    const backMade = await B.cs.madeOf(book.id);
    const words = B.reportText(out);
    await B.gs.removeGame(game.id);
    await B.cs.dropBook(book.id);
    return { inGame, inComic, backGame, backComic, made: !!backMade, out, words };
  }).catch((e) => ({ error: String(e.message).split('\n')[0] }));
  if (got.error) check(false, `[b2] the comics and games backup could not be tried: ${got.error}`);
  else {
    check(got.inGame && got.inComic, `[b2] the backup does not carry the game and the comic: ${JSON.stringify(got)}`);
    check(got.backGame === 'Spec Jumper' && got.backComic === 'Spec Comic' && got.made, `[b2] a restore did not put them back: ${JSON.stringify(got)}`);
    check(got.words === 'Put back in the editors: 1 comic you made, 1 game you made.', `[b2] the restore says "${got.words}"`);
  }
  await ctx.close();
}

// ================================================================== d. THE SAVER (polish3.s1)
for (const vp of [PHONE2]) {
  const W = vp.width;
  log(`${W}: the saver`);
  const { ctx, page } = await phone(vp);
  await page.evaluate(() => (location.hash = 'settings'));
  await page.waitForSelector('#pg-settings .pn', { state: 'attached', timeout: 30000 });
  await openPanel(page, 'settings', 'SAVER');
  const sw = page.locator('#pg-settings button.setsw[data-act="saver"]');
  check(await sw.waitFor({ timeout: 10000 }).then(() => true, () => false), `[${W}] [d] no Saver switch`);
  check((await sw.getAttribute('aria-checked')) === 'false' && /^Off: downloads and feeds run as usual\.$/.test(await text(page, '#pg-settings .saverline')), `[${W}] [d] the saver does not start off, said: "${await text(page, '#pg-settings .saverline')}"`);
  await sw.click();
  check((await sw.getAttribute('aria-checked')) === 'true' && /^Nothing held back yet\.$/.test(await text(page, '#pg-settings .saverline')), `[${W}] [d] on, it reads "${await text(page, '#pg-settings .saverline')}"`);
  await fit(page, `[${W}] [d]`, '#pg-settings .saverpn');
  // a big download is held, in his words, and listed
  const asked = [];
  page.on('request', (r) => /\/models\/|huggingface|\/vendor\//.test(r.url()) && asked.push(r.url()));
  await page.click('#top .navback').catch(() => undefined);
  await openPanel(page, 'settings', 'OFFLINE EYES');
  await page.locator('#pg-settings .wikioffer[data-pack="eyes-name"] button[data-act="get"]').click().catch(() => problems.push(`[${W}] [d] no GET on the namer`));
  const sure = page.locator('.modal button.sureyes');
  if (await sure.waitFor({ timeout: 3000 }).then(() => true, () => false)) await sure.click();
  const saidHeld = await until(page, () => /Saver is on, so big downloads wait/.test(document.body.textContent ?? ''), null, 8000);
  check(saidHeld, `[${W}] [d] the namer's GET did not say the saver holds it`);
  check(asked.length === 0, `[${W}] [d] the saver let ${asked.length} files through`);
  await page.click('#top .navback').catch(() => undefined);
  await openPanel(page, 'settings', 'SAVER');
  check(/^Held back while it is on: The namer\.$/.test(await text(page, '#pg-settings .saverline')), `[${W}] [d] the list reads "${await text(page, '#pg-settings .saverline')}"`);
  // and by voice: "saver off"
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForSelector('#cin', { state: 'visible', timeout: 15000 });
  const sent = await page.evaluate(() => Date.now());
  await page.fill('#cin', 'saver off');
  await page.keyboard.press('Enter');
  const reply = await page.waitForFunction(({ t }) => {
    const msgs = [...document.querySelectorAll('#pg-core .msg')];
    const mine = msgs.map((m) => m.classList.contains('me') && Number(m.dataset.at ?? 0) >= t).lastIndexOf(true);
    const r = mine < 0 ? null : msgs.slice(mine + 1).find((m) => !m.classList.contains('me') && /Saver is/.test(m.textContent ?? ''));
    return r ? (r.textContent ?? '').replace(/\s+/g, ' ') : null;
  }, { t: sent }, { timeout: 20000 }).then((h) => h.jsonValue(), () => '');
  check(/Saver is off: downloads and the feeds run as usual\./.test(reply), `[${W}] [d chat] "saver off" answered "${reply.slice(0, 160)}"`);
  // (the phone keeps it a moment after the change: waited for, not slept)
  check(await until(page, () => JSON.parse(localStorage.getItem('ghosty.saver') ?? '{}').on === false, null, 5000), `[${W}] [d chat] the saver is still on`);
  await ctx.close();
}

// ================================================================== e. WHAT I KEEP ABOUT YOU (polish3.s2, memory.s6)
for (const vp of [PHONE, PHONE2]) {
  const W = vp.width;
  log(`${W}: what I keep about you`);
  const { ctx, page } = await phone(vp);
  await page.evaluate(() => (location.hash = 'settings'));
  await page.waitForSelector('#pg-settings .pn', { state: 'attached', timeout: 30000 });
  await openPanel(page, 'settings', 'PRIVACY');
  check(await until(page, () => document.querySelectorAll('#pg-settings .keptblock .keptkind').length >= 2, null, 15000), `[${W}] [e] no WHAT I KEEP ABOUT YOU: "${await text(page, '#pg-settings .keptblock')}"`);
  const kinds = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#pg-settings .keptblock .keptkind')].map((k) => [k.dataset.kind, (k.querySelector('.rw .v')?.textContent ?? '').trim()])));
  check(/^(Nothing remembered yet|\d+ things? remembered, in your brain)$/.test(kinds.memory ?? '') && /^(No places saved|\d+ places? saved: .+)$/.test(kinds.places ?? ''), `[${W}] [e] memory and places read ${JSON.stringify(kinds)}`);
  check(kinds.faces === 'No faces kept' && kinds.voices === 'No voices kept', `[${W}] [e] faces and voices on a fresh phone read ${JSON.stringify([kinds.faces, kinds.voices])}`);
  await fit(page, `[${W}] [e]`, '#pg-settings .keptblock');
  if (W === 390) {
    const dl = page.waitForEvent('download', { timeout: 20000 }).catch(() => null);
    await page.locator('#pg-settings button[data-act="exportmemory"]').click();
    const d = await dl;
    const name = d?.suggestedFilename() ?? '';
    const path = d ? await d.path().catch(() => null) : null;
    const doc = path ? readFileSync(path, 'utf8') : '';
    check(/^ghosty-memory-\d{4}-\d\d-\d\d\.txt$/.test(name) && /^What Ghosty remembers about you\nWritten on \d{1,2} \w{3} \d{4}: \d+ things?\.\n/.test(doc), `[${W}] [e] the memory document: "${name}" ${JSON.stringify(doc.slice(0, 120))}`);
    // a face on this phone is counted, and FORGET ALL FACES asks first, then they go
    await page.evaluate(() => new Promise((ok) => {
      const r = indexedDB.open('ghosty-faces', 1);
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('people')) r.result.createObjectStore('people', { keyPath: 'id' }); };
      r.onsuccess = () => {
        const db = r.result;
        const names = [...db.objectStoreNames];
        if (!names.length) return ok(false);
        const t = db.transaction(names[0], 'readwrite');
        t.objectStore(names[0]).put({ id: 'me', name: 'You', me: true, looks: [Array.from({ length: 128 }, (_, i) => (i % 7) / 7)], at: Date.now() });
        t.oncomplete = () => ok(true);
        t.onerror = () => ok(false);
      };
      r.onerror = () => ok(false);
    }));
    await page.click('#top .navback').catch(() => undefined);
    await openPanel(page, 'settings', 'PRIVACY');
    const faceLine = await until(page, () => /^Your face, on this phone only$/.test(document.querySelector('#pg-settings .keptkind[data-kind="faces"] .rw .v')?.textContent?.trim() ?? ''), null, 10000);
    check(faceLine, `[${W}] [e] a kept face reads "${await text(page, '#pg-settings .keptkind[data-kind="faces"] .rw .v')}"`);
    if (faceLine) {
      await page.locator('#pg-settings button[data-act="forgetfaces"]').click();
      check(await page.locator('.modal button.sureyes').waitFor({ timeout: 5000 }).then(() => true, () => false), `[${W}] [e] FORGET ALL FACES did not ask first`);
      await page.locator('.modal button.sureyes').click();
      check(await until(page, () => document.querySelector('#pg-settings .keptkind[data-kind="faces"] .rw .v')?.textContent?.trim() === 'No faces kept', null, 10000), `[${W}] [e] the face did not go: "${await text(page, '#pg-settings .keptkind[data-kind="faces"] .rw .v')}"`);
    }
  }
  await ctx.close();
}

// ================================================================== f. A SCREEN THAT GOT SLOWER (polish3.u11)
{
  log('390: slower since the update');
  // the build this preview serves (build.mjs writes it into the app), and screen timings kept from an older one
  const sha = ([...readFileSync(new URL('../apps/web/dist/app.js', import.meta.url), 'utf8').matchAll(/sha:"([^"]+)"/g)].map((m) => m[1]).find((x) => x !== 'dev')) ?? 'dev';
  const { ctx, page } = await phone(PHONE2);
  const seeded = await page.evaluate((sha) => new Promise((ok) => {
    const r = indexedDB.open('ghosty-speed');
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv'); };
    r.onsuccess = () => {
      const db = r.result;
      const tab = (ms, b) => ({ k: 'tab', at: Date.now() - 60000, id: 'agenda', title: 'AGENDA', ms, b });
      const t = db.transaction('kv', 'readwrite');
      t.objectStore('kv').put([...[100, 110, 105, 100].map((ms) => tab(ms, 'spec-older-build')), ...[400, 420, 410].map((ms) => tab(ms, sha))], 'samples');
      t.oncomplete = () => { db.close(); ok(true); };
      t.onerror = () => ok(false);
    };
    r.onerror = () => ok(false);
  }), sha);
  check(seeded, '[f] the timings could not be seeded');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
  await openSystem(page, 'STATUS');
  const ok = await until(page, () => /^Slower since the update/.test(document.querySelector('#pg-system .spdrow[data-speed="slower"]')?.textContent ?? ''), null, 15000);
  const words = await text(page, '#pg-system .spdrow[data-speed="slower"]');
  check(ok && /Agenda 0\.4 s, was 0\.1 s/i.test(words), `[f] the SPEED card says "${words}"`);
  await fit(page, '[390] [f]', '#pg-system .spdrow[data-speed="slower"]');
  await ctx.close();
}

// ================================================================== c. A HEADS-UP
for (const vp of [PHONE, PHONE2]) {
  const W = vp.width;
  log(`${W}: the heads-up`);
  const now = Date.now();
  const status = { models: [{ provider: 'groq', model: 'chat', state: 'dead', info: 'The key was refused.' }], capacity: { summary: 'Plenty of room', providers: [{ provider: 'gemini', state: 'busy', roomNow: 2, perMinute: 10, usedToday: 460, perDay: 500, resetAt: now + 3600e3 }] } };
  const { ctx, page } = await phone(vp, { status });
  const toasted = await until(page, () => [...document.querySelectorAll('.toast, #toasts *')].some((t) => /Groq’s key has stopped working/.test(t.textContent ?? '')), null, 20000);
  check(toasted, `[${W}] [c] no heads-up for the failing key`);
  await openSystem(page, 'AI ROOM');
  check(await until(page, () => document.querySelectorAll('#pg-system .headsup').length >= 2, null, 15000), `[${W}] [c] AI ROOM does not keep the heads-ups: "${await text(page, '#pg-system .airoom .bd')}"`);
  const lines = await text(page, '#pg-system .headsup');
  check(/Groq’s key has stopped working: The key was refused\. System, Keys: paste a fresh key/.test(lines) && /Gemini has used 460 of its 500 free calls today/.test(lines), `[${W}] [c] the heads-ups read "${lines}"`);
  await fit(page, `[${W}] [c]`, '#pg-system .airoom');
  // told once: a reload says nothing again
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
  const again = await until(page, () => [...document.querySelectorAll('.toast, #toasts *')].some((t) => /Groq’s key has stopped working/.test(t.textContent ?? '')), null, 6000);
  check(!again, `[${W}] [c] the heads-up was told twice`);
  await ctx.close();
}

await browser.close();
const secs = ((Date.now() - t0) / 1000).toFixed(0);
if (problems.length) {
  process.exitCode = 1;
  console.log(`PROBLEMS (${problems.length} of ${checks} checks):\n${problems.join('\n')}`);
} else console.log(`SYSTEM NEXT clean: ${checks} checks in ${secs} s: OFFLINE READY (the number, the pieces with sizes, the next download, GET IT, a kept pack counted, the chat, seven worlds and BODY 21), the backup kept as a file and read back, the comics and games you made in the backup, the saver holding a download and switched by voice, what I keep about you with its forget keys and the memory document, a screen that got slower since the update, and a heads-up told once.`);
