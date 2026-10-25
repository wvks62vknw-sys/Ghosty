// Every tab at the owner's phone, a small phone (375), a small laptop and a desktop: nothing may be cut off without a way
// to scroll to it, and nothing may stick out sideways off the screen.
import { launch, webkitNoise } from './browser.mjs';
import { DESKTOP, PHONE, UK, openSection } from './nav.mjs';

const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const problems = [];
const TABS = ['core', 'eye', 'lens', 'brief', 'agenda', 'threats', 'markets', 'radio', 'memory', 'library', 'workshop', 'space', 'links', 'settings', 'system', 'studio', 'learn', 'gym'];
// These show one part at a time on a phone (ui/sections.ts): every pill is a side of its own, so nothing a part holds goes unmeasured.
const SECTIONED = ['settings', 'library', 'memory', 'school', 'workshop', 'threats', 'links'];
/** Every animation that ends has ended. */
const landed = (page) => page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined)))).catch(() => undefined);
for (const [name, viewport] of [['phone', PHONE], ['phone 375', { width: 375, height: 667 }], ['laptop', { width: 1280, height: 640 }], ['desktop', DESKTOP]]) {
  const ctx = await browser.newContext({ viewport, ...UK });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${name}] pageerror: ${e.message}`));
  await page.goto(base);
  await page.fill('#pair input', 'preview-owner-key-0123456789');
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
  for (const tab of TABS) {
    await page.evaluate((t) => (location.hash = t), tab);
    await page.waitForTimeout(tab === 'eye' ? 1500 : 700);
    // Panes assemble with a short 3D animation; measure them where they land, not mid-flight.
    await landed(page);
    const pills = SECTIONED.includes(tab) ? await page.$$eval(`#pg-${tab} .secpills:not([hidden]) .secpill`, (b) => b.map((x) => x.textContent ?? '')).catch(() => []) : [];
    for (const side of pills.length ? pills : ['main', 'alt']) {
      if (pills.length) {
        await openSection(page, tab, side);
        await page.waitForTimeout(300);
      } else if (side === 'alt') {
        const swap = page.locator(`#pg-${tab} .swap`);
        if (!(await swap.count()) || !(await swap.isVisible())) continue;
        await swap.click();
        await page.waitForTimeout(300);
      }
      // (the panels a section or side shows slide in as they appear: they too are measured where they land)
      if (pills.length || side === 'alt') await landed(page);
      const bad = await page.evaluate((t) => {
        const root = document.getElementById(`pg-${t}`);
        if (!root) return ['tab did not mount'];
        const out = [];
        for (const el of root.querySelectorAll('.pn > .bd, .col, .convo .log, .hero')) {
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue;
          const oy = getComputedStyle(el).overflowY;
          if (el.scrollHeight > el.clientHeight + 4 && !/(auto|scroll)/.test(oy)) {
            const title = el.closest('.pn')?.querySelector('h3')?.textContent?.trim() ?? el.className;
            out.push(`"${title.slice(0, 40)}" is cut off (${el.scrollHeight}px of content in ${el.clientHeight}px) and cannot scroll`);
          }
        }
        // A box that scrolls on its own must be big enough to read: not a strip squeezed under the rest.
        for (const el of root.querySelectorAll('*')) {
          const cs = getComputedStyle(el);
          if (!/(auto|scroll)/.test(cs.overflowY) || cs.visibility === 'hidden') continue;
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height || el.scrollHeight <= el.clientHeight + 8) continue;
          if (el.clientHeight < Math.min(140, innerHeight * 0.25)) out.push(`"${String(el.className).slice(0, 30)}" squeezed: ${el.scrollHeight}px of content in a ${el.clientHeight}px box`);
        }
        // The parts of a page laid out one under another may not overlap each other.
        for (const grid of root.querySelectorAll('.hud.studio, .hud.lens')) {
          const kids = [...grid.children].filter((k) => k.getBoundingClientRect().height > 0 && getComputedStyle(k).position !== 'absolute');
          for (let i = 0; i < kids.length; i++)
            for (let j = i + 1; j < kids.length; j++) {
              const a = kids[i].getBoundingClientRect();
              const b = kids[j].getBoundingClientRect();
              if (a.bottom - 2 > b.top && b.bottom - 2 > a.top && a.right - 2 > b.left && b.right - 2 > a.left) out.push(`"${String(kids[i].className).slice(0, 20)}" overlaps "${String(kids[j].className).slice(0, 20)}"`);
            }
        }
        for (const el of root.querySelectorAll('.pn, button, input, select')) {
          const r = el.getBoundingClientRect();
          // (a strip that scrolls sideways on purpose, like the Lens modes, may run past the edge)
          const strip = el.parentElement && /(auto|scroll)/.test(getComputedStyle(el.parentElement).overflowX) && el.parentElement.getBoundingClientRect().right <= innerWidth + 2;
          if (r.width && !strip && (r.right > innerWidth + 2 || r.left < -2) && getComputedStyle(el).visibility !== 'hidden') out.push(`${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}" sticks out sideways`);
        }
        return [...new Set(out)].slice(0, 6);
      }, tab);
      for (const b of bad) problems.push(`[${name} ${tab}${pills.length ? ` (${side})` : side === 'alt' ? ' (other side)' : ''}] ${b}`);
    }
    // Phones: the Library shelf and System status must get real room and scroll fully into view above the dock.
    const must = { library: 'SHELF', system: 'STATUS' }[tab];
    if (/^phone/.test(name) && must) {
      await openSection(page, tab, { library: 'Shelf', system: 'Status' }[tab]);
      // The panel fills in once its data arrives (slower on CI runners): measure when it has, or after 8 s.
      const measure = () => page.evaluate((m) => {
        const pn = [...document.querySelectorAll('.pg.on .pn')].find((x) => x.querySelector('h3')?.textContent?.trim().startsWith(m));
        if (!pn) return { missing: true };
        pn.scrollIntoView({ block: 'end' });
        const b = pn.getBoundingClientRect();
        const dock = document.querySelector('nav')?.getBoundingClientRect().top ?? innerHeight;
        const bd = pn.querySelector(':scope > .bd');
        // A panel taller than the screen (the page scrolls as one: no panel scrolls inside it, BRIEF-SCROLL-AUDIT)
        // cannot show its head and its end at once: its head must come into view when scrolled to.
        const top = b.top >= 0 ? b.top : (pn.scrollIntoView({ block: 'start' }), pn.getBoundingClientRect().top);
        return { h: Math.round(b.height), bottom: Math.round(b.bottom), dock: Math.round(dock), top: Math.round(top), cls: pn.className, bd: bd ? `${getComputedStyle(bd).display} ${Math.round(bd.getBoundingClientRect().height)}px ${bd.children.length} kids` : 'no body', fonts: document.fonts.status, w: innerWidth };
      }, must);
      let r = await measure();
      for (let i = 0; i < 16 && !r.missing && (r.h < 220 || r.bottom > r.dock + 2 || r.top < 0); i++) {
        await page.waitForTimeout(500);
        r = await measure();
      }
      if (r.missing) problems.push(`[phone ${tab}] no ${must} panel`);
      else if (r.h < 220 || r.bottom > r.dock + 2 || r.top < 0) problems.push(`[phone ${tab}] ${must} panel squeezed or unreachable: ${JSON.stringify(r)}`);
    }
  }
  await ctx.close();
}
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'Layout run clean: every tab scrolls where it needs to.');
process.exit(problems.length ? 1 : 0);
