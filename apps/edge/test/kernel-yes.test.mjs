// BRIEF-KERNEL-YES (OWNER-ISSUES 173): the turn's reads together, replies streamed with the polish per sentence, the brain choosing
// the picture. Run from router.test.mjs (package.json is protected, so no new file in the test list).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

const mod = await import('./.build/brain.mjs');
const { GhostyAgent } = mod;

const OWNER_KEY = 'test-owner-key-0123456789abcdef';

/** A store that charges `ms` for every call and logs when each read began and ended. */
class SlowStorage {
  m = new Map();
  ms = 0;
  log = [];
  async wait() {
    if (this.ms) await new Promise((r) => setTimeout(r, this.ms));
  }
  async get(k) {
    const at = performance.now();
    await this.wait();
    this.log.push({ k: Array.isArray(k) ? k.join(',') : k, from: at, to: performance.now() });
    if (Array.isArray(k)) return new Map(k.filter((x) => this.m.has(x)).map((x) => [x, structuredClone(this.m.get(x))]));
    return this.m.has(k) ? structuredClone(this.m.get(k)) : undefined;
  }
  async put(k, v) {
    await this.wait();
    if (typeof k === 'object') for (const [a, b] of Object.entries(k)) this.m.set(a, structuredClone(b));
    else this.m.set(k, structuredClone(v));
  }
  async delete(k) {
    await this.wait();
    if (Array.isArray(k)) return k.filter((x) => this.m.delete(x)).length;
    return this.m.delete(k);
  }
  async list({ prefix = '' } = {}) {
    await this.wait();
    return new Map([...this.m].filter(([k]) => k.startsWith(prefix)).sort().map(([k, v]) => [k, structuredClone(v)]));
  }
  async setAlarm() {}
  async getAlarm() { return null; }
}

function brain(extraEnv = {}) {
  const pending = [];
  const storage = new SlowStorage();
  const state = { storage, waitUntil: (p) => pending.push(p), blockConcurrencyWhile: (f) => f() };
  const env = { OWNER_KEY, VAULT_KEY: Buffer.from(webcrypto.getRandomValues(new Uint8Array(32))).toString('base64'), OWNER_EMAIL: 'me@example.com', ...extraEnv };
  let agent;
  env.AGENT = { idFromName: (n) => n, get: () => ({ fetch: (r) => (agent ??= new GhostyAgent(state, env)).fetch(r) }) };
  const turn = async (message, { stream = false, onEvent } = {}) => {
    const t0 = performance.now();
    const r = await mod.default.fetch(new Request('https://ghosty.test/api/chat', { method: 'POST', headers: { 'content-type': 'application/json', 'x-ghosty': '1', 'x-ghosty-key': OWNER_KEY }, body: JSON.stringify({ message, ...(stream ? { stream: true } : {}) }) }), env, { waitUntil: (p) => pending.push(p), passThroughOnException() {} });
    const events = [];
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        const ev = JSON.parse(line);
        events.push({ ...ev, at: performance.now() - t0 });
        onEvent?.(ev, performance.now() - t0);
      }
    }
    await Promise.allSettled(pending.splice(0));
    return events;
  };
  return { storage, env, turn };
}

const overlap = (a, b) => Math.max(a.from, b.from) < Math.min(a.to, b.to);

test('kernel 1: the turn starts with its reads side by side, and each step reads memory, profile and inbox together', async () => {
  const b = brain({ MOCK_LLM: '1' });
  await b.turn('hello there'); // the first turn seeds things; the second is the steady one
  b.storage.ms = 1;
  b.storage.log.length = 0;
  const ev = await b.turn('hello there');
  assert.ok(ev.find((e) => e.t === 'text'), 'the hello turn speaks');
  const reads = (k) => b.storage.log.filter((l) => l.k === k);
  const together = (...keys) => {
    for (const x of reads(keys[0])) for (const y of reads(keys[1])) for (const z of reads(keys[2])) if (overlap(x, y) && overlap(y, z) && overlap(x, z)) return true;
    return false;
  };
  for (const k of ['principles', 'lessons', 'mood', 'memory', 'profile', 'inbox']) assert.ok(reads(k).length, `${k} was read`);
  // the prelude: principles, lessons and mood are asked at the same moment; the step: memory, profile and the inbox likewise
  assert.ok(together('principles', 'lessons', 'mood'), 'principles, lessons and mood overlap in time');
  assert.ok(together('memory', 'profile', 'inbox'), 'memory, profile and inbox overlap in time');
});

