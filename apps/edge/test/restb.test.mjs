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
  `${web}/coach/notes.ts`,
  `${web}/coach/pitch.ts`,
  `${web}/coach/onset.ts`,
  `${web}/coach/lessons.ts`,
  `${web}/coach/progress.ts`,
  `${web}/coach/skills.ts`,
  `${web}/coach/ask.ts`,
];
await build({ entryPoints: entries, bundle: true, format: 'esm', platform: 'neutral', outdir: at('./.build/restb'), outbase: at('../../..'), outExtension: { '.js': '.mjs' }, logLevel: 'warning' });
const load = (f) => import(`./.build/restb/${f}.mjs`);
const R = await load('apps/web/src/gym/chessrate');
const U = await load('apps/web/src/gym/chessuci');
const V = await load('apps/web/src/gym/chessreview');
const N = await load('apps/web/src/coach/notes');
const P = await load('apps/web/src/coach/pitch');
const O = await load('apps/web/src/coach/onset');
const Ls = await load('apps/web/src/coach/lessons');
const Pr = await load('apps/web/src/coach/progress');
const Sk = await load('apps/web/src/coach/skills');
const Ask = await load('apps/web/src/coach/ask');
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

// ---------------------------------------------------------------- 2. THE COACH

const cents = (hz, target) => 1200 * Math.log2(hz / target);

test('notes: names, frequencies and the reading of a pitch', () => {
  assert.equal(N.hzOfName('A4'), 440);
  assert.ok(Math.abs(N.hzOfName('E2') - 82.4069) < 0.001);
  assert.ok(Math.abs(N.hzOfName('C4') - 261.6256) < 0.001);
  assert.equal(N.midiFromName('C4'), 60);
  assert.equal(N.midiFromName('A♯3'), N.midiFromName('Bb3'));
  assert.equal(N.midiFromName('H4'), null);
  assert.equal(N.nameOfMidi(69), 'A4');
  assert.equal(N.nameOfMidi(40), 'E2');
  const r = N.reading(442);
  assert.equal(r.note, 'A4');
  assert.ok(r.cents > 7 && r.cents < 9, `${r.cents}`);
  // the tuner: a string within half a semitone is "the" string; in tune within 5 cents
  const g = N.TUNINGS.find((t) => t.id === 'guitar');
  const inTune = N.tunerReading(82.41, g);
  assert.equal(inTune.string, 'E2');
  assert.ok(inTune.inTune);
  assert.match(inTune.words, /^E2: in tune$/);
  const sharp = N.tunerReading(82.41 * 2 ** (20 / 1200), g);
  assert.equal(sharp.string, 'E2');
  assert.ok(!sharp.inTune && sharp.off > 15);
  assert.match(sharp.words, /20 cents sharp — loosen it a little/);
  assert.match(N.tunerReading(110 * 2 ** (-30 / 1200), g).words, /30 cents flat — tighten it a little/);
  assert.equal(N.tunerReading(440, g).string, null, 'A4 is no open string of a guitar');
  assert.equal(N.tunerReading(440, N.tuningOf('free')).note, 'A4');
  assert.equal(N.tuningOf('nonsense').id, 'guitar');
  assert.ok(N.rangeOf(N.tuningOf('bass')).minHz < 41.2);
});

