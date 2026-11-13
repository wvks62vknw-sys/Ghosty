// BRIEF-KERNEL-3 item 4: the `game` tool. `make` builds a studio project from the studio's OWN KIT (rooms painted from its tile sets, the hero's
// sprite re-coloured from the studio's own sheet, one person with the words the brain wrote, one quest, a save point) that the studio's own
// reader accepts and that plays; it is opened for him to edit and kept in his library, never published, nothing drawn by a model. `read` and
// `edit` look at and PROPOSE changes to the game open in the studio. Named in the test list of package.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

await build({ entryPoints: ['../../packages/shared/src/openwork.ts'], bundle: true, format: 'esm', platform: 'neutral', outfile: 'test/.build/openwork.mjs', logLevel: 'warning' });
await build({ entryPoints: ['../web/src/studio-game/model.ts'], bundle: true, format: 'esm', platform: 'neutral', outfile: 'test/.build/game-tool/model.mjs', logLevel: 'warning' });
const O = await import('./.build/openwork.mjs');
const M = await import('./.build/game-tool/model.mjs');
const T = await import('./.build/tools/index.mjs');
const P = await import('./.build/prompt.mjs');
const game = T.toolByName.get('game');
assert.ok(game, 'the game tool is in the list');

function world(turns) {
  const m = new Map([['turns', turns.map((text, i) => ({ role: i % 2 ? 'assistant' : 'user', text, at: i }))]]);
  const sent = [];
  const ctx = { storage: { get: async (k) => structuredClone(m.get(k)), put: async (k, v) => void m.set(k, v) }, emit: (e) => sent.push(e) };
  return { ctx, sent, snapshot: () => JSON.stringify([...m]) };
}
const FOX = { op: 'make', name: 'Fox Run', kind: 'platformer', world: 'hills', colour: 'Sunset', person: 'Old Badger', lines: ['Welcome, little fox! The hills are full of coins.', 'Bring me three and I will tell you a secret.'], quest: 'The badger’s secret' };
const countOf = (g, letter) => g.rooms.reduce((n, r) => n + r.rows.reduce((m, row) => m + [...row].filter((c) => c === letter).length, 0), 0);

test('game make: a project the studio\'s own reader accepts, with a room, a sprite, a person, a quest and a save point; opened on the phone, never published', async () => {
  const w = world(['make me a platformer about a fox']);
  const before = w.snapshot();
  const r = await game.run(FOX, w.ctx);
  assert.match(r, /^Built and kept in his studio library, open for him to edit: “Fox Run”: a platformer of 2 rooms/);
  assert.match(r, /1 person \(Old Badger\), 1 quest and 1 save point/);
  assert.match(r, /Nothing is published or drawn by a model/);
  assert.equal(w.sent.length, 1);
  assert.equal(w.sent[0].name, 'open_game');
  const g = w.sent[0].args.game;
  // the studio's own validator reads it back whole and finds nothing that would stop it playing
  const read = M.readGame(JSON.parse(JSON.stringify(g)));
  assert.ok(read, 'readGame accepts it');
  assert.equal(read.lost, 0, 'nothing in it is lost on reading');
  assert.deepEqual(M.hardProblems(read.game), [], 'nothing stops PLAY');
  assert.equal(g.name, 'Fox Run');
  assert.equal(g.kind, 'platformer');
  assert.ok(g.rooms.length >= 1 && g.rooms.every((rm) => rm.rows.length === rm.h && rm.rows.every((row) => row.length === rm.w)));
  assert.ok(g.sprites.length >= 1 && g.sprites.some((s) => s.id === 'hero'));
  assert.equal(g.npcs.length, 1);
  assert.equal(g.npcs[0].name, 'Old Badger');
  assert.deepEqual(g.npcs[0].lines.map((l) => l.text), FOX.lines, 'the brain\'s words are the dialogue');
  assert.equal(g.quests.length, 1);
  assert.equal(g.quests[0].name, 'The badger’s secret');
  assert.ok(countOf(g, 'V') >= 1, 'a save point');
  assert.ok(countOf(g, 'N') >= 1 && countOf(g, 'P') >= 1, 'the person stands in a room and the hero starts in one');
  assert.equal(g.palette, 'hills');
  assert.equal(w.snapshot(), before, 'the brain stores nothing: the phone keeps the game');
});

