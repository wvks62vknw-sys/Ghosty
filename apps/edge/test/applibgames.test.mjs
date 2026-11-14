// THE APP LIBRARY's game kinds (packages/shared/src/applib/games): every puzzle solvable with one answer where the genre
// asks for it, a fair first move, the scoring, and the win and the loss for each kind; and App Maker's drafts (draft.ts), each
// one passing the engine's own validator. Run from appkit.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({
  entryPoints: [at('../../../packages/shared/src/applib/games/index.ts')],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outfile: at('./.build/applibgames.mjs'),
  logLevel: 'warning',
});
const G = await import('./.build/applibgames.mjs');
await build({
  stdin: { contents: `export * from './packages/shared/src/applib/draft.ts'; export { LIBRARY, validateApp } from './packages/shared/src/applib/index.ts';`, resolveDir: at('../../..'), loader: 'ts' },
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outfile: at('./.build/applibdraft.mjs'),
  logLevel: 'warning',
});
const D = await import('./.build/applibdraft.mjs');
const R = G.rng;

test('the dice: a seed gives the same numbers every time; options are read safely', () => {
  const a = R.rng(42), b = R.rng(42);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
  assert.equal(R.daySeed(new Date(2026, 10, 14)), 20261114);
  assert.equal(R.num({ n: 99 }, 'n', 4, 3, 6), 6);
  assert.equal(R.num({ n: 'x' }, 'n', 4, 3, 6), 4);
  assert.equal(R.str({ d: 'hard' }, 'd', ['easy', 'hard'], 'easy'), 'hard');
  assert.equal(R.str({ d: 'evil' }, 'd', ['easy', 'hard'], 'easy'), 'easy');
  assert.deepEqual(R.list({ w: ['a', 3, ' b '] }, 'w'), ['a', 'b']);
});

test('sudoku: every puzzle has exactly one solution, the right clues, and its solution is a valid grid', () => {
  for (const [seed, d] of [[1, 'easy'], [2, 'medium'], [3, 'hard']]) {
    const p = G.sudoku.generate(seed, d);
    assert.equal(G.sudoku.countSolutions(p.puzzle, 2), 1, `seed ${seed}`);
    assert.ok(p.clues >= G.sudoku.CLUES[d] && p.clues <= G.sudoku.CLUES[d] + 6, `clues ${p.clues}`);
    assert.equal(G.sudoku.conflicts(p.solution).size, 0);
    assert.ok(p.puzzle.every((v, i) => !v || v === p.solution[i]));
    assert.deepEqual(G.sudoku.solve(p.puzzle), p.solution);
  }
  const p = G.sudoku.generate(9, 'easy');
  const g = p.puzzle.slice();
  const empty = g.indexOf(0);
  const wrong = p.solution[G.sudoku.PEERS[empty].find((x) => g[x])] ;
  g[empty] = g[G.sudoku.PEERS[empty].find((x) => g[x])];
  assert.ok(G.sudoku.conflicts(g).has(empty), 'a clash is shown');
  assert.ok(wrong);
  assert.equal(G.sudoku.isSolved(p.solution, p.solution), true);
  assert.equal(G.sudoku.isSolved(p.puzzle, p.solution), false);
  assert.ok(G.sudoku.hintCell(p.puzzle) >= 0);
  assert.ok(G.sudoku.score('hard', 300, 0, 0) > G.sudoku.score('easy', 300, 0, 0));
  assert.ok(G.sudoku.score('medium', 300, 2, 1) < G.sudoku.score('medium', 300, 0, 0));
  assert.equal(G.sudoku.score('easy', 99999, 9, 9), 100);
});

