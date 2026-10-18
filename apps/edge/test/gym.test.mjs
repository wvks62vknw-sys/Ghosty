// The GYM (apps/web/src/gym): ten games Ghosty teaches himself on the phone. For each: the rules, the
// problem maker and checker (generate / check: what a later part turns into reasoning problems), the
// ground-truth measure, and that a short seeded training run really improves the mastery measure. Plus the
// session that moves up a level by itself, and the worker's message protocol.
// (Run from offline.test.mjs, which is in the test list; package.json is protected.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({
  entryPoints: ['core', 'meta', 'index', 'session', 'worker', 'maze', 'codebreaker', 'colony', 'trust', 'tictactoe', 'connect4', 'tiles', 'sudoku', 'countdown', 'words'].map((f) => at(`../../web/src/gym/${f}.ts`)),
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outdir: at('./.build/gym'),
  outExtension: { '.js': '.mjs' },
  logLevel: 'warning',
});
const load = (f) => import(`./.build/gym/${f}.mjs`);
const C = await load('core');
const { GAMES, gameById } = await load('index');
const S = await load('session');
const W = await load('worker');
const MZ = await load('maze');
const CB = await load('codebreaker');
const CO = await load('colony');
const TR = await load('trust');
const TT = await load('tictactoe');
const C4 = await load('connect4');
const TI = await load('tiles');
const SU = await load('sudoku');
const CD = await load('countdown');
const WD = await load('words');

/** Train in steps until the mastery bar (or the cap); returns [first, last] mastery and units used. */
function climb(learner, bar, step, cap) {
  const first = learner.measure().mastery;
  let units = 0;
  let m = first;
  while (m < bar && units < cap) {
    units += learner.train(step);
    m = learner.measure().mastery;
  }
  return { first, last: m, units };
}

// ---------------------------------------------------------------------------------------------------------
test('gym: ten games, one interface — every engine resets, lists moves, steps and describes itself', () => {
  assert.deepEqual(
    GAMES.map((g) => g.id),
    ['maze', 'codebreaker', 'colony', 'trust', 'tictactoe', 'connect4', 'tiles', 'sudoku', 'countdown', 'words'],
  );
  for (const g of GAMES) {
    for (const level of [1, 10]) {
      const e = g.env(level);
      e.reset(42);
      const acts = e.actions();
      assert.ok(acts.length > 0, `${g.id} L${level}: no moves`);
      const r = e.step(acts[0]);
      assert.equal(typeof r.reward, 'number', `${g.id}: reward`);
      assert.equal(typeof r.done, 'boolean', `${g.id}: done`);
      assert.ok(e.describe().length > 20, `${g.id}: describe`);
    }
    assert.ok(g.title && g.learns && g.unit, g.id);
    for (let l = 1; l <= 10; l++) assert.ok(g.bar(l) > 0 && g.bar(l) <= 1, `${g.id} bar L${l}`);
    assert.equal(gameById(g.id), g);
  }
  // Seeded: the same seed, the same numbers.
  const a = C.rng(5);
  const b = C.rng(5);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});

