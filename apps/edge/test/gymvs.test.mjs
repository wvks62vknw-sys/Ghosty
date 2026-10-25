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
  entryPoints: ['connect4', 'c4solve', 'c4play', 'c4study', 'c4talk', 'worker'].map((f) => at(`../../web/src/gym/${f}.ts`)),
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
const T = await load('c4talk');


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

// ---------------------------------------------------------------------------------------------------------
// He learns from the owner's games: a loss studied with the solver, the network trained on what it proved, the turning
// point kept as a lesson (PLAY HIM plays it right from then on), positions from his games solved while idle, and the
// lines he says — only from what happened.

/** A game the owner (X, a strong player) won against Ghosty's old engine: columns 0–6 from the empty board. */
function lostGame() {
  const X = C4.connect4.learner(1, 9);
  const O = C4.connect4.learner(1, 1);
  const p = C4.newPos();
  const log = [];
  for (;;) {
    let c = X.versus(Array.from(p.b), LIMIT).move;
    let s = C4.play(p, c);
    log.push(c);
    if (C4.wonAt(p, s)) return log;
    c = O.move(Array.from(p.b));
    s = C4.play(p, c);
    log.push(c);
    if (C4.wonAt(p, s)) return null;
  }
}

test('learning from him: a lost game studied — the owner\'s idea in words, the first move proved to lose, a lesson he then plays right, the network judging it right', () => {
  const moves = lostGame();
  assert.deepEqual(moves.map((c) => c + 1).join(''), '444434542');
  const G = C4.connect4.learner(1, 1);
  const at = C4.newPos();
  for (const c of moves.slice(0, 5)) C4.play(at, c);
  const after = C4.copyPos(at);
  C4.play(after, moves[5]);
  // the network's view of the position his move made, for the second player (Ghosty), before the study
  const before = -C4.evaluate(G.save().w, after);
  const st = G.study(moves, 2);
  assert.equal(st.idea, 'a double threat on columns 2 and 6');
  assert.equal(st.kind, 'double');
  assert.equal(st.wonAt, 9);
  assert.deepEqual(st.turn, { at: 6, played: 3, held: [4, 1], value: null });
  assert.ok(st.labelled > 0);
  assert.deepEqual(G.known(), { book: G.known().book, lessons: 1 });
  // PLAY HIM in that position now: the lesson, a column that held
  const v = G.versus(Array.from(at.b), LIMIT);
  assert.equal(v.kind, 'lesson');
  assert.ok([4, 1].includes(v.move), `he played ${v.move + 1}`);
  assert.match(v.reason, /^You taught me this position: columns? [\d, and]+ loses?\.$/);
  // and the network now judges the position his move made worse for him (it was proved lost)
  const now = -C4.evaluate(G.save().w, after);
  assert.ok(now < before - 0.05, `the network's view of the lost position: ${before.toFixed(3)} → ${now.toFixed(3)}`);
  // the lesson is kept in his record (the book goes with what he knows)
  assert.ok(Object.values(G.save().book).some((x) => x.endsWith('!')));
  // the words, from the study only
  const game = { at: 1, moves, ghosty: 2, result: 'you', why: [], study: st };
  assert.equal(T.screenLine([game]), 'You beat me at move 9 with a double threat on columns 2 and 6. I’ve studied it. Play me again.');
  assert.deepEqual(T.review(game), [
    { at: 6, text: 'I played column 4. Columns 5 or 2 held.' },
    { at: 9, text: 'Your double threat on columns 2 and 6.' },
  ]);
  assert.equal(T.cardLine([game]), 'You’ve taught me 1 lesson.');
  assert.equal(T.countLine([game]), 'You’ve taught me 1 lesson; you won our only game.');
});

test('learning from him: a loss to an odd threat — named, and no turning point claimed that the solver cannot prove', () => {
  // Ghosty on a tiny budget (a thousand positions a move) against a strong owner: the owner wins by zugzwang.
  const X = C4.connect4.learner(1, 9);
  const G = C4.connect4.learner(1, 1);
  const p = C4.newPos();
  const moves = [];
  for (let res = ''; !res; ) {
    let c = p.n === 0 ? 3 : X.versus(Array.from(p.b), { nodes: 100_000 }).move;
    let s = C4.play(p, c);
    moves.push(c);
    if (C4.wonAt(p, s)) res = 'X';
    else {
      c = G.versus(Array.from(p.b), { nodes: 1000 }).move;
      s = C4.play(p, c);
      moves.push(c);
      if (C4.wonAt(p, s) || p.n === 42) res = 'O';
    }
  }
  assert.equal(ST.ideaOf(moves, 1).kind, 'odd', moves.map((c) => c + 1).join(''));
  const st = G.study(moves, 2, 1_000_000);
  assert.match(st.idea, /^the odd threat on the (first|third|fifth) row of column \d$/);
  if (!st.turn) {
    const game = { at: 1, moves, ghosty: 2, result: 'you', why: [], study: st };
    assert.ok(T.review(game).some((r) => /earlier than I can prove yet|already lost/.test(r.text)), JSON.stringify(T.review(game)));
  }
});

