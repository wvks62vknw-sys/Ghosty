// The three games of BRIEF-GAMES-3, their rules held to their numbers with no screen. THE KART RACER: a drift held
// through a bend builds a boost that a release spends (a short one gives none); a bump keeps the momentum and the sum
// of the speeds (within the bounce's loss); the bots' catch-up never passes its caps; laps count only forwards and
// the finish order is the order of crossing; the bots' racing line keeps them on the road for a whole lap on every
// track at every difficulty; items by place, an orb that spins the kart ahead and a shield that stops it; lap records
// kept quickest-first through scores.ts. THE HOPPER: no row is ever impossible (gaps, logs, trains, trees), the kinds
// of end (car, lorry, train, water, edge, fog, and a tree that only bonks), rows and coins counted once, the fog's
// pace and leash, Ghosty's practice the same for a seed. THE ARENA: bigger eats smaller by the ratio and only when it
// covers it, split and merge on their timers, a virus pops a big cell (the mass kept), a whole round of bots, and the
// Learnable contract. The shelf entries made by us, the pads, and the catalogue words. Bundled here with esbuild.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({
  entryPoints: {
    kart: at('../../web/src/arcade/games/kart/sim.ts'),
    tracks: at('../../web/src/arcade/games/kart/tracks.ts'),
    records: at('../../web/src/arcade/games/kart/records.ts'),
    hopper: at('../../web/src/arcade/games/hopper/sim.ts'),
    arena: at('../../web/src/arcade/games/arena/sim.ts'),
    shelf3: at('../../web/src/arcade/games/shelf3.ts'),
    pad3: at('../../web/src/arcade/games/pad3.ts'),
    games2: at('../../web/src/arcade/games/shelf.ts'),
    shelf: at('../../web/src/arcade/shelf.ts'),
    learnable: at('../../web/src/arcade/learnable.ts'),
    catalogue: at('../../../packages/shared/src/catalogue.ts'),
    words: at('../../../packages/shared/src/catalogue/games3.ts'),
  },
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outdir: at('./.build/games3'),
  outExtension: { '.js': '.mjs' },
  logLevel: 'warning',
});
// scores.ts keeps its records in localStorage: a plain one for the lap records' test
const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const K = await import('./.build/games3/kart.mjs');
const TR = await import('./.build/games3/tracks.mjs');
const REC = await import('./.build/games3/records.mjs');
const H = await import('./.build/games3/hopper.mjs');
const A = await import('./.build/games3/arena.mjs');
const { GAMES3, KART_ID, HOPPER_ID, ARENA_ID } = await import('./.build/games3/shelf3.mjs');
const { GAMES3_PAD } = await import('./.build/games3/pad3.mjs');
const { GAMES2 } = await import('./.build/games3/games2.mjs');
const { SHELF } = await import('./.build/games3/shelf.mjs');
const { checkLearnable } = await import('./.build/games3/learnable.mjs');
const C = await import('./.build/games3/catalogue.mjs');
const { GAMES3_WORDS } = await import('./.build/games3/words.mjs');

const idleCtl = () => ({ steer: 0, throttle: 0, brake: 0, drift: false, item: false });
/** A wide open loop (a circle 300 m across, 120 m of road): room to drift without a wall. */
const OPEN = { id: 'open', name: 'Open', line: 'A test loop.', pts: Array.from({ length: 24 }, (_, i) => [Math.sin((i / 24) * Math.PI * 2) * 300, Math.cos((i / 24) * Math.PI * 2) * 300, 0]), half: 60, verge: 4, tunnel: [], boxes: [] };
const steps = (r, s) => {
  for (let i = 0; i < Math.round(s / K.STEP); i++) K.step(r);
};

// ================================================================ THE KART RACER

