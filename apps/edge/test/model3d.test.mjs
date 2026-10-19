// Pictures and words into 3-D models (model3d.ts, gen3d.ts, gradio.ts, catalog3d.ts, tools/studio.ts) with
// every Hugging Face Space stubbed by its real protocol: the Gradio queue client, Stable Fast 3D and TRELLIS.2,
// the makers in turn, never billing the owner (a token is sent to a ZeroGPU Space only from a free account that
// cannot pay), every try counted against Ghosty's own cap, keeping the GLB in KV for 24 hours under m3d:, the
// owner-only routes (the catalogue's bytes passed through unread: the brain never parses or packs it), make_3d,
// the catalogue (licences, brands, search by head noun), GLB packing and the stand-ins.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const M = await import('./.build/model3d.mjs');
const T = await import('./.build/tools/index.mjs');
const L = await import('./.build/lens.mjs');

function fakeKv() {
  return {
    m: new Map(),
    ttl: new Map(),
    async get(k, type) {
      if (!this.m.has(k)) return null;
      const v = this.m.get(k);
      if (type === 'arrayBuffer') return typeof v === 'string' ? new TextEncoder().encode(v).buffer : v.slice(0);
      if (type === 'text') return typeof v === 'string' ? v : new TextDecoder().decode(v);
      return typeof v === 'string' ? JSON.parse(v) : v;
    },
    async put(k, v, opts) {
      this.m.set(k, typeof v === 'string' ? v : v.slice(0));
      if (opts?.expirationTtl) this.ttl.set(k, opts.expirationTtl);
      else this.ttl.delete(k);
    },
    async delete(k) {
      this.m.delete(k);
      this.ttl.delete(k);
    },
  };
}

/** A tiny but real binary glTF (header + JSON chunk), `extra` bytes of padding to tell copies apart. */
function glb(extra = 0) {
  const json = new TextEncoder().encode(JSON.stringify({ asset: { version: '2.0' } }).padEnd(28 + extra, ' '));
  const pad = (4 - (json.length % 4)) % 4;
  const jl = json.length + pad;
  const b = new Uint8Array(12 + 8 + jl);
  const v = new DataView(b.buffer);
  v.setUint32(0, 0x46546c67, true);
  v.setUint32(4, 2, true);
  v.setUint32(8, b.length, true);
  v.setUint32(12, jl, true);
  v.setUint32(16, 0x4e4f534a, true);
  b.set(json, 20);
  b.fill(0x20, 20 + json.length);
  return b.buffer;
}
const LIGHT = glb(0);
const png = () => {
  const b = new Uint8Array(400);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return b.buffer;
};

/** Streams `text` in small chunks that cut messages in half, as a real event stream arrives. */
const stream = (text) => {
  const bytes = new TextEncoder().encode(text);
  let i = 0;
  return new Response(new ReadableStream({ pull(c) { if (i >= bytes.length) return c.close(); c.enqueue(bytes.slice(i, i + 97)); i += 97; } }), { headers: { 'content-type': 'text/event-stream' } });
};

/**
 * Hugging Face's whoami-v2 in front of `f`, by token: hf_free… a free account that cannot pay; hf_pro… PRO;
 * hf_pay… a free account with a card on file (canPay); hf_org… a member of an Enterprise organisation;
 * hf_down… whoami does not answer; anything else is refused (401). `asked` lists the tokens looked up.
 */
function withWhoami(f, asked = []) {
  return async (url, init = {}) => {
    if (String(url) !== 'https://huggingface.co/api/whoami-v2') return f(url, init);
    const tok = String(init.headers?.Authorization ?? '').replace(/^Bearer /, '');
    asked.push(tok);
    const base = { type: 'user', name: 'owner', isPro: false, canPay: false, orgs: [] };
    if (tok.startsWith('hf_down')) throw new TypeError('fetch failed');
    if (tok.startsWith('hf_free')) return new Response(JSON.stringify(base));
    if (tok.startsWith('hf_pro')) return new Response(JSON.stringify({ ...base, isPro: true, canPay: true }));
    if (tok.startsWith('hf_pay')) return new Response(JSON.stringify({ ...base, canPay: true }));
    if (tok.startsWith('hf_org')) return new Response(JSON.stringify({ ...base, orgs: [{ name: 'acme', isEnterprise: true, plan: 'enterprise' }] }));
    return new Response('{"error":"Invalid credentials"}', { status: 401 });
  };
}

const ctxWith = (env, vault = {}) => {
  const progress = [];
  const events = [];
  return { env, origin: 'https://ghosty.example', progress: (l) => progress.push(l), emit: (e) => events.push(e), storage: {}, vault: { get: async (k) => vault[k] ?? null }, kernelUnlocked: async () => false, github: async () => null, _progress: progress, _events: events };
};

const CX = JSON.parse(readFileSync(new URL('./catalog3d.fixture.json', import.meta.url), 'utf8'));
const INDEX = JSON.parse(readFileSync(new URL('../../web/public/data/models3d.json', import.meta.url), 'utf8'));

/** A small Objaverse index in the static file's shape. */
const ovIndex = (rows) => ({ v: 1, cats: ['armchair', 'sofa', 'kettle', 'television set', 'knife', 'chair', 'mug'], items: rows });
const ovRow = (uid, name, cat, lic = 1, kb = 900, faces = 20000, tags = '') => [uid.padEnd(32, '0'), 7, name, cat, lic, 'Some Author', kb, faces, `${'a'.repeat(32)}/thumb.jpeg`, tags];

test('catalogue: only CC0 and CC BY 4.0 are kept; NonCommercial, NoDerivatives and ShareAlike are not', () => {
  assert.equal(M.licenceOf('cc0'), 'CC0');
  assert.equal(M.licenceOf('CC0'), 'CC0');
  assert.equal(M.licenceOf('by'), 'CC BY 4.0');
  assert.equal(M.licenceOf('CC-BY 4.0'), 'CC BY 4.0');
  for (const bad of ['by-nc', 'by-sa', 'by-nd', 'by-nc-sa', 'by-nc-nd', 'CC BY-NC 4.0', '', null, 'all rights reserved']) assert.equal(M.licenceOf(bad), null, String(bad));
  const items = M.objaverseItems({ v: 1, cats: ['mug'], items: [ovRow('a1', 'Mug', 0, 0), ovRow('a2', 'Mug two', 0, 1), ovRow('a3', 'NC mug', 0, 2), ovRow('a4', 'Heavy mug', 0, 1, 50_000), ovRow('a5', 'Dense mug', 0, 1, 900, 900_000), ['nothex', 1, 'x', 0, 0, 'a', 1, 1, 'a/b.jpeg', ''], [...ovRow('a6', 'No author', 0, 0).slice(0, 5), '', 1, 1, `${'a'.repeat(32)}/t.jpeg`, '']] });
  assert.deepEqual(items.map((i) => i.name), ['Mug', 'Mug two']);
  assert.deepEqual(items.map((i) => i.licence), ['CC0', 'CC BY 4.0']);
  assert.equal(items[0].source, 'Objaverse');
  assert.equal(items[0].group, 'Kitchen & dining');
  assert.match(items[0].thumb, /^https:\/\/media\.sketchfab\.com\/models\/a10{30}\/thumbnails\/a{32}\/thumb\.jpeg$/);
  assert.equal(M.objaverseGlb(items[0]), `https://huggingface.co/datasets/allenai/objaverse/resolve/main/glbs/000-007/a1${'0'.repeat(30)}.glb`);
  assert.equal(M.objaverseGlb({ id: 'ph:ArmChair_01' }), null);
  assert.match(M.creditLine(items[1]), /^“Mug two” by Some Author · CC BY 4\.0 · Sketchfab, via Objaverse$/);
  assert.match(M.creditLine(items[0]), /CC0 \(public domain\)/);
  assert.deepEqual(M.objaverseItems(null), []);
  assert.deepEqual(M.objaverseItems({ items: 'x' }), []);
});

