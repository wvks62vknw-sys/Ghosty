// Renders one route's mock-ups to PNG with Playwright's Chromium.
//   node docs/build-plan/mockups/tools/render.mjs <route> [page ...]
// Screens: 440 x 956 at deviceScaleFactor 2, dark colour scheme (a page whose name ends in -light renders light).
// The language card and the contact sheet render at their own size (the body's), also at 2x.
// After each screen it checks for text that is cut off or anything poking out of the screen, and says so.
//
// THE THREE DIRECTIONS (route "directions/d1", "directions/d2", "directions/d3", or "directions" for the sheet across all three):
//   node docs/build-plan/mockups/tools/render.mjs directions/d1            home, show, hub, nav, lens, reader, shelf, contact (home-ember by name)
//   node docs/build-plan/mockups/tools/render.mjs directions contact       the one sheet across the three
// Every screen is rendered at BOTH 390 x 844 and 440 x 956 (deviceScaleFactor 2) as <page>-390.png and <page>-440.png, and the
// check is stricter: nothing sideways at either width, every button and link at least 44 x 44 pt, no text under 11 pt.
//
// ROUND TWO, THE THREE WORLDS (BRIEF-DIRECTIONS-2; route "directions-2/w1", "w2", "w3", or "directions-2" for the sheet across them):
//   node docs/build-plan/mockups/tools/render.mjs directions-2/w1          home, show, hub, lens, reader at both widths; the storyboard's
//                                                                          four frames (story-1..4) at 390; the strip (story) and contact
//   node docs/build-plan/mockups/tools/render.mjs directions-2/w1 home-ember   the theme proof, by name
//   node docs/build-plan/mockups/tools/render.mjs directions-2 contact     the one sheet across the three worlds
// The same checks as round one, at zero. A world screen draws its picture into a WebGL canvas (lib/gl.js) and says when it is done
// (<meta name="mock-gl"> on the page, window.__ready); the renderer waits for that, then a short settle, before the screenshot.
import { chromium } from 'playwright';
import { statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const route = process.argv[2];
if (!route) throw new Error('route?');
const dir = resolve(here, '..', route);
const round2 = route === 'directions-2' || route.startsWith('directions-2/');
const directions = route === 'directions' || route.startsWith('directions/') || round2;
const SHEETS = ['language', 'contact', 'story'];
const isSheet = (name) => SHEETS.includes(name) || name.startsWith('contact');
const STORY = ['story-1', 'story-2', 'story-3', 'story-4'];
const SCREENS = round2 ? ['home', 'show', 'hub', 'lens', 'reader'] : directions ? ['home', 'show', 'hub', 'nav', 'lens', 'reader', 'shelf'] : ['home', 'chat', 'eye', 'gym', 'settings'];
const SIZES = directions ? [[390, 844], [440, 956]] : [[440, 956]];
const asked = process.argv.slice(3);
const pages = asked.length
  ? asked
  : round2
    ? (route === 'directions-2' ? ['contact'] : [...SCREENS, ...STORY, 'story', 'contact'])
    : directions ? (route === 'directions' ? ['contact'] : [...SCREENS, 'contact']) : [...SCREENS, 'language', 'contact'];

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
      // something wider than the box it sits in (a chip row longer than its card, a value pushing past its column)
      const p = el.parentElement;
      if (p && p !== document.body && cs.position !== 'absolute' && cs.position !== 'fixed') {
        const pcs = getComputedStyle(p);
        if (pcs.overflowX === 'visible' && pcs.display !== 'contents') {
          const pr = p.getBoundingClientRect();
          const right = pr.right - parseFloat(pcs.paddingRight) - parseFloat(pcs.borderRightWidth);
          const left = pr.left + parseFloat(pcs.paddingLeft) + parseFloat(pcs.borderLeftWidth);
          if (r.right > right + 1.5 || r.left < left - 1.5) out.push(`sticks out of its parent: <${el.tagName.toLowerCase()} class="${el.className}"> "${txt}" (${Math.round(r.left)}..${Math.round(r.right)} in ${Math.round(left)}..${Math.round(right)})`);
        }
      }
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
    // a storyboard frame is one moment of a transition, drawn at 390 only (the strip is read at that width)
    const sizes = screen ? (STORY.includes(name) ? [[390, 844]] : SIZES) : [null];
    for (const size of sizes) {
      const [W, H] = size ?? [440, 956];
      let ctx = await browser.newContext({
        viewport: { width: W, height: H },
        deviceScaleFactor: 2,
        colorScheme: name.endsWith('-light') ? 'light' : 'dark',
      });
      let page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      await page.goto(pathToFileURL(join(dir, `${name}.html`)).href);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForLoadState('networkidle');
      // a world screen: wait for its canvas to be drawn, then let the page settle
      const gl = await page.evaluate(() => !!document.querySelector('meta[name="mock-gl"]'));
      let glNote = '';
      if (gl) {
        await page.waitForFunction(() => window.__ready === true, null, { timeout: 240000, polling: 250 });
        await page.waitForTimeout(250);
        const info = await page.evaluate(() => ({ ms: window.__glMs, err: window.__glError }));
        glNote = info.err ? `  ** GL: ${info.err} **` : `  (canvas ${info.ms} ms)`;
      }
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
      console.log(`${route}/${file.split('/').pop()} ${kb} KB${kb > 1500 ? '  ** OVER 1.5 MB **' : ''}${glNote}`);
      for (const p of problems.slice(0, 16)) console.log(`   ! ${p}`);
      for (const e of errors.slice(0, 4)) console.log(`   ! page error: ${e.slice(0, 300)}`);
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
