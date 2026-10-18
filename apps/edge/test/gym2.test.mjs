// The GYM, part 2 (apps/web/src/gym): six reasoning games whose problems will later train Ghosty's offline
// language model — LOGIC SANDBOX, MINI-BRAIN LAB, BUG HUNT, TEXT ESCAPE ROOMS, FACT-CHECK DUEL, DEBATE ARENA.
// For each: the rules, the exact ground truth, generate / check with right answers, labelled right answers
// and realistic near misses at Levels 1/4/7/10, that a false claim "proved" or a false side "winning" is
// caught, the stored test sets match what the solvers make, and that a seeded learner really climbs.
// (The shared checks — one interface, an untrained learner below the bar at every level, a session that only
// measures never moves up, the page imports no engine — are in gym.test.mjs and run on these games too.)
// Run from offline.test.mjs, which is in the test list; package.json is protected.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({
  entryPoints: ['core', 'index', 'session', 'worker', 'answer', 'logic', 'logicsets', 'brain', 'tiny', 'bughunt', 'bugsets', 'escape', 'escapesets', 'facts', 'factcheck', 'debate'].map((f) => at(`../../web/src/gym/${f}.ts`)),
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outdir: at('./.build/gym2'),
  outExtension: { '.js': '.mjs' },
  logLevel: 'warning',
});
const load = (f) => import(`./.build/gym2/${f}.mjs`);
const C = await load('core');
const { GAMES, gameById } = await load('index');
const S = await load('session');
const W = await load('worker');
const LG = await load('logic');
const { LOGIC_SETS } = await load('logicsets');
const BR = await load('brain');
const TY = await load('tiny');
const BH = await load('bughunt');
const { BUG_SETS } = await load('bugsets');
const ES = await load('escape');
const FA = await load('facts');
const FC = await load('factcheck');
const DB = await load('debate');

const NEW = ['logic', 'brain', 'bughunt', 'escape', 'factcheck', 'debate'];

// ---------------------------------------------------------------------------------------------------------
test('gym part 2: six reasoning games follow the first ten, on cards in that order', () => {
  assert.deepEqual(GAMES.slice(10).map((g) => g.id), NEW);
  for (const id of NEW) {
    const g = gameById(id);
    assert.ok(g.title && g.blurb && g.learns && g.unit, id);
    assert.equal(g.play, undefined, `${id}: no PLAY HIM (not a board game)`);
  }
});

/** A right answer to each problem, from its own data and ground truth. */
const WORD = { T: 'TRUE', F: 'FALSE', U: "CAN'T TELL" };
const RIGHT = {
  logic: (p) => (p.data.valid ? 'VALID' : 'INVALID'),
  brain: (p) => (p.data.kind === 'count' ? String(p.data.answer) : p.data.answer.join(', ')),
  bughunt: (p) => `Line ${p.data.bug.line}: ${p.data.good}`,
  escape: (p) => p.data.solution.join('\n'),
  factcheck: (p) => WORD[p.data.truth],
  debate: (p) => `${WORD[p.data.truth]}: ${p.data.best.join(', ')}`,
};
/** The right answer written the way a person (or a model) might. */
const LABELLED = {
  logic: (p, r) => `Checking every row of the truth table, the premises never force a contradiction the other way.\n**Answer:** ${r}`,
  brain: (p, r) => `Adding it up layer by layer.\nAnswer: ${r}`,
  bughunt: (p, r) => {
    const [, n, line] = r.match(/^Line (\d+): (.*)$/);
    return `The tests fail on the loop, so I looked there.\nLine ${n} should be \`${line}\``;
  },
  escape: (p, r) => `Here is my plan:\n${r.split('\n').map((c, i) => `${i + 1}. ${c.replace(/^(\w+) /, '$1 the ')}`).join('\n')}`,
  factcheck: (p, r) => `Looking only at the facts given.\nSo the claim is: ${r}`,
  debate: (p, r) => `The judge needs facts that settle it on their own.\nAnswer: ${r}`,
};
/** Near misses: answers that look right but are not. */
const WRONG = {
  logic: (p) => (p.data.valid ? 'INVALID' : 'VALID'),
  brain: (p) => (p.data.kind === 'count' ? String(p.data.answer + 1) : [p.data.answer[0] + 1, ...p.data.answer.slice(1)].join(', ')),
  bughunt(p) {
    // The right line, a plausible but wrong change.
    const lines = p.data.lines;
    for (const c of BH.changes(lines)) {
      if (c.line !== p.data.bug.line) continue;
      const fixed = BH.apply(lines, c);
      if (!BH.runTests(fixed, p.data.tests).pass.every(Boolean)) return `Line ${c.line}: ${fixed[c.line - 1]}`;
    }
    return `Line ${p.data.bug.line}: ${lines[p.data.bug.line - 1]}`;
  },
  escape: (p) => p.data.solution.slice(0, -1).join('\n'),
  factcheck: (p) => WORD[p.data.truth === 'T' ? 'F' : p.data.truth === 'F' ? (p.level === 1 || p.level === 3 || p.level === 7 ? 'T' : 'U') : 'T'],
  debate: (p) => (p.data.best.length > 1 ? `${WORD[p.data.truth]}: ${p.data.best.slice(1).join(', ')}` : `${WORD[p.data.truth === 'T' ? 'F' : 'T']}: ${p.data.best.join(', ')}`),
};

