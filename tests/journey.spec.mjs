// The journey planner on an iPhone 13: GO on God's Eye opens the planner (FROM is "Here"), a
// place that cannot be found is said in plain words, PLAN lists the options the brain answered
// (/api/journey is answered here from a real Transitous answer, so this runs without the
// internet), a tap draws the journey on the flat map leg by leg (the polylines are counted)
// with the JOURNEY sheet listing the steps, the other options' tabs swap the drawing, a tapped
// step moves the map, PLAN AGAIN comes back to the options, CLEAR takes the lines off; the
// chat path (the brain's show_journey command) opens the same; the command palette finds the
// planner; and the security policy blocked nothing.
//   node tests/journey.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';
import { mkdirSync, readFileSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const problems = [];

// The brain's own shaping of a real Transitous answer (the same fixture the brain's unit tests use).
const FIX = JSON.parse(readFileSync(new URL('../apps/edge/test/transitous.fixture.json', import.meta.url), 'utf8'));
const X = await import('../apps/edge/test/.build/integrations/transitous.mjs');
const from = { name: 'Here', lat: 52.4778, lon: -1.899 };
const to = { name: 'Pebble Mill Road', lat: 52.4515, lon: -1.9153 };
const itineraries = FIX.plan.itineraries.map((it, i) => X.compactItinerary(it, String(i + 1), from, to));
// a third option: the first again, but the bus is running live and three minutes late
const late = structuredClone(itineraries[0]);
late.id = '3';
late.legs[1].realTime = true;
late.legs[1].start = '2026-10-17T09:28:00Z';
itineraries.push(late);
const answer = { from, to, tz: 'Europe/London', time: '2026-10-17T09:15:00Z', arriveBy: false, itineraries };
const asked = [];

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: PHONE, ...UK, hasTouch: true, isMobile: true });
page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
await page.route(/\/api\/journey\?/, (r) => {
  const u = new URL(r.request().url());
  asked.push(u);
  if (/zzz/.test(u.searchParams.get('to') ?? '')) return r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'I couldn\'t find "zzz": try the name of a stop, a station, a street or a town.' }) });
  return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer) });
});
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#pair input', { timeout: 15000 });
await page.fill('#pair input', 'preview-owner-key-0123456789');
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
await page.evaluate(() => {
  window.__cspv = [];
  document.addEventListener('securitypolicyviolation', (e) => window.__cspv.push(`${e.violatedDirective} ${e.blockedURI}`));
});
await page.evaluate(() => (location.hash = 'eye'));
await page.waitForTimeout(1500);

const text = (sel) => page.textContent(sel).catch(() => '');
const count = (sel) => page.locator(sel).count();
const lines = () => count('.modal path.jleg');

