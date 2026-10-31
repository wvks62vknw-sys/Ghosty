// Fresh knowledge every day: the feeds parsed (BBC RSS, Hacker News, arXiv RSS, Wikipedia's
// current events, and the primary and credible sources' RSS and Atom: OWNER-ISSUES 77d), filed one
// passage per source under the day's heading with its tier ("YYYY-MM-DD · source · TIER") within the
// request budget, the day in three levels only when a model is free, never twice a day on its own,
// old days let go, and the Library tab's DIGEST NOW. Network faked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sqlStorage } from '../../../tests/sqlite-storage.mjs';

const D = await import('./.build/library/digest.mjs');
const T = await import('./.build/sources/sources.mjs');
const S = await import('./.build/schedule.mjs');
const { Library } = await import('./.build/library/store.mjs');
const brain = await import('./.build/brain.mjs');

class MemStorage {
  m = new Map();
  sql = sqlStorage();
  async get(k) { return Array.isArray(k) ? new Map(k.filter((x) => this.m.has(x)).map((x) => [x, structuredClone(this.m.get(x))])) : this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
  async put(k, v) { if (typeof k === 'object') for (const [a, b] of Object.entries(k)) this.m.set(a, structuredClone(b)); else this.m.set(k, structuredClone(v)); }
  async delete(k) { return Array.isArray(k) ? k.filter((x) => this.m.delete(x)).length : this.m.delete(k); }
  async list({ prefix = '' } = {}) { return new Map([...this.m].filter(([k]) => k.startsWith(prefix))); }
  alarm = null;
  async setAlarm(t) { this.alarm = t; }
  async getAlarm() { return this.alarm; }
}

const rss = (name, n = 10) => `<?xml version="1.0"?><rss><channel><title>${name}</title>${Array.from({ length: n }, (_, i) => `<item><title><![CDATA[${name} story ${i + 1} &amp; more]]></title><description>What happened in ${name} story ${i + 1}, in a sentence &#8216;quoted&#8217;.</description><link>https://www.bbc.co.uk/news/${name.toLowerCase().replace(/\W+/g, '-')}-${i + 1}</link></item>`).join('')}</channel></rss>`;
const arxiv = (cat) => `<?xml version="1.0"?><rss><channel><title>${cat}</title>${Array.from({ length: 10 }, (_, i) => `<item><title>Paper ${i + 1} on ${cat}</title><link>https://arxiv.org/abs/2510.0${i + 10}</link><description>arXiv:2510.0${i + 10}v1 Announce Type: new \nAbstract: ${`This paper on ${cat} shows something new about learning. `.repeat(12)}</description></item>`).join('')}</channel></rss>`;
const wikitext = `== Armed conflicts ==\n* The [[Example War]] continues; a [[ceasefire|truce]] is announced.<ref>{{cite web|url=https://x|title=y}}</ref>\n** Two [[United Nations|UN]] observers arrive in [http://example.org the capital].\n* short\n== Science ==\n* '''Astronomers''' find a new {{convert|12|km}} comet.\n`;

// the newer feeds (77d): RSS for most, Atom for GOV.UK and legislation.gov.uk (shaped as they answered on 31 Oct 2026)
const atom = (name, n = 10) => `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>${name}</title>${Array.from({ length: n }, (_, i) => `<entry><id>tag:${name}-${i + 1}</id><link rel="self" href="https://${name}/id/${i + 1}"/><link rel="alternate" type="application/pdf" href="https://${name}/${i + 1}.pdf"/><link href="https://${name}/${i + 1}/made"/><title>${name} entry ${i + 1}</title>${i === 0 ? '<summary/>' : `<summary type="html">What ${name} published, number ${i + 1}.</summary>`}</entry>`).join('')}</feed>`;
const NEWER = ['news.un.org', 'www.icc-cpi.int', 'www.amnesty.org', 'www.hrw.org', 'www.icij.org', 'www.bellingcat.com', 'www.occrp.org', 'www.propublica.org', 'fullfact.org'];
let newerUp = false;
const hnHits = Array.from({ length: 30 }, (_, i) => ({ objectID: String(1000 + i), title: `HN story ${1000 + i} &amp; co`, url: i === 3 ? '' : `https://example.com/${1000 + i}`, points: 100 + ((i * 37) % 200), children: [1, 2, 3] }));

const seen = [];
let arxivDown = false;
let wikiEmpty = false;
globalThis.fetch = async (input) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  seen.push(url.hostname + url.pathname);
  const j = (o) => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json' } });
  if (url.hostname === 'feeds.bbci.co.uk') return new Response(rss(url.pathname.replace(/\/rss\.xml$/, '').split('/').filter(Boolean).join(' ') || 'news'), { headers: { 'content-type': 'application/rss+xml' } });
  if (url.hostname === 'rss.arxiv.org') return arxivDown ? new Response('slow down', { status: 429 }) : new Response(arxiv(url.pathname.split('/').pop()), { headers: { 'content-type': 'application/rss+xml' } });
  if (url.hostname === 'hn.algolia.com' && url.pathname === '/api/v1/search' && url.searchParams.get('tags') === 'front_page') return j({ hits: hnHits, nbHits: 30 });
  if (newerUp && NEWER.includes(url.hostname)) return new Response(rss(url.hostname), { headers: { 'content-type': 'application/rss+xml' } });
  if (newerUp && (url.hostname === 'www.gov.uk' || url.hostname === 'www.legislation.gov.uk')) return new Response(atom(url.hostname), { headers: { 'content-type': 'application/atom+xml' } });
  if (url.hostname === 'en.wikipedia.org') return j({ parse: { title: url.searchParams.get('page'), wikitext: wikiEmpty ? '' : wikitext } });
  return new Response('not faked', { status: 599 });
};

