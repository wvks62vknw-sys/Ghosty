// The arcade's phone modules (apps/web/src/arcade): the shelf registry and the free level packs (every field, every
// url https, every sha256 64 hex, bytes > 0, licence and credit non-empty), the scores store, the touch and gamepad
// mappings (standard-mapping indices → each game's inputs), the Learnable contract, the ZIP reader (a self-extractor's
// stub in front, stored and deflated members, CRC-32) and GET's store (mirrors in order, size and SHA-256 checked, the
// files taken out on the phone and kept in the Cache API, deleted in one tap). No network: a stand-in fetch serves
// packages built here.
// Bundles are built here, with esbuild's API, like school.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { crc32 as zcrc, deflateRawSync } from 'node:zlib';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({
  entryPoints: ['shelf', 'levels', 'scores', 'input', 'learnable', 'zip', 'store'].map((m) => at(`../../web/src/arcade/${m}.ts`)),
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outdir: at('./.build/arcade'),
  outExtension: { '.js': '.mjs' },
  logLevel: 'warning',
});
const { SHELF, FREEDOOM } = await import('./.build/arcade/shelf.mjs');
const { LEVELS } = await import('./.build/arcade/levels.mjs');
const scores = await import('./.build/arcade/scores.mjs');
const input = await import('./.build/arcade/input.mjs');
const { checkLearnable } = await import('./.build/arcade/learnable.mjs');
const zip = await import('./.build/arcade/zip.mjs');
const store = await import('./.build/arcade/store.mjs');

const HEX64 = /^[0-9a-f]{64}$/;
const CONTROLS = ['move', 'look', 'fire', 'use', 'weapon', 'jump', 'map'];

function checkData(where, d) {
  assert.ok(Array.isArray(d.url) && d.url.length > 0, `${where}: no mirrors`);
  for (const u of d.url) assert.equal(new URL(u).protocol, 'https:', `${where}: ${u} is not https`);
  assert.match(d.sha256, HEX64, `${where}: sha256`);
  assert.ok(Number.isInteger(d.bytes) && d.bytes > 0, `${where}: bytes`);
  assert.ok(d.licence.trim().length > 10, `${where}: licence`);
  // only what its own licence lets anyone pass on, said in its words
  assert.match(d.licence, /free|BSD|distribut|pass(ed)? on|Creative Commons/i, `${where}: the licence must say it may be passed on`);
  assert.ok(d.credit.trim().length > 3, `${where}: credit`);
  assert.ok(Array.isArray(d.take) && d.take.length > 0, `${where}: nothing to take out`);
  for (const t of d.take) {
    assert.ok(t.name && !t.name.includes('/'), `${where}: a taken file's name`);
    assert.ok(Array.isArray(t.from) && t.from.length > 0 && t.from.every(Boolean), `${where}: ${t.name} comes from nothing`);
    if (t.sha256 !== undefined) assert.match(t.sha256, HEX64, `${where}: ${t.name} sha256`);
  }
}

