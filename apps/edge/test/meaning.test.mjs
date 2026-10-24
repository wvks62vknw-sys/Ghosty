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
  // Cosines as the real model gives them: the question's background around 0.42 (sd 0.06), answers standing out.
  const sp = { mean: 0.42, sd: 0.06 };
  // "how do plants make food": the photosynthesis passage has none of its words but means it.
  const meaningOnly = { id: 'photo', words: 0, matched: false, exact: false, cos: 0.62 };
  const oneWord = { id: 'fooddrive', words: 0.5, matched: false, exact: false, cos: 0.45 };
  const bothWordsOffTopic = { id: 'menu', words: 1, matched: true, exact: false, cos: 0.42 };
  let r = M.rank([oneWord, bothWordsOffTopic, meaningOnly], 3, 'meaning', sp);
  assert.deepEqual(r.map((x) => x.id), ['photo', 'menu'], 'meaning first; one shared word and nothing in meaning is not a hit');
  // By keywords alone the passage that means it is never found (what the phone did before).
  r = M.rank([oneWord, bothWordsOffTopic, meaningOnly], 3, 'keywords', sp);
  assert.deepEqual(r.map((x) => x.id), ['menu']);
  assert.equal(r[0].score, 1, 'the keyword score is the old one');
  // A title named exactly wins over a passage closer in meaning; a name in the text beats a near neighbour without it.
  const titled = { id: 'titled', words: 1, matched: true, exact: true, cos: 0.5 };
  const closer = { id: 'closer', words: 0, matched: false, exact: false, cos: 0.7 };
  assert.equal(M.rank([closer, titled], 2, 'meaning', sp)[0].id, 'titled');
  const named = { id: 'named', words: 1, matched: true, exact: false, cos: 0.6 };
  const neighbour = { id: 'neighbour', words: 0, matched: false, exact: false, cos: 0.65 };
  assert.equal(M.rank([neighbour, named], 2, 'meaning', sp)[0].id, 'named');
  // Near in absolute terms but not standing out for this question (or the reverse) is not enough on its own.
  assert.equal(M.blendScore({ words: 0, matched: false, exact: false, cos: 0.55 }, { mean: 0.5, sd: 0.06 }), null);
  assert.equal(M.blendScore({ words: 0, matched: false, exact: false, cos: 0.3 }, { mean: 0.1, sd: 0.05 }), null);
  // The spread: a small library leans on the measured prior, a big one on itself; never a zero spread.
  const one = M.spreadOf(1, 0.9, 0.81);
  assert.ok(one.mean < 0.45 && one.sd >= 0.06, JSON.stringify(one));
  const many = M.spreadOf(8000, 8000 * 0.1, 8000 * (0.01 + 0.05 ** 2));
  assert.ok(Math.abs(many.mean - 0.1) < 0.01 && Math.abs(many.sd - 0.05) < 0.01, JSON.stringify(many));
  assert.ok(Math.abs(M.spreadOf(0, 0, 0).mean - M.PRIOR.mean) < 1e-9);
  // The pool kept while reading holds whatever can end on top: the nearest, the best worded, the named.
  const lots = Array.from({ length: 200 }, (_, i) => ({ id: i, words: i === 7 ? 1 : 0, matched: i === 7, exact: i === 9, cos: i === 3 ? 0.9 : 0.4 }));
  const kept = M.prunePool(lots, 10).map((x) => x.id);
  assert.ok(kept.length <= 21 && [3, 7, 9].every((i) => kept.includes(i)), kept.join(','));
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

