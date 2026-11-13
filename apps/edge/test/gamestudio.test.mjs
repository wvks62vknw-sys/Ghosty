// THE GAME STUDIO (BRIEF-EDITOR-GAME-STUDIO), held to its rules with no screen. The model: a door to a room that is not there, a
// quest for a thing no room holds and a room over 64 × 32 are each refused in his words; the little language round trips with his
// own tiles; undo is sixty deep. The runtime, headless, on the template games: the platformer's flag ends it, the adventure's quest
// completes on scripted inputs step by step, a shop refuses a buy with too few coins and says so, a key opens only its door, a
// save point's state restores equal, lives gone ends the game; a top-down body has no gravity. The .ghostygame writer and reader
// round trip (the JSON and a PNG per sprite sheet) and the app page's parts: its manifest's fields, its policy line, the inlined
// data equal to the game, the size under the target. esbuild-bundled from the source, as the other game tests are.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
const S = '../../web/src/studio-game/';
await build({
  entryPoints: {
    model: at(`${S}model.ts`),
    play: at(`${S}play.ts`),
    share: at(`${S}share.ts`),
    app: at(`${S}app.ts`),
    tune: at(`${S}tune.ts`),
    shelf: at('../../web/src/arcade/shelf.ts'),
  },
  outdir: at('./.build/gamestudio/'),
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  logLevel: 'error',
});
const O = (n) => import(at(`./.build/gamestudio/${n}.js`));
const M = await O('model');
const P = await O('play');
const SH = await O('share');
const APP = await O('app');
const TUNE = await O('tune');

const STEP = P.STEP;
const dirs = { '1,0': 'right', '-1,0': 'left', '0,1': 'down', '0,-1': 'up' };
/** Walk the player to a tile with scripted inputs (a breadth-first route over the tiles he can stand on). */
function walkTo(p, tx, ty, o = {}) {
  const room = p.room;
  const free = (x, y) => {
    const c = M.tileAt(room, x, y);
    return c !== ' ' && !M.isSolidLetter(p.game, c) && (o.door || c !== 'D' || (x === tx && y === ty));
  };
  const sx = Math.floor((p.b.x + p.b.w / 2) / 16);
  const sy = Math.floor((p.b.y + p.b.h / 2) / 16);
  const prev = new Map([[`${sx},${sy}`, null]]);
  const q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift();
    if (x === tx && y === ty) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = `${x + dx},${y + dy}`;
      if (!prev.has(k) && free(x + dx, y + dy)) (prev.set(k, [x, y]), q.push([x + dx, y + dy]));
    }
  }
  assert.ok(prev.has(`${tx},${ty}`), `no way to ${tx},${ty} in ${room.id}`);
  const path = [];
  for (let k = `${tx},${ty}`; k; ) {
    const [x, y] = k.split(',').map(Number);
    path.unshift([x, y]);
    const pr = prev.get(k);
    k = pr ? pr.join(',') : null;
  }
  for (const [x, y] of path.slice(1)) {
    const rid = p.rid;
    let guard = 0;
    while (guard++ < 400 && p.rid === rid && !p.over) {
      const cx = p.b.x + p.b.w / 2;
      const cy = p.b.y + p.b.h / 2;
      const gx = x * 16 + 8;
      const gy = y * 16 + 8;
      const held = new Set();
      if (Math.abs(gx - cx) > 1.2) held.add(gx > cx ? 'right' : 'left');
      else if (Math.abs(gy - cy) > 1.2) held.add(gy > cy ? 'down' : 'up');
      else break;
      P.step(p, STEP, { held, pressed: new Set() });
    }
    if (p.rid !== rid) return;
  }
}
const press = (p, ...names) => P.step(p, STEP, { held: new Set(), pressed: new Set(names) });
const idle = (p, n) => {
  for (let i = 0; i < n; i++) P.step(p, STEP, P.NOINPUT);
};
const evs = (p) => P.drain(p).map((e) => e.type);

