// Telegram (telegram.ts): saving the bot token connects the bot (getMe, setWebhook with a
// secret) and makes a pairing code; the public webhook refuses a wrong or missing secret; the
// owner pairs with the code and strangers are turned away once an hour; a message from the
// paired chat runs a normal brain turn whose reply comes back as sendMessage calls (split under
// Telegram's limit), a photo reaches the model as a picture, a voice note is transcribed and
// answered in text and in Ghosty's voice, an approval becomes APPROVE / NOT NOW buttons with
// signed, expiring data answered through a callback (only the owner's chat; a forged or old one
// is refused), notifications reach the chat too, and the token never appears anywhere it could be read.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

const TG = await import('./.build/telegram.mjs');
const mod = await import('./.build/brain.mjs');
const worker = mod.default;
const { GhostyAgent } = mod;

const TOKEN = '123456789:AAHfakeTokenForTests_abcDEFghiJKLmno';
const OWNER_KEY = 'test-owner-key-0123456789abcdef';
const ORIGIN = 'https://ghosty.test';

/** A stand-in for the SITES KV namespace (the link record is mirrored there). */
function fakeKv() {
  return {
    m: new Map(),
    async get(k, type) {
      if (!this.m.has(k)) return null;
      const v = this.m.get(k);
      if (type === 'arrayBuffer') return typeof v === 'string' ? new TextEncoder().encode(v).buffer : v.slice(0);
      return typeof v === 'string' ? JSON.parse(v) : v;
    },
    async put(k, v) { this.m.set(k, typeof v === 'string' ? v : v.slice(0)); },
    async delete(k) { this.m.delete(k); },
  };
}
class MemStorage {
  m = new Map();
  async get(k) { return Array.isArray(k) ? new Map(k.filter((x) => this.m.has(x)).map((x) => [x, structuredClone(this.m.get(x))])) : this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
  async put(k, v) { if (typeof k === 'object') for (const [a, b] of Object.entries(k)) this.m.set(a, structuredClone(b)); else this.m.set(k, structuredClone(v)); }
  async delete(k) { return Array.isArray(k) ? k.filter((x) => this.m.delete(x)).length : this.m.delete(k); }
  async list({ prefix = '' } = {}) { return new Map([...this.m].filter(([k]) => k.startsWith(prefix))); }
  async setAlarm() {}
  async getAlarm() { return null; }
}
const jpeg = (n = 300) => {
  const b = new Uint8Array(n);
  b.set([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  for (let i = 10; i < n; i++) b[i] = (i * 3) & 0xff;
  return b;
};

/**
 * Telegram's Bot API, faked: every call is recorded ({ method, body }); answers can be set per
 * method; a file download answers with the bytes for its path. Anything else fails like a lost
 * connection, as test/no-network.mjs does.
 */
const tg = { calls: [], answers: {}, files: {}, fail: null, web: {} };
const real = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  const api = url.match(/^https:\/\/api\.telegram\.org\/bot([^/]+)\/(\w+)$/);
  if (api) {
    // A file upload (sendVoice, sendAudio) is multipart: its fields, a file as { file, type, size }.
    const body = init.body instanceof FormData
      ? Object.fromEntries([...init.body.entries()].map(([k, v]) => [k, typeof v === 'string' ? v : { file: v.name, type: v.type, size: v.size }]))
      : init.body ? JSON.parse(init.body) : {};
    tg.calls.push({ token: api[1], method: api[2], body });
    if (tg.fail) throw new TypeError(`fetch failed: ${url}`);
    const a = tg.answers[api[2]];
    if (typeof a === 'function') return a(body, tg.calls.filter((c) => c.method === api[2]).length);
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
    if (api[2] === 'getMe') return json({ ok: true, result: { id: 123456789, is_bot: true, first_name: 'Ghosty', username: 'GhostyTestBot' } });
    if (api[2] === 'getFile') return json({ ok: true, result: { file_id: body.file_id, file_path: `files/${body.file_id}`, file_size: tg.files[body.file_id]?.byteLength ?? 0 } });
    if (api[2] === 'sendMessage') return json({ ok: true, result: { message_id: tg.calls.length } });
    return json({ ok: true, result: true });
  }
  const file = url.match(/^https:\/\/api\.telegram\.org\/file\/bot([^/]+)\/files\/(.+)$/);
  if (file) {
    tg.calls.push({ token: file[1], method: 'download', body: { file: file[2] } });
    const bytes = tg.files[file[2]];
    return bytes ? new Response(bytes) : new Response('not found', { status: 404 });
  }
  // A public address a test serves (a TikTok's oEmbed card, its cover), recorded like the rest.
  if (tg.web[url]) {
    tg.calls.push({ method: 'web', body: { url } });
    return tg.web[url]();
  }
  throw new TypeError(`fetch failed: tests have no network (${url.slice(0, 120)})`);
};
const sent = (method = 'sendMessage') => tg.calls.filter((c) => c.method === method);
const texts = () => sent().map((c) => c.body.text);

// ---- the brain: one in-memory Durable Object with the scripted model ----
const pending = [];
const kv = fakeKv();
const state = { storage: new MemStorage(), waitUntil: (p) => pending.push(p), blockConcurrencyWhile: (f) => f() };
const env = { OWNER_KEY, VAULT_KEY: Buffer.from(webcrypto.getRandomValues(new Uint8Array(32))).toString('base64'), MOCK_LLM: '1', SITES: kv, PUBLIC_ORIGIN: ORIGIN };
let agent;
env.AGENT = { idFromName: (n) => ({ toString: () => n }), get: () => ({ fetch: (r) => (agent ??= new GhostyAgent(state, env)).fetch(r) }) };
const ctx = { waitUntil: (p) => pending.push(p), passThroughOnException() {} };
const settle = async () => {
  // Work handed to waitUntil can hand more over (a turn's notes): drain until quiet.
  for (let i = 0; i < 6 && pending.length; i++) await Promise.allSettled(pending.splice(0));
};
const call = (path, init = {}, key = OWNER_KEY) =>
  worker.fetch(new Request(`${ORIGIN}${path}`, { ...init, headers: { 'content-type': 'application/json', 'x-ghosty': '1', ...(key ? { 'x-ghosty-key': key } : {}), ...(init.headers ?? {}) } }), env, ctx);
const status = async () => (await call('/api/telegram/status')).json();
/** An update to the public webhook: no owner key, no x-ghosty header, from Telegram's servers. */
const hook = async (update, secret) => {
  const r = await worker.fetch(new Request(`${ORIGIN}/api/telegram/hook`, { method: 'POST', headers: { 'content-type': 'application/json', ...(secret ? { 'x-telegram-bot-api-secret-token': secret } : {}) }, body: JSON.stringify(update) }), env, ctx);
  await settle();
  return r;
};
let n = 0;
const msg = (chatId, fields, from = { id: chatId, first_name: 'Sam' }) => ({ update_id: ++n, message: { message_id: ++n, chat: { id: chatId, type: 'private', first_name: from.first_name }, from, ...fields } });
const OWNER_CHAT = 777000111;
const STRANGER = 555000222;
let secret = '';

test('splitMessage: under 4,000 characters a message, cut at a paragraph, else a sentence, else a space', () => {
  assert.deepEqual(TG.splitMessage('short'), ['short']);
  assert.deepEqual(TG.splitMessage(''), []);
  const para = `${'a'.repeat(3000)}\n\n${'b'.repeat(3000)}`;
  assert.deepEqual(TG.splitMessage(para), ['a'.repeat(3000), 'b'.repeat(3000)]);
  const sentence = `${'First sentence. '.repeat(300)}`.trim();
  const parts = TG.splitMessage(sentence);
  assert.ok(parts.length >= 2 && parts.every((p) => p.length <= 4000 && p.endsWith('.')), 'each part ends at a sentence');
  assert.equal(parts.join(' ').replace(/\s+/g, ' '), sentence.replace(/\s+/g, ' '), 'nothing lost');
  const words = 'word '.repeat(2000).trim();
  assert.ok(TG.splitMessage(words).every((p) => p.length <= 4000 && !/^\s|\s$/.test(p) && /^(word ?)+$/.test(p)), 'cut between words');
  const solid = 'x'.repeat(9000);
  assert.deepEqual(TG.splitMessage(solid).map((p) => p.length), [4000, 4000, 1000]);
  assert.deepEqual(TG.splitMessage('abc def', 4), ['abc', 'def']);
});

test('scrub and sameSecret: the token never survives into a message; secrets compare whole', () => {
  assert.equal(TG.scrub(`Telegram getMe: fetch failed https://api.telegram.org/bot${TOKEN}/getMe`, TOKEN), 'Telegram getMe: fetch failed https://api.telegram.org/bot…/getMe');
  assert.equal(TG.scrub('plain', ''), 'plain');
  assert.ok(TG.sameSecret('abc', 'abc') && !TG.sameSecret('abc', 'abd') && !TG.sameSecret('abc', 'ab') && !TG.sameSecret('', 'a'));
  assert.match(TG.pairingCode(), /^\d{6}$/);
  assert.deepEqual(TG.pictureLinks(`see ${ORIGIN}/i/abcdefghijklmnop and ${ORIGIN}/i/abcdefghijklmnop and https://other.example/i/abcdefghijklmnop and ${ORIGIN}/i/short`, ORIGIN), [`${ORIGIN}/i/abcdefghijklmnop`]);
  assert.deepEqual(TG.pictureLinks('x', ''), []);
});

test('the webhook refuses everything before the bot is connected, and a wrong or missing secret after', async () => {
  assert.equal((await hook(msg(OWNER_CHAT, { text: 'hi' }), 'anything')).status, 403);
  assert.equal(tg.calls.length, 0, 'nothing was sent');
  const st = await status();
  assert.deepEqual(st, { linked: false, bot: null, paired: false, name: null, token: false });
});

test('saving the token connects the bot: getMe, setWebhook with a fresh secret at /api/telegram/hook, a pairing code the System tab and LINKS tab show — never the token', async () => {
  const r = await call('/api/keys', { method: 'POST', body: JSON.stringify({ name: 'telegram', value: TOKEN }) });
  assert.equal(r.status, 200, await r.clone().text());
  const j = await r.json();
  await settle();
  assert.equal(j.works, true, j.info);
  const code = j.info.match(/^Connected to @GhostyTestBot\. Open it in Telegram, tap START, then send it this code: (\d{6})\. It lasts about 15 minutes\.$/)?.[1];
  assert.ok(code, j.info);
  assert.equal(j.info, TG.codeInfo('GhostyTestBot', code, 15 * 60_000), 'the code\'s message is the words file\'s: the three taps in order, then the code');
  assert.deepEqual(tg.calls.map((c) => c.method), ['getMe', 'setWebhook']);
  assert.ok(tg.calls.every((c) => c.token === TOKEN));
  const wh = tg.calls[1].body;
  assert.equal(wh.url, `${ORIGIN}/api/telegram/hook`);
  assert.match(wh.secret_token, /^[A-Za-z0-9_-]{32}$/);
  assert.deepEqual(wh.allowed_updates, ['message', 'callback_query']);
  assert.equal(wh.drop_pending_updates, true);
  secret = wh.secret_token;
  const st = await status();
  assert.equal(st.linked, true);
  assert.equal(st.bot, 'GhostyTestBot');
  assert.equal(st.paired, false);
  assert.equal(st.code, code);
  assert.ok(st.codeUntil > Date.now() + 14 * 60_000 && st.codeUntil <= Date.now() + 15 * 60_000);
  assert.equal(st.token, true);
  assert.ok(!JSON.stringify(st).includes(TOKEN) && !JSON.stringify(st).includes(secret), 'neither the token nor the secret is sent to the interface');
  const link = kv.m.get('telegram:link');
  assert.ok(link && !link.includes(TOKEN), 'the record is mirrored in KV, without the token');
  assert.ok(!JSON.stringify([...state.storage.m.entries()]).includes(TOKEN), 'the token is only in the vault, encrypted');
  // the System tab's status says the key is set
  const keys = (await (await call('/api/status')).json()).keys;
  assert.equal(keys.find((k) => k.name === 'telegram').set, true);
  assert.equal(keys.find((k) => k.name === 'telegram').need, 'recommended');
  tg.calls.length = 0;
});

test('a stranger is turned away once, then ignored for an hour; the pairing code pairs the owner; a wrong code does not', async () => {
  const st = await status();
  assert.equal((await hook(msg(STRANGER, { text: 'hello?' }, { id: STRANGER, first_name: 'Eve' }), secret)).status, 200);
  assert.deepEqual(texts(), [TG.STRANGER]);
  assert.match(TG.STRANGER, /^[^.!?]+[.]$/, "the stranger's line is one sentence");
  assert.ok(!/bot|owner's chat/i.test(TG.STRANGER.replace(/my owner/, '')) && /^I /.test(TG.STRANGER), "and in his voice (I), nothing about who or why");
  assert.equal(sent()[0].body.chat_id, STRANGER);
  await hook(msg(STRANGER, { text: 'let me in' }, { id: STRANGER, first_name: 'Eve' }), secret);
  await hook(msg(STRANGER, { text: '000000' }, { id: STRANGER, first_name: 'Eve' }), secret);
  await hook(msg(STRANGER, { photo: [{ file_id: 'evil', width: 10, height: 10 }] }, { id: STRANGER, first_name: 'Eve' }), secret);
  assert.equal(texts().length, 1, 'no second refusal within the hour');
  assert.equal(sent('getFile').length, 0, 'nothing of a stranger is ever downloaded');
  assert.equal((await (await call('/api/history')).json()).turns.length, 0, 'no turn was run');
  // the owner, with a space in the code as phones type it
  const code = st.code;
  await hook(msg(OWNER_CHAT, { text: `${code.slice(0, 3)} ${code.slice(3)}` }), secret);
  assert.equal(texts().at(-1), TG.PAIRED);
  assert.match(TG.PAIRED, /message, a voice note or a photo/, 'the greeting says what he can send');
  assert.equal((TG.PAIRED.match(/[.!?](?=\s|$)/g) ?? []).length, 2, 'Paired. plus one sentence');
  assert.equal(sent().at(-1).body.chat_id, OWNER_CHAT);
  const paired = await status();
  assert.equal(paired.paired, true);
  assert.equal(paired.name, 'Sam');
  assert.equal(paired.code, undefined, 'the code is spent');
  assert.equal(JSON.parse(kv.m.get('telegram:link')).chatId, OWNER_CHAT);
  // a wrong secret still gets nowhere, even from the paired chat
  assert.equal((await hook(msg(OWNER_CHAT, { text: 'hi' }), 'wrong-secret-wrong-secret')).status, 403);
  assert.equal((await hook(msg(OWNER_CHAT, { text: 'hi' }), '')).status, 403);
  tg.calls.length = 0;
});

test('a text from the paired chat runs a normal turn: the reply comes back as a message, typing shows meanwhile, the history has both sides', async () => {
  const r = await hook(msg(OWNER_CHAT, { text: 'remember I like tea' }), secret);
  assert.equal(r.status, 200);
  assert.equal(await r.text(), 'ok');
  assert.ok(sent('sendChatAction').some((c) => c.body.action === 'typing' && c.body.chat_id === OWNER_CHAT), 'typing…');
  assert.equal(texts().length, 1);
  assert.match(texts()[0], /^Got it — I’ll remember that you like tea\.$/);
  const turns = (await (await call('/api/history')).json()).turns;
  assert.deepEqual(turns.slice(-2).map((t) => [t.role, t.text]), [['user', 'remember I like tea'], ['assistant', texts()[0]]]);
  assert.equal((await (await call('/api/memory')).json()).facts[0].text, 'I like tea');
  // the model is told it is on Telegram (no screen) through the context, like the interface's tab
  const owner = await state.storage.get('owner:ctx');
  assert.ok(owner === undefined || owner.tab !== 'telegram', 'the Telegram context is for the model only, never remembered as the owner\'s screen');
  tg.calls.length = 0;
});

test('"why?" on Telegram (OWNER-ISSUES 67d): the last turn’s trail in plain words, with no model and no turn of its own; a bare "why?" after a reply that ran nothing is for the model', async () => {
  await hook(msg(OWNER_CHAT, { text: 'remember my bike is blue' }), secret);
  const before = (await (await call('/api/history')).json()).turns.length;
  tg.calls.length = 0;
  await hook(msg(OWNER_CHAT, { text: 'why?' }), secret);
  assert.equal(texts().length, 1);
  assert.match(texts()[0], /^Why I did that:\nYou asked: “remember my bike is blue”\n1\. Remembered — text: my bike is blue: it worked\.\n {3}Why: you asked about “remember”, and I can remember lasting facts you tell me, list them, drop one\.$/);
  assert.equal((await (await call('/api/history')).json()).turns.length, before, 'asking why is not a turn: the history is as it was');
  // a reply that ran nothing: "why did you do that?" is answered from the trail, a bare "why?" goes to the model
  await hook(msg(OWNER_CHAT, { text: 'hello' }), secret);
  tg.calls.length = 0;
  await hook(msg(OWNER_CHAT, { text: 'why did you do that?' }), secret);
  assert.match(texts()[0], /^Why I did that:\nYou asked: “hello”\nI didn’t run anything for that one: I answered from what I know\.$/);
  tg.calls.length = 0;
  await hook(msg(OWNER_CHAT, { text: 'why?' }), secret);
  assert.ok(texts().length >= 1 && !/^Why I did that/.test(texts()[0]), `the model answered it: ${texts()[0]}`);
  tg.calls.length = 0;
  // "what did you do today?" (OWNER-ISSUES 68c): the day's doings from what the brain keeps, newest first, no model, no turn
  const turns = (await (await call('/api/history')).json()).turns.length;
  await hook(msg(OWNER_CHAT, { text: 'what did you do today?' }), secret);
  assert.equal(texts().length, 1);
  assert.match(texts()[0], /^Today, newest first \(\d+ things?\):\n• \d\d:\d\d — /);
  assert.match(texts()[0], /— Remembered \(text: my bike is blue\)/);
  assert.equal((await (await call('/api/history')).json()).turns.length, turns, 'asking is not a turn');
  tg.calls.length = 0;
  // FORESIGHT (foresight.ts): "how often are you right?" from the ledger, and "you were right" on his open question — no
  // model, no turn
  const now = Date.now();
  state.storage.m.set('foresight:ledger', { items: [{ id: 'q', at: now - 3600_000, kind: 'answer', subject: 'will it rain on Saturday?', expect: 'rain on Saturday', confidence: 0.6, by: now + 86_400_000 }, { id: 'd', at: now - 86_400_000, kind: 'departure', subject: 'the 08:12 train from Birmingham New Street', expect: 'late by 3 min or more', confidence: 0.7, by: now - 80_000_000, outcome: { at: now - 80_000_000, actual: '6 minutes late', right: true, how: 'feed', value: 360 } }], samples: { dep: {}, com: {} }, made: { day: '' }, firstTrue: now - 80_000_000 });
  await hook(msg(OWNER_CHAT, { text: 'how often are you right?' }), secret);
  assert.deepEqual(texts(), ["I've only scored 1 so far about trains."]);
  tg.calls.length = 0;
  await hook(msg(OWNER_CHAT, { text: 'you were right' }), secret);
  assert.deepEqual(texts(), ['Noted: right.']);
  assert.equal(state.storage.m.get('foresight:ledger').items[0].outcome.how, 'owner');
  assert.equal((await (await call('/api/history')).json()).turns.length, turns, 'neither is a turn');
  tg.calls.length = 0;
});

test('a long reply is sent in pieces under the limit, in order', async () => {
  const long = `${'The forecast says rain in the afternoon. '.repeat(220)}`.trim();
  await TG.tgSend(TOKEN, OWNER_CHAT, long);
  const parts = texts();
  assert.ok(parts.length >= 3, `${parts.length} messages`);
  assert.ok(parts.every((p) => p.length <= 4000 && p.endsWith('.')));
  assert.equal(parts.join(' '), long);
  assert.ok(sent().every((c) => !('parse_mode' in c.body)), 'plain text');
  tg.calls.length = 0;
});

test('a 429 is retried once after the wait Telegram names; a picture link in a reply goes as a photo', async () => {
  let first = true;
  tg.answers.sendMessage = (body, k) => {
    if (first) {
      first = false;
      return new Response(JSON.stringify({ ok: false, error_code: 429, description: 'Too Many Requests: retry after 1', parameters: { retry_after: 0.05 } }), { status: 429 });
    }
    return new Response(JSON.stringify({ ok: true, result: { message_id: k } }));
  };
  await TG.tgSend(TOKEN, OWNER_CHAT, 'again');
  assert.equal(sent().length, 2, 'sent twice: the refusal, then the retry');
  delete tg.answers.sendMessage;
  tg.calls.length = 0;
  await TG.tgReply(TOKEN, OWNER_CHAT, `Here it is: ${ORIGIN}/i/abcdefghijklmnop`, ORIGIN);
  assert.deepEqual(tg.calls.map((c) => c.method), ['sendPhoto']);
  assert.deepEqual(tg.calls[0].body, { chat_id: OWNER_CHAT, photo: `${ORIGIN}/i/abcdefghijklmnop`, caption: `Here it is: ${ORIGIN}/i/abcdefghijklmnop` });
  tg.calls.length = 0;
  await TG.tgReply(TOKEN, OWNER_CHAT, `${'A long description. '.repeat(60)}${ORIGIN}/i/abcdefghijklmnop`, ORIGIN);
  assert.deepEqual(tg.calls.map((c) => c.method), ['sendMessage', 'sendPhoto'], 'too long for a caption: the text first, then the photo');
  assert.ok(!('caption' in tg.calls[1].body));
  // Telegram cannot fetch the picture: the words still arrive
  tg.calls.length = 0;
  tg.answers.sendPhoto = () => new Response(JSON.stringify({ ok: false, error_code: 400, description: 'Bad Request: wrong file identifier/HTTP URL specified' }), { status: 400 });
  await TG.tgReply(TOKEN, OWNER_CHAT, `Look: ${ORIGIN}/i/abcdefghijklmnop`, ORIGIN);
  assert.deepEqual(tg.calls.map((c) => c.method), ['sendPhoto', 'sendMessage']);
  delete tg.answers.sendPhoto;
  tg.calls.length = 0;
});

test('a photo from the paired chat reaches the model as a picture (the largest size within 1.5 MB), with its caption as the question', async () => {
  tg.files.small = jpeg(200);
  tg.files.big = jpeg(1200);
  await hook(msg(OWNER_CHAT, { caption: 'What is this?', photo: [{ file_id: 'small', width: 90, height: 60, file_size: 200 }, { file_id: 'big', width: 1280, height: 960, file_size: 1200 }, { file_id: 'huge', width: 4000, height: 3000, file_size: 2_000_000 }] }), secret);
  assert.deepEqual(sent('getFile').map((c) => c.body.file_id), ['big'], 'the largest size that is not over the limit');
  assert.equal(sent('download').length, 1);
  assert.deepEqual(texts(), ['I can see a picture. What is this?']);
  assert.equal((await (await call('/api/history')).json()).turns.at(-2).text, 'What is this? [photo]');
  assert.ok(!JSON.stringify([...state.storage.m.entries()]).includes('base64'), 'the picture is never stored');
  tg.calls.length = 0;
  // no caption: a question is supplied; a photo that cannot be fetched is reported, not run
  await hook(msg(OWNER_CHAT, { photo: [{ file_id: 'big', width: 10, height: 10 }] }), secret);
  assert.deepEqual(texts(), ['I can see a picture. What is in this picture?']);
  tg.calls.length = 0;
  await hook(msg(OWNER_CHAT, { caption: 'and this?', photo: [{ file_id: 'missing', width: 10, height: 10 }] }), secret);
  assert.deepEqual(texts(), [TG.photoFail('could not download it (404)')]);
  assert.ok(!/404|download|could not/.test(texts()[0]) && /send it again/.test(texts()[0]), 'his words and what to do, never the raw error');
  tg.calls.length = 0;
});

test('a voice note is transcribed (Workers AI here) and answered, the reply starting with what was heard; with no recogniser it says what is needed', async () => {
  tg.files.note1 = new Uint8Array(5000).fill(7);
  const asked = [];
  env.AI = { async run(model, inputs) { asked.push({ model, bytes: typeof inputs.audio === 'string' ? Buffer.from(inputs.audio, 'base64').length : inputs.audio.length }); return { text: 'remember I like coffee' }; } };
  try {
    await hook(msg(OWNER_CHAT, { voice: { file_id: 'note1', mime_type: 'audio/ogg', duration: 3, file_size: 5000 } }), secret);
    assert.deepEqual(asked, [{ model: '@cf/openai/whisper-large-v3-turbo', bytes: 5000 }]);
    assert.equal(texts().length, 1);
    assert.match(texts()[0], /^🎤 remember I like coffee\n\nGot it — I’ll remember that you like coffee\.$/);
    assert.equal((await (await call('/api/history')).json()).turns.at(-2).text, 'remember I like coffee');
    tg.calls.length = 0;
    // silence
    env.AI = { async run() { return { text: '' }; } };
    await hook(msg(OWNER_CHAT, { audio: { file_id: 'note1', mime_type: 'audio/mpeg' } }), secret);
    assert.deepEqual(texts(), [TG.HEARD.silent]);
    tg.calls.length = 0;
  } finally {
    delete env.AI;
  }
  await hook(msg(OWNER_CHAT, { voice: { file_id: 'note1', mime_type: 'audio/ogg' } }), secret);
  assert.deepEqual(texts(), [TG.HEARD.noEars]);
  tg.calls.length = 0;
  // too big for a voice note: refused before any download
  await hook(msg(OWNER_CHAT, { voice: { file_id: 'note1', mime_type: 'audio/ogg', file_size: 9_000_000 } }), secret);
  assert.equal(sent('download').length, 0);
  assert.deepEqual(texts(), [TG.HEARD.tooBig(8)]);
  tg.calls.length = 0;
});

test('an approval becomes APPROVE / NOT NOW buttons; the callback answers it exactly as POST /approve does', async () => {
  await call('/api/memory', { method: 'POST', body: JSON.stringify({ text: 'a fact to erase' }) });
  await hook(msg(OWNER_CHAT, { text: 'forget everything' }), secret);
  const ask = sent().find((c) => c.body.reply_markup);
  assert.ok(ask, 'the question was sent');
  assert.equal(ask.body.text, TG.approvalCard('Allow forget everything?'));
  assert.match(ask.body.text, /^If you approve, I'll do exactly this: “forget everything”\. APPROVE does it now; NOT NOW leaves it undone\.$/, 'the thing quoted, what APPROVE does, what NOT NOW does, in one line');
  assert.ok(!/\n/.test(ask.body.text));
  const [approve, decline] = ask.body.reply_markup.inline_keyboard[0];
  assert.equal(approve.text, 'APPROVE');
  assert.equal(decline.text, 'NOT NOW');
  // signed and expiring: what it does, until when, Ghosty's signature — and under Telegram's 64 bytes
  const id = approve.callback_data.match(/^a:([\w-]+):1:[0-9a-z]+:[\w-]{22}$/)?.[1];
  assert.ok(id, approve.callback_data);
  assert.match(decline.callback_data, new RegExp(`^a:${id}:0:[0-9a-z]+:[\\w-]{22}$`));
  assert.ok(approve.callback_data.length <= 64 && decline.callback_data.length <= 64);
  assert.ok(!approve.callback_data.includes(TOKEN.split(':')[1].slice(0, 8)), 'nothing of the token in the button');
  const waiting = (await (await call('/api/history')).json()).pending;
  assert.equal(waiting?.id, id, 'the same approval the interface would show');
  tg.calls.length = 0;
  // a stranger's callback does nothing (answered so the button stops spinning, never acted on)
  await hook({ update_id: ++n, callback_query: { id: 'cb0', from: { id: STRANGER }, message: { message_id: 1, chat: { id: STRANGER } }, data: approve.callback_data } }, secret);
  assert.deepEqual(tg.calls.map((c) => c.method), ['answerCallbackQuery']);
  assert.ok((await (await call('/api/history')).json()).pending, 'still waiting');
  tg.calls.length = 0;
  // a button sent before buttons were signed ("ap:<id>:1"), pressed by the owner: treated as expired —
  // its buttons come off and the owner is told to answer in the app; never acted on
  await hook({ update_id: ++n, callback_query: { id: 'cbx', from: { id: OWNER_CHAT }, message: { message_id: 1, chat: { id: OWNER_CHAT } }, data: `ap:${id}:1` } }, secret);
  assert.deepEqual(tg.calls.map((c) => c.method), ['answerCallbackQuery', 'editMessageReplyMarkup', 'sendMessage']);
  assert.equal(tg.calls[0].body.text, 'That button has expired');
  assert.deepEqual(texts(), ['That button is from before an update and no longer works. Answer it in the app.']);
  assert.ok((await (await call('/api/history')).json()).pending, 'still waiting');
  tg.calls.length = 0;
  // the owner presses APPROVE
  await hook({ update_id: ++n, callback_query: { id: 'cb1', from: { id: OWNER_CHAT, first_name: 'Sam' }, message: { message_id: ask.body.message_id ?? 1, chat: { id: OWNER_CHAT } }, data: approve.callback_data } }, secret);
  const methods = tg.calls.map((c) => c.method);
  assert.equal(methods[0], 'answerCallbackQuery');
  assert.equal(tg.calls[0].body.text, 'Approved');
  assert.ok(methods.includes('editMessageReplyMarkup'), 'the buttons come off');
  assert.match(texts().at(-1), /Erased \d+ fact/);
  assert.equal((await (await call('/api/history')).json()).pending, null);
  assert.deepEqual((await (await call('/api/memory')).json()).facts, []);
  // the app's approval card learns the answer
  assert.deepEqual(Object.keys(await (await call(`/api/telegram/answer/${id}`)).json()).sort(), ['allow', 'answered', 'at']);
  assert.equal((await (await call(`/api/telegram/answer/${id}`)).json()).allow, true);
  tg.calls.length = 0;
  // pressing it again: nothing is waiting any more
  await hook({ update_id: ++n, callback_query: { id: 'cb2', from: { id: OWNER_CHAT }, message: { message_id: 1, chat: { id: OWNER_CHAT } }, data: approve.callback_data } }, secret);
  assert.deepEqual(texts(), ['Already answered (here or in the app), or I have moved on since.']);
  tg.calls.length = 0;
});

test('/start, /status, /stop and /unpair; a notification reaches the chat; TEST, NEW CODE and UNPAIR from the LINKS tab', async () => {
  await hook(msg(OWNER_CHAT, { text: '/start' }), secret);
  assert.match(texts()[0], /^I'm Ghosty, your own AI/);
  assert.match(texts()[0], /\/unpair/);
  tg.calls.length = 0;
  await hook(msg(OWNER_CHAT, { text: '/status@GhostyTestBot' }), secret);
  assert.match(texts()[0], /^\d+ of \d+ models ready · \d+ keys set$/);
  assert.ok(!texts()[0].includes(TOKEN));
  tg.calls.length = 0;
  await hook(msg(OWNER_CHAT, { text: '/stop' }), secret);
  assert.deepEqual(texts(), ['Stopped.']);
  tg.calls.length = 0;
  // a stop by intent, not the command (OWNER-ISSUES 70a): it stops him, and it is never answered — not even "Stopped."
  for (const t of ['shut the fuck up', 'enough mate', 'leave it', 'Ghosty stop']) {
    await hook(msg(OWNER_CHAT, { text: t }), secret);
    await settle();
    assert.deepEqual(texts(), [], `"${t}" is never answered`);
  }
  // "stop the timer" is a request, not a stop: it is answered
  await hook(msg(OWNER_CHAT, { text: 'stop the timer' }), secret);
  await settle();
  assert.ok(texts().some((t) => /stop the timer/.test(t)), texts().join(' | '));
  tg.calls.length = 0;
  // a reminder run now: the inbox item goes to Telegram too
  const job = (await (await call('/api/jobs', { method: 'POST', body: JSON.stringify({ kind: 'reminder', text: 'Call the dentist', at: Date.now() + 3600_000, repeat: 'none', tz: 'UTC' }) })).json()).job;
  await call(`/api/jobs/${job.id}/run`, { method: 'POST' });
  await settle();
  assert.equal(texts().length, 1);
  assert.match(texts()[0], /^Reminder: Call the dentist\nIt was due at \d\d:\d\d( UTC)?\.$/);
  tg.calls.length = 0;
  // REMINDERS switched off (LINKS → NOTIFICATIONS): Telegram does not get it either
  await call('/api/push/prefs', { method: 'POST', body: JSON.stringify({ reminders: false }) });
  const quiet = (await (await call('/api/jobs', { method: 'POST', body: JSON.stringify({ kind: 'reminder', text: 'Quiet one', at: Date.now() + 3600_000, repeat: 'none', tz: 'UTC' }) })).json()).job;
  await call(`/api/jobs/${quiet.id}/run`, { method: 'POST' });
  await settle();
  assert.deepEqual(texts(), [], 'a switched-off kind does not go to Telegram');
  await call('/api/push/prefs', { method: 'POST', body: JSON.stringify({ reminders: true }) });
  // TEST from the LINKS tab
  assert.deepEqual(await (await call('/api/telegram/test', { method: 'POST' })).json(), { sent: true });
  assert.deepEqual(texts(), ['Ghosty here. I can reach you on Telegram now.']);
  tg.calls.length = 0;
  // NEW CODE while paired: refused (a code the owner cannot see would only let a stranger take the chat over)
  const fresh = await call('/api/telegram/code', { method: 'POST' });
  assert.equal(fresh.status, 400, 'no code while paired');
  assert.equal((await status()).paired, true);
  // UNPAIR from the tab: a new code, no chat; the old chat is a stranger again
  const un = await (await call('/api/telegram/unpair', { method: 'POST' })).json();
  assert.equal(un.paired, false);
  assert.match(un.code, /^\d{6}$/);
  await hook(msg(OWNER_CHAT, { text: 'hello' }), secret);
  assert.deepEqual(texts(), [TG.STRANGER]);
  tg.calls.length = 0;
  // pair again with the new code, then /unpair from Telegram
  await hook(msg(OWNER_CHAT, { text: un.code }), secret);
  assert.equal((await status()).paired, true);
  await hook(msg(OWNER_CHAT, { text: '/unpair' }), secret);
  assert.equal(texts().at(-1), TG.UNPAIRED);
  assert.match(TG.UNPAIRED, /stopped answering this chat.*send nothing more here/, 'says what stops');
  assert.equal((await status()).paired, false);
  assert.equal((await call('/api/telegram/test', { method: 'POST' })).status, 400);
  tg.calls.length = 0;
});

test('the token never appears in an error: a dead connection while connecting is reported without it; a bad token is refused before any call', async () => {
  tg.fail = true;
  const r = await (await call('/api/keys', { method: 'POST', body: JSON.stringify({ name: 'telegram', value: TOKEN }) })).json();
  tg.fail = null;
  assert.equal(r.works, false);
  assert.equal(r.info, TG.KEY_NOT_CONNECTED);
  assert.ok(!r.info.includes(TOKEN) && !/fetch|api\.telegram|getMe/.test(r.info), 'not even a scrubbed address: his words and what to do');
  tg.calls.length = 0;
  const bad = await (await call('/api/keys', { method: 'POST', body: JSON.stringify({ name: 'telegram', value: 'not-a-token' }) })).json();
  assert.equal(bad.works, false);
  assert.equal(bad.info, TG.KEY_BAD);
  assert.equal(tg.calls.length, 0);
  // removing the key takes the webhook down (with the token that was saved) and forgets the link
  tg.calls.length = 0;
  const gone = await (await call('/api/keys', { method: 'POST', body: JSON.stringify({ name: 'telegram', value: '' }) })).json();
  await settle();
  assert.equal(gone.info, TG.KEY_REMOVED);
  assert.deepEqual(tg.calls.map((c) => [c.method, c.token]), [['deleteWebhook', 'not-a-token']]);
  assert.equal((await status()).linked, false);
  assert.equal((await status()).token, false);
  assert.equal(kv.m.has('telegram:link'), false);
  assert.equal((await hook(msg(OWNER_CHAT, { text: 'hi' }), secret)).status, 403, 'the old secret is dead');
  // connected again: the same bot gets a new secret and keeps nothing of the old link
  tg.calls.length = 0;
  const again = await (await call('/api/keys', { method: 'POST', body: JSON.stringify({ name: 'telegram', value: TOKEN }) })).json();
  assert.equal(again.works, true);
  assert.notEqual(tg.calls[1].body.secret_token, secret);
  assert.equal((await status()).paired, false);
});

test('the paused database: the link lives on in KV, so the webhook still answers and a message still gets a reply', async () => {
  const link = JSON.parse(kv.m.get('telegram:link'));
  const code = link.code;
  // KV (readable by previews of unreviewed changes) holds only a hash of the secret; the secret itself went to Telegram alone.
  assert.ok(!('secret' in link) && /^[0-9a-f]{64}$/.test(link.secretHash), 'KV holds a hash of the webhook secret, never the secret');
  const live = tg.calls.find((c) => c.method === 'setWebhook').body.secret_token;
  await hook(msg(OWNER_CHAT, { text: code }), live);
  assert.equal((await status()).paired, true);
  tg.calls.length = 0;
  const realGet = state.storage.get.bind(state.storage);
  const quota = () => { throw new Error('Exceeded allowed rows read in Durable Objects free tier.'); };
  state.storage.get = async () => quota();
  state.storage.put = async () => quota();
  state.storage.delete = async () => quota();
  try {
    const r = await hook(msg(OWNER_CHAT, { text: 'say hello' }), live);
    assert.equal(r.status, 200);
    const reply = texts();
    assert.ok(reply.length >= 1, 'answered while paused');
    assert.ok(!reply.some((t) => /Exceeded allowed rows/.test(t)), `no raw database error: ${reply.join(' | ')}`);
    assert.ok(reply.some((t) => /^Mock reply to: say hello/.test(t)), reply.join(' | '));
  } finally {
    state.storage.get = realGet;
    delete state.storage.put;
    delete state.storage.delete;
  }
  // the fake Telegram stays installed for the tests below; the last one puts the real fetch back
});

test('GET /api/status says whether the brain can hear and speak: nothing without Workers AI or a Groq key, both with Workers AI', async () => {
  const before = (await (await call('/api/status')).json()).speech;
  assert.deepEqual(before, { stt: false, tts: false });
  env.AI = { async run() { return {}; } };
  try {
    const withAi = (await (await call('/api/status')).json()).speech;
    assert.deepEqual(withAi, { stt: true, tts: true });
  } finally {
    delete env.AI;
  }
});

test('five wrong pairing codes lock a chat out until a new code: the right guess no longer pairs it, while the owner still can', async () => {
  // Connected afresh, so the webhook secret in play is known (the module-level one is from the first connect).
  tg.calls.length = 0;
  assert.equal((await (await call('/api/keys', { method: 'POST', body: JSON.stringify({ name: 'telegram', value: TOKEN }) })).json()).works, true);
  const live = tg.calls.find((c) => c.method === 'setWebhook').body.secret_token;
  const un = await (await call('/api/telegram/unpair', { method: 'POST' })).json();
  assert.match(un.code, /^\d{6}$/);
  const BRUTE = 888000111;
  for (const wrong of ['000001', '000002', '000003', '000004', '000005']) assert.equal((await hook(msg(BRUTE, { text: wrong }, { id: BRUTE, first_name: 'Mallory' }), live)).status, 200);
  tg.calls.length = 0;
  await hook(msg(BRUTE, { text: un.code }, { id: BRUTE, first_name: 'Mallory' }), live);
  assert.equal((await status()).paired, false, 'the right code after five wrong ones does not pair');
  assert.equal(texts().length, 0, 'and the chat gets no answer at all');
  // the owner's own chat is not locked out
  await hook(msg(OWNER_CHAT, { text: un.code }), live);
  assert.equal((await status()).paired, true);
  assert.equal(JSON.parse(kv.m.get('telegram:link')).chatId, OWNER_CHAT);
  secret = live; // for the tests below
  tg.calls.length = 0;
});

// ---- signed buttons, voice back, pictures as files, approvals from the app, upgrade ideas ----

test('signButton / readButton: a press reads back; a changed field, another key or an old button is refused', async () => {
  const now = Date.UTC(2026, 9, 18, 12);
  const data = await TG.signButton(TOKEN, { kind: 'a', id: 'abc123def456', yes: true }, now);
  assert.ok(data.length <= 64, `${data.length} bytes`);
  assert.deepEqual(await TG.readButton(TOKEN, data, now + 60_000), { kind: 'a', id: 'abc123def456', yes: true });
  const [k, id, yes, exp, sig] = data.split(':');
  assert.deepEqual(await TG.readButton(TOKEN, [k, id, '0', exp, sig].join(':'), now), { refused: 'forged' }, 'APPROVE turned into NOT NOW');
  assert.deepEqual(await TG.readButton(TOKEN, [k, 'zzz', yes, exp, sig].join(':'), now), { refused: 'forged' }, 'another approval');
  assert.deepEqual(await TG.readButton(TOKEN, [k, id, yes, (parseInt(exp, 36) + 99999).toString(36), sig].join(':'), now), { refused: 'forged' }, 'a later expiry');
  assert.deepEqual(await TG.readButton('987654321:AAAnotherBotTokenEntirely_xyzXYZ12345', data, now), { refused: 'forged' }, 'signed by another bot');
  assert.deepEqual(await TG.readButton(TOKEN, data, now + TG.BUTTON_TTL_MS + 1000), { refused: 'expired' });
  assert.deepEqual(await TG.readButton(TOKEN, 'ap:abc123def456:1', now), { refused: 'forged' });
  assert.deepEqual(await TG.readButton(TOKEN, '', now), { refused: 'forged' });
});

test('the reason an app approval carries to Telegram is made from the waiting call itself; audio is recognised by its bytes', () => {
  assert.equal(TG.pendingReason({ name: 'publish_site', arguments: JSON.stringify({ name: 'bakery', html: 'x'.repeat(500), public: true }) }), 'Allow publish site? name: bakery · public: true');
  assert.equal(TG.pendingReason({ name: 'forget_all', arguments: 'not json' }), 'Allow forget all?');
  assert.deepEqual(TG.audioKind(new Uint8Array([0x49, 0x44, 0x33, 4]).buffer), { mime: 'audio/mpeg', ext: 'mp3' });
  assert.deepEqual(TG.audioKind(new Uint8Array([0xff, 0xfb, 0x90, 0]).buffer), { mime: 'audio/mpeg', ext: 'mp3' });
  assert.deepEqual(TG.audioKind(new Uint8Array([0x4f, 0x67, 0x67, 0x53]).buffer), { mime: 'audio/ogg', ext: 'ogg' });
  assert.equal(TG.audioKind(new Uint8Array([1, 2, 3, 4]).buffer), null);
  const long = 'One sentence here. '.repeat(60);
  const part = TG.spokenPart(long);
  assert.ok(part.length <= 600 && part.endsWith('.'), part.slice(-20));
  assert.equal(TG.spokenPart('See https://x.example/page **now**'), 'See link now');
});

/** Workers AI, faked: Whisper hears `heard`; MeloTTS answers an MP3 (ID3 tag first, as it does). */
const MP3 = new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 0, 0xff, 0xfb, 0x90, 0x64, ...new Array(200).fill(1)]);
const fakeAi = (heard, spoken = []) => ({
  async run(model, inputs) {
    if (/whisper/.test(model)) return { text: heard };
    if (/melotts/.test(model)) {
      spoken.push(inputs.prompt);
      return { audio: Buffer.from(MP3).toString('base64') };
    }
    throw new Error(`unexpected model ${model}`);
  },
});

test('a voice note is answered in text AND as a voice note (MeloTTS MP3 by sendVoice), in the spoken style; a typed one is not', async () => {
  tg.files.note2 = new Uint8Array(5000).fill(9);
  const spoken = [];
  env.AI = fakeAi('how will you answer?', spoken);
  try {
    tg.calls.length = 0;
    await hook(msg(OWNER_CHAT, { voice: { file_id: 'note2', mime_type: 'audio/ogg', duration: 2, file_size: 5000 } }), secret);
    assert.deepEqual(texts(), ['🎤 how will you answer?\n\nOut loud, briefly.'], 'the prompt had the spoken style');
    const voice = sent('sendVoice');
    assert.equal(voice.length, 1, 'one voice note back');
    assert.equal(voice[0].body.chat_id, String(OWNER_CHAT));
    assert.deepEqual(voice[0].body.voice, { file: 'ghosty.mp3', type: 'audio/mpeg', size: MP3.length });
    assert.deepEqual(spoken, ['Out loud, briefly.'], 'the reply is spoken, not the echo of what was heard');
    const order = tg.calls.map((c) => c.method).filter((m) => m === 'sendMessage' || m === 'sendVoice');
    assert.deepEqual(order, ['sendMessage', 'sendVoice'], 'the text first, the voice after');
    assert.ok(!JSON.stringify(tg.calls.map((c) => c.body)).includes(TOKEN), 'the token is in no body');
    // a chat that refuses voice messages gets the same file as audio
    tg.calls.length = 0;
    tg.answers.sendVoice = () => new Response(JSON.stringify({ ok: false, error_code: 400, description: 'Bad Request: VOICE_MESSAGES_FORBIDDEN' }), { status: 400 });
    await hook(msg(OWNER_CHAT, { voice: { file_id: 'note2', mime_type: 'audio/ogg', file_size: 5000 } }), secret);
    assert.equal(sent('sendAudio').length, 1);
    assert.deepEqual(sent('sendAudio')[0].body.audio, { file: 'ghosty.mp3', type: 'audio/mpeg', size: MP3.length });
    assert.equal(sent('sendAudio')[0].body.title, 'Ghosty');
    delete tg.answers.sendVoice;
    // typed: written style, no voice note
    tg.calls.length = 0;
    await hook(msg(OWNER_CHAT, { text: 'how will you answer?' }), secret);
    assert.deepEqual(texts(), ['In writing.']);
    assert.equal(sent('sendVoice').length + sent('sendAudio').length, 0);
  } finally {
    delete env.AI;
  }
  // no voice to speak with (no Workers AI): the text alone, nothing broken
  tg.calls.length = 0;
  // (a reply never spoken before: a sentence already spoken would come from the voice's memory)
  env.AI = { async run(model) { if (/whisper/.test(model)) return { text: 'say something chatty' }; throw new Error('no voice today'); } };
  try {
    await hook(msg(OWNER_CHAT, { voice: { file_id: 'note2', mime_type: 'audio/ogg', file_size: 5000 } }), secret);
    assert.deepEqual(texts(), ['🎤 say something chatty\n\nThe kettle is on.']);
    assert.equal(sent('sendVoice').length + sent('sendAudio').length, 0);
  } finally {
    delete env.AI;
  }
  tg.calls.length = 0;
});

test("a model's chatbot slip is polished on Telegram as in the app (the router's post-filter)", async () => {
  tg.calls.length = 0;
  await hook(msg(OWNER_CHAT, { text: 'say something chatty' }), secret);
  assert.deepEqual(texts(), ['The kettle is on.']);
  tg.calls.length = 0;
});

test('a picture sent as a file goes the Lens way too (caption as the question); another file is turned back politely', async () => {
  tg.files.doc1 = jpeg(800);
  tg.calls.length = 0;
  await hook(msg(OWNER_CHAT, { caption: 'What breed is this?', document: { file_id: 'doc1', mime_type: 'image/jpeg', file_name: 'dog.jpg', file_size: 800 } }), secret);
  assert.deepEqual(texts(), ['I can see a picture. What breed is this?']);
  assert.equal((await (await call('/api/history')).json()).turns.at(-2).text, 'What breed is this? [photo]');
  tg.calls.length = 0;
  await hook(msg(OWNER_CHAT, { document: { file_id: 'doc2', mime_type: 'application/pdf', file_name: 'a.pdf' } }), secret);
  assert.deepEqual(texts(), ['I can read photos and pictures sent as files here; other files go in the Library tab in the app.']);
  assert.equal(sent('download').length, 0);
  tg.calls.length = 0;
});

test("an iPhone original sent as a file (4 MB, or HEIC) is read from Telegram's preview, never downloaded whole; with no preview the owner is told to send a photo", async () => {
  tg.files.thumb1 = jpeg(400);
  tg.calls.length = 0;
  // 4 MB JPEG: over the limit, so the size is checked before any download and the preview is read instead
  await hook(msg(OWNER_CHAT, { caption: 'Is this damp?', document: { file_id: 'bigdoc', mime_type: 'image/jpeg', file_name: 'IMG_0001.JPG', file_size: 4_000_000, thumbnail: { file_id: 'thumb1', width: 320, height: 240, file_size: 400 } } }), secret);
  assert.deepEqual(sent('getFile').map((c) => c.body.file_id), ['thumb1'], 'the 4 MB file is never fetched');
  assert.deepEqual(texts(), [TG.PICTURE_FILE_PREVIEW, 'I can see a picture. Is this damp?']);
  tg.calls.length = 0;
  // HEIC: a format the models do not take — the preview again
  await hook(msg(OWNER_CHAT, { document: { file_id: 'heic1', mime_type: 'image/heic', file_name: 'IMG_0002.HEIC', file_size: 900_000, thumbnail: { file_id: 'thumb1', width: 320, height: 240, file_size: 400 } } }), secret);
  assert.deepEqual(sent('getFile').map((c) => c.body.file_id), ['thumb1']);
  assert.equal(texts().at(-1), 'I can see a picture. What is in this picture?');
  tg.calls.length = 0;
  // no preview at all: nothing downloaded, and the plain way out
  await hook(msg(OWNER_CHAT, { document: { file_id: 'heic2', mime_type: 'image/heic', file_name: 'IMG_0003.HEIC', file_size: 3_000_000 } }), secret);
  assert.equal(sent('getFile').length, 0);
  assert.deepEqual(texts(), [TG.PICTURE_FILE_FAILED]);
  assert.match(TG.PICTURE_FILE_FAILED, /Send it as a photo/, 'and the one thing to do');
  tg.calls.length = 0;
});

// OWNER-ISSUES 79: a 2-minute TikTok video and "what do you think of this kiddo" — the video was dropped (no video branch),
// and the words left over were answered with a confident account of his cousin. Now it is never dropped silently.
const FRAME = { file_id: 'vframe', width: 320, height: 568, file_size: 500 };
const SAID = "🎞 I can't watch videos yet: I'm going by one still frame of it, and I can't hear its sound.";

test("a video (79): its one still frame goes the photo's way with the caption as the question; the honest line comes first; the model is told; the video itself is never fetched", async () => {
  tg.files.vframe = jpeg(500);
  tg.calls.length = 0;
  const r = await hook(msg(OWNER_CHAT, { caption: 'what do you think of this kiddo', video: { file_id: 'vid1', mime_type: 'video/mp4', duration: 120, file_size: 9_000_000, thumbnail: FRAME } }), secret);
  assert.equal(r.status, 200);
  assert.deepEqual(sent('getFile').map((c) => c.body.file_id), ['vframe'], 'only the frame is fetched');
  // the reply: the honest line, then the model's answer — which shows it was told it saw one picture of a video
  assert.deepEqual(texts(), [SAID, 'I can only see one picture of it, as I was told. what do you think of this kiddo'], 'the plain line is a message of its own, first');
  // the history keeps the owner's words and the picture's marker, never the note
  const turns = (await (await call('/api/history')).json()).turns;
  assert.equal(turns.at(-2).text, 'what do you think of this kiddo [photo]');
  tg.calls.length = 0;
});

test('a video over 20 MB says so plainly; a GIF, a round video note and a video sent as a file go the same way; with no frame nothing is guessed', async () => {
  tg.files.vframe = jpeg(500);
  tg.calls.length = 0;
  // over the Bot API's 20 MB: said in plain words (and still only the frame is fetched)
  await hook(msg(OWNER_CHAT, { video: { file_id: 'vbig', file_size: 48_000_000, thumbnail: FRAME } }), secret);
  assert.deepEqual(texts(), [`${SAID} It's 48 MB, and Telegram only lets me fetch files up to 20 MB.`, 'I can only see one picture of it, as I was told. What do you make of this video?']);
  assert.deepEqual(sent('getFile').map((c) => c.body.file_id), ['vframe']);
  tg.calls.length = 0;
  // a GIF (Telegram sends it as animation AND as document): no sound to speak of
  await hook(msg(OWNER_CHAT, { animation: { file_id: 'gif1', mime_type: 'video/mp4', thumbnail: FRAME }, document: { file_id: 'gif1', mime_type: 'video/mp4', thumbnail: FRAME } }), secret);
  assert.deepEqual(texts(), ["🎞 I can't watch GIFs yet: I'm going by one still frame of it.", 'I can only see one picture of it, as I was told. What do you make of this GIF?']);
  tg.calls.length = 0;
  await hook(msg(OWNER_CHAT, { video_note: { file_id: 'vn1', duration: 9, thumbnail: FRAME } }), secret);
  assert.equal(texts()[0], "🎞 I can't watch video notes yet: I'm going by one still frame of it, and I can't hear its sound.");
  assert.ok(texts().length === 2, 'then its answer');
  tg.calls.length = 0;
  await hook(msg(OWNER_CHAT, { caption: 'look', document: { file_id: 'mp4doc', mime_type: 'video/mp4', file_name: 'clip.mp4', file_size: 5_000_000, thumbnail: FRAME } }), secret);
  assert.match(texts()[0] ?? '', /^🎞 I can't watch videos yet/, 'a video sent as a file is a video, not "other files"');
  tg.calls.length = 0;
  // no frame at all: the plain way out, no turn, nothing fetched
  await hook(msg(OWNER_CHAT, { caption: 'thoughts?', video: { file_id: 'vbare', file_size: 70_000_000 } }), secret);
  assert.deepEqual(texts(), ["I can't watch videos yet, and this one came without a still frame I could get, so I can't see anything of it. It's 70 MB, and Telegram only lets me fetch files up to 20 MB. Tell me what's in it, or send a screenshot."]);
  assert.equal(sent('getFile').length, 0);
  tg.calls.length = 0;
});

test('a TikTok link: its public card (oEmbed) — title, author and cover — with the honest line; one that will not open is said plainly', async () => {
  const link = 'https://www.tiktok.com/@ghostyfan/video/7300000000000000001';
  tg.web[`https://www.tiktok.com/oembed?url=${encodeURIComponent(link)}`] = () => new Response(JSON.stringify({ title: 'Kid tries a card trick', author_name: 'ghostyfan', thumbnail_url: 'https://p16-sign.tiktokcdn.test/cover.jpeg' }), { headers: { 'content-type': 'application/json' } });
  tg.web['https://p16-sign.tiktokcdn.test/cover.jpeg'] = () => new Response(jpeg(700));
  tg.calls.length = 0;
  await hook(msg(OWNER_CHAT, { text: `what do you think of this ${link}` }), secret);
  assert.deepEqual(texts(), ["🎞 I can't watch TikToks yet: I'm going by its title and author, and its cover picture.", `I can only see one picture of it, as I was told. what do you think of this ${link}`]);
  assert.equal(sent('getFile').length, 0, 'nothing from Telegram to fetch');
  tg.calls.length = 0;
  // gone or private: said plainly, and the turn still runs with the note that nothing came
  const gone = 'https://vm.tiktok.com/ZZgone123/';
  tg.web[`https://www.tiktok.com/oembed?url=${encodeURIComponent(gone)}`] = () => new Response('{"code":400}', { status: 400 });
  await hook(msg(OWNER_CHAT, { text: `is this one funny ${gone}` }), secret);
  assert.equal(texts()[0], "🎞 I couldn't open that TikTok (it may be private or gone), and I can't watch videos yet.");
  assert.equal(texts().length, 2, 'then its answer');
  tg.calls.length = 0;
});

test('an approval asked in the app reaches Telegram once; a forged press from another chat, a tampered or an expired one is refused; NOT NOW declines and the app sees it', async () => {
  // asked in the app
  await call('/api/memory', { method: 'POST', body: JSON.stringify({ text: 'another fact' }) });
  const r = await call('/api/chat', { method: 'POST', body: JSON.stringify({ message: 'forget everything' }) });
  await r.text();
  await settle();
  const id = (await (await call('/api/history')).json()).pending?.id;
  assert.ok(id, 'waiting in the app');
  tg.calls.length = 0;
  assert.equal((await call('/api/telegram/ask/nope123')).status, 404, 'a GET is not the route');
  assert.equal((await call('/api/telegram/ask/nope123', { method: 'POST' })).status, 404, 'only the approval really waiting');
  assert.deepEqual(await (await call(`/api/telegram/ask/${id}`, { method: 'POST' })).json(), { sent: true });
  assert.deepEqual(await (await call(`/api/telegram/ask/${id}`, { method: 'POST' })).json(), { sent: false, already: true }, 'never twice');
  const ask = sent().find((c) => c.body.reply_markup);
  assert.equal(ask.body.text, TG.approvalCard('Allow forget everything? (asked in the app)'));
  assert.match(ask.body.text, /^If you approve, I'll do exactly this: “forget everything”\. APPROVE does it now; NOT NOW leaves it undone\. It's waiting in the app too\.$/);
  const [yes, no] = ask.body.reply_markup.inline_keyboard[0];
  assert.deepEqual([yes.text, no.text], ['APPROVE', 'NOT NOW']);
  assert.deepEqual(await (await call(`/api/telegram/answer/${id}`)).json(), { answered: false });
  // forged: Ghosty's real, signed APPROVE data — pressed in another chat
  tg.calls.length = 0;
  await hook({ update_id: ++n, callback_query: { id: 'f1', from: { id: STRANGER }, message: { message_id: 5, chat: { id: STRANGER } }, data: yes.callback_data } }, secret);
  // forged: from another chat that claims the owner as the presser
  await hook({ update_id: ++n, callback_query: { id: 'f2', from: { id: OWNER_CHAT }, message: { message_id: 5, chat: { id: STRANGER } }, data: yes.callback_data } }, secret);
  // tampered: NOT NOW's data turned into APPROVE, from the owner's chat
  const t = no.callback_data.split(':');
  t[2] = '1';
  await hook({ update_id: ++n, callback_query: { id: 'f3', from: { id: OWNER_CHAT }, message: { message_id: 5, chat: { id: OWNER_CHAT } }, data: t.join(':') } }, secret);
  assert.deepEqual(tg.calls.map((c) => c.method), ['answerCallbackQuery', 'answerCallbackQuery', 'answerCallbackQuery'], 'answered so the button stops spinning, nothing more');
  assert.ok(tg.calls.every((c) => c.body.text === undefined));
  assert.equal((await (await call('/api/history')).json()).pending?.id, id, 'still waiting');
  assert.equal((await (await call('/api/memory')).json()).facts.length, 1, 'nothing was erased');
  // expired: a button signed two days ago, from the owner
  tg.calls.length = 0;
  const old = await TG.signButton(TOKEN, { kind: 'a', id, yes: true }, Date.now() - 2 * 86400_000);
  await hook({ update_id: ++n, callback_query: { id: 'f4', from: { id: OWNER_CHAT }, message: { message_id: 5, chat: { id: OWNER_CHAT } }, data: old } }, secret);
  assert.equal(tg.calls[0].body.text, 'That button has expired');
  assert.deepEqual(texts(), ['That button has expired. Ask me again, or answer it in the app.']);
  assert.equal((await (await call('/api/history')).json()).pending?.id, id, 'still waiting');
  // NOT NOW from the owner: declined, exactly as DECLINE in the app; the app's card learns it
  tg.calls.length = 0;
  await hook({ update_id: ++n, callback_query: { id: 'ok1', from: { id: OWNER_CHAT }, message: { message_id: 5, chat: { id: OWNER_CHAT } }, data: no.callback_data } }, secret);
  assert.equal(tg.calls[0].body.text, 'Not now');
  assert.ok(sent('editMessageReplyMarkup').length === 1, 'the buttons come off');
  assert.equal((await (await call('/api/history')).json()).pending, null);
  assert.equal((await (await call('/api/memory')).json()).facts.length, 1, 'declined: nothing erased');
  const ans = await (await call(`/api/telegram/answer/${id}`)).json();
  assert.equal(ans.answered, true);
  assert.equal(ans.allow, false);
  tg.calls.length = 0;
});

// ---- QUALITY PASS: TELEGRAM (each check is named for the rough spot it closes; each failed on the code before the pass) ----
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
const NEWS = Array.from({ length: 60 }, (_, i) => `${i + 1}. Item number ${i + 1} is e.g. a thing about Dr. Smith vs. the world, which takes a while to say in full and ends here.`).join('\n');

test('a long reply splits at a sentence end or a line and never mid-sentence, mid-word or after a list number; "(1 of 3)" only when there are parts', async () => {
  const big = `${NEWS}\n\n${'The forecast says rain in the afternoon. '.repeat(160)}`.slice(0, 9000);
  const parts = TG.splitMessage(big);
  assert.ok(parts.length >= 3, `${parts.length} parts`);
  // every part but the last ends where a sentence ends (or a line does), not after "vs." or "Dr." or a bare "35."
  for (const p of parts.slice(0, -1)) {
    assert.ok(!/(?:\bvs|\bDr|\be\.g|\bi\.e)\.$/.test(p) && !/(?:^|\n)\d+\.$/.test(p), `ends after an abbreviation or a list number: …${p.slice(-40)}`);
    assert.ok(/[.!?]$/.test(p), `ends mid-sentence: …${p.slice(-40)}`);
  }
  // nothing lost, nothing cut inside a word
  assert.equal(parts.join(' ').replace(/\s+/g, ' '), big.trim().replace(/\s+/g, ' '));
  // a part never starts in the middle of a list item or a sentence: it begins with a number or a capital
  for (const p of parts.slice(1)) assert.match(p, /^(?:\d+\. |The |Item )/, `starts mid-sentence: ${p.slice(0, 40)}…`);
  // the reply path labels the parts; one that fits has no label
  tg.calls.length = 0;
  await TG.tgReply(TOKEN, OWNER_CHAT, big, ORIGIN);
  const sentParts = texts();
  assert.equal(sentParts.length, parts.length >= 3 ? sentParts.length : 0);
  sentParts.forEach((t, i) => {
    assert.ok(t.startsWith(`(${i + 1} of ${sentParts.length}) `), `part ${i + 1} says its place: ${t.slice(0, 20)}`);
    assert.ok(t.length <= 4000, `part ${i + 1} is ${t.length} characters`);
  });
  tg.calls.length = 0;
  await TG.tgReply(TOKEN, OWNER_CHAT, 'A short reply.', ORIGIN);
  assert.deepEqual(texts(), ['A short reply.'], 'no "(1 of 1)"');
  tg.calls.length = 0;
});

test('markdown the model wrote reaches Telegram as plain, clean text with nothing lost: headings in capitals, bullets as •, bold dropped, a table as lines', async () => {
  const md = ['# Weekend plan', '', 'Here is **the plan** for the weekend, with `code` and a [link](https://example.com/a_b).', '', '## Things to do', '', '- Visit the *market* early.', '- Cook dinner.', '  - nested item', '', '1. First step.', '2. Second step.', '', '| Day | Weather |', '|---|---|', '| Sat | Rain |', '| Sun | Sun |', '', '> A quote.', '', '```', 'keep_this_as_is(**x**)', '```'].join('\n');
  const plain = TG.plainReply(md);
  assert.equal(plain, ['WEEKEND PLAN', '', 'Here is the plan for the weekend, with code and a link (https://example.com/a_b).', '', 'THINGS TO DO', '', '• Visit the market early.', '• Cook dinner.', '  ◦ nested item', '', '1. First step.', '2. Second step.', '', 'Day · Weather', 'Sat · Rain', 'Sun · Sun', '', 'A quote.', '', 'keep_this_as_is(**x**)'].join('\n'));
  assert.ok(!/[*`#|]|\]\(/.test(plain.replace('keep_this_as_is(**x**)', '')), 'no stray marks');
  for (const w of ['Weekend', 'market', 'Cook dinner', 'nested item', 'First step', 'Second step', 'Rain', 'Sun', 'quote', 'https://example.com/a_b']) assert.ok(new RegExp(w, 'i').test(plain), `lost: ${w}`);
  // underscores inside words and addresses survive; a list's own text does too
  assert.equal(TG.plainReply('snake_case_name at https://x.test/a_b_c and 2 * 3 * 4'), 'snake_case_name at https://x.test/a_b_c and 2 * 3 * 4');
  tg.calls.length = 0;
  await TG.tgReply(TOKEN, OWNER_CHAT, md, ORIGIN);
  assert.deepEqual(texts(), [plain], 'what is sent is the plain shape, in one message');
  tg.calls.length = 0;
});

test('typing shows from the first moment of work — before a voice note is fetched or heard, before a picture is fetched — not only once the turn starts', async () => {
  tg.files.note1 = new Uint8Array(5000).fill(7);
  env.AI = { async run() { return { text: 'remember I like coffee' }; } };
  try {
    tg.calls.length = 0;
    await hook(msg(OWNER_CHAT, { voice: { file_id: 'note1', mime_type: 'audio/ogg', duration: 3, file_size: 5000 } }), secret);
    const order = tg.calls.map((c) => c.method);
    const typed = order.indexOf('sendChatAction');
    assert.ok(typed >= 0 && typed < order.indexOf('getFile'), `typing came first: ${order.join(' > ')}`);
    tg.calls.length = 0;
    tg.files.small = jpeg(200);
    await hook(msg(OWNER_CHAT, { photo: [{ file_id: 'small', width: 90, height: 60, file_size: 200 }] }), secret);
    const o2 = tg.calls.map((c) => c.method);
    assert.ok(o2.indexOf('sendChatAction') < o2.indexOf('getFile'), `typing before the picture is fetched: ${o2.join(' > ')}`);
    assert.equal(sent('sendChatAction').length, 1, 'once for the whole message, not once per step');
  } finally {
    delete env.AI;
  }
  tg.calls.length = 0;
});

test('a slow turn is narrated in ONE message that is edited in place and taken away when the answer comes; a quick turn is never narrated', async () => {
  tg.calls.length = 0;
  const slow = TG.collector(TOKEN, OWNER_CHAT, ORIGIN, '', undefined, { narrateAfterMs: 10, editEveryMs: 10 });
  slow.emit({ t: 'status', text: 'thinking…' });
  slow.emit({ t: 'status', text: 'waiting for free AI room · 12 s' }); // a counting-down line says one thing, once
  await wait(60);
  slow.emit({ t: 'status', text: 'reading example.com…' });
  await wait(60);
  slow.emit({ t: 'status', text: 'waiting for free AI room · 11 s' });
  await wait(60);
  slow.emit({ t: 'text', text: 'The answer.' });
  slow.emit({ t: 'done', model: 'x' });
  await slow.flush();
  assert.deepEqual(sent().map((c) => c.body.text), ['All my models are busy. Waiting for one…', 'The answer.'], 'one narration message, then the answer — never a message per step');
  const edits = sent('editMessageText');
  assert.deepEqual(edits.map((c) => c.body.text), ['Reading example.com…', 'All my models are busy. Waiting for one…']);
  const narrationId = edits[0].body.message_id;
  assert.ok(edits.every((c) => c.body.message_id === narrationId), 'every change is the same message edited');
  assert.deepEqual(sent('deleteMessage').map((c) => c.body.message_id), [narrationId], 'taken away when the answer comes');
  const order = tg.calls.map((c) => c.method);
  assert.ok(order.lastIndexOf('editMessageText') < order.indexOf('deleteMessage') && order.indexOf('deleteMessage') < order.lastIndexOf('sendMessage'), `in order: ${order.join(' > ')}`);
  tg.calls.length = 0;
  // a quick turn: the answer comes before the wait is over; nothing but the answer is sent, nothing to take away
  const quick = TG.collector(TOKEN, OWNER_CHAT, ORIGIN, '', undefined, { narrateAfterMs: 200 });
  quick.emit({ t: 'status', text: 'thinking…' });
  quick.emit({ t: 'text', text: 'Quick.' });
  quick.emit({ t: 'done', model: 'x' });
  await quick.flush();
  await wait(250);
  assert.deepEqual(tg.calls.map((c) => c.method), ['sendMessage']);
  assert.equal(texts()[0], 'Quick.');
  tg.calls.length = 0;
  // the words themselves are the chat's own
  assert.equal(TG.stepWords('thinking…'), 'Asking my brain…');
  assert.equal(TG.stepWords('publishing bakery (4 KB)…'), 'Publishing bakery (4 KB)…');
  assert.equal(TG.stepWords('TypeError: x is undefined'), 'Working on it…', 'never a raw error');
});

test('what could not be heard is said in one sentence with the one thing to do — never a raw error, never a developer word', async () => {
  tg.files.note1 = new Uint8Array(5000).fill(7);
  const says = [];
  env.AI = { async run() { throw new Error('boom 500 internal Whisper exploded'); } };
  try {
    await hook(msg(OWNER_CHAT, { voice: { file_id: 'note1', mime_type: 'audio/ogg' } }), secret);
    says.push(...texts());
  } finally {
    delete env.AI;
  }
  assert.deepEqual(says, [TG.HEARD.failed]);
  for (const line of [TG.HEARD.tooBig(8), TG.HEARD.noEars, TG.HEARD.silent, TG.HEARD.failed, TG.photoFail('every size of that photo is over 1.5 MB'), TG.photoFail('could not download it (404)'), TG.photoFail('that is not a JPEG, PNG or WebP picture')]) {
    assert.equal((line.match(/[.!?](?=\s|$)/g) ?? []).length, 1, `one sentence: ${line}`);
    assert.ok(/send|type|try|add/i.test(line), `the one thing to do: ${line}`);
    assert.ok(!/Workers AI|\b\d{3}\b.*\b(error|status)|webhook|token|payload|undefined|fetch|Whisper/i.test(line), `a developer word: ${line}`);
  }
  tg.calls.length = 0;
});

test('a cited answer ends in a SOURCES block of numbered addresses; a source never opened is left out', async () => {
  tg.calls.length = 0;
  const out = TG.collector(TOKEN, OWNER_CHAT, ORIGIN, '', undefined, { narrateAfterMs: 1e6 });
  out.emit({ t: 'text', text: 'Rain is likely [1] and the wind is light [2].' });
  out.emit({ t: 'cited', citations: [{ n: 1, title: 'Met Office forecast', url: 'https://www.metoffice.gov.uk/x' }, { n: 2, title: 'My notes', doc: 'Garden notes' }, { n: 3, title: 'Never opened', url: 'https://x.test/y', missing: true }], checks: [] });
  out.emit({ t: 'done', model: 'x' });
  await out.flush();
  assert.deepEqual(texts(), ['Rain is likely [1] and the wind is light [2].', 'SOURCES\n1. Met Office forecast — https://www.metoffice.gov.uk/x\n2. Garden notes (in your library)']);
  assert.equal(TG.sourcesBlock([{ n: 1, title: 'Only', url: 'https://only.test', missing: true }]), '', 'nothing to list: no block');
  tg.calls.length = 0;
});

test('an approval card says in one line what APPROVE does and what NOT NOW does, the thing quoted, and the arguments with it', () => {
  assert.equal(TG.approvalCard('Allow publish site? name: bakery · public: true'), "If you approve, I'll do exactly this: “publish site (name: bakery · public: true)”. APPROVE does it now; NOT NOW leaves it undone.");
  assert.equal(TG.approvalCard('Allow forget all?'), "If you approve, I'll do exactly this: “forget all”. APPROVE does it now; NOT NOW leaves it undone.");
  assert.match(TG.approvalCard('Erase the diary for March'), /“Erase the diary for March”/, 'a reason that is not "Allow …?" is quoted whole');
});

test('every model cooling is said once, in his words, with the time the first is back; the paused database in his words; nothing raw ever', async () => {
  tg.calls.length = 0;
  const cool = 'Every model I can reach is cooling down after rate limits. The first one frees up in about 20 seconds. Another free key in the System tab gives me more room.';
  const out = TG.collector(TOKEN, OWNER_CHAT, ORIGIN, '', undefined, { narrateAfterMs: 1e6 });
  out.emit({ t: 'status', text: 'waiting for free AI room · 20 s' });
  out.emit({ t: 'error', message: cool });
  out.emit({ t: 'done', model: '' });
  await out.flush();
  assert.deepEqual(texts(), ['All my models are busy right now. The first is back in about 20 seconds. Ask me again then.'], 'once');
  assert.equal(TG.sayBrain('Every model I can reach is full for now (free limits). The first one frees up in about 200 seconds. Another free key in the System tab gives me more room.'), 'All my models are busy right now. The first is back in about 4 minutes. Ask me again then.');
  assert.equal(TG.sayBrain('Hmm. No AI model answered either (the first is back at 14:05). Give Ghosty an AI key once in System → Keys (Gemini). (Error: 429 {"x":1})'), 'All my models are busy right now. The first is back at 14:05. Ask me again then.');
  // the paused database: Cloudflare's own allowance, "$5/month" and "the heavy readers" are not what he reads
  const paused = "Ghosty's database has used up Cloudflare's free daily allowance, so it is paused until it resets at midnight UTC (1am UK summer time). Nothing is lost. The heavy readers that caused this have been fixed; Workers Paid ($5/month) removes the limit.";
  assert.equal(TG.sayBrain(paused), TG.PAUSED);
  assert.ok(!/Cloudflare|\$5|readers/.test(TG.PAUSED) && /midnight UTC/.test(TG.PAUSED));
  assert.equal(TG.sayBrain('Answered, but not saved: my database is paused until midnight UTC.'), 'Answered, but not saved: my database is paused until midnight UTC.');
  // raw text becomes one plain line, however long or technical
  for (const raw of ['TypeError: Cannot read properties of undefined (reading "x")', 'Telegram sendMessage answered 400: Bad Request: chat not found', 'fetch failed: https://api.telegram.org/bot123/x', '', 'x'.repeat(400)]) assert.equal(TG.sayBrain(raw), TG.GENERIC_FAIL, raw.slice(0, 40));
  // and his own sentences stay as they are
  assert.equal(TG.sayBrain('I ran out of steps.'), 'I ran out of steps.');
  tg.calls.length = 0;
  // end to end: a turn that fails with the raw text sends the one line, and the token is nowhere in it
  const real = state.storage.get;
  try {
    state.storage.get = async () => { throw new Error('Exceeded allowed rows read in Durable Objects free tier.'); };
    await hook(msg(OWNER_CHAT, { text: 'say hello' }), secret);
  } finally {
    state.storage.get = real;
  }
  assert.ok(texts().length >= 1 && texts().every((t) => !/Exceeded|rows read|Cloudflare|free tier|\$5/.test(t) && !t.includes(TOKEN)), texts().join(' | '));
  tg.calls.length = 0;
});

test('a notification has a head in words, one body and its time; a warning never shows a raw error; one that cannot reach Telegram is recorded once for the app and never retried', async () => {
  const host = { env, storage: state.storage, vault: { get: async () => TOKEN }, origin: ORIGIN };
  tg.calls.length = 0;
  await TG.telegramNotify(host, { kind: 'task', title: 'Weekly digest', text: 'Your digest is ready.' });
  await TG.telegramNotify(host, { kind: 'error', title: 'Morning brief', text: 'This did not run: TypeError: fetch failed (ECONNRESET)' });
  await TG.telegramNotify(host, { kind: 'error', title: 'Change #4 failed', text: 'It failed its checks after shipping, so I rolled nothing back.' });
  const [task, err, own] = texts();
  assert.match(task, /^Done: Weekly digest\nYour digest is ready\.\nFinished at \d\d:\d\d( UTC)?\.$/);
  assert.match(err, /^Something went wrong: Morning brief\nI couldn't finish it; the details are in your inbox in the app\.\nIt happened at \d\d:\d\d( UTC)?\.$/);
  assert.ok(!/TypeError|ECONN|fetch/.test(err), 'no raw error');
  assert.match(own, /^Something went wrong: Change #4 failed\nIt failed its checks after shipping, so I rolled nothing back\.\n/, 'a sentence of his own is kept');
  assert.ok(![task, err, own].some((t) => /^[⏰✦⚠]/.test(t)), 'a head in words, not a symbol alone');
  // a send that fails: false, recorded once (one record, the newest, with a count), and one attempt each, never a retry
  tg.calls.length = 0;
  tg.fail = true;
  assert.equal(await TG.telegramNotify(host, { kind: 'reminder', title: 'Reminder', text: 'Call Mum' }), false);
  assert.equal(sent().length, 1, 'tried once');
  assert.equal(await TG.telegramNotify(host, { kind: 'task', title: 'Digest', text: 'Done.' }), false);
  tg.fail = null;
  assert.equal(sent().length, 2, 'once each: never retried into a flood');
  const missed = (await status()).missed;
  assert.deepEqual([missed.what, missed.n], ['task', 2]);
  assert.ok(missed.at <= Date.now() && missed.at > Date.now() - 60_000);
  assert.match(TG.missedLine(missed, 'UTC'), /^2 messages did not reach you on Telegram, the last one at \d\d:\d\d \(a finished task\); they are in your inbox in the app\.$/);
  assert.match(TG.missedLine({ at: Date.now(), what: 'reminder', n: 1 }, 'UTC'), /^A message didn't reach you on Telegram at \d\d:\d\d \(a reminder\); it is in your inbox in the app\.$/);
  // the next one that arrives clears it
  tg.calls.length = 0;
  assert.equal(await TG.telegramNotify(host, { kind: 'reminder', title: 'Reminder', text: 'Call Mum' }), true);
  assert.equal((await status()).missed, undefined);
  tg.calls.length = 0;
});

test('the routes the phone calls answer in his words: never a raw error, one sentence each', async () => {
  tg.calls.length = 0;
  tg.fail = true;
  const sentTest = await call('/api/telegram/test', { method: 'POST' });
  tg.fail = null;
  assert.equal(sentTest.status, 502);
  assert.equal((await sentTest.json()).error, TG.ROUTE.cannotReach);
  assert.equal((await (await call('/api/telegram/code', { method: 'POST' })).json()).error, TG.ROUTE.alreadyPaired);
  for (const line of Object.values(TG.ROUTE)) assert.equal((line.match(/[.!?](?=\s|$)/g) ?? []).length, 1, line);
  assert.equal(TG.codeLife(14 * 60_000 + 1), 'about 15 minutes');
  assert.equal(TG.codeLife(30_000), 'about a minute');
  assert.match(TG.BUSY, /^I'm still answering something from your phone\. Send \/stop to stop it, or ask me again in a minute\.$/);
  tg.calls.length = 0;
});

test('a new upgrade idea comes with BUILD IT / NOT NOW: BUILD IT starts the Workshop chat for it, NOT NOW leaves it there', async () => {
  const idea = { id: 'up1a2b', title: 'Dark mode toggle', why: 'Easier on the eyes at night', steps: ['Add a toggle in Settings', 'Save it'], at: Date.now() };
  await state.storage.put('upgrades:ideas', [idea]);
  tg.calls.length = 0;
  const host = { env, storage: state.storage, vault: { get: async (n) => (n === 'telegram' ? TOKEN : null) }, origin: ORIGIN };
  assert.equal(await TG.telegramNotify(host, { kind: 'task', title: 'Upgrade idea', text: 'I have an upgrade idea: Dark mode toggle — see Workshop' }), true);
  const q = sent().find((c) => c.body.reply_markup);
  assert.equal(q.body.text, 'Build it? Dark mode toggle — Easier on the eyes at night');
  const [build, later] = q.body.reply_markup.inline_keyboard[0];
  assert.deepEqual([build.text, later.text], ['BUILD IT', 'NOT NOW']);
  assert.match(build.callback_data, /^u:up1a2b:1:/);
  tg.calls.length = 0;
  await hook({ update_id: ++n, callback_query: { id: 'u0', from: { id: OWNER_CHAT }, message: { message_id: 9, chat: { id: OWNER_CHAT } }, data: later.callback_data } }, secret);
  assert.deepEqual(texts(), ['Left in Workshop → UPGRADE IDEAS for later.']);
  assert.equal((await state.storage.get('upgrades:ideas')).length, 1);
  tg.calls.length = 0;
  await hook({ update_id: ++n, callback_query: { id: 'u1', from: { id: OWNER_CHAT }, message: { message_id: 9, chat: { id: OWNER_CHAT } }, data: build.callback_data } }, secret);
  assert.equal(tg.calls[0].body.text, 'Building it');
  const turns = (await (await call('/api/history')).json()).turns;
  assert.equal(turns.findLast((x) => x.role === 'user').text, 'Build this upgrade: Dark mode toggle. Easier on the eyes at night. Steps: 1. Add a toggle in Settings. 2. Save it.');
  assert.ok(texts().length >= 1, 'the turn answered in the chat');
  tg.calls.length = 0;
  globalThis.fetch = real;
});
