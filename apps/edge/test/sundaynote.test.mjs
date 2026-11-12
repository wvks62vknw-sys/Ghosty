// THE SUNDAY NOTE'S SECOND SECTION (BRIEF-OCT-IDEAS-3 item 10): "What I learned this week", from the LOOPS card's numbers and the REPORT
// CARD's weekly run, five lines at most, honest about the gap, as one more section of the letter that already goes on Sunday morning
// (selftrain/cycle.ts sundayNote: "What I learned to do this week"), never a second message. The pure part (selftrain/learned.ts) is
// tested here on seeded loop and report records; the letter through the brain is in selftrain.test.mjs. The words are pinned by
// tests/fixtures/sunday-letter.json, which tests/further.spec.mjs reads too (so the phone's check and this one cannot drift).
// (Run from selftrain.test.mjs, which is in the test list; package.json is protected.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({ entryPoints: [at('../src/selftrain/learned.ts')], bundle: true, format: 'esm', platform: 'neutral', outfile: at('./.build/sundaynote/learned.mjs'), logLevel: 'warning' });
const L = await import('./.build/sundaynote/learned.mjs');
const fixture = JSON.parse(readFileSync(at('../../../tests/fixtures/sunday-letter.json'), 'utf8'));

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 8, 5, 40); // Sunday 8 November, 05:40
/** The LOOPS card's numbers for a week: the drills better than before, pieces read, the weekly run kept. */
const loops = (over = {}) => ({
  now: NOW,
  since: NOW - 7 * DAY,
  drills: { asked: 20, right: 15, before: { asked: 40, right: 20 } },
  study: { reads: 6, digests: 2, finished: [], failed: 0 },
  school: null,
  week: { week: 12, phase: 'idle', at: NOW - DAY, trained: {}, before: 0.64, after: 0.71, kept: true, why: '', rejected: [], active: null, activeLabel: 'the stock one' },
  voice: null,
  star: { taken: 3, waiting: 0, refused: [] },
  ...over,
});

test('the section: counted practice, what improved only where a measure says so, and a last line on the gap; five lines at most', () => {
  const lines = L.learnedLines(loops());
  assert.ok(lines.length >= 1 && lines.length <= 5, `${lines.length} lines`);
  assert.match(lines[0], /^This week I did 20 drills \(15 right\), 6 pieces of the library read, 2 notes written and 3 checked answers kept for training\.$/);
  assert.ok(lines.includes('My drills went from 50% right to 75%.'));
  assert.ok(lines.includes('Week 12’s training passed its exam (64% → 71%), so I kept the new brain.'));
  assert.match(lines.at(-1), /^What I can’t say: /, 'the gap is the last line');
  assert.deepEqual(lines, fixture.learned, 'the words are the ones the fixture (and the phone’s spec) hold');
});

test('the letter is one message: the ledger’s lines first, then this section under its heading; the section alone when the ledger has nothing new', () => {
  const ledger = ['In the GYM I reached Connect 4 level 6 (from 5).', 'New in the GYM: Chess (level 1).'];
  const text = L.letterText(ledger, L.learnedLines(loops()));
  assert.equal(text, fixture.text, 'the letter as the fixture holds it');
  assert.ok(text.startsWith(ledger.join('\n')));
  assert.ok(text.includes(`\n\n${L.LEARNED_HEADING}:\n`));
  assert.equal(L.letterText([], ['One line.']), `${L.LEARNED_HEADING}:\nOne line.`, 'no empty line before a heading with nothing above it');
  assert.equal(L.letterText(ledger, []), ledger.join('\n'), 'no section, no heading');
});

test('honest about the gap: no earlier drills to compare, drills not better, a run that failed its exam or stopped, and a week of nothing', () => {
  const first = L.learnedLines(loops({ drills: { asked: 10, right: 6, before: { asked: 0, right: 0 } }, week: null }));
  assert.ok(first.includes('My drills were 60% right; I have nothing earlier to compare, so I can’t say they improved.'));
  assert.match(first.at(-1), /^What I can’t say: practice is counted, not skill/, 'nothing measured moved, and it says so');
  const worse = L.learnedLines(loops({ drills: { asked: 10, right: 5, before: { asked: 20, right: 14 } }, week: null }));
  assert.ok(worse.includes('My drills were 50% right, not better than the 70% before.'));
  const failed = L.learnedLines(loops({ week: { ...loops().week, kept: false, after: 0.63, why: 'GYM PUZZLES fell' } }));
  assert.ok(failed.includes('Week 12’s training did not pass its exam (64% → 63%): GYM PUZZLES fell, so I kept the brain I had.'));
  const stopped = L.learnedLines(loops({ week: { ...loops().week, kept: null, stopped: 'I couldn’t install trl on Kaggle’s Python 3.13.' } }));
  assert.ok(stopped.includes('Week 12’s training stopped: I couldn’t install trl on Kaggle’s Python 3.13.'));
  // last week's run is not this week's
  assert.ok(!L.learnedLines(loops({ week: { ...loops().week, at: NOW - 9 * DAY } })).some((l) => /^Week 12/.test(l)));
  // nothing at all: no section, so no letter on its account
  const none = loops({ drills: { asked: 0, right: 0, before: { asked: 0, right: 0 } }, study: { reads: 0, digests: 0, finished: [], failed: 0 }, star: { taken: 0, waiting: 0, refused: [] }, week: null });
  assert.deepEqual(L.learnedLines(none), []);
  assert.deepEqual(L.learnedLines(null), []);
});

test('SCHOOL’s papers are said as marked, and five lines is the most however much there is', () => {
  const school = { checked: 12, waiting: 0, papers: [{ title: 'Year 4 maths', pct: 0.8, at: NOW - DAY }, { title: 'Year 4 reading', pct: 0.6, at: NOW - 2 * DAY }], previous: 0.7, near: 0 };
  const lines = L.learnedLines(loops({ school }));
  assert.ok(lines.length <= 5, `${lines.length} lines`);
  assert.ok(lines.some((l) => /^I sat 2 papers at school; the best was Year 4 maths, 80% \(the paper before: 70%\)\.$/.test(l)) || lines.at(-1).startsWith('What I can’t say'), 'the paper is said, or gives way to the gap');
  assert.match(lines.at(-1), /^What I can’t say: /);
});
