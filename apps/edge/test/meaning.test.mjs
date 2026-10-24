// SEARCH BY MEANING on the phone (packages/shared/src/meaning.ts, apps/web/src/library/idle.ts and local.ts):
// the blended ranking (a passage that means the question beats one that only shares a word; a title named
// exactly still wins; with no question vector, or any passage without its vector, it is the keyword ranking as
// before), vectors kept as int8 with a scale (388 bytes, the cosine kept), the background indexer's timetable
// on a fake clock (batches, rests for the screen, waits while hidden, a stop and a resume that redoes nothing),
// and the index beside the library copy (filled, counted, dropped with its document, never kept for changed text).
// (Run from library-local.test.mjs, which is in the test list; package.json is protected.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({
  entryPoints: { meaning: at('../../../packages/shared/src/meaning.ts'), idle: at('../../web/src/library/idle.ts'), local: at('../../web/src/library/local.ts') },
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outdir: at('./.build/meaning'),
  outExtension: { '.js': '.mjs' },
  logLevel: 'warning',
});
const M = await import('./.build/meaning/meaning.mjs');
const I = await import('./.build/meaning/idle.mjs');
const L = await import('./.build/meaning/local.mjs');

// A tiny deterministic embedder: a few "concepts" (botany, cooking, computing) and nothing else, so what a text is
// about decides its direction. "food" leans to cooking and a little to botany.
const CONCEPTS = [
  ['plant', 'leaf', 'leaves', 'photosynth', 'chlorophyll', 'sunlight', 'glucose', 'garden', 'grow'],
  ['food', 'cook', 'recipe', 'pancake', 'flour', 'egg', 'batter', 'oven', 'meal'],
  ['search', 'binary', 'sort', 'array', 'algorithm', 'code', 'list'],
];
const fakeVec = (text) => {
  const low = text.toLowerCase();
  const v = CONCEPTS.map((words) => words.filter((w) => low.includes(w)).length);
  if (/\bfood\b/.test(low)) v[0] += 0.6;
  v.push(0.25); // every English text shares a little
  return v;
};

test('the blended ranking: meaning beats a keyword miss; an exact title still wins; keywords alone are the old ranking', () => {
  // "how do plants make food": the photosynthesis passage has none of its words but means it; the other shares one word.
  const meaningOnly = { id: 'photo', words: 0, matched: false, exact: false, cos: 0.8 };
  const oneWord = { id: 'fooddrive', words: 0.5, matched: false, exact: false, cos: 0.3 };
  const bothWordsOffTopic = { id: 'menu', words: 1, matched: true, exact: false, cos: 0.3 };
  let r = M.rank([oneWord, bothWordsOffTopic, meaningOnly], 3, 'meaning');
  assert.equal(r[0].id, 'photo', 'meaning beats the passages that only share words');
  assert.deepEqual(r.map((x) => x.id), ['photo', 'menu'], 'one shared word and far in meaning is not a hit');
  // By keywords alone the passage that means it is never found (what the phone did before).
  r = M.rank([oneWord, bothWordsOffTopic, meaningOnly], 3, 'keywords');
  assert.deepEqual(r.map((x) => x.id), ['menu']);
  // A title named exactly wins over a passage closer in meaning; an exact name in the text beats a near neighbour.
  const titled = { id: 'titled', words: 1, matched: true, exact: true, cos: 0.5 };
  const closer = { id: 'closer', words: 0, matched: false, exact: false, cos: 0.9 };
  assert.equal(M.rank([closer, titled], 2, 'meaning')[0].id, 'titled');
  const named = { id: 'named', words: 1, matched: true, exact: false, cos: 0.45 };
  const neighbour = { id: 'neighbour', words: 0, matched: false, exact: false, cos: 0.7 };
  assert.equal(M.rank([neighbour, named], 2, 'meaning')[0].id, 'named');
  // The exact-title check: whole words, five letters or more.
  assert.equal(M.exactTitle('what is binary search?', 'Binary search'), true);
  assert.equal(M.exactTitle('binary searching', 'Binary search'), false);
  assert.equal(M.exactTitle('my notes on cats', 'Notes'), true);
  assert.equal(M.exactTitle('the cat sat', 'Cat'), false);
  // The words part is the keyword search the phone always had.
  const w = M.wordMatcher('how do plants make food');
  assert.deepEqual(M.queryTerms('how do plants make food'), ['plants', 'food']);
  assert.deepEqual(w('green leaves turn sunlight into glucose'), { words: 0, matched: false });
  assert.deepEqual(w('plant food from the garden centre'), { words: 1, matched: true });
  // Two lists taking turns, each passage once.
  const a = [{ doc: 'a', text: 'one' }, { doc: 'b', text: 'two' }];
  const b = [{ doc: 'b', text: 'two' }, { doc: 'c', text: 'three' }];
  assert.deepEqual(M.interleave(a, b, 5).map((x) => x.doc), ['a', 'b', 'c']);
});

