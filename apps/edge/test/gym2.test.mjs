// The GYM, part 2 (apps/web/src/gym): checkers, chess, Go 9×9, simple poker, Sokoban, balance & lander. For
// each: the rules (perft counts for chess, the known Kuhn poker value, exact solvers), the problem maker and
// checker, the ground truth (fixed reference engines, exact best responses, an optimal solver, held-out
// starts), that an untrained learner is below the bar, and that a seeded learner climbs levels by training.
// (Run from offline.test.mjs, which is in the test list; package.json is protected.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({
  entryPoints: ['core', 'index', 'session', 'worker', 'checkers', 'chess', 'go', 'poker', 'sokoban', 'balance'].map((f) => at(`../../web/src/gym/${f}.ts`)),
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outdir: at('./.build/gym2'),
  outExtension: { '.js': '.mjs' },
  logLevel: 'warning',
});
const load = (f) => import(`./.build/gym2/${f}.mjs`);
const C = await load('core');
const I = await load('index');
const S = await load('session');
const W = await load('worker');
const CK = await load('checkers');
const CH = await load('chess');
const GO = await load('go');
const PK = await load('poker');
const SK = await load('sokoban');
const BL = await load('balance');
const { GAMES, gameById } = I;
const NEW = ['checkers', 'chess', 'go', 'poker', 'sokoban', 'balance'];

/** Train a session until `n` more units are played (chess and Go play a game a slice at a time: 0 until one ends). */
function trainUnits(s, n) {
  let k = 0;
  for (let calls = 0; k < n && calls < n * 400; calls++) k += s.train(n - k);
  return k;
}
/**
 * Climb: train in steps and measure (whole matches at once) until `upto` is passed or `cap` units are used.
 * Each time a level is passed, the passer is frozen (a fresh learner from what it knew then) and measured
 * at the next level: it must be below that level's bar — every level asks for something new.
 */
function climb(id, upto, step, cap) {
  I.setSlice(Infinity);
  const g = gameById(id);
  const s = new S.Session(g);
  const passed = [];
  const frozen = [];
  const t0 = performance.now();
  while (s.rec.level <= upto && s.rec.units < cap && !s.rec.mastered) {
    trainUnits(s, step);
    const ev = s.measure();
    if (!ev) continue;
    const L = s.rec.level - (ev === 'level' ? 1 : 0);
    passed.push(`L${L} at ${s.rec.units} ${g.unit} (${Math.round((performance.now() - t0) / 1000)} s)`);
    if (ev === 'level') {
      const m = g.learner(L + 1, s.rec.seed, s.learner.save()).measure().mastery;
      frozen.push({ level: L + 1, m, bar: g.bar(L + 1) });
    }
  }
  I.setSlice(60);
  return { s, passed, frozen };
}
/** The frozen passers were all below the next level's bar. */
function noFreeLevels(id, frozen) {
  for (const f of frozen) assert.ok(f.m < f.bar, `${id}: the frozen passer of Level ${f.level - 1} reaches ${f.m.toFixed(3)} at Level ${f.level} (bar ${f.bar})`);
  console.log(`  ${id}: frozen passers at the next level: ${frozen.map((f) => `L${f.level} ${f.m.toFixed(2)}<${f.bar}`).join(', ')}`);
}

// ---- first, while nothing is warmed up: the phone's worker is never held up -----------------------------------------
test('gym 2 worker: nothing the worker does for these games takes over 200 ms — at every level, with no warm-up', () => {
  // As the worker calls them: a new session (it measures once), training as asked, measuring, WATCH, the picture, saving.
  I.setSlice(60);
  const slow = [];
  for (const id of NEW) {
    const g = gameById(id);
    for (let L = 1; L <= 10; L++) {
      const time = (what, f) => {
        const t = performance.now();
        const x = f();
        const ms = performance.now() - t;
        if (ms > 200) slow.push(`${id} L${L} ${what} ${Math.round(ms)} ms`);
        return x;
      };
      const s = time('start', () => new S.Session(g, { ...S.newRecord(id), level: L }));
      for (let i = 0; i < 4; i++) time('train', () => s.train(15));
      for (let i = 0; i < 4; i++) time('measure', () => s.measure());
      time('watch', () => s.learner.watch(3));
      time('picture', () => s.learner.view());
      time('save', () => s.snapshot());
    }
  }
  assert.deepEqual(slow, []);
});

