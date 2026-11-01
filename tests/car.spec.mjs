// THE CAR IN 3-D (BRIEF-CAR, batch ⑤ part 1; OWNER-ISSUES 91a "i have this car and this is what's wrong with it") on the
// owner's iPhone (440 × 956, en-GB, Europe/London), against the real brain with the scripted model; the vehicle check is
// stubbed with a made-up plate (GH17 OST, a blue VW Golf whose last MOT said its front pads were wearing thin):
//  - a plate typed → the CAR offer → one tap → the CAR card gains WHAT'S WRONG? (a one-line box) and SHOW ME;
//  - "grinding when I brake" in the box → the card says the safety line first, then the top suspect with its check and
//    a first-estimate cost; still a card (180 pt at most), the safety line said once;
//  - SHOW ME → the 3D STUDIO on the car (the stand-in line said once) in the WHEEL view with the pads lit (the test hook
//    lists the lit parts and the view); FIX IT: the safety line first, NEXT STEP, the suspects in order; a tap on a part
//    → its sheet (what it is, a 30-second check, DIY or garage, a rough cost, what the MOT said); frames render (two
//    snapshots differ); the frame time printed;
//  - "open the bonnet" in the chat (no model) → the bay view; "the battery light is on" → the same car's card, its
//    suspects;
//  - the Lens guide: the part's picture beside the camera (a fake one here), its plain description, the line that no
//    recognition is claimed;
//  - VoiceOver labels; nothing sideways at 390 × 844; nothing of the record in the phone's storage; the security policy
//    blocked nothing.
//   BASE=http://localhost:8777 node tests/car.spec.mjs [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { PHONE, UK } from './nav.mjs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const problems = [];
const check = (ok, what) => void (ok || problems.push(what));

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const ctx = await browser.newContext({ viewport: PHONE, ...UK, serviceWorkers: 'block', permissions: ['camera'] });
await ctx.addInitScript(() => {
  window.__ghostyCards = true;
  window.__csp = [];
  document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
});
const page = await ctx.newPage();
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));

// ---- the vehicle check, stubbed: a made-up plate, shaped like the brain's answer (integrations/vehicle.ts)
const record = {
  plate: 'GH17 OST', make: 'VOLKSWAGEN', model: 'GOLF', colour: 'Blue', fuel: 'Petrol', firstUsed: '2017-03-28', engineCc: 1395, recall: 'No',
  mot: { state: 'valid', date: '2027-03-19', text: 'MOT valid until 19 Mar 2027' },
  tests: [{ date: '2026-03-20', result: 'PASSED', expiry: '2027-03-19', odometer: 61234, unit: 'mi', defects: [{ type: 'ADVISORY', text: 'Nearside Front Brake pad(s) wearing thin (1.1.13 (a) (ii))', dangerous: false }] }],
  mileage: { last: 61234, unit: 'mi', at: '2026-03-20', points: [], drops: [] }, advisories: 1, verdict: 'MOT valid until 19 Mar 2027', sources: ['DVSA MOT history'],
};
const links = [{ title: 'MOT history (GOV.UK)', url: 'https://www.gov.uk/check-mot-history' }];
await page.route('**/api/vehicle', async (route) => {
  const body = route.request().postDataJSON();
  if (body.plate === 'GH17OST') return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify({ ok: true, report: record, text: 'Vehicle GH17 OST…', links }) });
  return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ ok: false, reason: 'not_found', message: `No vehicle with the plate ${body.plate} is on record.`, links }) });
});

await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#pair input', { timeout: 20000 });
await page.fill('#pair input', KEY);
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
const until = (fn, arg, ms, what) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => (problems.push(what), false));
const car = () => page.evaluate(() => window.__ghosty.car?.state() ?? null);
const openChat = async () => {
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(600);
  if (!(await page.evaluate(() => document.querySelector('#pg-core .hud.core')?.classList.contains('logopen')))) await page.click('.logbtn').catch(() => undefined);
  await page.waitForTimeout(400);
};
const say = async (words) => {
  await page.fill('#cin', words);
  await page.press('#cin', 'Enter');
};
const carCard = () =>
  page.evaluate(() => {
    const c = [...document.querySelectorAll('#pg-core .ccard[data-kind="car"]:not(.wall)')].at(-1);
    if (!c) return null;
    const r = c.getBoundingClientRect();
    const t = c.querySelector('.cctitle');
    const s = c.querySelector('.ccsafe');
    const l = c.querySelector('.ccline');
    return {
      title: t?.textContent ?? '', line: l?.textContent ?? '', safe: s?.textContent ?? '', h: Math.round(r.height), right: Math.round(r.right),
      buttons: [...c.querySelectorAll('.ccacts button')].map((b) => b.textContent ?? ''),
      box: c.querySelector('input.ccfixin')?.getAttribute('aria-label') ?? '',
      danger: c.dataset.danger === '1',
      // VoiceOver: the title, then the safety line, then the suspect
      order: !!t && !!l && (!s || (!!(t.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING) && !!(s.compareDocumentPosition(l) & Node.DOCUMENT_POSITION_FOLLOWING))),
    };
  });

