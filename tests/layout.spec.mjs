// Every tab at phone, small-laptop and desktop sizes: nothing may be cut off without a way
// to scroll to it, and nothing may stick out sideways off the screen.
import { chromium } from 'playwright';

const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const problems = [];
const TABS = ['core', 'eye', 'brief', 'agenda', 'threats', 'markets', 'radio', 'memory', 'library', 'workshop', 'links', 'settings', 'system', 'studio'];
for (const [name, viewport] of [['phone', { width: 375, height: 667 }], ['laptop', { width: 1280, height: 640 }], ['desktop', { width: 1440, height: 900 }]]) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`[${name}] pageerror: ${e.message}`));
  await page.goto(base);
  await page.fill('#pair input', 'preview-owner-key-0123456789');
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
  for (const tab of TABS) {
    await page.evaluate((t) => (location.hash = t), tab);
    await page.waitForTimeout(tab === 'eye' ? 1500 : 700);
    // Panes assemble with a short 3D animation; measure them where they land, not mid-flight.
    await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined)))).catch(() => undefined);
    for (const side of ['main', 'alt']) {
      if (side === 'alt') {
        const swap = page.locator(`#pg-${tab} .swap`);
        if (!(await swap.count()) || !(await swap.isVisible())) continue;
        await swap.click();
        await page.waitForTimeout(300);
      }
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
        for (const el of root.querySelectorAll('.pn, button, input, select')) {
          const r = el.getBoundingClientRect();
          if (r.width && (r.right > innerWidth + 2 || r.left < -2) && getComputedStyle(el).visibility !== 'hidden') out.push(`${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}" sticks out sideways`);
        }
        return [...new Set(out)].slice(0, 6);
      }, tab);
      for (const b of bad) problems.push(`[${name} ${tab}${side === 'alt' ? ' (other side)' : ''}] ${b}`);
    }
    // Phones: the Library shelf and System status must get real room and scroll fully into view above the dock.
    const must = { library: 'SHELF', system: 'STATUS' }[tab];
    if (name === 'phone' && must) {
      // The panel fills in once its data arrives (slower on CI runners): measure when it has, or after 8 s.
      const measure = () => page.evaluate((m) => {
        const pn = [...document.querySelectorAll('.pg.on .pn')].find((x) => x.querySelector('h3')?.textContent?.trim().startsWith(m));
        if (!pn) return { missing: true };
        pn.scrollIntoView({ block: 'end' });
        const b = pn.getBoundingClientRect();
        const dock = document.querySelector('nav')?.getBoundingClientRect().top ?? innerHeight;
        const bd = pn.querySelector(':scope > .bd');
        return { h: Math.round(b.height), bottom: Math.round(b.bottom), dock: Math.round(dock), top: Math.round(b.top), cls: pn.className, bd: bd ? `${getComputedStyle(bd).display} ${Math.round(bd.getBoundingClientRect().height)}px ${bd.children.length} kids` : 'no body', fonts: document.fonts.status, w: innerWidth };
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