test('vectors kept as int8 with a scale: 388 bytes a passage, and the cosine stays the same', () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const v = Array.from({ length: 384 }, rnd);
  const u = M.normalise(v);
  const { q, s } = M.quantise(v);
  assert.ok(q instanceof Int8Array && q.length === 384);
  assert.ok(Math.max(...q.map(Math.abs)) === 127, 'the largest number uses the whole range');
  const back = M.dequantise(q, s);
  const err = Math.max(...back.map((x, i) => Math.abs(x - u[i])));
  assert.ok(err <= s / 2 + 1e-7, `round trip within half a step (${err})`);
  const w = M.normalise(Array.from({ length: 384 }, rnd));
  const exact = w.reduce((n, x, i) => n + x * u[i], 0);
  assert.ok(Math.abs(M.cosine(w, q) - exact) < 0.005, `cosine ${M.cosine(w, q)} vs ${exact}`);
  assert.ok(Math.abs(M.cosine(u, q) - 1) < 0.001);
  assert.equal(M.bytesPerVector(384), 388);
  assert.equal(M.bytesPerVector(384) * 8556, 3_319_728, 'the whole index for 8,556 passages: about 3.3 MB');
  assert.equal(M.cosine([1, 0], new Int8Array(3)), 0, 'different lengths count as unrelated');
});

test('the indexer: small batches, a rest for the screen, waits while hidden, and a stop then resume redoes nothing', async () => {
  let clock = 0;
  const keys = Array.from({ length: 50 }, (_, i) => i);
  const kept = new Set();
  const embedded = [];
  let hidden = false;
  const sleeps = [];
  const deps = (over = {}) => ({
    next: async (after, n) => {
      const rest = keys.filter((k) => (after === null || k > after) && !kept.has(k));
      const items = rest.slice(0, n).map((k) => ({ key: k, text: `passage ${k}` }));
      return { items, last: items.length ? items.at(-1).key : after };
    },
    embed: async (texts) => {
      clock += 40 * texts.length; // 40 ms a passage on the fake clock
      embedded.push(...texts);
      return texts.map(() => [1, 0]);
    },
    save: async (items) => {
      items.forEach((x) => kept.add(x.key));
      return items.length;
    },
    canRun: () => !hidden,
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
      if (hidden && sleeps.filter((x) => x === 2000).length >= 3) hidden = false; // back in sight after three waits
    },
    now: () => clock,
    batch: 4,
    sliceMs: 300,
    restMs: 100,
    pauseMs: 2000,
    ...over,
  });
  // Hidden at the start: it waits (three times here), then works in batches of four, resting every 300 ms.
  hidden = true;
  const stop = new AbortController();
  let progress = 0;
  const first = I.runIndex(deps({ signal: stop.signal, onProgress: (k) => (progress = k) && k >= 20 && stop.abort() }));
  const r1 = await first;
  assert.equal(r1.pauses, 3, 'waited while hidden');
  assert.equal(r1.done, false, 'stopped, not finished');
  assert.equal(r1.kept, 20);
  assert.equal(r1.batches, 5);
  assert.equal(progress, 20);
  // 4 passages × 40 ms = 160 ms a batch: a rest after every second batch (320 ms ≥ 300 ms).
  assert.equal(sleeps.filter((x) => x === 100).length, 2, `rests: ${sleeps.join(',')}`);
  assert.equal(r1.after, 19, 'it says where it stopped');
  // Resumed from there: the rest, each passage once.
  const r2 = await I.runIndex(deps({ after: r1.after }));
  assert.equal(r2.done, true);
  assert.equal(r2.kept, 30);
  assert.equal(kept.size, 50);
  assert.equal(new Set(embedded).size, embedded.length, 'no passage was worked out twice');
  // Nothing left: one look, no work.
  const r3 = await I.runIndex(deps());
  assert.deepEqual([r3.done, r3.kept, r3.batches], [true, 0, 0]);
});

/** Give every passage on the device its vector, as the background indexer does. */
async function indexAll() {
  let after = null;
  for (;;) {
    const { items, last } = await L.unindexed(after, 3);
    if (!items.length) return;
    await L.saveVectors(items, items.map((x) => fakeVec(x.text)));
    after = last;
  }
}

