// The West Midlands on God's Eye, on the owner's iPhone 18 Pro Max (440×956), with every feed faked:
//   National Highways motorway cameras (vendored index, public stills) open from chat and in the grid,
//   live road incidents appear at their junctions, live buses and trams draw as a layer,
//   West Midlands Police safety-camera sites load over Birmingham,
//   and ROAD AHEAD follows the phone's own GPS with what lies ahead.
//   node tests/westmidlands.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';
import { mkdirSync, readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const root = new URL('..', import.meta.url).pathname;
const problems = [];

// The vendored National Highways index: how many cameras the globe should count.
const nhCount = (readFileSync(`${root}apps/web/src/data/wm/nhCameras.ts`, 'utf8').match(/^\s+\['\d{5}',/gm) ?? []).length;

function png(w, hgt, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * hgt);
  for (let y = 0; y < hgt; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) raw.set(rgba, y * (w * 4 + 1) + 1 + x * 4);
  }
  const crc = (buf) => {
    let c = ~0;
    for (const b of buf) {
      c ^= b;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return (~c >>> 0);
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(hgt, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const IMG = png(64, 48, [220, 120, 60, 255]);
const now = Date.now();

const SAFETY = [
  { name: 'A38 Bristol Rd South near South Rd', siteno: '110', cat: 'mobile', area: 'Birmingham', ltt: '52.408741', lgt: '-1.9748329', limit: '30', sitetype: 'mobile', totaloffences: '20', highspeed: '42', lastenforced: '20/12/2024' },
  { name: 'A4540 Belgrave Middleway', siteno: '174', cat: 'specs', area: 'Birmingham', ltt: '52.467805', lgt: '-1.9044379', limit: '40', sitetype: 'specs', totaloffences: '32', highspeed: '78', lastenforced: '31/12/2024' },
  { name: 'A34 Walsall Road', siteno: '201', cat: 'mobile', area: 'Birmingham', ltt: '52.5325', lgt: '-1.9175', limit: '30', sitetype: 'mobile', totaloffences: '0', highspeed: '0', lastenforced: 'No Data' },
  { name: 'M6 between junctions 5 and 4', siteno: '5762B', cat: 'hadecs', area: 'Solihull', ltt: '52.51451223', lgt: '-1.761415478', limit: 'Variable', sitetype: 'hadecs', totaloffences: '1410', highspeed: '96', lastenforced: '31/12/2024' },
];
const VEHICLES = {
  vehicles: [
    { id: 'b1', kind: 'bus', line: '11A', dest: 'Outer Circle', operator: 'NXWM', lat: 52.481, lon: -1.902, bearing: 90, speedMs: 6, t: now - 10_000, delayS: 180, src: 'bustimes.org' },
    { id: 'b2', kind: 'bus', line: 'X1', dest: 'Coventry', operator: 'NXWM', lat: 52.478, lon: -1.895, bearing: 120, speedMs: 0, t: now - 20_000, delayS: -30, src: 'bustimes.org' },
    { id: 't1', kind: 'tram', line: 'MM1', dest: 'Wolverhampton', operator: 'WM Metro', lat: 52.4835, lon: -1.9005, bearing: 300, speedMs: 8, t: now - 5_000, delayS: 0, src: 'bustimes.org' },
  ],
  src: 'bustimes.org', credit: 'bustimes.org (community data from the Bus Open Data Service)', note: 'no transport key yet: showing bustimes.org\'s community feed, updated about once a minute', at: now,
};
const EVENTS = { events: [
  { id: 'e1', road: 'M6', direction: 'S', title: 'M6 southbound between J6 and J5', reason: 'Congestion', delayS: 1140, lanesClosed: '0|0|0', lat: 52.509, lon: -1.838, normalBy: 'Normal traffic conditions are expected between 13:45 and 14:00' },
  { id: 'e2', road: 'M42', direction: 'N', title: 'M42 northbound between J6 and J7', reason: 'Broken down vehicle', delayS: 300, lanesClosed: '1|0|0', lat: 52.45, lon: -1.73, normalBy: '' },
], at: now, credit: 'Contains public sector information licensed under the Open Government Licence v3.0 (National Highways)' };

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: PHONE, ...UK, deviceScaleFactor: 1, geolocation: { latitude: 52.505, longitude: -1.9, accuracy: 15 }, permissions: ['geolocation'] });
const asked = new Set();
await ctx.route('**/api/proxy?**', (route) => {
  const target = new URL(route.request().url()).searchParams.get('url') ?? '';
  if (/public\.highwaystrafficcameras\.co\.uk\/cctvpublicaccess\/images\/\d{5}\.jpg/.test(target)) {
    asked.add('nh-frame');
    return route.fulfill({ status: 200, headers: { 'content-type': 'image/jpeg' }, body: IMG });
  }
  if (/wmsafetycameras\.co\.uk\/camera_map\/manage\/data\.json/.test(target)) {
    asked.add('wmp');
    return route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(SAFETY) });
  }
  return route.fulfill({ status: 404, body: '' }); // every other feed: nothing (never the real internet)
});
await ctx.route('**/api/transit?**', (route) => { asked.add('transit'); return route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(VEHICLES) }); });
await ctx.route('**/api/highways/events?**', (route) => { asked.add('events'); return route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(EVENTS) }); });
for (const mirror of ['https://overpass-api.de/**', 'https://overpass.kumi.systems/**']) await ctx.route(mirror, (route) => route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: '{"elements":[]}' }));

