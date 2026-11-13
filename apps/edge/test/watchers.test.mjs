// LIFE EASIER's brain half (BRIEF-OCT-IDEAS-2 4, 7, 8): run from router.test.mjs, as kernel-yes is (package.json is protected, so no
// new file in the test list). Never the network: every page is a stand-in handed to the module as `d.fetch`.
//  - WATCHERS: the hourly beat (the guard job's watchTick) reads a watcher, compares it with its last reading, and tells once; a price
//    that went down, a page whose words changed, a strike on a status page; a page that asks for a login, a person's page, an
//    address on a network, a plain http address are all refused; a page that cannot be read changes nothing; STOP removes it;
//  - the money nudges (packages/shared/src/spending.ts): a renewal this week, a price up, the month running hot, from rows alone;
//  - the email triage's two doors answer nothing when no email is linked, and a reply can only answer a message of his inbox;
//  - the words (shared/lifeeasier.ts): "tell me when…", the triage, the letter, the five sentences.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({
  entryPoints: ['../src/watchers.ts', '../src/mailtriage.ts', '../src/guardian.ts', '../../../packages/shared/src/lifeeasier.ts', '../../../packages/shared/src/spending.ts'].map(at),
  bundle: true, format: 'esm', platform: 'neutral', external: ['cloudflare:sockets'], outdir: at('./.build/life'), outbase: at('../../..'), outExtension: { '.js': '.mjs' }, logLevel: 'warning',
});
const Wt = await import('./.build/life/apps/edge/src/watchers.mjs');
const Ml = await import('./.build/life/apps/edge/src/mailtriage.mjs');
const G = await import('./.build/life/apps/edge/src/guardian.mjs');
const L = await import('./.build/life/packages/shared/src/lifeeasier.mjs');
const S = await import('./.build/life/packages/shared/src/spending.mjs');