test('the pitch detector reads tones made in code: A4 440 Hz, E2 82.4 Hz, a G detuned by 20 cents, at 44.1 and 48 kHz, with harmonics and noise', () => {
  for (const sr of [44100, 48000]) {
    const a4 = P.detectPitch(P.tone(440, 0.2, sr), sr);
    assert.ok(a4 && Math.abs(cents(a4.hz, 440)) < 1.5, `A4 at ${sr}: ${a4?.hz}`);
    assert.ok(a4.clarity > 0.9);
    const e2 = P.detectPitch(P.tone(82.4069, 0.2, sr, { harmonics: [0.6, 1, 0.7, 0.4] }), sr, { minHz: 60, maxHz: 400 });
    assert.ok(e2 && Math.abs(cents(e2.hz, 82.4069)) < 3, `E2 at ${sr}: ${e2?.hz}`);
    const gHz = N.hzOfName('G3') * 2 ** (20 / 1200);
    const g3 = P.detectPitch(P.tone(gHz, 0.2, sr, { noise: 0.02 }), sr);
    const rd = N.reading(g3.hz);
    assert.equal(rd.note, 'G3');
    assert.ok(Math.abs(rd.cents - 20) < 3, `G3 +20 at ${sr}: ${rd.cents}`);
  }
  // the bass's low E (41.2 Hz) with its range
  const e1 = P.detectPitch(P.tone(41.2, 0.3, 44100, { harmonics: [0.5, 1, 0.6] }), 44100, { minHz: 33, maxHz: 200 });
  assert.ok(e1 && Math.abs(cents(e1.hz, 41.2)) < 8, `E1: ${e1?.hz}`);
  // silence and noise are not pitches
  assert.equal(P.detectPitch(new Float32Array(4096), 44100), null);
  let seed = 7;
  const noise = Float32Array.from({ length: 4096 }, () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296 - 0.5) * 0.5);
  const nz = P.detectPitch(noise, 44100);
  assert.ok(nz === null || nz.clarity < 0.6, `noise: ${JSON.stringify(nz)}`);
});

/** A performance made in code: notes (name, start in seconds, seconds long, cents off) plus a steady delay. */
function perform(notes, secs, sr, { delay = 0, amp = 0.4 } = {}) {
  const out = new Float32Array(Math.floor(secs * sr));
  for (const [name, at, dur, off = 0] of notes) {
    const t = P.tone(N.hzOfName(name) * 2 ** (off / 1200), dur, sr, { amp, decay: 3, harmonics: [1, 0.5, 0.3] });
    const a = Math.floor((at + delay) * sr);
    for (let i = 0; i < t.length && a + i < out.length; i++) out[a + i] += t[i];
  }
  return out;
}

test('onsets: a strum made in code is found hit by hit, on the beat, and a held note is one onset', () => {
  const sr = 44100;
  const out = new Float32Array(6 * sr);
  const hits = [0.5, 1.0, 1.75, 2.0, 2.75, 3.5, 4.0];
  for (const t of hits) {
    // a strum: five strings a few milliseconds apart, each ringing and dying away
    for (let k = 0; k < 5; k++) {
      const tone = P.tone(82.4 * (1 + k * 0.6), 0.5, sr, { amp: 0.15, decay: 7, harmonics: [1, 0.4] });
      const a = Math.floor((t + k * 0.008) * sr);
      for (let i = 0; i < tone.length; i++) out[a + i] += tone[i];
    }
  }
  const on = O.detectOnsets(out, sr);
  assert.equal(on.length, hits.length, `onsets: ${on.map((x) => x.toFixed(2)).join(' ')}`);
  on.forEach((t, i) => assert.ok(Math.abs(t - hits[i]) < 0.03, `hit ${i}: ${t.toFixed(3)} for ${hits[i]}`));
  // a single held tone: one onset, however long
  const held = P.tone(220, 3, sr, { amp: 0.3 });
  for (let i = 0; i < 2000; i++) held[i] *= i / 2000;
  assert.equal(O.detectOnsets(held, sr).length, 1);
  assert.equal(O.detectOnsets(new Float32Array(sr), sr).length, 0, 'silence has none');
});