test('the kart: a drift held through a bend builds a boost, released it carries past the top speed; a short drift gives none', () => {
  const r = K.newRace(OPEN, { laps: 99 });
  r.karts = [r.karts[0]];
  const k = r.karts[0];
  k.ctl = { ...idleCtl(), throttle: 1 };
  steps(r, 4 + K.COUNTDOWN);
  assert.ok(K.speedOf(k) > 20, `up to speed (${K.speedOf(k).toFixed(1)} m/s)`);
  k.ctl = { ...idleCtl(), throttle: 1, steer: 1, drift: true };
  const seen = new Set();
  for (let i = 0; i < 2.6 / K.STEP; i++) {
    K.step(r);
    seen.add(k.level);
  }
  assert.equal(k.drift, 1, 'drifting right');
  assert.ok(k.level >= 2 && seen.has(1), `the charge climbs through the levels (now ${k.level})`);
  r.events.length = 0;
  k.ctl = { ...idleCtl(), throttle: 1 };
  K.step(r);
  assert.ok(k.boostT >= K.BOOST_FOR[2] - 0.02, `released: a boost of ${k.boostT.toFixed(2)} s`);
  assert.ok(r.events.some((e) => e.type === 'boost' && e.level >= 2), 'and a boost event');
  let top = 0;
  for (let i = 0; i < 0.9 / K.STEP; i++) K.step(r), (top = Math.max(top, K.speedOf(k)));
  assert.ok(top > K.TOP + 2, `the boost carries it past the top speed (${top.toFixed(1)} > ${K.TOP})`);
  // a drift let go before the first level gives nothing
  steps(r, 2);
  k.ctl = { ...idleCtl(), throttle: 1, steer: -1, drift: true };
  steps(r, 0.5);
  assert.equal(k.drift, -1);
  assert.equal(k.level, 0);
  k.ctl = { ...idleCtl(), throttle: 1 };
  K.step(r);
  assert.ok(k.boostT < 0.01, 'no boost from a short drift');
});

test('the kart: a bump keeps the momentum, and the sum of the speeds within the bounce', () => {
  const kart = (x, z, vx, vz) => ({ i: 0, x, z, vx, vz, wobble: 0 });
  const speed = (k) => Math.hypot(k.vx, k.vz);
  const energy = (a, b) => a.vx ** 2 + a.vz ** 2 + b.vx ** 2 + b.vz ** 2;
  for (const [a, b, name] of [
    [kart(0, 0, 0, 25), kart(0, 1.5, 0, 20), 'from behind'],
    [kart(0, 0, 2, 24), kart(1.6, 0.4, -1, 25), 'side by side'],
    [kart(0, 0, 0, 22), kart(0.3, 1.7, 0, 18), 'off-centre'],
    [kart(0, 0, 0, 20), kart(0, 1.8, 0, -20), 'head on'],
  ]) {
    const px = a.vx + b.vx, pz = a.vz + b.vz, sum = speed(a) + speed(b), e0 = energy(a, b);
    assert.ok(K.bump(a, b), `${name}: they touch`);
    assert.ok(Math.abs(a.vx + b.vx - px) < 1e-9 && Math.abs(a.vz + b.vz - pz) < 1e-9, `${name}: momentum kept`);
    assert.ok(energy(a, b) <= e0 + 1e-9, `${name}: no energy made`);
    const after = speed(a) + speed(b);
    assert.ok(after <= sum * 1.02 && after >= sum * K.BOUNCE - 1e-9, `${name}: speeds ${sum.toFixed(2)} → ${after.toFixed(2)}`);
    if (name !== 'head on') assert.ok(Math.abs(after - sum) <= sum * 0.02, `${name}: a glancing bump keeps the sum within 2 % (${((after / sum - 1) * 100).toFixed(2)} %)`);
    assert.ok(Math.hypot(b.x - a.x, b.z - a.z) >= 2 * K.KART_R - 1e-9, `${name}: pushed apart`);
  }
  assert.equal(K.bump(kart(0, 0, 0, 10), kart(0, 3, 0, 10)), false, 'apart, no bump');
});

