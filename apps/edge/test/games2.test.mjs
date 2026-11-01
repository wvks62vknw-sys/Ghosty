// The two games made by us (BRIEF-GAMES-2), their rules held to their numbers with no screen: THE BLOCK WORLD's ground
// is the same for a seed and chunk whatever the order it is made in, of the eight kinds, with caves only near the surface;
// edits are laid over a chunk made again and survive a save; the greedy mesher's face counts on known chunks; every BUILD
// word gives a thing inside its size's bounds, mostly of the material said, and an unknown word gets the list. THE
// RUNNER: a jump clears a barrier, a roll clears a beam, pillars and gaps and the wrong move each make a stumble, the
// second stumble inside the shadow's window is the catch (a shield takes one), scoring and the doubler, the power-ups'
// timers, the magnet, a world laid out that always leaves a way through, speed rising with distance, the controller's
// edges, and the Learnable contract. The shelf entries made by us (no data: `madeByUs`) and their catalogue words.
// Bundles are built here, with esbuild's API, like arcade.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({
  entryPoints: {
    world: at('../../web/src/arcade/games/voxel/world.ts'),
    mesh: at('../../web/src/arcade/games/voxel/mesh.ts'),
    builds: at('../../web/src/arcade/games/voxel/builds.ts'),
    sim: at('../../web/src/arcade/games/runner/sim.ts'),
    games: at('../../web/src/arcade/games/shelf.ts'),
    shelf: at('../../web/src/arcade/shelf.ts'),
    learnable: at('../../web/src/arcade/learnable.ts'),
    catalogue: at('../../../packages/shared/src/catalogue.ts'),
    words: at('../../../packages/shared/src/catalogue/games2.ts'),
  },
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outdir: at('./.build/games2'),
  outExtension: { '.js': '.mjs' },
  logLevel: 'warning',
});
const W = await import('./.build/games2/world.mjs');
const M = await import('./.build/games2/mesh.mjs');
const B = await import('./.build/games2/builds.mjs');
const S = await import('./.build/games2/sim.mjs');
const { GAMES2, GAMES2_PAD, BLOCK_WORLD_ID, RUNNER_ID } = await import('./.build/games2/games.mjs');
const { SHELF } = await import('./.build/games2/shelf.mjs');
const { checkLearnable } = await import('./.build/games2/learnable.mjs');
const C = await import('./.build/games2/catalogue.mjs');
const { GAMES2_WORDS } = await import('./.build/games2/words.mjs');

const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// ================================================================ THE BLOCK WORLD

test('the world: the same blocks for a seed and chunk, whatever order the chunks are made in; another seed differs', () => {
  const a = W.generateChunk(1234, 3, -2);
  assert.ok(same(a, W.generateChunk(1234, 3, -2)), 'made twice, the same');
  const w1 = new W.World(1234), w2 = new W.World(1234);
  const keys = [];
  for (let cx = -2; cx <= 2; cx++) for (let cz = -2; cz <= 2; cz++) keys.push([cx, cz]);
  for (const [cx, cz] of keys) w1.chunk(cx, cz);
  for (const [cx, cz] of [...keys].reverse()) w2.chunk(cx, cz);
  for (const [cx, cz] of keys) assert.ok(same(w1.chunk(cx, cz), w2.chunk(cx, cz)), `chunk ${cx},${cz} the same in either order`);
  assert.ok(!same(a, W.generateChunk(4321, 3, -2)), 'another seed, another world');
  assert.equal(a.length, W.CX * W.CY * W.CX);
});

