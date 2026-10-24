// Lens AIM on the owner's iPhone 18 Pro Max (440×956): with location granted and the compass faked
// (deviceorientation events, absolute, phone held upright), a place due east shows in the middle
// when facing east, right of the middle when facing a little left of it, and as an edge arrow when
// facing west; a tap on it opens its card with Wikipedia's lines; WHAT'S THAT? asks the brain with
// the aimed thing riding along as `seen`; the PLACES chip hides places; with no compass at all AIM
// falls back to drag-to-pan with a heading slider. The data routes are stubbed; nothing breaks the
// security policy and nothing sticks out sideways.
import { chromium } from 'playwright';
import { PHONE, UK } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const problems = [];
const HERE = { latitude: 52.4797, longitude: -1.9026 };
const placesAsked = [];

async function phone({ compass }) {
  const ctx = await browser.newContext({
    viewport: PHONE,
    ...UK,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    permissions: ['camera', 'geolocation'],
    geolocation: HERE,
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/favicon|net::ERR|404|Failed to load resource|^[WI]\d{4} |^INFO:/.test(t)) problems.push(`console: ${t.slice(0, 200)}`);
  });
  await page.addInitScript((withCompass) => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
    // the phone held upright; W3C alpha counts anticlockwise from north (270 = facing east)
    window.__orient = { alpha: 270, beta: 90, gamma: 0 };
    if (withCompass) setInterval(() => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { ...window.__orient, absolute: true })), 60);
  }, compass);

  // ---- the data routes, stubbed: a tower due east, a hill due north, a plane, a bus, no ships, the station overhead
  const json = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/api/aim/places?**', (r) => (placesAsked.push(r.request().url()),
    json(r, {
      credit: 'Places: Wikipedia, OpenStreetMap',
      places: [
        { id: 'east', name: 'East Tower', kind: 'tower', lat: HERE.latitude, lon: HERE.longitude + 0.05, height: 100, wiki: 'East Tower', dist: 3400 },
        { id: 'north', name: 'North Hill', kind: 'peak', lat: HERE.latitude + 0.06, lon: HERE.longitude, ele: 260, dist: 6700 },
      ],
    })),
  );
  await page.route('**/api/aim/about?**', (r) => json(r, { title: 'East Tower', extract: 'East Tower is a made-up tower used to test AIM.', url: '' }));
  await page.route('**/api/aim/iss', (r) => json(r, { lat: 52.6, lon: -1.6, altKm: 420, speedKmh: 27600, visibility: 'daylight', at: Date.now() }));
  await page.route('**/api/ships?**', (r) => json(r, { ships: [] }));
  await page.route('**/api/transit?**', (r) => json(r, { vehicles: [{ id: 'b1', kind: 'bus', line: '50', dest: 'Maypole', operator: 'NXWM', lat: HERE.latitude - 0.004, lon: HERE.longitude + 0.002, bearing: 180, speedMs: 5, t: Date.now(), delayS: 0, src: 'bustimes.org' }] }));
  await page.route('**/api/proxy?**', (r) => {
    if (/adsb\.lol|airplanes\.live/.test(decodeURIComponent(r.request().url())))
      return json(r, { ac: [{ hex: '4006aa', flight: 'BAW12   ', r: 'G-TEST', t: 'A320', lat: HERE.latitude + 0.05, lon: HERE.longitude + 0.08, alt_baro: 6000, gs: 250, track: 270 }] });
    return r.continue();
  });

  await page.goto(base);
  await page.fill('#pair input', 'preview-owner-key-0123456789');
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
  return { ctx, page };
}

const until = (page, fn, arg, ms, what) =>
  page
    .waitForFunction(fn, arg, { timeout: ms })
    .then(() => true)
    .catch(() => {
      problems.push(what);
      return false;
    });
const aim = (page) => page.evaluate(() => {
  const a = window.__ghosty?.aim;
  return a ? JSON.parse(JSON.stringify({ sensors: a.sensors, heading: a.heading, pitch: a.pitch, pos: a.pos, counts: a.counts, markers: a.markers, aimed: a.aimed, selected: a.selected, reply: a.reply })) : null;
});
const marker = async (page, id) => (await aim(page))?.markers.find((m) => m.id === id) ?? null;
const viewWidth = (page) => page.evaluate(() => document.querySelector('#pg-lens .lensview').clientWidth);
const face = (page, alpha) => page.evaluate((a) => (window.__orient.alpha = a), alpha);

