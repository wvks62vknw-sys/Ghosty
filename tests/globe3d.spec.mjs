// Satellite imagery and 3D buildings on the globe. The imagery and Overpass services are
// replaced with test tiles (labelled z/x/y) and a few fake buildings near Trafalgar Square.
import { launch, webkitNoise } from './browser.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const problems = [];
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
let tiles = 0;
await ctx.route('https://server.arcgisonline.com/**', (route) => {
  tiles++;
  const m = route.request().url().match(/tile\/(\d+)\/(\d+)\/(\d+)/);
  const [z, y, x] = m ? [m[1], m[2], m[3]] : ['?', '?', '?'];
  const hue = (Number(x) * 47 + Number(y) * 91) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="hsl(${hue},45%,32%)"/><rect x="2" y="2" width="252" height="252" fill="none" stroke="#fff" stroke-width="3"/><text x="128" y="138" font-size="26" fill="#fff" text-anchor="middle" font-family="monospace">${z}/${x}/${y}</text></svg>`;
  route.fulfill({ status: 200, headers: { 'content-type': 'image/svg+xml', 'access-control-allow-origin': '*' }, body: svg });
});
await ctx.route('https://overpass-api.de/**', (route) => {
  const box = (lat, lon, dlat, dlon) => [[lat, lon], [lat, lon + dlon], [lat + dlat, lon + dlon], [lat + dlat, lon], [lat, lon]].map(([a, b]) => ({ lat: a, lon: b }));
  const elements = [
    { type: 'way', tags: { building: 'yes', height: '60' }, geometry: box(51.5078, -0.1290, 0.0006, 0.0010) },
    { type: 'way', tags: { building: 'yes', 'building:levels': '8' }, geometry: box(51.5068, -0.1270, 0.0005, 0.0008) },
    { type: 'way', tags: { building: 'house' }, geometry: box(51.5085, -0.1265, 0.0002, 0.0003) },
    // an L-shaped (concave) footprint, clockwise
    { type: 'way', tags: { building: 'yes', height: '25' }, geometry: [[51.5060, -0.1300], [51.5066, -0.1300], [51.5066, -0.1296], [51.5063, -0.1296], [51.5063, -0.1290], [51.5060, -0.1290], [51.5060, -0.1300]].map(([a, b]) => ({ lat: a, lon: b })) },
  ];
  route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify({ elements }) });
});
const page = await ctx.newPage();
page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && /shader|WebGL|GL_/.test(m.text()) && problems.push(`console: ${m.text()}`));
await page.goto(base);
await page.fill('#pair input', 'preview-owner-key-0123456789');
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
const settle = async () => {
  await page.waitForFunction(() => !window.__ghosty.globe.cam.fly, null, { timeout: 90000 }).catch(() => problems.push('flight never finished'));
  await page.waitForTimeout(6000);
};
// regional view: imagery fades in
await page.evaluate(() => window.__ghosty.run('fly_to', { lat: 51.5, lon: -0.12, range_km: 900 }));
await settle();
await page.screenshot({ path: `${out}/globe-imagery-region.png` });
// street level with tilt: imagery + buildings
await page.evaluate(() => window.__ghosty.globe.cam.flyTo({ lat: 51.5074, lon: -0.1280, range: 1.4, tilt: 55, hd: 20 }));
await settle();
await page.waitForTimeout(4000);
const readout = await page.evaluate(() => document.querySelector('.readout')?.textContent ?? '');
const layerText = await page.evaluate(() => document.querySelector('.eyelay')?.textContent ?? '');
await page.screenshot({ path: `${out}/globe-buildings.png` });
if (!tiles) problems.push('no imagery tiles requested');
if (!/Imagery ©/.test(readout)) problems.push(`imagery credit missing from readout: ${readout}`);
if (!/3D BUILDINGS\s*4/.test(layerText)) problems.push(`buildings not loaded: ${layerText.replace(/\s+/g, ' ').slice(0, 200)}`);
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : `Globe 3D run clean (${tiles} tiles).`);
process.exit(problems.length ? 1 : 0);