test('the world: hills, water at the line, eight kinds of block, caves only near the surface, trees on grass', () => {
  const kinds = new Set();
  let water = 0, caves = 0, deep = 0;
  for (let cx = -10; cx < 10; cx++) {
    for (let cz = -10; cz < 10; cz++) {
      const c = W.generateChunk(2, cx, cz);
      for (let z = 0; z < W.CX; z++) {
        for (let x = 0; x < W.CX; x++) {
          const h = W.heightAt(2, cx * W.CX + x, cz * W.CX + z);
          assert.ok(h >= 3 && h < W.CY - 7, `height ${h}`);
          for (let y = 0; y < W.CY; y++) {
            const k = c[W.idx(x, y, z)];
            if (k) kinds.add(k);
            if (k === W.WATER) {
              water++;
              assert.ok(y <= W.SEA, 'no water over the line');
            }
            if (k === W.AIR && y < h) (caves++, y < h - 17 && deep++);
          }
        }
      }
    }
  }
  assert.deepEqual([...kinds].sort((p, q) => p - q), [...W.NATURAL].sort((p, q) => p - q), `the eight kinds, no building materials: ${[...kinds]}`);
  assert.ok(water > 1000, `lakes (${water} water blocks)`);
  assert.ok(caves > 200, `caves (${caves} hollow blocks under the surface)`);
  assert.equal(deep, 0, 'every cave within 17 blocks of the surface');
});

test('the world: edits are kept, laid over a chunk made again, and saved and read back whole', () => {
  const w = new W.World(9);
  const y = w.surface(5, 5) + 1;
  assert.deepEqual(w.set(5, y, 5, W.GOLD), ['0,0']);
  assert.deepEqual(w.set(5, y, 5, W.GOLD), [], 'the same block again changes nothing');
  assert.deepEqual(w.set(0, y, 15, W.BRICK).sort(), ['-1,0', '0,0', '0,1'], 'a block on a corner redraws its neighbours too');
  w.drop(0, 0);
  assert.equal(w.get(5, y, 5), W.GOLD, 'made again, the edit is laid over');
  const save = { v: 1, name: 'World 1: Meadow', seed: 9, created: 'x', played: 'x', time: 0.3, player: { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, fly: false }, edits: w.editList(), placed: 2, dug: 0 };
  const back = W.decodeSave(W.encodeSave(save));
  assert.deepEqual(back, save);
  const w2 = new W.World(back.seed, back.edits);
  assert.equal(w2.get(5, y, 5), W.GOLD);
  assert.equal(w2.get(0, y, 15), W.BRICK);
  assert.equal(W.decodeSave(new Uint8Array(0)), null, 'an emptied slot reads as none');
  assert.equal(W.decodeSave(new TextEncoder().encode('{"v":2}')), null);
});

test('the world: a ray finds the block in front and the face it entered by (water passed through)', () => {
  const w = new W.World(5);
  const sy = w.surface(8, 8);
  const hit = w.ray(8.5, sy + 1.6, 8.5, 0, -1, 0, 6);
  assert.ok(hit && hit.y === sy && hit.ny === 1, `straight down onto the ground at ${sy}: ${JSON.stringify(hit)}`);
  assert.equal(w.ray(8.5, sy + 1.6, 8.5, 0, 1, 0, 6), null, 'nothing above in reach');
});

test('the greedy mesher: face counts on known chunks', () => {
  const quads = (fill, n = null) => {
    const c = new Uint8Array(W.CX * W.CY * W.CX);
    fill(c);
    return M.meshChunk(M.padChunk(c, n, n, n, n));
  };
  const put = (c, x, y, z, k = W.STONE) => (c[W.idx(x, y, z)] = k);
  assert.equal(quads((c) => put(c, 5, 10, 5)).opaque.quads, 6, 'one block: six faces');
  assert.equal(quads((c) => (put(c, 5, 10, 5), put(c, 6, 10, 5))).opaque.quads, 6, 'two of a kind side by side: still six (merged)');
  assert.equal(quads((c) => (put(c, 5, 10, 5), put(c, 6, 10, 5, W.BRICK))).opaque.quads, 10, 'two kinds side by side: ten');
  assert.equal(quads((c) => { for (let y = 0; y < 3; y++) for (let z = 0; z < 3; z++) for (let x = 0; x < 3; x++) put(c, 4 + x, 20 + y, 4 + z); }).opaque.quads, 6, 'a 3 × 3 × 3 cube: six faces');
  const slab = (c) => { for (let y = 0; y < 4; y++) for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) put(c, x, y, z); };
  assert.equal(quads(slab).opaque.quads, 5, 'a full slab on the floor: its top and four sides (the floor hides its bottom)');
  const full = new Uint8Array(W.CX * W.CY * W.CX);
  slab(full);
  assert.equal(quads(slab, full).opaque.quads, 1, 'the same slab between neighbours like it: only the top shows');
  // a block in a dip is shaded at its corners, so its top is not merged with the open ground round it
  const dip = quads((c) => { slab(c); c[W.idx(7, 3, 7)] = 0; });
  assert.ok(dip.opaque.quads > 5, `a hole in the slab: more faces (${dip.opaque.quads})`);
  const wet = quads((c) => { put(c, 5, 10, 5, W.WATER); put(c, 6, 10, 5, W.STONE); });
  assert.equal(wet.clear.quads, 5, 'water next to stone: five water faces, drawn see-through');
  assert.equal(wet.opaque.quads, 6, 'and the stone shows all six (one through the water)');
  const m = quads((c) => put(c, 5, 10, 5));
  assert.equal(m.opaque.pos.length, 6 * 4 * 3);
  assert.equal(m.opaque.idx.length, 6 * 6);
  assert.ok(m.opaque.idx instanceof Uint16Array);
});

