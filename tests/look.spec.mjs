// SETTINGS → THE LOOK (BRIEF-DESIGN-SYSTEM 5 and 6; his pick, W1 THE SCAN, OWNER-ISSUES 139): the design system's own screen on
// the owner's iPhone 18 Pro Max (440 × 956) and at 390 × 844, with software WebGL for the orb (as tests/hero.spec.mjs runs Mind).
// Every check fails on the code before the system (there was no THE LOOK, and two themes):
//  1. it opens in TWO TAPS from Settings (the Appearance pill from another section, then its row) and lands, the first time, on
//     MARKS; THE SPEED BUDGET (STANDARD's two habits): the screen opens in under 300 ms on the preview, measured by the phone's own
//     stopwatch (the first open, built then, and the second), printed and held;
//  2. every section: TOKENS (every token with its value and job, the inks with their contrast measured, at the floor), TYPE (the
//     twelve styles at their own sizes, nothing under 12), MARKS (the eleven, each named and numbered), MIND (THE ORB ITSELF,
//     BRIEF-ORB-AND-BOOT: Home's one Mind borrowed, never a copy, one WebGL canvas in the page; its five states as five stills
//     drawn from that one context, each named with its one line, each a different picture; the live orb with a key for each
//     state, ATTENDING locking the box on it; given back to Home's hero when the screen is left), THEMES (the twelve swatches
//     with their measured contrast);
//  3. the marks work: the reticle attends when tapped and says so, the typed-out line types, the line of sight draws, the search
//     finds the agenda, and THE RECOGNITION TONE FIRES ONCE: a tap on a thing locks the box with one tone, a second tap on the same
//     thing makes none, the key's press is recognised with one; with his sounds off the box still locks and no tone plays (said);
//  4. THE TWELVE SWATCHES APPLY at once (the page's accent, his setting, the toast) and THE PICK SURVIVES A RELOAD; the next cold
//     open's BOOT plays in the picked colour;
//  5. nothing sideways and every control named and 44 pt or more, in every section, at 440 and at 390;
//  6. the states said in a sentence: Reduce Motion on (the orb holds still, the typed line shows whole), sound off, no 3-D (the orb
//     cannot be drawn here, said; Chromium only).
//  7. THEMES THAT MEAN SOMETHING (BRIEF-THEMES-2) AND THE GALLERY (BRIEF-THEME-GALLERY; every check fails on the code before it — run
//     against it once): the Theme page two taps from Settings is SEVEN LOOKS as stills (THE SCAN marked YOU'RE IN IT, two COMING: ONE INK, THE MAP and THE EYE are built) and
//     the twelve colours, and nothing else (no dial, switch, ground row or preset on it: the selectors are asserted absent), the row
//     saying the recipe; a tap on GLASS and on THE SCAN (the world at once, Home's frame, kept across a reload), a tap on THE MAP (one
//     toast, nothing changed); the stills (img, width, height, alt, loaded, each under 60 KB); the twelve colours apply at once, are
//     kept and the boot plays in them; the page opens in under 300 ms; EACH GROUND is reached by words now ("black background",
//     "paper"), applies at once, is kept across a reload and the boot plays on it; PAPER IS READABLE (every text on the Theme page and
//     THE LOOK measured against what it sits on); the looks by words; EACH WORLD changes the floor behind every screen, Home's
//     corners and the reticle (computed styles, measured, on THE LOOK's dials, which stay); EACH SWITCH changes its one thing; a
//     changed dial is Custom and kept; THE SCAN and GLASS whole; "black background" by words with no model (the brain never asked);
//     GROUND FOLLOWS THE DAY flips at sunset on a stand-in clock; the Theme page named, 44 pt and nothing sideways at 390 and 440,
//     and at BODY 21 (reached by "bigger text").
//   BASE=http://localhost:8795 node tests/look.spec.mjs [outDir]
import { mkdirSync, statSync } from 'node:fs';
import { PHONE, UK, openSection, standDown } from './nav.mjs';
import { engine, isWebKit, launch, webkitNoise } from './browser.mjs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const SMALL = { width: 390, height: 844 };
const BUDGET = 300;
const problems = [];
const notes = [];
const check = (ok, what) => void (ok || problems.push(what));
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const SECTIONS = ['tokens', 'type', 'marks', 'mind', 'themes'];
const TWELVE = ['reactor', 'graphite', 'ember', 'gold', 'crimson', 'violet', 'emerald', 'ice', 'rose', 'lime', 'sunset', 'mono'];
/** The presets (BRIEF-THEMES-2 5): the twelve, then the directions seen along the way. */
const PRESETS17 = [...TWELVE, 'scan', 'map', 'eye', 'oneink', 'glass'];

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: GL });
await standDown(base);

async function phone(viewport, extra = {}, b = browser) {
  const ctx = await b.newContext({ viewport, ...UK, ...extra });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${viewport.width}] pageerror: ${e.message}`));
  // this check wants Mind (automated checks otherwise get the 2-D reactor: mind.ts), so THE LOOK can borrow it
  await page.addInitScript(() => { window.__ghostyHero = true; });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pair input', { timeout: 20000 });
  await page.fill('#pair input', KEY);
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
  // the tone needs his sounds on (the default); the counting listener sees every sound the page plays
  await page.evaluate(() => {
    window.__ghosty.settings.set({ sounds: true });
    window.__sfx = [];
    document.addEventListener('ghosty-sfx', (e) => window.__sfx.push(e.detail));
  });
  return { ctx, page };
}
const look = (page) => page.evaluate(() => JSON.parse(JSON.stringify({ ...window.__ghosty.look, opened: window.__ghosty.look?.opened() ?? null })));
const until = async (page, fn, arg, ms, what) => {
  const ok = await page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
  if (!ok && what) problems.push(what);
  return ok;
};
async function openLookSection(page, id) {
  await page.click(`#pg-look .secpill[data-sec="${id}"]`);
  await until(page, (id) => window.__ghosty.look?.built.includes(id) && !document.querySelector(`#pg-look .pn[data-sec="${id}"]`)?.hidden, id, 6000, `[look] the ${id} section did not show`);
  await page.waitForTimeout(350);
}

/** In the screen: anything poking out sideways, a control with no name, and a control under 44 pt (the visible ones). */
async function measure(page, W) {
  return page.evaluate((W) => {
    const root = document.getElementById('pg-look');
    const seen = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
    const side = [];
    for (const el of root.querySelectorAll('*')) {
      if (!seen(el) || el.closest('.secpills.scrolls') || el.closest('svg')) continue;
      const r = el.getBoundingClientRect();
      if (r.right > W + 0.5 || r.left < -0.5) side.push(`${el.tagName.toLowerCase()}.${String(el.className.baseVal ?? el.className).split(' ')[0]} ${Math.round(r.left)}–${Math.round(r.right)}`);
    }
    const controls = [...root.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [role="radio"], [role="tab"], [role="switch"]')].filter(seen);
    const unnamed = controls.filter((c) => !(c.getAttribute('aria-label') || c.textContent || '').trim()).map((c) => c.outerHTML.slice(0, 80));
    const small = controls.map((c) => [c, c.getBoundingClientRect()]).filter(([, r]) => r.width < 43.5 || r.height < 43.5).map(([c, r]) => `${(c.getAttribute('aria-label') || c.textContent || '').trim().slice(0, 30)} ${Math.round(r.width)}×${Math.round(r.height)}`);
    return { side: side.slice(0, 6), unnamed: unnamed.slice(0, 6), small: small.slice(0, 6), controls: controls.length, scroll: document.documentElement.scrollWidth };
  }, W);
}
/** Settings drawn as THE SCAN's plate (`.scanset`) or as the Glass list: the two drawings reach THE LOOK and the Theme page by their own taps. */
const onPlate = (p) => p.evaluate(() => { const e = document.querySelector('#pg-settings .scanset'); return !!e && !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length); });
const plateRow = (p, name) => p.locator('#pg-settings .scanset button.srow').filter({ has: p.locator('.srname', { hasText: new RegExp(`^${name}$`, 'i') }) }).first();
/** The Theme row's words: the plate row's whole value in the Scan, the list row's label in Glass. */
const themeRowWords = async (p) => (await onPlate(p))
  ? ((await plateRow(p, 'Theme').locator('.srvalue').evaluate((e) => e.textContent ?? '').catch(() => '')) ?? '').trim()
  : ((await p.locator('#pg-settings .pn.themepn > h3 small').getAttribute('data-label').catch(() => '')) ?? '');
async function sweep(page, W, tagname) {
  for (const id of SECTIONS) {
    await openLookSection(page, id);
    const m = await measure(page, W);
    check(m.scroll <= W, `[${W}] ${id}: the page scrolls sideways (${m.scroll})`);
    check(!m.side.length, `[${W}] ${id}: sticks out sideways: ${m.side.join(' | ')}`);
    check(!m.unnamed.length, `[${W}] ${id}: a control with no name: ${m.unnamed.join(' | ')}`);
    check(!m.small.length, `[${W}] ${id}: under 44 pt: ${m.small.join(' | ')}`);
    await page.screenshot({ path: `${out}/look-${engine}-${W}-${id}${tagname}.png` });
  }
}

