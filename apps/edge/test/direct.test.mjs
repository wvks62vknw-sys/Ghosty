// Never useless: when every model is cooling down or failing, a simple ask still gets an answer
// made with no AI at all — the local time, or one read-only tool's raw text (the weather here or
// in a place, the agenda, what Ghosty remembers) — with the exact local time the first model is
// back; anything else gets that time plus the one tip. In the chat, while the database is
// paused, in a scheduled task, and through the scripted model's "no model:" phrase (the browser
// spec's way in). The models are faked: every one answers 429 "come back in two minutes".
import { test } from 'node:test';
import assert from 'node:assert/strict';

const brain = await import('./.build/brain.mjs');
const D = await import('./.build/direct.mjs');

const OWNER = 'owner-key-for-tests-0123456789';
const quota = () => {
  throw new Error('Exceeded allowed rows read in Durable Objects free tier.');
};

class MemStorage {
  m = new Map();
  down = false;
  async get(k) {
    if (this.down) quota();
    if (Array.isArray(k)) return new Map(k.filter((x) => this.m.has(x)).map((x) => [x, structuredClone(this.m.get(x))]));
    return this.m.has(k) ? structuredClone(this.m.get(k)) : undefined;
  }
  async put(k, v) {
    if (this.down) quota();
    if (typeof k === 'object') for (const [a, b] of Object.entries(k)) this.m.set(a, structuredClone(b));
    else this.m.set(k, structuredClone(v));
  }
  async delete(k) {
    if (this.down) quota();
    return Array.isArray(k) ? k.filter((x) => this.m.delete(x)).length : this.m.delete(k);
  }
  async list({ prefix = '' } = {}) {
    if (this.down) quota();
    return new Map([...this.m].filter(([x]) => x.startsWith(prefix)));
  }
  async setAlarm() {}
  async getAlarm() {
    return null;
  }
}

/** Every model is rate-limited for two minutes; the weather services answer; nothing else exists. */
function fakeWorld() {
  const sent = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (/chat\/completions/.test(url)) {
      sent.push({ url, body: JSON.parse(init.body) });
      return new Response('{"error":{"message":"rate limit"}}', { status: 429, headers: { 'retry-after': '120' } });
    }
    if (/geocoding-api\.open-meteo\.com/.test(url)) return new Response(JSON.stringify({ results: [{ name: 'Leeds', country: 'United Kingdom', latitude: 53.8, longitude: -1.55 }] }), { headers: { 'content-type': 'application/json' } });
    if (/air-quality-api\.open-meteo\.com/.test(url)) return new Response('{}', { status: 500 });
    if (/api\.open-meteo\.com\/v1\/forecast/.test(url)) {
      return new Response(JSON.stringify({ current: { temperature_2m: 12, apparent_temperature: 10, weather_code: 3, wind_speed_10m: 14, relative_humidity_2m: 80 }, daily: { time: ['2026-10-17'], temperature_2m_max: [14], temperature_2m_min: [8], precipitation_probability_max: [20], weather_code: [3] } }), { headers: { 'content-type': 'application/json' } });
    }
    return new Response('not faked', { status: 599 });
  };
  return { sent, restore: () => (globalThis.fetch = real) };
}

const newAgent = (storage, env = {}) => {
  const pending = [];
  const agent = new brain.GhostyAgent({ storage, waitUntil: (p) => pending.push(p), blockConcurrencyWhile: (f) => f() }, { VAULT_KEY: Buffer.alloc(32, 7).toString('base64'), ...env });
  const call = async (path, init = {}) => {
    const r = await agent.fetch(new Request(`https://ghosty.test/api${path}`, { ...init, headers: { 'x-ghosty-key': OWNER, ...(init.headers ?? {}) } }));
    const text = await r.text();
    await Promise.allSettled(pending.splice(0));
    return new Response(text, { status: r.status });
  };
  return { agent, call };
};
const events = async (r) => (await r.text()).trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
const said = (ev) => ev.find((e) => e.t === 'text')?.text ?? '';
const CTX = { tz: 'Europe/London', location: { name: 'Birmingham', lat: 52.48, lon: -1.9 } };

