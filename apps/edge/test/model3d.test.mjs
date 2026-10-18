// Pictures into 3-D models (model3d.ts, tools/studio.ts) with the Hugging Face Space stubbed: the
// whole Gradio queue flow (config → upload → join → stream → lighter copy → download), the quota
// refusal in words, the fallback to the full model, keeping the GLB in KV for 24 hours under m3d:,
// the owner-only route, Ghosty's own daily cap, and make_3d from a kept picture or a description.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const M = await import('./.build/model3d.mjs');
const T = await import('./.build/tools/index.mjs');
const L = await import('./.build/lens.mjs');
const FX = JSON.parse(readFileSync(new URL('./model3d.fixture.json', import.meta.url), 'utf8'));

function fakeKv() {
  return {
    m: new Map(),
    ttl: new Map(),
    async get(k, type) {
      if (!this.m.has(k)) return null;
      const v = this.m.get(k);
      if (type === 'arrayBuffer') return typeof v === 'string' ? new TextEncoder().encode(v).buffer : v.slice(0);
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
const FULL = glb(400);
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

/** The Space, stubbed. `shape` is the stream for shape_generation; `light` for the lighter copy (null: it fails). */
function fakeSpace({ shape = FX.sseShape, light = FX.sseExport, config = FX.config, configStatus = 200 } = {}) {
  const calls = [];
  const joins = [];
  let n = 0;
  const f = async (url, init = {}) => {
    const u = String(url);
    calls.push({ url: u, method: init.method ?? 'GET', auth: init.headers?.Authorization ?? null });
    if (u === `${M.SPACE}/config`) return new Response(JSON.stringify(config), { status: configStatus });
    if (u === `${M.SPACE}/upload`) {
      assert.ok(init.body instanceof FormData, 'the picture goes as a form upload');
      const file = init.body.get('files');
      assert.equal(file.type, 'image/png');
      return new Response(JSON.stringify(FX.upload));
    }
    if (u === `${M.SPACE}/queue/join`) {
      joins.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ event_id: `e${joins.length}` }));
    }
    if (u.startsWith(`${M.SPACE}/queue/data?session_hash=`)) {
      n++;
      const body = n === 1 ? shape : light;
      return body === null ? new Response('gone', { status: 500 }) : stream(body);
    }
    if (u.includes('/file=/tmp/gradio/f0c88515')) return new Response(FULL.slice(0));
    if (u.includes('/file=/tmp/gradio/6f55e746')) return new Response(LIGHT.slice(0));
    throw new TypeError(`unexpected fetch ${u}`);
  };
  return { f, calls, joins };
}

test('make a model: config → upload → shape_generation → lighter copy → download, with progress and the token on every call', async () => {
  const sp = fakeSpace();
  const progress = [];
  const r = await M.makeModel({ fetch: sp.f, token: 'hf_secret_token', progress: (l) => progress.push(l) }, png());
  assert.equal(r.glb.byteLength, LIGHT.byteLength, 'the lighter copy is the one kept');
  assert.equal(r.faces, M.TARGET_FACES);
  assert.deepEqual(sp.calls.map((c) => c.url.replace(M.SPACE, '').replace(/session_hash=\w+/, 'session_hash=*').replace(/\/tmp\/gradio\/(\w{6})\w+/, '/tmp/gradio/$1…')), [
    '/config',
    '/upload',
    '/queue/join',
    '/queue/data?session_hash=*',
    '/queue/join',
    '/queue/data?session_hash=*',
    '/file=/tmp/gradio/6f55e7…/white_mesh.glb',
  ]);
  assert.ok(sp.calls.every((c) => c.auth === 'Bearer hf_secret_token'), 'the token goes with every call');
  // shape_generation by its own index and trigger; the uploaded picture; the Space's defaults
  const [shape, light] = sp.joins;
  assert.equal(shape.fn_index, 5);
  assert.equal(shape.trigger_id, 18);
  assert.match(shape.session_hash, /^[a-z0-9]{6,}$/);
  assert.deepEqual(shape.data[1], { path: FX.upload[0], meta: { _type: 'gradio.FileData' } });
  assert.deepEqual(shape.data.slice(6), [30, 5, 1234, 256, true, 8000, true]);
  // the lighter copy: from the made model's own path, a GLB, faces reduced
  assert.equal(light.fn_index, 14);
  assert.match(light.data[0].path, /^\/tmp\/gradio\/f0c88515.*\/white_mesh\.glb$/);
  assert.deepEqual(light.data.slice(1), [null, 'glb', true, false, M.TARGET_FACES]);
  assert.ok(progress.includes('sending the picture…') && progress.includes('fetching the model…'));
  assert.ok(progress.some((p) => /shaping the model/.test(p)) && progress.some((p) => /lightening it/.test(p)));
  assert.ok(!progress.join(' ').includes('hf_secret'), 'the token never shows');
  // without a token: no Authorization header at all
  const anon = fakeSpace();
  await M.makeModel({ fetch: anon.f }, png());
  assert.ok(anon.calls.every((c) => c.auth === null));
});

