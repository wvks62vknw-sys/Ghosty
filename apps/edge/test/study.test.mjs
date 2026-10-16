// Self-study: reading the curriculum into the library (no AI needed), digesting and drilling with a
// model when one is there, the owner's questions first, the owner's focus first, and the caps that
// keep it inside the free plan. The network is faked for every source kind.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sqlStorage } from '../../../tests/sqlite-storage.mjs';

const { Library } = await import('./.build/library/store.mjs');
const S = await import('./.build/library/study.mjs');
const D = await import('./.build/library/drills.mjs');
const brain = await import('./.build/brain.mjs');

class MemStorage {
  m = new Map();
  sql = sqlStorage();
  async get(k) { return this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
  async put(k, v) { this.m.set(k, structuredClone(v)); }
  async delete(k) { return Array.isArray(k) ? k.filter((x) => this.m.delete(x)).length : this.m.delete(k); }
  async list({ prefix = '' } = {}) { return new Map([...this.m].filter(([k]) => k.startsWith(prefix))); }
  alarm = null;
  async setAlarm(t) { this.alarm = t; }
  async getAlarm() { return this.alarm; }
}

const QUARTER = 15 * 60_000;
const HOUR = 3600_000;
const seen = [];
let wikiDown = false;
const lorem = (title) => `${title} is explained here in detail. ${Array.from({ length: 12 }, (_, i) => `Paragraph ${i + 1} about ${title}: it matters for a builder because of what it lets you do, with examples, pitfalls and the words people use for it.`).join(' ')}`;
// Every source kind the curriculum can name answers with a page about the topic asked for.
globalThis.fetch = async (input) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  seen.push(url.hostname + url.pathname);
  const j = (o) => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json' } });
  const html = (t, b) => new Response(`<html><head><title>${t}</title></head><body><p>${b}</p></body></html>`, { headers: { 'content-type': 'text/html' } });
  const q = url.searchParams.get('q') ?? url.searchParams.get('srsearch') ?? url.searchParams.get('search_query') ?? '';
  if (url.hostname === 'developer.mozilla.org' && url.pathname === '/api/v1/search') return j({ documents: [{ mdn_url: `/en-US/docs/Web/${encodeURIComponent(q.replace(/\s+/g, '_'))}` }] });
  if (url.hostname === 'developer.mozilla.org') {
    const t = decodeURIComponent(url.pathname.split('/').pop()).replace(/_/g, ' ');
    return html(`${t} - MDN`, lorem(t));
  }
  if (/wiki(pedia|books|versity)\.org$/.test(url.hostname) && url.pathname === '/w/api.php') {
    if (wikiDown) return new Response('rate limited', { status: 429 });
    if (/unanswerable/.test(q)) return j({ query: { search: [] } }); // nothing to read for this one
    return j({ query: { search: [{ title: q }] } });
  }
  if (/wiki(pedia|books|versity)\.org$/.test(url.hostname)) {
    const t = decodeURIComponent(url.pathname.split('/').pop()).replace(/_/g, ' ');
    return html(t, lorem(t));
  }
  if (url.hostname === 'export.arxiv.org') {
    const id = /Polynomial-Time Algorithms/.test(q) ? 'quant-ph/9508027v2' : '2301.00001v2';
    return new Response(`<feed><entry><id>http://arxiv.org/abs/${id}</id><title>${q}</title></entry></feed>`, { headers: { 'content-type': 'application/atom+xml' } });
  }
  if (url.hostname === 'arxiv.org' && url.pathname.startsWith('/abs/')) return new Response(`<html><head><meta name="citation_title" content="A paper on things"><title>[2301.00001] A paper on things</title></head><body><blockquote class="abstract mathjax">Abstract: ${lorem('the paper')}</blockquote></body></html>`, { headers: { 'content-type': 'text/html' } });
  if (url.hostname === 'arxiv.org') return html('A paper on things', lorem('the full paper'));
  if (url.hostname === 'www.gutenberg.org') {
    const id = url.pathname.match(/pg(\d+)\.txt$/)?.[1] ?? '0';
    return new Response(`Title: Book ${id}\n\nAuthor: An Author\n\n*** START OF THE PROJECT GUTENBERG EBOOK BOOK ***\n\nTHE FIRST BOOK\n\n${lorem(`book ${id}`)}\n\n*** END OF THE PROJECT GUTENBERG EBOOK BOOK ***\n\nLicence text.`, { headers: { 'content-type': 'text/plain' } });
  }
  if (url.hostname === 'docs.swift.org' || url.hostname === 'openstax.org') {
    const t = url.pathname.split('/').filter(Boolean).pop();
    return html(t, lorem(t));
  }
  return new Response('not faked', { status: 599 });
};