test('gym part 2: every game makes exact, checkable problems — same seed, same problem; right answers pass (also labelled), near misses fail', () => {
  for (const id of NEW) {
    const g = gameById(id);
    for (const level of [1, 4, 7, 10]) {
      for (const seed of [2, 3]) {
        const p = g.generate(level, seed);
        assert.equal(p.game, id);
        assert.equal(p.level, level);
        assert.ok(p.text.length > 60, `${id}: text`);
        assert.ok(!/undefined|NaN|\[object/.test(p.text), `${id} L${level}: the problem text has a hole: ${p.text}`);
        assert.equal(g.generate(level, seed).text, p.text, `${id} L${level}: not deterministic`);
        const right = RIGHT[id](p);
        const ok = g.check(p, right);
        assert.ok(ok.correct, `${id} L${level} seed ${seed}: the right answer failed: ${ok.why}\n${p.text}\n${right}`);
        assert.equal(ok.score, 1, `${id}: score`);
        const lab = g.check(p, LABELLED[id](p, right));
        assert.ok(lab.correct, `${id} L${level} seed ${seed}: the labelled right answer failed: ${lab.why}\n${LABELLED[id](p, right)}`);
        const wrong = WRONG[id](p);
        const bad = g.check(p, wrong);
        assert.ok(!bad.correct, `${id} L${level} seed ${seed}: a near miss passed: ${wrong}`);
        assert.ok(bad.score < 1 && bad.why, id);
        assert.ok(!g.check(p, LABELLED[id](p, wrong)).correct, `${id} L${level}: a labelled near miss passed`);
        assert.ok(!g.check(p, 'I am not sure.').correct, `${id}: no answer passed`);
      }
    }
  }
});

test('gym part 2: checkers read the final answer in words', () => {
  assert.equal(LG.readValid('So it does not follow.'), false);
  assert.equal(LG.readValid("The conclusion doesn't follow from the premises"), false);
  assert.equal(LG.readValid('Answer: not valid'), false);
  assert.equal(LG.readValid('Yes, the conclusion follows.'), true);
  assert.equal(FC.readTruth('It cannot be determined from these facts.'), 'U');
  assert.equal(FC.readTruth('Verdict: not true'), 'F');
  assert.equal(FC.readTruth("can’t tell"), 'U');
  assert.deepEqual(DB.readArgument('**FALSE**: F12 and F7'), { side: 'F', ids: ['F12', 'F7'] });
  assert.deepEqual(BH.readFix('Fix: line 3 -> `while i <= n do`'), { line: 3, text: 'while i <= n do' });
  assert.deepEqual(ES.readCommands('1. open the drawer\n2. take brass key, unlock exit with brass key then go out'), ['open the drawer', 'take brass key', 'unlock exit with brass key', 'go out']);
});

test('gym part 2: a hedge is no answer (the final line naming two verdicts fails); right answers in common wordings pass', () => {
  // Logic.
  const lp = gameById('logic').generate(4, 2);
  const lv = lp.data.valid ? 'VALID' : 'INVALID';
  const lo = lp.data.valid ? 'INVALID' : 'VALID';
  for (const a of ['VALID or INVALID', 'INVALID or VALID', `It is ${lo}? No, ${lv}.`]) assert.ok(!gameById('logic').check(lp, a).correct, `logic hedge passed: ${a}`);
  for (const a of [`Answer: ${lv} — no counterexample exists.`, `Answer: ${lv}, not ${lo}`, `The answer is not ${lo.toLowerCase()}; it is ${lv.toLowerCase()}`, `**${lv}**`]) assert.ok(gameById('logic').check(lp, a).correct, `logic right answer failed: ${a}`);
  assert.equal(LG.readValid('Yes it is valid, no doubt'), true);
  // Fact-check: hedges over every level's problems.
  let hedged = 0;
  for (let level = 1; level <= 10; level++)
    for (let seed = 0; seed < 30; seed++) {
      const p = gameById('factcheck').generate(level, seed);
      for (const a of ["TRUE, FALSE or CAN'T TELL", 'TRUE or FALSE', 'FALSE or TRUE', "TRUE or CAN'T TELL"]) if (gameById('factcheck').check(p, a).correct) hedged++;
    }
  assert.equal(hedged, 0, 'a hedge passed fact-check');
  assert.equal(FC.readTruth('TRUE (it is not false)'), 'T');
  assert.equal(FC.readTruth('TRUE. The claim is not wrong.'), 'T');
  assert.equal(FC.readTruth("Verdict: TRUE — the facts are enough, it's not insufficient"), 'T');
  assert.equal(FC.readTruth('Answer: TRUE — nothing here is unknown.'), 'T');
  assert.equal(FC.readTruth('not false'), 'T', '"not false" is TRUE');
  assert.equal(FC.readTruth('The facts are not enough.'), 'U');
  assert.equal(FC.readTruth('enoughness'), null, 'whole words only');
  // Brain: one number, the right number of outputs; labels are not answers.
  const bc = gameById('brain').generate(2, 3);
  const n = bc.data.answer;
  assert.ok(!gameById('brain').check(bc, `${n - 5} or ${n}`).correct, 'two counts passed');
  assert.ok(gameById('brain').check(bc, `It has ${n} numbers (weights and biases together).`).correct);
  const bf = gameById('brain').generate(7, 3);
  const o = bf.data.answer;
  assert.ok(gameById('brain').check(bf, o.map((v, i) => `Output ${i + 1} = ${v}`).join(', ')).correct, 'labelled outputs failed');
  assert.ok(gameById('brain').check(bf, o.map((v, i) => `y${i + 1} = ${v}`).join(', ')).correct, 'y1 = … failed');
  assert.ok(gameById('brain').check(bf, `(${o.join(', ')})`).correct, 'outputs in brackets failed');
  assert.ok(gameById('brain').check(bf, `${o.join(', ')} (from h1.1 = 2)`).correct, 'a remark in brackets broke it');
  assert.ok(!gameById('brain').check(bf, `${o.map((x) => x - 1).join(', ')}, ${o.join(', ')}`).correct, 'two candidate lists passed');
  // Debate: "not FALSE" is TRUE; hedges and padded citations are not right.
  const dp = gameById('debate').generate(4, 3);
  const side = dp.data.truth === 'T' ? 'TRUE' : 'FALSE';
  const other = side === 'TRUE' ? 'FALSE' : 'TRUE';
  assert.ok(gameById('debate').check(dp, `${side} (not ${other}): ${dp.data.best.join(', ')}`).correct);
  assert.ok(!gameById('debate').check(dp, `TRUE or FALSE: ${dp.data.best.join(', ')}`).correct, 'a hedged side passed');
  let padded = 0;
  for (const level of [1, 4, 7, 10])
    for (let seed = 0; seed < 20; seed++) {
      const p = gameById('debate').generate(level, seed);
      const d = DB.makeDebate(level, seed);
      const extra = d.pool.filter((f) => !p.data.best.includes(f.id)).slice(0, Math.max(1, d.k - p.data.best.length)).map((f) => f.id);
      if (gameById('debate').check(p, `${p.data.truth === 'T' ? 'TRUE' : 'FALSE'}: ${[...p.data.best, ...extra].join(', ')}`).correct) padded++;
    }
  assert.equal(padded, 0, 'citations padded past the fewest were marked right');
  // Bug hunt: remarks after the line, and "the fix is on line N, it should be …".
  const hp = gameById('bughunt').generate(4, 7);
  const fix = hp.data.good;
  const ln = hp.data.bug.line;
  for (const a of [`Line ${ln}: ${fix} (was wrong)`, `Line ${ln}: ${fix}  // fixed`, `The fix is on line ${ln}, it should be ${fix}.`]) assert.ok(gameById('bughunt').check(hp, a).correct, `bug hunt right answer failed: ${a}`);
  // Escape: other ways of saying a command.
  const ep = gameById('escape').generate(3, 2);
  assert.ok(gameById('escape').check(ep, ep.data.solution.map((c) => c.replace(/^take (.+)$/, 'take the $1 from the floor').replace(/^go out$/, 'leave through the exit')).join('\n')).correct);
});

test('bug hunt: an answer that only fits the shown tests (a lookup table, a rewritten line) fails; practice never meets a held-out program', () => {
  let cheats = 0;
  let tried = 0;
  for (const level of [1, 2, 4, 5, 7, 10])
    for (let seed = 0; seed < 20; seed++) {
      const p = BH.bughunt.generate(level, seed);
      const d = p.data;
      const params = TY.tokens(d.lines[0]).slice(3, -1).filter((x) => x !== ',');
      if (!d.tests.every((t) => t.args.every((a) => typeof a === 'number') && typeof t.want === 'number')) continue;
      tried++;
      const table = d.tests.map((t) => `(${t.args.map((a, i) => `${params[i]} == ${a}`).join(' and ')}) * ${t.want}`).join(' + ');
      for (const ln of [2, d.bug.line]) if (BH.bughunt.check(p, `Line ${ln}: return ${table}`).correct) cheats++;
    }
  assert.ok(tried > 20);
  assert.equal(cheats, 0, 'a lookup table of the shown tests passed');
  // Rewriting a line (more than a slip) is not a fix, even when it would pass.
  const p = BH.bughunt.generate(1, 4);
  assert.match(BH.bughunt.check(p, `Line ${p.data.bug.line}: ${p.data.good} + 0 * 0 * 0`).why, /slip/);
  assert.equal(BH.tokenEdits('s = s + i', 's = s - i'), 1);
  // Hidden tests exist, are not in the text, and the right fix passes them.
  assert.ok(p.data.hidden.length >= 5);
  for (const t of p.data.hidden) assert.ok(!p.data.tests.some((x) => JSON.stringify(x.args) === JSON.stringify(t.args)), 'a hidden test is one of the shown ones');
  assert.ok(BH.bughunt.check(p, `Line ${p.data.bug.line}: ${p.data.good}`).correct);
  // Practice programs are never held-out ones (the same text counts as the same).
  for (const level of [1, 5, 10]) {
    const held = new Set(BH.bench(level).map((g) => g.cs.b.lines.join('\n')));
    const r = C.rng(level);
    for (let k = 0; k < 300; k++) assert.ok(!held.has(BH.practiceProgram(level, r).lines.join('\n')), `L${level}: a practice program is a held-out one`);
  }
  // A list write needs a whole-number position, as a read does.
  assert.match(TY.run(TY.parse(['fn f(xs, k)', 'xs[k] = 1', 'return xs', 'end']), [[0, 0], 0.5]).error, /outside/);
});

test('escape rooms: a written problem shows every note, so its codes are known — no need to read them first', () => {
  let withCodes = 0;
  for (const level of [2, 3, 5, 7, 10])
    for (let seed = 0; seed < 20; seed++) {
      const p = ES.escape.generate(level, seed);
      assert.ok(!p.data.solution.some((c) => c.startsWith('read ')), 'the shortest way does not need to read a printed note');
      const m = ES.makeRoom(level, seed);
      if (m.items.some((it) => it.code)) withCodes++;
      assert.match(p.text, /already known to you/);
    }
  assert.ok(withCodes > 20, `${withCodes} problems with codes`);
});

test('fact book: moon counts say the year they were counted; WATCH keeps its indentation (pre-wrap)', async () => {
  assert.match(FA.factSentence('Uranus', 'moons', 28), /\(2024\)/);
  assert.match(FA.factSentence('Neptune', 'moons', 16), /\(2024\)/);
  assert.match(FA.factSentence('Jupiter', 'moons', 95), /\(2023\)/);
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(at('../../web/styles.css'), 'utf8');
  assert.match(css.match(/\.gymlines \{[^}]*\}/)[0], /white-space: pre-wrap/);
});