class Mem {
  m = new Map();
  async get(k) { return this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
  async put(k, v) { this.m.set(k, structuredClone(v)); }
  async delete(k) { return this.m.delete(k); }
  async list() { return new Map(); }
  async setAlarm() {}
  async getAlarm() { return null; }
}
const HOUR = 3_600_000;

/** A made-up public web: pages by address, each switchable, every read counted. */
function web() {
  const w = { price: 29.99, strike: false, notice: 1, down: false, calls: [] };
  const page = (title, body, status = 200) => new Response(`<!doctype html><html><head><title>${title}</title></head><body>${body}</body></html>`, { status, headers: { 'content-type': 'text/html' } });
  w.fetch = async (url) => {
    const u = new URL(String(url));
    w.calls.push(u.href);
    if (w.down) throw new TypeError('fetch failed');
    if (u.pathname === '/kettle') return page('Hartley Kettle', `<meta property="product:price:amount" content="${w.price.toFixed(2)}"><p>Now £${w.price.toFixed(2)}</p>`);
    if (u.pathname === '/status') return page('Line 74 status', `<p>${w.strike ? 'Industrial action on Friday: no services because of a strike.' : 'Good service on all routes.'}</p>`);
    if (u.pathname === '/notice') return page('Notice board', `<p>Notice ${w.notice}: the hall is open.</p><script>var t=${Math.random()}</script>`);
    if (u.pathname === '/login') return page('no', 'sign in', 403);
    if (u.pathname === '/signin') return page('Sign in', '<input type="password">');
    return page('nothing', 'no price here');
  };
  return w;
}

function watchers() {
  const storage = new Mem();
  const notes = [];
  const w = web();
  let now = Date.UTC(2026, 10, 11, 9, 0);
  const d = { env: {}, storage, vault: { get: async () => null }, notify: async (n) => void notes.push(n), fetch: w.fetch, now: () => now };
  return { d, storage, notes, w, tick: (ms = HOUR) => (now += ms), get now() { return now; } };
}

const add = (g, kind, path, label) => Wt.addWatcher(g.d, { kind, url: `https://watch.example.test${path}`, ...(label ? { label } : {}) });
const list = (g) => g.storage.m.get('watchers:list') ?? [];

test('watchers 1: a price that goes down is told once, by the hourly beat, and then the watcher is told and done', async () => {
  const g = watchers();
  const r = await add(g, 'price', '/kettle');
  assert.ok(r.watcher, r.error);
  assert.match(r.said, /Watching Hartley Kettle: £29\.99 now\. I look every hour and tell you once/);
  // the beat before an hour has passed does not look again (a shop is never hammered)
  await G.watchTick(g.d);
  assert.equal(g.w.calls.length, 1, 'no second read inside the hour: only the one the add made');
  // an hour on, the same price: nothing told
  g.tick();
  await G.watchTick(g.d);
  assert.equal(g.notes.length, 0, 'the same price tells nothing');
  // the price drops: the next beat tells once
  g.w.price = 24.99;
  g.tick();
  await G.watchTick(g.d);
  assert.equal(g.notes.length, 1, 'told once');
  assert.equal(g.notes[0].title, 'Price dropped');
  assert.match(g.notes[0].text, /Hartley Kettle is £24\.99 now, down from £29\.99\./);
  // it drops again: not told again, and not read again
  g.w.price = 19.99;
  const reads = g.w.calls.length;
  g.tick();
  await G.watchTick(g.d);
  assert.equal(g.notes.length, 1, 'never told twice');
  assert.equal(g.w.calls.length, reads, 'a told watcher is not read again');
  assert.equal(list(g)[0].state, 'told');
  assert.match(list(g)[0].line, /down from £29\.99/);
});

test('watchers 2: a page changed and a strike on a status page, each on its own rule; a page that did not answer changes nothing', async () => {
  const g = watchers();
  await add(g, 'page', '/notice');
  await add(g, 'strike', '/status', 'Line 74');
  // the notice's script changes every read: the words (scripts left out) are what is compared
  g.tick();
  await G.watchTick(g.d);
  assert.equal(g.notes.length, 0, 'the same words are no change, whatever a script holds');
  // a failed look is never a change
  g.w.down = true;
  g.w.notice = 2;
  g.w.strike = true;
  g.tick();
  await G.watchTick(g.d);
  assert.equal(g.notes.length, 0, 'a page that did not answer tells nothing');
  assert.ok(list(g).every((x) => x.ok === false && /could not be reached/.test(x.note)), 'and says so on the list');
  g.w.down = false;
  g.tick();
  await G.watchTick(g.d);
  assert.deepEqual(g.notes.map((n) => n.title).sort(), ['Page changed', 'Strike on your line']);
  const strike = g.notes.find((n) => n.title === 'Strike on your line');
  assert.match(strike.text, /Line 74 now mentions a strike: …?.*Industrial action on Friday/);
  g.tick();
  await G.watchTick(g.d);
  assert.equal(g.notes.length, 2, 'both told once, no more');
});

test('watchers 3: public pages only: a login, a person\'s page, a network address and plain http are refused, and a watcher that finds a login stops', async () => {
  const g = watchers();
  for (const [url, re] of [
    ['https://watch.example.test/login', /asks for a login/],
    ['https://watch.example.test/signin', /asks for a login/],
    ['https://www.facebook.com/some.person', /someone’s account/],
    ['https://www.instagram.com/some.person/', /someone’s account/],
    ['https://192.168.1.10/status', /public web pages with a name|private, local|never an address/],
    ['http://watch.example.test/kettle', /full https/],
    ['https://user:pass@watch.example.test/kettle', /username and password/],
    ['https://localhost/kettle', /public domain/],
  ]) {
    const r = await Wt.addWatcher(g.d, { kind: 'page', url });
    assert.ok(r.error && re.test(r.error), `${url} refused: ${r.error}`);
  }
  assert.equal(list(g).length, 0, 'none of them was kept');
  assert.ok((await Wt.addWatcher(g.d, { kind: 'price', url: 'https://watch.example.test/nothing' })).error.includes('couldn’t find a price'), 'a price page with no price is no watcher');
  assert.ok((await Wt.addWatcher(g.d, { kind: 'bogus', url: 'https://watch.example.test/kettle' })).error, 'what to wait for is asked');
  // a page that begins to ask for a login is stopped, not read again
  const r = await add(g, 'page', '/notice');
  assert.ok(r.watcher);
  const realFetch = g.d.fetch;
  g.d.fetch = async (u) => new Response('x', { status: 403 });
  g.tick();
  await G.watchTick(g.d);
  assert.equal(list(g)[0].state, 'stopped');
  assert.match(list(g)[0].note, /I never sign in/);
  g.d.fetch = realFetch;
});

test('watchers 4: the list, the most it holds, and STOP, over the route the phone uses', async () => {
  const g = watchers();
  const route = (method, path, body) => G.guardianRoute(new Request(`https://x.test${path}`, { method, ...(body ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}) }), path.split('?')[0], method, g.d);
  const a = await (await route('POST', '/guardian/watchers', { kind: 'price', url: 'https://watch.example.test/kettle' })).json();
  assert.ok(a.watcher.id && a.said);
  assert.ok(!('last' in a.watcher), 'the phone is never handed a reading');
  const bad = await route('POST', '/guardian/watchers', { kind: 'price', url: 'https://www.facebook.com/x' });
  assert.equal(bad.status, 400);
  const l = await (await route('GET', '/guardian/watchers')).json();
  assert.equal(l.watchers.length, 1);
  assert.equal(l.watchers[0].state, 'watching');
  const gone = await (await route('DELETE', `/guardian/watchers?id=${a.watcher.id}`)).json();
  assert.equal(gone.removed, true);
  assert.equal(gone.watchers.length, 0);
  assert.equal((await (await route('DELETE', '/guardian/watchers?id=nothing')).json()).removed, false);
  for (let i = 0; i < Wt.MAX_WATCHERS; i++) assert.ok((await Wt.addWatcher(g.d, { kind: 'page', url: `https://watch.example.test/notice?n=${i}` })).watcher);
  assert.match((await Wt.addWatcher(g.d, { kind: 'page', url: 'https://watch.example.test/notice?n=99' })).error, /already: stop one first/);
  // the look of his own (the tool's CHECK) does not read his watchers
  const reads = g.w.calls.length;
  g.tick();
  await G.watchTick(g.d, { quiet: true });
  assert.equal(g.w.calls.length, reads, 'a quiet look reads only his places');
  // CHECK NOW does, whatever the hour
  await route('POST', '/guardian/check');
  assert.ok(g.w.calls.length > reads, 'CHECK NOW reads them');
});

