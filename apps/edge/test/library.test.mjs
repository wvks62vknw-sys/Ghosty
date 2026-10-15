// Ghosty's library: stored forever in SQLite (FTS5), searched without AI, optional meaning
// vectors, the starter library, importers, and answering from the library when no AI is reachable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sqlStorage } from '../../../tests/sqlite-storage.mjs';

const { Library, queryTerms } = await import('./.build/library/store.mjs');
const { importSource } = await import('./.build/library/importers.mjs');
const brain = await import('./.build/brain.mjs');

class MemStorage {
  m = new Map();
  sql = sqlStorage();
  async get(k) { return this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
  async put(k, v) { this.m.set(k, structuredClone(v)); }
  async delete(k) { return Array.isArray(k) ? k.filter((x) => this.m.delete(x)).length : this.m.delete(k); }
  async list({ prefix = '' } = {}) { return new Map([...this.m].filter(([k]) => k.startsWith(prefix))); }
  async setAlarm() {}
  async getAlarm() { return null; }
}

/** A stand-in for Workers AI embeddings: words hashed into 384 dimensions (similar words → similar vectors). */
const fakeAI = {
  calls: 0,
  async run(model, input) {
    this.calls++;
    assert.equal(model, '@cf/baai/bge-small-en-v1.5');
    return {
      data: input.text.map((t) => {
        const v = new Array(384).fill(0);
        for (const w of t.toLowerCase().match(/[a-z]{3,}/g) ?? []) {
          let h = 0;
          for (const c of w.slice(0, 6)) h = (h * 31 + c.charCodeAt(0)) % 384;
          v[h] += 1;
        }
        return v;
      }),
    };
  },
};

test('the library keeps passages and finds the right one without AI', async () => {
  const lib = new Library(new MemStorage(), {});
  const doc = lib.createDoc({ title: 'Bird Book', source: 'birds.pdf', kind: 'pdf' });
  await lib.addPassages(doc.id, [
    { text: 'Swallows migrate to Africa every autumn, flying thousands of kilometres.', heading: 'Migration', page: 3 },
    { text: 'Robins are territorial and sing through the winter in gardens.', heading: 'Garden birds', page: 7 },
    { text: 'Owls hunt at night using exceptional hearing and silent flight feathers.', heading: 'Night hunters', page: 9 },
  ]);
  lib.finish(doc.id);
  const hits = await lib.search('where do swallows migrate in autumn?');
  assert.equal(hits[0].title, 'Bird Book');
  assert.equal(hits[0].page, 3);
  assert.match(hits[0].text, /Africa/);
  assert.equal(hits[0].relevant, true);
  assert.equal((await lib.search('how do owls hunting at night')).at(0).heading, 'Night hunters', 'stemming: hunting → hunt');
  assert.deepEqual(await lib.search('quantum chromodynamics'), []);
  assert.ok((await lib.search('hi')).every((h) => !h.relevant), 'a greeting never pulls passages in');
  const s = lib.stats();
  assert.equal(s.docs, 1);
  assert.equal(s.passages, 3);
  assert.ok(s.bytes > 0);
  assert.equal(lib.list()[0].status, 'ready');
  assert.equal(lib.remove(doc.id), true);
  assert.deepEqual(await lib.search('swallows'), []);
});

test('at most 40 passages per call (each request stays small)', async () => {
  const lib = new Library(new MemStorage(), {});
  const doc = lib.createDoc({ title: 'Big' });
  const n = await lib.addPassages(doc.id, Array.from({ length: 55 }, (_, i) => ({ text: `passage number ${i} about topic ${i}` })));
  assert.equal(n, 40);
});

test('meaning vectors are stored and used when Workers AI is connected', async () => {
  const storage = new MemStorage();
  const lib = new Library(storage, { AI: fakeAI });
  const doc = lib.createDoc({ title: 'Cooking' });
  await lib.addPassages(doc.id, [{ text: 'Knead the bread dough for ten minutes until smooth and elastic.' }, { text: 'Sharpen kitchen knives on a whetstone at a 20 degree angle.' }]);
  assert.equal(lib.stats().vectors, 2);
  const hits = await lib.search('how long to knead dough');
  assert.match(hits[0].text, /Knead/);
});

test('the starter library fills in a little at a time and covers the big topics', async () => {
  const lib = new Library(new MemStorage(), {});
  let done = false;
  let rounds = 0;
  while (!done && rounds < 20) {
    done = await lib.seedStarter(40);
    rounds++;
  }
  assert.ok(done, 'finished seeding');
  assert.ok(rounds > 1, 'spread over several requests');
  const docs = lib.list();
  assert.ok(docs.length >= 10 && docs.every((d) => d.builtin && d.status === 'ready'));
  const top = async (q) => (await lib.search(q, 3))[0]?.title ?? '';
  assert.match(await top('FlashAttention tiling SRAM online softmax'), /AI Evolution/);
  assert.match(await top('Heartbleed OpenSSL heartbeat'), /Security/);
  assert.match(await top('Dijkstra shortest path priority queue'), /Algorithms/);
  assert.match(await top('LLVM SSA phi nodes passes'), /Compilers/);
  assert.match(await top('PPO clipped objective advantage'), /Reinforcement/);
  assert.match(await top('CUDA warps shared memory coalescing'), /Frameworks/);
  assert.match(await top('singular value decomposition eigenvectors'), /Mathematics/);
  assert.equal(await lib.seedStarter(40), true, 'nothing more to do once seeded');
});

test('query words: stop words dropped, technical tokens kept', () => {
  assert.deepEqual(queryTerms('How do I use the C++ std::vector in my code?'), ['c++', 'std', 'vector', 'code']);
  assert.deepEqual(queryTerms('what is the'), []);
});

// ---------- importers (web answers faked) ----------

const realFetch = globalThis.fetch;
function fakeWeb(routes) {
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    for (const [pattern, body, type] of routes) {
      if (pattern.test(url)) return new Response(body, { status: 200, headers: { 'content-type': type ?? 'text/html' } });
    }
    return new Response('not found', { status: 404 });
  };
}

