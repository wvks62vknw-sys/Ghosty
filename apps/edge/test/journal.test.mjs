// JOURNAL (APPS ROUND, MEMORY lane): the journal's store and its words, pure, on their own (features/journal/store.ts, words.ts).
// His streak, On this day, search by his words, the chat's asks, and that nothing in the journal's code reads a position or sends
// his words anywhere.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({
  entryPoints: [at('../../web/src/features/journal/store.ts'), at('../../web/src/features/journal/words.ts')],
  bundle: true, format: 'esm', platform: 'neutral', outdir: at('./.build/journal'), outbase: at('../../..'), outExtension: { '.js': '.mjs' }, logLevel: 'warning',
});
const S = await import('./.build/journal/apps/web/src/features/journal/store.mjs');
const W = await import('./.build/journal/apps/web/src/features/journal/words.mjs');

const DAY = 86_400_000;
const noon = new Date(2026, 10, 14, 12).getTime();
const e = (id, back, o = {}) => ({ id, journal: 'personal', at: noon - back * DAY, text: `entry ${id}`, photos: [], edited: noon, ...o });

test('journal: the streak counts days in a row ending today, or yesterday before tonight’s entry; examples and the bin do not count', () => {
  assert.equal(S.streak([e('a', 0), e('b', 1), e('c', 2), e('d', 4)], noon), 3);
  assert.equal(S.streak([e('b', 1), e('c', 2)], noon), 2, 'not lost before tonight');
  assert.equal(S.streak([e('c', 2)], noon), 0);
  assert.equal(S.streak([e('a', 0, { sample: true }), e('b', 0, { deleted: noon })], noon), 0);
});

test('journal: On this day finds a week ago, a month ago and earlier years, and nothing from the bin', () => {
  const g = S.onThisDay([e('w', 7), e('m', 0, { at: new Date(2026, 9, 14, 9).getTime() }), e('y', 0, { at: new Date(2024, 10, 14, 20).getTime() }), e('x', 0, { at: new Date(2025, 10, 14, 8).getTime(), deleted: noon }), e('n', 3)], noon);
  assert.deepEqual(g.map((x) => [x.label, x.entries.map((y) => y.id)]), [['A week ago', ['w']], ['A month ago', ['m']], ['2 years ago', ['y']]]);
});

test('journal: search by his words matches every word in the text, the place, the prompt or the journal’s name', () => {
  const j = [{ id: 'personal', name: 'Personal', tone: 'accent' }, { id: 't', name: 'Travel', tone: 'green' }];
  const x = e('a', 0, { text: 'A long walk by the canal', place: 'Birmingham', journal: 't' });
  assert.ok(S.matches(x, 'canal walk', j));
  assert.ok(S.matches(x, 'birmingham', j));
  assert.ok(S.matches(x, 'travel canal', j));
  assert.ok(!S.matches(x, 'canal beach', j));
  assert.ok(S.matches(x, '  ', j));
});

test('journal: the chat’s asks open it, start an entry, or start one with his words; Memory’s own diary asks are left alone', () => {
  assert.deepEqual(W.journalAsked('add to my journal: the boiler works again'), { open: true, write: true, words: 'the boiler works again' });
  assert.deepEqual(W.journalAsked('Dear diary, a long day'), { open: true, write: true, words: 'a long day' });
  assert.deepEqual(W.journalAsked('new journal entry'), { open: true, write: true });
  assert.deepEqual(W.journalAsked('open my journal'), { open: true });
  for (const no of ['show me my diary', 'what did I do yesterday?', 'remember I take my coffee black', 'journalism jobs near me']) assert.equal(W.journalAsked(no), null, no);
});

test('journal: three examples, a prompt list of twenty, five moods', () => {
  assert.equal(S.samples(noon).length, 3);
  assert.ok(S.samples(noon).every((x) => x.sample));
  assert.equal(W.PROMPTS.length, 20);
  assert.equal(new Set(W.PROMPTS).size, 20);
  assert.equal(W.J.MOODS.length, 5);
});

test('journal: nothing in its code reads a position or sends his words to the brain (only the nudge’s time and the saved places list)', () => {
  for (const f of ['index.ts', 'store.ts', 'words.ts', 'lock.ts']) {
    const src = readFileSync(at(`../../web/src/features/journal/${f}`), 'utf8');
    assert.ok(!/geolocation|getCurrentPosition|watchPosition/.test(src), `${f} reads a position`);
    assert.ok(!/brain\.(?:chat|send|remember|ask)\b|fetch\(/.test(src), `${f} sends something`);
  }
  const ui = readFileSync(at('../../web/src/features/journal/index.ts'), 'utf8');
  assert.match(ui, /brain\.addJob\(\{ kind: 'reminder', title: 'Journal', text: 'A line in your journal\?'/, 'the nudge carries no words of his');
});
