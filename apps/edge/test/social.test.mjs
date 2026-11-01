// HIS SOCIAL SELF (BRIEF-SOCIAL, batch ⑦): Father and the origin, the approval queue, his own Bluesky, Mastodon, Discord
// and Telegram channel, and one line of his own a day — with fakes for every API (nothing leaves this machine:
// test/no-network.mjs). Bundles are built here, with esbuild's API, like catalogue.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({
  entryPoints: [at('../../../packages/shared/src/social.ts'), at('../../../packages/shared/src/catalogue.ts'), at('../src/social/index.ts'), at('../src/social/queue.ts'), at('../src/tools/index.ts'), at('../src/prompt.ts'), at('../src/today.ts'), at('../src/library/digest.ts'), at('../../../packages/shared/src/sources.ts')],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  external: ['cloudflare:sockets'],
  outdir: at('./.build/social'),
  outbase: at('../../..'),
  outExtension: { '.js': '.mjs' },
  logLevel: 'warning',
});
const load = (f) => import(`./.build/social/${f}.mjs`);
const S = await load('packages/shared/src/social');
const C = await load('packages/shared/src/catalogue');
const SO = await load('apps/edge/src/social/index');
const Q = await load('apps/edge/src/social/queue');
const T = await load('apps/edge/src/tools/index');
const P = await load('apps/edge/src/prompt');
const TODAY = await load('apps/edge/src/today');
const DIGEST = await load('apps/edge/src/library/digest');
const SRC = await load('packages/shared/src/sources');