// ---- 1. a plate typed → the offer → the CAR card with WHAT'S WRONG? and SHOW ME
await openChat();
await say('GH17 OST');
await until(() => [...document.querySelectorAll('#pg-core .ccard[data-kind="car"]')].some((c) => /That's a plate/.test(c.textContent ?? '')), null, 25000, 'a plate typed: no CAR offer');
await page.locator('#pg-core .ccard[data-kind="car"]:not(.wall) .ccacts button', { hasText: 'SHOW THE CAR' }).last().click();
await until(() => !!document.querySelector('#pg-core .ccard[data-kind="car"] input.ccfixin'), null, 15000, 'the CAR card has no WHAT’S WRONG? box');
let c1 = await carCard();
check(/^Blue Volkswagen Golf$/i.test(c1?.title ?? '') && c1.buttons.join('|') === 'SHOW ME|FULL RECORD' && /What’s wrong/.test(c1.box) && c1.h <= 180, `the CAR card: ${JSON.stringify(c1)}`);

// ---- 2. "grinding when I brake" in the box → the safety line first, the top suspect, its check, a first-estimate cost
await page.fill('#pg-core .ccard[data-kind="car"] input.ccfixin', 'grinding when I brake');
await page.press('#pg-core .ccard[data-kind="car"] input.ccfixin', 'Enter');
await until(() => !!document.querySelector('#pg-core .ccard[data-kind="car"] .ccsafe'), null, 8000, 'no safety line on the card');
c1 = await carCard();
check(c1?.safe === 'Brakes: do not drive it; a garage, today.' && c1.danger, `the safety line: ${JSON.stringify(c1)}`);
check(/^Likely: brake pads worn to the metal\. Look at the pads through the wheel\. £\d+–£\d+, a first estimate\.$/.test(c1?.line ?? ''), `the suspect line: ${c1?.line}`);
check(c1?.order && c1.h <= 180 && c1.buttons[0] === 'SHOW ME', `the fault card: ${JSON.stringify(c1)}`);
const safeCount = await page.evaluate(() => [...document.querySelectorAll('#pg-core .ccard')].filter((c) => /Brakes: do not drive it/.test(c.textContent ?? '')).length);
check(safeCount === 1, `the safety line said ${safeCount} times in the chat`);
await page.screenshot({ path: `${out}/car-card.png` });

// ---- 3. SHOW ME → the Studio's car: the wheel view, the pads lit
await page.locator('#pg-core .ccard[data-kind="car"]:not(.wall) .ccacts button', { hasText: 'SHOW ME' }).last().click();
await until(() => { const s = window.__ghosty.car?.state(); return s?.ready && s.on && s.view === 'wheel' && !s.moving && s.lit.includes('pads'); }, null, 90000, `SHOW ME: no wheel view with the pads lit (${JSON.stringify(await car())?.slice(0, 300)})`);
let st = await car();
check(st?.spec?.title === 'Blue Volkswagen Golf' && st.spec.silhouette === 'hatchback' && st.lit[0] === 'pads' && st.fault?.symptom === 'brake_grind', `the car shown: ${JSON.stringify({ title: st?.spec?.title, lit: st?.lit, fault: st?.fault })}`);
const studio = await page.evaluate(() => {
  const pane = document.querySelector('#pg-studio .carpane');
  const safe = pane?.querySelector('.carsafe');
  const head = pane?.querySelector('.carfixhead');
  return {
    standIn: [...document.querySelectorAll('#pg-studio *')].filter((e) => e.children.length === 0 && /^A stand-in: the shape, colour and plate are the car’s/.test(e.textContent ?? '')).length,
    safeFirst: !!safe && !!head && !!(safe.compareDocumentPosition(head) & Node.DOCUMENT_POSITION_FOLLOWING),
    next: pane?.querySelector('.carnext')?.textContent ?? '',
    rows: [...(pane?.querySelectorAll('.fixrow') ?? [])].map((r) => r.textContent ?? ''),
    canvas: document.querySelector('#pg-studio canvas.carcanvas')?.getAttribute('aria-label') ?? '',
    pins: [...document.querySelectorAll('#pg-studio .carpin')].map((p) => p.getAttribute('aria-label')),
    views: [...document.querySelectorAll('#pg-studio .carviews button')].map((b) => `${b.textContent}:${b.getAttribute('aria-pressed')}`),
  };
});
check(studio.standIn === 1, `the stand-in line said ${studio.standIn} times`);
check(studio.safeFirst && /^NEXT STEP Look through the wheel at the pad/.test(studio.next) && /^1Brake pads worn to the metalMost likely/.test(studio.rows[0] ?? ''), `FIX IT: ${JSON.stringify(studio)}`);
check(/^The car in 3-D: Blue Volkswagen Golf, a family hatchback, plate GH17 OST\./.test(studio.canvas) && studio.pins[0] === '1: Brake pads' && studio.views.includes('WHEEL OFF:true'), `VoiceOver labels: ${JSON.stringify(studio)}`);

// a tap on a part on the car → its sheet; the pin → the pads' sheet with what the MOT said
const at = await page.evaluate(() => window.__ghosty.car.screenOf('hub'));
if (at) await page.mouse.click(at.x, at.y);
// (the hub sits in the disc's hat: the tap names whichever is nearest the finger, and opens that one's sheet)
await until(() => { const s = window.__ghosty.car.state(); return ['hub', 'disc'].includes(s.sheet) && s.sheet === s.picked && !!document.querySelector(`#pg-studio .carsheet[data-part="${s.sheet}"]`); }, null, 8000, `a tap on the hub did not open its sheet (${JSON.stringify(at)}, named ${await page.evaluate(() => window.__ghosty.car.state().picked)})`);
await page.locator('#pg-studio .carpin', { hasText: '1' }).first().click();
await until(() => window.__ghosty.car.state().sheet === 'pads', null, 8000, 'the pin did not open the pads’ sheet');
const sheet = await page.evaluate(() => document.querySelector('#pg-studio .carsheet')?.innerText ?? '');
check(/WHAT IT IS/.test(sheet) && /A 30-SECOND CHECK/.test(sheet) && /DIY OR GARAGE\s+GARAGE/.test(sheet) && /A ROUGH COST\s+£100–£220: .*A first estimate, not a quote\./.test(sheet) && /THE MOT SAID\s+“Nearside Front Brake pad\(s\) wearing thin/.test(sheet), `the pads' sheet: ${sheet}`);

// frames render: two snapshots apart differ (the lit parts pulse); the frame time
const stage = page.locator('#pg-studio .carstage');
const s1 = await stage.screenshot();
await page.waitForTimeout(700);
const s2 = await stage.screenshot();
check(!s1.equals(s2), 'two snapshots of the car are the same: nothing is drawing');
await page.screenshot({ path: `${out}/car-wheel.png` });
st = await car();
console.log(`car: frame time ${st.frameMs} ms (drawing ${st.drawMs} ms) over ${st.frames} frames in this browser's software renderer`);

// ---- 4. in the chat, no model: "open the bonnet" → the bay; "the battery light is on" → the same car's suspects
await openChat();
await say('open the bonnet');
await until(() => { const s = window.__ghosty.car?.state(); return s?.on && s.view === 'bay' && !s.moving && s.pose.bonnet > 1; }, null, 60000, `"open the bonnet": no bay view (${JSON.stringify(await car())?.slice(0, 200)})`);
await page.screenshot({ path: `${out}/car-bay.png` });
const reply = await page.evaluate(() => [...document.querySelectorAll('#pg-core .msg:not(.me)')].map((m) => m.textContent ?? '').find((t) => /Bonnet up/.test(t)) ?? '');
check(/Bonnet up on the car\./.test(reply) && /no AI/i.test(reply), `the bonnet's reply: ${reply.slice(0, 160)}`);
await openChat();
await say('the battery light is on');
await until(() => /Likely: the alternator is not charging/.test([...document.querySelectorAll('#pg-core .ccard[data-kind="car"]')].at(-1)?.textContent ?? ''), null, 15000, `"the battery light is on": the card has no suspect (${JSON.stringify(await carCard())})`);
c1 = await carCard();
check(/^Blue Volkswagen Golf$/i.test(c1?.title ?? '') && /If the temperature gauge climbs too, stop the engine/.test(c1.safe), `the battery light's card: ${JSON.stringify(c1)}`);

// ---- 5. the Lens guide: the part's picture beside the camera, its plain words, no recognition claimed
await page.locator('#pg-core .ccard[data-kind="car"]:not(.wall) .ccacts button', { hasText: 'SHOW ME' }).last().click();
await until(() => { const s = window.__ghosty.car?.state(); return s?.on && s.view === 'bay' && !s.moving && s.lit[0] === 'alternator'; }, null, 60000, 'SHOW ME for the battery light: no bay view with the alternator lit');
const findBtn = page.locator('#pg-studio button', { hasText: 'FIND IT ON THE CAR' }).first();
if (await findBtn.count()) {
  await findBtn.click();
  await until(() => { const g = document.querySelector('.carguide'); const v = g?.querySelector('video'); const c = g?.querySelector('canvas.carcanvas'); return !!g && !!v && v.videoWidth > 0 && !!c && c.width > 0; }, null, 30000, 'the Lens guide: no picture beside the camera');
  const f0 = (await car()).frames;
  const guide = await page.evaluate(() => {
    const g = document.querySelector('.carguide');
    const i = g.querySelector('canvas.carcanvas').getBoundingClientRect();
    const v = g.querySelector('video').getBoundingClientRect();
    return { side: Math.abs(i.top - v.top) < 40 && (i.right <= v.left + 2 || v.right <= i.left + 2), text: g.innerText, alt: g.querySelector('canvas.carcanvas').getAttribute('aria-label'), label: g.getAttribute('aria-label') };
  });
  check(guide.side, 'the Lens guide: the picture is not beside the camera');
  check(/Alternator/.test(guide.text) && /round finned metal unit/.test(guide.text) && /I don’t recognise parts from the camera/.test(guide.text) && /picture of the Alternator/.test(guide.alt ?? ''), `the Lens guide's words: ${JSON.stringify(guide)}`);
  await until((f) => window.__ghosty.car.state().frames > f + 1, f0, 20000, 'the Lens guide: the stand-in’s picture is not drawing');
  await page.screenshot({ path: `${out}/car-guide.png` });
  await page.locator('.carguide button', { hasText: 'CLOSE' }).click();
  await until(() => !document.querySelector('.carguide') && !!document.querySelector('#pg-studio .studioview > .carstage canvas.carcanvas'), null, 5000, 'the Lens guide did not close (the car back on its stage)');
} else problems.push('no FIND IT ON THE CAR button in FIX IT');

// ---- 6. nothing sideways at 390 × 844; the card still a card; nothing of the record kept; the security policy
await page.setViewportSize({ width: 390, height: 844 });
// (the software renderer draws a frame a second here: the pins follow the narrower picture on its next frame)
await page.waitForFunction(() => [...document.querySelectorAll('#pg-studio .carpin')].every((p) => !p.getClientRects().length || p.getBoundingClientRect().right <= innerWidth), null, { timeout: 15000 }).catch(() => undefined);
await page.waitForTimeout(400);
const wide = (root) =>
  page.evaluate((r) => {
    const out = [];
    if (document.documentElement.scrollWidth > innerWidth + 1) out.push('page');
    for (const el of document.querySelectorAll(`${r} *`)) {
      const b = el.getBoundingClientRect();
      if (b.width && el.getClientRects().length && (b.right > innerWidth + 2 || b.left < -2)) out.push(`${el.tagName}.${el.className} ${Math.round(b.left)}–${Math.round(b.right)} (${el.getAttribute('aria-label') ?? ''}; its box ${Math.round(el.parentElement?.getBoundingClientRect().left ?? 0)}–${Math.round(el.parentElement?.getBoundingClientRect().right ?? 0)})`.slice(0, 140));
    }
    return out.slice(0, 5);
  }, root);
const sideStudio = await wide('#pg-studio .hud.studio');
check(!sideStudio.length, `the Studio's car sticks out sideways at 390: ${sideStudio.join(', ')}`);
await openChat();
const sideChat = await wide('#pg-core .ccard');
check(!sideChat.length, `the CAR card sticks out sideways at 390: ${sideChat.join(', ')}`);
c1 = await carCard();
check(c1 && c1.h <= 180 && c1.right <= 390, `the CAR card at 390: ${JSON.stringify(c1)}`);
await page.screenshot({ path: `${out}/car-card-390.png` });
const kept = await page.evaluate(() => Object.entries({ ...localStorage }).filter(([, v]) => /GH17 ?OST|VOLKSWAGEN|wearing thin/i.test(v)).map(([k, v]) => `${k}: ${v.slice(Math.max(0, v.search(/GH17 ?OST|VOLKSWAGEN|wearing thin/i) - 60), v.search(/GH17 ?OST|VOLKSWAGEN|wearing thin/i) + 60)}`));
check(!kept.length, `the record (or its plate) was kept in localStorage: ${kept.join(' | ')}`);
const csp = await page.evaluate(() => window.__csp);
check(!csp.length, `the security policy blocked: ${csp.join(' | ')}`);

await browser.close();
if (problems.length) {
  console.error(`CAR FAILED (${problems.length}):\n - ${problems.join('\n - ')}`);
  process.exit(1);
}
console.log('Car run clean: a plate → the CAR card with WHAT’S WRONG? and SHOW ME; "grinding when I brake" → the safety line first, then the worn pads with their check and a first-estimate cost; SHOW ME → the car in 3-D, the wheel off, the pads lit, FIX IT in order, a tap → its sheet with what the MOT said; frames drawn; "open the bonnet" and "the battery light is on" with no model; the Lens guide beside the camera; labels read; nothing sideways at 390; nothing kept; the security policy quiet.');
