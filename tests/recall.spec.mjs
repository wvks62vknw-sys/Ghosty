// MEMORY AND RECALL on the phone (BRIEF-DEPTH-MEMORY), at 440 × 956 and 390 × 844:
//  (a) the on-phone index builds at idle from the log (and the brain's history), the editors' stores (a document and a workspace
//      page the spec seeds) and its size shows in SYSTEM → STORAGE;
//  (b) "what did I ask you about trains?" answers on the phone under a second with the right turns, offline too, and a tap opens
//      the turn;
//  (c) MEMORY → FIND "garden" finds the workspace page and the document;
//  (d) a reply carrying "like you said on Tuesday" shows the RECALL chip, and it opens the turn;
//  (e) "remind me to chase this if Sam doesn't reply by Thursday" sets the chase with its sentence; WATCHERS lists it with STOP;
//  (f) each state's words (cold, nothing found), every control 44 pt, nothing sideways, BODY 21 clips no recall row, and the first
//      screen arrives with the index present.
//   node tests/recall.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { openSection, PHONE, UK } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const PHONE2 = { width: 390, height: 844 };
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const problems = [];
const check = (ok, msg) => ok || problems.push(msg);
const log = (m) => console.log(`recall: ${m}`);

const DAY = 86_400_000;
// the last Tuesday before today (one to seven days ago), 10:00
const tuesday = (() => {
  const d = new Date();
  d.setHours(10, 0, 0, 0);
  do d.setTime(d.getTime() - DAY);
  while (d.getDay() !== 2);
  return d.getTime();
})();
const now = Date.now();
const TURNS = [
  { at: tuesday, q: 'what are the trains to Leeds tomorrow morning', a: 'The 07:12 from New Street is quickest.' },
  { at: tuesday + 3600_000, q: 'how do I fix a squeaky door', a: 'A drop of oil on the hinge pin.' },
  { at: now - 2 * DAY - 7200_000, q: 'is there a train strike on Friday', a: 'No strike is planned on your line.' },
  { at: now - 3 * 3600_000, q: 'book the dentist for next week', a: 'Done: Tuesday at 9.' },
];
const DOC = { id: 'doc-garden', title: 'Letter to the council', kind: 'letter', at: now - 4 * DAY, blocks: [{ id: 'b1', t: 'p', runs: [{ text: 'Dear Sir,' }] }, { id: 'b2', t: 'p', runs: [{ text: 'The hedge at the back of my garden overhangs the footpath and I would like it cut.' }] }] };
const WS = { v: 1, at: now - DAY, versions: {}, pages: { pg1: { id: 'pg1', title: 'Spring plans', icon: 'page', parent: null, at: now - DAY, created: now - 5 * DAY, blocks: [{ id: 'w1', t: 'p', runs: [{ text: 'Plant garlic and broad beans in the garden bed by the shed.' }] }] } } };

const small = (page, sel) =>
  page.$$eval(`${sel} :is(button, input:not([type=hidden]):not([type=file]), textarea, select, [role=button])`, (els) =>
    els
      .filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]'))
      .map((e) => {
        const r = e.getBoundingClientRect();
        return r.width >= 43.5 && r.height >= 43.5 ? '' : `${e.tagName.toLowerCase()} "${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24)}" ${Math.round(r.width)}×${Math.round(r.height)}`;
      })
      .filter(Boolean)
      .slice(0, 6),
  );
const sideways = (page) => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
const clipped = (page, sel) => page.$$eval(sel, (els) => els.filter((e) => e.getClientRects().length && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 2)).map((e) => (e.textContent ?? '').slice(0, 40)));
const until = (page, fn, arg, ms = 8000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);

