// Model routing: best coders first for code, small free allowances kept for code,
// the keyless Workers AI fallback, and requests slimmed to fit small free tiers.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const R = await import('./.build/llm/router.mjs');
const P = await import('./.build/llm/providers.mjs');

class MemStorage {
  m = new Map();
  async get(k) { return this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
  async put(k, v) { this.m.set(k, structuredClone(v)); }
  async delete(k) { return this.m.delete(k); }
}
const vaultWith = (keys) => ({ get: async (n) => keys[n] ?? null, has: async (n) => !!keys[n] });
const tool = (name, desc = 'x'.repeat(300)) => ({ type: 'function', function: { name, description: desc, parameters: { type: 'object', properties: {} } } });
const TOOLS = ['repo_read', 'propose_change', 'update_change', 'wait_for_checks', 'weather', 'play_radio', 'set_reminder', 'fly_to'].map((n) => tool(n));

function fakeFetch(log, replies = {}) {
  return async (url, init) => {
    const body = JSON.parse(init.body);
    log.push({ url, model: body.model, tools: (body.tools ?? []).map((t) => t.function.name), size: init.body.length });
    const r = replies[body.model];
    if (r === 429) return new Response('{"error":{"message":"rate limit"}}', { status: 429 });
    return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: `hi from ${body.model}` } }] }), { headers: { 'content-type': 'application/json' } });
  };
}

test('coding turns try the strongest coder first, across providers', async () => {
  const log = [];
  globalThis.fetch = fakeFetch(log);
  const r = new R.Router(new MemStorage(), vaultWith({ gemini: 'g', mistral: 'm' }), {});
  const out = await r.complete([{ role: 'system', content: 'sys' }, { role: 'user', content: 'add a tab' }], TOOLS, undefined, { code: true });
  assert.match(out.model, /^Mistral · devstral-medium-latest$/, out.model);
  const chat = await r.complete([{ role: 'user', content: 'hello' }], TOOLS);
  assert.match(chat.model, /^Gemini/, "chat keeps the owner's provider order");
  assert.ok(!log.some((l) => l.url.includes('pollinations')), 'open endpoints are not asked while the owner\'s keys answer');
});

test('rate-limited coders fall through to the next best', async () => {
  const log = [];
  globalThis.fetch = fakeFetch(log, { 'devstral-medium-latest': 429 });
  const r = new R.Router(new MemStorage(), vaultWith({ gemini: 'g', mistral: 'm' }), {});
  const out = await r.complete([{ role: 'user', content: 'fix the bug' }], TOOLS, undefined, { code: true });
  assert.match(out.model, /gemini-3\.8-flash/, out.model);
  assert.equal(log[0].model, 'devstral-medium-latest', 'the strongest coder was tried first');
});

test('no keys at all: Workers AI answers through the binding', async () => {
  const calls = [];
  const env = { AI: { run: async (model, inputs) => { calls.push({ model, inputs }); return { response: '', tool_calls: [{ name: 'weather', arguments: { place: 'London' } }] }; } } };
  const r = new R.Router(new MemStorage(), vaultWith({}), env);
  const out = await r.complete([{ role: 'user', content: 'weather?' }], TOOLS);
  assert.match(out.model, /^Workers AI/);
  assert.equal(out.message.tool_calls[0].function.name, 'weather');
  assert.equal(out.message.tool_calls[0].function.arguments, '{"place":"London"}');
  assert.ok(calls[0].inputs.tools.length, 'tools are passed to the model');
});

test('without a binding, without keys and with open endpoints switched off, the error says what to do', async () => {
  const r = new R.Router(new MemStorage(), vaultWith({}), { KEYLESS_MODELS: '0' });
  await assert.rejects(r.complete([{ role: 'user', content: 'x' }], TOOLS), /Add a free Gemini or Groq key/);
});

test('no keys, no binding: the open Pollinations endpoint answers, with no Authorization header', async () => {
  const log = [];
  const headers = [];
  globalThis.fetch = async (url, init) => {
    headers.push(init.headers);
    return fakeFetch(log)(url, init);
  };
  const r = new R.Router(new MemStorage(), vaultWith({}), {});
  const out = await r.complete([{ role: 'user', content: 'hello' }], TOOLS);
  assert.equal(out.model, 'Pollinations · openai');
  assert.match(log[0].url, /^https:\/\/text\.pollinations\.ai\/v1\/chat\/completions$/);
  assert.equal(headers[0].Authorization, undefined, 'nothing secret is sent to an open endpoint');
  assert.equal(out.message.content, 'hi from openai');
});

test("Pollinations' pacing (402 + Retry-After) cools it for that long, and the summary says why", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response('{"error":"FREE_LIMIT","message":"wait 30s"}', { status: 402, headers: { 'retry-after': '30' } });
  };
  const r = new R.Router(new MemStorage(), vaultWith({}), {});
  await assert.rejects(r.complete([{ role: 'user', content: 'hello' }], [], undefined, { maxWaitMs: 0 }), /busy or failing.*402.*frees up in about 3[0-9] seconds/);
  assert.equal(calls, 1);
  const row = (await r.summary()).find((m) => m.provider === 'Pollinations');
  assert.equal(row.state, 'cool');
  assert.match(row.info, /free limit/);
});