const NOW = Date.UTC(2026, 9, 17, 6, 10); // 17 Oct 2026 06:10 UTC

test('the parsers: RSS items with entities and CDATA, arXiv abstracts cut to 300 characters, wiki markup stripped from bullet lines', () => {
  const items = D.parseRss(rss('news'), 8);
  assert.equal(items.length, 8);
  assert.equal(items[0].title, 'news story 1 & more');
  assert.equal(items[0].description, 'What happened in news story 1, in a sentence ‘quoted’.');
  assert.equal(items[0].link, 'https://www.bbc.co.uk/news/news-1');
  const papers = D.parseArxiv(arxiv('cs.AI'), 8);
  assert.equal(papers.length, 8);
  assert.equal(papers[0].title, 'Paper 1 on cs.AI');
  assert.match(papers[0].abstract, /^This paper on cs\.AI shows something new about learning\./);
  assert.ok(papers[0].abstract.length <= 301, `${papers[0].abstract.length} characters`);
  assert.match(papers[0].abstract, /…$/);
  assert.ok(!/Announce Type|arXiv:/.test(papers[0].abstract));
  assert.deepEqual(D.wikiBullets(wikitext), ['- The Example War continues; a truce is announced.', '  - Two UN observers arrive in the capital.', '- Astronomers find a new comet.']);
  assert.deepEqual(D.hnLines([{ title: 'A &amp; B', url: 'https://a.example', score: 12 }, { url: 'x' }]), ['- A & B (12 points) — https://a.example']);
  // Hacker News' front page in one answer: the 12 with the most points, a discussion with no link its own page
  const front = D.hnFront(JSON.stringify({ hits: hnHits }));
  assert.equal(front.length, 12);
  assert.deepEqual(front.map((x) => x.score), [...front.map((x) => x.score)].sort((a, b) => b - a));
  assert.ok(front.every((x) => /^https:\/\//.test(x.url)));
  assert.equal(D.hnFront(JSON.stringify({ hits: [{ objectID: '7', title: 'Ask HN: why?', url: null, points: 3 }] }))[0].url, 'https://news.ycombinator.com/item?id=7');
  // Atom (GOV.UK, legislation.gov.uk): the entry's page, not itself or its PDF; an empty summary is no description
  const entries = D.parseRss(atom('www.legislation.gov.uk'), 8);
  assert.equal(entries.length, 8);
  assert.deepEqual(entries[0], { title: 'www.legislation.gov.uk entry 1', description: '', link: 'https://www.legislation.gov.uk/1/made' });
  assert.equal(entries[1].description, 'What www.legislation.gov.uk published, number 2.');
  // a description with its page's markup escaped, and named and hex entities; a long one cut at a word end; the page's furniture
  // before its paragraphs (a byline, a date, an image caption) and a feed's own plug or "appeared first on" left out
  const esc = D.parseRss('<rss><channel><item><title>Report &ndash; out</title><description>&lt;p&gt;Amnesty said &#8220;no&#x201D; &amp;amp; left.&amp;nbsp;&lt;/p&gt;</description></item><item><title>Long</title><description>' + 'word '.repeat(100) + '</description></item>'
    + '<item><title>Ruling</title><description>&lt;span class="field--name-uid"&gt;a.webeditor…&lt;/span&gt;&lt;time&gt;Fri, 10/30/2026 - 12:23&lt;/time&gt; Click to expand Image A caption. &lt;p&gt;Sign up here to receive our investigations by email. The court ruled today.&lt;/p&gt;&lt;p&gt;It was unanimous.&lt;/p&gt;</description></item>'
    + '<item><title>Plug</title><description><![CDATA[<p>The post Plug appeared first on Example.</p>]]></description></item></channel></rss>');
  assert.equal(esc[0].title, 'Report – out');
  assert.equal(esc[0].description, 'Amnesty said “no” & left.');
  assert.ok(esc[1].description.length <= 241 && esc[1].description.endsWith('word…'), esc[1].description);
  assert.equal(esc[2].description, 'The court ruled today. It was unanimous.');
  assert.equal(esc[3].description, '');
  assert.equal(D.wikiDayUrl(Date.UTC(2026, 0, 5)), 'https://en.wikipedia.org/w/api.php?action=parse&page=Portal%3ACurrent_events%2F2026_January_5&prop=wikitext&format=json&formatversion=2');
  assert.equal(D.fitPassage('a\nb\nc', 10), 'a\nb\nc');
  const long = D.fitPassage(Array.from({ length: 100 }, (_, i) => `line ${i} xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`).join('\n'), 400);
  assert.ok(long.length <= 400 && long.endsWith('x'), 'cut at a line end');
});

test('one run: every source filed under the day, within the request budget, each passage under 2,500 characters, the day in three levels with a model', async () => {
  const st = new MemStorage();
  const lib = new Library(st, {});
  seen.length = 0;
  const calls = [];
  const r = await D.runDigest({ storage: st, library: lib, ai: async (system, user) => { calls.push({ system, user }); return 'In one line: a day.\n\nIn more detail: more.\n\nFor an expert: the expert bit.'; } }, { now: NOW });
  assert.equal(r.skipped, undefined, r.summary);
  assert.equal(r.day, '2026-10-17');
  assert.deepEqual(r.sources, ['BBC News', 'BBC UK', 'BBC Birmingham', 'BBC Technology', 'BBC Science', 'arXiv cs.AI', 'arXiv cs.LG', 'Hacker News', 'Wikipedia current events']);
  assert.equal(r.levels, true);
  assert.equal(r.passages, 10);
  assert.ok(seen.length <= D.MAX_REQUESTS && seen.length < 25, `${seen.length} requests`);
  assert.equal(seen.length, D.FEEDS.length, 'one request a source');
  assert.equal(seen.filter((h) => /hn\.algolia\.com/.test(h)).length, 1, "Hacker News' front page in one request");
  assert.equal(seen.filter((h) => /bbci/.test(h)).length, 5);
  const doc = lib.doc('notes_daily');
  assert.equal(doc.title, 'Fresh knowledge');
  assert.equal(doc.kind, 'notes');
  assert.equal(doc.status, 'ready');
  const passages = lib.passagesOf('notes_daily').passages;
  assert.deepEqual(passages.map((p) => p.heading), ['2026-10-17 · BBC News · PRESS', '2026-10-17 · BBC UK · PRESS', '2026-10-17 · BBC Birmingham · PRESS', '2026-10-17 · BBC Technology · PRESS', '2026-10-17 · BBC Science · PRESS', '2026-10-17 · arXiv cs.AI · PRIMARY', '2026-10-17 · arXiv cs.LG · PRIMARY', '2026-10-17 · Hacker News · LEAD', '2026-10-17 · Wikipedia current events · REFERENCE', '2026-10-17 · in three levels']);
  for (const p of passages) assert.ok(p.text.length <= 2500, `${p.heading}: ${p.text.length} characters`);
  const bbc = passages[0].text;
  assert.match(bbc, /^Fresh knowledge 2026-10-17 — BBC News \(feeds\.bbci\.co\.uk\):\n- news story 1 & more — What happened/);
  assert.equal((bbc.match(/^- /gm) ?? []).length, 8, 'the top 8');
  assert.equal((passages[7].text.match(/^- HN story \d+ & co \(\d+ points\) — https:/gm) ?? []).length, 12);
  assert.match(passages[5].text, /^- Paper 1 on cs\.AI: This paper on cs\.AI/m);
  assert.match(passages[8].text, /- The Example War continues; a truce is announced\./);
  assert.match(passages[9].text, /^Fresh knowledge 2026-10-17 — the day in three levels:\nIn one line: a day\./);
  assert.equal(calls.length, 1);
  assert.match(calls[0].user, /<<external content from today's gathered headlines/);
  assert.ok(calls[0].user.length < 9400, 'what the model reads is capped');
  // searchable, as the automatic lookup needs it
  const hits = await lib.search('Example War truce');
  assert.ok(hits.some((h) => h.doc === 'notes_daily' && /Wikipedia/.test(h.heading)));
  assert.deepEqual(st.m.get('digest:last'), { day: '2026-10-17', at: NOW, passages: 10, sources: r.sources });
  // the same day again on its own: nothing; forced (DIGEST NOW): the day's sections replaced, not doubled
  seen.length = 0;
  const twice = await D.runDigest({ storage: st, library: lib }, { now: NOW + 3600_000 });
  assert.match(twice.skipped, /already gathered today/);
  assert.equal(seen.length, 0);
  const forced = await D.runDigest({ storage: st, library: lib }, { now: NOW + 3600_000, force: true });
  assert.equal(forced.passages, 9, 'no model this time: no levels passage');
  assert.equal(forced.levels, false);
  const after = lib.passagesOf('notes_daily').passages.map((p) => p.heading);
  assert.equal(after.filter((h) => h === '2026-10-17 · BBC News · PRESS').length, 1);
  assert.ok(after.includes('2026-10-17 · in three levels'), "the earlier levels passage stays when no model could write a new one");
  assert.equal(after.length, 10);
});

test('no model: the headlines are filed and the levels passage is skipped quietly; a failing source is left out; an empty page is reported', async () => {
  const st = new MemStorage();
  const lib = new Library(st, {});
  arxivDown = true;
  wikiEmpty = true;
  const r = await D.runDigest({ storage: st, library: lib, ai: async () => { throw new Error('Every model I can reach is cooling down after rate limits.'); } }, { now: NOW });
  arxivDown = false;
  wikiEmpty = false;
  assert.equal(r.skipped, undefined);
  assert.equal(r.levels, false);
  assert.deepEqual(r.sources, ['BBC News', 'BBC UK', 'BBC Birmingham', 'BBC Technology', 'BBC Science', 'Hacker News']);
  assert.match(r.summary, /missed .*arXiv cs\.AI: rss\.arxiv\.org answered 429/);
  assert.match(r.summary, /missed .*UN News: news\.un\.org answered 599/, 'a feed that does not answer is left out and said');
  assert.match(r.summary, /Wikipedia: no events on the page yet/);
  assert.equal(lib.passagesOf('notes_daily').passages.length, 6);
});

test('the registry (77d): twenty sources, each with the tier its host has in the table, one request each; the primary and credible feeds filed with their tier', async () => {
  // the nine first, as before (the Brief reads "BBC News"), then the newer ones
  assert.deepEqual(D.FEEDS.slice(0, 9).map((f) => f.name), ['BBC News', 'BBC UK', 'BBC Birmingham', 'BBC Technology', 'BBC Science', 'arXiv cs.AI', 'arXiv cs.LG', 'Hacker News', 'Wikipedia current events']);
  assert.deepEqual(D.FEEDS.slice(9).map((f) => `${f.name} ${f.tier}`), ['UN News primary', 'ICC news primary', 'GOV.UK announcements primary', 'New UK legislation primary', 'Amnesty International credible', 'Human Rights Watch credible', 'ICIJ credible', 'Bellingcat credible', 'OCCRP credible', 'ProPublica credible', 'Full Fact credible']);
  for (const f of D.FEEDS) assert.equal(f.tier, T.tierOf(f.kind === 'hn' ? 'https://news.ycombinator.com/' : f.url), `${f.name}: its tier is its host's`);
  assert.ok(D.FEEDS.length <= D.MAX_REQUESTS, 'one request each fits the budget');
  assert.ok(new Set(D.FEEDS.map((f) => f.name)).size === D.FEEDS.length);
  assert.equal(D.digestHeading('2026-10-17', 'UN News', 'primary'), '2026-10-17 · UN News · PRIMARY');
  // the morning's passages say their tier: a cited answer reads it from the heading
  assert.equal(T.libraryTier('notes_daily', 'gathered daily by Ghosty', '2026-10-17 · Bellingcat · CREDIBLE'), 'credible');
  assert.equal(T.libraryTier('notes_daily', 'gathered daily by Ghosty', '2026-10-17 · Hacker News · LEAD'), 'lead');

  const st = new MemStorage();
  const lib = new Library(st, {});
  // a section filed the same day before the tiers came in is replaced, not doubled
  lib.createDoc({ id: 'notes_daily', title: 'Fresh knowledge', source: 'gathered daily by Ghosty', kind: 'notes' });
  await lib.addPassages('notes_daily', [{ heading: '2026-10-17 · BBC News', text: 'Fresh knowledge 2026-10-17 — BBC News (feeds.bbci.co.uk):\n- an earlier gathering' }]);
  newerUp = true;
  seen.length = 0;
  const r = await D.runDigest({ storage: st, library: lib }, { now: NOW, force: true });
  newerUp = false;
  assert.equal(r.sources.length, 20, r.summary);
  assert.equal(seen.length, 20, 'one request a source');
  assert.ok(seen.length <= D.MAX_REQUESTS);
  const heads = lib.passagesOf('notes_daily').passages.map((p) => p.heading);
  assert.ok(!heads.includes('2026-10-17 · BBC News'), 'the old-style section went');
  assert.equal(heads.filter((h) => /· BBC News/.test(h)).length, 1);
  for (const h of ['2026-10-17 · UN News · PRIMARY', '2026-10-17 · ICC news · PRIMARY', '2026-10-17 · GOV.UK announcements · PRIMARY', '2026-10-17 · New UK legislation · PRIMARY', '2026-10-17 · Amnesty International · CREDIBLE', '2026-10-17 · Full Fact · CREDIBLE']) assert.ok(heads.includes(h), h);
  const gov = lib.passagesOf('notes_daily').passages.find((p) => p.heading === '2026-10-17 · GOV.UK announcements · PRIMARY');
  assert.match(gov.text, /^Fresh knowledge 2026-10-17 — GOV\.UK announcements \(www\.gov\.uk\):\n- www\.gov\.uk entry 1\n- www\.gov\.uk entry 2 — What www\.gov\.uk published, number 2\./);
  for (const p of lib.passagesOf('notes_daily').passages) assert.ok(p.text.length <= 2500);
  // found by the lookup, with the tier it was filed under
  const hits = await lib.search('Bellingcat story');
  assert.ok(hits.some((h) => h.heading === '2026-10-17 · Bellingcat · CREDIBLE'));
});

test('entries older than a month go, the rest stay', async () => {
  const st = new MemStorage();
  const lib = new Library(st, {});
  lib.createDoc({ id: 'notes_daily', title: 'Fresh knowledge', source: 'x', kind: 'notes' });
  await lib.addPassages('notes_daily', [{ heading: '2026-08-01 · BBC News', text: 'old news' }, { heading: '2026-09-20 · BBC News', text: 'recent news' }, { heading: 'Not a day', text: 'kept' }]);
  assert.equal(D.prune(lib, NOW), 1);
  assert.deepEqual(lib.passagesOf('notes_daily').passages.map((p) => p.heading), ['2026-09-20 · BBC News', 'Not a day']);
});

test('in the brain: DIGEST NOW files the day with the mock model, the alarm job runs quietly once a day', async () => {
  const storage = new MemStorage();
  const pending = [];
  const state = { storage, waitUntil: (p) => pending.push(p), blockConcurrencyWhile: (f) => f() };
  const agent = new brain.GhostyAgent(state, { VAULT_KEY: Buffer.alloc(32, 7).toString('base64'), MOCK_LLM: '1' });
  const api = async (method, path, body) => {
    const r = await agent.fetch(new Request(`https://ghosty.test/api${path}`, { method, ...(body ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}) }));
    const text = await r.text();
    await Promise.allSettled(pending.splice(0));
    return { status: r.status, ...(text ? JSON.parse(text) : {}) };
  };
  const r = await api('POST', '/library/digest', {});
  assert.equal(r.status, 200);
  assert.equal(r.skipped, undefined, r.summary);
  assert.equal(r.levels, true, 'the mock wrote the three levels');
  assert.equal(r.sources.length, 9);
  const page = await api('GET', '/library/docs/notes_daily/passages');
  assert.equal(page.passages.length, 10);
  assert.match(page.passages.at(-1).text, /In one line: the mock read/);
  const docs = (await api('GET', '/library')).docs;
  assert.ok(docs.some((d) => d.id === 'notes_daily' && d.title === 'Fresh knowledge'));
  // the job: made once, quiet, and "already gathered today" when it fires after DIGEST NOW
  const jobs = await S.loadJobs(storage);
  const job = jobs.find((j) => j.kind === 'digest');
  assert.ok(job, 'the digest job exists');
  // 05:40 UK time (before the Brief is read, summer or winter), whatever the clocks are doing
  assert.equal(job.tz, 'Europe/London');
  assert.equal(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(job.next)), '05:40');
  job.next = Date.now() - 1000;
  await storage.put('jobs', jobs);
  await agent.alarm();
  const again = (await S.loadJobs(storage)).find((j) => j.kind === 'digest');
  assert.ok(again.next > Date.now());
  assert.match(again.lastResult, /already gathered today/);
  assert.equal((await api('GET', '/inbox')).items.length, 0, 'never a notification');
});
