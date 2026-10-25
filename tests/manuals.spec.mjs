// GADGET MANUALS at 440 × 956, the brain mocked (the preview's scripted model calls gadget_manual; the web it searches
// and Bosch's PDF are stand-ins served by the preview server, never the real sites). Lens READ: a rating plate's text
// brings up FIND THE MANUAL? (nothing is asked until it is tapped); the tap asks Ghosty in the chat, and the reply says
// the manual came from Bosch's own site, that ManualsLib was skipped and why, and that it is kept on the GADGETS shelf.
// "My dishwasher shows E24" is answered from the manual, page 12, with its steps; "E99" (not in the manual) is "from the
// web, not the manual"; a replacement part comes back as plain links with no affiliate tag. LIBRARY → GADGETS lists the
// manual with where it came from and its licence, and opens it at its pages. Nothing scrolls sideways; the security
// policy blocks nothing.
//   BASE=http://localhost:8889 node tests/manuals.spec.mjs [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { PHONE, UK, openScreen, openSection } from './nav.mjs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const problems = [];
const ctx = await browser.newContext({
  viewport: PHONE,
  ...UK,
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  permissions: ['camera'],
});
const page = await ctx.newPage();
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' && !/favicon|net::ERR|404|Failed to load resource|^[WI]\d{4} |^INFO:/.test(t)) problems.push(`console: ${t.slice(0, 200)}`);
});
await page.addInitScript(() => {
  window.__csp = [];
  document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
});
const sideways = async (where) => {
  const o = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth - innerWidth, body: document.body.scrollWidth - innerWidth }));
  if (o.doc > 1 || o.body > 1) problems.push(`${where}: the page scrolls sideways (${o.doc}px / ${o.body}px)`);
};
/** The chat's last reply from Ghosty, once it has one matching `re` (or '' after `ms`). */
const reply = async (re, ms, what) => {
  const ok = await page.waitForFunction((src) => {
    const all = [...document.querySelectorAll('#pg-core .msg, #pg-core [data-role="assistant"], #pg-core .bot, #pg-core .turn')].map((e) => e.textContent ?? '');
    return all.some((t) => new RegExp(src).test(t)) || new RegExp(src).test(document.querySelector('#pg-core')?.textContent ?? '');
  }, re.source, { timeout: ms }).then(() => true).catch(() => false);
  if (!ok) problems.push(what);
  return (await page.locator('#pg-core').textContent().catch(() => '')) ?? '';
};
const ask = async (text) => {
  await page.fill('#cin', text);
  await page.press('#cin', 'Enter');
};

await page.goto(base);
await page.fill('#pair input', 'preview-owner-key-0123456789');
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });

// ---- Lens READ: a rating plate's text offers FIND THE MANUAL? and sends nothing until it is tapped ----
await openScreen(page, 'lens');
await page.waitForSelector('#pg-lens', { state: 'visible', timeout: 15000 });
await page.evaluate(() => window.__ghosty.lens.setMode('read'));
await page.waitForTimeout(400);
let chats = 0;
page.on('request', (r) => r.url().includes('/api/chat') && r.method() === 'POST' && chats++);
await page.fill('#pg-lens textarea.lensocr', 'BOSCH\nE-Nr. SMS24AW01G/29   FD 9907\nType S9KT1B   220-240 V 50 Hz');
await page.locator('#pg-lens textarea.lensocr').dispatchEvent('input');
const chip = page.locator('#pg-lens button.manualchip');
await chip.waitFor({ timeout: 5000 }).catch(() => problems.push('no FIND THE MANUAL? chip for a rating plate'));
const chipText = (await chip.textContent().catch(() => '')) ?? '';
if (!/FIND THE MANUAL\? Bosch SMS24AW01G$/.test(chipText.trim())) problems.push(`the chip reads "${chipText}"`);
await page.waitForTimeout(800);
if (chats) problems.push('the rating plate was sent to the brain before the chip was tapped');
await page.screenshot({ path: `${out}/manuals-plate.png` });

