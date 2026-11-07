// HIS PLACE IN A BOOK (BRIEF-LIBRARY-READER 2): the brain keeps where he is in each book (/library/place), so another device
// opens it where he left it. Through the Worker itself, as the phone calls it:
//  - a place per book, kept and given back (one book's, and every book's for the Shelf), each book's on its own;
//  - owner-only: no key or a wrong key is refused before anything is read or kept;
//  - checked against the book: a place past its last passage, a page it does not have, a book the library has not got, a
//    passage counted below 0 or an offset past a passage are refused in words, and nothing is kept;
//  - another device that moved on is never written over by an older place: the newer one comes back, marked;
//  - a book taken out of the library takes its place with it; the author a file names is kept with the book.
// Fails on the code before the reader: there was no /library/place (404) and no author.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { sqlStorage } from '../../../tests/sqlite-storage.mjs';

const mod = await import(process.env.BRAIN_BUNDLE ?? './.build/brain.mjs');
const worker = mod.default;

class MemStorage {
  m = new Map();
  sql = sqlStorage();
  async get(k) {
    if (Array.isArray(k)) return new Map(k.filter((x) => this.m.has(x)).map((x) => [x, structuredClone(this.m.get(x))]));
    return this.m.has(k) ? structuredClone(this.m.get(k)) : undefined;
  }
  async put(k, v) {
    if (typeof k === 'object') for (const [a, b] of Object.entries(k)) this.m.set(a, structuredClone(b));
    else this.m.set(k, structuredClone(v));
  }
  async delete(k) {
    if (Array.isArray(k)) return k.filter((x) => this.m.delete(x)).length;
    return this.m.delete(k);
  }
  async list({ prefix = '' } = {}) {
    return new Map([...this.m].filter(([k]) => k.startsWith(prefix)).sort().map(([k, v]) => [k, structuredClone(v)]));
  }
  async setAlarm() {}
  async getAlarm() { return null; }
}

const OWNER_KEY = 'test-owner-key-0123456789abcdef';
const pending = [];
const state = { storage: new MemStorage(), waitUntil: (p) => pending.push(p), blockConcurrencyWhile: (f) => f() };
const env = { OWNER_KEY, VAULT_KEY: Buffer.from(webcrypto.getRandomValues(new Uint8Array(32))).toString('base64'), MOCK_LLM: '1' };
let agent;
env.AGENT = { idFromName: (n) => ({ toString: () => n }), get: () => ({ fetch: (r) => (agent ??= new mod.GhostyAgent(state, env)).fetch(r) }) };
const ctx = { waitUntil: (p) => pending.push(p), passThroughOnException() {} };

/** The phone's call: the owner's key unless `key` says otherwise (null: none at all). */
async function call(path, { method = 'GET', body, key = OWNER_KEY } = {}) {
  const r = await worker.fetch(new Request(`https://ghosty.test/api${path}`, { method, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), headers: { 'content-type': 'application/json', 'x-ghosty': '1', ...(key ? { 'x-ghosty-key': key } : {}) } }), env, ctx);
  await Promise.allSettled(pending.splice(0));
  return { status: r.status, body: await r.json().catch(() => null) };
}

/** A book of `n` passages on the brain, as the phone adds one (its pages, if it has them, two passages a page). */
async function book(title, n, { pages = 0, author = '' } = {}) {
  const { body } = await call('/library/docs', { method: 'POST', body: { title, source: `${title}.txt`, kind: 'text', pages, author } });
  const id = body.doc.id;
  const passages = Array.from({ length: n }, (_, i) => ({ text: `Passage ${i} of ${title}: the keeper climbed the stairs again, counting each one under his breath.`, heading: `Chapter ${Math.floor(i / 2) + 1}`, ...(pages ? { page: Math.floor(i / 2) + 1 } : {}) }));
  await call(`/library/docs/${id}/passages`, { method: 'POST', body: { passages } });
  await call(`/library/docs/${id}/done`, { method: 'POST', body: {} });
  return id;
}

test('a place is kept per book and given back, one book at a time and every book for the Shelf', async () => {
  const hobbit = await book('The Lighthouse Keeper', 6, { pages: 3 });
  const other = await book('Night Walks', 4);
  const before = await call(`/library/place?doc=${hobbit}`);
  assert.equal(before.status, 200);
  assert.equal(before.body.place, null, 'a book never opened has no place yet');
  const at = Date.now() - 5_000;
  const put = await call('/library/place', { method: 'PUT', body: { doc: hobbit, n: 4, off: 37, page: 3, pct: 0.8, at } });
  assert.equal(put.status, 200, JSON.stringify(put.body));
  assert.deepEqual(put.body.place, { doc: hobbit, n: 4, off: 37, page: 3, pct: 0.8, done: false, at });
  assert.deepEqual((await call(`/library/place?doc=${hobbit}`)).body.place, put.body.place, 'the same place comes back');
  // another book's place is its own
  const p2 = await call('/library/place', { method: 'PUT', body: { doc: other, n: 1, off: 0, pct: 0.33 } });
  assert.equal(p2.status, 200, JSON.stringify(p2.body));
  assert.equal(p2.body.place.page, null, 'a book with no pages has no page in its place');
  const all = (await call('/library/place')).body.places;
  assert.deepEqual(Object.keys(all).sort(), [hobbit, other].sort());
  assert.equal(all[hobbit].n, 4);
  assert.equal(all[other].n, 1);
  // the last passage is a place; finished is kept as he said it
  const end = await call('/library/place', { method: 'PUT', body: { doc: hobbit, n: 5, off: 10, page: 3, pct: 1, done: true } });
  assert.equal(end.status, 200, JSON.stringify(end.body));
  assert.equal(end.body.place.done, true);
});

