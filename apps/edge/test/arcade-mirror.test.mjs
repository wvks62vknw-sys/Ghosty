// The ARCADE's second mirror: where the owner's phone cannot reach the Internet Archive itself (his network's filter, or
// Safari refusing the direct fetch: "Load failed"), GET asks Ghosty's own site for the same package and the Worker streams it
// through. The Worker's passthrough (apps/edge/src/arcade.ts): GET and HEAD only; only the Archive items the shelf uses (the
// list held to shelf.ts and levels.ts both ways, and every address either of them writes passes and reaches the Archive
// unchanged); only plain names, a dot-dot refused however it is spelled; the exact upstream address and the redirect followed;
// the headers copied and the ones set; the body streamed through byte for byte and never read there; the Archive's 404, its
// refusals and its silence; a Range passed on and a 206 passed back; the route behind the owner's sign-in and never reaching
// the brain. The phone's store (apps/web/src/arcade/store.ts): the public mirrors first, then this site's own copy of each
// Archive address, the owner's sign-in sent to it and nothing of his to a public mirror, "this site" in the reason, and a
// package arriving whole through the Worker when the Archive cannot be reached. No network: every fetch is a stand-in.
// Bundles are built here, with esbuild's API, like arcade.test.mjs and resta.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({
  entryPoints: {
    pass: at('../src/arcade.ts'),
    brain: at('../src/index.ts'),
    shelf: at('../../web/src/arcade/shelf.ts'),
    levels: at('../../web/src/arcade/levels.ts'),
    store: at('../../web/src/arcade/store.ts'),
  },
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  external: ['cloudflare:sockets'],
  outdir: at('./.build/arcade-mirror'),
  outExtension: { '.js': '.mjs' },
  logLevel: 'error',
});
const P = await import('./.build/arcade-mirror/pass.mjs');
const W = (await import('./.build/arcade-mirror/brain.mjs')).default;
const { SHELF } = await import('./.build/arcade-mirror/shelf.mjs');
const { LEVELS } = await import('./.build/arcade-mirror/levels.mjs');
const store = await import('./.build/arcade-mirror/store.mjs');

const sha = (b) => createHash('sha256').update(b).digest('hex');
const bytes = (n, seed) => Uint8Array.from({ length: n }, (_, i) => (i * 31 + seed * 7 + (i >> 8)) & 255);
/**
 * A body that arrives in pieces, as a real download does, and is only drawn from when something reads it (a high-water mark
 * of nothing): `taken` counts the pieces read from it, `cancelled` says it was let go.
 */
