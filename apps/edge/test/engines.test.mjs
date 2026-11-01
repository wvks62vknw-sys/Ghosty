// The arcade's engines (apps/web/src/arcade/engines, BRIEF-ENGINES): the SaveStore (in memory, and over IndexedDB with
// a stand-in database: per game, kept across opens), the Intent's mapping into each engine (DOOM's keys, analog move
// and turn; Quake's commands, move, look and menu keys; the touch and pad buttons each game shows all do something),
// the adapter interface's contract (both engines, their probe, a start without the game's files refused), the sound
// samples' conversion, and the lines that hold for the vendored engines (GPL kept whole: LICENCE, SOURCE.md naming the
// exact commit, build.sh, patches as diffs; no network in Quake; fetch.sh's checksums the shelf's own).
// Bundles are built here, with esbuild's API, like arcade.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync, readdirSync } from 'node:fs';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({
  entryPoints: ['types', 'saves', 'audio', 'doom', 'quake', 'index'].map((m) => at(`../../web/src/arcade/engines/${m}.ts`)).concat(at('../../web/src/arcade/input.ts'), at('../../web/src/arcade/shelf.ts'), at('../../web/src/arcade/dos.ts')),
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outdir: at('./.build/engines'),
  outExtension: { '.js': '.mjs' },
  logLevel: 'warning',
});
const types = await import('./.build/engines/engines/types.mjs');
const saves = await import('./.build/engines/engines/saves.mjs');
const audio = await import('./.build/engines/engines/audio.mjs');
const doom = await import('./.build/engines/engines/doom.mjs');
const quake = await import('./.build/engines/engines/quake.mjs');
const input = await import('./.build/engines/input.mjs');
const { SHELF } = await import('./.build/engines/shelf.mjs');
const engines = await import('./.build/engines/engines/index.mjs');
const dos = await import('./.build/engines/dos.mjs');

/** A small stand-in for IndexedDB: databases of object stores (key → structured clone), requests answered later. */
function fakeIDB() {
  const dbs = new Map();
  const later = (fn) => setTimeout(fn, 0);
  return {
    opened: 0,
    open(name) {
      this.opened++;
      const req = {};
      later(() => {
        let db = dbs.get(name);
        const fresh = !db;
        if (!db) {
          const stores = new Map();
          db = {
            objectStoreNames: { contains: (n) => stores.has(n) },
            createObjectStore: (n) => stores.set(n, new Map()),
            transaction(n) {
              const store = stores.get(n);
              const t = {};
              const answer = (result) => {
                const r = { result };
                later(() => t.oncomplete?.());
                return r;
              };
              t.objectStore = () => ({
                get: (k) => answer(store.has(k) ? structuredClone(store.get(k)) : undefined),
                put: (v, k) => (store.set(k, structuredClone(v)), answer(k)),
                getAllKeys: () => answer([...store.keys()].sort()),
              });
              return t;
            },
          };
          dbs.set(name, db);
        }
        req.result = db;
        if (fresh) req.onupgradeneeded?.();
        req.onsuccess?.();
      });
      return req;
    },
  };
}

const bytes = (...a) => new Uint8Array(a);

test('SaveStore in memory: missing is null, a put comes back as a copy, the list is sorted', async () => {
  const s = saves.memorySaves({ 'b.sav': bytes(9) });
  assert.equal(await s.get('nothing'), null);
  const data = bytes(1, 2, 3);
  await s.put('a.dsg', data);
  data[0] = 99; // the caller's array changing afterwards changes nothing kept
  const back = await s.get('a.dsg');
  assert.deepEqual([...back], [1, 2, 3]);
  back[1] = 77;
  assert.deepEqual([...(await s.get('a.dsg'))], [1, 2, 3]);
  assert.deepEqual(await s.list(), ['a.dsg', 'b.sav']);
});

