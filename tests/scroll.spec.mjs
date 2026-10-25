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
  await p.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 }); // (the pairing box is the app's own; a slow web font or a busy runner need not hold it up)
  await p.fill('#pair input', 'preview-owner-key-0123456789');
  await p.click('#pair button.on');
  await p.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
};
const show = async (p, tab, wait = 1500) => {
  await p.evaluate((t) => (location.hash = t), tab);
  await p.waitForTimeout(wait);
  await p.evaluate(() => document.querySelectorAll('#toasts .toast').forEach((t) => t.remove()));
};
// (reduced motion: the columns' parallax drift follows the pointer and would move where a page ends between runs)
const feelCtx = await browser.newContext({ viewport, ...UK, serviceWorkers: 'block', reducedMotion: 'reduce' });
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
  // (STATUS fills in from the brain: on a slow machine its section is too short to scroll until then)
  await feel.waitForFunction(() => { const s = document.querySelector('#pg-system .hud'); return s && s.scrollHeight - s.clientHeight > 300; }, null, { timeout: 15000 }).catch(() => undefined);
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
// 2. The keyboard. iPhone Safari does not make the page shorter when the keyboard comes up: only the visual viewport
//    shrinks. Nothing followed it, so Home's ask bar stayed where the keyboard covers it and a page's last fields could
//    not be scrolled above it [the ask bar's bottom at 665 under a keyboard from 427]. A stand-in visualViewport (a test
//    cannot open a keyboard) says a 336 px keyboard is up: the ask bar and the page end above it; gone, all is back.
{
  const kctx = await browser.newContext({ viewport, ...UK, serviceWorkers: 'block' });
  await kctx.addInitScript(() => {
    const vv = new EventTarget();
    let kb = 0;
    for (const [k, get] of Object.entries({ height: () => innerHeight - kb, width: () => innerWidth, offsetTop: () => 0, offsetLeft: () => 0, pageTop: () => 0, pageLeft: () => 0, scale: () => 1 })) Object.defineProperty(vv, k, { get });
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
    window.__keyboard = (px) => {
      kb = px;
      vv.dispatchEvent(new Event('resize'));
    };
  });
  const kp = await kctx.newPage();
  await pair(kp);
  await show(kp, 'core');
  const before = await kp.evaluate(() => Math.round(document.querySelector('#cbar').getBoundingClientRect().bottom));
  await kp.focus('#cin');
  await kp.evaluate(() => window.__keyboard(336));
  await kp.waitForTimeout(400);
  const up = await kp.evaluate(() => ({ cbar: Math.round(document.querySelector('#cbar').getBoundingClientRect().bottom), top: innerHeight - 336 }));
  if (up.cbar > up.top + 1 || up.cbar < up.top - 80) problems.push(`[keyboard · Home] with the keyboard up (from ${up.top}) the ask bar's bottom is at ${up.cbar}: it should sit just above the keyboard`);
  await kp.evaluate(() => document.activeElement.blur());
  await kp.evaluate(() => window.__keyboard(0));
  await kp.waitForTimeout(400);
  const after = await kp.evaluate(() => Math.round(document.querySelector('#cbar').getBoundingClientRect().bottom));
  if (Math.abs(after - before) > 2) problems.push(`[keyboard · Home] after the keyboard went the ask bar is at ${after}, not back at ${before}`);
  await show(kp, 'library');
  await kp.focus('#pg-library input.askq');
  await kp.evaluate(() => window.__keyboard(336));
  await kp.waitForTimeout(400);
  const lib = await kp.evaluate(() => ({ page: Math.round(document.querySelector('#pg-library .hud').getBoundingClientRect().bottom), top: innerHeight - 336 }));
  if (lib.page > lib.top + 1) problems.push(`[keyboard · Library] with the keyboard up (from ${lib.top}) the page reaches down to ${lib.page}: its end can never be scrolled above the keyboard`);
  await kctx.close();
  felt++;
}
// Every page scrolled to its end: the lowest thing it draws (clipped by the boxes it sits in), the floating tab bar's
// top, and — offline, when every screen but Home shows one line above the tab bar — that line's top.
const endOf = (p, tab, offline = false) =>
  p.evaluate(({ t, offline }) => {
    document.body.classList.toggle('offline', offline);
    const root = document.getElementById(`pg-${t}`);
    const all = [root, ...root.querySelectorAll('*')];
    const ys = all.filter((e) => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 2 && e.getBoundingClientRect().height > 160);
    const sc = ys.find((e) => !ys.some((o) => o !== e && o.contains(e))) ?? root;
    sc.scrollTop = sc.scrollHeight;
    let low = -1e9;
    let what = '';
    for (const el of sc.querySelectorAll('*')) {
      if (el.closest('details:not([open]) > :not(summary)')) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || +cs.opacity === 0 || cs.position === 'fixed') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (el.children.length && cs.backgroundColor === 'rgba(0, 0, 0, 0)' && cs.borderBottomWidth === '0px' && cs.boxShadow === 'none' && !/^(BUTTON|INPUT|TEXTAREA|SELECT|CANVAS|VIDEO|IMG)$/.test(el.tagName)) continue;
      let b = r.bottom;
      for (let a = el.parentElement; a && a !== sc; a = a.parentElement) if (getComputedStyle(a).overflowY !== 'visible') b = Math.min(b, a.getBoundingClientRect().bottom);
      if (b > low) [low, what] = [b, `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`];
    }
    const line = document.getElementById('rcoffline');
    const res = { lowest: Math.round(low), what, bar: Math.round(document.querySelector('#dock .tabcap').getBoundingClientRect().top), line: offline && line && getComputedStyle(line).display !== 'none' ? Math.round(line.getBoundingClientRect().top) : null };
    document.body.classList.remove('offline');
    sc.scrollTop = 0;
    return res;
  }, { t: tab, offline });