test('lessons: thirty of our own, ten for each of guitar, piano and voice, every note a real note, no strum pattern without eight steps', () => {
  assert.equal(Ls.LESSONS.length, 30);
  for (const inst of ['guitar', 'piano', 'voice']) {
    const l = Ls.lessonsFor(inst);
    assert.deepEqual(l.map((x) => x.n), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], inst);
  }
  assert.equal(new Set(Ls.LESSONS.map((l) => l.id)).size, 30);
  for (const l of Ls.LESSONS) {
    assert.ok(l.title && l.goal.length > 15 && l.how.length > 30, l.id);
    assert.ok(l.pass > 0 && l.pass <= 1);
    if (l.kind === 'notes') for (const n of l.notes) assert.ok(n === '-' || N.midiFromName(n) != null, `${l.id}: ${n}`);
    if (l.kind === 'strum') assert.match(l.pattern, /^[x.]{8}$/);
    if (l.kind === 'hold') assert.ok(l.hold.secs >= 3 && l.hold.tol >= 30);
    assert.ok(Ls.lessonSecs(l) > 5 && Ls.lessonSecs(l) < 40, `${l.id}: ${Ls.lessonSecs(l)} s`);
    assert.ok(Ls.stepsOf(l).length >= 1);
  }
  // each kind of lesson is there
  for (const k of ['notes', 'strum', 'hold']) assert.ok(Ls.LESSONS.some((l) => l.kind === k), k);
  // the guitar's open-string lesson asks for the six open strings, low to high
  assert.deepEqual(Ls.lessonById('guitar-1').notes, ['E2', 'A2', 'D3', 'G3', 'B3', 'E4']);
});

test('a lesson is scored on a performance made in code: right and on the click passes (the phone’s steady delay is taken out); a wrong note, a missed one and a late one are named', () => {
  const sr = 44100;
  const l = Ls.lessonById('guitar-1');
  const beat = 60 / l.bpm;
  const play = (name, k, off = 0) => [name, (4 + k) * beat + off, 0.7];
  // all six, with a steady 140 ms delay (a phone's own)
  const good = perform(l.notes.map((n, k) => play(n, k)), 11, sr, { delay: 0.14 });
  const r = Ls.scoreLesson(l, good, sr);
  assert.ok(r.passed, `${r.summary} ${r.words.join(' | ')}`);
  assert.ok(r.score >= 0.95);
  assert.ok(r.lagMs > 60 && r.lagMs < 240, `lag ${r.lagMs}`);
  assert.deepEqual(r.steps.map((s) => s.state), ['right', 'right', 'right', 'right', 'right', 'right']);
  // the fourth note is the wrong one (A instead of G), the fifth is not played at all
  const bad = perform(l.notes.map((n, k) => (k === 3 ? play('A3', k) : play(n, k))).filter((_, k) => k !== 4), 11, sr);
  const rb = Ls.scoreLesson(l, bad, sr);
  assert.equal(rb.steps[3].state, 'wrong');
  assert.equal(rb.steps[3].heard, 'A3');
  assert.equal(rb.steps[4].state, 'missed');
  assert.ok(!rb.passed && rb.score < 0.7, `${rb.summary}`);
  assert.ok(rb.words.some((w) => /Note 4 \(G3\): I heard A3 instead\./.test(w)));
  assert.ok(rb.words.some((w) => /Note 5 \(B3\): I did not hear it/.test(w)));
  // one note half a beat late is named as late, and the rest are not blamed for it
  const late = perform(l.notes.map((n, k) => play(n, k, k === 2 ? 0.55 : 0)), 11, sr);
  const rl = Ls.scoreLesson(l, late, sr);
  assert.equal(rl.steps[2].state, 'late');
  assert.equal(rl.steps.filter((s) => s.state === 'right').length, 5);
  assert.match(rl.words[0], /Note 3 \(D3\): late by about \d+ ms\./);
});

test('a voice may sing in its own octave; a piano lesson is scored the same way; a guitar lesson wants the right octave', () => {
  const sr = 44100;
  const v = Ls.lessonById('voice-3');
  const beat = 60 / v.bpm;
  // C D E D C an octave above the lesson's: any octave will do
  const sung = perform(['C5', 'D5', 'E5', 'D5', 'C5'].map((n, k) => [n, (4 + k) * beat, 0.7]), 10, sr);
  assert.ok(Ls.scoreLesson(v, sung, sr).passed);
  const pn = Ls.lessonById('piano-1');
  const played = perform(pn.notes.map((n, k) => [n, (4 + k) * (60 / pn.bpm), 0.7]), 10, sr);
  assert.ok(Ls.scoreLesson(pn, played, sr).passed);
  const g = Ls.lessonById('guitar-1');
  const up = perform(g.notes.map((n, k) => [N.nameOfMidi(N.midiFromName(n) + 12), (4 + k) * 1, 0.7]), 11, sr);
  assert.ok(!Ls.scoreLesson(g, up, sr).passed);
});

