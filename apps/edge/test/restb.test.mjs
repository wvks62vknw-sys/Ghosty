// BATCH 8 PART B (BRIEF-REST-B): chess with a real rating, the instrument and skills coach, the review link, deploy your own.
//  1. CHESS — Glicko-2 on Glickman's own worked example, the ladder of the engine's levels (the Elo table, its commands, its
//     range), the words of his rating and Ghosty's, the next level to try, UCI read in code, and the check after a game in
//     plain words ("move 23 lost a rook"). The engine itself runs in a browser worker (tests/restb.spec.mjs).
// Bundles are built here with esbuild's API (the files are pure), so a stale bundle can never give a false answer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
const web = at('../../web/src');
const shared = at('../../../packages/shared/src');
const entries = [
  `${web}/gym/chessrate.ts`,
  `${web}/gym/chessuci.ts`,
  `${web}/gym/chessreview.ts`,
];
await build({ entryPoints: entries, bundle: true, format: 'esm', platform: 'neutral', outdir: at('./.build/restb'), outbase: at('../../..'), outExtension: { '.js': '.mjs' }, logLevel: 'warning' });
const load = (f) => import(`./.build/restb/${f}.mjs`);
const R = await load('apps/web/src/gym/chessrate');
const U = await load('apps/web/src/gym/chessuci');
const V = await load('apps/web/src/gym/chessreview');
void shared;

// ---------------------------------------------------------------- 1. CHESS

test('Glicko-2 reproduces Glickman’s worked example (2013): 1500/200/0.06 against three opponents gives 1464.06, 151.52, 0.05999', () => {
  const g = R.glicko2({ r: 1500, rd: 200, vol: 0.06 }, [{ r: 1400, rd: 30, s: 1 }, { r: 1550, rd: 100, s: 0 }, { r: 1700, rd: 300, s: 0 }], 0.5);
  assert.ok(Math.abs(g.r - 1464.06) < 0.05, `rating ${g.r}`);
  assert.ok(Math.abs(g.rd - 151.52) < 0.05, `rd ${g.rd}`);
  assert.ok(Math.abs(g.vol - 0.05999) < 0.0001, `vol ${g.vol}`);
});

test('Glicko-2: a period with no games only widens the deviation; a win lifts, a loss lowers, a draw against an equal holds', () => {
  const idle = R.glicko2({ r: 1400, rd: 80, vol: 0.06 }, []);
  assert.equal(idle.r, 1400);
  assert.ok(idle.rd > 80 && idle.rd < 90);
  const p = { r: 1500, rd: 120, vol: 0.06 };
  assert.ok(R.glicko2(p, [{ r: 1500, rd: 60, s: 1 }]).r > 1500);
  assert.ok(R.glicko2(p, [{ r: 1500, rd: 60, s: 0 }]).r < 1500);
  assert.ok(Math.abs(R.glicko2(p, [{ r: 1500, rd: 60, s: 0.5 }]).r - 1500) < 0.01);
  // every game narrows the deviation
  assert.ok(R.glicko2(p, [{ r: 1500, rd: 60, s: 1 }]).rd < 120);
});

