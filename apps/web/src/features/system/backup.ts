/**
 * The phone's daily backup. Safari deletes a site's storage after 7 days without use, and a new
 * phone starts empty, so once a day (and on BACK UP NOW) this bundles everything that lives only
 * on this device into one JSON, seals it HERE with AES-GCM under a key made from the owner key
 * (PBKDF2-SHA256, label "ghosty-device-backup" — a different key from the vault copy's in
 * apps/edge/src/kernel/vault.ts), and sends only the sealed copy to the brain, which keeps the
 * newest 7 days in KV (apps/edge/src/backup.ts). RESTORE opens one on this phone and joins it with
 * what is here (merge.ts): the newer copy of each thing wins, nothing here is wiped.
 *
 * Left out: big things that come back by themselves — the offline brain's model, map tiles, the
 * vendored libraries, the copy of the brain's library, the last answers kept for offline reading —
 * and the owner key itself.
 */
import { brain, ownerKey, type BackupInfo, type SealedBackup } from '../../api/brain';
import { deviceOnlyDocs, restoreDoc, type LocalDoc, type LocalPassage } from '../../library/local';
import { mergeEntry, type MergeResult } from './merge';

/** What goes in, and what it is called in plain words. `whole`: kept as one piece (the phone's wins if it has one). */
export const BACKUP_KEYS: { key: string; label: string; whole?: boolean }[] = [
  { key: 'ghosty.learn', label: 'courses, lessons and flashcards' },
  { key: 'ghosty.chat', label: 'chat history' },
  { key: 'ghosty.offline', label: 'memory and agenda copy, and changes not sent yet' },
  { key: 'ghosty.widgets.local', label: 'widgets made on this phone' },
  { key: 'ghosty.space', label: 'space plan and measurements', whole: true },
  { key: 'ghosty.settings', label: 'settings', whole: true },
  { key: 'ghosty.offlinebrain', label: 'offline brain choice', whole: true },
  { key: 'ghosty.aim', label: 'AIM settings', whole: true },
  { key: 'ghosty.radio.favs', label: 'radio favourites' },
  { key: 'ghosty.vault.copy', label: "this phone's sealed copy of your keys", whole: true },
  { key: 'ghosty.scan.to', label: 'translation language', whole: true },
  { key: 'ghosty.lens.morenames', label: 'Lens naming choice', whole: true },
  { key: 'ghosty.spotify.clientId', label: 'Spotify app id', whole: true },
  { key: 'ghosty.inbox.seen', label: 'which notices you have seen', whole: true },
];

/** Kept on this phone, never backed up: when the last backup ran and how it went. */
const LAST = 'ghosty.backup.last';
/** Cloudflare KV's limit for one value (the brain refuses more). */
export const MAX_BYTES = 25 * 1024 * 1024;
const ITER = 600_000;
const LABEL = 'ghosty-device-backup';

export interface Bundle {
  v: 1;
  at: number;
  local: Record<string, string>;
  library: { doc: LocalDoc; passages: LocalPassage[] }[];
}

export interface LastBackup {
  at: number;
  ok: boolean;
  size?: number;
  error?: string;
}

export const lastBackup = {
  get(): LastBackup | null {
    try {
      return JSON.parse(localStorage.getItem(LAST) ?? 'null') as LastBackup | null;
    } catch {
      return null;
    }
  },
  set(v: LastBackup): void {
    try {
      localStorage.setItem(LAST, JSON.stringify(v));
    } catch {
      /* storage refused */
    }
  },
};

// ---------------------------------------------------------------------------------------
// Sealing: PBKDF2 → AES-GCM, base64 in a small JSON envelope.
// ---------------------------------------------------------------------------------------

const utf8 = new TextEncoder();
function toB64(u: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function sealKey(owner: string, salt: Uint8Array<ArrayBuffer>, iter: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', utf8.encode(`${LABEL}\n${owner}`), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function pipe(bytes: Uint8Array<ArrayBuffer>, t: GenericTransformStream): Promise<Uint8Array<ArrayBuffer>> {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(t as unknown as TransformStream<Uint8Array, Uint8Array>));
  return new Uint8Array(await out.arrayBuffer());
}
const canZip = () => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

export async function seal(bundle: Bundle, owner: string): Promise<SealedBackup> {
  const salt = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)));
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  let plain: Uint8Array<ArrayBuffer> = utf8.encode(JSON.stringify(bundle));
  const zip = canZip();
  if (zip) plain = await pipe(plain, new CompressionStream('gzip'));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: utf8.encode(`${LABEL} v1`) }, await sealKey(owner, salt, ITER), plain));
  return { v: 1, kdf: 'PBKDF2-SHA256', iter: ITER, salt: toB64(salt), iv: toB64(iv), ct: toB64(ct), at: bundle.at, ...(zip ? { z: 'gzip' as const } : {}) };
}

export async function open(s: SealedBackup, owner: string): Promise<Bundle> {
  let plain: Uint8Array<ArrayBuffer>;
  try {
    plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(s.iv), additionalData: utf8.encode(`${LABEL} v1`) }, await sealKey(owner, fromB64(s.salt), s.iter), fromB64(s.ct)));
  } catch {
    throw new Error('This backup was locked with a different owner key, so it cannot be opened with the one on this phone.');
  }
  if (s.z === 'gzip') {
    if (!canZip()) throw new Error('This browser is too old to open this backup (it cannot unpack it). Update iOS and try again.');
    plain = await pipe(plain, new DecompressionStream('gzip'));
  }
  const b = JSON.parse(new TextDecoder().decode(plain)) as Partial<Bundle>;
  return { v: 1, at: Number(b.at) || s.at, local: b.local && typeof b.local === 'object' ? b.local : {}, library: Array.isArray(b.library) ? b.library : [] };
}