// ======================================================================== 1. two taps from Settings, the speed budget
const { ctx, page } = await phone(PHONE);
await page.evaluate(() => (location.hash = 'settings'));
await page.waitForSelector('#pg-settings.listmode .scanset button.srow, #pg-settings.listmode .pn[data-row]', { timeout: 15000 }).catch(() => problems.push('[settings] the list never drew'));
await page.waitForTimeout(500);
const plate = await onPlate(page);
notes.push(`Settings is drawn as ${plate ? "THE SCAN's plate" : "Glass's list"}`);
// Settings on another section (the worst case: the row is not on screen yet), then the taps (two in Glass, one on the plate)
if (!plate) await openSection(page, 'settings', 'About');
const row = plate ? '#pg-settings .scanset button.srow[data-title="THE LOOK"]' : '#pg-settings .pn[data-row][data-go="look"] > h3';
if (plate) check(!(await page.locator('#pg-settings .scanset .setgroup[data-group="about"] button.srow[data-title="THE LOOK"]').count()), '[settings] THE LOOK\'s row sits under ABOUT on the plate (it belongs under THE LOOK)');
else check(!(await page.locator(row).isVisible().catch(() => false)), '[settings] THE LOOK\'s row shows under About (it belongs under Appearance)');
/** The page at rest (Settings draws its panels for a moment after it shows): a person reads the list before tapping. */
const idle = (p) => p.evaluate(() => new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(() => r(), { timeout: 3000 }) : setTimeout(r, 300))));
await page.waitForTimeout(800);
await idle(page);
if (!plate) await openSection(page, 'settings', 'Appearance'); // tap 1 (Glass)
if (plate) {
  check(await page.locator('#pg-settings .scanset .setgroup[data-group="the look"] button.srow[data-title="THE LOOK"]').isVisible().catch(() => false), '[settings] THE LOOK has no row on the plate under THE LOOK');
  const rn = (await plateRow(page, 'The look').locator('.srname').textContent().catch(() => '')) ?? '';
  check(/^the look$/i.test(rn), `[settings] the plate row is called "${rn}"`);
} else {
  check(await page.locator(row).isVisible().catch(() => false), '[settings] THE LOOK has no row under Appearance');
  const rowName = (await page.locator('#pg-settings .pn[data-go="look"] .ptitle').textContent().catch(() => '')) ?? '';
  check(/the look/i.test(rowName), `[settings] the row is called "${rowName}"`);
}
await idle(page);
await page.click(row); // tap 2 in Glass; the one tap on the plate
await until(page, () => window.__ghosty.ui.get().tab === 'look' && document.getElementById('pg-look')?.classList.contains('on'), null, 8000, plate ? '[look] one tap on the plate (Glass: two taps from Settings) did not open THE LOOK' : '[look] two taps from Settings did not open THE LOOK');
await until(page, () => !!window.__ghosty.look?.opened(), null, 3000, '[speed] the stopwatch has no open of THE LOOK');
const first = await look(page);
check(first.opened?.first === true, `[speed] the first open was not timed as the first: ${JSON.stringify(first.opened)}`);
check(first.opened && first.opened.ms < BUDGET, `[speed] THE LOOK took ${first.opened?.ms} ms to open the first time (the budget is ${BUDGET} ms)`);
check(first.section === 'marks', `[look] the first open lands on "${first.section}", not MARKS (where "tap a mark" is)`);
const top = (await page.locator('#pg-look .glook-say').textContent().catch(() => '')) ?? '';
check(top === 'This is how I draw everything from here. Tap a mark to see it work.', `[look] the top line: "${top}"`);
const stampText = (await page.locator('#pg-look .glook-head .g-stamp').getAttribute('aria-label').catch(() => '')) ?? '';
check(/^\w{3} \d{1,2} \w{3}, \d\d:\d\d, .+, (Watching \d+ feeds?|Checking feeds|No feeds yet|Offline, feeds paused), Looking at the marks$/.test(stampText), `[look] the stamp line: "${stampText}"`);
// the second open (built already): back to Settings and in again
await page.click('#top .navback');
await until(page, () => window.__ghosty.ui.get().tab === 'settings', null, 5000, '[look] back did not go to Settings');
await page.waitForTimeout(600);
await idle(page);
await page.click(row);
await until(page, () => window.__ghosty.ui.get().tab === 'look', null, 5000, '[look] the second open did not happen');
await page.waitForTimeout(400);
const second = await look(page);
check(second.opened?.first === false && second.opened.ms < BUDGET, `[speed] the second open: ${JSON.stringify(second.opened)}`);
notes.push(`THE LOOK opens in ${first.opened?.ms} ms the first time (built then) and ${second.opened?.ms} ms after (the budget ${BUDGET} ms)`);

// ======================================================================== 2. every section, and 5. at 440
await openLookSection(page, 'tokens');
const tok = await page.evaluate(() => ({ rows: document.querySelectorAll('#pg-look .gtok').length, jobs: [...document.querySelectorAll('#pg-look .gtok .gtok-job')].filter((j) => j.textContent.trim().length > 10).length, groups: document.querySelectorAll('#pg-look .gtok-group').length, canvas: document.querySelector('#pg-look .gtok[data-token="--g-canvas"] .gtok-val')?.textContent }));
const tokenCount = Number((await page.locator('#pg-look .pn[data-sec="tokens"] > h3 small').getAttribute('data-label').catch(() => '0'))?.match(/\d+/)?.[0] ?? 0);
check(tok.rows >= 75 && tok.rows === tokenCount && tok.jobs === tok.rows && tok.groups >= 10, `[tokens] ${JSON.stringify({ ...tok, tokenCount })}`);
check(tok.canvas === '#101317', `[tokens] the canvas reads "${tok.canvas}"`);
const reads = (await look(page)).contrast;
for (const n of ['--g-ink-1', '--g-ink-2', '--g-ink-3', '--g-ink-4']) check(reads[n]?.length === 3 && Math.min(...reads[n]) >= 4.5, `[tokens] ${n} measured on screen: ${JSON.stringify(reads[n])}`);
for (const n of ['--g-line', '--g-line-faint']) check(reads[n]?.length === 3 && Math.min(...reads[n]) >= 3, `[tokens] ${n} measured on screen: ${JSON.stringify(reads[n])}`);
await openLookSection(page, 'type');
const type = await page.evaluate(() => [...document.querySelectorAll('#pg-look .gtype-sample')].map((s) => ({ t: s.closest('.gtype').dataset.token, px: parseFloat(getComputedStyle(s).fontSize), lh: parseFloat(getComputedStyle(s).lineHeight) })));
check(type.length === 12, `[type] ${type.length} styles shown`);
check(type.every((x) => x.px >= 12 && x.lh % 4 === 0), `[type] a style under 12 pt or off the 4-point line: ${JSON.stringify(type.filter((x) => x.px < 12 || x.lh % 4))}`);
check(type.find((x) => x.t === '--g-t-body')?.px === 17, `[type] the body is not 17: ${JSON.stringify(type.find((x) => x.t === '--g-t-body'))}`);
await openLookSection(page, 'marks');
const marks = await page.evaluate(() => [...document.querySelectorAll('#pg-look .gmark')].map((m) => ({ id: m.dataset.mark, n: m.querySelector('.g-index')?.textContent, name: m.querySelector('.gmark-head .g-tag')?.textContent, rule: m.querySelector('.gmark-rule')?.textContent ?? '' })));
check(marks.length === 11 && marks.every((m, i) => m.n === String(i + 1).padStart(2, '0') && m.name && m.rule.length > 30), `[marks] ${JSON.stringify(marks.map((m) => `${m.n} ${m.id} ${m.name}`))}`);
for (const id of ['stamp', 'reticle', 'tag', 'truth', 'plate', 'key', 'sight', 'typed', 'recognise']) check(marks.some((m) => m.id === id), `[marks] no ${id}`);
await openLookSection(page, 'mind');
// THE ORB ITSELF (BRIEF-ORB-AND-BOOT): Home's one Mind borrowed, drawing here, with its five states as stills from the same context
await until(page, () => (window.__ghosty.look.mind?.frames ?? 0) > 0 || window.__ghosty.look.mind?.mode === 'flat', null, 20000, '[mind] the orb never drew');
const mind0 = (await look(page)).mind;
check(mind0?.mode === 'gl' && mind0.lent === true, `[mind] the orb is not Home's Mind borrowed: ${JSON.stringify(mind0)}`);
check(mind0?.stills === 5, `[mind] ${mind0?.stills} stills drawn (want the five states)`);
const one = await page.evaluate(() => ({ canvases: document.querySelectorAll('canvas.mindhero').length, here: !!document.querySelector('#pg-look .gorbwrap .g-orb > canvas.mindhero'), hero: window.__ghosty.hero?.mode }));
check(one.canvases === 1 && one.here && one.hero === 'mind', `[mind] one WebGL canvas, here: ${JSON.stringify(one)}`);
const stills = await page.evaluate(() => [...document.querySelectorAll('#pg-look .gstate')].map((f) => {
  const c = f.querySelector('canvas.gstill');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let lit = 0;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4 * 5) if (d[i + 3] > 10) { lit++; sum += d[i] + d[i + 1] + d[i + 2]; }
  return { key: f.dataset.state, name: f.querySelector('.g-tag')?.textContent, line: f.querySelector('.gstate-line')?.textContent ?? '', lit, sum, box: !!f.querySelector('.g-lock[data-state="attend"]') };
}));
check(stills.map((x) => x.key).join() === 'idle,listening,attending,thinking,saying', `[mind] the five states: ${stills.map((x) => x.key).join()}`);
check(stills.every((x) => x.name && x.line.length > 20), `[mind] a state without its name or its line: ${JSON.stringify(stills.map((x) => [x.name, x.line]))}`);
check(stills.every((x) => x.lit > 200), `[mind] a still with nothing drawn: ${JSON.stringify(stills.map((x) => [x.key, x.lit]))}`);
check(new Set(stills.map((x) => `${x.lit}:${x.sum}`)).size === 5, `[mind] two states draw the same picture: ${JSON.stringify(stills.map((x) => [x.key, x.lit, x.sum]))}`);
check(stills.find((x) => x.key === 'attending')?.box === true, '[mind] attending has no box on it');
check(/^My orb: idle$/.test((await page.locator('#pg-look .gorblive').getAttribute('aria-label')) ?? ''), '[mind] the orb is not named with its state');
// each state's key sets the live orb's state, says it, and changes the picture; ATTENDING locks the box on the orb
const orbShot = async () => (await page.locator('#pg-look .gorblive').screenshot()).toString('base64');
let prev = await orbShot();
const locks0 = (await look(page)).marks.locks;
for (const st of ['listening', 'attending', 'thinking', 'saying', 'idle']) {
  await page.click(`#pg-look .gstatekeys .g-key[aria-label="My orb ${st}"]`).catch(() => problems.push(`[mind] no ${st.toUpperCase()} key`));
  await page.waitForTimeout(900);
  const m = (await look(page)).mind;
  const want = st === 'saying' ? 'speaking' : st;
  check(m?.state === want, `[mind] after ${st}: the orb is ${m?.state}`);
  check(new RegExp(`^My orb: ${st}`).test((await page.locator('#pg-look .gorblive').getAttribute('aria-label')) ?? ''), `[mind] after ${st}: not said in its name`);
  const now = await orbShot();
  check(now !== prev, `[mind] ${st} drew the same picture as the state before it`);
  prev = now;
  const box = await page.evaluate(() => { const l = document.querySelector('#pg-look .gorbstage .g-lock'); return l && !l.hidden ? l.dataset.state : null; });
  check(st === 'attending' ? box === 'attend' : box === null, `[mind] after ${st}: the box is ${box}`);
  if (st === 'attending') check((await look(page)).marks.locks > locks0, '[mind] attending did not lock the box (marks.locks)');
  if (st === 'attending') await page.screenshot({ path: `${out}/look-${engine}-440-mind-attending.png` });
}
check((await look(page)).mind?.frames > mind0.frames, '[mind] the live orb stopped drawing');
await page.screenshot({ path: `${out}/look-${engine}-440-mind.png` });
await openLookSection(page, 'themes');
const sw = await page.evaluate(() => [...document.querySelectorAll('#pg-look .swatch')].map((b) => ({ k: b.dataset.theme, name: b.querySelector('b')?.textContent, read: b.querySelector('.swread')?.textContent ?? '', accent: getComputedStyle(b).getPropertyValue('--g-accent').trim() })));
check(sw.map((x) => x.k).join() === PRESETS17.join(), `[themes] the swatches (the presets): ${sw.map((x) => x.k).join()}`);
check(sw.every((x) => /^Text \d+\.\d:1 · line \d+\.\d:1$/.test(x.read)), `[themes] a swatch without its measured contrast: ${JSON.stringify(sw.filter((x) => !/^Text/.test(x.read)))}`);
for (const x of sw) {
  const [t, l] = (x.read.match(/\d+\.\d/g) ?? []).map(Number);
  check(t >= 4.5 && l >= 3, `[themes] ${x.k}: ${x.read}`);
}
notes.push(`contrast on screen, weakest surface: ${sw.map((x) => `${x.name} ${x.read.replace('Text ', 'text ')}`).join('; ')}`);
await sweep(page, 440, '');