test('email triage: nothing is read or sent with no email linked, and a reply answers only a message that is in the inbox', async () => {
  const none = { vault: { get: async () => null } };
  const r = await Ml.mailRoute(new Request('https://x.test/guardian/mail/inbox'), '/guardian/mail/inbox', 'GET', none);
  assert.deepEqual(await r.json(), { linked: false, messages: [] });
  const s = await Ml.mailRoute(new Request('https://x.test/guardian/mail/send', { method: 'POST', body: JSON.stringify({ reply_to_uid: 4, body: 'hi' }) }), '/guardian/mail/send', 'POST', none);
  assert.equal(s.status, 400);
  const linked = { vault: { get: async () => 'me@example.com app-password imap.example.com smtp.example.com' } };
  const noUid = await Ml.mailRoute(new Request('https://x.test/guardian/mail/send', { method: 'POST', body: JSON.stringify({ to: 'anyone@else.com', body: 'hi', confirm: true }) }), '/guardian/mail/send', 'POST', linked);
  assert.equal(noUid.status, 400);
  assert.match((await noUid.json()).error, /answers one of your emails/);
  const empty = await Ml.mailRoute(new Request('https://x.test/guardian/mail/send', { method: 'POST', body: JSON.stringify({ reply_to_uid: 3, body: '   ', confirm: true }) }), '/guardian/mail/send', 'POST', linked);
  assert.match((await empty.json()).error, /nothing to send yet/);
  // nothing is sent without his tap: a well-formed reply with no `confirm: true` (the SEND key's own flag) is refused before the mail server is asked
  const unconfirmed = await Ml.mailRoute(new Request('https://x.test/guardian/mail/send', { method: 'POST', body: JSON.stringify({ reply_to_uid: 3, body: 'hello' }) }), '/guardian/mail/send', 'POST', linked);
  assert.equal(unconfirmed.status, 400);
  assert.match((await unconfirmed.json()).error, /your SEND is needed/);
});