test('the shelf: every entry whole, Freedoom the default DOOM, mirrors https, sizes and checksums well formed', () => {
  assert.ok(SHELF.length >= 3);
  assert.equal(new Set(SHELF.map((g) => g.id)).size, SHELF.length, 'ids are unique');
  assert.equal(SHELF[0].id, 'freedoom');
  assert.equal(SHELF[0].line, 'DOOM, the free version with its own levels.');
  for (const g of SHELF) {
    for (const k of ['id', 'title', 'line', 'ghosty', 'done']) assert.ok(typeof g[k] === 'string' && g[k].trim(), `${g.id}: ${k}`);
    assert.ok(['doom', 'quake'].includes(g.engine), `${g.id}: engine`);
    assert.equal(typeof g.saves, 'boolean');
    assert.match(g.since, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(g.controls.every((c) => CONTROLS.includes(c)), `${g.id}: controls`);
    for (const c of ['move', 'look', 'fire']) assert.ok(g.controls.includes(c), `${g.id}: needs ${c}`);
    checkData(g.id, g.data);
  }
  // Quake has JUMP; DOOM has FIRE / USE / WEAPON
  assert.ok(SHELF.find((g) => g.engine === 'quake').controls.includes('jump'));
  for (const g of SHELF.filter((x) => x.engine === 'doom')) for (const c of ['use', 'weapon']) assert.ok(g.controls.includes(c));
  // the shareware DOOM's WAD is taken out of its two floppy parts (one self-extracting archive) on the phone
  const sw = SHELF.find((g) => g.id === 'doom-shareware').data.take[0];
  assert.deepEqual(sw.from, ['DOOMS_19.1', 'DOOMS_19.2']);
  assert.equal(sw.inner, 'DOOM1.WAD');
  assert.equal(FREEDOOM.take.map((t) => t.name).join(), 'freedoom1.wad,freedoom2.wad');
});

test('the free levels: a dozen packs, each whole, credited, over the Freedoom phase it needs', () => {
  assert.equal(LEVELS.length, 12);
  assert.equal(new Set(LEVELS.map((p) => p.id)).size, LEVELS.length);
  for (const p of LEVELS) {
    for (const k of ['id', 'title', 'author', 'line']) assert.ok(typeof p[k] === 'string' && p[k].trim(), `${p.id}: ${k}`);
    assert.ok(['freedoom1', 'freedoom2'].includes(p.base), `${p.id}: base`);
    assert.ok(FREEDOOM.take.some((t) => t.name === `${p.base}.wad`), `${p.id}: its base comes with Freedoom`);
    checkData(p.id, p.data);
    assert.ok(p.data.take.some((t) => t.name.endsWith('.wad')), `${p.id}: has a WAD`);
    assert.ok(p.data.take.every((t) => /\.(wad|deh)$/.test(t.name)), `${p.id}: takes only WADs and DeHackEd patches`);
    assert.ok(p.data.url.every((u) => u.startsWith('https://archive.org/cors/idgames_202003/')), `${p.id}: from the idgames copy`);
  }
});

test('the scores store: best, last and when per game; a damaged record reads as none', () => {
  const mem = new Map();
  globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  try {
    assert.equal(scores.scoreOf('freedoom'), null);
    const t0 = new Date('2026-11-01T10:00:00Z');
    assert.deepEqual(scores.recordScore('freedoom', 1200, t0), { score: { best: 1200, last: 1200, when: t0.toISOString() }, isBest: true });
    const r = scores.recordScore('freedoom', 800, new Date('2026-11-01T11:00:00Z'));
    assert.equal(r.isBest, false);
    assert.deepEqual([r.score.best, r.score.last], [1200, 800]);
    assert.equal(scores.recordScore('freedoom', 1500.4).score.best, 1500);
    assert.equal(scores.recordScore('quake-shareware', Number.NaN).score.best, 0);
    assert.deepEqual(Object.keys(JSON.parse(mem.get(scores.SCORES_KEY))).sort(), ['freedoom', 'quake-shareware']);
    mem.set(scores.SCORES_KEY, '{not json');
    assert.deepEqual(scores.allScores(), {});
    mem.set(scores.SCORES_KEY, JSON.stringify({ a: { best: 'x' }, b: { best: 5, last: 4, when: 'w' } }));
    assert.deepEqual(Object.keys(scores.allScores()), ['b']);
    scores.clearScore('b');
    assert.equal(scores.scoreOf('b'), null);
  } finally {
    delete globalThis.localStorage;
  }
});

test('the touch mapping: the stick has a dead zone and never runs past 1; dragging turns; up is forward', () => {
  const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);
  assert.deepEqual(input.stick(0.1, 0.05), { x: 0, y: 0 });
  close(input.stick(1, 0).x, 1);
  const far = input.stick(3, 4);
  close(Math.hypot(far.x, far.y), 1);
  const half = input.stick(0.575, 0);
  close(half.x, 0.5);
  const fwd = input.touchMove(0, -60, 60);
  assert.deepEqual([fwd.moveX, fwd.moveY], [0, 1]);
  const back = input.touchMove(0, 60, 60);
  assert.equal(back.moveY, -1);
  assert.equal(input.touchMove(-60, 0, 60).moveX, -1);
  close(input.touchLook(100, 0).lookX, 23);
  close(input.touchLook(0, -10, 2).lookY, 4.6);
  assert.deepEqual(input.touchButtons(SHELF[0].controls), ['fire', 'use', 'weapon', 'map']);
  assert.deepEqual(input.touchButtons(SHELF.find((g) => g.engine === 'quake').controls), ['fire', 'jump', 'weapon']);
});

