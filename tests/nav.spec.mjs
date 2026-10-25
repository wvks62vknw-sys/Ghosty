// The navigation build (BRIEF-NAV-BOOT 1, mockups/nav/contact.png; the owner: "too much things in one tab so you have to
// scroll loads but there should be different like tabs for all of it but not overstimulating, and easy to navigate too")
// on his iPhone 18 Pro Max (440 × 956), in Chromium with a touch screen:
//  - the quick switcher: a long press (350 ms) on a tab-bar button fans that area's tools out above the bar as an arc of
//    small instruments with their names, the lit one first (the GYM while it trains); a finger held down (CDP touch) and
//    slid onto one opens it when lifted; lifted on the tab it stays for a tap (Playwright's touchscreen); lifted
//    anywhere else it closes; a plain tap and a short press still do what a tap always did; a held mouse does the same;
//    aria-hidden while closed; under Reduce Motion it is there at once with nothing moving;
//  - the sections (ui/sections.ts) on SYSTEM and AGENDA: a row of pills under the title, held in reach as the page
//    scrolls, 44 pt, six at most, the first selected on a new phone; a tap shows that section alone (the other panels
//    `hidden`, still in the page) and the page is shorter; the pill picked is remembered per screen after a reload; a
//    deep link from Every screen to a panel selects its pill; on a wide screen every panel shows and the pills step aside;
//  - the hubs' own words under their titles, read against the brain and the phone: his school stage (from /api/school),
//    his next event (made here in the brain) and his city's weather, his city, his latest project; with no reading the
//    plain line, never a sample; Ghosty says "I", never "he" or "him", on every hub;
//  - Graphite draws the same shapes (the pills, the dots, the arc) in its own colour, from the theme's tokens;
//  - nothing sticks out sideways at 440 or 390, every new target takes a finger (44 pt), the hubs still fit one screen.
// Fails on the old interface: no switcher, no pills, the hubs' generic lines ("… a library for him.").
//   BASE=http://localhost:8788 node tests/nav.spec.mjs [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { PHONE, UK, openDeck } from './nav.mjs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const HOME = { name: 'Birmingham', lat: 52.4862, lon: -1.8904 };
const problems = [];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

const api = (path, init = {}) => fetch(`${base}/api${path}`, { ...init, headers: { 'x-ghosty': '1', 'x-ghosty-key': KEY, 'content-type': 'application/json', ...(init.headers ?? {}) } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

/** A phone with his settings (his home unless `home: null`), paired, booted. */
async function phone({ viewport = PHONE, theme = '', home = HOME, reduced = false, routes = null } = {}) {
  const ctx = await browser.newContext({ viewport, ...UK, deviceScaleFactor: 2, hasTouch: true, isMobile: true, serviceWorkers: 'block', ...(reduced ? { reducedMotion: 'reduce' } : {}) });
  await ctx.addInitScript(([k, home, theme]) => {
    localStorage.setItem('ghosty.ownerKey', k);
    if (!localStorage.getItem('ghosty.settings')) localStorage.setItem('ghosty.settings', JSON.stringify({ ...(home ? { home } : {}), units: 'metric', ...(theme ? { theme } : {}) }));
    if (theme) localStorage.setItem('ghosty.themes1', '1');
  }, [KEY, home, theme]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  if (routes) await routes(page);
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
  return { ctx, page };
}
const until = (page, fn, arg, ms, why) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => (problems.push(why), false));
const show = async (page, tab, wait = 1200) => {
  await page.evaluate((t) => (location.hash = t), tab);
  await page.waitForTimeout(wait);
  await page.evaluate(() => document.querySelectorAll('#toasts .toast').forEach((t) => t.remove()));
};
const settle = (page) => page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined)))).catch(() => undefined);
/** Things that stick out past the screen's sides (a box that scrolls sideways on purpose holds its own). */
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
}).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} "${(e.textContent || '').trim().slice(0, 24)}"`));
/** A finger 20 pt left, right, above and below the target's centre still lands on it. */
const target44 = (page, sel) => page.$$eval(sel, (els) => els.filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map((e) => {
  const r = e.getBoundingClientRect();
  if (r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) return '';
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const hits = [[x, y - 20], [x, y + 20], [x - 20, y], [x + 20, y]].map(([px, py]) => { const t = document.elementFromPoint(px, py); return !!t && (t === e || e.contains(t)); });
  return hits.every(Boolean) ? '' : `"${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 24)}" ${Math.round(r.width)}×${Math.round(r.height)} (${hits.map(Number).join('')})`;
}).filter(Boolean));
const pageWide = (page) => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1 || document.body.scrollWidth > innerWidth + 1);

// ---- a finger on the touch screen (Chromium's DevTools touch: down, move every 16 ms, up)
const fingerOf = async (ctx, page) => {
  const cdp = await ctx.newCDPSession(page);
  const send = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: Math.round(x), y: Math.round(y) }] });
  return {
    down: (x, y) => send('touchStart', x, y),
    async move(from, to, steps = 10) {
      for (let i = 1; i <= steps; i++) {
        await send('touchMove', from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
        await page.waitForTimeout(16);
      }
    },
    up: () => send('touchEnd'),
    detach: () => cdp.detach(),
  };
};
const tabAt = async (page, area) => {
  const b = await page.locator(`#dock .tabcap button[data-area="${area}"]`).boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
