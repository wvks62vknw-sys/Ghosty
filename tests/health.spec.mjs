// RELIABILITY AND HEALTH (docs/build-plan/BRIEF-RELIABILITY.md), at 440 × 956 and 390 × 844, against a mocked brain:
//   a. A HEALTH MARK ON EVERY ABILITY: every ability SYSTEM → HEALTH lists shows one of the four words, its top line counts them right
//      (one key missing, one group failed: "2 things need you."), the deck's lines and the chat's "can you …?" carry the word, RETRY on
//      the failed one with the mock healed clears it and says back-since; the health read is one request, never on the first screen's
//      path, kept ten minutes;
//   b. with the mock brain down: OFFLINE on the brain's abilities, the phone's own still WORKING, the top line's count right;
//   c. ACTIONS VERIFIED: an action the mock accepts but does not store says "I tried to set that, but I cannot see it yet." with RETRY and
//      SHOW ME (never "Done"), the reply held as "Setting it…" meanwhile; one it stores gets the tick;
//   d. SETTINGS → PERMISSIONS lists the nine rows with their states and the words, and a refused camera lands there with its line;
//   e. CRASH RECORDS: the test hook's throw shows the fallen-over frame (RELOAD IT and HOME, words, not a blank), a record appears under
//      HEALTH with THAT FELT OFF prefilled; a draw that stays frozen says "Still drawing…" after 2 s and "This stopped. RELOAD IT." after 8;
//   f. THAT FELT OFF on a reply files a moment the mock receives with the screen and the words and without any picture field, counts as a
//      👎, and one filed offline is sent when the mock returns;
//   g. the brain's own page lists its jobs with their last runs in his words, every number with its unit and an "as of";
//   h. every control 44 pt, BODY 21 clips nothing, nothing sideways, no raw browser string anywhere.
//   BASE=http://localhost:8823 NO_GL_SHOTS=1 node tests/health.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { UK, openPanel } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const T0 = Date.now();
const problems = [];
const check = (ok, what) => ok || problems.push(what);
const VIEWPORTS = [{ width: 440, height: 956 }, { width: 390, height: 844 }];
const RAW = /aborted|fetch failed|undefined|\[object Object\]|TypeError|NetworkError|Failed to|Stack|at https?:/i;
const MARKS = ['WORKING', 'DEGRADED', 'NEEDS KEY', 'OFFLINE'];
const browser = await launch();

const ABILITIES = {
  abilities: [
    { id: 'g:agenda', cat: 'watch', line: 'I can set reminders and keep your agenda.', asks: ['Remind me at 5'], go: { ask: 'Remind me at 5' }, from: 'brain', tools: ['set_reminder'], words: 'remind agenda' },
    { id: 'g:web', cat: 'know', line: 'I can search the web and read pages.', asks: ['Search the web for tea'], go: { ask: 'Search the web for tea' }, from: 'brain', tools: ['web_search'], words: 'search web pages' },
    { id: 'g:repo', cat: 'build', line: 'I can change my own code on GitHub.', asks: ['Change your code'], go: { open: 'system', panel: 'KEYS' }, off: 'needs a key: SYSTEM → KEYS → GitHub token', from: 'brain', tools: ['propose_change'], words: 'github code repo' },
  ],
  goals: [], roadmap: { goal: '', steps: [] }, offered: [], used: [],
};

