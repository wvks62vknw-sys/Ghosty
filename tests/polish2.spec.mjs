// POLISH 2, THE PICTURE (BRIEF-POLISH-2; OWNER-ISSUES 176 and 178) on the owner's iPhone 18 Pro Max (440 × 956) and at 390 × 844, against the
// real brain with the pictures seeded (the Stage is asked to present the facts a turn would have given it: what is under test is what the
// Machine draws of them, and the Lens's tags with a fixture feed):
//  a. THE CHART: no label clipped (every text box inside the Stage and its picture), ticks at round numbers (1, 2, 5), the unit said once
//     and never on a tick, the last value written, a title that is the question's own words, a negative below a drawn zero, two series in
//     the system's own sequence, one point as a number said large, no data said in his words; twelve bars at 390 still whole.
//  b. THE MAP: a saved place is a block (zoom 16) with its pin inside the middle third and the name beside it, not over it; the first paint
//     under 600 ms from the data with a waiting line before it; a country is its outline inside the Stage; with no tiles, the offline
//     drawing, "offline map" said once; a route drawn whole on the flat map with both ends named and the time on it.
//  c. THE DOCUMENT: a letter is set as a page (margins, the reading type, the first lines in sight, the rest scrolling in the Stage),
//     OPEN is there; a formula's variables are dials with their units and the answer line is said again as one moves.
//  d. THE ROOM: lit from above-left with a soft shadow on the ground, the ground the system's own, the sizes written on the edges in the
//     unit he used, a part named where it is, a slow turn that stops on touch and stays stopped.
//  e. THE HAND-OVER: the sentence's top is the same before and after the Stage rises (a conversation long enough to scroll), the pointing
//     line set a frame after the paint and never before, a wrong promise handing its room back.
//  f. THE LENS'S TAGS: a fixture feed that drops a tag for one frame keeps the box drawn and moves it by easing (three frames monotone, no
//     jump over 40 px), the namer's word replaces the finder's only when it is the same for two frames, a tag leaving fades out, Reduce
//     Motion has no eased follow and still no flicker.
//  g. ONE INK: the Stage's chart is drawn in hairlines (no filled rect).
// Screenshots go to the output directory.
//   BASE=http://localhost:8788 node tests/polish2.spec.mjs [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';
import { makeCardVideo } from './fixtures/lenscard.mjs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const problems = [];
const check = (ok, what) => void (ok || problems.push(what));
const SCAN = { ground: 'graphite', world: 'scan', night: 'graphite', switches: {} };
const INK = { ground: 'warm', world: 'ink', night: 'warm', switches: {} };
const work = { id: 'work', label: 'Work', query: 'Work', address: '1 High Street, Birmingham', lat: 52.4452, lon: -1.8886 };
const TILE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const SIZES = [['440', PHONE], ['390', { width: 390, height: 844 }]];

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

async function open({ look = SCAN, viewport = PHONE, reduced = false } = {}) {
  const ctx = await browser.newContext({ viewport, ...UK, serviceWorkers: 'block', ...(reduced ? { reducedMotion: 'reduce' } : {}) });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => webkitNoise(e) || (console.log('pageerror', e.message), problems.push(`pageerror: ${e.message}`)));
  await page.addInitScript(({ key, look }) => {
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.themes1', '1');
    localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Boss', speak: false, sounds: false, theme: 'reactor', look, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
    window.__ghostyShow = true;
    window.__ghostyHero = true;
    window.__ghostyPlace = { none: true };
  }, { key: KEY, look });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 40000 }).catch(() => problems.push('the boot never ended'));
  await page.waitForFunction(() => !!window.__ghosty?.show, null, { timeout: 15000 }).catch(() => problems.push('window.__ghosty.show never appeared'));
  return { ctx, page };
}
const api = (page, path, init = {}) => page.evaluate(async ([p, i, k]) => (await fetch(`/api${p}`, { ...i, headers: { 'content-type': 'application/json', 'x-ghosty': '1', 'x-ghosty-key': k } })).json(), [path, init, KEY]);
const ndjson = (events) => events.map((e) => JSON.stringify(e)).join('\n') + '\n';
const until = (page, fn, arg, ms, what) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => (problems.push(what), false));

async function chatOpen(page) {
  const open = () => page.evaluate(() => !!document.querySelector('#pg-core .hud.core.logopen'));
  for (let i = 0; i < 8 && !(await open()); i++) {
    if (i === 0) await page.evaluate(() => (location.hash = 'core'));
    await page.waitForTimeout(i ? 600 : 300);
    await page.locator('.logbtn:visible').first().click({ timeout: 3000 }).catch(() => undefined);
    if (!(await open())) await page.evaluate(() => document.querySelector('.logbtn')?.click());
    await page.waitForTimeout(400);
  }
}
async function say(page, ask, reply) {
  const body = ndjson([{ t: 'status', text: 'thinking…' }, ...(reply ? [{ t: 'text', text: reply }] : []), { t: 'done', model: 'Mock · scripted' }]);
  await page.route('**/api/chat', (r) => r.continue({ url: `${base}/__test/stream?lines=${encodeURIComponent(Buffer.from(body).toString('base64'))}` }));
  await chatOpen(page);
  await page.fill('#cin', ask);
  await page.keyboard.press('Enter');
}
/** Present the facts a turn would have given the Stage (the chat open under it), and wait for the picture. */
async function show(page, facts, kind) {
  await chatOpen(page);
  await page.evaluate((f) => window.__ghosty.show.present({ tools: [], clients: [], cards: [], reply: '', ...f }), facts);
  return page.waitForFunction((k) => document.querySelector('#thestage:not(.leaving)')?.dataset.kind === k, kind, { timeout: 20000 }).then(() => true).catch(() => (problems.push(`[${kind}] the Stage did not come for ${JSON.stringify(facts.ask)}`), false));
}
/** The Stage's entrance has finished (it rises over 900 ms): a still is taken of the settled picture. */
const settle = (page) => page.evaluate(() => Promise.race([Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))), new Promise((r) => setTimeout(r, 3000))])).then(() => page.waitForTimeout(150)).catch(() => undefined);
const clear = async (page) => {
  await page.evaluate(() => window.__ghosty.show.clear());
  await page.waitForFunction(() => !document.querySelector('#thestage'), null, { timeout: 5000 }).catch(() => undefined);
};
const brainNumbers = (ask, points, extra = {}) => ({ ask, brain: { kind: 'numbers', data: { points, ...extra } } });
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const bills = MONTHS.slice(0, 6).map((m, i) => ({ label: m, value: [88, 94, 110, 102, 131, 124][i] }));

