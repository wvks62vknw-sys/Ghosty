// The owner's library on their device: documents added there stay searchable while the brain's
// database is paused, ones added meanwhile are uploaded afterwards, removals are carried out.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const L = await import('./.build/library-local.mjs');

test('documents kept on the device are searchable, and the pending ones are listed', async () => {
  L._reset();
  const lease = await L.keepDoc({ title: 'Lease', source: 'lease.pdf', kind: 'pdf', pages: 3 }, [{ text: 'The monthly rent is £950, due on the 1st.', heading: 'Rent', page: 2 }, { text: 'Pets are allowed with permission.' }]);
  const notes = await L.keepDoc({ title: 'Notes', source: 'typed in', kind: 'notes', pages: 0 }, [{ text: 'Bob likes the Italian place on Broad Street.' }]);
  await L.markSynced(notes.id, 'brain-notes');
  const hits = await L.searchLocal('when is the rent due');
  assert.equal(hits[0].title, 'Lease');
  assert.equal(hits[0].page, 2);
  assert.deepEqual((await L.searchLocal('italian place broad street', 8, true)).length, 0, 'only pending docs when asked');
  assert.equal((await L.searchLocal('italian place broad street')).length, 1);
  assert.deepEqual((await L.pendingDocs()).map((d) => d.title), ['Lease']);
  assert.match((await L.passagesFor('rent due'))[0].text, /£950/);
});

test('documents added while paused are uploaded later; removals made while paused are carried out', async () => {
  L._reset();
  const a = await L.keepDoc({ title: 'A', source: 'a.txt', kind: 'notes', pages: 0 }, [{ text: 'alpha' }]);
  const b = await L.keepDoc({ title: 'B', source: 'b.txt', kind: 'notes', pages: 0 }, [{ text: 'beta' }]);
  await L.removeDoc('brain-old', true); // a brain document removed while paused
  assert.ok((await L.removedHere()).has('brain-old'));
  const uploaded = [];
  const removed = [];
  let paused = true;
  const api = {
    upload: async (d) => {
      if (paused) throw new Error('memory paused');
      uploaded.push(d.title);
      return { id: `brain-${d.title}` };
    },
    remove: async (id) => {
      if (paused) throw new Error('memory paused');
      removed.push(id);
    },
  };
  assert.equal(await L.syncLocalDocs(api), 0);
  assert.equal((await L.pendingDocs()).length, 2, 'kept while paused');
  paused = false;
  assert.equal(await L.syncLocalDocs(api), 2);
  assert.deepEqual(uploaded, ['A', 'B']);
  assert.deepEqual(removed, ['brain-old']);
  assert.equal((await L.pendingDocs()).length, 0);
  assert.equal((await L.removedHere()).size, 0);
  assert.equal((await L.searchLocal('alpha'))[0].doc, 'brain-A', 'still searchable here, under the brain id');
  void a;
  void b;
});
