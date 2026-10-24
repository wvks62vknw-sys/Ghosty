// Screenshots the nav and boot sheets: <dir>/contact.png at 440 x 956 (device scale 2, the iPhone 18 Pro Max), whole page.
//   node docs/build-plan/mockups/nav/render.mjs [nav] [boot]
// Waits until the one-minute load average is 6 or below (the machine is shared). After each sheet it lists text that is
// cut off or pokes out of its card, and anything a screen means to show that sits under its floating tab bar.
import { chromium } from 'playwright';
import { loadavg } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dirs = process.argv.slice(2).length ? process.argv.slice(2) : ['nav', 'boot'];
while (loadavg()[0] > 6) {
  console.log(`load ${loadavg()[0].toFixed(1)}: waiting`);
  await new Promise((r) => setTimeout(r, 20000));
}
const browser = await chromium.launch();
try {
  for (const d of dirs) {
    const ctx = await browser.newContext({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 2, colorScheme: 'dark' });
    const page = await ctx.newPage();
    await page.goto(pathToFileURL(join(root, d, 'contact.html')).href);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForLoadState('networkidle');
    await page.addStyleTag({ content: '*, *::before, *::after { animation-play-state: paused !important; animation-delay: 0s !important; }' });
    const problems = await page.evaluate(() => {
      const out = [];
      const BOX = '.ncard, .gymcard, .gymsum, .more, .mi, .ways li, .node, .rule, .line, .hcard, .tl, .pane';
      for (const el of document.querySelectorAll('.shot *, .rules *, .extra *')) {
        if (el.closest('svg')) continue;
        if (el.closest('.mini, .under, .ghost')) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const box = el.closest(BOX);
        if (box && box !== el) {
          const a = el.getBoundingClientRect(), b = box.getBoundingClientRect();
          if (a.width && (a.right > b.right + 0.5 || a.left < b.left - 0.5 || a.bottom > b.bottom + 0.5)) out.push(`pokes out: ${String(el.className || el.tagName).slice(0, 30)} "${(el.textContent || '').trim().slice(0, 40)}"`);
        }
        if (el.scrollWidth > el.clientWidth + 1 && ['hidden', 'clip'].includes(cs.overflowX) && el.children.length === 0) out.push(`cut off: "${(el.textContent || '').trim().slice(0, 40)}"`);
        const r = el.getBoundingClientRect();
        if (r.width && el.closest('.phone') && !el.closest('.mini')) {
          const p = el.closest('.phone').getBoundingClientRect();
          if (r.right > p.right + 0.5 || r.left < p.left - 0.5) if (el.children.length === 0 && (el.textContent || '').trim()) out.push(`off the screen: "${(el.textContent || '').trim().slice(0, 40)}"`);
        }
      }
      document.querySelectorAll('.shot > .phone').forEach((ph, i) => {
        const bar = ph.querySelector(':scope > .dock .tabcap');
        if (!bar) return;
        const top = bar.getBoundingClientRect().top;
        for (const c of ph.querySelectorAll(':scope > .view :is(.ncard, .gymcard, .more, .pdots, .gymsum)')) {
          const r = c.getBoundingClientRect();
          if (r.bottom > top - 2) out.push(`screen ${i + 1}: ${c.className.split(' ')[0]} ends ${Math.round(r.bottom - top)} px under the bar`);
        }
      });
      return [...new Set(out)];
    });
    await page.screenshot({ path: join(root, d, 'contact.png'), fullPage: true });
    console.log(`${d}/contact.png`, problems.length ? `\n  ${problems.join('\n  ')}` : 'ok');
    await ctx.close();
  }
} finally {
  await browser.close();
}
