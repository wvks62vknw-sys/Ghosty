/**
 * The phone's daily backup. Safari deletes a site's storage after 7 days without use, and a new
 * phone starts empty, so once a day (and on BACK UP NOW) this bundles everything that lives only
 * on this device into one JSON, seals it HERE with AES-GCM under a key made from the owner key
 * (PBKDF2-SHA256, label "ghosty-device-backup" — a different key from the vault copy's in
 * apps/edge/src/kernel/vault.ts), and sends only the sealed copy to the brain, which keeps each
 * phone's newest 7 days in KV (apps/edge/src/backup.ts), under this phone's own random id. RESTORE
 * opens one on this phone and joins it with what is here (merge.ts): the newer copy of each thing
 * wins, nothing here is wiped. Then the page reloads at once, and nothing can save over it before.
 *
 * Left out: what the brain keeps itself (the conversation, memory and agenda, and the changes still
 * waiting to be sent to it — merge.ts NOT_RESTORED), big things that come back by themselves (the
 * offline brain's model, map tiles, the vendored libraries, the copy of the brain's library, the last
 * answers kept for offline reading), the owner key itself — and the faces this phone knows (the Lens's
 * PEOPLE: his own and the people he introduced, vision/facestore.ts), which never leave the phone at all,
 * not even sealed (and the voices it knows, assistant/voicestore.ts: his own and the people he introduced, a few hundred numbers
 * each, the same): only the keys listed below and the library's own documents are ever read here.
 */
import { brain, ownerKey, type BackupInfo, type SealedBackup } from '../../api/brain';
import { onFlushed } from '../../api/offline';
import { deviceLabel } from '../../assistant/push';
import { freezeStorage } from '../../core/store';
import { deviceOnlyDocs, restoreDoc, type LocalDoc, type LocalPassage } from '../../library/local';
import { afterTry, backupDue, backupTrusted, markDue, NOT_RESTORED, restoreEntry, type LastBackup, type MergeResult } from './merge';
import { rawText, sayError } from '../../ui/hisWords';
import type { Preset } from '../../photo/recipe';
import type { RecipeCopy } from '../../photo/store';
import type { Project } from '../../video/model';
import type { Book } from '../comic/store';
import type { Game } from '../../studio-game/model';

/** What goes in, and what it is called in plain words. `whole`: kept as one piece (the phone's wins if it has one). */
export const BACKUP_KEYS: { key: string; label: string; whole?: boolean }[] = [
  { key: 'ghosty.learn', label: 'courses, lessons and flashcards' },
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
  { key: 'ghosty.workspace', label: 'your workspace: pages, databases and their versions' },
  { key: 'ghosty.docs', label: 'your documents' },
  { key: 'ghosty.sheets', label: 'your spreadsheets' },
  { key: 'ghosty.slides', label: 'your slide decks' },
];

/** Kept on this phone, never backed up: when the last backup ran and how it went. */
const LAST = 'ghosty.backup.last';
/** Kept on this phone, never backed up: its own random name, so each phone's copies are kept apart. */
const DEVICE = 'ghosty.device';
/** Kept for the page after the reload: what the restore put back. */
const REPORT = 'ghosty.restore.report';
/** Cloudflare KV's limit for one value (the brain refuses more). */
export const MAX_BYTES = 25 * 1024 * 1024;
const ITER = 600_000;
const LABEL = 'ghosty-device-backup';

export interface Bundle {
  v: 1;
  at: number;
  local: Record<string, string>;
  library: { doc: LocalDoc; passages: LocalPassage[] }[];
  /** The photo editor's recipes and his own looks, and the video editor's projects: their JSON only, the photos and clips stay here (POLISH 3, 2d). */
  editors?: Editors;
}
export interface Editors {
  photos: RecipeCopy[];
  looks: Preset[];
  videos: Project[];
  /** (NEXT ROUND, polish3.c1) the comics he made, as their scripts (they draw again), and the games he made in THE GAME STUDIO. */
  comics?: { book: Book; made: unknown }[];
  games?: { game: Game; thumb: string; at: number }[];
}