test('a strum is scored by its onsets: hits on the beat, a missed one, an extra one; a held note by its steadiness', () => {
  const sr = 44100;
  const l = Ls.lessonById('guitar-7');
  const beat = 60 / l.bpm;
  const times = [];
  for (let b = 0; b < l.bars; b++) for (let s = 0; s < 8; s++) if (l.pattern[s] === 'x') times.push((4 + b * 4 + s / 2) * beat);
  const strum = (ts, delay = 0) => {
    const out = new Float32Array(Math.floor((4 + l.bars * 4 + 1) * beat * sr));
    for (const t of ts) {
      for (let k = 0; k < 4; k++) {
        const tone = P.tone(110 * (1 + k * 0.5), 0.4, sr, { amp: 0.15, decay: 8, harmonics: [1, 0.4] });
        const a = Math.floor((t + delay + k * 0.006) * sr);
        for (let i = 0; i < tone.length && a + i < out.length; i++) out[a + i] += tone[i];
      }
    }
    return out;
  };
  const r = Ls.scoreLesson(l, strum(times, 0.1), sr);
  assert.ok(r.passed, `${r.summary} ${r.words}`);
  assert.equal(r.steps.length, times.length);
  // one hit left out, and one that was not asked for
  const odd = times.filter((_, i) => i !== 3).concat([times[1] + 0.25 * beat + 0.02]);
  const ro = Ls.scoreLesson(l, strum(odd, 0.1), sr);
  assert.ok(ro.steps.some((s) => s.state === 'missed'));
  assert.ok(ro.words.some((w) => /extra strum/.test(w)), ro.words.join(' | '));
  assert.ok(ro.score < r.score);
  // a held note: steady passes, a siren does not
  const h = Ls.lessonById('voice-1');
  const steady = P.tone(220, 5.5, sr, { amp: 0.3 });
  const padded = new Float32Array(Math.floor(8 * sr));
  padded.set(steady, Math.floor(1.5 * sr));
  assert.ok(Ls.scoreLesson(h, padded, sr).passed);
  const wander = new Float32Array(Math.floor(8 * sr));
  let ph = 0;
  for (let i = Math.floor(1.5 * sr); i < wander.length; i++) {
    const f = 220 * 2 ** (((i / sr - 1.5) * 40) / 1200); // sliding up 40 cents a second
    ph += (2 * Math.PI * f) / sr;
    wander[i] = 0.3 * Math.sin(ph);
  }
  const rw = Ls.scoreLesson(h, wander, sr);
  assert.ok(!rw.passed && rw.words.some((w) => /wandered/.test(w)), rw.words.join(' | '));
  assert.ok(!Ls.scoreLesson(h, new Float32Array(8 * sr), sr).passed);
});