// The real model's cosines (snowflake-arctic-embed-s, the query prefix, the pinned files, through this app's own
// vendored worker on WebGPU in headless Chromium, 24 Oct 2026) for five questions over ten passages.
const REAL_PASSAGES = [
  "Leaf chemistry\nPhotosynthesis: green leaves catch sunlight with chlorophyll and turn carbon dioxide and water into glucose and oxygen.",
  "Breakfast\nWhisk two eggs with 100 g flour and 300 ml milk; rest the batter for 20 minutes.",
  "Binary search\nHalve a sorted array each step: compare the middle and keep the half that can hold the target.",
  "Kettles\nDescale a kettle with citric acid: limescale builds up where the water is hard.",
  "Rayleigh scattering\nShort wavelengths of sunlight scatter more off air molecules, so blue light reaches the eye from every direction.",
  "Container orchestration\nKubernetes schedules containers across a cluster of machines and restarts them when they fail.",
  "Garden centre\nPlant food from the garden centre: a liquid feed for tomatoes every week in summer.",
  "Volcano Field Notes\nBasaltic lava flows faster than rhyolitic lava because it has less silica.",
  "The French Revolution\nIn 1789 the Estates-General met at Versailles and the Third Estate declared itself the National Assembly.",
  "Big-O of sorting\nMerge sort takes n log n comparisons in the worst case; insertion sort takes n squared.",
];
const REAL = {
  "how do plants make food": {"Garden centre": 0.624, "Leaf chemistry": 0.599, "Container orchestration": 0.497, "Kettles": 0.476, "Breakfast": 0.447, "Rayleigh scattering": 0.427, "Binary search": 0.426, "Volcano Field Notes": 0.421, "The French Revolution": 0.358, "Big-O of sorting": 0.343},
  "what is binary search": {"Binary search": 0.515, "Container orchestration": 0.46, "Leaf chemistry": 0.431, "Rayleigh scattering": 0.429, "Big-O of sorting": 0.422, "Garden centre": 0.418, "Kettles": 0.408, "Breakfast": 0.378, "Volcano Field Notes": 0.338, "The French Revolution": 0.335},
  "how to stop a kettle furring up": {"Kettles": 0.553, "Binary search": 0.458, "Breakfast": 0.428, "Rayleigh scattering": 0.386, "Volcano Field Notes": 0.386, "Garden centre": 0.383, "Container orchestration": 0.356, "Big-O of sorting": 0.353, "Leaf chemistry": 0.337, "The French Revolution": 0.303},
  "why is the sky blue": {"Rayleigh scattering": 0.536, "Container orchestration": 0.456, "Leaf chemistry": 0.451, "Kettles": 0.407, "Breakfast": 0.397, "Binary search": 0.397, "Volcano Field Notes": 0.395, "The French Revolution": 0.368, "Garden centre": 0.367, "Big-O of sorting": 0.294},
  "Kubernetes": {"Container orchestration": 0.69, "Garden centre": 0.47, "Kettles": 0.461, "Volcano Field Notes": 0.454, "Binary search": 0.443, "Big-O of sorting": 0.438, "Breakfast": 0.406, "Leaf chemistry": 0.405, "Rayleigh scattering": 0.398, "The French Revolution": 0.379},
};

