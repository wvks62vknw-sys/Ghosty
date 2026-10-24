// Renders the deck mock-ups (a copy of ../tools/render.mjs that also treats contact2 and contact3 as sheets).
//   node docs/build-plan/mockups/deck/render.mjs <page ...>
// The language card and the contact sheet render at their own size (the body's), also at 2x.
// After each screen it checks for text that is cut off or anything poking out of the screen, and says so.
import { chromium } from 'playwright';
import { statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const route = 'deck';

const dir = here;
const SCREENS = ['home', 'chat', 'eye', 'gym', 'settings'];
const pages = process.argv.slice(2).length ? process.argv.slice(2) : [...SCREENS, 'language', 'contact'];

const browser = await chromium.launch();
try {
  for (const name of pages) {
    const screen = !['language', 'contact', 'contact2', 'contact3'].includes(name);
    let ctx = await browser.newContext({
      viewport: { width: 440, height: 956 },
      deviceScaleFactor: 2,
      colorScheme: name.endsWith('-light') ? 'light' : 'dark',
    });
    let page = await ctx.newPage();
    await page.goto(pathToFileURL(join(dir, `${name}.html`)).href);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForLoadState('networkidle');
    if (!screen) {
      const size = await page.evaluate(() => ({ width: Math.ceil(document.body.scrollWidth), height: Math.ceil(document.body.scrollHeight) }));
      // A sheet may ask for a lower scale (<meta name="mock-scale">) to stay under 1.5 MB.
      const scale = await page.evaluate(() => Number(document.querySelector('meta[name="mock-scale"]')?.getAttribute('content') || 2));
      if (scale !== 2) {
        await ctx.close();
        ctx = await browser.newContext({ viewport: size, deviceScaleFactor: scale, colorScheme: 'dark' });
        page = await ctx.newPage();
        await page.goto(pathToFileURL(join(dir, `${name}.html`)).href);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForLoadState('networkidle');
      }
      await page.setViewportSize(size);
    }
    const problems = await page.evaluate((isScreen) => {
      const out = [];
      const W = isScreen ? 440 : document.body.scrollWidth;
      for (const el of document.querySelectorAll('body *')) {
        if (el.closest('[data-bleed]') || el.closest('svg')) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const txt = (el.textContent || '').trim().slice(0, 40);
        if (r.right > W + 0.5 || r.left < -0.5) out.push(`outside the screen: <${el.tagName.toLowerCase()} class="${el.className}"> "${txt}" (${Math.round(r.left)}..${Math.round(r.right)})`);
        const clips = (el.children.length === 0 && ['hidden', 'clip'].includes(cs.overflowX)) || cs.textOverflow === 'ellipsis';
        if (clips && el.scrollWidth > el.clientWidth + 1) out.push(`text cut off: <${el.tagName.toLowerCase()} class="${el.className}"> "${txt}"`);
        if (el.children.length === 0 && txt && el.scrollWidth > el.clientWidth + 1 && cs.whiteSpace === 'nowrap' && cs.display !== 'inline') out.push(`text wider than its box: <${el.tagName.toLowerCase()} class="${el.className}"> "${txt}"`);
      }
      return out;
    }, screen);
    const file = join(dir, `${name}.png`);
    await page.screenshot({ path: file, fullPage: !screen });
    const kb = Math.round(statSync(file).size / 1024);
    console.log(`${route}/${name}.png ${kb} KB${kb > 1500 ? '  ** OVER 1.5 MB **' : ''}`);
    for (const p of problems.slice(0, 12)) console.log(`   ! ${p}`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