/** Every text of the picture inside the Stage and inside its own svg (nothing clipped), as a list of what is outside. */
const clipped = (page) => page.evaluate(() => {
  const st = document.querySelector('#thestage').getBoundingClientRect();
  const bad = [];
  for (const svg of document.querySelectorAll('#thestage svg')) {
    const sr = svg.getBoundingClientRect();
    for (const t of svg.querySelectorAll('text')) {
      const r = t.getBoundingClientRect();
      if (!r.width) continue;
      if (r.left < st.left - 0.5 || r.right > st.right + 0.5 || r.top < st.top - 0.5 || r.bottom > st.bottom + 0.5 || r.left < sr.left - 0.5 || r.right > sr.right + 0.5 || r.top < sr.top - 0.5 || r.bottom > sr.bottom + 0.5) bad.push(`${t.textContent} [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}] in Stage [${Math.round(st.left)},${Math.round(st.top)},${Math.round(st.right)},${Math.round(st.bottom)}]`);
    }
  }
  return bad;
});

// ================================================================ a. THE CHART
for (const [size, viewport] of SIZES) {
  const { ctx, page } = await open({ viewport });
  try {
  // a line of bills: the question's own words, £ once, round ticks, the last value written
  if (await show(page, brainNumbers('How have my bills gone this year?', bills, { line: true, unit: '£', before: true }), 'chart')) {
    await page.waitForTimeout(500);
    const c = await page.evaluate(() => ({
      title: document.querySelector('#thestage .stgtitle')?.textContent ?? '',
      ticks: [...document.querySelectorAll('#thestage .stg-t.tick')].map((t) => t.textContent),
      units: [...document.querySelectorAll('#thestage .stg-unit')].map((t) => t.textContent),
      last: [...document.querySelectorAll('#thestage .stg-t.fig.last')].map((t) => t.textContent),
      foot: [...document.querySelectorAll('#thestage .stg-t.cap:not(.tick):not(.unit)')].map((t) => t.textContent),
    }));
    check(c.title === 'Your bills this year', `[${size}][chart] the title is "${c.title}", not the question's own words "Your bills this year"`);
    check(c.units.length === 1 && c.units[0] === '£', `[${size}][chart] the unit is not said once on the axis: ${JSON.stringify(c.units)}`);
    check(c.ticks.length >= 3 && c.ticks.every((t) => !/[£%]/.test(t)), `[${size}][chart] a tick carries the unit: ${JSON.stringify(c.ticks)}`);
    const nums = c.ticks.map((t) => Number(t.replace(/,/g, '')));
    const step = nums[1] - nums[0];
    const mant = step / 10 ** Math.floor(Math.log10(step));
    check(nums.length >= 3 && nums.every((n, i) => i === 0 || Math.abs(n - nums[i - 1] - step) < 1e-6) && [1, 2, 5].some((m) => Math.abs(mant - m) < 1e-6), `[${size}][chart] ticks are not at round numbers (1, 2, 5 steps): ${JSON.stringify(c.ticks)}`);
    check(c.last.length === 1 && c.last[0] === '£124', `[${size}][chart] the last value is not written: ${JSON.stringify(c.last)}`);
    check(c.foot.includes('JAN') && c.foot.includes('JUN'), `[${size}][chart] the months are not in words along the foot: ${JSON.stringify(c.foot)}`);
    const bad = await clipped(page);
    check(bad.length === 0, `[${size}][chart] clipped labels: ${bad.join(' | ')}`);
    await settle(page);
    await page.screenshot({ path: `${out}/polish2-${size}-chart-line.png`, timeout: 20000 }).catch(() => undefined);
  }
  // stamps become words
  if (await show(page, brainNumbers('Spending by month', [{ label: '2026-01', value: 5 }, { label: '2026-02', value: 8 }, { label: '2026-03', value: 6 }], { line: true }), 'chart')) {
    const foot = await page.evaluate(() => [...document.querySelectorAll('#thestage .stg-t.cap:not(.tick):not(.unit)')].map((t) => t.textContent).join());
    check(/JAN/.test(foot) && !/2026/.test(foot), `[${size}][chart] a date is a raw stamp: ${foot}`);
  }
  // twelve bars, long labels, still whole at this width
  const shops = ['Sainsbury’s Local', 'Tesco Express', 'Waitrose', 'Marks and Spencer', 'Aldi', 'Lidl', 'Co-op', 'Morrisons', 'Iceland', 'Asda', 'Booths', 'Farmfoods'].map((label, i) => ({ label, value: [1240, 980, 1520, 760, 640, 590, 880, 1010, 420, 1130, 300, 260][i] }));
  if (await show(page, brainNumbers('What do the shops charge?', shops, { unit: '£', before: true }), 'chart')) {
    await page.waitForTimeout(400);
    const bad = await clipped(page);
    check(bad.length === 0, `[${size}][chart] twelve bars have clipped labels: ${bad.join(' | ')}`);
    const ticks = await page.evaluate(() => [...document.querySelectorAll('#thestage .stg-t.tick')].map((t) => t.textContent));
    check(ticks.every((t) => !/£/.test(t)), `[${size}][chart] a bar tick carries the unit: ${JSON.stringify(ticks)}`);
    await settle(page);
    await page.screenshot({ path: `${out}/polish2-${size}-chart-bars.png`, timeout: 20000 }).catch(() => undefined);
  }
  // negative values: below a drawn zero
  if (await show(page, brainNumbers('How is my balance', [{ label: 'Jan', value: 40 }, { label: 'Feb', value: -30 }, { label: 'Mar', value: 20 }, { label: 'Apr', value: -10 }], { line: true, unit: '£', before: true }), 'chart')) {
    const z = await page.evaluate(() => {
      const zero = document.querySelector('#thestage .stg-zero')?.getBoundingClientRect();
      const dots = [...document.querySelectorAll('#thestage .stg-dot')].map((d) => d.getBoundingClientRect());
      return { zero: !!zero, below: zero ? [dots[1].top > zero.top, dots[3].top > zero.top, dots[0].top < zero.top] : [] };
    });
    check(z.zero && z.below.every(Boolean), `[${size}][chart] negatives are not below a drawn zero: ${JSON.stringify(z)}`);
  }
  // two series from a table, in the system's own sequence
  await chatOpen(page);
  await page.evaluate(() => window.__ghosty.show.present({ ask: 'compare my spending and income', reply: '| Month | Spend | Income |\n|---|---|---|\n| Jan | 120 | 300 |\n| Feb | 95 | 280 |\n| Mar | 140 | 310 |', tools: [], clients: [], cards: [] }));
  if (await until(page, () => document.querySelector('#thestage')?.dataset.kind === 'chart', null, 15000, `[${size}][chart] a table of two columns did not draw`)) {
    const t = await page.evaluate(() => ({ s2: !!document.querySelector('#thestage .stg-line.s2'), legend: [...document.querySelectorAll('#thestage .legend')].map((x) => x.textContent), c1: getComputedStyle(document.querySelector('#thestage .stg-line.s1')).stroke, c2: getComputedStyle(document.querySelector('#thestage .stg-line.s2') ?? document.body).stroke }));
    check(t.s2 && t.legend.length === 2 && t.c1 !== t.c2, `[${size}][chart] two series are not two lines in two of the system's colours: ${JSON.stringify(t)}`);
  }
  // one point is the number, large; no data says so in his words
  if (await show(page, brainNumbers('What is my balance', [{ label: 'Today', value: 120 }], { unit: '£', before: true }), 'chart')) {
    const o = await page.evaluate(() => ({ big: document.querySelector('#thestage .stgnum')?.textContent ?? '', svg: document.querySelectorAll('#thestage .stgpic svg').length }));
    check(o.big === '£120' && o.svg === 0, `[${size}][chart] one point is not the number said large: ${JSON.stringify(o)}`);
  }
  if (await show(page, brainNumbers('What did I spend', [], { unit: '£' }), 'chart')) {
    const o = await page.evaluate(() => document.querySelector('#thestage .stgempty')?.textContent ?? '');
    check(/haven’t got any numbers/.test(o), `[${size}][chart] no data is not said in his words: "${o}"`);
  }
  } catch (e) {
    problems.push(`[${size}][chart] stopped: ${String(e.message).split('\n')[0]}`);
  }
  await ctx.close();
}