test('the engine’s ladder: ten levels, weakest first, the published UCI_Elo labels, a starter that says it is an estimate', () => {
  assert.equal(R.LEVELS.length, 10);
  assert.deepEqual(R.LEVELS.map((l) => l.id), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  for (let i = 1; i < R.LEVELS.length; i++) assert.ok(R.LEVELS[i].elo > R.LEVELS[i - 1].elo, `level ${i + 1} is stronger`);
  const uci = R.LEVELS.filter((l) => l.kind === 'uci');
  assert.equal(uci.length, 9);
  for (const l of uci) assert.ok(l.elo >= R.UCI_MIN && l.elo <= R.UCI_MAX, `${l.elo} is inside the engine's range`);
  assert.equal(uci[0].elo, 1320);
  assert.equal(uci.at(-1).elo, 3190);
  assert.equal(R.LEVELS[0].kind, 'starter');
  assert.match(R.levelWords(R.LEVELS[0]), /my estimate/);
  assert.doesNotMatch(R.levelWords(R.LEVELS[3]), /estimate/);
  assert.match(R.levelWords(R.LEVELS[3]), /^Level 4 · Club · about 1,?700$/);
  // Stockfish's own mapping from an Elo to its Skill Level: 0 at the bottom, under 19 at the top, never falling as Elo rises
  assert.equal(R.skillFor(1320), 0);
  assert.ok(R.skillFor(3190) > 18 && R.skillFor(3190) <= 19);
  for (let e = 1320; e < 3190; e += 70) assert.ok(R.skillFor(e + 70) >= R.skillFor(e), `skill never falls at ${e}`);
  // the time it thinks never falls either
  for (let i = 1; i < R.LEVELS.length; i++) assert.ok(R.LEVELS[i].movetime >= R.LEVELS[i - 1].movetime);
});

test('the commands that set a level: UCI_LimitStrength and UCI_Elo, clamped to the range the engine reports; the starter uses Skill Level 0 and one move of search', () => {
  assert.deepEqual(U.levelCommands(R.levelById(3)), ['setoption name UCI_LimitStrength value true', 'setoption name UCI_Elo value 1500']);
  assert.deepEqual(U.levelCommands(R.levelById(2), { min: 1350, max: 2850 }), ['setoption name UCI_LimitStrength value true', 'setoption name UCI_Elo value 1350']);
  assert.deepEqual(U.levelCommands(R.levelById(10), { min: 1320, max: 2850 }), ['setoption name UCI_LimitStrength value true', 'setoption name UCI_Elo value 2850']);
  assert.deepEqual(U.levelCommands(R.levelById(1)), ['setoption name UCI_LimitStrength value false', 'setoption name Skill Level value 0']);
  assert.equal(U.goFor(R.levelById(1)), 'go depth 1');
  assert.equal(U.goFor(R.levelById(4)), 'go movetime 250');
  assert.ok(U.FULL_STRENGTH.includes('setoption name UCI_LimitStrength value false'));
});

test('UCI read in code: options, info lines (centipawns, mate, the best line), best moves', () => {
  assert.deepEqual(U.parseOption('option name UCI_Elo type spin default 1320 min 1320 max 3190'), { name: 'UCI_Elo', type: 'spin', def: '1320', min: 1320, max: 3190 });
  assert.deepEqual(U.parseOption('option name Skill Level type spin default 20 min 0 max 20'), { name: 'Skill Level', type: 'spin', def: '20', min: 0, max: 20 });
  assert.equal(U.parseOption('option name UCI_LimitStrength type check default false').type, 'check');
  assert.equal(U.parseOption('uciok'), null);
  assert.deepEqual(U.parseInfo('info depth 12 seldepth 16 multipv 1 score cp 34 nodes 90000 nps 450000 time 200 pv e2e4 e7e5 g1f3'), { depth: 12, cp: 34, nps: 450000, pv: ['e2e4', 'e7e5', 'g1f3'] });
  assert.deepEqual(U.parseInfo('info depth 9 score mate -3 pv h7h8q'), { depth: 9, mate: -3, pv: ['h7h8q'] });
  assert.equal(U.parseInfo('info string NNUE evaluation using nn-61e7af4bb97d.nnue'), null);
  assert.deepEqual(U.parseBestmove('bestmove e2e4 ponder e7e5'), { move: 'e2e4', ponder: 'e7e5' });
  assert.deepEqual(U.parseBestmove('bestmove g1f3'), { move: 'g1f3' });
  assert.equal(U.parseBestmove('bestmove (none)'), null);
  // a mate outweighs any material, and a nearer one more than a far one
  assert.ok(U.toCp({ mate: 2 }) > U.toCp({ mate: 6 }));
  assert.ok(U.toCp({ mate: 2 }) > 1500 && U.toCp({ mate: -2 }) < -1500);
  assert.equal(U.toCp({ mate: 0 }), -3000);
  assert.equal(U.toCp({ cp: 120 }), 120);
});

test('a new player starts at 1200 with a deviation of 350; a game moves the rating and narrows it; the words say "about" and how unsure', () => {
  let b = R.newBook();
  assert.equal(b.you.r, 1200);
  assert.equal(b.you.rd, 350);
  assert.equal(R.ratingWords(b), 'Not rated yet');
  const t0 = Date.UTC(2026, 10, 1, 12);
  b = R.recordGame(b, 'you', 2, 1, t0, 40);
  assert.ok(b.you.r > 1200 && b.you.rd < 350);
  assert.equal(b.you.games, 1);
  assert.match(R.ratingWords(b), /^You: about [\d,]+ · ±\d+$/);
  assert.doesNotMatch(R.ratingWords(b), /Me:/);
  b = R.recordGame(b, 'me', 1, 0, t0 + 1000);
  assert.ok(b.me.r < 1200);
  assert.match(R.ratingWords(b), /^You: about [\d,]+ · Me: about [\d,]+ · ±\d+$/);
  // the ± is the larger of the two uncertainties, to the nearest ten
  const rd = Math.max(b.you.rd, b.me.rd);
  assert.ok(R.ratingWords(b).endsWith(`±${Math.round(rd / 10) * 10}`));
  // the log is capped at forty games and the history at sixty points
  let many = R.newBook();
  for (let i = 0; i < 70; i++) many = R.recordGame(many, 'you', 3, i % 2, t0 + i);
  assert.equal(many.log.length, 40);
  assert.equal(many.you.history.length, 60);
  assert.equal(many.you.games, 70);
});

test('results against stronger engines lift a rating higher; beating the whole ladder in turn climbs, losing to it all sinks', () => {
  const t0 = Date.UTC(2026, 10, 1);
  let up = R.newBook();
  for (let i = 0; i < 12; i++) up = R.recordGame(up, 'you', Math.min(10, 2 + Math.floor(i / 2)), 1, t0 + i);
  let down = R.newBook();
  for (let i = 0; i < 12; i++) down = R.recordGame(down, 'you', 4, 0, t0 + i);
  assert.ok(up.you.r > 1800, `${up.you.r}`);
  assert.ok(down.you.r < 1100, `${down.you.r}`); // twelve straight losses to a 1700: down from 1200, and still sinking
  assert.ok(up.you.rd < 150);
});

test('the trend and the next level to try: nearest his rating, a rung up after winning, a rung down after two losses', () => {
  const week = 7 * 86_400_000;
  const now = Date.UTC(2026, 10, 8);
  let b = R.newBook();
  assert.equal(R.trendWords(b.you, now), '');
  assert.equal(R.suggestLevel(b).id, 2, 'a new player is nearest 1320');
  b = R.recordGame(b, 'you', 2, 1, now - week - 1000);
  b = R.recordGame(b, 'you', 2, 1, now - 1000);
  assert.match(R.trendWords(b.you, now), /^up \d+ this week$/);
  assert.match(R.nextWords(b, now), /^Up \d+ this week\. Next to try: Level \d · /);
  // two wins in a row at the level nearest him: the next rung
  let w = R.newBook();
  w = R.recordGame(w, 'you', 2, 1, now);
  w = R.recordGame(w, 'you', 2, 1, now + 1);
  const near = R.nearestLevel(w.you.r).id;
  w = R.recordGame(w, 'you', near, 1, now + 2);
  w = R.recordGame(w, 'you', near, 1, now + 3);
  assert.equal(R.suggestLevel(w).id, Math.min(10, near + 1));
  // two losses in a row: a rung down
  let l = R.newBook();
  l = R.recordGame(l, 'you', 5, 0, now);
  l = R.recordGame(l, 'you', 5, 0, now + 1);
  const n2 = R.nearestLevel(l.you.r).id;
  assert.ok(R.suggestLevel(l).id <= n2);
  assert.equal(R.nearestLevel(1500).id, 3);
  assert.equal(R.nearestLevel(2900).id, 9);
  assert.equal(R.nearestLevel(3000).id, 10);
  assert.equal(R.levelById(0).id, 1);
  assert.equal(R.levelById(99).id, 10);
});

test('the chat’s words for the rating are caught, and answered in plain words that say they are approximate', () => {
  for (const t of ['what is my chess rating', 'What\'s my elo', 'how is my chess elo', 'rated chess', 'play rated chess', 'what\'s your chess rating']) assert.ok(R.ratingAsked(t), t);
  for (const t of ['play chess', 'what is the rating of this film', 'tell me about chess history', 'rate this song']) assert.ok(!R.ratingAsked(t), t);
  const none = R.ratingReply(R.newBook(), Date.now());
  assert.match(none, /RATED GAME/);
  assert.match(none, /approximate/);
  let b = R.newBook();
  b = R.recordGame(b, 'you', 3, 1, Date.now());
  b = R.recordGame(b, 'me', 2, 0.5, Date.now());
  const both = R.ratingReply(b, Date.now());
  assert.match(both, /yours is about [\d,]+ after 1 game/);
  assert.match(both, /mine is about [\d,]+ after 1/);
  assert.match(both, /Glicko-2/);
  assert.match(both, /Stockfish's approximate Elo/);
});

test('the book is read back safely: anything that is not a book is a new book', () => {
  assert.equal(R.parseBook(null).you.games, 0);
  assert.equal(R.parseBook({ v: 2 }).me.r, 1200);
  assert.equal(R.parseBook('nonsense').log.length, 0);
  const b = R.recordGame(R.newBook(), 'you', 4, 1, 1);
  assert.deepEqual(R.parseBook(JSON.parse(JSON.stringify(b))), b);
});

test('the check after a game in plain words: "move 23 lost a rook", a missed mate, a walk into one, a win thrown away, a clean game', () => {
  // 40 plies of a game; White (even plies) loses about a rook on its 23rd move (ply index 44 is beyond, so build 50 plies)
  const sans = Array.from({ length: 50 }, (_, i) => (i === 44 ? 'Nxe5' : `m${i}`));
  // scores for the side to move; everything level except the swing after ply index 44
  const scores = Array.from({ length: 51 }, () => ({ cp: 20 }));
  // before White's 23rd move (index 44): +30 for White; after it, Black (to move) sees +500
  scores[44] = { cp: 30 };
  scores[45] = { cp: 500 };
  const moments = V.reviewGame(sans, scores);
  assert.equal(moments.length, 50);
  const m = moments[44];
  assert.equal(m.number, '23');
  assert.equal(m.words, 'lost a rook');
  assert.equal(V.momentLine(m), 'Move 23 (Nxe5) lost a rook.');
  assert.equal(m.kind, 'blunder');
  const r = V.reviewWords(moments, true);
  assert.match(r.summary, /move 23 \(Nxe5\) lost a rook/);
  assert.ok(r.lines.includes('Move 23 (Nxe5) lost a rook.'));
  // black's moves are not his: the same swing against Black is named for Black ("12…")
  const bs = V.reviewGame(['e4', 'e5', 'Qh5', 'Qh4'], [{ cp: 20 }, { cp: -20 }, { cp: 20 }, { cp: 20 }, { cp: 900 }]);
  assert.equal(bs[3].number, '2…');
  assert.equal(bs[3].words, 'lost a queen');
  // a mate missed, a mate walked into, a win thrown away
  assert.equal(V.reviewGame(['a'], [{ mate: 2 }, { cp: 0 }])[0].words, 'missed a mate in 2');
  assert.equal(V.reviewGame(['a'], [{ cp: 10 }, { mate: 3 }])[0].words, 'allowed a mate in 3');
  assert.equal(V.reviewGame(['a'], [{ cp: 450 }, { cp: 20 }])[0].words, 'threw away a winning position');
  // a clean game has nothing to name
  const clean = V.reviewGame(['e4', 'e5'], [{ cp: 30 }, { cp: -28 }, { cp: 25 }]);
  assert.ok(clean.every((x) => x.kind === 'fine' && x.words === ''));
  assert.match(V.reviewWords(clean, true).summary, /clean game/);
  // the size words
  assert.equal(V.lostWords(1000), 'lost a queen');
  assert.equal(V.lostWords(300), 'lost a piece');
  assert.equal(V.lostWords(150), 'lost a pawn');
  assert.equal(V.lostWords(70), 'gave up some ground');
  assert.equal(V.lostWords(10), '');
});

test('the hint and the standing in words', () => {
  assert.equal(V.hintWords('Nf3', { cp: 120 }), 'Try Nf3: it keeps you about a pawn ahead.');
  assert.equal(V.hintWords('Qxf7#', { mate: 1 }), 'Try Qxf7#: it leads to a forced mate in 1.');
  assert.match(V.hintWords('Kg1', { cp: -60 }), /^Try Kg1: it keeps the position about level\.$/);
  assert.match(V.hintWords('Kg1', { mate: -2 }), /best defence/);
  assert.equal(V.standingWords({ cp: 40 }), 'the game is about level');
  assert.equal(V.standingWords({ cp: 520 }), 'you are a rook ahead');
  assert.equal(V.standingWords({ cp: -950 }), 'you are a queen behind');
  assert.equal(V.standingWords({ mate: -2 }), 'the engine has a forced mate in 2');
});