/** What the photo and video editors keep in this phone's own database, read for the backup (each store loaded only now). */
async function editorsNow(): Promise<Editors> {
  const [ph, vd, comics, games] = await Promise.all([
    import('../../photo/store').then((m) => m.recipesForBackup()).catch(() => ({ recipes: [], looks: [] })),
    import('../../video/store').then((m) => m.projectsForBackup()).catch(() => [] as Project[]),
    comicsNow().catch(() => []),
    gamesNow().catch(() => []),
  ]);
  return { photos: ph.recipes, looks: ph.looks, videos: vd, comics, games };
}
/** The comics he made: the shelf's entry and the script that draws it again (imported and downloaded comics are pictures: too big). */
async function comicsNow(): Promise<{ book: Book; made: unknown }[]> {
  const c = await import('../comic/store');
  const mine = (await c.books()).filter((b) => b.from === 'made');
  const out: { book: Book; made: unknown }[] = [];
  for (const book of mine) {
    const made = await c.madeOf(book.id).catch(() => undefined);
    if (made !== undefined) out.push({ book, made });
  }
  return out;
}
/** The games he made in THE GAME STUDIO: each game whole (its rooms, its rules), with its small picture. */
async function gamesNow(): Promise<{ game: Game; thumb: string; at: number }[]> {
  const g = await import('../../studio-game/store');
  const out: { game: Game; thumb: string; at: number }[] = [];
  for (const m of await g.listGames()) {
    const game = await g.getGame(m.id).catch(() => null);
    if (game) out.push({ game, thumb: m.thumb, at: m.at });
  }
  return out;
}

export type { LastBackup };

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

/** This phone's own random name (made once, kept here). */
export function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE);
    if (id && /^[A-Za-z0-9_-]{8,64}$/.test(id)) return id;
    id = `d${Array.from(crypto.getRandomValues(new Uint8Array(9)), (b) => b.toString(16).padStart(2, '0')).join('')}`;
    localStorage.setItem(DEVICE, id);
    return id;
  } catch {
    return '';
  }
}

// Changes that waited for the brain have reached it: the next daily backup runs without waiting the day out.
onFlushed(() => {
  const due = markDue(lastBackup.get());
  if (due) lastBackup.set(due);
});

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
    if (!canZip()) throw new Error('This browser is too old to open this backup (it cannot unpack it); update iOS and try again.');
    plain = await pipe(plain, new DecompressionStream('gzip'));
  }
  const b = JSON.parse(new TextDecoder().decode(plain)) as Partial<Bundle>;
  const e = b.editors && typeof b.editors === 'object' ? b.editors : null;
  const editors: Editors | undefined = e ? { photos: Array.isArray(e.photos) ? e.photos : [], looks: Array.isArray(e.looks) ? e.looks : [], videos: Array.isArray(e.videos) ? e.videos : [], comics: Array.isArray(e.comics) ? e.comics : [], games: Array.isArray(e.games) ? e.games : [] } : undefined;
  return { v: 1, at: Number(b.at) || s.at, local: b.local && typeof b.local === 'object' ? b.local : {}, library: Array.isArray(b.library) ? b.library : [], ...(editors ? { editors } : {}) };
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
  const [library, editors] = await Promise.all([deviceOnlyDocs().catch(() => []), editorsNow()]);
  return { v: 1, at: Date.now(), local, library, editors };
}

/** The size a backup would be if it were made now: the bundle's words, as the sealed copy carries them (base64 makes it a third more). An estimate. */
export async function estimateSize(): Promise<number> {
  return Math.round(JSON.stringify(await collect()).length * 1.37);
}

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
export const sizeText = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : mb(n));

