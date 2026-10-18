// Memory and agenda on the device while the brain's database is paused: shown with queued
// changes on top, sent in order when it's back, nothing lost, nothing sent twice.
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;
const O = await import('./.build/offline.mjs');
// Like brain.ts: keep a change for later unless the brain clearly refused it (a 4xx).
const paused = (e) => /paused/.test(String(e?.message)) || !(e?.status >= 400 && e.status < 500);

const fakeBrain = () => {
  const calls = [];
  let isPaused = false;
  const api = {};
  for (const k of ['addMemory', 'forget', 'addEvent', 'deleteEvent', 'addJob', 'deleteJob', 'addTurns']) {
    api[k] = async (x) => {
      if (isPaused) throw new Error('memory paused');
      if (x === 'gone') throw Object.assign(new Error('not found'), { status: 404 });
      if (x === 'busy') throw Object.assign(new Error('server error'), { status: 500 });
      calls.push([k, x]);
    };
  }
  return { api, calls, pause: (v) => (isPaused = v) };
};

test('changes made while paused show at once, on top of the copy kept on the device', () => {
  O.offline.set({ memory: [{ id: 'f1', text: 'Lives in Birmingham', at: 1 }, { id: 'f2', text: 'Likes jazz', at: 2 }], outbox: [] });
  O.enqueue({ kind: 'addMemory', text: 'Has a dog called Rex' });
  O.enqueue({ kind: 'forget', factId: 'f2' });
  const facts = O.factsWithOutbox(O.offline.get().memory).map((f) => f.text);
  assert.deepEqual(facts, ['Lives in Birmingham', 'Has a dog called Rex']);
  // deleting something that only exists here just drops it from the queue
  const local = O.factsWithOutbox(O.offline.get().memory).find((f) => f.text === 'Has a dog called Rex');
  O.enqueue({ kind: 'forget', factId: local.id });
  assert.equal(O.offline.get().outbox.length, 1, 'only the forget of f2 is left');
  const ctx = O.offlineContext();
  assert.deepEqual(ctx.facts, ['Lives in Birmingham']);
});

test('the agenda copy includes events and reminders added while paused', () => {
  O.offline.set({ agenda: { tz: 'Europe/London', events: [], errors: [], jobs: [], feeds: [] }, outbox: [] });
  const soon = Date.now() + 3600_000;
  O.enqueue({ kind: 'addEvent', event: { title: 'Dinner with Sam', start: soon } });
  O.enqueue({ kind: 'addJob', job: { kind: 'reminder', text: 'stretch', at: soon, repeat: 'none' } });
  const a = O.agendaWithOutbox(O.offline.get().agenda);
  assert.equal(a.events[0].title, 'Dinner with Sam');
  assert.equal(a.jobs[0].text, 'stretch');
  assert.ok(O.offlineContext().agenda.some((l) => /Dinner with Sam/.test(l)));
  return O.flushOutbox(fakeBrain().api, paused); // sends them (and clears the reminder's timer)
});

test('the queue is sent in order when the brain is back; stops while still paused; refused changes are dropped', async () => {
  O.offline.set({ outbox: [] });
  O.enqueue({ kind: 'addMemory', text: 'A' });
  O.enqueue({ kind: 'deleteEvent', eventId: 'gone' });
  O.enqueue({ kind: 'addMemory', text: 'B' });
  const b = fakeBrain();
  b.pause(true);
  assert.equal(await O.flushOutbox(b.api, paused), 0);
  assert.equal(O.offline.get().outbox.length, 3, 'nothing lost while paused');
  b.pause(false);
  assert.equal(await O.flushOutbox(b.api, paused), 2);
  assert.deepEqual(b.calls, [['addMemory', 'A'], ['addMemory', 'B']], 'in order; the refused delete was dropped');
  assert.equal(O.offline.get().outbox.length, 0);
});

test('a server error or sign-in problem keeps the queue for the next try', async () => {
  O.offline.set({ outbox: [] });
  O.enqueue({ kind: 'forget', factId: 'busy' });
  O.enqueue({ kind: 'addMemory', text: 'C' });
  const b = fakeBrain();
  assert.equal(await O.flushOutbox(b.api, paused), 0);
  assert.equal(O.offline.get().outbox.length, 2, 'nothing dropped on a 500');
  O.offline.set({ outbox: [] });
});

test('a reminder whose time passed without ringing on the device is still sent to the brain', async () => {
  O.offline.set({ outbox: [] }); // no ringer yet: as if Ghosty was closed at that moment
  O.enqueue({ kind: 'addJob', job: { kind: 'reminder', text: 'missed', at: Date.now() - 60_000, repeat: 'none' } });
  const b = fakeBrain();
  await O.flushOutbox(b.api, paused);
  assert.deepEqual(b.calls.map((c) => c[1].text), ['missed']);
});

test('reminders set while paused go off from the device, missed ones once on load, and are not set again', async () => {
  O.offline.set({ outbox: [] });
  O.enqueue({ kind: 'addJob', job: { kind: 'reminder', text: 'missed while closed', at: Date.now() - 3 * 3600_000, repeat: 'none' } });
  const rang = [];
  O.onLocalReminder((title, text) => rang.push(text)); // Ghosty opens
  O.enqueue({ kind: 'addJob', job: { kind: 'reminder', text: 'take the bins out', at: Date.now() + 30, repeat: 'none' } });
  O.enqueue({ kind: 'addJob', job: { kind: 'reminder', text: 'later', at: Date.now() + 3600_000, repeat: 'none' } });
  await new Promise((r) => setTimeout(r, 120));
  assert.deepEqual(rang, ['missed while closed', 'take the bins out']);
  const b = fakeBrain();
  await O.flushOutbox(b.api, paused);
  assert.deepEqual(b.calls.map((c) => c[1].text), ['later'], 'the ones that rang here are not set again');
});

