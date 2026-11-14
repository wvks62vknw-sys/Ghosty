/**
 * JOURNAL's store (APPS ROUND, MEMORY lane): HIS own writing, kept on this phone. The entries and journals in `ghosty.journal` (and so in
 * the encrypted backup, BACKUP_KEYS); each photo's full picture and each voice note in IndexedDB (`ghosty-journal`), a small copy of
 * each photo in the entry so the backup brings the look of it back. Nothing here is sent anywhere: the brain never reads it, and a
 * place is a saved place's name or the one he types, never a position.
 */

export type Mood = 1 | 2 | 3 | 4 | 5;
export type Tone = 'accent' | 'amber' | 'green' | 'pink' | 'violet';

export interface Journal {
  id: string;
  name: string;
  tone: Tone;
}

export interface Entry {
  id: string;
  journal: string;
  /** When it is about (ms): today, or the day he moved it to. */
  at: number;
  text: string;
  mood?: Mood;
  /** A saved place's name, or what he typed. Never a position. */
  place?: string;
  /** Photos: each an id in IndexedDB and a small copy (data URL) for the list and the backup. */
  photos: { id: string; thumb: string }[];
  /** A voice note: its id in IndexedDB and its length; `text` when he typed what it said. */
  voice?: { id: string; secs: number };
  /** The prompt he answered, when he took one. */
  prompt?: string;
  /** A first-run example (CLEAR SAMPLES takes them all away). */
  sample?: boolean;
  /** In Recently deleted since (ms): gone for good after 30 days. */
  deleted?: number;
  /** Last changed (ms). */
  edited: number;
  /** Earlier wordings, newest last (version history), at most 10. */
  versions?: { at: number; text: string }[];
}

export interface JournalPrefs {
  /** The lock is on: a passkey (Face ID / Touch ID) opens the journal. */
  lock: boolean;
  /** The passkey's id (base64url), made on this phone. */
  cred?: string;
  /** The gentle nudge: "HH:MM", '' for none; the brain's reminder id that holds it. */
  remind: string;
  remindId?: string;
  /** The three-step tour was seen; the samples were cleared. */
  toured: boolean;
  samplesGone: boolean;
}

export interface JournalData {
  journals: Journal[];
  entries: Entry[];
  prefs: JournalPrefs;
}

export const KEY = 'ghosty.journal';
const DAY = 86_400_000;
const BIN_DAYS = 30;

export const DEFAULT_JOURNALS: Journal[] = [{ id: 'personal', name: 'Personal', tone: 'accent' }];
const blank = (): JournalData => ({ journals: [...DEFAULT_JOURNALS], entries: [], prefs: { lock: false, remind: '', toured: false, samplesGone: false } });