const sw = (page) => page.evaluate(() => {
  const s = document.getElementById('switcher');
  const bar = document.querySelector('#dock .tabcap')?.getBoundingClientRect();
  return {
    open: !!s && !s.hidden, aria: s?.getAttribute('aria-hidden') ?? null, tab: document.body.dataset.tab,
    items: [...(s?.querySelectorAll('.switem') ?? [])].map((b) => {
      const r = b.querySelector('.swring').getBoundingClientRect();
      const box = b.getBoundingClientRect();
      return { id: b.dataset.id, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), at: { x: parseFloat(b.style.left), y: parseFloat(b.style.top) }, drawn: !!b.querySelector('.swring > :is(svg, .insc, .segs)'), name: b.querySelector('.swnm')?.textContent ?? '', read: b.querySelector('.swrd')?.textContent ?? '', on: b.classList.contains('on'), box: { l: box.left, r: box.right, t: box.top, b: box.bottom, h: box.height }, tr: getComputedStyle(b).transform };
    }),
    cap: s?.querySelector('.swcap')?.textContent ?? '', bar: bar?.top ?? 0,
  };
});

// ===================================================================== the quick switcher, by touch
let { ctx, page } = await phone();
await show(page, 'gym', 2500);
let f = await fingerOf(ctx, page);
// a plain tap (Playwright's touchscreen) still does what it does today: Learn's tab, from inside Learn, back to its hub
let at = await tabAt(page, 'learn');
await page.touchscreen.tap(at.x, at.y);
await page.waitForTimeout(700);
let s = await sw(page);
if (s.tab !== 'area-learn' || s.open) problems.push(`a tap on Learn from the GYM: tab ${s.tab}, switcher ${s.open ? 'open' : 'closed'} (want the Learn hub, no switcher)`);
// a short press (down and straight up, by the held-finger route) is a tap too
await show(page, 'gym', 900);
await f.down(at.x, at.y);
await f.up();
await page.waitForTimeout(700);
s = await sw(page);
if (s.tab !== 'area-learn' || s.open) problems.push(`a short press on Learn: tab ${s.tab}, switcher ${s.open ? 'open' : 'closed'}`);
if (s.aria !== 'true') problems.push(`the closed switcher is not aria-hidden (${s.aria})`);
// the long press: the arc fans out above the bar, Learn's four tools with their instruments, names and readings
await show(page, 'gym', 900);
await f.down(at.x, at.y);
await page.waitForTimeout(600);
await until(page, () => !document.getElementById('switcher')?.hidden, null, 3000, 'a long press on Learn did not open the switcher');
const held = await page.evaluate(() => document.querySelector('#dock .tabcap button[data-area="learn"]')?.classList.contains('held'));
if (!held) problems.push('the held tab does not keep its touch flare while the arc is open');
await settle(page);
s = await sw(page);
if (s.aria !== null) problems.push(`the open switcher is still aria-hidden (${s.aria})`);
if (s.items.map((i) => i.id).join(',') !== 'learn,gym,school,library') problems.push(`the Learn arc holds ${s.items.map((i) => i.id).join(', ')} (want Courses, Gym, School, Library)`);
for (const i of s.items) {
  if (!i.drawn) problems.push(`[switcher ${i.id}] no instrument in its face`);
  if (!i.name || !i.read) problems.push(`[switcher ${i.id}] no name or reading ("${i.name}", "${i.read}")`);
  if (i.box.b > s.bar + 1) problems.push(`[switcher ${i.id}] runs under the tab bar (${Math.round(i.box.b)} > ${Math.round(s.bar)})`);
  if (i.box.l < 0 || i.box.r > PHONE.width) problems.push(`[switcher ${i.id}] off the screen's side (${Math.round(i.box.l)}–${Math.round(i.box.r)})`);
  if (Math.hypot(i.x - i.at.x, i.y - i.at.y) > 2) problems.push(`[switcher ${i.id}] did not land where it belongs (${i.x},${i.y} for ${i.at.x},${i.at.y})`);
}
// an arc: the outer ones lower than the inner ones
if (s.items.length === 4 && !(s.items[0].y > s.items[1].y && s.items[3].y > s.items[2].y)) problems.push(`the tools are not on an arc: ${s.items.map((i) => `${i.id} ${i.x},${i.y}`).join(' · ')}`);
for (const t of await target44(page, '#switcher .switem')) problems.push(`[switcher] under a 44 pt target: ${t}`);
for (const x of await sideways(page, '#switcher :is(.switem, .swcap)')) problems.push(`[switcher 440] sticks out sideways: ${x}`);
// the finger slides onto the Library: it lights and is named; lifted there, the Library opens
const lib = s.items.find((i) => i.id === 'library');
if (lib) {
  await f.move(at, lib);
  await page.waitForTimeout(250);
  s = await sw(page);
  if (!s.items.find((i) => i.id === 'library')?.on || !/^Library/.test(s.cap) || !/Let go to open/.test(s.cap)) problems.push(`the finger on the Library does not light it and name it: ${s.cap}`);
  await page.screenshot({ path: `${out}/nav-switcher-learn.png` });
  await f.up();
  await until(page, () => document.body.dataset.tab === 'library' && document.getElementById('switcher')?.hidden, null, 4000, `lifting the finger on the Library did not open it (${(await sw(page)).tab})`);
  if ((await sw(page)).aria !== 'true') problems.push('the switcher is not aria-hidden again once closed');
}
// lifted on the tab it began on: it stays open for a tap; a tap (the touchscreen) opens that tool
await show(page, 'gym', 900);
await f.down(at.x, at.y);
await page.waitForTimeout(600);
await f.up();
await page.waitForTimeout(400);
s = await sw(page);
if (!s.open) problems.push('lifted on the held tab, the switcher closed (it should stay for a tap)');
else {
  const school = s.items.find((i) => i.id === 'school');
  await page.touchscreen.tap(school.x, school.y);
  await until(page, () => document.body.dataset.tab === 'school' && document.getElementById('switcher')?.hidden, null, 4000, 'a tap on School in the open switcher did not open it');
}
// lifted anywhere else: it closes and nothing opens
await show(page, 'gym', 900);
await f.down(at.x, at.y);
await page.waitForTimeout(600);
await f.move(at, { x: 220, y: 200 });
await f.up();
await page.waitForTimeout(500);
s = await sw(page);
if (s.open || s.tab !== 'gym') problems.push(`slid off and lifted: switcher ${s.open ? 'open' : 'closed'}, tab ${s.tab} (want closed, still the GYM)`);
// a held mouse (a pointer that is not a finger) does the same: Plan's tools, slid onto Markets
await show(page, 'gym', 600);
const plan = await tabAt(page, 'plan');
await page.mouse.move(plan.x, plan.y);
await page.mouse.down();
await page.waitForTimeout(600);
await settle(page);
s = await sw(page);
const mk = s.items.find((i) => i.id === 'markets');
if (s.items.map((i) => i.id).sort().join(',') !== 'agenda,markets,radio,threats') problems.push(`the Plan arc holds ${s.items.map((i) => i.id).join(', ')}`);
if (mk) {
  await page.mouse.move(mk.x, mk.y, { steps: 8 });
  await page.mouse.up();
  await until(page, () => document.body.dataset.tab === 'markets', null, 4000, 'a held mouse slid onto Markets did not open it');
} else await page.mouse.up();
// the lit one first: while the GYM trains, Learn's arc starts with the GYM (Connect 4: slow to master, so still training)
await show(page, 'gym', 900);
await page.locator('#pg-gym .gymcard[data-game="connect4"]').click();
await page.locator('#pg-gym button.gymtrain').first().click({ timeout: 8000 }).catch(() => problems.push('no TRAIN on Connect 4 (for the lit-first check)'));
if (await until(page, () => window.__ghosty?.gym?.training === 'connect4', null, 6000, 'TRAIN did not start (for the lit-first check)')) {
  if (await page.locator('#pg-gym.gympush').count()) await page.click('#top .navback');
  await page.waitForTimeout(400);
  const still = await page.evaluate(() => window.__ghosty?.gym?.training === 'connect4');
  await f.down(at.x, at.y);
  await page.waitForTimeout(600);
  s = await sw(page);
  if (still && s.items[0]?.id !== 'gym') problems.push(`while the GYM trains, the Learn arc starts with ${s.items[0]?.id} (want the lit one, the GYM, first)`);
  await f.move(at, { x: 220, y: 150 });
  await f.up();
  await page.waitForTimeout(300);
  // PAUSE (unless it has stopped by itself)
  if (await page.evaluate(() => !!window.__ghosty?.gym?.training)) {
    await page.locator('#pg-gym .gymcard[data-game="connect4"]').click();
    await page.locator('#pg-gym button.gymtrain').first().dispatchEvent('click');
  }
  await until(page, () => !window.__ghosty?.gym?.training, null, 6000, 'PAUSE did not stop the training');
  if (await page.locator('#pg-gym.gympush').count()) await page.click('#top .navback');
}
await f.detach();

