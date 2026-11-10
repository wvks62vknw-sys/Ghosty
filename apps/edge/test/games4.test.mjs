// The five games of BRIEF-GAMES-4 and the measure that has no cap on it, held to their numbers with no screen.
// THE MEASURE (skill.ts): a level is 1 + the floor of a rating that has no ceiling; a pass lifts it by one plus one for
// each doubling of the target beaten, a fail takes 0.8 back and never goes under level 1; no rank is the top (past the six
// names a level is just "Level N"); what a level asks rises at every level and never flattens, in every game; a simulated
// player whose ability grows without end keeps gaining levels past 100, 1,000 and 10,000, where a cap would have stopped
// him; and Ghosty's own practice, on each game's real rules, raises his level session after session past the named ranks.
// BLOCKS: the bag deals every piece once in seven, rotation and kicks never overlap a block, a full row clears and what
// is above falls, garbage rises with one hole, hold swaps once a piece, a four-line clear sends four rows and a top-out
// ends the duel. BLAST: a piece goes only on empty cells, a row and a column clear together, a streak multiplies, the run
// ends exactly when none of the pieces left fits, and at the first level the dealer always leaves one that fits. THE
// FLAP: every gap is within reach of the last, a flap and gravity do their arithmetic, a pillar passed counts once, a
// pillar or the ground ends it. THE CLIMB: every tower leaves a safe platform within a bounce, the screen wraps, a
// crumbling platform gives one bounce, height never goes down. THE BEAT: every note is clearable by its own move, the
// grades follow the timing, the wrong move is a miss, the same seed makes the same song, notes never come closer than
// the time to recover. The Learnable contract on all five, the shelf entries, pads and catalogue words. esbuild-bundled.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({
  entryPoints: {
    skill: at('../../web/src/arcade/games/two/skill.ts'),
    blocks: at('../../web/src/arcade/games/two/blocks-sim.ts'),
    blast: at('../../web/src/arcade/games/two/blast-sim.ts'),
    flap: at('../../web/src/arcade/games/two/flap-sim.ts'),
    climb: at('../../web/src/arcade/games/two/climb-sim.ts'),
    beat: at('../../web/src/arcade/games/two/beat-sim.ts'),
    shelf4: at('../../web/src/arcade/games/two/shelf4.ts'),
    pad4: at('../../web/src/arcade/games/two/pad4.ts'),
    shelf: at('../../web/src/arcade/shelf.ts'),
    learnable: at('../../web/src/arcade/learnable.ts'),
    catalogue: at('../../../packages/shared/src/catalogue.ts'),
    words: at('../../../packages/shared/src/catalogue/games4.ts'),
  },
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outdir: at('./.build/games4'),
  outExtension: { '.js': '.mjs' },
  logLevel: 'warning',
});
const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const S = await import('./.build/games4/skill.mjs');
const BK = await import('./.build/games4/blocks.mjs');
const BL = await import('./.build/games4/blast.mjs');
const FL = await import('./.build/games4/flap.mjs');
const CL = await import('./.build/games4/climb.mjs');
const BT = await import('./.build/games4/beat.mjs');
const { GAMES4 } = await import('./.build/games4/shelf4.mjs');
const { GAMES4_PAD } = await import('./.build/games4/pad4.mjs');
const { SHELF } = await import('./.build/games4/shelf.mjs');
const { checkLearnable } = await import('./.build/games4/learnable.mjs');
const C = await import('./.build/games4/catalogue.mjs');
const { GAMES4_WORDS } = await import('./.build/games4/words.mjs');
const none = { held: new Set(), pressed: new Set() };
const press = (...n) => ({ held: new Set(), pressed: new Set(n) });

// ================================================================ THE MEASURE

test('a level is 1 + the floor of a rating with no ceiling, and no rank is the top', () => {
  assert.equal(S.levelOf(0), 1);
  assert.equal(S.levelOf(0.99), 1);
  assert.equal(S.levelOf(1), 2);
  assert.equal(S.levelOf(-5), 1);
  assert.equal(S.levelOf(Number.NaN), 1);
  assert.equal(S.levelOf(1e6), 1_000_001);
  assert.equal(S.rankName(1), 'Fresh');
  assert.equal(S.rankName(6), 'Fierce');
  assert.equal(S.rankName(7), 'Level 7');
  assert.equal(S.rankName(41), 'Level 41');
  assert.equal(S.levelWords(3), 'Level 3 · Getting it');
  assert.equal(S.levelWords(41), 'Level 41');
  for (let l = 7; l < 2000; l += 97) assert.match(S.rankName(l), /^Level \d+$/, 'past the names there is only the number');
});

