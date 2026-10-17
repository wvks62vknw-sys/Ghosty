// Pictures Ghosty makes (tools/pictures.ts): flux-1-schnell through a fake Workers AI, kept in
// a fake KV under img:<id> for a week and served at /i/<id>, counted under pic:count:<day>
// with a 40-a-day limit, honest errors without Workers AI, and the whole thing through the
// agent loop with the scripted model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

const T = await import('./.build/tools/index.mjs');
const P = await import('./.build/tools/pictures.mjs');
const L = await import('./.build/lens.mjs');
const mod = await import('./.build/brain.mjs');

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
const jpeg = (n = 256) => {
  const b = new Uint8Array(n);
  b.set([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  for (let i = 10; i < n; i++) b[i] = (i * 13) & 0xff;
  return b;
};
const fakeAi = (image = Buffer.from(jpeg()).toString('base64')) => {
  const calls = [];
  return { calls, async run(model, inputs) { calls.push({ model, inputs }); if (image instanceof Error) throw image; return image === null ? {} : { image }; } };
};
const ctxWith = (env, origin = 'https://ghosty.example') => {
  const progress = [];
  return { env, origin, progress: (l) => progress.push(l), emit: () => undefined, storage: {}, vault: { get: async () => null }, kernelUnlocked: async () => false, github: async () => null, _progress: progress };
};

test('make_picture: registered in its own keyword group, flux-1-schnell is asked, the picture is kept a week under img: and served at /i/<id>', async () => {
  const tool = T.toolByName.get('make_picture');
  assert.ok(tool, 'registered');
  assert.equal(tool.risk, 'auto');
  assert.deepEqual(tool.parameters.required, ['prompt']);
  const group = T.TOOL_GROUPS.find((g) => g.name === 'pictures');
  assert.ok(group && group.tools.includes(tool));
  assert.ok(group.when.test('draw me a cat') && group.when.test('make a logo for my shop') && group.when.test('a wallpaper please') && !group.when.test('what is the weather'));
  assert.ok(typeof group.about === 'string' && group.about.length <= 220 && /make_picture/.test(group.about), 'an about line for the prompt');
  assert.ok(T.selectTools('paint a sunset', new Set(), false).some((t) => t.name === 'make_picture'));
  assert.ok(!T.selectTools('hello', new Set(), false).some((t) => t.name === 'make_picture'), 'not described on every turn');
  const kv = fakeKv();
  const ai = fakeAi();
  const ctx = ctxWith({ AI: ai, SITES: kv });
  const out = await tool.run({ prompt: 'A red fox in snow, watercolour', steps: 6 }, ctx);
  const m = out.match(/^Picture made: https:\/\/ghosty\.example\/i\/([A-Za-z0-9_-]{16}) \(kept 7 days\)\. Tell the owner what it shows in one line and give them the link\.$/);
  assert.ok(m, out);
  assert.deepEqual(ai.calls, [{ model: '@cf/black-forest-labs/flux-1-schnell', inputs: { prompt: 'A red fox in snow, watercolour', steps: 6 } }]);
  assert.deepEqual(ctx._progress, ['drawing…', 'keeping it…']);
  assert.ok(kv.m.has(`img:${m[1]}`), 'the bytes are under the same img: key the Lens uses');
  assert.equal(kv.ttl.get(`img:${m[1]}`), 7 * 86_400);
  const served = await L.imageResponse(kv, m[1]);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get('content-type'), 'image/jpeg');
  assert.deepEqual(new Uint8Array(await served.arrayBuffer()), jpeg());
  const day = new Date().toISOString().slice(0, 10);
  assert.equal(kv.m.get(`pic:count:${day}`), '1', 'its own counter, not the Lens shares');
  assert.equal(kv.m.get(`img:count:${day}`), undefined);
  // steps are kept between 1 and 8 and default to 4; the prompt is cut at 600 characters
  await tool.run({ prompt: 'x'.repeat(700), steps: 99 }, ctx);
  assert.equal(ai.calls.at(-1).inputs.steps, 8);
  assert.equal(ai.calls.at(-1).inputs.prompt.length, 600);
  await tool.run({ prompt: 'y', steps: 0 }, ctx);
  assert.equal(ai.calls.at(-1).inputs.steps, 1);
  await tool.run({ prompt: 'z' }, ctx);
  assert.equal(ai.calls.at(-1).inputs.steps, 4);
  await assert.rejects(tool.run({}, ctx), /missing "prompt"/);
});

test('make_picture: 40 a day, then a plain refusal; honest errors with no Workers AI, no KV, or a model that answers with nothing', async () => {
  const tool = T.toolByName.get('make_picture');
  const kv = fakeKv();
  const ctx = ctxWith({ AI: fakeAi(), SITES: kv });
  for (let i = 0; i < L.PICTURES_PER_DAY; i++) await tool.run({ prompt: `picture ${i}` }, ctx);
  await assert.rejects(tool.run({ prompt: 'one more' }, ctx), (e) => e.status === 429 && /40 pictures have been made today, which is the daily limit; more tomorrow/.test(e.message));
  assert.equal([...kv.m.keys()].filter((k) => /^img:[A-Za-z0-9_-]{16}$/.test(k)).length, 40);
  await assert.rejects(tool.run({ prompt: 'a cat' }, ctxWith({ SITES: fakeKv() })), /Pictures need Workers AI \(free, always there once Ghosty is on Cloudflare\)/);
  await assert.rejects(tool.run({ prompt: 'a cat' }, ctxWith({ AI: fakeAi() })), /SITES KV namespace/);
  await assert.rejects(tool.run({ prompt: 'a cat' }, ctxWith({ AI: fakeAi(null), SITES: fakeKv() })), /returned nothing/);
  await assert.rejects(tool.run({ prompt: 'a cat' }, ctxWith({ AI: fakeAi(new Error('5016: neurons used up')), SITES: fakeKv() })), /did not answer: 5016: neurons used up/);
  await assert.rejects(tool.run({ prompt: 'a cat' }, ctxWith({ AI: fakeAi(Buffer.from('not a picture at all, just text').toString('base64')), SITES: fakeKv() })), /not a picture/);
  assert.equal(P.PICTURE_COUNT, 'pic:count:');
});

test('the Lens share path is unchanged by the shared store: 24 hours, 30 a day, its own img:count', async () => {
  const kv = fakeKv();
  const now = Date.UTC(2026, 9, 16, 12);
  const r = await L.shareImage(kv, jpeg().buffer, 'image/jpeg', now);
  assert.equal(kv.ttl.get(`img:${r.id}`), 86_400);
  assert.equal(r.expires, now + 86_400_000);
  assert.equal(kv.m.get('img:count:2026-10-16'), '1');
  assert.equal(kv.ttl.get('img:count:2026-10-16'), 2 * 86_400);
  assert.equal(await L.sharesToday(kv, now), 1);
  assert.equal(await L.countToday(kv, 'pic:count:', 'picture', now), 0);
});

test('through the agent loop: "draw a cat" → make_picture (progress shown) → a reply with the link, which /i/<id> serves to anyone', async () => {
  class MemStorage {
    m = new Map();
    async get(k) { return Array.isArray(k) ? new Map(k.filter((x) => this.m.has(x)).map((x) => [x, structuredClone(this.m.get(x))])) : this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
    async put(k, v) { if (typeof k === 'object') for (const [a, b] of Object.entries(k)) this.m.set(a, structuredClone(b)); else this.m.set(k, structuredClone(v)); }
    async delete(k) { return Array.isArray(k) ? k.filter((x) => this.m.delete(x)).length : this.m.delete(k); }
    async list({ prefix = '' } = {}) { return new Map([...this.m].filter(([k]) => k.startsWith(prefix))); }
    async setAlarm() {}
    async getAlarm() { return null; }
  }
  const OWNER_KEY = 'test-owner-key-0123456789abcdef';
  const pending = [];
  const kv = fakeKv();
  const ai = fakeAi();
  const state = { storage: new MemStorage(), waitUntil: (p) => pending.push(p), blockConcurrencyWhile: (f) => f() };
  const env = { OWNER_KEY, VAULT_KEY: Buffer.from(webcrypto.getRandomValues(new Uint8Array(32))).toString('base64'), MOCK_LLM: '1', SITES: kv, AI: ai, PUBLIC_ORIGIN: 'https://ghosty.example' };
  let agent;
  env.AGENT = { idFromName: (n) => n, get: () => ({ fetch: (r) => (agent ??= new mod.GhostyAgent(state, env)).fetch(r) }) };
  const ctx = { waitUntil: (p) => pending.push(p), passThroughOnException() {} };
  const r = await mod.default.fetch(new Request('https://ghosty.test/api/chat', { method: 'POST', headers: { 'content-type': 'application/json', 'x-ghosty': '1', 'x-ghosty-key': OWNER_KEY }, body: JSON.stringify({ message: 'draw a cat' }) }), env, ctx);
  assert.equal(r.status, 200);
  const ev = (await r.text()).trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  await Promise.allSettled(pending.splice(0));
  assert.equal(ev.find((e) => e.t === 'tool').name, 'make_picture');
  assert.deepEqual(ev.filter((e) => e.t === 'progress').map((e) => e.label), ['drawing…', 'keeping it…']);
  const result = ev.find((e) => e.t === 'tool_result');
  assert.ok(result.ok, result.summary);
  const link = ev.find((e) => e.t === 'text').text.match(/https:\/\/ghosty\.test\/i\/[A-Za-z0-9_-]{16}/)?.[0];
  assert.ok(link, 'the reply carries the link, on the address the owner used');
  const pub = await mod.default.fetch(new Request(link, { headers: { 'sec-fetch-site': 'cross-site' } }), env, ctx);
  assert.equal(pub.status, 200);
  assert.equal(pub.headers.get('content-type'), 'image/jpeg');
  assert.ok(ai.calls[0].inputs.prompt.startsWith('A cat'), ai.calls[0].inputs.prompt);
});
