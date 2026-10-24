// How scrolling feels with a finger on the owner's iPhone 18 Pro Max (BRIEF-SCROLL-AUDIT), in Chromium: a touch screen
// (real touch events, not the wheel tests/scroll.spec.mjs uses in WebKit) and the Home Screen app's safe areas (62 px
// under the Dynamic Island, 34 px over the home indicator), which only Chromium's DevTools can stand in for.
//   BASE=http://localhost:8788 node tests/scrollfeel.spec.mjs [outDir]
// Not a stand-in for the phone: Safari's momentum, rubber-banding and keyboard are only proven on the iPhone itself.
import { chromium } from 'playwright';
import { PHONE, UK } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const problems = [];
let checks = 0;

async function phone({ safe = false } = {}) {
  const ctx = await browser.newContext({ viewport: PHONE, ...UK, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  // the Home Screen app: env(safe-area-inset-*) as the iPhone reports them
  if (safe) await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 62, topMax: 62, bottom: 34, bottomMax: 34, left: 0, leftMax: 0, right: 0, rightMax: 0 } });
  page.on('pageerror', (e) => /ResizeObserver loop/.test(e.message) || problems.push(`pageerror: ${e.message}`));
  await page.goto(base);
  await page.fill('#pair input', 'preview-owner-key-0123456789');
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
  // a finger: down, moving every 16 ms, held a moment (no fling), up
  const swipe = async (x, y, dy) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= 12; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: Math.round(y - (dy * i) / 12) }] });
      await page.waitForTimeout(16);
    }
    await page.waitForTimeout(120);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(300);
  };
  return { ctx, page, swipe };
}
const show = async (page, tab, wait = 1500) => {
  await page.evaluate((t) => (location.hash = t), tab);
  await page.waitForTimeout(wait);
  await page.evaluate(() => document.querySelectorAll('#toasts .toast').forEach((t) => t.remove()));
};
// The lowest thing drawn in a page scrolled to its end, and the top of the floating tab bar.
const pageEnd = (page, tab) =>
  page.evaluate((t) => {
    const root = document.getElementById(`pg-${t}`);
    const scrollers = [root, ...root.querySelectorAll('*')].filter((e) => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 2 && e.getBoundingClientRect().height > 160);
    const sc = scrollers.find((e) => !scrollers.some((o) => o !== e && o.contains(e))) ?? root;
    sc.scrollTop = sc.scrollHeight;
    let low = -1e9;
    for (const el of sc.querySelectorAll('*')) {
      if (el.closest('details:not([open]) > :not(summary)')) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || +cs.opacity === 0 || cs.position === 'fixed') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (el.children.length && cs.backgroundColor === 'rgba(0, 0, 0, 0)' && cs.borderBottomWidth === '0px' && cs.boxShadow === 'none' && !/^(BUTTON|INPUT|TEXTAREA|SELECT|CANVAS|VIDEO|IMG)$/.test(el.tagName)) continue;
      let b = r.bottom;
      for (let a = el.parentElement; a && a !== sc; a = a.parentElement) if (getComputedStyle(a).overflowY !== 'visible') b = Math.min(b, a.getBoundingClientRect().bottom);
      low = Math.max(low, b);
    }
    const bar = document.querySelector('#dock .tabcap').getBoundingClientRect().top;
    return { lowest: Math.round(low), bar: Math.round(bar), stageBottom: Math.round(document.getElementById('stage').getBoundingClientRect().bottom), screen: innerHeight };
  }, tab);

// 1. A finger on a tall card (System's STATUS) moves the page, not the card (the card took 160 px of it and the page 0).
{
  const { ctx, page, swipe } = await phone();
  await show(page, 'system');
  const at = await page.evaluate(() => {
    document.querySelector('#pg-system .hud').scrollTop = 0;
    const r = document.querySelector('#pg-system .pn.keepcard > .bd').getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(Math.min(r.top + 200, innerHeight - 200)) };
  });
  await swipe(at.x, at.y, 300);
  const moved = await page.evaluate(() => document.querySelector('#pg-system .hud').scrollTop);
  if (moved < 150) problems.push(`[touch] a finger on System's STATUS card moved the page ${Math.round(moved)} px of 300`);
  checks++;
  await ctx.close();
}

