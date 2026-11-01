// THE BODY PACK (BRIEF-PACKS-1 item 2): reps counted from the pose model's joints (squats, push-ups, star jumps; out of view
// said; no double counts), a run from GPS fixes (a poor fix and a jump left out, the kilometre's split said, the summary with
// no position in it), steps and sleep from an Apple Health export sample (iPhone and Watch counted once; sleep overlaps
// merged; read from a zip as the phone streams it), water with its goal and nudges, weight's trend, the rest day, the hourly
// stand-up under the cadence, breathing and the stretch set; the tool opens the phone's screens and keeps only what he
// gives. Never a diagnosis: every number that could be read as one says so.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { bundles, ctxOf, deps, fixture, Mem, NOW } from './packs-kit.mjs';

const B = await bundles(['src/tools/body.ts', 'src/packs/index.ts', '../../packages/shared/src/body.ts', '../web/src/features/body/export.ts', '../../packages/shared/src/cadence.ts']);
const T = B['src/tools/body.ts'];
const P = B['src/packs/index.ts'];
const S = B['../../packages/shared/src/body.ts'];
const X = B['../web/src/features/body/export.ts'];
const CAD = B['../../packages/shared/src/cadence.ts'];

// ---- a body in the pose model's 33 points (x, y from 0 to 1), seen side on
const blank = () => Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
function legs(kneeDeg) {
  const p = blank();
  // hip above the knee; the ankle placed so the knee's angle is kneeDeg
  const hip = { x: 0.5, y: 0.4 }, knee = { x: 0.5, y: 0.6 };
  const a = ((180 - kneeDeg) * Math.PI) / 180;
  const ankle = { x: knee.x + 0.2 * Math.sin(a), y: knee.y + 0.2 * Math.cos(a) };
  for (const [i, m] of [[23, hip], [24, hip], [25, knee], [26, knee], [27, ankle], [28, ankle]]) p[i] = { ...m, visibility: 0.95 };
  return p;
}
function arms(elbowDeg) {
  const p = blank();
  const sh = { x: 0.4, y: 0.5 }, el = { x: 0.55, y: 0.5 };
  const a = ((180 - elbowDeg) * Math.PI) / 180;
  const wr = { x: el.x + 0.15 * Math.cos(a), y: el.y + 0.15 * Math.sin(a) };
  for (const [i, m] of [[11, sh], [12, sh], [13, el], [14, el], [15, wr], [16, wr]]) p[i] = { ...m, visibility: 0.95 };
  return p;
}
function jack(open) {
  const p = blank();
  const set = (i, x, y) => (p[i] = { x, y, visibility: 0.95 });
  set(11, 0.45, 0.3); set(12, 0.55, 0.3); set(23, 0.47, 0.55); set(24, 0.53, 0.55);
  if (open) { set(15, 0.35, 0.15); set(16, 0.65, 0.15); set(27, 0.35, 0.95); set(28, 0.65, 0.95); }
  else { set(15, 0.44, 0.55); set(16, 0.56, 0.55); set(27, 0.48, 0.95); set(28, 0.52, 0.95); }
  return p;
}
const play = (ex, frames) => {
  let s = S.repStart(ex), t = 0, reps = 0, hint = '';
  for (const f of frames) {
    const r = S.repStep(s, f, (t += 100));
    s = r.s;
    if (r.rep) reps++;
    if (r.hint) hint = r.hint;
  }
  return { n: s.n, reps, hint };
};
const times = (n, f) => Array.from({ length: n }, f);