test('the kart: the catch-up never passes its caps, in a sweep and in a race', () => {
  let prev = -Infinity;
  for (let g = -3000; g <= 3000; g += 7) {
    const c = K.catchUp(g);
    assert.ok(c <= 1 + K.CATCH_UP_CAP + 1e-12 && c >= 1 - K.CATCH_DOWN_CAP - 1e-12, `gap ${g}: ${c}`);
    assert.ok(c >= prev - 1e-12, 'never less for a bigger gap');
    prev = c;
  }
  assert.equal(K.catchUp(0), 1);
  // you parked on the grid: the bots run away, slowed by no more than the cap
  const r = K.newRace('seaside', { laps: 3, seed: 2 });
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < 40 / K.STEP; i++) {
    r.karts[0].ctl = idleCtl();
    K.step(r);
    for (const k of r.karts.slice(1)) (lo = Math.min(lo, k.catchK)), (hi = Math.max(hi, k.catchK));
  }
  assert.ok(lo >= 1 - K.CATCH_DOWN_CAP - 1e-12 && hi <= 1 + K.CATCH_UP_CAP + 1e-12, `in the race ${lo.toFixed(3)}…${hi.toFixed(3)}`);
  assert.ok(Math.abs(lo - (1 - K.CATCH_DOWN_CAP)) < 1e-9, 'far ahead of you, the bots are slowed by the cap and no more');
});

test('the kart: laps count forwards only; the finish order is the order of crossing', () => {
  const r = K.newRace('seaside', { laps: 2 });
  r.karts = [r.karts[0]];
  const k = r.karts[0];
  r.t = 0.5;
  r.phase = 'race';
  const L = r.track.length;
  const to = (s) => {
    const p = TR.pointAt(r.track, s, 0);
    (k.x = p.x), (k.z = p.z), (k.vx = 0), (k.vz = 0), (k.ctl = idleCtl());
    K.step(r);
  };
  for (let s = -12; s <= L + 3; s += 6) to(s);
  assert.equal(k.lap, 1, 'round once: one lap');
  to(L - 3);
  to(L - 9);
  assert.ok(k.prog < L, 'backed over the line');
  for (let s = L - 6; s <= L + 9; s += 6) to(s);
  assert.equal(k.lap, 1, 'over the line again: still one lap');
  for (let s = L + 12; s <= 2 * L + 3; s += 6) to(s);
  assert.equal(k.lap, 2);
  assert.ok(k.done && k.place === 1 && k.laps.length === 2, 'two laps: home first');
  // four bots, two laps: every lap counted, places in the order they crossed
  const race = K.newRace('city', { you: false, laps: 2, difficulty: 'hard', seed: 4 });
  const laps = [], finishes = [];
  while (race.phase !== 'done' && race.t < 240) {
    K.step(race);
    for (const e of race.events) if (e.type === 'lap') laps.push(e);
    else if (e.type === 'finish') finishes.push(e);
    race.events.length = 0;
  }
  assert.equal(race.phase, 'done', `the race ends (${race.t.toFixed(0)} s)`);
  assert.equal(laps.length, 8, 'eight laps in all');
  assert.deepEqual(finishes.map((e) => e.place), [1, 2, 3, 4]);
  const byTime = [...race.karts].sort((a, b) => a.finishT - b.finishT).map((x) => x.i);
  const byPlace = [...race.karts].sort((a, b) => a.place - b.place).map((x) => x.i);
  assert.deepEqual(byPlace, byTime, 'places in the order of crossing');
  for (const x of race.karts) assert.equal(x.laps.length, 2, `${x.name}: both laps timed`);
});

test('the kart: the bots\' racing line keeps them on the road for a whole lap, on every track and difficulty', () => {
  for (const id of TR.TRACK_IDS) {
    for (const difficulty of K.DIFFICULTIES) {
      const r = K.newRace(id, { you: false, difficulty, laps: 2, seed: 9 });
      r.karts = [r.karts[2]];
      const k = r.karts[0];
      let worst = 0, off = 0;
      while (k.lap < 1 && r.t < 90) {
        K.step(r);
        r.events.length = 0;
        if (r.t > 0) (worst = Math.max(worst, Math.abs(k.lat))), (off += k.offroad ? 1 : 0);
      }
      assert.equal(k.lap, 1, `${id} ${difficulty}: round in ${r.t.toFixed(1)} s`);
      assert.ok(r.t < 70, `${id} ${difficulty}: a lap in ${r.t.toFixed(1)} s`);
      assert.ok(worst <= r.track.def.half + 0.7 && off === 0, `${id} ${difficulty}: widest ${worst.toFixed(2)} m of ${r.track.def.half} (off the road ${off} steps)`);
    }
  }
});

