/**
 * KERNEL — protected. Ghosty cannot change this file through self-edits unless the
 * owner unlocks the kernel from the Workshop tab.
 *
 * Decides whether a request comes from the owner. Two ways in:
 *  1. Cloudflare Access (recommended): Access puts a signed JWT in the
 *     `Cf-Access-Jwt-Assertion` header. We verify its signature, audience,
 *     issuer, expiry and that the email is OWNER_EMAIL.
 *  2. Owner key (fallback): the `x-ghosty-key` header equals the OWNER_KEY secret.
 * If neither is configured, every request is refused (fail closed).
 */
import type { Env } from '../env';

export type AuthResult = { ok: true; who: string } | { ok: false; status: number; reason: string };

interface Jwk {
  kid: string;
  kty: string;
  n: string;
  e: string;
  alg?: string;
}

let jwksCache: { team: string; at: number; keys: Jwk[] } | null = null;

async function accessKeys(team: string): Promise<Jwk[]> {
  if (jwksCache && jwksCache.team === team && Date.now() - jwksCache.at < 3600_000) return jwksCache.keys;
  const r = await fetch(`https://${team}.cloudflareaccess.com/cdn-cgi/access/certs`);
  if (!r.ok) throw new Error('could not load Access certificates');
  const j = (await r.json()) as { keys: Jwk[] };
  jwksCache = { team, at: Date.now(), keys: j.keys };
  return j.keys;
}

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64urlJson<T>(s: string): T {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(s))) as T;
}

async function verifyAccessJwt(token: string, env: Env): Promise<string | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, sig] = parts as [string, string, string];
  const header = b64urlJson<{ kid: string; alg: string }>(h);
  if (header.alg !== 'RS256') return null;
  const keys = await accessKeys(env.ACCESS_TEAM!);
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    b64urlToBytes(sig),
    new TextEncoder().encode(`${h}.${p}`),
  );
  if (!valid) return null;
  const claims = b64urlJson<{ aud: string | string[]; exp: number; iss: string; email?: string }>(p);
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(env.ACCESS_AUD!)) return null;
  if (claims.exp * 1000 < Date.now()) return null;
  if (claims.iss !== `https://${env.ACCESS_TEAM}.cloudflareaccess.com`) return null;
  if (!claims.email || claims.email.toLowerCase() !== env.OWNER_EMAIL!.toLowerCase()) return null;
  return claims.email;
}

function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export async function authenticate(req: Request, env: Env): Promise<AuthResult> {
  const accessReady = !!(env.OWNER_EMAIL && env.ACCESS_TEAM && env.ACCESS_AUD);
  const keyReady = !!(env.OWNER_KEY && env.OWNER_KEY.length >= 24);
  if (!accessReady && !keyReady) {
    return { ok: false, status: 503, reason: 'Ghosty is not secured yet. Set OWNER_KEY or Cloudflare Access (see SETUP.md).' };
  }
  const jwt = req.headers.get('cf-access-jwt-assertion');
  if (accessReady && jwt) {
    try {
      const who = await verifyAccessJwt(jwt, env);
      if (who) return { ok: true, who };
    } catch {
      /* fall through to the owner key */
    }
  }
  const given = req.headers.get('x-ghosty-key');
  if (keyReady && given && sameSecret(given, env.OWNER_KEY!)) return { ok: true, who: env.OWNER_EMAIL || 'owner' };
  return { ok: false, status: 401, reason: keyReady ? 'owner key required' : 'not signed in as the owner' };
}
