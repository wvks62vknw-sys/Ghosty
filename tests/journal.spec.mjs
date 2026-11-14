// JOURNAL (APPS ROUND, MEMORY lane), at 440 × 956 and 390 × 844, and at BODY 21:
//  (a) the first run shows three example entries and the three-step tour; CLEAR SAMPLES takes them away and leaves the empty state;
//  (b) NEW ENTRY: his words, a prompt, a mood, his home town's weather, a place and a photo (made smaller on the phone), kept as he types; the list shows it and
//      search finds it by a word, and says so plainly when nothing matches;
//  (c) "add to my journal: …" in the chat opens a new entry with his words in it, kept;
//  (d) the calendar dots today; ON THIS DAY shows the entry from this day last year; PLACES groups by the place he gave;
//  (e) DELETE has UNDO, and RECENTLY DELETED brings an entry back; ASK GHOSTY ABOUT IT sends that one entry to the chat;
//  (f) LOCK WITH FACE ID makes a passkey (a virtual authenticator here); leaving locks it; UNLOCK opens it again; while it is locked the
//      entries are hidden;
//  (h) KEEP IN TOUCH in People: add, mark caught up, take off, each with UNDO, and a nudge set on the brain;
//  (g) Memory has a JOURNAL row that opens it; every key 44 pt, nothing sideways, nothing cut, in all seven looks at 390.
// Dates are anchored to London's day (CI runs at any hour).
//   node tests/journal.spec.mjs [outDir]
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
const log = (m) => console.log(`journal: ${m}`);

// London's day, at noon; this day last year (none on 29 February)
const londonDay = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
const londonNoon = Date.parse(`${londonDay}T12:00:00Z`);
const lastYear = (() => {
  const d = new Date(londonNoon);
  const want = d.getUTCDate();
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.getUTCDate() === want ? d.getTime() : 0;
})();

const fit = (page, sel) =>
  page.evaluate((sel) => {
    const small = [...document.querySelectorAll(`${sel} button, ${sel} summary, ${sel} input:not([type=file])`)].filter((b) => {
      const r = b.getBoundingClientRect();
      return r.width && r.height && (r.width < 43.5 || r.height < 43.5) && getComputedStyle(b).visibility !== 'hidden' && !b.closest('[hidden]');
    }).map((b) => `"${(b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 20)}" ${Math.round(b.getBoundingClientRect().width)}×${Math.round(b.getBoundingClientRect().height)}`);
    const cut = [...document.querySelectorAll(`${sel} b, ${sel} small, ${sel} p, ${sel} button:not(.jnrow)`)].filter((e) => e.getClientRects().length && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible').map((e) => (e.textContent ?? '').slice(0, 30));
    return { small: small.slice(0, 5), sideways: document.documentElement.scrollWidth > innerWidth + 1, cut: cut.slice(0, 5) };
  }, sel);

const J = () => window.__ghosty?.journal;

async function open(vp, { body = 0, world = 'scan', seed = null } = {}) {
  const ctx = await browser.newContext({ viewport: vp, ...UK, reducedMotion: 'reduce' });
  await ctx.route(/^https:\/\/(?!localhost)/, (route) => route.fulfill({ status: 404, body: '' }));
  // his home town's weather (Open-Meteo, no key), answered here
  await ctx.route(/open-meteo\.com\/v1\/forecast/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ current: { temperature_2m: 11.6, apparent_temperature: 10, relative_humidity_2m: 80, weather_code: 3, wind_speed_10m: 12, wind_direction_10m: 200, pressure_msl: 1012 }, hourly: { temperature_2m: [], precipitation_probability: [] }, daily: { temperature_2m_max: [13], temperature_2m_min: [7], precipitation_probability_max: [20], sunrise: [''], sunset: [''], uv_index_max: [1] } }) }));
  const page = await ctx.newPage();
  const T = `[${vp.width}${body ? ` body ${body}` : ''}${world !== 'scan' ? ` ${world}` : ''}]`;
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`${T} pageerror: ${e.message}`));
  await page.addInitScript(({ key, body, world, seed }) => {
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Tony', speak: false, sounds: false, favourites: [], look: { ground: 'graphite', world, night: 'graphite', switches: body ? { body } : {} }, home: { name: 'London', lat: 51.5, lon: -0.12 } }));
    if (seed && !sessionStorage.getItem('jn.seeded')) {
      sessionStorage.setItem('jn.seeded', '1');
      localStorage.setItem('ghosty.journal', JSON.stringify(seed));
    }
    window.__ghostyHero = true;
    window.__ghostyPlace = { none: true };
  }, { key: KEY, body, world, seed });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
  return { ctx, page, T };
}
const toJournal = async (page) => {
  await page.evaluate(() => (location.hash = 'journal'));
  await page.waitForFunction(() => window.__ghosty?.journal && window.__ghosty.journal.state !== 'idle', null, { timeout: 12000 });
};

