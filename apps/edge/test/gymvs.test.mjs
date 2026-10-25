// PLAY HIM at full strength (gym2, OWNER-ISSUES 52): the owner beat Connect 4 every time with a simple trick, because
// PLAY HIM met Ghosty's weakest self (a barely trained network, 128 simulations). Now every game against the owner
// uses everything he has: the exact solver on bitboards (gym/c4solve.ts), the search ahead for what it cannot
// settle, the network's tree search to choose among equals, and his book — each move with one line saying why
// (gym/c4play.ts). Then: what he learns from the owner's games (gym/c4study.ts), and the same tactical floor on
// tic-tac-toe, checkers and chess. All on node budgets, so every machine gets the same moves.
// (Run from offline.test.mjs, which is in the test list; package.json is protected.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({
  entryPoints: ['connect4', 'c4solve', 'c4play', 'c4study', 'worker'].map((f) => at(`../../web/src/gym/${f}.ts`)),
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outdir: at('./.build/gymvs'),
  outExtension: { '.js': '.mjs' },
  logLevel: 'warning',
});
const load = (f) => import(`./.build/gymvs/${f}.mjs`);
const C4 = await load('connect4');
const SV = await load('c4solve');
const ST = await load('c4study');
const W = await load('worker');

/** The old PLAY HIM (still his own move, used for league games between his versions): the network's tree search, 128 simulations. */
const oldEngine = (games) => {
  const l = C4.connect4.learner(1, 1);
  if (games) l.train(games);
  return (board) => l.move(board);
};
/** His move against the owner now: everything he has, on a node budget (about a tenth of a second here). */
const LIMIT = { nodes: 200_000 };

/**
 * The trick sequences: the owner (X, first) plays these columns (1–7), taking a four whenever one is there. Each
 * beat the old engine — the old PLAY HIM at that much training — every time (the old engine is deterministic). Found
 * by playing a strong X against each old engine from every two-move start and keeping the shortest win; the idea
 * named by the study's own words.
 */
const TRICKS = [
  { against: 0, xs: [4, 2, 3, 5], idea: 'a double threat on columns 1 and 5' },
  { against: 300, xs: [5, 5, 4, 6, 3], idea: 'a double threat on columns 3 and 7' },
  { against: 1000, xs: [3, 7, 4, 3, 5, 5, 6, 5, 2], idea: 'a double threat on columns 2 and 6' },
  { against: 3000, xs: [4, 7, 6, 6, 6, 3, 5, 4], idea: 'two threats stacked in column 4' },
];

/** X's move: a four if there is one; else the trick's next column; once the list is done (or blocked), a plain player: block a four, else the most central column that does not hand one over. */
function trickster(p, xs, i) {
  const ms = C4.legal(p);
  const w = ms.find((c) => C4.winsNow(p, c));
  if (w != null) return w;
  if (i < xs.length && C4.canPlay(p, xs[i] - 1)) return xs[i] - 1;
  const opp = p.n % 2 === 0 ? 2 : 1;
  for (const c of ms) {
    const s = c * 6 + p.h[c];
    p.b[s] = opp;
    const t = C4.wonAt(p, s);
    p.b[s] = 0;
    if (t) return c;
  }
  for (const c of ms) {
    C4.play(p, c);
    const bad = C4.legal(p).some((o) => C4.winsNow(p, o));
    C4.undo(p, c);
    if (!bad) return c;
  }
  return ms[0];
}
/** A whole game: X the trickster, O the engine. 'X' / 'O' / 'D' and the columns played. */
function game(xs, engine, onlyList = false) {
  const p = C4.newPos();
  const log = [];
  for (let i = 0; ; i++) {
    if (onlyList && i >= xs.length && !C4.legal(p).some((c) => C4.winsNow(p, c))) return { res: 'open', log };
    const c = trickster(p, xs, i);
    let s = C4.play(p, c);
    log.push(c);
    if (C4.wonAt(p, s)) return { res: 'X', log };
    if (p.n === 42) return { res: 'D', log };
    const o = engine(Array.from(p.b));
    s = C4.play(p, o);
    log.push(o);
    if (C4.wonAt(p, s)) return { res: 'O', log };
    if (p.n === 42) return { res: 'D', log };
  }
}

test('connect 4 bitboards: the exact solver agrees with the stored ground truth at every level; its tables stay under 64 MB', () => {
  assert.ok(SV.TABLE_BYTES < 64 * 1024 * 1024, `${SV.TABLE_BYTES} bytes`);
  for (let L = 1; L <= 10; L++)
    for (const t of C4.testSet(L).slice(0, 8)) {
      const sc = SV.scoreMoves(SV.bitsOf(t.pos.b), {}, true);
      const top = Math.max(...sc.filter((v) => v != null));
      assert.deepEqual(sc.map((v, c) => (v === top ? c : -1)).filter((c) => c >= 0), t.best, `L${L} ${Array.from(t.pos.b).join('')}`);
    }
  // exact scores (how soon) agree with the array solver's win / draw / loss
  for (const t of C4.testSet(3).slice(0, 10)) assert.equal(Math.sign(SV.solveBits(SV.bitsOf(t.pos.b))) + 0, C4.solvePos(t.pos) + 0);
  // a node budget too small to finish says so (null), and the table keeps what was proved: asking again finishes
  const deep = C4.testSet(10)[0].pos;
  const b = SV.bitsOf(deep.b);
  let v = SV.solveBits(b, { nodes: 5000 });
  for (let i = 0; v == null && i < 400; i++) v = SV.solveBits(b, { nodes: 5000 });
  assert.equal(Math.sign(v) + 0, C4.solvePos(deep) + 0);
});

