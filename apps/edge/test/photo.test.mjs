// PHOTO TOOLS (apps/edge/src/photo.ts, tools/photo.ts, packages/shared/src/photo.ts): remove the background,
// make it sharper, erase a thing under a mask, each on a free Hugging Face Space stubbed by its REAL answers
// (photo.fixture.json, captured 24 October 2026): the request each Space is sent, the result read back, the
// words for a Space that is asleep, queued or over its free limit (always "try again in a minute", never a paid
// fallback), the token only ever sent to a ZeroGPU Space from a free account, the eraser's mask, the result kept
// at /i/<id> for 10 years, the brain's route and photo_tool, and the words that ask for each job.
// Run by model3d.test.mjs (one import line), so the protected package.json test list is unchanged; it builds what
// it needs itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const here = (p) => new URL(p, import.meta.url).pathname;
const opts = { bundle: true, format: 'esm', platform: 'neutral', external: ['cloudflare:sockets'], logLevel: 'warning' };
await build({ ...opts, entryPoints: [here('../src/photo.ts')], outfile: here('./.build/photo/photo.mjs') });
await build({ ...opts, entryPoints: [here('../src/tools/photo.ts')], outfile: here('./.build/photo/tool.mjs') });
await build({ ...opts, entryPoints: [here('../src/gradio.ts')], outfile: here('./.build/photo/gradio.mjs') });
await build({ ...opts, entryPoints: [here('../src/lens.ts')], outfile: here('./.build/photo/lens.mjs') });
await build({ ...opts, entryPoints: [here('../src/model3d.ts')], outfile: here('./.build/photo/model3d.mjs') });
await build({ ...opts, entryPoints: [here('../src/prompt.ts')], outfile: here('./.build/photo/prompt.mjs') });
await build({ ...opts, entryPoints: [here('../src/tools/index.ts')], outfile: here('./.build/photo/tools.mjs') });
await build({ ...opts, entryPoints: [here('../../../packages/shared/src/protocol.ts')], outfile: here('./.build/photo/protocol.mjs') });
const P = await import('./.build/photo/photo.mjs');
const T = await import('./.build/photo/tool.mjs');
const G = await import('./.build/photo/gradio.mjs');
const L = await import('./.build/photo/lens.mjs');
const M = await import('./.build/photo/model3d.mjs');
const PR = await import('./.build/photo/prompt.mjs');
const TI = await import('./.build/photo/tools.mjs');
const PROTO = await import('./.build/photo/protocol.mjs');

const fx = JSON.parse(readFileSync(new URL('./photo.fixture.json', import.meta.url), 'utf8'));
const bytes = (b64) => {
  const b = Buffer.from(b64, 'base64');
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};
const SCENE = bytes(fx.scene_jpg);
const MASK = bytes(fx.mask_png);
const same = (a, b) => Buffer.from(a).equals(Buffer.from(b));

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
    async put(k, v, o) {
      this.m.set(k, typeof v === 'string' ? v : v.slice(0));
      if (o?.expirationTtl) this.ttl.set(k, o.expirationTtl);
    },
    async delete(k) {
      this.m.delete(k);
    },
  };
}

/** An SSE answer that waits in the queue (the real `estimation` line's shape, rank 2 of 5) and is then turned away. */
const queueFull = (id) =>
  [
    `data: {"msg":"estimation","event_id":"${id}","rank":2,"queue_size":5,"rank_eta":31.2}`,
    '',
    `data: {"msg":"queue_full","event_id":"${id}"}`,
    '',
    '',
  ].join('\n');
/** BiRefNet's own success: its image slider answers [before, after] (the same shape as RMBG-1.4's real slider answer). */
const birefnetDone = () => {
  const real = fx.rmbg.sse.split('\n').find((l) => l.includes('process_completed'));
  const ev = JSON.parse(real.slice(5));
  ev.output.data = [ev.output.data[0].map((f) => ({ ...f, url: f.url.replace(P.RMBG, P.BIREFNET) }))];
  return `data: ${JSON.stringify(ev)}\n\ndata: {"msg":"close_stream","event_id":null}\n\n`;
};

