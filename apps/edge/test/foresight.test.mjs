// FORESIGHT (OWNER-ISSUES 61a, 74(3), 75(b); foresight.ts, packages/shared/src/foresight.ts): a ledger of predictions about
// public things, scored only by what a public feed later says or by the owner's own word.
//  - the rules, pure: the rain from the hourly chance, a departure and the commute from their own past, the scoring, the
//    record per kind ("right 78% of the time about trains (14 of 18)"), today's lines and yesterday's proof line;
//  - his words with no model (positives and negatives), and never a person: the subject check;
//  - the hourly job on a fake clock: the morning's predictions made once after six, each scored at its time, samples kept,
//    the first one to come true told once, a feed that fails leaves it open and then "could not be told", 8 reads a tick;
//  - through the real brain: the routes, the standing job.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({ entryPoints: [at('../src/foresight.ts'), at('../src/tools/foresight.ts'), at('../../../packages/shared/src/foresight.ts')], bundle: true, format: 'esm', platform: 'neutral', external: ['cloudflare:sockets'], outdir: at('./.build/foresight'), outbase: at('../../..'), outExtension: { '.js': '.mjs' }, logLevel: 'warning' });
const F = await import('./.build/foresight/apps/edge/src/foresight.mjs');
const FT = await import('./.build/foresight/apps/edge/src/tools/foresight.mjs');
const S = await import('./.build/foresight/packages/shared/src/foresight.mjs');
const X = await import('./.build/integrations/transitous.mjs');
const FIX = JSON.parse(readFileSync(new URL('./transitous.fixture.json', import.meta.url), 'utf8'));

const TZ = 'Europe/London';
const MIN = 60_000;
const HOUR = 60 * MIN;
// Monday 2 November 2026 (GMT: the clocks went back on 25 October)
const day = (h, mi = 0, d = 2) => Date.UTC(2026, 10, d, h, mi);
const HOME = { id: 'home', label: 'Home', query: 'B13 8PX', address: 'B13 8PX, Moseley, Birmingham', lat: 52.443186, lon: -1.892525, at: 1 };
const WORK = { id: 'work', label: 'Work', query: 'WV1 1LY', address: 'Wolverhampton', lat: 52.5862, lon: -2.1288, at: 1 };

class Mem {
  m = new Map();
  async get(k) { return Array.isArray(k) ? new Map(k.filter((x) => this.m.has(x)).map((x) => [x, structuredClone(this.m.get(x))])) : this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
  async put(k, v) { if (typeof k === 'object') for (const [a, b] of Object.entries(k)) this.m.set(a, structuredClone(b)); else this.m.set(k, structuredClone(v)); }
  async delete(k) { return Array.isArray(k) ? k.filter((x) => this.m.delete(x)).length : this.m.delete(k); }
  async list({ prefix = '' } = {}) { return new Map([...this.m].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, structuredClone(v)])); }
  async setAlarm() {}
  async getAlarm() { return null; }
}

/** Hourly values (the end of each hour) from 00:00 yesterday for three days: chance and amount per hour by a rule. */
function hourly(rule, from = day(0, 0, 1)) {
  const time = Array.from({ length: 72 }, (_, i) => from + (i + 1) * HOUR);
  return { time, prob: time.map((t) => rule(t).p), mm: time.map((t) => rule(t).mm) };
}

/** The real recorded rail journey (transitous.fixture.json), moved so its train leaves New Street at `t`. */
function railJourney(t) {
  const j = X.compactItinerary(FIX.rail.itineraries[0], '1', { name: 'Home', lat: HOME.lat, lon: HOME.lon }, { name: 'Work', lat: WORK.lat, lon: WORK.lon });
  const ride = j.legs.find((l) => l.mode === 'rail');
  const shift = t - Date.parse(ride.scheduledStart);
  const move = (s) => (s ? new Date(Date.parse(s) + shift).toISOString() : s);
  return { ...j, start: move(j.start), end: move(j.end), legs: j.legs.map((l) => ({ ...l, start: move(l.start), end: move(l.end), scheduledStart: move(l.scheduledStart), scheduledEnd: move(l.scheduledEnd) })) };
}
const departure = (scheduled, lateS, o = {}) => ({ line: 'LNR', mode: 'rail', kind: 'REGIONAL_RAIL', color: '', headsign: 'Liverpool Lime Street', agency: 'West Midlands Trains', stop: { name: 'Birmingham New Street', lat: 52.4778, lon: -1.9002 }, track: '3M', time: new Date(scheduled + lateS * 1000).toISOString(), scheduled: new Date(scheduled).toISOString(), realTime: true, cancelled: false, ...o });

/** A brain's foresight on a fake clock, with his places, the TomTom key and stand-in feeds (each call written down). */
function kit({ places = [HOME, WORK], key = 'tt-key', feeds = {} } = {}) {
  const storage = new Mem();
  storage.m.set('places', places);
  storage.m.set('owner:ctx', { tz: TZ, name: 'Aqis' });
  const notes = [];
  const calls = [];
  let now = day(5, 30);
  const wrap = (name, fn) => async (...a) => {
    calls.push({ name, at: now, signal: a[a.length - 1] });
    return fn(...a);
  };
  const d = {
    storage,
    vault: { get: async (k) => (k === 'tomtom' ? key : null) },
    notify: async (item) => void notes.push(item),
    now: () => now,
    feeds: Object.fromEntries(Object.entries(feeds).map(([k, f]) => [k, wrap(k, f)])),
  };
  return { d, storage, notes, calls, at: (t) => (now = t), get now() { return now; }, ledger: () => storage.m.get(S.FORESIGHT_KEY) };
}

