// THINK HARDER and the offline brain's REPORT CARD (apps/web/src/offline/think.ts, exact.ts, bench.ts and
// gym/bench.ts), driven by a fake model that answers deterministically: the answer is read and put in one
// form; several attempts vote, an exact check overrides the vote and stops the search at once, and a check
// that fails them all is said plainly; the tree search grows reasoning steps under the path that scores
// best; with no check the model is asked to check its leading answers; the time, attempt and token
// budgets hold (a reply still being written is cut off at the deadline); STOP keeps the best so far; the
// page gets a turn between model calls. The report card's fixed questions, scorers, verdict and history.
// (Run from offline-brain.test.mjs, which is in the test list; package.json is protected.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({
  entryPoints: [at('../../web/src/offline/think.ts'), at('../../web/src/offline/exact.ts'), at('../../web/src/offline/bench.ts'), at('../../web/src/gym/bench.ts'), at('../../web/src/gym/index.ts')],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outdir: at('./.build/think'),
  outExtension: { '.js': '.mjs' },
  entryNames: '[dir]/[name]',
  outbase: at('../../web/src'),
  logLevel: 'warning',
});
const T = await import('./.build/think/offline/think.mjs');
const X = await import('./.build/think/offline/exact.mjs');
const BN = await import('./.build/think/offline/bench.mjs');
const GB = await import('./.build/think/gym/bench.mjs');
const { gameById } = await import('./.build/think/gym/index.mjs');

/** A fake model: `answer(messages, call)` gives each reply; every call is recorded. */
function fake(answer, { delay = 0 } = {}) {
  const calls = [];
  const gen = async (messages, opts) => {
    calls.push({ messages, opts });
    if (delay) await new Promise((r, j) => {
      const t = setTimeout(r, delay);
      opts.signal.addEventListener('abort', () => (clearTimeout(t), j(Object.assign(new Error('stopped'), { name: 'AbortError' }))), { once: true });
    });
    return answer(messages, calls.length - 1, opts);
  };
  return { gen, calls };
}
const user = (m) => m.at(-1).content;
const isStep = (m) => /Write only the next step/.test(user(m));
const isRollout = (m) => /Continue from these steps/.test(user(m));
const isVerify = (m) => /Proposed answer:/.test(user(m));

// ---------------------------------------------------------------------------------------------------------
test('think harder: the answer is read from a reply and put in one form, so the same answer counts once', () => {
  assert.equal(X.answerOf('Step 1: 17 × 20 = 340\nStep 2: 17 × 3 = 51\nANSWER: 391'), '391');
  assert.equal(X.answerOf('**Final answer:** Tokyo.'), 'Tokyo.');
  assert.equal(X.answerOf('<think>\nhmm\n</think>\nIt is Paris.\n'), 'It is Paris.');
  assert.equal(X.normAnswer('It is 391.'), '391');
  assert.equal(X.normAnswer('1,250'), '1250');
  assert.equal(X.normAnswer('4.0'), '4');
  assert.equal(X.normAnswer('**Tokyo**.'), 'tokyo');
  assert.equal(X.normAnswer('The answer is Tokyo'), 'tokyo');
  assert.equal(X.normAnswer('Yes.'), 'yes');
  assert.equal(X.normAnswer('TRUE'), 'yes');
  assert.equal(X.normAnswer('(3 + 5) × 3'), '(3 + 5) × 3', 'an expression stays an expression');
  assert.notEqual(X.normAnswer('B2'), '2');
});

