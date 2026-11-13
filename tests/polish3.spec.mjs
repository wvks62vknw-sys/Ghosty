// POLISH 3 (BRIEF-POLISH-3): the words and the two screens, at 440 × 956 and 390 × 844. Every check fails on the code before this brief
// (run against it once; its last line is in the report), except (d), which proves what OCTOBER IDEAS 1 already did.
//   a. ONE SENTENCE A SCREEN: on Settings (every panel), System (every panel), the Theme page (every section) and a pack's card, no visible
//      text node holds more than one sentence (one terminal full stop or none; EXCEPTIONS below, each with why), no switch row's helper
//      repeats its label, and a pack's card shows what it is, what it costs and one key (the licence and the rest are behind its "?");
//   b. THE AGENDA'S TEN FIXES, one check each, the brain mocked: the day's line and the free gap, ADD in two taps from anywhere, "half three"
//      read as he says it, a reminder's own words whole, WATCHERS in the Agenda's own rows, the empty day's words, the diary with no signal
//      said, a time that has gone refused, "N left today" and NOW, the biggest text and calm motion;
//   c. THE SYSTEM SCREEN'S TEN FIXES: the one honest line, every number with its unit and its "as of" (the database, the AI room, storage), a
//      wait said on each page that fetches, the report card readable at BODY 21, BACKUP's size on its key, every "?" a 44 pt target, nothing
//      that looks like a key and is not, the database's biggest users in words, HEALTH's keys counted, the frame rate and training's average
//      with their units;
//   d. "ON IT." in the phone's own voice: no request and no brain route on an ack, one word counted; never over DOWNLOAD (its confirm opens, zero
//      said); never over a reply being spoken;
//   e. ONE WATCHER SYSTEM: a price watch made by the money pack's words is under WATCHERS with STOP, and STOP removes it from the money pack's list;
//   f. SHARE TO GHOSTY: the manifest's share_target, a posted form (a picture and a line) lands in the library and the ask line, `?add=` unchanged;
//   g. THE LEFTOVERS: what's new has its lines, a failed project says RETRY, the local phrases open the seven screens, School speaks as I.
//   BASE=http://localhost:8819 node tests/polish3.spec.mjs [outDir]
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';
import { fakeSpeaker } from './fixtures/fakespeech.mjs';
import { brainAfter, brainBefore } from './fixtures/clean.mjs';

const { buildSync } = createRequire(new URL('../apps/web/package.json', import.meta.url))('esbuild');
const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const problems = [];
const check = (ok, what) => void (ok || problems.push(what));
process.on('uncaughtException', (e) => {
  problems.push(`crashed: ${String(e.message).split('\n')[0]}`);
  console.log(`PROBLEMS:\n${problems.join('\n')}`);
  process.exit(1);
});
const cleanBrain = await brainBefore(base);
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--disable-dev-shm-usage'] });