test('the model refuses in his words: a door to a missing room, a room too big, a quest nothing can finish', () => {
  const g = M.template('adventure');
  const village = g.rooms[0];
  const d = village.doors[0];
  assert.throws(() => M.linkDoor(g, village, d, 'nowhere'), (e) => e instanceof M.Refused && /no room called "nowhere"/.test(e.message));
  assert.throws(() => M.resizeRoom(village, 65, 20), (e) => e instanceof M.Refused && /64 tiles wide and 32 high at most/.test(e.message));
  assert.throws(() => M.resizeRoom(village, 30, 33), M.Refused);
  assert.throws(() => M.resizeRoom(village, 4, 4), /at the least/);
  const q = M.newQuest(g, 'Impossible');
  const gem = M.newThing(g, 'Moon gem', 'quest');
  g.things.push(gem);
  q.steps = [{ t: 'collect', thing: gem.id, n: 1 }];
  g.quests.push(q);
  const bad = M.problems(g).filter((x) => x.hard);
  assert.ok(bad.some((x) => /"Impossible" cannot be finished: it asks for 1 moon gem and the rooms hold 0/.test(x.text)), JSON.stringify(bad));
  // put the gem in a room and it can be finished
  village.rows[2] = village.rows[2].slice(0, 2) + 'T' + village.rows[2].slice(3);
  village.marks['2,2'] = gem.id;
  assert.equal(M.hardProblems(g).length, 0, JSON.stringify(M.problems(g)));
  // a quest to defeat what no room holds
  q.steps = [{ t: 'defeat', kind: 'flyer', n: 2 }];
  assert.ok(M.hardProblems(g).some((x) => /defeat 2 flyers and the rooms hold 0/.test(x.text)));
  // a door to nowhere and a room with no way out are said
  const lonely = M.newRoom(g, 'Lonely');
  g.rooms.push(lonely);
  assert.ok(M.problems(g).some((x) => /"Lonely" has no way out/.test(x.text)));
  const nd = M.newDoor(g, lonely, 3, 3);
  assert.ok(M.problems(g).some((x) => x.hard && /goes nowhere yet/.test(x.text)), String(nd));
});

test('the little language round trips with his own tiles; a sketch from the chat lands as rows', () => {
  const g = M.template('platformer');
  const t = M.newTile(g, 'Brick', M.BLANK.replace(/^0{16}/, 'a'.repeat(16)), true);
  g.tiles.push(t);
  assert.equal(t.id, 'A');
  const room = g.rooms[0];
  M.setTile(room, 5, 5, 'A');
  const text = M.rowsText(room);
  const back = M.parseRows(text, M.ALL_LETTERS + 'A');
  assert.deepEqual(back.rows, room.rows);
  assert.equal(back.dropped, 0);
  // a letter that is not in the language is air and is counted
  const odd = M.parseRows('........\n..Z.....\n........\n........\n........\n........', M.TERRAIN);
  assert.equal(odd.dropped, 1);
  assert.equal(odd.rows[1], '........');
  // a reply with words around a code block
  const sk = M.sketchFrom('Here is a cave:\n```\n................\n..p........p....\n................\n.....oo.........\n#################\n#################\n```\nPaint over it!');
  assert.ok(sk && sk.w >= 16 && sk.h === 6, JSON.stringify(sk));
  assert.equal(M.sketchFrom('no map here'), null);
  assert.deepEqual(M.linesFrom('Sure, here are some lines:\n1. Hello, traveller!\n- "Mind the cave."\n'), ['Hello, traveller!', 'Mind the cave.']);
  // fill and pick
  const n = M.fillTiles(room, 0, 0, '~');
  assert.ok(n > 50 && M.tileAt(room, 0, 0) === '~');
  // a door removed takes its door with it
  const a = M.template('adventure');
  const v = a.rooms[0];
  assert.equal(v.doors.length, 1);
  M.setTile(v, 23, 8, '.');
  assert.equal(v.doors.length, 0);
});

