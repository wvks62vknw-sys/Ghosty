// Saved places on the owner's phone (440 × 956), the brain mocked: Memory → ME → PLACES says where places are
// kept, FIND shows what the map found for a yes and keeps nothing until KEEP IT, a postcode works, EDIT fills the
// form back in, FORGET takes a place away with UNDO; the Brief shows the commute from home to work as one line
// with the live traffic; God's Eye shows the saved places as chips — a tap flies there and drops the pin with
// the saved address, and the search box finds "home". No page errors, nothing blocked by the security policy,
// no sideways scrolling.
//   node tests/places.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const problems = [];

// The brain's places, in memory here: what FIND would answer for each address, and what was kept.
const FOUND = {
  '12 acacia avenue, b13': { id: 'home', label: 'Home', query: '12 Acacia Avenue, B13', address: '12, Acacia Avenue, Kings Heath, Birmingham, B13 9XX', lat: 52.4351, lon: -1.8912 },
  'b15 2tt': { id: 'work', label: 'Work', query: 'B15 2TT', address: 'B15 2TT, Edgbaston, Birmingham', lat: 52.4531, lon: -1.9416 },
  '1 new road, b14': { id: 'home', label: 'Home', query: '1 New Road, B14', address: '1, New Road, Kings Norton, Birmingham, B14 1AA', lat: 52.41, lon: -1.93 },
};
const brain = { places: [], kept: 0, finds: [], commute: 0 };

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: PHONE, ...UK, hasTouch: true, isMobile: true });
page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
await page.route(/\/api\/profile\/places/, async (r) => {
  const req = r.request();
  const u = new URL(req.url());
  const json = (body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  if (u.pathname === '/api/profile/places/find') {
    const b = req.postDataJSON();
    brain.finds.push(b);
    const f = FOUND[String(b.query).trim().toLowerCase()];
    return f ? json({ found: { ...f, id: b.label || f.id, label: b.label === 'work' ? 'Work' : b.label === 'home' ? 'Home' : f.label } }) : json({ error: `I couldn't find "${b.query}" on the map: try the street and the postcode` }, 400);
  }
  if (req.method() === 'POST') {
    const b = req.postDataJSON();
    const f = b.found;
    // as the brain does (places.ts): a new one goes at the end with today's date; an UNDO ({ at, index }) back exactly
    if (typeof b.at === 'number') {
      const list = brain.places.filter((p) => p.id !== f.id);
      list.splice(b.index, 0, { ...f, at: b.at });
      brain.places = list;
      return json({ places: brain.places });
    }
    brain.kept++;
    brain.places = [...brain.places.filter((p) => p.id !== f.id), { ...f, at: Date.now() }];
    return json({ places: brain.places });
  }
  if (req.method() === 'DELETE') {
    const id = u.searchParams.get('id');
    brain.places = brain.places.filter((p) => p.id !== id);
    return json({ places: brain.places, removed: true });
  }
  return json({ places: brain.places });
});
await page.route(/\/api\/traffic\/commute\//, (r) => {
  brain.commute++;
  const m = new URL(r.request().url()).pathname.match(/commute\/([-\d.]+),([-\d.]+)\/([-\d.]+),([-\d.]+)$/);
  if (!m || Math.abs(+m[1] - 52.4351) > 1e-3 || Math.abs(+m[3] - 52.4531) > 1e-3) problems.push(`the commute was asked from/to the wrong points: ${r.request().url()}`);
  return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ minutes: 24, km: 6.1, delayMin: 5, live: true, line: '24 min by car now, 5 min of it traffic (TomTom live)' }) });
});
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#pair input', { timeout: 15000 });
await page.fill('#pair input', 'preview-owner-key-0123456789');
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
await page.evaluate(() => {
  window.__cspv = [];
  document.addEventListener('securitypolicyviolation', (e) => window.__cspv.push(`${e.violatedDirective} ${e.blockedURI}`));
});
const sideways = async (where) => {
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  if (w > PHONE.width + 1) problems.push(`${where}: the page scrolls sideways (${w} px wide)`);
};