test('the kart: items by place; an orb spins the kart ahead and a shield stops it; oil spins who drives over it', () => {
  const rnd = K.rng(5);
  const got = { 1: {}, 4: {} };
  for (let i = 0; i < 4000; i++) {
    for (const p of [1, 4]) {
      const it = K.pickItem(p, rnd);
      got[p][it] = (got[p][it] ?? 0) + 1;
    }
  }
  assert.ok(!got[4].oil, 'last place is never given oil');
  assert.ok((got[1].orb ?? 0) < 400, 'the leader rarely gets an orb');
  assert.ok((got[4].boost ?? 0) > 1000 && (got[4].orb ?? 0) > 1000, 'last place gets speed and orbs');
  const orbAt = (shield) => {
    const r = K.newRace(OPEN, { laps: 9 });
    const [you, , rival] = r.karts;
    r.karts = [you, rival];
    r.t = 1;
    r.phase = 'race';
    const put = (k, s) => {
      const p = TR.pointAt(r.track, s, 0);
      (k.x = p.x), (k.z = p.z), (k.h = Math.atan2(p.tx, p.tz)), (k.vx = k.vz = 0), (k.idx = TR.locate(r.track, p.x, p.z, -1).i), (k.prog = s), (k.lastS = s), (k.bot = null);
    };
    put(you, 60);
    put(rival, 30);
    K.step(r);
    assert.equal(rival.place, 2);
    you.shieldT = shield ? 8 : 0;
    rival.item = 'orb';
    let spun = 0;
    for (let i = 0; i < 3 / K.STEP; i++) {
      you.ctl = idleCtl();
      rival.ctl = { ...idleCtl(), item: i < 3 };
      K.step(r);
      spun = Math.max(spun, you.spinT);
    }
    return { spun, shieldLeft: you.shieldT, events: r.events.map((e) => e.type) };
  };
  const plain = orbAt(false);
  assert.ok(plain.spun > 1, 'the orb finds the kart ahead and spins it');
  const shielded = orbAt(true);
  assert.equal(shielded.spun, 0, 'a shield stops it');
  assert.equal(shielded.shieldLeft, 0, 'and is used up');
  assert.ok(shielded.events.includes('shield'));
  // oil: dropped behind, it spins the next kart over it
  const r = K.newRace(OPEN, { laps: 9 });
  const [you, , rival] = r.karts;
  r.karts = [you, rival];
  r.t = 1;
  r.phase = 'race';
  rival.bot = null;
  rival.item = 'oil';
  rival.ctl = { ...idleCtl(), item: true };
  K.step(r);
  assert.equal(r.slicks.length, 1, 'a slick on the road');
  const s = r.slicks[0];
  you.x = s.x;
  you.z = s.z;
  you.ctl = idleCtl();
  K.step(r);
  assert.ok(you.spinT > 0 && r.slicks.length === 0, 'driven over, it spins him and is gone');
});

test('the kart: lap records per track through scores.ts, the quickest kept, his and Ghosty\'s apart', () => {
  assert.equal(REC.lapRecord('pass'), null);
  assert.deepEqual(REC.recordLap('pass', 41.2), { isBest: true, best: 41.2 });
  assert.deepEqual(REC.recordLap('pass', 43), { isBest: false, best: 41.2 });
  assert.equal(REC.recordLap('pass', 39.95).best, 39.95);
  assert.equal(REC.lapRecord('pass'), 39.95);
  assert.equal(REC.lapRecord('pass', true), null, 'Ghosty\'s are his own');
  REC.recordLap('pass', 38.5, true);
  assert.equal(REC.lapRecord('pass', true), 38.5);
  assert.equal(REC.lapRecord('pass'), 39.95);
  const kept = JSON.parse(store.get('ghosty.arcade.scores'));
  assert.ok(kept[REC.lapKey('pass')] && kept[REC.lapKey('pass', true)], 'both under ghosty.arcade.scores');
  assert.equal(REC.recordLap('pass', 0).isBest, false, 'a lap of nothing is not kept');
});

// ================================================================ THE HOPPER

