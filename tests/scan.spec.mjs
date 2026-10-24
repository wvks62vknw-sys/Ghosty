// Lens SCAN on an iPhone 13. CODE: a QR code photo is read on the phone (the vendored ZXing
// WebAssembly — Chromium on Linux has no BarcodeDetector) and shown as a web address with its real
// site picked out, a lookalike warning and an OPEN ANYWAY button, never opened by itself; an EAN-13
// photo is read and looked up through /api/lookup/barcode (stubbed here with a product) into a card
// with the Open Food Facts credit. DOCUMENT: a photo of a tilted page on a table → its corners found
// → KEEP PAGE straightens it → EXPORT PDF gives a real PDF (downloaded here: no share sheet on
// Linux) → READ ALL reads the page's text. TRANSLATE: a photo of a French line is read on the phone
// and sent to /api/translate (stubbed), the translation shown. The security policy blocks nothing
// and nothing sticks out sideways. Fixtures: tests/fixtures/qr-url.png and ean13.png (made with
// zxing-wasm's writer).
import { chromium } from 'playwright';
import { PHONE, UK } from './nav.mjs';
import { mkdirSync, readFileSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const problems = [];
const ctx = await browser.newContext({
  viewport: PHONE,
  ...UK,
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  acceptDownloads: true,
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
  // a link the owner opens would leave the app: count them instead (nothing should open by itself)
  window.__opened = [];
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.target === '_blank') return void window.__opened.push(this.href);
    return click.call(this);
  };
});

// The brain's lookup and translator, stubbed: what reaches them is checked below.
const lookups = [];
await page.route('**/api/lookup/barcode?**', async (route) => {
  const code = new URL(route.request().url()).searchParams.get('code');
  lookups.push(code);
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ code, kind: 'product', source: 'Open Food Facts', credit: 'Data: Open Food Facts (ODbL)', title: 'Nutella', brand: 'Ferrero', quantity: '400 g', nutriscore: 'e', nutrition: { kcal: 539, fat: 30.9, sugars: 56.3, salt: 0.107 }, allergens: ['milk', 'nuts', 'soybeans'], ingredients: 'Sugar, palm oil, hazelnuts 13%…', url: `https://world.openfoodfacts.org/product/${code}` }),
  });
});
const translations = [];
await page.route('**/api/translate', async (route) => {
  const body = route.request().postDataJSON();
  translations.push(body);
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'Please do not touch the paintings', from: 'fr', to: body.to, engine: 'workers-ai' }) });
});

await page.goto(base);
await page.fill('#pair input', 'preview-owner-key-0123456789');
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });

const scan = () => page.evaluate(() => {
  const s = window.__ghosty?.scan;
  return s ? JSON.parse(JSON.stringify({ ...s, lookup: s.lookup ? { title: s.lookup.title } : null })) : null;
});
const until = (fn, ms, what) => page.waitForFunction(fn, null, { timeout: ms }).then(() => true).catch(() => { problems.push(what); return false; });
const pick = (name, buffer, mimeType = 'image/png') => page.locator('#pg-lens input[type=file]').setInputFiles({ name, mimeType, buffer });
const sub = (label) => page.locator('#pg-lens .scansubs button', { hasText: label }).click();