// ---- LOGIC SANDBOX -------------------------------------------------------------------------------------------
test('logic: the truth table and the SAT solver agree; claims are made true or false as asked', () => {
  let checked = 0;
  for (let level = 1; level <= 10; level++)
    for (let seed = 0; seed < 6; seed++)
      for (const want of [true, false]) {
        const c = LG.makeClaim(level, 900 + seed, want);
        assert.equal(LG.valid(c), want, `L${level}: ${LG.claimText(c)}`);
        const { at, list } = LG.clausesOf(c);
        if (at.names.length <= 16) {
          // Two independent ways: every assignment of the formulas themselves, and DPLL on the clauses.
          assert.equal(LG.counterBrute(c) === null, LG.sat(list.map((x) => x.lits), at.names.length) === null, `L${level}: ${LG.claimText(c)}`);
          checked++;
        }
        // A counterexample for a false claim really is one.
        if (!want) assert.ok(LG.counterexample(c), 'a false claim has a counterexample');
      }
  assert.ok(checked > 80, `${checked} claims cross-checked`);
  // The classics.
  const p = LG.atom('p');
  const q = LG.atom('q');
  assert.ok(LG.valid({ premises: [LG.imp(p, q), p], goal: q, world: [] }), 'modus ponens');
  assert.ok(!LG.valid({ premises: [LG.imp(p, q), q], goal: p, world: [] }), 'affirming the consequent is not valid');
  const red = (x) => LG.atom('Red', x);
  const big = (x) => LG.atom('Big', x);
  assert.ok(LG.valid({ premises: [LG.all('x', LG.imp(red('x'), big('x'))), red('a')], goal: big('a'), world: ['a', 'b'] }));
  assert.ok(!LG.valid({ premises: [LG.ex('x', red('x'))], goal: red('a'), world: ['a', 'b'] }), 'someone is red does not make a red');
  assert.ok(LG.valid({ premises: [LG.ex('x', red('x')), LG.not(red('a'))], goal: red('b'), world: ['a', 'b'] }), 'in a world of a and b only');
});