const ALL = Array.from({ length: H.COLS * 2 + 1 }, (_, i) => i - H.COLS);
/** Where he can be on a row, coming from where he could be on the row before (worked out here, not by the generator). */
function nextReach(prev, row) {
  const walk = (ok) => {
    const out = new Set();
    for (const c0 of prev.filter(ok)) for (const s of [-1, 1]) for (let c = c0; Math.abs(c) <= H.COLS && ok(c); c += s) out.add(c);
    return [...out];
  };
  if (row.kind === 'grass') return walk((c) => !row.block.includes(c));
  if (row.kind === 'river' && row.pads.length) return walk((c) => row.pads.includes(c));
  return ALL;
}

test('the hopper: no row is ever impossible — gaps on the roads, logs in time, a window for every train, a way through the trees', () => {
  const kinds = {};
  for (let seed = 1; seed <= 25; seed++) {
    const run = H.newRun(seed);
    let reach = ALL;
    for (let r = 1; r <= 500; r++) {
      const row = H.rowAt(run, r);
      kinds[row.kind] = (kinds[row.kind] ?? 0) + 1;
      assert.deepEqual(H.rowProblems(row), [], `seed ${seed} row ${r}`);
      if (row.kind === 'road') assert.ok(H.gaps(row).every((g) => g >= H.GAP_MIN - 1e-9));
      if (row.kind === 'river' && !row.pads.length) assert.ok(H.gaps(row).every((g) => g <= H.LOG_GAP_MAX + 1e-9 && g >= 0));
      reach = nextReach(reach, row);
      assert.ok(reach.length > 0, `seed ${seed}: a way on at row ${r} (${row.kind})`);
    }
  }
  for (const k of ['grass', 'road', 'river', 'rail']) assert.ok(kinds[k] > 500, `${k} rows: ${kinds[k]}`);
});

/** A run with rows 1…n made by hand (the generator's left alone beyond them). */
function handRun(rows) {
  const run = H.newRun(1);
  rows.forEach((row, i) => run.rows.set(i + 1, { r: i + 1, block: [], dir: 1, speed: 0, movers: [], pads: [], train: null, coin: null, reach: ALL, deco: 0, ...row }));
  return run;
}
const play = (run, moves, seconds = 1.2) => {
  for (const m of moves) {
    H.step(run, m);
    for (let i = 0; i < 0.2 / H.STEP && run.p.alive; i++) H.step(run, 'none');
  }
  for (let i = 0; i < seconds / H.STEP && run.p.alive; i++) H.step(run, 'none');
};

test('the hopper: the kinds of end — a car, a lorry, a train, the water, the edge — and a tree only bonks', () => {
  const end = (row, moves = ['up'], seconds) => {
    const run = handRun([row]);
    play(run, moves, seconds);
    return run.p.death;
  };
  assert.equal(end({ kind: 'road', speed: 0.5, movers: [{ x0: 0, len: 1.5, kind: 'car', c: 0 }] }), 'car');
  assert.equal(end({ kind: 'road', speed: 0.5, movers: [{ x0: 0.5, len: 2.7, kind: 'lorry', c: 0 }] }), 'lorry');
  assert.equal(end({ kind: 'rail', train: { period: 10, phase: 0.45, len: 10, speed: 24 } }), 'train');
  assert.equal(end({ kind: 'river', speed: 0.5, movers: [{ x0: 8, len: 2, kind: 'log', c: 0 }] }), 'water');
  assert.equal(end({ kind: 'river', speed: 3, movers: [{ x0: 0, len: 3, kind: 'log', c: 0 }] }, ['up'], 3), 'edge');
  assert.equal(end({ kind: 'river', pads: [-1, 1] }), 'water', 'a pad river away from the pads');
  const safe = handRun([{ kind: 'river', pads: [0, 2] }]);
  play(safe, ['up']);
  assert.ok(safe.p.alive && safe.p.r === 1, 'on a pad he stands');
  const tree = handRun([{ kind: 'grass', block: [0] }]);
  play(tree, ['up']);
  assert.ok(tree.p.alive && tree.p.r === 0 && tree.events.some((e) => e.type === 'bonk'), 'a tree: he stays put');
  const ride = handRun([{ kind: 'river', speed: 1, movers: [{ x0: 0, len: 4, kind: 'log', c: 0 }] }]);
  play(ride, ['up'], 0.6);
  assert.ok(ride.p.alive && ride.p.onLog && ride.p.x > 0.3, 'a log carries him');
});