test('think harder: the calculator works sums out (never eval) and checks an answer against them', () => {
  assert.equal(X.calc('17 × 23'), 391);
  assert.equal(X.calc('(18 + 7) * 4'), 100);
  assert.equal(X.calc('144 ÷ 12 + 7'), 19);
  assert.equal(X.calc('2^10'), 1024);
  assert.equal(X.calc('15% of 80'), 12);
  assert.equal(X.calc('903 − 476'), 427);
  assert.equal(X.calc('1/0'), null);
  assert.equal(X.calc('42'), null, 'a number alone is not a sum');
  assert.equal(X.calc('alert(1)'), null);
  assert.equal(X.calc('process.exit()'), null);
  assert.deepEqual(X.sumIn('What is 17 × 23?'), { expr: '17 × 23', value: 391 });
  assert.equal(X.sumIn('work out (18+7)*4')?.value, 100);
  assert.equal(X.sumIn('what is 17 times 23')?.value, 391);
  assert.equal(X.sumIn('What is the capital of France?'), null);
  assert.equal(X.sumIn('I have 3 cats'), null);
  assert.equal(X.sameNumber('17 × 23 = 391', 391), true);
  assert.equal(X.sameNumber('about 1,000', 1000), true);
  assert.equal(X.sameNumber('0.3', 1 / 3), false);
  assert.equal(X.sameNumber('0.33', 1 / 3), true, 'to the cent');
  assert.equal(X.sameNumber('0.33', 0.33), true);
  assert.equal(X.sameNumber('no idea', 4), false);
});

test("think harder: a coding question's examples become tests for the sandbox", () => {
  const q = 'Write a JavaScript function add(a, b). add(2, 3) → 5 and add(-1, 1) should return 0.';
  assert.equal(X.asksForCode(q), true);
  assert.deepEqual(X.codeTests(q), { entry: 'add', tests: [{ args: [2, 3], expect: 5 }, { args: [-1, 1], expect: 0 }] });
  assert.equal(X.codeTests('Write a function that adds two numbers.'), null, 'no examples, no tests');
  assert.deepEqual(X.codeTests('Write rev(s). rev("ab") returns "ba"').tests, [{ args: ['ab'], expect: 'ba' }]);
  const reply = 'Here:\n```js\nfunction add(a, b) {\n  return a + b;\n}\n```\nANSWER: done';
  assert.equal(X.codeOf(reply), 'function add(a, b) {\n  return a + b;\n}');
  assert.equal(X.entryOf('const twice = (x) => x * 2;'), 'twice');
  assert.equal(X.entryOf(X.codeOf(reply)), 'add');
  assert.equal(X.asksForCode('What is the capital of Peru?'), false);
});

test('think harder: "think harder" in a message — alone (the last question) or with the question', () => {
  assert.equal(T.thinkAsk('think harder'), '');
  assert.equal(T.thinkAsk('Think harder!'), '');
  assert.equal(T.thinkAsk('think harder: what is 17 × 23?'), 'what is 17 × 23?');
  assert.equal(T.thinkAsk('please think harder about this: is 91 prime?'), 'is 91 prime?');
  assert.equal(T.thinkAsk('is 91 prime? think harder'), 'is 91 prime?');
  assert.equal(T.thinkAsk('try harder'), '');
  assert.equal(T.thinkAsk('what should I think about today'), null);
  assert.equal(T.thinkAsk('I think hardware is fun'), null);
});

test('think harder: attempts come at different temperatures and prompts; the majority wins and the search stops early once enough agree', async () => {
  const answers = ['12', '14', '12', '12', '12', '12'];
  const { gen, calls } = fake((m, i) => `working…\nANSWER: ${answers[i]}`);
  const lines = [];
  const r = await T.thinkHarder('How many eggs in a dozen?', { gen, steps: false, budget: { attempts: 6, agree: 3 }, onProgress: (p) => lines.push(p.line) });
  assert.equal(r.answer, '12');
  assert.equal(r.confidence, 'agree');
  assert.equal(r.agree, 3);
  assert.equal(r.attempts.length, 4, 'stopped after the fourth: three agree and the other answer has one');
  assert.equal(r.stoppedEarly, true);
  assert.match(r.line, /^3 of 4 attempts agree/);
  // Different ways in and temperatures.
  assert.equal(new Set(calls.map((c) => c.messages[0].content)).size, 4);
  assert.ok(new Set(calls.map((c) => c.opts.temperature)).size >= 3);
  assert.ok(calls.every((c) => /ANSWER: <the answer only>/.test(c.messages[0].content)));
  // Live progress in plain words.
  assert.ok(lines.some((l) => /^trying 6 approaches… 3 done · 2 agree$/.test(l)), lines.join(' | '));
  assert.equal(lines.at(-1), r.line);
});