async function pure(entry) {
  const r = buildSync({ entryPoints: [new URL(`../${entry}`, import.meta.url).pathname], bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`);
}
const until = (page, fn, arg, ms = 8000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => false);
/** A section that cannot run to its end (the old code lacks what it reaches for) says so as one red line instead of ending the spec. */
const ONLY = process.env.ONLY?.split(',');
async function section(name, fn) {
  if (ONLY && !ONLY.includes(name[0])) return;
  try {
    await fn();
  } catch (e) {
    problems.push(`[${name}] could not run: ${String(e.message).split('\n')[0]}`);
  }
}

/** A phone opened on Ghosty. `time`: a fixed clock (Date only; timers run). `reduced`: Reduce Motion. */
async function open({ W = 440, hash = 'core', time = null, reduced = false, speaker = false, settings = {}, seed = null, pre = null } = {}) {
  const ctx = await browser.newContext({ viewport: W === 440 ? PHONE : { width: 390, height: 844 }, ...UK, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
  if (speaker) await ctx.addInitScript(fakeSpeaker);
  if (time) await page.clock.setFixedTime(time);
  await page.addInitScript(({ key, settings, seed }) => {
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.themes1', '1');
    if (!localStorage.getItem('spec.polish3.seeded')) {
      localStorage.setItem('spec.polish3.seeded', '1');
      localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Boss', speak: false, sounds: false, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 }, ...settings }));
      for (const [k, v] of Object.entries(seed ?? {})) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
    }
    window.__ghostyHero = true;
    window.__ghostyPlace = { none: true };
  }, { key: KEY, settings, seed });
  if (pre) await pre(page);
  await page.goto(`${base}/#${hash}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 }).catch(() => problems.push(`[open] the boot never ended at ${W}`));
  await page.waitForTimeout(900);
  return { ctx, page };
}
/** A section pill by its name, pressed through the page (a sticky row may sit under something; this never waits on it). */
const openSection = (page, tab, label) => page.evaluate(({ tab, label }) => {
  const p = [...document.querySelectorAll(`#pg-${tab} .secpills .secpill`)].find((x) => x.textContent.trim() === label);
  p?.click();
  return !!p;
}, { tab, label }).then(async (ok) => (await page.waitForTimeout(250), ok));
const go = async (page, hash, ms = 700) => {
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(150);
  await page.evaluate((h) => (location.hash = h), hash);
  await page.waitForTimeout(ms);
};

// ================================================================ a. one sentence a screen
const SENTENCES = `(t) => { const s = t.replace(/\\s+/g, ' ').trim(); const m = s.match(/[.!?…]["”’)]*(?=\\s+[A-Z“"‘(‹]|$)/g); return m ? m.length : 0; }`;
/**
 * What is allowed to say more than one sentence on these four screens, and why: nothing a page invents. A reading of the brain's own
 * (a feed's name, an error it sent, a number's source) is its data, not the page's words.
 */
const EXCEPTIONS = [
  [/^(HELP|ABOUT|PRIVACY)$/, 'a panel title'],
];
const exempt = (t) => EXCEPTIONS.some(([re]) => re.test(t));

/** Every visible text node of a screen's open page that says more than one sentence. */
const manySentences = (page, tab) => page.evaluate(({ tab, SENTENCES }) => {
  const count = eval(SENTENCES);
  const root = document.getElementById(`pg-${tab}`);
  const out = [];
  for (const e of root.querySelectorAll('*')) {
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    if (!r.width || !r.height || cs.visibility === 'hidden' || e.closest('[hidden]')) continue;
    // what is behind a closed "?" is not on the screen
    const det = e.closest('details');
    if (det && !det.open && !e.matches('summary') && !e.closest('summary')) continue;
    const own = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ').replace(/\s+/g, ' ').trim();
    if (own && count(own) > 1) out.push(`${tab}: ${own.slice(0, 140)}`);
  }
  return out;
}, { tab, SENTENCES });

/** A section pressed, and every panel of it drawn open at once (as each would be when tapped open): the page is measured in one look. */
const showSection = (page, tab, pill) => page.evaluate(async ({ tab, pill }) => {
  const root = document.getElementById(`pg-${tab}`);
  [...root.querySelectorAll('.secpills .secpill')].find((x) => x.textContent.trim() === pill)?.click();
  await new Promise((r) => setTimeout(r, 350));
  const pns = [...root.querySelectorAll('.pn[data-row]')].filter((p) => !p.hidden);
  root.classList.add('haspush');
  for (const p of pns) {
    p.dispatchEvent(new CustomEvent('ghosty:reveal', { bubbles: true }));
    p.classList.add('pushed');
  }
  await new Promise((r) => setTimeout(r, 350));
  return pns.length;
}, { tab, pill });
const hideSection = (page, tab) => page.evaluate((tab) => {
  const root = document.getElementById(`pg-${tab}`);
  root.querySelectorAll('.pn.pushed').forEach((p) => p.classList.remove('pushed'));
  root.classList.remove('haspush');
}, tab);
const pillsOf = (page, tab) => page.$$eval(`#pg-${tab} .secpills .secpill`, (e) => e.map((x) => x.textContent.trim()));

for (const W of [440, 390]) {
  await section(`a ${W}`, async () => {
    const T = `[${W}]`;
    const { ctx, page } = await open({ W, hash: 'settings' });
    const said = new Set();
    const note = (lines) => lines.forEach((l) => said.add(l));
    // Settings and System: each section with every one of its panels open
    for (const [tab, hash] of [['settings', 'settings'], ['system', 'system']]) {
      await go(page, hash, tab === 'system' ? 2200 : 1000);
      const pills = await pillsOf(page, tab);
      check(pills.length >= 4, `${T} [a] ${tab} has ${pills.length} sections`);
      let panels = 0;
      for (const pill of pills) {
        panels += await showSection(page, tab, pill);
        note(await manySentences(page, tab));
        if (tab === 'settings') {
          // the packs' cards: what it is, what it costs, one key; the licence and the rest behind the "?"
          const cards = await page.evaluate(() => [...document.querySelectorAll('#pg-settings .wikioffer')].filter((c) => c.getBoundingClientRect().height > 0).map((c) => {
            const vis = (e) => e.getBoundingClientRect().height > 0 && !e.closest('details:not([open])');
            const keys = [...c.querySelectorAll('button')].filter(vis).map((b) => b.textContent.trim());
            const lic = c.querySelector('.packlic');
            return { name: c.querySelector('b')?.textContent ?? '', keys, licVisible: !!lic && vis(lic), notes: [...c.querySelectorAll('small.note')].filter(vis).length, cost: [...c.querySelectorAll(':scope > small')].filter(vis).map((x) => x.textContent).join(' | ') };
          }));
          if (pill === 'Voice & home') check(cards.length >= 5, `${T} [a card] the packs show ${cards.length} cards`);
          for (const c of cards) {
            check(c.keys.length === 1, `${T} [a card] "${c.name}" shows ${c.keys.length} keys (${c.keys.join(', ')}): want the one`);
            check(!c.licVisible && c.notes === 0, `${T} [a card] "${c.name}" shows its licence or a note on the card itself`);
            check(/(MB|GB|KB)/.test(c.cost + c.keys.join(' ')), `${T} [a card] "${c.name}" does not say its size: ${c.cost} / ${c.keys}`);
          }
          // a switch row's helper never repeats its label
          const dup = await page.evaluate(() => [...document.querySelectorAll('#pg-settings button.setsw')].filter((b) => b.getBoundingClientRect().height > 0).map((b) => [b.querySelector('b')?.textContent ?? '', b.querySelector('small')?.textContent ?? '']).filter(([l, x]) => l && x && x.toLowerCase().includes(l.toLowerCase())).map(([l, x]) => `"${l}" in "${x}"`));
          check(!dup.length, `${T} [a rows] a helper repeats its label: ${dup.join('; ')}`);
        }
        await hideSection(page, tab);
      }
      check(panels >= (tab === 'settings' ? 18 : 12), `${T} [a] ${tab}: ${panels} panels were looked at`);
    }
    // the Theme page: every section
    await go(page, 'look', 1500);
    const lp = await pillsOf(page, 'look');
    check(lp.length >= 4, `${T} [a look] the Theme page has ${lp.length} sections`);
    for (const pill of lp) {
      await openSection(page, 'look', pill);
      await page.waitForTimeout(500);
      note(await manySentences(page, 'look'));
    }
    const bad = [...said].filter((l) => !exempt(l));
    check(!bad.length, `${T} [a] ${bad.length} visible text nodes say more than one sentence:\n    ${bad.slice(0, 25).join('\n    ')}`);
    await ctx.close();
  });
}

// ================================================================ b. the Agenda
const AGENDA = await pure('apps/web/src/features/agenda/words.ts');
const NOW = new Date(2026, 10, 13, 10, 0, 0);
const at = (h, m = 0, d = 0) => new Date(2026, 10, 13 + d, h, m, 0, 0).getTime();
const EVENTS = [
  { id: 'e1', title: 'Stand-up', start: at(9, 45), end: at(10, 30), source: 'mine' },
  { id: 'e2', title: 'Dentist', start: at(15, 30), end: at(16, 0), source: 'mine' },
  { id: 'e3', title: 'Gym', start: at(7, 0, 1), end: at(8, 0, 1), source: 'mine' },
];
const LONG_REMINDER = 'call the garage about the MOT and the brake pads, then ask them whether they can fit the winter tyres in the same visit, and bring the V5C and the old invoice and the spare key with you when you go on Thursday afternoon';
const JOBS = [{ id: 'j1', kind: 'reminder', title: LONG_REMINDER.slice(0, 120), text: LONG_REMINDER, next: at(17), repeat: 'none', tz: 'Europe/London' }];

/** The brain's agenda, mocked; every add the page sends is kept. */
async function mockAgenda(page, { events = EVENTS, jobs = JOBS, fail = false } = {}) {
  const sent = { events: [], jobs: [] };
  await page.route('**/api/agenda**', async (r) => {
    const u = new URL(r.request().url());
    if (r.request().method() === 'POST' && u.pathname.endsWith('/agenda/events')) {
      const b = JSON.parse(r.request().postData() ?? '{}');
      sent.events.push(b);
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ event: { id: 'new', source: 'mine', ...b } }) });
    }
    if (r.request().method() === 'GET' && u.pathname.endsWith('/agenda')) {
      if (fail) return r.abort('failed');
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tz: 'Europe/London', events, errors: [], jobs, feeds: [] }) });
    }
    return r.fallback();
  });
  await page.route('**/api/jobs', async (r) => {
    if (r.request().method() === 'POST') {
      sent.jobs.push(JSON.parse(r.request().postData() ?? '{}'));
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ job: { id: 'jn', kind: 'reminder', title: 'x', text: 'x', next: Date.now(), repeat: 'none', tz: 'Europe/London' } }) });
    }
    return r.fallback();
  });
  return sent;
}
const agendaOpen = async (page) => {
  await go(page, 'agenda', 600);
  await until(page, () => document.querySelector('#pg-agenda .hero .bigv')?.textContent, null, 8000);
  await page.waitForTimeout(500);
};

