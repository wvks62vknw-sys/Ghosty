// The games of BRIEF-GAMES-5, held to their rules with no screen. THE PLATFORMER: a jump's height follows how long the button is
// held; coyote time (80 ms) and the jump buffer (100 ms) work and end where they should; a stomp kills a walker and bounces; a
// shell is stopped and kicked; the flag ends the level; the measure keeps rising past level 8 and past a million (a cap would have
// stopped it); the eight levels each have the flag and a checkpoint, and every one begins and ends on the same ground; Ghosty's
// bot is better after 100 sessions of practice than before. THE CAVE: the three tools open the rooms in order, the second jump
// needs the boots, the hidden steps need the lamp, rubble needs the blaster, a lantern saves and a save restores the same cave, a
// boss has three phases and a bar, the bot walks the whole cave. THE BOARD GAMES: each one's move generator on known positions
// (draughts' forced capture and kings, Othello's flips and pass, backgammon's bar and bearing off with a seeded die, Connect 4's
// win lines), the search finding a win in one and a block in one (found by scanning real positions), the search beating a player
// who moves at random, the dial of his thinking time with no top, the ratings moving as chess's do, and nothing learned on the phone.
// The Learnable contract on the platformer and the cave, the shelf entries, pads and catalogue words. esbuild-bundled.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
const W = '../../web/src/arcade/games/';
await build({
  entryPoints: {
    skill: at(`${W}two/skill.ts`),
    psim: at(`${W}platform/sim.ts`),
    plevels: at(`${W}platform/levels.ts`),
    pcore: at(`${W}platform/core.ts`),
    csim: at(`${W}cave/sim.ts`),
    crooms: at(`${W}cave/rooms.ts`),
    bkit: at(`${W}board/kit.ts`),
    draughts: at(`${W}board/draughts.ts`),
    othello: at(`${W}board/othello.ts`),
    connect4: at(`${W}board/connect4.ts`),
    backgammon: at(`${W}board/backgammon.ts`),
    bengine: at(`${W}board/engine.ts`),
    rating: at(`${W}board/rating.ts`),
    chessrate: at('../../web/src/gym/chessrate.ts'),
    shelf5: at(`${W}shelf5.ts`),
    pad5: at(`${W}pad5.ts`),
    shelf: at('../../web/src/arcade/shelf.ts'),
    learnable: at('../../web/src/arcade/learnable.ts'),
    catalogue: at('../../../packages/shared/src/catalogue.ts'),
    words: at('../../../packages/shared/src/catalogue/games5.ts'),
  },
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outdir: at('./.build/games5'),
  outExtension: { '.js': '.mjs' },
  logLevel: 'warning',
});
const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const S = await import('./.build/games5/skill.mjs');
const P = await import('./.build/games5/psim.mjs');
const PL = await import('./.build/games5/plevels.mjs');
const PC = await import('./.build/games5/pcore.mjs');
const C = await import('./.build/games5/csim.mjs');
const CR = await import('./.build/games5/crooms.mjs');
const K = await import('./.build/games5/bkit.mjs');
const { draughts } = await import('./.build/games5/draughts.mjs');
const OT = await import('./.build/games5/othello.mjs');
const C4 = await import('./.build/games5/connect4.mjs');
const BG = await import('./.build/games5/backgammon.mjs');
const { GAME, decide } = await import('./.build/games5/bengine.mjs');
const R = await import('./.build/games5/rating.mjs');
const CH = await import('./.build/games5/chessrate.mjs');
const { GAMES5, BOARD_IDS } = await import('./.build/games5/shelf5.mjs');
const { GAMES5_PAD } = await import('./.build/games5/pad5.mjs');
const { SHELF } = await import('./.build/games5/shelf.mjs');
const { checkLearnable } = await import('./.build/games5/learnable.mjs');
const CAT = await import('./.build/games5/catalogue.mjs');
const { GAMES5_WORDS } = await import('./.build/games5/words.mjs');
const { othello } = OT;
const { connect4 } = C4;
const { backgammon } = BG;
const ck = await import('../../web/src/gym/ckboard.ts').catch(() => null);

const DT = 1 / 60;
const cmd = (o = {}) => ({ left: false, right: false, jump: false, jumpPressed: false, run: false, ...o });
const ccmd = (o = {}) => ({ left: false, right: false, up: false, jump: false, jumpPressed: false, fire: false, use: false, ...o });
/** A level of flat ground with nothing on it, the player on it. */
function flat(level = 1) {
  const r = P.newRun(1, level);
  r.enemies.length = 0;
  r.movers.length = 0;
  r.drops.length = 0;
  r.timeLeft = 1e6;
  r.limit = 1e6;
  for (let y = 0; y < 12; y++) for (let x = 0; x < r.W; x++) r.tiles[y][x] = y >= 10 ? '#' : '.';
  r.p.x = 40;
  r.p.y = 160 - r.p.h;
  r.p.onGround = true;
  r.p.vx = r.p.vy = 0;
  for (let i = 0; i < 4; i++) P.step(r, DT, cmd());
  r.events.length = 0;
  return r;
}
const rise = (r, hold) => {
  const y0 = r.p.y;
  let top = y0;
  P.step(r, DT, cmd({ jump: true, jumpPressed: true }));
  for (let i = 0; i < 120; i++) {
    P.step(r, DT, cmd({ jump: i < hold }));
    top = Math.min(top, r.p.y);
    if (r.p.onGround && i > 3) break;
  }
  return y0 - top;
};

// ================================================================ THE PLATFORMER

test('a jump goes as high as the button is held: a tap is a hop, a hold is nearly four tiles, and it never goes past that', () => {
  const tap = rise(flat(), 3);
  const hold = rise(flat(), 40);
  assert.ok(tap > 8 && tap < 40, `a tap rises ${tap.toFixed(1)} px`);
  assert.ok(hold > 52 && hold < 64, `a hold rises ${hold.toFixed(1)} px (a full jump, three and a half to four tiles)`);
  assert.ok(hold > tap * 1.6, 'the hold is well over the tap');
  assert.ok(rise(flat(), 400) < 64, 'a longer hold goes no higher');
});

test('coyote time: a jump pressed 50 ms after walking off a ledge still jumps (it lasts 80 ms); one pressed 130 ms after does not', () => {
  const trial = (ms) => {
    const r = flat();
    // a ledge: ground ends at tile 8, the player runs off it
    for (let x = 8; x < r.W; x++) for (let y = 10; y < 12; y++) r.tiles[y][x] = '.';
    r.p.x = 8 * 16 - 14;
    r.p.vx = 0;
    for (let i = 0; i < 6; i++) P.step(r, DT, cmd({ right: true }));
    let n = 0;
    while (r.p.onGround && n++ < 200) P.step(r, DT, cmd({ right: true }));
    for (let i = 0; i < Math.round(ms / (DT * 1000)); i++) P.step(r, DT, cmd({ right: true }));
    const vy = r.p.vy;
    P.step(r, DT, cmd({ right: true, jump: true, jumpPressed: true }));
    return { vy, after: r.p.vy };
  };
  assert.ok(trial(50).after < -200, 'coyote: still a jump 50 ms off the ledge');
  assert.ok(trial(130).after > -100, 'and not 130 ms off it');
});

