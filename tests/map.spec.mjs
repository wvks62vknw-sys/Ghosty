// The flat map on God's Eye, on an iPhone 13: MAP opens Leaflet (vendored, no CDN) over free
// tiles, the style chips switch tile sources (DARK is OpenStreetMap filtered), the same dark tiles
// draw on the 3D globe, an overlay adds its tiles, a tap drops a pin with a
// popup, MEASURE gives a distance, Escape closes, "show me a map of london" from chat opens it,
// and the security policy blocked nothing. Tiles need not load (their addresses are checked), so
// this runs without the internet.
//   node tests/map.spec.mjs [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const problems = [];
const ALLOWED = /^(tile\.openstreetmap\.org|[abc]\.tile\.opentopomap\.org|[abc]\.tile-cyclosm\.openstreetmap\.fr|[abc]\.tiles\.openrailwaymap\.org|tiles\.openseamap\.org|tilecache\.rainviewer\.com|server\.arcgisonline\.com|api\.mapbox\.com)$/;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#pair input', { timeout: 15000 });
await page.fill('#pair input', 'preview-owner-key-0123456789');
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
await page.evaluate(() => {
  window.__cspv = [];
  document.addEventListener('securitypolicyviolation', (e) => window.__cspv.push(`${e.violatedDirective} ${e.blockedURI}`));
});
await page.evaluate(() => (location.hash = 'eye'));
await page.waitForTimeout(1500);

const tileHosts = async () => page.$$eval('.modal .leaflet-tile', (imgs) => [...new Set(imgs.map((i) => { try { return new URL(i.src).hostname; } catch { return i.src; } }))]);
const waitHost = (re) => page.waitForFunction((src) => [...document.querySelectorAll('.modal .leaflet-tile')].some((i) => new RegExp(src).test(i.src)), re.source, { timeout: 15000 }).then(() => true, () => false);