test('the hopper: the score is the furthest row; coins are taken once', () => {
  const run = handRun([{ kind: 'grass' }, { kind: 'grass', coin: 0 }, { kind: 'grass' }, { kind: 'grass' }]);
  play(run, ['up', 'up', 'up'], 0.1);
  assert.equal(run.best, 3);
  assert.equal(run.coins, 1);
  play(run, ['down', 'down'], 0.1);
  assert.equal(run.p.r, 1);
  assert.equal(run.best, 3, 'going back takes nothing off');
  play(run, ['up', 'up', 'up'], 0.1);
  assert.equal(run.coins, 1, 'the coin is gone once taken');
  assert.equal(run.best, 4);
  play(run, ['left', 'right'], 0.1);
  assert.equal(run.p.x, 0, 'a sidestep each way');
});

test('the hopper: the fog ends a run spent idle, never falls further back than its leash, and quickens to its top pace', () => {
  const idle = H.newRun(3);
  while (idle.p.alive && idle.t < 60) H.step(idle, 'none');
  assert.equal(idle.p.death, 'fog');
  assert.ok(idle.t > 6 && idle.t < 8.5, `caught after ${idle.t.toFixed(2)} s idle`);
  let prev = 0;
  for (let b = 0; b <= 1000; b += 10) {
    const p = H.fogPace(b);
    assert.ok(p >= prev && p <= H.FOG_TOP + 1e-12);
    prev = p;
  }
  assert.equal(H.fogPace(0), H.FOG_PACE);
  assert.equal(H.fogPace(10000), H.FOG_TOP);
  const run = handRun(Array.from({ length: 14 }, () => ({ kind: 'grass' })));
  for (let i = 0; i < 12; i++) {
    play(run, ['up'], 0.05);
    assert.ok(run.best - run.fog <= H.FOG_LEASH + 1e-9, `row ${run.best}: the fog ${(run.best - run.fog).toFixed(2)} behind`);
  }
  assert.ok(run.p.alive);
});

test('the hopper: Ghosty practises the same run for the same seed, and gets somewhere', () => {
  const a = H.ghostyPractice(11, 30), b = H.ghostyPractice(11, 30);
  assert.equal(a, b);
  let best = 0;
  for (let s = 1; s <= 6; s++) best = Math.max(best, H.ghostyPractice(s, 30));
  assert.ok(best >= 15, `his best of six: ${best} rows`);
});

// ================================================================ THE ARENA

/** An arena with only the cells given (by owner: 0 is you), no viruses, the pellets out of the way. */
function bare(cells) {
  const a = A.newArena(1);
  for (const p of a.players) (p.cells = []), (p.alive = false), (p.back = Infinity), (p.think = Infinity), (p.push = 0);
  for (const [owner, x, z, m] of cells) {
    const p = a.players[owner];
    p.alive = true;
    p.cells.push({ id: a.nextId++, owner, x, z, m, vx: 0, vz: 0, merge: 0 });
  }
  a.viruses = [];
  for (let i = 0; i < A.PELLETS; i++) (a.pellets[i * 2] = A.SIZE), (a.pellets[i * 2 + 1] = -A.SIZE);
  return a;
}

test('the arena: bigger eats smaller by the ratio, and only once it covers it', () => {
  assert.ok(A.canEat(50, 40) && !A.canEat(49.9, 40), 'the ratio, exactly');
  let a = bare([[0, 0, 0, 50], [1, 0.5, 0, 40]]);
  A.step(a);
  assert.ok(Math.abs(A.massOf(a.players[0]) - 90) < 0.05 && !a.players[1].alive && a.players[1].eatenBy === 0, 'covered: eaten whole');
  assert.ok(a.events.some((e) => e.type === 'eaten' && e.owner === 1 && e.by === 0));
  a = bare([[0, 0, 0, 50], [1, 0.5, 0, 41]]);
  A.step(a);
  assert.ok(a.players[1].alive && A.massOf(a.players[0]) < 51, 'not a quarter bigger: nothing eaten');
  a = bare([[0, 0, 0, 50], [1, 3.4, 0, 40]]);
  A.step(a);
  assert.ok(a.players[1].alive, 'big enough but only touching: nothing eaten');
  a = bare([[0, 0, 0, 40], [1, 0.5, 0, 50]]);
  A.step(a);
  assert.ok(!a.players[0].alive && a.over && a.events.some((e) => e.type === 'over' && e.eaten), 'you eaten: the round is over');
});

