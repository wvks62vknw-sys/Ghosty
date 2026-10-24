// NIGHT SCHOOL (BRIEF-NIGHT-SCHOOL part A): the plan's order and stopping points, the window on UK time across both
// clock changes, the progress line and the morning report's words (packages/shared/src/night.ts, pure); and the brain's
// side (apps/edge/src/school/night.ts): the switch and window, tonight's practice and its exact marks (a miss goes first
// into the week's training), the report filed once in the inbox and folded into the school report, the brain's own
// report when the phone sent none, its part in the window (practice's night allowance, the study job kept due) and the
// training job woken at the window's start.
// (Run from offline.test.mjs, which is in the test list; package.json is protected. Bundles are built here.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { existsSync } from 'node:fs';
import { sqlStorage } from '../../../tests/sqlite-storage.mjs';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({
  entryPoints: ['../../../packages/shared/src/night.ts', '../src/school/index.ts', '../src/school/night.ts', '../src/school/practice.ts', '../src/schedule.ts', '../src/selftrain/cycle.ts'].map(at).filter((f) => existsSync(f)),
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  external: ['cloudflare:sockets'],
  outdir: at('./.build/night'),
  outbase: at('../../..'),
  outExtension: { '.js': '.mjs' },
  logLevel: 'warning',
});
// (a missing file loads as empty: each test then fails on its own on the old code)
const load = (f) => import(`./.build/night/${f}.mjs`).catch(() => ({}));
const N = await load('packages/shared/src/night');
const IX = await load('apps/edge/src/school/index');
const NB = await load('apps/edge/src/school/night');
const PR = await load('apps/edge/src/school/practice');
const SCH = await load('apps/edge/src/schedule');
const C = await load('apps/edge/src/selftrain/cycle');

class MemStorage {
  m = new Map();
  sql = sqlStorage();
  alarm = null;
  async get(k) { return Array.isArray(k) ? new Map(k.filter((x) => this.m.has(x)).map((x) => [x, structuredClone(this.m.get(x))])) : this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
  async put(k, v) { if (typeof k === 'object') for (const [a, b] of Object.entries(k)) this.m.set(a, structuredClone(b)); else this.m.set(k, structuredClone(v)); }
  async delete(k) { return Array.isArray(k) ? k.filter((x) => this.m.delete(x)).length : this.m.delete(k); }
  async list({ prefix = '' } = {}) { return new Map([...this.m].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, structuredClone(v)])); }
  async setAlarm(t) { this.alarm = typeof t === 'number' ? t : t.getTime(); }
  async getAlarm() { return this.alarm; }
}

const T = (iso) => Date.parse(iso);
const H = 3600_000;

// ---- the plan (pure) -------------------------------------------------------------------------------------------

test('the night plan: school practice, then the GYM, then study, in that order, each with its own stopping point', () => {
  const end = T('2026-10-21T05:00:00Z');
  const ctx = (o = {}) => ({ now: T('2026-10-20T22:30:00Z'), end, offline: true, gymLeft: true, studyLeft: true, ...o });
  let run = N.newNight('2026-10-20', T('2026-10-20T22:00:00Z'));
  run = N.advance(run, ctx());
  assert.equal(run.part, 'school', 'school practice first');
  // asked: 40 handed out; 39 answered goes on, the 40th ends it
  run = N.advance({ ...run, school: { ...run.school, asked: true, of: 40, n: 39 } }, ctx());
  assert.equal(run.part, 'school');
  run = N.advance({ ...run, school: { ...run.school, n: 40 } }, ctx());
  assert.equal(run.part, 'gym', 'then the GYM');
  assert.equal(run.ended.school, '40 of 40 answered');
  // an ended part stays ended
  assert.equal(N.advance(run, ctx()).part, 'gym');
  // the GYM: three hours of it
  run = N.advance({ ...run, gym: { ...run.gym, ms: 3 * H - 1 } }, ctx());
  assert.equal(run.part, 'gym');
  run = N.advance({ ...run, gym: { ...run.gym, ms: 3 * H } }, ctx());
  assert.deepEqual([run.part, run.ended.gym], ['study', '3 hours of gym']);
  // study stops when there is nothing left to read,
  assert.deepEqual([N.advance(run, ctx({ studyLeft: false })).part, N.advance(run, ctx({ studyLeft: false })).ended.study], ['done', 'nothing left to read']);
  // and every part stops when the night is over
  const over = N.advance(N.newNight('2026-10-20', 0), ctx({ now: end }));
  assert.equal(over.part, 'done');
  assert.deepEqual(over.ended, { school: 'the night is over', gym: 'the night is over', study: 'the night is over' });
  // the other stopping points
  const fresh = N.newNight('2026-10-20', 0);
  assert.deepEqual(N.advance(fresh, ctx({ offline: false })).ended, { school: "the offline brain isn't on this phone" });
  assert.equal(N.advance({ ...fresh, school: { ...fresh.school, asked: true, of: 0 } }, ctx()).ended.school, 'no practice waiting');
  const gymNow = { ...fresh, ended: { school: 'x' } };
  assert.equal(N.advance(gymNow, ctx({ gymLeft: false })).ended.gym, 'every game mastered');
  const late = N.advance(gymNow, ctx({ now: end - H }));
  assert.deepEqual([late.part, late.ended.gym], ['study', 'the last hour is for study']);
  assert.equal(N.advance(gymNow, ctx({ now: end - H - 60_000 })).part, 'gym', 'an hour and a minute left: still the GYM');
});