test("directPlan: the owner's words to one read-only tool with sensible arguments, or the time; only when something can answer", () => {
  const here = { location: { name: 'Birmingham', lat: 52.48, lon: -1.9 } };
  assert.deepEqual(D.directPlan('what time is it?', {}), { kind: 'time' });
  assert.deepEqual(D.directPlan("what's the date today", {}), { kind: 'time' });
  assert.deepEqual(D.directPlan('is it going to rain?', here), { kind: 'tool', name: 'weather', args: { lat: 52.48, lon: -1.9 } });
  assert.deepEqual(D.directPlan('weather in Leeds tomorrow', here), { kind: 'tool', name: 'weather', args: { place: 'leeds' } }, 'a named place wins over the owner\'s own');
  assert.deepEqual(D.directPlan("what's the forecast for the morning", here), { kind: 'tool', name: 'weather', args: { lat: 52.48, lon: -1.9 } }, '"the morning" is not a place');
  assert.equal(D.directPlan('is it going to rain?', {}), null, 'no place known: nothing to look up');
  assert.deepEqual(D.directPlan('what do you remember about me', {}), { kind: 'tool', name: 'list_memory', args: {} });
  assert.deepEqual(D.directPlan("what's on my agenda today", {}), { kind: 'tool', name: 'list_agenda', args: { days: 1 } });
  assert.deepEqual(D.directPlan('any plans for tomorrow?', {}), { kind: 'tool', name: 'list_agenda', args: { days: 2 } });
  assert.deepEqual(D.directPlan('what meetings do i have this week', {}), { kind: 'tool', name: 'list_agenda', args: { days: 7 } });
  assert.deepEqual(D.directPlan('next bus near me', here), { kind: 'tool', name: 'transit_now', args: { lat: 52.48, lon: -1.9, place: 'Birmingham' } });
  assert.deepEqual(D.directPlan('buses near new street', here), { kind: 'tool', name: 'transit_now', args: { place: 'new street' } });
  assert.deepEqual(D.directPlan("how's the traffic on the M6", here), { kind: 'tool', name: 'motorway_now', args: { lat: 52.48, lon: -1.9, place: 'Birmingham' } });
  assert.equal(D.directPlan('any trams near me', {}), null, 'no place known');
  assert.equal(D.directPlan('tell me a joke', here), null);
  assert.equal(D.directPlan(`write me a long essay about the weather in literature ${'x'.repeat(240)}`, here), null, 'a long message is a conversation');
  assert.equal(D.directPlan("what's the news", here), null, 'the news is the Brief tab, not a tool');
});

test('the no-model line carries the exact local time the first model is back (and the day when it is not today), and the tip', () => {
  const now = Date.UTC(2026, 9, 17, 13, 5); // 14:05 in London (summer time)
  const london = { tz: 'Europe/London' };
  assert.equal(D.backAt(40_000, london, now), '14:05');
  assert.equal(D.backAt(2 * 3600_000, london, now), '16:05');
  assert.equal(D.backAt(12 * 3600_000, london, now), '02:05 Sun 18 Oct');
  assert.equal(D.backAt(null, london, now), '');
  assert.equal(D.backAt(Infinity, {}, now), '');
  assert.equal(D.backAt(5_000, {}, now), '13:05', 'no time zone known: UTC');
  assert.equal(D.noModelLine(40_000, london, now), 'No AI model is free right now (the first is back at 14:05).');
  assert.equal(D.noModelLine(null, {}, now), 'No AI model is free right now.');
  assert.equal(D.localTimeAnswer(london, now), 'It is Sat 17 Oct 2026, 14:05 (Europe/London).');
  assert.equal(D.directReply('L.', ' raw \n'), 'L. The raw answer:\nraw');
  assert.equal(
    D.noModelMessage('Every model I can reach is cooling down after rate limits. The first one frees up in about 40 seconds. Another free key in the System tab gives me more room.', 40_000, london, now),
    'Every model I can reach is cooling down after rate limits. The first one frees up in about 40 seconds. The first model is back at 14:05. Tip: a free key in SYSTEM (Groq, Cerebras or NVIDIA) means never waiting.',
  );
  assert.equal(D.noModelMessage('No AI model is available. Add a free Gemini or Groq key in the System tab.', Infinity, london, now), 'No AI model is available. Add a free Gemini or Groq key in the System tab. Tip: a free key in SYSTEM (Groq, Cerebras or NVIDIA) means never waiting.');
  assert.equal(D.waitOf(Object.assign(new Error('x'), { waitMs: 5 })), 5);
  assert.equal(D.waitOf(Object.assign(new Error('x'), { waitMs: Infinity })), null);
  assert.equal(D.waitOf(new Error('x')), null);
  assert.equal(D.waitOf(null), null);
});