async function run(vp, body) {
  const { ctx, page, T } = await open(vp, { body });
  // (g) Memory's row opens it
  await page.evaluate(() => (location.hash = 'memory'));
  await page.waitForSelector('#pg-memory', { state: 'attached', timeout: 10000 });
  await openSection(page, 'memory', 'About you');
  const row = page.locator('#pg-memory .ak-card', { hasText: 'Journal' }).first();
  check(await row.isVisible().catch(() => false), `${T} [g] Memory has no JOURNAL row`);
  if (await row.isVisible().catch(() => false)) await row.click();
  await page.waitForFunction(() => location.hash.startsWith('#journal') && window.__ghosty?.journal?.state !== 'idle', null, { timeout: 10000 }).catch(async () => problems.push(`${T} [g] the row did not open the journal`));

  // (a) three examples and the tour, then CLEAR SAMPLES
  check((await page.evaluate(J))?.entries === 3, `${T} [a] ${JSON.stringify(await page.evaluate(J))} (want the three examples)`);
  const tourText = await page.locator('#pg-journal .jntour').innerText().catch(() => '');
  check(/example/i.test(tourText) && (tourText.match(/\n/g) ?? []).length >= 3, `${T} [a] the tour said "${tourText.slice(0, 120)}"`);
  if (!body) {
    await page.locator('#pg-journal button', { hasText: 'CLEAR SAMPLES' }).click();
    await page.waitForFunction(() => window.__ghosty.journal.state === 'empty', null, { timeout: 5000 }).catch(async () => problems.push(`${T} [a] CLEAR SAMPLES left ${JSON.stringify(await page.evaluate(J))}`));
    const emptyText = await page.locator('#pg-journal .jnentries .empty').innerText().catch(() => '');
    check(/Nothing written yet/.test(emptyText), `${T} [a] the empty state said "${emptyText}"`);
  }
  await page.screenshot({ path: `${out}/journal-${vp.width}${body ? `-b${body}` : ''}-list.png` });

  if (!body) {
    // (b) a new entry: words, a prompt, a mood, a place, a photo; kept as he types
    await page.locator('#pg-journal .jnnew').click();
    const ed = page.locator('.jneditor');
    await ed.waitFor({ state: 'visible', timeout: 5000 });
    await ed.locator('button', { hasText: 'PROMPT' }).click();
    const prompt = (await ed.locator('.jnprompt').innerText()).trim();
    check(prompt.length > 8, `${T} [b] no prompt shown ("${prompt}")`);
    await ed.locator('textarea').fill('Walked up Primrose Hill at sunset with a flask of tea. The city went pink.');
    await ed.locator('.jnmoods button', { hasText: 'Great' }).click();
    await ed.locator('input[list="jnplaces"]').fill('Primrose Hill');
    // (a small picture drawn by the browser itself)
    const PNG = Buffer.from(await page.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); x.fillStyle = '#c33'; x.fillRect(0, 0, 32, 32); return c.toDataURL('image/png').split(',')[1]; }), 'base64');
    await ed.locator('input[type=file]').setInputFiles({ name: 'hill.png', mimeType: 'image/png', buffer: PNG });
    await page.waitForFunction(() => document.querySelectorAll('.jneditor .jnphoto').length === 1, null, { timeout: 8000 }).catch(async () => problems.push(`${T} [b] the photo never showed`));
    await page.waitForFunction(() => /Saved/.test(document.querySelector('.jneditor .jnsaved')?.textContent ?? ''), null, { timeout: 5000 }).catch(async () => problems.push(`${T} [b] never said it was saved`));
    await ed.locator('button', { hasText: /^SAVE$/ }).click();
    await page.waitForFunction(() => window.__ghosty.journal.entries === 1, null, { timeout: 5000 }).catch(async () => problems.push(`${T} [b] after SAVE ${JSON.stringify(await page.evaluate(J))}`));
    const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.journal')).entries.find((e) => !e.deleted));
    check(kept?.mood === 5 && /^-?\d+°C, [A-Z]/.test(kept?.weather ?? '') && kept?.place === 'Primrose Hill' && kept?.photos?.length === 1 && /^data:image\/jpeg/.test(kept.photos[0].thumb) && kept.prompt, `${T} [b] kept ${JSON.stringify(kept)?.slice(0, 200)}`);
    check(/Primrose Hill/.test(await page.locator('#pg-journal .jnlist').first().innerText()), `${T} [b] the list does not show it`);
    check(/1 day in a row/i.test(await page.locator('#pg-journal').innerText()), `${T} [b] no streak of one day`);
    // search: a word, then nothing
    const search = page.locator('#pg-journal input[type=search]');
    await search.fill('flask');
    await page.waitForFunction(() => window.__ghosty.journal.shown === 1, null, { timeout: 3000 }).catch(async () => problems.push(`${T} [b] "flask" found ${JSON.stringify(await page.evaluate(J))}`));
    await search.fill('helicopter');
    await page.waitForFunction(() => window.__ghosty.journal.state === 'empty', null, { timeout: 3000 }).catch(() => undefined);
    const none = await page.locator('#pg-journal .jnentries .empty').innerText().catch(() => '');
    check(/Nothing you wrote matches “helicopter”/.test(none), `${T} [b] no-match said "${none}"`);
    await search.fill('');

    // (c) from the chat
    await page.evaluate(() => (location.hash = 'core'));
    await page.waitForTimeout(300);
    await page.evaluate(() => window.__ghosty.send('add to my journal: the plumber finally came and the boiler works'));
    await page.waitForFunction(() => location.hash.startsWith('#journal') && document.querySelector('.jneditor textarea')?.value.includes('boiler works'), null, { timeout: 10000 }).catch(async () => problems.push(`${T} [c] the chat did not open a new entry with his words`));
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('ghosty.journal')).entries.some((e) => /boiler works/.test(e.text)), null, { timeout: 5000 }).catch(async () => problems.push(`${T} [c] the chat's entry was not kept`));
    await page.keyboard.press('Escape');
    await page.locator('.jneditor').waitFor({ state: 'detached', timeout: 3000 }).catch(() => undefined);
    await page.waitForFunction(() => window.__ghosty.journal.entries === 2, null, { timeout: 5000 }).catch(async () => problems.push(`${T} [c] ${JSON.stringify(await page.evaluate(J))} after the chat's entry`));

    // (d) the calendar's day
    await openSection(page, 'journal', 'Calendar');
    const days = await page.locator('#pg-journal .jncal h3').innerText().catch(() => '');
    check(/1 DAY/.test(days), `${T} [d] the calendar said "${days}"`);
    check((await page.locator('#pg-journal .jncalday[data-has]').count()) === 1, `${T} [d] not one day dotted`);
    // PLACES
    await openSection(page, 'journal', 'Places');
    check(/Primrose Hill · 1/i.test(await page.locator('#pg-journal .jnplaces').innerText().catch(() => '')), `${T} [d] PLACES does not group Primrose Hill`);

    // (e) DELETE, UNDO; DELETE, then RECENTLY DELETED → RESTORE
    await openSection(page, 'journal', 'Entries');
    const delOne = async () => {
      await page.locator('#pg-journal .jnrow', { hasText: 'Primrose' }).first().click();
      await page.locator('.jneditor button', { hasText: 'DELETE' }).click();
      await page.waitForFunction(() => window.__ghosty.journal.entries === 1, null, { timeout: 3000 }).catch(async () => problems.push(`${T} [e] DELETE left ${JSON.stringify(await page.evaluate(J))}`));
    };
    await delOne();
    const undoKey = page.locator('button', { hasText: 'UNDO' }).last();
    if (await undoKey.isVisible().catch(() => false)) await undoKey.click();
    else problems.push(`${T} [e] no UNDO after DELETE`);
    await page.waitForFunction(() => window.__ghosty.journal.entries === 2, null, { timeout: 3000 }).catch(async () => problems.push(`${T} [e] UNDO left ${JSON.stringify(await page.evaluate(J))}`));
    await delOne();
    await openSection(page, 'journal', 'Settings');
    await page.locator('#pg-journal .jnbin button', { hasText: 'RESTORE' }).click();
    await page.waitForFunction(() => window.__ghosty.journal.entries === 2, null, { timeout: 3000 }).catch(async () => problems.push(`${T} [e] RESTORE left ${JSON.stringify(await page.evaluate(J))}`));

    // (e2) ASK GHOSTY ABOUT IT: that one entry goes to the chat, on his tap
    await openSection(page, 'journal', 'Entries');
    await page.locator('#pg-journal .jnrow', { hasText: 'Primrose' }).first().click();
    await page.locator('.jneditor button', { hasText: 'ASK GHOSTY ABOUT IT' }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('#pg-core .msg.me')].some((m) => /About my journal entry of .*Primrose Hill/.test(m.textContent ?? '')), null, { timeout: 8000 }).catch(async () => problems.push(`${T} [e2] the entry did not reach the chat`));
    await toJournal(page);
    await openSection(page, 'journal', 'Settings');
    // (f) the lock: a passkey made on a virtual authenticator, locked on leaving, opened again
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('WebAuthn.enable');
    await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
    await page.locator('#pg-journal button', { hasText: 'LOCK WITH FACE ID' }).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('ghosty.journal')).prefs.lock === true, null, { timeout: 8000 }).catch(async () => problems.push(`${T} [f] the lock was never set`));
    await page.evaluate(() => (location.hash = 'memory'));
    await page.waitForTimeout(200);
    await toJournal(page);
    check((await page.evaluate(J))?.locked === true && (await page.locator('#pg-journal .jnentries').isHidden()), `${T} [f] not locked after leaving: ${JSON.stringify(await page.evaluate(J))}`);
    await page.locator('#pg-journal .jnlock button', { hasText: 'UNLOCK' }).click();
    await page.waitForFunction(() => window.__ghosty.journal.locked === false && window.__ghosty.journal.entries === 2, null, { timeout: 8000 }).catch(async () => problems.push(`${T} [f] UNLOCK did not open it: ${JSON.stringify(await page.evaluate(J))}`));
    await page.screenshot({ path: `${out}/journal-${vp.width}-settings.png` });
  }

  const f = await fit(page, '#pg-journal');
  check(!f.small.length, `${T} [g] under 44 pt: ${f.small.join(', ')}`);
  check(!f.sideways, `${T} [g] the page goes sideways`);
  check(!f.cut.length, `${T} [g] words cut: ${JSON.stringify(f.cut)}`);
  log(`${T} done`);
  await ctx.close();
}

