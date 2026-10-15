// Training ground exercise bank: every reference solution passes its hidden tests,
// a trivially wrong solution fails them, and the bank is well-formed.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { EXERCISES } = await import('./.build/training/exercises.mjs');

const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

function load(source, entry) {
  const fn = new Function(`${source}\n;return ${entry};`)();
  assert.equal(typeof fn, 'function', `${entry} is not defined as a function`);
  return fn;
}

function runCase(fn, t) {
  try {
    const out = clone(fn(...clone(t.args)));
    assert.deepStrictEqual(out, t.expect);
    return null;
  } catch (err) {
    return err;
  }
}

test('exercise bank is well-formed', () => {
  assert.ok(EXERCISES.length >= 40, `expected at least 40 exercises, got ${EXERCISES.length}`);
  const ids = EXERCISES.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, 'ids must be unique');
  for (const e of EXERCISES) {
    assert.match(e.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${e.id}: id must be kebab-case`);
    assert.ok([1, 2, 3].includes(e.level), `${e.id}: bad level`);
    assert.ok(e.title && e.topic, `${e.id}: title and topic required`);
    assert.ok(e.prompt.includes(e.entry), `${e.id}: prompt must mention ${e.entry}`);
    assert.ok(e.tests.length >= 6 && e.tests.length <= 12, `${e.id}: has ${e.tests.length} tests`);
    for (const [i, t] of e.tests.entries()) {
      assert.ok(Array.isArray(t.args), `${e.id} #${i}: args must be an array`);
      assert.deepStrictEqual(clone(t.args), t.args, `${e.id} #${i}: args not JSON-serialisable`);
      assert.notEqual(t.expect, undefined, `${e.id} #${i}: expect missing`);
      assert.deepStrictEqual(clone(t.expect), t.expect, `${e.id} #${i}: expect not JSON-serialisable`);
    }
  }
});

for (const e of EXERCISES) {
  test(`${e.id}: reference solution passes every test`, () => {
    const fn = load(e.reference, e.entry);
    for (const [i, t] of e.tests.entries()) {
      const err = runCase(fn, t);
      if (err) assert.fail(`${e.id} #${i} ${JSON.stringify(t.args)}${t.note ? ` (${t.note})` : ''}: ${err.message}`);
    }
  });

  test(`${e.id}: a trivially wrong solution fails`, () => {
    const fn = load(`function ${e.entry}() { return null; }`, e.entry);
    const failures = e.tests.filter((t) => runCase(fn, t) !== null).length;
    assert.ok(failures > 0, `${e.id}: tests do not reject a solution that always returns null`);
  });
}
