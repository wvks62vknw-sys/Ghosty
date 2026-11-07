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
//  7. THEMES THAT MEAN SOMETHING (BRIEF-THEMES-2; every check fails on the code before it — run against it once): the Theme page two
//     taps from Settings with the seventeen presets first and the dials under them, the row saying the recipe; EACH GROUND applies
//     at once, is kept across a reload and the boot plays on it; PAPER IS READABLE (every text on the Theme page and THE LOOK
//     measured against what it sits on); EACH WORLD changes the floor behind every screen, Home's corners and the reticle (computed
//     styles, measured); EACH SWITCH changes its one thing (glow, floor, corners, readings, body, motion, the sound); a changed dial
//     is Custom and kept; THE SCAN and GLASS whole; "black background" by words with no model (the brain never asked); GROUND
//     FOLLOWS THE DAY flips at sunset on a stand-in clock; the Theme page named, 44 pt and nothing sideways at 390 and 440.
//   BASE=http://localhost:8795 node tests/look.spec.mjs [outDir]
import { mkdirSync } from 'node:fs';
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
await page.waitForSelector('#pg-settings.listmode .pn[data-row]', { timeout: 15000 }).catch(() => problems.push('[settings] the list never drew'));
// Settings on another section (the worst case: the row is not on screen yet), then the two taps
await openSection(page, 'settings', 'About');
const row = '#pg-settings .pn[data-row][data-go="look"] > h3';
check(!(await page.locator(row).isVisible().catch(() => false)), '[settings] THE LOOK\'s row shows under About (it belongs under Appearance)');
/** The page at rest (Settings draws its panels for a moment after it shows): a person reads the list before tapping. */
const idle = (p) => p.evaluate(() => new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(() => r(), { timeout: 3000 }) : setTimeout(r, 300))));
await page.waitForTimeout(800);
await idle(page);
await openSection(page, 'settings', 'Appearance'); // tap 1
check(await page.locator(row).isVisible().catch(() => false), '[settings] THE LOOK has no row under Appearance');
const rowName = (await page.locator('#pg-settings .pn[data-go="look"] .ptitle').textContent().catch(() => '')) ?? '';
check(/the look/i.test(rowName), `[settings] the row is called "${rowName}"`);
await idle(page);
await page.click(row); // tap 2
await until(page, () => window.__ghosty.ui.get().tab === 'look' && document.getElementById('pg-look')?.classList.contains('on'), null, 8000, '[look] two taps from Settings did not open THE LOOK');
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
    await p.waitForSelector('#pg-settings.listmode .pn[data-row]', { timeout: 15000 }).catch(() => undefined);
    await p.waitForTimeout(500);
    await openSection(p, 'settings', 'Appearance');
    await p.click('#pg-settings .pn[data-row].themepn > h3', { timeout: 8000 });
    await until(p, () => document.querySelector('#pg-settings .pn.themepn')?.classList.contains('pushed') && document.body.classList.contains('g-themepage'), null, 6000, '[recipe] two taps did not open the Theme page');
    await p.waitForTimeout(450);
  }
  // (a tap's toast is read where it is checked, then cleared, so it never sits over the section pills for the next tap)
  const clearToasts = (p) => p.evaluate(() => document.querySelectorAll('#toasts .toast').forEach((t) => t.remove()));
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
  await p5.waitForSelector('#pg-settings.listmode .pn[data-row]', { timeout: 15000 }).catch(() => undefined);
  await openSection(p5, 'settings', 'Appearance');
  const rowSaid = (await p5.locator('#pg-settings .pn.themepn > h3 small').getAttribute('data-label').catch(() => '')) ?? '';
  check(rowSaid === 'Reactor · Graphite · The Scan', `[recipe] the Theme row says "${rowSaid}", not the recipe "Reactor · Graphite · The Scan"`);
  await themePage(p5);
  const order = await p5.evaluate(() => {
    const pn = document.querySelector('#pg-settings .pn.themepn.pushed');
    const sw = pn?.querySelector('.swatches .swatch');
    const dial = pn?.querySelector('.gdials .gdial');
    return { presets: [...(pn?.querySelectorAll('.swatch') ?? [])].map((b) => b.dataset.preset), first: !!sw && !!dial && sw.getBoundingClientRect().top < dial.getBoundingClientRect().top && !!(sw.compareDocumentPosition(dial) & Node.DOCUMENT_POSITION_FOLLOWING), dials: [...(pn?.querySelectorAll('.gdial') ?? [])].map((d) => d.dataset.dial) };
  });
  check(order.presets.join() === PRESETS17.join(), `[recipe] the Theme page's presets: ${order.presets.join()}`);
  check(order.first, '[recipe] the presets do not come first, the dials under them');
  check(order.dials.join() === 'ground,colour,world,switches', `[recipe] the dials: ${order.dials.join()}`);
  // ---- 7b. each ground applies at once, is kept across a reload, and the boot plays on it
  let lastDark = 'graphite';
  for (const g of ['black', 'slate', 'warm', 'paper', 'graphite']) {
    if (!(await p5.evaluate(() => document.body.classList.contains('g-themepage')))) await themePage(p5);
    await tapDial(p5, '#pg-settings .pn.themepn.pushed', 'ground', g);
    const now = await p5.evaluate(() => ({
      canvas: getComputedStyle(document.documentElement).getPropertyValue('--g-canvas').trim().toLowerCase(),
      page: getComputedStyle(document.querySelector('#pg-settings .pn.themepn.pushed')).backgroundColor,
      body: getComputedStyle(document.body).backgroundColor,
      row: document.querySelector('#pg-settings .pn.themepn > h3 small')?.getAttribute('data-label') ?? '',
      toasts: document.querySelector('#toasts')?.textContent ?? '',
    }));
    const s = await state(p5);
    const night = g === 'paper' ? lastDark : g;
    if (g !== 'paper') lastDark = g;
    check(s.ground === g && s.saved?.ground === g && now.canvas === GROUND_CANVAS[g] && hexOf(now.page) === GROUND_CANVAS[g], `[ground] ${g} did not apply at once: ${JSON.stringify({ ground: s.ground, saved: s.saved?.ground, canvas: now.canvas, page: hexOf(now.page) })}`);
    check(hexOf(now.body) === GROUND_CANVAS[night] && s.night === night, `[ground] ${g}: today's rooms stand on ${hexOf(now.body)} (night ${s.night}), not ${night}'s ${GROUND_CANVAS[night]}`);
    check(now.row.includes(LABEL[g]) && now.toasts.includes(`Ground: ${LABEL[g]}`), `[ground] ${g}: the row says "${now.row}", the toast "${now.toasts}"`);
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
  notes.push('each ground applied at once, kept across a reload, and the boot played on it (Paper\'s boot on the night ground, said)');
  // ---- 7c. Paper is readable: every text on THE LOOK and the Theme page measured against what it sits on
  await themePage(p5);
  await tapDial(p5, '#pg-settings .pn.themepn.pushed', 'ground', 'paper');
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
    await themePage(p8);
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
    await tapSwitch(p8, '#pg-settings .pn.themepn.pushed', 'body', '21');
    for (let y = 0; y < 6; y++) {
      await p8.evaluate((y) => { const b = document.querySelector('#pg-settings .pn.themepn.pushed > .bd'); if (b) b.scrollTop = y * 650; }, y);
      await p8.waitForTimeout(150);
      const cut = await p8.evaluate((W) => [...document.querySelectorAll('#pg-settings .pn.themepn.pushed :is(button, .gswitch-name, .swcustom)')].filter((el) => {
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
console.log(`ok (${engine}): THE LOOK — two taps from Settings, under ${BUDGET} ms to open, the five sections, the marks working and the tone once (none with sounds off), the twelve applied and kept after a reload, the boot in the picked colour, nothing sideways and every control named and 44 pt at 440 and 390, Reduce Motion and no 3-D said; THE RECIPE — the presets first and the dials under them, each ground at once, kept and under the boot, Paper readable on screen, each world's floor, corners and marks measured, each switch's one change, Custom kept, "black background" with no model, the day flipping at sunset on a stand-in clock`);