test('make a model: the lighter copy failing falls back to the full model', async () => {
  const sp = fakeSpace({ light: null });
  const r = await M.makeModel({ fetch: sp.f }, png());
  assert.equal(r.glb.byteLength, FULL.byteLength);
  assert.equal(r.faces, 762352, 'the face count the Space reported');
  const failed = fakeSpace({ light: 'data: {"msg":"process_completed","output":{"error":null},"success":false}\n\n' });
  assert.equal((await M.makeModel({ fetch: failed.f }, png())).glb.byteLength, FULL.byteLength);
});

test('make a model: refusals in words — the quota (when to try again), a sleeping Space, not a picture, a changed Space', async () => {
  await assert.rejects(M.makeModel({ fetch: fakeSpace({ shape: FX.sseQuota }).f }, png()), (e) => e instanceof M.Model3dError && e.status === 429 && /try again in about 7 h 11 min/.test(e.message) && /free Hugging Face token/.test(e.message));
  await assert.rejects(M.makeModel({ fetch: fakeSpace({ configStatus: 503 }).f }, png()), (e) => e.status === 503 && /not running right now/.test(e.message));
  await assert.rejects(M.makeModel({ fetch: fakeSpace().f }, new TextEncoder().encode('<svg>').buffer), (e) => e.status === 415);
  await assert.rejects(M.makeModel({ fetch: fakeSpace({ config: { dependencies: [] } }).f }, png()), (e) => /no longer offers shape generation/.test(e.message));
  await assert.rejects(M.makeModel({ fetch: async () => { throw new TypeError('fetch failed'); } }, png()), (e) => e.status === 502 && /could not reach the 3-D model maker/.test(e.message));
  // the Space's own notes show as progress
  const logs = [];
  await M.makeModel({ fetch: fakeSpace({ shape: FX.sseQueueLog }).f, progress: (l) => logs.push(l) }, png());
  assert.ok(logs.includes('shaping the model: Waiting for a GPU to become available'), JSON.stringify(logs));
  // a stream that ends before the model is ready
  const cut = fakeSpace({ shape: 'data: {"msg":"estimation","rank":3}\n\n' });
  const progress = [];
  await assert.rejects(M.makeModel({ fetch: cut.f, progress: (l) => progress.push(l) }, png()), (e) => /stopped answering/.test(e.message));
  assert.ok(progress.includes('shaping the model: number 4 in the queue…'), JSON.stringify(progress));
  // not a GLB at the end
  const junk = fakeSpace();
  const f = async (u, i) => (String(u).includes('/file=') ? new Response('<html>') : junk.f(u, i));
  await assert.rejects(M.makeModel({ fetch: f }, png()), (e) => /not a GLB/.test(e.message));
});

