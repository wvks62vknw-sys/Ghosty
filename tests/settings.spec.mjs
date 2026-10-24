// SETTINGS as the owner opens it on his iPhone 18 Pro Max (440 × 956), the rows and panels the other specs do not
// cover (features/settings/index.ts, voice.ts, switch.ts):
//  - the on/off settings are switches, not drop-downs: Talk over Ghosty to interrupt, Interface sounds, Tilt phone to
//    look around; each a role="switch" row of at least 44 pt that turns its setting over and back (the spec puts every
//    one back as it found it);
//  - HOME says where home is now in full ("Home: London"; it was only in a placeholder cut off at 440), SET HOME with
//    an empty box says what to do, and USE GPS says it is looking and, when location is refused, how to allow it;
//  - HELP and ABOUT in today's words: no "reactor screen" (nothing on screen is a reactor now) and no "look" (one
//    look); ABOUT does not repeat the theme row;
//  - at 1280 × 800 the profile card is a card of its own height, not an empty block the height of the screen;
//   BASE=http://localhost:8879 node tests/settings.spec.mjs [outDir]
import { mkdirSync } from 'node:fs';
import { PHONE, UK, openPanel } from './nav.mjs';
import { engine, launch, webkitNoise } from './browser.mjs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const problems = [];
const check = (ok, what) => void (ok || problems.push(what));

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined });
const ctx = await browser.newContext({ viewport: PHONE, ...UK });
const page = await ctx.newPage();
page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#pair input', { timeout: 20000 });
await page.fill('#pair input', KEY);
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
await page.evaluate(() => (location.hash = 'settings'));
const setting = (k) => page.evaluate((k) => window.__ghosty.settings.get()[k], k);

// ---- 1. on/off settings are switches
await openPanel(page, 'settings', 'VOICE');
await page.waitForTimeout(400);
const SWITCHES = [
  ['Talk over Ghosty to interrupt', 'bargeIn'],
  ['Interface sounds', 'sounds'],
  ['Tilt phone to look around', 'motion'],
];
const vp = page.locator('#pg-settings .pn.pushed');
check((await vp.locator('select', { hasText: /: on|: off/ }).count()) === 0, 'an on/off setting is still a drop-down');
for (const [label, key] of SWITCHES) {
  const sw = vp.locator('button[role="switch"]', { has: page.locator('b', { hasText: label }) });
  if (!(await sw.count())) {
    problems.push(`no switch for "${label}"`);
    continue;
  }
  const was = await setting(key);
  const box = await sw.boundingBox();
  check(box && box.height >= 44 && box.x >= 0 && box.x + box.width <= PHONE.width, `"${label}" is not a 44 pt row inside the screen: ${JSON.stringify(box)}`);
  check((await sw.getAttribute('aria-checked')) === String(was), `"${label}" shows ${await sw.getAttribute('aria-checked')} but the setting is ${was}`);
  await sw.click();
  check((await setting(key)) === !was && (await sw.getAttribute('aria-checked')) === String(!was), `"${label}" did not turn over`);
  await sw.click();
  check((await setting(key)) === was, `"${label}" was not put back`);
}
await page.screenshot({ path: `${out}/settings-${engine}-voice.png` });

// ---- 2. HOME: where home is, in full; SET HOME and USE GPS say what happened
const toasts = () => page.evaluate(() => document.querySelector('#toasts')?.textContent ?? '');
const homeName = await page.evaluate(() => window.__ghosty.settings.get().home?.name ?? 'London');
const homeLine = (await vp.locator('.homenow').textContent().catch(() => '')) ?? '';
check(homeLine === `Home: ${homeName}`, `the home line: "${homeLine}" (home is ${homeName})`);
const ph = (await vp.locator('input[aria-label="Home city"]').getAttribute('placeholder').catch(() => '')) ?? '';
check(!/\(now /.test(ph), `home is still only in the placeholder: "${ph}"`);
const homeBox = await vp.locator('.homenow').boundingBox();
check(homeBox && homeBox.x + homeBox.width <= PHONE.width, `the home line runs off the screen: ${JSON.stringify(homeBox)}`);
await vp.locator('button', { hasText: 'SET HOME' }).click();
await page.waitForTimeout(300);
check(/Type a city first/.test(await toasts()), `SET HOME with an empty box: "${await toasts()}"`);
await vp.locator('button', { hasText: 'USE GPS' }).click();
await page.waitForFunction(() => /isn’t allowed your location|Couldn’t find where you are/.test(document.querySelector('#toasts')?.textContent ?? ''), null, { timeout: 12000 }).catch(() => undefined);
const gpsSaid = await toasts();
check(/Finding where you are|isn’t allowed your location|Couldn’t find where you are/.test(gpsSaid), `USE GPS said nothing useful: "${gpsSaid}"`);
check(/Settings › Privacy & Security › Location Services|Couldn’t find where you are/.test(gpsSaid), `USE GPS refused does not say how to allow it: "${gpsSaid}"`);
check((await page.evaluate(() => window.__ghosty.settings.get().home?.name ?? 'London')) === homeName, 'home changed although nothing was chosen');

// ---- 3. HELP and ABOUT in today's words
await openPanel(page, 'settings', 'HELP');
await page.waitForTimeout(300);
const help = (await page.locator('#pg-settings .pn.pushed').textContent()) ?? '';
check(!/reactor/i.test(help) && !/\blook\b/i.test(help) && /Tap Ask at the bottom/.test(help), `HELP's words: "${help.slice(0, 300)}"`);
await openPanel(page, 'settings', 'ABOUT');
await page.waitForTimeout(300);
const about = (await page.locator('#pg-settings .pn.pushed').textContent()) ?? '';
check(!/colours of the one design/.test(about), `ABOUT repeats the theme row: "${about.slice(0, 300)}"`);

// ---- 4. a wide screen: the profile card keeps its own height
const wide = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...UK });
const wp = await wide.newPage();
await wp.goto(base, { waitUntil: 'domcontentloaded' });
await wp.waitForSelector('#pair input', { timeout: 20000 });
await wp.fill('#pair input', KEY);
await wp.click('#pair button.on');
await wp.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
await wp.evaluate(() => (location.hash = 'settings'));
await wp.waitForSelector('#pg-settings .two > .hero', { state: 'visible', timeout: 10000 }).catch(() => undefined);
await wp.waitForTimeout(800);
const hero = await wp.locator('#pg-settings .two > .hero').boundingBox();
check(hero && hero.height < 160, `the profile card at 1280 × 800 is ${hero ? Math.round(hero.height) : '?'} px tall`);
await wp.screenshot({ path: `${out}/settings-${engine}-wide.png` });
await wide.close();

await browser.close();
if (problems.length) {
  console.error(`FAIL settings (${engine}):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`ok (${engine}): SETTINGS — switches for on/off settings, the home line and what SET HOME / USE GPS say, HELP and ABOUT, the profile card on a wide screen`);