// ---------------------------------------------------------------- the money nudges

const row = (d, t, a, c = 'subscriptions') => ({ d, t, a, k: t.toUpperCase(), c, by: 'rule' });

test('nudges: a renewal this week, a price that went up and the month running hot, each from the rows alone', () => {
  const rows = [
    // Netflix on the 14th, two months running: the next is Saturday 14 November
    row('2026-09-14', 'Netflix', -10.99), row('2026-10-14', 'Netflix', -10.99),
    // Spotify went up on the 2nd
    row('2026-09-02', 'Spotify', -9.99), row('2026-10-02', 'Spotify', -9.99), row('2026-11-02', 'Spotify', -11.99),
    // last month by the 11th: £100; this month by the 11th: £340
    row('2026-10-03', 'Tesco', -100, 'groceries'), row('2026-10-20', 'Tesco', -400, 'groceries'),
    row('2026-11-03', 'Tesco', -340, 'groceries'),
  ];
  const n = S.nudges(rows, [], '2026-11-11');
  assert.deepEqual(n.map((x) => x.kind).sort(), ['hot', 'price', 'renew']);
  const by = (k) => n.find((x) => x.kind === k);
  assert.match(by('renew').line, /^Netflix renews on Saturday 14 November: about £10\.99, the same as last time\.$/);
  assert.equal(by('renew').id, 'renew:NETFLIX:2026-11-14');
  assert.match(by('price').line, /^Spotify went up: £11\.99 against £9\.99 last time\.$/);
  assert.match(by('hot').line, /^November is running hot: £\d+ out so far, £\d+ more than by this day in October\.$/);
  // a week later nothing renews yet, and the same price rise is not news in January
  assert.ok(!S.nudges(rows, [], '2026-11-20').some((x) => x.kind === 'renew'), 'not this week any more');
  assert.ok(!S.nudges(rows, [], '2027-01-20').some((x) => x.kind === 'price'), 'a price rise older than six weeks is no nudge');
  assert.deepEqual(S.nudges([], [], '2026-11-11'), []);
  // a shop is not a subscription: the same day each month, four times the money, is no renewal and no price rise
  const shop = [row('2026-10-01', 'Tesco', -100, 'groceries'), row('2026-11-01', 'Tesco', -400, 'groceries')];
  assert.deepEqual(S.nudges(shop, [], '2026-11-02').filter((x) => x.kind !== 'hot'), [], 'a shop visited on the same day is no subscription');
  assert.ok(!S.nudges([row('2026-09-02', 'Gym', -30), row('2026-10-02', 'Gym', -30), row('2026-11-02', 'Gym', -90)], [], '2026-11-03').some((x) => x.kind === 'price'), 'three times the money is another bill, not a price rise');
  assert.ok(!S.nudges([row('2026-10-02', 'Spotify', -9.99), row('2026-11-02', 'Spotify', -11.99)], [], '2026-11-03').some((x) => x.kind === 'price'), 'one charge before is not enough to call a price a rise');
  // against his budget, when the month is not hot against last month
  const calm = [row('2026-10-03', 'Pub', -90, 'eating out'), row('2026-10-08', 'Pub', -80, 'eating out'), row('2026-11-03', 'Pub', -90, 'eating out'), row('2026-11-05', 'Pub', -80, 'eating out')];
  const b = S.nudges(calm, [{ category: 'eating out', monthly: 200 }], '2026-11-11');
  assert.equal(b.length, 1);
  assert.match(b[0].line, /^Eating out is running hot: £170 of your £200 budget with 19 days of November to go\.$/);
});

// ---------------------------------------------------------------- the words

