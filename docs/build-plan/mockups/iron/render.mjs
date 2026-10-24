// Screenshots the three sheets: <dir>/contact.png at 440 x 956 (device scale 2, the iPhone 18 Pro Max) and
// <dir>/contact-laptop.png at 1280 x 800 (device scale 1), both the whole page.
//   node docs/build-plan/mockups/iron/render.mjs [a b c] [--only=phone|laptop]
// After each, it lists text that is cut off or that pokes out of its card, so a sheet is never shipped broken.
import { chromium } from 'playwright';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const dirs = args.filter((a) => !a.startsWith('--'));
const only = (args.find((a) => a.startsWith('--only=')) || '').slice(7);
const SIZES = [
  { tag: 'phone', file: 'contact.png', viewport: { width: 440, height: 956 }, deviceScaleFactor: 2 },
  { tag: 'laptop', file: 'contact-laptop.png', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
].filter((s) => !only || s.tag === only);

const browser = await chromium.launch();
try {
  for (const d of dirs.length ? dirs : ['a', 'b', 'c']) {
    for (const s of SIZES) {
      const ctx = await browser.newContext({ viewport: s.viewport, deviceScaleFactor: s.deviceScaleFactor, colorScheme: 'dark' });
      const page = await ctx.newPage();
      await page.goto(pathToFileURL(join(here, d, 'contact.html')).href);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForLoadState('networkidle');
      // a still frame: animations at their first frame
      await page.addStyleTag({ content: '*, *::before, *::after { animation-play-state: paused !important; animation-delay: 0s !important; }' });
      const problems = await page.evaluate(() => {
        const out = [];
        for (const el of document.querySelectorAll('.phone *, .close *')) {
          if (el.closest('svg')) continue;
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') continue;
          const box = el.closest('.hubtile, .gymcard, .msg, .tryrow, .gymsum, .tabcap, .composer, .cmdbar');
          if (box && box !== el) {
            const a = el.getBoundingClientRect(), b = box.getBoundingClientRect();
            if (a.width && (a.right > b.right + 0.5 || a.left < b.left - 0.5 || a.bottom > b.bottom + 0.5)) out.push(`pokes out: ${el.className || el.tagName} "${(el.textContent || '').trim().slice(0, 40)}"`);
          }
          if (el.scrollWidth > el.clientWidth + 1 && ['hidden', 'clip'].includes(cs.overflowX) && el.children.length === 0) out.push(`cut off: "${(el.textContent || '').trim().slice(0, 40)}"`);
        }
        // nothing the screen means to show may sit under the floating tab bar or the composer
        document.querySelectorAll('.shots .phone').forEach((ph, i) => {
          const bar = ph.querySelector('.tabcap, .composer');
          if (!bar) return;
          const top = bar.getBoundingClientRect().top;
          for (const c of ph.querySelectorAll('.view :is(.hubtile, .gymcard, .msg, .tryrow, .gymsum)')) {
            const r = c.getBoundingClientRect();
            if (r.bottom > top - 2) out.push(`screen ${i + 1}: ${c.className.split(' ').slice(0, 2).join('.')} ends ${Math.round(r.bottom - top)} px under the bar`);
          }
        });
        return [...new Set(out)];
      });
      await page.screenshot({ path: join(here, d, s.file), fullPage: true });
      console.log(`${d}/${s.file}`, problems.length ? `\n  ${problems.join('\n  ')}` : 'ok');
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