// ================================================================ b. THE MAP
for (const [size, viewport] of SIZES) {
  const { ctx, page } = await open({ viewport });
  try {
  await api(page, '/profile/places', { method: 'POST', body: JSON.stringify({ found: work }) });
  const zooms = [];
  await page.route('https://tile.openstreetmap.org/**', async (r) => {
    zooms.push(Number(new URL(r.request().url()).pathname.split('/')[1]));
    await new Promise((ok) => setTimeout(ok, 100));
    await r.fulfill({ contentType: 'image/png', body: TILE });
  });
  // a saved place: its block, the pin in the middle third, the name beside it, a waiting line before the first paint, painted under 600 ms
  await chatOpen(page);
  // (as a real turn: his places are asked for when his word is sent, and the reply takes longer than that)
  await page.evaluate(() => window.__ghosty.show.prefetch());
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__ghosty.show.present({ ask: 'where is my work', reply: 'Your work is on High Street.', tools: [], clients: [], cards: [] }));
  await page.waitForSelector('#thestage .stgmap', { timeout: 20000 }).catch(() => problems.push(`[${size}][map] a saved place did not bring the map`));
  const waited = await page.evaluate(async () => (await window.__ghosty.show.state()).waitLine);
  check(/Finding it on the map/.test(waited), `[${size}][map] no waiting line before the first paint: "${waited}"`);
  await until(page, () => !!document.querySelector('#thestage .stgmap') && !document.querySelector('#thestage .stgwait'), null, 15000, `[${size}][map] the map never painted`);
  await page.waitForTimeout(300);
  const m = await page.evaluate(async () => {
    const st = await window.__ghosty.show.state();
    const f = document.querySelector('#thestage .stgmap').getBoundingClientRect();
    const p = document.querySelector('#thestage .stgpin').getBoundingClientRect();
    const n = document.querySelector('#thestage .stgname').getBoundingClientRect();
    return { paintMs: st.paintMs, marks: st.marks, fx: f.left, fw: f.width, fy: f.top, fh: f.height, px: p.left + p.width / 2, py: p.top + p.height / 2, pl: p.left, pr: p.right, pt: p.top, pb: p.bottom, nl: n.left, nr: n.right, nt: n.top, nb: n.bottom, name: document.querySelector('#thestage .stgname').textContent, onePointed: document.querySelector('#thestage').dataset.pointed };
  });
  check(m.px > m.fx + m.fw / 3 && m.px < m.fx + (2 * m.fw) / 3 && m.py > m.fy + m.fh / 3 && m.py < m.fy + (2 * m.fh) / 3, `[${size}][map] the pin is not in the middle third: ${JSON.stringify(m)}`);
  const overlap = !(m.nr <= m.pl || m.nl >= m.pr || m.nb <= m.pt || m.nt >= m.pb);
  check(!overlap && m.name === 'Work', `[${size}][map] the name is over the pin or missing: ${JSON.stringify(m)}`);
  check(m.paintMs > 0 && m.paintMs < 600, `[${size}][map] the first paint took ${m.paintMs} ms from the data (budget 600)`);
  check(zooms.length >= 6 && zooms.every((z) => z === 16), `[${size}][map] a saved place is not a block (zoom 16): ${JSON.stringify([...new Set(zooms)])}`);
  await settle(page);
    await page.screenshot({ path: `${out}/polish2-${size}-map-block.png`, timeout: 20000 }).catch(() => undefined);
  // OPEN → the flat map: a route drawn whole with both ends named and the time on it
  // (the phone fetches the router through the brain's caching proxy: that is the request answered here)
  await page.route('**/api/proxy**', (r) => (/routing\.openstreetmap\.de/.test(decodeURIComponent(r.request().url())) ? r.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 'Ok', routes: [{ distance: 14000, duration: 1620, geometry: { coordinates: [[-1.9, 52.48], [-1.86, 52.5], [-1.8, 52.52], [-1.75, 52.5]] }, legs: [{ steps: [{ name: 'High Street', distance: 6000, maneuver: { type: 'depart' } }, { name: '', distance: 0, maneuver: { type: 'arrive' } }] }] }] }) }) : r.fallback()));
  await page.click('#thestage button[aria-label^="Open"]');
  if (await until(page, () => !!document.querySelector('.modal .leaflet-container'), null, 40000, `[${size}][route] the map sheet did not open`)) {
    await page.waitForTimeout(800);
    const box = await page.$eval('.modal .flatmap', (el) => el.getBoundingClientRect().toJSON());
    // (the map's first tap can land before its handlers are on: tapped again until the popup is up)
    let popup = false;
    for (let i = 0; i < 4 && !popup; i++) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      popup = await page.waitForSelector('.modal .leaflet-popup .fmpop', { timeout: 6000 }).then(() => true, () => false);
    }
    if (!popup) problems.push(`[${size}][route] the pin popup did not open`);
    await page.locator('.modal .fmpop .fmbtns button', { hasText: 'ROUTE HERE' }).click({ timeout: 5000 }).catch(() => problems.push(`[${size}][route] no ROUTE HERE`));
    await page.waitForSelector('.modal .fmend', { timeout: 20000 }).catch(() => problems.push(`[${size}][route] the route's ends are not named`));
    // (the map eases to the whole route: given time to settle)
    await page.waitForFunction(() => { const m = document.querySelector('.modal .flatmap')?.getBoundingClientRect(); const p = document.querySelector('.modal .leaflet-overlay-pane path.fmroute')?.getBoundingClientRect(); return !!m && !!p && p.left >= m.left - 1 && p.right <= m.right + 1 && p.top >= m.top - 1 && p.bottom <= m.bottom + 1; }, null, { timeout: 8000 }).catch(() => undefined);
    const r = await page.evaluate(() => {
      const map = document.querySelector('.modal .flatmap').getBoundingClientRect();
      const ends = [...document.querySelectorAll('.modal .fmend')].map((e) => e.textContent.trim());
      const time = document.querySelector('.modal .fmtime')?.textContent ?? '';
      const route = [...document.querySelectorAll('.modal .leaflet-overlay-pane path.fmroute')].map((p) => p.getBoundingClientRect());
      const inside = route.length > 0 && route.every((q) => q.left >= map.left - 1 && q.right <= map.right + 1 && q.top >= map.top - 1 && q.bottom <= map.bottom + 1);
      return { ends, time, inside, n: route.length };
    });
    check(r.ends.length >= 2 && r.ends.some((e) => /Birmingham/.test(e)) && r.ends.every((e) => e.length > 1), `[${size}][route] both ends are not named: ${JSON.stringify(r.ends)}`);
    check(/27 min by car/.test(r.time), `[${size}][route] the time is not on the route: "${r.time}"`);
    check(r.inside, `[${size}][route] the route is not drawn whole inside the map: ${JSON.stringify(r)}`);
    await settle(page);
    await page.screenshot({ path: `${out}/polish2-${size}-route.png`, timeout: 20000 }).catch(() => undefined);
    await page.keyboard.press('Escape').catch(() => undefined);
    await page.evaluate(() => { for (const b of document.querySelectorAll('.modal .mhead button')) if (/close/i.test(b.textContent ?? '')) b.click(); });
  }
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(2000);
  await clear(page);
  await api(page, '/profile/places?id=work', { method: 'DELETE' });
  } catch (e) {
    problems.push(`[${size}][map] stopped: ${String(e.message).split('\n')[0]}`);
  }
  await ctx.close();
}