// ---------------------------------------------------------------------------------------------------------
test('gym 2: six more games after part 1, on the same interface', () => {
  assert.deepEqual(
    GAMES.slice(10, 16).map((g) => g.id),
    NEW,
  );
  for (const id of NEW) {
    const g = gameById(id);
    assert.ok(g.title && g.learns && g.unit && g.blurb, id);
    for (let l = 1; l <= 10; l++) assert.ok(g.bar(l) > 0 && g.bar(l) <= 1, `${id} bar L${l}`);
    for (const level of [1, 5, 10]) {
      const e = g.env(level);
      e.reset(7);
      const acts = e.actions();
      assert.ok(acts.length > 0, `${id} L${level}: no moves`);
      const r = e.step(acts[0]);
      assert.equal(typeof r.reward, 'number');
      assert.equal(typeof r.done, 'boolean');
      assert.ok(e.describe().length > 40, `${id}: describe`);
    }
  }
  // Chess, checkers and Go can be played on the board; the others cannot.
  assert.deepEqual(NEW.filter((id) => gameById(id).play === 'board'), ['checkers', 'chess', 'go']);
  // Chess says plainly what it is measured against.
  assert.match(gameById('chess').learns, /not Stockfish/);
  // No made-up ratings: what the status says comes from the matches themselves.
  for (const m of [CK, CH, GO]) assert.equal(m.LADDER, undefined);
  // Every board-game level is one rung; harder rungs give fewer odds or face a deeper search (checked by matches below).
  for (const m of [CK, CH, GO]) assert.equal(m.RUNGS.length, 10);
});

// ---- problems: right answers pass (also with labels and words), near misses fail ---------------------------------
const TILE = { U: 'up', D: 'down', L: 'left', R: 'right' };
const RIGHT = {
  checkers: (p) => p.data.answer,
  chess: (p) => p.data.san[0],
  go: (p) => p.data.names[0],
  poker: (p) => String(p.data.answer),
  sokoban: (p) => p.data.moves,
  balance: (p) => (p.data.answer === 'crash' ? 'crash' : p.data.answer.toFixed(1)),
};
const LABELLED = {
  checkers: (p, r) => `Black's pieces on the left can jump.\nBest move: ${r}`,
  chess: (p, r) => `Looking at the checks first.\n**Answer:** ${r}`,
  go: (p, r) => `The group has two liberties.\nBlack plays at ${r}.`,
  poker: (p, r) => (p.data.kind === 'act' ? `Weighing it up.\nI would ${r}.` : Number(r) < 0 ? `Player 1 loses ${-Number(r)} chips.` : `Answer: ${r}`),
  sokoban: (p, r) => `Moves: ${[...r].map((c) => TILE[c]).join(', ')}`,
  balance: (p, r) => (r === 'crash' ? 'Not enough room to stop: it will crash.' : `Answer: ${r} ${p.data.kind === 'time' ? 's' : 'm'}`),
};
const WRONG = {
  checkers(p) {
    const pos = CK.ckFrom(p.data.board);
    return CK.moveText(CK.legalCk(pos).find((m) => CK.moveText(m) !== p.data.answer));
  },
  chess(p) {
    const pos = CH.fromFen(p.data.fen);
    const m = CH.legal(pos).find((x) => !p.data.best.includes(CH.uci(x)));
    return CH.san(pos, m);
  },
  go(p) {
    const g = GO.newGo(p.data.n);
    const pt = [...Array(p.data.n * p.data.n).keys()].find((x) => !p.data.best.includes(x));
    return GO.ptName(g, pt);
  },
  poker: (p) => (p.data.kind === 'act' ? p.data.options.find((o) => o !== p.data.answer) : String(p.data.answer + 1)),
  sokoban: (p) => p.data.moves.slice(0, -1),
  balance: (p) => (p.data.answer === 'crash' ? '12.0' : (p.data.answer + 0.5).toFixed(1)),
};

test('gym 2: every new game makes checkable problems at levels 1, 4, 7, 10 — the right answer passes, a near miss fails', () => {
  for (const id of NEW) {
    const g = gameById(id);
    for (const level of [1, 4, 7, 10]) {
      for (const seed of [2, 3]) {
        const p = g.generate(level, seed);
        assert.equal(p.game, id);
        assert.equal(p.level, level);
        assert.ok(p.text.length > 60, `${id}: text`);
        assert.equal(g.generate(level, seed).text, p.text, `${id} L${level}: not deterministic`);
        const ok = g.check(p, RIGHT[id](p));
        assert.ok(ok.correct && ok.score === 1, `${id} L${level} seed ${seed}: the right answer failed: ${ok.why}`);
        const lab = g.check(p, LABELLED[id](p, RIGHT[id](p)));
        assert.ok(lab.correct, `${id} L${level} seed ${seed}: the labelled right answer failed: ${lab.why} (${LABELLED[id](p, RIGHT[id](p))})`);
        const wrong = WRONG[id](p);
        const bad = g.check(p, wrong);
        assert.ok(!bad.correct && bad.score < 1 && bad.why, `${id} L${level} seed ${seed}: a near miss passed: ${wrong}`);
        assert.ok(!g.check(p, LABELLED[id](p, wrong)).correct, `${id} L${level}: a labelled near miss passed`);
      }
    }
  }
  // Answers are read from the last line, not picked out of the working.
  const ck = CK.checkers.generate(4, 2);
  assert.ok(!CK.checkers.check(ck, `${ck.data.answer} looks good\nbut I am not sure`).correct);
  const ch = CH.chess.generate(1, 2);
  assert.ok(CH.chess.check(ch, `Many moves check.\nFinal: ${CH.uci(CH.legal(CH.fromFen(ch.data.fen)).find((m) => ch.data.best.includes(CH.uci(m))))}`).correct, 'UCI form');
  assert.equal(PK.readChips('Player 1 loses 3'), -3);
  assert.equal(PK.readChips('Answer: −5'), -5);
  assert.equal(PK.readChips('Player 1 wins 4 chips'), 4);
  assert.equal(GO.readPoint(9, 'I play J9'), 8);
});