test('BUILD: every word, size and material gives a thing inside its bounds, mostly of that material', () => {
  for (const what of B.STRUCTURES) {
    for (const size of ['small', 'normal', 'big', 'huge']) {
      for (const material of [null, ...Object.keys(B.MATERIALS)]) {
        const p = B.plan({ what, size, material }, 42);
        const b = B.BOUNDS[size];
        const half = (b.w - 1) / 2;
        const solid = p.blocks.filter((q) => q.k !== W.AIR);
        assert.ok(solid.length >= 20, `${size} ${material} ${what}: ${solid.length} blocks`);
        for (const q of p.blocks) assert.ok(Math.abs(q.x) <= half && q.z >= 0 && q.z < b.w && q.y >= B.FOUNDATION && q.y < b.h, `${size} ${what} block at ${q.x},${q.y},${q.z} outside ${b.w} × ${b.h}`);
        const count = new Map();
        for (const q of solid) count.set(q.k, (count.get(q.k) ?? 0) + 1);
        const top = [...count].sort((x, y) => y[1] - x[1])[0][0];
        if (material) assert.equal(top, B.MATERIALS[material], `${size} ${material} ${what}: mostly ${material}`);
        else assert.equal(top, p.kind, `${size} ${what}: mostly its own material`);
        // the order: what clears the space, then foundations, then up from the bottom
        const rank = (q) => (q.k === W.AIR ? 0 : q.fill ? 1 : 2);
        for (let i = 1; i < p.blocks.length; i++) assert.ok(rank(p.blocks[i - 1]) <= rank(p.blocks[i]), `${what}: air first, then foundations, then the rest`);
      }
    }
  }
});

