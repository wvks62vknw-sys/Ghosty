// Street View as if you were there, on an iPhone 13: STREET dives God's Eye down to the street and
// Google's panorama takes over the screen in a locked frame, facing the way the camera faced; GLOBE
// lifts you out; a tap on the globe drops a pin whose card offers STREET VIEW; TRAFFIC opens the Waze
// live map in the sheet, whose tabs are MAP · 3D · SATELLITE · LIVE TRAFFIC (no Street View tab);
// "street view of london" in chat dives in too; the security policy lets exactly Google's and Waze's
// pages load. Works without the internet (the frames' contents are not needed).
//   node tests/streetview.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const problems = [];

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
// Uncaught errors inside the Google and Waze frames surface here too (their own scripts talking to
// their own servers, e.g. Waze's '{"message":"Missing user and visitor id"…}'); only Ghosty's count.
page.on('pageerror', (e) => webkitNoise(e) || !/^\{"message"/.test(e.message) && problems.push(`pageerror: ${e.message}`));
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#pair input', { timeout: 15000 });
await page.fill('#pair input', 'preview-owner-key-0123456789');
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
// A frame the security policy refuses reports itself here, network or not.
await page.evaluate(() => {
  window.__cspv = [];
  document.addEventListener('securitypolicyviolation', (e) => window.__cspv.push(`${e.violatedDirective} ${e.blockedURI}`));
});
await page.evaluate(() => (location.hash = 'eye'));
await page.waitForTimeout(1500);

// Software rendering draws the globe at a frame or two a second near the ground, and the dive
// follows the frames; the layers that have nothing to do with Street View stay off to keep it moving.
await page.evaluate(() => {
  const g = window.__ghosty.globe;
  g.vis = { ...g.vis, imagery: false, buildings: false, clouds: false, cams: false, crime: false, enforce: false, air: false, ships: false, dispatch: false, quakes: false, events: false, sats: false, orbits: false, radar: false };
});
const streetOpen = () => page.waitForSelector('#street.in iframe.svframe', { timeout: 120000 }).then(() => true, () => false);
// Leaving fades the panorama out and then drops it; under software rendering that moment can lag.
const streetGone = () => page.waitForSelector('#street', { state: 'detached', timeout: 20000 }).then(() => true, () => false);

// 1. STREET: the camera dives, then the panorama takes over, facing the camera's heading
const before = await page.evaluate(() => ({ range: window.__ghosty.globe.cam.range, hd: window.__ghosty.globe.cam.hd }));
await page.click('#pg-eye .eyebot .btns button:has-text("STREET")');
if (!(await streetOpen())) problems.push('STREET did not open Street View');
else {
  const src = await page.getAttribute('#street iframe.svframe', 'src');
  if (!src?.startsWith('https://www.google.com/maps/embed?origin=mfe&pb=!6m7')) problems.push(`STREET opened ${src}`);
  const sandbox = (await page.getAttribute('#street iframe.svframe', 'sandbox')) ?? '';
  if (!/allow-scripts/.test(sandbox) || /allow-forms|allow-top-navigation(?!-by)/.test(sandbox)) problems.push(`frame sandbox: ${sandbox}`);
  const after = await page.evaluate(() => ({ range: window.__ghosty.globe.cam.range, tilt: window.__ghosty.globe.cam.tilt }));
  if (!(after.range < Math.min(before.range, 5))) problems.push(`the camera did not dive to the street: range ${before.range} → ${after.range}`);
  if (after.tilt < 45) problems.push(`the camera is not tilted like someone standing there: ${after.tilt}°`);
  const facing = (await page.textContent('#street .svwhere small')) ?? '';
  if (!/facing (N|NE|E|SE|S|SW|W|NW)$/.test(facing.trim())) problems.push(`no heading shown: ${facing}`);
  const box = await page.$eval('#street iframe.svframe', (el) => el.getBoundingClientRect().toJSON());
  if (box.width < 380 || box.height < 500) problems.push(`the panorama is not full-screen: ${JSON.stringify(box)}`);
  for (const b of ['MAP', '3D', 'TRAFFIC']) if (!(await page.$(`#street .svbar button:has-text("${b}")`))) problems.push(`Street View has no ${b} button`);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/phone-streetview.png` });
  await page.click('#street .svbar button:has-text("GLOBE")');
  if (!(await streetGone())) problems.push('GLOBE did not leave Street View');
}

// 2. A tap on the globe drops a pin; its card offers STREET VIEW, which dives in
await page.evaluate(() => {
  const g = window.__ghosty.globe;
  // (open ground only: the live points over London have their own cards — they are off, see above)
  const cam = g.cam;
  cam.fly = null;
  cam.target = { lat: 51.5074, lon: -0.1278, range: 12, hd: 0, tilt: 0 };
  Object.assign(cam, cam.target);
});
await page.waitForTimeout(600);
await page.mouse.click(195, 400);
const card = await page.waitForSelector('#pg-eye .eyeinfo:not([hidden]) button:has-text("STREET VIEW")', { timeout: 10000 }).then(() => true, () => false);
if (!card) problems.push('a tap on the globe did not open a spot card with STREET VIEW');
else {
  const title = (await page.textContent('#pg-eye .eyeinfo .ptitle').catch(() => '')) ?? '';
  console.log('spot card:', JSON.stringify(title.trim().slice(0, 60)));
  for (const b of ['MAP', '3D', 'TRAFFIC', 'ZOOM', 'CLEAR']) if (!(await page.$(`#pg-eye .eyeinfo button:has-text("${b}")`))) problems.push(`the spot card has no ${b} button`);
  const pinned = await page.evaluate(() => !!window.__ghosty.globe.layers.find((l) => l.id === 'spot')?.spot);
  if (!pinned) problems.push('no pin was dropped on the globe');
  // the address arrives in place (the card is not rebuilt); give it a moment, then tap STREET VIEW
  await page.waitForFunction(() => !/Looking up/.test(document.querySelector('#pg-eye .eyeinfo .rw.addr .v')?.textContent ?? ''), null, { timeout: 15000 }).catch(() => undefined);
  console.log('spot address:', JSON.stringify(((await page.textContent('#pg-eye .eyeinfo .rw.addr .v').catch(() => '')) ?? '').slice(0, 80)));
  await page.click('#pg-eye .eyeinfo button:has-text("STREET VIEW")', { timeout: 15000 }).catch(() => page.click('#pg-eye .eyeinfo button:has-text("STREET VIEW")', { force: true }));
  if (!(await streetOpen())) problems.push('STREET VIEW on the spot card did not open Street View');
  else {
    const s2 = await page.getAttribute('#street iframe.svframe', 'src');
    const m = /!1d(-?[\d.]+)!2d(-?[\d.]+)/.exec(s2 ?? '');
    const ll = m ? { lat: Number(m[1]), lon: Number(m[2]) } : null;
    if (!ll || Math.abs(ll.lat - 51.5074) > 0.12 || Math.abs(ll.lon + 0.1278) > 0.2) problems.push(`the spot's Street View is not near where the finger was (London): ${s2}`);
    // (Escape only reaches Ghosty while the focus is outside Google's frame, so GLOBE is the way out here.)
    await page.click('#street .svbar button:has-text("GLOBE")');
    if (!(await streetGone())) problems.push('GLOBE did not leave Street View from the spot card');
  }
}
if (await page.$('#street')) await page.evaluate(() => document.querySelector('#street')?.remove());

// 3. TRAFFIC opens the Waze live map in the sheet; the tabs are MAP · 3D · SATELLITE · LIVE TRAFFIC
await page.click('#pg-eye .eyebot .btns button:has-text("TRAFFIC")');
const waze = await page.waitForSelector('.modal iframe.mapframe', { timeout: 15000 }).then((el) => el.getAttribute('src'), () => null);
if (!waze?.startsWith('https://embed.waze.com/iframe?')) problems.push(`TRAFFIC opened ${waze}`);
const tabs = await page.$$eval('.modal .maptabs button', (b) => b.map((x) => x.textContent.trim()));
if (tabs.join(' · ') !== 'MAP · 3D · SATELLITE · LIVE TRAFFIC') problems.push(`the sheet's tabs are ${tabs.join(' · ')}`);
await page.click('.modal .maptabs button:has-text("SATELLITE")');
const sat = await page.getAttribute('.modal iframe.mapframe', 'src');
if (!/!5e1!/.test(sat ?? '')) problems.push(`SATELLITE opened ${sat}`);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
if (await page.$('.modal')) problems.push('the sheet did not close');

// 4. from chat (the conversation lives on the CORE tab): the globe is brought up, then the dive
await page.evaluate(() => (location.hash = 'core'));
await page.waitForTimeout(900);
await page.click('.logbtn');
await page.fill('#cin', 'street view of london');
await page.keyboard.press('Enter');
if (!(await streetOpen())) problems.push('"street view of london" did not open Street View');
else {
  const s3 = await page.getAttribute('#street iframe.svframe', 'src');
  if (!/!1d51\.5/.test(s3 ?? '')) problems.push(`chat opened ${s3}`);
  if ((await page.evaluate(() => location.hash)) !== '#eye') problems.push('chat did not bring up God\'s Eye for the dive');
}
const blocked = await page.evaluate(() => window.__cspv.filter((v) => /google|waze/.test(v)));
if (blocked.length) problems.push(`security policy blocked: ${blocked.join(', ')}`);

await browser.close();
if (problems.length) {
  console.log(`PROBLEMS:\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('Street view run clean: STREET dives God\'s Eye to the street and Google\'s panorama takes over full-screen facing the camera\'s heading; GLOBE leaves it; a tap on the globe drops a pin whose card dives in too; TRAFFIC opens the Waze live map; the sheet\'s tabs are MAP · 3D · SATELLITE · LIVE TRAFFIC; chat dives in; the security policy lets the pages load.');