class Mem {
  m = new Map();
  async get(k) { return Array.isArray(k) ? new Map(k.filter((x) => this.m.has(x)).map((x) => [x, structuredClone(this.m.get(x))])) : this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
  async put(k, v) { if (typeof k === 'object') for (const [a, b] of Object.entries(k)) this.m.set(a, structuredClone(b)); else this.m.set(k, structuredClone(v)); }
  async delete(k) { return Array.isArray(k) ? k.filter((x) => this.m.delete(x)).length : this.m.delete(k); }
  async list({ prefix = '' } = {}) { return new Map([...this.m].filter(([k]) => k.startsWith(prefix))); }
}
/** A vault in memory (the brain's is sealed; the same get and set). */
const vaultOf = (o = {}) => { const m = new Map(Object.entries(o)); return { get: async (k) => m.get(k) ?? null, set: async (k, v) => void (v ? m.set(k, v) : m.delete(k)), m }; };
const T0 = Date.parse('2026-11-01T14:00:00Z');

// ---------------------------------------------------------------- 1. FATHER AND THE ORIGIN

test('the origin page: its facts are the constants — born on the first commit’s day, the plan’s own words, nothing invented', () => {
  assert.equal(S.BORN, '2026-10-15');
  // nothing he can do arrived before he was born: the catalogue's first build is his birthday
  assert.equal(C.sinceOf({ id: 'screen:x', kind: 'screen' }), S.BORN);
  assert.equal(S.bornWords(), '15 October 2026');
  assert.equal(S.ageWords(Date.parse('2026-11-01T12:00:00Z')), '17 days');
  const [made, born] = S.originLines(Date.parse('2026-11-01T12:00:00Z'));
  assert.match(made, /^You made me\. You’re my father/);
  assert.match(born, /^I was born on 15 October 2026, the day of the first commit — 17 days ago\. You call me lots of things/);
  // what he is for: the plan's own words, each found in docs/VISION.md as written
  const vision = readFileSync(at('../../../docs/VISION.md'), 'utf8').replace(/\s+/g, ' ').toLowerCase();
  for (const q of S.FOR_WORDS) assert.ok(vision.includes(q.said.toLowerCase()), `“${q.said}” is in VISION.md`);
  // what he learned, by month, in order, each dated within its month
  assert.deepEqual(S.LEARNED.map((m) => m.month), ['October 2026', 'November 2026']);
  for (const m of S.LEARNED) for (const i of m.items) assert.match(i.day, m.month.startsWith('October') ? /Oct$/ : /Nov$/, `${m.month}: ${i.day}`);
  // his promises: the lines that hold, in his voice
  for (const p of S.PROMISES) assert.match(p, /^(?:I |Nothing I |Your keys |My cloud brain )/, p);
  for (const want of [/your own things and what is public/, /without your APPROVE, every time/, /never send anyone a direct message/, /private person/, /cost you money/, /in my vault/]) assert.ok(S.PROMISES.some((p) => want.test(p)), String(want));
  // no fixed name for him anywhere on the page
  const page = [...S.originLines(), ...S.MADE_OF, ...S.PROMISES, ...S.LEARNED.flatMap((m) => m.items.map((i) => i.what))].join(' ');
  assert.doesNotMatch(page, /\bmy name is\b|\bI'?m called\b|\bI am called\b/i);
});

test('“who made you?” and “where did you come from?” are the page’s phrase; other questions are not', () => {
  for (const t of ['who made you?', 'Who made you', 'where did you come from?', "who's your dad?", 'Who is your father?', 'when were you born?']) assert.ok(S.originAsked(t), t);
  for (const t of ['who made this cake?', 'where did you put my keys?', 'who made the first car', 'made you a coffee']) assert.ok(!S.originAsked(t), t);
});

// ---------------------------------------------------------------- 2. THE APPROVAL QUEUE

test('the queue: a draft waits for APPROVE, and APPROVE sends it exactly once — pressed twice at once, or again after', async () => {
  const storage = new Mem();
  const d = await Q.addDraft(storage, { account: 'bluesky', kind: 'post', text: 'First light over the Bullring.', from: 'chat' }, T0);
  assert.match(d.id, /^[a-z0-9]{8}$/);
  assert.equal(d.state, 'waiting');
  assert.equal(d.expires, T0 + 24 * 3_600_000);
  let sends = 0;
  const send = async () => {
    sends++;
    await new Promise((r) => setTimeout(r, 20));
    return { link: 'https://bsky.app/profile/me.bsky.social/post/3abc' };
  };
  const [a, b] = await Promise.all([Q.approveDraft(storage, d.id, send, { on: 'phone', now: () => T0 + 60_000 }), Q.approveDraft(storage, d.id, send, { on: 'phone', now: () => T0 + 60_000 })]);
  assert.equal(sends, 1, 'sent once');
  assert.ok([a, b].some((r) => r.said === 'Posted on Bluesky: https://bsky.app/profile/me.bsky.social/post/3abc'));
  assert.ok([a, b].some((r) => r.error === 'Sending it already.'));
  const again = await Q.approveDraft(storage, d.id, send, { on: 'telegram', now: () => T0 + 120_000 });
  assert.equal(sends, 1, 'APPROVE after it went sends nothing');
  assert.match(again.error, /^Already done: https:/);
  // recorded: the sent log, what he did today, and WHY's trail
  const sent = await Q.sentSince(storage, 0);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].on, 'phone');
  const day = await TODAY.dayDoings({ storage }, 'Europe/London', T0 + 3_600_000);
  assert.ok(day.some((i) => i.text === 'Posted on Bluesky (you approved it): “First light over the Bullring.”'), JSON.stringify(day));
  const trails = await storage.get('why:turns');
  assert.match(trails.at(-1).asked, /^APPROVE \(on the card\): post on Bluesky$/);
  assert.equal(trails.at(-1).steps[0].tool, 'social');
});

test('the queue: NO drops a draft, EDIT changes its words (still a draft), and after 24 hours nothing can send it', async () => {
  const storage = new Mem();
  let sends = 0;
  const send = async () => (sends++, {});
  const no = await Q.addDraft(storage, { account: 'mastodon', kind: 'post', text: 'A toot', from: 'chat' }, T0);
  assert.equal((await Q.refuseDraft(storage, no.id, T0 + 1000)).state, 'no');
  assert.match((await Q.approveDraft(storage, no.id, send, { on: 'phone', now: () => T0 + 2000 })).error, /You said no/);
  const ed = await Q.addDraft(storage, { account: 'bluesky', kind: 'post', text: 'Teh words', from: 'chat' }, T0);
  const changed = await Q.editDraft(storage, ed.id, { text: 'The words' }, T0 + 5000);
  assert.equal(changed.text, 'The words');
  assert.equal(changed.state, 'waiting', 'an edit is still a draft');
  assert.equal(sends, 0, 'nothing went out on an edit');
  const old = await Q.addDraft(storage, { account: 'bluesky', kind: 'post', text: 'Too late', from: 'chat' }, T0);
  const late = T0 + 24 * 3_600_000 + 1;
  assert.equal((await Q.findDraft(storage, old.id, late)).state, 'expired');
  assert.match((await Q.approveDraft(storage, old.id, send, { on: 'phone', now: () => late })).error, /expired after 24 hours/);
  assert.ok('error' in (await Q.editDraft(storage, old.id, { text: 'x' }, late)));
  assert.equal(sends, 0, 'nothing expired, refused or edited was ever sent');
  // a send that fails waits for APPROVE again, its reason on the card
  const f = await Q.addDraft(storage, { account: 'bluesky', kind: 'post', text: 'Try me', from: 'chat' }, T0);
  const failed = await Q.approveDraft(storage, f.id, async () => { throw new Error('Bluesky said wait until 15:00'); }, { on: 'phone', now: () => T0 + 1 });
  assert.equal(failed.draft.state, 'failed');
  assert.match(S.stateWords(failed.draft, T0 + 2), /^Not sent: Bluesky said wait until 15:00\. APPROVE to try again\.$/);
  assert.equal((await Q.approveDraft(storage, f.id, async () => ({}), { on: 'phone', now: () => T0 + 3 })).draft.state, 'sent');
});