function pieces(all, size = 65536) {
  const state = { taken: 0, cancelled: false };
  let from = 0;
  const body = new ReadableStream(
    {
      pull(c) {
        if (from >= all.length) return c.close();
        c.enqueue(all.slice(from, from + size));
        from += size;
        state.taken++;
      },
      cancel() {
        state.cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  return { body, state };
}
/** The Archive, as a stand-in: every address answered with `status`, and what it was asked noted. */
function archive(status = 200, { body = null, headers = {} } = {}) {
  const asked = [];
  const fetcher = async (url, init) => {
    asked.push({ url, init });
    return new Response(body, { status, headers });
  };
  return Object.assign(fetcher, { asked });
}
/** The Worker's passthrough for `rest` (the path after /api/arcade/), asked as the phone would. */
const pass = (rest, fetcher, { method = 'GET', headers = {} } = {}) => P.arcadePassthrough(new Request('https://ghosty.test/api/arcade/x', { method, headers }), rest, fetcher);

// ---------------------------------------------------------------- the list, and the shelf's own addresses

/** Every address the shelf and the free levels fetch from, each once (Freedoom's package is on two cards). */
const addresses = () => [...new Set([...SHELF.flatMap((g) => g.data?.url ?? []), ...LEVELS.flatMap((p) => p.data.url)])];

test('the allowlist is exactly the Archive items the shelf and the free levels use, and every address they write passes and reaches the Archive unchanged', async () => {
  const urls = addresses();
  assert.ok(urls.length >= 20, `the shelf and the levels were read: ${urls.length} addresses`);
  const items = new Set();
  for (const u of urls) {
    const url = new URL(u);
    assert.equal(url.host, 'archive.org', u);
    assert.ok(url.pathname.startsWith('/cors/'), u);
    items.add(url.pathname.split('/')[2]);
  }
  // both ways: a game added to the shelf from a new item fails here until the Worker lists it; an item nobody uses is not kept
  assert.deepEqual([...P.ARCADE_ITEMS].sort(), [...items].sort());
  // each address, as the phone writes it, asks the Archive for exactly what the phone would have asked it for itself
  for (const u of urls) {
    const rest = new URL(u).pathname.slice('/cors/'.length);
    const up = archive(200, { body: new Uint8Array(4) });
    const res = await pass(rest, up);
    assert.equal(res.status, 200, `${rest}: ${await res.clone().text()}`);
    assert.equal(up.asked.length, 1, rest);
    assert.equal(up.asked[0].url, u);
  }
});

// ---------------------------------------------------------------- who and what the Worker lets through

test('only GET and HEAD; anything else is turned away before the Archive is asked', async () => {
  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']) {
    const up = archive(200, { body: new Uint8Array(4) });
    const res = await pass('Idstuff/Idstuff.zip', up, { method });
    assert.equal(res.status, 405, method);
    assert.equal(up.asked.length, 0, method);
    assert.match((await res.json()).error, /GET or HEAD only/);
  }
  for (const method of ['GET', 'HEAD']) assert.equal((await pass('Idstuff/Idstuff.zip', archive(200, { body: method === 'GET' ? new Uint8Array(4) : null }), { method })).status, 200, method);
});

test('an item the shelf does not use is a plain 404 and the Archive is never asked; so is a name that is not a plain name', async () => {
  const refused = [
    // not on the shelf (or only like one that is)
    'Somewhere/else.zip',
    'idstuff/Idstuff.zip',
    'IDSTUFF/Idstuff.zip',
    'Idstuff2/Idstuff.zip',
    'Idstuff.zip',
    'freedoom-0.13.0 /freedoom-0.13.0.zip',
    'https:/archive.org/x',
    '%49dstuff/Idstuff.zip',
    '',
    'Idstuff',
    '/Idstuff/Idstuff.zip',
    // the wrong number of parts, and empty ones
    'Idstuff/Idstuff.zip/a/b',
    'Idstuff/Idstuff.zip/',
    'Idstuff//Idstuff.zip',
    'Idstuff/',
    // a dot-dot, however it is spelled, in the file or in the member (the member's escapes read first)
    'Idstuff/..',
    'Idstuff/.',
    'Idstuff/../Idstuff.zip',
    'Idstuff/Idstuff.zip/..',
    'Idstuff/Idstuff.zip/.',
    'Idstuff/%2e%2e/Idstuff.zip',
    'Idstuff/%2E%2E/Idstuff.zip',
    'Idstuff/.%2e/Idstuff.zip',
    'Idstuff/%2e./Idstuff.zip',
    'Idstuff/Idstuff.zip/%2e%2e',
    'Idstuff/Idstuff.zip/a%2F..%2F..%2F..%2Fcors%2Fother-item%2Ffile.zip',
    'Idstuff/Idstuff.zip/..%2Fa',
    'Idstuff/Idstuff.zip/a%2F.%2Fb',
    'Idstuff/Idstuff.zip/a%2F%2Fb',
    'Idstuff/Idstuff.zip/%2Fa',
    'Idstuff/Idstuff.zip/a%2F',
    // characters the shelf never writes
    'Idstuff/Idstuff.zip?x=1',
    'Idstuff/Idstuff.zip#x',
    'Idstuff/Idstuff.zip@evil.example',
    'Idstuff/Id stuff.zip',
    'Idstuff/Idstuff.zip/a b',
    'Idstuff/Idstuff.zip/a:b',
    'Idstuff/Idstuff.zip/a;b',
    'Idstuff/Idstuff.zip/a,b',
    'Idstuff/Idstuff.zip/a+b',
    'Idstuff/Idstuff.zip/a=b',
    'Idstuff/Idstuff.zip/a&b',
    'Idstuff/Idstuff.zip/a$b',
    'Idstuff/Idstuff.zip/a(b)',
    "Idstuff/Idstuff.zip/a'b",
    'Idstuff/Idstuff.zip/a!b',
    'Idstuff/Idstuff.zip/a*b',
    'Idstuff/Idstuff.zip/a~b',
    'Idstuff/Idstuff.zip/<b>',
    'Idstuff/Idstuff.zip/"b"',
    'Idstuff/Idstuff.zip/a\\b',
    'Idstuff/Idstuff.zip/a\nb',
    'Idstuff/Idstuff.zip/a\u0000b',
    'Idstuff/Idstuff.zip/é',
    // escapes that are not whole, not text, or not plain once read
    'Idstuff/Idstuff.zip/a%',
    'Idstuff/Idstuff.zip/a%2',
    'Idstuff/Idstuff.zip/a%zz',
    'Idstuff/Idstuff.zip/a%e0%80',
    'Idstuff/Idstuff.zip/a%00b',
    'Idstuff/Idstuff.zip/a%0Ab',
    'Idstuff/Idstuff.zip/a%7Fb',
    'Idstuff/Idstuff.zip/a%5Cb',
    'Idstuff/Idstuff.zip/%252e%252e',
    'Idstuff/Idstuff.zip/a%252Fb',
  ];
  for (const rest of refused) {
    const up = archive(200, { body: new Uint8Array(4) });
    const res = await pass(rest, up);
    assert.equal(res.status, 404, JSON.stringify(rest));
    assert.equal(up.asked.length, 0, `${JSON.stringify(rest)} reached the Archive`);
    assert.equal(res.headers.get('content-type'), 'application/json');
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.match((await res.json()).error, /not a package from the arcade shelf/);
  }
  // and what the shelf writes is let through: a file, and a ZIP member with its folders as %2F, a name with its dots and dashes
  for (const rest of ['Idstuff/Idstuff.zip', 'TyrianV2.1SW1996EpicMegaGamesInc.Action/TYRIANv2.1.ZIP', 'idgames_202003/idgames.zip/idgames%2Flevels%2Fdoom2%2Fmegawads%2F1klinecp.zip', 'Idstuff/Idstuff.zip/Idstuff%2FDoom%2Fdoom19s.zip', 'Idstuff/Idstuff.zip/a_b-c.d%20e.zip']) {
    const up = archive(200, { body: new Uint8Array(4) });
    assert.equal((await pass(rest, up)).status, 200, rest);
    assert.equal(up.asked[0].url, `https://archive.org/cors/${rest}`, 'the escapes are sent as they came, never read and written again');
  }
});

// ---------------------------------------------------------------- what the Worker asks, and what it sends back

test('the Archive is asked for the same address, as Ghosty, the redirect followed, and nothing of the owner goes with it', async () => {
  const up = archive(200, { body: new Uint8Array(4) });
  const req = new Request('https://ghosty.test/api/arcade/Keen4e-sw/keen4.zip', { headers: { cookie: 'secret=1', 'x-ghosty-key': 'k'.repeat(30), authorization: 'Bearer x', 'user-agent': 'a phone' } });
  await P.arcadePassthrough(req, 'Keen4e-sw/keen4.zip', up);
  assert.equal(up.asked.length, 1);
  const { url, init } = up.asked[0];
  assert.equal(url, 'https://archive.org/cors/Keen4e-sw/keen4.zip');
  assert.equal(init.method, 'GET');
  assert.equal(init.redirect, 'follow', 'a ZIP member is handed to a data server by a 302, followed here');
  assert.equal(init.cache, 'no-store');
  assert.deepEqual(Object.keys(init.headers), ['user-agent'], 'nothing of the owner goes to the Archive: not his cookie, not his key');
  assert.match(init.headers['user-agent'], /^Ghosty\/2\.0 \(personal assistant; single user\)$/);
  // a ZIP member: its escapes go on exactly as the phone wrote them
  const m = archive(200, { body: new Uint8Array(4) });
  await pass('idgames_202003/idgames.zip/idgames%2Fthemes%2Fhr%2Fhr.zip', m);
  assert.equal(m.asked[0].url, 'https://archive.org/cors/idgames_202003/idgames.zip/idgames%2Fthemes%2Fhr%2Fhr.zip');
});

test('the package is streamed back byte for byte, unread here, under the headers of a download that can never run as a page', async () => {
  const all = bytes(300_000, 5);
  const { body, state } = pieces(all);
  const sent = {
    'content-length': String(all.length),
    'accept-ranges': 'bytes',
    'last-modified': 'Mon, 21 Jul 2025 10:00:00 GMT',
    etag: '"5f3a9c-4a38"',
    'content-type': 'application/zip',
    'content-disposition': 'inline; filename="x.zip"',
    'cache-control': 'no-cache',
    'access-control-allow-origin': '*',
    'x-archive-meta': 'secret',
  };
  const up = archive(200, { body, headers: sent });
  const res = await pass('Epic-pinball-sw1/pinball.zip', up);
  assert.equal(res.status, 200);
  // not read by the Worker: nothing was taken from the body until the phone asked for it
  assert.equal(state.taken, 0, 'the Worker read the package');
  // what is copied from the Archive, when it sent it
  assert.equal(res.headers.get('content-length'), String(all.length));
  assert.equal(res.headers.get('accept-ranges'), 'bytes');
  assert.equal(res.headers.get('last-modified'), 'Mon, 21 Jul 2025 10:00:00 GMT');
  assert.equal(res.headers.get('etag'), '"5f3a9c-4a38"');
  // what is set here, whatever the Archive said
  assert.equal(res.headers.get('content-type'), 'application/octet-stream');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('content-security-policy'), "sandbox; default-src 'none'");
  assert.equal(res.headers.get('content-disposition'), 'attachment');
  assert.equal(res.headers.get('cache-control'), 'public, max-age=604800');
  // and nothing else of the Archive's goes on
  assert.equal(res.headers.get('access-control-allow-origin'), null);
  assert.equal(res.headers.get('x-archive-meta'), null);
  assert.equal(res.headers.get('content-range'), null, 'only when the Archive sent one');
  const got = new Uint8Array(await res.arrayBuffer());
  assert.equal(got.length, all.length);
  assert.equal(sha(got), sha(all), 'the same bytes');
  assert.ok(state.taken > 3, 'it arrived in pieces');
  // headers the Archive did not send are not made up
  const bare = await pass('Epic-pinball-sw1/pinball.zip', archive(200, { body: new Uint8Array(4) }));
  for (const k of ['content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag']) assert.equal(bare.headers.get(k), null, k);
});

test('HEAD asks the Archive with HEAD and sends no body, only the size and the rest of the headers', async () => {
  const up = archive(200, { body: new Uint8Array(50), headers: { 'content-length': '24143781', 'accept-ranges': 'bytes', etag: '"x"' } });
  const res = await pass('freedoom-0.13.0/freedoom-0.13.0.zip', up, { method: 'HEAD' });
  assert.equal(up.asked[0].init.method, 'HEAD');
  assert.equal(res.status, 200);
  assert.equal(res.body, null, 'no body, even from an Archive that sent one');
  assert.equal(await res.text(), '');
  assert.equal(res.headers.get('content-length'), '24143781');
  assert.equal(res.headers.get('accept-ranges'), 'bytes');
  assert.equal(res.headers.get('etag'), '"x"');
  assert.equal(res.headers.get('cache-control'), 'public, max-age=604800');
  assert.equal(res.headers.get('content-disposition'), 'attachment');
});

test('a Range from the phone goes to the Archive and its 206 comes back with its Content-Range; a Range that is not one piece is not passed on', async () => {
  const all = bytes(1000, 9);
  for (const range of ['bytes=0-99', 'bytes=100-', 'bytes=-500', 'bytes=0-0']) {
    const up = archive(206, { body: all.slice(0, 100), headers: { 'content-range': 'bytes 0-99/1000', 'content-length': '100', 'accept-ranges': 'bytes' } });
    const res = await pass('Raptor-sw1/raptor.zip', up, { headers: { range } });
    assert.equal(up.asked[0].init.headers.range, range, range);
    assert.equal(res.status, 206, range);
    assert.equal(res.headers.get('content-range'), 'bytes 0-99/1000');
    assert.equal(res.headers.get('content-length'), '100');
    assert.equal(res.headers.get('accept-ranges'), 'bytes');
    assert.equal(sha(new Uint8Array(await res.arrayBuffer())), sha(all.slice(0, 100)));
  }
  // none, or not a single piece of bytes: the whole file is asked for (a Range the Archive could not read is its to ignore)
  for (const range of [undefined, '', 'bytes=0-9,20-29', 'items=0-9', 'bytes=a-b', 'bytes=-', 'bytes=5', 'bytes=0-9;x']) {
    const up = archive(200, { body: all });
    const res = await pass('Raptor-sw1/raptor.zip', up, { headers: range === undefined ? {} : { range } });
    assert.equal('range' in up.asked[0].init.headers, false, JSON.stringify(range));
    assert.equal(res.status, 200, JSON.stringify(range));
  }
  // a 206 for a HEAD with a range, too
  const h = archive(206, { headers: { 'content-range': 'bytes 0-9/1000', 'content-length': '10' } });
  const hr = await pass('Raptor-sw1/raptor.zip', h, { method: 'HEAD', headers: { range: 'bytes=0-9' } });
  assert.equal(hr.status, 206);
  assert.equal(hr.body, null);
  assert.equal(hr.headers.get('content-range'), 'bytes 0-9/1000');
});

test('the Archive’s own words: a 404 is "no longer has that file"; any other refusal is a 502 naming its status; silence is a 502; none of them read', async () => {
  const body = () => pieces(bytes(100_000, 1));
  const gone = body();
  const r404 = await pass('Idstuff/Idstuff.zip', archive(404, { body: gone.body }));
  assert.equal(r404.status, 404);
  assert.deepEqual(await r404.json(), { error: 'the Archive no longer has that file' });
  assert.equal(gone.state.cancelled, true, 'its page is let go, not read');
  assert.equal(gone.state.taken, 0);
  for (const status of [301, 302, 400, 401, 403, 416, 429, 500, 502, 503, 504]) {
    const b = body();
    const res = await pass('Idstuff/Idstuff.zip', archive(status, { body: b.body }));
    assert.equal(res.status, 502, `the Archive answered ${status}`);
    const said = (await res.json()).error;
    assert.match(said, new RegExp(`archive\\.org answered ${status}\\b`));
    assert.equal(res.headers.get('content-type'), 'application/json');
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.equal(b.state.cancelled, true, `${status}: its page is let go`);
    assert.equal(b.state.taken, 0, `${status}: not read`);
  }
  for (const thrown of [new TypeError('fetch failed'), new DOMException('timed out', 'TimeoutError'), new Error('connection reset')]) {
    const res = await pass('Idstuff/Idstuff.zip', async () => { throw thrown; });
    assert.equal(res.status, 502);
    assert.deepEqual(await res.json(), { error: 'archive.org could not be reached' });
  }
});

// ---------------------------------------------------------------- the route, in the Worker

test('the route is behind the owner’s sign-in and a same-site request, and never reaches the brain', async () => {
  const KEY = 'arcade-mirror-test-key-0123456789';
  const reached = [];
  const env = {
    OWNER_KEY: KEY,
    AGENT: {
      idFromName: () => (reached.push('id'), { toString: () => 'owner' }),
      get: () => (reached.push('get'), { fetch: async () => (reached.push('fetch'), new Response('{"brain":true}')) }),
    },
  };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const go = (path, headers = {}, method = 'GET') => W.fetch(new Request(`https://ghosty.test${path}`, { method, headers }), env, ctx);
  const up = archive(200, { body: bytes(2000, 4), headers: { 'content-length': '2000' } });
  const real = globalThis.fetch;
  globalThis.fetch = up;
  try {
    const path = '/api/arcade/Idstuff/Idstuff.zip/Idstuff%2FDoom%2Fdoom19s.zip';
    // a stranger, and a wrong key: the sign-in answers; the Archive is not asked
    const stranger = await go(path);
    assert.equal(stranger.status, 401);
    assert.equal((await stranger.json()).auth, true);
    assert.equal((await go(path, { 'x-ghosty-key': 'not-the-key-not-the-key-not-the-key' })).status, 401);
    assert.equal(up.asked.length, 0, 'the Archive was asked for a stranger');
    // another site's page, even with the key: refused like every call to the brain
    assert.equal((await go(path, { 'x-ghosty-key': KEY, 'sec-fetch-site': 'cross-site' })).status, 403);
    assert.equal(up.asked.length, 0);
    // the owner: an item that is not on the shelf is the Worker's own 404; a shelf item is streamed from the Archive
    const owner = { 'x-ghosty-key': KEY, 'sec-fetch-site': 'same-origin' };
    const no = await go('/api/arcade/Somewhere/else.zip', owner);
    assert.equal(no.status, 404);
    assert.match((await no.json()).error, /not a package from the arcade shelf/);
    assert.equal(up.asked.length, 0);
    const ok = await go(path, owner);
    assert.equal(ok.status, 200);
    assert.equal(up.asked.length, 1);
    assert.equal(up.asked[0].url, 'https://archive.org/cors/Idstuff/Idstuff.zip/Idstuff%2FDoom%2Fdoom19s.zip');
    assert.equal(ok.headers.get('content-disposition'), 'attachment');
    assert.equal(sha(new Uint8Array(await ok.arrayBuffer())), sha(bytes(2000, 4)));
    // a query on the phone's address is not passed to the Archive
    assert.equal((await go(`${path}?next=https://evil.example/&x=1`, owner)).status, 200);
    assert.equal(up.asked.at(-1).url, 'https://archive.org/cors/Idstuff/Idstuff.zip/Idstuff%2FDoom%2Fdoom19s.zip');
    up.asked.pop();
    // a state-changing method is the passthrough's own 405 (with the header the interface always sends)
    assert.equal((await go(path, { ...owner, 'x-ghosty': '1' }, 'POST')).status, 405);
    assert.equal((await go('/api/arcade/', owner)).status, 404);
    assert.equal(up.asked.length, 1);
    assert.deepEqual(reached, [], 'the brain (the Durable Object) was reached');
  } finally {
    globalThis.fetch = real;
  }
});

// ---------------------------------------------------------------- the phone's store

const KEY = 'owner-key-owner-key-owner-key-0123';
const SITE = 'https://ghosty.test';
const ARCHIVE_URL = 'https://archive.org/cors/Idstuff/Idstuff.zip/Idstuff%2FDoom%2Fdoom19s.zip';
const dataOf = (pkg, url = [ARCHIVE_URL]) => ({ url, sha256: sha(pkg), bytes: pkg.length, licence: 'free to pass on', credit: 'the tests', take: [{ name: 'x', from: ['x'] }] });
/** The phone with its location set; `fn` runs with it, and it is put back. */
async function onSite(fn, origin = SITE) {
  globalThis.location = { origin };
  try {
    return await fn();
  } finally {
    delete globalThis.location;
  }
}

test('GET: the public mirrors first; when every one fails, this site’s own copy of each Archive address, asked with the owner’s sign-in and nothing of his sent to a public mirror', async () => {
  const pkg = bytes(70_000, 2);
  const data = dataOf(pkg, [ARCHIVE_URL, 'https://archive.org/cors/doom19s_202607/doom19s.zip', 'https://mirror.example/other.zip']);
  const asked = [];
  const ownHeaders = () => ({ 'x-ghosty': '1', 'x-ghosty-key': KEY });
  // the first mirror is silent (his network), the second answers 404, the third sends the wrong bytes: then this site's copy of the two Archive addresses
  const fetch = async (url, init) => {
    asked.push({ url, init });
    if (url === ARCHIVE_URL) throw new TypeError('Load failed');
    if (url === 'https://archive.org/cors/doom19s_202607/doom19s.zip') return new Response('gone', { status: 404 });
    if (url === 'https://mirror.example/other.zip') return new Response(bytes(10, 3));
    if (url === `${SITE}/api/arcade/Idstuff/Idstuff.zip/Idstuff%2FDoom%2Fdoom19s.zip`) return new Response(null, { status: 502 });
    if (url === `${SITE}/api/arcade/doom19s_202607/doom19s.zip`) return new Response(pkg);
    throw new Error(`asked ${url}`);
  };
  const got = await onSite(() => store.fetchPackage(data, undefined, { fetch, ownHeaders }));
  assert.equal(sha(got), sha(pkg));
  assert.deepEqual(asked.map((a) => a.url), [ARCHIVE_URL, 'https://archive.org/cors/doom19s_202607/doom19s.zip', 'https://mirror.example/other.zip', `${SITE}/api/arcade/Idstuff/Idstuff.zip/Idstuff%2FDoom%2Fdoom19s.zip`, `${SITE}/api/arcade/doom19s_202607/doom19s.zip`]);
  // a public mirror: cross-origin, no cookie, no header of his; this site: the cookie goes along, and his key
  for (const a of asked.slice(0, 3)) {
    assert.equal(a.init.credentials, 'omit', a.url);
    assert.equal(a.init.headers, undefined, `${a.url}: nothing of the owner goes to a public mirror`);
    assert.equal(a.init.mode, 'cors');
    assert.equal(a.init.cache, 'no-store');
  }
  for (const a of asked.slice(3)) {
    assert.equal(a.init.credentials, 'same-origin', a.url);
    assert.deepEqual(a.init.headers, { 'x-ghosty': '1', 'x-ghosty-key': KEY });
    assert.equal(a.init.cache, 'no-store');
  }
});

test('GET: a public mirror that works means this site’s copy is never asked; a game with no Archive address has no copy here', async () => {
  const pkg = bytes(5000, 8);
  const asked = [];
  const fetch = async (url) => (asked.push(url), new Response(pkg));
  await onSite(() => store.fetchPackage(dataOf(pkg), undefined, { fetch, ownHeaders: () => ({ 'x-ghosty-key': KEY }) }));
  assert.deepEqual(asked, [ARCHIVE_URL]);
  // addresses that are not archive.org/cors/…: the public mirrors only, as before
  const other = ['https://mirror.example/a.zip', 'https://archive.org/download/x/a.zip', 'https://ia800000.us.archive.org/cors/x/a.zip', 'https://github.com/o/r/releases/download/v1/a.zip'];
  const seen = [];
  await assert.rejects(
    onSite(() => store.fetchPackage(dataOf(pkg, other), undefined, { fetch: async (url) => (seen.push(url), new Response('', { status: 404 })) })),
    /^Error: No mirror gave the right file \(mirror\.example: answered 404; archive\.org: answered 404; ia800000\.us\.archive\.org: answered 404; github\.com: answered 404\)\.$/,
  );
  assert.deepEqual(seen, other);
  // a page with no origin (the tests, a sandboxed frame) has no copy here either
  const none = [];
  await assert.rejects(store.fetchPackage(dataOf(pkg), undefined, { fetch: async (url) => (none.push(url), new Response('', { status: 404 })) }), /^Error: No mirror gave the right file \(archive\.org: answered 404\)\.$/);
  assert.deepEqual(none, [ARCHIVE_URL]);
  await assert.rejects(onSite(() => store.fetchPackage(dataOf(pkg), undefined, { fetch: async () => new Response('', { status: 404 }) }), 'null'), /^Error: No mirror gave the right file \(archive\.org: answered 404\)\.$/);
});

test('GET: when nothing works the reason names "this site" beside the Archive; this site’s copy is checked by size and SHA-256 like any other', async () => {
  const pkg = bytes(9000, 6);
  const owner = { ownHeaders: () => ({ 'x-ghosty-key': KEY }) };
  // his network: the Archive is silent, the Worker's own copy says the Archive no longer has it
  const silent = async (url) => {
    if (new URL(url).host === 'archive.org') throw new TypeError('Load failed');
    return new Response(JSON.stringify({ error: 'the Archive no longer has that file' }), { status: 404 });
  };
  await assert.rejects(onSite(() => store.fetchPackage(dataOf(pkg), undefined, { fetch: silent, ...owner })), /^Error: No mirror gave the right file \(archive\.org: Load failed; this site: answered 404\)\.$/);
  // and signed out
  await assert.rejects(onSite(() => store.fetchPackage(dataOf(pkg), undefined, { fetch: async (url) => { if (new URL(url).host === 'archive.org') throw new TypeError('Load failed'); return new Response('{}', { status: 401 }); }, ...owner })), /this site: answered 401\)\.$/);
  // this site's copy with other bytes, or too few, or too many, is refused
  const wrong = (body) => async (url) => { if (new URL(url).host === 'archive.org') throw new TypeError('Load failed'); return new Response(body); };
  await assert.rejects(onSite(() => store.fetchPackage(dataOf(pkg), undefined, { fetch: wrong(bytes(9000, 7)), ...owner })), /this site: its checksum is not the one this game is known by\)\.$/);
  await assert.rejects(onSite(() => store.fetchPackage(dataOf(pkg), undefined, { fetch: wrong(pkg.slice(0, 8999)), ...owner })), /this site: sent 8999 bytes, not 9000\)\.$/);
  await assert.rejects(onSite(() => store.fetchPackage(dataOf(pkg), undefined, { fetch: wrong(bytes(9001, 6)), ...owner })), /this site: sent more than 9000 bytes\)\.$/);
  // asked without the owner's headers (a caller that passes none): the cookie still goes along, no header is made up
  const bare = [];
  await assert.rejects(onSite(() => store.fetchPackage(dataOf(pkg), undefined, { fetch: async (url, init) => { bare.push(init); throw new TypeError('Load failed'); } })), /archive\.org: Load failed; this site: Load failed\)\.$/);
  assert.equal(bare[1].credentials, 'same-origin');
  assert.equal(bare[1].headers, undefined);
  // the phone's own Stop ends it at once: this site's copy is not tried after
  const ctl = new AbortController();
  const stopped = [];
  await assert.rejects(
    onSite(() => store.fetchPackage(dataOf(pkg), undefined, { fetch: async (url) => { stopped.push(url); ctl.abort(); throw new DOMException('Stopped', 'AbortError'); }, signal: ctl.signal, ...owner })),
    (e) => e.name === 'AbortError',
  );
  assert.deepEqual(stopped, [ARCHIVE_URL]);
});

