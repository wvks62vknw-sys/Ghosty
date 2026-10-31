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
    case 'api.search.brave.com': {
      // (the tiers test only — its own query: any other search with a Brave key fails, as the thin-search test needs)
      if (!/\btiers\b/.test(q)) return new Response('not faked', { status: 599 });
      const r = (url) => ({ title: `Result at ${new URL(url).hostname}`, url, description: 'About provisional measures.' });
      return j({ web: { results: ['https://www.tiktok.com/@someone/video/1', 'https://blog.example.org/post', 'https://www.bbc.co.uk/news/1', 'https://www.ohchr.org/en/press', 'https://en.wikipedia.org/wiki/X', 'https://www.reddit.com/r/x/1', 'https://www.hrw.org/news/1', 'https://www.icj-cij.org/case/192'].map(r) } });
    }
    case 'www.tiktok.com':
      return new Response('<html><head><title>a video</title></head><body><p>They say the court ruled it all a lie.</p></body></html>', { headers: { 'content-type': 'text/html' } });
    case 'api.github.com':
      return j({ items: long ? [] : [{ full_name: 'gabrielecirulli/2048', html_url: 'https://github.com/gabrielecirulli/2048', description: 'The game 2048', stargazers_count: 12000 }] });
  }
  return new Response('not faked', { status: 599 });
};

test('search results by tier (OWNER-ISSUES 77): primary first, leads last, ties in the engine’s order, each tagged; a lead’s page comes with its note', async () => {
  const ctx = { vault: { get: async (k) => (k === 'brave' ? 'a-test-key' : null) } };
  const out = await T.toolByName.get('web_search').run({ query: 'provisional measures tiers' }, ctx);
  const urls = [...out.matchAll(/^https:\/\/\S+$/gm)].map((m) => m[0]);
  assert.deepEqual(urls, ['https://www.ohchr.org/en/press', 'https://www.icj-cij.org/case/192', 'https://www.hrw.org/news/1', 'https://www.bbc.co.uk/news/1', 'https://en.wikipedia.org/wiki/X', 'https://blog.example.org/post', 'https://www.tiktok.com/@someone/video/1', 'https://www.reddit.com/r/x/1']);
  assert.match(out, /^1\. Result at www\.ohchr\.org \[PRIMARY\]$/m);
  assert.match(out, /^3\. Result at www\.hrw\.org \[CREDIBLE\]$/m);
  assert.match(out, /^4\. Result at www\.bbc\.co\.uk \[PRESS\]$/m);
  assert.match(out, /^5\. Result at en\.wikipedia\.org \[REFERENCE\]$/m);
  assert.match(out, /^6\. Result at blog\.example\.org$/m, 'a host the table does not know: no tag');
  assert.match(out, /^7\. Result at www\.tiktok\.com \[LEAD\]$/m);
  const page = await T.toolByName.get('web_fetch').run({ url: 'https://www.tiktok.com/@someone/video/1' }, ctx);
  assert.match(page, /^TikTok is a lead, not a source: take the claim from it, then find its root/);
  assert.match(page, /<<external content[^\n]*>>\n[\s\S]*the court ruled it all a lie/, 'its words still marked as data, after the note');
  const plain = await T.toolByName.get('web_fetch').run({ url: 'https://api.github.com/repos/x/z' }, ctx);
  assert.doesNotMatch(plain, /is a lead/);
});

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

// ---- YouTube (integrations/youtube.ts, the summarise_video tool in tools/extra.ts) ----
// A link → the captions keylessly from YouTube's own watch page and timedtext tracks → a plain summary
// with timestamped moments that link back (a moment the model invents is dropped), filed in the library,
// and on request five quiz questions kept as LEARN cards. YouTube turning the server away (403, a robot
// check) → the title from oEmbed and an honest refusal with the paste route. Fixtures only: the watch
// page and the caption tracks are shaped like YouTube's (youtube.fixture.json); no live call.
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { sqlStorage } from '../../../tests/sqlite-storage.mjs';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({ entryPoints: [at('../src/integrations/youtube.ts'), at('../src/tools/extra.ts')], bundle: true, format: 'esm', platform: 'neutral', external: ['cloudflare:sockets'], outdir: at('./.build/youtube'), outExtension: { '.js': '.mjs' }, logLevel: 'warning' });
const Y = await import('./.build/youtube/integrations/youtube.mjs');
const X = await import('./.build/youtube/tools/extra.mjs');
const { Library } = await import('./.build/library/store.mjs');
const Tu = await import('./.build/tutor.mjs');
const YT = JSON.parse(readFileSync(new URL('./youtube.fixture.json', import.meta.url)));