/**
 * Every photo Space, stubbed with its real answers. `mode` per Space: 'ok' (default), 'asleep' (the real
 * "Preparing Space" page), 'limit' (BiRefNet's real ZeroGPU limit answer), 'queue' (waits, then the queue is
 * full). BiRefNet defaults to 'limit', as it really answered. Every request is recorded.
 */
function spaces(mode = {}) {
  const m = { birefnet: 'limit', rmbg: 'ok', esrgan: 'ok', lama: 'ok', ...mode };
  const calls = [];
  const asleep = () => new Response(fx.asleep.html, { status: 206, headers: { 'content-type': fx.asleep.contentType } });
  const gradio = (key, root, prefix, out) => async (u, init) => {
    const path = u.slice(root.length);
    if (m[key] === 'asleep') return asleep();
    if (path === '/config') return Response.json(fx[key].config);
    if (path === `${prefix}/upload`) return Response.json(fx[key].upload);
    if (path === `${prefix}/queue/join`) return Response.json({ event_id: 'e1' });
    if (path.startsWith(`${prefix}/queue/data`)) {
      const sse = m[key] === 'limit' ? fx.birefnet.sse : m[key] === 'queue' ? queueFull('e1') : key === 'birefnet' ? birefnetDone() : fx[key].sse;
      return new Response(sse, { headers: { 'content-type': 'text/event-stream' } });
    }
    if (path.includes('/file=')) return new Response(out(path), { headers: { 'content-type': path.endsWith('.png') ? 'image/png' : 'image/webp' } });
    return new Response('not found', { status: 404 });
  };
  const hosts = {
    [P.BIREFNET]: gradio('birefnet', P.BIREFNET, '/gradio_api', () => bytes(fx.rmbg.png)),
    [P.RMBG]: gradio('rmbg', P.RMBG, '/gradio_api', () => bytes(fx.rmbg.png)),
    [P.ESRGAN]: gradio('esrgan', P.ESRGAN, '', () => bytes(fx.esrgan.webp)),
    [P.LAMA]: async () => (m.lama === 'asleep' ? asleep() : m.lama === 'limit' ? new Response('Too Many Requests', { status: 429 }) : new Response(bytes(fx.lama.png), { headers: { 'content-type': 'image/png' } })),
  };
  const f = async (input, init = {}) => {
    const u = String(input);
    const root = Object.keys(hosts).find((h) => u.startsWith(`${h}/`));
    let body = init.body;
    if (body instanceof FormData) body = '[form]';
    calls.push({ url: u, method: init.method ?? 'GET', auth: new Headers(init.headers).get('authorization'), body });
    if (u.startsWith('https://huggingface.co/api/whoami-v2')) return Response.json(mode.whoami ?? { type: 'user', isPro: false, canPay: false, orgs: [] });
    if (!root) throw new TypeError(`no network in tests (${u})`);
    return hosts[root](u, init);
  };
  return { fetch: f, calls, joins: () => calls.filter((c) => c.url.endsWith('/queue/join')).map((c) => ({ url: c.url, ...JSON.parse(c.body) })) };
}

const run = async (s, job, mask, token = null) => {
  const steps = [];
  try {
    const done = await P.runPhotoJob({ fetch: s.fetch, token, progress: (l) => steps.push(l) }, job, SCENE, mask);
    return { done, steps };
  } catch (e) {
    return { err: e, steps };
  }
};

