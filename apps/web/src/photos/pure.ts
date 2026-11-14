/**
 * PHOTOS, the pure part (THE APPS ROUND, lane LENS): everything the library decides that needs no screen, tested in Node.
 *
 * - A JPEG's own data (EXIF): when it was taken and, when the camera wrote it, where. Where stays on the phone: it is shown to him
 *   and used for his map and his places, and never goes to the brain.
 * - A picture's fingerprint (a 64-bit difference hash of a 9 × 8 grey copy): two photos a few bits apart are the same moment taken
 *   twice; the best of a group is the sharpest, then the biggest.
 * - Search: his words against what is kept with each photo (the names the Lens's namer gave it on the phone, the words read in it,
 *   its file name, its album names), plus dates ("march", "2025", "last summer", "yesterday") and kinds ("videos", "favourites").
 * - The library's months, its 30-day Recently deleted, On this day, and a memory (a day or a trip worth a short film).
 */

export type Kind = 'photo' | 'video';

/** One item of the library, as its rows are kept (the picture's bytes and its thumbnail are kept beside it, by id). */
export interface Item {
  id: string;
  kind: Kind;
  name: string;
  type: string;
  w: number;
  h: number;
  /** When it was taken (the camera's own time, else the file's), ms. */
  taken: number;
  /** When he brought it in, ms. */
  added: number;
  bytes: number;
  fav: boolean;
  hidden: boolean;
  /** When he deleted it (it waits 30 days in Recently deleted), or 0. */
  deletedAt: number;
  albums: string[];
  /** Where it was taken, from its own data; on the phone only. */
  place?: { lat: number; lon: number };
  /** The 64-bit fingerprint as 16 hex digits. */
  hash: string;
  /** How sharp (mean gradient of the grey copy), for the best of a group. */
  sharp: number;
  /** The names the namer or the finder gave it, on the phone. */
  labels: string[];
  /** Words read in it, on the phone. */
  text: string;
  /** Its words have been looked for (found or not), so READ THE WORDS does not read it again. */
  textRead?: boolean;
  /** A video's length in seconds. */
  secs?: number;
  /** One of the sample photos a first run shows (REMOVE SAMPLES takes them all away). */
  sample?: boolean;
  /** People he introduced, seen in it (by the names he gave); never anyone else. */
  people?: string[];
}

export const DAY = 86_400_000;
/** How long a deleted photo waits before it goes for good. */
export const BIN_DAYS = 30;

// ---------------------------------------------------------------- EXIF

/** A JPEG's EXIF: DateTimeOriginal (local time as written) and the GPS position, or nulls. Reads only the APP1 segment. */
export function readExif(buf: ArrayBuffer): { taken: number | null; place: { lat: number; lon: number } | null; camera: string } {
  const out = { taken: null as number | null, place: null as { lat: number; lon: number } | null, camera: '' };
  const v = new DataView(buf);
  if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return out;
  let p = 2;
  while (p + 4 <= v.byteLength) {
    if (v.getUint8(p) !== 0xff) break;
    const marker = v.getUint8(p + 1);
    const len = v.getUint16(p + 2);
    if (marker === 0xe1 && p + 10 <= v.byteLength && v.getUint32(p + 4) === 0x45786966) return { ...out, ...tiff(v, p + 10, Math.min(v.byteLength, p + 2 + len)) };
    if (marker === 0xda) break;
    p += 2 + len;
  }
  return out;
}