for (const vp of [PHONE, PHONE2]) await run(vp, 0);
await run(PHONE2, 21);

// (d) ON THIS DAY: an entry from this day last year
if (lastYear) {
  const { ctx, page, T } = await open(PHONE2, { seed: { journals: [{ id: 'personal', name: 'Personal', tone: 'accent' }], entries: [{ id: 'old1', journal: 'personal', at: lastYear, text: 'First day at the new flat. Boxes everywhere.', photos: [], edited: lastYear, versions: [{ at: lastYear - 3600_000, text: 'First day at the flat.' }] }], prefs: { lock: false, remind: '', toured: true, samplesGone: true } } });
  await toJournal(page);
  await openSection(page, 'journal', 'On this day');
  const otd = await page.locator('#pg-journal .jnotd').innerText().catch(() => '');
  check(/A year ago/i.test(otd) && /new flat/.test(otd), `${T} [d] ON THIS DAY said "${otd.slice(0, 160)}"`);
  // (e3) an earlier wording put back; the one it replaced kept as a version in turn
  await page.locator('#pg-journal .jnotd .jnrow').first().click();
  await page.locator('.jneditor .jnversions summary').click();
  await page.locator('.jneditor .jnversion button', { hasText: 'PUT BACK' }).click();
  const back = await page.evaluate(() => ({ text: document.querySelector('.jneditor textarea')?.value, kept: JSON.parse(localStorage.getItem('ghosty.journal')).entries[0] }));
  check(back.text === 'First day at the flat.' && back.kept.text === 'First day at the flat.' && back.kept.versions?.length === 2 && back.kept.versions[1].text.startsWith('First day at the new flat'), `${T} [e3] PUT BACK left ${JSON.stringify(back).slice(0, 200)}`);
  await ctx.close();
}