test('game make: built from the kit alone: the hero\'s sprite is the studio\'s own, only its body re-coloured to an ink of the kit; no tile or sprite is new', async () => {
  const w = world(['x']);
  await game.run(FOX, w.ctx);
  const g = w.sent[0].args.game;
  const own = M.defaultSprites().find((s) => s.id === 'hero');
  const hero = g.sprites.find((s) => s.id === 'hero');
  const SUNSET = M.INKS.findIndex((i) => i.name === 'Sunset').toString(16);
  assert.notEqual(hero.anims.idle[0], own.anims.idle[0], 'the hero is re-coloured');
  assert.equal(hero.anims.idle[0], own.anims.idle[0].replaceAll('8', SUNSET), 'the studio\'s own drawing with one ink swapped for another of the kit');
  assert.ok(g.sprites.every((s) => M.defaultSprites().some((d) => d.id === s.id) || s.id === 'icon-coin'), 'every sprite is one of the studio\'s own sheets');
  assert.deepEqual(g.tiles, [], 'no tile of its own: the kit\'s tiles only');
  assert.ok(g.rooms.every((rm) => [...rm.rows.join('')].every((c) => M.ALL_LETTERS.includes(c))), 'every tile is a letter of the studio\'s language');
  // no colour outside the kit: a world is a name of the kit's, an unknown one is left as the template had it
  const odd = world(['x']);
  await game.run({ ...FOX, world: 'neon', colour: 'Chartreuse' }, odd.ctx);
  assert.equal(odd.sent[0].args.game.palette, 'hills');
  assert.equal(odd.sent[0].args.game.sprites.find((s) => s.id === 'hero').anims.idle[0], own.anims.idle[0], 'an ink that is not the kit\'s changes nothing');
  // a top-down adventure comes from the studio's adventure template, its person renamed and speaking the new words
  const td = world(['x']);
  await game.run({ op: 'make', name: 'Cave Folk', kind: 'topdown', person: 'Ada', lines: ['Mind the cave.'] }, td.ctx);
  const t = td.sent[0].args.game;
  assert.equal(t.kind, 'topdown');
  assert.deepEqual([t.npcs[0].name, t.npcs[0].lines.map((l) => l.text)], ['Ada', ['Mind the cave.']]);
  assert.deepEqual(M.hardProblems(M.readGame(JSON.parse(JSON.stringify(t))).game), []);
  await assert.rejects(() => game.run({ op: 'make' }, world(['x']).ctx), /missing "name"/);
});

const open = () =>
  O.openWorkBlock('game', `game | name ${O.q('Fox Run')} | kind platformer`, [
    `room hills | name ${O.q('Green hills')} | w 40 | h 12`,
    `room cave | name ${O.q('Glow cave')} | w 30 | h 12`,
    `person old-badger | name ${O.q('Old Badger')} | line ${O.q('Welcome, little fox!')} | line ${O.q('Bring me three coins.')}`,
    `quest the-first-favour | name ${O.q('The first favour')} | steps 3 | reward ${O.q('Thank you.')}`,
  ]);
const message = (words) => `${words}${open()}`;