const uid = (): string => `j${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
export const newId = uid;

/** Everything, as kept (what has been in Recently deleted for 30 days is let go as it is read). */
export function load(): JournalData {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<JournalData> | null;
    if (!v || !Array.isArray(v.entries)) return blank();
    const now = Date.now();
    return {
      journals: Array.isArray(v.journals) && v.journals.length ? v.journals : [...DEFAULT_JOURNALS],
      entries: v.entries.filter((e) => e && typeof e.id === 'string' && (!e.deleted || now - e.deleted < BIN_DAYS * DAY)).map((e) => ({ ...e, photos: Array.isArray(e.photos) ? e.photos : [] })),
      prefs: { ...blank().prefs, ...(v.prefs ?? {}) },
    };
  } catch {
    return blank();
  }
}

/** Kept: true, or false when the phone has no room (the screen says so; nothing is lost from what is open). */
export function save(d: JournalData): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
    return true;
  } catch {
    return false;
  }
}

/** The live entries (not in the bin), newest first. */
export const live = (d: JournalData): Entry[] => d.entries.filter((e) => !e.deleted).sort((a, b) => b.at - a.at);
export const binned = (d: JournalData): Entry[] => d.entries.filter((e) => !!e.deleted).sort((a, b) => (b.deleted ?? 0) - (a.deleted ?? 0));

// ---------------------------------------------------------------- the days

const ymd = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const dayKey = ymd;

/** The run of days in a row with an entry, ending today (or yesterday, so a streak is not lost before tonight's entry). */
export function streak(entries: Entry[], now = Date.now()): number {
  const days = new Set(entries.filter((e) => !e.deleted && !e.sample).map((e) => ymd(e.at)));
  const d = new Date(now);
  if (!days.has(ymd(d.getTime()))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(ymd(d.getTime()))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

/** On this day: entries from this date in earlier years, and a month ago, a week ago (newest first). */
export function onThisDay(entries: Entry[], now = Date.now()): { label: string; entries: Entry[] }[] {
  const t = new Date(now);
  const out: { label: string; entries: Entry[] }[] = [];
  const at = (d: Date) => entries.filter((e) => !e.deleted && ymd(e.at) === ymd(d.getTime()));
  const week = new Date(t);
  week.setDate(t.getDate() - 7);
  if (at(week).length) out.push({ label: 'A week ago', entries: at(week) });
  const month = new Date(t.getFullYear(), t.getMonth() - 1, t.getDate());
  if (month.getDate() === t.getDate() && at(month).length) out.push({ label: 'A month ago', entries: at(month) });
  for (let y = 1; y <= 20; y++) {
    const d = new Date(t.getFullYear() - y, t.getMonth(), t.getDate());
    if (d.getDate() !== t.getDate()) continue;
    const list = at(d);
    if (list.length) out.push({ label: y === 1 ? 'A year ago' : `${y} years ago`, entries: list });
  }
  return out;
}

/** Words to search by: his words in the entry, its place, its prompt, its journal's name. */
export function matches(e: Entry, q: string, journals: Journal[]): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = `${e.text} ${e.place ?? ''} ${e.prompt ?? ''} ${journals.find((j) => j.id === e.journal)?.name ?? ''}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}

// ---------------------------------------------------------------- the first run's examples

/** Three example entries, real-looking, from the last few days: shown with the tour until CLEAR SAMPLES. */
export function samples(now = Date.now()): Entry[] {
  const d = (back: number, h: number) => {
    const x = new Date(now);
    x.setDate(x.getDate() - back);
    x.setHours(h, 15, 0, 0);
    return x.getTime();
  };
  return [
    { id: 'sample-1', journal: 'personal', at: d(0, 8), text: 'Up before the alarm for once. Coffee on the back step while the garden was still grey; the robin was back on the fence. Want to keep mornings like this.', mood: 4, place: 'Home', photos: [], prompt: 'What made this morning good?', sample: true, edited: now },
    { id: 'sample-2', journal: 'personal', at: d(1, 19), text: 'Long day. The meeting ran over, but the walk home along the canal cleared my head. Note to self: say no to the 4 pm slot.', mood: 3, place: 'Canal path', photos: [], sample: true, edited: now },
    { id: 'sample-3', journal: 'personal', at: d(3, 21), text: 'Three good things: dinner with Mum, finishing the shelves, an early night.', mood: 5, photos: [], prompt: 'Three good things today', sample: true, edited: now },
  ];
}

// ---------------------------------------------------------------- photos and voice notes (IndexedDB, this phone only)

const DB = 'ghosty-journal';
let db: Promise<IDBDatabase | null> | null = null;
const open = (): Promise<IDBDatabase | null> =>
  (db ??= new Promise((ok) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('media');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ok(null);
    } catch {
      ok(null);
    }
  }));

export async function putMedia(id: string, blob: Blob): Promise<boolean> {
  const d = await open();
  if (!d) return false;
  return new Promise((ok) => {
    const tx = d.transaction('media', 'readwrite');
    tx.objectStore('media').put(blob, id);
    tx.oncomplete = () => ok(true);
    tx.onerror = () => ok(false);
  });
}
export async function getMedia(id: string): Promise<Blob | null> {
  const d = await open();
  if (!d) return null;
  return new Promise((ok) => {
    const r = d.transaction('media').objectStore('media').get(id);
    r.onsuccess = () => ok((r.result as Blob) ?? null);
    r.onerror = () => ok(null);
  });
}
export async function dropMedia(ids: string[]): Promise<void> {
  const d = await open();
  if (!d || !ids.length) return;
  await new Promise<void>((ok) => {
    const tx = d.transaction('media', 'readwrite');
    for (const id of ids) tx.objectStore('media').delete(id);
    tx.oncomplete = () => ok();
    tx.onerror = () => ok();
  });
}

