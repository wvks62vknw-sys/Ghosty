// God's Eye live public cameras in a real browser: Ghosty opens the cameras nearest London,
// a live picture loads through the proxy, and the four-camera grid shows when nothing is selected.
// Needs the internet (TfL's open camera feed); skips cleanly if the feed can't be reached.
//   node tests/cameras.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const problems = [];

const reachable = await fetch('https://api.tfl.gov.uk/Place/Type/JamCam', { signal: AbortSignal.timeout(15000) }).then((r) => r.ok).catch(() => false);
if (!reachable) {
  console.log('Cameras run skipped: the public camera feed is not reachable from here.');
  process.exit(0);
}

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  const name = viewport.width < 600 ? 'phone' : 'desktop';
  const page = await browser.newPage({ viewport });
  // Errors thrown by Waze's own scripts inside the live-traffic frame (opened for a city with no
  // public cameras) surface here too; only Ghosty's own errors count.
  page.on('pageerror', (e) => webkitNoise(e) || !/^\{"message"/.test(e.message) && problems.push(`[${name}] pageerror: ${e.message}`));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pair input', { timeout: 15000 });
  await page.fill('#pair input', 'preview-owner-key-0123456789');
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
  if (name === 'phone') await page.click('.logbtn');
  await page.fill('#cin', 'show me live cameras in london');
  await page.keyboard.press('Enter');
  const live = await page
    .waitForFunction(() => {
      const img = document.querySelector('.eyeinfo .camview img');
      return img instanceof HTMLImageElement && img.src.startsWith('blob:') && img.naturalWidth > 50;
    }, null, { timeout: 45000 })
    .then(() => true)
    .catch(() => false);
  if (!live) problems.push(`[${name}] no live camera picture appeared`);
  const title = await page.textContent('.eyeinfo').catch(() => '');
  if (!/CCTV/.test(title ?? '') || !/LONDON/.test(title ?? '')) problems.push(`[${name}] camera card: ${(title ?? '').slice(0, 120)}`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/${name}-camera.png` });
  // close the card: the grid of nearest cameras takes over
  const closed = await page.click('.eyeinfo button:has-text("✕")', { timeout: 15000 }).then(() => true, () => false);
  if (!closed) {
    const toastText = await page.evaluate(() => [...document.querySelectorAll('.toast, [class*=toast]')].map((t) => t.textContent).join(' | ')).catch(() => '');
    problems.push(`[${name}] no camera card to close. card: "${(title ?? '').slice(0, 100)}" toasts: "${toastText.slice(0, 200)}" layers: "${(await page.textContent('.eyelay').catch(() => '') ?? '').replace(/\s+/g, ' ').slice(0, 300)}"`);
    await page.close();
    continue;
  }
  const tiles = await page.waitForFunction(() => document.querySelectorAll('.camgrid:not([hidden]) .camview img').length === 4, null, { timeout: 20000 }).then(() => true).catch(() => false);
  if (!tiles) problems.push(`[${name}] the CCTV grid did not show four cameras`);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${out}/${name}-camgrid.png` });
  // Birmingham: its own streets have no public cameras; the motorways around it do (National Highways), and live traffic shows.
  if (name === 'desktop') {
    await page.evaluate(() => (location.hash = 'core'));
    await page.waitForTimeout(500);
    await page.fill('#cin', 'show me the cameras in Birmingham City Centre');
    await page.keyboard.press('Enter');
    const said = await page.waitForFunction(() => /motorway camera to Birmingham/i.test(document.body.textContent ?? '') && /own streets have no public cameras/i.test(document.body.textContent ?? ''), null, { timeout: 30000 }).then(() => true).catch(() => false);
    if (!said) problems.push(`[${name}] Birmingham: Ghosty did not explain the city has no cameras of its own and open a motorway camera`);
    const state = await page.evaluate(() => ({ tab: window.__ghosty.ui.get().tab, traffic: window.__ghosty.globe.vis.traffic, lat: window.__ghosty.globe.cam.target.lat }));
    if (state.tab !== 'eye' || !state.traffic || Math.abs(state.lat - 52.48) > 0.5) problems.push(`[${name}] Birmingham: God's Eye not showing traffic there (${JSON.stringify(state)})`);
    await page.waitForTimeout(6000);
    await page.screenshot({ path: `${out}/${name}-birmingham.png` });
  }
  await page.close();
}
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'Cameras run clean: live public camera opened from chat, picture loaded, CCTV grid shows the nearest four; Birmingham answered honestly with live traffic.');
process.exit(problems.length ? 1 : 0);
