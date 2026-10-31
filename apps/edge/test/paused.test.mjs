// Everything that keeps working while the brain's database is paused (Cloudflare's free daily
// allowance used up): keys from the device's encrypted copy, keys saved while paused, tools.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const brain = await import('./.build/brain.mjs');

const OWNER = 'owner-key-for-tests-0123456789';
const quota = () => {
  throw new Error('Exceeded allowed rows read in Durable Objects free tier.');
};

class MemStorage {
  m = new Map();
  down = false;
  async get(k) {
    if (this.down) quota();
    return this.m.has(k) ? structuredClone(this.m.get(k)) : undefined;
  }
  async put(k, v) {
    if (this.down) quota();
    this.m.set(k, structuredClone(v));
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
  get sql() {
    return { exec: quota, databaseSize: 0 };
  }
}

/** Fake AI providers: records which key each chat call used. */
function fakeAI(reply = 'Hello from the AI.') {
  const sent = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (/chat\/completions/.test(url)) {
      const h = init.headers ?? {};
      sent.push({ url, auth: String(h.Authorization ?? h.authorization ?? ''), body: JSON.parse(init.body) });
      return new Response(JSON.stringify({ choices: [{ message: typeof reply === 'function' ? reply(sent.length) : { role: 'assistant', content: reply } }] }), { headers: { 'content-type': 'application/json' } });
    }
    return new Response('not faked', { status: 599 });
  };
  return { sent, restore: () => (globalThis.fetch = real) };
}

const newAgent = (storage, env = {}) => {
  const pending = [];
  const agent = new brain.GhostyAgent({ storage, waitUntil: (p) => pending.push(p), blockConcurrencyWhile: (f) => f() }, { VAULT_KEY: Buffer.alloc(32, 7).toString('base64'), ...env });
  const call = async (path, init = {}, extra = {}) => {
    const r = await agent.fetch(new Request(`https://ghosty.test/api${path}`, { ...init, headers: { 'x-ghosty-key': OWNER, ...extra, ...(init.headers ?? {}) } }));
    // read the whole answer (chat streams while it works), then let background work finish
    const text = await r.text();
    await Promise.allSettled(pending.splice(0));
    return new Response(text, { status: r.status });
  };
  return { agent, call };
};
const events = async (r) => (await r.text()).trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));

test('keys given once are used while the database is paused, from the encrypted copy on the device', async () => {
  const ai = fakeAI();
  try {
    const storage = new MemStorage();
    const a = newAgent(storage);
    await a.call('/keys', { method: 'POST', body: JSON.stringify({ name: 'groq', value: 'gsk_given_once' }) });
    const b = await (await a.call('/vault/backup')).json();
    assert.equal(b.complete, true);
    assert.ok(!b.backup.includes('gsk_given_once'), 'the copy is encrypted');

    // Next day: the database is paused and the brain has restarted (nothing in memory).
    storage.down = true;
    const p = newAgent(storage);
    const ev = await events(await p.call('/chat', { method: 'POST', body: JSON.stringify({ message: 'say hi' }) }, { 'x-ghosty-vault': b.backup }));
    assert.equal(ev.find((e) => e.t === 'text')?.text, 'Hello from the AI.');
    assert.match(ai.sent.at(-1).auth, /gsk_given_once/);
    const st = await (await p.call('/status', {}, { 'x-ghosty-vault': b.backup })).json();
    assert.equal(st.keys.find((k) => k.name === 'groq').set, true, 'the Keys list shows it as set');

    // Someone without the owner key can't open the copy.
    const q = newAgent(storage);
    const before = ai.sent.length;
    await events(await q.call('/chat', { method: 'POST', body: JSON.stringify({ message: 'say hi' }) }, { 'x-ghosty-key': 'wrong-owner-key-000000000', 'x-ghosty-vault': b.backup }));
    assert.ok(!ai.sent.slice(before).some((s) => /gsk_given_once/.test(s.auth)));
  } finally {
    ai.restore();
  }
});