/** A server-sent stream of chat-completions chunks: `parts` are [delay before it, delta] pairs. */
function sse(parts, finish = {}) {
  const enc = new TextEncoder();
  return new Response(
    new ReadableStream({
      async start(c) {
        for (const [wait, delta] of parts) {
          if (wait) await new Promise((r) => setTimeout(r, wait));
          c.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`));
        }
        c.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }], ...finish })}\n\n`));
        c.enqueue(enc.encode('data: [DONE]\n\n'));
        c.close();
      },
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  );
}

const realFetch = globalThis.fetch;
const modelsOnly = (url) => (String(url).endsWith('/models') ? new Response(JSON.stringify({ data: [] }), { headers: { 'content-type': 'application/json' } }) : null);

test('kernel 2: a reply streams from its first sentence, polished per sentence, and the whole lands equal to the polished whole', async () => {
  const sent = [];
  globalThis.fetch = async (url, init) => {
    const m = modelsOnly(url);
    if (m) return m;
    const body = JSON.parse(init.body);
    sent.push(body);
    // three sentences, 100 ms apart; the first opens with a stock phrase the persona's polish removes
    return sse([
      [0, { content: 'Certainly! The kettle is on.' }],
      [0, { content: ' ' }],
      [100, { content: 'The tea is brewing now.' }],
      [0, { content: ' ' }],
      [100, { content: 'Biscuits are on the side.' }],
    ]);
  };
  try {
    const b = brain({ GEMINI_KEY: 'g-test' });
    const ev = await b.turn('what is happening in the kitchen', { stream: true });
    assert.ok(sent.length && sent[0].stream === true, 'the provider was asked to stream');
    const texts = ev.filter((e) => e.t === 'text');
    const parts = texts.filter((e) => e.part);
    const whole = texts.filter((e) => !e.part);
    assert.equal(whole.length, 1, 'one whole reply at the end');
    assert.ok(parts.length >= 2, `a delta per finished sentence (${parts.length})`);
    const secondSentenceSent = ev.find((e) => e.t === 'text' && e.part && /tea is brewing/.test(e.text));
    assert.ok(parts[0].at < secondSentenceSent.at, 'the first words arrive before the second sentence');
    assert.ok(secondSentenceSent.at - parts[0].at >= 60, `and well before it (the model spoke it 100 ms later): ${JSON.stringify(parts.map((p) => [Math.round(p.at), p.text]))}`);
    assert.ok(!/Certainly/.test(parts[0].text), 'the first sentence was polished before it was sent');
    assert.equal(whole[0].text, 'The kettle is on. The tea is brewing now. Biscuits are on the side.', 'the final text is the polished whole');
    assert.ok(ev.findIndex((e) => e.t === 'done') > ev.indexOf(whole[0]), 'done follows the whole');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('kernel 2: a provider that answers plain JSON still answers; a reply that turns to a tool keeps no streamed words', async () => {
  let n = 0;
  globalThis.fetch = async (url, init) => {
    const m = modelsOnly(url);
    if (m) return m;
    n++;
    JSON.parse(init.body);
    if (n === 1) return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'Plain and whole.' } }] }), { headers: { 'content-type': 'application/json' } });
    if (n === 2) {
      // words first, then a tool call: nothing of the words may stay on screen
      return sse([
        [0, { content: 'Let me look that up for you. ' }],
        [50, { tool_calls: [{ index: 0, id: 'c1', function: { name: 'list_memory', arguments: '{}' } }] }],
      ]);
    }
    return sse([[0, { content: 'It is the time.' }]]);
  };
  try {
    const b = brain({ GEMINI_KEY: 'g-test' });
    const a = await b.turn('what is happening in the kitchen', { stream: true });
    const t = a.filter((e) => e.t === 'text');
    assert.deepEqual(t.map((e) => e.text), ['Plain and whole.'], 'no deltas from a provider that does not stream');
    assert.ok(!t.some((e) => e.part));
    const c = await b.turn('what do you remember about me', { stream: true });
    const texts = c.filter((e) => e.t === 'text');
    const last = texts.at(-1);
    assert.ok(!last.part && last.text === 'It is the time.', JSON.stringify(texts));
    // anything streamed before the tool call was taken back by an empty whole text before the tool ran
    const tool = c.findIndex((e) => e.t === 'tool');
    const streamedBefore = c.slice(0, tool).filter((e) => e.t === 'text');
    if (streamedBefore.some((e) => e.part && e.text)) assert.ok(streamedBefore.some((e) => !e.part && e.text === ''), 'streamed words before a tool call are taken back');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('kernel 2: the stopwatch reads the first word from the first delta, not from the whole reply', async () => {
  const R = await import('./.build/llm/router.mjs');
  const storage = new SlowStorage();
  globalThis.fetch = async (url) => {
    const m = modelsOnly(url);
    if (m) return m;
    return sse([
      [150, { content: 'First words here. ' }],
      [350, { content: 'And the rest of it.' }],
    ]);
  };
  try {
    const router = new R.Router(storage, { get: async (n) => (n === 'gemini' ? 'g' : null), has: async (n) => n === 'gemini' }, {});
    const got = [];
    const r = await router.complete([{ role: 'user', content: 'hi' }], [], undefined, { onDelta: (t) => got.push(t) });
    assert.equal(r.message.content, 'First words here. And the rest of it.');
    assert.deepEqual(got, ['First words here. ', 'And the rest of it.']);
    const sum = await R.speedSummary(storage);
    const first = sum.today.providers[0].firstToken;
    const whole = sum.today.providers[0].total;
    assert.ok(first >= 120 && first < 300, `first word ${first} ms (the first delta at 150)`);
    assert.ok(whole >= 450, `done ${whole} ms`);
  } finally {
    globalThis.fetch = realFetch;
  }
});

// BRIEF-KERNEL-YES 4: the brain names the picture; the phone's Stage draws that kind (the browser case is in showme.spec).
test('kernel 4: the brain names the kind of picture when the turn makes it plain, and nothing for a plain sentence', async () => {
  const { build } = await import('esbuild');
  const here = (p) => new URL(p, import.meta.url).pathname;
  await build({ entryPoints: [here('../src/showme.ts')], bundle: true, format: 'esm', platform: 'neutral', outfile: here('./.build/showme.mjs'), logLevel: 'warning' });
  const { brainShow } = await import('./.build/showme.mjs');
  const pick = (ask, reply, clients = []) => brainShow({ ask, reply, clients });
  assert.equal(pick('hello', 'Hello there, how are you getting on today?'), null);
  assert.equal(pick('what is a kettle', 'A kettle is a pot for boiling water.'), null);
  assert.deepEqual(pick('where is the gym', 'It is on Mill Road.', [{ name: 'show_map', args: { place: 'Gym', lat: 52.2, lon: 0.12 } }]), { t: 'show', kind: 'place', data: { label: 'Gym', lat: 52.2, lon: 0.12, screen: true } });
  assert.equal(pick('how do I get to Leeds', 'By train.', [{ name: 'show_journey', args: {} }]).kind, 'route');
  const numbers = pick('how was my year', 'Jan £120, Feb £95, Mar £140, Apr £110');
  assert.equal(numbers.kind, 'numbers');
  assert.deepEqual(numbers.data.points.map((p) => p.value), [120, 95, 140, 110]);
  assert.equal(numbers.data.line, true);
  const letter = pick('write a letter to my landlord about the damp', 'Dear Mr Hale,\n\nThe flat has had damp in the bedroom since March and I would like it seen to.\n\nYours sincerely,\nA tenant');
  assert.equal(letter.kind, 'document');
  assert.equal(letter.data.letter, true);
  assert.equal(pick('how far would a ball go if I threw it at 20 m/s at 40 degrees', 'About 40 m.').kind, 'formula');
  assert.deepEqual(pick('show me a desk 140 by 70', 'Here is a desk.').data, { room: false, things: ['desk'] });
  assert.equal(pick('show me a room 4 by 3 with a sofa and a bed', 'Here is the room.').data.room, true);
  assert.equal(pick('where can I buy a desk', 'Try a shop.'), null, 'a buying question shows no part');
  // whatever it says never carries a position the brain was not given: no live GPS exists on this side
  assert.ok(!JSON.stringify(brainShow({ ask: 'where am I', reply: 'You are at home.', clients: [] }) ?? '').includes('lat'));
});

test('kernel 4: a turn whose reply holds figures ends with one show event before done; a greeting sends none', async () => {
  globalThis.fetch = async (url, init) => {
    const m = modelsOnly(url);
    if (m) return m;
    const body = JSON.parse(init.body);
    const said = JSON.stringify(body.messages.at(-1));
    const content = /my year/.test(said) ? 'Jan £120, Feb £95, Mar £140, Apr £110' : 'The kettle is on and the tea is brewing.';
    return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content } }] }), { headers: { 'content-type': 'application/json' } });
  };
  try {
    const b = brain({ GEMINI_KEY: 'g-test' });
    const a = await b.turn('how was my year');
    const shows = a.filter((e) => e.t === 'show');
    assert.equal(shows.length, 1);
    assert.equal(shows[0].kind, 'numbers');
    assert.ok(a.findIndex((e) => e.t === 'show') > a.findIndex((e) => e.t === 'text') && a.findIndex((e) => e.t === 'show') < a.findIndex((e) => e.t === 'done'), 'after the text, before done');
    const c = await b.turn('what is happening in the kitchen');
    assert.equal(c.filter((e) => e.t === 'show').length, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});