test('mines: the first tap is always safe and opens an area; a mine loses; clearing every safe cell wins', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const g = G.mines.create(12, 9, 20);
    const first = (seed * 7) % 108;
    const opened = G.mines.reveal(g, first, seed);
    assert.notEqual(g.state, 'lost', `seed ${seed}`);
    assert.ok(opened.length >= 1);
    assert.equal(g.cells[first], 0, 'the first tap is an opening');
    assert.equal(g.cells.filter((v) => v === -1).length, 20);
  }
  const g = G.mines.create(8, 8, 10);
  G.mines.reveal(g, 0, 5);
  const mine = g.cells.indexOf(-1);
  G.mines.toggleFlag(g, mine);
  assert.equal(G.mines.flagsLeft(g), 9);
  assert.deepEqual(G.mines.reveal(g, mine, 5), [], 'a flagged cell does not open');
  G.mines.toggleFlag(g, mine);
  for (let i = 0; i < g.cells.length; i++) if (g.cells[i] !== -1) G.mines.reveal(g, i, 5);
  assert.equal(g.state, 'won');
  assert.ok(G.mines.score(g, 60) > G.mines.score(g, 200));
  const l = G.mines.create(8, 8, 10);
  G.mines.reveal(l, 0, 5);
  G.mines.reveal(l, l.cells.indexOf(-1), 5);
  assert.equal(l.state, 'lost');
  // the mine count never leaves the first opening without room
  assert.equal(G.mines.create(6, 6, 99).mines, 27);
});