test('reps by camera: squats, push-ups and star jumps counted from the joints, once each, and "step back" when he is out of view', () => {
  assert.equal(Math.round(S.angleAt({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 })), 90);
  const squat = (k) => [...times(4, () => legs(175)), ...times(4, () => legs(80))].slice(0, k);
  assert.equal(play('squats', [...squat(8), ...squat(8), ...squat(8), ...times(4, () => legs(175))]).n, 3);
  // a half squat (to 120°) is not a rep; jitter at the top is not two
  assert.equal(play('squats', [...times(4, () => legs(175)), ...times(4, () => legs(120)), ...times(4, () => legs(175))]).n, 0);
  assert.equal(play('pushups', [...times(3, () => arms(170)), ...times(3, () => arms(70)), ...times(3, () => arms(170)), ...times(3, () => arms(70)), ...times(3, () => arms(170))]).n, 2);
  assert.equal(play('jacks', [jack(false), jack(true), jack(false), jack(true), jack(true), jack(false), jack(false)]).n, 2);
  // two reps faster than 0.4 s apart: the second waits
  let s = S.repStart('jacks');
  for (const [f, t] of [[jack(true), 0], [jack(false), 100], [jack(true), 200], [jack(false), 300]]) s = S.repStep(s, f, t).s;
  assert.equal(s.n, 1);
  const lost = play('squats', times(31, () => null));
  assert.equal(lost.hint, 'Step back so the camera sees all of you.');
  assert.equal(S.exerciseOf('count my push ups'), 'pushups');
  assert.equal(S.exerciseOf('jumping jacks'), 'jacks');
  const c = S.repsCard('squats', 12, 75, NOW);
  assert.equal(c.title, '12 squats');
  assert.match(c.line, /nothing left it/);
});

test('the running coach: a kilometre’s split said, a poor fix and a jump left out, the summary with no position in it', () => {
  let s = S.runStart(0);
  const said = [];
  // 10 m north every 3 s (3.3 m/s), from Birmingham
  for (let i = 0; i <= 130; i++) {
    const f = { lat: 52.48 + (i * 10) / 111_195, lon: -1.9, t: i * 3000, acc: 8 };
    const r = S.runStep(s, f);
    s = r.s;
    if (r.split) said.push(S.splitWords(r.split.n, s.splits.at(-1), r.split.secs));
    if (i === 50) s = S.runStep(s, { lat: 52.6, lon: -1.9, t: i * 3000 + 1000, acc: 5 }).s; // a jump of 13 km in a second
    if (i === 60) s = S.runStep(s, { lat: 52.49, lon: -1.95, t: i * 3000 + 1000, acc: 80 }).s; // a poor fix
  }
  assert.ok(Math.abs(s.km - 1.3) < 0.01, `${s.km}`);
  assert.equal(s.splits.length, 1);
  assert.ok(Math.abs(s.splits[0] - 300) <= 1, `${s.splits[0]}`);
  assert.equal(said[0], '1 kilometre in 5 minutes. That one took 5 minutes.');
  const p = S.paces(s);
  assert.ok(Math.abs(p.avg - 300) < 3 && Math.abs(p.now - 300) < 3);
  const sum = S.runSummary(s);
  assert.deepEqual(Object.keys(sum).sort(), ['km', 'secs', 'splits']);
  assert.ok(!JSON.stringify(sum).includes('52.4'), 'no position in what leaves the phone');
  assert.equal(S.runCard(sum, NOW).title, 'Run 1.30 km');
  assert.equal(S.clock(3725), '1:02:05');
});

const XML = fixture('health-export.xml');

test('steps and sleep from an Apple Health export: the iPhone’s and Watch’s steps counted once, sleep overlaps merged, never a diagnosis', () => {
  const acc = S.healthStart('2026-11-01', 30);
  for (const line of XML.split('\n')) S.feedHealth(acc, line);
  const w = S.healthWeek(acc);
  assert.equal(w.from, '2026-10-25');
  assert.equal(w.to, '2026-10-31');
  assert.deepEqual(w.days.map((d) => d.steps), [5000, 4500, 8000, 6500, 10000, 7000, 9000]);
  assert.equal(w.avgSteps, 7143);
  assert.deepEqual(w.days.map((d) => d.sleep), [null, null, null, null, null, 390, 450]);
  assert.equal(w.avgSleep, 420);
  assert.match(S.stepsWords(w), /^Steps, Sun 25 Oct to Sat 31 Oct: 7,143 a day on average; most on Thu 29 Oct \(10,000\)\..*Not medical advice\.$/);
  assert.match(S.sleepWords(w), /^Sleep, 2 nights to Sat 31 Oct: 7 h 00 min a night on average; shortest the night before Fri 30 Oct \(6 h 30 min\)\..*Not medical advice\.$/);
  assert.equal(S.asleepMinutes([[0, 60_000], [30_000, 120_000], [600_000, 660_000]]), 3);
  assert.equal(S.healthCard(w, NOW).title, 'Your week in Health');
});