test('logic: his proofs are re-checked step by step; a false claim "proved" is a hard failure (mastery 0)', () => {
  const w = LG.REF;
  for (const level of [2, 5, 7]) {
    for (const { c, limit } of LG.bench(level).truths.slice(0, 6)) {
      const t = LG.prove(c, w, 10 * limit + 50);
      if (!t.proved) continue;
      const steps = LG.proofSteps(t);
      assert.ok(LG.verifyProof(c, steps), 'his proof checks out');
      // Tamper with one step: the check refuses it.
      const bad = steps.map((part) => part.map((s) => ({ ...s })));
      const last = bad[0].at(-1);
      last.res = [...last.a];
      assert.ok(!LG.verifyProof(c, bad), 'a tampered proof is refused');
    }
    // Resolution is sound: his prover never finds a proof of a false claim.
    for (const c of LG.bench(level).falses) assert.ok(!LG.prove(c, w, 5000).proved, `L${level}: proved a false claim`);
  }
  // A prover that claims a proof for every claim (borrowing one): offering a "proof" of a false claim is a hard failure.
  const level = 3;
  const real = LG.proofSteps(LG.prove(LG.bench(level).truths[0].c, w, 5000));
  const g = LG.grade(level, (c) => (LG.valid(c) ? LG.proofSteps(LG.prove(c, w, 5000)) : real));
  assert.ok(g.accepted > 0, 'the cheat was caught');
  assert.equal(g.mastery, 0, 'a false claim accepted is a hard failure, whatever else he proved');
  assert.ok(g.proved > 0);
});