test('merge: lines slide and join once per swipe, score adds, the board ends when no swipe moves', () => {
  assert.deepEqual(G.merge.slideLine([2, 2, 2, 2]), { line: [4, 4, 0, 0], gained: 8 });
  assert.deepEqual(G.merge.slideLine([2, 0, 2, 4]), { line: [4, 4, 0, 0], gained: 4 });
  assert.deepEqual(G.merge.slideLine([4, 4, 8, 0]), { line: [8, 8, 0, 0], gained: 8 });
  const b = { size: 4, cells: [2, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
  const m = G.merge.move(b, 'right');
  assert.equal(m.board.cells[3], 4);
  assert.equal(m.gained, 4);
  assert.ok(m.moved);
  assert.equal(G.merge.move(m.board, 'right').moved, false);
  const stuck = { size: 2, cells: [2, 4, 4, 2] };
  assert.equal(G.merge.canMove(stuck), false);
  const s = G.merge.start(4, R.rng(1));
  assert.equal(s.cells.filter(Boolean).length, 2);
  assert.ok(G.merge.reached({ size: 2, cells: [2048, 0, 0, 0] }, 2048));
  // a full game by a simple strategy always ends with a real score
  const r = R.rng(7);
  let board = G.merge.start(4, r), score = 0;
  for (let k = 0; k < 5000 && G.merge.canMove(board); k++) {
    for (const d of ['down', 'left', 'right', 'up']) {
      const mv = G.merge.move(board, d);
      if (mv.moved) { board = mv.board; score += mv.gained; G.merge.spawn(board, r); break; }
    }
  }
  assert.equal(G.merge.canMove(board), false);
  assert.ok(score > 100);
});

test('solitaire: every deal is winnable (the solver wins it), moves follow the rules, a won game is all home', () => {
  for (const seed of [11, 22]) {
    const d = G.solitaire.deal(seed, 1);
    assert.equal(d.checked, true);
    assert.equal(G.solitaire.solvable(d), true);
    assert.equal(d.tab.reduce((a, c) => a + c.down.length + c.up.length, 0) + d.stock.length, 52);
    assert.deepEqual(d.tab.map((c) => c.up.length), [1, 1, 1, 1, 1, 1, 1]);
  }
  const S = G.solitaire;
  const card = (r, s) => s * 13 + r - 1;
  assert.equal(S.canStack(card(12, 1), card(13, 0)), true, 'red queen on black king');
  assert.equal(S.canStack(card(12, 0), card(13, 3)), false, 'black on black');
  assert.equal(S.canStack(card(13, 0), undefined), true, 'a king to an empty column');
  assert.equal(S.canStack(card(5, 0), undefined), false);
  assert.equal(S.name(card(1, 1)), 'A♥');
  const s = S.deal(11, 3);
  const before = s.stock.length;
  S.turnStock(s);
  assert.equal(s.waste.length, 3);
  assert.equal(s.stock.length, before - 3);
  // a won layout
  const w = { stock: [], waste: [], found: [0, 1, 2, 3].map((x) => [...Array(13).keys()].map((r) => x * 13 + r)), tab: Array.from({ length: 7 }, () => ({ down: [], up: [] })), draw: 1, moves: 100, passes: 0 };
  assert.equal(S.won(w), true);
  assert.ok(S.score(w, 100) > 520);
});

test('wordguess: letters are marked fairly (repeats too), guesses are checked, the keyboard keeps the best mark', () => {
  const m = (g, a) => G.wordguess.marks(g, a).map((x) => x[0]).join('');
  assert.equal(m('crane', 'crane'), 'hhhhh');
  assert.equal(m('allee', 'apple'), 'hnmmh', 'a repeated l is near once, the second miss');
  assert.equal(m('speed', 'abide'), 'mmnmn');
  assert.equal(m('eerie', 'there'), 'nmnmh');
  const W = G.wordguess.WORDS5;
  assert.ok(W.length > 400 && W.every((w) => /^[a-z]{5}$/.test(w)));
  assert.ok(!W.includes('color') && !W.includes('humor'), 'British spelling');
  assert.equal(G.wordguess.allowed('abc', W, false), 'short');
  assert.equal(G.wordguess.allowed('qwxzk', W, true), 'unknown');
  assert.equal(G.wordguess.allowed('apple', W, true), '');
  assert.equal(G.wordguess.answerFor(W, 20261114), G.wordguess.answerFor(W, 20261114), 'the daily word holds all day');
  const k = G.wordguess.keyMarks(['apple', 'plane'], 'plate');
  assert.equal(k.p, 'hit');
  assert.equal(k.a, 'hit');
  assert.equal(k.n, 'miss');
  assert.deepEqual(G.wordguess.wordsFrom(['Vinyl', 'decks', 'track', 'xx']), ['vinyl', 'decks', 'track']);
  assert.equal(G.wordguess.score(1, 6), 600);
  assert.equal(G.wordguess.score(6, 6), 100);
});

test('nonogram: every picture solves by line logic alone, and clues read right', () => {
  assert.deepEqual(G.nonogram.clue([true, true, false, true]), [2, 1]);
  assert.deepEqual(G.nonogram.clue([false, false]), [0]);
  assert.deepEqual(G.nonogram.solveLine([3], [-1, -1, -1, -1]), [-1, 1, 1, -1]);
  assert.deepEqual(G.nonogram.solveLine([2, 1], [-1, -1, -1, -1]), [1, 1, 0, 1]);
  for (const [seed, size] of [[1, 5], [2, 10], [3, 15]]) {
    const n = G.nonogram.generate(seed, size, 55);
    const solved = G.nonogram.logicSolve(n.size, n.rows, n.cols);
    assert.ok(solved.every((v) => v !== -1), `seed ${seed}`);
    assert.deepEqual(solved.map((v) => v === 1), n.solution);
    assert.equal(G.nonogram.isSolved(n, n.solution), true);
    assert.equal(G.nonogram.isSolved(n, n.solution.map(() => false)), false);
  }
  assert.ok(G.nonogram.score(10, 60, 0) > G.nonogram.score(10, 60, 3));
});

test('pairs: a deal holds every pair twice; a match stays, a miss turns back; done when all are gone', () => {
  const p = G.pairs.deal(6, 3);
  assert.equal(p.cards.length, 12);
  for (let i = 0; i < 6; i++) assert.equal(p.cards.filter((c) => c === i).length, 2);
  const a = 0, b = p.cards.findIndex((c, i) => i !== a && c === p.cards[a]);
  const miss = p.cards.findIndex((c, i) => i !== a && c !== p.cards[a]);
  assert.equal(G.pairs.flip(p, a), 'one');
  assert.equal(G.pairs.flip(p, miss), 'miss');
  assert.equal(G.pairs.flip(p, b), '', 'no third card while two are up');
  G.pairs.hide(p);
  G.pairs.flip(p, a);
  assert.equal(G.pairs.flip(p, b), 'match');
  for (let i = 0; i < 6; i++) {
    const [x, y] = p.cards.map((c, j) => (c === i ? j : -1)).filter((j) => j >= 0);
    if (!p.gone[x]) { G.pairs.flip(p, x); G.pairs.flip(p, y); }
  }
  assert.equal(G.pairs.done(p), true);
  assert.equal(p.turns, 7);
  assert.ok(G.pairs.score(p, 10) > 0);
});

test('blocks: pieces come from a bag of all seven, rows clear and score by level, the stack topping out ends it', () => {
  const r = R.rng(3);
  const b = G.blocks.start(10, 20, 1, r);
  const seen = new Set([b.piece.shape, b.next, ...b.bag]);
  assert.equal(seen.size, 7, 'the first bag holds every shape');
  assert.equal(G.blocks.cells({ shape: 'T', rot: 0, x: 0, y: 0 }).length, 4);
  // four turns come back to the start
  const p = { shape: 'L', rot: 4, x: 3, y: 3 };
  assert.deepEqual(G.blocks.cells(p).sort(), G.blocks.cells({ ...p, rot: 0 }).sort());
  // a nearly full bottom row clears when an upright line piece fills its gap
  const c = G.blocks.start(10, 20, 2, R.rng(1));
  for (let x = 0; x < 9; x++) c.grid[19 * 10 + x] = 1;
  c.piece = { shape: 'I', rot: 1, x: 7, y: 0 };
  assert.ok(G.blocks.fits(c, c.piece));
  const cleared = G.blocks.hardDrop(c, R.rng(1));
  assert.equal(cleared, 1);
  assert.equal(c.lines, 1);
  assert.ok(c.score >= 100 * 2);
  assert.equal(G.blocks.LINE_POINTS[4], 800);
  // dropping without moving tops out
  const d = G.blocks.start(10, 20, 1, R.rng(9));
  for (let k = 0; k < 200 && !d.over; k++) G.blocks.hardDrop(d, R.rng(k));
  assert.equal(d.over, true);
  assert.ok(G.blocks.fallMs(10) < G.blocks.fallMs(1));
});

test('snake: eating grows and scores, it cannot turn back on itself, walls and its own body end it, wrap carries it round', () => {
  const r = R.rng(4);
  const s = G.snake.start(10, false, r);
  assert.equal(s.body.length, 3);
  G.snake.turn(s, 'left');
  assert.equal(s.queued.length, 0, 'no turning straight back');
  s.food = s.body[0] + 1;
  assert.equal(G.snake.step(s, r), 'ate');
  assert.equal(s.body.length, 4);
  assert.equal(s.score, 10);
  for (let k = 0; k < 10 && s.alive; k++) G.snake.step(s, r);
  assert.equal(s.alive, false, 'the wall ends it');
  const w = G.snake.start(10, true, r);
  w.food = -1;
  for (let k = 0; k < 12; k++) assert.notEqual(G.snake.step(w, r), 'died');
  const t = G.snake.start(10, false, r);
  t.body = [55, 56, 66, 65, 64, 54];
  t.dir = 'left';
  t.food = 0;
  G.snake.turn(t, 'down');
  assert.equal(G.snake.step(t, r), 'died', 'running into itself');
});

test('slide: every shuffle can be solved, taps slide whole rows, and the solved board is recognised', () => {
  for (const [size, seed] of [[3, 1], [4, 2], [5, 3]]) {
    const b = G.slide.shuffled(size, seed);
    assert.equal(G.slide.solvable(b), true);
    assert.equal(G.slide.isSolved(b), false);
  }
  assert.equal(G.slide.solvable({ size: 4, cells: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 14, 0] }), false);
  const b = G.slide.solved(3);
  assert.equal(G.slide.tap(b, 6), 2, 'the row slides two tiles');
  assert.deepEqual(b.cells, [1, 2, 3, 4, 5, 6, 0, 7, 8]);
  assert.equal(G.slide.tap(b, 4), 0, 'not in line with the gap');
  G.slide.tap(b, 8);
  assert.equal(G.slide.isSolved(b), true);
});

test('lights: every scramble can be cleared within its par; a press flips a cross', () => {
  const l = G.lights.scramble(5, 10, 8);
  for (const i of l.presses) G.lights.press(l, i);
  assert.equal(G.lights.cleared(l), true);
  const c = { size: 3, on: Array(9).fill(false), par: 1 };
  G.lights.press(c, 4);
  assert.equal(c.on.filter(Boolean).length, 5);
  G.lights.press(c, 0);
  assert.deepEqual(c.on, [true, false, false, false, true, true, false, true, false]);
  assert.ok(G.lights.score(l, l.par) > G.lights.score(l, l.par + 4));
});

test('simon, reaction, sprint and typing: the sequence grows, sums are whole, speed is counted the standard way', () => {
  const r = R.rng(2);
  const s = G.simon.start(4, r);
  assert.equal(G.simon.tap(s, s.seq[0], r), 'round');
  assert.equal(s.seq.length, 2);
  assert.equal(G.simon.tap(s, (s.seq[0] + 1) % 4, r), 'wrong');
  assert.equal(G.simon.rounds(s), 1);
  assert.equal(G.reaction.average([200, 300, 250]), 250);
  const wait = G.reaction.waitMs(r, 1000, 2000);
  assert.ok(wait >= 1000 && wait <= 2000);
  assert.equal(G.reaction.verdict(240), 'Quick');
  for (let k = 0; k < 200; k++) {
    const q = G.sprint.sum(r, '+-×÷', 20);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0, q.text);
  }
  assert.equal(G.sprint.points(1), 10);
  assert.equal(G.sprint.points(4), 16);
  const t = G.typing.result('hello world', 'hello world', 6);
  assert.equal(t.wpm, 22);
  assert.equal(t.accuracy, 100);
  assert.equal(G.typing.result('abcd', 'abxd', 60).accuracy, 75);
});

