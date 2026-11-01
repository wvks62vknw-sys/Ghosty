// BRIEF-REST-D (batch ⑧ part D) on the preview, a 390 × 844 phone:
//  1. DESIGN AND SHOW A BUILD: "design me a shed 3 by 2" in the chat answers with no model and opens the sheet on THE
//     PLAN (the drawing and its words: 3.0 m wide, 2.0 m deep); THE BILL with its cut lists, the total and the estimate
//     line; EXPORT CSV; a width changed in its field redraws the plan and the bill; SHOW ME IN 3-D opens the Studio's
//     DESIGN A BUILD pane, a tap on the roof lights it and its row in the list, EXPLODE and ROOF OFF; "price the roof"
//     lights the roof's lines; "spec me a gaming PC under £800" is a PC that passes its check; "build me a robot" is a
//     concept with real parts and nothing drawn.
//  2. THE HOME ASSISTANT BRIDGE on the stand-in box (tests/fixtures/house-api.mjs): unlinked, the house words say where to
//     link it and LINKS → HOME ASSISTANT has the steps; linked through SYSTEM → KEYS (the address and the token never back
//     on the phone), "the house" opens the HOUSE sheet with its rooms and the house in a line, a light switched from the
//     sheet and from the chat, the heating set, "is the back door open?", the garage door only after a confirm, the lock
//     refused from a scheduled job and never sent, and "what did you do today" listing each action.
// Nothing sideways at 390 × 844; VoiceOver names on every control; no security-policy refusal.
//   BASE=http://localhost:8711 node tests/restd.spec.mjs tests/.shots
import { launch, webkitNoise } from './browser.mjs';
import { openPanel, UK } from './nav.mjs';
import { HOUSE_TOKEN, HOUSE_URL } from './fixtures/house-api.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const SIZE = { width: 390, height: 844 };

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const problems = [];
const check = (ok, msg) => {
  if (!ok) problems.push(msg);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
  return ok;
};
const until = (page, fn, arg, ms = 15000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);

