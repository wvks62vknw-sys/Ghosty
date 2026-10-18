// Route on the globe and the Radio tab (outside services are not reachable here, so the
// brain's client commands are triggered directly).
import { launch, webkitNoise } from './browser.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const problems = [];
for (const [name, viewport] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${name}] pageerror: ${e.message}`));
  await page.goto(base);
  await page.fill('#pair input', 'preview-owner-key-0123456789');
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
  await page.evaluate(() => window.__ghosty.run('show_route', {
    path: [[51.5074, -0.1278], [51.506, -0.131], [51.504, -0.135], [51.503, -0.139], [51.5014, -0.1419]],
    from: 'Trafalgar Square', to: 'Buckingham Palace', mode: 'walking', distance_m: 1300, duration_s: 960,
  }));
  await page.waitForFunction(() => !window.__ghosty.globe.cam.fly, null, { timeout: 60000 }).catch(() => undefined);
  await page.waitForTimeout(1500);
  const t = await page.evaluate(() => window.__ghosty.globe.cam.target);
  if (Math.abs(t.lat - 51.504) > 0.05 || Math.abs(t.lon + 0.135) > 0.05) problems.push(`[${name}] camera not framing the route: ${JSON.stringify(t)}`);
  await page.screenshot({ path: `${out}/${name}-route.png` });
  await page.evaluate(() => window.__ghosty.run('play_radio', { name: 'Test Station', url: 'https://example.invalid/stream', info: 'UK · test' }));
  await page.waitForTimeout(1200);
  const chip = await page.evaluate(() => { const b = document.querySelector('.nowplaying'); return b && !b.hidden ? b.textContent : null; });
  if (!chip) problems.push(`[${name}] now-playing chip missing`);
  await page.evaluate(() => (location.hash = 'radio'));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/${name}-radio.png` });
  await page.click('.npstop');
  await page.waitForTimeout(300);
  if (await page.evaluate(() => !document.querySelector('.nowplaying').hidden)) problems.push(`[${name}] stop did not clear the player`);
  await ctx.close();
}
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'Media run clean.');
process.exit(problems.length ? 1 : 0);
