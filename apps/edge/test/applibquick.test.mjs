// THE PRO ROUND, lane LOG: quick-add (packages/shared/src/applib/quickadd.ts). One line of his own words read into a log app's
// fields: money, stars, durations, days, times, numbers with units, a year, the app's choices and the title. Run from applib.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({
  stdin: { contents: `export * from './packages/shared/src/applib/quickadd.ts'; export { LIBRARY } from './packages/shared/src/applib/index.ts';`, resolveDir: at('../../..'), loader: 'ts' },
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outfile: at('./.build/applibquick.mjs'),
  logLevel: 'warning',
});
const Q = await import('./.build/applibquick.mjs');
const app = (id) => { const a = Q.LIBRARY.find((x) => x.id === id); assert.ok(a, `no app ${id}`); return a.log ?? a.importer?.log; };
const NOW = new Date(2026, 10, 14, 19, 0); // Saturday 14 November 2026

const CELLAR = app('wine-cellar');
const RUNS = {
  fields: [
    { id: 'what', label: 'Activity', type: 'choice', options: ['Run', 'Walk', 'Swim', 'Cycle'] },
    { id: 'km', label: 'Distance', type: 'number', unit: 'km', min: 0 },
    { id: 'time', label: 'Time', type: 'duration' },
    { id: 'date', label: 'Date', type: 'date', default: 'today' },
    { id: 'at', label: 'Started', type: 'time' },
    { id: 'feel', label: 'Feel', type: 'scale', min: 1, max: 10 },
    { id: 'notes', label: 'Notes', type: 'text' },
  ],
  title: 'what', date: 'date',
};

test('quick-add: a bottle in plain words fills the wine, vintage, price and stars', () => {
  const r = Q.quickAdd(CELLAR, 'Rioja 2018 £14.50 4 stars', NOW);
  assert.equal(r.fields.wine, 'Rioja');
  assert.equal(r.fields.vintage, 2018);
  assert.equal(r.fields.price, 14.5);
  assert.equal(r.fields.rating, 4);
  assert.equal(r.rest, '');
});

test('quick-add: the colour is read from the app\'s own choices, accents or not, and money in other words', () => {
  const r = Q.quickAdd(CELLAR, 'Whispering Angel rose 2023 18 quid 5/5', NOW);
  assert.equal(r.fields.colour, 'Rosé');
  assert.equal(r.fields.wine, 'Whispering Angel');
  assert.equal(r.fields.price, 18);
  assert.equal(r.fields.rating, 5);
  assert.equal(Q.quickAdd(CELLAR, 'Cava 80p', NOW).fields.price, 0.8);
});

test('quick-add: "ran 5k in 26 min" reads the activity, the distance (5k is 5 km) and the time', () => {
  const r = Q.quickAdd(RUNS, 'ran 5k in 26 min', NOW);
  assert.equal(r.fields.what, 'Run');
  assert.equal(r.fields.km, 5);
  assert.equal(r.fields.time, 26);
  assert.equal(r.rest, '');
  const s = Q.quickAdd(RUNS, 'swimming 1 h 20 min yesterday 7am feel 8/10 lovely and calm', NOW);
  assert.equal(s.fields.what, 'Swim');
  assert.equal(s.fields.time, 80);
  assert.equal(s.fields.date, '2026-11-13');
  assert.equal(s.fields.at, '07:00');
  assert.equal(s.fields.feel, 8);
  assert.equal(s.fields.notes, 'Lovely and calm');
  assert.equal(Q.quickAdd(RUNS, 'cycled 42.2 km 1:58:30', NOW).fields.time, 119);
});

test('quick-add: days in his words', () => {
  const d = (t) => Q.quickAdd(RUNS, `walk ${t}`, NOW).fields.date;
  assert.equal(d('today'), '2026-11-14');
  assert.equal(d('last tuesday'), '2026-11-10');
  assert.equal(d('on monday'), '2026-11-09');
  assert.equal(d('next monday'), '2026-11-16');
  assert.equal(d('3rd March'), '2026-03-03');
  assert.equal(d('Dec 25 2025'), '2025-12-25');
  assert.equal(d('2026-01-02'), '2026-01-02');
  assert.equal(d('12/3'), '2026-03-12');
  assert.equal(Q.quickAdd(RUNS, 'walk 7.30pm', NOW).fields.at, '19:30');
  assert.equal(Q.quickAdd(RUNS, 'walk 18:05', NOW).fields.at, '18:05');
});

test('quick-add: the left-over numbers fill the plain number fields in order (a set: weight with its unit, then reps)', () => {
  const r = Q.quickAdd(app('workout-log'), 'bench press 62.5kg 6 reps chest', NOW);
  assert.equal(r.fields.exercise, 'Bench press');
  assert.equal(r.fields.weight, 62.5);
  assert.equal(r.fields.reps, 6);
  assert.equal(r.fields.muscle, 'Chest');
  const b = Q.quickAdd(app('workout-log'), 'deadlift 100 kg 5', NOW);
  assert.equal(b.fields.weight, 100);
  assert.equal(b.fields.reps, 5);
});

test('quick-add: nothing is made up (empty words, words with no numbers, a number out of range)', () => {
  assert.deepEqual(Q.quickAdd(CELLAR, '   ', NOW).fields, {});
  assert.deepEqual(Q.quickAdd(CELLAR, 'Chablis', NOW).fields, { wine: 'Chablis' });
  assert.equal(Q.quickAdd(CELLAR, 'Port 9 stars', NOW).fields.rating, undefined);
  assert.equal(Q.quickAdd(RUNS, 'walk 5 km', NOW).fields.km, 5);
  assert.equal(Q.stem('running'), Q.stem('Run'));
  assert.equal(Q.stem('ran'), Q.stem('run'));
  assert.notEqual(Q.stem('red'), Q.stem('r'));
});

test('quick-add: every log app\'s example line reads back into its own fields', () => {
  let n = 0;
  for (const a of Q.LIBRARY) {
    const log = a.log;
    if (a.archetype !== 'log' || !log || !a.sample?.length) continue;
    const ex = Q.quickExample(log, a.sample[0]);
    if (!ex) continue;
    const r = Q.quickAdd(log, ex, NOW);
    for (const f of log.fields) {
      if (!(f.type === 'money' || f.type === 'rating')) continue;
      if (a.sample[0][f.id] == null || !ex) continue;
      if (log.fields.filter((x) => x.type === f.type).length > 1) continue;
      assert.equal(Number(r.fields[f.id]), Math.round(Number(a.sample[0][f.id]) * 100) / 100, `${a.id}: "${ex}" read ${f.id} as ${r.fields[f.id]}`);
    }
    n++;
  }
  assert.ok(n > 100, `only ${n} apps had an example`);
});