const sideways = (page, sel) =>
  page.$$eval(sel, (els) =>
    els
      .filter((e) => {
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
      })
      .map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} "${(e.textContent || '').trim().slice(0, 24)}"`),
  );
/** Every button, field and frame in `sel` has a name VoiceOver reads. */
const unnamed = (page, sel) =>
  page.$$eval(`${sel} :is(button, input, select, textarea, iframe, canvas)`, (els) =>
    els.filter((e) => e.getClientRects().length && !((e.getAttribute('aria-label') || e.getAttribute('title') || (e.tagName === 'CANVAS' ? '' : e.textContent) || '').trim() || e.closest('label'))).map((e) => e.outerHTML.slice(0, 80)),
  );

async function phone() {
  const ctx = await browser.newContext({ viewport: SIZE, screen: SIZE, deviceScaleFactor: 3, isMobile: true, hasTouch: true, ...UK, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const policy = [];
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => /Refused to|Content Security Policy/.test(m.text()) && policy.push(m.text().slice(0, 200)));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pair input', { timeout: 20000 });
  await page.fill('#pair input', KEY);
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
  return { ctx, page, policy };
}
const say = async (page, words) => {
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForSelector('#cin', { state: 'visible', timeout: 10000 });
  await page.fill('#cin', words);
  await page.press('#cin', 'Enter');
};
const lastReply = (page) => page.evaluate(() => [...document.querySelectorAll('#pg-core .msg:not(.me)')].at(-1)?.textContent ?? '');
/**
 * His words posted, and his reply to them: the last message of his after the words just posted (CI's smoke loop runs every
 * spec on one brain, so the conversation may hold older lines that would match).
 */
const ask = async (page, words, re, ms = 20000) => {
  const mine = (w) => page.evaluate((x) => [...document.querySelectorAll('#pg-core .msg.me')].filter((m) => (m.textContent ?? '').includes(x)).length, w);
  const before = await mine(words);
  await say(page, words);
  return page
    .waitForFunction(
      ([w, n, src]) => {
        const all = [...document.querySelectorAll('#pg-core .msg')];
        const posted = all.filter((m) => m.classList.contains('me') && (m.textContent ?? '').includes(w));
        if (posted.length <= n) return false;
        const after = all.slice(all.indexOf(posted.at(-1)) + 1).filter((m) => !m.classList.contains('me'));
        return !!after.length && new RegExp(src).test(after.at(-1).textContent ?? '');
      },
      [words, before, re.source],
      { timeout: ms },
    )
    .then(() => true, () => false);
};
const closeSheet = async (page) => {
  await page.locator('.modal .mhead button', { hasText: 'CLOSE' }).first().click().catch(() => undefined);
  await page.waitForTimeout(250);
};

const { ctx, page, policy } = await phone();

// ================================================================ 1. DESIGN AND SHOW A BUILD
check(await ask(page, 'design me a shed 3 by 2', /Garden shed, 3\.0 m × 2\.0 m: .*FIRST|Garden shed, 3\.0 m × 2\.0 m: .*first estimate, never certified/), `"design me a shed 3 by 2" answers with the design: ${(await lastReply(page)).slice(0, 160)}`);
check(/lines in the bill, £[\d,.]+ in all \(typical prices from October 2026, not quotes\)/.test(await lastReply(page)), 'the reply says the total, with the price table’s date');
check(await until(page, () => !!document.querySelector('.modal .build canvas.buildplan')), 'the sheet opens on THE PLAN, its drawing on a canvas');
const planWords = await page.evaluate(() => document.querySelector('.modal .buildplanwords')?.textContent ?? '');
check(/the floor 3\.0 m wide and 2\.0 m deep/.test(planWords) && /pent roof falling 8\.5 degrees/.test(planWords), `the plan has its dimensions, in words too: ${planWords.slice(0, 160)}`);
check((await page.evaluate(() => document.querySelector('.modal canvas.buildplan')?.getAttribute('aria-label') ?? '')).includes('3.0 m wide'), 'VoiceOver reads the plan from its canvas');
check(await until(page, () => { const c = document.querySelector('.modal canvas.buildplan'); return !!c && c.width > 200 && c.height > 200; }), 'the plan is drawn');
await page.screenshot({ path: `${out}/restd-plan.png` });
// THE BILL
await page.locator('.modal .buildtabs button', { hasText: 'THE BILL' }).click();
check(await until(page, () => !!document.querySelector('.modal .buildtotal')), 'THE BILL opens');
const bill = await page.evaluate(() => ({ total: document.querySelector('.modal .buildtotal')?.textContent ?? '', lines: document.querySelectorAll('.modal .buildbomline').length, cuts: [...document.querySelectorAll('.modal .buildcut')].map((c) => c.textContent ?? ''), groups: [...document.querySelectorAll('.modal .buildbomgroup h4')].map((h) => h.textContent ?? '') }));
check(/Total £[\d,]+/.test(bill.total) && /Typical prices from October 2026, not quotes/.test(bill.total) && /FIRST ESTIMATE · NEVER CERTIFIED/.test(bill.total), `the bill's total carries the estimate line: ${bill.total.slice(0, 140)}`);
check(bill.lines >= 15 && bill.groups.some((g) => /^Roof/.test(g)) && bill.groups.some((g) => /^Fixings/.test(g)), `every part has its line, fixings counted (${bill.lines} lines: ${bill.groups.join(', ')})`);
check(bill.cuts.some((c) => /Cut list: .*× (2\.4|3\.0|3\.6|4\.8) m.*waste \(\d+%\)/.test(c)), `boards come with their cut list in stock lengths and the waste: ${bill.cuts[0]}`);
await page.screenshot({ path: `${out}/restd-bill.png` });
// EXPORT
await page.locator('.modal button', { hasText: 'EXPORT CSV' }).click();
const exp = await until(page, () => window.__ghosty?.build?.state().exported?.kind === 'csv');
const ex = await page.evaluate(() => window.__ghosty.build.state().exported);
check(exp && /Garden shed, 3\.0 m × 2\.0 m/.test(ex?.head ?? '') && ex.bytes > 1000, `EXPORT CSV makes the file (${ex?.bytes} bytes)`);
// a change of width redraws
const total0 = await page.evaluate(() => window.__ghosty.build.state().total);
await page.locator('.modal .buildtabs button', { hasText: 'THE PLAN' }).click();
const width = page.locator('.modal input[aria-label="Width (front) in metres"]');
await width.fill('3.5');
await width.dispatchEvent('change');
check(await until(page, () => /the floor 3\.5 m wide/.test(document.querySelector('.modal .buildplanwords')?.textContent ?? '') && /3\.5 m × 2\.0 m/.test(document.querySelector('.modal .buildtitle')?.textContent ?? '')), 'a new width redraws the plan and the title');
const total1 = await page.evaluate(() => window.__ghosty.build.state().total);
check(total1 > total0, `and the bill follows (£${total0} → £${total1})`);
check((await unnamed(page, '.modal .build')).length === 0, `every control of the sheet has a name: ${(await unnamed(page, '.modal .build')).join(' | ')}`);
const sw1 = await sideways(page, '.modal .build :is(div, button, input, select, section, canvas, li)');
check(!sw1.length, `nothing in the sheet sticks out sideways: ${sw1.join(', ')}`);
// SHOW ME IN 3-D
await page.locator('.modal .buildfoot button', { hasText: 'SHOW ME IN 3-D' }).click();
// (two WebGL stages and their shaders on a software renderer under load: up to a minute)
const shown3d = await until(page, () => document.body.dataset.tab === 'studio' && window.__ghosty?.build?.state().on && window.__ghosty.build.state().ready, null, 60000);
check(shown3d, `SHOW ME opens the Studio’s DESIGN A BUILD pane, the build in 3-D${shown3d ? '' : ` (${await page.evaluate(() => JSON.stringify({ tab: document.body.dataset.tab, on: window.__ghosty?.build?.state().on, ready: window.__ghosty?.build?.state().ready }))})`}`);
const st = await page.evaluate(() => window.__ghosty.build.state());
check(st.groups.includes('roof') && st.groups.includes('frame') && st.groups.includes('figure') && st.meshes > 60, `the build in parts, with a person for scale (${st.meshes} parts: ${st.groups.join(', ')})`);
check(await page.evaluate(() => document.querySelector('#pg-studio .studioseg button.on')?.textContent === 'DESIGN A BUILD'), 'the pane is the Studio’s own');
await page.waitForTimeout(600);
const roofAt = await page.evaluate(() => window.__ghosty.build.screenOf('roof'));
if (roofAt) await page.mouse.click(roofAt.x, roofAt.y);
check(await until(page, () => window.__ghosty.build.state().lit === 'roof' && !!document.querySelector('#pg-studio .buildrow.on[data-group="roof"]'), null, 8000), `a tap on the roof lights it, and its row in the list (${JSON.stringify(roofAt)}, lit ${await page.evaluate(() => window.__ghosty.build.state().lit)})`);
check(await page.evaluate(() => document.querySelectorAll('#pg-studio .buildrow.on + .buildlines .buildline').length >= 3), 'the roof’s lines show under its row');
await page.locator('#pg-studio .buildchips button', { hasText: 'EXPLODE' }).click();
check(await until(page, () => window.__ghosty.build.state().exploded), 'EXPLODE takes it apart to show the frame');
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/restd-3d.png` });
await page.locator('#pg-studio .buildchips button', { hasText: 'ROOF OFF' }).click();
check(await until(page, () => window.__ghosty.build.state().roof === false), 'ROOF OFF lifts the roof away');
check((await unnamed(page, '#pg-studio .buildpane')).length === 0 && (await unnamed(page, '#pg-studio .buildstage')).length === 0, `the pane's controls have names: ${(await unnamed(page, '#pg-studio .buildpane')).join(' | ')}`);
const sw2 = await sideways(page, '#pg-studio :is(.buildpane, .buildstage, .studioseg) :is(div, button, input, label)');
check(!sw2.length, `nothing in the pane sticks out sideways: ${sw2.join(', ')}`);
// "price the roof"
check(await ask(page, 'price the roof', /The roof: .*in all, typical prices from October 2026, not quotes/), `"price the roof" says the roof's lines and their sum: ${(await lastReply(page)).slice(0, 160)}`);
check(await until(page, () => !!document.querySelector('.modal .buildbomgroup.lit[data-group="roof"]')), 'and opens THE BILL with the roof lit');
await closeSheet(page);
// a PC from a budget
check(await ask(page, 'spec me a gaming PC under £800', /Gaming PC, about £\d+: .*under your £800.*Everything fits/), `a PC from a budget, checked: ${(await lastReply(page)).slice(0, 180)}`);
await page.locator('.modal .buildtabs button', { hasText: 'THE BILL' }).click();
const compat = await page.evaluate(() => [...document.querySelectorAll('.modal .buildcompat li')].map((l) => `${l.className}:${l.textContent}`));
check(compat.length >= 6 && compat.every((c) => c.startsWith('ok:')), `its check, line by line: ${compat.slice(0, 3).join(' | ')}`);
check(/Prices move weekly/.test(await page.evaluate(() => document.querySelector('.modal .buildtotal')?.textContent ?? '')), 'with the honest line that prices move weekly');
await closeSheet(page);
// a concept
check(await ask(page, 'build me a robot', /A small wheeled robot \(a concept\).*A concept with real parts, not a build plan/), `a robot is a concept with real parts: ${(await lastReply(page)).slice(0, 160)}`);
check(await page.evaluate(() => !document.querySelector('.modal canvas.buildplan') && !document.querySelector('.modal .buildtabs button[data-side="plan"]') && document.querySelectorAll('.modal .buildparts li').length >= 5), 'nothing drawn, its real parts named');
await closeSheet(page);
// ================================================================ 2. THE HOME ASSISTANT BRIDGE
const api = (path, init = {}) => fetch(`${base}/api${path}`, { ...init, headers: { 'x-ghosty': '1', 'x-ghosty-key': KEY, 'content-type': 'application/json', ...(init.headers ?? {}) } }).then((r) => r.json());
const calls = () => fetch(`${base}/__test/house`).then((r) => r.json()).then((j) => j.calls);
await fetch(`${base}/__test/house?reset=1`);
await api('/keys', { method: 'POST', body: JSON.stringify({ name: 'homeassistant', value: '' }) });
// unlinked: the words say where to link it; LINKS → HOME ASSISTANT has the steps
check(await ask(page, 'turn off the hall light', /^.*Link your Home Assistant first — it’s in LINKS\./), `unlinked, the house words say where to link it: ${(await lastReply(page)).slice(-80)}`);
await page.evaluate(() => (location.hash = 'links'));
await openPanel(page, 'links', 'HOME ASSISTANT');
check(await until(page, () => /Duck DNS/.test(document.querySelector('#pg-links .housepn')?.textContent ?? '')), 'LINKS → HOME ASSISTANT opens');
const steps = await page.evaluate(() => document.querySelector('#pg-links .housepn')?.textContent ?? '');
check(/NOT LINKED|Not linked/i.test(steps) && /duckdns\.org/.test(steps) && /Let’s Encrypt/.test(steps) && /forward one port/.test(steps) && /Long-lived access tokens/.test(steps) && /SYSTEM → KEYS → HOME ASSISTANT/.test(steps) && /if you ever pay for it: not needed/.test(steps) && /never on this phone/.test(steps), `the LINKS card says his side step by step: ${steps.slice(0, 200)}`);
check((await unnamed(page, '#pg-links .housepn')).length === 0, 'the card’s buttons have names');
await page.screenshot({ path: `${out}/restd-links.png` });
// linked: the address and the token go to the brain's vault; the status the phone reads never carries them
const linked = await api('/keys', { method: 'POST', body: JSON.stringify({ name: 'homeassistant', value: `${HOUSE_URL}\n${HOUSE_TOKEN}` }) });
check(linked.ok && linked.works && /your Home Assistant answered/.test(linked.info), `SYSTEM → KEYS takes the address and the token and checks them: ${linked.info}`);
const status = JSON.stringify(await api('/status'));
check(/"name":"homeassistant"[^}]*"set":true/.test(status) && !status.includes('house.example.test') && !status.includes(HOUSE_TOKEN), 'KEYS shows HOME ASSISTANT set, and neither the address nor the token reaches the phone');
const houseJson = JSON.stringify(await api('/house?fresh=1'));
check(!houseJson.includes('house.example.test') && !houseJson.includes(HOUSE_TOKEN), 'nor does the house the phone reads');
// the HOUSE sheet
check(await ask(page, 'the house', /^.*Your house: .*coldest: Living room 18\.5 °C/), `"the house" answers with the house in a line: ${(await lastReply(page)).slice(-90)}`);
check(await until(page, () => /coldest: Living room 18\.5 °C/.test(document.querySelector('.modal .houseline')?.textContent ?? '')), `"the house" opens the HOUSE sheet with the house in a line: ${await page.evaluate(() => document.querySelector('.modal .houseline')?.textContent ?? '')}`);
const rooms = await page.evaluate(() => [...document.querySelectorAll('.modal .houseroom > h4 > span')].map((s) => s.textContent));
check(['Garage', 'Hall', 'Kitchen', 'Living room'].every((r) => rooms.includes(r)), `rooms as Home Assistant has them: ${rooms.join(', ')}`);
check(await page.evaluate(() => !document.querySelector('.modal .housecard[data-entity^="camera."]') && !!document.querySelector('.modal .housecard[data-entity="lock.back_door_lock"].guarded') && !!document.querySelector('.modal .housecard[data-entity="cover.garage_door"].guarded')), 'a camera is never shown; the lock and the garage door are marked guarded');
check(/18\.5 °C/.test(await page.evaluate(() => document.querySelector('.modal .housecard[data-entity="sensor.living_room_temperature"]')?.textContent ?? '')) && /changed \d+ min ago/.test(await page.evaluate(() => document.querySelector('.modal .housecard[data-entity="sensor.living_room_temperature"]')?.textContent ?? '')), 'a sensor’s reading with its unit and when it changed');
// a light from the sheet
await page.locator('.modal .housecard[data-entity="light.kitchen_light"] button', { hasText: 'TURN ON' }).click();
check(await until(page, () => fetch('/__test/house').then((r) => r.json()).then((j) => j.calls.some((c) => c.domain === 'light' && c.service === 'turn_on' && c.body.entity_id === 'light.kitchen_light')), null, 10000), 'a light switched on from the sheet reaches the house');
check(await until(page, () => /^on/.test(document.querySelector('.modal .housecard[data-entity="light.kitchen_light"] .housestate')?.textContent ?? ''), null, 10000), 'and its card says so');
check((await unnamed(page, '.modal .house')).length === 0, `every control of the sheet has a name: ${(await unnamed(page, '.modal .house')).join(' | ')}`);
const sw3 = await sideways(page, '.modal .house :is(div, button, input, select, section)');
check(!sw3.length, `nothing in the HOUSE sheet sticks out sideways: ${sw3.join(', ')}`);
await page.screenshot({ path: `${out}/restd-house.png` });
await closeSheet(page);
// from the chat, with no model
check(await ask(page, 'turn off the hall light', /Done: the Hall light is off\./), `a light from the chat: ${(await lastReply(page)).slice(-60)}`);
check(await ask(page, 'set the heating to 21', /Done: the Heating is set to 21 °C/), `the heating set: ${(await lastReply(page)).slice(-60)}`);
check(await ask(page, 'is the back door open?', /Yes: the Back door is open \(since \d+ min ago\)\./), `"is the back door open?": ${(await lastReply(page)).slice(-70)}`);
const c1 = await calls();
check(c1.some((c) => c.service === 'turn_off' && c.body.entity_id === 'light.hall_light') && c1.some((c) => c.service === 'set_temperature' && c.body.temperature === 21), 'both reached the house');
// the garage door asks his confirm: words alone never open it
check(await ask(page, 'open the garage', /The Garage door needs your own tap, with a confirm, every time/), `the garage door from words: ${(await lastReply(page)).slice(-90)}`);
check(!(await calls()).some((c) => c.domain === 'cover'), 'nothing was sent from the words');
// (on a phone the conversation is a drawer: open it to reach the reply's button)
if (!(await page.evaluate(() => document.querySelector('#pg-core .hud.core')?.classList.contains('logopen')))) await page.click('.logbtn').catch(() => undefined);
await page.waitForTimeout(400);
await page.locator('#pg-core .localacts button.localgo', { hasText: 'OPEN THE GARAGE DOOR' }).last().click();
check(await until(page, () => /guarded set/.test(document.querySelector('.modal .confirm')?.textContent ?? '')), 'its button asks for a confirm');
await page.locator('.modal .confirm button', { hasText: 'OPEN IT' }).click();
check(await until(page, () => fetch('/__test/house').then((r) => r.json()).then((j) => j.calls.some((c) => c.domain === 'cover' && c.service === 'open_cover')), null, 10000), 'confirmed, it opens');
// the lock from a scheduled job: refused, never sent
const job = await api('/jobs', { method: 'POST', body: JSON.stringify({ kind: 'task', title: 'Let the dog walker in', text: 'unlock the back door', at: Date.now() + 3_600_000, tz: 'Europe/London' }) });
const ran = await api(`/jobs/${job.job?.id}/run`, { method: 'POST', body: '{}' });
check(/A scheduled job never touches the Back door lock/.test(ran.item?.text ?? ''), `the lock from a job is refused: ${ran.item?.text ?? JSON.stringify(ran).slice(0, 120)}`);
check(!(await calls()).some((c) => c.domain === 'lock'), 'and nothing reached the lock');
await api(`/jobs/${job.job?.id}`, { method: 'DELETE' });
// every action in WHY: what did you do today
check(await ask(page, 'what did you do today?', /Set lights \(Hall light: off\)[\s\S]*|Set heating/), `"what did you do today" lists the house’s actions: ${(await lastReply(page)).slice(0, 200)}`);
const day = await lastReply(page);
check(/Set lights \(Hall light: off\)/.test(day) && /Set heating \(Heating: set to 21 °C\)/.test(day) && /Set lock \(Back door lock: unlock\): it didn’t work/.test(day), 'each with what it was; the refused unlock said too');
// the brain is shared with the specs after this one (CI's smoke loop): his house unlinked again, the stand-in put back
await api('/keys', { method: 'POST', body: JSON.stringify({ name: 'homeassistant', value: '' }) });
await fetch(`${base}/__test/house?reset=1`);
check(!policy.length, `no security-policy refusal: ${policy.join(' | ')}`);

await ctx.close();
await browser.close();
if (problems.length) {
  console.error(`\nrestd: ${problems.length} problem(s)`);
  for (const p of problems) console.error(` - ${p}`);
  process.exit(1);
}
console.log('restd: OK (a shed from his words: the plan with its sizes, the bill with its cut lists and the estimate line, EXPORT, a width that redraws, the 3-D with a part lit, EXPLODE and ROOF; the roof priced; a PC checked; a robot as a concept; the house: unlinked words and the LINKS steps, linked with the token kept in the vault, the HOUSE sheet, a light from the sheet and the chat, the heating, the back door, the garage door only after a confirm, the lock refused from a job, every action in WHY)');