test('the gamepad mapping: standard indices → each game\'s inputs; sticks move and look; d-pad walks', () => {
  const pad = (pressed = [], axes = [0, 0, 0, 0], mapping = 'standard') => ({ mapping, axes, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 })) });
  const B = input.BTN;
  assert.equal(input.readPad(pad([B.RT]), 'doom', 1 / 60).held.has('fire'), true);
  assert.equal(input.readPad(pad([B.RT]), 'quake', 1 / 60).held.has('fire'), true);
  assert.deepEqual([...input.readPad(pad([B.A]), 'doom', 0).held], ['use']);
  assert.deepEqual([...input.readPad(pad([B.A]), 'quake', 0).held], ['jump']);
  assert.ok(input.readPad(pad([B.RB]), 'doom', 0).held.has('weapon'));
  assert.ok(input.readPad(pad([B.LB]), 'doom', 0).held.has('weaponPrev'));
  assert.ok(input.readPad(pad([B.START]), 'quake', 0).held.has('pause'));
  assert.ok(input.readPad(pad([B.Y]), 'doom', 0).held.has('map'));
  // a trigger half pulled counts once past half way
  const t = pad();
  t.buttons[B.RT] = { pressed: false, value: 0.7 };
  assert.ok(input.readPad(t, 'doom', 0).held.has('fire'));
  const walk = input.readPad(pad([], [0, -1, 0, 0]), 'doom', 0);
  assert.deepEqual([walk.moveX, walk.moveY], [0, 1]);
  assert.equal(input.readPad(pad([B.DOWN]), 'doom', 0).moveY, -1);
  assert.equal(input.readPad(pad([B.LEFT]), 'doom', 0).moveX, -1);
  const turn = input.readPad(pad([], [0, 0, 1, 0]), 'doom', 0.5);
  assert.ok(Math.abs(turn.lookX - input.PAD_TURN_RATE * 0.5) < 1e-9);
  assert.equal(input.readPad(pad([], [0, 0, 0.1, 0]), 'doom', 1).lookX, 0, 'the dead zone holds on the look stick');
  assert.equal(input.readPad(pad([B.RT], [0, 0, 0, 0], ''), 'doom', 0), null, 'no standard mapping: no guessing');
  // both layers together, and the edges an engine turns into key downs and ups
  const both = input.merge({ moveX: 0.8, moveY: 0, lookX: 2, lookY: 0, held: new Set(['fire']) }, { moveX: 0.8, moveY: 1, lookX: 3, lookY: 0, held: new Set(['use']) });
  assert.deepEqual([both.moveX, both.moveY, both.lookX, [...both.held].sort().join()], [1, 1, 5, 'fire,use']);
  assert.deepEqual(input.edges(new Set(['fire', 'use']), new Set(['use', 'weapon'])), { down: ['weapon'], up: ['fire'] });
});

test('Learnable: a game that keeps the contract passes; one that breaks it is named', () => {
  const corridor = () => {
    let pos = 0;
    let steps = 0;
    return { id: 'corridor', actions: ['left', 'right', 'wait'], observe: () => ({ pos, exit: 5 }), act: (a) => { steps++; pos += a === 'right' ? 1 : a === 'left' ? -1 : 0; }, score: () => pos * 10 - steps, done: () => pos >= 5 };
  };
  assert.deepEqual(checkLearnable(corridor()), []);
  assert.match(checkLearnable({ ...corridor(), actions: [] }).join(), /no actions/);
  assert.match(checkLearnable({ ...corridor(), actions: ['a', 'a'] }).join(), /repeat/);
  assert.match(checkLearnable({ ...corridor(), observe: () => ({ f: () => 1 }) }).join(), /not plain data/);
  assert.match(checkLearnable({ ...corridor(), score: () => Number.NaN }).join(), /not a finite number/);
  assert.match(checkLearnable({ ...corridor(), act: () => { throw new Error('nope'); } }).join(), /act\(left\) threw/);
});