/** A right answer to each game's problem, worked out from its own data and ground truth. */
const RIGHT = {
  maze(p) {
    const m = MZ.makeMaze(p.data.level, p.data.seed);
    const dist = MZ.cheapest(m);
    let c = p.data.start;
    let s = '';
    while (c !== m.gold) {
      for (let d = 0; d < 4; d++) {
        const st = MZ.stepMaze(m, c, d);
        if (st.bump) continue;
        const cost = m.cells[st.to] === MZ.MUD ? 3 : 1;
        if (dist[st.to] === dist[c] - cost) {
          s += 'NESW'[d];
          c = st.to;
          break;
        }
      }
    }
    return s;
  },
  codebreaker: (p) => p.data.answer,
  colony(p) {
    const R = CO.rules(p.data.level);
    const V = CO.optimum(R);
    const idx = (s) => ((s.day * 21 + Math.max(0, s.e)) * 21 + s.m) * 11 + s.p;
    const plan = [];
    let s = p.data.start;
    while (s.day < R.days) {
      let best = -1;
      let bv = -Infinity;
      for (let a = 0; a < 3; a++) {
        if (!CO.canDo(s, a)) continue;
        const r = CO.day(s, a, R);
        const v = r.reward + (r.done ? 0 : V[idx(r.next)]);
        if (v > bv) (bv = v), (best = a);
      }
      plan.push(['MINE', 'BUILD', 'REST'][best]);
      const r = CO.day(s, best, R);
      s = r.next;
      if (r.done) break;
    }
    return plan.join(' ');
  },
  trust: (p) => String(p.data.answer),
  tictactoe: (p) => String(p.data.best[0]),
  connect4: (p) => String(p.data.best[0]),
  tiles(p) {
    const s = TI.astar(p.data.board, p.data.n, (b) => TI.manhattan(b, p.data.n) + TI.linearConflict(b, p.data.n), 1e7);
    return s.moves.map((d) => 'UDLR'[d]).join('');
  },
  sudoku: (p) => (p.data.kind === 'sudoku' ? p.data.solution.join('') : p.data.people.map((nm, i) => `${nm}: ${p.data.answer[i].join(', ')}`).join('\n')),
  countdown(p) {
    // Turn the solver's steps into one expression.
    const steps = CD.solve(p.data.nums, p.data.target, p.data.exact);
    const exprs = p.data.nums.map((n) => ({ v: n, t: String(n) }));
    for (const s of steps) {
      const ia = exprs.findIndex((e) => e.v === s.a);
      const a = exprs.splice(ia, 1)[0];
      const ib = exprs.findIndex((e) => e.v === s.b);
      const b = exprs.splice(ib, 1)[0];
      exprs.push({ v: s.r, t: `(${a.t} ${'+-*/'[s.op]} ${b.t})` });
    }
    return exprs.find((e) => e.v === p.data.target).t;
  },
  words: (p) => p.data.answer,
};
/** The right answer written the way a person (or a model) might: a label, words, a sentence. */
const MAZE_WORDS = { N: 'north', E: 'east', S: 'south', W: 'west' };
const TILE_WORDS = { U: 'up', D: 'down', L: 'left', R: 'right' };
const LABELLED = {
  maze: (p, r) => `Working it out step by step.\nRoute: ${[...r].map((c) => MAZE_WORDS[c]).join(', ')}`,
  codebreaker: (p, r) => `Looking at the clues one by one.\nAfter ${p.text.split('\n').length - 2} clues, the code is ${r.split('').join(' ')}`,
  colony: (p, r) => `Plan:\n${r.split(' ').map((a, i) => `Day ${i + 1}: ${a}`).join('\n')}`,
  trust: (p, r) => `Round by round it adds up.\nSo A scores ${r} points.`,
  tictactoe: (p, r) => `I would play square ${r}.`,
  connect4: (p, r) => `**Answer:** column ${r}`,
  tiles: (p, r) => `Solution: ${[...r].map((c) => TILE_WORDS[c]).join(' ')}`,
  sudoku: (p, r) => (p.data.kind === 'sudoku' ? `Here is the grid.\n${[...Array(9).keys()].map((i) => `Row ${i + 1}: ${r.slice(i * 9, i * 9 + 9).split('').join(' ')}`).join('\n')}` : `Answer:\n${r}`),
  countdown: (p, r) => `Answer: ${r.replace(/\*/g, '×')} = ${p.data.target}`,
  words: (p, r) => `The word is ${r.toUpperCase()}.`,
};
/** Near misses: answers that look right but are not. */
const WRONG = {
  maze(p) {
    // The cheapest route with a step there and back added (still reaches the gold, costs more), or one step short.
    const r = RIGHT.maze(p);
    const m = MZ.makeMaze(p.data.level, p.data.seed);
    for (let d = 0; d < 4; d++) {
      const st = MZ.stepMaze(m, p.data.start, d);
      if (!st.bump && !st.done) return `${'NESW'[d]}${'NESW'[(d + 2) % 4]}${r}`;
    }
    return r.slice(0, -1);
  },
  codebreaker: (p) => p.data.answer.split('').reverse().join('') === p.data.answer ? p.data.answer.replace(/^./, (c) => String((Number(c) % 2) + 1)) : p.data.answer.split('').reverse().join(''),
  colony(p) {
    // The best plan with its first action changed to something else that is allowed.
    const plan = RIGHT.colony(p).split(' ');
    plan[0] = plan[0] === 'REST' ? 'MINE' : 'REST';
    return plan.join(' ');
  },
  trust: (p) => String(p.data.answer + 1),
  tictactoe: (p) => String(p.data.board.map((x, i) => (x ? -1 : i + 1)).find((sq) => sq > 0 && !p.data.best.includes(sq))),
  connect4: (p) => String([1, 2, 3, 4, 5, 6, 7].find((c) => !p.data.best.includes(c) && p.data.board[(c - 1) * 6 + 5] === 0)),
  tiles(p) {
    // A real solution with a wasted pair of moves in front.
    const r = RIGHT.tiles(p);
    for (const [a, b] of [['U', 'D'], ['D', 'U'], ['L', 'R'], ['R', 'L']]) if (TI.slide(p.data.board, p.data.n, 'UDLR'.indexOf(a))) return a + b + r;
    return r.slice(1);
  },
  sudoku(p) {
    if (p.data.kind === 'sudoku') {
      // Two of the empty cells' answers swapped (a grid that looks finished).
      const v = p.data.solution.slice();
      const blanks = p.data.puzzle.map((x, i) => (x ? -1 : i)).filter((i) => i >= 0);
      const j = blanks.find((k) => v[k] !== v[blanks[0]]);
      [v[blanks[0]], v[j]] = [v[j], v[blanks[0]]];
      return v.join('');
    }
    // Two people's answers swapped.
    const a = p.data.answer.slice();
    [a[0], a[1]] = [a[1], a[0]];
    return p.data.people.map((nm, i) => `${nm}: ${a[i].join(', ')}`).join('\n');
  },
  countdown(p) {
    // The right expression with its last number nudged by one (still all the numbers' look, the wrong result).
    const r = RIGHT.countdown(p);
    return r.replace(/(\d+)(\)*)$/, (_, n, br) => `${Number(n) + 1}${br}`);
  },
  words(p) {
    const list = WD.WORDS.slice(0, WD.listSize(p.level));
    return list.find((w) => w !== p.data.answer && w[0] === p.data.answer[0]) ?? list.find((w) => w !== p.data.answer);
  },
};