const ENDS = ['brief', 'threats', 'markets', 'radio', 'library', 'gym', 'school', 'space', 'learn', 'reverse', 'settings', 'system', 'links', 'agenda', 'workshop', 'memory', 'lens', 'studio'];

// 3. Offline, the line above the tab bar ("Offline · showing what's saved on this phone") no longer covers the end of
//    every page [it covered the last 34 px: pages ended at 661, the line began at 627]; God's eye's bar sits above it.
for (const tab of ENDS) {
  await show(feel, tab);
  const e = await endOf(feel, tab, true);
  if (e.line == null) problems.push(`[offline · ${tab}] no offline line was shown`);
  else if (e.lowest > e.line - 8) problems.push(`[offline · ${tab}] the end of the page (${e.what} at ${e.lowest}) is under the offline line (from ${e.line})`);
}
{
  await show(feel, 'eye', 2500);
  const e = await feel.evaluate(() => {
    document.body.classList.add('offline');
    const r = { bar: Math.round(document.querySelector('#pg-eye .eyebot').getBoundingClientRect().bottom), line: Math.round(document.getElementById('rcoffline').getBoundingClientRect().top) };
    document.body.classList.remove('offline');
    return r;
  });
  if (e.bar > e.line - 4) problems.push(`[offline · eye] God's eye's bar (to ${e.bar}) is under the offline line (from ${e.line})`);
  felt++;
}
// 4. God's eye's LOOK menu (map tiles, sensor, globe) opens above the bar at the bottom. It grew upwards past the
//    search bar and off the top of the screen, where nothing could scroll it back [its top at -26, under the back
//    button: the MAP TILES row could not be reached]. It now stops under the search bar and scrolls on its own.
{
  await show(feel, 'eye', 2500);
  await feel.locator('#pg-eye button', { hasText: /^look$/i }).first().click();
  await feel.waitForTimeout(500);
  const m = await feel.evaluate(() => {
    const menu = document.querySelector('#pg-eye .lookmenu');
    const r = menu.getBoundingClientRect();
    return { top: Math.round(r.top), under: Math.round(document.querySelector('#pg-eye .eyetop').getBoundingClientRect().bottom), sh: menu.scrollHeight, h: menu.clientHeight, oy: getComputedStyle(menu).overflowY };
  });
  if (m.top < m.under - 1) problems.push(`[eye] the LOOK menu starts at ${m.top}, above the bottom of the search bar (${m.under}): its first rows cannot be reached`);
  if (m.sh > m.h + 1 && !/(auto|scroll)/.test(m.oy)) problems.push(`[eye] the LOOK menu holds ${m.sh} px in ${m.h} and cannot scroll`);
  await feel.locator('#pg-eye button', { hasText: /^look$/i }).first().click();
  // off God's eye: its globe draws every frame (software GL on a test runner) and slows the pages opened next
  await show(feel, 'settings', 300);
  felt++;
}
// 5. Reading back up the conversation while a reply comes in: the chat stays where the owner is reading. Every update
//    of the log (each part of a reply, the turn ending) pulled it to the end [scrolled up to 200, the reply's end put
//    it back at 2519]. His own new message still takes him to the end.
{
  const cctx = await browser.newContext({ viewport, ...UK, serviceWorkers: 'block' });
  const cp = await cctx.newPage();
  let hold = 0;
  const lines = Buffer.from(`${JSON.stringify({ t: 'text', text: 'A long answer, read slowly. '.repeat(60) })}\n${JSON.stringify({ t: 'done', model: 'Mock · scripted' })}\n`).toString('base64');
  // the preview server's test-only stream: the reply's lines, held open `hold` ms (a turn still coming in)
  await cp.route('**/api/chat', (r) => r.continue({ url: `${base}/__test/stream?lines=${encodeURIComponent(lines)}&hold=${hold}` }));
  await pair(cp);
  await show(cp, 'core', 800);
  for (const q of ['first question', 'second question', 'third question']) {
    await cp.fill('#cin', q);
    await cp.keyboard.press('Enter');
    await cp.waitForTimeout(1500);
  }
  await cp.locator('.logbtn').first().click();
  await cp.waitForTimeout(600);
  hold = 4000;
  await cp.fill('#cin', 'one more');
  await cp.keyboard.press('Enter');
  await cp.waitForTimeout(1200);
  const end = await cp.evaluate(() => { const l = document.querySelector('.convo .log'); return Math.round(l.scrollHeight - l.clientHeight - l.scrollTop); });
  if (end > 80) problems.push(`[chat] his own new message left the conversation ${end} px above its end`);
  await cp.evaluate(() => (document.querySelector('.convo .log').scrollTop = 200));
  await cp.waitForTimeout(5000);
  const at = await cp.evaluate(() => Math.round(document.querySelector('.convo .log').scrollTop));
  if (Math.abs(at - 200) > 40) problems.push(`[chat] reading back at 200 px while a reply came in, the conversation moved to ${at}`);
  await cctx.close();
  felt++;
}
// 6. A sheet whose words are longer than the sheet scrolls to its end. The whole text of a notification (a tap on its
//    toast), a confirm and the add-a-memory sheet sat in a box that clipped them [a long task report: 1780 px of
//    words shown in 655, the rest unreachable]. Here: a long task result from the brain's inbox, its toast tapped.
{
  const nctx = await browser.newContext({ viewport, ...UK, serviceWorkers: 'block' });
  const np = await nctx.newPage();
  const text = 'The weekly check found these things, each worth a look when there is time. '.repeat(40) + 'THE LAST LINE.';
  const item = { id: 'n1', at: Date.now(), kind: 'task', title: 'Weekly check', text };
  await np.route('**/api/inbox', (r) => (r.request().method() !== 'GET' ? r.continue() : r.fulfill({ contentType: 'application/json', body: JSON.stringify({ unread: 1, items: [item] }) })));
  await pair(np);
  // its toast tapped as soon as it shows (it lives 7 s: a slow machine's click could miss it)
  const tapped = await np.waitForFunction(() => {
    document.querySelector('#toasts .toast.more')?.click();
    return !!document.querySelector('.modal .toastfull');
  }, null, { timeout: 20000, polling: 200 }).then(() => true).catch(() => false);
  if (!tapped) problems.push('[sheet] the long notification never showed as a toast to tap');
  else {
    await np.waitForTimeout(600);
    await np.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))));
    const s = await np.evaluate(() => {
      const box = document.querySelector('.modal .mbox');
      const words = document.querySelector('.modal .toastfull');
      if (!box || !words) return null;
      for (const e of [words, ...box.querySelectorAll('*'), box]) if (/(auto|scroll)/.test(getComputedStyle(e).overflowY)) e.scrollTop = e.scrollHeight;
      // the bottom of the last line of words
      const range = document.createRange();
      range.selectNodeContents(words);
      const lines = range.getClientRects();
      return { end: Math.round(lines[lines.length - 1].bottom), box: Math.round(box.getBoundingClientRect().bottom), h: words.scrollHeight };
    });
    if (!s) problems.push('[sheet] tapping the toast opened no sheet with the whole text');
    else if (s.end > s.box + 1) problems.push(`[sheet] the notification's whole text (${s.h} px) cannot be scrolled to its end: its last line stays at ${s.end}, below the sheet's edge at ${s.box}`);
  }
  await nctx.close();
  felt++;
}
// 7. Settings, System and Links keep their place. Scrolled down the list, a row opened, then another tab and back:
//    the list came back at its top [120 → 0] (the open row is closed on leaving, and its list's place was put back
//    while the page was hidden, which a browser ignores).
{
  await show(feel, 'settings');
  const set = await feel.evaluate(() => {
    const s = document.querySelector('#pg-settings .hud');
    s.scrollTop = 120;
    return Math.round(s.scrollTop);
  });
  // tapped where it is (a Playwright click would first scroll the list to bring the row into view)
  await feel.locator('#pg-settings .pn[data-row] > h3').filter({ hasText: /about/i }).first().evaluate((h) => h.click());
  await feel.waitForTimeout(500);
  const opened = await feel.evaluate(() => !!document.querySelector('#pg-settings .pn.pushed'));
  await show(feel, 'brief', 800);
  await show(feel, 'settings', 800);
  const back = await feel.evaluate(() => Math.round(document.querySelector('#pg-settings .hud').scrollTop));
  if (!opened) problems.push('[settings] the ABOUT row did not open');
  else if (Math.abs(back - set) > 4) problems.push(`[settings] scrolled to ${set}, a row opened, away and back: the list is at ${back}`);
  felt++;
}
// 8. Every page scrolled to its end stops clear of the floating tab bar, 16 px or more above it and out of its blur,
//    as the stacked pages always did (26 px). The Lens and the 3D Studio stopped 10 px from it [their last line and
//    panel under the bar's blur].
for (const tab of ENDS) {
  await show(feel, tab);
  const e = await endOf(feel, tab);
  if (e.bar - e.lowest < 16) problems.push(`[${tab}] the end of the page (${e.what} at ${e.lowest}) is ${e.bar - e.lowest} px from the tab bar (from ${e.bar}): under its blur`);
}
felt++;
// 9. The Library's reader uses the phone's height. Its sheet stayed 720 px tall on any phone [on the 18 Pro Max in
//    the Home Screen app the words read in a 534 px window with 118 px empty above and below it]. Checked on the
//    sheet modal() builds around the reader (ui/components.ts, features/library/index.ts), with a long document.
{
  await show(feel, 'library', 800);
  const r = await feel.evaluate(() => {
    const m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = '<div class="mbox" role="dialog"><div class="mhead"><b>A long document</b><button>CLOSE</button></div><div class="mbody"><div class="readwrap"><div class="readmeta">a pdf · 40 passages</div><div class="reader"></div><div class="keyrow"><button>MORE</button></div></div></div></div>';
    m.querySelector('.reader').textContent = 'A paragraph of the document, read on the phone. '.repeat(300);
    document.body.append(m);
    m.querySelectorAll('*').forEach((e) => e.getAnimations().forEach((a) => a.finish()));
    const box = m.querySelector('.mbox').getBoundingClientRect();
    const res = { top: Math.round(box.top), bottom: Math.round(box.bottom), reader: m.querySelector('.reader').clientHeight, screen: innerHeight };
    m.remove();
    return res;
  });
  if (r.bottom - r.top < r.screen - 24) problems.push(`[library] the reader's sheet is ${r.bottom - r.top} px tall on a ${r.screen} px screen (its words in ${r.reader} px)`);
  felt++;
}
// ---------- end of part 2 ----------
await browser.close();
const summary = `${checked} swipes across every tab moved the page; ${felt} checks of how it feels passed`;
console.log(problems.length ? `PROBLEMS:\n${[...new Set(problems)].join('\n')}` : `Scroll run clean in ${engineName} on an iPhone 18 Pro Max screen: ${summary}.`);
process.exit(problems.length ? 1 : 0);
