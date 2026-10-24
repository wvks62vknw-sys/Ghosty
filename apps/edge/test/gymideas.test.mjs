// The GYM's next level (docs/build-plan/BRIEF-GYM-IDEAS.md): league play against his past selves (the rating
// maths, the league's decision, real games between versions, a simulated week), puzzles he makes at the edge of
// what he can do (the controller against a simulated player, then the real maze, Sokoban and Sudoku learners
// checked by their own games' checkers), training records from checked work only (THINK HARDER and the GYM;
// none from an unchecked chain; the day's cap), and the REPORT CARD's LOOPS card's words.
// (Run from offline.test.mjs, which is in the test list; package.json is protected. The brain's side — the
// star route and the loops route — is in selftrain.test.mjs.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({
  entryPoints: ['gym/rating.ts', 'gym/league.ts', 'gym/stretch.ts', 'gym/session.ts', 'gym/index.ts', 'gym/worker.ts', 'gym/tasks.ts', 'offline/star.ts', 'offline/think.ts', 'offline/exact.ts'].map((f) => at(`../../web/src/${f}`)),
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outdir: at('./.build/gymideas'),
  outbase: at('../../web/src'),
  outExtension: { '.js': '.mjs' },
  logLevel: 'warning',
});
await build({ entryPoints: [at('../../../packages/shared/src/loops.ts'), at('../../../packages/shared/src/selftrain.ts')], bundle: true, format: 'esm', platform: 'neutral', outdir: at('./.build/gymideas/shared'), outExtension: { '.js': '.mjs' }, logLevel: 'warning' });
const load = (f) => import(`./.build/gymideas/${f}.mjs`);
const R = await load('gym/rating');
const LG = await load('gym/league');
const E = await load('gym/stretch');
const S = await load('gym/session');
const { gameById } = await load('gym/index');
const W = await load('gym/worker');
const TK = await load('gym/tasks');
const ST = await load('offline/star');
const T = await load('offline/think');
const X = await load('offline/exact');
const LP = await load('shared/loops');
const SH = await load('shared/selftrain');