test('SaveStore over IndexedDB: one game apart from another, kept across opens, memory where there is none', async () => {
  const idb = fakeIDB();
  const doomSaves = saves.saveStore('freedoom', idb);
  const quakeSaves = saves.saveStore('quake-shareware', idb);
  await doomSaves.put('.savegame/doomsav0.dsg', bytes(1, 2));
  await doomSaves.put('.default.cfg', bytes(3));
  await quakeSaves.put('id1/s0.sav', bytes(4, 5, 6));
  assert.deepEqual(await doomSaves.list(), ['.default.cfg', '.savegame/doomsav0.dsg']);
  assert.deepEqual(await quakeSaves.list(), ['id1/s0.sav']);
  assert.equal(await quakeSaves.get('.default.cfg'), null, "another game's file is not seen");
  // a new store for the same game (the next start) reads what the last one kept
  const again = saves.saveStore('freedoom', idb);
  assert.deepEqual([...(await again.get('.savegame/doomsav0.dsg'))], [1, 2]);
  await again.put('.savegame/doomsav0.dsg', bytes(7));
  assert.deepEqual([...(await doomSaves.get('.savegame/doomsav0.dsg'))], [7], 'a save written again replaces the old one');
  assert.equal(idb.opened, 3, 'each store opens the database once, however often it is used');
  assert.equal(saves.SAVES_DB, 'ghosty-arcade-saves');
  // no IndexedDB (a private window on some browsers): the game still plays, its saves in memory
  const mem = saves.saveStore('freedoom', undefined);
  await mem.put('x', bytes(1));
  assert.deepEqual(await mem.list(), ['x']);
});

test('the look is an amount an engine takes: returned in degrees and set back to 0', () => {
  const i = input.idle();
  i.lookX = 12.5;
  i.lookY = -3;
  assert.deepEqual(types.takeLook(i), { x: 12.5, y: -3 });
  assert.equal(i.lookX, 0);
  assert.equal(i.lookY, 0);
  i.lookX = NaN;
  assert.deepEqual(types.takeLook(i), { x: 0, y: 0 });
  assert.ok(types.hasArg(['-warp', '1'], '-WARP'.toLowerCase()));
  assert.ok(!types.hasArg(undefined, '-iwad'));
});

test("DOOM: the stick's amount as analog movement (full tilt runs), the look as mouse turning, fractions carried", () => {
  assert.deepEqual(doom.doomMove(0, 1), { forward: 50, side: 0 });
  assert.deepEqual(doom.doomMove(1, -1), { forward: -50, side: 40 });
  assert.deepEqual(doom.doomMove(-0.5, 0.5), { forward: 25, side: -20 });
  assert.deepEqual(doom.doomMove(3, -9), { forward: -50, side: 40 }, 'held to full tilt');
  assert.deepEqual(doom.doomMove(NaN, Infinity), { forward: 0, side: 0 });
  // 65,536 angle units a turn, 8 to a mouse unit: 90° is 2,048 mouse units
  assert.equal(doom.doomTurn(90).units, 2048);
  assert.equal(doom.doomTurn(-90).units, -2048);
  // a slow drag a hundredth of a degree at a time still turns: the fractions add up
  let carry = 0;
  let total = 0;
  for (let k = 0; k < 100; k++) {
    const t = doom.doomTurn(0.01, carry);
    carry = t.carry;
    total += t.units;
  }
  assert.equal(total, Math.trunc(doom.UNITS_PER_DEGREE));
  assert.ok(Math.abs(carry) < 1);
});