test('game read and edit: the open game\'s rooms, people and quests; a room\'s size, a person\'s lines and a quest\'s name are each a PROPOSAL; nothing is applied', async () => {
  const w = world([message('what is in my game?')]);
  const r = await game.run({ op: 'read' }, w.ctx);
  assert.match(r, /^"Fox Run": platformer, 2 rooms, 1 person, 1 quest\./);
  assert.match(r, /Room "Green hills": 40 by 12 tiles/);
  assert.match(r, /Person "Old Badger": "Welcome, little fox!" \/ "Bring me three coins\."/);
  assert.match(r, /Quest "The first favour": 3 steps, reward line "Thank you\."/);
  assert.equal(w.sent.length, 0);
  assert.match(await game.run({ op: 'read' }, world(['hello']).ctx), /No game is open on his phone/);
  const e = world([message('make the first room wider')]);
  const before = e.snapshot();
  const rr = await game.run({ op: 'edit', room: 'green hills', w: 56 }, e.ctx);
  assert.match(rr, /"Green hills" resized from 40 by 12 to 56 by 12 tiles\. NOTHING is changed until he taps ACCEPT/);
  assert.deepEqual(e.sent[0], { t: 'client', name: 'game', args: { change: 'room', room: 'hills', name: 'Green hills', w: 56, h: 12, oldW: 40, oldH: 12 } });
  await game.run({ op: 'edit', person: 'badger', lines: ['Hello again, fox.'] }, e.ctx);
  assert.deepEqual(e.sent[1].args, { change: 'dialogue', person: 'old-badger', name: 'Old Badger', old: 'Welcome, little fox!\nBring me three coins.', lines: ['Hello again, fox.'] });
  await game.run({ op: 'edit', quest: 'first favour', text: 'The badger\'s favour' }, e.ctx);
  assert.deepEqual(e.sent[2].args, { change: 'quest', quest: 'the-first-favour', old: 'The first favour', text: 'The badger\'s favour' });
  assert.equal(e.snapshot(), before, 'the brain applies nothing');
  // what the studio would refuse is refused here, in the studio's own numbers
  const n = world([message('x')]);
  await assert.rejects(() => game.run({ op: 'edit', room: 'hills', w: 200 }, n.ctx), new RegExp(`${M.MAX_W} tiles wide and ${M.MAX_H} high at most`));
  await assert.rejects(() => game.run({ op: 'edit', room: 'hills', w: 2 }, n.ctx), new RegExp(`${M.MIN_W} by ${M.MIN_H} tiles at the least`));
  await assert.rejects(() => game.run({ op: 'edit', room: 'attic', w: 20 }, n.ctx), /no room called "attic": "Green hills", "Glow cave"/);
  await assert.rejects(() => game.run({ op: 'edit', person: 'badger' }, n.ctx), /give lines/);
  await assert.rejects(() => game.run({ op: 'edit', quest: 'first favour' }, n.ctx), /give text/);
  await assert.rejects(() => game.run({ op: 'edit' }, n.ctx), /say what to change/);
  assert.match(await game.run({ op: 'edit', room: 'hills', w: 40 }, n.ctx), /already is/);
  assert.match(await game.run({ op: 'edit', room: 'hills', w: 40 }, world(['hello']).ctx), /No game is open/);
  assert.equal(n.sent.length, 0, 'the refusals sent nothing');
});

test('game: one tool, nothing it does applies or publishes, named when off and described when his words call for it, inside the prompt\'s ceilings', () => {
  assert.equal(game.risk, 'auto');
  assert.equal(game.parameters.properties.op.enum.join(), 'make,read,edit');
  assert.ok(game.description.length <= 1000);
  assert.ok(!/publish_site|build_app|sites/i.test(JSON.stringify(game.parameters)) && /never published/.test(game.description));
  const off = T.selectGroups('hello', new Set(), false);
  assert.ok(off.off.some((g) => g.name === 'game') && !off.on.some((g) => g.name === 'game'));
  assert.ok(!T.selectTools('hello', new Set(), false).some((t) => t.name === 'game'), 'not described on a plain turn');
  for (const t of ['make me a platformer about a fox', 'open my games', 'make a top-down adventure game', 'make the first room wider', 'give the quest a better name']) assert.ok(T.selectTools(t, new Set(), false).some((x) => x.name === 'game'), t);
  assert.ok(!T.selectTools('build me a snake game', new Set(), true).some((x) => x.name === 'game'), 'a widget game is not a studio game');
  const g = T.TOOL_GROUPS.find((x) => x.name === 'game');
  assert.match(g.about, /^You can /);
  assert.ok(g.about.length <= 220 && g.about.includes('game'));
  const hello = JSON.stringify(T.toolSpecs(T.selectTools('hello', new Set(), false))).length;
  assert.ok(hello < 6500, `hello: ${hello}`);
  const sys = P.systemPrompt({ name: 'boss', now: 'Fri 17 Oct 14:05', tz: 'Europe/London', tab: 'core' }, [], true, [], { code: false, groups: T.selectGroups('hello', new Set(), false) });
  assert.ok(sys.length <= 5500 && /^game: game$/m.test(sys), `plain prompt ${sys.length}`);
});
