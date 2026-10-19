// Vehicle check on an iPhone 13. The VEHICLE CHECK sheet (palette command vehicle_check) says
// "Looked up once, not saved", sends nothing until CHECK, turns away a non-plate on the phone, and
// shows the record from /api/vehicle (stubbed here, shaped like the brain's answer) as a card: make
// and model, the MOT verdict, the mileage-went-down warning, a sparkline and every test, which opens
// to its notes. Lens READ: a photo of a plate is read on the phone and a CHECK THIS VEHICLE? chip
// appears — nothing is looked up until it is tapped; a plate typed into the text does the same. A
// check asked for in the chat (the real brain with the scripted model, no key here) is shown once.
// Afterwards nothing in localStorage or IndexedDB holds a plate or the record, nothing sticks out
// sideways and the security policy blocked nothing.
import { chromium } from 'playwright';
import { openPanel } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const problems = [];
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  permissions: ['camera'],
});
const page = await ctx.newPage();
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' && !/favicon|net::ERR|404|412|Failed to load resource|^[WI]\d{4} |^INFO:/.test(t)) problems.push(`console: ${t.slice(0, 200)}`);
});
await page.addInitScript(() => {
  window.__csp = [];
  document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
});

// The brain's answer for one plate, as POST /api/vehicle gives it (integrations/vehicle.ts).
const tests = [
  { date: '2026-03-20', result: 'PASSED', expiry: '2027-03-19', odometer: 71234, unit: 'mi', defects: [{ type: 'ADVISORY', text: 'Nearside Front Tyre worn close to legal limit', dangerous: false }, { type: 'ADVISORY', text: 'Offside Rear Brake disc worn', dangerous: false }, { type: 'MINOR', text: 'Oil leak, but not excessive', dangerous: false }] },
  { date: '2026-03-18', result: 'FAILED', expiry: null, odometer: 71230, unit: 'mi', defects: [{ type: 'MAJOR', text: 'Nearside Headlamp aim too high', dangerous: false }, { type: 'DANGEROUS', text: 'Offside Front Brake pipe excessively corroded', dangerous: true }] },
  { date: '2025-03-14', result: 'PASSED', expiry: '2026-03-27', odometer: 58100, unit: 'mi', defects: [] },
  { date: '2024-03-11', result: 'PASSED', expiry: '2025-03-27', odometer: 64500, unit: 'mi', defects: [{ type: 'ADVISORY', text: 'Front wiper blade deteriorated', dangerous: false }] },
  { date: '2022-03-10', result: 'PASSED', expiry: '2023-03-27', odometer: 52010, unit: 'mi', defects: [] },
];
const report = (plate) => ({
  plate,
  make: 'FORD',
  model: 'FOCUS',
  colour: 'Silver',
  fuel: 'Petrol',
  firstUsed: '2012-03-28',
  engineCc: 1596,
  recall: 'No',
  mot: { state: 'valid', date: '2027-03-19', text: 'MOT valid until 19 Mar 2027' },
  tests,
  mileage: { last: 71234, unit: 'mi', at: '2026-03-20', points: [{ date: '2022-03-10', miles: 52010 }, { date: '2024-03-11', miles: 64500 }, { date: '2025-03-14', miles: 58100 }, { date: '2026-03-18', miles: 71230 }, { date: '2026-03-20', miles: 71234 }], drops: [{ date: '2025-03-14', from: 64500, to: 58100 }] },
  advisories: 2,
  verdict: 'MOT valid until 19 Mar 2027 · last recorded mileage 71,234 miles (20 Mar 2026) · 2 advisories at the last test · WARNING: the recorded mileage went down once',
  sources: ['DVSA MOT history'],
});
const links = [{ title: 'MOT history (GOV.UK)', url: 'https://www.gov.uk/check-mot-history' }, { title: 'Vehicle tax and details (DVLA)', url: 'https://vehicleenquiry.service.gov.uk/' }];
const asked = [];
await page.route('**/api/vehicle', async (route) => {
  const body = route.request().postDataJSON();
  asked.push(body.plate);
  if (body.plate === 'AB12CDE') return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify({ ok: true, report: report('AB12 CDE'), text: 'Vehicle AB12 CDE…', links }) });
  return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ ok: false, reason: 'not_found', message: `No vehicle with the plate ${body.plate} is on record. Check the plate (0 and O, 1 and I look alike).`, links }) });
});

await page.goto(base);
await page.fill('#pair input', 'preview-owner-key-0123456789');
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });

const until = (fn, ms, what, arg = null) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => { problems.push(what); return false; });
const sideways = (sel) => page.evaluate((sel) => {
  const el = document.querySelector(sel);
  if (!el) return 'missing';
  const bad = [...el.querySelectorAll('*')].filter((x) => { const r = x.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1); }).map((x) => x.className || x.tagName).slice(0, 4);
  return bad.length ? bad.join(', ') : '';
}, sel);

