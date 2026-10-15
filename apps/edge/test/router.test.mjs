// Model routing: best coders first for code, small free allowances kept for code,
// the keyless Workers AI fallback, and requests slimmed to fit small free tiers.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const R = await import('./.build/llm/router.mjs');

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
  const r = new R.Router(new MemStorage(), vaultWith({ gemini: 'g', groq: 'q', github: 'gh' }), {});
  const out = await r.complete([{ role: 'system', content: 'sys' }, { role: 'user', content: 'add a tab' }], TOOLS, undefined, { code: true });
  assert.match(out.model, /GitHub Models · openai\/gpt-4\.1$/, out.model);
  const chat = await r.complete([{ role: 'user', content: 'hello' }], TOOLS);
  assert.match(chat.model, /^Gemini/, 'chat keeps the owner\'s provider order');
  assert.ok(!log.slice(1).some((l) => l.url.includes('models.github.ai')), 'GitHub Models is never spent on chat');
});

test('rate-limited coders fall through to the next best', async () => {
  const log = [];
  globalThis.fetch = fakeFetch(log, { 'openai/gpt-4.1': 429, 'deepseek/DeepSeek-V3-0324': 429 });
  const r = new R.Router(new MemStorage(), vaultWith({ gemini: 'g', github: 'gh' }), {});
  const out = await r.complete([{ role: 'user', content: 'fix the bug' }], TOOLS, undefined, { code: true });
  assert.match(out.model, /gemini-2\.5-flash|gpt-4\.1-mini/, out.model);
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

test('without a binding and without keys, the error says what to do', async () => {
  const r = new R.Router(new MemStorage(), vaultWith({}), {});
  await assert.rejects(r.complete([{ role: 'user', content: 'x' }], TOOLS), /Add a free Gemini or Groq key/);
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
