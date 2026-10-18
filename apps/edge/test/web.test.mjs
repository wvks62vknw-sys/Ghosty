// Web search with no keys at all: DuckDuckGo shows Cloudflare a robot check, so Ghosty asks
// free keyless sources together instead. Network faked.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const T = await import('./.build/tools/index.mjs');
const asked = [];
globalThis.fetch = async (input) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  asked.push(url.hostname + url.pathname + url.search);
  const j = (o) => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json' } });
  const q = (url.searchParams.get('q') ?? url.searchParams.get('query') ?? url.searchParams.get('search') ?? '').toLowerCase();
  const long = q.split(/\s+/).length > 3; // like the real APIs: long questions match nothing
  switch (url.hostname) {
    case 'html.duckduckgo.com':
      return new Response('<html>anomaly challenge</html>', { status: 202, headers: { 'content-type': 'text/html' } });
    case 'api.duckduckgo.com':
      return j(long ? {} : { Heading: '2048 (video game)', AbstractText: '2048 is a sliding tile puzzle where tiles with the same number merge.', AbstractURL: 'https://en.wikipedia.org/wiki/2048_(video_game)', RelatedTopics: [] });
    case 'en.wikipedia.org':
      return j([q, long ? [] : ['2048 (video game)'], long ? [] : ['Sliding block puzzle'], long ? [] : ['https://en.wikipedia.org/wiki/2048_(video_game)']]);
    case 'api.stackexchange.com':
      return j({ items: long ? [] : [{ title: 'How to merge tiles in 2048 &amp; keep score', link: 'https://stackoverflow.com/q/1', tags: ['javascript'], is_answered: true }] });
    case 'hn.algolia.com':
      return new Response('down', { status: 503 });
    case 'api.github.com':
      return j({ items: long ? [] : [{ full_name: 'gabrielecirulli/2048', html_url: 'https://github.com/gabrielecirulli/2048', description: 'The game 2048', stargazers_count: 12000 }] });
  }
  return new Response('not faked', { status: 599 });
};

test('with no search keys and DuckDuckGo blocked, search still finds results (keyless sources)', async () => {
  const out = await T.toolByName.get('web_search').run({ query: 'make me a short simple 2048 block merge game' }, { vault: { get: async () => null } });
  assert.match(out, /2048 \(video game\)/);
  assert.match(out, /stackoverflow\.com\/q\/1/);
  assert.match(out, /How to merge tiles in 2048 & keep score/, 'HTML entities decoded');
  assert.match(out, /github\.com\/gabrielecirulli\/2048/);
  assert.ok(asked.some((u) => u.startsWith('api.github.com') && /2048/.test(u)), 'retried with the key words');
});

test('an identical search or page read within a few minutes is reused, not asked again', async () => {
  const before = asked.length;
  const ctx = { vault: { get: async () => null } };
  const a = await T.toolByName.get('web_search').run({ query: '2048 sliding game' }, ctx);
  const used = asked.length - before;
  assert.ok(used > 0, 'the first search asks the sources');
  const b = await T.toolByName.get('web_search').run({ query: '  2048   Sliding game ' }, ctx);
  assert.equal(b, a, 'same results');
  assert.equal(asked.length - before, used, 'the second, identical search asked nothing');
  // a page: read once, then reused for a few minutes, saying how old the copy is (and still credited as read)
  const found = [];
  const p1 = await T.toolByName.get('web_fetch').run({ url: 'https://api.github.com/repos/x/y' }, { ...ctx, found: (s) => found.push(s) });
  const n = asked.length;
  const p2 = await T.toolByName.get('web_fetch').run({ url: 'https://api.github.com/repos/x/y' }, { ...ctx, found: (s) => found.push(s) });
  assert.match(p2, /\(a copy read \d+ s ago; fresh: true reads it again\)/);
  assert.equal(p2.replace(/\(a copy read[^)]*\)\n/, ''), p1, 'the same text');
  assert.equal(asked.length, n, 'not fetched again');
  assert.equal(found.length, 2, 'both reads count as looked up');
  // asked to read it again: it is
  await T.toolByName.get('web_fetch').run({ url: 'https://api.github.com/repos/x/y', fresh: true }, ctx);
  assert.equal(asked.length, n + 1, 'fresh: true reads the page again');
});

test('a thin search (fewer than three results) or one where the search key failed is not reused', async () => {
  const ctx = { vault: { get: async () => null } };
  // only one result anywhere: shown, but not kept
  const realFetch = globalThis.fetch;
  let thin = 0;
  globalThis.fetch = async (input) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    thin++;
    if (url.hostname === 'en.wikipedia.org') return new Response(JSON.stringify(['q', ['Quokka'], ['A small marsupial'], ['https://en.wikipedia.org/wiki/Quokka']]), { headers: { 'content-type': 'application/json' } });
    return new Response('{}', { status: 503 });
  };
  const one = await T.toolByName.get('web_search').run({ query: 'quokka' }, ctx);
  assert.match(one, /Quokka/);
  const before = thin;
  await T.toolByName.get('web_search').run({ query: 'quokka' }, ctx);
  assert.ok(thin > before, 'a one-result search is asked again next time');
  globalThis.fetch = realFetch;
  // a Brave key that fails: the keyless results stand in, and are not kept
  const braveCtx = { vault: { get: async (n) => (n === 'brave' ? 'bad-key' : null) } };
  await T.toolByName.get('web_search').run({ query: '2048 tiles' }, braveCtx);
  const b2 = asked.length;
  await T.toolByName.get('web_search').run({ query: '2048 tiles' }, braveCtx);
  assert.ok(asked.length > b2 + 1, 'the failing key is tried again next time');
});

test('a search key in the vault being unreadable falls through to keyless search', async () => {
  const out = await T.toolByName.get('web_search').run({ query: '2048 game' }, { vault: { get: async () => { throw new Error('Exceeded allowed rows read'); } } });
  assert.match(out, /2048/);
});
