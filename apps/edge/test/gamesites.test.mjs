// BRIEF-KERNEL-3 item 6 (the owner's yes, FINAL-ROUND 13 Nov): a game from his Game Studio on his sites as an installable page.
// The studio hands the game over to WAIT (published by nothing); "put <name> on my sites" runs publish_game, a confirm tool whose
// approval keeps a one-time ticket, so only a game he approved goes live; the Worker serves it straight at /s/<name>/ with the
// studio's own player pinned by hash, its own manifest, icon and offline worker, its saves under its own key, and no network.
// Named in the test list of package.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { build } from 'esbuild';

await build({ entryPoints: ['src/gamesite.ts'], bundle: true, format: 'esm', platform: 'neutral', outfile: 'test/.build/gamesites/gamesite.mjs', logLevel: 'warning' });
const G = await import('./.build/gamesites/gamesite.mjs');
const T = await import('./.build/tools/index.mjs');
const brain = await import('./.build/brain.mjs');

const ORIGIN = 'https://ghosty.example.workers.dev';
const OWNER_KEY = 'gamesites-owner-key-0123456789abcdef';
const sha = (s) => createHash('sha256').update(s, 'utf8').digest('base64');
// A stand-in for the studio's own player as the interface serves it (the spec plays the real one).
const PLAYER = `(()=>{var el=document.getElementById('game');window.__played=JSON.parse(el.textContent).name;/*${'x'.repeat(1200)}*/})();`;