test('hangman, anagram, wordgrid and quiz: wins and losses, a scramble never spells the word, every hidden word is there', () => {
  const h = G.hangman.start(['ab cd'], 3, 1);
  for (const ch of 'abcd') G.hangman.guess(h, ch);
  assert.equal(G.hangman.state(h), 'won');
  assert.equal(G.hangman.shown(h), 'ab cd');
  assert.ok(G.hangman.score(h) > 0);
  const l = G.hangman.start(['zz'], 3, 1);
  for (const ch of 'abc') G.hangman.guess(l, ch);
  assert.equal(G.hangman.state(l), 'lost');
  assert.equal(G.hangman.guess(l, 'z'), '', 'no guesses after the end');
  const r = R.rng(5);
  for (const w of ['apple', 'level', 'stone']) assert.notEqual(G.anagram.scramble(w, r), w);
  assert.equal(G.anagram.accepts('notes', 'stone', ['stone', 'notes']), true);
  assert.equal(G.anagram.accepts('tones', 'stone', ['stone']), false);
  const g = G.wordgrid.build(['vinyl', 'record', 'needle', 'sleeve', 'groove', 'stylus'], 10, 6, true, 3);
  assert.equal(g.words.length, 6);
  for (const w of g.words) {
    assert.equal(w.cells.map((c) => g.letters[c]).join(''), w.word);
    assert.equal(G.wordgrid.found(g, w.cells.slice().reverse()), w.word);
    assert.deepEqual(G.wordgrid.line(10, w.cells[0], w.cells[w.cells.length - 1]), w.cells);
  }
  assert.deepEqual(G.wordgrid.line(10, 0, 12), [], 'not a straight line');
  const q = G.quiz.round([], 5, r);
  assert.equal(q.length, 5);
  for (const x of q) assert.ok(x.choices.includes(x.right) && x.choices.length >= 3);
  assert.equal(G.quiz.parse(['Bad line']).length, 0);
  assert.equal(G.quiz.points(true, 4), 14);
});