class YtStorage {
  m = new Map();
  sql = sqlStorage();
  async get(k) { return Array.isArray(k) ? new Map(k.filter((x) => this.m.has(x)).map((x) => [x, structuredClone(this.m.get(x))])) : this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
  async put(k, v) { if (typeof k === 'object') for (const [a, b] of Object.entries(k)) this.m.set(a, structuredClone(b)); else this.m.set(k, structuredClone(v)); }
  async delete(k) { return Array.isArray(k) ? k.filter((x) => this.m.delete(x)).length : this.m.delete(k); }
  async list({ prefix = '' } = {}) { return new Map([...this.m].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, structuredClone(v)])); }
  async setAlarm() {}
  async getAlarm() { return null; }
}

/** YouTube faked from the fixture: `page` is the watch page to send (or a status), every address asked kept. */
function youtube({ page = YT.pageManual, status = 200, captions = 'json3' } = {}) {
  const asked = [];
  const f = async (input) => {
    const u = new URL(typeof input === 'string' ? input : input.url);
    asked.push(u.href);
    if (u.hostname === 'www.youtube.com' && u.pathname === '/watch') return status === 200 ? new Response(page, { headers: { 'content-type': 'text/html; charset=utf-8' } }) : new Response('<html>Error 403 (Forbidden)</html>', { status });
    if (u.hostname === 'www.youtube.com' && u.pathname === '/oembed') return new Response(JSON.stringify(YT.oembed), { headers: { 'content-type': 'application/json' } });
    if (u.hostname === 'www.youtube.com' && u.pathname === '/api/timedtext') {
      if (captions === 'empty') return new Response('', { status: 200 });
      if (u.searchParams.get('fmt') === 'json3') return captions === 'json3' ? new Response(YT.json3, { headers: { 'content-type': 'application/json' } }) : new Response('', { status: 200 });
      return new Response(captions === 'srv3' ? YT.srv3 : YT.xml, { headers: { 'content-type': 'text/xml' } });
    }
    return new Response('not faked', { status: 599 });
  };
  return { f, asked };
}

/** A scripted cheap model: the summary (with one made-up moment at 15:55, near no line) and the quiz. */
function model() {
  const asks = [];
  const ask = async (system, user) => {
    asks.push({ system, user });
    if (system.startsWith('VIDEO SUMMARY:')) return '```json\n' + JSON.stringify({ summary: 'Two small home batteries can beat one big one, because a battery can only give out so much power at once.', moments: [
      { at: '0:15', label: 'what a home battery does' }, { at: '1:02', label: 'the cheap overnight tariff' }, { at: '3:01', label: 'efficiency losses' },
      { at: '5:02', label: 'the discharge limit people miss' }, { at: '12:40', label: 'why the second battery matters' }, { at: '15:55', label: 'a moment that is not in the video' },
      { at: '18:00', label: 'the advice: size for evening power' },
    ] }) + '\n```';
    if (system.startsWith('QUIZ:')) return JSON.stringify({ questions: [
      { type: 'short', q: 'What does a home battery store?', answer: 'solar made at midday', why: 'So it can be used in the evening.' },
      { type: 'short', q: 'What is the second trick besides solar?', answer: 'the cheap overnight tariff', why: 'Charge at 7p, use at 28p.' },
      { type: 'short', q: 'How much is lost going in and out?', answer: 'about ten percent', why: 'Round-trip efficiency.' },
      { type: 'mc', q: 'Why does a second battery help?', choices: ['More colours', 'Double the power at once', 'Cheaper tariffs', 'Less solar'], answer: 1, why: 'Each battery has a discharge limit.' },
      { type: 'short', q: 'What should you size a battery for?', answer: 'your evening power', why: 'Not just the energy.' },
    ] });
    throw new Error('no model free');
  };
  return { ask, asks };
}

const depsFor = (f, ask, storage = new YtStorage()) => ({ storage, library: new Library(storage, {}), ask, fetch: f, now: Date.UTC(2026, 9, 23, 9) });