test('import: CVE, arXiv, web page and GitHub repository', async () => {
  const lib = new Library(new MemStorage(), {});
  fakeWeb([
    [/cveawg\.mitre\.org\/api\/cve\/CVE-2021-44228/, JSON.stringify({ cveMetadata: { datePublished: '2021-12-10T00:00:00Z', state: 'PUBLISHED' }, containers: { cna: { title: 'Log4j JNDI features do not protect against attacker controlled LDAP', descriptions: [{ lang: 'en', value: 'Apache Log4j2 JNDI features used in configuration, log messages, and parameters do not protect against attacker controlled LDAP endpoints.' }], affected: [{ vendor: 'Apache', product: 'Log4j2', versions: [{ version: '2.0-beta9', lessThan: '2.15.0', status: 'affected' }] }], problemTypes: [{ descriptions: [{ cweId: 'CWE-502', description: 'Deserialization of Untrusted Data' }] }], references: [{ url: 'https://logging.apache.org/log4j/2.x/security.html' }] } } }), 'application/json'],
    [/arxiv\.org\/abs\/1706\.03762/, '<html><head><meta name="citation_title" content="Attention Is All You Need"><meta name="citation_author" content="Vaswani, Ashish"></head><body><blockquote class="abstract mathjax">Abstract: The dominant sequence transduction models are based on complex recurrent networks. We propose the Transformer, based solely on attention mechanisms.</blockquote></body></html>'],
    [/arxiv\.org\/html\/1706\.03762/, '<html><body><h2>Introduction</h2><p>Recurrent models factor computation along symbol positions.</p><h2>Scaled Dot-Product Attention</h2><p>We compute the dot products of the query with all keys, divide each by the square root of dk, and apply a softmax function.</p></body></html>'],
    [/example\.com\/guide/, '<html><head><title>Sourdough Guide</title></head><body><h1>Starter</h1><p>Feed your sourdough starter equal weights of flour and water daily.</p></body></html>'],
    [/api\.github\.com\/repos\/me\/tiny\/git\/trees/, JSON.stringify({ tree: [{ path: 'README.md', type: 'blob', size: 100 }, { path: 'src/main.py', type: 'blob', size: 100 }, { path: 'node_modules/x.js', type: 'blob', size: 10 }, { path: 'logo.png', type: 'blob', size: 10 }] }), 'application/json'],
    [/raw\.githubusercontent\.com\/me\/tiny\/HEAD\/README\.md/, '# Tiny\n\nTiny is a command line tool that counts words in files.', 'text/plain'],
    [/raw\.githubusercontent\.com\/me\/tiny\/HEAD\/src\/main\.py/, 'def count_words(path):\n    with open(path) as f:\n        return len(f.read().split())\n', 'text/plain'],
  ]);
  try {
    const cve = await importSource(lib, 'cve-2021-44228');
    assert.match(cve.doc.title, /CVE-2021-44228 — Log4j/);
    const arx = await importSource(lib, 'https://arxiv.org/abs/1706.03762');
    assert.equal(arx.doc.title, 'Attention Is All You Need');
    assert.match(arx.note, /full paper/);
    const web = await importSource(lib, 'https://example.com/guide');
    assert.equal(web.doc.title, 'Sourdough Guide');
    const gh = await importSource(lib, 'me/tiny');
    assert.equal(gh.doc.title, 'GitHub: me/tiny');
    assert.match(gh.note, /all 2 readable files/);
    assert.match((await lib.search('log4j jndi ldap'))[0].title, /CVE-2021-44228/);
    assert.match((await lib.search('scaled dot product attention softmax'))[0].text, /square root/);
    assert.match((await lib.search('def count_words open path'))[0].heading, /main\.py/);
    await assert.rejects(importSource(lib, 'just some words'), /give a web address/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

// ---------- the brain uses the library ----------

async function chatWith(agent, message) {
  const r = await agent.fetch(new Request('https://ghosty.test/api/chat', { method: 'POST', body: JSON.stringify({ message }), headers: { 'content-type': 'application/json' } }));
  const text = await r.text();
  await new Promise((ok) => setTimeout(ok, 20));
  return text.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

test('with no AI at all (no keys, no Workers AI), Ghosty answers from its library', async () => {
  const pending = [];
  const state = { storage: new MemStorage(), waitUntil: (p) => pending.push(p), blockConcurrencyWhile: (f) => f() };
  const env = { VAULT_KEY: Buffer.alloc(32, 7).toString('base64') };
  const agent = new brain.GhostyAgent(state, env);
  const add = (path, body) => agent.fetch(new Request(`https://ghosty.test/api${path}`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })).then((r) => r.json());
  const { doc } = await add('/library/docs', { title: 'Garden Notes', source: 'notes.md', kind: 'notes' });
  await add(`/library/docs/${doc.id}/passages`, { passages: [{ text: 'The greenhouse tomatoes need watering every morning at seven, and feeding with seaweed once a week.', heading: 'Tomatoes' }] });
  await add(`/library/docs/${doc.id}/done`, {});
  const ev = await chatWith(agent, 'how often do the greenhouse tomatoes need watering?');
  await Promise.allSettled(pending.splice(0));
  const text = ev.find((e) => e.t === 'text')?.text ?? '';
  assert.match(text, /can't reach an AI model/);
  assert.match(text, /Garden Notes/);
  assert.match(text, /every morning at seven/);
  assert.equal(ev.find((e) => e.t === 'done').model, 'Library · no AI');
  // the library endpoints work for the Library tab
  const list = await (await agent.fetch(new Request('https://ghosty.test/api/library'))).json();
  assert.ok(list.docs.some((d) => d.title === 'Garden Notes'));
  const found = await (await agent.fetch(new Request('https://ghosty.test/api/library/search?q=seaweed%20feeding'))).json();
  assert.equal(found.hits[0].title, 'Garden Notes');
});

// Cloudflare's free plan allows 5 million rows read a day, and the Core screen asks for the library's
// size every 15 seconds: no everyday operation may read the whole library (a full scan of lib_fts,
// lib_vec or lib_pass). Only the one-time index build may.
test('everyday library work reads only the rows it needs (no full scans)', async () => {
  const st = new MemStorage();
  const lib = new Library(st, { AI: fakeAI });
  const d = lib.createDoc({ title: 'Scan check' });
  await lib.addPassages(d.id, [{ text: 'alpha beta gamma delta', heading: 'one' }, { text: 'epsilon zeta eta theta', heading: 'two' }]);
  st.sql.plans.length = 0;
  await lib.addPassages(d.id, [{ text: 'iota kappa lambda', heading: 'three' }]);
  assert.equal(await lib.note('notes_t', 'Notes', 'notes', { text: 'a note worth keeping' }), true);
  assert.equal(await lib.note('notes_t', 'Notes', 'notes', { text: 'a note worth keeping' }), false, 'same note is not filed twice');
  assert.equal(lib.removeSection(d.id, 'one'), 1);
  const s = lib.stats();
  assert.equal(s.passages, 3);
  assert.ok((await lib.search('epsilon zeta theta')).length);
  lib.list();
  assert.equal(lib.remove(d.id), true);
  assert.equal(lib.stats().passages, 1);
  const scans = st.sql.plans.filter((p) => p.detail.some((x) => /^SCAN lib_(vec|pass)\b/.test(x) || /^SCAN lib_fts VIRTUAL TABLE INDEX 0:$/.test(x)));
  assert.deepEqual(scans.map((p) => p.query.slice(0, 80)), [], 'full-library scans');
});

test('a library from before the index gets it built once, then works as usual', async () => {
  const st = new MemStorage();
  // the old layout: passages only in lib_fts
  st.sql.exec(`CREATE TABLE lib_docs (id TEXT PRIMARY KEY, title TEXT NOT NULL, source TEXT, kind TEXT, pages INTEGER DEFAULT 0, passages INTEGER DEFAULT 0, chars INTEGER DEFAULT 0, status TEXT DEFAULT 'adding', builtin INTEGER DEFAULT 0, at INTEGER)`);
  st.sql.exec(`CREATE VIRTUAL TABLE lib_fts USING fts5(text, heading, doc UNINDEXED, page UNINDEXED, tokenize = 'porter unicode61')`);
  st.sql.exec(`INSERT INTO lib_docs (id, title, passages, chars, status) VALUES ('self_code', 'My code', 2, 20, 'ready')`);
  st.sql.exec(`INSERT INTO lib_fts (rowid, text, heading, doc) VALUES (7, 'export function a() {}', 'apps/a.ts', 'self_code'), (9, 'export function b() {}', 'apps/b.ts', 'self_code')`);
  const lib = new Library(st, {});
  assert.equal(lib.removeSection('self_code', 'apps/a.ts'), 1);
  const d = lib.createDoc({ title: 'New' });
  await lib.addPassages(d.id, [{ text: 'fresh passage', heading: '' }]);
  assert.equal(st.sql.exec(`SELECT max(rid) AS m FROM lib_pass`).one().m, 10, 'new row ids continue after the old ones');
  const builds = st.sql.plans.filter((p) => /SELECT rowid, doc, heading/.test(p.query)).length;
  new Library(st, {}).list();
  assert.equal(st.sql.plans.filter((p) => /SELECT rowid, doc, heading/.test(p.query)).length, builds, 'index built only once');
});

test("when Cloudflare's daily database allowance is used up, Ghosty says so and still answers from its built-in library", async () => {
  const quota = () => { throw new Error('Exceeded allowed rows read in Durable Objects free tier.'); };
  const storage = new MemStorage();
  storage.get = async () => quota();
  storage.put = async () => quota();
  storage.sql = { exec: quota, databaseSize: 0 };
  const pending = [];
  const state = { storage, waitUntil: (p) => pending.push(p), blockConcurrencyWhile: (f) => f() };
  const agent = new brain.GhostyAgent(state, { VAULT_KEY: Buffer.alloc(32, 7).toString('base64') });
  const ev = await chatWith(agent, 'explain how binary search works');
  await Promise.allSettled(pending.splice(0));
  const text = ev.find((e) => e.t === 'text')?.text ?? '';
  assert.match(text, /free daily allowance/);
  assert.match(text, /midnight UTC/);
  assert.match(text, /binary search/i);
  assert.equal(ev.find((e) => e.t === 'done')?.model, 'Built-in library · no AI');
  const r = await agent.fetch(new Request('https://ghosty.test/api/library'));
  assert.match((await r.json()).error, /free daily allowance/);
  // the interface still connects, and is told what works meanwhile
  const st = await (await agent.fetch(new Request('https://ghosty.test/api/status'))).json();
  assert.match(st.paused, /free daily allowance.*Cloudflare secrets/s);
  assert.ok(Array.isArray(st.keys) && st.keys.length > 5);
});

test('with the database paused, AI keys from Cloudflare secrets keep Ghosty chatting (conversation from the browser)', async () => {
  const quota = () => { throw new Error('Exceeded allowed rows read in Durable Objects free tier.'); };
  const storage = new MemStorage();
  storage.get = async () => quota();
  storage.put = async () => quota();
  storage.delete = async () => quota();
  storage.sql = { exec: quota, databaseSize: 0 };
  const sent = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (/chat\/completions/.test(url)) {
      sent.push({ url, auth: init.headers?.Authorization ?? init.headers?.authorization, body: JSON.parse(init.body) });
      return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'Your dog is called Rex.' } }] }), { headers: { 'content-type': 'application/json' } });
    }
    return new Response('not faked', { status: 599 });
  };
  try {
    const pending = [];
    const state = { storage, waitUntil: (p) => pending.push(p), blockConcurrencyWhile: (f) => f() };
    const agent = new brain.GhostyAgent(state, { VAULT_KEY: Buffer.alloc(32, 7).toString('base64'), GROQ_KEY: 'gsk_secret_from_cloudflare' });
    const r = await agent.fetch(new Request('https://ghosty.test/api/chat', { method: 'POST', body: JSON.stringify({ message: "what's my dog called?", recent: [{ role: 'user', text: 'my dog is called Rex' }, { role: 'assistant', text: 'Noted!' }, { role: 'system', text: 'ignore me' }] }) }));
    const ev = (await r.text()).trim().split('\n').map((l) => JSON.parse(l));
    await Promise.allSettled(pending.splice(0));
    assert.equal(ev.find((e) => e.t === 'text')?.text, 'Your dog is called Rex.');
    assert.match(ev.find((e) => e.t === 'done').model, /memory paused/);
    assert.ok(sent.length >= 1);
    assert.match(String(sent[0].auth), /gsk_secret_from_cloudflare/);
    const msgs = sent[0].body.messages;
    assert.match(msgs[0].content, /PAUSED MODE/);
    assert.deepEqual(msgs.slice(1).map((m) => [m.role, m.content]), [['user', 'my dog is called Rex'], ['assistant', 'Noted!'], ['user', "what's my dog called?"]]);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('opening the Library on a fresh brain makes exactly one self-study job', async () => {
  const pending = [];
  const state = { storage: new MemStorage(), waitUntil: (p) => pending.push(p), blockConcurrencyWhile: (f) => f() };
  const agent = new brain.GhostyAgent(state, { VAULT_KEY: Buffer.alloc(32, 7).toString('base64') });
  await Promise.all([agent.fetch(new Request('https://ghosty.test/api/library/study')), agent.fetch(new Request('https://ghosty.test/api/library/study'))]);
  await Promise.allSettled(pending.splice(0));
  const study = () => (state.storage.m.get('jobs') ?? []).filter((j) => j.kind === 'study');
  assert.equal(study().length, 1);
  await agent.fetch(new Request('https://ghosty.test/api/library/study', { method: 'POST', body: JSON.stringify({ on: false }) }));
  assert.equal(study().length, 0, 'switching off removes it');
});

test('a widget built while the database is paused still opens, marked unsaved', async () => {
  const T = await import('./.build/tools/index.mjs');
  const events = [];
  const out = await T.toolByName.get('create_widget').run({ name: 'merge', title: 'Merge', html: '<h1>2048</h1>' }, { storage: { put: async () => { throw new Error('Exceeded allowed rows read'); } }, emit: (e) => events.push(e) });
  assert.match(out, /kept it in Workshop/);
  assert.equal(events[0].name, 'open_widget');
  assert.equal(events[0].args.saved, false);
});

test("while paused, Ghosty knows the owner's memory from their device and can still remember things", async () => {
  const quota = () => { throw new Error('Exceeded allowed rows read in Durable Objects free tier.'); };
  const storage = new MemStorage();
  storage.get = async () => quota();
  storage.put = async () => quota();
  storage.delete = async () => quota();
  storage.sql = { exec: quota, databaseSize: 0 };
  const sent = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (!/chat\/completions/.test(url)) return new Response('not faked', { status: 599 });
    const body = JSON.parse(init.body);
    sent.push(body);
    const reply = sent.length === 1
      ? { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'remember', arguments: JSON.stringify({ text: 'Ghost has a dog called Rex' }) } }] }
      : { role: 'assistant', content: "Got it — and you're seeing Sam at 7." };
    return new Response(JSON.stringify({ choices: [{ message: reply }] }), { headers: { 'content-type': 'application/json' } });
  };
  try {
    const pending = [];
    const agent = new brain.GhostyAgent({ storage, waitUntil: (p) => pending.push(p), blockConcurrencyWhile: (f) => f() }, { VAULT_KEY: Buffer.alloc(32, 7).toString('base64'), GROQ_KEY: 'gsk_x' });
    const r = await agent.fetch(new Request('https://ghosty.test/api/chat', { method: 'POST', body: JSON.stringify({ message: 'remember my dog is Rex. what am I doing tonight?', context: { tz: 'Europe/London' }, offline: { facts: ['Ghost lives in Birmingham'], agenda: ['event "Dinner with Sam" 2026-10-15T18:00:00.000Z'] } }) }));
    const ev = (await r.text()).trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
    await Promise.allSettled(pending.splice(0));
    const sys = sent[0].messages[0].content;
    assert.match(sys, /Ghost lives in Birmingham/, 'memory from the device');
    assert.match(sys, /Dinner with Sam/, 'agenda from the device');
    assert.ok(sent[0].tools.some((t) => t.function.name === 'set_reminder'), 'reminders offered while paused');
    const save = ev.find((e) => e.t === 'client' && e.name === 'offline_save');
    assert.deepEqual(save?.args, { op: 'addMemory', text: 'Ghost has a dog called Rex' });
    assert.match(ev.find((e) => e.t === 'text').text, /Sam at 7/);
  } finally {
    globalThis.fetch = realFetch;
  }
});