// ---------------------------------------------------------------- the rules

test('rain: 60% or more → "rain by" the first such hour; 25% or less → none; between → no prediction', () => {
  const win = [day(12), day(18)];
  const wet = S.predictRain(hourly((t) => ({ p: t === day(15) ? 70 : t === day(16) ? 80 : 20, mm: 0 })), win, TZ);
  assert.deepEqual(wet, { expect: 'rain by 15:00', confidence: 0.8 });
  const dry = S.predictRain(hourly(() => ({ p: 10, mm: 0 })), win, TZ);
  assert.deepEqual(dry, { expect: 'no rain this afternoon', confidence: 0.9 });
  assert.equal(S.predictRain(hourly(() => ({ p: 40, mm: 0 })), win, TZ), null, 'a 40% afternoon is not called either way');
  assert.equal(S.predictRain(hourly((t) => ({ p: t > day(18) ? 99 : 5, mm: 0 })), win, TZ).expect, 'no rain this afternoon', 'only the window counts');
  assert.equal(S.predictRain({ time: [], prob: [], mm: [] }, win, TZ), null);
  // scored: 0.2 mm or more in the window is rain
  const p = { kind: 'rain', expect: 'rain by 15:00', ref: { win } };
  const rained = S.scoreRain(p, hourly((t) => ({ p: 0, mm: t === day(14) ? 1.1 : t === day(15) ? 0.3 : 0 })), day(18, 30));
  assert.deepEqual(rained, { at: day(18, 30), actual: 'rain (1.4 mm)', right: true, how: 'feed', value: 1.4 });
  const stayedDry = S.scoreRain(p, hourly(() => ({ p: 0, mm: 0.1 / 6 })), day(18, 30));
  assert.equal(stayedDry.right, false);
  assert.match(stayedDry.actual, /^dry \(0\.1 mm\)$/);
  assert.equal(S.scoreRain({ ...p, expect: 'no rain this afternoon' }, hourly(() => ({ p: 0, mm: 0 })), 1).right, true);
  assert.equal(S.scoreRain(p, { time: [], prob: [], mm: [] }, 1), null, 'no data for the window: not scored');
});

test('a departure from its own past (first week on time at 0.6, then late when most were 3 min or more), scored by the sign', () => {
  assert.deepEqual(S.predictDeparture([]), { expect: 'on time', confidence: 0.6 });
  assert.deepEqual(S.predictDeparture([400, 300, 200]), { expect: 'on time', confidence: 0.6 }, 'fewer than five: still the first week');
  assert.deepEqual(S.predictDeparture([300, 400, 200, 0, 10]), { expect: 'late by 3 min or more', confidence: 0.6 });
  assert.deepEqual(S.predictDeparture([0, 0, 0, 0, 200]), { expect: 'on time', confidence: 0.8 });
  assert.deepEqual(S.predictDeparture(Array(10).fill(600)), { expect: 'late by 3 min or more', confidence: 0.9 }, 'kept to 0.9');
  const late = { kind: 'departure', subject: 'the 08:12 train from Birmingham New Street (West Midlands Trains)', expect: 'late by 3 min or more' };
  assert.deepEqual(S.scoreDeparture(late, { delay: 360 }, 5), { at: 5, actual: '6 minutes late', right: true, how: 'feed', value: 360 });
  assert.equal(S.scoreDeparture(late, { delay: 120 }, 5).right, false, 'two minutes is not late');
  assert.equal(S.scoreDeparture({ ...late, expect: 'on time' }, { delay: 30 }, 5).actual, 'on time');
  assert.equal(S.scoreDeparture({ ...late, expect: 'on time' }, { delay: 420 }, 5).right, false);
  assert.deepEqual(S.scoreDeparture(late, { delay: 0, cancelled: true }, 5), { at: 5, actual: 'cancelled', right: true, how: 'feed' }, 'cancelled counts as late');
  assert.deepEqual(S.scoreDeparture(late, null, 5), { at: 5, actual: 'the feed had no answer', right: null, how: 'feed' });
  // the stop's list: the same line at the same minute; no live time says nothing
  const t = day(8, 12);
  assert.deepEqual(F.matchDeparture([departure(t + 60 * MIN, 0), departure(t, 360)], 'LNR', t), { delay: 360, cancelled: false });
  assert.equal(F.matchDeparture([departure(t, 0, { realTime: false })], 'LNR', t), null);
  assert.equal(F.matchDeparture([departure(t, 0, { line: 'XC' })], 'LNR', t), null);
  assert.deepEqual(F.matchDeparture([departure(t, 0, { cancelled: true, realTime: false })], 'LNR', t), { delay: 0, cancelled: true });
});