// ======================================================================== 3. the marks work, and the tone fires once
await openLookSection(page, 'marks');
const sfx = () => page.evaluate(() => window.__sfx.filter((k) => k === 'lock').length);
const locks = () => page.evaluate(() => window.__ghosty.look.marks.locks);
// the reticle attends when tapped, and says so
const ret = page.locator('#pg-look .gmark[data-mark="reticle"] button.g-ret');
await ret.click();
check((await ret.getAttribute('aria-pressed')) === 'true' && (await ret.getAttribute('data-state')) === 'attend' && /attending/.test((await ret.getAttribute('aria-label')) ?? ''), '[reticle] a tap did not attend (and say so)');
check(/Attending/i.test((await page.locator('#pg-look .gmark[data-mark="reticle"] .gstage > .g-truth').textContent()) ?? ''), '[reticle] the words under it do not say it is attending');
await ret.click();
check((await ret.getAttribute('data-state')) === 'watch', '[reticle] a second tap did not let it go');
// the typed-out line typed
await until(page, () => window.__ghosty.look.marks.typed >= 1 && (document.querySelector('#pg-look .g-typed .g-typed-words')?.textContent.length ?? 0) > 30, null, 8000, '[typed] the line never typed out');
// the line of sight draws from the eye to the thing attended
await page.click('#pg-look .gmark[data-mark="sight"] button.g-ret[aria-label^="Agenda"]');
await page.waitForTimeout(600);
const sight = await page.evaluate(() => { const l = document.querySelector('#pg-look .g-sight.on .g-sight-line'); return l ? Math.hypot(l.x2.baseVal.value - l.x1.baseVal.value, l.y2.baseVal.value - l.y1.baseVal.value) : 0; });
check(sight > 20, `[sight] no line of sight drawn (${sight})`);
// THE TONE, ONCE: a thing locked with one tone; the same thing again, none; the key's press, one
const s0 = await sfx();
const l0 = await locks();
await page.click('#pg-look .gmark[data-mark="recognise"] button.gthing[aria-label="Agenda"]');
await page.waitForTimeout(500);
check((await sfx()) === s0 + 1 && (await locks()) === l0 + 1, `[tone] the first lock: ${await sfx() - s0} tones, ${await locks() - l0} locks (one each)`);
await page.click('#pg-look .gmark[data-mark="recognise"] button.gthing[aria-label="Agenda"]');
await page.waitForTimeout(500);
check((await sfx()) === s0 + 1, `[tone] the same thing again played ${await sfx() - s0 - 1} more tones (none)`);
const lockBox = await page.evaluate(() => { const b = document.querySelector('#pg-look .gmark[data-mark="recognise"] .g-lock'); const t = document.querySelector('#pg-look .gmark[data-mark="recognise"] button.gthing[aria-label="Agenda"]'); const a = b.getBoundingClientRect(), c = t.getBoundingClientRect(); return { hidden: b.hidden, d: Math.max(Math.abs(a.left - c.left), Math.abs(a.top - c.top), Math.abs(a.width - c.width), Math.abs(a.height - c.height)) }; });
check(!lockBox.hidden && lockBox.d <= 1.5, `[tone] the box did not land on the thing: ${JSON.stringify(lockBox)}`);
await page.click('#pg-look .gmark[data-mark="key"] .g-key[aria-label^="Open"]');
await page.waitForTimeout(500);
check((await sfx()) === s0 + 2, `[tone] the key's press: ${await sfx() - s0 - 1} tones (one)`);
// his sound setting: off, the box still locks, no tone, and the screen says so
await page.evaluate(() => window.__ghosty.settings.set({ sounds: false }));
await page.waitForTimeout(200);
const l1 = await locks();
await page.click('#pg-look .gmark[data-mark="recognise"] button.gthing[aria-label="Library"]');
await page.waitForTimeout(500);
check((await locks()) === l1 + 1 && (await sfx()) === s0 + 2, `[tone] with sounds off: ${await locks() - l1} locks, ${await sfx() - s0 - 2} tones (one lock, no tone)`);
const offSaid = (await page.locator('#pg-look .glook-states').textContent()) ?? '';
check(/Sound off.*recognition tone stays quiet/.test(offSaid), `[states] sound off is not said: "${offSaid}"`);
check(/sound off, no tone/i.test((await page.locator('#pg-look .gmark[data-mark="recognise"] .gstage > .g-truth').textContent()) ?? ''), '[tone] the lock does not say the tone was off');
await page.screenshot({ path: `${out}/look-${engine}-440-sound-off.png` });
await page.evaluate(() => window.__ghosty.settings.set({ sounds: true }));
// the search finds the agenda, saying each place it checks
await page.click('#pg-look .gmark[data-mark="search"] .g-key');
await until(page, () => /Found it: Agenda/.test(document.querySelector('#pg-look .gmark[data-mark="search"] .gstage > .g-truth')?.textContent ?? ''), null, 8000, '[search] it never said it found the agenda');
check((await page.evaluate(() => window.__ghosty.look.marks.searches)) >= 1, '[search] not counted');

// ======================================================================== 4. the twelve apply at once, the pick survives a reload, the boot's colour
await openLookSection(page, 'themes');
// each once (the same toast twice within a minute shows once: ui/components.ts), Ember last, the one kept
const order = [...TWELVE.slice(1).filter((k) => k !== 'ember'), 'reactor', 'ember'];
for (const k of order) {
  const b = page.locator(`#pg-look .swatch[data-theme="${k}"]`);
  const want = await b.evaluate((el) => getComputedStyle(el).getPropertyValue('--g-accent').trim());
  const label = (await b.locator('b').textContent()) ?? k;
  await b.click();
  await page.waitForTimeout(250);
  const now = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, saved: window.__ghosty.settings.get().theme, c: getComputedStyle(document.documentElement).getPropertyValue('--c').trim(), g: getComputedStyle(document.documentElement).getPropertyValue('--g-accent').trim(), toasts: document.querySelector('#toasts')?.textContent ?? '' }));
  check(now.theme === k && now.saved === k && now.c === want && now.g === want, `[themes] ${k} did not apply at once: ${JSON.stringify({ want, ...now })}`);
  check((await b.getAttribute('aria-checked')) === 'true' && /in use/.test((await b.getAttribute('aria-label')) ?? ''), `[themes] ${k}'s swatch does not say it is in use`);
  check(now.toasts.includes(`Theme: ${label}`), `[themes] no toast for ${k}: "${now.toasts}"`);
}
await page.screenshot({ path: `${out}/look-${engine}-440-themes-ember.png` });
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
const kept = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, saved: window.__ghosty.settings.get().theme, c: getComputedStyle(document.documentElement).getPropertyValue('--c').trim() }));
check(kept.theme === 'ember' && kept.saved === 'ember' && kept.c === '#ff7a3d', `[themes] the pick did not survive a reload: ${JSON.stringify(kept)}`);
// the next cold open plays the boot in the picked colour (the cinematic asked for, as tests/boot.spec.mjs does)
const bootPage = await ctx.newPage();
await bootPage.addInitScript(() => { window.__ghostyBoot = true; });
await bootPage.goto(base, { waitUntil: 'domcontentloaded' });
const played = await until(bootPage, () => !!window.__bootState?.accent, null, 20000, '[boot] the cinematic never started');
if (played) {
  const accent = await bootPage.evaluate(() => window.__bootState.accent);
  check(accent === '#ff7a3d', `[boot] the boot played in "${accent}", not Ember's #ff7a3d`);
  await bootPage.waitForTimeout(900);
  await bootPage.screenshot({ path: `${out}/look-${engine}-boot-ember.png` });
  notes.push(`the boot after picking Ember played in ${accent}`);
}
await bootPage.close();
// back to Reactor for the specs after this one
await page.evaluate(() => window.__ghosty.run('set_theme', { theme: 'reactor' }));
await ctx.close();

// ======================================================================== 5. at 390
{
  const { ctx: c2, page: p2 } = await phone(SMALL);
  await p2.evaluate(() => (location.hash = 'look'));
  await p2.waitForSelector('#pg-look.on .glook', { timeout: 10000 }).catch(() => problems.push('[390] THE LOOK did not open'));
  await p2.waitForTimeout(800);
  await sweep(p2, 390, '');
  await c2.close();
}

// ======================================================================== 6. the states: Reduce Motion, and a browser with no 3-D
{
  const { ctx: c3, page: p3 } = await phone(PHONE, { reducedMotion: 'reduce' });
  await p3.evaluate(() => (location.hash = 'look'));
  await p3.waitForSelector('#pg-look.on .glook', { timeout: 10000 });
  await p3.waitForTimeout(600);
  const said = (await p3.locator('#pg-look .glook-states').textContent()) ?? '';
  check(/Reduce Motion is on.*my orb holds still/.test(said), `[states] Reduce Motion is not said: "${said}"`);
  // the typed line shows whole at once
  await p3.click('#pg-look .gmark[data-mark="typed"] .g-key');
  const whole = await p3.evaluate(() => { const t = document.querySelector('#pg-look .g-typed'); return { n: t.querySelector('.g-typed-words').textContent.length, writing: t.classList.contains('writing') }; });
  check(whole.n > 30 && !whole.writing, `[states] with Reduce Motion the typed line did not show whole: ${JSON.stringify(whole)}`);
  await openLookSection(p3, 'mind');
  await until(p3, () => (window.__ghosty.look.mind?.frames ?? 0) > 0, null, 20000, '[states] with Reduce Motion the orb never drew');
  await p3.click('#pg-look .g-key[aria-label="My orb listening"]');
  await p3.waitForTimeout(900);
  const e = (await look(p3)).mind;
  const f0 = e?.frames ?? 0;
  await p3.waitForTimeout(1200);
  const e2 = (await look(p3)).mind;
  check(e?.still === true && e.state === 'listening' && e2.frames - f0 <= 1, `[states] with Reduce Motion the orb still moves: ${JSON.stringify(e)} then ${e2?.frames} frames`);
  check(/held still/.test((await p3.locator('#pg-look .gorblive').getAttribute('aria-label')) ?? ''), '[states] the orb does not say it is held still');
  await p3.screenshot({ path: `${out}/look-${engine}-440-reduce-motion.png` });
  await c3.close();
}
if (!isWebKit) {
  const flat = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--disable-3d-apis'] });
  const { ctx: c4, page: p4 } = await phone(PHONE, {}, flat);
  await p4.evaluate(() => (location.hash = 'look'));
  await p4.waitForSelector('#pg-look.on .glook', { timeout: 10000 });
  await openLookSection(p4, 'mind');
  await until(p4, () => window.__ghosty.look.mind?.mode === 'flat', null, 20000, '[states] no 3-D: the orb did not say so');
  const e = (await look(p4)).mind;
  const said = (await p4.locator('#pg-look .glook-states').textContent()) ?? '';
  check(e?.mode === 'flat' && /no 3-D, so I can’t draw my orb here/.test(said), `[states] no 3-D: the orb ${JSON.stringify(e)}, said "${said}"`);
  await p4.screenshot({ path: `${out}/look-${engine}-440-flat.png` });
  await c4.close();
  await flat.close();
}


