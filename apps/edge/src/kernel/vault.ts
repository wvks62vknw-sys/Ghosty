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
 *  - the same ciphertext (and the brain's own vault key) is mirrored in the VAULT KV namespace
 *    (wrangler.jsonc; free, its own allowance, not bound in previews): a key saved while the
 *    database is paused is written there at once, and a brain that restarts during the pause
 *    reads its keys from there — no device needed;
 *  - any key can also be a Cloudflare secret: <NAME>_KEY, <NAME>_API_KEY, <NAME>_TOKEN or <NAME>
 *    (GEMINI_KEY, GROQ_API_KEY, …; GITHUB_TOKEN for github);
 *  - the owner's device keeps an encrypted copy of every key (backup(), sealed with the owner
 *    key, which the brain never stores) and sends it with its requests (warm()); the brain uses
 *    it only when neither the database nor KV can answer;
 *  - a key saved while the database is paused is kept in memory, in KV and in that copy, and
 *    written to the database once it is back (flushDirty(), run by the brain itself on its
 *    next request or alarm — the names still waiting are kept in KV too).
 */
import type { Env } from '../env';

const PREFIX = 'vault:';
const OWN_KEY = 'vaultkey';
/** KV: the names saved while the database was paused, not yet written to it. */
const DIRTY_KEY = 'vault:dirty';
/** What the mirror holds for a key removed (so a removal made during a pause is not mistaken for "never mirrored"). */
const REMOVED = '-';
/** fromMirror(): the mirror has no entry for this name at all. */
const MISSING = Symbol('missing');
let cached: { raw: string; key: CryptoKey } | null = null;
/** Tests only: forget the brain's own vault key, as a restart in a fresh isolate would. */
export const _testing = { forgetVaultKey: () => void (cached = null) };

/** The VAULT KV namespace: what the vault needs of it. */
export interface VaultKv {
  get(key: string, type: 'text'): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

const kvOf = (env: Env): VaultKv | null => (env.VAULT as VaultKv | undefined) ?? null;

async function importRaw(raw: string): Promise<CryptoKey> {
  const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
  if (bytes.length !== 32) throw new Error('VAULT_KEY must be 32 random bytes encoded as base64');
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/**
 * The key that seals the vault. With no VAULT_KEY secret the brain's own key is read once per
 * lifetime: from memory, else the database, else the KV mirror (database paused), and made on
 * first use (then kept in both). The owner's keys are unreadable without it, so it never changes.
 */
async function vaultKey(env: Env, storage: DurableObjectStorage): Promise<CryptoKey> {
  let raw = env.VAULT_KEY;
  if (!raw) {
    if (cached) return cached.key;
    const kv = kvOf(env);
    let inDb = true;
    try {
      raw = await storage.get<string>(OWN_KEY);
    } catch (e) {
      inDb = false;
      raw = (kv && (await kv.get(OWN_KEY, 'text').catch(() => null))) || undefined;
      if (!raw) throw e; // the database is paused and KV has no copy yet: nothing can be sealed or opened
    }
    if (!raw) {
      raw = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
      await storage.put(OWN_KEY, raw);
    }
    // Keep the mirror current (a brain from before the mirror existed gets one now).
    if (inDb && kv) kv.put(OWN_KEY, raw).catch(() => undefined);
  }
  if (cached && cached.raw === raw) return cached.key;
  const key = await importRaw(raw);
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
  /** Keys saved while the database was paused (in memory, KV and the device's copy only). */
  private dirty = new Set<string>();
  /** Has the list of waiting names been taken from KV this lifetime? */
  private dirtyLoaded = false;
  /** After a failed flush (database still paused) the next try waits a few minutes. */
  private nextFlush = 0;
  private lastWarm = '';
  /** The device's copy: used only when neither the database nor KV can answer. */
  private copy: Backup | null = null;

  constructor(
    private storage: DurableObjectStorage,
    private env: Env,
  ) {}

  private get kv(): VaultKv | null {
    return kvOf(this.env);
  }

  /** Save a key. If the database is paused it is kept in memory, KV and the device's copy, and written later. */
  async set(name: string, value: string): Promise<void> {
    this.mem.set(name, value || null);
    try {
      await this.write(name, value);
      this.dirty.delete(name);
      await this.rememberDirty();
    } catch {
      this.dirty.add(name);
      await this.rememberDirty();
    }
  }

  /** Seal a value for storage ('iv.ct'); empty when there is nothing to keep. */
  private async seal(value: string): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await vaultKey(this.env, this.storage), new TextEncoder().encode(value));
    return `${toB64(iv)}.${toB64(new Uint8Array(data))}`;
  }

