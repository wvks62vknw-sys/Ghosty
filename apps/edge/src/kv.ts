/**
 * Records that must outlive the database pause. Cloudflare's free plan gives the brain's
 * database a daily allowance (rows read/written); once it is used up every read and write
 * throws until midnight UTC. Cloudflare KV is free too and has its own, separate allowance,
 * so what matters most to the outside world — pages Ghosty published, jobs in flight — is
 * kept in BOTH: written to the database and to KV, and read from KV first (it receives every
 * write, including those made during a pause), with the database answering for records from
 * before KV existed. KV is never left behind the database: a KV write that fails after the
 * database took the record clears KV's older copy, and a removal during a pause leaves a
 * marker in KV until the database can take it.
 */
import type { Env } from './env';

/** Cloudflare's free-plan database allowance (rows read/written per day) in plain words, or null for other errors. */
export function storageError(e: unknown): string | null {
  const m = String((e as Error)?.message ?? e);
  if (!/rows (read|written)|exceeded allowed|free tier|storage (operation|quota)/i.test(m)) return null;
  return "Ghosty's database has used up Cloudflare's free daily allowance, so it is paused until it resets at midnight UTC (1am UK summer time). Nothing is lost. The heavy readers that caused this have been fixed; Workers Paid ($5/month) removes the limit.";
}

type KvEnv = Pick<Env, 'SITES'> | undefined;

/**
 * A record removed while the database was paused: KV keeps this marker in its place, so the
 * database's old copy is never served, and the first read after the reset finishes the removal.
 */
const GONE = { __gone: true };
const isGone = (v: unknown) => !!v && typeof v === 'object' && (v as { __gone?: unknown }).__gone === true;

/**
 * KV first when it is bound: every write reaches KV, including those made while the database
 * was paused, so KV is never behind. The database only answers for records written before KV
 * existed (and is the whole story when KV is not bound).
 */
export async function durableGet<T>(env: KvEnv, storage: DurableObjectStorage | undefined, key: string): Promise<T | undefined> {
  const kv = env?.SITES;
  if (kv) {
    const v = (await kv.get(key, 'json')) as T | null;
    if (isGone(v)) {
      // Removed during a pause: finish the removal now if the database is back, and say it is gone either way.
      if (storage) {
        try {
          await storage.delete(key);
          await kv.delete(key).catch(() => undefined);
        } catch {
          /* still paused: the marker stays until it works */
        }
      }
      return undefined;
    }
    if (v != null) return v;
  }
  if (!storage) return undefined;
  try {
    return await storage.get<T>(key);
  } catch (e) {
    if (!storageError(e) || !kv) throw e;
    return undefined;
  }
}

export async function durablePut(env: KvEnv, storage: DurableObjectStorage | undefined, key: string, value: unknown): Promise<void> {
  const kv = env?.SITES;
  let paused: unknown;
  if (storage) {
    try {
      await storage.put(key, value);
    } catch (e) {
      if (!storageError(e) || !kv) throw e;
      paused = e;
    }
  }
  if (!kv) {
    if (paused) throw paused;
    return;
  }
  try {
    await kv.put(key, JSON.stringify(value));
  } catch (e) {
    // KV refused (its own daily limit, a blip): the record is in the database, so it is kept and
    // served from there — once KV's older copy is out of the way, since reads look at KV first.
    // Only when the database refused too, or KV's old copy cannot be cleared, is the write lost.
    if (paused || !storage) throw e;
    try {
      await kv.delete(key);
    } catch {
      throw e;
    }
  }
}

/**
 * Remove a record from both places (a published page taken down). While the database is
 * paused its copy cannot go yet: KV keeps a "gone" marker instead, so the record is not served
 * from the database after the reset, and the first read then removes it for good.
 */
export async function durableDelete(env: KvEnv, storage: DurableObjectStorage | undefined, key: string): Promise<void> {
  const kv = env?.SITES;
  let paused: unknown;
  if (storage) {
    try {
      await storage.delete(key);
    } catch (e) {
      if (!storageError(e) || !kv) throw e;
      paused = e;
    }
  }
  if (!kv) return;
  if (paused) await kv.put(key, JSON.stringify(GONE));
  else await kv.delete(key);
}