test('the commute from its own past: the median of the last ten, the confidence by their spread; right within 20% or 5 min', () => {
  assert.equal(S.predictCommute([30, 31]), null, 'fewer than three: nothing yet');
  assert.deepEqual(S.predictCommute([30, 32, 34]), { expect: 'about 32 minutes', confidence: 0.78, minutes: 32 });
  assert.equal(S.predictCommute([20, 60, 21, 22]).confidence, 0.55, 'a wide spread is said with less confidence');
  assert.equal(S.predictCommute([...Array(10).fill(90), ...Array(6).fill(30)]).minutes, 30, 'the last ten (all sixteen would give 90)');
  const p = { kind: 'commute', expect: 'about 34 minutes', ref: { minutes: 34 } };
  assert.deepEqual(S.scoreCommute(p, 31, 9), { at: 9, actual: '31 minutes', right: true, how: 'feed', value: 31 });
  assert.equal(S.scoreCommute(p, 52, 9).right, false);
  assert.equal(S.scoreCommute({ ...p, ref: { minutes: 60 } }, 71, 9).right, true, '20% of an hour is twelve minutes');
});

const scored = (kind, right, at, extra = {}) => ({ id: `${kind}${at}${right}`, at, kind, subject: kind === 'departure' ? 'the 08:12 train from Birmingham New Street (West Midlands Trains)' : 'rain at Home 12:00–18:00', expect: kind === 'departure' ? 'late by 3 min or more' : 'rain by 15:00', confidence: 0.7, by: at, outcome: { at, actual: right ? '6 minutes late' : 'on time', right, how: 'feed', value: right ? 360 : 0 }, ...extra });

test('the record: "right 78% of the time about trains (14 of 18)", "only 2 so far", the last 30 days, never a "could not be told"', () => {
  const now = day(12);
  const items = [...Array.from({ length: 14 }, (_, i) => scored('departure', true, now - i * HOUR)), ...Array.from({ length: 4 }, (_, i) => scored('departure', false, now - (20 + i) * HOUR)), scored('rain', true, now - 2 * HOUR), scored('rain', false, now - 3 * HOUR)];
  items.push({ ...scored('departure', true, now - 4 * HOUR), id: 'x', outcome: { at: now, actual: 'the feed had no answer', right: null, how: 'feed' } });
  items.push({ ...scored('departure', true, now - 40 * 24 * HOUR), id: 'old' });
  const dep = S.calibration(items, 'departure', now);
  assert.deepEqual(dep, { n: 18, right: 14, share: 14 / 18 });
  assert.equal(S.calibrationLine('departure', dep, items), 'right 78% of the time about trains (14 of 18)');
  assert.equal(S.calibrationLine('rain', S.calibration(items, 'rain', now)), "I've only scored 2 so far about rain");
  assert.equal(S.calibrationLine('commute', S.calibration(items, 'commute', now)), 'nothing scored yet about the commute');
  assert.equal(S.calibration(items, 'all', now).n, 20);
  assert.equal(S.scoreLine(items, now), 'I keep score: right 78% of the time about trains.');
  assert.equal(S.kindWord('departure', [{ kind: 'departure', subject: 'the 08:16 bus 50 from Corporation St' }]), 'buses');
});

test("today's lines and yesterday's proof: \"I expect rain by 15:00 (70%)\", \"Yesterday: right 2 of 3 — I expected the 08:12 late; it was, by 6 minutes.\"", () => {
  const now = day(9);
  const open = [
    { id: 'r', at: day(6), kind: 'rain', subject: 'rain at Home 12:00–18:00', expect: 'rain by 15:00', confidence: 0.7, by: day(18, 30) },
    { id: 'd', at: day(6), kind: 'departure', subject: 'the 08:12 train from Birmingham New Street (West Midlands Trains)', expect: 'on time', confidence: 0.6, by: day(8, 15) },
    { id: 'c', at: day(6), kind: 'commute', subject: 'the commute Home → Work at 08:00', expect: 'about 34 minutes', confidence: 0.8, by: day(8) },
    { id: 't', at: day(6), kind: 'rain', subject: 'rain at Home 12:00–18:00', expect: 'rain by 15:00', confidence: 0.7, by: day(18, 30, 3) },
  ];
  assert.deepEqual(S.expectLines(open, now, TZ), ['I expect the commute to take about 34 minutes (80%)', 'I expect the 08:12 on time (60%)', 'I expect rain by 15:00 (70%)']);
  assert.deepEqual(open.slice(0, 3).map(S.briefLine), ['Likely: rain by 15:00', 'I think: the 08:12 on time', 'Likely: the commute to take about 34 minutes']);
  const y = (h) => day(h, 0, 1);
  const items = [
    { ...scored('departure', true, y(8)), confidence: 0.7 },
    { id: 'rw', at: y(6), kind: 'rain', subject: 'rain at Home 12:00–18:00', expect: 'rain by 15:00', confidence: 0.75, by: y(18), outcome: { at: y(18), actual: 'dry (0.0 mm)', right: false, how: 'feed', value: 0 } },
    { id: 'cr', at: y(6), kind: 'commute', subject: 'the commute Home → Work at 08:00', expect: 'about 34 minutes', confidence: 0.6, by: y(8), outcome: { at: y(8), actual: '31 minutes', right: true, how: 'feed', value: 31 } },
    { id: 'today', at: day(6), kind: 'rain', subject: 'rain', expect: 'rain by 15:00', confidence: 0.9, by: day(8), outcome: { at: day(8), actual: 'rain (1.0 mm)', right: true, how: 'feed', value: 1 } },
  ];
  assert.equal(S.yesterdayLine(items, now, TZ), 'Yesterday: right 2 of 3 — I expected the 08:12 late; it was, by 6 minutes.');
  assert.equal(S.yesterdayLine([items[1]], now, TZ), 'Yesterday: right 0 of 1 — I expected rain by 15:00; it stayed dry.', 'the wrong one, honestly');
  assert.equal(S.yesterdayLine([items[3]], now, TZ), '', 'nothing due yesterday');
  assert.equal(S.proofLine(items[2]), 'I expected the commute to take about 34 minutes; it took 31 minutes.');
  assert.equal(S.firstTrueText(items[0]), 'My first prediction came true: I expected the 08:12 late; it was, by 6 minutes. I keep score now: SYSTEM → Report card → FORESIGHT.');
  assert.equal(S.dayBefore('2026-11-01'), '2026-10-31');
  assert.equal(S.dayBefore('2026-03-01'), '2026-02-28');
});

