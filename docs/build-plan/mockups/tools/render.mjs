// Renders one route's mock-ups to PNG with Playwright's Chromium.
//   node docs/build-plan/mockups/tools/render.mjs <route> [page ...]
// Screens: 440 x 956 at deviceScaleFactor 2, dark colour scheme (a page whose name ends in -light renders light).
// The language card and the contact sheet render at their own size (the body's), also at 2x.
// After each screen it checks for text that is cut off or anything poking out of the screen, and says so.
//
// THE THREE DIRECTIONS (route "directions/d1", "directions/d2", "directions/d3", or "directions" for the sheet across all three):
//   node docs/build-plan/mockups/tools/render.mjs directions/d1            home, show, hub, lens, reader, shelf, contact
//   node docs/build-plan/mockups/tools/render.mjs directions contact       the one sheet across the three
// Every screen is rendered at BOTH 390 x 844 and 440 x 956 (deviceScaleFactor 2) as <page>-390.png and <page>-440.png, and the
// check is stricter: nothing sideways at either width, every button and link at least 44 x 44 pt, no text under 11 pt.
import { chromium } from 'playwright';
import { statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const route = process.argv[2];
if (!route) throw new Error('route?');
const dir = resolve(here, '..', route);
const directions = route === 'directions' || route.startsWith('directions/');
const SHEETS = ['language', 'contact'];
const isSheet = (name) => SHEETS.includes(name) || name.startsWith('contact');
const SCREENS = directions ? ['home', 'show', 'hub', 'lens', 'reader', 'shelf'] : ['home', 'chat', 'eye', 'gym', 'settings'];
const SIZES = directions ? [[390, 844], [440, 956]] : [[440, 956]];
const asked = process.argv.slice(3);
const pages = asked.length ? asked : directions ? (route === 'directions' ? ['contact'] : [...SCREENS, 'contact']) : [...SCREENS, 'language', 'contact'];

/** Runs inside the page: what a designer would reject on sight. */
function inspect({ W, isScreen, strict }) {
  const out = [];
  const limit = isScreen ? W : document.body.scrollWidth;
  if (isScreen && strict && document.documentElement.scrollWidth > W + 0.5) out.push(`the page scrolls sideways (${document.documentElement.scrollWidth} > ${W})`);
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('[data-bleed]') || el.closest('svg')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const txt = (el.textContent || '').trim().slice(0, 40);
    if (r.right > limit + 0.5 || r.left < -0.5) out.push(`outside the screen: <${el.tagName.toLowerCase()} class="${el.className}"> "${txt}" (${Math.round(r.left)}..${Math.round(r.right)})`);
    const clips = (el.children.length === 0 && ['hidden', 'clip'].includes(cs.overflowX)) || cs.textOverflow === 'ellipsis';
    if (clips && el.scrollWidth > el.clientWidth + 1) out.push(`text cut off: <${el.tagName.toLowerCase()} class="${el.className}"> "${txt}"`);
    if (el.children.length === 0 && txt && el.scrollWidth > el.clientWidth + 1 && cs.whiteSpace === 'nowrap' && cs.display !== 'inline') out.push(`text wider than its box: <${el.tagName.toLowerCase()} class="${el.className}"> "${txt}"`);
    if (strict && isScreen) {
      if (el.matches('button, a[href], [role="button"], [data-target]') && !el.closest('[data-notarget]') && (r.width < 43.5 || r.height < 43.5)) out.push(`target under 44 pt: <${el.tagName.toLowerCase()} class="${el.className}"> "${txt}" (${Math.round(r.width)} x ${Math.round(r.height)})`);
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (own && parseFloat(cs.fontSize) < 10.95 && !el.closest('[data-tiny]')) out.push(`type under 11 pt (${cs.fontSize}): <${el.tagName.toLowerCase()} class="${el.className}"> "${txt}"`);
    }
  }
  return out;
}

const browser = await chromium.launch();
try {
  for (const name of pages) {
    const screen = !isSheet(name);
    const sizes = screen ? SIZES : [null];
    for (const size of sizes) {
      const [W, H] = size ?? [440, 956];
      let ctx = await browser.newContext({
        viewport: { width: W, height: H },
        deviceScaleFactor: 2,
        colorScheme: name.endsWith('-light') ? 'light' : 'dark',
      });
      let page = await ctx.newPage();
      await page.goto(pathToFileURL(join(dir, `${name}.html`)).href);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForLoadState('networkidle');
      if (!screen) {
        const dims = await page.evaluate(() => ({ width: Math.ceil(document.body.scrollWidth), height: Math.ceil(document.body.scrollHeight) }));
        // A sheet may ask for a lower scale (<meta name="mock-scale">) to stay under 1.5 MB.
        const scale = await page.evaluate(() => Number(document.querySelector('meta[name="mock-scale"]')?.getAttribute('content') || 2));
        if (scale !== 2) {
          await ctx.close();
          ctx = await browser.newContext({ viewport: dims, deviceScaleFactor: scale, colorScheme: 'dark' });
          page = await ctx.newPage();
          await page.goto(pathToFileURL(join(dir, `${name}.html`)).href);
          await page.evaluate(() => document.fonts.ready);
          await page.waitForLoadState('networkidle');
        }
        await page.setViewportSize(dims);
      }
      const problems = await page.evaluate(inspect, { W, isScreen: screen, strict: directions });
      const file = join(dir, `${name}${directions && screen ? `-${W}` : ''}.png`);
      await page.screenshot({ path: file, fullPage: !screen });
      const kb = Math.round(statSync(file).size / 1024);
      console.log(`${route}/${file.split('/').pop()} ${kb} KB${kb > 1500 ? '  ** OVER 1.5 MB **' : ''}`);
      for (const p of problems.slice(0, 16)) console.log(`   ! ${p}`);
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