test('every package on the shelf and every free level: the public mirrors in their order, then this site’s copy of each Archive address — the same path under /api/arcade/', async () => {
  const datas = [...new Map([...SHELF.flatMap((g) => (g.data ? [g.data] : [])), ...LEVELS.map((p) => p.data)].map((d) => [d.url.join(), d])).values()];
  assert.ok(datas.length >= 20, `${datas.length} packages`);
  for (const d of datas) {
    const asked = [];
    await assert.rejects(onSite(() => store.fetchPackage(d, undefined, { fetch: async (url) => (asked.push(url), new Response('', { status: 404 })) })), /No mirror gave the right file/);
    const own = d.url.filter((u) => u.startsWith('https://archive.org/cors/')).map((u) => `${SITE}/api/arcade/${u.slice('https://archive.org/cors/'.length)}`);
    assert.equal(own.length, d.url.length, 'every shelf address is an Archive address');
    assert.deepEqual(asked, [...d.url, ...own], d.url.join());
  }
});

test('end to end: his network drops every fetch of the Archive ("Load failed"), the Worker fetches the package and streams it through, and the phone gets the right bytes', async () => {
  const pkg = bytes(300_000, 11);
  const data = dataOf(pkg);
  const env = {
    OWNER_KEY: KEY,
    AGENT: { idFromName: () => { throw new Error('the brain was reached'); }, get: () => { throw new Error('the brain was reached'); } },
  };
  const calls = [];
  // the Archive, behind the Worker: it has the file at its address and says 404 to anything else
  const theArchive = async (url) => {
    calls.push(`worker -> ${url}`);
    return url === ARCHIVE_URL ? new Response(pieces(pkg).body, { status: 200, headers: { 'content-length': String(pkg.length), 'content-type': 'application/zip' } }) : new Response('', { status: 404 });
  };
  const realFetch = globalThis.fetch;
  // the phone's fetch: the Archive is silent to it; this site's address goes to the Worker, with what the phone sent
  const phone = async (url, init) => {
    calls.push(`phone -> ${url} (${init.credentials})`);
    if (new URL(url).host === 'archive.org') throw new TypeError('Load failed');
    globalThis.fetch = theArchive;
    try {
      return await W.fetch(new Request(url, { headers: { 'sec-fetch-site': 'same-origin', ...(init.headers ?? {}) } }), env, { waitUntil() {}, passThroughOnException() {} });
    } finally {
      globalThis.fetch = realFetch;
    }
  };
  const progress = [];
  const got = await onSite(() => store.fetchPackage(data, (p) => progress.push(p), { fetch: phone, ownHeaders: () => ({ 'x-ghosty': '1', 'x-ghosty-key': KEY }) }));
  assert.equal(sha(got), sha(pkg), 'the same bytes, through the Worker');
  assert.deepEqual(calls, [`phone -> ${ARCHIVE_URL} (omit)`, `phone -> ${SITE}/api/arcade/Idstuff/Idstuff.zip/Idstuff%2FDoom%2Fdoom19s.zip (same-origin)`, `worker -> ${ARCHIVE_URL}`]);
  assert.equal(progress.at(-1).phase, 'check');
  assert.ok(progress.some((p) => p.phase === 'download' && p.got === pkg.length));
  // signed out (no key): the Worker turns the phone away at the door, and the phone says so
  await assert.rejects(
    onSite(() => store.fetchPackage(data, undefined, { fetch: phone })),
    /^Error: No mirror gave the right file \(archive\.org: Load failed; this site: answered 401\)\.$/,
  );
});