// ---------- a ZIP writer for the tests (stored or deflated members, an optional stub in front)
function makeZip(files, { stub = new Uint8Array(0), deflate = true } = {}) {
  const enc = new TextEncoder();
  const locals = [];
  const centrals = [];
  let off = 0;
  for (const [name, data] of files) {
    const nb = enc.encode(name);
    const body = deflate ? new Uint8Array(deflateRawSync(data)) : data;
    const method = deflate ? 8 : 0;
    const crc = zcrc(data) >>> 0;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(method, 8);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nb.length, 26);
    locals.push(lh, nb, body);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(method, 10);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(body.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nb.length, 28);
    ch.writeUInt32LE(off, 42);
    centrals.push(ch, nb);
    off += 30 + nb.length + body.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(files.length, 8); eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(off, 16);
  return new Uint8Array(Buffer.concat([stub, ...locals, cd, eocd]));
}
const bytes = (n, seed) => Uint8Array.from({ length: n }, (_, i) => (i * 31 + seed * 7 + (i >> 5)) & 0xff);
const sha = (b) => createHash('sha256').update(b).digest('hex');

test('the ZIP reader: members by name (any case, either slash), stored and deflated, behind a stub, CRC-checked', async () => {
  const wad = bytes(70_000, 1);
  const txt = new TextEncoder().encode('PLEASE DISTRIBUTE!!!');
  const z = makeZip([['ID1/PAK0.PAK', wad], ['readme.txt', txt]], { stub: new TextEncoder().encode('MZ a self-extractor stub') });
  const es = zip.zipEntries(z);
  assert.deepEqual(es.map((e) => e.name), ['ID1/PAK0.PAK', 'readme.txt']);
  assert.deepEqual(await zip.zipRead(z, zip.findEntry(es, 'id1\\pak0.pak')), wad);
  assert.deepEqual(await zip.zipRead(z, zip.findEntry(es, 'README.TXT')), txt);
  const stored = makeZip([['a.bin', wad]], { deflate: false });
  assert.deepEqual(await zip.zipRead(stored, zip.zipEntries(stored)[0]), wad);
  // a flipped byte in a stored member is caught by its CRC-32
  const bad = stored.slice();
  bad[30 + 5 + 100] ^= 0xff;
  await assert.rejects(zip.zipRead(bad, zip.zipEntries(bad)[0]), /did not unpack whole/);
  assert.throws(() => zip.zipEntries(bytes(500, 2)), /not a ZIP/);
  assert.equal(zip.crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  assert.deepEqual(zip.concat([Uint8Array.of(1, 2), Uint8Array.of(3)]), Uint8Array.of(1, 2, 3));
});

// ---------- GET's store, with a stand-in Cache API and fetch
function fakeCaches() {
  const stores = new Map();
  const open = async (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name);
    return {
      put: async (req, res) => void m.set(req.url, new Uint8Array(await res.arrayBuffer())),
      match: async (req) => (m.has(req.url) ? new Response(m.get(req.url), { headers: { 'content-length': String(m.get(req.url).length) } }) : undefined),
      delete: async (req) => m.delete(req.url),
      keys: async () => [...m.keys()].map((u) => new Request(u)),
    };
  };
  return { open, delete: async (n) => stores.delete(n), stores };
}