test('background: BiRefNet over its free limit (its real answer) → BRIA RMBG-1.4 on a free CPU, each asked the way its page asks', async () => {
  const s = spaces();
  const { done, steps, err } = await run(s, 'background');
  assert.equal(err, undefined, String(err?.message));
  const [bi, rm] = s.joins();
  // BiRefNet: its "image" function (fn 2, the button 13), the uploaded photo, 1024x1024, the General weights
  assert.equal(bi.url, `${P.BIREFNET}/gradio_api/queue/join`);
  assert.deepEqual([bi.fn_index, bi.trigger_id], [2, 13]);
  assert.deepEqual(bi.data, [{ path: fx.birefnet.upload[0], meta: { _type: 'gradio.FileData' } }, '1024x1024', 'General']);
  // RMBG-1.4: its "run" function (fn 1, button 6) with the photo alone; the PNG with the background transparent comes back
  assert.equal(rm.url, `${P.RMBG}/gradio_api/queue/join`);
  assert.deepEqual([rm.fn_index, rm.trigger_id], [1, 6]);
  assert.deepEqual(rm.data, [{ path: fx.rmbg.upload[0], meta: { _type: 'gradio.FileData' } }]);
  assert.ok(s.calls.some((c) => c.url.endsWith('/no_bg_image.png')), 'the transparent PNG (not the slider preview) is fetched');
  assert.ok(same(done.bytes, bytes(fx.rmbg.png)));
  assert.equal(done.type, 'image/png');
  assert.equal(done.by, 'BRIA RMBG-1.4');
  assert.match(done.credit, /briaai\/BRIA-RMBG-1\.4 on Hugging Face, BRIA RMBG-1\.4 licence, non-commercial/);
  assert.ok(steps.includes("BiRefNet is over its free limit for now (Hugging Face's free GPU time) — trying BRIA RMBG-1.4 on a free computer instead…"), steps.join(' | '));
  assert.ok(steps.some((l) => l.startsWith('removing the background')), 'the queue says what it is doing');
  // no token: nothing carries one
  assert.ok(s.calls.every((c) => !c.auth));
});

test('background: BiRefNet when it answers — the "after" half of its image slider', async () => {
  const s = spaces({ birefnet: 'ok' });
  const { done, err } = await run(s, 'background');
  assert.equal(err, undefined, String(err?.message));
  assert.equal(done.by, 'BiRefNet');
  assert.match(done.credit, /ZhengPeng7\/BiRefNet_demo on Hugging Face, MIT/);
  assert.equal(s.joins().length, 1, 'RMBG-1.4 is not asked');
  const after = JSON.parse(birefnetDone().split('\n')[0].slice(5)).output.data[0][1].url;
  assert.ok(s.calls.some((c) => c.url === after), 'the second picture of the pair is the result');
  assert.equal(P.sliderAfter([{ value: [{ path: '/a.webp' }, { path: '/b.webp' }] }], { base: 'https://x', root: 'https://x' }), 'https://x/file=/b.webp');
  assert.equal(P.sliderAfter([{ path: '/a.webp' }], { base: 'https://x', root: 'https://x' }), null);
});

test('sharper: Real-ESRGAN ×2, its predict function, the bigger WebP read back', async () => {
  const s = spaces();
  const { done, err } = await run(s, 'sharper');
  assert.equal(err, undefined, String(err?.message));
  const [j] = s.joins();
  assert.equal(j.url, `${P.ESRGAN}/queue/join`, 'Gradio 4: no /gradio_api prefix');
  assert.deepEqual([j.fn_index, j.trigger_id], [0, 13]);
  assert.deepEqual(j.data, [{ path: fx.esrgan.upload[0], meta: { _type: 'gradio.FileData' } }, 2]);
  assert.equal(done.type, 'image/webp');
  assert.deepEqual(P.imageSize(done.bytes), { w: 512, h: 384 }, 'twice the 256 × 192 photo');
  assert.equal(done.by, 'Real-ESRGAN');
  assert.match(done.credit, /Nick088\/Real-ESRGAN_Pytorch on Hugging Face, Apache 2\.0; weights BSD 3-Clause/);
});

