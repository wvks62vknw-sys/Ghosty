// The THREATS tab on the owner's iPhone 18 Pro Max (440 × 956) and once at 1280 × 800, with every feed it reads
// stood in (USGS quakes, NASA EONET events, NOAA's Kp file in its current shape, Launch Library 2) and the RECON
// report from tests/fixtures/threats-recon.json (example.com, a real run):
//  - feeds that cannot be reached are never an all-clear: no green "Clear", no "none in 48h";
//  - "live" signals are live: an EONET event not updated for weeks is not counted;
//  - Space weather reads NOAA's Kp file; the launch window lists launches with their pads, in plain words;
//  - every row says when; distances in plain kilometres; NEAR YOU says where it measures from and its tiles open God's Eye;
//  - the RECON report flows with the page (no box scrolling inside the page), opens with WHAT STANDS OUT in
//    plain words, says a null MX as "takes no email", keeps DNS names in their own case, and its errors are plain.
import { launch } from './browser.mjs';
import { PHONE, UK, openSection } from './nav.mjs';
import { mkdirSync, readFileSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const problems = [];
const RECON = readFileSync(new URL('./fixtures/threats-recon.json', import.meta.url), 'utf8');

const now = Date.now();
const H = 3_600_000;
const D = 24 * H;
const iso = (t) => new Date(t).toISOString();
const quake = (id, mag, place, ago, lat, lon) => ({ id, properties: { mag, place, time: now - ago, url: `https://earthquake.usgs.gov/${id}`, tsunami: 0, alert: null }, geometry: { coordinates: [lon, lat, 10] } });
const event = (id, title, cat, catTitle, ago, lat, lon) => ({ id, title, link: `https://eonet.gsfc.nasa.gov/${id}`, categories: [{ id: cat, title: catTitle }], geometry: [{ type: 'Point', date: iso(now - ago), coordinates: [lon, lat] }] });
const FEEDS = {
  'earthquake.usgs.gov': { features: [quake('q1', 6.3, '170 km NW of Port-Olry, Vanuatu', 3 * H, -14.5, 166.2), quake('q2', 4.8, 'North Sea', 5 * H, 54.1, 2.6), quake('q3', 5.1, 'Kermadec Islands', 9 * H, -30, -178)] },
  'eonet.gsfc.nasa.gov': {
    events: [
      event('e1', 'Hurricane Testa', 'severeStorms', 'Severe Storms', 1 * D, 18, -60),
      event('e2', 'Fresh Fire, Portugal', 'wildfires', 'Wildfires', 3 * D, 40, -8),
      event('e3', 'Old Fire Last Seen In August', 'wildfires', 'Wildfires', 60 * D, 45, -120),
      event('e4', 'Iceberg A99', 'seaLakeIce', 'Sea and Lake Ice', 20 * D, -70, -40),
    ],
  },
  // NOAA's planetary Kp file as it is served now: objects, newest last
  'services.swpc.noaa.gov': [{ time_tag: iso(now - 6 * H).slice(0, 19), Kp: 2.0, a_running: 7, station_count: 8 }, { time_tag: iso(now - 3 * H).slice(0, 19), Kp: 3.33, a_running: 18, station_count: 8 }],
  'll.thespacedevs.com': {
    count: 2,
    results: [
      { id: 'l1', name: 'Falcon 9 Block 5 | Starlink Group 15-15', net: iso(now - 10 * H), status: { abbrev: 'Success' }, pad: { name: 'Space Launch Complex 4E', latitude: '34.632', longitude: '-120.611' }, launch_service_provider: { name: 'SpaceX' } },
      { id: 'l2', name: 'Electron | The Sea God Surveys', net: iso(now + 4 * D), status: { abbrev: 'TBD' }, pad: { name: 'Launch Complex 1', latitude: '-39.26', longitude: '177.86' }, launch_service_provider: { name: 'Rocket Lab' } },
    ],
  },
};
const feedFor = (u) => {
  const target = new URL(new URL(u).searchParams.get('url') ?? 'about:blank');
  return FEEDS[target.hostname];
};

async function open(viewport, { feeds }) {
  const ctx = await browser.newContext({ viewport, ...UK });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`[${viewport.width}] pageerror: ${e.message}`));
  // Every public feed goes through the brain's proxy: stand them in (or cut them all, for the down case).
  await page.route('**/api/proxy?**', (r) => {
    const body = feeds ? feedFor(r.request().url()) : null;
    return body ? r.fulfill({ contentType: 'application/json', body: JSON.stringify(body) }) : r.abort();
  });
  await page.goto(base);
  await page.fill('#pair input', 'preview-owner-key-0123456789');
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
  await page.evaluate(() => (location.hash = 'threats'));
  // (attached: on the phone RECON is under the Launches pill, one section drawn at a time, ui/sections.ts)
  await page.waitForSelector('#pg-threats .pn.recon', { state: 'attached', timeout: 10000 });
  return { ctx, page };
}