/** Back up now: bundle, seal, send. Returns a short line for the owner; throws with plain words. */
export async function backUpNow(): Promise<string> {
  const owner = ownerKey.get();
  if (!owner) throw new Error('Backups are locked with your owner key, and this phone signed in another way; pair it with the owner key to turn backups on.');
  try {
    const sealed = await seal(await collect(), owner);
    const size = JSON.stringify(sealed).length;
    if (size > MAX_BYTES) throw new Error(`This backup would be ${mb(size)}, but one backup can be at most 25 MB. Remove some documents kept only on this phone, then try again.`);
    const r = await brain.putBackup({ ...sealed, device: deviceId(), label: deviceLabel() });
    lastBackup.set(afterTry(lastBackup.get(), Date.now(), { ok: true, size: r.backup.size }));
    return `Backed up (${sizeText(r.backup.size)}, locked with your owner key); the brain keeps this phone's last ${7} days.`;
  } catch (e) {
    const raw = rawText(e);
    const error = sayError(e, 'back up');
    // A failure keeps what was known: it never switches off the wiped-phone guard below.
    lastBackup.set(afterTry(lastBackup.get(), Date.now(), { ok: false, error }));
    throw new Error(/HTTP 404|not found/i.test(raw) ? 'The brain cannot keep backups yet: it needs an update first.' : error);
  }
}

