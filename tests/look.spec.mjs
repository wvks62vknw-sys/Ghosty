// SETTINGS → THE LOOK (BRIEF-DESIGN-SYSTEM 5 and 6; his pick, W1 THE SCAN, OWNER-ISSUES 139): the design system's own screen on
// the owner's iPhone 18 Pro Max (440 × 956) and at 390 × 844, with software WebGL for the eye (as tests/hero.spec.mjs runs Mind).
// Every check fails on the code before the system (there was no THE LOOK, and two themes):
//  1. it opens in TWO TAPS from Settings (the Appearance pill from another section, then its row) and lands, the first time, on
//     MARKS; THE SPEED BUDGET (STANDARD's two habits): the screen opens in under 300 ms on the preview, measured by the phone's own
//     stopwatch (the first open, built then, and the second), printed and held;
//  2. every section: TOKENS (every token with its value and job, the inks with their contrast measured, at the floor), TYPE (the
//     twelve styles at their own sizes, nothing under 12), MARKS (the eleven, each named and numbered), MIND (the eye drawn, and
//     breathing when it listens), THEMES (the twelve swatches with their measured contrast);
//  3. the marks work: the reticle attends when tapped and says so, the typed-out line types, the line of sight draws, the search
//     finds the agenda, and THE RECOGNITION TONE FIRES ONCE: a tap on a thing locks the box with one tone, a second tap on the same
//     thing makes none, the key's press is recognised with one; with his sounds off the box still locks and no tone plays (said);
//  4. THE TWELVE SWATCHES APPLY at once (the page's accent, his setting, the toast) and THE PICK SURVIVES A RELOAD; the next cold
//     open's BOOT plays in the picked colour;
//  5. nothing sideways and every control named and 44 pt or more, in every section, at 440 and at 390;
//  6. the states said in a sentence: Reduce Motion on (the eye holds still, the typed line shows whole), sound off, no 3-D (the eye
//     drawn flat, Chromium only).
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

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: GL });
await standDown(base);