test('the progress line through the three parts', () => {
  const r = N.newNight('2026-10-20', 0);
  const s = { to: '06:00' };
  // 02:14 in London (BST) on 21 October
  const t = T('2026-10-21T01:14:00Z');
  assert.equal(N.progressLine({ ...r, part: 'school', school: { ...r.school, asked: true, of: 40, n: 18 } }, t, s), 'Night School · 02:14 · school practice 18 of 40 · gym next');
  assert.equal(N.progressLine({ ...r, part: 'school' }, t, s), 'Night School · 02:14 · school practice: getting the questions · gym next');
  assert.equal(N.progressLine({ ...r, part: 'gym', ended: { school: 'x' } }, T('2026-10-21T00:05:00Z'), s, 'maze level 4'), 'Night School · 01:05 · gym: maze level 4 · study next');
  assert.equal(N.progressLine({ ...r, part: 'study', ended: { school: 'x', gym: 'y' }, study: { from: 10, read: 120 } }, T('2026-10-21T03:40:00Z'), s), 'Night School · 04:40 · study: 120 passages read · until 06:00');
  assert.equal(N.progressLine({ ...r, part: 'school', ended: { gym: 'every game mastered' }, school: { ...r.school, asked: true, of: 40, n: 3 } }, t, s), 'Night School · 02:14 · school practice 3 of 40 · study next', 'a part already ended is not next');
  assert.equal(N.progressLine({ ...r, part: 'done' }, T('2026-10-21T04:59:00Z'), s), 'Night School · 05:59 · done for tonight');
});

test('the window keeps UK time: 23:00 to 06:00 is eight hours the night the clocks go back, six the night they go forward', () => {
  const s = { from: '23:00', to: '06:00' };
  // 24 → 25 October 2026: 23:00 BST is 22:00 UTC; 06:00 is GMT by then
  let w = N.nightWindow(T('2026-10-24T22:30:00Z'), s);
  assert.deepEqual(w, { night: '2026-10-24', start: T('2026-10-24T22:00:00Z'), end: T('2026-10-25T06:00:00Z'), inside: true });
  assert.equal(w.end - w.start, 8 * H);
  assert.equal(N.inWindow(T('2026-10-25T00:30:00Z'), s), true, '01:30 BST, the first time round');
  assert.equal(N.inWindow(T('2026-10-25T01:30:00Z'), s), true, '01:30 GMT, the second');
  assert.equal(N.inWindow(T('2026-10-25T05:59:00Z'), s), true);
  w = N.nightWindow(T('2026-10-25T06:00:00Z'), s);
  assert.deepEqual(w, { night: '2026-10-25', start: T('2026-10-25T23:00:00Z'), end: T('2026-10-26T06:00:00Z'), inside: false }, 'over at 06:00 GMT; the next starts at 23:00 GMT');
  assert.equal(N.inWindow(T('2026-10-24T21:59:00Z'), s), false, '22:59 BST');
  // 28 → 29 March 2026: 23:00 GMT, then 06:00 BST = 05:00 UTC
  w = N.nightWindow(T('2026-03-29T01:30:00Z'), s);
  assert.deepEqual(w, { night: '2026-03-28', start: T('2026-03-28T23:00:00Z'), end: T('2026-03-29T05:00:00Z'), inside: true });
  assert.equal(w.end - w.start, 6 * H);
  assert.equal(N.inWindow(T('2026-03-29T05:00:00Z'), s), false, '06:00 BST');
  // a window inside one day; settings that are not times fall back to the defaults
  assert.deepEqual(N.nightWindow(T('2026-10-20T12:30:00Z'), { from: '13:00', to: '15:00' }), { night: '2026-10-20', start: T('2026-10-20T12:00:00Z'), end: T('2026-10-20T14:00:00Z'), inside: true });
  assert.equal(N.nightWindow(T('2026-10-20T14:30:00Z'), { from: '13:00', to: '15:00' }).night, '2026-10-21');
  assert.deepEqual(N.cleanSettings({ on: true, from: '25:00', to: 'soon' }), { on: true, from: '23:00', to: '06:00' });
  assert.deepEqual(N.cleanSettings({ on: true, from: '04:00', to: '04:00' }), { on: true, from: '23:00', to: '06:00' });
  assert.equal(N.clockText(T('2026-10-25T01:14:00Z')), '01:14', 'GMT after the change');
});