test('gym 2: answers that hedge, negate or name the wrong player are refused; right answers in plain words are read', () => {
  const both = (id, L, seed, f, want) => {
    const g = gameById(id);
    const p = g.generate(L, seed);
    const a = f(p);
    assert.equal(g.check(p, a).correct, want, `${id} L${L}: ${JSON.stringify(a)} should be ${want ? 'right' : 'refused'}`);
  };
  for (const L of [1, 4, 8]) {
    const p = CH.chess.generate(L, 2);
    const pos = CH.fromFen(p.data.fen);
    const wrong = CH.san(pos, CH.legal(pos).find((x) => !p.data.best.includes(CH.uci(x))));
    both('chess', L, 2, () => `${wrong} or ${p.data.san[0]}`, false);
    both('chess', L, 2, () => `${p.data.san[0]} or ${wrong}`, false);
    both('chess', L, 2, () => `Not ${wrong}: ${p.data.san[0]}`, true);
    both('chess', L, 2, () => `${p.data.san[0]} (threatening mate on h7)`, true);
    both('chess', L, 2, () => `1. ${p.data.san[0]}`, true);
  }
  for (const L of [1, 5, 9]) {
    const p = GO.go.generate(L, 3);
    const nm = p.data.names[0];
    const wrong = GO.ptName(GO.newGo(p.data.n), [...Array(p.data.n * p.data.n).keys()].find((x) => !p.data.best.includes(x)));
    both('go', L, 3, () => `${wrong} or ${nm}`, false);
    both('go', L, 3, () => `Black plays ${nm}. A 2-move capture.`, true);
    both('go', L, 3, () => `Answer: ${nm[0]}-${nm.slice(1)}`, true);
  }
  for (const L of [1, 4, 9]) {
    const p = CK.checkers.generate(L, 2);
    both('checkers', L, 2, () => `Move 1: ${p.data.answer}`, true);
    both('checkers', L, 2, () => p.data.answer.replace(/[-x]/g, ' to '), true);
    const other = CK.moveText(CK.legalCk(CK.ckFrom(p.data.board)).find((m) => CK.moveText(m) !== p.data.answer));
    both('checkers', L, 2, () => `${other} or ${p.data.answer}`, false);
  }
  for (const seed of [2, 3]) {
    const p = PK.poker.generate(1, seed);
    const o = p.data.options.find((x) => x !== p.data.answer);
    both('poker', 1, seed, () => `${o} or ${p.data.answer}`, false);
    both('poker', 1, seed, () => `I would not ${o}; I'd ${p.data.answer}`, true);
    both('poker', 1, seed, () => `Don't ${p.data.answer}.`, false);
  }
  // Which player wins, and breaking even.
  assert.equal(PK.readChips('Player 2 wins 3'), -3);
  assert.equal(PK.readChips('Player 2 loses 2 chips'), 2);
  assert.equal(PK.readChips('Player 1 breaks even.'), 0);
  assert.ok(Number.isNaN(PK.readChips('Player 1 is down 4 — no, up')));
  // Balance: a crash that is ruled out is not a crash; working in brackets is not the answer; two numbers is a hedge.
  assert.ok(Number.isNaN(BL.readBalance('It does not crash.', 'm')));
  assert.ok(Number.isNaN(BL.readBalance('No crash: it stops in time.', 'm')));
  assert.equal(BL.readBalance('crash at 0 m', 'm'), 'crash');
  assert.equal(BL.readBalance('8.2 m (using g = 1.62)', 'm'), 8.2);
  assert.ok(Number.isNaN(BL.readBalance('Either 11.2 or 8.2 m', 'm')));
  // Sokoban: a solution with more pushes than needed is not the answer (it scores less than 1).
  const room = SK.decode('8:#########@$-.--##------#########:9:0').p;
  const pr = { game: 'sokoban', level: 1, seed: 0, text: '', data: { map: SK.encode(room, 2), opt: 2 } };
  assert.ok(SK.sokoban.check(pr, 'RR').correct);
  const long = SK.sokoban.check(pr, 'RRRDRRUL');
  assert.ok(!long.correct && long.score === 0.5, JSON.stringify(long));
});

