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
  await assert.rejects(M.makeModel({ fetch: fakeSpace({ shape: FX.sseQuota }).f }, png()), (e) => e instanceof M.Model3dError && e.status === 429 && /try again in about 13 h 46 min/.test(e.message) && /free Hugging Face token/.test(e.message));
  await assert.rejects(M.makeModel({ fetch: fakeSpace({ configStatus: 503 }).f }, png()), (e) => e.status === 503 && /not running right now/.test(e.message));
  await assert.rejects(M.makeModel({ fetch: fakeSpace().f }, new TextEncoder().encode('<svg>').buffer), (e) => e.status === 415);
  await assert.rejects(M.makeModel({ fetch: fakeSpace({ config: { dependencies: [] } }).f }, png()), (e) => /no longer offers shape generation/.test(e.message));
  await assert.rejects(M.makeModel({ fetch: async () => { throw new TypeError('fetch failed'); } }, png()), (e) => e.status === 502 && /could not reach the 3-D model maker/.test(e.message));
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
    // no Workers AI: say to give a picture instead
    await assert.rejects(tool.run({ prompt: 'a lamp' }, ctxWith({ SITES: kv })), /needs Workers AI/);
  } finally {
    globalThis.fetch = real;
  }
});
