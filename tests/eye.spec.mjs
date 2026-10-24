// God's Eye at the owner's 440 × 956 (the upgrade pass, 24 Oct): every upstream feed is faked (no internet), so the
// aircraft feed fails as it does when adsb.lol turns Ghosty away. Checked: plain names for the sensor looks and 44 pt
// LOOK chips; a low aurora a faint glow (not a white ring); layer tiles in plain words (no STALE / IDLE / SYNC / NO FEED / KEY NEEDED); LIVE TRAFFIC without the
// TomTom key says where the free key goes; the readout counts in words; floating names never drawn through the bar or
// the search; a tapped spot's card never sits under the CCTV grid; layer choices kept after a reload; one toast for a
// search that finds nothing, and the truth when offline.
//   BASE=http://localhost:8788 node tests/eye.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';
import { mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const problems = [];

/** A real PNG (camera frames): solid RGBA. */
function png(w, h, [r, g, b, a]) {
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const x of buf) c = table[(c ^ x) & 255] ^ (c >>> 8);
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
const IMG = png(64, 48, [40, 200, 160, 255]);
const tfl = (id, name, lat, lon) => ({ id, commonName: name, lat, lon, additionalProperties: [{ key: 'available', value: 'true' }, { key: 'imageUrl', value: `https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/${id.slice(8)}.jpg` }] });
// A low aurora chance over the whole auroral zone (10 %), the common case: it must stay a faint green, not a white ring.
const auroraCells = [];
for (let lat = 58; lat <= 75; lat++) for (let lon = 0; lon < 360; lon++) auroraCells.push([lon, lat, 10]);
const FIXTURES = [
  [/api\.tfl\.gov\.uk/, [tfl('JamCams_00001.01251', 'Trafalgar Sq / Strand', 51.5077, -0.1277), tfl('JamCams_00001.02000', 'Tower Bridge Rd', 51.5005, -0.0754)]],
  [/nominatim\.openstreetmap\.org/, []],
  [/ovation_aurora/, { 'Forecast Time': new Date().toISOString(), coordinates: auroraCells }],
];

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: PHONE, ...UK, hasTouch: true, isMobile: true });
await ctx.route('**/api/proxy?**', (route) => {
  const target = new URL(route.request().url()).searchParams.get('url') ?? '';
  if (/\.(jpg|jpeg)$/.test(target)) return route.fulfill({ status: 200, headers: { 'content-type': 'image/png' }, body: IMG });
  const hit = FIXTURES.find(([re]) => re.test(target));
  if (!hit) return route.fulfill({ status: 404, body: '' }); // never the real internet: the aircraft feed fails here
  return route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(hit[1]) });
});
await ctx.route('**/api/ships?**', (route) => route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: '{"ships":[]}' }));
await ctx.route(/^https:\/\/(?!localhost)/, (route) => route.fulfill({ status: 404, body: '' }));

const page = await ctx.newPage();
page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#pair input', { timeout: 15000 });
await page.fill('#pair input', 'preview-owner-key-0123456789');
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
const openEye = async () => {
  await page.evaluate(() => (location.hash = 'eye'));
  await page.waitForSelector('#pg-eye .eyebot .btns', { timeout: 15000 });
  await page.waitForTimeout(2500);
};
await openEye();
const settle = async (ms = 1500) => {
  await page.waitForFunction(() => !window.__ghosty.globe.cam.fly, null, { timeout: 120000 }).catch(() => problems.push('a flight never finished'));
  await page.waitForTimeout(ms);
};
const toasts = () => page.evaluate(() => [...document.querySelectorAll('#toasts > *')].map((t) => t.textContent ?? ''));
const JARGON = /\b(STALE|IDLE|SYNC|NO FEED|KEY NEEDED)\b/i;