// ---- no level is handed out ------------------------------------------------------------------------------------
test('gym 2: an untrained learner is below the bar at every level — measured in full (whole matches) — and measuring alone never moves up', () => {
  I.setSlice(Infinity);
  for (const id of NEW) {
    for (let level = 1; level <= 10; level++) {
      const r = gameById(id).learner(level, 1).measure();
      assert.doesNotMatch(r.detail, /under way/, `${id} L${level}: a whole measurement was made`);
      assert.ok(r.mastery < gameById(id).bar(level) - 0.1, `${id} L${level}: untrained ${r.mastery} is not clearly below ${gameById(id).bar(level)} (${r.detail})`);
    }
    // Measuring alone (whole matches each time) never moves him up.
    const s = new S.Session(gameById(id));
    for (let i = 0; i < 3; i++) assert.equal(s.measure(), null, `${id}: measuring alone passed a level`);
    assert.equal(s.rec.level, 1);
    assert.doesNotMatch(s.rec.detail, /under way/);
  }
  I.setSlice(60);
});

// ---- checkers ----------------------------------------------------------------------------------------------------
test('checkers: the rules — perft counts from the start, compulsory captures, multi-jumps, crowning ends the move', () => {
  const start = CK.startCk();
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map((d) => CK.countCk(start, d)), [7, 49, 302, 1469, 7361, 36768, 179740]);
  // A capture must be taken, and a double jump goes on to the end.
  const p = { b: new Int8Array(32), side: 1, quiet: 0 };
  p.b[CK.sqAt(2, 1)] = 1; // Black man
  p.b[CK.sqAt(3, 2)] = -1;
  p.b[CK.sqAt(5, 4)] = -1;
  p.b[CK.sqAt(0, 7)] = 1; // another Black man that could move quietly
  const moves = CK.legalCk(p);
  assert.equal(moves.length, 1, 'only the capture');
  assert.deepEqual(moves[0].path, [CK.sqAt(2, 1), CK.sqAt(4, 3), CK.sqAt(6, 5)]);
  assert.equal(moves[0].caps.length, 2);
  // A man jumping onto the far row is crowned and stops there.
  const q = { b: new Int8Array(32), side: 1, quiet: 0 };
  q.b[CK.sqAt(5, 2)] = 1;
  q.b[CK.sqAt(6, 3)] = -1;
  q.b[CK.sqAt(6, 5)] = -1; // a king could jump on from 7,4 — a new king may not
  const cm = CK.legalCk(q);
  assert.equal(cm.length, 1);
  assert.equal(cm[0].path.length, 2);
  CK.playCk(q, cm[0]);
  assert.equal(q.b[CK.sqAt(7, 4)], 2, 'crowned');
  // No moves left = lost; 40 moves each with no capture or man move = a draw.
  assert.equal(CK.resultCk({ b: new Int8Array(32), side: 1, quiet: 0 }), -1);
  const kings = { b: new Int8Array(32), side: 1, quiet: 80 };
  kings.b[0] = 2;
  kings.b[31] = -2;
  assert.equal(CK.resultCk(kings), 0.5);
  // A stalled game is scored by material, not called a draw: two men up wins.
  const up = { b: new Int8Array(32), side: 1, quiet: 80 };
  up.b[0] = 2;
  up.b[1] = 2;
  up.b[2] = 1;
  up.b[31] = -2;
  assert.equal(CK.scoreCk(up, 10, 160), 1);
  assert.equal(CK.scoreCk({ ...up, quiet: 0 }, 160, 160), 1, 'at the move limit too');
  assert.equal(CK.scoreCk({ ...up, quiet: 0 }, 10, 160), null);
  // The reference finishes a won ending (two kings against one) instead of shuffling.
  const end = { b: new Int8Array(32), side: 1, quiet: 0 };
  end.b[13] = 2;
  end.b[18] = 2;
  end.b[3] = -2;
  let r = null;
  for (let ply = 0; ply < 80 && r == null; ply++) {
    r = CK.scoreCk(end, ply, 1000);
    if (r == null) CK.playCk(end, CK.bestMove(end, 6, CK.referenceEval).move);
  }
  assert.equal(r, 1, 'two kings beat one by capture or blockade, not by the stall rule');
  assert.ok(CK.legalCk(end).length === 0 || ![...end.b].includes(-2), 'won on the board');
  // A paused search ends exactly where the whole search does.
  const mid = CK.startCk();
  for (const m of CK.openings(3)[2]) CK.playCk(mid, m);
  const it = CK.searchGen(mid, 5, CK.referenceEval);
  let x;
  let steps = 0;
  while (!(x = it.next()).done) steps++;
  assert.equal(CK.moveText(x.value.move), CK.moveText(CK.bestMove(mid, 5, CK.referenceEval).move));
  assert.ok(steps > 0, 'the depth-5 search paused along the way');
});

test('checkers: TD self-play climbs the odds ladder; a frozen passer never passes the next level', () => {
  const { s, passed, frozen } = climb('checkers', 4, 250, 12000);
  assert.ok(s.rec.level >= 5, `stopped at Level ${s.rec.level} (${s.rec.detail}); passed ${passed.join(', ')}`);
  console.log(`  checkers passed: ${passed.join('; ')}`);
  noFreeLevels('checkers', frozen);
  assert.doesNotMatch(s.rec.detail, /rating/);
  // PLAY HIM: from the start he answers with a legal move.
  const mv = s.learner.move(CK.ckState(CK.startCk()));
  assert.ok(mv >= 0 && mv < 7);
});