const DAY = 86_400_000;
const near = (a, b, eps, what) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b}`);

// ---------------------------------------------------------------------------------------------------------
// Part 1: league play against his past selves

test('league: Elo\'s expected score and the performance rating (the rating at which the expected score is the score made)', () => {
  near(R.expected(1000, 1000), 0.5, 1e-12, 'equal ratings');
  near(R.expected(1400, 1000), 1 / (1 + 10 ** -1), 1e-12, '400 points up');
  near(R.expected(1200, 1000) + R.expected(1000, 1200), 1, 1e-12, 'the two sides add to one');
  // Half the points against one opponent: his rating. Three quarters: 400·log10(3) above.
  near(R.performance([{ opp: 1000, games: 4, score: 2 }]), 1000, 0.01, 'half the points');
  near(R.performance([{ opp: 1000, games: 4, score: 3 }]), 1000 + 400 * Math.log10(3), 0.01, 'three quarters');
  near(R.performance([{ opp: 1100, games: 4, score: 2 }, { opp: 900, games: 4, score: 2 }]), 1000, 0.01, 'half against a stronger and a weaker one');
  // A clean sweep / nothing: 400 beyond the strongest / below the weakest (no rating gives a sure win).
  assert.equal(R.performance([{ opp: 1000, games: 4, score: 4 }, { opp: 1050, games: 4, score: 4 }]), 1450);
  assert.equal(R.performance([{ opp: 1000, games: 4, score: 0 }]), 600);
  // More points, a higher rating.
  const rs = [0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((s) => R.performance([{ opp: 1000, games: 4, score: s }]));
  assert.ok(rs.every((r, i) => !i || r > rs[i - 1]), rs.join(', '));
});

test('league: the first mastered version starts it at 1,000; a new version is kept only if its rating is above his, else it is thrown away and said so; eight kept at most', () => {
  const t0 = Date.UTC(2026, 9, 1);
  let lg = R.newLeague();
  const cand = (level, at) => ({ level, at, bytes: 100, saved: { level } });
  let r = R.admit(lg, cand(1, t0), [], t0);
  assert.equal(r.verdict.kept, true);
  assert.equal(r.league.rating, 1000);
  assert.match(r.verdict.why, /^his first mastered version starts the league at 1,000$/);
  lg = r.league;
  // 3 of 4 against the Level 1 version: kept at its performance rating
  r = R.admit(lg, cand(2, t0 + DAY), [{ opp: 1000, games: 4, score: 3 }], t0 + DAY);
  assert.equal(r.verdict.kept, true);
  assert.equal(r.league.rating, 1191);
  assert.equal(r.league.versions.length, 2);
  assert.match(r.verdict.why, /^it scored 3 of 4 against his 1 past self: rating 1,191, up from 1,000$/);
  lg = r.league;
  // half the points against both: below his 1,191 — thrown away; the league is as it was (but remembers why)
  r = R.admit(lg, cand(3, t0 + 2 * DAY), [{ opp: 1000, games: 4, score: 2 }, { opp: 1191, games: 4, score: 2 }], t0 + 2 * DAY);
  assert.equal(r.verdict.kept, false);
  assert.deepEqual(r.league.versions, lg.versions);
  assert.equal(r.league.rating, 1191);
  assert.match(r.verdict.why, /^it scored 4 of 8 against his past selves: rating 1,09\d, not above his 1,191, so it was thrown away$/);
  assert.equal(r.league.verdicts.length, 3);
  // equal to his rating is not "above" it
  assert.equal(R.decide(1191, 1191), false);
  assert.equal(R.decide(1191, 1192), true);
  // the cap: the oldest goes
  for (let i = 0; i < 9; i++) lg = R.admit(lg, cand(4 + i, t0 + (3 + i) * DAY), [{ opp: lg.rating, games: 4, score: 3 }], t0 + (3 + i) * DAY).league;
  assert.equal(lg.versions.length, R.LEAGUE_CAP);
  assert.equal(lg.versions[0].level, 5, 'the oldest kept is the fifth');
  assert.ok(lg.versions.every((v, i) => !i || v.rating > lg.versions[i - 1].rating), 'every kept version rates above the one before');
});

test('league: "Rating 1,240 · up 35 this week" — the change since the rating a week ago; nothing before a version is kept', () => {
  const now = Date.UTC(2026, 9, 20);
  assert.equal(R.ratingLine(R.newLeague(), now), '');
  const lg = { ...R.newLeague(), versions: [{}], rating: 1240, history: [{ at: now - 20 * DAY, r: 1000 }, { at: now - 9 * DAY, r: 1205 }, { at: now - 2 * DAY, r: 1240 }] };
  assert.equal(R.ratingLine(lg, now), 'Rating 1,240 · up 35 this week');
  assert.equal(R.ratingLine({ ...lg, history: lg.history.slice(0, 2), rating: 1205 }, now), 'Rating 1,205 · no change this week');
  // a league begun this week counts from its start
  assert.equal(R.weekChange({ ...lg, history: [{ at: now - DAY, r: 1000 }, { at: now, r: 1061 }] }, now), 61);
  // the bytes a version takes: typed arrays at their size
  assert.equal(R.bytesOf({ game: 'x', v: new Float32Array(10), n: 3 }), 2 + 40 + 8);
  assert.equal(R.kb(78_766), '79 KB');
  // the page is never sent the frozen knowledge, and puts back what it already holds
  const big = { ...lg, versions: [{ at: 1, saved: new Float32Array(4) }, { at: 2, saved: new Float32Array(4) }] };
  const meta = R.leagueMeta(big);
  assert.ok(meta.versions.every((v) => v.saved === null));
  assert.equal(R.leagueKept(meta, big).versions[1].saved, big.versions[1].saved);
});

/** A tic-tac-toe learner after `n` training games from a fixed seed. */
const tttAfter = (n, saved) => {
  const l = gameById('tictactoe').learner(1, 5, saved && structuredClone(saved));
  if (n) l.train(n);
  return l;
};

test('league games: every board game plays real games between two versions to the end (legal moves only); a better-trained tic-tac-toe version beats its past self, an identical copy does not', () => {
  for (const id of LG.LEAGUE_IDS) {
    const g = gameById(id);
    const a = g.learner(1, 3);
    a.train(id === 'go' ? 3 : 10);
    const run = new LG.LeagueRun(g, g.learner(1, 3, structuredClone(a.save())), [{ level: 1, at: 0, rating: 1000, bytes: 0, saved: structuredClone(a.save()) }], 1, 3, 2);
    // (CPU time, not wall time: many builds share this machine, and a busy one stretches the wall clock)
    const cpu = () => {
      const u = process.cpuUsage();
      return (u.user + u.system) / 1000;
    };
    let worst = 0;
    for (;;) {
      const t = cpu();
      const done = run.step(40, cpu);
      worst = Math.max(worst, cpu() - t);
      if (done) break;
    }
    const [res] = run.results();
    assert.equal(res.games, 2, id);
    assert.ok(res.score >= 0 && res.score <= 2, id);
    assert.ok(worst < 200, `${id}: a league slice took ${worst.toFixed(0)} ms of CPU`);
  }
  const weak = tttAfter(300);
  const strong = tttAfter(5000, weak.save());
  const g = gameById('tictactoe');
  const vs = (cand, saved, rating) => {
    const run = new LG.LeagueRun(g, cand, [{ level: 1, at: 0, rating, bytes: 0, saved: structuredClone(saved) }], 2, 5);
    while (!run.step(40));
    return run.results();
  };
  const up = vs(strong, weak.save(), 1000);
  assert.ok(up[0].score > up[0].games / 2, JSON.stringify(up));
  assert.equal(R.admit({ ...R.newLeague(), versions: [{ rating: 1000 }], history: [{ at: 0, r: 1000 }] }, { level: 2, at: 1, bytes: 0, saved: null }, up, 1).verdict.kept, true);
  const same = vs(tttAfter(0, strong.save()), strong.save(), 1100);
  // (each opening once with each colour: two identical players share the points exactly)
  assert.equal(same[0].score, same[0].games / 2, `an identical copy scored ${JSON.stringify(same)}`);
  assert.equal(R.admit({ ...R.newLeague(), versions: [{ rating: 1100 }], rating: 1100, history: [{ at: 0, r: 1100 }] }, { level: 2, at: 1, bytes: 0, saved: null }, same, 1).verdict.kept, false, `an identical copy scored ${JSON.stringify(same)}`);
});

/** Drive the worker's message handler like the page does; returns what it posted. */
async function runWorker(id, rec, until, ms = 60_000) {
  const out = [];
  W.gymMessage({ gym: 'train', id, rec, epoch: 0, carry: true }, (m) => out.push(m));
  const t = Date.now();
  while (!until(out) && Date.now() - t < ms) await new Promise((r) => setTimeout(r, 25));
  W.gymMessage({ gym: 'pause' }, (m) => out.push(m));
  W.gymMessage({ gym: 'reset', id, epoch: 1 }, () => undefined);
  // (the worker's pending tick still holds this run's `post`: let it run out before the next test starts one)
  await new Promise((r) => setTimeout(r, 100));
  return out;
}

test('league in the worker: each level passed in a board game freezes that version; the next one plays it, its rating is kept or it is thrown away (and he goes back to the kept knowledge); the page is never sent the frozen knowledge', async () => {
  const out = await runWorker('tictactoe', null, (o) => o.filter((m) => m.gym === 'progress' && m.event === 'league').length >= 3);
  const verdicts = out.filter((m) => m.gym === 'progress' && m.event === 'league').map((m) => m.verdict);
  assert.ok(verdicts.length >= 3, `league decisions: ${verdicts.length}`);
  assert.equal(verdicts[0].games, 0, 'the first version only starts the league');
  assert.equal(verdicts[0].rating, 1000);
  for (const v of verdicts.slice(1)) {
    assert.ok(v.games >= R.LEAGUE_GAMES, 'it played each kept past self');
    assert.equal(v.kept, v.rating > v.before, `kept only when its rating is above his: ${JSON.stringify(v)}`);
  }
  for (const m of out.filter((x) => x.gym === 'progress')) assert.ok((m.rec.league?.versions ?? []).every((v) => v.saved === null), 'progress carries no frozen knowledge');
  const saves = out.filter((m) => m.gym === 'save' && m.rec.league?.versions.length);
  const last = saves.at(-1).rec;
  assert.ok(last.league.versions.every((v) => v.saved?.v instanceof Float32Array && v.bytes === R.bytesOf(v.saved)), 'kept versions keep their knowledge, and say what it takes');
  // frozen copies, not the live table he goes on learning in
  assert.notEqual(last.league.versions.at(-1).saved.v, last.saved.v);
  assert.ok(last.league.versions.length <= R.LEAGUE_CAP);
});

test('league: a version thrown away leaves him with the kept version\'s knowledge (a copy), at the level he is on', () => {
  const g = gameById('tictactoe');
  const s = new S.Session(g);
  const kept = tttAfter(4000).save();
  s.train(50);
  s.revert(kept);
  assert.deepEqual(Array.from(s.learner.save().v), Array.from(kept.v));
  assert.notEqual(s.learner.save().v, kept.v, 'a copy');
});

test('league: a simulated week of tic-tac-toe — a level or two a day, the league after each, the rating at the end (and every decision honest)', (t) => {
  const g = gameById('tictactoe');
  const s = new S.Session(g);
  const t0 = Date.UTC(2026, 9, 12, 8);
  let lg = R.newLeague();
  const lines = [];
  for (let d = 0; d < 7; d++) {
    // a day: training in small steps, measured after each, until two levels are passed (or the day's 1,500 games)
    let passed = 0;
    for (let k = 0; k < 30 && passed < 2 && !s.rec.mastered; k++) {
      s.train(50);
      const ev = s.measure();
      if (!ev) continue;
      passed++;
      const at = t0 + d * DAY + k * 60_000;
      const cand = { level: ev === 'mastered' ? s.rec.level : s.rec.level - 1, at, saved: structuredClone(s.learner.save()) };
      cand.bytes = R.bytesOf(cand.saved);
      let res = [];
      if (lg.versions.length) {
        const run = new LG.LeagueRun(g, s.learner, lg.versions, s.rec.level, s.rec.seed);
        while (!run.step(40));
        res = run.results();
      }
      const before = lg;
      const r = R.admit(lg, cand, res, at);
      lg = r.league;
      if (!r.verdict.kept && before.versions.length) s.revert(before.versions.at(-1).saved);
      lines.push(`day ${d + 1}: level ${cand.level} → ${r.verdict.kept ? 'kept' : 'thrown away'} (${r.verdict.rating})`);
    }
  }
  const line = R.ratingLine(lg, t0 + 7 * DAY);
  t.diagnostic(`simulated week: ${line}; ${lg.versions.length} versions kept, ${R.kb(lg.versions.reduce((a, v) => a + v.bytes, 0))} (${lg.versions[0]?.bytes} bytes each); ${lines.join('; ')}`);
  assert.match(line, /^Rating \d[\d,]* · (up \d+|no change|down \d+) this week$/);
  assert.ok(lg.versions.length >= 1 && lg.versions.length <= R.LEAGUE_CAP);
  assert.ok(lg.history.every((h, i) => !i || h.r > lg.history[i - 1].r), 'his rating only goes up when a version is kept');
  assert.ok(lg.versions.every((v) => v.bytes === 78_766), 'a tic-tac-toe version is 78,766 bytes');
});

// ---------------------------------------------------------------------------------------------------------
// Part 2: he invents his own harder puzzles

test('edge: the difficulty settles where a simulated player solves 40–60 % — whatever his ability, quick or slow to fall off', () => {
  let seed = 7;
  const r = () => ((seed = (seed * 1103515245 + 12345) % 2147483648), seed / 2147483648);
  for (const [ability, slope] of [[7.6, 0.25], [7.3, 0.15], [7.85, 0.4], [7.5, 0.1]]) {
    let e = E.newEdge(7);
    let solved = 0;
    let n = 0;
    let inBand = 0;
    let windows = 0;
    for (let i = 0; i < 1000; i++) {
      const ok = r() < 1 / (1 + Math.exp((e.x - ability) / slope));
      e = E.edgeNext(e, ok, 7);
      if (i < 100) continue;
      solved += ok ? 1 : 0;
      n++;
      if (i % 20 === 0) {
        windows++;
        const rate = E.edgeRate(e);
        if (rate >= E.EDGE_LOW && rate <= E.EDGE_HIGH) inBand++;
      }
    }
    assert.ok(solved / n >= 0.4 && solved / n <= 0.6, `ability ${ability}: solved ${(solved / n).toFixed(2)}`);
    near(e.x, ability, 0.35, `ability ${ability}: settled at`);
    assert.ok(inBand / windows >= 0.75, `ability ${ability}: last-20 windows in the band ${inBand}/${windows}`);
    assert.equal(e.tries.length, 20);
  }
  // out of reach both ways: it stays within his level and the span, and says so
  let e = E.newEdge(4);
  for (let i = 0; i < 80; i++) e = E.edgeNext(e, true, 4, 3);
  assert.equal(e.x, 6.99);
  assert.equal(E.edgeLine(e), 'Level 6¾: he solves most even at the hardest he makes · solved 20 of his last 20');
  for (let i = 0; i < 120; i++) e = E.edgeNext(e, false, 4, 3);
  assert.equal(e.x, 4);
  assert.equal(E.edgeLine(e), 'Level 4: his own level’s puzzles are still hard for him · solved 0 of his last 20');
  // a level-up starts it again at the new level's start (the totals carry on)
  const up = E.edgeNext(e, true, 5, 3);
  assert.equal(up.level, 5);
  assert.equal(up.tries.length, 1);
  assert.equal(up.n, e.n + 1);
  assert.equal(E.edgeLabel(7.5), '7½');
  assert.equal(E.edgeLabel(7.26), '7¼');
  assert.equal(E.edgeLabel(7.94), '7¾', 'never rounded up into the next level');
  assert.equal(E.edgeLabel(8.04), '8');
  near(E.between(7.5, (l) => l * 10), 75, 1e-9, 'halfway');
  near(E.between(11, (l) => 30 - l), 19, 1e-9, 'past Level 10 it goes on');
});

test('edge: the real learners — a fresh maze learner at Level 7 settles at "Level 7½: puzzles he only just fails"; Sokoban and Sudoku make puzzles above his level; every try judged by the game\'s own checker, quickly', () => {
  const s = new S.Session(gameById('maze'), { ...S.newRecord('maze'), level: 7 });
  let solved = 0;
  for (let i = 0; i < 60; i++) {
    const r = s.stretchTry();
    assert.ok(r, 'a maze puzzle is always made');
    assert.deepEqual(r.verdict, gameById('maze').check(r.problem, r.answer), 'the verdict is the game\'s checker\'s');
    solved += r.verdict.correct ? 1 : 0;
  }
  assert.equal(s.rec.edge.n, 60);
  assert.match(E.edgeLine(s.rec.edge), /^Level 7(¼|½|¾)?: puzzles he only just fails · solved (8|9|10|11|12) of his last 20$/, E.edgeLine(s.rec.edge));
  assert.ok(solved > 10 && solved < 50, `solved ${solved} of 60`);
  // the maze's puzzles are his own maze (from farther starts), so the answer is checked against that maze
  assert.equal(s.stretchTry().problem.data.seed, s.rec.seed);
  for (const [id, level, pre] of [['sokoban', 2, 0], ['sudoku', 3, 0]]) {
    const g = gameById(id);
    const ss = new S.Session(g, { ...S.newRecord(id), level });
    ss.train(pre);
    let worst = 0;
    for (let i = 0; i < 12; i++) {
      const t = process.cpuUsage();
      const r = ss.stretchTry();
      const u = process.cpuUsage(t);
      worst = Math.max(worst, (u.user + u.system) / 1000);
      if (!r) continue;
      assert.deepEqual(r.verdict, g.check(r.problem, r.answer), `${id}: the game's checker`);
      assert.ok(r.x >= level && r.x < level + 3, `${id}: at ${r.x}`);
    }
    assert.ok(worst < 200, `${id}: one try took ${worst.toFixed(0)} ms of CPU`);
    assert.ok(ss.rec.edge.n >= 10, `${id}: tries ${ss.rec.edge.n}`);
  }
  // no puzzles at the edge in a game without an exact checker for them, nor once every level is mastered
  assert.equal(new S.Session(gameById('chess')).stretchTry(), null);
  assert.equal(new S.Session(gameById('maze'), { ...S.newRecord('maze'), mastered: true, level: 10 }).stretchTry(), null);
});

