// The hub cards (BRIEF-IRON-BUILD; OWNER-ISSUES 32, 41, 43) on the owner's iPhone 18 Pro Max (440 × 956):
//  - every tab's hub fits one screen with nothing to scroll (the navigation sheet, mockups/nav: six cards at most in
//    two columns, any more in a More row) and shows each of its tools as an instrument card (shell/hubcards.ts): one
//    button, an instrument, a status word (LIVE, READY, TRAINING or OFF), one line on what it does, two readouts — and the readouts are the app's own numbers: the
//    library's passages from the brain, the Lens's 4,624 names and its ways to look, the GYM's games, the studio's
//    built-in models, the school's stage from /api/school; a reading the phone has not got says so ("Not yet", or
//    the card's word), never a sample;
//  - the instruments are drawn (svg.inst) on the tools that have one, and the globe marks his home;
//  - nothing sits under the floating tab bar (every tool card is above it with the hub at the top), every card is a
//    44 pt target, a tap anywhere on a card opens its tool, nothing sticks out sideways;
//  - no app icons: no glyph tile (.sq) in a hub's tools, the kicker's glyph a bare line of 16 pt or less;
//  - the GYM: all 22 games have a picture, a meter with the pass mark's tick, the level and the next mark;
//  - the tab bar: the lit tab has its ring; while the GYM trains, Learn's live dot is on and its hub card says TRAINING;
//  - Graphite draws the same shapes in its own colour.
// Fails on the old hubs (glyph tiles with a name and a blurb: no instrument cards, no readouts).
//   BASE=http://localhost:8788 node tests/hubcards.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const HOME = { name: 'Birmingham', lat: 52.4862, lon: -1.8904 };
const problems = [];
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function brainGet(path) {
  const r = await fetch(`${base}/api${path}`, { headers: { 'x-ghosty-key': KEY } }).catch(() => null);
  return r?.ok ? r.json() : null;
}

async function open(theme) {
  const ctx = await browser.newContext({ viewport: PHONE, ...UK, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await ctx.addInitScript(([k, home, theme]) => {
    localStorage.setItem('ghosty.ownerKey', k);
    if (!localStorage.getItem('ghosty.settings')) localStorage.setItem('ghosty.settings', JSON.stringify({ home, units: 'metric', ...(theme ? { theme } : {}) }));
    // (a theme chosen on this phone: the one-look migration has run, so Graphite is kept)
    if (theme) localStorage.setItem('ghosty.themes1', '1');
  }, [KEY, HOME, theme]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 25000 });
  return { ctx, page };
}
const until = (page, fn, arg, ms, why) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => (problems.push(why), false));
const hub = async (page, a) => {
  await page.evaluate((h) => (location.hash = h), `area-${a}`);
  await until(page, (a) => document.body.dataset.tab === `area-${a}` && document.querySelectorAll(`#pg-area-${a} .hubgrid > .hubtile`).length > 0, a, 8000, `the ${a} hub did not open with its cards`);
  await page.waitForTimeout(1200);
};
/** What each card of a hub shows. */
const cardsOf = (page, a) => page.$$eval(`#pg-area-${a} .hubgrid > *`, (els) => els.map((e) => {
  const r = e.getBoundingClientRect();
  const glyph = e.querySelector('.kick .ic')?.getBoundingClientRect();
  const gp = e.querySelector('.kick .ic')?.parentElement;
  return {
    id: e.dataset.id, tag: e.tagName, inst: e.classList.contains('inst'), status: e.querySelector('.kick .st')?.textContent?.trim() ?? '',
    title: e.querySelector('.t')?.textContent?.trim() ?? '',
    reads: [...e.querySelectorAll('.reads .rd')].map((d) => ({ k: d.querySelector('em')?.textContent?.trim(), v: d.querySelector('b')?.textContent?.trim(), none: d.classList.contains('none') })),
    svg: e.querySelectorAll('svg.inst').length, drawn: !!e.querySelector('.ins:not([hidden]) > :is(svg.inst, .insc, .lensvf, .coursemap)'), sq: e.querySelectorAll('.sq').length,
    glyph: glyph ? Math.max(glyph.width, glyph.height) : 0, glyphBg: gp ? getComputedStyle(gp).backgroundColor : '',
    top: r.top, bottom: r.bottom, w: r.width, h: r.height,
  };
}));
const barTop = (page) => page.$eval('#dock .tabcap', (e) => e.getBoundingClientRect().top);
const num = (t) => Number(String(t ?? '').replace(/[^\d]/g, ''));

