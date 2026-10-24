// DESIGN MY HOME, part 2 (OWNER-ISSUES 7), on the iPhone 18 Pro Max (440 × 956) in route C, with the scripted
// model (MOCK_LLM: "Design my home (sizes in metres): …" → design_home):
//  - SPACE opens with the DESIGN MY HOME card on top: the words box, three example chips, the unit from Settings,
//    DESIGN; no app-icon tiles, every control takes a 44 pt finger, nothing sticks out sideways;
//  - an example chip fills the words; DESIGN stays on SPACE and says "Drawing…" while Ghosty works; the plan arrives
//    whole (the `home_plan` event): the rooms drawn in the planner, "Drawn from your words · 6 rooms · … m²", what was
//    assumed one tap away, the honest line (a sketch, nothing about planning or building rules);
//  - PUT BACK MY PLAN restores the planner's room from before; the chat has the plan card under the reply ("Your plan:
//    6 rooms, … m²"), whose OPEN IN SPACE opens the plan again;
//  - SEE IN 3-D builds the same rooms, doors and windows in the 3D STUDIO;
//  - a two-storey description shows the floor switch, and each floor's rooms; PUT BACK MY PLAN then restores the flat;
//  - words with no rooms in them: Ghosty answers in the chat and the card says so (OPEN CHAT);
//  - the plan is still there after a reload; offline, the button says the brain is needed; the security policy blocks nothing.
//   BASE=http://localhost:8788 node tests/homeplan.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const problems = [];
const ctx = await browser.newContext({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
await ctx.addInitScript((k) => {
  localStorage.setItem('ghosty.ownerKey', k);
  if (!localStorage.getItem('ghosty.settings')) localStorage.setItem('ghosty.settings', JSON.stringify({ units: 'metric', home: { name: 'Birmingham', lat: 52.4862, lon: -1.8904 } }));
  window.__csp = [];
  document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
}, KEY);
const page = await ctx.newPage();
page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' && !/favicon|net::ERR|404|Failed to load resource|^[WI]\d{4} |^INFO:/.test(t)) problems.push(`console: ${t.slice(0, 200)}`);
});
// the brain answers a moment later than it would on its own, so "Drawing…" can be seen
let slow = 0;
await page.route('**/api/chat', async (route) => {
  if (slow) await new Promise((r) => setTimeout(r, slow));
  await route.continue();
});

await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });

const sp = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__ghosty?.space ?? null)));
const until = (fn, ms, what, arg = null) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => { problems.push(what); return false; });

