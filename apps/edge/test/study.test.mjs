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
  // one field at a time: the first field's first two topics, nothing from the second
  assert.equal(r1.state.cursor[first.id], 2);
  assert.equal(r1.state.cursor[second.id], undefined);
  assert.equal(r1.state.last.topic, first.topics[1].t);
  assert.equal(r1.state.last.kind, 'read');
  assert.ok(r1.state.last.passages >= 1);
  assert.equal(r1.next, S.QUICK_TICK, 'more to read and room: the next session almost at once');
  const doc = lib.doc(`read_${first.id}`);
  assert.ok(doc && !lib.doc(`read_${second.id}`), 'one notebook per field, and only the field being read');
  assert.equal(doc.kind, 'study');
  assert.equal(doc.status, 'ready');
  assert.match(doc.title, new RegExp(`^Reading: ${first.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  const hits = await lib.search(first.topics[0].t);
  assert.ok(hits.some((h) => h.title === doc.title), 'what it read is searchable');
  assert.equal(lib.doc('notes_study').passages, 2, 'the study log has one entry per reading');
  assert.equal(r1.state.domains[first.id].read, 2);
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
  prior.grown[b.id] = { n: 0, wk: String(Math.floor(Date.now() / (7 * 86_400_000))), added: 0, found: 0, at: Date.now() }; // this week's outline look is done
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
  assert.deepEqual(r.state.today, { reads: 1, digests: 1, drills: 1, ai: 2, finished: 0, quick: 1 });
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
  assert.equal(lib.doc(`digest_${first.id}`).passages, 2, 'both readings were from the field being read');
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

test('in the brain: the Library tab turns it on, STUDY studies at once and brings the job forward, the job runs from the alarm and re-arms on its own cadence, focus and off work', async () => {
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
  assert.equal(now.did.reads, 5, 'STUDY reads a handful at once');
  assert.equal(now.did.digests, 0);
  assert.equal(now.pending.length, 5, 'digests wait for a model');
  assert.ok(now.next <= Date.now() + S.QUICK_TICK + 1000, 'the rest of the field follows almost at once');
  const hurried = storage.m.get('jobs').find((j) => j.kind === 'study');
  assert.ok(hurried.next <= Date.now() + S.QUICK_TICK + 1000, `STUDY ran outside the alarm, and the job was brought forward: ${hurried.next - Date.now()} ms`);
  const lib = await api('GET', '/library');
  const notebook = lib.docs.find((d) => d.id === `read_${first.id}`);
  assert.equal(notebook?.kind, 'study');
  assert.ok(notebook.passages >= 1);
  assert.equal(lib.docs.filter((d) => d.id.startsWith('read_')).length, 1, 'one field at a time: every piece from the same field');
  assert.equal(now.summary.current.id, first.id);
  assert.match(now.summary.status, new RegExp(`^Reading .* · 5 of ${first.topics.length} · `));
  // the alarm runs the job and the engine sets the next run
  const jobs = storage.m.get('jobs');
  assert.equal(jobs.filter((j) => j.kind === 'study').length, 1);
  jobs.find((j) => j.kind === 'study').next = Date.now() - 1000;
  storage.m.set('jobs', jobs);
  await agent.alarm();
  const st2 = await api('GET', '/library/study');
  assert.equal(st2.sessions, 2);
  assert.equal(st2.summary.read, 10);
  assert.ok(st2.next > Date.now() && st2.next <= Date.now() + S.QUICK_TICK + 1000, `re-armed by the engine, at once: ${st2.next - Date.now()} ms`);
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

test("levels: a topic's level comes from its place in the field (first third beginner, then intermediate, then advanced), the cursor reads them in that order, and the summary counts them", async () => {
  assert.deepEqual([S.topicLevel(0, 30), S.topicLevel(9, 30), S.topicLevel(10, 30), S.topicLevel(19, 30), S.topicLevel(20, 30), S.topicLevel(29, 30)], ['beginner', 'beginner', 'intermediate', 'intermediate', 'advanced', 'advanced']);
  assert.equal(S.topicLevel(0, 0), 'beginner');
  assert.deepEqual(S.LEVELS, ['beginner', 'intermediate', 'advanced']);
  const st = new MemStorage();
  const lib = new Library(st, {});
  const none = S.studySummary(await S.loadStudy(st));
  assert.deepEqual(none.levels.map((l) => l.level), ['beginner', 'intermediate', 'advanced']);
  assert.equal(none.levels.reduce((n, l) => n + l.topics, 0), S.TOPIC_COUNT, 'every topic has one level');
  assert.ok(none.levels.every((l) => l.read === 0));
  // reading the first field from the start: its beginner third fills before anything intermediate
  const n = first.topics.length;
  const third = Math.ceil(n / 3);
  st.m.set(S.STUDY_KEY, { focus: [first.id] });
  const r = await S.studySession(st, lib, { reads: 2 });
  assert.equal(r.state.cursor[first.id], 2, 'the picker walks the field from its first topic');
  const sum = S.studySummary(r.state);
  assert.equal(sum.levels[0].read, 2);
  assert.equal(sum.levels[1].read, 0);
  assert.equal(sum.levels[2].read, 0);
  // a field read past its beginner third shows intermediate progress; the whole field read fills advanced too
  const mid = S.studySummary({ ...r.state, cursor: { [first.id]: third + 1 } });
  assert.equal(mid.levels[0].read, third);
  assert.equal(mid.levels[1].read, 1);
  const all = S.studySummary({ ...r.state, cursor: { [first.id]: n } });
  assert.equal(all.levels.reduce((k, l) => k + l.read, 0), n);
  assert.ok(all.levels[2].read > 0);
});

// ---------- STUDY at scale: one field at a time, hundreds at once, on his own, a curriculum that grows ----------

/** Outline pages served for the growth tests: title → HTML (Wikipedia's rendered page); others answer 404. */
let outlinePages = null;
const plainFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  if (outlinePages && url.hostname === 'en.wikipedia.org' && url.pathname === '/w/index.php') {
    seen.push(url.hostname + url.pathname);
    const page = outlinePages[url.searchParams.get('title').replace(/_/g, ' ')];
    return page ? new Response(page, { headers: { 'content-type': 'text/html' } }) : new Response('no such page', { status: 404 });
  }
  return plainFetch(input, init);
};
const WEEK = 7 * 86_400_000;
const thisWeek = (now = Date.now()) => String(Math.floor(now / WEEK));
/** The study log's headings, oldest first: what was read, in order. */
const studied = (lib) => lib.passagesOf('notes_study', 0, 500).passages.map((p) => p.heading).filter((h) => h.startsWith('Studied: ')).map((h) => h.slice(9));

test('one field at a time: every piece of the field being read before the next, the focus first, a finished field marked and not read again', async () => {
  const st = new MemStorage();
  const lib = new Library(st, {});
  const n = second.topics.length;
  const prior = await S.loadStudy(st);
  prior.focus = [second.id];
  prior.cursor[second.id] = n - 3; // three pieces left in the focus field
  prior.grown[second.id] = { n: 0, wk: thisWeek(), added: 0, found: 0, at: Date.now() };
  await st.put(S.STUDY_KEY, prior);
  assert.deepEqual((await S.loadStudy(st)).queue, [second.id, first.id], 'the focus field heads the queue, the field already queued waits behind it');
  const r = await S.studySession(st, lib, { reads: 5 });
  assert.deepEqual(studied(lib), [...second.topics.slice(n - 3).map((t) => t.t), ...first.topics.slice(0, 2).map((t) => t.t)], 'the rest of the focus field, then the curriculum from its first field: never a mix');
  assert.ok(r.state.finished[second.id], 'the field read to the end is marked finished');
  assert.equal(r.state.today.finished, 1);
  assert.deepEqual(r.state.queue, [first.id], 'and the next field in the curriculum is being read');
  assert.equal(r.state.cursor[first.id], 2);
  // the finished field is not read again, though it is still the focus…
  const r2 = await S.studySession(st, lib, { reads: 3 });
  assert.deepEqual(studied(lib).slice(5), first.topics.slice(2, 5).map((t) => t.t));
  assert.equal(r2.state.cursor[second.id], n);
  // …unless the owner puts it first again (out of the focus, then back in)
  const again = await S.loadStudy(st);
  again.focus = [];
  await st.put(S.STUDY_KEY, again);
  const back = await S.loadStudy(st);
  back.focus = [second.id];
  await st.put(S.STUDY_KEY, back);
  const r3 = await S.studySession(st, lib, { reads: 1 });
  assert.equal(r3.state.last.topic, second.topics[0].t, 'asked again: read again from its start');
  assert.equal(r3.state.finished[second.id], undefined);
});

test('a session does many pieces but stays within its caps; drills stay a quarter of an hour apart while reading runs fast', async () => {
  const st = new MemStorage();
  const lib = new Library(st, {});
  const t0 = Date.UTC(2026, 9, 23, 12, 0);
  const prior = await S.loadStudy(st);
  prior.grown[first.id] = { n: 0, wk: thisWeek(t0), added: 0, found: 0, at: t0 };
  await st.put(S.STUDY_KEY, prior);
  const calls = [];
  const before = seen.length;
  const r = await S.studySession(st, lib, { ai: fakeAi(calls), now: t0 });
  assert.equal(r.did.reads, 5, 'a handful of pieces a session by default');
  assert.equal(r.did.digests, 5, 'each one digested while the text is in hand');
  assert.equal(r.did.drills, 1);
  assert.equal(calls.length, 6, 'model calls a session are capped');
  assert.ok(seen.length - before <= 5 * 2, `page reads stay bounded: ${seen.length - before}`);
  const r2 = await S.studySession(st, lib, { ai: fakeAi(calls), now: t0 + 20_000 });
  assert.equal(r2.did.reads, 5);
  assert.equal(r2.did.drills, 0, 'no drill twenty seconds after the last one');
  const r3 = await S.studySession(st, lib, { ai: fakeAi(calls), now: t0 + 16 * 60_000 });
  assert.equal(r3.did.drills, 1, 'a quarter of an hour later, the next drill');
  // the day's caps still hold
  const r4 = await S.studySession(st, lib, { now: t0 + 17 * 60_000, dailyReads: 17 });
  assert.equal(r4.did.reads, 2);
  assert.equal(r4.state.today.reads, 17);
});

test('the next session is almost at once while there is reading and room; it backs off when the meter says no, and after the quick sessions of the day', async () => {
  const st = new MemStorage();
  const lib = new Library(st, {});
  const t0 = Date.UTC(2026, 9, 23, 15, 0);
  const prior = await S.loadStudy(st);
  prior.grown[first.id] = { n: 0, wk: thisWeek(t0), added: 0, found: 0, at: t0 };
  await st.put(S.STUDY_KEY, prior);
  const r1 = await S.studySession(st, lib, { reads: 2, now: t0 });
  assert.equal(r1.next, S.QUICK_TICK);
  assert.ok(S.QUICK_TICK <= 30_000, 'at once, not a quarter of an hour later');
  assert.equal(r1.state.today.quick, 1);
  // the database allowance running low: nothing is read, and it waits for the reset
  const n = seen.length;
  const low = await S.studySession(st, lib, { reads: 2, now: t0 + 60_000, spare: false });
  assert.equal(low.did.reads, 0);
  assert.equal(seen.length, n);
  assert.equal(low.next, 9 * HOUR + 4 * 60_000, 'five minutes after midnight UTC');
  // the day's quick sessions used up (each alarm writes to KV): every quarter of an hour instead
  const used = await S.loadStudy(st);
  used.today.quick = S.QUICK_TICKS;
  await st.put(S.STUDY_KEY, used);
  const slow = await S.studySession(st, lib, { reads: 2, now: t0 + 2 * 60_000 });
  assert.equal(slow.did.reads, 2);
  assert.equal(slow.next, QUARTER);
  // a source down: nothing read, so no hurry
  wikiDown = true;
  const fresh = await S.loadStudy(st);
  fresh.today.quick = 0;
  fresh.queue = [];
  fresh.focus = ['algebra-number-theory'];
  fresh.grown['algebra-number-theory'] = { n: 0, wk: thisWeek(t0), added: 0, found: 0, at: t0 };
  await st.put(S.STUDY_KEY, fresh);
  const down = await S.studySession(st, lib, { reads: 2, now: t0 + 3 * 60_000 });
  wikiDown = false;
  assert.equal(down.did.reads, 0);
  assert.equal(down.next, HOUR);
});

test('STUDY ALL: with nothing queued it queues the next unfinished field itself; switched off it waits for STUDY; the switch is FOCUS words, remembered', async () => {
  const st = new MemStorage();
  const lib = new Library(st, {});
  const prior = await S.loadStudy(st);
  assert.equal(prior.all, true, 'on by default');
  assert.deepEqual(prior.queue, [first.id], 'the curriculum from its first field');
  prior.finished[first.id] = Date.now();
  prior.grown[first.id] = { n: 0, wk: thisWeek(), added: 0, found: 0, at: Date.now() };
  prior.grown[second.id] = { n: 0, wk: thisWeek(), added: 0, found: 0, at: Date.now() };
  await st.put(S.STUDY_KEY, prior);
  assert.deepEqual((await S.loadStudy(st)).queue, [second.id], 'the next unfinished field');
  const r = await S.studySession(st, lib, { reads: 1 });
  assert.equal(r.state.last.topic, second.topics[0].t);
  // off: the Library tab sends the switch as FOCUS words, as the route stores them
  assert.deepEqual(S.matchDomains(`${S.ALL_OFF}, ${second.id}`), [S.ALL_OFF, second.id]);
  assert.deepEqual(S.matchDomains('study all off'), [S.ALL_OFF]);
  const off = await S.loadStudy(st);
  off.focus = S.matchDomains(S.ALL_OFF);
  off.queue = [];
  await st.put(S.STUDY_KEY, off);
  const quiet = await S.loadStudy(st);
  assert.equal(quiet.all, false);
  assert.deepEqual(quiet.focus, [], 'a setting, not a field');
  assert.deepEqual(quiet.queue, []);
  const idle = await S.studySession(st, lib, { reads: 3 });
  assert.equal(idle.did.reads, 0, 'nothing queued and STUDY ALL off: nothing read');
  assert.equal(idle.next, HOUR);
  assert.equal((await S.loadStudy(st)).all, false, 'remembered');
  // STUDY on a field queues it even with STUDY ALL off
  const pick = await S.loadStudy(st);
  pick.focus = S.matchDomains(second.id);
  await st.put(S.STUDY_KEY, pick);
  const sent = await S.studySession(st, lib, { reads: 1 });
  assert.equal(sent.did.reads, 1);
  assert.equal(sent.state.all, false);
  // and on again
  const on = await S.loadStudy(st);
  on.focus = S.matchDomains(`study all on, ${second.id}`);
  await st.put(S.STUDY_KEY, on);
  const back = await S.loadStudy(st);
  assert.equal(back.all, true);
  assert.deepEqual(back.focus, [second.id]);
  assert.equal(S.studySummary(back).all, true);
});

/** A rendered outline page: links in nested lists under h2/h3, plus what must be left out. */
function outlinePage(items) {
  const li = (t, desc = '') => `<li><a rel="mw:WikiLink" href="./${encodeURIComponent(t.replace(/ /g, '_'))}" title="${t}">${t}</a>${desc}</li>`;
  const basic = items.filter((x) => x.l === 1).map((x) => li(x.t, ' – about it, see <a href="/wiki/Description_link">description link</a>')).join('');
  const mid = items.filter((x) => x.l === 2).map((x) => li(x.t)).join('');
  const adv = items.filter((x) => x.l === 3).map((x) => li(x.t)).join('');
  return `<div class="mw-parser-output"><table class="sidebar"><tr><td><ul>${li('Sidebar link')}</ul></td></tr></table>
<p>The following outline is a guide to <a href="/wiki/Algebra">algebra</a>:</p>
<div class="mw-heading mw-heading2"><h2 id="Branches">Branches</h2></div>
<ul>${basic}<li><a href="/wiki/Topics_in_general">Topics in general</a><ul>${mid}</ul></li></ul>
<div class="mw-heading mw-heading3"><h3 id="Advanced">Advanced</h3></div>
<ul><li><a href="/wiki/Advanced_matters">Advanced matters</a><ul>${adv}</ul></li></ul>
<h2 id="Algebraists">Influential mathematicians</h2><ul>${li('A Famous Mathematician')}</ul>
<h2 id="See_also">See also</h2><ul>${li('See also link')}${li('List of algebra topics')}</ul>
<div class="navbox"><ul>${li('Nav link')}</ul></div></div>`;
}

test('the curriculum grows from Wikipedia outlines: new, deduplicated topics with a rough level, basics first, capped at 200 a field a week, counted in the status', async () => {
  const field = S.DOMAINS.find((d) => d.id === 'algebra-number-theory');
  assert.ok(field, 'the algebra field');
  const own = field.topics.find((t) => t.k === 'wiki').t; // already in this field's curriculum
  const elsewhere = S.DOMAINS.find((d) => d.id !== field.id).topics.find((t) => t.k === 'wiki').t; // in another field's
  const items = [];
  for (let i = 0; i < 250; i++) items.push({ t: `Algebra topic ${i}`, l: i < 100 ? 1 : i < 200 ? 2 : 3 });
  const page2 = [...Array.from({ length: 60 }, (_, i) => ({ t: `Algebra topic ${240 + i}`, l: 1 })), { t: own, l: 1 }, { t: elsewhere, l: 1 }, { t: 'algebra topic 3', l: 1 }];
  outlinePages = { 'Outline of algebra': outlinePage(items), 'Outline of algebraic structures': outlinePage(page2) }; // the third page answers 404
  try {
    const links = S.outlineLinks(outlinePage(items), 'Outline of algebra');
    assert.equal(links.length, 252, "every list item's subject (the 250 and their two parent items), nothing else");
    for (const bad of ['Sidebar link', 'Description link', 'See also link', 'List of algebra topics', 'Nav link', 'A Famous Mathematician', 'Algebra']) assert.ok(!links.some((x) => x.t === bad), `left out: ${bad}`);
    assert.deepEqual(links.find((x) => x.t === 'Algebra topic 0'), { t: 'Algebra topic 0', l: 1 }, 'a top-level item under an h2: basic');
    assert.equal(links.find((x) => x.t === 'Algebra topic 150').l, 2, 'nested once: intermediate');
    assert.equal(links.find((x) => x.t === 'Algebra topic 220').l, 3, 'nested under an h3: advanced');

    const st = new MemStorage();
    const lib = new Library(st, {});
    const t0 = Date.UTC(2026, 9, 23, 9, 0);
    const prior = await S.loadStudy(st);
    prior.focus = [field.id];
    prior.cursor[field.id] = field.topics.length; // its own curriculum is read
    await st.put(S.STUDY_KEY, prior);
    const r1 = await S.studySession(st, lib, { reads: 2, now: t0 });
    const g = r1.state.grown[field.id];
    assert.equal(g.found, 302, "found: the 252 of the first page and 50 new on the second (its repeats and the curriculum's own topics left out)");
    assert.equal(g.added, 200, 'capped at 200 this week');
    assert.equal(g.n, 200);
    const more = await S.grownTopics(st, field.id);
    assert.equal(more.length, 200);
    assert.ok(more.every((t) => t.k === 'wikipage'), 'read by exact title');
    assert.equal(new Set(more.map((t) => t.t.toLowerCase())).size, 200, 'no duplicates');
    assert.ok(!more.some((t) => [own, elsewhere].includes(t.t)), 'nothing the curriculum already has');
    assert.deepEqual(more.map((t) => t.l), [...more.map((t) => t.l)].sort(), 'basics first');
    assert.equal(more.filter((t) => t.l === 1).length, 151, 'the 100 + 1 basics of the first page and the 50 new of the second');
    assert.equal(r1.did.reads, 2, 'and reading carried on into what was added');
    assert.equal(r1.state.last.topic, more[1].t);
    const sum = S.studySummary(r1.state);
    assert.equal(sum.topics, S.TOPIC_COUNT + 200);
    assert.equal(sum.grown.topics, 200);
    assert.equal(sum.current.topics, field.topics.length + 200);
    assert.ok(lib.passagesOf('notes_study').passages.some((p) => /^More to read: /.test(p.heading) && /added 200 new topics .*102 more wait for next week/.test(p.text)), 'and said so in the study log');
    // the same week: no second look
    const looks = seen.filter((h) => h.endsWith('/w/index.php')).length;
    await S.studySession(st, lib, { reads: 1, now: t0 + HOUR });
    assert.equal(seen.filter((h) => h.endsWith('/w/index.php')).length, looks, 'one look a week');
    // the next week: the rest, then nothing new
    const r3 = await S.studySession(st, lib, { reads: 1, now: t0 + WEEK });
    assert.equal(r3.state.grown[field.id].added, 102);
    assert.equal(r3.state.grown[field.id].n, 302);
    const r4 = await S.studySession(st, lib, { reads: 1, now: t0 + 2 * WEEK });
    assert.equal(r4.state.grown[field.id].added, 0);
    assert.equal((await S.grownTopics(st, field.id)).length, 302);
    // Wikipedia unreachable: no look counted, tried again later
    outlinePages = {};
    const st2 = new MemStorage();
    const p2 = await S.loadStudy(st2);
    p2.focus = [field.id];
    await st2.put(S.STUDY_KEY, p2);
    const failed = await S.studySession(st2, new Library(st2, {}), { reads: 1, now: t0 });
    assert.equal(failed.state.grown[field.id].fail, t0);
    assert.equal(failed.state.grown[field.id].wk, '');
    assert.equal(failed.did.reads, 1, 'its own curriculum is read meanwhile');
  } finally {
    outlinePages = null;
  }
});

test('the status line is honest: "Reading <field> · x of y · about … left at this pace", from the measured pace', async () => {
  const st = new MemStorage();
  const now = Date.UTC(2026, 9, 23, 18, 0);
  const s0 = await S.loadStudy(st);
  s0.grown[first.id] = { n: 480 - first.topics.length, wk: thisWeek(now), added: 0, found: 0, at: now };
  s0.cursor[first.id] = 212;
  const fresh = S.studySummary(s0, now);
  assert.equal(fresh.status, `Reading ${first.name} · 212 of 480 · working out the pace`, 'no pace measured yet: no guess');
  assert.equal(fresh.current.read, 212);
  assert.equal(fresh.current.topics, 480);
  // four sessions over half an hour, five pieces each: 15 pieces in the 30 minutes after the first
  s0.pace = [[now - 30 * 60_000, 5], [now - 20 * 60_000, 5], [now - 10 * 60_000, 5], [now, 5]];
  const timed = S.studySummary(s0, now);
  assert.equal(Math.round(timed.current.minutesLeft), 536);
  assert.equal(timed.status, `Reading ${first.name} · 212 of 480 · about 9 hours left at this pace`);
  // a pace measured hours ago is not this pace
  assert.match(S.studySummary(s0, now + 3 * HOUR).status, /· working out the pace$/);
  assert.equal(S.timeLeftText(40), 'about 40 minutes');
  assert.equal(S.timeLeftText(3000), 'about 2 days');
  // the line counts what the sessions really read
  const lib = new Library(st, {});
  await st.put(`study:more:${first.id}`, Array.from({ length: 480 - first.topics.length }, (_, i) => `1|wikipage|Grown topic ${i}`).join('\n'));
  await st.put(S.STUDY_KEY, { ...s0, pace: [] });
  const r = await S.studySession(st, lib, { reads: 3, now });
  assert.match(S.studySummary(r.state, now).status, / · 215 of 480 · /);
  assert.equal(S.studySummary({ ...r.state, on: false }, now).status, 'Self-study is switched off');
});