test('the morning report says what happened, in plain words', () => {
  const r = N.newNight('2026-10-20', 0);
  const names = { maze: 'maze', tictactoe: 'tic-tac-toe', chess: 'chess' };
  assert.equal(
    N.morningReport({ ...r, school: { ...r.school, n: 40, right: 31 }, gym: { ms: 3 * H, from: { maze: 3, chess: 2 }, to: { maze: 4, chess: 2 }, mastered: [] }, study: { from: 1000, read: 312 } }, names),
    'Last night: 40 practice questions (31 right), maze to level 4, 312 passages read',
  );
  assert.equal(N.morningReport({ ...r, gym: { ms: 2 * H, from: { maze: 9, tictactoe: 2 }, to: { maze: 10, tictactoe: 3 }, mastered: ['maze'] } }, names), 'Last night: maze mastered, tic-tac-toe to level 3');
  assert.equal(N.morningReport({ ...r, school: { ...r.school, n: 1, right: 0 }, gym: { ms: 70 * 60_000, from: { maze: 3 }, to: { maze: 3 }, mastered: [] }, study: { from: 5, read: 1 } }, names), 'Last night: 1 practice question (0 right), 1 h 10 min in the gym (no new level), 1 passage read');
  assert.equal(N.morningReport(r, names), 'Last night: nothing ran on the phone');
  assert.equal(N.brainReport({ practice: 12, read: 80 }), "Last night: the phone was not open on Ghosty, so only the brain's part ran: 12 practice questions written and checked, 80 passages read");
  assert.equal(N.brainReport({ practice: 0, read: 0 }), "Last night: the phone was not open on Ghosty, so only the brain's part ran (nothing new)");
});

// ---- the brain -------------------------------------------------------------------------------------------------

const CAT = { type: 'number', q: 'How many legs does a cat have?', answer: '4', worked: 'Count them.\nAnswer: 4' };
const SKY = { type: 'mcq', q: 'What colour is a clear sky in the day?', options: ['red', 'blue', 'green', 'black'], answer: 'b', worked: 'Look up.\nAnswer: B' };
const WHY = { type: 'short', q: 'Why do we wear coats in winter?', answer: 'to keep warm', worked: 'Answer: to keep warm' };
const DOG = { type: 'exact', q: 'What animal says woof?', answer: 'dog', worked: 'Answer: dog' };

