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

test('a document being uploaded right now, or a sync already running, is not uploaded twice', async () => {
  L._reset();
  const d = await L.keepDoc({ title: 'C', source: 'c.txt', kind: 'notes', pages: 0 }, [{ text: 'gamma' }]);
  const sent = [];
  let release;
  const slow = new Promise((r) => (release = r));
  const api = {
    upload: async (x) => {
      sent.push(x.title);
      await slow;
      return { id: `brain-${x.title}` };
    },
    remove: async () => undefined,
  };
  L.uploading.add(d.id);
  assert.equal(await L.syncLocalDocs(api), 0, 'left alone while the Library tab sends it');
  L.uploading.delete(d.id);
  const first = L.syncLocalDocs(api);
  assert.equal(await L.syncLocalDocs(api), 0, 'a second sync while one runs does nothing');
  release();
  assert.equal(await first, 1);
  assert.deepEqual(sent, ['C']);
});

test("Ghosty's whole library is copied to the device, kept current, and answers with no connection", async () => {
  L._reset();
  const brain = {
    docs: [
      { id: 'b1', title: 'Orbital mechanics', source: 'book.pdf', kind: 'pdf', pages: 3, passages: 3, chars: 90, status: 'ready', builtin: false, at: 1 },
      { id: 'b2', title: 'Starter: algorithms', source: 'built in', kind: 'notes', pages: 0, passages: 1, chars: 40, status: 'ready', builtin: true, at: 0 },
      { id: 'b3', title: 'Half added', source: 'x', kind: 'notes', pages: 0, passages: 0, chars: 0, status: 'adding', builtin: false, at: 2 },
    ],
    text: {
      b1: ['The Hohmann transfer uses two engine burns.', 'Escape velocity from Earth is 11.2 km/s.', 'Geostationary orbit is 35,786 km up.'],
      b2: ['Binary search halves the range each step.'],
    },
    reads: 0,
  };
  const api = {
    docs: async () => brain.docs,
    passages: async (id, after) => {
      const all = brain.text[id].map((text, i) => ({ rid: i + 1, text, heading: '', page: i + 1 }));
      const page = all.filter((p) => p.rid > after).slice(0, 2);
      brain.reads += page.length;
      return { passages: page, next: page.length === 2 ? page[1].rid : null };
    },
  };
  assert.deepEqual(await L.mirrorLibrary(api), { copied: 2, dropped: 0, left: 0 });
  assert.match((await L.searchLocal('escape velocity earth'))[0].text, /11\.2 km\/s/);
  const sh = await L.shelf();
  assert.deepEqual(sh.docs.map((d) => d.id).sort(), ['b1', 'b2']);
  assert.equal(sh.stats.passages, 4);

  // Nothing changed: nothing is fetched again.
  const before = brain.reads;
  assert.deepEqual(await L.mirrorLibrary(api), { copied: 0, dropped: 0, left: 0 });
  assert.equal(brain.reads, before);

  // A document grows, another is removed from the brain.
  brain.text.b1.push('Lagrange points are where gravity balances.');
  brain.docs[0] = { ...brain.docs[0], passages: 4, chars: 130 };
  brain.docs.splice(1, 1);
  assert.deepEqual(await L.mirrorLibrary(api), { copied: 1, dropped: 1, left: 0 });
  assert.equal((await L.searchLocal('lagrange points gravity')).length, 1);
  assert.equal((await L.searchLocal('binary search halves')).length, 0);

  const answer = await L.offlineAnswer('how fast is escape velocity from earth');
  assert.match(answer, /no connection/);
  assert.match(answer, /Orbital mechanics/);
  assert.equal(await L.offlineAnswer('quantum chromodynamics gluons'), null);
});

test('a big library is copied a few thousand passages per run, carrying on next time', async () => {
  L._reset();
  const docs = Array.from({ length: 5 }, (_, i) => ({ id: `d${i}`, title: `Doc ${i}`, source: '', kind: 'notes', pages: 0, passages: 3, chars: 30, status: 'ready', builtin: false, at: i }));
  const api = { docs: async () => docs, passages: async () => ({ passages: [1, 2, 3].map((rid) => ({ rid, text: `t${rid}`, heading: '', page: null })), next: null }) };
  assert.deepEqual(await L.mirrorLibrary(api, 6), { copied: 2, dropped: 0, left: 3 });
  assert.deepEqual(await L.mirrorLibrary(api, 6), { copied: 2, dropped: 0, left: 1 });
  assert.deepEqual(await L.mirrorLibrary(api, 6), { copied: 1, dropped: 0, left: 0 });
});

test('the device mirror copies only the new passages of a notebook that grew, and everything of a document that changed', async () => {
  L._reset();
  const calls = [];
  let brain = [{ id: 'notes', title: 'Study log', source: 'ghosty', kind: 'notes', pages: 0, passages: 2, chars: 10, at: 1, status: 'ready' }];
  const pages = { notes: [{ text: 'one' }, { text: 'two' }] };
  const api = {
    docs: async () => brain,
    passages: async (id, after) => {
      calls.push([id, after]);
      const list = pages[id].slice(after);
      return { passages: list, next: null };
    },
  };
  let r = await L.mirrorLibrary(api);
  assert.equal(r.copied, 1);
  assert.deepEqual(calls, [['notes', 0]]);
  // the notebook grew by one passage: only that one is fetched
  pages.notes.push({ text: 'three' });
  brain = [{ ...brain[0], passages: 3, chars: 15 }];
  r = await L.mirrorLibrary(api);
  assert.equal(r.copied, 1);
  assert.deepEqual(calls.at(-1), ['notes', 2]);
  assert.deepEqual((await L.passagesOf('m-notes')).map((p) => p.text), ['one', 'two', 'three']);
  // a document that shrank or was rewritten is copied whole again
  pages.notes = [{ text: 'rewritten' }];
  brain = [{ ...brain[0], passages: 1, chars: 9 }];
  r = await L.mirrorLibrary(api);
  assert.deepEqual(calls.at(-1), ['notes', 0]);
  assert.deepEqual((await L.passagesOf('m-notes')).map((p) => p.text), ['rewritten']);
});