test('think harder: an exact check beats the vote and stops at once; one that fails them all is said plainly', async () => {
  const checker = { label: 'a calculator', kind: 'key', check: (_t, a) => ({ correct: X.sameNumber(a, 391), score: X.sameNumber(a, 391) ? 1 : 0, why: '' }) };
  const answers = ['381', '381', '391', '381'];
  const { gen, calls } = fake((m, i) => `ANSWER: ${answers[i]}`);
  const r = await T.thinkHarder('What is 17 × 23?', { gen, checker, steps: false, budget: { attempts: 6 } });
  assert.equal(r.answer, '391', 'the checked answer, though two attempts said 381');
  assert.equal(r.confidence, 'checked');
  assert.equal(calls.length, 3, 'no more attempts after one passed');
  assert.match(r.line, /^checked exactly \(a calculator\) · 1 of 3 attempts passed$/);
  assert.equal(r.checkedBy, 'a calculator');

  const wrong = fake(() => 'ANSWER: 381');
  const w = await T.thinkHarder('What is 17 × 23?', { gen: wrong.gen, checker, steps: false, budget: { attempts: 4, agree: 2 } });
  assert.equal(w.confidence, 'failed-check');
  assert.equal(w.attempts.length, 4, 'agreement on an answer the check rejects is no reason to stop');
  assert.match(w.line, /^none of 4 attempts passed the check \(a calculator\): best guess, don't trust it$/);
  assert.ok(!wrong.calls.some((c) => isVerify(c.messages)), 'no YES/NO round when an exact check judged them');
});

test('think harder: on a problem that goes in steps, a tree search grows steps under the path that scores best', async () => {
  // Root steps alternate "use A" / "use B"; any path through A ends at 7 (scores 0.6 on the check), B at 9 (0).
  let root = 0;
  const { gen, calls } = fake((m) => {
    if (isStep(m)) return /Steps so far/.test(user(m)) ? 'carry on with the same idea' : (root++ % 2 ? 'use B' : 'use A');
    if (isRollout(m)) return /use A/.test(user(m)) ? 'so ANSWER: 7' : 'so ANSWER: 9';
    return 'ANSWER: 5';
  });
  const checker = { label: "the gym's rules", kind: 'verifier', check: (text) => ({ correct: false, score: /ANSWER: 7/.test(text) ? 0.6 : 0, why: '' }) };
  const r = await T.thinkHarder('Reach 10 from the numbers 3, 8, 6.', { gen, checker, steps: true, budget: { attempts: 12, tokens: 99999, ms: 10000 } });
  const tree = r.attempts.filter((a) => a.how === 'tree');
  assert.equal(r.attempts.length, 12);
  assert.equal(tree.length, 9, 'three ways in, then the tree');
  const deeper = calls.filter((c) => isStep(c.messages) && /Steps so far/.test(user(c.messages)));
  const underA = deeper.filter((c) => /1\. use A/.test(user(c.messages))).length;
  const underB = deeper.filter((c) => /1\. use B/.test(user(c.messages))).length;
  assert.ok(underA > underB, `the search should grow the better path: A ${underA}, B ${underB}`);
  // Each step request carries the steps so far, numbered; each path is finished off and scored.
  assert.ok(deeper.every((c) => /Steps so far:\n1\. use [AB]/.test(user(c.messages))));
  assert.ok(calls.some((c) => isRollout(c.messages)));
  assert.equal(r.confidence, 'failed-check');
  assert.equal(r.answer, '7', 'the closest to passing');
});

test('think harder: a step that already gives the answer ends its path without a rollout, and the tree search stops when an attempt passes', async () => {
  const { gen, calls } = fake((m) => (isStep(m) ? 'ANSWER: 24' : 'ANSWER: 23'));
  const checker = { label: "the gym's rules", kind: 'verifier', check: (text) => ({ correct: /ANSWER: 24/.test(text), score: /ANSWER: 24/.test(text) ? 1 : 0, why: '' }) };
  const r = await T.thinkHarder('Reach 24 from 5, 5, 9, 8', { gen, checker, steps: true, budget: { attempts: 8 } });
  assert.equal(r.confidence, 'checked');
  assert.equal(r.answer, '24');
  assert.equal(r.attempts.at(-1).how, 'tree');
  assert.equal(calls.filter((c) => isRollout(c.messages)).length, 0);
  assert.equal(r.attempts.length, 4);
});

test('think harder: with no exact check and no clear winner, the model is asked to check the leading answers (YES/NO)', async () => {
  const answers = ['Lyon', 'Paris'];
  const { gen, calls } = fake((m, i) => {
    if (isVerify(m)) return /Proposed answer: Paris/.test(user(m)) ? 'YES' : 'NO';
    return `ANSWER: ${answers[i] ?? 'Lyon'}`;
  });
  const r = await T.thinkHarder('What is the capital of France?', { gen, steps: false, budget: { attempts: 2 } });
  assert.equal(calls.filter((c) => isVerify(c.messages)).length, 2);
  assert.equal(r.answer, 'Paris', 'a tie broken by the YES');
  assert.match(r.line, /^1 of 2 attempts agree: no clear winner · it checked the answer and says yes$/);
  assert.equal(r.confidence, 'split');
  const v = calls.find((c) => isVerify(c.messages));
  assert.ok(v.opts.max <= 8, 'a one-word reply');
  assert.ok(v.opts.temperature <= 0.2);
});

test('think harder: the time budget holds, and a reply still being written is cut off at the deadline', async () => {
  const slow = fake(() => 'ANSWER: 1', { delay: 60 });
  const t0 = Date.now();
  const r = await T.thinkHarder('What is 2+2?', { gen: slow.gen, steps: false, budget: { ms: 150, attempts: 6 } });
  const took = Date.now() - t0;
  assert.ok(took < 400, `took ${took} ms`);
  assert.equal(r.outOfTime, true);
  assert.ok(r.attempts.length >= 1 && r.attempts.length <= 3, `${r.attempts.length} attempts`);
  assert.match(r.line, /\(out of time\)$/);
  // A model that would write for ever: the deadline stops it.
  const stuck = fake(() => 'never', { delay: 1e9 });
  const t1 = Date.now();
  const s = await T.thinkHarder('Is 91 prime?', { gen: stuck.gen, steps: false, budget: { ms: 100 } });
  assert.ok(Date.now() - t1 < 300);
  assert.equal(s.attempts.length, 0);
  assert.equal(s.confidence, 'none');
  assert.equal(stuck.calls[0].opts.signal.aborted, true);
});

test('think harder: the attempt and token budgets hold, and each call is asked for no more than is left', async () => {
  const long = fake(() => `${'word '.repeat(200)}\nANSWER: 3`);
  const r = await T.thinkHarder('Pick a number', { gen: long.gen, steps: false, budget: { tokens: 500, answerTokens: 260, attempts: 6 } });
  assert.ok(r.tokens <= 500, `${r.tokens} tokens`);
  assert.ok(long.calls.length <= 2, `${long.calls.length} calls`);
  assert.ok(long.calls.every((c) => c.opts.max <= 260));
  assert.ok(long.calls.at(-1).opts.max <= 500 - 260);
  const few = fake((m, i) => `ANSWER: ${i}`);
  const f = await T.thinkHarder('Pick a number', { gen: few.gen, steps: false, budget: { attempts: 3 } });
  assert.equal(f.attempts.length, 3);
});

test('think harder: STOP keeps the best answer so far; STOP before any answer is a stop', async () => {
  const ctl = new AbortController();
  const { gen } = fake((m, i) => {
    if (i === 1) ctl.abort();
    return 'ANSWER: 42';
  });
  const r = await T.thinkHarder('What is six times seven?', { gen, steps: false, signal: ctl.signal, budget: { attempts: 6 } });
  assert.equal(r.stopped, true);
  assert.equal(r.answer, '42');
  assert.ok(r.attempts.length <= 2);
  assert.match(r.line, /\(stopped early by you: best so far\)$/);
  const early = new AbortController();
  early.abort();
  await assert.rejects(T.thinkHarder('anything', { gen, signal: early.signal }), (e) => e.name === 'AbortError');
});

test('think harder: the page gets a turn between model calls (it never freezes)', async () => {
  let ticks = 0;
  const iv = setInterval(() => ticks++, 0);
  const { gen } = fake((m, i) => `ANSWER: ${i}`);
  await T.thinkHarder('Pick a number', { gen, steps: false, budget: { attempts: 6 } });
  clearInterval(iv);
  assert.ok(ticks >= 3, `only ${ticks} timer turns ran during six instant attempts`);
});

test('think harder: which questions go in steps', () => {
  assert.equal(T.stepStructured('What is 12 + 7 × 3?'), true);
  assert.equal(T.stepStructured('Sam has 12 apples and gives 3 to each of 2 friends. How many are left?'), true);
  assert.equal(T.stepStructured('Decide whether the conclusion follows from the premises'), true);
  assert.equal(T.stepStructured('What is the capital of Japan?'), false);
  assert.equal(T.stepStructured('Tell me a joke'), false);
});

// ---- the gym's part -------------------------------------------------------------------------------------------

/** A right Countdown expression by brute force (two or three numbers, + − × ÷, whole steps). */
function solveSmall(nums, target, exact) {
  const ops = [['+', (a, b) => a + b], ['−', (a, b) => (a > b ? a - b : NaN)], ['×', (a, b) => a * b], ['÷', (a, b) => (b > 1 && a % b === 0 ? a / b : NaN)]];
  const go = (items) => {
    for (const it of items) if (it.v === target && (!exact || it.n === nums.length)) return it.e;
    for (let i = 0; i < items.length; i++)
      for (let j = 0; j < items.length; j++) {
        if (i === j) continue;
        for (const [s, f] of ops) {
          const v = f(items[i].v, items[j].v);
          if (!Number.isInteger(v) || v <= 0) continue;
          const rest = items.filter((_, k) => k !== i && k !== j);
          const got = go([...rest, { v, e: `(${items[i].e} ${s} ${items[j].e})`, n: items[i].n + items[j].n }]);
          if (got) return got;
        }
      }
    return null;
  };
  return go(nums.map((v) => ({ v, e: String(v), n: 1 })));
}

test("report card: the gym's questions are fixed (same seeds, same words) and judged by the gym's own check", () => {
  const a = GB.benchItems();
  const b = GB.benchItems();
  assert.deepEqual(a, b);
  assert.deepEqual(a.map((x) => x.id), ['countdown-1-1', 'countdown-1-2', 'logic-1-1', 'sudoku-1-1', 'fact-Japan-capital', 'fact-Silver-symbol', 'fact-Mars-moons', 'fact-Peru-continent']);
  assert.ok(a.filter((x) => x.cat === 'logic').every((x) => x.steps));
  assert.deepEqual(a.filter((x) => x.check === 'verifier').map((x) => x.id), ['countdown-1-1', 'countdown-1-2'], 'only checks that work the answer out may steer THINK HARDER');
  for (const id of ['countdown-1-1', 'countdown-1-2']) {
    const [, level, seed] = id.split('-').map(Number);
    const p = gameById('countdown').generate(level, seed).data;
    const expr = solveSmall(p.nums, p.target, p.exact);
    assert.ok(expr, `no solution found for ${id}`);
    assert.equal(GB.judgeItem(id, `Working…\nANSWER: ${expr}`).correct, true, `${id}: ${expr}`);
    assert.equal(GB.judgeItem(id, 'ANSWER: 1 + 1').correct, false);
  }
  // VALID/INVALID: exactly one is right.
  const v = [GB.judgeItem('logic-1-1', 'ANSWER: VALID').correct, GB.judgeItem('logic-1-1', 'ANSWER: INVALID').correct];
  assert.equal(v.filter(Boolean).length, 1);
  assert.equal(GB.judgeItem('logic-1-1', 'ANSWER: VALID or INVALID').correct, false, 'a hedge is no answer');
  const g = gameById('sudoku').generate(1, 1).data;
  const grid = g.people.map((nm, i) => `${nm}: ${g.answer[i].join(', ')}`).join('\n');
  assert.equal(GB.judgeItem('sudoku-1-1', `Let me see.\nANSWER:\n${grid}`).correct, true);
  assert.equal(GB.judgeItem('fact-Japan-capital', 'The capital of Japan is Tokyo.').correct, true);
  assert.equal(GB.judgeItem('fact-Japan-capital', 'ANSWER: Kyoto').correct, false);
  assert.equal(GB.judgeItem('fact-Silver-symbol', 'ANSWER: Ag').correct, true);
  assert.equal(GB.judgeItem('fact-Silver-symbol', 'ANSWER: Au').correct, false);
  assert.equal(GB.judgeItem('fact-Mars-moons', 'Mars has 2 moons, Phobos and Deimos.').correct, true);
  assert.equal(GB.judgeItem('fact-Mars-moons', 'Mars has 2 moons; Jupiter has 95.').correct, false, 'the last number is the answer');
  assert.equal(GB.judgeItem('fact-Mars-moons', 'ANSWER: 2').correct, true);
  assert.equal(GB.judgeItem('fact-Peru-continent', 'ANSWER: South America').correct, true);
  assert.equal(GB.judgeItem('fact-Peru-continent', 'ANSWER: America').correct, false);
  assert.equal(GB.judgeItem('nope', 'x'), null);
});

test('think harder in the chat: the gym checks a Countdown sum it works out, and the fact book answers what it records', () => {
  assert.deepEqual(GB.sumPuzzle('Reach 24 from 5, 5, 9, 8 using every number exactly once'), { target: 24, nums: [5, 5, 9, 8], exact: true });
  assert.deepEqual(GB.sumPuzzle('can you make 10 using 3 8 and 6?'), { target: 10, nums: [3, 8, 6], exact: false });
  const q = 'Reach 24 from 5, 5, 9, 8 using every number exactly once';
  assert.deepEqual(GB.gymCheckable(q), { label: "the gym's Countdown rules", kind: 'verifier' });
  assert.equal(GB.gymCheck(q, 'ANSWER: (9 - 5) × (8 - 5)').verdict.correct, false, '4 × 3 = 12');
  assert.equal(GB.gymCheck(q, `ANSWER: ${solveSmall([5, 5, 9, 8], 24, true)}`).verdict.correct, true);
  assert.deepEqual(GB.factQuestion('What is the capital of Japan?'), { ent: 'Japan', field: 'capital', v: 'Tokyo' });
  assert.deepEqual(GB.factQuestion('how many moons does mars have'), { ent: 'Mars', field: 'moons', v: 2 });
  assert.equal(GB.factQuestion('What is the atomic number of Gold?').v, 79);
  assert.equal(GB.factQuestion('Which is bigger, France or Spain?'), null, 'two things: not a lookup');
  assert.equal(GB.factQuestion('What is the population of Peru?'), null, 'not recorded: no check');
  assert.equal(GB.factQuestion('What is the capital of Narnia?'), null);
  assert.deepEqual(GB.gymCheckable('What is the capital of Japan?'), { label: 'the fact book', kind: 'key' });
  assert.equal(GB.gymCheck('What is the capital of Japan?', 'ANSWER: Tokyo').verdict.correct, true);
  assert.equal(GB.gymCheck('How many people live in India? (population)', 'About 1,430 million').verdict.correct, true, 'within 3%');
  assert.equal(GB.gymCheck('Tell me a joke', 'x'), null);
  // Every question the report card asks of the book is one the book can check.
  for (const [ent, field] of GB.FACT_SET) assert.deepEqual(GB.factQuestion(GB.factAsk(ent, field))?.ent, ent);
});

// ---- the report card ---------------------------------------------------------------------------------------------

test("report card: the phone's own questions and their strict scorers", () => {
  const by = (id) => BN.LOCAL_ITEMS.find((x) => x.id === id);
  assert.deepEqual(BN.LOCAL_ITEMS.map((x) => x.cat).filter((c, i, a) => a.indexOf(c) === i), ['arithmetic', 'instructions', 'tools']);
  assert.equal(BN.LOCAL_ITEMS.length, 12);
  assert.equal(by('sum-1').text, 'What is 17 × 23?');
  assert.equal(BN.scoreLocal('sum-1', '17 × 23 = 391'), true);
  assert.equal(BN.scoreLocal('sum-1', 'ANSWER: 381'), false);
  assert.equal(BN.scoreLocal('sum-2', 'ANSWER: 100'), true);
  assert.equal(BN.scoreLocal('sum-3', '427'), true);
  assert.equal(BN.scoreLocal('sum-4', 'ANSWER: 19'), true);
  assert.equal(BN.scoreLocal('ins-1', 'BLUE SKY TODAY'), true);
  assert.equal(BN.scoreLocal('ins-1', 'Blue sky today'), false);
  assert.equal(BN.scoreLocal('ins-1', 'HELLO THERE FRIEND, HOW'), false);
  assert.equal(BN.scoreLocal('ins-2', 'YES'), true);
  assert.equal(BN.scoreLocal('ins-2', 'Yes, 7 is odd.'), false, 'only the word');
  assert.equal(BN.scoreLocal('ins-3', 'apple, banana, cherry'), true);
  assert.equal(BN.scoreLocal('ins-3', 'Sure! apple, banana, cherry'), false);
  assert.equal(BN.scoreLocal('ins-3', 'apple, banana'), false);
  assert.equal(BN.scoreLocal('ins-4', 'down sat cat the'), true);
  assert.equal(BN.scoreLocal('ins-4', 'Down sat cat the.'), true);
  assert.equal(BN.scoreLocal('ins-4', 'Here it is: down sat cat the'), false);
  assert.equal(BN.scoreLocal('tool-1', '{"tool": "set_timer", "args": {"minutes": 5}}'), true);
  assert.equal(BN.scoreLocal('tool-1', 'Sure: {"tool": "set_timer", "args": {"minutes": "5"}}'), true);
  assert.equal(BN.scoreLocal('tool-1', '{"tool": "set_timer", "args": {"minutes": 10}}'), false);
  assert.equal(BN.scoreLocal('tool-1', "{'tool': 'set_timer'}"), false, 'not JSON');
  assert.equal(BN.scoreLocal('tool-2', '{"tool":"weather","args":{"place":"Leeds, UK"}}'), true);
  assert.equal(BN.scoreLocal('tool-3', '{"tool":"remember","args":{"text":"My sister is called Amy"}}'), true);
  assert.equal(BN.scoreLocal('tool-4', '{"tool":"add_event","args":{"title":"Lunch with Sam","day":"Friday","time":"1pm"}}'), true);
  assert.equal(BN.scoreLocal('tool-4', '{"tool":"add_event","args":{"title":"Lunch with Sam","day":"Monday","time":"1pm"}}'), false);
  assert.deepEqual(BN.jsonIn('x {"a": {"b": "}"}} y'), { a: { b: '}' } });
  assert.equal(BN.jsonIn('no json'), null);
  assert.equal(BN.scoreLocal('nope', 'x'), null);
});

/** A fake model for the report card: right on sums and tools, wrong on instructions; in THINK HARDER it gets instructions right. */
function benchModel() {
  const right = { 'sum-1': '391', 'sum-2': '100', 'sum-3': '427', 'sum-4': '19' };
  return fake((m) => {
    const q = user(m);
    const thinkMode = /ANSWER: <the answer only>/.test(m[0].content);
    if (isVerify(m)) return 'YES';
    for (const [id, v] of Object.entries(right)) if (q === BN.LOCAL_ITEMS.find((x) => x.id === id).text) return `ANSWER: ${v}`;
    if (/three words/.test(q)) return thinkMode ? 'ANSWER: BLUE SKY TODAY' : 'Sure! Blue sky today.';
    if (/YES or NO/.test(q)) return thinkMode ? 'ANSWER: YES' : 'Yes, it is.';
    if (/three fruits/.test(q)) return thinkMode ? 'ANSWER: apple, pear, plum' : 'Apple, pear and plum.';
    if (/reverse order/.test(q)) return thinkMode ? 'ANSWER: down sat cat the' : 'the cat sat down';
    if (/set_timer\(/.test(q)) {
      if (/5 minutes/.test(q)) return '{"tool": "set_timer", "args": {"minutes": 5}}';
      if (/Leeds/.test(q)) return '{"tool": "weather", "args": {"place": "Leeds"}}';
      if (/Amy/.test(q)) return '{"tool": "remember", "args": {"text": "sister Amy"}}';
      return '{"tool": "add_event", "args": {"title": "lunch", "day": "Friday", "time": "1pm"}}';
    }
    if (/capital of Japan/.test(q)) return 'ANSWER: Kyoto';
    return 'ANSWER: no idea';
  });
}

test('report card: a run scores every kind with and without THINK HARDER, times it, and says it in plain words', async () => {
  const items = [...BN.LOCAL_ITEMS.map(({ id, cat, text, steps, check }) => ({ id, cat, text, steps, check })), ...GB.benchItems()];
  const { gen } = benchModel();
  const judged = [];
  const steps = [];
  let clock = 0;
  const run = await BN.runBench({
    gen: async (m, o) => {
      clock += 100;
      return gen(m, o);
    },
    judge: async (id, reply) => {
      judged.push(id);
      return GB.judgeItem(id, reply)?.correct ?? false;
    },
    items,
    withThink: true,
    model: 'Qwen3-0.6B-q4f16_1-MLC@8c14ce4',
    now: () => clock,
    budget: { attempts: 3 },
    onProgress: (done, total, line) => steps.push([done, total, line]),
  });
  assert.equal(run.complete, true);
  assert.equal(run.items.length, 20);
  assert.ok(run.items.every((x) => x.think !== null));
  const s = Object.fromEntries(BN.catScores(run).map((c) => [c.cat, c]));
  assert.deepEqual(s.arithmetic.plain, [4, 4]);
  assert.deepEqual(s.arithmetic.think, [4, 4]);
  assert.deepEqual(s.tools.plain, [4, 4]);
  assert.deepEqual(s.instructions.plain, [0, 4]);
  assert.deepEqual(s.instructions.think, [4, 4], 'instructions are judged on the answer alone with THINK HARDER');
  assert.deepEqual(s.facts.plain, [0, 4]);
  assert.deepEqual(s.logic.plain, [0, 4]);
  assert.ok(s.arithmetic.plainMs > 0 && s.arithmetic.thinkMs > 0);
  assert.equal(run.ms, clock);
  assert.ok(judged.includes('fact-Japan-capital') && judged.includes('countdown-1-1'));
  assert.deepEqual(steps.at(-1), [40, 40, 'done']);
  assert.ok(steps.some(([, , l]) => /^THINK HARDER on sums: trying 3 approaches/.test(l)), steps.map((x) => x[2]).slice(0, 5).join(' | '));
  const words = BN.summarise(run);
  assert.match(words, /^Good at sums, following exact instructions and writing a tool call in the right format\./);
  assert.match(words, /Don't trust it for logic puzzles and facts it was not given \(capitals, elements, planets\): check those, or ask the big brain\./);
  assert.match(words, /THINK HARDER helped with following exact instructions \(0 → 4 of 4\)\./);
  assert.deepEqual(BN.overall(run), [8 / 20, 12 / 20]);
});

test('report card: STOP keeps a partial run (marked, and left out of the graph); history is capped and graphed oldest first', async () => {
  const ctl = new AbortController();
  const items = BN.LOCAL_ITEMS.map(({ id, cat, text, steps, check }) => ({ id, cat, text, steps, check }));
  let n = 0;
  const run = await BN.runBench({
    gen: async () => {
      if (++n === 3) ctl.abort();
      return 'ANSWER: 391';
    },
    judge: async () => false,
    items,
    withThink: false,
    model: 'm',
    signal: ctl.signal,
  });
  assert.equal(run.complete, false);
  assert.ok(run.items.length <= 3);
  assert.match(BN.summarise(run), /\(Stopped before the end: these are partial\.\)$/);
  const done = (at, plain) => ({ at, model: 'm', ms: 1, withThink: false, complete: true, items: [{ id: 'sum-1', cat: 'arithmetic', plain, plainMs: 1, think: null, thinkMs: 0 }] });
  let h = [];
  for (let i = 0; i < 35; i++) h = BN.addRun(h, done(i, i % 2 === 0));
  assert.equal(h.length, 30);
  assert.equal(h[0].at, 5);
  h = BN.addRun(h, run);
  const tr = BN.trend(h);
  assert.equal(tr.length, 29, 'the partial run is not graphed (and the oldest whole one fell off)');
  assert.deepEqual(tr.slice(0, 2).map((p) => p.plain), [1, 0]);
  assert.equal(tr[0].think, null);
  assert.equal(BN.summarise({ ...run, items: [] }), 'No questions were answered: run the check again.');
});