// (h) KEEP IN TOUCH (People): add someone and how often, tap when caught up (UNDO), ✕ takes them off (UNDO); 44 pt, nothing sideways
for (const vp of [PHONE, PHONE2]) {
  const { ctx, page, T } = await open(vp);
  await page.evaluate(() => localStorage.removeItem('ghosty.touch'));
  await page.evaluate(() => (location.hash = 'people'));
  await page.waitForSelector('#pg-people', { state: 'attached', timeout: 10000 });
  await openSection(page, 'people', 'Keep in touch');
  await page.waitForFunction(() => window.__ghosty?.touch?.state === 'empty', null, { timeout: 10000 }).catch(async () => problems.push(`${T} [h] KEEP IN TOUCH did not start empty: ${JSON.stringify(await page.evaluate(() => window.__ghosty?.touch))}`));
  const sheet = page.locator('#pg-people .tcsheet');
  check(/No one yet/.test(await sheet.innerText().catch(() => '')), `${T} [h] no empty state`);
  await sheet.locator('input[type=text]').fill('Jo');
  await sheet.locator('select').selectOption('14');
  await sheet.locator('button', { hasText: 'ADD' }).click();
  await page.waitForFunction(() => window.__ghosty.touch.people === 1 && window.__ghosty.touch.due === 1, null, { timeout: 5000 }).catch(async () => problems.push(`${T} [h] after ADD ${JSON.stringify(await page.evaluate(() => window.__ghosty.touch))}`));
  const row = () => sheet.locator('.ak-row', { hasText: 'Jo' }).first().innerText().catch(() => '');
  check(/every 2 weeks/.test(await row()) && /Due/.test(await row()), `${T} [h] the row said "${await row()}"`);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('ghosty.touch'))[0]?.jobId, null, { timeout: 8000 }).catch(() => problems.push(`${T} [h] no nudge was set on the brain`));
  await sheet.locator('.ak-row .ak-rowmain').first().click();
  await page.waitForFunction(() => window.__ghosty.touch.due === 0, null, { timeout: 5000 }).catch(() => problems.push(`${T} [h] marking did not clear the due`));
  check(/In 14 days/.test(await row()) && /caught up today/.test(await row()), `${T} [h] after marking: "${await row()}"`);
  const undoKey = page.locator('button', { hasText: 'UNDO' }).last();
  await undoKey.click().catch(() => problems.push(`${T} [h] no UNDO after marking`));
  await page.waitForFunction(() => window.__ghosty.touch.due === 1, null, { timeout: 5000 }).catch(() => problems.push(`${T} [h] UNDO did not bring the due back`));
  await sheet.locator('.ak-rowdel').first().click();
  await page.waitForFunction(() => window.__ghosty.touch.state === 'empty', null, { timeout: 5000 }).catch(() => problems.push(`${T} [h] ✕ did not take Jo off`));
  await page.locator('button', { hasText: 'UNDO' }).last().click().catch(() => problems.push(`${T} [h] no UNDO after ✕`));
  await page.waitForFunction(() => window.__ghosty.touch.people === 1, null, { timeout: 5000 }).catch(() => problems.push(`${T} [h] UNDO did not bring Jo back`));
  const f = await fit(page, '#pg-people .tcsheet');
  check(!f.small.length, `${T} [h] under 44 pt: ${f.small.join(', ')}`);
  check(!f.sideways, `${T} [h] the page goes sideways`);
  check(!f.cut.length, `${T} [h] words cut: ${JSON.stringify(f.cut)}`);
  await page.screenshot({ path: `${out}/touch-${vp.width}.png` });
  await ctx.close();
}

// (g) all seven looks at 390: drawn, every key 44 pt, nothing sideways, no word cut
for (const world of ['scan', 'map', 'eye', 'orbit', 'grown', 'ink', 'glass']) {
  const { ctx, page, T } = await open(PHONE2, { world });
  await toJournal(page);
  const shown = await page.evaluate(() => window.__ghosty.journal.state);
  check(shown === 'shown', `${T} [g] the journal is "${shown}"`);
  const f = await fit(page, '#pg-journal');
  check(!f.small.length, `${T} [g] under 44 pt: ${f.small.join(', ')}`);
  check(!f.sideways, `${T} [g] the page goes sideways`);
  check(!f.cut.length, `${T} [g] words cut: ${JSON.stringify(f.cut)}`);
  await ctx.close();
}

await browser.close();
if (problems.length) {
  console.log(`journal spec: ${problems.length} problem(s)`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log('journal spec: all good');