test('logic: the stored claims are the ones the generator makes, and read back exactly', () => {
  for (let level = 1; level <= 10; level++) {
    const st = LOGIC_SETS[level - 1];
    assert.equal(st.t.length, 20);
    assert.equal(st.f.length, 8);
    for (const line of [...st.t.map((x) => x.slice(0, x.lastIndexOf('|'))), ...st.f]) assert.equal(LG.lineOf(LG.claimOf(line)), line, 'parse(show(f)) = f');
    const b = LG.bench(level);
    for (const { c } of b.truths) assert.ok(LG.valid(c), `L${level}: a stored "true" claim is false`);
    for (const c of b.falses) assert.ok(!LG.valid(c), `L${level}: a stored "false" claim is true`);
  }
  // Making them again gives the same (the slow top levels are left out to keep the test quick).
  for (const level of [1, 3, 5, 6, 7]) {
    const fresh = LG.bench(level, true);
    const b = LG.bench(level);
    assert.deepEqual(fresh.truths.map((g) => `${LG.lineOf(g.c)}|${g.limit}`), b.truths.map((g) => `${LG.lineOf(g.c)}|${g.limit}`), `L${level}`);
    assert.deepEqual(fresh.falses.map(LG.lineOf), b.falses.map(LG.lineOf));
  }
});

// ---- MINI-BRAIN LAB -------------------------------------------------------------------------------------------
test('mini-brain: a tiny network learns XOR; multiply-adds and energy; the stored baselines are what training gives', () => {
  const d = BR.dataset(1, 5);
  const lin = BR.trainNet({ layers: 0, width: 2, act: 'tanh', lr: 0.1 }, d, 40, 5);
  const net = BR.trainNet({ layers: 1, width: 8, act: 'tanh', lr: 0.1 }, d, 40, 5);
  assert.ok(net.accuracy(d.test) > 0.95, `XOR with a hidden layer: ${net.accuracy(d.test)}`);
  assert.ok(lin.accuracy(d.test) < 0.7, `XOR without one cannot be learned: ${lin.accuracy(d.test)}`);
  assert.equal(BR.macs({ layers: 2, width: 8, act: 'relu', lr: 0.1 }, 2, 3), 2 * 8 + 8 * 8 + 8 * 3);
  assert.equal(BR.energy({ layers: 1, width: 4, act: 'tanh', lr: 0.1 }, d.train, 10), 3 * (2 * 4 + 4 * 2) * 120 * 10);
  // Held-out data is new data: none of its test points are in the learning split.
  const seen = new Set(d.train.x.map((x) => x.join()));
  assert.ok(d.test.x.every((x) => !seen.has(x.join())));
  for (let level = 1; level <= 10; level++) assert.deepEqual(BR.baseline(level), BR.baseline(level, true), `L${level} stored baseline`);
  // The energy levels can be passed only by a smaller network than the baseline.
  for (const level of [7, 8, 9, 10]) {
    const sp = BR.specFor(level);
    assert.ok(sp.energy);
    assert.equal(BR.grade(level, sp.base).within, false, 'the baseline itself is over the budget');
  }
  // The problems: counting and working a network through, checked exactly.
  const p = BR.brain.generate(5, 1);
  assert.match(p.text, /ReLU/);
  assert.ok(BR.brain.check(p, `Answer: ${p.data.answer.join(', ')}`).correct);
  const pc = BR.brain.generate(2, 1);
  assert.ok(BR.brain.check(pc, `It has ${pc.data.answer} numbers in all.`).correct);
  assert.ok(!BR.brain.check(pc, `It has ${pc.data.answer - 1} numbers in all.`).correct);
});

