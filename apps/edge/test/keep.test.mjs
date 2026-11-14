// A MEMORY THAT KEEPS YOUR WORD (NEXT ROUND, MEMORY lane): promises caught from his own turns and nudged once on their day, closed by
// his "I did"; where he put things; why he chose; the Sunday week card; the routes; the recall tool's answer; dates in his words.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({
  entryPoints: ['../src/mind.ts', '../src/keep.ts', '../src/tools/memory.ts', '../../../packages/shared/src/keep.ts'].map(at),
  bundle: true, format: 'esm', platform: 'neutral', external: ['cloudflare:sockets'], outdir: at('./.build/keep'), outbase: at('../../..'), outExtension: { '.js': '.mjs' }, logLevel: 'warning',
});
const B = './.build/keep/';
const M = await import(`${B}apps/edge/src/mind.mjs`);
const K = await import(`${B}apps/edge/src/keep.mjs`);
const T = await import(`${B}apps/edge/src/tools/memory.mjs`);
const S = await import(`${B}packages/shared/src/keep.mjs`);

class Mem {
  m = new Map();
  async get(k) { return this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
  async put(k, v) { this.m.set(k, structuredClone(v)); }
  async delete(k) { return Array.isArray(k) ? k.filter((x) => this.m.delete(x)).length : this.m.delete(k); }
  async list() { return new Map(); }
}
const TZ = 'Europe/London';
// Thursday 12 November 2026, 10:00 in London (GMT)
const NOW = Date.parse('2026-11-12T10:00:00Z');
const H = 3600_000;
const D = 24 * H;
const say = (storage, words, t, via = 'app') => M.observe(storage, { kind: 'turn', text: M.turnGist(words), via }, t);
const fresh = async () => {
  const s = new Mem();
  await s.put('owner:ctx', { tz: TZ });
  return s;
};

test('a promise in his own words is kept with its day, nudged once at 9 that morning, and his "I sent…" closes the next one', async () => {
  const storage = await fresh();
  await say(storage, "I'll send Jo the photos tomorrow, can you find me a good app for it?", NOW);
  await say(storage, 'I need to call the dentist', NOW + 60_000, 'telegram');
  await say(storage, 'can you remind me to call dad at 5', NOW + 120_000);
  await say(storage, 'I need to know how photosynthesis works', NOW + 180_000);
  const items = await K.loadKeep(storage);
  const p = items.filter((x) => x.kind === 'promise');
  assert.deepEqual(p.map((x) => x.what), ['send Jo the photos', 'call the dentist'], 'only his own promises: a reminder request and a question are not');
  assert.equal(p[0].due, 'tomorrow');
  assert.equal(p[0].remindAt, Date.parse('2026-11-13T09:00:00Z'), 'Friday 9 am in London');
  assert.equal(p[1].remindAt, Date.parse('2026-11-14T09:00:00Z'), 'no day: two days later at 9');
  assert.equal(p[1].via, 'telegram');
  const notes = [];
  let now = Date.parse('2026-11-13T08:30:00Z');
  const d = { storage, notify: async (n) => void notes.push(n), now: () => now };
  assert.deepEqual(await K.keepTick(d), [], 'not before its morning');
  now = Date.parse('2026-11-13T09:05:00Z');
  const told = await K.keepTick(d);
  assert.deepEqual(told, ['You said you\'d send Jo the photos by tomorrow. Done? Say "I did" or tap DONE in Memory.']);
  assert.equal(notes[0].title, 'Your word');
  now += H;
  assert.deepEqual(await K.keepTick(d), [], 'told once');
  await say(storage, 'I sent Jo the photos', now);
  const after = await K.loadKeep(storage);
  assert.equal(after.find((x) => x.what === 'send Jo the photos').state, 'done');
  assert.equal(after.find((x) => x.what === 'call the dentist').state, 'open', 'the other stays open');
});

test('where he put things (the newest place wins) and why he chose: kept, and the recall tool answers them', async () => {
  const storage = await fresh();
  await say(storage, 'the spare key is in the blue tin', NOW);
  await say(storage, 'I picked the canal flat because it is quieter and closer to work', NOW + 1000);
  await say(storage, 'actually the spare key is under the mat now', NOW + 2000);
  await say(storage, 'the meeting is in the morning', NOW + 3000);
  const items = await K.loadKeep(storage);
  const where = items.filter((x) => x.kind === 'where');
  assert.equal(where.length, 1, 'one thing, one place: "the meeting is in the morning" is no place');
  assert.equal(where[0].detail, 'under the mat');
  const tool = T.memoryTools.find((t) => t.name === 'recall');
  const RealNow = Date.now;
  Date.now = () => NOW + 5000;
  try {
    assert.match(await tool.run({ about: 'spare key' }, { storage }), /^He said the spare key is under the mat\./);
    assert.match(await tool.run({ about: 'why did I pick the canal flat' }, { storage }), /^He chose the canal flat because it is quieter and closer to work\./);
    await say(storage, "I'll book the car in for its MOT next week", NOW + 6000);
    assert.match(await tool.run({ about: 'what did I promise' }, { storage }), /^He said he'd: book the car in for its MOT \(next week\)\./);
  } finally {
    Date.now = RealNow;
  }
});

test('the routes: DONE, LET GO, SNOOZE, PIN, FORGET with UNDO, and his words added from the phone', async () => {
  const storage = await fresh();
  const call = async (b) => (await K.keepRoute(new Request('https://x/profile/keep', { method: 'POST', body: JSON.stringify(b) }), '/profile/keep', 'POST', storage)).json();
  const added = await call({ op: 'add', text: 'I put my passport in the top drawer' });
  assert.equal(added.added[0].kind, 'where');
  assert.equal(added.added[0].via, 'phone');
  await say(storage, "I'll pay the gas bill tonight", NOW);
  const id = (await K.loadKeep(storage)).find((x) => x.kind === 'promise').id;
  assert.equal((await call({ op: 'done', id })).item.state, 'done');
  assert.equal((await call({ op: 'reopen', id })).item.state, 'open');
  assert.equal((await call({ op: 'drop', id })).item.state, 'dropped');
  assert.equal((await call({ op: 'pin', id })).item.pinned, true);
  assert.equal((await call({ op: 'forget', id })).items.some((x) => x.id === id), false);
  assert.equal((await call({ op: 'restore', id })).items.some((x) => x.id === id), true, 'UNDO');
  const got = await (await K.keepRoute(new Request('https://x/profile/keep'), '/profile/keep', 'GET', storage)).json();
  assert.ok(Array.isArray(got.items) && Array.isArray(got.lines) && got.week);
});

test('the Sunday card: what he asked about most, what he finished, what is still open, what never got an answer; once, from 6 pm', async () => {
  const storage = await fresh();
  // Monday 9 Nov to Sunday 15 Nov 2026
  const mon = Date.parse('2026-11-09T09:00:00Z');
  await say(storage, 'what are the trains to Leeds on Friday', mon);
  await say(storage, 'are there cheaper trains to Leeds after 10', mon + D);
  await say(storage, "I'll book the hotel in Leeds", mon + D + 1000);
  await say(storage, 'how do I fix a squeaky door', mon + 2 * D);
  await say(storage, "I'll ring the garage on Friday", mon + 2 * D + 1000);
  await say(storage, 'I booked the hotel in Leeds', mon + 3 * D);
  await storage.put('turns', [{ role: 'user', text: 'how do I fix a squeaky door', at: mon + 2 * D }, { role: 'assistant', text: "I couldn't find anything useful on that.", at: mon + 2 * D + 3000 }]);
  const sun = Date.parse('2026-11-15T17:30:00Z');
  const w = await K.weekReview(storage, sun, TZ);
  assert.deepEqual(w.topics.map((t) => t.word), ['leeds', 'hotel', 'trains'], 'most first; never a weekday');
  assert.deepEqual(w.finished, ['book the hotel in Leeds']);
  assert.deepEqual(w.open, ['ring the garage (Friday)']);
  assert.deepEqual(w.unanswered.map((x) => x.q), ['how do I fix a squeaky door']);
  const lines = S.weekLines(w);
  assert.match(lines[0], /^You asked me 6 things this week, most about leeds, hotel and trains\.$/);
  assert.equal(lines[1], 'You finished: book the hotel in Leeds.');
  assert.equal(lines[2], 'Still open: ring the garage (Friday).');
  const notes = [];
  let now = sun;
  const d = { storage, notify: async (n) => void notes.push(n), now: () => now };
  await K.keepTick(d);
  assert.ok(!notes.some((n) => n.title === 'Your week'), 'not before 6 pm');
  now = Date.parse('2026-11-15T18:05:00Z');
  await K.keepTick(d);
  now += H;
  await K.keepTick(d);
  assert.equal(notes.filter((n) => n.title === 'Your week').length, 1, 'once');
});

test('dates in his words, and the asks: "last March", "on the 3rd", "where\'s…", "why did I…", "what did I say I\'d do"', () => {
  const now = Date.parse('2026-11-14T02:00:00Z');
  const s = S.dateSpan('what did I ask last March about the car', now, TZ);
  assert.equal(new Date(s.from).toISOString(), '2026-03-01T00:00:00.000Z');
  assert.equal(s.rest, 'what did I ask about the car');
  assert.equal(new Date(S.dateSpan('on the 3rd', now, TZ).from).toISOString(), '2026-11-03T00:00:00.000Z');
  assert.equal(new Date(S.dateSpan('the 3rd of November', now, TZ).from).toISOString(), '2026-11-03T00:00:00.000Z');
  assert.equal(S.whereAsked("where's the spare key?"), 'spare key');
  assert.equal(S.whereAsked('where is the nearest station'), null);
  assert.equal(S.whyAsked('why did I pick the canal flat?'), 'the canal flat');
  assert.ok(S.promisesAsked("what did I say I'd do?"));
  assert.equal(S.dayAsked('what was I doing on the 3rd?'), 'on the 3rd');
  assert.equal(S.promiseIn("I'll be honest, it was rubbish"), null);
  assert.equal(S.promiseIn('what should I cook tonight?'), null);
});

test('nothing in the keep code imports the camera, faces, the speaker or a place feed; a promise holds only his sentence', async () => {
  for (const f of ['../src/keep.ts', '../../../packages/shared/src/keep.ts']) {
    const src = readFileSync(at(f), 'utf8');
    for (const m of src.matchAll(/from '([^']+)'/g)) assert.ok(!/vision|faces?\b|speaker|voiceprint|camera|places|location/i.test(m[1]), `${f} imports ${m[1]}`);
  }
  const storage = await fresh();
  await say(storage, "I'll send Jo the photos", NOW);
  assert.deepEqual(Object.keys((await K.loadKeep(storage))[0]).sort(), ['at', 'id', 'kind', 'remindAt', 'state', 'text', 'via', 'what']);
});