test('YouTube: links and bare ids give the video id; times read and written both ways', () => {
  for (const u of ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s', 'https://youtu.be/dQw4w9WgXcQ?si=x', 'youtube.com/shorts/dQw4w9WgXcQ', 'https://m.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ']) assert.equal(Y.videoId(u), 'dQw4w9WgXcQ', u);
  for (const u of ['https://vimeo.com/123', 'https://www.youtube.com/', 'hello']) assert.equal(Y.videoId(u), null, u);
  assert.equal(Y.clock(760), '12:40');
  assert.equal(Y.clock(3725), '1:02:05');
  assert.equal(Y.seconds('[12:40]'), 760);
  assert.equal(Y.seconds('1:02:05'), 3725);
  assert.ok(Number.isNaN(Y.seconds('soon')));
  assert.equal(Y.momentUrl('dQw4w9WgXcQ', 760.6), 'https://youtu.be/dQw4w9WgXcQ?t=760');
});

test('YouTube: the watch page parser finds the caption tracks, chooses English by a person, flags auto-generated', () => {
  const w = Y.parseWatch(YT.pageManual, YT.id);
  assert.equal(w.title, 'Home batteries {explained} — "why two beat one"', 'braces and quotes inside the JSON do not cut it short');
  assert.equal(w.author, 'The Energy Shed');
  assert.equal(w.seconds, 1112);
  assert.equal(w.status, 'OK');
  assert.deepEqual(w.tracks.map((t) => `${t.lang}${t.auto ? ' auto' : ''}`), ['en auto', 'en', 'fr']);
  assert.match(w.tracks[1].url, /^https:\/\/www\.youtube\.com\/api\/timedtext\?v=dQw4w9WgXcQ&.*&lang=en$/);
  const pick = Y.pickTrack(w.tracks);
  assert.equal(pick.lang, 'en');
  assert.equal(pick.auto, false, 'the English track a person wrote beats the auto-generated one');
  const auto = Y.pickTrack(Y.parseWatch(YT.pageAuto).tracks);
  assert.equal(auto.lang, 'en');
  assert.equal(auto.auto, true, 'only auto-generated English: flagged');
  const fr = Y.pickTrack(Y.parseWatch(YT.pageFrench).tracks);
  assert.equal(fr.translated, true);
  assert.match(fr.url, /&tlang=en$/, 'another language: YouTube translates it to English');
  assert.deepEqual(Y.parseWatch(YT.pageNoCaptions).tracks, []);
  const bot = Y.parseWatch(YT.pageBot);
  assert.equal(bot.status, 'LOGIN_REQUIRED');
  assert.match(bot.reason, /not a bot/);
  assert.equal(Y.parseWatch(YT.pageConsent), null, 'a consent page holds no player');
});

test('YouTube: the timedtext parsers read JSON (json3) and XML (classic and srv3) into the same timed lines', () => {
  const j = Y.parseJson3(YT.json3);
  const x = Y.parseXml(YT.xml);
  const s = Y.parseXml(YT.srv3);
  assert.equal(j.length, 21, 'the newline-only events are dropped');
  assert.deepEqual(j[0], { start: 0.4, text: 'hi everyone welcome back to the shed' });
  assert.equal(j[1].text, "today it's home batteries");
  assert.equal(x[1].text, "today it's home batteries", 'the XML is encoded twice (&amp;#39;): decoded');
  assert.deepEqual(x.map((l) => [l.start, l.text]), j.map((l) => [l.start, l.text]));
  assert.deepEqual(s.map((l) => [l.start, l.text]), j.map((l) => [l.start, l.text]), 'srv3: <p t="ms"> with word spans');
  assert.deepEqual(Y.parseJson3('<html>not json</html>'), []);
  const joined = Y.joinLines(j);
  assert.ok(joined.length < j.length && joined[0].text.startsWith('hi everyone welcome back to the shed today'), 'cues joined into ~15 s lines');
  assert.equal(joined.find((l) => l.text.startsWith('why the second')).start, 760.3, 'a joined line keeps its first cue’s time');
});

test('YouTube: a long transcript is cut at a whole line to the first 25,000 characters, and the reply says so', async () => {
  const lines = Array.from({ length: 2000 }, (_, i) => ({ start: i * 5, text: `line ${i} ${'words '.repeat(6)}`.trim() }));
  const cut = Y.cutToBudget(lines);
  assert.ok(Y.asText(cut.lines).length <= Y.MAX_TRANSCRIPT, `${Y.asText(cut.lines).length} characters`);
  assert.ok(Y.asText(cut.lines).length > Y.MAX_TRANSCRIPT - 200, 'cut close to the budget, not far short');
  assert.equal(cut.cutAt, cut.lines.length * 5, 'the time it stopped at');
  assert.equal(Y.cutToBudget(lines.slice(0, 10)).cutAt, undefined, 'a short one is not cut');
  // through the tool: a 3-hour video
  const json3 = JSON.stringify({ events: lines.map((l) => ({ tStartMs: l.start * 1000, segs: [{ utf8: l.text }] })) });
  const yt = youtube();
  const f = async (input) => (String(input).includes('/api/timedtext') ? new Response(json3) : yt.f(input));
  const m = model();
  const out = await Y.summariseVideo(depsFor(f, m.ask), { url: 'https://youtu.be/dQw4w9WgXcQ' });
  assert.match(out, /Only the first 25,000 characters were read \(up to \d+:\d\d of 18:32\)/);
  const sent = m.asks.find((a) => a.system.startsWith('VIDEO SUMMARY:')).user;
  assert.ok(sent.length < Y.MAX_TRANSCRIPT + 600, `the model read ${sent.length} characters`);
});

test('YouTube: summarise_video replies with the title, length, summary and checked moments that link back; filed in the library', async () => {
  const yt = youtube();
  const m = model();
  const deps = depsFor(yt.f, m.ask);
  const out = await Y.summariseVideo(deps, { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
  assert.match(out, /^<<external content from the video/, 'what the captions and the model said is data');
  assert.match(out, /▶ Home batteries \{explained\} — "why two beat one" · The Energy Shed · 18:32/);
  assert.match(out, /Transcript: English captions\./, 'the track a person wrote; not called auto-generated');
  assert.match(out, /Summary: Two small home batteries can beat one big one/);
  const moments = [...out.matchAll(/^\[(\d+:\d\d)\] (.+) — (https:\/\/youtu\.be\/dQw4w9WgXcQ\?t=(\d+))$/gm)];
  assert.deepEqual(moments.map((x) => x[1]), ['0:15', '1:02', '3:01', '5:02', '12:40', '18:00']);
  assert.deepEqual(moments.map((x) => Number(x[4])), [15, 62, 181, 302, 760, 1080], 'each link opens the video at the caption line’s second');
  assert.ok(!/not in the video/.test(out), 'the made-up moment (15:55, near no caption line) is dropped');
  assert.match(out, /Never add a moment that is not listed/);
  assert.match(out, /Offer a quiz/);
  assert.ok(yt.asked.some((u) => /\/api\/timedtext\?.*&lang=en&fmt=json3$/.test(u) && !/kind=asr/.test(u)), 'the English track read as JSON');
  assert.ok(!yt.asked.some((u) => !/^https:\/\/www\.youtube\.com\//.test(u)), 'nothing but YouTube itself was asked: no transcript service');
  // filed: kind video, the timed lines as passages, the summary first; once
  const doc = deps.library.doc('yt_dQw4w9WgXcQ');
  assert.equal(doc.kind, 'video');
  assert.equal(doc.source, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.ok(doc.passages >= 2);
  const hits = await deps.library.search('second battery double power', 3);
  assert.ok(hits.some((h) => /\[12:40\] why the second battery matters/.test(h.text)), 'a later question finds the moment with its time');
  assert.match(out, /Filed in your library as "Home batteries .*\(YouTube\)" with its timestamps/);
  const again = await Y.summariseVideo(deps, { url: 'https://youtu.be/dQw4w9WgXcQ' });
  assert.match(again, /Already in your library/);
  assert.equal(deps.library.doc('yt_dQw4w9WgXcQ').passages, doc.passages, 'not filed twice');
  // auto-generated captions are said to be; the XML route when JSON comes back empty
  const auto = await Y.summariseVideo(depsFor(youtube({ page: YT.pageAuto, captions: 'xml' }).f, model().ask), { url: 'dQw4w9WgXcQ' });
  assert.match(auto, /auto-generated English captions \(they can mishear words\)/);
  assert.match(auto, /Say the captions were auto-generated/);
  assert.match(auto, /\[12:40\] why the second battery matters — https:\/\/youtu\.be\/dQw4w9WgXcQ\?t=760/);
  // no model free: the video's own words at even steps, quoted; the transcript's start for the chat model
  const plain = await Y.summariseVideo(depsFor(youtube().f, async () => { throw new Error('no model free'); }), { url: 'dQw4w9WgXcQ' });
  assert.match(plain, /Moments \(the video’s own words at even steps\):\n\[0:00\] “hi everyone welcome back/);
  assert.match(plain, /No AI was free to summarise; the transcript's start:\n\[0:00\]/);
});

test('YouTube: quiz: five questions from the transcript through the cheap lane, kept as LEARN revision cards', async () => {
  const yt = youtube();
  const m = model();
  const deps = depsFor(yt.f, m.ask);
  const out = await Y.summariseVideo(deps, { url: 'https://youtu.be/dQw4w9WgXcQ', quiz: true });
  assert.match(out, /QUIZ \(5 questions\):\n1\. What does a home battery store\?/);
  assert.match(out, /\[answers, never show before they answer: 1: solar made at midday; .*4: B;/);
  assert.match(out, /5 cards added to LEARN → REVISE\./);
  assert.match(m.asks.find((a) => a.system.startsWith('QUIZ:')).user, /<<external content from the captions of .*\n\[0:00\] hi everyone/, 'the transcript is data to the quiz writer');
  const cards = await Tu.loadCards(deps.storage, Tu.GENERAL);
  assert.equal(cards.length, 5, 'in the tutor’s own store, where REVISE reads them');
  assert.equal(cards[0].front, 'What does a home battery store?');
  assert.match(cards[0].back, /^solar made at midday\nSo it can be used in the evening\.\nFrom "Home batteries/);
  assert.match(cards[3].front, /^Why does a second battery help\?\nA\) More colours\nB\) Double the power at once/);
  assert.ok(cards.every((c) => c.due <= deps.now && c.interval === 0), 'fresh SM-2 cards, due now');
  const state = await Tu.learnState({ storage: deps.storage, library: null, ask: m.ask, now: deps.now });
  assert.equal(state.cards.length, 5, 'the LEARN tab’s state carries them to the phone');
  // "quiz me on this" afterwards: the video already read, YouTube not asked again
  const before = yt.asked.length;
  const deps2 = { ...deps, ask: model().ask };
  const again = await Y.summariseVideo(deps2, { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', quiz: true });
  assert.equal(yt.asked.length, before, 'no second visit to YouTube');
  assert.match(again, /QUIZ \(5 questions\)/);
  assert.match(again, /0 cards added/, 'the same questions are not added twice');
});

test('YouTube: refused (403, a robot check, empty captions): the title from oEmbed, why in plain words, the paste route; nothing invented', async () => {
  const m = model();
  for (const [opts, why] of [
    [{ status: 403 }, /YouTube answered 403 when I opened the video/],
    [{ status: 429 }, /YouTube answered 429/],
    [{ page: YT.pageBot }, /YouTube asked my server to sign in to prove it is not a robot/],
    [{ page: YT.pageConsent }, /cookie page/],
    [{ captions: 'empty' }, /YouTube sent the captions back empty/],
    [{ page: YT.pageNoCaptions }, /this video has no captions on YouTube/],
  ]) {
    const yt = youtube(opts);
    const deps = depsFor(yt.f, m.ask);
    const out = await Y.summariseVideo(deps, { url: 'https://youtu.be/dQw4w9WgXcQ' });
    assert.match(out, why, JSON.stringify(opts));
    assert.match(out, /^I couldn't read the transcript of "Home batteries/, 'the title, from oEmbed or the page');
    assert.match(out, /I have not guessed at what it says/);
    assert.match(out, /"Show transcript", select all the lines with their times, copy, and paste them here/);
    assert.match(out, /call summarise_video again with url https:\/\/www\.youtube\.com\/watch\?v=dQw4w9WgXcQ and the pasted text as transcript/);
    assert.ok(!/Moments|Summary:|youtu\.be\/dQw4w9WgXcQ\?t=/.test(out), 'no moments, no summary');
    assert.equal(deps.library.doc('yt_dQw4w9WgXcQ'), null, 'nothing filed');
  }
  assert.equal(m.asks.length, 0, 'no model asked to imagine the video');
  // the paste route: YouTube's "Show transcript" copied (a time, YouTube's spoken-time line, the words)
  const p = Y.parsePasted(YT.pasted);
  assert.deepEqual(p.lines.map((l) => [l.start, l.text]), [[0, 'hi everyone welcome back to the shed'], [15, 'first what a home battery actually does it stores the solar you make at noon'], [62, 'the cheap overnight tariff is the second trick'], [760, 'why the second battery matters'], [1100, 'thanks for watching']]);
  assert.equal(Y.parsePasted('[0:05] hello there\n[0:09] - and welcome').lines[1].text, 'and welcome');
  assert.equal(Y.parsePasted('just some words with no times').untimed, true);
  const yt = youtube({ status: 403 });
  const out = await Y.summariseVideo(depsFor(yt.f, model().ask), { url: 'https://youtu.be/dQw4w9WgXcQ', transcript: YT.pasted });
  assert.match(out, /▶ Home batteries explained · The Energy Shed · about 18:20/);
  assert.match(out, /Transcript: the one you pasted\./);
  assert.match(out, /\[12:40\] why the second battery matters — https:\/\/youtu\.be\/dQw4w9WgXcQ\?t=760/);
  assert.ok(!yt.asked.some((u) => /\/watch|timedtext/.test(u)), 'with a paste, YouTube is only asked for the title');
  const untimed = await Y.summariseVideo(depsFor(yt.f, model().ask), { url: 'https://youtu.be/dQw4w9WgXcQ', transcript: 'just words with no times at all in them' });
  assert.match(untimed, /no times in it, so there are no moments to link/);
  assert.ok(!/youtu\.be\/dQw4w9WgXcQ\?t=/.test(untimed));
});

test('YouTube: summarise_video is a tool in tools/extra.ts, kept out of the always-on extras, its description short', async () => {
  const tool = X.videoTools.find((t) => t.name === 'summarise_video');
  assert.ok(tool, 'videoTools has it');
  assert.ok(!X.extraTools.some((t) => t.name === 'summarise_video'), 'not described on every turn (the plain turn is within 100 characters of its budget)');
  assert.ok(tool.description.length <= 220, `${tool.description.length} characters`);
  assert.deepEqual(tool.parameters.required, ['url']);
  assert.deepEqual(Object.keys(tool.parameters.properties), ['url', 'quiz', 'transcript']);
  // through the tool itself, with the scripted mock model and the brain's own deps: YouTube refusing
  const realFetch = globalThis.fetch;
  globalThis.fetch = youtube({ status: 403 }).f;
  try {
    const storage = new YtStorage();
    const steps = [];
    const out = await tool.run({ url: 'https://youtu.be/dQw4w9WgXcQ' }, { storage, env: { MOCK_LLM: '1' }, vault: { get: async () => null }, progress: (l) => steps.push(l), emit: () => undefined });
    assert.match(out, /YouTube answered 403/);
    assert.deepEqual(steps, ['reading the YouTube page…']);
    await assert.rejects(tool.run({ url: 'https://vimeo.com/1' }, { storage, env: { MOCK_LLM: '1' }, vault: { get: async () => null }, progress: () => undefined }), /not a YouTube link/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('YouTube: the chat card reads the reply: the ▶ line, the moments (links at their second), the words left over', async () => {
  await build({ entryPoints: [at('../../web/src/features/core/ytcard.ts')], bundle: true, format: 'esm', platform: 'neutral', outfile: at('./.build/youtube/ytcard.mjs'), logLevel: 'warning' });
  const C = await import('./.build/youtube/ytcard.mjs');
  const reply = '▶ Home batteries explained · The Energy Shed · 18:32\nhttps://www.youtube.com/watch?v=dQw4w9WgXcQ\nTwo small batteries can beat one big one.\n\nMoments:\n[0:15] what a home battery does — https://youtu.be/dQw4w9WgXcQ?t=15\n2. **[12:40](https://youtu.be/dQw4w9WgXcQ?t=760)** why the second battery matters\n- 18:00 - the advice https://youtu.be/dQw4w9WgXcQ?t=1080\n\nWant a quiz on it?';
  const v = C.videoOf(reply);
  assert.equal(v.id, 'dQw4w9WgXcQ');
  assert.deepEqual([v.title, v.author, v.length], ['Home batteries explained', 'The Energy Shed', '18:32']);
  assert.deepEqual(v.moments.map((m) => [m.sec, m.label, m.url]), [[15, 'what a home battery does', 'https://youtu.be/dQw4w9WgXcQ?t=15'], [760, 'why the second battery matters', 'https://youtu.be/dQw4w9WgXcQ?t=760'], [1080, 'the advice', 'https://youtu.be/dQw4w9WgXcQ?t=1080']]);
  assert.equal(v.rest, 'Two small batteries can beat one big one.\n\nWant a quiz on it?');
  assert.equal(C.videoOf('a fun one: https://youtu.be/dQw4w9WgXcQ'), null, 'a video merely mentioned gets no card');
  assert.equal(C.videoOf('the weather is fine'), null);
  assert.equal(C.videoOf('[1:02:05] late on https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1h2m5s').moments[0].sec, 3725);
  assert.equal(C.clock(3725), '1:02:05');
});