test("catalogue: Poly Haven's real API answer → CC0 items with their authors and shelves; a 17-million-face scan is left out", () => {
  const items = M.polyHavenItems(CX.assets);
  assert.deepEqual(items.map((i) => i.id).sort(), ['ph:ArmChair_01', 'ph:Sofa_01', 'ph:Television_01', 'ph:brass_goblets', 'ph:vintage_electric_kettle']);
  const chair = items.find((i) => i.id === 'ph:ArmChair_01');
  assert.equal(chair.licence, 'CC0');
  assert.equal(chair.author, 'Kirill Sannikov');
  assert.equal(chair.group, 'Furniture');
  assert.equal(chair.cat, 'chairs');
  assert.match(chair.thumb, /^https:\/\/cdn\.polyhaven\.com\/asset_img\/thumbs\/ArmChair_01\.png/);
  assert.equal(chair.page, 'https://polyhaven.com/a/ArmChair_01');
  assert.equal(items.find((i) => i.id === 'ph:vintage_electric_kettle').group, 'Kitchen & dining');
  assert.equal(items.find((i) => i.id === 'ph:Television_01').group, 'Electronics');
  assert.match(M.creditLine(chair), /^“Arm Chair 01” by Kirill Sannikov · CC0 \(public domain\) · Poly Haven$/);
});

test('search: words with synonyms and plurals, the head noun first; a good match is told from a poor one', () => {
  const items = [
    ...M.objaverseItems(ovIndex([ovRow('b1', 'Vintage armchair', 0), ovRow('b2', 'Chesterfield', 1, 1, 900, 20000, 'couch leather'), ovRow('b3', 'Electric kettle', 2, 0), ovRow('b4', 'Old CRT', 3), ovRow('b5', 'Chef knife', 4), ovRow('b6', 'Oak dining chair', 5, 1, 900, 20000, 'oak wood'), ovRow('b7', 'Plastic chair', 5, 1, 300), ovRow('b8', 'Coffee mug', 6)])),
    ...M.polyHavenItems(CX.assets),
  ];
  const top = (q, opts) => M.searchCatalog(items, q, opts)[0]?.item.name;
  assert.equal(top('oak dining chair'), 'Oak dining chair');
  assert.ok(['Electric kettle', 'Vintage Electric Kettle'].includes(top('kettle')));
  assert.ok(['Chesterfield', 'Sofa 01'].includes(top('a couch')), 'couch finds sofas');
  assert.ok(['Chesterfield', 'Sofa 01'].includes(top('settee')));
  assert.equal(top('knives'), 'Chef knife', 'plural to singular');
  assert.ok(['Old CRT', 'Television 01'].includes(top('telly')), 'British word, American category');
  assert.ok(M.searchCatalog(items, 'cup').slice(0, 2).some((h) => h.item.name === 'Coffee mug'), 'cup finds mugs');
  assert.ok(M.searchCatalog(items, 'chair', { group: 'Kitchen & dining' }).every((h) => h.item.group === 'Kitchen & dining'));
  assert.ok(M.goodMatch(M.searchCatalog(items, 'oak dining chair')[0]));
  assert.ok(M.goodMatch(M.searchCatalog(items, 'an electric kettle please')[0]));
  // "a chair cushion" is a cushion: there is none, so no good match even though there are chairs
  assert.ok(!M.goodMatch(M.searchCatalog(items, 'chair cushion')[0]));
  assert.equal(M.searchCatalog(items, 'flux capacitor').length, 0);
  assert.ok(!M.goodMatch(M.searchCatalog(items, 'quantum flux capacitor')[0]));
  assert.ok(M.goodMatch(M.searchCatalog(items, 'a sofa')[0]));
  // an empty query lists the shelf
  assert.equal(M.searchCatalog(items, '', { group: 'Furniture', limit: 3 }).length, 3);
  assert.deepEqual(M.words('Chests of Drawers and TV-stands'), ['chest_of_drawers', 'chest', 'drawers', 'tv', 'stand']);
});

test('the shipped index: thousands of permissively licensed models a phone can open, and everyday searches find them', () => {
  const items = M.objaverseItems(INDEX);
  assert.ok(items.length >= 4000, `${items.length} models`);
  assert.equal(items.length, INDEX.items.length, 'every row of the shipped index is valid');
  assert.ok(items.every((i) => (i.licence === 'CC0' || i.licence === 'CC BY 4.0') && i.author && i.kb <= M.MAX_KB && i.faces <= M.MAX_FACES));
  assert.ok(new Set(items.map((i) => i.cat)).size >= 700, 'hundreds of categories');
  const shelves = new Set(items.map((i) => i.group));
  for (const g of ['Furniture', 'Kitchen & dining', 'Electronics', 'Tools & DIY', 'Clothes & accessories', 'Food & drink']) assert.ok(shelves.has(g), g);
  for (const q of ['kettle', 'sofa', 'mug', 'table lamp', 'toaster', 'bicycle', 'teddy bear', 'guitar', 'hammer', 'fridge', 'bookcase', 'trainers', 'bed'])
    assert.ok(M.goodMatch(M.searchCatalog(items, q)[0]), `"${q}" → ${M.searchCatalog(items, q)[0]?.item.name ?? 'nothing'}`);
});

/** A minimal glTF with one external buffer and two external pictures. */
const tinyGltf = () => ({
  asset: { version: '2.0' },
  buffers: [{ uri: 'Thing.bin', byteLength: 6 }],
  bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 4 }, { buffer: 0, byteOffset: 4, byteLength: 2 }],
  images: [{ uri: 'textures/Thing_diff_1k.jpg' }, { uri: 'textures/Thing%20nor.png', name: 'n' }],
});
const readGlb = (b) => {
  const v = new DataView(b);
  assert.equal(v.getUint32(0, true), 0x46546c67);
  assert.equal(v.getUint32(8, true), b.byteLength, 'the header says the whole length');
  const jl = v.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(b, 20, jl)));
  const bl = v.getUint32(20 + jl, true);
  assert.equal(v.getUint32(24 + jl, true), 0x004e4942);
  return { json, bin: new Uint8Array(b, 28 + jl, bl) };
};

