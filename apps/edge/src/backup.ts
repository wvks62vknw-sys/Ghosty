/**
 * The phone's daily backup, kept in Cloudflare KV (the SITES namespace) for the owner.
 *
 * Safari wipes a site's storage after 7 days without use (and a new phone starts empty), so the
 * interface bundles what lives only on the device (courses, flashcards, chat, space plans,
 * settings…), encrypts it ON THE DEVICE with AES-GCM under a key made from the owner key
 * (PBKDF2, label "ghosty-device-backup" — separate from the vault's own copy in kernel/vault.ts),
 * and sends only the ciphertext here. The brain never opens it: it checks the envelope's shape
 * and size, keeps one copy per day under `backup:<YYYY-MM-DD>`, and keeps the newest 7.
 *
 * KV, not the database: backups must still be there while the database is paused, and KV takes
 * values up to 25 MiB. A list of the copies (`backup:index`) saves listing the namespace.
 */

/** What this needs of KV (the SITES binding has this shape). */
export interface BackupKv {
  get(key: string, type: 'json'): Promise<unknown>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

/** The sealed bundle as the device sends it. Every field but `v`/`iter`/`at` is base64. */
export interface SealedBackup {
  v: 1;
  kdf: 'PBKDF2-SHA256';
  iter: number;
  salt: string;
  iv: string;
  ct: string;
  /** When the device made it (ms). */
  at: number;
  /** 'gzip': the bundle was compressed before it was sealed. */
  z?: 'gzip';
}

export interface BackupInfo {
  /** The day it was kept (UTC), also its name. */
  id: string;
  at: number;
  /** Bytes as stored. */
  size: number;
}

export const BACKUP_PREFIX = 'backup:';
const INDEX = `${BACKUP_PREFIX}index`;
/** How many daily copies are kept. */
export const KEEP_BACKUPS = 7;
/** Cloudflare KV's limit for one value: 25 MiB. */
export const MAX_BACKUP_BYTES = 25 * 1024 * 1024;

export class BackupError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const B64 = /^[A-Za-z0-9+/]*={0,2}$/;
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
export const dayOf = (t: number) => new Date(t).toISOString().slice(0, 10);

/** The envelope's shape, checked without opening it (the brain has no way to read it). */
export function checkSealed(v: unknown): SealedBackup {
  const s = v as Partial<SealedBackup> | null;
  const ok =
    !!s && typeof s === 'object' && s.v === 1 && s.kdf === 'PBKDF2-SHA256' && Number.isInteger(s.iter) && s.iter! >= 100_000 && s.iter! <= 5_000_000 &&
    typeof s.salt === 'string' && s.salt.length >= 16 && s.salt.length <= 64 && B64.test(s.salt) &&
    typeof s.iv === 'string' && s.iv.length === 16 && B64.test(s.iv) &&
    typeof s.ct === 'string' && s.ct.length >= 24 && B64.test(s.ct) && (s.z === undefined || s.z === 'gzip');
  if (!ok) throw new BackupError('That is not an encrypted Ghosty backup, so it was not kept.');
  return { v: 1, kdf: 'PBKDF2-SHA256', iter: s.iter!, salt: s.salt!, iv: s.iv!, ct: s.ct!, at: Number(s.at) || Date.now(), ...(s.z ? { z: s.z } : {}) };
}

export async function listBackups(kv: BackupKv): Promise<BackupInfo[]> {
  const list = (await kv.get(INDEX, 'json').catch(() => null)) as BackupInfo[] | null;
  return Array.isArray(list) ? list.filter((b) => b && /^\d{4}-\d{2}-\d{2}$/.test(String(b.id))).sort((a, b) => (a.id < b.id ? 1 : -1)) : [];
}

/** Keep today's copy (replacing an earlier one from today) and drop all but the newest 7. */
export async function storeBackup(kv: BackupKv, text: string, now = Date.now()): Promise<{ backup: BackupInfo; removed: string[] }> {
  if (text.length > MAX_BACKUP_BYTES) throw new BackupError(`This backup is ${mb(text.length)}, but one backup can be at most 25 MB (Cloudflare's limit). Nothing was saved.`, 413);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BackupError('That is not an encrypted Ghosty backup, so it was not kept.');
  }
  const sealed = checkSealed(parsed);
  const value = JSON.stringify(sealed);
  if (value.length > MAX_BACKUP_BYTES) throw new BackupError(`This backup is ${mb(value.length)}, but one backup can be at most 25 MB (Cloudflare's limit). Nothing was saved.`, 413);
  const backup: BackupInfo = { id: dayOf(now), at: now, size: value.length };
  await kv.put(BACKUP_PREFIX + backup.id, value);
  const all = [backup, ...(await listBackups(kv)).filter((b) => b.id !== backup.id)].sort((a, b) => (a.id < b.id ? 1 : -1));
  const keep = all.slice(0, KEEP_BACKUPS);
  const removed = all.slice(KEEP_BACKUPS).map((b) => b.id);
  await kv.put(INDEX, JSON.stringify(keep));
  for (const id of removed) await kv.delete(BACKUP_PREFIX + id).catch(() => undefined);
  return { backup, removed };
}

export async function getBackup(kv: BackupKv, id: string): Promise<SealedBackup | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(id)) return null;
  const v = await kv.get(BACKUP_PREFIX + id, 'json');
  return v ? checkSealed(v) : null;
}

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

/**
 * /api/backup — GET: the copies kept (newest first); POST (the sealed envelope as JSON): keep it as
 * today's copy; GET /<day>: one sealed copy, for the device to open. Owner only (index.ts signs in first).
 */
export async function backupRoute(req: Request, path: string, method: string, deps: { kv: BackupKv | undefined }): Promise<Response> {
  const kv = deps.kv;
  if (!kv) return json({ error: 'Backups need the SITES KV namespace (wrangler.jsonc).' }, 503);
  try {
    if (path === '/backup' && method === 'GET') return json({ backups: await listBackups(kv), keep: KEEP_BACKUPS, max: MAX_BACKUP_BYTES });
    if (path === '/backup' && method === 'POST') {
      // Refused before reading when the phone says it is too big.
      const len = Number(req.headers.get('content-length'));
      if (len > MAX_BACKUP_BYTES + 4096) throw new BackupError(`This backup is ${mb(len)}, but one backup can be at most 25 MB (Cloudflare's limit). Nothing was saved.`, 413);
      return json(await storeBackup(kv, await req.text()));
    }
    const one = path.match(/^\/backup\/(\d{4}-\d{2}-\d{2})$/);
    if (one && method === 'GET') {
      const b = await getBackup(kv, one[1]!);
      return b ? json({ backup: b }) : json({ error: 'There is no backup from that day any more.' }, 404);
    }
    return json({ error: 'not found' }, 404);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, e instanceof BackupError ? e.status : 500);
  }
}