// The tab's one-line blurb (the Plan area's tiles, the deck's search) promises only what the tab shows: it has no cyber feed.
const tabSource = readFileSync(new URL('../apps/web/src/features/threats/index.ts', import.meta.url), 'utf8');
if (/blurb: '[^']*cyber/i.test(tabSource)) problems.push('the tab\'s blurb promises "cyber alerts", which the tab does not show');

const text = (page, sel) => page.locator(sel).first().innerText().catch(() => '');

// ---- 1. every feed down from the start: not an all-clear ----
{
  const { ctx, page } = await open(PHONE, { feeds: false });
  await page.waitForFunction(() => document.querySelector('#pg-threats .pn.signals .empty.bad'), null, { timeout: 30000 }).catch(() => problems.push('[down] the signals list never said its feed is unreachable'));
  const big = await text(page, '#pg-threats .bigv');
  const sub = await text(page, '#pg-threats .hero .sub');
  if (/clear/i.test(big)) problems.push(`[down] the feeds are unreachable but the level reads "${big}"`);
  if (!/can.t reach/i.test(sub)) problems.push(`[down] the line under the level does not say the feeds cannot be reached: "${sub}"`);
  await openSection(page, 'threats', 'Near you');
  const near = await text(page, '#pg-threats .pn.near');
  if (/none in 48h|\bnone\b/i.test(near)) problems.push(`[down] NEAR YOU says "none" without a feed: ${near.replace(/\s+/g, ' ')}`);
  await page.screenshot({ path: `${out}/threats-440-down.png` });
  await ctx.close();
}