test("a provider out of allowance for the day is remembered until its reset; a new key elsewhere doesn't reopen it", async () => {
  const log = [];
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    log.push({ url, model: body.model });
    if (url.includes('googleapis')) return new Response('{"error":{"message":"Quota exceeded for quota metric: requests per day"}}', { status: 429 });
    return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: `hi from ${body.model}` } }] }), { headers: { 'content-type': 'application/json' } });
  };
  const storage = new MemStorage();
  const r = new R.Router(storage, vaultWith({ gemini: 'g' }), {});
  const out = await r.complete([{ role: 'user', content: 'hello' }], []);
  assert.equal(out.model, 'Pollinations · openai', 'the open endpoint carries on');
  assert.equal(log.filter((l) => l.url.includes('googleapis')).length, 1, "the rest of Gemini's models are not asked once the day's allowance is gone");
  log.length = 0;
  await r.complete([{ role: 'user', content: 'again' }], []);
  assert.ok(!log.some((l) => l.url.includes('googleapis')), 'not asked again before the reset');
  const sum = await r.summary();
  const g = sum.find((m) => m.provider === 'Gemini');
  assert.equal(g.model, '(all)');
  assert.equal(g.state, 'cool');
  assert.match(g.info, /daily limit · back \d\d:\d\d UTC/);
  // the reset is at midnight in California (08:00 UTC at the latest), never more than a day away
  const h = storage.m.get('llm:health');
  const left = h['cool|gemini'].cool - Date.now();
  assert.ok(left > 0 && left <= 24 * 3600_000 + 1000, String(left));
  // saving another key keeps what is known about the limit; a full reset forgets it
  await r.resetHealth(true);
  assert.ok((await r.summary()).find((m) => m.provider === 'Gemini').state === 'cool');
  await r.resetHealth();
  assert.ok((await r.summary()).find((m) => m.provider === 'Gemini').state === 'ok');
});

test("Ghosty's own small jobs (cheap) go to the small, generously rationed models first", async () => {
  const log = [];
  globalThis.fetch = fakeFetch(log);
  const env = { AI: { run: async (model) => ({ response: `cf ${model}` }) } };
  const r = new R.Router(new MemStorage(), vaultWith({ gemini: 'g', groq: 'q' }), env);
  const cheap = await r.complete([{ role: 'user', content: 'What is 2 + 2?' }], [], undefined, { cheap: true });
  assert.match(cheap.model, /^Workers AI · @cf\/zai-org\/glm-4\.7-flash$/, cheap.model);
  assert.equal(log.length, 0, "the owner's keys were not spent");
  const chat = await r.complete([{ role: 'user', content: 'hello' }], []);
  assert.match(chat.model, /^Gemini/, "chat still uses the owner's keys first");
});

test('big requests are slimmed to fit an 8k free tier: coding tools kept, old turns dropped', () => {
  const big = [{ role: 'system', content: 'S'.repeat(20000) }];
  for (let i = 0; i < 30; i++) big.push({ role: 'user', content: `q${i} ${'x'.repeat(2000)}` }, { role: 'assistant', content: `a${i}` });
  big.push({ role: 'user', content: 'latest request' });
  const many = [...TOOLS, ...Array.from({ length: 40 }, (_, i) => tool(`other_${i}`))];
  const s = R.slimToFit(big, many, 7000);
  assert.ok(s, 'fits');
  assert.equal(s.messages[0].role, 'system');
  assert.equal(s.messages.at(-1).content, 'latest request', 'the latest request is always kept');
  assert.ok(s.tools.every((t) => /^(repo_|propose_change|update_change|wait_for_checks)/.test(t.function.name)));
  assert.ok(JSON.stringify(s).length / 3.6 <= 7000 + 50);
  // small requests are left alone
  const small = [{ role: 'user', content: 'hi' }];
  assert.deepEqual(R.slimToFit(small, TOOLS, 7000), { messages: small, tools: TOOLS });
});

test('Workers AI reply shapes are all understood', () => {
  assert.equal(R.normaliseWorkersAi({ choices: [{ message: { content: 'ok' } }] }).content, 'ok');
  const resp = R.normaliseWorkersAi({ output: [{ type: 'reasoning' }, { type: 'message', content: [{ text: 'hi' }] }, { type: 'function_call', name: 'fly_to', arguments: '{"place":"Paris"}', call_id: 'c1' }] });
  assert.equal(resp.content, 'hi');
  assert.equal(resp.tool_calls[0].id, 'c1');
  assert.equal(R.normaliseWorkersAi({ response: '<think>hmm</think>Hello' }).content, 'Hello');
  assert.equal(R.normaliseWorkersAi({ response: '' }), null);
});

test("a per-minute 429 that mentions 'quota' (Gemini's wording) is a short cool-down, not the day's allowance", async () => {
  const log = [];
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    log.push({ url, model: body.model });
    if (url.includes('googleapis') && body.model === 'gemini-3.8-flash') return new Response('{"error":{"message":"You exceeded your current quota, please check your plan and billing details. Please retry in 23.5s."}}', { status: 429 });
    return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: `hi from ${body.model}` } }] }), { headers: { 'content-type': 'application/json' } });
  };
  const storage = new MemStorage();
  const r = new R.Router(storage, vaultWith({ gemini: 'g' }), {});
  const out = await r.complete([{ role: 'user', content: 'hello' }], []);
  assert.equal(out.model, 'Gemini · gemini-3.6-flash', "the provider's next model answers");
  const h = storage.m.get('llm:health');
  assert.equal(h['cool|gemini'], undefined, 'the provider is not shut for the day');
  const cool = h['gemini|gemini-3.8-flash'].cool - Date.now();
  assert.ok(cool > 20_000 && cool < 30_000, `cooled for the stated 23.5 s: ${cool}`);
  // the real thing: a named per-day metric shuts the provider until its reset
  globalThis.fetch = async () => new Response('{"error":{"message":"You exceeded your current quota. quota_id: GenerateRequestsPerDayPerProjectPerModel-FreeTier, limit: 250"}}', { status: 429 });
  await r.resetHealth();
  await assert.rejects(r.complete([{ role: 'user', content: 'hello' }], [], undefined, { maxWaitMs: 0 }));
  assert.ok(storage.m.get('llm:health')['cool|gemini'].cool > Date.now() + 60_000);
});