for (const W of [440, 390]) {
  await section(`b ${W}`, async () => {
    const T = `[${W}] [agenda]`;
    // a watcher the brain holds (made through its own route), so WATCHERS has a row when the Agenda opens
    await fetch(`${base}/__test/watcher?reset=1&forget=1`).catch(() => undefined);
    const mk = await fetch(`${base}/api/guardian/watchers`, { method: 'POST', headers: { 'x-ghosty': '1', 'x-ghosty-key': KEY, 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'page', url: 'https://watch.example.test/notice' }) }).then((r) => r.json()).catch(() => ({}));
    const { ctx, page } = await open({ W, time: NOW });
    const sent = await mockAgenda(page);
    await agendaOpen(page);
    // 1. the day's line: today's first thing and its time, the free gap said
    const hero = await page.evaluate(() => ({ big: document.querySelector('#pg-agenda .hero .bigv')?.textContent ?? '', sub: document.querySelector('#pg-agenda .hero .sub')?.textContent ?? '' }));
    check(/^Now: Stand-up$/.test(hero.big) && /In it until 10:30/.test(hero.sub), `${T} [1 the day's line] reads "${hero.big}" / "${hero.sub}" with a meeting on (want NOW and when it ends)`);
    const line = AGENDA.dayLine(EVENTS.filter((e) => e.id !== 'e1'), NOW.getTime());
    check(line.first === 'Dentist at 15:30' && line.gap === 'Free for 5 h 30 min' && line.left === 1, `${T} [1 the day's line] with nothing on: ${JSON.stringify(line)}`);
    // 9. a number that could be wrong: what is LEFT today, never how many there were
    check(/\d+ left today/.test(hero.sub) && !/events today/.test(hero.sub), `${T} [9 an honest count] says "${hero.sub}" (want "N left today", not all of today's)`);
    const nowRow = await page.evaluate(() => { const r = [...document.querySelectorAll('#pg-agenda .rw.ev')].find((x) => /Stand-up/.test(x.textContent)); return r ? { now: r.querySelector('.evin')?.textContent ?? '', past: r.classList.contains('past') } : null; });
    check(nowRow?.now === 'now', `${T} [9 NOW] the meeting on right now says "${nowRow?.now}" (want "now")`);
    // 2. ADD in two taps from anywhere on the screen (the key stays with the pills)
    await openSection(page, 'agenda', 'Calendars');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const add = page.locator('#pg-agenda .secpills .agaddkey');
    check((await add.count()) === 1, `${T} [2 ADD] there is no ADD key with the section pills`);
    if (await add.count()) {
      const box = await add.boundingBox();
      check(box && box.height >= 43.5 && box.width >= 43.5 && box.y >= 0 && box.y + box.height <= (W === 440 ? 956 : 844), `${T} [2 ADD] the key is not 44 pt and in view from the bottom of the page: ${JSON.stringify(box)}`);
      let taps = 0;
      await add.click();
      taps++;
      await page.waitForSelector('.modal input[aria-label="What and when"]', { timeout: 4000 }).catch(() => problems.push(`${T} [2 ADD] the first tap opened no box to say it in`));
      await page.fill('.modal input[aria-label="What and when"]', 'dentist half three');
      const say = await page.textContent('.modal .agsay').catch(() => '');
      check(/Dentist · Today 15:30/.test(say ?? ''), `${T} [3 half three] the box says "${say}" before the tap`);
      await page.locator('.modal .agaddgo').click();
      taps++;
      await until(page, () => true, null, 300);
      await page.waitForTimeout(500);
      const ev = sent.events.at(-1);
      check(taps === 2 && ev && ev.title === 'Dentist' && ev.start === at(15, 30), `${T} [2 ADD in two taps / 3 half three] ${taps} taps added ${JSON.stringify(ev)} (want Dentist at 15:30 today)`);
    }
    // 3. the parser as he says it (pure, the clock given)
    const P = (t) => AGENDA.parseWhen(t, NOW.getTime());
    const cases = [['dentist half three', 'Dentist', at(15, 30)], ['quarter past nine', '', at(21, 15)], ['quarter to five call Sam', 'Call Sam', at(16, 45)], ['ring mum tomorrow at 7', 'Ring mum', at(7, 0, 1)], ['lunch with Ann friday 1pm', 'Lunch with Ann', at(13, 0, 7)], ['7:45pm gym', 'Gym', at(19, 45)], ['noon lunch', 'Lunch', at(12, 0)]];
    for (const [t, title, when] of cases) {
      const w = P(t);
      check(w && w.title === title && w.at === when, `${T} [3 half three] "${t}" reads ${JSON.stringify(w && { title: w.title, said: w.said })} (want "${title}" at ${new Date(when).toString().slice(0, 21)})`);
    }
    check(P('buy milk') === null, `${T} [3 half three] a line with no time is not given one`);
    // 4. a reminder's own words, kept whole
    await openSection(page, 'agenda', 'Reminders');
    const rem = await page.evaluate(() => [...document.querySelectorAll('#pg-agenda .rw')].map((r) => r.textContent).find((t) => /garage/.test(t)) ?? '');
    check(rem.includes('spare key with you when you go on Thursday afternoon'), `${T} [4 whole words] a long reminder is cut: "${rem.slice(0, 160)}…"`);
    // 5. WATCHERS in the Agenda's own rows (one page of the money pack's watch, made through the brain)
    await openSection(page, 'agenda', 'Spending');
    await page.evaluate(() => document.querySelector('#pg-agenda .pn.watchers')?.dispatchEvent(new CustomEvent('ghosty:reveal', { bubbles: true })));
    await until(page, () => document.querySelectorAll('#pg-agenda .watchers .wrow').length >= 1, null, 12000);
    const wrow = await page.evaluate(() => { const r = document.querySelector('#pg-agenda .watchers .wrow'); return r ? { rw: r.classList.contains('rw'), k: r.querySelector('.k')?.textContent ?? '', stop: (() => { const b = r.querySelector('button.wstop'); const x = b?.getBoundingClientRect(); return x ? Math.round(x.height) : 0; })() } : null; });
    check(wrow && wrow.rw && /^\d\d:\d\d$/.test(wrow.k) && wrow.stop >= 44, `${T} [5 WATCHERS] a watch is not a row of the Agenda's own (time first, STOP last at 44 pt): ${JSON.stringify(wrow)}`);
    if (mk?.watcher?.id) await fetch(`${base}/api/guardian/watchers?id=${mk.watcher.id}`, { method: 'DELETE', headers: { 'x-ghosty': '1', 'x-ghosty-key': KEY } }).catch(() => undefined);
    // 6. the empty day, in his voice, with the one next thing
    const empty = await ctx.newPage();
    await empty.clock.setFixedTime(NOW);
    await mockAgenda(empty, { events: [], jobs: [] });
    await empty.goto(`${base}/#agenda`, { waitUntil: 'domcontentloaded' });
    await until(empty, () => document.querySelector('#pg-agenda .hero .bigv')?.textContent, null, 15000);
    await empty.waitForTimeout(900);
    const ed = await empty.evaluate(() => document.querySelector('#pg-agenda .pn.scroll .empty')?.textContent ?? document.querySelector('#pg-agenda')?.textContent ?? '');
    check(/Nothing in the next two weeks\./.test(ed) && /Tap ADD and say what and when\./.test(ed) && !/connect a calendar|below/.test(ed), `${T} [6 the empty day] reads "${ed.slice(0, 160)}"`);
    const eh = await empty.evaluate(() => document.querySelector('#pg-agenda .hero .bigv')?.textContent ?? '');
    check(/Nothing today/.test(eh), `${T} [6 the empty day] the line at the top reads "${eh}"`);
    await empty.close();
    // 7. no signal and nothing kept: said, not a bare OFFLINE
    const off = await open({ W, pre: (p) => mockAgenda(p, { fail: true }) });
    await off.page.evaluate(() => (location.hash = 'agenda'));
    await off.page.waitForSelector('#pg-agenda .agoff', { timeout: 15000 }).catch(() => problems.push(`${T} [7 no signal] the diary says nothing in his words when the brain cannot be reached`));
    const offText = await off.page.evaluate(() => document.querySelector('#pg-agenda .agoff')?.textContent ?? '');
    check(offText === AGENDA.DIARY_OFFLINE, `${T} [7 no signal] says "${offText}"`);
    await off.ctx.close();
    // 8. a time that has gone is refused, not added
    await go(page, 'agenda', 500);
    await openSection(page, 'agenda', 'Diary');
    const before = sent.events.length;
    await page.fill('#pg-agenda .addev input[aria-label="Event title"]', 'Too late');
    await page.fill('#pg-agenda .addev input[aria-label="Event start"]', '2026-11-13T08:00');
    await page.locator('#pg-agenda .addev button', { hasText: /^ADD$/ }).first().click();
    await page.waitForTimeout(500);
    const toast = await page.evaluate(() => document.querySelector('.toast')?.textContent ?? '');
    check(sent.events.length === before && /That time has gone/.test(toast), `${T} [8 a time that has gone] sent ${sent.events.length - before} and said "${toast}"`);
    // 10. the biggest text and calm motion
    await page.evaluate(() => (document.documentElement.dataset.body = '21'));
    await page.waitForTimeout(400);
    const big = await page.evaluate(() => {
      const root = document.getElementById('pg-agenda');
      const cut = [...root.querySelectorAll('.bigv, .sub, .rw .v, .rw .k, .rw .evt, button, summary')].filter((e) => e.getClientRects().length && e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflowX !== 'visible').map((e) => `${e.tagName.toLowerCase()}.${e.className} "${e.textContent.trim().slice(0, 24)}"`);
      return { cut, sideways: document.documentElement.scrollWidth > innerWidth };
    });
    check(!big.cut.length && !big.sideways, `${T} [10 BODY 21] clips ${big.cut.slice(0, 4).join('; ')}${big.sideways ? ' and goes sideways' : ''}`);
    await page.evaluate(() => delete document.documentElement.dataset.body);
    await ctx.close();
    const calm = await open({ W, time: NOW, reduced: true });
    await mockAgenda(calm.page);
    await agendaOpen(calm.page);
    const anim = await calm.page.evaluate(() => getComputedStyle(document.querySelector('#pg-agenda .rcundo')).animationName);
    check(anim === 'none', `${T} [10 calm motion] the UNDO bar animates under Reduce Motion (${anim})`);
    await calm.ctx.close();
  });
}

