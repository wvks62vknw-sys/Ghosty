// The Every screen deck's miniatures (shell/launcher.ts, BRIEF-DECK-BUILD.md): each of the twenty screens opened on
// its own on the preview server at 440 × 956 (the iPhone 18 Pro Max, en-GB, Europe/London), photographed at half
// size and written to apps/web/public/deck/<id>.jpg (220 × 478 px, JPEG quality 70, about 15–25 KB each). Run it
// on a FRESH preview server (restart it first) so every screen shows its own default state, not what another spec
// left behind; then commit the pictures. Not in CI: it writes files into the app.
//   node tests/preview-server.mjs 8850 &
//   BASE=http://localhost:8850 node tests/deckshots.spec.mjs
import { chromium } from 'playwright';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const outDir = fileURLToPath(new URL('../apps/web/public/deck/', import.meta.url));
mkdirSync(outDir, { recursive: true });
const SCREENS = ['core', 'brief', 'eye', 'lens', 'studio', 'workshop', 'reverse', 'space', 'learn', 'gym', 'school', 'library', 'agenda', 'markets', 'threats', 'radio', 'memory', 'settings', 'system', 'links'];
// the globe, Home's Mind and the studio draw with WebGL: give them the software GPU and longer to settle
const GL = new Set(['core', 'eye', 'studio']);
const WAIT = { core: 6000, eye: 9000, studio: 7000, brief: 4000, markets: 4000, threats: 4000, library: 4000 };

const problems = [];
for (const gl of [false, true]) {
  const ids = SCREENS.filter((id) => GL.has(id) === gl);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined, args: gl ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  for (const id of ids) {
    const ctx = await browser.newContext({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 0.5, hasTouch: true, isMobile: true, locale: 'en-GB', timezoneId: 'Europe/London' });
    await ctx.addInitScript(([k]) => {
      localStorage.setItem('ghosty.ownerKey', k);
      if (!localStorage.getItem('ghosty.settings')) localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Boss', home: { name: 'Birmingham', lat: 52.4862, lon: -1.8904 }, units: 'metric' }));
    }, [KEY]);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => problems.push(`${id}: pageerror ${e.message}`));
    await page.goto(`${base}/#${id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 }).catch(() => problems.push(`${id}: the app did not start`));
    await page.waitForFunction((want) => document.body.dataset.tab === want, id, { timeout: 20000 }).catch(() => problems.push(`${id}: the screen did not open`));
    await page.waitForTimeout(WAIT[id] ?? 3000);
    const jpg = await page.screenshot({ type: 'jpeg', quality: 70, timeout: 90000 });
    const file = `${outDir}${id}.jpg`;
    writeFileSync(file, jpg);
    // the size, from the JPEG's own frame header
    let w = 0, hgt = 0;
    for (let i = 2; i < jpg.length - 9; ) {
      if (jpg[i] !== 0xff) break;
      const m = jpg[i + 1];
      if (m >= 0xc0 && m <= 0xc3) { hgt = jpg.readUInt16BE(i + 5); w = jpg.readUInt16BE(i + 7); break; }
      i += 2 + jpg.readUInt16BE(i + 2);
    }
    const kb = Math.round(statSync(file).size / 102.4) / 10;
    console.log(`${id}: ${w} × ${hgt}, ${kb} KB`);
    if (w !== 220 || hgt !== 478) problems.push(`${id}: the picture is ${w} × ${hgt}, not 220 × 478`);
    await ctx.close();
  }
  await browser.close();
}
if (problems.length) {
  console.error(`FAIL\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(`deckshots: ${SCREENS.length} pictures in apps/web/public/deck`);