// ---------------------------------------------------------------------------------------
// Bundling and putting back.
// ---------------------------------------------------------------------------------------

/** Everything that lives only on this phone, as one JSON. */
export async function collect(): Promise<Bundle> {
  const local: Record<string, string> = {};
  for (const { key } of BACKUP_KEYS) {
    try {
      let v = localStorage.getItem(key);
      if (v === null) continue;
      // The offline model's weights are not in the backup, so a restored phone must not think it has them.
      if (key === 'ghosty.offlinebrain') v = JSON.stringify({ ...(JSON.parse(v) as object), downloaded: false });
      local[key] = v;
    } catch {
      /* unreadable entry: left out */
    }
  }
  return { v: 1, at: Date.now(), local, library: await deviceOnlyDocs().catch(() => []) };
}

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
export const sizeText = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : mb(n));

/** Back up now: bundle, seal, send. Returns a short line for the owner; throws with plain words. */
export async function backUpNow(): Promise<string> {
  const owner = ownerKey.get();
  if (!owner) throw new Error('Backups are locked with your owner key, and this phone signed in another way. Pair it with the owner key to turn backups on.');
  try {
    const sealed = await seal(await collect(), owner);
    const size = JSON.stringify(sealed).length;
    if (size > MAX_BYTES) throw new Error(`This backup would be ${mb(size)}, but one backup can be at most 25 MB. Remove some documents kept only on this phone, then try again.`);
    const r = await brain.putBackup(sealed);
    lastBackup.set({ at: Date.now(), ok: true, size: r.backup.size });
    return `Backed up (${sizeText(r.backup.size)}, locked with your owner key). The brain keeps the last ${7} days.`;
  } catch (e) {
    const error = String((e as Error)?.message ?? e);
    lastBackup.set({ at: Date.now(), ok: false, error });
    throw new Error(/HTTP 404|not found/i.test(error) ? 'The brain cannot keep backups yet: it needs an update first.' : error);
  }
}

/** Once a day while Ghosty is open and paired: back up quietly. */
let running = false;
export async function autoBackup(now = Date.now()): Promise<void> {
  if (running || !ownerKey.get() || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
  const last = lastBackup.get();
  // A failed try waits 3 hours before the next; a good one, 20 hours (about a day, whenever Ghosty is opened).
  if (last && now - last.at < (last.ok ? 20 : 3) * 3_600_000) return;
  running = true;
  try {
    // No record of ever backing up here, yet the brain has backups: this phone was cleared (Safari's
    // 7 days) or is new. Backing up now would put an empty phone over the good copies, so the daily
    // backup waits until the owner restores one (SYSTEM → RESTORE) or presses BACK UP NOW.
    if (!last && (await listBackups()).length) return;
    await backUpNow();
  } catch {
    /* recorded in lastBackup; the SYSTEM tab shows it */
  } finally {
    running = false;
  }
}

export function listBackups(): Promise<BackupInfo[]> {
  return brain.backups().then((r) => r.backups);
}

export interface RestoreReport {
  restored: string[];
  merged: string[];
  same: string[];
  docs: number;
}

/** Open one backup and join it with what is on this phone. */
export async function restore(id: string): Promise<RestoreReport> {
  const owner = ownerKey.get();
  if (!owner) throw new Error('Backups open with your owner key: pair this phone with it first.');
  const { backup } = await brain.getBackup(id);
  const bundle = await open(backup, owner);
  const out: RestoreReport = { restored: [], merged: [], same: [], docs: 0 };
  for (const { key, label, whole } of BACKUP_KEYS) {
    const bak = bundle.local[key];
    if (typeof bak !== 'string') continue;
    let cur: string | null = null;
    try {
      cur = localStorage.getItem(key);
    } catch {
      /* unreadable: treated as empty */
    }
    const m: { text: string; result: MergeResult } = mergeEntry(cur, bak, whole);
    if (m.result !== 'same') {
      try {
        localStorage.setItem(key, m.text);
      } catch {
        continue; // storage full: this one stays as it was
      }
    }
    out[m.result].push(label);
  }
  for (const { doc, passages } of bundle.library) if (await restoreDoc(doc, Array.isArray(passages) ? passages : []).catch(() => false)) out.docs++;
  // Known again: the daily backup carries on (soon, with what was just put back).
  if (!lastBackup.get()) lastBackup.set({ at: 0, ok: true });
  return out;
}

/** The report in plain words. */
export function reportText(r: RestoreReport): string {
  const parts: string[] = [];
  if (r.restored.length) parts.push(`Put back: ${r.restored.join(', ')}.`);
  if (r.merged.length) parts.push(`Joined with what was here (newer wins): ${r.merged.join(', ')}.`);
  if (r.docs) parts.push(`${r.docs} document${r.docs === 1 ? '' : 's'} kept only on this phone put back in the library.`);
  if (!parts.length) parts.push('Everything in that backup was already on this phone.');
  return parts.join(' ');
}