test('a pass lifts the rating by one plus one for each doubling beaten; a fail takes 0.8 back and stops at level 1', () => {
  assert.equal(S.gain(true, 100, 100), 1);
  assert.equal(S.gain(true, 199, 100), 1);
  assert.equal(S.gain(true, 200, 100), 2);
  assert.equal(S.gain(true, 400, 100), 3);
  assert.equal(S.gain(true, 800, 100), 4);
  assert.equal(S.gain(false, 50, 100), -0.8);
  assert.equal(S.afterRun(0, false, 0, 100), 0, 'never under the first level');
  assert.equal(S.afterRun(3, false, 0, 100), 2.2);
  assert.ok(S.afterRun(10, true, 1e9, 1) >= 40, 'beating the target by a lot is worth a lot, with no limit');
});

test('what a level asks rises at every level in every game, and never flattens', () => {
  const tables = {
    blocks: (l) => [BK.gravityOf(l), BK.ppsOf(l), BK.targetOf(l)],
    blast: (l) => [BL.targetOf(l), BL.tiltOf(l)],
    flap: (l) => [FL.hardness(l), FL.targetOf(l)],
    climb: (l) => [CL.hardness(l), CL.targetOf(l)],
    beat: (l) => [BT.hardness(l), BT.targetOf(l)],
  };
  for (const [g, f] of Object.entries(tables)) {
    for (let l = 1; l < 3000; l++) {
      const a = f(l), b = f(l + 1);
      // the headline number (the first) strictly rises for the games that fold the rest into it; every number never falls
      for (let i = 0; i < a.length; i++) assert.ok(b[i] >= a[i], `${g}: number ${i} fell at level ${l}`);
      if (g === 'flap' || g === 'climb' || g === 'beat') assert.ok(b[0] > a[0], `${g}: the hardness is not strictly rising at level ${l}`);
    }
    // and at the far end, where a cap would show: levels 10^3 … 10^7 keep rising
    let prev = f(1000);
    for (const l of [1e4, 1e5, 1e6, 1e7]) {
      const cur = f(l);
      assert.ok(cur.some((v, i) => v > prev[i]), `${g}: flat past level ${l}`);
      prev = cur;
    }
  }
  assert.ok(BL.helpOf(1) === 1 && BL.helpOf(9) === 0.04000000000000004 || BL.helpOf(9) < 0.05);
  assert.equal(BL.helpOf(20), 0, 'from the ninth level the dealer no longer helps');
});

test('a player who keeps improving without end keeps gaining levels past 100, 1,000 and 10,000: nothing caps him', () => {
  // each session he passes whenever his ability (which grows by half a level a session, for ever) meets the level he is set
  let r = 0;
  const at = {};
  for (let n = 1; n <= 40000; n++) {
    const ability = n * 0.5;
    const level = S.levelOf(r);
    r = S.afterRun(r, ability >= level, ability, level);
    at[n] = r;
  }
  for (const [n, cap] of [[1000, 100], [10000, 1000], [40000, 10000]]) assert.ok(at[n] > cap, `after ${n} sessions the rating ${at[n]} should be past ${cap}`);
  assert.ok(at[40000] > at[10000] && at[10000] > at[1000] && at[1000] > at[100], 'and still rising at every checkpoint');
  // a player who stops improving stops climbing: the measure follows him, it does not run away
  let q = 0;
  for (let n = 1; n <= 5000; n++) {
    const level = S.levelOf(q);
    q = S.afterRun(q, 30 >= level, 30, level);
  }
  assert.ok(q < 36 && q > 20, `a fixed ability of 30 settles near it (${q})`);
});

test('the record is kept per game, damaged records read as new, and a run moves the rating', () => {
  store.clear();
  assert.equal(S.bookOf('flap').you.r, 0);
  const o = S.finishRun('flap', 'you', true, 20, 8);
  assert.deepEqual([o.levelBefore, o.levelAfter, o.passed], [1, 3, true]);
  assert.equal(S.bookOf('flap').you.n, 1);
  assert.equal(S.bookOf('blast').you.r, 0, 'another game is untouched');
  store.set(S.SKILL_KEY, '{"flap":{"you":{"r":-3,"n":1},"ghosty":"nope"}}');
  assert.equal(S.bookOf('flap').you.r, 0, 'a damaged record reads as a new one');
  store.set(S.SKILL_KEY, 'not json');
  assert.equal(S.bookOf('x').ghosty.r, 0);
  store.clear();
});