test('gym: every game makes checkable problems at every level — same seed, same problem; the right answer passes, a wrong one fails', () => {
  for (const g of GAMES) {
    for (const level of [1, 4, 7, 10]) {
      for (const seed of [2, 3]) {
        const p = g.generate(level, seed);
        assert.equal(p.game, g.id);
        assert.equal(p.level, level);
        assert.ok(p.text.length > 30, `${g.id}: text`);
        assert.equal(g.generate(level, seed).text, p.text, `${g.id} L${level}: not deterministic`);
        const ok = g.check(p, RIGHT[g.id](p));
        assert.ok(ok.correct, `${g.id} L${level} seed ${seed}: the right answer failed: ${ok.why}`);
        assert.equal(ok.score, 1, `${g.id}: score`);
        const lab = g.check(p, LABELLED[g.id](p, RIGHT[g.id](p)));
        assert.ok(lab.correct, `${g.id} L${level} seed ${seed}: the right answer with a label and words failed: ${lab.why}`);
        const wrong = WRONG[g.id](p);
        const bad = g.check(p, wrong);
        assert.ok(!bad.correct, `${g.id} L${level} seed ${seed}: a near miss passed: ${wrong}`);
        assert.ok(bad.score < 1 && bad.why, g.id);
        assert.ok(!g.check(p, LABELLED[g.id](p, wrong)).correct, `${g.id} L${level}: a labelled near miss passed`);
      }
    }
  }
});

test('gym: no level is handed out — an untrained learner is below the bar at every level of every game', () => {
  for (const g of GAMES) {
    for (let level = 1; level <= 10; level++) {
      const m = g.learner(level, 1).measure().mastery;
      assert.ok(m < g.bar(level), `${g.id} L${level}: untrained mastery ${m} reaches the bar ${g.bar(level)}`);
    }
    // And a session that only measures never moves up.
    const s = new S.Session(g);
    assert.equal(s.measure(), null, `${g.id}: measuring alone passed a level`);
    assert.equal(s.rec.level, 1);
  }
});

test('gym: checkers read the final answer — labels, words, "x" for times; they don\'t pick numbers out of the working', () => {
  // Countdown: labels and "= result" off, x only between numbers, ":" is not division.
  const p24 = { game: 'countdown', level: 1, seed: 0, text: '', data: { nums: [3, 5, 3], target: 24, exact: true } };
  for (const a of ['Answer: (3 + 5) × 3', '(3+5)x3', '(3 + 5) * 3 = 24', 'Expression: (3 + 5) × 3']) assert.ok(CD.countdown.check(p24, a).correct, a);
  assert.ok(!CD.countdown.check(p24, '(3 + 5) : 3').correct, 'a colon is not division');
  // Maze: "EAST" is east, not E then S.
  const mz = MZ.maze.generate(2, 3);
  const route = RIGHT.maze(mz);
  assert.ok(MZ.maze.check(mz, `My route: ${[...route].map((c) => MAZE_WORDS[c].toUpperCase()).join(' ')}`).correct);
  // Colony: "determine" and "interest" are not MINE and REST.
  const co = CO.colony.generate(3, 4);
  assert.ok(CO.colony.check(co, `I determine the best plan in my interest:\n${RIGHT.colony(co)}`).correct);
  // Tic-tac-toe, Connect 4, Trust: the last number of the last line, not the first digit anywhere.
  const tt = TT.tictactoe.generate(5, 3);
  assert.ok(TT.tictactoe.check(tt, `Looking at row 1 and column 2 …\nBest square: ${tt.data.best[0]}`).correct);
  const tr = TR.trust.generate(4, 2);
  assert.ok(TR.trust.check(tr, `Over ${tr.data.rounds} rounds\nA scores ${tr.data.answer}`).correct);
  // Code breaker: "After 2 clues, the code is 312".
  const cb = CB.codebreaker.generate(5, 2);
  assert.ok(CB.codebreaker.check(cb, `After 2 clues, the code is ${cb.data.answer}`).correct);
});

test('logic grids: each person needs exactly one item of each kind — naming every item is not an answer', () => {
  for (const seed of [1, 3, 5, 7]) {
    const g = SU.sudoku.generate(6, seed);
    const all = ['cat', 'dog', 'fish', 'bird', 'rabbit', 'tea', 'coffee', 'juice', 'milk', 'water', 'red', 'blue', 'green', 'yellow', 'white'];
    const shotgun = g.data.people.map((nm) => `${nm}: ${all.join(', ')}`).join('\n');
    assert.ok(!SU.sudoku.check(g, shotgun).correct, 'every item on every line');
    assert.equal(SU.sudoku.check(g, shotgun).score, 0);
    // Two people on one line still read apart.
    const right = g.data.people.map((nm, i) => `${nm}: ${g.data.answer[i].join(', ')}`).join('; ');
    assert.ok(SU.sudoku.check(g, right).correct, right);
  }
});

// ---------------------------------------------------------------------------------------------------------
test('maze: the rules (−1 a step, −10 into a wall, mud costs more, +100 gold) and breadth-first cheapest routes', () => {
  // 4×1: S . ~ G
  const m = { w: 4, h: 1, cells: Uint8Array.from([0, 0, MZ.MUD, MZ.GOLD]), gold: 3 };
  assert.deepEqual(MZ.stepMaze(m, 0, 0), { to: 0, reward: -10, done: false, bump: true }, 'off the grid is a wall');
  assert.equal(MZ.stepMaze(m, 0, 1).reward, -1);
  assert.equal(MZ.stepMaze(m, 1, 1).reward, -3, 'mud costs 2 more');
  assert.deepEqual(MZ.stepMaze(m, 2, 1), { to: 3, reward: 99, done: true, bump: false });
  assert.deepEqual([...MZ.cheapest(m)], [5, 4, 1, 0]);
  // A detour round mud is cheaper when it is short: 3×2, mud in the middle of the top row.
  const m2 = { w: 3, h: 2, cells: Uint8Array.from([0, MZ.MUD, MZ.GOLD, 0, 0, 0]), gold: 2 };
  assert.equal(MZ.cheapest(m2)[0], 4, 'round the mud (4) beats through it (3 + 1)');
  // Every floor cell of a level's maze can reach the gold; sizes grow 5 → 14.
  for (const L of [1, 10]) {
    const mz = MZ.makeMaze(L, 9);
    assert.equal(mz.w, 4 + L);
    const d = MZ.cheapest(mz);
    for (const s of MZ.startCells(mz)) assert.ok(d[s] > 0);
  }
});