test('BUILD: the line is read for a thing, a size and a material; a word it does not know gets the list', () => {
  assert.deepEqual(B.parseBuild('Build me a big stone castle!'), { what: 'castle', size: 'big', material: 'stone' });
  assert.deepEqual(B.parseBuild('a HUGE golden pyramid please'), { what: 'pyramid', size: 'huge', material: 'gold' });
  assert.deepEqual(B.parseBuild('make a statue of a cat'), { what: 'cat', size: 'normal', material: null });
  assert.deepEqual(B.parseBuild('small wooden boat'), { what: 'boat', size: 'small', material: 'wood' });
  assert.deepEqual(B.parseBuild('a little glass lighthouse'), { what: 'lighthouse', size: 'small', material: 'glass' });
  assert.equal(B.parseBuild('a spaceship'), null);
  assert.equal(B.parseBuild(''), null);
  for (const s of B.STRUCTURES) assert.ok(B.VOCABULARY_LINE.includes(B.SAY[s]), `the list names ${B.SAY[s]}`);
  assert.match(B.VOCABULARY_LINE, /^I can build these: /);
  for (const w of ['small', 'big', 'huge', 'stone', 'wood', 'glass', 'brick', 'gold']) assert.ok(B.VOCABULARY_LINE.includes(w), w);
  const p = B.plan({ what: 'castle', size: 'big', material: 'stone' }, 1);
  assert.equal(B.startLine(p), 'A big stone castle coming up. Give me a moment.');
  assert.match(B.doneLine(p, 1234), /^There's your castle: 1,234 blocks\.$/);
});

test('BUILD: varied by the seed (a maze is never the same twice), the same for the same seed', () => {
  const key = (p) => p.blocks.filter((q) => q.k !== W.AIR).map((q) => `${q.x},${q.y},${q.z},${q.k}`).sort().join(';');
  const ask = { what: 'maze', size: 'big', material: 'brick' };
  assert.equal(key(B.plan(ask, 7)), key(B.plan(ask, 7)));
  assert.notEqual(key(B.plan(ask, 7)), key(B.plan(ask, 8)));
});

// ================================================================ THE RUNNER

/** A run with nothing laid out, things placed by hand, played with moves at given distances. */
function playTo(r, until, moves = {}) {
  const done = new Set();
  for (let i = 0; i < 60 * 60 && r.d < until && !r.over; i++) {
    let m = 'none';
    for (const [d, mv] of Object.entries(moves)) if (!done.has(d) && r.d >= Number(d)) (done.add(d), (m = mv));
    S.step(r, m, S.TICK);
  }
  return r;
}
const stumbles = (r) => r.events.filter((e) => e.type === 'stumble').map((e) => e.kind);

test('the runner: a jump clears a low barrier, running into it is a stumble', () => {
  const hit = S.newRun(1, { gen: false });
  S.place(hit, { kind: 'barrier', lane: 0, d: 30, len: 0.4 });
  playTo(hit, 40);
  assert.deepEqual(stumbles(hit), ['barrier']);
  assert.ok(hit.chase > 0 && !hit.over, 'the shadow closes in; he runs on');
  const clear = S.newRun(1, { gen: false });
  S.place(clear, { kind: 'barrier', lane: 0, d: 30, len: 0.4 });
  playTo(clear, 40, { 27.5: 'jump' });
  assert.deepEqual(stumbles(clear), [], 'jumped clean over');
  assert.ok(clear.events.some((e) => e.type === 'jump') && clear.events.some((e) => e.type === 'land'));
});

test('the runner: a roll clears a high beam; standing, or jumping, into it is a stumble', () => {
  for (const [moves, want] of [[{ 28: 'roll' }, []], [{}, ['beam']], [{ 27.5: 'jump' }, ['beam']]]) {
    const r = S.newRun(2, { gen: false });
    S.place(r, { kind: 'beam', lane: 0, d: 30, len: 0.4 });
    playTo(r, 40, moves);
    assert.deepEqual(stumbles(r), want, JSON.stringify(moves));
  }
  // the jump boost clears a beam from above
  const r = S.newRun(2, { gen: false });
  r.powers.boost = 10;
  S.place(r, { kind: 'beam', lane: 0, d: 30, len: 0.4 });
  playTo(r, 40, { 26.5: 'jump' });
  assert.deepEqual(stumbles(r), [], 'boosted, he sails over the beam');
});

test('the runner: pillars are dodged, not jumped; head on he is knocked into the free lane; a pillar beside him is a bump', () => {
  const dodge = S.newRun(3, { gen: false });
  S.place(dodge, { kind: 'pillar', lane: 0, d: 30, len: 1.2 });
  playTo(dodge, 40, { 24: 'left' });
  assert.deepEqual(stumbles(dodge), []);
  assert.equal(dodge.lane, -1);
  const head = S.newRun(3, { gen: false });
  S.place(head, { kind: 'pillar', lane: 0, d: 30, len: 1.2 });
  S.place(head, { kind: 'pillar', lane: 1, d: 34, len: 1.2 });
  playTo(head, 32, { 27.5: 'jump' });
  assert.deepEqual(stumbles(head), ['pillar'], 'a jump does not clear a pillar');
  assert.equal(head.lane, -1, 'knocked into the lane with more room ahead');
  const side = S.newRun(3, { gen: false });
  S.place(side, { kind: 'pillar', lane: 1, d: 30, len: 6 });
  playTo(side, 40, { 32: 'right' });
  assert.equal(side.lane, 0, 'he stays in his lane');
  assert.deepEqual(stumbles(side), ['pillar']);
  assert.ok(side.events.some((e) => e.type === 'bump'));
});

test('the runner: a gap is jumped; missed, he drops in and scrambles out on the far side (a stumble)', () => {
  const over = S.newRun(4, { gen: false });
  for (const l of [-1, 0, 1]) S.place(over, { kind: 'gap', lane: l, d: 30, len: 3.2 });
  playTo(over, 40, { 28.4: 'jump' });
  assert.deepEqual(stumbles(over), []);
  const fall = S.newRun(4, { gen: false });
  for (const l of [-1, 0, 1]) S.place(fall, { kind: 'gap', lane: l, d: 30, len: 3.2 });
  playTo(fall, 40);
  assert.deepEqual(stumbles(fall), ['gap']);
  assert.equal(fall.y, 0);
  assert.ok(fall.d > 33.2, 'out on the far edge');
});

test('the runner: a stumble then another inside the shadow\'s window is the catch; once it falls back he is clear; a shield takes one', () => {
  const caught = S.newRun(5, { gen: false });
  S.place(caught, { kind: 'barrier', lane: 0, d: 30, len: 0.4 });
  S.place(caught, { kind: 'barrier', lane: 0, d: 60, len: 0.4 });
  playTo(caught, 80);
  assert.ok(caught.over, 'caught on the second stumble');
  assert.ok(caught.events.some((e) => e.type === 'caught'));
  const d = caught.d;
  S.step(caught, 'jump', S.TICK);
  assert.equal(caught.d, d, 'nothing moves once caught');
  const clear = S.newRun(5, { gen: false });
  S.place(clear, { kind: 'barrier', lane: 0, d: 30, len: 0.4 });
  S.place(clear, { kind: 'barrier', lane: 0, d: 160, len: 0.4 });
  playTo(clear, 170);
  assert.ok(!clear.over, `the shadow fell back between the two (${S.CHASE} s)`);
  assert.ok(clear.events.some((e) => e.type === 'clear'));
  assert.equal(clear.stumbles, 2);
  const shielded = S.newRun(5, { gen: false });
  shielded.powers.shield = S.POWER_SECONDS.shield;
  S.place(shielded, { kind: 'barrier', lane: 0, d: 30, len: 0.4 });
  S.place(shielded, { kind: 'barrier', lane: 0, d: 60, len: 0.4 });
  playTo(shielded, 80);
  assert.ok(!shielded.over && shielded.events.some((e) => e.type === 'shield'), 'the shield took the first');
  assert.equal(shielded.powers.shield, 0);
});

test('the runner: the score is the distance plus ten a coin, all doubled by the doubler; the magnet pulls coins from any lane', () => {
  const r = S.newRun(6, { gen: false });
  r.coinList.push({ lane: 0, d: 20, y: 0.8, taken: false, at: 0 }, { lane: 1, d: 25, y: 0.8, taken: false, at: 0 });
  playTo(r, 50);
  assert.equal(r.coins, 1, 'the coin in his lane, not the one beside it');
  assert.ok(Math.abs(r.points - (r.d + 10)) < 1e-6, `points ${r.points} = distance ${r.d} + 10`);
  assert.equal(S.scoreOf(r), Math.round(r.points));
  const m = S.newRun(6, { gen: false });
  m.powers.magnet = 10;
  m.coinList.push({ lane: 1, d: 20, y: 0.8, taken: false, at: 0 }, { lane: -1, d: 22, y: 2.2, taken: false, at: 0 });
  playTo(m, 30);
  assert.equal(m.coins, 2, 'the magnet took both');
  const dbl = S.newRun(6, { gen: false });
  dbl.powers.double = 100;
  dbl.coinList.push({ lane: 0, d: 20, y: 0.8, taken: false, at: 0 });
  playTo(dbl, 50);
  assert.ok(Math.abs(dbl.points - 2 * (dbl.d + 10)) < 1e-6, 'doubled');
});

test('the runner: power-ups are picked up in their lane and run down on their timers', () => {
  const r = S.newRun(7, { gen: false });
  r.ups.push({ kind: 'magnet', lane: 0, d: 20, taken: false });
  playTo(r, 21);
  assert.ok(r.events.some((e) => e.type === 'power' && e.kind === 'magnet'));
  assert.ok(r.powers.magnet > S.POWER_SECONDS.magnet - 0.2);
  const t0 = r.t;
  while (r.powers.magnet > 0) S.step(r, 'none', S.TICK);
  assert.ok(Math.abs(r.t - t0 - S.POWER_SECONDS.magnet) < 0.25, `it lasted ${r.t - t0} s`);
  assert.ok(r.events.some((e) => e.type === 'expire' && e.kind === 'magnet'));
  for (const p of S.POWERS) assert.ok(S.POWER_SECONDS[p] >= 8, p);
});

test('the runner: the world laid out ahead always leaves a way through, gaps only on the bridge and the roofs, faster further on', () => {
  for (const seed of [1, 2, 3, 99, 2026]) {
    const r = S.newRun(seed);
    S.layOut(r, 12000);
    const rows = new Map();
    for (const o of r.obs) {
      if (!rows.has(o.d)) rows.set(o.d, []);
      rows.get(o.d).push(o);
    }
    const ds = [...rows.keys()].sort((a, b) => a - b);
    for (const d of ds) {
      const row = rows.get(d);
      const blocked = new Set(row.filter((o) => o.kind === 'pillar').map((o) => o.lane));
      assert.ok(blocked.size < 3, `seed ${seed} at ${d} m: pillars across all three lanes`);
      if (row.some((o) => o.kind === 'gap')) assert.ok(['bridge', 'roof'].includes(S.sectionAt(r, d)), `seed ${seed}: a gap at ${d} m in the ${S.sectionAt(r, d)}`);
    }
    for (let i = 1; i < ds.length; i++) {
      const prevEnd = Math.max(...rows.get(ds[i - 1]).map((o) => o.d + o.len));
      assert.ok(ds[i] - prevEnd >= 13, `seed ${seed}: rows at ${ds[i - 1]} and ${ds[i]} too close to react`);
    }
    const kinds = new Set(r.obs.map((o) => o.kind));
    assert.deepEqual([...kinds].sort(), ['barrier', 'beam', 'gap', 'pillar']);
    assert.ok(r.ups.length >= 15, `power-ups on the way (${r.ups.length})`);
    const secs = new Set(r.sections.map((s) => s.kind));
    assert.deepEqual([...secs].sort(), ['bridge', 'city', 'roof', 'tunnel'], 'the city, a tunnel, a bridge, the roofs');
  }
  assert.ok(S.speedAt(0) < S.speedAt(1000) && S.speedAt(1000) < S.speedAt(5000) && S.speedAt(1e6) <= 22.0001);
});

test('the runner: a controller through the Intent: the d-pad and stick on their edges, A jumps, B rolls', () => {
  const pad = { mx: 0, my: 0, held: new Set() };
  const I = (o) => ({ moveX: 0, moveY: 0, lookX: 0, lookY: 0, held: new Set(), ...o });
  assert.deepEqual(S.padMoves(pad, I({ moveX: -1 })), ['left']);
  assert.deepEqual(S.padMoves(pad, I({ moveX: -1 })), [], 'held: once');
  assert.deepEqual(S.padMoves(pad, I({ moveX: 0.9 })), ['right']);
  assert.deepEqual(S.padMoves(pad, I({})), []);
  assert.deepEqual(S.padMoves(pad, I({ moveY: 1 })), ['jump']);
  assert.deepEqual(S.padMoves(pad, I({ moveY: -1 })), ['roll']);
  assert.deepEqual(S.padMoves(pad, I({ held: new Set(['jump']) })), ['jump']);
  assert.deepEqual(S.padMoves(pad, I({ held: new Set(['jump', 'use']) })), ['roll']);
  assert.deepEqual(S.padMoves(pad, I({ moveX: 0.3 })), [], 'inside the dead zone: nothing');
});

test('the runner keeps the Learnable contract: plain observations, five moves, the distance as its score', () => {
  const g = S.runnerLearnable(11);
  assert.deepEqual(checkLearnable(g, 600), []);
  assert.deepEqual([...g.actions], ['none', 'left', 'right', 'jump', 'roll']);
  const o = g.observe();
  assert.deepEqual(Object.keys(o).sort(), ['chase', 'coins', 'lane', 'next', 'rolling', 'shield', 'speed', 'y']);
  assert.equal(o.next.length, 9, 'the next three things: kind, lane, distance each');
  assert.ok(o.next.every((v) => typeof v === 'number' && Number.isFinite(v)));
  assert.equal(g.score(), Math.floor(g.run.d));
  // left alone he is caught in the end, and says so
  for (let i = 0; i < 60 * 300 && !g.done(); i++) g.act('none');
  assert.ok(g.done(), 'a run left alone ends');
  const s = g.score();
  g.act('jump');
  assert.equal(g.score(), s);
});

// ================================================================ the shelf and the catalogue

test('the shelf entries made by us: no data (madeByUs), their own engines, every field, ids of their own', () => {
  const CONTROLS = ['move', 'look', 'fire', 'use', 'weapon', 'jump', 'map'];
  const ids = new Set(SHELF.map((e) => e.id));
  assert.deepEqual(GAMES2.map((e) => e.id), [BLOCK_WORLD_ID, RUNNER_ID]);
  assert.deepEqual(GAMES2.map((e) => e.engine), ['voxel', 'runner']);
  for (const e of GAMES2) {
    // the shelf's own rule, extended: data may be null only for a game made by us
    assert.ok(e.data !== null || e.madeByUs, `${e.id}: data or madeByUs`);
    assert.equal(e.data, null);
    assert.equal(e.madeByUs, true);
    assert.ok(!ids.has(e.id), `${e.id}: not an id the shelf has`);
    assert.match(e.title, /^THE [A-Z ]+$/);
    for (const k of ['line', 'ghosty', 'done']) assert.ok(e[k].trim().length > 10 && e[k].length <= 140, `${e.id}.${k}`);
    assert.ok(e.controls.length && e.controls.every((c) => CONTROLS.includes(c)), `${e.id}: controls`);
    assert.match(e.since, /^2026-\d\d-\d\d$/);
    assert.equal(typeof e.saves, 'boolean');
    // our own names only
    assert.doesNotMatch(`${e.title} ${e.line} ${e.ghosty} ${e.done}`, /minecraft|subway|surfer|creeper|steve\b/i);
  }
  const ACTIONS = ['fire', 'use', 'weapon', 'weaponPrev', 'jump', 'map', 'run', 'pause'];
  for (const [engine, map] of Object.entries(GAMES2_PAD)) {
    for (const [i, a] of Object.entries(map)) {
      assert.ok(Number(i) >= 0 && Number(i) <= 16, `${engine}: button ${i}`);
      assert.ok(ACTIONS.includes(a), `${engine}: ${a}`);
    }
    assert.ok(Object.values(map).includes('pause') && Object.values(map).includes('jump'), engine);
  }
});

test('their catalogue words keep the rules, name the BUILD words, and are keyed by the shelf ids', () => {
  assert.deepEqual(Object.keys(GAMES2_WORDS).sort(), GAMES2.map((e) => `arcade:${e.id}`).sort());
  for (const [k, v] of Object.entries(GAMES2_WORDS)) {
    assert.deepEqual(C.wordProblems(k, v), [], k);
    assert.equal(v.cat, 'play');
    assert.deepEqual(v.scene, ['playing']);
    assert.match(v.since, /^2026-11-0\d$/);
  }
  const blocks = GAMES2_WORDS[`arcade:${BLOCK_WORLD_ID}`];
  for (const s of B.STRUCTURES) assert.ok(blocks.more.includes(B.SAY[s]), `the block world's words name ${B.SAY[s]}`);
  assert.doesNotMatch(JSON.stringify(GAMES2_WORDS), /minecraft|subway/i);
});