const page = await ctx.newPage();
page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && /TypeError|ReferenceError/.test(m.text()) && problems.push(`console: ${m.text()}`));
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#pair input', { timeout: 15000 });
await page.fill('#pair input', 'preview-owner-key-0123456789');
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
await page.evaluate(() => (location.hash = 'eye'));
await page.waitForTimeout(1500);
const layerText = async () => (await page.evaluate(() => document.querySelector('.eyelay')?.textContent ?? '')).replace(/\s+/g, ' ');
const waitLayer = (re) => page.waitForFunction((src) => new RegExp(src).test((document.querySelector('.eyelay')?.textContent ?? '').replace(/\s+/g, ' ')), re.source, { timeout: 25000 }).then(() => true, () => false);
const cardText = async () => (await page.evaluate(() => document.querySelector('.eyeinfo')?.textContent ?? '')).replace(/\s+/g, ' ');
// Software WebGL in the test browser renders a few frames a second, so a flight across the globe can take a minute: put the camera straight there.
const jump = (lat, lon, range) => page.evaluate(([lat, lon, range]) => { const c = window.__ghosty.globe.cam; c.fly = null; c.follow = null; Object.assign(c, { lat, lon, range, tilt: 0, hd: 0 }); c.target = { lat, lon, range, hd: 0, tilt: 0 }; }, [lat, lon, range]);

// 1. The motorway cameras are counted (the vendored index needs no download) and open from chat.
await jump(52.48, -1.9, 40);
await page.evaluate(() => window.__ghosty.run('set_layer', { layer: 'cams', on: true }));
if (!(await waitLayer(new RegExp(`CCTV CAMERAS\\s*${nhCount}(?!\\d)`)))) problems.push(`motorway cameras not counted (${nhCount} vendored): ${(await layerText()).slice(0, 300)}`);
await page.evaluate(() => window.__ghosty.run('show_cameras', { place: 'Birmingham' }));
const opened = await page.waitForFunction(() => /NATIONAL HIGHWAYS/.test(document.querySelector('.eyeinfo')?.textContent ?? '') && !!document.querySelector('.eyeinfo .camview img'), null, { timeout: 30000 }).then(() => true, () => false);
if (!opened) problems.push(`show_cameras Birmingham did not open a National Highways camera: ${(await cardText()).slice(0, 200)}`);
else {
  const card = await cardText();
  if (!/Crown copyright/.test(card)) problems.push('the camera card has no Crown copyright credit');
  await page.waitForFunction(() => /● REC/.test(document.querySelector('.eyeinfo .camstamp')?.textContent ?? ''), null, { timeout: 20000 }).catch(() => problems.push('the motorway camera frame never loaded'));
}
await page.screenshot({ path: `${out}/phone-wm-camera.png` });
await page.evaluate(() => document.querySelector('.eyeinfo .row.wrap button:last-child')?.click());