test('practice: the streak, the best score, what to practise next', () => {
  assert.equal(Pr.streak([], '2026-11-01'), 0);
  assert.equal(Pr.streak(['2026-10-30', '2026-10-31', '2026-11-01'], '2026-11-01'), 3);
  assert.equal(Pr.streak(['2026-10-30', '2026-10-31'], '2026-11-01'), 2, 'yesterday still counts until the day is over');
  assert.equal(Pr.streak(['2026-10-29', '2026-10-31'], '2026-11-01'), 1);
  assert.equal(Pr.streak(['2026-10-28'], '2026-11-01'), 0);
  assert.equal(Pr.streak(['2026-02-27', '2026-02-28', '2026-03-01'], '2026-03-01'), 3, 'across a month end');
  let p = Pr.newProgress();
  assert.match(Pr.practiceWords(p, '2026-11-01'), /^Guitar: 0 of 10 passed\. Next: lesson 1, open strings, low to high \(it is the first one\)\.$/);
  p = Pr.recordLesson(p, 'guitar-1', 0.5, false, '2026-11-01');
  assert.equal(p.best['guitar-1'], 0.5);
  assert.equal(Pr.nextLesson(p, 'guitar').lesson.id, 'guitar-1');
  assert.match(Pr.nextLesson(p, 'guitar').why, /50%/);
  p = Pr.recordLesson(p, 'guitar-1', 0.9, true, '2026-11-02');
  p = Pr.recordLesson(p, 'guitar-1', 0.6, true, '2026-11-03');
  assert.equal(p.best['guitar-1'], 0.9, 'the best is kept');
  assert.equal(p.passed['guitar-1'], '2026-11-02', 'the first pass is dated');
  assert.equal(Pr.nextLesson(p, 'guitar').lesson.id, 'guitar-2');
  assert.equal(Pr.startInstrument(p), 'guitar');
  assert.match(Pr.practiceWords(p, '2026-11-03'), /^A 3-day streak\. Guitar: 1 of 10 passed\. Next: lesson 2/);
  // all ten passed: the weakest comes round again
  let all = Pr.newProgress();
  for (const l of Ls.lessonsFor('piano')) all = Pr.recordLesson(all, l.id, l.n === 6 ? 0.71 : 1, true, '2026-11-01');
  assert.equal(Pr.nextLesson(all, 'piano').lesson.n, 6);
  assert.match(Pr.nextLesson(all, 'piano').why, /all ten are passed/);
  // typing, drawing and words are practice too
  let q = Pr.recordTyping(Pr.newProgress(), 41.6, 0.97, '2026-11-01', ['q', 'z']);
  q = Pr.recordTyping(q, 38, 0.9, '2026-11-02');
  assert.equal(q.typing.best, 42);
  assert.equal(q.days.length, 2);
  q = Pr.recordWords(q, 'es', '2026-11-03', 7);
  q = Pr.recordWords(q, 'es', '2026-11-03', 5);
  assert.equal(q.words.es['2026-11-03'], 7);
  q = Pr.recordDrawing(Pr.recordDrawing(q, '2026-11-03'), '2026-11-03');
  assert.equal(q.drawn.length, 1);
  assert.deepEqual(Pr.parseProgress(JSON.parse(JSON.stringify(q))), q);
  assert.equal(Pr.parseProgress({ v: 3 }).days.length, 0);
  assert.equal(Pr.dayOf(new Date(2026, 10, 1, 23, 30).getTime()), '2026-11-01');
});

test('typing: words a minute count the letters typed right, five to a word; the weak keys are the ones he missed', () => {
  const target = 'the quick brown fox';
  const perfect = Sk.scoreTyping(target, target, 12_000);
  assert.equal(perfect.accuracy, 1);
  assert.equal(perfect.errors, 0);
  assert.equal(perfect.wpm, 19); // 19 letters in 12 seconds: 19 / 5 words in 0.2 minutes
  assert.deepEqual(perfect.weak, []);
  const typo = Sk.scoreTyping(target, 'the quack brewn fox', 12_000);
  assert.equal(typo.errors, 2);
  assert.ok(typo.accuracy < 1 && typo.wpm < perfect.wpm);
  assert.deepEqual(typo.weak.map((w) => w.key).sort(), ['i', 'o']);
  assert.match(Sk.typingWords(typo), /words a minute at 89% accuracy\. The keys to watch: /);
  assert.match(Sk.typingWords(perfect), /Every key was right\./);
  assert.equal(Sk.scoreTyping(target, '', 1000).wpm, 0);
  // a space missed is named "space"
  assert.deepEqual(Sk.scoreTyping('a b', 'axb', 1000).weak, [{ key: 'space', misses: 1 }]);
  // the next passage leans on the keys he misses
  assert.ok(Sk.pickText(0, ['z']).toLowerCase().includes('z'));
  assert.equal(Sk.pickText(3), Sk.TEXTS[3]);
  assert.ok(Sk.TEXTS.length >= 10 && Sk.TEXTS.every((t) => t.length > 40 && t.length < 130));
});