test('undo is sixty deep and redo follows', () => {
  const g = M.template('blank');
  const h = new M.History(g);
  for (let i = 0; i < 70; i++) {
    h.push();
    h.game.name = `n${i}`;
  }
  assert.equal(h.depth, 60);
  let undone = 0;
  while (h.undo()) undone++;
  assert.equal(undone, 60);
  assert.equal(h.game.name, 'n9');
  assert.ok(h.redo());
  assert.equal(h.game.name, 'n10');
  h.push();
  assert.equal(h.canRedo, false);
});

test('the platformer template: the body walks, jumps, and the flag ends the game', () => {
  const g = M.template('platformer');
  assert.equal(M.hardProblems(g).length, 0, JSON.stringify(M.problems(g)));
  const p = P.newPlay(g);
  const y0 = p.b.y;
  P.runScript(p, [{ hold: ['right'], frames: 30 }]);
  assert.ok(p.b.x > 2 * 16 + 5, 'it walks right');
  // a jump: held up rises and lands again
  let top = y0;
  P.step(p, STEP, { held: new Set(['a']), pressed: new Set(['a']) });
  for (let i = 0; i < 40; i++) {
    P.step(p, STEP, { held: new Set(['a']), pressed: new Set() });
    top = Math.min(top, p.b.y);
  }
  assert.ok(y0 - top > 30, `a held jump rises ${y0 - top}px`);
  idle(p, 90);
  assert.ok(p.b.onGround, 'and lands');
  // a tap rises less than a hold
  const q = P.newPlay(g);
  P.step(q, STEP, { held: new Set(['a']), pressed: new Set(['a']) });
  let low = q.b.y;
  for (let i = 0; i < 40; i++) {
    P.step(q, STEP, P.NOINPUT);
    low = Math.min(low, q.b.y);
  }
  assert.ok(y0 - low < y0 - top - 8, 'a tap is a hop');
  // the flag: put the player beside it in the second room
  const flagRoom = g.rooms[1];
  const fy = flagRoom.rows.findIndex((r) => r.includes('F'));
  const fx = flagRoom.rows[fy].indexOf('F');
  const w = P.newPlay(g, { room: 'cave', at: [fx - 2, fy] });
  P.runScript(w, [{ hold: ['right'], frames: 90 }]);
  assert.equal(w.over, 'won');
  assert.match(w.why, /flag/);
  // spikes cost a heart and lives gone end the game
  const hurtG = M.template('platformer');
  const sp = hurtG.rooms[1];
  const sy = sp.rows.findIndex((r) => r.includes('^'));
  const sx = sp.rows[sy].indexOf('^');
  const lp = P.newPlay(hurtG, { room: 'cave', at: [sx - 1, sy - 1] });
  P.runScript(lp, [{ hold: ['right'], frames: 40 }]);
  assert.ok(lp.hearts < hurtG.player.hearts, 'spikes hurt');
  hurtG.player.hearts = 1;
  hurtG.rules.lives = 1;
  const dead = P.newPlay(hurtG, { room: 'cave', at: [sx - 1, sy - 1] });
  P.runScript(dead, [{ hold: ['right'], frames: 60 }]);
  assert.equal(dead.over, 'lost');
  assert.ok(evs(dead).includes('lose'));
});

test('a top-down body has no gravity and moves one way at a time', () => {
  const g = M.template('adventure');
  const p = P.newPlay(g);
  const y0 = p.b.y;
  idle(p, 60);
  assert.equal(p.b.y, y0, 'nothing pulls it down');
  P.runScript(p, [{ hold: ['down'], frames: 20 }]);
  assert.ok(p.b.y > y0 + 10 && p.b.vx === 0);
  const x0 = p.b.x;
  P.runScript(p, [{ hold: ['right', 'down'], press: ['right'], frames: 10 }]);
  assert.ok(p.b.x > x0 && Math.abs(p.b.vy) < 1e-6, 'two keys, one way');
  // a wall stops it
  P.runScript(p, [{ hold: ['up'], frames: 400 }]);
  assert.ok(p.b.y >= 16 - 0.01, 'it stops at the wall');
});