/** A zip of one file, deflated, as the Health app writes export.zip (with the folder it uses). */
function zipOf(name, text) {
  const data = Buffer.from(text, 'utf8');
  const comp = deflateRawSync(data);
  const nameB = Buffer.from(name);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
  local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameB.length, 26);
  const cd = Buffer.alloc(46);
  cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(8, 10);
  cd.writeUInt32LE(comp.length, 20); cd.writeUInt32LE(data.length, 24); cd.writeUInt16LE(nameB.length, 28); cd.writeUInt32LE(0, 42);
  const cdOff = local.length + nameB.length + comp.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
  end.writeUInt32LE(cd.length + nameB.length, 12); end.writeUInt32LE(cdOff, 16);
  return Buffer.concat([local, nameB, comp, cd, nameB, end]);
}

test('the phone reads export.zip as a stream: the directory from its end, export.xml inflated piece by piece', async () => {
  const zip = new File([zipOf('apple_health_export/export.xml', XML)], 'export.zip', { type: 'application/zip' });
  const e = await X.zipEntry(zip, (n) => /(^|\/)export\.xml$/.test(n));
  assert.equal(e.method, 8);
  const seen = [];
  const r = await X.readExport(zip, '2026-11-01', (f) => seen.push(f));
  assert.equal(r.week.avgSteps, 7143);
  assert.equal(r.week.avgSleep, 420);
  assert.ok(seen.at(-1) > 0.9, 'progress reported');
  // the xml itself reads the same; a zip with no export.xml says so
  assert.equal((await X.readExport(new File([XML], 'export.xml', { type: 'text/xml' }), '2026-11-01')).week.avgSteps, 7143);
  await assert.rejects(X.readExport(new File([zipOf('other.txt', 'x')], 'e.zip', { type: 'application/zip' }), '2026-11-01'), /no export\.xml/);
});

test('water: a glass, the goal, nudges on and off, UNDO; the Brief’s line', async () => {
  const storage = new Mem();
  const d = deps(storage);
  let out = await T.BODY.water({ words: 'had a glass of water' }, d);
  assert.equal(out.text, 'Kept. Water: 1 of 8 glasses today (a glass is 250 ml).');
  assert.deepEqual(out.cards[0].acts.map((a) => a.label), ['+1 GLASS', 'UNDO']);
  out = await T.BODY.water({ words: '500ml' }, d);
  assert.match(out.text, /Water: 3 of 8/);
  out = await T.BODY.water({ words: 'set my goal to 6' }, d);
  assert.match(out.text, /^Goal: 6 glasses a day\. Water: 3 of 6/);
  out = await T.BODY.water({ words: 'undo' }, d);
  assert.match(out.text, /^One taken off\. Water: 2 of 6/);
  out = await T.BODY.water({ words: 'remind me to drink water' }, d);
  assert.match(out.text, /nudge you if you’re behind, under your speak-first dial/);
  assert.deepEqual(await P.packLines({ storage, now: () => NOW }), ['Water: 2 of 6 glasses today']);
  assert.equal(S.glassesIn('a pint'), 2);
  assert.equal(S.glassesIn('3 glasses'), 3);
});