// ---- Memory → ME → PLACES
await page.evaluate(() => (location.hash = 'memory'));
const block = page.locator('#pg-memory .pn.me .places');
await block.waitFor({ state: 'attached', timeout: 10000 });
await block.scrollIntoViewIfNeeded();
const said = (await block.textContent()) ?? '';
if (!/Kept in his memory like everything here, and nowhere else/.test(said)) problems.push(`PLACES does not say where places are kept: ${said.slice(0, 160)}`);
if (!/No places yet/.test(said)) problems.push('PLACES with none saved does not say what to do');
// A place that cannot be found is said plainly.
await block.locator('select').selectOption('home');
await block.locator('input[aria-label="Address or postcode"]').fill('zzz nowhere');
await block.locator('.placeadd button:has-text("FIND")').click();
await page.waitForFunction(() => /Not found: I couldn't find "zzz nowhere"/.test(document.querySelector('#pg-memory .placefound')?.textContent ?? ''), null, { timeout: 5000 }).catch(() => problems.push('a place that cannot be found is not said plainly'));
// FIND: what the map found, for a yes; nothing kept yet.
await block.locator('input[aria-label="Address or postcode"]').fill('12 Acacia Avenue, B13');
await block.locator('.placeadd button:has-text("FIND")').click();
const found = block.locator('.placefound');
await page.waitForFunction(() => /IS THIS HOME\?/.test(document.querySelector('#pg-memory .placefound')?.textContent ?? ''), null, { timeout: 5000 }).catch(() => problems.push('FIND did not show what the map found'));
const foundText = (await found.textContent()) ?? '';
if (!/12, Acacia Avenue, Kings Heath, Birmingham, B13 9XX/.test(foundText) || !/52\.43510, -1\.89120/.test(foundText)) problems.push(`the found place is not shown in full: ${foundText}`);
if (brain.kept) problems.push('a place was kept before the owner said yes');
await found.scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/places-found.png` });
await found.locator('button:has-text("KEEP IT")').click();
await page.waitForSelector('#pg-memory .placerow[data-id="home"]', { timeout: 5000 }).catch(() => problems.push('KEEP IT did not list home'));
if (brain.kept !== 1) problems.push(`KEEP IT kept ${brain.kept} places`);
if (!(await found.isHidden())) problems.push('the found card stays after KEEP IT');
// Work by its postcode.
await block.locator('select').selectOption('work');
await block.locator('input[aria-label="Address or postcode"]').fill('B15 2TT');
await block.locator('.placeadd button:has-text("FIND")').click();
await page.waitForFunction(() => /IS THIS WORK\?/.test(document.querySelector('#pg-memory .placefound')?.textContent ?? ''), null, { timeout: 5000 }).catch(() => problems.push('FIND by postcode did not answer'));
await found.locator('button:has-text("KEEP IT")').click();
await page.waitForSelector('#pg-memory .placerow[data-id="work"]', { timeout: 5000 }).catch(() => problems.push('work was not listed'));
// EDIT fills the form back in.
await block.locator('.placerow[data-id="home"] button:has-text("EDIT")').click();
if ((await block.locator('input[aria-label="Address or postcode"]').inputValue()) !== '12 Acacia Avenue, B13') problems.push('EDIT did not put the address back in the form');
if ((await block.locator('select').inputValue()) !== 'home') problems.push('EDIT did not pick home');
// "Another place…" asks for its name.
await block.locator('select').selectOption('');
if (await block.locator('input[aria-label="Name of the place"]').isHidden()) problems.push('Another place… does not ask for a name');
await block.locator('select').selectOption('home');
await block.locator('input[aria-label="Address or postcode"]').fill('');
await block.scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/places-memory.png` });
await sideways('Memory → PLACES');
// FORGET, then UNDO: back exactly as it was — first in the list again, with the date it was saved.
const savedBefore = JSON.stringify(brain.places);
await block.locator('.placerow[data-id="home"] button:has-text("FORGET")').click();
await page.waitForFunction(() => !document.querySelector('#pg-memory .placerow[data-id="home"]'), null, { timeout: 5000 }).catch(() => problems.push('FORGET did not take home away'));
await block.locator('.undo button:has-text("UNDO")').click().catch(() => problems.push('no UNDO after FORGET'));
await page.waitForSelector('#pg-memory .placerow[data-id="home"]', { timeout: 5000 }).catch(() => problems.push('UNDO did not bring home back'));
const rowsNow = await page.$$eval('#pg-memory .placerow', (r) => r.map((x) => x.dataset.id).join(','));
if (rowsNow !== 'home,work' || JSON.stringify(brain.places) !== savedBefore) problems.push(`UNDO did not put home back exactly: the list reads ${rowsNow}, ${JSON.stringify(brain.places.map((p) => [p.id, p.at]))}`);
// KEEP IT over the old home: UNDO puts the old home back.
await block.locator('select').selectOption('home');
await block.locator('input[aria-label="Address or postcode"]').fill('1 New Road, B14');
await block.locator('.placeadd button:has-text("FIND")').click();
await page.waitForFunction(() => /IS THIS HOME\?/.test(document.querySelector('#pg-memory .placefound')?.textContent ?? ''), null, { timeout: 5000 }).catch(() => problems.push('FIND for a new home did not answer'));
await found.locator('button:has-text("KEEP IT")').click();
await page.waitForFunction(() => /New Road/.test(document.querySelector('#pg-memory .placerow[data-id="home"]')?.textContent ?? ''), null, { timeout: 5000 }).catch(() => problems.push('the new home was not kept'));
const changed = block.locator('.undo:not([hidden])');
if (!/Home changed to 1, New Road/.test((await changed.textContent().catch(() => '')) ?? '')) problems.push('no UNDO after a new home replaced the old one');
await changed.locator('button:has-text("UNDO")').click().catch(() => undefined);
await page.waitForFunction(() => /Acacia Avenue/.test(document.querySelector('#pg-memory .placerow[data-id="home"]')?.textContent ?? ''), null, { timeout: 5000 }).catch(() => problems.push('UNDO did not bring the old home back'));
if (JSON.stringify(brain.places) !== savedBefore) problems.push(`after UNDO the places are not as they were: ${JSON.stringify(brain.places)}`);

