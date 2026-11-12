// ONE INK, the second whole HUD (BRIEF-ONE-INK; apps/web/src/features/core/ink/home.ts, shell/house.ts, styles.css ONE INK): a printed
// page, tabs included, on the owner's 440 × 956 and a 390 × 844 phone (every check fails on the code before this brief: it was run
// against it once):
//   a. THE GALLERY: ONE INK's card has no COMING; a tap sets recipe.world 'ink' at once, says YOU'RE IN IT, survives a reload; a tap
//      on THE SCAN brings The Scan back; "one ink" by words switches to it again (no model), the colour staying his;
//   b. HOME IS THE PRINTED PAGE: the masthead stamp with its rule, the serif greeting at 36 px and the italic line, the orb on the
//      equator rule with no glow, exactly one entry (01, TONIGHT, a name in the serif, one true line, a fill key and a ghost key),
//      RECENT and FAVOURITES as underlined words (a tap opens, a long press pins), the ask line and SPEAK, the foot with seven keys
//      and Home lit; no scan marks, no feeds row, no plate, no glow (--g-glow 0, no backdrop-filter anywhere); nothing sideways;
//      every control 44 pt; the book, the agenda and the Brief each as the thing of the hour;
//   c. THE FOOT ON EVERY SCREEN: LEARN and Settings with LEARN / ME lit, the page ending above the foot, the plan from a long press
//      on the eye with seven rooms (and from "the plan" typed), the jump bar from the ask line finding "rad" → RADIO · 04;
//   d. THE SPEED HABIT: Home in ink, the jump bar's open, a room's screen, each under 300 ms (median of five where it says);
//   e. nothing of ink in The Scan or Glass: Home, LEARN and Settings drawn as before (a pixel diff against the build before when
//      INK_BEFORE names the folder the build before wrote with INK_RECORD: only live readings may differ).
//   BASE=http://localhost:8798 node tests/ink.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, openSection } from './nav.mjs';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const problems = [];
const timings = [];
const check = (ok, what) => ok || problems.push(what);
const KEY = 'preview-owner-key-0123456789';
const T0 = Date.now();
const BUDGET = 300;
const INK = { ground: 'warm', world: 'ink', night: 'warm', switches: {} };
const SCAN = { ground: 'graphite', world: 'scan', night: 'graphite', switches: {} };
const GLASS = { ground: 'graphite', world: 'glass', night: 'graphite', switches: {} };
const WIDE = { width: 390, height: 844 };
const TITLE = 'Alice’s Adventures in Wonderland';