/** A page with the mocked brain: health, abilities, felt-off, agenda, chat and ratings are answered here. */
async function open({ viewport, body = 0, crashIn = '' } = {}) {
  const ctx = await browser.newContext({ viewport, ...UK, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
  await page.addInitScript(({ key, body, crashIn }) => {
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.themes1', '1');
    localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Tony', speak: false, sounds: false, theme: 'reactor', favourites: [], look: { ground: 'graphite', world: 'scan', night: 'graphite', switches: body ? { body } : {} }, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
    window.__ghostyHero = true;
    window.__ghostyPlace = { none: true };
    if (crashIn) window.__ghostyCrashIn = crashIn;
    window.__waits = [];
    new MutationObserver((ms) => {
      for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) for (const l of [...(n.matches?.('[data-wait]') ? [n] : []), ...n.querySelectorAll('[data-wait]')]) window.__waits.push(l.dataset.wait);
    }).observe(document, { childList: true, subtree: true });
  }, { key: KEY, body, crashIn });
  const mock = { down: false, healed: false, stored: false, feltDown: false, healthReqs: [], felt: [], ratings: [], chatText: 'Done: I will remind you at 3 to call the garage.', chat: 'verify' };
  const now = () => Date.now();
  const healthBody = () => ({
    at: now(),
    groups: { web: mock.healed ? { ok: now(), fail: { at: now() - 3_600_000, kind: 'network' } } : { ok: now() - 3 * 3_600_000, fail: { at: now() - 3_600_000, kind: 'network' } }, agenda: { ok: now() - 60_000 } },
    keys: [{ name: 'github', label: 'GitHub token', set: false }, { name: 'gemini', label: 'Gemini', set: true }],
    feeds: [{ id: 'flood', name: 'flood warnings', at: now() - 1_800_000 }, { id: 'weather', name: 'weather warnings', at: now() - 3_600_000 }, { id: 'crime', name: 'street crime', at: now() - 7_200_000 }],
    jobs: [
      { kind: 'digest', title: 'Morning digest', lastRun: new Date().setHours(6, 0, 0, 0), ok: true, next: now() + 3_600_000 },
      { kind: 'guard', title: 'Watching your places', lastRun: new Date().setHours(6, 0, 0, 0), ok: false, kindOf: 'network', next: now() + 3_000_000 },
    ],
    gpu: { left: 12, total: 30, at: now() - 2 * 86_400_000 },
    felt: { week: 0, total: 0 },
  });
  await page.route('**/api/guardian/health', (r) => {
    mock.healthReqs.push(Date.now());
    return mock.down ? r.abort('connectionrefused') : r.fulfill({ json: healthBody() });
  });
  await page.route('**/api/abilities', (r) => (mock.down ? r.abort('connectionrefused') : r.fulfill({ json: ABILITIES })));
  await page.route('**/api/guardian/feltoff', (r) => {
    if (r.request().method() === 'POST') {
      if (mock.feltDown) return r.abort('connectionrefused');
      mock.felt.push(JSON.parse(r.request().postData() ?? '{}'));
      return r.fulfill({ json: { ok: true, id: 'x' } });
    }
    return r.fulfill({ json: { moments: mock.felt.map((m, i) => ({ ...m, id: String(i), at: now() })).reverse(), week: mock.felt.length, ...(mock.felt.length ? { top: { screen: mock.felt[0].screen, n: mock.felt.length } } : {}) } });
  });
  await page.route('**/api/agenda**', (r) => r.fulfill({ json: { tz: 'Europe/London', events: [], errors: [], feeds: [], jobs: mock.stored ? [{ id: 'abc123', kind: 'reminder', title: 'call the garage', text: 'call the garage', next: now() + 3_600_000, repeat: 'none', tz: 'Europe/London' }] : [] } }));
  await page.route('**/api/training/feedback', (r) => {
    mock.ratings.push(JSON.parse(r.request().postData() ?? '{}'));
    return r.fulfill({ json: { ok: true } });
  });
  await page.route('**/api/chat', (r) => {
    const ev = mock.chat === 'verify'
      ? [{ t: 'tool', id: 't1', name: 'set_reminder', args: { text: 'call the garage', at: '15:00' } }, { t: 'tool_result', id: 't1', name: 'set_reminder', ok: true, summary: 'Reminder set for 15:00 (id abc123).' }, { t: 'text', text: mock.chatText }, { t: 'done', model: 'mock' }]
      : [{ t: 'text', text: 'The garage opens at nine.' }, { t: 'done', model: 'mock' }];
    return r.fulfill({ status: 200, contentType: 'application/x-ndjson', body: `${ev.map((e) => JSON.stringify(e)).join('\n')}\n` });
  });
  return { ctx, page, mock };
}
const settle = async (page) => {
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 40000 }).catch(() => problems.push('the boot never ended'));
  await page.waitForTimeout(1200);
};
const go = async (page, hash, ms = 900) => {
  await page.evaluate((h) => (location.hash = h), hash);
  await page.waitForTimeout(ms);
};
const texts = (page) => page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map((e) => `${[...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ')} ${e.getAttribute('aria-label') ?? ''}`.trim()).filter(Boolean));
const small = (page, sel, tag) => page.evaluate(({ sel, tag }) => [...document.querySelectorAll(sel)].filter((e) => e.getClientRects().length).map((e) => ({ n: (e.textContent ?? '').trim().slice(0, 24), r: e.getBoundingClientRect() })).filter((x) => Math.min(x.r.width, x.r.height) < 43.5).map((x) => `${tag} "${x.n}" ${Math.round(x.r.width)}×${Math.round(x.r.height)}`), { sel, tag });
const jpegOk = async (page, tag) => {
  const buf = await page.screenshot({ type: 'jpeg', quality: 60 });
  check(buf.length > 6000 && new Set(buf).size > 120, `${tag}: the screenshot is blank (${buf.length} bytes, ${new Set(buf).size} distinct)`);
};
const idle = (page) => page.waitForFunction(() => !window.__ghosty.ui.get().busy, null, { timeout: 15000 }).catch(() => undefined);
const marksNow = (page) => page.evaluate(async () => (await window.__ghosty.healthcheck()).marks);
const heal = (marks) => marks.filter((m) => m.mark !== 'WORKING').length;

