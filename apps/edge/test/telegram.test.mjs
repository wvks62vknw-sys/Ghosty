// Telegram (telegram.ts): saving the bot token connects the bot (getMe, setWebhook with a
// secret) and makes a pairing code; the public webhook refuses a wrong or missing secret; the
// owner pairs with the code and strangers are turned away once an hour; a message from the
// paired chat runs a normal brain turn whose reply comes back as sendMessage calls (split under
// Telegram's limit), a photo reaches the model as a picture, a voice note is transcribed, an
// approval becomes APPROVE / DECLINE buttons answered through a callback, notifications reach
// the chat too, and the token never appears anywhere it could be read.
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
const tg = { calls: [], answers: {}, files: {}, fail: null };
const real = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  const api = url.match(/^https:\/\/api\.telegram\.org\/bot([^/]+)\/(\w+)$/);
  if (api) {
    const body = init.body ? JSON.parse(init.body) : {};
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
  const code = j.info.match(/^connected to @GhostyTestBot · pairing code (\d{6}) \(valid 15 min\): open the bot in Telegram, press START and send it the code$/)?.[1];
  assert.ok(code, j.info);
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
  assert.deepEqual(texts(), ['This bot answers only to its owner.']);
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
  assert.equal(texts().at(-1), "Paired. I'm Ghosty — talk to me here any time.");
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
  assert.match(texts()[0], /^Done\. Saved \(id \w+\)\.$/);
  const turns = (await (await call('/api/history')).json()).turns;
  assert.deepEqual(turns.slice(-2).map((t) => [t.role, t.text]), [['user', 'remember I like tea'], ['assistant', texts()[0]]]);
  assert.equal((await (await call('/api/memory')).json()).facts[0].text, 'i like tea');
  // the model is told it is on Telegram (no screen) through the context, like the interface's tab
  const owner = await state.storage.get('owner:ctx');
  assert.ok(owner === undefined || owner.tab !== 'telegram', 'the Telegram context is for the model only, never remembered as the owner\'s screen');
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
  assert.match(texts()[0], /^I couldn't get that photo: could not download it \(404\)$/);
  assert.equal(texts().length, 1);
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
    assert.match(texts()[0], /^🎤 remember I like coffee\n\nDone\. Saved \(id \w+\)\.$/);
    assert.equal((await (await call('/api/history')).json()).turns.at(-2).text, 'remember I like coffee');
    tg.calls.length = 0;
    // silence
    env.AI = { async run() { return { text: '' }; } };
    await hook(msg(OWNER_CHAT, { audio: { file_id: 'note1', mime_type: 'audio/mpeg' } }), secret);
    assert.deepEqual(texts(), ["I couldn't make out any words in that voice note."]);
    tg.calls.length = 0;
  } finally {
    delete env.AI;
  }
  await hook(msg(OWNER_CHAT, { voice: { file_id: 'note1', mime_type: 'audio/ogg' } }), secret);
  assert.deepEqual(texts(), ["I couldn't hear that: voice notes need Workers AI (always there on Cloudflare) or a Groq key."]);
  tg.calls.length = 0;
  // too big for a voice note: refused before any download
  await hook(msg(OWNER_CHAT, { voice: { file_id: 'note1', mime_type: 'audio/ogg', file_size: 9_000_000 } }), secret);
  assert.equal(sent('download').length, 0);
  assert.match(texts()[0], /too big/);
  tg.calls.length = 0;
});

