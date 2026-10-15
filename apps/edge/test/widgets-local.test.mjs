// Widgets kept on the device while the brain's database was paused: new ones and changed
// ones are saved when it's back, deletions made meanwhile are carried out, nothing is lost.
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis; // the store's save timer
const W = await import('./.build/widgets.mjs');

const brain = (list) => {
  const store = new Map(list.map((w) => [w.name, w]));
  return {
    store,
    paused: false,
    api: {
      save: async (w) => { if (api.paused) throw new Error('memory paused'); store.set(w.name, w); },
      remove: async (n) => { if (api.paused) throw new Error('memory paused'); store.delete(n); },
    },
  };
};
let api;

test('a widget changed while paused replaces the brain\'s older version (not dropped)', async () => {
  const b = brain([{ name: 'merge', title: 'Merge', html: '<h1>v1</h1>', at: 1 }]);
  api = b;
  W.keepWidget({ name: 'merge', title: 'Merge', html: '<h1>v2</h1>', at: 2 }, false);
  // while paused the Workshop shows the new version, not the brain's
  assert.equal(W.mergeWidgets([...b.store.values()]).find((w) => w.name === 'merge').html, '<h1>v2</h1>');
  assert.deepEqual(await W.syncLocalWidgets([...b.store.values()], b.api), { saved: 1, removed: 0 });
  assert.equal(b.store.get('merge').html, '<h1>v2</h1>');
  assert.deepEqual(await W.syncLocalWidgets([...b.store.values()], b.api), { saved: 0, removed: 0 }, 'nothing left to save');
});

test('a deletion made while paused is carried out when the brain is back', async () => {
  const b = brain([{ name: 'clock', title: 'Clock', html: '<h1>1</h1>', at: 1 }]);
  api = b;
  W.forgetWidget('clock', true);
  assert.ok(!W.mergeWidgets([...b.store.values()]).some((w) => w.name === 'clock'), 'hidden meanwhile');
  b.paused = true;
  await W.syncLocalWidgets([...b.store.values()], b.api);
  assert.ok(b.store.has('clock'), 'still paused: kept for later');
  b.paused = false;
  assert.deepEqual(await W.syncLocalWidgets([...b.store.values()], b.api), { saved: 0, removed: 1 }, 'reported, so the Workshop re-fetches');
  assert.ok(!b.store.has('clock'), 'deleted in the brain');
  assert.deepEqual(W.localWidgets.get().deleted, []);
});

test('a widget built while paused is saved once the brain is back; failures retry later', async () => {
  const b = brain([]);
  api = b;
  W.keepWidget({ name: 'snake', title: 'Snake', html: '<canvas></canvas>', at: 3 }, false);
  b.paused = true;
  assert.deepEqual(await W.syncLocalWidgets([], b.api), { saved: 0, removed: 0 });
  b.paused = false;
  assert.deepEqual(await W.syncLocalWidgets([], b.api), { saved: 1, removed: 0 });
  assert.ok(b.store.has('snake'));
});