/** A phone opened on Ghosty, signed in, his name Boss, in the look asked for; `book`: a book on the go; `pins`: his favourites. */
async function open({ viewport = PHONE, look = INK, book = false, pins = ['lens', 'agenda'], recents = null, once = true, shelf = false } = {}) {
  const ctx = await browser.newContext({ viewport, ...UK, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  // `shelf`: his shelf holds the book he is in, under its real title (the document's id is the title with its punctuation and capitals gone)
  if (shelf) await ctx.route(/\/api\/library$/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ docs: [{ id: 'alices-adventures-in-wonderland.pdf', title: TITLE, source: 'his own file', kind: 'pdf', pages: 120, passages: 40, chars: 90000, status: 'ready', at: Date.now() }], stats: { docs: 1, passages: 40, chars: 90000, bytes: 90000, vectors: 0 }, vectors: false, starterReady: true }) }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/favicon|net::ERR|40[134]|Failed to load resource|^[WI]\d{4} |^INFO:|GPU stall|WebGL/.test(t)) problems.push(`console: ${t.slice(0, 200)}`);
  });
  await page.addInitScript(({ key, look, book, pins, recents, once }) => {
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.themes1', '1');
    if (!once || !localStorage.getItem('spec.ink.seeded')) {
      localStorage.setItem('spec.ink.seeded', '1');
      localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Boss', speak: false, sounds: false, theme: 'reactor', favourites: pins, look, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
      if (book) localStorage.setItem('ghosty.places', JSON.stringify({ map: { 'alices-adventures-in-wonderland.pdf': { n: 4, off: 0, page: 42, pct: 0.37, done: false, at: Date.now() - 86_400_000 } } }));
      if (recents) localStorage.setItem('ghosty.recents', JSON.stringify(recents));
    }
    window.__ghostyHero = true;
    window.__ghostyPlace = { none: true };
    // the stopwatch's tests (timed() below): the printed page drawn, the room's band drawn, the jump bar open with its first rows
    window.__inkTests = {
      home: () => { const f = document.querySelector('.inkframe'); const r = f?.getBoundingClientRect(); return document.body.classList.contains('inkhome') && !!r && r.width > 0 && !!document.querySelector('.inkask')?.getBoundingClientRect().width; },
      see: () => document.body.dataset.tab === 'area-see' && !!document.querySelector('#pg-area-see .roomband')?.getBoundingClientRect().width,
      jump: () => { const p = document.querySelector('#palette.on'); const r = p?.querySelector('input')?.getBoundingClientRect(); return !!r && r.width > 0 && !!p.querySelector('.jgroup, .jempty'); },
    };
  }, { key: KEY, look, book, pins, recents, once });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 40000 }).catch(() => problems.push('the boot never ended'));
  return { ctx, page };
}
const until = (page, fn, ms, what, arg = null) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => { problems.push(what); return false; });
const go = async (page, hash) => {
  await page.evaluate((h) => (location.hash = h), hash);
  await page.waitForTimeout(700);
};
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
/** Everything that can be pressed on the page, drawn: 44 pt, and nothing wider than the screen. */
const floor = (page, W, scope) => page.evaluate(([W, scope]) => {
  const bad = [];
  const seen = (e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none';
  for (const b of document.querySelectorAll(`${scope} button, #dock .tabcap button`)) {
    if (!seen(b)) continue;
    const r = b.getBoundingClientRect();
    if (r.width < 43.5 || r.height < 43.5) bad.push(`target "${(b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 24)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
  }
  for (const e of document.querySelectorAll(`${scope} *, #dock .tabcap *`)) {
    if (!seen(e)) continue;
    const r = e.getBoundingClientRect();
    if (r.width && (r.right > W + 1 || r.left < -1) && !e.closest('canvas, .inkequator, .inkorb')) bad.push(`sideways: <${e.tagName.toLowerCase()}> "${(e.textContent || '').trim().slice(0, 20)}" ${Math.round(r.left)}–${Math.round(r.right)}`);
  }
  if (document.documentElement.scrollWidth > W + 1) bad.push(`the page scrolls sideways: ${document.documentElement.scrollWidth}`);
  return bad;
}, [W, scope]);
const settingsLook = (page) => page.evaluate(() => window.__ghosty.settings.get().look?.world ?? null);
const foot = (page) => page.evaluate(() => [...document.querySelectorAll('#dock .tabcap button')].map((b) => ({ area: b.dataset.area, label: b.getAttribute('aria-label') || b.title || b.textContent.trim(), lit: b.classList.contains('on'), rect: (({ x, y, width, height }) => [x, y, width, height].map(Math.round))(b.getBoundingClientRect()) })));
/** Click a thing and the ms until a named test is true on a frame (the phone's own stopwatch; the tests live in the page: its policy forbids building code from strings). */
async function timed(page, click, name) {
  await page.evaluate((name) => {
    window.__ink_t = null;
    document.addEventListener('click', () => {
      const t0 = performance.now();
      const f = window.__inkTests[name];
      const tick = () => {
        if (f()) window.__ink_t = Math.round(performance.now() - t0);
        else if (performance.now() - t0 < 5000) requestAnimationFrame(tick);
      };
      tick();
    }, { capture: true, once: true });
  }, name);
  await click();
  await page.waitForFunction(() => window.__ink_t != null, null, { timeout: 6000 }).catch(() => undefined);
  return page.evaluate(() => window.__ink_t);
}
const HOME_READY = () => { const f = document.querySelector('.inkframe'); const r = f?.getBoundingClientRect(); return document.body.classList.contains('inkhome') && !!r && r.width > 0 && !!document.querySelector('.inkask')?.getBoundingClientRect().width; };

// ---- a. the gallery: ONE INK's card, a tap, a reload, THE SCAN back, the words
{
  const { ctx, page } = await open({ look: SCAN, once: true });
  const card = (k) => `#pg-settings .pn.themepn.pushed .gg-look[data-look="${k}"]`;
  const themePage = async () => {
    await go(page, 'settings');
    await page.waitForSelector('#pg-settings.listmode .scanset button.srow', { timeout: 15000 }).catch(() => undefined);
    await openSection(page, 'settings', 'Appearance').catch(() => undefined);
    await page.locator('#pg-settings .scanset button.srow').filter({ has: page.locator('.srname', { hasText: /^Theme$/i }) }).first().click({ timeout: 8000 }).catch(() => problems.push('[gallery] the Theme row did not open'));
    await page.waitForSelector(card('ink'), { timeout: 8000 }).catch(() => problems.push('[gallery] the Theme page has no ONE INK card'));
    await page.waitForTimeout(400);
  };
  await themePage();
  const ink0 = await page.evaluate((sel) => ({ coming: !!document.querySelector(`${sel} .gg-coming`), built: document.querySelector(sel)?.dataset.built, label: document.querySelector(sel)?.getAttribute('aria-label') }), card('ink'));
  check(!ink0.coming && ink0.built === 'true', `[gallery] ONE INK's card is still COMING: ${JSON.stringify(ink0)}`);
  const comings = await page.$$eval('#pg-settings .gg-look', (bs) => bs.filter((b) => b.querySelector('.gg-coming')).map((b) => b.dataset.look).join());
  check(comings === 'orbit,grown', `[gallery] COMING is on ${comings} (want orbit,grown: THE MAP and THE EYE are built)`);
  await page.click(card('ink'));
  await until(page, () => document.documentElement.dataset.world === 'ink', 5000, '[gallery] a tap on ONE INK did not make the world ink');
  const said = (k) => page.evaluate((sel) => ({ on: document.querySelector(sel)?.getAttribute('aria-checked'), line: document.querySelector(`${sel} .gg-cap small`)?.textContent ?? '', head: document.querySelector('#pg-settings .pn.themepn.pushed .gg-sec')?.textContent ?? '' }), card(k));
  const s1 = await said('ink');
  check(s1.on === 'true' && /you.re in it/i.test(s1.line) && /ONE INK/i.test(s1.head), `[gallery] ONE INK after its tap: ${JSON.stringify(s1)}`);
  check((await settingsLook(page)) === 'ink', '[gallery] ONE INK was not kept in his settings');
  await page.screenshot({ path: `${out}/ink-gallery.png` });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
  await page.waitForTimeout(1200);
  check(await page.evaluate(() => document.documentElement.dataset.world === 'ink'), '[gallery] ONE INK did not survive a reload');
  await themePage();
  await page.click(card('scan'));
  await until(page, () => document.documentElement.dataset.world === 'scan', 5000, '[gallery] a tap on THE SCAN did not bring The Scan back');
  const s2 = await said('scan');
  check(s2.on === 'true' && /you.re in it/i.test(s2.line), `[gallery] THE SCAN after its tap: ${JSON.stringify(s2)}`);
  // "one ink" by words: no model, the world at once, the colour his (he is on Ember: it stays)
  await page.click('#pg-settings .pn.themepn.pushed .gg-sw[data-colour="ember"]');
  await until(page, () => document.documentElement.dataset.theme === 'ember', 5000, '[words] the ember swatch did not apply');
  const asked = [];
  page.on('request', (r) => /\/api\/chat\b/.test(r.url()) && asked.push(r.url()));
  await go(page, 'core');
  await until(page, () => document.body.classList.contains('scanhome'), 10000, '[words] Home did not wear The Scan before the words');
  if (!(await page.evaluate(() => !!document.querySelector('.hud.core.logopen')))) await page.locator('.logbtn:visible').first().click().catch(() => undefined);
  await page.waitForSelector('#cin', { state: 'visible', timeout: 15000 });
  // the looks still coming say their line and change nothing
  await page.fill('#cin', 'orbit');
  await page.press('#cin', 'Enter');
  await page.waitForFunction(() => [...document.querySelectorAll('#pg-core .msg:not(.me)')].some((m) => (m.textContent ?? '').includes('Orbit is coming')), null, { timeout: 8000 }).catch(() => problems.push('[words] "orbit" did not say its line'));
  check(await page.evaluate(() => document.documentElement.dataset.world === 'scan'), '[words] "orbit" changed the world');
  await page.fill('#cin', 'one ink');
  await page.press('#cin', 'Enter');
  await until(page, () => document.documentElement.dataset.world === 'ink', 8000, '[words] "one ink" did not make the world ink');
  const wd = await page.evaluate(() => ({ colour: document.documentElement.dataset.theme, saved: window.__ghosty.settings.get().theme, said: [...document.querySelectorAll('#pg-core .msg:not(.me)')].map((m) => m.textContent ?? '').filter((t) => /One Ink/.test(t)).pop() ?? '' }));
  check(wd.colour === 'ember' && wd.saved === 'ember', `[words] "one ink" changed his colour: ${JSON.stringify(wd)}`);
  check(/One Ink: on\./.test(wd.said), `[words] "one ink" answered "${wd.said}"`);
  check(!asked.length, `[words] the brain was asked ${asked.length} times for "one ink"`);
  await ctx.close();
}

// ---- b. Home is the printed page, at 440 and at 390; the thing of the hour as the book, the agenda, the Brief
for (const [vp, tag] of [[PHONE, '440'], [WIDE, '390']]) {
  const { ctx, page } = await open({ viewport: vp, book: true, shelf: true, recents: ['library', 'eye', 'brief'] });
  await go(page, 'core');
  await until(page, HOME_READY, 15000, `[home ${tag}] Home never became the printed page`);
  // the book's real title, once his shelf has been read (until then the document's id, as THE SCAN's room says it): it was the id, always
  await until(page, (t) => document.querySelector('.inkentry h2')?.textContent === t, 12000, `[home ${tag}] the entry never took the book's real title off his shelf (it still says the document's id)`, TITLE);
  await page.waitForTimeout(900);
  const h = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const css = (e, p) => (e ? getComputedStyle(e).getPropertyValue(p).trim() : '');
    const seen = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none';
    const frame = q('.inkframe');
    const fr = frame.getBoundingClientRect();
    const all = [...document.querySelectorAll('.inkframe *, #dock *')];
    const text = (s) => (q(s)?.innerText ?? '').replace(/\s+/g, ' ').trim();
    const orb = q('.inkorbhost')?.getBoundingClientRect();
    const eq = q('.inkequator')?.getBoundingClientRect();
    const mast = q('.inkmast')?.getBoundingClientRect();
    return {
      bg: css(frame, 'background-color'), canvas: css(document.documentElement, '--g-canvas'),
      stamp: text('.inkmast .g-stamp'), rule: css(q('.inkmast'), 'border-bottom-width'), ruleStyle: css(q('.inkmast'), 'border-bottom-style'),
      say: text('.inksay'), sayFont: css(q('.inksay'), 'font-size'), sayFamily: css(q('.inksay'), 'font-family'), say2: text('.inksay2'), say2Style: css(q('.inksay2'), 'font-style'), say2Size: css(q('.inksay2'), 'font-size'),
      orb: orb && [orb.x, orb.y, orb.width, orb.height].map(Math.round), eq: eq && [eq.top, eq.height].map(Math.round), orbMid: orb && Math.round(orb.y + orb.height / 2), mastBottom: mast && Math.round(mast.bottom),
      orbCanvas: !!q('.inkorbhost canvas'), glow: css(document.documentElement, '--g-glow'), orbMind: window.__ghosty?.hero?.mode ?? '',
      entries: document.querySelectorAll('.inkentry').length, kickIndex: text('.inkentry .kick .g-index'), kickTag: text('.inkentry .kick .g-tag'), kickRight: text('.inkentry .kick .g-truth'),
      name: text('.inkentry h2'), nameFamily: css(q('.inkentry h2'), 'font-family'), nameSize: css(q('.inkentry h2'), 'font-size'), line: text('.inkentry .inkline'), lineFamily: css(q('.inkentry .inkline'), 'font-family'),
      keys: [...document.querySelectorAll('.inkentry .keys .g-key')].map((k) => ({ cls: k.className, text: k.textContent.trim(), w: Math.round(k.getBoundingClientRect().width) })),
      recent: [...document.querySelectorAll('.inkl[data-list="recent"] .inkword')].map((b) => b.textContent.trim()), recentLabel: text('.inkl[data-list="recent"] .g-truth'),
      pins: [...document.querySelectorAll('.inkl[data-list="favourites"] .inkword')].map((b) => b.textContent.trim()), pinsLabel: text('.inkl[data-list="favourites"] .g-truth'),
      underline: css(q('.inkword'), 'text-decoration-line'), underlineColour: css(q('.inkword'), 'text-decoration-color'),
      field: text('.inkfield'), fieldStyle: css(q('.inkfield'), 'font-style'), speak: text('.inkspeak'), speakColour: css(q('.inkspeak'), 'color'), kickColour: css(q('.inkentry .kick .g-index'), 'color'), accent: css(document.documentElement, '--g-accent'), askBorder: css(q('.inkask'), 'border-bottom-width'),
      foot: [...document.querySelectorAll('#dock .tabcap button')].map((b) => ({ label: b.getAttribute('aria-label') || b.textContent.trim(), area: b.dataset.area, lit: b.classList.contains('on') })),
      footTop: Math.round(document.querySelector('#dock .tabcap').getBoundingClientRect().top), frameBottom: Math.round(fr.bottom), frameTop: Math.round(fr.top),
      housekick: css(q('#dock .housekick'), 'display'), houseask: css(q('#dock .houseask'), 'display'),
      scanmarks: document.querySelectorAll('.scanmarks, .scanleads').length ? [...document.querySelectorAll('.scanmarks, .scanleads')].filter((e) => e.getClientRects().length).length : 0,
      feeds: [...document.querySelectorAll('.rcwx, .rcbelow, .rchero, .scancol, #cbar, #ccap')].filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').length,
      glowEls: all.filter((e) => getComputedStyle(e).getPropertyValue('--g-glow').trim() !== '0').length,
      blur: [...document.querySelectorAll('body *')].filter((e) => seen(e) && ((getComputedStyle(e).backdropFilter && getComputedStyle(e).backdropFilter !== 'none') || (getComputedStyle(e).webkitBackdropFilter && getComputedStyle(e).webkitBackdropFilter !== 'none'))).map((e) => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}.${String(e.className).split(' ')[0]}`),
      shadows: all.filter((e) => seen(e) && /rgba?\([^)]*\) [-\d.]+px [-\d.]+px [1-9]/.test(getComputedStyle(e).boxShadow)).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]}`),
      plates: [...document.querySelectorAll('.g-plate, .scanret, .scanco')].filter(seen).length,
      ink: window.__ghosty?.ink ? { on: window.__ghosty.ink.on, tonight: window.__ghosty.ink.tonight, line: window.__ghosty.ink.line } : null,
      topShown: q('#top') ? getComputedStyle(q('#top')).display : 'none',
    };
  });
  check(h.bg === 'rgba(19, 17, 15, 1)' || h.bg.startsWith('rgb') && h.bg.replace(/\s/g, '') === 'rgb(19,17,15)', `[home ${tag}] the ground is ${h.bg} (want the warm ground ${h.canvas})`);
  check(/^(SUN|MON|TUE|WED|THU|FRI|SAT) \d{1,2} [A-Z]{3} · \d{2}:\d{2} · BIRMINGHAM · (WATCHING \d+ FEEDS?|CHECKING FEEDS|NO FEEDS YET|OFFLINE, FEEDS PAUSED) · LOOKING AT HOME$/.test(h.stamp), `[home ${tag}] the masthead reads "${h.stamp}"`);
  check(parseFloat(h.rule) >= 1 && h.ruleStyle === 'solid', `[home ${tag}] the rule under the masthead is ${h.rule} ${h.ruleStyle}`);
  check(/^Good (morning|afternoon|evening|night), Boss\.$/.test(h.say) && h.sayFont === '36px' && /serif|New York|Georgia|Iowan/i.test(h.sayFamily), `[home ${tag}] the greeting is "${h.say}" at ${h.sayFont} in ${h.sayFamily.slice(0, 40)}`);
  check(h.say2.length > 3 && h.say2Style === 'italic' && h.say2Size === '20px', `[home ${tag}] the second line is "${h.say2}" ${h.say2Style} ${h.say2Size}`);
  check(h.ink && h.ink.line === h.say2, `[home ${tag}] the second line is not the one text the state holds: ${JSON.stringify({ line: h.ink?.line, say2: h.say2 })}`);
  check(h.orbCanvas && h.orb && h.orb[2] >= 150 && Math.abs(h.orb[2] - h.orb[3]) <= 1 && (vp === PHONE ? h.orb[2] === 246 : h.orb[2] >= 150), `[home ${tag}] the orb's box is ${h.orb}`);
  check(h.eq && Math.abs(h.orbMid - (h.eq[0] + h.eq[1] / 2)) <= 2, `[home ${tag}] the equator rule (${h.eq}) does not run through the orb's middle (${h.orbMid})`);
  check(h.glow === '0', `[home ${tag}] --g-glow is ${h.glow}, not 0`);
  check(h.entries === 1 && h.kickIndex === '01' && /^TONIGHT|THIS MORNING|TODAY$/i.test(h.kickTag) && /^(Reading|Agenda|Brief)$/.test(h.kickRight), `[home ${tag}] the entry: ${JSON.stringify({ n: h.entries, i: h.kickIndex, t: h.kickTag, r: h.kickRight })}`);
  check(h.name === TITLE && /Alice/.test(h.name) && /serif|New York|Georgia|Iowan/i.test(h.nameFamily) && h.nameSize === '26px', `[home ${tag}] the entry's name is "${h.name}" at ${h.nameSize} in ${h.nameFamily.slice(0, 30)}`);
  check(/^Page 42 · 37 % read · yesterday$/.test(h.line) && /mono|SF Mono|Menlo|ui-monospace/i.test(h.lineFamily), `[home ${tag}] the entry's one true line is "${h.line}" in ${h.lineFamily.slice(0, 30)}`);
  check(h.keys.length === 2 && /fill/.test(h.keys[0].cls) && /ghost/.test(h.keys[1].cls) && h.keys[0].text === 'Carry on reading' && h.keys[1].text === 'Listen', `[home ${tag}] the entry's keys: ${JSON.stringify(h.keys)}`);
  check(h.recent.join() === 'Library,God’s eye,Brief' || h.recent.join() === 'Library,God’s Eye,Brief' || h.recent.length >= 2, `[home ${tag}] RECENT is ${h.recent}`);
  check(h.pins.join() === 'Lens,Agenda' && /^recent$/i.test(h.recentLabel) && /^favourites$/i.test(h.pinsLabel), `[home ${tag}] FAVOURITES is ${h.pins} (${h.pinsLabel} / ${h.recentLabel})`);
  check(h.underline === 'underline' && h.recent.length > 0 && h.pins.length > 0, `[home ${tag}] the words are not underlined (${h.underline})`);
  check(h.field === 'Ask or find anything' && h.fieldStyle === 'italic' && /^speak$/i.test(h.speak) && h.speakColour === h.kickColour, `[home ${tag}] the ask line: ${JSON.stringify({ f: h.field, s: h.fieldStyle, sp: h.speak, c: h.speakColour, accent: h.kickColour })}`);
  check(h.foot.length === 7 && h.foot.map((f) => f.area).join() === 'ask,see,make,learn,plan,life,me' && h.foot[0].lit && h.foot.slice(1).every((f) => !f.lit), `[home ${tag}] the foot: ${JSON.stringify(h.foot)}`);
  check(h.foot[0].label === 'Home', `[home ${tag}] the eye is named "${h.foot[0].label}" (want Home)`);
  check(h.housekick === 'none' && h.houseask === 'none', `[home ${tag}] the house's label row (${h.housekick}) or a second ask line (${h.houseask}) shows`);
  check(h.frameBottom <= h.footTop + 1, `[home ${tag}] the page (${h.frameBottom}) runs under the foot (${h.footTop})`);
  check(h.scanmarks === 0 && h.feeds === 0 && h.plates === 0 && h.topShown === 'none', `[home ${tag}] Scan marks ${h.scanmarks}, feeds ${h.feeds}, plates ${h.plates}, the top bar ${h.topShown}`);
  check(h.glowEls === 0 && !h.blur.length && !h.shadows.length, `[home ${tag}] nothing may glow on the page: --g-glow elsewhere ${h.glowEls}, backdrop-filter ${h.blur}, shadows ${h.shadows}`);
  const bad = await floor(page, vp.width, '.inkframe');
  check(!bad.length, `[home ${tag}] the floor: ${bad.slice(0, 6).join('; ')}`);
  await page.screenshot({ path: `${out}/ink-home-${tag}.png` });
  // the words are real: a tap opens, a long press pins
  await page.click('.inkl[data-list="recent"] .inkword >> nth=0');
  await until(page, () => document.body.dataset.tab === 'library', 8000, `[home ${tag}] a tap on a RECENT word did not open it`);
  const lit = await foot(page);
  check(lit.find((f) => f.lit)?.area === 'learn', `[home ${tag}] on the Library the foot lights ${lit.find((f) => f.lit)?.area} (want learn)`);
  await go(page, 'core');
  await until(page, HOME_READY, 10000, `[home ${tag}] Home did not come back`);
  const holdWord = page.locator('.inkl[data-list="recent"] .inkword').nth(1);
  const id = await holdWord.getAttribute('data-id');
  const box = await holdWord.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(800);
  await page.mouse.up();
  await until(page, () => !!document.querySelector('#pinsheet'), 4000, `[home ${tag}] a long press on a word did not open the pin sheet`);
  check((await page.evaluate(() => document.body.dataset.tab)) === 'core', `[home ${tag}] the long press opened the screen under the sheet`);
  await page.click('#pinsheet [data-pin="pin"]');
  await until(page, (id) => [...document.querySelectorAll('.inkl[data-list="favourites"] .inkword')].some((b) => b.dataset.id === id), 4000, `[home ${tag}] the pinned word ${id} did not move into FAVOURITES`, id);
  await ctx.close();
}