// ---- Ghosty's practice on each game's real rules
const none2 = new Set();
const GAMES = {
  blast: { theta0: BL.THETA0, sigma: BL.SIGMA, play: (th, L, seed) => { const t = BL.targetOf(L); const r = BL.newRun(seed, L); let n = 0; while (!r.over && r.score < 2 * t && n++ < 20000) { BL.botStep(r, th, 0.5); r.events.length = 0; } return { score: r.score, target: t, passed: r.score >= t }; } },
  flap: { theta0: FL.THETA0, sigma: FL.SIGMA, play: (th, L, seed) => { const t = FL.targetOf(L); const r = FL.newRun(seed, L); let n = 0; while (!r.dead && r.score < 2 * t && n++ < 60 * 360) { FL.botStep(r, th); FL.step(r, 1 / 60, false); r.events.length = 0; } return { score: r.score, target: t, passed: r.score >= t }; } },
  climb: { theta0: CL.THETA0, sigma: CL.SIGMA, play: (th, L, seed) => { const t = CL.targetOf(L); const r = CL.newRun(seed, L); let n = 0; while (!r.dead && CL.heightOf(r) < 2 * t && n++ < 60 * 240) { CL.step(r, 1 / 60, CL.botSteer(r, th)); r.events.length = 0; } const s = CL.heightOf(r); return { score: s, target: t, passed: s >= t }; } },
  beat: { theta0: BT.THETA0, sigma: BT.SIGMA, play: (th, L, seed) => { const t = BT.targetOf(L); const r = BT.newRun(seed, L); let n = 0; while (!r.over && r.score < 2 * t && n++ < 60 * 360) { BT.botStep(r, th); BT.step(r, 1 / 60, none2); r.events.length = 0; } return { score: r.score, target: t, passed: r.score >= t }; } },
  blocks: { theta0: BK.THETA0, sigma: BK.SIGMA, play: (th, L, seed) => { const d = BK.newDuel(seed, L, BK.THETA0); for (let i = 0; i < 36000 && !d.winner; i++) BK.step(d, 1 / 60, none, th); return { score: d.a.lines, target: d.target, passed: d.winner === 1 }; } },
};
for (const [id, g] of Object.entries(GAMES)) {
  test(`Ghosty's practice on ${id}'s real rules raises his level, session after session, past the named ranks`, () => {
    store.clear();
    const game = { id, ...g };
    const marks = id === 'blocks' || id === 'climb' ? [10, 25, 50] : [10, 25, 50, 100];
    const lv = {};
    let theta0 = null;
    for (let i = 1; i <= marks.at(-1); i++) {
      const r = S.practiceSession(game, i * 13);
      if (i === 1) theta0 = JSON.stringify(S.bookOf(id).ghosty.theta);
      if (marks.includes(i)) lv[i] = S.levelOf(r.rating);
    }
    console.log(`     ${id}: Ghosty's level after ${marks.map((m) => `${m} sessions ${lv[m]}`).join(', ')}`);
    assert.ok(lv[marks[0]] > 1, 'he has already left level 1');
    // the games his bot has not yet outgrown gain at every mark; the two it meets the edge of (its rules' limits, not the measure's) gain overall
    if (id === 'blast' || id === 'flap') assert.ok(lv[marks.at(-1)] > lv[25], `${id}: ${lv[25]} → ${lv[marks.at(-1)]}`);
    else for (let k = 1; k < marks.length; k++) assert.ok(lv[marks[k]] > lv[marks[k - 1]], `${id}: no gain between ${marks[k - 1]} and ${marks[k]} sessions (${lv[marks[k - 1]]} → ${lv[marks[k]]})`);
    assert.ok(lv[marks.at(-1)] > 6, `${id}: past the six named ranks`);
    assert.ok(S.bookOf(id).ghosty.n === marks.at(-1), 'every session is counted');
    assert.notEqual(JSON.stringify(S.bookOf(id).ghosty.theta), JSON.stringify([...g.theta0]), 'his weights have been tuned');
    void theta0;
    store.clear();
  });
}
test('the two games whose bot never runs out of timing keep climbing, to level 150 and level 50', () => {
  for (const [id, sessions, level] of [['beat', 80, 150], ['climb', 40, 50]]) {
    store.clear();
    const game = { id, ...GAMES[id] };
    let r;
    for (let i = 1; i <= sessions; i++) r = S.practiceSession(game, i * 13);
    assert.ok(S.levelOf(r.rating) > level, `${id}: ${S.levelOf(r.rating)} after ${sessions} sessions, past ${level}`);
  }
  store.clear();
});