// ---- 2. the feeds stood in, on the phone ----
{
  const { ctx, page } = await open(PHONE, { feeds: true });
  await page.waitForFunction(() => /live signal/.test(document.querySelector('#pg-threats .hero .sub')?.textContent ?? '') && document.querySelectorAll('#pg-threats .pn.launches .rw, #pg-threats .pn.launches .empty.bad').length, null, { timeout: 30000 }).catch(() => undefined);
  await page.waitForTimeout(800);
  const sub = await text(page, '#pg-threats .hero .sub');
  // three quakes of 4.5 or more, the storm and the fresh fire; not the fire last seen 60 days ago, nor the iceberg of 20 days
  if (!/^5 live signals/.test(sub)) problems.push(`[440] the live count includes events not updated for weeks: "${sub}"`);
  const list = await text(page, '#pg-threats .pn.signals');
  if (/Old Fire Last Seen/.test(list)) problems.push('[440] a wildfire last updated 60 days ago is listed as a live signal');
  const tags = await page.$$eval('#pg-threats .pn.signals .rw .n', (els) => els.map((e) => e.textContent.trim()));
  if (!tags.length || tags.some((t) => !/ago$|^now$/i.test(t))) problems.push(`[440] every signal should say when (quakes said their magnitude twice): ${tags.join(' | ')}`);
  // space weather: NOAA's Kp file as served now
  await openSection(page, 'threats', 'Space weather');
  const sw = await text(page, '#pg-threats .pn.spacewx');
  if (!/3\.3/.test(sw) || (await page.locator('#pg-threats .pn.spacewx .empty').count())) problems.push(`[440] Space weather did not read the Kp file: ${sw.replace(/\s+/g, ' ')}`);
  const kpDial = await page.evaluate(() => [...document.querySelectorAll('#pg-threats .dials > *')].map((d) => d.textContent).join(' '));
  if (/--/.test(kpDial)) problems.push(`[440] the KP dial reads "--" with a reading in hand: ${kpDial}`);
  // the launch window: both launches, in plain words, no "LL2" in the corner
  await openSection(page, 'threats', 'Launches');
  const lrows = await page.$$eval('#pg-threats .pn.launches .rw', (els) => els.map((e) => e.innerText.replace(/\s+/g, ' ')));
  if (lrows.length < 2) problems.push(`[440] the launch window lists ${lrows.length} launches (2 stood in)`);
  if (lrows.some((r) => /\b(Success|TBD|TBC|NET)\b/.test(r))) problems.push(`[440] launch statuses are not in plain words: ${lrows.join(' | ')}`);
  if (/LL2/i.test(await text(page, '#pg-threats .pn.launches > h3'))) problems.push('[440] the launch window still shows "LL2" in its corner');
  const cut = await page.$$eval('#pg-threats .pn.launches .rw .v', (els) => els.filter((v) => v.scrollWidth > v.clientWidth + 1 || v.scrollHeight > v.clientHeight + 1).map((v) => v.textContent));
  if (cut.length) problems.push(`[440] launch names are cut off: ${cut.join(' | ')}`);
  if (lrows.some((r) => / \| /.test(r))) problems.push(`[440] launch names keep Launch Library's " | ": ${lrows.join(' | ')}`);
  // NEAR YOU: plain kilometres, where it measures from, tiles that open God's Eye
  await openSection(page, 'threats', 'Near you');
  const near = await text(page, '#pg-threats .pn.near');
  if (/\dk km/.test(near)) problems.push(`[440] NEAR YOU writes distances as "k km": ${near.replace(/\s+/g, ' ')}`);
  if (!/from London/i.test(near)) problems.push(`[440] NEAR YOU does not say where it measures from: ${near.replace(/\s+/g, ' ')}`);
  const tiles = await page.$$eval('#pg-threats .pn.near .rw', (els) => els.map((e) => `${e.classList.contains('link') ? 'tap' : 'no tap'}: ${e.innerText.replace(/\s+/g, ' ')}`));
  if (tiles.some((t) => t.startsWith('no tap'))) problems.push(`[440] NEAR YOU tiles that do nothing on a tap: ${tiles.filter((t) => t.startsWith('no tap')).join(' | ')}`);
  await page.screenshot({ path: `${out}/threats-440-top.png` });
  const air = page.locator('#pg-threats .pn.near .rw', { hasText: /air/i }).first();
  if (await air.count()) {
    await air.click();
    await page.waitForTimeout(600);
    const tab = await page.evaluate(() => document.body.dataset.tab);
    if (tab !== 'eye') problems.push(`[440] the AIR tile opened "${tab}", not God's Eye`);
    await page.evaluate(() => (location.hash = 'threats'));
    await page.waitForTimeout(600);
  }

  // RECON: a real report (example.com) from the fixture
  await openSection(page, 'threats', 'Launches');
  await page.route('**/api/recon?**', (r) => r.fulfill({ contentType: 'application/json', body: RECON }));
  await page.fill('#pg-threats .recon input', 'example.com');
  await page.click('#pg-threats .recon .bd button.on');
  await page.waitForSelector('#pg-threats .recon .reconout .lab', { timeout: 10000 }).catch(() => problems.push('[440] the recon report never showed'));
  await page.waitForTimeout(400);
  const box = await page.evaluate(() => {
    const p = document.querySelector('#pg-threats .pn.recon');
    const bd = p.querySelector(':scope > .bd');
    return { panel: p.getBoundingClientRect().height, inner: bd.scrollHeight - bd.clientHeight };
  });
  if (box.inner > 4) problems.push(`[440] the recon report scrolls inside its own box (${box.inner}px hidden in a ${Math.round(box.panel)}px card)`);
  const report = await text(page, '#pg-threats .recon .reconout');
  const first = await text(page, '#pg-threats .recon .reconout .lab');
  if (!/what stands out/i.test(first)) problems.push(`[440] the recon report does not open with WHAT STANDS OUT: "${first}"`);
  if (!/takes no email/i.test(report)) problems.push('[440] example.com\'s null MX is not said as "takes no email"');
  if (/mail via ·|\bMx\b\s*\n\s*0\b/.test(report)) problems.push('[440] the null MX is still garbled ("mail via ·" or "MX 0")');
  if (!/safety headers/i.test(report)) problems.push('[440] WHAT STANDS OUT does not mention the missing safety headers');
  if (/\bAaaa\b|\bCrt\.sh\b/.test(report)) problems.push('[440] DNS record names and sources lost their case ("Aaaa", "Crt.sh")');
  await page.evaluate(() => document.querySelector('#pg-threats .pn.recon').scrollIntoView());
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/threats-440-recon.png` });
  // errors in plain words: the brain out of reach, then the brain failing
  await page.unroute('**/api/recon?**');
  await page.route('**/api/recon?**', (r) => r.abort());
  await page.fill('#pg-threats .recon input', 'example.org');
  await page.click('#pg-threats .recon .bd button.on');
  await page.waitForFunction(() => document.querySelector('#pg-threats .recon .reconstatus.bad'), null, { timeout: 10000 }).catch(() => undefined);
  const offline = await text(page, '#pg-threats .recon .reconstatus');
  if (/failed to fetch|load failed|networkerror/i.test(offline) || !/can.t reach/i.test(offline)) problems.push(`[440] recon with the brain out of reach says "${offline}"`);
  await page.unroute('**/api/recon?**');
  await page.route('**/api/recon?**', (r) => r.fulfill({ status: 500, contentType: 'text/plain', body: 'oops' }));
  await page.click('#pg-threats .recon .bd button.on');
  await page.waitForTimeout(800);
  const broke = await text(page, '#pg-threats .recon .reconstatus');
  if (/answered 500/.test(broke) || !/try again|run again/i.test(broke)) problems.push(`[440] recon with the brain failing says "${broke}"`);
  await ctx.close();
}

// ---- 3. a laptop: the report is readable in the column, not a 156px box ----
{
  const { ctx, page } = await open({ width: 1280, height: 800 }, { feeds: true });
  await page.route('**/api/recon?**', (r) => r.fulfill({ contentType: 'application/json', body: RECON }));
  await page.waitForTimeout(1500);
  await page.fill('#pg-threats .recon input', 'example.com');
  await page.click('#pg-threats .recon .bd button.on');
  await page.waitForSelector('#pg-threats .recon .reconout .lab', { timeout: 10000 }).catch(() => problems.push('[1280] the recon report never showed'));
  await page.waitForTimeout(400);
  const box = await page.evaluate(() => {
    const p = document.querySelector('#pg-threats .pn.recon');
    const bd = p.querySelector(':scope > .bd');
    const col = p.closest('.col');
    return { inner: bd.scrollHeight - bd.clientHeight, body: bd.clientHeight, colScrolls: /(auto|scroll)/.test(getComputedStyle(col).overflowY) && col.scrollHeight > col.clientHeight };
  });
  if (box.inner > 4 && box.body < 500) problems.push(`[1280] the recon report is squeezed into ${box.body}px (${box.inner}px hidden)`);
  if (box.inner <= 4 && !box.colScrolls) problems.push('[1280] the recon report flows but its column cannot scroll to it');
  await page.evaluate(() => document.querySelector('#pg-threats .pn.recon').scrollIntoView());
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/threats-1280-recon.png` });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) problems.push('[1280] the page scrolls sideways');
  await ctx.close();
}

await browser.close();
if (problems.length) {
  console.log(`THREATS: ${problems.length} problem(s)`);
  for (const p of problems) console.log(` - ${p}`);
  process.exit(1);
}
console.log('THREATS: all good');