// ---------------------------------------------------------------------------------------------------------
// Part 3: the search teaches the brain

test('records: THINK HARDER\'s answer becomes a star record only when an exact check passed the working it gives — never from votes, a failed check or an unchecked chain', async () => {
  const fake = (answers) => async (_m, o) => answers.shift() ?? 'ANSWER: 381';
  const calc = X.sumCheck('What is 17 × 23?');
  const ok = await T.thinkHarder('What is 17 × 23?', { gen: fake(['Step 1: 17 × 20 = 340\nStep 2: 17 × 3 = 51\nANSWER: 381', '17 × 23 = 340 + 51 = 391\nANSWER: 391']), checker: calc, steps: false, budget: { attempts: 4 } });
  assert.equal(ok.confidence, 'checked');
  const rec = ST.starFromThink('What is 17 × 23?', ok);
  assert.deepEqual(rec, { kind: 'star', messages: [{ role: 'user', content: 'What is 17 × 23?' }, { role: 'assistant', content: '17 × 23 = 340 + 51 = 391\nANSWER: 391' }], checked: calc.label, from: 'think harder' });
  assert.equal(SH.recordProblem(rec), '', 'the factory\'s own checker takes it');
  // none passed the check
  const bad = await T.thinkHarder('What is 17 × 23?', { gen: fake([]), checker: calc, steps: false, budget: { attempts: 3, agree: 2 } });
  assert.equal(bad.confidence, 'failed-check');
  assert.equal(ST.starFromThink('What is 17 × 23?', bad), null);
  // agreement alone (no exact check)
  const votes = await T.thinkHarder('How many eggs in a dozen?', { gen: async () => 'ANSWER: 12', steps: false, budget: { attempts: 6, agree: 3 } });
  assert.equal(votes.confidence, 'agree');
  assert.equal(ST.starFromThink('How many eggs in a dozen?', votes), null);
  // a "checked" result whose working is not an attempt the check passed is not trusted either
  assert.equal(ST.starFromThink('What is 17 × 23?', { ...ok, text: 'something else' }), null);
  // and the factory refuses a star record that does not say what checked it
  assert.equal(SH.recordProblem({ ...rec, checked: '' }), 'a star record needs the check that passed it');
});

