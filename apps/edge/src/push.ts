/**
 * Web Push from the brain, with no libraries:
 *  - VAPID (RFC 8292): the brain signs a short JWT with its own P-256 key so push
 *    services know the messages come from Ghosty.
 *  - Message encryption (RFC 8291, aes128gcm): only the owner's device can read the text.
 * The VAPID key pair is made once and kept in Durable Object storage.
 */

export interface PushSub {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  label: string;
  at: number;
}

const SUBS = 'push:subs';
const VAPID = 'push:vapid';

export const b64u = {
  enc(b: ArrayBuffer | Uint8Array): string {
    const u = b instanceof Uint8Array ? b : new Uint8Array(b);
    let s = '';
    for (const x of u) s += String.fromCharCode(x);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  dec(s: string): Uint8Array<ArrayBuffer> {
    const t = s.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(t + '==='.slice((t.length + 3) % 4));
    const out = new Uint8Array(new ArrayBuffer(bin.length));
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },
};

const concat = (...parts: Uint8Array[]): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(new ArrayBuffer(parts.reduce((n, p) => n + p.length, 0)));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};
const utf8 = (s: string) => new TextEncoder().encode(s);

async function hkdf(salt: Uint8Array<ArrayBuffer>, ikm: Uint8Array<ArrayBuffer>, info: Uint8Array<ArrayBuffer>, len: number): Promise<Uint8Array<ArrayBuffer>> {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8));
}

/** Private JWK from raw keys (for tests and for the stored VAPID key). */
export function p256Jwk(publicRaw: Uint8Array, privateRaw?: Uint8Array): JsonWebKey {
  return { kty: 'EC', crv: 'P-256', x: b64u.enc(publicRaw.slice(1, 33)), y: b64u.enc(publicRaw.slice(33, 65)), ...(privateRaw ? { d: b64u.enc(privateRaw) } : {}), ext: true };
}

/**
 * Encrypt one push message (RFC 8291). `local` and `salt` are only passed by tests
 * (the RFC's worked example); normally both are fresh and random.
 */
export async function encryptPush(
  plaintext: Uint8Array<ArrayBuffer>,
  uaPublicB64: string,
  authB64: string,
  local?: { privateKey: CryptoKey; publicRaw: Uint8Array<ArrayBuffer> },
  fixedSalt?: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
  const uaPublic = b64u.dec(uaPublicB64);
  const authSecret = b64u.dec(authB64);
  if (uaPublic.length !== 65 || uaPublic[0] !== 4) throw new Error('bad subscription key');
  if (authSecret.length !== 16) throw new Error('bad subscription auth secret');
  let asPrivate: CryptoKey;
  let asPublic: Uint8Array<ArrayBuffer>;
  if (local) {
    asPrivate = local.privateKey;
    asPublic = local.publicRaw;
  } else {
    const kp = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
    asPrivate = kp.privateKey;
    asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey) as ArrayBuffer);
  }
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey } as unknown as AlgorithmIdentifier, asPrivate, 256));
  const ikm = await hkdf(authSecret, ecdh, concat(utf8('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = fixedSalt ?? crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)));
  const cek = await hkdf(salt, ikm, utf8('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, utf8('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(plaintext, new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 0x10, 0]); // record size 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, ct);
}

interface VapidKeys {
  publicRaw: string;
  jwk: JsonWebKey;
}

export async function vapidKeys(storage: DurableObjectStorage): Promise<VapidKeys> {
  const have = await storage.get<VapidKeys>(VAPID);
  if (have) return have;
  const kp = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const keys: VapidKeys = { publicRaw: b64u.enc(await crypto.subtle.exportKey('raw', kp.publicKey) as ArrayBuffer), jwk: (await crypto.subtle.exportKey('jwk', kp.privateKey)) as JsonWebKey };
  await storage.put(VAPID, keys);
  return keys;
}

async function vapidHeader(keys: VapidKeys, endpoint: string, contact: string): Promise<string> {
  const aud = new URL(endpoint).origin;
  const head = b64u.enc(utf8(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u.enc(utf8(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: contact })));
  const key = await crypto.subtle.importKey('jwk', keys.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, utf8(`${head}.${body}`));
  return `vapid t=${head}.${body}.${b64u.enc(sig)}, k=${keys.publicRaw}`;
}

/** Push services Ghosty will deliver to (subscriptions pointing anywhere else are refused). */
const PUSH_HOSTS = /^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)$/i;

export function checkEndpoint(endpoint: string): string {
  let u: URL;
  try {
    u = new URL(endpoint);
  } catch {
    throw new Error('bad endpoint');
  }
  if (u.protocol !== 'https:' || !PUSH_HOSTS.test(u.hostname)) throw new Error('not a known push service');
  return u.toString();
}

export async function loadSubs(storage: DurableObjectStorage): Promise<PushSub[]> {
  return (await storage.get<PushSub[]>(SUBS)) ?? [];
}

export async function addSub(storage: DurableObjectStorage, s: { endpoint: string; p256dh: string; auth: string; label: string }): Promise<PushSub> {
  const endpoint = checkEndpoint(s.endpoint);
  if (b64u.dec(s.p256dh).length !== 65 || b64u.dec(s.auth).length !== 16) throw new Error('bad subscription keys');
  const subs = (await loadSubs(storage)).filter((x) => x.endpoint !== endpoint);
  const sub: PushSub = { id: crypto.randomUUID().slice(0, 8), endpoint, p256dh: s.p256dh, auth: s.auth, label: s.label.slice(0, 60) || 'Device', at: Date.now() };
  subs.push(sub);
  await storage.put(SUBS, subs.slice(-10));
  return sub;
}

export async function removeSub(storage: DurableObjectStorage, idOrEndpoint: string): Promise<boolean> {
  const subs = await loadSubs(storage);
  const keep = subs.filter((x) => x.id !== idOrEndpoint && x.endpoint !== idOrEndpoint);
  await storage.put(SUBS, keep);
  return keep.length !== subs.length;
}

/** Send to every subscribed device. Dead subscriptions are removed. Returns how many got it. */
export async function pushAll(storage: DurableObjectStorage, msg: { title: string; body: string; tag?: string; url?: string }, contact = 'mailto:owner@ghosty.invalid'): Promise<number> {
  const subs = await loadSubs(storage);
  if (!subs.length) return 0;
  const keys = await vapidKeys(storage);
  const payload = utf8(JSON.stringify({ title: msg.title.slice(0, 120), body: msg.body.slice(0, 900), tag: msg.tag, url: msg.url ?? '/#agenda' }));
  let ok = 0;
  const dead: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        const body = await encryptPush(payload, s.p256dh, s.auth);
        const r = await fetch(s.endpoint, {
          method: 'POST',
          headers: { Authorization: await vapidHeader(keys, s.endpoint, contact), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '86400', Urgency: 'high' },
          body,
        });
        if (r.status === 404 || r.status === 410) dead.push(s.id);
        else if (r.ok) ok++;
      } catch {
        /* one device failing must not stop the others */
      }
    }),
  );
  if (dead.length) await storage.put(SUBS, subs.filter((s) => !dead.includes(s.id)));
  return ok;
}
