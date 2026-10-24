// Mini-apps (packages/shared/src/appkit, src/appbuild.ts, the app routes in src/tools/sites.ts): the request
// is read into an app; every template's real logic (a tracker's day rollover and streak, a list's reorder and
// clear-done, a timer's pause and catch-up, the bill split to the penny, conversions, a counter's leader, habit
// streaks, notes, spaced repetition, the game's merges); the gates; the page, its hash-pinned policy, the
// manifest, icon and service worker routes (and a plain site still framed); build_app's approval, its steps
// with the mocked store, resuming after a failed publish, and refusing honestly; the build as a Workshop project
// (its five steps moved on one by one, the report with the link, RESUME / RUN NEXT NOW carrying a stopped build on
// from its record). Run from sites.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({
  stdin: {
    contents: `export * from '../../packages/shared/src/appkit/index.ts';
export * as AB from './src/appbuild.ts';
export * as PJ from './src/projects.ts';
export { checkHtml } from './src/tools/check.ts';
export { siteTools, siteStore, siteResponse, siteFrameResponse, PAGE_CSP } from './src/tools/sites.ts';
export { default as worker } from './src/index.ts';`,
    resolveDir: at('..'),
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  external: ['cloudflare:sockets'],
  outfile: at('./.build/appkit.mjs'),
  logLevel: 'warning',
});
const K = await import('./.build/appkit.mjs');
const logic = (shape) => new Function(`${K.SHAPE_CODE[shape].LOGIC}\nreturn L;`)();

// ── the request read into an app ──────────────────────────────────────────────────

test('the brief reader: ten requests become the right app, with goals, items, steps, questions and honest limits', () => {
  const r = (q) => K.readApp(q);
  const w = r('make me an app that tracks my water intake');
  assert.equal(w.shape, 'tracker');
  assert.equal(w.title, 'Water');
  assert.equal(w.goal, 8);
  assert.equal(w.unit, 'glasses');
  assert.deepEqual(w.questions.map((q) => [q.key, q.fallback]), [['goal', '8 glasses']], 'the goal was assumed: asked, with the answer it uses');
  const tip = r('a tip calculator for the group');
  assert.equal(tip.shape, 'calc');
  assert.equal(tip.calc, 'tip');
  const pack = r('packing list for Spain with passport, charger and sun cream');
  assert.equal(pack.list, 'packing');
  assert.equal(pack.title, 'Packing for Spain');
  assert.deepEqual(pack.items, ['Passport', 'Charger', 'Sun cream']);
  const plank = r('a plank timer: 1 minute on, 30 seconds rest, 3 rounds');
  assert.deepEqual(plank.steps, [{ name: 'Plank', secs: 60 }, { name: 'Rest', secs: 30 }]);
  assert.equal(plank.rounds, 3);
  assert.deepEqual(r('warm up 5 min, run 20 min, cool down 5 min timer').steps.map((s) => s.secs), [300, 1200, 300]);
  const darts = r('scoreboard for darts with me and Sam');
  assert.equal(darts.shape, 'counter');
  assert.deepEqual(darts.items, ['Me', 'Sam']);
  const habits = r('habit tracker for walking, reading and no sugar');
  assert.equal(habits.shape, 'habits', 'a habit tracker is a habit grid, not a tracker');
  assert.deepEqual(habits.items, ['Walking', 'Reading', 'No sugar']);
  const cards = r('flash cards for my French verbs');
  assert.equal(cards.shape, 'cards');
  assert.equal(cards.subject, 'French verbs');
  const spend = r('spending tracker with a £50 weekly budget');
  assert.deepEqual([spend.goal, spend.period, spend.dir, spend.money], [50, 'week', 'limit', true]);
  assert.deepEqual([r('I want to drink 2 litres of water a day').goal, r('I want to drink 2 litres of water a day').unit], [2000, 'ml']);
  // honest: what a web mini-app cannot do
  const trains = r('an app that shows live train times from Walsall');
  assert.match(trains.refuse, /live data/);
  assert.deepEqual(r('shared shopping list with my wife').limits.map((l) => l.key), ['sync']);
  assert.ok(r('water tracker with reminders').limits.some((l) => l.key === 'notify'));
  assert.ok(r('step counter that counts my steps automatically').limits.some((l) => l.key === 'background'));
  // essential questions have no fallback (the app is not made until they are answered); two at most
  assert.deepEqual(r('make me a tracker').questions.map((q) => [q.key, q.fallback]), [['subject', undefined]]);
  assert.deepEqual(r('make me an app').questions.map((q) => q.key), ['shape']);
  for (const q of ['make me an app', 'a timer', 'scoreboard', 'habits', 'make me a tracker']) assert.ok(r(q).questions.length <= 2);
});