// ---- b2. the thing of the hour: the agenda, the Brief (no book)
{
  const { ctx, page } = await open({ book: false });
  await go(page, 'core');
  await until(page, HOME_READY, 15000, '[hour] Home never became the printed page');
  await page.waitForTimeout(600);
  const brief = await page.evaluate(() => ({ t: window.__ghosty.ink.tonight, keys: [...document.querySelectorAll('.inkentry .keys .g-key')].map((k) => k.textContent.trim()) }));
  check(brief.t.kind === 'brief' && brief.t.name === 'The Brief' && brief.keys.join() === 'Read the brief,Ask me', `[hour] with no book and nothing in the agenda the thing is ${JSON.stringify(brief)}`);
  // the hour's word: an evening says TONIGHT, a morning THIS MORNING
  await page.evaluate(() => { window.__ghosty.ink.clock = () => new Date(2026, 10, 8, 21, 8).getTime(); });
  await page.evaluate(() => window.__ghosty.run?.('noop'));
  await go(page, 'settings');
  await go(page, 'core');
  await until(page, HOME_READY, 10000, '[hour] Home did not come back');
  check((await page.evaluate(() => window.__ghosty.ink.tonight.tag)) === 'Tonight', '[hour] at 21:08 the tag does not say TONIGHT');
  await page.evaluate(() => { window.__ghosty.ink.clock = () => new Date(2026, 10, 8, 9, 8).getTime(); });
  await go(page, 'settings');
  await go(page, 'core');
  await until(page, HOME_READY, 10000, '[hour] Home did not come back');
  check((await page.evaluate(() => window.__ghosty.ink.tonight.tag)) === 'This morning', '[hour] at 09:08 the tag does not say THIS MORNING');
  await ctx.close();
}