for (const [vi, viewport] of VIEWPORTS.entries()) {
  const W = viewport.width;
  // ================================================================ a, b, g (HEALTH, the brain's page), h (controls)
  {
    const tag = `[health ${W}]`;
    const { ctx, page, mock } = await open({ viewport });
    await settle(page);
    // the first screen's path asks for nothing of it
    check(mock.healthReqs.length === 0, `${tag} the health read was asked for on the first screen's path (${mock.healthReqs.length})`);
    await page.evaluate(() => window.__ghosty.abilities.load());
    await go(page, 'system', 700);
    await openPanel(page, 'system', 'HEALTH');
    const tOpen = Date.now();
    await page.waitForFunction(() => /need|working|Offline/i.test(document.querySelector('.healthtop')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => problems.push(`${tag} the top line never came`));
    check(Date.now() - tOpen < 3000, `${tag} HEALTH took ${Date.now() - tOpen} ms to say its top line`);
    check(mock.healthReqs.length === 1, `${tag} the health read was ${mock.healthReqs.length} requests (one, kept ten minutes)`);
    const top = async () => ((await page.locator('.healthtop').textContent()) ?? '').trim();
    // (a feed screen whose feed cannot be reached in this sandbox is honestly OFFLINE: it counts as a thing that needs him)
    const FEEDY = ['s:brief', 's:markets'];
    const deadFeeds = await page.evaluate((f) => [...document.querySelectorAll('.hrow')].filter((r) => f.includes(r.dataset.id) && r.dataset.mark !== 'WORKING').length, FEEDY);
    check((await top()) === `${2 + deadFeeds} things need you.`, `${tag} the top line reads "${await top()}", wanted "${2 + deadFeeds} things need you."`);
    // every ability listed shows one of the four words
    const rows = await page.evaluate(() => [...document.querySelectorAll('.hrow')].map((r) => ({ id: r.dataset.id, mark: r.querySelector('.hmark')?.textContent, attr: r.dataset.mark, why: r.querySelector('.hwhy')?.textContent ?? '', fix: r.querySelector('.hfix')?.textContent ?? '' })));
    check(rows.length >= 20, `${tag} only ${rows.length} abilities listed`);
    check(rows.every((r) => MARKS.includes(r.mark) && r.mark === r.attr), `${tag} an ability without one of the four words: ${JSON.stringify(rows.filter((r) => !MARKS.includes(r.mark)).slice(0, 3))}`);
    const repo = rows.find((r) => r.id === 'g:repo');
    const web = rows.find((r) => r.id === 'g:web');
    check(repo?.mark === 'NEEDS KEY' && /GitHub token/.test(repo.why) && /PUT IN THE KEY/i.test(repo.fix), `${tag} the key row reads ${JSON.stringify(repo)}`);
    check(web?.mark === 'DEGRADED' && /RETRY/i.test(web.fix) && /took|down|feed/i.test(web.why), `${tag} the failed group reads ${JSON.stringify(web)}`);
    check(rows.find((r) => r.id === 'g:agenda')?.mark === 'WORKING', `${tag} the working group is not WORKING`);
    check(rows.filter((r) => r.id.startsWith('s:') && !FEEDY.includes(r.id)).every((r) => r.mark === 'WORKING'), `${tag} the phone's own are not all WORKING with signal`);
    // THE BRAIN'S page (g): jobs with their last runs in his words; every number with its unit and an as-of
    await page.waitForFunction(() => document.querySelector('.brainlines')?.textContent?.includes('as of'), null, { timeout: 8000 }).catch(() => problems.push(`${tag} the brain's page never filled`));
    await openPanel(page, 'system', 'THE BRAIN');
    const lines = await page.evaluate(() => [...document.querySelectorAll('.brainlines .rw')].map((r) => (r.textContent ?? '').replace(/\s+/g, ' ').trim()));
    check(lines.some((l) => /Morning digest ran at \d\d:\d\d, fine/.test(l)), `${tag} no "ran at …, fine" line: ${JSON.stringify(lines).slice(0, 400)}`);
    check(lines.some((l) => /Watching your places failed at \d\d:\d\d: the feed was down/.test(l)), `${tag} no "failed at …: the feed was down" line`);
    check(lines.some((l) => /GitHub token/.test(l) && /Gemini/.test(l)), `${tag} the keys are not named present and missing`);
    check(lines.some((l) => /12 of 30 free GPU hours/.test(l)), `${tag} no GPU line with its unit`);
    check(lines.some((l) => /rows/.test(l) && /%/.test(l) && /as of \d\d:\d\d/.test(l)), `${tag} no store line with units and an as-of`);
    check(lines.filter((l) => /\d/.test(l) && !/built on|^VERSION/.test(l)).every((l) => /as of \d\d:\d\d|\d\d:\d\d on /.test(l)), `${tag} a number with no "as of": ${JSON.stringify(lines.filter((l) => /\d/.test(l) && !/as of|built on|\d\d:\d\d on /.test(l)))}`);
    check(!lines.some((l) => RAW.test(l)), `${tag} a raw string on the brain's page`);
    await page.screenshot({ path: `${out}/health-brain-${W}.png` });
    // the YOU CAN lines of the chat's "can you …?" carry the word
    await go(page, 'core');
    await page.click('.logbtn').catch(() => undefined);
    await page.evaluate(() => window.__ghosty.send('can you search the web'));
    await page.waitForSelector('.log .localacts .hmark', { timeout: 10000 }).catch(() => problems.push(`${tag} "can you …?" shows no mark`));
    const canMark = await page.locator('.log .localacts .hmark').first().textContent().catch(() => '');
    check(MARKS.includes(canMark ?? ''), `${tag} the "can you" answer's mark is "${canMark}"`);
    // RETRY on the failed one, the mock healed: clears it and says back-since
    await go(page, 'system', 700);
    await openPanel(page, 'system', 'HEALTH');
    mock.healed = true;
    await page.locator('.hrow[data-id="g:web"] .hfix').click();
    await page.waitForFunction(() => document.querySelector('.hrow[data-id="g:web"]')?.dataset.mark === 'WORKING', null, { timeout: 8000 }).catch(() => problems.push(`${tag} RETRY did not clear the failed one`));
    const back = await page.evaluate(() => document.querySelector('.hrow[data-id="g:web"] .hwhy')?.textContent ?? '');
    check(/^Back since \d\d:\d\d\.$/.test(back.trim()), `${tag} the cleared one says "${back}", wanted "Back since 14:02."`);
    // (a feed screen is counted as it stands now, on the same paint as the top line: its feed can fail in the minute since the
    // first count — on CI the brief's feeds were still loading then, and could not be reached by RETRY)
    const deadNow = await page.evaluate((f) => [...document.querySelectorAll('.hrow')].filter((r) => f.includes(r.dataset.id) && r.dataset.mark !== 'WORKING').length, FEEDY);
    check((await top()) === `${1 + deadNow} thing${1 + deadNow === 1 ? '' : 's'} ${1 + deadNow === 1 ? 'needs' : 'need'} you.`, `${tag} after RETRY the top line reads "${await top()}" (wanted ${1 + deadNow}: the key, and ${deadNow} feed screen(s) that cannot read their feed; not working: ${await page.evaluate(() => [...document.querySelectorAll('.hrow')].filter((r) => r.dataset.mark !== 'WORKING').map((r) => `${r.dataset.id} ${r.dataset.mark}`).join(', '))})`);
    // (h) every control 44 pt
    const rowsSmall = await small(page, '.hfix, .hagain, .hworking > summary, .hgrouphead', 'a HEALTH key');
    check(!rowsSmall.length, `${tag} ${rowsSmall.join('; ')}`);
    check((await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)), `${tag} HEALTH is sideways`);
    await page.screenshot({ path: `${out}/health-${W}.png` });
    // (b) the brain down: OFFLINE on the brain's abilities, the phone's own still WORKING, the count right
    mock.down = true;
    await page.locator('.hagain').click();
    await page.waitForFunction(() => /^Offline: /.test(document.querySelector('.healthtop')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => problems.push(`${tag} with the brain down the top line never said Offline`));
    const dn = await page.evaluate(() => [...document.querySelectorAll('.hrow')].map((r) => ({ id: r.dataset.id, mark: r.dataset.mark })));
    check(dn.filter((r) => r.id.startsWith('g:')).every((r) => r.mark === 'OFFLINE' || (r.id === 'g:repo' && r.mark === 'NEEDS KEY')), `${tag} the brain's abilities with the brain down: ${JSON.stringify(dn.filter((r) => r.id.startsWith('g:')))}`);
    check(dn.filter((r) => r.id.startsWith('s:') && !FEEDY.includes(r.id)).every((r) => r.mark === 'WORKING'), `${tag} the phone's own are not WORKING with the brain down`);
    const offN = dn.filter((r) => r.mark === 'OFFLINE').length;
    check((await top()) === `Offline: ${dn.length - offN} of ${dn.length} things still work.`, `${tag} the offline count reads "${await top()}" (wanted ${dn.length - offN} of ${dn.length})`);
    const brainDown = await page.evaluate(() => document.querySelector('.brainlines')?.textContent ?? '');
    check(/cannot reach my brain/.test(brainDown), `${tag} the brain's page does not say it cannot be reached: "${brainDown.slice(0, 120)}"`);
    await ctx.close();
  }

  // ================================================================ c (verified actions), f (that felt off), h (no raw strings)
  {
    const tag = `[verify ${W}]`;
    const { ctx, page, mock } = await open({ viewport });
    await settle(page);
    await go(page, 'core');
    await page.click('.logbtn').catch(() => undefined);
    const log = page.locator('.log');
    // c. accepted, not stored
    mock.stored = false;
    await page.evaluate(() => window.__ghosty.send('Remind me at 3 to call the garage'));
    await page.waitForFunction(() => /I tried to set that, but I cannot see it yet\./.test(document.querySelector('.log')?.textContent ?? ''), null, { timeout: 12000 }).catch(() => problems.push(`${tag} the unsaved action never said it cannot see it`));
    let lt = (await log.textContent()) ?? '';
    check(!/Done: I will remind you/.test(lt) && !/\bDone\b/.test(lt), `${tag} "Done" was said for what was not stored: "${lt.slice(0, 200)}"`);
    check((await page.locator('.log .verifyrow .vretry').count()) === 1 && (await page.locator('.log .verifyrow .vshow').count()) === 1, `${tag} no RETRY and SHOW ME under the sentence`);
    check((await page.evaluate(() => window.__waits)).includes('Setting it…'), `${tag} the reply was never held as "Setting it…"`);
    await page.screenshot({ path: `${out}/health-verify-no-${W}.png` });
    // c. RETRY once the list holds it: the sentence stands, with the tick
    mock.stored = true;
    await page.locator('.log .verifyrow .vretry').click();
    await page.waitForSelector('.log .vtick', { timeout: 8000 }).catch(() => problems.push(`${tag} RETRY found it stored and gave no tick`));
    lt = (await log.textContent()) ?? '';
    check(/Done: I will remind you at 3 to call the garage\./.test(lt), `${tag} the sentence did not stand after RETRY`);
    check(/✓ on your agenda/i.test((await page.locator('.log .vtick').first().textContent().catch(() => '')) ?? ''), `${tag} the tick does not say where it is`);
    // c. stored from the start: the tick at once
    await idle(page);
    await page.evaluate(() => window.__ghosty.send('Remind me at 3 to call the garage again'));
    await page.waitForFunction(() => document.querySelectorAll('.log .vtick').length >= 2, null, { timeout: 12000 }).catch(() => problems.push(`${tag} the stored action got no tick`));
    // SHOW ME: the list it should be on (a fresh unsaved one)
    mock.stored = false;
    await idle(page);
    await page.evaluate(() => window.__ghosty.send('Remind me at 3 to call the garage once more'));
    await page.waitForFunction(() => document.querySelectorAll('.log .verifyrow .vshow').length >= 1, null, { timeout: 12000 }).catch(() => undefined);
    await page.locator('.log .verifyrow .vshow').last().click();
    await page.waitForTimeout(900);
    check((await page.evaluate(() => window.__ghosty.ui.get().tab)) === 'agenda', `${tag} SHOW ME did not open the Agenda`);
    const vs = await small(page, '.verifyrow button', 'verify key');
    check(!vs.length, `${tag} ${vs.join('; ')}`);

    // f. THAT FELT OFF on a reply
    mock.chat = 'plain';
    await go(page, 'core');
    await page.click('.logbtn').catch(() => undefined);
    await page.evaluate(() => window.__ghosty.send('When does the garage open?'));
    await page.waitForFunction(() => /garage opens at nine/.test(document.querySelector('.log')?.textContent ?? ''), null, { timeout: 12000 }).catch(() => problems.push(`${tag} the plain reply never came`));
    const key = page.locator('.rate .feltb:visible').last();
    check((await key.count()) === 1, `${tag} no THAT FELT OFF beside the thumbs`);
    const ks = await small(page, '.log .rate .feltb, .rcacts .feltb', 'felt key');
    check(!ks.length, `${tag} ${ks.join('; ')}`);
    await key.click();
    await page.waitForSelector('.modal .feltbody', { timeout: 5000 }).catch(() => problems.push(`${tag} the felt-off sheet never opened`));
    const sheet = (await page.locator('.modal .feltbody').textContent().catch(() => '')) ?? '';
    check(/No picture, no camera, no faces/.test(sheet), `${tag} the sheet does not say what it keeps`);
    await page.fill('.modal .feltwords', 'it said the garage opens at nine and I wanted ten');
    await page.click('.modal .feltsend');
    await page.waitForFunction(() => !document.querySelector('.modal'), null, { timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(500);
    const m = mock.felt[0];
    check(!!m && m.screen === 'core' && typeof m.text === 'string' && m.text.length > 0 && Array.isArray(m.did) && m.did.length >= 1 && m.marks && typeof m.marks === 'object' && /garage opens at nine/.test(m.reply ?? '') && /wanted ten/.test(m.words ?? ''), `${tag} the moment the mock got: ${JSON.stringify(m)?.slice(0, 300)}`);
    check(m && m.text.length <= 600, `${tag} the moment's text is ${m?.text.length} characters (600 at most)`);
    check(m && !Object.keys(m).some((k) => /image|face|camera|photo|frame|picture/i.test(k)) && !JSON.stringify(m).includes('data:image'), `${tag} a picture field in the moment: ${Object.keys(m ?? {})}`);
    check(mock.ratings.some((x) => x.up === false), `${tag} the moment did not count as a 👎 (${JSON.stringify(mock.ratings).slice(0, 160)})`);
    // f. offline: kept on the phone, sent when the brain is back
    mock.feltDown = true;
    await page.locator('.rate .feltb:visible').last().click();
    await page.waitForSelector('.modal .feltbody');
    await page.click('.modal .feltsend');
    await page.waitForTimeout(900);
    check(mock.felt.length === 1, `${tag} a moment reached the brain while it was down`);
    check((await page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.feltoff.queue') ?? '[]').length)) === 1, `${tag} the moment was not kept on the phone`);
    check(/Kept on your phone/.test(await page.evaluate(() => document.querySelector('#toasts')?.textContent ?? '')), `${tag} the offline moment was not said`);
    mock.feltDown = false;
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('ghosty.feltoff.queue') ?? '[]').length === 0, null, { timeout: 6000 }).catch(() => problems.push(`${tag} the kept moment was never sent`));
    check(mock.felt.length === 2, `${tag} the kept moment did not reach the mock when it returned (${mock.felt.length})`);
    // and it is listed at SYSTEM → HEALTH → FELT OFF
    await go(page, 'system', 700);
    await openPanel(page, 'system', 'FELT OFF');
    await page.waitForFunction(() => /felt off this week/.test(document.querySelector('.feltlist')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => problems.push(`${tag} FELT OFF lists nothing`));
    // h. no raw strings
    const all = await texts(page);
    check(!all.some((t) => RAW.test(t)), `${tag} a raw string on screen: ${all.find((t) => RAW.test(t))}`);
    await ctx.close();
  }

  // ================================================================ d (permissions), e (crash records), h (BODY 21)
  {
    const tag = `[perms ${W}]`;
    const { ctx, page } = await open({ viewport, crashIn: 'radio' });
    await settle(page);
    // d. a refused camera, through the one error voice, lands under PERMISSIONS with its line
    const said = await page.evaluate(() => window.__ghosty.crash.record(new DOMException('Permission denied', 'NotAllowedError'), 'open the camera'));
    check(/would not let me open the camera/.test(said) && /Permissions/.test(said), `${tag} the funnel said "${said}"`);
    await go(page, 'settings', 800);
    await openPanel(page, 'settings', 'PERMISSIONS');
    await page.waitForSelector('.permrow', { timeout: 8000 }).catch(() => problems.push(`${tag} PERMISSIONS shows no rows`));
    const rows = await page.evaluate(() => [...document.querySelectorAll('.permrow')].map((r) => ({ id: r.dataset.perm, refused: r.dataset.refused, state: r.querySelector('.permstate')?.textContent?.trim() ?? '', use: r.querySelector('.permuse')?.textContent ?? '', never: r.querySelector('.permnever')?.textContent ?? '', how: r.querySelector('.permhow')?.textContent ?? '' })));
    check(rows.length === 9, `${tag} ${rows.length} rows, wanted 9`);
    check(['camera', 'microphone', 'location', 'notifications', 'motion', 'clipboard', 'storage', 'homescreen', 'wifi'].every((id) => rows.some((r) => r.id === id)), `${tag} rows: ${rows.map((r) => r.id)}`);
    check(rows.every((r) => r.state && r.use.length > 30 && r.never.length > 20 && r.how.length > 20), `${tag} a row without its words: ${JSON.stringify(rows.find((r) => !(r.state && r.use.length > 30 && r.never.length > 20 && r.how.length > 20)))}`);
    check(/never name a stranger/.test(rows.find((r) => r.id === 'camera')?.never ?? '') && /never reaches my brain/.test(rows.find((r) => r.id === 'location')?.never ?? ''), `${tag} the rules are not in his words on the camera and location rows`);
    check(/[Ll]ast time: refused/.test(rows.find((r) => r.id === 'camera')?.state ?? '') || /Not allowed now/.test(rows.find((r) => r.id === 'camera')?.state ?? ''), `${tag} the camera row says "${rows.find((r) => r.id === 'camera')?.state}"`);
    check(rows.find((r) => r.id === 'camera')?.refused === 'true' && /refused .* when I tried to open the camera/.test(await page.locator('.permrefused').textContent().catch(() => '')), `${tag} the refusal's line is not on the page: "${await page.locator('.permrefused').textContent().catch(() => '')}"`);
    check(/Allowed|Not allowed|Last time|Not asked|ask you/.test(rows.find((r) => r.id === 'motion')?.state ?? ''), `${tag} the motion row has no honest state`);
    await page.screenshot({ path: `${out}/health-permissions-${W}.png` });
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
    check(sideways, `${tag} PERMISSIONS is sideways`);

    // e. the test hook's throw: the fallen-over frame, never a blank
    const tagE = `[crash ${W}]`;
    await go(page, 'radio', 1300);
    check((await page.locator('#pg-radio .fallen').count()) === 1, `${tagE} no fallen-over frame on the screen that threw`);
    check(/This screen fell over\. RELOAD IT\./.test((await page.locator('#pg-radio .fallenwords').textContent().catch(() => '')) ?? ''), `${tagE} the frame's words are not his`);
    check((await page.locator('#pg-radio .fallenreload').count()) === 1 && (await page.locator('#pg-radio .fallenhome').count()) === 1, `${tagE} RELOAD IT and HOME are not both there`);
    check((await page.evaluate(() => document.body.innerText.trim().length)) > 40, `${tagE} the body has no text`);
    await jpegOk(page, tagE);
    const fs = await small(page, '#pg-radio .fallen button', 'fallen key');
    check(!fs.length, `${tagE} ${fs.join('; ')}`);
    await page.screenshot({ path: `${out}/health-fallen-${W}.png` });
    // a record appears under HEALTH, with THAT FELT OFF prefilled
    await go(page, 'system', 700);
    await openPanel(page, 'system', 'CRASHES');
    await page.waitForSelector('.crashrow', { timeout: 6000 }).catch(() => problems.push(`${tagE} no crash record under HEALTH`));
    const rec = (await page.locator('.crashrow').first().textContent().catch(() => '')) ?? '';
    check(/Radio|radio/.test(rec) && /fell over/i.test(rec) && !RAW.test(rec), `${tagE} the record reads "${rec.slice(0, 140)}"`);
    await page.locator('.crashrow .feltb').first().click();
    await page.waitForSelector('.modal .feltwords', { timeout: 5000 });
    check(/stopped at \d\d:\d\d/.test(await page.inputValue('.modal .feltwords')), `${tagE} THAT FELT OFF on a record is not prefilled`);
    await page.keyboard.press('Escape');
    // the net: an error nobody caught is a record too, and shows nothing raw
    const n0 = await page.evaluate(() => window.__ghosty.crash.crashCheck().records.length);
    await page.evaluate(() => window.dispatchEvent(new ErrorEvent('error', { error: new TypeError("Cannot read properties of undefined (reading 'spec') at https://x/app.js:1:2"), message: "Cannot read properties of undefined (reading 'spec')" })));
    await page.evaluate(() => new Promise((r) => setTimeout(r, 6000)));
    await page.evaluate(() => window.dispatchEvent(new PromiseRejectionEvent('unhandledrejection', { promise: Promise.resolve(), reason: new TypeError('Failed to fetch the spec thing') })));
    const n1 = await page.evaluate(() => window.__ghosty.crash.crashCheck().records.length);
    check(n1 === n0 + 2, `${tagE} window.onerror and unhandledrejection wrote ${n1 - n0} records, wanted 2`);
    check(!/Cannot read|Failed to fetch the spec/.test(JSON.stringify(await page.evaluate(() => window.__ghosty.crash.crashCheck().records))), `${tagE} a record holds the raw text`);
    // the frozen draw (once: it takes nine seconds)
    if (vi === 0) {
      await go(page, 'settings', 600);
      await page.evaluate(() => window.__ghosty.crash.draws('settings', true));
      await page.waitForTimeout(2600);
      check(/Still drawing…/.test((await page.locator('#pg-settings .stalled').textContent().catch(() => '')) ?? ''), `${tagE} no "Still drawing…" after two seconds`);
      await page.waitForTimeout(6200);
      const st = (await page.locator('#pg-settings .stalled').textContent().catch(() => '')) ?? '';
      check(/This stopped\. RELOAD IT\./.test(st) && /HOME/i.test(st), `${tagE} no "This stopped. RELOAD IT." after eight seconds ("${st}")`);
      await page.evaluate(() => window.__ghosty.crash.draws('settings', false));
    }
    await ctx.close();
  }

  // ================================================================ h: the biggest text (BODY 21)
  {
    const tag = `[body21 ${W}]`;
    const { ctx, page } = await open({ viewport, body: 21 });
    await settle(page);
    await page.evaluate(() => window.__ghosty.abilities.load());
    for (const [screen, panelName, sel] of [['system', 'HEALTH', '.healthpn'], ['settings', 'PERMISSIONS', '.permpn']]) {
      await go(page, screen, 900);
      await openPanel(page, screen, panelName);
      await page.waitForTimeout(1200);
      const cut = await page.evaluate((sel) => {
        const root = document.querySelector(sel);
        if (!root) return ['no panel'];
        return [...root.querySelectorAll('.hline, .hwhy, .permuse, .permnever, .permhow, .permname, .permstate, .healthtop, .hgrouphead, button')].filter((e) => e.getClientRects().length).filter((e) => e.scrollWidth > e.clientWidth + 1 || e.getBoundingClientRect().right > innerWidth + 1).map((e) => (e.textContent ?? '').trim().slice(0, 30));
      }, sel);
      check(!cut.length, `${tag} ${screen}: words cut or sideways: ${cut.join('; ')}`);
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${tag} ${screen} is sideways`);
      const bs = await small(page, `${sel} button, ${sel} summary`, `${screen} key`);
      check(!bs.length, `${tag} ${bs.join('; ')}`);
    }
    await page.screenshot({ path: `${out}/health-body21-${W}.png` });
    await ctx.close();
  }
}

await browser.close();
if (problems.length) {
  console.error(`FAIL health (${Math.round((Date.now() - T0) / 1000)} s):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`ok health (${Math.round((Date.now() - T0) / 1000)} s): A MARK ON EVERY ABILITY (the four words, the count, RETRY and back-since, the brain down: OFFLINE and the phone's own still WORKING); ACTIONS VERIFIED (Setting it…, the tick, "I tried to set that, but I cannot see it yet." with RETRY and SHOW ME, never Done); PERMISSIONS (nine rows in his words, a refused camera lands there); CRASH RECORDS (the fallen-over frame, the records, the frozen draw); THAT FELT OFF (the moment with its screen and words, no picture field, a 👎, kept offline and sent); THE BRAIN'S PAGE (jobs with their last runs, units and as-of); every control 44 pt, BODY 21 clips nothing, nothing sideways, no raw string; both widths`);
