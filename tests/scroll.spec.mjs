// Every tab scrolls the way an iPhone scrolls it — in WebKit, Safari's engine, not Chromium. A swipe that
// starts anywhere on the page (on a panel, on text, in the gap between panels) must move the page, and must
// never fall through to the 3-D scene behind it. Chromium passes pages that iPhone Safari will not scroll:
// Safari honours overscroll-behavior: contain on a box with nothing to scroll, and ignores pointer-events:
// none gaps in a different way, so this spec runs WebKit on purpose. (A wheel stands in for the finger:
// Playwright's WebKit has no touch swipe, and the wheel follows the same scroll chain.)
// Part 2 checks how scrolling feels on the owner's phone (BRIEF-SCROLL-AUDIT): panels that scrolled inside the page,
// the end of a page under the tab bar or the offline line, the keyboard, the chat, sheets and lists.
//   PLAYWRIGHT_BROWSERS_PATH=… BASE=http://localhost:8788 node tests/scroll.spec.mjs
//   CHROMIUM_ONLY=1 runs the same checks in Chromium (a machine without WebKit); FEEL_ONLY=1 runs part 2 alone.
// Chromium with a real touch screen and the Home Screen's safe areas: tests/scrollfeel.spec.mjs.
import { chromium, webkit } from 'playwright';
import { PHONE, UK } from './nav.mjs';

const base = process.env.BASE ?? 'http://localhost:8788';
const chromiumOnly = !!process.env.CHROMIUM_ONLY;
const engineName = chromiumOnly ? 'Chromium' : 'WebKit';
const browser = chromiumOnly ? await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }) : await webkit.launch();
const problems = [];
const TABS = process.env.FEEL_ONLY ? [] : ['lens', 'brief', 'agenda', 'threats', 'markets', 'radio', 'memory', 'library', 'workshop', 'space', 'links', 'settings', 'system', 'studio', 'learn', 'gym'];
const viewport = { width: PHONE.width, height: PHONE.height - 193 }; // the iPhone 18 Pro Max in Safari, with its bars (an iPhone 15 Pro Max loses 193 px of its 932 to them)
const ctx = await browser.newContext({ viewport, ...UK });
const page = await ctx.newPage();
page.on('pageerror', (e) => /ResizeObserver loop/.test(e.message) || problems.push(`pageerror: ${e.message}`)); // (Safari's ResizeObserver notice is harmless)
await page.goto(base);
await page.fill('#pair input', 'preview-owner-key-0123456789');
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });

// A toast (a fixed notice over the page, pointer-events: none, gone in seconds) is outside the page's scroll
// chain in WebKit's layer hit test: a wheel that starts over one moves nothing, though elementFromPoint looks
// straight through it. Toasts are cleared before a page is measured and before every swipe.
const clearToasts = () => page.evaluate(() => document.querySelectorAll('#toasts .toast').forEach((t) => t.remove()));

let checked = 0;
for (const tab of TABS) {
  await page.evaluate((t) => (location.hash = t), tab);
  await page.waitForTimeout(1500);
  await clearToasts();
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
      // the page itself, or a list inside it that still had room to move, must have taken the swipe
      const swipe = async () => {
        await clearToasts();
        await page.evaluate((i) => (document.querySelector(`[data-scroller="${i}"]`).scrollTop = 0), s.i);
        await page.mouse.move(s.x, s.y);
        await page.mouse.wheel(0, 240);
        await page.waitForTimeout(350);
        const moved = await page.evaluate((i) => document.querySelector(`[data-scroller="${i}"]`)?.scrollTop ?? 0, s.i);
        const inner = await page.evaluate(({ x, y }) => {
          for (let e = document.elementFromPoint(x, y); e; e = e.parentElement) if (e.scrollTop > 0 && !e.dataset.scroller) return true;
          return false;
        }, s);
        return moved > 0 || inner;
      };
      // (A live panel filling in under the finger can swallow one swipe on a slow machine: a page that really
      // does not scroll fails the second swipe too, once what is loading has landed.)
      let ok = await swipe();
      if (!ok) {
        await page.evaluate(() => document.querySelectorAll('*').forEach((e) => e.scrollTop && (e.scrollTop = 0)));
        await page.waitForTimeout(1500);
        ok = await swipe();
      }
      if (!ok) problems.push(`[${where}] a swipe starting on ${s.what} (${s.x},${s.y}) does not scroll "${s.cls}"`);
      await page.evaluate(() => document.querySelectorAll('*').forEach((e) => e.scrollTop && (e.scrollTop = 0)));
    }
    await page.evaluate(() => document.querySelectorAll('[data-scroller]').forEach((e) => delete e.dataset.scroller));
  }
}
if (!checked && !process.env.FEEL_ONLY) problems.push('no page had anything to scroll: the spec checked nothing');