// ---- chess -------------------------------------------------------------------------------------------------------
test('chess: perft counts on the standard test positions (castling, en passant, promotion, checks)', () => {
  const cases = [
    [CH.START, [20, 400, 8902, 197281]],
    ['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862]],
    ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238]],
    ['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]],
    ['rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]],
    ['r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10', [46, 2079, 89890]],
  ];
  for (const [fen, want] of cases) {
    const p = CH.fromFen(fen);
    assert.deepEqual(want.map((_, i) => CH.perft(p, i + 1)), want, fen);
    assert.equal(CH.toFen(p), fen, 'make / unmake leave the position as it was');
  }
});

test('chess: the other rules — no castling through check, en passant, promotion, mate, stalemate, 50 moves, threefold, too little material', () => {
  const names = (fen) => {
    const p = CH.fromFen(fen);
    return CH.legal(p).map((m) => CH.san(p, m));
  };
  // A bishop on c4 covers f1: no short castling; long castling is fine.
  assert.ok(!names('r3k2r/8/8/8/2b5/8/8/R3K2R w KQkq - 0 1').includes('O-O'));
  assert.ok(names('r3k2r/8/8/8/2b5/8/8/R3K2R w KQkq - 0 1').includes('O-O-O'));
  // En passant (and it leaves the other pawn's square empty).
  const ep = CH.fromFen('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2');
  const exd6 = CH.legal(ep).find((m) => CH.uci(m) === 'e5d6');
  assert.ok(exd6 != null, 'e5xd6 en passant');
  CH.make(ep, exd6);
  assert.equal(CH.toFen(ep).split(' ')[0], '4k3/8/3P4/8/8/8/8/4K3');
  // Promotion: four choices.
  assert.deepEqual(names('8/P6k/8/8/8/8/8/4K3 w - - 0 1').filter((s) => s.startsWith('a8')).map((s) => s.replace(/[+#]/, '')).sort(), ['a8=B', 'a8=N', 'a8=Q', 'a8=R']);
  // Mate and stalemate.
  assert.equal(CH.status(CH.fromFen('7k/6Q1/6K1/8/8/8/8/8 b - - 0 1')), 'mate');
  assert.equal(CH.status(CH.fromFen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')), 'stalemate');
  // The 50-move rule, too little material.
  assert.equal(CH.status(CH.fromFen('4k3/8/8/8/8/8/4R3/4K3 w - - 100 80')), 'fifty');
  assert.equal(CH.status(CH.fromFen('4k3/8/8/8/8/8/4N3/4K3 w - - 0 1')), 'material');
  // Threefold repetition: knights out and back twice.
  const rep = CH.fromFen(CH.START);
  for (let i = 0; i < 2; i++) CH.applyUci(rep, 'g1f3 g8f6 f3g1 f6g8');
  assert.equal(CH.status(rep), 'repetition');
  // Reading moves: standard notation and from-to squares.
  const st = CH.fromFen(CH.START);
  assert.equal(CH.uci(CH.readMove(st, 'I like Nf3')), 'g1f3');
  assert.equal(CH.uci(CH.readMove(st, 'Answer: e2-e4')), 'e2e4');
  // The page's view of a position round-trips.
  const q = CH.posFrom(CH.posState(CH.fromFen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1')));
  assert.equal(CH.perft(q, 2), 2039);
});

test('chess: the tactics set — every forced mate is proved by exhaustive search, and he is rated against Ghosty\'s own engines', () => {
  const set = CH.tactics();
  assert.equal(set.length, 30);
  for (const n of [1, 2, 3]) assert.equal(set.filter((t) => t.n === n).length, 10);
  for (const t of set.filter((x) => x.n <= 2)) {
    const p = CH.fromFen(t.fen);
    assert.deepEqual(CH.matingMoves(p, t.n).map(CH.uci).sort(), [...t.best].sort(), t.fen);
    if (t.n === 2) assert.ok(!CH.matesIn(p, 1), `${t.fen}: a shorter mate`);
  }
  // Mate in 3: the stored first moves force it (all replies tried) for a few of them.
  for (const t of set.filter((x) => x.n === 3).slice(0, 3)) {
    const p = CH.fromFen(t.fen);
    const m = CH.legal(p).find((x) => CH.uci(x) === t.best[0]);
    CH.make(p, m);
    for (const r of CH.legal(p)) {
      CH.make(p, r);
      assert.ok(CH.legal(p).length === 0 || CH.matesIn(p, 2), `${t.fen}: ${t.best[0]} does not mate in 3 after ${CH.uci(r)}`);
      CH.unmake(p);
    }
  }
  // Odds: the reference starts without its pieces, the openings still play.
  const q = CH.fromFen(CH.oddsFen(false, 'qrnpp'));
  assert.equal(CH.material(q), 9 + 5 + 3 + 2);
  for (const line of CH.OPENINGS) CH.applyUci(CH.fromFen(CH.oddsFen(true, 'qrnpp')), line);
  // A paused search ends exactly where the whole search does.
  const p = CH.fromFen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
  const it = CH.searchGen(p, 3, CH.referenceEval);
  let x;
  let steps = 0;
  while (!(x = it.next()).done) steps++;
  assert.equal(x.value.move, CH.bestMove(p, 3, CH.referenceEval).move);
  assert.ok(steps > 3);
});

test('chess: self-play tuning climbs the odds ladder from 0%; a frozen passer never passes the next level', () => {
  const { s, passed, frozen } = climb('chess', 3, 50, 1500);
  assert.ok(s.rec.level >= 4, `stopped at Level ${s.rec.level} after ${s.rec.units} games (${s.rec.detail}); passed ${passed.join(', ')}`);
  console.log(`  chess passed: ${passed.join('; ')}`);
  noFreeLevels('chess', frozen);
  assert.match(s.rec.detail, /not Stockfish/);
  // What a queen is worth to him is learned, from nothing: more than a rook, a rook more than a pawn.
  const w = s.learner.save().w;
  assert.ok(w[4] > w[3] && w[3] > w[0], `learned values P ${w[0]} R ${w[3]} Q ${w[4]}`);
  // PLAY HIM: a legal reply.
  const mv = s.learner.move(CH.posState(CH.fromFen(CH.START)));
  assert.ok(CH.fromPageMove(CH.fromFen(CH.START), mv) >= 0);
});

// ---- Go ----------------------------------------------------------------------------------------------------------
test('go: the rules — captures, no suicide, ko, area scoring with komi 7; the capture puzzles are proved by exhaustive search', () => {
  const g = GO.newGo(9);
  const at2 = (pt) => GO.inner(g, pt);
  // Black surrounds a White stone in the corner and takes it.
  g.side = 2;
  GO.playAt(g, at2(0));
  g.side = 1;
  GO.playAt(g, at2(1));
  g.side = 1;
  GO.playAt(g, at2(9));
  assert.equal(g.b[at2(0)], 0, 'the White stone is captured');
  // Suicide is illegal: White may not play back into the corner.
  g.side = 2;
  assert.ok(!GO.legalAt(g, at2(0)));
  // Ko: take one stone, the other side may not retake at once.
  const k = GO.newGo(5);
  const p5 = (r, c) => GO.inner(k, r * 5 + c);
  for (const [r, c, x] of [[0, 1, 1], [1, 0, 1], [2, 1, 1], [0, 2, 2], [1, 3, 2], [2, 2, 2], [1, 2, 1]]) {
    k.side = x;
    assert.ok(GO.playAt(k, p5(r, c)));
  }
  k.side = 2;
  assert.ok(GO.playAt(k, p5(1, 1)), 'White takes the ko');
  assert.ok(!GO.legalAt(k, p5(1, 2)), 'Black may not retake at once');
  // Area scoring with komi.
  const e = GO.newGo(9);
  assert.equal(GO.margin(e), -7, 'an empty board: White wins by komi');
  e.side = 1;
  GO.playAt(e, GO.inner(e, 40));
  assert.equal(GO.area(e).diff, 81, 'one stone owns the whole board');
  // Every stored capture puzzle: its first moves are exactly those that capture by force within n, and not sooner.
  const set = GO.puzzles();
  assert.ok(set.length >= 20);
  for (const p of set) {
    assert.deepEqual(GO.capturingMoves(p.g, p.target, p.n).sort((a, b) => a - b), [...p.best].sort((a, b) => a - b));
    if (p.n > 1) assert.ok(!GO.captures(p.g, p.target, p.n - 1), 'not sooner');
  }
});

test('go: he passes when a settled game is his; his tables are kept small', () => {
  // A settled board: Black's wall down the middle, White owns the bigger side.
  const g = GO.newGo(9);
  for (let r = 0; r < 9; r++) {
    g.b[GO.inner(g, r * 9 + 3)] = 1;
    g.b[GO.inner(g, r * 9 + 4)] = 2;
  }
  const l = GO.go.learner(1, 1);
  // The owner (Black) has just passed; White (him) is ahead by area: he passes and the game ends.
  g.side = 2;
  g.passes = 1;
  assert.ok(GO.margin(g) < 0);
  assert.equal(l.move(GO.goState(g)), -1);
  // Behind, he plays on.
  const h = GO.newGo(9);
  for (let r = 0; r < 9; r++) {
    h.b[GO.inner(h, r * 9 + 5)] = 1;
    h.b[GO.inner(h, r * 9 + 6)] = 2;
  }
  h.side = 2;
  h.passes = 1;
  assert.ok(GO.margin(h) > 0);
  assert.notEqual(l.move(GO.goState(h)), -1);
  // What is kept is a few tens of KB after training, and comes back the same.
  for (let k = 0; k < 10; ) k += l.train(1);
  const saved = l.save();
  const bytes = saved.idx.byteLength + saved.val.byteLength + saved.line.byteLength;
  assert.ok(bytes < 200_000, `${bytes} bytes saved`);
  const back = GO.go.learner(1, 1, saved);
  assert.deepEqual(Array.from(back.t.own), Array.from(l.t.own));
  assert.deepEqual(Array.from(back.t.pol), Array.from(l.t.pol));
});

test('go: self-play of the pattern evaluator climbs the ladder; a frozen passer never passes the next level', () => {
  const { s, passed, frozen } = climb('go', 2, 10, 300);
  assert.ok(s.rec.level >= 3, `stopped at Level ${s.rec.level} after ${s.rec.units} games (${s.rec.detail}); passed ${passed.join(', ')}`);
  console.log(`  go passed: ${passed.join('; ')}`);
  noFreeLevels('go', frozen);
  const mv = s.learner.move(GO.goState(GO.newGo(9)));
  assert.ok(mv >= 0 && mv < 81, `a point on the board: ${mv}`);
});

// ---- poker ----------------------------------------------------------------------------------------------------------
test('poker: Kuhn poker is worth −1/18 to the first player at equilibrium; exploitability is exact; CFR+ gets there', () => {
  const t = PK.tree('kuhn');
  assert.equal(t.infos.length, 12);
  assert.equal(PK.tree('leduc').infos.length, 288);
  // A known equilibrium (α = 1/4): nobody can exploit it, and its value is −1/18.
  const a = 0.25;
  const s = PK.uniform(t);
  const set = (key, probs) => {
    const i = t.infos.findIndex((I) => I.key === key);
    assert.ok(i >= 0, key);
    probs.forEach((x, k) => (s[i * 3 + k] = x));
  };
  set('0|J||/', [1 - a, a]);
  set('0|Q||/', [1, 0]);
  set('0|K||/', [1 - 3 * a, 3 * a]);
  set('0|J||/cr', [1, 0]);
  set('0|Q||/cr', [2 / 3 - a, a + 1 / 3]);
  set('0|K||/cr', [0, 1]);
  set('1|J||/r', [1, 0]);
  set('1|Q||/r', [2 / 3, 1 / 3]);
  set('1|K||/r', [0, 1]);
  set('1|J||/c', [2 / 3, 1 / 3]);
  set('1|Q||/c', [1, 0]);
  set('1|K||/c', [0, 1]);
  assert.ok(Math.abs(PK.gameValue(t, s) + 1 / 18) < 1e-12, `value ${PK.gameValue(t, s)}`);
  assert.ok(Math.abs(PK.exploitability(t, s)) < 1e-12, `exploitability ${PK.exploitability(t, s)}`);
  // Playing every option equally often is exploitable; CFR+ drives it towards 0 and the value to −1/18.
  assert.ok(PK.uniformExploitability('kuhn') > 0.4);
  const c = new PK.CFR(t);
  for (let i = 0; i < 2000; i++) c.iterate();
  const avg = c.average();
  assert.ok(PK.exploitability(t, avg) < 0.002);
  assert.ok(Math.abs(PK.gameValue(t, avg) + 1 / 18) < 0.002);
  // A best response never does worse than the equilibrium value.
  assert.ok(PK.bestResponse(t, avg, 0) >= -1 / 18 - 1e-9 && PK.bestResponse(t, avg, 1) >= 1 / 18 - 1e-9);
});

test('poker: every level is a different game with an absolute limit; CFR+ masters all ten, and no passer carries over', () => {
  // Ten different games, each a different tree.
  const keys = new Set();
  for (let L = 1; L <= 10; L++) {
    const t = PK.tree(PK.variantFor(L));
    keys.add(`${t.infos.length}/${t.spec.ranks}/${t.spec.raises}/${t.spec.board}`);
    // The bar is the level's own limit in chips: mastery 0.9 exactly at it.
    assert.ok(Math.abs(PK.masteryOf(t.spec.limit, t.spec.limit) - gameById('poker').bar(L)) < 1e-12);
  }
  assert.equal(keys.size, 10);
  const { s, passed, frozen } = climb('poker', 10, 100, 60000);
  assert.ok(s.rec.mastered, `stopped at Level ${s.rec.level} (${s.rec.detail}); passed ${passed.join(', ')}`);
  console.log(`  poker passed: ${passed.join('; ')}`);
  noFreeLevels('poker', frozen);
  assert.equal(frozen.length, 9);
});

// ---- Sokoban ---------------------------------------------------------------------------------------------------------
test('sokoban: backwards play makes solvable puzzles; the exact solver finds the fewest pushes; the stored sets are what it makes', () => {
  // A corridor: one box, two pushes.
  const p = SK.decode('6:#######@$-.#######:7:0').p;
  assert.equal(SK.optimal(p).pushes, 2);
  // Puzzles made by backwards play are solved by undoing the pulls.
  const r = C.rng(3);
  for (let i = 0; i < 12; i++) {
    const m = SK.makePuzzle(1 + (i % 4), r);
    if (!m) continue;
    const o = SK.optimal(m.p);
    assert.ok(o && o.pushes <= m.route.length - 1, 'solvable, never more pushes than the pulls that made it');
    const moves = SK.spell(m.p, o.route);
    const end = SK.playMoves(m.p, [...moves].map((c) => 'UDLR'.indexOf(c)));
    assert.ok(end.ok && end.boxes.every((b) => m.p.goals.includes(b)) && end.pushes === o.pushes);
  }
  for (const L of [1, 2]) assert.deepEqual(SK.testSet(L).map((t) => SK.encode(t.p, t.opt)), SK.testSet(L, true).map((t) => SK.encode(t.p, t.opt)), `stored set L${L}`);
  for (let L = 1; L <= 10; L++) assert.equal(SK.testSet(L).length, SK.SET_SIZE);
  // Dead squares: a box in the corner where the player starts could never be pushed out again.
  const live = SK.liveSquares(p);
  assert.equal(live[7], 0);
  assert.equal(live[8], 1);
});

test('sokoban: learning dead ends and his guess of the pushes left climbs the levels; a frozen passer never passes the next', () => {
  const { s, passed, frozen } = climb('sokoban', 10, 30, 6000);
  assert.ok(s.rec.mastered, `stopped at Level ${s.rec.level} (${s.rec.detail}); passed ${passed.join(', ')}`);
  console.log(`  sokoban passed: ${passed.join('; ')}`);
  noFreeLevels('sokoban', frozen);
  assert.equal(frozen.length, 9);
  // He has learned that a corner without a goal is a dead end (and believes no goal square is one).
  const brain = { ...s.learner.save() };
  let corners = 0;
  for (const t of SK.testSet(1)) {
    const dead = SK.believedDead(brain, t.p);
    const w = t.p.w;
    for (let c = 0; c < dead.length; c++) {
      if (t.p.wall[c]) continue;
      if (t.p.goals.includes(c)) assert.equal(dead[c], 0, 'a goal is never a dead end');
      else if (t.p.wall[c - w] && t.p.wall[c - 1] && dead[c]) corners++;
    }
  }
  assert.ok(corners > 0, 'some corners are known dead ends');
});

// ---- balance & lander -------------------------------------------------------------------------------------------------
test('balance: plain physics, the reference controllers succeed, doing nothing fails; each level a new task; a frozen passer never passes the next', () => {
  // With no push, a leaning pole falls — one pole, and two.
  const one = [0, 0, 0.05, 0];
  for (let i = 0; i < 100; i++) BL.poleStep(one, 0, { poles: 1, half: 0.5 });
  assert.ok(one[2] > 0.2);
  const two = [0, 0, 0.05, 0, 0, 0];
  for (let i = 0; i < 100; i++) BL.poleStep(two, 0, { poles: 2, half: 0.05 });
  assert.ok(Math.abs(two[2]) > 0.2);
  // The reference controllers succeed (mostly) where nothing at all fails.
  for (let L = 1; L <= 10; L++) assert.ok(BL.reference(L).ok.filter(Boolean).length >= (L <= 7 ? 36 : 14), `reference L${L}: ${BL.reference(L).ok.filter(Boolean).length}`);
  // Two poles need a bigger controller than one: what one pole taught him cannot be used as it is.
  assert.equal(BL.dims(2), 5);
  assert.equal(BL.dims(3), 7);
  const { s: ses, passed, frozen } = climb('balance', 10, 300, 60000);
  assert.ok(ses.rec.mastered, `stopped at Level ${ses.rec.level} (${ses.rec.detail}); passed ${passed.join(', ')}`);
  console.log(`  balance passed: ${passed.join('; ')}`);
  noFreeLevels('balance', frozen);
  assert.equal(frozen.length, 9);
  // WATCH draws the run.
  const frames = ses.learner.watch(5);
  assert.ok(frames.length > 5 && frames.every((f) => f.draw?.shapes.length > 3));
});

// ---- the worker and the phone ----------------------------------------------------------------------------------------
test('gym 2 worker: PLAY HIM answers on all three boards; a measurement never holds the worker up for long', () => {
  const out = [];
  const post = (m) => out.push(m);
  W.gymMessage({ gym: 'move', id: 'checkers', req: 1, board: CK.ckState(CK.startCk()) }, post);
  assert.ok(out.at(-1).move >= 0 && out.at(-1).move < 7, `checkers: ${JSON.stringify(out.at(-1))}`);
  const p = CH.fromFen(CH.START);
  CH.applyUci(p, 'e2e4');
  W.gymMessage({ gym: 'move', id: 'chess', req: 2, board: CH.posState(p) }, post);
  assert.ok(CH.fromPageMove(p, out.at(-1).move) >= 0, `chess: ${JSON.stringify(out.at(-1))}`);
  const g = GO.newGo(9);
  GO.playAt(g, GO.inner(g, 40));
  W.gymMessage({ gym: 'move', id: 'go', req: 3, board: GO.goState(g) }, post);
  const pt = out.at(-1).move;
  assert.ok(pt >= 0 && pt < 81 && pt !== 40, `go: ${pt}`);
  W.gymMessage({ gym: 'watch', id: 'balance', req: 4, seed: 2 }, post);
  assert.ok(out.at(-1).frames[0].draw);
});