test('the adventure: the quest completes on scripted inputs, step by step; the key opens only its door; a shop refuses and says so', () => {
  const g = M.template('adventure');
  // another person, with a shop selling a key for five coins, and another door a key does not open
  const boro = M.newNpc(g, 'Boro');
  boro.lines = [{ text: 'Hello.', once: true }, { text: 'Anything today?', once: false }];
  const key2 = M.newThing(g, 'Spare key', 'key');
  g.things.push(key2);
  boro.shop = [{ thing: key2.id, price: 5 }];
  g.npcs.push(boro);
  const v = g.rooms[0];
  M.setTile(v, 8, 12, 'N');
  v.marks['8,12'] = boro.id;
  assert.equal(M.hardProblems(g).length, 0, JSON.stringify(M.problems(g)));
  g.rules.end = 'lives';
  const p = P.newPlay(g);
  assert.equal(P.questLine(p), 'Mara’s key: Talk to Mara');
  // 1. talk to Mara
  walkTo(p, 6, 5);
  press(p, 'b');
  assert.ok(p.dialog && p.dialog.name === 'Mara', 'her box is up');
  assert.equal(p.dialog.pages.length, 2);
  press(p, 'a');
  assert.equal(p.dialog.i, 1);
  P.nextLine(p);
  assert.equal(p.dialog, null);
  assert.equal(p.quests['mara-s-key'].i, 1, 'step one done');
  assert.equal(P.questLine(p), 'Mara’s key: Collect coin (0 of 3)');
  // 2. three coins
  for (const [x, y] of [[6, 10], [10, 12], [12, 3]]) walkTo(p, x, y);
  assert.equal(p.coins, 3);
  assert.equal(p.quests['mara-s-key'].i, 2, 'step two done');
  // a shop that refuses with too few coins, and says so
  walkTo(p, 8, 11);
  press(p, 'b');
  while (p.dialog) P.nextLine(p);
  assert.deepEqual(p.sheet, { kind: 'shop', npc: 'boro' });
  assert.equal(P.buy(p, 'boro', 0), false);
  assert.match(p.said, /You need 5 coins for the spare key, and you have 3\./);
  assert.equal(p.coins, 3);
  P.closeSheet(p);
  // 3. back to Mara; the quest is done and the key is hers to give
  walkTo(p, 6, 5);
  press(p, 'b');
  while (p.dialog) P.nextLine(p);
  assert.equal(p.quests['mara-s-key'].done, true);
  assert.equal(p.inv['cave-key'], 1);
  assert.match(p.said, /cave key/);
  assert.ok(evs(p).includes('quest'));
  // the spare key does not open the cave door; the cave key does
  p.inv['spare-key'] = 1;
  const door = v.doors[0];
  p.inv['cave-key'] = 0;
  walkTo(p, 22, 8);
  walkTo(p, 23, 8, { door: true });
  assert.equal(p.rid, 'village', 'a key for nothing opens nothing');
  assert.match(p.said, /Locked/);
  walkTo(p, 19, 8);
  p.inv['cave-key'] = 1;
  walkTo(p, 22, 8);
  walkTo(p, 23, 8, { door: true });
  assert.equal(p.rid, 'cave');
  idle(p, 150);
  assert.equal(p.rid, 'cave', 'standing on the door he came through does not take him back');
  assert.ok(p.opened.has(door.id));
  assert.equal(p.inv['cave-key'], 0, 'the key is used');
  // the chest in the cave
  walkTo(p, 17, 7);
  press(p, 'b');
  assert.equal(p.inv.heart ?? 0, 0);
  assert.ok(p.chests.size === 1 || p.hearts === g.player.hearts);
  assert.equal(p.over, '');
  const end = M.template('adventure');
  assert.equal(end.rules.end, 'room');
  const e = P.newPlay(end, { room: 'village', at: [22, 8] });
  e.opened.add('village-door');
  P.runScript(e, [{ hold: ['right'], frames: 90 }]);
  assert.equal(e.over, 'won', 'reaching the cave ends the template');
});

