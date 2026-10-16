/**
 * Records that must outlive the database pause. Cloudflare's free plan gives the brain's
 * database a daily allowance (rows read/written); once it is used up every read and write
 * throws until midnight UTC. Cloudflare KV is free too and has its own, separate allowance,
 * so what matters most to the outside world — pages Ghosty published, jobs in flight — is
 * kept in BOTH: written to the database (immediately consistent) and to KV, read from the
 * database first and from KV when the database is paused, absent, or has no copy yet
 * (something written during a pause).
 */
import type { Env } from './env';

/** Cloudflare's free-plan database allowance (rows read/written per day) in plain words, or null for other errors. */
export function storageError(e: unknown): string | null {
  const m = String((e as Error)?.message ?? e);
  if (!/rows (read|written)|exceeded allowed|free tier|storage (operation|quota)/i.test(m)) return null;
  return "Ghosty's database has used up Cloudflare's free daily allowance, so it is paused until it resets at midnight UTC (1am UK summer time). Nothing is lost. The heavy readers that caused this have been fixed; Workers Paid ($5/month) removes the limit.";
}

type KvEnv = Pick<Env, 'SITES'> | undefined;

export async function durableGet<T>(env: KvEnv, storage: DurableObjectStorage | undefined, key: string): Promise<T | undefined> {
  const kv = env?.SITES;
  if (storage) {
    try {
      const v = await storage.get<T>(key);
      if (v !== undefined || !kv) return v;
    } catch (e) {
      if (!storageError(e) || !kv) throw e;
    }
  }
  if (!kv) return undefined;
  return ((await kv.get(key, 'json')) as T | null) ?? undefined;
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
  if (kv) await kv.put(key, JSON.stringify(value));
  else if (paused) throw paused;
}