async function phone(viewport, extra = {}, b = browser) {
  const ctx = await b.newContext({ viewport, ...UK, ...extra });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${viewport.width}] pageerror: ${e.message}`));
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
await openSection(page, 'settings', 'Appearance'); // tap 1
check(await page.locator(row).isVisible().catch(() => false), '[settings] THE LOOK has no row under Appearance');
const rowName = (await page.locator('#pg-settings .pn[data-go="look"] .ptitle').textContent().catch(() => '')) ?? '';
check(/the look/i.test(rowName), `[settings] the row is called "${rowName}"`);
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
await page.click(row);
await until(page, () => window.__ghosty.ui.get().tab === 'look', null, 5000, '[look] the second open did not happen');
await page.waitForTimeout(400);
const second = await look(page);
check(second.opened?.first === false && second.opened.ms < BUDGET, `[speed] the second open: ${JSON.stringify(second.opened)}`);
notes.push(`THE LOOK opens in ${first.opened?.ms} ms the first time (built then) and ${second.opened?.ms} ms after (the budget ${BUDGET} ms)`);

// ======================================================================== 2. every section, and 5. at 440
await openLookSection(page, 'tokens');
const tok = await page.evaluate(() => ({ rows: document.querySelectorAll('#pg-look .gtok').length, jobs: [...document.querySelectorAll('#pg-look .gtok-job')].filter((j) => j.textContent.trim().length > 10).length, groups: document.querySelectorAll('#pg-look .gtok-group').length, canvas: document.querySelector('#pg-look .gtok[data-token="--g-canvas"] .gtok-val')?.textContent }));
check(tok.rows >= 80 && tok.jobs === tok.rows && tok.groups >= 10, `[tokens] ${JSON.stringify(tok)}`);
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
await until(page, () => (window.__ghosty.look.eye?.frames ?? 0) > 0, null, 8000, '[mind] the eye never drew');
const eye0 = (await look(page)).eye;
check(eye0?.mode === 'gl' || eye0?.mode === 'flat', `[mind] the eye: ${JSON.stringify(eye0)}`);
check(/^My eye: idle$/.test((await page.locator('#pg-look .g-orb').getAttribute('aria-label')) ?? ''), '[mind] the eye is not named with its state');
await page.click('#pg-look .gorbwrap ~ .gkeys .g-key[aria-label="My eye listening"]').catch(() => problems.push('[mind] no LISTENING key'));
await page.waitForTimeout(1200);
const eye1 = (await look(page)).eye;
check(eye1?.state === 'listening' && eye1.breathing === true && eye1.frames > eye0.frames, `[mind] listening, it does not breathe: ${JSON.stringify(eye1)}`);
check(/listening, breathing/.test((await page.locator('#pg-look .g-orb').getAttribute('aria-label')) ?? ''), '[mind] the eye does not say it is breathing');
await page.screenshot({ path: `${out}/look-${engine}-440-mind-listening.png` });
await openLookSection(page, 'themes');
const sw = await page.evaluate(() => [...document.querySelectorAll('#pg-look .swatch')].map((b) => ({ k: b.dataset.theme, name: b.querySelector('b')?.textContent, read: b.querySelector('.swread')?.textContent ?? '', accent: getComputedStyle(b).getPropertyValue('--g-accent').trim() })));
check(sw.map((x) => x.k).join() === ['reactor', 'graphite', 'ember', 'gold', 'crimson', 'violet', 'emerald', 'ice', 'rose', 'lime', 'sunset', 'mono'].join(), `[themes] the swatches: ${sw.map((x) => x.k).join()}`);
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
const order = [...TWELVE.slice(1), 'reactor', 'ember'];
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
  check(/Reduce Motion is on.*my eye holds still/.test(said), `[states] Reduce Motion is not said: "${said}"`);
  // the typed line shows whole at once
  await p3.click('#pg-look .gmark[data-mark="typed"] .g-key');
  const whole = await p3.evaluate(() => { const t = document.querySelector('#pg-look .g-typed'); return { n: t.querySelector('.g-typed-words').textContent.length, writing: t.classList.contains('writing') }; });
  check(whole.n > 30 && !whole.writing, `[states] with Reduce Motion the typed line did not show whole: ${JSON.stringify(whole)}`);
  await openLookSection(p3, 'mind');
  await p3.click('#pg-look .g-key[aria-label="My eye listening"]');
  await p3.waitForTimeout(900);
  const e = (await look(p3)).eye;
  check(e?.still === true && e.breathing === false && e.state === 'listening', `[states] with Reduce Motion the eye still breathes: ${JSON.stringify(e)}`);
  check(/held still/.test((await p3.locator('#pg-look .g-orb').getAttribute('aria-label')) ?? ''), '[states] the eye does not say it is held still');
  await p3.screenshot({ path: `${out}/look-${engine}-440-reduce-motion.png` });
  await c3.close();
}
if (!isWebKit) {
  const flat = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--disable-3d-apis'] });
  const { ctx: c4, page: p4 } = await phone(PHONE, {}, flat);
  await p4.evaluate(() => (location.hash = 'look'));
  await p4.waitForSelector('#pg-look.on .glook', { timeout: 10000 });
  await openLookSection(p4, 'mind');
  const e = (await look(p4)).eye;
  const said = (await p4.locator('#pg-look .glook-states').textContent()) ?? '';
  check(e?.mode === 'flat' && /no 3-D, so I draw my eye flat/.test(said), `[states] no 3-D: the eye ${JSON.stringify(e)}, said "${said}"`);
  await p4.screenshot({ path: `${out}/look-${engine}-440-flat.png` });
  await c4.close();
  await flat.close();
}

await browser.close();
for (const n of notes) console.log(n);
if (problems.length) {
  console.error(`FAIL look (${engine}):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`ok (${engine}): THE LOOK — two taps from Settings, under ${BUDGET} ms to open, the five sections, the marks working and the tone once (none with sounds off), the twelve applied and kept after a reload, the boot in the picked colour, nothing sideways and every control named and 44 pt at 440 and 390, Reduce Motion and no 3-D said`);