test('records: a GYM puzzle he solved — the puzzle, his moves and the checker\'s verdict; a failed one makes none; at most 20 a day, the same question never twice', () => {
  assert.equal(ST.GYM_HINT, TK.ANSWER_HINT, 'the weekly run\'s own words after a GYM puzzle');
  const s = new S.Session(gameById('maze'), { ...S.newRecord('maze'), level: 2 });
  s.train(3000);
  const r = s.stretchTry();
  assert.equal(r.verdict.correct, true);
  const rec = ST.starFromGym(r.problem, r.answer, r.verdict, E.edgeLabel(r.x));
  assert.equal(rec.messages[0].content, `${r.problem.text}\n\n${TK.ANSWER_HINT}`);
  assert.equal(rec.messages[1].content, r.answer);
  assert.match(rec.checked, /^the GYM's own checker: Cheapest: cost \d+\.$/);
  assert.match(rec.from, /^gym maze level 2/);
  assert.equal(SH.recordProblem(rec), '');
  // the checker's verdict on his moves is what decides
  assert.equal(gameById('maze').check(r.problem, rec.messages[1].content).correct, true);
  assert.equal(ST.starFromGym(r.problem, r.answer, { correct: false, why: 'Cost 9; the cheapest is 7.' }, '2'), null);
  assert.equal(ST.starFromGym(r.problem, '', r.verdict, '2'), null);
  // the day's cap and no repeats
  const now = Date.UTC(2026, 9, 20, 9);
  let box = ST.newStarBox();
  const mk = (i) => ({ ...rec, messages: [{ role: 'user', content: `q${i}` }, rec.messages[1]] });
  for (let i = 0; i < 25; i++) box = ST.queueStar(box, mk(i), now).box;
  assert.equal(box.queue.length, ST.STAR_PER_DAY);
  assert.equal(box.over, 5);
  const again = ST.queueStar(ST.newStarBox(), mk(1), now);
  assert.equal(ST.queueStar(again.box, mk(1), now).added, false, 'the same question twice');
  assert.equal(ST.queueStar(box, null, now).added, false, 'nothing unchecked');
  // the next day there is room again; sent ones leave the box and are counted for the LOOPS card
  const next = ST.queueStar(box, mk(99), now + DAY);
  assert.equal(next.added, true);
  const sent = ST.sentStars(next.box, 21, now + DAY);
  assert.equal(sent.queue.length, 0);
  assert.deepEqual(ST.sentSince(sent, now), { think: 0, gym: 21 });
});

test('records: the worker hands a solved puzzle at his edge to the page as a star record (checked by the game\'s checker)', async () => {
  // A maze learner well past Level 1's bar is mastered at once: a fresh one at Level 3 trains and tries puzzles meanwhile.
  const out = await runWorker('maze', { ...S.newRecord('maze'), level: 3 }, (o) => o.some((m) => m.gym === 'star'), 30_000);
  const star = out.find((m) => m.gym === 'star');
  assert.ok(star, 'no star record from the maze within 30 s');
  assert.equal(star.id, 'maze');
  assert.equal(SH.recordProblem(star.record), '');
  assert.match(star.record.from, /^gym maze level [34]/);
  const saved = out.filter((m) => m.gym === 'save').at(-1);
  assert.ok(saved.rec.edge.n >= 1 && saved.rec.days.length === 1, 'the edge and the day\'s point are kept with the record');
});

// ---------------------------------------------------------------------------------------------------------
// Part 4: the LOOPS card

test('LOOPS: every loop on one card with what it practised, what improved (the real numbers) and what was rejected and why; ROLLBACK on the weekly brain when one is in use', () => {
  const now = Date.UTC(2026, 9, 20);
  const brain = {
    now,
    since: now - 7 * DAY,
    drills: { asked: 40, right: 30, before: { asked: 200, right: 120 } },
    study: { reads: 63, digests: 12, finished: ['astronomy'], failed: 2 },
    school: { checked: 24, waiting: 96, papers: [{ title: 'KS2 maths', pct: 0.7, at: now - DAY }], previous: 0.55, near: 3 },
    week: { week: 6, phase: 'idle', at: now - 2 * DAY, trained: { star: 40, checked: 12, gym: 100 }, before: 0.5, after: 0.54, kept: true, why: 'up 4 points on average', rejected: [{ why: 'records too close to an exam question', n: 7 }], active: 'abc1234', activeLabel: 'Week 6' },
    voice: { trained: 80, before: 0.6, after: 0.72, rejected: [{ why: 'replies the blind judge took for an AI', n: 9 }] },
    star: { taken: 14, waiting: 3, refused: [{ why: "over the day's 20", n: 1 }] },
  };
  const phone = {
    gym: { games: [{ id: 'connect4', name: 'Connect 4', units: 1200, levels: 2, rating: [1000, 1035], kept: 1, thrown: [{ level: 4, why: 'it scored 2 of 4 against his past selves: rating 990, not above his 1,035, so it was thrown away' }], tries: 0, solved: 0 }, { id: 'maze', name: 'Maze', units: 400, levels: 1, kept: 0, thrown: [], tries: 30, solved: 16 }, { id: 'chess', name: 'Chess', units: 0, levels: 0, kept: 0, thrown: [], tries: 0, solved: 0 }] },
    star: { think: 4, gym: 10, waiting: 2, over: 0 },
  };
  const rows = LP.loopRows(brain, phone);
  assert.deepEqual(rows.map((r) => r.id), ['gym', 'drills', 'school', 'study', 'week', 'voice', 'star']);
  const by = Object.fromEntries(rows.map((r) => [r.id, r]));
  assert.equal(by.gym.practised, '1,600 rounds of practice in 2 games; 30 puzzles he made at his edge');
  assert.equal(by.gym.improved, '3 levels passed (checked against ground truth); Connect 4 rating 1,000 → 1,035; solved 16 of 30 at his edge');
  assert.match(by.gym.rejected, /^Connect 4 level 4's version thrown away: it scored 2 of 4 against his past selves: rating 990/);
  assert.equal(by.drills.improved, '60% right before → 75% this week');
  assert.equal(by.school.improved, '55% before → KS2 maths 70%');
  assert.equal(by.school.rejected, '3 items too close to a question on a paper');
  assert.equal(by.study.practised, '63 pieces read, 12 notes written');
  assert.equal(by.week.improved, 'test 50% → 54%: KEPT');
  assert.equal(by.week.rejected, '7 records too close to an exam question');
  assert.equal(by.week.rollback, true);
  assert.equal(by.voice.improved, 'sounds like a person 60% → 72%');
  assert.equal(by.star.practised, '14 records sent (4 from THINK HARDER, 10 from the GYM); 2 waiting on this phone');
  assert.equal(by.star.improved, "14 records taken for the next week's run (3 waiting)");
  // nothing measured is never filled in; without the brain, its loops say so and ROLLBACK is not offered
  const off = LP.loopRows(null, { gym: { games: [] }, star: { think: 0, gym: 0, waiting: 0, over: 0 } });
  assert.equal(off.find((r) => r.id === 'gym').improved, 'not measured yet');
  assert.ok(off.filter((r) => !['gym', 'star'].includes(r.id)).every((r) => r.practised === 'the brain is not reachable' && !r.rollback));
  assert.equal(LP.loopRows({ ...brain, week: { ...brain.week, active: null } }, phone).find((r) => r.id === 'week').rollback, false);
});

test('LOOPS: a week that ran smaller because Kaggle\'s hours were short says so on the weekly run\'s row, in the brain\'s words', () => {
  const now = Date.UTC(2026, 9, 20);
  const week = { week: 7, phase: 'running', at: null, trained: {}, before: null, after: null, kept: null, why: '', rejected: [], active: null, activeLabel: 'the stock Qwen3' };
  const brain = { now, since: now - 7 * DAY, drills: { asked: 0, right: 0, before: { asked: 0, right: 0 } }, study: { reads: 0, digests: 0, finished: [], failed: 0 }, school: null, week, voice: null, star: { taken: 0, waiting: 0, refused: [] } };
  const phone = { gym: { games: [] }, star: { think: 0, gym: 0, waiting: 0, over: 0 } };
  const row = (w) => LP.loopRows({ ...brain, week: w }, phone).find((r) => r.id === 'week');
  assert.equal(row({ ...week, economy: 'Only 6 h left this week: a smaller run, the exam on the phone.' }).practised, 'week 7: running now · Only 6 h left this week: a smaller run, the exam on the phone.');
  assert.equal(row(week).practised, 'week 7: running now', 'a full run says nothing more');
});

test('LOOPS: a game\'s week from the GYM record — units and levels since the day\'s point a week ago, the league\'s rating then and now, its decisions this week, his tries at the edge', () => {
  const now = Date.UTC(2026, 9, 20, 12);
  const d = (k) => new Date(now - k * DAY).toISOString().slice(0, 10);
  const rec = {
    ...S.newRecord('connect4'),
    units: 5000,
    level: 5,
    days: [{ d: d(10), u: 100, l: 1, m: 0 }, { d: d(8), u: 1000, l: 2, m: 0, t: 3, s: 1 }, { d: d(3), u: 3000, l: 4, m: 0 }],
    league: { versions: [{}, {}], rating: 1080, history: [{ at: now - 9 * DAY, r: 1000 }, { at: now - DAY, r: 1080 }], verdicts: [{ at: now - 9 * DAY, level: 1, games: 0, kept: true, why: 'first' }, { at: now - 2 * DAY, level: 3, games: 4, kept: false, why: 'not above' }, { at: now - DAY, level: 4, games: 4, kept: true, why: 'up' }] },
    edge: { x: 5.5, level: 5, tries: [1, 0], n: 13, solved: 6 },
  };
  assert.deepEqual(S.gymWeek(rec, 'Connect 4', now), { id: 'connect4', name: 'Connect 4', units: 4000, levels: 3, rating: [1000, 1080], kept: 1, thrown: [{ level: 3, why: 'not above' }], tries: 10, solved: 5 });
  // a game first played this week counts from nothing
  assert.deepEqual(S.gymWeek({ ...S.newRecord('maze'), units: 300, level: 2, days: [{ d: d(1), u: 50, l: 1, m: 0 }] }, 'Maze', now), { id: 'maze', name: 'Maze', units: 300, levels: 1, kept: 0, thrown: [], tries: 0, solved: 0 });
  // the day's point: one a day, today's replaced, fifteen kept
  let days = [];
  for (let k = 0; k < 20; k++) days = S.noteDay(days, { units: k, level: 1, mastery: 0.5, mastered: false }, now + k * DAY);
  days = S.noteDay(days, { units: 99, level: 2, mastery: 0.5, mastered: false }, now + 19 * DAY + 3600_000);
  assert.equal(days.length, 15);
  assert.deepEqual(days.at(-1), { d: new Date(now + 19 * DAY).toISOString().slice(0, 10), u: 99, l: 2, m: 0.5, t: 0, s: 0 });
});