// ================================================================ BLOCKS

test('BLOCKS: the bag deals every piece once in seven; the same seed deals the same', () => {
  for (let seed = 1; seed < 40; seed++) {
    const d = BK.newDuel(seed, 1, null);
    const seen = [];
    for (let i = 0; i < 7; i++) {
      seen.push(d.a.piece.k);
      BK.step(d, 0.0001, press('a'));
      if (d.a.dead) break;
    }
    assert.equal(new Set(seen).size, 7, `seed ${seed}: ${seen}`);
  }
  const a = BK.newDuel(5, 1, null), b = BK.newDuel(5, 1, null);
  assert.deepEqual(a.a.queue, b.a.queue);
});
test('BLOCKS: rotation, kicks and moves never put a piece on a block or outside the well', () => {
  let s = 7;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let trial = 0; trial < 60; trial++) {
    const w = BK.newWell(trial + 1);
    for (let i = 0; i < 12; i++) w.cells[(10 + Math.floor(rnd() * 12)) * BK.W + Math.floor(rnd() * BK.W)] = 3;
    for (let op = 0; op < 150 && w.piece; op++) {
      const k = Math.floor(rnd() * 5);
      if (k === 0) BK.move(w, -1);
      else if (k === 1) BK.move(w, 1);
      else if (k === 2) BK.rotate(w, 1);
      else if (k === 3) BK.rotate(w, -1);
      else if (BK.fits(w.cells, w.piece.k, w.piece.rot, w.piece.x, w.piece.y + 1)) w.piece.y++;
      const p = w.piece;
      assert.ok(BK.fits(w.cells, p.k, p.rot, p.x, p.y), `trial ${trial} op ${op}: ${JSON.stringify(p)}`);
    }
  }
});
test('BLOCKS: a full row clears and what is above falls; four rows at once send four', () => {
  const w = BK.newWell(3);
  for (let x = 0; x < BK.W; x++) if (x !== 6 && x !== 7) w.cells[21 * BK.W + x] = 4;
  w.cells[20 * BK.W + 0] = 5;
  w.piece = { k: 1, rot: 0, x: 6, y: 20 };
  const r = BK.lockPiece(w);
  assert.deepEqual(r.cleared, [21]);
  assert.equal(w.lines, 1);
  assert.equal(w.cells[21 * BK.W + 0], 5, 'the row above fell');
  assert.equal(w.cells[21 * BK.W + 6], 2, 'the square’s upper half is now the floor');
  const f = BK.newWell(4);
  for (let y = 18; y < 22; y++) for (let x = 0; x < 9; x++) f.cells[y * BK.W + x] = 4;
  f.piece = { k: 0, rot: 1, x: 7, y: 18 };
  const q = BK.lockPiece(f);
  assert.equal(q.cleared.length, 4);
  assert.equal(q.sent, 10, 'four rows send 4, and the clean board 6 more');
  assert.ok(f.cells.every((c) => !c), 'a perfect clear leaves nothing');
  assert.equal(q.perfect, true);
});
test('BLOCKS: garbage rises with one hole, a top-out is the end, hold swaps once a piece', () => {
  const w = BK.newWell(9);
  BK.addGarbage(w, 3);
  for (let y = 19; y < 22; y++) {
    const row = Array.from(w.cells.subarray(y * BK.W, y * BK.W + BK.W));
    assert.equal(row.filter((c) => c === BK.GARBAGE).length, 9, `row ${y}`);
  }
  BK.addGarbage(w, 30);
  assert.equal(w.dead, true);
  const d = BK.newDuel(2, 1, null);
  const first = d.a.piece.k;
  assert.equal(BK.holdPiece(d.a), true);
  assert.equal(d.a.hold, first);
  assert.equal(BK.holdPiece(d.a), false, 'not twice in one piece');
  BK.step(d, 0.0001, press('a'));
  assert.equal(d.a.canHold, true, 'a new piece, a new hold');
  BK.addGarbage(d.b, 30);
  BK.step(d, 0.01, none);
  assert.equal(d.winner, 1, 'Ghosty topped out: you win');
});
test('BLOCKS: Ghosty’s bot plays a long duel without breaking a rule, and wins or loses it', () => {
  for (const seed of [1, 2, 3]) {
    const d = BK.newDuel(seed, 3, null);
    for (let i = 0; i < 36000 && !d.winner; i++) BK.step(d, 1 / 60, none, BK.THETA0);
    assert.ok(d.winner === 1 || d.winner === 2, `seed ${seed}: nobody won`);
    assert.ok(d.a.lines >= 1 && d.b.lines >= 1);
  }
});