  private async open(sealed: string): Promise<string> {
    const [iv, data] = sealed.split('.') as [string, string];
    return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, await vaultKey(this.env, this.storage), fromB64(data)));
  }

  /** Write to the database and the KV mirror. Throws when the database refused (the mirror is still written). */
  private async write(name: string, value: string | null): Promise<void> {
    const sealed = value ? await this.seal(value) : '';
    const kv = this.kv;
    const mirror = kv ? kv.put(PREFIX + name, sealed || REMOVED).catch(() => undefined) : Promise.resolve();
    try {
      if (sealed) await this.storage.put(PREFIX + name, sealed);
      else await this.storage.delete(PREFIX + name);
    } finally {
      await mirror;
    }
  }

  /** The names still waiting for the database, kept in KV so a restart during the pause does not lose them. */
  private async rememberDirty(): Promise<void> {
    const kv = this.kv;
    if (!kv) return;
    try {
      if (this.dirty.size) await kv.put(DIRTY_KEY, JSON.stringify([...this.dirty]));
      else if (this.dirtyLoaded) await kv.delete(DIRTY_KEY);
    } catch {
      /* KV unavailable: the device's copy still carries the list */
    }
  }

  private async loadDirty(): Promise<void> {
    if (this.dirtyLoaded) return;
    this.dirtyLoaded = true;
    const kv = this.kv;
    if (!kv) return;
    try {
      const raw = await kv.get(DIRTY_KEY, 'text');
      if (!raw) return;
      const names = JSON.parse(raw) as unknown;
      if (Array.isArray(names)) for (const n of names) if (typeof n === 'string' && /^[a-z0-9_:-]{1,60}$/.test(n)) this.dirty.add(n);
    } catch {
      /* nothing waiting, or KV unavailable */
    }
  }

  /**
   * The mirror's value for a name: null when it was removed, MISSING when the mirror has no
   * entry at all (never mirrored, or no KV), undefined when it can't be read or opened right now.
   */
  private async fromMirror(name: string): Promise<string | null | undefined | typeof MISSING> {
    const kv = this.kv;
    if (!kv) return MISSING;
    let sealed: string | null;
    try {
      sealed = await kv.get(PREFIX + name, 'text');
    } catch {
      return undefined;
    }
    if (sealed === null || sealed === '') return MISSING;
    if (sealed === REMOVED) return null;
    try {
      return await this.open(sealed);
    } catch {
      return undefined; // the vault key is not reachable either
    }
  }

  /**
   * The vault's own value: memory, then the database, then the KV mirror, then the device's
   * copy; undefined when none of them can answer (database paused, nothing mirrored).
   */
  private async own(name: string): Promise<string | null | undefined> {
    if (this.mem.has(name)) return this.mem.get(name) ?? null;
    let stored: string | undefined;
    try {
      stored = await this.storage.get<string>(PREFIX + name);
    } catch {
      // Database unavailable: the KV mirror, then the device's copy, stand in.
      const mirrored = await this.fromMirror(name);
      if (typeof mirrored === 'string' || mirrored === null) {
        // Known from the mirror: the value, or that it was removed (the device's copy may be older).
        this.mem.set(name, mirrored);
        return mirrored;
      }
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
    try {
      const plain = await this.open(stored);
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

  /**
   * Like get(), but says when the answer is not known: undefined means the database is paused
   * and no copy of this key is reachable (so "not set" would be a guess).
   */
  async lookup(name: string): Promise<string | null | undefined> {
    const v = await this.own(name);
    const secret = fromEnv(this.env, name);
    if (secret) return secret;
    return v;
  }

  async has(name: string): Promise<boolean> {
    if (fromEnv(this.env, name)) return true;
    return !!(await this.own(name));
  }

  /** How many keys are waiting to be written to the database (saved while it was paused). */
  async waiting(): Promise<number> {
    await this.loadDirty();
    return this.dirty.size;
  }

  /**
   * The device's encrypted copy of every key in `names`. `complete` is false when some key
   * couldn't be read (database paused and not in memory or KV): the device then keeps its old copy.
   */
  async backup(ownerKey: string, names: string[]): Promise<{ backup: string; complete: boolean }> {
    await this.loadDirty();
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
   * Take the device's copy (sent with its requests). It stands in only when the database and
   * KV can't answer; keys saved while the database was paused are newer than the database, so
   * they are used now and written to it as soon as it is back.
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

  /**
   * Write keys saved while the database was paused. Returns how many are still waiting. Cheap
   * when nothing waits (one KV read per lifetime), so the brain runs it on every request; after
   * a failed try the automatic ones wait a few minutes (`force` tries regardless).
   */
  async flushDirty(force = false): Promise<number> {
    await this.loadDirty();
    if (!this.dirty.size) return 0;
    if (!force && Date.now() < this.nextFlush) return this.dirty.size;
    for (const n of [...this.dirty]) {
      // A name only KV knows about (the brain restarted during the pause): the mirror has the
      // value — newer than whatever the database holds, which is why the name is on the list.
      const v = this.mem.has(n) ? (this.mem.get(n) ?? null) : await this.fromMirror(n);
      if (v === undefined) continue; // the mirror can't be read right now: next time
      if (v === MISSING) {
        // Nothing to write: the mirror never took it (its write failed during the pause, and the
        // brain has restarted since). The database keeps what it had; the owner saves the key again.
        this.dirty.delete(n);
        continue;
      }
      this.mem.set(n, v);
      try {
        await this.write(n, v);
        this.dirty.delete(n);
      } catch {
        this.nextFlush = Date.now() + 5 * 60_000;
        break;
      }
    }
    await this.rememberDirty();
    return this.dirty.size;
  }
}