// ================================================================ c. the System screen
const SYS = await pure('apps/web/src/features/system/words.ts');
for (const W of [440, 390]) {
  await section(`c ${W}`, async () => {
    const T = `[${W}] [system]`;
    // the report card seeded, the graphics chip stood in for: the card is readable at the biggest text
    const { ctx, page } = await open({ W, hash: 'system' });
    // 1. ONE HONEST LINE (pure, then on the page)
    const facts = { reached: true, models: 2, keys: 3, needed: 0, at: new Date(2026, 10, 13, 10, 0).getTime() };
    check(SYS.honestLine(facts).big === 'WORKING' && /as of 10:00/.test(SYS.honestLine(facts).sub), `${T} [1 honest line] working reads ${JSON.stringify(SYS.honestLine(facts))}`);
    check(SYS.honestLine({ ...facts, reached: false }).big === 'NOT WORKING' && /can’t reach my brain/.test(SYS.honestLine({ ...facts, reached: false }).sub), `${T} [1 honest line] unreachable reads ${JSON.stringify(SYS.honestLine({ ...facts, reached: false }))}`);
    check(/Add the 2 keys under NEEDED/.test(SYS.honestLine({ ...facts, needed: 2 }).sub) && /memory is paused until/.test(SYS.honestLine({ ...facts, meter: { level: 1.2, resetAt: facts.at } }).sub), `${T} [1 honest line] a missing key and a paused memory are said`);
    await go(page, 'system', 2200);
    const top = await page.evaluate(() => ({ big: document.querySelector('#pg-system .hero .bigv')?.textContent ?? '', sub: document.querySelector('#pg-system .hero .sub')?.textContent ?? '' }));
    check(/^(WORKING|NOT WORKING)$/.test(top.big) && /\(as of \d\d:\d\d\)\.$/.test(top.sub), `${T} [1 honest line] the top reads "${top.big}" / "${top.sub}"`);
    // 2. every number with its unit and its "as of"
    check(/requests a minute/.test(SYS.roomNow(3, 10)) && /requests$/.test(SYS.roomToday('12', '1,000')), `${T} [2 units] the AI room's numbers say requests`);
    const adv = await page.evaluate(() => { const d = document.querySelector('#pg-system details.adv'); if (d) d.open = true; return [...(d?.querySelectorAll('.rw') ?? [])].map((r) => r.textContent).find((t) => /DATABASE TODAY/i.test(t)) ?? ''; });
    check(!adv || (/rows read/.test(adv) && /rows written/.test(adv) && /as of \d\d:\d\d/.test(adv)), `${T} [2 units] the database row reads "${adv}"`);
    const stor = await page.evaluate(() => document.querySelector('#pg-system .storageline')?.textContent ?? '');
    check(/as of \d\d:\d\d$/.test(stor), `${T} [2 as of] the storage line reads "${stor}"`);
    // 7. the database's biggest users in his words, not code words ("route:library 111r/304w")
    const big = SYS.biggestLine([{ label: 'route:library', r: 111, w: 304 }, { label: 'route:/', r: 2, w: 0 }]);
    check(big === 'library 111 rows read, 304 written · the app 2 rows read, 0 written', `${T} [7 no code words] the biggest users read "${big}"`);
    const resets = await page.evaluate(() => [...document.querySelectorAll('#pg-system details.adv .rw')].map((r) => r.textContent).find((t) => /ALLOWANCE RESETS/i.test(t)) ?? '');
    check(!/route:|\d+r\/\d+w|biggest:/.test(resets), `${T} [7 no code words] the allowance row reads "${resets}"`);
    // 8. HEALTH's KEYS row: how many of how many, never a list of twenty names (the ones not added behind its WHICH)
    check(SYS.keysLine(['Gemini', 'Groq'], ['Tavily', 'TomTom', 'Brave', 'NASA'], 'as of 10:00') === '2 of 6 added: Gemini, Groq; not yet: Tavily, TomTom, Brave and 1 more (as of 10:00).' && SYS.keysLine([], ['Gemini', 'Groq'], 'as of 10:00') === 'None of the 2 added yet: Gemini, Groq (as of 10:00).' && SYS.keysLine(['Gemini'], [], 'as of 10:00') === '1 of 1 added: Gemini (as of 10:00).', `${T} [8 the keys line] reads "${SYS.keysLine(['Gemini', 'Groq'], ['Tavily', 'TomTom', 'Brave', 'NASA'], 'as of 10:00')}"`);
    // 9. the frame rate with its units (never "58 fps @ 75%")
    check(SYS.frameLine(58.4, 0.75) === '58 frames a second, drawn at 75% size', `${T} [9 units] the frame rate reads "${SYS.frameLine(58.4, 0.75)}"`);
    const fr = await page.evaluate(() => [...document.querySelectorAll('#pg-system details.adv .rw')].map((r) => r.textContent).find((t) => /FRAME RATE/i.test(t)) ?? '');
    check(!fr || (/frames a second/.test(fr) && !/@/.test(fr)), `${T} [9 units] the frame-rate row reads "${fr}"`);
    // 10. the training report's AVERAGE says what it averages (the test score, old brain → new)
    check(SYS.averageLine('62%', '71%') === 'test score 62% on the old brain → 71% on the new', `${T} [10 the average] reads "${SYS.averageLine('62%', '71%')}"`);
    // 3. a wait said on each page that fetches (the brain slowed down)
    const slow = await open({ W, hash: 'core' });
    for (const path of ['**/api/status', '**/api/training', '**/api/backup']) await slow.page.route(path, async (r) => { await new Promise((x) => setTimeout(x, 2500)); r.fallback(); });
    await slow.page.evaluate(() => (location.hash = 'system'));
    await slow.page.waitForTimeout(1300);
    const waits = await slow.page.evaluate(() => [...document.querySelectorAll('#pg-system .waiting')].map((x) => x.dataset.wait));
    for (const w of [SYS.WAIT.keys, SYS.WAIT.training, SYS.WAIT.backups]) check(waits.includes(w), `${T} [3 a wait said] no "${w}" while the page waits (saw ${JSON.stringify(waits)})`);
    await slow.ctx.close();
    // 5. BACKUP says its size before the tap
    await openSection(page, 'system', 'Backup');
    await page.waitForTimeout(900);
    const bk = await page.evaluate(() => [...document.querySelectorAll('#pg-system button')].map((b) => b.textContent.trim()).find((t) => /^BACK UP NOW/.test(t)) ?? '');
    check(/^BACK UP NOW · about \d[\d.]* (KB|MB)$/.test(bk), `${T} [5 backup size] the key reads "${bk}"`);
    // 6. every "?" is a 44 pt target, and nothing that is not a key is drawn as one (a pointer over a thing that does nothing)
    // (the "?" keys that now hold what the one-sentence lines left out: there are several, each 44 pt)
    await page.evaluate(() => document.querySelectorAll('#pg-system .pn[data-row]').forEach((p) => p.dispatchEvent(new CustomEvent('ghosty:reveal', { bubbles: true }))));
    const keys = await page.evaluate(() => [...document.querySelectorAll('#pg-system details.pkmore summary')].map((s) => s.parentElement.closest('.pn')?.querySelector('.ptitle')?.textContent ?? '?'));
    check(keys.length >= 5, `${T} [6 the "?" keys] SYSTEM has ${keys.length} "?" keys (want the facts the cuts moved)`);
    const heights = await page.evaluate(() => { document.querySelectorAll('#pg-system details.pkmore').forEach((d) => (d.open = false)); return [...document.querySelectorAll('#pg-system details.pkmore summary')].map((s) => ({ h: Math.round(s.getBoundingClientRect().height), shown: s.getClientRects().length > 0 })).filter((x) => x.shown).map((x) => x.h); });
    check(heights.every((h) => h >= 44), `${T} [6 the "?" keys] a "?" is under 44 pt: ${heights}`);
    // (and nothing that is drawn as a key — filled, rounded, a short word — is not one)
    const fake = await page.evaluate(() => {
      const out = [];
      for (const e of document.querySelectorAll('#pg-system *')) {
        if (!e.getClientRects().length) continue;
        const tag = e.tagName.toLowerCase();
        if (['button', 'a', 'summary', 'input', 'select', 'textarea', 'label', 'option', 'svg', 'path', 'rect', 'circle', 'line', 'polyline', 'i'].includes(tag) || e.closest('button, a, summary, label, h3, [role=button]')) continue;
        const cs = getComputedStyle(e);
        const r = e.getBoundingClientRect();
        const filled = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || (cs.borderTopWidth !== '0px' && cs.borderTopStyle !== 'none');
        const t = (e.textContent || '').trim();
        if (parseFloat(cs.borderTopLeftRadius) >= 6 && filled && r.height >= 22 && r.height <= 64 && r.width >= 40 && t.length > 0 && t.length <= 30 && e.children.length < 4) out.push(`${tag}.${e.className} "${t}"`);
      }
      return out.slice(0, 5);
    });
    check(!fake.length, `${T} [6 nothing looks like a key and is not] ${fake.join(', ')}`);
    await page.screenshot({ path: `${out}/polish3-system-${W}.png` });
    // 4. the report card readable at BODY 21 (its own rows, as the card draws them)
    const rc = await page.evaluate(() => {
      document.documentElement.dataset.body = '21';
      const card = document.createElement('div');
      card.className = 'pn reportcard';
      card.style.cssText = 'position:absolute;left:0;top:0;width:calc(100vw - 32px);margin:0 16px;';
      card.innerHTML = '<div class="rcrow rchd"><span>KIND</span><span>AS IN CHAT</span><span>THINK HARDER</span><span>TIME</span></div><div class="rcrow"><span class="rccat">LOGIC PUZZLES</span><b>3 of 4</b><b class="rcthink">4 of 4</b><span class="rctime">2 min 30 s</span></div><div class="rcrow"><span class="rccat">TOOL CALLS</span><b>1 of 4</b><b class="rcthink">2 of 4</b><span class="rctime">48 s</span></div>';
      document.body.append(card);
      const cut = [...card.querySelectorAll('.rccat, .rcrow > *')].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'visible').map((e) => e.textContent.trim());
      const small = [...card.querySelectorAll('.rccat, .rchd > *')].map((e) => parseFloat(getComputedStyle(e).fontSize)).filter((s) => s < 12);
      const sideways = card.scrollWidth > innerWidth || document.documentElement.scrollWidth > innerWidth;
      card.remove();
      delete document.documentElement.dataset.body;
      return { cut, small, sideways };
    });
    check(!rc.cut.length && !rc.small.length && !rc.sideways, `${T} [4 report card BODY 21] cut ${rc.cut.join(', ')}; under 12 px: ${rc.small}; sideways ${rc.sideways}`);
    await ctx.close();
  });
}