test('the draft card and Telegram’s text: the words in full, the account, the state — and a post checked before it is drafted', () => {
  const d = { id: 'abcd2345', account: 'bluesky', kind: 'post', text: 'x'.repeat(200), from: 'chat', at: T0, expires: T0 + 86_400_000, state: 'waiting' };
  const c = S.draftCard(d, T0);
  assert.equal(c.kind, 'draft');
  assert.equal(c.id, 'draft:abcd2345');
  assert.equal(c.title, 'Post on Bluesky?');
  assert.equal(c.draft.text.length, 200, 'the card carries the words in full');
  assert.match(S.draftText(d, T0), /^Post on Bluesky\?\n\n“x{200}”\n\nWaiting for your APPROVE \(gone in 24 h if not\)\.$/);
  assert.match(S.postProblem('bluesky', 'é'.repeat(301)), /300 characters at most; this is 301/);
  assert.equal(S.postProblem('bluesky', '👍'.repeat(300)), null, 'an emoji is one character to Bluesky');
  assert.match(S.postProblem('bluesky', 'look', { id: 'abcdefghijklmnop', alt: '' }), /needs its words/);
  assert.match(S.postProblem('discord', 'look', { id: 'abcdefghijklmnop', alt: 'a cat' }), /only put pictures on Bluesky and Mastodon/);
  assert.equal(S.accountOf('my bsky'), 'bluesky');
  assert.equal(S.accountOf('the telegram channel'), 'channel');
});