// ---- the sheet: nothing leaves before CHECK; a non-plate is turned away on the phone ----
await page.evaluate(() => window.__ghosty.run('vehicle_check'));
await until(() => !!document.querySelector('.mbox[aria-label="VEHICLE CHECK"]'), 5000, 'the VEHICLE CHECK sheet did not open');
const banner = (await page.locator('.vcbanner').textContent()) ?? '';
if (!/LOOKED UP ONCE, NOT SAVED/.test(banner)) problems.push(`the banner reads "${banner}"`);
if (!/Never who owns it/.test(banner)) problems.push('the banner does not say it never looks up the owner');
await page.fill('.vcinput', 'hello');
await page.click('.vcform button');
await until(() => /not a UK number plate/.test(document.querySelector('.vcout')?.textContent ?? ''), 3000, 'a non-plate was not turned away');
await page.fill('.vcinput', 'ab12cde');
await page.waitForTimeout(300);
if (asked.length) problems.push(`something was sent before CHECK: ${JSON.stringify(asked)}`);
await page.click('.vcform button');
await until(() => !!document.querySelector('.vccard'), 5000, 'no card after CHECK');
if (asked.join() !== 'AB12CDE') problems.push(`CHECK sent ${JSON.stringify(asked)}, not the one plate`);
const card = (await page.locator('.vccard').textContent()) ?? '';
for (const want of ['AB12 CDE', 'FORD FOCUS', 'MOT valid until 19 Mar 2027', 'MILEAGE WENT DOWN', '64,500 → 58,100', '71,234 mi', 'MOT HISTORY · 5 TESTS', 'Nearside Front Tyre worn', 'all fixed', 'Shown once, not saved']) if (!card.includes(want)) problems.push(`the card is missing "${want}"`);
if ((await page.locator('.vccard .vcspark polyline').count()) !== 1) problems.push('no mileage sparkline');
if ((await page.locator('.vctest').count()) !== 5) problems.push(`${await page.locator('.vctest').count()} test rows, not 5`);
if ((await page.locator('.vcverdict.ok').count()) !== 1) problems.push('the MOT verdict is not shown as good');
// the failed test opens to its notes with a tap
if (await page.locator('.vctestwrap').nth(1).locator('.vcdefects').isVisible()) problems.push('an older test opened by itself');
await page.locator('.vctest').nth(1).tap();
if (!(await page.locator('.vctestwrap').nth(1).locator('.vcdefects li.bad').isVisible())) problems.push('a tap on the failed test did not show its dangerous defect');
const offside = await sideways('.mbox');
if (offside) problems.push(`the sheet sticks out sideways: ${offside}`);
await page.screenshot({ path: `${out}/vehicle-card.png` });
await page.locator('.vcwrap').evaluate((el) => el.scrollTo(0, el.scrollHeight));
await page.screenshot({ path: `${out}/vehicle-history.png` });
// closing forgets it
await page.click('.mhead button');
if (await page.evaluate(() => window.__ghosty.vehicle?.plate)) problems.push('the sheet kept the plate after it closed');

// ---- Lens READ: a photo of a plate, read on the phone; the chip checks it only when tapped ----
await page.evaluate(() => window.__ghosty.run('open_lens', { mode: 'read' }));
await until(() => !!document.querySelector('#pg-lens input[type=file]'), 15000, 'READ did not open');
const plateImage = await page.evaluate(async () => {
  const c = document.createElement('canvas');
  c.width = 1040;
  c.height = 240;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#f5c518';
  g.fillRect(40, 30, 960, 180);
  g.fillStyle = '#000';
  g.font = 'bold 130px sans-serif';
  g.textBaseline = 'middle';
  g.fillText('AB12 CDE', 120, 125);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s);
});
const before = asked.length;
await page.locator('#pg-lens input[type=file]').setInputFiles({ name: 'plate.png', mimeType: 'image/png', buffer: Buffer.from(plateImage, 'base64') });
const read = await until(() => /AB12\s?CDE/.test(window.__ghosty?.lens?.ocrText ?? ''), 120000, 'READ did not read the plate photo');
if (read) {
  await until(() => /CHECK THIS VEHICLE\? AB12 CDE/.test(document.querySelector('.vcchips')?.textContent ?? ''), 3000, 'no CHECK THIS VEHICLE? chip for the plate read off the photo');
  await page.waitForTimeout(500);
  if (asked.length !== before) problems.push('the plate was looked up before the chip was tapped');
  await page.screenshot({ path: `${out}/vehicle-read-chip.png` });
  await page.locator('button.vcchip').first().tap();
  await until(() => !!document.querySelector('.vccard'), 5000, 'the chip did not open the card');
  if (asked.at(-1) !== 'AB12CDE' || asked.length !== before + 1) problems.push(`the chip sent ${JSON.stringify(asked.slice(before))}`);
  await page.click('.mhead button');
}
// a plate typed (or pasted) into the text: the chip too, and "not on record" with the free GOV.UK checks
await page.fill('#pg-lens textarea.lensocr', 'Seen in the car park: LM68 XYZ (blue)');
await until(() => /CHECK THIS VEHICLE\? LM68 XYZ/.test(document.querySelector('.vcchips')?.textContent ?? ''), 3000, 'no chip for a typed plate');
await page.locator('button.vcchip').first().tap();
await until(() => /No vehicle with the plate LM68XYZ/.test(document.querySelector('.vcout')?.textContent ?? ''), 5000, 'not-found was not said');
if ((await page.locator('.vclinks a[href="https://www.gov.uk/check-mot-history"]').count()) !== 1) problems.push('no free GOV.UK check link when nothing was found');
await page.click('.mhead button');
// ordinary text brings no chip
await page.fill('#pg-lens textarea.lensocr', 'Turn left at the M6 junction 7, then A38 for 2 miles');
await page.waitForTimeout(200);
if (await page.locator('.vcchips').isVisible()) problems.push('a chip for ordinary text');
await page.fill('#pg-lens textarea.lensocr', '');
await page.evaluate(() => (window.__ghosty.lens.ocrText = ''));