// the country and the offline drawing, each on a fresh page (what the route's sheet leaves behind is not what is under test)
for (const [size, viewport] of SIZES) {
  const { ctx, page } = await open({ viewport });
  try {
  // a country: its outline inside the Stage, the place lit, the small globe for where it is
  if (await show(page, { ask: 'where is Lisbon?', reply: 'Lisbon is the capital of Portugal.' }, 'eye')) {
    await page.waitForTimeout(400);
    const c = await page.evaluate(async () => {
      const st = document.querySelector('#thestage').getBoundingClientRect();
      const o = document.querySelector('#thestage .stg-country');
      const r = o?.getBoundingClientRect();
      const s = await window.__ghosty.show.state();
      return { has: !!o && (s.drawn.country ?? 0) > 20, inside: !!r && r.width > 20 && r.left >= st.left && r.right <= st.right && r.top >= st.top && r.bottom <= st.bottom, centre: !!document.querySelector('#thestage [data-centre]'), globe: !!document.querySelector('#thestage .stg-globe'), drawn: s.drawn };
    });
    check(c.has && c.inside && c.centre && c.globe, `[${size}][country] a country is not its outline inside the Stage with the place lit: ${JSON.stringify(c)}`);
    await settle(page);
    await page.screenshot({ path: `${out}/polish2-${size}-country.png`, timeout: 20000 }).catch(() => undefined);
  }
  await clear(page);
  // the online map cannot load: the offline drawing, "offline map" said once
  await page.unroute('https://tile.openstreetmap.org/**');
  await page.route('https://tile.openstreetmap.org/**', (r) => r.abort());
  await chatOpen(page);
  await page.evaluate(() => window.__ghosty.show.present({ ask: 'show me lisbon on the map', reply: 'Here.', tools: [], clients: [], cards: [] }));
  if (await until(page, () => !!document.querySelector('#thestage .stgoff'), null, 20000, `[${size}][offline] the offline drawing never came when the tiles could not load`)) {
    const o = await page.evaluate(async () => ({ said: [...document.querySelectorAll('#thestage')].map((e) => (e.textContent.match(/offline map/gi) ?? []).length)[0], off: [...document.querySelectorAll('#thestage .stgoff')].length, pin: !!document.querySelector('#thestage .stgpin'), name: document.querySelector('#thestage .stgname')?.textContent, state: (await window.__ghosty.show.state()).offlineSaid }));
    check(o.said === 1 && o.off === 1 && o.state === 1 && o.pin && o.name === 'Lisbon', `[${size}][offline] "offline map" is not said once with the pin named: ${JSON.stringify(o)}`);
    await settle(page);
    await page.screenshot({ path: `${out}/polish2-${size}-map-offline.png`, timeout: 20000 }).catch(() => undefined);
  }
  } catch (e) {
    problems.push(`[${size}][country] stopped: ${String(e.message).split('\n')[0]}`);
  }
  await ctx.close();
}