test('maze: Q-learning — his greedy route becomes the cheapest from (nearly) every start cell', () => {
  // Before any training WATCH still shows something: his start, then that he is stuck.
  const fresh = MZ.maze.learner(5, 1).watch(3);
  assert.ok(fresh.length >= 2 && /stuck/.test(fresh.at(-1).caption), fresh.map((f) => f.caption).join(' / '));
  const r = climb(MZ.maze.learner(5, 1), 0.95, 100, 5000);
  assert.ok(r.first < 0.5, `he should start knowing nothing (${r.first})`);
  assert.ok(r.last >= 0.95, `after ${r.units} runs: ${r.last}`);
  const l = MZ.maze.learner(5, 1);
  l.train(r.units);
  assert.match(l.measure().detail, /cheapest from \d+ of \d+ start cells/);
  const v = l.view();
  assert.equal(v.grid.cells.length, v.grid.w * v.grid.h);
  assert.ok(v.grid.cells.some((c) => /[↑→↓←]/.test(c.t ?? '')), 'the value map shows arrows');
  const w = l.watch(3);
  assert.ok(w.length >= 2 && /Gold in \d+/.test(w.at(-1).caption), w.at(-1).caption);
  // Saved and restored: the same mastery.
  assert.equal(MZ.maze.learner(5, 1, l.save()).measure().mastery, l.measure().mastery);
});

// ---------------------------------------------------------------------------------------------------------
test('code breaker: Mastermind feedback, and the yardstick is Knuth\'s: 4.476 guesses on average, never more than 5', () => {
  assert.deepEqual(CB.score([0, 0, 1, 1], [0, 1, 0, 1], 6), [2, 2]);
  assert.deepEqual(CB.score([0, 0, 0, 0], [0, 1, 2, 3], 6), [1, 0], 'a repeated symbol counts once');
  assert.deepEqual(CB.score([5, 4, 3, 2], [2, 3, 4, 5], 6), [0, 4]);
  assert.equal(CB.parseCode('1122', 4, 6), 7, '1122 is code number 7');
  assert.equal(CB.codeText(7, 4, 6), '1122');
  const y = CB.yardstick(10);
  assert.equal(Math.round(y.avg * 1296), 5801, `Knuth (1977): 5801 guesses over all 1296 codes, got ${y.avg * 1296}`);
  assert.equal(y.worst, 5);
});

test('code breaker: evolving his guessing policy brings him level with (or past) the minimax yardstick', () => {
  const r = climb(CB.codebreaker.learner(5, 3), CB.codebreaker.bar(5), 64, 64 * 200);
  assert.equal(r.first, 0, 'he starts naive: the first code that fits (0%)');
  assert.ok(r.last >= CB.codebreaker.bar(5), `after ${r.units} games: ${r.last}`);
  const l = CB.codebreaker.learner(2, 1);
  const w = l.watch(1, '123');
  assert.match(w.at(-1).caption, /Cracked 123 in \d guesses/);
});

// ---------------------------------------------------------------------------------------------------------
test('colony: the day\'s rules, and dynamic programming finds the true optimum (checked against every plan)', () => {
  const R = { days: 7, upkeep: 1, e0: 6 };
  const s0 = { e: 6, m: 0, p: 0, day: 0 };
  assert.deepEqual(CO.day(s0, 0, R).next, { e: 3, m: 2, p: 0, day: 1 }, 'MINE: −2 energy, +2 materials, then upkeep');
  assert.deepEqual(CO.day({ e: 5, m: 3, p: 0, day: 0 }, 1, R).next, { e: 5, m: 0, p: 1, day: 1 }, 'BUILD: −1 energy, the new panel makes 2, upkeep 1');
  assert.ok(!CO.canDo({ e: 5, m: 2, p: 0, day: 0 }, 1), 'no BUILD without 3 materials');
  const dead = CO.day({ e: 2, m: 0, p: 0, day: 0 }, 0, R);
  assert.ok(dead.done && dead.reward === -10, 'out of energy ends the run with a penalty');
  // Brute force: every one of the 3^7 plans.
  let best = -Infinity;
  for (let k = 0; k < 3 ** 7; k++) {
    let x = k;
    const plan = [];
    for (let i = 0; i < 7; i++) plan.push(x % 3), (x = Math.floor(x / 3));
    const r = CO.run(R, s0, (s) => plan[s.day]);
    best = Math.max(best, r.total);
  }
  const V = CO.optimum(R);
  assert.equal(V[((0 * 21 + 6) * 21 + 0) * 11 + 0], best, 'DP = brute force');
});

test('colony: Q-learning reaches the optimum, and his strategy shifts through the run', () => {
  const l = CO.colony.learner(3, 2);
  const r = climb(l, 0.95, 500, 50000);
  assert.ok(r.first < 0.5, `${r.first}`);
  assert.ok(r.last >= 0.95, `after ${r.units} runs: ${r.last}`);
  const v = l.view();
  const share = (ph, act) => v.bars.find((b) => b[0] === `${ph} · ${act}`)?.[1] ?? 0;
  const shift = Math.max(...['MINE', 'BUILD PANEL', 'REST'].map((a) => Math.abs(share('EARLY', a) - share('MIDDLE', a))));
  assert.ok(shift >= 0.2, `his mix of actions should change between phases of the run: ${v.bars.map((b) => `${b[0]} ${b[2]}`).join(', ')}`);
  assert.ok(l.watch().length > 3);
});

