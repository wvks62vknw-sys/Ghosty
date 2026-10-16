// Street View, satellite and the live traffic map on God's Eye, on an iPhone 13: the STREET and
// TRAFFIC buttons open Google's and Waze's own pages in a locked frame, the tabs switch between
// them, the app's security policy lets exactly those pages load, and "street view of london" in
// chat opens it too. Works without the internet (the frames' contents are not needed).
//   node tests/streetview.spec.mjs [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const problems = [];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
// Uncaught errors inside the Google and Waze frames surface here too (their own scripts talking to
// their own servers, e.g. Waze's '{"message":"Missing user and visitor id"…}'); only Ghosty's count.
page.on('pageerror', (e) => !/^\{"message"/.test(e.message) && problems.push(`pageerror: ${e.message}`));
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

await page.click('#pg-eye .eyebot .btns button:has-text("STREET")');
const src = await page.getAttribute('.modal iframe.mapframe', 'src');
if (!src?.startsWith('https://www.google.com/maps/embed?origin=mfe&pb=!6m7')) problems.push(`STREET opened ${src}`);
const sandbox = (await page.getAttribute('.modal iframe.mapframe', 'sandbox')) ?? '';
if (!/allow-scripts/.test(sandbox) || /allow-forms|allow-top-navigation(?!-by)/.test(sandbox)) problems.push(`frame sandbox: ${sandbox}`);
await page.click('.modal .maptabs button:has-text("LIVE TRAFFIC")');
const waze = await page.getAttribute('.modal iframe.mapframe', 'src');
if (!waze?.startsWith('https://embed.waze.com/iframe?')) problems.push(`LIVE TRAFFIC opened ${waze}`);
await page.click('.modal .maptabs button:has-text("SATELLITE")');
const sat = await page.getAttribute('.modal iframe.mapframe', 'src');
if (!/!5e1!/.test(sat ?? '')) problems.push(`SATELLITE opened ${sat}`);
const box = await page.$eval('.modal iframe.mapframe', (el) => el.getBoundingClientRect().toJSON());
if (box.width < 300 || box.height < 300) problems.push(`the frame is tiny: ${JSON.stringify(box)}`);
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/phone-streetview.png` });
// Escape closes the sheet (a tap on CLOSE does too; with Google's map rendering in the frame under
// software graphics, Playwright's "is it still" check for a click can starve, so the key is used here).
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
if (await page.$('.modal')) problems.push('the sheet did not close');

// from chat (the conversation lives on the CORE tab)
await page.evaluate(() => (location.hash = 'core'));
await page.waitForTimeout(900);
await page.click('.logbtn');
await page.fill('#cin', 'street view of london');
await page.keyboard.press('Enter');
const opened = await page.waitForSelector('.modal iframe.mapframe', { timeout: 20000 }).then(() => true, () => false);
if (!opened) problems.push('"street view of london" did not open Street View');
else {
  const s2 = await page.getAttribute('.modal iframe.mapframe', 'src');
  if (!/!1d51\.5/.test(s2 ?? '')) problems.push(`chat opened ${s2}`);
}
const blocked = await page.evaluate(() => window.__cspv.filter((v) => /google|waze/.test(v)));
if (blocked.length) problems.push(`security policy blocked: ${blocked.join(', ')}`);

await browser.close();
if (problems.length) {
  console.log(`PROBLEMS:\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('Street view run clean: STREET and TRAFFIC open Google Street View, satellite and the Waze live map in a locked frame on an iPhone 13; the security policy lets them load; chat opens it too.');