// ================================================================ d. "On it." in the phone's own voice
await section('d', async () => {
  const { ctx, page } = await open({ W: 440, hash: 'settings', speaker: true, settings: { speak: true, voiceEngine: 'phone', sayStart: true } });
  // every fetch, XHR and beacon the page makes is counted from inside the page, so a background request landing meanwhile is told apart
  await page.evaluate(() => {
    window.__net = 0;
    window.__netWho = [];
    const f = window.fetch;
    window.fetch = function (...a) { window.__net++; window.__netWho.push(`${String(a[0]).slice(0, 60)} ${new Error().stack.split('\n').slice(2, 4).join(' | ').slice(0, 200)}`); return f.apply(this, a); };
    const x = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (...a) { window.__net++; return x.apply(this, a); };
    if (navigator.sendBeacon) { const b = navigator.sendBeacon.bind(navigator); navigator.sendBeacon = (...a) => (window.__net++, b(...a)); }
  });
  await page.waitForFunction(() => window.__ghosty?.acks, null, { timeout: 15000 }).catch(() => problems.push('[d] the acks are not on the page'));
  const spoken = () => page.evaluate(() => window.__spoken.filter((t) => t === 'On it.' || t === 'Sitting it now.'));
  const tap = (label) => page.evaluate(async (label) => {
    const b = document.body.appendChild(document.createElement('button'));
    b.textContent = label;
    const n = window.__ghosty.acks.said.length;
    b.click();
    b.remove();
    return window.__ghosty.acks.said.slice(n);
  }, label);
  // an ack: one word, counted by the fake speaker, and not one request while it is said
  // three different acks (the same one inside four seconds is one tap), each counted on its own: a background request may land in one
  // window, so the ack makes none if any window shows none (an ack that asked for a route would show it in every one)
  const trials = [];
  for (const label of ['PUBLISH', 'WATCH', 'STUDY ALL: OFF']) {
    await page.evaluate(() => (window.__spoken.length = 0));
    const net0 = await page.evaluate(() => window.__net);
    const got = await page.evaluate(async (label) => {
      const b = document.body.appendChild(document.createElement('button'));
      b.textContent = label;
      const n = window.__ghosty.acks.said.length;
      b.click();
      b.remove();
      // (only microtasks pass here, no timer: a background request cannot land in between, so what is counted is the ack's own)
      for (let i = 0; i < 5; i++) await Promise.resolve();
      return { said: window.__ghosty.acks.said.slice(n), net: window.__net, who: window.__netWho.slice(-2) };
    }, label);
    await page.waitForTimeout(300);
    check(got.said.length === 1 && got.said[0] === 'On it.' && (await spoken()).length === 1, `[d] the ack for "${label}" said ${JSON.stringify(got.said)} and the speaker counted ${(await spoken()).length}`);
    trials.push(got.net - net0);
    await until(page, () => window.__ghosty.ui.get().voice !== 'speaking', null, 4000);
  }
  check(Math.min(...trials) === 0, `[d] an ack made request(s) every time (${trials}): a brain route or the network is not what says "On it."`);
  // never over DOWNLOAD (and a pack's GET): the key's own tap says nothing, and the table has no row for it
  await go(page, 'settings', 700);
  await page.evaluate(() => {
    const pn = [...document.querySelectorAll('#pg-settings .pn[data-row]')].find((p) => (p.querySelector('.ptitle')?.textContent ?? '').trim() === 'OFFLINE BRAIN');
    pn?.dispatchEvent(new CustomEvent('ghosty:reveal', { bubbles: true }));
    pn?.querySelector('h3')?.click();
  });
  await page.waitForTimeout(700);
  await page.evaluate(() => (window.__spoken.length = 0));
  const nBefore = await page.evaluate(() => window.__ghosty.acks.said.length);
  const dl = page.locator('#pg-settings button', { hasText: /^DOWNLOAD$/ }).first();
  check((await dl.count()) === 1, '[d] the offline brain has no DOWNLOAD key to tap');
  if (await dl.count()) await dl.click({ force: true, timeout: 4000 }).catch(() => undefined);
  for (const label of ['DOWNLOAD', 'Get · about 70 MB', 'RETRY · 27 MB']) await tap(label);
  await page.waitForTimeout(800);
  check((await spoken()).length === 0 && (await page.evaluate(() => window.__ghosty.acks.said.length)) === nBefore, '[d] a download key was acked: a word was said before it was allowed');
  // never over a reply being spoken
  await page.evaluate(() => window.__ghosty.ui.set({ voice: 'speaking' }));
  await page.waitForTimeout(4300);
  await page.evaluate(() => (window.__spoken.length = 0));
  const over = await tap('SIT');
  await page.waitForTimeout(300);
  check(over.length === 0 && (await spoken()).length === 0, `[d] an ack was said over a reply being spoken: ${JSON.stringify(over)}`);
  await page.evaluate(() => window.__ghosty.ui.set({ voice: 'idle' }));
  // the table has no row for a download
  const ACKS = readFileSync(new URL('../apps/web/src/assistant/acks.ts', import.meta.url), 'utf8');
  check(!/DOWNLOAD|GET\b/.test(ACKS.slice(ACKS.indexOf('export const ACKS'), ACKS.indexOf('/** The same action'))), '[d] the ack table has a row for a download');
  await ctx.close();
});

