// Memory and agenda on the device while the brain's database is paused: shown with queued
// changes on top, sent in order when it's back, nothing lost, nothing sent twice.
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;
const O = await import('./.build/offline.mjs');
const paused = (e) => /paused/.test(String(e?.message));

const fakeBrain = () => {
  const calls = [];
  let isPaused = false;
  const api = {};
  for (const k of ['addMemory', 'forget', 'addEvent', 'deleteEvent', 'addJob', 'deleteJob']) {
    api[k] = async (x) => {
      if (isPaused) throw new Error('memory paused');
      if (x === 'gone') throw new Error('not found');
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

test('a one-off reminder that already went off on the device is not set again', async () => {
  O.offline.set({ outbox: [] });
  O.enqueue({ kind: 'addJob', job: { kind: 'reminder', text: 'past', at: Date.now() - 60_000, repeat: 'none' } });
  O.enqueue({ kind: 'addJob', job: { kind: 'reminder', text: 'future', at: Date.now() + 3600_000, repeat: 'none' } });
  const b = fakeBrain();
  await O.flushOutbox(b.api, paused);
  assert.deepEqual(b.calls.map((c) => c[1].text), ['future']);
});

test('reminders set while paused go off from the device', async () => {
  O.offline.set({ outbox: [] });
  const rang = [];
  O.onLocalReminder((title, text) => rang.push(text));
  O.enqueue({ kind: 'addJob', job: { kind: 'reminder', text: 'take the bins out', at: Date.now() + 30, repeat: 'none' } });
  await new Promise((r) => setTimeout(r, 120));
  assert.deepEqual(rang, ['take the bins out']);
});