test('a quest to talk, collect, reach and take its reward from a chest, as the benchmark makes it', () => {
  const g = M.template('adventure');
  const v = g.rooms[0];
  const boro = M.newNpc(g, 'Boro');
  boro.lines = [{ text: 'Find me three coins.', once: false }, { text: 'Then see the cave.', once: false }];
  const key = g.things.find((t) => t.does === 'key');
  boro.shop = [{ thing: key.id, price: 5 }];
  g.npcs.push(boro);
  M.setTile(v, 8, 12, 'N');
  v.marks['8,12'] = boro.id;
  g.quests = [];
  g.rules.end = 'quests';
  const q = M.newQuest(g, 'Boro’s errand');
  q.steps = [{ t: 'talk', npc: boro.id }, { t: 'collect', thing: 'coin', n: 3 }, { t: 'reach', room: 'cave' }];
  q.reward = { coins: 0, item: 'heart', door: '', line: '', inChest: true };
  g.quests.push(q);
  assert.ok(M.hardProblems(g).some((x) => /reward of "Boro’s errand" is in a chest/.test(x.text)), 'a chest is missing');
  const cave = g.rooms[1];
  cave.marks['17,6'] = `q:${q.id}`;
  assert.equal(M.hardProblems(g).length, 0, JSON.stringify(M.problems(g)));
  const p = P.newPlay(g);
  // eight coins in the village: three for the quest, five for the key
  walkTo(p, 8, 11);
  press(p, 'b');
  while (p.dialog) P.nextLine(p);
  assert.equal(p.sheet?.kind, 'shop');
  P.closeSheet(p);
  const coinsAt = [];
  v.rows.forEach((row, y) => [...row].forEach((c, x) => c === 'o' && coinsAt.push([x, y])));
  assert.equal(coinsAt.length, 8);
  for (const [x, y] of coinsAt) walkTo(p, x, y);
  assert.equal(p.coins, 8);
  assert.equal(p.quests[q.id].i, 2, 'talk and collect done; reach waits');
  // buy the key for five coins: three are left
  walkTo(p, 8, 11);
  press(p, 'b');
  while (p.dialog) P.nextLine(p);
  assert.equal(P.buy(p, 'boro', 0), true);
  assert.equal(p.coins, 3);
  assert.equal(p.inv[key.id], 1);
  P.closeSheet(p);
  // open the door, reach the cave
  walkTo(p, 22, 8);
  walkTo(p, 23, 8, { door: true });
  assert.equal(p.rid, 'cave');
  advanceFrames(p, 2);
  assert.equal(p.quests[q.id].done, true);
  assert.ok(p.ready.has(q.id));
  // the chest opens with the reward
  walkTo(p, 17, 7);
  press(p, 'b');
  assert.equal(p.inv.heart, 1, 'the chest gave its reward');
  assert.ok(evs(p).includes('chest'));
  // saved at the save point, restored equal
  const p2 = P.newPlay(g);
  walkTo(p2, 3, 12);
  const events = evs(p2);
  assert.ok(events.includes('save'), 'the save point said so');
  assert.match(p2.said, /Saved/);
  const s1 = P.snap(p2);
  const p3 = P.newPlay(g, { resume: s1 });
  assert.equal(P.snap(p3), s1, 'a save restores equal');
  assert.equal(p3.rid, p2.rid);
  assert.equal(p3.coins, p2.coins);
  assert.equal(p3.hearts, p2.hearts);
  assert.equal(P.questLine(p3), P.questLine(p2));
});
function advanceFrames(p, n) {
  idle(p, n);
}

test('a save in the middle of a quest restores the quest step, the coins and the room', () => {
  const g = M.template('adventure');
  const p = P.newPlay(g);
  walkTo(p, 6, 5);
  press(p, 'b');
  while (p.dialog) P.nextLine(p);
  walkTo(p, 6, 10);
  walkTo(p, 3, 12);
  const s = P.snap(p);
  const r = P.newPlay(g, { resume: s });
  assert.equal(r.quests['mara-s-key'].i, p.quests['mara-s-key'].i);
  assert.equal(r.coins, p.coins);
  assert.equal(r.rid, p.rid);
  assert.equal(P.snap(r), s);
  assert.equal(r.picked.coin, 1);
});