// ======================================================================== 7. THEMES THAT MEAN SOMETHING (BRIEF-THEMES-2)
// A theme is a recipe: the ground, the colour, the world and the switches. Each is measured on screen, never assumed.
{
  const GROUND_CANVAS = { black: '#000000', graphite: '#101317', slate: '#0c1118', warm: '#13110f', paper: '#f3efe6' };
  const LABEL = { black: 'Black', graphite: 'Graphite', slate: 'Slate', warm: 'Warm', paper: 'Paper' };
  const hexOf = (c) => { const m = String(c).match(/[\d.]+/g)?.map(Number) ?? []; return m.length >= 3 ? `#${m.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}` : String(c).trim().toLowerCase(); };
  const alphaOf = (c) => { const m = String(c).match(/[\d.]+/g)?.map(Number) ?? []; return m.length >= 4 ? m[3] : m.length === 3 ? 1 : 0; };
  /** A phone already paired, on a recipe of his (`look`, beside `theme`), optionally on a stand-in clock. */
  async function recipePhone(viewport, { theme = 'reactor', look = null, clock = null } = {}) {
    const c = await browser.newContext({ viewport, ...UK, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
    await c.addInitScript(([k, theme, look]) => {
      localStorage.setItem('ghosty.ownerKey', k);
      localStorage.setItem('ghosty.themes1', '1');
      if (!localStorage.getItem('spec.recipe.seeded')) {
        localStorage.setItem('spec.recipe.seeded', '1');
        localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Boss', home: { name: 'Birmingham', lat: 52.4862, lon: -1.8904 }, units: 'metric', sounds: true, theme, ...(look ? { look } : {}) }));
      }
      window.__sfx = [];
      document.addEventListener('ghosty-sfx', (e) => window.__sfx.push(e.detail));
      window.__ghostyHero = true;
    }, [KEY, theme, look]);
    const p = await c.newPage();
    p.on('pageerror', (e) => webkitNoise(e) || problems.push(`[recipe ${viewport.width}] pageerror: ${e.message}`));
    if (clock) await p.clock.install({ time: new Date(clock) });
    await p.goto(base, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
    return { c, p };
  }
  const state = (p) => p.evaluate(() => ({ ...document.documentElement.dataset, saved: window.__ghosty.settings.get().look, colour: window.__ghosty.settings.get().theme, preset: window.__ghosty.theme.preset(), words: window.__ghosty.theme.words() }));
  /** Settings → Appearance → Theme: two taps (the Appearance pill, the Theme row). */
  async function themePage(p) {
    await p.evaluate(() => (location.hash = 'settings'));
    await p.waitForSelector('#pg-settings.listmode .scanset button.srow, #pg-settings.listmode .pn[data-row]', { timeout: 15000 }).catch(() => undefined);
    await p.waitForTimeout(500);
    const plate = await onPlate(p);
    if (!plate) await openSection(p, 'settings', 'Appearance');
    // the phone's own stopwatch (as THE LOOK's): from the tap to the first frame with the gallery on screen
    await p.evaluate(() => {
      window.__themeOpen = null;
      document.addEventListener('click', () => {
        const t0 = performance.now();
        const tick = () => {
          const r = document.querySelector('#pg-settings .pn.themepn.pushed .gg-look')?.getBoundingClientRect();
          if (r && r.width > 0 && r.height > 0) window.__themeOpen = Math.round(performance.now() - t0);
          else if (performance.now() - t0 < 5000) requestAnimationFrame(tick);
        };
        tick();
      }, { capture: true, once: true });
    });
    if (plate) await plateRow(p, 'Theme').click({ timeout: 8000 });
    else await p.click('#pg-settings .pn[data-row].themepn > h3', { timeout: 8000 });
    await until(p, () => document.querySelector('#pg-settings .pn.themepn')?.classList.contains('pushed') && document.body.classList.contains('g-themepage'), null, 6000, plate ? '[recipe] the one tap on the plate (Glass: two taps) did not open the Theme page' : '[recipe] two taps did not open the Theme page');
    await p.waitForTimeout(450);
    return p.evaluate(() => window.__themeOpen);
  }
  // (a tap's toast is read where it is checked, then cleared, so it never sits over the section pills for the next tap)
  const clearToasts = (p) => p.evaluate(() => document.querySelectorAll('#toasts .toast').forEach((t) => t.remove()));
  /** His words, typed into the chat (the no-model tables answer on the phone, the brain is never asked); the caller waits on what they change. */
  async function say(p, text) {
    await p.evaluate(() => (location.hash = 'core'));
    await p.waitForTimeout(600);
    if (!(await p.evaluate(() => !!document.querySelector('.hud.core.logopen')))) await p.locator('.logbtn:visible').first().click().catch(() => undefined);
    await p.waitForSelector('#cin', { state: 'visible', timeout: 15000 });
    await p.fill('#cin', text);
    await p.press('#cin', 'Enter');
  }
  const lastReply = (p, re) => p.evaluate((src) => [...document.querySelectorAll('#pg-core .msg:not(.me)')].map((m) => m.textContent ?? '').filter((t) => new RegExp(src).test(t)).pop() ?? '', re.source);
  /** The seven looks, in the mock's order, with the words the mock gives them (names in the system's capitals; lines as written). */
  const LOOKS7 = [['scan', 'THE SCAN', 'The world, sampled as points'], ['map', 'THE MAP', 'The field, from above'], ['eye', 'THE EYE', 'Attention is the material'], ['orbit', 'ORBIT', 'Mind is the way in'], ['ink', 'ONE INK', 'A printed page'], ['grown', 'GROWN UP', 'Today, with less on it'], ['glass', 'GLASS', 'Today’s look']];
  const GONE = ['.swatch', '.swatch[data-theme]', '.swatches', '.gdials', '.gdial', '.gchoice', '.gchoices', '.gswitch', '.gswitch-keys', '.gsw', '.swcustom', '[data-dial]', '[data-switch]', '[data-ground]', '[data-preset]'];
  const tapDial = async (p, root, dial, choice) => {
    const b = p.locator(`${root} .gdial[data-dial="${dial}"] .gchoice[data-choice="${choice}"]`);
    await b.scrollIntoViewIfNeeded({ timeout: 4000 }).catch(() => undefined);
    await b.click({ timeout: 8000 });
    await p.waitForTimeout(250);
  };
  const tapSwitch = async (p, root, key, val) => {
    const b = p.locator(`${root} .gswitch[data-switch="${key}"] button[data-val="${val}"]`);
    await b.scrollIntoViewIfNeeded({ timeout: 4000 }).catch(() => undefined);
    await b.click({ timeout: 8000 });
    await p.waitForTimeout(250);
    await clearToasts(p);
  };
  /** Every text on screen under `sel` against what it really sits on (its backgrounds blended down to the page): the lowest ratio. */
  const readable = (p, sel) => p.evaluate((sel) => {
    const parse = (c) => { const m = String(c).match(/[\d.]+/g)?.map(Number) ?? []; return m.length >= 3 ? { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 } : null; };
    const ch = (v) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    const L = (c) => 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
    const ratio = (a, b) => (Math.max(L(a), L(b)) + 0.05) / (Math.min(L(a), L(b)) + 0.05);
    const over = (t, u) => ({ r: t.r * t.a + u.r * (1 - t.a), g: t.g * t.a + u.g * (1 - t.a), b: t.b * t.a + u.b * (1 - t.a), a: 1 });
    const page = parse(getComputedStyle(document.documentElement).getPropertyValue('--g-canvas').trim().replace(/^#(..)(..)(..)$/, (_, r, g, b) => `rgb(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)})`)) ?? { r: 0, g: 0, b: 0, a: 1 };
    const bgOf = (el) => {
      const layers = [];
      for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
        const c = parse(getComputedStyle(e).backgroundColor);
        if (c && c.a > 0) {
          layers.push(c);
          if (c.a >= 1) break;
        }
      }
      return layers.reverse().reduce((bg, l) => over(l, bg), page);
    };
    let n = 0;
    let min = 99;
    const low = [];
    for (const el of document.querySelectorAll(sel.split(',').map((x) => `${x.trim()} *`).join(', '))) {
      if (!el.getClientRects().length || el.closest('svg, canvas, .swprev')) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      if (![...el.childNodes].some((t) => t.nodeType === 3 && t.textContent.trim())) continue;
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight || r.width <= 1 || r.height <= 1 || parseFloat(cs.fontSize) < 1 || /inset\(50%\)/.test(cs.clipPath)) continue;
      const bg = bgOf(el);
      let fg = parse(cs.color);
      if (fg && fg.a === 0) {
        // its words drawn by ::before (a panel's status, data-label): measured as drawn
        const before = getComputedStyle(el, '::before');
        fg = before.content && before.content !== 'none' && before.content !== 'normal' ? parse(before.color) : null;
      }
      if (!fg || fg.a === 0) continue;
      const k = ratio(over(fg, bg), bg);
      n++;
      min = Math.min(min, k);
      if (k < 4.5) low.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} "${el.textContent.trim().slice(0, 24)}" ${k.toFixed(2)}:1`);
    }
    return { n, min: +min.toFixed(2), low: low.slice(0, 8) };
  }, sel);

  /** Run one part; an error in it (a control that is not there) is a named problem, and the parts after it still run. */
  const part = async (name, fn) => {
    try {
      await fn();
    } catch (e) {
      problems.push(`[recipe] ${name} could not run: ${String(e?.message ?? e).split('\n')[0].slice(0, 160)}`);
    }
  };
  // ---- 7a. the Theme page: two taps from Settings, the presets first, the dials under them, the row saying the recipe
  const { c: c5, p: p5 } = await recipePhone(PHONE);
  await part('the Theme page, each ground and Paper', async () => {
  await p5.evaluate(() => (location.hash = 'settings'));
  await p5.waitForSelector('#pg-settings.listmode .scanset button.srow, #pg-settings.listmode .pn[data-row]', { timeout: 15000 }).catch(() => undefined);
  if (!(await onPlate(p5))) await openSection(p5, 'settings', 'Appearance');
  const rowSaid = await themeRowWords(p5);
  check(rowSaid === 'Reactor · Graphite · The Scan', `[recipe] the Theme row says "${rowSaid}", not the recipe "Reactor · Graphite · The Scan"`);
  await themePage(p5);
  const gal = await p5.evaluate((GONE) => {
    const pn = document.querySelector('#pg-settings .pn.themepn.pushed');
    const q = (sel) => [...(pn?.querySelectorAll(sel) ?? [])];
    const top = (el) => Math.round(el.getBoundingClientRect().top);
    const cards = q('.gg-look');
    const colour = pn?.querySelector('.gg-colour');
    return {
      looks: cards.map((b) => ({ key: b.dataset.look, name: b.querySelector('.g-tag')?.textContent?.trim(), line: b.querySelector('.gg-cap small')?.textContent?.trim(), on: b.getAttribute('aria-checked'), coming: !!b.querySelector('.gg-coming'), img: !!b.querySelector('img') })),
      head: pn?.querySelector('.gg-sec')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      kick: pn?.querySelector('.gg-kick')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      swatches: q('.gg-sw').map((b) => b.dataset.colour),
      absent: GONE.map((sel) => [sel, q(sel).length]).filter(([, n]) => n).map(([sel, n]) => `${sel} x${n}`),
      ask: pn?.querySelector('.gg-ask')?.textContent?.trim() ?? '',
      stamp: pn?.querySelector('.g-stamp')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      rows: [top(cards[0]), top(cards[1]), top(cards[2]), top(cards[3]), top(cards[4]), top(cards[5]), top(cards[6])],
      colourTop: colour ? top(colour) : -1,
      lefts: [Math.round(cards[3].getBoundingClientRect().left), Math.round(cards[6].getBoundingClientRect().left)],
    };
  }, GONE);
  const norm = (t) => String(t ?? '').replace(/[’']/g, "'").toUpperCase();
  check(gal.looks.length === 7 && gal.looks.map((l) => l.key).join() === LOOKS7.map((l) => l[0]).join(), `[gallery] the Theme page's looks: ${gal.looks.map((l) => l.key).join()}`);
  check(gal.looks.map((l) => norm(l.name)).join() === LOOKS7.map((l) => l[1]).join(), `[gallery] the names are ${gal.looks.map((l) => l.name).join(' | ')}`);
  check(gal.looks.every((l, i) => (i === 0 ? norm(l.line) === "YOU'RE IN IT" : norm(l.line) === norm(LOOKS7[i][2]))), `[gallery] the lines are ${gal.looks.map((l) => l.line).join(' | ')}`);
  check(gal.looks[0].on === 'true' && gal.looks.slice(1).every((l) => l.on === 'false'), `[gallery] the chosen look on a fresh open is not THE SCAN alone: ${gal.looks.map((l) => l.on).join()}`);
  check(gal.looks.filter((l) => l.coming).map((l) => l.key).join() === 'orbit,grown' && gal.looks.every((l) => l.img), `[gallery] COMING is on ${gal.looks.filter((l) => l.coming).map((l) => l.key).join()} (want the two that are not built: THE MAP, THE EYE and ONE INK are, and a still on every card)`);
  check(/THE LOOK/i.test(gal.head) && /THE SCAN/i.test(gal.head) && /7 · each a whole HUD/.test(gal.head), `[gallery] the plate reads "${gal.head}"`);
  check(/THE COLOUR/i.test(gal.kick) && /REACTOR/i.test(gal.kick) && /12 · YOURS TO CHANGE/i.test(gal.kick), `[gallery] the colour plate reads "${gal.kick}"`);
  check(gal.swatches.join() === TWELVE.join(), `[gallery] the colours: ${gal.swatches.join()}`);
  check(gal.absent.length === 0, `[gallery] the Theme page still has controls that left it (155, 157): ${gal.absent.join(', ')}`);
  check(gal.ask === 'Say a look, or a colour', `[gallery] the ask line reads "${gal.ask}"`);
  check(/LOOKING AT THE THEME/i.test(gal.stamp), `[gallery] the stamp line reads "${gal.stamp}"`);
  check(gal.rows[0] === gal.rows[1] && gal.rows[1] === gal.rows[2] && gal.rows[3] === gal.rows[4] && gal.rows[4] === gal.rows[5] && gal.rows[6] > gal.rows[3] && gal.rows[3] > gal.colourTop && gal.colourTop > gal.rows[0] && gal.lefts[0] === gal.lefts[1], `[gallery] the cards are not two rows of three and one (the colour between the rows, as the mock draws it): ${JSON.stringify({ rows: gal.rows, colour: gal.colourTop, lefts: gal.lefts })}`);
  notes.push(`the Theme page: seven looks in the mock's order, ${gal.looks.filter((l) => l.coming).length} COMING, ${gal.swatches.length} colours, no dial, switch, ground row or preset on it`);
  // ---- 7b. each ground is reached by WORDS now, not from the page (155, 157): it applies at once, is kept across a reload, the boot plays on it
  const GROUND_WORDS = { black: 'black background', slate: 'slate background', warm: 'warm background', paper: 'paper', graphite: 'graphite background' };
  let lastDark = 'graphite';
  for (const g of ['black', 'slate', 'warm', 'paper', 'graphite']) {
    await say(p5, GROUND_WORDS[g]);
    await until(p5, (g) => document.documentElement.dataset.ground === g, g, 8000, `[ground] "${GROUND_WORDS[g]}" did not make the ground ${g}`);
    await themePage(p5);
    const now = await p5.evaluate(() => ({
      canvas: getComputedStyle(document.documentElement).getPropertyValue('--g-canvas').trim().toLowerCase(),
      page: getComputedStyle(document.querySelector('#pg-settings .pn.themepn.pushed')).backgroundColor,
      body: getComputedStyle(document.body).backgroundColor,
      row: document.querySelector('#pg-settings .pn.themepn > h3 small')?.getAttribute('data-label') ?? '',
      plateRow: [...document.querySelectorAll('#pg-settings .scanset button.srow')].find((r) => /^theme$/i.test(r.querySelector('.srname')?.textContent ?? ''))?.querySelector('.srvalue')?.textContent?.trim() ?? '',
    }));
    const s = await state(p5);
    const night = g === 'paper' ? lastDark : g;
    if (g !== 'paper') lastDark = g;
    check(s.ground === g && s.saved?.ground === g && now.canvas === GROUND_CANVAS[g] && hexOf(now.page) === GROUND_CANVAS[g], `[ground] ${g} did not apply at once: ${JSON.stringify({ ground: s.ground, saved: s.saved?.ground, canvas: now.canvas, page: hexOf(now.page) })}`);
    check(hexOf(now.body) === GROUND_CANVAS[night] && s.night === night, `[ground] ${g}: today's rooms stand on ${hexOf(now.body)} (night ${s.night}), not ${night}'s ${GROUND_CANVAS[night]}`);
    check((now.plateRow || now.row).includes(LABEL[g]), `[ground] ${g}: the Theme row says "${now.plateRow || now.row}"`);
    await clearToasts(p5);
    await p5.screenshot({ path: `${out}/look-${engine}-440-ground-${g}.png` });
    await p5.reload({ waitUntil: 'domcontentloaded' });
    await p5.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
    const kept = await state(p5);
    check(kept.ground === g, `[ground] ${g} was not kept across a reload: ${kept.ground}`);
    const boot = await c5.newPage();
    await boot.addInitScript(() => { window.__ghostyBoot = true; });
    await boot.goto(base, { waitUntil: 'domcontentloaded' });
    if (await until(boot, () => !!window.__bootState?.recipe?.ground, null, 20000, `[boot] the cinematic never started on ${g}`)) {
      const b = await boot.evaluate(() => ({ ...window.__bootState.recipe, veil: getComputedStyle(document.querySelector('#boot .bveil') ?? document.body).backgroundColor }));
      check(b.ground === g && hexOf(b.floor) === GROUND_CANVAS[night] && hexOf(b.veil) === GROUND_CANVAS[night], `[boot] on ${g} it played on ${JSON.stringify(b)} (want the ground ${g}, the floor ${GROUND_CANVAS[night]})`);
    }
    await boot.close();
  }
  notes.push('each ground, asked for by words, applied at once, was kept across a reload, and the boot played on it (Paper\'s boot on the night ground, said)');
  // ---- 7c. Paper is readable: every text on THE LOOK and the Theme page measured against what it sits on
  await say(p5, 'paper');
  await until(p5, () => document.documentElement.dataset.ground === 'paper', null, 8000, '[paper] "paper" by words did not make the ground paper');
  await themePage(p5);
  let worst = 99;
  for (let y = 0; y < 6; y++) {
    await p5.evaluate((y) => { const b = document.querySelector('#pg-settings .pn.themepn.pushed > .bd'); if (b) b.scrollTop = y * 700; }, y);
    await p5.waitForTimeout(150);
    const r = await readable(p5, '#pg-settings .pn.themepn.pushed, #top, #dock');
    worst = Math.min(worst, r.min);
    check(!r.low.length, `[paper] the Theme page has text under 4.5:1 on screen: ${r.low.join(' | ')}`);
  }
  await p5.screenshot({ path: `${out}/look-${engine}-440-paper-theme.png` });
  // the bar on a Paper page is paper too: its fade and its capsule in the canvas, its words in the ground's ink (no dark smudge)
  const bar = await p5.evaluate(() => ({
    fade: getComputedStyle(document.querySelector('#dock .tabblur') ?? document.body).backgroundImage,
    cap: getComputedStyle(document.querySelector('#dock .tabcap') ?? document.body).backgroundColor,
    ink: getComputedStyle(document.querySelector('#dock .tabcap button:not(.on)') ?? document.body).color,
  }));
  check(/243, 239, 230/.test(bar.fade) && !/5, 6, 7/.test(bar.fade) && /243, 239, 230/.test(bar.cap) && hexOf(bar.ink) === '#383733', `[paper] the tab bar on the Paper Theme page is not paper: ${JSON.stringify(bar)}`);
  await p5.evaluate(() => (location.hash = 'look'));
  await p5.waitForSelector('#pg-look.on .glook', { timeout: 10000 });
  for (const id of SECTIONS) {
    await openLookSection(p5, id);
    for (let y = 0; y < 4; y++) {
      await p5.evaluate((y) => { const h = document.querySelector('#pg-look .hud.glook'); if (h) h.scrollTop = y * 800; }, y);
      await p5.waitForTimeout(120);
      const r = await readable(p5, '#pg-look, #top, #dock');
      worst = Math.min(worst, r.min);
      check(!r.low.length, `[paper] THE LOOK (${id}) has text under 4.5:1 on screen: ${r.low.join(' | ')}`);
    }
  }
  await p5.evaluate(() => { const h = document.querySelector('#pg-look .hud.glook'); if (h) h.scrollTop = 0; });
  await p5.screenshot({ path: `${out}/look-${engine}-440-paper-look.png` });
  notes.push(`Paper, measured on screen: every text on the Theme page and THE LOOK at ${worst}:1 or more`);
  });
  await c5.close();

  // ---- 7i. the gallery works: GLASS, THE SCAN, THE MAP; the words for the looks; the stills; the twelve colours
  const { c: c9, p: p9 } = await recipePhone(PHONE);
  await part('the gallery: a tap on GLASS, THE SCAN, THE MAP, the words, the stills', async () => {
    const card = (k) => `#pg-settings .pn.themepn.pushed .gg-look[data-look="${k}"]`;
    const said = (k) => p9.evaluate((sel) => ({ on: document.querySelector(sel)?.getAttribute('aria-checked'), line: document.querySelector(`${sel} .gg-cap small`)?.textContent ?? '', head: document.querySelector('#pg-settings .pn.themepn.pushed .gg-sec')?.textContent ?? '' }), card(k));
    const opened = await themePage(p9);
    check(opened != null && opened < BUDGET, `[gallery] the Theme page took ${opened} ms to open (the budget is ${BUDGET} ms)`);
    // a tap on GLASS: the world at once, the card says so, Home on the way back is today's Home, kept across a reload
    await p9.click(card('glass'));
    await until(p9, () => document.documentElement.dataset.world === 'glass', null, 5000, '[gallery] a tap on GLASS did not make the world glass');
    const g = await said('glass');
    check(g.on === 'true' && /you.re in it/i.test(g.line) && /GLASS/i.test(g.head), `[gallery] GLASS after its tap: ${JSON.stringify(g)}`);
    check((await state(p9)).saved?.world === 'glass', '[gallery] GLASS was not kept in his settings');
    await p9.screenshot({ path: `${out}/look-${engine}-440-gallery-glass.png` });
    await p9.evaluate(() => (location.hash = 'core'));
    await p9.waitForTimeout(1500);
    check(!(await p9.evaluate(() => document.body.classList.contains('scanhome'))), '[gallery] with GLASS chosen Home still wears The Scan\'s frame (body.scanhome)');
    await p9.reload({ waitUntil: 'domcontentloaded' });
    await p9.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
    await p9.waitForTimeout(1200);
    check((await state(p9)).world === 'glass' && !(await p9.evaluate(() => document.body.classList.contains('scanhome'))), '[gallery] GLASS was not kept across a reload');
    // a tap on THE SCAN brings the world back
    await themePage(p9);
    await p9.click(card('scan'));
    await until(p9, () => document.documentElement.dataset.world === 'scan', null, 5000, '[gallery] a tap on THE SCAN did not make the world scan');
    const sc = await said('scan');
    check(sc.on === 'true' && /you.re in it/i.test(sc.line) && /THE SCAN/i.test(sc.head), `[gallery] THE SCAN after its tap: ${JSON.stringify(sc)}`);
    await p9.evaluate(() => (location.hash = 'core'));
    await until(p9, () => document.body.classList.contains('scanhome'), null, 10000, '[gallery] with THE SCAN chosen Home did not wear its frame (body.scanhome)');
    // a tap on ORBIT (not built): one toast with its line, the world unchanged, no navigation
    await themePage(p9);
    await clearToasts(p9);
    const before = await p9.evaluate(() => ({ hash: location.hash, world: document.documentElement.dataset.world, tab: window.__ghosty.ui.get().tab }));
    await p9.click(card('orbit'));
    await p9.waitForTimeout(400);
    const map = await p9.evaluate(() => ({ toasts: [...document.querySelectorAll('#toasts .toast')].map((t) => t.textContent ?? ''), hash: location.hash, world: document.documentElement.dataset.world, tab: window.__ghosty.ui.get().tab, still: !!document.querySelector('#pg-settings .pn.themepn.pushed'), saved: window.__ghosty.settings.get().look?.world }));
    check(map.toasts.length === 1 && map.toasts[0].includes('Orbit is coming: Mind is the way in'), `[gallery] a tap on ORBIT says ${JSON.stringify(map.toasts)}`);
    check(map.world === before.world && map.hash === before.hash && map.tab === before.tab && map.still && map.saved !== 'orbit', `[gallery] a tap on ORBIT changed something: ${JSON.stringify({ before, map })}`);
    // the stills: each an <img> under looks/ with width, height and alt, loaded; each file under 60 KB, the seven under 350 KB
    const imgs = await p9.evaluate(async () => {
      const list = [...document.querySelectorAll('#pg-settings .pn.themepn.pushed .gg-look img')];
      for (const i of list) i.scrollIntoView({ block: 'center' });
      await Promise.all(list.map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 5000); }))));
      return list.map((i) => ({ src: new URL(i.src).pathname, w: i.getAttribute('width'), h: i.getAttribute('height'), alt: i.alt, loading: i.loading, nat: i.naturalWidth }));
    });
    check(imgs.length === 7 && imgs.every((i, k) => i.src === `/looks/${LOOKS7[k][0]}.webp` && +i.w > 0 && +i.h > 0 && i.alt.toUpperCase() === LOOKS7[k][1] && i.loading === 'lazy' && i.nat > 0), `[gallery] the stills: ${JSON.stringify(imgs.filter((i, k) => !(i.src === `/looks/${LOOKS7[k][0]}.webp` && +i.w > 0 && +i.h > 0 && i.alt.toUpperCase() === LOOKS7[k][1] && i.loading === 'lazy' && i.nat > 0)))}`);
    let total = 0;
    for (const [k] of LOOKS7) {
      const size = statSync(new URL(`../apps/web/public/looks/${k}.webp`, import.meta.url)).size;
      total += size;
      check(size < 60 * 1024, `[gallery] the still ${k}.webp is ${size} bytes (under 60 KB)`);
    }
    check(total < 350 * 1024, `[gallery] the seven stills are ${total} bytes (under 350 KB)`);
    notes.push(`the stills: seven <img> under /looks/, ${total} bytes together`);
    // the words: the looks that are not built say their one line and change nothing; "show me the looks"; the built ones and a colour still apply
    const asked = [];
    p9.on('request', (r) => /\/api\/chat\b/.test(r.url()) && asked.push(r.url()));
    const world0 = (await state(p9)).world;
    for (const [w, line] of [['orbit', 'Orbit is coming: Mind is the way in'], ['grown up', 'Grown Up is coming: Today, with less on it']]) {
      await say(p9, w);
      await p9.waitForFunction((l) => [...document.querySelectorAll('#pg-core .msg:not(.me)')].some((m) => (m.textContent ?? '').includes(l)), line, { timeout: 8000 }).catch(() => problems.push(`[words] "${w}" did not answer "${line}"`));
      check((await state(p9)).world === world0, `[words] "${w}" changed the world to ${(await state(p9)).world}`);
    }
    await say(p9, 'show me the looks');
    await p9.waitForFunction(() => [...document.querySelectorAll('#pg-core .msg:not(.me)')].some((m) => /Seven looks, each a whole HUD/.test(m.textContent ?? '')), null, { timeout: 8000 }).catch(() => problems.push('[words] "show me the looks" did not answer'));
    await say(p9, 'glass');
    await until(p9, () => document.documentElement.dataset.world === 'glass', null, 8000, '[words] "glass" did not make the world glass');
    await say(p9, 'the scan');
    await until(p9, () => document.documentElement.dataset.world === 'scan', null, 8000, '[words] "the scan" did not make the world scan');
    await say(p9, 'ember'); // the bare name: the page asks "Say a look, or a colour"
    // ONE INK is built (it was a COMING line before this pass): its words switch to it at once with no model, the colour staying his; THE SCAN's words bring The Scan back
    await say(p9, 'one ink');
    await until(p9, () => document.documentElement.dataset.world === 'ink', null, 8000, '[words] "one ink" did not make the world ink');
    check((await state(p9)).colour === 'ember', '[words] "one ink" changed his colour');
    // THE MAP is built too: its words switch to it (the colour his); "open the map" is the map screen's words, not the look's
    await say(p9, 'the map');
    await until(p9, () => document.documentElement.dataset.world === 'map', null, 8000, '[words] "the map" did not make the world map');
    check((await state(p9)).colour === 'ember', '[words] "the map" changed his colour');
    // THE EYE is built too (it was a COMING line before this pass): "the eye" and "switch to the eye" switch to it, the colour his
    await say(p9, 'the eye');
    await until(p9, () => document.documentElement.dataset.world === 'eye', null, 8000, '[words] "the eye" did not make the world eye');
    check((await state(p9)).colour === 'ember', '[words] "the eye" changed his colour');
    await say(p9, 'switch to the map');
    await until(p9, () => document.documentElement.dataset.world === 'map', null, 8000, '[words] "switch to the map" did not make the world map');
    await say(p9, 'switch to the eye');
    await until(p9, () => document.documentElement.dataset.world === 'eye', null, 8000, '[words] "switch to the eye" did not make the world eye');
    await say(p9, 'the scan');
    await until(p9, () => document.documentElement.dataset.world === 'scan', null, 8000, '[words] "the scan" did not bring The Scan back from The Eye');
    await until(p9, () => document.documentElement.dataset.theme === 'ember', null, 8000, '[words] "ember" did not make the colour ember');
    check(!asked.length, `[words] the brain was asked ${asked.length} times for the looks' words`);
    notes.push('the looks by words (orbit, grown up: one line, nothing changed; show me the looks; glass, the scan, one ink, the map, the eye, ember applied) with no model');
  });
  await c9.close();

  // ---- 7j. the twelve colours on the Theme page: each applies at once (the accent token), is kept across a reload, the next boot plays in it
  const { c: c10, p: p10 } = await recipePhone(PHONE);
  await part('the twelve colours on the Theme page', async () => {
    await themePage(p10);
    const order = [...TWELVE.slice(1).filter((k) => k !== 'ember'), 'reactor', 'ember'];
    for (const k of order) {
      const sw = `#pg-settings .pn.themepn.pushed .gg-sw[data-colour="${k}"]`;
      const want = await p10.locator(sw).evaluate((el) => getComputedStyle(el).getPropertyValue('--g-accent').trim());
      await p10.locator(sw).scrollIntoViewIfNeeded().catch(() => undefined);
      await p10.click(sw);
      await p10.waitForTimeout(250);
      const now = await p10.evaluate((sw) => ({ theme: document.documentElement.dataset.theme, saved: window.__ghosty.settings.get().theme, c: getComputedStyle(document.documentElement).getPropertyValue('--c').trim(), g: getComputedStyle(document.documentElement).getPropertyValue('--g-accent').trim(), on: document.querySelector(sw)?.getAttribute('aria-checked'), ring: document.querySelectorAll('#pg-settings .pn.themepn.pushed .gg-sw.on').length, kick: document.querySelector('#pg-settings .pn.themepn.pushed .gg-kick')?.textContent ?? '' }), sw);
      check(now.theme === k && now.saved === k && now.c === want && now.g === want && now.on === 'true' && now.ring === 1 && now.kick.toLowerCase().includes(k), `[colours] ${k} did not apply at once: ${JSON.stringify({ want, ...now })}`);
      await clearToasts(p10);
    }
    await p10.screenshot({ path: `${out}/look-${engine}-440-gallery-ember.png` });
    // Home wears it: the lit tab is the accent
    await p10.evaluate(() => (location.hash = 'core'));
    await p10.waitForTimeout(900);
    const tab = await p10.evaluate(() => ({ tab: getComputedStyle(document.querySelector('#dock .tabcap button.on') ?? document.body).color, want: getComputedStyle(document.documentElement).getPropertyValue(document.body.classList.contains('scanhome') ? '--g-accent-text' : '--c').trim() }));
    check(tab.tab.match(/\d+/g)?.slice(0, 3).map(Number).join() === [1, 3, 5].map((i) => parseInt(tab.want.slice(i, i + 2), 16)).join(), `[colours] the lit tab is ${tab.tab}, not ${tab.want}`);
    await p10.reload({ waitUntil: 'domcontentloaded' });
    await p10.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
    const kept = await p10.evaluate(() => ({ theme: document.documentElement.dataset.theme, saved: window.__ghosty.settings.get().theme, c: getComputedStyle(document.documentElement).getPropertyValue('--c').trim() }));
    check(kept.theme === 'ember' && kept.saved === 'ember' && kept.c === '#ff7a3d', `[colours] the pick did not survive a reload: ${JSON.stringify(kept)}`);
    const bootPage = await c10.newPage();
    await bootPage.addInitScript(() => { window.__ghostyBoot = true; });
    await bootPage.goto(base, { waitUntil: 'domcontentloaded' });
    if (await until(bootPage, () => !!window.__bootState?.accent, null, 20000, '[colours] the boot never started')) {
      const accent = await bootPage.evaluate(() => window.__bootState.accent);
      check(accent === '#ff7a3d', `[colours] the boot played in "${accent}", not Ember's #ff7a3d`);
    }
    await bootPage.close();
    notes.push('the twelve colours applied at once from the Theme page, the pick kept across a reload and the next boot in it');
  });
  await c10.close();

  // ---- 7d. each world changes the floor, the corners and the marks (computed styles, measured)
  const { c: c6, p: p6 } = await recipePhone(PHONE);
  await part('the worlds, the switches and the words', async () => {
  await p6.evaluate(() => (location.hash = 'look'));
  await p6.waitForSelector('#pg-look.on .glook', { timeout: 10000 });
  await openLookSection(p6, 'marks');
  const WORLD = {
    scan: { mask: /circle/, cell: '2px', arm: '10px 1.5px', edge: 'solid', side: '1px', plate: 'solid', sight: '0px', say: 'display' },
    map: { mask: /M32 40\.5H49/, cell: '0px', arm: '5px 5px', edge: 'dashed', side: '1px', plate: 'dashed', sight: '0px', say: 'display' },
    eye: { mask: /rect/, cell: '2px', arm: '0px 1.5px', edge: 'dotted', side: '1px', plate: 'dotted', sight: '24px', say: 'display' },
    ink: { mask: /^none$/, cell: '0px', arm: '0px 1.5px', edge: 'solid', side: '0px', plate: 'solid', sight: '0px', say: 'serif' },
    glass: { mask: /^none$/, cell: '20px', arm: '0px 1.5px', edge: 'solid', side: '1px', plate: 'solid', sight: '0px', say: 'display' },
  };
  const ret = '#pg-look .gmark[data-mark="reticle"] button.g-ret';
  await p6.click(ret);
  for (const [w, want] of Object.entries(WORLD)) {
    await openLookSection(p6, 'themes');
    await tapDial(p6, '#pg-look', 'world', w);
    await clearToasts(p6);
    await openLookSection(p6, 'marks');
    const m = await p6.evaluate((ret) => {
      const floor = getComputedStyle(document.body, '::before');
      const own = getComputedStyle(document.querySelector('#pg-look'), '::before');
      const frame = document.querySelector(`${ret} .g-ret-frame`);
      // a reticle that only watches (the line of sight's): its corners, its edge, its sides as the world draws them
      const fs = getComputedStyle(document.querySelector('#pg-look .gmark[data-mark="sight"] button.g-ret[data-state="watch"] .g-ret-frame'));
      const plate = getComputedStyle(document.querySelector('#pg-look .gmark[data-mark="plate"] .g-plate'));
      return {
        world: document.documentElement.dataset.world,
        mask: floor.webkitMaskImage || floor.maskImage, alpha: floor.backgroundColor, ownMask: own.webkitMaskImage || own.maskImage,
        cell: getComputedStyle(document.querySelector('#pg-core .rccard.rctoday') ?? document.body).borderTopLeftRadius,
        arm: fs.backgroundSize.split(',')[0].trim(), edge: fs.borderTopStyle, side: fs.borderLeftWidth, attend: frame.closest('.g-ret')?.dataset.state,
        sight: getComputedStyle(frame, '::after').width, plate: plate.borderTopStyle, blur: plate.backdropFilter || plate.webkitBackdropFilter || 'none',
        say: getComputedStyle(document.querySelector('#pg-look .glook-say')).fontFamily,
      };
    }, ret);
    const maskOk = want.mask.test(m.mask.replace(/^url\(|\)$/g, '')) && (w === 'ink' || w === 'glass' ? alphaOf(m.alpha) === 0 : alphaOf(m.alpha) > 0) && want.mask.test(m.ownMask.replace(/^url\(|\)$/g, ''));
    check(m.world === w && maskOk, `[world] ${w}: the floor behind every screen is ${m.mask.slice(0, 60)} at ${m.alpha} (THE LOOK's ${m.ownMask.slice(0, 40)})`);
    check(m.cell === want.cell, `[world] ${w}: Home's Today card has ${m.cell} corners (want ${want.cell})`);
    check(m.attend === 'attend' && m.arm === want.arm && m.edge === want.edge && m.side === want.side && (w !== 'eye' || m.sight === want.sight), `[world] ${w}: the attended reticle is drawn ${JSON.stringify({ arm: m.arm, edge: m.edge, side: m.side, sight: m.sight })} (want ${JSON.stringify({ arm: want.arm, edge: want.edge, side: want.side, sight: want.sight })})`);
    check(m.plate === want.plate && (w === 'glass' ? /blur\(24px\)/.test(m.blur) : !/blur\([1-9]/.test(m.blur)), `[world] ${w}: a plate is ${m.plate}, ${m.blur}`);
    check(want.say === 'serif' ? /serif/i.test(m.say) && !/SF Pro Display/.test(m.say) : /SF Pro Display/.test(m.say), `[world] ${w}: what I say is set in ${m.say.slice(0, 60)}`);
    await p6.screenshot({ path: `${out}/look-${engine}-440-world-${w}.png` });
  }
  notes.push('each world changed the floor behind every screen, Home\'s corners and the reticle, measured');
  // ---- 7e. each switch changes its one thing (back on The Scan, Graphite)
  await openLookSection(p6, 'themes');
  await tapDial(p6, '#pg-look', 'world', 'scan');
  await clearToasts(p6);
  const probe = () => p6.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    return {
      halo: root.getPropertyValue('--halo1').trim(), floor: getComputedStyle(document.body, '::before').backgroundColor,
      cell: getComputedStyle(document.querySelector('#pg-core .rccard.rctoday') ?? document.body).borderTopLeftRadius,
      tag: getComputedStyle(document.querySelector('#pg-look .g-tag')).fontFamily, tagSize: getComputedStyle(document.querySelector('#pg-look .g-tag')).fontSize,
      lede: getComputedStyle(document.querySelector('#pg-look .glede')).fontSize, motion: document.documentElement.dataset.motion,
    };
  });
  const base0 = await probe();
  const T0 = '#pg-look';
  await tapSwitch(p6, T0, 'glow', 'off');
  check(alphaOf((await probe()).halo) === 0 && alphaOf(base0.halo) > 0, `[switch] glow off: the halo is ${(await probe()).halo} (was ${base0.halo})`);
  await tapSwitch(p6, T0, 'glow', 'on');
  await tapSwitch(p6, T0, 'floor', 'off');
  check(alphaOf((await probe()).floor) === 0 && alphaOf(base0.floor) > 0, `[switch] floor off: the floor is ${(await probe()).floor}`);
  await tapSwitch(p6, T0, 'floor', 'on');
  await tapSwitch(p6, T0, 'corners', 'round');
  check((await probe()).cell === '20px', `[switch] corners round: ${(await probe()).cell}`);
  await tapSwitch(p6, T0, 'corners', 'sharp');
  check((await probe()).cell === '0px' && base0.cell === '2px', `[switch] corners sharp: ${(await probe()).cell} (was ${base0.cell})`);
  await tapSwitch(p6, T0, 'corners', 'world');
  await tapSwitch(p6, T0, 'readings', 'system');
  check(!/mono|Menlo|SF Mono/i.test((await probe()).tag) && /mono|Menlo/i.test(base0.tag), `[switch] readings system: a tag is set in ${(await probe()).tag}`);
  await tapSwitch(p6, T0, 'readings', 'mono');
  await tapSwitch(p6, T0, 'body', '19');
  const b19 = await probe();
  await tapSwitch(p6, T0, 'body', '21');
  const b21 = await probe();
  check(base0.lede === '17px' && b19.lede === '19px' && b21.lede === '21px' && parseFloat(b19.tagSize) > parseFloat(base0.tagSize) && parseFloat(b21.tagSize) >= parseFloat(b19.tagSize), `[switch] body: ${base0.lede} → ${b19.lede} → ${b21.lede}, tags ${base0.tagSize} → ${b19.tagSize} → ${b21.tagSize}`);
  await p6.screenshot({ path: `${out}/look-${engine}-440-body-21.png` });
  await tapSwitch(p6, T0, 'body', '17');
  await tapSwitch(p6, T0, 'motion', 'calm');
  const calmSaid = (await p6.locator('#pg-look .glook-states').textContent()) ?? '';
  check((await probe()).motion === 'calm' && /Motion is set to calm/.test(calmSaid), `[switch] motion calm: ${JSON.stringify({ motion: (await probe()).motion, said: calmSaid.slice(0, 80) })}`);
  await openLookSection(p6, 'marks');
  await p6.click('#pg-look .gmark[data-mark="typed"] .g-key');
  const whole = await p6.evaluate(() => { const t = document.querySelector('#pg-look .g-typed'); return { n: t.querySelector('.g-typed-words').textContent.length, writing: t.classList.contains('writing') }; });
  check(whole.n > 30 && !whole.writing, `[switch] calm: the typed line did not appear whole: ${JSON.stringify(whole)}`);
  await openLookSection(p6, 'mind');
  await until(p6, () => (window.__ghosty.look.mind?.frames ?? 0) > 0, null, 20000, '[switch] calm: the orb never drew');
  await p6.waitForTimeout(600);
  check((await look(p6)).mind?.still === true, `[switch] calm: my orb still moves: ${JSON.stringify((await look(p6)).mind)}`);
  await openLookSection(p6, 'themes');
  await tapSwitch(p6, T0, 'motion', 'alive');
  // the sound: a tone, a click, or silence (each on a thing not yet recognised)
  const lockOn = async (label) => {
    await openLookSection(p6, 'marks');
    await p6.click(`#pg-look .gmark[data-mark="recognise"] button.gthing[aria-label="${label}"]`);
    await p6.waitForTimeout(500);
    return p6.evaluate(() => window.__sfx.filter((k) => k === 'lock' || k === 'click').slice(-1)[0] ?? '');
  };
  await p6.evaluate(() => { window.__sfx = []; });
  const tone = await lockOn('Library');
  await openLookSection(p6, 'themes');
  await tapSwitch(p6, T0, 'sound', 'click');
  await p6.evaluate(() => { window.__sfx = []; });
  const click = await lockOn('Agenda');
  await openLookSection(p6, 'themes');
  await tapSwitch(p6, T0, 'sound', 'off');
  await p6.evaluate(() => { window.__sfx = []; });
  const none = await lockOn('God’s eye');
  check(tone === 'lock' && click === 'click' && none === '', `[switch] the sound: tone "${tone}", click "${click}", off "${none}"`);
  await openLookSection(p6, 'themes');
  await tapSwitch(p6, T0, 'sound', 'tone');
  // a dial under a preset makes Custom, kept exactly as set; a preset tapped is whole again
  await tapSwitch(p6, T0, 'glow', 'off');
  const custom = await state(p6);
  check(custom.preset === 'custom' && (await p6.locator('#pg-look .swcustom').count()) === 1, `[recipe] a dial changed under a preset is not Custom: ${custom.preset}`);
  await p6.reload({ waitUntil: 'domcontentloaded' });
  await p6.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
  check((await state(p6)).glow === 'off' && (await state(p6)).preset === 'custom', '[recipe] Custom was not kept exactly as set across a reload');
  await p6.evaluate(() => (location.hash = 'look'));
  await p6.waitForSelector('#pg-look.on .glook', { timeout: 10000 });
  await p6.waitForTimeout(900);
  await openLookSection(p6, 'themes');
  await p6.click('#pg-look .swatch[data-preset="scan"]');
  await p6.waitForTimeout(300);
  await clearToasts(p6);
  const scan = await state(p6);
  check(scan.preset === 'scan' && scan.ground === 'black' && scan.world === 'scan' && scan.glow === 'off' && scan.theme === 'reactor', `[recipe] THE SCAN: ${JSON.stringify({ preset: scan.preset, ground: scan.ground, world: scan.world, glow: scan.glow })}`);
  await p6.click('#pg-look .swatch[data-preset="glass"]');
  await p6.waitForTimeout(300);
  const glass = await state(p6);
  check(glass.preset === 'glass' && glass.ground === 'graphite' && glass.world === 'glass' && glass.glow === 'on', `[recipe] GLASS, today's look back: ${JSON.stringify({ preset: glass.preset, ground: glass.ground, world: glass.world })}`);
  // ---- 7g. "black background" by words, with no model: answered on the phone, the brain never asked
  const asked = [];
  p6.on('request', (r) => /\/api\/chat\b/.test(r.url()) && asked.push(r.url()));
  await p6.evaluate(() => (location.hash = 'core'));
  await p6.waitForTimeout(700);
  if (!(await p6.evaluate(() => !!document.querySelector('.hud.core.logopen')))) await p6.locator('.logbtn:visible').first().click().catch(() => undefined);
  await p6.waitForSelector('#cin', { state: 'visible', timeout: 15000 }).catch(() => undefined);
  await p6.fill('#cin', 'black background');
  await p6.press('#cin', 'Enter');
  const black = await until(p6, () => document.documentElement.dataset.ground === 'black', null, 5000, '[words] "black background" did not make the ground black');
  const reply = await p6.evaluate(() => [...document.querySelectorAll('#pg-core .msg:not(.me)')].map((m) => m.textContent ?? '').filter((t) => /nothing lit/.test(t)).pop() ?? '');
  check(black && /Black: nothing lit but what I’m looking at\./.test(reply) && !asked.length, `[words] "black background": ground ${(await state(p6)).ground}, said "${reply.slice(0, 80)}", the brain asked ${asked.length} times`);
  await p6.screenshot({ path: `${out}/look-${engine}-440-words-black.png` });
  });
  await c6.close();

  // ---- 7f. ground follows the day, on a stand-in clock: Paper by day at his home, the night ground once the sun has set
  const { c: c7, p: p7 } = await recipePhone(PHONE, { look: { ground: 'black', night: 'black', switches: { day: 'on' } }, clock: '2026-11-07T15:00:00Z' });
  await part('ground follows the day', async () => {
  const day = await state(p7);
  check(day.ground === 'paper' && day.night === 'black' && /^Reactor · Paper till 16:\d\d · The Scan$/.test(day.words), `[day] at 15:00 in Birmingham: ${JSON.stringify({ ground: day.ground, words: day.words })}`);
  await p7.clock.fastForward('02:00:00');
  const flipped = await until(p7, () => document.documentElement.dataset.ground === 'black', null, 8000, '[day] the ground did not flip to Black after sunset on the stand-in clock');
  const night = await state(p7);
  check(flipped && /^Reactor · Black till 07:\d\d · The Scan$/.test(night.words) && night.saved?.ground === 'black', `[day] after sunset: ${JSON.stringify({ ground: night.ground, words: night.words })}`);
  notes.push(`ground follows the day on a stand-in clock: "${day.words}" at 15:00, "${night.words}" at 17:00`);
  });
  await c7.close();

  // ---- 7h. the Theme page at 390 and 440: nothing sideways, every control named and 44 pt
  for (const vp of [SMALL, PHONE]) {
    const { c: c8, p: p8 } = await recipePhone(vp);
    await part(`the Theme page at ${vp.width}`, async () => {
    const opened = await themePage(p8);
    check(opened != null && opened < BUDGET, `[${vp.width}] the Theme page took ${opened} ms to open the first time (the budget is ${BUDGET} ms)`);
    notes.push(`the Theme page opened in ${opened} ms at ${vp.width} (budget ${BUDGET})`);
    await p8.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined)))).catch(() => undefined);
    const fl = await p8.evaluate(() => {
      const pn = document.querySelector('#pg-settings .pn.themepn.pushed');
      const f = getComputedStyle(pn, '::before');
      const list = pn.closest('.two.stack, .hub');
      const lm = list ? getComputedStyle(list) : null;
      return { h: parseFloat(f.height) || 0, pn: pn.getBoundingClientRect().height, mask: f.webkitMaskImage || f.maskImage || 'none', fade: lm ? lm.webkitMaskImage || lm.maskImage || 'none' : 'none' };
    });
    check(fl.h >= fl.pn - 1 && /circle/.test(fl.mask) && fl.fade === 'none', `[${vp.width}] the Theme page's floor covers ${Math.round(fl.h)} of its ${Math.round(fl.pn)} px (${fl.mask.slice(0, 30)}); the list's fade under it: ${fl.fade.slice(0, 50)}`);
    for (let y = 0; y < 6; y++) {
      await p8.evaluate((y) => { const b = document.querySelector('#pg-settings .pn.themepn.pushed > .bd'); if (b) b.scrollTop = y * 650; }, y);
      await p8.waitForTimeout(150);
      const m = await p8.evaluate((W) => {
        const root = document.querySelector('#pg-settings .pn.themepn.pushed');
        const seen = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && getComputedStyle(el).visibility !== 'hidden'; };
        const side = [...root.querySelectorAll('*')].filter((el) => seen(el) && !el.closest('svg')).map((el) => [el, el.getBoundingClientRect()]).filter(([, r]) => r.right > W + 0.5 || r.left < -0.5).map(([el, r]) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} ${Math.round(r.left)}–${Math.round(r.right)}`);
        const controls = [...root.querySelectorAll('button, [role="radio"], [role="switch"], input, select')].filter(seen);
        const unnamed = controls.filter((c) => !(c.getAttribute('aria-label') || c.textContent || '').trim()).map((c) => c.outerHTML.slice(0, 80));
        const small = controls.map((c) => [c, { width: c.offsetWidth || c.getBoundingClientRect().width, height: c.offsetHeight || c.getBoundingClientRect().height }]).filter(([, r]) => r.width < 43.5 || r.height < 43.5).map(([c, r]) => `${(c.getAttribute('aria-label') || c.textContent || '').trim().slice(0, 30)} ${Math.round(r.width)}×${Math.round(r.height)}`);
        return { side: side.slice(0, 5), unnamed: unnamed.slice(0, 5), small: small.slice(0, 5), scroll: document.documentElement.scrollWidth };
      }, vp.width);
      check(m.scroll <= vp.width && !m.side.length, `[${vp.width}] the Theme page sticks out sideways: ${m.side.join(' | ')}`);
      check(!m.unnamed.length, `[${vp.width}] the Theme page has a control with no name: ${m.unnamed.join(' | ')}`);
      check(!m.small.length, `[${vp.width}] the Theme page has a control under 44 pt: ${m.small.join(' | ')}`);
    }
    await p8.screenshot({ path: `${out}/look-${engine}-${vp.width}-theme-page.png` });
    // BODY at its biggest: every key, tile and row still says its words whole at this width, and nothing sticks out sideways
    for (let k = 0; k < 2; k++) await say(p8, 'bigger text');
    await until(p8, () => document.documentElement.dataset.body === '21', null, 8000, `[${vp.width}] "bigger text" twice did not make BODY 21`);
    await themePage(p8);
    // the page is measured once it has settled, as it is at the normal size above: the push-in (a .45 s spring) was still 22 px off on the loaded
    // sandbox, and a page still sliding in has everything on it a few pixels past the edge (measured: every flagged word sat exactly that far over)
    await p8.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined)))).catch(() => undefined);
    for (let y = 0; y < 6; y++) {
      await p8.evaluate((y) => { const b = document.querySelector('#pg-settings .pn.themepn.pushed > .bd'); if (b) b.scrollTop = y * 650; }, y);
      await p8.waitForTimeout(150);
      const cut = await p8.evaluate((W) => [...document.querySelectorAll('#pg-settings .pn.themepn.pushed :is(button, .gg-cap small, .gg-sec small, .gg-kick *, .gg-sec *)')].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && (el.scrollWidth > el.clientWidth + 1 || r.right > W + 0.5 || r.left < -0.5);
      }).map((el) => `"${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 28)}" ${el.scrollWidth}/${el.clientWidth}`).slice(0, 5), vp.width);
      check(!cut.length, `[${vp.width}] at BODY 21 the Theme page cuts words or sticks out: ${cut.join(' | ')}`);
    }
    });
    await c8.close();
  }
}

await browser.close();
for (const n of notes) console.log(n);
if (problems.length) {
  console.error(`FAIL look (${engine}):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`ok (${engine}): THE LOOK — two taps from Settings, under ${BUDGET} ms to open, the five sections, the marks working and the tone once (none with sounds off), the twelve applied and kept after a reload, the boot in the picked colour, nothing sideways and every control named and 44 pt at 440 and 390, Reduce Motion and no 3-D said; THE GALLERY — seven looks and twelve colours and nothing else on the Theme page, GLASS and THE SCAN by a tap, THE MAP only a toast, the stills, the looks by words; THE RECIPE — each ground by words at once, kept and under the boot, Paper readable on screen, each world's floor, corners and marks measured, each switch's one change, Custom kept, "black background" with no model, the day flipping at sunset on a stand-in clock`);