test('owner-only: no key or a wrong one is refused, and nothing is kept', async () => {
  const id = await book('Owner Only', 3);
  for (const key of [null, 'wrong-key-wrong-key-wrong-key']) {
    assert.equal((await call('/library/place', { key })).status, 401);
    assert.equal((await call(`/library/place?doc=${id}`, { key })).status, 401);
    assert.equal((await call('/library/place', { method: 'PUT', body: { doc: id, n: 1, off: 0 }, key })).status, 401);
    assert.equal((await call(`/library/place?doc=${id}`, { method: 'DELETE', key })).status, 401);
  }
  assert.equal((await call(`/library/place?doc=${id}`)).body.place, null, 'a refused call kept nothing');
});

test('a place past the book\'s end, a page it does not have, a book it has not got: refused in words, nothing kept', async () => {
  const id = await book('Three Passages', 3, { pages: 2 });
  const refused = [
    [{ doc: id, n: 3, off: 0 }, 400, /past the end of “Three Passages”: it has 3 passages, the last is 2/],
    [{ doc: id, n: 99, off: 0 }, 400, /past the end/],
    [{ doc: id, n: -1, off: 0 }, 400, /counted from 0/],
    [{ doc: id, n: 1.5, off: 0 }, 400, /counted from 0/],
    [{ doc: id, n: 1, off: 4001 }, 400, /at most 4000 characters/],
    [{ doc: id, n: 1, off: -3 }, 400, /at most 4000 characters/],
    [{ doc: id, n: 1, off: 0, page: 3 }, 400, /has 2 pages: there is no page 3/],
    [{ doc: id, n: 1, off: 0, pct: 1.4 }, 400, /share between 0 and 1/],
    [{ doc: 'doc_nosuchbook', n: 0, off: 0 }, 404, /no such book/],
    [{ n: 0, off: 0 }, 400, /which book/],
  ];
  for (const [body, status, words] of refused) {
    const r = await call('/library/place', { method: 'PUT', body });
    assert.equal(r.status, status, `${JSON.stringify(body)} → ${r.status} ${JSON.stringify(r.body)}`);
    assert.match(r.body.error, words);
  }
  assert.equal((await call(`/library/place?doc=${id}`)).body.place, null, 'nothing refused was kept');
});

test('an older place never writes over a newer one (another device moved on): the newer comes back', async () => {
  const id = await book('Two Devices', 8);
  const now = Date.now();
  const newer = await call('/library/place', { method: 'PUT', body: { doc: id, n: 6, off: 12, at: now - 1_000 } });
  assert.equal(newer.status, 200);
  const stale = await call('/library/place', { method: 'PUT', body: { doc: id, n: 2, off: 0, at: now - 60_000 } });
  assert.equal(stale.status, 200);
  assert.equal(stale.body.newer, true, 'the phone is told the place it holds is older');
  assert.equal(stale.body.place.n, 6, 'and given the newer one');
  assert.equal((await call(`/library/place?doc=${id}`)).body.place.n, 6, 'the newer place stayed');
  // a phone whose clock runs fast never puts a place in the future
  const fast = await call('/library/place', { method: 'PUT', body: { doc: id, n: 7, off: 0, at: now + 3_600_000 } });
  assert.ok(fast.body.place.at <= Date.now(), 'a place is never in the future');
});

test('a book taken out of the library takes its place with it; the author a file names is kept with the book', async () => {
  const id = await book('Gone Soon', 4, { author: 'R. L. Stevenson' });
  const lib = (await call('/library')).body;
  assert.equal(lib.docs.find((d) => d.id === id)?.author, 'R. L. Stevenson', 'the author is on the shelf');
  assert.equal(lib.docs.find((d) => d.title === 'Night Walks')?.author, undefined, 'a file that names no author has none');
  await call('/library/place', { method: 'PUT', body: { doc: id, n: 2, off: 5 } });
  assert.equal((await call(`/library/place?doc=${id}`)).body.place.n, 2);
  assert.equal((await call(`/library/docs/${id}`, { method: 'DELETE' })).status, 200);
  assert.equal((await call(`/library/place?doc=${id}`)).body.place, null, 'the place went with the book');
  assert.ok(!((await call('/library/place')).body.places[id]), 'and is not on the Shelf\'s list');
  // DELETE on its own forgets a place too
  const keep = await book('Forget Me', 2);
  await call('/library/place', { method: 'PUT', body: { doc: keep, n: 1, off: 0 } });
  assert.equal((await call(`/library/place?doc=${keep}`, { method: 'DELETE' })).status, 200);
  assert.equal((await call(`/library/place?doc=${keep}`)).body.place, null);
});
