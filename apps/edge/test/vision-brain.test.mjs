// The brain sees pictures: a message with a photo goes only to models that can look at it
// (text-only ones are skipped, and with none reachable the reason is plain), slimming a request
// keeps the photo and counts it as about 1,000 tokens, the vision regex knows the free
// providers' models, and the scripted model says when it was given a picture.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const B = process.env.VISION_BUILD ?? './.build';
const R = await import(`${B}/llm/router.mjs`);
const P = await import(`${B}/llm/providers.mjs`);

class MemStorage {
  m = new Map();
  async get(k) { return this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
  async put(k, v) { this.m.set(k, structuredClone(v)); }
  async delete(k) { return this.m.delete(k); }
}
const vaultWith = (keys) => ({ get: async (n) => keys[n] ?? null, has: async (n) => !!keys[n] });
const tool = (name, desc = 'x'.repeat(300)) => ({ type: 'function', function: { name, description: desc, parameters: { type: 'object', properties: {} } } });
const TOOLS = ['repo_read', 'propose_change', 'update_change', 'wait_for_checks', 'weather', 'play_radio', 'set_reminder', 'fly_to'].map((n) => tool(n));

/** A ~150 KB JPEG data URL, as the Lens sends one. */
const PHOTO = `data:image/jpeg;base64,/9j/${'A'.repeat(200_000)}`;
const withPhoto = (text) => ({ role: 'user', content: [{ type: 'text', text }, { type: 'image_url', image_url: { url: PHOTO } }] });

function fakeFetch(log, replies = {}) {
  return async (url, init) => {
    const body = JSON.parse(init.body);
    log.push({ url, model: body.model, messages: body.messages, size: init.body.length });
    if (replies[body.model] === 429) return new Response('{"error":{"message":"rate limit"}}', { status: 429 });
    return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: `hi from ${body.model}` } }] }), { headers: { 'content-type': 'application/json' } });
  };
}

test('visionScore: which models can look at a picture (and every earlier export is still there)', () => {
  const can = ['gemini-3.8-flash', 'gemini-2.5-flash-lite', 'meta-llama/llama-4-scout-17b-16e-instruct', '@cf/meta/llama-4-scout-17b-16e-instruct', 'pixtral-12b-2409', 'mistralai/mistral-small-3.2-24b-instruct:free', 'mistral-small-latest', 'mistral-medium-latest', 'google/gemma-3-27b-it:free', 'qwen/qwen2.5-vl-72b-instruct:free', 'gpt-4o-mini', 'gpt-4.1', 'gpt-5-mini', 'openai', 'claude-sonnet-4', 'llava-v1.6-34b', 'moondream-vision'];
  for (const id of can) assert.equal(P.visionScore(id), 1, id);
  const cannot = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'gpt-oss-120b', 'qwen/qwen3.8-27b', 'llama-3.3-70b', 'devstral-medium-latest', 'openrouter/free', '@cf/zai-org/glm-4.7-flash', 'deepseek-r1', 'kimi-k2', 'openai/whisper-large-v3', 'gemini-2.5-flash-image', 'gemini-2.5-flash-preview-tts', 'gpt-image-1', 'gemini-embedding-001'];
  for (const id of cannot) assert.equal(P.visionScore(id), 0, id);
  assert.ok(P.VISION.test('openai') && !P.VISION.test('openai/gpt-oss-20b'), "Pollinations' openai model counts; Groq's gpt-oss does not");
  for (const name of ['PROVIDERS', 'NOT_CHAT', 'cheapScore', 'codeScore', 'modelScore']) assert.ok(name in P, name);
  assert.ok(P.PROVIDERS.find((p) => p.id === 'pollinations').seed.every((m) => P.visionScore(m) === 1));
  assert.ok(P.PROVIDERS.find((p) => p.id === 'gemini').seed.every((m) => P.visionScore(m) === 1));
  assert.ok(P.PROVIDERS.find((p) => p.id === 'groq').seed.every((m) => P.visionScore(m) === 0));
});

