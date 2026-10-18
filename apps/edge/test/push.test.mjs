// Web Push encryption against the worked example in RFC 8291 (Appendix A), plus VAPID.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

const P = await import('./.build/push.mjs');
const clean = (s) => s.replace(/\s+/g, '');

const RFC = {
  plaintext: 'When I grow up, I want to be a watermelon',
  asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  asPublic: clean('BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIg Dll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8'),
  uaPublic: clean('BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV- JvLexhqUzORcx aOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4'),
  uaPrivate: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  body: clean(`DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml
    mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPT
    pK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN`),
};

test('message encryption matches RFC 8291 byte for byte', async () => {
  const asPub = P.b64u.dec(RFC.asPublic);
  const privateKey = await webcrypto.subtle.importKey('jwk', P.p256Jwk(asPub, P.b64u.dec(RFC.asPrivate)), { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  const out = await P.encryptPush(new TextEncoder().encode(RFC.plaintext), RFC.uaPublic, RFC.auth, { privateKey, publicRaw: asPub }, P.b64u.dec(RFC.salt));
  assert.equal(P.b64u.enc(out), RFC.body);
});

test('the device can decrypt a freshly encrypted message', async () => {
  // Decrypt as the user agent would, using the RFC's user-agent keys.
  const msg = 'Reminder: stretch';
  const body = await P.encryptPush(new TextEncoder().encode(msg), RFC.uaPublic, RFC.auth);
  const salt = body.slice(0, 16);
  const idlen = body[20];
  const asPublic = body.slice(21, 21 + idlen);
  const ct = body.slice(21 + idlen);
  const ua = await webcrypto.subtle.importKey('jwk', P.p256Jwk(P.b64u.dec(RFC.uaPublic), P.b64u.dec(RFC.uaPrivate)), { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  const asKey = await webcrypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await webcrypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, ua, 256));
  const hk = async (s, ikm, info, n) => new Uint8Array(await webcrypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: s, info }, await webcrypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), n * 8));
  const enc = (s) => new TextEncoder().encode(s);
  const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
  const ikm = await hk(P.b64u.dec(RFC.auth), ecdh, cat(enc('WebPush: info\0'), P.b64u.dec(RFC.uaPublic), asPublic), 32);
  const cek = await hk(salt, ikm, enc('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hk(salt, ikm, enc('Content-Encoding: nonce\0'), 12);
  const plain = new Uint8Array(await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, await webcrypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']), ct));
  assert.equal(plain[plain.length - 1], 2, 'last-record delimiter');
  assert.equal(new TextDecoder().decode(plain.slice(0, -1)), msg);
});

test('subscriptions only to real push services; VAPID header is a valid ES256 JWT', async () => {
  const st = new Map();
  const storage = { get: async (k) => st.get(k), put: async (k, v) => void st.set(k, v) };
  await assert.rejects(P.addSub(storage, { endpoint: 'https://evil.example/collect', p256dh: RFC.uaPublic, auth: RFC.auth, label: 'x' }));
  await assert.rejects(P.addSub(storage, { endpoint: 'http://fcm.googleapis.com/fcm/send/x', p256dh: RFC.uaPublic, auth: RFC.auth, label: 'x' }));
  const sub = await P.addSub(storage, { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', p256dh: RFC.uaPublic, auth: RFC.auth, label: 'Phone' });
  assert.equal((await P.loadSubs(storage)).length, 1);
  // capture what would be sent
  const sent = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => { sent.push({ url, init }); return new Response(null, { status: 201 }); };
  try {
    assert.equal(await P.pushAll(storage, { title: 'Ghosty', body: 'hello' }), 1);
  } finally {
    globalThis.fetch = realFetch;
  }
  const h = sent[0].init.headers;
  assert.equal(h['Content-Encoding'], 'aes128gcm');
  const [, jwt, k] = h.Authorization.match(/^vapid t=([^,]+), k=(.+)$/);
  const [hd, bd, sig] = jwt.split('.');
  const claims = JSON.parse(Buffer.from(bd, 'base64url').toString());
  assert.equal(claims.aud, 'https://fcm.googleapis.com');
  assert.ok(claims.exp > Date.now() / 1000);
  const pub = await webcrypto.subtle.importKey('raw', P.b64u.dec(k), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  assert.ok(await webcrypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, P.b64u.dec(sig), new TextEncoder().encode(`${hd}.${bd}`)), 'signature verifies');
  // a gone subscription is dropped
  globalThis.fetch = async () => new Response(null, { status: 410 });
  try {
    assert.equal(await P.pushAll(storage, { title: 'x', body: 'y' }), 0);
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal((await P.loadSubs(storage)).length, 0);
  assert.ok(sub.id);
});

// ---------------------------------------------------------------------------------------
// NOTIFICATIONS switches (notifyprefs.ts): every push the brain sends goes through one gate that
// looks at the owner's choice for its kind; the inbox keeps the item either way.
// ---------------------------------------------------------------------------------------
import { build } from 'esbuild';

await build({ entryPoints: [new URL('../src/notifyprefs.ts', import.meta.url).pathname], bundle: true, format: 'esm', platform: 'neutral', outfile: new URL('./.build/notifyprefs.mjs', import.meta.url).pathname, logLevel: 'warning' });
const N = await import('./.build/notifyprefs.mjs');
const brainMod = await import('./.build/brain.mjs');

class PrefStorage {
  m = new Map();
  alarm = null;
  async get(k) {
    if (Array.isArray(k)) return new Map(k.filter((x) => this.m.has(x)).map((x) => [x, structuredClone(this.m.get(x))]));
    return this.m.has(k) ? structuredClone(this.m.get(k)) : undefined;
  }
  async put(k, v) {
    if (typeof k === 'object') for (const [a, b] of Object.entries(k)) this.m.set(a, structuredClone(b));
    else this.m.set(k, structuredClone(v));
  }
  async delete(k) {
    if (Array.isArray(k)) return k.filter((x) => this.m.delete(x)).length;
    return this.m.delete(k);
  }
  async list({ prefix = '' } = {}) {
    return new Map([...this.m].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, structuredClone(v)]));
  }
  async setAlarm(t) { this.alarm = typeof t === 'number' ? t : t.getTime(); }
  async getAlarm() { return this.alarm; }
}

/** A real-looking subscription (an actual P-256 key and auth secret) on Google's push service. */
async function fakeSub() {
  const kp = await webcrypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const raw = new Uint8Array(await webcrypto.subtle.exportKey('raw', kp.publicKey));
  return { endpoint: 'https://fcm.googleapis.com/fcm/send/test-device', keys: { p256dh: P.b64u.enc(raw), auth: P.b64u.enc(webcrypto.getRandomValues(new Uint8Array(16))) }, label: 'iPhone' };
}

/** Every push POST made while `fn` runs (the push service answers 201). */
async function pushesDuring(fn) {
  const sent = [];
  const was = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.startsWith('https://fcm.googleapis.com/')) {
      sent.push(url);
      return new Response('', { status: 201 });
    }
    return was(input, init);
  };
  try {
    await fn();
  } finally {
    globalThis.fetch = was;
  }
  return sent;
}

test('notification kinds: each sender falls under the right switch; asked-for, task results and errors always go', () => {
  assert.equal(N.pushKindOf({ kind: 'reminder', title: 'call Mum' }), 'reminders');
  assert.equal(N.pushKindOf({ kind: 'task', title: 'Cards to revise' }), 'flashcards');
  assert.equal(N.pushKindOf({ kind: 'task', title: 'Upgrade idea' }), 'upgrades');
  assert.equal(N.pushKindOf({ kind: 'task', title: 'Morning briefing' }), 'brief');
  assert.equal(N.pushKindOf({ kind: 'task', title: 'Your 3D model is ready' }), 'model3d');
  assert.equal(N.pushKindOf({ kind: 'task', title: 'Price drop: kettle' }), 'prices');
  assert.equal(N.pushKindOf({ kind: 'task', title: 'Check BTC' }), null);
  assert.equal(N.pushKindOf({ kind: 'error', title: 'Morning briefing' }), null, 'something that went wrong is never silenced');
  assert.deepEqual(N.NOTIFY_KINDS.map((k) => k.id), ['reminders', 'brief', 'flashcards', 'model3d', 'prices', 'upgrades']);
});

test('the gate: off means no push for that kind only; a paused database never silences anything', async () => {
  const storage = new PrefStorage();
  const s = await fakeSub();
  await storage.put('push:subs', [{ id: 'a', endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth, label: 'iPhone', at: 1 }]);
  assert.deepEqual(await N.loadPrefs(storage), { reminders: true, brief: true, flashcards: true, model3d: true, prices: true, upgrades: true }, 'everything is on until the owner says otherwise');
  await N.savePrefs(storage, { flashcards: false, bogus: false, reminders: 'no' });
  assert.deepEqual(await N.loadPrefs(storage), { reminders: true, brief: true, flashcards: false, model3d: true, prices: true, upgrades: true }, 'unknown kinds and non-booleans are ignored');
  const msg = { title: 't', body: 'b' };
  let n;
  assert.deepEqual(await pushesDuring(async () => void (n = await N.pushIfWanted(storage, 'flashcards', msg))), []);
  assert.equal(n, 0);
  assert.equal((await pushesDuring(() => N.pushIfWanted(storage, 'reminders', msg))).length, 1);
  assert.equal((await pushesDuring(() => N.pushIfWanted(storage, null, msg))).length, 1, 'no kind: always sent');
  const paused = new PrefStorage();
  paused.get = async () => {
    throw new Error('Exceeded allowed rows read in Durable Objects free tier.');
  };
  assert.equal(await N.pushWanted(paused, 'flashcards'), true);
});

test('owner route /api/push/prefs, and a reminder with REMINDERS off reaches the inbox but not the phone', async (t) => {
  const OWNER_KEY = 'push-owner-key-0123456789abcdef';
  const pending = [];
  const state = { storage: new PrefStorage(), waitUntil: (p) => pending.push(p) };
  const env = { OWNER_KEY, MOCK_LLM: '1' };
  let agent;
  env.AGENT = { idFromName: (n) => n, get: () => ({ fetch: (r) => (agent ??= new brainMod.GhostyAgent(state, env)).fetch(r) }) };
  const ctx = { waitUntil: (p) => pending.push(p) };
  const call = (path, init = {}, key = OWNER_KEY) =>
    brainMod.default.fetch(new Request(`https://ghosty.test${path}`, { ...init, headers: { 'content-type': 'application/json', 'x-ghosty': '1', ...(key ? { 'x-ghosty-key': key } : {}) } }), env, ctx);

  assert.equal((await call('/api/push/prefs', {}, '')).status, 401, 'owner only');
  const r = await call('/api/push/prefs');
  assert.equal(r.status, 200, 'the route exists');
  const got = await r.json();
  assert.equal(got.prefs.reminders, true);
  assert.equal(got.kinds.length, 6);
  assert.equal((await call('/api/push/subscribe', { method: 'POST', body: JSON.stringify(await fakeSub()) })).status, 200);

  const remind = async (text) => {
    const { job } = await (await call('/api/jobs', { method: 'POST', body: JSON.stringify({ kind: 'reminder', text, at: Date.now() + 3_600_000 }) })).json();
    return pushesDuring(async () => {
      assert.equal((await call(`/api/jobs/${job.id}/run`, { method: 'POST' })).status, 200);
      await Promise.allSettled(pending.splice(0));
    });
  };
  assert.equal((await remind('stretch')).length, 1, 'on: pushed');
  const off = await (await call('/api/push/prefs', { method: 'POST', body: JSON.stringify({ reminders: false }) })).json();
  assert.equal(off.prefs.reminders, false);
  assert.equal((await remind('drink water')).length, 0, 'off: not pushed');
  const items = (await (await call('/api/inbox')).json()).items;
  assert.equal(items[0].text, 'drink water', 'the inbox still has it');
  const test1 = await pushesDuring(async () => assert.equal((await (await call('/api/push/test', { method: 'POST' })).json()).sent, 1));
  assert.equal(test1.length, 1, 'SEND A TEST always goes');
});
