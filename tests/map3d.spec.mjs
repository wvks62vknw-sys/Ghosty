// The 3D map on God's Eye, on an iPhone 13: the sheet's 3D tab loads MapLibre from this site
// (vendored, no CDN) with its worker from the same folder, asks OpenFreeMap for the DARK style by
// default and LIBERTY on its chip, opens tilted with BUILDINGS on (TILT and BUILDINGS lit), offers RAIL and RAIN, drops a pin
// with a popup on a tap, goes back to the flat map from the popup, opens from "3d map of london" in
// chat, and the security policy blocks nothing. When the tiles are reachable the map draws and the
// RAIL overlay fetches its tiles; without the internet only the requests are checked.
//   node tests/map3d.spec.mjs [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const problems = [];
const requests = [];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('request', (r) => requests.push(r.url()));
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

const asked = (re) => requests.some((u) => re.test(u));
const waitAsked = (re, ms = 15000) => {
  const t0 = Date.now();
  return new Promise((ok) => {
    const tick = () => (asked(re) ? ok(true) : Date.now() - t0 > ms ? ok(false) : setTimeout(tick, 200));
    tick();
  });
};

// MAP, then the 3D tab
await page.click('#pg-eye .eyebot .btns button:has-text("MAP")');
await page.waitForSelector('.modal .leaflet-container', { timeout: 20000 }).catch(() => problems.push('MAP did not open the flat map'));
await page.click('.modal .maptabs button:has-text("3D")');
const canvas = await page.waitForSelector('.modal .m3host .map3d .maplibregl-canvas', { timeout: 30000 }).then(() => true, () => false);
if (!canvas) problems.push(`the 3D tab did not start MapLibre: ${await page.textContent('.modal .m3host .fminfo').catch(() => '')}`);
else {
  if (!asked(/\/vendor\/maplibre\/maplibre-gl\.mjs$/)) problems.push('MapLibre was not loaded from this site (/vendor/maplibre)');
  if (!(await waitAsked(/\/vendor\/maplibre\/maplibre-gl-worker\.mjs/))) problems.push('MapLibre did not start its worker from this site');
  if (!(await page.$('link[href="/vendor/maplibre/maplibre-gl.css"]'))) problems.push('MapLibre\'s stylesheet was not loaded from this site');
  if (!(await waitAsked(/^https:\/\/tiles\.openfreemap\.org\/styles\/dark$/))) problems.push('the default style is not OpenFreeMap\'s DARK');
  if (!(await page.$('.modal .leaflet-container'))) problems.push('the flat map was thrown away on the 3D tab (it should only be hidden)');
  const chips = await page.$$eval('.modal .m3host .fmchips button', (b) => b.map((x) => `${x.textContent.trim()}${x.classList.contains('on') ? '*' : ''}`));
  for (const want of ['DARK*', 'LIBERTY', 'BRIGHT', 'POSITRON', 'FIORD', 'TILT*', 'BUILDINGS*', 'RAIL', 'RAIN', 'GPS', 'GLOBE HERE', 'FLAT MAP']) if (!chips.includes(want)) problems.push(`chip ${want} missing or in the wrong state (${chips.join(', ')})`);
  if (chips.some((c) => /MAPBOX|LIVE TRAFFIC|NAV NIGHT/.test(c))) problems.push(`Mapbox styles are offered without a token: ${chips.join(', ')}`);
  if (!(await page.$('.modal .m3host .fmchips .fmhint'))) problems.push('no hint that Mapbox styles come with the token');
  await page.click('.modal .m3host .fmchips button:has-text("LIBERTY")');
  if (!(await waitAsked(/^https:\/\/tiles\.openfreemap\.org\/styles\/liberty$/))) problems.push('LIBERTY did not ask OpenFreeMap for its style');
  // Online: the style's tiles arrive, the map draws, and RAIL fetches OpenRailwayMap tiles
  const online = await waitAsked(/tiles\.openfreemap\.org\/planet\//, 20000);
  console.log(online ? 'tiles reachable: checking the drawn map and the RAIL overlay' : 'tiles not reachable here: requests checked only');
  if (online) {
    await page.click('.modal .m3host .fmchips button:has-text("RAIL")');
    if (!(await waitAsked(/tiles\.openrailwaymap\.org\//, 20000))) problems.push('RAIL did not fetch OpenRailwayMap tiles');
    const drawn = await page.waitForFunction(() => {
      const c = document.querySelector('.modal .map3d .maplibregl-canvas');
      return c && c.width > 0 && c.height > 0;
    }, null, { timeout: 15000 }).then(() => true, () => false);
    if (!drawn) problems.push('the 3D map canvas has no size');
  }
  // a tap drops a pin with the popup
  const box = await page.$eval('.modal .map3d', (el) => el.getBoundingClientRect().toJSON());
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const popup = await page.waitForSelector('.modal .m3popup .m3pop', { timeout: 10000 }).then(() => true, () => false);
  if (!popup) problems.push('a tap on the 3D map did not open the pin popup');
  else {
    const btns = await page.$$eval('.modal .m3pop .fmbtns button', (b) => b.map((x) => x.textContent.trim()));
    for (const want of ['STREET VIEW', 'TRAFFIC', 'FLAT MAP', 'GLOBE']) if (!btns.includes(want)) problems.push(`the pin popup has no ${want} button (${btns.join(', ')})`);
    if (!(await page.$('.modal .m3pin.me'))) problems.push('no pin was dropped');
  }
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/phone-map3d.png` });
  // FLAT MAP in the popup goes back to the flat map, which was kept
  if (popup) {
    await page.click('.modal .m3pop .fmbtns button:has-text("FLAT MAP")');
    await page.waitForTimeout(500);
    const back = await page.evaluate(() => ({ flat: !document.querySelector('.modal .flathost:not(.m3host)')?.hidden, three: !!document.querySelector('.modal .m3host')?.hidden }));
    if (!back.flat || !back.three) problems.push(`FLAT MAP did not switch back: ${JSON.stringify(back)}`);
  }
  await page.click('.modal .mhead button:has-text("CLOSE")', { timeout: 10000 }).catch(() => page.click('.modal .mhead button:has-text("CLOSE")', { force: true }));
  await page.waitForTimeout(300);
  if (await page.$('.modal')) problems.push('the sheet did not close');
}

// from chat (the conversation lives on the CORE tab)
await page.evaluate(() => (location.hash = 'core'));
await page.waitForTimeout(900);
await page.click('.logbtn');
await page.fill('#cin', '3d map of london');
await page.keyboard.press('Enter');
const opened = await page.waitForSelector('.modal .m3host .map3d .maplibregl-canvas', { timeout: 30000 }).then(() => true, () => false);
if (!opened) problems.push('"3d map of london" did not open the 3D map');
else {
  await page.waitForTimeout(600);
  const w = await page.textContent('.modal .mapwhere').catch(() => '');
  if (!/^51\.5\d+°, -0\.1\d+°/.test(w ?? '')) problems.push(`the 3D map from chat is not on London: ${w}`);
  const on = await page.$$eval('.modal .maptabs button', (b) => b.filter((x) => x.classList.contains('on')).map((x) => x.textContent.trim()));
  if (on.join() !== '3D') problems.push(`the 3D tab is not the active one: ${on.join()}`);
}
const blocked = await page.evaluate(() => window.__cspv);
if (blocked.length) problems.push(`security policy blocked: ${blocked.join(', ')}`);

await browser.close();
if (problems.length) {
  console.log(`PROBLEMS:\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('3D map run clean: the 3D tab loads MapLibre and its worker from this site, asks OpenFreeMap for DARK then LIBERTY, offers BUILDINGS, TILT, RAIL and RAIN (Mapbox styles only with the token), drops a pin with actions on a tap, returns to the kept flat map, opens from chat on London, and the security policy blocked nothing.');
