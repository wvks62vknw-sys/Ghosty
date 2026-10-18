/**
 * The phone's daily backup, kept in Cloudflare KV (the SITES namespace) for the owner.
 *
 * Safari wipes a site's storage after 7 days without use (and a new phone starts empty), so the
 * interface bundles what lives only on the device (courses, flashcards, chat, space plans,
 * settings…), encrypts it ON THE DEVICE with AES-GCM under a key made from the owner key
 * (PBKDF2, label "ghosty-device-backup" — separate from the vault's own copy in kernel/vault.ts),
 * and sends only the ciphertext here. The brain never opens it: it checks the envelope's shape
 * and size, keeps one copy per phone per day under `backup:<device>:<YYYY-MM-DD>` (the device id is
 * a random name the phone made for itself, sent with the upload), and keeps each phone's newest 7.
 * Copies kept before phones had a name (`backup:<YYYY-MM-DD>`) are still listed and opened.
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
  /** Its name: `<device>:<day>`, or just `<day>` for a copy kept in the older format. */
  id: string;
  /** The day it was kept (UTC). */
  day: string;
  /** The phone's own random id ('' for the older format, which had none). */
  device: string;
  /** What the phone calls itself ("iPhone"), shown in the list. */
  label?: string;
  at: number;
  /** Bytes as stored. */
  size: number;
}

export const BACKUP_PREFIX = 'backup:';
const INDEX = `${BACKUP_PREFIX}index`;
/** How many daily copies are kept for each phone. */
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
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DEVICE = /^[A-Za-z0-9_-]{8,64}$/;
/** At most this many copies in all (a guard against many phones, or a phone that keeps renaming itself). */
const MAX_ENTRIES = 60;

/** A phone's id as it came, or '' when it sent none; anything else is refused. */
export function deviceOf(v: unknown): string {
  if (v === undefined || v === null || v === '') return '';
  if (typeof v !== 'string' || !DEVICE.test(v)) throw new BackupError('That backup did not say which phone it came from in a way Ghosty understands, so it was not kept.');
  return v;
}
/** What the phone calls itself, cut down to plain letters, numbers and a few signs. */
export const labelOf = (v: unknown): string => (typeof v === 'string' ? v.replace(/[^\w .,()'·-]/g, '').trim().slice(0, 40) : '');
const idOf = (device: string, day: string) => (device ? `${device}:${day}` : day);

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
  const list = (await kv.get(INDEX, 'json').catch(() => null)) as Partial<BackupInfo>[] | null;
  if (!Array.isArray(list)) return [];
  const out: BackupInfo[] = [];
  for (const b of list) {
    if (!b || typeof b.id !== 'string') continue;
    // An entry from before phones had names: its id is its day.
    const day = typeof b.day === 'string' ? b.day : b.id;
    const device = typeof b.device === 'string' ? b.device : '';
    if (!DAY.test(day) || (device && !DEVICE.test(device)) || b.id !== idOf(device, day)) continue;
    const label = labelOf(b.label);
    out.push({ id: b.id, day, device, ...(label ? { label } : {}), at: Number(b.at) || 0, size: Number(b.size) || 0 });
  }
  return out.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : b.at - a.at));
}

/** Keep today's copy for this phone (replacing its earlier one from today) and drop all but each phone's newest 7. */
export async function storeBackup(kv: BackupKv, text: string, now = Date.now()): Promise<{ backup: BackupInfo; removed: string[] }> {
  if (text.length > MAX_BACKUP_BYTES) throw new BackupError(`This backup is ${mb(text.length)}, but one backup can be at most 25 MB (Cloudflare's limit). Nothing was saved.`, 413);
  let parsed: { device?: unknown; label?: unknown } | null;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BackupError('That is not an encrypted Ghosty backup, so it was not kept.');
  }
  const sealed = checkSealed(parsed);
  const device = deviceOf(parsed?.device);
  const label = labelOf(parsed?.label);
  const value = JSON.stringify(sealed);
  if (value.length > MAX_BACKUP_BYTES) throw new BackupError(`This backup is ${mb(value.length)}, but one backup can be at most 25 MB (Cloudflare's limit). Nothing was saved.`, 413);
  const day = dayOf(now);
  const backup: BackupInfo = { id: idOf(device, day), day, device, ...(label ? { label } : {}), at: now, size: value.length };
  await kv.put(BACKUP_PREFIX + backup.id, value);
  const all = [backup, ...(await listBackups(kv)).filter((b) => b.id !== backup.id)].sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : b.at - a.at));
  const perDevice = new Map<string, number>();
  const keep: BackupInfo[] = [];
  const removed: string[] = [];
  for (const b of all) {
    const n = perDevice.get(b.device) ?? 0;
    perDevice.set(b.device, n + 1);
    if (n < KEEP_BACKUPS && keep.length < MAX_ENTRIES) keep.push(b);
    else removed.push(b.id);
  }
  await kv.put(INDEX, JSON.stringify(keep));
  for (const id of removed) await kv.delete(BACKUP_PREFIX + id).catch(() => undefined);
  return { backup, removed };
}

/** One copy by its name: `<device>:<day>`, or `<day>` for the older format. */
export async function getBackup(kv: BackupKv, id: string): Promise<SealedBackup | null> {
  const parts = id.split(':');
  const [device, day] = parts.length === 2 ? parts : ['', id];
  if (parts.length > 2 || !DAY.test(day ?? '') || (device && !DEVICE.test(device))) return null;
  const v = await kv.get(BACKUP_PREFIX + id, 'json');
  return v ? checkSealed(v) : null;
}

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

/**
 * /api/backup — GET: the copies kept (newest first); POST (the sealed envelope as JSON, with the
 * phone's `device` id and `label`): keep it as that phone's copy for today; GET /<device>/<day> (or
 * /<day> for the older format): one sealed copy, for the device to open. Owner only (index.ts signs in first).
 */
export async function backupRoute(req: Request, path: string, method: string, deps: { kv: BackupKv | undefined }): Promise<Response> {
  const kv = deps.kv;
  // 501, not 503: the phone reads a 503 as "signed out".
  if (!kv) return json({ error: 'Backups are not set up on this brain yet: it needs its SITES storage (KV namespace) connected in wrangler.jsonc.' }, 501);
  try {
    if (path === '/backup' && method === 'GET') return json({ backups: await listBackups(kv), keep: KEEP_BACKUPS, max: MAX_BACKUP_BYTES });
    if (path === '/backup' && method === 'POST') {
      // Refused before reading when the phone says it is too big.
      const len = Number(req.headers.get('content-length'));
      if (len > MAX_BACKUP_BYTES + 4096) throw new BackupError(`This backup is ${mb(len)}, but one backup can be at most 25 MB (Cloudflare's limit). Nothing was saved.`, 413);
      return json(await storeBackup(kv, await req.text()));
    }
    const one = path.match(/^\/backup\/(?:([A-Za-z0-9_-]{8,64})\/)?(\d{4}-\d{2}-\d{2})$/);
    if (one && method === 'GET') {
      const b = await getBackup(kv, idOf(one[1] ?? '', one[2]!));
      return b ? json({ backup: b }) : json({ error: 'There is no backup from that day any more.' }, 404);
    }
    return json({ error: 'not found' }, 404);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, e instanceof BackupError ? e.status : 500);
  }
}