// ---- the tap asks Ghosty: the maker's own PDF, ManualsLib skipped and why, kept on the GADGETS shelf ----
await chip.click();
await page.waitForSelector('#pg-core', { state: 'visible', timeout: 8000 }).catch(() => problems.push('the chip did not open the chat'));
const found = await reply(/kept it in the library on the GADGETS shelf/, 45000, 'the chat never said the manual was found and kept');
if (!/Found the manual for the Bosch SMS24AW01G from Bosch's own site \(media3\.bosch-home\.com\)/.test(found)) problems.push('the reply does not say the manual came from Bosch\'s own site');
if (!/Not used: manualslib\.com \(ManualsLib's robots\.txt shuts robots out of its downloads/.test(found)) problems.push('the reply does not say ManualsLib was skipped and why');
if (!/Licence: © Bosch/.test(found)) problems.push('the reply does not give the licence');
await sideways('the manual found');
await page.screenshot({ path: `${out}/manuals-found.png` });

// ---- a fault code: from the manual's own page 12, with its steps ----
await ask('My dishwasher shows E24');
const e24 = await reply(/From the manual, page 12/, 30000, 'E24 was not answered from the manual\'s page 12');
if (!/Switch off the appliance and unplug it[\s\S]*Clean the filters and the waste water pump[\s\S]*drain hose is not kinked/.test(e24)) problems.push('the E24 answer lacks the manual\'s steps');
await sideways('the E24 answer');
await page.screenshot({ path: `${out}/manuals-e24.png` });

// ---- a code the manual does not have: from the web, said so ----
await ask('My dishwasher shows E99');
const e99 = await reply(/does not mention E99[\s\S]*From the web, not the manual/, 30000, 'E99 was not said to be from the web, not the manual');
if (/utm_source/.test(e99)) problems.push('a tracking tag was left on a web link');

// ---- a replacement part: plain links, no shop favoured, no affiliate tag, never a purchase ----
await ask('Replacement drain pump for my dishwasher');
const parts = await reply(/No shop is favoured, no link carries an affiliate tag, and Ghosty never buys anything/, 30000, 'the part search did not say it favours no shop and never buys');
if (/tag=someone-21|ref=sr_1_1/.test(parts)) problems.push('an affiliate tag was left on a part link');
await page.screenshot({ path: `${out}/manuals-parts.png` });

// ---- LIBRARY → GADGETS: the manual with where it came from and its licence; it opens at its pages ----
await openScreen(page, 'library');
// (the Library is in sections on a phone, ui/sections.ts: the manuals are under the Gadgets pill)
await page.waitForSelector('#pg-library .secpills .secpill', { state: 'visible', timeout: 10000 }).catch(() => problems.push('the Library has no pills'));
await openSection(page, 'library', 'Gadgets');
await page.waitForSelector('#pg-library .gadgets .gadgetrow', { timeout: 20000 }).catch(() => problems.push('LIBRARY has no GADGETS row'));
const shelf = (await page.locator('#pg-library .gadgets').textContent().catch(() => '')) ?? '';
if (!/Bosch SMS24AW01G — manual/.test(shelf) || !/from media3\.bosch-home\.com · © Bosch/.test(shelf)) problems.push(`GADGETS shelf reads: ${shelf.slice(0, 200)}`);
await page.locator('#pg-library .gadgets').scrollIntoViewIfNeeded();
await sideways('the GADGETS shelf');
await page.screenshot({ path: `${out}/manuals-library.png` });
await page.locator('#pg-library .gadgets .gadgetrow').first().click();
await page.waitForFunction(() => /Page 12/.test(document.querySelector('.reader')?.textContent ?? ''), null, { timeout: 15000 }).catch(() => problems.push('the manual did not open at its pages'));
await page.screenshot({ path: `${out}/manuals-reader.png` });

const csp = await page.evaluate(() => window.__csp);
if (csp.length) problems.push(`security policy blocked: ${csp.join(' | ')}`);
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : "GADGET MANUALS clean at 440 × 956: a rating plate in READ offered FIND THE MANUAL? and sent nothing until tapped; the reply named Bosch's own site, the skipped ManualsLib and the licence; E24 came from the manual's page 12 with its steps; E99 was said to be from the web, not the manual; part links carried no affiliate tag; LIBRARY → GADGETS listed the manual with its source and licence and opened it; nothing scrolled sideways and the security policy blocked nothing.");
process.exit(problems.length ? 1 : 0);