test('packGlb: a .gltf and its files become one binary glTF — buffers merged, pictures embedded with their types', () => {
  const files = new Map([
    ['Thing.bin', new Uint8Array([1, 2, 3, 4, 5, 6]).buffer],
    ['textures/Thing_diff_1k.jpg', new Uint8Array([0xff, 0xd8, 0xff, 9, 9]).buffer],
    ['textures/Thing nor.png', new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer],
  ]);
  const glb = M.packGlb(tinyGltf(), files);
  assert.ok(M.isGlb(glb));
  const { json, bin } = readGlb(glb);
  assert.deepEqual(json.buffers, [{ byteLength: bin.byteLength }]);
  assert.equal(bin.byteLength % 4, 0);
  assert.deepEqual([...bin.slice(0, 6)], [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(json.bufferViews.slice(0, 2), [{ buffer: 0, byteOffset: 0, byteLength: 4 }, { buffer: 0, byteOffset: 4, byteLength: 2 }]);
  const [diff, nor] = json.images;
  assert.equal(diff.uri, undefined);
  assert.equal(diff.mimeType, 'image/jpeg');
  assert.equal(nor.mimeType, 'image/png');
  const view = json.bufferViews[diff.bufferView];
  assert.equal(view.byteOffset % 4, 0);
  assert.deepEqual([...bin.slice(view.byteOffset, view.byteOffset + view.byteLength)], [0xff, 0xd8, 0xff, 9, 9]);
  assert.throws(() => M.packGlb(tinyGltf(), new Map([['Thing.bin', new ArrayBuffer(6)]])), /names a file it did not come with/);
});

test("thumbnails: only Poly Haven's and Sketchfab's picture hosts, only pictures, only small ones", async () => {
  const f = async (u) => (String(u).endsWith('.svg') ? new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } }) : String(u).endsWith('big.jpeg') ? new Response(new Uint8Array(500_000), { headers: { 'content-type': 'image/jpeg' } }) : new Response(new Uint8Array(100), { headers: { 'content-type': 'image/webp' } }));
  const ok = await M.thumbResponse('https://cdn.polyhaven.com/asset_img/thumbs/ArmChair_01.png?width=256', f);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('content-type'), 'image/webp');
  assert.match(ok.headers.get('content-security-policy'), /sandbox/);
  assert.equal((await M.thumbResponse('https://media.sketchfab.com/models/abc/thumbnails/x/y.jpeg', f)).status, 200);
  assert.equal((await M.thumbResponse('https://evil.example/a.png', f)).status, 403);
  assert.equal((await M.thumbResponse('https://media.sketchfab.com.evil.example/models/a.png', f)).status, 403);
  assert.equal((await M.thumbResponse('https://cdn.polyhaven.com/asset_img/a.svg', f)).status, 502);
  await assert.rejects((await M.thumbResponse('https://cdn.polyhaven.com/asset_img/big.jpeg', f)).arrayBuffer(), /too big/);
  assert.equal((await M.thumbResponse('not a url', f)).status, 400);
});

// ---- a Gradio Space, stubbed by the protocol: /config (api_prefix from Gradio 5), /upload, /queue/join, /queue/data
const sse = (...evs) => evs.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
/**
 * A Gradio app. `fns` = [{ api, out(data) → output data, or {error, title} for a failed run }, …]; `prefix` = Gradio 5's
 * /gradio_api. Records every call; a stream is only answered for a session that joined.
 */
function fakeGradio(root, fns, { prefix = '', rank = 1, configStatus = 200, joinStatus = 200 } = {}) {
  const base = root + prefix;
  const calls = [];
  const joins = [];
  const pending = new Map();
  const config = { version: prefix ? '5.34.2' : '4.44.0', protocol: 'sse_v3', ...(prefix ? { api_prefix: prefix } : {}), dependencies: fns.map((f, i) => ({ id: i + 3, api_name: f.api, targets: [[40 + i, 'click']] })) };
  const f = async (url, init = {}) => {
    const u = String(url);
    calls.push({ url: u, auth: init.headers?.Authorization ?? null });
    if (u === `${root}/config`) return new Response(JSON.stringify(config), { status: configStatus });
    if (u === `${base}/upload`) return new Response(JSON.stringify(['/tmp/gradio/up1/picture.png']));
    if (u === `${base}/queue/join`) {
      const j = JSON.parse(init.body);
      joins.push(j);
      if (joinStatus !== 200) return new Response('{}', { status: joinStatus });
      pending.set(j.session_hash, j);
      return new Response(JSON.stringify({ event_id: `ev${joins.length}` }));
    }
    if (u.startsWith(`${base}/queue/data?session_hash=`)) {
      const j = pending.get(u.split('=').pop());
      assert.ok(j, 'the stream is read with the session the job was joined with');
      assert.equal(j.trigger_id, 40 + j.fn_index - 3);
      const out = fns[j.fn_index - 3].out(j.data, j);
      const done = out && !Array.isArray(out) ? { msg: 'process_completed', event_id: 'e', output: out, success: false } : { msg: 'process_completed', event_id: 'e', output: { data: out ?? [] }, success: true };
      return stream(sse({ msg: 'estimation', rank, queue_size: rank + 1 }, { msg: 'heartbeat' }, { msg: 'process_starts' }, { msg: 'progress', progress_data: [{ index: 4, length: 10, unit: 'steps' }] }, done, { msg: 'close_stream' }));
    }
    const file = u.match(/\/file=(.*)$/)?.[1];
    if (file?.endsWith('.glb')) return new Response(LIGHT.slice(0), { headers: { 'content-type': 'model/gltf-binary' } });
    if (file?.endsWith('.webp')) return new Response(new Uint8Array([0x52, 0x49, 0x46, 0x46]), { headers: { 'content-type': 'image/webp' } });
    throw new TypeError(`unexpected fetch ${u}`);
  };
  return { f, calls, joins, base };
}
const fd = (base, path) => ({ path, url: `${base}/file=${path}`, size: null, orig_name: path.split('/').pop(), meta: { _type: 'gradio.FileData' } });

/** Stable Fast 3D's two steps, answered with the shapes the live Space gave (October 2026). */
const sf3dSpace = (opts = {}) =>
  fakeGradio(M.SF3D, [
    { api: 'requires_bg_remove', out: () => [{ visible: true, value: 'Run', __type__: 'update' }, null, null, { visible: true, value: fd(M.SF3D, '/tmp/gradio/aa/image.webp'), __type__: 'update' }, { visible: false, __type__: 'update' }, { visible: false, __type__: 'update' }] },
    { api: 'run_button', out: opts.run ?? (() => [{ __type__: 'update' }, null, null, { __type__: 'update' }, { visible: true, value: fd(M.SF3D, '/tmp/gradio/4b/tmp789kc6f7.glb'), __type__: 'update' }, { visible: true, __type__: 'update' }]) },
  ]);