test('the nudges under the cadence: water when behind at 11, the stand-up on the hour on a weekday; each once', async () => {
  const storage = new Mem();
  // Monday 2 Nov 2026, 11:10 and 10:05 in London (GMT)
  const at = (h, m) => Date.UTC(2026, 10, 2, h, m);
  await T.BODY.water({ words: 'remind me' }, deps(storage, undefined, at(9, 0)));
  await T.BODY.stand({ words: 'remind me to stand up every hour from 9 to 5' }, deps(storage, undefined, at(9, 0)));
  const cad = CAD.readCadence(undefined);
  let pieces = await P.packPieces({ storage, now: () => at(11, 10) }, cad);
  assert.deepEqual(pieces.map((p) => p.card.title), ['A glass of water?', 'Stand up a minute']);
  assert.match(pieces[0].why, /you asked me to nudge you about water/);
  // said once: the cadence's record keeps it from coming again
  const said = CAD.record(cad, { at: at(11, 10), id: pieces[0].card.id, title: '', line: '', why: '' }, 'Europe/London');
  pieces = await P.packPieces({ storage, now: () => at(11, 20) }, said);
  assert.deepEqual(pieces.map((p) => p.card.title), ['Stand up a minute']);
  // not on a Saturday, not after his hours, not in the hour's second half
  assert.equal((await P.packPieces({ storage, now: () => Date.UTC(2026, 10, 7, 11, 10) }, cad)).filter((p) => /stand/.test(p.card.id)).length, 0);
  assert.equal((await P.packPieces({ storage, now: () => at(17, 10) }, cad)).filter((p) => /stand/.test(p.card.id)).length, 0);
  assert.equal((await P.packPieces({ storage, now: () => at(10, 40) }, cad)).length, 0);
  assert.match((await T.BODY.stand({ words: 'stop the stand-ups' }, deps(storage))).text, /off/);
});

test('weight’s trend in kilos, stones or pounds, gently and never judged; the rest day after four in a row', async () => {
  assert.equal(S.kgIn('13 stone 4'), 84.4);
  assert.equal(S.kgIn('182 lb'), 82.6);
  assert.equal(S.kgIn('I weigh 82.5 kg'), 82.5);
  const list = [{ d: '2026-10-12', kg: 84 }, { d: '2026-10-14', kg: 84.4 }, { d: '2026-10-27', kg: 83 }, { d: '2026-10-30', kg: 82.6 }];
  assert.match(S.weightTrend(list, '2026-11-01').line, /^This week 82\.8 kg on average, 1\.4 kg less than two weeks before \(84\.2 kg\)\. .*Not medical advice\.$/);
  const storage = new Mem();
  assert.match((await T.BODY.weight({ words: 'I weigh 82.5 kg' }, deps(storage))).text, /^Kept: 82\.5 kg today\. This week: 82\.5 kg on average/);
  assert.match((await T.BODY.weight({ words: 'I weigh 5 kg' }, deps(storage))).text, /doesn’t look like a weight/);
  const log = ['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'].map((d) => ({ d, kind: 'reps', what: 'squats', n: 20 }));
  assert.match(S.restLine(log, '2026-11-01'), /^You’ve trained 4 days in a row: a rest day helps/);
  assert.equal(S.restLine(log.slice(0, 2), '2026-11-01'), 'You rested yesterday: good to go today.');
  assert.deepEqual(S.workoutIn('ran 5k in 28 minutes', '2026-11-01'), { d: '2026-11-01', kind: 'run', what: 'a run', km: 5, secs: 1680 });
  assert.deepEqual(S.workoutIn('did 30 push-ups yesterday', '2026-11-01'), { d: '2026-10-31', kind: 'reps', what: 'push-ups', n: 30 });
});

test('breathing and the stretch set: the phase at each moment, rounds, the set’s order and its end', () => {
  assert.deepEqual(S.breathAt('box', 0), { say: 'Breathe in', left: 4, round: 1, i: 0, frac: 0 });
  assert.equal(S.breathAt('box', 4500).say, 'Hold');
  assert.equal(S.breathAt('box', 9000).say, 'Breathe out');
  assert.equal(S.breathAt('box', 16_100).round, 2);
  assert.equal(S.breathAt('478', 4000 + 6500).say, 'Hold');
  assert.equal(S.breathAt('478', 11_500).say, 'Breathe out');
  assert.deepEqual(S.stretchAt(0), { i: 0, left: 30, done: false });
  assert.equal(S.stretchAt(65).i, 2);
  assert.ok(S.stretchAt(S.STRETCH_SECS).done);
  assert.equal(S.STRETCHES.length, 8);
});