test('in the chat with every model rate-limited: the time, the weather here or in a place, memory and the agenda are answered with no model, with the time the first model is back', async () => {
  const world = fakeWorld();
  try {
    const storage = new MemStorage();
    const a = newAgent(storage, { GROQ_KEY: 'gsk_x', KEYLESS_MODELS: '0' });
    await a.call('/memory', { method: 'POST', body: JSON.stringify({ text: 'my dog is Rex' }) });
    const ask = async (message) => events(await a.call('/chat', { method: 'POST', body: JSON.stringify({ message, context: CTX }) }));
    let ev = await ask('what time is it?');
    let t = said(ev);
    assert.match(t, /^No AI model is free right now \(the first is back at \d\d:\d\d\)\. The raw answer:\nIt is \w{3} \d{1,2} \w{3} \d{4}, \d\d:\d\d \(Europe\/London\)\.$/, t);
    assert.equal(ev.find((e) => e.t === 'done')?.model, 'Direct · no AI');
    assert.ok(!ev.some((e) => e.t === 'tool'), 'the time needs no tool');
    assert.ok(world.sent.length >= 1, 'the models were asked first');
    ev = await ask('is it going to rain?');
    const tool = ev.find((e) => e.t === 'tool');
    assert.equal(tool?.name, 'weather');
    assert.deepEqual(tool.args, { lat: 52.48, lon: -1.9 }, "the owner's own coordinates");
    assert.ok(ev.find((e) => e.t === 'tool_result')?.ok, 'the tool ran');
    assert.match(said(ev), /\(the first is back at \d\d:\d\d\)\. The raw answer:\n.*now 12°C \(feels 10°C\)/);
    ev = await ask('weather in Leeds');
    assert.deepEqual(ev.find((e) => e.t === 'tool')?.args, { place: 'leeds' });
    assert.match(said(ev), /Leeds, United Kingdom: now 12°C/);
    ev = await ask('what do you remember about me?');
    assert.equal(ev.find((e) => e.t === 'tool')?.name, 'list_memory');
    assert.match(said(ev), /The raw answer:\n[a-z0-9]+: my dog is Rex$/);
    ev = await ask("what's on my agenda today?");
    assert.equal(ev.find((e) => e.t === 'tool')?.name, 'list_agenda');
    assert.match(said(ev), /The raw answer:\nAgenda for 1 day\(s\) from /);
    // the history keeps the answers, and the stored conversation stays valid (no tool message without its call)
    const h = await (await a.call('/history')).json();
    assert.equal(h.turns.at(-1).model, 'Direct · no AI');
    assert.match(h.turns.at(-1).text, /^No AI model is free right now/);
    assert.ok(storage.m.get('ctx').every((m) => m.role !== 'tool'));
  } finally {
    world.restore();
  }
});

test('anything else gets the usual message, always with the exact time the first model is back and the key tip', async () => {
  const world = fakeWorld();
  try {
    const a = newAgent(new MemStorage(), { GROQ_KEY: 'gsk_x', KEYLESS_MODELS: '0' });
    const ev = await events(await a.call('/chat', { method: 'POST', body: JSON.stringify({ message: 'tell me a joke', context: CTX }) }));
    const err = ev.find((e) => e.t === 'error')?.message ?? '';
    assert.match(err, /cooling down|busy or failing/);
    assert.match(err, /frees up in about 1\d\d seconds/);
    assert.match(err, /The first model is back at \d\d:\d\d\. Tip: a free key in SYSTEM \(Groq, Cerebras or NVIDIA\) means never waiting\.$/, err);
    assert.ok(!ev.some((e) => e.t === 'text'));
  } finally {
    world.restore();
  }
});