test('Gradio client: Gradio 5 routes under api_prefix, place in the queue and % progress, the ZeroGPU quota and a full queue in words', async () => {
  const g = fakeGradio('https://x.hf.space', [{ api: 'go', out: () => [fd('https://x.hf.space/gradio_api', '/tmp/gradio/z/out.glb')] }, { api: 'quota', out: () => ({ error: "'You have exceeded your ZeroGPU quota (135s requested vs. 85s left). Try again in 10:21:02.'", title: 'ZeroGPU quota exceeded' }) }], { prefix: '/gradio_api', rank: 2 });
  const steps = [];
  const app = new M.GradioApp('https://x.hf.space', { fetch: g.f, progress: (s) => steps.push(s), signal: AbortSignal.timeout(5000) }, 'The Maker');
  await app.open(['go']);
  assert.equal(app.base, 'https://x.hf.space/gradio_api');
  assert.equal(await app.upload(png(), 'image/png', 'p.png'), '/tmp/gradio/up1/picture.png');
  const out = await app.call('go', [1], 'making');
  assert.equal(app.fileUrl(out, '.glb'), 'https://x.hf.space/gradio_api/file=/tmp/gradio/z/out.glb');
  assert.deepEqual(steps, ['making: number 3 in the queue…', 'making…', 'making: 50%']);
  await assert.rejects(app.call('quota', [], 'making'), (e) => e.status === 429 && e.code === 'quota' && /^The Maker \(Hugging Face ZeroGPU\) has used up today's GPU allowance — try again in about 10 h 21 min/.test(e.message));
  await assert.rejects(app.open(['missing']), /no longer offers "missing"/);
  const asleep = fakeGradio('https://y.hf.space', [], { configStatus: 503 });
  await assert.rejects(new M.GradioApp('https://y.hf.space', { fetch: asleep.f, signal: AbortSignal.timeout(5000) }, 'Y').open([]), (e) => e.code === 'busy' && /^Y is not running right now/.test(e.message));
  const turned = fakeGradio('https://z.hf.space', [{ api: 'go', out: () => [] }], { joinStatus: 429 });
  const z = new M.GradioApp('https://z.hf.space', { fetch: turned.f, signal: AbortSignal.timeout(5000) }, 'Z');
  await z.open(['go']);
  await assert.rejects(z.call('go', [], 'x'), (e) => e.status === 429 && e.code === 'busy');
  assert.equal(M.failureText({ msg: 'queue_full' }, false).code, 'busy');
});

test('Stable Fast 3D: picture → background cut out → textured model, both steps in one session, the cut-out shown', async () => {
  const sp = sf3dSpace();
  const steps = [];
  const made = await M.fastModel({ fetch: withWhoami(sp.f), token: 'hf_free_sf', progress: (s) => steps.push(s), signal: AbortSignal.timeout(5000) }, png(), 'image/png');
  assert.equal(made.textured, true);
  assert.equal(made.maker, 'Stable Fast 3D');
  assert.match(made.credit, /Stable Fast 3D \(Stability AI, Community Licence\)/);
  assert.equal(made.glb.byteLength, LIGHT.byteLength);
  assert.match(made.cutout, /^data:image\/webp;base64,/);
  const [cut, run] = sp.joins;
  assert.equal(cut.session_hash, run.session_hash, 'the model step reads the cut-out from the same session');
  assert.deepEqual(cut.data, [{ path: '/tmp/gradio/up1/picture.png', meta: { _type: 'gradio.FileData' } }, 0.85]);
  assert.deepEqual(run.data, ['Run', { path: '/tmp/gradio/up1/picture.png', meta: { _type: 'gradio.FileData' } }, null, 0.85, 'None', -1, 1024]);
  assert.ok(sp.calls.some((c) => c.url.endsWith('tmp789kc6f7.glb')), 'the .glb, not the cut-out picture, is fetched as the model');
  assert.ok(sp.calls.every((c) => c.auth === 'Bearer hf_free_sf'), 'a free account\'s token goes with every call');
  assert.ok(steps.includes('removing the background…') && steps.includes('shaping and painting the model…'), JSON.stringify(steps));
});

test('TRELLIS.2: start a session, cut out, shape, then paint and pack — the cleaned picture is the one shaped', async () => {
  const base = `${M.TRELLIS2}/gradio_api`;
  const sp = fakeGradio(
    M.TRELLIS2,
    [
      { api: 'start_session', out: () => [] },
      { api: 'preprocess_image', out: () => [fd(base, '/tmp/gradio/cc/image.png')] },
      { api: 'image_to_3d', out: () => [null, '<div>preview</div>'] },
      { api: 'extract_glb', out: () => [fd(base, '/tmp/gradio/dd/sample.glb'), fd(base, '/tmp/gradio/dd/sample.glb')] },
    ],
    { prefix: '/gradio_api' },
  );
  const made = await M.trellisModel({ fetch: withWhoami(sp.f), token: 'hf_free_tr', signal: AbortSignal.timeout(5000) }, png(), 'image/png');
  assert.equal(made.maker, 'TRELLIS.2');
  assert.equal(made.textured, true);
  const [start, pre, shape, pack] = sp.joins;
  assert.deepEqual(start.data, []);
  assert.equal(pre.data[0].path, '/tmp/gradio/up1/picture.png');
  assert.equal(shape.data[0].path, '/tmp/gradio/cc/image.png');
  assert.deepEqual(shape.data.slice(1, 3), [0, '1024']);
  assert.deepEqual(pack.data, [null, 100_000, 1024]);
  assert.equal(new Set(sp.joins.map((j) => j.session_hash)).size, 1);
});

test('drawing the object first: Workers AI when the brain has it, else the free FLUX Space, else "no_picture" in words', async () => {
  const jpeg = new Uint8Array(300);
  jpeg.set([0xff, 0xd8, 0xff, 0xe0]);
  const ai = {
    run: async (model, inputs) => {
      assert.match(inputs.prompt, /^a red kettle, a single object, whole and centred/);
      return { image: Buffer.from(jpeg).toString('base64') };
    },
  };
  const a = await M.drawObject({ fetch: async () => { throw new Error('not asked'); }, signal: AbortSignal.timeout(5000), ai }, 'a red kettle');
  assert.equal(a.type, 'image/jpeg');
  assert.match(a.by, /Workers AI/);
  const flux = fakeGradio(M.FLUX_SPACE, [{ api: 'infer', out: (data) => { assert.deepEqual(data.slice(1), [0, true, 768, 768, 4]); return [fd(`${M.FLUX_SPACE}/gradio_api`, '/tmp/gradio/ff/image.webp'), 1234]; } }], { prefix: '/gradio_api' });
  const b = await M.drawObject({ fetch: flux.f, signal: AbortSignal.timeout(5000) }, 'a red kettle');
  assert.equal(b.type, 'image/webp');
  assert.match(b.by, /Hugging Face/);
  await assert.rejects(M.drawObject({ fetch: async () => { throw new TypeError('fetch failed'); }, signal: AbortSignal.timeout(5000) }, 'x'), (e) => e.code === 'no_picture' && /Workers AI is not available here/.test(e.message));
});

/** The lines of an NDJSON answer. */

// ---------------------------------------------------------------- never billed, every try counted

test('never billed: the token goes to a ZeroGPU Space only from a free account that cannot pay; PRO, a card on file, a paid organisation or no answer means it is not sent', async () => {
  const asked = [];
  const f = withWhoami(async () => { throw new TypeError('only whoami here'); }, asked);
  assert.deepEqual(await M.spaceToken('hf_free_a', f), { token: 'hf_free_a', why: '' });
  for (const t of ['hf_pro_a', 'hf_pay_a', 'hf_org_a']) {
    const r = await M.spaceToken(t, f);
    assert.equal(r.token, null, t);
    assert.match(r.why, /can be charged for GPU time .* never sends it to the free GPUs — use a token from a free account with no card/, t);
  }
  for (const t of ['hf_down_a', 'hf_bad_a']) {
    const r = await M.spaceToken(t, f);
    assert.equal(r.token, null, t);
    assert.match(r.why, /could not say whether .* asked without it/, t);
  }
  // an answer without the fields that say it cannot pay is not trusted either
  const odd = async () => new Response(JSON.stringify({ type: 'user', name: 'x' }));
  assert.equal((await M.spaceToken('hf_odd_a', odd)).token, null);
  assert.deepEqual(await M.spaceToken(null, f), { token: null, why: '' });
  // looked up once an hour per token, not once per call
  await M.spaceToken('hf_free_a', f);
  assert.equal(asked.filter((t) => t === 'hf_free_a').length, 1);
});

test('never billed: with a PRO token neither TRELLIS.2 nor Stable Fast 3D ever sees it, and the owner is told why', async () => {
  const sp = sf3dSpace();
  const steps = [];
  const made = await M.makeTextured({ fetch: withWhoami(sp.f), token: 'hf_pro_b', progress: (s) => steps.push(s) }, png());
  assert.equal(made.maker, 'Stable Fast 3D');
  assert.ok(sp.calls.length > 3);
  assert.ok(sp.calls.every((c) => c.auth === null), 'no Authorization header to a ZeroGPU Space');
  assert.ok(!sp.calls.some((c) => c.url.startsWith(M.TRELLIS2)), 'TRELLIS.2 is only for a free token');
  assert.ok(steps.some((s) => /can be charged/.test(s)), JSON.stringify(steps));
  // a FLUX drawing with a card-on-file token: not sent either
  const flux = fakeGradio(M.FLUX_SPACE, [{ api: 'infer', out: () => [fd(`${M.FLUX_SPACE}/gradio_api`, '/tmp/gradio/ff/image.webp'), 1] }], { prefix: '/gradio_api' });
  await M.drawObject({ fetch: withWhoami(flux.f), token: 'hf_pay_b', signal: AbortSignal.timeout(5000) }, 'a kettle');
  assert.ok(flux.calls.every((c) => c.auth === null));
});

test('keeping models: 24 hours under m3d:<id> in KV, listed, served to the owner as a GLB, forgotten on request; every try counts against 10 a day', async () => {
  const kv = fakeKv();
  const info = await M.keepModel(kv, LIGHT.slice(0), '  A   brass telescope ', 20000);
  assert.match(info.id, /^[A-Za-z0-9_-]{16}$/);
  assert.equal(info.title, 'A brass telescope');
  assert.equal(kv.ttl.get(`m3d:${info.id}`), 86_400);
  const day = new Date().toISOString().slice(0, 10);
  assert.equal(kv.m.get(`m3d:count:${day}`), '1');
  assert.deepEqual((await M.listModels(kv)).map((m) => m.id), [info.id]);
  const res = await M.modelResponse(kv, info.id);
  assert.equal(res.headers.get('content-type'), 'model/gltf-binary');
  assert.equal((await M.modelResponse(kv, 'AAAAAAAAAAAAAAAA')).status, 404);
  assert.deepEqual(await M.listModels(kv, Date.now() + 86_401_000), []);
  assert.equal(await M.forgetModel(kv, info.id), true);
  assert.deepEqual(await M.listModels(kv), []);
  // a try is counted before any Space is asked, and a kept model of a counted try is not counted twice
  await M.startAttempt(kv);
  assert.equal(kv.m.get(`m3d:count:${day}`), '2');
  await M.keepModel(kv, LIGHT.slice(0), 'x', undefined, Date.now(), {}, true);
  assert.equal(kv.m.get(`m3d:count:${day}`), '2');
  kv.m.set(`m3d:count:${day}`, String(M.MODELS_PER_DAY));
  await assert.rejects(M.startAttempt(kv), (e) => e.status === 429 && /daily limit/.test(e.message));
  const broken = { ...fakeKv(), get: async () => { throw new Error('KV daily limit'); } };
  await assert.rejects(M.checkAllowance(broken), (e) => e.status === 503);
});

test('every try counts: tries that fail use up the day too, so a busy Space cannot be asked without end', async () => {
  const kv = fakeKv();
  const down = async () => { throw new TypeError('fetch failed'); };
  const deps = { kv, token: async () => null, fetch: down };
  const req = () => new Request('https://g.example/api/m3d', { method: 'POST', body: png() });
  for (let i = 0; i < M.MODELS_PER_DAY; i++) assert.equal((await M.model3dRoute(req(), '/m3d', 'POST', deps)).status, 503, `try ${i + 1}`);
  const over = await M.model3dRoute(req(), '/m3d', 'POST', deps);
  assert.equal(over.status, 429);
  assert.match((await over.json()).error, /daily limit/);
});

test('no Hunyuan3D-2: its licence leaves out the UK, so it is never asked — when the free makers fail the owner hears why', async () => {
  const asked = [];
  const f = async (u) => {
    asked.push(String(u));
    throw new TypeError('fetch failed');
  };
  await assert.rejects(M.makeTextured({ fetch: f }, png()), (e) => e.code === 'busy' && /^the free 3-D generators are busy right now — try again in a minute\. Stable Fast 3D: /.test(e.message) && !/Hunyuan/.test(e.message));
  assert.ok(asked.length && !asked.some((u) => u.includes('hunyuan')), JSON.stringify(asked));
});

// ---------------------------------------------------------------- make_3d

test('make_3d: its own keyword group; a photo → a textured model kept 24 h with the studio opened on it; words → the studio, which searches the catalogue itself', async () => {
  const tool = T.toolByName.get('make_3d');
  assert.ok(tool);
  const group = T.TOOL_GROUPS.find((g) => g.name === '3d');
  assert.deepEqual(group.tools, [tool]);
  for (const w of ['make a 3d model of my mug', 'take it apart', 'open spline', 'turn this into a GLB']) assert.ok(group.when.test(w), w);
  assert.ok(group.about.length <= 220 && /make_3d/.test(group.about) && /catalogue/.test(group.about));
  assert.ok(!/Hunyuan/.test(tool.description));
  const kv = fakeKv();
  const pic = await L.storeImage(kv, png(), 'image/png', { ttl: 86_400, counter: 'img:count:', limit: 30, noun: 'share', verb: 'shared' });
  const sp = sf3dSpace();
  const real = globalThis.fetch;
  globalThis.fetch = withWhoami(sp.f);
  try {
    const ctx = ctxWith({ SITES: kv }, { huggingface: 'hf_free_tool' });
    // TRELLIS.2 (free token) is asleep here, so Stable Fast 3D makes it
    const out = await tool.run({ picture: `https://ghosty.example/i/${pic.id}`, title: 'Mug' }, ctx);
    assert.match(out, /^3-D model made \(with its colours\) and opened in the 3D STUDIO tab, kept 24 hours\. Made by Stable Fast 3D/);
    const ev = ctx._events.find((e) => e.t === 'client');
    assert.equal(ev.name, 'open_studio');
    assert.match(ev.args.model, /^[A-Za-z0-9_-]{16}$/);
    assert.ok(sp.calls.filter((c) => c.url.startsWith(M.SF3D)).every((c) => c.auth === 'Bearer hf_free_tool'), "the owner's free token is used");
    await assert.rejects(tool.run({ picture: 'AAAAAAAAAAAAAAAA' }, ctxWith({ SITES: kv })), /no longer kept/);
    const open = ctxWith({});
    assert.match(await tool.run({ sample: 'chair' }, open), /^Opened the 3D STUDIO on the chair sample\./);
    await assert.rejects(tool.run({ picture: 'http://x.example/a.png' }, ctxWith({ SITES: kv })), /only https/);
  } finally {
    globalThis.fetch = real;
  }
  // words: the studio is opened to make it; the brain reads no catalogue and asks nothing
  let fetched = 0;
  let assets = 0;
  globalThis.fetch = async () => { fetched++; throw new TypeError('offline'); };
  try {
    const ctx = ctxWith({ SITES: fakeKv(), ASSETS: { fetch: async () => { assets++; return new Response('{}'); } } });
    const out = await tool.run({ prompt: 'a comfy couch' }, ctx);
    assert.match(out, /^Opened the 3D STUDIO on "a comfy couch": it opens a real model from its catalogue when one fits/);
    assert.deepEqual(ctx._events, [{ t: 'client', name: 'open_studio', args: { make: 'a comfy couch' } }]);
    assert.equal(fetched + assets, 0, 'no catalogue read, no Space asked in the brain');
    assert.match(out, /up to about 5 when the free queue is long/, 'an honest worst case');
  } finally {
    globalThis.fetch = real;
  }
});

test('make_3d fresh: one object drawn first (kept as a picture), then made 3-D; a busy maker says the picture was drawn; no Workers AI and no FLUX Space says so', async () => {
  const tool = T.toolByName.get('make_3d');
  const kv = fakeKv();
  const calls = [];
  const jpeg = new Uint8Array(300);
  jpeg.set([0xff, 0xd8, 0xff, 0xe0]);
  const ai = { async run(model, inputs) { calls.push({ model, inputs }); return { image: Buffer.from(jpeg).toString('base64') }; } };
  const real = globalThis.fetch;
  globalThis.fetch = sf3dSpace().f;
  try {
    const ctx = ctxWith({ SITES: kv, AI: ai });
    const out = await tool.run({ prompt: 'a vintage brass telescope', fresh: true }, ctx);
    assert.equal(calls[0].model, '@cf/black-forest-labs/flux-1-schnell');
    assert.match(calls[0].inputs.prompt, /^a vintage brass telescope, a single object, whole and centred, .*plain white background/);
    assert.match(out, /drawn first from the picture https:\/\/ghosty\.example\/i\/[A-Za-z0-9_-]{16}/);
    globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
    await assert.rejects(tool.run({ prompt: 'a lamp', fresh: true }, ctxWith({ SITES: kv, AI: ai })), (e) => /busy right now/.test(e.message) && /the picture was drawn: https:\/\/ghosty\.example\/i\//.test(e.message));
    await assert.rejects(tool.run({ prompt: 'a lamp', fresh: true }, ctxWith({ SITES: kv })), /Workers AI is not available here; .*give a picture link instead/);
  } finally {
    globalThis.fetch = real;
  }
});

test('a kept picture link is read for any id, including one that ends or starts with "-" or "_"', async () => {
  const S = await import('./.build/tools/studio.mjs');
  for (const id of ['gI7jRUfpm58Q-Kq-', '-bcdefghijklmnop', 'abcdefghijklmno_', 'AbCdEfGh12345678'])
    for (const ref of [`https://ghosty.example/i/${id}`, `https://ghosty.example/i/${id}.jpg`, `/i/${id}`, ` ${id} `]) assert.equal(S.pictureIdOf(ref), id, ref);
  assert.equal(S.pictureIdOf('https://ghosty.example/i/abcdefghijklmnopq'), null, 'seventeen characters is not an id');
  assert.equal(S.pictureIdOf('https://example.com/cat.jpg'), null);
});

test('search ranks the thing itself first: the top model\'s category is what was asked for, for everyday words', () => {
  const items = M.objaverseItems(INDEX);
  // query → what the top model's category must be (and, for the ones that went wrong before, what it must not be)
  const want = [
    ['phone', /telephone/, /booth/], ['dog', /dog$/, /collar|leash/], ['toilet', /^toilet$/, /paper|tissue|dispenser/], ['desk', /^desk$/, /lamp/], ['toaster', /^toaster$/, /oven/],
    ['kettle', /^kettle$/], ['sofa', /^sofa/], ['couch', /^sofa/], ['tv', /^television set$/], ['telly', /^television set$/], ['fridge', /^refrigerator$/], ['microwave', /^microwave oven$/],
    ['table lamp', /^table lamp$/], ['lamp', /lamp$/], ['bed', /bed$/], ['mug', /^mug$/], ['laptop', /^laptop computer$/], ['car', /^car/], ['bicycle', /^bicycle$/], ['washing machine', /^automatic washer$/],
    ['guitar', /^guitar$/], ['shoe', /^shoe$/], ['backpack', /^backpack$/], ['sunglasses', /^sunglasses$/], ['wardrobe', /^wardrobe$/], ['chest of drawers', /^dresser$/], ['bin', /^trash can$/],
    ['vacuum cleaner', /^vacuum cleaner$/], ['teddy bear', /^teddy bear$/], ['bath', /^bathtub$/], ['apple', /^apple$/], ['pizza', /^pizza$/], ['cushion', /^cushion$/], ['spoon', /spoon$/],
    ['wine glass', /^glass/], ['frying pan', /^frying pan$|^pan/], ['clock', /clock$/], ['vase', /^vase$/], ['backpack', /^backpack$/], ['bookcase', /^bookcase$/], ['umbrella', /^umbrella$/],
  ];
  assert.ok(want.length >= 30);
  for (const [q, good, bad] of want) {
    const top = M.searchCatalog(items, q, { limit: 1 })[0];
    assert.ok(top, `"${q}" found nothing`);
    assert.match(top.item.cat, good, `"${q}" → ${top.item.name} [${top.item.cat}]`);
    if (bad) assert.doesNotMatch(top.item.cat, bad, `"${q}" → ${top.item.name} [${top.item.cat}]`);
    assert.ok(M.goodMatch(top), `"${q}" should open ${top.item.name} [${top.item.cat}]`);
  }
  // a word that only describes ("OFFICE chair", "OAK dining table") must be found before a model opens by itself
  for (const q of ['office chair', 'oak dining table', 'a brass telescope', 'gaming desk']) assert.ok(!M.goodMatch(M.searchCatalog(items, q, { limit: 1 })[0]), `"${q}" opened ${M.searchCatalog(items, q, { limit: 1 })[0]?.item.name}`);
  // a colour does not stop a match: the model can be any colour
  assert.ok(M.goodMatch(M.searchCatalog(items, 'a red kettle', { limit: 1 })[0]));
  assert.equal(M.headOf('a chest of drawers'), 'chest_of_drawers');
  assert.equal(M.headOf('pan (for cooking)'), 'pan');
  assert.equal(M.headOf('phone booth'), 'booth');
  assert.ok(M.sameThing('telly', 'television_set') && !M.sameThing('desk', 'lamp'));
});

test('catalogue: brands and franchises are left out (a fan-made Pokémon is not the modeller\'s to give away)', () => {
  const items = M.objaverseItems({ v: 1, cats: ['toy', 'bag', 'shoe'], items: [ovRow('d1', 'Pikachu plush', 0), ovRow('d2', 'LEGO brick', 0), ovRow('d3', 'Leather bag', 1, 1, 900, 1000, 'gucci fashion'), ovRow('d4', 'Running shoe', 2, 1, 900, 1000, 'adidas'), ovRow('d5', 'Wooden toy', 0)] });
  assert.deepEqual(items.map((i) => i.name), ['Wooden toy']);
  const shipped = M.objaverseItems(INDEX);
  assert.equal(shipped.length, INDEX.items.length, 'the shipped index has none');
  for (const it of shipped) assert.ok(!M.BRANDS.test(`${it.name} ${it.cat} ${it.tags.join(' ')}`), it.name);
});

test("Poly Haven's list: passed through as text, never parsed by the brain; kept in KV a week; the old copy when Poly Haven fails", async () => {
  const kv = fakeKv();
  let calls = 0;
  let up = true;
  const raw = JSON.stringify(CX.assets);
  const f = async (u, init) => {
    calls++;
    assert.equal(String(u), 'https://api.polyhaven.com/assets?t=models');
    assert.match(init.headers['User-Agent'], /^Ghosty/);
    return up ? new Response(raw) : new Response('down', { status: 503 });
  };
  const parse = JSON.parse;
  let parsed = 0;
  JSON.parse = (t, ...r) => {
    if (typeof t === 'string' && t.length >= raw.length) parsed++;
    return parse(t, ...r);
  };
  try {
    const now = Date.now();
    const a = await M.polyHavenList(kv, f, now);
    assert.equal(a.text, raw);
    assert.equal(kv.ttl.get(M.CATALOG_KEY), 30 * 86_400);
    await M.polyHavenList(kv, f, now + 86_400_000);
    assert.equal(calls, 1, 'within the week: from KV');
    up = false;
    const stale = await M.polyHavenList(kv, f, now + 8 * 86_400_000);
    assert.equal(stale.stale, true);
    assert.equal(stale.text, raw);
    kv.m.set('m3d:cat:ph:at', String(Date.now() - 8 * 86_400_000));
    const res = await M.model3dRoute(new Request('https://g.example/api/m3d/catalog'), '/m3d/catalog', 'GET', { kv, token: async () => null, fetch: f });
    assert.equal(await res.text(), raw);
    assert.equal(res.headers.get('x-catalog-stale'), '1');
  } finally {
    JSON.parse = parse;
  }
  assert.equal(parsed, 0, 'the brain never parses the list');
  await assert.rejects(M.polyHavenList(fakeKv(), f), (e) => e.status === 502 && /other catalogue still works/.test(e.message));
  // the phone reads it
  assert.equal(M.polyHavenItems(JSON.parse(raw)).length, 5);
});

test('Poly Haven model files are streamed through unread (only its own file hosts, at most 10 MB each); the phone packs them', async () => {
  const files = CX.files.ArmChair_01;
  const g = files.gltf['1k'].gltf;
  const asked = [];
  const f = async (u) => {
    asked.push(String(u));
    if (String(u) === 'https://api.polyhaven.com/files/ArmChair_01') return new Response(JSON.stringify(files), { headers: { 'content-type': 'application/json' } });
    if (String(u).endsWith('huge.jpg')) return new Response(new ReadableStream({ start(c) { for (let i = 0; i < 11; i++) c.enqueue(new Uint8Array(1_000_000)); c.close(); } }), { headers: { 'content-type': 'image/jpeg' } });
    return new Response(new Uint8Array(64), { headers: { 'content-type': 'image/jpeg' } });
  };
  const list = await M.polyHavenFile('https://api.polyhaven.com/files/ArmChair_01', f);
  assert.equal(list.status, 200);
  assert.deepEqual(await list.json(), files);
  const tex = await M.polyHavenFile(Object.values(g.include)[0].url, f);
  assert.equal((await tex.arrayBuffer()).byteLength, 64);
  for (const bad of ['https://evil.example/x.jpg', 'https://dl.polyhaven.org/file/ph-assets/HDRIs/x.exr', 'https://api.polyhaven.com/assets?t=hdris', 'https://dl.polyhaven.org.evil.example/file/ph-assets/Models/x', 'not a url']) assert.ok([400, 403].includes((await M.polyHavenFile(bad, f)).status), bad);
  await assert.rejects((await M.polyHavenFile('https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/X/huge.jpg', f)).arrayBuffer(), /too big/);
  assert.equal((await M.polyHavenFile('https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/X/a.jpg', async () => new Response('x', { headers: { 'content-length': '20000000' } }))).status, 413);
});

test('Gradio: an unexpected_error is told in its own words', async () => {
  const g = fakeGradio('https://e.hf.space', [{ api: 'go', out: () => [] }]);
  const app = new M.GradioApp('https://e.hf.space', { fetch: async (u, i) => (String(u).includes('/queue/data') ? stream(sse({ msg: 'unexpected_error', message: 'CUDA out of memory' })) : g.f(u, i)), signal: AbortSignal.timeout(5000) }, 'E');
  await app.open(['go']);
  await assert.rejects(app.call('go', [], 'x'), (e) => /CUDA out of memory/.test(e.message));
});

test('makeTextured: TRELLIS.2 first with a free token (and the token on its calls), then Stable Fast 3D; without a token only Stable Fast 3D', async () => {
  const base = `${M.TRELLIS2}/gradio_api`;
  const tr = fakeGradio(M.TRELLIS2, [
    { api: 'start_session', out: () => [] },
    { api: 'preprocess_image', out: () => [fd(base, '/tmp/gradio/cc/image.png')] },
    { api: 'image_to_3d', out: () => [null, '<div/>'] },
    { api: 'extract_glb', out: () => [fd(base, '/tmp/gradio/dd/sample.glb')] },
  ], { prefix: '/gradio_api' });
  const sf = sf3dSpace();
  const route = async (u, i) => (String(u).startsWith(M.TRELLIS2) ? tr.f(u, i) : sf.f(u, i));
  const a = await M.makeTextured({ fetch: withWhoami(route), token: 'hf_free_mt' }, png());
  assert.equal(a.maker, 'TRELLIS.2');
  assert.ok(tr.calls.every((c) => c.auth === 'Bearer hf_free_mt'));
  assert.equal(sf.calls.length, 0);
  const b = await M.makeTextured({ fetch: route }, png());
  assert.equal(b.maker, 'Stable Fast 3D');
  // Stable Fast 3D out of allowance: the owner hears it, in words, with no other maker to try
  const quota = sf3dSpace({ run: () => ({ error: 'You have exceeded your ZeroGPU quota (60s requested vs. 0s left). Try again in 0:00:00.', title: 'ZeroGPU quota exceeded' }) });
  await assert.rejects(M.makeTextured({ fetch: quota.f }, png()), (e) => e.status === 429 && e.code === 'quota' && /Stable Fast 3D \(Hugging Face ZeroGPU\) has used up/.test(e.message));
  await assert.rejects(M.makeTextured({ fetch: quota.f }, new TextEncoder().encode('<svg>').buffer), (e) => e.status === 415);
});

/** The lines of an NDJSON answer. */
const ndjson = async (res) => (await res.text()).trim().split('\n').map((l) => JSON.parse(l));

test('/api/m3d routes: list, a photo as step-by-step lines (and plain JSON), the GLB, forget; "make anything" with Workers AI, and its failures in words', async () => {
  const kv = fakeKv();
  const deps = { kv, token: async () => null, fetch: sf3dSpace().f };
  const req = (path, method = 'GET', body, headers = {}) => new Request(`https://g.example/api${path}`, { method, body, headers });
  assert.deepEqual(await (await M.model3dRoute(req('/m3d'), '/m3d', 'GET', deps)).json(), { models: [] });
  assert.equal((await M.model3dRoute(req('/m3d/thumb?u=https%3A%2F%2Fevil.example%2Fa.png'), '/m3d/thumb', 'GET', deps)).status, 403);
  const photo = await M.model3dRoute(req('/m3d?stream=1', 'POST', png(), { 'x-title': 'Lamp' }), '/m3d', 'POST', deps);
  assert.equal(photo.headers.get('content-type'), 'application/x-ndjson');
  const pl = await ndjson(photo);
  assert.ok(pl.some((l) => l.step === 'removing the background…'));
  const last = pl.at(-1);
  assert.equal(last.model.title, 'Lamp');
  assert.equal(last.model.maker, 'Stable Fast 3D');
  assert.equal(last.model.textured, true);
  assert.match(last.cutout, /^data:image\/webp/);
  const plain = await (await M.model3dRoute(req('/m3d', 'POST', png(), { 'x-title': encodeURIComponent('My mug') }), '/m3d', 'POST', { ...deps, fetch: sf3dSpace().f })).json();
  assert.equal(plain.model.title, 'My mug');
  const got = await M.model3dRoute(req(`/m3d/${plain.model.id}`), `/m3d/${plain.model.id}`, 'GET', deps);
  assert.equal(got.headers.get('content-type'), 'model/gltf-binary');
  assert.deepEqual(await (await M.model3dRoute(req(`/m3d/${plain.model.id}`, 'DELETE'), `/m3d/${plain.model.id}`, 'DELETE', deps)).json(), { removed: true });
  const day = new Date().toISOString().slice(0, 10);
  assert.equal(kv.m.get(`m3d:count:${day}`), '2', 'one count per try, not two');
  const jpeg = new Uint8Array(300);
  jpeg.set([0xff, 0xd8, 0xff, 0xe0]);
  const ai = { run: async () => ({ image: Buffer.from(jpeg).toString('base64') }) };
  const gl = await ndjson(await M.model3dRoute(req('/m3d/generate', 'POST', JSON.stringify({ prompt: 'a brass desk lamp' })), '/m3d/generate', 'POST', { ...deps, fetch: sf3dSpace().f, ai }));
  assert.ok(gl.some((l) => /^data:image\/jpeg;base64,/.test(l.picture ?? '')), 'the drawing is shown');
  assert.equal(gl.at(-1).model.title, 'a brass desk lamp');
  assert.match(gl.at(-1).model.credit, /drawn first by FLUX\.1 schnell \(Workers AI\)/);
  const none = await ndjson(await M.model3dRoute(req('/m3d/generate', 'POST', JSON.stringify({ prompt: 'a lamp' })), '/m3d/generate', 'POST', { ...deps, fetch: async () => { throw new TypeError('fetch failed'); } }));
  assert.equal(none.at(-1).code, 'no_picture');
  const busy = await ndjson(await M.model3dRoute(req('/m3d/generate', 'POST', JSON.stringify({ prompt: 'a lamp' })), '/m3d/generate', 'POST', { ...deps, ai, fetch: async () => { throw new TypeError('fetch failed'); } }));
  assert.equal(busy.at(-1).code, 'busy');
  assert.match(busy.at(-1).error, /^the free 3-D generators are busy right now — try again in a minute/);
  assert.equal((await M.model3dRoute(req('/m3d/generate', 'POST', '{}'), '/m3d/generate', 'POST', deps)).status, 400);
  assert.equal((await M.model3dRoute(req('/m3d'), '/m3d', 'GET', { ...deps, kv: undefined })).status, 503);
  assert.equal((await M.model3dRoute(req('/m3d', 'PUT'), '/m3d', 'PUT', deps)).status, 404);
});
test('stand-ins: the thing named last is built, at its usual size or the size given, in parts, standing on the floor', () => {
  const t = M.standIn('an oak dining table 180 cm');
  assert.equal(t.kind, 'table');
  const top = t.parts.find((p) => p.name === 'Top');
  assert.ok(Math.abs(top.size[0] - 1.8) < 1e-9, 'the size given');
  assert.equal(top.color, 0xb98a55, 'oak');
  assert.equal(t.parts.filter((p) => /^Leg/.test(p.name)).length, 4);
  assert.equal(M.standIn('a table lamp').kind, 'lamp');
  assert.equal(M.standIn('a lamp on a table').kind, 'lamp');
  assert.equal(M.standIn('arm chair').kind, 'armchair');
  assert.equal(M.standIn('chest of drawers').kind, 'cabinet');
  assert.equal(M.standIn('a red kettle').kind, 'kettle');
  assert.equal(M.standIn('a glass vase').kind, 'vase');
  assert.equal(M.standIn('a light blue chair').kind, 'chair');
  const odd = M.standIn('a quantum gizmo 50cm');
  assert.equal(odd.kind, 'box');
  assert.ok(Math.abs(odd.parts[0].size[0] - 0.5) < 1e-9);
  assert.ok(Math.abs(M.sizeIn('6 ft') - 6 * 0.3048) < 1e-9);
  assert.equal(M.sizeIn('800mm wide'), 0.8);
  assert.equal(M.sizeIn('no size'), null);
  for (const what of ['sofa', 'bed', 'wardrobe', 'bookcase', 'desk', 'stool', 'bench', 'mug', 'bottle', 'tv', 'laptop', 'phone', 'door', 'plant', 'bin', 'clock', 'ball', 'teapot', 'bowl', 'plate', 'pan']) {
    const s = M.standIn(what);
    assert.notEqual(s.kind, 'box', what);
    for (const p of s.parts) {
      assert.ok(p.size.every((n) => Number.isFinite(n) && n >= 0 && n < 3), `${what}: ${p.name} ${p.size}`);
      // nothing sinks below the floor
      if (p.shape === 'box' && !p.rot) assert.ok(p.pos[1] - p.size[1] / 2 > -1e-6, `${what}: ${p.name} below the floor`);
    }
  }
});

test("the studio's MAKE IT draws with Workers AI: the brain passes it to the /m3d route (agent.ts)", () => {
  const agent = readFileSync(new URL('../src/agent.ts', import.meta.url), 'utf8');
  const call = agent.split(String.fromCharCode(10)).find((l) => l.includes('model3dRoute(req, path, method'));
  assert.ok(call, 'the /m3d route is wired');
  assert.match(call, /ai: this\.env\.AI/);
});

// Kept last: it uses up this bundle's in-memory neuron ledger.
test("drawing the object first stays inside the shared Workers AI ledger: with no room it goes to the free Space", async () => {
  const jpeg = new Uint8Array(300);
  jpeg.set([0xff, 0xd8, 0xff, 0xe0]);
  let runs = 0;
  const ai = { run: async () => (runs++, { image: Buffer.from(jpeg).toString('base64') }) };
  const flux = fakeGradio(M.FLUX_SPACE, [{ api: 'infer', out: () => [fd(`${M.FLUX_SPACE}/gradio_api`, '/tmp/gradio/ff/image.webp'), 1234] }], { prefix: '/gradio_api' });
  let by = '';
  for (let i = 0; i < 200 && !/Hugging Face/.test(by); i++) by = (await M.drawObject({ fetch: flux.f, signal: AbortSignal.timeout(5000), ai }, 'a kettle')).by;
  assert.match(by, /Hugging Face/, 'once the day is used up, the free Space draws it');
  assert.ok(runs < 100, `Workers AI stopped at the image reserve (${runs} pictures, ~80 neurons each, 2,500 left over)`);
});