test('erase: the photo and the mask go to LaMa as data: addresses, byte for byte; the mask must be a PNG of the photo’s size', async () => {
  const s = spaces();
  const { done, err } = await run(s, 'erase', MASK);
  assert.equal(err, undefined, String(err?.message));
  const call = s.calls.find((c) => c.url === `${P.LAMA}/api/v1/inpaint`);
  assert.equal(call.method, 'POST');
  const body = JSON.parse(call.body);
  assert.deepEqual(Object.keys(body).sort(), ['image', 'mask']);
  assert.equal(body.image, `data:image/jpeg;base64,${fx.scene_jpg}`);
  assert.equal(body.mask, `data:image/png;base64,${fx.mask_png}`);
  assert.equal(call.auth, null, 'a free CPU Space is never sent a token');
  assert.ok(same(done.bytes, bytes(fx.lama.png)));
  assert.equal(done.by, 'LaMa (IOPaint)');
  assert.deepEqual(P.imageSize(SCENE), { w: 256, h: 192 });
  assert.deepEqual(P.imageSize(MASK), { w: 256, h: 192 });
  // the mask's own checks, before anything is sent
  const noMask = await run(spaces(), 'erase', null);
  assert.equal(noMask.err.code, 'bad_input');
  assert.match(noMask.err.message, /draw over what to erase first/);
  const jpegMask = await run(spaces(), 'erase', SCENE);
  assert.match(jpegMask.err.message, /mask as a PNG \(white where to erase, black elsewhere\)/);
  const small = bytes(fx.mask_png);
  new DataView(small).setUint32(16, 128);
  const wrong = await run(spaces(), 'erase', small);
  assert.equal(wrong.err.message, 'the mask (128 × 192) is not the size of the photo (256 × 192)');
});

test('the words: asleep, waiting in the queue, over the free limit — always "try again in a minute", never a paid fallback', async () => {
  // asleep: the real "Preparing Space" page (HTTP 206)
  const sleepy = await run(spaces({ esrgan: 'asleep' }), 'sharper');
  assert.equal(sleepy.err.code, 'asleep');
  assert.equal(sleepy.err.message, 'Real-ESRGAN is asleep (free Spaces sleep when nobody uses them) and is waking up — try again in a minute');
  const sleepyLama = await run(spaces({ lama: 'asleep' }), 'erase', MASK);
  assert.equal(sleepyLama.err.message, 'LaMa (IOPaint) is asleep (free Spaces sleep when nobody uses them) and is waking up — try again in a minute');
  // queue: the place is said while waiting; a full queue is "busy"
  const queued = await run(spaces({ esrgan: 'queue' }), 'sharper');
  assert.ok(queued.steps.includes('making it sharper: number 3 in the queue…'), queued.steps.join(' | '));
  assert.equal(queued.err.code, 'busy');
  assert.equal(queued.err.message, "Real-ESRGAN is busy with other people's pictures — try again in a minute");
  // limit: ZeroGPU's real "runs limit" answer
  const limited = await run(spaces({ esrgan: 'limit' }), 'sharper');
  assert.equal(limited.err.code, 'limit');
  assert.equal(limited.err.status, 429);
  assert.equal(limited.err.message, "Real-ESRGAN is over its free limit for now (Hugging Face's free GPU time) — try again in a minute; if it still says so, later today. Nothing paid is ever used");
  const lamaLimit = await run(spaces({ lama: 'limit' }), 'erase', MASK);
  assert.equal(lamaLimit.err.code, 'limit');
  assert.match(lamaLimit.err.message, /^LaMa \(IOPaint\) is turning visitors away for now \(over its free limit\) — try again in a minute$/);
  // both background removers down: each reason, and still nothing paid
  const both = await run(spaces({ rmbg: 'asleep' }), 'background');
  assert.equal(both.err.code, 'asleep');
  assert.match(both.err.message, /^the free background removers are busy right now — try again in a minute\. BiRefNet is over its free limit .* · BRIA RMBG-1\.4 is asleep/);
  for (const r of [sleepy, queued, limited, both]) assert.ok(!/pay|£|\$|credit card|PRO/i.test(r.err.message.replace('Nothing paid is ever used', '')));
  // a timeout is "busy" too
  const late = P.photoWords(Object.assign(new Error('x'), { name: 'TimeoutError' }), 'BiRefNet');
  assert.equal(late.message, 'BiRefNet took too long (its queue may be long) — try again in a minute');
});

test('the 3D studio’s Gradio client knows a sleeping Space: its "Preparing Space" page (206) is not read as a config', async () => {
  const f = async () => new Response(fx.asleep.html, { status: 206, headers: { 'content-type': fx.asleep.contentType } });
  const app = new G.GradioApp('https://x.hf.space', { fetch: f, signal: AbortSignal.timeout(5000) }, 'Stable Fast 3D');
  await assert.rejects(app.open(['run']), (e) => e instanceof G.Model3dError && e.code === 'busy' && /Stable Fast 3D is not running right now \(206\) — it sleeps when nobody uses it/.test(e.message));
});

