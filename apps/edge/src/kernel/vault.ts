/**
 * KERNEL — protected.
 *
 * Encrypted storage for API keys and tokens. Values are encrypted with AES-GCM before
 * they are written to Durable Object storage, and they are never sent back to the
 * interface (only "set / not set"). The key is the VAULT_KEY secret if one is set;
 * otherwise the brain makes a random key once and keeps it in its own storage.
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

export class Vault {
  constructor(
    private storage: DurableObjectStorage,
    private env: Env,
  ) {}

  async set(name: string, value: string): Promise<void> {
    if (!value) {
      await this.storage.delete(PREFIX + name);
      return;
    }
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await vaultKey(this.env, this.storage), new TextEncoder().encode(value));
    await this.storage.put(PREFIX + name, `${toB64(iv)}.${toB64(new Uint8Array(data))}`);
  }

  async get(name: string): Promise<string | null> {
    const stored = await this.storage.get<string>(PREFIX + name);
    if (!stored) return null;
    const [iv, data] = stored.split('.') as [string, string];
    try {
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, await vaultKey(this.env, this.storage), fromB64(data));
      return new TextDecoder().decode(plain);
    } catch {
      return null;
    }
  }

  async has(name: string): Promise<boolean> {
    return (await this.storage.get(PREFIX + name)) !== undefined;
  }
}