// ---- c. the foot on every screen: LEARN, Settings; the plan from a long press on the eye; the jump bar from the ask line
for (const [vp, tag] of [[PHONE, '440'], [WIDE, '390']]) {
  const { ctx, page } = await open({ viewport: vp });
  await go(page, 'core');
  await until(page, HOME_READY, 15000, `[foot ${tag}] Home never became the printed page`);
  // LEARN: the room's hub in ink
  await page.click('#dock .tabcap button[data-area="learn"]');
  await until(page, () => document.body.dataset.tab === 'area-learn', 8000, `[foot ${tag}] the LEARN key did not open the room`);
  await page.waitForTimeout(900);
  const l = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const css = (e, p) => (e ? getComputedStyle(e).getPropertyValue(p).trim() : '');
    const keys = [...document.querySelectorAll('#dock .tabcap button')].map((b) => ({ area: b.dataset.area, lit: b.classList.contains('on'), colour: getComputedStyle(b).color }));
    const pg = q('#pg-area-learn') ?? q('.pg.on') ?? q('#stage > .pg');
    const pr = [...document.querySelectorAll('#stage > .pg')].filter((p) => p.getClientRects().length && getComputedStyle(p).display !== 'none').map((p) => Math.round(p.getBoundingClientRect().bottom));
    const top = q('#top');
    const title = q('#top .navtitle');
    return { keys, footTop: Math.round(q('#dock .tabcap').getBoundingClientRect().top), pageBottom: Math.max(...pr, 0), title: title?.textContent.trim(), titleFamily: css(title, 'font-family'), titleSize: css(title, 'font-size'), stamp: q('#top .headstamp')?.textContent.replace(/\s+/g, ' ').trim(), stampRule: css(q('#top .headstamp'), 'border-bottom-width'),
      kick: css(q('#dock .housekick'), 'display'), ask: css(q('#dock .houseask'), 'display'), arms: css(document.documentElement, '--g-ret-arm'), pageEl: !!pg, retArm: [...document.querySelectorAll('.g-ret-frame')].length,
      keyColours: { lit: keys.find((k) => k.lit)?.colour, rest: keys.find((k) => !k.lit && k.area !== 'ask')?.colour }, ink1: css(document.documentElement, '--g-ink-1'), ink2: css(document.documentElement, '--g-ink-2') };
  });
  check(l.keys.length === 7 && l.keys.filter((k) => k.lit).map((k) => k.area).join() === 'learn', `[foot ${tag}] on LEARN the foot lights ${l.keys.filter((k) => k.lit).map((k) => k.area)}`);
  check(l.pageBottom > 0 && l.pageBottom <= l.footTop + 1, `[foot ${tag}] LEARN's page ends at ${l.pageBottom}, under the foot at ${l.footTop}`);
  check(/serif|New York|Georgia|Iowan/i.test(l.titleFamily) && /^(34|28|22)px$/.test(l.titleSize) && /LEARN/i.test(l.title ?? ''), `[foot ${tag}] the page's name is "${l.title}" in ${l.titleFamily.slice(0, 30)} at ${l.titleSize} (want the serif)`);
  check(/LOOKING AT/i.test(l.stamp ?? '') && parseFloat(l.stampRule) >= 1, `[foot ${tag}] the stamp on LEARN: "${l.stamp}" rule ${l.stampRule}`);
  check(l.kick === 'none' && l.ask === 'none', `[foot ${tag}] a room's screen still has the house's label row (${l.kick}) or a second ask line (${l.ask})`);
  check(l.arms === '0px', `[foot ${tag}] --g-ret-arm is ${l.arms} (want no reticle arms)`);
  check(l.keyColours.lit !== l.keyColours.rest, `[foot ${tag}] the lit key is drawn as the rest: ${JSON.stringify(l.keyColours)}`);
  const bad = await floor(page, vp.width, '#stage > .pg');
  check(!bad.length, `[foot ${tag}] LEARN's floor: ${bad.slice(0, 6).join('; ')}`);
  await page.screenshot({ path: `${out}/ink-learn-${tag}.png` });
  // a room's screen in under 300 ms from the foot's tap
  const room = await timed(page, () => page.click('#dock .tabcap button[data-area="see"]'), 'see');
  timings.push(`room ${tag}: SEE's screen ${room} ms after the tap`);
  check(room != null && room < BUDGET, `[speed ${tag}] a room's screen took ${room} ms (the budget is ${BUDGET} ms)`);
  // Settings: ME lit
  await go(page, 'settings');
  await page.waitForSelector('#pg-settings.listmode .scanset button.srow', { timeout: 15000 }).catch(() => undefined);
  await page.waitForTimeout(500);
  const st = await page.evaluate(() => ({ lit: [...document.querySelectorAll('#dock .tabcap button.on')].map((b) => b.dataset.area).join(), footTop: Math.round(document.querySelector('#dock .tabcap').getBoundingClientRect().top), bottom: Math.max(...[...document.querySelectorAll('#stage > .pg')].filter((p) => p.getClientRects().length).map((p) => Math.round(p.getBoundingClientRect().bottom))), title: document.querySelector('#top .navtitle')?.textContent.trim(), sets: document.querySelectorAll('#pg-settings .scanset button.srow').length, setBorder: getComputedStyle(document.querySelector('#pg-settings .scanset')).borderLeftWidth }));
  check(st.lit === 'me' && st.bottom <= st.footTop + 1 && /SETTINGS/i.test(st.title ?? '') && st.sets > 5, `[foot ${tag}] Settings: ${JSON.stringify(st)}`);
  await page.screenshot({ path: `${out}/ink-settings-${tag}.png` });
  const sbad = await floor(page, vp.width, '#stage > .pg');
  check(!sbad.length, `[foot ${tag}] Settings' floor: ${sbad.slice(0, 6).join('; ')}`);
  await ctx.close();
}

