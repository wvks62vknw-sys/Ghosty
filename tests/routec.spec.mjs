// Route C (BRIEF-DESIGN-BUILD-1; docs/build-plan/mockups/c) in the real app, on the iPhone 18 Pro Max (440 × 956)
// and a 390-wide phone:
//  - Home's four instruments show the mock brain's own numbers (free AI from /api/status, the library's passages and
//    topics studied, the uplink's round trip); the school gauge hides when there is no /api/school;
//  - the Today card shows the agenda's event and the Roads tile the incident near home; the Gym tile counts the games;
//  - every tab of the glass pill reaches its screen; the Chat screen has the reply card and the composer;
//  - the Me sheet opens on its Status card, with three dials that read real values;
//  - nothing sticks out sideways; the quick chips, the pill's tabs and the round buttons take a 44 pt finger;
//  - the breathing glow behind the reactor stops when the phone asks for reduced motion.
//   BASE=http://localhost:8788 node tests/routec.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const problems = [];
const HOME = { name: 'Birmingham', lat: 52.4862, lon: -1.8904 };
// one incident near home, as National Highways reports it (the brain's /api/highways/events)
const INCIDENT = { events: [{ id: 'rc-1', road: 'M6', direction: 'northbound', title: 'M6 northbound between J6 and J7', reason: 'Congestion', delayS: 720, lanesClosed: '', lat: 52.51, lon: -1.86, normalBy: '2026-10-23T19:40:00+01:00', updated: Date.now() }] };

async function brainGet(path) {
  const r = await fetch(`${base}/api${path}`, { headers: { 'x-ghosty-key': KEY } });
  return r.ok ? r.json() : null;
}

// a diary event an hour from now, so "Today" has something to show
const at = Date.now() + 60 * 60_000;
const made = await fetch(`${base}/api/agenda/events`, { method: 'POST', headers: { 'x-ghosty': '1', 'x-ghosty-key': KEY, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Call Mum', start: at, tz: 'UTC' }) }).then((r) => r.json()).catch(() => null);
if (!made?.event?.id) problems.push(`could not add the diary event: ${JSON.stringify(made)}`);

async function open(viewport, opts = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: true, isMobile: true, ...opts });
  await ctx.addInitScript(([k, home]) => {
    localStorage.setItem('ghosty.ownerKey', k);
    if (!localStorage.getItem('ghosty.settings')) localStorage.setItem('ghosty.settings', JSON.stringify({ home, units: 'metric' }));
  }, [KEY, HOME]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${viewport.width}] pageerror: ${e.message}`));
  await page.route('**/api/highways/events', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(INCIDENT) }));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 25000 });
  const libAtBoot = await brainGet('/library').catch(() => null);
  return { ctx, page, libAtBoot };
}

/** Elements (visible, not inside something that clips them) that run past the screen's sides. */
const sideways = (page, sel) => page.$$eval(sel, (els) => els.filter((e) => {
  if (!e.getClientRects().length || getComputedStyle(e).visibility === 'hidden') return false;
  const r = e.getBoundingClientRect();
  if (!r.width || r.bottom < 0 || r.top > innerHeight) return false;
  for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
    const cs = getComputedStyle(p);
    if (/(hidden|auto|scroll|clip)/.test(cs.overflowX)) {
      const pr = p.getBoundingClientRect();
      if (pr.left >= -1 && pr.right <= innerWidth + 1) return false;
    }
  }
  return r.left < -1 || r.right > innerWidth + 1;
}).filter((e) => !e.classList.contains('rcglow')).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} "${(e.dataset.label || e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 24)}"`));

/** A finger 20 pt left, right, above and below the button's centre still lands on it: a 44 pt target (a button
 *  drawn smaller to the eye may take the finger with an invisible margin). */
const target44 = (page, sel) => page.$$eval(sel, (els) => els.filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map((e) => {
  const r = e.getBoundingClientRect();
  if (r.top < 0 || r.bottom > innerHeight) return '';
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const hits = [[x, y - 20], [x, y + 20], [x - 20, y], [x + 20, y]].map(([px, py]) => { const t = document.elementFromPoint(px, py); return !!t && (t === e || e.contains(t)); });
  return hits.every(Boolean) ? '' : `"${(e.dataset.label || e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 24)}" ${Math.round(r.width)}×${Math.round(r.height)} (${hits.map(Number).join('')})`;
}).filter(Boolean));