function tiff(v: DataView, start: number, end: number): { taken: number | null; place: { lat: number; lon: number } | null; camera: string } {
  const out = { taken: null as number | null, place: null as { lat: number; lon: number } | null, camera: '' };
  if (start + 8 > end) return out;
  const le = v.getUint16(start) === 0x4949;
  const u16 = (o: number) => (o + 2 <= end ? v.getUint16(o, le) : 0);
  const u32 = (o: number) => (o + 4 <= end ? v.getUint32(o, le) : 0);
  const ascii = (o: number, n: number) => {
    let s = '';
    for (let i = 0; i < n && o + i < end; i++) {
      const c = v.getUint8(o + i);
      if (!c) break;
      s += String.fromCharCode(c);
    }
    return s.trim();
  };
  const rational = (o: number) => (u32(o + 4) ? u32(o) / u32(o + 4) : 0);
  /** One IFD's entries: tag → [type, count, value offset (or the value itself, at its offset)]. */
  const ifd = (at: number): Map<number, { type: number; count: number; at: number }> => {
    const m = new Map<number, { type: number; count: number; at: number }>();
    const o = start + at;
    const n = u16(o);
    for (let i = 0; i < n && i < 400; i++) {
      const e = o + 2 + i * 12;
      const type = u16(e + 2);
      const count = u32(e + 4);
      const size = ({ 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 } as Record<number, number>)[type] ?? 1;
      m.set(u16(e), { type, count, at: size * count > 4 ? start + u32(e + 8) : e + 8 });
    }
    return m;
  };
  const ifd0 = ifd(u32(start + 4));
  const make = ifd0.get(0x010f), model = ifd0.get(0x0110);
  out.camera = [make ? ascii(make.at, make.count) : '', model ? ascii(model.at, model.count) : ''].filter(Boolean).join(' ').slice(0, 60);
  const exifAt = ifd0.get(0x8769);
  const dateOf = (e?: { count: number; at: number }) => {
    const s = e ? ascii(e.at, e.count) : '';
    const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(s);
    return m ? new Date(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +m[6]!).getTime() : null;
  };
  if (exifAt) {
    const ex = ifd(u32(exifAt.at));
    out.taken = dateOf(ex.get(0x9003)) ?? dateOf(ex.get(0x9004));
  }
  out.taken ??= dateOf(ifd0.get(0x0132));
  const gpsAt = ifd0.get(0x8825);
  if (gpsAt) {
    const g = ifd(u32(gpsAt.at));
    const latRef = g.get(1), lat = g.get(2), lonRef = g.get(3), lon = g.get(4);
    if (lat && lon && lat.count >= 3 && lon.count >= 3) {
      const dms = (e: { at: number }) => rational(e.at) + rational(e.at + 8) / 60 + rational(e.at + 16) / 3600;
      let la = dms(lat), lo = dms(lon);
      if (latRef && ascii(latRef.at, 2).startsWith('S')) la = -la;
      if (lonRef && ascii(lonRef.at, 2).startsWith('W')) lo = -lo;
      if (Number.isFinite(la) && Number.isFinite(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180 && (la !== 0 || lo !== 0)) out.place = { lat: Math.round(la * 1e5) / 1e5, lon: Math.round(lo * 1e5) / 1e5 };
    }
  }
  return out;
}

// ---------------------------------------------------------------- fingerprints and duplicates

/** The difference hash of a 9 × 8 grey picture (72 values, row by row): 64 bits as 16 hex digits. */
export function dHash(grey: ArrayLike<number>): string {
  let hex = '';
  for (let y = 0; y < 8; y++) {
    let nib = 0;
    for (let x = 0; x < 8; x++) {
      nib = (nib << 1) | (grey[y * 9 + x]! > grey[y * 9 + x + 1]! ? 1 : 0);
      if (x === 3 || x === 7) {
        hex += nib.toString(16);
        nib = 0;
      }
    }
  }
  return hex;
}

/** How many bits two fingerprints differ by (64 when either is missing). */
export function hamming(a: string, b: string): number {
  if (a.length !== 16 || b.length !== 16) return 64;
  let d = 0;
  for (let i = 0; i < 16; i++) {
    let x = parseInt(a[i]!, 16) ^ parseInt(b[i]!, 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
}

/** Near enough to be the same moment taken twice. */
export const SAME_BITS = 6;
/** How far apart two shots of one moment can be taken. */
export const SAME_WINDOW = 2 * 3_600_000;

/**
 * The library's duplicates and near-duplicates: groups of two or more photos whose fingerprints are within SAME_BITS of one, and
 * taken within two hours of each other (the same moment kept twice, or shot again a moment later); each group's best shot first (the sharpest, then the most pixels, then the oldest kept).
 */
export function duplicateGroups(items: Item[]): Item[][] {
  const live = items.filter((i) => i.kind === 'photo' && !i.deletedAt && i.hash.length === 16).sort((a, b) => a.taken - b.taken);
  const seen = new Set<string>();
  const groups: Item[][] = [];
  for (let i = 0; i < live.length; i++) {
    const a = live[i]!;
    if (seen.has(a.id)) continue;
    const g = [a];
    for (let j = i + 1; j < live.length; j++) {
      const b = live[j]!;
      if (b.taken - a.taken > SAME_WINDOW) break;
      if (!seen.has(b.id) && hamming(a.hash, b.hash) <= SAME_BITS) g.push(b);
    }
    if (g.length > 1) {
      g.forEach((x) => seen.add(x.id));
      groups.push(g.sort((x, y) => y.sharp - x.sharp || y.w * y.h - x.w * x.h || x.added - y.added));
    }
  }
  return groups;
}

/** The mean gradient of a grey picture (w × h), a plain measure of how sharp it is. */
export function sharpness(grey: ArrayLike<number>, w: number, h: number): number {
  let s = 0, n = 0;
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const p = grey[y * w + x]!;
      s += Math.abs(p - grey[y * w + x + 1]!) + Math.abs(p - grey[(y + 1) * w + x]!);
      n += 2;
    }
  }
  return n ? Math.round((s / n) * 100) / 100 : 0;
}

// ---------------------------------------------------------------- the library's views

/** What is in the library (not deleted; hidden only when asked for). */
export const visible = (items: Item[], hidden = false): Item[] => items.filter((i) => !i.deletedAt && (hidden ? i.hidden : !i.hidden));

/** Months, newest first: "November 2026" and its items, newest first. */
export function byMonth(items: Item[]): { key: string; title: string; items: Item[] }[] {
  const m = new Map<string, Item[]>();
  for (const it of [...items].sort((a, b) => b.taken - a.taken)) {
    const d = new Date(it.taken);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    m.set(key, [...(m.get(key) ?? []), it]);
  }
  return [...m].map(([key, list]) => ({ key, title: new Date(list[0]!.taken).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }), items: list }));
}