test('dots: closing a box scores and keeps the turn; the fair phone takes a free box and gives none away', () => {
  const d = G.dots.start(2);
  const [t, b, l] = G.dots.boxEdges(2, 0);
  G.dots.draw(d, t); // him
  G.dots.draw(d, b); // phone
  G.dots.draw(d, l); // him
  assert.equal(d.turn, 2);
  const e = G.dots.cpuEdge(d, R.rng(1), 'fair');
  assert.equal(e, G.dots.boxEdges(2, 0)[3], 'the phone closes the open box');
  assert.equal(G.dots.draw(d, e), 1);
  assert.equal(d.turn, 2, 'another turn after a box');
  assert.equal(G.dots.draw(d, e), -1, 'an edge is drawn once');
  const f = G.dots.start(3);
  f.turn = 2;
  const safe = G.dots.cpuEdge(f, R.rng(2), 'fair');
  G.dots.draw(f, safe);
  for (let k = 0; k < 60 && !G.dots.over(f); k++) {
    const x = G.dots.cpuEdge(f, R.rng(k), 'fair');
    G.dots.draw(f, x);
  }
  assert.equal(G.dots.over(f), true);
  const s = G.dots.tally(f);
  assert.equal(s.me + s.cpu, 9);
});

// ── App Maker (packages/shared/src/applib/draft.ts) ───────────────────────────────