// what each hub holds (shell/areas.ts AREAS; Ask adds Voice)
const TOOLS = { ask: ['core', 'brief', 'voice'], see: ['eye', 'lens'], make: ['studio', 'workshop', 'reverse', 'space', 'workbench'], learn: ['learn', 'gym', 'school', 'library'], plan: ['agenda', 'markets', 'threats', 'radio'] };
const WORDS = ['LIVE', 'READY', 'TRAINING', 'OFF'];
const NONE = /^(Not yet|None yet|None|Nothing|Off air|Start one|Not set up|—)$/;

const { ctx, page } = await open();
const seen = {};
for (const [a, ids] of Object.entries(TOOLS)) {
  await hub(page, a);
  const cards = await cardsOf(page, a);
  seen[a] = cards;
  const got = cards.map((c) => c.id).join(',');
  if (got !== ids.join(',')) problems.push(`[${a}] the hub's tools are "${got}", want "${ids.join(',')}"`);
  const bar = await barTop(page);
  for (const c of cards) {
    const at = `[${a} ${c.id}]`;
    if (c.tag !== 'BUTTON' || !c.inst) problems.push(`${at} is not one instrument card (a ${c.tag}${c.inst ? '' : ' without .inst'})`);
    if (!WORDS.includes(c.status)) problems.push(`${at} status reads "${c.status}"`);
    if (!c.title) problems.push(`${at} has no line saying what it does`);
    if (c.reads.length !== 2) problems.push(`${at} has ${c.reads.length} readouts (want two)`);
    for (const r of c.reads) {
      if (!r.k || !r.v) problems.push(`${at} a readout is empty: ${JSON.stringify(r)}`);
      else if (r.none ? !NONE.test(r.v) : NONE.test(r.v)) problems.push(`${at} readout ${r.k} "${r.v}" is ${r.none ? 'marked unknown with a value' : 'unknown but not marked'}`);
    }
    if (!c.drawn) problems.push(`${at} draws no instrument`);
    if (c.sq) problems.push(`${at} still has a glyph tile (an app icon)`);
    if (!c.glyph || c.glyph > 16.5) problems.push(`${at} kicker glyph is ${c.glyph} pt (want a bare line of 16 pt or less)`);
    if (c.glyphBg && !/rgba\(0, 0, 0, 0\)|transparent/.test(c.glyphBg)) problems.push(`${at} glyph sits on a filled background ${c.glyphBg}`);
    if (c.w < 44 || c.h < 44) problems.push(`${at} is ${Math.round(c.w)}×${Math.round(c.h)} (under 44 pt)`);
    if (c.bottom > bar + 0.5) problems.push(`${at} runs under the tab bar (card bottom ${Math.round(c.bottom)}, bar top ${Math.round(bar)})`);
  }
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) problems.push(`[${a}] the hub scrolls sideways`);
  // one screen, nothing to scroll (the navigation sheet): the hub's own scroller has no more than it shows
  const scroll = await page.$eval(`#pg-area-${a} .hub`, (e) => ({ sh: e.scrollHeight, ch: e.clientHeight }));
  if (scroll.sh > scroll.ch + 1) problems.push(`[${a}] the hub scrolls (${scroll.sh} > ${scroll.ch})`);
  if (cards.length > 6) problems.push(`[${a}] ${cards.length} cards (six at most; the rest belong in the More row)`);
  if (cards.length <= 6 && (await page.locator(`#pg-area-${a} .hubmore:not([hidden])`).count())) problems.push(`[${a}] a More row with six tools or fewer`);
  await page.screenshot({ path: `${out}/hubcards-${a}.png` });
}