test('cheapScore: small and generously rationed first; a Pro model is never cheap, and "gemini" is not "mini"', () => {
  const gemini = P.PROVIDERS.find((p) => p.id === 'gemini');
  const cf = P.PROVIDERS.find((p) => p.id === 'workersai');
  const poll = P.PROVIDERS.find((p) => p.id === 'pollinations');
  assert.ok(P.cheapScore('gemini-2.5-pro', gemini) < P.cheapScore('gemini-3.8-flash', gemini));
  assert.ok(P.cheapScore('gemini-3.8-flash', gemini) < P.cheapScore('gemini-3.5-flash-lite', gemini));
  assert.ok(P.cheapScore('gemini-2.5-pro', gemini) < P.cheapScore('openai', poll), 'study drills go to the open endpoint before Gemini Pro');
  assert.ok(P.cheapScore('@cf/zai-org/glm-4.7-flash', cf) > P.cheapScore('openai', poll));
  assert.ok(P.cheapScore('gpt-4.1-mini') > P.cheapScore('gpt-4.1'), '"mini" as a word of its own still counts');
  assert.ok(P.cheapScore('openai/gpt-oss-120b') < P.cheapScore('openai/gpt-oss-20b'));
});

const ok = (model) => new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: `hi from ${model}` } }] }), { headers: { 'content-type': 'application/json' } });

test('the best model cooling for a few seconds is waited for rather than skipped for a worse one; a long cool-down is skipped; own jobs never wait', async () => {
  const log = [];
  globalThis.fetch = fakeFetch(log);
  const r = new R.Router(new MemStorage(), vaultWith({ gemini: 'g', groq: 'q' }), {});
  await r.mark('gemini|gemini-3.8-flash', { cool: Date.now() + 1500, why: 'rate limit' });
  let t0 = Date.now();
  const out = await r.complete([{ role: 'user', content: 'hello' }], []);
  assert.equal(out.model, 'Gemini · gemini-3.8-flash');
  assert.ok(Date.now() - t0 >= 1400, 'waited for it');
  assert.equal(log.length, 1, 'nothing else was asked meanwhile');
  // cooling for a minute: the next model answers at once
  await r.mark('gemini|gemini-3.8-flash', { cool: Date.now() + 60_000, why: 'rate limit' });
  t0 = Date.now();
  assert.equal((await r.complete([{ role: 'user', content: 'hello' }], [])).model, 'Gemini · gemini-3.6-flash');
  assert.ok(Date.now() - t0 < 1000, 'no waiting on a long cool-down');
  // Ghosty's own jobs (maxWaitMs: 0) take what is free now
  await r.mark('gemini|gemini-3.8-flash', { cool: Date.now() + 1500, why: 'rate limit' });
  t0 = Date.now();
  const own = await r.complete([{ role: 'user', content: 'hello' }], [], undefined, { maxWaitMs: 0 });
  assert.notEqual(own.model, 'Gemini · gemini-3.8-flash');
  assert.ok(Date.now() - t0 < 1000);
});

test('a 429 asking for a short wait is retried once on the same model after waiting; a long Retry-After moves on', async () => {
  let n = 0;
  const log = [];
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    log.push(body.model);
    if (n++ === 0) return new Response('{"error":{"message":"rate limit"}}', { status: 429, headers: { 'retry-after': '1' } });
    return ok(body.model);
  };
  const r = new R.Router(new MemStorage(), vaultWith({ gemini: 'g' }), {});
  const t0 = Date.now();
  const out = await r.complete([{ role: 'user', content: 'hello' }], []);
  assert.equal(out.model, 'Gemini · gemini-3.8-flash');
  assert.deepEqual(log, ['gemini-3.8-flash', 'gemini-3.8-flash'], 'the same model, once more');
  assert.ok(Date.now() - t0 >= 1000, 'after the stated second');
  // a per-day limit or a long wait is not retried: the next model is asked
  n = 0;
  log.length = 0;
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    log.push(body.model);
    if (n++ === 0) return new Response('{"error":{"message":"rate limit"}}', { status: 429, headers: { 'retry-after': '30' } });
    return ok(body.model);
  };
  const r2 = new R.Router(new MemStorage(), vaultWith({ gemini: 'g' }), {});
  assert.equal((await r2.complete([{ role: 'user', content: 'hello' }], [])).model, 'Gemini · gemini-3.6-flash');
  assert.deepEqual(log, ['gemini-3.8-flash', 'gemini-3.6-flash']);
  // a retry that fails again is classified as usual
  n = 0;
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    if (body.model === 'gemini-3.8-flash') return new Response('{"error":{"message":"rate limit"}}', { status: 429, headers: { 'retry-after': '1' } });
    return ok(body.model);
  };
  const storage = new MemStorage();
  const r3 = new R.Router(storage, vaultWith({ gemini: 'g' }), {});
  assert.equal((await r3.complete([{ role: 'user', content: 'hello' }], [])).model, 'Gemini · gemini-3.6-flash');
  assert.ok(storage.m.get('llm:health')['gemini|gemini-3.8-flash'].cool > Date.now(), 'cooled after the second 429');
});

