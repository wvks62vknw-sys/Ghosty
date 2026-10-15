/**
 * KERNEL — protected.
 *
 * Encrypted storage for API keys and tokens. Values are encrypted with AES-GCM before
 * they are written to Durable Object storage, and they are never sent back to the
 * interface (only "set / not set"). The key is the VAULT_KEY secret if one is set;
 * otherwise the brain makes a random key once and keeps it in its own storage.
 *
 * Backup: any key can also be a Cloudflare secret named <NAME>_KEY (GEMINI_KEY, GROQ_KEY, …;
 * GITHUB_TOKEN for github). Secrets don't live in the database, so they keep working when the
 * database is unavailable (e.g. the free plan's daily allowance is used up).
 */
import type { Env } from '../env';

const PREFIX = 'vault:';
const OWN_KEY = 'vaultkey';
let cached: { raw: string; key: CryptoKey } | null = null;

async function vaultKey(env: Env, storage: DurableObjectStorage): Promise<CryptoKey> {
  let raw = env.VAULT_KEY;
  if (!raw) {
    raw = await storage.get<string>(OWN_KEY);
    if (!raw) {
      raw = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
      await storage.put(OWN_KEY, raw);
    }
  }
  if (cached && cached.raw === raw) return cached.key;
  const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
  if (bytes.length !== 32) throw new Error('VAULT_KEY must be 32 random bytes encoded as base64');
  const key = await crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
  cached = { raw, key };
  return key;
}

const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** The Cloudflare secret that can stand in for a vault entry. */
export const secretName = (name: string) => (name === 'github' ? 'GITHUB_TOKEN' : `${name.toUpperCase()}_KEY`);
const fromEnv = (env: Env, name: string): string | null => {
  const v = (env as unknown as Record<string, unknown>)[secretName(name)];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};

export class Vault {
  /** Decrypted values kept in memory while the brain is awake: each AI call reads keys, and every storage read counts against the free plan's daily limit. */
  private mem = new Map<string, string | null>();

  constructor(
    private storage: DurableObjectStorage,
    private env: Env,
  ) {}

  async set(name: string, value: string): Promise<void> {
    this.mem.delete(name);
    if (!value) {
      await this.storage.delete(PREFIX + name);
      return;
    }
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await vaultKey(this.env, this.storage), new TextEncoder().encode(value));
    await this.storage.put(PREFIX + name, `${toB64(iv)}.${toB64(new Uint8Array(data))}`);
    this.mem.set(name, value);
  }

  async get(name: string): Promise<string | null> {
    if (this.mem.has(name)) return this.mem.get(name) ?? fromEnv(this.env, name);
    let stored: string | undefined;
    try {
      stored = await this.storage.get<string>(PREFIX + name);
    } catch {
      // Database unavailable: a Cloudflare secret can stand in (no secret = not available now).
      return fromEnv(this.env, name);
    }
    if (!stored) {
      this.mem.set(name, null);
      return fromEnv(this.env, name);
    }
    const [iv, data] = stored.split('.') as [string, string];
    try {
      const plain = new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, await vaultKey(this.env, this.storage), fromB64(data)));
      this.mem.set(name, plain);
      return plain;
    } catch {
      return null;
    }
  }

  async has(name: string): Promise<boolean> {
    if (fromEnv(this.env, name)) return true;
    if (this.mem.has(name)) return this.mem.get(name) !== null;
    return (await this.storage.get(PREFIX + name).catch(() => undefined)) !== undefined;
  }
}