test("DOOM: the buttons are DOOM's own keys in a level, in its menu and when it asks yes or no", () => {
  const { KEY, DOOM_KEYS } = doom;
  const keys = (held, mode) => [...doom.doomKeys(new Set(held), mode)].sort((a, b) => a - b);
  assert.deepEqual(keys(['fire', 'use'], 'game'), [KEY.USE, KEY.FIRE].sort((a, b) => a - b));
  assert.deepEqual(keys(['weapon'], 'game'), [KEY.NEXT_WEAPON]);
  assert.deepEqual(keys(['weaponPrev', 'map', 'run'], 'game'), [KEY.TAB, KEY.PREV_WEAPON, KEY.RSHIFT].sort((a, b) => a - b));
  assert.deepEqual(keys(['pause'], 'game'), [KEY.ESCAPE], "the pause action opens DOOM's own menu");
  assert.deepEqual(keys(['jump'], 'game'), [], 'DOOM has no jump');
  assert.deepEqual(keys(['fire', 'use'], 'menu'), [KEY.ENTER], 'FIRE or USE picks in the menu');
  assert.deepEqual(keys(['weapon'], 'menu'), [KEY.BACKSPACE], 'WEAPON goes back a menu');
  assert.deepEqual(keys(['fire'], 'ask'), [KEY.YES]);
  assert.deepEqual(keys(['map'], 'ask'), [KEY.NO]);
  // the stick in the menu: past half-way it is an arrow key
  assert.equal(doom.menuArrow(0, 0.6), KEY.UP);
  assert.equal(doom.menuArrow(0, -0.6), KEY.DOWN);
  assert.equal(doom.menuArrow(0.7, 0), KEY.RIGHT);
  assert.equal(doom.menuArrow(-0.7, 0), KEY.LEFT);
  assert.equal(doom.menuArrow(0.3, -0.4), null);
  for (const mode of ['game', 'menu', 'ask']) for (const k of Object.values(DOOM_KEYS[mode])) assert.ok(Number.isInteger(k) && k > 0 && k < 256, `${mode}: key ${k}`);
});

test("DOOM: a finished level's tally as a score and Ghosty's words; the files it is given sorted into game and levels", () => {
  const r = doom.doomScore({ commercial: false, episode: 0, map: 0, kills: 10, maxKills: 20, items: 5, maxItems: 10, secrets: 1, maxSecrets: 3, tics: 35 * 83, parTics: 35 * 30 });
  assert.equal(r.score, 50 + 50 + 33);
  assert.equal(r.words, 'E1M1 done: kills 50%, items 50%, secrets 33%, time 1:23 (par 0:30).');
  const none = doom.doomScore({ commercial: true, episode: 0, map: 6, kills: 0, maxKills: 0, items: 0, maxItems: 0, secrets: 0, maxSecrets: 0, tics: 0, parTics: 0 });
  assert.equal(none.score, 300, 'a level with nothing to find counts as all found, as DOOM shows it');
  assert.equal(none.words, 'MAP07 done: kills 100%, items 100%, secrets 100%, time 0:00.');
  assert.equal(doom.levelName(false, 4, 9), 'E4M9');
  const wad = (kind) => new Uint8Array([...kind].map((c) => c.charCodeAt(0)).concat([0, 0, 0, 0]));
  assert.deepEqual(doom.pickWads({ 'freedoom2.wad': wad('IWAD'), 'freedoom1.wad': wad('IWAD'), 'scythe.wad': wad('PWAD'), 'readme.txt': wad('TEXT') }), { iwad: 'freedoom1.wad', pwads: ['scythe.wad'] });
  assert.deepEqual(doom.pickWads({ 'x.wad': wad('PWAD') }), { iwad: null, pwads: ['x.wad'] });
  assert.equal(doom.fileName('Doom/DOOM1.WAD'), 'doom1.wad');
  // the saved games and settings kept, never the half-written temp file or the game's own files
  assert.equal(doom.keptName('/doom/.savegame/doomsav3.dsg'), '.savegame/doomsav3.dsg');
  assert.equal(doom.keptName('/doom/.default.cfg'), '.default.cfg');
  assert.equal(doom.keptName('/doom/.savegame/temp.dsg'), null);
  assert.equal(doom.keptName('/doom/doom1.wad'), null);
  assert.equal(doom.keptName('/tmp/x.cfg'), null);
  assert.equal(doom.enginePath('./.savegame/doomsav0.dsg'), '/doom/.savegame/doomsav0.dsg');
  assert.equal(doom.enginePath('/doom/a/../b.cfg'), '/doom/b.cfg');
});