test('a key saved while paused works at once and is written to the database once it is back', async () => {
  const ai = fakeAI();
  try {
    const storage = new MemStorage();
    storage.down = true;
    const a = newAgent(storage);
    const r = await a.call('/keys', { method: 'POST', body: JSON.stringify({ name: 'groq', value: 'gsk_saved_while_paused' }) });
    assert.equal(r.status, 200, await r.clone().text());
    const b = await (await a.call('/vault/backup')).json();
    assert.equal(b.waiting, 1);
    await events(await a.call('/chat', { method: 'POST', body: JSON.stringify({ message: 'say hi' }) }));
    assert.match(ai.sent.at(-1).auth, /gsk_saved_while_paused/);

    // The brain restarts while still paused: the device's copy carries the new key.
    const c = newAgent(storage);
    await events(await c.call('/chat', { method: 'POST', body: JSON.stringify({ message: 'say hi' }) }, { 'x-ghosty-vault': b.backup }));
    assert.match(ai.sent.at(-1).auth, /gsk_saved_while_paused/);

    // Midnight UTC: the database is back; the next copy refresh writes the key to it.
    storage.down = false;
    const after = await (await c.call('/vault/backup', {}, { 'x-ghosty-vault': b.backup })).json();
    assert.equal(after.waiting, 0);
    assert.ok(storage.m.has('vault:groq'));
    const fresh = newAgent(storage);
    await events(await fresh.call('/chat', { method: 'POST', body: JSON.stringify({ message: 'say hi' }) }));
    assert.match(ai.sent.at(-1).auth, /gsk_saved_while_paused/, 'from the database now, no copy needed');
  } finally {
    ai.restore();
  }
});

test('Cloudflare secrets count under the usual names (GROQ_API_KEY, GOOGLE_API_KEY…)', async () => {
  const ai = fakeAI();
  try {
    const storage = new MemStorage();
    storage.down = true;
    const a = newAgent(storage, { GROQ_API_KEY: 'gsk_from_secret' });
    await events(await a.call('/chat', { method: 'POST', body: JSON.stringify({ message: 'say hi' }) }));
    assert.match(ai.sent.at(-1).auth, /gsk_from_secret/);
  } finally {
    ai.restore();
  }
});