// ================================================================ e. one watcher system
await section('e', async () => {
  const H = { 'x-ghosty': '1', 'x-ghosty-key': KEY, 'content-type': 'application/json' };
  const api = async (path, init) => (await fetch(`${base}/api${path}`, { headers: H, ...init })).json();
  await fetch(`${base}/__test/watcher?reset=1&forget=1`).catch(() => undefined);
  const start = await api('/packs/do', { method: 'POST', body: JSON.stringify({ pack: 'money', action: 'watch', args: { url: 'https://watch.example.test/kettle' } }) });
  check(/^Watching Hartley Kettle 1\.7 L: £29\.99 now/.test(start.text ?? '') && /every hour/.test(start.text ?? ''), `[e] the money pack's watch answered "${start.text}"`);
  const list = await api('/guardian/watchers');
  const mine = (list.watchers ?? []).find((w) => w.kind === 'price' && /kettle/i.test(w.url));
  check(!!mine, `[e] the price watch is not among the watchers: ${JSON.stringify((list.watchers ?? []).map((w) => [w.kind, w.url]))}`);
  const { ctx, page } = await open({ W: 440, hash: 'agenda' });
  await openSection(page, 'agenda', 'Spending');
  await page.evaluate(() => document.querySelector('#pg-agenda .pn.watchers')?.dispatchEvent(new CustomEvent('ghosty:reveal', { bubbles: true })));
  const shown = await until(page, () => [...document.querySelectorAll('#pg-agenda .watchers .wrow')].some((r) => /Kettle/i.test(r.textContent)), null, 15000);
  check(shown, '[e] WATCHERS under PLAN does not list the price watch made by the money pack');
  const stop = page.locator('#pg-agenda .watchers .wrow', { hasText: /Kettle/i }).locator('button', { hasText: 'STOP' });
  check((await stop.count()) === 1, '[e] the price watch has no STOP');
  if (await stop.count()) await stop.click();
  await page.waitForTimeout(900);
  const after = await api('/packs/do', { method: 'POST', body: JSON.stringify({ pack: 'money', action: 'watch', args: {} }) });
  check(/Not watching any prices/.test(after.text ?? ''), `[e] after STOP the money pack's list says "${after.text}"`);
  await ctx.close();
  await fetch(`${base}/__test/watcher?reset=1&forget=1`).catch(() => undefined);
});

