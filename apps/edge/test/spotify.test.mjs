// Spotify linking (PKCE code exchange through the brain) and the Spotify tools, with
// accounts.spotify.com and api.spotify.com faked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

const mod = await import(process.env.BRAIN_BUNDLE ?? './.build/brain.mjs');
const worker = mod.default;
const { GhostyAgent } = mod;
const T = await import('./.build/tools/index.mjs');

// ---- fake Spotify ---------------------------------------------------------------------
const calls = [];
let routes = {}; // 'METHOD /path' (no query) → (req) => Response
const j = (o, status = 200, headers = {}) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', ...headers } });
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  const method = init.method ?? 'GET';
  const body = typeof init.body === 'string' ? init.body : '';
  const call = { method, url, body, auth: init.headers?.Authorization ?? init.headers?.authorization ?? '' };
  calls.push(call);
  const key = `${method} ${url.hostname === 'accounts.spotify.com' ? 'accounts' : 'api'}${url.pathname}`;
  const h = routes[key];
  if (!h) return new Response('not faked: ' + key, { status: 599 });
  return h(call);
};

// ---- brain harness (as in brain.test.mjs) -------------------------------------------
class MemStorage {
  m = new Map();
  async get(k) { return this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
  async put(k, v) { this.m.set(k, structuredClone(v)); }
  async delete(k) { return this.m.delete(k); }
  async setAlarm() {}
  async getAlarm() { return null; }
}
const OWNER_KEY = 'spotify-owner-key-0123456789abcdef';
const pending = [];
const state = { storage: new MemStorage(), waitUntil: (p) => pending.push(p), blockConcurrencyWhile: (f) => f() };
const env = { OWNER_KEY, MOCK_LLM: '1', VAULT_KEY: Buffer.from(webcrypto.getRandomValues(new Uint8Array(32))).toString('base64') };
let agent;
env.AGENT = { idFromName: (n) => n, get: () => ({ fetch: (r) => (agent ??= new GhostyAgent(state, env)).fetch(r) }) };
const ctx = { waitUntil: (p) => pending.push(p) };
const call = (path, init = {}) =>
  worker.fetch(new Request(`https://ghosty.me.workers.dev/api${path}`, { ...init, headers: { 'content-type': 'application/json', 'x-ghosty': '1', 'x-ghosty-key': OWNER_KEY } }), env, ctx);

// A tool context with an in-memory vault (tools only use ctx.vault for Spotify).
function toolCtx(saved) {
  const m = new Map(saved ? [['spotify', JSON.stringify(saved)]] : []);
  return { m, vault: { get: async (k) => m.get(k) ?? null, set: async (k, v) => (v ? m.set(k, v) : m.delete(k)) }, emit() {} };
}
const linked = (extra = {}) => ({ clientId: 'abcdef0123456789abcdef0123456789', refresh: 'R1', access: 'A1', expires: Date.now() + 3600_000, name: 'Owner', product: 'premium', ...extra });
const run = (name, args, c) => T.toolByName.get(name).run(args, c);

const VERIFIER = 'v'.repeat(64);
const CLIENT = 'abcdef0123456789abcdef0123456789';

test('link: code exchanged with PKCE, tokens kept encrypted, status shows the name', async () => {
  routes = {
    'POST accounts/api/token': () => j({ access_token: 'ACCESS1', refresh_token: 'REFRESH1', expires_in: 3600, token_type: 'Bearer' }),
    'GET api/v1/me': (c) => (c.auth === 'Bearer ACCESS1' ? j({ display_name: 'Aqis', id: 'aqis', product: 'premium' }) : j({ error: { status: 401 } }, 401)),
  };
  calls.length = 0;
  let st = await (await call('/spotify/status')).json();
  assert.deepEqual(st, { linked: false, name: null, product: null, clientId: null });
  const r = await call('/spotify/link', { method: 'POST', body: JSON.stringify({ code: 'CODE123', verifier: VERIFIER, redirectUri: 'https://ghosty.me.workers.dev/', clientId: CLIENT }) });
  const out = await r.json();
  assert.equal(r.status, 200, JSON.stringify(out));
  assert.equal(out.name, 'Aqis');
  const form = new URLSearchParams(calls[0].body);
  assert.equal(calls[0].url.href, 'https://accounts.spotify.com/api/token');
  assert.equal(form.get('grant_type'), 'authorization_code');
  assert.equal(form.get('code'), 'CODE123');
  assert.equal(form.get('code_verifier'), VERIFIER);
  assert.equal(form.get('client_id'), CLIENT);
  assert.equal(form.get('redirect_uri'), 'https://ghosty.me.workers.dev/');
  const raw = state.storage.m.get('vault:spotify');
  assert.ok(raw && !raw.includes('REFRESH1') && !raw.includes('ACCESS1'), 'tokens are encrypted at rest');
  st = await (await call('/spotify/status')).json();
  assert.deepEqual(st, { linked: true, name: 'Aqis', product: 'premium', clientId: CLIENT });
  assert.ok(!JSON.stringify(st).includes('REFRESH1'));
  // a refused code is a clear 400
  routes['POST accounts/api/token'] = () => j({ error: 'invalid_grant', error_description: 'Invalid authorization code' }, 400);
  const bad = await call('/spotify/link', { method: 'POST', body: JSON.stringify({ code: 'OLD', verifier: VERIFIER, redirectUri: 'https://ghosty.me.workers.dev/', clientId: CLIENT }) });
  assert.equal(bad.status, 400);
  assert.match((await bad.json()).error, /Invalid authorization code/);
  // unlink forgets it
  assert.equal((await call('/spotify/unlink', { method: 'POST', body: '{}' })).status, 200);
  assert.equal((await (await call('/spotify/status')).json()).linked, false);
  assert.equal(state.storage.m.has('vault:spotify'), false);
});

test('tools say how to link when Spotify is not linked', async () => {
  await assert.rejects(run('spotify_now_playing', {}, toolCtx()), /System tab/);
});

test('an expired token is refreshed and a rotated refresh token is kept', async () => {
  const c = toolCtx(linked({ access: 'OLD', expires: Date.now() - 1000 }));
  routes = {
    'POST accounts/api/token': () => j({ access_token: 'NEW', refresh_token: 'R2', expires_in: 3600 }),
    'GET api/v1/me/player/devices': (k) => (k.auth === 'Bearer NEW' ? j({ devices: [{ id: 'd1', name: 'Kitchen', type: 'Speaker', is_active: true, volume_percent: 40 }] }) : j({}, 401)),
  };
  calls.length = 0;
  const out = await run('spotify_devices', {}, c);
  assert.match(out, /Kitchen \(speaker\) · active · volume 40%/);
  const form = new URLSearchParams(calls[0].body);
  assert.equal(form.get('grant_type'), 'refresh_token');
  assert.equal(form.get('refresh_token'), 'R1');
  assert.equal(form.get('client_id'), CLIENT);
  const saved = JSON.parse(c.m.get('spotify'));
  assert.equal(saved.access, 'NEW');
  assert.equal(saved.refresh, 'R2', 'rotated refresh token stored');
  assert.ok(saved.expires > Date.now() + 3000_000);
});

test('a 401 refreshes once and retries; no new refresh token keeps the old one', async () => {
  const c = toolCtx(linked());
  routes = {
    'POST accounts/api/token': () => j({ access_token: 'A2', expires_in: 3600 }),
    'GET api/v1/me/player/devices': (k) => (k.auth === 'Bearer A2' ? j({ devices: [] }) : j({ error: { status: 401, message: 'The access token expired' } }, 401)),
  };
  assert.match(await run('spotify_devices', {}, c), /No Spotify devices/);
  assert.equal(JSON.parse(c.m.get('spotify')).refresh, 'R1');
});

test('now playing is compact and complete', async () => {
  routes = {
    'GET api/v1/me/player': () =>
      j({
        is_playing: true, progress_ms: 83_000, shuffle_state: false, repeat_state: 'off',
        device: { id: 'd1', name: 'Kitchen', type: 'Speaker', is_active: true, volume_percent: 40 },
        item: { name: 'Bohemian Rhapsody', uri: 'spotify:track:1', duration_ms: 354_000, artists: [{ name: 'Queen' }], album: { name: 'A Night at the Opera' } },
      }),
  };
  const out = await run('spotify_now_playing', {}, toolCtx(linked()));
  assert.equal(out, 'Playing: Bohemian Rhapsody — Queen (A Night at the Opera) · 1:23 / 5:54 · on Kitchen (volume 40%) · shuffle off, repeat off');
  routes['GET api/v1/me/player'] = () => new Response(null, { status: 204 });
  assert.match(await run('spotify_now_playing', {}, toolCtx(linked())), /Nothing is playing/);
});

test('no active device and no Premium give clear messages', async () => {
  routes = {
    'PUT api/v1/me/player/pause': () => j({ error: { status: 404, message: 'Player command failed: No active device found', reason: 'NO_ACTIVE_DEVICE' } }, 404),
    'POST api/v1/me/player/next': () => j({ error: { status: 403, message: 'Player command failed: Premium required', reason: 'PREMIUM_REQUIRED' } }, 403),
    'PUT api/v1/me/player/volume': () => j({ error: { status: 429 } }, 429, { 'retry-after': '7' }),
  };
  await assert.rejects(run('spotify_control', { action: 'pause' }, toolCtx(linked())), /open Spotify on a device first/i);
  await assert.rejects(run('spotify_control', { action: 'next' }, toolCtx(linked())), /needs a Spotify Premium/);
  await assert.rejects(run('spotify_control', { action: 'volume', level: 50 }, toolCtx(linked())), /7 seconds/);
  await assert.rejects(run('spotify_control', { action: 'explode' }, toolCtx(linked())), /action must be one of/);
});

test('spotify_play: tracks play by uris, albums/artists/playlists by context_uri, on a named device', async () => {
  const plays = [];
  routes = {
    'GET api/v1/search': (c) => {
      const type = c.url.searchParams.get('type');
      return j({ [`${type}s`]: { items: [{ name: `Best ${type}`, uri: `spotify:${type}:x1`, artists: [{ name: 'Queen' }] }] } });
    },
    'PUT api/v1/me/player/play': (c) => {
      plays.push({ device: c.url.searchParams.get('device_id'), body: JSON.parse(c.body) });
      return new Response(null, { status: 204 });
    },
    'GET api/v1/me/player/devices': () => j({ devices: [{ id: 'dev-k', name: 'Kitchen Speaker', type: 'Speaker', is_active: false, volume_percent: 30 }] }),
    'POST api/v1/me/player/queue': () => new Response(null, { status: 204 }),
  };
  const c = toolCtx(linked());
  assert.match(await run('spotify_play', { query: 'bohemian rhapsody' }, c), /Playing Best track — Queen/);
  assert.deepEqual(plays.at(-1), { device: null, body: { uris: ['spotify:track:x1'] } });
  for (const type of ['album', 'artist', 'playlist']) {
    await run('spotify_play', { query: 'queen', type }, c);
    assert.deepEqual(plays.at(-1).body, { context_uri: `spotify:${type}:x1` });
  }
  await run('spotify_play', { query: 'queen', type: 'artist', device: 'kitchen' }, c);
  assert.equal(plays.at(-1).device, 'dev-k');
  await assert.rejects(run('spotify_play', { query: 'queen', device: 'bathroom' }, c), /No Spotify device called "bathroom". Available: Kitchen Speaker/);
  assert.match(await run('spotify_queue', { query: 'yellow' }, c), /Queued Best track/);
  assert.equal(calls.filter((x) => x.url.pathname === '/v1/me/player/queue').at(-1).url.searchParams.get('uri'), 'spotify:track:x1');
});

test('spotify_play with nothing active starts on the first available device', async () => {
  const plays = [];
  routes = {
    'GET api/v1/search': () => j({ tracks: { items: [{ name: 'Song', uri: 'spotify:track:s1', artists: [] }] } }),
    'PUT api/v1/me/player/play': (c) => {
      const d = c.url.searchParams.get('device_id');
      plays.push(d);
      return d ? new Response(null, { status: 204 }) : j({ error: { status: 404, message: 'No active device found', reason: 'NO_ACTIVE_DEVICE' } }, 404);
    },
    'GET api/v1/me/player/devices': () => j({ devices: [{ id: 'phone-1', name: 'Phone', type: 'Smartphone', is_active: false, volume_percent: 100 }] }),
  };
  assert.match(await run('spotify_play', { query: 'song' }, toolCtx(linked())), /Playing Song/);
  assert.deepEqual(plays, [null, 'phone-1']);
});

test('spotify tools are offered for music requests and none need approval', () => {
  const names = T.selectTools('pause the music', new Set(), false).map((t) => t.name);
  assert.ok(names.includes('spotify_control') && names.includes('spotify_play'));
  assert.ok(!T.selectTools('hello there', new Set(), false).some((t) => t.name.startsWith('spotify_')));
  for (const t of T.TOOLS.filter((x) => x.name.startsWith('spotify_'))) {
    assert.equal(t.risk, 'auto');
    assert.doesNotMatch(t.name, /(send|email|message|post|publish|pay|purchase|buy|transfer|delete_account|book)/i);
  }
});

test('playlists are listed compactly', async () => {
  routes = { 'GET api/v1/me/playlists': () => j({ total: 2, items: [{ name: 'Chill', uri: 'spotify:playlist:1', tracks: { total: 42 }, owner: { display_name: 'Owner' } }, { name: 'Run', uri: 'spotify:playlist:2', items: { total: 9 }, owner: { display_name: 'Owner' } }] }) };
  const out = await run('spotify_playlists', {}, toolCtx(linked()));
  assert.match(out, /- Chill \(42 tracks\) · by Owner/);
  assert.match(out, /- Run \(9 tracks\)/);
});