// ---- the chat: the real brain (scripted model, no DVSA key here) — the reply is shown, never kept on the phone ----
await page.evaluate(() => window.__ghosty.run('open_tab', { tab: 'core' }));
await page.waitForTimeout(400);
if (await page.locator('.logbtn').isVisible()) await page.click('.logbtn');
await page.fill('#cin', 'MOT check AB12 CDE');
await page.press('#cin', 'Enter');
await until(() => /DVSA MOT history key/.test(document.body.textContent ?? ''), 20000, 'the chat did not answer the vehicle check');
await page.waitForTimeout(800); // the device copy is written 200 ms after a change

// ---- System → Keys: the DVSA key is pasted as five lines into a box that keeps them ----
await page.evaluate(() => window.__ghosty.run('open_tab', { tab: 'system' }));
await until(() => [...document.querySelectorAll('#pg-system button')].some((b) => /OPTIONAL KEYS/.test(b.textContent)), 10000, 'no SHOW OPTIONAL KEYS button');
await openPanel(page, 'system', 'KEYS');
await page.locator('#pg-system button', { hasText: /OPTIONAL KEYS/ }).click();
await until(() => !!document.querySelector('textarea.keylines[aria-label^="DVSA MOT history"]'), 10000, 'no five-line box for the DVSA key in System → Keys');
if ((await page.locator('textarea.keylines').getAttribute('rows')) !== '5') problems.push('the DVSA key box is not five lines tall');
const keyBlock = await page.locator('.keyblock', { has: page.locator('textarea.keylines') }).evaluate((el) => { const r = el.getBoundingClientRect(); return r.right <= innerWidth + 1 && r.left >= -1; });
if (!keyBlock) problems.push('the DVSA key block sticks out sideways');
await page.locator('textarea.keylines').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${out}/vehicle-key.png` });

// ---- nothing on the phone holds a plate or the record ----
const kept = await page.evaluate(async () => {
  const ls = Object.keys(localStorage).map((k) => `${k}=${localStorage.getItem(k)}`).join('\n');
  let idb = '';
  for (const d of (await indexedDB.databases?.()) ?? []) {
    const db = await new Promise((res, rej) => { const r = indexedDB.open(d.name); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    for (const name of db.objectStoreNames) {
      const all = await new Promise((res) => { const r = db.transaction(name).objectStore(name).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => res([]); });
      idb += JSON.stringify(all);
    }
    db.close();
  }
  return { ls, idb };
});
for (const [where, text] of Object.entries(kept)) {
  for (const needle of [/AB12\s?CDE/i, /LM68\s?XYZ/i, /FORD FOCUS/i, /19 Mar 2027/, /Nearside/]) if (needle.test(text)) problems.push(`${where} holds ${needle}`);
}
if (!/MOT check \[plate\]/.test(kept.ls)) problems.push('the chat kept on the phone does not show the owner\'s words with [plate]');
if (await page.evaluate(() => window.__csp.length)) problems.push(`CSP: ${await page.evaluate(() => window.__csp.join(' | '))}`);
await page.screenshot({ path: `${out}/vehicle-chat.png` });

await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'Vehicle check clean on an iPhone 13: the sheet said "looked up once, not saved", sent nothing before CHECK, turned a non-plate away, showed the record as a card with the mileage warning, sparkline and tests; READ read a plate photo and offered a chip that looked it up only when tapped (a typed plate too, not-found with the GOV.UK links); a chat check was shown once; nothing in localStorage or IndexedDB holds a plate or the record; nothing sticks out sideways and the security policy blocked nothing.');
process.exit(problems.length ? 1 : 0);