// ---------------------------------------------------------------------------------------------------------
test('trust: exact match scores, the classics by name, and the exhaustive best memory-1 strategy', () => {
  assert.deepEqual(TR.match(TR.CLASSIC['TIT FOR TAT'], TR.CLASSIC['ALWAYS DEFECT'], 10, 0), [9, 14]);
  assert.deepEqual(TR.match(TR.CLASSIC['TIT FOR TAT'], TR.CLASSIC['TIT FOR TAT'], 10, 0), [30, 30]);
  assert.deepEqual(TR.match(TR.CLASSIC['WIN-STAY LOSE-SHIFT'], TR.CLASSIC['ALWAYS DEFECT'], 4, 0), [1 + 0 + 1 + 0, 1 + 5 + 1 + 5].map((x, i) => (i ? x : 2)), 'Pavlov alternates against a defector');
  // With mistakes two Tit-for-Tats fall out (less than 3 a round), symmetrically.
  const [a, b] = TR.match(TR.CLASSIC['TIT FOR TAT'], TR.CLASSIC['TIT FOR TAT'], 50, 0.05);
  assert.ok(Math.abs(a - b) < 1e-9 && a < 150);
  assert.equal(TR.allMem1().length, 32);
  assert.equal(TR.nameOf(TR.mem1(1, [1, 0, 1, 0])), 'TIT FOR TAT');
  assert.equal(TR.nameOf(TR.mem1(1, [1, 1, 0, 0])), 'C·CCDD');
  assert.equal(TR.bestMem1(1).name, 'TIT FOR TAT', 'with no mistakes Tit for Tat is the best memory-1 strategy against the panel');
  // Evolution never plays the test panel: the two panels share no strategy.
  assert.deepEqual(TR.PANEL.filter((x) => TR.TRAIN_PANEL.includes(x)), []);
  // ALWAYS DEFECT is clearly worse than the best at every level (else defectors would pass at once).
  for (let L = 1; L <= 10; L++) {
    const b = TR.bestMem1(L);
    assert.ok(b.score - b.defect > 0.3, `L${L}: best ${b.score} vs ALWAYS DEFECT ${b.defect}`);
  }
});

test('trust: from a world of defectors, evolution finds trust — Tit-for-Tat-like strategies rise', () => {
  const l = TR.trust.learner(1, 3);
  const first = l.measure().mastery;
  l.train(150);
  const last = l.measure();
  assert.equal(first, 0, 'a world of defectors is 0%');
  assert.ok(last.mastery >= TR.trust.bar(1), last.detail);
  const shares = l.shares();
  const tftish = shares.filter(([nm]) => ['TIT FOR TAT', 'GRUDGER', 'WIN-STAY LOSE-SHIFT'].includes(nm)).reduce((t, [, v]) => t + v, 0);
  assert.ok(tftish >= 0.4, `nice, retaliating strategies should lead: ${JSON.stringify(shares.slice(0, 4))}`);
  assert.ok(l.view().lines.length >= 1, 'the view names who rose');
});

// ---------------------------------------------------------------------------------------------------------
test('tic-tac-toe: exhaustive minimax — 4,520 positions with a move to make, the empty board is a draw', () => {
  const S = TT.solve();
  assert.equal(S.positions.length, 4520);
  assert.equal(S.value.get(0), 0);
  assert.equal(TT.winner([1, 1, 1, 2, 2, 0, 0, 0, 0]), 1);
  assert.equal(TT.winner([1, 2, 1, 1, 2, 2, 2, 1, 1]), 3);
  // X to move with two in a row: the win is the only perfect move.
  assert.deepEqual(S.best.get(TT.keyOf([1, 1, 0, 2, 2, 0, 0, 0, 0])), [2]);
});