test('a message with a picture goes only to models that can see it; text-only models are skipped, and the open endpoint is never given a picture', async () => {
  const log = [];
  const gemini = P.PROVIDERS.find((p) => p.id === 'gemini').seed;
  globalThis.fetch = fakeFetch(log, Object.fromEntries(gemini.map((m) => [m, 429])));
  const r = new R.Router(new MemStorage(), vaultWith({ gemini: 'g', groq: 'q', cerebras: 'c' }), {});
  // every Gemini model is rate-limited and there is no Workers AI here: the turn ends with the ordinary "busy" answer
  // rather than the photo going to Pollinations (an open endpoint with no account and shared cached answers)
  const err = await r.complete([withPhoto('What is this?')], TOOLS).then(() => null, (e) => String(e?.message ?? e));
  assert.ok(err, 'no answer');
  assert.match(err, /busy or failing/, err);
  assert.match(err, /frees up in about \d+ seconds/, err);
  assert.ok(!log.some((l) => /pollinations/.test(l.url)), 'the picture never went to the open endpoint');
  assert.ok(!log.some((l) => /groq|cerebras/.test(l.url)), 'gpt-oss and the other text-only models were never asked');
  assert.equal(log.filter((l) => /googleapis/.test(l.url)).length, gemini.length);
  const sent = log.at(-1).messages.at(-1).content;
  assert.ok(Array.isArray(sent) && sent[0].type === 'text' && sent[0].text === 'What is this?' && sent[1].image_url.url === PHOTO, 'the picture reaches the model as parts, text first');
  // a plain message afterwards uses every model again (Gemini is still cooling, so Groq answers)
  const chat = await r.complete([{ role: 'user', content: 'hello' }], TOOLS);
  assert.equal(chat.model, 'Groq · openai/gpt-oss-120b');
});

test('with no keys and no binding, text still falls back to the open endpoint, but a picture gets the "no vision model" answer instead', async () => {
  const log = [];
  globalThis.fetch = fakeFetch(log);
  const r = new R.Router(new MemStorage(), vaultWith({}), {});
  const t0 = Date.now();
  await assert.rejects(r.complete([withPhoto('what is this?')], []), /no vision model reachable: none of the models I can reach right now can look at a picture/);
  assert.ok(Date.now() - t0 < 2000, 'no waiting for rate limits');
  assert.equal(log.length, 0, 'nothing was asked: the open endpoint is not a place for a picture');
  const plain = await r.complete([{ role: 'user', content: 'hello' }], []);
  assert.equal(plain.model, 'Pollinations · openai', 'text is unaffected');
  assert.ok(!log.some((l) => l.messages.some((m) => Array.isArray(m.content))), 'nothing sent there carried a picture');
});

test('with only text-only models reachable, a picture turn fails at once with a clear reason', async () => {
  const log = [];
  globalThis.fetch = fakeFetch(log);
  const r = new R.Router(new MemStorage(), vaultWith({ groq: 'q', cerebras: 'c' }), { KEYLESS_MODELS: '0' });
  const t0 = Date.now();
  await assert.rejects(r.complete([withPhoto('what is this?')], []), /no vision model reachable: none of the models I can reach right now can look at a picture/);
  assert.ok(Date.now() - t0 < 2000, 'no waiting for rate limits');
  assert.equal(log.length, 0, 'nothing was asked');
  const plain = await r.complete([{ role: 'user', content: 'hello' }], []);
  assert.match(plain.model, /^Groq/, 'text is unaffected');
  // no keys at all: the usual "add a key" answer, not a vision one
  await assert.rejects(new R.Router(new MemStorage(), vaultWith({}), { KEYLESS_MODELS: '0' }).complete([withPhoto('x')], []), /Add a free Gemini or Groq key/);
});