test('words: "tell me when…" is a watcher, and nothing else is', () => {
  const a = (t) => L.watcherAsked(t);
  assert.deepEqual(a('tell me when this price drops https://shop.example.test/kettle.'), { kind: 'price', url: 'https://shop.example.test/kettle', words: 'tell me when this price drops' });
  assert.equal(a('Tell me when this page changes')?.kind, 'page');
  assert.equal(a("tell me when there's a strike on my line")?.kind, 'strike');
  assert.equal(a('let me know if there is industrial action on the 74')?.kind, 'strike');
  assert.equal(a('tell me when the kettle gets cheaper')?.kind, 'price');
  for (const no of ['tell me a joke', 'tell me when my pasta is ready', 'remind me when this price drops', 'what is a strike', 'when does the price drop']) assert.equal(a(no), null, no);
});

test('words: which emails need an answer, said in numbers, and a reply to start from', () => {
  const m = (address, subject, name = '') => ({ address, subject, from: name ? `${name} <${address}>` : address, name, uid: 1, date: '' });
  assert.equal(L.needsAnswer(m('sam@example.com', 'Can you do Thursday?', 'Sam Jones')), true);
  assert.equal(L.needsAnswer(m('anna@example.com', 'Quick question about the flat')), true);
  assert.equal(L.needsAnswer(m('no-reply@shop.com', 'Can you rate your order?')), false);
  assert.equal(L.needsAnswer(m('news@paper.com', 'Your morning newsletter?')), false);
  assert.equal(L.needsAnswer(m('sam@example.com', 'Photos from the weekend')), false);
  assert.equal(L.needsAnswer(m('sam@example.com', 'Your order has shipped. Please track it')), false);
  assert.equal(L.triageLine(2), 'two emails need an answer');
  assert.equal(L.triageLine(1), 'one email needs an answer');
  assert.equal(L.triageLine(12), '12 emails need an answer');
  const d = L.draftReply(m('sam@example.com', 'Re: Re: Can you do Thursday?', 'Sam Jones'), 'Aqis');
  assert.equal(d.subject, 'Re: Can you do Thursday?');
  assert.match(d.body, /^Hi Sam,\n\nThanks for your email about “Can you do Thursday\?”\./);
  assert.match(d.body, /Thanks,\nAqis$/);
});

test('words: a letter or a bill, its date, its amount and its sender', () => {
  const bill = 'British Gas\n\nDear Mr Khan\nYour balance of £84.20 is due by 14 November 2026.\nPlease pay by direct debit.\nAccount number: 4471 2290';
  const r = L.letterOf(bill, '2026-11-11');
  assert.equal(r.kind, 'bill');
  assert.equal(r.date, '2026-11-14');
  assert.equal(r.amount, '£84.20');
  assert.equal(r.sender, 'British Gas');
  assert.equal(r.reference, '4471 2290');
  const appt = 'Moseley Surgery\nYour appointment with Dr Patel is on 19/11/2026 at 10:30. Reference 88231.';
  const a = L.letterOf(appt, '2026-11-11');
  assert.equal(a.date, '2026-11-19');
  assert.equal(a.sender, 'Moseley Surgery');
  assert.equal(L.letterOf('The Hartley kettle. Boil in under two minutes. Dishwasher safe.', '2026-11-11'), null, 'not a letter');
  assert.equal(L.letterOf('Your balance of £84.20 was due by 14 October 2026. Reference 77.', '2026-11-11')?.date ?? null, null, 'a date that has gone is not asked about');
  assert.equal(L.datesIn('see you on 3 March', '2026-11-11')[0].iso, '2027-03-03', 'a date with no year is the next one coming');
});