test('the tool opens the phone’s screens and keeps only what he gives: a run’s numbers, never its route; the Health week, then steps and sleep', async () => {
  const tool = T.bodyTools[0];
  assert.deepEqual(tool.parameters.properties.action.enum, ['reps', 'run', 'log', 'steps', 'sleep', 'water', 'breathe', 'stretch', 'weight', 'rest', 'stand', 'week', 'health']);
  assert.ok(tool.description.length <= 1000);
  const storage = new Mem();
  const { ctx, events } = ctxOf(storage);
  assert.match(await tool.run({ action: 'reps', words: 'count my push-ups' }, ctx), /camera counts your push-ups/);
  assert.match(await tool.run({ action: 'breathe', words: '4-7-8' }, ctx), /^On your phone: 4-7-8 breathing/);
  const opened = events.filter((e) => e.t === 'client' && e.name === 'open_body').map((e) => e.args);
  assert.deepEqual(opened, [{ what: 'reps', exercise: 'pushups' }, { what: 'breathe', pattern: '478' }]);
  // a run from the phone after RUN SAVED: its numbers kept, and nothing else even if more was sent
  const out = await T.BODY.log({ run: { km: 5.02, secs: 1690, splits: [330, 335, 340, 342, 343], lat: 52.48, path: [[52.48, -1.9]] } }, deps(storage));
  assert.match(out.text, /^Run kept: 5\.02 km in 28 minutes\./);
  const kept = JSON.stringify(await storage.get(T.BODY_KEYS.log));
  assert.ok(!/52\.48|path|lat/.test(kept), kept);
  assert.equal(out.cards[0].title, 'Run 5.02 km');
  // the camera's count
  assert.match((await T.BODY.log({ exercise: 'squats', n: 15 }, deps(storage))).text, /^Kept: 15 squats\./);
  // steps and sleep wait for the export; the phone sends the week (POST /packs/do), then they answer
  assert.match((await T.BODY.steps({}, deps(storage))).text, /^No Health week yet/);
  const acc = S.healthStart('2026-11-01', 30);
  for (const l of XML.split('\n')) S.feedHealth(acc, l);
  const r = await P.packsRoute(new Request('https://g/api/packs/do', { method: 'POST', body: JSON.stringify({ pack: 'body', action: 'health', args: { week: S.healthWeek(acc) } }) }), '/packs/do', 'POST', { storage, notify: async () => undefined, now: () => NOW });
  assert.equal(r.status, 200);
  assert.match((await T.BODY.steps({}, deps(storage))).text, /7,143 a day on average/);
  assert.match((await T.BODY.sleep({}, deps(storage))).text, /7 h 00 min a night on average/);
  assert.match((await T.BODY.week({}, deps(storage))).text, /^This week since Monday: 1 active day · 15 reps · 5\.0 km run\..*Not medical advice\.$/);
});

test('what the chat opens on the phone with no model: "count my squats", "start a run", "breathe", "stretch with me", "had a glass of water"', () => {
  assert.deepEqual(S.bodyAsked('count my squats'), { what: 'reps', exercise: 'squats' });
  assert.deepEqual(S.bodyAsked('Count my push-ups!'), { what: 'reps', exercise: 'pushups' });
  assert.deepEqual(S.bodyAsked('start a run'), { what: 'run' });
  assert.deepEqual(S.bodyAsked('4-7-8 breathing'), { what: 'breathe', pattern: '478' });
  assert.deepEqual(S.bodyAsked('stretch with me'), { what: 'stretch' });
  assert.deepEqual(S.bodyAsked('had 2 glasses of water'), { what: 'water', glasses: 2 });
  for (const t of ['how far did I run yesterday?', 'I need to stretch my budget', 'what is box breathing good for?', 'count the days to Christmas']) assert.equal(S.bodyAsked(t), null, t);
});