test('the error carries how long until the first model is back, and nextFree() says it too', async () => {
  globalThis.fetch = async () => new Response('{"error":{"message":"rate limit"}}', { status: 429, headers: { 'retry-after': '120' } });
  const r = new R.Router(new MemStorage(), vaultWith({ groq: 'q' }), { KEYLESS_MODELS: '0' });
  const err = await r.complete([{ role: 'user', content: 'hello' }], []).then(() => null, (e) => e);
  assert.ok(err instanceof Error && err.name === 'RouterError');
  assert.match(err.message, /busy or failing.*frees up in about 1[12]\d seconds/);
  assert.ok(err.waitMs > 100_000 && err.waitMs < 130_000, String(err.waitMs));
  const next = await r.nextFree();
  assert.ok(next > 100_000 && next <= err.waitMs + 1000, String(next));
  assert.equal(await new R.Router(new MemStorage(), vaultWith({}), { KEYLESS_MODELS: '0' }).nextFree(), null, 'no model at all');
  assert.equal(await new R.Router(new MemStorage(), vaultWith({ gemini: 'g' }), {}).nextFree(), 0, 'free now');
  const day = new R.Router(new MemStorage(), vaultWith({ gemini: 'g' }), { KEYLESS_MODELS: '0' });
  await day.mark('cool|gemini', { cool: Date.now() + 3600_000, why: 'daily limit' });
  const left = await day.nextFree();
  assert.ok(left > 3590_000 && left <= 3600_000, 'a provider out for the day counts as a whole');
});