// ================================================================ c. THE DOCUMENT and the formula's dials
for (const [size, viewport] of SIZES) {
  const { ctx, page } = await open({ viewport });
  try {
  const letter = 'Dear Sir or Madam,\n\nI am writing to ask the council to look at how our street’s bins are collected, which has changed three times since the spring and left the bags in the road for days.\n\nThe collection is meant to be every Tuesday. In the last six weeks it has been on a Tuesday twice, a Thursday once, and not at all on three other weeks.\n\nCould you tell me what the plan is, who I should speak to, and when the bins will be collected on the same day again?\n\nI would be grateful for a reply within fourteen days.\n\nYours faithfully,\nBoss';
  if (await show(page, { ask: 'Write me a letter to the council about the bins', reply: letter }, 'document')) {
    await page.waitForTimeout(500);
    const d = await page.evaluate(() => {
      const st = document.querySelector('#thestage').getBoundingClientRect();
      const pg = document.querySelector('#thestage .stgpage');
      const cs = getComputedStyle(pg);
      const p = pg.querySelector('.stgp');
      const pr = p.getBoundingClientRect();
      const probe = document.createElement('span');
      probe.style.font = 'var(--g-t-page)';
      document.body.append(probe);
      const want = getComputedStyle(probe).fontFamily;
      probe.remove();
      return { paper: pg.classList.contains('paper'), pad: parseFloat(cs.paddingLeft), overflow: cs.overflowY, scrolls: pg.scrollHeight > pg.clientHeight + 2, family: getComputedStyle(p).fontFamily, want, size: getComputedStyle(p).fontSize, firstIn: pr.top >= st.top && pr.bottom <= st.bottom, open: !!document.querySelector('#thestage button[aria-label^="Open"]'), inStage: pg.getBoundingClientRect().bottom <= st.bottom + 1 };
    });
    check(d.paper && d.pad >= 16 && d.family === d.want && d.size === '19px', `[${size}][document] the letter is not set as a page with margins in the reading type: ${JSON.stringify(d)}`);
    check(d.firstIn && d.overflow === 'auto' && d.scrolls && d.inStage, `[${size}][document] the first lines are not in sight with the rest scrolling inside the Stage: ${JSON.stringify(d)}`);
    check(d.open, `[${size}][document] no OPEN to take it to the editor`);
    await settle(page);
    await page.screenshot({ path: `${out}/polish2-${size}-document.png`, timeout: 20000 }).catch(() => undefined);
  }
  // a formula: dials with their units, the answer said again as one moves
  if (await show(page, { ask: 'how far would a ball go if I threw it at 20 m/s at 40 degrees?', reply: 'About 29 metres.' }, 'simulation')) {
    await page.waitForTimeout(500);
    const before = await page.evaluate(() => ({ dials: [...document.querySelectorAll('#thestage .stgdial')].map((d) => ({ k: d.querySelector('.stgdial-k')?.textContent, v: d.querySelector('.stgdial-v')?.textContent, h: Math.round(d.querySelector('input').getBoundingClientRect().height) })), answer: document.querySelector('#thestage .stganswer')?.textContent ?? '' }));
    check(before.dials.length >= 3 && before.dials.every((d) => d.h >= 44) && before.dials.some((d) => /20 m\/s/.test(d.v)) && before.dials.some((d) => /40 °/.test(d.v)), `[${size}][simulation] the variables are not dials with their units: ${JSON.stringify(before.dials)}`);
    await page.evaluate(() => { const i = document.querySelector('#thestage input[data-dial="angle"]'); i.value = '20'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.waitForTimeout(200);
    const after = await page.evaluate(() => ({ answer: document.querySelector('#thestage .stganswer')?.textContent ?? '', v: document.querySelector('#thestage input[data-dial="angle"]').closest('.stgdial').querySelector('.stgdial-v').textContent }));
    check(after.answer !== before.answer && /RANGE THROUGH AIR/i.test(after.answer) && /20 °/.test(after.v), `[${size}][simulation] the answer line was not said again as a dial moved: ${JSON.stringify({ before: before.answer, after })}`);
    await settle(page);
    await page.screenshot({ path: `${out}/polish2-${size}-simulation.png`, timeout: 20000 }).catch(() => undefined);
  }
  } catch (e) {
    problems.push(`[${size}][document] stopped: ${String(e.message).split('\n')[0]}`);
  }
  await ctx.close();
}

// ================================================================ d. THE ROOM and the part
for (const [size, viewport] of SIZES) {
  const { ctx, page } = await open({ viewport });
  try {
  if (await show(page, { ask: 'Draw me a 3 by 4 metre kitchen with a table and a stool', reply: 'Here is the kitchen.' }, 'room')) {
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => {
      const svg = document.querySelector('#thestage svg.iso');
      const c = (el) => { const b = el.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; };
      const shadow = document.querySelector('#thestage .stg-shadow');
      const ground = document.querySelector('#thestage .stg-ground');
      const probe = document.createElement('i');
      probe.style.background = 'var(--g-plate)';
      document.body.append(probe);
      const plate = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return { dims: [...svg.querySelectorAll('.dim')].map((t) => t.textContent), parts: [...svg.querySelectorAll('.partname')].map((t) => t.textContent), shadow: !!shadow, ground: !!ground, groundFill: ground && getComputedStyle(ground).fill, plate, right: shadow && ground ? c(shadow)[0] > c(ground)[0] : false, filter: shadow?.getAttribute('filter') };
    });
    check(r.dims.includes('3 m') && r.dims.includes('4 m') && r.dims.includes('2.4 m'), `[${size}][room] the sizes are not on the edges in the unit he used: ${JSON.stringify(r.dims)}`);
    check(r.parts.includes('TABLE') && r.parts.includes('STOOL'), `[${size}][room] a part is not named where it is: ${JSON.stringify(r.parts)}`);
    check(r.shadow && /soft/.test(r.filter ?? '') && r.right, `[${size}][room] no soft shadow thrown away from a light above and to the left: ${JSON.stringify(r)}`);
    check(r.ground && r.groundFill === r.plate, `[${size}][room] the ground is not the system's own: ${r.groundFill} against ${r.plate}`);
    // turning: it turns by itself, stops on a touch and stays stopped
    const yaw = () => page.evaluate(() => Number(document.querySelector('#thestage svg.iso').dataset.yaw));
    const y0 = await yaw();
    let y1 = y0;
    for (let i = 0; i < 12 && Math.abs(y1 - y0) <= 0.01; i++) {
      await page.waitForTimeout(250);
      y1 = await yaw();
    }
    check(Math.abs(y1 - y0) > 0.01, `[${size}][room] the room does not turn by itself (${y0} → ${y1})`);
    const box = await page.$eval('#thestage svg.iso', (e) => e.getBoundingClientRect().toJSON());
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(150);
    const a = await yaw();
    await page.waitForTimeout(500);
    const b = await yaw();
    check(Math.abs(b - a) < 0.002, `[${size}][room] the room kept turning under his finger (${a} → ${b})`);
    await page.mouse.up();
    await page.waitForTimeout(150);
    const c1 = await yaw();
    await page.waitForTimeout(600);
    const c2 = await yaw();
    check(Math.abs(c2 - c1) < 0.002, `[${size}][room] the room turned again after he let go (${c1} → ${c2})`);
    await settle(page);
    await page.screenshot({ path: `${out}/polish2-${size}-room.png`, timeout: 20000 }).catch(() => undefined);
  }
  if (await show(page, { ask: 'show me a desk 140 by 70', reply: 'Here is a desk.' }, 'part')) {
    await page.waitForTimeout(400);
    const dims = await page.evaluate(() => [...document.querySelectorAll('#thestage svg.iso .dim')].map((t) => t.textContent));
    check(dims.includes('140 cm') && dims.includes('70 cm') && dims.includes('75 cm'), `[${size}][part] the desk's sizes are not on its edges in cm: ${JSON.stringify(dims)}`);
    await settle(page);
    await page.screenshot({ path: `${out}/polish2-${size}-part.png`, timeout: 20000 }).catch(() => undefined);
  }
  } catch (e) {
    problems.push(`[${size}][room] stopped: ${String(e.message).split('\n')[0]}`);
  }
  await ctx.close();
}

// ================================================================ e. THE HAND-OVER from the sentence
for (const [size, viewport] of SIZES) {
  const { ctx, page } = await open({ viewport });
  try {
  // a conversation long enough to scroll: the sentence lands at the foot of it
  for (let i = 0; i < 7; i++) {
    await say(page, `hello ${i}`, `Hello Boss, this is answer number ${i}, and it is long enough to take a couple of lines of the log on a phone.`);
    await until(page, (n) => new RegExp(`answer number ${n}`).test(document.querySelector('.convo')?.textContent ?? ''), i, 15000, `[${size}][hand-over] answer ${i} never landed`);
  }
  await page.evaluate(() => {
    // (the Stage is slowed so the sentence has settled long before it comes: what is measured is what the Stage does to it)
    window.__ghostyShowDelay = 1800;
    window.__tops = [];
    const f = () => {
      const last = [...document.querySelectorAll('#pg-core .msg:not(.me)')].pop();
      window.__tops.push({ top: last ? Math.round(last.getBoundingClientRect().top * 10) / 10 : null, hit: /A room of 4 by 3/.test(last?.textContent ?? ''), stage: !!document.querySelector('#thestage'), at: performance.now() });
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
  await say(page, 'show me a room 4 by 3 with a sofa and a bed', 'A room of 4 by 3 metres with a sofa and a bed.');
  await page.waitForFunction(() => !!document.querySelector('#thestage'), null, { timeout: 25000 }).catch(() => problems.push(`[${size}][hand-over] the Stage did not rise`));
  await page.waitForTimeout(1800);
  await page.evaluate(() => (window.__ghostyShowDelay = 0));
  const h = await page.evaluate(async () => {
    const t = window.__tops.filter((x) => x.hit);
    const firstStage = t.findIndex((x) => x.stage);
    const st = await window.__ghosty.show.state();
    const truth = document.querySelector('#thestage .g-truth');
    const tops = t.map((x) => x.top);
    const settled = firstStage > 0 ? t[firstStage - 1].top : null;
    return { n: t.length, before: settled, atStage: firstStage >= 0 ? t[firstStage].top : null, after: t[t.length - 1]?.top ?? null, lead: firstStage, marks: st.marks, truthOpacity: truth ? getComputedStyle(truth).opacity : null };
  });
  check(h.before !== null && h.after !== null && Math.abs(h.before - h.after) <= 1 && Math.abs(h.atStage - h.after) <= 1, `[${size}][hand-over] the sentence moved when the Stage rose: top ${h.before} before, ${h.atStage} with the Stage, ${h.after} after (${h.lead} settled frames)`);
  check(h.marks.join() === 'mounted,painted,pointed' && h.truthOpacity === '1', `[${size}][hand-over] the pointing line was not set after the paint: ${JSON.stringify(h)}`);
  await settle(page);
    await page.screenshot({ path: `${out}/polish2-${size}-handover.png`, timeout: 20000 }).catch(() => undefined);
  // the Stage leaves as quietly as it came: faded, then gone
  await page.keyboard.press('Escape');
  const leaving = await page.evaluate(() => document.querySelector('#thestage')?.classList.contains('leaving') ?? 'gone');
  check(leaving === true || leaving === 'gone', `[${size}][hand-over] the Stage did not leave by fading`);
  await page.waitForFunction(() => !document.querySelector('#thestage'), null, { timeout: 3000 }).catch(() => problems.push(`[${size}][hand-over] the Stage never left`));
  // a wrong promise: his words promise a letter, the reply holds none; the room it took goes back, no Stage ever stood
  await say(page, 'write me a letter to my landlord', 'Which landlord do you mean?');
  await until(page, () => /Which landlord/.test(document.querySelector('.convo')?.textContent ?? ''), null, 15000, `[${size}][hand-over] the question never landed`);
  await page.waitForTimeout(1200);
  const w = await page.evaluate(async () => ({ stage: !!document.querySelector('#thestage'), staged: document.body.classList.contains('staged'), reserved: (await window.__ghosty.show.state()).reserved, why: (await window.__ghosty.show.state()).why }));
  check(!w.stage && !w.staged && w.reserved === '', `[${size}][hand-over] a wrong promise kept its room: ${JSON.stringify(w)}`);
  } catch (e) {
    problems.push(`[${size}][hand-over] stopped: ${String(e.message).split('\n')[0]}`);
  }
  await ctx.close();
}

// ================================================================ g. ONE INK: the Stage's chart in hairlines
{
  const { ctx, page } = await open({ look: INK });
  try {
  if (await show(page, brainNumbers('How have my bills gone this year?', bills.slice(0, 4), { unit: '£', before: true }), 'chart')) {
    await page.waitForTimeout(400);
    const f = await page.evaluate(() => ({ rects: [...document.querySelectorAll('#thestage svg rect')].map((r) => getComputedStyle(r).fill), strokes: [...document.querySelectorAll('#thestage svg .stg-bar')].map((r) => getComputedStyle(r).stroke), n: document.querySelectorAll('#thestage svg .stg-bar').length }));
    check(f.n === 4 && f.rects.every((x) => x === 'none') && f.strokes.every((x) => x !== 'none'), `[ink] the chart is filled, not drawn in hairlines: ${JSON.stringify(f)}`);
    await settle(page);
    await page.screenshot({ path: `${out}/polish2-ink-chart.png`, timeout: 20000 }).catch(() => undefined);
  }
  await clear(page);
  await chatOpen(page);
  await page.evaluate(() => window.__ghosty.show.present({ ask: 'where is Lisbon?', reply: 'Portugal.', tools: [], clients: [], cards: [] }));
  await page.waitForSelector('#thestage[data-kind="eye"]', { timeout: 20000 }).catch(() => problems.push('[ink] where is Lisbon? brought no picture'));
  await page.waitForTimeout(500);
  await settle(page);
    await page.screenshot({ path: `${out}/polish2-ink-country.png`, timeout: 20000 }).catch(() => undefined);
  } catch (e) {
    problems.push(`[ink] stopped: ${String(e.message).split('\n')[0]}`);
  }
  await ctx.close();
}

// ================================================================ f. THE LENS'S TAGS, steadied (a fixture feed; the camera is the fake one)
{
  const drawer = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined });
  const cardVideo = await makeCardVideo(drawer);
  await drawer.close();
  const lb = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-video-capture=${cardVideo}`] });
  const ctx = await lb.newContext({ viewport: PHONE, ...UK, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', permissions: ['camera'] });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`[lens] pageerror: ${e.message}`));
  try {
    await page.goto(base);
    await page.fill('#pair input', KEY);
    await page.click('#pair button.on');
    await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
    await page.evaluate(() => (location.hash = 'lens'));
    await page.waitForSelector('#pg-lens .lensbar', { timeout: 15000 });
    await page.waitForTimeout(600);
    if ((await page.evaluate(() => window.__ghosty.lens.camera)) === 'off') await page.locator('#pg-lens .lensbar button', { hasText: 'START' }).click();
    await page.waitForFunction(() => window.__ghosty.lens.camera === 'on' && !!window.__ghosty.oneFeed, null, { timeout: 40000 }).catch(() => problems.push('[lens] the camera did not open or the fixture feed is not there'));
    await page.waitForFunction(() => window.__ghosty.one.tags.some((t) => t.kind === 'text') && window.__ghosty.one.passes > 3, null, { timeout: 60000 }).catch(() => problems.push('[lens] the one view never tagged the card'));
    const sample = (size) => page.evaluate(async (box) => {
      const f = window.__ghosty.oneFeed;
      const frame = () => new Promise((ok) => requestAnimationFrame(ok));
      const sight = (x, label, named = true) => ({ kind: 'object', score: 0.9, truth: 'looks like a thing', box: { x, y: 140, w: 160, h: 120 }, data: { label, named } });
      const left = () => document.querySelector('.lenstag[data-kind="object"]')?.getBoundingClientRect().left ?? null;
      const one = () => window.__ghosty.one.tags.find((t) => t.kind === 'object');
      f.reset();
      await frame();
      const xs = [];
      f.see([sight(60, 'mug')]);
      await frame();
      xs.push(left());
      // the finder misses it for one frame: the box stays drawn
      f.see([]);
      await frame();
      xs.push(left());
      // and it has moved on: the box follows by easing
      f.see([sight(190, 'mug')]);
      for (let i = 0; i < 6; i++) {
        await frame();
        xs.push(left());
      }
      // the namer's word: once is not enough, twice is
      f.see([sight(190, 'cup')]);
      const once = one()?.label;
      f.see([sight(190, 'cup')]);
      await frame();
      const twice = one()?.label;
      // a tag that leaves fades out first
      f.drop('object');
      const ghost = document.querySelector('.lensghost[data-kind="object"]');
      const leaving = !!ghost && !document.querySelector('.lenstag[data-kind="object"]');
      const op = ghost ? Number(getComputedStyle(ghost).opacity) : null;
      await new Promise((ok) => setTimeout(ok, 700));
      const gone = !document.querySelector('.lenstag[data-kind="object"]') && !document.querySelector('.lensghost[data-kind="object"]');
      return { xs, once, twice, leaving, op, gone, inner: innerWidth, box };
    }, size);
    for (const [size, viewport] of SIZES) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(500);
      const s = await sample(size);
      const d = s.xs.slice(1).map((x, i) => (x === null || s.xs[i] === null ? NaN : x - s.xs[i]));
      check(s.xs[0] !== null && s.xs[1] !== null, `[${size}][lens] the tag flickered: its box was not drawn on the frame the finder missed it (${JSON.stringify(s.xs)})`);
      check(d.slice(1).every((x) => Number.isFinite(x) && x >= -0.5 && Math.abs(x) <= 40), `[${size}][lens] the box did not follow by easing (monotone, no jump over 40 px): ${JSON.stringify(s.xs)}`);
      check(s.xs[7] - s.xs[2] > 8 && s.xs[2] - s.xs[1] < 40, `[${size}][lens] the box did not move over the frames: ${JSON.stringify(s.xs)}`);
      check(s.once === 'mug' && s.twice === 'cup', `[${size}][lens] the namer's word did not wait for two frames: once "${s.once}", twice "${s.twice}"`);
      check(s.leaving && s.op !== null && s.gone, `[${size}][lens] a tag leaving did not fade out: ${JSON.stringify({ leaving: s.leaving, op: s.op, gone: s.gone })}`);
    }
    // Reduce Motion: no eased follow, still no flicker
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize(PHONE);
    await page.waitForTimeout(400);
    const r = await sample('reduced');
    check(r.xs[0] !== null && r.xs[1] !== null, `[reduced][lens] a tag flickered with Reduce Motion on (${JSON.stringify(r.xs)})`);
    check(Math.abs(r.xs[3] - r.xs[2]) < 1.5, `[reduced][lens] the box eased with Reduce Motion on: ${JSON.stringify(r.xs)}`);
  } catch (e) {
    problems.push(`[lens] the section stopped: ${String(e.message).split('\n')[0]}`);
  }
  await ctx.close();
  await lb.close();
}

await browser.close();
if (problems.length) {
  console.log(`PROBLEMS:\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('Polish 2 run clean: the chart has round ticks, its unit once, its last value written, dates in words, negatives under a drawn zero, two series in the system\'s colours, one number said large and no data said in his words, nothing clipped at 440 or 390; a saved place is its block with the pin in the middle third and its name beside it, painted under 600 ms, a country is its outline, the offline drawing says "offline map" once, a route is drawn whole with both ends named and its time; a letter is a page with OPEN and a formula has dials; a room is lit from above-left with a soft shadow, its sizes on the edges and a turn that stops on touch; the sentence does not move when the Stage rises; the Lens\'s tags ease, keep their box through a missed frame, wait for the namer twice and fade; ONE INK draws its chart in hairlines.');
