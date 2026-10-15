/**
 * KERNEL — protected.
 *
 * Encrypted storage for API keys and tokens. Values are encrypted with AES-GCM before
 * they are written to Durable Object storage, and they are never sent back to the
 * interface (only "set / not set"). The key is the VAULT_KEY secret if one is set;
 * otherwise the brain makes a random key once and keeps it in its own storage.
 *
 * Backups, so keys keep working when the database is unavailable (e.g. the free plan's daily
 * allowance is used up):
 *  - any key can also be a Cloudflare secret: <NAME>_KEY, <NAME>_API_KEY, <NAME>_TOKEN or <NAME>
 *    (GEMINI_KEY, GROQ_API_KEY, …; GITHUB_TOKEN for github);
 *  - the owner's device keeps an encrypted copy of every key (backup(), sealed with the owner
 *    key, which the brain never stores) and sends it with its requests (warm()); the brain uses
 *    it only when the database can't be read, so a key given once is used from then on, paused
 *    or not;
 *  - a key saved while the database is paused is kept in memory and in that copy, and written
 *    to the database once it is back (flushDirty()).
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

/** The Cloudflare secret that can stand in for a vault entry (the first name it looks for). */
export const secretName = (name: string) => (name === 'github' ? 'GITHUB_TOKEN' : `${name.toUpperCase()}_KEY`);
const EXTRA_NAMES: Record<string, string[]> = { gemini: ['GOOGLE_API_KEY', 'GOOGLE_AI_KEY', 'GOOGLE_AI_STUDIO_KEY'], github: ['GITHUB_KEY', 'GH_TOKEN', 'GITHUB_PAT'], openrouter: ['OPEN_ROUTER_KEY', 'OPEN_ROUTER_API_KEY'], tomtom: ['TOM_TOM_KEY', 'TOMTOM_API'], aisstream: ['AIS_STREAM_KEY', 'AIS_KEY'], email: ['EMAIL_LOGIN', 'EMAIL_ACCOUNT'] };
/** Every secret name that counts for a key, in the order they are tried. */
export function secretNames(name: string): string[] {
  const n = name.toUpperCase();
  return [secretName(name), `${n}_API_KEY`, `${n}_TOKEN`, `${n}APIKEY`, `${n}_SECRET`, n, ...(EXTRA_NAMES[name] ?? [])].filter((x, i, a) => a.indexOf(x) === i);
}
const fromEnv = (env: Env, name: string): string | null => {
  for (const s of secretNames(name)) {
    const v = (env as unknown as Record<string, unknown>)[s];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
};

// The device's copy: AES-GCM with a key made from the owner key (never stored by the brain).
async function ownerSeal(ownerKey: string): Promise<CryptoKey> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`ghosty-vault-backup\n${ownerKey}`));
  return crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export interface Backup {
  /** Every key the brain knows about: its value, or null when it isn't set. */
  entries: Record<string, string | null>;
  /** Keys changed while the database was paused, not yet written to it. */
  dirty: string[];
  at: number;
}
export async function sealBackup(ownerKey: string, b: Backup): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await ownerSeal(ownerKey), new TextEncoder().encode(JSON.stringify(b)));
  return `${toB64(iv)}.${toB64(new Uint8Array(data))}`;
}
export async function openBackup(ownerKey: string, sealed: string): Promise<Backup> {
  const [iv, data] = sealed.split('.') as [string, string];
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv ?? '') }, await ownerSeal(ownerKey), fromB64(data ?? ''));
  const b = JSON.parse(new TextDecoder().decode(plain)) as Partial<Backup>;
  const entries: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(b.entries ?? {})) if (/^[a-z0-9_-]{1,40}$/.test(k)) entries[k] = typeof v === 'string' ? v : null;
  return { entries, dirty: (Array.isArray(b.dirty) ? b.dirty : []).filter((d): d is string => typeof d === 'string' && d in entries), at: Number(b.at) || 0 };
}