test('never billed: the token goes to the ZeroGPU Spaces only from a free account, and never to a CPU Space', async () => {
  const free = spaces({ birefnet: 'limit' });
  await run(free, 'background', null, 'hf_free_token_123');
  const bi = free.calls.filter((c) => c.url.startsWith(P.BIREFNET));
  const rm = free.calls.filter((c) => c.url.startsWith(P.RMBG));
  assert.ok(bi.length && bi.every((c) => c.auth === 'Bearer hf_free_token_123'), 'BiRefNet (ZeroGPU) gets the free token');
  assert.ok(rm.length && rm.every((c) => !c.auth), 'RMBG-1.4 (CPU) never does');
  const pro = spaces({ whoami: { type: 'user', isPro: true, canPay: true, orgs: [] } });
  const r = await run(pro, 'sharper', null, 'hf_pro_token_456');
  assert.equal(r.err, undefined);
  assert.ok(pro.calls.filter((c) => c.url.startsWith(P.ESRGAN)).every((c) => !c.auth), 'an account that can pay: never sent');
  assert.ok(r.steps.some((l) => /can be charged for GPU time/.test(l)), 'and the owner is told why');
});

test('kept at /i/<id> for 10 years, 30 a day, served as the picture it is', async () => {
  const kv = fakeKv();
  const kept = await P.keepPhoto(kv, { bytes: bytes(fx.rmbg.png), type: 'image/png' }, Date.UTC(2026, 9, 24));
  assert.equal(kv.ttl.get(`img:${kept.id}`), 10 * 365 * 86_400);
  assert.equal(kv.m.get('photo:count:2026-10-24'), '1');
  const r = await L.imageResponse(kv, kept.id);
  assert.equal(r.headers.get('content-type'), 'image/png');
  assert.ok(same(await r.arrayBuffer(), bytes(fx.rmbg.png)));
  kv.m.set('photo:count:2026-10-24', '30');
  await assert.rejects(P.keepPhoto(kv, { bytes: bytes(fx.rmbg.png), type: 'image/png' }, Date.UTC(2026, 9, 24)), (e) => e instanceof P.PhotoError && e.code === 'limit' && /30 pictures have been made with the photo tools today/.test(e.message));
  // a result the store cannot keep is said, not cut
  await assert.rejects(P.runPhotoJob({ fetch: spaces().fetch }, 'sharper', new ArrayBuffer(10)), /not a JPEG, PNG or WebP picture/);
});

test('the route: POST /api/m3d/photo — a form in, step lines, the photo kept at /i/<id>', async () => {
  const kv = fakeKv();
  const s = spaces();
  const form = new FormData();
  form.append('job', 'erase');
  form.append('picture', new Blob([SCENE], { type: 'image/jpeg' }), 'photo.jpg');
  form.append('mask', new Blob([MASK], { type: 'image/png' }), 'mask.png');
  const res = await M.model3dRoute(new Request('https://g/api/m3d/photo', { method: 'POST', body: form }), '/m3d/photo', 'POST', { kv, token: async () => null, fetch: s.fetch });
  assert.equal(res.headers.get('content-type'), 'application/x-ndjson');
  const lines = (await res.text()).trim().split('\n').map((l) => JSON.parse(l));
  assert.ok(lines.some((l) => /erasing it on a free computer/.test(l.step ?? '')));
  const last = lines.at(-1);
  assert.match(last.photo.url, /^\/i\/[A-Za-z0-9_-]{16}$/);
  assert.equal(last.photo.by, 'LaMa (IOPaint)');
  assert.ok(same(kv.m.get(`img:${last.photo.id}`), bytes(fx.lama.png)));
  // asleep comes back as a line with its code, for the sheet to say
  const f2 = new FormData();
  f2.append('job', 'sharper');
  f2.append('picture', new Blob([SCENE], { type: 'image/jpeg' }));
  const r2 = await M.model3dRoute(new Request('https://g/api/m3d/photo', { method: 'POST', body: f2 }), '/m3d/photo', 'POST', { kv, token: async () => null, fetch: spaces({ esrgan: 'asleep' }).fetch });
  const l2 = (await r2.text()).trim().split('\n').map((l) => JSON.parse(l)).at(-1);
  assert.deepEqual([l2.code, l2.status], ['asleep', 503]);
  const f3 = new FormData();
  f3.append('job', 'tidy');
  const r3 = await M.model3dRoute(new Request('https://g/api/m3d/photo', { method: 'POST', body: f3 }), '/m3d/photo', 'POST', { kv, token: async () => null });
  assert.equal(r3.status, 400);
});