test('the .ghostygame writer and reader round trip, with a PNG for each sprite sheet', () => {
  const g = M.template('adventure');
  g.maker = 'A friend';
  const bytes = SH.writeGame(g);
  assert.ok(bytes.length > 500 && bytes.length < 200_000, `${bytes.length} bytes`);
  const back = SH.readFile(bytes);
  assert.ok(back && back.game && back.lost === 0, JSON.stringify(back && { lost: back.lost }));
  assert.deepEqual(back.game, M.readGame(JSON.parse(JSON.stringify(g))).game);
  assert.equal(back.game.maker, 'A friend');
  assert.equal(back.maker, 'A friend');
  const parts = SH.partsOf(bytes);
  assert.ok(parts.includes('game.json') && parts.some((n) => n.endsWith('.png')) && parts.includes('README.txt'));
  const png = SH.pngOf(g.sprites[0]);
  assert.deepEqual([...png.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  // a file that kept less than it read says so
  const broken = JSON.parse(JSON.stringify(g));
  broken.rooms.push({ id: 'x' });
  broken.npcs.push(7);
  const kept = M.readGame(broken);
  assert.equal(kept.lost, 2);
  assert.equal(SH.readFile(new TextEncoder().encode('not a zip')), null);
  assert.match(SH.sizeWords(bytes.length), /^(\d+ B|[\d.]+ KB|[\d.]+ MB)$/);
});

test('the app page: manifest fields, the policy line, the data inlined equal, the size under the target', () => {
  const g = M.template('adventure');
  const html = APP.appPage(g, { player: 'console.log("player");' });
  assert.ok(html.length < 400_000, `${html.length} bytes`);
  assert.equal((html.match(/data:image\/png;base64,/g) ?? []).length, 1, 'the 64 KB icon is in the page once');
  assert.ok(html.length < 160_000, `with the icon once the page is about 90 KB beside the player: ${html.length} bytes`);
  const man = APP.manifestOf(g, '/s/my-adventure/');
  assert.equal(man.name, g.name);
  assert.equal(man.display, 'standalone');
  assert.equal(man.start_url, '/s/my-adventure/');
  assert.equal(man.scope, '/s/my-adventure/');
  assert.ok(man.icons.some((i) => i.sizes === '512x512'));
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /default-src 'none'/);
  assert.match(html, /script-src 'sha256-[A-Za-z0-9+/=]+'/);
  const m = html.match(/<script type="application\/json" id="game">([\s\S]*?)<\/script>/);
  assert.ok(m, 'the game is inlined');
  assert.deepEqual(JSON.parse(m[1].replace(/\\u003c/g, '<')), g);
  assert.equal((html.match(/<script(?![^>]*application\/json)/g) ?? []).length, 1, 'one script of code');
  assert.doesNotMatch(html, /https?:\/\//, 'no address in the page');
  assert.match(html, /<link rel="manifest"/);
});

test('his own eight bars parse in the kit’s note language and the presets play', () => {
  const t = TUNE.parseTune('C4 E4 G4 - | C5:2 G4 E4');
  assert.equal(t.length, 7);
  assert.equal(t[0].midi, 60);
  assert.equal(t[3].rest, true);
  assert.equal(t[4].beats, 2);
  assert.equal(TUNE.parseTune('H9 ??').length, 0);
  assert.ok(TUNE.parseTune(TUNE.PRESETS.hills).length >= 16);
  assert.equal(TUNE.bars('C4 E4 G4 C5 | C4 E4 G4 C5').length, 2);
});

test('the shelf is unchanged: the studio’s games are his, not the shelf’s', async () => {
  const { SHELF } = await O('shelf');
  assert.equal(SHELF.filter((x) => x.engine === 'studio').length, 0);
});