// 2. Live incidents at their junctions, and live buses & trams.
await page.evaluate((ev) => window.__ghosty.run('show_incidents', { lat: 52.5, lon: -1.85, range_km: 40, events: ev.events }), EVENTS);
if (!(await waitLayer(/ROAD INCIDENTS\s*2/))) problems.push(`incidents not counted: ${(await layerText()).slice(0, 300)}`);
await page.evaluate(() => window.__ghosty.run('show_transit', { lat: 52.48, lon: -1.9, range_km: 5 }));
if (!(await waitLayer(/BUSES & TRAMS\s*2 BUS · 1 TRAM/))) problems.push(`buses and trams not counted: ${(await layerText()).slice(0, 300)}`);
if (!asked.has('transit')) problems.push('the transit feed was never asked');
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/phone-wm-transit.png` });

// 3. Safety-camera sites over Birmingham (West Midlands Police), counted with the OSM ones.
await page.evaluate(() => window.__ghosty.run('set_layer', { layer: 'enforce', on: true }));
await jump(52.48, -1.9, 20);
if (!(await waitLayer(/ANPR \/ SPEED\s*0 ANPR · [1-9]/))) problems.push(`safety sites not loaded: wmp asked=${asked.has('wmp')} ${(await layerText()).slice(0, 300)}`);
else {
  const sites = await page.evaluate(() => [...window.__ghosty.globe.layers].length);
  if (!sites) problems.push('no layers');
}

// 4. ROAD AHEAD: the phone's GPS, heading from movement, what lies ahead, a camera opened by a tap.
await page.evaluate(() => window.__ghosty.run('road_ahead', {}));
await page.waitForSelector('.roadahead:not([hidden])', { timeout: 10000 }).catch(() => problems.push('ROAD AHEAD panel did not open'));
await page.waitForFunction(() => /GPS/.test(document.querySelector('.roadahead h3 small')?.textContent ?? ''), null, { timeout: 15000 }).catch(() => problems.push(`no GPS fix in ROAD AHEAD: ${document.querySelector('.roadahead')?.textContent}`));
await ctx.setGeolocation({ latitude: 52.5055, longitude: -1.885, accuracy: 12 });
await page.waitForTimeout(1200);
await ctx.setGeolocation({ latitude: 52.506, longitude: -1.87, accuracy: 12 });
const headed = await page.waitForFunction(() => /\b(E|NE|SE) \d+°/.test(document.querySelector('.roadahead .big small')?.textContent ?? ''), null, { timeout: 15000 }).then(() => true, () => false);
if (!headed) problems.push(`no eastward heading from movement: ${(await page.evaluate(() => document.querySelector('.roadahead')?.textContent ?? '')).replace(/\s+/g, ' ').slice(0, 300)}`);
const ahead = (await page.evaluate(() => document.querySelector('.roadahead')?.textContent ?? '')).replace(/\s+/g, ' ');
if (!/ROAD REPORT/.test(ahead) || !/Congestion/.test(ahead)) problems.push(`the M6 report ahead is not listed: ${ahead.slice(0, 400)}`);
if (!/MOTORWAY CAMERAS AHEAD/.test(ahead)) problems.push(`no motorway cameras ahead: ${ahead.slice(0, 400)}`);
const follow = await page.evaluate(() => typeof window.__ghosty.globe.cam.follow === 'function');
if (!follow) problems.push('the globe is not following the owner');
await page.evaluate(() => { const r = [...document.querySelectorAll('.roadahead .camlist .rw.link')][0]; r?.click(); });
await page.waitForSelector('.roadahead .camlist .camview img', { timeout: 10000 }).catch(() => problems.push('tapping a camera ahead did not open its picture'));
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/phone-roadahead.png` });
await page.evaluate(() => window.__ghosty.run('road_ahead', { on: false }));
await page.waitForSelector('.roadahead', { state: 'hidden', timeout: 5000 }).catch(() => problems.push('ROAD AHEAD did not stop'));
const stopped = await page.evaluate(() => window.__ghosty.globe.cam.follow === null);
if (!stopped) problems.push('the globe kept following after STOP');

await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : `West Midlands run clean on an iPhone 13: ${nhCount} motorway cameras counted and one opened from chat with its Crown copyright credit; 2 road incidents and 3 vehicles drawn; safety-camera sites loaded; ROAD AHEAD followed the phone heading east and listed the report, the cameras ahead (one opened by a tap) and stopped cleanly.`);
process.exit(problems.length ? 1 : 0);