/** Elements (visible, not inside something that clips them) that run past the screen's sides. */
const sideways = (sel) => page.$$eval(sel, (els) => els.filter((e) => {
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
}).filter((e) => !e.classList.contains('rcglow')).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} "${(e.dataset.label || e.textContent || '').trim().slice(0, 24)}"`));

/** A finger 20 pt left, right, above and below the control's centre still lands on it (each scrolled into view first). */
async function target44(sel) {
  const bad = [];
  for (const el of await page.$$(sel)) {
    if (!(await el.isVisible())) continue;
    await el.scrollIntoViewIfNeeded();
    const r = await el.evaluate((e) => {
      const b = e.getBoundingClientRect();
      const x = b.left + b.width / 2;
      const y = b.top + b.height / 2;
      const hits = [[x, y - 20], [x, y + 20], [x - 20, y], [x + 20, y]].map(([px, py]) => { const t = document.elementFromPoint(px, py); return !!t && (t === e || e.contains(t)); });
      return hits.every(Boolean) ? '' : `"${(e.dataset.label || e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 24)}" ${Math.round(b.width)}×${Math.round(b.height)} (${hits.map(Number).join('')})`;
    });
    if (r) bad.push(r);
  }
  return bad;
}

/** The chat open (route C: "Continue in chat" / the Chat chip; it is a toggle, so only when it is not open yet). */
const toChat = async () => {
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(700);
  if (!(await page.evaluate(() => !!document.querySelector('.hud.core.logopen')))) {
    const btn = page.locator('.logbtn:visible').first();
    await btn.click();
  }
  await page.waitForFunction(() => !!document.querySelector('.hud.core.logopen'), null, { timeout: 8000 }).catch(() => problems.push('the chat did not open'));
  await page.waitForTimeout(400);
};
const toSpace = async () => {
  await page.evaluate(() => (location.hash = 'space'));
  await page.waitForSelector('#pg-space .spacehome', { timeout: 20000 });
  await page.waitForTimeout(400);
};

// ---- SPACE: the DESIGN MY HOME card on top ----
if ((await page.evaluate(() => document.documentElement.dataset.look)) !== 'pro') problems.push('not in route C (a calm look is the default)');
await toSpace();
const card = await page.evaluate(() => {
  const pg = document.getElementById('pg-space');
  const first = pg?.querySelector('.pn');
  const c = pg?.querySelector('.spacehome');
  return {
    first: first?.classList.contains('spacehome'),
    title: c?.querySelector('.ptitle')?.textContent,
    placeholder: c?.querySelector('textarea')?.getAttribute('placeholder'),
    chips: [...(c?.querySelectorAll('.spacehomechips button') ?? [])].map((b) => b.dataset.label || b.textContent),
    unit: c?.querySelector('.spacehomeunit')?.textContent,
    design: c?.querySelector('.spacehomego')?.textContent,
    tiles: c?.querySelectorAll('.dtile, .hubtile, .ltile, .tcard, img, svg.appicon').length,
  };
});
if (!card.first) problems.push('DESIGN MY HOME is not the first card on SPACE');
if (card.title !== 'DESIGN MY HOME') problems.push(`the card's title reads "${card.title}"`);
if (card.placeholder !== "Describe your home in plain words: the rooms, their sizes in feet or metres, what's where…") problems.push(`the words box asks "${card.placeholder}"`);
if (JSON.stringify(card.chips) !== JSON.stringify(['A flat', 'A 3-bed semi', 'One L-shaped room'])) problems.push(`the example chips are ${JSON.stringify(card.chips)}`);
if (!/metres/.test(card.unit ?? '') || !/Settings/.test(card.unit ?? '')) problems.push(`the unit line reads "${card.unit}"`);
if (card.design !== 'DESIGN') problems.push(`the button reads "${card.design}"`);
if (card.tiles) problems.push(`the card has ${card.tiles} app-icon tiles or pictures`);
for (const s of await sideways('#pg-space *')) problems.push(`SPACE sticks out sideways: ${s}`);
for (const t of await target44('#pg-space .spacehome button, #pg-space .spacehome textarea')) problems.push(`SPACE card under a 44 pt target: ${t}`);
await page.locator('#pg-space .spacehome').scrollIntoViewIfNeeded();
await page.evaluate(() => document.querySelector('#pg-space .spacehome')?.scrollIntoView({ block: 'start' }));
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/homeplan-space-card.png`, timeout: 90000 });

// ---- an example chip, DESIGN: "Drawing…" on SPACE, then the plan ----
await page.locator('#pg-space .spacehomechips button', { hasText: /^A FLAT$/ }).click();
const words = await page.inputValue('#pg-space .spacehomewords');
if (!/^A flat with a kitchen, living room, bathroom, two bedrooms and a hall\./.test(words)) problems.push(`the chip filled "${words.slice(0, 60)}"`);
slow = 2500;
await page.locator('#pg-space .spacehomego').click();
await until(() => window.__ghosty?.space?.home?.drawing === true && /Drawing…/.test(document.querySelector('#pg-space .spacehomestatus')?.textContent ?? ''), 5000, 'DESIGN did not show "Drawing…" on SPACE');
const busyBtn = await page.$eval('#pg-space .spacehomego', (b) => ({ text: b.textContent, disabled: b.disabled }));
if (busyBtn.text !== 'DRAWING…' || !busyBtn.disabled) problems.push(`while drawing the button is ${JSON.stringify(busyBtn)}`);
await until(() => /^Drawn from your words · 6 rooms · \d+\.\d m²$/.test(window.__ghosty?.space?.home?.line ?? ''), 30000, 'the plan did not arrive on SPACE');
slow = 0;
let s = await sp();
if (s?.rooms.length !== 6) problems.push(`the planner draws ${s?.rooms.length} rooms (want the flat's 6)`);
if ((await page.evaluate(() => window.__ghosty.ui.get().tab)) !== 'space') problems.push('DESIGN left SPACE');
if (s?.home.drawing) problems.push('still "Drawing…" after the plan came');
const flatLine = s?.home.line ?? '';
const shown = await page.evaluate(() => {
  const c = document.querySelector('#pg-space .spacehome');
  return { line: c?.querySelector('.spacehomeline')?.textContent, summary: c?.querySelector('.spacehomeassumed summary')?.textContent, open: c?.querySelector('.spacehomeassumed')?.open, honest: c?.querySelector('.spacehomehonest')?.textContent, text: c?.textContent ?? '', floors: c?.querySelectorAll('.spacehomefloors button').length, acts: [...(c?.querySelectorAll('.spacehomeacts button') ?? [])].map((b) => b.textContent) };
});
if (shown.line !== flatLine) problems.push(`the card's line reads "${shown.line}" (state "${flatLine}")`);
if (!/^What I assumed \(\d+\)/.test(shown.summary ?? '') || shown.open) problems.push(`the assumptions: "${shown.summary}", open ${shown.open} (want closed, one tap away)`);
if (!/Drawn from your words/.test(shown.honest ?? '') || !/planning permission or building regulations/.test(shown.honest ?? '')) problems.push(`the honest line reads "${shown.honest}"`);
if (/\b(?:complies|compliant|meets (?:the )?(?:building|planning))/i.test(shown.text)) problems.push('the card claims rules are met');
if (shown.floors) problems.push(`a one-floor flat shows ${shown.floors} floor buttons`);
if (!shown.acts.includes('SEE IN 3-D') || !shown.acts.includes('PUT BACK MY PLAN')) problems.push(`the card's actions are ${JSON.stringify(shown.acts)}`);
await page.locator('#pg-space .spacehomeassumed summary').click();
const assumed = await page.$$eval('#pg-space .spacehomeassumed li', (els) => els.map((e) => e.textContent));
if (assumed.length < 2 || !assumed.some((a) => /you didn't say/.test(a))) problems.push(`one tap shows ${JSON.stringify(assumed.slice(0, 3))}`);
for (const s2 of await sideways('#pg-space *')) problems.push(`SPACE with the plan sticks out sideways: ${s2}`);
for (const t of await target44('#pg-space .spacehome button, #pg-space .spacehome summary')) problems.push(`the drawn plan's controls under a 44 pt target: ${t}`);
await page.locator('#pg-space .spacehomeassumed summary').click();
await page.evaluate(() => document.querySelector('#pg-space .spacehomeresult')?.scrollIntoView({ block: 'start' }));
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/homeplan-plan-drawn.png`, timeout: 90000 });

// ---- the chat: the plan card under the reply; OPEN IN SPACE ----
await toChat();
await until(() => !!document.querySelector('.log .homecard'), 10000, 'no plan card in the chat');
const reply = await page.evaluate(() => {
  const c = document.querySelector('.log .homecard');
  const prev = c?.previousElementSibling;
  return { line: c?.querySelector('b')?.textContent, floors: c?.querySelector('span')?.textContent ?? '', buttons: [...(c?.querySelectorAll('button') ?? [])].map((b) => b.textContent), afterReply: !!prev?.matches('.msg:not(.me)'), said: [...document.querySelectorAll('.log .msg.me')].at(-1)?.textContent ?? '' };
});
const m2 = flatLine.match(/(\d+\.\d) m²$/)?.[1];
if (reply.line !== `Your plan: 6 rooms, ${m2} m²`) problems.push(`the reply card reads "${reply.line}" (want "Your plan: 6 rooms, ${m2} m²")`);
if (reply.floors) problems.push(`a flat's card says "${reply.floors}"`);
if (JSON.stringify(reply.buttons) !== JSON.stringify(['OPEN IN SPACE', 'SEE IN 3-D'])) problems.push(`the reply card's buttons are ${JSON.stringify(reply.buttons)}`);
if (!reply.afterReply) problems.push('the plan card is not under the reply');
if (!/Design my home \(sizes in metres\): A flat with a kitchen/.test(reply.said)) problems.push(`the owner's message reads "${reply.said.slice(0, 80)}"`);
for (const t of await target44('.log .homecard button')) problems.push(`the reply card under a 44 pt target: ${t}`);
for (const s2 of await sideways('.log .homecard, .log .homecard *')) problems.push(`the reply card sticks out sideways: ${s2}`);
await page.evaluate(() => document.querySelector('.log .homecard')?.scrollIntoView({ block: 'center' }));
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/homeplan-reply-card.png`, timeout: 90000 });
// PUT BACK MY PLAN puts the planner's room from before back (the sample room); the card's OPEN IN SPACE brings the drawn plan again
await toSpace();
await page.locator('#pg-space .spacehomeacts button', { hasText: 'PUT BACK MY PLAN' }).click();
await until(() => window.__ghosty.space.rooms.length === 1 && window.__ghosty.space.items.length === 3, 5000, `PUT BACK MY PLAN did not restore the room from before: ${JSON.stringify((await sp())?.rooms.map((r) => r.name))}`);
const other = await page.$$eval('#pg-space .spacehomeresult .spacehomestatus', (els) => els.map((e) => e.textContent).join(' '));
if (!/The plan below is another one now\..*SHOW IT ON THE PLAN/.test(other)) problems.push(`with the room from before back, the card says "${other}"`);
await toChat();
await page.locator('.log .homecard button', { hasText: 'OPEN IN SPACE' }).click();
await until(() => window.__ghosty.ui.get().tab === 'space' && window.__ghosty.space.rooms.length === 6, 10000, `OPEN IN SPACE did not open the plan: ${JSON.stringify((await sp())?.rooms.map((r) => r.name))}`);
if (!(await page.locator('#pg-space .spacehomeacts button', { hasText: 'PUT BACK MY PLAN' }).isVisible())) problems.push('after OPEN IN SPACE the room from before cannot be put back');

// ---- SEE IN 3-D: the same rooms, doors and windows in the studio ----
s = await sp();
const want = { rooms: s.rooms.length, openings: s.openings.length };
await page.locator('#pg-space .spacehomeacts button', { hasText: 'SEE IN 3-D' }).click();
await until((w) => window.__ghosty?.studio?.state?.().rooms === w.rooms && window.__ghosty.studio.state().openings === w.openings, 30000, `SEE IN 3-D did not build the plan in the studio: ${JSON.stringify(await page.evaluate(() => { const x = window.__ghosty?.studio?.state?.(); return x && { rooms: x.rooms, openings: x.openings, error: x.error }; }))} vs ${JSON.stringify(want)}`, want);
const st = await page.evaluate(() => { const x = window.__ghosty?.studio?.state?.(); return x && { rooms: x.rooms, openings: x.openings, error: x.error, warnings: x.warnings, tab: window.__ghosty.ui.get().tab }; });
if (st?.tab !== 'studio' || st?.error) problems.push(`studio: ${JSON.stringify(st)}`);
if (st?.warnings?.length) problems.push(`the studio warns: ${JSON.stringify(st.warnings).slice(0, 200)}`);
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/homeplan-3d.png`, timeout: 90000 });

// ---- a two-storey home: the floor switch ----
await toSpace();
await page.locator('#pg-space .spacehomechips button', { hasText: /^A 3-BED SEMI$/ }).click();
await page.locator('#pg-space .spacehomego').click();
await until(() => (window.__ghosty?.space?.home?.storeys ?? []).length === 2 && !window.__ghosty.space.home.drawing, 30000, 'the semi did not arrive with two floors');
s = await sp();
if (!/^Drawn from your words · 2 floors · 8 rooms · \d+\.\d m²$/.test(s.home.line)) problems.push(`the semi's line reads "${s.home.line}"`);
const floorBtns = await page.$$eval('#pg-space .spacehomefloors button', (els) => els.map((b) => ({ t: b.textContent, on: b.classList.contains('on') })));
if (JSON.stringify(floorBtns) !== JSON.stringify([{ t: 'GROUND FLOOR', on: true }, { t: 'FIRST FLOOR', on: false }])) problems.push(`the floor switch is ${JSON.stringify(floorBtns)}`);
if (!s.rooms.some((r) => r.name === 'Hall') || s.rooms.length !== 3) problems.push(`the ground floor shows ${JSON.stringify(s.rooms.map((r) => r.name))}`);
await page.locator('#pg-space .spacehomefloors button', { hasText: 'FIRST FLOOR' }).click();
await until(() => window.__ghosty.space.home.shown === 1 && window.__ghosty.space.rooms.some((r) => r.name === 'Landing') && window.__ghosty.space.rooms.length === 5, 8000, `FIRST FLOOR did not show upstairs: ${JSON.stringify((await sp()).rooms.map((r) => r.name))}`);
for (const t of await target44('#pg-space .spacehomefloors button')) problems.push(`the floor switch under a 44 pt target: ${t}`);
for (const s2 of await sideways('#pg-space *')) problems.push(`SPACE with two floors sticks out sideways: ${s2}`);
await page.evaluate(() => document.querySelector('#pg-space .spacehomeresult')?.scrollIntoView({ block: 'start' }));
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/homeplan-two-floors.png`, timeout: 90000 });
await page.locator('#pg-space .spacehomefloors button', { hasText: 'GROUND FLOOR' }).click();
await until(() => window.__ghosty.space.home.shown === 0 && window.__ghosty.space.rooms.length === 3, 8000, 'GROUND FLOOR did not come back');
// the chat card for a house says how many floors
await toChat();
const semiCard = await page.evaluate(() => [...document.querySelectorAll('.log .homecard')].at(-1)?.textContent ?? '');
if (!/Your plan: 8 rooms, \d+\.\d m²/.test(semiCard) || !/2 floors/.test(semiCard)) problems.push(`the semi's card reads "${semiCard}"`);
// PUT BACK MY PLAN: the plan from before (the flat) comes back
await toSpace();
await page.locator('#pg-space .spacehomeacts button', { hasText: 'PUT BACK MY PLAN' }).click();
await until(() => window.__ghosty.space.rooms.length === 6, 5000, `PUT BACK MY PLAN did not restore the flat: ${JSON.stringify((await sp()).rooms.map((r) => r.name))}`);

// ---- words with no rooms: Ghosty answers in the chat, and the card says so ----
await page.fill('#pg-space .spacehomewords', 'make it nice please');
await page.locator('#pg-space .spacehomego').click();
await until(() => window.__ghosty?.space?.home?.outcome === 'chat' && !window.__ghosty.space.home.drawing, 30000, 'no rooms in the words: the card did not say Ghosty answered in the chat');
const said = await page.$eval('#pg-space .spacehomestatus', (e) => ({ text: e.textContent, btn: e.querySelector('button')?.textContent }));
if (!/answered in the chat/.test(said.text) || said.btn !== 'OPEN CHAT') problems.push(`after no plan the card says ${JSON.stringify(said)}`);
if (!/^Drawn from your words · 2 floors/.test((await sp()).home.line)) problems.push('the last plan went when no new one came');

// ---- kept on the phone: a reload still has the plan ----
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
await toSpace();
await until(() => /^Drawn from your words · 2 floors · 8 rooms/.test(window.__ghosty?.space?.home?.line ?? ''), 10000, 'the plan was not kept on the phone through a reload');

// ---- offline: the button says the brain is needed ----
await ctx.setOffline(true);
await page.evaluate(() => window.dispatchEvent(new Event('offline')));
await until(() => document.querySelector('#pg-space .spacehomego')?.disabled === true && /NEEDS THE BRAIN/.test(document.querySelector('#pg-space .spacehomego')?.textContent ?? ''), 8000, 'offline, DESIGN does not say the brain is needed');
const offNote = await page.$eval('#pg-space .spacehomestatus', (e) => e.textContent);
if (!/needs Ghosty’s brain/.test(offNote)) problems.push(`offline the card says "${offNote}"`);
await page.evaluate(() => document.querySelector('#pg-space .spacehome')?.scrollIntoView({ block: 'start' }));
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/homeplan-offline.png`, timeout: 90000 });
await ctx.setOffline(false);
await page.evaluate(() => window.dispatchEvent(new Event('online')));
await until(() => document.querySelector('#pg-space .spacehomego')?.textContent === 'DESIGN', 15000, 'back online, DESIGN did not come back');

const csp = await page.evaluate(() => window.__csp);
if (csp.length) problems.push(`security policy blocked: ${csp.join(', ')}`);
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'DESIGN MY HOME run clean at 440 × 956: the card is on top of SPACE (words, three examples, the unit from Settings, DESIGN; no app-icon tiles, 44 pt targets, nothing sideways); a chip filled the words, DESIGN said "Drawing…" on SPACE and the flat arrived whole — its 6 rooms drawn, "Drawn from your words · 6 rooms · … m²", the assumptions one tap away, the honest line; PUT BACK MY PLAN restored the room from before and the chat card under the reply ("Your plan: 6 rooms, … m²") opened the plan again with OPEN IN SPACE; SEE IN 3-D built the same rooms and openings in the studio; the semi showed the floor switch with each floor\'s rooms; PUT BACK MY PLAN restored the flat; words with no rooms were answered in the chat and the card said so; the plan stayed through a reload; offline the button said the brain is needed; the security policy blocked nothing.');
process.exit(problems.length ? 1 : 0);