test('tic-tac-toe: self-play reaches 100% — his move is perfect in every one of the 4,520 positions', () => {
  const l = TT.tictactoe.learner(1, 7);
  const r = climb(l, 1, 5000, 200000);
  assert.ok(r.first < 0.9, `${r.first}`);
  assert.equal(r.last, 1, `after ${r.units} games: ${r.last}`);
  assert.match(l.measure().detail, /([\d,]+) of the \1 positions where the choice matters \(of all 4,520/);
  // PLAY HIM: he takes the win, and blocks.
  assert.equal(l.move([2, 2, 0, 1, 1, 0, 1, 0, 0]), 2, 'O to move wins at square 3');
  assert.equal(l.move([1, 1, 0, 2, 0, 0, 0, 0, 0]), 2, 'O to move blocks at square 3');
  assert.match(l.watch(1).at(-1).caption, /draw/i, 'perfect self-play is a draw');
});

// ---------------------------------------------------------------------------------------------------------
test('connect 4: the exact solver — a win in one, consistent values, and a fixed test set of mid/late-game positions', () => {
  // X has three in the bottom row (columns 1–3); X to move wins at once.
  const p = C4.newPos();
  for (const c of [0, 0, 1, 1, 2, 2]) C4.play(p, c);
  assert.equal(C4.solvePos(p), 1);
  assert.equal(C4.LINES.length, 69);
  // On test positions the solver is consistent: a best move keeps the position's value, any other loses some.
  for (const t of C4.testSet(1).slice(0, 6)) {
    const v = C4.solvePos(t.pos);
    for (const c of C4.legal(t.pos)) {
      const q = C4.copyPos(t.pos);
      const s = C4.play(q, c);
      const after = C4.wonAt(q, s) ? 1 : -C4.solvePos(q);
      if (t.best.includes(c)) assert.equal(after, v);
      else assert.ok(after < v);
    }
  }
  // The stored test positions are exactly what the solver makes (checked here for the quicker levels).
  for (const L of [1, 2, 3, 4, 5]) {
    const stored = C4.testSet(L);
    const fresh = C4.testSet(L, 40, true);
    assert.deepEqual(stored.map((t) => [Array.from(t.pos.b).join(''), t.best]), fresh.map((t) => [Array.from(t.pos.b).join(''), t.best]), `L${L}`);
  }
  // A few of the hardest level's stored answers, solved again.
  for (const t of C4.testSet(10).slice(0, 2)) assert.deepEqual(C4.bestMoves(t.pos).best, t.best);
  const set = C4.testSet(2);
  assert.equal(set.length, 40);
  assert.deepEqual(C4.testSet(2), set, 'the same positions every time');
  for (const t of set.slice(0, 5)) {
    assert.equal(42 - t.pos.n, C4.empties(2));
    assert.ok(t.best.length >= 1 && t.best.length * 2 <= C4.legal(t.pos).length, 'no position where every move is as good');
  }
});

test('connect 4: self-play training of the n-tuple evaluator raises agreement with the perfect solver', () => {
  const l = C4.connect4.learner(1, 3);
  const first = l.measure().mastery;
  l.train(30000);
  const last = l.measure().mastery;
  assert.equal(first, 0, 'untrained = the search alone = 0%');
  assert.ok(last >= C4.connect4.bar(1), `${l.measure().detail}`);
  // PLAY HIM: he takes a win in one.
  const b = C4.newPos();
  for (const c of [0, 6, 0, 6, 0]) C4.play(b, c);
  // O (to move) must block column 1.
  assert.equal(l.move(Array.from(b.b)), 0);
});

// ---------------------------------------------------------------------------------------------------------
test('sliding tiles: Manhattan, linear conflict, and A* / IDA* shortest solutions', () => {
  const s3 = TI.solved(3);
  assert.equal(TI.manhattan(s3, 3), 0);
  assert.equal(TI.manhattan([1, 2, 3, 4, 5, 6, 7, 0, 8], 3), 1);
  assert.equal(TI.linearConflict([2, 1, 3, 4, 5, 6, 7, 8, 0], 3), 2, '1 and 2 swapped in their row');
  assert.equal(TI.optimal([1, 2, 3, 4, 5, 6, 0, 7, 8], 3), 2);
  // A* and IDA* agree on 8-puzzles.
  const r = C.rng(4);
  for (let i = 0; i < 4; i++) {
    const b = TI.scramble(3, 20, r);
    assert.equal(TI.idaStar(b, 3), TI.optimal(b, 3));
  }
  assert.equal(TI.optimal(TI.scramble(4, 12, C.rng(2)), 4) <= 12, true);
});

test('sliding tiles: learning the heuristic from his own scrambles makes his searches short and successful', () => {
  const l = TI.tiles.learner(5, 3);
  const r = climb(l, 0.9, 10, 200);
  assert.ok(r.first < 0.3, `with no idea of distance he runs out of search: ${r.first}`);
  assert.ok(r.last >= 0.9, `after ${r.units} puzzles: ${r.last}`);
  assert.ok(l.w[0] > 0.5, `Manhattan distance should matter: ${l.w}`);
});

// ---------------------------------------------------------------------------------------------------------
test('sudoku: puzzles with exactly one solution, the rules solve them, plain backtracking is the baseline', () => {
  for (const L of [1, 10]) {
    const { puzzle, solution } = SU.makeSudoku(L, 3);
    assert.equal(SU.countSolutions(puzzle), 1);
    assert.ok(puzzle.filter(Boolean).length <= SU.cluesFor(L) + 2);
    for (const u of SU.UNITS) assert.equal(new Set(u.map((i) => solution[i])).size, 9);
    const s = SU.solveWith(puzzle, { order: [0, 1, 3, 2], guess: 1 }, 1e6);
    assert.ok(s.solved);
    assert.deepEqual(s.values, solution);
    assert.ok(SU.baselineSteps(puzzle) > 0);
  }
  // Logic grids: the clues pin down one answer.
  const g = SU.makeLogicGrid(8, 5);
  assert.equal(g.n, 5);
  assert.ok(g.clues.length >= 3);
});

test('sudoku: learning the order of his rules and how to guess cuts his steps until he solves within budget', () => {
  // Start from a seed where his random rule order is poor (fails most puzzles within the budget).
  let seed = 1;
  while (SU.sudoku.learner(5, seed).measure().mastery >= 0.5) seed++;
  const l = SU.sudoku.learner(5, seed);
  const r = climb(l, 0.9, 30, 600);
  assert.ok(r.first < 0.5);
  assert.ok(r.last >= 0.9, `after ${r.units} puzzles: ${r.last}`);
  assert.match(l.measure().detail, /plain backtracking/);
});

// ---------------------------------------------------------------------------------------------------------
test('countdown: the 24 game uses up a 1 with ×1 or ÷1 — the exact solver is exhaustive, and his moves can say so', () => {
  const sol = CD.solve([1, 3, 8], 24, true);
  assert.ok(sol, '(3 × 8) × 1');
  const e = CD.countdown.env(1);
  e.reset(1);
  e.p = { nums: [1, 3, 8], target: 24, exact: true };
  e.nums = [1, 3, 8];
  const moves = CD.moves(e.nums, true);
  assert.ok(moves.some((m) => m.s.op === 2 && m.s.b === 1), 'the moves include × 1');
  // Play the solution through the env: it ends on 24.
  let r;
  for (const st of sol) {
    const k = CD.moves(e.nums, true).findIndex((m) => m.s.a === st.a && m.s.b === st.b && m.s.op === st.op);
    assert.ok(k >= 0 && e.actions().includes(k));
    r = e.step(k);
  }
  assert.ok(r.done && r.reward > 0);
  assert.ok(CD.countdown.check({ game: 'countdown', level: 1, seed: 0, text: '', data: { nums: [1, 3, 8], target: 24, exact: true } }, '3 × 8 × 1').correct);
});

test('countdown: the rules (whole numbers above zero), the exhaustive solver, and checking an expression', () => {
  assert.equal(CD.apply(7, 2, 3), -1, '7 ÷ 2 is not whole');
  assert.equal(CD.apply(3, 5, 1), -1, 'no going below zero');
  assert.ok(CD.solve([4, 7, 8, 8], 24, true));
  assert.equal(CD.solve([1, 1, 1, 1], 24, true), null);
  assert.deepEqual(CD.evaluate('(3 + 5) × 3'), { value: 24, used: [3, 5, 3] });
  assert.ok('error' in CD.evaluate('8 / 3'));
  const p = { game: 'countdown', level: 5, seed: 0, text: '', data: { nums: [100, 4, 9, 2, 7], target: 728, exact: false } };
  assert.ok(CD.countdown.check(p, '(100 + 4) × (9 − 2)').correct);
  assert.ok(!CD.countdown.check(p, '100 × 7 + 4 × 7').correct, '7 used twice');
  for (const L of [1, 5, 10]) for (const { p: q } of CD.bench(L).slice(0, 3)) assert.ok(CD.solve(q.nums, q.target, q.exact), 'only solvable problems are set');
});

test('countdown: evolving the order he tries combinations in solves more within the budget', () => {
  const l = CD.countdown.learner(2, 3);
  const first = l.measure().mastery;
  l.train(240);
  const last = l.measure().mastery;
  assert.ok(last >= first + 0.1, `${first} → ${last}`);
});

// ---------------------------------------------------------------------------------------------------------
test('word guess: Wordle colours with repeated letters, and the information-gain yardstick', () => {
  assert.deepEqual(WD.marks('speed', 'abide'), [0, 0, 1, 0, 1]);
  assert.deepEqual(WD.marks('erase', 'speed'), [1, 0, 0, 1, 1]);
  assert.deepEqual(WD.marks('llama', 'hello'), [1, 1, 0, 0, 0], 'two Ls in the guess, two in the answer');
  assert.deepEqual(WD.marks('house', 'house'), [2, 2, 2, 2, 2]);
  assert.ok(WD.WORDS.length >= 400 && WD.WORDS.every((w) => /^[a-z]{5}$/.test(w)));
  assert.equal(new Set(WD.WORDS).size, WD.WORDS.length);
  const y = WD.yardstick(3);
  assert.ok(y.avg > 1.5 && y.avg < 4 && y.worst <= 6, JSON.stringify(y));
});

test('word guess: his learned policy catches up with the information-gain guesser', () => {
  const r = climb(WD.words.learner(6, 3), WD.words.bar(6), 200, 200 * 100);
  assert.equal(r.first, 0, 'he starts naive (0%)');
  assert.ok(r.last >= WD.words.bar(6), `after ${r.units} games: ${r.last}`);
});

// ---------------------------------------------------------------------------------------------------------
test('session: passing the bar makes the next level by itself; the record keeps the graph; the status line is plain', () => {
  const s = new S.Session(gameById('maze'));
  assert.equal(s.rec.level, 1);
  assert.equal(s.rec.history.length, 1);
  assert.match(S.statusLine(s.rec, s.game, false), /^Not started/);
  let ev = null;
  for (let i = 0; i < 40 && ev !== 'level'; i++) {
    s.train(100);
    ev = s.measure();
  }
  assert.equal(ev, 'level');
  assert.equal(s.rec.level, 2);
  assert.equal(s.learner.save().level, 2);
  assert.equal(MZ.makeMaze(2, s.rec.seed).w, 6, 'the next level is a bigger maze');
  assert.ok(s.rec.history.some((p) => p.l === 2));
  assert.match(S.statusLine(s.rec, s.game, true), /^Learning… [\d,]+ runs · Level 2 · mastery \d+% → \d+%$/);
  // The snapshot carries on where it left off.
  const again = new S.Session(gameById('maze'), s.snapshot());
  assert.equal(again.rec.level, 2);
  assert.equal(again.learner.measure().mastery, s.learner.measure().mastery);
  // Tic-tac-toe climbs every level and is MASTERED at the end.
  const t = new S.Session(gameById('tictactoe'));
  for (let i = 0; i < 200 && !t.rec.mastered; i++) {
    t.train(2000);
    t.measure();
  }
  assert.ok(t.rec.mastered, `tic-tac-toe stopped at level ${t.rec.level} (${t.rec.mastery})`);
  assert.equal(t.rec.level, 10);
  assert.match(S.statusLine(t.rec, t.game, false), /^Mastered all 10 levels/);
});

test('worker: TRAIN posts progress and saves, PAUSE saves, WATCH / PLAY HIM / the picture answer by request', async () => {
  const out = [];
  const post = (m) => out.push(m);
  // PLAY HIM against a trained player: his move is legal and perfect where the position is solved.
  const tt = new S.Session(gameById('tictactoe'));
  for (let i = 0; i < 40 && tt.rec.mastery < 1; i++) tt.train(5000), tt.measure();
  const solved = TT.solve();
  for (const [k, board] of [[2, [1, 1, 0, 2, 0, 0, 0, 0, 0]], [3, [1, 0, 0, 0, 2, 0, 0, 0, 1]], [4, [1, 2, 0, 0, 1, 0, 0, 0, 0]]]) {
    W.gymMessage({ gym: 'move', id: 'tictactoe', rec: tt.snapshot(), req: k, board }, post);
    const mv = out.at(-1).move;
    assert.equal(out.at(-1).req, k);
    assert.equal(board[mv], 0, `square ${mv + 1} is taken`);
    assert.ok(solved.best.get(TT.keyOf(board)).includes(mv), `square ${mv + 1} is not a perfect move in ${board.join('')}`);
  }
  W.gymMessage({ gym: 'view', id: 'tictactoe', req: 1 }, post);
  assert.equal(out.at(-1).gym, 'reply');
  assert.equal(out.at(-1).view.grid.w, 3);
  W.gymMessage({ gym: 'move', id: 'connect4', req: 5, board: new Array(42).fill(0) }, post);
  const c = out.at(-1).move;
  assert.ok(Number.isInteger(c) && c >= 0 && c < 7, `a legal column: ${c}`);
  W.gymMessage({ gym: 'watch', id: 'maze', req: 3, seed: 4 }, post);
  assert.ok(out.at(-1).frames.length >= 1);
  W.gymMessage({ gym: 'train', id: 'maze', rec: null }, post);
  assert.equal(out.at(-1).gym, 'progress');
  assert.equal(out.at(-1).training, true);
  assert.equal(out.at(-1).rec.saved, null, 'progress carries no learner state');
  const before = out.at(-1).rec.history.length;
  await new Promise((r) => setTimeout(r, 1900));
  const during = out.filter((m) => m.gym === 'progress' && m.rec.id === 'maze').at(-1);
  assert.ok(during.rec.history.length > before && during.rec.units > 0, 'it measured while training (a new point on the graph)');
  const points = during.rec.history.length;
  W.gymMessage({ gym: 'pause' }, post);
  const saved = out.filter((m) => m.gym === 'save').at(-1);
  assert.ok(saved && saved.rec.units > 0 && saved.rec.saved?.q?.length > 0, 'pausing saves what he learned');
  assert.equal(saved.rec.history.length, points, 'pausing does not stop to measure first');
  // A failed request answers that request (the page is never left waiting), and training errors are kept apart.
  W.gymMessage({ gym: 'watch', id: 'nope', req: 4 }, post);
  assert.equal(out.at(-1).gym, 'reply');
  assert.equal(out.at(-1).req, 4);
  assert.match(out.at(-1).error, /no game/);
  // RESET: after a new epoch, the old session is gone and messages carry the new epoch.
  W.gymMessage({ gym: 'reset', id: 'maze', epoch: 1 }, post);
  W.gymMessage({ gym: 'train', id: 'maze', rec: null, epoch: 1 }, post);
  const p1 = out.at(-1);
  assert.equal(p1.epoch, 1);
  assert.equal(p1.rec.units, 0, 'a reset game starts again');
  W.gymMessage({ gym: 'pause' }, post);
  // The page keeps only messages from a game's current epoch.
  assert.ok(S.current({ maze: 1 }, 'maze', 1));
  assert.ok(!S.current({ maze: 1 }, 'maze', 0), 'a message from before the reset is dropped');
  assert.ok(S.current({}, 'tiles', undefined));
});

test('worker speed: stored test sets, cached baselines, nothing slow on the way to PAUSE / PLAY HIM / WATCH', () => {
  // Connect 4's hardest test set and the 15-puzzle benchmark come from the stored lists (no solving).
  let t = performance.now();
  C4.testSet(10);
  TI.bench(10);
  assert.ok(performance.now() - t < 100, `stored sets took ${performance.now() - t} ms`);
  // The stored tile benchmarks are what the solvers make.
  for (let L = 1; L <= 10; L++) assert.deepEqual(TI.bench(L), TI.bench(L, true), `tiles L${L}`);
  // A 15-puzzle measurement is quick now (a budget per level instead of thousands of positions).
  const l = TI.tiles.learner(10, 1);
  t = performance.now();
  l.measure();
  assert.ok(performance.now() - t < 200, `15-puzzle measure took ${performance.now() - t} ms`);
  // Sudoku's plain-backtracking baseline is worked out once per level.
  assert.equal(SU.baselines(4), SU.baselines(4));
});

test('bundle: the page imports only the games\' descriptions and the two boards — no engine reaches app.js', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(at('../../web/src/features/gym/index.ts'), 'utf8');
  const gymImports = [...src.matchAll(/from '\.\.\/\.\.\/gym\/([a-z0-9]+)'/g)].map((m) => m[1]);
  const engines = ['index', 'maze', 'codebreaker', 'colony', 'trust', 'tictactoe', 'connect4', 'tiles', 'sudoku', 'countdown', 'words', 'guess', 'c4sets', 'tilesets'];
  assert.deepEqual(gymImports.filter((f) => engines.includes(f)), [], `the page imports ${gymImports.join(', ')}`);
  const typeOnly = [...src.matchAll(/^import (type )?\{[^}]*\} from '\.\.\/\.\.\/gym\/(worker|core)'/gm)];
  assert.ok(typeOnly.every((m) => m[1] === 'type '), 'worker and core are imported for their types only');
  // And what it does import pulls in no engine either.
  for (const f of ['meta', 'session', 'c4board', 'tttboard']) {
    const s2 = readFileSync(at(`../../web/src/gym/${f}.ts`), 'utf8');
    const deps = [...s2.matchAll(/^import (type )?[^;]*from '\.\/([a-z0-9]+)'/gm)].filter((m) => !m[1]).map((m) => m[2]);
    assert.deepEqual(deps.filter((d) => engines.includes(d)), [], `${f} imports ${deps.join(', ')}`);
  }
});