// ---- BUG HUNT --------------------------------------------------------------------------------------------------
test('bug hunt: the tiny language runs (no eval) — loops, lists, errors and a step limit', () => {
  const run = (src, ...args) => TY.run(TY.parse(src.trim().split('\n')), args);
  assert.equal(run('fn f(n)\ns = 0\nfor i = 1 to n do\ns = s + i\nend\nreturn s\nend', 4).value, 10);
  assert.deepEqual(run('fn f(xs)\nxs[0] = 9\nreturn xs\nend', [1, 2]).value, [9, 2]);
  assert.equal(run('fn f(a, b)\nreturn a / b + a % b\nend', 7, 2).value, 4, '/ rounds down, % is the remainder');
  assert.equal(run('fn f(a)\nif a > 2 and not a == 5 then\nreturn 1\nelse\nreturn 0\nend\nend', 3).value, 1);
  assert.match(run('fn f(n)\nwhile 1 do\nn = n + 1\nend\nreturn n\nend', 1).error, /too long/);
  assert.match(run('fn f(xs)\nreturn xs[3]\nend', [1]).error, /outside/);
  assert.match(run('fn f(a)\nreturn a / 0\nend', 1).error, /division by zero/);
  assert.throws(() => TY.parse(['fn f(a)', 'return (a', 'end']), /bracket/);
  assert.throws(() => TY.parse(['fn f(a)', 'if a then', 'return 1', 'end']), /end/);
  // Every program is right as written: its own tests pass; each made bug fails one, and a one-word change undoes it.
  for (const t of BH.TEMPLATES) {
    const lines = t.src.map((l) => TY.fmt(TY.tokens(l.replace(/\{(\w+)\}/g, (_, k) => t.vars[k][0]))));
    TY.parse(lines);
  }
  for (let level = 1; level <= 10; level++)
    for (let seed = 0; seed < 4; seed++) {
      const b = BH.makeBuggy(level, 300 + seed);
      assert.ok(BH.runTests(b.good, b.tests).pass.every(Boolean), `${b.t.name}: the correct program fails its tests`);
      assert.ok(!BH.runTests(b.lines, b.tests).pass.every(Boolean), `${b.t.name}: the bug is not caught`);
      const cs = BH.prepare(b);
      assert.ok(cs.cands.some((_, i) => BH.fixes(cs, i)), `${b.t.name}: no candidate fixes it`);
    }
});

test('bug hunt: check() runs the fixed program — any fix that passes every test counts; the stored test programs are the generator\'s', () => {
  const p = BH.bughunt.generate(4, 7);
  // The line fixed with extra spaces and quotes still counts.
  assert.ok(BH.bughunt.check(p, `Line ${p.data.bug.line}: "${p.data.good.replace(/ /g, '  ')}"`).correct);
  // A wrong line number does not.
  const other = p.data.bug.line === 2 ? 3 : 2;
  assert.ok(!BH.bughunt.check(p, `Line ${other}: ${p.data.lines[other - 1]}`).correct);
  assert.ok(!BH.bughunt.check(p, 'Line 1: fn x(y)').correct, 'the header is not a fix');
  for (let level = 1; level <= 10; level++) {
    const st = BUG_SETS[level - 1];
    assert.equal(st.length, 20);
    assert.deepEqual(JSON.parse(JSON.stringify(BH.bench(level, true).map(BH.storeBug))), st, `L${level} stored programs`);
    // And a stored one is rebuilt exactly as the generator made it.
    const b = BH.makeBuggy(level, st[0].s);
    assert.deepEqual(BH.rebuild(st[0]).lines, b.lines);
  }
});

