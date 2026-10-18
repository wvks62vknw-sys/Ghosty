// Every tab scrolls the way an iPhone scrolls it — in WebKit, Safari's engine, not Chromium. A swipe that
// starts anywhere on the page (on a panel, on text, in the gap between panels) must move the page, and must
// never fall through to the 3-D scene behind it. Chromium passes pages that iPhone Safari will not scroll:
// Safari honours overscroll-behavior: contain on a box with nothing to scroll, and ignores pointer-events:
// none gaps in a different way, so this spec runs WebKit on purpose. (A wheel stands in for the finger:
// Playwright's WebKit has no touch swipe, and the wheel follows the same scroll chain.)
import { webkit } from 'playwright';

const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await webkit.launch();
const problems = [];
const TABS = ['lens', 'brief', 'agenda', 'threats', 'markets', 'radio', 'memory', 'library', 'workshop', 'space', 'links', 'settings', 'system', 'studio', 'learn'];
const viewport = { width: 390, height: 664 }; // an iPhone 13 in Safari, with its bars
const ctx = await browser.newContext({ viewport });
const page = await ctx.newPage();
page.on('pageerror', (e) => /ResizeObserver loop/.test(e.message) || problems.push(`pageerror: ${e.message}`)); // (Safari's ResizeObserver notice is harmless)
await page.goto(base);
await page.fill('#pair input', 'preview-owner-key-0123456789');
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });

let checked = 0;
for (const tab of TABS) {
  await page.evaluate((t) => (location.hash = t), tab);
  await page.waitForTimeout(1500);
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined)))).catch(() => undefined);
  for (const side of ['main', 'alt']) {
    if (side === 'alt') {
      const swap = page.locator(`#pg-${tab} .swap`);
      if (!(await swap.count()) || !(await swap.isVisible())) continue;
      await swap.click();
      await page.waitForTimeout(500);
    }
    const where = `${tab}${side === 'alt' ? ' (other side)' : ''}`;
    // The page's outermost box that has more to show than fits, and points down its middle and near its left edge.
    const spots = await page.evaluate((t) => {
      const root = document.getElementById(`pg-${t}`);
      const all = [root, ...root.querySelectorAll('*')];
      const scrollers = all.filter((e) => {
        const cs = getComputedStyle(e);
        const r = e.getBoundingClientRect();
        return /(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 20 && r.height > 160 && r.width > 200 && cs.visibility !== 'hidden';
      });
      const outer = scrollers.filter((e) => !scrollers.some((o) => o !== e && o.contains(e)));
      const dock = document.querySelector('nav')?.getBoundingClientRect().top ?? innerHeight;
      const out = [];
      outer.forEach((e, i) => {
        e.dataset.scroller = String(i);
        e.scrollTop = 0;
        const r = e.getBoundingClientRect();
        const bottom = Math.min(r.bottom, dock) - 12;
        for (const fy of [0.15, 0.5, 0.85])
          for (const x of [r.left + r.width / 2, r.left + 14]) {
            const y = r.top + 12 + (bottom - r.top - 12) * fy;
            const hit = document.elementFromPoint(x, y);
            // a drawing surface that takes the finger on purpose (the 3-D studio, the room plan, a camera) is skipped
            let el = hit;
            let owns = false;
            while (el && el !== e) {
              if (getComputedStyle(el).touchAction === 'none') owns = true;
              el = el.parentElement;
            }
            out.push({ i, x: Math.round(x), y: Math.round(y), inside: !!hit && e.contains(hit), what: hit ? `${hit.tagName.toLowerCase()}.${String(hit.className).slice(0, 24)}` : 'nothing', owns, cls: String(e.className).slice(0, 24) });
          }
      });
      return out;
    }, tab);
    for (const s of spots) {
      if (s.owns) continue;
      checked++;
      if (!s.inside) {
        problems.push(`[${where}] a touch at ${s.x},${s.y} lands on ${s.what}, outside the page that should scroll ("${s.cls}")`);
        continue;
      }
      await page.evaluate((i) => (document.querySelector(`[data-scroller="${i}"]`).scrollTop = 0), s.i);
      await page.mouse.move(s.x, s.y);
      await page.mouse.wheel(0, 240);
      await page.waitForTimeout(350);
      const moved = await page.evaluate((i) => document.querySelector(`[data-scroller="${i}"]`).scrollTop, s.i);
      // the page itself, or a list inside it that still had room to move, must have taken the swipe
      const inner = await page.evaluate(({ x, y }) => {
        for (let e = document.elementFromPoint(x, y); e; e = e.parentElement) if (e.scrollTop > 0 && !e.dataset.scroller) return true;
        return false;
      }, s);
      if (!(moved > 0) && !inner) problems.push(`[${where}] a swipe starting on ${s.what} (${s.x},${s.y}) does not scroll "${s.cls}"`);
      await page.evaluate(() => document.querySelectorAll('*').forEach((e) => e.scrollTop && (e.scrollTop = 0)));
    }
    await page.evaluate(() => document.querySelectorAll('[data-scroller]').forEach((e) => delete e.dataset.scroller));
  }
}
await browser.close();
if (!checked) problems.push('no page had anything to scroll: the spec checked nothing');
console.log(problems.length ? `PROBLEMS:\n${[...new Set(problems)].join('\n')}` : `Scroll run clean in WebKit on an iPhone 13 screen: ${checked} swipes across every tab moved the page.`);
process.exit(problems.length ? 1 : 0);