test('photo_tool: erase without a mask opens the sheet on the picture; a job with a picture runs, keeps the result and shows before and after', async () => {
  const kv = fakeKv();
  const before = await L.storeImage(kv, SCENE, 'image/jpeg', { ttl: 86400, counter: 'img:count:', limit: 30, noun: 'share', verb: 'shared' });
  const events = [];
  const ctx = { env: { SITES: kv }, vault: { get: async () => null }, emit: (e) => events.push(e), progress: () => undefined, origin: 'https://ghosty.example' };
  const tool = T.photoTools[0];
  assert.equal(tool.name, 'photo_tool');
  const opened = await tool.run({ job: 'erase', picture: `https://ghosty.example/i/${before.id}` }, ctx);
  assert.deepEqual(events.pop(), { t: 'client', name: 'open_photo_tools', args: { job: 'erase', picture: `/i/${before.id}` } });
  assert.match(opened, /draws over what to erase with a finger/);
  const saved = globalThis.fetch;
  globalThis.fetch = spaces().fetch;
  try {
    const said = await tool.run({ job: 'background', picture: `/i/${before.id}` }, ctx);
    const ev = events.pop();
    assert.equal(ev.name, 'open_photo_tools');
    assert.equal(ev.args.picture, `/i/${before.id}`);
    assert.match(ev.args.result, /^\/i\/[A-Za-z0-9_-]{16}$/);
    assert.match(said, new RegExp(`^Background removed: https://ghosty\\.example${ev.args.result} — kept 10 years`));
    assert.match(said, /BRIA RMBG-1\.4/);
  } finally {
    globalThis.fetch = saved;
  }
  assert.ok(PROTO.CLIENT_COMMANDS.includes('open_photo_tools'), 'the phone knows the command');
  assert.match(tool.description, /No face editing/);
});

test('the words that ask for each job, and the photo group within the plain prompt’s budget', () => {
  const S = T;
  for (const [text, job] of [
    ['remove the background', 'background'],
    ['can you remove the background from my photo', 'background'],
    ['make it a cut out with a transparent background', 'background'],
    ['make it sharper', 'sharper'],
    ['upscale this', 'sharper'],
    ['erase the bin', 'erase'],
    ['remove the lamp post from this photo', 'erase'],
    ['what is this?', null],
    ['is this edible', null],
  ])
    assert.equal(P.photoJobFor(text), job, text);
  assert.ok(S.PHOTO_WHEN.test('please remove the background') && S.PHOTO_WHEN.test('open photo tools') && !S.PHOTO_WHEN.test('hello'));
  assert.equal(P.photoJobOf('upscale'), 'sharper');
  assert.equal(P.photoJobOf('remove_background'), 'background');
  assert.equal(P.photoJobOf('inpaint'), 'erase');
  // the lines tools/index.ts needs (protected): the photo group added, the plain turn is still within 5,500 characters
  const client = { name: 'boss', now: 'Fri 17 Oct 14:05', tz: 'Europe/London', tab: 'core', location: { name: 'Birmingham', lat: 52.48, lon: -1.9 } };
  const group = { name: 'photo', tools: S.photoTools, when: S.PHOTO_WHEN, about: S.PHOTO_ABOUT };
  const g = TI.selectGroups('hello', new Set(), false);
  const plain = PR.systemPrompt(client, [], true, [], { code: false, groups: { on: g.on, off: [...g.off, group] } });
  assert.ok(plain.length <= 5500, `plain chat turn with the photo group: ${plain.length} characters`);
  assert.match(S.PHOTO_ABOUT, /^You can/);
  assert.ok(S.PHOTO_ABOUT.length <= 220 && S.PHOTO_ABOUT.includes('photo_tool'));
});
