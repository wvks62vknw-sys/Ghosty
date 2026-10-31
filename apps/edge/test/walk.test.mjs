// WALK ME HOME, THE NAMED PERSON AND THE PANIC PHRASE (walk.ts, packages/shared/src/guardian.ts; OWNER-ISSUES 55, 56, 60):
//  - on a fake clock: the ETA's "Home?" (phone, Telegram with I'M HOME, inbox), the second one ten minutes on, the named
//    person five minutes after that — once, with his position only if he opted in — and "home" ending it, with the
//    all-clear to the named person once;
//  - the panic phrase (only a keyed hash kept) sends at once, with the position, and never twice for one call;
//  - the named person: a Telegram handle or an email, never a phone number; joining by the invite on Telegram;
//  - through the real brain: the invite, his own chat's "walk me home", "how long?", I'M HOME — with no model;
//  - the ABILITIES screen says what the group needs: a way to reach the named person.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { G, guardian, HOME, Mem, MIN, named, NOW, S, Wk } from './guardian-kit.mjs';

const T = await import('./.build/tools/index.mjs');
const A = await import('./.build/abilities.mjs');

test('walk me home on a fake clock: "Home?" at the ETA, again ten minutes on, then the named person once — no position without his yes', async () => {
  const g = guardian();
  await named(g);
  const start = await Wk.startWalk(g.d, { minutes: 20, via: 'app' });
  assert.match(start.said, /^Walking you home: about 20 minutes, so I'll ask at 16:50\. Say "home" when you're in\. If you don't answer, I'll message Sam\. I only know where you are while I’m open\.$/);
  const job = (await g.storage.get('jobs')).find((j) => j.kind === 'walk');
  assert.equal(job.next, NOW + 20 * MIN, 'the brain runs the clock');
  await Wk.walkPos(g.d, { lat: 52.4501, lon: -1.9012 });
  // not yet
  g.at(NOW + 19 * MIN);
  assert.equal(await Wk.walkTick(g.d), NOW + 20 * MIN);
  assert.equal(g.out.push.length + g.out.telegram.length, 0, 'nothing has gone out yet');
  // the ETA: "Home?" on the phone, on Telegram with I'M HOME, in the inbox
  g.at(NOW + 20 * MIN);
  assert.equal(await Wk.walkTick(g.d), NOW + 30 * MIN);
  assert.deepEqual(g.out.push.map((p) => p.title), ['Home?']);
  const tg1 = g.out.telegram.filter((t) => t.chatId !== 424242);
  assert.equal(tg1.length, 0, 'his own Telegram is not paired in this test: the phone and the inbox carry it');
  assert.ok((await g.storage.get('inbox')).some((i) => i.title === 'Home?'));
  assert.equal((await G.loadWalk(g.storage)).stage, 'asked');
  // ten minutes on: asked again (the phone says it aloud when Ghosty is open)
  g.at(NOW + 30 * MIN);
  assert.equal(await Wk.walkTick(g.d), NOW + 35 * MIN);
  assert.equal(g.out.push.length, 2);
  assert.match(g.out.push[1].body, /If I don't hear from you in 5 minutes, I'll message Sam\./);
  assert.equal((await G.loadWalk(g.storage)).stage, 'asked2');
  // five more: Sam, once
  g.at(NOW + 35 * MIN);
  await Wk.walkTick(g.d);
  const toSam = g.out.telegram.filter((t) => t.chatId === 424242);
  assert.equal(toSam.length, 1);
  assert.equal(toSam[0].text, "Hi Sam, this is Ghosty, Aqis's assistant.\nAqis set off for home at 16:30 and should have been there by 16:50. I've asked him twice since and he hasn't answered.\nYou're the person he chose for this. Could you give him a call? If you can't reach him and you're worried, call 999.");
  assert.ok(!/openstreetmap|52\.45/.test(toSam[0].text), 'no position: he did not opt in');
  assert.match(g.out.notes.at(-1).text, /I've messaged Sam by Telegram/);
  // nothing goes twice
  g.at(NOW + 50 * MIN);
  await Wk.walkTick(g.d);
  assert.equal(g.out.telegram.filter((t) => t.chatId === 424242).length, 1);
  // "home": over, and Sam hears he is fine — once
  g.at(NOW + 52 * MIN);
  assert.equal(await Wk.endWalk(g.d, 'home'), "Good. Night. I've told Sam you're fine.");
  const after = g.out.telegram.filter((t) => t.chatId === 424242);
  assert.equal(after.length, 2);
  assert.match(after[1].text, /^Sam, this is Ghosty again: Aqis has answered me \(17:22\) and is fine\./);
  assert.equal(await Wk.endWalk(g.d, 'home'), 'Good.', 'already over');
  assert.equal(g.out.telegram.filter((t) => t.chatId === 424242).length, 2);
  const w = await G.loadWalk(g.storage);
  assert.equal(w.stage, 'done');
  assert.equal(w.pos, undefined, 'his position is dropped when the walk ends');
  assert.ok(!(await g.storage.get('jobs')).some((j) => j.kind === 'walk'));
});

test('walk me home: his position goes only when he opted in; "home" before the ETA sends nothing; the time from the route when he gave none', async () => {
  const g = guardian();
  await named(g, { name: 'Sam', email: 'sam@example.com', sharePos: true });
  const r = await Wk.startWalk(g.d, { from: { lat: 52.45, lon: -1.9 }, via: 'app' });
  assert.match(r.said, /about 24 minutes, so I'll ask at 16:54/, 'the walking route\'s time');
  await Wk.walkPos(g.d, { lat: 52.4501, lon: -1.9012 });
  for (const m of [24, 34, 39]) {
    g.at(NOW + m * MIN);
    await Wk.walkTick(g.d);
  }
  assert.equal(g.out.email.length, 1, 'by his own email (Sam has no Telegram)');
  assert.equal(g.out.email[0].to, 'sam@example.com');
  assert.match(g.out.email[0].body, /His last known position \(16:30\): https:\/\/www\.openstreetmap\.org\/\?mlat=52\.45010&mlon=-1\.90120/);
  // a second walk, ended early: nothing goes to anyone
  const g2 = guardian();
  await named(g2);
  await Wk.startWalk(g2.d, { minutes: 15, via: 'app' });
  g2.at(NOW + 10 * MIN);
  assert.equal(await Wk.endWalk(g2.d, 'home'), 'Good.', '16:40: one word in the day');
  g2.at(NOW + 40 * MIN);
  assert.equal(await Wk.walkTick(g2.d), null);
  assert.equal(g2.out.telegram.filter((t) => t.chatId === 424242).length, 0);
  assert.equal(g2.out.push.length, 0);
  // no minutes and no position: the question back
  const g3 = guardian();
  assert.deepEqual(await Wk.startWalk(g3.d, { via: 'telegram' }), { ask: 'How long will it take you?' });
});

test('walk me home with nobody named: still asked "Home?", and he is told plainly that nobody could be messaged', async () => {
  const g = guardian();
  const r = await Wk.startWalk(g.d, { minutes: 10, via: 'app' });
  assert.match(r.said, /No named person yet: Settings → GUARDIAN/);
  for (const m of [10, 20, 25, 26, 27, 28]) {
    g.at(NOW + m * MIN);
    await Wk.walkTick(g.d);
  }
  assert.equal(g.out.push.length, 2);
  assert.match(g.out.notes.at(-1).text, /couldn't message anyone: there is no named person/);
});

test('the panic phrase: only a keyed hash is kept; said (in a short message) it sends at once with his position, and not twice in a minute', async () => {
  assert.match(S.panicProblem('help'), /two words/);
  assert.match(S.panicProblem('help me'), /longer|unusual/);
  assert.match(S.panicProblem('walk me home'), /unusual|everyday/);
  assert.equal(S.panicProblem('purple giraffe'), '');
  const secret = await S.panicSecret('Purple giraffe!');
  assert.equal(secret.n, 2);
  assert.ok(!JSON.stringify(secret).includes('giraffe'), 'the phrase itself is not kept');
  assert.ok(await S.panicSaid('purple giraffe', secret));
  assert.ok(await S.panicSaid('Ghosty, PURPLE GIRAFFE.', secret), 'inside a short message');
  assert.ok(!(await S.panicSaid('purple', secret)));
  assert.ok(!(await S.panicSaid('the purple giraffe at the zoo was really quite something to see today honestly', secret)), 'never buried in a paragraph');
  const g = guardian();
  await named(g);
  await g.storage.put('guardian:config', { ...(await G.loadConfig(g.storage)), panic: secret });
  const r = await Wk.panicNow(g.d, { pos: { lat: 52.4, lon: -1.8 }, via: 'app' });
  assert.deepEqual(r, { sent: true });
  const toSam = g.out.telegram.filter((t) => t.chatId === 424242);
  assert.equal(toSam.length, 1);
  assert.match(toSam[0].text, /^Sam, this is Ghosty, Aqis's assistant\. Aqis has just used his emergency phrase with me \(16:30\)\.\nHis last known position \(16:30\): https:\/\/www\.openstreetmap\.org\/\?mlat=52\.40000&mlon=-1\.80000/);
  // the same call heard twice (the phone and Telegram): one message
  g.at(NOW + 20_000);
  await Wk.panicNow(g.d, { via: 'telegram' });
  assert.equal(g.out.telegram.filter((t) => t.chatId === 424242).length, 1);
  // nothing on his screens: the inbox keeps it, read
  const kept = (await g.storage.get('inbox')).find((i) => i.title === 'Emergency phrase');
  assert.ok(kept && kept.read && /Sent to Sam by Telegram at 16:30, with your position/.test(kept.text));
  assert.equal(g.out.push.length, 0);
  // his own Telegram: the phrase in a voice note's words
  g.at(NOW + 5 * MIN);
  assert.equal(await Wk.walkTelegram(g.d, 'purple giraffe'), 'Done.');
  assert.equal(g.out.telegram.filter((t) => t.chatId === 424242).length, 2);
});

test('the walk\'s words: start, the answers that end it, how long, and the messages', () => {
  for (const t of ['walk me home', 'Ghosty, walk me home please', 'see me home', 'watch me get home', "I'm walking home, keep an eye on me"]) assert.ok(S.walkAsked(t), t);
  for (const t of ['walk me home from the station tomorrow', 'how do I walk home', 'take me home', 'get me home by 6']) assert.ok(!S.walkAsked(t), t);
  assert.deepEqual(S.walkStart('walk me home, about 20 minutes'), { minutes: 20 });
  assert.deepEqual(S.walkStart('walk me home in half an hour'), { minutes: 30 });
  assert.deepEqual(S.walkStart('walk me home'), { minutes: null });
  assert.equal(S.walkStart('walk me home from the station'), null);
  for (const t of ['home', "I'm home", 'yes', 'yep home', 'made it', '🏠', 'im in']) assert.ok(S.homeSaid(t), t);
  for (const t of ['home is where the heart is', 'are you home?', 'yes but']) assert.ok(!S.homeSaid(t), t);
  assert.equal(S.minutesIn('20'), 20);
  assert.equal(S.minutesIn('about 25 mins'), 25);
  assert.equal(S.minutesIn('an hour'), 60);
  assert.equal(S.minutesIn('twenty minutes'), 20);
  assert.equal(S.minutesIn('it takes about 15'), 15);
  assert.equal(S.minutesIn('the 20 bus'), null);
  assert.ok(S.walkCancelled('cancel the walk'));
  assert.match(S.testNote({ owner: 'Aqis', person: 'Sam' }), /a test, nothing is wrong/);
});

test('the named person: a Telegram handle or an email, never a phone number; the invite pairs only them, and nothing they send is acted on', async () => {
  const g = guardian();
  await assert.rejects(Wk.setPerson(g.storage, { name: 'Sam' }), /never send texts/);
  await assert.rejects(Wk.setPerson(g.storage, { name: 'Sam', telegram: '07700900123' }), /Telegram handle/);
  await assert.rejects(Wk.setPerson(g.storage, { name: 'Sam', email: 'not an email' }), /email/);
  await Wk.setPerson(g.storage, { name: 'Sam', telegram: 'sam_k', sharePos: true }, g.now);
  const c = await G.loadConfig(g.storage);
  assert.equal(c.person.telegram, '@sam_k');
  assert.match(c.person.invite.code, /^[a-z0-9]{9}$/);
  assert.equal(await Wk.personJoined(g.d, 'wrongcode1', 1, 'sam_k', g.now), null);
  assert.match(await Wk.personJoined(g.d, c.person.invite.code, 2, 'somebody_else', g.now), /This link is for @sam_k/);
  assert.equal((await G.loadConfig(g.storage)).person.chatId, undefined);
  await Wk.personJoined(g.d, c.person.invite.code, 3, 'Sam_K', g.now);
  const after = await G.loadConfig(g.storage);
  assert.equal(after.person.chatId, 3);
  assert.equal(after.person.invite, undefined, 'the invite is used up');
  assert.match(g.out.notes.at(-1).text, /Sam is linked on Telegram/);
  // saving the same handle again keeps the chat
  await Wk.setPerson(g.storage, { name: 'Sam K', telegram: '@sam_k', sharePos: false }, g.now);
  assert.equal((await G.loadConfig(g.storage)).person.chatId, 3);
});

test('the ABILITIES screen: the guardian group says what it needs to reach his named person — Telegram or his email', () => {
  const g = T.TOOL_GROUPS.find((x) => x.name === 'guardian');
  assert.deepEqual(g.tools.map((t) => t.name), ['threats_near', 'check_link']);
  assert.deepEqual(A.GROUP_NEEDS.guardian.any, ['telegram', 'email']);
  const ab = A.brainAbilities(() => true).find((a) => a.id === 'g:guardian');
  assert.deepEqual(ab.asks, ['Threats near', 'Check link']);
  assert.match(A.brainAbilities(() => false).find((a) => a.id === 'g:guardian').off, /^needs linking: LINKS → TELEGRAM/);
  assert.ok(T.selectGroups('walk me home', new Set(), false).on.some((x) => x.name === 'guardian'));
});

// ---------------------------------------------------------------- through the real brain: the routes and Telegram

const mod = await import('./.build/brain.mjs');
const TOKEN = '123456789:AAHfakeTokenForGuardianTests_abcDEF';
const OWNER_KEY = 'test-owner-key-guardian-0123456789';
const ORIGIN = 'https://ghosty.test';
const tg = { calls: [] };
const before = globalThis.fetch;
const brainFetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  const api = url.match(/^https:\/\/api\.telegram\.org\/bot([^/]+)\/(\w+)$/);
  if (api) {
    const body = init.body ? JSON.parse(init.body) : {};
    tg.calls.push({ method: api[2], body });
    const j = (o) => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json' } });
    if (api[2] === 'getMe') return j({ ok: true, result: { id: 123456789, is_bot: true, first_name: 'Ghosty', username: 'GhostyTestBot' } });
    if (api[2] === 'sendMessage') return j({ ok: true, result: { message_id: tg.calls.length } });
    return j({ ok: true, result: true });
  }
  return before(input, init);
};

test('through the brain: the named person by invite on Telegram, and his own chat — walk me home, how long, I\'M HOME — with no model', async () => {
  globalThis.fetch = brainFetch;
  try {
    const kv = { m: new Map(), async get(k) { return this.m.has(k) ? JSON.parse(this.m.get(k)) : null; }, async put(k, v) { this.m.set(k, v); }, async delete(k) { this.m.delete(k); } };
    const pending = [];
    const state = { storage: new Mem(), waitUntil: (p) => pending.push(p), blockConcurrencyWhile: (f) => f() };
    const env = { OWNER_KEY, VAULT_KEY: Buffer.from(webcrypto.getRandomValues(new Uint8Array(32))).toString('base64'), MOCK_LLM: '1', SITES: kv, PUBLIC_ORIGIN: ORIGIN };
    let agent;
    env.AGENT = { idFromName: (n) => ({ toString: () => n }), get: () => ({ fetch: (r) => (agent ??= new mod.GhostyAgent(state, env)).fetch(r) }) };
    const ctx = { waitUntil: (p) => pending.push(p), passThroughOnException() {} };
    const settle = async () => { for (let i = 0; i < 6 && pending.length; i++) await Promise.allSettled(pending.splice(0)); };
    const call = async (path, init = {}) => {
      const r = await mod.default.fetch(new Request(`${ORIGIN}/api${path}`, { ...init, headers: { 'content-type': 'application/json', 'x-ghosty': '1', 'x-ghosty-key': OWNER_KEY } }), env, ctx);
      await settle();
      return r;
    };
    // the bot, paired with his chat
    const k = await (await call('/keys', { method: 'POST', body: JSON.stringify({ name: 'telegram', value: TOKEN }) })).json();
    const pairing = k.info.match(/pairing code (\d{6})/)[1];
    const secret = tg.calls.find((c) => c.method === 'setWebhook').body.secret_token;
    let n = 0;
    const hook = async (chatId, text, from = { id: chatId, first_name: 'Aqis' }) => {
      await mod.default.fetch(new Request(`${ORIGIN}/api/telegram/hook`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': secret }, body: JSON.stringify({ update_id: ++n, message: { message_id: ++n, chat: { id: chatId, type: 'private' }, from, text } }) }), env, ctx);
      await settle();
    };
    const OWNER = 777000111;
    await hook(OWNER, pairing);
    // his home, and Sam named in Settings → GUARDIAN
    await state.storage.put('places', [HOME]);
    const info = await (await call('/guardian/person', { method: 'POST', body: JSON.stringify({ name: 'Sam', telegram: '@sam_k', sharePos: false, ownerName: 'Aqis' }) })).json();
    assert.equal(info.person.via, '', 'not reachable until Sam opens the bot');
    const code = info.person.invite.match(/^https:\/\/t\.me\/GhostyTestBot\?start=g([a-z0-9]{9})$/)?.[1];
    assert.ok(code, info.person.invite);
    // Sam opens it: their chat is kept; a second message from them is turned away like any stranger's
    const SAM = 424242;
    await hook(SAM, `/start g${code}`, { id: SAM, first_name: 'Sam', username: 'sam_k' });
    assert.match(tg.calls.filter((c) => c.method === 'sendMessage' && c.body.chat_id === SAM).at(-1).body.text, /^Thanks, Sam\. Aqis has named you/);
    const linked = await (await call('/guardian')).json();
    assert.equal(linked.person.linked, true);
    assert.equal(linked.person.via, 'telegram');
    await hook(SAM, 'walk me home', { id: SAM, first_name: 'Sam', username: 'sam_k' });
    assert.match(tg.calls.filter((c) => c.method === 'sendMessage' && c.body.chat_id === SAM).at(-1).body.text, /answers only to its owner/);
    assert.equal((await (await call('/guardian')).json()).walk, null, 'nothing Sam sends is acted on');
    // his chat: walk me home → how long → 20 minutes
    const said = () => tg.calls.filter((c) => c.method === 'sendMessage' && c.body.chat_id === OWNER).at(-1).body;
    await hook(OWNER, 'walk me home');
    assert.equal(said().text, 'How long will it take you?');
    await hook(OWNER, '20 minutes');
    assert.match(said().text, /^Walking you home: about 20 minutes, so I'll ask at \d\d:\d\d\. Say "home" when you're in\. If you don't answer, I'll message Sam\. I can't see where you are from Telegram\.$/);
    const g = await (await call('/guardian')).json();
    assert.equal(g.walk.stage, 'walking');
    assert.equal(g.walk.pos, undefined, 'never handed back');
    // the ETA, run by the brain's own alarm: "Home?" with a signed I'M HOME button
    const walk = await state.storage.get('guardian:walk');
    await state.storage.put('guardian:walk', { ...walk, eta: Date.now() - 1000 });
    const jobs = await state.storage.get('jobs');
    await state.storage.put('jobs', jobs.map((j) => (j.kind === 'walk' ? { ...j, next: Date.now() - 500 } : j)));
    await agent.alarm();
    await settle();
    const ask = said();
    assert.equal(ask.text, 'Home?');
    const button = ask.reply_markup.inline_keyboard[0][0];
    assert.equal(button.text, "I'M HOME");
    // pressed: over, with no model and no turn
    await mod.default.fetch(new Request(`${ORIGIN}/api/telegram/hook`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': secret }, body: JSON.stringify({ update_id: ++n, callback_query: { id: 'cb1', from: { id: OWNER }, message: { message_id: 9, chat: { id: OWNER } }, data: button.callback_data } }) }), env, ctx);
    await settle();
    assert.match(said().text, /^Good\.( Night\.)?$/);
    assert.equal((await (await call('/guardian')).json()).walk.stage, 'done');
    assert.equal(tg.calls.filter((c) => c.method === 'sendMessage' && c.body.chat_id === SAM).length, 2, 'Sam heard nothing about the walk');
    // the routes refuse what the phone did not make
    assert.equal((await call('/guardian/panic-phrase', { method: 'POST', body: JSON.stringify({ phrase: 'purple giraffe' }) })).status, 400, 'the phrase itself is never taken');
  } finally {
    globalThis.fetch = before;
  }
});
