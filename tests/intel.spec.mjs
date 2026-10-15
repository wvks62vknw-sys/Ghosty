// GOD'S EYE intelligence layers: extra camera networks, ships, radar, alerts, disasters, aurora, dispatch,
// buoys and cables. Every upstream feed is replaced with a small fixture so the run is
// deterministic; the brain's own /api/ships answer is faked too.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const problems = [];

/** A real PNG (needed for createImageBitmap): solid RGBA. */
function png(w, h, [r, g, b, a]) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const x of buf) c = crcTable[(c ^ x) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
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
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set([r, g, b, a], y * (w * 4 + 1) + 1 + x * 4);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const sq = (lat, lon, d) => [[lon, lat], [lon + d, lat], [lon + d, lat + d], [lon, lat + d], [lon, lat]];
const FIXTURES = [
  [/api\.tfl\.gov\.uk/, [
    { id: 'JamCams_00001.01251', commonName: 'Trafalgar Sq / Strand', lat: 51.5077, lon: -0.1277, additionalProperties: [
      { key: 'available', value: 'true' },
      { key: 'imageUrl', value: 'https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.01251.jpg' },
      { key: 'videoUrl', value: 'https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.01251.mp4' } ] },
    { id: 'JamCams_00001.02000', commonName: 'Tower Bridge Rd', lat: 51.5005, lon: -0.0754, additionalProperties: [
      { key: 'available', value: 'true' },
      { key: 'imageUrl', value: 'https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.02000.jpg' } ] },
  ]],
  [/cwwp2\.dot\.ca\.gov\/data\/d4\//, { data: [{ cctv: { inService: 'true', location: { latitude: '37.80', longitude: '-122.37', locationName: 'TV1 -- Bay Bridge', nearbyPlace: 'SF' }, imageData: { static: { currentImageURL: 'https://cwwp2.dot.ca.gov/data/d4/cctv/image/tv1/tv1.jpg' } } } }] }],
  [/cwwp2\.dot\.ca\.gov/, { data: [] }],
  [/511on\.ca/, [{ Id: 1, Latitude: 43.64, Longitude: -79.38, Roadway: 'Gardiner', Location: 'at York', Views: [{ Url: 'https://511on.ca/map/Cctv/1', Status: 'Enabled' }] }]],
  [/tie\.digitraffic\.fi/, { features: [{ geometry: { coordinates: [24.94, 60.17] }, properties: { id: 'C01', name: 'Helsinki', collectionStatus: 'GATHERING', presets: [{ id: 'C0150200' }] } }] }],
  [/webcams\.nyctmc\.org/, []],
  [/drivebc/, []],
  [/livetraffic/, { features: [] }],
  [/calgary/, []],
  [/meri\.digitraffic\.fi\/api\/ais\/v1\/locations/, { features: [
    { geometry: { coordinates: [24.95, 60.15] }, properties: { mmsi: 230000001, sog: 14, cog: 200, heading: 200, navStat: 0, timestampExternal: now - 30000 } },
    { geometry: { coordinates: [24.98, 60.14] }, properties: { mmsi: 230000002, sog: 0, cog: 0, heading: 511, navStat: 5, timestampExternal: now - 30000 } },
  ] }],
  [/meri\.digitraffic\.fi\/api\/ais\/v1\/vessels/, [{ mmsi: 230000001, name: 'VIKING GRACE', shipType: 60, destination: 'TURKU' }, { mmsi: 230000002, name: 'BALTIC TANKER', shipType: 80 }]],
  [/api\.weather\.gov/, { features: [{ geometry: { type: 'Polygon', coordinates: [sq(35, -98, 1.5)] }, properties: { id: 'nws1', event: 'Tornado Warning', severity: 'Extreme', headline: 'Tornado Warning until 7 PM', areaDesc: 'Test County, OK', ends: iso(now + 3600_000) } }] }],
  [/gdacs/, { features: [{ geometry: { type: 'Point', coordinates: [131, 21] }, properties: { eventtype: 'TC', eventid: 99, name: 'TYPHOON TEST', alertlevel: 'Red', country: 'Philippines', fromdate: iso(now - 86400_000), url: { report: 'https://www.gdacs.org/report' } } }] }],
  [/ndbc/, `#STN LAT LON YYYY MM DD hh mm WDIR WSPD GST WVHT DPD APD MWD PRES PTDY ATMP WTMP DEWP VIS TIDE\n#text\n41001 34.79 -72.50 2026 10 15 04 50 200 8.0 10.0 6.4 9 MM MM 1016.2 MM 22.1 25.3 MM MM MM\n`],
  [/ovation_aurora/, { 'Forecast Time': iso(now), coordinates: Array.from({ length: 360 }, (_, i) => [i, 66, 50]) }],
  [/submarinecablemap/, { features: [{ properties: { id: 'marea', name: 'MAREA', color: '#e8a33c' }, geometry: { type: 'MultiLineString', coordinates: [[[-76, 36.8], [-40, 40], [-3, 43.3]]] } }] }],
  [/data\.seattle\.gov/, [{ incident_number: 'F26000001', type: 'Aid Response', address: '400 Broad St', datetime: new Date(now - 7 * 3600_000 - 600_000).toISOString().replace('Z', ''), latitude: '47.6205', longitude: '-122.3493' }]],
  [/api\.rainviewer\.com/, { host: 'https://tilecache.rainviewer.com', radar: { past: [{ time: Math.floor(now / 1000) - 300, path: '/v2/radar/test' }] } }],
];
const IMG = png(64, 48, [40, 200, 160, 255]);
const RADAR = png(256, 256, [60, 120, 255, 150]);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const asked = new Set();
await ctx.route('**/api/proxy?**', (route) => {
  const target = new URL(route.request().url()).searchParams.get('url') ?? '';
  if (/tilecache\.rainviewer\.com/.test(target)) {
    asked.add('radar-tile');
    return route.fulfill({ status: 200, headers: { 'content-type': 'image/png' }, body: RADAR });
  }
  if (/\.(jpg|jpeg)$|\/map\/Cctv\//.test(target)) {
    asked.add('cam-frame');
    return route.fulfill({ status: 200, headers: { 'content-type': 'image/png' }, body: IMG });
  }
  const hit = FIXTURES.find(([re]) => re.test(target));
  if (!hit) return route.fulfill({ status: 404, body: '' }); // never reach the real internet
  asked.add(String(hit[0]));
  const body = typeof hit[1] === 'string' ? hit[1] : JSON.stringify(hit[1]);
  return route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body });
});
await ctx.route('**/api/ships?**', (route) => route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ships: [{ mmsi: 235000001, name: 'THAMES CLIPPER', lat: 51.505, lon: -0.09, sog: 20, cog: 90, hdg: 90, type: 40, dest: 'WOOLWICH', nav: 0, t: now, src: 'AISstream' }] }) }));
await ctx.route('https://s3-eu-west-1.amazonaws.com/**', (route) => route.fulfill({ status: 404, body: '' }));