// ===================================================================== sections: SYSTEM
const pills = (page, tab) => page.evaluate((t) => {
  const row = document.querySelector(`#pg-${t} .secpills`);
  const hud = document.querySelector(`#pg-${t} .hud`);
  const r = row?.getBoundingClientRect();
  return {
    shown: !!row && !row.hidden && !!row.getClientRects().length,
    labels: [...(row?.querySelectorAll('.secpill') ?? [])].map((b) => b.textContent),
    on: row?.querySelector('.secpill.on')?.textContent ?? '', selected: [...(row?.querySelectorAll('.secpill[aria-selected="true"]') ?? [])].length,
    top: r ? Math.round(r.top) : null, hudTop: hud ? Math.round(hud.getBoundingClientRect().top) : null, h: r ? Math.round(r.height) : 0,
    pillH: Math.min(...[...(row?.querySelectorAll('.secpill') ?? [])].map((b) => b.getBoundingClientRect().height)),
    scrollH: hud?.scrollHeight ?? 0, scrollTop: hud?.scrollTop ?? 0,
    panels: [...document.querySelectorAll(`#pg-${t} .pn`)].map((p) => ({ t: p.querySelector('.ptitle')?.textContent ?? '', hidden: p.hidden, shown: !!p.getClientRects().length && p.getBoundingClientRect().height > 0 })),
  };
}, tab);
const visible = (p, re) => p.panels.filter((x) => re.test(x.t)).every((x) => x.shown && !x.hidden);
const hiddenIn = (p, re) => p.panels.filter((x) => re.test(x.t)).every((x) => x.hidden && !x.shown);
await show(page, 'system', 2500);
let P = await pills(page, 'system');
if (!P.shown || P.labels.join(',') !== 'Status,Report card,Training,Backup') problems.push(`[system] the pills read "${P.labels.join(', ')}" (want Status, Report card, Training, Backup)`);
if (P.labels.length > 6) problems.push(`[system] ${P.labels.length} pills (six at most)`);
if (P.on !== 'Status' || P.selected !== 1) problems.push(`[system] a new phone opens on "${P.on}" (want Status, the one he uses most)`);
if (P.pillH < 44) problems.push(`[system] a pill is ${P.pillH} pt high (want 44)`);
if (!visible(P, /^(STATUS|KEYS|AI MODELS|AI ROOM)/)) problems.push(`[system] Status does not show STATUS and the brain's keys: ${JSON.stringify(P.panels)}`);
if (!hiddenIn(P, /^(LOOPS|NIGHT SCHOOL|STORAGE|BACKUP|OFFLINE BRAIN)/)) problems.push('[system] the other sections\' panels are not hidden under Status');
if (!(await page.locator('#pg-system .pn.nightsch').count())) problems.push('[system] NIGHT SCHOOL was taken out of the page (a hidden panel must stay, hidden)');
for (const t of await target44(page, '#pg-system .secpill')) problems.push(`[system] a pill under a 44 pt target: ${t}`);
const statusH = P.scrollH;
// sticky: scrolled down, the pills stay in reach under the navigation bar
await page.evaluate(() => (document.querySelector('#pg-system .hud').scrollTop = 700));
await page.waitForTimeout(300);
P = await pills(page, 'system');
if (P.scrollTop < 300 || P.top == null || P.top < P.hudTop - 1 || P.top > P.hudTop + 30) problems.push(`[system] scrolled ${P.scrollTop} px the pills are at ${P.top} (the page's top is ${P.hudTop}): not held in reach`);
await page.screenshot({ path: `${out}/nav-system-scrolled.png` });
// a tap shows that section alone, and the page is shorter
await page.locator('#pg-system .secpill', { hasText: 'Training' }).click({ timeout: 5000 }).catch(() => problems.push('[system] no Training pill to tap'));
await page.waitForTimeout(400);
P = await pills(page, 'system');
if (P.on !== 'Training' || !visible(P, /^(OFFLINE BRAIN TRAINING|NIGHT SCHOOL)/) || !hiddenIn(P, /^(STATUS|KEYS|LOOPS|STORAGE|BACKUP)/)) problems.push(`[system] Training does not show its section alone: ${JSON.stringify(P.panels.map((x) => `${x.t}${x.hidden ? ' (hidden)' : ''}`))}`);
if (!(P.scrollH < statusH)) problems.push(`[system] the page is no shorter under Training (${P.scrollH} px, Status ${statusH})`);
if (P.scrollTop > 0 && P.top > P.hudTop + 30) problems.push('[system] after a pill, the page does not start at the pills');
await page.screenshot({ path: `${out}/nav-system-training.png` });
// a row of the section still opens as its own screen
await page.locator('#pg-system .pn[data-row] > h3', { hasText: /night school/i }).first().click({ timeout: 5000 }).catch(() => problems.push('[system] the NIGHT SCHOOL row cannot be tapped under Training'));
await until(page, () => document.querySelector('#pg-system .pn.nightsch')?.classList.contains('pushed'), null, 4000, '[system] the NIGHT SCHOOL row did not open under Training');
await page.click('#top .navback');
await page.waitForTimeout(400);
// remembered per screen, through a reload
const kept = await page.evaluate(() => localStorage.getItem('ghosty.sections.system'));
if (kept !== 'training') problems.push(`[system] the pill picked is not remembered (${kept})`);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
await show(page, 'system', 2000);
P = await pills(page, 'system');
if (P.on !== 'Training' || !visible(P, /^NIGHT SCHOOL/)) problems.push(`[system] after a reload System opens on "${P.on}" (want Training, the one picked)`);
// ===================================================================== sections: AGENDA
await show(page, 'agenda', 2000);
P = await pills(page, 'agenda');
if (!P.shown || P.labels.join(',') !== 'Diary,Reminders,Spending,Calendars') problems.push(`[agenda] the pills read "${P.labels.join(', ')}"`);
if (P.on !== 'Diary') problems.push(`[agenda] opens on "${P.on}" (want Diary: each screen remembers its own pill)`);
if (!visible(P, /^DIARY/) || !hiddenIn(P, /^(REMINDERS|NOTIFICATIONS|SPENDING|CALENDARS)/)) problems.push(`[agenda] Diary does not show the diary alone: ${JSON.stringify(P.panels)}`);
if (await page.locator('#pg-agenda .swap').isVisible().catch(() => false)) problems.push('[agenda] the old two-sides switch is still shown beside the pills');
await page.screenshot({ path: `${out}/nav-agenda.png` });
await page.locator('#pg-agenda .secpill', { hasText: 'Reminders' }).click({ timeout: 5000 }).catch(() => problems.push('[agenda] no Reminders pill to tap'));
await page.waitForTimeout(300);
P = await pills(page, 'agenda');
if (!visible(P, /^(REMINDERS|NOTIFICATIONS)/) || !hiddenIn(P, /^(DIARY|SPENDING|CALENDARS)/)) problems.push('[agenda] Reminders does not show the reminders and notifications alone');
if (!(await page.locator('#pg-agenda input[aria-label="Reminder text"]').isVisible())) problems.push('[agenda] the reminder box is not shown under Reminders');
for (const x of await sideways(page, '#pg-agenda :is(.secpills, .secpill, .pn, button, input)')) problems.push(`[agenda 440] sticks out sideways: ${x}`);
if (await pageWide(page)) problems.push('[agenda 440] the page scrolls sideways');
// a deep link from Every screen selects the pill that holds its panel: "Connect your calendars"
await openDeck(page);
await page.click('#deck .dkcard[data-id="agenda"]');
await page.locator('#deck .dkx[data-id="agenda"] .dkrow', { hasText: 'Connect your calendars' }).click();
await until(page, () => document.body.dataset.tab === 'agenda' && document.querySelector('#pg-agenda .secpill.on')?.textContent === 'Calendars', null, 5000, `[agenda] the deck's "Connect your calendars" did not select Calendars (${await page.evaluate(() => document.querySelector('#pg-agenda .secpill.on')?.textContent)})`);
await page.waitForTimeout(800);
const cal = await page.evaluate(() => { const p = document.querySelector('#pg-agenda .pn.feeds'); const r = p?.getBoundingClientRect(); return p && { hidden: p.hidden, top: Math.round(r.top), bottom: Math.round(r.bottom) }; });
if (!cal || cal.hidden || cal.top < 0 || cal.top > PHONE.height - 100) problems.push(`[agenda] the calendars panel is not shown after the deep link: ${JSON.stringify(cal)}`);
// and System's: "Back up this phone every day" → Backup, its panel opened
await openDeck(page);
await page.click('#deck .dkcard[data-id="system"]');
await page.locator('#deck .dkx[data-id="system"] .dkrow', { hasText: 'Back up this phone every day' }).click();
await until(page, () => document.body.dataset.tab === 'system' && document.querySelector('#pg-system .secpill.on')?.textContent === 'Backup' && /^BACKUP/.test(document.querySelector('#pg-system .pn.pushed .ptitle')?.textContent ?? ''), null, 6000, `[system] the deck's backup line did not select Backup and open BACKUP (${await page.evaluate(() => `${document.querySelector('#pg-system .secpill.on')?.textContent} / ${document.querySelector('#pg-system .pn.pushed .ptitle')?.textContent}`)})`);
await page.click('#top .navback').catch(() => undefined);
await ctx.close();