// ---- c2. the plan from a long press on the eye (7 rooms, rules); the jump bar from the ask line: "rad" → RADIO · 04, under 300 ms
{
  const { ctx, page } = await open({});
  await go(page, 'core');
  await until(page, HOME_READY, 15000, '[plan] Home never became the printed page');
  const eye = page.locator('#dock .tabcap button[data-area="ask"]');
  const eb = await eye.boundingBox();
  await page.mouse.move(eb.x + eb.width / 2, eb.y + eb.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(900);
  await page.mouse.up();
  await until(page, () => !!document.querySelector('#plan'), 4000, '[plan] a long press on the eye did not open the plan');
  const pl = await page.evaluate(() => ({ rooms: [...document.querySelectorAll('#plan .planroom')].map((r) => r.querySelector('.rtitle')?.textContent), things: document.querySelectorAll('#plan .planthing').length, tab: document.body.dataset.tab, switcher: !!document.querySelector('.switcher:not([hidden]), #switcher:not([hidden])'), foot: document.querySelectorAll('#dock .tabcap button').length, footShown: getComputedStyle(document.querySelector('#dock .tabcap')).visibility, lit: document.querySelector('#plan .planroom.lit .rtitle')?.textContent, border: getComputedStyle(document.querySelector('#plan .planroom')).borderTopWidth, shadow: getComputedStyle(document.querySelector('#plan')).boxShadow, bottom: Math.round(document.querySelector('#plan').getBoundingClientRect().bottom), footTop: Math.round(document.querySelector('#dock .tabcap').getBoundingClientRect().top) }));
  check(pl.rooms.length === 7 && pl.rooms.join() === 'HOME,SEE,MAKE,LEARN,PLAN,LIFE,ME' && pl.things > 30 && pl.tab === 'core' && !pl.switcher, `[plan] the plan: ${JSON.stringify(pl)}`);
  check(pl.lit === 'HOME' && pl.footShown === 'visible' && pl.bottom <= pl.footTop + 1, `[plan] the plan stands on the foot: ${JSON.stringify({ lit: pl.lit, foot: pl.footShown, bottom: pl.bottom, footTop: pl.footTop })}`);
  await page.screenshot({ path: `${out}/ink-plan.png` });
  // a tap on a number opens it
  await page.click('#plan .planthing[data-room="see"] >> nth=0');
  await until(page, () => document.body.dataset.tab !== 'core' && !document.querySelector('#plan'), 6000, '[plan] a tap on a number did not open the thing and close the plan');
  await go(page, 'core');
  await until(page, HOME_READY, 10000, '[plan] Home did not come back');
  // the plan by words: "the plan" typed into the jump bar, Enter
  await page.click('.inkfield');
  await page.waitForSelector('#palette.on input', { timeout: 5000 });
  await page.fill('#palette input', 'the plan');
  await page.press('#palette input', 'Enter');
  await until(page, () => !!document.querySelector('#plan'), 4000, '[plan] "the plan" typed in the jump bar did not open the plan');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  // the jump bar from the ask line: the open under 300 ms (median of five), "rad" finds RADIO · 04
  const opens = [];
  for (let i = 0; i < 5; i++) {
    await go(page, 'core');
    await until(page, HOME_READY, 10000, '[jump] Home did not come back');
    await page.waitForTimeout(250);
    const ms = await timed(page, () => page.click('.inkfield'), 'jump');
    opens.push(ms ?? 9999);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }
  timings.push(`jump bar: opens ${opens.join(', ')} ms from the ask line (median ${median(opens)})`);
  check(median(opens) < BUDGET, `[speed] the jump bar's open took ${median(opens)} ms (median of five: ${opens.join(', ')}; the budget is ${BUDGET} ms)`);
  await go(page, 'core');
  await until(page, HOME_READY, 10000, '[jump] Home did not come back');
  await page.click('.inkfield');
  await page.waitForSelector('#palette.on input', { timeout: 5000 });
  const t0 = Date.now();
  await page.fill('#palette input', 'rad');
  await until(page, () => /^RADIO · 04$/i.test(window.__ghosty?.jump?.found ?? ''), 4000, '[jump] "rad" did not find RADIO · 04');
  timings.push(`jump bar: "rad" found in ${Date.now() - t0} ms`);
  const jp = await page.evaluate(() => ({ found: window.__ghosty.jump.found, checked: window.__ghosty.jump.checked, open: !!document.querySelector('#palette .jplate [data-act="open"]'), cls: document.querySelector('#palette')?.className, radius: getComputedStyle(document.querySelector('#palette .jplate')).borderTopLeftRadius, blur: getComputedStyle(document.querySelector('#palette')).backdropFilter }));
  check(jp.open && /scanjump/.test(jp.cls) && jp.radius === '0px' && jp.blur === 'none', `[jump] the typed bar: ${JSON.stringify(jp)}`);
  await page.screenshot({ path: `${out}/ink-jump-typed.png` });
  await page.click('#palette .jplate [data-act="open"]');
  await until(page, () => document.body.dataset.tab === 'radio', 8000, '[jump] OPEN did not open Radio');
  const rl = await foot(page);
  check(rl.find((f) => f.lit)?.area === 'life' || rl.some((f) => f.lit), `[jump] on Radio the foot lights ${rl.find((f) => f.lit)?.area}`);
  await ctx.close();
}

// ---- d. Home in ink under 300 ms (median of five), from the foot's eye on another screen
{
  const { ctx, page } = await open({ book: true });
  await go(page, 'core');
  await until(page, HOME_READY, 15000, '[speed] Home never became the printed page');
  const times = [];
  for (let i = 0; i < 5; i++) {
    await page.click('#dock .tabcap button[data-area="see"]');
    await until(page, () => document.body.dataset.tab === 'area-see', 8000, '[speed] SEE did not open');
    await page.waitForTimeout(500);
    const ms = await timed(page, () => page.click('#dock .tabcap button[data-area="ask"]'), 'home');
    times.push(ms ?? 9999);
    await page.waitForTimeout(400);
  }
  timings.push(`home: ink opens ${times.join(', ')} ms from the eye (median ${median(times)})`);
  check(median(times) < BUDGET, `[speed] Home in ink opened in ${median(times)} ms (median of five: ${times.join(', ')}; the budget is ${BUDGET} ms)`);
  await ctx.close();
}

// ---- e. nothing of ink in The Scan and Glass (a pixel diff against the build before, when INK_BEFORE names its shots), and the world's own reach
async function shoot(look, W, name) {
  const { ctx, page } = await open({ viewport: W, look, book: true });
  await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; } canvas, .g-stamp, #top .clock, .where, .scanwhere, .rcdate, #ccap, .hstamp, .wallhead { visibility: hidden !important; }' });
  const files = {};
  for (const [id, hash, sel] of [['home', 'core', null], ['learn', 'area-learn', '#pg-area-learn'], ['settings', 'settings', '#pg-settings']]) {
    await go(page, hash);
    await page.waitForTimeout(1500);
    const f = `${out}/ink-diff-${name}-${id}-${W.width}.png`;
    await page.screenshot({ path: f });
    files[id] = f;
  }
  const own = await page.evaluate(() => ({ inkhome: document.body.classList.contains('inkhome'), frame: !!document.querySelector('.inkframe') && getComputedStyle(document.querySelector('.inkframe')).display !== 'none', housed: document.body.classList.contains('housed'), world: document.documentElement.dataset.world }));
  await ctx.close();
  return { files, own };
}
const diffPng = async (a, b) => {
  const page = await (await browser.newContext()).newPage();
  const r = await page.evaluate(async ([a, b]) => {
    const load = (u) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
    const [x, y] = await Promise.all([load(a), load(b)]);
    if (x.width !== y.width || x.height !== y.height) return { size: [x.width, x.height, y.width, y.height] };
    const px = (i) => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height).data; };
    const p = px(x), q = px(y);
    let n = 0;
    for (let k = 0; k < p.length; k += 4) if (Math.abs(p[k] - q[k]) + Math.abs(p[k + 1] - q[k + 1]) + Math.abs(p[k + 2] - q[k + 2]) > 24) n++;
    return { n, total: p.length / 4 };
  }, [`data:image/png;base64,${readFileSync(a).toString('base64')}`, `data:image/png;base64,${readFileSync(b).toString('base64')}`]);
  await page.context().close();
  return r;
};
{
  const rec = process.env.INK_RECORD;
  const before = process.env.INK_BEFORE;
  for (const [look, name] of [[SCAN, 'scan'], [GLASS, 'glass']]) {
    for (const W of [PHONE]) {
      const s = await shoot(look, W, name);
      check(!s.own.inkhome && !s.own.frame, `[world] ${name} wears ink: ${JSON.stringify(s.own)}`);
      check(s.own.housed === (name === 'scan'), `[world] ${name}: body.housed is ${s.own.housed}`);
      if (rec) {
        mkdirSync(rec, { recursive: true });
        for (const [id, f] of Object.entries(s.files)) writeFileSync(`${rec}/${name}-${id}-${W.width}.png`, readFileSync(f));
      }
      if (before) {
        for (const [id, f] of Object.entries(s.files)) {
          const was = `${before}/${name}-${id}-${W.width}.png`;
          if (!existsSync(was)) { problems.push(`[diff] no picture from the build before: ${was}`); continue; }
          const d = await diffPng(was, f);
          const pct = d.n != null ? (100 * d.n) / d.total : 100;
          timings.push(`diff ${name} ${id} ${W.width}: ${d.n ?? 'size differs'} of ${d.total ?? '?'} pixels (${pct.toFixed(3)} %)`);
          check(d.n != null && pct < 1.5, `[diff] ${name} ${id} at ${W.width}: ${JSON.stringify(d)} differs from the build before (live readings only may differ)`);
        }
      }
    }
  }
}