test('the conversation had while paused is sent to the brain afterwards', async () => {
  O.offline.set({ outbox: [] });
  O.enqueue({ kind: 'addTurns', turns: [{ role: 'user', text: 'hi', at: 1 }, { role: 'assistant', text: 'hello', at: 2 }] });
  const b = fakeBrain();
  await O.flushOutbox(b.api, paused);
  assert.deepEqual(b.calls, [['addTurns', [{ role: 'user', text: 'hi', at: 1 }, { role: 'assistant', text: 'hello', at: 2 }]]]);
});

test("while paused, the brain's own reminders ring from the device, and one-offs are then cleared from it", async () => {
  const rang = [];
  O.onLocalReminder((title, text) => rang.push(text));
  O.offline.set({ outbox: [], agenda: { tz: 'UTC', events: [], errors: [], feeds: [], jobs: [
    { id: 'j1', kind: 'reminder', title: 'Bins', text: 'take the bins out', next: Date.now() + 30, repeat: 'none', tz: 'UTC' },
    { id: 'j2', kind: 'reminder', title: 'Pills', text: 'take your pills', next: Date.now() + 40, repeat: 'daily', tz: 'UTC' },
    { id: 'j3', kind: 'task', title: 'Report', text: 'write report', next: Date.now() + 30, repeat: 'none', tz: 'UTC' },
    { id: 'j4', kind: 'reminder', title: 'Old', text: 'long gone', next: Date.now() - 3600_000, repeat: 'none', tz: 'UTC' },
  ] } });
  O.armBrainReminders(true);
  await new Promise((r) => setTimeout(r, 150));
  assert.deepEqual(rang.sort(), ['take the bins out', 'take your pills']);
  assert.deepEqual(O.offline.get().outbox.map((o) => [o.kind, o.jobId]), [['deleteJob', 'j1']], 'the one-off is cleared from the brain later');
  O.armBrainReminders(false);
  O.offline.set({ outbox: [] });
});

// ---------------------------------------------------------------------------------------
// RESTORE from the phone's backup (apps/web/src/features/system/merge.ts): joined with what is on
// the phone, newer wins, nothing wiped.
// ---------------------------------------------------------------------------------------
import { build } from 'esbuild';

await build({ entryPoints: [new URL('../../web/src/features/system/merge.ts', import.meta.url).pathname], bundle: true, format: 'esm', platform: 'neutral', outfile: new URL('./.build/backup-merge.mjs', import.meta.url).pathname, logLevel: 'warning' });
const MG = await import('./.build/backup-merge.mjs');

test('restore merge: an empty phone gets the backup; a phone with data keeps it and gains what it lacks, newer item winning', () => {
  const bak = { cards: [{ id: 'a', front: 'old A', last: 100 }, { id: 'b', front: 'B', last: 50 }], courses: [{ id: 'c1', title: 'Bridges' }], streak: { days: 9 }, synced: 1 };
  assert.deepEqual(MG.mergeEntry(null, JSON.stringify(bak)), { text: JSON.stringify(bak), result: 'restored' });
  const cur = { cards: [{ id: 'a', front: 'new A', last: 200 }, { id: 'c', front: 'C', last: 10 }], courses: [], streak: { days: 2 }, synced: 5 };
  const m = MG.mergeEntry(JSON.stringify(cur), JSON.stringify(bak));
  assert.equal(m.result, 'merged');
  const out = JSON.parse(m.text);
  assert.deepEqual(out.cards.map((c) => `${c.id}:${c.front}`), ['a:new A', 'c:C', 'b:B'], 'the phone\'s newer card stays; the backup\'s missing card comes back');
  assert.deepEqual(out.courses, bak.courses, 'an empty list on the phone takes the backup\'s');
  assert.equal(out.streak.days, 2, 'plain values stay as the phone has them');
  assert.equal(out.synced, 5);
  // The backup's copy is newer: it wins.
  const newer = JSON.parse(MG.mergeEntry(JSON.stringify({ cards: [{ id: 'a', front: 'A', last: 1 }] }), JSON.stringify({ cards: [{ id: 'a', front: 'A2', last: 9 }] })).text);
  assert.equal(newer.cards[0].front, 'A2');
});

test('restore merge: whole entries (a room plan, settings) and plain text keep the phone\'s; timed lists join in time order', () => {
  const plan = JSON.stringify({ plan: { items: [{ id: 'sofa' }] } });
  assert.deepEqual(MG.mergeEntry(plan, JSON.stringify({ plan: { items: [{ id: 'bed' }] } }), true), { text: plan, result: 'same' });
  assert.deepEqual(MG.mergeEntry(null, plan, true).result, 'restored');
  assert.deepEqual(MG.mergeEntry('fr', 'de'), { text: 'fr', result: 'same' });
  const chat = (xs) => JSON.stringify({ entries: xs.map(([at, text]) => ({ kind: 'user', text, at })) });
  const joined = JSON.parse(MG.mergeEntry(chat([[3, 'three'], [4, 'four']]), chat([[1, 'one'], [3, 'three']])).text);
  assert.deepEqual(joined.entries.map((e) => e.text), ['one', 'three', 'four'], 'once each, oldest first');
  assert.equal(MG.mergeEntry(chat([[1, 'one']]), chat([[1, 'one']])).result, 'same');
});