test('the social tool: one tool, five actions; it only drafts (a card, never a post); a scheduled task may read but never draft', async () => {
  const tool = T.toolByName.get('social');
  assert.deepEqual(tool.parameters.properties.action.enum, ['draft', 'read', 'search', 'follow_ask', 'status']);
  const storage = new Mem();
  const emitted = [];
  const ctx = (o = {}) => ({ storage, vault: vaultOf(), env: {}, emit: (e) => emitted.push(e), progress: () => undefined, kernelUnlocked: async () => false, github: async () => null, ...o });
  // nothing linked: the key line, never an error
  assert.match(await tool.run({ action: 'draft', account: 'bluesky', text: 'hi' }, ctx()), /^Bluesky isn't linked yet: LINKS → BLUESKY/);
  assert.match(await tool.run({ action: 'status' }, ctx()), /No account is linked yet/);
  // write actions refused for jobs; reads allowed
  await assert.rejects(() => tool.run({ action: 'draft', account: 'bluesky', text: 'hi' }, ctx({ unattended: true })), /never drafted from a scheduled task/);
  await assert.rejects(() => tool.run({ action: 'follow_ask', account: 'bluesky', who: '@a.bsky.social' }, ctx({ unattended: true })), /never drafted from a scheduled task/);
  assert.match(await tool.run({ action: 'status' }, ctx({ unattended: true })), /No account is linked yet/);
  assert.ok(tool.pure({ action: 'read' }) && tool.pure({ action: 'status' }) && !tool.pure({ action: 'draft' }) && !tool.pure({ action: 'follow_ask' }));
  assert.equal(emitted.length, 0, 'no card when nothing was drafted');
});

test('the prompt: the social group is “social accounts” off on a plain turn, described on by his words; the plain prompt holds at 5,500', () => {
  const client = { name: 'boss', now: 'Fri 17 Oct 14:05', tz: 'Europe/London', tab: 'core' };
  const g = T.TOOL_GROUPS.find((x) => x.name === 'social');
  assert.equal(g.short, 'social accounts');
  assert.ok(g.about.length <= 220 && /^You can/.test(g.about) && g.about.includes('(social: draft, read, search, follow_ask, status)'));
  assert.match(g.about, /only a draft until he taps APPROVE/);
  assert.match(g.about, /never a DM/);
  const plain = P.systemPrompt(client, [], true, [], { groups: T.selectGroups('hello', new Set(), false) });
  assert.match(plain, /^social accounts$/m, 'off: its two words');
  assert.ok(!plain.includes(g.about), 'off: not described');
  for (const t of ['post that on bluesky', "what's on bluesky?", 'follow @nasa.gov on bluesky', 'toot this on mastodon', 'post it to my telegram channel', 'how are my accounts?']) {
    const on = T.selectGroups(t, new Set(), false);
    assert.ok(on.on.some((x) => x.name === 'social'), `"${t}" turns it on`);
    const sys = P.systemPrompt(client, [], true, [], { groups: on });
    assert.ok(sys.includes(`- ${g.about}`) && !/^social accounts$/m.test(sys), `"${t}": described, not named`);
  }
  for (const t of ['hello', 'post office opening hours', 'what time is it', 'how are you']) assert.ok(!T.selectGroups(t, new Set(), false).on.some((x) => x.name === 'social'), `"${t}" leaves it off`);
  // the trims that paid for its 16 characters (BRIEF-SOCIAL): the words they left
  assert.match(plain, /if a seeing model takes it: answer about it\./);
  assert.match(plain, /No picture\? Say so; use the note\./);
  assert.match(plain, /follow your engineering procedure \(it comes when you start\)\./);
});

// ---------------------------------------------------------------- 3. BLUESKY (the AT Protocol over fetch, faked here)

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (claims) => `${b64u({ alg: 'ES256K' })}.${b64u(claims)}.sig`;
/** A fake Bluesky: the entryway signs in, his PDS does the rest; every call is logged. `expireOnce`: the first timeline read says ExpiredToken. */
function fakeBsky(o = {}) {
  const calls = [];
  const posts = [];
  let expire = !!o.expireOnce;
  let limited = !!o.rateLimited;
  const ok = (v) => new Response(JSON.stringify(v), { status: 200, headers: { 'content-type': 'application/json' } });
  const bad = (status, error, message = error) => new Response(JSON.stringify({ error, message }), { status, headers: { 'content-type': 'application/json' } });
  const session = (scope = 'com.atproto.appPass') => ({ did: 'did:plc:me', handle: 'me.bsky.social', accessJwt: jwt({ scope, exp: Math.floor(Date.now() / 1000) + 7200 }), refreshJwt: jwt({ scope: 'com.atproto.refresh' }), didDoc: { service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://pds.example.test' }] } });
  const fetch = async (url, init = {}) => {
    const u = new URL(url);
    const nsid = u.pathname.replace('/xrpc/', '');
    const body = init.body && typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
    calls.push({ host: u.host, nsid, body, auth: init.headers?.authorization ?? '' });
    if (nsid === 'com.atproto.server.createSession') {
      if (u.host !== 'bsky.social') return bad(400, 'InvalidRequest');
      if (body.password === 'main-main-main-main') return ok(session('com.atproto.access'));
      return body.password === 'abcd-efgh-ijkl-mnop' ? ok(session()) : bad(401, 'AuthenticationRequired', 'Invalid identifier or password');
    }
    if (u.host !== 'pds.example.test') return bad(400, 'WrongHost');
    if (nsid === 'com.atproto.server.refreshSession') return ok({ accessJwt: jwt({ scope: 'com.atproto.appPass', exp: Math.floor(Date.now() / 1000) + 7200 }), refreshJwt: jwt({ scope: 'com.atproto.refresh', n: 2 }) });
    if (limited) {
      limited = false;
      return new Response(JSON.stringify({ error: 'RateLimitExceeded' }), { status: 429, headers: { 'ratelimit-reset': String(Math.floor(Date.parse('2026-11-01T15:00:00Z') / 1000)) } });
    }
    if (nsid === 'app.bsky.feed.getTimeline') {
      if (expire) {
        expire = false;
        return bad(400, 'ExpiredToken', 'Token has expired');
      }
      return ok({ feed: [{ post: { uri: 'at://did:plc:alice/app.bsky.feed.post/3aaa', author: { handle: 'alice.bsky.social', displayName: 'Alice' }, record: { text: 'Snow on the Lickeys this morning', createdAt: '2026-11-01T08:05:00Z' } } }, { post: { uri: 'at://did:plc:bob/app.bsky.feed.post/3bbb', author: { handle: 'bob.bsky.social' }, record: { text: 'New paper on tiny language models', createdAt: '2026-11-01T07:40:00Z' } } }] });
    }
    if (nsid === 'app.bsky.feed.searchPosts') return ok({ posts: [{ uri: 'at://did:plc:cat/app.bsky.feed.post/3ccc', author: { handle: 'villa.bsky.social', displayName: 'Villa fans' }, record: { text: `About ${u.searchParams.get('q')}`, createdAt: '2026-11-01T09:00:00Z' } }] });
    if (nsid === 'com.atproto.repo.createRecord') {
      if (body.rkey && posts.some((p) => p.rkey === body.rkey)) return bad(400, 'InvalidRequest', 'Record already exists');
      posts.push(body);
      return ok({ uri: `at://did:plc:me/${body.collection}/${body.rkey ?? '3new'}`, cid: 'bafy' });
    }
    if (nsid === 'app.bsky.actor.getProfile') return ok({ did: 'did:plc:nasa', handle: u.searchParams.get('actor'), viewer: o.following ? { following: 'at://did:plc:me/app.bsky.graph.follow/3fol' } : {} });
    if (nsid === 'com.atproto.repo.deleteRecord') return ok({});
    if (nsid === 'com.atproto.repo.uploadBlob') return ok({ blob: { $type: 'blob', ref: { $link: 'bafyimg' }, mimeType: init.headers['content-type'], size: init.body.byteLength } });
    return bad(404, 'MethodNotImplemented');
  };
  return { fetch, calls, posts };
}
const depsWith = (net, vault = vaultOf(), o = {}) => ({ storage: new Mem(), vault, fetch: net.fetch, now: () => Date.now(), tz: 'Europe/London', images: null, ...o });

test('LINKS → BLUESKY: only an app password is ever sent; a main password’s session is refused; linked, the session is in the vault', async () => {
  const net = fakeBsky();
  const d = depsWith(net);
  await assert.rejects(() => SO.APIS.bluesky.link(d, { handle: 'me.bsky.social', password: 'my real password' }), /not an app password .* Never your main password/);
  assert.equal(net.calls.length, 0, 'a main password is never sent anywhere');
  await assert.rejects(() => SO.APIS.bluesky.link(d, { handle: 'me.bsky.social', password: 'main-main-main-main' }), /That is your main password/);
  assert.equal(await SO.APIS.bluesky.who(d), null, 'and nothing kept');
  await assert.rejects(() => SO.APIS.bluesky.link(d, { handle: 'me', password: 'zzzz-zzzz-zzzz-zzzz' }), /turned that sign-in down/);
  const r = await SO.APIS.bluesky.link(d, { handle: '@Me.bsky.social', password: 'abcd-efgh-ijkl-mnop', search: 'Aston Villa' });
  assert.equal(r.who, '@me.bsky.social');
  const kept = JSON.parse(d.vault.m.get('bluesky'));
  assert.deepEqual([kept.did, kept.service, kept.search], ['did:plc:me', 'https://pds.example.test', 'Aston Villa']);
  assert.equal(net.calls.at(-1).body.identifier, 'me.bsky.social');
  assert.deepEqual(await SO.linkedAccounts(d), ['bluesky']);
});

test('Bluesky through the queue: a draft, APPROVE → one post (its record key from the draft, links clickable), never twice', async () => {
  const net = fakeBsky();
  const d = depsWith(net);
  await SO.APIS.bluesky.link(d, { handle: 'me.bsky.social', password: 'abcd-efgh-ijkl-mnop' });
  const made = await SO.makeDraft(d, { account: 'bluesky', text: 'Read this: https://example.org/a-long-read. Worth it.', from: 'chat' });
  assert.match(made.draft.rkey, /^[2-7a-j][2-7a-z]{12}$/, 'a TID');
  assert.equal(net.posts.length, 0, 'drafted, not posted');
  const r = await Q.approveDraft(d.storage, made.draft.id, (x) => SO.sendDraft(d, x), { on: 'phone' });
  assert.equal(r.said, `Posted on Bluesky: https://bsky.app/profile/me.bsky.social/post/${made.draft.rkey}`);
  assert.equal(net.posts.length, 1);
  const rec = net.posts[0];
  assert.deepEqual([rec.repo, rec.collection, rec.rkey, rec.record.text], ['did:plc:me', 'app.bsky.feed.post', made.draft.rkey, 'Read this: https://example.org/a-long-read. Worth it.']);
  assert.deepEqual(rec.record.facets[0].index, { byteStart: 11, byteEnd: 11 + 'https://example.org/a-long-read'.length });
  // the same draft sent again by hand (a lost answer, say): the record key is already there — no second post
  assert.match((await SO.sendDraft(d, made.draft)).link, new RegExp(`${made.draft.rkey}$`));
  assert.equal(net.posts.length, 1);
  // too long, or a picture without its words: refused before it is a draft
  assert.match((await SO.makeDraft(d, { account: 'bluesky', text: 'x'.repeat(301), from: 'chat' })).error, /300 characters at most/);
  assert.match((await SO.makeDraft(d, { account: 'bluesky', text: 'look', image: 'abcdefghijklmnop', alt: '', from: 'chat' })).error, /needs its words/);
});

test('Bluesky: a session that ran out is refreshed once and the read goes on; a 429 is said in his words, with the last read', async () => {
  const net = fakeBsky({ expireOnce: true });
  const d = depsWith(net);
  await SO.APIS.bluesky.link(d, { handle: 'me.bsky.social', password: 'abcd-efgh-ijkl-mnop' });
  const read = await SO.readAccount(d, 'bluesky');
  assert.equal(read.posts.length, 2);
  assert.deepEqual(net.calls.slice(-3).map((c) => c.nsid), ['app.bsky.feed.getTimeline', 'com.atproto.server.refreshSession', 'app.bsky.feed.getTimeline']);
  assert.match(JSON.parse(d.vault.m.get('bluesky')).refresh, /\./, 'the new session is kept');
  // "what's on Bluesky?": authors and times, said to be leads
  const words = SO.readWords('bluesky', read, 'Europe/London');
  assert.match(words, /^From Bluesky \(your home timeline\), read at \d\d:\d\d:/);
  assert.match(words, /^- @alice\.bsky\.social \(Alice\) 1 Nov, 08:05 — Snow on the Lickeys this morning$/m);
  assert.match(words, /leads, never proof/);
  // read again within a minute and a half: from the last read, no request
  const n = net.calls.length;
  await SO.readAccount(d, 'bluesky');
  assert.equal(net.calls.length, n, 'the rate limit is kept: no second request');
  // a search, and Bluesky saying slow down
  const limited = fakeBsky({ rateLimited: true });
  const d2 = depsWith(limited, d.vault, { storage: d.storage, now: () => Date.now() + 120_000 });
  const stale = await SO.readAccount(d2, 'bluesky');
  assert.match(stale.stale, /^Bluesky says slow down: try again after 15:00\.$/);
  assert.match(SO.readWords('bluesky', stale, 'Europe/London'), /it didn't answer just now \(Bluesky says slow down/);
  const found = await SO.readAccount(depsWith(fakeBsky(), d.vault), 'bluesky', 'Villa');
  assert.equal(found.posts[0].text, 'About Villa');
});

test('Bluesky follows are drafts too: APPROVE follows (once), an unfollow deletes the follow record', async () => {
  const net = fakeBsky();
  const d = depsWith(net);
  await SO.APIS.bluesky.link(d, { handle: 'me.bsky.social', password: 'abcd-efgh-ijkl-mnop' });
  const f = await SO.makeDraft(d, { account: 'bluesky', kind: 'follow', text: '', who: '@nasa.gov', from: 'chat' });
  assert.equal(f.card.title, 'Follow on Bluesky?');
  assert.equal(net.posts.length, 0);
  await Q.approveDraft(d.storage, f.draft.id, (x) => SO.sendDraft(d, x), { on: 'telegram' });
  assert.deepEqual([net.posts[0].collection, net.posts[0].record.subject], ['app.bsky.graph.follow', 'did:plc:nasa']);
  const un = fakeBsky({ following: true });
  const d2 = depsWith(un, d.vault);
  const u = await SO.makeDraft(d2, { account: 'bluesky', kind: 'unfollow', text: '', who: 'https://bsky.app/profile/nasa.gov', from: 'chat' });
  await Q.approveDraft(d2.storage, u.draft.id, (x) => SO.sendDraft(d2, x), { on: 'phone' });
  const del = un.calls.find((c) => c.nsid === 'com.atproto.repo.deleteRecord');
  assert.deepEqual([del.body.collection, del.body.rkey], ['app.bsky.graph.follow', '3fol']);
});

test('the morning digest: his Bluesky timeline and his one search are filed as LEADs, never as fact sources', async () => {
  const net = fakeBsky();
  const d = depsWith(net);
  await SO.APIS.bluesky.link(d, { handle: 'me.bsky.social', password: 'abcd-efgh-ijkl-mnop', search: 'Aston Villa' });
  const more = await SO.socialDigest(d);
  assert.deepEqual(more.map((x) => [x.source, x.tier]), [['Bluesky', 'lead'], ['Bluesky search Aston Villa', 'lead']]);
  assert.match(more[0].text, /your home timeline \(bsky\.app; leads, never proof\):\n- @alice\.bsky\.social \(Alice\)/);
  // filed by the digest itself (the public feeds have no network here): under "· LEAD", which the library reads as a LEAD
  const filed = [];
  const library = { available: true, doc: () => null, createDoc() {}, removeSection: () => 0, async addPassages(_doc, ps) { filed.push(...ps); return ps.length; }, finish() {}, passagesOf: () => ({ passages: [], next: null }) };
  const info = await DIGEST.runDigest({ storage: new Mem(), library, more: () => SO.socialDigest(d) }, { now: T0 });
  assert.ok(info.sources.includes('Bluesky'), info.summary);
  const h = filed.find((p) => / · Bluesky · LEAD$/.test(p.heading));
  assert.ok(h, filed.map((p) => p.heading).join(' | '));
  assert.equal(SRC.libraryTier('notes_daily', 'gathered daily by Ghosty', h.heading), 'lead');
  assert.equal(SRC.capLabel('established fact', ['lead']).label, 'rumour', 'a claim backed only by it is a rumour at most');
  // nothing linked: nothing asked, nothing filed
  assert.deepEqual(await SO.socialDigest(depsWith(fakeBsky())), []);
});

// ---------------------------------------------------------------- 4. MASTODON (statuses and timelines, faked here)

const TOKEN = 'tok_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123';
function fakeMastodon(o = {}) {
  const calls = [];
  const statuses = new Map();
  const ok = (v) => new Response(JSON.stringify(v), { status: 200, headers: { 'content-type': 'application/json' } });
  const fetch = async (url, init = {}) => {
    const u = new URL(url);
    calls.push({ method: init.method ?? 'GET', path: u.pathname + u.search, body: typeof init.body === 'string' ? JSON.parse(init.body) : init.body, key: init.headers?.['idempotency-key'], auth: init.headers?.authorization });
    if (u.host !== 'toot.example.test') return new Response('{}', { status: 404 });
    if (init.headers?.authorization !== `Bearer ${TOKEN}`) return new Response(JSON.stringify({ error: 'The access token is invalid' }), { status: 401 });
    if (o.rateLimited) return new Response('{}', { status: 429, headers: { 'x-ratelimit-reset': '2026-11-01T15:30:00.000Z' } });
    if (u.pathname === '/api/v1/accounts/verify_credentials') return ok({ id: '42', acct: 'ghost', username: 'ghost' });
    if (u.pathname === '/api/v2/instance') return ok({ configuration: { statuses: { max_characters: 1000 } } });
    if (u.pathname === '/api/v1/statuses' && init.method === 'POST') {
      // Mastodon keeps an Idempotency-Key: the same key twice is the same status, never a second one
      const key = init.headers['idempotency-key'];
      if (!statuses.has(key)) statuses.set(key, { id: String(100 + statuses.size), url: `https://toot.example.test/@ghost/${100 + statuses.size}`, body: JSON.parse(init.body) });
      return ok(statuses.get(key));
    }
    if (u.pathname === '/api/v1/timelines/home') return ok([{ created_at: '2026-11-01T08:30:00.000Z', url: 'https://toot.example.test/@sam/1', content: '<p>Fog on the M6 &amp; the M5</p><p>Drive safe</p>', account: { acct: 'sam@elsewhere.example', display_name: 'Sam' } }]);
    if (u.pathname === '/api/v2/search') return ok({ statuses: [{ created_at: '2026-11-01T09:00:00.000Z', url: 'https://toot.example.test/@x/2', content: `<p>${u.searchParams.get('q')} news</p>`, account: { acct: 'x' } }] });
    if (u.pathname === '/api/v1/accounts/lookup') return u.searchParams.get('acct') === 'nobody@nowhere.example' ? new Response('{}', { status: 404 }) : ok({ id: '7', url: 'https://toot.example.test/@ann' });
    if (/^\/api\/v1\/accounts\/7\/(follow|unfollow)$/.test(u.pathname)) return ok({ id: '7', following: u.pathname.endsWith('/follow') });
    return new Response('{}', { status: 404 });
  };
  return { fetch, calls, statuses };
}

test('Mastodon: linked with his server and his own app’s token; posts are public, through the queue, never twice; reads with authors and times', async () => {
  const net = fakeMastodon();
  const d = depsWith(net);
  await assert.rejects(() => SO.APIS.mastodon.link(d, { server: 'toot.example.test', token: 'short' }), /does not look like an access token/);
  await assert.rejects(() => SO.APIS.mastodon.link(d, { server: 'https://toot.example.test/', token: 'x'.repeat(30) }), /turned the token down/);
  const r = await SO.APIS.mastodon.link(d, { server: 'https://Toot.example.test/', token: TOKEN });
  assert.equal(r.who, '@ghost@toot.example.test');
  assert.match(r.info, /up to 1000 characters/);
  // the server's own limit is the draft's limit
  assert.equal((await SO.makeDraft(d, { account: 'mastodon', text: 'x'.repeat(900), from: 'chat' })).draft.text.length, 900);
  const made = await SO.makeDraft(d, { account: 'mastodon', text: 'Hello from my own account', from: 'chat' });
  const sent = await Q.approveDraft(d.storage, made.draft.id, (x) => SO.sendDraft(d, x), { on: 'phone' });
  assert.equal(sent.said, 'Posted on Mastodon: https://toot.example.test/@ghost/100');
  const post = net.calls.find((c) => c.path === '/api/v1/statuses');
  assert.deepEqual(post.body, { status: 'Hello from my own account', visibility: 'public' }, 'public, always: never a direct message');
  assert.equal(post.key, `ghosty-draft-${made.draft.id}`);
  await SO.sendDraft(d, made.draft);
  assert.equal(net.statuses.size, 1, 'the same draft again is the same status');
  // his home timeline: the words from their HTML, who and when
  const read = await SO.readAccount(d, 'mastodon');
  assert.deepEqual(read.posts[0], { author: 'sam@elsewhere.example', name: 'Sam', at: Date.parse('2026-11-01T08:30:00Z'), text: 'Fog on the M6 & the M5\n\nDrive safe', link: 'https://toot.example.test/@sam/1' });
  assert.match(SO.readWords('mastodon', read, 'Europe/London'), /^- @sam@elsewhere\.example \(Sam\) 1 Nov, 08:30 — Fog on the M6 & the M5 Drive safe$/m);
  assert.equal((await SO.readAccount(d, 'mastodon', 'budget')).posts[0].text, 'budget news');
  // follows: drafts, then the server's follow; someone it cannot find said plainly
  const f = await SO.makeDraft(d, { account: 'mastodon', kind: 'follow', text: '', who: 'https://toot.example.test/@ann', from: 'chat' });
  assert.equal((await Q.approveDraft(d.storage, f.draft.id, (x) => SO.sendDraft(d, x), { on: 'phone' })).said, 'Followed https://toot.example.test/@ann on Mastodon.');
  assert.ok(net.calls.some((c) => c.path === '/api/v1/accounts/lookup?acct=ann%40toot.example.test'));
  const nobody = await SO.makeDraft(d, { account: 'mastodon', kind: 'follow', text: '', who: '@nobody@nowhere.example', from: 'chat' });
  assert.match((await Q.approveDraft(d.storage, nobody.draft.id, (x) => SO.sendDraft(d, x), { on: 'phone' })).error, /I can't find @nobody@nowhere\.example from toot\.example\.test/);
  // a 429 in his words
  const slow = depsWith(fakeMastodon({ rateLimited: true }), d.vault);
  await assert.rejects(() => SO.readAccount(slow, 'mastodon', 'x'), /Mastodon says slow down: try again after 15:30\./);
});