/** Once a day while Ghosty is open and paired: back up quietly. */
let running = false;
export async function autoBackup(now = Date.now()): Promise<void> {
  if (running || !ownerKey.get() || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
  running = true;
  try {
    // No good backup or restore here yet, but the brain has backups: this phone was cleared (Safari's
    // 7 days) or is new. Backing up now would put an empty phone over the good copies, so the daily
    // backup waits until the owner restores one (SYSTEM → RESTORE) or says so on BACK UP NOW (merge.ts backupDue).
    if (!(await backupDue(lastBackup.get(), now, async () => (await listBackups()).length > 0))) return;
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

/** Has this phone ever backed up or restored? If not, and the brain has copies, BACK UP NOW asks first. */
export const phoneTrusted = () => backupTrusted(lastBackup.get());

/** How a copy is named in the list: which phone, in plain words. */
export function backupName(b: BackupInfo): string {
  if (!b.device) return 'this phone (older format)';
  if (b.device === deviceId()) return 'this phone';
  return b.label || 'another device';
}

export interface RestoreReport {
  restored: string[];
  merged: string[];
  same: string[];
  /** In an older backup, but never put back (merge.ts NOT_RESTORED). */
  skipped: string[];
  docs: number;
  /** Photo edits, his own looks and video projects put back in this phone's own database. */
  photos: number;
  looks: number;
  videos: number;
  /** Photo edits in the backup whose photo is not on this phone (the photo itself is never in a backup). */
  photosAway: number;
  /** Comics he made and games he made, put back (NEXT ROUND, polish3.c1). */
  comics?: number;
  games?: number;
}

/**
 * Open one backup and join it with what is on this phone. Once it is written, nothing on this page
 * writes to localStorage again (core/store.ts freezeStorage): the caller reloads straight away.
 */
export async function restore(b: BackupInfo): Promise<RestoreReport> {
  if (!ownerKey.get()) throw new Error('Backups open with your owner key: pair this phone with it first.');
  const { backup } = await brain.getBackup(b);
  return restoreSealed(backup);
}

/** The same restore from a sealed copy in hand: the brain's, or a backup file he kept (NEXT ROUND, polish3.u5). */
export async function restoreSealed(backup: SealedBackup): Promise<RestoreReport> {
  const owner = ownerKey.get();
  if (!owner) throw new Error('Backups open with your owner key: pair this phone with it first.');
  const bundle = await open(backup, owner);
  const out: RestoreReport = { restored: [], merged: [], same: [], skipped: [], docs: 0, photos: 0, looks: 0, videos: 0, photosAway: 0 };
  // Older backups also carry entries that are never put back: they go through the same rule (restoreEntry).
  const entries: { key: string; label: string; whole?: boolean }[] = [...BACKUP_KEYS, ...Object.entries(NOT_RESTORED).map(([key, label]) => ({ key, label }))];
  // From here to freezeStorage() there is no await, so nothing else on the page runs in between.
  for (const { key, label, whole } of entries) {
    const bak = bundle.local[key];
    if (typeof bak !== 'string') continue;
    let cur: string | null = null;
    try {
      cur = localStorage.getItem(key);
    } catch {
      /* unreadable: treated as empty */
    }
    const m: { text: string; result: MergeResult } | null = restoreEntry(key, cur, bak, whole);
    if (!m) {
      out.skipped.push(label); // the brain's to keep (merge.ts NOT_RESTORED): the phone's stays as it is
      continue;
    }
    if (m.result !== 'same') {
      try {
        localStorage.setItem(key, m.text);
      } catch {
        continue; // storage full: this one stays as it was
      }
    }
    out[m.result].push(label);
  }
  // Known again: the daily backup carries on, soon, with what was just put back.
  const prev = lastBackup.get();
  lastBackup.set({ ...(prev ?? { at: 0, ok: true }), known: true, due: true });
  freezeStorage();
  for (const { doc, passages } of bundle.library) if (await restoreDoc(doc, Array.isArray(passages) ? passages : []).catch(() => false)) out.docs++;
  await restoreEditors(bundle.editors, out);
  return out;
}

/** The editors' part of a restore: each put back only where it is newer than this phone's, nothing here wiped (the same rule as the rest). */
export async function restoreEditors(e: Editors | undefined, out: RestoreReport): Promise<void> {
  if (!e) return;
  if (e.photos.length || e.looks.length) {
    const ph = await import('../../photo/store').catch(() => null);
    if (ph) {
      for (const c of e.photos) {
        const r = await ph.restoreRecipe(c).catch(() => 'same' as const);
        if (r === 'kept') out.photos++;
        else if (r === 'nophoto') out.photosAway++;
      }
      for (const l of e.looks) if (await ph.restoreLook(l).catch(() => false)) out.looks++;
    }
  }
  if (e.videos.length) {
    const vd = await import('../../video/store').catch(() => null);
    if (vd) for (const p of e.videos) if ((await vd.restoreProject(p).catch(() => 'same' as const)) === 'kept') out.videos++;
  }
  // a comic he made comes back when this phone has none by its id; a game when it has none, or an older one (the newer wins)
  if (e.comics?.length) {
    const c = await import('../comic/store').catch(() => null);
    if (c) for (const x of e.comics) {
      if (!x?.book?.id || (await c.bookOf(x.book.id).catch(() => undefined))) continue;
      try {
        await c.updateBook(x.book);
        await c.keepMade(x.book.id, x.made);
        out.comics = (out.comics ?? 0) + 1;
      } catch {
        /* this one stays out: the rest go on */
      }
    }
  }
  if (e.games?.length) {
    const g = await import('../../studio-game/store').catch(() => null);
    if (g) {
      const here = new Map((await g.listGames().catch(() => [])).map((m) => [m.id, m.at]));
      for (const x of e.games) {
        if (!x?.game?.id || (here.get(x.game.id) ?? 0) >= x.at) continue;
        if ((await g.putGame(x.game, x.thumb).catch(() => ({ kept: false }))).kept) out.games = (out.games ?? 0) + 1;
      }
    }
  }
}

/** Restore, then reload at once; the report is shown again after the reload (takeRestoreReport). */
export async function restoreAndReload(b: BackupInfo | SealedBackup): Promise<string> {
  const text = reportText('ct' in b ? await restoreSealed(b) : await restore(b));
  try {
    sessionStorage.setItem(REPORT, text);
  } catch {
    /* not kept: the reload still happens */
  }
  location.reload();
  return text;
}

/** What the last restore put back, once, after its reload. */
export function takeRestoreReport(): string | null {
  try {
    const t = sessionStorage.getItem(REPORT);
    if (t !== null) sessionStorage.removeItem(REPORT);
    return t;
  } catch {
    return null;
  }
}

/** The report in plain words. */
export function reportText(r: RestoreReport): string {
  const parts: string[] = [];
  if (r.restored.length) parts.push(`Put back: ${r.restored.join(', ')}.`);
  if (r.merged.length) parts.push(`Joined with what was here (newer wins): ${r.merged.join(', ')}.`);
  if (r.docs) parts.push(`${r.docs} document${r.docs === 1 ? '' : 's'} kept only on this phone put back in the library.`);
  const n = (k: number, one: string) => `${k} ${one}${k === 1 ? '' : 's'}`;
  const ed = [r.photos ? n(r.photos, 'photo edit') : '', r.looks ? `${r.looks} ${r.looks === 1 ? 'look' : 'looks'} of your own` : '', r.videos ? n(r.videos, 'video project') : '', r.comics ? `${r.comics} ${r.comics === 1 ? 'comic' : 'comics'} you made` : '', r.games ? `${r.games} ${r.games === 1 ? 'game' : 'games'} you made` : ''].filter(Boolean);
  if (ed.length) parts.push(`Put back in the editors: ${ed.join(', ')}.`);
  if (r.photosAway) parts.push(`${n(r.photosAway, 'photo edit')} waiting for ${r.photosAway === 1 ? 'its photo' : 'their photos'}: the photos themselves stay on the phone they were taken on.`);
  if (!parts.length) parts.push('Everything in that backup was already on this phone.');
  if (r.skipped.length) parts.push(`Not taken from the backup: ${r.skipped.join(', ')}.`);
  return parts.join(' ');
}

// ---------------------------------------------------------------------------------------
// A backup kept as a file (NEXT ROUND, polish3.u5): the same locked copy, saved where he chooses (Files, iCloud Drive), so it
// never depends only on the brain. It opens only with his owner key, on any phone of his.
// ---------------------------------------------------------------------------------------

export const BACKUP_FILE_KIND = 'ghosty-backup';
export interface BackupFile {
  kind: typeof BACKUP_FILE_KIND;
  v: 1;
  /** Which phone it came from, in words, and when. */
  label: string;
  at: number;
  sealed: SealedBackup;
}

/** The file's name: the day, so a folder of them sorts by date. */
export const backupFileName = (at: number): string => `ghosty-backup-${new Date(at).toISOString().slice(0, 10)}.json`;

/** Make the file now: everything that lives only on this phone, locked with the owner key here. */
export async function backupFile(): Promise<{ name: string; blob: Blob; size: number }> {
  const owner = ownerKey.get();
  if (!owner) throw new Error('Backup files are locked with your owner key; pair this phone with it first.');
  const sealed = await seal(await collect(), owner);
  const doc: BackupFile = { kind: BACKUP_FILE_KIND, v: 1, label: deviceLabel(), at: sealed.at, sealed };
  const blob = new Blob([JSON.stringify(doc)], { type: 'application/json' });
  return { name: backupFileName(sealed.at), blob, size: blob.size };
}

/** A picked file read back: the sealed copy inside it, or why it is not one of his backups. Pure. */
export function readBackupFile(text: string): { ok: true; file: BackupFile } | { ok: false; why: string } {
  let d: unknown;
  try {
    d = JSON.parse(text);
  } catch {
    return { ok: false, why: 'That file isn’t one of my backups: it isn’t the file BACKUP saves.' };
  }
  const f = d as Partial<BackupFile> | null;
  const s = f?.sealed as Partial<SealedBackup> | undefined;
  if (!f || f.kind !== BACKUP_FILE_KIND || !s || typeof s.ct !== 'string' || typeof s.iv !== 'string' || typeof s.salt !== 'string') return { ok: false, why: 'That file isn’t one of my backups: it isn’t the file BACKUP saves.' };
  return { ok: true, file: { kind: BACKUP_FILE_KIND, v: 1, label: typeof f.label === 'string' ? f.label : 'a phone', at: Number(f.at) || Number(s.at) || 0, sealed: s as SealedBackup } };
}