// ---- the readouts are the app's own numbers
const read = (a, id, k) => seen[a]?.find((c) => c.id === id)?.reads.find((r) => r.k === k)?.v;
if (read('see', 'lens', 'Names') !== '4,624') problems.push(`[see lens] Names reads "${read('see', 'lens', 'Names')}"`);
if (read('see', 'lens', 'Modes') !== '11') problems.push(`[see lens] Modes reads "${read('see', 'lens', 'Modes')}" (the Lens has 11 modes: PEOPLE joined on 31 Oct, SHAPES on 1 Nov)`);
if (read('make', 'studio', 'Built in') !== '6') problems.push(`[make studio] Built in reads "${read('make', 'studio', 'Built in')}" (six: the five samples and the car from its plate, which joined on 1 Nov)`);
if (!/^Birmingham today$/.test(seen.ask?.find((c) => c.id === 'brief')?.title ?? '')) problems.push(`[ask brief] the title does not name his city: "${seen.ask?.find((c) => c.id === 'brief')?.title}"`);
const lib = await brainGet('/library');
const passages = num(read('learn', 'library', 'Passages'));
if (lib && !(passages > 0 && Math.abs(passages - lib.stats.passages) / lib.stats.passages < 0.08)) problems.push(`[learn library] Passages reads "${read('learn', 'library', 'Passages')}", the library has ${lib.stats.passages}`);
const school = await brainGet('/school');
if (school?.state?.stage) {
  const want = school.current?.label ?? school.stages?.find((s) => s.id === school.state.stage)?.label;
  if (want && read('learn', 'school', 'Stage') !== want) problems.push(`[learn school] Stage reads "${read('learn', 'school', 'Stage')}", the school says ${want}`);
}
const gymCtr = await page.evaluate(() => { location.hash = 'area-learn'; return null; }).then(() => page.waitForTimeout(900)).then(() => page.$eval('#pg-area-learn .hubtile[data-id="gym"] .ctr', (e) => e.textContent.replace(/\s+/g, ''))).catch(() => '');
if (!/^\d+\/22mastered$/.test(gymCtr)) problems.push(`[learn gym] the ring's middle reads "${gymCtr}" (want n/22 mastered)`);
const core = read('ask', 'core', 'Uplink');
if (!/^\d+ms$/.test(core ?? '') && core !== 'Not yet') problems.push(`[ask core] Uplink reads "${core}"`);
// the globe marks his home and turns to it: the "you" mark is on the near side of the sphere
const you = await page.evaluate(() => { location.hash = 'area-see'; return null; }).then(() => page.waitForTimeout(900)).then(() => page.$eval('#pg-area-see .hubtile[data-id="eye"] svg.i-globe', (s) => {
  const y = s.querySelector('.g-you circle')?.getBoundingClientRect();
  const sph = s.querySelector('.g-sph')?.getBoundingClientRect();
  return y && sph ? { inside: y.left >= sph.left && y.right <= sph.right && y.top >= sph.top && y.bottom <= sph.bottom } : null;
})).catch(() => null);
if (!you?.inside) problems.push(`[see eye] the globe does not mark his home on its face: ${JSON.stringify(you)}`);

// ---- a tap anywhere on a card opens the tool
await hub(page, 'learn');
const box = await page.locator('#pg-area-learn .hubtile[data-id="library"] .reads').boundingBox({ timeout: 5000 }).catch(() => null);
if (box) await page.mouse.click(box.x + box.width - 8, box.y + box.height / 2);
else problems.push('the Library card has no readouts to tap');
if (box) await until(page, () => document.body.dataset.tab === 'library', null, 6000, 'a tap on the Library card\'s readouts did not open the library');

// ---- the GYM: 22 pictures, each card a meter with the pass mark, the level and the next mark
await page.evaluate(() => (location.hash = 'gym'));
await until(page, () => document.querySelectorAll('#pg-gym .gymcard').length === 22, null, 15000, 'the GYM did not show its 22 cards');
await page.waitForTimeout(800);
const gym = await page.$$eval('#pg-gym .gymcard', (els) => els.map((e) => ({
  id: e.dataset.game, art: e.querySelector('svg.gymart')?.childElementCount ?? 0, sig: e.querySelector('svg.gymart')?.innerHTML.length ?? 0,
  meter: !!e.querySelector('.meter i'), tick: !!e.querySelector('.meter u:not([hidden])') || e.classList.contains('mastered'),
  lvl: e.querySelector('.gymlvl')?.textContent?.trim(), next: (e.querySelector('.gymnext:not([hidden])') ?? e.querySelector('.gymrate:not([hidden])'))?.textContent?.trim() ?? '',
})));
for (const g of gym) {
  if (g.art < 4) problems.push(`[gym ${g.id}] its picture has ${g.art} parts`);
  if (!g.meter || !g.tick) problems.push(`[gym ${g.id}] no mastery meter with the pass mark`);
  if (!/^(LV \d+|ALL 10)$/.test(g.lvl ?? '')) problems.push(`[gym ${g.id}] level reads "${g.lvl}"`);
  if (!/^(Lv \d+ at \d+%|Lv 10 passes at \d+%|Every level passed|Rating [\d,]+ · .+)$/.test(g.next)) problems.push(`[gym ${g.id}] the next mark reads "${g.next}"`);
}
if (new Set(gym.map((g) => g.sig)).size !== gym.length) problems.push('two GYM games share a picture');
await page.screenshot({ path: `${out}/hubcards-gym.png` });

