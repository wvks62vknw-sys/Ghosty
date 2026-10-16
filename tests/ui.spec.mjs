// Drives the built interface in Chromium against the preview server and saves screenshots.
//   node tests/ui.spec.mjs [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const problems = [];

async function run(name, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/.test(m.text())) problems.push(`[${name}] console: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`[${name}] pageerror: ${e.message}`));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  // pairing screen (no Cloudflare Access locally)
  await page.waitForSelector('#pair input', { timeout: 15000 });
  await page.fill('#pair input', 'preview-owner-key-0123456789');
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/${name}-core.png` });
  // talk to Ghosty (scripted model): memory tool + reply
  const narrow = viewport.width < 1240;
  if (narrow) await page.click('.logbtn');
  await page.fill('#cin', 'remember I like flat whites');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => /Done\. (Saved|Already known)/.test(document.body.innerText), null, { timeout: 10000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${name}-chat.png` });
  // approval flow
  await page.fill('#cin', 'forget everything');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.approval button.on', { timeout: 10000 });
  await page.screenshot({ path: `${out}/${name}-approval.png` });
  await page.click('.approval button.on');
  await page.waitForFunction(() => document.body.innerText.includes('Approved.') && /Erased \d+ fact/.test(document.body.innerText), null, { timeout: 10000 });
  if (narrow) await page.click('.logbtn');
  // a widget, opened in its sandbox
  await page.fill('#cin', 'make a widget');
  await page.keyboard.press('Enter');
  // it opens on screen straight away, running in its sandbox
  const opened = await page.waitForSelector('.modal iframe.sandbox', { timeout: 10000 }).then(() => true, () => false);
  if (!opened) problems.push(`[${name}] the new widget did not open on screen`);
  else {
    await page.waitForTimeout(1200);
    const t = await page.frameLocator('.modal iframe.sandbox').locator('h1').textContent({ timeout: 5000 }).catch(() => '');
    if (!/\d/.test(t ?? '')) problems.push(`[${name}] the opened widget is not running (got "${t}")`);
    await page.click('.modal .mhead button');
  }
  for (const tab of ['eye', 'brief', 'threats', 'markets', 'memory', 'workshop', 'system']) {
    await page.evaluate((t) => (location.hash = t), tab);
    await page.waitForTimeout(tab === 'eye' ? 4000 : 900);
    await page.screenshot({ path: `${out}/${name}-${tab}.png` });
  }
  // open the widget from the workshop
  await page.evaluate(() => (location.hash = 'workshop'));
  await page.waitForTimeout(800);
  if (viewport.width < 900) await page.click('#pg-workshop .swap');
  const w = page.locator('#pg-workshop .rw.link .v').first();
  // the list fills from the brain; on a slow runner that takes a moment
  await w.waitFor({ state: 'attached', timeout: 15000 }).catch(() => undefined);
  if (await w.count()) {
    await w.click();
    await page.waitForTimeout(1800);
    const frame = page.frameLocator('iframe.sandbox');
    const txt = await frame.locator('#t').textContent({ timeout: 5000 }).catch(() => '');
    if (!/\d/.test(txt ?? '')) problems.push(`[${name}] widget did not run its script (got "${txt}")`);
    await page.screenshot({ path: `${out}/${name}-widget.png` });
    await page.keyboard.press('Escape');
  } else problems.push(`[${name}] widget not listed in workshop`);
  // fly via the brain's client command
  await page.evaluate(() => (location.hash = 'core'));
  await page.fill('#cin', 'fly to tokyo');
  await page.keyboard.press('Enter');
  // the brain answers with a client command; wait for the camera to be sent there rather than a fixed pause
  const flew = await page.waitForFunction(() => {
    const t = window.__ghosty?.globe?.cam?.target;
    return !!t && Math.abs(t.lon - 139.7) < 1 && Math.abs(t.lat - 35.7) < 1;
  }, null, { timeout: 20000 }).then(() => true).catch(() => false);
  if (!flew) problems.push(`[${name}] fly_to did not target Tokyo: ${JSON.stringify(await page.evaluate(() => window.__ghosty.globe.cam.target))}`);
  const hud = await page.evaluate(() => ({ readout: document.querySelector('.readout')?.textContent ?? '', targetHidden: document.querySelector('.eyeinfo')?.hidden }));
  if (!hud.readout.includes('ALT')) problems.push(`[${name}] globe readout empty`);
  await page.screenshot({ path: `${out}/${name}-fly.png` });
  const fps = await page.evaluate(() => document.querySelector('#pg-system') ? 'ok' : 'no');
  await ctx.close();
  return fps;
}

await run('desktop', { width: 1440, height: 900 });
await run('phone', { width: 390, height: 844 });
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'UI run clean: no page errors.');
process.exit(problems.length ? 1 : 0);