test('the plan: the model gives words and options only; claims and markup are dropped, and what it does/saves is the kit\'s own', () => {
  const p = K.planApp('make me an app that tracks my water intake', { shape: 'tracker', title: 'Water <b>now</b>', tagline: 'Syncs to the cloud and sends reminders', goal: 10 }, 'water');
  assert.equal(p.cfg.title, 'Water', 'a title with markup falls back to the kit\'s');
  assert.equal(p.cfg.tagline, '', 'a line claiming sync and reminders is dropped');
  assert.equal(p.cfg.tracker.goal, 10);
  assert.deepEqual(p.questions, [], 'the goal was given');
  assert.match(p.cfg.does, /towards 10 glasses a day/);
  assert.match(p.cfg.saves, /on this phone only/);
  assert.equal(K.cleanWords('The official NHS water app', 28), '');
  assert.equal(K.cleanText('see https://evil.example', 60), '');
  assert.deepEqual(K.cleanCards(['être | to be', { q: 'avoir', a: 'to have' }, 'no answer']), [{ q: 'être', a: 'to be' }, { q: 'avoir', a: 'to have' }]);
  assert.deepEqual(K.cleanSteps(['Plank 60s', 'Rest 0.5m', { name: 'Hold', secs: 0 }]), [{ name: 'Plank', secs: 60 }, { name: 'Rest', secs: 30 }]);
  assert.equal(K.shortName('Packing for Spain'), 'Packing for');
});

// ── each template's logic ─────────────────────────────────────────────────────────

test('tracker: entries add up per day, midnight starts a new day, the week starts on Monday, and streaks count right', () => {
  const L = logic('tracker');
  const st = { entries: [] };
  const t = (d, h, m = 0) => new Date(2026, 9, d, h, m).getTime();
  L.add(st, t(22, 9), 3);
  L.add(st, t(23, 10), 5);
  L.add(st, t(23, 23, 59), 4);
  L.add(st, t(24, 0, 1), 2);
  assert.equal(L.total(st, '2026-10-23', 'day', 'sum'), 9);
  assert.equal(L.total(st, '2026-10-24', 'day', 'sum'), 2, 'one minute after midnight is the new day');
  assert.equal(L.total(st, '2026-10-25', 'day', 'sum'), null);
  assert.equal(L.total(st, '2026-10-23', 'day', 'last'), 4);
  assert.equal(L.weekKey(new Date(2026, 9, 25, 12)), '2026-10-19', 'Sunday belongs to the week that started on Monday 19th');
  assert.equal(L.total(st, '2026-10-19', 'week', 'sum'), 14);
  const now = new Date(2026, 9, 24, 15);
  assert.deepEqual(L.series(st, now, 3, 'day', 'sum').map((x) => x.v), [3, 9, 2]);
  // reach 3 a day: today (2) still in progress does not break it; 22nd and 23rd met
  assert.equal(L.streak(st, now, { goal: 3, dir: 'reach', period: 'day', mode: 'sum' }), 2);
  // limit 5 a day: the 23rd went over, today is within
  assert.equal(L.streak(st, now, { goal: 5, dir: 'limit', period: 'day', mode: 'sum' }), 1);
  assert.equal(L.streak(st, new Date(2026, 9, 26, 9), { goal: 3, dir: 'reach', period: 'day', mode: 'sum' }), 0, 'a whole day missed breaks it');
  assert.ok(L.remove(st, t(24, 0, 1)));
  assert.equal(L.total(st, '2026-10-24', 'day', 'sum'), null);
});

test('list: add (no duplicates), tick, reorder, clear what is done, start a packing list again', () => {
  const L = logic('list');
  const st = { items: [] };
  for (const [i, x] of ['Passport', 'Charger', 'Sun cream'].entries()) assert.ok(L.add(st, x, `i${i}`));
  assert.equal(L.add(st, '  passport ', 'dup'), false, 'already on the list');
  assert.ok(L.move(st, 'i2', -1));
  assert.deepEqual(st.items.map((x) => x.text), ['Passport', 'Sun cream', 'Charger']);
  assert.equal(L.move(st, 'i0', -1), false, 'the first cannot go higher');
  L.toggle(st, 'i0');
  L.toggle(st, 'i1');
  assert.deepEqual(L.counts(st), { left: 1, done: 2 });
  assert.equal(L.again(st), 2);
  L.toggle(st, 'i0');
  assert.equal(L.clearDone(st), 1);
  assert.deepEqual(st.items.map((x) => x.text), ['Sun cream', 'Charger']);
});

test('timer: start, pause holds, resume, steps and rounds follow the clock, catch-up after time away, skip while paused', () => {
  const L = logic('timer');
  const st = { steps: [{ name: 'Plank', secs: 60 }, { name: 'Rest', secs: 30 }], rounds: 2, run: null, done: 0 };
  L.start(st, 0);
  assert.equal(L.remaining(st, 10_000), 50_000);
  L.pause(st, 10_000);
  assert.equal(L.remaining(st, 70_000), 50_000, 'a minute paused changes nothing');
  L.resume(st, 70_000);
  assert.equal(L.tick(st, 119_999).steps, 0);
  assert.deepEqual(L.tick(st, 120_000), { steps: 1, finished: false });
  assert.equal(st.steps[st.run.i].name, 'Rest');
  // the phone locked for five minutes: rest, round 2's plank and rest are all over → finished
  assert.deepEqual(L.tick(st, 420_000), { steps: 2, finished: true });
  assert.equal(st.run, null);
  assert.equal(st.done, 1);
  L.start(st, 0);
  L.pause(st, 5_000);
  assert.equal(L.skip(st, 6_000), 'step');
  assert.equal(st.run.left, 30_000, 'skipped while paused: the next step waits, paused, at its full length');
  assert.equal(L.fmt(61_000), '1:01');
  assert.equal(L.fmt(3_600_000), '1:00:00');
  assert.deepEqual(L.parse('Plank 60s\nRest 1m'), [{ name: 'Plank', secs: 60 }, { name: 'Rest', secs: 60 }]);
});