// ---- the tab bar: the lit tab's ring; the GYM training lights Learn's live dot and its hub card
const lit = await page.$eval('#dock .tabcap button.on', (b) => ({ area: b.dataset.area, halo: getComputedStyle(b.querySelector('.halo')).opacity })).catch(() => null);
if (lit?.area !== 'learn' || Number(lit?.halo) < 0.9) problems.push(`the lit tab's ring is not on Learn: ${JSON.stringify(lit)}`);
await page.click('#pg-gym .gymcard[data-game="tictactoe"]');
await page.waitForTimeout(500);
await page.locator('#pg-gym button.gymtrain').first().click().catch(() => problems.push('no TRAIN button on tic-tac-toe'));
if (await until(page, () => window.__ghosty?.gym?.training === 'tictactoe', null, 6000, 'TRAIN did not start')) {
  await until(page, () => document.querySelector('#dock .tabcap button[data-area="learn"]')?.classList.contains('live'), null, 4000, 'Learn\'s live dot is off while the GYM trains');
  await hub(page, 'learn');
  const st = await page.$eval('#pg-area-learn .hubtile[data-id="gym"] .kick .st', (e) => e.textContent.trim()).catch(() => '');
  if (st !== 'TRAINING') problems.push(`the GYM's hub card says "${st}" while it trains`);
  const now = await page.$$eval('#pg-area-learn .hubtile[data-id="gym"] .rd', (rs) => rs.map((r) => r.textContent.trim())).catch(() => []);
  if (!now.some((r) => /^NowTic-tac-toe Lv \d+$/.test(r))) problems.push(`the GYM's hub card does not say what trains now: ${JSON.stringify(now)}`);
  await page.screenshot({ path: `${out}/hubcards-training.png` });
  await page.evaluate(() => (location.hash = 'gym'));
  await page.waitForTimeout(600);
  if (!(await page.locator('#pg-gym button.gymtrain').first().isVisible().catch(() => false))) await page.click('#pg-gym .gymcard[data-game="tictactoe"]').catch(() => undefined);
  await page.locator('#pg-gym button.gymtrain').first().click().catch(() => undefined);
  await until(page, () => !window.__ghosty?.gym?.training, null, 6000, 'PAUSE did not stop the training');
  await until(page, () => !document.querySelector('#dock .tabcap button[data-area="learn"]')?.classList.contains('live'), null, 4000, 'Learn\'s live dot stayed on after PAUSE');
}
await ctx.close();

// ---- Graphite: the same shapes, its own colour
const reactorShape = seen.see?.find((c) => c.id === 'eye')?.svg;
const g = await open('graphite');
await hub(g.page, 'see');
const gr = await g.page.$eval('#pg-area-see .hubtile[data-id="eye"]', (e) => ({ theme: document.documentElement.dataset.theme, svg: e.querySelectorAll('svg.inst').length, rim: getComputedStyle(e.querySelector('svg.inst .g-rim')).stroke })).catch(() => null);
if (gr?.theme !== 'graphite' || gr.svg !== reactorShape || !/157, 183, 204/.test(gr.rim ?? '')) problems.push(`Graphite's God's eye card: ${JSON.stringify(gr)} (want the same instrument in steel, rgb(157, 183, 204))`);
await g.page.screenshot({ path: `${out}/hubcards-see-graphite.png` });
await g.ctx.close();

await browser.close();
if (problems.length) {
  console.error(`FAIL hubcards\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('hubcards: OK (every hub\'s tools as instrument cards with real readouts, nothing under the tab bar, 44 pt cards, no app icons, a tap anywhere opens the tool, the GYM\'s 22 pictures and meters, Learn\'s live dot while training, Graphite in steel)');
