// Using free AI sparingly: per-request tool selection, the keyless Workers AI provider,
// and waiting out short rate limits instead of failing.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { Router } = await import('./.build/llm/router.mjs');
const T = await import('./.build/tools/index.mjs');

class MemStorage {
  m = new Map();
  async get(k) { return this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
  async put(k, v) { this.m.set(k, structuredClone(v)); }
  async delete(k) { return this.m.delete(k); }
}
const noKeys = { get: async () => null, has: async () => false };
const msgs = [{ role: 'user', content: 'hello' }];

test('chat gets a small tool set; building gets the coding tools', () => {
  const names = (text, code = false, used = new Set()) => T.selectTools(text, used, code).map((t) => t.name);
  const hello = names('hello, how are you?');
  assert.ok(hello.includes('remember') && hello.includes('web_search'));
  assert.ok(!hello.includes('propose_change') && !hello.includes('set_reminder') && !hello.includes('study'));
  assert.ok(hello.length < T.TOOLS.length / 2, `chat offers ${hello.length} of ${T.TOOLS.length} tools`);
  assert.ok(names('remind me at 6 to call mum').includes('set_reminder'));
  assert.ok(names("what's the weather tomorrow").includes('weather'));
  assert.ok(names('play some jazz radio').includes('play_radio'));
  const game = names('build me a snake game', true);
  for (const n of ['create_widget', 'study', 'propose_change', 'repo_read_many', 'plan_upgrade']) assert.ok(game.includes(n), n);
  assert.ok(names('ship it').includes('ship_change'));
  assert.ok(names('ok thanks', false, new Set(['set_reminder'])).includes('list_scheduled'), 'a group in use stays on');
  const spec = JSON.stringify(T.toolSpecs(T.selectTools('hi', new Set(), false))).length;
  assert.ok(spec < JSON.stringify(T.toolSpecs()).length * 0.5, 'chat requests are far smaller');
});

test('Workers AI answers with no API key at all', async () => {
  const seen = [];
  const env = { AI: { run: async (model, input) => { seen.push({ model, input }); return { response: 'Hello from Cloudflare.' }; } } };
  const r = await new Router(new MemStorage(), noKeys, env).complete(msgs, []);
  assert.equal(r.message.content, 'Hello from Cloudflare.');
  assert.match(r.model, /^Workers AI · @cf\//);
  assert.equal(seen[0].input.messages[0].content, 'hello');
});

test('Workers AI tool calls are understood in every shape models use', async () => {
  const tools = [{ type: 'function', function: { name: 'weather', description: 'w', parameters: { type: 'object', properties: {} } } }];
  const shapes = [
    { tool_calls: [{ name: 'weather', arguments: { place: 'Leeds' } }] },
    { choices: [{ message: { content: null, tool_calls: [{ id: 'x', function: { name: 'weather', arguments: '{"place":"Leeds"}' } }] } }] },
    { response: '{"name": "weather", "parameters": {"place": "Leeds"}}' },
  ];
  for (const shape of shapes) {
    const env = { AI: { run: async () => shape } };
    const r = await new Router(new MemStorage(), noKeys, env).complete(msgs, tools);
    assert.equal(r.message.tool_calls[0].function.name, 'weather');
    assert.deepEqual(JSON.parse(r.message.tool_calls[0].function.arguments), { place: 'Leeds' });
  }
});

test('a short rate limit is waited out instead of failing the task', async () => {
  let calls = 0;
  const tried = new Set();
  const env = {
    AI: {
      run: async (model) => {
        calls++;
        if (!tried.has(model)) {
          tried.add(model); // every Workers AI model is rate-limited once
          throw new Error('429 rate limited, try again in 0.2s');
        }
        return { response: 'made it' };
      },
    },
    KEYLESS_MODELS: '0',
  };
  const storage = new MemStorage();
  const router = new Router(storage, noKeys, env);
  const t0 = Date.now();
  const r = await router.complete(msgs, [], undefined, { maxWaitMs: 70_000 }).catch((e) => e);
  assert.ok(!(r instanceof Error), String(r?.message));
  assert.equal(r.message.content, 'made it');
  // The model said "try again in 0.2s": that short wait is sat out and the same model asked once more, before any other model is tried.
  assert.ok(calls === 2 && tried.size === 1 && Date.now() - t0 >= 200, `waited for the stated 0.2 s, then asked the same model again (${calls} calls over ${Date.now() - t0} ms)`);
  // A wait too long to sit out (a minute) still means every model is tried once, then the soonest cool-down is waited for.
  calls = 0;
  tried.clear();
  env.AI.run = async (model) => {
    calls++;
    if (!tried.has(model)) {
      tried.add(model);
      throw new Error('429 rate limited, try again in 60s');
    }
    return { response: 'made it later' };
  };
  const r2 = await new Router(new MemStorage(), noKeys, env).complete(msgs, [], undefined, { maxWaitMs: 0 }).catch((e) => e);
  assert.ok(r2 instanceof Error && /frees up in about 6[0-9] seconds/.test(r2.message), String(r2?.message));
  assert.equal(calls, tried.size, 'each model once, no retry on a long wait');
});

test('daily allowance used up → a clear message, no endless waiting', async () => {
  const env = { AI: { run: async () => { throw new Error('You have used up your daily free allocation of 10,000 neurons'); } }, KEYLESS_MODELS: '0' };
  await assert.rejects(new Router(new MemStorage(), noKeys, env).complete(msgs, []), /busy or failing|cooling down/);
});