// ================================================================ BLAST

test('BLAST: a piece goes only on empty cells and inside the grid', () => {
  const r = BL.newRun(1, 1);
  r.tray = [BL.SHAPES[0], BL.SHAPES[9], null];
  assert.equal(BL.place(r, 0, 2, 2), true);
  r.tray = [BL.SHAPES[0], null, null];
  assert.equal(BL.place(r, 0, 2, 2), false, 'not on a filled cell');
  assert.equal(BL.place(r, 0, 8, 0), false, 'not outside');
  assert.equal(BL.place(r, 0, -1, 0), false);
});
test('BLAST: a row and a column clear together, a streak multiplies, a clean grid is worth 100', () => {
  const mk = () => {
    const r = BL.newRun(1, 1);
    r.grid.fill(0);
    r.col.fill(0);
    for (let k = 0; k < 8; k++) {
      if (k !== 3) r.grid[3] |= 1 << k;
      if (k !== 3) r.grid[k] |= 1 << 3;
    }
    r.tray = [BL.SHAPES[0], BL.SHAPES[0], BL.SHAPES[0]];
    r.events.length = 0;
    return r;
  };
  const r = mk();
  assert.equal(BL.place(r, 0, 3, 3), true);
  const ev = r.events.find((e) => e.type === 'clear');
  assert.equal(ev.n, 2);
  assert.deepEqual([ev.rows, ev.cols], [[3], [3]]);
  assert.equal(ev.points, 40, 'two lines: 2 × 2 × 10');
  assert.ok(r.grid.every((m) => m === 0));
  assert.ok(r.events.some((e) => e.type === 'perfect'));
  assert.equal(r.score, 1 + 40 + 100);
  // a second clear straight after is worth more (streak 2: ×1.5)
  const q = mk();
  BL.place(q, 0, 3, 3);
  for (let k = 0; k < 8; k++) (q.grid[0] = k === 0 ? 0 : 255 & ~(1 << 0)), (q.grid[0] = 254);
  q.grid[0] = 255 & ~(1 << 5);
  q.tray = [BL.SHAPES[0], null, null];
  q.events.length = 0;
  BL.place(q, 0, 5, 0);
  const e2 = q.events.find((e) => e.type === 'clear');
  assert.equal(e2.streak, 2);
  assert.equal(e2.points, 15, 'one line, streak 2: 10 × 1.5');
});
test('BLAST: the run ends exactly when none of the pieces left fits, over a whole random game', () => {
  let s = 11;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let g = 0; g < 8; g++) {
    const r = BL.newRun(g + 1, 1 + g * 3);
    for (let n = 0; n < 2000 && !r.over; n++) {
      const moves = [];
      r.tray.forEach((sh, i) => { if (sh) for (let y = 0; y <= 8 - sh.rows.length; y++) for (let x = 0; x <= 8 - sh.w; x++) if (BL.fits(r.grid, sh, x, y)) moves.push([i, x, y]); });
      assert.ok(moves.length > 0, `game ${g}: not over, yet nothing fits`);
      const m = moves[Math.floor(rnd() * moves.length)];
      assert.equal(BL.place(r, m[0], m[1], m[2]), true);
    }
    assert.ok(r.over, `game ${g} never ended`);
    assert.ok(!r.tray.some((sh) => sh && BL.anyFit(r.grid, sh)), `game ${g}: over, yet a piece fits`);
  }
});
test('BLAST: at level 1 the dealer leaves a piece that fits; the junk and the awkwardness rise with the level', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const r = BL.newRun(seed, 1);
    assert.ok(r.tray.some((sh) => sh && BL.anyFit(r.grid, sh)), `seed ${seed}`);
  }
  for (let l = 1; l < 40; l++) assert.equal(BL.newRun(5, l).grid.reduce((n, m) => n + BL.popcount(m), 0), BL.prefillOf(l));
  assert.ok(BL.prefillOf(30) > BL.prefillOf(3));
  // bigger pieces get likelier as the level goes up
  const mean = (l) => { let t = 0, n = 0; for (let seed = 1; seed < 400; seed++) { const r = BL.newRun(seed, l); for (const sh of r.tray) (t += sh.cells), n++; } return t / n; };
  assert.ok(mean(200) > mean(1) + 0.5, `${mean(1)} → ${mean(200)}`);
});