// ---- The Brief: the commute, one line with the live traffic.
await page.evaluate(() => (location.hash = 'brief'));
const commute = page.locator('#pg-brief .pn.commute');
await page.waitForFunction(() => /24 min by car now, 5 min of it traffic \(TomTom live\)/.test(document.querySelector('#pg-brief .pn.commute')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => problems.push('the Brief has no commute line'));
const ct = (await commute.textContent().catch(() => '')) ?? '';
if (!/HOME → WORK/.test(ct) || !/6\.1 km/.test(ct)) problems.push(`the commute line reads: ${ct}`);
await commute.scrollIntoViewIfNeeded().catch(() => undefined);
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/places-brief.png` });
await sideways('Brief');

// ---- God's Eye: the saved places as pins to fly to.
await page.evaluate(() => (location.hash = 'eye'));
const chip = page.locator('#pg-eye .myplaces button[data-id="home"]');
await chip.waitFor({ state: 'visible', timeout: 10000 }).catch(() => problems.push("God's Eye shows no place chips"));
const chips = await page.$$eval('#pg-eye .myplaces button', (b) => b.map((x) => x.textContent.trim()));
if (chips.join(',') !== 'Home,Work') problems.push(`the place chips read: ${chips.join(',')}`);
await chip.click().catch(() => undefined);
await page.waitForTimeout(1800);
const target = await page.evaluate(() => ({ title: document.querySelector('#pg-eye .eyeinfo .ptitle')?.textContent, addr: document.querySelector('#pg-eye .eyeinfo .addr')?.textContent, lat: window.__ghosty.globe.cam.target.lat, lon: window.__ghosty.globe.cam.target.lon }));
if (target.title !== 'HOME' || !/Acacia Avenue/.test(target.addr ?? '')) problems.push(`the pin's card reads: ${JSON.stringify(target)}`);
if (Math.abs(target.lat - 52.4351) > 0.01 || Math.abs(target.lon + 1.8912) > 0.01) problems.push(`God's Eye did not fly home: ${target.lat}, ${target.lon}`);
await page.screenshot({ path: `${out}/places-eye.png` });
// The search box knows "work".
await page.fill('#pg-eye .eyetop .search input', 'work');
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
const work = await page.evaluate(() => ({ title: document.querySelector('#pg-eye .eyeinfo .ptitle')?.textContent, lat: window.__ghosty.globe.cam.target.lat }));
if (work.title !== 'WORK' || Math.abs(work.lat - 52.4531) > 0.01) problems.push(`searching "work" did not go to the saved work: ${JSON.stringify(work)}`);
await sideways("God's Eye");

const blocked = await page.evaluate(() => window.__cspv);
if (blocked.length) problems.push(`security policy blocked: ${blocked.join(', ')}`);
await browser.close();
if (problems.length) {
  console.log(`PROBLEMS:\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(`Places run clean (${brain.finds.length} finds, ${brain.kept} kept, ${brain.commute} commute asks): PLACES says where they are kept, FIND shows the map's answer and keeps nothing until KEEP IT, a postcode works, EDIT works, FORGET and a replaced home come back exactly with UNDO, the Brief shows the commute with live traffic, God's Eye's chips and search fly to the saved places, no errors, nothing blocked, no sideways scroll.`);