// ================================================================ f. share to Ghosty
await section('f', async () => {
  const man = await (await fetch(`${base}/manifest.webmanifest`)).json();
  const st = man.share_target ?? {};
  check(st.action === '/share-target' && st.method === 'POST' && st.enctype === 'multipart/form-data', `[f] the manifest's share_target is ${JSON.stringify({ a: st.action, m: st.method, e: st.enctype })}`);
  const p = st.params ?? {};
  check(p.title === 'title' && p.text === 'text' && p.url === 'url' && p.files?.[0]?.name === 'files', `[f] share_target names ${JSON.stringify({ t: p.title, x: p.text, u: p.url, f: p.files?.map((f) => f.name) })}`);
  const acc = (p.files?.[0]?.accept ?? []).join(' ');
  for (const want of ['image/*', 'application/pdf', 'audio/*', 'video/*', 'wordprocessingml', 'spreadsheetml', 'presentationml']) check(acc.includes(want), `[f] share_target does not accept ${want}`);
  // the Shortcuts' ?add= is unchanged
  const DL = await pure('apps/web/src/features/settings/deeplinks.ts');
  const add = DL.parseLink('?add=https%3A%2F%2Fexample.test%2Fa', { owner: true, tabs: ['core'] });
  check(add?.kind === 'add' && add.url === true && add.text === 'https://example.test/a', `[f] ?add= reads ${JSON.stringify(add)}`);
  // a form posted to the share path (a picture and a line of words): the library has the picture, the ask line the words
  const { ctx, page } = await open({ W: 440, hash: 'core' });
  await page.evaluate(() => navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(() => navigator.serviceWorker.ready)).catch(() => undefined);
  await until(page, () => !!navigator.serviceWorker.controller, null, 8000);
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) await page.reload({ waitUntil: 'domcontentloaded' });
  await until(page, () => !!navigator.serviceWorker.controller, null, 8000);
  const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  await page.evaluate(async (PNG) => {
    const f = document.createElement('form');
    f.method = 'POST';
    f.action = '/share-target';
    f.enctype = 'multipart/form-data';
    const t = document.createElement('input');
    t.name = 'text';
    t.value = 'The pharmacy opens at eight on Saturday';
    const i = document.createElement('input');
    i.type = 'file';
    i.name = 'files';
    const dt = new DataTransfer();
    dt.items.add(new File([Uint8Array.from(atob(PNG), (c) => c.charCodeAt(0))], 'shared-pic.png', { type: 'image/png' }));
    i.files = dt.files;
    f.append(t, i);
    document.body.append(f);
    f.submit();
  }, PNG);
  await page.waitForURL(/shared=/, { timeout: 15000 }).catch(() => problems.push('[f] the share did not come back to the app with its marker'));
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 }).catch(() => undefined);
  const gotLib = await until(page, () => [...document.querySelectorAll('#pg-library .liblog .note')].some((n) => /shared-pic\.png/.test(n.textContent)), null, 30000);
  check(gotLib, '[f] the shared picture is not in the library (no line for shared-pic.png)');
  const box = await page.evaluate(() => document.querySelector('#cin')?.value ?? '');
  check(box === 'The pharmacy opens at eight on Saturday', `[f] the ask line holds "${box}" (want the shared words, not sent)`);
  // (the shared words as a sent message; an earlier spec's turns on the same preview brain are not this share's)
  const sent = await page.evaluate(() => [...document.querySelectorAll('.msg.me, .msg.user')].filter((m) => /pharmacy opens at eight/i.test(m.textContent ?? '')).length);
  check(sent === 0, '[f] a share sent its words by itself');
  const said = await page.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent).join('|'));
  check(/Shared from another app; kept here\./.test(said), `[f] the first share did not say it was kept here: "${said}"`);
  await ctx.close();
});