test('while the database is paused and no model answers: the time, memory and the agenda from the device, and the weather here, are still answered', async () => {
  const world = fakeWorld();
  try {
    const storage = new MemStorage();
    storage.down = true;
    const a = newAgent(storage, { GROQ_KEY: 'gsk_x', KEYLESS_MODELS: '0' });
    const ask = async (message) => events(await a.call('/chat', { method: 'POST', body: JSON.stringify({ message, context: CTX, offline: { facts: ['Ghost lives in Birmingham', 'my dog is Rex'], agenda: ['Sat 17 Oct 18:00 · Dinner with Sam'] } }) }));
    let ev = await ask('what time is it');
    assert.match(said(ev), /paused until it resets at midnight UTC[\s\S]*No AI model is free right now \(the first is back at \d\d:\d\d\)\. The raw answer:\nIt is /);
    assert.equal(ev.find((e) => e.t === 'done')?.model, 'Direct · no AI · memory paused');
    ev = await ask('what do you remember about me');
    assert.match(said(ev), /The raw answer:\nGhost lives in Birmingham\nmy dog is Rex$/);
    ev = await ask("what's on my agenda today");
    assert.match(said(ev), /The raw answer:\nSat 17 Oct 18:00 · Dinner with Sam$/);
    ev = await ask('is it raining');
    assert.equal(ev.find((e) => e.t === 'tool')?.name, 'weather');
    assert.match(said(ev), /now 12°C/);
    ev = await ask('tell me a joke');
    assert.match(ev.find((e) => e.t === 'error')?.message ?? '', /No AI model answered either \(the first is back at \d\d:\d\d\)\. Give Ghosty an AI key once/);
  } finally {
    world.restore();
  }
});

test('a scheduled task that needs no model (the weather here) still reports its raw answer when every model is cooling', async () => {
  const world = fakeWorld();
  try {
    const storage = new MemStorage();
    const a = newAgent(storage, { GROQ_KEY: 'gsk_x', KEYLESS_MODELS: '0' });
    await events(await a.call('/chat', { method: 'POST', body: JSON.stringify({ message: 'what time is it', context: CTX }) })); // the brain learns where the owner is
    const j = await (await a.call('/jobs', { method: 'POST', body: JSON.stringify({ kind: 'task', title: 'Morning weather', text: "what's the weather like this morning", at: Date.now() + 60_000, tz: 'Europe/London' }) })).json();
    const r = await (await a.call(`/jobs/${j.job.id}/run`, { method: 'POST' })).json();
    assert.match(r.item?.text ?? JSON.stringify(r), /^No AI model is free right now \(the first is back at \d\d:\d\d\)\. The raw answer:\n[\s\S]*now 12°C/);
    const j2 = await (await a.call('/jobs', { method: 'POST', body: JSON.stringify({ kind: 'task', title: 'Poem', text: 'write me a poem about autumn, three stanzas', at: Date.now() + 60_000, tz: 'Europe/London' }) })).json();
    const r2 = await (await a.call(`/jobs/${j2.job.id}/run`, { method: 'POST' })).json();
    assert.match(r2.error ?? '', /cooling down|busy or failing/, 'a task only a model can do fails honestly');
  } finally {
    world.restore();
  }
});

test('the scripted model\'s "no model:" phrase drives the same path (the browser spec\'s way in)', async () => {
  const a = newAgent(new MemStorage(), { MOCK_LLM: '1' });
  const ask = async (message) => events(await a.call('/chat', { method: 'POST', body: JSON.stringify({ message, context: CTX }) }));
  assert.match(said(await ask('no model: what time is it')), /^No AI model is free right now \(the first is back at \d\d:\d\d\)\. The raw answer:\nIt is /);
  const err = (await ask('no model: tell me a joke')).find((e) => e.t === 'error')?.message ?? '';
  assert.match(err, /^Every model I can reach is cooling down after rate limits\. The first one frees up in about 40 seconds\. The first model is back at \d\d:\d\d\. Tip: a free key in SYSTEM \(Groq, Cerebras or NVIDIA\) means never waiting\.$/, err);
  assert.match(said(await ask('hello')), /^Mock reply to: hello/, 'an ordinary turn is unaffected');
});