// ---- GO: the planner
await page.click('#pg-eye .eyebot .btns button:has-text("GO")');
const planner = await page.waitForSelector('.modal .jform', { timeout: 10000 }).then(() => true, () => false);
if (!planner) problems.push('GO did not open the journey planner');
else {
  const fromValue = await page.inputValue('.modal .jform input[aria-label="From"]');
  if (fromValue !== 'Here') problems.push(`FROM is not "Here" by default: "${fromValue}"`);
  const chips = await page.$$eval('.modal .jchips button', (b) => b.map((x) => `${x.textContent.trim()}${x.classList.contains('on') ? '*' : ''}`));
  if (chips.join(' ') !== 'LEAVE NOW* LEAVE AT ARRIVE BY') problems.push(`the when chips read: ${chips.join(' ')}`);
  // PLAN with nowhere to go
  await page.click('.modal .jform button:has-text("PLAN")');
  await page.waitForTimeout(300);
  if (!/Say where to go/.test(await text('.modal .jerr'))) problems.push('PLAN with an empty TO did not ask where to go');
  // a place that cannot be found: the brain's words, as they are
  await page.fill('.modal .jform input[aria-label="To"]', 'zzz');
  await page.click('.modal .jform button:has-text("PLAN")');
  const said = await page.waitForFunction(() => /couldn't find "zzz"/.test(document.querySelector('.modal .jerr')?.textContent ?? ''), null, { timeout: 15000 }).then(() => true, () => false);
  if (!said) problems.push(`a place that cannot be found was not said in plain words: ${await text('.modal .jerr')}`);
  if (await count('.modal .jopt')) problems.push('options were listed for a place that cannot be found');
  // ARRIVE BY shows the time; LEAVE NOW hides it
  await page.click('.modal .jchips button:has-text("ARRIVE BY")');
  if (await page.$eval('.modal .jform input[type="datetime-local"]', (el) => el.hidden)) problems.push('ARRIVE BY did not show the time');
  await page.click('.modal .jchips button:has-text("LEAVE NOW")');
  if (!(await page.$eval('.modal .jform input[type="datetime-local"]', (el) => el.hidden))) problems.push('LEAVE NOW did not hide the time');
  // the real thing
  await page.fill('.modal .jform input[aria-label="To"]', 'Pebble Mill Road');
  await page.click('.modal .jform button:has-text("PLAN")');
  const listed = await page.waitForSelector('.modal .jopt', { timeout: 20000 }).then(() => true, () => false);
  if (!listed) problems.push(`PLAN listed no options: ${await text('.modal .jerr')}`);
  else {
    const n = await count('.modal .jopt');
    if (n !== 3) problems.push(`expected 3 options, got ${n}`);
    const first = await page.$eval('.modal .jopt', (el) => ({ time: el.querySelector('b')?.textContent, summary: el.querySelector('span')?.textContent, badges: [...el.querySelectorAll('.jbadge')].map((b) => b.textContent) }));
    if (first.time !== '10:20 → 10:39') problems.push(`the first option's times read "${first.time}" (expected 10:20 → 10:39 in London time)`);
    if (first.summary !== '19 min · no changes') problems.push(`the first option's summary reads "${first.summary}"`);
    if (first.badges.join(',') !== '61') problems.push(`the first option's line badges read "${first.badges.join(',')}"`);
    const q = asked.at(-1);
    if (!/^-?\d+\.\d+,-?\d+\.\d+$/.test(q?.searchParams.get('from') ?? '')) problems.push(`"Here" did not reach the brain as a coordinate pair: ${q?.searchParams.get('from')}`);
    if (q?.searchParams.get('to') !== 'Pebble Mill Road') problems.push(`TO reached the brain as: ${q?.searchParams.get('to')}`);
    if (!q?.searchParams.get('tz')) problems.push('the phone\'s time zone did not go with the question');
    if (q?.searchParams.get('arriveBy')) problems.push('LEAVE NOW sent arriveBy');
    await page.screenshot({ path: `${out}/phone-journey-options.png` });
    // tap the first option: the map, the lines, the sheet
    await page.click('.modal .jopt >> nth=0');
    const map = await page.waitForSelector('.modal .leaflet-container', { timeout: 20000 }).then(() => true, () => false);
    if (!map) problems.push('tapping an option did not open the map');
    else {
      if (await count('.modal .jform')) problems.push('the planner stayed open under the map');
      const drawn = await page.waitForFunction(() => document.querySelectorAll('.modal path.jleg').length >= 3, null, { timeout: 20000 }).then(() => true, () => false);
      if (!drawn) problems.push(`the journey's legs were not drawn: ${await lines()} lines`);
      const legs = await lines();
      if (legs !== 3) problems.push(`expected 3 leg lines (walk, bus, walk), got ${legs}`);
      const stops = await count('.modal path.jstop');
      if (stops !== 7) problems.push(`expected 7 stop dots along the bus, got ${stops}`);
      const ends = await count('.modal path.jend');
      if (ends !== 4) problems.push(`expected 4 rings (start, get on, get off, end), got ${ends}`);
      const dashed = await page.$$eval('.modal path.jleg', (p) => p.map((x) => !!x.getAttribute('stroke-dasharray')));
      if (dashed.join(',') !== 'true,false,true') problems.push(`walks dashed and the ride solid: ${dashed.join(',')}`);
      const head = await text('.modal .jhead b');
      if (head !== 'Here → Pebble Mill Road') problems.push(`the sheet's title reads "${head}"`);
      if (!/leave 10:15/.test(await text('.modal .jwhen'))) problems.push(`the sheet's time reads "${await text('.modal .jwhen')}"`);
      const tabs = await page.$$eval('.modal .jtabs button', (b) => b.map((x) => `${x.querySelector('b')?.textContent}${x.classList.contains('on') ? '*' : ''}`));
      if (tabs.join(' ') !== '1* 2 3') problems.push(`the option tabs read: ${tabs.join(' ')}`);
      const steps = await page.$$eval('.modal .jstep', (rows) => rows.map((r) => `${r.querySelector('.jtext b')?.textContent} | ${r.querySelector('.jtext span')?.textContent} | ${r.querySelector('.jbadge')?.textContent ?? ''} | ${r.querySelector('.jtime')?.textContent} | ${r.querySelector('.jtext em')?.textContent ?? ''}`));
      const want = [
        'Walk 5 min · 302 m | to Birmingham New Street Station · stop NS3 |  | 10:2010:25 | ',
        'Bus 61 towards Arden Road Terminus | from Birmingham New Street Station (stop NS3) · 8 stops · get off at Pebble Mill Road | 61 | 10:2510:35 | ',
        'Walk 4 min · 213 m | to Pebble Mill Road |  | 10:3510:39 | ',
      ];
      if (steps.join('\n') !== want.join('\n')) problems.push(`the steps read:\n${steps.join('\n')}\nexpected:\n${want.join('\n')}`);
      const badge = await page.$eval('.modal .jstep .jbadge', (el) => ({ bg: getComputedStyle(el).backgroundColor, fg: getComputedStyle(el).color }));
      if (badge.bg !== 'rgb(255, 178, 62)' || badge.fg !== 'rgb(0, 0, 0)') problems.push(`the bus badge is not amber with black text: ${JSON.stringify(badge)}`);
      await page.screenshot({ path: `${out}/phone-journey-map.png` });
      // a tapped step moves the map to it
      const before = await text('.modal .mapwhere');
      await page.click('.modal .jstep >> nth=1');
      const moved = await page.waitForFunction((b) => (document.querySelector('.modal .mapwhere')?.textContent ?? '') !== b, before, { timeout: 5000 }).then(() => true, () => false);
      if (!moved) problems.push('tapping a step did not move the map');
      else {
        const where = await text('.modal .mapwhere');
        if (!/^52\.477\d°, -1\.89\d+°/.test(where)) problems.push(`the map did not go to the bus stop: ${where}`);
      }
      if (!(await page.$('.modal .jstep.on'))) problems.push('the tapped step is not marked');
      // the other options: another line, then the late one
      await page.click('.modal .jtabs button >> nth=1');
      await page.waitForTimeout(400);
      const badge2 = await text('.modal .jstep .jbadge');
      if (badge2 !== '63') problems.push(`option 2 did not show the 63: ${badge2}`);
      if ((await lines()) !== 3) problems.push('option 2 was not redrawn');
      await page.click('.modal .jtabs button >> nth=2');
      await page.waitForTimeout(400);
      const live = await page.$$eval('.modal .jstep em', (e) => e.map((x) => `${x.className}:${x.textContent}`));
      if (live.join(' ') !== 'jlive late:live · 3 min late') problems.push(`the late bus is not marked live and late: ${live.join(' ')}`);
      const times = await page.$$eval('.modal .jstep .jtime', (e) => e.map((x) => x.textContent));
      if (times[1] !== '10:2810:35') problems.push(`the late bus does not show its live time: ${times[1]}`);
      // PLAN AGAIN: the planner, with the last options; a tap comes back to the map
      await page.click('.modal .jacts button:has-text("PLAN AGAIN")');
      const again = await page.waitForSelector('.modal .jform', { timeout: 10000 }).then(() => true, () => false);
      if (!again) problems.push('PLAN AGAIN did not open the planner');
      else {
        if (!/LAST PLANNED · Here → Pebble Mill Road/.test(await text('.modal .jform .lab:last-of-type').then((t) => t) || (await page.textContent('.modal .jres')))) problems.push(`the planner does not show the last options: ${await text('.modal .jres')}`);
        if ((await count('.modal .jopt')) !== 3) problems.push('PLAN AGAIN lost the options');
        await page.click('.modal .jopt >> nth=1');
        await page.waitForTimeout(800);
        const b = await text('.modal .jstep .jbadge');
        if (b !== '63') problems.push(`the option tapped from PLAN AGAIN is not drawn: ${b}`);
        if ((await count('.modal')) !== 1) problems.push(`${await count('.modal')} sheets are open after choosing an option again`);
      }
      // CLEAR takes the lines off
      await page.click('.modal .jacts button:has-text("CLEAR")');
      await page.waitForTimeout(300);
      if ((await lines()) !== 0) problems.push(`CLEAR left ${await lines()} lines on the map`);
      if (!(await page.$eval('.modal .jsheet', (el) => el.hidden))) problems.push('CLEAR did not put the sheet away');
      await page.click('.modal .mhead button:has-text("CLOSE")', { timeout: 10000 }).catch(() => page.click('.modal .mhead button:has-text("CLOSE")', { force: true }));
      await page.waitForTimeout(300);
      if (await page.$('.modal')) problems.push('the map sheet did not close');
    }
  }
}

// ---- From chat: the brain's show_journey command (the stream is faked: no network in the preview)
const ndjson = (events) => events.map((e) => JSON.stringify(e)).join('\n') + '\n';
const body = ndjson([
  { t: 'status', text: 'thinking…' },
  { t: 'tool', id: 'j1', name: 'plan_journey', args: { from: 'new street', to: 'moseley' } },
  { t: 'client', name: 'show_journey', args: { ...answer, from: { ...from, name: 'Birmingham New Street' }, to: { ...to, name: 'Moseley Village' } } },
  { t: 'tool_result', id: 'j1', name: 'plan_journey', ok: true, summary: 'Journeys from Birmingham New Street to Moseley Village' },
  { t: 'text', text: 'Three options; the first leaves at 10:20.' },
  { t: 'done', model: 'Mock · scripted' },
]);
await page.route('**/api/chat', (r) => r.continue({ url: `${base}/__test/stream?lines=${encodeURIComponent(Buffer.from(body).toString('base64'))}` }));
await page.evaluate(() => (location.hash = 'core'));
await page.waitForTimeout(900);
await page.click('.logbtn');
await page.fill('#cin', 'plan a journey from new street to moseley');
await page.keyboard.press('Enter');
const fromChat = await page.waitForFunction(() => document.querySelectorAll('.modal path.jleg').length >= 3, null, { timeout: 20000 }).then(() => true, () => false);
if (!fromChat) problems.push('the brain\'s show_journey did not draw the journey');
else {
  const head = await text('.modal .jhead b');
  if (head !== 'Birmingham New Street → Moseley Village') problems.push(`the sheet from chat reads "${head}"`);
  if (!/Three options/.test(await page.textContent('body'))) problems.push('the reply did not show in the chat');
  await page.screenshot({ path: `${out}/phone-journey-chat.png` });
  await page.click('.modal .mhead button:has-text("CLOSE")', { timeout: 10000 }).catch(() => page.click('.modal .mhead button:has-text("CLOSE")', { force: true }));
  await page.waitForTimeout(300);
}

// ---- The command palette knows the planner
await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
await page.keyboard.press('/');
const pal = await page.waitForSelector('#palette.on input', { timeout: 5000 }).then(() => true, () => false);
if (!pal) problems.push('the command palette did not open');
else {
  await page.fill('#palette input', 'journey');
  await page.waitForTimeout(200);
  const items = await page.$$eval('#palette .it span', (s) => s.map((x) => x.textContent));
  if (!items.some((t) => /Journey planner/.test(t))) problems.push(`the palette does not list the planner: ${items.join(' | ')}`);
  // "Ask Ghosty: journey" sits first (the palette's own row for any words); the planner is its own row
  await page.click('#palette .it:has-text("Journey planner")');
  const opened = await page.waitForSelector('.modal .jform', { timeout: 10000 }).then(() => true, () => false);
  if (!opened) problems.push('the palette did not open the planner');
  else {
    if (!(await count('.modal .jopt'))) problems.push('the planner from the palette does not show the last options');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    if (await page.$('.modal')) problems.push('Escape did not close the planner');
  }
}

const blocked = await page.evaluate(() => window.__cspv);
if (blocked.length) problems.push(`security policy blocked: ${blocked.join(', ')}`);

await browser.close();
if (problems.length) {
  console.log(`PROBLEMS:\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('Journey run clean: GO opens the planner with "Here", a place that cannot be found is said plainly, PLAN lists the brain\'s options, a tap draws the journey leg by leg on the map with the JOURNEY sheet, tabs swap options, a tapped step moves the map, PLAN AGAIN and CLEAR work, chat draws it too, the palette finds the planner, and the security policy blocked nothing.');