const taken = () => D.LIBRARY.map((a) => a.id);
const valid = (d, extra = []) => assert.deepEqual(D.check(d, [...taken(), ...extra]), [], `${d.id}: ${D.check(d, [...taken(), ...extra]).join('; ')}`);

test('App Maker: a blank app of every archetype it makes passes the engine\'s validator', () => {
  assert.deepEqual(D.MAKER_ARCHETYPES, ['log', 'checklist', 'counter', 'timer', 'deck', 'game']);
  for (const a of D.MAKER_ARCHETYPES) {
    const d = D.blank(a, 'my wine notes', taken());
    assert.equal(d.archetype, a);
    assert.equal(d.name, 'My Wine Notes');
    assert.match(d.id, /^mine-/);
    valid(d);
  }
  assert.equal(D.titleCase('a list of the things for my holiday in spain'), 'A List of the');
  assert.equal(D.freeId('Vinyl', ['mine-vinyl']), 'mine-vinyl-2');
});

test('App Maker: every field type can be added, moved, changed and removed, and the app stays valid', () => {
  let d = D.blank('log', 'Everything', taken());
  for (const { type, name } of D.FIELD_TYPES) d = D.addField(d, name, type);
  assert.equal(d.log.fields.length, 3 + 14);
  assert.deepEqual([...new Set(d.log.fields.map((f) => f.type))].sort(), D.FIELD_TYPES.map((t) => t.type).sort());
  assert.deepEqual(d.log.fields.find((f) => f.type === 'choice').options, ['First', 'Second', 'Third']);
  assert.equal(new Set(d.log.fields.map((f) => f.id)).size, d.log.fields.length, 'field ids stay unique');
  valid(d);
  d = D.changeField(d, 'choice', { label: 'Shelf', options: ['Top', 'Middle', 'Bottom'] });
  assert.equal(d.log.fields.find((f) => f.id === 'choice').label, 'Shelf');
  d = D.setViews(d, ['board', 'gallery', 'calendar', 'list']);
  assert.deepEqual(d.log.views, ['board', 'gallery', 'calendar', 'list']);
  assert.ok(d.log.group);
  d = D.addStat(d, { label: 'Total spent', kind: 'sum', field: 'money' });
  valid(d);
  const before = d.log.fields.map((f) => f.id);
  d = D.moveField(d, 'money', -1);
  assert.notDeepEqual(d.log.fields.map((f) => f.id), before);
  d = D.removeField(d, 'date');
  d = D.removeField(d, 'money');
  d = D.removeField(d, 'choice');
  assert.ok(!d.log.stats.some((s) => s.field === 'money'), 'a stat on a removed field goes too');
  assert.ok(!d.log.views.includes('board') || d.log.group, 'no board without a group');
  valid({ ...d, log: { ...d.log, views: D.possibleViews(d.log).filter((v) => d.log.views.includes(v)) } });
  const g = D.setGlyph(D.rename(d, 'record shelf'), 'music');
  assert.equal(g.name, 'Record Shelf');
  assert.equal(g.glyph, 'music');
  assert.equal(D.setGlyph(g, 'nonsense').glyph, 'music');
});