// ===================================================================== the hubs' own words
// The brain's state: his school (from /api/school), an event made here (removed at the end), the weather of his city
// (fixed here so the check does not depend on the forecast), a project running (the Workshop's list, faked here).
const school = await api('/school');
const soon = Date.now() + 2 * 3600_000 + 5 * 60_000;
const made = await api('/agenda/events', { method: 'POST', body: JSON.stringify({ title: 'Nav check dentist', start: soon, tz: 'Europe/London' }) });
const WEATHER = { latitude: 52.48, longitude: -1.89, current: { time: '2026-10-25T12:00', temperature_2m: 14.2, apparent_temperature: 12, relative_humidity_2m: 80, weather_code: 61, wind_speed_10m: 12, wind_direction_10m: 200, pressure_msl: 1012 }, hourly: { time: [], temperature_2m: [], precipitation_probability: [] }, daily: { time: ['2026-10-25'], temperature_2m_max: [15], temperature_2m_min: [8], precipitation_probability_max: [60], sunrise: ['2026-10-25T07:00'], sunset: ['2026-10-25T16:50'], uv_index_max: [1] } };
const weatherRoute = (body, status = 200) => async (p) => p.route((u) => /\/api\/proxy\?/.test(u.href) && /open-meteo\.com%2Fv1%2Fforecast/.test(u.href), (r) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }));
({ ctx, page } = await phone({
  routes: async (p) => {
    await weatherRoute(WEATHER)(p);
    await p.route('**/api/projects', (r) => (r.request().method() === 'GET' ? r.fulfill({ json: { projects: [{ id: 'p1', title: 'the garden website', goal: 'a site', steps: [], status: 'active', pace: 'steady', created: Date.now() - 3600_000, updated: Date.now() - 60_000, fails: 0, docId: '' }] } }) : r.continue()));
  },
}));
const subOf = async (page, a) => {
  await show(page, `area-${a}`, 600);
  await page.waitForFunction((a) => document.querySelector(`#pg-area-${a} .hubsub`)?.dataset.personal === 'true', a, { timeout: 8000 }).catch(() => undefined);
  return page.$eval(`#pg-area-${a} .hubsub`, (e) => ({ text: e.textContent, personal: e.dataset.personal, lines: Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)) }));
};
const STAGE = { nursery: 'I’m in Nursery at school', reception: 'I’m in Reception at school', ks1: 'I’m in Key Stage 1 at school', ks2: 'I’m in Key Stage 2 at school', ks3: 'I’m in Key Stage 3 at school', gcse: 'I’m doing my GCSEs', alevel: 'I’m doing my A-levels', university: 'I’m at university', library: 'I’m reading the whole library' };
const words = {};
for (const a of ['ask', 'see', 'make', 'learn', 'plan', 'me']) words[a] = await subOf(page, a);
// (the next event comes with Home's first read of the agenda: wait for it if it is late)
if (made?.event?.id && !/Nav check dentist/.test(words.plan.text)) {
  await page.waitForFunction(() => /Nav check dentist/.test(document.querySelector('#pg-area-plan .hubsub')?.textContent ?? ''), null, { timeout: 10000 }).catch(() => undefined);
  words.plan = await subOf(page, 'plan');
}
if (school?.state?.stage) {
  const want = STAGE[school.state.stage] ?? school.current?.label ?? '';
  if (!words.learn.text.startsWith(want) || words.learn.personal !== 'true') problems.push(`[learn] the line under the title reads "${words.learn.text}" (the school says ${school.state.stage}: want "${want}…")`);
} else if (words.learn.personal === 'true') problems.push(`[learn] a school stage is named with no school: "${words.learn.text}"`);
if (/rated/.test(words.learn.text)) problems.push(`[learn] a GYM rating is named, but no game has a league yet: "${words.learn.text}"`);
if (made?.event?.id && !/^Next: Nav check dentist (in 2 h|tomorrow at \d\d:\d\d)\. 14°C, rain in Birmingham\.$/.test(words.plan.text)) problems.push(`[plan] the line reads "${words.plan.text}" (want his next event, "Nav check dentist in 2 h", and "14°C, rain in Birmingham")`);
if (words.see.text !== 'The world live from Birmingham, and a camera that understands it.') problems.push(`[see] the line reads "${words.see.text}" (want his city)`);
if (words.make.text !== 'I’m building the garden website for you now.') problems.push(`[make] the line reads "${words.make.text}" (want the project running)`);
for (const [a, w] of Object.entries(words)) {
  if (/\b(he|him|his|himself)\b/i.test(w.text)) problems.push(`[${a}] Ghosty speaks of himself as "he": "${w.text}"`);
  if (w.lines > 2) problems.push(`[${a}] the line runs to ${w.lines} lines`);
}
await page.screenshot({ path: `${out}/nav-hub-plan.png` });
await ctx.close();
// no reading: the plain line, never a sample (no home set, the weather unreachable, no school, nothing made)
({ ctx, page } = await phone({
  home: null,
  routes: async (p) => {
    await weatherRoute({ error: true }, 502)(p);
    await p.route('**/api/school', (r) => r.fulfill({ status: 404, json: { error: 'no school' } }));
    await p.route('**/api/projects', (r) => (r.request().method() === 'GET' ? r.fulfill({ json: { projects: [] } }) : r.continue()));
    await p.route('**/api/reverse**', (r) => (r.request().method() === 'GET' ? r.fulfill({ json: { jobs: [] } }) : r.continue()));
    await p.route('**/api/agenda?**', (r) => r.fulfill({ status: 503, json: { error: 'down' } }));
  },
}));
const PLAIN = { see: 'The world live, and the camera that understands it.', make: 'Build, take apart and plan real things.', learn: 'Courses for you; games, school and a library for me.', plan: 'Your days, the markets, the world’s alerts and the radio.' };
for (const [a, want] of Object.entries(PLAIN)) {
  await show(page, `area-${a}`, 2500);
  const w = await page.$eval(`#pg-area-${a} .hubsub`, (e) => ({ text: e.textContent, personal: e.dataset.personal }));
  if (w.text !== want || w.personal !== 'false') problems.push(`[${a}, no reading] the line reads "${w.text}" (want the plain "${want}")`);
}
await ctx.close();
if (made?.event?.id) await api(`/agenda/events/${made.event.id}`, { method: 'DELETE' });
else problems.push('the spec could not make its event in the brain');