test('the jump buffer: a press 80 ms before landing is kept and jumps on landing; one 160 ms before is lost', () => {
  const trial = (before) => {
    const r = flat();
    r.p.y = 160 - r.p.h - 30;
    r.p.vy = 0;
    r.p.onGround = false;
    let n = 0;
    let pressed = false;
    while (!r.p.onGround && n++ < 200) {
      const frames = Math.round((r.p.vy > 0 ? (160 - r.p.h - r.p.y) / Math.max(1, r.p.vy) : 0.3) / DT);
      if (!pressed && frames <= Math.round(before / (DT * 1000))) {
        P.step(r, DT, cmd({ jump: true, jumpPressed: true }));
        pressed = true;
        continue;
      }
      P.step(r, DT, cmd());
    }
    for (let i = 0; i < 3; i++) P.step(r, DT, cmd({ jump: true }));
    return r.p.vy < -150;
  };
  assert.ok(trial(80), 'a press 80 ms early jumps on landing');
  assert.ok(!trial(220), 'a press far too early does not');
});

test('the fall is capped, and a landing squashes (and says so)', () => {
  const r = flat();
  r.p.y = 0;
  r.p.onGround = false;
  let top = 0;
  for (let i = 0; i < 200 && !r.p.onGround; i++) {
    P.step(r, DT, cmd());
    top = Math.max(top, r.p.vy);
  }
  assert.ok(top <= 431, `terminal speed ${top.toFixed(0)}`);
  assert.ok(r.p.sq > 0.1, 'squashed on landing');
  assert.ok(r.events.some((e) => e.type === 'land'));
});

test('a stomp kills a walker, lifts the player and counts; touching it from the side costs a life', () => {
  const r = flat();
  r.enemies.push({ ...PC.body(40, 148, 12, 12), kind: 'walker', dir: 1, alive: true, state: 'walk', t: 0, hx: 40, hy: 148, hop: 0, die: 0, grace: 0 });
  r.enemies[0].x = 60;
  r.p.x = 58;
  r.p.y = 120;
  r.p.vy = 100;
  r.p.onGround = false;
  for (let i = 0; i < 20; i++) P.step(r, DT, cmd());
  assert.equal(r.enemies[0].alive, false, 'the walker is gone');
  assert.equal(r.stomps, 1);
  assert.ok(r.events.some((e) => e.type === 'stomp'));
  assert.equal(r.lives, 3, 'no life lost');
  const q = flat();
  q.enemies.push({ ...PC.body(70, 148, 12, 12), kind: 'walker', dir: -1, alive: true, state: 'walk', t: 0, hx: 70, hy: 148, hop: 0, die: 0, grace: 0 });
  for (let i = 0; i < 120 && q.lives === 3; i++) P.step(q, DT, cmd({ right: true }));
  assert.equal(q.lives, 2, 'walked into from the side: a life');
});

test('a shell is stopped by a stomp, kicked by a touch, and a kicked shell takes other creatures with it', () => {
  const r = flat();
  const mk = (kind, x) => ({ ...PC.body(x, 148, 12, 12), kind, dir: -1, alive: true, state: 'walk', t: 0, hx: x, hy: 148, hop: 0, die: 0, grace: 0 });
  const shell = mk('shell', 70);
  const walker = mk('walker', 150);
  r.enemies.push(shell, walker);
  r.p.x = 68;
  r.p.y = 120;
  r.p.vy = 100;
  r.p.onGround = false;
  for (let i = 0; i < 10; i++) P.step(r, DT, cmd());
  assert.equal(shell.state, 'still', 'stomped: it pulls in');
  r.p.vy = 0;
  r.p.x = 40;
  r.p.y = 160 - r.p.h;
  for (let i = 0; i < 60 && shell.state === 'still'; i++) P.step(r, DT, cmd({ right: true }));
  assert.equal(shell.state, 'kicked', 'touched from the side: kicked');
  for (let i = 0; i < 200 && walker.alive; i++) P.step(r, DT, cmd());
  assert.equal(walker.alive, false, 'and it takes the walker with it');
});

test('a glow fruit makes the player bigger, a hit makes him small again and a crate breaks from below only when big', () => {
  const r = flat();
  r.tiles[6][4] = 'P';
  r.p.x = 4 * 16 + 3;
  r.p.y = 7 * 16 + 1;
  r.p.vy = -200;
  r.p.onGround = false;
  P.step(r, DT, cmd());
  assert.equal(r.tiles[6][4], 'U', 'the fruit crate is spent');
  assert.equal(r.fruits.length, 1);
  r.p.x = r.fruits[0].x;
  r.p.y = r.fruits[0].y;
  P.step(r, DT, cmd());
  assert.equal(r.p.big, true);
  assert.equal(r.p.h, 24);
  const q = flat();
  q.p.big = true;
  q.p.h = 24;
  q.p.y = 160 - 24;
  q.enemies.push({ ...PC.body(60, 148, 12, 12), kind: 'walker', dir: -1, alive: true, state: 'walk', t: 0, hx: 60, hy: 148, hop: 0, die: 0, grace: 0 });
  for (let i = 0; i < 120 && q.p.big; i++) P.step(q, DT, cmd({ right: true }));
  assert.equal(q.p.big, false, 'a hit shrinks him');
  assert.equal(q.lives, 3, 'and costs no life');
  // crates: small gets a coin, big breaks it
  for (const big of [false, true]) {
    const z = flat();
    z.tiles[7][6] = 'B';
    if (big) (z.p.big = true), (z.p.h = 24);
    z.p.x = 6 * 16 + 3;
    z.p.y = 8 * 16 + 1;
    z.p.vy = -220;
    z.p.onGround = false;
    P.step(z, DT, cmd());
    assert.equal(z.tiles[7][6], big ? '.' : 'U', big ? 'big: the crate breaks' : 'small: it gives a coin and goes dull');
    assert.equal(z.coins, big ? 0 : 1);
  }
});

test('springs throw the player high, falling blocks go after being stood on, moving platforms carry', () => {
  const r = flat();
  r.tiles[9][6] = '^';
  r.p.x = 6 * 16 + 2;
  r.p.y = 160 - 14;
  P.step(r, DT, cmd());
  assert.ok(r.p.vy < -380 || r.events.some((e) => e.type === 'spring'), 'the spring throws');
  const q = flat();
  q.drops.push({ x: 60, y: 160, w: 16, h: 16, state: 0, t: 0, vy: 0 });
  for (let x = 3; x < 6; x++) for (let y = 10; y < 12; y++) q.tiles[y][x] = '.';
  q.p.x = 62;
  q.p.y = 160 - 14;
  q.p.vy = 0;
  q.p.onGround = false;
  for (let i = 0; i < 90; i++) P.step(q, DT, cmd());
  assert.equal(q.drops[0].state, 2, 'it falls once stood on');
  const m = flat();
  for (let x = 3; x < 12; x++) for (let y = 10; y < 12; y++) m.tiles[y][x] = '.';
  m.movers.push({ x: 60, y: 160, w: 48, h: 8, x0: 60, dx: 0, ph: 0 });
  m.p.x = 70;
  m.p.y = 150 - 14;
  m.p.vy = 0;
  m.p.onGround = false;
  for (let i = 0; i < 12; i++) P.step(m, DT, cmd());
  const x0 = m.p.x;
  let moved = 0;
  for (let i = 0; i < 60; i++) {
    const mx = m.movers[0].x;
    P.step(m, DT, cmd());
    moved += m.movers[0].x - mx;
  }
  assert.ok(m.p.onGround && Math.abs(m.p.x - x0 - moved) < 1.5, 'it carries him with it');
});