test('words: what I learned this week is five sentences at most, and honest about what it does not have', () => {
  const run = (plain, think) => ({ at: 1, complete: true, items: Array.from({ length: 20 }, (_, i) => ({ plain: i < plain, think: i < think })) });
  const sentences = (xs) => xs.join(' ').split(/(?<=[.!?])\s+/).length;
  const full = L.teachLines({ now: 1, ledger: ['In the GYM I reached Chess level 4 (from 3).', 'My offline brain can use a new tool: weather.', 'Your own brains answered 62% of what you asked this week.'], ledgerKept: false, runs: [run(11, 15), run(13, 15)], gym: { lessons: 2, latest: { wonAt: 23, idea: 'a double threat on columns 3 and 5' } } });
  assert.ok(full.length <= 5 && sentences(full) <= 5, `at most five sentences: ${full.join(' ')}`);
  assert.match(full[0], /I got 13 of 20 right as I answer in chat and 15 of 20 with THINK HARDER/);
  assert.match(full[1], /closed from 4 questions to 2/);
  assert.ok(full.some((s) => /Connect 4 at move 23 with a double threat/.test(s)), 'the GYM loss is there');
  const none = L.teachLines({ now: 1, ledger: null, ledgerKept: false, runs: [], gym: { lessons: 0 } });
  assert.deepEqual(none, ['I have not run my report card to the end yet, so I have no scores to teach you from.', 'I cannot reach my brain, so I cannot say what I learned to do this week.']);
  const grew = L.teachLines({ now: 1, ledger: [], ledgerKept: false, runs: [run(10, 12), run(10, 15)], gym: { lessons: 0 } });
  assert.match(grew[1], /did not close: it grew from 2 questions to 5/);
  assert.match(L.teachLines({ now: 1, ledger: ['I did a thing.'], ledgerKept: true, runs: [], gym: { lessons: 0 } }).join(' '), /last copy/);
});

test('words: what did I miss, in the ask line and on the card', () => {
  for (const yes of ['what did I miss?', 'What did I miss', 'what have I missed', "what's happened while I was away", 'catch me up', 'Hey Ghosty, what did I miss']) assert.equal(L.missedAsked(yes), true, yes);
  for (const no of ['what did I eat', 'I missed the bus', 'what is a miss', 'what’s new', 'whats new in the news']) assert.equal(L.missedAsked(no), false, no);
  const clock = (ms) => new Date(ms).toISOString().slice(11, 16);
  const lines = L.missedLines({ since: 1, now: 2, headlines: ['A', 'B'], passed: [{ at: Date.UTC(2026, 10, 10, 14, 0), title: 'Dentist' }], spend: { rows: 14 }, school: ['Your stage 3 paper is marked.'], training: [], inbox: 2 }, clock);
  assert.deepEqual(lines, ['Dentist came and went at 14:00.', '2 headlines you haven’t seen, first: A', 'You added 14 rows of spending.', 'School: Your stage 3 paper is marked.', '2 notices from me are unread.']);
  assert.deepEqual(L.missedLines({ since: 1, now: 2, headlines: [], passed: [], spend: null, school: [], training: [], inbox: 0 }, clock), []);
});

// POLISH 3 (2b): ONE WATCHER SYSTEM. The money pack's price watch (tools/money.ts `watch`) is stored as a watcher of kind `price`: the watchers'
// beat reads it, tells it once whichever reader sees the drop first, and `unwatch` and STOP are the same removal (money.test.mjs drives the pack).
test('watchers 3: a price watch the money pack stored is read by the beat, told once, never twice, and STOP removes it', async () => {
  const g = watchers();
  const t0 = g.now;
  // as tools/money.ts writes it: kind price, the first reading in `last`, watching
  g.storage.m.set('watchers:list', [{ id: 'mp1', kind: 'price', url: 'https://watch.example.test/kettle', label: 'Hartley Kettle', created: t0, checked: t0, ok: true, last: { price: 29.99 }, state: 'watching' }]);
  g.w.price = 24.99;
  g.tick();
  await G.watchTick(g.d);
  assert.equal(g.notes.length, 1, 'the beat told the drop');
  assert.match(g.notes[0].text, /Hartley Kettle is £24\.99 now, down from £29\.99\./);
  // a second reader of the same drop (the beat again, a manual CHECK) tells nothing: the store carries the told reading
  g.tick(2 * HOUR);
  await Wt.watchersTick(g.d, { force: true });
  await G.watchTick(g.d);
  assert.equal(g.notes.length, 1, 'never told twice');
  assert.equal(list(g)[0].state, 'told');
  // STOP (DELETE /guardian/watchers?id=) is the one removal
  const u = new URL('https://x/guardian/watchers?id=mp1');
  const r = await (await Wt.watchersRoute(new Request(u, { method: 'DELETE' }), '/guardian/watchers', 'DELETE', u, g.d)).json();
  assert.equal(r.removed, true);
  assert.equal(list(g).length, 0, 'gone from the one store the money pack lists from');
});