test('his words, no model: what do you expect / how often are you right / were you right — and "you were right"', () => {
  for (const t of ['what do you expect today?', 'What do you expect?', 'what are your predictions?', 'Ghosty, any predictions for today?', "what's your forecast for today"]) assert.equal(S.foresightAsked(t), 'today', t);
  for (const t of ['how often are you right?', 'How good are your predictions?', 'how accurate are you', "what's your track record?"]) assert.equal(S.foresightAsked(t), 'score', t);
  for (const t of ['were you right?', 'were you right yesterday?', 'did you get it right?']) assert.equal(S.foresightAsked(t), 'right', t);
  for (const t of ['will you marry me?', 'what do you think will happen with the price of eggs?', 'will it rain tomorrow?', 'how often do buses run?', 'what did you do today?', 'you were right']) assert.equal(S.foresightAsked(t), null, t);
  assert.deepEqual(S.rightSaid('you were right'), { right: true });
  assert.deepEqual(S.rightSaid('You were wrong about the train.'), { right: false, about: 'the train' });
  assert.deepEqual(S.rightSaid('that was right!'), { right: true });
  assert.deepEqual(S.rightSaid('nope, wrong'), { right: false });
  assert.deepEqual(S.rightSaid('yeah you were right'), { right: true });
  assert.deepEqual(S.rightSaid('you called it'), { right: true });
  for (const t of ['right, next', 'right', 'wrong', 'you were right to ask me but can you now do something else for me please', 'is that right?', 'turn right at the lights', 'what was wrong with it?']) assert.equal(S.rightSaid(t), null, t);
  assert.equal(S.notedWords(true), 'Noted: right.');
  assert.equal(S.notedWords(false), "Noted: wrong — I'll remember that.");
  // the same words the phone and Telegram give
  const info = { items: [], expect: [], yesterday: '', calibration: {} };
  assert.equal(S.foresightWords('today', info), S.NONE_YET);
  assert.match(S.NONE_YET, /^I haven't made any predictions yet: I start each morning at six/);
});

test('never about a person: a pronoun, a relation, a name, "someone" or "people" is refused; things and his own plans are not', () => {
  for (const s of ['will he be late', 'will my cousin call me back', "my mum's flight", 'Sam will pass his test', 'will Sam pass his test?', "Haris'll text", 'what will people say', 'will someone buy it', 'will they win the match', 'is my boss going to be in', 'will the neighbours complain', 'will Sarah reply', 'what my mate will say', 'will anyone notice']) assert.ok(S.personProblem(s), s);
  for (const s of ['will it rain on Saturday', 'will the 08:12 be late', 'will I finish my essay by Friday', 'will the price of a PS5 drop at Argos', 'will my train be late', 'will the M6 be busy at 5', 'Bitcoin will drop below 50k', 'will Villa win on Sunday', 'rain at Home tomorrow', 'will the boss fight be hard']) assert.equal(S.personProblem(s), null, s);
  assert.ok(S.personProblem("rain at Nan's"), 'a relation');
  assert.equal(S.personProblem("rain at Nan's tomorrow", ["Nan's"]), null, "his saved place called Nan's is a place");
  assert.equal(S.NOT_PEOPLE, "I don't make predictions about people.");
});

test('the ledger keeps at most 400: the oldest scored go first', () => {
  const items = Array.from({ length: 405 }, (_, i) => ({ id: String(i), at: i, kind: 'rain', subject: '', expect: '', confidence: 0.6, by: i, ...(i % 2 ? { outcome: { at: i, actual: '', right: true, how: 'feed' } } : {}) }));
  const kept = S.prune(items);
  assert.equal(kept.length, 400);
  assert.deepEqual(items.filter((p) => !kept.includes(p)).map((p) => p.id), ['1', '3', '5', '7', '9']);
  const list = {};
  for (let i = 0; i < 35; i++) S.addSample(list, 'k', i);
  assert.equal(list.k.length, 30);
  assert.equal(list.k[0], 5);
});

// ---------------------------------------------------------------- the job, on a fake clock

test('the job: the morning predictions made once after six, each scored at its time, samples kept, the first one true told once', async () => {
  const train = day(8, 12);
  let late = 360;
  const k = kit({
    feeds: {
      hourly: async () => hourly((t) => ({ p: t === day(15) ? 70 : 10, mm: t === day(15) ? 0.6 : 0 })),
      plan: async (_from, _to, time) => [railJourney(time + 12 * MIN)],
      departures: async (_stop, time) => [departure(train - 30 * MIN, 0), departure(train, late), departure(train + 30 * MIN, 0)].filter((x) => Date.parse(x.scheduled) >= time),
      commute: async () => ({ minutes: 31, km: 25, delayMin: 4, live: true, line: '31 min by car now' }),
    },
  });
  // three earlier weekdays' 08:00 drive times: enough to predict the commute
  k.storage.m.set(S.FORESIGHT_KEY, { items: [], samples: { dep: {}, com: { 'home|work|08:00': [33, 34, 35] } }, made: { day: '' } });
  // 05:30: nothing yet; it comes back at six
  assert.equal(await F.foreseeTick(k.d), day(6));
  assert.equal(k.ledger().items.length, 0);
  assert.equal(k.calls.length, 0, 'no reads before six');
  // 06:00: the day's three
  k.at(day(6));
  const wake = await F.foreseeTick(k.d);
  const items = k.ledger().items;
  assert.deepEqual(items.map((p) => [p.kind, p.subject, p.expect, p.confidence]), [
    ['rain', 'rain at Home 12:00–18:00', 'rain by 15:00', 0.7],
    ['commute', 'the commute Home → Work at 08:00', 'about 34 minutes', 0.84],
    ['departure', 'the 08:12 train from Birmingham New Street (West Midlands Trains)', 'on time', 0.6],
  ]);
  assert.equal(items[0].by, day(18, 30));
  assert.equal(items[1].by, day(8));
  assert.equal(items[2].by, train + 3 * MIN);
  assert.deepEqual(items[2].ref, { stopId: 'gb-great-britain_9100BHAMNWS6:sup', line: 'LNR', scheduled: train, key: 'LNR|gb-great-britain_9100BHAMNWS6:sup|08:12|wd' });
  assert.equal(wake, day(7), 'the next hour comes first');
  assert.ok(k.calls.every((c) => c.signal instanceof AbortSignal), 'every read has a time limit');
  assert.deepEqual(k.calls.map((c) => c.name), ['hourly', 'plan']);
  const log = k.storage.m.get('mind:log');
  assert.equal(log.length, 1);
  assert.equal(log[0].text, 'foresaw 3 things for today: the commute to take about 34 minutes; the 08:12 on time; rain by 15:00');
  assert.equal(log[0].kind, 'tool');
  // 07:00: made once — nothing new, nothing read; it comes back at 08:00 for the commute
  k.at(day(7));
  assert.equal(await F.foreseeTick(k.d), day(8));
  assert.equal(k.ledger().items.length, 3);
  assert.equal(k.calls.length, 2);
  // 08:00: the commute's live time scores the morning's prediction (31 against about 34: right) — the first true one, told
  k.at(day(8));
  assert.equal(await F.foreseeTick(k.d), train + 3 * MIN, 'back for the train');
  let L = k.ledger();
  assert.deepEqual(L.items[1].outcome, { at: day(8), actual: '31 minutes', right: true, how: 'feed', value: 31 });
  assert.deepEqual(L.samples.com['home|work|08:00'], [33, 34, 35, 31]);
  assert.equal(L.firstTrue, day(8));
  assert.equal(k.notes.length, 1);
  assert.deepEqual(k.notes[0], { kind: 'task', title: 'A prediction came true', text: 'My first prediction came true: I expected the commute to take about 34 minutes; it took 31 minutes. I keep score now: SYSTEM → Report card → FORESIGHT.' });
  // 08:15: the 08:12 was six minutes late (expected on time: wrong), kept as a sample
  k.at(train + 3 * MIN);
  await F.foreseeTick(k.d);
  L = k.ledger();
  assert.deepEqual(L.items[2].outcome, { at: train + 3 * MIN, actual: '6 minutes late', right: false, how: 'feed', value: 360 });
  assert.deepEqual(L.samples.dep['LNR|gb-great-britain_9100BHAMNWS6:sup|08:12|wd'], [360]);
  // 17:30: the drive back is sampled (no prediction about it)
  k.at(day(17, 30));
  await F.foreseeTick(k.d);
  assert.deepEqual(k.ledger().samples.com['work|home|17:30'], [31]);
  // 18:30: the rain came at three (0.6 mm): right — but the first true one was already told
  k.at(day(18, 30));
  const night = await F.foreseeTick(k.d);
  L = k.ledger();
  assert.equal(L.items[0].outcome.right, true);
  assert.equal(L.items[0].outcome.actual, 'rain (0.6 mm)');
  assert.equal(k.notes.length, 1, 'told once, ever');
  assert.equal(night, day(19, 30));
  // the next morning: made again, once (a dry Tuesday; the commute from four samples; the train, still its first week)
  k.at(day(6, 0, 3));
  late = 0;
  await F.foreseeTick(k.d);
  assert.deepEqual(k.ledger().items.slice(3).map((p) => [p.kind, p.expect]), [['rain', 'no rain this afternoon'], ['commute', 'about 34 minutes'], ['departure', 'on time']]);
  assert.equal(k.ledger().made.day, '2026-11-03');
  await F.foreseeTick(k.d);
  assert.equal(k.ledger().items.length, 6, 'once a day');
});

test('the job: a feed that fails leaves a prediction open, then "could not be told" a day later; never more than 8 reads a tick', async () => {
  let down = true;
  const k = kit({
    places: [HOME],
    feeds: {
      hourly: async () => {
        if (down) throw new TypeError('fetch failed');
        return hourly(() => ({ p: 0, mm: 0 }));
      },
      departures: async () => {
        throw new TypeError('fetch failed');
      },
    },
  });
  // at six with the forecast down: nothing made, tried again next hour
  k.at(day(6));
  await F.foreseeTick(k.d);
  assert.equal(k.ledger().items.length, 0);
  assert.deepEqual(k.ledger().made.done, ['commute', 'departure'], 'no work saved: no commute or departure; the rain waits for the feed');
  down = false;
  k.at(day(7));
  await F.foreseeTick(k.d);
  assert.deepEqual(k.ledger().items.map((p) => p.expect), ['no rain this afternoon']);
  // twelve departures all due at once, the stop's feed down: 8 reads at most, and they stay open
  const L = k.ledger();
  for (let i = 0; i < 12; i++) L.items.push({ id: `d${i}`, at: day(6), kind: 'departure', subject: 'the 07:30 train', expect: 'on time', confidence: 0.6, by: day(7, 30), ref: { stopId: `s${i}`, line: 'LNR', scheduled: day(7, 27) } });
  k.storage.m.set(S.FORESIGHT_KEY, L);
  k.calls.length = 0;
  k.at(day(8));
  await F.foreseeTick(k.d);
  assert.ok(k.calls.length <= 8, `${k.calls.length} reads in one tick`);
  assert.ok(k.ledger().items.filter((p) => p.kind === 'departure').every((p) => !p.outcome), 'a failed read is never a score');
  // a day after their time: kept, could not be told, never counted
  k.at(day(8, 0, 3));
  for (let i = 0; i < 3; i++) await F.foreseeTick(k.d);
  const after = k.ledger().items.filter((p) => p.kind === 'departure');
  assert.ok(after.every((p) => p.outcome?.right === null && p.outcome.actual === 'the feed could not be read'));
  assert.equal(S.calibration(k.ledger().items, 'departure', day(9, 0, 3)).n, 0);
  // the database allowance low: the tick steps aside
  const before = JSON.stringify(k.ledger());
  assert.equal(await F.foreseeTick({ ...k.d, spare: false }), day(8, 0, 3) + HOUR);
  assert.equal(JSON.stringify(k.ledger()), before);
});

test('the job: no TomTom key → no commute; a walk to work → no departure, said plainly; after its hour nothing is made late', async () => {
  const walk = { id: 'walk', start: '', end: '', duration: 900, transfers: 0, legs: [{ mode: 'walk', kind: 'WALK', line: '', from: { name: 'Home', lat: 1, lon: 1 }, to: { name: 'Work', lat: 1, lon: 1 } }], direct: true };
  const k = kit({ key: '', feeds: { hourly: async () => hourly(() => ({ p: 40, mm: 0 })), plan: async () => [walk] } });
  k.storage.m.set(S.FORESIGHT_KEY, { items: [], samples: { dep: {}, com: { 'home|work|08:00': [30, 31, 32] } }, made: { day: '' } });
  k.at(day(6));
  await F.foreseeTick(k.d);
  assert.equal(k.ledger().items.length, 0, 'a 40% afternoon, no key, a walk: nothing to predict');
  assert.deepEqual(k.ledger().made.notes, ['Your way to work has no train, tram or bus, so there is no departure to predict.']);
  const info = await F.foresightInfo(k.d);
  assert.deepEqual(info.notes, ['The commute needs the free TomTom key, SYSTEM → KEYS.', 'Your way to work has no train, tram or bus, so there is no departure to predict.']);
  // a brain that slept through the morning: at 13:00 the rain window has begun and the 08:00 journey has gone — nothing made late
  const late = kit({ feeds: { hourly: async () => hourly(() => ({ p: 90, mm: 0 })), plan: async () => [railJourney(day(8, 12))] } });
  late.at(day(13));
  await F.foreseeTick(late.d);
  assert.equal(late.ledger().items.length, 0);
  assert.equal(late.calls.length, 0);
  const none = await F.foresightInfo(kit({ places: [] }).d);
  assert.deepEqual(none.notes, ["Save Home in Memory → ME → PLACES and I'll predict the rain there every morning."]);
});

test('his word on his own questions: right, wrong or unknown; a feed-scored one is never changed; a person is never recorded', async () => {
  const k = kit();
  k.at(day(10));
  const r = await F.recordExpectation(k.d, { subject: 'will it rain on Saturday?', expect: 'rain on Saturday', by: day(9, 0, 7), confidence: 0.6, said: 'I reckon rain on Saturday.' });
  assert.equal(r.p.kind, 'answer');
  assert.equal(r.p.subject, 'will it rain on Saturday?');
  const refused = await F.recordExpectation(k.d, { subject: 'will my cousin call me back?', expect: 'yes', by: day(12), confidence: 0.6 });
  assert.deepEqual(refused, { refused: "I don't make predictions about people." });
  const refused2 = await F.recordExpectation(k.d, { subject: 'what happens tonight', expect: 'Sam will text you', by: day(12), confidence: 0.6 });
  assert.ok('refused' in refused2, 'the expectation is checked too');
  assert.equal(k.ledger().items.length, 1, 'nothing recorded for a person');
  // "you were right" (short, while it is under seven days old) → his word, and the first one to come true is told
  assert.equal(await F.foresightReply(k.d, 'right, next'), null);
  assert.equal(await F.foresightReply(k.d, 'you were right'), 'Noted: right.');
  assert.deepEqual(k.ledger().items[0].outcome, { at: day(10), actual: 'you said I was right', right: true, how: 'owner' });
  assert.equal(k.notes.length, 1);
  assert.equal(k.notes[0].text, 'My first prediction came true: I expected rain on Saturday; you said I was right. I keep score now: SYSTEM → Report card → FORESIGHT.');
  assert.equal(await F.foresightReply(k.d, 'you were wrong'), null, 'nothing open: not a verdict');
  await assert.rejects(F.resolvePrediction(k.d, r.p.id, false), /already scored/);
  // a feed's prediction is scored only by its feed
  const L = k.ledger();
  L.items.push({ id: 'dep', at: day(6), kind: 'departure', subject: 'the 08:12 train', expect: 'on time', confidence: 0.6, by: day(8, 15) });
  k.storage.m.set(S.FORESIGHT_KEY, L);
  await assert.rejects(F.resolvePrediction(k.d, 'dep', true), /scored by the feeds/);
  // an old open question (over seven days) is not resolved by "you were right"
  await F.recordExpectation(k.d, { subject: 'will the M6 be busy on Friday?', expect: 'busy from 4', by: day(18, 0, 6), confidence: 0.55 });
  k.at(day(10, 0, 11));
  assert.equal(await F.foresightReply(k.d, 'you were right'), null);
  // the words: today / record / yesterday
  assert.match(await F.foresightReply(k.d, 'how often are you right?'), /^I've only scored 1 so far about your questions\.$/);
});

// ---------------------------------------------------------------- the tool, its group, the words

test('the foresee tool: his question on record (never a person), today, the record; when it can be checked in his words', async () => {
  const k = kit();
  const ctx = { storage: k.storage, vault: k.d.vault };
  const tool = FT.foresightTools[0];
  assert.equal(tool.name, 'foresee');
  assert.ok(tool.description.length <= 1000);
  assert.equal(tool.pure({ what: 'record' }), true);
  assert.equal(tool.pure({ what: 'expect' }), false, 'putting one on record writes');
  assert.equal(await tool.run({ what: 'today' }, ctx), S.NONE_YET);
  const said = await tool.run({ what: 'expect', subject: 'will the price of a PS5 drop at Argos by Friday?', expect: 'the price to drop by Friday', by: 'Friday 18:00', confidence: 0.65 }, ctx);
  assert.match(said, /^On record: I expect the price to drop by Friday \(65%\), to be checked on Friday\. Tell him your expectation in a line and that it's on record/);
  const p = k.ledger().items[0];
  assert.equal(p.kind, 'answer');
  assert.equal(new Date(p.by).getUTCDay(), 5, 'Friday');
  assert.equal(await tool.run({ what: 'expect', subject: 'will my mum call tonight?', expect: 'yes', confidence: 0.6 }, ctx), "I don't make predictions about people. (Nothing was recorded. Say exactly that to him, and say nothing about the person.)");
  assert.equal(k.ledger().items.length, 1, 'nothing recorded about a person');
  assert.match(await tool.run({ what: 'record' }, ctx), /^Nothing has been scored yet/);
  // when, in his words (his zone): Monday 2 November 2026, 10:00
  const now = day(10);
  assert.equal(FT.byWhen('', TZ, now), day(9, 0, 3), 'tomorrow 09:00 by default');
  assert.equal(FT.byWhen('tomorrow 18:00', TZ, now), day(18, 0, 3));
  assert.equal(FT.byWhen('Saturday', TZ, now), day(20, 0, 7), 'a day: its evening');
  assert.equal(FT.byWhen('on Friday at 5pm', TZ, now), day(17, 0, 6));
  assert.equal(FT.byWhen('Monday', TZ, now), day(20, 0, 9), 'a week on, not today');
  assert.equal(FT.byWhen('next week', TZ, now), day(9, 0, 9));
  assert.equal(FT.byWhen('in 3 hours', TZ, now), day(13));
  assert.equal(FT.byWhen('gibberish', TZ, now), day(9, 0, 3));
});

test('the group: on by his words, never always; named in the plain turn as "foresight: foresee"; under WATCH OVER YOU', async () => {
  const T = await import('./.build/tools/index.mjs');
  const A = await import('./.build/abilities.mjs');
  const g = T.TOOL_GROUPS.find((x) => x.name === 'foresight');
  assert.deepEqual(g.tools.map((t) => t.name), ['foresee']);
  assert.notEqual(g.when, 'always');
  for (const m of ['what do you reckon, will it rain tomorrow?', 'what do you think will happen with the price?', 'will I finish by Friday?', 'will the price drop?', 'how often are you right?', 'were you right?', 'any predictions?', 'what is the forecast like']) assert.ok(T.selectGroups(m, new Set(), false).on.some((x) => x.name === 'foresight'), m);
  for (const m of ['hello', 'what is the forecast for Leeds', 'will you marry me', 'remind me at 5']) assert.ok(!T.selectGroups(m, new Set(), false).on.some((x) => x.name === 'foresight'), m);
  assert.ok(g.about.length <= 220 && /^You can/.test(g.about) && g.about.includes('foresee') && /never a person/.test(g.about));
  assert.equal(A.GROUP_CAT.foresight, 'watch');
  assert.equal(A.GROUP_NEEDS.foresight, undefined, 'it needs no key');
});

// ---------------------------------------------------------------- through the real brain

test('the brain: GET /api/foresight, POST /api/foresight/resolve, one standing foresee job, run now', async () => {
  const mod = await import('./.build/brain.mjs');
  const OWNER_KEY = 'foresight-owner-key-0123456789abcdef';
  const pending = [];
  const state = { storage: new Mem(), waitUntil: (p) => pending.push(p) };
  const env = { OWNER_KEY, MOCK_LLM: '1' };
  let agent;
  env.AGENT = { idFromName: (n) => n, get: () => ({ fetch: (r) => (agent ??= new mod.GhostyAgent(state, env)).fetch(r) }) };
  const call = async (path, init = {}) => {
    const r = await mod.default.fetch(new Request(`https://ghosty.me.workers.dev/api${path}`, { ...init, headers: { 'content-type': 'application/json', 'x-ghosty': '1', 'x-ghosty-key': OWNER_KEY } }), env, { waitUntil: (p) => pending.push(p) });
    await Promise.allSettled(pending.splice(0));
    return { status: r.status, body: await r.json() };
  };
  state.storage.m.set('owner:ctx', { tz: TZ, name: 'Aqis' });
  const empty = await call('/foresight');
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.body.items, []);
  assert.deepEqual(empty.body.notes, ["Save Home in Memory → ME → PLACES and I'll predict the rain there every morning."]);
  assert.equal(empty.body.score, 'I keep score: nothing scored yet.');
  assert.deepEqual(Object.keys(empty.body.calibration), ['rain', 'departure', 'commute', 'answer', 'all']);
  const jobs = (state.storage.m.get('jobs') ?? []).filter((j) => j.kind === 'foresee');
  assert.equal(jobs.length, 1, 'one standing foresee job');
  assert.equal(jobs[0].repeat, 'hourly');
  await call('/foresight');
  assert.equal((state.storage.m.get('jobs') ?? []).filter((j) => j.kind === 'foresee').length, 1, 'still one');
  // his question on record, resolved from the panel
  const now = Date.now();
  state.storage.m.set(S.FORESIGHT_KEY, { items: [{ id: 'q1', at: now - HOUR, kind: 'answer', subject: 'will the price drop?', expect: 'the price to drop by Friday', confidence: 0.6, by: now + 24 * HOUR }, { id: 'd1', at: now - 2 * HOUR, kind: 'departure', subject: 'the 08:12 train', expect: 'on time', confidence: 0.6, by: now + HOUR }], samples: { dep: {}, com: {} }, made: { day: '' } });
  const bad = await call('/foresight/resolve', { method: 'POST', body: JSON.stringify({ id: 'd1', right: true }) });
  assert.equal(bad.status, 400);
  const ok = await call('/foresight/resolve', { method: 'POST', body: JSON.stringify({ id: 'q1', right: true }) });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.said, 'Noted: right.');
  assert.equal(ok.body.calibration.answer.n, 1);
  const inbox = (await call('/inbox')).body.items;
  assert.equal(inbox.filter((i) => i.title === 'A prediction came true').length, 1, 'the first true one is in his inbox');
  // the job run now (the Agenda's RUN): it answers when it will come back
  const run = await call(`/jobs/${jobs[0].id}/run`, { method: 'POST', body: '{}' });
  assert.equal(run.status, 200);
  assert.ok(run.body.next > Date.now(), JSON.stringify(run.body));
  // the chat: the model puts its expectation on record with the tool, and reads the record back
  const chat = async (message) => {
    const r = await mod.default.fetch(new Request('https://ghosty.me.workers.dev/api/chat', { method: 'POST', headers: { 'content-type': 'application/json', 'x-ghosty': '1', 'x-ghosty-key': OWNER_KEY }, body: JSON.stringify({ message, context: { tz: TZ, name: 'Aqis' } }) }), env, { waitUntil: (p) => pending.push(p) });
    const text = await r.text();
    await Promise.allSettled(pending.splice(0));
    return text.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  };
  const asked = await chat('what do you reckon, will it rain tomorrow?');
  assert.ok(asked.some((e) => e.t === 'tool' && e.name === 'foresee'), JSON.stringify(asked.map((e) => e.t)));
  const kept = state.storage.m.get(S.FORESIGHT_KEY).items.find((p) => p.subject === 'rain at Home tomorrow');
  assert.ok(kept && kept.kind === 'answer' && kept.expect === 'rain' && kept.confidence === 0.6);
  assert.equal(S.hhmm(kept.by, TZ), '18:00');
  assert.equal(S.dayOf(kept.by, TZ), S.dayOf(Date.now() + 24 * HOUR, TZ), 'tomorrow');
  const rec = await chat('how often are you right?');
  assert.ok(rec.some((e) => e.t === 'tool' && e.name === 'foresee'));
  assert.match(rec.filter((e) => e.t === 'text').map((e) => e.text).join(''), /I've only scored 1 so far about your questions/);
});
