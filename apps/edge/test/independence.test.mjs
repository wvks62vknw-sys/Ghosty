// THE INDEPENDENCE METER (packages/shared/src/independence.ts, OWNER-ISSUES 78): every answered turn counted by where it was
// answered, from the line the chat already writes on it; the week in his voice; the per cents adding up; the brain's copy
// counts only. (Run from offline-brain.test.mjs: the test list in package.json is protected. Bundled here with esbuild's API.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({ entryPoints: [at('../../../packages/shared/src/independence.ts')], bundle: true, format: 'esm', platform: 'neutral', outfile: at('./.build/independence.mjs'), logLevel: 'warning' });
const I = await import('./.build/independence.mjs');

// The entries assistant/session.ts writes, by their model line (one answer each).
const ENTRIES = [
  ...Array.from({ length: 54 }, () => ({ model: 'On this phone · offline' })),
  ...Array.from({ length: 17 }, () => ({ model: 'Library on this device · offline' })),
  ...Array.from({ length: 20 }, () => ({ model: 'groq · llama-3.3-70b-versatile', tool: true, length: 120 })),
  ...Array.from({ length: 9 }, () => ({ model: 'gemini · gemini-2.5-flash', length: 1400 })),
];

test('every answer is counted where it was answered, from its model line; a kept one is marked; the cloud by provider and by what it was for', () => {
  assert.deepEqual(I.whereFrom('On this phone · offline'), { where: 'phone' });
  assert.deepEqual(I.whereFrom('On this phone · THINK HARDER'), { where: 'think' });
  assert.deepEqual(I.whereFrom('On this phone · website kit'), { where: 'kit' });
  assert.deepEqual(I.whereFrom('Library on this device · offline'), { where: 'library' });
  assert.deepEqual(I.whereFrom('groq · llama-3.3-70b-versatile'), { where: 'cloud', provider: 'groq' });
  assert.deepEqual(I.whereFrom('Direct · no AI'), { where: 'cloud', provider: 'direct' });
  assert.deepEqual(I.whereFrom(undefined), { where: 'cloud', provider: 'unknown' }, 'a reply that broke off before its line: the cloud');
  let days = [];
  for (const e of ENTRIES) days = I.addAnswer(days, '2026-10-30', e.model, e);
  days = I.addAnswer(days, '2026-10-30', 'On this phone · offline', { kept: true });
  assert.deepEqual(days, [{ d: '2026-10-30', n: { phone: 55, library: 17, cloud: 29 }, k: { phone: 1 }, c: { groq: 20, gemini: 9 }, a: { live: 20, long: 9 } }]);
  // a new day starts its own tally; at most 120 days are kept
  days = I.addAnswer(days, '2026-10-31', 'groq · x', { length: 10 });
  assert.deepEqual(days.map((x) => x.d), ['2026-10-30', '2026-10-31']);
  let many = [];
  for (let i = 0; i < 130; i++) many = I.addAnswer(many, new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString().slice(0, 10), 'groq · x');
  assert.equal(many.length, 120);
  assert.equal(many[0].d, '2026-01-11', 'the oldest go first');
});

test('the week in his voice, as the brief has it; the per cents are whole and add up to 100 whatever the split', () => {
  let days = [];
  for (const e of ENTRIES) days = I.addAnswer(days, '2026-10-30', e.model, e);
  const w = I.weekOf(days, '2026-10-31');
  assert.equal(I.meterLine(w), 'This week 71% of what you asked was answered on your own brains (phone 54%, library 17%). The cloud did 29%: mostly live facts and long writing.');
  assert.equal(I.ownShare(w), 71);
  assert.equal(I.meterLine(I.weekOf([], '2026-10-31')), 'Nothing asked this week yet: the meter starts with your next question.');
  assert.equal(I.meterLine({ total: 3, by: { phone: 2, library: 1, think: 0, kit: 0, cloud: 0 }, cloud: {}, asks: { live: 0, long: 0, chat: 0 } }), 'This week everything you asked was answered on your own brains (phone 67%, library 33%).');
  assert.equal(I.meterLine({ total: 2, by: { phone: 0, library: 0, think: 0, kit: 0, cloud: 2 }, cloud: { groq: 2 }, asks: { live: 0, long: 0, chat: 2 } }), 'This week the cloud answered everything you asked: mostly conversation. None of it was answered on your own brains yet.');
  // the per cents add up, for awkward splits too (thirds, sevenths, one in a thousand)
  for (const parts of [[1, 1, 1, 0, 0], [1, 1, 1, 1, 3], [1, 0, 0, 0, 999], [5, 3, 2, 1, 7], [0, 0, 0, 0, 0]]) {
    const s = I.shares(parts);
    assert.equal(s.reduce((a, b) => a + b, 0), parts.some(Boolean) ? 100 : 0, JSON.stringify(parts));
    assert.ok(s.every((x) => Number.isInteger(x) && x >= 0));
  }
  for (let i = 0; i < 300; i++) {
    const by = { phone: (i * 7) % 13, library: (i * 3) % 5, think: i % 4, kit: i % 2, cloud: (i * 11) % 17 };
    const total = Object.values(by).reduce((a, b) => a + b, 0);
    const line = I.meterLine({ total, by, cloud: {}, asks: { live: 1, long: 0, chat: 0 } });
    const m = line.match(/^This week (\d+)% .*own brains \(([^)]*)\)\. The cloud did (\d+)%/);
    if (!m) continue;
    const parts = [...m[2].matchAll(/(\d+)%/g)].reduce((t, x) => t + Number(x[1]), 0);
    assert.equal(parts, Number(m[1]), line);
    assert.equal(Number(m[1]) + Number(m[3]), 100, line);
  }
});

test('the weeks: a trend once two weeks have answers; the brain\'s copy is counts only, without the kept tasks, and takes nothing else', () => {
  const days = [
    { d: '2026-10-15', n: { phone: 58, cloud: 42 }, c: {}, a: {} },
    { d: '2026-10-22', n: { phone: 64, cloud: 36 }, c: {}, a: {} },
    { d: '2026-10-30', n: { phone: 54, library: 17, cloud: 29 }, k: { phone: 4 }, c: { groq: 29 }, a: { live: 29 } },
  ];
  assert.deepEqual(I.weeksOf(days, '2026-10-31', 4), [null, 58, 64, 71]);
  assert.equal(I.trendLine(I.weeksOf(days, '2026-10-31', 4)), 'Your own brains, week by week: 58% → 64% → 71%.');
  assert.equal(I.trendLine([null, null, 71]), '', 'one week is not a trend');
  assert.deepEqual(I.forBrain(days)[2], { d: '2026-10-30', n: { phone: 50, library: 17, cloud: 29 }, c: { groq: 29 }, a: { live: 29 } }, 'a kept task never leaves the phone, not even as a number');
  // what the brain keeps: well-formed counts only, merged by day (the newer copy wins)
  const raw = [{ d: '2026-10-30', n: { phone: 3, cloud: -1, evil: 9 }, c: { groq: 2, '<script>': 1 }, a: { live: 1, words: 'hello' }, q: 'a question' }, { d: 'yesterday', n: { phone: 1 } }, 'junk'];
  assert.deepEqual(I.meterDays(raw, [{ d: '2026-10-29', n: { phone: 1 }, c: {}, a: {} }]), [
    { d: '2026-10-29', n: { phone: 1 }, c: {}, a: {} },
    { d: '2026-10-30', n: { phone: 3, cloud: 0 }, c: { groq: 2 }, a: { live: 1 } },
  ]);
});