test("QUAKE: the stick (full tilt runs), the look (yaw, and pitch held to Quake's limits), the menu's arrows", () => {
  assert.deepEqual(quake.quakeMove(0, 1), { forward: 400, side: 0 });
  assert.deepEqual(quake.quakeMove(-1, -0.5), { forward: -200, side: -350 });
  assert.deepEqual(quake.quakeMove(NaN, 5), { forward: 400, side: 0 });
  const a = [0, 90, 0];
  quake.quakeLook(a, 30, 0);
  assert.deepEqual(a, [0, 60, 0], 'a look right turns the yaw down (it grows to the left)');
  quake.quakeLook(a, 0, 20);
  assert.equal(a[0], -20, 'a look up tilts the pitch up (it grows looking down)');
  quake.quakeLook(a, 0, 500);
  assert.equal(a[0], -70, 'no further up than 70°');
  quake.quakeLook(a, 0, -500);
  assert.equal(a[0], 80, 'no further down than 80°');
  quake.quakeLook(a, NaN, NaN);
  assert.deepEqual(a, [80, 60, 0]);
  assert.equal(quake.quakeArrow(0, 1), quake.QKEY.UP);
  assert.equal(quake.quakeArrow(0, -1), quake.QKEY.DOWN);
  assert.equal(quake.quakeArrow(0, 0.2), null);
  // the pixel ratio: never above 2, never more than 1920 pixels across, never below 1
  assert.equal(quake.quakeRatio(844, 390, 3), 2);
  assert.equal(quake.quakeRatio(1200, 800, 2), 1.6);
  assert.equal(quake.quakeRatio(844, 390, 1), 1);
  assert.equal(quake.quakeRatio(3000, 2000, 2), 1);
  assert.equal(quake.quakeRatio(0, 0, 0), 1);
});

test("QUAKE: the buttons are Quake's own commands and menu keys; its files where it looks; a tally in words", () => {
  assert.deepEqual(quake.QUAKE_HOLD, { fire: 'attack', jump: 'jump', run: 'speed' });
  assert.deepEqual(quake.QUAKE_PRESS, { weapon: 'impulse 10', weaponPrev: 'impulse 12' });
  for (const c of Object.values(quake.QUAKE_HOLD)) assert.ok(quake.QUAKE_KEYNUM[c] > 255, `${c} carries a key number no real key has`);
  assert.equal(quake.QUAKE_MENU.fire, quake.QKEY.ENTER);
  assert.equal(quake.QUAKE_MENU.weapon, quake.QKEY.ESCAPE);
  assert.equal(quake.QUAKE_MENU.pause, quake.QKEY.ESCAPE);
  // "quit? y/n": FIRE says yes, WEAPON no (ENTER means nothing there)
  assert.equal(quake.QUAKE_ASK.fire, quake.QKEY.YES);
  assert.equal(quake.QUAKE_ASK.weapon, quake.QKEY.NO);
  assert.equal(String.fromCharCode(quake.QKEY.YES, quake.QKEY.NO), 'yn');
  assert.deepEqual(Object.keys(quake.quakePaths({ 'pak0.pak': bytes(1), 'ID1/CONFIG.CFG': bytes(2), '/hipnotic/pak0.pak': bytes(3) })), ['id1/pak0.pak', 'id1/config.cfg', 'hipnotic/pak0.pak']);
  const r = quake.quakeScore({ map: 'e1m1', levelname: 'the Slipgate Complex', kills: 15, totalKills: 30, secrets: 1, totalSecrets: 6, seconds: 125.4 });
  assert.equal(r.score, 50 + 16);
  assert.equal(r.words, 'the Slipgate Complex (e1m1) done: kills 15/30, secrets 1/6, time 2:05.');
  assert.equal(quake.quakeScore({ map: null, levelname: '', kills: 0, totalKills: 0, secrets: 0, totalSecrets: 0, seconds: 0 }).score, 200);
  assert.equal(quake.MAX_FPS, 72);
});