// ===================================================================== reduced motion: the arc is there at once
({ ctx, page } = await phone({ reduced: true }));
await show(page, 'gym', 1500);
f = await fingerOf(ctx, page);
at = await tabAt(page, 'learn');
await f.down(at.x, at.y);
await until(page, () => document.getElementById('switcher')?.classList.contains('in'), null, 3000, '[reduced motion] the switcher did not open');
await page.waitForTimeout(60);
const still = await page.evaluate(() => {
  const s = document.getElementById('switcher');
  if (!s) return { moving: -1, tr: [], op: [] };
  const moving = s.getAnimations({ subtree: true }).filter((a) => a.playState === 'running' && Number(a.effect?.getTiming().duration ?? 0) > 1);
  return { moving: moving.length, tr: [...s.querySelectorAll('.switem')].map((b) => getComputedStyle(b).transform), op: [...s.querySelectorAll('.switem')].map((b) => getComputedStyle(b).opacity) };
});
if (still.moving || !still.tr.length || still.tr.some((t) => t !== 'none') || still.op.some((o) => o !== '1')) problems.push(`[reduced motion] the arc moves into place: ${JSON.stringify(still)}`);
await f.move(at, { x: 220, y: 150 });
await f.up();
await f.detach();
await ctx.close();

// ===================================================================== Graphite: the same shapes in its own colour
const shapes = async (theme) => {
  const { ctx, page } = await phone({ theme });
  await show(page, 'system', 2000);
  await settle(page);
  const r = await page.evaluate(() => {
    const row = document.querySelector('#pg-system .secpills');
    if (!row) return { theme: document.documentElement.dataset.theme, pills: [], on: '', c2: '' };
    const on = row.querySelector('.secpill.on');
    const probe = document.createElement('i');
    probe.style.color = 'var(--c2)';
    document.body.append(probe);
    const c2 = getComputedStyle(probe).color;
    probe.remove();
    return { theme: document.documentElement.dataset.theme, pills: [...row.querySelectorAll('.secpill')].map((b) => { const x = b.getBoundingClientRect(); return [Math.round(x.left), Math.round(x.top), Math.round(x.width), Math.round(x.height)]; }), on: getComputedStyle(on).color, c2 };
  });
  await show(page, 'gym', 1500);
  await settle(page);
  r.dots = await page.$$eval('#pg-gym .gymdot', (ds) => ds.map((d) => { const x = d.getBoundingClientRect(); return [Math.round(x.left), Math.round(x.width), Math.round(x.height)]; }));
  r.dotOn = await page.$eval('#pg-gym .gymdot.on i', (i) => getComputedStyle(i).backgroundColor).catch(() => '');
  const pt = await tabAt(page, 'learn');
  const fg = await fingerOf(ctx, page);
  await fg.down(pt.x, pt.y);
  await page.waitForTimeout(700);
  await settle(page);
  r.arc = (await sw(page)).items.map((i) => `${i.id} ${i.at.x},${i.at.y} ${i.drawn}`);
  await page.screenshot({ path: `${out}/nav-switcher-${theme || 'reactor'}.png` });
  await fg.move(pt, { x: 220, y: 150 });
  await fg.up();
  await fg.detach();
  await ctx.close();
  return r;
};
const reactor = await shapes('');
const graphite = await shapes('graphite');
if (graphite.theme !== 'graphite') problems.push(`[graphite] the theme did not apply (${graphite.theme})`);
if (!reactor.pills.length || !reactor.dots.length || !reactor.arc.length || JSON.stringify(reactor.pills) !== JSON.stringify(graphite.pills) || JSON.stringify(reactor.dots) !== JSON.stringify(graphite.dots) || reactor.arc.join('|') !== graphite.arc.join('|')) problems.push(`[graphite] the shapes differ from Reactor's: ${JSON.stringify({ reactor, graphite })}`);
if (!reactor.on || reactor.on !== reactor.c2 || graphite.on !== graphite.c2 || reactor.on === graphite.on) problems.push(`[graphite] the selected pill is not drawn in each theme's own light: reactor ${reactor.on} (its --c2 ${reactor.c2}), graphite ${graphite.on} (its --c2 ${graphite.c2})`);
if (!graphite.dotOn || graphite.dotOn === reactor.dotOn) problems.push(`[graphite] the GYM's page dot is not in Graphite's colour (${graphite.dotOn} vs ${reactor.dotOn})`);