test('a vision provider that is only cooling down is not reported as missing: the usual "frees up" answer, with a wait', async () => {
  const log = [];
  globalThis.fetch = fakeFetch(log);
  const r = new R.Router(new MemStorage(), vaultWith({ gemini: 'g' }), { KEYLESS_MODELS: '0' });
  // Gemini's day is used up (as the router records it after a per-day 429): every model that can see is cooling, none is missing
  await r.mark('cool|gemini', { cool: Date.now() + 3600_000, why: 'per day' });
  const err = await r.complete([withPhoto('what is this?')], []).then(() => null, (e) => String(e?.message ?? e));
  assert.ok(err, 'no answer while the only provider that can see is cooling');
  assert.ok(!/no vision model reachable/.test(err), `not "no vision model": ${err}`);
  assert.ok(!/Add a free Gemini/.test(err), `not "add a key" to an owner who has one: ${err}`);
  assert.match(err, /frees up in about/, 'the ordinary cooling-down answer, with the wait');
  assert.equal(log.length, 0, 'nothing was asked');
});

test('slimming a request to a small free tier keeps the picture and counts it as about 1,000 tokens', () => {
  const big = [{ role: 'system', content: 'S'.repeat(20000) }];
  for (let i = 0; i < 30; i++) big.push({ role: 'user', content: `q${i} ${'x'.repeat(2000)}` }, { role: 'assistant', content: `a${i}` });
  big.push(withPhoto('what is this?'));
  const s = R.slimToFit(big, TOOLS, 7000);
  assert.ok(s, 'fits');
  const last = s.messages.at(-1);
  assert.ok(Array.isArray(last.content) && last.content.some((p) => p.type === 'image_url' && p.image_url.url === PHOTO), 'the picture is still there');
  assert.equal(last.content[0].text, 'what is this?');
  // by characters the data URL would be ~55,000 tokens; as a picture it is ~1,000, so it fits a 1,200 budget and never an 800 one
  const alone = [withPhoto('what is this?')];
  assert.deepEqual(R.slimToFit(alone, [], 1200), { messages: alone, tools: [] });
  assert.equal(R.slimToFit(alone, [], 800), null);
});

test('content helpers: the text of parts, pictures stripped to a "[photo]" marker, nothing else touched', () => {
  assert.equal(R.textOf('hi'), 'hi');
  assert.equal(R.textOf(null), '');
  assert.equal(R.textOf(undefined), '');
  assert.equal(R.textOf([{ type: 'text', text: 'a' }, { type: 'image_url', image_url: { url: PHOTO } }, { type: 'text', text: 'b' }]), 'a\nb');
  assert.equal(R.imagesIn(withPhoto('x').content), 1);
  assert.equal(R.imagesIn('x'), 0);
  assert.ok(R.hasImage([{ role: 'system', content: 's' }, withPhoto('x')]) && !R.hasImage([{ role: 'user', content: 'x' }]));
  assert.deepEqual(R.withImages('look', ['data:image/png;base64,AA']), [{ type: 'text', text: 'look' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,AA' } }]);
  assert.equal(R.markPhotos('What is this?', 2), 'What is this? [photo] [photo]');
  assert.equal(R.markPhotos('plain', 0), 'plain');
  const reply = { role: 'assistant', content: 'A cat.' };
  const kept = R.stripImages([withPhoto('What is this?'), reply, { role: 'tool', tool_call_id: 'c1', content: 'result' }]);
  assert.deepEqual(kept[0], { role: 'user', content: 'What is this? [photo]' });
  assert.equal(kept[1], reply, 'text messages are the same objects');
  assert.ok(!JSON.stringify(kept).includes('base64'));
});

test('the scripted model (MOCK_LLM) says when it was given a picture, and still scripts everything else', async () => {
  const r = new R.Router(new MemStorage(), vaultWith({}), { MOCK_LLM: '1' });
  const seen = await r.complete([{ role: 'system', content: 'sys' }, withPhoto('What is this?')], []);
  assert.equal(seen.message.content, 'I can see a picture. What is this?');
  assert.equal(seen.model, 'Mock · scripted');
  const plain = await r.complete([{ role: 'user', content: 'remember the bins go out on Tuesday' }], [tool('remember')]);
  assert.equal(plain.message.tool_calls[0].function.name, 'remember');
  const after = await r.complete([withPhoto('What is this?'), { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'weather', arguments: '{}' } }] }, { role: 'tool', tool_call_id: 'c1', content: 'Sunny' }], []);
  assert.equal(after.message.content, 'Done. Sunny', 'a tool result after a photo is read as text, not as "[object Object]"');
});