/** Nursery, with counting his weakest topic and colours next; their practice written and checked. */
async function nursery() {
  const s = new MemStorage();
  const result = (subject, topics) => ({ stage: 'nursery', subject, paperId: `p-${subject}`, at: 1, raw: 1, max: 4, grade: 'Working towards', top: false, marked: { pending: 0 }, topics, answers: [] });
  await s.put('school:state', { stage: 'nursery', passed: {}, results: [result('maths', { counting: { got: 0, max: 4 }, colours: { got: 2, max: 4 } })], nightly: true, open: [], news: [], officialUsed: [] });
  const topic = (name, items) => ({ stage: 'nursery', subject: 'maths', topic: name, items, checking: [], asked: 1, rejected: { disagree: 0, malformed: 0, nearPaper: 0 }, updatedAt: 1 });
  await s.put(PR.practiceKey('nursery', 'maths', 'colours'), topic('colours', [SKY, WHY]));
  await s.put(PR.practiceKey('nursery', 'maths', 'counting'), topic('counting', [CAT, DOG]));
  return s;
}
const host = (s, now, over = {}) => ({ storage: s, ask: async () => 'MARKS: 0 | no', push: async (m) => (pushes.push(m), 1), now: () => now, ...over });
let pushes = [];
const route = async (h, path, method = 'GET', body) => {
  const r = await IX.schoolRoute(new Request(`https://ghosty.test/api${path}`, { method, ...(body ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}) }), path, method, h);
  return { status: r.status, body: await r.json() };
};

test('the brain keeps the switch and the window; tonight\'s practice is his weak topics\' checked exact questions, weakest first, without answers', async () => {
  const s = await nursery();
  const h = host(s, T('2026-10-20T22:30:00Z'));
  let r = await route(h, '/school/night');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.settings, { on: false, from: '23:00', to: '06:00' });
  r = await route(h, '/school/night', 'POST', { on: true, from: '22:30', to: '05:30' });
  assert.deepEqual(r.body.settings, { on: true, from: '22:30', to: '05:30' });
  assert.equal(r.body.window.inside, true, '23:30 BST');
  r = await route(h, '/school/night', 'POST', { from: 'midnight' });
  assert.deepEqual(r.body.settings, { on: true, from: '23:00', to: '05:30' }, 'not a time: that one back to its default');
  r = await route(h, '/school/night/practice');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.items.map((x) => x.q), [CAT.q, SKY.q, DOG.q], 'a topic at a time in turn, the weakest (counting) first; no written ones');
  assert.ok(r.body.items.every((x) => !('answer' in x) && !('worked' in x)), 'questions only');
  assert.deepEqual(r.body.items[1].options, SKY.options);
});

test('his answers are marked exactly; a miss is counted on the question and goes first into the week\'s training', async () => {
  const s = await nursery();
  const h = host(s, T('2026-10-20T22:30:00Z'));
  const items = (await route(h, '/school/night/practice')).body.items;
  const id = (q) => items.find((x) => x.q === q).id;
  const r = await route(h, '/school/night/answers', 'POST', { answers: [{ id: id(CAT.q), given: 'Four legs.\nAnswer: 4' }, { id: id(SKY.q), given: 'Answer: A' }, { id: id(DOG.q), given: 'Answer: cat' }, { id: 'school:practice:nursery:maths:nope#0', given: 'x' }] });
  assert.deepEqual(r.body, { marked: 3, right: 1 });
  const counting = await s.get(PR.practiceKey('nursery', 'maths', 'counting'));
  assert.deepEqual(counting.items.map((x) => x.missed ?? 0), [0, 1]);
  // the week's school records: in each topic the missed ones first
  const topics = await PR.loadPractice(s, 'nursery');
  const { recs } = PR.practiceRecords(topics, []);
  const first = (topic) => recs.find((x) => x.from.endsWith(`· ${topic}`)).messages.find((m) => m.role === 'user').content;
  assert.match(first('counting'), /What animal says woof\?/, 'the one he missed leads its topic');
  assert.match((await route(h, '/school/night/practice')).body.items.find((x) => /woof|legs/.test(x.q)).q, /woof/, 'and tonight it is asked first in its topic');
});

test('the morning report: filed once a night in the inbox and in the school report\'s news; the nightly school report folds it in', async () => {
  const s = await nursery();
  pushes = [];
  const now = T('2026-10-21T05:00:30Z');
  const h = host(s, now);
  const text = 'Last night: 40 practice questions (31 right), maze to level 4, 312 passages read';
  assert.equal((await route(h, '/school/night/report', 'POST', { night: '2026-10-20', text: 'hello' })).status, 400);
  let r = await route(h, '/school/night/report', 'POST', { night: '2026-10-20', text });
  assert.equal(r.body.filed, true);
  r = await route(h, '/school/night/report', 'POST', { night: '2026-10-20', text });
  assert.equal(r.body.filed, false, 'once a night');
  const inbox = await SCH.loadInbox(s);
  assert.deepEqual(inbox.map((x) => [x.title, x.text]), [['Night School', text]]);
  assert.deepEqual((await route(h, '/school/night')).body.report, { night: '2026-10-20', text, at: now, from: 'phone' });
  const sent = await IX.schoolDaily(h);
  assert.equal(sent.sent, true);
  assert.match(pushes[0].body, /^School: Night School: last night 40 practice questions \(31 right\), maze to level 4, 312 passages read\./);
});