test('connect 4: the trick sequences that beat the old PLAY HIM every time do not beat him now', () => {
  for (const t of TRICKS) {
    const old = oldEngine(t.against);
    const g = game(t.xs, old, true);
    assert.equal(g.res, 'X', `the old engine (${t.against} games) should lose to ${t.xs.join(',')}: ${g.res} ${g.log.map((c) => c + 1).join('')}`);
    assert.equal(ST.ideaOf(g.log, 1).idea, t.idea, `the trick's idea: ${g.log.map((c) => c + 1).join('')}`);
    // Now: at any training (the same learner states), he does not lose to it.
    const l = C4.connect4.learner(1, 1);
    if (t.against) l.train(t.against);
    const n = game(t.xs, (board) => l.versus(board, LIMIT).move);
    assert.notEqual(n.res, 'X', `he lost to ${t.xs.join(',')}: ${n.log.map((c) => c + 1).join('')}`);
  }
});

test('connect 4: from every stored test position with 16 or fewer empty squares he gets at least the solver\'s result against perfect play', () => {
  const eng = C4.connect4.learner(1, 1);
  let games = 0;
  for (const L of [1, 2, 3, 4, 5])
    for (const t of C4.testSet(L)) {
      const p = C4.copyPos(t.pos);
      const me = C4.turn(p);
      const value = SV.solveBits(SV.bitsOf(p.b), {}, true);
      let res = 0;
      for (;;) {
        const mover = C4.turn(p);
        let c;
        if (mover === me) c = eng.versus(Array.from(p.b), LIMIT).move;
        else {
          // perfect play: the soonest win, the latest loss
          const sc = SV.scoreMoves(SV.bitsOf(p.b));
          c = sc.reduce((a, v, k) => (v != null && (a < 0 || v > sc[a]) ? k : a), -1);
        }
        const s = C4.play(p, c);
        if (C4.wonAt(p, s)) {
          res = mover === me ? 1 : -1;
          break;
        }
        if (p.n === 42) break;
      }
      games++;
      assert.ok(res >= value, `L${L} ${Array.from(t.pos.b).join('')}: worth ${value}, he got ${res}`);
    }
  assert.equal(games, 600);
});

test('connect 4: each move says why — four, a block, two threats, proved, kept clear — and the worker sends it with the move', () => {
  const l = C4.connect4.learner(1, 1);
  const pos = (cols) => {
    const p = C4.newPos();
    for (const c of cols) C4.play(p, c - 1);
    return Array.from(p.b);
  };
  // O (to move) has three in column 7: four.
  let v = l.versus(pos([1, 7, 1, 7, 2, 7, 4]), LIMIT);
  assert.deepEqual([v.move, v.kind, v.reason], [6, 'win', 'Four in a row.']);
  // X threatens column 1 (three stacked): he must stop it.
  v = l.versus(pos([1, 7, 1, 6, 1]), LIMIT);
  assert.deepEqual([v.move, v.kind, v.reason], [0, 'block', 'I had to stop column 1.']);
  // X has two threats on the bottom row: he says so.
  v = l.versus(pos([3, 3, 4, 4, 5]), LIMIT);
  assert.equal(v.kind, 'lost');
  assert.match(v.reason, /^You have two threats, columns 2 and 6\. I can only stop one\.$/);
  // A test position the solver settles: proved, in words.
  v = l.versus(Array.from(C4.testSet(1)[0].pos.b), LIMIT);
  assert.equal(v.kind, 'solved');
  assert.match(v.reason, /^(Column \d wins by force\.|Solved: column \d holds the draw\.)$/);
  // The opening: not settled; the search keeps clear of what loses, and says how far it looked.
  v = l.versus(pos([4]), LIMIT);
  assert.equal(v.kind, 'search');
  assert.match(v.reason, /within \d+ moves|moves ahead|lose by force|loses by force/);
  // The worker answers PLAY HIM with the move and its reason.
  const out = [];
  W.gymMessage({ gym: 'move', id: 'connect4', req: 1, board: pos([1, 7, 1, 6, 1]), limit: LIMIT }, (m) => out.push(m));
  assert.equal(out.at(-1).move, 0);
  assert.equal(out.at(-1).why.reason, 'I had to stop column 1.');
});