test('keeping models: 24 hours under m3d:<id> in KV, listed, served to the owner as a GLB, forgotten on request; 10 a day', async () => {
  const kv = fakeKv();
  const info = await M.keepModel(kv, LIGHT.slice(0), '  A   brass telescope ', 20000);
  assert.match(info.id, /^[A-Za-z0-9_-]{16}$/);
  assert.equal(info.title, 'A brass telescope');
  assert.equal(kv.ttl.get(`m3d:${info.id}`), 86_400);
  assert.equal(kv.ttl.get('m3d:list'), 86_400);
  const day = new Date().toISOString().slice(0, 10);
  assert.equal(kv.m.get(`m3d:count:${day}`), '1');
  assert.deepEqual((await M.listModels(kv)).map((m) => m.id), [info.id]);
  const res = await M.modelResponse(kv, info.id);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'model/gltf-binary');
  assert.equal((await res.arrayBuffer()).byteLength, LIGHT.byteLength);
  assert.equal((await M.modelResponse(kv, 'AAAAAAAAAAAAAAAA')).status, 404);
  assert.equal((await M.modelResponse(kv, '../etc')).status, 404);
  // a listed model past its day is not listed
  assert.deepEqual(await M.listModels(kv, Date.now() + 86_401_000), []);
  assert.equal(await M.forgetModel(kv, info.id), true);
  assert.equal(kv.m.has(`m3d:${info.id}`), false);
  assert.deepEqual(await M.listModels(kv), []);
  // Ghosty's own cap
  kv.m.set(`m3d:count:${day}`, String(M.MODELS_PER_DAY));
  await assert.rejects(M.keepModel(kv, LIGHT.slice(0), 'x'), (e) => e.status === 429 && /daily limit/.test(e.message));
  // a count that cannot be read is refused rather than taken as zero
  const broken = { ...fakeKv(), get: async () => { throw new Error('KV daily limit'); } };
  await assert.rejects(M.checkAllowance(broken), (e) => e.status === 503);
});

test('the /api/m3d route: list, make from posted photo bytes, fetch the GLB, forget', async () => {
  const kv = fakeKv();
  const sp = fakeSpace();
  const deps = { kv, token: async () => null, fetch: sp.f };
  const req = (method, body, headers = {}) => new Request('https://g.example/api/m3d', { method, body, headers });
  assert.deepEqual(await (await M.model3dRoute(req('GET'), '/m3d', 'GET', deps)).json(), { models: [] });
  const made = await M.model3dRoute(req('POST', png(), { 'content-type': 'image/png', 'x-title': encodeURIComponent('My mug') }), '/m3d', 'POST', deps);
  assert.equal(made.status, 200);
  const { model } = await made.json();
  assert.equal(model.title, 'My mug');
  const got = await M.model3dRoute(req('GET'), `/m3d/${model.id}`, 'GET', deps);
  assert.equal(got.headers.get('content-type'), 'model/gltf-binary');
  assert.equal((await M.model3dRoute(req('GET'), `/m3d/${model.id}.glb`, 'GET', deps)).status, 200);
  assert.deepEqual(await (await M.model3dRoute(req('DELETE'), `/m3d/${model.id}`, 'DELETE', deps)).json(), { removed: true });
  // the quota comes back as 429 with the words
  const q = await M.model3dRoute(req('POST', png()), '/m3d', 'POST', { ...deps, fetch: fakeSpace({ shape: FX.sseQuota }).f });
  assert.equal(q.status, 429);
  assert.match((await q.json()).error, /GPU allowance/);
  assert.equal((await M.model3dRoute(req('GET'), '/m3d', 'GET', { ...deps, kv: undefined })).status, 503);
  assert.equal((await M.model3dRoute(req('PUT'), '/m3d', 'PUT', deps)).status, 404);
});

const ctxWith = (env, vault = {}) => {
  const progress = [];
  const events = [];
  return { env, origin: 'https://ghosty.example', progress: (l) => progress.push(l), emit: (e) => events.push(e), storage: {}, vault: { get: async (k) => vault[k] ?? null }, kernelUnlocked: async () => false, github: async () => null, _progress: progress, _events: events };
};