test('the three new free providers: after the existing keys and before Workers AI, their keys and live checks, discovery filtered, Cohere fixed', async () => {
  const ids = P.PROVIDERS.map((p) => p.id);
  assert.deepEqual(ids.slice(0, 8), ['gemini', 'groq', 'cerebras', 'openrouter', 'mistral', 'nvidia', 'sambanova', 'cohere']);
  assert.ok(ids.indexOf('cohere') < ids.indexOf('workersai') && ids.indexOf('workersai') < ids.indexOf('pollinations'));
  const nv = P.PROVIDERS.find((p) => p.id === 'nvidia');
  assert.equal(nv.name, 'NVIDIA NIM');
  assert.equal(nv.base, 'https://integrate.api.nvidia.com/v1');
  assert.deepEqual(nv.seed, ['moonshotai/kimi-k2-instruct', 'deepseek-ai/deepseek-v3.1', 'qwen/qwen3-coder-480b-a35b-instruct', 'meta/llama-3.3-70b-instruct', 'nvidia/llama-3.3-nemotron-super-49b-v1.5']);
  assert.ok(nv.accept('meta/llama-3.1-405b-instruct') && !nv.accept('nvidia/nv-embedqa-e5-v5') && !nv.accept('nvidia/llama-3.2-nv-rerankqa-1b-v2') && !nv.accept('microsoft/phi-3-vision-128k-instruct') && !nv.accept('nvidia/llama-3.1-nemoguard-8b-content-safety'));
  assert.equal(nv.maxOut, 8192);
  assert.equal(nv.reset, 'rolling');
  assert.equal(nv.cheap, 3);
  const sn = P.PROVIDERS.find((p) => p.id === 'sambanova');
  assert.equal(sn.base, 'https://api.sambanova.ai/v1');
  assert.deepEqual(sn.seed, ['DeepSeek-V3.1', 'Meta-Llama-3.3-70B-Instruct', 'Llama-4-Maverick-17B-128E-Instruct', 'Qwen3-32B']);
  assert.equal(sn.reset, 'utc-midnight');
  assert.equal(sn.cheap, 2);
  assert.ok(sn.accept('DeepSeek-V3.1') && !sn.accept('E5-Mistral-7B-Instruct') && !sn.accept('Whisper-Large-v3'));
  const co = P.PROVIDERS.find((p) => p.id === 'cohere');
  assert.equal(co.base, 'https://api.cohere.ai/compatibility/v1');
  assert.deepEqual(co.seed, ['command-a-03-2025', 'command-r-plus-08-2024', 'command-r7b-12-2024']);
  assert.equal(co.noDiscovery, true);
  assert.equal(co.reset, 'rolling');
  assert.equal(co.cheap, 3);
  assert.ok(co.accept('command-a-03-2025') && !co.accept('embed-english-v3.0'));
  for (const p of [nv, sn, co]) assert.ok(!p.tier && !p.keyless, `${p.id} is one of the owner's keys (tier 0)`);
  for (const m of [...nv.seed, ...sn.seed, ...co.seed]) assert.ok(!P.NOT_CHAT.test(m), m);
  // the owner's small jobs still go to the generously rationed models first
  assert.ok(P.cheapScore('moonshotai/kimi-k2-instruct', nv) < P.cheapScore('openai', P.PROVIDERS.find((p) => p.id === 'pollinations')));
  // keys: a System tab entry each, and the live check is GET /models with the bearer
  const K = await import('./.build/keys.mjs');
  for (const n of ['nvidia', 'sambanova', 'cohere']) {
    const k = K.KEYS.find((x) => x.name === n);
    assert.ok(k, `${n} key`);
    assert.equal(k.need, 'optional');
    assert.ok(k.steps.length >= 3 && k.why.length > 30 && /^https:\/\//.test(k.link), n);
  }
  assert.match(K.KEYS.find((x) => x.name === 'nvidia').hint, /nvapi-/);
  assert.equal(K.KEYS.find((x) => x.name === 'nvidia').link, 'https://build.nvidia.com/settings/api-keys');
  assert.equal(K.KEYS.find((x) => x.name === 'sambanova').link, 'https://cloud.sambanova.ai/apis');
  assert.equal(K.KEYS.find((x) => x.name === 'cohere').link, 'https://dashboard.cohere.com/api-keys');
  const asked = [];
  globalThis.fetch = async (url, init) => {
    asked.push({ url, auth: init?.headers?.Authorization });
    return new Response('{"data":[]}', { status: 200 });
  };
  for (const [n, url] of [['nvidia', 'https://integrate.api.nvidia.com/v1/models'], ['sambanova', 'https://api.sambanova.ai/v1/models'], ['cohere', 'https://api.cohere.ai/compatibility/v1/models']]) {
    const r = await K.testKey(n, 'secret-key-value');
    assert.equal(r.ok, true, n);
    assert.equal(asked.at(-1).url, url);
    assert.equal(asked.at(-1).auth, 'Bearer secret-key-value');
  }
  globalThis.fetch = async () => new Response('{}', { status: 401 });
  assert.equal((await K.testKey('nvidia', 'bad')).ok, false);
  // discovery: the catalogue's chat models join the seeds, embedders and Whisper do not, Cohere is never asked
  globalThis.fetch = async (url) => {
    if (/integrate\.api\.nvidia\.com\/v1\/models$/.test(url)) return new Response(JSON.stringify({ data: [{ id: 'meta/llama-3.1-405b-instruct' }, { id: 'nvidia/nv-embedqa-e5-v5' }, { id: 'moonshotai/kimi-k2-instruct' }] }));
    if (/api\.sambanova\.ai\/v1\/models$/.test(url)) return new Response(JSON.stringify({ data: [{ id: 'DeepSeek-V3.1' }, { id: 'E5-Mistral-7B-Instruct' }, { id: 'Whisper-Large-v3' }, { id: 'DeepSeek-R1' }] }));
    if (/cohere/.test(url)) throw new Error('Cohere must not be asked for its models');
    return new Response('{}', { status: 404 });
  };
  const r = new R.Router(new MemStorage(), vaultWith({ nvidia: 'n', sambanova: 's', cohere: 'c' }), { KEYLESS_MODELS: '0' });
  await r.discover(true);
  const sum = await r.summary();
  const models = (name) => sum.filter((m) => m.provider === name).map((m) => m.model);
  assert.ok(models('NVIDIA NIM').includes('meta/llama-3.1-405b-instruct') && models('NVIDIA NIM').includes('moonshotai/kimi-k2-instruct'), models('NVIDIA NIM').join());
  assert.ok(!models('NVIDIA NIM').includes('nvidia/nv-embedqa-e5-v5'));
  assert.ok(models('SambaNova').includes('DeepSeek-R1') && !models('SambaNova').some((m) => /e5|whisper/i.test(m)), models('SambaNova').join());
  assert.deepEqual(models('Cohere'), co.seed);
  // chat order: the owner's existing keys first, then the new ones; the open endpoint is not asked while they answer
  const log = [];
  globalThis.fetch = fakeFetch(log);
  assert.match((await new R.Router(new MemStorage(), vaultWith({ nvidia: 'n', mistral: 'm' }), {}).complete([{ role: 'user', content: 'hello' }], [])).model, /^Mistral/);
  assert.equal((await new R.Router(new MemStorage(), vaultWith({ cohere: 'c' }), {}).complete([{ role: 'user', content: 'hello' }], [])).model, 'Cohere · command-a-03-2025');
  assert.equal((await new R.Router(new MemStorage(), vaultWith({ sambanova: 's' }), {}).complete([{ role: 'user', content: 'hello' }], [])).model, 'SambaNova · DeepSeek-V3.1');
  assert.ok(!log.some((l) => /pollinations/.test(l.url)));
  assert.ok(log.every((l) => /nvidia|sambanova|cohere|mistral/.test(l.url)));
  // the owner's saved order still wins, and a provider it never named comes after the named ones
  const ordered = new R.Router(new MemStorage(), vaultWith({ nvidia: 'n', mistral: 'm' }), {});
  await ordered.setOrder(['nvidia']);
  assert.match((await ordered.complete([{ role: 'user', content: 'hello' }], [])).model, /^NVIDIA NIM/);
});

// ── the quota engine (llm/quota.ts): spread the load, two lanes, wait for room, learn limits ──

/** Fake providers that enforce their real free limits per minute: a call over the limit gets a 429, as the real ones do. */
function limitedProviders(log, { delay = 5 } = {}) {
  const per = new Map(); // counter → call times
  const realLimit = (host, model) => (/googleapis/.test(host) ? [`${host}|${model}`, 10] : /groq/.test(host) ? [`${host}|${model}`, 30] : /cerebras/.test(host) ? [`${host}|${model}`, 30] : /nvidia/.test(host) ? [host, 40] : /cohere/.test(host) ? [host, 20] : [host, 1000]);
  return async (url, init) => {
    const body = JSON.parse(init.body);
    const host = new URL(url).hostname;
    const [k, limit] = realLimit(host, body.model);
    const now = Date.now();
    const list = (per.get(k) ?? []).filter((t) => t > now - 60_000);
    list.push(now);
    per.set(k, list);
    await new Promise((r) => setTimeout(r, delay));
    const over = list.length > limit;
    log.push({ host, model: body.model, status: over ? 429 : 200, roles: body.messages.map((m) => m.role), auth: init.headers.Authorization, tools: (body.tools ?? []).length });
    if (over) return new Response('{"error":{"message":"rate limit"}}', { status: 429 });
    return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: `hi from ${body.model}` } }], usage: { total_tokens: 120 } }), { headers: { 'content-type': 'application/json' } });
  };
}

test('a burst of 40 background calls gets no 429 and is spread across providers (it used to hammer the first one)', async () => {
  const log = [];
  globalThis.fetch = limitedProviders(log);
  const r = new R.Router(new MemStorage(), vaultWith({ gemini: 'g', groq: 'q', cerebras: 'c', nvidia: 'n' }), { KEYLESS_MODELS: '0' });
  const outs = await Promise.all(Array.from({ length: 40 }, (_, i) => r.complete([{ role: 'user', content: `summarise note ${i}` }], [], undefined, { priority: 'background' })));
  assert.equal(outs.length, 40, 'every call answered');
  const bounced = log.filter((l) => l.status === 429);
  assert.equal(bounced.length, 0, `no call was sent that bounced: ${bounced.map((b) => b.model).join(', ')}`);
  const hosts = new Set(log.map((l) => l.host));
  assert.ok(hosts.size >= 3, `spread over providers: ${[...hosts].join(', ')}`);
  const perModel = {};
  for (const l of log) perModel[`${l.host}|${l.model}`] = (perModel[`${l.host}|${l.model}`] ?? 0) + 1;
  // background keeps its hands off the chat reserve: no Gemini model past 70 % of its 10 a minute
  for (const [k, n] of Object.entries(perModel)) if (k.includes('googleapis')) assert.ok(n <= 7, `${k}: ${n}`);
});