// ---------- Part 2: how scrolling feels on the owner's phone (BRIEF-SCROLL-AUDIT, 24 Oct) ----------
// Each check below failed on the interface before its fix (the numbers in brackets are what was measured then, at 440 × 763).
const pair = async (p) => {
  p.on('pageerror', (e) => /ResizeObserver loop|due to access control checks/.test(e.message) || problems.push(`pageerror: ${e.message}`));
  await p.goto(base);
  await p.fill('#pair input', 'preview-owner-key-0123456789');
  await p.click('#pair button.on');
  await p.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
};
const show = async (p, tab, wait = 1500) => {
  await p.evaluate((t) => (location.hash = t), tab);
  await p.waitForTimeout(wait);
  await p.evaluate(() => document.querySelectorAll('#toasts .toast').forEach((t) => t.remove()));
};
const feelCtx = await browser.newContext({ viewport, ...UK, serviceWorkers: 'block' });
const feel = await feelCtx.newPage();
await pair(feel);
let felt = 0;
// 1. A page that scrolls as one has no panel that scrolls on its own inside it. A panel's body stopped at 70 % of the
//    screen and scrolled there: a swipe on Markets' crypto list moved the list 5 px and the page not at all; System's
//    STATUS card took 235 px of every swipe; Library, School and Threats had lists in a slit (and momentum stopped
//    dead at their ends). The wheel over the STATUS card must move the page itself.
for (const tab of ['markets', 'threats', 'library', 'school', 'system', 'brief', 'radio', 'gym', 'space', 'learn', 'reverse', 'settings', 'links', 'memory']) {
  await show(feel, tab);
  const inner = await feel.evaluate((t) => [...document.querySelectorAll(`#pg-${t} :is(.two.stack, .two.rcflow) .col > .pn > .bd`)]
    .filter((b) => b.getBoundingClientRect().height && /(auto|scroll)/.test(getComputedStyle(b).overflowY) && b.scrollHeight > b.clientHeight + 2)
    .map((b) => `"${b.parentElement.querySelector('.ptitle')?.textContent ?? '?'}" (${b.scrollHeight} px shown in ${b.clientHeight})`), tab);
  for (const s of inner) problems.push(`[${tab}] the panel ${s} scrolls on its own inside the page: a swipe that starts on it stops there`);
}
{
  await show(feel, 'system');
  const at = await feel.evaluate(() => {
    const s = document.querySelector('#pg-system .hud');
    s.scrollTop = 0;
    const r = document.querySelector('#pg-system .pn.keepcard > .bd')?.getBoundingClientRect();
    return r && { x: r.left + r.width / 2, y: Math.min(r.top + 120, innerHeight - 140) };
  });
  if (!at) problems.push('[system] no STATUS card to swipe on');
  else {
    await feel.mouse.move(at.x, at.y);
    await feel.mouse.wheel(0, 240);
    await feel.waitForTimeout(400);
    const moved = await feel.evaluate(() => document.querySelector('#pg-system .hud').scrollTop);
    if (moved < 100) problems.push(`[system] a swipe on the STATUS card moved the page ${Math.round(moved)} px, not the 240 asked (the card took it)`);
  }
  felt++;
}
// ---------- end of part 2 ----------
await browser.close();
const summary = `${checked} swipes across every tab moved the page; ${felt} checks of how it feels passed`;
console.log(problems.length ? `PROBLEMS:\n${[...new Set(problems)].join('\n')}` : `Scroll run clean in ${engineName} on an iPhone 18 Pro Max screen: ${summary}.`);
process.exit(problems.length ? 1 : 0);