test('GET: the first mirror with the right bytes wins; the files come out on the phone, are kept, and go in one tap', async () => {
  // a package shaped like DOOM's shareware: two floppy parts that join into a self-extracting archive holding the WAD
  const wad = bytes(120_000, 3);
  const inner = makeZip([['DOC.TXT', bytes(900, 4)], ['GAME.WAD', wad]], { stub: new TextEncoder().encode('MZ stub') });
  const cut = 50_000;
  const pkg = makeZip([['PART.1', inner.subarray(0, cut)], ['PART.2', inner.subarray(cut)], ['extra.wad', bytes(5000, 5)]]);
  const data = {
    url: ['https://mirror-one.example/pkg.zip', 'https://mirror-two.example/pkg.zip'],
    sha256: sha(pkg),
    bytes: pkg.length,
    licence: 'free to pass on',
    credit: 'the tests',
    take: [{ name: 'game.wad', from: ['PART.1', 'PART.2'], inner: 'GAME.WAD', sha256: sha(wad) }, { name: 'extra.wad', from: ['extra.wad'] }],
  };
  const asked = [];
  const served = new Map([['https://mirror-one.example/pkg.zip', new Response('gone', { status: 404 })], ['https://mirror-two.example/pkg.zip', new Response(pkg)]]);
  const fetch = async (url, init) => {
    asked.push([url, init?.mode]);
    return served.get(url) ?? new Response('', { status: 404 });
  };
  globalThis.caches = fakeCaches();
  try {
    const g = { id: 'test-game', data };
    assert.equal(await store.isHere(g), false);
    const phases = new Set();
    let last = 0;
    await store.getFiles(g, (p) => { phases.add(p.phase); if (p.phase === 'download') last = p.got; }, { fetch });
    assert.deepEqual(asked, [['https://mirror-one.example/pkg.zip', 'cors'], ['https://mirror-two.example/pkg.zip', 'cors']]);
    assert.deepEqual([...phases], ['download', 'check', 'unpack', 'keep']);
    assert.equal(last, pkg.length);
    assert.equal(await store.isHere(g), true);
    assert.deepEqual(await store.readKept('test-game', 'game.wad'), wad);
    assert.equal(await store.bytesKept(g), wad.length + 5000);
    await store.removeFiles(g);
    assert.equal(await store.isHere(g), false);
    assert.equal(await store.readKept('test-game', 'game.wad'), null);

    // a mirror sending other bytes is refused; with none right, GET says so and keeps nothing
    const other = makeZip([['x', bytes(10, 6)]]);
    served.set('https://mirror-one.example/pkg.zip', new Response(other));
    served.set('https://mirror-two.example/pkg.zip', new Response(pkg.subarray(0, pkg.length - 1)));
    await assert.rejects(store.getFiles(g, undefined, { fetch: async (u) => { const r = served.get(u); served.set(u, r.clone()); return r; } }), /No mirror gave the right file/);
    assert.equal(await store.isHere(g), false);

    // a taken file that comes out different from its known checksum is refused
    await assert.rejects(store.unpack(pkg, [{ name: 'game.wad', from: ['PART.1', 'PART.2'], inner: 'GAME.WAD', sha256: '0'.repeat(64) }]), /different from the known file/);
    await assert.rejects(store.unpack(pkg, [{ name: 'nope.wad', from: ['NOPE.WAD'] }]), /has no NOPE.WAD/);
  } finally {
    delete globalThis.caches;
  }
});

test('GET waits on mobile data where the phone says so; sizes read as he reads them', async () => {
  const conn = new EventTarget();
  conn.type = 'cellular';
  Object.defineProperty(globalThis, 'navigator', { value: { connection: conn }, configurable: true, writable: true });
  try {
    assert.equal(store.onMobileData(), true);
    let off = false;
    const waiting = store.offMobileData().then(() => (off = true));
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(off, false);
    conn.type = 'wifi';
    conn.dispatchEvent(new Event('change'));
    await waiting;
    assert.equal(off, true);
    assert.equal(store.onMobileData(), false);
  } finally {
    delete globalThis.navigator;
  }
  assert.equal(store.sizeWords(24_143_781), '24 MB');
  assert.equal(store.sizeWords(2_450_688), '2.5 MB');
  assert.equal(store.sizeWords(926_169), '926 KB');
});