// OpenStreetMap (Overpass): enforcement cameras around London and Birmingham; nothing for 3D buildings.
const OSM = { elements: [
  { type: 'node', id: 11, lat: 51.502, lon: -0.11, tags: { man_made: 'surveillance', 'surveillance:type': 'ALPR', operator: 'Transport for London' } },
  { type: 'node', id: 12, lat: 51.51, lon: -0.09, tags: { highway: 'speed_camera', maxspeed: '20 mph' } },
  { type: 'node', id: 21, lat: 52.4797, lon: -1.9026, tags: { man_made: 'surveillance', 'surveillance:type': 'ALPR', operator: 'Birmingham City Council', description: 'Clean Air Zone ANPR' } },
  { type: 'node', id: 22, lat: 52.47, lon: -1.88, tags: { highway: 'speed_camera', maxspeed: '30 mph' } },
  { type: 'relation', id: 23, center: { lat: 52.49, lon: -1.92 }, tags: { type: 'enforcement', enforcement: 'traffic_signals' } },
] };
for (const mirror of ['https://overpass-api.de/**', 'https://overpass.kumi.systems/**']) {
  await ctx.route(mirror, (route) => {
    const q = decodeURIComponent(route.request().postData() ?? '');
    asked.add(q.includes('surveillance') ? 'osm-cams' : 'osm-other');
    route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify(q.includes('surveillance') ? OSM : { elements: [] }) });
  });
}
const page = await ctx.newPage();
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && /shader|WebGL|GL_|intel|TypeError/.test(m.text()) && problems.push(`console: ${m.text()}`));
await page.goto(base);
await page.fill('#pair input', 'preview-owner-key-0123456789');
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
await page.evaluate(() => window.__ghosty.run('open_tab', { tab: 'eye' }));
await page.evaluate(() => window.__ghosty.run('set_layer', { layer: 'cables', on: true }));
await page.evaluate(() => window.__ghosty.run('set_layer', { layer: 'buoys', on: true }));
const settle = async (ms = 5000) => {
  await page.waitForFunction(() => !window.__ghosty.globe.cam.fly, null, { timeout: 90000 }).catch(() => problems.push('flight never finished'));
  await page.waitForTimeout(ms);
};
await settle(6000);
const layerText = async () => (await page.evaluate(() => document.querySelector('.eyelay')?.textContent ?? '')).replace(/\s+/g, ' ');
// Each feed loads in the background: wait (up to 25 s) for its count to appear.
const waitLayer = async (re) => page.waitForFunction((src) => new RegExp(src).test((document.querySelector('.eyelay')?.textContent ?? '').replace(/\s+/g, ' ')), re.source, { timeout: 25000 }).then(() => true, () => false);
let lt = await layerText();
for (const [label, re] of [
  ['cameras (TfL 2 + Fintraffic + Ontario)', /CCTV CAMERAS\s*4(?!\d)/],
  ['alerts', /WEATHER ALERTS\s*1/],
  ['disasters', /DISASTERS\s*1/],
  ['dispatch', /911 SEATTLE\s*1/],
  ['buoys', /OCEAN BUOYS\s*1/],
  ['cables', /UNDERSEA CABLES\s*1/],
  ['aurora', /AURORA\s*50%/],
]) if (!(await waitLayer(re))) problems.push(`${label} layer not loaded: ${(await layerText()).slice(0, 400)} vis=${JSON.stringify(await page.evaluate(() => ({ b: window.__ghosty.globe.vis.buoys, c: window.__ghosty.globe.vis.cables })))}`);
await page.screenshot({ path: `${out}/intel-globe.png` });