// ---- the aurora at a 10 % chance from the opening view: a faint green glow, not a white ring over the north
/** Near-white pixels in the upper globe (an RGB PNG of the screen, counted in the page: no image library here). */
const white = async () => {
  const src = (await page.screenshot({ clip: { x: 0, y: 110, width: 440, height: 400 } })).toString('base64');
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 225 && d[i + 1] > 225 && d[i + 2] > 225) n++;
    return n;
  }, src);
};
await page.evaluate(() => (window.__ghosty.globe.cam.autoSpin = false));
const auroraIn = await page.waitForFunction(() => /AURORA\s*10%/.test(document.querySelector('#pg-eye .eyelay')?.textContent ?? ''), null, { timeout: 30000 }).then(() => true, () => false);
if (!auroraIn) problems.push('the aurora forecast (faked) never loaded');
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/eye-aurora.png` });
const withAurora = await white();
await page.evaluate(() => window.__ghosty.run('set_layer', { layer: 'aurora', on: false }));
await page.waitForTimeout(1500);
const without = await white();
await page.evaluate(() => window.__ghosty.run('set_layer', { layer: 'aurora', on: true }));
console.log(`aurora: ${withAurora - without} near-white pixels added (${withAurora} with it, ${without} without)`);
if (withAurora - without > 400) problems.push(`a 10 % aurora draws a white ring: ${withAurora - without} near-white pixels added`);

// ---- the LOOK menu: the sensor looks in plain words, every chip a 44 pt target
await page.click('#pg-eye .eyebot button:has-text("LOOK")');
await page.waitForTimeout(500);
const look = await page.evaluate(() => ({
  modes: [...document.querySelectorAll('#pg-eye .lookmenu .modes button')].map((b) => b.textContent.trim()),
  small: [...document.querySelectorAll('#pg-eye .lookmenu button')].map((b) => [b.textContent.trim(), b.getBoundingClientRect()]).filter(([, r]) => r.height < 44 || r.width < 44).map(([t, r]) => `${t} ${Math.round(r.width)}×${Math.round(r.height)}`),
}));
if (look.modes.some((m) => /^(CRT|NVG|FLIR|HOLO)$/i.test(m)) || !look.modes.some((m) => /^night vision$/i.test(m)) || !look.modes.some((m) => /^thermal$/i.test(m))) problems.push(`the sensor looks are named in code: ${look.modes.join(', ')}`);
if (look.small.length) problems.push(`LOOK chips under 44 pt: ${look.small.join(', ')}`);
await page.screenshot({ path: `${out}/eye-look.png` });
await page.click('#pg-eye .eyebot button:has-text("LOOK")');

// ---- the layers sheet: plain words while the aircraft feed is failing; LIVE TRAFFIC says where its free key goes
await page.waitForFunction(() => /NO FEED|NOT REACHABLE/.test(document.querySelector('#pg-eye .eyelay')?.textContent ?? ''), null, { timeout: 30000 }).catch(() => undefined);
await page.click('#pg-eye .eyelay > h3');
await page.waitForTimeout(600);
// each tile's line and the sheet's own status, one by one (the sheet's whole text runs words together)
const sheet = (await page.$$eval('#pg-eye .eyelay .ltile, #pg-eye .eyelay > h3', (els) => els.map((e) => [...e.children].map((c) => c.textContent.trim()).join(' ')))).join(' | ');
if (JARGON.test(sheet)) problems.push(`the layers sheet speaks in feed states: ${sheet.match(new RegExp(`.{0,40}${JARGON.source}.{0,10}`, 'i'))?.[0]}`);
await page.screenshot({ path: `${out}/eye-layers.png` });
const tile = page.locator('#pg-eye .eyelay .ltile', { hasText: 'LIVE TRAFFIC' });
for (let i = 0; i < 2; i++) {
  await tile.click();
  await page.waitForTimeout(300);
}
const keyWords = (await toasts()).join(' | ');
if (!(await page.evaluate(() => window.__ghosty.globe.vis.traffic)) || !/TomTom/.test(keyWords) || !/SYSTEM/.test(keyWords)) problems.push(`LIVE TRAFFIC without the key did not say where the free key goes: "${keyWords}"`);
await page.click('#pg-eye .eyelay > h3');
await page.waitForTimeout(400);

// ---- the readout: counts in words, not AC / CAM / SAT / EQ
const r3 = (await page.textContent('#pg-eye .readout .r3')) ?? '';
if (/\b(AC|CAM|SAT|EQ|SHIP)\b/.test(r3) || !/\d cameras\b/i.test(r3)) problems.push(`the readout's counts are code words: "${r3}"`);

// ---- floating names stay off the bar, the readout and the search
await page.evaluate(() => window.__ghosty.globe.cam.flyTo({ lat: 50, lon: 2, range: 2600, tilt: 0, hd: 0 }));
await settle(2500);
const labels = await page.evaluate(() => {
  // the open sky between the search (and its chips) and the bar: below the bar's top are the bar and the tab bar
  const top = document.querySelector('#pg-eye .eyetop').getBoundingClientRect().bottom;
  const bottom = document.querySelector('#pg-eye .eyebot').getBoundingClientRect().top;
  const shown = [...document.querySelectorAll('#pg-eye .labels .lb')].filter((e) => e.style.display !== 'none' && e.textContent);
  const at = (e) => { const m = e.style.transform.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/); return m ? [Number(m[1]), Number(m[2])] : null; };
  const under = shown.filter((e) => { const p = at(e); return p && (p[1] < top || p[1] > bottom); }).map((e) => e.textContent);
  return { n: shown.length, under };
});
if (!labels.n) problems.push('no floating names at 2,600 km over France (cities)');
if (labels.under.length) problems.push(`floating names drawn through the bar, the tab bar or the search: ${labels.under.slice(0, 8).join(', ')}`);
await page.screenshot({ path: `${out}/eye-labels.png` });