// ================= with a compass =================
{
  const { ctx, page } = await phone({ compass: true });
  await page.evaluate(() => window.__ghosty.run('open_lens', { mode: 'aim' }));
  await page.waitForSelector('#pg-lens .lensmodes', { timeout: 15000 });
  // the AIM tile, tapped: sensors (and the camera) start from the tap
  await page.locator('#pg-lens .lensmodes button', { hasText: 'AIM' }).click();
  const startAim = page.locator('#pg-lens button', { hasText: 'START AIM' });
  if (await startAim.isVisible()) await startAim.click();
  await until(page, () => window.__ghosty?.aim?.sensors === 'compass', null, 15000, `the compass never came on: ${JSON.stringify(await aim(page))}`);
  await until(page, () => window.__ghosty?.aim?.pos?.from === 'gps', null, 15000, `no GPS position: ${JSON.stringify((await aim(page))?.pos)}`);
  await until(page, () => (window.__ghosty?.aim?.markers ?? []).some((m) => m.id === 'east'), null, 20000, `the place due east never got a marker: ${JSON.stringify(await aim(page))}`);

  // facing east: the tower due east is in the middle
  const w = await viewWidth(page);
  await page.waitForTimeout(600);
  let m = await marker(page, 'east');
  if (!m?.on || Math.abs(m.x - w / 2) > 12) problems.push(`facing east, the place due east is not in the middle: ${JSON.stringify(m)} (view ${w} px)`);
  const s = await aim(page);
  if (Math.abs(s.heading - 90) > 1) problems.push(`facing east reads heading ${s.heading}`);
  if (s.aimed !== 'east') problems.push(`the cross is not on the tower: aimed "${s.aimed}"`);
  await page.screenshot({ path: `${out}/aim-east.png` });

  // facing 75° (a little left of east): the tower is right of the middle
  await face(page, 285);
  // the compass is smoothed: wait for the reading to settle on 75° rather than a fixed time
  await page.waitForFunction(() => Math.abs((window.__ghosty?.aim?.heading ?? 0) - 75) < 1, null, { timeout: 5000 }).catch(() => undefined);
  await page.waitForTimeout(200);
  m = await marker(page, 'east');
  if (!m?.on || m.x < w / 2 + 25) problems.push(`facing 75°, the place due east is not right of the middle: ${JSON.stringify(m)}`);

  // facing west: an arrow at the edge
  await face(page, 90);
  await page.waitForTimeout(900);
  m = await marker(page, 'east');
  if (!m || m.on) problems.push(`facing west, the place due east is not an edge arrow: ${JSON.stringify(m)}`);
  else if (!(m.x <= 40 || m.x >= w - 40 || m.y <= 40)) problems.push(`facing west, the arrow is not at an edge: ${JSON.stringify(m)}`);
  await page.screenshot({ path: `${out}/aim-west.png` });

  // facing east again, tap the marker: its card, with Wikipedia's lines
  await face(page, 270);
  await page.waitForTimeout(900);
  m = await marker(page, 'east');
  const box = await page.locator('#pg-lens .lensview').boundingBox();
  if (m && box) await page.mouse.click(box.x + m.x, box.y + m.y);
  await until(page, () => !document.querySelector('#pg-lens .aimcard')?.hidden && /East Tower/.test(document.querySelector('#pg-lens .aimcard')?.textContent ?? ''), null, 8000, 'tapping the marker did not open its card');
  await until(page, () => /made-up tower/.test(document.querySelector('#pg-lens .aimextract')?.textContent ?? ''), null, 8000, "the card has no Wikipedia lines");

  // WHAT'S THAT? asks the brain, the aimed thing riding along as `seen`
  let sent = null;
  page.on('request', (r) => {
    if (r.url().includes('/api/chat') && r.method() === 'POST') sent = r.postDataJSON();
  });
  await page.locator('#pg-lens button', { hasText: "WHAT'S THAT?" }).click();
  await until(page, () => (window.__ghosty?.aim?.reply ?? '').length > 0, null, 30000, `WHAT'S THAT? got no reply: ${JSON.stringify(await aim(page))}`);
  if (!sent) problems.push("WHAT'S THAT? sent nothing to the brain");
  else {
    if (!/^aimed at a place "East Tower" \(9\d° from north/.test(sent.seen ?? '')) problems.push(`seen is not the aimed place: ${sent.seen}`);
    if (sent.images) problems.push('WHAT\'S THAT? sent a picture (words only expected)');
    if (sent.message !== "What's that?") problems.push(`the question was "${sent.message}"`);
  }
  // the brain is told the square kilometre, not the exact spot
  const precise = placesAsked.filter((u) => !/[?&]lat=52\.48&lon=-1\.90&/.test(u));
  if (!placesAsked.length || precise.length) problems.push(`places were asked about the exact spot: ${precise.join(' ')}`);
  const counts = (await aim(page)).counts;
  if (counts.plane !== 1 || counts.transit !== 1 || counts.space !== 1) problems.push(`counts: ${JSON.stringify(counts)}`);
  // describe() tells the chat what is aimed at
  const described = await page.evaluate(() => window.__ghosty.lens.counts);
  if (!/aimed at East Tower/.test(described)) problems.push(`the Lens does not say what is aimed at: "${described}"`);

  // the PLACES chip hides places
  await page.locator('#pg-lens .aimchips button', { hasText: 'PLACES' }).click();
  await page.waitForTimeout(500);
  if (await marker(page, 'east')) problems.push('PLACES off still shows the tower');
  await page.locator('#pg-lens .aimchips button', { hasText: 'PLACES' }).click();
  await page.waitForTimeout(500);
  if (!(await marker(page, 'east'))) problems.push('PLACES on again did not bring the tower back');

  // nothing sticks out sideways; the policy held
  const wide = await page.evaluate(() => document.documentElement.scrollWidth);
  if (wide > PHONE.width) problems.push(`the page is ${wide} px wide`);
  await page.screenshot({ path: `${out}/aim-card.png`, fullPage: false });
  const csp = await page.evaluate(() => window.__csp);
  if (csp.length) problems.push(`CSP: ${csp.join(' | ')}`);

  // another mode starts on a clean viewfinder: none of AIM's labels or compass left over the picture
  const inked = () => page.evaluate(() => {
    const c = document.querySelector('#pg-lens .lensov');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
    return n;
  });
  if (!(await inked())) problems.push('AIM drew nothing over the picture (the check below would prove nothing)');
  await page.locator('#pg-lens .lensmodes button', { hasText: 'MEASURE' }).click();
  await page.waitForTimeout(600);
  const left = await inked();
  if (left) problems.push(`AIM's drawing stayed over the picture after switching to MEASURE (${left} pixels)`);
  await page.locator('#pg-lens .lensmodes button', { hasText: 'AIM' }).click();
  await page.waitForTimeout(600);

  // leaving the Lens stops the sensors
  await page.evaluate(() => window.__ghosty.run('open_tab', { tab: 'core' }));
  await page.waitForTimeout(500);
  if ((await aim(page))?.sensors !== 'off') problems.push(`the sensors kept running after leaving the Lens: ${(await aim(page))?.sensors}`);
  await ctx.close();
}

// ================= no compass (a laptop) =================
{
  const { ctx, page } = await phone({ compass: false });
  await page.evaluate(() => window.__ghosty.run('open_lens', { mode: 'aim' }));
  await page.waitForSelector('#pg-lens .lensmodes', { timeout: 15000 });
  await page.locator('#pg-lens .lensmodes button', { hasText: 'AIM' }).click();
  const startAim = page.locator('#pg-lens button', { hasText: 'START AIM' });
  if (await startAim.isVisible()) await startAim.click();
  await until(page, () => window.__ghosty?.aim?.sensors === 'manual', null, 8000, `no fallback to drag-to-pan without a compass: ${JSON.stringify(await aim(page))}`);
  if (!(await page.locator('#pg-lens .aimslider').isVisible())) problems.push('no heading slider without a compass');
  await page.locator('#pg-lens .aimslider').fill('90');
  // the heading is read back from the drawing loop, which a busy machine may run late
  await until(page, () => Math.abs((window.__ghosty?.aim?.heading ?? 0) - 90) <= 0.5, null, 5000, `the slider did not turn AIM to 90°: ${(await aim(page)).heading}`);
  await until(page, () => (window.__ghosty?.aim?.markers ?? []).some((m) => m.id === 'east' && m.on), null, 15000, 'slider at 90°: the tower is not on screen');
  // a drag to the left turns the view right (like moving a picture)
  const box = await page.locator('#pg-lens .lensview').boundingBox();
  const before = (await aim(page)).heading;
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const after = (await aim(page)).heading;
  if (!(after > before + 5)) problems.push(`dragging left did not turn the view right: ${before} → ${after}`);
  // the same with a finger: the browser must not take the drag as a page pan (pointercancel)
  const pan = await page.evaluate(() => getComputedStyle(document.querySelector('#pg-lens .lensview')).touchAction);
  if (pan !== 'none') problems.push(`in drag-to-pan the viewfinder leaves touch drags to the browser (touch-action: ${pan})`);
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y: box.y + box.height / 2 }] });
  const fingerBefore = (await aim(page)).heading;
  await touch('touchStart', box.x + box.width * 0.7);
  for (let i = 1; i <= 8; i++) {
    await touch('touchMove', box.x + box.width * (0.7 - 0.05 * i));
    await page.waitForTimeout(16);
  }
  await touch('touchEnd');
  await page.waitForTimeout(300);
  const fingerAfter = (await aim(page)).heading;
  if (!(fingerAfter > fingerBefore + 5)) problems.push(`a finger drag to the left did not turn the view right: ${fingerBefore} → ${fingerAfter}`);
  await page.screenshot({ path: `${out}/aim-manual.png` });
  await ctx.close();
}

await browser.close();
if (problems.length) {
  console.log(`AIM: ${problems.length} problem(s)`);
  for (const p of problems) console.log(` - ${p}`);
  process.exit(1);
}
console.log('AIM: all good');