async function run(vp, body) {
  const T = `[${vp.width}${body ? ` body ${body}` : ''}]`;
  const ctx = await browser.newContext({ viewport: vp, ...UK });
  // the brain's chat, stood in: a reply that remembers Tuesday (d); everything else goes to the preview brain
  let reply = '';
  await ctx.route('**/api/chat', (route) => {
    if (!reply) return route.continue();
    const lines = [{ t: 'text', text: reply }, { t: 'done', model: 'Mock · scripted' }].map((e) => JSON.stringify(e)).join('\n') + '\n';
    return route.fulfill({ status: 200, headers: { 'content-type': 'application/x-ndjson' }, body: lines });
  });
  await ctx.route(/^https:\/\/(?!localhost)/, (route) => route.fulfill({ status: 404, body: '' }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`${T} pageerror: ${e.message}`));
  await page.addInitScript(({ key, turns, doc, ws, body }) => {
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Tony', speak: false, sounds: false, favourites: [], look: { ground: 'graphite', world: 'scan', night: 'graphite', switches: body ? { body } : {} }, home: { name: 'London', lat: 51.5, lon: -0.12 } }));
    if (!localStorage.getItem('ghosty.recall.seeded')) {
      localStorage.setItem('ghosty.recall.seeded', '1');
      localStorage.setItem('ghosty.chat', JSON.stringify({ entries: turns.flatMap((t) => [{ kind: 'user', text: t.q, at: t.at }, { kind: 'assistant', text: t.a, at: t.at + 4000 }]) }));
      localStorage.setItem('ghosty.docs', JSON.stringify([doc]));
      localStorage.setItem('ghosty.workspace', JSON.stringify(ws));
    }
    window.__ghostyHero = true;
    window.__ghostyPlace = { none: true };
  }, { key: KEY, turns: TURNS, doc: DOC, ws: WS, body });
  // the brain holds the same turns (its history fills the phone's gaps after a reinstall)
  await page.goto(`${base}/api/health`).catch(() => undefined);
  await page.evaluate(async ({ key, turns }) => {
    await fetch('/api/history', { method: 'DELETE', headers: { 'x-ghosty': '1', 'x-ghosty-key': key } }).catch(() => undefined);
    await fetch('/api/history', { method: 'POST', headers: { 'x-ghosty': '1', 'x-ghosty-key': key, 'content-type': 'application/json' }, body: JSON.stringify({ turns: turns.flatMap((t) => [{ role: 'user', text: t.q, at: t.at }, { role: 'assistant', text: t.a, at: t.at + 4000 }]) }) }).catch(() => undefined);
  }, { key: KEY, turns: TURNS });
  const t0 = Date.now();
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
  const firstScreen = Date.now() - t0;
  log(`${T} first screen in ${firstScreen} ms`);

  // (f) the first screen comes before the index: it starts only after Home is up
  const early = await page.evaluate(() => window.__ghosty?.recall?.state ?? 'none');
  check(early === 'cold' || early === 'none' || early === 'building' || early === 'warm', `${T} [f] the index state reads ${early}`);

  // (a) the index builds at idle from the log, the brain's history and the editors' stores
  const built = await until(page, () => window.__ghosty?.recall?.state === 'warm' && window.__ghosty.recall.items >= 6, null, 20000);
  const st = await page.evaluate(() => ({ ...window.__ghosty?.recall }));
  check(built, `${T} [a] the index never built: ${JSON.stringify(st)}`);
  log(`${T} index: ${st.items} things, ${st.bytes} bytes, built in ${st.ms} ms`);

  // (a) its size in SYSTEM → STORAGE, with CLEAR
  await page.evaluate(() => (location.hash = 'system'));
  await page.waitForSelector('#pg-system', { state: 'attached', timeout: 10000 });
  await openSection(page, 'system', 'Backup');
  const sized = await until(page, () => /Recall index: \d+ things?, \d+(\.\d)? (KB|MB), kept only on this phone\./.test(document.querySelector('#pg-system .recallindex')?.textContent ?? ''), null, 8000);
  check(sized, `${T} [a] STORAGE does not say the index's size: "${await page.evaluate(() => document.querySelector('#pg-system .recallindex')?.textContent ?? '(none)')}"`);
  const s1 = await small(page, '#pg-system .recallidx');
  check(!s1.length, `${T} [f] STORAGE's recall row under 44 pt: ${s1.join(', ')}`);

  // (b) "what did I ask you about trains?": on the phone, under a second, the right turns
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(400);
  const ask = (q) => page.evaluate(async (q) => {
    const n = document.querySelectorAll('.recallcard').length;
    const t0 = performance.now();
    await window.__ghosty.send(q);
    while (document.querySelectorAll('.recallcard, .msg.ai').length && document.querySelectorAll('.recallcard').length <= n && performance.now() - t0 < 4000) await new Promise((r) => requestAnimationFrame(r));
    const cards = document.querySelectorAll('.recallcard');
    const last = cards[cards.length - 1];
    return { ms: Math.round(performance.now() - t0), rows: last && cards.length > n ? [...last.querySelectorAll('.recallrow')].map((r) => r.textContent ?? '') : [] };
  }, q);
  const b1 = await ask('what did I ask you about trains?');
  log(`${T} recall warm: ${b1.ms} ms, ${b1.rows.length} rows`);
  check(b1.ms < 1000, `${T} [b] recall took ${b1.ms} ms (under a second)`);
  check(b1.rows.length >= 2 && /trains to Leeds/.test(b1.rows.join(' ')) && /train strike/.test(b1.rows.join(' ')), `${T} [b] the wrong turns: ${JSON.stringify(b1.rows)}`);
  check(!/squeaky|dentist/.test(b1.rows.join(' ')), `${T} [b] a turn about something else came up: ${JSON.stringify(b1.rows)}`);
  // offline: the same
  await ctx.setOffline(true);
  const b2 = await ask('when did I mention trains');
  check(b2.rows.length >= 2 && b2.ms < 1000, `${T} [b offline] ${b2.ms} ms, ${JSON.stringify(b2.rows)}`);
  const none = await ask('what did I ask you about volcanoes?');
  const lastAi = await page.evaluate(() => [...document.querySelectorAll('.log .msg')].pop()?.textContent ?? '');
  check(/Nothing like that: I can’t find a time you asked me about “volcanoes”\./.test(lastAi), `${T} [f nothing] said "${lastAi.slice(0, 120)}" (${none.rows.length} rows)`);
  await ctx.setOffline(false);
  // a tap opens the turn
  await page.evaluate(() => document.querySelector('#pg-core .hud.core')?.classList.add('logopen'));
  const s2 = await small(page, '.log .recallcard');
  check(!s2.length, `${T} [f] the RECALL card under 44 pt: ${s2.join(', ')}`);
  const cut = await clipped(page, '.log .recallcard .recallgo');
  check(!cut.length, `${T} [f] a RECALL row is clipped: ${JSON.stringify(cut)}`);
  await page.locator('.log .recallcard .recallgo').first().click();
  const opened = await until(page, () => !!document.querySelector('#pg-core .log .msg.me.found') || /Your chat ·/.test(document.querySelector('.modal, dialog, .g-modal')?.textContent ?? ''), null, 4000);
  check(opened, `${T} [b] a tap on a turn did not open it`);
  await page.keyboard.press('Escape').catch(() => undefined);
  await page.screenshot({ path: `${out}/recall-card-${vp.width}${body ? '-b' : ''}.png` }).catch(() => undefined);

  // (d) a reply that says "like you said on Tuesday": the RECALL chip, and it opens Tuesday's turn
  reply = 'Like you said on Tuesday, the 07:12 from New Street is the quickest train to Leeds.';
  await page.evaluate(() => window.__ghosty.send('which train to Leeds again?'));
  const chip = await until(page, () => !!document.querySelector('.log .recallchip .recallchipkey'), null, 8000);
  check(chip, `${T} [d] no RECALL chip under the reply`);
  if (chip) {
    const label = await page.locator('.log .recallchip .recallchipkey').last().textContent();
    check(/RECALL · On Tuesday/i.test(label ?? ''), `${T} [d] the chip says "${label}"`);
    await page.locator('.log .recallchip .recallchipkey').last().click();
    const at = await until(page, (t) => !!document.querySelector(`#pg-core .log .msg.me.found[data-at="${t}"]`) || /Your chat ·/.test(document.querySelector('.modal, dialog, .g-modal')?.textContent ?? ''), tuesday, 4000);
    check(at, `${T} [d] the chip did not open Tuesday's turn`);
    await page.keyboard.press('Escape').catch(() => undefined);
  }
  reply = '';

  // (c) MEMORY → FIND "garden": the workspace page and the document
  await page.evaluate(() => (location.hash = 'memory'));
  await page.waitForSelector('#pg-memory', { state: 'attached', timeout: 10000 });
  await openSection(page, 'memory', 'Timeline');
  const box = page.locator('#pg-memory input[type=search]').first();
  await box.fill('garden');
  const found = await until(page, () => document.querySelectorAll('#pg-memory .recallfind .recallrow').length >= 2, null, 5000);
  const kinds = await page.$$eval('#pg-memory .recallfind .recallrow', (els) => els.map((e) => e.dataset.kind));
  check(found && kinds.includes('page') && kinds.includes('doc'), `${T} [c] FIND garden found ${JSON.stringify(kinds)}`);
  const head = await page.evaluate(() => document.querySelector('#pg-memory .recallfind .recallhead')?.textContent ?? '');
  check(/things? of yours about “garden”:/.test(head), `${T} [c] FIND's head: "${head}"`);
  // a tap opens the page in Workspace, at the line
  await page.locator('#pg-memory .recallfind .recallrow[data-kind="page"] .recallgo').first().click();
  const landed = await until(page, () => window.__ghosty?.found?.kind === 'page' && window.__ghosty.found.landed && !!document.querySelector('.wsblock.found'), null, 8000);
  check(landed, `${T} [c] a tap on the workspace page did not open it at its line: ${JSON.stringify(await page.evaluate(() => window.__ghosty?.found))}`);
  await page.keyboard.press('Escape').catch(() => undefined);
  await page.waitForTimeout(400);
  await page.evaluate(() => (location.hash = 'memory'));
  await openSection(page, 'memory', 'Timeline');
  const s3 = await small(page, '#pg-memory .recallfind');
  check(!s3.length, `${T} [f] FIND's rows under 44 pt: ${s3.join(', ')}`);
  await box.fill('what did I ask you about the squeaky door');
  const fq = await until(page, () => /squeaky door/.test(document.querySelector('#pg-memory .recallfind')?.textContent ?? ''), null, 5000);
  check(fq, `${T} [c] MEMORY's search box did not take "what did I ask you about…"`);
  await box.fill('zzqx volcano');
  const nf = await until(page, () => /Nothing like “zzqx volcano” in your documents/.test(document.querySelector('#pg-memory .recallfind')?.textContent ?? ''), null, 5000);
  check(nf, `${T} [f] FIND with nothing: "${await page.evaluate(() => document.querySelector('#pg-memory .recallfind')?.textContent ?? '')}"`);
  check(!(await sideways(page)), `${T} [f] MEMORY goes sideways`);

  // (e) a chase: one sentence back, listed under WATCHERS with STOP
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__ghosty.send("remind me to chase this if Sam doesn't reply by Thursday"));
  const said = await until(page, () => /(?:If nothing comes from Sam by Thursday 9 am, I'll remind you to chase it\.|No mail account is linked, so on Thursday 9 am I'll simply remind you to chase Sam\.)/.test(document.querySelector('.log')?.textContent ?? ''), null, 10000);
  check(said, `${T} [e] the chase's sentence: "${await page.evaluate(() => [...document.querySelectorAll('.log .msg')].pop()?.textContent?.slice(0, 160) ?? '')}"`);
  await page.evaluate(() => (location.hash = 'agenda'));
  await page.waitForSelector('#pg-agenda', { state: 'attached', timeout: 10000 });
  await openSection(page, 'agenda', 'Spending');
  await page.locator('.watchers').first().scrollIntoViewIfNeeded().catch(() => undefined);
  const listed = await until(page, () => [...document.querySelectorAll('.watchers .wrow[data-kind="reply"]')].some((r) => /Chase Sam/.test(r.textContent ?? '') && r.querySelector('.wstop')), null, 10000);
  check(listed, `${T} [e] WATCHERS does not list the chase with STOP`);
  const row = page.locator('.watchers .wrow[data-kind="reply"]').last();
  if (listed) {
    const stands = await row.textContent();
    check(/I look on .* at 9 am/.test(stands ?? ''), `${T} [e] the chase's line: "${stands}"`);
    await row.scrollIntoViewIfNeeded().catch(() => undefined);
    await row.locator('.wstop').click();
    await until(page, () => !document.querySelector('.watchers .wrow[data-kind="reply"]'), null, 8000);
  }
  await ctx.close();
}

for (const vp of [PHONE, PHONE2]) await run(vp, 0);
// BODY 21: the RECALL rows wrap, never clip
await run(PHONE2, 21);

await browser.close();
if (problems.length) {
  console.log(`recall spec: ${problems.length} problem(s)`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log('recall spec: all good');