test("the owner's chat still goes through when background work has used its whole share", async () => {
  const log = [];
  globalThis.fetch = limitedProviders(log, { delay: 0 });
  const r = new R.Router(new MemStorage(), vaultWith({ cohere: 'c' }), { KEYLESS_MODELS: '0' });
  // Cohere's trial key: 20 a minute, so background may use 14
  for (let i = 0; i < 14; i++) await r.complete([{ role: 'user', content: `job ${i}` }], [], undefined, { priority: 'background', maxWaitMs: 0 });
  await assert.rejects(r.complete([{ role: 'user', content: 'one more job' }], [], undefined, { priority: 'background', maxWaitMs: 0 }), /full for now.*kept for your chat/);
  const chat = await r.complete([{ role: 'user', content: 'hello' }], []);
  assert.equal(chat.model, 'Cohere · command-a-03-2025', 'chat uses the reserve');
  assert.equal(log.filter((l) => l.status === 429).length, 0);
  assert.equal(log.length, 15, 'the refused background call was never sent');
});

test('when every capable provider is full, a call waits for the soonest window (with a progress line) instead of failing', async () => {
  const log = [];
  globalThis.fetch = limitedProviders(log, { delay: 0 });
  // Mistral's free plan: one request a second
  const r = new R.Router(new MemStorage(), vaultWith({ mistral: 'm' }), { KEYLESS_MODELS: '0' });
  await r.complete([{ role: 'user', content: 'first' }], []);
  const said = [];
  const t0 = Date.now();
  const out = await r.complete([{ role: 'user', content: 'second' }], [], undefined, { onWait: (t) => said.push(t) });
  assert.match(out.model, /^Mistral/);
  assert.ok(Date.now() - t0 >= 900, `waited for the window: ${Date.now() - t0} ms`);
  assert.match(said[0] ?? '', /^waiting for free AI room · 1 s$/);
  assert.equal(log.length, 2, 'nothing was sent early');
  // a call that may not wait fails at once with a clear reason
  await assert.rejects(r.complete([{ role: 'user', content: 'third' }], [], undefined, { maxWaitMs: 0 }), /full for now/);
});

test('limits are learned from rate-limit headers: a lower stated limit, and "none left" holds that model until its reset', async () => {
  const log = [];
  let hdrs = { 'x-ratelimit-limit-requests': '500', 'x-ratelimit-limit-tokens': '6000', 'x-ratelimit-remaining-requests': '499', 'x-ratelimit-remaining-tokens': '5800', 'x-ratelimit-reset-requests': '2m52s', 'x-ratelimit-reset-tokens': '2s' };
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    log.push(body.model);
    return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'ok' } }] }), { headers: { 'content-type': 'application/json', ...hdrs } });
  };
  const storage = new MemStorage();
  const r = new R.Router(storage, vaultWith({ groq: 'q' }), { KEYLESS_MODELS: '0' });
  await r.complete([{ role: 'user', content: 'hello' }], []);
  const q = R.quotaFor(storage);
  assert.deepEqual(q.learned('groq|openai/gpt-oss-120b'), { rpd: 500, tpm: 6000 }, "Groq's requests are per day, its tokens per minute");
  // Cerebras-style names, and nothing left: the model is not asked again until the stated reset
  hdrs = { 'x-ratelimit-limit-requests-day': '14400', 'x-ratelimit-remaining-requests-day': '0', 'x-ratelimit-reset-requests-day': '30.5' };
  await r.complete([{ role: 'user', content: 'again' }], []);
  const held = q.learned('groq|openai/gpt-oss-120b');
  assert.equal(held.rpd, 14400, "the provider's latest stated limit is its own word: it replaces the earlier one");
  assert.ok(held.hold > Date.now() + 25_000 && held.hold < Date.now() + 35_000, String(held.hold - Date.now()));
  log.length = 0;
  hdrs = {};
  assert.equal((await r.complete([{ role: 'user', content: 'third' }], [])).model, 'Groq · openai/gpt-oss-20b', 'the held model is skipped; the next answers');
  assert.deepEqual(log, ['openai/gpt-oss-20b']);
  // a 429 the counters did not see coming lowers the per-minute limit to the calls that were answered
  const q2 = R.quotaFor(new MemStorage());
  for (let i = 0; i < 4; i++) q2.take(['x'], 10)(10, true);
  q2.take(['x'], 10)(); // the one that bounced
  q2.learn429('x', 0);
  assert.equal(q2.learned('x').rpm, 4, 'the bounced call is not counted as got through');
  assert.equal(q2.room('x', { rpm: 30 }, 10, 'chat').ok, false, 'no more this minute');
  // the counters reach the database (at most every few seconds)
  assert.ok(storage.m.has('llm:quota'), 'saved to the database');
});