// 2. The Home Screen app (safe areas 62 / 34): the safe area under the tab bar is counted once. It was counted twice
//    (#app pads by it and every page added it again): pages ended 78 px above the tab bar (26 in Safari), Home's ask bar
//    sat 56 px above it (22), the chat's composer 64 px above the screen's bottom, and the content stopped in a hard
//    line 34 px above the bottom instead of running on under the floating bar.
{
  const { ctx, page } = await phone({ safe: true });
  for (const tab of ['brief', 'markets', 'library', 'gym', 'settings', 'system', 'threats']) {
    await show(page, tab);
    const e = await pageEnd(page, tab);
    if (e.stageBottom < e.screen - 1) problems.push(`[safe area · ${tab}] the page stops ${e.screen - e.stageBottom} px above the bottom of the screen instead of running on under the tab bar`);
    if (e.bar - e.lowest > 50) problems.push(`[safe area · ${tab}] the page ends ${e.bar - e.lowest} px above the tab bar (the safe area counted twice)`);
    if (e.bar - e.lowest < 16) problems.push(`[safe area · ${tab}] the end of the page is ${e.bar - e.lowest} px from the tab bar, under it`);
    if (tab === 'brief') await page.screenshot({ path: `${out}/scrollfeel-safe-brief-end.png` });
  }
  await show(page, 'core');
  const ask = await page.evaluate(() => Math.round(document.querySelector('#dock .tabcap').getBoundingClientRect().top - document.querySelector('#cbar').getBoundingClientRect().bottom));
  if (ask > 30 || ask < 8) problems.push(`[safe area · Home] the ask bar sits ${ask} px above the tab bar (it should sit just above it, 8–30 px)`);
  await page.locator('.logbtn').first().click();
  await page.waitForTimeout(600);
  const comp = await page.evaluate(() => Math.round(innerHeight - document.querySelector('#cbar').getBoundingClientRect().bottom));
  if (comp > 44) problems.push(`[safe area · Chat] the composer sits ${comp} px above the bottom of the screen (just above the home indicator is 34)`);
  await page.screenshot({ path: `${out}/scrollfeel-safe-chat.png` });
  checks++;
  await ctx.close();
}

// 3. The Library's reader in the Home Screen app: the sheet uses the phone's height below the Dynamic Island (it stayed
//    720 px tall, the words in a 534 px window with 118 px empty above and below). On the sheet modal() builds round it.
{
  const { ctx, page } = await phone({ safe: true });
  await show(page, 'library', 800);
  const r = await page.evaluate(() => {
    const m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = '<div class="mbox" role="dialog"><div class="mhead"><b>A long document</b><button>CLOSE</button></div><div class="mbody"><div class="readwrap"><div class="readmeta">a pdf · 40 passages</div><div class="reader"></div><div class="keyrow"><button>MORE</button></div></div></div></div>';
    m.querySelector('.reader').textContent = 'A paragraph of the document, read on the phone. '.repeat(300);
    document.body.append(m);
    m.querySelectorAll('*').forEach((e) => e.getAnimations().forEach((a) => a.finish()));
    const box = m.querySelector('.mbox').getBoundingClientRect();
    return { top: Math.round(box.top), bottom: Math.round(box.bottom), reader: m.querySelector('.reader').clientHeight };
  });
  await page.screenshot({ path: `${out}/scrollfeel-reader.png` });
  if (r.top < 62) problems.push(`[reader] the reader's sheet starts at ${r.top}, under the Dynamic Island (62)`);
  if (r.bottom > 956 - 34) problems.push(`[reader] the reader's sheet runs to ${r.bottom}, over the home indicator`);
  if (r.reader < 630) problems.push(`[reader] the reader shows its words in ${r.reader} px of a 956 px screen`);
  checks++;
  await ctx.close();
}
// ---------- end of checks ----------

await browser.close();
console.log(problems.length ? `PROBLEMS:\n${[...new Set(problems)].join('\n')}` : `Scroll feel clean in Chromium with a finger on an iPhone 18 Pro Max screen: ${checks} checks passed.`);
process.exit(problems.length ? 1 : 0);
