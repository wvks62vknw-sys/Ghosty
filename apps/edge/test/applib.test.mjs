// THE APP LIBRARY (packages/shared/src/applib, docs/build-plan/APPLIB.md): the safe expression language (expr.ts, a
// hand-written parser: no eval, no Function), the checks (validate.ts) on good and broken apps, and then every app in
// LIBRARY checked, failing with the app's id and the reason. Run from appkit.test.mjs (the brain suite). It also runs the
// PLAY & MAKE and DATA lanes' tests (applibgames, applibdata) when they are there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({
  entryPoints: [at('../../../packages/shared/src/applib/index.ts')],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outfile: at('./.build/applib.mjs'),
  logLevel: 'warning',
});
const A = await import('./.build/applib.mjs');

test('expr: the arithmetic, its order and its functions come out right', () => {
  const v = (s, x = {}) => A.evalExpr(s, x);
  assert.equal(v('1 + 2 * 3'), 7);
  assert.equal(v('(1 + 2) * 3'), 9);
  assert.equal(v('2 ^ 3 ^ 2'), 512);
  assert.equal(v('-2 ^ 2'), -4);
  assert.equal(v('2 ^ -1'), 0.5);
  assert.equal(v('10 % 4'), 2);
  assert.equal(v('7 / 2'), 3.5);
  assert.equal(v('1.5e2 + .5'), 150.5);
  assert.equal(v('round(2.345, 2)'), 2.35);
  assert.equal(v('round(1.005, 2)'), 1.01);
  assert.equal(v('round(2.5)'), 3);
  assert.equal(v('min(3, 1, 2) + max(4, 9)'), 10);
  assert.equal(v('clamp(15, 0, 10)'), 10);
  assert.equal(v('hypot(3, 4)'), 5);
  assert.equal(v('sqrt(16) + cbrt(27)'), 7);
  assert.ok(Math.abs(v('sin(30)') - 0.5) < 1e-12, 'angles are in degrees');
  assert.ok(Math.abs(v('atan2(1, 1)') - 45) < 1e-12);
  assert.ok(Math.abs(v('ln(e)') - 1) < 1e-12);
  assert.equal(v('log10(1000)'), 3);
  assert.ok(Math.abs(v('pi') - Math.PI) < 1e-12);
  assert.equal(v('pow(2, 10)'), 1024);
  assert.equal(v('floor(2.7) + ceil(2.1) + abs(-3)'), 8);
  assert.ok(Math.abs(v('exp(1)') - Math.E) < 1e-12);
});

test('expr: comparisons, and, or, not and if give numbers', () => {
  const v = (s, x = {}) => A.evalExpr(s, x);
  assert.equal(v('3 > 2'), 1);
  assert.equal(v('3 <= 2'), 0);
  assert.equal(v('2 == 2 and 3 != 4'), 1);
  assert.equal(v('0 or 0'), 0);
  assert.equal(v('not 0'), 1);
  assert.equal(v('not 1 or 1'), 1);
  assert.equal(v('if(w > 100, 1, 2)', { w: 150 }), 1);
  assert.equal(v('if(w > 100, 1, 2)', { w: 50 }), 2);
  assert.equal(v('1 + 2 > 2 and 1 < 2'), 1);
});

test('expr: names read only the values given, and bad formulas say why', () => {
  assert.equal(A.evalExpr('kg / (m ^ 2)', { kg: 81, m: 1.8 }).toFixed(2), '25.00');
  assert.deepEqual([...A.exprNames(A.parse('a + b * if(c, d, pi)'))].sort(), ['a', 'b', 'c', 'd']);
  for (const bad of ['1 +', '(1 + 2', 'foo(1)', 'round()', 'clamp(1, 2)', '1 2', '2 $ 3', 'constructor.constructor("x")()', 'a[0]', '"x"', '']) {
    assert.throws(() => A.parse(bad), A.ExprError, bad);
  }
  assert.throws(() => A.evalExpr('x + 1', {}), A.ExprError);
  assert.throws(() => A.evalExpr('__proto__', {}), A.ExprError, 'no prototype names');
  assert.throws(() => A.evalExpr('toString', {}), A.ExprError);
  assert.throws(() => A.parse('('.repeat(300) + '1' + ')'.repeat(300)), A.ExprError, 'too deep is refused, not a crash');
  const out = A.runCalc({ inputs: [{ id: 'a', default: 2 }, { id: 'b', default: 3 }], outputs: [{ id: 's', expr: 'a + b' }, { id: 'd', expr: 's * 2' }, { id: 'x', expr: 'nope' }] }, { a: 4 });
  assert.equal(out.s, 7);
  assert.equal(out.d, 14);
  assert.ok(Number.isNaN(out.x));
});