for (const vp of [{ width: 440, height: 956 }, { width: 390, height: 844 }]) {
  const W = vp.width;
  const { ctx, page, libAtBoot } = await open(vp);
  if ((await page.evaluate(() => document.documentElement.dataset.look)) !== 'pro') problems.push(`[${W}] not in a calm look (Graphite is the default)`);
  // ---- Home: the four instruments read the mock brain
  await page.waitForFunction(() => /\d/.test(document.querySelector('.rcco.bl .v')?.textContent ?? '') && /ms/.test(document.querySelector('.rcco.br .v')?.textContent ?? ''), null, { timeout: 20000 }).catch(() => undefined);
  await page.waitForTimeout(1500);
  const co = await page.$$eval('.rcco', (els) => Object.fromEntries(els.map((e) => [e.className.split(' ')[1], { k: e.querySelector('.k')?.textContent?.trim(), v: e.querySelector('.v')?.textContent?.trim(), s: e.querySelector('.s')?.textContent?.trim(), hidden: e.hidden }])));
  const st = await brainGet('/status');
  const lib = await brainGet('/library');
  const study = await brainGet('/library/study');
  // STUDY at scale reads pages every few seconds in the preview too, so the gauge (fetched when Home opened) may lag the
  // count read now: accept either the count at boot or the count now.
  const chat = (st?.capacity?.providers ?? []).filter((p) => !p.smallOnly);
  const capped = chat.filter((p) => p.perDay);
  const wantAi = !chat.length ? 'None' : capped.length ? `${Math.round((capped.reduce((t, p) => t + Math.max(0, p.perDay - p.usedToday), 0) / capped.reduce((t, p) => t + p.perDay, 0)) * 100)}%` : chat.some((p) => p.state === 'ready' || p.state === 'busy') ? 'Open' : 'Full';
  if (co.tl?.k !== 'Free AI' || co.tl?.v !== wantAi) problems.push(`[${W}] FREE AI reads "${co.tl?.v}" (${co.tl?.s}); the quota engine says ${wantAi}`);
  // (the library grows while he studies in the background: the reading must be the library's own number, a few
  //  seconds old at most)
  const num = (t) => Number(String(t ?? '').replace(/[^\d]/g, ''));
  const near = (a, b) => b > 0 ? Math.abs(a - b) / b < 0.06 : a === 0;
  if (!lib || !(near(num(co.bl?.v), lib.stats.passages) || (libAtBoot && near(num(co.bl?.v), libAtBoot.stats.passages)))) problems.push(`[${W}] LIBRARY reads "${co.bl?.v}", the library has ${lib?.stats?.passages} passages (${libAtBoot?.stats?.passages} at boot)`);
  if (study && (!/^[\d,]+ studied$/.test(co.bl?.s ?? '') || !near(num(co.bl?.s), study.summary.read))) problems.push(`[${W}] LIBRARY's line reads "${co.bl?.s}", the study summary says ${study.summary.read} read`);
  if (!/^\d+ms$/.test(co.br?.v ?? '') || !/Secure/.test(co.br?.s ?? '')) problems.push(`[${W}] UPLINK reads "${co.br?.v}" "${co.br?.s}"`);
  const school = await brainGet('/school');
  if (!school && !co.tr?.hidden) problems.push(`[${W}] the SCHOOL gauge shows with no /api/school: "${co.tr?.v}"`);
  if (school?.state?.stage && co.tr?.hidden) problems.push(`[${W}] the SCHOOL gauge is hidden although /api/school answers`);
  if (school?.current?.subjects && !co.tr?.hidden) {
    const want = `${school.current.subjects.filter((x) => x.top).length} of ${school.current.subjects.length} passed`;
    if (co.tr?.v !== school.current.label || co.tr?.s !== want) problems.push(`[${W}] SCHOOL reads "${co.tr?.v}" "${co.tr?.s}"; the school says ${school.current.label}, ${want}`);
  }
  await page.waitForFunction(() => document.querySelector('#cstate')?.textContent === 'ONLINE', null, { timeout: 10000 }).catch(() => undefined);
  const pill = (await page.textContent('#cstate'))?.trim();
  if (pill !== 'ONLINE') problems.push(`[${W}] the live-state pill reads "${pill}"`);
  // ---- the Today card and the tiles: the mock agenda and incident, the gym's games
  await page.waitForFunction(() => /Call Mum/.test(document.querySelector('.rctoday')?.textContent ?? ''), null, { timeout: 15000 }).catch(() => undefined);
  const today = (await page.textContent('.rctoday'))?.replace(/\s+/g, ' ').trim();
  if (!/Call Mum/.test(today ?? '') || !/in (\d+ min|1 h)/.test(today ?? '') || !/\d+ left/.test(today ?? '')) problems.push(`[${W}] the Today card reads "${today}"`);
  await page.waitForFunction(() => /M6/.test(document.querySelector('.rcroad')?.textContent ?? ''), null, { timeout: 15000 }).catch(() => undefined);
  const road = (await page.textContent('.rcroad'))?.replace(/\s+/g, ' ').trim();
  if (!/M6 J6–J7/.test(road ?? '') || !/\+12 min/.test(road ?? '') || !/Clears by \d\d:\d\d/i.test(road ?? '')) problems.push(`[${W}] the Roads tile reads "${road}"`);
  const gym = (await page.textContent('.rcgym'))?.replace(/\s+/g, ' ').trim();
  const games = await page.evaluate(() => document.querySelectorAll('.rcgym .rcseg').length);
  if (!/of \d+ games/.test(gym ?? '') || !gym?.includes(`of ${games} games`)) problems.push(`[${W}] the Gym tile reads "${gym}" with ${games} segments`);
  const chips = await page.$$eval('#suggest > button', (bs) => bs.map((b) => b.textContent.trim()));
  if (chips.join('|') !== 'Brief me|What’s on today|God’s eye') problems.push(`[${W}] the quick chips are ${chips.join(', ')}`);
  for (const s of await sideways(page, '#pg-core *')) problems.push(`[${W} home] sticks out sideways: ${s}`);
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) problems.push(`[${W} home] the page scrolls sideways`);
  for (const t of await target44(page, '#suggest > button, #dock .tabcap button, #top .cmd, #top .you, #cbar #mic, #cbar .logbtn')) problems.push(`[${W} home] under a 44 pt target: ${t}`);
  // the breathing glow
  const breath = await page.$eval('.rcglow', (e) => getComputedStyle(e).animationName);
  if (breath !== 'rcbreath') problems.push(`[${W}] the glow behind the reactor does not breathe (${breath})`);
  await page.screenshot({ path: `${out}/routec-${W}-home.png` });

  // ---- every tab of the pill reaches its screen
  const AREA = { ask: 'core', see: 'area-see', make: 'area-make', learn: 'area-learn', plan: 'area-plan' };
  for (const [area, tab] of Object.entries(AREA)) {
    if (area === 'ask') await page.evaluate(() => (location.hash = 'area-see'));
    await page.waitForTimeout(300);
    await page.click(`#dock .tabcap button[data-area="${area}"]`);
    await page.waitForTimeout(700);
    const now = await page.evaluate(() => document.body.dataset.tab);
    if (now !== tab) problems.push(`[${W}] the ${area} tab opened "${now}", not ${tab}`);
    const lit = await page.$eval(`#dock .tabcap button[data-area="${area}"]`, (b) => b.classList.contains('on'));
    if (!lit) problems.push(`[${W}] the ${area} tab is not lit on its screen`);
  }

  // ---- Chat: the pushed screen, the reply card and the composer
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(600);
  await page.click('#cbar .logbtn');
  await page.waitForTimeout(500);
  await page.fill('#cin', 'remember I like flat whites');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => /remember that|already know that/.test(document.querySelector('.convo .log')?.textContent ?? ''), null, { timeout: 15000 }).catch(() => problems.push(`[${W}] no reply in the chat`));
  await page.waitForTimeout(800);
  const chatState = await page.evaluate(() => ({
    title: document.querySelector('#top .navtitle')?.textContent,
    tabbar: getComputedStyle(document.querySelector('#dock')).display,
    card: !!document.querySelector('.convo .msg.latest:not(.me) .rcwho') && getComputedStyle(document.querySelector('.convo .msg.latest:not(.me)')).borderRadius,
    acts: document.querySelectorAll('.convo .msg.latest .rcacts button').length,
    composer: [...document.querySelectorAll('#cbar > *')].filter((e) => e.getClientRects().length && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden').map((e) => e.className || e.id),
    day: document.querySelector('.convo .daysep')?.textContent,
  }));
  if (chatState.title !== 'Chat') problems.push(`[${W} chat] the title reads "${chatState.title}"`);
  if (chatState.tabbar !== 'none') problems.push(`[${W} chat] the tab bar shows over the chat`);
  if (chatState.card !== '20px') problems.push(`[${W} chat] the latest reply is not the reply card (${chatState.card})`);
  if (chatState.acts < 4) problems.push(`[${W} chat] the reply card has ${chatState.acts} actions`);
  if (!/^Today \d\d:\d\d$/.test(chatState.day ?? '')) problems.push(`[${W} chat] the day line reads "${chatState.day}"`);
  for (const want of ['plusbtn', 'cin', 'citedbtn', 'mic']) if (!chatState.composer.some((c) => c.includes(want))) problems.push(`[${W} chat] the composer has no ${want}: ${chatState.composer.join(', ')}`);
  for (const s of await sideways(page, '#pg-core *, #top *')) problems.push(`[${W} chat] sticks out sideways: ${s}`);
  for (const t of await target44(page, '#cbar .plusbtn, #cbar #mic, #cbar .citedbtn, #top .logbtn, #top .you, .convo .msg.latest .rcacts button')) problems.push(`[${W} chat] under a 44 pt target: ${t}`);
  await page.screenshot({ path: `${out}/routec-${W}-chat.png` });
  await page.click('#top .logbtn');
  await page.waitForTimeout(500);

  // ---- God's Eye, the Gym, Settings, System, Links: nothing sideways
  for (const tab of ['eye', 'gym', 'settings', 'system', 'links']) {
    await page.evaluate((t) => (location.hash = t), tab);
    await page.waitForTimeout(tab === 'eye' ? 3500 : 1500);
    for (const s of await sideways(page, `#pg-${tab} :is(button, .pn, .rccard, .eyechips, .btns, .readout, .gymall, .gymcard), #top :is(button, h1)`)) problems.push(`[${W} ${tab}] sticks out sideways: ${s}`);
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) problems.push(`[${W} ${tab}] the page scrolls sideways`);
    if (tab === 'eye') {
      const chipsEye = await page.$$eval('#pg-eye .eyechips button', (bs) => bs.map((b) => b.textContent.trim() || b.getAttribute('aria-label')));
      if (chipsEye.length !== 4 || !/^Aircraft/.test(chipsEye[1]) || !/^Incidents/.test(chipsEye[2]) || !/^Radar/.test(chipsEye[3])) problems.push(`[${W} eye] the layer chips are ${chipsEye.join(', ')}`);
      // a quick chip and the LAYERS tile are one switch
      const radar = () => page.evaluate(() => ({ chip: document.querySelector('#pg-eye .eyechips button[data-layer="radar"]').getAttribute('aria-pressed'), vis: window.__ghosty.globe.vis.radar }));
      const before = await radar();
      await page.click('#pg-eye .eyechips button[data-layer="radar"]');
      await page.waitForTimeout(300);
      const after = await radar();
      if (after.chip !== String(after.vis) || after.vis === before.vis) problems.push(`[${W} eye] the Radar chip and the layer disagree: ${JSON.stringify({ before, after })}`);
      await page.click('#pg-eye .eyechips button[data-layer="radar"]');
      for (const t of await target44(page, '#pg-eye .eyechips button, #pg-eye .bgroup button, #pg-eye .zoomrail button, #top .navback')) problems.push(`[${W} eye] under a 44 pt target: ${t}`);
    }
    if (tab === 'gym') {
      const bars = await page.$$eval('#pg-gym .gymlvls .b', (b) => b.length);
      const cards = await page.$$eval('#pg-gym .gymcard', (b) => b.length);
      if (!bars || bars !== cards) problems.push(`[${W} gym] LEVELS BY GAME has ${bars} bars for ${cards} games`);
      const head = await page.textContent('#pg-gym .gymlvhd');
      if (!/Levels by game · \d+ of \d+ mastered/i.test(head ?? '')) problems.push(`[${W} gym] the levels heading reads "${head}"`);
    }
    await page.screenshot({ path: `${out}/routec-${W}-${tab}.png` });
  }

  // ---- the Me sheet: Status first, three dials with real readings
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(700);
  await page.click('#top .you');
  await page.waitForSelector('#mesheet .mestatus', { timeout: 5000 }).catch(() => problems.push(`[${W}] no Status card in the Me sheet`));
  await page.waitForFunction(() => /\d|Open|None|Full/.test(document.querySelector('#mesheet [data-dial="ai"] .rcgauge b')?.textContent ?? ''), null, { timeout: 15000 }).catch(() => undefined);
  await page.waitForTimeout(600);
  const me = await page.evaluate(() => ({
    parts: [...document.querySelectorAll('#mesheet [data-part]')].map((x) => x.dataset.part),
    dials: [...document.querySelectorAll('#mesheet .megauge')].map((d) => `${d.querySelector('.rcgauge b')?.textContent}|${d.querySelector(':scope > b')?.textContent}|${d.querySelector(':scope > small')?.textContent}`),
    ok: document.querySelector('#mesheet .meok')?.textContent,
    rows: [...document.querySelectorAll('#mesheet .merow')].map((r) => r.dataset.id),
  }));
  if (me.parts[0] !== 'head' || me.parts[1] !== 'status') problems.push(`[${W} me] the sheet's order is ${me.parts.join(', ')} (Status should come first)`);
  if (me.dials.length !== 3 || !/^Free AI today/.test(me.dials[0]?.split('|')[1] ?? '') || me.dials[0]?.startsWith('—')) problems.push(`[${W} me] the dials read ${me.dials.join(' / ')}`);
  const st2 = await brainGet('/status');
  const db = st2?.meter ? Math.round(st2.meter.level * 100) : null;
  if (db != null && !(Math.abs(num(me.dials[1]?.split('|')[0]) - db) <= 4 && /%/.test(me.dials[1] ?? ''))) problems.push(`[${W} me] Database today reads "${me.dials[1]}", the meter says ${db}%`);
  if (!/All good|Needs a look|Brain offline/.test(me.ok ?? '')) problems.push(`[${W} me] the Status line reads "${me.ok}"`);
  if (me.rows.join(',') !== 'memory,settings,system,links,deck') problems.push(`[${W} me] the rows are ${me.rows.join(', ')}`);
  for (const s of await sideways(page, '#mesheet *')) problems.push(`[${W} me] sticks out sideways: ${s}`);
  for (const t of await target44(page, '#mesheet .merow, #mesheet .meclose')) problems.push(`[${W} me] under a 44 pt target: ${t}`);
  await page.screenshot({ path: `${out}/routec-${W}-me.png` });
  await ctx.close();
}