// ===================================================================== nothing sideways at 440 and 390; the hubs still fit
for (const viewport of [PHONE, { width: 390, height: 844 }]) {
  const W = viewport.width;
  ({ ctx, page } = await phone({ viewport }));
  for (const tab of ['gym', 'system', 'agenda', 'area-learn', 'area-plan', 'area-make', 'area-see']) {
    await show(page, tab, 1500);
    for (const x of await sideways(page, `#pg-${tab} :is(button, .pn, .secpills, .gympager, .hubsub), #dock button`)) problems.push(`[${W} ${tab}] sticks out sideways: ${x}`);
    if (await pageWide(page)) problems.push(`[${W} ${tab}] the page scrolls sideways`);
    if (tab.startsWith('area-')) {
      const fit = await page.$eval(`#pg-${tab} .hub`, (e) => ({ sh: e.scrollHeight, ch: e.clientHeight }));
      if (fit.sh > fit.ch + 1) problems.push(`[${W} ${tab}] the hub no longer fits one screen (${fit.sh} > ${fit.ch})`);
    }
  }
  for (const t of await target44(page, '#pg-area-see .hubtile')) problems.push(`[${W}] under a 44 pt target: ${t}`);
  await show(page, 'gym', 1500);
  await page.evaluate(() => document.querySelector('#pg-gym .gympager')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  for (const t of await target44(page, '#pg-gym .gymdot')) problems.push(`[${W} gym] a page dot under a 44 pt target: ${t}`);
  await show(page, 'system', 1500);
  for (const t of await target44(page, '#pg-system .secpill')) problems.push(`[${W} system] a pill under a 44 pt target: ${t}`);
  const fg = await fingerOf(ctx, page);
  for (const area of ['ask', 'see', 'make', 'learn', 'plan']) {
    const pt = await tabAt(page, area);
    await fg.down(pt.x, pt.y);
    await page.waitForTimeout(650);
    await settle(page);
    const a = await sw(page);
    if (!a.open) problems.push(`[${W} ${area}] a long press did not open the switcher`);
    for (const i of a.items) if (i.box.l < 0 || i.box.r > W || i.box.b > a.bar + 1 || i.box.t < 0) problems.push(`[${W} ${area}] ${i.id} is off the screen or under the bar (${Math.round(i.box.l)}–${Math.round(i.box.r)}, ${Math.round(i.box.t)}–${Math.round(i.box.b)})`);
    for (const x of await sideways(page, '#switcher :is(.switem, .swcap)')) problems.push(`[${W} ${area}] the switcher sticks out sideways: ${x}`);
    if (area === 'learn' && W === PHONE.width) await page.screenshot({ path: `${out}/nav-switcher-learn-open.png` });
    await fg.move(pt, { x: W / 2, y: 120 });
    await fg.up();
    await page.waitForTimeout(300);
  }
  await fg.detach();
  // the desktop keeps every panel: the pills step aside on a wide screen
  await ctx.close();
}
({ ctx, page } = await phone({ viewport: { width: 1280, height: 800 } }));
for (const tab of ['system', 'agenda']) {
  await show(page, tab, 1800);
  const P = await pills(page, tab);
  if (P.shown || P.panels.some((x) => x.hidden)) problems.push(`[1280 ${tab}] on a wide screen the pills show or panels are hidden: ${JSON.stringify(P.panels.filter((x) => x.hidden).map((x) => x.t))}`);
}
await ctx.close();

await browser.close();
if (problems.length) {
  console.error(`FAIL nav\n${[...new Set(problems)].join('\n')}`);
  process.exit(1);
}
console.log('nav: OK (the switcher by touch, by mouse and under Reduce Motion: hold, slide, let go; a tap and a short press unchanged; the sections on System and Agenda: pills held in reach, one section at a time, remembered per screen, deep links select their pill, every panel on a wide screen; the hubs in his own words against the brain, the plain line with no reading, "I" throughout; Graphite the same shapes in its colour; nothing sideways at 440 or 390; 44 pt targets)');