test('while paused: email (with approval), travel, traffic, Spotify and the library are all offered', async () => {
  const replies = [
    { role: 'assistant', content: null, tool_calls: [{ id: 'e1', type: 'function', function: { name: 'send_email', arguments: JSON.stringify({ to: 'bob@example.com', subject: 'Hi', body: 'See you at 7' }) } }] },
    { role: 'assistant', content: "OK, I won't send it." },
  ];
  const ai = fakeAI((n) => replies[Math.min(n, replies.length) - 1]);
  try {
    const storage = new MemStorage();
    storage.down = true;
    const a = newAgent(storage, { GROQ_KEY: 'gsk_x', EMAIL_KEY: 'me@gmail.com abcd efgh ijkl mnop' });
    const ev = await events(await a.call('/chat', { method: 'POST', body: JSON.stringify({ message: 'email bob@example.com that I will see him at 7', offline: { library: [{ title: 'My notes', text: 'Bob prefers the Italian place on Broad Street.' }] } }) }));
    const names = ai.sent[0].body.tools.map((t) => t.function.name);
    for (const n of ['send_email', 'check_email', 'web_search', 'remember', 'set_reminder', 'library_search']) assert.ok(names.includes(n), `${n} offered`);
    const ask = ev.find((e) => e.t === 'approval');
    assert.equal(ask?.name, 'send_email');
    assert.match(ask.reason, /bob@example\.com/);
    // the owner says no: Ghosty carries on, still paused
    const ev2 = await events(await a.call('/approve', { method: 'POST', body: JSON.stringify({ id: ask.id, allow: false }) }));
    assert.match(ev2.find((e) => e.t === 'text')?.text ?? '', /won't send/);
    assert.match(JSON.stringify(ai.sent[1].body.messages.at(-1)), /declined/);

    const more = (msg) => {
      ai.sent.length = 0;
      return a.call('/chat', { method: 'POST', body: JSON.stringify({ message: msg }) }).then(() => ai.sent[0].body.tools.map((t) => t.function.name));
    };
    assert.ok((await more('directions to the nearest petrol station')).includes('get_directions'));
    assert.ok((await more("how's the traffic on the M6?")).includes('traffic_now'));
    assert.ok((await more('play some music on spotify')).includes('spotify_play'));
    assert.ok((await more('what is the weather tomorrow')).includes('weather'));
    assert.ok((await more('rebuild https://acme.example as a better website')).includes('publish_site'), 'websites can be rebuilt and published while paused (they live in KV)');
    assert.ok((await more('show me a map of birmingham')).includes('show_map'), 'maps need no database');
  } finally {
    ai.restore();
  }
});

test('while paused, a photo still reaches a model that can see it; with none, the owner is told rather than the photo being dropped', async () => {
  const PHOTO = `data:image/jpeg;base64,/9j/${'A'.repeat(4000)}`;
  const ai = fakeAI('I can see a picture: a red bicycle.');
  try {
    const storage = new MemStorage();
    storage.down = true;
    const a = newAgent(storage, { GEMINI_KEY: 'g_x', KEYLESS_MODELS: '0' });
    const ev = await events(await a.call('/chat', { method: 'POST', body: JSON.stringify({ message: 'what is this?', images: [PHOTO] }) }));
    assert.match(ev.find((e) => e.t === 'text')?.text ?? '', /red bicycle/);
    const last = ai.sent.at(-1).body.messages.at(-1);
    assert.ok(Array.isArray(last.content) && last.content[0].text === 'what is this?' && last.content[1].image_url.url === PHOTO, 'the picture went with the question, as parts');
    assert.match(ai.sent.at(-1).url, /googleapis/, 'to a model that can see');
  } finally {
    ai.restore();
  }
  // only a text-only key: no model can look, and the owner hears so (with what the phone itself saw, from the `seen` field), still paused
  const ai2 = fakeAI('should not be asked');
  try {
    const storage = new MemStorage();
    storage.down = true;
    const a = newAgent(storage, { GROQ_KEY: 'gsk_x', KEYLESS_MODELS: '0' });
    const ev = await events(await a.call('/chat', { method: 'POST', body: JSON.stringify({ message: 'what is this?', images: [PHOTO], seen: 'labels bicycle, person; text "EXIT [1]"' }) }));
    const text = ev.find((e) => e.t === 'text')?.text ?? '';
    assert.match(text, /can't see pictures/);
    assert.match(text, /Here is what the phone itself saw: labels bicycle, person; text "EXIT \[1\]"\.$/, 'what the phone saw is passed on, whole');
    assert.equal(ev.find((e) => e.t === 'done')?.model, 'No vision model · memory paused');
    assert.equal(ai2.sent.length, 0, 'a text-only model was never given the question');
  } finally {
    ai2.restore();
  }
});

test("while paused, library_search finds the owner's documents sent by their device, and the built-in library", async () => {
  const D = await import('./.build/tools/device.mjs');
  const t = D.deviceLibrarySearch([{ title: 'Lease agreement', heading: 'Rent', text: 'The monthly rent is £950, due on the 1st of each month.' }]);
  assert.match(await t.run({ query: 'when is the rent due' }, {}), /£950/);
  assert.match(await t.run({ query: 'binary search algorithm' }, {}), /binary search/i);
});

test('turns said while paused are added to the history and to what Ghosty remembers of the conversation', async () => {
  const storage = new MemStorage();
  const a = newAgent(storage);
  const r = await a.call('/history', { method: 'POST', body: JSON.stringify({ turns: [{ role: 'user', text: 'my dog is Rex', at: 5 }, { role: 'assistant', text: 'Noted', at: 6, model: 'groq · memory paused' }, { role: 'system', text: 'nope', at: 7 }] }) });
  assert.equal((await r.json()).added, 2);
  const h = await (await a.call('/history')).json();
  assert.deepEqual(h.turns.map((t) => t.text), ['my dog is Rex', 'Noted']);
  assert.deepEqual(storage.m.get('ctx').map((m) => m.content), ['my dog is Rex', 'Noted']);
  // sent again (a retry): nothing doubled
  const again = await a.call('/history', { method: 'POST', body: JSON.stringify({ turns: [{ role: 'user', text: 'my dog is Rex', at: 5 }] }) });
  assert.equal((await again.json()).added, 0);
  assert.equal(storage.m.get('turns').length, 2);
});

test('while paused, the Library search still answers from the built-in library', async () => {
  const storage = new MemStorage();
  storage.down = true;
  const a = newAgent(storage);
  const j = await (await a.call('/library/search?q=binary%20search%20algorithm&k=3')).json();
  assert.equal(j.paused, true);
  assert.ok(j.hits.length > 0);
});

test('backend and auth requests get the engineering standard; everyday words like "author" do not', async () => {
  const ai = fakeAI();
  try {
    const a = newAgent(new MemStorage(), { GROQ_KEY: 'gsk_x' });
    const coding = async (message) => {
      ai.sent.length = 0;
      await events(await a.call('/chat', { method: 'POST', body: JSON.stringify({ message }) }));
      return /ENGINEERING STANDARD/.test(String(ai.sent[0].body.messages[0].content));
    };
    assert.equal(await coding('add authentication and a database schema to my express server'), true);
    assert.equal(await coding('design the backend for an online shop'), true);
    for (const m of ['add authorization to my routes', 'how do I authenticate users', 'add OAuth sign-in', 'set up a postgres server', 'should I authorise with JWT']) assert.equal(await coding(m), true, m);
    assert.equal(await coding('who is the author of Dune?'), false);
    assert.equal(await coding('the local authority is closed today'), false);
    assert.equal(await coding('is the Discord server busy tonight?'), false);
  } finally {
    ai.restore();
  }
});

/** A fake KV namespace (the SITES / VAULT bindings): strings by key, always available. */
class FakeKv {
  m = new Map();
  async get(k, type) {
    const v = this.m.get(k);
    if (v == null) return null;
    return type === 'json' ? JSON.parse(v) : v;
  }
  async put(k, v) {
    this.m.set(k, String(v));
  }
  async delete(k) {
    this.m.delete(k);
  }
}

test('with the KV mirror: a key saved while paused is kept at once, survives a restart with no device copy, and the brain writes it to the database after the reset on its own', async () => {
  const ai = fakeAI();
  try {
    const storage = new MemStorage();
    const env = { VAULT: new FakeKv(), SITES: new FakeKv() };
    const a = newAgent(storage, env);
    storage.down = true;
    const r = await a.call('/keys', { method: 'POST', body: JSON.stringify({ name: 'groq', value: 'gsk_mirrored' }) });
    const rj = await r.json();
    assert.equal(r.status, 200);
    assert.equal(rj.waiting, 1, 'the answer says it waits for the database');
    assert.ok(env.VAULT.m.has('vault:groq'), 'the ciphertext is in KV');
    assert.ok(!env.VAULT.m.get('vault:groq').includes('gsk_mirrored'));
    // /status: the saved key is known, a key never saved is "not known" (null), not "not set"; keys waiting are counted
    const st = await (await a.call('/status')).json();
    assert.equal(st.keys.find((k) => k.name === 'groq').set, true);
    assert.equal(st.keys.find((k) => k.name === 'tavily').set, null);
    assert.equal(st.waiting, 1);
    assert.ok(st.paused);

    // The brain restarts during the pause; the device sends no copy.
    const b = newAgent(storage, env);
    await events(await b.call('/chat', { method: 'POST', body: JSON.stringify({ message: 'say hi' }) }));
    assert.match(ai.sent.at(-1).auth, /gsk_mirrored/, 'the key came from KV');

    // Midnight UTC: the database is back. The first request flushes, no device needed.
    storage.down = false;
    const c = newAgent(storage, env);
    await c.call('/status');
    assert.ok(storage.m.has('vault:groq'), 'written to the database by the brain itself');
    const st2 = await (await c.call('/status')).json();
    assert.equal(st2.waiting, 0);
    assert.ok(!env.VAULT.m.has('vault:dirty'));
    assert.equal(st2.keys.find((k) => k.name === 'tavily').set, false, 'database back: unset keys are known to be unset');
  } finally {
    ai.restore();
  }
});

test('while paused: statuses that cannot be known say so, an old approval gets a plain answer, and a library import reports the pause', async () => {
  const storage = new MemStorage();
  const a = newAgent(storage, { VAULT: new FakeKv() });
  storage.down = true;
  const email = await (await a.call('/email/status')).json();
  assert.deepEqual(email, { linked: false, unknown: true });
  const traffic = await (await a.call('/traffic/status')).json();
  assert.deepEqual(traffic, { ready: false, unknown: true });
  const spotify = await (await a.call('/spotify/status')).json();
  assert.equal(spotify.unknown, true);
  const ap = await a.call('/approve', { method: 'POST', body: JSON.stringify({ id: 'old', allow: true }) });
  assert.equal(ap.status, 409);
  assert.match((await ap.json()).error, /midnight UTC/);
  const real = globalThis.fetch;
  globalThis.fetch = async () => new Response('<html><body><h1>A page</h1><p>Some words to import into the library.</p></body></html>', { headers: { 'content-type': 'text/html' } });
  try {
    const imp = await a.call('/library/import', { method: 'POST', body: JSON.stringify({ source: 'https://example.com/page' }) });
    assert.equal(imp.status, 500);
    assert.match((await imp.json()).error, /free daily allowance/);
  } finally {
    globalThis.fetch = real;
  }
});

test('the database meter counts the brain\'s own reads and writes and shows in /status, by the work that caused them', async () => {
  const ai = fakeAI();
  try {
    const storage = new MemStorage();
    const a = newAgent(storage, { SITES: new FakeKv() });
    await a.call('/keys', { method: 'POST', body: JSON.stringify({ name: 'groq', value: 'gsk_meter' }) });
    await events(await a.call('/chat', { method: 'POST', body: JSON.stringify({ message: 'say hi' }) }));
    const st = await (await a.call('/status')).json();
    const m = st.meter;
    assert.ok(m && m.reads > 0 && m.writes > 0, JSON.stringify(m));
    assert.equal(m.limits.reads, 5_000_000);
    assert.equal(m.limits.writes, 100_000);
    assert.ok(m.level > 0 && m.level < 0.01);
    const labels = m.by.map((b) => b.label);
    assert.ok(labels.includes('route:chat') && labels.includes('route:keys'), labels.join(','));
    assert.ok(m.resetAt > Date.now());
  } finally {
    ai.restore();
  }
});

test('while paused: recon is offered and runs (public records, no database); a tool not offered is refused as unavailable, not as needing the database', async () => {
  const replies = [
    { role: 'assistant', content: null, tool_calls: [{ id: 'r1', type: 'function', function: { name: 'dns_lookup', arguments: JSON.stringify({ name: 'example.com' }) } }] },
    { role: 'assistant', content: 'Looked it up.' },
    // called by name although it is not offered while paused (the prompt lists every tool name)
    { role: 'assistant', content: null, tool_calls: [{ id: 'r2', type: 'function', function: { name: 'library_import', arguments: JSON.stringify({ source: 'https://example.com/page' }) } }] },
    { role: 'assistant', content: 'That has to wait.' },
  ];
  const ai = fakeAI((n) => replies[Math.min(n, replies.length) - 1]);
  try {
    const storage = new MemStorage();
    storage.down = true;
    const a = newAgent(storage, { GROQ_KEY: 'gsk_x' });
    const ev = await events(await a.call('/chat', { method: 'POST', body: JSON.stringify({ message: 'recon example.com' }) }));
    const names = ai.sent[0].body.tools.map((t) => t.function.name);
    for (const n of ['recon_domain', 'dns_lookup', 'whois_rdap', 'cert_search', 'subdomains', 'wayback_lookup', 'ip_lookup', 'http_fingerprint']) assert.ok(names.includes(n), `${n} offered while paused`);
    assert.match(String(ai.sent[0].body.messages[0].content), /Recon \(recon_domain and its pieces\) works as well/, 'the paused prompt says recon works');
    const ran = ev.find((e) => e.t === 'tool_result' && e.name === 'dns_lookup');
    assert.ok(ran, 'the lookup ran');
    assert.doesNotMatch(ran.summary, /needs my database|not available while my database is paused/, ran.summary);
    assert.equal(ev.find((e) => e.t === 'text')?.text, 'Looked it up.');

    const ev2 = await events(await a.call('/chat', { method: 'POST', body: JSON.stringify({ message: 'import https://example.com/page into the library' }) }));
    const refused = ev2.find((e) => e.t === 'tool_result' && e.name === 'library_import');
    assert.ok(refused && !refused.ok, JSON.stringify(ev2));
    assert.match(refused.summary, /library_import is not available while my database is paused \(it is back at midnight UTC\)/);
    assert.doesNotMatch(refused.summary, /needs my database/);
  } finally {
    ai.restore();
  }
});