/** A photo made smaller on the phone (its location and camera data are not copied: a canvas keeps only the pixels). */
export async function shrink(file: Blob, max: number, quality = 0.8): Promise<Blob | null> {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bmp.width * k));
    c.height = Math.max(1, Math.round(bmp.height * k));
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close?.();
    return await new Promise((ok) => c.toBlob((b) => ok(b), 'image/jpeg', quality));
  } catch {
    return null;
  }
}
export const asDataUrl = (b: Blob): Promise<string> =>
  new Promise((ok) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result ?? ''));
    r.onerror = () => ok('');
    r.readAsDataURL(b);
  });

// ---------------------------------------------------------------- a photo's own place, read on the phone

/**
 * Where a photo was taken, from its own EXIF data (a JPEG's GPS tags), read here on the phone. Used only to name the nearest SAVED
 * place; the position itself is never kept in the entry and never sent anywhere. Null when the photo carries none.
 */
export async function photoGps(file: Blob): Promise<{ lat: number; lon: number } | null> {
  try {
    const v = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
    if (v.getUint16(0) !== 0xffd8) return null;
    let o = 2;
    while (o + 4 < v.byteLength) {
      const marker = v.getUint16(o);
      const len = v.getUint16(o + 2);
      if (marker === 0xffe1 && v.getUint32(o + 4) === 0x45786966) return readGps(v, o + 10);
      if ((marker & 0xff00) !== 0xff00) return null;
      o += 2 + len;
    }
    return null;
  } catch {
    return null;
  }
}
function readGps(v: DataView, t: number): { lat: number; lon: number } | null {
  const le = v.getUint16(t) === 0x4949;
  const u16 = (p: number) => v.getUint16(t + p, le);
  const u32 = (p: number) => v.getUint32(t + p, le);
  const ifd = (p: number) => {
    const n = u16(p);
    const tags = new Map<number, number>();
    for (let i = 0; i < n; i++) tags.set(u16(p + 2 + i * 12), p + 2 + i * 12);
    return tags;
  };
  const gpsAt = ifd(u32(4)).get(0x8825);
  if (gpsAt === undefined) return null;
  const g = ifd(u32(gpsAt + 8));
  const ref = (tag: number) => (g.has(tag) ? String.fromCharCode(v.getUint8(t + g.get(tag)! + 8)) : '');
  const dms = (tag: number) => {
    const e = g.get(tag);
    if (e === undefined) return NaN;
    const p = u32(e + 8);
    const r = (i: number) => u32(p + i * 8) / (u32(p + i * 8 + 4) || 1);
    return r(0) + r(1) / 60 + r(2) / 3600;
  };
  let lat = dms(2);
  let lon = dms(4);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) return null;
  if (ref(1) === 'S') lat = -lat;
  if (ref(3) === 'W') lon = -lon;
  return { lat, lon };
}

/** The saved place within `within` metres of a point (the nearest), or null: only a saved place's name ever comes back. */
export function nearestSaved(p: { lat: number; lon: number }, places: { label: string; lat: number; lon: number }[], within = 300): string | null {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  let best: { label: string; d: number } | null = null;
  for (const s of places) {
    const a = Math.sin(rad(s.lat - p.lat) / 2) ** 2 + Math.cos(rad(p.lat)) * Math.cos(rad(s.lat)) * Math.sin(rad(s.lon - p.lon) / 2) ** 2;
    const d = 2 * R * Math.asin(Math.sqrt(a));
    if (d <= within && (!best || d < best.d)) best = { label: s.label, d };
  }
  return best?.label ?? null;
}