class MemStorage {
  m = new Map();
  async get(k) {
    if (Array.isArray(k)) return new Map(k.filter((x) => this.m.has(x)).map((x) => [x, structuredClone(this.m.get(x))]));
    return structuredClone(this.m.get(k));
  }
  async put(k, v) {
    if (typeof k === 'object') for (const [a, b] of Object.entries(k)) this.m.set(a, structuredClone(b));
    else this.m.set(k, structuredClone(v));
  }
  async delete(k) {
    if (Array.isArray(k)) return k.map((x) => this.m.delete(x)).filter(Boolean).length;
    return this.m.delete(k);
  }
  async list({ prefix = '' } = {}) {
    return new Map([...this.m].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, structuredClone(v)]));
  }
  async setAlarm() {}
  async getAlarm() { return null; }
  async deleteAlarm() {}
}
function world() {
  const kv = { m: new Map(), async get(k) { return this.m.has(k) ? JSON.parse(this.m.get(k)) : null; }, async put(k, v) { this.m.set(k, v); }, async delete(k) { this.m.delete(k); } };
  const storage = new MemStorage();
  let playerAsked = 0;
  const env = {
    OWNER_KEY,
    MOCK_LLM: '1',
    VAULT_KEY: Buffer.from(webcrypto.getRandomValues(new Uint8Array(32))).toString('base64'),
    SITES: kv,
    ASSETS: { async fetch(r) { return new URL(r.url).pathname === '/studio-player.js' ? (playerAsked++, new Response(PLAYER, { headers: { 'content-type': 'text/javascript' } })) : new Response('not found', { status: 404 }); } },
  };
  const state = { storage, waitUntil() {}, blockConcurrencyWhile: (f) => f() };
  let agent;
  env.AGENT = { idFromName: () => 'owner', get: () => ({ fetch: (r) => (agent ??= new brain.GhostyAgent(state, env)).fetch(r) }) };
  const go = (path, init = {}) => brain.default.fetch(new Request(`${ORIGIN}${path}`, init), env, { waitUntil() {} });
  const api = (path, method = 'GET', body) => go(path, { method, headers: { 'content-type': 'application/json', 'x-ghosty': '1', 'x-ghosty-key': OWNER_KEY }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const events = [];
  const ctx = { env, storage, origin: ORIGIN, emit: (e) => events.push(e), progress() {} };
  return { kv, storage, env, go, api, ctx, events, asked: () => playerAsked };
}
/** A game made the way the chat makes one: the studio's own kit, through the `game` tool. */
async function fox(name = 'Fox Run') {
  const sent = [];
  await T.toolByName.get('game').run({ op: 'make', name, kind: 'platformer', world: 'hills', person: 'Old Badger', lines: ['Welcome, little fox!'], quest: 'The secret' }, { storage: { get: async () => undefined, put: async () => undefined }, emit: (e) => sent.push(e) });
  return sent[0].args.game;
}
const tool = T.toolByName.get('publish_game');

test('publish_game is a tool of his sites that always stops for his APPROVE', () => {
  assert.ok(tool, 'publish_game is in the list');
  assert.equal(tool.risk, 'confirm');
  assert.equal(typeof tool.approval, 'function');
  assert.ok(T.toolByName.get('game').description.includes('never published'), 'the game tool itself still publishes nothing');
});

test('the studio hands the game over to wait: it needs the owner, it is read back by the studio, and nothing is published', async () => {
  const w = world();
  const g = await fox();
  // not signed in: refused
  const anon = await w.go('/api/sites/game', { method: 'POST', headers: { 'content-type': 'application/json', 'x-ghosty': '1' }, body: JSON.stringify({ game: g }) });
  assert.equal(anon.status, 401);
  // not a game: refused in words
  const bad = await w.api('/api/sites/game', 'POST', { game: { hello: 1 } });
  assert.equal(bad.status, 422);
  assert.match((await bad.json()).error, /not a game I can read/);
  // too big: refused before it is kept
  const big = await w.api('/api/sites/game', 'POST', { game: { ...g, name: 'x'.repeat(10), pad: 'y'.repeat(G.MAX_GAME_BYTES + 10) } });
  assert.ok([413, 422].includes(big.status));
  // the game: kept as the one waiting, in the brain's own storage (and KV)
  const ok = await w.api('/api/sites/game', 'POST', { game: g });
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { ok: true, name: 'Fox Run', link: 'fox-run' });
  assert.equal(w.storage.m.get(G.WAITING).game.name, 'Fox Run');
  assert.equal((await (await w.api('/api/sites/game')).json()).name, 'Fox Run');
  // published by nothing: no page, no list entry
  assert.equal((await w.go('/s/fox-run/')).status, 404);
  assert.ok(![...w.kv.m.keys()].some((k) => k.startsWith('site:fox')) && ![...w.storage.m.keys()].some((k) => k.startsWith('site:fox')));
});

test('a publish without the turn\'s approval is refused; the approval says what goes live and keeps a one-time ticket', async () => {
  const w = world();
  const g = await fox();
  // nothing waiting: the approval says what to do
  await assert.rejects(tool.approval({ name: 'Fox Run' }, w.ctx), /No game is waiting from his phone/);
  await w.api('/api/sites/game', 'POST', { game: g });
  // a call that never went through the approval: no ticket, a made-up one, an old one
  await assert.rejects(tool.run({ name: 'Fox Run' }, w.ctx), /only through his APPROVE/);
  await assert.rejects(tool.run({ name: 'Fox Run', ticket: 'a'.repeat(32) }, w.ctx), /only through his APPROVE/);
  w.storage.m.set(G.TICKET, { id: 'b'.repeat(32), game: g, name: 'fox-run', at: Date.now() - G.TICKET_MS - 1000 });
  await assert.rejects(tool.run({ ticket: 'b'.repeat(32) }, w.ctx), /only through his APPROVE/);
  // he named another game
  await assert.rejects(tool.approval({ name: 'Space Cats' }, w.ctx), /waiting from his phone is "Fox Run", not "Space Cats"/);
  // the approval: his words on the card
  const ap = await tool.approval({ name: 'fox run' }, w.ctx);
  assert.match(ap.reason, /^Put your game "Fox Run" on your sites at https:\/\/ghosty\.example\.workers\.dev\/s\/fox-run\/\? Anyone with the link can play it/);
  assert.match(ap.reason, /installs to a Home Screen, plays offline and keeps its saves on the phone that plays it; it reaches nothing on the network and asks for no camera, microphone or location/);
  assert.match(ap.args.ticket, /^[0-9a-f]{32}$/);
  // the game changes on the phone after he saw the card: what he approved is what goes live
  await w.api('/api/sites/game', 'POST', { game: { ...g, name: 'Fox Run Two' } });
  const out = await tool.run(ap.args, w.ctx);
  assert.match(out, /^Published "Fox Run" — live now at https:\/\/ghosty\.example\.workers\.dev\/s\/fox-run\//);
  assert.deepEqual(w.events.find((e) => e.t === 'client'), { t: 'client', name: 'show_link', args: { url: `${ORIGIN}/s/fox-run/`, title: 'Fox Run' } });
  // once only, and nothing is left behind
  await assert.rejects(tool.run(ap.args, w.ctx), /only through his APPROVE/);
  assert.ok(![...w.storage.m.keys(), ...w.kv.m.keys()].some((k) => k.startsWith('sitegame:ticket')), 'the used ticket is gone');
  // cards he declined pile nothing up: one ticket, the latest card's; an older card's ticket no longer publishes
  const old = await tool.approval({}, w.ctx);
  const newer = await tool.approval({}, w.ctx);
  assert.equal([...w.storage.m.keys()].filter((k) => k.startsWith('sitegame:ticket')).length, 1);
  await assert.rejects(tool.run(old.args, w.ctx), /only through his APPROVE/);
  await tool.run(newer.args, w.ctx);
  // listed as a game; the same game again is an update at the same link; another page's name is never taken over
  assert.match(await T.toolByName.get('list_sites').run({}, w.ctx), /\/s\/fox-run\/ — "Fox Run" \(game\)/);
  await w.api('/api/sites/game', 'POST', { game: g });
  assert.match((await tool.approval({}, w.ctx)).reason, /^Update your game "Fox Run" .*This replaces the copy already there\.$/);
  await w.api('/api/sites/game', 'POST', { game: { ...g, id: 'another-game' } });
  assert.match((await tool.approval({}, w.ctx)).reason, /\/s\/fox-run-2\/\?/);
});

test('served straight at /s/<name>/: the exact policy, its one pinned script, its saves\' own key, its manifest, icon and offline worker', async () => {
  const w = world();
  const g = await fox();
  await w.api('/api/sites/game', 'POST', { game: { ...g, name: 'Fox </script><script>alert(1)</script> Run' } });
  const ap = await tool.approval({}, w.ctx);
  const out = await tool.run(ap.args, w.ctx);
  const name = /\/s\/([a-z0-9-]+)\//.exec(out)[1];
  assert.equal(name, 'fox-script-script-alert-1-script-run');
  // without the slash: to the address its worker keeps
  const bare = await w.go(`/s/${name}`, { headers: { 'sec-fetch-dest': 'document' } });
  assert.equal(bare.status, 301);
  assert.equal(bare.headers.get('location'), `/s/${name}/`);
  // the page, for anyone, never framed
  const r = await w.go(`/s/${name}/`, { headers: { 'sec-fetch-dest': 'document', 'sec-fetch-site': 'cross-site' } });
  assert.equal(r.status, 200);
  const page = await r.text();
  const script = /<script>([\s\S]*)<\/script><\/body>/.exec(page)[1];
  assert.equal(script, PLAYER, 'its one script is the studio\'s player as the interface serves it, nothing stored');
  const STYLE = /<style>([\s\S]*?)<\/style>/.exec(page)[1];
  const csp = r.headers.get('content-security-policy');
  assert.equal(csp, `default-src 'none'; script-src 'sha256-${sha(PLAYER)}'; style-src 'sha256-${sha(STYLE)}'; img-src 'self' data: blob:; manifest-src 'self'; worker-src 'self'; connect-src 'none'; media-src 'none'; font-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'`);
  assert.equal(r.headers.get('permissions-policy'), 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), display-capture=()');
  assert.equal((page.match(/<script(?![^>]*application\/json)/g) ?? []).length, 1, 'exactly one script runs');
  assert.doesNotMatch(page, /<script>alert/, 'the game\'s words are data, never code');
  assert.match(page, /<script type="application\/json" id="game" data-save="ghosty-site:fox-script-script-alert-1-script-run" data-sw="\/s\/fox-script-script-alert-1-script-run\/page" data-scope="\/s\/fox-script-script-alert-1-script-run\/">/);
  assert.equal(G.saveKeyOf(name), `ghosty-site:${name}`, 'its saves: its own key on the phone, and only that');
  assert.match(page, new RegExp(`<link rel="manifest" href="/s/${name}/page"><link rel="apple-touch-icon" href="/s/${name}/page">`));
  // (sites.u11: the front page's room pictures are data PNGs in the body; the icon is never one, in the head or anywhere outside the front page)
  assert.equal((page.replace(/<section id="front"[\s\S]*?<\/section>/, '').match(/data:image\/png/g) ?? []).length, 0, 'the icon is not in the page: it is fetched once, at its own address');
  // the manifest: installable, standalone, at its own address, its icon once
  const m = await w.go(`/s/${name}/page`, { headers: { 'sec-fetch-dest': 'manifest' } });
  assert.match(m.headers.get('content-type'), /application\/manifest\+json/);
  const man = await m.json();
  assert.equal(man.start_url, `/s/${name}/`);
  assert.equal(man.scope, `/s/${name}/`);
  assert.equal(man.id, `/s/${name}/`);
  assert.equal(man.display, 'standalone');
  assert.equal(man.name, 'Fox </script><script>alert(1)</script> Run');
  assert.deepEqual(man.icons, [{ src: `/s/${name}/page`, sizes: '512x512', type: 'image/png', purpose: 'any' }]);
  // the icon
  const ic = await w.go(`/s/${name}/page`, { headers: { 'sec-fetch-dest': 'image' } });
  assert.equal(ic.headers.get('content-type'), 'image/png');
  const png = new Uint8Array(await ic.arrayBuffer());
  assert.deepEqual([...png.slice(1, 4)], [80, 78, 71]);
  assert.equal(new DataView(png.buffer).getUint32(16), 512);
  // the offline worker: the mini-apps' own, which keeps only this page
  const sw = await w.go(`/s/${name}/page`, { headers: { 'sec-fetch-dest': 'serviceworker' } });
  assert.match(sw.headers.get('content-type'), /javascript/);
  assert.match(await sw.text(), /caches\.open\(CACHE\)/);
  // opened as a page, /page goes to the game
  const asPage = await w.go(`/s/${name}/page`, { headers: { 'sec-fetch-dest': 'document' } });
  assert.equal(asPage.status, 302);
  assert.equal(asPage.headers.get('location'), `/s/${name}/`);
  // served from KV without the brain once it is there
  const real = w.env.AGENT.get;
  w.env.AGENT.get = () => ({ fetch: () => { throw new Error('the brain must not be needed'); } });
  assert.equal((await w.go(`/s/${name}/`, { headers: { 'sec-fetch-dest': 'document' } })).status, 200);
  w.env.AGENT.get = real;
  // UNDO: taken down, the link stops working
  await T.toolByName.get('unpublish_site').run({ name }, w.ctx);
  assert.equal((await w.go(`/s/${name}/`)).status, 404);
});

test('a game published a moment ago is served by the brain while KV has not caught up; no player, no page (said in words)', async () => {
  const w = world();
  const g = await fox();
  await w.api('/api/sites/game', 'POST', { game: g });
  await tool.run((await tool.approval({}, w.ctx)).args, w.ctx);
  w.kv.m.clear(); // KV not caught up here yet
  const r = await w.go('/s/fox-run/', { headers: { 'sec-fetch-dest': 'document' } });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-security-policy'), /^default-src 'none'; script-src 'sha256-/);
  const m = await w.go('/s/fox-run/page', { headers: { 'sec-fetch-dest': 'manifest' } });
  assert.equal((await m.json()).start_url, '/s/fox-run/');
  // no player to be had (an interface not deployed yet): a page in words, never a broken game
  const w2 = world();
  w2.env.ASSETS = { fetch: async () => new Response('nope', { status: 404 }) };
  await w2.api('/api/sites/game', 'POST', { game: g });
  await tool.run((await tool.approval({}, w2.ctx)).args, w2.ctx);
  const r2 = await w2.go('/s/fox-run/', { headers: { 'sec-fetch-dest': 'document' } });
  assert.equal(r2.status, 503);
  assert.match(await r2.text(), /player is being set up/);
});

// NEXT ROUND sites.u11: a published game's front page: its name, how to play, its rooms as pictures (made here, in the page as data),
// his note if he gave one (said in the approval, written as text), and PLAY; the page's one style still pinned by its hash.
test('a game\'s front page: its name, how to play, its rooms as pictures, his note as text, and PLAY', async () => {
  const w = world();
  const g = await fox();
  await w.api('/api/sites/game', 'POST', { game: g });
  const ap = await tool.approval({ name: 'Fox Run', note: 'Made with my nephew <b>Sam</b>.' }, w.ctx);
  assert.match(ap.reason, /Its front page carries your note: “Made with my nephew <b>Sam<\/b>\.”\./);
  await tool.run(ap.args, w.ctx);
  const r = await w.go('/s/fox-run/', { headers: { 'sec-fetch-dest': 'document' } });
  const page = await r.text();
  const front = /<section id="front"[\s\S]*?<\/section>/.exec(page)?.[0] ?? '';
  assert.match(front, /<h1>Fox Run<\/h1>/);
  assert.match(front, /How to play<\/h2><ul><li>/);
  assert.ok((front.match(/<img src="data:image\/png;base64,/g) ?? []).length === Math.min(6, g.rooms.length), 'a picture for each room');
  assert.match(front, /<p class="note">Made with my nephew &lt;b>Sam&lt;\/b>\.<\/p>/, 'his note as text, never as markup');
  assert.match(front, /<button class="play" type="button">PLAY<\/button>/);
  const style = /<style>([\s\S]*?)<\/style>/.exec(page)[1];
  assert.ok(r.headers.get('content-security-policy').includes(`style-src 'sha256-${sha(style)}'`), 'the one style, front page and all, pinned by its hash');
  assert.match(style, /--fsky:#[0-9a-f]{6}/i);
});