// ---- TEXT ESCAPE ROOMS -------------------------------------------------------------------------------------------
test('escape rooms: the rules, and breadth-first search finds the shortest way out (leaving out useless commands changes nothing)', () => {
  const m = ES.makeRoom(3, 11);
  const s0 = ES.startState(m);
  const exit = m.things.findIndex((t) => t.name === 'exit');
  assert.equal(s0.st[exit], 0, 'the exit starts locked');
  assert.match(ES.act(m, s0, 'go out').said, /locked/);
  assert.match(ES.act(m, s0, 'dance').said, /understand/);
  for (let level = 1; level <= 6; level++)
    for (let seed = 0; seed < 3; seed++) {
      const r = ES.makeRoom(level, 400 + seed);
      const best = ES.shortest(r);
      assert.ok(best, 'every room can be escaped');
      // The shortest way really gets out,
      let s = ES.startState(r);
      for (const c of best) s = ES.act(r, s, c).s;
      assert.ok(s.out, `L${level}: the shortest way does not get out`);
      // and searching every command, useless ones too, finds nothing shorter.
      if (level <= 4) assert.equal(ES.shortest(r, true).length, best.length, `L${level}: pruning changed the answer`);
      // Its last command is going out, and the start does not show what is inside closed things.
      assert.equal(best.at(-1), 'go out');
    }
  // A player sees only what is in the room and what is open.
  const room = ES.makeRoom(5, 3);
  const hidden = room.items.filter((it) => it.in != null).map((it) => it.name);
  const view = ES.look(room, ES.startState(room));
  for (const h of hidden) assert.ok(!view.includes(`a ${h},`) && !view.endsWith(`a ${h}.`), `${h} is visible before its box is open: ${view}`);
});

// ---- FACT-CHECK DUEL ------------------------------------------------------------------------------------------------
test('fact book: numbered facts, no ties where "the most" is asked, and a three-valued judge', () => {
  const ids = FA.FACTS.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const [kind, fields] of Object.entries(FA.NUMERIC))
    for (const field of fields) {
      const vals = FA.ENTITIES.filter((e) => e.kind === kind && e.f[field] != null).map((e) => e.f[field]);
      if (field !== 'moons') assert.equal(new Set(vals).size, vals.length, `${kind} ${field} has a tie`);
    }
  const T = (s) => FA.evaluate(s, FA.BOOK);
  assert.equal(T({ k: 'eq', a: { name: 'France' }, field: 'capital', v: 'Paris' }), 'T');
  assert.equal(T({ k: 'eq', a: { name: 'France' }, field: 'capital', v: 'Lisbon' }), 'F');
  assert.equal(T({ k: 'eq', a: { name: 'Portugal' }, field: 'capital', v: 'Lisbon' }), 'U', 'not in the book: cannot tell');
  assert.equal(T({ k: 'cmp', a: { name: 'Brazil' }, b: { name: 'Japan' }, field: 'population' }), 'T');
  assert.equal(T({ k: 'cmp', a: { name: 'the Amazon' }, b: { name: 'the Nile' }, field: 'length' }), 'U', 'the Amazon’s length is not recorded');
  assert.equal(T({ k: 'gt', a: { kind: 'country', by: 'capital', v: 'Ottawa' }, field: 'population', n: 30 }), 'T', 'two steps: Ottawa → Canada → 39 million');
  assert.equal(T({ k: 'super', a: { name: 'Jupiter' }, field: 'diameter', kind: 'planet', group: null }), 'T');
  assert.equal(T({ k: 'super', a: { name: 'India' }, field: 'area', kind: 'country', group: 'Asia' }), 'F', 'China is larger — settled even with Indonesia unrecorded');
  assert.equal(T({ k: 'super', a: { name: 'China' }, field: 'area', kind: 'country', group: 'Asia' }), 'U', 'Indonesia’s area is not recorded');
  assert.equal(T({ k: 'flows', a: { name: 'the Danube' }, b: { name: 'Italy' } }), 'F');
  assert.equal(T({ k: 'flows', a: { name: 'the Danube' }, b: { name: 'Sweden' } }), 'U');
  // Made claims have the truth asked for, and the support settles them alone.
  for (let level = 1; level <= 10; level++)
    for (const want of FA.truthsFor(level))
      for (let seed = 0; seed < 5; seed++) {
        const s = FA.makeSpec(level, 600 + seed, want);
        assert.equal(T(s), want, FA.claimSentence(s));
        if (want !== 'U') assert.equal(FA.evaluate(s, FA.knowOnly(FA.support(s))), want, `the support settles: ${FA.claimSentence(s)}`);
      }
});