// ================================================================ g. the leftovers
await section('g', async () => {
  const WN = await pure('apps/web/src/state/whatsnew.ts');
  check(WN.WHATS_NEW.filter((n) => n.day >= '2026-11-01').length >= 8, `[g a] WHAT'S NEW has ${WN.WHATS_NEW.filter((n) => n.day >= '2026-11-01').length} lines from November (want the fortnight written in)`);
  const SA = await pure('apps/web/src/assistant/screenasks.ts');
  const lists = {};
  for (const [id, f] of [['workshop', 'workshop'], ['studio', 'studio'], ['reverse', 'reverse'], ['space', 'space'], ['learn', 'learn'], ['arcade', 'arcade'], ['school', 'school']]) {
    const src = readFileSync(new URL(`../apps/web/src/features/${f}/words.ts`, import.meta.url), 'utf8');
    const m = /export const PHRASES = \[([^\]]*)\]/.exec(src);
    lists[id] = m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : [];
    check(lists[id].length >= 1, `[g c] ${f}/words.ts lists no phrase`);
    for (const ph of lists[id]) {
      const a = SA.screenAsked(ph);
      check(a?.tab === id, `[g c] "${ph}" opens ${a?.tab ?? 'nothing'} (want ${id})`);
    }
  }
  const phr = readFileSync(new URL('../apps/web/src/assistant/phrases.ts', import.meta.url), 'utf8');
  check(/id: 'openscreen', test: \(t: string\) => !!screenAsked\(t\)/.test(phr), '[g c] the local phrase table has no entry for opening a screen');
  const { ctx, page } = await open({ W: 440, hash: 'core' });
  // (d) the Make hub's Reverse card matches Reverse's own line
  const RV = await pure('apps/web/src/features/reverse/words.ts');
  const dk = readFileSync(new URL('../apps/web/src/shell/deckcopy.ts', import.meta.url), 'utf8');
  check(/promise: REVERSE_SUB,/.test(dk) && /Paste a link and I take it apart/.test(RV.REVERSE_SUB), '[g d] the Make hub\'s Reverse card is not Reverse\'s own line');
  // (b) a project a failure stopped says RETRY, one paused by hand RESUME
  const wsrc = readFileSync(new URL('../apps/web/src/features/workshop/index.ts', import.meta.url), 'utf8');
  check(/stoppedByFailure\(p\) \? 'RETRY' : 'RESUME'/.test(wsrc), '[g b] the Workshop key for a failed project does not say RETRY');
  // (10a) School speaks as I: no "he" in what it says
  await go(page, 'school', 1500);
  const txt = await page.evaluate(() => document.getElementById('pg-school').innerText);
  const hes = txt.match(/\b(he|his|him|He|His)\b/g) ?? [];
  check(!hes.length, `[g 10a] SCHOOL says ${hes.join(', ')} on its page`);
  const gym = readFileSync(new URL('../apps/web/src/gym/stretch.ts', import.meta.url), 'utf8');
  check(!/'[^']*\b(he|his|him)\b[^']*'/.test(gym.replace(/\/\*[\s\S]*?\*\//g, '')), '[g 10a] the GYM\'s puzzles line still says he');
  const GW = readFileSync(new URL('../apps/web/src/features/gym/words.ts', import.meta.url), 'utf8');
  check(/LEAGUE_HELPER = 'This rating compares me only with my own earlier versions, never with people\.'/.test(GW), '[g 10c] the league rating has no helper sentence');
  await ctx.close();
});

// ================================================================== h. 2d: the photo and video editors' work rides the daily backup
// (their JSON only: a photo's recipe and the brush pictures it names, his own looks, a video project; the photos and clips stay on the phone)
await section('h', async () => {
  const root = new URL('../', import.meta.url).pathname;
  const r = buildSync({
    stdin: { contents: "import { collect, restoreEditors, reportText } from './apps/web/src/features/system/backup.ts';\nimport * as ph from './apps/web/src/photo/store.ts';\nimport * as vd from './apps/web/src/video/store.ts';\nimport { newRecipe } from './apps/web/src/photo/recipe.ts';\nimport { newProject } from './apps/web/src/video/model.ts';\nwindow.__bk = { collect, restoreEditors, reportText, ph, vd, newRecipe, newProject };", resolveDir: root, loader: 'ts' },
    bundle: true, write: false, format: 'iife', platform: 'browser', logLevel: 'silent', loader: { '.css': 'empty' },
  });
  const { ctx, page } = await open({ W: 390, hash: 'core' });
  await page.evaluate(r.outputFiles[0].text); // (as a script the page's own policy would refuse: run by the test, not by the page)
  const got = await page.evaluate(async () => {
    const B = window.__bk;
    const png = new Blob([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0))], { type: 'image/png' });
    const kept = await B.ph.keepPhoto(png, 'Backup test photo', { w: 1, h: 1 });
    const id = kept.meta.id;
    const rc = B.newRecipe();
    rc.light.exposure = 0.7;
    await B.ph.saveRecipe(id, rc);
    await B.ph.saveMyLook({ name: 'Backup test look', line: 'A test look.', mine: true, look: { light: rc.light, wb: rc.wb, curves: rc.curves, color: rc.color, detail: rc.detail, effects: rc.effects } });
    const proj = B.newProject('Backup test film');
    await B.vd.saveProject(proj);
    const bundle = await B.collect();
    const inPhoto = bundle.editors?.photos.find((p) => p.id === id);
    const inLook = bundle.editors?.looks.some((l) => l.name === 'Backup test look');
    const inFilm = bundle.editors?.videos.some((v) => v.id === proj.id);
    // the edit lost (reset to plain), the look and the project gone: the photo itself still here; the copy dated after the reset
    await B.ph.saveRecipe(id, B.newRecipe());
    const row = await B.ph.getMeta(id);
    inPhoto.at = row.at + 1000;
    await B.ph.removeMyLook('Backup test look');
    await B.vd.removeProject(proj.id);
    const out = { restored: [], merged: [], same: [], skipped: [], docs: 0, photos: 0, looks: 0, videos: 0, photosAway: 0 };
    const away = { ...inPhoto, id: 'pnotonthisphone' };
    await B.restoreEditors({ ...bundle.editors, photos: [...bundle.editors.photos, away] }, out);
    const back = await B.ph.getRecipe(id);
    const looks = await B.ph.listMyLooks();
    const film = await B.vd.loadProject(proj.id);
    const words = B.reportText(out);
    // nothing of the test left on this phone
    await B.ph.removePhoto(id); await B.ph.removeMyLook('Backup test look'); await B.vd.removeProject(proj.id);
    return { inPhoto: !!inPhoto, exposure: inPhoto?.recipe.light.exposure, inLook, inFilm, backExposure: back?.light.exposure, look: looks.some((l) => l.name === 'Backup test look'), film: film?.name, out, words, size: JSON.stringify(bundle.editors).length };
  }).catch((e) => ({ error: String(e.message).split('\n')[0] }));
  if (got.error) return void problems.push(`[h 2d] the backup could not be tried: ${got.error}`);
  check(got.inPhoto && got.exposure === 0.7 && got.inLook && got.inFilm, `[h 2d] the backup does not carry the photo edit, the look and the video project: ${JSON.stringify(got)}`);
  check(got.backExposure === 0.7 && got.look && got.film === 'Backup test film', `[h 2d] a restore did not put them back: ${JSON.stringify(got)}`);
  check(got.out.photos === 1 && got.out.looks === 1 && got.out.videos === 1 && got.out.photosAway === 1, `[h 2d] the restore counted ${JSON.stringify(got.out)}`);
  check(got.words === 'Put back in the editors: 1 photo edit, 1 look of your own, 1 video project. 1 photo edit waiting for its photo: the photos themselves stay on the phone they were taken on.', `[h 2d] the restore says "${got.words}"`);
  check(got.size < 64 * 1024, `[h 2d] the editors' part is ${got.size} bytes for one small edit (the photos must not be in it)`);
  await ctx.close();
});

// the brain put back, and the next spec shown to open on what this one found (2e and 2f e)
problems.push(...(await brainAfter(base, cleanBrain)));
await browser.close();
if (problems.length) process.exitCode = 1;
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'POLISH 3 run clean at 440 × 956 and 390 × 844: one sentence a screen on Settings, System, the Theme page and the packs\' cards; the Agenda\'s ten fixes and the System screen\'s; "On it." in the phone\'s own voice and never over DOWNLOAD; one watcher system; Share to Ghosty; the Make and Learn leftovers; the photo and video editors' work in the daily backup.');