/** Recently deleted: what waits, with the days left; and what has waited long enough to go for good. */
export function bin(items: Item[], now: number): { waiting: (Item & { daysLeft: number })[]; expired: Item[] } {
  const waiting: (Item & { daysLeft: number })[] = [];
  const expired: Item[] = [];
  for (const it of items) {
    if (!it.deletedAt) continue;
    const left = BIN_DAYS - Math.floor((now - it.deletedAt) / DAY);
    if (left <= 0) expired.push(it);
    else waiting.push({ ...it, daysLeft: left });
  }
  return { waiting: waiting.sort((a, b) => b.deletedAt - a.deletedAt), expired };
}

/** On this day: photos from this day and month in earlier years, by year, newest first. */
export function onThisDay(items: Item[], now: number): { year: number; items: Item[] }[] {
  const t = new Date(now);
  const m = new Map<number, Item[]>();
  for (const it of visible(items)) {
    const d = new Date(it.taken);
    if (d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() < t.getFullYear()) m.set(d.getFullYear(), [...(m.get(d.getFullYear()) ?? []), it]);
  }
  return [...m].sort((a, b) => b[0] - a[0]).map(([year, list]) => ({ year, items: list.sort((a, b) => a.taken - b.taken) }));
}

/**
 * Memories: a day, or a run of days with photos no more than a day apart (a trip), with at least four photos; newest first, each
 * with a title in his words ("Saturday 3 May 2025", "5 days in August 2025") and its photos in order.
 */