test('the drawing prompt of the day turns over; ten words a day turn over every four days; what was said back is matched ignoring accents', () => {
  const d1 = Sk.drawPrompt(20400);
  assert.deepEqual(Sk.drawPrompt(20400), d1);
  assert.notEqual(Sk.drawPrompt(20401).text, d1.text);
  assert.match(d1.text, /^Draw .+, .+\.$/);
  const seen = new Set(Array.from({ length: 30 }, (_, i) => Sk.drawPrompt(20400 + i).subject));
  assert.equal(seen.size, 30);
  for (const lang of Sk.LANGUAGES) {
    assert.equal(lang.words.length, 40, lang.id);
    assert.equal(new Set(lang.words.map((w) => w[1])).size, 40, `${lang.id}: no word twice`);
    const days = [0, 1, 2, 3].flatMap((d) => Sk.dailyWords(lang.id, 20400 + d).map((w) => w.word));
    assert.equal(new Set(days).size, 40, `${lang.id}: four days cover forty words`);
    assert.equal(Sk.dailyWords(lang.id, 5).length, 10);
    assert.deepEqual(Sk.dailyWords(lang.id, 5), Sk.dailyWords(lang.id, 9));
  }
  assert.deepEqual(Sk.dailyWords('es', 0)[0], { en: 'hello', word: 'hola' });
  assert.equal(Sk.languageOf('French').id, 'fr');
  assert.equal(Sk.languageOf('klingon').id, 'es');
  assert.equal(Sk.wordMatch('hola', 'hola'), 'right');
  assert.equal(Sk.wordMatch('Adios!', 'adiós'), 'right');
  assert.equal(Sk.wordMatch('I said manana', 'mañana'), 'right');
  assert.equal(Sk.wordMatch('what is bonjour', 'bonjour'), 'right');
  assert.equal(Sk.wordMatch('grasias', 'gracias'), 'close');
  assert.equal(Sk.wordMatch('perro', 'gato'), 'wrong');
  assert.equal(Sk.wordMatch('', 'hola'), 'wrong');
  assert.equal(Sk.wordMatch('strasse', 'Straße'), 'right');
  assert.equal(Sk.wordMatch('si', 'sí'), 'right');
  assert.equal(Sk.wordMatch('no', 'sí'), 'wrong');
});

test('the chat’s words for the coach: the tuner, the lessons, typing, drawing, words; juggling is not in, and a course on a language is left to its own', () => {
  const a = (t) => Ask.coachAsked(t);
  assert.deepEqual(a('tune my guitar'), { what: 'tuner', instrument: 'guitar' });
  assert.deepEqual(a('Can you tune my ukulele?'), { what: 'tuner', instrument: 'ukulele' });
  assert.deepEqual(a('am I in tune?'), { what: 'tuner', instrument: 'free' });
  assert.deepEqual(a('is my violin in tune'), { what: 'tuner', instrument: 'violin' });
  assert.deepEqual(a('guitar tuner'), { what: 'tuner', instrument: 'guitar' });
  assert.deepEqual(a('tuner'), { what: 'tuner', instrument: 'free' });
  assert.deepEqual(a('teach me guitar'), { what: 'lessons', instrument: 'guitar' });
  assert.deepEqual(a('I want to learn piano'), { what: 'lessons', instrument: 'piano' });
  assert.deepEqual(a('teach me to sing'), { what: 'lessons', instrument: 'voice' });
  assert.deepEqual(a('guitar lessons'), { what: 'lessons', instrument: 'guitar' });
  assert.deepEqual(a('coach me'), { what: 'lessons' });
  assert.deepEqual(a('typing test'), { what: 'typing' });
  assert.deepEqual(a('how fast do I type?'), { what: 'typing' });
  assert.deepEqual(a('what should I draw?'), { what: 'draw' });
  assert.deepEqual(a('drawing prompt'), { what: 'draw' });
  assert.deepEqual(a('Spanish word of the day'), { what: 'words', language: 'spanish' });
  assert.deepEqual(a('ten words'), { what: 'words' });
  assert.deepEqual(a('French vocab'), { what: 'words', language: 'french' });
  assert.deepEqual(a('teach me to juggle'), { what: 'juggle' });
  // not the coach's
  for (const t of ['teach me spanish', 'play the guitar solo from that song', 'what is the weather', 'I tuned in late', 'draw a bath', 'coach me through my money', 'tune the radio', '']) assert.equal(a(t), null, t);
});