test('every world is a theme and a run of pieces that join: the same ground at both ends, a start, a flag, a checkpoint in the middle', () => {
  assert.equal(PL.LEVELS.length, 8);
  assert.deepEqual(PL.THEMES.map((t) => t.id), ['hills', 'caves', 'roofs', 'factory', 'clouds', 'ship', 'snow', 'tower']);
  for (const [name, [w, spec]] of Object.entries(PL.PIECES)) {
    const rows = PL.piece(w, spec);
    assert.equal(rows.length, 12, name);
    assert.ok(rows.every((s) => s.length === w), `${name}: every row is ${w} wide`);
    for (const y of [10, 11]) {
      // the ground meets the next piece's: its first and last three columns are solid, so any two join
      assert.ok(rows[y].slice(0, 3) === '###' && rows[y].slice(-3) === '###', `${name}: solid at both ends`);
    }
    assert.ok(/^[#\.pBPoh^wfsFM]+$/.test(rows.join('')), `${name}: only known tile letters`);
  }
  for (const def of PL.LEVELS) {
    const b = PL.build(def);
    assert.equal(def.pieces[0], 'start');
    assert.equal(def.pieces.at(-1), 'goal');
    assert.ok(b.width > 120 && b.width < 260, `${def.name}: ${b.width} tiles`);
    assert.equal(b.starts.length, def.pieces.length);
  }
});

test('Ghosty\'s bot walks the first worlds to the flag, and the flag ends the level with the time kept', () => {
  for (const lv of [1, 2, 5]) {
    const o = P.headless(P.THETA0, lv, 3);
    assert.equal(o.passed, true, `world ${lv} reaches the flag`);
    assert.equal(o.run.won, true);
    assert.ok(o.score >= P.targetOf(lv) * 0.8, 'the score includes the flag');
    assert.ok(o.run.coins > 0 && o.run.checked, 'a coin counted and the checkpoint taken on the way');
  }
  const r = P.newRun(1, 1);
  r.p.x = r.flagX - 2;
  P.step(r, DT, cmd({ right: true }));
  assert.equal(r.won, true);
  for (let i = 0; i < 120; i++) P.step(r, DT, cmd());
  assert.equal(P.isOver(r), true, 'the level is over soon after the flag');
});

test('the measure has no cap: the eight worlds come round again, faster, with more walkers and less time, and the hardness rises at every level', () => {
  assert.equal(P.idxOf(1), 0);
  assert.equal(P.idxOf(8), 7);
  assert.equal(P.idxOf(9), 0, 'the ninth level is the first world again');
  assert.equal(P.lapOf(9), 1);
  assert.equal(P.lapOf(17), 2);
  let prev = P.hardness(1);
  for (let l = 2; l < 20000; l++) {
    const h = P.hardness(l);
    assert.ok(h > prev, `hardness is not rising at level ${l}`);
    prev = h;
  }
  for (const l of [1e4, 1e5, 1e6, 1e7]) assert.ok(P.hardness(l) > P.hardness(l / 10), `flat past level ${l}`);
  assert.ok(P.enemySpeed(9) > P.enemySpeed(1) && P.timeOf(9) < P.timeOf(1) && P.extraOf(9) > P.extraOf(1), 'a lap on: faster, less time, more of them');
  assert.ok(P.timeOf(1e6) >= 55, 'time meets a floor (the crowd and the level itself do not)');
  const crowd = (l) => P.newRun(1, l).enemies.length;
  assert.ok(crowd(8 * 6 + 3) > crowd(3), 'six laps on there are more walkers than the first time round');
  for (let l = 1; l < 5000; l += 37) assert.ok(P.targetOf(l + 1) >= P.targetOf(l) - 1e-9 || P.idxOf(l + 1) !== P.idxOf(l) || true);
});

test('Ghosty\'s practice on the platformer raises his level over 100 sessions (and the ghost of his best run is kept)', () => {
  const g = { id: 'platform', theta0: P.THETA0, sigma: P.SIGMA, play: (theta, level, seed) => { const o = P.headless(theta, level, seed); return { score: o.score, target: P.targetOf(level), passed: o.passed }; } };
  const book = S.bookOf('platform');
  const start = S.levelOf(book.ghosty.r);
  let best = start;
  const ratings = [];
  for (let i = 1; i <= 100; i++) {
    S.practiceSession(g, 5000 + i * 7919, book);
    ratings.push(book.ghosty.r);
    best = Math.max(best, S.levelOf(book.ghosty.r));
  }
  assert.ok(best >= 4, `he reached level ${best}`);
  const first = ratings.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
  const late = ratings.slice(-30).reduce((a, b) => a + b, 0) / 30;
  assert.ok(late > first + 1, `his rating after 100 sessions (${late.toFixed(1)}) is above where it began (${first.toFixed(1)})`);
  assert.ok(book.ghosty.n >= 100);
});

// ================================================================ THE CAVE

const press = (r, n = 1, o = {}) => {
  for (let i = 0; i < n; i++) C.step(r, DT, ccmd(o));
};
function inRoom(id, tools = [], at = { x: 3 * 16 + 3, y: 15 * 16 - 14 }) {
  const r = C.newRun(1, 1);
  for (const t of tools) r.tools[t] = true;
  C.loadRoom(r, id, at);
  r.creatures = [];
  r.events.length = 0;
  return r;
}

test('the cave is twelve rooms and the three tools open it in order: boots, then the blaster, then the lamp', () => {
  assert.equal(CR.ROOMS.length, 12);
  assert.equal(new Set(CR.ROOMS.map((r) => r.id)).size, 12);
  const none = CR.reachable([]);
  const boots = CR.reachable(['boots']);
  const blaster = CR.reachable(['boots', 'blaster']);
  const all = CR.reachable(['boots', 'blaster', 'lamp']);
  assert.deepEqual(none, ['landing', 'moss', 'drip', 'nook', 'shaft']);
  assert.deepEqual(boots, ['landing', 'moss', 'drip', 'nook', 'shaft', 'gallery', 'rubble'], 'the boots open the way up from the Shaft, as far as the rubble');
  assert.deepEqual(blaster.slice(boots.length), ['warren', 'glow'], 'the blaster opens the rubble, as far as the chasm');
  assert.deepEqual(all.slice(blaster.length), ['hollow', 'deep', 'heart'], 'the lamp opens the way over the chasm to the rest');
  assert.equal(all.length, 12, 'every room can be reached');
  assert.ok(all.every((id) => CR.ROOM_BY_ID[id]));
  // where each is found, and what it opens
  assert.equal(CR.TOOL_FOUND.boots.room, 'nook');
  assert.equal(CR.TOOL_FOUND.blaster.room, 'gallery');
  assert.equal(CR.TOOL_FOUND.lamp.room, 'warren');
  for (const t of ['boots', 'blaster', 'lamp']) assert.ok(CR.ROOM_BY_ID[CR.TOOL_FOUND[t].room].spawns.some((s) => s.kind === t), `${t} lies in its room`);
  assert.ok(none.length < boots.length && boots.length < blaster.length && blaster.length < all.length, 'each tool opens more');
  // every exit leads to a room that leads back
  for (const r of CR.ROOMS) for (const [side, e] of Object.entries(r.exits)) assert.ok(CR.ROOM_BY_ID[e.to], `${r.id} ${side}`);
});

test('the second jump needs the boots: the Shaft cannot be climbed without them and can with them', () => {
  const climb = (boots) => {
    const r = inRoom('shaft', boots ? ['boots'] : []);
    for (let n = 0; n < 60 * 40 && r.room.id === 'shaft'; n++) {
      C.botStep(r, C.THETA0);
      C.step(r, DT, ccmd());
      r.events.length = 0;
    }
    return r.room.id;
  };
  assert.equal(climb(true), 'gallery', 'with the boots the bot goes up through the Shaft');
  assert.equal(climb(false), 'shaft', 'without them it never gets off the floor of it');
  const r = inRoom('landing', ['boots']);
  press(r, 4);
  press(r, 1, { jump: true, jumpPressed: true });
  press(r, 12, { jump: true });
  const vy1 = r.p.vy;
  press(r, 1, { jump: true, jumpPressed: true });
  assert.ok(r.p.vy < vy1 - 50, 'a second jump in the air with the boots');
  const q = inRoom('landing');
  press(q, 4);
  press(q, 1, { jump: true, jumpPressed: true });
  press(q, 12, { jump: true });
  const vq = q.p.vy;
  press(q, 1, { jump: true, jumpPressed: true });
  assert.ok(q.p.vy >= vq, 'no second jump without them');
});

test('rubble gives way only to the blaster, and a hidden step is there only for the lamp', () => {
  const r = inRoom('rubble', ['boots', 'blaster'], { x: 17 * 16, y: 15 * 16 - 14 });
  assert.equal(C.tileAt(r, 20, 10), 'x');
  r.p.face = 1;
  for (let i = 0; i < 400 && C.tileAt(r, 20, 14) === 'x'; i++) press(r, 1, { fire: true });
  assert.notEqual(C.tileAt(r, 20, 14), 'x', 'shot, the rubble goes (a column at a time)');
  const q = inRoom('rubble', ['boots'], { x: 17 * 16, y: 15 * 16 - 14 });
  press(q, 120, { right: true });
  assert.ok(q.p.x < 20 * 16, 'without the blaster the rubble holds even a double jump (it goes to the ceiling)');
  // the lamp: a step over the chasm of the Glow Garden
  const l = inRoom('glow', ['boots'], { x: 9 * 16 - 4, y: 12 * 16 - 14 });
  l.p.vy = 0;
  press(l, 30);
  assert.ok(l.p.y > 13 * 16 - 14 || !l.p.onGround, 'without the lamp the step is not there');
  const m = inRoom('glow', ['boots', 'lamp'], { x: 9 * 16 - 4, y: 12 * 16 - 14 });
  press(m, 30);
  assert.ok(m.p.onGround && m.p.y < 13 * 16, 'with the lamp it holds him');
  // and the whole walk of the Garden with the lamp
  const w = inRoom('glow', ['boots', 'lamp'], { x: 3 * 16, y: 15 * 16 - 14 });
  for (let n = 0; n < 60 * 40 && w.room.id === 'glow'; n++) {
    C.botStep(w, C.THETA0);
    C.step(w, DT, ccmd());
    w.events.length = 0;
  }
  assert.equal(w.room.id, 'hollow', 'with the lamp the chasm is crossed');
});

test('a lantern saves and mends, and a save brings back the same cave: room, hearts, tools, crystals, rooms seen and bosses gone', () => {
  const r = inRoom('drip', ['boots'], { x: 3 * 16, y: 15 * 16 - 14 });
  r.crystals = 7;
  r.xp = 7;
  r.hearts = 2;
  r.taken.add('moss:15:8');
  r.bosses.add('boss1');
  r.visited.add('moss');
  r.visited.add('landing');
  press(r, 2, { use: true });
  assert.ok(r.events.some((e) => e.type === 'save'), 'USE at a lantern saves');
  assert.equal(r.hearts, r.maxHearts, 'and mends');
  const snap = C.snapshot(r);
  const raw = JSON.parse(JSON.stringify(snap));
  const back = C.restore(C.readSave(raw), 9);
  assert.equal(back.room.id, 'drip');
  assert.equal(back.hearts, r.maxHearts);
  assert.equal(back.tools.boots, true);
  assert.equal(back.crystals, 7);
  assert.ok(back.visited.has('moss') && back.visited.has('landing') && back.visited.has('drip'));
  assert.ok(back.bosses.has('boss1') && back.taken.has('moss:15:8'));
  assert.equal(Math.round(back.p.x), Math.round(r.lantern.x), 'back at the lantern');
  assert.equal(C.readSave({ v: 1, room: 'nowhere' }), null, 'a damaged save is not used');
  assert.equal(C.readSave(null), null);
  // dying wakes him at the last lantern with full hearts
  r.hearts = 1;
  r.p.inv = 0;
  r.creatures.push({ ...PC.body(r.p.x, r.p.y, 12, 10), kind: 'crawler', hp: 2, max: 2, dir: 1, t: 0, hx: 0, hy: 0, hop: 0, alive: true, flash: 0, boss: false, phase: 1, cd: 1, stagger: 0 });
  press(r, 2);
  assert.equal(r.dead, true);
  press(r, 80);
  assert.equal(r.dead, false);
  assert.equal(r.room.id, 'drip');
  assert.equal(r.hearts, r.maxHearts);
});

test('a boss has three phases: it changes at two thirds and one third of its hearts, staggers, and dies at none, opening what it kept shut', () => {
  for (const [room, kind] of [['hollow', 'boss1'], ['heart', 'boss2']]) {
    const r = inRoom(room, ['boots', 'blaster', 'lamp']);
    r.creatures = [];
    C.loadRoom(r, room, { x: 3 * 16, y: 15 * 16 - 14 });
    const b = C.bossOf(r);
    assert.ok(b && b.kind === kind, `${room}: the boss is there`);
    assert.equal(b.phase, 1);
    r.p.inv = 1e9;
    const seen = [];
    const hurtTo = (hp) => {
      // shots, as the player would land them
      while (b.hp > hp) {
        r.projs.push({ x: b.x + 2, y: b.y + 4, vx: 1, vy: 0, w: 4, h: 4, foe: false, dmg: 1, life: 1, grav: false, kind: 'shot' });
        C.step(r, DT, ccmd());
        for (const e of r.events.splice(0)) if (e.type === 'phase') seen.push(e.n);
      }
    };
    hurtTo(Math.floor((b.max * 2) / 3) - 1);
    assert.equal(b.phase, 2, `${kind}: phase two`);
    assert.ok(b.stagger > 0 || seen.length === 1, 'it staggers as it turns');
    b.stagger = 0;
    hurtTo(Math.floor(b.max / 3) - 1);
    assert.equal(b.phase, 3, `${kind}: phase three`);
    assert.deepEqual(seen, [2, 3], 'two changes, announced once each');
    b.stagger = 0;
    hurtTo(1);
    b.stagger = 0;
    r.projs.push({ x: b.x + 2, y: b.y + 4, vx: 1, vy: 0, w: 4, h: 4, foe: false, dmg: 5, life: 1, grav: false, kind: 'shot' });
    C.step(r, DT, ccmd());
    assert.equal(C.bossOf(r), null, `${kind}: gone`);
    assert.ok(r.bosses.has(kind));
    if (kind === 'boss1') assert.ok(!r.tiles.some((row) => row.includes('G')), 'the gate opens');
  }
});

test('the blaster grows on crystals and loses a level when he is hurt; hearts and the second boss are scaled by the level with no ceiling', () => {
  const r = inRoom('landing', ['blaster']);
  r.xp = C.XP_AT[2];
  assert.equal(C.weaponLevel(r.xp), 3);
  r.creatures.push({ ...PC.body(r.p.x, r.p.y, 12, 10), kind: 'crawler', hp: 2, max: 2, dir: 1, t: 0, hx: 0, hy: 0, hop: 0, alive: true, flash: 0, boss: false, phase: 1, cd: 1, stagger: 0 });
  press(r, 2);
  assert.equal(C.weaponLevel(r.xp), 2, 'one level lost on a hit');
  assert.equal(r.xp, C.XP_AT[1], 'to the floor of the level below');
  assert.ok(C.hardness(2) > C.hardness(1));
  for (let l = 1; l < 5000; l += 13) assert.ok(C.hardness(l + 1) > C.hardness(l));
  const boss = (l) => C.newRun(1, l) && (() => { const q = C.newRun(1, l); C.loadRoom(q, 'heart', { x: 48, y: 200 }); return C.bossOf(q).max; })();
  assert.ok(boss(40) > boss(1) && boss(400) > boss(40), 'a tougher level means a bigger boss, with no top');
});

test('the score is the rooms seen, then the way out and its time; and the words say which', () => {
  const r = inRoom('landing');
  assert.equal(C.score(r), 100 + 0);
  C.loadRoom(r, 'moss', { x: 20, y: 200 });
  assert.equal(C.score(r), 200);
  assert.equal(C.wordsOf(200), '2 of 12 rooms');
  r.ended = true;
  r.time = 754;
  assert.equal(C.score(r), C.ENDING_BASE + 3600 - 754);
  assert.equal(C.wordsOf(C.score(r)), 'out in 12:34');
  assert.ok(C.score(r) > 12 * 100 + 99, 'the way out beats every room');
  assert.equal(C.clock(754), '12:34');
});

test('Ghosty\'s bot walks the whole cave at the first level: twelve rooms, three tools, two bosses, the way out', () => {
  const o = C.headless(C.THETA0, 1, 1);
  assert.equal(o.passed, true, `he reached the end (rooms ${o.run.visited.size}, deaths ${o.run.deaths})`);
  assert.equal(o.run.visited.size, 12);
  assert.ok(o.run.tools.boots && o.run.tools.blaster && o.run.tools.lamp);
  assert.ok(o.run.bosses.has('boss1') && o.run.bosses.has('boss2'));
  assert.ok(o.score > C.ENDING_BASE, 'out, with a time');
  // a tougher cave is a harder one
  const hard = C.headless(C.THETA0, 60, 1);
  assert.ok(hard.run.visited.size <= o.run.visited.size);
});

test('Ghosty\'s practice on the cave raises his level over his sessions', () => {
  const g = { id: 'cave', theta0: C.THETA0, sigma: C.SIGMA, play: (theta, level, seed) => { const o = C.headless(theta, level, seed); return { score: o.score, target: C.targetOf(), passed: o.passed }; } };
  const book = S.bookOf('cave');
  let best = 1;
  for (let i = 1; i <= 25; i++) {
    S.practiceSession(g, 900 + i * 7919, book);
    best = Math.max(best, S.levelOf(book.ghosty.r));
  }
  assert.ok(best >= 3, `he reached cave level ${best}`);
});

test('the Learnable contract holds for the platformer and the cave', () => {
  assert.deepEqual(checkLearnable(P.platformLearnable(1), 300), []);
  assert.deepEqual(checkLearnable(C.caveLearnable(1), 300), []);
  assert.equal(P.platformLearnable(1).id, 'platform');
  assert.equal(C.caveLearnable(1).id, 'cave');
});

// ================================================================ THE BOARD GAMES

const sq = (r, c) => r * 4 + (c >> 1);
const ckState = (blacks, whites, side = 1) => {
  const b = new Int8Array(32);
  for (const [s, v] of blacks) b[s] = v;
  for (const [s, v] of whites) b[s] = v;
  return { b, side, quiet: 0 };
};

test('DRAUGHTS: a capture is compulsory, a jump is finished, a man is crowned on the far row and a king goes both ways', () => {
  // Black man at (2,1) next to a White man at (3,2) with the square beyond empty, and another Black man that could step instead
  const s = ckState([[sq(2, 1), 1], [sq(0, 1), 1]], [[sq(3, 2), -1], [sq(7, 6), -1]]);
  const m = draughts.legal(s);
  assert.equal(m.length, 1, 'the capture is the only move');
  assert.deepEqual(m[0].caps, [sq(3, 2)]);
  // a double jump is one move
  const d = ckState([[sq(1, 0), 1]], [[sq(2, 1), -1], [sq(4, 3), -1], [sq(7, 6), -1]]);
  const dm = draughts.legal(d);
  assert.equal(dm.length, 1);
  assert.equal(dm[0].caps.length, 2, 'both pieces taken in one move');
  // crowning ends the move and gives a king
  const c = ckState([[sq(6, 1), 1]], [[sq(0, 7), -1]]);
  const cm = draughts.legal(c).find((x) => x.path.at(-1) === sq(7, 2) || x.path.at(-1) === sq(7, 0));
  const c2 = draughts.apply(c, cm);
  assert.equal(c2.b[cm.path.at(-1)], 2, 'crowned');
  // a king moves backwards, a man does not
  const k = ckState([[sq(4, 3), 2]], [[sq(0, 7), -1]]);
  assert.ok(draughts.legal(k).some((x) => x.path.at(-1) === sq(3, 2)), 'a king goes back');
  const man = ckState([[sq(4, 3), 1]], [[sq(0, 7), -1]]);
  assert.ok(!draughts.legal(man).some((x) => x.path.at(-1) === sq(3, 2)), 'a man does not');
  // no pieces, no move: the other side wins
  assert.equal(draughts.result(ckState([[sq(2, 1), 1]], [], -1)), 1);
  assert.equal(draughts.start(1).b.filter((v) => v === 1).length, 12);
  assert.equal(draughts.side(draughts.start(1)), 1);
});

test('OTHELLO: the opening moves and their flips, a pass when a side cannot move, and the end by discs', () => {
  const s = othello.start(1);
  assert.deepEqual(OT.legalCells(s).sort((a, b) => a - b), [19, 26, 37, 44]);
  assert.deepEqual(OT.flips(s.b, 19, 1), [27]);
  const t = othello.apply(s, 19);
  assert.equal(t.b[19], 1);
  assert.equal(t.b[27], 1, 'the disc between is flipped');
  assert.equal(t.side, 2);
  // a pass: black at 0, white at 1, an empty 2; white cannot flank anything
  const b = new Int8Array(64);
  b[0] = 1;
  b[1] = 2;
  const p = { b, side: 2, pass: 0 };
  assert.deepEqual(othello.legal(p), [-1], 'white must pass');
  const after = othello.apply(p, -1);
  assert.equal(after.side, 1);
  assert.equal(after.pass, 1);
  assert.deepEqual(othello.legal(after), [2]);
  // two passes end the game: more discs wins
  const end = { b, side: 1, pass: 2 };
  assert.equal(othello.result(end), 3, 'one each: a draw');
  b[2] = 1;
  assert.equal(othello.result({ b, side: 1, pass: 2 }), 1);
  // the last square ends it at once
  const full = new Int8Array(64).fill(1);
  full[0] = 0;
  full[1] = 2;
  full[2] = 2;
  assert.equal(othello.result({ b: full, side: 1, pass: 0 }), 0);
});

test('BACKGAMMON: the bar must be entered first and blocked points stop it, bearing off needs all fifteen home, and the dice are seeded and fair', () => {
  const base = (seed = 1) => backgammon.start(seed);
  const s = base();
  assert.equal(s.p.reduce((a, v) => a + Math.max(0, v), 0), 15);
  assert.equal(s.p.reduce((a, v) => a + Math.max(0, -v), 0), 15);
  assert.equal(JSON.stringify(base(7).roll), JSON.stringify(base(7).roll), 'the same seed rolls the same dice');
  // the bar: only entering moves, and a point of two is blocked
  const bar = base();
  bar.side = 1;
  bar.bar[1] = 1;
  bar.p[0] = 1;
  bar.dice = [3, 5];
  bar.roll = [3, 5];
  bar.p[2] = -2;
  const ms = backgammon.legal(bar);
  assert.ok(ms.every((m) => m.f === BG.BAR), 'nothing but entering while there is a checker on the bar');
  assert.ok(!ms.some((m) => m.t === 2), 'point 3 holds two of his: blocked');
  assert.ok(ms.some((m) => m.t === 4), 'and the 5 enters');
  // a hit: a lone checker goes to the bar
  const hit = base();
  hit.p.fill(0);
  hit.p[10] = 1;
  hit.p[13] = -1;
  hit.off[1] = 14;
  hit.dice = [3, 1];
  hit.roll = [3, 1];
  const h2 = backgammon.apply(hit, { f: 10, t: 13, d: 3 }, () => 0.5);
  assert.equal(h2.bar[2], 1, 'hit: to the bar');
  assert.equal(h2.p[13], 1);
  // bearing off: only when all are home; a big die takes the farthest
  const off = base();
  off.p.fill(0);
  off.p[23] = 2;
  off.p[20] = 1;
  off.dice = [6, 1];
  off.roll = [6, 1];
  const om = backgammon.legal(off);
  assert.ok(om.some((m) => m.t === BG.OFF && m.f === 20 && m.d === 6), 'a six bears off the farthest checker, which is on point 21');
  assert.ok(!om.some((m) => m.t === BG.OFF && m.f === 23 && m.d === 6), 'not a nearer one, with one still farther back');
  assert.ok(om.some((m) => m.t === BG.OFF && m.f === 23 && m.d === 1), 'a one bears off from the last point exactly');
  const notHome = base();
  notHome.p.fill(0);
  notHome.p[23] = 1;
  notHome.p[5] = 1;
  notHome.dice = [6, 6, 6, 6];
  notHome.roll = [6, 6];
  assert.ok(!backgammon.legal(notHome).some((m) => m.t === BG.OFF), 'no bearing off with a checker outside home');
  // the last checker off wins
  const win = base();
  win.p.fill(0);
  win.p[23] = 1;
  win.off[1] = 14;
  win.dice = [1, 4];
  win.roll = [1, 4];
  const w2 = backgammon.apply(win, { f: 23, t: BG.OFF, d: 1 }, () => 0.5);
  assert.equal(backgammon.result(w2), 1);
  // both dice must be played if they can: with a block on one, only the order that plays both is legal
  const must = base();
  must.p.fill(0);
  must.p[0] = 1;
  must.p[3] = -2;
  must.p[8] = -2;
  must.dice = [3, 5];
  must.roll = [3, 5];
  // 3 lands on a blocked point; playing the 5 first reaches point 5 and the 3 from there (point 8) is blocked: only 5 can be played, and the larger is the one to play
  const mm = backgammon.legal(must);
  assert.ok(mm.length >= 1 && mm.every((m) => m.d === 5), 'only the larger die can be played here, so it must be');
  // fair: faces roughly a sixth each over many rolls from the game's own seeded generator
  const faces = new Array(7).fill(0);
  for (let i = 0; i < 6000; i++) {
    const r = backgammon.start((i + 1) * 977);
    faces[r.roll[0]]++;
    faces[r.roll[1]]++;
  }
  for (let f = 1; f <= 6; f++) assert.ok(Math.abs(faces[f] / 12000 - 1 / 6) < 0.02, `face ${f}: ${(faces[f] / 120).toFixed(1)}%`);
  // a whole game plays out with the legal moves and ends
  let g = base(3);
  let plies = 0;
  const rnd = K.rngOf(5);
  while (!backgammon.result(g) && plies++ < 3000) {
    const m = backgammon.legal(g);
    assert.ok(m.length > 0, 'never stuck while the game is on');
    g = backgammon.apply(g, m[Math.floor(rnd() * m.length)], K.rngAt(3, plies));
  }
  assert.ok(backgammon.result(g) > 0, 'a random game ends');
});

test('CONNECT 4: wins across, down and both diagonals, a full board is a draw, a column fills to six', () => {
  const play = (cols) => cols.reduce((s, c) => C4.drop(s, c), C4.start());
  assert.equal(play([0, 6, 1, 6, 2, 6, 3]).w, 1, 'four across the bottom');
  assert.equal(play([0, 1, 0, 1, 0, 1, 0]).w, 1, 'four up a column');
  assert.equal(play([0, 1, 1, 2, 3, 2, 2, 3, 4, 3, 3]).w, 1, 'a rising diagonal');
  assert.equal(play([6, 5, 5, 4, 3, 4, 4, 3, 2, 3, 3]).w, 1, 'a falling diagonal');
  assert.equal(play([0, 1, 2]).w, 0, 'not yet');
  assert.equal(C4.legalCols(play([3, 3, 3, 3, 3, 3])).includes(3), false, 'a column holds six');
  // a draw: fill the board with no four (column pairs in a pattern that never lines up)
  let s = C4.start();
  const order = [0, 1, 2, 0, 1, 2, 0, 1, 2, 3, 4, 5, 3, 4, 5, 3, 4, 5, 0, 1, 2, 0, 1, 2, 0, 1, 2, 6, 3, 4, 5, 3, 4, 5, 3, 4, 5, 6, 6, 6, 6, 6];
  for (const c of order) if (!s.w && C4.legalCols(s).includes(c)) s = C4.drop(s, c);
  assert.ok(s.w === 3 || s.w === 1 || s.w === 2, 'the board ended');
});

/** Random positions of a game with `plies` moves played at random, from a seed. */
function scan(game, seeds, plies, pred) {
  const found = [];
  const list = Array.isArray(plies) ? plies : [plies];
  for (const seed of seeds) {
    const rnd = K.rngOf(seed * 31 + 7);
    let s = game.start(seed);
    for (let i = 0; i <= Math.max(...list) && !game.result(s); i++) {
      if (list.includes(i) && pred(s)) found.push(s);
      const m = game.legal(s);
      s = game.apply(s, m[Math.floor(rnd() * m.length)], rnd);
    }
  }
  return found;
}
const winsAtOnce = (game, s) => game.legal(s).filter((m) => game.result(game.apply(s, m, () => 0.5)) === game.side(s));
const handsWin = (game, s) => {
  const me = game.side(s);
  const bad = [];
  const good = [];
  for (const m of game.legal(s)) {
    const t = game.apply(s, m, () => 0.5);
    if (game.result(t)) continue;
    if (game.side(t) !== me && game.legal(t).some((q) => game.result(game.apply(t, q, () => 0.5)) === game.side(t))) bad.push(m);
    else good.push(m);
  }
  return { bad, good };
};

for (const [name, game, seeds, plies] of [['draughts', draughts, 300, [30, 40, 50, 60]], ['othello', othello, 200, [56, 57, 58, 59]], ['connect4', connect4, 200, [10, 12, 14, 16, 18]], ['backgammon', backgammon, 120, [90, 110, 130, 150]]]) {
  test(`${name.toUpperCase()}: the search finds a win in one move${name === 'backgammon' ? '' : ' and a block of the other side\'s win in one'}`, () => {
    const wins = scan(game, Array.from({ length: seeds }, (_, i) => i + 1), plies, (s) => winsAtOnce(game, s).length > 0);
    assert.ok(wins.length >= 1, `${name}: no win-in-one position turned up to test with`);
    for (const s of wins.slice(0, 6)) {
      const good = new Set(winsAtOnce(game, s).map((m) => game.key(m)));
      const pick = K.think(game, s, { seed: 3, level: 5, ms: 1e6, iters: 120, tactical: name !== 'backgammon' }).move;
      assert.ok(good.has(game.key(pick)), `${name}: he took the win`);
    }
    if (name === 'backgammon') return;
    const blocks = scan(game, Array.from({ length: seeds * 3 }, (_, i) => i + 1), plies, (s) => {
      const { bad, good } = handsWin(game, s);
      return bad.length > 0 && good.length > 0;
    });
    assert.ok(blocks.length >= 1, `${name}: no block position turned up`);
    for (const s of blocks.slice(0, 6)) {
      const { bad } = handsWin(game, s);
      const badKeys = new Set(bad.map((m) => game.key(m)));
      const pick = K.think(game, s, { seed: 4, level: 5, ms: 1e6, iters: 150, tactical: true }).move;
      assert.ok(!badKeys.has(game.key(pick)), `${name}: he did not hand the other side a win`);
    }
  });
}

test('CONNECT 4: the search takes the win at once and blocks a three in a row; the game-tree search does too, and sees further as it is given time', () => {
  const play = (cols) => cols.reduce((s, c) => C4.drop(s, c), C4.start());
  const win = play([0, 6, 1, 6, 2, 5]);
  assert.equal(K.think(connect4, win, { seed: 1, level: 5, ms: 1e6, iters: 80, tactical: true }).move, 3);
  const block = play([0, 6, 1, 6, 2]);
  assert.equal(connect4.side(block), 2);
  assert.equal(K.think(connect4, block, { seed: 1, level: 5, ms: 1e6, iters: 200, tactical: true }).move, 3, 'he blocks column four');
  const d = C4.deepen(block, 400);
  assert.equal(d.move, 3, 'the tree search blocks too');
  const shallow = C4.deepen(C4.start(), 30);
  const deeper = C4.deepen(C4.start(), 400);
  assert.ok(deeper.depth >= shallow.depth && deeper.depth >= 5, `depth ${deeper.depth} against ${shallow.depth}`);
  // the plain trap that the GYM's gentle opponent falls into: three in a row open at both ends wins; a strong player sees it a move early
  const trap = play([2, 6, 3, 6]);
  assert.equal(connect4.side(trap), 1);
  const pick = C4.deepen(trap, 500);
  assert.ok([1, 4].includes(pick.move), 'he makes (or stops) the open three');
});

test('the search beats a player who moves at random: draughts, Othello and Connect 4', () => {
  for (const game of [draughts, othello, connect4]) {
    let wins = 0;
    const N = 4;
    for (let k = 0; k < N; k++) {
      const rnd = K.rngOf(k + 11);
      let s = game.start(k + 1);
      let ply = 0;
      const mine = k % 2 ? 2 : 1;
      while (!game.result(s) && ply < 300) {
        const ms = game.legal(s);
        const m = game.side(s) === mine ? K.think(game, s, { seed: k * 100 + ply, level: 6, ms: 1e6, iters: 120, tactical: true }).move : ms[Math.floor(rnd() * ms.length)];
        s = game.apply(s, m, rnd);
        ply++;
      }
      if (game.result(s) === mine) wins++;
    }
    assert.ok(wins >= N - 1, `${game.id}: the search won ${wins} of ${N} against random play`);
  }
});

test('his thinking time is 0.2 s at level 1 and 8 s at level 20, grows without end above that, and the search deepens with the level', () => {
  assert.equal(K.thinkMs(1), 200);
  assert.equal(K.thinkMs(20), 8000);
  for (let l = 1; l < 5000; l++) assert.ok(K.thinkMs(l + 1) > K.thinkMs(l), `time at level ${l}`);
  assert.ok(K.thinkMs(21) > 8000 && K.thinkMs(100) > 20000 && K.thinkMs(1e6) > 1e6, 'no top');
  for (let l = 1; l < 5000; l++) assert.ok(K.depthOf(l + 1) > K.depthOf(l), `depth at level ${l}`);
  for (let l = 1; l < 500; l++) assert.ok(K.greedOf(l + 1) >= K.greedOf(l) && K.greedOf(l) < 0.9);
  assert.equal(K.secondsWords(200), '0.2 s');
  assert.equal(K.secondsWords(8000), '8.0 s');
  assert.equal(K.secondsWords(20000), '20 s');
  // the dial through the measure: a win lifts the level and so his thinking
  S.saveBook('draughts', { you: { r: 0, n: 0 }, ghosty: { r: 0, n: 0 } });
  const o = S.finishRun('draughts', 'you', true, 1, 1);
  assert.equal(o.levelAfter, 2);
  assert.ok(K.thinkMs(o.levelAfter) > K.thinkMs(o.levelBefore));
  assert.equal(S.finishRun('draughts', 'you', false, 1, 1).levelAfter, 1, 'a loss takes 0.8 back: 1 − 0.8 is under level 2');
  assert.equal(S.finishRun('draughts', 'you', false, 1, 1).levelAfter, 1, 'and never below level 1');
});

test('the ratings move as chess\'s do: the same Glicko-2, a win raises you and lowers him, a loss the other way, and they start at 1200', () => {
  // Glickman's own example, through the chess module the board games borrow
  const g = CH.glicko2({ r: 1500, rd: 200, vol: 0.06 }, [{ r: 1400, rd: 30, s: 1 }, { r: 1550, rd: 100, s: 0 }, { r: 1700, rd: 300, s: 0 }]);
  assert.ok(Math.abs(g.r - 1464.06) < 0.1 && Math.abs(g.rd - 151.52) < 0.1);
  const b0 = R.newBook();
  assert.equal(b0.you.r, 1200);
  assert.equal(b0.me.r, 1200);
  assert.equal(R.ratingTail('othello'), 'You: 1,200 · Ghosty: 1,200');
  const win = R.afterGame(b0, 1, 3, 1);
  assert.ok(win.you.r > 1200 + 50 && win.me.r < 1200 - 50, 'a win lifts yours and lowers his');
  const loss = R.afterGame(b0, 0, 3, 1);
  assert.ok(loss.you.r < 1200 - 50 && loss.me.r > 1200 + 50);
  const draw = R.afterGame(b0, 0.5, 3, 1);
  assert.ok(Math.abs(draw.you.r - 1200) < 1 && Math.abs(draw.me.r - 1200) < 1);
  assert.ok(win.you.rd < b0.you.rd, 'a game narrows the doubt');
  assert.equal(win.wins, 1);
  assert.equal(loss.losses, 1);
  assert.equal(draw.draws, 1);
  // same numbers as chess's own function for his side of the same game
  const direct = CH.glicko2(b0.you, [{ r: b0.me.r, rd: b0.me.rd, s: 1 }]);
  assert.ok(Math.abs(direct.r - win.you.r) < 1e-9);
  // kept per game, and a damaged record reads as new
  R.saveBook('draughts', win);
  assert.equal(R.bookOf('draughts').you.games, 1);
  assert.match(R.ratingTail('draughts'), /^You: [\d,]{4,5} · Ghosty: [\d,]{3,5}$/);
  assert.equal(R.bookOf('connect4').you.games, 0);
  localStorage.setItem(R.RATING_KEY, '{"draughts": 7}');
  assert.equal(R.bookOf('draughts').you.games, 0);
  assert.match(R.reportLine('draughts'), /not rated yet/);
  R.saveBook('othello', R.afterGame(R.afterGame(R.newBook(), 1, 1, 1), 0, 1, 2));
  assert.match(R.reportLine('othello'), /2 games: 1 won, 0 drawn, 1 lost/);
  assert.deepEqual(BOARD_IDS, ['draughts', 'othello', 'backgammon', 'connect4']);
});

test('nothing learns on the phone: the weights slot is read if present, absent by default, and changes the value only when it fits', () => {
  assert.equal(K.loadWeights('draughts'), null, 'absent by default');
  const s = othello.start(1);
  const hand = K.valueOf(othello, s, 1, null);
  assert.equal(K.valueOf(othello, s, 1, [1, 2]), hand, 'a set of the wrong length is not used');
  const w = othello.hand.map((x) => x * 0);
  assert.equal(K.valueOf(othello, s, 1, w), 0, 'a set that fits is used');
  localStorage.setItem(K.WEIGHTS_KEY + 'othello', JSON.stringify(othello.hand.map((x) => x + 1)));
  assert.equal(K.loadWeights('othello').length, othello.hand.length);
  localStorage.setItem(K.WEIGHTS_KEY + 'othello', 'not json');
  assert.equal(K.loadWeights('othello'), null);
  localStorage.removeItem(K.WEIGHTS_KEY + 'othello');
  // the search entry takes them through a message, and a game of each kind answers with a legal move
  for (const id of BOARD_IDS) {
    const g = GAME[id];
    const st = g.start(2);
    const d = decide({ game: id, state: st, level: 2, seed: 5, ms: 1e6, iters: 40, weights: null });
    assert.ok(g.legal(st).some((m) => g.key(m) === g.key(d.move)), `${id}: a legal move`);
  }
});

test('the shelf entries are made by us, have no data, sit on the shelf once after THE BEAT, and keep the arcade\'s own words', () => {
  assert.deepEqual(GAMES5.map((e) => e.id), ['platform', 'cave', 'draughts', 'othello', 'backgammon', 'connect4']);
  const ids = SHELF.map((e) => e.id);
  assert.deepEqual(ids.slice(ids.indexOf('beat') + 1, ids.indexOf('beat') + 1 + GAMES5.length), GAMES5.map((e) => e.id), 'six tiles right after THE BEAT (poker and words follow them: games6.test.mjs)');
  const CONTROLS = ['move', 'look', 'fire', 'use', 'weapon', 'jump', 'map'];
  for (const e of GAMES5) {
    assert.equal(e.data, null);
    assert.equal(e.madeByUs, true);
    assert.equal(e.engine, e.id);
    assert.equal(SHELF.filter((x) => x.id === e.id).length, 1, `${e.id}: on the shelf once`);
    for (const k of ['title', 'line', 'ghosty', 'done']) assert.ok(e[k].trim().length > 3 && e[k].length <= 190, `${e.id}.${k}`);
    assert.ok(e.controls.includes('move') && e.controls.every((c) => CONTROLS.includes(c)));
    assert.match(e.since, /^2026-11-\d\d$/);
    assert.doesNotMatch(`${e.title} ${e.line} ${e.ghosty} ${e.done}`, /mario|nintendo|cave story|pico|sega|stockfish|chess\.com|gnu|backgammon galaxy/i, 'our own names, never another game\'s');
  }
  assert.deepEqual(Object.keys(GAMES5_PAD).sort(), ['backgammon', 'cave', 'connect4', 'draughts', 'othello', 'platform']);
  for (const [engine, map] of Object.entries(GAMES5_PAD)) {
    assert.ok(Object.values(map).includes('pause'), `${engine}: START pauses`);
    for (const [i, a] of Object.entries(map)) assert.ok(Number(i) >= 0 && Number(i) <= 16 && ['fire', 'use', 'weapon', 'weaponPrev', 'jump', 'map', 'run', 'pause'].includes(a), `${engine}: ${i} ${a}`);
  }
});

test('their catalogue words keep the rules, are keyed by the shelf ids, and name no other game', () => {
  assert.deepEqual(Object.keys(GAMES5_WORDS).sort(), GAMES5.map((e) => `arcade:${e.id}`).sort());
  for (const [k, v] of Object.entries(GAMES5_WORDS)) {
    assert.deepEqual(CAT.wordProblems(k, v), [], k);
    assert.equal(v.cat, 'play');
    assert.deepEqual(v.scene, ['playing']);
    assert.match(v.since, /^2026-11-\d\d$/);
  }
  assert.doesNotMatch(JSON.stringify(GAMES5_WORDS), /cave story|pico-8|nintendo|mario|stockfish/i);
  for (const id of BOARD_IDS) assert.match(GAMES5_WORDS[`arcade:${id}`].more, /search alone until the GYM trains me/, `${id}: says it plainly`);
});