test('make_3d: its own keyword group; from a kept picture → a model kept 24 h, the studio opened on it', async () => {
  const tool = T.toolByName.get('make_3d');
  assert.ok(tool);
  const group = T.TOOL_GROUPS.find((g) => g.name === '3d');
  assert.deepEqual(group.tools, [tool], 'one tool: the plain prompt names every group\'s tools');
  for (const w of ['make a 3d model of my mug', 'take it apart', 'show me an exploded view', 'open spline', 'turn this into a GLB', 'three-d please']) assert.ok(group.when.test(w), w);
  assert.ok(!group.when.test('what is the weather'));
  assert.ok(group.about.length <= 220 && /make_3d/.test(group.about));
  assert.ok(!T.selectTools('hello there', new Set(), false).some((t) => t.name === 'make_3d'), 'not described on every turn');
  const kv = fakeKv();
  const pic = await L.storeImage(kv, png(), 'image/png', { ttl: 86_400, counter: 'img:count:', limit: 30, noun: 'share', verb: 'shared' });
  const sp = fakeSpace();
  const real = globalThis.fetch;
  globalThis.fetch = sp.f;
  try {
    const ctx = ctxWith({ SITES: kv }, { huggingface: 'hf_owner' });
    const out = await tool.run({ picture: `https://ghosty.example/i/${pic.id}`, title: 'Mug' }, ctx);
    assert.match(out, /^3-D model made \(20,000 faces, untextured clay\) and opened in the 3D STUDIO tab, kept 24 hours\./);
    const ev = ctx._events.find((e) => e.t === 'client');
    assert.equal(ev.name, 'open_studio');
    assert.match(ev.args.model, /^[A-Za-z0-9_-]{16}$/);
    assert.equal(kv.ttl.get(`m3d:${ev.args.model}`), 86_400);
    assert.ok(sp.calls.every((c) => c.auth === 'Bearer hf_owner'), 'the owner\'s Hugging Face token is used');
    // a picture that is gone, or no picture and no prompt
    await assert.rejects(tool.run({ picture: 'AAAAAAAAAAAAAAAA' }, ctxWith({ SITES: kv })), /no longer kept/);
    // nothing to make: the studio opens on what was asked for
    const open = ctxWith({}); // no KV needed just to open the studio
    assert.match(await tool.run({ sample: 'chair' }, open), /^Opened the 3D STUDIO on the chair sample\./);
    assert.deepEqual(open._events, [{ t: 'client', name: 'open_studio', args: { sample: 'chair' } }]);
    const room = ctxWith({ SITES: kv });
    await tool.run({ room: { w: 400, d: 300 } }, room);
    assert.deepEqual(room._events[0].args, { room: { w: 400, d: 300 } });
    await assert.rejects(tool.run({ picture: 'http://x.example/a.png' }, ctxWith({ SITES: kv })), /only https/);
  } finally {
    globalThis.fetch = real;
  }
});