test('calculator: the bill split in pence always adds up; units, fuel, VAT, loan and percentages are right', () => {
  const L = logic('calc');
  const t = L.tip(84.5, 12.5, 3, false);
  assert.deepEqual(t, { tip: 10.56, total: 95.06, each: 31.68, extra: 2, people: 3 });
  assert.equal(Math.round((t.each * t.people + t.extra / 100) * 100) / 100, t.total, 'no penny lost');
  const up = L.tip(84.5, 12.5, 3, true);
  assert.equal(up.each, 32);
  assert.equal(up.total, 96);
  assert.equal(L.tip(0, 10, 2), null);
  assert.ok(Math.abs(L.convert(1, 'mi', 'km', 'length') - 1.609344) < 1e-9);
  assert.equal(L.convert(100, 'C', 'F', 'temperature'), 212);
  assert.ok(Math.abs(L.convert(1, 'st', 'kg', 'weight') - 6.35029318) < 1e-9);
  assert.ok(Math.abs(L.convert(1, 'pint', 'ml', 'volume') - 568.26125) < 1e-6, 'a UK pint');
  const f = L.fuel(100, 50, 140);
  assert.ok(Math.abs(f.litres - 9.09218) < 1e-5, 'UK gallons');
  assert.ok(Math.abs(f.cost - 12.7290) < 1e-3);
  assert.deepEqual(L.vat(100, 20, true), { net: 100, vat: 20, gross: 120 });
  assert.ok(Math.abs(L.vat(120, 20, false).net - 100) < 1e-9);
  const loan = L.loan(200_000, 5, 25);
  assert.ok(Math.abs(loan.monthly - 1169.18) < 0.01, `monthly ${loan.monthly}`);
  assert.equal(L.loan(1200, 0, 1).monthly, 100);
  assert.equal(L.pct('of', 15, 200), 30);
  assert.equal(L.pct('is', 50, 200), 25);
  assert.equal(L.pct('change', 80, 100), 25);
});