// ---- a tapped spot near the London cameras: the card, and no CCTV grid over it
await page.evaluate(() => window.__ghosty.globe.cam.flyTo({ lat: 51.53, lon: -0.2, range: 3, tilt: 0, hd: 0 }));
await settle(2500);
const grid = await page.waitForFunction(() => document.querySelectorAll('#pg-eye .camgrid:not([hidden]) .camview').length > 0, null, { timeout: 30000 }).then(() => true, () => false);
if (!grid) problems.push('the CCTV grid did not show near the London cameras');
await page.touchscreen.tap(330, 520);
// the page's once-a-second loop paints the grid; software GL on a busy runner can draw under 1 frame a second
await page.waitForFunction(() => !document.querySelector('#pg-eye .eyeinfo')?.hidden && document.querySelector('#pg-eye .camgrid').hidden, null, { timeout: 20000 }).catch(() => undefined);
const card = await page.evaluate(() => {
  const info = document.querySelector('#pg-eye .eyeinfo');
  const ask = [...(info?.querySelectorAll('button') ?? [])].find((b) => /ASK GHOSTY/i.test(b.textContent));
  const r = ask?.getBoundingClientRect();
  const top = r ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
  return { open: !!info && !info.hidden, spot: /TAPPED/i.test(info?.textContent ?? ''), gridShown: !document.querySelector('#pg-eye .camgrid').hidden, askReachable: !!(ask && top && ask.contains(top)) };
});
if (!card.open || !card.spot) problems.push(`a tap on the ground did not open the spot card: ${JSON.stringify(card)}`);
else if (card.gridShown || !card.askReachable) problems.push(`the spot card sits under the CCTV grid: ${JSON.stringify(card)}`);
await page.screenshot({ path: `${out}/eye-spot.png` });
await page.locator('#pg-eye .eyeinfo button', { hasText: '✕' }).click();

// ---- layer choices are kept: Radar off, reload, still off
await page.click('#pg-eye .eyechips button[data-layer="radar"]');
await page.waitForTimeout(1500);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
await openEye();
const kept = await page.evaluate(() => ({ vis: window.__ghosty.globe.vis.radar, chip: document.querySelector('#pg-eye .eyechips button[data-layer="radar"]')?.getAttribute('aria-pressed') }));
if (kept.vis !== false || kept.chip !== 'false') problems.push(`Radar turned off came back on after a reload: ${JSON.stringify(kept)}`);
await page.click('#pg-eye .eyechips button[data-layer="radar"]');

// ---- a search that finds nothing: one toast; offline: says so
await page.fill('#pg-eye .search input', 'zzqxqzz');
await page.keyboard.press('Enter');
await page.waitForTimeout(3000);
const miss = (await toasts()).filter((t) => t.includes('zzqxqzz'));
if (miss.length !== 1) problems.push(`a search that finds nothing showed ${miss.length} toasts: ${miss.join(' | ')}`);
await ctx.setOffline(true);
await page.fill('#pg-eye .search input', 'Little Snoring');
await page.keyboard.press('Enter');
await page.waitForTimeout(3000);
const off = (await toasts()).filter((t) => t.includes('Little Snoring'));
if (off.length !== 1 || !/offline/i.test(off[0] ?? '')) problems.push(`offline, a search said: ${off.join(' | ') || 'nothing'}`);
await page.waitForFunction(() => /offline/i.test(document.querySelector('#pg-eye .readout .r3')?.textContent ?? ''), null, { timeout: 20000 }).catch(() => undefined);
const r3off = (await page.textContent('#pg-eye .readout .r3')) ?? '';
if (!/offline/i.test(r3off)) problems.push(`offline, the readout's counts still read as live: "${r3off}"`);
await page.screenshot({ path: `${out}/eye-offline.png` });
await ctx.setOffline(false);

await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'God\'s Eye run clean: plain words, 44 pt LOOK chips, names off the bar, the spot card clear of the grid, layers kept, honest search.');
process.exit(problems.length ? 1 : 0);