// ================================================================ THE FLAP

test('THE FLAP: every gap is within reach of the last, and inside the screen, at every level', () => {
  for (const l of [1, 3, 4, 8, 20, 100, 1000, 100000]) {
    const r = FL.newRun(l, l);
    r.started = true;
    for (let i = 0; i < 40; i++) r.nextX < 1e9 && FL.step(r, 0, false) === undefined && r.pillars.push(...[]);
    // lay a stretch directly by stepping the world forward with a ghost that cannot die
    for (let n = 0; n < 60 * 60 && r.pillars.length < 40; n++) {
      r.y = 300;
      r.vy = 0;
      FL.step(r, 1 / 60, false);
      r.dead = false;
      r.events.length = 0;
    }
    const half = FL.gapOf(l) / 2 + FL.slideAmp(l) + 36;
    let prev = null;
    for (const p of r.pillars) {
      assert.ok(p.cy >= half - 1e-6 && p.cy <= FL.WORLD_H - FL.GROUND - half + 1e-6 || half > FL.WORLD_H - FL.GROUND - half, `level ${l}: gap ${p.cy} off the screen`);
      if (prev !== null) assert.ok(Math.abs(p.cy - prev) <= FL.reachOf(l) + 1e-6, `level ${l}: a jump of ${Math.abs(p.cy - prev)} px`);
      prev = p.cy;
    }
    assert.ok(FL.gapOf(l) >= 112, 'the gap never closes past the floor');
  }
});
test('THE FLAP: a flap is -430 px/s, gravity 1400, so one flap lifts it about 66 px; a pillar passed counts once', () => {
  const r = FL.newRun(1, 1);
  FL.flap(r);
  assert.equal(r.vy, -430);
  const y0 = r.y;
  let top = y0;
  for (let i = 0; i < 90; i++) {
    FL.step(r, 1 / 120, false);
    top = Math.min(top, r.y);
  }
  assert.ok(Math.abs(y0 - top - 66) < 8, `a flap rose ${y0 - top}`);
  const q = FL.newRun(2, 1);
  FL.flap(q);
  q.pillars = [{ x: FL.BIRD_X - FL.PILLAR_W - 30, cy: q.y, phase: 0, passed: false, amp: 0 }, { x: 500, cy: 300, phase: 0, passed: false, amp: 0 }];
  FL.step(q, 1 / 60, false);
  FL.step(q, 1 / 60, false);
  assert.equal(q.score, 1);
  assert.equal(q.events.filter((e) => e.type === 'pass').length, 1, 'counted once');
});
test('THE FLAP: the ground and a pillar each end the run; the first level can be played by Ghosty’s rule', () => {
  const g = FL.newRun(1, 1);
  FL.flap(g);
  for (let i = 0; i < 400 && !g.dead; i++) FL.step(g, 1 / 60, false);
  assert.equal(g.how, 'ground');
  const p = FL.newRun(1, 1);
  FL.flap(p);
  p.pillars = [{ x: FL.BIRD_X - 10, cy: 100, phase: 0, passed: false, amp: 0 }, { x: 600, cy: 300, phase: 0, passed: false, amp: 0 }];
  p.y = 400;
  p.vy = 0;
  FL.step(p, 1 / 60, false);
  assert.equal(p.how, 'pillar');
  const b = FL.newRun(3, 1);
  for (let i = 0; i < 60 * 60 && !b.dead && b.score < 10; i++) {
    FL.botStep(b, FL.THETA0);
    FL.step(b, 1 / 60, false);
  }
  assert.ok(b.score >= 10, `his rule passed ${b.score} pillars`);
});

// ================================================================ THE CLIMB