// London: ships from the brain, radar tiles, a camera with a live frame.
await page.evaluate(() => window.__ghosty.run('fly_to', { lat: 51.5, lon: -0.1, range_km: 120 }));
await settle(9000);
lt = await layerText();
if (!/SHIPS \(AIS\)\s*[1-9]/.test(lt)) problems.push(`no ships near London: ${lt.slice(0, 300)}`);
if (!asked.has('radar-tile')) problems.push('no radar tiles requested');
await page.waitForFunction(() => /ANPR \/ SPEED\s*\d+ ANPR/.test(document.querySelector('.eyelay')?.textContent ?? ''), null, { timeout: 25000 }).catch(() => problems.push(`ANPR layer not loaded near London: ${asked.has('osm-cams')}`));
await page.screenshot({ path: `${out}/intel-london.png` });

// Birmingham: no open live feed, so Ghosty shows the mapped ANPR / speed / red-light cameras.
await page.evaluate(() => window.__ghosty.run('show_cameras', { place: 'Birmingham' }));
await page.waitForFunction(() => /mapped ANPR, speed and red-light cameras/.test(document.body.textContent ?? ''), null, { timeout: 45000 }).catch(() => problems.push('Birmingham fallback toast never appeared'));
await page.waitForTimeout(3000);
const bhm = await page.evaluate(() => document.querySelector('.eyelay')?.textContent?.replace(/\s+/g, ' ') ?? '');
if (!/ANPR \/ SPEED\s*2 ANPR · 3/.test(bhm)) problems.push(`Birmingham cameras not counted: ${bhm.slice(0, 300)}`);
await page.evaluate(() => window.__ghosty.run('set_layer', { layer: 'radar', on: false }));
await page.evaluate(() => window.__ghosty.globe.cam.flyTo({ lat: 52.48, lon: -1.9, range: 14, tilt: 0 }));
await settle(2500);
await page.screenshot({ path: `${out}/intel-birmingham.png` });
await page.evaluate(() => window.__ghosty.run('set_layer', { layer: 'radar', on: true }));

// Baltic: keyless Digitraffic ships, searchable by name.
await page.evaluate(() => window.__ghosty.run('fly_to', { lat: 60.15, lon: 24.95, range_km: 60 }));
await settle(4000);
await page.evaluate(() => { document.querySelector('.eye .search input').value = 'VIKING GRACE'; document.querySelector('.eye .search button').click(); });
await page.waitForTimeout(2500);
const shipCard = (await page.evaluate(() => document.querySelector('.eyeinfo')?.textContent ?? '')).replace(/\s+/g, ' ');
if (!/VIKING GRACE/.test(shipCard) || !/PASSENGER/.test(shipCard) || !/TURKU/.test(shipCard)) problems.push(`ship card wrong: ${shipCard.slice(0, 200)}`);
await settle(1500);
await page.screenshot({ path: `${out}/intel-ship.png` });

const readout = await page.evaluate(() => document.querySelector('.readout')?.textContent ?? '');
if (!/\d+ SHIP/.test(readout) || !/4 CAM/.test(readout)) problems.push(`readout missing counts: ${readout}`);
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : `Intel layers run clean (${asked.size} feeds answered).`);
process.exit(problems.length ? 1 : 0);