test('learning from him: while idle he solves the deep positions his games reached and keeps them; the worker studies a loss on request', () => {
  const G = C4.connect4.learner(1, 1);
  const moves = lostGame();
  const games = [[3, 3, 2, 3, 4, 2, 3, 2, 1, 4, 4, 4, 5, 5, 2, 2]];
  const b0 = G.known().book;
  let solved = null;
  for (let i = 0; i < 400 && !solved; i++) solved = G.ponder(games, 200_000);
  assert.ok(solved, 'nothing solved');
  assert.ok(G.known().book > b0);
  // the solved entry is right: the book's values for that position are the solver's
  const key = solved;
  const board = key.split('').map(Number);
  const sc = SV.scoreMoves(SV.bitsOf(board), {}, true);
  const want = sc.map((v, c) => (v == null ? '.' : v > 0 ? 'W' : v < 0 ? 'L' : 'D')).join('');
  assert.equal(G.save().book[key], want);
  // the worker: a study request answers with what he found, then what he knows, then his record to keep
  const out = [];
  W.gymMessage({ gym: 'study', id: 'connect4', req: 7, rec: null, epoch: 5, moves, ghosty: 2 }, (m) => out.push(m));
  const reply = out.find((m) => m.gym === 'reply');
  assert.equal(reply.req, 7);
  assert.equal(reply.study.idea, 'a double threat on columns 2 and 6');
  assert.ok(out.find((m) => m.gym === 'known').lessons >= 1);
  const saved = out.find((m) => m.gym === 'save');
  assert.ok(Object.values(saved.rec.saved.book).some((x) => x.endsWith('!')), 'the lesson goes into his record');
});

test('his lines: none without games; the count; a win where he saw the trap; the GYM\'s greeting says what changed', () => {
  assert.equal(T.cardLine([]), 'We haven’t played yet.');
  assert.equal(T.countLine([]), 'We haven’t played yet.');
  assert.equal(T.screenLine([]), 'We haven’t played yet. You move first.');
  const g = (result, why = [], study = undefined) => ({ at: 1, moves: new Array(23).fill(3), ghosty: 2, result, why, ...(study ? { study } : {}) });
  const studied = { wonAt: 23, idea: 'a double threat on columns 3 and 5', kind: 'double', turn: null, labelled: 9, complete: false };
  const games = [g('me'), g('you', [], studied), g('you', [], studied), g('me'), g('you', [], studied), g('draw'), g('me')];
  assert.equal(T.countLine(games), 'You’ve taught me 3 lessons; I’ve won 2 of the last 5.');
  assert.equal(T.cardLine(games), 'You’ve taught me 3 lessons.');
  // a loss not studied yet says so
  assert.equal(T.screenLine([g('you')]), 'You beat me at move 23. I’m studying it.');
  assert.equal(T.cardLine([g('you')]), 'You won at move 23. Studying it.');
  // a win: the move where he kept clear of a forced loss, "this time" only after a loss
  const win = g('me', [{ r: 'Nothing loses within 12 moves. My instinct chose column 4.', k: 'search' }, { r: 'Nothing loses within 12 moves.', k: 'search' }, { r: 'Columns 2 and 6 lose by force. I kept clear.', k: 'search' }]);
  assert.equal(T.screenLine([g('you', [], studied), win]), 'I saw the trap at move 6 this time.');
  assert.equal(T.screenLine([win]), 'I saw the trap at move 6.');
  assert.equal(T.screenLine([g('me')]), 'I won at move 23.');
  assert.equal(T.screenLine([g('you', [], studied), g('me', [{ r: 'You taught me this position: column 4 loses.', k: 'lesson' }])]), 'I remembered your lesson at move 2.');
  // the greeting: nothing before the first visit; then what changed, in his words
  const day = 86_400_000;
  const t0 = new Date(2026, 9, 24, 21, 0).getTime();
  assert.equal(T.greeting(null, { lessons: 0, self: 0, solved: 0, played: 0 }, t0), null);
  const seen = { at: t0, t: { lessons: 1, self: 12_000, solved: 3, played: 4 } };
  assert.equal(T.greeting(seen, { lessons: 3, self: 16_013, solved: 3, played: 6 }, t0 + day / 2), 'Since yesterday: 2 games with you, 2 lessons from you, 4,000 games against myself.');
  assert.equal(T.greeting(seen, seen.t, t0 + day / 2), 'Since yesterday: nothing new.');
  assert.equal(T.greeting(seen, { ...seen.t, solved: 5 }, t0 + 1000), 'Since earlier today: 2 positions solved.');
  assert.equal(T.greeting(seen, { ...seen.t, self: 12_040 }, t0 + 3 * day), 'Since Saturday: 40 games against myself.');
});