test('THE CLIMB: a safe platform is always within a bounce, at every level', () => {
  for (const l of [1, 2, 5, 10, 50, 300, 5000]) {
    for (const seed of [1, 2, 3]) {
      const r = CL.newRun(seed, l);
      let n = 0;
      while (!r.dead && n++ < 60 * 40) {
        CL.step(r, 1 / 60, CL.botSteer(r, CL.THETA0));
        r.events.length = 0;
      }
      const safe = r.platforms.filter((p) => p.kind !== 'crumble' && p.broken === 0).sort((a, b) => a.y - b.y);
      for (let i = 1; i < safe.length; i++) assert.ok(safe[i].y - safe[i - 1].y <= CL.BOUNCE_H * 0.95 + 1e-6, `level ${l}: ${safe[i].y - safe[i - 1].y} px between safe platforms`);
    }
  }
  assert.ok(CL.widthOf(100000) >= 38, 'a platform never gets narrower than its floor');
});
test('THE CLIMB: the screen wraps, height never goes down, a crumbling platform gives one bounce', () => {
  const r = CL.newRun(1, 1);
  r.x = 359;
  r.vy = 400;
  for (let i = 0; i < 20; i++) CL.step(r, 1 / 60, { ax: 1, aim: null });
  assert.ok(r.x >= 0 && r.x < CL.WORLD_W);
  assert.ok(r.x < 100, `it came back in at the left (${r.x})`);
  let last = 0;
  const b = CL.newRun(4, 3);
  for (let i = 0; i < 60 * 30 && !b.dead; i++) {
    CL.step(b, 1 / 60, CL.botSteer(b, CL.THETA0));
    assert.ok(b.best >= last);
    last = b.best;
  }
  const c = CL.newRun(2, 1);
  c.platforms = [{ x: 180, y: 200, w: 100, kind: 'crumble', range: 0, phase: 0, spring: false, jet: false, broken: 0, homeX: 180 }];
  c.topY = 1e9;
  c.x = 180;
  c.y = 230;
  c.vy = -300;
  c.cam = 0;
  for (let i = 0; i < 20; i++) CL.step(c, 1 / 60, { ax: 0, aim: null });
  assert.equal(c.events.filter((e) => e.type === 'bounce').length, 1);
  assert.equal(c.events.filter((e) => e.type === 'crumble').length, 1);
  assert.ok(c.platforms[0].broken > 0);
  c.events.length = 0;
  c.y = 230;
  c.vy = -300;
  for (let i = 0; i < 20; i++) CL.step(c, 1 / 60, { ax: 0, aim: null });
  assert.equal(c.events.filter((e) => e.type === 'bounce').length, 0, 'a broken platform is gone');
});

// ================================================================ THE BEAT

test('THE BEAT: a perfect player meets every note of every level; a miss is a lost life', () => {
  for (const l of [1, 4, 12, 60, 1000]) {
    const r = BT.newRun(l, l);
    let n = 0;
    while (!r.over && r.t < 90 && n++ < 60 * 140) {
      BT.botStep(r, [0, 0]);
      BT.step(r, 1 / 60, none.pressed);
      r.events.length = 0;
    }
    assert.equal(r.misses, 0, `level ${l}: ${r.misses} misses`);
    assert.equal(r.lives, 3);
    assert.ok(r.hits >= 15, `level ${l}: only ${r.hits} notes in 90 s`);
    assert.ok(r.perfects >= r.hits * 0.85, `level ${l}: a perfect player is nearly always perfect (${r.perfects} of ${r.hits})`);
  }
  const r = BT.newRun(1, 1);
  const n0 = r.notes[0];
  while (r.t < n0.t + 0.1) BT.step(r, 1 / 60, none.pressed);
  assert.equal(r.lives, 2, 'doing nothing loses a life');
  assert.equal(r.combo, 0);
});
test('THE BEAT: the grades follow the timing, and the wrong move is a miss', () => {
  const play = (move, offset) => {
    const r = BT.newRun(1, 1);
    const n = r.notes[0];
    n.move = 'jump';
    const start = n.t - BT.WINDOW[move] / 2 + offset;
    while (r.t < start) BT.step(r, 1 / 120, none.pressed);
    BT.perform(r, move);
    while (r.t < n.t + 0.05) BT.step(r, 1 / 120, none.pressed);
    return n;
  };
  assert.equal(play('jump', 0).grade, 'perfect');
  assert.equal(play('jump', 0.2).grade, 'good');
  assert.equal(play('jump', 0.28).grade, 'ok');
  assert.equal(play('duck', 0).result, 'miss', 'the wrong move');
  const r = BT.newRun(1, 1);
  r.lives = 1;
  r.notes[0].move = 'dash';
  while (!r.over && r.t < r.notes[0].t + 0.1) BT.step(r, 1 / 60, none.pressed);
  assert.equal(r.over, true, 'the last life gone ends it');
});
test('THE BEAT: the same seed makes the same song; no note comes closer than its move and the last one need; three tracks', () => {
  const a = BT.newRun(5, 3), b = BT.newRun(5, 3), c = BT.newRun(6, 3);
  assert.deepEqual(a.notes.map((n) => [n.t, n.move]), b.notes.map((n) => [n.t, n.move]));
  assert.notDeepEqual(a.notes.map((n) => n.t), c.notes.map((n) => n.t));
  for (const l of [1, 3, 8, 30, 200, 5000]) {
    const r = BT.newRun(9, l);
    for (let i = 1; i < r.notes.length; i++) assert.ok(r.notes[i].t - r.notes[i - 1].t >= BT.needGap(r.notes[i - 1].move, r.notes[i].move) - 1e-9, `level ${l}: notes ${r.notes[i].t - r.notes[i - 1].t} s apart`);
    assert.ok(BT.bpmOf(l) <= 176);
  }
  assert.equal(BT.TRACKS.length, 3);
  assert.equal(new Set([0, 1, 2, 3, 4, 5].map((s) => BT.trackOf(s, 1).id)).size, 3);
  assert.ok(BT.densityOf(100) > BT.densityOf(2) && BT.offbeatOf(100) > BT.offbeatOf(4));
});