// ---- DEBATE ARENA -----------------------------------------------------------------------------------------------------
test('debate: the judge checks every citation and the logic; the true side wins when both argue their best; the false side never wins', () => {
  for (const level of [1, 5, 8, 10]) {
    for (const d of DB.bench(level)) {
      const lie = d.truth === 'T' ? 'F' : 'T';
      // Ground truth: reference against reference, the true side wins.
      assert.equal(DB.winner(d, DB.reference(d, 'T'), DB.reference(d, 'F')), d.truth, FA.claimSentence(d.s));
      // Whatever the false side cites — everything on the table (over the limit), any k of it, made-up ids — it loses.
      assert.ok(!DB.judge(d, lie, d.pool.map((f) => f.id)).ok);
      const r = C.rng(d.pool.length);
      for (let k = 0; k < 40; k++) {
        const pick = C.shuffle(r, d.pool.slice()).slice(0, d.k).map((f) => f.id);
        assert.ok(!DB.judge(d, lie, pick).ok, 'the false side won with real facts');
      }
      assert.match(DB.judge(d, d.truth, ['F99999']).why, /not a fact/);
      const off = FA.FACTS.find((f) => !d.pool.some((x) => x.id === f.id));
      assert.match(DB.judge(d, d.truth, [off.id]).why, /not one of the facts on the table/);
    }
  }
  // Grading: an arguer who could make the false side win would be a hard failure; nobody can.
  const g = DB.grade(4, (d, side) => (side === d.truth ? DB.reference(d, side) : d.pool.slice(0, d.k).map((f) => f.id)));
  assert.equal(g.falseWins, 0);
  assert.equal(g.wins, g.of, 'the reference arguer wins every debate from the true side');
});

// ---- learning: each game climbs the whole ladder, and no level is handed out by the one before -------------------
test('gym part 2: every level needs something new — trained to pass level L−1, he is still below the bar at level L; he climbs all ten', (t) => {
  const plan = { logic: [20, 400000], brain: [10, 6000], bughunt: [5, 6000], escape: [50, 400000], factcheck: [50, 200000], debate: [50, 3000000] };
  const table = [];
  for (const id of NEW) {
    const [step, cap] = plan[id];
    const g = gameById(id);
    const s = new S.Session(g);
    const t0 = performance.now();
    const starts = [];
    while (!s.rec.mastered && s.rec.units < cap) {
      s.train(step);
      const lv = s.rec.level;
      const ev = s.measure();
      if (ev === 'level') {
        // What he carried from Level lv, measured on Level lv + 1 before any training there.
        starts.push(`L${lv + 1} ${Math.round(s.rec.start * 100)}%`);
        assert.ok(s.rec.start < g.bar(lv + 1), `${id}: trained to pass Level ${lv}, he already passes Level ${lv + 1} (${s.rec.start} ≥ ${g.bar(lv + 1)})`);
      }
    }
    assert.ok(s.rec.mastered, `${id}: stopped at Level ${s.rec.level} (${s.rec.mastery}) after ${s.rec.units} ${g.unit}: ${s.rec.detail}`);
    table.push(`${id}: mastered after ${s.rec.units} ${g.unit} in ${((performance.now() - t0) / 1000).toFixed(1)} s; starts ${starts.join(', ')}`);
  }
  t.diagnostic(table.join(' | '));
});

test('gym part 2: nothing slow on the worker (cold) — a new learner and its measurement, a training slice, WATCH, a problem', () => {
  const slow = [];
  const time = (what, fn) => {
    const t = performance.now();
    fn();
    const ms = performance.now() - t;
    if (ms > 200) slow.push(`${what}: ${Math.round(ms)} ms`);
  };
  for (const id of NEW) {
    const g = gameById(id);
    for (let level = 1; level <= 10; level++) {
      let l;
      time(`${id} L${level} new learner + measure`, () => (l = g.learner(level, 2)).measure());
      time(`${id} L${level} train(1)`, () => l.train(1));
      for (let seed = 0; seed < 12; seed++) {
        time(`${id} L${level} watch(${seed * 977})`, () => l.watch(seed * 977));
        time(`${id} L${level} generate(${seed * 131})`, () => g.generate(level, seed * 131));
      }
    }
  }
  assert.deepEqual(slow, [], `over 200 ms: ${slow.join('; ')}`);
});

test('gym part 2: WATCH shows his reasoning as readable text, through the worker', () => {
  const out = [];
  for (const id of NEW) {
    W.gymMessage({ gym: 'watch', id, req: 1, seed: 12 }, (m) => out.push(m));
    const m = out.at(-1);
    assert.equal(m.gym, 'reply');
    assert.ok(!m.error, `${id}: ${m.error}`);
    assert.ok(m.frames.length >= 2, `${id}: ${m.frames.length} frames`);
    const words = m.frames.flatMap((f) => [...(f.lines ?? []), f.caption]).join('\n');
    assert.ok(words.length > 120, `${id}: too little text`);
    assert.ok(!/undefined|NaN|\[object/.test(words), `${id}: ${words}`);
    W.gymMessage({ gym: 'view', id, req: 2 }, (x) => out.push(x));
    assert.ok(out.at(-1).view?.caption, `${id}: no picture of what he knows`);
  }
});