// ---- the Lens in SCAN mode (the tile is there) ----
await page.evaluate(() => window.__ghosty.run('open_lens', { mode: 'scan' }));
await page.waitForTimeout(800);
if (!(await page.locator('#pg-lens .lensmodes button', { hasText: 'SCAN' }).isVisible())) problems.push('no SCAN tile in the Lens');
await page.locator('#pg-lens .lensmodes button', { hasText: 'SCAN' }).click();
await until(() => window.__ghosty?.lens?.mode === 'scan' && window.__ghosty?.scan?.sub === 'code', 10000, `SCAN did not open in CODE: ${JSON.stringify(await scan())}`);
// ready in plain words (it said "code reader ready (ZXing (on the phone)) · point at a code")
await until(() => /ready/.test(window.__ghosty?.lens?.status ?? ''), 60000, `the code reader never said it was ready: "${await page.evaluate(() => window.__ghosty?.lens?.status)}"`);
const readyLine = await page.evaluate(() => window.__ghosty?.lens?.status ?? '');
if (/ZXing|\(/.test(readyLine)) problems.push(`SCAN's ready line is "${readyLine}"`);

// ---- CODE: a QR code photo → a web address, the real site picked out, a warning, never opened ----
await pick('qr.png', fixture('qr-url.png'));
await until(() => (window.__ghosty?.scan?.codes ?? []).some((c) => c.kind === 'url'), 60000, `the QR code was not read: ${JSON.stringify(await scan())}`);
const qr = (await scan())?.codes.at(-1);
if (qr?.text !== 'https://paypal.com.secure-login.example/verify') problems.push(`QR text read as ${JSON.stringify(qr)}`);
const site = await page.locator('#pg-lens .scansite b').textContent().catch(() => '');
if (site !== 'secure-login.example') problems.push(`the card names the site as "${site}"`);
if (!(await page.locator('#pg-lens .scanwarn', { hasText: 'paypal' }).count())) problems.push('no lookalike warning on a paypal-lookalike link');
if (!(await page.locator('#pg-lens button', { hasText: 'OPEN ANYWAY' }).count())) problems.push('a risky link has no OPEN ANYWAY button');
if ((await page.evaluate(() => window.__opened.length)) !== 0) problems.push('a scanned link was opened by itself');
await page.screenshot({ path: `${out}/scan-qr.png` });

// ---- CODE: an EAN-13 photo → the brain's lookup → a product card with the credit ----
await page.locator('#pg-lens button', { hasText: 'SCAN AGAIN' }).click();
await pick('ean.png', fixture('ean13.png'));
await until(() => window.__ghosty?.scan?.lookup?.title === 'Nutella', 60000, `the EAN-13 was not read and looked up: ${JSON.stringify(await scan())}`);
if (lookups.at(-1) !== '3017620422003') problems.push(`the lookup asked for ${JSON.stringify(lookups)}`);
if (!(await page.locator('#pg-lens .scancredit', { hasText: 'Data: Open Food Facts (ODbL)' }).count())) problems.push('the product card does not credit Open Food Facts');
if (!(await page.locator('#pg-lens .scangrade', { hasText: 'NUTRI-SCORE E' }).count())) problems.push('no Nutri-Score on the product card');
await page.screenshot({ path: `${out}/scan-product.png` });

// ---- DOCUMENT: a tilted page on a table → corners → straightened → PDF → text ----
await sub('DOCUMENT');
const pagePhoto = await page.evaluate(async () => {
  const c = document.createElement('canvas');
  c.width = 1200;
  c.height = 1500;
  const g = c.getContext('2d');
  g.fillStyle = '#3a2d22';
  g.fillRect(0, 0, c.width, c.height);
  g.save();
  g.translate(600, 760);
  g.rotate(-0.06);
  g.fillStyle = '#f4f1ea';
  g.fillRect(-430, -600, 860, 1210);
  g.fillStyle = '#111';
  g.font = 'bold 64px sans-serif';
  g.fillText('MEETING NOTES', -360, -430);
  g.font = '44px sans-serif';
  g.fillText('Bring the blue folder', -360, -300);
  g.fillText('on Tuesday morning', -360, -220);
  g.restore();
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s);
});
await pick('page.jpg', Buffer.from(pagePhoto, 'base64'), 'image/jpeg');
await until(() => { const c = document.querySelector('#pg-lens canvas.scanedit'); return !!c && !c.closest('[hidden]') && c.width > 0; }, 15000, 'the corner editor did not open for the page photo');
const editNote = (await page.locator('#pg-lens .scanedit + .note').textContent().catch(() => '')) ?? '';
if (!/Page found/.test(editNote)) problems.push(`the page was not found by itself: "${editNote}"`);
await page.screenshot({ path: `${out}/scan-corners.png` });
await page.locator('#pg-lens button', { hasText: 'KEEP PAGE' }).click();
await until(() => window.__ghosty?.scan?.pages === 1, 20000, `KEEP PAGE did not keep a page: ${JSON.stringify(await scan())}`);
const download = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
await page.locator('#pg-lens button', { hasText: 'EXPORT PDF' }).click();
const file = await download;
if (!file) problems.push(`EXPORT PDF gave no file: ${JSON.stringify((await scan())?.pdf)}`);
else {
  const path = await file.path();
  const bytes = readFileSync(path);
  const text = bytes.toString('latin1');
  if (!text.startsWith('%PDF-1.4') || !text.trimEnd().endsWith('%%EOF')) problems.push(`the export is not a PDF: ${JSON.stringify(text.slice(0, 12))}`);
  if (!/\/Count 1 >>/.test(text) || !/\/Filter \/DCTDecode/.test(text)) problems.push('the PDF does not hold one JPEG page');
  if (!/\.pdf$/.test(file.suggestedFilename())) problems.push(`the PDF is named ${file.suggestedFilename()}`);
}
const pdf = (await scan())?.pdf;
if (pdf?.head !== '%PDF-1.4' || pdf?.pages !== 1) problems.push(`scan state after export: ${JSON.stringify(pdf)}`);
await page.locator('#pg-lens button', { hasText: 'READ ALL' }).click();
await until(() => /blue folder/i.test(document.querySelector('#pg-lens textarea.lensocr:not([hidden])')?.value ?? ''), 150000, 'READ ALL did not read the straightened page');
await page.screenshot({ path: `${out}/scan-document.png` });

// ---- TRANSLATE: a French line read on the phone → the brain's translator ----
await sub('TRANSLATE');
const french = await page.evaluate(async () => {
  const c = document.createElement('canvas');
  c.width = 1200;
  c.height = 300;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#000';
  g.font = 'bold 60px sans-serif';
  g.fillText('Ne touchez pas les tableaux', 40, 170);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s);
});
await pick('sign.png', Buffer.from(french, 'base64'));
await until(() => window.__ghosty?.scan?.translation === 'Please do not touch the paintings', 120000, `TRANSLATE showed no translation: ${JSON.stringify(await scan())}`);
const sent = translations.at(-1);
if (!sent || !/touchez/i.test(sent.text) || sent.to !== 'en') problems.push(`the translator was asked ${JSON.stringify(sent)}`);
if (!(await page.locator('#pg-lens .lensreply', { hasText: 'Please do not touch the paintings' }).isVisible())) problems.push('the translation is not on screen');
await page.screenshot({ path: `${out}/scan-translate.png` });

// ---- the security policy and the phone layout ----
const csp = await page.evaluate(() => window.__csp);
if (csp.length) problems.push(`security policy blocked: ${csp.join(' | ')}`);
const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
if (wide) problems.push('SCAN is wider than the phone screen');
const state = await scan();
if (state?.error) problems.push(`SCAN error: ${state.error}`);

await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'SCAN run clean on an iPhone 13: a QR photo was read on the phone and shown as a link with its real site and a lookalike warning (not opened), an EAN-13 was read and looked up into a product card crediting Open Food Facts, a tilted page photo had its corners found, was straightened, exported as a real one-page PDF and read, a French sign was read and translated, and the security policy blocked nothing.');
process.exit(problems.length ? 1 : 0);