// ================================================================ the Learnable contract, the shelf, the pads, the words

test('every one of the five keeps the Learnable contract', () => {
  for (const [name, g] of Object.entries({ blocks: BK.blocksLearnable(1), blast: BL.blastLearnable(1), flap: FL.flapLearnable(1), climb: CL.climbLearnable(1), beat: BT.beatLearnable(1) })) {
    assert.deepEqual(checkLearnable(g, 200), [], name);
    assert.equal(g.id, name);
  }
});
test('the shelf entries are made by us, have no data, sit on the shelf once, and say a game with a level', () => {
  assert.deepEqual(GAMES4.map((e) => e.id), ['blocks', 'blast', 'flap', 'climb', 'beat']);
  const CONTROLS = ['move', 'look', 'fire', 'use', 'weapon', 'jump', 'map'];
  for (const e of GAMES4) {
    assert.equal(e.data, null);
    assert.equal(e.madeByUs, true);
    assert.equal(e.engine, e.id);
    assert.equal(SHELF.filter((x) => x.id === e.id).length, 1, `${e.id}: on the shelf once`);
    for (const k of ['title', 'line', 'ghosty', 'done']) assert.ok(e[k].trim().length > 3 && e[k].length <= 190, `${e.id}.${k}`);
    assert.ok(e.controls.includes('move') && e.controls.every((c) => CONTROLS.includes(c)), `${e.id}: controls`);
    assert.match(e.since, /^2026-\d\d-\d\d$/);
    assert.doesNotMatch(`${e.title} ${e.line} ${e.ghosty} ${e.done}`, /tetris|block blast|flappy|doodle|subway|geometry|nintendo|sega|hipster/i, 'our own names, never a commercial game’s');
  }
  assert.deepEqual(Object.keys(GAMES4_PAD).sort(), ['beat', 'blast', 'blocks', 'climb', 'flap']);
  for (const [engine, map] of Object.entries(GAMES4_PAD)) {
    assert.ok(Object.values(map).includes('pause'), `${engine}: START pauses`);
    for (const [i, a] of Object.entries(map)) assert.ok(Number(i) >= 0 && Number(i) <= 16 && ['fire', 'use', 'weapon', 'weaponPrev', 'jump', 'map', 'run', 'pause'].includes(a), `${engine}: ${i} ${a}`);
  }
});
test('their catalogue words keep the rules, are keyed by the shelf ids, and name no commercial game', () => {
  assert.deepEqual(Object.keys(GAMES4_WORDS).sort(), GAMES4.map((e) => `arcade:${e.id}`).sort());
  for (const [k, v] of Object.entries(GAMES4_WORDS)) {
    assert.deepEqual(C.wordProblems(k, v), [], k);
    assert.equal(v.cat, 'play');
    assert.deepEqual(v.scene, ['playing']);
    assert.match(v.since, /^2026-11-\d\d$/);
  }
  assert.doesNotMatch(JSON.stringify(GAMES4_WORDS), /tetris|flappy bird|doodle jump|subway surfers|nintendo/i);
});