test('the arena: split halves and flings ahead, never past eight cells; the halves merge only after their timers', () => {
  const a = bare([[0, 0, 0, 100]]);
  const you = a.players[0];
  (you.hx = 1), (you.hz = 0);
  assert.ok(A.split(a, you));
  assert.equal(you.cells.length, 2);
  assert.deepEqual(you.cells.map((c) => c.m), [50, 50]);
  assert.ok(you.cells[1].vx > 50, 'the half is flung ahead');
  assert.ok(Math.abs(you.cells[0].merge - A.mergeTime(100)) < 1e-9);
  for (let i = 0; i < 5 / A.STEP; i++) A.step(a);
  assert.equal(you.cells.length, 2, 'apart while the timers run');
  for (let i = 0; i < 8 / A.STEP && you.cells.length > 1; i++) A.step(a);
  assert.equal(you.cells.length, 1, 'one again once they may');
  assert.ok(A.massOf(you) > 98 && A.massOf(you) <= 100.0001, `the mass kept (${A.massOf(you).toFixed(2)})`);
  const small = bare([[0, 0, 0, A.SPLIT_MIN - 1]]);
  assert.equal(A.split(small, small.players[0]), false, 'too small to split');
  const big = bare([[0, 0, 0, 5000]]);
  for (let k = 0; k < 6; k++) A.split(big, big.players[0]);
  assert.equal(big.players[0].cells.length, A.MAX_CELLS);
  const e = bare([[0, 0, 0, 60]]);
  assert.ok(A.eject(e, e.players[0]) && Math.abs(e.players[0].cells[0].m - (60 - A.EJECT_COST)) < 1e-9 && e.blobs.length === 1);
});

test('the arena: a virus pops a cell big enough to cover it into pieces, the mass kept; a small one slips by', () => {
  const a = bare([[0, 0, 0, 200]]);
  a.viruses = [{ x: 0.5, z: 0, m: A.VIRUS_MASS, vx: 0, vz: 0, feeds: 0, back: 0 }];
  A.step(a);
  const you = a.players[0];
  assert.ok(you.cells.length >= 4, `${you.cells.length} pieces`);
  const total = A.massOf(you);
  assert.ok(Math.abs(total - (200 + A.VIRUS_MASS / 2)) < 1.5, `the mass kept (${total.toFixed(1)})`);
  assert.ok(a.viruses[0].back > 0 && a.events.some((e) => e.type === 'pop'));
  assert.ok(you.cells.every((c) => c.merge > 5), 'the pieces wait to merge');
  const b = bare([[0, 0, 0, 100]]);
  b.viruses = [{ x: 0.5, z: 0, m: A.VIRUS_MASS, vx: 0, vz: 0, feeds: 0, back: 0 }];
  A.step(b);
  assert.equal(b.players[0].cells.length, 1, 'smaller than a quarter over the virus: no pop');
});

test('the arena: a whole round of the bots alone — they grow, hunt and come back; the table is in order', () => {
  const a = A.newArena(3, { you: false });
  const kinds = {};
  while (!a.over) {
    A.step(a);
    for (const e of a.events) kinds[e.type] = (kinds[e.type] ?? 0) + 1;
    a.events.length = 0;
  }
  assert.ok(Math.abs(a.t - A.ROUND) < 0.05, 'three minutes');
  assert.ok(kinds.pellet > 500 && kinds.eat > 0, JSON.stringify(kinds));
  const table = A.standings(a);
  assert.ok(table.length >= 8 && table.every((s, i) => Number.isFinite(s.m) && (i === 0 || table[i - 1].m >= s.m)));
  assert.ok(a.botPeak > A.START_MASS * 3, `the heaviest bot: ${a.botPeak.toFixed(0)}`);
  const tuned = A.newArena(1, { tempers: { hunter: { split: 0 } } });
  assert.equal(tuned.tempers.hunter.split, 0, 'the GYM can tune a temperament');
  assert.equal(tuned.tempers.hunter.prey, A.TEMPERS.hunter.prey, 'and only what it names');
  assert.deepEqual(Object.keys(A.TEMPERS).sort(), ['cautious', 'greedy', 'hunter']);
  assert.equal(A.BOT_NAMES.length, A.BOTS);
});