test('counter, habits, notes: scores and the leader, habit streaks across days, notes sorted, searched and tidied', () => {
  const C = logic('counter');
  const c = { counters: [{ id: 'a', name: 'Me', n: 0 }, { id: 'b', name: 'Sam', n: 0 }], log: [] };
  C.bump(c, 'b', 1, 1);
  C.bump(c, 'b', 1, 2);
  C.bump(c, 'a', 1, 3);
  assert.equal(C.leader(c), 'b');
  C.bump(c, 'a', 1, 4);
  assert.equal(C.leader(c), null, 'a tie has no leader');
  assert.ok(C.reset(c));
  assert.deepEqual(c.counters.map((x) => x.n), [0, 0]);
  assert.equal(C.remove({ counters: [{ id: 'x', n: 0 }] }, 'x'), false, 'the last counter stays');
  const H = logic('habits');
  const h = { habits: [{ id: 'w', name: 'Walk' }], done: {} };
  for (const d of ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23']) H.toggle(h, 'w', d);
  assert.equal(H.streak(h, 'w', '2026-10-24'), 4, 'today not done yet does not break it');
  H.toggle(h, 'w', '2026-10-24');
  assert.equal(H.streak(h, 'w', '2026-10-24'), 5);
  assert.equal(H.streak(h, 'w', '2026-10-26'), 0);
  assert.deepEqual(H.days('2026-11-01', 3), ['2026-10-30', '2026-10-31', '2026-11-01'], 'across the month end');
  assert.equal(H.count(h, 'w', H.days('2026-10-24', 7)), 5);
  const N = logic('notes');
  const n = { notes: [] };
  N.add(n, 'a', 1);
  N.edit(n, 'a', 'Shopping\nmilk and eggs', 2);
  N.add(n, 'b', 3);
  N.edit(n, 'b', 'Garden ideas', 4);
  N.pin(n, 'a');
  N.add(n, 'c', 5);
  assert.deepEqual(N.sorted(n, '').map((x) => x.id), ['a', 'c', 'b'], 'pinned first, then the newest');
  assert.deepEqual(N.sorted(n, 'EGGS').map((x) => x.id), ['a']);
  assert.equal(N.tidy(n), 1, 'an empty new note is tidied away');
  assert.equal(N.title('Shopping\nmilk'), 'Shopping');
  assert.equal(N.snippet('Shopping\nmilk\neggs'), 'milk eggs');
});

test('flash cards: a known card comes back in 1, 2, 4, 8, 16 days; a missed one comes back today, after the others', () => {
  const L = logic('cards');
  const st = { cards: [], studied: {} };
  L.add(st, 'être', 'to be', 'a', '2026-10-24');
  L.add(st, 'avoir', 'to have', 'b', '2026-10-24');
  assert.equal(L.add(st, 'aller', '', 'c', '2026-10-24'), false);
  L.grade(st, 'a', true, '2026-10-24', 1);
  assert.equal(L.find(st, 'a').due, '2026-10-25');
  L.grade(st, 'b', false, '2026-10-24', 2);
  assert.deepEqual(L.due(st, '2026-10-24').map((c) => c.id), ['b']);
  for (const [day, next] of [['2026-10-25', '2026-10-27'], ['2026-10-27', '2026-10-31'], ['2026-10-31', '2026-11-08'], ['2026-11-08', '2026-11-24'], ['2026-11-24', '2026-12-10']]) {
    L.grade(st, 'a', true, day, 3);
    assert.equal(L.find(st, 'a').due, next);
  }
  assert.equal(L.find(st, 'a').box, 5);
  assert.equal(L.stats(st, '2026-10-24').learned, 1);
  assert.equal(L.nextDue(st, '2026-10-24'), '2026-12-10');
  // two missed cards take turns instead of the same one again and again
  const s2 = { cards: [], studied: {} };
  L.add(s2, 'x', '1', 'x', 'd');
  L.add(s2, 'y', '2', 'y', 'd');
  L.grade(s2, L.due(s2, 'd')[0].id, false, 'd', 10);
  assert.equal(L.due(s2, 'd')[0].id, 'y');
});

test('the game: rows slide and merge once, a turn adds a tile, no move when nothing can slide, UNDO one move, game over', () => {
  const L = logic('game');
  assert.deepEqual(L.slide([2, 2, 2, 2]), { row: [4, 4, 0, 0], score: 8, moved: true });
  assert.deepEqual(L.slide([4, 0, 4, 8]).row, [8, 8, 0, 0], 'a merged tile does not merge again in the same move');
  assert.equal(L.slide([2, 4, 8, 16]).moved, false);
  const g = [2, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4];
  assert.deepEqual(L.move(g, 'right').grid.slice(0, 4), [0, 0, 0, 4]);
  assert.deepEqual(L.move(g, 'up').grid.slice(0, 4), [2, 0, 0, 2]);
  const seq = [0.5, 0.95];
  const rnd = () => seq.shift() ?? 0;
  const st = { grid: g.slice(), score: 0, best: 0, prev: null, over: false, won: false };
  assert.ok(L.turn(st, 'left', rnd));
  assert.equal(st.score, 4);
  assert.equal(st.grid.filter(Boolean).length, 3, 'two merged, one new tile');
  assert.ok(st.grid.includes(4));
  assert.ok(L.undo(st));
  assert.deepEqual(st.grid, g);
  assert.equal(L.undo(st), false, 'one move back only');
  assert.equal(L.canMove([2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2]), false);
  assert.equal(L.turn({ grid: [2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2], score: 0, best: 0, over: false }, 'left', rnd), false);
});

// ── the page and its gates ────────────────────────────────────────────────────────

const REQ = {
  tracker: ['make me an app that tracks my water intake', {}],
  list: ['packing list for Spain with passport, charger and sun cream', {}],
  timer: ['a plank timer: 1 minute on, 30 seconds rest, 3 rounds', {}],
  calc: ['a fuel cost calculator in miles per gallon', {}],
  counter: ['scoreboard for darts with me and Sam', {}],
  habits: ['habit tracker for walking, reading and no sugar', {}],
  notes: ['notes app for my ideas', {}],
  cards: ['flash cards for my French verbs', { cards: ['être | to be'] }],
  game: ['a game for the kids', {}],
};

test('every kind of app is a page check_html passes with no errors or warnings, and the kit\'s gates pass', () => {
  for (const [shape, [req, extra]] of Object.entries(REQ)) {
    const p = K.planApp(req, extra, `${shape}-x`);
    assert.equal(p.cfg.shape, shape);
    const html = K.renderApp(p.cfg);
    const c = K.checkHtml(html);
    assert.deepEqual([c.errors, c.warnings], [[], []], shape);
    assert.deepEqual(K.runAppGates(p.cfg, html).errors, [], shape);
    assert.ok(html.length < 90_000, `${shape}: ${html.length} bytes`);
    assert.doesNotThrow(() => new Function(K.appScript(shape).script), `${shape}: the script parses`);
  }
});

test('the gates stop a page that claims, carries placeholder words, a second script, an inline handler or options out of range', () => {
  const p = K.planApp('make me an app that tracks my water intake', {}, 'water');
  const html = K.renderApp(p.cfg);
  const g = (cfg, h = K.renderApp(cfg)) => K.runAppGates(cfg, h).errors.join(' | ');
  assert.match(g({ ...p.cfg, title: 'Water with reminders' }), /honesty: the title claims/);
  assert.match(g({ ...p.cfg, tagline: 'Lorem ipsum' }), /placeholder/);
  assert.match(g(p.cfg, html.replace('</body>', '<script>alert(1)</script></body>')), /exactly the kit's script/);
  assert.match(g(p.cfg, html.replace('<main id="app-main">', '<main id="app-main" onclick="x()">')), /inline event handler/);
  assert.match(g(p.cfg, html.replace('"goal":8', '"goal":9')), /do not match its config/);
  assert.match(g({ ...p.cfg, tracker: { ...p.cfg.tracker, amounts: [1, 2, 3, 4, 5, 6, 7] } }), /up to six quick amounts/);
  assert.match(g({ ...p.cfg, shape: 'timer', timer: { steps: [], rounds: 1 } }), /1–20 steps/);
  // a name that is not an accent, glyph or shape never reaches an object's prototype
  assert.equal(K.colours('__proto__').acc, '#64d2ff');
  assert.match(K.glyphSvg('constructor'), /<polygon/);
  assert.equal(K.appScript('__proto__').script, K.appScript('list').script);
});

test('words cannot break out of the page: markup in the config is data, the script is pinned by its exact SHA-256', () => {
  const p = K.planApp('a shopping list app', { items: ['</script><script>alert(1)</script>', 'Milk'] }, 'shop');
  assert.deepEqual(p.cfg.list.items, ['Milk'], 'markup is not an item');
  const cfg = { ...p.cfg, list: { kind: 'shopping', items: ['a</script><script>alert(1)//', 'Milk'] } };
  const html = K.renderApp(cfg);
  assert.equal((html.match(/<script\b/g) ?? []).length, 2, 'only the config block and the kit script');
  assert.ok(!html.includes('</script><script>alert'));
  const { script, hash } = K.appScript('list');
  assert.equal(hash, `'sha256-${createHash('sha256').update(script, 'utf8').digest('base64')}'`);
  for (const s of ['', 'abc', 'é'.repeat(100), 'x'.repeat(1000)]) assert.equal(K.base64(K.sha256(new TextEncoder().encode(s))), createHash('sha256').update(s, 'utf8').digest('base64'));
  assert.match(K.appCsp('list'), new RegExp(`script-src ${hash.replace(/[+/]/g, '\\$&')};`));
  assert.ok(!/unsafe-inline'[^;]*;[^;]*connect/.test(K.appCsp('list').split('style-src')[0]), 'no inline scripts beyond the hash');
});

test('the Home Screen icon is a real 512 px PNG of the glyph in the accent on graphite', async () => {
  const png = await K.encodePng(K.iconPixels('drop', 'cyan', 512), 512, 512);
  const buf = Buffer.from(png);
  assert.deepEqual([...buf.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(buf.readUInt32BE(16), 512);
  assert.equal(buf.readUInt32BE(20), 512);
  const len = buf.readUInt32BE(33);
  assert.equal(buf.toString('latin1', 37, 41), 'IDAT');
  const raw = inflateSync(buf.subarray(41, 41 + len));
  assert.equal(raw.length, 512 * (512 * 3 + 1));
  // undo the row filters, then look at the middle of the drop and a corner
  const px = new Uint8Array(512 * 512 * 3);
  for (let y = 0; y < 512; y++) {
    const f = raw[y * 1537];
    for (let x = 0; x < 1536; x++) {
      const a = x >= 3 ? px[y * 1536 + x - 3] : 0;
      const b = y ? px[(y - 1) * 1536 + x] : 0;
      const c = y && x >= 3 ? px[(y - 1) * 1536 + x - 3] : 0;
      const p = a + b - c;
      const pr = Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a : Math.abs(p - b) <= Math.abs(p - c) ? b : c;
      px[y * 1536 + x] = (raw[y * 1537 + 1 + x] + [0, a, b, (a + b) >> 1, pr][f]) & 255;
    }
  }
  const at2 = (x, y) => [...px.subarray((y * 512 + x) * 3, (y * 512 + x) * 3 + 3)];
  assert.deepEqual(at2(256, 300), [0x64, 0xd2, 0xff], 'inside the drop: the accent');
  assert.ok(at2(2, 2).every((v) => v < 40), 'the corner: graphite');
  assert.ok(buf.length < 60_000, `${buf.length} bytes`);
});

// ── serving: the app page, its manifest, icon and service worker ───────────────────

class MemStorage {
  m = new Map();
  fail = 0;
  async get(k) { return this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
  async put(k, v) {
    if (this.fail && k.startsWith('site:') && !k.startsWith('site:index')) { this.fail--; throw new Error('storage blip'); }
    this.m.set(k, structuredClone(v));
  }
  async delete(k) { return this.m.delete(k); }
  async list({ prefix = '' } = {}) { return new Map([...this.m].filter(([k]) => k.startsWith(prefix))); }
}
const ctxOf = (storage = new MemStorage()) => {
  const shown = [];
  return { env: { PUBLIC_ORIGIN: 'https://ghosty.example' }, storage, origin: 'https://ghosty.example', emit: (e) => shown.push(e), progress: () => undefined, shown };
};
const tool = () => K.siteTools.find((t) => t.name === 'build_app');

test('an app is served as its own page with a strict policy; /page gives its service worker, manifest and icon; a plain site is still framed', async () => {
  const ctx = ctxOf();
  const ap = await tool().approval({ request: 'make me an app that tracks my water intake', shape: 'tracker', title: 'Water' }, ctx);
  await tool().run(ap.args, ctx);
  const site = await K.siteStore(ctx.env, ctx.storage).get('water');
  assert.ok(site.app && site.app.icon, 'kept with its config and icon');
  // even with something else in the stored html, the page is drawn from the config by the running kit
  site.html = '<!doctype html><script>alert(1)</script>';
  const page = K.siteResponse(site);
  const csp = page.headers.get('content-security-policy');
  const body = await page.text();
  assert.ok(!body.includes('alert(1)'));
  assert.ok(!/<iframe/.test(body), 'not framed');
  assert.equal(csp, K.appCsp('tracker'));
  for (const d of ["connect-src 'none'", "frame-ancestors 'none'", "form-action 'none'", "base-uri 'none'", "manifest-src 'self'", "worker-src 'self'", "object-src 'none'"]) assert.ok(csp.includes(d), d);
  assert.ok(!/script-src[^;]*unsafe/.test(csp), 'no unsafe script sources');
  assert.equal(page.headers.get('cross-origin-opener-policy'), 'same-origin');
  assert.match(body, /<link rel="manifest" href="\/s\/water\/page">/);
  assert.match(body, /<link rel="apple-touch-icon" href="\/s\/water\/page">/);
  assert.match(body, /<meta name="apple-mobile-web-app-capable" content="yes">/);
  const man = K.siteFrameResponse(site, 'manifest');
  assert.equal(man.headers.get('content-type'), 'application/manifest+json; charset=utf-8');
  const m = await man.json();
  assert.deepEqual([m.name, m.short_name, m.start_url, m.scope, m.id, m.display], ['Water', 'Water', '/s/water/', '/s/water/', '/s/water/', 'standalone']);
  assert.deepEqual(m.icons.map((i) => [i.src, i.sizes, i.type, i.purpose]), [['/s/water/page', '512x512', 'image/png', 'any'], ['/s/water/page', '512x512', 'image/png', 'maskable']]);
  const sw = K.siteFrameResponse(site, 'serviceworker');
  assert.match(sw.headers.get('content-type'), /javascript/);
  const swText = await sw.text();
  assert.equal(swText, K.APP_SW);
  assert.match(swText, /req\.mode !== 'navigate'/, 'it keeps only the page');
  assert.match(swText, /status === 404[\s\S]*unregister/, 'a taken-down app forgets itself');
  for (const dest of ['image', '', null]) {
    const icon = K.siteFrameResponse(site, dest);
    assert.equal(icon.headers.get('content-type'), 'image/png', String(dest));
    assert.equal(icon.headers.get('vary'), 'Sec-Fetch-Dest');
    assert.deepEqual([...new Uint8Array(await icon.arrayBuffer()).subarray(0, 4)], [137, 80, 78, 71]);
  }
  const doc = K.siteFrameResponse(site, 'document');
  assert.equal(doc.status, 302);
  assert.equal(doc.headers.get('location'), '/s/water/');
  // a page published with publish_site is unchanged: the bar page framing its sandboxed copy
  const plain = { name: 'acme', title: 'Acme', html: '<!doctype html><html><body>x</body></html>', source: '', at: 1 };
  assert.match(await K.siteResponse(plain).text(), /<iframe src="\/s\/acme\/page"[^>]*sandbox="allow-scripts/);
  assert.equal(K.siteFrameResponse(plain, 'iframe').headers.get('content-security-policy'), K.PAGE_CSP);
  assert.equal(K.siteFrameResponse(plain, 'manifest').status, 302, 'a plain site has no manifest');
});

test('through the Worker itself (KV bound): /s/<name>, /s/<name>/ and /s/<name>/page by Sec-Fetch-Dest', async () => {
  const kv = new Map();
  const env = { SITES: { get: async (k, t) => (kv.has(k) ? (t === 'json' ? JSON.parse(kv.get(k)) : kv.get(k)) : null), put: async (k, v) => void kv.set(k, v), delete: async (k) => void kv.delete(k) } };
  const ctx = { ...ctxOf(), env };
  const ap = await tool().approval({ request: 'a tip calculator for the group', shape: 'calc' }, ctx);
  await tool().run(ap.args, ctx);
  const name = ap.args.link_name;
  const get = (path, dest) => K.worker.fetch(new Request(`https://ghosty.example${path}`, { headers: dest ? { 'sec-fetch-dest': dest } : {} }), env, { waitUntil() {} });
  for (const p of [`/s/${name}`, `/s/${name}/`]) {
    const r = await get(p, 'document');
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-security-policy'), /^default-src 'none'; script-src 'sha256-/);
  }
  assert.equal((await get(`/s/${name}/page`, 'manifest')).headers.get('content-type'), 'application/manifest+json; charset=utf-8');
  assert.match((await get(`/s/${name}/page`, 'serviceworker')).headers.get('content-type'), /javascript/);
  assert.equal((await get(`/s/${name}/page`, 'image')).headers.get('content-type'), 'image/png');
});

// ── build_app ─────────────────────────────────────────────────────────────────────

test('build_app asks once, in plain words: what it does, what it saves, what it cannot do, and the questions with the answers it will use', async () => {
  const ctx = ctxOf();
  const t = tool();
  assert.equal(t.risk, 'confirm');
  assert.ok(t.description.length <= 1000);
  const ap = await t.approval({ request: 'water tracker with reminders', shape: 'tracker', title: 'Water' }, ctx);
  assert.equal(ap.args.link_name, 'water');
  assert.match(ap.reason, /^Make the mini-app "Water" and publish it at https:\/\/ghosty\.example\/s\/water\/\?/);
  assert.match(ap.reason, /WHAT IT DOES: Adds up glasses towards 8 glasses a day/);
  assert.match(ap.reason, /WHAT IT SAVES: Your entries, on this phone only — nothing is sent anywhere/);
  assert.match(ap.reason, /not an App Store app: no notifications/);
  assert.match(ap.reason, /can't send reminders or notifications/);
  assert.match(ap.reason, /One question \(I use the answer in brackets unless you tell me otherwise\): What is your daily goal\? \(8 glasses\)/);
  // essential and impossible: refused before the owner is asked anything
  await assert.rejects(t.approval({ request: 'make me a tracker' }, ctx), /ask the owner first.*What do you want to track each day\?/);
  await assert.rejects(t.approval({ request: 'an app that shows live train times from Walsall', shape: 'list' }, ctx), /not built — That needs live data/);
  // three names a link cannot spell get three links
  const names = await Promise.all(['خلاصة', '记事本', '🎯🎯'].map((title) => K.AB.appNameFor({ request: 'notes app', title }, title, ctx)));
  assert.equal(new Set(names.map((n) => n.name)).size, 3);
});

test('build_app runs its steps on the kit, publishes, shows the link card and reports with the install steps; UNDO takes it down', async () => {
  const ctx = ctxOf();
  const t = tool();
  const ap = await t.approval({ request: 'packing list for Spain with passport, charger and sun cream', shape: 'list', title: 'Packing for Spain' }, ctx);
  const report = await t.run(ap.args, ctx);
  assert.match(report, /^Published the mini-app "Packing for Spain" — live at https:\/\/ghosty\.example\/s\/packing-for-spain\/ \./);
  assert.match(report, /INSTALL: on the iPhone, open the link in Safari, tap Share, then Add to Home Screen/);
  assert.match(report, /WHAT IT DOES: A packing list/);
  assert.match(report, /no notifications, and nothing runs while it is closed/);
  assert.match(report, /UNDO: say "take down packing-for-spain"/);
  assert.deepEqual(ctx.shown.map((e) => [e.name, e.args.url]), [['show_link', 'https://ghosty.example/s/packing-for-spain/']]);
  const job = await K.AB.loadAppJob(ctx, 'packing-for-spain');
  assert.equal(job.done, true);
  assert.deepEqual(job.cfg.list.items, ['Passport', 'Charger', 'Sun cream']);
  const list = await K.siteTools.find((x) => x.name === 'list_sites').run({}, ctx);
  assert.match(list, /\/s\/packing-for-spain\/ — "Packing for Spain" \(mini-app\)/);
  // another app wanting the same link gets the next number; the same app again replaces itself
  const other = await t.approval({ request: 'a shopping list app', shape: 'list', title: 'Packing for Spain!' }, ctx);
  assert.equal(other.args.link_name, 'packing-for-spain-2');
  const again = await t.approval(ap.args, ctx);
  assert.match(again.reason, /This replaces "Packing for Spain"/);
  const un = K.siteTools.find((x) => x.name === 'unpublish_site');
  assert.match(await un.run({ name: 'packing-for-spain' }, ctx), /Taken down/);
  assert.equal(await K.siteStore(ctx.env, ctx.storage).get('packing-for-spain'), undefined);
});

test('build_app resumes: a publish cut short carries on from where it stopped, without redoing the earlier steps', async () => {
  const storage = new MemStorage();
  const ctx = ctxOf(storage);
  const t = tool();
  const ap = await t.approval({ request: 'a plank timer: 1 minute on, 30 seconds rest, 3 rounds', shape: 'timer', title: 'Plank timer' }, ctx);
  storage.fail = 1;
  await assert.rejects(t.run(ap.args, ctx), /did not finish .*call build_app again with the same request and link_name "plank-timer": it carries on from here/);
  const half = await K.AB.loadAppJob(ctx, 'plank-timer');
  assert.equal(half.step, 3, 'brief, build and checks are done');
  const icon = half.icon;
  const report = await t.run(ap.args, ctx);
  assert.match(report, /live at https:\/\/ghosty\.example\/s\/plank-timer\//);
  const site = await K.siteStore(ctx.env, storage).get('plank-timer');
  assert.equal(site.app.icon, icon, 'the icon drawn before the blip was kept');
  assert.deepEqual(site.app.config.timer, { steps: [{ name: 'Plank', secs: 60 }, { name: 'Rest', secs: 30 }], rounds: 3 });
});

// ── build_app as a Workshop project (projects.ts, kind 'app') ─────────────────────

const MARK = { todo: '.', doing: '>', done: '+', failed: 'x' };
/** What the PROJECTS panel would have shown at every save of a project record. */
const watchProjects = (storage) => {
  const seen = [];
  const put = storage.put.bind(storage);
  storage.put = async (k, v) => {
    await put(k, v);
    if (/^project:[a-z0-9]{10}$/.test(k)) seen.push(`${v.steps.map((s) => MARK[s.status]).join('')} ${v.status}`);
  };
  return seen;
};
const projectDeps = (ctx, notes = []) => ({ env: ctx.env, storage: ctx.storage, tctx: { origin: ctx.origin }, library: { available: false }, notify: async (n) => notes.push(n), busy: { get: () => false, set: () => undefined }, tools: [], system: async () => '', complete: async () => { throw new Error('no model in an app build'); } });
const withAlarm = (storage) => Object.assign(storage, { getAlarm: async () => null, setAlarm: async () => undefined });

test('build_app is a Workshop project like a website: its five steps move on one by one, and it ends with the report and the link', async () => {
  const storage = new MemStorage();
  const seen = watchProjects(storage);
  const ctx = ctxOf(storage);
  const t = tool();
  const ap = await t.approval({ request: 'a tip calculator for the group', shape: 'calc', calc: 'tip', title: 'Tip & split' }, ctx);
  const report = await t.run(ap.args, ctx);
  // the chat is as it was: the model's report and the link card
  assert.match(report, /^Published the mini-app "Tip & split" — live at https:\/\/ghosty\.example\/s\/tip-split\/ \./);
  assert.deepEqual(ctx.shown.map((e) => e.name), ['show_link']);
  // the project, saved at every step: the step running, then done, then the next
  assert.deepEqual(seen, ['..... active', '>.... active', '+.... active', '+>... active', '++... active', '++>.. active', '+++.. active', '+++>. active', '++++. active', '++++> active', '+++++ done']);
  const list = await K.PJ.listProjects(ctx);
  assert.equal(list.length, 1);
  const p = list[0];
  assert.equal(p.kind, 'app');
  assert.equal(p.title, 'App: Tip & split');
  assert.equal(p.status, 'done');
  assert.deepEqual(p.steps.map((s) => s.title), ['Brief and plan', 'Build and icon', 'Check', 'Publish', 'Report']);
  assert.equal(p.link, 'https://ghosty.example/s/tip-split/');
  assert.match(p.steps[0].result, /^"Tip & split": /);
  assert.match(p.steps[2].result, /^Page check clean; kit gates \d+\/100/);
  assert.equal(p.steps[3].result, 'Live at https://ghosty.example/s/tip-split/');
  const r = p.steps[4].result;
  assert.match(r, /^"Tip & split" is live at https:\/\/ghosty\.example\/s\/tip-split\/\n/);
  assert.match(r, /\nINSTALL: on the iPhone, open the link in Safari, tap Share, then Add to Home Screen/);
  assert.match(r, /\nUNDO: say "take down tip-split"/);
  assert.doesNotMatch(r, /Give the owner/, 'the Workshop report is for the owner, not the model');
  // the Workshop's route lists it; no alarm job was set for it (its steps ran in the call)
  const res = await K.PJ.projectsRoute(new Request('https://x/projects'), '/projects', 'GET', projectDeps(ctx));
  assert.equal((await res.json()).projects[0].id, p.id);
  assert.equal(storage.m.get('jobs'), undefined);
  // the same app asked for again is a new build: a new project
  await t.run(ap.args, ctx);
  assert.equal((await K.PJ.listProjects(ctx)).length, 2);
});

test('a mini-app build that failed or was cut short carries on from its record when tapped in the Workshop, at the right step', async () => {
  const storage = withAlarm(new MemStorage());
  const ctx = ctxOf(storage);
  const t = tool();
  const notes = [];
  const deps = projectDeps(ctx, notes);
  // 1. failed: the publish hit a storage blip — paused at step 4 with the reason; RESUME, then the alarm, finish it
  const ap = await t.approval({ request: 'scoreboard for darts with me and Sam', shape: 'counter', title: 'Darts', items: ['Me', 'Sam'] }, ctx);
  storage.fail = 1;
  await assert.rejects(t.run(ap.args, ctx), /did not finish/);
  let [p] = await K.PJ.listProjects(ctx);
  assert.equal(p.status, 'paused');
  assert.deepEqual(p.steps.map((s) => s.status), ['done', 'done', 'done', 'failed', 'todo']);
  assert.equal(p.note, 'step 4 "Publish" stopped: publishing "Darts" did not finish (storage blip). RESUME carries on from here.');
  const icon = (await K.AB.loadAppJob(ctx, 'darts')).icon;
  const seen = watchProjects(storage);
  const resumed = await (await K.PJ.projectsRoute(new Request('https://x'), `/projects/${p.id}/resume`, 'POST', deps)).json();
  assert.equal(resumed.project.status, 'active');
  const job = storage.m.get('jobs').find((j) => j.kind === 'project' && j.text === p.id);
  assert.ok(job, 'RESUME set the alarm for it');
  const r = await K.PJ.runProjectStep(deps, job);
  assert.equal(r.did, 'done');
  assert.deepEqual(seen, ['+++.. active', '+++>. active', '++++. active', '++++> active', '+++++ done'], 'it carried on from step 4: steps 1–3 were not run again');
  assert.equal(r.project.link, 'https://ghosty.example/s/darts/');
  assert.equal((await K.siteStore(ctx.env, storage).get('darts')).app.icon, icon, 'the icon drawn before the blip was kept');
  assert.equal(notes.length, 1);
  assert.equal(notes[0].title, 'App: Darts · done');
  assert.match(notes[0].text, /^"Darts" is live at https:\/\/ghosty\.example\/s\/darts\/\n[\s\S]*INSTALL:[\s\S]*UNDO:/);
  assert.equal(storage.m.get('jobs').length, 0, 'nothing left to run');
  // 2. cut short: the call never came back while publishing — the project is left on step 4; RUN NEXT NOW finishes it
  const ap2 = await t.approval({ request: 'notes app for my ideas', shape: 'notes', title: 'Ideas' }, ctx);
  let release;
  const put = storage.put;
  storage.put = (k, v) => (k === 'site:ideas' && !release ? new Promise((ok) => (release = () => ok(put.call(storage, k, v)))) : put.call(storage, k, v));
  void t.run(ap2.args, ctx);
  for (let i = 0; i < 200 && !release; i++) await new Promise((ok) => setTimeout(ok, 10));
  assert.ok(release, 'the build reached the publish');
  storage.put = put;
  [p] = (await K.PJ.listProjects(ctx)).filter((x) => x.title === 'App: Ideas');
  assert.deepEqual([p.status, p.steps.map((s) => s.status)], ['active', ['done', 'done', 'done', 'doing', 'todo']]);
  const ran = await (await K.PJ.projectsRoute(new Request('https://x'), `/projects/${p.id}/run`, 'POST', deps)).json();
  assert.equal(ran.did, 'done');
  assert.deepEqual(ran.project.steps.map((s) => s.status), ['done', 'done', 'done', 'done', 'done']);
  assert.match(ran.project.steps[4].result, /^"Ideas" is live at https:\/\/ghosty\.example\/s\/ideas\//);
  assert.equal((await K.siteStore(ctx.env, storage).get('ideas')).title, 'Ideas');
});