test('on the real model\'s numbers: meaning finds what keywords miss, a named title still wins, and nothing unrelated comes along', () => {
  const ranked = (q, how) => {
    const cos = Object.values(REAL[q]);
    const sp = M.spreadOf(cos.length, cos.reduce((a, x) => a + x, 0), cos.reduce((a, x) => a + x * x, 0));
    const w = M.wordMatcher(q);
    const items = REAL_PASSAGES.map((t) => {
      const title = t.split('\n')[0];
      return { title, ...(w ? w(t.toLowerCase()) : { words: 0, matched: false }), exact: M.exactTitle(q, title), cos: REAL[q][title] };
    });
    return M.rank(items, 5, how, sp).map((x) => x.title);
  };
  assert.deepEqual(ranked('how do plants make food', 'keywords'), ['Garden centre']);
  assert.deepEqual(ranked('how do plants make food', 'meaning'), ['Garden centre', 'Leaf chemistry'], 'photosynthesis found, Kubernetes (0.497) not');
  assert.deepEqual(ranked('how to stop a kettle furring up', 'keywords'), []);
  assert.deepEqual(ranked('how to stop a kettle furring up', 'meaning'), ['Kettles']);
  assert.deepEqual(ranked('why is the sky blue', 'keywords'), []);
  assert.deepEqual(ranked('why is the sky blue', 'meaning'), ['Rayleigh scattering']);
  assert.deepEqual(ranked('what is binary search', 'meaning'), ['Binary search']);
  assert.deepEqual(ranked('Kubernetes', 'meaning'), ['Container orchestration']);
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

test('a document saved here while the library copy is being made is not copied a second time (each passage once in a search)', async () => {
  L._reset();
  const mine = await L.keepDoc({ title: 'Leaf chemistry', source: 'typed in', kind: 'notes', pages: 0 }, [{ text: 'Photosynthesis turns sunlight into glucose.' }]);
  const brainDocs = [
    { id: 'b-a', title: 'Kettles', source: 'x', kind: 'notes', pages: 0, passages: 1, chars: 10, status: 'ready', builtin: false, at: 1 },
    { id: 'b-leaf', title: 'Leaf chemistry', source: 'typed in', kind: 'notes', pages: 0, passages: 1, chars: 43, status: 'ready', builtin: false, at: 2 },
  ];
  const text = { 'b-a': 'Descale a kettle with citric acid.', 'b-leaf': 'Photosynthesis turns sunlight into glucose.' };
  await L.mirrorLibrary({
    docs: async () => brainDocs,
    passages: async (id) => {
      // The upload of "Leaf chemistry" finishes while the copy is under way.
      if (id === 'b-a') await L.markSynced(mine.id, 'b-leaf');
      return { passages: [{ rid: id === 'b-a' ? 1 : 2, text: text[id], heading: '', page: null }], next: null };
    },
  });
  const shelf = await L.shelf();
  assert.deepEqual(shelf.docs.map((d) => d.title).sort(), ['Kettles', 'Leaf chemistry'], 'one copy of each');
  assert.equal((await L.searchLocal('photosynthesis glucose')).length, 1);
});

test('new passages still waiting for their vectors: by meaning with the newest few by their words (and said), keywords once more are waiting', async () => {
  assert.equal(M.meaningCovers(98, 100), true);
  assert.equal(M.meaningCovers(97, 100), false);
  assert.equal(M.meaningCovers(0, 0), false);
  L._reset();
  L.setQueryEmbedder({ ready: () => true, vector: async (q) => M.normalise(fakeVec(q)) });
  await L.keepDoc({ title: 'Leaf chemistry', source: 'x', kind: 'notes', pages: 0 }, [{ text: 'Photosynthesis: green leaves turn sunlight into glucose.' }]);
  await L.keepDoc({ title: 'Big notebook', source: 'x', kind: 'notes', pages: 0 }, Array.from({ length: 58 }, (_, i) => ({ text: `Note ${i} on the history of the railways in the Midlands.` })));
  await indexAll();
  // A notebook grows by a passage that the index has not reached: 59 of 60.
  await L.keepDoc({ title: 'Fresh note', source: 'x', kind: 'notes', pages: 0 }, [{ text: 'Plant food for tomatoes: a liquid feed every week.' }]);
  let r = await L.searchLocalHow('how do plants make food');
  assert.deepEqual([r.how, r.unindexed], ['meaning', 1]);
  assert.match(r.hits.map((h) => h.title).join(','), /Leaf chemistry/);
  assert.ok(r.hits.some((h) => h.title === 'Fresh note'), 'the unindexed passage still competes by its words');
  // Two more arrive: 59 of 62 is under 98 %: keywords for everything, and it says so.
  await L.keepDoc({ title: 'More', source: 'x', kind: 'notes', pages: 0 }, [{ text: 'One.' }, { text: 'Two.' }]);
  r = await L.searchLocalHow('how do plants make food');
  assert.deepEqual([r.how, r.unindexed], ['keywords', 0]);
  assert.ok(!r.hits.some((h) => h.title === 'Leaf chemistry'));
});