// ---- reduced motion: the glow stands still
{
  const { ctx, page } = await open({ width: 440, height: 956 }, { reducedMotion: 'reduce' });
  await page.waitForTimeout(1200);
  const anim = await page.$eval('.rcglow', (e) => getComputedStyle(e).animationName).catch(() => 'missing');
  if (anim !== 'none') problems.push(`reduced motion: the glow still breathes (${anim})`);
  await ctx.close();
}

// ---- a phone on a classic look moves to Graphite once, with the way back in Settings → Look
{
  const ctx = await browser.newContext({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((k) => {
    localStorage.setItem('ghosty.ownerKey', k);
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('ghosty.settings', JSON.stringify({ theme: 'stark' }));
      localStorage.removeItem('ghosty.lookC');
    }
  }, KEY);
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 25000 });
  const first = await page.evaluate(() => ({ look: document.documentElement.dataset.look, theme: window.__ghosty.settings.get().theme }));
  if (first.theme !== 'graphite' || first.look !== 'pro') problems.push(`a classic phone was not moved to Graphite: ${JSON.stringify(first)}`);
  await page.waitForFunction(() => /new look: Graphite/.test(document.querySelector('#toasts')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => problems.push('no toast says the look changed'));
  await page.evaluate(() => (location.hash = 'settings'));
  await page.waitForTimeout(1200);
  await page.locator('#pg-settings .pn[data-row] > h3').filter({ hasText: /^Look|LOOK/ }).first().click().catch(() => undefined);
  await page.waitForTimeout(600);
  const back = page.locator('#pg-settings .lookback button');
  if (!(await back.count())) problems.push('Settings → Look offers no way back');
  else {
    await back.click();
    await page.waitForTimeout(500);
    const now = await page.evaluate(() => window.__ghosty.settings.get().theme);
    if (now !== 'stark') problems.push(`the way back went to ${now}`);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#boot', { state: 'detached', timeout: 25000 });
    const again = await page.evaluate(() => window.__ghosty.settings.get().theme);
    if (again !== 'stark') problems.push(`after going back, the next start switched again (${again})`);
  }
  await ctx.close();
}

if (made?.event?.id) await fetch(`${base}/api/agenda/events/${made.event.id}`, { method: 'DELETE', headers: { 'x-ghosty': '1', 'x-ghosty-key': KEY } }).catch(() => undefined);
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'Route C run clean: Home reads the brain (free AI, library, uplink; no school gauge without a school), Today and the tiles show the agenda, the incident and the games, every tab reaches its screen, Chat has the reply card and the composer, the Me sheet opens on Status with three real dials, nothing sticks out sideways at 440 or 390, the targets take a finger, the glow stops for reduced motion, and a classic phone moves to Graphite once with the way back.');
process.exit(problems.length ? 1 : 0);