test('Google Gemma: its own key slot, else the Gemini key; only for small tool-less steps; no system message sent', async () => {
  const log = [];
  globalThis.fetch = limitedProviders(log, { delay: 0 });
  const r = new R.Router(new MemStorage(), vaultWith({ gemini: 'g' }), { KEYLESS_MODELS: '0' });
  const small = await r.complete([{ role: 'system', content: 'Write a title.' }, { role: 'user', content: 'a long note' }], [], undefined, { tier: 'small', priority: 'background' });
  assert.equal(small.model, 'Google Gemma · gemma-3-27b-it');
  assert.equal(log[0].auth, 'Bearer g', 'falls back to the Gemini key');
  assert.deepEqual(log[0].roles, ['user'], 'the system text rides in the user message');
  // the owner's chat never goes to Gemma, and neither does a request with tools
  assert.match((await r.complete([{ role: 'user', content: 'hello' }], [])).model, /^Gemini ·/);
  assert.match((await r.complete([{ role: 'user', content: 'hi' }], TOOLS, undefined, { tier: 'small' })).model, /^Gemini ·/);
  // its own key wins when saved
  log.length = 0;
  const own = new R.Router(new MemStorage(), vaultWith({ gemini: 'g', gemma: 'gm' }), { KEYLESS_MODELS: '0' });
  await own.complete([{ role: 'user', content: 'title?' }], [], undefined, { tier: 'small' });
  assert.equal(log[0].auth, 'Bearer gm');
  const gemma = P.PROVIDERS.find((p) => p.id === 'gemma');
  assert.equal(gemma.base, 'https://generativelanguage.googleapis.com/v1beta/openai');
  assert.deepEqual(gemma.modelLimits('gemma-3-27b-it'), { rpm: 30, tpm: 15_000, rpd: 14_400 });
  // the key slot: in System → Keys, optional, one plain line
  const K = await import('./.build/keys.mjs');
  const k = K.KEYS.find((x) => x.name === 'gemma');
  assert.ok(k && k.need === 'optional' && /Gemini key/.test(k.why) && k.steps.length >= 2, 'gemma key slot');
  // GitHub Models was retired on 30 July 2026: not a provider, and the GitHub token no longer promises it
  assert.ok(!P.PROVIDERS.some((p) => /github/.test(p.id) || /models\.github\.ai/.test(p.base)));
  assert.doesNotMatch(K.KEYS.find((x) => x.name === 'github').why, /GitHub Models|GPT-4\.1/);
});

test('every provider has its free limits; the capacity gauge says room now, used today and the reset', async () => {
  for (const p of P.PROVIDERS) assert.ok(p.limits || p.modelLimits, `${p.id} has limits`);
  globalThis.fetch = limitedProviders([], { delay: 0 });
  const r = new R.Router(new MemStorage(), vaultWith({ gemini: 'g', cohere: 'c' }), { KEYLESS_MODELS: '0' });
  await r.complete([{ role: 'user', content: 'hello' }], []);
  const cap = await r.capacity();
  assert.match(cap.summary, /^Plenty of room · 2 providers ready$/, `Gemma (small jobs only) is not counted for chat: ${cap.summary}`);
  const g = cap.providers.find((x) => x.provider === 'Gemini');
  assert.equal(g.usedToday, 1);
  assert.equal(g.perMinute, 60, 'five Gemini models: three Flash at 10 a minute, two Flash-Lite at 15');
  assert.equal(g.roomNow, 59);
  assert.ok(g.resetAt > Date.now() && g.resetAt <= Date.now() + 24 * 3600_000);
  const c = cap.providers.find((x) => x.provider === 'Cohere');
  assert.deepEqual([c.perMinute, c.perDay, c.resetAt], [20, 33, null]);
  // used up for the minute: FULL, with when room comes back
  const full = new R.Router(new MemStorage(), vaultWith({ cohere: 'c' }), { KEYLESS_MODELS: '0' });
  for (let i = 0; i < 20; i++) await full.complete([{ role: 'user', content: `q${i}` }], []);
  const fc = await full.capacity();
  assert.equal(fc.providers[0].state, 'full');
  assert.ok(fc.providers[0].backAt > Date.now());
  assert.match(fc.summary, /^No room right now · room again in \d+ s$/);
});

test('the gauge: one busy model is not a FULL provider; separate daily allowances are never summed; Gemma is marked small jobs only', async () => {
  const storage = new MemStorage();
  const r = new R.Router(storage, vaultWith({ gemini: 'g' }), { KEYLESS_MODELS: '0' });
  const q = R.quotaFor(storage);
  for (let i = 0; i < 10; i++) q.take(['gemini', 'gemini|gemini-3.8-flash'], 1000)(1000, true);
  const cap = await r.capacity();
  const g = cap.providers.find((x) => x.provider === 'Gemini');
  assert.equal(g.state, 'ready', 'four other models have room');
  assert.equal(g.roomNow, 50);
  assert.equal(g.perDay, null, 'no single number for five separate daily allowances');
  assert.equal(g.dayLeft, 1000, 'the best model (Flash-Lite) has 1,000 left today');
  assert.deepEqual([g.models, g.modelsOut], [5, 0]);
  const gm = cap.providers.find((x) => x.provider === 'Google Gemma');
  assert.equal(gm.smallOnly, true);
  assert.equal(cap.summary, 'Plenty of room · 1 provider ready');
});