test('the library on the phone, by meaning: "how do plants make food" finds photosynthesis; fallbacks say keywords', async () => {
  L._reset();
  await L.keepDoc({ title: 'Leaf chemistry', source: 'typed in', kind: 'notes', pages: 0 }, [{ text: 'Photosynthesis: green leaves catch sunlight with chlorophyll and turn carbon dioxide and water into glucose and oxygen.' }]);
  await L.keepDoc({ title: 'Breakfast', source: 'typed in', kind: 'notes', pages: 0 }, [{ text: 'Whisk two eggs with 100 g flour and 300 ml milk; rest the batter for 20 minutes.' }]);
  await L.keepDoc({ title: 'Binary search', source: 'typed in', kind: 'notes', pages: 0 }, [{ text: 'Halve a sorted array each step: compare the middle and keep the half that can hold the target.' }, { text: 'Edge cases: an empty list, one element, the target at either end.' }]);
  // Before any vectors: the keyword search finds nothing for the question (none of its words are there).
  assert.deepEqual(await L.indexCounts(), { indexed: 0, total: 4 });
  assert.equal((await L.searchLocal('how do plants make food')).length, 0);
  // The question's vector is there but the index is not whole: keywords, and it says so.
  L.setQueryEmbedder({ ready: () => true, vector: async (q) => M.normalise(fakeVec(q)) });
  let r = await L.searchLocalHow('how do plants make food');
  assert.deepEqual([r.how, r.hits.length], ['keywords', 0]);
  // Indexed in small steps, every passage once.
  const first = await L.unindexed(null, 3);
  assert.equal(first.items.length, 3);
  assert.ok(first.items.every((x) => /^(Leaf chemistry|Breakfast|Binary search)\n/.test(x.text)), 'the model reads the title with the passage');
  await indexAll();
  assert.deepEqual(await L.indexCounts(), { indexed: 4, total: 4 });
  // By meaning: the photosynthesis passage, first.
  r = await L.searchLocalHow('how do plants make food');
  assert.equal(r.how, 'meaning');
  assert.equal(r.hits[0]?.title, 'Leaf chemistry');
  assert.match(r.hits[0].text, /Photosynthesis/);
  assert.ok(!r.hits.some((h) => h.title === 'Binary search'), 'unrelated passages are left out');
  // An exact title still wins.
  r = await L.searchLocalHow('binary search');
  assert.equal(r.hits[0].title, 'Binary search');
  // passagesFor uses meaning only when the model is in memory (it is never loaded for it).
  let loads = 0;
  L.setQueryEmbedder({ ready: () => true, vector: async (q, load) => (load ? (loads++, M.normalise(fakeVec(q))) : null) });
  assert.equal((await L.passagesFor('how do plants make food')).length, 0);
  assert.equal(loads, 0);
  assert.match((await L.passagesFor('how do plants make food', { load: true }))[0].text, /Photosynthesis/);
  // The model off: keywords.
  L.setQueryEmbedder(null);
  r = await L.searchLocalHow('how do plants make food');
  assert.deepEqual([r.how, r.hits.length], ['keywords', 0]);
  assert.equal((await L.searchLocalHow('rest the batter')).hits[0].title, 'Breakfast');
});

test('the index beside the library copy: a new passage needs its vector, a removed document takes its vectors, changed text is never given an old vector', async () => {
  L._reset();
  let told = 0;
  L.onLibraryChange(() => told++);
  const a = await L.keepDoc({ title: 'Kettles', source: 'x', kind: 'notes', pages: 0 }, [{ text: 'Descale a kettle with citric acid.' }]);
  const b = await L.keepDoc({ title: 'Pancakes', source: 'x', kind: 'notes', pages: 0 }, [{ text: 'Rest the batter.' }]);
  assert.ok(told >= 2, 'the index hears of new documents');
  await indexAll();
  assert.deepEqual(await L.indexCounts(), { indexed: 2, total: 2 });
  // Read for indexing, then the text changes before the vector is kept: the vector is not kept.
  await L.removeDoc(b.id);
  const c = await L.keepDoc({ title: 'Pancakes', source: 'x', kind: 'notes', pages: 0 }, [{ text: 'Rest the batter for 20 minutes.' }]);
  const stale = await L.unindexed(null, 5);
  assert.equal(stale.items.length, 1);
  assert.equal(await L.saveVectors([{ ...stale.items[0], raw: 'Rest the batter.' }], [fakeVec('x')]), 0);
  assert.equal(await L.saveVectors(stale.items, [fakeVec(stale.items[0].text)]), 1);
  assert.deepEqual(await L.indexCounts(), { indexed: 2, total: 2 });
  // Removed: its vectors go too.
  await L.removeDoc(a.id);
  assert.deepEqual(await L.indexCounts(), { indexed: 1, total: 1 });
  assert.equal((await L.unindexed(null, 5)).items.length, 0);
  assert.ok(c.id);
});