test('an approval becomes APPROVE / DECLINE buttons; the callback answers it exactly as POST /approve does', async () => {
  await call('/api/memory', { method: 'POST', body: JSON.stringify({ text: 'a fact to erase' }) });
  await hook(msg(OWNER_CHAT, { text: 'forget everything' }), secret);
  const ask = sent().find((c) => c.body.reply_markup);
  assert.ok(ask, 'the question was sent');
  assert.match(ask.body.text, /^Needs your approval: /);
  const [approve, decline] = ask.body.reply_markup.inline_keyboard[0];
  assert.equal(approve.text, 'APPROVE');
  assert.equal(decline.text, 'DECLINE');
  const id = approve.callback_data.match(/^ap:([\w-]+):1$/)?.[1];
  assert.ok(id);
  assert.equal(decline.callback_data, `ap:${id}:0`);
  const waiting = (await (await call('/api/history')).json()).pending;
  assert.equal(waiting?.id, id, 'the same approval the interface would show');
  tg.calls.length = 0;
  // a stranger's callback does nothing (answered so the button stops spinning, never acted on)
  await hook({ update_id: ++n, callback_query: { id: 'cb0', from: { id: STRANGER }, message: { message_id: 1, chat: { id: STRANGER } }, data: `ap:${id}:1` } }, secret);
  assert.deepEqual(tg.calls.map((c) => c.method), ['answerCallbackQuery']);
  assert.ok((await (await call('/api/history')).json()).pending, 'still waiting');
  tg.calls.length = 0;
  // the owner presses APPROVE
  await hook({ update_id: ++n, callback_query: { id: 'cb1', from: { id: OWNER_CHAT, first_name: 'Sam' }, message: { message_id: ask.body.message_id ?? 1, chat: { id: OWNER_CHAT } }, data: `ap:${id}:1` } }, secret);
  const methods = tg.calls.map((c) => c.method);
  assert.equal(methods[0], 'answerCallbackQuery');
  assert.equal(tg.calls[0].body.text, 'Approved');
  assert.ok(methods.includes('editMessageReplyMarkup'), 'the buttons come off');
  assert.match(texts().at(-1), /Erased \d+ fact/);
  assert.equal((await (await call('/api/history')).json()).pending, null);
  assert.deepEqual((await (await call('/api/memory')).json()).facts, []);
  tg.calls.length = 0;
  // pressing it again: nothing is waiting any more
  await hook({ update_id: ++n, callback_query: { id: 'cb2', from: { id: OWNER_CHAT }, message: { message_id: 1, chat: { id: OWNER_CHAT } }, data: `ap:${id}:1` } }, secret);
  assert.deepEqual(texts(), ['nothing is waiting for approval']);
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
  // a reminder run now: the inbox item goes to Telegram too
  const job = (await (await call('/api/jobs', { method: 'POST', body: JSON.stringify({ kind: 'reminder', text: 'Call the dentist', at: Date.now() + 3600_000, repeat: 'none', tz: 'UTC' }) })).json()).job;
  await call(`/api/jobs/${job.id}/run`, { method: 'POST' });
  await settle();
  assert.deepEqual(texts(), ['⏰ Reminder\nCall the dentist']);
  tg.calls.length = 0;
  // TEST from the LINKS tab
  assert.deepEqual(await (await call('/api/telegram/test', { method: 'POST' })).json(), { sent: true });
  assert.deepEqual(texts(), ['Ghosty here. I can reach you on Telegram now.']);
  tg.calls.length = 0;
  // NEW CODE while paired: a code, still paired
  const fresh = await (await call('/api/telegram/code', { method: 'POST' })).json();
  assert.equal(fresh.paired, true);
  assert.equal(fresh.code, undefined, 'a code only shows while nothing is paired');
  // UNPAIR from the tab: a new code, no chat; the old chat is a stranger again
  const un = await (await call('/api/telegram/unpair', { method: 'POST' })).json();
  assert.equal(un.paired, false);
  assert.match(un.code, /^\d{6}$/);
  await hook(msg(OWNER_CHAT, { text: 'hello' }), secret);
  assert.deepEqual(texts(), ['This bot answers only to its owner.']);
  tg.calls.length = 0;
  // pair again with the new code, then /unpair from Telegram
  await hook(msg(OWNER_CHAT, { text: un.code }), secret);
  assert.equal((await status()).paired, true);
  await hook(msg(OWNER_CHAT, { text: '/unpair' }), secret);
  assert.match(texts().at(-1), /^Unpaired/);
  assert.equal((await status()).paired, false);
  assert.equal((await call('/api/telegram/test', { method: 'POST' })).status, 400);
  tg.calls.length = 0;
});

test('the token never appears in an error: a dead connection while connecting is reported without it; a bad token is refused before any call', async () => {
  tg.fail = true;
  const r = await (await call('/api/keys', { method: 'POST', body: JSON.stringify({ name: 'telegram', value: TOKEN }) })).json();
  tg.fail = null;
  assert.equal(r.works, false);
  assert.match(r.info, /saved, but the bot could not be connected: Telegram getMe: fetch failed: https:\/\/api\.telegram\.org\/bot…\/getMe/);
  assert.ok(!r.info.includes(TOKEN));
  tg.calls.length = 0;
  const bad = await (await call('/api/keys', { method: 'POST', body: JSON.stringify({ name: 'telegram', value: 'not-a-token' }) })).json();
  assert.equal(bad.works, false);
  assert.match(bad.info, /does not look like a bot token/);
  assert.equal(tg.calls.length, 0);
  // removing the key takes the webhook down (with the token that was saved) and forgets the link
  tg.calls.length = 0;
  const gone = await (await call('/api/keys', { method: 'POST', body: JSON.stringify({ name: 'telegram', value: '' }) })).json();
  await settle();
  assert.equal(gone.info, 'removed · the bot is disconnected');
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
  await hook(msg(OWNER_CHAT, { text: code }), link.secret);
  assert.equal((await status()).paired, true);
  tg.calls.length = 0;
  const realGet = state.storage.get.bind(state.storage);
  const quota = () => { throw new Error('Exceeded allowed rows read in Durable Objects free tier.'); };
  state.storage.get = async () => quota();
  state.storage.put = async () => quota();
  state.storage.delete = async () => quota();
  try {
    const r = await hook(msg(OWNER_CHAT, { text: 'hello' }), link.secret);
    assert.equal(r.status, 200);
    const reply = texts();
    assert.ok(reply.length >= 1, 'answered while paused');
    assert.ok(!reply.some((t) => /Exceeded allowed rows/.test(t)), `no raw database error: ${reply.join(' | ')}`);
    assert.ok(reply.some((t) => /^Mock reply to: hello/.test(t)), reply.join(' | '));
  } finally {
    state.storage.get = realGet;
    delete state.storage.put;
    delete state.storage.delete;
  }
  globalThis.fetch = real;
});