export class Vault {
  /** Decrypted values kept in memory while the brain is awake: each AI call reads keys, and every storage read counts against the free plan's daily limit. */
  private mem = new Map<string, string | null>();
  /** Keys saved while the database was paused (in memory and the device's copy only). */
  private dirty = new Set<string>();
  private lastWarm = '';
  /** The device's copy: used only when the database can't be read. */
  private copy: Backup | null = null;

  constructor(
    private storage: DurableObjectStorage,
    private env: Env,
  ) {}

  /** Save a key. If the database is paused it is kept in memory (and the device's copy) and written later. */
  async set(name: string, value: string): Promise<void> {
    this.mem.set(name, value || null);
    try {
      await this.write(name, value);
      this.dirty.delete(name);
    } catch {
      this.dirty.add(name);
    }
  }

  private async write(name: string, value: string | null): Promise<void> {
    if (!value) {
      await this.storage.delete(PREFIX + name);
      return;
    }
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await vaultKey(this.env, this.storage), new TextEncoder().encode(value));
    await this.storage.put(PREFIX + name, `${toB64(iv)}.${toB64(new Uint8Array(data))}`);
  }

  /** The vault's own value (memory, then the database); undefined when the database can't be read. */
  private async own(name: string): Promise<string | null | undefined> {
    if (this.mem.has(name)) return this.mem.get(name) ?? null;
    let stored: string | undefined;
    try {
      stored = await this.storage.get<string>(PREFIX + name);
    } catch {
      // Database unavailable: the device's copy stands in.
      if (this.copy && name in this.copy.entries) {
        const v = this.copy.entries[name] ?? null;
        this.mem.set(name, v);
        return v;
      }
      return undefined;
    }
    if (!stored) {
      this.mem.set(name, null);
      return null;
    }
    const [iv, data] = stored.split('.') as [string, string];
    try {
      const plain = new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, await vaultKey(this.env, this.storage), fromB64(data)));
      this.mem.set(name, plain);
      return plain;
    } catch {
      return undefined;
    }
  }

  async get(name: string): Promise<string | null> {
    // Database unavailable or nothing saved: a Cloudflare secret can stand in.
    return (await this.own(name)) || fromEnv(this.env, name);
  }

  async has(name: string): Promise<boolean> {
    if (fromEnv(this.env, name)) return true;
    return !!(await this.own(name));
  }

  /**
   * The device's encrypted copy of every key in `names`. `complete` is false when some key
   * couldn't be read (database paused and not in memory): the device then keeps its old copy.
   */
  async backup(ownerKey: string, names: string[]): Promise<{ backup: string; complete: boolean }> {
    const entries: Record<string, string | null> = {};
    let complete = true;
    for (const n of names) {
      const v = await this.own(n);
      if (v === undefined) complete = false;
      else entries[n] = v;
    }
    return { backup: await sealBackup(ownerKey, { entries, dirty: [...this.dirty].filter((d) => d in entries), at: Date.now() }), complete };
  }

  /**
   * Take the device's copy (sent with its requests). It stands in only when the database can't
   * be read; keys saved while it was paused are newer than the database, so they are used now
   * and written to it as soon as it is back.
   */
  async warm(ownerKey: string, sealed: string): Promise<boolean> {
    if (sealed === this.lastWarm) return true;
    let b: Backup;
    try {
      b = await openBackup(ownerKey, sealed);
    } catch {
      return false; // not ours, or an old owner key
    }
    this.lastWarm = sealed;
    this.copy = b;
    for (const n of b.dirty) {
      if (this.dirty.has(n)) continue;
      this.mem.set(n, b.entries[n] ?? null);
      this.dirty.add(n);
    }
    return true;
  }

  /** Write keys saved while the database was paused. Returns how many are still waiting. */
  async flushDirty(): Promise<number> {
    for (const n of [...this.dirty]) {
      try {
        await this.write(n, this.mem.get(n) ?? null);
        this.dirty.delete(n);
      } catch {
        break;
      }
    }
    return this.dirty.size;
  }
}