test('every button each game shows on the touch layer and every pad button does something in its engine', () => {
  const doomGame = doom.DOOM_KEYS.game;
  const quakeDoes = (a) => a in quake.QUAKE_HOLD || a in quake.QUAKE_PRESS || a === 'pause';
  const does = { doom: (a) => doomGame[a] !== undefined, quake: quakeDoes };
  const known = (k) => k.split('+').every((part) => dos.KEYS[part] !== undefined);
  for (const g of SHELF) {
    if (g.engine === 'dos') {
      // a DOS game shows its own CONTROLS block: each button presses DOS keys that exist, and a controller reaches each
      // (its pad slots are the DOS engine's: the ones the game fills press its keys, START is the player's PAUSE)
      const shown = g.dos.controls.buttons;
      assert.ok(shown.length > 0, `${g.id}: buttons`);
      for (const b of shown) {
        assert.ok(known(b.key) && (b.cycle ?? []).every(known), `${g.id}: the ${b.label} button presses no DOS key`);
        assert.ok(Object.values(input.PAD_BUTTONS.dos).includes(b.act), `${g.id}: no pad button reaches ${b.label}`);
      }
      continue;
    }
    const buttons = input.touchButtons(g.controls);
    assert.ok(buttons.length > 0, `${g.id}: buttons`);
    for (const a of buttons) assert.ok(does[g.engine](a), `${g.id}: the ${a} button does nothing`);
    for (const a of Object.values(input.PAD_BUTTONS[g.engine])) assert.ok(does[g.engine](a), `${g.id}: the pad's ${a} does nothing`);
  }
  assert.equal(input.PAD_BUTTONS.dos[input.BTN.START], 'pause');
});

test('the adapter interface: both engines, and a start without the game in the files is refused before it draws', async () => {
  assert.equal(doom.doom.id, 'doom');
  assert.equal(quake.quake.id, 'quake');
  for (const e of [doom.doom, quake.quake]) assert.equal(typeof e.start, 'function');
  // the player's own registry: every game on the shelf has its engine there
  for (const g of SHELF) assert.equal(engines.engineFor(g)?.id, g.engine, `${g.id}: its engine is here`);
  assert.deepEqual([engines.ENGINES.doom.id, engines.ENGINES.quake.id, engines.ENGINES.dos.id], ['doom', 'quake', 'dos']);
  const canvas = {}; // never touched: the refusal comes first
  const ev = { onError: () => assert.fail('no error event for a refusal: start() itself rejects') };
  await assert.rejects(doom.doom.start(canvas, { 'readme.txt': bytes(1) }, input.idle(), ev, { saves: saves.memorySaves(), sound: false }), /no DOOM game/);
  await assert.rejects(quake.quake.start(canvas, { 'pak1.pak': bytes(1) }, input.idle(), ev, { saves: saves.memorySaves(), sound: false }), /no Quake game/);
  assert.equal(doom.DOOM_VENDOR, '/vendor/doom');
  assert.equal(quake.QUAKE_VENDOR, '/vendor/quake');
});

test('the sound samples: 8-bit unsigned and 16-bit signed PCM to floats, resampled to the output rate', () => {
  assert.deepEqual([...audio.pcm8(bytes(0, 128, 255), 11025, 11025)], [-1, 0, 127 / 128]);
  const up = audio.pcm8(bytes(128, 255), 11025, 22050);
  assert.equal(up.length, 4, 'twice the rate, twice the samples');
  assert.ok(up[1] > 0 && up[1] < up[2], 'in between, a straight line');
  assert.equal(audio.pcm8(new Uint8Array(0), 11025, 48000).length, 0);
  const s16 = new Uint8Array(new Int16Array([-32768, 0, 16384]).buffer);
  assert.deepEqual([...audio.pcm16(s16, 22050, 22050)], [-1, 0, 0.5]);
  assert.equal(audio.pcm16(s16, 0, 48000).length, 0);
});