export function memories(items: Item[], min = 4): { id: string; title: string; items: Item[]; from: number; to: number }[] {
  const list = visible(items).filter((i) => i.kind === 'photo').sort((a, b) => a.taken - b.taken);
  const runs: Item[][] = [];
  for (const it of list) {
    const last = runs[runs.length - 1];
    if (last && it.taken - last[last.length - 1]!.taken <= 1.5 * DAY) last.push(it);
    else runs.push([it]);
  }
  return runs
    .filter((r) => r.length >= min)
    .map((r) => {
      const from = r[0]!.taken, to = r[r.length - 1]!.taken;
      const days = Math.round((startOfDay(to) - startOfDay(from)) / DAY) + 1;
      const title = days <= 1 ? new Date(from).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : `${days} days in ${new Date(from).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`;
      return { id: `m${from}`, title, items: r, from, to };
    })
    .sort((a, b) => b.from - a.from);
}
const startOfDay = (t: number) => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

// ---------------------------------------------------------------- search

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const SEASONS: Record<string, number[]> = { spring: [2, 3, 4], summer: [5, 6, 7], autumn: [8, 9, 10], fall: [8, 9, 10], winter: [11, 0, 1] };
const STOP = new Set('a an the of on in at with and or my me photo photos picture pictures pics pic show find from some all'.split(' '));

export interface Query {
  words: string[];
  months: number[];
  years: number[];
  from?: number;
  to?: number;
  kind?: Kind;
  fav?: boolean;
}

/** His words → what to look for: the words, any months, seasons, years or recent days, and kinds ("videos", "favourites"). */
export function parseQuery(q: string, now: number): Query {
  const out: Query = { words: [], months: [], years: [] };
  let t = ` ${String(q ?? '').toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, ' ')} `;
  const day = (n: number) => startOfDay(now) - n * DAY;
  if (/\btoday\b/.test(t)) (out.from = day(0)), (t = t.replace(/\btoday\b/, ' '));
  if (/\byesterday\b/.test(t)) (out.from = day(1)), (out.to = day(0)), (t = t.replace(/\byesterday\b/, ' '));
  const lastN = /\blast (week|month|year)\b/.exec(t);
  if (lastN) {
    out.from = now - ({ week: 7, month: 31, year: 366 } as Record<string, number>)[lastN[1]!]! * DAY;
    t = t.replace(lastN[0], ' ');
  }
  const lastSeason = /\blast (spring|summer|autumn|fall|winter)\b/.exec(t);
  for (const [name, ms] of Object.entries(SEASONS)) {
    if (new RegExp(`\\b${name}\\b`).test(t)) {
      out.months.push(...ms);
      if (lastSeason?.[1] === name) {
        const y = new Date(now).getFullYear();
        out.years.push(ms.includes(new Date(now).getMonth()) || ms[0]! > new Date(now).getMonth() ? y - 1 : y);
      }
      t = t.replace(new RegExp(`\\b(?:last )?${name}\\b`), ' ');
    }
  }
  MONTHS.forEach((m, i) => {
    const re = new RegExp(`\\b(?:${m}|${m.slice(0, 3)})\\b`);
    if (re.test(t) && !(m === 'may' && /\bmay\b/.test(t) && !/\b(?:in|of|from|during) may\b|^\s*may\s*$|\bmay \d{4}\b/.test(t))) {
      out.months.push(i);
      t = t.replace(re, ' ');
    }
  });
  for (const m of t.matchAll(/\b(19[5-9]\d|20[0-4]\d)\b/g)) out.years.push(+m[1]!);
  t = t.replace(/\b(19[5-9]\d|20[0-4]\d)\b/g, ' ');
  if (/\b(?:videos?|films?|clips?)\b/.test(t)) (out.kind = 'video'), (t = t.replace(/\b(?:videos?|films?|clips?)\b/g, ' '));
  if (/\b(?:favourites?|favorites?|faves?|loved|hearted)\b/.test(t)) (out.fav = true), (t = t.replace(/\b(?:favourites?|favorites?|faves?|loved|hearted)\b/g, ' '));
  out.words = t.split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w));
  return out;
}