const first = S.DOMAINS[0];
const second = S.DOMAINS[1] ?? S.DOMAINS[0];

test("a study session reads the next topics into the domain's notebook and logs them; re-reading replaces, not duplicates", async () => {
  const st = new MemStorage();
  const lib = new Library(st, {});
  const r1 = await S.studySession(st, lib, { reads: 2 });
  assert.deepEqual(r1.did, { reads: 2, digests: 0, drills: 0 });
  assert.equal(r1.state.i, 2);
  assert.equal(r1.state.sessions, 1);
  // round-robin across the fields: one topic from each of the first two, not two from one
  assert.equal(r1.state.cursor[first.id], 1);
  assert.equal(r1.state.cursor[second.id], 1);
  assert.equal(r1.state.last.topic, second.topics[0].t);
  assert.equal(r1.state.last.kind, 'read');
  assert.ok(r1.state.last.passages >= 1);
  assert.equal(r1.next, QUARTER, 'more to read: back in a quarter of an hour');
  const doc = lib.doc(`read_${first.id}`);
  assert.ok(doc && lib.doc(`read_${second.id}`), 'one notebook per field');
  assert.equal(doc.kind, 'study');
  assert.equal(doc.status, 'ready');
  assert.match(doc.title, new RegExp(`^Reading: ${first.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  const hits = await lib.search(first.topics[0].t);
  assert.ok(hits.some((h) => h.title === doc.title), 'what it read is searchable');
  assert.equal(lib.doc('notes_study').passages, 2, 'the study log has one entry per reading');
  assert.equal(r1.state.domains[first.id].read, 1);
  assert.equal(r1.state.domains[second.id].read, 1);
  // the same topic again (the cursor moved back) replaces its section
  const before = lib.doc(doc.id).passages;
  st.m.set(S.STUDY_KEY, { ...(await S.loadStudy(st)), cursor: { [first.id]: 0 } });
  const r2 = await S.studySession(st, lib, { reads: 1 });
  assert.equal(r2.state.last.topic, first.topics[0].t);
  assert.equal(lib.doc(doc.id).passages, before, 'replaced, not stored twice');
  assert.equal(r2.state.i, 3, 'counted as another reading all the same');
});

test("questions the library couldn't answer are studied first; a failed source is kept for later and counted", async () => {
  const st = new MemStorage();
  const lib = new Library(st, {});
  await S.noteGap(st, 'how does collision detection work in games?');
  await S.noteGap(st, 'thanks'); // not a question
  assert.deepEqual((await S.loadStudy(st)).gaps, ['how does collision detection work in games?']);
  wikiDown = true;
  const failed = await S.studySession(st, lib, { reads: 1 });
  wikiDown = false;
  assert.match(failed.state.last.error, /429/);
  assert.deepEqual(failed.did, { reads: 0, digests: 0, drills: 0 });
  assert.equal(failed.state.gaps.length, 1, 'kept to try again');
  assert.equal(failed.state.domains.questions.failed, 1);
  assert.equal(failed.state.gapFails['how does collision detection work in games?'], undefined, 'a rate limit is not held against the question');
  assert.equal(failed.next, HOUR, 'nothing read: back in an hour');
  const ok = await S.studySession(st, lib, { reads: 1 });
  assert.equal(ok.state.last.topic, 'how does collision detection work in games?');
  assert.equal(ok.state.gaps.length, 0);
  const doc = lib.doc('read_questions');
  assert.equal(doc.title, 'Reading: Your questions');
  assert.equal(ok.state.cursor[first.id] ?? 0, 0, 'the curriculum waited');
});

test('a question whose source keeps failing is tried once a session (the curriculum still moves) and given up after three', async () => {
  const st = new MemStorage();
  const lib = new Library(st, {});
  await S.noteGap(st, 'what is the unanswerable thing?');
  const r1 = await S.studySession(st, lib, { reads: 3 });
  assert.equal(r1.did.reads, 2, 'the two other slots read the curriculum');
  assert.deepEqual(r1.state.gaps, ['what is the unanswerable thing?'], 'kept for another session');
  assert.equal(r1.state.gapFails['what is the unanswerable thing?'], 1);
  assert.equal(r1.state.domains.questions.failed, 1, 'one try, not three');
  await S.studySession(st, lib, { reads: 1 });
  const r3 = await S.studySession(st, lib, { reads: 1 });
  assert.deepEqual(r3.state.gaps, [], 'given up after three sessions');
  assert.deepEqual(r3.state.gapFails, {});
  assert.ok(lib.passagesOf('notes_study').passages.some((p) => /^Gave up: what is the unanswerable thing\?/.test(p.heading)), 'and said so in the study log');
});

test('a source already read in another field is copied, not fetched again; the field still gets its own section and log line', async () => {
  // find a title two fields share (there are a few dozen: Big O notation, TLS, …)
  let pair = null;
  outer: for (const a of S.DOMAINS) {
    for (let i = 0; i < a.topics.length; i++) {
      const key = `${a.topics[i].k}|${a.topics[i].t.toLowerCase()}`;
      for (const b of S.DOMAINS) {
        if (b.id === a.id) continue;
        const j = b.topics.findIndex((t) => `${t.k}|${t.t.toLowerCase()}` === key);
        if (j >= 0) {
          pair = { a, i, b, j };
          break outer;
        }
      }
    }
  }
  assert.ok(pair, 'the curriculum has at least one title shared by two fields');
  const { a, i, b, j } = pair;
  const st = new MemStorage();
  const lib = new Library(st, {});
  // field A has read up to and including the shared title, and its notebook holds the section
  const prior = await S.loadStudy(st);
  prior.cursor[a.id] = i + 1;
  prior.cursor[b.id] = j; // field B is about to read the same title
  prior.focus = [b.id];
  await st.put(S.STUDY_KEY, prior);
  lib.createDoc({ id: `read_${a.id}`, title: `Reading: ${a.name}`, source: 'self-study', kind: 'study' });
  const heading = a.topics[i].t.slice(0, 180);
  await lib.addPassages(`read_${a.id}`, [{ text: `${a.topics[i].t}\nSource: https://en.wikipedia.org/wiki/Shared\n\n${'Shared text that was read once already. '.repeat(12)}`, heading }]);
  lib.finish(`read_${a.id}`);
  seen.length = 0;
  const r = await S.studySession(st, lib, { reads: 1 });
  assert.equal(r.did.reads, 1);
  assert.equal(r.state.last.topic, b.topics[j].t);
  assert.ok(!seen.some((h) => /wikipedia|mdn|arxiv|swift|openstax/.test(h)), `nothing was fetched: ${seen.join(', ')}`);
  assert.ok(lib.sectionText(`read_${b.id}`, b.topics[j].t.slice(0, 180)).includes('Shared text that was read once already'), 'field B has its own copy');
  assert.ok(lib.passagesOf('notes_study').passages.some((p) => /^Studied: /.test(p.heading) && /copied .* from the .* notebook, already read/.test(p.text)), 'the log says it was copied');
  assert.equal(r.state.cursor[b.id], j + 1);
});

test("the Swift book's oddly named chapters resolve to their real pages", async () => {
  assert.equal(await S.findSource('A Swift Tour', 'swift'), 'https://docs.swift.org/swift-book/documentation/the-swift-programming-language/guidedtour/');
  assert.equal(await S.findSource('Structures and Classes', 'swift'), 'https://docs.swift.org/swift-book/documentation/the-swift-programming-language/classesandstructures/');
  assert.equal(await S.findSource('Opaque and Boxed Protocol Types', 'swift'), 'https://docs.swift.org/swift-book/documentation/the-swift-programming-language/opaquetypes/');
  assert.equal(await S.findSource('Optional Chaining', 'swift'), 'https://docs.swift.org/swift-book/documentation/the-swift-programming-language/optionalchaining/');
});

test("a pre-2007 arXiv id (archive/NNNNNNN) is found and read like a new-style one", async () => {
  assert.equal(await S.findSource('Polynomial-Time Algorithms for Prime Factorization and Discrete Logarithms', 'arxiv'), 'quant-ph/9508027');
  assert.equal(await S.findSource('A paper on things', 'arxiv'), '2301.00001');
  const old = await S.readSource('quant-ph/9508027');
  assert.equal(old.url, 'https://arxiv.org/abs/quant-ph/9508027');
  assert.equal(old.title, 'A paper on things');
  assert.ok(/Abstract: /.test(old.text));
  const versioned = await S.readSource('cs.LG/0101001v3');
  assert.equal(versioned.url, 'https://arxiv.org/abs/cs.LG/0101001');
});

test('a classic text is found by its Project Gutenberg number and read without the licence text', async () => {
  const url = await S.findSource('2680 Meditations', 'gutenberg');
  assert.equal(url, 'https://www.gutenberg.org/cache/epub/2680/pg2680.txt');
  assert.equal(await S.findSource('Meditations', 'gutenberg'), null, 'no number, no source');
  const got = await S.readSource(url);
  assert.equal(got.title, 'Book 2680 — An Author');
  assert.equal(got.url, 'https://www.gutenberg.org/ebooks/2680');
  assert.match(got.text, /^Book 2680 — An Author\n\nTHE FIRST BOOK\n\nbook 2680 is explained here/);
  assert.ok(!/Licence text|PROJECT GUTENBERG/.test(got.text), 'header and footer are left out');
});

test('switched off, it does nothing', async () => {
  const st = new MemStorage();
  st.m.set(S.STUDY_KEY, { on: false });
  const n = seen.length;
  const r = await S.studySession(st, new Library(st, {}));
  assert.equal(r.state.sessions, 0);
  assert.deepEqual(r.did, { reads: 0, digests: 0, drills: 0 });
  assert.equal(r.next, HOUR);
  assert.equal(seen.length, n);
});

/** A fake model: writes a study note for a digest, and answers a drill (right or wrong, as asked). */
function fakeAi(log, { right = true } = {}) {
  return async (system, user) => {
    log.push({ system, user });
    if (/study note/.test(system)) return `SUMMARY\nA note on ${user.split('\n')[0].replace('TOPIC: ', '')}.\nKEY FACTS\n1. It exists.\nWORKED EXAMPLE OR PITFALL\nUse it well.\nSELF-TEST\nQ: What is it?\nA: A thing.`;
    // a drill: find which question this is, and answer it
    for (let seed = 1; seed <= 12; seed++) for (let i = 0; i < D.SKILLS.length; i++) {
      const d = D.makeDrill(i, seed);
      if (d.q === user) return right ? `Working it out…\nAnswer: ${d.answer}` : 'Answer: zzz 999999.5';
    }
    throw new Error(`unknown drill: ${user}`);
  };
}

test("with a model: each reading is digested into the domain's study notes, and a drill is set, answered and graded", async () => {
  const st = new MemStorage();
  const lib = new Library(st, {});
  const calls = [];
  const r = await S.studySession(st, lib, { reads: 1, ai: fakeAi(calls) });
  assert.deepEqual(r.did, { reads: 1, digests: 1, drills: 1 });
  assert.equal(calls.length, 2);
  assert.match(calls[0].user, /^TOPIC: /);
  assert.ok(calls[0].user.length < 7400, 'the text sent to the model is capped');
  const digest = lib.doc(`digest_${first.id}`);
  assert.equal(digest.kind, 'digest');
  assert.equal(digest.passages, 1);
  assert.match(lib.sectionText(digest.id, first.topics[0].t.slice(0, 180)), /SUMMARY[\s\S]*SELF-TEST/);
  assert.equal(r.state.domains[first.id].digested, 1);
  assert.deepEqual(r.state.today, { reads: 1, digests: 1, drills: 1, ai: 2 });
  assert.equal(r.state.drills, 1);
  assert.equal(r.state.right, 1);
  const [skill, score] = Object.entries(r.state.skills)[0];
  assert.deepEqual(score, { n: 1, right: 1, streak: 1 });
  assert.equal(r.state.last.kind, 'drill');
  assert.equal(r.state.last.title, 'right');
  const quiz = lib.doc('study_quiz');
  assert.equal(quiz.passages, 1);
  assert.match(lib.sectionText(quiz.id, `${skill} · right`), /Result: RIGHT/);
  // a wrong answer is logged with the correct one, and the skill's streak breaks
  const r2 = await S.studySession(st, lib, { reads: 0, ai: fakeAi([], { right: false }) });
  assert.equal(r2.did.drills, 1);
  assert.equal(r2.state.right, 1);
  assert.equal(r2.state.drills, 2);
  assert.match(r2.state.last.title, /^wrong \(correct: /);
  const wrong = lib.passagesOf('study_quiz').passages.find((p) => /wrong$/.test(p.heading));
  assert.match(wrong.text, /Result: WRONG — correct answer: /);
  const sum = S.studySummary(r2.state);
  assert.equal(sum.drills.asked, 2);
  assert.equal(sum.drills.right, 1);
  assert.equal(sum.read, 1);
  assert.equal(sum.digested, 1);
  assert.equal(sum.topics, S.TOPIC_COUNT);
});

test('no model reachable: readings wait as pending digests, and are digested when a model is back', async () => {
  const st = new MemStorage();
  const lib = new Library(st, {});
  const down = async () => { throw new Error('Every model I can reach is cooling down'); };
  const r1 = await S.studySession(st, lib, { reads: 2, ai: down });
  assert.equal(r1.did.reads, 2, 'reading needs no model');
  assert.equal(r1.did.digests, 0);
  assert.equal(r1.did.drills, 0, 'no drill either: the rest waits for the next session');
  assert.equal(r1.state.pending.length, 2);
  assert.equal(r1.state.today.ai, 1, 'one try, then it stopped asking');
  const calls = [];
  const r2 = await S.studySession(st, lib, { reads: 0, ai: fakeAi(calls), aiCalls: 3 });
  assert.equal(r2.did.digests, 2, 'the pending readings were digested from the notebooks');
  assert.equal(r2.did.drills, 1);
  assert.equal(r2.state.pending.length, 0);
  assert.equal(lib.doc(`digest_${first.id}`).passages, 1);
  assert.equal(lib.doc(`digest_${second.id}`).passages, 1);
});

test("while the day's database allowance is running low, nothing is written and it waits for the reset", async () => {
  const st = new MemStorage();
  const lib = new Library(st, {});
  const n = seen.length;
  const now = Date.UTC(2026, 9, 16, 15, 0);
  const r = await S.studySession(st, lib, { spare: false, now });
  assert.deepEqual(r.did, { reads: 0, digests: 0, drills: 0 });
  assert.equal(r.state.sessions, 0);
  assert.match(r.state.last.error, /database allowance/);
  assert.equal(r.next, 9 * HOUR + 5 * 60_000, 'back five minutes after midnight UTC');
  assert.equal(seen.length, n);
  assert.equal(lib.list().length, 0);
});

test("the day's caps hold: reads stop at the daily cap, counts reset on a new day", async () => {
  const st = new MemStorage();
  const lib = new Library(st, {});
  const now = Date.UTC(2026, 9, 16, 15, 0);
  const r1 = await S.studySession(st, lib, { reads: 3, dailyReads: 2, now });
  assert.equal(r1.did.reads, 2);
  assert.equal(r1.state.day, '2026-10-16');
  assert.ok(r1.next >= 9 * HOUR, 'capped for the day: back after the reset');
  const r2 = await S.studySession(st, lib, { reads: 3, dailyReads: 2, now: now + 86_400_000 });
  assert.equal(r2.state.day, '2026-10-17');
  assert.equal(r2.did.reads, 2, 'a new day, a new allowance');
  assert.equal(r2.state.i, 4);
});

test("the owner's focus domains come first; matchDomains understands plain words", async () => {
  const st = new MemStorage();
  const lib = new Library(st, {});
  st.m.set(S.STUDY_KEY, { focus: [second.id] });
  const r = await S.studySession(st, lib, { reads: 1 });
  assert.equal(r.state.last.topic, second.topics[0].t);
  const sum = S.studySummary(r.state);
  const row = sum.domains.find((d) => d.id === second.id);
  assert.equal(row.read, 1);
  assert.equal(row.focus, true);
  assert.equal(row.topics, second.topics.length);
  assert.equal(S.matchDomains(`please focus on ${second.name.toLowerCase()}`)[0], second.id);
  assert.deepEqual(S.matchDomains(second.id), [second.id]);
  assert.deepEqual(S.matchDomains('data structures and algorithms'), ['algorithms-data-structures'], 'the most words matched wins: not databases too');
  assert.deepEqual(S.matchDomains('focus on operating systems please'), ['computer-architecture-os'], 'two words beat one');
  assert.deepEqual(S.matchDomains('swift and python'), ['python', 'swift-ios'].filter((id) => S.DOMAINS.some((d) => d.id === id)).sort(), 'a tie keeps both');
  assert.deepEqual(S.matchDomains('zzzz qqqq'), []);
  assert.deepEqual(S.matchDomains('please focus on the'), []);
});

test('the curriculum is real: every domain has topics at every level, from a known source kind, and no duplicates', () => {
  assert.ok(S.DOMAINS.length >= 1);
  assert.equal(S.TOPIC_COUNT, S.DOMAINS.reduce((n, d) => n + d.topics.length, 0));
  const ids = new Set();
  for (const d of S.DOMAINS) {
    assert.ok(!ids.has(d.id), `duplicate domain ${d.id}`);
    ids.add(d.id);
    assert.ok(d.topics.length >= 20, `${d.id}: ${d.topics.length} topics`);
    assert.ok(d.why.length > 10);
    const titles = new Set();
    for (const t of d.topics) {
      assert.ok(['wiki', 'wikibooks', 'wikiversity', 'mdn', 'arxiv', 'swift', 'openstax', 'gutenberg'].includes(t.k), `${d.id}: ${t.k}`);
      assert.ok([1, 2, 3].includes(t.l));
      assert.ok(!titles.has(t.k + t.t), `${d.id}: duplicate topic ${t.t}`);
      titles.add(t.k + t.t);
    }
    assert.ok(d.topics.some((t) => t.l === 1) && d.topics.some((t) => t.l === 3), `${d.id}: basics and advanced`);
  }
});

test('in the brain: the Library tab turns it on, STUDY NOW studies at once, the job runs from the alarm and re-arms on its own cadence, focus and off work', async () => {
  const storage = new MemStorage();
  const pending = [];
  const state = { storage, waitUntil: (p) => pending.push(p), blockConcurrencyWhile: (f) => f() };
  // no model at all: readings still happen (digests wait as pending)
  const agent = new brain.GhostyAgent(state, { VAULT_KEY: Buffer.alloc(32, 7).toString('base64'), KEYLESS_MODELS: '0' });
  const api = async (method, path, body) => {
    const r = await agent.fetch(new Request(`https://ghosty.test/api${path}`, { method, ...(body ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}) }));
    return r.json();
  };
  const t0 = Date.now();
  const on = await api('POST', '/library/study', { on: true });
  assert.equal(on.on, true);
  const st1 = await api('GET', '/library/study');
  assert.ok(st1.next >= t0 + 9 * 60_000 && st1.next <= t0 + 11 * 60_000, 'the first session is ten minutes away');
  assert.equal(st1.summary.topics, S.TOPIC_COUNT);
  assert.equal(st1.summary.read, 0);
  const now = await api('POST', '/library/study', { now: true });
  assert.equal(now.did.reads, 3, 'STUDY NOW reads at once');
  assert.equal(now.did.digests, 0);
  assert.equal(now.pending.length, 3, 'digests wait for a model');
  assert.ok(now.next > Date.now() + 14 * 60_000, 'back in a quarter of an hour');
  const lib = await api('GET', '/library');
  const notebook = lib.docs.find((d) => d.id === `read_${first.id}`);
  assert.equal(notebook?.kind, 'study');
  assert.ok(notebook.passages >= 1);
  assert.equal(lib.docs.filter((d) => d.id.startsWith('read_')).length, Math.min(3, S.DOMAINS.length), 'one topic from each field in turn');
  // the alarm runs the job and the engine sets the next run
  const jobs = storage.m.get('jobs');
  assert.equal(jobs.filter((j) => j.kind === 'study').length, 1);
  jobs.find((j) => j.kind === 'study').next = Date.now() - 1000;
  storage.m.set('jobs', jobs);
  await agent.alarm();
  const st2 = await api('GET', '/library/study');
  assert.equal(st2.sessions, 2);
  assert.equal(st2.summary.read, 6);
  assert.ok(st2.next > Date.now() + 14 * 60_000 && st2.next < Date.now() + 16 * 60_000, `re-armed by the engine: ${st2.next - Date.now()} ms`);
  assert.equal((await api('GET', '/inbox')).items.length, 0, 'quiet: no notification per session');
  // focus, in the owner's words
  const f = await api('POST', '/library/study', { focus: `${second.name} please` });
  assert.deepEqual(f.focus, [second.id]);
  assert.equal((await api('GET', '/library/study')).summary.domains.find((d) => d.id === second.id).focus, true);
  assert.deepEqual((await api('POST', '/library/study', { focus: 'none' })).focus, []);
  // off: the job goes
  const off = await api('POST', '/library/study', { on: false });
  assert.equal(off.on, false);
  assert.equal((await api('GET', '/library/study')).next, null);
  assert.equal(storage.m.get('jobs').filter((j) => j.kind === 'study').length, 0);
});