test('the brain\'s part in the window: the night\'s counts kept, the study job kept due, practice with a night allowance; its own report when the phone sent none', async () => {
  const s = await nursery();
  pushes = [];
  const h = host(s, T('2026-10-20T21:00:00Z'));
  await route(h, '/school/night', 'POST', { on: true });
  // 22:00 BST: outside; the job wants to be back at 23:00
  assert.deepEqual(await NB.nightStep({ storage: s, now: () => T('2026-10-20T21:00:00Z') }), { inside: false, next: H });
  // 23:30: inside; the study job (due in two hours) is brought forward
  await SCH.addJob(s, { kind: 'study', title: 'Self-study', text: 'x', next: Date.now() + 2 * H, repeat: 'hourly', tz: 'UTC' });
  const night = T('2026-10-20T22:30:00Z');
  assert.deepEqual(await NB.nightStep({ storage: s, now: () => night }), { inside: true, next: 10 * 60_000 });
  // (setNext keeps a job at least a second ahead of the real clock: here that is the soonest it can be)
  assert.ok((await SCH.loadJobs(s)).find((j) => j.kind === 'study').next <= Date.now() + 1500, 'the study job is due now, not in two hours');
  assert.deepEqual((await NB.loadNight(s)).brain, { night: '2026-10-20', end: T('2026-10-21T05:00:00Z'), practice: 4, read: 0 });
  // practice: today's own allowance is used up; the night's goes on
  await s.put('school:practice', { day: '2026-10-20', calls: PR.CALLS_PER_DAY });
  const writer = async () => JSON.stringify({ items: [{ type: 'written', q: 'Why is the sea salty, in a sentence?', answer: 'rivers carry salt into it', worked: 'Answer: rivers carry salt into it' }] });
  assert.equal((await PR.practiceTick({ storage: s, ask: writer, now: () => night })).calls, 0, 'without the night: none');
  assert.ok((await PR.practiceTick({ storage: s, ask: writer, now: () => night }, { perDay: PR.CALLS_PER_DAY + NB.NIGHT_CALLS })).calls > 0, 'with it: some');
  // morning, the phone sent nothing: the daily report files the brain's own
  const morning = host(s, T('2026-10-21T06:10:00Z'));
  await IX.schoolDaily(morning);
  const inbox = await SCH.loadInbox(s);
  assert.match(inbox.at(-1).text, /^Last night: the phone was not open on Ghosty, so only the brain's part ran: \d+ practice questions? written and checked$/);
  assert.equal((await NB.loadNight(s)).report.from, 'brain');
  assert.match(pushes[0].body, /Night School: last night the phone was not open on Ghosty/);
  await IX.schoolDaily(morning);
  assert.equal((await SCH.loadInbox(s)).filter((x) => x.title === 'Night School').length, 1, 'once');
});

test('the training job wakes at the window\'s start with Night School on (and keeps its own pace with it off)', async () => {
  const s = new MemStorage();
  const deps = (now) => ({ storage: s, library: null, vault: { get: async () => null }, ask: async () => { throw new Error('none'); }, tools: [], origin: 'https://g.example', now: () => now });
  const at22 = T('2026-10-20T21:00:00Z');
  assert.equal((await C.trainTick(deps(at22))).next, 86_400_000, 'off: the keys are missing, a day');
  await s.put('school:night', { settings: { on: true, from: '23:00', to: '06:00' } });
  assert.equal((await C.trainTick(deps(at22))).next, H, 'on: at 23:00');
  assert.equal((await C.trainTick(deps(T('2026-10-20T22:30:00Z')))).next, 10 * 60_000, 'inside: every ten minutes');
});