test('make_3d: from a description — one object is drawn first (kept as a picture), then modelled; the quota error says the picture was drawn', async () => {
  const tool = T.toolByName.get('make_3d');
  const kv = fakeKv();
  const calls = [];
  const jpeg = new Uint8Array(300);
  jpeg.set([0xff, 0xd8, 0xff, 0xe0]);
  const ai = { async run(model, inputs) { calls.push({ model, inputs }); return { image: Buffer.from(jpeg).toString('base64') }; } };
  const real = globalThis.fetch;
  // the Space checks the picture is a PNG in fakeSpace; a drawn picture is a JPEG, so accept either here
  const sp = fakeSpace();
  globalThis.fetch = async (u, i) => (String(u).endsWith('/upload') ? new Response(JSON.stringify(FX.upload)) : sp.f(u, i));
  try {
    const ctx = ctxWith({ SITES: kv, AI: ai });
    const out = await tool.run({ prompt: 'a vintage brass telescope' }, ctx);
    assert.equal(calls[0].model, '@cf/black-forest-labs/flux-1-schnell');
    assert.match(calls[0].inputs.prompt, /^a vintage brass telescope, a single object, whole and centred, .*plain white background/);
    assert.match(out, /drawn first from the picture https:\/\/ghosty\.example\/i\/[A-Za-z0-9_-]{16}/);
    assert.ok(ctx._progress.includes('drawing the object first…'));
    const q = fakeSpace({ shape: FX.sseQuota });
    globalThis.fetch = async (u, i) => (String(u).endsWith('/upload') ? new Response(JSON.stringify(FX.upload)) : q.f(u, i));
    await assert.rejects(tool.run({ prompt: 'a lamp' }, ctxWith({ SITES: kv, AI: ai })), (e) => /GPU allowance/.test(e.message) && /the picture was drawn: https:\/\/ghosty\.example\/i\//.test(e.message));
    // no Workers AI and the free FLUX Space unreachable: say so, and to give a picture instead
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

// ---------------------------------------------------------------- B1: the catalogue, textured makers, "make anything"
// The catalogue of real models (packages/shared/src/models3d.ts, catalog3d.ts), the Gradio client against the
// real protocol (gradio.ts: Gradio 4 at the root, Gradio 5/6 under /gradio_api; one session for steps that share
// state), Stable Fast 3D and TRELLIS.2 (gen3d.ts), the makers in turn (makeTextured) and the new routes.
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
  assert.equal(M.bestMatch(items, 'quantum flux capacitor'), null);
  assert.ok(M.bestMatch(items, 'a sofa'));
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
  for (const q of ['kettle', 'sofa', 'mug', 'office chair', 'table lamp', 'toaster', 'bicycle', 'teddy bear', 'guitar', 'hammer', 'fridge', 'bookcase', 'trainers', 'bed'])
    assert.ok(M.goodMatch(M.searchCatalog(items, q)[0]), `"${q}" → ${M.searchCatalog(items, q)[0]?.item.name ?? 'nothing'}`);
});

test('Poly Haven list: kept in KV for a week, asked again after, the old copy when Poly Haven fails, words when there is none', async () => {
  const kv = fakeKv();
  let calls = 0;
  let up = true;
  const f = async (u, init) => {
    calls++;
    assert.equal(String(u), 'https://api.polyhaven.com/assets?t=models');
    assert.match(init.headers['User-Agent'], /^Ghosty/);
    return up ? new Response(JSON.stringify(CX.assets)) : new Response('down', { status: 503 });
  };
  const now = Date.now();
  const a = await M.polyHavenCatalog(kv, f, now);
  assert.equal(a.items.length, 5);
  assert.equal(kv.ttl.get(M.CATALOG_KEY), 30 * 86_400);
  await M.polyHavenCatalog(kv, f, now + 86_400_000);
  assert.equal(calls, 1, 'within the week: from KV');
  up = false;
  const stale = await M.polyHavenCatalog(kv, f, now + 8 * 86_400_000);
  assert.equal(calls, 2);
  assert.equal(stale.stale, true);
  assert.equal(stale.items.length, 5);
  await assert.rejects(M.polyHavenCatalog(fakeKv(), f), (e) => e.status === 502 && /other catalogue still works/.test(e.message));
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

test('a Poly Haven model as one GLB: its files list → the 1k glTF and its files, nothing from any other host, too-heavy refused', async () => {
  const files = CX.files.ArmChair_01;
  const g = files.gltf['1k'].gltf;
  const gltf = { asset: { version: '2.0' }, buffers: [{ uri: 'ArmChair_01.bin', byteLength: 8 }], bufferViews: [{ buffer: 0, byteLength: 8 }], images: Object.keys(g.include).filter((k) => k.endsWith('.jpg')).map((uri) => ({ uri })) };
  const asked = [];
  const f = async (u) => {
    asked.push(String(u));
    if (String(u) === 'https://api.polyhaven.com/files/ArmChair_01') return new Response(JSON.stringify(files));
    if (String(u) === g.url) return new Response(JSON.stringify(gltf));
    if (Object.values(g.include).some((v) => v.url === String(u))) return new Response(new Uint8Array(8));
    return new Response('nope', { status: 404 });
  };
  const glb = await M.polyHavenGlb('ArmChair_01', f);
  const { json } = readGlb(glb);
  assert.equal(json.images.length, 3);
  assert.ok(json.images.every((i) => i.bufferView !== undefined && !i.uri));
  assert.equal(asked.length, 2 + Object.keys(g.include).length);
  assert.ok(asked.every((u) => u.startsWith('https://api.polyhaven.com/') || u.startsWith('https://dl.polyhaven.org/')));
  // a file list that points anywhere else is not followed
  const evil = structuredClone(files);
  evil.gltf['1k'].gltf.url = 'https://evil.example/x.gltf';
  await assert.rejects(M.polyHavenGlb('ArmChair_01', async (u) => (String(u).includes('/files/') ? new Response(JSON.stringify(evil)) : f(u))), (e) => e.status === 404);
  const heavy = structuredClone(files);
  for (const v of Object.values(heavy.gltf['1k'].gltf.include)) v.size = 30_000_000;
  await assert.rejects(M.polyHavenGlb('ArmChair_01', async (u) => (String(u).includes('/files/') ? new Response(JSON.stringify(heavy)) : f(u))), (e) => e.status === 413 && /too heavy for a phone/.test(e.message));
  await assert.rejects(M.polyHavenGlb('../etc', f), (e) => e.status === 404);
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
  assert.equal((await M.thumbResponse('https://cdn.polyhaven.com/asset_img/big.jpeg', f)).status, 413);
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
  const made = await M.fastModel({ fetch: sp.f, token: 'hf_tok', progress: (s) => steps.push(s), signal: AbortSignal.timeout(5000) }, png(), 'image/png');
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
  assert.ok(sp.calls.every((c) => c.auth === 'Bearer hf_tok'));
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
  const made = await M.trellisModel({ fetch: sp.f, token: 'hf_tok', signal: AbortSignal.timeout(5000) }, png(), 'image/png');
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

test('makeTextured: the makers in turn — TRELLIS.2 only with a token, then Stable Fast 3D, then Hunyuan3D-2 (clay); every reason when all fail', async () => {
  const route = (...spaces) => async (u, i) => {
    for (const s of spaces) if (String(u).startsWith(s.root)) return s.f(u, i);
    throw new TypeError(`unexpected fetch ${u}`);
  };
  const hy = fakeSpace();
  const a = await M.makeTextured({ fetch: route({ root: M.SF3D, f: sf3dSpace().f }, { root: M.SPACE, f: hy.f }) }, png());
  assert.equal(a.maker, 'Stable Fast 3D');
  assert.equal(hy.calls.length, 0, 'Hunyuan3D-2 not asked');
  // Stable Fast 3D out of allowance: Hunyuan3D-2's clay, and the step says why
  const quota = () => sf3dSpace({ run: () => ({ error: 'You have exceeded your ZeroGPU quota (60s requested vs. 0s left). Try again in 0:00:00.', title: 'ZeroGPU quota exceeded' }) });
  const steps = [];
  const b = await M.makeTextured({ fetch: route({ root: M.SF3D, f: quota().f }, { root: M.SPACE, f: fakeSpace().f }), progress: (s) => steps.push(s) }, png());
  assert.equal(b.maker, 'Hunyuan3D-2');
  assert.equal(b.textured, false);
  assert.ok(steps.some((s) => /^Stable Fast 3D could not make it \(Stable Fast 3D \(Hugging Face ZeroGPU\) has used up/.test(s) && /trying Hunyuan3D-2…$/.test(s)), JSON.stringify(steps));
  // with a token TRELLIS.2 is asked first (here it is asleep, so Stable Fast 3D makes it)
  const tr = fakeGradio(M.TRELLIS2, [], { configStatus: 503, prefix: '/gradio_api' });
  const c = await M.makeTextured({ fetch: route({ root: M.TRELLIS2, f: tr.f }, { root: M.SF3D, f: sf3dSpace().f }), token: 'hf' }, png());
  assert.equal(c.maker, 'Stable Fast 3D');
  assert.equal(tr.calls[0].url, `${M.TRELLIS2}/config`);
  // all of them failing: busy words first, then each one's reason
  const down = async () => {
    throw new TypeError('fetch failed');
  };
  await assert.rejects(M.makeTextured({ fetch: down }, png()), (e) => e.status === 503 && e.code === 'busy' && /^the free 3-D generators are busy right now — try again in a minute\. Stable Fast 3D: .* · Hunyuan3D-2: /.test(e.message));
  await assert.rejects(M.makeTextured({ fetch: route({ root: M.SF3D, f: quota().f }, { root: M.SPACE, f: fakeSpace({ shape: FX.sseQuota }).f }) }, png()), (e) => e.status === 429 && e.code === 'quota');
  await assert.rejects(M.makeTextured({ fetch: down }, new TextEncoder().encode('<svg>').buffer), (e) => e.status === 415);
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
const ndjson = async (res) => (await res.text()).trim().split('\n').map((l) => JSON.parse(l));

test('/api/m3d routes: the catalogue, a Poly Haven GLB, thumbnails, a photo as step-by-step lines, and "make anything" with its failure in words', async () => {
  const kv = fakeKv();
  const ph = async (u) => (String(u).startsWith('https://api.polyhaven.com/assets') ? new Response(JSON.stringify(CX.assets)) : new Response('x', { status: 404 }));
  const deps = { kv, token: async () => null, fetch: ph };
  const req = (path, method = 'GET', body, headers = {}) => new Request(`https://g.example/api${path}`, { method, body, headers });
  const cat = await (await M.model3dRoute(req('/m3d/catalog'), '/m3d/catalog', 'GET', deps)).json();
  assert.equal(cat.items.length, 5);
  assert.equal((await M.model3dRoute(req('/m3d/thumb?u=https%3A%2F%2Fevil.example%2Fa.png'), '/m3d/thumb', 'GET', deps)).status, 403);
  assert.equal((await M.model3dRoute(req('/m3d/ph/Nope'), '/m3d/ph/Nope', 'GET', deps)).status, 404);
  // a photo, as lines: steps, then the model with its maker and credit, and the cut-out
  const photo = await M.model3dRoute(req('/m3d?stream=1', 'POST', png(), { 'x-title': 'Lamp' }), '/m3d', 'POST', { ...deps, fetch: sf3dSpace().f });
  assert.equal(photo.headers.get('content-type'), 'application/x-ndjson');
  const pl = await ndjson(photo);
  assert.ok(pl.some((l) => l.step === 'removing the background…'));
  const last = pl.at(-1);
  assert.equal(last.model.title, 'Lamp');
  assert.equal(last.model.maker, 'Stable Fast 3D');
  assert.equal(last.model.textured, true);
  assert.match(last.model.credit, /Stable Fast 3D/);
  assert.match(last.cutout, /^data:image\/webp/);
  assert.deepEqual((await M.listModels(kv)).map((m) => m.id), [last.model.id]);
  // "make anything": drawn by Workers AI (passed by the brain), then made
  const jpeg = new Uint8Array(300);
  jpeg.set([0xff, 0xd8, 0xff, 0xe0]);
  const ai = { run: async () => ({ image: Buffer.from(jpeg).toString('base64') }) };
  const gl = await ndjson(await M.model3dRoute(req('/m3d/generate', 'POST', JSON.stringify({ prompt: 'a brass desk lamp' })), '/m3d/generate', 'POST', { ...deps, fetch: sf3dSpace().f, ai }));
  assert.ok(gl.some((l) => /^data:image\/jpeg;base64,/.test(l.picture ?? '')), 'the drawing is shown');
  assert.equal(gl.at(-1).model.title, 'a brass desk lamp');
  assert.match(gl.at(-1).model.credit, /drawn first by FLUX\.1 schnell \(Workers AI\)/);
  // nothing can draw it here: a line that says so, with the code the studio acts on
  const none = await ndjson(await M.model3dRoute(req('/m3d/generate', 'POST', JSON.stringify({ prompt: 'a lamp' })), '/m3d/generate', 'POST', { ...deps, fetch: async () => { throw new TypeError('fetch failed'); } }));
  assert.equal(none.at(-1).code, 'no_picture');
  assert.match(none.at(-1).error, /nothing could draw the object first/);
  // the generators busy: the words the owner sees
  const busy = await ndjson(await M.model3dRoute(req('/m3d/generate', 'POST', JSON.stringify({ prompt: 'a lamp' })), '/m3d/generate', 'POST', { ...deps, ai, fetch: async () => { throw new TypeError('fetch failed'); } }));
  assert.equal(busy.at(-1).code, 'busy');
  assert.match(busy.at(-1).error, /^the free 3-D generators are busy right now — try again in a minute/);
  assert.equal((await M.model3dRoute(req('/m3d/generate', 'POST', '{}'), '/m3d/generate', 'POST', deps)).status, 400);
});

test('make_3d: a described everyday thing opens the real catalogue model with its credit; fresh: true makes a new one', async () => {
  const tool = T.toolByName.get('make_3d');
  const kv = fakeKv();
  const index = ovIndex([ovRow('c1', 'Velvet sofa', 1, 0, 900, 20000, 'sofa couch')]);
  const assets = { fetch: async (r) => (new URL(r.url).pathname === '/data/models3d.json' ? new Response(JSON.stringify(index)) : new Response('', { status: 404 })) };
  const real = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new TypeError('offline');
  };
  try {
    const ctx = ctxWith({ SITES: kv, ASSETS: assets });
    const out = await tool.run({ prompt: 'a comfy couch' }, ctx);
    assert.match(out, /^Opened a real model from the catalogue in the 3D STUDIO: “Velvet sofa” by Some Author · CC0/);
    assert.deepEqual(ctx._events, [{ t: 'client', name: 'open_studio', args: { catalog: `ov:c1${'0'.repeat(30)}`, title: 'Velvet sofa' } }]);
    // a new one asked for: on to drawing (which fails offline here, in words)
    await assert.rejects(tool.run({ prompt: 'a comfy couch', fresh: true }, ctxWith({ SITES: kv, ASSETS: assets })), /nothing could draw the object first/);
  } finally {
    globalThis.fetch = real;
  }
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