test('the lines that hold: each engine vendored with its LICENCE, SOURCE.md at an exact commit, build.sh and patches as diffs', () => {
  const vendor = at('../../web/public/vendor/');
  const commits = { doom: 'e257a09527062bfb986b6e5e0780839b6cbd5b71', quake: '917617ffdfe42fa9dca41bf1762f16a2e71f2d7b' };
  for (const [engine, sha] of Object.entries(commits)) {
    const dir = `${vendor}${engine}/`;
    assert.match(readFileSync(`${dir}LICENCE`, 'utf8'), /GNU GENERAL PUBLIC LICENSE[\s\S]*Version 2, June 1991/, `${engine}: GPL-2 whole`);
    const source = readFileSync(`${dir}SOURCE.md`, 'utf8');
    assert.ok(source.includes(sha), `${engine}: SOURCE.md names the commit`);
    const sh = readFileSync(`${dir}build.sh`, 'utf8');
    assert.ok(sh.includes(sha), `${engine}: build.sh checks the commit`);
    const patches = readdirSync(`${dir}patches`);
    assert.ok(patches.length >= 3 && patches.every((p) => p.endsWith('.diff')), `${engine}: patches as diffs`);
    for (const p of patches) assert.match(readFileSync(`${dir}patches/${p}`, 'utf8'), /^--- a\/.*\n\+\+\+ b\//m, `${engine}: ${p} is a unified diff`);
  }
  const wasm = readFileSync(`${vendor}doom/doom.wasm`);
  assert.deepEqual([...wasm.subarray(0, 4)], [0, 0x61, 0x73, 0x6d], 'doom.wasm is WebAssembly');
  const doomJs = readFileSync(`${vendor}doom/doom.js`, 'utf8');
  assert.ok(/export default GhostyDoom/.test(doomJs) && !/\beval\(|new Function/.test(doomJs), 'doom.js: a module, no eval');
  assert.ok(readFileSync(`${vendor}doom/SOURCE.md`, 'utf8').includes('Music is not played'), 'DOOM says it plays no music');
  const quakeJs = readFileSync(`${vendor}quake/quake.js`, 'utf8');
  assert.ok(quakeJs.startsWith('/* quake.js: WebQuake') && quakeJs.includes('self.GhostyQuake = function (host)'), 'quake.js: one function');
  assert.ok(quakeJs.includes('NET.drivers = [Loop];') && !/new WebSocket\(host/.test(quakeJs.replace(/\/\/ ---- WebQuake\/NET_WEBS\.js ----[\s\S]*?\/\/ ---- /, '')), 'quake.js: no network driver');
  assert.ok(!/\beval\(|new Function/.test(quakeJs), 'quake.js: no eval');
});

test("tests/fixtures/engines/fetch.sh fetches exactly the shelf's packages: the same mirrors, sizes and checksums", () => {
  const sh = readFileSync(at('../../../tests/fixtures/engines/fetch.sh'), 'utf8');
  const gets = [...sh.matchAll(/^get (\S+) ([0-9a-f]{64}) (\d+) \\\n((?:\s+https:\S+(?: \\)?\n)+)/gm)].map((m) => ({ file: m[1], sha256: m[2], bytes: Number(m[3]), urls: m[4].match(/https:\S+/g) }));
  assert.equal(gets.length, 3);
  const games = SHELF.filter((g) => g.engine === 'doom' || g.engine === 'quake');
  for (const g of games) {
    const f = gets.find((x) => x.sha256 === g.data.sha256);
    assert.ok(f, `${g.id}: fetch.sh fetches its package`);
    assert.equal(f.bytes, g.data.bytes, `${g.id}: size`);
    assert.deepEqual(f.urls, g.data.url, `${g.id}: mirrors`);
    assert.equal(f.file, decodeURIComponent(g.data.url[0].split('/').pop()).split('/').pop(), `${g.id}: the file name the harness reads`);
  }
  assert.match(readFileSync(at('../../../tests/fixtures/engines/.gitignore'), 'utf8'), /^data\/$/m, 'the data is never committed');
});