test('learned limits age on their own: a header on every answer never keeps a 429-learned low alive; headers replace, not min', async () => {
  const q = R.quotaFor(new MemStorage());
  let T = 1_800_000_000_000;
  q.now = () => T;
  const k = 'groq|openai/gpt-oss-120b';
  const base = { rpm: 30, tpm: 8000, rpd: 1000, tpd: 200_000 };
  for (let i = 0; i < 3; i++) q.take(['groq', k], 100)(100, true);
  q.take(['groq', k], 100)();
  q.learn429(k, 0);
  assert.equal(q.limits(k, base).rpm, 3, 'lowered to the three answered calls');
  const H = new Headers({ 'x-ratelimit-limit-requests': '1000', 'x-ratelimit-limit-tokens': '12000', 'x-ratelimit-remaining-requests': '990', 'x-ratelimit-remaining-tokens': '9000' });
  for (let h = 1; h <= 7; h++) {
    T += 3600_000;
    q.learnHeaders(k, H);
  }
  const now = q.limits(k, base);
  assert.equal(now.rpm, 30, 'six hours after the 429 the per-minute limit is back, though headers kept arriving');
  assert.equal(now.tpm, 12000, "the header's own number is used as it is (higher than ours here)");
  // a token-per-minute 429 and an upstream 429 are not about requests a minute
  assert.equal(R.perMinuteLimit('Rate limit reached for model `openai/gpt-oss-120b` on tokens per minute (TPM): Limit 8000, Used 7000, Requested 2000. Please try again in 7.66s.'), false);
  assert.equal(R.perMinuteLimit('openrouter/free is temporarily rate-limited upstream. Please retry shortly.'), false);
  assert.equal(R.perMinuteLimit('rate limit exceeded: free-models-per-min'), true);
  const q2 = R.quotaFor(new MemStorage());
  for (let i = 0; i < 3; i++) q2.take(['openrouter'], 100)(100, true);
  q2.learn429('openrouter', 0, { perMinute: false });
  assert.equal(q2.learned('openrouter')?.rpm, undefined, 'an upstream limit leaves the key alone');
  // in the router: OpenRouter's upstream 429 does not lower the whole key
  const storage = new MemStorage();
  let n = 0;
  globalThis.fetch = async () => (++n === 2 ? new Response('{"error":{"message":"openrouter/free is temporarily rate-limited upstream. Please retry shortly."}}', { status: 429 }) : ok('openrouter/free'));
  const r = new R.Router(storage, vaultWith({ openrouter: 'k' }), { KEYLESS_MODELS: '0' });
  await r.complete([{ role: 'user', content: 'hi' }], [], undefined, { maxWaitMs: 0 });
  await r.complete([{ role: 'user', content: 'again' }], [], undefined, { maxWaitMs: 0 }).catch(() => null);
  assert.equal(R.quotaFor(storage).learned('openrouter')?.rpm, undefined);
});

test('a call running when the brain restarts is not "running" forever after (never saved); RE-CHECK clears it too', async () => {
  const st = new MemStorage();
  const q = R.quotaFor(st);
  q.take(['pollinations', 'pollinations|openai'], 500); // never settled: the brain restarts
  await q.flush();
  assert.ok(!JSON.stringify(st.m.get('llm:quota')).includes('"run"'), 'run is not saved');
  const st2 = new MemStorage();
  st2.m = new Map([...st.m].map(([k, v]) => [k, structuredClone(v)]));
  // an older save that still carries run
  st2.m.get('llm:quota').c.pollinations.run = 1;
  const q2 = R.quotaFor(st2);
  q2.now = () => Date.now() + 3 * 3600_000;
  await q2.load();
  assert.equal(q2.room('pollinations', { rpm: 2, gapMs: 30_000, conc: 1 }, 500, 'chat').ok, true, 'Pollinations is free again');
  q.forget();
  assert.equal(q.room('pollinations', { conc: 1 }, 500, 'chat').ok, true, 'RE-CHECK MODELS clears calls counted as running');
});

test('background work never waits for room it can never have: a request bigger than its share of a minute moves on at once', async () => {
  const q = R.quotaFor(new MemStorage());
  const L = { rpm: 30, tpm: 8000, rpd: 1000, tpd: 200_000 };
  assert.equal(q.room('groq|m', L, 6000, 'background').waitMs, Infinity, '6,000 tokens is over the background share (5,600)');
  assert.equal(q.room('groq|m', L, 6000, 'chat').ok, true);
  let calls = 0;
  globalThis.fetch = async (url, init) => (calls++, ok(JSON.parse(init.body).model));
  const r = new R.Router(new MemStorage(), vaultWith({ groq: 'g' }), { KEYLESS_MODELS: '0' });
  const big = 'word '.repeat(4300);
  const t0 = Date.now();
  const err = await r.complete([{ role: 'system', content: big }, { role: 'user', content: 'go' }], [], undefined, { priority: 'background', maxWaitMs: 2000 }).then(() => null, (e) => e);
  assert.ok(err && Date.now() - t0 < 500, `gave up at once, no sleeping (${Date.now() - t0} ms)`);
  assert.equal(calls, 0);
  assert.match((await r.complete([{ role: 'system', content: big }, { role: 'user', content: 'go' }], [], undefined, { maxWaitMs: 0 })).model, /^Groq/, 'the chat lane still fits');
});

test("background work out of free Workers AI room skips quietly: the owner's chat keeps the fallback brain", async () => {
  // Every keyless web model is down, so Workers AI is the only brain left.
  globalThis.fetch = async () => new Response('{"error":{"message":"down"}}', { status: 503 });
  const storage = new MemStorage();
  // Today's free Workers AI is mostly used: background work must leave 3,500, the owner's chat only 300.
  await storage.put('ai:neurons', { d: new Date().toISOString().slice(0, 10), used: 6600, by: { chat: 6600 } });
  const env = { AI: { run: async (model) => ({ response: `cf ${model}` }) } };
  const r = new R.Router(storage, vaultWith({}), env);
  const bg = await r.complete([{ role: 'user', content: 'study this' }], [], undefined, { priority: 'background', maxWaitMs: 0 }).then(() => null, (e) => e);
  assert.ok(bg, 'background work gives way');
  const chat = await r.complete([{ role: 'user', content: 'hello' }], [], undefined, { maxWaitMs: 0 }).catch((e) => ({ model: String(e?.message ?? e) }));
  assert.match(chat.model, /^Workers AI/, `the owner's chat still reaches Workers AI (got ${chat.model})`);
  assert.ok(!(await r.summary()).some((m) => m.provider === 'Workers AI' && m.state === 'cool'), 'no Workers AI model was cooled for an hour');
});
