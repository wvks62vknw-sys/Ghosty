// Drills: an endless, seeded bank of questions Ghosty can check without any AI.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const D = await import('./.build/library/drills.mjs');

test('every skill makes a question from a seed; the same seed gives the same question, another seed a different one', () => {
  let different = 0;
  for (let i = 0; i < D.SKILLS.length; i++) {
    const a = D.makeDrill(i, 7);
    const b = D.makeDrill(i, 7);
    const c = D.makeDrill(i, 8);
    assert.deepEqual(a, b);
    assert.equal(a.skill, D.SKILLS[i][0]);
    assert.ok(a.q.length > 10 && a.answer.length > 0, a.skill);
    assert.ok(['number', 'text', 'choice'].includes(a.kind));
    if (a.q !== c.q) different++;
  }
  assert.ok(different >= D.SKILLS.length * 0.8, `${different} of ${D.SKILLS.length} skills vary with the seed`);
  assert.ok(D.SKILLS.length >= 30, `${D.SKILLS.length} skills`);
  assert.equal(D.makeDrill(D.SKILLS.length + 3, 1).skill, D.SKILLS[3][0], 'indexes wrap around');
});

test('the grader takes the right answer the ways a model writes it, and refuses wrong ones', () => {
  for (let i = 0; i < D.SKILLS.length; i++) {
    for (let seed = 1; seed <= 25; seed++) {
      const d = D.makeDrill(i, seed);
      const tag = `${d.skill} #${seed}: ${d.q} → ${d.answer}`;
      assert.ok(D.grade(d, `Answer: ${d.answer}`), tag);
      assert.ok(D.grade(d, `Let me work it out.\nThe answer is ${d.answer}.`), tag);
      assert.ok(D.grade(d, d.answer), tag);
      assert.ok(!D.grade(d, ''), tag);
      if (d.kind === 'number') {
        const want = Number(d.answer);
        assert.ok(!D.grade(d, `Answer: ${want + Math.max(1000, Math.abs(want) * 2) + 0.5}`), `${tag} (wrong number)`);
        if (d.tolerance === undefined || d.tolerance > 0) assert.ok(D.grade(d, `Answer: ${(want * 1.004).toFixed(3)}`), `${tag} (rounded)`);
      } else if (d.kind === 'choice') {
        const other = 'ABCD'.replace(d.answer, '')[0];
        assert.ok(!D.grade(d, `Answer: ${other}`), `${tag} (wrong letter)`);
        assert.ok(D.grade(d, `${d.answer})`), `${tag} (letter with bracket)`);
      } else {
        assert.ok(!D.grade(d, 'Answer: zzzqqq'), `${tag} (wrong word)`);
      }
    }
  }
});

test('numbers in sentences: commas, currency, units, a final equals sign', () => {
  const d = { skill: 'x', domain: 'maths', q: 'q', answer: '16289', kind: 'number' };
  assert.ok(D.grade(d, 'After 10 years it is worth £16,289.'));
  assert.ok(D.grade(d, '5000 × 1.05^10 = 16288.95, so about 16,289 pounds'));
  assert.ok(D.grade(d, 'Answer: 16,288.95 GBP'));
  assert.ok(!D.grade(d, 'Answer: 5000'));
  const exact = { ...d, answer: '7', tolerance: 0 };
  assert.ok(D.grade(exact, 'x = 7'));
  assert.ok(!D.grade(exact, 'x = 7.5'));
  assert.ok(D.grade({ ...d, answer: '-3', tolerance: 0 }, 'The smaller root is -3.'));
});

test('words and lists: case, punctuation and spacing do not matter; a list is its tokens', () => {
  const t = { skill: 'x', domain: 'general', q: 'q', answer: 'Addis Ababa', kind: 'text' };
  assert.ok(D.grade(t, 'addis ababa'));
  assert.ok(D.grade(t, 'The capital is Addis Ababa.'));
  assert.ok(!D.grade(t, 'Nairobi'));
  const list = { ...t, answer: '3 8 12 20' };
  assert.ok(D.grade(list, 'Sorted: 3, 8, 12, 20'));
  assert.ok(D.grade(list, '[3, 8, 12, 20]'));
  assert.ok(!D.grade(list, '3, 12, 8, 20'));
  const frac = { ...t, answer: '7/12' };
  assert.ok(D.grade(frac, 'Answer: 7/12'));
  assert.ok(!D.grade(frac, 'Answer: 14/24'));
});

test('the arithmetic behind the generators is right (checked independently)', () => {
  const by = Object.fromEntries(D.SKILLS.map(([id], i) => [id, i]));
  for (let seed = 1; seed <= 40; seed++) {
    const a = D.makeDrill(by.arithmetic, seed);
    const m = a.q.match(/Compute (\d+) ([+\-×]) (\d+)\./);
    const [x, op, y] = [Number(m[1]), m[2], Number(m[3])];
    assert.equal(Number(a.answer), op === '+' ? x + y : op === '-' ? x - y : x * y);
    const mod = D.makeDrill(by.modular, seed);
    const mm = mod.q.match(/What is (\d+) mod (\d+)/);
    assert.equal(Number(mod.answer), Number(mm[1]) % Number(mm[2]));
    const lin = D.makeDrill(by['linear-equations'], seed);
    const lm = lin.q.match(/Solve for x: (\d+)x ([+-]) (\d+) = (-?\d+)\./);
    const x0 = Number(lin.answer);
    assert.equal(Number(lm[1]) * x0 + (lm[2] === '-' ? -1 : 1) * Number(lm[3]), Number(lm[4]), lin.q);
    const quad = D.makeDrill(by.quadratics, seed);
    const qm = quad.q.match(/x² ([+-]) (\d+)x ([+-]) (\d+) = 0/);
    const b = (qm[1] === '-' ? -1 : 1) * Number(qm[2]), c = (qm[3] === '-' ? -1 : 1) * Number(qm[4]);
    const root = Number(quad.answer);
    assert.equal(root * root + b * root + c, 0, quad.q);
    const g = D.makeDrill(by['number-theory'], seed);
    const gm = g.q.match(/(greatest common divisor|least common multiple) of (\d+) and (\d+)/);
    const gcd = (p, q) => (q ? gcd(q, p % q) : p);
    const [p, q] = [Number(gm[2]), Number(gm[3])];
    assert.equal(Number(g.answer), gm[1].startsWith('greatest') ? gcd(p, q) : (p * q) / gcd(p, q));
    const pf = D.makeDrill(by['prime-factors'], seed);
    const n = Number(pf.q.match(/Write (\d+) as/)[1]);
    assert.equal(pf.answer.split(' × ').map(Number).reduce((u, v) => u * v, 1), n);
  }
});