test('App Maker: duplicate and change any Library app, under his own id', () => {
  const src = D.LIBRARY.find((a) => a.archetype === 'log') ?? D.blank('log', 'Seed', []);
  const d = D.duplicate(src, taken());
  assert.notEqual(d.id, src.id);
  assert.ok(!taken().includes(d.id));
  assert.equal(d.archetype, src.archetype);
  if (src.log) assert.deepEqual(d.log.fields, src.log.fields);
  valid(d);
  const e = D.addField(d, 'Where bought', 'text');
  assert.ok(e.log.fields.some((f) => f.label === 'Where bought'));
  valid(e);
});

test('App Maker: "make me an app for my vinyl" and other words become a first draft, shown with what was assumed', () => {
  const v = D.fromWords('make me an app for my vinyl', taken());
  assert.equal(v.def.name, 'My Vinyl');
  assert.equal(v.def.archetype, 'log');
  assert.ok(['album', 'artist', 'year', 'condition', 'paid'].every((id) => v.def.log.fields.some((f) => f.id === id)));
  assert.ok(v.def.log.views.includes('gallery'));
  assert.ok(v.assumed.length >= 1);
  valid(v.def);
  const cases = [
    ['an app to keep my books', 'log', 'Bookshelf'],
    ['track my water, 8 glasses a day', 'log', 'Water'],
    ['a packing list for Spain: passport, charger, sun cream', 'checklist', 'Packing'],
    ['a plank timer 30 seconds on 10 seconds off 5 rounds', 'timer', 'Plank'],
    ['keep score for darts between Sam and me', 'counter', 'Darts'],
    ['flash cards for French verbs', 'deck', 'French'],
    ['a sudoku game', 'game', 'Sudoku'],
    ['make me a word search puzzle game', 'game', 'Word Search'],
    ['an app for my houseplants', 'log', 'Plants'],
    ['an app for my fishing trips', 'log', 'Fishing'],
    ['a daily habits tracker: read, stretch, no phone after ten', 'checklist', 'Habits'],
  ];
  for (const [words, arch, inName] of cases) {
    const r = D.fromWords(words, taken());
    assert.equal(r.def.archetype, arch, words);
    assert.ok(r.def.name.includes(inName), `${words} → ${r.def.name}`);
    valid(r.def);
  }
  const water = D.fromWords('track my water, 8 glasses a day', taken()).def;
  assert.equal(water.log.stats[0].goal, 8);
  assert.equal(D.fromWords('a sudoku game', taken()).def.game.kind, 'sudoku');
  const plank = D.fromWords('a plank timer 30 seconds on 10 seconds off 5 rounds', taken()).def;
  assert.equal(plank.timer.rounds, 5);
  // honest when it cannot
  const live = D.fromWords('an app with live train times', taken());
  assert.ok(live.cannot && /live/.test(live.cannot));
  assert.ok(D.fromWords('a mortgage calculator', taken()).cannot);
  // the id stays free of his own apps too
  const again = D.fromWords('make me an app for my vinyl', [...taken(), v.def.id]);
  assert.notEqual(again.def.id, v.def.id);
});