await page.click('#pg-eye .eyebot .btns button:has-text("MAP")');
const leaflet = await page.waitForSelector('.modal .leaflet-container', { timeout: 20000 }).then(() => true, () => false);
if (!leaflet) problems.push('MAP did not open a Leaflet map');
else {
  if (await page.$('.modal iframe.mapframe')) problems.push('a Google/Waze frame is open under the MAP view');
  const fromSelf = await page.evaluate(() => [...document.scripts].some((s) => s.src.endsWith('/vendor/leaflet/leaflet.js')));
  if (!fromSelf) problems.push('Leaflet was not loaded from this site (/vendor/leaflet)');
  if (!(await waitHost(/tile\.openstreetmap\.org/))) problems.push(`the default DARK tiles are not OpenStreetMap: ${JSON.stringify(await tileHosts())}`);
  const darkLayer = await page.$('.modal .leaflet-layer.osm-dark');
  if (!darkLayer) problems.push('DARK is not the filtered OpenStreetMap layer');
  await page.click('.modal .fmchips button:has-text("STREETS")');
  await page.waitForTimeout(500);
  if (await page.$('.modal .leaflet-layer.osm-dark')) problems.push('STREETS still shows the dark filter');
  if (!(await waitHost(/tile\.openstreetmap\.org/))) problems.push('STREETS did not switch to OpenStreetMap tiles');
  await page.click('.modal .fmchips button:has-text("TOPO")');
  if (!(await waitHost(/tile\.opentopomap\.org/))) problems.push('TOPO did not switch to OpenTopoMap tiles');
  await page.click('.modal .fmchips button:has-text("RAIL")');
  if (!(await waitHost(/tiles\.openrailwaymap\.org/))) problems.push('RAIL did not add OpenRailwayMap tiles');
  const hosts = await tileHosts();
  for (const hh of hosts) if (!ALLOWED.test(hh)) problems.push(`tiles from a host that is not allowed: ${hh}`);
  const attribution = await page.textContent('.modal .leaflet-control-attribution').catch(() => '');
  if (!/OpenStreetMap/.test(attribution ?? '')) problems.push('the map does not credit OpenStreetMap');
  // a tap drops a pin with the popup
  const box = await page.$eval('.modal .flatmap', (el) => el.getBoundingClientRect().toJSON());
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const popup = await page.waitForSelector('.modal .leaflet-popup .fmpop', { timeout: 10000 }).then(() => true, () => false);
  if (!popup) problems.push('a tap on the map did not open the pin popup');
  else {
    const btns = await page.$$eval('.modal .fmpop .fmbtns button', (b) => b.map((x) => x.textContent.trim()));
    for (const want of ['STREET VIEW', 'TRAFFIC', 'ROUTE HERE', 'ELEVATION', 'NEARBY', 'GLOBE']) if (!btns.includes(want)) problems.push(`the pin popup has no ${want} button (${btns.join(', ')})`);
    const addr = await page.waitForFunction(() => { const t = document.querySelector('.modal .fmaddr')?.textContent ?? ''; return t && !/Looking up/.test(t) ? t : false; }, null, { timeout: 15000 }).then((h) => h.jsonValue()).catch(() => '');
    console.log('pin address:', JSON.stringify(String(addr).slice(0, 100)));
  }
  await page.keyboard.press('Escape'); // closes the popup
  // measure
  await page.click('.modal .fmchips button:has-text("MEASURE")');
  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.5);
  await page.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.5);
  const measured = await page.waitForFunction(() => /MEASURE: .*(m|km)/.test(document.querySelector('.modal .fminfo')?.textContent ?? ''), null, { timeout: 5000 }).then(() => true, () => false);
  if (!measured) problems.push(`MEASURE gave no distance: ${await page.textContent('.modal .fminfo').catch(() => '')}`);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/phone-map.png` });
  const w = await page.textContent('.modal .mapwhere').catch(() => '');
  if (!/°/.test(w ?? '')) problems.push('the sheet does not show where the map is');
  // CLOSE, as on a phone (Escape goes to the map once it has focus)
  await page.click('.modal .mhead button:has-text("CLOSE")', { timeout: 10000 }).catch(() => page.click('.modal .mhead button:has-text("CLOSE")', { force: true }));
  await page.waitForTimeout(300);
  if (await page.$('.modal')) problems.push('the sheet did not close');
}

// from chat (the conversation lives on the CORE tab)
await page.evaluate(() => (location.hash = 'core'));
await page.waitForTimeout(900);
await page.click('.logbtn');
await page.fill('#cin', 'show me a map of london');
await page.keyboard.press('Enter');
const opened = await page.waitForSelector('.modal .leaflet-container', { timeout: 20000 }).then(() => true, () => false);
if (!opened) problems.push('"show me a map of london" did not open the map');
else {
  await page.waitForTimeout(600);
  const w = await page.textContent('.modal .mapwhere').catch(() => '');
  if (!/^51\.5\d+°, -0\.1\d+°/.test(w ?? '')) problems.push(`the map from chat is not on London: ${w}`);
}
// the same tiles on the 3D globe: cycle the tiles button to DARK, fly in, and the readout credits them once they draw
await page.click('.modal .mhead button:has-text("CLOSE")', { timeout: 10000 }).catch(() => page.click('.modal .mhead button:has-text("CLOSE")', { force: true }));
await page.evaluate(() => (location.hash = 'eye'));
await page.waitForTimeout(800);
for (let i = 0; i < 6; i++) {
  if ((await page.textContent('#pg-eye .eyebot .btns button.tilesbtn'))?.trim() === 'DARK') break;
  await page.click('#pg-eye .eyebot .btns button.tilesbtn');
}
if ((await page.textContent('#pg-eye .eyebot .btns button.tilesbtn'))?.trim() !== 'DARK') problems.push('the tiles button does not reach DARK');
// Put the camera over London at once (a fly-to crawls under software rendering) and wait for tiles to draw.
await page.evaluate(() => {
  const cam = window.__ghosty.globe.cam;
  cam.fly = null;
  cam.target = { lat: 51.5074, lon: -0.1278, range: 120, hd: 0, tilt: 0 };
  Object.assign(cam, cam.target);
});
const drew = await page.waitForFunction(() => /OpenStreetMap contributors \(dark\)/.test(document.querySelector('#pg-eye .readout')?.textContent ?? ''), null, { timeout: 60000 }).then(() => true, () => false);
if (!drew) problems.push(`dark OpenStreetMap tiles never drew on the globe: ${(await page.textContent('#pg-eye .readout'))?.replace(/\n/g, ' | ')}`);
await page.screenshot({ path: `${out}/phone-globe-dark.png` });
const blocked = await page.evaluate(() => window.__cspv);
if (blocked.length) problems.push(`security policy blocked: ${blocked.join(', ')}`);

await browser.close();
if (problems.length) {
  console.log(`PROBLEMS:\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('Map run clean: MAP opens Leaflet from this site over OpenStreetMap (light and dark), OpenTopoMap and OpenRailwayMap tiles on an iPhone 13; the dark tiles draw on the 3D globe too; a tap drops a pin with the address and actions; MEASURE measures; chat opens it on London; the security policy blocked nothing.');
