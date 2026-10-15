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