test('expr: the source holds no eval and no Function', () => {
  const src = readFileSync(at('../../../packages/shared/src/applib/expr.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  assert.ok(!/\beval\s*\(/.test(src) && !/\bFunction\s*\(/.test(src) && !/new\s+Function/.test(src));
});

const GOOD = {
  id: 'wine-cellar', name: 'Wine Cellar', family: 'life', glyph: 'bottle', archetype: 'log',
  pitch: 'Every bottle you keep, what it cost and when to drink it.',
  keywords: ['wine', 'cellar', 'bottles'],
  tour: ['These are sample bottles.', 'Tap a bottle to change it.', 'The strip shows what is ready this year.'],
  log: {
    fields: [
      { id: 'name', label: 'Wine', type: 'text', required: true, hint: 'e.g. Rioja Reserva' },
      { id: 'year', label: 'Vintage', type: 'number' },
      { id: 'colour', label: 'Colour', type: 'choice', options: ['Red', 'White', 'Rosé', 'Sparkling'] },
      { id: 'bottles', label: 'Bottles', type: 'number' },
      { id: 'price', label: 'Price', type: 'money' },
      { id: 'drinkby', label: 'Drink by', type: 'date' },
      { id: 'photo', label: 'Label', type: 'photo' },
    ],
    title: '{name} ({year})', sub: 'colour', meta: 'bottles', date: 'drinkby', group: 'colour',
    stats: [{ label: 'Bottles', kind: 'sum', field: 'bottles' }, { label: 'Ready this year', kind: 'count', period: 'year' }],
    views: ['list', 'gallery', 'board', 'calendar'],
    remind: { field: 'drinkby', words: 'Drink by today: {name}' },
  },
  sample: [
    { name: 'Rioja Reserva', year: 2018, colour: 'Red', bottles: 3, price: 14.5, drinkby: '2027-06-01' },
    { name: 'Chablis', year: 2021, colour: 'White', bottles: 2, price: 18, drinkby: '2026-12-01' },
  ],
};
const BMI = {
  id: 'bmi', name: 'BMI', family: 'body', glyph: 'heart', archetype: 'calc',
  pitch: 'Your body mass index from your height and weight.', keywords: ['bmi', 'body mass'],
  tour: ['Type your height and weight.', 'The answer changes as you type.', 'A first estimate, never certified.'],
  calc: {
    inputs: [{ id: 'kg', label: 'Weight', unit: 'kg', default: 70 }, { id: 'cm', label: 'Height', unit: 'cm', default: 175 }],
    outputs: [{ id: 'bmi', label: 'BMI', expr: 'kg / (cm / 100) ^ 2', dp: 1 }],
    tests: [{ in: { kg: 70, cm: 175 }, out: { bmi: 22.86 } }, { in: { kg: 90, cm: 180 }, out: { bmi: 27.78 } }],
    estimate: true, source: 'NHS BMI formula',
  },
};

test('validate: a good log and a good calc have no problems', () => {
  assert.deepEqual(A.validateApp(GOOD), []);
  assert.deepEqual(A.validateApp(BMI), []);
  assert.deepEqual(A.validateLibrary([GOOD, BMI]), []);
});

test('validate: each broken thing is named', () => {
  const why = (patch, base = GOOD) => A.validateApp({ ...structuredClone(base), ...patch }).join(' | ');
  assert.match(why({ id: 'Wine Cellar' }), /id must be/);
  assert.match(why({ name: 'A Very Long Name For An App' }), /2 to 18/);
  assert.match(why({ name: 'wine cellar' }), /Title Case/);
  assert.match(why({ pitch: 'Too short.' }), /30 to 90/);
  assert.match(why({ pitch: 'Every bottle you keep, what it cost and when to drink it' }), /full stop/);
  assert.match(why({ glyph: 'unicorn' }), /unknown glyph/);
  assert.match(why({ family: 'misc' }), /unknown family/);
  assert.match(why({ keywords: ['Wine', 'x'] }), /lower case/);
  assert.match(why({ tour: ['a', 'b'] }), /three lines/);
  assert.match(why({ pitch: 'Every bottle you keep, and your favorite ones too, kept here.' }), /favourite/);
  assert.match(why({ pitch: 'Every bottle you keep, sorted by color and kept here.' }), /colour/);
  assert.match(why({ pitch: 'Every bottle you keep, what it cost and when to drink it!' }), /exclamation|full stop/);
  assert.match(why({ tour: ['Lorem ipsum.', 'b', 'c'] }), /placeholder/);
  assert.match(why({ tour: ['Cheers 🍷', 'b', 'c'] }), /emoji/);
  assert.match(why({ pitch: 'Every bottle you keep, like a Spotify for your wine rack.' }), /brand/);
  const g = structuredClone(GOOD);
  g.log.title = '{name} ({vintage})';
  g.log.stats.push({ label: 'Value', kind: 'sum', field: 'colour' });
  g.log.chart = { field: 'nothing', kind: 'bar', period: 'year' };
  g.sample[0].grape = 'Tempranillo';
  g.sample[1].colour = 'Orange';
  const w = A.validateApp(g).join(' | ');
  assert.match(w, /title names a field that does not exist \(“vintage”\)/);
  assert.match(w, /stat “Value” needs a number field/);
  assert.match(w, /chart names a field that does not exist/);
  assert.match(w, /sample 1 has a key that is not a field \(“grape”\)/);
  assert.match(w, /not one of its options/);
  const c = structuredClone(BMI);
  c.calc.tests[1].out.bmi = 30;
  c.calc.outputs.push({ id: 'z', label: 'Odd', expr: 'kg * q' });
  assert.match(A.validateApp(c).join(' | '), /test 2: “bmi” came out 27.77\d* but the source says 30/);
  assert.match(A.validateApp(c).join(' | '), /reads “q”/);
  const one = structuredClone(BMI);
  one.calc.tests.pop();
  assert.match(A.validateApp(one).join(' | '), /2 or more tests/);
  assert.match(A.validateLibrary([GOOD, GOOD]).map((p) => p.why).join(' | '), /used 2 times/);
  assert.match(A.validateApp({ ...structuredClone(BMI), log: GOOD.log }).join(' | '), /has a log config but is a calc/);
});

test('validate: the other archetypes are checked too', () => {
  const base = { id: 'x-app', name: 'X App', family: 'tools', glyph: 'list', pitch: 'A plain test app that does one small job well.', keywords: ['x', 'test'], tour: ['One.', 'Two.', 'Three.'] };
  assert.deepEqual(A.validateApp({ ...base, archetype: 'checklist', checklist: { sections: [{ name: 'Morning', items: ['Water'] }], repeat: 'daily' } }), []);
  assert.deepEqual(A.validateApp({ ...base, archetype: 'timer', timer: { steps: [{ name: 'Work', secs: 20 }, { name: 'Rest', secs: 10 }], rounds: 8 } }), []);
  assert.deepEqual(A.validateApp({ ...base, archetype: 'counter', counter: { names: ['Laps'], step: 1, reset: 'daily' } }), []);
  assert.deepEqual(A.validateApp({ ...base, archetype: 'screen', screen: { hash: 'sheets' } }), []);
  assert.deepEqual(A.validateApp({ ...base, archetype: 'guide', guide: { sections: [{ title: 'Knots', body: 'A reef knot joins two ropes.' }], source: { name: 'Scouts', url: 'https://www.scouts.org.uk' } } }), []);
  assert.match(A.validateApp({ ...base, archetype: 'guide', guide: { sections: [{ title: 'K', body: 'B' }], source: { name: 'S', url: 'http://x' } } }).join(), /https/);
  assert.match(A.validateApp({ ...base, archetype: 'deck', deck: { cards: [{ q: 'a', a: 'b' }], mode: 'srs' } }).join(), /4 or more/);
  assert.match(A.validateApp({ ...base, archetype: 'game', game: { kind: 'chess3d', options: {} } }).join(), /unknown game kind/);
  assert.match(A.validateApp({ ...base, archetype: 'timer', timer: { steps: [{ name: 'W', secs: 0 }], rounds: 1 } }).join(), /1 s to 24 h/);
});

// ── every app in the Library ────────────────────────────────────────────────────────────

test(`the Library: all ${A.LIBRARY.length} apps pass every check`, () => {
  const problems = A.validateLibrary(A.LIBRARY);
  assert.ok(problems.length === 0, `${problems.length} problems:\n${problems.slice(0, 80).map((p) => `  ${p.id}: ${p.why}`).join('\n')}`);
});

test('the Library: never in the brain\'s prompt', () => {
  const prompt = readFileSync(at('../src/prompt.ts'), 'utf8');
  assert.ok(!/applib/i.test(prompt), 'the prompt does not read the Library');
});

// the lanes building on the engine bring their own brain tests; they run here too
for (const f of ['./applibgames.test.mjs', './applibdata.test.mjs']) if (existsSync(at(f))) await import(f);