// ---- f. the chat in ONE INK: the conversation's log is drawn (it was 0 × 0: its column was hidden), between the one key at the top and the ask line
for (const [vp, tag] of [[PHONE, '440'], [WIDE, '390']]) {
  const { ctx, page } = await open({ viewport: vp });
  await go(page, 'core');
  await until(page, HOME_READY, 15000, `[chat ${tag}] Home never became the printed page`);
  await page.evaluate(() => document.querySelector('.logbtn')?.click());
  await page.waitForSelector('#cin', { state: 'visible', timeout: 15000 }).catch(() => problems.push(`[chat ${tag}] the chat's ask line never showed`));
  await page.fill('#cin', 'hello there');
  await page.press('#cin', 'Enter');
  await until(page, () => [...document.querySelectorAll('#pg-core .msg:not(.me)')].some((m) => /hello there/.test(m.textContent ?? '')), 15000, `[chat ${tag}] the reply never landed in the log`);
  await page.waitForTimeout(600);
  // (the newest reply rises into place: measured once it has)
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined)))).catch(() => undefined);
  const c = await page.evaluate(() => {
    const box = (s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), b: Math.round(r.bottom) } : null; };
    const msgs = [...document.querySelectorAll('#pg-core .convo .msg')].filter((m) => m.getClientRects().length);
    const last = document.querySelector('#pg-core .convo .msg.latest');
    return { ink: document.body.classList.contains('inkhome'), logopen: !!document.querySelector('.hud.core.logopen'), convo: box('.convo'), log: box('.convo .log'), bar: box('#cbar'), top: box('#top .logbtn'), msgs: msgs.length, lastBottom: last ? Math.round(last.getBoundingClientRect().bottom) : null, W: innerWidth, sideways: document.documentElement.scrollWidth };
  });
  check(c.ink && c.logopen, `[chat ${tag}] the chat is not open in ONE INK: ${JSON.stringify(c)}`);
  check(!!c.log && c.log.w > vp.width / 2 && c.log.h > 200 && c.log.x >= 0 && c.log.x + c.log.w <= vp.width, `[chat ${tag}] the conversation log is not drawn (was 0 × 0): ${JSON.stringify(c.log)}`);
  check(c.msgs >= 2, `[chat ${tag}] the sentences are not drawn: ${c.msgs} messages shown`);
  check(!!c.log && !!c.bar && c.log.b <= c.bar.y + 1, `[chat ${tag}] the log runs under the ask line: ${JSON.stringify([c.log, c.bar])}`);
  check(!!c.log && !!c.top && c.log.y >= c.top.b - 1, `[chat ${tag}] the log runs under the way-back key: ${JSON.stringify([c.log, c.top])}`);
  check(c.lastBottom != null && c.bar && c.lastBottom <= c.bar.y, `[chat ${tag}] the last sentence is hidden behind the ask line`);
  check(c.sideways <= c.W + 1, `[chat ${tag}] the page scrolls sideways: ${c.sideways}`);
  await page.screenshot({ path: `${out}/ink-chat-${tag}.png` });
  await ctx.close();
}

await browser.close();
timings.push(`whole run ${Math.round((Date.now() - T0) / 1000)} s`);
console.log(timings.map((t) => `TIMING ${t}`).join('\n'));
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'ONE INK run clean at 440 × 956 and 390 × 844: the gallery built and kept, Home the printed page, the chat log drawn, the foot on every screen, the plan, the jump bar, under budget, The Scan and Glass untouched.');
process.exit(problems.length ? 1 : 0);