/** A word and its plain plural or singular ("dogs" finds "dog", "beach" finds "beaches"). */
const forms = (w: string): string[] => [w, w.endsWith('es') ? w.slice(0, -2) : `${w}es`, w.endsWith('s') ? w.slice(0, -1) : `${w}s`];

/** Does an item answer the query? Every word must be found in its names, words, file name, albums or people. */
export function matches(it: Item, q: Query, albumNames: Record<string, string> = {}): boolean {
  if (it.deletedAt || it.hidden) return false;
  if (q.kind && it.kind !== q.kind) return false;
  if (q.fav && !it.fav) return false;
  const d = new Date(it.taken);
  if (q.months.length && !q.months.includes(d.getMonth())) return false;
  if (q.years.length && !q.years.includes(d.getFullYear())) return false;
  if (q.from != null && it.taken < q.from) return false;
  if (q.to != null && it.taken >= q.to) return false;
  if (!q.words.length) return true;
  const hay = ` ${[...it.labels, it.text, it.name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' '), ...it.albums.map((a) => albumNames[a] ?? ''), ...(it.people ?? [])].join(' ').toLowerCase()} `;
  return q.words.every((w) => forms(w).some((f) => new RegExp(`(?:^|[^\\p{L}])${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[^\\p{L}]|$)`, 'u').test(hay)));
}

// ---------------------------------------------------------------- words

/** Bytes in his words: "312 MB", "1.4 GB". */
export function sizeWords(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${Math.round(bytes / 1e6)} MB`;
  if (bytes >= 1e3) return `${Math.round(bytes / 1e3)} KB`;
  return `${bytes} bytes`;
}

/** "128 photos and 3 videos · 312 MB on this phone". */
export function libraryLine(items: Item[]): string {
  const live = items.filter((i) => !i.deletedAt);
  const p = live.filter((i) => i.kind === 'photo').length, v = live.length - p;
  const bytes = live.reduce((s, i) => s + i.bytes, 0);
  const n = (k: number, w: string) => `${k} ${w}${k === 1 ? '' : 's'}`;
  return `${[p || !v ? n(p, 'photo') : '', v ? n(v, 'video') : ''].filter(Boolean).join(' and ')} · ${sizeWords(bytes)} on this phone`;
}

/** A video's length: "0:42", "12:05". */
export const clock = (secs: number): string => `${Math.floor(secs / 60)}:${String(Math.round(secs % 60)).padStart(2, '0')}`;

// ---------------------------------------------------------------- places, from the photos' own data (on the phone only)

/** "51.5° N, 0.1° W": a place in his words from its numbers alone (nothing is looked up, so where stays on the phone). */
export const placeWords = (lat: number, lon: number): string => `${Math.abs(lat).toFixed(1)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(1)}° ${lon >= 0 ? 'E' : 'W'}`;

/** The places his photos were taken: groups of photos within about 10 km of each other (a tenth of a degree), the biggest first. */
export function placesOf(items: Item[]): { key: string; lat: number; lon: number; title: string; items: Item[] }[] {
  const m = new Map<string, Item[]>();
  for (const it of visible(items)) {
    if (!it.place) continue;
    const key = `${Math.round(it.place.lat * 10) / 10},${Math.round(it.place.lon * 10) / 10}`;
    m.set(key, [...(m.get(key) ?? []), it]);
  }
  return [...m]
    .map(([key, list]) => {
      const lat = list.reduce((s, i) => s + i.place!.lat, 0) / list.length, lon = list.reduce((s, i) => s + i.place!.lon, 0) / list.length;
      return { key, lat, lon, title: placeWords(lat, lon), items: list.sort((a, b) => b.taken - a.taken) };
    })
    .sort((a, b) => b.items.length - a.items.length || b.items[0]!.taken - a.items[0]!.taken);
}