test('the arena keeps the Learnable contract: plain observations, a heading, a split or an eject a tick, mass × seconds', () => {
  const L = A.arenaLearnable(7);
  assert.deepEqual(checkLearnable(L, 120), []);
  const o = L.observe();
  assert.equal(o.pellets.length, 16, 'the eight nearest pellets');
  assert.ok(o.others.length > 0 && o.others.length <= 40 && o.others.length % 5 === 0, 'cells round it: place, size, heading');
  assert.ok(o.mass > 0 && o.timeLeft > 0);
  assert.equal(new Set(L.actions).size, 10);
  const s0 = L.score();
  for (let i = 0; i < 60; i++) L.act('e');
  assert.ok(L.score() > s0, 'the score grows with time and mass');
  assert.ok(L.arena.players[0].hx === 1 && L.arena.players[0].hz === 0, 'heading east');
});

// ================================================================ the shelf, the pads, the words

test('the shelf entries made by us: no data (madeByUs), their own engines, every field, ids of their own', () => {
  const CONTROLS = ['move', 'look', 'fire', 'use', 'weapon', 'jump', 'map'];
  const taken = new Set([...SHELF.map((e) => e.id), ...GAMES2.map((e) => e.id)]);
  assert.deepEqual(GAMES3.map((e) => e.id), [KART_ID, HOPPER_ID, ARENA_ID]);
  assert.deepEqual(GAMES3.map((e) => e.engine), ['kart', 'hopper', 'arena']);
  for (const e of GAMES3) {
    assert.ok(e.data !== null || e.madeByUs, `${e.id}: data or madeByUs`);
    assert.equal(e.data, null);
    assert.equal(e.madeByUs, true);
    assert.ok(!taken.has(e.id), `${e.id}: not an id the shelf has`);
    assert.match(e.title, /^THE [A-Z ]+$/);
    for (const k of ['line', 'ghosty', 'done']) assert.ok(e[k].trim().length > 10 && e[k].length <= 140, `${e.id}.${k}`);
    assert.ok(e.controls.length && e.controls.every((c) => CONTROLS.includes(c)), `${e.id}: controls`);
    assert.match(e.since, /^2026-\d\d-\d\d$/);
    assert.equal(typeof e.saves, 'boolean');
    assert.doesNotMatch(`${e.title} ${e.line} ${e.ghosty} ${e.done}`, /mario|crossy|agar|frogger|nintendo|hipster|slither/i);
  }
  const ACTIONS = ['fire', 'use', 'weapon', 'weaponPrev', 'jump', 'map', 'run', 'pause'];
  assert.deepEqual(Object.keys(GAMES3_PAD).sort(), ['arena', 'hopper', 'kart']);
  for (const [engine, map] of Object.entries(GAMES3_PAD)) {
    for (const [i, a] of Object.entries(map)) {
      assert.ok(Number(i) >= 0 && Number(i) <= 16, `${engine}: button ${i}`);
      assert.ok(ACTIONS.includes(a), `${engine}: ${a}`);
    }
    assert.ok(Object.values(map).includes('pause'), `${engine}: START pauses`);
  }
});

test('their catalogue words keep the rules and are keyed by the shelf ids', () => {
  assert.deepEqual(Object.keys(GAMES3_WORDS).sort(), GAMES3.map((e) => `arcade:${e.id}`).sort());
  for (const [k, v] of Object.entries(GAMES3_WORDS)) {
    assert.deepEqual(C.wordProblems(k, v), [], k);
    assert.equal(v.cat, 'play');
    assert.deepEqual(v.scene, ['playing']);
    assert.match(v.since, /^2026-11-0\d$/);
  }
  assert.doesNotMatch(JSON.stringify(GAMES3_WORDS), /mario|crossy|agar|frogger|nintendo/i);
});
